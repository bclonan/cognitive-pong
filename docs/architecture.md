# Cognitive Pong Architecture

This document explains how the platform is assembled and where to extend it. It describes the current local-first architecture in this repository.

## System Overview

Cognitive Pong has three cooperating layers:

1. **React arena frontend**
   - Owns interaction state, visible controls, Pong rendering, replay, logs, consensus panels, agent library, exports, trainer UI, and diagnostics.
   - Main entry points: `src/main.tsx`, `src/App.tsx`, `src/components/CognitivePongExperience.tsx`.

2. **Express orchestration server**
   - Owns API routes, provider calls, agent bridge calls, match persistence, Arena Loop persistence, and static serving.
   - Main entry point: `server.ts`.

3. **Runtime adapters and stores**
   - Providers: `server/providers.ts`
   - Agent bridges: `server/agentBridges.ts`
   - Arena Loop store and exports: `server/arenaLoopStore.ts`
   - Arena Loop routes: `server/arenaLoopRoutes.ts`
   - Search providers: `server/arenaSearchProviders.ts`
   - Match store and leaderboard: `server/matchStore.ts`
   - Optional SQLite adapter: `server/sqliteStore.ts`
   - ZIP exports: `server/zipBundle.ts`

The default deployment is local and file-backed. No external database is required. Local SQLite persistence is available by pointing `COGNITIVE_PONG_MATCHES_STORE` and `COGNITIVE_PONG_ARENA_STORE` at a `.sqlite`, `.sqlite3`, or `.db` file.

## Frontend Structure

The frontend is a Vite + React application.

Important files:

- `src/App.tsx`: top-level session state, status machine, provider request flow, Arena Loop sync, scoring, demo mode, publishing, and tab state.
- `src/components/CognitivePongExperience.tsx`: main UI shell, navigation, agent cards, live arena, controls, exports, replay modal, diagnostics, and custom agent library.
- `src/components/PongGame.tsx`: canvas/SVG Pong court, HUD, collision callbacks, heatmap, scoring animation, and court containment.
- `src/components/DebateLogs.tsx`: transcript, inline replay controls, source display, and turn metadata.
- `src/components/ConsensusBoard.tsx`: finalized milestones, agreement metrics, export controls, and plan output.
- `src/components/ActiveResearchState.tsx`: current research-state visualization and cognitive trace hints.
- `src/components/TimelineDependencyGraph.tsx`: dependency graph for claims, turns, and consensus.
- `src/components/SpectatorJudgePanel.tsx`: judge state, verdicts, scoring, and intervention reset.
- `src/components/RadarProfileChart.tsx`: profile analytics and matchup views.
- `src/components/NetworkTrainer.tsx`: local neural trainer UI and exportable training artifacts.
- `src/components/LeaderboardAndMatches.tsx`: local leaderboard and public match logs.
- `src/components/MatchmakingCompetition.tsx`: opponent loading, challenger setup, and duel launch.
- `src/components/ConfigPanel.tsx`: advanced provider, bridge, arena, and moderator configuration.
- `src/components/AboutScienceManual.tsx`: in-app guide and tuning manual.

Shared utility files:

- `src/types.ts`: cross-layer data shapes.
- `src/utils/providerControls.ts`: provider/model UI defaults and selectors.
- `src/utils/agentBridgeControls.ts`: bridge UI defaults and placeholders.
- `src/utils/customAgents.ts`: saved custom agent templates.
- `src/utils/arenaLoop.ts`: Arena Loop limits, JSONL bundle helpers, local scoring, and source utilities.
- `src/utils/arenaSettings.ts`: advanced arena settings and prompt instructions.
- `src/utils/exportRedaction.ts`: secret redaction for session exports.
- `src/utils/sessionExports.ts`: transcript, Markdown, and session artifact builders.
- `src/utils/replayColors.ts`: SVG-safe color mapping for replay.
- `src/utils/turnDisplay.ts`: agent/moderator display helpers.
- `src/utils/judgeDisplay.ts`: latest judge state selection.
- `src/utils/nn.ts`: simple neural-network trainer.

## Server Routes

Defined in `server.ts`:

- `GET /api/bridge/manifest`
  - Describes supported bridge kinds and whether local command execution is enabled.

- `POST /api/debate/next`
  - Generates the next debate turn for Agent A or Agent B.
  - Resolves bridge and provider config.
  - Builds agent profile and arena instructions.
  - Falls back to local synthetic output when a provider is unavailable.

- `GET /api/match/list`
  - Reads saved matches.
  - Hides private matches unless `includePrivate=true`.

- `POST /api/match/save`
  - Validates and stores a match in the configured local match store.

- `GET /api/leaderboard`
  - Aggregates public saved matches into leaderboard rows.

Mounted under `/api/arena-loop` from `server/arenaLoopRoutes.ts`:

- `GET /battle`
- `POST /battle`
- `GET /battle/:id`
- `PATCH /battle/:id`
- `POST /battle/:id/turn`
- `POST /battle/:id/turn/debate`
- `GET /battle/:id/export/jsonl`
- `GET /battle/:id/export/research-bundle.zip`
- `GET /battle/:id/replay`

