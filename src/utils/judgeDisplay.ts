import { DebateTurn } from "../types";

export interface LatestTurnJudgeState {
  latestTurn?: DebateTurn;
  evalData?: DebateTurn["judgeEvaluation"];
  previousEvaluationTurn?: DebateTurn;
}

export function getLatestTurnJudgeState(history: DebateTurn[]): LatestTurnJudgeState {
  const latestTurn = history[history.length - 1];
  const evalData = latestTurn?.judgeEvaluation;
  const previousEvaluationTurn = evalData
    ? undefined
    : [...history]
        .slice(0, -1)
        .reverse()
        .find((turn) => Boolean(turn.judgeEvaluation));

  return {
    latestTurn,
    evalData,
    previousEvaluationTurn,
  };
}
