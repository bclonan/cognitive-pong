import fs from "fs";
import path from "path";
import { Agent, AgentBridgeConfig, AgentConfig, DebateTurn } from "../src/types";
import {
  ArenaLoopLimits,
  ArenaSource,
  StructuredArenaPoint,
  argumentAddress,
  buildMockSearchResults,
  buildStructuredPointFromTurn,
  filterValidSourceIds,
  normalizeArenaLoopLimits,
  resolveArenaJudgeAdapter,
  scoreTurnLocally,
} from "../src/utils/arenaLoop";
import { modelPlaceholder } from "../src/utils/providerControls";
import { resolveArenaSearchConfig, searchArenaSources } from "./arenaSearchProviders";
import { generateWithAgentBridge, resolveAgentBridgeConfig } from "./agentBridges";
import { generateWithProvider, resolveProviderConfig } from "./providers";
import { buildZipBundle } from "./zipBundle";
import {
  isSQLiteStorePath,
  readSQLiteArenaBattles,
  writeSQLiteArenaBattles,
} from "./sqliteStore";

export const DEFAULT_ARENA_LOOP_FILE = process.env.COGNITIVE_PONG_ARENA_STORE || path.join(process.cwd(), "data", "arena-loop-battles.json");

export type ArenaLoopStatus = "created" | "running" | "completed" | "paused";
export type ArenaLoopVisibility = "private" | "public";
export type ArenaLoopSide = "agentA" | "agentB";

export interface ArenaAgentProfile {
  display_name: string;
  provider: string;
  model: string;
  endpoint_url?: string;
  bridge?: AgentBridgeConfig;
  custom_instructions: string;
  personality: string;
  psychology_archetype: string;
  debate_style: string;
  win_drive: number;
  risk_tolerance: number;
  collaboration_bias: number;
  signature_moves: string;
  safety_constraints: string;
}

export interface ArenaBattle {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  master_goal: string;
  rubric: string;
  status: ArenaLoopStatus;
  visibility: ArenaLoopVisibility;
  config: {
    limits: ArenaLoopLimits;
    research_enabled: boolean;
    search_provider: ReturnType<typeof resolveArenaSearchConfig>["provider"];
    search_endpoint_url?: string;
    search_timeout_ms: number;
    judging_mode: "local-deterministic";
  };
  agent_a_profile: ArenaAgentProfile;
  agent_b_profile: ArenaAgentProfile;
  winner: "agentA" | "agentB" | "tie" | null;
  final_scores: { agentA: number; agentB: number };
  turns: ArenaStoredTurn[];
  arguments: ArenaStoredArgument[];
  sources: ArenaSource[];
  events: ArenaStoredEvent[];
  loop_memory: string;
}

export interface ArenaStoredTurn {
  id: string;
  battle_id: string;
  round_number: number;
  side: ArenaLoopSide;
  round_winner: ArenaLoopSide | "tie";
  prompt_context_snapshot: string;
  response: string;
  structured_points: ReturnType<typeof buildStructuredPointFromTurn>[];
  source_ids_used: string[];
  score: ReturnType<typeof scoreTurnLocally>;
  loop_trajectory: ArenaLoopTrajectory;
  latency_ms: number;
  usage_metadata: {
    provider: string;
    model: string;
    mock: boolean;
    provider_runtime?: {
      provider_id?: string;
      model_id?: string;
      latency_ms?: number;
      token_usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      cost_estimate_usd?: number;
      raw_response?: {
        type?: string;
        preview?: string;
        finish_reason?: string;
      };
    };
  };
  created_at: string;
}

export interface ArenaLoopCandidate {
  id: string;
  pass: number;
  content: string;
  thesis: string;
  strategy: string;
  expected_score: number;
  source_ids: string[];
}

export interface ArenaLoopCritique {
  candidate_id: string;
  critique: string;
  risk: string;
  revision_hint: string;
}

export interface ArenaLoopTrajectory {
  input_context: string;
  research_queries: string[];
  candidates: ArenaLoopCandidate[];
  critiques: ArenaLoopCritique[];
  selected_candidate_id: string;
  selected_candidate: string;
  final_scored_result: ReturnType<typeof scoreTurnLocally>;
  memory_updates: string[];
  source_usage: string[];
  bounded_by: {
    max_loop_passes: number;
    max_candidates_per_pass: number;
    max_queries_per_turn: number;
    max_sources_per_turn: number;
    max_memory_characters: number;
  };
}

export interface ArenaStoredArgument {
  id: string;
  battle_id: string;
  side: ArenaLoopSide;
  round: number;
  claim: string;
  reasoning: string;
  evidence: string;
  target_argument_ids: string[];
  relation: string;
  source_ids: string[];
  score: ReturnType<typeof scoreTurnLocally>;
  judge_notes: string;
}

export interface ArenaStoredEvent {
  event: string;
  battle_id: string;
  created_at: string;
  round?: number;
  side?: ArenaLoopSide;
  payload?: Record<string, unknown>;
}

export class ArenaLoopValidationError extends Error {
  statusCode = 400;
}

function ensureStore(storeFile = DEFAULT_ARENA_LOOP_FILE) {
  if (isSQLiteStorePath(storeFile)) {
    readSQLiteArenaBattles(storeFile);
    return;
  }

  const dir = path.dirname(storeFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, "[]", "utf-8");
  }
}

function cleanString(value: unknown, fallback: string, maxLength = 1000) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).slice(0, maxLength);
}

function clampUnit(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

function finiteNonNegative(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function normalizeProviderRuntimeMetadata(value: any) {
  if (!value || typeof value !== "object") return undefined;
  const tokenUsage = value.token_usage && typeof value.token_usage === "object"
    ? {
      prompt_tokens: finiteNonNegative(value.token_usage.prompt_tokens),
      completion_tokens: finiteNonNegative(value.token_usage.completion_tokens),
      total_tokens: finiteNonNegative(value.token_usage.total_tokens),
    }
    : undefined;
  const rawResponse = value.raw_response && typeof value.raw_response === "object"
    ? {
      type: cleanString(value.raw_response.type, "", 120) || undefined,
      preview: cleanString(value.raw_response.preview, "", 1200) || undefined,
      finish_reason: cleanString(value.raw_response.finish_reason, "", 120) || undefined,
    }
    : undefined;

  return {
    provider_id: cleanString(value.provider_id, "", 80) || undefined,
    model_id: cleanString(value.model_id, "", 180) || undefined,
    latency_ms: finiteNonNegative(value.latency_ms),
    token_usage: tokenUsage && Object.values(tokenUsage).some((entry) => entry !== undefined) ? tokenUsage : undefined,
    cost_estimate_usd: finiteNonNegative(value.cost_estimate_usd),
    raw_response: rawResponse && Object.values(rawResponse).some((entry) => entry !== undefined) ? rawResponse : undefined,
  };
}

function clampPercentToUnit(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric / 100));
}

function slugify(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
  return base || "arena-loop";
}

function clampScore(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallback;
}

function normalizeTurnType(value: unknown): DebateTurn["type"] {
  return value === "proposal" || value === "critique" || value === "rebuttal" || value === "agreement" ? value : "critique";
}

