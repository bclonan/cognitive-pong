import assert from "node:assert/strict";
import test from "node:test";
import { AgentConfig, DebateTurn } from "../src/types";
import {
  argumentAddress,
  buildArenaJsonlBundle,
  buildMockSearchResults,
  buildStructuredPointFromTurn,
  filterValidSourceIds,
  localDeterministicJudgeAdapter,
  normalizeArenaLoopLimits,
  normalizeArenaLoopRuntimeSettings,
  resolveArenaJudgeAdapter,
  scoreTurnLocally,
} from "../src/utils/arenaLoop";
import { SessionExportInput } from "../src/utils/sessionExports";

const agentConfig: AgentConfig = {
  agentA: {
    name: "Agent A",
    role: "Propose",
    color: "emerald",
    avatar: "A",
    provider: "mock",
    personality: "precise",
    psychologyArchetype: "operator",
    competitiveDrive: 70,
  },
  agentB: {
    name: "Agent B",
    role: "Critique",
    color: "amber",
    avatar: "B",
    provider: "mock",
    personality: "skeptical",
    psychologyArchetype: "skeptic",
    competitiveDrive: 80,
  },
  useGrounding: false,
  baseSpeed: 3,
  model: "mock-local",
};

const history: DebateTurn[] = [
  {
    id: "turn-a",
    sender: "agentA",
    content: "Use a bounded research loop with deterministic export rows.",
    type: "proposal",
    proposal: "Bounded research loop",
    convictionScore: 82,
    timestamp: "10:00:00 AM",
    complexity: "deep research",
    searchSources: [{ title: "Mock source", uri: "mock://arena-loop/source" }],
  },
  {
    id: "turn-b",
    sender: "agentB",
    content: "Challenge invalid source ids and unbounded crawling.",
    type: "critique",
    convictionScore: 74,
    timestamp: "10:01:00 AM",
    complexity: "deep research",
  },
];

function input(): SessionExportInput {
  return {
    sessionId: "battle-test",
    topic: "Test arena loop infrastructure",
    loopMode: "Debate",
    status: "paused",
    statusLabel: "Paused",
    victoryCondition: "Reach a bounded design.",
    maxVolleys: 4,
    agentConfig,
    gameSpeed: 2,
    scoreA: 1,
    scoreB: 0,
    history,
    finalizedTasks: [],
    averageJudgeScore: 80,
    currentComplexity: "deep research",
    activeTrajectory: null,
    isSimulationMode: true,
    fallbackReason: "mock",
    deployedModel: false,
    density: "comfortable",
  };
}

test("argumentAddress generates stable round-side-point ids", () => {
  assert.equal(argumentAddress(1, "agentA", 1), "R01-A-P01");
  assert.equal(argumentAddress(12, "agentB", 3), "R12-B-P03");
  assert.equal(argumentAddress(2, "moderator", 1), "R02-M-P01");
});

test("normalizeArenaLoopLimits clamps bounded loop controls", () => {
  assert.deepEqual(normalizeArenaLoopLimits({
    maxLoopPasses: 99,
    maxCandidatesPerPass: 0,
    maxQueriesPerTurn: -3,
    maxSourcesPerTurn: 99,
    maxSourceExcerptLength: 20,
    maxMemoryCharacters: 99999,
  }), {
    maxLoopPasses: 25,
    maxCandidatesPerPass: 1,
    maxQueriesPerTurn: 0,
    maxSourcesPerTurn: 10,
    maxSourceExcerptLength: 80,
    maxMemoryCharacters: 8000,
  });
});

