import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const arenaSource = fs.readFileSync(
  new URL("../src/components/CognitivePongExperience.tsx", import.meta.url),
  "utf-8",
);
const configPanelSource = fs.readFileSync(
  new URL("../src/components/ConfigPanel.tsx", import.meta.url),
  "utf-8",
);
const debateLogsSource = fs.readFileSync(
  new URL("../src/components/DebateLogs.tsx", import.meta.url),
  "utf-8",
);
const replayPanelSource = fs.readFileSync(
  new URL("../src/components/ReplayMatchPanel.tsx", import.meta.url),
  "utf-8",
);
const aboutManualSource = fs.readFileSync(
  new URL("../src/components/AboutScienceManual.tsx", import.meta.url),
  "utf-8",
);
const matchmakingSource = fs.readFileSync(
  new URL("../src/components/MatchmakingCompetition.tsx", import.meta.url),
  "utf-8",
);
const leaderboardSource = fs.readFileSync(
  new URL("../src/components/LeaderboardAndMatches.tsx", import.meta.url),
  "utf-8",
);
const radarProfileSource = fs.readFileSync(
  new URL("../src/components/RadarProfileChart.tsx", import.meta.url),
  "utf-8",
);
const spectatorJudgePanelSource = fs.readFileSync(
  new URL("../src/components/SpectatorJudgePanel.tsx", import.meta.url),
  "utf-8",
);
const consensusBoardSource = fs.readFileSync(
  new URL("../src/components/ConsensusBoard.tsx", import.meta.url),
  "utf-8",
);
const timelineSource = fs.readFileSync(
  new URL("../src/components/TimelineDependencyGraph.tsx", import.meta.url),
  "utf-8",
);
const activeResearchStateSource = fs.readFileSync(
  new URL("../src/components/ActiveResearchState.tsx", import.meta.url),
  "utf-8",
);
const networkTrainerSource = fs.readFileSync(
  new URL("../src/components/NetworkTrainer.tsx", import.meta.url),
  "utf-8",
);
const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf-8",
);

test("arena primary UI exposes one start action label", () => {
  const startArenaMatches = arenaSource.match(/Start Arena Loop/g) || [];

  assert.equal(startArenaMatches.length, 1);
  assert.equal(arenaSource.includes("Start Cognitive Loop"), false);
  assert.equal(arenaSource.includes("Start Loop"), false);
  assert.equal(configPanelSource.includes("START COGNITIVE LOOP"), false);
});

test("arena setup does not render duplicate agent runtime editors", () => {
  assert.equal(arenaSource.includes("primary-agent-runtime-panel"), false);
  assert.equal(arenaSource.includes("quick-agent-a"), false);
  assert.equal(arenaSource.includes("quick-agent-b"), false);
  assert.equal(arenaSource.includes("runtime-engine-routing-panel"), false);
  assert.equal(arenaSource.includes("court-model-routing-controls"), false);
  assert.equal(arenaSource.includes("renderLiveRouteControls"), false);
  assert.match(arenaSource, /id="agents-setup-section"/);
  assert.match(arenaSource, /id="court-routing-summary"/);
});

test("arena agent cards expose independent Agent A and Agent B model controls", () => {
  assert.match(arenaSource, /renderAgentRuntimeControls\(agentKey, idPrefix, true\)/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-provider`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-model`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-custom-model`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-endpoint`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-token`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-custom-instructions`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-psychology-archetype`\}/);
});

test("arena agent cards expose independent Codex CLI and tool bridge controls", () => {
  assert.match(arenaSource, /CLI, Codex, and tool bridge override/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-bridge-kind`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-bridge-profile`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-bridge-endpoint`\}/);
  assert.match(arenaSource, /data-testid=\{`\$\{idPrefix\}-bridge-tool-or-token`\}/);
  assert.match(arenaSource, /handleAgentBridgeChange\(agentKey/);
  assert.match(arenaSource, /Server allowlist only/);
  assert.match(arenaSource, /browser-supplied shell commands are ignored/);
  assert.doesNotMatch(arenaSource, /data-testid=\{`\$\{idPrefix\}-bridge-command`\}/);
  assert.doesNotMatch(arenaSource, /data-testid=\{`\$\{idPrefix\}-bridge-args`\}/);
});

