import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import test from "node:test";
import { AgentConfig } from "../src/types";
import {
  appendArenaBattleTurn,
  buildArenaBattle,
  buildArenaBattleJsonlExport,
  buildArenaBattleResearchBundleZip,
  createArenaBattle,
  findArenaBattle,
  normalizeArenaAgentProfile,
  readArenaBattles,
  reconstructArenaBattleReplay,
  runArenaBattleTurn,
  runArenaBattleTurnWithSearch,
  updateArenaBattle,
  updateArenaBattleGoal,
} from "../server/arenaLoopStore";
import { createArenaLoopRouter } from "../server/arenaLoopRoutes";

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arena-loop-"));
  return path.join(dir, "battles.json");
}

const agentConfigPayload: AgentConfig = {
  useGrounding: true,
  baseSpeed: 3,
  model: "mock-local",
  agentA: {
    name: "Agent Alpha",
    role: "Propose bounded designs.",
    color: "emerald",
    avatar: "A",
    provider: "mock",
    model: "mock-local",
    systemPrompt: "Use crisp claims.",
    personality: "calm systems architect",
    psychologyArchetype: "operator",
    debateStyle: "cooperative",
    competitiveDrive: 70,
    riskTolerance: 0.3,
    collaborationBias: 0.65,
    strategicTendencies: "Frame simple implementation paths.",
    safetyConstraints: "Do not overclaim.",
  },
  agentB: {
    name: "Agent Beta",
    role: "Challenge unsafe designs.",
    color: "amber",
    avatar: "B",
    provider: "mock",
    model: "mock-local",
    systemPrompt: "Find failure modes.",
    personality: "skeptical operator",
    psychologyArchetype: "skeptic",
    debateStyle: "adversarial",
    competitiveDrive: 80,
    riskTolerance: 0.2,
    collaborationBias: 0.25,
    strategicTendencies: "Attack unbounded loops.",
    safetyConstraints: "Prefer falsifiable claims.",
  },
};

const payload = {
  master_goal: "Compare bounded autonomous debate loop designs",
  rubric: "Evidence, clarity, direct engagement, and bounded execution.",
  visibility: "public",
  research_enabled: true,
  limits: {
    maxLoopPasses: 2,
    maxSourcesPerTurn: 2,
  },
  agentConfig: agentConfigPayload,
};

test("normalizes Arena Loop agent profile fields", () => {
  const profile = normalizeArenaAgentProfile(payload.agentConfig.agentB, "Agent B");

  assert.equal(profile.display_name, "Agent Beta");
  assert.equal(profile.provider, "mock");
  assert.equal(profile.custom_instructions, "Find failure modes.");
  assert.equal(profile.personality, "skeptical operator");
  assert.equal(profile.psychology_archetype, "skeptic");
  assert.equal(profile.debate_style, "adversarial");
  assert.equal(profile.win_drive, 0.8);
  assert.equal(profile.risk_tolerance, 0.2);
  assert.equal(profile.collaboration_bias, 0.25);
  assert.equal(profile.signature_moves, "Attack unbounded loops.");
  assert.equal(profile.safety_constraints, "Prefer falsifiable claims.");
});

test("normalizes Arena Loop profile model metadata with provider-aware defaults", () => {
  assert.equal(normalizeArenaAgentProfile({ provider: "ollama" }, "Agent A").model, "llama3");
  assert.equal(
    normalizeArenaAgentProfile({ provider: "huggingface" }, "Agent B").model,
    "mistralai/Mistral-7B-Instruct-v0.3",
  );
  assert.equal(normalizeArenaAgentProfile({ provider: "openai-compatible" }, "Agent A").model, "gpt-4o-mini");
  assert.equal(
    normalizeArenaAgentProfile({ provider: "ollama", customModel: "llama3.1:8b" }, "Agent A").model,
    "llama3.1:8b",
  );
  assert.equal(
    normalizeArenaAgentProfile({ provider: "custom-http", endpointUrl: "http://127.0.0.1:8787/cognitive-pong" }, "Agent A").endpoint_url,
    "http://127.0.0.1:8787/cognitive-pong",
  );
});