test("normalizeArenaLoopRuntimeSettings clamps search provider and timeout controls", () => {
  const settings = normalizeArenaLoopRuntimeSettings({
    maxLoopPasses: 99,
    maxCandidatesPerPass: 9,
    maxQueriesPerTurn: 99,
    maxSourcesPerTurn: 99,
    maxSourceExcerptLength: 5000,
    maxMemoryCharacters: 1,
    searchProvider: "brave",
    searchEndpointUrl: "  https://search.local/query  ",
    searchTimeoutMs: 999999,
    judgingMode: "local-deterministic",
  });

  assert.equal(settings.maxLoopPasses, 25);
  assert.equal(settings.maxCandidatesPerPass, 5);
  assert.equal(settings.maxQueriesPerTurn, 5);
  assert.equal(settings.maxSourcesPerTurn, 10);
  assert.equal(settings.maxSourceExcerptLength, 1200);
  assert.equal(settings.maxMemoryCharacters, 300);
  assert.equal(settings.searchProvider, "brave");
  assert.equal(settings.searchEndpointUrl, "https://search.local/query");
  assert.equal(settings.searchTimeoutMs, 30000);
  assert.equal(settings.judgingMode, "local-deterministic");
});

test("mock search is deterministic and bounded", () => {
  const results = buildMockSearchResults("bounded debate", { maxSourcesPerTurn: 2 }, "2026-06-23T00:00:00.000Z");

  assert.equal(results.length, 2);
  assert.equal(results[0].id, "S01");
  assert.equal(results[0].provider, "mock");
  assert.equal(results[0].url, "mock://arena-loop/bounded%20debate/1");
});

test("invalid source ids are filtered from structured points", () => {
  const validSources = buildMockSearchResults("bounded debate", { maxSourcesPerTurn: 1 });
  const point = buildStructuredPointFromTurn({
    ...history[0],
    searchSources: [
      { title: "Valid", uri: validSources[0].url },
      { title: "Invalid", uri: "mock://missing" },
    ],
  }, 1, validSources);

  assert.deepEqual(point.source_ids, ["S01"]);
  assert.deepEqual(filterValidSourceIds(["S01", "S01", "S99"], validSources), ["S01"]);
});

test("local judge returns bounded research signals", () => {
  const score = scoreTurnLocally(history[0]);

  assert.ok(score.relevance >= 0 && score.relevance <= 100);
  assert.ok(score.evidence >= 0 && score.evidence <= 100);
  assert.match(score.caveat, /research signals, not ground truth/);
});

test("local deterministic judge adapter preserves existing score behavior", () => {
  const adapter = resolveArenaJudgeAdapter("local-deterministic");
  const score = adapter.judge(history[0]);

  assert.equal(adapter, localDeterministicJudgeAdapter);
  assert.equal(adapter.id, "local-deterministic");
  assert.equal(adapter.label, "Local deterministic judge");
  assert.deepEqual(score, scoreTurnLocally(history[0]));
  assert.match(score.caveat, /not ground truth/);
});

test("Arena JSONL bundle emits valid one-object-per-line files and manifest counts", () => {
  const bundle = buildArenaJsonlBundle(input());
  const fileNames = [
    "events.jsonl",
    "arguments.jsonl",
    "sft.jsonl",
    "weighted_sft.jsonl",
    "preference_or_dpo_judge.jsonl",
    "loop_trajectories.jsonl",
    "web_research.jsonl",
  ];

  for (const name of fileNames) {
    assert.ok(Object.hasOwn(bundle.files, name));
    const content = bundle.files[name as keyof typeof bundle.files].trim();
    if (!content) continue;
    for (const line of content.split(/\r?\n/)) {
      assert.doesNotThrow(() => JSON.parse(line));
    }
  }

  assert.equal(bundle.manifest.schema_version, "arena-loop-jsonl-bundle-v1");
  assert.equal(bundle.manifest.row_counts["arguments.jsonl"], 2);
  assert.equal(bundle.manifest.row_counts["sft.jsonl"], 2);
  assert.equal(bundle.manifest.row_counts["preference_or_dpo_judge.jsonl"], 0);
  const trajectory = JSON.parse(bundle.files["loop_trajectories.jsonl"].trim().split(/\r?\n/)[0]);
  assert.equal(trajectory.candidates[0].id, "LOCAL-01");
  assert.equal(trajectory.critiques[0].candidate_id, "LOCAL-01");
});
