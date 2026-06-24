import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendStoredMatch,
  buildLeaderboard,
  buildStoredMatch,
  cleanFinalizedTasks,
  MatchValidationError,
  readMatches,
  SEED_MATCHES,
} from "../server/matchStore";

const validPayload = {
  topic: "  Build a resilient provider-neutral arena.  ",
  agentConfig: {
    model: "mock-local",
    agentA: {
      name: "Agent A",
      provider: "mock",
      model: "mock-local",
      competitiveDrive: 150,
      strategyBias: "cooperative",
    },
    agentB: {
      name: "Agent B",
      provider: "ollama",
      customModel: "llama3",
      competitiveDrive: -20,
      strategyBias: "adversarial",
    },
  },
  scoreA: 2.4,
  scoreB: 1.2,
  cycleCount: 4,
  consensusCount: 1,
  isPublic: true,
  finalizedTasks: [
    {
      id: "task-a",
      title: "  Validate adapters  ",
      summary: "Keep providers decoupled.",
      confidence: 104,
      approvedBy: "Agent A",
      timestamp: "now",
      complexity: "deep research",
      influencedByTurnId: "turn-123456789",
    },
  ],
};

test("buildStoredMatch trims and clamps saved match data", () => {
  const match = buildStoredMatch(validPayload, {
    id: "match-test",
    timestamp: "June 22, 2026",
  });

  assert.equal(match.id, "match-test");
  assert.equal(match.topic, "Build a resilient provider-neutral arena.");
  assert.equal(match.timestamp, "June 22, 2026");
  assert.equal(match.agentA.score, 2);
  assert.equal(match.agentB.score, 1);
  assert.equal(match.agentA.competitiveDrive, 100);
  assert.equal(match.agentB.competitiveDrive, 0);
  assert.equal(match.agentB.model, "llama3");
  assert.equal(match.finalizedTasks[0].title, "Validate adapters");
  assert.equal(match.finalizedTasks[0].confidence, 100);
});

test("buildStoredMatch rejects empty or unplayed matches", () => {
  assert.throws(
    () => buildStoredMatch({ ...validPayload, topic: "   " }),
    MatchValidationError
  );

  assert.throws(
    () => buildStoredMatch({
      ...validPayload,
      scoreA: 0,
      scoreB: 0,
      cycleCount: 0,
      finalizedTasks: [],
    }),
    /Run at least one turn/
  );
});

test("cleanFinalizedTasks caps exported task volume", () => {
  const tasks = Array.from({ length: 105 }, (_, index) => ({
    title: `Task ${index}`,
    summary: "summary",
    confidence: index,
  }));

  const cleaned = cleanFinalizedTasks(tasks);
  assert.equal(cleaned.length, 100);
  assert.equal(cleaned[0].approvedBy, "Unknown agent");
});

test("appendStoredMatch seeds and prepends using an isolated file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cognitive-pong-matches-"));
  const matchesFile = path.join(dir, "matches.json");

  const saved = appendStoredMatch(validPayload, matchesFile);
  const allMatches = readMatches(matchesFile);

  assert.equal(allMatches.length, SEED_MATCHES.length + 1);
  assert.equal(allMatches[0].id, saved.id);
  assert.equal(allMatches[0].topic, "Build a resilient provider-neutral arena.");
});

test("buildLeaderboard ignores private matches and sorts by rating", () => {
  const leaderboard = buildLeaderboard([
    {
      isPublic: true,
      agentA: { name: "A", provider: "mock", model: "mock-local", score: 3 },
      agentB: { name: "B", provider: "ollama", model: "llama3", score: 1 },
      finalizedTasks: [{ approvedBy: "A", confidence: 90 }],
    },
    {
      isPublic: false,
      agentA: { name: "Private", provider: "gemini", model: "private-model", score: 99 },
      agentB: { name: "Hidden", provider: "mock", model: "hidden-model", score: 0 },
      finalizedTasks: [{ approvedBy: "Private", confidence: 100 }],
    },
  ]);

  assert.equal(leaderboard.some((entry) => entry.modelName === "private-model"), false);
  assert.equal(leaderboard[0].modelName, "mock-local");
  assert.equal(leaderboard[0].wins, 1);
});