test("Arena Loop preserves distinct Agent A and Agent B personalities and instructions in prompts", () => {
  const battle = runArenaBattleTurn(buildArenaBattle(payload, {
    id: "battle_distinct_profiles",
    now: "2026-06-23T12:00:00.000Z",
  }), "agentA", {
    now: "2026-06-23T12:01:00.000Z",
  });

  assert.equal(battle.agent_a_profile.display_name, "Agent Alpha");
  assert.equal(battle.agent_b_profile.display_name, "Agent Beta");
  assert.equal(battle.agent_a_profile.personality, "calm systems architect");
  assert.equal(battle.agent_b_profile.personality, "skeptical operator");
  assert.equal(battle.agent_a_profile.custom_instructions, "Use crisp claims.");
  assert.equal(battle.agent_b_profile.custom_instructions, "Find failure modes.");
  assert.notEqual(battle.agent_a_profile.personality, battle.agent_b_profile.personality);
  assert.notEqual(battle.agent_a_profile.custom_instructions, battle.agent_b_profile.custom_instructions);
  assert.match(battle.turns[0].prompt_context_snapshot, /"display_name":"Agent Alpha"/);
  assert.match(battle.turns[0].prompt_context_snapshot, /"personality":"calm systems architect"/);
  assert.match(battle.turns[0].prompt_context_snapshot, /"custom_instructions":"Use crisp claims\."/);
  assert.match(battle.turns[0].prompt_context_snapshot, /"display_name":"Agent Beta"/);
  assert.match(battle.turns[0].prompt_context_snapshot, /"personality":"skeptical operator"/);
  assert.match(battle.turns[0].prompt_context_snapshot, /"custom_instructions":"Find failure modes\."/);
});

test("creates, persists, and runs a bounded mock Arena Loop battle", () => {
  const store = tempStore();
  const battle = createArenaBattle(payload, store);
  const afterCreate = readArenaBattles(store);

  assert.equal(afterCreate.length, 1);
  assert.equal(battle.master_goal, payload.master_goal);
  assert.equal(battle.visibility, "public");
  assert.equal(battle.config.research_enabled, true);
  assert.equal(battle.config.search_provider, "mock");
  assert.equal(battle.events[0].event, "battle.created");

  const afterA = updateArenaBattle(runArenaBattleTurn(battle, "agentA", {
    now: "2026-06-23T12:00:00.000Z",
    latencyMs: 12,
  }), store);

  assert.equal(afterA.status, "running");
  assert.equal(afterA.turns.length, 1);
  assert.equal(afterA.arguments[0].id, "R01-A-P01");
  assert.equal(afterA.turns[0].round_winner, "agentA");
  assert.equal(afterA.events.find((event) => event.event === "turn.completed")?.payload?.roundWinner, "agentA");
  assert.equal(afterA.sources.length, 2);
  assert.equal(afterA.turns[0].source_ids_used.length, 2);
  assert.equal(afterA.turns[0].loop_trajectory.candidates.length, 4);
  assert.equal(afterA.turns[0].loop_trajectory.critiques.length, 4);
  assert.equal(afterA.turns[0].loop_trajectory.research_queries.length, 2);
  assert.equal(afterA.turns[0].loop_trajectory.selected_candidate, afterA.turns[0].response);
  assert.deepEqual(afterA.turns[0].loop_trajectory.source_usage, ["S01", "S02"]);
  assert.match(afterA.turns[0].prompt_context_snapshot, /Required response schema/);
  const mockResearchStarted = afterA.events.find((event) => event.event === "research.started");
  assert.deepEqual(mockResearchStarted?.payload?.queries, afterA.turns[0].loop_trajectory.research_queries);
  assert.equal(afterA.events.find((event) => event.event === "judge.completed")?.payload?.judgeAdapter, "local-deterministic");
  assert.equal(afterA.events.some((event) => event.event === "research.completed"), true);

  const afterB = updateArenaBattle(runArenaBattleTurn(afterA, "agentB", {
    now: "2026-06-23T12:01:00.000Z",
  }), store);

  assert.equal(afterB.turns.length, 2);
  assert.equal(afterB.arguments[1].id, "R02-B-P01");
  assert.ok(afterB.final_scores.agentA > 0);
  assert.ok(afterB.final_scores.agentB > 0);
  assert.equal(findArenaBattle(afterB.slug, store)?.id, battle.id);
});

