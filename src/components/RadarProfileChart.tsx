import React, { useState, useMemo } from "react";
import * as d3 from "d3";
import { Scale, Award } from "lucide-react";

interface SavedMatch {
  id: string;
  topic: string;
  timestamp: string;
  isPublic: boolean;
  cycleCount: number;
  consensusCount: number;
  agentA: {
    name: string;
    provider: string;
    model: string;
    competitiveDrive: number;
    strategyBias: string;
    score: number;
  };
  agentB: {
    name: string;
    provider: string;
    model: string;
    competitiveDrive: number;
    strategyBias: string;
    score: number;
  };
  finalizedTasks: Array<{
    title: string;
    summary: string;
    confidence: number;
    approvedBy: string;
  }>;
}

interface RadarProfileChartProps {
  matches: SavedMatch[];
}

export const RadarProfileChart: React.FC<RadarProfileChartProps> = ({ matches }) => {
  const [activeMetric, setActiveMetric] = useState<"winRate" | "consensus" | "drive">("winRate");
  const [comboA, setComboA] = useState<string>("adversarial");
  const [comboB, setComboB] = useState<string>("cooperative");
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);

  // Strategy definitions
  const strategyMeta: Record<string, { label: string; desc: string; color: string; icon: string }> = {
    adversarial: { label: "Aggressive", desc: "Attacking counters, deconstruction, high friction", color: "#FF1493", icon: "ADV" },
    cooperative: { label: "Empathetic", desc: "Compromise builder, synthesis, shared paths", color: "#00FFFF", icon: "COOP" },
    socratic: { label: "Analytical", desc: "Probe truth, hypothesis tests, trace proofs", color: "#FFD700", icon: "SOC" },
    rhetorical: { label: "Persuasive", desc: "Meta-arguments, rhetorical framing, high conviction", color: "#ADFF2F", icon: "RHE" },
    balanced: { label: "Balanced", desc: "Adaptable compromise and critique balance", color: "#1F77B4", icon: "BAL" }
  };

  // Compile profiles statistics from matches list
  const profileStats = useMemo(() => {
    // Inject seed values based on preloaded matches, then add current live match data
    const stats: Record<string, {
      wins: number;
      losses: number;
      draws: number;
      played: number;
      totalConsensusScore: number;
      consensusCount: number;
      totalDrive: number;
      driveCount: number;
    }> = {
      adversarial: { wins: 8, losses: 5, draws: 2, played: 15, totalConsensusScore: 680, consensusCount: 15, totalDrive: 780, driveCount: 15 },
      cooperative: { wins: 6, losses: 7, draws: 3, played: 16, totalConsensusScore: 890, consensusCount: 16, totalDrive: 512, driveCount: 16 },
      socratic: { wins: 9, losses: 5, draws: 2, played: 16, totalConsensusScore: 820, consensusCount: 16, totalDrive: 640, driveCount: 16 },
      rhetorical: { wins: 7, losses: 6, draws: 2, played: 15, totalConsensusScore: 710, consensusCount: 15, totalDrive: 698, driveCount: 15 },
      balanced: { wins: 11, losses: 9, draws: 4, played: 24, totalConsensusScore: 780, consensusCount: 24, totalDrive: 590, driveCount: 24 }
    };

    matches.forEach(match => {
      const sA = (match.agentA?.strategyBias || "balanced").toLowerCase();
      const sB = (match.agentB?.strategyBias || "balanced").toLowerCase();

      // Normalize if wrong case/key
      const keyA = stats[sA] ? sA : "balanced";
      const keyB = stats[sB] ? sB : "balanced";

      // Increment played counts
      stats[keyA].played += 1;
      stats[keyB].played += 1;

      // Accumulate competitive drive
      const driveA = match.agentA?.competitiveDrive ?? 50;
      const driveB = match.agentB?.competitiveDrive ?? 50;
      stats[keyA].totalDrive += driveA;
      stats[keyA].driveCount += 1;
      stats[keyB].totalDrive += driveB;
      stats[keyB].driveCount += 1;

      // Accumulate task consensus values
      const consensusTotal = match.finalizedTasks && match.finalizedTasks.length > 0
        ? match.finalizedTasks.reduce((sum, task) => sum + (task?.confidence || 75), 0)
        : 0;
      const consensusVal = match.finalizedTasks && match.finalizedTasks.length > 0
        ? consensusTotal / match.finalizedTasks.length
        : 75;
      
      stats[keyA].totalConsensusScore += consensusVal;
      stats[keyA].consensusCount += 1;
      stats[keyB].totalConsensusScore += consensusVal;
      stats[keyB].consensusCount += 1;

      // Classify Win / loss / draw
      const scoreA = match.agentA?.score ?? 0;
      const scoreB = match.agentB?.score ?? 0;

      if (scoreA > scoreB) {
        stats[keyA].wins += 1;
        stats[keyB].losses += 1;
      } else if (scoreB > scoreA) {
        stats[keyB].wins += 1;
        stats[keyA].losses += 1;
      } else {
        stats[keyA].draws += 1;
        stats[keyB].draws += 1;
      }
    });

    // Compile into final list
    return Object.keys(stats).map(key => {
      const raw = stats[key];
      const winRateVal = Math.round(((raw.wins + (raw.draws * 0.5)) / (raw.played || 1)) * 100);
      const avgConsensusVal = Math.round(raw.totalConsensusScore / (raw.consensusCount || 1));
      const avgDriveVal = Math.round(raw.totalDrive / (raw.driveCount || 1));

      return {
        key,
        name: strategyMeta[key]?.label || key,
        played: raw.played,
        wins: raw.wins,
        losses: raw.losses,
        draws: raw.draws,
        winRate: Math.max(10, Math.min(100, winRateVal)),
        consensus: Math.max(10, Math.min(100, avgConsensusVal)),
        drive: Math.max(10, Math.min(100, avgDriveVal)),
        color: strategyMeta[key]?.color || "#00FF41",
        meta: strategyMeta[key]
      };
    });
  }, [matches]);

  // Dynamic profile combinations statistics calculator
  const combinationStats = useMemo(() => {
    let played = 0;
    let winA = 0;
    let winB = 0;
    let draws = 0;
    let totalConsensus = 0;

    // Process our actual database matches first
    matches.forEach(match => {
      const sA = (match.agentA?.strategyBias || "balanced").toLowerCase();
      const sB = (match.agentB?.strategyBias || "balanced").toLowerCase();

      // Check if it matches chosen combo selection (either direction)
      const matchesDirect = (sA === comboA && sB === comboB);
      const matchesReverse = (sA === comboB && sB === comboA);

      if (matchesDirect || matchesReverse) {
        played += 1;
        
        const consensusTotal = match.finalizedTasks && match.finalizedTasks.length > 0
          ? match.finalizedTasks.reduce((sum, task) => sum + (task?.confidence || 75), 0)
          : 0;
        const consensusVal = match.finalizedTasks && match.finalizedTasks.length > 0
          ? consensusTotal / match.finalizedTasks.length
          : 75;
        totalConsensus += consensusVal;

        const scoreA = match.agentA?.score ?? 0;
        const scoreB = match.agentB?.score ?? 0;

        if (scoreA === scoreB) {
          draws += 1;
        } else if (matchesDirect) {
          if (scoreA > scoreB) winA += 1;
          else winB += 1;
        } else {
          if (scoreB > scoreA) winA += 1;
          else winB += 1;
        }
      }
    });

    // Add randomized synthetic multiplier seed based on chosen combination properties to ensure we don't show empty charts
    const seedPlayed = comboA === comboB ? 6 : 14;
    const seedWinA = comboA === comboB ? 3 : Math.round(seedPlayed * (comboA === "adversarial" ? 0.6 : comboA === "cooperative" ? 0.4 : 0.5));
    const seedWinB = comboA === comboB ? 3 : (seedPlayed - seedWinA - 2);
    const seedDraws = comboA === comboB ? 0 : 2;
    const seedConsensus = (comboA === "cooperative" || comboB === "cooperative") ? 88 : (comboA === "adversarial" && comboB === "adversarial") ? 64 : 77;

    const cumulativePlayed = played + seedPlayed;
    const cumulativeWinA = winA + seedWinA;
    const cumulativeWinB = winB + seedWinB;
    const cumulativeDraws = draws + seedDraws;
    const avgConsensus = Math.round((totalConsensus + (seedConsensus * seedPlayed)) / cumulativePlayed);

    const winRateA = Math.round((cumulativeWinA / cumulativePlayed) * 100);
    const winRateB = Math.round((cumulativeWinB / cumulativePlayed) * 100);
    const drawRate = Math.round((cumulativeDraws / cumulativePlayed) * 100);

    return {
      played: cumulativePlayed,
      winA: cumulativeWinA,
      winB: cumulativeWinB,
      draws: cumulativeDraws,
      winRateA,
      winRateB,
      drawRate,
      avgConsensus
    };
  }, [matches, comboA, comboB]);


  // --- D3 RADAR GEOMETRY MATHEMATICS ---
  const size = 260;
  const center = size / 2;
  const maxR = size * 0.38;

  // 5 vertices
  const totalAxes = profileStats.length;
  const angles = profileStats.map((_, i) => (i * 2 * Math.PI) / totalAxes - Math.PI / 2);

  // Generate grid levels (each 20% interval)
  const gridLevels = [20, 40, 60, 80, 100];

  // Helper coordinate converters
  const getCoordinatesForValue = (angle: number, value: number) => {
    const factor = value / 100;
    const r = maxR * factor;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  // Build the live polygon data series from active metrics selected by the user
  const polygonPoints = useMemo(() => {
    return profileStats.map((item, i) => {
      const val = item[activeMetric];
      return getCoordinatesForValue(angles[i], val);
    });
  }, [profileStats, activeMetric, angles]);

  const polygonPath = useMemo(() => {
    if (polygonPoints.length === 0) return "";
    return d3.line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveLinearClosed)(polygonPoints) || "";
  }, [polygonPoints]);

  return (
    <div className="border border-white/20 bg-neutral-950 p-4 rounded-sm flex flex-col gap-4 font-mono select-none" id="radar-profile-chart-container">
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-3">
        <div className="text-left">
          <span className="text-[10px] font-black tracking-widest text-[#00FF41] uppercase block">
            D3 Profile Analytics Engine
          </span>
          <h3 className="text-xs font-black text-white uppercase mt-0.5 flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-[#00FF41]" />
            PERSONALITY SYNERGY RADAR MAP
          </h3>
          <span id="radar-seed-disclosure" className="mt-1 block text-[10px] font-mono text-amber-300 uppercase">
            Seed baseline blended with {matches.length} saved match{matches.length === 1 ? "" : "es"}
          </span>
        </div>

        {/* Metric tabs deck */}
        <div className="flex flex-wrap gap-1 bg-black p-0.5 border border-white/10 rounded-sm">
          {(["winRate", "consensus", "drive"] as const).map((metric) => (
            <button
              key={metric}
              id={`radar-metric-${metric}-button`}
              type="button"
              aria-pressed={activeMetric === metric}
              aria-label={`Show radar metric ${metric === "winRate" ? "WIN RATIO" : metric === "consensus" ? "CONSENSUS %" : "DRIVE WEIGHT"}`}
              onClick={() => setActiveMetric(metric)}
              className={`text-[10px] font-mono px-2 py-1 uppercase rounded-xs transition-all cursor-pointer ${
                activeMetric === metric
                  ? "bg-[#00FF41] text-black font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {metric === "winRate" ? "WIN RATIO" : metric === "consensus" ? "CONSENSUS %" : "DRIVE WEIGHT"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Radar Chart + Matchup Grid combo */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        
        {/* SVG Interactive Radar Chart Screen (Col Span 5) */}
        <div className="md:col-span-6 flex flex-col items-center justify-center p-2 relative bg-black/40 border border-white/5 rounded-xs" id="radar-viewport">
          <svg width={size} height={size} className="overflow-visible" id="radar-profile-svg" aria-label="Personality synergy radar chart">
            {/* Inner Glow Filters */}
            <defs>
              <radialGradient id="radarInnerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00FF41" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#00FF41" stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Glowing inner base */}
            <circle cx={center} cy={center} r={maxR} fill="url(#radarInnerGlow)" />

            {/* Polygon concentric grids */}
            {gridLevels.map((level) => {
              const gridCoords = angles.map(angle => getCoordinatesForValue(angle, level));
              const gridPath = d3.line<{ x: number; y: number }>()
                .x(d => d.x)
                .y(d => d.y)
                .curve(d3.curveLinearClosed)(gridCoords) || "";

              return (
                <g key={level}>
                  <path
                    d={gridPath}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                  {/* Grid numbers */}
                  <text
                    x={center + 4}
                    y={center - (maxR * (level / 100)) + 3}
                    fill="rgba(255, 255, 255, 0.25)"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {level}%
                  </text>
                </g>
              );
            })}

            {/* Axes spokes radiating from center */}
            {profileStats.map((item, i) => {
              const endCoord = getCoordinatesForValue(angles[i], 100);
              const labelCoord = getCoordinatesForValue(angles[i], 115);
              const isHovered = hoveredProfile === item.key;

              return (
                <g key={item.key}>
                  {/* Spokes line */}
                  <line
                    x1={center}
                    y1={center}
                    x2={endCoord.x}
                    y2={endCoord.y}
                    stroke="rgba(200, 200, 200, 0.15)"
                    strokeWidth="1"
                  />
                  
                  {/* Web Text anchors */}
                  <text
                    x={labelCoord.x}
                    y={labelCoord.y}
                    fill={isHovered ? "#00FF41" : "rgba(255,255,255,0.7)"}
                    fontSize="8.5"
                    fontWeight="black"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    className="font-mono cursor-pointer transition-colors"
                    onMouseEnter={() => setHoveredProfile(item.key)}
                    onMouseLeave={() => setHoveredProfile(null)}
                  >
                    {item.name}
                  </text>
                </g>
              );
            })}

            {/* Glowing Metric Performance Polygon */}
            <path
              id="radar-metric-polygon"
              data-active-metric={activeMetric}
              d={polygonPath}
              fill="rgba(0, 255, 65, 0.15)"
              stroke="#00FF41"
              strokeWidth="2"
              className="transition-all duration-300"
            />

            {/* Interactive nodes at vertices */}
            {profileStats.map((item, i) => {
              const val = item[activeMetric];
              const coord = getCoordinatesForValue(angles[i], val);
              const isHovered = hoveredProfile === item.key;

              return (
                <g key={item.key}>
                  <circle
                    id={`radar-point-${item.key}`}
                    data-profile-key={item.key}
                    data-profile-value={String(val)}
                    cx={coord.x}
                    cy={coord.y}
                    r={isHovered ? 6 : 4}
                    fill={isHovered ? "#ffffff" : "#00FF41"}
                    stroke="#000000"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredProfile(item.key)}
                    onMouseLeave={() => setHoveredProfile(null)}
                  />
                  {/* Hover mini stat flag inside target */}
                  {isHovered && (
                    <g>
                      <rect
                        x={coord.x - 22}
                        y={coord.y - 18}
                        width="44"
                        height="12"
                        fill="black"
                        stroke="#00FF41"
                        strokeWidth="1"
                        rx="1"
                      />
                      <text
                        x={coord.x}
                        y={coord.y - 10}
                        fill="#00FF41"
                        fontSize="7.5"
                        fontWeight="black"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {val}%
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dynamic Head-to-Head Combo Simulator (Col Span 7) */}
        <div className="md:col-span-6 space-y-3.5" id="combo-matchup-dashboard">
          
          <div className="bg-neutral-900 border border-white/10 p-3 rounded-sm space-y-2">
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block text-left">
              COMBINATIONAL PROFILE COMPARE
            </span>
            <p className="text-[10px] text-zinc-400 text-left leading-relaxed">
              Compare matchup dynamics. Select any combination of competing personalities to view simulated Head-to-Head win percentages and collaborative agreement thresholds.
            </p>

            {/* Duel selectors */}
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <div>
                <label htmlFor="combo-profile-a-select" className="block text-[10px] text-slate-500 font-bold uppercase mb-1">PROFILER PADDLE A</label>
                <select
                  id="combo-profile-a-select"
                  aria-label="Profiler paddle A strategy"
                  value={comboA}
                  onChange={(e) => setComboA(e.target.value)}
                  className="w-full bg-black border border-white/20 hover:border-white/40 text-xs px-2 py-1 text-slate-200 uppercase font-mono focus:outline-none rounded-xs select-none"
                >
                  {Object.keys(strategyMeta).map(key => (
                    <option key={key} value={key}>
                      {strategyMeta[key].icon} {strategyMeta[key].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="combo-profile-b-select" className="block text-[10px] text-slate-500 font-bold uppercase mb-1">PROFILER PADDLE B</label>
                <select
                  id="combo-profile-b-select"
                  aria-label="Profiler paddle B strategy"
                  value={comboB}
                  onChange={(e) => setComboB(e.target.value)}
                  className="w-full bg-black border border-white/20 hover:border-white/40 text-xs px-2 py-1 text-slate-200 uppercase font-mono focus:outline-none rounded-xs select-none"
                >
                  {Object.keys(strategyMeta).map(key => (
                    <option key={key} value={key}>
                      {strategyMeta[key].icon} {strategyMeta[key].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* H2H Stat breakdown widget */}
          <div className="border border-white/15 bg-neutral-950 p-3 text-left space-y-2.5">
            <div className="flex flex-wrap justify-between items-center gap-2 text-[10px]">
              <span className="text-slate-400 font-extrabold uppercase">CO-COMPETITIVE SEQUENCE METRICS:</span>
              <span id="combo-played-value" className="text-[10px] bg-[#00FF41]/10 text-[#00FF41] px-1.5 py-0.5 font-bold uppercase">
                {combinationStats.played} VOLLEYS MATCHED
              </span>
            </div>
            <p className="text-[10px] text-amber-300 uppercase leading-tight">
              Includes deterministic seed volleys plus saved public match logs.
            </p>

            {/* Progress segmented matchup slider representer */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold">
                <span className="text-cyan-400 flex items-center gap-1">
                  <span>{strategyMeta[comboA]?.icon}</span>
                  <span className="truncate max-w-[85px]">{strategyMeta[comboA]?.label}</span>
                  <span id="combo-winrate-a-value">({combinationStats.winRateA}%)</span>
                </span>
                
                <span className="text-slate-400">DRAW <span id="combo-draw-rate-value">({combinationStats.drawRate}%)</span></span>

                <span className="text-rose-500 flex items-center gap-1">
                  <span id="combo-winrate-b-value">({combinationStats.winRateB}%)</span>
                  <span>{strategyMeta[comboB]?.icon}</span>
                  <span className="truncate max-w-[85px]">{strategyMeta[comboB]?.label}</span>
                </span>
              </div>

              {/* Progress bar represent */}
              <div className="w-full flex h-2 border border-white/10 overflow-hidden">
                <div id="combo-winrate-a-bar" className="bg-cyan-400 h-full transition-all" style={{ width: `${combinationStats.winRateA}%` }}></div>
                <div id="combo-draw-rate-bar" className="bg-zinc-700 h-full transition-all" style={{ width: `${combinationStats.drawRate}%` }}></div>
                <div id="combo-winrate-b-bar" className="bg-rose-500 h-full transition-all" style={{ width: `${combinationStats.winRateB}%` }}></div>
              </div>
            </div>

            {/* Core synergy details indicators */}
            <div className="grid grid-cols-1 gap-3 pt-1 border-t border-white/5 sm:grid-cols-2">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-black block">CONSENSUS PACT RATING</span>
                <span id="combo-consensus-value" className="text-sm font-black text-white flex items-center gap-1 uppercase">
                  <Award className="h-3.5 w-3.5 text-[#00FF41]" />
                  {combinationStats.avgConsensus}% Synergy
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-black block">PREDOMINANT STRATEGIC BIAS</span>
                <span id="combo-bias-value" className="text-[10px] font-bold text-slate-300 truncate block uppercase">
                  {comboA === comboB ? `HOMOGENOUS DEBATE` : `${strategyMeta[comboA]?.label} VS ${strategyMeta[comboB]?.label}`}
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Selected profile interactive tooltip explain cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-neutral-900/40 p-2 rounded-xs border border-white/5">
        {profileStats.map((item) => (
          <div
            key={item.key}
            id={`profile-stat-${item.key}`}
            data-active-metric={activeMetric}
            data-profile-key={item.key}
            data-win-rate={String(item.winRate)}
            data-consensus={String(item.consensus)}
            data-drive={String(item.drive)}
            className={`p-2 border transition-all text-left ${
              hoveredProfile === item.key
                ? "border-[#00FF41] bg-black"
                : "border-transparent bg-neutral-950/40"
            }`}
            onMouseEnter={() => setHoveredProfile(item.key)}
            onMouseLeave={() => setHoveredProfile(null)}
          >
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="text-[10.5px] font-black text-white flex items-center gap-1 uppercase">
                <span>{item.meta?.icon}</span>
                <span>{item.name} Style</span>
              </span>
              <span className="text-[10px] text-[#00FF41] font-bold">
                {activeMetric === "winRate" ? `W: ${item.wins} / L: ${item.losses}` : activeMetric === "consensus" ? `${item.consensus}% synergy` : `${item.drive}% drive`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight mt-1">
              {item.meta?.desc}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
};
