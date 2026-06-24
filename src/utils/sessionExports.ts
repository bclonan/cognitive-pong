import { AgentConfig, DebateTurn, FinalizedTask } from "../types";
import { redactAgentConfigForExport } from "./exportRedaction";
import { getTurnSenderDisplay } from "./turnDisplay";

export interface SessionExportInput {
  sessionId: string;
  topic: string;
  loopMode: string;
  status: string;
  statusLabel: string;
  victoryCondition: string;
  maxVolleys: number;
  agentConfig: AgentConfig;
  gameSpeed: number;
  scoreA: number;
  scoreB: number;
  history: DebateTurn[];
  finalizedTasks: FinalizedTask[];
  averageJudgeScore: number | null;
  currentComplexity: string;
  activeTrajectory: string | null;
  isSimulationMode: boolean;
  fallbackReason: string | null;
  deployedModel: boolean;
  density: string;
}

export function buildSessionArtifact(input: SessionExportInput) {
  const redactedAgentConfig = redactAgentConfigForExport(input.agentConfig);

  return {
    sessionId: input.sessionId,
    topic: input.topic,
    mode: input.loopMode,
    status: input.status,
    victoryCondition: input.victoryCondition,
    maxVolleys: input.maxVolleys,
    agents: [redactedAgentConfig.agentA, redactedAgentConfig.agentB],
    settings: {
      useGrounding: redactedAgentConfig.useGrounding,
      baseSpeed: redactedAgentConfig.baseSpeed,
      gameSpeed: input.gameSpeed,
      model: redactedAgentConfig.model,
      defaultComplexity: redactedAgentConfig.defaultComplexity,
      arenaSettings: redactedAgentConfig.arenaSettings,
      bridge: redactedAgentConfig.bridge,
      density: input.density,
    },
    scores: { agentA: input.scoreA, agentB: input.scoreB },
    metrics: {
      volleys: input.history.length,
      finalizedTasks: input.finalizedTasks.length,
      averageJudgeScore: input.averageJudgeScore,
      currentComplexity: input.currentComplexity,
    },
    transcript: input.history,
    artifacts: input.finalizedTasks,
    diagnostics: {
      activeTrajectory: input.activeTrajectory,
      isSimulationMode: input.isSimulationMode,
      fallbackReason: input.fallbackReason,
      deployedModel: input.deployedModel,
    },
  };
}

export function buildTranscriptExport(input: SessionExportInput) {
  const lines = [
    "Cognitive Pong Transcript Export",
    "",
    `Topic: ${input.topic || "Untitled session"}`,
    `Mode: ${input.loopMode}`,
    `Status: ${input.statusLabel}`,
    `Agents: ${input.agentConfig.agentA.name} vs ${input.agentConfig.agentB.name}`,
    `Score: ${input.scoreA} - ${input.scoreB}`,
    "",
    "Transcript",
    "",
    input.history.length
      ? input.history
          .map((turn, index) => {
            const speaker = getTurnSenderDisplay(turn.sender, input.agentConfig).name;
            return [
              `Volley ${index + 1} | ${speaker} | ${turn.type} | ${turn.timestamp}`,
              turn.content,
              turn.proposal ? `Proposal: ${turn.proposal}` : "",
            ].filter(Boolean).join("\n");
          })
          .join("\n\n---\n\n")
      : "No volleys have been recorded yet.",
    "",
    "Synthesis Milestones",
    "",
    input.finalizedTasks.length
      ? input.finalizedTasks
          .map((task, index) => [
            `${index + 1}. ${task.title}`,
            `Confidence: ${task.confidence}%`,
            `Approved by: ${task.approvedBy}`,
            `Summary: ${task.summary}`,
          ].join("\n"))
          .join("\n\n")
      : "No synthesis milestones have been locked yet.",
  ];

  return lines.join("\n");
}

export function buildMarkdownExport(input: SessionExportInput) {
  const artifact = buildSessionArtifact(input);
  return [
    "# Cognitive Pong Session",
    "",
    `**Topic:** ${input.topic || "Untitled session"}`,
    `**Mode:** ${input.loopMode}`,
    `**Status:** ${input.statusLabel}`,
    `**Agents:** ${input.agentConfig.agentA.name} vs ${input.agentConfig.agentB.name}`,
    `**Score:** ${input.scoreA} - ${input.scoreB}`,
    "",
    "## Transcript",
    input.history.length
      ? input.history
          .map((turn, index) => {
            const speaker = getTurnSenderDisplay(turn.sender, input.agentConfig).name;
            return `### Volley ${index + 1}: ${speaker} (${turn.type})\n\n${turn.content}`;
          })
          .join("\n\n")
      : "No volleys have been recorded yet.",
    "",
    "## Synthesis Milestones",
    input.finalizedTasks.length
      ? input.finalizedTasks.map((task) => `- **${task.title}** (${task.confidence}%): ${task.summary}`).join("\n")
      : "No synthesis milestones have been locked yet.",
    "",
    "<!-- Session JSON snapshot -->",
    "```json",
    JSON.stringify(artifact, null, 2),
    "```",
  ].join("\n");
}
