import { ArenaLoopLimits, ArenaSource, buildMockSearchResults, normalizeArenaLoopLimits } from "../src/utils/arenaLoop";
import { ArenaSearchProvider } from "../src/types";

export interface ArenaSearchConfig {
  provider: ArenaSearchProvider;
  endpointUrl?: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface ArenaSearchRequest {
  query: string;
  limits: Partial<ArenaLoopLimits>;
  retrievedAt?: string;
  config: ArenaSearchConfig;
  fetchImpl?: typeof fetch;
}

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function normalizeProvider(value?: string | null): ArenaSearchProvider {
  const normalized = (value || "").trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "brave" || normalized === "tavily" || normalized === "searxng") return normalized;
  return "mock";
}

function clampTimeout(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1000, Math.min(30000, Math.round(numeric))) : 5000;
}

function cleanString(value: unknown, fallback: string, maxLength = 1000) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).slice(0, maxLength);
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return url.startsWith("mock://") ? "mock.local" : "unknown";
  }
}

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

export function resolveArenaSearchConfig(raw: any = {}, env: NodeJS.ProcessEnv = process.env): ArenaSearchConfig {
  const provider = normalizeProvider(firstNonEmpty(
    raw.searchProvider,
    raw.provider,
    env.ARENA_SEARCH_PROVIDER,
    env.COGNITIVE_PONG_SEARCH_PROVIDER,
    "mock",
  ));
  const endpointUrl = firstNonEmpty(
    raw.searchEndpointUrl,
    raw.endpointUrl,
    provider === "searxng" ? env.SEARXNG_SEARCH_URL : undefined,
    provider === "brave" ? env.BRAVE_SEARCH_URL : undefined,
    provider === "tavily" ? env.TAVILY_SEARCH_URL : undefined,
  );
  const apiKey = firstNonEmpty(
    raw.searchApiKey,
    raw.apiKey,
    provider === "brave" ? env.BRAVE_SEARCH_API_KEY : undefined,
    provider === "tavily" ? env.TAVILY_API_KEY : undefined,
  );

  return {
    provider,
    endpointUrl,
    apiKey,
    timeoutMs: clampTimeout(raw.searchTimeoutMs ?? env.ARENA_SEARCH_TIMEOUT_MS),
  };
}

function mapSource(raw: any, index: number, provider: string, retrievedAt: string, excerptLength: number): ArenaSource {
  const url = cleanString(raw.url || raw.link || raw.href, `mock://arena-loop/missing-url/${index + 1}`, 1000);
  const title = cleanString(raw.title || raw.name, `Search result ${index + 1}`, 240);
  const snippet = cleanString(raw.snippet || raw.description || raw.content || raw.body, title, excerptLength);

  return {
    id: `S${String(index + 1).padStart(2, "0")}`,
    title,
    url,
    snippet,
    domain: domainFromUrl(url),
    provider,
    retrieved_at: retrievedAt,
    published_at: typeof raw.published === "string" ? raw.published : typeof raw.published_at === "string" ? raw.published_at : undefined,
  };
}

async function searchSearxng(request: ArenaSearchRequest, limits: ArenaLoopLimits, retrievedAt: string): Promise<ArenaSource[]> {
  if (!request.config.endpointUrl) {
    throw new Error("SearXNG search selected but no SEARXNG_SEARCH_URL or endpoint URL is configured.");
  }
  const url = new URL(request.config.endpointUrl);
  url.searchParams.set("q", request.query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");

  const timer = withTimeout(request.config.timeoutMs);
  try {
    const response = await (request.fetchImpl || fetch)(url, { signal: timer.signal });
    if (!response.ok) {
      throw new Error(`SearXNG search returned [${response.status}]: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return (Array.isArray(data.results) ? data.results : [])
      .slice(0, limits.maxSourcesPerTurn)
      .map((item, index) => mapSource(item, index, "searxng", retrievedAt, limits.maxSourceExcerptLength));
  } finally {
    timer.clear();
  }
}

async function searchBrave(request: ArenaSearchRequest, limits: ArenaLoopLimits, retrievedAt: string): Promise<ArenaSource[]> {
  if (!request.config.apiKey) {
    throw new Error("Brave Search selected but BRAVE_SEARCH_API_KEY is not configured.");
  }
  const url = new URL(request.config.endpointUrl || "https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", request.query);
  url.searchParams.set("count", String(limits.maxSourcesPerTurn));

  const timer = withTimeout(request.config.timeoutMs);
  try {
    const response = await (request.fetchImpl || fetch)(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": request.config.apiKey,
      },
      signal: timer.signal,
    });
    if (!response.ok) {
      throw new Error(`Brave Search returned [${response.status}]: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return (Array.isArray(data.web?.results) ? data.web.results : [])
      .slice(0, limits.maxSourcesPerTurn)
      .map((item, index) => mapSource(item, index, "brave", retrievedAt, limits.maxSourceExcerptLength));
  } finally {
    timer.clear();
  }
}

async function searchTavily(request: ArenaSearchRequest, limits: ArenaLoopLimits, retrievedAt: string): Promise<ArenaSource[]> {
  if (!request.config.apiKey) {
    throw new Error("Tavily Search selected but TAVILY_API_KEY is not configured.");
  }
  const timer = withTimeout(request.config.timeoutMs);
  try {
    const response = await (request.fetchImpl || fetch)(request.config.endpointUrl || "https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: request.config.apiKey,
        query: request.query,
        max_results: limits.maxSourcesPerTurn,
        search_depth: "basic",
      }),
      signal: timer.signal,
    });
    if (!response.ok) {
      throw new Error(`Tavily Search returned [${response.status}]: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return (Array.isArray(data.results) ? data.results : [])
      .slice(0, limits.maxSourcesPerTurn)
      .map((item, index) => mapSource(item, index, "tavily", retrievedAt, limits.maxSourceExcerptLength));
  } finally {
    timer.clear();
  }
}

export async function searchArenaSources(request: ArenaSearchRequest): Promise<ArenaSource[]> {
  const limits = normalizeArenaLoopLimits(request.limits);
  if (limits.maxQueriesPerTurn <= 0 || limits.maxSourcesPerTurn <= 0) return [];

  const retrievedAt = request.retrievedAt || new Date().toISOString();
  if (request.config.provider === "mock") {
    return buildMockSearchResults(request.query, limits, retrievedAt);
  }

  switch (request.config.provider) {
    case "searxng":
      return searchSearxng(request, limits, retrievedAt);
    case "brave":
      return searchBrave(request, limits, retrievedAt);
    case "tavily":
      return searchTavily(request, limits, retrievedAt);
    default:
      return buildMockSearchResults(request.query, limits, retrievedAt);
  }
}
