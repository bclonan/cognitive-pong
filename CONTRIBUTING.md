# Contributing

Thanks for helping improve Cognitive Pong. The project is intended to stay runnable in no-key local mode while supporting optional live model providers and agent bridges.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The default runtime uses the `mock` provider and does not require API keys.
If a local Vite websocket port is already occupied, set `COGNITIVE_PONG_HMR_PORT` in `.env` or run smoke tests with `DISABLE_HMR=true`.

## Verification

Run these before opening a pull request:

```bash
npm run lint
npm test
npm run build
npm run clean
```

## Engineering Guidelines

- Preserve the core product loop: two agents, Pong rally, transcript, scoring, consensus output, replay, trainer, leaderboard, matchmaking, and diagnostics.
- Keep Gemini, OpenAI-compatible APIs, Ollama, Anthropic-style APIs, Hugging Face endpoints, and custom HTTP providers behind adapter boundaries.
- Keep local CLI and Codex CLI bridges optional and gated. Do not enable local command execution by default.
- Prefer typed configuration and small adapter modules over branching logic in the UI or route handlers.
- Do not commit local `.env` files or generated `data/matches.json`.

## Pull Request Checklist

- Explain the user-facing behavior changed.
- Note provider or bridge compatibility impacts.
- Include tests for adapter, bridge, parsing, persistence, or UI behavior when applicable.
- Confirm `npm run lint`, `npm test`, and `npm run build`.
