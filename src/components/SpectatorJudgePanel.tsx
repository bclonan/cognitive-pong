import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Scale, MessageSquare, Compass, TrendingUp } from "lucide-react";
import { DebateTurn } from "../types";
import { getTurnSenderDisplay } from "../utils/turnDisplay";
import { getLatestTurnJudgeState } from "../utils/judgeDisplay";

interface SpectatorJudgePanelProps {
  history: DebateTurn[];
  agentConfig: any;
  activeTrajectory: string | null;
  onClearTrajectory?: () => void;
}

export const SpectatorJudgePanel: React.FC<SpectatorJudgePanelProps> = ({
  history,
  agentConfig,
  activeTrajectory,
  onClearTrajectory,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Filter out any turn that has spectator reactions
  const allReactions = history.flatMap((t) =>
    (t.spectatorLiveReactions || []).map(r => ({
      ...r,
      turnId: t.id,
      senderName: getTurnSenderDisplay(t.sender, agentConfig).name,
      timestamp: t.timestamp,
    }))
  );

  const { latestTurn, evalData, previousEvaluationTurn } = getLatestTurnJudgeState(history);
  const evalSender = getTurnSenderDisplay(latestTurn?.sender, agentConfig).name;
  const previousEvalSender = previousEvaluationTurn
    ? getTurnSenderDisplay(previousEvaluationTurn.sender, agentConfig).name
    : null;

  // Keep chat scrolled down without moving the main arena viewport.
  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [allReactions.length]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="spectator-referee-grid">
      {/* SECTION 1: Grand Referee Jury Verdict */}
      <div 
        className="border-2 border-white bg-black p-4 flex flex-col relative" 
        id="grand-referee-verdict-box"
      >
        <div className="absolute -top-3 left-4 bg-black px-2 text-[10px] tracking-wider text-[#FF4100] uppercase font-bold flex items-center gap-1.5">
          <Scale className="h-3 w-3 text-amber-500" />
          ARENA GROUND REFEREE JUDGEMENT
        </div>

        {evalData ? (
          <div className="flex-1 flex flex-col justify-between" id="ref-eval-active">
            <div>
              {/* Verdict Header Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2 mb-3">
                <span className="text-[10px] text-zinc-500 font-mono">LATEST TURN EVALUATION: <span className="text-white">{evalSender}</span></span>
                {evalData.isScoreGoal ? (
                  <span className="bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse font-mono tracking-wider">
                    SCORE AWARDED
                  </span>
                ) : (
                  <span className="border border-zinc-700 text-zinc-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                    PARRIED / DEFENDED
                  </span>
                )}
              </div>

              {/* Verdict Scores Grid */}
              <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-3" id="scores-grid">
                <div className="border border-neutral-800 p-2 bg-neutral-950 text-center">
                  <div className="text-[10px] text-zinc-500 font-mono uppercase">Intellect</div>
                  <div className="text-lg font-black font-mono text-cyan-400">{evalData.intellectScore}</div>
                  <div className="w-full bg-neutral-900 h-1 mt-1 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full" style={{ width: `${evalData.intellectScore}%` }}></div>
                  </div>
                </div>
                
                <div className="border border-neutral-800 p-2 bg-neutral-950 text-center">
                  <div className="text-[10px] text-zinc-500 font-mono uppercase">Precision</div>
                  <div className="text-lg font-black font-mono text-rose-400">{evalData.precisionScore}</div>
                  <div className="w-full bg-neutral-900 h-1 mt-1 rounded-full overflow-hidden">
                    <div className="bg-rose-400 h-full" style={{ width: `${evalData.precisionScore}%` }}></div>
                  </div>
                </div>

                <div className="border border-neutral-800 p-2 bg-neutral-950 text-center">
                  <div className="text-[10px] text-zinc-500 font-mono uppercase">Rhetoric</div>
                  <div className="text-lg font-black font-mono text-emerald-400">{evalData.rhetoricScore}</div>
                  <div className="w-full bg-neutral-900 h-1 mt-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-400 h-full" style={{ width: `${evalData.rhetoricScore}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Referee Verdict Text */}
              <div className="border-l-2 border-[#00FF41] pl-3 py-1 bg-zinc-950 text-xs text-neutral-300 font-mono italic leading-relaxed mb-3">
                "{evalData.verdictComment}"
              </div>
            </div>

            {/* Trajectory Pivoting Alert */}
            {evalData.pivotingDirective && (
              <div className="border border-amber-500/20 bg-amber-500/5 p-2 rounded-sm text-[10px] text-amber-200 font-mono flex gap-2">
                <Compass className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-amber-400 font-bold uppercase tracking-wider block mb-0.5">Referee Directive Shift</span>
                  {evalData.pivotingDirective}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-600 font-mono text-xs">
            <Scale className="h-8 w-8 mb-2 opacity-30" />
            <span>
              {latestTurn ? "Latest volley has no referee evaluation yet." : "Grand Referee is analyzing the court..."}
            </span>
            <span className="text-[10px] text-zinc-700 mt-1">
              {previousEvaluationTurn && previousEvalSender
                ? `Previous verdict from ${previousEvalSender} remains in the transcript and replay, but is not shown as the current turn.`
                : "Scores and strategic redirects will appear following the opening debater's swing."}
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: Twitch-Style Spectator Live Chat Stream */}
      <div 
        className="border-2 border-white bg-black p-4 flex flex-col relative" 
        id="spectator-live-chat-box"
      >
        <div className="absolute -top-3 left-4 bg-black px-2 text-[10px] tracking-wider text-[#00FF41] uppercase font-bold flex items-center gap-1.5">
          <Users className="h-3 w-3 text-[#00FF41]" />
          ARENA SPECS STREAM CHAT
        </div>

        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain max-h-[190px] min-h-[190px] border border-neutral-900 bg-neutral-950 p-2 space-y-2 mt-1 scrollbar-thin scrollbar-thumb-zinc-800"
          id="chat-messages-scroll"
        >
          {allReactions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 text-[10px] font-mono leading-relaxed">
              <MessageSquare className="h-6 w-6 mb-1 opacity-20 text-[#00FF41]" />
              <span>THE ARENA CROWD IS AWAKENING</span>
              <span>Wait for arguments to spark spectator chat comments...</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {allReactions.map((reaction, i) => (
                <div key={i} className="text-[11px] font-mono leading-relaxed p-1 hover:bg-neutral-900 rounded transition-all">
                  <span className="text-emerald-500 mr-1">{reaction.avatar}</span>
                  <span className="text-zinc-400 font-extrabold mr-1.5 hover:text-white cursor-pointer">{reaction.spectatorName}:</span>
                  <span className="text-white break-words">{reaction.comment}</span>
                  <span className="text-[10px] text-neutral-600 float-right mt-0.5 ml-2">@{reaction.senderName.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE ROW: Current Active Trajectory Guidance indicator */}
      <AnimatePresence>
        {activeTrajectory && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="md:col-span-2 border-2 border-amber-400 bg-amber-950/10 p-3 flex flex-wrap items-center justify-between gap-3 relative"
            id="active-trajectory-indicator"
          >
            <div className="absolute -top-3 left-4 bg-amber-400 text-black px-2 py-0.5 text-[10px] tracking-wider font-extrabold uppercase">
              ACTUAL SUB-TOPIC TRAJECTORY SHIFT OVERRIDE
            </div>
            
            <div className="flex items-center gap-2 font-mono text-[11px] text-amber-200">
              <TrendingUp className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong className="text-amber-400 font-black">ACTIVE TRAJECTORY:</strong> {activeTrajectory}
              </span>
            </div>

            {onClearTrajectory && (
              <button
                id="clear-active-trajectory-button"
                aria-label="Clear active trajectory focus"
                onClick={onClearTrajectory}
                className="text-[10px] font-mono text-zinc-500 hover:text-amber-400 uppercase tracking-widest cursor-pointer px-1 border border-zinc-800 hover:border-amber-400 bg-zinc-950 transition-colors"
                title="Reset Trajectory focus to General Topic"
              >
                RESET FOCUS
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
