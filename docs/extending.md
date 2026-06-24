# Extending Cognitive Pong

This guide explains where to add new behavior without tangling the platform.

## Extension Rules

Prefer the existing boundaries:

- Provider API behavior: `server/providers.ts`
- External agent runtimes: `server/agentBridges.ts`
- Arena Loop persistence: `server/arenaLoopStore.ts`
- Arena Loop routes: `server/arenaLoopRoutes.ts`
- Search adapters: `server/arenaSearchProviders.ts`
- Published match summaries: `server/matchStore.ts`
- Local SQLite persistence adapter: `server/sqliteStore.ts`
- Cross-layer types: `src/types.ts`
- Provider UI helpers: `src/utils/providerControls.ts`
- Bridge UI helpers: `src/utils/agentBridgeControls.ts`
- Main session orchestration: `src/App.tsx`
- Main UI shell: `src/components/CognitivePongExperience.tsx`

## Add a Provider

1. Add the provider kind to `ProviderKind` in `src/types.ts` and `server/providers.ts`.
2. Add labels, presets, endpoint placeholders, and token behavior in `src/utils/providerControls.ts`.
3. Resolve endpoint, model, API key, temperature, and max tokens in `resolveProviderConfig`.
4. Implement the API call in `server/providers.ts`.
5. Normalize output through `parseProviderText`.
6. Add tests in `tests/providers.test.ts` and UI static coverage if controls change.
7. Update `.env.example`, README, and this doc.

Provider output should support strict JSON and degrade gracefully when text is returned.

## Add an Agent Bridge

1. Add the kind to `AgentBridgeKind` in `src/types.ts`, `server/agentBridges.ts`, and `src/utils/agentBridgeControls.ts`.
2. Add UI labels and defaults.
3. Resolve environment variables in `resolveAgentBridgeConfig`.
4. Implement the transport in `server/agentBridges.ts`.
5. Return `AgentBridgeResult` with parsed Cognitive Pong data.
6. Add tests in `tests/agentBridges.test.ts`.
7. Update `docs/agent-bridges.md`.

Do not bypass the local execution safety gate for command-running bridges.
For local CLI bridges, keep command, args, cwd, and sandbox behavior in server-side allowlisted profiles. The browser should only select a profile id.

## Add or Change Persistence

The store APIs support JSON files and optional local SQLite paths.

1. Keep match-summary behavior in `server/matchStore.ts`.
2. Keep durable battle behavior in `server/arenaLoopStore.ts`.
3. Put shared SQLite mechanics in `server/sqliteStore.ts`.
4. Preserve JSON compatibility unless a migration explicitly requires otherwise.
5. Add tests in `tests/sqlitePersistence.test.ts`, `tests/matchStore.test.ts`, or `tests/arenaLoopStore.test.ts`.

## Add a Search Provider

1. Add the provider to `ArenaSearchProvider` in `src/types.ts`.
2. Add config handling in `server/arenaSearchProviders.ts`.
3. Map results into `ArenaSource`.
4. Respect `maxSourcesPerTurn`, `maxSourceExcerptLength`, and timeout.
5. Add tests in `tests/arenaSearchProviders.test.ts`.
6. Update `.env.example` and architecture docs.

Search adapters should return stable, bounded source records.

## Add a UI Panel

1. Create the component under `src/components`.
2. Keep ownership clear:
   - local view state in the component;
   - shared session state in `src/App.tsx`;
   - durable state on the server.
3. Use stable IDs for controls that need testing.
4. Avoid duplicate control surfaces unless they solve a real workflow problem.
5. Keep text readable and responsive.
6. Add source-shape or behavior tests in `tests/arenaUiCleanup.test.ts` when relevant.
7. Add the feature to the canonical tracker if it changes user-facing behavior.

## Add an Export

1. Decide whether the export is frontend-only or persisted Arena Loop data.
2. Redact secrets with `src/utils/exportRedaction.ts`.
3. Use structured builders in `src/utils/sessionExports.ts` or `server/arenaLoopStore.ts`.
4. Add tests for output shape and redaction.
5. Add UI disabled states when source data is missing.

## Add Arena Loop Data

If the data should survive page refresh or power a research export, store it in Arena Loop persistence.

1. Add or extend the type in `src/types.ts`.
2. Normalize and validate in `server/arenaLoopStore.ts`.
3. Expose through `server/arenaLoopRoutes.ts` only if the frontend or exports need it.
4. Update replay/export builders.
5. Add tests in `tests/arenaLoopStore.test.ts`.

## Add a Saved Match Field

Published match summaries live in `server/matchStore.ts`.

1. Clean and clamp user-provided data.
2. Avoid storing secrets.
3. Preserve private/public visibility behavior.
4. Add tests in `tests/matchStore.test.ts`.

## Add Trainer Behavior

The trainer is local and experimental.

1. Keep model math in `src/utils/nn.ts`.
2. Keep UI in `src/components/NetworkTrainer.tsx`.
3. Make exports deterministic enough to test.
4. Add tests for any new utility behavior.

## Testing Expectations

Run:

```bash
npm test
npm run lint
npm run build
npm run clean
```

For UI changes, also add targeted tests where possible:

- `tests/arenaUiCleanup.test.ts` for source-level UI contracts;
- `tests/uiClassNames.test.ts` for class validity and dead-code checks;
- browser smoke when a change depends on rendered layout.

## Documentation Expectations

Update docs when you change:

- providers;
- bridge contracts;
- environment variables;
- export formats;
- persistence shape;
- user-visible panels;
- safety behavior;
- setup commands.

At minimum, check:

- `README.md`
- `docs/architecture.md`
- `docs/platform-guide.md`
- `docs/agent-bridges.md`
- `.env.example`

## Common Pitfalls

- Adding a provider but forgetting per-agent UI defaults.
- Adding local command execution without the safety gate.
- Storing provider tokens in frontend exports.
- Creating a second control surface that does not sync with the first.
- Treating judge scores as objective truth.
- Letting a range-only control become untestable or inaccessible.
- Adding text smaller than 10px in dense panels.
- Forgetting that mock mode must keep working without API keys.
