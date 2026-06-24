import { useState, useEffect } from "react";
import { Trophy, Globe, Cpu, BarChart2, Star, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RadarProfileChart } from "./RadarProfileChart";

interface LeaderboardRow {
  modelName: string;
  provider: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  goalsAgainst: number;
  blueprintsApproved: number;
  avgConviction: number;
  winRatio: number;
  rating: number;
}

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

export function LeaderboardAndMatches() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [lbRes, mRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/match/list")
      ]);

      if (!lbRes.ok || !mRes.ok) {
        throw new Error("Failed to receive data from backend servers.");
      }

      const lbData = await lbRes.json();
      const mData = await mRes.json();

      if (lbData.success) {
        setLeaderboard(lbData.leaderboard);
      }
      if (mData.success) {
        setMatches(mData.matches);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while synchronizing state.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="w-full bg-black border-4 border-white p-6 relative shadow-[0_0_20px_rgba(255,255,255,0.05)] text-white font-mono" id="leaderboard-module">
      <div className="absolute -top-3 left-6 bg-black px-3 py-0.5 text-xs tracking-widest text-[#00FF41] font-bold border-2 border-white flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5 shrink-0 animate-bounce" />
        <span>GLOBAL LLM ARENA LEADERBOARD</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/20 pb-4 mt-2">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[#00FF41]">MODEL CHAMPIONSHIPS</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
            Ranked dynamically by general debate ratings, win-ratios, and codified consensus blueprints.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 self-start md:self-auto px-4 py-1.5 border border-white bg-white/5 hover:bg-white text-white hover:text-black transition-colors font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>Synchronize Rankings</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs tracking-wider text-slate-400 uppercase animate-pulse">
          Synchronizing neural state logs, registering matches...
        </div>
      ) : error ? (
        <div className="border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-400 uppercase tracking-wide">
          <p className="font-bold">Error syncing data stream:</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Rankings Section (Span 7) */}
          <div className="xl:col-span-7 space-y-4">
            <div className="flex items-center gap-1.5 text-[10px] text-[#00FF41] font-bold tracking-wider uppercase mb-2">
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Rankings Registry</span>
            </div>

            <div className="overflow-x-auto border border-white/10 bg-neutral-950">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/20 bg-neutral-900 text-[10px] uppercase text-slate-400">
                    <th className="py-3 px-3 w-12 text-center">RANK</th>
                    <th className="py-3 px-2">MODEL ENGINE</th>
                    <th className="py-3 px-2 text-center">RATING</th>
                    <th className="py-3 px-2 text-center">W / D / L</th>
                    <th className="py-3 px-2 text-center">RATIO</th>
                    <th className="py-3 px-2 text-center">BLUEPRINTS</th>
                    <th className="py-3 px-3 text-center">CONVICTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[10px] text-slate-500 uppercase">
                        No model statistics logged yet.
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((item, index) => {
                      const rank = index + 1;
                      const isTop3 = rank <= 3;
                      const rankColor = rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-slate-500";
                      
                      return (
                        <tr key={index} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 text-center font-bold">
                            <span className={isTop3 ? `${rankColor} text-sm flex items-center justify-center gap-0.5` : "text-slate-500"}>
                              {isTop3 && <Star className="w-3 h-3 fill-current shrink-0" />}
                              #{rank}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              {item.provider === "ollama" ? (
                                <Cpu className="w-3 h-3 text-[#FF4100] shrink-0" />
                              ) : (
                                <Globe className="w-3 h-3 text-blue-400 shrink-0" />
                              )}
                              <div>
                                <div className="font-bold text-white text-[11px] uppercase tracking-tight">{item.modelName}</div>
                                <div className="text-[10px] uppercase text-slate-500 font-mono tracking-widest">{item.provider} cluster</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-[#00FF41]">
                            {item.rating}
                          </td>
                          <td className="py-3 px-2 text-center font-mono text-slate-300 text-[10px]">
                            {item.wins}-{item.draws}-{item.losses}
                          </td>
                          <td className="py-3 px-2 text-center text-[11px] font-bold">
                            {item.winRatio}%
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="px-1.5 py-0.5 bg-neutral-900 border border-white/20 text-slate-300 text-[10px] rounded-sm font-bold">
                              {item.blueprintsApproved}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center text-[#00FF41] font-semibold">
                            {item.avgConviction}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* D3 Radar Personality Profile and Combinations Compare Chart */}
            <RadarProfileChart matches={matches} />

            <div className="bg-neutral-900/60 border border-white/10 p-3 text-[10px] uppercase leading-relaxed text-slate-400">
              <span className="text-[#00FF41] font-black mr-1">RATING SYSTEM FORMULA:</span>
              Ratings are generated instantly from win fractions (60%), approved model milestones (+4 per item), and average architectural conviction score weights (20%). Deploy custom models via training pipelines to disrupt the global ranking grid!
            </div>
          </div>

          {/* Matches Section (Span 5) */}
          <div className="xl:col-span-5 space-y-4">
            <div className="flex items-center gap-1.5 text-[10px] text-[#FF4100] font-bold tracking-wider uppercase mb-2">
              <Globe className="w-3.5 h-3.5" />
              <span>Public Matches Logs ({matches.length})</span>
            </div>

            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {matches.length === 0 ? (
                <div className="border border-white/10 p-6 text-center text-[10px] text-slate-500 uppercase">
                  No public matches published. Complete a debate run with public toggle on.
                </div>
              ) : (
                matches.map((match) => {
                  const isExpanded = selectedMatch === match.id;
                  
                  return (
                    <div 
                      key={match.id}
                      className={`border border-white/20 hover:border-white transition-all bg-neutral-950 p-4 font-mono select-none ${isExpanded ? "ring-1 ring-[#00FF41] border-[#00FF41]" : ""}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <span className="text-[10px] bg-white/10 text-slate-400 font-bold px-1.5 py-0.5 uppercase tracking-widest rounded-sm">
                            {match.timestamp}
                          </span>
                          <h4 
                            onClick={() => setSelectedMatch(isExpanded ? null : match.id)}
                            className="text-[12px] font-black uppercase text-white tracking-tight mt-2 hover:text-[#00FF41] cursor-pointer transition-colors leading-tight"
                          >
                            {match.topic}
                          </h4>
                        </div>
                        <div className="flex gap-1.5 shrink-0 font-mono text-[12px] text-center border-2 border-white/20 bg-black px-2 py-1 items-center font-bold">
                          <span className="text-[#00FF41]">{match.agentA.score}</span>
                          <span className="text-slate-500 text-[10px]">:</span>
                          <span className="text-[#FF4100]">{match.agentB.score}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] border-t border-b border-white/10 py-2.5">
                        <div className="border-r border-white/10 pr-2">
                          <div className="text-slate-500 uppercase text-[10px] tracking-wide">PADDLE A (WEST NET)</div>
                          <div className="font-bold text-white truncate uppercase">{match.agentA.name}</div>
                          <div className="text-slate-400 truncate text-[10px] uppercase">{match.agentA.model}</div>
                          <div className="text-[#00FF41] text-[10px] font-bold uppercase mt-1">{match.agentA.strategyBias} strategy</div>
                        </div>
                        <div className="pl-2">
                          <div className="text-slate-500 uppercase text-[10px] tracking-wide">PADDLE B (EAST NET)</div>
                          <div className="font-bold text-white truncate uppercase">{match.agentB.name}</div>
                          <div className="text-slate-400 truncate text-[10px] uppercase">{match.agentB.model}</div>
                          <div className="text-[#FF4100] text-[10px] font-bold uppercase mt-1">{match.agentB.strategyBias} strategy</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 text-[10px] uppercase text-slate-400">
                        <span>PONG CYCLES: {match.cycleCount}</span>
                        <span>Consensuses: {match.consensusCount}</span>
                        <button
                          onClick={() => setSelectedMatch(isExpanded ? null : match.id)}
                          className="text-[10px] font-bold hover:text-[#00FF41] text-indigo-400 uppercase tracking-widest underline"
                        >
                          {isExpanded ? "CLOSE DETAILS" : "EXPAND COMPRESSED BLUEPRINTS"}
                        </button>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-3 pt-3 border-t border-white/10 space-y-2 text-left"
                          >
                            <p className="text-[10px] text-[#00FF41] font-bold uppercase tracking-wider mb-2">
                              CODIFIED BLUEPRINT LAUNCH SPECIFICATION:
                            </p>
                            {match.finalizedTasks && match.finalizedTasks.length > 0 ? (
                              match.finalizedTasks.map((task, tid) => (
                                <div key={tid} className="bg-neutral-900 p-2 border-l-2 border-[#00FF41] text-[10px]">
                                  <div className="flex justify-between font-bold text-slate-200 uppercase">
                                    <span>{tid+1}. {task.title}</span>
                                    <span className="text-[#00FF41]">{task.confidence}%</span>
                                  </div>
                                  <p className="text-slate-400 text-[10px] mt-1 normal-case leading-relaxed">
                                    {task.summary}
                                  </p>
                                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 right">
                                    Signed: {task.approvedBy}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] text-slate-500 uppercase">
                                No specific consensus tasks were codified on this active network run due to early convergence.
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
