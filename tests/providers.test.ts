import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeminiGenerateConfig,
  ensureChatCompletionEndpoint,
  generateWithProvider,
  normalizeProviderKind,
  parseProviderText,
  resolveProviderConfig,
} from "../server/providers";

test("defaults to mock provider when no agent or environment provider is configured", () => {
  const priorProvider = process.env.COGNITIVE_PONG_DEFAULT_PROVIDER;
  const priorAiProvider = process.env.AI_PROVIDER;
  delete process.env.COGNITIVE_PONG_DEFAULT_PROVIDER;
  delete process.env.AI_PROVIDER;

  try {
    const provider = resolveProviderConfig({ agentA: {}, agentB: {}, model: "mock-local" }, "agentA");
    assert.equal(provider.kind, "mock");
    assert.equal(provider.model, "mock-local");
  } finally {
    if (priorProvider === undefined) {
      delete process.env.COGNITIVE_PONG_DEFAULT_PROVIDER;
    } else {
      process.env.COGNITIVE_PONG_DEFAULT_PROVIDER = priorProvider;
    }

    if (priorAiProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = priorAiProvider;
    }
  }
});

test("normalizes legacy and provider-specific aliases", () => {
  assert.equal(normalizeProviderKind("custom_openai"), "openai-compatible");
  assert.equal(normalizeProviderKind("google-gemini"), "gemini");
  assert.equal(normalizeProviderKind("hf"), "huggingface");
  assert.equal(normalizeProviderKind("demo"), "mock");
});

test("resolves OpenAI-compatible endpoint and credential from agent config", () => {
  const provider = resolveProviderConfig(
    {
      agentA: {
        provider: "openai-compatible",
        endpointUrl: "http://localhost:4000/v1",
        customApiKey: "local-secret",
        customModel: "gpt-4o-mini",
      },
      agentB: {},
    },
    "agentA"
  );

  assert.equal(provider.kind, "openai-compatible");
  assert.equal(provider.endpointUrl, "http://localhost:4000/v1");
  assert.equal(provider.apiKey, "local-secret");
  assert.equal(provider.model, "gpt-4o-mini");
});

test("resolves Agent A and Agent B provider settings independently", () => {
  const config = {
    model: "mock-local",
    agentA: {
      provider: "ollama",
      endpointUrl: "http://localhost:11434",
      model: "llama3.1",
      temperature: 0.2,
      maxTokens: 512,
    },
    agentB: {
      provider: "huggingface",
      endpointUrl: "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct",
      customApiKey: "hf-local-token",
      model: "Qwen/Qwen2.5-7B-Instruct",
      temperature: 1.1,
      maxTokens: 1536,
    },
  };

  const agentAProvider = resolveProviderConfig(config, "agentA");
  const agentBProvider = resolveProviderConfig(config, "agentB");

  assert.equal(agentAProvider.kind, "ollama");
  assert.equal(agentAProvider.endpointUrl, "http://localhost:11434");
  assert.equal(agentAProvider.model, "llama3.1");
  assert.equal(agentAProvider.apiKey, undefined);
  assert.equal(agentAProvider.temperature, 0.2);
  assert.equal(agentAProvider.maxTokens, 512);

  assert.equal(agentBProvider.kind, "huggingface");
  assert.equal(
    agentBProvider.endpointUrl,
    "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct"
  );
  assert.equal(agentBProvider.model, "Qwen/Qwen2.5-7B-Instruct");
  assert.equal(agentBProvider.apiKey, "hf-local-token");
  assert.equal(agentBProvider.temperature, 1.1);
  assert.equal(agentBProvider.maxTokens, 1536);
});

