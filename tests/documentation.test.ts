import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf-8");

const readme = read("README.md");
const envExample = read(".env.example");
const architecture = read("docs/architecture.md");
const agentBridges = read("docs/agent-bridges.md");
const platformGuide = read("docs/platform-guide.md");
const science = read("docs/science-and-method.md");
const extending = read("docs/extending.md");

test("README documents the platform, use cases, and cross-platform setup", () => {
  assert.match(readme, /## What It Is For/);
  assert.match(readme, /## Platform Tour/);
  assert.match(readme, /## Quick Start: macOS/);
  assert.match(readme, /## Quick Start: Windows/);
  assert.match(readme, /## Quick Start: Linux/);
  assert.match(readme, /docs\/platform-guide\.md/);
  assert.match(readme, /docs\/architecture\.md/);
  assert.match(readme, /docs\/science-and-method\.md/);
  assert.match(readme, /docs\/extending\.md/);
  assert.match(readme, /mock-local/);
  assert.match(readme, /openai-compatible/);
  assert.match(readme, /ollama/);
  assert.match(readme, /huggingface/);
  assert.match(readme, /COGNITIVE_PONG_MATCHES_STORE/);
  assert.match(readme, /data\/cognitive-pong\.sqlite/);
  assert.doesNotMatch(readme, /Start Cognitive Loop|Llama 3\.1 Local|Gemini-centric|D3-powered/);
});

test(".env.example is safe by default and documents optional adapters", () => {
  assert.match(envExample, /^COGNITIVE_PONG_DEFAULT_PROVIDER=mock$/m);
  assert.match(envExample, /^COGNITIVE_PONG_DEFAULT_MODEL=mock-local$/m);
  assert.match(envExample, /^COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE=none$/m);
  assert.match(envExample, /^COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=false$/m);
  assert.doesNotMatch(envExample, /^COGNITIVE_PONG_DEFAULT_AGENT_BRIDGE=true$/m);
  assert.doesNotMatch(envExample, /^COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true$/m);
  for (const key of [
    "OPENAI_BASE_URL",
    "OLLAMA_BASE_URL",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "HUGGINGFACE_ENDPOINT_URL",
    "CUSTOM_PROVIDER_URL",
    "SEARXNG_SEARCH_URL",
    "BRAVE_SEARCH_API_KEY",
    "TAVILY_API_KEY",
    "CODEX_CLI_COMMAND",
    "COGNITIVE_PONG_MATCHES_STORE",
    "COGNITIVE_PONG_ARENA_STORE",
    "COGNITIVE_PONG_CLI_PROFILES",
    "COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS",
  ]) {
    assert.match(envExample, new RegExp(key));
  }
});

test("architecture and extension docs map current source boundaries", () => {
  for (const file of [
    "src/App.tsx",
    "src/components/CognitivePongExperience.tsx",
    "server/providers.ts",
    "server/agentBridges.ts",
    "server/arenaLoopStore.ts",
    "server/arenaSearchProviders.ts",
    "server/matchStore.ts",
    "server/sqliteStore.ts",
    "src/types.ts",
  ]) {
    assert.match(architecture, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(extending, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(architecture, /GET \/api\/bridge\/manifest/);
  assert.match(architecture, /POST \/api\/debate\/next/);
  assert.match(architecture, /PATCH \/battle\/:id/);
  assert.match(extending, /Add a Provider/);
  assert.match(extending, /Add an Agent Bridge/);
  assert.match(extending, /Add a Search Provider/);
});

test("science and platform guides explain method, interpretation, and workflows", () => {
  assert.match(platformGuide, /Basic Workflow/);
  assert.match(platformGuide, /Main Goal and Victory Condition/);
  assert.match(platformGuide, /Agent Configuration/);
  assert.match(platformGuide, /Arena Loop Persistence/);
  assert.match(platformGuide, /Use Cases/);
  assert.match(science, /Why Pong/);
  assert.match(science, /Two-Agent Debate/);
  assert.match(science, /Judge Scoring/);
  assert.match(science, /Do not interpret them as objective truth/);
  assert.match(science, /Limitations/);
});

test("agent bridge docs cover supported transports and local execution safety", () => {
  for (const bridge of ["none", "http", "websocket", "mcp", "cli", "codex-cli"]) {
    assert.match(agentBridges, new RegExp(`\\b${bridge}\\b`));
  }
  assert.match(agentBridges, /COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=false/);
  assert.match(agentBridges, /COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true/);
  assert.match(agentBridges, /COGNITIVE_PONG_CLI_PROFILES/);
  assert.match(agentBridges, /server-side allowlisted/);
  assert.match(agentBridges, /COGNITIVE_PONG_ENABLE_DANGER_FULL_ACCESS/);
  assert.match(agentBridges, /Do not enable local command bridges/);
  assert.match(agentBridges, /HTTP Bridge Contract/);
  assert.match(agentBridges, /MCP-Style Bridge Contract/);
  assert.match(agentBridges, /Codex CLI Bridge/);
});
