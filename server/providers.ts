export type ProviderKind =
  | "mock"
  | "gemini"
  | "openai-compatible"
  | "ollama"
  | "anthropic"
  | "huggingface"
  | "custom-http";

export interface ProviderConfig {
  kind: ProviderKind;
  label: string;
  endpointUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderRequest {
  topic: string;
  history: any[];
  currentAgent: "agentA" | "agentB";
  agentConfig: any;
  provider: ProviderConfig;
  useGrounding: boolean;
  systemInstruction: string;
  conversationText: string;
  defaultComplexity: string;
  mockResponse: any;
  timeoutMs?: number;
}

export interface ProviderRuntimeMetadata {
  provider_id: ProviderKind;
  model_id?: string;
  latency_ms: number;
  token_usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  cost_estimate_usd?: number;
  raw_response?: {
    type: string;
    preview: string;
    finish_reason?: string;
  };
}

export interface ProviderResult {
  parsedData: any;
  searchSources: Array<{ title: string; uri: string }>;
  isFallback: boolean;
  fallbackReason: string | null;
  provider: ProviderConfig;
  providerMetadata: ProviderRuntimeMetadata;
}

const MOCK_DEFAULT_MODEL = "mock-local";
const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
const OPENAI_COMPATIBLE_DEFAULT_MODEL = "gpt-4o-mini";
const OLLAMA_DEFAULT_MODEL = "llama3";
const ANTHROPIC_DEFAULT_MODEL = "claude-3-5-haiku-latest";
const HUGGINGFACE_DEFAULT_MODEL = "mistralai/Mistral-7B-Instruct-v0.3";

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim();
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function providerTimeoutMs(request: ProviderRequest, fallbackMs: number) {
  return Math.round(clampNumber(request.timeoutMs, fallbackMs, 1000, 30000));
}

function providerAbortSignal(request: ProviderRequest, fallbackMs: number) {
  return AbortSignal.timeout(providerTimeoutMs(request, fallbackMs));
}

function withProviderTimeout<T>(promise: Promise<T>, request: ProviderRequest, fallbackMs: number): Promise<T> {
  const timeoutMs = providerTimeoutMs(request, fallbackMs);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${request.provider.label} timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function defaultModelForProvider(kind: ProviderKind) {
  switch (kind) {
    case "mock":
      return MOCK_DEFAULT_MODEL;
    case "gemini":
      return GEMINI_DEFAULT_MODEL;
    case "ollama":
      return OLLAMA_DEFAULT_MODEL;
    case "openai-compatible":
      return OPENAI_COMPATIBLE_DEFAULT_MODEL;
    case "anthropic":
      return ANTHROPIC_DEFAULT_MODEL;
    case "huggingface":
      return HUGGINGFACE_DEFAULT_MODEL;
    default:
      return undefined;
  }
}

export function normalizeProviderKind(rawProvider?: string | null): ProviderKind {
  const provider = (rawProvider || "").trim().toLowerCase().replace(/_/g, "-");
  switch (provider) {
    case "":
    case "mock":
    case "demo":
    case "synthetic":
      return "mock";
    case "gemini":
    case "google":
    case "google-gemini":
      return "gemini";
    case "ollama":
    case "local-ollama":
      return "ollama";
    case "openai":
    case "custom-openai":
    case "openai-compatible":
    case "openai-compatible-api":
      return "openai-compatible";
    case "anthropic":
    case "claude":
    case "anthropic-compatible":
      return "anthropic";
    case "hf":
    case "huggingface":
    case "hugging-face":
      return "huggingface";
    case "custom":
    case "custom-http":
    case "http":
      return "custom-http";
    default:
      return "custom-http";
  }
}

export function resolveProviderConfig(
  agentConfig: any,
  currentAgent: "agentA" | "agentB",
  requestModel?: string
): ProviderConfig {
  const agent = currentAgent === "agentA" ? agentConfig?.agentA : agentConfig?.agentB;
  const rawProvider = firstNonEmpty(
    agent?.provider,
    agentConfig?.provider,
    process.env.COGNITIVE_PONG_DEFAULT_PROVIDER,
    process.env.AI_PROVIDER,
    "mock"
  );
  const kind = normalizeProviderKind(rawProvider);
  const endpointUrl = firstNonEmpty(
    agent?.endpointUrl,
    agentConfig?.endpointUrl,
    kind === "ollama" ? process.env.OLLAMA_BASE_URL : undefined,
    kind === "openai-compatible" ? process.env.OPENAI_BASE_URL : undefined,
    kind === "anthropic" ? process.env.ANTHROPIC_BASE_URL : undefined,
    kind === "huggingface" ? process.env.HUGGINGFACE_ENDPOINT_URL : undefined,
    kind === "custom-http" ? process.env.CUSTOM_PROVIDER_URL : undefined
  );
  const apiKey = firstNonEmpty(
    agent?.customApiKey,
    agentConfig?.customApiKey,
    kind === "gemini" ? process.env.GEMINI_API_KEY : undefined,
    kind === "openai-compatible" ? process.env.OPENAI_API_KEY : undefined,
    kind === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined,
    kind === "huggingface" ? process.env.HUGGINGFACE_API_KEY : undefined,
    kind === "custom-http" ? process.env.CUSTOM_PROVIDER_API_KEY : undefined
  );
  const requestedModel = firstNonEmpty(
    agent?.customModel,
    agent?.model,
    requestModel,
    agentConfig?.model
  );
  const providerDefaultModel = defaultModelForProvider(kind);
  const model = kind !== "mock" && requestedModel === MOCK_DEFAULT_MODEL
    ? providerDefaultModel
    : firstNonEmpty(requestedModel, providerDefaultModel);
  const temperature = clampNumber(agent?.temperature, 0.7, 0, 2);
  const maxTokens = Math.round(clampNumber(agent?.maxTokens, 1024, 128, 4096));

  return {
    kind,
    label: rawProvider || kind,
    endpointUrl,
    apiKey,
    model,
    temperature,
    maxTokens
  };
}

export function ensureChatCompletionEndpoint(url: string) {
  const normalized = url.replace(/\/$/, "");
  if (
    normalized.endsWith("/v1/chat/completions") ||
    normalized.endsWith("/chat/completions") ||
    normalized.includes("/api/")
  ) {
    return normalized;
  }
  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
}

function extractJsonText(rawText: string) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z-]*\s*/, "").replace(/\s*```$/, "");
  }
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  return cleaned;
}

function clampConviction(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric)));
}

function turnTypeFromArenaRelation(relation?: string): "proposal" | "critique" | "rebuttal" | "agreement" {
  switch ((relation || "").trim().toLowerCase()) {
    case "attacks":
      return "critique";
    case "reframes":
    case "clarifies":
      return "rebuttal";
    case "concedes":
    case "synthesizes":
      return "agreement";
    default:
      return "proposal";
  }
}

function parseArenaStructuredResponse(parsed: any, defaultComplexity: string) {
  const points = Array.isArray(parsed.points) ? parsed.points : [];
  const firstPoint = points[0] || {};
  const pointLines = points.map((point: any, index: number) => {
    const sourceIds = Array.isArray(point.source_ids) ? point.source_ids.join(", ") : "";
    return [
      `Point ${index + 1}: ${point.claim || "Unspecified claim."}`,
      point.reasoning ? `Reasoning: ${point.reasoning}` : "",
      point.relation ? `Relation: ${point.relation}` : "",
      sourceIds ? `Sources: ${sourceIds}` : "",
    ].filter(Boolean).join("\n");
  });

  return {
    content: [
      parsed.thesis ? `Thesis: ${parsed.thesis}` : "Thesis: Arena move.",
      parsed.strategy ? `Strategy: ${parsed.strategy}` : "",
      ...pointLines,
    ].filter(Boolean).join("\n\n"),
    type: turnTypeFromArenaRelation(firstPoint.relation),
    proposal: typeof parsed.thesis === "string" ? parsed.thesis : (firstPoint.claim || ""),
    convictionScore: clampConviction(parsed.confidence ?? firstPoint.expected_impact),
    complexity: parsed.complexity || (defaultComplexity !== "auto" ? defaultComplexity : "deep research"),
    judgeEvaluation: undefined,
    spectatorLiveReactions: undefined,
    arenaStructuredResponse: {
      thesis: typeof parsed.thesis === "string" ? parsed.thesis : "",
      strategy: typeof parsed.strategy === "string" ? parsed.strategy : "",
      confidence: parsed.confidence,
      points,
    },
  };
}

export function parseProviderText(rawText: string, defaultComplexity: string) {
  try {
    const extParsed = JSON.parse(extractJsonText(rawText));
    if (extParsed?.thesis || Array.isArray(extParsed?.points)) {
      return parseArenaStructuredResponse(extParsed, defaultComplexity);
    }
    return {
      content: extParsed.content || "Analyzed state.",
      type: extParsed.type || "critique",
      proposal: extParsed.proposal || "",
      convictionScore: typeof extParsed.convictionScore === "number" ? clampConviction(extParsed.convictionScore) : 50,
      complexity: extParsed.complexity || (defaultComplexity !== "auto" ? defaultComplexity : "quick lookup"),
      judgeEvaluation: extParsed.judgeEvaluation || undefined,
      spectatorLiveReactions: Array.isArray(extParsed.spectatorLiveReactions) ? extParsed.spectatorLiveReactions : undefined,
      arenaStructuredResponse: undefined,
    };
  } catch {
    return {
      content: rawText || "Analyzed state.",
      type: "critique",
      proposal: "",
      convictionScore: 50,
      complexity: defaultComplexity !== "auto" ? defaultComplexity : "quick lookup",
      judgeEvaluation: undefined,
      spectatorLiveReactions: undefined,
      arenaStructuredResponse: undefined,
    };
  }
}

function optionalAuthHeaders(apiKey?: string, scheme = "Bearer") {
  return apiKey ? { Authorization: `${scheme} ${apiKey}` } : {};
}

function compactJsonPreview(value: unknown, maxLength = 1200) {
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value).slice(0, maxLength);
  }
}

function providerMetadata(
  provider: ProviderConfig,
  overrides: Partial<Omit<ProviderRuntimeMetadata, "provider_id" | "latency_ms">> = {},
): ProviderRuntimeMetadata {
  return {
    provider_id: provider.kind,
    model_id: provider.model,
    latency_ms: 0,
    ...overrides,
  };
}

function usageFromOpenAICompatible(raw: any) {
  const usage = raw?.usage;
  if (!usage) return undefined;
  return {
    prompt_tokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
    completion_tokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined,
    total_tokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
  };
}

function usageFromAnthropic(raw: any) {
  const usage = raw?.usage;
  if (!usage) return undefined;
  return {
    prompt_tokens: typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
    completion_tokens: typeof usage.output_tokens === "number" ? usage.output_tokens : undefined,
    total_tokens: typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number"
      ? usage.input_tokens + usage.output_tokens
      : undefined,
  };
}

function usageFromGemini(raw: any) {
  const usage = raw?.usageMetadata;
  if (!usage) return undefined;
  return {
    prompt_tokens: typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : undefined,
    completion_tokens: typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : undefined,
    total_tokens: typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : undefined,
  };
}

function withLatency(result: ProviderResult, startedAt: number): ProviderResult {
  return {
    ...result,
    providerMetadata: {
      ...result.providerMetadata,
      latency_ms: Math.max(0, Date.now() - startedAt),
    },
  };
}

async function callOpenAICompatible(request: ProviderRequest): Promise<ProviderResult> {
  const targetUrl = ensureChatCompletionEndpoint(
    request.provider.endpointUrl ||
      (request.provider.kind === "ollama" ? "http://localhost:11434/v1/chat/completions" : "https://api.openai.com/v1/chat/completions")
  );
  const model = request.provider.model || (request.provider.kind === "ollama" ? OLLAMA_DEFAULT_MODEL : OPENAI_COMPATIBLE_DEFAULT_MODEL);

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...optionalAuthHeaders(request.provider.apiKey)
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: request.systemInstruction },
        { role: "user", content: request.conversationText }
      ],
      response_format: { type: "json_object" },
      temperature: request.provider.temperature ?? 0.7,
      max_tokens: request.provider.maxTokens ?? 1024
    }),
    signal: providerAbortSignal(request, 12000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${request.provider.label} returned [${response.status}]: ${errorText || response.statusText}`);
  }

  const resJson = await response.json() as any;
  const rawText = resJson.choices?.[0]?.message?.content || JSON.stringify(resJson);
  const finishReason = resJson.choices?.[0]?.finish_reason;
  return {
    parsedData: parseProviderText(rawText, request.defaultComplexity),
    searchSources: [],
    isFallback: false,
    fallbackReason: null,
    provider: request.provider,
    providerMetadata: providerMetadata(request.provider, {
      token_usage: usageFromOpenAICompatible(resJson),
      raw_response: {
        type: request.provider.kind === "ollama" ? "ollama.openai-compatible.chat" : "openai-compatible.chat",
        preview: compactJsonPreview({
          id: resJson.id,
          object: resJson.object,
          model: resJson.model,
          usage: resJson.usage,
          finish_reason: finishReason,
        }),
        finish_reason: typeof finishReason === "string" ? finishReason : undefined,
      },
    })
  };
}