function sourceId(index: number) {
  return `S${String(Math.max(1, index)).padStart(2, "0")}`;
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return url.startsWith("mock://") ? "mock.local" : "unknown";
  }
}

function mergeArenaSources(battle: ArenaBattle, rawSources: ArenaSource[]) {
  const nextSources = [...battle.sources];
  const turnSources: ArenaSource[] = [];

  for (const source of rawSources) {
    const existing = nextSources.find((candidate) => candidate.url === source.url);
    if (existing) {
      turnSources.push(existing);
      continue;
    }

    const normalized = {
      ...source,
      id: sourceId(nextSources.length + 1),
      snippet: source.snippet.slice(0, battle.config.limits.maxSourceExcerptLength),
    };
    nextSources.push(normalized);
    turnSources.push(normalized);
  }

  return { nextSources, turnSources };
}

function sourcesFromDebateTurn(turn: DebateTurn, createdAt: string): ArenaSource[] {
  return (turn.searchSources || [])
    .filter((source) => typeof source?.uri === "string" && source.uri.trim())
    .map((source, index) => {
      const url = source.uri.trim();
      const title = cleanString(source.title, `Source ${index + 1}`, 240);
      return {
        id: sourceId(index + 1),
        title,
        url,
        snippet: title,
        domain: domainFromUrl(url),
        provider: url.startsWith("mock://") ? "mock" : "provider-returned",
        retrieved_at: createdAt,
      };
    });
}

function normalizeArenaBridgeConfig(agent: Partial<Agent>): AgentBridgeConfig | undefined {
  const bridge = agent.bridge;
  if (!bridge?.kind || bridge.kind === "none") return undefined;

  const normalized: AgentBridgeConfig = {
    kind: bridge.kind,
    label: cleanString(bridge.label, bridge.kind, 120),
    timeoutMs: Math.max(1000, Math.min(120000, Number(bridge.timeoutMs) || 15000)),
  };

  if (bridge.profileId && typeof bridge.profileId === "string") {
    normalized.profileId = bridge.profileId.trim().slice(0, 120);
  }

  if (bridge.kind === "cli" || bridge.kind === "codex-cli") {
    return normalized;
  }

  if (bridge.endpointUrl && typeof bridge.endpointUrl === "string") {
    normalized.endpointUrl = bridge.endpointUrl.trim().slice(0, 500);
  }
  if (bridge.kind === "mcp" && bridge.toolName && typeof bridge.toolName === "string") {
    normalized.toolName = bridge.toolName.trim().slice(0, 160);
  }

  return normalized;
}

export function normalizeArenaAgentProfile(agent: Partial<Agent> = {}, fallbackName = "Agent"): ArenaAgentProfile {
  const provider = cleanString(agent.provider, "mock", 48);
  const selectedModel = cleanString(agent.customModel || agent.model, modelPlaceholder(provider), 180);
  return {
    display_name: cleanString(agent.name, fallbackName, 120),
    provider,
    model: selectedModel,
    endpoint_url: typeof agent.endpointUrl === "string" && agent.endpointUrl.trim()
      ? agent.endpointUrl.trim().slice(0, 500)
      : undefined,
    bridge: normalizeArenaBridgeConfig(agent),
    custom_instructions: cleanString(agent.systemPrompt, "", 3000),
    personality: cleanString(agent.personality, "balanced analytical operator", 240),
    psychology_archetype: cleanString(agent.psychologyArchetype, "operator", 80),
    debate_style: cleanString(agent.debateStyle || agent.strategyBias, "balanced", 80),
    win_drive: clampPercentToUnit(agent.competitiveDrive, 0.5),
    risk_tolerance: clampUnit(agent.riskTolerance, 0.5),
    collaboration_bias: clampUnit(agent.collaborationBias, 0.5),
    signature_moves: cleanString(agent.strategicTendencies, "Claims, counters, and concise synthesis when justified.", 500),
    safety_constraints: cleanString(
      agent.safetyConstraints,
      "Truthfulness, safety, evidence quality, the master goal, and schema compliance override personality and win-drive.",
      800,
    ),
  };
}

export function readArenaBattles(storeFile = DEFAULT_ARENA_LOOP_FILE): ArenaBattle[] {
  ensureStore(storeFile);
  if (isSQLiteStorePath(storeFile)) {
    return readSQLiteArenaBattles<ArenaBattle>(storeFile);
  }

  const parsed = JSON.parse(fs.readFileSync(storeFile, "utf-8"));
  return Array.isArray(parsed) ? parsed : [];
}

export function writeArenaBattles(battles: ArenaBattle[], storeFile = DEFAULT_ARENA_LOOP_FILE) {
  ensureStore(storeFile);
  if (isSQLiteStorePath(storeFile)) {
    writeSQLiteArenaBattles(battles, storeFile);
    return;
  }

  const tempFile = `${storeFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(battles, null, 2), "utf-8");
  fs.renameSync(tempFile, storeFile);
}

export function buildArenaBattle(payload: any, options: { id?: string; now?: string } = {}): ArenaBattle {
  const masterGoal = cleanString(payload?.master_goal || payload?.masterGoal || payload?.topic, "", 1000);
  if (!masterGoal) {
    throw new ArenaLoopValidationError("Arena Loop master_goal is required.");
  }

  const agentConfig: Partial<AgentConfig> = payload?.agentConfig || payload?.config?.agentConfig || {};
  const now = options.now || new Date().toISOString();
  const id = options.id || `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const researchEnabled = payload?.research_enabled ?? payload?.config?.research_enabled ?? agentConfig.useGrounding ?? false;
  const runtimeSettings = agentConfig.arenaLoop || payload?.arenaLoop || payload?.config?.arenaLoop || {};
  const searchConfig = resolveArenaSearchConfig({
    searchProvider: payload?.search_provider || payload?.config?.search_provider || runtimeSettings.searchProvider,
    searchEndpointUrl: payload?.search_endpoint_url || payload?.config?.search_endpoint_url || runtimeSettings.searchEndpointUrl,
    searchTimeoutMs: payload?.search_timeout_ms || payload?.config?.search_timeout_ms || runtimeSettings.searchTimeoutMs,
  });

  return {
    id,
    slug: `${slugify(masterGoal)}-${id.slice(-6)}`,
    created_at: now,
    updated_at: now,
    master_goal: masterGoal,
    rubric: cleanString(payload?.rubric, "Relevance, direct engagement, evidence, novelty, clarity, synthesis, and impact.", 1000),
    status: "created",
    visibility: payload?.visibility === "public" ? "public" : "private",
    config: {
      limits: normalizeArenaLoopLimits(payload?.limits || payload?.config?.limits || runtimeSettings || {}),
      research_enabled: Boolean(researchEnabled),
      search_provider: searchConfig.provider,
      search_endpoint_url: searchConfig.endpointUrl,
      search_timeout_ms: searchConfig.timeoutMs,
      judging_mode: "local-deterministic",
    },
    agent_a_profile: normalizeArenaAgentProfile(agentConfig.agentA, "Agent A"),
    agent_b_profile: normalizeArenaAgentProfile(agentConfig.agentB, "Agent B"),
    winner: null,
    final_scores: { agentA: 0, agentB: 0 },
    turns: [],
    arguments: [],
    sources: [],
    events: [{
      event: "battle.created",
      battle_id: id,
      created_at: now,
      payload: { visibility: payload?.visibility === "public" ? "public" : "private" },
    }],
    loop_memory: "",
  };
}