test("arena supports creating and loading custom saved agents", () => {
  assert.match(arenaSource, /CUSTOM_AGENT_LIBRARY_STORAGE_KEY/);
  assert.match(arenaSource, /id="create-new-agent-button"/);
  assert.match(arenaSource, /Create New Agent/);
  assert.match(arenaSource, /id="custom-agent-library-modal"/);
  assert.match(arenaSource, /data-testid="custom-agent-name"/);
  assert.match(arenaSource, /data-testid="custom-agent-provider"/);
  assert.match(arenaSource, /data-testid="custom-agent-bridge-kind"/);
  assert.match(arenaSource, /data-testid="custom-agent-bridge-label"/);
  assert.match(arenaSource, /data-testid="custom-agent-bridge-profile"/);
  assert.match(arenaSource, /data-testid="custom-agent-tendencies"/);
  assert.match(arenaSource, /data-testid="custom-agent-safety"/);
  assert.match(arenaSource, /value=\{`custom:\$\{template\.id\}`\}/);
  assert.match(arenaSource, /loadCustomAgentIntoSide\("agentA", template\)/);
  assert.match(arenaSource, /loadCustomAgentIntoSide\("agentB", template\)/);
  assert.match(arenaSource, /id="save-custom-agent-button"/);
});

test("arena keeps deep agent profile controls collapsed so Pong is not pushed far below the fold", () => {
  assert.match(arenaSource, /id=\{`\$\{idPrefix\}-profile-details`\}/);
  assert.match(arenaSource, /Profile, instructions, and strategy/);
  assert.equal(arenaSource.includes("<details open"), false);
});

test("arena start scroll only recenters the Pong board when it is mostly out of view", () => {
  assert.match(arenaSource, /visibleRatio >= 0\.55/);
  assert.match(arenaSource, /block: "center"/);
  assert.equal(arenaSource.includes('block: "start"'), false);
});

test("arena live model routing is a summary instead of a duplicate editor", () => {
  assert.match(arenaSource, /id="live-model-routing-panel"/);
  assert.match(arenaSource, /renderAgentRouteSummary\("agentA"\)/);
  assert.match(arenaSource, /renderAgentRouteSummary\("agentB"\)/);
  assert.equal(arenaSource.includes("live-route-agent-a-provider"), false);
  assert.equal(arenaSource.includes("live-route-agent-b-provider"), false);
});

