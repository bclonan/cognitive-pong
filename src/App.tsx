import { useState, useRef, useEffect } from "react";
import { AgentConfig, DebateTurn, FinalizedTask, Agent, ArenaBattleClientState } from "./types";
import { PRESET_SCENARIOS } from "./data/presets";
import { SimpleNeuralNetwork } from "./utils/nn";
import { getNextAgentAfterTurn } from "./utils/turnDisplay";
import { DEFAULT_ARENA_SETTINGS } from "./utils/arenaSettings";
import { DEFAULT_ARENA_LOOP_RUNTIME, normalizeArenaLoopRuntimeSettings } from "./utils/arenaLoop";
import { resolveAgentModelSelection } from "./utils/providerControls";
import { CognitivePongExperience } from "./components/CognitivePongExperience";

const SIMULATION_BANNER_DISMISSED_KEY = "cognitive-pong-simulation-banner-dismissed";

export default function App() {
  // Session States
  const [topic, setTopic] = useState<string>(PRESET_SCENARIOS[0].topic);

  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    agentA: { ...PRESET_SCENARIOS[0].agentA },
    agentB: { ...PRESET_SCENARIOS[0].agentB },
    useGrounding: true,
    baseSpeed: 3,
    model: "mock-local",
    defaultComplexity: "auto",
    arenaSettings: { ...DEFAULT_ARENA_SETTINGS },
    arenaLoop: { ...DEFAULT_ARENA_LOOP_RUNTIME },
  });

  const [history, setHistory] = useState<DebateTurn[]>([]);
  const [finalizedTasks, setFinalizedTasks] = useState<FinalizedTask[]>([]);
  const [status, setStatus] = useState<
    "idle" | "debating" | "paused" | "researching_A" | "researching_B" | "scoring_A" | "scoring_B" | "completed"
  >("idle");

  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [gameSpeed, setGameSpeed] = useState<number>(2);
  const [deployedModel, setDeployedModel] = useState<SimpleNeuralNetwork | null>(null);

  // Global Tab Navigation
  const [activeTab, setActiveTab] = useState<"arena" | "leaderboard" | "matchmaking" | "about">("arena");
  const [arenaScrollSignal, setArenaScrollSignal] = useState<number>(0);
  const [loopMode, setLoopMode] = useState<"Debate" | "Critique" | "Research" | "Strategy" | "Red Team" | "Creative">("Debate");
  const [victoryCondition, setVictoryCondition] = useState<string>("Reach a defensible synthesis with evidence-backed agreement.");
  const [maxVolleys, setMaxVolleys] = useState<number>(12);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  // Interactive demo play-suite states
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);
  const [demoStepMsg, setDemoStepMsg] = useState<string>("");

  // Leaderboard Statistics Synchronization
  const [isPublicMatch, setIsPublicMatch] = useState<boolean>(true);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [leaderboardRefreshSig, setLeaderboardRefreshSig] = useState<number>(0);
  const [activeTrajectory, setActiveTrajectory] = useState<string | null>(null);
  const [isReplayOpen, setIsReplayOpen] = useState<boolean>(false);
  const [activeArenaBattle, setActiveArenaBattle] = useState<ArenaBattleClientState | null>(null);
  const [isStartingArenaBattle, setIsStartingArenaBattle] = useState<boolean>(false);
  const [isSyncingArenaGoal, setIsSyncingArenaGoal] = useState<boolean>(false);

  // Clear published mark when running a new context model/topic
  useEffect(() => {
    setIsPublished(false);
  }, [
    topic,
    agentConfig.model,
    agentConfig.agentA.provider,
    agentConfig.agentA.model,
    agentConfig.agentA.customModel,
    agentConfig.agentA.endpointUrl,
    agentConfig.agentA.bridge?.kind,
    agentConfig.agentA.bridge?.endpointUrl,
    agentConfig.agentA.bridge?.command,
    agentConfig.agentA.bridge?.args?.join(" "),
    agentConfig.agentA.bridge?.toolName,
    agentConfig.agentB.provider,
    agentConfig.agentB.model,
    agentConfig.agentB.customModel,
    agentConfig.agentB.endpointUrl,
    agentConfig.agentB.bridge?.kind,
    agentConfig.agentB.bridge?.endpointUrl,
    agentConfig.agentB.bridge?.command,
    agentConfig.agentB.bridge?.args?.join(" "),
    agentConfig.agentB.bridge?.toolName,
  ]);

  // Alerts
  const [latestScoreType, setLatestScoreType] = useState<"consensus" | "rejection" | null>(null);
  const [latestScoreText, setLatestScoreText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [isSimulationBannerDismissed, setIsSimulationBannerDismissed] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(SIMULATION_BANNER_DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const simulationBannerDismissedRef = useRef<boolean>(false);

  // Derived active complexity level
  const currentComplexity = agentConfig.defaultComplexity === "auto" || !agentConfig.defaultComplexity
    ? (history[history.length - 1]?.complexity || "quick lookup")
    : agentConfig.defaultComplexity;

  // Track turn requests to avoid twin-trigger glitches
  const apiLockRef = useRef<boolean>(false);
  const arenaStartLockRef = useRef<boolean>(false);
  const activeArenaBattleRef = useRef<ArenaBattleClientState | null>(null);
  const goalSyncTimerRef = useRef<number | null>(null);
  const pendingCompletionAfterGoalRef = useRef<number | null>(null);
  const demoTimeoutsRef = useRef<number[]>([]);
  const scoreAlertTimeoutRef = useRef<number | null>(null);

  const hasPublishableRun = history.length > 0 || finalizedTasks.length > 0 || scoreA > 0 || scoreB > 0;

  useEffect(() => {
    activeArenaBattleRef.current = activeArenaBattle;
  }, [activeArenaBattle]);

  const setSimulationBannerDismissed = (isDismissed: boolean) => {
    simulationBannerDismissedRef.current = isDismissed;
    try {
      if (isDismissed) {
        window.sessionStorage.setItem(SIMULATION_BANNER_DISMISSED_KEY, "true");
      } else {
        window.sessionStorage.removeItem(SIMULATION_BANNER_DISMISSED_KEY);
      }
    } catch {
      // Storage can be disabled; React state still handles the visible UI path.
    }
    setIsSimulationBannerDismissed(isDismissed);
  };

  const clearScoreAlertTimer = () => {
    if (scoreAlertTimeoutRef.current !== null) {
      window.clearTimeout(scoreAlertTimeoutRef.current);
      scoreAlertTimeoutRef.current = null;
    }
  };

  const scheduleScoreAlertClear = (delayMs: number) => {
    clearScoreAlertTimer();
    scoreAlertTimeoutRef.current = window.setTimeout(() => {
      setLatestScoreType(null);
      scoreAlertTimeoutRef.current = null;
    }, delayMs);
  };

  const clearDemoTimers = () => {
    demoTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    demoTimeoutsRef.current = [];
  };

  const scheduleDemoStep = (callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      demoTimeoutsRef.current = demoTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delayMs);
    demoTimeoutsRef.current.push(timeoutId);
    return timeoutId;
  };

  const handleTopicChange = (nextTopic: string) => {
    setTopic(nextTopic);
    setActiveTrajectory(null);
    setIsPublished(false);
  };

  const handleVictoryConditionChange = (nextVictoryCondition: string) => {
    setVictoryCondition(nextVictoryCondition);
    setActiveTrajectory(null);
    setIsPublished(false);
  };

  const syncActiveArenaBattleGoal = async (nextTopic = topic, nextRubric = victoryCondition) => {
    const battle = activeArenaBattleRef.current;
    if (!battle?.id || battle.status === "completed") return null;

    const nextGoal = nextTopic.trim();
    if (!nextGoal) return null;
    if (battle.master_goal === nextGoal && battle.rubric === nextRubric) return battle;

    try {
      const response = await fetch(`/api/arena-loop/battle/${encodeURIComponent(battle.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          master_goal: nextGoal,
          rubric: nextRubric,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Arena Loop goal sync returned status ${response.status}`);
      }

      activeArenaBattleRef.current = data.battle;
      setActiveArenaBattle(data.battle);
      return data.battle as ArenaBattleClientState;
    } catch (err: any) {
      console.error("Arena Loop goal sync failed:", err);
      setErrorMessage(err.message || "Arena Loop goal sync failed.");
      return null;
    }
  };

  const handleSyncMainGoalNow = async () => {
    if (goalSyncTimerRef.current !== null) {
      window.clearTimeout(goalSyncTimerRef.current);
      goalSyncTimerRef.current = null;
    }

    setIsSyncingArenaGoal(true);
    try {
      await syncActiveArenaBattleGoal(topic, victoryCondition);
    } finally {
      setIsSyncingArenaGoal(false);
    }
  };

  const appendTurnToArenaBattle = async (turn: DebateTurn, side: "agentA" | "agentB", nextTurnCount: number, providerMetadata?: any) => {
    const battle = activeArenaBattleRef.current;
    if (!battle?.id) return;
    if (battle.status === "completed") return;

    const activeAgent = side === "agentA" ? agentConfig.agentA : agentConfig.agentB;
    try {
      const response = await fetch(`/api/arena-loop/battle/${encodeURIComponent(battle.id)}/turn/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          turn,
          provider: activeAgent.provider || "mock",
          model: activeAgent.customModel || resolveAgentModelSelection(activeAgent, agentConfig.model),
          latencyMs: providerMetadata?.latency_ms,
          providerMetadata,
          complete: nextTurnCount >= maxVolleys,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Arena Loop ledger returned status ${response.status}`);
      }

      activeArenaBattleRef.current = data.battle;
      setActiveArenaBattle(data.battle);
    } catch (err: any) {
      console.error("Arena Loop ledger sync failed:", err);
      setErrorMessage(err.message || "Arena Loop ledger sync failed.");
    }
  };

  const markArenaLoopCompleted = (turnCount: number) => {
    pendingCompletionAfterGoalRef.current = null;
    setStatus("completed");
    setLatestScoreType("consensus");
    setLatestScoreText(`Arena Loop completed at ${turnCount}/${maxVolleys} volleys.`);
  };

  useEffect(() => {
    const battle = activeArenaBattleRef.current;
    const nextGoal = topic.trim();
    if (!battle?.id || battle.status === "completed" || status === "completed" || !nextGoal) return;
    if (battle.master_goal === nextGoal && battle.rubric === victoryCondition) return;

    if (goalSyncTimerRef.current !== null) {
      window.clearTimeout(goalSyncTimerRef.current);
    }

    goalSyncTimerRef.current = window.setTimeout(() => {
      goalSyncTimerRef.current = null;
      void syncActiveArenaBattleGoal(topic, victoryCondition);
    }, 600);

    return () => {
      if (goalSyncTimerRef.current !== null) {
        window.clearTimeout(goalSyncTimerRef.current);
        goalSyncTimerRef.current = null;
      }
    };
  }, [activeArenaBattle?.id, status, topic, victoryCondition]);

  useEffect(() => {
    return () => {
      demoTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (goalSyncTimerRef.current !== null) {
        window.clearTimeout(goalSyncTimerRef.current);
      }
      if (scoreAlertTimeoutRef.current !== null) {
        window.clearTimeout(scoreAlertTimeoutRef.current);
      }
    };
  }, []);

  // Trigger the AI API call when the physical ball hits a paddle, or manual step is triggered
  const handlePaddleCollision = async (
    paddleSelector: "agentA" | "agentB",
    options: { force?: boolean; settleStatus?: "debating" | "paused" } = {}
  ) => {
    const turnTopic = topic.trim();
    // Avoid double API trigger collisions
    if (isDemoRunning) return;
    if (apiLockRef.current) return;
    if (history.length >= maxVolleys) {
      markArenaLoopCompleted(history.length);
      return;
    }
    if (!options.force && status !== "debating") return;
    if (options.force && !turnTopic) return;

    apiLockRef.current = true;
    setStatus(paddleSelector === "agentA" ? "researching_A" : "researching_B");
    setErrorMessage(null);

    try {
      await syncActiveArenaBattleGoal(turnTopic, victoryCondition);
      const response = await fetch("/api/debate/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: turnTopic,
          history,
          currentAgent: paddleSelector,
          agentConfig,
          useGrounding: agentConfig.useGrounding,
          model: agentConfig.model,
          activeTrajectory
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (jsonErr) {
        // Response was not JSON format
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server returned status code ${response.status}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to generate turn response.");
      }

      if (data.isFallback) {
        const nextFallbackReason = data.fallbackReason || "The configured provider was unavailable, so this turn used the local mock generator.";
        setIsSimulationMode(true);
        setFallbackReason(nextFallbackReason);
      } else {
        setIsSimulationMode(false);
        setFallbackReason(null);
        setSimulationBannerDismissed(false);
      }

      const rawResponse = data.response;
      
      const newTurn: DebateTurn = {
        id: Math.random().toString(36).substring(7),
        sender: paddleSelector,
        content: rawResponse.content || "Could not generate argument.",
        type: rawResponse.type || "critique",
        proposal: rawResponse.proposal || undefined,
        convictionScore: Math.max(0, Math.min(100, rawResponse.convictionScore || 50)),
        timestamp: new Date().toLocaleTimeString(),
        searchSources: data.searchSources && data.searchSources.length > 0 ? data.searchSources : undefined,
        complexity: rawResponse.complexity || "quick lookup",
        judgeEvaluation: rawResponse.judgeEvaluation || undefined,
        spectatorLiveReactions: rawResponse.spectatorLiveReactions || undefined,
      };

      const nextTurnCount = history.length + 1;
      const isFinalVolley = nextTurnCount >= maxVolleys;
      setHistory((prev) => [...prev, newTurn]);
      void appendTurnToArenaBattle(newTurn, paddleSelector, nextTurnCount, data.providerMetadata);

      // Determine score point goals depending directly on Judge Scoring feedback!
      const isJudgeScore = newTurn.judgeEvaluation?.isScoreGoal;
      if (isJudgeScore && newTurn.proposal) {
        if (isFinalVolley) {
          pendingCompletionAfterGoalRef.current = nextTurnCount;
        }
        // Yes, Grand Referee referee awarded a point! Ball accelerates and glows to indicate a scoring strike!
        setStatus(paddleSelector === "agentA" ? "scoring_A" : "scoring_B");
        setLatestScoreType("consensus");
        
        const avgScore = Math.round(
          ((newTurn.judgeEvaluation?.intellectScore || 0) + 
           (newTurn.judgeEvaluation?.precisionScore || 0) + 
           (newTurn.judgeEvaluation?.rhetoricScore || 0)) / 3
        );
        setLatestScoreText(`POINT SCORED BY ${paddleSelector === "agentA" ? agentConfig.agentA.name : agentConfig.agentB.name}! (Ref rating: ${avgScore}/100)`);

        // Change the debate sub-topic trajectory based on the referee's guidance redirection!
        if (newTurn.judgeEvaluation?.pivotingDirective) {
          setActiveTrajectory(newTurn.judgeEvaluation.pivotingDirective);
        }
      } else {
        if (isFinalVolley) {
          markArenaLoopCompleted(nextTurnCount);
          return;
        }
        // Standard bounce back
        setStatus(options.settleStatus || "debating");
        // Clear active scoring banner if any left over
        setLatestScoreType(null);

        // Even on normal turns, if the Referee guides a pivot, we can adopt it as strategic guidance
        if (newTurn.judgeEvaluation?.pivotingDirective && Math.random() > 0.6) {
          setActiveTrajectory(newTurn.judgeEvaluation.pivotingDirective);
        }
      }

    } catch (err: any) {
      console.error("Agent call error:", err);
      setErrorMessage(err.message || "An unexpected error occurred. Please make sure the server builds and your key is active.");
      setStatus("paused");
    } finally {
      apiLockRef.current = false;
    }
  };

  // Called after scoring animation settles
  const handleGoalCompleted = (scoringPaddle: "agentA" | "agentB") => {
    if (isDemoRunning) return;

    // Find latest proposal turn in history to compile into the permanent task plan
    const latestProposalTurn = [...history]
      .reverse()
      .find((t) => t.sender === scoringPaddle && t.proposal);

    const taskTitle = latestProposalTurn?.proposal || "Milestone Formulation Task";
    const taskSummary = latestProposalTurn?.content || "No abstract formulated.";
    const scoreVal = latestProposalTurn?.convictionScore || 90;
    const complexityVal = latestProposalTurn?.complexity || "quick lookup";

    const newTask: FinalizedTask = {
      id: Math.random().toString(36).substring(7),
      title: taskTitle,
      summary: taskSummary,
      confidence: scoreVal,
      approvedBy: scoringPaddle === "agentA" ? agentConfig.agentA.name : agentConfig.agentB.name,
      timestamp: new Date().toLocaleTimeString(),
      complexity: complexityVal,
      influencedByTurnId: latestProposalTurn?.id,
    };

    setFinalizedTasks((prev) => [...prev, newTask]);

    if (scoringPaddle === "agentA") {
      setScoreA((s) => s + 1);
    } else {
      setScoreB((s) => s + 1);
    }

    // Return game loop from scoring phase back to steady debating!
    const completedTurnCount = pendingCompletionAfterGoalRef.current;
    if (completedTurnCount !== null) {
      markArenaLoopCompleted(completedTurnCount);
      return;
    }

    setStatus("debating");
    
    // Fade scoring alerts shortly after
    scheduleScoreAlertClear(4000);
  };

  // Human intervention injects a referee remark directly into the context of debate history!
  const handleModeratorIntervene = (comment: string) => {
    const refereeTurn: DebateTurn = {
      id: Math.random().toString(36).substring(7),
      sender: "moderator",
      content: `REFEREE INTERVENTION / HUMAN COMMENT:\n\n"${comment}"\n\nBoth agents, incorporating this guidance is critical. Pivot your next arguments or specifications immediately to account for this input.`,
      type: "rebuttal",
      timestamp: new Date().toLocaleTimeString(),
      convictionScore: 50,
    };

    setHistory((prev) => [...prev, refereeTurn]);
    
    // Clear alerts
    setLatestScoreType("rejection");
    setLatestScoreText("REFEREE DIRECTIVE INJECTED");
    
    scheduleScoreAlertClear(4500);
  };

  // Manually force a step turn in case ball gets stuck or for testing
  const handleStepTurn = () => {
    if (isDemoRunning || status === "completed" || apiLockRef.current || !topic.trim()) return;
    if (history.length >= maxVolleys) {
      markArenaLoopCompleted(history.length);
      return;
    }
    // Simulate paddle bounce based on who sent latest turn
    const lastTurn = history[history.length - 1];
    const whoShouldReply = getNextAgentAfterTurn(lastTurn?.sender);
    handlePaddleCollision(whoShouldReply, {
      force: true,
      settleStatus: status === "debating" ? "debating" : "paused",
    });
  };

  const scrollArenaIntoView = () => {
    setArenaScrollSignal((signal) => signal + 1);
  };

  const handleStartMatch = async () => {
    const startTopic = topic.trim();
    if (!startTopic) return;
    if (arenaStartLockRef.current) return;

    setActiveTab("arena");

    if (status === "completed") {
      clearScoreAlertTimer();
      pendingCompletionAfterGoalRef.current = null;
      setHistory([]);
      setFinalizedTasks([]);
      setScoreA(0);
      setScoreB(0);
      setLatestScoreType(null);
      setLatestScoreText("");
      setActiveTrajectory(null);
      activeArenaBattleRef.current = null;
      setActiveArenaBattle(null);
    }

    if (status === "paused" && activeArenaBattleRef.current) {
      await syncActiveArenaBattleGoal(topic, victoryCondition);
      setStatus("debating");
      scrollArenaIntoView();
      return;
    }

    arenaStartLockRef.current = true;
    setIsStartingArenaBattle(true);
    setErrorMessage(null);
    try {
      const arenaLoop = normalizeArenaLoopRuntimeSettings(agentConfig.arenaLoop);
      const response = await fetch("/api/arena-loop/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          master_goal: startTopic,
          rubric: victoryCondition,
          visibility: isPublicMatch ? "public" : "private",
          research_enabled: agentConfig.useGrounding,
          limits: {
            maxLoopPasses: arenaLoop.maxLoopPasses,
            maxCandidatesPerPass: arenaLoop.maxCandidatesPerPass,
            maxQueriesPerTurn: agentConfig.useGrounding ? arenaLoop.maxQueriesPerTurn : 0,
            maxSourcesPerTurn: agentConfig.useGrounding ? arenaLoop.maxSourcesPerTurn : 0,
            maxSourceExcerptLength: arenaLoop.maxSourceExcerptLength,
            maxMemoryCharacters: arenaLoop.maxMemoryCharacters,
          },
          search_provider: arenaLoop.searchProvider,
          search_endpoint_url: arenaLoop.searchEndpointUrl,
          search_timeout_ms: arenaLoop.searchTimeoutMs,
          agentConfig,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Arena Loop creation returned status ${response.status}`);
      }

      activeArenaBattleRef.current = data.battle;
      setActiveArenaBattle(data.battle);
    } catch (err: any) {
      console.error("Arena Loop battle creation failed:", err);
      setErrorMessage(err.message || "Arena Loop battle creation failed. Local Pong loop can still run.");
      activeArenaBattleRef.current = null;
      setActiveArenaBattle(null);
    } finally {
      arenaStartLockRef.current = false;
      setIsStartingArenaBattle(false);
    }

    setStatus("debating");
    scrollArenaIntoView();
  };

  const handleDismissSimulationBanner = () => {
    setSimulationBannerDismissed(true);
  };

  const handlePauseMatch = () => {
    setStatus("paused");
  };

  const handleResetMatch = () => {
    clearDemoTimers();
    clearScoreAlertTimer();
    apiLockRef.current = false;
    arenaStartLockRef.current = false;
    pendingCompletionAfterGoalRef.current = null;
    setHistory([]);
    setFinalizedTasks([]);
    setScoreA(0);
    setScoreB(0);
    setStatus("idle");
    setLatestScoreType(null);
    setLatestScoreText("");
    setErrorMessage(null);
    setIsPublished(false);
    setIsSimulationMode(false);
    setFallbackReason(null);
    setSimulationBannerDismissed(false);
    setActiveTrajectory(null);
    activeArenaBattleRef.current = null;
    setActiveArenaBattle(null);
    setIsDemoRunning(false);
    setIsStartingArenaBattle(false);
    setDemoStepMsg("");
  };

  const handlePublishMatch = async () => {
    if (!hasPublishableRun) {
      setErrorMessage("Run at least one debate turn or lock one consensus milestone before publishing to the leaderboard.");
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/match/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          agentConfig,
          scoreA,
          scoreB,
          cycleCount: history.length,
          consensusCount: finalizedTasks.length,
          isPublic: isPublicMatch,
          finalizedTasks
        })
      });

      if (!response.ok) {
        throw new Error(`Match registry returned status ${response.status}`);
      }

      const resData = await response.json();
      if (resData.success) {
        setIsPublished(true);
        setLeaderboardRefreshSig((s) => s + 1);
      } else {
        throw new Error(resData.error || "Failed to catalog match");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to commit match statistics.");
    } finally {
      setIsPublishing(false);
    }
  };

  const triggerDemoMatch = async () => {
    if (isDemoRunning) return;
    clearDemoTimers();
    clearScoreAlertTimer();
    setIsDemoRunning(true);
    setIsStartingArenaBattle(false);
    setActiveTab("arena");
    setHistory([]);
    setFinalizedTasks([]);
    setScoreA(0);
    setScoreB(0);
    setErrorMessage(null);
    setIsPublished(false);
    setIsSimulationMode(false);
    setFallbackReason(null);
    setSimulationBannerDismissed(false);
    setActiveTrajectory(null);
    activeArenaBattleRef.current = null;
    setActiveArenaBattle(null);
    setLatestScoreType(null);
    setLatestScoreText("");

    const demoTopic = "EVALUATE AND MIGRATE CRITICAL BANKING LEDGER WITH SANDBOXED EXECUTION SYSTEM";
    handleTopicChange(demoTopic);
    scrollArenaIntoView();

    // Turn 1
    setStatus("researching_A");
    setDemoStepMsg("1/4 Preparing retrieval context and prior-turn memory...");
    
    scheduleDemoStep(() => {
      const turn1: DebateTurn = {
        id: "demo-t1",
        sender: "agentA",
        content: "PROPOSED ARCHITECTURAL BLUEPRINT:\nDeploy continuous Change Data Capture pipelines using Debezium-driven stream processors over the legacy mainframe. This achieves structured ledger decoupling and establishes read-only testing sandboxes.\n\nM0 CORE CLAIM: Primary transaction states must isolate cleanly from root mainframes.\nM2 RAG: Strangler-Fig-Migration-Pattern, Fowler-Enterprise-Architecture-V4\nM4 HOPFIELD: database_latency_hazard_102 (Recall Debezium-CDC optimization pattern).",
        type: "proposal",
        proposal: "Mainframe Change-Data-Capture Isolator",
        convictionScore: 72,
        timestamp: new Date().toLocaleTimeString(),
        complexity: "complex simulation"
      };
      setHistory([turn1]);
      setStatus("researching_B");
      setDemoStepMsg("2/4 Running critique and risk analysis...");
      
      scheduleDemoStep(() => {
        const turn2: DebateTurn = {
          id: "demo-t2",
          sender: "agentB",
          content: "ADVERSARIAL COGNITIVE CHALLENGE / OBJECTION:\nIf the Change Data Capture sync sync-latency exceeds 40ms under heavy transaction pools, a read-after-write hazard can leak corrupt balance states.\n\nM0 CORE CLAIM: Safety policies must guarantee transaction-integrity regardless of database latency.\nM2 RAG: Dijkstra-Distributed-Semaphores\nM4 HOPFIELD: consensus_loop_deadlock_015 (Enforce mandatory strict safety fences).",
          type: "critique",
          convictionScore: 80,
          timestamp: new Date().toLocaleTimeString(),
          complexity: "deep research"
        };
        setHistory((prev) => [...prev, turn2]);
        setStatus("researching_A");
        setDemoStepMsg("3/4 Refining the response through evaluator feedback...");
        
        scheduleDemoStep(() => {
          const turn3: DebateTurn = {
            id: "demo-t3",
            sender: "agentA",
            content: "RE-OPTIMIZED SYSTEM SPECIFICATION AND RESOLUTION:\nWe introduce synchronized sub-40ms Redis lookup indices coupled with double-read comparative hashes at proxy gates to bypass transactional bottlenecks. System auto-verifies hash alignment before committing balances.\n\nM0 CORE CLAIM: Double-read comparison gates guarantee absolute sync-safety without locking mainframe databases.\nM2 RAG: W3C-Distributed-Cache-Standards\nM4 HOPFIELD: database_latency_hazard_102 (EMERGENT ACTION FULLY RESOLVED).",
            type: "agreement",
            proposal: "Synchronized Proxy Comparative Hashes",
            convictionScore: 92,
            timestamp: new Date().toLocaleTimeString(),
            complexity: "complex simulation"
          };
          setHistory((prev) => [...prev, turn3]);
          setStatus("scoring_A");
          setLatestScoreType("consensus");
          setLatestScoreText(`CONSENSUS LOCKED IN BY ${agentConfig.agentA.name}!`);
          setDemoStepMsg("4/4 Consensus locked; recording scoring provenance...");

          const newTask: FinalizedTask = {
            id: "demo-task-1",
            title: "Synchronized Proxy Comparative Hashes",
            summary: "Implement high-frequency Redis staging caches alongside double-read comparative validators inside secure routing envelopes to prevent transaction desynchronization.",
            confidence: 92,
            approvedBy: agentConfig.agentA.name,
            timestamp: new Date().toLocaleTimeString(),
            complexity: "complex simulation",
            influencedByTurnId: "demo-t3",
          };
          setFinalizedTasks([newTask]);
          setScoreA(1);

          scheduleDemoStep(async () => {
            // Trigger auto-save of this match to the backend
            try {
              const res = await fetch("/api/match/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  topic: demoTopic,
                  agentConfig,
                  scoreA: 1,
                  scoreB: 0,
                  cycleCount: 3,
                  consensusCount: 1,
                  isPublic: true,
                  finalizedTasks: [newTask]
                })
              });
              if (res.ok) {
                const resData = await res.json();
                if (resData.success) {
                  setIsPublished(true);
                  setLeaderboardRefreshSig((s) => s + 1);
                }
              }
            } catch (saveErr) {
              console.error("Example rally save log skipped:", saveErr);
            }
            
            setStatus("paused");
            setIsDemoRunning(false);
            setDemoStepMsg("Example rally completed. View results in the leaderboard tab.");
            scheduleScoreAlertClear(5500);
          }, 4500);

        }, 3000);
      }, 3000);
    }, 3000);
  };

  const handleStartDuel = (opponent: Agent, user: Agent, duelTopic: string) => {
    clearDemoTimers();
    clearScoreAlertTimer();
    setAgentConfig((prev) => ({
      ...prev,
      agentA: { ...user },
      agentB: { ...opponent }
    }));
    handleTopicChange(duelTopic);
    
    // Clear and reset matching court states
    setHistory([]);
    setFinalizedTasks([]);
    setScoreA(0);
    setScoreB(0);
    setErrorMessage(null);
    setIsPublished(false);
    setIsSimulationMode(false);
    setFallbackReason(null);
    setSimulationBannerDismissed(false);
    setActiveTrajectory(null);
    activeArenaBattleRef.current = null;
    setActiveArenaBattle(null);
    setIsDemoRunning(false);
    setIsStartingArenaBattle(false);
    setDemoStepMsg("");
    setLatestScoreType(null);
    setLatestScoreText("");
    
    // Trigger live debate and active navigation transition
    setStatus("debating");
    setActiveTab("arena");
    scrollArenaIntoView();
  };

  return (
    <CognitivePongExperience
      topic={topic}
      setTopic={handleTopicChange}
      agentConfig={agentConfig}
      setAgentConfig={setAgentConfig}
      history={history}
      finalizedTasks={finalizedTasks}
      status={status}
      setStatus={setStatus}
      scoreA={scoreA}
      scoreB={scoreB}
      gameSpeed={gameSpeed}
      setGameSpeed={setGameSpeed}
      deployedModel={deployedModel}
      currentComplexity={currentComplexity}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      arenaScrollSignal={arenaScrollSignal}
      loopMode={loopMode}
      setLoopMode={setLoopMode}
      victoryCondition={victoryCondition}
      setVictoryCondition={handleVictoryConditionChange}
      maxVolleys={maxVolleys}
      setMaxVolleys={setMaxVolleys}
      density={density}
      setDensity={setDensity}
      isDemoRunning={isDemoRunning}
      demoStepMsg={demoStepMsg}
      isPublicMatch={isPublicMatch}
      setIsPublicMatch={setIsPublicMatch}
      isPublishing={isPublishing}
      isPublished={isPublished}
      hasPublishableRun={hasPublishableRun}
      leaderboardRefreshSig={leaderboardRefreshSig}
      activeTrajectory={activeTrajectory}
      setActiveTrajectory={setActiveTrajectory}
      isReplayOpen={isReplayOpen}
      setIsReplayOpen={setIsReplayOpen}
      latestScoreType={latestScoreType}
      latestScoreText={latestScoreText}
      errorMessage={errorMessage}
      setErrorMessage={setErrorMessage}
      isSimulationMode={isSimulationMode}
      isSimulationBannerVisible={isSimulationMode && !isSimulationBannerDismissed && !simulationBannerDismissedRef.current}
      activeArenaBattle={activeArenaBattle}
      isStartingArenaBattle={isStartingArenaBattle}
      isSyncingArenaGoal={isSyncingArenaGoal}
      onDismissSimulationBanner={handleDismissSimulationBanner}
      fallbackReason={fallbackReason}
      onSyncMainGoal={handleSyncMainGoalNow}
      onPaddleCollision={handlePaddleCollision}
      onGoalCompleted={handleGoalCompleted}
      onStartMatch={handleStartMatch}
      onPauseMatch={handlePauseMatch}
      onResetMatch={handleResetMatch}
      onStepTurn={handleStepTurn}
      onModeratorIntervene={handleModeratorIntervene}
      onPublishMatch={handlePublishMatch}
      onTriggerDemoMatch={triggerDemoMatch}
      onStartDuel={handleStartDuel}
      onDeployModel={setDeployedModel}
    />
  );
}