test("resolves model fallback order from custom, agent, request, global, then provider default", () => {
  const requestDefault = resolveProviderConfig(
    {
      model: "gpt-4o",
      agentA: {
        provider: "openai-compatible",
      },
      agentB: {},
    },
    "agentA",
    "gpt-4.1-mini"
  );
  assert.equal(requestDefault.model, "gpt-4.1-mini");

  const globalDefault = resolveProviderConfig(
    {
      model: "gpt-4o",
      agentA: {
        provider: "openai-compatible",
      },
      agentB: {},
    },
    "agentA"
  );
  assert.equal(globalDefault.model, "gpt-4o");

  const agentDefault = resolveProviderConfig(
    {
      model: "gpt-4o",
      agentA: {
        provider: "openai-compatible",
        model: "gpt-4o-mini",
      },
      agentB: {},
    },
    "agentA",
    "gpt-4.1-mini"
  );
  assert.equal(agentDefault.model, "gpt-4o-mini");

  const customOverride = resolveProviderConfig(
    {
      model: "gpt-4o",
      agentA: {
        provider: "openai-compatible",
        model: "gpt-4o-mini",
        customModel: "local-router/custom-gpt",
      },
      agentB: {},
    },
    "agentA",
    "gpt-4.1-mini"
  );
  assert.equal(customOverride.model, "local-router/custom-gpt");

  const providerDefault = resolveProviderConfig(
    {
      model: "mock-local",
      agentA: {
        provider: "openai-compatible",
      },
      agentB: {},
    },
    "agentA"
  );
  assert.equal(providerDefault.model, "gpt-4o-mini");
});

test("uses provider defaults instead of carrying mock-local into live adapters", () => {
  const provider = resolveProviderConfig(
    {
      model: "mock-local",
      agentA: {
        provider: "gemini",
      },
      agentB: {},
    },
    "agentA"
  );

  assert.equal(provider.kind, "gemini");
  assert.equal(provider.model, "gemini-3.5-flash");
});

test("Gemini config adds Google Search grounding only when enabled", () => {
  const fakeType = {
    OBJECT: "object",
    STRING: "string",
    INTEGER: "integer",
    BOOLEAN: "boolean",
    ARRAY: "array",
  };
  const baseGeminiRequest = {
    topic: "Grounding toggle test",
    history: [],
    currentAgent: "agentA" as const,
    agentConfig: { agentA: {}, agentB: {} },
    provider: {
      kind: "gemini" as const,
      label: "gemini",
      apiKey: "test-key",
      model: "gemini-3.5-flash",
    },
    systemInstruction: "System prompt.",
    conversationText: "Conversation prompt.",
    defaultComplexity: "quick lookup",
    mockResponse: {},
  };

  const groundingConfig = buildGeminiGenerateConfig(
    { ...baseGeminiRequest, useGrounding: true },
    fakeType
  );
  assert.deepEqual(groundingConfig.tools, [{ googleSearch: {} }]);

  const offboardConfig = buildGeminiGenerateConfig(
    { ...baseGeminiRequest, useGrounding: false },
    fakeType
  );
  assert.equal("tools" in offboardConfig, false);
});