export function createArenaBattle(payload: any, storeFile = DEFAULT_ARENA_LOOP_FILE) {
  const battles = readArenaBattles(storeFile);
  const battle = buildArenaBattle(payload);
  battles.unshift(battle);
  writeArenaBattles(battles, storeFile);
  return battle;
}

export function findArenaBattle(idOrSlug: string, storeFile = DEFAULT_ARENA_LOOP_FILE) {
  return readArenaBattles(storeFile).find((battle) => battle.id === idOrSlug || battle.slug === idOrSlug) || null;
}

function event(event: string, battle: ArenaBattle, createdAt: string, payload?: Record<string, unknown>, side?: ArenaLoopSide, round?: number): ArenaStoredEvent {
  return { event, battle_id: battle.id, created_at: createdAt, side, round, payload };
}

function buildPromptContext(battle: ArenaBattle, side: ArenaLoopSide, roundNumber: number, sources: ArenaSource[]) {
  const active = side === "agentA" ? battle.agent_a_profile : battle.agent_b_profile;
  const opponent = side === "agentA" ? battle.agent_b_profile : battle.agent_a_profile;
  const ledger = battle.arguments.slice(-12).map((argument) => `${argument.id}: ${argument.claim}`).join("\n") || "No prior arguments.";
  const unresolved = battle.arguments
    .filter((argument) => argument.side !== side)
    .slice(-8)
    .sort((left, right) => right.score.impact - left.score.impact)
    .slice(0, 4)
    .map((argument) => `${argument.id}: ${argument.claim} (${argument.relation}, impact ${argument.score.impact})`)
    .join("\n") || "No unresolved opponent arguments yet.";
  const sourceText = sources.map((source) => `${source.id}: ${source.title} - ${source.snippet}`).join("\n") || "No research sources available.";
  return [
    `Master goal: ${battle.master_goal}`,
    `Rubric: ${battle.rubric}`,
    `Round: ${roundNumber}`,
    `Current score: Agent A ${battle.final_scores.agentA}, Agent B ${battle.final_scores.agentB}`,
    `Active profile: ${JSON.stringify(active)}`,
    `Opponent profile: ${JSON.stringify(opponent)}`,
    `Win-drive guidance: ${active.display_name} has win_drive ${active.win_drive}; use it to tune strategic intensity while staying evidence-led.`,
    "Personality, psychology archetype, and desire-to-win affect style and strategy, but they must not override truthfulness, safety, evidence quality, the master goal, or valid schema compliance.",
    `Prior addressable argument ledger:\n${ledger}`,
    `High-value unresolved arguments:\n${unresolved}`,
    `Available sources:\n${sourceText}`,
    `Loop memory:\n${battle.loop_memory || "No memory yet."}`,
    "Required response schema: thesis, strategy, confidence, points[{claim, reasoning, relation, target_argument_ids, source_ids, expected_impact, uncertainty, tags}].",
  ].join("\n\n");
}

type ArenaLoopTrajectoryDraft = Omit<ArenaLoopTrajectory, "final_scored_result" | "memory_updates">;

function trajectoryBounds(battle: ArenaBattle): ArenaLoopTrajectory["bounded_by"] {
  return {
    max_loop_passes: battle.config.limits.maxLoopPasses,
    max_candidates_per_pass: battle.config.limits.maxCandidatesPerPass,
    max_queries_per_turn: battle.config.limits.maxQueriesPerTurn,
    max_sources_per_turn: battle.config.limits.maxSourcesPerTurn,
    max_memory_characters: battle.config.limits.maxMemoryCharacters,
  };
}

function buildResearchQueries(battle: ArenaBattle, side: ArenaLoopSide, profile: ArenaAgentProfile) {
  if (!battle.config.research_enabled || battle.config.limits.maxQueriesPerTurn <= 0) return [];
  const opponent = side === "agentA" ? battle.agent_b_profile : battle.agent_a_profile;
  return [
    `${battle.master_goal} ${profile.debate_style} evidence`,
    `${battle.master_goal} objections from ${opponent.debate_style} perspective`,
    `${battle.master_goal} implementation risks`,
    `${battle.master_goal} synthesis criteria`,
    `${battle.master_goal} evaluation rubric`,
  ].slice(0, battle.config.limits.maxQueriesPerTurn);
}

function collectMockResearchSources(battle: ArenaBattle, side: ArenaLoopSide, retrievedAt: string) {
  const profile = side === "agentA" ? battle.agent_a_profile : battle.agent_b_profile;
  const queries = buildResearchQueries(battle, side, profile);
  const sources: ArenaSource[] = [];

  for (const query of queries) {
    const remaining = battle.config.limits.maxSourcesPerTurn - sources.length;
    if (remaining <= 0) break;
    sources.push(...buildMockSearchResults(query, {
      ...battle.config.limits,
      maxSourcesPerTurn: remaining,
    }, retrievedAt));
  }

  return sources.slice(0, battle.config.limits.maxSourcesPerTurn);
}

async function collectProviderResearchSources(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  retrievedAt: string,
  searchConfig: ReturnType<typeof resolveArenaSearchConfig>,
  fetchImpl?: typeof fetch,
) {
  const profile = side === "agentA" ? battle.agent_a_profile : battle.agent_b_profile;
  const queries = buildResearchQueries(battle, side, profile);
  const sources: ArenaSource[] = [];

  for (const query of queries) {
    const remaining = battle.config.limits.maxSourcesPerTurn - sources.length;
    if (remaining <= 0) break;
    const nextSources = await searchArenaSources({
      query,
      limits: {
        ...battle.config.limits,
        maxSourcesPerTurn: remaining,
      },
      retrievedAt,
      config: searchConfig,
      fetchImpl,
    });
    sources.push(...nextSources);
  }

  return sources.slice(0, battle.config.limits.maxSourcesPerTurn);
}

