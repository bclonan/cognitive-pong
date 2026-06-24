# Cognitive Pong

Cognitive Pong is a local two-agent reasoning arena. Two configurable agents debate a goal while a Pong court visualizes whose turn it is, how strong each argument is, when a point is awarded, and how a consensus plan forms over time.

The project is designed to be understandable without cloud accounts. A fresh clone runs in mock mode, with no API keys, so you can inspect the full loop before connecting OpenAI-compatible endpoints, Ollama, Gemini, Anthropic-style APIs, Hugging Face endpoints, custom HTTP adapters, or external agent bridges.

## What It Is For

Use Cognitive Pong when you want to:

- compare two model, agent, or prompt strategies on the same objective;
- watch a debate evolve turn by turn instead of reading one opaque answer;
- pressure-test product specs, migration plans, research claims, recipes, engineering decisions, or red-team prompts;
- capture a durable research ledger with arguments, sources, judge events, replay data, and exportable JSONL bundles;
- plug in local or remote agent runtimes, including CLI tools, without rewriting the arena.

It is not a benchmark leaderboard claiming objective model truth. The scoring is a decision-support signal: it helps humans inspect reasoning quality, argument coverage, risk handling, and convergence.

## Platform Tour

The app has four main areas:

- **Arena**: configure Agent A and Agent B, choose providers/models, edit the main goal, start the Pong loop, step/pause/reset turns, and watch the live court.
- **Leaderboard**: inspect saved public matches and ratings from the local persistence store.
- **Matchmaking**: load opponent profiles and launch duels against saved or curated agents.
- **Guide**: read in-app explanations of the reasoning loop, Pong metaphor, controls, and operational tuning.

Supporting panels inside the Arena include debate logs, visual replay, consensus milestones, active research state, timeline dependency graph, spectator judge, radar analytics, neural trainer, provider configuration, exports, and raw Arena Loop diagnostics.

## Documentation Map

- [Platform guide](docs/platform-guide.md): user concepts, workflows, panels, exports, and common use cases.
- [Architecture](docs/architecture.md): frontend, server, data flow, API routes, persistence, provider boundaries, and runtime contracts.
- [Science and method](docs/science-and-method.md): why the debate/Pong metaphor exists, what the scoring means, and how to interpret results.
- [Extending Cognitive Pong](docs/extending.md): adding providers, bridges, UI panels, tests, exports, and docs.
- [Agent bridges](docs/agent-bridges.md): HTTP, WebSocket, MCP-style, local CLI, and Codex CLI bridge contracts.
- [Contributing](CONTRIBUTING.md): local development and pull request expectations.
- [Security](SECURITY.md): vulnerability reporting, secret handling, and bridge safety notes.

## Requirements

- Node.js 20 or later.
- npm, included with Node.
- Optional: Node.js 24 or later when using built-in SQLite persistence through `node:sqlite`.
- Optional: Ollama for local models.
- Optional: provider API keys for live hosted models.

The default mock mode does not require a GPU, database, API key, or background service.

## Quick Start: macOS

```bash
git clone https://github.com/bclonan/rally-os.git
cd rally-os
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

For Ollama on macOS:

```bash
ollama pull llama3.1
OLLAMA_ORIGINS="*" ollama serve
```

Then choose `Ollama local URL` for either agent and use `http://localhost:11434` as the instance URL.

## Quick Start: Windows

Use PowerShell:

```powershell
git clone https://github.com/bclonan/rally-os.git
cd rally-os
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`.

For Ollama on Windows PowerShell:

```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

In a second PowerShell window:

```powershell
ollama pull llama3.1
```

Then choose `Ollama local URL` in the app and set the instance URL to `http://localhost:11434`.

## Quick Start: Linux

```bash
git clone https://github.com/bclonan/rally-os.git
cd rally-os
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

For Ollama on Linux:

```bash
ollama pull llama3.1
OLLAMA_ORIGINS="*" ollama serve
```

If port `3000` is busy:

```bash
PORT=3056 npm run dev
```

On Windows PowerShell, use:

```powershell
$env:PORT="3056"
npm run dev
```

## Configuration Basics

Copy `.env.example` to `.env` and uncomment only what you need.

Safe default:

```bash
COGNITIVE_PONG_DEFAULT_PROVIDER=mock
COGNITIVE_PONG_DEFAULT_MODEL=mock-local
COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE=none
COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=false
```

Live provider examples:

```bash
# OpenAI-compatible or ChatGPT-compatible API
COGNITIVE_PONG_DEFAULT_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=...

# Ollama
COGNITIVE_PONG_DEFAULT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434