test("sends Anthropic messages request and parses text response", async () => {
  const priorFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit; body: any }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}"));
    calls.push({ url: String(url), init: init || {}, body });

    return new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              content: "Anthropic contract response parsed.",
              type: "agreement",
              convictionScore: 88,
              complexity: "deep research",
            }),
          },
        ],
        usage: {
          input_tokens: 12,
          output_tokens: 34,
        },
        stop_reason: "end_turn",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await generateWithProvider({
      topic: "Anthropic contract smoke",
      history: [],
      currentAgent: "agentA",
      agentConfig: {},
      provider: {
        kind: "anthropic",
        label: "anthropic",
        endpointUrl: "http://127.0.0.1:9999/v1/messages",
        apiKey: "anthropic-test-key",
        model: "claude-3-5-sonnet-latest",
        temperature: 0.4,
        maxTokens: 512,
      },
      useGrounding: false,
      systemInstruction: "System prompt for Anthropic.",
      conversationText: "User conversation for Anthropic.",
      defaultComplexity: "quick lookup",
      mockResponse: {},
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:9999/v1/messages");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(calls[0].init.headers, {
      "Content-Type": "application/json",
      "x-api-key": "anthropic-test-key",
      "anthropic-version": "2023-06-01",
    });
    assert.deepEqual(calls[0].body, {
      model: "claude-3-5-sonnet-latest",
      max_tokens: 512,
      temperature: 0.4,
      system: "System prompt for Anthropic.",
      messages: [{ role: "user", content: "User conversation for Anthropic." }],
    });
    assert.equal(result.isFallback, false);
    assert.equal(result.parsedData.content, "Anthropic contract response parsed.");
    assert.equal(result.parsedData.type, "agreement");
    assert.equal(result.parsedData.convictionScore, 88);
    assert.equal(result.parsedData.complexity, "deep research");
    assert.equal(result.providerMetadata.provider_id, "anthropic");
    assert.equal(result.providerMetadata.model_id, "claude-3-5-sonnet-latest");
    assert.equal(result.providerMetadata.token_usage?.prompt_tokens, 12);
    assert.equal(result.providerMetadata.token_usage?.completion_tokens, 34);
    assert.equal(result.providerMetadata.token_usage?.total_tokens, 46);
    assert.equal(result.providerMetadata.raw_response?.type, "anthropic.messages");
    assert.equal(result.providerMetadata.raw_response?.finish_reason, "end_turn");
    assert.ok(result.providerMetadata.latency_ms >= 0);
  } finally {
    globalThis.fetch = priorFetch;
  }
});

