import {
  ArenaAdvancedSettings,
  ArenaMatchEngine,
  ArenaMemoryFabric,
  ArenaOptimizerMetric,
  ArenaPopulationRange,
  ArenaPromotionStandard,
  ArenaSandboxRules,
} from "../types";

type Option<T extends string> = {
  value: T;
  label: string;
  directive: string;
};

export const DEFAULT_ARENA_SETTINGS: ArenaAdvancedSettings = {
  matchEngine: "adversarial",
  populationRange: "8",
  memoryFabric: "m0_m4",
  sandboxRules: "sandboxed_read_only",
  optimizerMetric: "textgrad",
  promotionStandard: "frozen_baseline",
};

export const ARENA_MATCH_ENGINE_OPTIONS: Option<ArenaMatchEngine>[] = [
  {
    value: "adversarial",
    label: "CO-TRAINING TOURNEY (PBT)",
    directive: "Run the debate as an adversarial co-training tournament; reward clear critique, counterexamples, and robust synthesis.",
  },
  {
    value: "adversarial_curriculum",
    label: "CURRICULUM ESCALATION (POET)",
    directive: "Escalate task difficulty gradually; start with tractable constraints, then introduce harder edge cases as the exchange matures.",
  },
  {
    value: "safety_sandbox",
    label: "DPO REWARD MODELLING",
    directive: "Prioritize safety, refusal boundaries, and preference alignment; call out risks before optimizing speed or ambition.",
  },
  {
    value: "standard_debate",
    label: "CIVILIAN BENCHMARK COURT",
    directive: "Keep the debate plain, benchmark-like, and accessible; prefer practical decision criteria over tournament framing.",
  },
];

export const ARENA_POPULATION_OPTIONS: Option<ArenaPopulationRange>[] = [
  {
    value: "2",
    label: "2 MODERATED ACTIVE SYSTEMS",
    directive: "Treat the arena as a two-agent moderated exchange; keep evidence tied to the two visible paddles.",
  },
  {
    value: "8",
    label: "8 GENERATIONAL AGENTS",
    directive: "Simulate a small population review by considering several alternative strategies before committing.",
  },
  {
    value: "32",
    label: "32 TOURNAMENT POOLS (MASSIVE)",
    directive: "Stress-test claims as if many competing variants exist; require stronger generalization before scoring consensus.",
  },
];

export const ARENA_MEMORY_OPTIONS: Option<ArenaMemoryFabric>[] = [
  {
    value: "m0_m4",
    label: "VECTOR RAG + HOPFIELD MEMORY",
    directive: "Use current mission facts, retrieved evidence, and recurring debate patterns when forming claims.",
  },
  {
    value: "graphrag",
    label: "GRAPHRAG SEMANTIC NODES",
    directive: "Represent dependencies as graph-like relationships; highlight upstream and downstream impacts.",
  },
  {
    value: "vector_only",
    label: "STANDARD VECTOR RAG (M2)",
    directive: "Favor direct evidence retrieval and concise source-backed comparisons over speculative memory patterns.",
  },
  {
    value: "parametric_only",
    label: "EPISODIC REPLAY (M1) + PARAMETRIC",
    directive: "Reason from the conversation history and general model knowledge; avoid inventing external retrieval claims.",
  },
];

export const ARENA_SANDBOX_OPTIONS: Option<ArenaSandboxRules>[] = [
  {
    value: "sandboxed_read_only",
    label: "SANDBOXED READ-ONLY HARNESS",
    directive: "Assume execution is read-only and sandboxed; propose validation plans that avoid destructive operations.",
  },
  {
    value: "syntax_verify",
    label: "COMPILATION & DRY-RUNS ONLY",
    directive: "Constrain implementation claims to compilation, static checks, and dry-run verification.",
  },
  {
    value: "privileged_run",
    label: "PRIVILEGED EXECUTOR",
    directive: "Consider privileged execution risks explicitly; require safeguards before suggesting elevated operations.",
  },
];

