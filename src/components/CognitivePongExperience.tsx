import React from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  Check,
  Copy,
  Cpu,
  Download,
  Gauge,
  HelpCircle,
  Maximize2,
  MessageSquare,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Settings,
  SkipForward,
  Sliders,
  Swords,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Agent, AgentBridgeConfig, AgentBridgeKind, AgentConfig, ArenaBattleClientState, DebateTurn, FinalizedTask, ProviderKind } from "../types";
import { PRESET_SCENARIOS } from "../data/presets";
import { SimpleNeuralNetwork } from "../utils/nn";
import { redactAgentConfigForExport } from "../utils/exportRedaction";
import { getTurnSenderDisplay } from "../utils/turnDisplay";
import { copyTextToClipboard } from "../utils/clipboard";
import {
  buildMarkdownExport,
  buildSessionArtifact,
  buildTranscriptExport,
  SessionExportInput,
} from "../utils/sessionExports";
import {
  PROVIDER_OPTIONS,
  applyAgentModelSelection,
  applyAgentProviderSelection,
  applyAgentTemplatePreservingRuntime,
  endpointPlaceholder,
  modelOptionsForProvider,
  modelPlaceholder,
  providerNeedsApiKey,
  providerNeedsEndpoint,
  providerTokenPlaceholder,
  resolveAgentModelSelection,
  resolvedEndpointLabel,
} from "../utils/providerControls";
import {
  BRIDGE_OPTIONS,
  bridgeEndpointPlaceholder,
  bridgeProfilePlaceholder,
  bridgeUsesCommand,
  bridgeUsesEndpoint,
  defaultBridgeProfileForKind,
} from "../utils/agentBridgeControls";
import {
  CUSTOM_AGENT_LIBRARY_STORAGE_KEY,
  CustomAgentTemplate,
  cloneAgentForLibrary,
  createBlankCustomAgent,
  createCustomAgentTemplate,
  parseCustomAgentLibrary,
  removeCustomAgentTemplate,
  upsertCustomAgentTemplate,
} from "../utils/customAgents";
import { PongGame } from "./PongGame";
import { ActiveResearchState } from "./ActiveResearchState";
import { DebateLogs } from "./DebateLogs";
import { ConsensusBoard } from "./ConsensusBoard";
import { ConfigPanel } from "./ConfigPanel";
import { NetworkTrainer } from "./NetworkTrainer";
import { LeaderboardAndMatches } from "./LeaderboardAndMatches";
import { MatchmakingCompetition } from "./MatchmakingCompetition";
import { AboutScienceManual } from "./AboutScienceManual";
import { TimelineDependencyGraph } from "./TimelineDependencyGraph";
import { SpectatorJudgePanel } from "./SpectatorJudgePanel";
import { ReplayMatchPanel } from "./ReplayMatchPanel";

type ArenaStatus = "idle" | "debating" | "paused" | "researching_A" | "researching_B" | "scoring_A" | "scoring_B" | "completed";
type ActiveTab = "arena" | "leaderboard" | "matchmaking" | "about";
type LoopMode = "Debate" | "Critique" | "Research" | "Strategy" | "Red Team" | "Creative";
type Density = "comfortable" | "compact";

interface CognitivePongExperienceProps {
  topic: string;
  setTopic: (topic: string) => void;
  agentConfig: AgentConfig;
  setAgentConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
  history: DebateTurn[];
  finalizedTasks: FinalizedTask[];
  status: ArenaStatus;
  setStatus: React.Dispatch<React.SetStateAction<ArenaStatus>>;
  scoreA: number;
  scoreB: number;
  gameSpeed: number;
  setGameSpeed: (speed: number) => void;
  deployedModel: SimpleNeuralNetwork | null;
  currentComplexity: "quick lookup" | "deep research" | "complex simulation";
  activeTab: ActiveTab;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  arenaScrollSignal: number;
  loopMode: LoopMode;
  setLoopMode: React.Dispatch<React.SetStateAction<LoopMode>>;
  victoryCondition: string;
  setVictoryCondition: React.Dispatch<React.SetStateAction<string>>;
  maxVolleys: number;
  setMaxVolleys: React.Dispatch<React.SetStateAction<number>>;
  density: Density;
  setDensity: React.Dispatch<React.SetStateAction<Density>>;
  isDemoRunning: boolean;
  demoStepMsg: string;
  isPublicMatch: boolean;
  setIsPublicMatch: React.Dispatch<React.SetStateAction<boolean>>;
  isPublishing: boolean;
  isPublished: boolean;
  hasPublishableRun: boolean;
  leaderboardRefreshSig: number;
  activeTrajectory: string | null;
  setActiveTrajectory: React.Dispatch<React.SetStateAction<string | null>>;
  isReplayOpen: boolean;
  setIsReplayOpen: React.Dispatch<React.SetStateAction<boolean>>;
  latestScoreType: "consensus" | "rejection" | null;
  latestScoreText: string;
  errorMessage: string | null;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  isSimulationMode: boolean;
  isSimulationBannerVisible: boolean;
  activeArenaBattle: ArenaBattleClientState | null;
  isStartingArenaBattle: boolean;
  isSyncingArenaGoal: boolean;
  onDismissSimulationBanner: () => void;
  fallbackReason: string | null;
  onSyncMainGoal: () => void | Promise<void>;
  onPaddleCollision: (paddleSelector: "agentA" | "agentB") => void;
  onGoalCompleted: (scoringPaddle: "agentA" | "agentB") => void;
  onStartMatch: () => void | Promise<void>;
  onPauseMatch: () => void;
  onResetMatch: () => void;
  onStepTurn: () => void;
  onModeratorIntervene: (comment: string) => void;
  onPublishMatch: () => void;
  onTriggerDemoMatch: () => void;
  onStartDuel: (opponent: any, user: any, duelTopic: string) => void;
  onDeployModel: (model: SimpleNeuralNetwork | null) => void;
}

const sessionId = "AG-909-X";
const PSYCHOLOGY_ARCHETYPE_OPTIONS: Array<{ value: NonNullable<Agent["psychologyArchetype"]>; label: string }> = [
  { value: "operator", label: "Operator" },
  { value: "skeptic", label: "Skeptic" },
  { value: "visionary", label: "Visionary" },
  { value: "researcher", label: "Researcher" },
  { value: "synthesizer", label: "Synthesizer" },
  { value: "safety", label: "Safety critic" },
];
const DEBATE_STYLE_OPTIONS: Array<{ value: NonNullable<Agent["debateStyle"]>; label: string }> = [
  { value: "balanced", label: "Balanced" },
  { value: "cooperative", label: "Cooperative" },
  { value: "socratic", label: "Socratic" },
  { value: "rhetorical", label: "Rhetorical" },
  { value: "adversarial", label: "Adversarial" },
];

