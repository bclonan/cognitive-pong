import { Agent, ProviderKind } from "../types";

export type ModelOption = { value: string; label: string };

export const PROVIDER_OPTIONS: Array<{ value: ProviderKind; label: string }> = [
  { value: "mock", label: "Mock local (no API key)" },
  { value: "openai-compatible", label: "OpenAI / ChatGPT compatible" },
  { value: "ollama", label: "Ollama local URL" },
  { value: "gemini", label: "Gemini API" },
  { value: "anthropic", label: "Anthropic-style API" },
  { value: "huggingface", label: "Hugging Face endpoint" },
  { value: "custom-http", label: "Custom HTTP adapter" },
];

export const MODEL_OPTIONS_BY_PROVIDER: Record<ProviderKind, ModelOption[]> = {
  mock: [
    { value: "mock-local", label: "mock-local (offline mock)" },
  ],
  "openai-compatible": [
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ],
  ollama: [
    { value: "llama3", label: "llama3 (Ollama local)" },
    { value: "llama3.1", label: "llama3.1 (Ollama local)" },
    { value: "mistral", label: "mistral (Ollama local)" },
    { value: "qwen2.5", label: "qwen2.5 (Ollama local)" },
  ],
  gemini: [
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  ],
  anthropic: [
    { value: "claude-3-5-haiku-latest", label: "Claude Haiku latest" },
    { value: "claude-3-5-sonnet-latest", label: "Claude Sonnet latest" },
  ],
  huggingface: [
    { value: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct" },
    { value: "meta-llama/Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B" },
    { value: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen2.5 7B" },
  ],
  "custom-http": [
    { value: "custom-model", label: "custom-model (sent to your HTTP adapter)" },
  ],
};

export const MODEL_OPTIONS: ModelOption[] = Array.from(
  new Map(
    Object.values(MODEL_OPTIONS_BY_PROVIDER)
      .flat()
      .map((option) => [option.value, option])
  ).values()
);

export const modelPlaceholder = (provider?: string) => {
  switch (provider) {
    case "mock":
      return "mock-local";
    case "ollama":
      return "llama3";
    case "anthropic":
      return "claude-3-5-haiku-latest";
    case "huggingface":
      return "mistralai/Mistral-7B-Instruct-v0.3";
    case "gemini":
      return "gemini-3.5-flash";
    case "custom-http":
      return "custom-model";
    default:
      return "gpt-4o-mini";
  }
};

export const endpointPlaceholder = (provider?: string, model?: string) => {
  switch (provider) {
    case "ollama":
      return "http://localhost:11434";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "huggingface": {
      const targetModel = model?.trim() || modelPlaceholder(provider);
      return `https://api-inference.huggingface.co/models/${targetModel}`;
    }
    case "custom-http":
      return "http://localhost:8787/cognitive-pong";
    default:
      return "https://api.openai.com/v1";
  }
};

export const modelOptionsForProvider = (provider?: string, currentModel?: string): ModelOption[] => {
  const options = MODEL_OPTIONS_BY_PROVIDER[(provider as ProviderKind) || "mock"] || MODEL_OPTIONS_BY_PROVIDER.mock;
  if (!currentModel || options.some((option) => option.value === currentModel)) {
    return options;
  }
  return [{ value: currentModel, label: `${currentModel} (current)` }, ...options];
};

export const resolveAgentModelSelection = (agent: Partial<Agent> = {}, globalModel?: string) => {
  const provider = agent.provider || "mock";
  const agentModel = agent.model?.trim();
  if (agentModel) return agentModel;

  const fallbackGlobal = globalModel?.trim();
  if (provider === "mock" && fallbackGlobal) return fallbackGlobal;

  return modelPlaceholder(provider);
};

export const providerNeedsEndpoint = (provider?: string) => {
  return !!provider && provider !== "mock" && provider !== "gemini";
};

export const providerNeedsApiKey = (provider?: string) => {
  return !!provider && provider !== "mock" && provider !== "ollama";
};

export const providerTokenPlaceholder = (provider?: string) => {
  switch (provider) {
    case "openai-compatible":
      return "sk-... or compatible provider token";
    case "anthropic":
      return "Anthropic API key";
    case "gemini":
      return "Gemini API key";
    case "huggingface":
      return "hf_...";
    case "custom-http":
      return "optional bearer token";
    default:
      return "optional";
  }
};

export const resolvedEndpointLabel = (provider?: string, endpointUrl?: string, model?: string) => {
  const configuredEndpoint = endpointUrl?.trim();
  if (configuredEndpoint) return configuredEndpoint;
  if (!providerNeedsEndpoint(provider)) return "Managed by provider";
  return `${endpointPlaceholder(provider, model)} (default)`;
};

export function applyAgentTemplatePreservingRuntime(template: Agent, currentAgent: Agent): Agent {
  return {
    ...template,
    provider: currentAgent.provider,
    bridge: currentAgent.bridge,
    endpointUrl: currentAgent.endpointUrl,
    customModel: currentAgent.customModel,
    customApiKey: currentAgent.customApiKey,
    model: currentAgent.model,
    temperature: currentAgent.temperature,
    maxTokens: currentAgent.maxTokens,
  };
}

export function applyAgentProviderSelection(agent: Agent, provider: ProviderKind): Agent {
  return {
    ...agent,
    provider,
    model: modelPlaceholder(provider),
    customModel: "",
    endpointUrl: "",
    customApiKey: "",
  };
}

export function applyAgentModelSelection(agent: Agent, model: string): Agent {
  return {
    ...agent,
    model,
    customModel: "",
  };
}
