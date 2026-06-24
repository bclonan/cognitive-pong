import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveArenaSearchConfig,
  searchArenaSources,
} from "../server/arenaSearchProviders";

test("Arena search config defaults to mock and reads env-backed providers", () => {
  assert.deepEqual(resolveArenaSearchConfig({}, {} as NodeJS.ProcessEnv), {
    provider: "mock",
    endpointUrl: undefined,
    apiKey: undefined,
    timeoutMs: 5000,
  });

  const brave = resolveArenaSearchConfig({}, {
    ARENA_SEARCH_PROVIDER: "brave",
    BRAVE_SEARCH_API_KEY: "brave-key",
    ARENA_SEARCH_TIMEOUT_MS: "9000",
  } as NodeJS.ProcessEnv);

  assert.equal(brave.provider, "brave");
  assert.equal(brave.apiKey, "brave-key");
  assert.equal(brave.timeoutMs, 9000);
});

test("mock Arena search works locally without external keys", async () => {
  const results = await searchArenaSources({
    query: "bounded arena research",
    limits: { maxSourcesPerTurn: 2 },
    retrievedAt: "2026-06-23T12:00:00.000Z",
    config: resolveArenaSearchConfig({ searchProvider: "mock" }),
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].provider, "mock");
  assert.equal(results[0].id, "S01");
});

test("SearXNG search maps bounded source results", async () => {
  const calls: string[] = [];
  const fakeFetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(JSON.stringify({
      results: [
        { title: "Result A", url: "https://example.com/a", content: "Alpha source excerpt" },
        { title: "Result B", url: "https://example.com/b", content: "Beta source excerpt" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const results = await searchArenaSources({
    query: "source backed debate",
    limits: { maxSourcesPerTurn: 1, maxSourceExcerptLength: 20 },
    retrievedAt: "2026-06-23T12:00:00.000Z",
    config: resolveArenaSearchConfig({
      searchProvider: "searxng",
      searchEndpointUrl: "http://localhost:8080/search",
    }),
    fetchImpl: fakeFetch,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, "searxng");
  assert.equal(results[0].title, "Result A");
  assert.equal(results[0].domain, "example.com");
  assert.match(calls[0], /format=json/);
});

test("Brave search uses subscription token and maps web results", async () => {
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: init?.headers });
    return new Response(JSON.stringify({
      web: {
        results: [
          { title: "Brave result", url: "https://brave.example/doc", description: "Brave excerpt" },
        ],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const results = await searchArenaSources({
    query: "brave arena search",
    limits: { maxSourcesPerTurn: 2 },
    config: resolveArenaSearchConfig({ searchProvider: "brave", searchApiKey: "token" }),
    fetchImpl: fakeFetch,
  });

  assert.equal(results[0].provider, "brave");
  assert.match(calls[0].url, /api\.search\.brave\.com/);
  assert.deepEqual(calls[0].headers, {
    Accept: "application/json",
    "X-Subscription-Token": "token",
  });
});

test("Tavily search posts bounded query payload", async () => {
  const bodies: any[] = [];
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body || "{}")));
    return new Response(JSON.stringify({
      results: [
        { title: "Tavily result", url: "https://tavily.example/doc", content: "Tavily excerpt" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const results = await searchArenaSources({
    query: "tavily arena search",
    limits: { maxSourcesPerTurn: 3 },
    config: resolveArenaSearchConfig({ searchProvider: "tavily", searchApiKey: "tvly" }),
    fetchImpl: fakeFetch,
  });

  assert.equal(results[0].provider, "tavily");
  assert.equal(bodies[0].api_key, "tvly");
  assert.equal(bodies[0].query, "tavily arena search");
  assert.equal(bodies[0].max_results, 3);
});

test("bounded search exits early when research limits disable queries or sources", async () => {
  const results = await searchArenaSources({
    query: "disabled research",
    limits: { maxQueriesPerTurn: 0, maxSourcesPerTurn: 4 },
    config: resolveArenaSearchConfig({ searchProvider: "mock" }),
  });

  assert.deepEqual(results, []);
});
