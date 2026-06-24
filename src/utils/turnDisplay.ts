import { AgentConfig, TurnSender } from "../types";

export type AgentTurnSender = Extract<TurnSender, "agentA" | "agentB">;

export const isAgentTurnSender = (sender: TurnSender): sender is AgentTurnSender =>
  sender === "agentA" || sender === "agentB";

export const genericTurnSenderLabel = (sender: TurnSender) => {
  if (sender === "agentA") return "Advocate";
  if (sender === "agentB") return "Critic";
  return "Human Moderator";
};

export const getNextAgentAfterTurn = (sender?: TurnSender): AgentTurnSender =>
  sender === "agentA" ? "agentB" : "agentA";

export function getTurnSenderDisplay(sender: TurnSender | undefined, agentConfig?: AgentConfig) {
  if (sender === "agentA") {
    return {
      sender: "agentA" as const,
      name: agentConfig?.agentA?.name || "Agent A",
      role: agentConfig?.agentA?.role || "Proponent",
      avatar: agentConfig?.agentA?.avatar || "A",
      textClass: "text-[#00FF41]",
      borderClass: "border-[#00FF41]",
      headerClass: "bg-[#00FF41] text-black",
      barClass: "bg-[#00FF41]",
      color: "#00FF41",
    };
  }

  if (sender === "agentB") {
    return {
      sender: "agentB" as const,
      name: agentConfig?.agentB?.name || "Agent B",
      role: agentConfig?.agentB?.role || "Opponent",
      avatar: agentConfig?.agentB?.avatar || "B",
      textClass: "text-[#FF4100]",
      borderClass: "border-[#FF4100]",
      headerClass: "bg-[#FF4100] text-black",
      barClass: "bg-[#FF4100]",
      color: "#FF4100",
    };
  }

  return {
    sender: "moderator" as const,
    name: "Human Moderator",
    role: "Referee Intervention",
    avatar: "MOD",
    textClass: "text-amber-300",
    borderClass: "border-amber-400",
    headerClass: "bg-amber-400 text-black",
    barClass: "bg-amber-400",
    color: "#FBBF24",
  };
}