## Turn Generation Flow

1. The Pong court collision or `Step Volley` selects `agentA` or `agentB`.
2. The frontend trims the current main goal and posts to `/api/debate/next`.
3. If a persisted Arena Loop battle is active, the frontend syncs `master_goal` and `rubric` before the next generated turn.
4. The server builds:
   - active agent profile instructions from `server/agentProfile.ts`;
   - custom persona instructions, if configured;
   - arena/rubric instructions from `src/utils/arenaSettings.ts`;
   - conversation context from the current transcript.
5. The server resolves an agent bridge from `server/agentBridges.ts`.
6. If a bridge is configured, it tries the bridge first.
7. Otherwise the server resolves a provider from `server/providers.ts`.
8. Provider or bridge text is parsed into Cognitive Pong response fields.
9. If parsing is sparse, the server enriches the turn with judge and spectator metadata.
10. The frontend appends the turn, updates scoring state, writes to the Arena Loop ledger when active, and returns the Pong court to the next rally state.

## Provider Boundary

Provider adapters are intentionally isolated in `server/providers.ts`.

They resolve:

- provider kind;
- endpoint URL;
- API key;
- model;
- temperature;
- max tokens;
- request timeout.

Supported providers:

- `mock`
- `openai-compatible`
- `ollama`
- `gemini`
- `anthropic`
- `huggingface`
- `custom-http`

Provider output can be strict JSON, JSON fenced in Markdown, or plain text. `parseProviderText` normalizes it to the turn shape expected by the frontend.

## Agent Bridge Boundary

Agent bridges live in `server/agentBridges.ts`.

Supported bridge kinds:

- `none`
- `http`
- `websocket`
- `mcp`
- `cli`
- `codex-cli`

The bridge receives the same high-level Cognitive Pong prompt context as a provider. This lets external tools, local scripts, coding agents, or MCP-style services participate without changing the core game loop.

Local command execution is guarded by:

```bash
COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true
```

For `cli` and `codex-cli`, command, args, cwd, and sandbox-sensitive options are resolved from server-side profiles in environment variables. The browser can select a profile id but cannot supply an arbitrary shell command.

Keep it disabled for hosted, shared, or untrusted environments.

## Arena Loop Persistence

Arena Loop state is more structured than the live React transcript. It stores:

- battle identity and slug;
- master goal and rubric;
- agent profiles;
- config limits and research settings;
- turns;
- arguments and structured points;
- sources;
- judge events;
- loop memory;
- replay reconstruction data;
- export rows.

Core module: `server/arenaLoopStore.ts`.

The frontend creates one persisted battle when a run starts. Live turns are appended through `/turn/debate`. Standalone Arena Loop turns can also be generated server-side through `/turn`.

By default, Arena Loop battles are stored in `data/arena-loop-battles.json`. When `COGNITIVE_PONG_ARENA_STORE` points at a SQLite file, the same battle payloads are stored in the `arena_battles` table with indexed id, slug, status, visibility, and update metadata.

## Search and Research Sources

`server/arenaSearchProviders.ts` supports:

- mock search;
- SearXNG;
- Brave Search;
- Tavily.

Search is bounded by Arena Loop limits:

- max queries per turn;
- max sources per turn;
- max source excerpt length;
- timeout;
- selected provider.

When research is disabled or limits are zero, search exits early.

## Match Persistence and Leaderboard

`server/matchStore.ts` stores public/private match summaries in `data/matches.json` by default. When `COGNITIVE_PONG_MATCHES_STORE` points at a SQLite file, match summaries are stored in the `matches` table with indexed public visibility and sort metadata.

The leaderboard is derived from public matches. Private matches are hidden from normal listing unless a local operator explicitly asks for them with `includePrivate=true`.

`server/sqliteStore.ts` is intentionally small: it uses Node's built-in `node:sqlite` runtime, creates the required local tables, stores JSON payloads, and preserves the existing store APIs. SQLite mode requires a Node runtime that includes `node:sqlite`; JSON mode remains the compatibility fallback.

## Exports

Export surfaces include:

- transcript text;
- Markdown report;
- session JSON;
- consensus plan JSON/text;
- Arena Loop JSONL bundle;
- Arena Loop research ZIP bundle;
- replay link;
- neural trainer weights/data/model exports.

Secret redaction lives in `src/utils/exportRedaction.ts`.

## State Ownership

Use this rule when extending the system:

- UI-only state belongs in React components.
- Cross-panel session state belongs in `src/App.tsx`.
- Durable battle state belongs in `server/arenaLoopStore.ts`.
- Published match summaries belong in `server/matchStore.ts`.
- Provider-specific logic belongs in `server/providers.ts`.
- External agent runtime logic belongs in `server/agentBridges.ts`.
- Shared data contracts belong in `src/types.ts`.

## Development Gates

The core verification commands are:

```bash
npm test
npm run lint
npm run build
npm run clean
```

The tests include provider contracts, bridge contracts, Arena Loop persistence, match storage, export redaction, replay colors, UI source-shape checks, dead-code checks, and environment/port parsing.
