import { ArenaJudgingMode, ArenaLoopRuntimeSettings, ArenaSearchProvider, DebateTurn, TurnSender } from "../types";
import { SessionExportInput } from "./sessionExports";

export interface ArenaLoopLimits {
  maxLoopPasses: number;
  maxCandidatesPerPass: number;
  maxQueriesPerTurn: number;
  maxSourcesPerTurn: number;
  maxSourceExcerptLength: number;
  maxMemoryCharacters: number;
}

export interface ArenaSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  provider: string;
  retrieved_at: string;
  published_at?: string;
}

export interface StructuredArenaPoint {
  claim: string;
  reasoning: string;
  relation: "supports" | "attacks" | "clarifies" | "reframes" | "concedes" | "synthesizes";
  target_argument_ids: string[];
  source_ids: string[];
  expected_impact: number;
  uncertainty: number;
  tags: string[];
}

export interface ArenaJudgeScore {
  relevance: number;
  engagement: number;
  evidence: number;
  novelty: number;
  clarity: number;
  synthesis: number;
  impact: number;
  caveat: string;
}

export interface ArenaJudgeAdapter {
  id: ArenaJudgingMode;
  label: string;
  judge(turn: DebateTurn): ArenaJudgeScore;
}

const DEFAULT_LIMITS: ArenaLoopLimits = {
  maxLoopPasses: 6,
  maxCandidatesPerPass: 2,
  maxQueriesPerTurn: 2,
  maxSourcesPerTurn: 4,
  maxSourceExcerptLength: 600,
  maxMemoryCharacters: 2000,
};

export const ARENA_SEARCH_PROVIDER_OPTIONS: Array<{ value: ArenaSearchProvider; label: string }> = [
  { value: "mock", label: "Mock local research" },
  { value: "searxng", label: "SearXNG endpoint" },
  { value: "brave", label: "Brave Search API" },
  { value: "tavily", label: "Tavily Search API" },
];

export const DEFAULT_ARENA_LOOP_RUNTIME: ArenaLoopRuntimeSettings = {
  ...DEFAULT_LIMITS,
  searchProvider: "mock",
  searchEndpointUrl: "",
  searchTimeoutMs: 5000,
  judgingMode: "local-deterministic",
};

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, Math.round(numeric))) : fallback;
}

export function normalizeArenaLoopLimits(raw: Partial<ArenaLoopLimits> = {}): ArenaLoopLimits {
  return {
    maxLoopPasses: clampInteger(raw.maxLoopPasses, DEFAULT_LIMITS.maxLoopPasses, 1, 25),
    maxCandidatesPerPass: clampInteger(raw.maxCandidatesPerPass, DEFAULT_LIMITS.maxCandidatesPerPass, 1, 5),
    maxQueriesPerTurn: clampInteger(raw.maxQueriesPerTurn, DEFAULT_LIMITS.maxQueriesPerTurn, 0, 5),
    maxSourcesPerTurn: clampInteger(raw.maxSourcesPerTurn, DEFAULT_LIMITS.maxSourcesPerTurn, 0, 10),
    maxSourceExcerptLength: clampInteger(raw.maxSourceExcerptLength, DEFAULT_LIMITS.maxSourceExcerptLength, 80, 1200),
    maxMemoryCharacters: clampInteger(raw.maxMemoryCharacters, DEFAULT_LIMITS.maxMemoryCharacters, 300, 8000),
  };
}

function normalizeSearchProvider(value: unknown): ArenaSearchProvider {
  return ARENA_SEARCH_PROVIDER_OPTIONS.some((option) => option.value === value)
    ? value as ArenaSearchProvider
    : DEFAULT_ARENA_LOOP_RUNTIME.searchProvider;
}

function normalizeJudgingMode(value: unknown): ArenaJudgingMode {
  return value === "local-deterministic" ? value : DEFAULT_ARENA_LOOP_RUNTIME.judgingMode;
}

export function normalizeArenaLoopRuntimeSettings(raw: Partial<ArenaLoopRuntimeSettings> = {}): ArenaLoopRuntimeSettings {
  const limits = normalizeArenaLoopLimits(raw);
  return {
    ...limits,
    searchProvider: normalizeSearchProvider(raw.searchProvider),
    searchEndpointUrl: typeof raw.searchEndpointUrl === "string" ? raw.searchEndpointUrl.trim().slice(0, 500) : "",
    searchTimeoutMs: clampInteger(raw.searchTimeoutMs, DEFAULT_ARENA_LOOP_RUNTIME.searchTimeoutMs, 1000, 30000),
    judgingMode: normalizeJudgingMode(raw.judgingMode),
  };
}

export function argumentAddress(roundNumber: number, side: TurnSender, pointIndex: number) {
  const sideCode = side === "agentB" ? "B" : side === "moderator" ? "M" : "A";
  return `R${String(Math.max(1, roundNumber)).padStart(2, "0")}-${sideCode}-P${String(Math.max(1, pointIndex)).padStart(2, "0")}`;
}

