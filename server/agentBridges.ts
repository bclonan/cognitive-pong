import { spawn } from "node:child_process";
import { parseProviderText } from "./providers";
import { defaultBridgeArgsForKind } from "../src/utils/agentBridgeControls";

export type AgentBridgeKind = "none" | "http" | "websocket" | "cli" | "codex-cli" | "mcp";

export interface AgentBridgeConfig {
  kind: AgentBridgeKind;
  label: string;
  endpointUrl?: string;
  profileId?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  apiKey?: string;
  toolName?: string;
  timeoutMs: number;
}

export interface AgentBridgeRequest {
  topic: string;
  history: any[];
  currentAgent: "agentA" | "agentB";
  agentConfig: any;
  bridge: AgentBridgeConfig;
  systemInstruction: string;
  conversationText: string;
  defaultComplexity: string;
}

export interface AgentBridgeResult {
  parsedData: any;
  bridge: AgentBridgeConfig;
}

const DEFAULT_BRIDGE_TIMEOUT_MS = 15000;

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim();
}

function parseJsonArray(raw?: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : undefined;
  } catch {
    return raw.split(" ").map((part) => part.trim()).filter(Boolean);
  }
}

function parseCliProfiles(raw?: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function clampTimeout(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_BRIDGE_TIMEOUT_MS;
  return Math.max(1000, Math.min(120000, numeric));
}

function defaultCliProfileId(kind: AgentBridgeKind) {
  return kind === "codex-cli" ? "codex" : "default";
}

function cleanProfileId(value?: string | null) {
  const profile = (value || "").trim();
  return /^[a-zA-Z0-9_.-]{1,80}$/.test(profile) ? profile : "";
}

function resolveCliProfile(kind: AgentBridgeKind, requestedProfileId?: string | null) {
  if (kind !== "cli" && kind !== "codex-cli") return null;

  const profileId = cleanProfileId(requestedProfileId) || defaultCliProfileId(kind);
  const profile = parseCliProfiles(process.env.COGNITIVE_PONG_CLI_PROFILES)[profileId];
  if (profile && typeof profile === "object") {
    const command = firstNonEmpty(profile.command);
    if (!command) return null;
    return {
      profileId,
      label: firstNonEmpty(profile.label, profileId) || profileId,
      command,
      args: Array.isArray(profile.args) ? profile.args.map((arg: any) => String(arg)) : defaultBridgeArgsForKind(kind),
      cwd: firstNonEmpty(profile.cwd),
      timeoutMs: profile.timeoutMs,
    };
  }

  if (kind === "codex-cli" && (profileId === "codex" || profileId === "default")) {
    return {
      profileId: "codex",
      label: "Codex CLI profile",
      command: firstNonEmpty(process.env.CODEX_CLI_COMMAND, "codex")!,
      args: parseJsonArray(process.env.CODEX_CLI_ARGS) || defaultBridgeArgsForKind("codex-cli"),
      cwd: firstNonEmpty(process.env.CODEX_CLI_CWD, process.env.COGNITIVE_PONG_AGENT_BRIDGE_CWD),
      timeoutMs: process.env.COGNITIVE_PONG_AGENT_BRIDGE_TIMEOUT_MS,
    };
  }

  if (kind === "cli" && profileId === "default") {
    const command = firstNonEmpty(process.env.COGNITIVE_PONG_AGENT_BRIDGE_COMMAND);
    if (!command) return null;
    return {
      profileId: "default",
      label: "Default CLI profile",
      command,
      args: parseJsonArray(process.env.COGNITIVE_PONG_AGENT_BRIDGE_ARGS) || defaultBridgeArgsForKind("cli"),
      cwd: firstNonEmpty(process.env.COGNITIVE_PONG_AGENT_BRIDGE_CWD),
      timeoutMs: process.env.COGNITIVE_PONG_AGENT_BRIDGE_TIMEOUT_MS,
    };
  }

  return null;
}

function cliArgsMatch(left: string[] = [], right: string[] = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertAllowlistedCliBridge(bridge: AgentBridgeConfig) {
  const profile = resolveCliProfile(bridge.kind, bridge.profileId || bridge.toolName);
  if (!profile?.command) {
    throw new Error(`CLI bridge profile "${bridge.profileId || bridge.toolName || defaultCliProfileId(bridge.kind)}" is not allowlisted on the server.`);
  }

  const expectedArgs = profile.args && profile.args.length > 0 ? profile.args : defaultBridgeArgsForKind(bridge.kind);
  if (bridge.command !== profile.command || !cliArgsMatch(bridge.args || [], expectedArgs)) {
    throw new Error("CLI bridge command and arguments must come from a server-side allowlisted profile.");
  }

  return {
    ...bridge,
    profileId: profile.profileId,
    label: bridge.label || profile.label,
    command: profile.command,
    args: expectedArgs,
    cwd: profile.cwd,
    timeoutMs: clampTimeout(bridge.timeoutMs || profile.timeoutMs),
  };
}

function usesDangerFullAccess(args: string[]) {
  return args.some((arg) => arg.includes("danger-full-access"));
}

function isDangerFullAccessEnabled() {
  return process.env.COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS === "true";
}

function safeCliErrorText(value: string) {
  return value
    .replace(/([A-Z0-9_]*(?:API|TOKEN|KEY|SECRET)[A-Z0-9_]*=)[^\s]+/gi, "$1[redacted]")
    .slice(0, 2000);
}

export function normalizeAgentBridgeKind(rawKind?: string | null): AgentBridgeKind {
  const kind = (rawKind || "").trim().toLowerCase().replace(/_/g, "-");
  switch (kind) {
    case "":
    case "none":
    case "off":
    case "disabled":
      return "none";
    case "http":
    case "custom-http":
    case "rest":
      return "http";
    case "ws":
    case "websocket":
      return "websocket";
    case "cli":
    case "stdio":
      return "cli";
    case "codex":
    case "codex-cli":
      return "codex-cli";
    case "mcp":
    case "mcp-http":
    case "mcp-style":
      return "mcp";
    default:
      return "http";
  }
}

export function resolveAgentBridgeConfig(
  agentConfig: any,
  currentAgent: "agentA" | "agentB"
): AgentBridgeConfig {
  const agent = currentAgent === "agentA" ? agentConfig?.agentA : agentConfig?.agentB;
  const rawBridge = agent?.bridge || agent?.agentBridge || agentConfig?.bridge || {};
  const rawKind = firstNonEmpty(
    rawBridge.kind,
    agent?.bridgeKind,
    agentConfig?.bridgeKind,
    process.env.COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE,
    "none"
  );
  const kind = normalizeAgentBridgeKind(rawKind);
  const endpointUrl = firstNonEmpty(
    rawBridge.endpointUrl,
    agent?.bridgeEndpointUrl,
    agentConfig?.bridgeEndpointUrl,
    process.env.COGNITIVE_PONG_AGENT_BRIDGE_URL
  );
  const profileId = cleanProfileId(firstNonEmpty(
    rawBridge.profileId,
    agent?.bridgeProfileId,
    agentConfig?.bridgeProfileId,
    kind === "cli" || kind === "codex-cli" ? rawBridge.toolName : undefined
  )) || defaultCliProfileId(kind);
  const cliProfile = resolveCliProfile(kind, profileId);
  const command = cliProfile?.command;
  const args = cliProfile?.args && cliProfile.args.length > 0
    ? cliProfile.args
    : defaultBridgeArgsForKind(kind);

  return {
    kind,
    label: firstNonEmpty(rawBridge.label, agent?.bridgeLabel, agentConfig?.bridgeLabel, cliProfile?.label, rawKind) || kind,
    endpointUrl,
    profileId: kind === "cli" || kind === "codex-cli" ? (cliProfile?.profileId || profileId) : undefined,
    command,
    args,
    cwd: cliProfile?.cwd,
    apiKey: firstNonEmpty(rawBridge.apiKey, agent?.bridgeApiKey, agentConfig?.bridgeApiKey, process.env.COGNITIVE_PONG_AGENT_BRIDGE_API_KEY),
    toolName: firstNonEmpty(rawBridge.toolName, agent?.bridgeToolName, agentConfig?.bridgeToolName, process.env.COGNITIVE_PONG_AGENT_BRIDGE_TOOL),
    timeoutMs: clampTimeout(firstNonEmpty(rawBridge.timeoutMs, agent?.bridgeTimeoutMs, agentConfig?.bridgeTimeoutMs, cliProfile?.timeoutMs ? String(cliProfile.timeoutMs) : undefined, process.env.COGNITIVE_PONG_AGENT_BRIDGE_TIMEOUT_MS))
  };
}

export function isLocalBridgeExecutionEnabled() {
  return process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES === "true";
}

function authHeaders(apiKey?: string) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function bridgePromptPayload(request: AgentBridgeRequest) {
  return {
    topic: request.topic,
    history: request.history,
    currentAgent: request.currentAgent,
    agent: request.currentAgent === "agentA" ? request.agentConfig?.agentA : request.agentConfig?.agentB,
    system: request.systemInstruction,
    prompt: request.conversationText,
    responseFormat: "cognitive-pong-json"
  };
}

function cliPromptText(request: AgentBridgeRequest) {
  return [
    request.systemInstruction,
    request.conversationText,
    "Return only one Cognitive Pong JSON object with content, type, proposal, convictionScore, complexity, optional judgeEvaluation, and optional spectatorLiveReactions.",
    "You may use your configured CLI tools when your runtime allows it, but the final stdout must be parseable JSON or plain text that can be converted into a debate turn.",
    `Bridge payload JSON:\n${JSON.stringify(bridgePromptPayload(request), null, 2)}`,
  ].join("\n\n");
}

function expandCliArg(arg: string, request: AgentBridgeRequest, payload: string, prompt: string) {
  return arg
    .replaceAll("{payload}", payload)
    .replaceAll("{prompt}", prompt)
    .replaceAll("{system}", request.systemInstruction)
    .replaceAll("{conversation}", request.conversationText)
    .replaceAll("{topic}", request.topic)
    .replaceAll("{agent}", request.currentAgent)
    .replaceAll("{history_json}", JSON.stringify(request.history || []));
}

function hasCliPlaceholder(args: string[]) {
  return args.some((arg) => /\{(?:payload|prompt|system|conversation|topic|agent|history_json)\}/.test(arg));
}

function extractBridgeText(raw: any) {
  if (typeof raw === "string") return raw;
  if (raw?.content) return typeof raw.content === "string" ? raw.content : JSON.stringify(raw.content);
  if (raw?.response) return typeof raw.response === "string" ? raw.response : JSON.stringify(raw.response);
  if (raw?.output) return typeof raw.output === "string" ? raw.output : JSON.stringify(raw.output);
  if (raw?.choices?.[0]?.message?.content) return raw.choices[0].message.content;
  if (raw?.result?.content?.[0]?.text) return raw.result.content[0].text;
  if (raw?.result?.structuredContent) return JSON.stringify(raw.result.structuredContent);
  return JSON.stringify(raw);
}

function parseBridgeResponse(raw: any, defaultComplexity: string) {
  if (raw && typeof raw === "object" && ("content" in raw || "type" in raw || "convictionScore" in raw)) {
    return parseProviderText(JSON.stringify(raw), defaultComplexity);
  }
  return parseProviderText(extractBridgeText(raw), defaultComplexity);
}

async function callHttpBridge(request: AgentBridgeRequest): Promise<AgentBridgeResult> {
  if (!request.bridge.endpointUrl) {
    throw new Error("HTTP agent bridge selected but no endpoint URL was configured.");
  }

  const response = await fetch(request.bridge.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(request.bridge.apiKey)
    },
    body: JSON.stringify(bridgePromptPayload(request)),
    signal: AbortSignal.timeout(request.bridge.timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP agent bridge returned [${response.status}]: ${errorText || response.statusText}`);
  }

  const text = await response.text();
  let raw: any = text;
  try {
    raw = JSON.parse(text);
  } catch {
    // Plain-text bridge output is supported.
  }

  return {
    parsedData: parseBridgeResponse(raw, request.defaultComplexity),
    bridge: request.bridge
  };
}

async function callWebSocketBridge(request: AgentBridgeRequest): Promise<AgentBridgeResult> {
  if (!request.bridge.endpointUrl) {
    throw new Error("WebSocket agent bridge selected but no endpoint URL was configured.");
  }
  if (!globalThis.WebSocket) {
    throw new Error("WebSocket agent bridge requires a runtime with global WebSocket support.");
  }

  const raw = await new Promise<any>((resolve, reject) => {
    const socket = new WebSocket(request.bridge.endpointUrl!);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("WebSocket agent bridge timed out."));
    }, request.bridge.timeoutMs);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify(bridgePromptPayload(request)));
    });

    socket.addEventListener("message", (event) => {
      clearTimeout(timeout);
      socket.close();
      const text = String(event.data || "");
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket agent bridge connection failed."));
    });
  });

  return {
    parsedData: parseBridgeResponse(raw, request.defaultComplexity),
    bridge: request.bridge
  };
}

async function callMcpBridge(request: AgentBridgeRequest): Promise<AgentBridgeResult> {
  if (!request.bridge.endpointUrl) {
    throw new Error("MCP-style agent bridge selected but no endpoint URL was configured.");
  }

  const response = await fetch(request.bridge.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(request.bridge.apiKey)
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `cognitive-pong-${Date.now()}`,
      method: "tools/call",
      params: {
        name: request.bridge.toolName || "cognitive_pong_turn",
        arguments: bridgePromptPayload(request)
      }
    }),
    signal: AbortSignal.timeout(request.bridge.timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP-style agent bridge returned [${response.status}]: ${errorText || response.statusText}`);
  }

  return {
    parsedData: parseBridgeResponse(await response.json(), request.defaultComplexity),
    bridge: request.bridge
  };
}

async function callCliBridge(request: AgentBridgeRequest): Promise<AgentBridgeResult> {
  if (!isLocalBridgeExecutionEnabled()) {
    throw new Error("Local CLI agent bridges are disabled. Set COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true to opt in.");
  }
  const bridge = assertAllowlistedCliBridge(request.bridge);
  if (!bridge.command) {
    throw new Error("CLI agent bridge selected but no server profile command was configured.");
  }

  const payload = JSON.stringify(bridgePromptPayload(request));
  const prompt = cliPromptText(request);
  const rawArgs = bridge.args || [];
  const argsUsePlaceholders = hasCliPlaceholder(rawArgs);
  const expandedArgs = rawArgs.map((arg) => expandCliArg(arg, request, payload, prompt));
  if (usesDangerFullAccess(expandedArgs) && !isDangerFullAccessEnabled()) {
    throw new Error("CLI bridge profile requests danger-full-access. Set COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS=true as a second explicit opt-in.");
  }
  const stdinPayload = argsUsePlaceholders
    ? ""
    : bridge.kind === "codex-cli"
      ? prompt
      : payload;
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(bridge.command!, expandedArgs, {
      cwd: bridge.cwd || process.cwd(),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("CLI agent bridge timed out."));
    }, request.bridge.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(safeCliErrorText(stderr.trim()) || `CLI agent bridge exited with code ${code}.`));
      }
    });
    if (stdinPayload) {
      child.stdin.write(stdinPayload);
    }
    child.stdin.end();
  });

  return {
    parsedData: parseBridgeResponse(output, request.defaultComplexity),
    bridge
  };
}

export async function generateWithAgentBridge(request: AgentBridgeRequest): Promise<AgentBridgeResult | null> {
  if (request.bridge.kind === "none") {
    return null;
  }

  switch (request.bridge.kind) {
    case "http":
      return callHttpBridge(request);
    case "websocket":
      return callWebSocketBridge(request);
    case "mcp":
      return callMcpBridge(request);
    case "cli":
    case "codex-cli":
      return callCliBridge(request);
    default:
      return null;
  }
}