function buildAutonomousLoopTrajectoryDraft(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  roundNumber: number,
  inputContext: string,
  sources: ArenaSource[],
): ArenaLoopTrajectoryDraft {
  const profile = side === "agentA" ? battle.agent_a_profile : battle.agent_b_profile;
  const sourceIds = sources.map((source) => source.id);
  const candidates: ArenaLoopCandidate[] = [];
  const critiques: ArenaLoopCritique[] = [];
  const researchQueries = buildResearchQueries(battle, side, profile);
  const sourceLine = sourceIds.length ? `Cites ${sourceIds.slice(0, 3).join(", ")}.` : "Uses no external sources.";

  for (let pass = 1; pass <= battle.config.limits.maxLoopPasses; pass += 1) {
    for (let index = 1; index <= battle.config.limits.maxCandidatesPerPass; index += 1) {
      const id = `C${String(pass).padStart(2, "0")}-${String(index).padStart(2, "0")}`;
      const thesis = side === "agentA"
        ? `Ship a bounded implementation path for ${battle.master_goal}`
        : `Expose the highest-risk failure mode in ${battle.master_goal}`;
      const strategy = `${profile.debate_style} move using ${profile.signature_moves}`;
      const expectedScore = Math.max(0.1, Math.min(1, Number((0.52 + (profile.win_drive * 0.18) + (pass * 0.03) - (index * 0.01) + (sourceIds.length ? 0.05 : 0)).toFixed(2))));
      const content = [
        `${profile.display_name} candidate ${id} for round ${roundNumber}.`,
        `Thesis: ${thesis}.`,
        `Strategy: ${strategy}.`,
        sourceLine,
      ].join("\n");

      candidates.push({
        id,
        pass,
        content,
        thesis,
        strategy,
        expected_score: expectedScore,
        source_ids: sourceIds,
      });
      critiques.push({
        candidate_id: id,
        critique: expectedScore >= 0.72 ? "Strong move; keep it concise and directly tied to the rubric." : "Needs sharper engagement with unresolved arguments before publication.",
        risk: sourceIds.length ? "Source snippets may be incomplete; avoid overclaiming beyond cited evidence." : "No retrieved evidence is available, so claims must remain provisional.",
        revision_hint: side === "agentA" ? "Add implementation boundary and measurable acceptance criteria." : "Name the concrete failure condition and what would falsify it.",
      });
    }
  }

  const selected = [...candidates].sort((left, right) => {
    if (right.expected_score !== left.expected_score) return right.expected_score - left.expected_score;
    return left.id.localeCompare(right.id);
  })[0];

  return {
    input_context: inputContext,
    research_queries: researchQueries,
    candidates,
    critiques,
    selected_candidate_id: selected?.id || "C01-01",
    selected_candidate: selected?.content || `${profile.display_name} has no candidate move available.`,
    source_usage: sourceIds,
    bounded_by: trajectoryBounds(battle),
  };
}

function buildExternalTurnTrajectoryDraft(
  battle: ArenaBattle,
  inputContext: string,
  turn: DebateTurn,
  sourceIds: string[],
): ArenaLoopTrajectoryDraft {
  return {
    input_context: inputContext,
    research_queries: [],
    candidates: [{
      id: "LIVE-01",
      pass: 1,
      content: turn.content,
      thesis: turn.proposal || turn.content.split("\n")[0] || "Live Arena turn",
      strategy: "External provider/live Pong turn selected by the active arena loop.",
      expected_score: Number(Math.max(0.1, Math.min(1, turn.convictionScore / 100)).toFixed(2)),
      source_ids: sourceIds,
    }],
    critiques: [{
      candidate_id: "LIVE-01",
      critique: "Live turn accepted as the selected candidate; local scoring still records it as a research signal.",
      risk: sourceIds.length ? "Verify cited sources remain valid and relevant." : "No source citations were attached to this live turn.",
      revision_hint: "Use the next volley to address the strongest unresolved argument.",
    }],
    selected_candidate_id: "LIVE-01",
    selected_candidate: turn.content,
    source_usage: sourceIds,
    bounded_by: trajectoryBounds(battle),
  };
}

function roundWinnerFromScore(score: ReturnType<typeof scoreTurnLocally>, side: ArenaLoopSide): ArenaLoopSide | "tie" {
  return score.impact >= 55 ? side : "tie";
}

function storedTurnRoundWinner(turn: ArenaStoredTurn): ArenaLoopSide | "tie" {
  return turn.round_winner || roundWinnerFromScore(turn.score, turn.side);
}

function defaultTurnType(side: ArenaLoopSide, roundNumber: number): DebateTurn["type"] {
  return side === "agentA" && roundNumber === 1 ? "proposal" : side === "agentB" ? "critique" : "rebuttal";
}

function profileToRuntimeAgent(profile: ArenaAgentProfile, fallbackAvatar: string, fallbackColor: string): Agent {
  return {
    name: profile.display_name,
    role: profile.custom_instructions || profile.signature_moves,
    color: fallbackColor,
    avatar: fallbackAvatar,
    provider: profile.provider as Agent["provider"],
    bridge: profile.bridge,
    model: profile.model,
    endpointUrl: profile.endpoint_url,
    systemPrompt: profile.custom_instructions,
    personality: profile.personality,
    psychologyArchetype: profile.psychology_archetype as Agent["psychologyArchetype"],
    debateStyle: profile.debate_style as Agent["debateStyle"],
    strategyBias: profile.debate_style as Agent["strategyBias"],
    competitiveDrive: Math.round(profile.win_drive * 100),
    riskTolerance: profile.risk_tolerance,
    collaborationBias: profile.collaboration_bias,
    strategicTendencies: profile.signature_moves,
    safetyConstraints: profile.safety_constraints,
  };
}

function buildProviderAgentConfig(battle: ArenaBattle): AgentConfig {
  return {
    useGrounding: battle.config.research_enabled,
    baseSpeed: 3,
    model: "mock-local",
    defaultComplexity: battle.config.research_enabled ? "deep research" : "quick lookup",
    agentA: profileToRuntimeAgent(battle.agent_a_profile, "A", "#00FF41"),
    agentB: profileToRuntimeAgent(battle.agent_b_profile, "B", "#FF7A3D"),
  };
}

function providerSystemInstruction(profile: ArenaAgentProfile) {
  return [
    `You are ${profile.display_name}, an Arena Loop debate agent.`,
    "Run a bounded internal loop, then publish one structured move.",
    "Respond strictly as JSON with: thesis, strategy, confidence, points[].",
    "Each point must include claim, reasoning, relation, target_argument_ids, source_ids, expected_impact, uncertainty, and tags.",
    "Only cite source IDs that appear in the prompt.",
    "Personality, psychology archetype, and desire-to-win affect style and strategy, but they must not override truthfulness, safety, evidence quality, the master goal, or valid schema compliance.",
  ].join("\n");
}

function mockResponseFromTrajectory(
  trajectoryDraft: ArenaLoopTrajectoryDraft,
  side: ArenaLoopSide,
  roundNumber: number,
  battle: ArenaBattle,
): Partial<DebateTurn> {
  return {
    content: trajectoryDraft.selected_candidate,
    type: defaultTurnType(side, roundNumber),
    proposal: side === "agentA" ? `Bounded arena loop move ${roundNumber}` : undefined,
    convictionScore: side === "agentA" ? 78 : 74,
    complexity: battle.config.research_enabled ? "deep research" as const : "quick lookup" as const,
  };
}

function normalizeArenaPointRelation(value: unknown): StructuredArenaPoint["relation"] {
  const relation = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (relation) {
    case "attacks":
    case "clarifies":
    case "reframes":
    case "concedes":
    case "synthesizes":
      return relation;
    default:
      return "supports";
  }
}

