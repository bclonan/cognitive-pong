import assert from "node:assert/strict";
import test from "node:test";
import { buildArenaSettingsInstruction, normalizeArenaSettings } from "../src/utils/arenaSettings";

test("normalizes missing or invalid arena settings to defaults", () => {
  const settings = normalizeArenaSettings({
    matchEngine: "unknown" as any,
    populationRange: "32",
    memoryFabric: "graphrag",
    sandboxRules: "bad" as any,
    optimizerMetric: "prompt_mutate",
    promotionStandard: "mutual_consensus",
  });

  assert.equal(settings.matchEngine, "adversarial");
  assert.equal(settings.populationRange, "32");
  assert.equal(settings.memoryFabric, "graphrag");
  assert.equal(settings.sandboxRules, "sandboxed_read_only");
  assert.equal(settings.optimizerMetric, "prompt_mutate");
  assert.equal(settings.promotionStandard, "mutual_consensus");
});

test("builds prompt instructions for selected advanced arena settings", () => {
  const instruction = buildArenaSettingsInstruction({
    matchEngine: "safety_sandbox",
    populationRange: "32",
    memoryFabric: "graphrag",
    sandboxRules: "syntax_verify",
    optimizerMetric: "rlhf",
    promotionStandard: "absolute_90",
  });

  assert.match(instruction, /ADVANCED ARENA SETTINGS/);
  assert.match(instruction, /safety_sandbox/);
  assert.match(instruction, /32/);
  assert.match(instruction, /graphrag/);
  assert.match(instruction, /syntax_verify/);
  assert.match(instruction, /rlhf/);
  assert.match(instruction, /absolute_90/);
  assert.match(instruction, /active runtime constraints/);
});