export function buildGeminiGenerateConfig(request: ProviderRequest, Type: any) {
  const config: any = {
    systemInstruction: request.systemInstruction,
    responseMimeType: "application/json",
    temperature: request.provider.temperature ?? 0.7,
    maxOutputTokens: request.provider.maxTokens ?? 1024,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        type: { type: Type.STRING },
        proposal: { type: Type.STRING },
        convictionScore: { type: Type.INTEGER },
        complexity: { type: Type.STRING, enum: ["quick lookup", "deep research", "complex simulation"] },
        judgeEvaluation: {
          type: Type.OBJECT,
          properties: {
            intellectScore: { type: Type.INTEGER },
            precisionScore: { type: Type.INTEGER },
            rhetoricScore: { type: Type.INTEGER },
            isScoreGoal: { type: Type.BOOLEAN },
            verdictComment: { type: Type.STRING },
            pivotingDirective: { type: Type.STRING }
          }
        },
        spectatorLiveReactions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              spectatorName: { type: Type.STRING },
              avatar: { type: Type.STRING },
              comment: { type: Type.STRING }
            }
          }
        }
      },
      required: ["content", "type", "convictionScore", "complexity"]
    }
  };

  if (request.useGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  return config;
}

async function callGemini(request: ProviderRequest): Promise<ProviderResult> {
  if (!request.provider.apiKey) {
    throw new Error("Gemini provider selected but GEMINI_API_KEY or agent custom API key is not configured.");
  }

  const { GoogleGenAI, Type } = await import("@google/genai");
  const client = new GoogleGenAI({
    apiKey: request.provider.apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "cognitive-pong"
      }
    }
  });
  const config = buildGeminiGenerateConfig(request, Type);

  const response = await withProviderTimeout(client.models.generateContent({
    model: request.provider.model || GEMINI_DEFAULT_MODEL,
    contents: request.conversationText,
    config
  }), request, 15000);

  const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title || "Search Result",
    uri: chunk.web?.uri || "#"
  })) || [];

  return {
    parsedData: parseProviderText(response.text || "{}", request.defaultComplexity),
    searchSources,
    isFallback: false,
    fallbackReason: null,
    provider: request.provider,
    providerMetadata: providerMetadata(request.provider, {
      token_usage: usageFromGemini(response as any),
      raw_response: {
        type: "gemini.generateContent",
        preview: compactJsonPreview({
          model: request.provider.model || GEMINI_DEFAULT_MODEL,
          usageMetadata: (response as any).usageMetadata,
          candidateCount: response.candidates?.length || 0,
        }),
        finish_reason: response.candidates?.[0]?.finishReason,
      },
    })
  };
}

