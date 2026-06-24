import { Agent } from "../types";

export const CUSTOM_AGENT_LIBRARY_STORAGE_KEY = "cognitive-pong-custom-agent-library-v1";

export interface CustomAgentTemplate {
  id: string;
  createdAt: string;
  updatedAt: string;
  agent: Agent;
}

export const createBlankCustomAgent = (): Agent => ({
  name: "New Custom Agent",
  role: "Define this agent's stance, specialty, and competition role.",
  color: "cyan",
  avatar: "AI",
  provider: "mock",
  model: "mock-local",
  systemPrompt: "",
  personality: "balanced analytical operator",
  psychologyArchetype: "operator",
  debateStyle: "balanced",
  strategyBias: "balanced",
  competitiveDrive: 60,
  riskTolerance: 0.5,
  collaborationBias: 0.5,
  strategicTendencies: "",
  safetyConstraints: "Truthfulness, safety, evidence quality, and valid schema compliance override personality and win-drive.",
  temperature: 0.7,
  maxTokens: 1024,
  bridge: { kind: "none" },
});

export function cloneAgentForLibrary(agent: Agent): Agent {
  return {
    ...createBlankCustomAgent(),
    ...agent,
    bridge: agent.bridge ? { ...agent.bridge, args: agent.bridge.args ? [...agent.bridge.args] : undefined } : { kind: "none" },
  };
}

export function createCustomAgentTemplate(
  agent: Agent,
  options: { id?: string; now?: string; existing?: CustomAgentTemplate } = {},
): CustomAgentTemplate {
  const now = options.now || new Date().toISOString();
  return {
    id: options.id || options.existing?.id || `custom_agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: options.existing?.createdAt || now,
    updatedAt: now,
    agent: cloneAgentForLibrary(agent),
  };
}

export function parseCustomAgentLibrary(raw: string | null | undefined): CustomAgentTemplate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.id && item?.agent?.name)
      .map((item) => ({
        id: String(item.id),
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date(0).toISOString(),
        agent: cloneAgentForLibrary(item.agent),
      }));
  } catch {
    return [];
  }
}

export function upsertCustomAgentTemplate(
  library: CustomAgentTemplate[],
  template: CustomAgentTemplate,
): CustomAgentTemplate[] {
  const next = library.filter((item) => item.id !== template.id);
  return [template, ...next].slice(0, 50);
}

export function removeCustomAgentTemplate(library: CustomAgentTemplate[], id: string): CustomAgentTemplate[] {
  return library.filter((item) => item.id !== id);
}