export function filterValidSourceIds(sourceIds: string[] = [], availableSources: Array<Pick<ArenaSource, "id">> = []) {
  const valid = new Set(availableSources.map((source) => source.id));
  return [...new Set(sourceIds)].filter((sourceId) => valid.has(sourceId));
}

export function buildMockSearchResults(query: string, limits: Partial<ArenaLoopLimits> = {}, retrievedAt = new Date().toISOString()): ArenaSource[] {
  const normalized = normalizeArenaLoopLimits(limits);
  const cleanQuery = query.trim() || "arena loop local mock research";
  return Array.from({ length: Math.max(1, normalized.maxSourcesPerTurn) }, (_, index) => {
    const sourceNumber = index + 1;
    return {
      id: `S${String(sourceNumber).padStart(2, "0")}`,
      title: `Mock source ${sourceNumber}: ${cleanQuery}`,
      url: `mock://arena-loop/${encodeURIComponent(cleanQuery)}/${sourceNumber}`,
      snippet: `Deterministic local mock research result ${sourceNumber} for "${cleanQuery}". Use as a test citation only, not as external evidence.`,
      domain: "mock.local",
      provider: "mock",
      retrieved_at: retrievedAt,
    };
  });
}

export function buildStructuredPointFromTurn(
  turn: DebateTurn,
  roundNumber: number,
  availableSources: ArenaSource[] = [],
): StructuredArenaPoint {
  const rawSourceIds = turn.searchSources?.map((source, index) => {
    const byUri = availableSources.find((candidate) => candidate.url === source.uri);
    return byUri?.id || `S${String(index + 1).padStart(2, "0")}`;
  }) || [];

  return {
    claim: turn.proposal || turn.content.split("\n")[0] || "Arena turn",
    reasoning: turn.content,
    relation: turn.type === "critique" ? "attacks" : turn.type === "agreement" ? "synthesizes" : turn.type === "rebuttal" ? "reframes" : "supports",
    target_argument_ids: roundNumber > 1 ? [argumentAddress(roundNumber - 1, turn.sender === "agentA" ? "agentB" : "agentA", 1)] : [],
    source_ids: filterValidSourceIds(rawSourceIds, availableSources),
    expected_impact: Math.max(0, Math.min(1, turn.convictionScore / 100)),
    uncertainty: Math.max(0, Math.min(1, 1 - (turn.convictionScore / 100))),
    tags: [turn.type, turn.complexity || "quick lookup"],
  };
}

function scoreTurnWithLocalDeterministicJudge(turn: DebateTurn): ArenaJudgeScore {
  const contentLength = turn.content.trim().length;
  const evidenceBonus = turn.searchSources?.length ? 10 : 0;
  const proposalBonus = turn.proposal ? 8 : 0;
  const clarity = Math.min(100, Math.round(contentLength / 8));
  const relevance = Math.max(40, Math.min(100, Math.round(turn.convictionScore)));
  const evidence = Math.max(25, Math.min(100, relevance - 10 + evidenceBonus));
  const novelty = Math.max(30, Math.min(100, clarity + proposalBonus));

  return {
    relevance,
    engagement: turn.type === "critique" || turn.type === "rebuttal" ? 82 : 70,
    evidence,
    novelty,
    clarity,
    synthesis: turn.type === "agreement" ? 88 : turn.type === "rebuttal" ? 72 : 55,
    impact: Math.max(30, Math.min(100, Math.round((relevance + evidence + novelty) / 3))),
    caveat: "Local deterministic judge scores are research signals, not ground truth.",
  };
}

export const localDeterministicJudgeAdapter: ArenaJudgeAdapter = {
  id: "local-deterministic",
  label: "Local deterministic judge",
  judge: scoreTurnWithLocalDeterministicJudge,
};

export function resolveArenaJudgeAdapter(mode: ArenaJudgingMode = "local-deterministic"): ArenaJudgeAdapter {
  return mode === "local-deterministic" ? localDeterministicJudgeAdapter : localDeterministicJudgeAdapter;
}

export function scoreTurnLocally(turn: DebateTurn) {
  return localDeterministicJudgeAdapter.judge(turn);
}

function jsonl(rows: unknown[]) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
}