function structuredPointsFromProviderResponse(
  generatedTurn: Partial<DebateTurn> & { arenaStructuredResponse?: any },
  fallbackPoint: StructuredArenaPoint,
  availableSources: ArenaSource[],
  maxPoints = 8,
): StructuredArenaPoint[] {
  const rawPoints = generatedTurn.arenaStructuredResponse?.points;
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) return [fallbackPoint];

  return rawPoints.slice(0, maxPoints).map((point: any): StructuredArenaPoint => {
    const rawSourceIds = Array.isArray(point?.source_ids) ? point.source_ids.filter((sourceId: unknown) => typeof sourceId === "string") : [];
    const rawTargets = Array.isArray(point?.target_argument_ids)
      ? point.target_argument_ids.filter((argumentId: unknown) => typeof argumentId === "string").slice(0, 8)
      : [];
    return {
      claim: cleanString(point?.claim, fallbackPoint.claim, 1000),
      reasoning: cleanString(point?.reasoning, fallbackPoint.reasoning, 4000),
      relation: normalizeArenaPointRelation(point?.relation),
      target_argument_ids: rawTargets,
      source_ids: filterValidSourceIds(rawSourceIds, availableSources),
      expected_impact: clampUnit(point?.expected_impact, fallbackPoint.expected_impact),
      uncertainty: clampUnit(point?.uncertainty, fallbackPoint.uncertainty),
      tags: Array.isArray(point?.tags)
        ? point.tags.filter((tag: unknown) => typeof tag === "string").slice(0, 10)
        : fallbackPoint.tags,
    };
  });
}

interface PreparedArenaTurn {
  createdAt: string;
  roundNumber: number;
  activeProfile: ArenaAgentProfile;
  nextSources: ArenaSource[];
  researchSources: ArenaSource[];
  promptContext: string;
  trajectoryDraft: ArenaLoopTrajectoryDraft;
}

function prepareArenaTurn(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  rawResearchSources: ArenaSource[],
  createdAt: string,
): PreparedArenaTurn {
  if (battle.status === "completed") {
    throw new ArenaLoopValidationError("Arena Loop battle is already completed.");
  }

  const roundNumber = battle.turns.length + 1;
  const activeProfile = side === "agentA" ? battle.agent_a_profile : battle.agent_b_profile;
  const { nextSources, turnSources: researchSources } = mergeArenaSources(battle, rawResearchSources);
  const promptContext = buildPromptContext({ ...battle, sources: nextSources }, side, roundNumber, researchSources);
  const trajectoryDraft = buildAutonomousLoopTrajectoryDraft(battle, side, roundNumber, promptContext, researchSources);

  return { createdAt, roundNumber, activeProfile, nextSources, researchSources, promptContext, trajectoryDraft };
}

function finalizeArenaTurn(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  prepared: PreparedArenaTurn,
  options: {
    latencyMs?: number;
    generatedTurn?: Partial<DebateTurn>;
    providerSearchSources?: Array<{ title: string; uri: string }>;
    provider?: string;
    model?: string;
    providerMetadata?: any;
    isMock?: boolean;
  } = {},
): ArenaBattle {
  const generatedTurn = options.generatedTurn || {};
  const response = cleanString(generatedTurn.content, prepared.trajectoryDraft.selected_candidate, 20000);
  const researchSearchSources = prepared.researchSources.map((source) => ({ title: source.title, uri: source.url }));
  const combinedSearchSources = [...researchSearchSources, ...(options.providerSearchSources || [])];
  const debateTurn: DebateTurn = {
    id: cleanString(generatedTurn.id, `turn_${prepared.roundNumber}_${side}`, 160),
    sender: side,
    content: response,
    type: normalizeTurnType(generatedTurn.type || defaultTurnType(side, prepared.roundNumber)),
    proposal: typeof generatedTurn.proposal === "string" && generatedTurn.proposal.trim()
      ? generatedTurn.proposal.trim().slice(0, 1000)
      : side === "agentA" ? `Bounded arena loop move ${prepared.roundNumber}` : undefined,
    convictionScore: clampScore(generatedTurn.convictionScore, side === "agentA" ? 78 : 74),
    timestamp: prepared.createdAt,
    searchSources: combinedSearchSources,
    complexity: generatedTurn.complexity || (combinedSearchSources.length ? "deep research" : "quick lookup"),
  };

  const mergedTurnSources = mergeArenaSources(
    { ...battle, sources: prepared.nextSources },
    sourcesFromDebateTurn(debateTurn, prepared.createdAt),
  );
  const nextSources = mergedTurnSources.nextSources;
  const turnSources = mergedTurnSources.turnSources;
  const fallbackStructuredPoint = buildStructuredPointFromTurn(debateTurn, prepared.roundNumber, turnSources);
  const structuredPoints = structuredPointsFromProviderResponse(
    generatedTurn as Partial<DebateTurn> & { arenaStructuredResponse?: any },
    fallbackStructuredPoint,
    turnSources,
  );
  const sourceIdsUsed = [...new Set(structuredPoints.flatMap((point) => point.source_ids))];
  const judgeAdapter = resolveArenaJudgeAdapter(battle.config.judging_mode);
  const score = judgeAdapter.judge(debateTurn);
  const roundWinner = roundWinnerFromScore(score, side);
  const argumentIds = structuredPoints.map((_point, index) => argumentAddress(prepared.roundNumber, side, index + 1));
  const memoryUpdate = structuredPoints
    .map((point, index) => `${argumentIds[index]}: ${point.claim}`)
    .join("\n")
    .slice(0, battle.config.limits.maxMemoryCharacters);
  const loopTrajectory: ArenaLoopTrajectory = {
    ...prepared.trajectoryDraft,
    selected_candidate: response,
    source_usage: sourceIdsUsed,
    final_scored_result: score,
    memory_updates: [memoryUpdate],
  };
  const storedTurn: ArenaStoredTurn = {
    id: debateTurn.id,
    battle_id: battle.id,
    round_number: prepared.roundNumber,
    side,
    round_winner: roundWinner,
    prompt_context_snapshot: prepared.promptContext,
    response,
    structured_points: structuredPoints,
    source_ids_used: sourceIdsUsed,
    score,
    loop_trajectory: loopTrajectory,
    latency_ms: options.latencyMs ?? 0,
    usage_metadata: {
      provider: cleanString(options.provider, prepared.activeProfile.provider, 80),
      model: cleanString(options.model, prepared.activeProfile.model, 180),
      mock: options.isMock ?? prepared.activeProfile.provider === "mock",
      provider_runtime: normalizeProviderRuntimeMetadata(options.providerMetadata),
    },
    created_at: prepared.createdAt,
  };
  const storedArguments: ArenaStoredArgument[] = structuredPoints.map((point, index) => ({
    id: argumentIds[index],
    battle_id: battle.id,
    side,
    round: prepared.roundNumber,
    claim: point.claim,
    reasoning: point.reasoning,
    evidence: point.source_ids.join(", "),
    target_argument_ids: point.target_argument_ids,
    relation: point.relation,
    source_ids: point.source_ids,
    score,
    judge_notes: score.caveat,
  }));
  const nextScores = {
    ...battle.final_scores,
    [side]: battle.final_scores[side] + score.impact,
  };
  const maxRounds = Math.max(1, battle.config.limits.maxLoopPasses * 2);
  const isComplete = prepared.roundNumber >= maxRounds;
  const winner = isComplete
    ? Math.abs(nextScores.agentA - nextScores.agentB) < 8
      ? "tie"
      : nextScores.agentA > nextScores.agentB ? "agentA" : "agentB"
    : null;

  return {
    ...battle,
    updated_at: prepared.createdAt,
    status: isComplete ? "completed" : "running",
    winner,
    final_scores: nextScores,
    turns: [...battle.turns, storedTurn],
    arguments: [...battle.arguments, ...storedArguments],
    sources: nextSources,
    events: [
      ...battle.events,
      event("loop.started", battle, prepared.createdAt, undefined, side, prepared.roundNumber),
      ...(battle.config.research_enabled ? [
        event("research.started", battle, prepared.createdAt, { maxQueries: battle.config.limits.maxQueriesPerTurn, queries: prepared.trajectoryDraft.research_queries }, side, prepared.roundNumber),
        event("research.completed", battle, prepared.createdAt, { sourceIds: prepared.researchSources.map((source) => source.id), queries: prepared.trajectoryDraft.research_queries }, side, prepared.roundNumber),
      ] : []),
      event("turn.started", battle, prepared.createdAt, undefined, side, prepared.roundNumber),
      event("turn.completed", battle, prepared.createdAt, { turnId: storedTurn.id, argumentIds, roundWinner }, side, prepared.roundNumber),
      event("judge.completed", battle, prepared.createdAt, { score, judgeAdapter: judgeAdapter.id }, side, prepared.roundNumber),
      event("loop.memory.updated", battle, prepared.createdAt, { memoryUpdate }, side, prepared.roundNumber),
      ...(isComplete ? [event("battle.completed", battle, prepared.createdAt, { winner }, side, prepared.roundNumber)] : []),
    ],
    loop_memory: [battle.loop_memory, memoryUpdate].filter(Boolean).join("\n").slice(-battle.config.limits.maxMemoryCharacters),
  };
}