# Hugging Face endpoint
COGNITIVE_PONG_DEFAULT_PROVIDER=huggingface
HUGGINGFACE_ENDPOINT_URL=...
HUGGINGFACE_API_KEY=...
```

You can also configure providers per agent inside the UI. Per-agent settings override global defaults.

Local persistence examples:

```bash
# Default compatibility mode uses JSON files.
# SQLite mode uses one local database file for matches and Arena Loop battles.
COGNITIVE_PONG_MATCHES_STORE=./data/rally-os.sqlite
COGNITIVE_PONG_ARENA_STORE=./data/rally-os.sqlite
```

SQLite mode requires Node.js with `node:sqlite` support. The default JSON mode still works without a database.

## Provider Targets

Supported model provider adapters:

- `mock`: local synthetic debate loop, no network or key.
- `openai-compatible`: any `/v1/chat/completions` compatible endpoint.
- `ollama`: local Ollama through an OpenAI-compatible endpoint.
- `gemini`: optional Google Gemini adapter.
- `anthropic`: Anthropic-style Messages API.
- `huggingface`: Hugging Face Inference endpoint.
- `custom-http`: user-owned HTTP service that returns Cognitive Pong JSON or text.

If a live provider fails, the server returns a visible fallback reason and can keep the loop inspectable with mock output.

## Agent Bridges

Agent bridges delegate a turn to an external agent runtime before normal provider routing. Supported bridge kinds are:

- `none`
- `http`
- `websocket`
- `mcp`
- `cli`
- `codex-cli`

HTTP, WebSocket, and MCP-style bridges call user-owned services. CLI and Codex CLI bridges execute local commands and are disabled unless you explicitly set:

```bash
COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true
```

The browser only selects a server-side CLI profile. Commands, args, working directory, and dangerous sandbox options must be configured in `.env`, for example:

```bash
CODEX_CLI_COMMAND=codex
CODEX_CLI_ARGS=["exec", "{prompt}"]
COGNITIVE_PONG_CLI_PROFILES={"local_node":{"command":"node","args":["./local-agent.js"],"cwd":"C:/path/to/workspace"}}
```

If a profile uses `danger-full-access`, set `COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS=true` as a second explicit opt-in. Do not enable local command bridges in hosted or shared deployments. See [docs/agent-bridges.md](docs/agent-bridges.md).

## Data and Exports

Local data is intentionally simple:

- Published matches: `data/matches.json` by default, or a configured SQLite table in `COGNITIVE_PONG_MATCHES_STORE`
- Arena Loop battles: `data/arena-loop-battles.json` by default, or a configured SQLite table in `COGNITIVE_PONG_ARENA_STORE`
- Optional SQLite location: `data/rally-os.sqlite` when both store variables point at that file
- Custom saved agents: browser `localStorage`
- Session exports: downloaded transcript, Markdown, JSON, JSONL, or ZIP files
- Arena Loop research bundles: generated from persisted battle state

The default open-source setup does not require a database. SQLite mode keeps the same store modules and API routes, but writes rows to local tables instead of JSON files.

## Commands

```bash
npm run dev      # start Express + Vite development server
npm test         # run the Node test suite
npm run lint     # TypeScript noEmit check
npm run build    # production frontend and server bundle
npm run clean    # remove generated build output safely
npm start        # run the production server bundle after build
```

## Troubleshooting

**The app opens but live providers fail.**
Start with mock mode. Then confirm the selected agent provider, endpoint URL, model, and token. Provider-specific UI fields are per agent.

**Ollama works in a terminal but not in the browser.**
Start Ollama with `OLLAMA_ORIGINS="*"` so the local browser can call it through the configured endpoint.

**The dev server starts, but hot reload conflicts with another app.**
Set `COGNITIVE_PONG_HMR_PORT` or use `DISABLE_HMR=true` for scripted smoke runs.

**CLI bridges do not run.**
That is expected unless `COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true` is set and the selected profile is configured server-side. Keep it off unless you fully trust the profile.

**A CLI bridge returns JSON parse errors.**
First return plain text to prove transport works, then tighten stdout to one Cognitive Pong JSON object. The server can extract fenced JSON, but noisy logs before or after JSON may still degrade parsing.

**`uvicorn` is not recognized.**
This app does not use Uvicorn or a Python virtual environment. Use `npm run dev` for local development.

**The Pong loop keeps running in mock mode.**
That is intentional. Mock mode proves the UI, persistence, replay, scoring, and export paths without external model failures.

## Security Notes

- Keep API keys in `.env`, not in frontend code.
- Export helpers redact common secret fields.
- Treat all provider and bridge output as untrusted text.
- Local CLI bridges can execute commands, so keep them disabled by default.
- Browser-supplied shell commands are ignored for local CLI bridges; configure allowlisted profiles on the server.

See [SECURITY.md](SECURITY.md) for details.
