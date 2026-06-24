import assert from "node:assert/strict";
import test from "node:test";
import { AgentConfig, DebateTurn, FinalizedTask } from "../src/types";
import { REDACTED_EXPORT_VALUE } from "../src/utils/exportRedaction";
import {
  SessionExportInput,
  buildMarkdownExport,
  buildSessionArtifact,
  buildTranscriptExport,
} from "../src/utils/sessionExports";

const agentConfig: AgentConfig = {
  agentA: {
    name: "Agent Alpha",
    role: "Makes proposals",
    color: "emerald",
    avatar: "A",
    provider: "openai-compatible",
    model: "gpt-4o-mini",
    customApiKey: "sk-secret-alpha",
  },
  agentB: {
    name: "Agent Beta",
    role: "Challenges assumptions",
    color: "rose",
    avatar: "B",
    provider: "huggingface",
    model: "Qwen/Qwen2.5-7B-Instruct",
    customApiKey: "hf-secret-beta",
  },
  useGrounding: true,
  baseSpeed: 3,
  model: "mock-local",
};

const history: DebateTurn[] = [
  {
    id: "turn-1",
    sender: "agentA",
    content: "Agent Alpha proposed a controlled migration path.",
    type: "proposal",
    proposal: "Create a controlled migration plan.",
    convictionScore: 82,
    timestamp: "10:00:00 AM",
    complexity: "deep research",
  },
  {
    id: "turn-2",
    sender: "agentB",
    content: "Agent Beta challenged rollback coverage.",
    type: "critique",
    convictionScore: 71,
    timestamp: "10:01:00 AM",
    complexity: "deep research",
  },
];

const finalizedTasks: FinalizedTask[] = [
  {
    id: "task-1",
    title: "Rollback validation gate",
    summary: "Require automated rollback verification before migration.",
    confidence: 91,
    approvedBy: "Agent Alpha",
    timestamp: "10:02:00 AM",
    complexity: "deep research",
    influencedByTurnId: "turn-1",
  },
];

function baseInput(): SessionExportInput {
  return {
    sessionId: "TEST-SESSION",
    topic: "Design a safer migration plan",
    loopMode: "Debate",
    status: "paused",
    statusLabel: "Paused",
    victoryCondition: "Reach a defensible migration plan.",
    maxVolleys: 12,
    agentConfig,
    gameSpeed: 2,
    scoreA: 1,
    scoreB: 0,
    history,
    finalizedTasks,
    averageJudgeScore: 84,
    currentComplexity: "deep research",
    activeTrajectory: "Focus rollback validation",
    isSimulationMode: false,
    fallbackReason: null,
    deployedModel: false,
    density: "comfortable",
  };
}

test("buildTranscriptExport includes turns and synthesis milestones", () => {
  const transcript = buildTranscriptExport(baseInput());

  assert.match(transcript, /Cognitive Pong Transcript Export/);
  assert.match(transcript, /Topic: Design a safer migration plan/);
  assert.match(transcript, /Volley 1 \| Agent Alpha \| proposal \| 10:00:00 AM/);
  assert.match(transcript, /Agent Alpha proposed a controlled migration path/);
  assert.match(transcript, /Proposal: Create a controlled migration plan/);
  assert.match(transcript, /Synthesis Milestones/);
  assert.match(transcript, /Rollback validation gate/);
  assert.match(transcript, /Require automated rollback verification before migration/);
});

test("buildMarkdownExport includes report sections and redacts embedded secrets", () => {
  const markdown = buildMarkdownExport(baseInput());

  assert.match(markdown, /^# Cognitive Pong Session/);
  assert.match(markdown, /\*\*Agents:\*\* Agent Alpha vs Agent Beta/);
  assert.match(markdown, /## Transcript/);
  assert.match(markdown, /### Volley 2: Agent Beta \(critique\)/);
  assert.match(markdown, /## Synthesis Milestones/);
  assert.match(markdown, /- \*\*Rollback validation gate\*\* \(91%\)/);
  assert.match(markdown, /"customApiKey": "\[redacted\]"/);
  assert.equal(markdown.includes("sk-secret-alpha"), false);
  assert.equal(markdown.includes("hf-secret-beta"), false);
});

test("buildSessionArtifact redacts agent secrets while preserving useful provider metadata", () => {
  const artifact = buildSessionArtifact(baseInput());

  assert.equal(artifact.agents[0].customApiKey, REDACTED_EXPORT_VALUE);
  assert.equal(artifact.agents[1].customApiKey, REDACTED_EXPORT_VALUE);
  assert.equal(artifact.agents[0].provider, "openai-compatible");
  assert.equal(artifact.agents[1].model, "Qwen/Qwen2.5-7B-Instruct");
  assert.equal(artifact.artifacts.length, 1);
  assert.equal(artifact.transcript.length, 2);
});