test("updates Arena Loop master goal and rubric without restarting the battle", () => {
  const battle = buildArenaBattle(payload, {
    id: "battle_goal_update",
    now: "2026-06-23T12:00:00.000Z",
  });

  const updated = updateArenaBattleGoal(battle, {
    master_goal: "Redesign the entire product goal around autonomous QA",
    rubric: "Reward scoped risk reduction, measurable checks, and useful handoffs.",
  }, {
    now: "2026-06-23T12:05:00.000Z",
  });
  const updateEvent = updated.events[updated.events.length - 1];

  assert.equal(updated.id, battle.id);
  assert.equal(updated.master_goal, "Redesign the entire product goal around autonomous QA");
  assert.equal(updated.rubric, "Reward scoped risk reduction, measurable checks, and useful handoffs.");
  assert.notEqual(updated.slug, battle.slug);
  assert.match(updated.slug, /^redesign-the-entire-product-goal-around-autonomo-/);
  assert.equal(updated.updated_at, "2026-06-23T12:05:00.000Z");
  assert.equal(updateEvent.event, "battle.goal.updated");
  assert.equal(updateEvent.payload?.previous_master_goal, payload.master_goal);
  assert.equal(updateEvent.payload?.master_goal, "Redesign the entire product goal around autonomous QA");
  assert.equal(updateEvent.payload?.previous_rubric, payload.rubric);
  assert.equal(updateEvent.payload?.rubric, "Reward scoped risk reduction, measurable checks, and useful handoffs.");

  const unchanged = updateArenaBattleGoal(updated, {
    master_goal: updated.master_goal,
    rubric: updated.rubric,
  });
  assert.equal(unchanged, updated);
});

test("Arena Loop turns honor disabled web research even when a search provider is configured", async () => {
  const searchCalls: string[] = [];
  const battle = buildArenaBattle({
    ...payload,
    research_enabled: false,
    config: {
      arenaLoop: {
        searchProvider: "searxng",
        searchEndpointUrl: "http://localhost:8080/search",
        maxQueriesPerTurn: 2,
        maxSourcesPerTurn: 2,
      },
    },
  }, {
    id: "battle_research_disabled",
    now: "2026-06-23T12:00:00.000Z",
  });
  const fakeFetch = (async (url: string | URL) => {
    searchCalls.push(String(url));
    throw new Error("Search should not run when research is disabled.");
  }) as typeof fetch;

  const nextBattle = await runArenaBattleTurnWithSearch(battle, "agentA", {
    now: "2026-06-23T12:01:00.000Z",
    fetchImpl: fakeFetch,
  });
  const exported = buildArenaBattleJsonlExport(nextBattle, "2026-06-23T12:02:00.000Z");
  const trajectoryRow = JSON.parse(exported.files["loop_trajectories.jsonl"].trim());

  assert.equal(battle.config.research_enabled, false);
  assert.equal(battle.config.search_provider, "searxng");
  assert.deepEqual(searchCalls, []);
  assert.equal(nextBattle.sources.length, 0);
  assert.deepEqual(nextBattle.turns[0].source_ids_used, []);
  assert.deepEqual(nextBattle.turns[0].loop_trajectory.research_queries, []);
  assert.deepEqual(nextBattle.turns[0].loop_trajectory.source_usage, []);
  assert.match(nextBattle.turns[0].prompt_context_snapshot, /No research sources available\./);
  assert.equal(nextBattle.events.some((event) => event.event === "research.started"), false);
  assert.equal(nextBattle.events.some((event) => event.event === "research.completed"), false);
  assert.equal(exported.manifest.row_counts["web_research.jsonl"], 0);
  assert.equal(exported.files["web_research.jsonl"], "");
  assert.deepEqual(trajectoryRow.research_queries, []);
});

test("persists Arena Loop search provider settings from agent config", () => {
  const { limits: _limits, ...payloadWithoutLimits } = payload;
  const battle = buildArenaBattle({
    ...payloadWithoutLimits,
    config: {
      arenaLoop: {
        searchProvider: "searxng",
        searchEndpointUrl: "http://localhost:8080/search",
        searchTimeoutMs: 7000,
        maxLoopPasses: 3,
        maxSourcesPerTurn: 1,
      },
    },
  }, {
    id: "battle_search_config",
    now: "2026-06-23T12:00:00.000Z",
  });

  assert.equal(battle.config.search_provider, "searxng");
  assert.equal(battle.config.search_endpoint_url, "http://localhost:8080/search");
  assert.equal(battle.config.search_timeout_ms, 7000);
  assert.equal(battle.config.limits.maxLoopPasses, 3);
  assert.equal(battle.config.limits.maxSourcesPerTurn, 1);
});

