# Agent Bridges

Agent bridges let Cognitive Pong delegate a turn to an external agent runtime before falling back to normal provider routing. They are optional. The app runs fully with `none` or `mock`.

Use a bridge when the agent is not just a model endpoint. Examples:

- a local coding agent;
- a tool-using research process;
- a script that reads project files;
- an MCP-style service;
- a WebSocket process that keeps memory;
- a Codex CLI command that can use its own configured tools.

## Supported Bridge Kinds

- `none`: default. No bridge is used.
- `http`: POST a turn payload to a user-owned HTTP service.
- `websocket`: send one turn payload over a WebSocket and read one response.
- `mcp`: POST a JSON-RPC `tools/call` request to an MCP-style HTTP endpoint.
- `cli`: run a server-side allowlisted local command profile with Cognitive Pong JSON on stdin unless argument placeholders are configured.
- `codex-cli`: a server-side Codex command profile. Common command: `codex` with args such as `["exec", "{prompt}"]`.

## Safety Model

HTTP, WebSocket, and MCP-style bridges call external services but do not execute local commands.

CLI and Codex CLI bridges execute local commands. They are disabled unless this environment variable is set:

```bash
COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true
```

Do not enable local command bridges in hosted, shared, or untrusted deployments. Keep them disabled unless you fully trust the profile. Treat bridge responses as untrusted text. The server parses bridge output into a debate turn; it does not execute returned content.

The browser cannot provide shell commands or args for local CLI bridges. It can only select a profile id. Commands, args, cwd, timeouts, and sandbox-sensitive flags must live in server-side environment configuration.

## Environment Variables

```bash
COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE=none
COGNITIVE_PONG_AGENT_BRIDGE_URL=http://localhost:8787/cognitive-pong/turn
COGNITIVE_PONG_AGENT_BRIDGE_API_KEY=
COGNITIVE_PONG_AGENT_BRIDGE_TOOL=cognitive_pong_turn
COGNITIVE_PONG_AGENT_BRIDGE_TIMEOUT_MS=15000

# Local command bridges only:
COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=false
COGNITIVE_PONG_CLI_PROFILES={"local_node":{"command":"node","args":["./local-agent.js"],"cwd":"C:/path/to/workspace","timeoutMs":15000}}
COGNITIVE_PONG_AGENT_BRIDGE_COMMAND=node
COGNITIVE_PONG_AGENT_BRIDGE_ARGS=["./local-agent.js"]
COGNITIVE_PONG_AGENT_BRIDGE_CWD=C:/path/to/workspace
COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS=false

# Codex CLI preset:
CODEX_CLI_COMMAND=codex
CODEX_CLI_ARGS=["exec", "{prompt}"]
CODEX_CLI_CWD=C:/path/to/workspace
```

Per-agent bridge settings in the UI can select bridge kind, endpoint fields for HTTP/WebSocket/MCP, and local CLI profile id. They do not override local CLI command or argument allowlists.

## HTTP Bridge Contract

HTTP bridges receive a `POST` payload:

```json
{
  "topic": "Current arena objective",
  "history": [],
  "currentAgent": "agentA",
  "agent": { "name": "Agent A" },
  "system": "Server-generated system instruction",
  "prompt": "Conversation prompt",
  "responseFormat": "cognitive-pong-json"
}
```

They may return strict Cognitive Pong JSON:

```json
{
  "content": "The next argument or critique.",
  "type": "critique",
  "proposal": "",
  "convictionScore": 64,
  "complexity": "deep research"
}
```

Optional fields:

```json
{
  "judgeEvaluation": {
    "intellectScore": 80,
    "precisionScore": 76,
    "rhetoricScore": 72,
    "isScoreGoal": false,
    "verdictComment": "Strong critique, but not a decisive point.",
    "pivotingDirective": "Ask the other side to address rollback safety."
  },
  "spectatorLiveReactions": [
    {
      "spectatorName": "Security Reviewer",
      "avatar": "SEC",
      "comment": "The edge-case coverage matters here."
    }
  ]
}
```

Plain text is also accepted. The server wraps it into a valid turn.

## WebSocket Bridge Contract

The WebSocket bridge:

