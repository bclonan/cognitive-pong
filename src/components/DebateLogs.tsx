import React, { useState, useEffect, useRef } from "react";
import { DebateTurn, AgentConfig } from "../types";
import { getTurnSenderDisplay } from "../utils/turnDisplay";
import { 
  MessageSquare, 
  CornerRightDown, 
  ExternalLink, 
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Tv,
  List
} from "lucide-react";

interface DebateLogsProps {
  history: DebateTurn[];
  agentConfig: AgentConfig;
  onOpenReplay?: () => void;
}

export const DebateLogs: React.FC<DebateLogsProps> = ({ history, agentConfig, onOpenReplay }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Replay states
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2 | 4>(1);

  // Auto-scroll logic: live scrolls to bottom, replay scrolls to active message
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      if (!isReplayMode) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      } else {
        const activeElement = document.getElementById(`debate-turn-replay-${currentIndex}`);
        if (activeElement) {
          const containerRect = container.getBoundingClientRect();
          const activeRect = activeElement.getBoundingClientRect();
          container.scrollTo({
            top: container.scrollTop + activeRect.top - containerRect.top - 16,
            behavior: "smooth",
          });
        }
      }
    }
  }, [history, isReplayMode, currentIndex]);

  // Handle auto-playing increment timer
  useEffect(() => {
    let intervalId: any;
    if (isPlaying && isReplayMode && history.length > 0) {
      const delay = 2000 / playbackSpeed;
      intervalId = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= history.length - 1) {
            if (isLooping) return 0;
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, isLooping, isReplayMode, playbackSpeed, history.length]);

  // Keep index within bounds if history changes
  useEffect(() => {
    if (history.length > 0 && currentIndex >= history.length) {
      setCurrentIndex(history.length - 1);
    }
  }, [history.length, currentIndex]);

  const toggleReplayMode = () => {
    if (history.length === 0) return;
    if (!isReplayMode) {
      // Entering Replay Mode: Default to beginning or end
      setCurrentIndex(0);
      setIsPlaying(false);
      setIsReplayMode(true);
    } else {
      // Exiting Replay Mode: Back to standard livestream
      setIsPlaying(false);
      setIsLooping(false);
      setIsReplayMode(false);
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "proposal":
        return "bg-black border-[#00FF41] text-[#00FF41]";
      case "critique":
        return "bg-black border-[#FF4100] text-[#FF4100]";
      case "rebuttal":
        return "bg-black border-white text-white";
      case "agreement":
        return "bg-[#00FF41] border-[#00FF41] text-black font-black";
      default:
        return "bg-black border-slate-500 text-slate-400";
    }
  };

  // Determine what list to render based on mode
  const displayedHistory = isReplayMode 
    ? history.slice(0, currentIndex + 1)
    : history;

  return (
    <div
      className="flex h-[520px] max-h-[70vh] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0A0D12] sm:h-[620px]"
      id="debate-logs-card"
      style={{ overflowAnchor: "none" }}
    >
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#0A0D12] px-5 py-4 border-b border-white/10 gap-3" id="debate-logs-header">
        <div className="flex items-center gap-2">
          {isReplayMode ? (
            <Tv className="h-5 w-5 text-[#00FF41] animate-pulse" />
          ) : (
            <MessageSquare className="h-5 w-5 text-[#FF7A3D]" />
          )}
          <h3 className="text-xl font-black tracking-tight text-slate-100">
            {isReplayMode ? "Replay Console" : "Rally Feed"}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Mode indicator badge */}
          <span className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${
            isReplayMode 
              ? "bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/40" 
              : "bg-white/5 text-slate-400 border-white/10"
          }`}>
            {isReplayMode ? "REPLAY ACTIVE" : "REAL-TIME"}
          </span>

          <button
            id="logs-replay-mode-toggle"
            aria-label={isReplayMode ? "Return logs to live feed mode" : "Open inline replay mode in logs"}
            aria-pressed={isReplayMode}
            onClick={toggleReplayMode}
            disabled={history.length === 0}
            className={`text-xs font-extrabold px-3 py-2 rounded-md cursor-pointer uppercase transition-colors flex items-center gap-1 border ${
              history.length === 0
                ? "bg-neutral-900 text-slate-600 border-neutral-800 cursor-not-allowed"
                : isReplayMode
                  ? "bg-white text-black border-white hover:bg-[#FF4100] hover:text-black hover:border-[#FF4100]"
                  : "bg-black text-[#00FF41] border-[#00FF41]/40 hover:bg-[#00FF41] hover:text-black hover:border-transparent"
            }`}
            title="Toggle between live dialogue streaming and scrolling time-travel replay player"
          >
            {isReplayMode ? <List className="h-3.5 w-3.5" /> : <Tv className="h-3.5 w-3.5" />}
            {isReplayMode ? "Live Feed" : "Replay"}
          </button>

          {onOpenReplay && (
            <button
              id="logs-visual-replay-button"
              aria-label="Open full visual replay"
              onClick={onOpenReplay}
              className="text-xs font-extrabold px-3 py-2 rounded-md cursor-pointer uppercase transition-all flex items-center gap-1 border bg-black text-amber-400 border-amber-500/40 hover:bg-amber-400 hover:text-black hover:border-transparent"
              title="Launch the visual replay overlay, including the empty replay state before turns exist"
            >
              <span>Visual Replay</span>
            </button>
          )}
        </div>
      </div>

      {/* Cybernetic Replay Tape Transport Bar */}
      {isReplayMode && history.length > 0 && (
        <div className="bg-[#111111] border-b border-white/20 p-3.5 space-y-3" id="replay-transport-control-bar">
          
          {/* Scrubber Range Input */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between items-center gap-2 text-[10px] font-mono text-slate-400 uppercase">
              <span className="text-[#00FF41] font-bold">SEEK SCRUBBER INDEX</span>
              <span className="text-white font-bold bg-[#222222] px-1.5 py-0.5 rounded-sm border border-white/10">
                CYCLE {(currentIndex + 1).toString().padStart(2, "0")} / {history.length.toString().padStart(2, "0")}
              </span>
            </div>
            
            <div className="relative flex items-center">
              <input
                id="logs-replay-scrubber"
                aria-label="Seek inline replay turn"
                aria-valuetext={`Turn ${currentIndex + 1} of ${history.length}`}
                type="range"
                min={0}
                max={history.length - 1}
                value={currentIndex}
                onChange={(e) => {
                  setCurrentIndex(parseInt(e.target.value, 10));
                  setIsPlaying(false); // pause on click/drag seek
                }}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#00FF41] focus:outline-none border border-white/5"
              />
            </div>
          </div>

          {/* Media Deck Playback Controls Grid */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/5">
            
            {/* Playback Buttons Group */}
            <div className="flex items-center gap-1.5" id="transport-decks">
              <button
                id="logs-replay-first-button"
                aria-label="Go to first replay turn"
                onClick={() => { setCurrentIndex(0); setIsPlaying(false); }}
                disabled={currentIndex === 0}
                className="p-1 px-1.5 bg-black border border-white/20 text-slate-300 hover:text-white hover:border-white disabled:opacity-30 disabled:pointer-events-none transition-all text-[10px] uppercase cursor-pointer"
                title="Rewind to turn zero"
              >
                <SkipBack className="h-3 w-3" />
              </button>

              <button
                id="logs-replay-previous-button"
                aria-label="Go to previous replay turn"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={currentIndex === 0}
                className="p-1 px-1.5 bg-black border border-white/20 text-slate-300 hover:text-white hover:border-white disabled:opacity-30 disabled:pointer-events-none transition-all text-[10px] uppercase cursor-pointer"
                title="Previous turn"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>

              <button
                id="logs-replay-play-pause-button"
                aria-label={isPlaying ? "Pause inline replay autoplay" : "Start inline replay autoplay"}
                aria-pressed={isPlaying}
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-1 px-2.5 border transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer ${
                  isPlaying 
                    ? "bg-[#FF4100] text-black border-[#FF4100] hover:bg-white hover:text-black hover:border-white animate-pulse" 
                    : "bg-[#00FF41] text-black border-[#00FF41] hover:bg-white hover:text-black hover:border-white"
                }`}
                title={isPlaying ? "Pause auto replay" : "Start auto play"}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3 w-3 fill-black text-black" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 fill-black text-black" /> PLAY
                  </>
                )}
              </button>

              <button
                id="logs-replay-next-button"
                aria-label="Go to next replay turn"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex((prev) => Math.min(history.length - 1, prev + 1));
                }}
                disabled={currentIndex === history.length - 1}
                className="p-1 px-1.5 bg-black border border-white/20 text-slate-300 hover:text-white hover:border-white disabled:opacity-30 disabled:pointer-events-none transition-all text-[10px] uppercase cursor-pointer"
                title="Next turn"
              >
                <ChevronRight className="h-3 w-3" />
              </button>

              <button
                id="logs-replay-last-button"
                aria-label="Go to last replay turn"
                onClick={() => { setCurrentIndex(history.length - 1); setIsPlaying(false); }}
                disabled={currentIndex === history.length - 1}
                className="p-1 px-1.5 bg-black border border-white/20 text-slate-300 hover:text-white hover:border-white disabled:opacity-30 disabled:pointer-events-none transition-all text-[10px] uppercase cursor-pointer"
                title="Fast forward to latest turn"
              >
                <SkipForward className="h-3 w-3" />
              </button>

              <button
                id="logs-replay-loop-button"
                aria-label={isLooping ? "Disable inline replay looping" : "Enable inline replay looping"}
                aria-pressed={isLooping}
                onClick={() => setIsLooping((value) => !value)}
                className={`p-1 px-2 border transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer ${
                  isLooping
                    ? "bg-cyan-300 text-black border-cyan-300 hover:bg-white"
                    : "bg-black text-cyan-200 border-cyan-300/40 hover:bg-cyan-300 hover:text-black"
                }`}
                title="Loop inline replay from the beginning after the final turn"
              >
                <Repeat className="h-3 w-3" /> LOOP
              </button>
            </div>

            {/* Playback Speed Multiplier Segment Selectors */}
            <div className="flex flex-wrap items-center gap-1" id="speed-selectors">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mr-1">SPEED</span>
              {([0.5, 1, 2, 4] as const).map((spd) => (
                <button
                  key={spd}
                  id={`logs-replay-speed-${String(spd).replace(".", "-")}`}
                  aria-label={`Set inline replay speed to ${spd}x`}
                  aria-pressed={playbackSpeed === spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`text-[10px] font-mono font-black border px-1.5 py-0.5 rounded-sm transition-all cursor-pointer ${
                    playbackSpeed === spd
                      ? "bg-[#00FF41] text-black border-transparent"
                      : "bg-black text-slate-400 border-white/10 hover:border-white/30"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Scrolling transcript list container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 sm:p-5"
        id="debate-logs-scroll"
        style={{ overflowAnchor: "none" }}
      >
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-slate-500 text-center gap-3">
            <div className="h-12 w-12 rounded-md border border-white/20 flex items-center justify-center bg-white/[0.03]">
              <MessageSquare className="h-5 w-5 text-slate-500" />
            </div>
            <div className="text-base tracking-wide font-black text-slate-300">No volleys yet</div>
            <p className="text-sm text-slate-500 max-w-[360px] leading-relaxed">
              Start the cognitive loop and each Pong shot will appear here as a claim, challenge, counterexample, or synthesis card.
            </p>
          </div>
        ) : (
          displayedHistory.map((turn, index) => {
            const senderDisplay = getTurnSenderDisplay(turn.sender, agentConfig);
            const isActiveReplayItem = isReplayMode && index === currentIndex;

            return (
              <div
                key={turn.id}
                id={isReplayMode ? `debate-turn-replay-${index}` : `debate-turn-${turn.id}`}
                className={`border rounded-lg overflow-hidden bg-black/70 transition-all duration-300 ${
                  isActiveReplayItem 
                    ? "border-opacity-100 shadow-[0_0_24px_rgba(0,255,65,0.18)] ring-2 ring-[#00FF41]/20 scale-[1.01]" 
                    : "border-opacity-60"
                } ${senderDisplay.borderClass}`}
              >
                {/* Message Header */}
                <div className={`px-4 py-3 flex items-center justify-between gap-3 ${senderDisplay.headerClass}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black">{senderDisplay.avatar}</span>
                    <span className="text-sm uppercase tracking-wide text-black font-black">
                      {senderDisplay.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {/* complexity badge */}
                    {turn.complexity && (
                      <span className={`font-mono text-[10px] font-black px-2 py-1 border rounded-full uppercase ${
                        turn.complexity === "complex simulation" ? "text-[#FF4100] border-[#FF4100]/30 bg-black/50" :
                        turn.complexity === "deep research" ? "text-cyan-400 border-cyan-400/30 bg-black/50" : "text-[#00FF41] border-[#00FF41]/30 bg-black/50"
                      }`}>
                        {turn.complexity}
                      </span>
                    )}
                    {/* Turn Marker */}
                    <span className="font-mono text-[10px] bg-black text-white px-2 py-1 rounded-full">
                      Volley {(index + 1).toString().padStart(2, "0")}
                    </span>
                    {/* type badge */}
                    <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded-full border uppercase ${getBadgeStyle(turn.type)}`}>
                      {turn.type}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  <p className="text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {turn.content}
                  </p>

                  {/* Highlights proposal if presented */}
                  {turn.proposal && (
                    <div className="bg-white/5 border-2 border-dashed border-[#00FF41] p-3 flex gap-2">
                      <CornerRightDown className="h-4 w-4 text-[#00FF41] mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[#00FF41] font-black">Consensus Proposal Point:</div>
                        <p className="text-[11px] text-[#00FF41] font-bold font-mono mt-1 uppercase">
                          &gt; {turn.proposal}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Grounding web sources */}
                  {turn.searchSources && turn.searchSources.length > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 mb-2 uppercase">
                        <Search className="h-3 w-3 text-[#00FF41]" />
                        <span>Google Search Grounding Sources:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {turn.searchSources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.uri}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            rel="noopener noreferrer"
                            className="max-w-full bg-neutral-900 border border-white/20 text-slate-400 hover:text-[#00FF41] hover:border-[#00FF41] px-2 py-1 text-[10px] font-mono transition-colors flex items-center gap-1"
                          >
                            <span>{source.title.length > 25 ? `${source.title.substring(0, 25)}...` : source.title}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gauge indicator */}
                  <div className="bg-neutral-950 border border-white/10 p-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">CONVICTION WEIGHT:</span>
                    <div className="flex-1 max-w-[120px] bg-neutral-900 h-1 relative">
                      <div
                        className={`h-full absolute left-0 top-0 transition-all duration-500 ${senderDisplay.barClass}`}
                        style={{ width: `${turn.convictionScore}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-mono font-black ${senderDisplay.textClass}`}>
                      {turn.convictionScore}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