test("Arena Loop JSONL export contains manifest and parseable row files", () => {
  const battle = runArenaBattleTurn(buildArenaBattle(payload, {
    id: "battle_export_test",
    now: "2026-06-23T12:00:00.000Z",
  }), "agentA", {
    now: "2026-06-23T12:01:00.000Z",
  });
  const exported = buildArenaBattleJsonlExport(battle, "2026-06-23T12:02:00.000Z");

  assert.equal(exported.manifest.schema_version, "arena-loop-battle-export-v1");
  assert.equal(exported.manifest.row_counts["arguments.jsonl"], 1);
  assert.equal(exported.manifest.row_counts["preference_or_dpo_judge.jsonl"], 1);
  assert.equal(exported.manifest.model_provider_metadata.turns[0].provider, "mock");
  assert.equal(exported.manifest.model_provider_metadata.turns[0].model, "mock-local");
  assert.equal(exported.manifest.model_provider_metadata.turns[0].round_winner, "agentA");
  const weightedRow = JSON.parse(exported.files["weighted_sft.jsonl"].trim());
  assert.equal(weightedRow.metadata.provider, "mock");
  assert.equal(weightedRow.metadata.model, "mock-local");
  assert.equal(weightedRow.metadata.round_winner, "agentA");
  const trajectoryRow = JSON.parse(exported.files["loop_trajectories.jsonl"].trim());
  assert.equal(trajectoryRow.candidates.length, 4);
  assert.equal(trajectoryRow.critiques.length, 4);
  assert.match(trajectoryRow.selected_candidate_id, /^C\d{2}-\d{2}$/);
  assert.equal(trajectoryRow.usage_metadata.provider, "mock");
  assert.equal(trajectoryRow.round_winner, "agentA");
  const preferenceRow = JSON.parse(exported.files["preference_or_dpo_judge.jsonl"].trim());
  assert.equal(preferenceRow.comparison_scope, "same_turn_loop_candidates");
  assert.equal(preferenceRow.metadata.turn_id, battle.turns[0].id);
  assert.equal(preferenceRow.metadata.side, "agentA");
  assert.match(preferenceRow.metadata.comparison_basis, /same prompt\/context/);
  assert.match(preferenceRow.judge_reason, /local preference signals, not ground truth/);
  assert.match(battle.turns[0].prompt_context_snapshot, /Win-drive guidance: Agent Alpha has win_drive 0\.7/);
  assert.match(battle.turns[0].prompt_context_snapshot, /must not override truthfulness, safety, evidence quality/);

  for (const [name, content] of Object.entries(exported.files)) {
    if (!content.trim()) continue;
    for (const line of content.trim().split(/\r?\n/)) {
      assert.doesNotThrow(() => JSON.parse(line), `${name} should contain valid JSONL`);
    }
  }
});

test("Arena Loop research bundle ZIP includes manifest and JSONL files", () => {
  const battle = runArenaBattleTurn(buildArenaBattle(payload, {
    id: "battle_zip_export_test",
    now: "2026-06-23T12:00:00.000Z",
  }), "agentA", {
    now: "2026-06-23T12:01:00.000Z",
  });
  const zip = buildArenaBattleResearchBundleZip(battle, "2026-06-23T12:02:00.000Z");
  const zipText = zip.toString("latin1");

  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.match(zipText, /manifest\.json/);
  assert.match(zipText, /events\.jsonl/);
  assert.match(zipText, /arguments\.jsonl/);
  assert.match(zipText, /sft\.jsonl/);
  assert.match(zipText, /weighted_sft\.jsonl/);
  assert.match(zipText, /preference_or_dpo_judge\.jsonl/);
  assert.match(zipText, /loop_trajectories\.jsonl/);
  assert.match(zipText, /web_research\.jsonl/);
});