export const ARENA_OPTIMIZER_OPTIONS: Option<ArenaOptimizerMetric>[] = [
  {
    value: "textgrad",
    label: "TEXTGRAD / DSPY AUTO-DIFF",
    directive: "Optimize prompts and claims through explicit textual gradients: identify the weakness and propose a sharper revision.",
  },
  {
    value: "prompt_mutate",
    label: "EVOLUTIONARY PROMPT MUTATOR",
    directive: "Explore multiple mutated alternatives and select the strongest variant with a short justification.",
  },
  {
    value: "rlhf",
    label: "MOCK REWARD SFT GRADIENTS",
    directive: "Score responses against user preference and clarity; prefer helpful, stable, low-regret answers.",
  },
];

export const ARENA_PROMOTION_OPTIONS: Option<ArenaPromotionStandard>[] = [
  {
    value: "frozen_baseline",
    label: "BEAT DEPLOYED COLD BASELINE",
    directive: "Only promote a proposal when it clearly improves on a conservative baseline.",
  },
  {
    value: "absolute_90",
    label: "ELITE RATING THRESHOLD >90%",
    directive: "Do not mark consensus unless confidence is very high and objections are directly resolved.",
  },
  {
    value: "mutual_consensus",
    label: "CROSS-AGENT MUTUAL CONSENSUS",
    directive: "Require both sides to acknowledge the shared decision path before treating a milestone as locked.",
  },
];

export function normalizeArenaSettings(raw?: Partial<ArenaAdvancedSettings> | null): ArenaAdvancedSettings {
  const select = <T extends string>(options: Option<T>[], rawValue: unknown, fallback: T): T => (
    options.some((option) => option.value === rawValue) ? rawValue as T : fallback
  );

  return {
    matchEngine: select(ARENA_MATCH_ENGINE_OPTIONS, raw?.matchEngine, DEFAULT_ARENA_SETTINGS.matchEngine),
    populationRange: select(ARENA_POPULATION_OPTIONS, raw?.populationRange, DEFAULT_ARENA_SETTINGS.populationRange),
    memoryFabric: select(ARENA_MEMORY_OPTIONS, raw?.memoryFabric, DEFAULT_ARENA_SETTINGS.memoryFabric),
    sandboxRules: select(ARENA_SANDBOX_OPTIONS, raw?.sandboxRules, DEFAULT_ARENA_SETTINGS.sandboxRules),
    optimizerMetric: select(ARENA_OPTIMIZER_OPTIONS, raw?.optimizerMetric, DEFAULT_ARENA_SETTINGS.optimizerMetric),
    promotionStandard: select(ARENA_PROMOTION_OPTIONS, raw?.promotionStandard, DEFAULT_ARENA_SETTINGS.promotionStandard),
  };
}

function directiveFor<T extends string>(options: Option<T>[], value: T) {
  return options.find((option) => option.value === value)?.directive || "";
}

export function buildArenaSettingsInstruction(raw?: Partial<ArenaAdvancedSettings> | null) {
  const settings = normalizeArenaSettings(raw);

  return [
    "",
    "ADVANCED ARENA SETTINGS:",
    `- Match engine (${settings.matchEngine}): ${directiveFor(ARENA_MATCH_ENGINE_OPTIONS, settings.matchEngine)}`,
    `- Population range (${settings.populationRange}): ${directiveFor(ARENA_POPULATION_OPTIONS, settings.populationRange)}`,
    `- Memory fabric (${settings.memoryFabric}): ${directiveFor(ARENA_MEMORY_OPTIONS, settings.memoryFabric)}`,
    `- Sandbox rules (${settings.sandboxRules}): ${directiveFor(ARENA_SANDBOX_OPTIONS, settings.sandboxRules)}`,
    `- Optimizer metric (${settings.optimizerMetric}): ${directiveFor(ARENA_OPTIMIZER_OPTIONS, settings.optimizerMetric)}`,
    `- Promotion standard (${settings.promotionStandard}): ${directiveFor(ARENA_PROMOTION_OPTIONS, settings.promotionStandard)}`,
    "Treat these settings as active runtime constraints when shaping content, confidence, critiques, and milestone readiness.",
  ].join("\n");
}
