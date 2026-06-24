import fs from "fs";
import path from "path";
import {
  isSQLiteStorePath,
  readSQLiteMatches,
  seedSQLiteMatchesIfEmpty,
  writeSQLiteMatches,
} from "./sqliteStore";

export const DEFAULT_MATCHES_FILE = process.env.COGNITIVE_PONG_MATCHES_STORE || path.join(process.cwd(), "data", "matches.json");

export class MatchValidationError extends Error {
  statusCode = 400;
}

export const SEED_MATCHES = [
  {
    id: "match-seed-01",
    topic: "Design a fully circular and self-sufficient agricultural dome on Mars that can support 50 crew members indefinitely.",
    timestamp: "6/20/2026, 3:14:15 PM",
    isPublic: true,
    cycleCount: 14,
    consensusCount: 4,
    agentA: {
      name: "Commander Ares (Advocate)",
      provider: "mock",
      model: "mock-local",
      competitiveDrive: 75,
      strategyBias: "cooperative",
      score: 4
    },
    agentB: {
      name: "Architect Vance (Critic)",
      provider: "ollama",
      model: "llama3",
      competitiveDrive: 85,
      strategyBias: "adversarial",
      score: 2
    },
    finalizedTasks: [
      {
        title: "Aeroponic nutrient cycle loops",
        summary: "Implement closed-loop wastewater separation to dose nitrogen directly into root nozzles without chemical treatment.",
        confidence: 94,
        approvedBy: "Commander Ares (Advocate)"
      },
      {
        title: "Hydrogen catalyst pressure bounds",
        summary: "Introduce sub-atmospheric pressure chambers for fuel cells to mitigate the risk of explosive blowbacks.",
        confidence: 88,
        approvedBy: "Architect Vance (Critic)"
      },
      {
        title: "Dual-tier radiation shield layout",
        summary: "Specify a nested hull filled with gray wastewater blocks to provide dynamic cosmic ray protection.",
        confidence: 91,
        approvedBy: "Commander Ares (Advocate)"
      },
      {
        title: "Automated carbon scrapers",
        summary: "Incorporate localized potassium hydroxide collectors to capture residual cabin CO2 scrub failures.",
        confidence: 89,
        approvedBy: "Commander Ares (Advocate)"
      }
    ]
  },
  {
    id: "match-seed-02",
    topic: "Determine the step-by-step strategy to migrate a 15-year-old banking monolith to a distributed Serverless microservices architecture with zero downtime.",
    timestamp: "6/20/2026, 4:45:00 PM",
    isPublic: true,
    cycleCount: 18,
    consensusCount: 5,
    agentA: {
      name: "Dev Lead Nova (Advocate)",
      provider: "openai-compatible",
      model: "gpt-4o-mini",
      competitiveDrive: 90,
      strategyBias: "cooperative",
      score: 5
    },
    agentB: {
      name: "Guardian Core (Critic)",
      provider: "anthropic",
      model: "claude-3-5-haiku-latest",
      competitiveDrive: 95,
      strategyBias: "adversarial",
      score: 3
    },
    finalizedTasks: [
      {
        title: "Continuous CDC replication core",
        summary: "Deploy a Debezium-driven stream processor tracking the legacy mainframe transactions with double-write validations.",
        confidence: 95,
        approvedBy: "Dev Lead Nova (Advocate)"
      },
      {
        title: "Out-of-sync hazard alarm",
        summary: "Introduce secure dual-read comparative hashes at proxy gates to block transactions and sound a telemetry alert.",
        confidence: 90,
        approvedBy: "Guardian Core (Critic)"
      },
      {
        title: "Isolate customer records domain",
        summary: "Divide legacy schema tables using schema-on-read maps to construct decoupled customer microservice nodes.",
        confidence: 86,
        approvedBy: "Dev Lead Nova (Advocate)"
      },
      {
        title: "Zero-latency token cache layers",
        summary: "Maintain local Redis lookup indices behind OAuth microgates to bypass mainframe latency spikes",
        confidence: 92,
        approvedBy: "Dev Lead Nova (Advocate)"
      },
      {
        title: "Fallback mainframe circuit break",
        summary: "Integrate a dual-channel mock fallthrough rule to route failed checkout triggers safely back to staging logs.",
        confidence: 88,
        approvedBy: "Guardian Core (Critic)"
      }
    ]
  },
  {
    id: "match-seed-03",
    topic: "Formulate a chemically perfect, repeatable recipe for chocolate chip cookies that balances caramelized crisp borders with an ultra-fudgy, chewy core.",
    timestamp: "6/20/2026, 5:50:30 PM",
    isPublic: true,
    cycleCount: 12,
    consensusCount: 3,
    agentA: {
      name: "Chef Alchemy (Advocate)",
      provider: "ollama",
      model: "llama-3.1",
      competitiveDrive: 60,
      strategyBias: "socratic",
      score: 3
    },
    agentB: {
      name: "Patisserie Orthodoxy (Critic)",
      provider: "huggingface",
      model: "mistralai/Mistral-7B-Instruct-v0.3",
      competitiveDrive: 80,
      strategyBias: "rhetorical",
      score: 3
    },
    finalizedTasks: [
      {
        title: "Dry-browning butter crystals",
        summary: "Melt unsalted butter under steady agitation at 120C until milk solids precipitate into dark nutty particles.",
        confidence: 97,
        approvedBy: "Chef Alchemy (Advocate)"
      },
      {
        title: "Precise flour hydration span",
        summary: "Rehydrate bread flour using exactly 14% egg albumin content to stabilize gluten bonds under carbon heat.",
        confidence: 93,
        approvedBy: "Patisserie Orthodoxy (Critic)"
      },
      {
        title: "Multi-day cold resting curve",
        summary: "Immerse composite dough in a sealed 4C chiller for 72 hours to allow complete enzyme starch conversion.",
        confidence: 95,
        approvedBy: "Chef Alchemy (Advocate)"
      }
    ]
  }
];

