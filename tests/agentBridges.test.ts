import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import {
  generateWithAgentBridge,
  normalizeAgentBridgeKind,
  resolveAgentBridgeConfig,
} from "../server/agentBridges";

const baseRequest = {
  topic: "Bridge test topic",
  history: [],
  currentAgent: "agentA" as const,
  agentConfig: {
    agentA: { name: "Bridge Advocate" },
    agentB: { name: "Bridge Critic" },
  },
  systemInstruction: "Return Cognitive Pong JSON.",
  conversationText: "Argue the next point.",
  defaultComplexity: "auto",
};

async function withBridgeEnv<T>(patch: Record<string, string | undefined>, run: () => Promise<T> | T) {
  const prior: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prior[key] = process.env[key];
    if (patch[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = patch[key];
    }
  }

  try {
    return await run();
  } finally {
    for (const key of Object.keys(patch)) {
      if (prior[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prior[key];
      }
    }
  }
}

function decodeWebSocketTextFrame(buffer: Buffer) {
  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) !== 0;
  let length = secondByte & 0x7f;
  let offset = 2;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  const mask = isMasked ? buffer.subarray(offset, offset + 4) : undefined;
  if (isMasked) offset += 4;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }
  return payload.toString("utf8");
}

function webSocketFrameTotalLength(buffer: Buffer) {
  if (buffer.length < 2) return null;
  const secondByte = buffer[1];
  let length = secondByte & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }
  if ((secondByte & 0x80) !== 0) {
    offset += 4;
  }
  const total = offset + length;
  return buffer.length >= total ? total : null;
}

