import React, { useState } from "react";
import { AgentConfig, DebateTurn } from "../types";
import { Brain, Shield, TestTube, FileText, Activity, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { getTurnSenderDisplay } from "../utils/turnDisplay";

interface ActiveResearchStateProps {
  topic: string;
  history: DebateTurn[];
  agentConfig: AgentConfig;
}

const getAttractorForTurn = (topic: string, turnIdx: number, senderName: string) => {
  const normalizedTopic = (topic || "").toLowerCase();
  const isMars = normalizedTopic.includes("mars") || normalizedTopic.includes("dome") || normalizedTopic.includes("agricultural") || normalizedTopic.includes("space") || normalizedTopic.includes("greenhouse") || normalizedTopic.includes("crew");
  const isMonolith = normalizedTopic.includes("migrate") || normalizedTopic.includes("migration") || normalizedTopic.includes("monolith") || normalizedTopic.includes("serverless") || normalizedTopic.includes("banking") || normalizedTopic.includes("ledger") || normalizedTopic.includes("database");
  const isCookie = normalizedTopic.includes("cookie") || normalizedTopic.includes("recipe") || normalizedTopic.includes("bake") || normalizedTopic.includes("chocolate") || normalizedTopic.includes("sugar");

  if (isMars) {
    if (turnIdx % 3 === 0) {
      return {
        id: "unsafe_radiation_exposure_019",
        pattern_type: "shielding_optimization",
        confidence: 94,
        influence: `Prompted "${senderName}" to propose nested greywater shields rather than standard polymer, guarding against Martian solar proton storms.`
      };
    } else if (turnIdx % 3 === 1) {
      return {
        id: "aeroponics_nozzle_clog_033",
        pattern_type: "irrigation_reliability",
        confidence: 88,
        influence: `Forced "${senderName}" to recommend high-frequency sub-nozzle backwash loops, minimizing salt deposition risks.`
      };
    } else {
      return {
        id: "closed_loop_nitrogen_leak_051",
        pattern_type: "atmospheric_fencing",
        confidence: 91,
        influence: `Guided "${senderName}" to incorporate nitrogen leak-recovery protocols, maintaining stable sub-dome greenhouse pressures.`
      };
    }
  } else if (isMonolith) {
    if (turnIdx % 3 === 0) {
      return {
        id: "database_latency_hazard_102",
        pattern_type: "database_race_prevention",
        confidence: 98,
        influence: `Prompted "${senderName}" to deploy CDC and separate Redis queues to decouple reads and write-locks.`
      };
    } else if (turnIdx % 3 === 1) {
      return {
        id: "out_of_sync_concurrency_045",
        pattern_type: "concurrency_barrier",
        confidence: 92,
        influence: `Led "${senderName}" to request transaction-matching proxy check-gates to block out-of-order ledger updates.`
      };
    } else {
      return {
        id: "mainframe_timeout_overflow_058",
        pattern_type: "high_load_fallback",
        confidence: 90,
        influence: `Convinced "${senderName}" to introduce a circuit-breaking telemetry alert to divert mainframe spikes safely to staging tables.`
      };
    }
  } else if (isCookie) {
    if (turnIdx % 3 === 0) {
      return {
        id: "maillard_heat_distortion_004",
        pattern_type: "sugar_caramelization_balance",
        confidence: 91,
        influence: `Imposed a 120C constant mechanical butter browning threshold for "${senderName}" to avoid premature water evaporation.`
      };
    } else if (turnIdx % 3 === 1) {
      return {
        id: "gluten_toughness_overhydration_012",
        pattern_type: "protein_stabilization",
        confidence: 85,
        influence: `Advised "${senderName}" to regulate gluten bounds using bread flour hydrated with exact quantities of raw albumin.`
      };
    } else {
      return {
        id: "butter_solid_precipitation_009",
        pattern_type: "resting_equilibration",
        confidence: 95,
        influence: `Imposed a 72-hour cold resting window for "${senderName}" to equilibrate moisture levels in the starch matrix.`
      };
    }
  } else {
    // General
    if (turnIdx % 3 === 0) {
      return {
        id: "consensus_loop_deadlock_015",
        pattern_type: "rhetorical_deadlock_bypass",
        confidence: 89,
        influence: `Enforced standardized consensus checks for "${senderName}" to keep the Pong debate loop progressing forward.`
      };
    } else if (turnIdx % 3 === 1) {
      return {
        id: "scalable_latency_overflow_077",
        pattern_type: "fault_isolation",
        confidence: 86,
        influence: `Required "${senderName}" to design circuit breakers and telemetry limits inside secure isolated boundaries.`
      };
    } else {
      return {
        id: "unified_consensus_lock_099",
        pattern_type: "architectural_ratification",
        confidence: 94,
        influence: `Led "${senderName}" to consolidate all prior objections into an aligned final production validation suite.`
      };
    }
  }
};

export const ActiveResearchState: React.FC<ActiveResearchStateProps> = ({
  topic,
  history,
  agentConfig,
}) => {
  const [isHopfieldExpanded, setIsHopfieldExpanded] = useState<boolean>(true);
  const latestTurn = history[history.length - 1];

  if (!latestTurn) {
    return (
      <div className="border-2 border-white/20 p-5 bg-black/40 font-mono text-xs text-center space-y-4" id="research-state-idle">
        <div className="flex justify-center">
          <Activity className="h-6 w-6 text-slate-500 animate-pulse" />
        </div>
        <p className="uppercase tracking-widest text-slate-400 font-bold">Awaiting Vector Excitation</p>
        <p className="text-[10px] text-slate-500 uppercase leading-relaxed max-w-md mx-auto">
          Start the cognitive loop. On every paddle collision, the ball transforms into a multi-tiered Research State, compiling claims, experiments, and memory benchmarks instantly.
        </p>
      </div>
    );
  }

  // Derive research parameters based on the active topic
  const isMars = topic.toLowerCase().includes("mars") || topic.toLowerCase().includes("greenhouse") || topic.toLowerCase().includes("dome");
  const isMonolith = topic.toLowerCase().includes("monolith") || topic.toLowerCase().includes("migration") || topic.toLowerCase().includes("migrate");
  const isCookie = topic.toLowerCase().includes("cookie") || topic.toLowerCase().includes("recipe") || topic.toLowerCase().includes("bake");

  // Working Memory (M0)
  const currentClaim = latestTurn.proposal || latestTurn.content.slice(0, 100) + "...";
  
  // RAG Evidence (M2/M3)
  const retrievedContext = isMars
    ? [
        "NASA-ALS-2025: Aeroponic root dosing water-to-biomass conversion parameters (Sec 4.1)",
        "ISO-6510: Radiation density mitigation indices of heavy greywater polymer screens"
      ]
    : isMonolith
    ? [
        "Fowler: Strangler Fig architecture migration patterns for high-frequency ledger state loops",
        "Dijkstra: Real-time transactional race condition detection metrics on hybrid databases"
      ]
    : isCookie
    ? [
        "McGee: On Food and Cooking - Starches gelation and Maillard reaction caramel thresholds",
        "Ducasse: Thermodynamic oven-spring pastry structures under low moisture boundaries"
      ]
    : [
        "RFC-2119: Best practices and mandatory syntax rules for structured protocol engineering",
        "W3C-Core: Decentralized micro-caching standards under distributed networks"
      ];

  // Simulating sandbox execution metrics (M1/M5)
  const experiments = latestTurn.complexity === "complex simulation"
    ? ["Sandbox: Docker virtual dry-run", "Perf: Latency race condition trial (0.35x frequency delay)", "Syntax: Code compilation & lint verification"]
    : latestTurn.complexity === "deep research"
    ? ["Sandbox: Cross-citation lookup logs", "Web: Google Search Grounding index validation"]
    : ["Sandbox: DNS cache warmup lookup", "Local: Variable syntax alignment check"];

  // Opponent objections parsed from history
  const priorObjections = history
    .filter((t) => t.type === "critique" && t.id !== latestTurn.id)
    .slice(-2)
    .map((t) => t.content.slice(0, 110) + "...");

  // Co-training score calculations
  const taskProgress = latestTurn.convictionScore / 100;
  const evidenceQuality = latestTurn.searchSources ? 0.95 : 0.50;
  const experimentSuccess = latestTurn.complexity === "complex simulation" ? 0.92 : latestTurn.complexity === "deep research" ? 0.75 : 0.45;
  const opponentConvinced = latestTurn.type === "agreement" ? 1.00 : latestTurn.convictionScore > 75 ? 0.80 : 0.45;
  const safety = latestTurn.type === "critique" ? 0.95 : 0.70;
  const novelty = Math.min(1.0, 0.6 + (history.length * 0.05) % 0.4);
  const retrievalValue = agentConfig.useGrounding ? 0.90 : 0.30;
  const memoryValue = history.length > 2 ? 0.85 : 0.35;
  const trainingDataSig = latestTurn.proposal ? 0.95 : 0.40;
  const costEfficiency = latestTurn.complexity === "quick lookup" ? 0.95 : latestTurn.complexity === "deep research" ? 0.75 : 0.45;

  const rawRoundScore =
    0.14 * taskProgress +
    0.14 * evidenceQuality +
    0.12 * experimentSuccess +
    0.12 * opponentConvinced +
    0.10 * safety +
    0.10 * novelty +
    0.10 * retrievalValue +
    0.10 * memoryValue +
    0.10 * trainingDataSig +
    0.08 * costEfficiency;
  const roundScore = Math.min(1, rawRoundScore);
  const hasLiveGrounding = Boolean(latestTurn.searchSources && latestTurn.searchSources.length > 0);

  return (
    <div className="border-2 border-white p-5 bg-black space-y-5" id="active-research-state-card">
      <div className="flex flex-col gap-2 border-b border-white/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#00FF41]">
          <Brain className="h-3.5 w-3.5 animate-pulse" /> BALL STATE: ACTIVE RESEARCH OBJECT
        </h3>
        <span className="font-mono text-[10px] text-slate-500 uppercase">
          COCKPIT VECTORS ENGAGED
        </span>
      </div>

      <div
        id="research-data-source-disclosure"
        className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] font-mono text-amber-200 uppercase leading-relaxed"
      >
        Synthetic scaffold active: context, Hopfield attractors, and sandbox experiments are deterministic illustrative signals. {hasLiveGrounding ? "Live grounding citations are attached to this turn." : "No live grounding citation was returned for this turn."}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-mono">
        {/* Left Column: Memory Fabric */}
        <div className="space-y-4">
          {/* M0: Working Claim */}
          <div className="space-y-1.5 p-3 bg-neutral-900 border border-white/10 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase font-extrabold flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 bg-[#00FF41] rounded-full" />
              M0: Active Core Claim
            </div>
            <p className="text-xs text-white leading-relaxed uppercase border-l-2 border-[#00FF41] pl-2 font-bold select-text">
              {currentClaim}
            </p>
          </div>

          {/* M1/M2: Evidence Grounding */}
          <div className="space-y-2">
            <div className="text-[10px] text-slate-500 uppercase font-extrabold flex items-center gap-1">
              <FileText className="h-3 w-3 text-cyan-400" />
              M2/M3: MemoryForge Context & Evidence (RAG)
            </div>
            <div className="space-y-1 bg-black/60 border border-white/10 p-2.5 rounded-sm">
              {retrievedContext.map((ctx, idx) => (
                <div key={idx} className="text-[10px] text-cyan-300 leading-normal border-b border-white/5 pb-1 last:border-0 last:pb-0 uppercase">
                  &gt; {ctx}
                </div>
              ))}
              {latestTurn.searchSources && (
                <div className="mt-2 pt-1 border-t border-cyan-500/20 text-[#00FF41] text-[10px]">
                  CITED GROUNDING: {latestTurn.searchSources[0].title}
                </div>
              )}
            </div>
          </div>

          {/* M4: Modern Hopfield strategy retrieval (COLLAPSIBLE PANEL) */}
          <div className="space-y-2 border border-amber-500/30 rounded-sm overflow-hidden" id="hopfield-strategy-panel">
            <button
              onClick={() => setIsHopfieldExpanded(!isHopfieldExpanded)}
              className="w-full flex flex-col gap-2 bg-amber-950/20 px-3 py-2 text-left text-[10px] font-extrabold uppercase text-amber-400 focus:outline-none hover:bg-amber-950/45 cursor-pointer transition-all sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                M4: Hopfield Associated Attractors ({history.length} Retrieved)
              </span>
              <span className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded-sm font-black whitespace-nowrap">
                  LATEST: {latestTurn ? getAttractorForTurn(topic, history.length - 1, getTurnSenderDisplay(latestTurn.sender, agentConfig).name).confidence : 0}%
                </span>
                {isHopfieldExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </span>
            </button>

            {isHopfieldExpanded && (
              <div className="p-3 bg-black space-y-4 text-[10px] border-t border-amber-500/10">
                <p className="text-[10px] text-slate-400 uppercase leading-snug border-b border-white/5 pb-2">
                  To prevent logical deadlocks and historical failures, agents invoke high-dimensional Hopfield basins to retrieve working memory attractors:
                </p>

                <div className="space-y-3 divide-y divide-amber-500/10">
                  {history.map((msg, idx) => {
                    const senderName = getTurnSenderDisplay(msg.sender, agentConfig).name;
                    const attractor = getAttractorForTurn(topic, idx, senderName);
                    return (
                      <div key={msg.id || idx} className="space-y-2 pt-2.5 first:pt-0 first:border-0">
                        <div className="flex flex-col gap-1 font-bold text-[10px] text-amber-500 sm:flex-row sm:items-center sm:justify-between">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping shrink-0" />
                            PROTOTYPE: {attractor.id}
                          </span>
                          <span className="bg-amber-500/15 text-amber-400 px-1 py-0.5 border border-amber-500/20 text-[10px] tracking-widest rounded-sm uppercase whitespace-nowrap">
                            CONFIDENCE: {attractor.confidence}%
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-[10px] sm:grid-cols-[150px_minmax(0,1fr)]">
                          <span className="text-slate-500 font-extrabold uppercase">Attractor Vector:</span>
                          <span className="text-amber-300 font-bold uppercase">{attractor.pattern_type.toUpperCase()}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-[10px] sm:grid-cols-[150px_minmax(0,1fr)]">
                          <span className="text-slate-500 font-extrabold uppercase">Agent Decision Influence:</span>
                          <span className="text-slate-200 select-text leading-relaxed uppercase">{attractor.influence}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Energy relaxation trajectory visualizer for the latest attractor */}
                {(() => {
                  const latestAttractor = getAttractorForTurn(topic, history.length - 1, getTurnSenderDisplay(latestTurn.sender, agentConfig).name);
                  return (
                    <div className="bg-amber-950/5 border border-amber-500/20 p-2.5 text-[10px] space-y-1 mt-2.5">
                      <span className="text-slate-500 uppercase block font-black">Latest Energy State Relaxation Trajectory:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-500 shrink-0 tracking-widest font-bold">HIGH</span>
                        <div className="h-1.5 flex-grow bg-neutral-900 border border-amber-500/20 relative overflow-hidden flex">
                          <div className="h-full bg-amber-500/20 w-3/4 border-r border-amber-500" />
                          <div className="h-full bg-[#00FF41] w-1/4 animate-pulse" />
                        </div>
                        <span className="text-[#00FF41] shrink-0 tracking-widest font-bold">STABLE</span>
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase pt-0.5">
                        Deep relaxation trajectory complete. Attracted to basin state: <span className="text-white font-bold">{latestAttractor.id}</span>.
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sandbox Execution & CO-TRAINING metrics */}
        <div className="space-y-4">
          {/* Tool actions and experiments */}
          <div className="space-y-2">
            <div className="text-[10px] text-slate-500 uppercase font-extrabold flex items-center gap-1">
              <TestTube className="h-3 w-3 text-pink-400" />
              SF Sandbox Execution (Experiments)
            </div>
            <div className="bg-black/60 border border-white/10 p-2.5 space-y-1.5 rounded-sm">
              {experiments.map((exp, idx) => (
                <div key={idx} className="flex justify-between gap-3 text-[10px] text-pink-300 uppercase">
                  <span>{exp}</span>
                  <span className="text-[#00FF41] font-bold">SUCCESS</span>
                </div>
              ))}
            </div>
          </div>

          {/* Objections box */}
          {priorObjections.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-extrabold flex items-center gap-1">
                <Shield className="h-3 w-3 text-[#FF4100]" />
                Recent Rejection Contradictions (Objections)
              </div>
              <div className="bg-rose-950/5 border border-rose-500/20 p-2.5 text-[10px] text-[#FF4100] space-y-1.5 uppercase">
                {priorObjections.map((obj, idx) => (
                  <div key={idx} className="leading-snug">
                    - {obj}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Co-Training Metrics */}
          <div className="space-y-2 p-3 bg-neutral-900 border border-white/10 rounded-sm">
            <div className="flex justify-between items-center gap-3 text-[10px] text-slate-400 font-extrabold uppercase">
              <span>Dynamic Round Quality Scorer (PongCoach)</span>
              <span className="text-[#00FF41] font-black text-xs">{(roundScore * 10).toFixed(2)} / 10.0</span>
            </div>
            <div className="space-y-1 pt-2 border-t border-white/5">
              <div className="flex justify-between gap-3 text-[10px] text-slate-500">
                <span>CLAIM SECURING PROGRESS (14%)</span>
                <span className="text-white font-bold">{(taskProgress * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-black h-1 border border-white/10">
                <div className="bg-[#00FF41] h-full" style={{ width: `${taskProgress * 100}%` }} />
              </div>

              <div className="flex justify-between gap-3 text-[10px] text-slate-500 pt-1">
                <span>EVIDENCE GROUNDING VALUE (14%)</span>
                <span className="text-white font-bold">{(evidenceQuality * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-black h-1 border border-white/10">
                <div className="bg-[#00FF41] h-full" style={{ width: `${evidenceQuality * 100}%` }} />
              </div>

              <div className="flex justify-between gap-3 text-[10px] text-slate-500 pt-1">
                <span>SANDBOX VALIDATION DEPTH (12%)</span>
                <span className="text-white font-bold">{(experimentSuccess * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-black h-1 border border-white/10">
                <div className="bg-[#00FF41] h-full" style={{ width: `${experimentSuccess * 100}%` }} />
              </div>

              <div className="flex justify-between gap-3 text-[10px] text-slate-500 pt-1">
                <span>BENCHMARK LEARNING VALUE (10%)</span>
                <span className="text-white font-bold">{(trainingDataSig * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-black h-1 border border-white/10">
                <div className="bg-[#00FF41] h-full" style={{ width: `${trainingDataSig * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