test("configured Arena Loop search provider feeds generated turn sources", async () => {
  const { limits: _limits, ...payloadWithoutLimits } = payload;
  const battle = buildArenaBattle({
    ...payloadWithoutLimits,
    config: {
      arenaLoop: {
        searchProvider: "searxng",
        searchEndpointUrl: "http://localhost:8080/search",
        maxLoopPasses: 2,
        maxQueriesPerTurn: 2,
        maxSourcesPerTurn: 2,
      },
    },
  }, {
    id: "battle_search_turn",
    now: "2026-06-23T12:00:00.000Z",
  });
  const queries: string[] = [];
  const fakeFetch = (async (url: string | URL) => {
    const query = new URL(String(url)).searchParams.get("q") || "";
    queries.push(query);
    return new Response(JSON.stringify({
    results: [
      { title: `External search result ${queries.length}`, url: `https://example.com/research-${queries.length}`, content: `Research excerpt ${queries.length}` },
    ],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const nextBattle = await runArenaBattleTurnWithSearch(battle, "agentA", {
    now: "2026-06-23T12:01:00.000Z",
    fetchImpl: fakeFetch,
  });

  assert.equal(queries.length, 2);
  assert.match(queries[0], /cooperative evidence/);
  assert.match(queries[1], /objections from adversarial perspective/);
  assert.equal(nextBattle.sources[0].provider, "searxng");
  assert.deepEqual(nextBattle.turns[0].source_ids_used, ["S01", "S02"]);
  assert.match(nextBattle.turns[0].response, /Cites S01, S02/);
  assert.equal(nextBattle.turns[0].loop_trajectory.candidates.length, 4);
  assert.deepEqual(nextBattle.turns[0].loop_trajectory.research_queries, queries);
  assert.match(nextBattle.turns[0].prompt_context_snapshot, /External search result 1/);
  assert.match(nextBattle.turns[0].prompt_context_snapshot, /External search result 2/);
  const researchCompleted = nextBattle.events.find((event) => event.event === "research.completed");
  assert.deepEqual(researchCompleted?.payload?.queries, queries);
  assert.equal(nextBattle.events.some((event) => event.event === "research.completed"), true);
});

test("standalone Arena Loop turn uses the selected model provider when configured", async () => {
  const priorFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
  const battle = buildArenaBattle({
    ...payload,
    agentConfig: {
      ...agentConfigPayload,
      agentA: {
        ...agentConfigPayload.agentA,
        provider: "custom-http",
        model: "arena-custom-model",
        endpointUrl: "http://127.0.0.1:8787/cognitive-pong",
      },
    },
  }, {
    id: "battle_provider_turn",
    now: "2026-06-23T12:00:00.000Z",
  });

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}"));
    calls.push({ url: String(url), init: init || {}, body });
    return new Response(JSON.stringify({
      thesis: "Provider generated the standalone Arena turn.",
      strategy: "Use the configured custom HTTP model route.",
      confidence: 0.84,
      points: [
        {
          claim: "The async Arena turn path now calls the selected provider.",
          reasoning: "The provider receives the Arena prompt context and returns the published move.",
          relation: "supports",
          target_argument_ids: [],
          source_ids: ["S01"],
          expected_impact: 0.84,
          uncertainty: 0.16,
          tags: ["provider-backed", "arena-loop"],
        },
        {
          claim: "Invalid provider source IDs are removed before storage.",
          reasoning: "Only retrieved source IDs should survive into structured points and exports.",
          relation: "clarifies",
          target_argument_ids: ["R01-B-P01"],
          source_ids: ["S01", "S99"],
          expected_impact: 0.64,
          uncertainty: 0.36,
          tags: ["source-filtering"],
        },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const nextBattle = await runArenaBattleTurnWithSearch(battle, "agentA", {
      now: "2026-06-23T12:01:00.000Z",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:8787/cognitive-pong");
    assert.equal(calls[0].body.model, "arena-custom-model");
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.match(calls[0].body.prompt, /Required response schema/);
    assert.match(nextBattle.turns[0].response, /Provider generated the standalone Arena turn/);
    assert.equal(nextBattle.turns[0].usage_metadata.provider, "custom-http");
    assert.equal(nextBattle.turns[0].usage_metadata.model, "arena-custom-model");
    assert.equal(nextBattle.turns[0].usage_metadata.mock, false);
    assert.equal(nextBattle.turns[0].usage_metadata.provider_runtime?.raw_response?.type, "custom-http.cognitive-pong");
    assert.equal(nextBattle.turns[0].round_winner, "agentA");
    assert.equal(nextBattle.turns[0].structured_points.length, 2);
    assert.deepEqual(nextBattle.turns[0].structured_points[0].source_ids, ["S01"]);
    assert.deepEqual(nextBattle.turns[0].structured_points[1].source_ids, ["S01"]);
    assert.deepEqual(nextBattle.turns[0].source_ids_used, ["S01"]);
    assert.deepEqual(nextBattle.arguments.map((argument) => argument.id), ["R01-A-P01", "R01-A-P02"]);
    assert.equal(nextBattle.arguments[1].claim, "Invalid provider source IDs are removed before storage.");
    assert.deepEqual(nextBattle.arguments[1].target_argument_ids, ["R01-B-P01"]);
    const completed = nextBattle.events.find((event) => event.event === "turn.completed");
    assert.deepEqual(completed?.payload?.argumentIds, ["R01-A-P01", "R01-A-P02"]);
  } finally {
    globalThis.fetch = priorFetch;
  }
});

test("standalone Arena Loop turn can use a persisted per-agent CLI bridge", async () => {
  const prior = {
    localBridges: process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES,
    cliProfiles: process.env.COGNITIVE_PONG_CLI_PROFILES,
  };
  process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES = "true";
  const bridgeScript = [
    "const prompt = process.argv[1] || '';",
    "console.log(JSON.stringify({",
    "  thesis: prompt.includes('Required response schema') ? 'CLI bridge generated the Arena turn.' : 'Prompt missing schema.',",
    "  strategy: 'Use the per-agent local CLI bridge before provider fallback.',",
    "  confidence: 0.81,",
    "  points: [{",
    "    claim: 'The persisted Arena agent can route through a local CLI bridge.',",
    "    reasoning: 'Bridge config is stored without secrets and rehydrated into the standalone Arena runtime.',",
    "    relation: 'supports',",
    "    target_argument_ids: [],",
    "    source_ids: ['S01'],",
    "    expected_impact: 0.81,",
    "    uncertainty: 0.19,",
    "    tags: ['cli-bridge', 'arena-loop']",
    "  }]",
    "}));",
  ].join(" ");
  process.env.COGNITIVE_PONG_CLI_PROFILES = JSON.stringify({
    arena_cli_test: {
      command: process.execPath,
      args: ["-e", bridgeScript, "{prompt}"],
      timeoutMs: 3000,
    },
  });
  const battle = buildArenaBattle({
    ...payload,
    agentConfig: {
      ...agentConfigPayload,
      agentA: {
        ...agentConfigPayload.agentA,
        bridge: {
          kind: "cli",
          label: "Agent A local CLI",
          profileId: "arena_cli_test",
          command: "ignored-browser-command",
          args: ["ignored"],
          apiKey: "do-not-store-this-secret",
          timeoutMs: 3000,
        },
      },
    },
  }, {
    id: "battle_cli_bridge_turn",
    now: "2026-06-23T12:00:00.000Z",
  });

  try {
    const nextBattle = await runArenaBattleTurnWithSearch(battle, "agentA", {
      now: "2026-06-23T12:01:00.000Z",
    });

    assert.equal(battle.agent_a_profile.bridge?.kind, "cli");
    assert.equal(battle.agent_a_profile.bridge?.label, "Agent A local CLI");
    assert.equal(battle.agent_a_profile.bridge?.profileId, "arena_cli_test");
    assert.equal(battle.agent_a_profile.bridge?.command, undefined);
    assert.equal(battle.agent_a_profile.bridge?.args, undefined);
    assert.equal(battle.agent_a_profile.bridge?.apiKey, undefined);
    assert.match(nextBattle.turns[0].response, /CLI bridge generated the Arena turn/);
    assert.equal(nextBattle.turns[0].usage_metadata.provider, "agent-bridge:cli");
    assert.equal(nextBattle.turns[0].usage_metadata.model, "Agent A local CLI");
    assert.equal(nextBattle.turns[0].usage_metadata.mock, false);
    assert.equal(nextBattle.turns[0].usage_metadata.provider_runtime?.provider_id, "agent-bridge:cli");
    assert.equal(nextBattle.arguments[0].claim, "The persisted Arena agent can route through a local CLI bridge.");
    assert.deepEqual(nextBattle.arguments[0].source_ids, ["S01"]);
  } finally {
    if (prior.localBridges === undefined) {
      delete process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES;
    } else {
      process.env.COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES = prior.localBridges;
    }
    if (prior.cliProfiles === undefined) {
      delete process.env.COGNITIVE_PONG_CLI_PROFILES;
    } else {
      process.env.COGNITIVE_PONG_CLI_PROFILES = prior.cliProfiles;
    }
  }
});

test("appends live Pong debate turns with stable argument and source ledger data", () => {
  const battle = buildArenaBattle(payload, {
    id: "battle_append_test",
    now: "2026-06-23T12:00:00.000Z",
  });

  const afterFirst = appendArenaBattleTurn(battle, {
    id: "live-turn-a",
    sender: "agentA",
    content: "Use a bounded adapter so the live Pong loop can persist research-grade turns.",
    type: "proposal",
    proposal: "Persisted Arena Loop bridge",
    convictionScore: 86,
    timestamp: "2026-06-23T12:01:00.000Z",
    searchSources: [
      { title: "Bridge source", uri: "mock://arena-loop/live-source" },
    ],
    complexity: "deep research",
  }, "agentA", {
    now: "2026-06-23T12:01:00.000Z",
    provider: "mock",
    model: "mock-local",
    latencyMs: 23,
    providerMetadata: {
      provider_id: "mock",
      model_id: "mock-local",
      latency_ms: 23,
      token_usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
      raw_response: { type: "mock.synthetic", preview: "local mock preview" },
    },
  });

  assert.equal(afterFirst.turns.length, 1);
  assert.equal(afterFirst.arguments[0].id, "R01-A-P01");
  assert.equal(afterFirst.turns[0].round_winner, "agentA");
  assert.deepEqual(afterFirst.arguments[0].source_ids, ["S01"]);
  assert.equal(afterFirst.turns[0].loop_trajectory.selected_candidate_id, "LIVE-01");
  assert.equal(afterFirst.turns[0].loop_trajectory.candidates.length, 1);
  assert.equal(afterFirst.turns[0].loop_trajectory.final_scored_result.impact, afterFirst.turns[0].score.impact);
  assert.equal(afterFirst.turns[0].latency_ms, 23);
  assert.equal(afterFirst.turns[0].usage_metadata.provider_runtime?.token_usage?.total_tokens, 12);
  assert.equal(afterFirst.turns[0].usage_metadata.provider_runtime?.raw_response?.type, "mock.synthetic");
  assert.equal(afterFirst.sources[0].id, "S01");
  assert.equal(afterFirst.events.some((event) => event.event === "research.completed"), true);

  const afterSecond = appendArenaBattleTurn(afterFirst, {
    id: "live-turn-b",
    sender: "agentB",
    content: "Attack the persistence bridge unless duplicate starts are guarded.",
    type: "critique",
    convictionScore: 75,
    timestamp: "2026-06-23T12:02:00.000Z",
    searchSources: [
      { title: "Second source", uri: "mock://arena-loop/second-source" },
    ],
  }, "agentB", {
    now: "2026-06-23T12:02:00.000Z",
    complete: true,
  });

  assert.equal(afterSecond.status, "completed");
  assert.equal(afterSecond.arguments[1].id, "R02-B-P01");
  assert.equal(afterSecond.turns[1].round_winner, "agentB");
  assert.deepEqual(afterSecond.arguments[1].target_argument_ids, ["R01-A-P01"]);
  assert.deepEqual(afterSecond.arguments[1].source_ids, ["S02"]);
  assert.match(afterSecond.turns[1].prompt_context_snapshot, /High-value unresolved arguments:\nR01-A-P01/);
  assert.equal(afterSecond.turns[0].usage_metadata.provider, "mock");
  assert.equal(afterSecond.turns[0].usage_metadata.model, "mock-local");
  const liveExport = buildArenaBattleJsonlExport(afterSecond, "2026-06-23T12:03:00.000Z");
  const liveTrajectory = JSON.parse(liveExport.files["loop_trajectories.jsonl"].trim().split(/\r?\n/)[0]);
  const liveWeighted = JSON.parse(liveExport.files["weighted_sft.jsonl"].trim().split(/\r?\n/)[0]);
  assert.equal(liveTrajectory.usage_metadata.provider_runtime.token_usage.total_tokens, 12);
  assert.equal(liveWeighted.metadata.provider_runtime.raw_response.type, "mock.synthetic");
  assert.equal(afterSecond.sources.map((source) => source.id).join(","), "S01,S02");
  assert.equal(afterSecond.events.at(-1)?.event, "battle.completed");
  assert.equal(liveExport.manifest.row_counts["preference_or_dpo_judge.jsonl"], 0);
  assert.equal(liveExport.files["preference_or_dpo_judge.jsonl"], "");
});

test("low-confidence live turns keep the round winner as tie", () => {
  const battle = buildArenaBattle(payload, {
    id: "battle_round_tie_test",
    now: "2026-06-23T12:00:00.000Z",
  });

  const afterTurn = appendArenaBattleTurn(battle, {
    id: "low-confidence-turn",
    sender: "agentA",
    content: "No.",
    type: "proposal",
    convictionScore: 1,
    timestamp: "2026-06-23T12:01:00.000Z",
  }, "agentA", {
    now: "2026-06-23T12:01:00.000Z",
  });

  assert.equal(afterTurn.turns[0].round_winner, "tie");
  assert.equal(afterTurn.events.find((event) => event.event === "turn.completed")?.payload?.roundWinner, "tie");
});

test("reconstructs replay turns from stored Arena Loop battle data", () => {
  const battle = appendArenaBattleTurn(buildArenaBattle(payload, {
    id: "battle_replay_test",
    now: "2026-06-23T12:00:00.000Z",
  }), {
    id: "live-replay-turn",
    sender: "agentA",
    content: "Replay this persisted turn.",
    type: "proposal",
    proposal: "Replayable persisted turn",
    convictionScore: 88,
    timestamp: "2026-06-23T12:01:00.000Z",
    searchSources: [{ title: "Replay source", uri: "mock://arena-loop/replay-source" }],
  }, "agentA", {
    now: "2026-06-23T12:01:00.000Z",
  });

  const replay = reconstructArenaBattleReplay(battle);

  assert.equal(replay.length, 1);
  assert.equal(replay[0].id, "live-replay-turn");
  assert.equal(replay[0].sender, "agentA");
  assert.equal(replay[0].proposal, "Replayable persisted turn");
  assert.deepEqual(replay[0].searchSources, [{ title: "Replay source", uri: "mock://arena-loop/replay-source" }]);
  assert.equal(replay[0].judgeEvaluation?.verdictComment, "Local deterministic judge scores are research signals, not ground truth.");
});

test("Arena Loop router creates a battle, runs a turn, and exports JSONL", async () => {
  const store = tempStore();
  const app = express();
  app.use(express.json());
  app.use("/api/arena-loop", createArenaLoopRouter(store));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${(address as any).port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/api/arena-loop/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as any;
    assert.equal(created.success, true);
    assert.equal(readArenaBattles(store).length, 1);

    const goalResponse = await fetch(`${baseUrl}/api/arena-loop/battle/${created.battle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        master_goal: "Retarget this battle to a full-goal migration plan",
        rubric: "Reward end-to-end goal fit and verifiable next actions.",
      }),
    });
    assert.equal(goalResponse.status, 200);
    const goalUpdate = await goalResponse.json() as any;
    assert.equal(goalUpdate.success, true);
    assert.equal(goalUpdate.battle.master_goal, "Retarget this battle to a full-goal migration plan");
    assert.equal(goalUpdate.battle.rubric, "Reward end-to-end goal fit and verifiable next actions.");
    assert.match(goalUpdate.battle.slug, /^retarget-this-battle-to-a-full-goal-migration-pl-/);
    assert.equal(goalUpdate.battle.events.some((event: any) => event.event === "battle.goal.updated"), true);

    const turnResponse = await fetch(`${baseUrl}/api/arena-loop/battle/${created.battle.id}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: "agentA" }),
    });
    assert.equal(turnResponse.status, 200);
    const turn = await turnResponse.json() as any;
    assert.equal(turn.success, true);
    assert.equal(turn.turn.round_number, 1);
    assert.equal(turn.argument.id, "R01-A-P01");

    const exportResponse = await fetch(`${baseUrl}/api/arena-loop/battle/${created.battle.id}/export/jsonl`);
    assert.equal(exportResponse.status, 200);
    const exported = await exportResponse.json() as any;
    assert.equal(exported.success, true);
    assert.equal(exported.export.manifest.row_counts["arguments.jsonl"], 1);
    assert.match(exported.export.files["events.jsonl"], /turn.completed/);
    assert.match(exported.export.files["events.jsonl"], /battle.goal.updated/);

    const replayResponse = await fetch(`${baseUrl}/api/arena-loop/battle/${created.battle.id}/replay`);
    assert.equal(replayResponse.status, 200);
    const replayed = await replayResponse.json() as any;
    assert.equal(replayed.success, true);
    assert.equal(replayed.replay.length, 1);
    assert.equal(replayed.replay[0].id, "turn_1_agentA");

    const zipResponse = await fetch(`${baseUrl}/api/arena-loop/battle/${created.battle.id}/export/research-bundle.zip`);
    assert.equal(zipResponse.status, 200);
    assert.equal(zipResponse.headers.get("content-type"), "application/zip");
    const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
    assert.equal(zipBuffer.readUInt32LE(0), 0x04034b50);
    assert.match(zipBuffer.toString("latin1"), /manifest\.json/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});

test("Arena Loop router appends live debate turns without creating another battle", async () => {
  const store = tempStore();
  const app = express();
  app.use(express.json());
  app.use("/api/arena-loop", createArenaLoopRouter(store));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${(address as any).port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/api/arena-loop/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const created = await createResponse.json() as any;
    assert.equal(created.success, true);

    const appendResponse = await fetch(`${baseUrl}/api/arena-loop/battle/${created.battle.id}/turn/debate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        side: "agentB",
        turn: {
          id: "router-live-turn",
          sender: "agentB",
          content: "Router appends the existing live turn into the Arena Loop ledger.",
          type: "critique",
          convictionScore: 73,
          searchSources: [{ title: "Router source", uri: "mock://arena-loop/router-source" }],
        },
      }),
    });
    assert.equal(appendResponse.status, 200);
    const appended = await appendResponse.json() as any;

    assert.equal(appended.success, true);
    assert.equal(appended.turn.round_number, 1);
    assert.equal(appended.argument.id, "R01-B-P01");
    assert.deepEqual(appended.argument.source_ids, ["S01"]);
    assert.equal(readArenaBattles(store).length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});
