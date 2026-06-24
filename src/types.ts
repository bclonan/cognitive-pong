export type ProviderKind =
  | "mock"
  | "gemini"
  | "openai-compatible"
  | "ollama"
  | "anthropic"
  | "huggingface"
  | "custom-http";

export type AgentBridgeKind = "none" | "http" | "websocket" | "cli" | "codex-cli" | "mcp";

export interface AgentBridgeConfig {
  kind: AgentBridgeKind;
  label?: string;
  endpointUrl?: string;
  profileId?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  apiKey?: string;
  toolName?: string;
  timeoutMs?: number;
}

export interface Agent {
  name: string;
  role: string;
  color: string; // Tailwind color class or hex string
  avatar: string; // Emoji or short description
  personality?: string;
  psychologyArchetype?: "skeptic" | "visionary" | "operator" | "researcher" | "synthesizer" | "safety";
  debateStyle?: "cooperative" | "socratic" | "rhetorical" | "adversarial" | "balanced";
  riskTolerance?: number; // range: 0.0 - 1.0
  collaborationBias?: number; // range: 0.0 - 1.0
  strategicTendencies?: string;
  safetyConstraints?: string;
  provider?: ProviderKind;
  bridge?: AgentBridgeConfig;
  endpointUrl?: string;
  customModel?: string;
  customApiKey?: string;
  model?: string;
  systemPrompt?: string; // Custom system instruction/persona prompt
  temperature?: number; // range: 0.0 - 1.5
  maxTokens?: number; // range: 128 - 2048
  competitiveDrive?: number; // range: 0 - 100
  strategyBias?: "cooperative" | "socratic" | "rhetorical" | "adversarial" | "balanced";
  aggressiveness?: number; // range: 0 - 100
  empathy?: number; // range: 0 - 100
}

export type ArenaMatchEngine = "adversarial" | "adversarial_curriculum" | "safety_sandbox" | "standard_debate";
export type ArenaPopulationRange = "2" | "8" | "32";
export type ArenaMemoryFabric = "m0_m4" | "graphrag" | "vector_only" | "parametric_only";
export type ArenaSandboxRules = "sandboxed_read_only" | "syntax_verify" | "privileged_run";
export type ArenaOptimizerMetric = "textgrad" | "prompt_mutate" | "rlhf";
export type ArenaPromotionStandard = "frozen_baseline" | "absolute_90" | "mutual_consensus";
export type ArenaSearchProvider = "mock" | "brave" | "tavily" | "searxng";
export type ArenaJudgingMode = "local-deterministic";

export interface ArenaAdvancedSettings {
  matchEngine: ArenaMatchEngine;
  populationRange: ArenaPopulationRange;
  memoryFabric: ArenaMemoryFabric;
  sandboxRules: ArenaSandboxRules;
  optimizerMetric: ArenaOptimizerMetric;
  promotionStandard: ArenaPromotionStandard;
}

export interface ArenaLoopRuntimeSettings {
  maxLoopPasses: number;
  maxCandidatesPerPass: number;
  maxQueriesPerTurn: number;
  maxSourcesPerTurn: number;
  maxSourceExcerptLength: number;
  maxMemoryCharacters: number;
  searchProvider: ArenaSearchProvider;
  searchEndpointUrl?: string;
  searchTimeoutMs: number;
  judgingMode: ArenaJudgingMode;
}

export interface AgentConfig {
  agentA: Agent;
  agentB: Agent;
  bridge?: AgentBridgeConfig;
  useGrounding: boolean;
  baseSpeed: number; // multiplier
  model: string;
  defaultComplexity?: "auto" | "quick lookup" | "deep research" | "complex simulation";
  arenaSettings?: ArenaAdvancedSettings;
  arenaLoop?: ArenaLoopRuntimeSettings;
}

export type TurnSender = "agentA" | "agentB" | "moderator";

export interface DebateTurn {
  id: string;
  sender: TurnSender;
  content: string;
  type: "proposal" | "critique" | "rebuttal" | "agreement";
  proposal?: string;
  convictionScore: number;
  timestamp: string;
  searchSources?: Array<{ title: string; uri: string }>;
  complexity?: "quick lookup" | "deep research" | "complex simulation";
  judgeEvaluation?: {
    intellectScore: number;
    precisionScore: number;
    rhetoricScore: number;
    isScoreGoal: boolean;
    verdictComment: string;
    pivotingDirective?: string;
  };
  spectatorLiveReactions?: Array<{
    spectatorName: string;
    avatar: string;
    comment: string;
  }>;
}

export interface FinalizedTask {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  approvedBy: string;
  timestamp: string;
  complexity?: "quick lookup" | "deep research" | "complex simulation";
  influencedByTurnId?: string;
}

export interface ArenaBattleClientState {
  id: string;
  slug?: string;
  master_goal?: string;
  rubric?: string;
  status?: string;
  winner?: "agentA" | "agentB" | "tie" | null;
  final_scores?: { agentA: number; agentB: number };
  updated_at?: string;
  turns?: unknown[];
  arguments?: unknown[];
  events?: unknown[];
  sources?: unknown[];
}

export interface PresetScenario {
  title: string;
  topic: string;
  agentA: Agent;
  agentB: Agent;
}