async function callAnthropic(request: ProviderRequest): Promise<ProviderResult> {
  if (!request.provider.apiKey) {
    throw new Error("Anthropic provider selected but ANTHROPIC_API_KEY or agent custom API key is not configured.");
  }
  const targetUrl = request.provider.endpointUrl || "https://api.anthropic.com/v1/messages";
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": request.provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: request.provider.model || ANTHROPIC_DEFAULT_MODEL,
      max_tokens: request.provider.maxTokens ?? 1024,
      temperature: request.provider.temperature ?? 0.7,
      system: request.systemInstruction,
      messages: [{ role: "user", content: request.conversationText }]
    }),
    signal: providerAbortSignal(request, 15000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic provider returned [${response.status}]: ${errorText || response.statusText}`);
  }

  const body = await response.json() as any;
  const rawText = body.content?.find((part: any) => part.type === "text")?.text || JSON.stringify(body);
  return {
    parsedData: parseProviderText(rawText, request.defaultComplexity),
    searchSources: [],
    isFallback: false,
    fallbackReason: null,
    provider: request.provider,
    providerMetadata: providerMetadata(request.provider, {
      token_usage: usageFromAnthropic(body),
      raw_response: {
        type: "anthropic.messages",
        preview: compactJsonPreview({
          id: body.id,
          model: body.model,
          stop_reason: body.stop_reason,
          usage: body.usage,
        }),
        finish_reason: typeof body.stop_reason === "string" ? body.stop_reason : undefined,
      },
    })
  };
}

async function callHuggingFace(request: ProviderRequest): Promise<ProviderResult> {
  const model = request.provider.model || HUGGINGFACE_DEFAULT_MODEL;
  const targetUrl = request.provider.endpointUrl || `https://api-inference.huggingface.co/models/${model}`;
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...optionalAuthHeaders(request.provider.apiKey)
    },
    body: JSON.stringify({
      inputs: `${request.systemInstruction}\n\n${request.conversationText}`,
      parameters: {
        temperature: request.provider.temperature ?? 0.7,
        max_new_tokens: request.provider.maxTokens ?? 1024,
        return_full_text: false
      }
    }),
    signal: providerAbortSignal(request, 20000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face provider returned [${response.status}]: ${errorText || response.statusText}`);
  }

  const body = await response.json() as any;
  const rawText = Array.isArray(body)
    ? body[0]?.generated_text || body[0]?.summary_text || JSON.stringify(body)
    : body.generated_text || body.text || JSON.stringify(body);

  return {
    parsedData: parseProviderText(rawText, request.defaultComplexity),
    searchSources: [],
    isFallback: false,
    fallbackReason: null,
    provider: request.provider,
    providerMetadata: providerMetadata(request.provider, {
      raw_response: {
        type: "huggingface.inference",
        preview: compactJsonPreview(Array.isArray(body) ? { resultCount: body.length, first: body[0] } : body),
      },
    })
  };
}

async function callCustomHttp(request: ProviderRequest): Promise<ProviderResult> {
  if (!request.provider.endpointUrl) {
    throw new Error("Custom HTTP provider selected but no endpoint URL was configured.");
  }

  const response = await fetch(request.provider.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...optionalAuthHeaders(request.provider.apiKey)
    },
    body: JSON.stringify({
      model: request.provider.model,
      system: request.systemInstruction,
      prompt: request.conversationText,
      temperature: request.provider.temperature ?? 0.7,
      maxTokens: request.provider.maxTokens ?? 1024,
      topic: request.topic,
      history: request.history,
      currentAgent: request.currentAgent,
      responseFormat: "cognitive-pong-json"
    }),
    signal: providerAbortSignal(request, 15000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Custom HTTP provider returned [${response.status}]: ${errorText || response.statusText}`);
  }

  const raw = await response.text();
  return {
    parsedData: parseProviderText(raw, request.defaultComplexity),
    searchSources: [],
    isFallback: false,
    fallbackReason: null,
    provider: request.provider,
    providerMetadata: providerMetadata(request.provider, {
      raw_response: {
        type: "custom-http.cognitive-pong",
        preview: raw.slice(0, 1200),
      },
    })
  };
}

export async function generateWithProvider(request: ProviderRequest): Promise<ProviderResult> {
  const startedAt = Date.now();
  if (request.provider.kind === "mock") {
    return withLatency({
      parsedData: request.mockResponse,
      searchSources: [],
      isFallback: true,
      fallbackReason: "Mock provider selected. This local mode requires no external API key.",
      provider: request.provider,
      providerMetadata: providerMetadata(request.provider, {
        raw_response: {
          type: "mock.synthetic",
          preview: compactJsonPreview({ content: request.mockResponse?.content, type: request.mockResponse?.type }),
        },
      }),
    }, startedAt);
  }

  let result: ProviderResult;
  switch (request.provider.kind) {
    case "gemini":
      result = await callGemini(request);
      break;
    case "ollama":
    case "openai-compatible":
      result = await callOpenAICompatible(request);
      break;
    case "anthropic":
      result = await callAnthropic(request);
      break;
    case "huggingface":
      result = await callHuggingFace(request);
      break;
    case "custom-http":
      result = await callCustomHttp(request);
      break;
    default:
      result = await callCustomHttp(request);
      break;
  }
  return withLatency(result, startedAt);
}