export const CognitivePongExperience: React.FC<CognitivePongExperienceProps> = ({
  topic,
  setTopic,
  agentConfig,
  setAgentConfig,
  history,
  finalizedTasks,
  status,
  setStatus,
  scoreA,
  scoreB,
  gameSpeed,
  setGameSpeed,
  deployedModel,
  currentComplexity,
  activeTab,
  setActiveTab,
  arenaScrollSignal,
  loopMode,
  setLoopMode,
  victoryCondition,
  setVictoryCondition,
  maxVolleys,
  setMaxVolleys,
  density,
  setDensity,
  isDemoRunning,
  demoStepMsg,
  isPublicMatch,
  setIsPublicMatch,
  isPublishing,
  isPublished,
  hasPublishableRun,
  leaderboardRefreshSig,
  activeTrajectory,
  setActiveTrajectory,
  isReplayOpen,
  setIsReplayOpen,
  latestScoreType,
  latestScoreText,
  errorMessage,
  setErrorMessage,
  isSimulationMode,
  isSimulationBannerVisible,
  activeArenaBattle,
  isStartingArenaBattle,
  isSyncingArenaGoal,
  onDismissSimulationBanner,
  fallbackReason,
  onSyncMainGoal,
  onPaddleCollision,
  onGoalCompleted,
  onStartMatch,
  onPauseMatch,
  onResetMatch,
  onStepTurn,
  onModeratorIntervene,
  onPublishMatch,
  onTriggerDemoMatch,
  onStartDuel,
  onDeployModel,
}) => {
  const canConfigureMatch = status === "idle" || status === "paused" || status === "completed";
  const canStartLoop = status === "idle" || status === "paused" || status === "completed";
  const canEditMainGoal = !isDemoRunning && !isStartingArenaBattle;
  const canEditAgentRuntime = !isDemoRunning;
  const compactMode = density === "compact";
  const [persistedReplayHistory, setPersistedReplayHistory] = React.useState<DebateTurn[] | null>(null);
  const [isLoadingPersistedReplay, setIsLoadingPersistedReplay] = React.useState(false);
  const [isReplayLinkCopied, setIsReplayLinkCopied] = React.useState(false);
  const replayLinkCopiedTimerRef = React.useRef<number | null>(null);
  const [customAgents, setCustomAgents] = React.useState<CustomAgentTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return parseCustomAgentLibrary(window.localStorage.getItem(CUSTOM_AGENT_LIBRARY_STORAGE_KEY));
    } catch {
      return [];
    }
  });
  const [isAgentLibraryOpen, setIsAgentLibraryOpen] = React.useState(false);
  const [agentDraft, setAgentDraft] = React.useState<Agent>(() => createBlankCustomAgent());
  const [editingCustomAgentId, setEditingCustomAgentId] = React.useState<string | null>(null);
  const latestTurn = history[history.length - 1];
  const latestJudge = [...history].reverse().find((turn) => turn.judgeEvaluation)?.judgeEvaluation;
  const averageJudgeScore = latestJudge
    ? Math.round((latestJudge.intellectScore + latestJudge.precisionScore + latestJudge.rhetoricScore) / 3)
    : null;
  const statusLabel =
    status === "idle"
      ? "Idle"
      : status === "paused"
        ? "Paused"
        : status === "completed"
          ? "Complete"
          : status.startsWith("researching")
            ? "Thinking"
            : status.startsWith("scoring")
              ? "Scoring"
              : "Running";
  const statusTone =
    status === "idle"
      ? "border-slate-600 text-slate-300"
      : status === "paused"
        ? "border-amber-400/70 text-amber-300"
        : status === "completed"
          ? "border-cyan-400/70 text-cyan-300"
          : "border-[#00FF41]/70 text-[#00FF41]";
  const activeAgentLabel =
    status === "researching_A" || status === "scoring_A"
      ? agentConfig.agentA.name
      : status === "researching_B" || status === "scoring_B"
        ? agentConfig.agentB.name
        : latestTurn?.sender === "agentA"
          ? agentConfig.agentB.name
          : agentConfig.agentA.name;
  const shotLabel =
    latestTurn?.type === "proposal"
      ? "Claim"
      : latestTurn?.type === "critique"
        ? "Challenge"
        : latestTurn?.type === "rebuttal"
          ? "Counterexample"
          : latestTurn?.type === "agreement"
          ? "Synthesis"
          : "Ready";
  const canOpenVisualReplay = !isDemoRunning;
  const canExportPersistedArena = Boolean(activeArenaBattle?.id);
  const visualReplayHistory = persistedReplayHistory ?? history;
  const exportStamp = () => new Date().toISOString().replace(/[:.]/g, "-");
  const isLiveGoalDirty = Boolean(
    activeArenaBattle?.id && (activeArenaBattle.master_goal !== topic.trim() || activeArenaBattle.rubric !== victoryCondition),
  );
  const canApplyLiveGoal = Boolean(activeArenaBattle?.id) && canEditMainGoal && Boolean(topic.trim()) && isLiveGoalDirty && !isSyncingArenaGoal;
  const liveGoalSyncLabel = activeArenaBattle?.id
    ? isSyncingArenaGoal
      ? "Syncing"
      : isLiveGoalDirty
        ? "Unsynced"
        : "Synced"
    : "Local setup";
  const arenaReplayShareUrl = React.useMemo(() => {
    if (!activeArenaBattle?.id || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("arenaReplay", activeArenaBattle.slug || activeArenaBattle.id);
    url.hash = "";
    return url.toString();
  }, [activeArenaBattle?.id, activeArenaBattle?.slug]);

  React.useEffect(() => {
    if (activeTab !== "arena" || arenaScrollSignal === 0) return;

    let isCancelled = false;
    const scrollBoardIntoView = (attempt = 0) => {
      window.requestAnimationFrame(() => {
        if (isCancelled) return;
        const arena = document.getElementById("pong-game-wrapper") || document.getElementById("pong-canvas-frame");
        if (!arena) {
          if (attempt < 6) {
            window.setTimeout(() => scrollBoardIntoView(attempt + 1), 80);
          }
          return;
        }

        const rect = arena.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const visibleRatio = visibleHeight / Math.max(1, Math.min(rect.height, window.innerHeight));
        if (visibleRatio >= 0.55) return;

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        arena.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
          inline: "nearest",
        });
      });
    };

    const timeoutId = window.setTimeout(() => scrollBoardIntoView(), 40);
    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, arenaScrollSignal]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const replayId = new URLSearchParams(window.location.search).get("arenaReplay");
    if (!replayId) return;

    let isCancelled = false;
    setActiveTab("arena");
    setIsLoadingPersistedReplay(true);

    fetch(`/api/arena-loop/battle/${encodeURIComponent(replayId)}/replay`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.replay)) {
          throw new Error(data?.error || `Arena Loop replay returned status ${response.status}`);
        }
        if (isCancelled) return;
        setPersistedReplayHistory(data.replay as DebateTurn[]);
        setIsReplayOpen(true);
      })
      .catch((err: any) => {
        if (isCancelled) return;
        setErrorMessage(err.message || "Arena Loop shared replay could not be loaded.");
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingPersistedReplay(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [setActiveTab, setErrorMessage, setIsReplayOpen]);

  React.useEffect(() => () => {
    if (replayLinkCopiedTimerRef.current !== null) {
      window.clearTimeout(replayLinkCopiedTimerRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CUSTOM_AGENT_LIBRARY_STORAGE_KEY, JSON.stringify(customAgents));
    } catch {
      // The in-memory library still works if browser storage is unavailable.
    }
  }, [customAgents]);

  const downloadTextFile = (filename: string, content: string, type = "text/plain") => {
    const blob = new Blob([content], { type });
    downloadBlobFile(filename, blob);
  };

  const downloadBlobFile = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const buildSessionExportInput = (): SessionExportInput => ({
    sessionId,
    topic,
    loopMode,
    status,
    statusLabel,
    victoryCondition,
    maxVolleys,
    agentConfig,
    gameSpeed,
    scoreA,
    scoreB,
    history,
    finalizedTasks,
    averageJudgeScore,
    currentComplexity,
    activeTrajectory,
    isSimulationMode,
    fallbackReason,
    deployedModel: Boolean(deployedModel),
    density,
  });

  const buildCurrentSessionArtifact = () => buildSessionArtifact(buildSessionExportInput());

  const exportTranscript = () => {
    downloadTextFile(`cognitive-pong-transcript-${exportStamp()}.txt`, buildTranscriptExport(buildSessionExportInput()));
  };

  const exportMarkdown = () => {
    downloadTextFile(`cognitive-pong-session-${exportStamp()}.md`, buildMarkdownExport(buildSessionExportInput()), "text/markdown");
  };

  const exportJson = () => {
    downloadTextFile(
      `cognitive-pong-session-${exportStamp()}.json`,
      JSON.stringify(buildCurrentSessionArtifact(), null, 2),
      "application/json",
    );
  };

  const exportPersistedArenaJsonlBundle = async () => {
    if (!activeArenaBattle?.id) {
      setErrorMessage("Start an Arena Loop battle before exporting the persisted JSONL bundle.");
      return;
    }

    try {
      const response = await fetch(`/api/arena-loop/battle/${encodeURIComponent(activeArenaBattle.id)}/export/jsonl`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Arena Loop export returned status ${response.status}`);
      }

      downloadTextFile(
        `arena-loop-battle-${activeArenaBattle.slug || activeArenaBattle.id}-${exportStamp()}.json`,
        JSON.stringify(data.export, null, 2),
        "application/json",
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Arena Loop JSONL export failed.");
    }
  };

  const exportPersistedArenaResearchZip = async () => {
    if (!activeArenaBattle?.id) {
      setErrorMessage("Start an Arena Loop battle before exporting the persisted research ZIP.");
      return;
    }

    try {
      const response = await fetch(`/api/arena-loop/battle/${encodeURIComponent(activeArenaBattle.id)}/export/research-bundle.zip`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Arena Loop ZIP export returned status ${response.status}`);
      }

      downloadBlobFile(
        `arena-loop-battle-${activeArenaBattle.slug || activeArenaBattle.id}-research-bundle-${exportStamp()}.zip`,
        await response.blob(),
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Arena Loop research bundle ZIP export failed.");
    }
  };

  const copyArenaReplayLink = async () => {
    if (!arenaReplayShareUrl) return;
    const didCopy = await copyTextToClipboard(arenaReplayShareUrl);
    if (!didCopy) {
      setErrorMessage("Arena replay link could not be copied in this browser.");
      return;
    }

    setIsReplayLinkCopied(true);
    if (replayLinkCopiedTimerRef.current !== null) {
      window.clearTimeout(replayLinkCopiedTimerRef.current);
    }
    replayLinkCopiedTimerRef.current = window.setTimeout(() => {
      setIsReplayLinkCopied(false);
      replayLinkCopiedTimerRef.current = null;
    }, 1600);
  };

  const openVisualReplay = async () => {
    if (isLoadingPersistedReplay) return;

    if (!activeArenaBattle?.id) {
      setPersistedReplayHistory(null);
      setIsReplayOpen(true);
      return;
    }

    setIsLoadingPersistedReplay(true);
    try {
      const response = await fetch(`/api/arena-loop/battle/${encodeURIComponent(activeArenaBattle.id)}/replay`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !Array.isArray(data.replay)) {
        throw new Error(data?.error || `Arena Loop replay returned status ${response.status}`);
      }

      setPersistedReplayHistory(data.replay as DebateTurn[]);
      setIsReplayOpen(true);
    } catch (err: any) {
      setPersistedReplayHistory(null);
      setIsReplayOpen(true);
      setErrorMessage(err.message || "Arena Loop replay could not be loaded; showing the local session replay instead.");
    } finally {
      setIsLoadingPersistedReplay(false);
    }
  };

  const closeVisualReplay = () => {
    setIsReplayOpen(false);
    setPersistedReplayHistory(null);
  };

  const exportConfig = () => {
    const redactedAgentConfig = redactAgentConfigForExport(agentConfig);

    downloadTextFile(
      `cognitive-pong-agent-config-${exportStamp()}.json`,
      JSON.stringify({ topic, loopMode, victoryCondition, maxVolleys, agentConfig: redactedAgentConfig }, null, 2),
      "application/json",
    );
  };

  const applyPresetScenario = (index: number) => {
    if (!canConfigureMatch) return;
    const preset = PRESET_SCENARIOS[index];
    setTopic(preset.topic);
    setAgentConfig((prev) => ({
      ...prev,
      agentA: applyAgentTemplatePreservingRuntime(preset.agentA, prev.agentA),
      agentB: applyAgentTemplatePreservingRuntime(preset.agentB, prev.agentB),
    }));
  };

  const handleAgentPresetSelect = (agentKey: "agentA" | "agentB", value: string) => {
    if (!canConfigureMatch) return;
    if (value.startsWith("custom:")) {
      const template = customAgents.find((item) => item.id === value.slice("custom:".length));
      if (!template) return;
      setAgentConfig((prev) => ({
        ...prev,
        [agentKey]: cloneAgentForLibrary(template.agent),
      }));
      return;
    }

    const [scenarioIndexRaw, side] = value.split(":") as [string, "agentA" | "agentB"];
    const preset = PRESET_SCENARIOS[Number(scenarioIndexRaw)];
    if (!preset) return;
    setAgentConfig((prev) => ({
      ...prev,
      [agentKey]: applyAgentTemplatePreservingRuntime(preset[side], prev[agentKey]),
    }));
  };

  const openCreateAgentModal = (sourceAgent?: Agent) => {
    setEditingCustomAgentId(null);
    setAgentDraft(cloneAgentForLibrary(sourceAgent || createBlankCustomAgent()));
    setIsAgentLibraryOpen(true);
  };

  const openEditCustomAgentModal = (template: CustomAgentTemplate) => {
    setEditingCustomAgentId(template.id);
    setAgentDraft(cloneAgentForLibrary(template.agent));
    setIsAgentLibraryOpen(true);
  };

  const saveCustomAgentDraft = () => {
    const existing = editingCustomAgentId
      ? customAgents.find((template) => template.id === editingCustomAgentId)
      : undefined;
    const template = createCustomAgentTemplate(agentDraft, { existing });
    setCustomAgents((prev) => upsertCustomAgentTemplate(prev, template));
    setEditingCustomAgentId(template.id);
    setAgentDraft(cloneAgentForLibrary(template.agent));
  };

  const loadCustomAgentIntoSide = (agentKey: "agentA" | "agentB", template: CustomAgentTemplate) => {
    if (!canConfigureMatch) return;
    setAgentConfig((prev) => ({
      ...prev,
      [agentKey]: cloneAgentForLibrary(template.agent),
    }));
    setIsAgentLibraryOpen(false);
  };

  const deleteCustomAgent = (id: string) => {
    setCustomAgents((prev) => removeCustomAgentTemplate(prev, id));
    if (editingCustomAgentId === id) {
      setEditingCustomAgentId(null);
      setAgentDraft(createBlankCustomAgent());
    }
  };

  const handleAgentDraftFieldChange = (field: keyof Agent, value: string | number) => {
    setAgentDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAgentDraftProviderChange = (provider: ProviderKind) => {
    setAgentDraft((prev) => applyAgentProviderSelection(prev, provider));
  };

  const handleAgentDraftModelChange = (model: string) => {
    setAgentDraft((prev) => applyAgentModelSelection(prev, model));
  };

  const handleAgentDraftBridgeChange = (patch: Partial<AgentBridgeConfig>) => {
    setAgentDraft((prev) => {
      const currentBridge = prev.bridge || { kind: "none" as AgentBridgeKind };
      const nextBridge: AgentBridgeConfig = {
        kind: currentBridge.kind || "none",
        ...currentBridge,
        ...patch,
      };

      if (patch.kind === "none") {
        return { ...prev, bridge: { kind: "none" } };
      }
      if (bridgeUsesEndpoint(patch.kind)) {
        delete nextBridge.command;
        delete nextBridge.args;
        delete nextBridge.cwd;
        delete nextBridge.profileId;
      }
      if (bridgeUsesCommand(patch.kind)) {
        delete nextBridge.endpointUrl;
        delete nextBridge.apiKey;
        delete nextBridge.toolName;
        delete nextBridge.command;
        delete nextBridge.args;
        delete nextBridge.cwd;
        nextBridge.profileId = nextBridge.profileId || defaultBridgeProfileForKind(patch.kind);
      }

      return { ...prev, bridge: nextBridge };
    });
  };

  const handleAgentRuntimeFieldChange = (
    agentKey: "agentA" | "agentB",
    field: keyof Agent,
    value: string | number
  ) => {
    if (!canEditAgentRuntime) return;
    setAgentConfig((prev) => ({
      ...prev,
      [agentKey]: {
        ...prev[agentKey],
        [field]: value,
      },
    }));
  };

  const handleAgentDebateStyleChange = (agentKey: "agentA" | "agentB", value: NonNullable<Agent["debateStyle"]>) => {
    if (!canEditAgentRuntime) return;
    setAgentConfig((prev) => ({
      ...prev,
      [agentKey]: {
        ...prev[agentKey],
        debateStyle: value,
        strategyBias: value,
      },
    }));
  };

  const handleAgentProviderChange = (agentKey: "agentA" | "agentB", provider: ProviderKind) => {
    if (!canEditAgentRuntime) return;
    setAgentConfig((prev) => ({
      ...prev,
      [agentKey]: applyAgentProviderSelection(prev[agentKey], provider),
    }));
  };

  const handleAgentModelChange = (agentKey: "agentA" | "agentB", model: string) => {
    if (!canEditAgentRuntime) return;
    setAgentConfig((prev) => ({
      ...prev,
      [agentKey]: applyAgentModelSelection(prev[agentKey], model),
    }));
  };

  const handleAgentBridgeChange = (
    agentKey: "agentA" | "agentB",
    patch: Partial<AgentBridgeConfig>,
  ) => {
    if (!canEditAgentRuntime) return;

    setAgentConfig((prev) => {
      const currentBridge = prev[agentKey].bridge || { kind: "none" as AgentBridgeKind };
      const nextBridge: AgentBridgeConfig = {
        kind: currentBridge.kind || "none",
        ...currentBridge,
        ...patch,
      };

      if (patch.kind === "none") {
        return {
          ...prev,
          [agentKey]: {
            ...prev[agentKey],
            bridge: { kind: "none" },
          },
        };
      }

      if (bridgeUsesEndpoint(patch.kind)) {
        delete nextBridge.command;
        delete nextBridge.args;
        delete nextBridge.cwd;
        delete nextBridge.profileId;
      }

      if (bridgeUsesCommand(patch.kind)) {
        delete nextBridge.endpointUrl;
        delete nextBridge.apiKey;
        delete nextBridge.toolName;
        delete nextBridge.command;
        delete nextBridge.args;
        delete nextBridge.cwd;
        nextBridge.profileId = nextBridge.profileId || defaultBridgeProfileForKind(patch.kind);
      }

      return {
        ...prev,
        [agentKey]: {
          ...prev[agentKey],
          bridge: nextBridge,
        },
      };
    });
  };

  const handleGameSpeedChange = (value: number) => {
    if (!Number.isFinite(value)) return;
    setGameSpeed(Math.max(1, Math.min(5, Math.round(value))));
  };

  const renderAgentRuntimeControls = (
    agentKey: "agentA" | "agentB",
    idPrefix: string,
    showTuning = false,
  ) => {
    const agent = agentConfig[agentKey];
    const isA = agentKey === "agentA";
    const provider = agent.provider || "mock";
    const selectedModel = resolveAgentModelSelection(agent, agentConfig.model);
    const effectiveModel = agent.customModel || selectedModel;
    const effectiveEndpoint = resolvedEndpointLabel(provider, agent.endpointUrl, effectiveModel);
    const bridge = agent.bridge || { kind: "none" as AgentBridgeKind };
    const bridgeKind = bridge.kind || "none";
    const bridgeProfileValue = bridge.profileId || defaultBridgeProfileForKind(bridgeKind);
    const focusClass = isA ? "focus:border-[#00FF41]" : "focus:border-[#FF7A3D]";
    const accentText = isA ? "text-[#00FF41]" : "text-[#FF7A3D]";

    return (
      <div className="grid gap-3" id={`${idPrefix}-runtime-controls`}>
        <div className="grid gap-2 rounded-md border border-white/10 bg-black/35 p-3 text-xs font-semibold text-slate-300 sm:grid-cols-2">
          <div className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Effective model</span>
            <span className={`block truncate font-mono ${accentText}`} title={effectiveModel}>{effectiveModel}</span>
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Resolved target</span>
            <span className="block truncate font-mono text-slate-200" title={effectiveEndpoint}>{effectiveEndpoint}</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-provider`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Provider
            </label>
            <select
              id={`${idPrefix}-provider`}
              data-testid={`${idPrefix}-provider`}
              aria-label={`${isA ? "Agent A" : "Agent B"} provider`}
              value={provider}
              onChange={(event) => handleAgentProviderChange(agentKey, event.target.value as ProviderKind)}
              disabled={!canEditAgentRuntime}
              className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-model`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Model
            </label>
            <select
              id={`${idPrefix}-model`}
              data-testid={`${idPrefix}-model`}
              aria-label={`${isA ? "Agent A" : "Agent B"} model`}
              value={selectedModel}
              onChange={(event) => handleAgentModelChange(agentKey, event.target.value)}
              disabled={!canEditAgentRuntime}
              className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm font-mono ${accentText} outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {modelOptionsForProvider(provider, selectedModel).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-custom-model`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Custom model override
            </label>
            <input
              id={`${idPrefix}-custom-model`}
              data-testid={`${idPrefix}-custom-model`}
              aria-label={`${isA ? "Agent A" : "Agent B"} custom model override`}
              type="text"
              value={agent.customModel || ""}
              placeholder={`Optional, e.g. ${modelPlaceholder(provider)}`}
              onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "customModel", event.target.value)}
              disabled={!canEditAgentRuntime}
              className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </div>

          {providerNeedsEndpoint(provider) && (
            <div>
              <label htmlFor={`${idPrefix}-endpoint`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Endpoint URL / instance
              </label>
              <input
                id={`${idPrefix}-endpoint`}
                data-testid={`${idPrefix}-endpoint`}
                aria-label={`${isA ? "Agent A" : "Agent B"} endpoint URL or instance`}
                type="text"
                value={agent.endpointUrl || ""}
                placeholder={endpointPlaceholder(provider, effectiveModel)}
                onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "endpointUrl", event.target.value)}
                disabled={!canEditAgentRuntime}
                className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
              />
            </div>
          )}

          {providerNeedsApiKey(provider) && (
            <div>
              <label htmlFor={`${idPrefix}-token`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                API key / token
              </label>
              <input
                id={`${idPrefix}-token`}
                data-testid={`${idPrefix}-token`}
                aria-label={`${isA ? "Agent A" : "Agent B"} API key or bearer token`}
                type="password"
                value={agent.customApiKey || ""}
                autoComplete="new-password"
                placeholder={providerTokenPlaceholder(provider)}
                onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "customApiKey", event.target.value)}
                disabled={!canEditAgentRuntime}
                className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
              />
            </div>
          )}
        </div>

        <details
          className="group rounded-md border border-cyan-300/15 bg-cyan-300/[0.04]"
          id={`${idPrefix}-bridge-details`}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-black uppercase tracking-wide text-cyan-200">
            <span>CLI, Codex, and tool bridge override</span>
            <ChevronDown className="h-4 w-4 text-cyan-300 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-cyan-300/15 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor={`${idPrefix}-bridge-kind`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Bridge adapter
                </label>
                <select
                  id={`${idPrefix}-bridge-kind`}
                  data-testid={`${idPrefix}-bridge-kind`}
                  aria-label={`${isA ? "Agent A" : "Agent B"} CLI or tool bridge adapter`}
                  value={bridgeKind}
                  onChange={(event) => handleAgentBridgeChange(agentKey, { kind: event.target.value as AgentBridgeKind })}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {BRIDGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${idPrefix}-bridge-timeout`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Timeout ms
                </label>
                <input
                  id={`${idPrefix}-bridge-timeout`}
                  data-testid={`${idPrefix}-bridge-timeout`}
                  type="number"
                  min={1000}
                  max={120000}
                  step={1000}
                  value={bridge.timeoutMs || 15000}
                  onChange={(event) => handleAgentBridgeChange(agentKey, { timeoutMs: Number(event.target.value) || 15000 })}
                  disabled={!canEditAgentRuntime || bridgeKind === "none"}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
            </div>

            {bridgeUsesEndpoint(bridgeKind) && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor={`${idPrefix}-bridge-endpoint`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Bridge endpoint
                  </label>
                  <input
                    id={`${idPrefix}-bridge-endpoint`}
                    data-testid={`${idPrefix}-bridge-endpoint`}
                    type="text"
                    value={bridge.endpointUrl || ""}
                    placeholder={bridgeEndpointPlaceholder(bridgeKind)}
                    onChange={(event) => handleAgentBridgeChange(agentKey, { endpointUrl: event.target.value })}
                    disabled={!canEditAgentRuntime}
                    className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  />
                </div>
                <div>
                  <label htmlFor={`${idPrefix}-bridge-tool-or-token`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    {bridgeKind === "mcp" ? "Tool name" : "Bearer token"}
                  </label>
                  <input
                    id={`${idPrefix}-bridge-tool-or-token`}
                    data-testid={`${idPrefix}-bridge-tool-or-token`}
                    type={bridgeKind === "mcp" ? "text" : "password"}
                    value={bridgeKind === "mcp" ? (bridge.toolName || "") : (bridge.apiKey || "")}
                    placeholder={bridgeKind === "mcp" ? "cognitive_pong_turn" : "optional"}
                    onChange={(event) => handleAgentBridgeChange(agentKey, bridgeKind === "mcp" ? { toolName: event.target.value } : { apiKey: event.target.value })}
                    disabled={!canEditAgentRuntime}
                    className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  />
                </div>
              </div>
            )}

            {bridgeUsesCommand(bridgeKind) && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor={`${idPrefix}-bridge-profile`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Server profile
                  </label>
                  <input
                    id={`${idPrefix}-bridge-profile`}
                    data-testid={`${idPrefix}-bridge-profile`}
                    type="text"
                    value={bridgeProfileValue}
                    placeholder={bridgeProfilePlaceholder(bridgeKind)}
                    onChange={(event) => handleAgentBridgeChange(agentKey, { profileId: event.target.value })}
                    disabled={!canEditAgentRuntime}
                    className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  />
                </div>
                <div className="rounded-md border border-white/10 bg-black/50 px-3 py-2 text-xs font-semibold text-slate-300">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Command source</span>
                  <span className="block text-slate-200">Server allowlist only</span>
                </div>
                <div className="md:col-span-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
                  Local CLI bridges run only when the server has COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true. Commands, args, cwd, and dangerous sandbox options must be configured in server-side profiles; browser-supplied shell commands are ignored.
                </div>
              </div>
            )}
          </div>
        </details>

        {showTuning && (
          <details
            className="group rounded-md border border-white/10 bg-black/25"
            id={`${idPrefix}-profile-details`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-300">
              <span>Profile, instructions, and strategy</span>
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-4 border-t border-white/10 p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_92px]">
              <div>
                <label htmlFor={`${idPrefix}-name`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Display name
                </label>
                <input
                  id={`${idPrefix}-name`}
                  data-testid={`${idPrefix}-name`}
                  type="text"
                  value={agent.name}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "name", event.target.value)}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-avatar`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Avatar
                </label>
                <input
                  id={`${idPrefix}-avatar`}
                  data-testid={`${idPrefix}-avatar`}
                  type="text"
                  value={agent.avatar}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "avatar", event.target.value)}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${idPrefix}-role`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Role and default stance
              </label>
              <textarea
                id={`${idPrefix}-role`}
                data-testid={`${idPrefix}-role`}
                rows={2}
                value={agent.role}
                onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "role", event.target.value)}
                disabled={!canEditAgentRuntime}
                className={`w-full resize-none rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label htmlFor={`${idPrefix}-personality`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Personality
                </label>
                <input
                  id={`${idPrefix}-personality`}
                  data-testid={`${idPrefix}-personality`}
                  type="text"
                  value={agent.personality || ""}
                  placeholder="e.g. rigorous, playful, sober"
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "personality", event.target.value)}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-psychology-archetype`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Psychology archetype
                </label>
                <select
                  id={`${idPrefix}-psychology-archetype`}
                  data-testid={`${idPrefix}-psychology-archetype`}
                  value={agent.psychologyArchetype || "operator"}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "psychologyArchetype", event.target.value)}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {PSYCHOLOGY_ARCHETYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${idPrefix}-debate-style`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Debate style
                </label>
                <select
                  id={`${idPrefix}-debate-style`}
                  data-testid={`${idPrefix}-debate-style`}
                  value={agent.debateStyle || agent.strategyBias || "balanced"}
                  onChange={(event) => handleAgentDebateStyleChange(agentKey, event.target.value as NonNullable<Agent["debateStyle"]>)}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {DEBATE_STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor={`${idPrefix}-custom-instructions`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Custom instructions
              </label>
              <textarea
                id={`${idPrefix}-custom-instructions`}
                data-testid={`${idPrefix}-custom-instructions`}
                rows={3}
                value={agent.systemPrompt || ""}
                placeholder="Agent-specific rules, style, and constraints."
                onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "systemPrompt", event.target.value)}
                disabled={!canEditAgentRuntime}
                className={`w-full resize-none rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label htmlFor={`${idPrefix}-win-drive`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Win-drive <span className={accentText}>{agent.competitiveDrive ?? 50}%</span>
                </label>
                <input
                  id={`${idPrefix}-win-drive`}
                  data-testid={`${idPrefix}-win-drive`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={agent.competitiveDrive ?? 50}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "competitiveDrive", Number(event.target.value))}
                  disabled={!canEditAgentRuntime}
                  className="w-full accent-[#00FF41] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-risk-tolerance`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Risk tolerance <span className={accentText}>{(agent.riskTolerance ?? 0.5).toFixed(2)}</span>
                </label>
                <input
                  id={`${idPrefix}-risk-tolerance`}
                  data-testid={`${idPrefix}-risk-tolerance`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={agent.riskTolerance ?? 0.5}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "riskTolerance", Number(event.target.value))}
                  disabled={!canEditAgentRuntime}
                  className="w-full accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-collaboration-bias`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Collaboration <span className={accentText}>{(agent.collaborationBias ?? 0.5).toFixed(2)}</span>
                </label>
                <input
                  id={`${idPrefix}-collaboration-bias`}
                  data-testid={`${idPrefix}-collaboration-bias`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={agent.collaborationBias ?? 0.5}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "collaborationBias", Number(event.target.value))}
                  disabled={!canEditAgentRuntime}
                  className="w-full accent-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor={`${idPrefix}-temperature`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Temperature
                </label>
                <input
                  id={`${idPrefix}-temperature`}
                  data-testid={`${idPrefix}-temperature`}
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={agent.temperature ?? 0.7}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "temperature", parseFloat(event.target.value))}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-max-tokens`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Max tokens
                </label>
                <input
                  id={`${idPrefix}-max-tokens`}
                  data-testid={`${idPrefix}-max-tokens`}
                  type="number"
                  min={128}
                  max={4096}
                  step={128}
                  value={agent.maxTokens ?? 1024}
                  onChange={(event) => handleAgentRuntimeFieldChange(agentKey, "maxTokens", parseInt(event.target.value, 10))}
                  disabled={!canEditAgentRuntime}
                  className={`w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-slate-200 outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
            </div>
            </div>
          </details>
        )}
      </div>
    );
  };

  const renderAgentRouteSummary = (agentKey: "agentA" | "agentB") => {
    const agent = agentConfig[agentKey];
    const isA = agentKey === "agentA";
    const provider = agent.provider || "mock";
    const selectedModel = resolveAgentModelSelection(agent, agentConfig.model);
    const effectiveModel = agent.customModel || selectedModel;
    const idPrefix = isA ? "route-summary-agent-a" : "route-summary-agent-b";
    const accentText = isA ? "text-[#00FF41]" : "text-[#FF7A3D]";
    const borderClass = isA ? "border-[#00FF41]/30" : "border-[#FF7A3D]/30";
    const endpointLabel = resolvedEndpointLabel(provider, agent.endpointUrl, effectiveModel);
    const bridgeKind = agent.bridge?.kind || "none";
    const bridgeLabel = bridgeKind === "none"
      ? "Provider route"
      : `${bridgeKind}${agent.bridge?.label ? ` / ${agent.bridge.label}` : ""}`;

    return (
      <div className={`rounded-md border bg-black/35 p-3 ${borderClass}`} id={`${idPrefix}-card`}>
        <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-xs font-black uppercase tracking-wide ${accentText}`}>
              {isA ? "Agent A route" : "Agent B route"}
            </p>
            <p className="truncate text-sm font-bold text-white">{agent.name}</p>
          </div>
          <span className={`shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase ${accentText}`}>
            {provider}
          </span>
        </div>

        <div className="grid gap-2 text-xs">
          <div className="min-w-0 rounded-md border border-white/10 bg-black/45 px-2 py-2">
            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Model</span>
            <span className={`block truncate font-mono ${accentText}`} title={effectiveModel}>{effectiveModel}</span>
          </div>
          <div className="min-w-0 rounded-md border border-white/10 bg-black/45 px-2 py-2">
            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Endpoint / instance</span>
            <span className="block truncate font-mono text-slate-300" title={endpointLabel}>{endpointLabel}</span>
          </div>
          <div className="min-w-0 rounded-md border border-white/10 bg-black/45 px-2 py-2">
            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Bridge override</span>
            <span className="block truncate font-mono text-cyan-200" title={bridgeLabel}>{bridgeLabel}</span>
          </div>
          <a
            href={`#${isA ? "runtime-agent-a" : "runtime-agent-b"}-provider`}
            className={`inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-wide hover:bg-white hover:text-black ${accentText}`}
          >
            Edit {isA ? "Agent A" : "Agent B"}
          </a>
        </div>
      </div>
    );
  };

  const renderCustomAgentLibraryModal = () => {
    if (!isAgentLibraryOpen) return null;

    const draftProvider = agentDraft.provider || "mock";
    const draftSelectedModel = resolveAgentModelSelection(agentDraft, agentConfig.model);
    const draftEffectiveModel = agentDraft.customModel || draftSelectedModel;
    const draftBridge = agentDraft.bridge || { kind: "none" as AgentBridgeKind };
    const draftBridgeKind = draftBridge.kind || "none";
    const draftBridgeProfileValue = draftBridge.profileId || defaultBridgeProfileForKind(draftBridgeKind);

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        id="custom-agent-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-agent-library-title"
      >
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-cyan-300/35 bg-[#05070A] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Agent library</p>
              <h2 id="custom-agent-library-title" className="text-2xl font-black text-white">Create New Agent</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                id="custom-agent-start-from-a"
                type="button"
                onClick={() => setAgentDraft(cloneAgentForLibrary(agentConfig.agentA))}
                className="rounded-md border border-[#00FF41]/35 bg-[#00FF41]/10 px-3 py-2 text-xs font-black uppercase text-[#00FF41] hover:bg-[#00FF41] hover:text-black"
              >
                Use Agent A
              </button>
              <button
                id="custom-agent-start-from-b"
                type="button"
                onClick={() => setAgentDraft(cloneAgentForLibrary(agentConfig.agentB))}
                className="rounded-md border border-[#FF7A3D]/35 bg-[#FF7A3D]/10 px-3 py-2 text-xs font-black uppercase text-[#FF7A3D] hover:bg-[#FF7A3D] hover:text-black"
              >
                Use Agent B
              </button>
              <button
                id="custom-agent-new-blank"
                type="button"
                onClick={() => {
                  setEditingCustomAgentId(null);
                  setAgentDraft(createBlankCustomAgent());
                }}
                className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase text-slate-200 hover:bg-white hover:text-black"
              >
                Blank
              </button>
              <button
                id="close-custom-agent-modal"
                type="button"
                onClick={() => setIsAgentLibraryOpen(false)}
                className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase text-slate-200 hover:bg-white hover:text-black"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-auto border-b border-white/10 p-4 lg:border-b-0 lg:border-r" id="custom-agent-library-list">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">My agents</span>
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-slate-300">{customAgents.length}</span>
              </div>
              <div className="grid gap-2">
                {customAgents.length === 0 ? (
                  <div className="rounded-md border border-white/10 bg-black/45 p-3 text-sm text-slate-400" id="custom-agent-library-empty">
                    No saved agents yet.
                  </div>
                ) : customAgents.map((template) => (
                  <div key={template.id} className="rounded-md border border-white/10 bg-black/45 p-3" data-testid="custom-agent-library-row">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-white">{template.agent.name}</p>
                        <p className="truncate text-xs text-slate-500">{template.agent.provider || "mock"} / {template.agent.customModel || template.agent.model || "mock-local"}</p>
                      </div>
                      <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">{template.agent.avatar}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => loadCustomAgentIntoSide("agentA", template)}
                        className="rounded-md border border-[#00FF41]/30 bg-[#00FF41]/10 px-2 py-2 text-xs font-bold text-[#00FF41] hover:bg-[#00FF41] hover:text-black"
                      >
                        Load A
                      </button>
                      <button
                        type="button"
                        onClick={() => loadCustomAgentIntoSide("agentB", template)}
                        className="rounded-md border border-[#FF7A3D]/30 bg-[#FF7A3D]/10 px-2 py-2 text-xs font-bold text-[#FF7A3D] hover:bg-[#FF7A3D] hover:text-black"
                      >
                        Load B
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditCustomAgentModal(template)}
                        className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-300 hover:text-black"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomAgent(template.id)}
                        className="rounded-md border border-red-400/25 bg-red-400/10 px-2 py-2 text-xs font-bold text-red-200 hover:bg-red-400 hover:text-black"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div className="min-h-0 overflow-auto p-4" id="custom-agent-editor">
              <div className="grid gap-4">
                <section className="grid gap-3 rounded-md border border-white/10 bg-black/30 p-3 md:grid-cols-[minmax(0,1fr)_100px_120px]">
                  <div>
                    <label htmlFor="custom-agent-name" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Name</label>
                    <input
                      id="custom-agent-name"
                      data-testid="custom-agent-name"
                      type="text"
                      value={agentDraft.name}
                      onChange={(event) => handleAgentDraftFieldChange("name", event.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-avatar" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Avatar</label>
                    <input
                      id="custom-agent-avatar"
                      data-testid="custom-agent-avatar"
                      type="text"
                      value={agentDraft.avatar}
                      onChange={(event) => handleAgentDraftFieldChange("avatar", event.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-color" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Color</label>
                    <input
                      id="custom-agent-color"
                      data-testid="custom-agent-color"
                      type="text"
                      value={agentDraft.color}
                      onChange={(event) => handleAgentDraftFieldChange("color", event.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label htmlFor="custom-agent-role" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</label>
                    <textarea
                      id="custom-agent-role"
                      data-testid="custom-agent-role"
                      rows={2}
                      value={agentDraft.role}
                      onChange={(event) => handleAgentDraftFieldChange("role", event.target.value)}
                      className="w-full resize-none rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                </section>

                <section className="grid gap-3 rounded-md border border-white/10 bg-black/30 p-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="custom-agent-provider" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Provider</label>
                    <select
                      id="custom-agent-provider"
                      data-testid="custom-agent-provider"
                      value={draftProvider}
                      onChange={(event) => handleAgentDraftProviderChange(event.target.value as ProviderKind)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      {PROVIDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="custom-agent-model" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Model</label>
                    <select
                      id="custom-agent-model"
                      data-testid="custom-agent-model"
                      value={draftSelectedModel}
                      onChange={(event) => handleAgentDraftModelChange(event.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-cyan-200 outline-none focus:border-cyan-300"
                    >
                      {modelOptionsForProvider(draftProvider, draftSelectedModel).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="custom-agent-custom-model" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Custom model</label>
                    <input
                      id="custom-agent-custom-model"
                      data-testid="custom-agent-custom-model"
                      type="text"
                      value={agentDraft.customModel || ""}
                      placeholder={modelPlaceholder(draftProvider)}
                      onChange={(event) => handleAgentDraftFieldChange("customModel", event.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-endpoint" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Endpoint</label>
                    <input
                      id="custom-agent-endpoint"
                      data-testid="custom-agent-endpoint"
                      type="text"
                      value={agentDraft.endpointUrl || ""}
                      placeholder={endpointPlaceholder(draftProvider, draftEffectiveModel)}
                      onChange={(event) => handleAgentDraftFieldChange("endpointUrl", event.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="custom-agent-token" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">API key / token</label>
                    <input
                      id="custom-agent-token"
                      data-testid="custom-agent-token"
                      type="password"
                      value={agentDraft.customApiKey || ""}
                      placeholder={providerTokenPlaceholder(draftProvider)}
                      autoComplete="new-password"
                      onChange={(event) => handleAgentDraftFieldChange("customApiKey", event.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                </section>

                <section className="grid gap-3 rounded-md border border-cyan-300/15 bg-cyan-300/[0.04] p-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="custom-agent-bridge-kind" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bridge</label>
                    <select
                      id="custom-agent-bridge-kind"
                      data-testid="custom-agent-bridge-kind"
                      value={draftBridgeKind}
                      onChange={(event) => handleAgentDraftBridgeChange({ kind: event.target.value as AgentBridgeKind })}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      {BRIDGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="custom-agent-bridge-label" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bridge label</label>
                    <input
                      id="custom-agent-bridge-label"
                      data-testid="custom-agent-bridge-label"
                      type="text"
                      value={draftBridge.label || ""}
                      placeholder={draftBridgeKind === "none" ? "off" : draftBridgeKind}
                      onChange={(event) => handleAgentDraftBridgeChange({ label: event.target.value })}
                      disabled={draftBridgeKind === "none"}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-bridge-timeout" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bridge timeout</label>
                    <input
                      id="custom-agent-bridge-timeout"
                      data-testid="custom-agent-bridge-timeout"
                      type="number"
                      min={1000}
                      max={120000}
                      step={1000}
                      value={draftBridge.timeoutMs || 15000}
                      onChange={(event) => handleAgentDraftBridgeChange({ timeoutMs: Number(event.target.value) || 15000 })}
                      disabled={draftBridgeKind === "none"}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300 disabled:opacity-60"
                    />
                  </div>
                  {bridgeUsesEndpoint(draftBridgeKind) && (
                    <>
                      <div>
                        <label htmlFor="custom-agent-bridge-endpoint" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bridge endpoint</label>
                        <input
                          id="custom-agent-bridge-endpoint"
                          data-testid="custom-agent-bridge-endpoint"
                          type="text"
                          value={draftBridge.endpointUrl || ""}
                          placeholder={bridgeEndpointPlaceholder(draftBridgeKind)}
                          onChange={(event) => handleAgentDraftBridgeChange({ endpointUrl: event.target.value })}
                          className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                        />
                      </div>
                      <div>
                        <label htmlFor="custom-agent-bridge-tool-token" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                          {draftBridgeKind === "mcp" ? "Tool name" : "Bridge token"}
                        </label>
                        <input
                          id="custom-agent-bridge-tool-token"
                          data-testid="custom-agent-bridge-tool-token"
                          type={draftBridgeKind === "mcp" ? "text" : "password"}
                          value={draftBridgeKind === "mcp" ? (draftBridge.toolName || "") : (draftBridge.apiKey || "")}
                          onChange={(event) => handleAgentDraftBridgeChange(draftBridgeKind === "mcp" ? { toolName: event.target.value } : { apiKey: event.target.value })}
                          className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                        />
                      </div>
                    </>
                  )}
                  {bridgeUsesCommand(draftBridgeKind) && (
                    <>
                      <div>
                        <label htmlFor="custom-agent-bridge-profile" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Server profile</label>
                        <input
                          id="custom-agent-bridge-profile"
                          data-testid="custom-agent-bridge-profile"
                          type="text"
                          value={draftBridgeProfileValue}
                          placeholder={bridgeProfilePlaceholder(draftBridgeKind)}
                          onChange={(event) => handleAgentDraftBridgeChange({ profileId: event.target.value })}
                          className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                        />
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/50 px-3 py-2 text-xs font-semibold text-slate-300">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Command source</span>
                        <span className="block text-slate-200">Server allowlist only</span>
                      </div>
                      <div className="md:col-span-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
                        Saved agents store only the selected server profile. Command, args, cwd, and sandbox flags stay in environment-managed CLI profiles.
                      </div>
                    </>
                  )}
                </section>

                <section className="grid gap-3 rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label htmlFor="custom-agent-personality" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Personality</label>
                      <input
                        id="custom-agent-personality"
                        data-testid="custom-agent-personality"
                        type="text"
                        value={agentDraft.personality || ""}
                        onChange={(event) => handleAgentDraftFieldChange("personality", event.target.value)}
                        className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-agent-archetype" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Archetype</label>
                      <select
                        id="custom-agent-archetype"
                        data-testid="custom-agent-archetype"
                        value={agentDraft.psychologyArchetype || "operator"}
                        onChange={(event) => handleAgentDraftFieldChange("psychologyArchetype", event.target.value)}
                        className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                      >
                        {PSYCHOLOGY_ARCHETYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="custom-agent-style" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Style</label>
                      <select
                        id="custom-agent-style"
                        data-testid="custom-agent-style"
                        value={agentDraft.debateStyle || agentDraft.strategyBias || "balanced"}
                        onChange={(event) => {
                          const style = event.target.value as NonNullable<Agent["debateStyle"]>;
                          handleAgentDraftFieldChange("debateStyle", style);
                          handleAgentDraftFieldChange("strategyBias", style);
                        }}
                        className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                      >
                        {DEBATE_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="custom-agent-instructions" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Custom instructions</label>
                    <textarea
                      id="custom-agent-instructions"
                      data-testid="custom-agent-instructions"
                      rows={3}
                      value={agentDraft.systemPrompt || ""}
                      onChange={(event) => handleAgentDraftFieldChange("systemPrompt", event.target.value)}
                      className="w-full resize-none rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-tendencies" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Strategic tendencies</label>
                    <textarea
                      id="custom-agent-tendencies"
                      data-testid="custom-agent-tendencies"
                      rows={2}
                      value={agentDraft.strategicTendencies || ""}
                      onChange={(event) => handleAgentDraftFieldChange("strategicTendencies", event.target.value)}
                      className="w-full resize-none rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-safety" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Safety constraints</label>
                    <textarea
                      id="custom-agent-safety"
                      data-testid="custom-agent-safety"
                      rows={2}
                      value={agentDraft.safetyConstraints || ""}
                      onChange={(event) => handleAgentDraftFieldChange("safetyConstraints", event.target.value)}
                      className="w-full resize-none rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                </section>

                <section className="grid gap-3 rounded-md border border-white/10 bg-black/30 p-3 md:grid-cols-3">
                  {[
                    { id: "win", label: "Win-drive", field: "competitiveDrive" as const, value: agentDraft.competitiveDrive ?? 60, min: 0, max: 100, step: 5 },
                    { id: "aggression", label: "Aggressiveness", field: "aggressiveness" as const, value: agentDraft.aggressiveness ?? 50, min: 0, max: 100, step: 5 },
                    { id: "empathy", label: "Empathy", field: "empathy" as const, value: agentDraft.empathy ?? 50, min: 0, max: 100, step: 5 },
                  ].map((item) => (
                    <div key={item.id}>
                      <label htmlFor={`custom-agent-${item.id}`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        {item.label} <span className="text-cyan-200">{item.value}</span>
                      </label>
                      <input
                        id={`custom-agent-${item.id}`}
                        data-testid={`custom-agent-${item.id}`}
                        type="range"
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        value={item.value}
                        onChange={(event) => handleAgentDraftFieldChange(item.field, Number(event.target.value))}
                        className="w-full accent-cyan-300"
                      />
                    </div>
                  ))}
                  <div>
                    <label htmlFor="custom-agent-risk" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Risk <span className="text-cyan-200">{(agentDraft.riskTolerance ?? 0.5).toFixed(2)}</span>
                    </label>
                    <input
                      id="custom-agent-risk"
                      data-testid="custom-agent-risk"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={agentDraft.riskTolerance ?? 0.5}
                      onChange={(event) => handleAgentDraftFieldChange("riskTolerance", Number(event.target.value))}
                      className="w-full accent-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-collaboration" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Collaboration <span className="text-cyan-200">{(agentDraft.collaborationBias ?? 0.5).toFixed(2)}</span>
                    </label>
                    <input
                      id="custom-agent-collaboration"
                      data-testid="custom-agent-collaboration"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={agentDraft.collaborationBias ?? 0.5}
                      onChange={(event) => handleAgentDraftFieldChange("collaborationBias", Number(event.target.value))}
                      className="w-full accent-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-temperature" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Temperature</label>
                    <input
                      id="custom-agent-temperature"
                      data-testid="custom-agent-temperature"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={agentDraft.temperature ?? 0.7}
                      onChange={(event) => handleAgentDraftFieldChange("temperature", Number(event.target.value))}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-agent-max-tokens" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Max tokens</label>
                    <input
                      id="custom-agent-max-tokens"
                      data-testid="custom-agent-max-tokens"
                      type="number"
                      min={128}
                      max={4096}
                      step={128}
                      value={agentDraft.maxTokens ?? 1024}
                      onChange={(event) => handleAgentDraftFieldChange("maxTokens", Number(event.target.value))}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-slate-500">
              {editingCustomAgentId ? "Editing saved agent" : "New unsaved agent"}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                id="save-custom-agent-button"
                type="button"
                onClick={saveCustomAgentDraft}
                disabled={!agentDraft.name.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-black uppercase tracking-wide text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Save className="h-4 w-4" />
                Save Agent
              </button>
              {editingCustomAgentId && (
                <>
                  <button
                    id="load-custom-agent-a-button"
                    type="button"
                    onClick={() => {
                      const template = customAgents.find((item) => item.id === editingCustomAgentId);
                      if (template) loadCustomAgentIntoSide("agentA", template);
                    }}
                    className="rounded-md border border-[#00FF41]/35 bg-[#00FF41]/10 px-4 py-2 text-sm font-black uppercase text-[#00FF41] hover:bg-[#00FF41] hover:text-black"
                  >
                    Load Into A
                  </button>
                  <button
                    id="load-custom-agent-b-button"
                    type="button"
                    onClick={() => {
                      const template = customAgents.find((item) => item.id === editingCustomAgentId);
                      if (template) loadCustomAgentIntoSide("agentB", template);
                    }}
                    className="rounded-md border border-[#FF7A3D]/35 bg-[#FF7A3D]/10 px-4 py-2 text-sm font-black uppercase text-[#FF7A3D] hover:bg-[#FF7A3D] hover:text-black"
                  >
                    Load Into B
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleFullscreen = () => {
    const root = document.getElementById("debate-pong-app-root");
    if (!root) return;
    if (!document.fullscreenElement) {
      root.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#05070A] text-slate-100 font-sans leading-relaxed select-none ${compactMode ? "text-[15px]" : "text-base"}`}
      id="debate-pong-app-root"
    >
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070A]/95 backdrop-blur-xl" id="command-header">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() => setActiveTab("arena")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#00FF41]/50 bg-[#00FF41]/10 text-[#00FF41] shadow-[0_0_24px_rgba(0,255,65,0.08)]"
              aria-label="Open arena"
            >
              <Swords className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white lg:text-3xl">Cognitive Pong</h1>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusTone}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="hidden truncate text-sm text-slate-400 2xl:block 2xl:max-w-[720px]">
                {topic || "Configure two agents, give them a goal, and start a cognitive rally."}
              </p>
            </div>
          </div>

          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <div className="hidden min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 2xl:block">
              <span className="font-semibold text-[#00FF41]">{agentConfig.agentA.name}</span>
              <span className="px-2 text-slate-500">vs</span>
              <span className="font-semibold text-[#FF7A3D]">{agentConfig.agentB.name}</span>
            </div>
            <button
              onClick={onResetMatch}
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm font-semibold text-slate-200 hover:border-white/40 hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden xl:inline">Reset</span>
            </button>
            <button
              onClick={onPublishMatch}
              disabled={!hasPublishableRun || isPublishing}
              className="hidden items-center gap-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-45 sm:inline-flex"
            >
              <Save className="h-4 w-4" />
              <span className="hidden xl:inline">{isPublishing ? "Saving" : isPublished ? "Saved" : "Save Session"}</span>
            </button>
            <button
              onClick={() => setDensity((value) => value === "comfortable" ? "compact" : "comfortable")}
              className="hidden rounded-md border border-white/15 bg-white/[0.03] p-2.5 text-slate-300 hover:border-[#00FF41]/50 hover:text-[#00FF41] sm:block"
              aria-label="Toggle density"
              title="Toggle density"
            >
              <Sliders className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className="hidden rounded-md border border-white/15 bg-white/[0.03] p-2.5 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 sm:block"
              aria-label="Open help"
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={handleFullscreen}
              className="hidden rounded-md border border-white/15 bg-white/[0.03] p-2.5 text-slate-300 hover:border-white/40 hover:text-white sm:block"
              aria-label="Toggle fullscreen"
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 py-5 lg:px-6">
        {isSimulationBannerVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-md border border-amber-400/50 bg-amber-500/10 p-4 text-amber-100"
            id="simulation-fallback-banner"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <strong className="block text-sm font-black uppercase tracking-wide text-amber-200">Simulation mode active</strong>
                  <span className="text-sm text-slate-300">
                    {fallbackReason || "The provider did not return a usable live turn. The arena is using a local mock debate generator until the next live response succeeds."}
                  </span>
                </div>
              </div>
              <button
                onClick={onDismissSimulationBanner}
                className="rounded-md border border-amber-300/60 px-3 py-2 text-sm font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-300 hover:text-black"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        <nav className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1 md:grid-cols-4" id="tab-nav-bar">
          {[
            { id: "arena" as const, label: "Arena", icon: Swords },
            { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
            { id: "matchmaking" as const, label: "Matchmaking", icon: Users },
            { id: "about" as const, label: "Guide", icon: BookOpen },
          ].map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => setActiveTab(tabItem.id)}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-wide transition ${
                  isActive ? "bg-[#00FF41] text-black" : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tabItem.label}
              </button>
            );
          })}
        </nav>

        <AnimatePresence mode="wait">
          {activeTab === "arena" ? (
            <motion.main
              key="arena-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-5"
              id="arena-dashboard-layout"
            >
              {errorMessage && (
                <div className="rounded-md border border-[#FF4100]/60 bg-[#FF4100]/10 p-4 text-[#FFD2C5]" id="error-fallback-box">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black uppercase tracking-wide text-[#FF7A3D]">Arena simulation interrupted</p>
                      <p className="mt-1 text-sm text-slate-200">{errorMessage}</p>
                    </div>
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        setStatus("debating");
                      }}
                      className="rounded-md bg-[#FF4100] px-4 py-2 text-sm font-black uppercase tracking-wide text-black hover:bg-white"
                    >
                      Dismiss and restart
                    </button>
                  </div>
                </div>
              )}

              <section className="rounded-lg border border-[#00FF41]/30 bg-[#00FF41]/5 p-3 sm:p-4" id="onboarding-strip">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#00FF41]">Two AI agents are playing Pong with ideas</p>
                    <p className="mt-1 hidden max-w-4xl text-slate-300 md:block">
                      Configure two agents, give them a debate goal, and start a cognitive rally. Each shot becomes a claim, critique, counterexample, or synthesis.
                    </p>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-slate-200 sm:text-sm lg:min-w-[620px]">
                    <span className="rounded-md border border-white/10 bg-black/40 px-2 py-2 sm:px-3">1. Setup</span>
                    <span className="rounded-md border border-white/10 bg-black/40 px-2 py-2 sm:px-3">2. Research</span>
                    <span className="rounded-md border border-white/10 bg-black/40 px-2 py-2 sm:px-3">3. Debate</span>
                    <span className="rounded-md border border-white/10 bg-black/40 px-2 py-2 sm:px-3">4. Judge</span>
                    <span className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-[#00FF41] sm:px-3">5. Replay</span>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-cyan-400/20 bg-[#0A0D12] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)]" id="agents-setup-section">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Agents</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Configure Agent A and Agent B once</h2>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-[360px]">
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <span className="rounded-md border border-[#00FF41]/25 bg-[#00FF41]/10 px-3 py-2 text-[#00FF41]">A: {agentConfig.agentA.provider || "mock"}</span>
                      <span className="rounded-md border border-[#FF7A3D]/25 bg-[#FF7A3D]/10 px-3 py-2 text-[#FF7A3D]">B: {agentConfig.agentB.provider || "mock"}</span>
                    </div>
                    <button
                      id="create-new-agent-button"
                      type="button"
                      onClick={() => openCreateAgentModal()}
                      disabled={!canConfigureMatch}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-cyan-200 hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Plus className="h-4 w-4" />
                      Create New Agent
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {(["agentA", "agentB"] as const).map((agentKey) => {
                    const agent = agentConfig[agentKey];
                    const isA = agentKey === "agentA";
                    const idPrefix = isA ? "runtime-agent-a" : "runtime-agent-b";
                    const accentText = isA ? "text-[#00FF41]" : "text-[#FF7A3D]";
                    const borderClass = isA ? "border-[#00FF41]/35" : "border-[#FF7A3D]/35";
                    const focusClass = isA ? "focus:border-[#00FF41]" : "focus:border-[#FF7A3D]";

                    return (
                      <section
                        key={agentKey}
                        className={`min-w-0 rounded-md border bg-[#05070A] p-4 ${borderClass}`}
                        id={`${idPrefix}-card`}
                        aria-label={`${isA ? "Agent A" : "Agent B"} runtime model controls`}
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <p className={`text-xs font-black uppercase tracking-[0.16em] ${accentText}`}>
                              {isA ? "Agent A / left paddle" : "Agent B / right paddle"}
                            </p>
                            <h3 className="truncate text-xl font-black text-white">{agent.name}</h3>
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">{agent.role}</p>
                          </div>
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-black/60 text-xl">
                            {agent.avatar}
                          </div>
                        </div>

                        <label htmlFor={`${idPrefix}-template`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                          Agent template
                        </label>
                        <select
                          id={`${idPrefix}-template`}
                          value=""
                          onChange={(event) => handleAgentPresetSelect(agentKey, event.target.value)}
                          disabled={!canConfigureMatch}
                          className={`mb-4 w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none ${focusClass} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <option value="">Keep current agent...</option>
                          {PRESET_SCENARIOS.flatMap((preset, scenarioIndex) => [
                            <option key={`${idPrefix}-${scenarioIndex}-agentA`} value={`${scenarioIndex}:agentA`}>{preset.title}: {preset.agentA.name}</option>,
                            <option key={`${idPrefix}-${scenarioIndex}-agentB`} value={`${scenarioIndex}:agentB`}>{preset.title}: {preset.agentB.name}</option>,
                          ])}
                          {customAgents.length > 0 && (
                            <optgroup label="My agents">
                              {customAgents.map((template) => (
                                <option key={`${idPrefix}-custom-${template.id}`} value={`custom:${template.id}`}>
                                  {template.agent.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>

                        <div className="mb-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => openCreateAgentModal(agent)}
                            disabled={!canConfigureMatch}
                            className={`rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-wide hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-45 ${accentText}`}
                          >
                            Save as New
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAgentLibraryOpen(true)}
                            disabled={!canConfigureMatch}
                            className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-cyan-200 hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Load Agent
                          </button>
                        </div>

                        {renderAgentRuntimeControls(agentKey, idPrefix, true)}
                      </section>
                    );
                  })}
                </div>
              </section>

              <section className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_300px] 2xl:grid-cols-[340px_minmax(0,1fr)_360px]" id="primary-arena-grid">
                <aside className="order-2 flex min-w-0 flex-col gap-5 xl:order-1" id="start-setup-column">
                  <div className="rounded-lg border border-white/10 bg-[#0A0D12] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]" id="loop-setup-panel">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-[#00FF41]">Start and setup</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Launch a cognitive rally</h2>
                      </div>
                      <Target className="h-6 w-6 text-[#00FF41]" />
                    </div>

                    <label className="block text-sm font-bold text-slate-200" htmlFor="debate-goal-input">Main Goal</label>
                    <textarea
                      id="debate-goal-input"
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      disabled={!canEditMainGoal}
                      rows={compactMode ? 3 : 5}
                      className="mt-2 max-h-80 min-h-[8rem] w-full resize-y overflow-y-auto rounded-md border border-white/15 bg-black/70 p-3 text-base leading-relaxed text-white outline-none transition placeholder:text-slate-600 focus:border-[#00FF41] disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="What should the agents debate, solve, critique, or design?"
                    />

                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="block text-sm font-bold text-slate-200">Loop Mode</label>
                        <select
                          value={loopMode}
                          onChange={(event) => setLoopMode(event.target.value as LoopMode)}
                          disabled={!canConfigureMatch}
                          className="mt-2 w-full rounded-md border border-white/15 bg-black/70 px-3 py-2.5 text-base text-white outline-none focus:border-[#00FF41] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {(["Debate", "Critique", "Research", "Strategy", "Red Team", "Creative"] as const).map((mode) => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-200">Victory Condition</label>
                        <input
                          value={victoryCondition}
                          onChange={(event) => setVictoryCondition(event.target.value)}
                          disabled={!canEditMainGoal}
                          className="mt-2 w-full rounded-md border border-white/15 bg-black/70 px-3 py-2.5 text-base text-white outline-none focus:border-[#00FF41] disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-bold text-slate-200">Max Volleys</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={maxVolleys}
                          onChange={(event) => setMaxVolleys(Math.max(1, Number(event.target.value) || 1))}
                          className="mt-2 w-full rounded-md border border-white/15 bg-black/70 px-3 py-2.5 text-base text-white outline-none focus:border-[#00FF41]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-200">Autonomy Speed</label>
                        <div className="mt-3 grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2">
                          <button
                            type="button"
                            aria-label="Decrease autonomy speed"
                            title="Decrease speed"
                            disabled={gameSpeed <= 1}
                            onClick={() => handleGameSpeedChange(gameSpeed - 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] text-slate-200 hover:border-[#00FF41]/50 hover:text-[#00FF41] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={gameSpeed}
                            onInput={(event) => handleGameSpeedChange(parseInt(event.currentTarget.value, 10))}
                            onChange={(event) => handleGameSpeedChange(parseInt(event.currentTarget.value, 10))}
                            aria-label="Autonomy speed"
                            className="w-full accent-[#00FF41]"
                          />
                          <button
                            type="button"
                            aria-label="Increase autonomy speed"
                            title="Increase speed"
                            disabled={gameSpeed >= 5}
                            onClick={() => handleGameSpeedChange(gameSpeed + 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] text-slate-200 hover:border-[#00FF41]/50 hover:text-[#00FF41] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-1 text-sm font-bold text-[#00FF41]">{gameSpeed}x rally speed</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2">
                      <button
                        onClick={onStartMatch}
                        disabled={!topic.trim() || !canStartLoop || isDemoRunning || isStartingArenaBattle}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#00FF41] px-5 py-3 text-base font-black uppercase tracking-wide text-black shadow-[0_0_28px_rgba(0,255,65,0.18)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Play className="h-5 w-5" />
                        {isStartingArenaBattle ? "Starting Arena Loop" : status === "paused" ? "Resume Arena Loop" : "Start Arena Loop"}
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => applyPresetScenario(0)}
                          disabled={!canConfigureMatch}
                          className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 hover:border-[#00FF41]/50 hover:text-[#00FF41] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Use Example
                        </button>
                        <button
                          onClick={onTriggerDemoMatch}
                          disabled={isDemoRunning}
                          className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {isDemoRunning ? "Example Running" : "Run Example Rally"}
                        </button>
                      </div>
                    </div>
                    {demoStepMsg && (
                      <p className="mt-3 rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-300">{demoStepMsg}</p>
                    )}
                  </div>
                </aside>

                <section className="order-1 flex min-w-0 max-w-full flex-col gap-5 xl:order-2" id="center-live-match-column">
                  <div
                    className="relative isolate min-w-0 max-w-full scroll-mt-32 overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
                    id="pong-game-wrapper"
                    style={{ contain: "layout paint", overflowAnchor: "none" }}
                  >
                    <div className="flex flex-col gap-3 border-b border-white/10 bg-[#0A0D12] p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#00FF41]">Live Match</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-white lg:text-3xl">Pong debate arena</h2>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-md border border-white/10 bg-black/50 px-3 py-2">
                          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Volley</span>
                          <strong className="text-lg text-white">{history.length}/{maxVolleys}</strong>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/50 px-3 py-2">
                          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Shot Type</span>
                          <strong className="text-lg text-[#00FF41]">{shotLabel}</strong>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/50 px-3 py-2">
                          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Next Paddle</span>
                          <strong className="block truncate text-lg text-cyan-200">{activeAgentLabel}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 border-b border-white/10 bg-[#05070A] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,360px)]" id="live-main-goal-panel">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-black uppercase tracking-[0.16em] text-[#00FF41]" htmlFor="live-main-goal-input">
                            Main Goal
                          </label>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span
                              aria-live="polite"
                              className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                                liveGoalSyncLabel === "Synced"
                                  ? "border-[#00FF41]/40 text-[#00FF41]"
                                  : liveGoalSyncLabel === "Syncing"
                                    ? "border-cyan-300/40 text-cyan-200"
                                    : liveGoalSyncLabel === "Unsynced"
                                      ? "border-amber-300/40 text-amber-200"
                                      : "border-white/15 text-slate-400"
                              }`}
                            >
                              {liveGoalSyncLabel}
                            </span>
                            <button
                              id="apply-live-main-goal-button"
                              type="button"
                              onClick={onSyncMainGoal}
                              disabled={!canApplyLiveGoal}
                              title="Retarget the active Arena Loop battle to the edited main goal"
                              className="flex items-center justify-center gap-1.5 rounded-md border border-[#00FF41]/35 bg-[#00FF41]/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#00FF41] hover:bg-[#00FF41] hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {isSyncingArenaGoal ? "Syncing" : "Retarget Goal"}
                            </button>
                          </div>
                        </div>
                        <textarea
                          id="live-main-goal-input"
                          value={topic}
                          onChange={(event) => setTopic(event.target.value)}
                          disabled={!canEditMainGoal}
                          rows={compactMode ? 3 : 4}
                          className="max-h-64 min-h-[7rem] w-full resize-y overflow-y-auto rounded-md border border-white/15 bg-black/70 p-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-slate-600 focus:border-[#00FF41] disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Set the full objective for this match."
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500" htmlFor="live-victory-condition-input">
                          Victory Condition
                        </label>
                        <textarea
                          id="live-victory-condition-input"
                          value={victoryCondition}
                          onChange={(event) => setVictoryCondition(event.target.value)}
                          disabled={!canEditMainGoal}
                          rows={compactMode ? 3 : 4}
                          className="max-h-64 min-h-[7rem] w-full resize-y overflow-y-auto rounded-md border border-white/15 bg-black/70 p-3 text-sm leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Define what counts as a good finish."
                        />
                      </div>
                    </div>
                    <PongGame
                      history={history}
                      agentConfig={agentConfig}
                      status={status}
                      onPaddleCollision={onPaddleCollision}
                      onGoalCompleted={onGoalCompleted}
                      scoreA={scoreA}
                      scoreB={scoreB}
                      latestScoreType={latestScoreType}
                      latestScoreText={latestScoreText}
                      gameSpeed={gameSpeed}
                      currentComplexity={currentComplexity}
                      deployedModel={deployedModel}
                    />
                    <div id="court-routing-summary" className="grid gap-2 border-t border-white/10 bg-[#05070A] p-3 text-xs font-semibold text-slate-300 md:grid-cols-2">
                      {(["agentA", "agentB"] as const).map((agentKey) => {
                        const agent = agentConfig[agentKey];
                        const provider = agent.provider || "mock";
                        const effectiveModel = agent.customModel || resolveAgentModelSelection(agent, agentConfig.model);
                        const isA = agentKey === "agentA";
                        return (
                          <div key={agentKey} className={`min-w-0 rounded-md border bg-black/35 p-3 ${isA ? "border-[#00FF41]/25" : "border-[#FF7A3D]/25"}`}>
                            <span className={`block text-[10px] font-black uppercase tracking-wide ${isA ? "text-[#00FF41]" : "text-[#FF7A3D]"}`}>
                              {isA ? "Agent A" : "Agent B"} route
                            </span>
                            <span className="block truncate text-white">{agent.name}</span>
                            <span className="block truncate font-mono text-slate-400">{provider} / {effectiveModel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" id="volley-summary-grid">
                    <div className="rounded-lg border border-white/10 bg-[#0A0D12] p-5">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-[#00FF41]" />
                        <h3 className="text-xl font-black text-white">Current volley summary</h3>
                      </div>
                      {latestTurn ? (() => {
                        const senderDisplay = getTurnSenderDisplay(latestTurn.sender, agentConfig);
                        return (
                          <div className="mt-4">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ${senderDisplay.headerClass}`}>
                                {senderDisplay.name}
                              </span>
                              <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-300">{shotLabel}</span>
                              <span className="text-sm text-slate-500">{latestTurn.timestamp}</span>
                            </div>
                            <p className="max-h-28 overflow-hidden text-base leading-relaxed text-slate-200">{latestTurn.proposal || latestTurn.content}</p>
                          </div>
                        );
                      })() : (
                        <p className="mt-4 text-slate-400">No volleys yet. Start the loop and watch each paddle hit become a reasoning move.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0A0D12] p-5">
                      <div className="flex items-center gap-2">
                        <Timer className="h-5 w-5 text-cyan-300" />
                        <h3 className="text-xl font-black text-white">Round progress</h3>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#00FF41] transition-all"
                          style={{ width: `${Math.min(100, Math.round((history.length / Math.max(maxVolleys, 1)) * 100))}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-slate-400">
                        {history.length} volleys logged. {finalizedTasks.length} synthesis milestones locked.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0A0D12] p-1" id="debate-logs-wrapper">
                    <DebateLogs
                      history={history}
                      agentConfig={agentConfig}
                      onOpenReplay={openVisualReplay}
                    />
                  </div>
                </section>

                <aside className="order-3 flex min-w-0 flex-col gap-5" id="controls-metrics-column">
                  <div className="rounded-lg border border-white/10 bg-[#0A0D12] p-5" id="match-controls-panel">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Match Controls</p>
                        <h2 className="text-2xl font-black text-white">Runtime</h2>
                      </div>
                      <Gauge className="h-6 w-6 text-cyan-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={onPauseMatch}
                        disabled={status !== "debating" && !status.startsWith("researching") && !status.startsWith("scoring")}
                        className="flex items-center justify-center gap-2 rounded-md border border-amber-400/60 bg-amber-400/10 px-3 py-3 text-sm font-black uppercase tracking-wide text-amber-200 hover:bg-amber-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Pause className="h-4 w-4" />
                        Pause
                      </button>
                      <button
                        onClick={onStepTurn}
                        disabled={isDemoRunning || status === "completed"}
                        className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <SkipForward className="h-4 w-4" />
                        Step Volley
                      </button>
                      <button
                        onClick={onResetMatch}
                        className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-bold text-slate-200 hover:border-white/40 hover:bg-white/10"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </button>
                      <button
                        onClick={openVisualReplay}
                        disabled={!canOpenVisualReplay || isLoadingPersistedReplay}
                        className="flex items-center justify-center gap-2 rounded-md border border-amber-400/35 bg-amber-400/10 px-3 py-3 text-sm font-bold text-amber-200 hover:bg-amber-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Radio className="h-4 w-4" />
                        {isLoadingPersistedReplay ? "Loading" : "Replay"}
                      </button>
                    </div>
                    <div className="mt-4 rounded-md border border-white/10 bg-black/40 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-300">Current state</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${statusTone}`}>{statusLabel}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
                        <span>Session</span>
                        <span className="font-mono text-slate-200">{sessionId}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-slate-400">
                        <span>Mode</span>
                        <span className="font-semibold text-slate-200">{loopMode}</span>
                      </div>
                    </div>
                    <div className="mt-4 rounded-md border border-cyan-400/20 bg-black/40 p-3" id="arena-loop-ledger-status">
                      <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Arena Loop ledger</span>
                      {activeArenaBattle?.id ? (
                        <>
                          <span className="mt-1 block truncate font-mono text-sm text-cyan-200" title={activeArenaBattle.slug || activeArenaBattle.id}>
                            {activeArenaBattle.slug || activeArenaBattle.id}
                          </span>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-300">
                            <span className="rounded-sm border border-white/10 bg-white/[0.03] px-2 py-1">{activeArenaBattle.turns?.length || 0} turns</span>
                            <span className="rounded-sm border border-white/10 bg-white/[0.03] px-2 py-1">{activeArenaBattle.arguments?.length || 0} args</span>
                            <span className="rounded-sm border border-white/10 bg-white/[0.03] px-2 py-1">{activeArenaBattle.events?.length || 0} events</span>
                          </div>
                        </>
                      ) : (
                        <span className="mt-1 block text-sm text-slate-400">Starts when the Arena Loop begins.</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-cyan-400/25 bg-[#0A0D12] p-5" id="live-model-routing-panel">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Model Routing</p>
                        <h2 className="text-2xl font-black text-white">Active engines</h2>
                      </div>
                      <Cpu className="h-6 w-6 text-cyan-300" />
                    </div>
                    <div className="grid gap-3">
                      {renderAgentRouteSummary("agentA")}
                      {renderAgentRouteSummary("agentB")}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-[#0A0D12] p-5" id="metrics-panel">
                    <div className="mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-[#00FF41]" />
                      <h2 className="text-2xl font-black text-white">Scoring Metrics</h2>
                    </div>
                    <div className="grid gap-3">
                      {[
                        { label: "Coherence", value: latestJudge?.intellectScore ?? 0, tone: "bg-cyan-300" },
                        { label: "Evidence", value: latestJudge?.precisionScore ?? 0, tone: "bg-[#00FF41]" },
                        { label: "Persuasion", value: latestJudge?.rhetoricScore ?? 0, tone: "bg-[#FF7A3D]" },
                      ].map((metric) => (
                        <div key={metric.label}>
                          <div className="flex justify-between text-sm">
                            <span className="font-bold text-slate-300">{metric.label}</span>
                            <span className="font-mono text-slate-200">{metric.value}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className={`h-full ${metric.tone}`} style={{ width: `${metric.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-md border border-white/10 bg-black/40 p-3">
                      <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Judge Average</span>
                      <strong className="text-3xl font-black text-white">{averageJudgeScore ?? "--"}</strong>
                      <span className="ml-2 text-sm text-slate-500">/ 100</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-[#0A0D12] p-5" id="export-share-panel">
                    <div className="mb-4 flex items-center gap-2">
                      <Download className="h-5 w-5 text-cyan-300" />
                      <h2 className="text-2xl font-black text-white">Export and Share</h2>
                    </div>
                    <label className="mb-3 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/40 p-3 text-sm font-semibold text-slate-200">
                      Publish public match
                      <input
                        type="checkbox"
                        checked={isPublicMatch}
                        onChange={(event) => setIsPublicMatch(event.target.checked)}
                        className="h-5 w-5 accent-[#00FF41]"
                      />
                    </label>
                    <div className="grid gap-2">
                      <button
                        onClick={onPublishMatch}
                        disabled={!hasPublishableRun || isPublishing}
                        className="flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 py-3 text-sm font-black uppercase tracking-wide text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Save className="h-4 w-4" />
                        {isPublishing ? "Saving..." : isPublished ? "Session Saved" : "Save Session"}
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          id="export-transcript-button"
                          aria-label="Download transcript export"
                          onClick={exportTranscript}
                          className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
                        >
                          <Download className="h-4 w-4" />
                          Transcript
                        </button>
                        <button
                          id="export-markdown-button"
                          aria-label="Download Markdown session report"
                          onClick={exportMarkdown}
                          className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
                        >
                          <Download className="h-4 w-4" />
                          Markdown
                        </button>
                        <button
                          id="export-json-button"
                          aria-label="Download JSON session snapshot"
                          onClick={exportJson}
                          className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
                        >
                          <Download className="h-4 w-4" />
                          JSON
                        </button>
                        <button
                          id="export-config-button"
                          aria-label="Download redacted configuration"
                          onClick={exportConfig}
                          className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
                        >
                          <Settings className="h-4 w-4" />
                          Config
                        </button>
                        <button
                          id="export-jsonl-bundle-button"
                          aria-label="Download Arena Loop JSONL bundle"
                          onClick={exportPersistedArenaJsonlBundle}
                          disabled={!canExportPersistedArena}
                          className="flex items-center justify-center gap-2 rounded-md border border-[#00FF41]/35 bg-[#00FF41]/10 px-3 py-2.5 text-sm font-bold text-[#00FF41] hover:bg-[#00FF41] hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Download className="h-4 w-4" />
                          JSONL
                        </button>
                        <button
                          id="export-research-zip-button"
                          aria-label="Download Arena Loop research bundle ZIP"
                          onClick={exportPersistedArenaResearchZip}
                          disabled={!canExportPersistedArena}
                          className="flex items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-300/10 px-3 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Download className="h-4 w-4" />
                          ZIP Bundle
                        </button>
                      </div>
                      <button
                        onClick={openVisualReplay}
                        disabled={!canOpenVisualReplay || isLoadingPersistedReplay}
                        className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <ClipboardList className="h-4 w-4" />
                        {isLoadingPersistedReplay ? "Loading Replay" : "Open Visual Replay"}
                      </button>
                      <button
                        id="copy-arena-replay-link-button"
                        aria-label="Copy shareable Arena replay link"
                        onClick={copyArenaReplayLink}
                        disabled={!arenaReplayShareUrl}
                        className="flex items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-3 text-sm font-bold text-cyan-200 hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isReplayLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {isReplayLinkCopied ? "Copied" : "Copy Replay Link"}
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      Local provider setup and moderator tools remain in Advanced Match Configuration below.
                    </p>
                  </div>

                  <details className="rounded-lg border border-white/10 bg-[#0A0D12] p-5" id="advanced-diagnostics-summary">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-lg font-black text-white">
                      Advanced diagnostics
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    </summary>
                    <p className="mt-3 text-sm text-slate-400">
                      Raw event traces, dependency graphs, memory state, neural trainer, and full system tuning remain available below the fold.
                    </p>
                    {activeArenaBattle ? (
                      <pre
                        id="arena-raw-json-debug"
                        className="mt-4 max-h-80 overflow-auto rounded-md border border-white/10 bg-black/60 p-3 text-[11px] leading-relaxed text-slate-300"
                      >
                        {JSON.stringify(activeArenaBattle, null, 2)}
                      </pre>
                    ) : (
                      <div
                        id="arena-raw-json-debug-empty"
                        className="mt-4 rounded-md border border-white/10 bg-black/40 p-3 text-sm text-slate-500"
                      >
                        No Arena Loop battle captured yet.
                      </div>
                    )}
                  </details>
                </aside>
              </section>

              <section className="grid gap-5 xl:grid-cols-2" id="support-panels-grid">
                <ActiveResearchState topic={topic} history={history} agentConfig={agentConfig} />
                <SpectatorJudgePanel
                  history={history}
                  agentConfig={agentConfig}
                  activeTrajectory={activeTrajectory}
                  onClearTrajectory={() => setActiveTrajectory(null)}
                />
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]" id="analysis-output-grid">
                <TimelineDependencyGraph
                  history={history}
                  finalizedTasks={finalizedTasks}
                  agentConfig={agentConfig}
                />
                <div className="rounded-xl border border-white/10 bg-[#0A0D12] p-1" id="consensus-board-wrapper">
                  <ConsensusBoard
                    tasks={finalizedTasks}
                    topic={topic}
                    history={history}
                    agentConfig={agentConfig}
                  />
                </div>
              </section>

              <details className="rounded-xl border border-white/10 bg-[#0A0D12] p-5" id="advanced-config-section">
                <summary className="flex cursor-pointer list-none flex-col gap-1 text-white md:flex-row md:items-center md:justify-between">
                  <span>
                    <span className="block text-sm font-black uppercase tracking-[0.18em] text-[#00FF41]">Advanced Settings</span>
                    <span className="text-2xl font-black">Adapters, bridge setup, arena internals, and moderator tools</span>
                  </span>
                  <Settings className="h-6 w-6 text-slate-400" />
                </summary>
                <div className="mt-5 rounded-lg border border-white/10 bg-black/50 p-1" id="config-panel-wrapper">
                  <ConfigPanel
                    topic={topic}
                    onTopicChange={setTopic}
                    agentConfig={agentConfig}
                    onAgentConfigChange={setAgentConfig}
                    status={status}
                    onStartMatch={onStartMatch}
                    onPauseMatch={onPauseMatch}
                    onResetMatch={onResetMatch}
                    onStepTurn={onStepTurn}
                    onModeratorIntervene={onModeratorIntervene}
                    gameSpeed={gameSpeed}
                    onSpeedChange={setGameSpeed}
                    isPublicMatch={isPublicMatch}
                    onIsPublicMatchChange={(val) => setIsPublicMatch(val)}
                    onPublishMatch={onPublishMatch}
                    isPublishing={isPublishing}
                    isPublished={isPublished}
                    canPublishMatch={hasPublishableRun}
                    onOpenReplay={openVisualReplay}
                    canEditAgentRuntime={canEditAgentRuntime}
                    mode="advancedOnly"
                  />
                </div>
              </details>

              <NetworkTrainer history={history} activeTopic={topic} onDeployModel={onDeployModel} />
            </motion.main>
          ) : activeTab === "leaderboard" ? (
            <motion.div
              key="leaderboard-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6"
              id="leaderboard-view-container"
            >
              <LeaderboardAndMatches key={leaderboardRefreshSig} />
            </motion.div>
          ) : activeTab === "matchmaking" ? (
            <motion.div
              key="matchmaking-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6"
              id="matchmaking-view-container"
            >
              <MatchmakingCompetition onStartDuel={onStartDuel} />
            </motion.div>
          ) : (
            <motion.div
              key="about-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6"
              id="about-view-container"
            >
              <AboutScienceManual />
            </motion.div>
          )}
        </AnimatePresence>

        <ReplayMatchPanel
          history={visualReplayHistory}
          agentConfig={agentConfig}
          isOpen={isReplayOpen}
          onClose={closeVisualReplay}
        />

        {renderCustomAgentLibraryModal()}

        <footer className="pb-6 pt-2 text-center text-sm text-slate-500">
          Cognitive Pong reasoning arena // session {sessionId}
        </footer>
      </div>
    </div>
  );
};