function runArenaBattleTurnFromSources(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  rawResearchSources: ArenaSource[],
  options: { now?: string; latencyMs?: number } = {},
): ArenaBattle {
  const createdAt = options.now || new Date().toISOString();
  const prepared = prepareArenaTurn(battle, side, rawResearchSources, createdAt);
  return finalizeArenaTurn(battle, side, prepared, {
    latencyMs: options.latencyMs,
    generatedTurn: mockResponseFromTrajectory(prepared.trajectoryDraft, side, prepared.roundNumber, battle),
    provider: prepared.activeProfile.provider,
    model: prepared.activeProfile.model,
    isMock: true,
  });
}

async function generateProviderTurnForPreparedArenaTurn(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  prepared: PreparedArenaTurn,
) {
  const agentConfig = buildProviderAgentConfig(battle);
  const provider = resolveProviderConfig(agentConfig, side, prepared.activeProfile.model);
  const bridge = resolveAgentBridgeConfig(agentConfig, side);
  const mockResponse = mockResponseFromTrajectory(prepared.trajectoryDraft, side, prepared.roundNumber, battle);
  const startedAt = Date.now();

  try {
    const bridgeResult = await generateWithAgentBridge({
      topic: battle.master_goal,
      history: reconstructArenaBattleReplay(battle),
      currentAgent: side,
      agentConfig,
      bridge,
      systemInstruction: providerSystemInstruction(prepared.activeProfile),
      conversationText: prepared.promptContext,
      defaultComplexity: battle.config.research_enabled ? "deep research" : "quick lookup",
    });

    if (bridgeResult) {
      return {
        generatedTurn: bridgeResult.parsedData,
        providerSearchSources: [],
        provider: `agent-bridge:${bridgeResult.bridge.kind}`,
        model: bridgeResult.bridge.label,
        providerMetadata: {
          provider_id: `agent-bridge:${bridgeResult.bridge.kind}`,
          model_id: bridgeResult.bridge.label,
          latency_ms: Math.max(0, Date.now() - startedAt),
          raw_response: {
            type: `agent-bridge.${bridgeResult.bridge.kind}`,
            preview: JSON.stringify({ kind: bridgeResult.bridge.kind, label: bridgeResult.bridge.label }).slice(0, 1200),
          },
        },
        isMock: false,
      };
    }

    const providerResult = await generateWithProvider({
      topic: battle.master_goal,
      history: reconstructArenaBattleReplay(battle),
      currentAgent: side,
      agentConfig,
      provider,
      useGrounding: battle.config.research_enabled,
      systemInstruction: providerSystemInstruction(prepared.activeProfile),
      conversationText: prepared.promptContext,
      defaultComplexity: battle.config.research_enabled ? "deep research" : "quick lookup",
      mockResponse,
      timeoutMs: battle.config.search_timeout_ms,
    });

    return {
      generatedTurn: providerResult.parsedData,
      providerSearchSources: providerResult.searchSources,
      provider: providerResult.provider.kind,
      model: providerResult.provider.model,
      providerMetadata: providerResult.providerMetadata,
      isMock: providerResult.isFallback,
    };
  } catch (err: any) {
    return {
      generatedTurn: mockResponse,
      providerSearchSources: [],
      provider: provider.kind,
      model: provider.model,
      providerMetadata: {
        provider_id: provider.kind,
        model_id: provider.model,
        latency_ms: Math.max(0, Date.now() - startedAt),
        raw_response: {
          type: "fallback.synthetic",
          preview: JSON.stringify({ reason: err?.message || "Provider request failed; local Arena Loop response was used." }).slice(0, 1200),
        },
      },
      isMock: true,
    };
  }
}

export function runArenaBattleTurn(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  options: { now?: string; latencyMs?: number } = {},
): ArenaBattle {
  const createdAt = options.now || new Date().toISOString();
  const rawResearchSources = battle.config.research_enabled
    ? collectMockResearchSources(battle, side, createdAt)
    : [];

  return runArenaBattleTurnFromSources(battle, side, rawResearchSources, {
    ...options,
    now: createdAt,
  });
}