test("advanced config mode hides duplicate match operation controls", () => {
  assert.match(configPanelSource, /mode !== "advancedOnly" && \(/);
  assert.match(configPanelSource, /id="match-operations"/);
  assert.match(arenaSource, /mode="advancedOnly"/);
});

test("visual replay opens from the persisted Arena Loop replay when available", () => {
  assert.match(arenaSource, /openVisualReplay/);
  assert.match(arenaSource, /\/api\/arena-loop\/battle\/\$\{encodeURIComponent\(activeArenaBattle\.id\)\}\/replay/);
  assert.match(arenaSource, /setPersistedReplayHistory\(data\.replay as DebateTurn\[\]\)/);
  assert.match(arenaSource, /history=\{visualReplayHistory\}/);
  assert.equal(arenaSource.includes("onOpenReplay={() => setIsReplayOpen(true)}"), false);
});

test("visual replay empty state is reachable before any turns exist", () => {
  assert.match(arenaSource, /const canOpenVisualReplay = !isDemoRunning/);
  assert.match(arenaSource, /setPersistedReplayHistory\(null\);\s*setIsReplayOpen\(true\);/);
  assert.match(debateLogsSource, /id="logs-replay-mode-toggle"[\s\S]*disabled=\{history\.length === 0\}/);
  assert.match(debateLogsSource, /id="logs-visual-replay-button"/);
  assert.doesNotMatch(
    debateLogsSource,
    /id="logs-visual-replay-button"[\s\S]{0,280}disabled=\{history\.length === 0\}/,
  );
  assert.match(replayPanelSource, /id="empty-replay-state"/);
  assert.match(replayPanelSource, /NO EXPERIMENTAL TRANSCRIPTS STORED/);
});

test("arena exposes a shareable visual replay link for persisted battles", () => {
  assert.match(arenaSource, /arenaReplayShareUrl/);
  assert.match(arenaSource, /url\.searchParams\.set\("arenaReplay", activeArenaBattle\.slug \|\| activeArenaBattle\.id\)/);
  assert.match(arenaSource, /new URLSearchParams\(window\.location\.search\)\.get\("arenaReplay"\)/);
  assert.match(arenaSource, /\/api\/arena-loop\/battle\/\$\{encodeURIComponent\(replayId\)\}\/replay/);
  assert.match(arenaSource, /copyTextToClipboard\(arenaReplayShareUrl\)/);
  assert.match(arenaSource, /id="copy-arena-replay-link-button"/);
  assert.match(arenaSource, /Copy Replay Link/);
});

test("arena exports include a persisted research bundle ZIP control", () => {
  assert.match(arenaSource, /exportPersistedArenaResearchZip/);
  assert.match(arenaSource, /\/api\/arena-loop\/battle\/\$\{encodeURIComponent\(activeArenaBattle\.id\)\}\/export\/research-bundle\.zip/);
  assert.match(arenaSource, /const canExportPersistedArena = Boolean\(activeArenaBattle\?\.id\)/);
  assert.match(arenaSource, /id="export-research-zip-button"/);
  assert.match(arenaSource, /disabled=\{!canExportPersistedArena\}/);
  assert.match(arenaSource, /Start an Arena Loop battle before exporting the persisted research ZIP/);
  assert.match(arenaSource, /ZIP Bundle/);
});

test("app start path creates one persisted Arena Loop battle and appends live turns", () => {
  assert.match(appSource, /arenaStartLockRef/);
  assert.match(appSource, /if \(arenaStartLockRef\.current\) return/);
  assert.match(appSource, /setIsStartingArenaBattle\(true\)/);
  assert.match(appSource, /\/api\/arena-loop\/battle/);
  assert.match(appSource, /\/turn\/debate/);
  assert.match(appSource, /providerMetadata/);
  assert.match(appSource, /latencyMs: providerMetadata\?\.latency_ms/);
  assert.match(appSource, /setActiveArenaBattle\(data\.battle\)/);
  assert.match(appSource, /search_provider: arenaLoop\.searchProvider/);
  assert.match(appSource, /search_timeout_ms: arenaLoop\.searchTimeoutMs/);
});

test("app allows the active main goal to update the persisted Arena Loop battle", () => {
  assert.match(arenaSource, /const canEditMainGoal = !isDemoRunning && !isStartingArenaBattle/);
  assert.match(arenaSource, /const isLiveGoalDirty = Boolean/);
  assert.match(arenaSource, /const canApplyLiveGoal = Boolean\(activeArenaBattle\?\.id\).*isLiveGoalDirty.*!isSyncingArenaGoal/);
  assert.match(arenaSource, /disabled=\{!canEditMainGoal\}/);
  assert.match(arenaSource, /disabled=\{!canApplyLiveGoal\}/);
  assert.match(arenaSource, /liveGoalSyncLabel/);
  assert.match(arenaSource, /"Unsynced"/);
  assert.match(arenaSource, /id="live-main-goal-panel"/);
  assert.match(arenaSource, /id="live-main-goal-input"/);
  assert.match(arenaSource, /id="live-victory-condition-input"/);
  assert.match(arenaSource, /id="apply-live-main-goal-button"/);
  assert.match(arenaSource, /onClick=\{onSyncMainGoal\}/);
  assert.match(arenaSource, /Retarget Goal/);
  assert.match(arenaSource, /id="live-main-goal-input"[\s\S]*resize-y/);
  assert.match(appSource, /goalSyncTimerRef/);
  assert.match(appSource, /const \[isSyncingArenaGoal, setIsSyncingArenaGoal\]/);
  assert.match(appSource, /const handleVictoryConditionChange = \(nextVictoryCondition: string\)/);
  assert.match(appSource, /setVictoryCondition\(nextVictoryCondition\)/);
  assert.match(appSource, /syncActiveArenaBattleGoal/);
  assert.match(appSource, /handleSyncMainGoalNow/);
  assert.match(appSource, /window\.clearTimeout\(goalSyncTimerRef\.current\)/);
  assert.match(appSource, /method: "PATCH"/);
  assert.match(appSource, /\/api\/arena-loop\/battle\/\$\{encodeURIComponent\(battle\.id\)\}/);
  assert.match(appSource, /master_goal: nextGoal/);
  assert.match(appSource, /rubric: nextRubric/);
  assert.match(appSource, /await syncActiveArenaBattleGoal\(topic, victoryCondition\)/);
  assert.match(appSource, /const turnTopic = topic\.trim\(\)/);
  assert.match(appSource, /topic: turnTopic/);
  assert.match(appSource, /const startTopic = topic\.trim\(\)/);
  assert.match(appSource, /master_goal: startTopic/);
  assert.match(appSource, /isSyncingArenaGoal=\{isSyncingArenaGoal\}/);
  assert.match(appSource, /onSyncMainGoal=\{handleSyncMainGoalNow\}/);
  assert.match(appSource, /setVictoryCondition=\{handleVictoryConditionChange\}/);
});

test("app live Pong loop stops when max volleys are reached", () => {
  assert.match(appSource, /pendingCompletionAfterGoalRef/);
  assert.match(appSource, /history\.length >= maxVolleys/);
  assert.match(appSource, /const isFinalVolley = nextTurnCount >= maxVolleys/);
  assert.match(appSource, /complete: nextTurnCount >= maxVolleys/);
  assert.match(appSource, /markArenaLoopCompleted\(nextTurnCount\)/);
  assert.match(appSource, /setStatus\("completed"\)/);
  assert.match(appSource, /Arena Loop completed at/);
});

test("advanced settings expose bounded Arena Loop research controls", () => {
  assert.match(configPanelSource, /id="arena-loop-runtime-settings"/);
  assert.match(configPanelSource, /id="arena-max-loop-passes-input"/);
  assert.match(configPanelSource, /id="arena-max-candidates-input"/);
  assert.match(configPanelSource, /id="arena-max-queries-input"/);
  assert.match(configPanelSource, /id="arena-max-sources-input"/);
  assert.match(configPanelSource, /id="arena-search-provider-select"/);
  assert.match(configPanelSource, /id="arena-search-endpoint-input"/);
  assert.match(configPanelSource, /id="arena-judging-mode-select"/);
  assert.match(configPanelSource, /ARENA_SEARCH_PROVIDER_OPTIONS/);
  assert.match(configPanelSource, /MODEL \/ SEARCH TIMEOUT MS/);
});

test("advanced diagnostics expose raw Arena Loop JSON state", () => {
  assert.match(arenaSource, /id="advanced-diagnostics-summary"/);
  assert.match(arenaSource, /id="arena-raw-json-debug"/);
  assert.match(arenaSource, /JSON\.stringify\(activeArenaBattle, null, 2\)/);
  assert.match(arenaSource, /id="arena-raw-json-debug-empty"/);
});

test("manual headings use text and shared Lucide icons instead of decorative emoji", () => {
  const decorativeEmojiPattern = new RegExp(
    [
      "\\u{1F4D6}",
      "\\u{1F9E0}",
      "\\u{1F52C}",
      "\\u{2699}\\u{FE0F}",
      "\\u{1F4DA}",
      "\\u{26A1}",
      "\\u{1F525}",
      "\\u{1F4A1}",
      "\\u{1F4CB}",
      "\\u{2694}\\u{FE0F}",
      "\\u{1F3D3}",
    ].join("|"),
    "u",
  );
  assert.doesNotMatch(aboutManualSource, decorativeEmojiPattern);
  assert.match(aboutManualSource, /Quote, Heart/);
  assert.match(aboutManualSource, /icon=\{Heart\}/);
  assert.equal(aboutManualSource.includes("HeartIcon"), false);
  assert.match(aboutManualSource, /<span>\{sec\.label\}<\/span>/);
});

test("matchmaking and leaderboard text stays clean and stateful", () => {
  assert.match(matchmakingSource, /MODEL MATCHMAKING & TOURNAMENT/);
  assert.doesNotMatch(matchmakingSource, /\u{2694}\u{FE0F}/u);
  assert.doesNotMatch(matchmakingSource, /\u{2022}/u);
  assert.match(matchmakingSource, /disabled=\{isLoading\}/);
  assert.match(matchmakingSource, /\{isLoading \? "Syncing Opponents" : "Sync Community Opponents"\}/);
  assert.match(matchmakingSource, /\{error && \(/);
  assert.match(matchmakingSource, /avatar: "A"/);
  assert.match(matchmakingSource, /avatar: "B"/);

  assert.match(leaderboardSource, /CODIFIED BLUEPRINT LAUNCH SPECIFICATION:/);
  assert.doesNotMatch(leaderboardSource, /\u{2713} CODIFIED/u);
  assert.doesNotMatch(leaderboardSource, /const winner =/);
});

test("matchmaking panel uses readable roster and challenger labels", () => {
  const subTenPixelText = /text-\[(?:[0-9](?:\.\d+)?px)\]/;

  assert.doesNotMatch(matchmakingSource, subTenPixelText);
  assert.match(matchmakingSource, /Showing \{filteredOpponents\.length\} Competitors/);
  assert.match(matchmakingSource, /Guest/);
  assert.match(matchmakingSource, /Legendary/);
  assert.match(matchmakingSource, /Provider \/ Endpoint Type/);
  assert.match(matchmakingSource, /Strategy Bias Vector/);
  assert.match(matchmakingSource, /flex flex-wrap justify-between gap-2 text-\[10px\]/);
  assert.match(matchmakingSource, /Define Duel Arena Objective/);
  assert.match(matchmakingSource, /Roll Random/);
});

test("advanced config panel uses readable labels and responsive control groups", () => {
  const subTenPixelText = /text-\[(?:[0-9](?:\.\d+)?px)\]/;
  const decorativeConfigGlyphs = /[\u{1F469}\u{1F680}\u{1F916}\u{1F9E0}\u{1F3AD}\u{25BC}]/u;

  assert.doesNotMatch(configPanelSource, subTenPixelText);
  assert.doesNotMatch(configPanelSource, decorativeConfigGlyphs);
  assert.match(configPanelSource, /ChevronDown, Sliders/);
  assert.match(configPanelSource, /grid grid-cols-1 gap-4 lg:grid-cols-2/);
  assert.match(configPanelSource, /grid grid-cols-1 gap-1 pl-0\.5 sm:grid-cols-3/);
  assert.match(configPanelSource, /flex h-5 w-5 items-center justify-center rounded-sm/);
  assert.match(configPanelSource, /pr-24 text-\[10px\] text-\[#00FF41\]/);
  assert.match(configPanelSource, /flex flex-wrap items-center justify-between gap-3 p-2/);
});

test("timeline trace panel uses plain labels and readable text sizing", () => {
  const decorativeTraceGlyphs = new RegExp(
    [
      "\\u{26A1}",
      "\\u{2693}",
      "\\u{2728}",
      "\\u{2605}",
      "\\u{26A0}",
    ].join("|"),
    "u",
  );
  const subTenPixelText = /text-\[(?:[0-9](?:\.\d+)?px)\]/;

  assert.doesNotMatch(timelineSource, decorativeTraceGlyphs);
  assert.doesNotMatch(timelineSource, subTenPixelText);
  assert.match(timelineSource, /COGNITIVE DEPENDENCY TIMELINE/);
  assert.match(timelineSource, /SYSTEM AGREEMENTS/);
  assert.match(timelineSource, /CONSENSUS PLAN #\{idx \+ 1\}/);
  assert.match(timelineSource, /No active single-turn trace path loaded/);
});

test("active research panel uses readable microcopy and responsive attractor rows", () => {
  const subTenPixelText = /text-\[(?:[0-9](?:\.\d+)?px)\]/;

  assert.doesNotMatch(activeResearchStateSource, subTenPixelText);
  assert.match(activeResearchStateSource, /BALL STATE: ACTIVE RESEARCH OBJECT/);
  assert.match(activeResearchStateSource, /Synthetic scaffold active/);
  assert.match(activeResearchStateSource, /sm:grid-cols-\[150px_minmax\(0,1fr\)\]/);
  assert.match(activeResearchStateSource, /sm:flex-row sm:items-center sm:justify-between/);
});

test("consensus board uses readable labels and plain empty-state iconography", () => {
  const subTenPixelText = /text-\[(?:[0-9](?:\.\d+)?px)\]/;
  const decorativeConsensusGlyphs = /[\u{25B2}\u{25BC}\u{1F4DD}]/u;

  assert.doesNotMatch(consensusBoardSource, subTenPixelText);
  assert.doesNotMatch(consensusBoardSource, decorativeConsensusGlyphs);
  assert.match(consensusBoardSource, /isPositive \? "UP" : "DOWN"/);
  assert.match(consensusBoardSource, /<ClipboardList className="h-5 w-5 text-slate-500" \/>/);
  assert.match(consensusBoardSource, /SPARKLINE GRAPH PENDING/);
  assert.match(consensusBoardSource, /BLUEPRINT EMPTY/);
});

test("network trainer uses readable labels and shared export icons", () => {
  const subTenPixelText = /text-\[(?:[0-9](?:\.\d+)?px)\]/;
  const decorativeTrainerGlyphs = /[\u{1F4E5}\u{1F4C1}\u{2699}\u{FE0F}\u{2192}\u{03B7}\u{03C6}]/u;

  assert.doesNotMatch(networkTrainerSource, subTenPixelText);
  assert.doesNotMatch(networkTrainerSource, decorativeTrainerGlyphs);
  assert.match(networkTrainerSource, /Download, Database, FileCode, ArrowRight/);
  assert.match(networkTrainerSource, /<Download className="h-3\.5 w-3\.5" \/> Download Weights/);
  assert.match(networkTrainerSource, /<Database className="h-3\.5 w-3\.5" \/> Download Training Dataset/);
  assert.match(networkTrainerSource, /<FileCode className="h-3\.5 w-3\.5" \/> Export Trained Model/);
  assert.match(networkTrainerSource, /min-w-\[680px\]/);
  assert.match(networkTrainerSource, /LEARNING RATE/);
  assert.match(networkTrainerSource, /ACTIVATION/);
});

test("secondary arena panels use readable text and plain metric labels", () => {
  const subTenPixelText = /text-\[(?:[0-9](?:\.\d+)?px)\]/;
  const decorativeSecondaryGlyphs = new RegExp(
    [
      "\\u00f0",
      "\\u00e2",
      "\\u2605",
      "\\u{1F4AC}",
      "\\u{1F3C6}",
      "\\u{1F91D}",
      "\\u26A1",
      "\\u2713",
      "\\u25B6",
      "\\u2192",
      "\\u2190",
      "\\u25B2",
      "\\u25BC",
      "\\u2022",
    ].join("|"),
    "u",
  );

  for (const source of [
    radarProfileSource,
    replayPanelSource,
    leaderboardSource,
    aboutManualSource,
    spectatorJudgePanelSource,
    debateLogsSource,
  ]) {
    assert.doesNotMatch(source, subTenPixelText);
    assert.doesNotMatch(source, decorativeSecondaryGlyphs);
  }

  assert.match(radarProfileSource, /"WIN RATIO"/);
  assert.match(radarProfileSource, /"CONSENSUS %"/);
  assert.match(radarProfileSource, /"DRIVE WEIGHT"/);
  assert.match(spectatorJudgePanelSource, /SCORE AWARDED/);
  assert.match(replayPanelSource, /AWARDED/);
  assert.match(debateLogsSource, /<MessageSquare className="h-5 w-5 text-slate-500" \/>/);
});
