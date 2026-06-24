import assert from "node:assert/strict";
import test from "node:test";
import {
  cloneAgentForLibrary,
  createBlankCustomAgent,
  createCustomAgentTemplate,
  parseCustomAgentLibrary,
  removeCustomAgentTemplate,
  upsertCustomAgentTemplate,
} from "../src/utils/customAgents";

test("custom agent templates preserve model, profile, tuning, and bridge values", () => {
  const template = createCustomAgentTemplate({
    ...createBlankCustomAgent(),
    name: "CLI Strategist",
    role: "Competes with local tools.",
    provider: "ollama",
    model: "llama3.1",
    customModel: "llama3.1:8b",
    endpointUrl: "http://localhost:11434",
    customApiKey: "local-token",
    systemPrompt: "Use local repo context.",
    personality: "focused builder",
    psychologyArchetype: "operator",
    debateStyle: "socratic",
    competitiveDrive: 85,
    riskTolerance: 0.35,
    collaborationBias: 0.25,
    strategicTendencies: "Probe assumptions with tools.",
    safetyConstraints: "Do not invent tool results.",
    temperature: 0.4,
    maxTokens: 1536,
    bridge: {
      kind: "codex-cli",
      label: "Codex local",
      command: "codex",
      args: ["exec", "{prompt}"],
      timeoutMs: 90000,
    },
    color: "cyan",
    avatar: "CL",
  }, {
    id: "agent_cli_strategist",
    now: "2026-06-23T12:00:00.000Z",
  });

  assert.equal(template.id, "agent_cli_strategist");
  assert.equal(template.agent.name, "CLI Strategist");
  assert.equal(template.agent.customModel, "llama3.1:8b");
  assert.equal(template.agent.customApiKey, "local-token");
  assert.equal(template.agent.systemPrompt, "Use local repo context.");
  assert.equal(template.agent.competitiveDrive, 85);
  assert.equal(template.agent.bridge?.kind, "codex-cli");
  assert.deepEqual(template.agent.bridge?.args, ["exec", "{prompt}"]);
});

test("custom agent library parse, upsert, remove, and clone are stable", () => {
  const original = createCustomAgentTemplate({
    ...createBlankCustomAgent(),
    name: "Stored Agent",
    role: "Stored role",
    color: "emerald",
    avatar: "SA",
  }, {
    id: "stored_agent",
    now: "2026-06-23T12:00:00.000Z",
  });
  const parsed = parseCustomAgentLibrary(JSON.stringify([original, { id: "", agent: {} }]));
  const replacement = createCustomAgentTemplate({
    ...original.agent,
    name: "Updated Agent",
  }, {
    existing: original,
    now: "2026-06-23T12:01:00.000Z",
  });

  const upserted = upsertCustomAgentTemplate(parsed, replacement);
  const cloned = cloneAgentForLibrary(upserted[0].agent);
  cloned.name = "Mutated Clone";

  assert.equal(parsed.length, 1);
  assert.equal(upserted.length, 1);
  assert.equal(upserted[0].id, "stored_agent");
  assert.equal(upserted[0].createdAt, "2026-06-23T12:00:00.000Z");
  assert.equal(upserted[0].updatedAt, "2026-06-23T12:01:00.000Z");
  assert.equal(upserted[0].agent.name, "Updated Agent");
  assert.equal(cloned.name, "Mutated Clone");
  assert.equal(upserted[0].agent.name, "Updated Agent");
  assert.deepEqual(removeCustomAgentTemplate(upserted, "stored_agent"), []);
  assert.deepEqual(parseCustomAgentLibrary("not json"), []);
});
