import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentPersonaInstruction, buildAgentProfileInstruction } from "../server/agentProfile";

test("agent profile prompt includes psychology, win-drive, risk, collaboration, and safety constraints", () => {
  const instruction = buildAgentProfileInstruction({
    personality: "dry, precise systems thinker",
    psychologyArchetype: "skeptic",
    debateStyle: "adversarial",
    competitiveDrive: 85,
    riskTolerance: 0.2,
    collaborationBias: 0.35,
    aggressiveness: 75,
    empathy: 30,
    strategicTendencies: "Attack weak evidence first.",
    safetyConstraints: "Cite evidence and admit uncertainty.",
  });

  assert.match(instruction, /PERSONALITY: dry, precise systems thinker/);
  assert.match(instruction, /PSYCHOLOGY ARCHETYPE: skeptic/);
  assert.match(instruction, /DEBATE STYLE: adversarial/);
  assert.match(instruction, /WIN DRIVE: 0\.85/);
  assert.match(instruction, /RISK TOLERANCE: 0\.20/);
  assert.match(instruction, /COLLABORATION BIAS: 0\.35/);
  assert.match(instruction, /AGGRESSIVENESS: 75%/);
  assert.match(instruction, /EMPATHY: 30%/);
  assert.match(instruction, /Attack weak evidence first/);
  assert.match(instruction, /Cite evidence and admit uncertainty/);
  assert.match(instruction, /must not override truthfulness, safety, evidence quality, the master goal, or valid schema compliance/);
});

test("agent persona instruction preserves custom instructions", () => {
  const instruction = buildAgentPersonaInstruction({
    systemPrompt: "Use terse rebuttals and cite operational constraints.",
  });

  assert.match(instruction, /CRITICAL CUSTOM INSTRUCTIONS/);
  assert.match(instruction, /Use terse rebuttals and cite operational constraints/);
});