function encodeWebSocketTextFrame(text: string) {
  const payload = Buffer.from(text, "utf8");
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

async function createWebSocketBridgeServer(handler: (payload: any) => any) {
  const server = net.createServer((socket) => {
    let handshakeBuffer = Buffer.alloc(0);
    let frameBuffer = Buffer.alloc(0);
    let handshakeComplete = false;
    let responded = false;

    const processFrame = () => {
      if (responded) return;
      const frameLength = webSocketFrameTotalLength(frameBuffer);
      if (frameLength === null) return;
      const requestPayload = JSON.parse(decodeWebSocketTextFrame(frameBuffer.subarray(0, frameLength)));
      responded = true;
      socket.write(encodeWebSocketTextFrame(JSON.stringify(handler(requestPayload))));
      socket.end();
    };

    socket.on("data", (chunk) => {
      if (!handshakeComplete) {
        handshakeBuffer = Buffer.concat([handshakeBuffer, chunk]);
        const headerEnd = handshakeBuffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const headerText = handshakeBuffer.subarray(0, headerEnd + 4).toString("utf8");
        const keyMatch = headerText.match(/Sec-WebSocket-Key:\s*(.+)\r\n/i);
        assert(keyMatch, "WebSocket client must send Sec-WebSocket-Key");
        const accept = crypto
          .createHash("sha1")
          .update(`${keyMatch[1].trim()}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
          .digest("base64");
        socket.write([
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${accept}`,
          "",
          "",
        ].join("\r\n"));
        handshakeComplete = true;

        const remaining = handshakeBuffer.subarray(headerEnd + 4);
        handshakeBuffer = Buffer.alloc(0);
        if (remaining.length > 0) {
          frameBuffer = Buffer.concat([frameBuffer, remaining]);
          processFrame();
        }
        return;
      }

      frameBuffer = Buffer.concat([frameBuffer, chunk]);
      processFrame();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    port: address.port,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

test("normalizes bridge aliases", () => {
  assert.equal(normalizeAgentBridgeKind("off"), "none");
  assert.equal(normalizeAgentBridgeKind("ws"), "websocket");
  assert.equal(normalizeAgentBridgeKind("codex"), "codex-cli");
  assert.equal(normalizeAgentBridgeKind("mcp-style"), "mcp");
});

test("defaults to no agent bridge", () => {
  const prior = process.env.COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE;
  delete process.env.COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE;

  try {
    const bridge = resolveAgentBridgeConfig({ agentA: {}, agentB: {} }, "agentA");
    assert.equal(bridge.kind, "none");
  } finally {
    if (prior === undefined) {
      delete process.env.COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE;
    } else {
      process.env.COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE = prior;
    }
  }
});

test("resolves Codex and generic CLI bridges from server-side allowlisted profiles", () => {
  const prior = {
    cliProfiles: process.env.COGNITIVE_PONG_CLI_PROFILES,
    codexCommand: process.env.CODEX_CLI_COMMAND,
    codexArgs: process.env.CODEX_CLI_ARGS,
  };
  process.env.CODEX_CLI_COMMAND = "codex";
  process.env.CODEX_CLI_ARGS = JSON.stringify(["exec", "{prompt}"]);
  process.env.COGNITIVE_PONG_CLI_PROFILES = JSON.stringify({
    agent_b_safe: {
      label: "Agent B safe profile",
      command: "node",
      args: ["./agent-b.js"],
      cwd: "C:/safe/workspace",
    },
  });

  try {
    const config = {
      bridge: { kind: "http", endpointUrl: "http://global.example/turn" },
      agentA: {
        bridge: {
          kind: "codex-cli",
          label: "Codex Agent A",
          command: "ignored-browser-command",
          args: ["ignored"],
          profileId: "codex",
        },
      },
      agentB: {
        bridge: {
          kind: "cli",
          label: "Custom Agent B CLI",
          command: "ignored-browser-command",
          args: ["ignored"],
          profileId: "agent_b_safe",
        },
      },
    };

    const agentABridge = resolveAgentBridgeConfig(config, "agentA");
    const agentBBridge = resolveAgentBridgeConfig(config, "agentB");

    assert.equal(agentABridge.kind, "codex-cli");
    assert.equal(agentABridge.profileId, "codex");
    assert.equal(agentABridge.command, "codex");
    assert.deepEqual(agentABridge.args, ["exec", "{prompt}"]);
    assert.equal(agentABridge.label, "Codex Agent A");
    assert.equal(agentBBridge.kind, "cli");
    assert.equal(agentBBridge.profileId, "agent_b_safe");
    assert.equal(agentBBridge.command, "node");
    assert.deepEqual(agentBBridge.args, ["./agent-b.js"]);
    assert.equal(agentBBridge.cwd, "C:/safe/workspace");
    assert.equal(agentBBridge.label, "Custom Agent B CLI");
  } finally {
    if (prior.cliProfiles === undefined) delete process.env.COGNITIVE_PONG_CLI_PROFILES;
    else process.env.COGNITIVE_PONG_CLI_PROFILES = prior.cliProfiles;
    if (prior.codexCommand === undefined) delete process.env.CODEX_CLI_COMMAND;
    else process.env.CODEX_CLI_COMMAND = prior.codexCommand;
    if (prior.codexArgs === undefined) delete process.env.CODEX_CLI_ARGS;
    else process.env.CODEX_CLI_ARGS = prior.codexArgs;
  }
});

test("does not execute local CLI bridges without explicit opt-in", async () => {
  const prior = process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES;
  delete process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES;

  try {
    await assert.rejects(
      generateWithAgentBridge({
        ...baseRequest,
        bridge: {
          kind: "cli",
          label: "blocked-cli",
          command: "node",
          args: ["--version"],
          timeoutMs: 1000,
        },
      }),
      /disabled/
    );
  } finally {
    if (prior === undefined) {
      delete process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES;
    } else {
      process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES = prior;
    }
  }
});

test("generic CLI bridges receive Cognitive Pong JSON on stdin", async () => {
  await withBridgeEnv({
    COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES: "true",
    COGNITIVE_PONG_AGENT_BRIDGE_COMMAND: process.execPath,
    COGNITIVE_PONG_AGENT_BRIDGE_ARGS: JSON.stringify([
      "-e",
      [
        "let body = '';",
        "process.stdin.on('data', (chunk) => body += chunk);",
        "process.stdin.on('end', () => {",
        "  const payload = JSON.parse(body);",
        "  console.log(JSON.stringify({",
        "    content: `CLI stdin received ${payload.currentAgent} for ${payload.topic}.`,",
        "    type: 'proposal',",
        "    convictionScore: 71,",
        "    complexity: 'quick lookup'",
        "  }));",
        "});",
      ].join(" "),
    ]),
  }, async () => {
    const bridge = resolveAgentBridgeConfig({
      agentA: { bridge: { kind: "cli", profileId: "default" } },
      agentB: {},
    }, "agentA");
    const result = await generateWithAgentBridge({
      ...baseRequest,
      bridge,
    });

    assert(result);
    assert.equal(result.parsedData.content, "CLI stdin received agentA for Bridge test topic.");
    assert.equal(result.parsedData.convictionScore, 71);
  });
});

test("Codex CLI bridges can receive a tool-ready prompt through argument placeholders", async () => {
  await withBridgeEnv({
    COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES: "true",
    CODEX_CLI_COMMAND: process.execPath,
    CODEX_CLI_ARGS: JSON.stringify([
      "-e",
      [
        "const prompt = process.argv[1] || '';",
        "console.log(JSON.stringify({",
        "  content: prompt.includes('Return only one Cognitive Pong JSON object') && prompt.includes('You may use your configured CLI tools')",
        "    ? 'Codex CLI prompt bridge received the tool-ready prompt.'",
        "    : 'Codex CLI prompt was missing bridge instructions.',",
        "  type: 'proposal',",
        "  convictionScore: 82,",
        "  complexity: 'deep research'",
        "}));",
      ].join(" "),
      "{prompt}",
    ]),
  }, async () => {
    const bridge = resolveAgentBridgeConfig({
      agentA: { bridge: { kind: "codex-cli", profileId: "codex" } },
      agentB: {},
    }, "agentA");
    const result = await generateWithAgentBridge({
      ...baseRequest,
      bridge,
    });

    assert(result);
    assert.equal(result.parsedData.content, "Codex CLI prompt bridge received the tool-ready prompt.");
    assert.equal(result.parsedData.convictionScore, 82);
  });
});

test("executes local CLI bridges after explicit opt-in", async () => {
  await withBridgeEnv({
    COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES: "true",
    COGNITIVE_PONG_AGENT_BRIDGE_COMMAND: process.execPath,
    COGNITIVE_PONG_AGENT_BRIDGE_ARGS: JSON.stringify([
      "-p",
      "JSON.stringify({content:`CLI bridge opt-in smoke produced a safe proposal.`,type:`proposal`,convictionScore:77,complexity:`quick lookup`})",
    ]),
  }, async () => {
    const bridge = resolveAgentBridgeConfig({
      agentA: { bridge: { kind: "cli", profileId: "default" } },
      agentB: {},
    }, "agentA");
    const result = await generateWithAgentBridge({
      ...baseRequest,
      bridge,
    });

    assert(result);
    assert.equal(result.parsedData.content, "CLI bridge opt-in smoke produced a safe proposal.");
    assert.equal(result.parsedData.type, "proposal");
    assert.equal(result.parsedData.convictionScore, 77);
    assert.equal(result.parsedData.complexity, "quick lookup");
  });
});

test("rejects CLI bridges that are not backed by a server allowlist profile", async () => {
  await withBridgeEnv({
    COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES: "true",
    COGNITIVE_PONG_AGENT_BRIDGE_COMMAND: undefined,
    COGNITIVE_PONG_AGENT_BRIDGE_ARGS: undefined,
    COGNITIVE_PONG_CLI_PROFILES: undefined,
  }, async () => {
    await assert.rejects(
      generateWithAgentBridge({
        ...baseRequest,
        bridge: {
          kind: "cli",
          label: "browser-command",
          profileId: "missing",
          command: process.execPath,
          args: ["--version"],
          timeoutMs: 1000,
        },
      }),
      /not allowlisted/
    );
  });
});

test("danger-full-access CLI profiles require a second explicit opt-in", async () => {
  await withBridgeEnv({
    COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES: "true",
    COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS: undefined,
    COGNITIVE_PONG_CLI_PROFILES: JSON.stringify({
      dangerous: {
        command: process.execPath,
        args: ["-e", "console.log(JSON.stringify({content:'ok',type:'proposal'}))", "--sandbox", "danger-full-access"],
      },
    }),
  }, async () => {
    const bridge = resolveAgentBridgeConfig({
      agentA: { bridge: { kind: "cli", profileId: "dangerous" } },
      agentB: {},
    }, "agentA");

    await assert.rejects(
      generateWithAgentBridge({
        ...baseRequest,
        bridge,
      }),
      /second explicit opt-in/
    );
  });
});

test("invokes HTTP agent bridge and parses Cognitive Pong JSON", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const payload = JSON.parse(body);
      assert.equal(payload.currentAgent, "agentA");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        content: "Bridge produced a structured critique.",
        type: "critique",
        convictionScore: 64,
        complexity: "deep research",
      }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await generateWithAgentBridge({
      ...baseRequest,
      bridge: {
        kind: "http",
        label: "local-test-bridge",
        endpointUrl: `http://127.0.0.1:${address.port}`,
        timeoutMs: 3000,
      },
    });

    assert(result);
    assert.equal(result.parsedData.content, "Bridge produced a structured critique.");
    assert.equal(result.parsedData.type, "critique");
    assert.equal(result.parsedData.convictionScore, 64);
    assert.equal(result.parsedData.complexity, "deep research");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test("invokes WebSocket agent bridge and parses one response", async () => {
  let capturedPayload: any = null;
  const server = await createWebSocketBridgeServer((payload) => {
    capturedPayload = payload;
    return {
      content: "WebSocket bridge produced a deterministic proposal.",
      type: "proposal",
      convictionScore: 81,
      complexity: "quick lookup",
    };
  });

  try {
    const result = await generateWithAgentBridge({
      ...baseRequest,
      bridge: {
        kind: "websocket",
        label: "local-ws-bridge",
        endpointUrl: `ws://127.0.0.1:${server.port}`,
        timeoutMs: 3000,
      },
    });

    assert(capturedPayload);
    assert.equal(capturedPayload.currentAgent, "agentA");
    assert.equal(capturedPayload.responseFormat, "cognitive-pong-json");
    assert.equal(capturedPayload.agent.name, "Bridge Advocate");
    assert(result);
    assert.equal(result.parsedData.content, "WebSocket bridge produced a deterministic proposal.");
    assert.equal(result.parsedData.type, "proposal");
    assert.equal(result.parsedData.convictionScore, 81);
    assert.equal(result.parsedData.complexity, "quick lookup");
  } finally {
    await server.close();
  }
});

test("invokes MCP-style bridge with tools/call payload and parses result text", async () => {
  let capturedPayload: any = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      capturedPayload = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: capturedPayload.id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                content: "MCP bridge returned a validated critique.",
                type: "critique",
                convictionScore: 69,
                complexity: "deep research",
              }),
            },
          ],
        },
      }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await generateWithAgentBridge({
      ...baseRequest,
      bridge: {
        kind: "mcp",
        label: "local-mcp-bridge",
        endpointUrl: `http://127.0.0.1:${address.port}`,
        toolName: "custom_cognitive_turn",
        timeoutMs: 3000,
      },
    });

    assert(capturedPayload);
    assert.equal(capturedPayload.method, "tools/call");
    assert.equal(capturedPayload.params.name, "custom_cognitive_turn");
    assert.equal(capturedPayload.params.arguments.currentAgent, "agentA");
    assert.equal(capturedPayload.params.arguments.responseFormat, "cognitive-pong-json");
    assert(result);
    assert.equal(result.parsedData.content, "MCP bridge returned a validated critique.");
    assert.equal(result.parsedData.type, "critique");
    assert.equal(result.parsedData.convictionScore, 69);
    assert.equal(result.parsedData.complexity, "deep research");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