export async function runArenaBattleTurnWithSearch(
  battle: ArenaBattle,
  side: ArenaLoopSide,
  options: { now?: string; latencyMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<ArenaBattle> {
  const createdAt = options.now || new Date().toISOString();
  const rawSources = !battle.config.research_enabled
    ? []
    : battle.config.search_provider === "mock"
      ? collectMockResearchSources(battle, side, createdAt)
      : await collectProviderResearchSources(battle, side, createdAt, resolveArenaSearchConfig({
        searchProvider: battle.config.search_provider,
        searchEndpointUrl: battle.config.search_endpoint_url,
        searchTimeoutMs: battle.config.search_timeout_ms,
      }), options.fetchImpl);
  const prepared = prepareArenaTurn(battle, side, rawSources, createdAt);
  const providerTurn = await generateProviderTurnForPreparedArenaTurn(battle, side, prepared);

  return finalizeArenaTurn(battle, side, prepared, {
    ...providerTurn,
    latencyMs: options.latencyMs ?? providerTurn.providerMetadata?.latency_ms,
  });
}

export function appendArenaBattleTurn(
  battle: ArenaBattle,
  turnPayload: Partial<DebateTurn>,
  side: ArenaLoopSide,
  options: {
    now?: string;
    latencyMs?: number;
    promptContextSnapshot?: string;
    provider?: string;
    model?: string;
    providerMetadata?: any;
    complete?: boolean;
  } = {},
): ArenaBattle {
  if (battle.status === "completed") {
    throw new ArenaLoopValidationError("Arena Loop battle is already completed.");
  }

  const createdAt = options.now || new Date().toISOString();
  const roundNumber = battle.turns.length + 1;
  const activeProfile = side === "agentA" ? battle.agent_a_profile : battle.agent_b_profile;
  const debateTurn: DebateTurn = {
    id: cleanString(turnPayload.id, `turn_${roundNumber}_${side}`, 160),
    sender: side,
    content: cleanString(turnPayload.content, "No argument content was provided.", 20000),
    type: normalizeTurnType(turnPayload.type),
    proposal: typeof turnPayload.proposal === "string" && turnPayload.proposal.trim() ? turnPayload.proposal.trim().slice(0, 1000) : undefined,
    convictionScore: clampScore(turnPayload.convictionScore, 50),
    timestamp: typeof turnPayload.timestamp === "string" && turnPayload.timestamp.trim() ? turnPayload.timestamp : createdAt,
    searchSources: Array.isArray(turnPayload.searchSources) ? turnPayload.searchSources : undefined,
    complexity: turnPayload.complexity,
    judgeEvaluation: turnPayload.judgeEvaluation,
    spectatorLiveReactions: turnPayload.spectatorLiveReactions,
  };
  const { nextSources, turnSources } = mergeArenaSources(battle, sourcesFromDebateTurn(debateTurn, createdAt));
  const promptContext = options.promptContextSnapshot || buildPromptContext({ ...battle, sources: nextSources }, side, roundNumber, turnSources);
  const structuredPoint = buildStructuredPointFromTurn(debateTurn, roundNumber, turnSources);
  const judgeAdapter = resolveArenaJudgeAdapter(battle.config.judging_mode);
  const score = judgeAdapter.judge(debateTurn);
  const roundWinner = roundWinnerFromScore(score, side);
  const argumentId = argumentAddress(roundNumber, side, 1);
  const memoryUpdate = `${argumentId}: ${structuredPoint.claim}`.slice(0, battle.config.limits.maxMemoryCharacters);
  const trajectoryDraft = buildExternalTurnTrajectoryDraft(battle, promptContext, debateTurn, structuredPoint.source_ids);
  const loopTrajectory: ArenaLoopTrajectory = {
    ...trajectoryDraft,
    final_scored_result: score,
    memory_updates: [memoryUpdate],
  };
  const storedTurn: ArenaStoredTurn = {
    id: debateTurn.id,
    battle_id: battle.id,
    round_number: roundNumber,
    side,
    round_winner: roundWinner,
    prompt_context_snapshot: promptContext,
    response: debateTurn.content,
    structured_points: [structuredPoint],
    source_ids_used: structuredPoint.source_ids,
    score,
    loop_trajectory: loopTrajectory,
    latency_ms: options.latencyMs ?? 0,
    usage_metadata: {
      provider: cleanString(options.provider, activeProfile.provider, 80),
      model: cleanString(options.model, activeProfile.model, 180),
      mock: activeProfile.provider === "mock",
      provider_runtime: normalizeProviderRuntimeMetadata(options.providerMetadata),
    },
    created_at: createdAt,
  };
  const storedArgument: ArenaStoredArgument = {
    id: argumentId,
    battle_id: battle.id,
    side,
    round: roundNumber,
    claim: structuredPoint.claim,
    reasoning: structuredPoint.reasoning,
    evidence: structuredPoint.source_ids.join(", "),
    target_argument_ids: structuredPoint.target_argument_ids,
    relation: structuredPoint.relation,
    source_ids: structuredPoint.source_ids,
    score,
    judge_notes: score.caveat,
  };
  const nextScores = {
    ...battle.final_scores,
    [side]: battle.final_scores[side] + score.impact,
  };
  const maxRounds = Math.max(1, battle.config.limits.maxLoopPasses * 2);
  const isComplete = Boolean(options.complete) || roundNumber >= maxRounds;
  const winner = isComplete
    ? Math.abs(nextScores.agentA - nextScores.agentB) < 8
      ? "tie"
      : nextScores.agentA > nextScores.agentB ? "agentA" : "agentB"
    : null;
  const researchEvents = turnSources.length ? [
    event("research.started", battle, createdAt, { sourceCount: turnSources.length }, side, roundNumber),
    event("research.completed", battle, createdAt, { sourceIds: turnSources.map((source) => source.id) }, side, roundNumber),
  ] : [];

  return {
    ...battle,
    updated_at: createdAt,
    status: isComplete ? "completed" : "running",
    winner,
    final_scores: nextScores,
    turns: [...battle.turns, storedTurn],
    arguments: [...battle.arguments, storedArgument],
    sources: nextSources,
    events: [
      ...battle.events,
      event("loop.started", battle, createdAt, undefined, side, roundNumber),
      ...researchEvents,
      event("turn.started", battle, createdAt, undefined, side, roundNumber),
      event("turn.completed", battle, createdAt, { turnId: storedTurn.id, argumentIds: [storedArgument.id], roundWinner }, side, roundNumber),
      event("judge.completed", battle, createdAt, { score, judgeAdapter: judgeAdapter.id }, side, roundNumber),
      event("loop.memory.updated", battle, createdAt, { memoryUpdate }, side, roundNumber),
      ...(isComplete ? [event("battle.completed", battle, createdAt, { winner }, side, roundNumber)] : []),
    ],
    loop_memory: [battle.loop_memory, memoryUpdate].filter(Boolean).join("\n").slice(-battle.config.limits.maxMemoryCharacters),
  };
}

export function updateArenaBattle(nextBattle: ArenaBattle, storeFile = DEFAULT_ARENA_LOOP_FILE) {
  const battles = readArenaBattles(storeFile);
  const index = battles.findIndex((battle) => battle.id === nextBattle.id);
  if (index === -1) {
    throw new ArenaLoopValidationError("Arena Loop battle was not found.");
  }
  battles[index] = nextBattle;
  writeArenaBattles(battles, storeFile);
  return nextBattle;
}

export function updateArenaBattleGoal(
  battle: ArenaBattle,
  payload: { master_goal?: unknown; masterGoal?: unknown; topic?: unknown; rubric?: unknown },
  options: { now?: string } = {},
): ArenaBattle {
  const nextGoal = cleanString(payload.master_goal || payload.masterGoal || payload.topic, battle.master_goal, 1000);
  if (!nextGoal) {
    throw new ArenaLoopValidationError("Arena Loop master_goal is required.");
  }

  const nextRubric = payload.rubric === undefined
    ? battle.rubric
    : cleanString(payload.rubric, battle.rubric, 1000);
  const goalChanged = nextGoal !== battle.master_goal;
  const rubricChanged = nextRubric !== battle.rubric;
  if (!goalChanged && !rubricChanged) return battle;

  const updatedAt = options.now || new Date().toISOString();
  return {
    ...battle,
    updated_at: updatedAt,
    master_goal: nextGoal,
    rubric: nextRubric,
    slug: goalChanged ? `${slugify(nextGoal)}-${battle.id.slice(-6)}` : battle.slug,
    events: [
      ...battle.events,
      event("battle.goal.updated", battle, updatedAt, {
        previous_master_goal: battle.master_goal,
        master_goal: nextGoal,
        previous_rubric: battle.rubric,
        rubric: nextRubric,
      }),
    ],
  };
}

function turnTypeFromRelation(relation?: string): DebateTurn["type"] {
  switch (relation) {
    case "supports":
      return "proposal";
    case "synthesizes":
      return "agreement";
    case "reframes":
    case "clarifies":
    case "concedes":
      return "rebuttal";
    case "attacks":
    default:
      return "critique";
  }
}

export function reconstructArenaBattleReplay(battle: ArenaBattle): DebateTurn[] {
  const sourceById = new Map(battle.sources.map((source) => [source.id, source]));
  return [...battle.turns]
    .sort((left, right) => left.round_number - right.round_number)
    .map((turn): DebateTurn => {
      const point = turn.structured_points[0];
      const roundWinner = storedTurnRoundWinner(turn);
      return {
        id: turn.id,
        sender: turn.side,
        content: turn.response,
        type: turnTypeFromRelation(point?.relation),
        proposal: point?.claim,
        convictionScore: Math.max(0, Math.min(100, turn.score.impact)),
        timestamp: turn.created_at,
        searchSources: turn.source_ids_used
          .map((sourceId) => sourceById.get(sourceId))
          .filter((source): source is ArenaSource => Boolean(source))
          .map((source) => ({ title: source.title, uri: source.url })),
        complexity: turn.source_ids_used.length ? "deep research" : "quick lookup",
        judgeEvaluation: {
          intellectScore: turn.score.relevance,
          precisionScore: turn.score.evidence,
          rhetoricScore: turn.score.clarity,
          isScoreGoal: roundWinner === turn.side,
          verdictComment: turn.score.caveat,
        },
      };
    });
}

function jsonl(rows: unknown[]) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
}

function buildPreferenceRows(battle: ArenaBattle) {
  return battle.turns.flatMap((turn) => {
    const candidates = turn.loop_trajectory.candidates || [];
    if (candidates.length < 2) return [];

    const selectedCandidate = candidates.find((candidate) => candidate.id === turn.loop_trajectory.selected_candidate_id)
      || [...candidates].sort((left, right) => right.expected_score - left.expected_score)[0];
    const nonPreferredCandidate = candidates
      .filter((candidate) => candidate.id !== selectedCandidate.id)
      .sort((left, right) => left.expected_score - right.expected_score)
      .find((candidate) => selectedCandidate.expected_score - candidate.expected_score >= 0.01);

    if (!nonPreferredCandidate) return [];

    const margin = Number((selectedCandidate.expected_score - nonPreferredCandidate.expected_score).toFixed(3));
    return [{
      comparison_scope: "same_turn_loop_candidates",
      input_context: turn.loop_trajectory.input_context,
      preferred_output: selectedCandidate.content,
      non_preferred_output: nonPreferredCandidate.content,
      judge_reason: "Same-turn candidate comparison from a bounded Arena Loop trajectory; scores are local preference signals, not ground truth.",
      margin,
      sample_weight: Number(Math.max(0.1, Math.min(1, margin * 5)).toFixed(2)),
      metadata: {
        battle_id: battle.id,
        turn_id: turn.id,
        round: turn.round_number,
        side: turn.side,
        preferred_candidate_id: selectedCandidate.id,
        non_preferred_candidate_id: nonPreferredCandidate.id,
        comparison_basis: "Candidates share the same prompt/context, side, and loop trajectory.",
        final_score: turn.score,
      },
    }];
  });
}

export function buildArenaBattleJsonlExport(battle: ArenaBattle, generatedAt = new Date().toISOString()) {
  const preferenceRows = buildPreferenceRows(battle);
  const files = {
    "events.jsonl": jsonl(battle.events),
    "arguments.jsonl": jsonl(battle.arguments),
    "sft.jsonl": jsonl(battle.turns.map((turn) => ({
      messages: [
        { role: "system", content: "You are an Arena Loop agent producing one structured debate move." },
        { role: "user", content: turn.prompt_context_snapshot },
        { role: "assistant", content: turn.response },
      ],
    }))),
    "weighted_sft.jsonl": jsonl(battle.turns.map((turn) => ({
      messages: [
        { role: "system", content: "You are an Arena Loop agent producing one structured debate move." },
        { role: "user", content: turn.prompt_context_snapshot },
        { role: "assistant", content: turn.response },
      ],
      metadata: {
        battle_id: battle.id,
        turn_id: turn.id,
        side: turn.side,
        round_winner: storedTurnRoundWinner(turn),
        provider: turn.usage_metadata.provider,
        model: turn.usage_metadata.model,
        latency_ms: turn.latency_ms,
        provider_runtime: turn.usage_metadata.provider_runtime,
        score: turn.score,
      },
      sample_weight: Number(Math.max(0.1, Math.min(1, turn.score.impact / 100)).toFixed(2)),
    }))),
    "preference_or_dpo_judge.jsonl": jsonl(preferenceRows),
    "loop_trajectories.jsonl": jsonl(battle.turns.map((turn) => ({
      battle_id: battle.id,
      turn_id: turn.id,
      round: turn.round_number,
      side: turn.side,
      round_winner: storedTurnRoundWinner(turn),
      usage_metadata: turn.usage_metadata,
      latency_ms: turn.latency_ms,
      ...turn.loop_trajectory,
    }))),
    "web_research.jsonl": jsonl(battle.sources),
  };
  const manifest = {
    schema_version: "arena-loop-battle-export-v1",
    battle_id: battle.id,
    created_at: battle.created_at,
    export_generated_at: generatedAt,
    row_counts: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, content.trim() ? content.trim().split(/\r?\n/).length : 0])),
    model_provider_metadata: {
      agentA: { provider: battle.agent_a_profile.provider, model: battle.agent_a_profile.model },
      agentB: { provider: battle.agent_b_profile.provider, model: battle.agent_b_profile.model },
      turns: battle.turns.map((turn) => ({
        turn_id: turn.id,
        side: turn.side,
        round_winner: storedTurnRoundWinner(turn),
        provider: turn.usage_metadata.provider,
        model: turn.usage_metadata.model,
        latency_ms: turn.latency_ms,
        mock: turn.usage_metadata.mock,
        provider_runtime: turn.usage_metadata.provider_runtime,
      })),
    },
    rubric_version: battle.config.judging_mode,
    caveats: [
      "Review web snippets/source data licensing before fine-tuning.",
      "Arena scores are preference signals, not ground truth.",
      "Preference/DPO rows are emitted only for comparable outputs; no fake pairs are generated.",
    ],
  };

  return { manifest, files };
}

export function buildArenaBattleResearchBundleZip(battle: ArenaBattle, generatedAt = new Date().toISOString()) {
  const exported = buildArenaBattleJsonlExport(battle, generatedAt);
  return buildZipBundle({
    "manifest.json": `${JSON.stringify(exported.manifest, null, 2)}\n`,
    ...exported.files,
  }, new Date(generatedAt));
}
