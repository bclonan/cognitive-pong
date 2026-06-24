import assert from "node:assert/strict";
import test from "node:test";
import {
  genericTurnSenderLabel,
  getNextAgentAfterTurn,
  getTurnSenderDisplay,
  isAgentTurnSender,
} from "../src/utils/turnDisplay";
import { AgentConfig } from "../src/types";

const agentConfig: AgentConfig = {
  agentA: {
    name: "Agent Alpha",
    role: "Advocate",
    color: "#00FF41",
    avatar: "A",
  },
  agentB: {
    name: "Agent Beta",
    role: "Critic",
    color: "#FF4100",
    avatar: "B",
  },
  useGrounding: false,
  baseSpeed: 1,
  model: "mock-local",
};

test("labels moderator turns independently from Agent A and Agent B", () => {
  const moderator = getTurnSenderDisplay("moderator", agentConfig);

  assert.equal(moderator.name, "Human Moderator");
  assert.equal(moderator.role, "Referee Intervention");
  assert.equal(moderator.avatar, "MOD");
  assert.equal(moderator.color, "#FBBF24");
});

test("keeps agent sender helpers scoped to actual agents", () => {
  assert.equal(isAgentTurnSender("agentA"), true);
  assert.equal(isAgentTurnSender("agentB"), true);
  assert.equal(isAgentTurnSender("moderator"), false);
  assert.equal(getNextAgentAfterTurn("agentA"), "agentB");
  assert.equal(getNextAgentAfterTurn("agentB"), "agentA");
  assert.equal(getNextAgentAfterTurn("moderator"), "agentA");
  assert.equal(genericTurnSenderLabel("moderator"), "Human Moderator");
});