1. opens the configured URL;
2. sends the same payload as the HTTP bridge;
3. reads the first message;
4. closes the socket;
5. parses the message as JSON or text.

Use this for agent runtimes that keep their own memory or tool sessions.

## MCP-Style Bridge Contract

The `mcp` bridge sends JSON-RPC:

```json
{
  "jsonrpc": "2.0",
  "id": "cognitive-pong-...",
  "method": "tools/call",
  "params": {
    "name": "cognitive_pong_turn",
    "arguments": {
      "topic": "Current arena objective",
      "history": [],
      "currentAgent": "agentA",
      "agent": { "name": "Agent A" },
      "system": "Server-generated system instruction",
      "prompt": "Conversation prompt",
      "responseFormat": "cognitive-pong-json"
    }
  }
}
```

Set `COGNITIVE_PONG_AGENT_BRIDGE_TOOL` or the per-agent tool field to change the tool name.

## CLI Bridge Contract

Generic CLI bridges behave in two modes, based on the server-side profile args:

1. **stdin mode**
   - If no argument placeholder is present, the bridge command receives Cognitive Pong JSON on stdin.

2. **placeholder mode**
   - If any arg contains a placeholder, the server expands it.

Supported placeholders:

- `{payload}`: compact bridge payload JSON
- `{prompt}`: full tool-ready prompt
- `{system}`: system instruction
- `{conversation}`: conversation prompt
- `{topic}`: current objective
- `{agent}`: `agentA` or `agentB`
- `{history_json}`: transcript history JSON

Example:

```bash
COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE=cli
COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true
COGNITIVE_PONG_AGENT_BRIDGE_COMMAND=node
COGNITIVE_PONG_AGENT_BRIDGE_ARGS=["./local-agent.js"]
```

Named profile example:

```bash
COGNITIVE_PONG_CLI_PROFILES={"research_agent":{"command":"node","args":["./agents/research-agent.js"],"cwd":"C:/work/cognitive-pong","timeoutMs":30000}}
```

Then select bridge kind `cli` and profile id `research_agent` for the agent. Unknown profile ids are rejected.

If a profile includes `danger-full-access`, the server rejects it unless `COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS=true` is also set.

## Codex CLI Bridge

The Codex CLI bridge is a preset for local command execution:

```bash
COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE=codex-cli
COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true
CODEX_CLI_COMMAND=codex
CODEX_CLI_ARGS=["exec", "{prompt}"]
```

The prompt tells the CLI to return one Cognitive Pong JSON object. The CLI may use whatever tools its local configuration allows, but stdout must end as parseable JSON or plain text.

The default Codex profile id is `codex`. To customize it, set `CODEX_CLI_COMMAND`, `CODEX_CLI_ARGS`, and optionally `CODEX_CLI_CWD` on the server.

## Minimal HTTP Bridge Example

```js
import express from "express";

const app = express();
app.use(express.json());

app.post("/cognitive-pong/turn", async (req, res) => {
  const { topic, currentAgent } = req.body;
  res.json({
    content: `${currentAgent} argues a bounded next step for ${topic}.`,
    type: currentAgent === "agentA" ? "proposal" : "critique",
    proposal: currentAgent === "agentA" ? "Ship a small reversible experiment." : "",
    convictionScore: 72,
    complexity: "quick lookup"
  });
});

app.listen(8787, () => {
  console.log("Bridge listening on http://localhost:8787/cognitive-pong/turn");
});
```

Then configure either agent with:

```bash
COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE=http
COGNITIVE_PONG_AGENT_BRIDGE_URL=http://localhost:8787/cognitive-pong/turn
```

## Debugging Bridges

- Check `GET /api/bridge/manifest`.
- Confirm the selected agent actually has the bridge kind configured.
- For local CLI, confirm `COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true`.
- Confirm the selected CLI profile exists in `COGNITIVE_PONG_CLI_PROFILES`, `COGNITIVE_PONG_AGENT_BRIDGE_COMMAND`, or the Codex preset variables.
- Raise `COGNITIVE_PONG_AGENT_BRIDGE_TIMEOUT_MS` for slow tools.
- Return plain text first, then tighten to JSON once the transport works.
- If JSON parsing fails, remove progress logs from stdout or print the final Cognitive Pong JSON object last.