test("sends Custom HTTP Cognitive Pong payload and bearer token", async () => {
  const priorFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
  const history = [
    {
      id: "turn-1",
      sender: "agentB",
      content: "Prior critique.",
      type: "critique",
      convictionScore: 71,
    },
  ];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}"));
    calls.push({ url: String(url), init: init || {}, body });

    return new Response(
      JSON.stringify({
        content: "Custom HTTP contract response parsed.",
        type: "proposal",
        convictionScore: 81,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await generateWithProvider({
      topic: "Custom HTTP contract smoke",
      history,
      currentAgent: "agentA",
      agentConfig: {},
      provider: {
        kind: "custom-http",
        label: "custom-http",
        endpointUrl: "http://127.0.0.1:8787/cognitive-pong",
        apiKey: "custom-http-token",
        model: "custom-contract-model",
        temperature: 1.1,
        maxTokens: 768,
      },
      useGrounding: false,
      systemInstruction: "System prompt for Custom HTTP.",
      conversationText: "Prompt for Custom HTTP.",
      defaultComplexity: "deep research",
      mockResponse: {},
      timeoutMs: 2300,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:8787/cognitive-pong");
    assert.equal(calls[0].init.method, "POST");
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.deepEqual(calls[0].init.headers, {
      "Content-Type": "application/json",
      Authorization: "Bearer custom-http-token",
    });
    assert.deepEqual(calls[0].body, {
      model: "custom-contract-model",
      system: "System prompt for Custom HTTP.",
      prompt: "Prompt for Custom HTTP.",
      temperature: 1.1,
      maxTokens: 768,
      topic: "Custom HTTP contract smoke",
      history,
      currentAgent: "agentA",
      responseFormat: "cognitive-pong-json",
    });
    assert.equal(result.isFallback, false);
    assert.equal(result.parsedData.content, "Custom HTTP contract response parsed.");
    assert.equal(result.parsedData.type, "proposal");
    assert.equal(result.parsedData.convictionScore, 81);
    assert.equal(result.parsedData.complexity, "deep research");
    assert.equal(result.providerMetadata.provider_id, "custom-http");
    assert.equal(result.providerMetadata.model_id, "custom-contract-model");
    assert.equal(result.providerMetadata.raw_response?.type, "custom-http.cognitive-pong");
    assert.match(result.providerMetadata.raw_response?.preview || "", /Custom HTTP contract response parsed/);
  } finally {
    globalThis.fetch = priorFetch;
  }
});

test("mock provider returns local metadata without external credentials", async () => {
  const result = await generateWithProvider({
    topic: "Mock metadata smoke",
    history: [],
    currentAgent: "agentA",
    agentConfig: {},
    provider: {
      kind: "mock",
      label: "mock",
      model: "mock-local",
    },
    useGrounding: false,
    systemInstruction: "System prompt.",
    conversationText: "Prompt.",
    defaultComplexity: "quick lookup",
    mockResponse: {
      content: "Mock turn.",
      type: "proposal",
      convictionScore: 70,
      complexity: "quick lookup",
    },
  });

  assert.equal(result.isFallback, true);
  assert.equal(result.providerMetadata.provider_id, "mock");
  assert.equal(result.providerMetadata.model_id, "mock-local");
  assert.equal(result.providerMetadata.raw_response?.type, "mock.synthetic");
  assert.ok(result.providerMetadata.latency_ms >= 0);
});

test("normalizes OpenAI-compatible chat completion endpoints", () => {
  assert.equal(
    ensureChatCompletionEndpoint("https://api.openai.com/v1"),
    "https://api.openai.com/v1/chat/completions"
  );
  assert.equal(
    ensureChatCompletionEndpoint("http://localhost:11434"),
    "http://localhost:11434/v1/chat/completions"
  );
  assert.equal(
    ensureChatCompletionEndpoint("http://localhost:11434/v1/chat/completions"),
    "http://localhost:11434/v1/chat/completions"
  );
});

test("parses provider JSON fenced in markdown", () => {
  const parsed = parseProviderText(
    '```json\n{"content":"Tighten the evidence loop.","type":"critique","convictionScore":78,"complexity":"deep research"}\n```',
    "auto"
  );

  assert.equal(parsed.content, "Tighten the evidence loop.");
  assert.equal(parsed.type, "critique");
  assert.equal(parsed.convictionScore, 78);
  assert.equal(parsed.complexity, "deep research");
});

test("parses Arena Loop thesis and points JSON into a debate turn", () => {
  const parsed = parseProviderText(
    JSON.stringify({
      thesis: "Use bounded provider adapters for autonomous turns.",
      strategy: "Cite source IDs and keep the move inspectable.",
      confidence: 0.82,
      points: [
        {
          claim: "The backend turn path should call the selected model.",
          reasoning: "Otherwise provider/model choices only affect the live Pong path.",
          relation: "supports",
          source_ids: ["S01"],
          expected_impact: 0.8,
        },
      ],
    }),
    "auto",
  );

  assert.match(parsed.content, /Thesis: Use bounded provider adapters/);
  assert.match(parsed.content, /Sources: S01/);
  assert.equal(parsed.type, "proposal");
  assert.equal(parsed.proposal, "Use bounded provider adapters for autonomous turns.");
  assert.equal(parsed.convictionScore, 82);
  assert.equal(parsed.complexity, "deep research");
  assert.equal(parsed.arenaStructuredResponse?.points.length, 1);
  assert.deepEqual(parsed.arenaStructuredResponse?.points[0].source_ids, ["S01"]);
});

test("uses configured default complexity when provider output omits complexity", () => {
  const parsedJson = parseProviderText(
    '{"content":"Default the task depth.","type":"proposal","convictionScore":66}',
    "complex simulation"
  );
  const parsedText = parseProviderText("Plain provider text without structured metadata.", "deep research");

  assert.equal(parsedJson.content, "Default the task depth.");
  assert.equal(parsedJson.type, "proposal");
  assert.equal(parsedJson.convictionScore, 66);
  assert.equal(parsedJson.complexity, "complex simulation");
  assert.equal(parsedText.complexity, "deep research");
});

test("normalizes plain-text provider output into a debate turn fallback", () => {
  const parsed = parseProviderText(
    "Plain provider text without structured metadata.",
    "deep research"
  );

  assert.equal(parsed.content, "Plain provider text without structured metadata.");
  assert.equal(parsed.type, "critique");
  assert.equal(parsed.proposal, "");
  assert.equal(parsed.convictionScore, 50);
  assert.equal(parsed.complexity, "deep research");
  assert.equal(parsed.judgeEvaluation, undefined);
  assert.equal(parsed.spectatorLiveReactions, undefined);
});
