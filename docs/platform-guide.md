# Platform Guide

This guide explains Cognitive Pong from the user's point of view.

## Core Idea

You give two agents a main goal. Each agent has a provider, model, personality, strategy, and tuning profile. The Pong court advances the conversation: a paddle hit triggers a turn, the ball visualizes momentum, and judge scoring determines whether a proposal becomes a point or a consensus milestone.

The arena is useful because it separates:

- the goal being debated;
- the agents and models doing the reasoning;
- the transcript of claims and critiques;
- the evidence and sources;
- the judge scoring;
- the final consensus artifacts.

## Basic Workflow

1. Open the Arena tab.
2. Set the **Main Goal**.
3. Choose Agent A and Agent B provider/model settings.
4. Optionally adjust drive, strategy, empathy, aggressiveness, risk, and custom instructions.
5. Start the Arena Loop.
6. Watch the Pong court and transcript.
7. Pause, step, retarget the main goal, or reset as needed.
8. Export the transcript, consensus plan, replay, JSONL, or research ZIP.
9. Publish a match locally if you want it to appear in the leaderboard.

## Main Goal and Victory Condition

The Main Goal is the master objective. It is sent to providers, bridges, Arena Loop persistence, exports, and the visible command header.

The Victory Condition tells the judge what counts as a good finish.

During a live run you can edit both fields in the live match card. The app shows whether the persisted Arena Loop battle is synced. Use **Apply Goal** to immediately retarget the active battle.

## Agent Configuration

Each agent can have independent settings:

- provider;
- model preset;
- custom model;
- endpoint URL;
- API key or token;
- temperature;
- max tokens;
- competitive drive;
- strategy profile;
- aggressiveness;
- empathy;
- psychology archetype;
- risk tolerance;
- collaboration bias;
- custom system prompt;
- optional bridge settings.

Agent A and Agent B can use different providers. For example, Agent A can use local Ollama while Agent B uses an OpenAI-compatible endpoint.

## Custom Agents

The custom agent library stores reusable agent templates in browser local storage. A template preserves identity, prompt, model/provider runtime values, tuning values, and bridge settings.

Use it when you want recurring competitors such as:

- skeptical reviewer;
- product strategist;
- safety critic;
- local CLI agent;
- high-drive red team;
- cooperative synthesizer.

## Runtime Modes

### Mock Mode

Mock mode requires no API key. It produces deterministic local turns for common scenario types and generic synthetic turns for arbitrary goals.

Use mock mode to test the UI, loop, exports, persistence, and replay before connecting live models.

### Live Provider Mode

Live provider mode calls the selected model provider. The provider response is normalized into a Cognitive Pong turn.

If a provider fails, the UI shows the fallback reason so you can diagnose endpoint, token, model, or CORS issues.

### Agent Bridge Mode

Bridge mode lets an external agent runtime produce the turn. Bridges can use HTTP, WebSocket, MCP-style HTTP, local CLI, or Codex CLI.

Use bridge mode for tool-using agents, coding agents, local scripts, or orchestration services.

## Arena Loop Persistence

The live UI transcript is the immediate React state. Arena Loop persistence is the durable ledger for a battle.

It stores:

- master goal;
- rubric;
- agent profiles;
- turn records;
- structured argument points;
- sources;
- judge events;
- replay reconstruction data;
- export rows.

This is what powers JSONL export, research ZIP export, replay links, and raw diagnostics.

## Panels and What They Mean

### Pong Debate Arena

The court is the live center of the app. It shows turn direction, scoring state, active agent, current volley, and match momentum.

### Debate Logs

The logs show each claim, critique, rebuttal, agreement, source, conviction score, and replay control.

### Consensus Board

The consensus board shows finalized milestones. A milestone is created when the judge awards a scoring strike to a proposal.

### Spectator Judge

The judge panel shows scoring dimensions, verdict comments, pivot directives, and spectator reactions. These are decision aids, not objective truth.

### Active Research State

This panel visualizes the current reasoning object: active claim, research memory, complexity, and attractor-style hints.

### Timeline Dependency Graph

The timeline graph shows how turns relate to claims, dependencies, and consensus plans.

### Visual Replay

Replay reconstructs the debate sequence as a court animation. It can load from local history or a persisted Arena Loop replay.

### Radar Analytics

Radar analytics compare agent profiles and matchup patterns.

### Neural Trainer

The trainer builds a small local neural-network training dataset from seed examples and live turns. It can export weights, data, and a portable evaluator.

This is an experimental local learning surface, not a production model training pipeline.

### Leaderboard

The leaderboard is derived from locally saved public matches. By default those summaries use local JSON files. Operators can point `COGNITIVE_PONG_MATCHES_STORE` and `COGNITIVE_PONG_ARENA_STORE` at one `.sqlite` file to keep matches and Arena Loop battles in local SQLite tables.

### Matchmaking

Matchmaking lets you choose an opponent profile, configure your challenger, set a duel objective, and launch the match into the Arena.

## Exports

Common export types:

- Transcript text: readable turn-by-turn record.
- Markdown report: shareable summary.
- Session JSON: structured local session artifact.
- Consensus plan: finalized milestones.
- Arena JSONL bundle: research-grade rows for turns, events, sources, SFT, weighted SFT, and preference data.
- Research ZIP: JSONL bundle plus manifest in one archive.
- Trainer exports: weights, dataset JSONL, portable evaluator.

Secrets are redacted from session exports.

## Use Cases

### Engineering Design Review

Set the goal to a migration, architecture, or incident-response plan. Put a builder agent against a skeptic agent. Use the consensus board as the action-plan output.

### Product Strategy

Put a growth strategist against a customer advocate. Tune empathy and collaboration higher when you want synthesis, or competitive drive higher when you want sharper tradeoffs.

### Research Triage

Use research-enabled Arena Loop settings with bounded sources. Export JSONL or ZIP for review.

### Prompt and Agent Evaluation

Use the same goal with different agents, models, or bridge runtimes. Compare transcripts, scoring, and consensus quality.

### Local Tool Agent Testing

Use CLI or Codex CLI bridges to let a local agent generate turns. Keep local command bridges disabled unless you trust the profile. Browser controls select a server-side profile id; command, args, cwd, and dangerous sandbox flags stay in environment-managed allowlists.

## Interpreting Results

Good results have:

- explicit claims;
- concrete objections;
- bounded evidence;
- acknowledged risk;
- actionable synthesis;
- traceable consensus milestones.

Weak results often have:

- vague agreement;
- unsupported certainty;
- no counterexample;
- no measurable next step;
- scoring without a proposal.

The system helps you see those differences quickly.