export function ensureMatchesSeeded(matchesFile = DEFAULT_MATCHES_FILE) {
  if (isSQLiteStorePath(matchesFile)) {
    seedSQLiteMatchesIfEmpty(SEED_MATCHES, matchesFile);
    return;
  }

  const dir = path.dirname(matchesFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(matchesFile)) {
    fs.writeFileSync(matchesFile, JSON.stringify(SEED_MATCHES, null, 2), "utf-8");
  }
}

export function readMatches(matchesFile = DEFAULT_MATCHES_FILE): any[] {
  ensureMatchesSeeded(matchesFile);
  if (isSQLiteStorePath(matchesFile)) {
    return readSQLiteMatches(matchesFile);
  }

  const data = fs.readFileSync(matchesFile, "utf-8");
  const parsed = JSON.parse(data);
  return Array.isArray(parsed) ? parsed : [];
}

export function writeMatches(matches: any[], matchesFile = DEFAULT_MATCHES_FILE) {
  if (isSQLiteStorePath(matchesFile)) {
    writeSQLiteMatches(matches, matchesFile);
    return;
  }

  const tempFile = `${matchesFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(matches, null, 2), "utf-8");
  fs.renameSync(tempFile, matchesFile);
}

export function cleanString(value: any, fallback: string, maxLength = 500) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).slice(0, maxLength);
}

export function clampNumber(value: any, fallback: number, min = 0, max = 1000) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, numeric));
}

export function cleanAgent(agent: any, fallbackName: string, fallbackModel: string) {
  return {
    name: cleanString(agent?.name, fallbackName, 120),
    provider: cleanString(agent?.provider, "mock", 32),
    model: cleanString(agent?.model || agent?.customModel, fallbackModel, 120),
    competitiveDrive: clampNumber(agent?.competitiveDrive, 50, 0, 100),
    strategyBias: cleanString(agent?.strategyBias, "balanced", 32),
    score: Math.round(clampNumber(agent?.score, 0, 0, 999))
  };
}

export function cleanFinalizedTasks(finalizedTasks: any[]) {
  return finalizedTasks.slice(0, 100).map((task, index) => ({
    id: cleanString(task?.id, `task_${index + 1}`, 80),
    title: cleanString(task?.title, "Untitled milestone", 180),
    summary: cleanString(task?.summary, "No summary supplied.", 2000),
    confidence: Math.round(clampNumber(task?.confidence, 75, 0, 100)),
    approvedBy: cleanString(task?.approvedBy, "Unknown agent", 120),
    timestamp: cleanString(task?.timestamp, new Date().toLocaleString(), 80),
    complexity: cleanString(task?.complexity, "quick lookup", 40),
    influencedByTurnId: typeof task?.influencedByTurnId === "string" ? task.influencedByTurnId.slice(0, 80) : undefined,
  }));
}

interface BuildStoredMatchOptions {
  id?: string;
  timestamp?: string;
}

export function buildStoredMatch(payload: any, options: BuildStoredMatchOptions = {}) {
  const {
    topic,
    agentConfig,
    scoreA,
    scoreB,
    cycleCount,
    consensusCount,
    isPublic = true,
    finalizedTasks = []
  } = payload;

  const safeTopic = cleanString(topic, "", 500);
  if (!safeTopic) {
    throw new MatchValidationError("Match topic is required.");
  }

  if (!agentConfig?.agentA || !agentConfig?.agentB) {
    throw new MatchValidationError("Both agent configurations are required.");
  }

  const safeTasks = Array.isArray(finalizedTasks) ? cleanFinalizedTasks(finalizedTasks) : [];
  const safeCycleCount = Math.round(clampNumber(cycleCount, 0, 0, 100000));
  const safeConsensusCount = Math.round(clampNumber(consensusCount, safeTasks.length, 0, 100000));
  const safeScoreA = Math.round(clampNumber(scoreA, 0, 0, 999));
  const safeScoreB = Math.round(clampNumber(scoreB, 0, 0, 999));

  if (safeCycleCount === 0 && safeTasks.length === 0 && safeScoreA === 0 && safeScoreB === 0) {
    throw new MatchValidationError("Run at least one turn or finalized milestone before saving a match.");
  }

  return {
    id: options.id || "match_" + Date.now() + "_" + Math.random().toString(36).substring(5),
    topic: safeTopic,
    timestamp: options.timestamp || new Date().toLocaleString(),
    isPublic: Boolean(isPublic),
    cycleCount: safeCycleCount,
    consensusCount: safeConsensusCount,
    agentA: cleanAgent(
      { ...agentConfig.agentA, score: safeScoreA },
      "Agent A",
      cleanString(agentConfig.agentA.model || agentConfig.model, "mock-local", 120)
    ),
    agentB: cleanAgent(
      { ...agentConfig.agentB, score: safeScoreB },
      "Agent B",
      cleanString(agentConfig.agentB.model || agentConfig.model, "mock-local", 120)
    ),
    finalizedTasks: safeTasks
  };
}

export function appendStoredMatch(payload: any, matchesFile = DEFAULT_MATCHES_FILE) {
  const matches = readMatches(matchesFile);
  const newMatch = buildStoredMatch(payload);
  matches.unshift(newMatch);
  writeMatches(matches, matchesFile);
  return newMatch;
}

export function buildLeaderboard(matches: any[]) {
  const statsMap: Record<string, any> = {};

  const addStats = (agent: any, oppScore: number, matchTasks: any[]) => {
    const model = agent.model || "unknown-model";
    if (!statsMap[model]) {
      statsMap[model] = {
        modelName: model,
        provider: agent.provider || "mock",
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        goalsScored: 0,
        goalsAgainst: 0,
        blueprintsApproved: 0,
        convictionSum: 0,
        convictionCount: 0
      };
    }

    const st = statsMap[model];
    st.played += 1;
    st.goalsScored += agent.score || 0;
    st.goalsAgainst += oppScore;

    if (agent.score > oppScore) {
      st.wins += 1;
    } else if (agent.score < oppScore) {
      st.losses += 1;
    } else {
      st.draws += 1;
    }

    const approvedTasks = matchTasks.filter((task: any) => task.approvedBy === agent.name);
    st.blueprintsApproved += approvedTasks.length;
    approvedTasks.forEach((task: any) => {
      if (typeof task.confidence === "number") {
        st.convictionSum += task.confidence;
        st.convictionCount += 1;
      }
    });
  };

  matches.forEach((match: any) => {
    if (match.isPublic === false) return;
    addStats(match.agentA, match.agentB.score, match.finalizedTasks || []);
    addStats(match.agentB, match.agentA.score, match.finalizedTasks || []);
  });

  const leaderboard = Object.values(statsMap).map((st: any) => {
    const winRatio = st.played > 0 ? Math.round(((st.wins + 0.5 * st.draws) / st.played) * 100) : 50;
    const avgConviction = st.convictionCount > 0 ? Math.round(st.convictionSum / st.convictionCount) : 88;
    const rating = Math.round(1000 + (st.wins * 80) + (st.draws * 25) - (st.losses * 45) + (st.blueprintsApproved * 5) + (avgConviction - 50) * 1.5);

    return {
      modelName: st.modelName,
      provider: st.provider,
      played: st.played,
      wins: st.wins,
      losses: st.losses,
      draws: st.draws,
      goalsScored: st.goalsScored,
      goalsAgainst: st.goalsAgainst,
      blueprintsApproved: st.blueprintsApproved,
      avgConviction,
      winRatio,
      rating
    };
  });

  leaderboard.sort((a: any, b: any) => b.rating - a.rating);
  return leaderboard;
}
