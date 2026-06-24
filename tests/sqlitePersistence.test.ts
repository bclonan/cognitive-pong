import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendStoredMatch,
  readMatches,
  SEED_MATCHES,
} from "../server/matchStore";
import {
  createArenaBattle,
  findArenaBattle,
  readArenaBattles,
  updateArenaBattle,
} from "../server/arenaLoopStore";
import { isSQLiteRuntimeAvailable } from "../server/sqliteStore";

const agentConfig = {
  model: "mock-local",
  useGrounding: false,
  agentA: {
    name: "SQLite Agent A",
    role: "Propose bounded storage plans.",
    provider: "mock",
    model: "mock-local",
    competitiveDrive: 70,
    strategyBias: "cooperative",
  },
  agentB: {
    name: "SQLite Agent B",
    role: "Challenge persistence failure modes.",
    provider: "mock",
    model: "mock-local",
    competitiveDrive: 85,
    strategyBias: "adversarial",
  },
};

test("local SQLite persistence stores matches and Arena Loop battles in one database file", {
  skip: !isSQLiteRuntimeAvailable(),
}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cognitive-pong-sqlite-"));
  const dbFile = path.join(dir, "cognitive-pong.sqlite");

  const savedMatch = appendStoredMatch({
    topic: "Validate local SQLite persistence.",
    agentConfig,
    scoreA: 1,
    scoreB: 0,
    cycleCount: 2,
    consensusCount: 1,
    isPublic: true,
    finalizedTasks: [
      {
        title: "Persist local match",
        summary: "Store match summary in the SQLite match table.",
        confidence: 91,
        approvedBy: "SQLite Agent A",
      },
    ],
  }, dbFile);
  const matches = readMatches(dbFile);

  assert.equal(fs.existsSync(dbFile), true);
  assert.equal(matches.length, SEED_MATCHES.length + 1);
  assert.equal(matches[0].id, savedMatch.id);
  assert.equal(matches[0].topic, "Validate local SQLite persistence.");

  const battle = createArenaBattle({
    master_goal: "Prove one SQLite file can retain replayable Arena Loop battles.",
    rubric: "Reward local-first persistence and simple recovery.",
    visibility: "public",
    research_enabled: false,
    agentConfig,
  }, dbFile);
  const runningBattle = updateArenaBattle({
    ...battle,
    status: "running",
    updated_at: "2026-06-24T12:00:00.000Z",
  }, dbFile);
  const battles = readArenaBattles(dbFile);

  assert.equal(battles.length, 1);
  assert.equal(battles[0].id, battle.id);
  assert.equal(battles[0].status, "running");
  assert.equal(findArenaBattle(runningBattle.slug, dbFile)?.id, battle.id);
});
