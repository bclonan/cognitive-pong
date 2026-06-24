import assert from "node:assert/strict";
import test from "node:test";
import { getLatestTurnJudgeState } from "../src/utils/judgeDisplay";
import { DebateTurn } from "../src/types";

const judgedTurn: DebateTurn = {
  id: "turn-1",
  sender: "agentA",
  content: "Judged proposal",
  type: "proposal",
  convictionScore: 88,
  timestamp: "10:00",
  judgeEvaluation: {
    intellectScore: 90,
    precisionScore: 86,
    rhetoricScore: 88,
    isScoreGoal: true,
    verdictComment: "Strong enough to score.",
  },
};

test("uses the latest turn's judge evaluation when present", () => {
  const state = getLatestTurnJudgeState([judgedTurn]);

  assert.equal(state.latestTurn?.id, "turn-1");
  assert.equal(state.evalData?.verdictComment, "Strong enough to score.");
  assert.equal(state.previousEvaluationTurn, undefined);
});

test("does not reuse an older judge evaluation for a newer unjudged turn", () => {
  const moderatorTurn: DebateTurn = {
    id: "turn-2",
    sender: "moderator",
    content: "Human intervention",
    type: "rebuttal",
    convictionScore: 50,
    timestamp: "10:01",
  };

  const state = getLatestTurnJudgeState([judgedTurn, moderatorTurn]);

  assert.equal(state.latestTurn?.id, "turn-2");
  assert.equal(state.evalData, undefined);
  assert.equal(state.previousEvaluationTurn?.id, "turn-1");
});