export function buildArenaJsonlBundle(input: SessionExportInput) {
  const generatedAt = new Date().toISOString();
  const sources = input.history.flatMap((turn) =>
    (turn.searchSources || []).map((source, index): ArenaSource => ({
      id: `S${String(index + 1).padStart(2, "0")}`,
      title: source.title,
      url: source.uri,
      snippet: source.title,
      domain: (() => {
        try {
          return new URL(source.uri).hostname;
        } catch {
          return "unknown";
        }
      })(),
      provider: "provider-returned",
      retrieved_at: generatedAt,
    })),
  );
  const sourceByUrl = new Map(sources.map((source) => [source.url, source]));
  const uniqueSources = [...sourceByUrl.values()];

  const argumentRows = input.history.flatMap((turn, index) => {
    const roundNumber = index + 1;
    const point = buildStructuredPointFromTurn(turn, roundNumber, uniqueSources);
    return [{
      battle_id: input.sessionId,
      argument_id: argumentAddress(roundNumber, turn.sender, 1),
      side: turn.sender,
      round: roundNumber,
      score: scoreTurnLocally(turn),
      ...point,
    }];
  });

  const eventRows = [
    {
      event: "battle.created",
      battle_id: input.sessionId,
      created_at: generatedAt,
      master_goal: input.topic,
      visibility: "local-export",
    },
    ...input.history.flatMap((turn, index) => [
      { event: "turn.started", battle_id: input.sessionId, round: index + 1, side: turn.sender, created_at: turn.timestamp },
      { event: "turn.completed", battle_id: input.sessionId, round: index + 1, side: turn.sender, created_at: turn.timestamp, turn_id: turn.id },
      { event: "judge.completed", battle_id: input.sessionId, round: index + 1, score: scoreTurnLocally(turn), created_at: turn.timestamp },
    ]),
    ...input.finalizedTasks.map((task) => ({
      event: "battle.completed",
      battle_id: input.sessionId,
      task_id: task.id,
      winner: task.approvedBy,
      created_at: task.timestamp,
    })),
  ];

  const sftRows = input.history.map((turn, index) => ({
    messages: [
      { role: "system", content: "You are an Arena Loop agent. Produce one structured, evidence-aware debate move." },
      { role: "user", content: `Goal: ${input.topic}\nRound: ${index + 1}\nSide: ${turn.sender}` },
      { role: "assistant", content: turn.content },
    ],
  }));

  const weightedSftRows = input.history.map((turn, index) => ({
    ...sftRows[index],
    metadata: {
      battle_id: input.sessionId,
      turn_id: turn.id,
      side: turn.sender,
      conviction: turn.convictionScore,
      score: scoreTurnLocally(turn),
    },
    sample_weight: Number(Math.max(0.1, Math.min(1, turn.convictionScore / 100)).toFixed(2)),
  }));

  const loopTrajectoryRows = input.history.map((turn, index) => ({
    battle_id: input.sessionId,
    round: index + 1,
    side: turn.sender,
    input_context: {
      master_goal: input.topic,
      side: turn.sender,
      prior_turn_count: index,
    },
    candidates: [{
      id: "LOCAL-01",
      pass: 1,
      content: turn.content,
      thesis: turn.proposal || turn.content.split("\n")[0] || "Local Arena turn",
      strategy: "Captured from the live Pong debate history.",
      expected_score: Number(Math.max(0.1, Math.min(1, turn.convictionScore / 100)).toFixed(2)),
      source_ids: (turn.searchSources || []).map((_source, sourceIndex) => `S${String(sourceIndex + 1).padStart(2, "0")}`),
    }],
    critiques: [{
      candidate_id: "LOCAL-01",
      critique: "Local export captures the live selected move as the candidate.",
      risk: turn.searchSources?.length ? "Review cited source snippets before reuse." : "No source citations were attached to this local turn.",
      revision_hint: "Use subsequent turns to address unresolved arguments and improve evidence.",
    }],
    selected_candidate_id: "LOCAL-01",
    selected_candidate: turn.content,
    final_scored_result: scoreTurnLocally(turn),
    memory_updates: turn.proposal ? [turn.proposal] : [],
    source_usage: turn.searchSources || [],
  }));

  const files = {
    "events.jsonl": jsonl(eventRows),
    "arguments.jsonl": jsonl(argumentRows),
    "sft.jsonl": jsonl(sftRows),
    "weighted_sft.jsonl": jsonl(weightedSftRows),
    "preference_or_dpo_judge.jsonl": "",
    "loop_trajectories.jsonl": jsonl(loopTrajectoryRows),
    "web_research.jsonl": jsonl(uniqueSources),
  };

  const manifest = {
    schema_version: "arena-loop-jsonl-bundle-v1",
    battle_id: input.sessionId,
    created_at: generatedAt,
    export_generated_at: generatedAt,
    row_counts: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, content.trim() ? content.trim().split(/\r?\n/).length : 0])),
    provider_metadata: {
      agentA: input.agentConfig.agentA.provider || "mock",
      agentB: input.agentConfig.agentB.provider || "mock",
      model: input.agentConfig.model,
    },
    rubric_version: "local-deterministic-judge-v1",
    caveats: [
      "Web snippets and source metadata may carry provider licensing constraints; review before fine-tuning.",
      "Arena scores are preference signals and research diagnostics, not objective truth.",
      "Preference/DPO rows are emitted only when comparable outputs exist; this local export does not fabricate pairs.",
    ],
  };

  return { manifest, files };
}
