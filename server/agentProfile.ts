import { Agent } from "../src/types";

export function describeStrategyBias(strategyBias: string) {
  switch ((strategyBias || "balanced").trim().toLowerCase()) {
    case "cooperative":
      return "prioritize additive synthesis, shared framing, and finding usable common ground before escalating objections";
    case "socratic":
      return "ask focused diagnostic questions, expose hidden assumptions, and guide the opponent toward a clearer claim";
    case "rhetorical":
      return "use structured persuasion, crisp analogies, and audience-aware framing while preserving factual discipline";
    case "adversarial":
      return "red-team the opponent's claim, stress-test edge cases, and press hard on operational failure modes";
    default:
      return "balance critique, synthesis, and practical proposal building without over-indexing on one debate style";
  }
}

function clampPercent(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : fallback;
}

function clampUnit(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

export function buildAgentProfileInstruction(agent: Partial<Agent> = {}) {
  const competitiveDrive = clampPercent(agent.competitiveDrive, 50);
  const aggressiveness = clampPercent(agent.aggressiveness, 50);
  const empathy = clampPercent(agent.empathy, 50);
  const riskTolerance = clampUnit(agent.riskTolerance, 0.5);
  const collaborationBias = clampUnit(agent.collaborationBias, 0.5);
  const strategyBias = agent.debateStyle || agent.strategyBias || "balanced";
  const personality = (agent.personality || "balanced analytical operator").trim();
  const psychologyArchetype = (agent.psychologyArchetype || "operator").trim();
  const strategicTendencies = (agent.strategicTendencies || "Use concise claims, test assumptions, and keep pressure on unresolved issues.").trim();
  const safetyConstraints = (agent.safetyConstraints || "Never let personality, archetype, or win-drive override truthfulness, safety, evidence quality, the master goal, or valid schema compliance.").trim();

  return `\n\nYour active agent profile:
- PERSONALITY: ${personality}.
- PSYCHOLOGY ARCHETYPE: ${psychologyArchetype}.
- DEBATE STYLE: ${strategyBias} (${describeStrategyBias(strategyBias)}).
- WIN DRIVE: ${(competitiveDrive / 100).toFixed(2)} (${competitiveDrive}% competitive drive; higher values press harder to win the point and avoid conceding weakly).
- RISK TOLERANCE: ${riskTolerance.toFixed(2)} (higher values allow bolder hypotheses while still requiring evidence).
- COLLABORATION BIAS: ${collaborationBias.toFixed(2)} (higher values favor synthesis, concessions, and bridge-building when justified).
- AGGRESSIVENESS: ${aggressiveness}% (higher scores challenge claims immediately and stress-test failure modes).
- EMPATHY: ${empathy}% (higher scores actively listen, identify alignment, and keep critique constructive).
- STRATEGIC TENDENCIES: ${strategicTendencies}.
- SAFETY/TRUTHFULNESS CONSTRAINTS: ${safetyConstraints}
Personality, psychology archetype, and desire-to-win affect style and strategy, but they must not override truthfulness, safety, evidence quality, the master goal, or valid schema compliance.
Please adjust your tone, word choices, critique patterns, and agreement readiness to match this profile.`;
}

export function buildAgentPersonaInstruction(agent: Partial<Agent> = {}) {
  const activeSystemPrompt = agent.systemPrompt?.trim();
  if (!activeSystemPrompt) return "";
  return `\n\nCRITICAL CUSTOM INSTRUCTIONS: You must follow these agent-specific instructions while preserving the arena rules and schema: "${activeSystemPrompt}".`;
}
