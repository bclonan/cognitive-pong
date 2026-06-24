import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, X, HelpCircle, Trophy, Scale } from "lucide-react";
import { DebateTurn, AgentConfig } from "../types";
import { getTurnSenderDisplay } from "../utils/turnDisplay";
import { svgColorFromAgentColor } from "../utils/replayColors";

interface ReplayMatchPanelProps {
  history: DebateTurn[];
  agentConfig: AgentConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const ReplayMatchPanel: React.FC<ReplayMatchPanelProps> = ({
  history,
  agentConfig,
  isOpen,
  onClose,
}) => {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2000); // ms per step

  const closeReplay = () => {
    setIsPlaying(false);
    onClose();
  };

  // Auto-play effect
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentIdx((prevIdx) => {
          if (prevIdx >= history.length - 1) {
            setIsPlaying(false);
            return prevIdx;
          }
          return prevIdx + 1;
        });
      }, playbackSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, history.length, playbackSpeed]);

  useEffect(() => {
    if (history.length === 0) {
      setCurrentIdx(0);
      setIsPlaying(false);
      return;
    }
    if (currentIdx > history.length - 1) {
      setCurrentIdx(history.length - 1);
      setIsPlaying(false);
    }
  }, [currentIdx, history.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReplay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalTurns = history.length;
  const currentTurn: DebateTurn | undefined = history[currentIdx];

  const handleNext = () => {
    if (currentIdx < totalTurns - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setIsPlaying(false);
  };

  const nameA = agentConfig?.agentA?.name || "Agent A";
  const nameB = agentConfig?.agentB?.name || "Agent B";
  const avatarA = agentConfig?.agentA?.avatar || "🪐";
  const avatarB = agentConfig?.agentB?.avatar || "🛰️";
  const colorA = svgColorFromAgentColor(agentConfig?.agentA?.color, "#00FFFF");
  const colorB = svgColorFromAgentColor(agentConfig?.agentB?.color, "#FF1493");
  const senderDisplay = getTurnSenderDisplay(currentTurn?.sender, agentConfig);
  const activeColor = currentTurn?.sender === "agentA" ? colorA : currentTurn?.sender === "agentB" ? colorB : senderDisplay.color;

  // Calculate coordinates for SVG retro pong simulator based on selected turn
  // If Agent A is active (sender is agentA), the ball is hitting left.
  // If Agent B is active (sender is agentB), the ball is hitting right.
  const isAgentAActive = currentTurn?.sender === "agentA";
  const isAgentBActive = currentTurn?.sender === "agentB";
  const isModeratorTurn = currentTurn?.sender === "moderator";
  const ballX = isModeratorTurn ? 250 : isAgentAActive ? 40 : 460;
  const ballY = isModeratorTurn ? 110 : isAgentAActive ? 90 : 130; // some diagonal offset
  
  // Highlight stats
  const curRefEval = currentTurn?.judgeEvaluation;
  const curReactions = currentTurn?.spectatorLiveReactions || [];

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto flex items-start justify-center p-4 sm:p-6 backdrop-blur-md" id="replay-match-overlay" role="dialog" aria-modal="true">
      <div className="border-4 border-white bg-black w-full max-w-4xl p-6 relative flex flex-col gap-6 my-8" id="replay-modal-container">
        
        {/* Absolute header tag */}
        <div className="absolute -top-4 left-6 bg-black px-3 py-1 border-2 border-white text-xs tracking-widest text-[#00FF41] uppercase font-black flex items-center gap-2">
          <Trophy className="h-4 w-4" /> RE-ENACTMENT PROTOCOL: RETRO PLAYBACK ENGINE
        </div>

        {/* Close Button */}
        <button 
          onClick={closeReplay}
          aria-label="Close replay"
          className="fixed top-4 right-4 z-[60] bg-red-600 hover:bg-white text-white hover:text-black font-mono font-black text-xs px-2.5 py-1 border-2 border-white transition-colors cursor-pointer"
          title="Exit replay mode"
          id="close-replay-btn"
        >
          <X className="h-4 w-4" />
        </button>

        {/* If no history exists */}
        {totalTurns === 0 ? (
          <div className="py-16 text-center text-slate-500 font-mono space-y-4" id="empty-replay-state">
            <HelpCircle className="h-12 w-12 mx-auto text-[#FF4100] animate-pulse" />
            <p className="font-extrabold text-white text-sm uppercase tracking-wider">NO EXPERIMENTAL TRANSCRIPTS STORED</p>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              Before running playback, configure and trigger at least 1 turn inside the Cognitive Arena. The matching system logs each vector swing dynamically.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 border border-white hover:bg-[#00FF41] hover:text-black text-white hover:border-[#00FF41] transition-all uppercase text-xs font-black cursor-pointer"
            >
              Back to Arena Controls
            </button>
          </div>
        ) : (
          <>
            {/* Top Navigation HUD */}
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/20 pb-4" id="replay-hud-header">
              <div className="flex flex-col text-left font-mono">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">RECORDED SEQUENCE FILE</span>
                <span className="text-sm font-black text-white">REPLAYING COLLABORATION MATCH</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 bg-neutral-950 px-4 py-2 border border-white/10" id="timing-selection">
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-extrabold">SPEED:</span>
                <div className="flex flex-wrap gap-2">
                  {[3000, 2000, 1000].map((speed) => {
                    const speedId = speed === 3000 ? "slow" : speed === 2000 ? "normal" : "fast";
                    const speedLabel = speed === 3000 ? "1x SLOW" : speed === 2000 ? "1.5x NORM" : "2.5x ENHANCED";
                    return (
                    <button
                      key={speed}
                      id={`replay-speed-${speedId}-btn`}
                      aria-label={`Set replay speed to ${speedLabel}`}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer ${
                        playbackSpeed === speed
                          ? "bg-[#00FF41] text-black font-black"
                          : "text-slate-400 hover:text-white border border-white/5 hover:border-white/20 bg-black"
                      }`}
                    >
                      {speedLabel}
                    </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Grid 1: Virtual Retro Arena View */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="replay-grid-main">
              
              {/* Retro Vector Simulation (Col-Span 2) */}
              <div className="md:col-span-2 border-2 border-white bg-black p-2 flex flex-col justify-between aspect-[16/9] relative" id="replay-sandbox-wrapper">
                <div className="absolute top-2 left-2 text-[10px] font-mono text-[#00FF41] uppercase tracking-wider font-bold">
                  SIM PROTOCOL: TURN REC_0x0{currentIdx + 1}
                </div>

                {/* Score Counter / Status */}
                <div className="flex justify-between px-4 pt-6 select-none font-mono text-center sm:px-12">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-cyan-400">{isAgentAActive ? "1" : "0"}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{nameA.split(" ")[0]}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 self-center uppercase tracking-widest px-2 py-0.5 border border-white/10 bg-neutral-950">
                    {currentTurn?.complexity || "STANDARD VOLLEY"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-rose-500">{isAgentBActive ? "1" : "0"}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{nameB.split(" ")[0]}</span>
                  </div>
                </div>

                {/* Actual Pong Volley Board in SVG */}
                <div className="flex-1 min-h-[160px] relative my-2 overflow-hidden bg-neutral-950 border border-neutral-900 rounded-sm">
                  <svg className="w-full h-full" viewBox="0 0 500 220" preserveAspectRatio="xMinYMin meet">
                    {/* Centered dotted line divider */}
                    <line x1="250" y1="0" x2="250" y2="220" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="6,4" />

                    {/* Agent A Left Paddle */}
                    <rect 
                      x="20" 
                      y={isAgentAActive ? "65" : "115"} 
                      width="10" 
                      height="50" 
                      fill={colorA} 
                      className={`transition-all duration-300 ${isAgentAActive ? 'brightness-125 saturate-120' : 'opacity-40'}`} 
                    />
                    <text x="5" y={isAgentAActive ? "95" : "145"} fill={colorA} fontSize="14" className="pointer-events-none">{avatarA}</text>

                    {/* Agent B Right Paddle */}
                    <rect 
                      x="470" 
                      y={isAgentBActive ? "75" : "125"}
                      width="10" 
                      height="50" 
                      fill={colorB} 
                      className={`transition-all duration-300 ${isAgentBActive ? 'brightness-125 saturate-120' : 'opacity-40'}`}
                    />
                    <text x="480" y={isAgentBActive ? "105" : "155"} fill={colorB} fontSize="14" className="pointer-events-none">{avatarB}</text>

                    {isModeratorTurn && (
                      <text x="214" y="80" fill={senderDisplay.color} fontSize="12" fontWeight="700" className="pointer-events-none">MODERATOR</text>
                    )}

                    {/* Glowing Vector Ball */}
                    <motion.circle 
                      cx={ballX}
                      cy={ballY}
                      r="7"
                      fill={activeColor}
                      className="shadow-xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        filter: [`drop-shadow(0 0 2px ${activeColor})`, `drop-shadow(0 0 8px ${activeColor})`, `drop-shadow(0 0 2px ${activeColor})`]
                      }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    />

                    {/* Bounce interaction vector line helper */}
                    <path 
                      d={isModeratorTurn ? "M 250 60 L 250 160" : isAgentAActive ? "M 460 130 L 40 90" : "M 40 90 L 460 130"}
                      fill="none" 
                      stroke="rgba(0, 255, 65, 0.15)" 
                      strokeWidth="1.5"
                      strokeDasharray="4,2" 
                    />

                    {/* Collision Impact Wave Rings */}
                    <AnimatePresence>
                      <motion.circle
                        key={currentIdx}
                        cx={ballX}
                        cy={ballY}
                        r="24"
                        fill="none"
                        stroke={activeColor}
                        strokeWidth="1.5"
                        initial={{ opacity: 0.8, scale: 0.1 }}
                        animate={{ opacity: 0, scale: 1.5 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                      />
                    </AnimatePresence>
                  </svg>
                </div>

                {/* Turn Info Footer */}
                <div className="flex justify-between items-center text-[10px] font-mono border-t border-white/10 pt-2 bg-black/60 px-2" id="turn-info-footer">
                  <span className="text-slate-400">ACTIVE: <strong style={{ color: activeColor }}>{senderDisplay.name}</strong></span>
                  <span className="text-[#00FF41] font-bold">CONVICTION INDEX: {currentTurn?.convictionScore}%</span>
                </div>

              </div>

              {/* Sidebar: Replay Stats Panels */}
              <div className="flex flex-col gap-4" id="replay-sidebar">
                {/* Active Sub-topic Redirect Directive indicator */}
                <div className="border border-amber-500/30 bg-amber-500/5 p-3 rounded-sm flex flex-col gap-1 text-left">
                  <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="h-3 w-3 text-amber-500" />
                    REFEREE SHIFT TARGET
                  </span>
                  <span className="text-[10px] font-mono text-zinc-300 leading-relaxed">
                    {curRefEval?.pivotingDirective ? curRefEval.pivotingDirective : "No sub-topic redirection enforced. General topic debate mode active."}
                  </span>
                </div>

                {/* Score Indicators Gauge */}
                <div className="border border-neutral-800 bg-neutral-950 p-3 rounded-sm space-y-3 font-mono">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block text-left">
                    JUDGE EVALUATION RATINGS
                  </span>
                  {curRefEval ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#00FFFF]">Intellect Rate</span>
                        <span className="font-extrabold text-white">{curRefEval.intellectScore}/100</span>
                      </div>
                      <div className="w-full bg-neutral-900 h-1.5">
                        <div className="bg-[#00FFFF] h-full" style={{ width: `${curRefEval.intellectScore}%` }}></div>
                      </div>

                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#FF1493]">Precision Rate</span>
                        <span className="font-extrabold text-white">{curRefEval.precisionScore}/100</span>
                      </div>
                      <div className="w-full bg-neutral-900 h-1.5">
                        <div className="bg-[#FF1493] h-full" style={{ width: `${curRefEval.precisionScore}%` }}></div>
                      </div>

                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#00FF41]">Rhetoric Rate</span>
                        <span className="font-extrabold text-white">{curRefEval.rhetoricScore}/100</span>
                      </div>
                      <div className="w-full bg-neutral-900 h-1.5">
                        <div className="bg-[#00FF41] h-full" style={{ width: `${curRefEval.rhetoricScore}%` }}></div>
                      </div>

                      <div className="pt-1.5 border-t border-white/5 flex flex-wrap items-center gap-1.5 justify-between">
                        <span className="text-[10px] text-slate-500 uppercase">Verdict Goal achieved</span>
                        <span className={`text-[10px] font-black uppercase px-1 rounded-sm ${curRefEval.isScoreGoal ? 'bg-[#00FF41] text-black' : 'border border-zinc-700 text-zinc-400'}`}>
                          {curRefEval.isScoreGoal ? "AWARDED" : "PARRIED"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-600 italic block text-center py-4">No active referee response matrix on this turn.</span>
                  )}
                </div>
              </div>

            </div>

            {/* Playback Progress Slider Track */}
            <div className="border border-white/20 p-4 bg-neutral-950 font-mono flex flex-col gap-3" id="timeline-scrub-bar">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-ping" />
                  REPLAY SEQUENCE INDEX: <strong className="text-white">TURN {currentIdx + 1} OF {totalTurns}</strong>
                </span>
                <span>COMPLETION: {Math.round(((currentIdx + 1) / totalTurns) * 100)}%</span>
              </div>

              {/* Range Input slider */}
              <input 
                id="replay-turn-scrubber"
                aria-label="Replay turn scrubber"
                aria-valuetext={`Turn ${currentIdx + 1} of ${totalTurns}`}
                type="range"
                min="0"
                max={totalTurns - 1}
                value={currentIdx}
                onChange={(e) => {
                  setCurrentIdx(parseInt(e.target.value));
                  setIsPlaying(false);
                }}
                className="w-full h-1 bg-neutral-800 appearance-none cursor-pointer accent-[#00FF41] focus:outline-none"
              />

              {/* Playback Control Button Deck */}
              <div className="flex flex-wrap justify-between items-center gap-3 pt-2" id="playback-deck">
                <div className="flex items-center gap-2">
                  <button
                    id="replay-reset-btn"
                    aria-label="Jump to first replay turn"
                    onClick={handleReset}
                    className="p-1.5 border border-white hover:bg-neutral-900 text-white cursor-pointer rounded-sm"
                    title="Jump to Start"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    id="replay-prev-btn"
                    aria-label="Previous replay turn"
                    onClick={handlePrev}
                    disabled={currentIdx === 0}
                    className="p-1.5 border border-white hover:bg-neutral-900 text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
                    title="Previous Turn"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {isPlaying ? (
                    <button
                      id="replay-pause-btn"
                      aria-label="Pause replay autoplay"
                      onClick={() => setIsPlaying(false)}
                      className="bg-amber-500 hover:bg-white text-black font-extrabold px-4 py-1.5 text-xs uppercase transition-colors flex items-center gap-1.5 cursor-pointer rounded-sm"
                    >
                      <Pause className="h-3.5 w-3.5 fill-black" /> Pause
                    </button>
                  ) : (
                    <button
                      id="replay-autoplay-btn"
                      aria-label="Start replay autoplay"
                      onClick={() => {
                        if (currentIdx >= totalTurns - 1) {
                          setCurrentIdx(0);
                        }
                        setIsPlaying(true);
                      }}
                      className="bg-[#00FF41] hover:bg-white text-black font-extrabold px-4 py-1.5 text-xs uppercase transition-colors flex items-center gap-1.5 cursor-pointer rounded-sm"
                    >
                      <Play className="h-3.5 w-3.5 fill-black" /> Auto Play
                    </button>
                  )}

                  <button
                    id="replay-next-btn"
                    aria-label="Next replay turn"
                    onClick={handleNext}
                    disabled={currentIdx === totalTurns - 1}
                    className="p-1.5 border border-white hover:bg-neutral-900 text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
                    title="Next Turn"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-[10px] uppercase text-zinc-500">
                  Volley Vol: {history.length} records.
                </div>
              </div>
            </div>

            {/* Row 3: Dialogue Speech & Referee Comments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="replay-debate-transcripts">
              
              {/* Dialogue Transcript Speech Bubble */}
              <div 
                className="border border-white p-4 text-left relative bg-neutral-950 flex flex-col justify-between" 
                id="replay-dialogue-box"
              >
                <div className="absolute -top-3 left-4 bg-black px-2 text-[10px] tracking-wider text-cyan-400 uppercase font-black font-mono">
                  TRANSMITTED ARGUMENT RESPONSE
                </div>
                
                <div className="space-y-2 mt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-black">{senderDisplay.avatar}</span>
                    <span className="text-xs font-black uppercase text-white tracking-wide" style={{ color: activeColor }}>
                      {senderDisplay.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">({currentTurn?.timestamp})</span>
                  </div>
                  
                  <p className="font-mono text-[11px] text-zinc-200 leading-relaxed max-h-[120px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                    {currentTurn?.content}
                  </p>
                </div>

                {currentTurn?.proposal && (
                  <div className="border border-dashed border-white/20 p-2 bg-black mt-3 text-left">
                    <span className="block text-[10px] font-mono text-[#00FF41] uppercase tracking-widest font-black">PROPOSAL FORMULATED:</span>
                    <span className="text-[10px] font-mono text-white italic">"{currentTurn.proposal}"</span>
                  </div>
                )}
              </div>

              {/* Referee Verdict & Spectators */}
              <div className="border border-white p-4 text-left relative bg-neutral-950 flex flex-col justify-between gap-3" id="replay-referee-box">
                <div className="absolute -top-3 left-4 bg-black px-2 text-[10px] tracking-wider text-rose-400 uppercase font-black font-mono">
                  REFEREE RESOLUTION & CHATTER
                </div>

                {/* Verdict text */}
                <div className="flex-1 space-y-2 text-left mt-1">
                  <div className="text-[10px] font-mono text-zinc-400">
                    <span className="text-rose-400 font-extrabold uppercase">REFEREE QUOTE:</span>{" "}
                    <span className="italic block pl-2 border-l border-zinc-700 mt-1 text-zinc-300">
                      "{curRefEval?.verdictComment ? curRefEval.verdictComment : "No grading assessment recorded for this turn."}"
                    </span>
                  </div>

                  {/* Spectators Chatter loop */}
                  <div className="pt-2 border-t border-white/5 space-y-1 max-h-[100px] overflow-y-auto">
                    <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest block">SPECTATOR DIRECTIVES:</span>
                    {curReactions && curReactions.length > 0 ? (
                      curReactions.map((react, rIdx) => (
                        <div key={rIdx} className="text-[10px] font-mono text-white leading-tight">
                          <span className="text-zinc-500">{react.avatar} {react.spectatorName}:</span> <span className="text-zinc-300">{react.comment}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-600 block pl-2">No active spectator shouts stored on this turn.</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
};
