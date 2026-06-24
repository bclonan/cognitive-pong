import React, { useState } from "react";
import * as d3 from "d3";
import { FinalizedTask, DebateTurn, AgentConfig } from "../types";
import { Copy, ClipboardList, Download, FileJson, FileText } from "lucide-react";
import { getTurnSenderDisplay } from "../utils/turnDisplay";

interface ConsensusBoardProps {
  tasks: FinalizedTask[];
  topic: string;
  history?: DebateTurn[];
  agentConfig?: AgentConfig;
}

const Sparkline: React.FC<{ tasks: FinalizedTask[] }> = ({ tasks }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; title: string; index: number } | null>(null);

  const data = tasks.map((t, idx) => ({ x: idx, y: t.confidence, title: t.title }));
  
  if (data.length < 2) {
    return (
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 border border-white/10 px-2 py-1 bg-neutral-900/50 rounded-xs select-none" id="sparkline-placeholder">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span>SPARKLINE GRAPH PENDING (2+ MILESTONES)</span>
      </div>
    );
  }

  const width = 130;
  const height = 24;
  const padding = { top: 4, right: 4, bottom: 4, left: 4 };

  const xScale = d3.scaleLinear()
    .domain([0, data.length - 1])
    .range([padding.left, width - padding.right]);

  const yScale = d3.scaleLinear()
    .domain([0, 100])
    .range([height - padding.bottom, padding.top]);

  const lineGenerator = d3.line<{ x: number; y: number }>()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveMonotoneX);

  const linePath = lineGenerator(data) || "";

  const areaGenerator = d3.area<{ x: number; y: number }>()
    .x(d => xScale(d.x))
    .y0(height - padding.bottom)
    .y1(d => yScale(d.y))
    .curve(d3.curveMonotoneX);

  const areaPath = areaGenerator(data) || "";
  const firstVal = data[0].y;
  const latestVal = data[data.length - 1].y;
  const delta = latestVal - firstVal;
  const isPositive = delta >= 0;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    const rangeX = xScale.range();
    const fraction = (mouseX - rangeX[0]) / (rangeX[1] - rangeX[0]);
    const approxIndex = fraction * (data.length - 1);
    const closestIndex = Math.max(0, Math.min(data.length - 1, Math.round(approxIndex)));
    
    const pt = data[closestIndex];
    if (pt) {
      setHoveredPoint({
        x: pt.x,
        y: pt.y,
        title: pt.title,
        index: closestIndex
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div className="flex items-center gap-2 border border-white/10 px-2 py-1 bg-neutral-950 rounded-sm select-none relative group" id="sparkline-graph-wrapper">
      <div className="flex flex-col text-left font-mono text-[10px] tracking-tight shrink-0 leading-none">
        <span className="text-[10px] text-slate-500 uppercase">Delta</span>
        <span className={`font-black mt-0.5 flex items-center ${isPositive ? 'text-[#00FF41]' : 'text-rose-500'}`}>
          {isPositive ? "UP" : "DOWN"} {isPositive ? "+" : ""}{delta}%
        </span>
      </div>

      <div className="relative">
        <svg 
          width={width} 
          height={height} 
          className="overflow-visible cursor-crosshair stroke-neutral-800"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal middle dash guideline */}
          <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.04)" strokeDasharray="2,2" />
          
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "#00FF41" : "#FF1493"} stopOpacity="0.25" />
              <stop offset="100%" stopColor={isPositive ? "#00FF41" : "#FF1493"} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          <path d={areaPath} fill="url(#sparkGrad)" />
          
          <path
            d={linePath}
            fill="none"
            stroke={isPositive ? "#00FF41" : "#FF1493"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Individual milestone dots */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={xScale(d.x)}
              cy={yScale(d.y)}
              r={hoveredPoint?.index === i ? "3" : "1"}
              fill={hoveredPoint?.index === i ? "#ffffff" : isPositive ? "#00FF41" : "#FF1493"}
              className="transition-all duration-155"
            />
          ))}

          {/* Active hover crosshair vertical guide */}
          {hoveredPoint !== null && (
            <line
              x1={xScale(hoveredPoint.x)}
              y1={padding.top}
              x2={xScale(hoveredPoint.x)}
              y2={height - padding.bottom}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1"
              strokeDasharray="2,1"
            />
          )}
        </svg>

        {/* Hover Tooltip Popup floating above */}
        {hoveredPoint !== null && (
          <div className="absolute top-[-46px] left-1/2 -translate-x-1/2 bg-black border border-white text-white font-mono text-[10px] px-2 py-1 uppercase rounded-xs shadow-2xl pointer-events-none whitespace-nowrap z-50 flex flex-col items-center">
            <span className="text-[#00FF41] font-extrabold font-mono">MS {hoveredPoint.index + 1}: {hoveredPoint.y}% Pact</span>
            <span className="text-slate-400 text-[10px] max-w-[130px] truncate">{hoveredPoint.title}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col text-right font-mono text-[10px] tracking-tight shrink-0 index-info leading-none">
        <span className="text-[10px] text-slate-500 uppercase">Latest</span>
        <span className="font-extrabold text-white mt-0.5">{latestVal}%</span>
      </div>
    </div>
  );
};

const RadialGauge: React.FC<{ value: number }> = ({ value }) => {
  const radius = 18;
  const strokeWidth = 3;
  const normalizedRadius = radius - strokeWidth;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex items-center gap-2 border border-white/10 px-2.5 py-1 bg-neutral-900/40 rounded-sm select-none" id="consensus-radial-gauge">
      <div className="relative flex items-center justify-center shrink-0 w-9 h-9">
        <svg width="36" height="36" className="transform -rotate-90 overflow-visible">
          {/* Base Track */}
          <circle
            className="text-neutral-800"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={normalizedRadius}
            cx="18"
            cy="18"
          />
          {/* Active Radial Progress Fill */}
          <circle
            className="text-[#00FF41] transition-all duration-700 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={normalizedRadius}
            cx="18"
            cy="18"
          />
        </svg>
        <span className="absolute font-mono text-[10px] font-black text-[#00FF41]">{value}%</span>
      </div>
      <div className="flex flex-col font-mono text-[10px] text-slate-400 leading-none uppercase">
        <span className="font-extrabold text-[#00FF41] tracking-wider">Avg Pact</span>
        <span className="text-[10px] text-slate-500 mt-0.5">Agreement</span>
      </div>
    </div>
  );
};

export const ConsensusBoard: React.FC<ConsensusBoardProps> = ({ 
  tasks, 
  topic, 
  history = [], 
  agentConfig 
}) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const dataToExport = {
      arenaTopic: topic,
      exportedAt: new Date().toISOString(),
      agentA: {
        name: agentConfig?.agentA?.name || "Agent A",
        role: agentConfig?.agentA?.role || "Proponent",
        provider: agentConfig?.agentA?.provider || "mock",
        model: agentConfig?.agentA?.model || "mock-local",
        systemPrompt: agentConfig?.agentA?.systemPrompt || ""
      },
      agentB: {
        name: agentConfig?.agentB?.name || "Agent B",
        role: agentConfig?.agentB?.role || "Opponent",
        provider: agentConfig?.agentB?.provider || "mock",
        model: agentConfig?.agentB?.model || "mock-local",
        systemPrompt: agentConfig?.agentB?.systemPrompt || ""
      },
      finalizedMilestones: tasks.map((task, index) => ({
        index: index + 1,
        title: task.title,
        summary: task.summary,
        confidence: task.confidence,
        approvedBy: task.approvedBy,
        timestamp: task.timestamp,
        complexity: task.complexity
      })),
      debateTranscript: (history || []).map((turn) => {
        const senderDisplay = getTurnSenderDisplay(turn.sender, agentConfig);
        return {
          id: turn.id,
          sender: senderDisplay.name,
          role: senderDisplay.role,
          type: turn.type,
          content: turn.content,
          convictionScore: turn.convictionScore,
          timestamp: turn.timestamp,
          searchSources: turn.searchSources || []
        };
      })
    };

    downloadFile(
      JSON.stringify(dataToExport, null, 2),
      `debate-arena-export-${Date.now()}.json`,
      "application/json"
    );
  };

  const handleDownloadTXT = () => {
    let content = `============================================================\n`;
    content += `        AGENTIC DEBATE ARENA EXPORT & TRANSCRIPT            \n`;
    content += `============================================================\n\n`;
    content += `MASTER OBJECTIVE DIRECTIVE:\n`;
    content += `"${topic.toUpperCase()}"\n\n`;
    content += `Export Date : ${new Date().toLocaleString()}\n`;
    content += `Arena Status: Completed / Exported\n`;
    content += `------------------------------------------------------------\n\n`;

    content += `AGENT PROFILES:\n`;
    content += `1. ${agentConfig?.agentA?.name || "Agent A"} [Proponent]\n`;
    content += `   - Role: ${agentConfig?.agentA?.role || "N/A"}\n`;
    content += `   - Provider: ${agentConfig?.agentA?.provider || "mock"}\n`;
    content += `   - Model: ${agentConfig?.agentA?.model || "mock-local"}\n`;
    if (agentConfig?.agentA?.systemPrompt) {
      content += `   - Instructions: ${agentConfig?.agentA?.systemPrompt}\n`;
    }
    content += `2. ${agentConfig?.agentB?.name || "Agent B"} [Opponent]\n`;
    content += `   - Role: ${agentConfig?.agentB?.role || "N/A"}\n`;
    content += `   - Provider: ${agentConfig?.agentB?.provider || "mock"}\n`;
    content += `   - Model: ${agentConfig?.agentB?.model || "mock-local"}\n`;
    if (agentConfig?.agentB?.systemPrompt) {
      content += `   - Instructions: ${agentConfig?.agentB?.systemPrompt}\n`;
    }
    content += `\n------------------------------------------------------------\n`;
    content += `PART 1: FINALIZED CONSENSUS BLUEPRINTS (${tasks.length} Milestones)\n`;
    content += `------------------------------------------------------------\n\n`;

    if (tasks.length === 0) {
      content += `[ No finalized milestones locked in yet. ]\n\n`;
    } else {
      tasks.forEach((task, idx) => {
        content += `${(idx + 1).toString().padStart(2, "0")}. TITLE     : ${task.title.toUpperCase()}\n`;
        content += `    COMPLEXITY: ${task.complexity || "standard"}\n`;
        content += `    AGREEMENT : ${task.confidence}%\n`;
        content += `    APPROVED  : ${task.approvedBy}\n`;
        content += `    TIMESTAMP : ${task.timestamp}\n`;
        content += `    SUMMARY   : ${task.summary}\n\n`;
      });
    }

    content += `------------------------------------------------------------\n`;
    content += `PART 2: DIALOGUE ARGUMENT TRANSCRIPT PROTOCOL\n`;
    content += `------------------------------------------------------------\n\n`;

    const turns = history || [];
    if (turns.length === 0) {
      content += `[ Debate transcript stream is currently empty. ]\n\n`;
    } else {
      turns.forEach((turn, idx) => {
        const senderDisplay = getTurnSenderDisplay(turn.sender, agentConfig);
        
        content += `[TURN ${idx + 1}] [${turn.timestamp}] ${senderDisplay.name.toUpperCase()} (${senderDisplay.role.toUpperCase()})\n`;
        content += `Action Type : ${turn.type.toUpperCase()} (Conviction: ${turn.convictionScore}%)\n`;
        if (turn.searchSources && turn.searchSources.length > 0) {
          content += `Grounding   : ${turn.searchSources.map(s => s.title).join(", ")}\n`;
        }
        content += `------------------------------------------------------------\n`;
        content += `${turn.content}\n\n`;
      });
    }

    content += `============================================================\n`;
    content += `        END OF AGENTIC TRANSCRIPT DEBATE RECORD             \n`;
    content += `============================================================\n`;

    downloadFile(
      content,
      `debate-arena-transcript-${Date.now()}.txt`,
      "text/plain;charset=utf-8"
    );
  };

  const handleCopyMarkdown = async () => {
    if (tasks.length === 0) return;
    
    let md = `# DebatePong Blueprint: ${topic}\n\n`;
    md += `Generated via Agentic Consensus Arena on ${new Date().toLocaleDateString()}\n\n`;
    md += `## Finalized Consensus Architecture & Tasks\n\n`;
    
    tasks.forEach((task, idx) => {
      md += `### ${idx + 1}. ${task.title}\n`;
      md += `- **Approved by**: ${task.approvedBy}\n`;
      md += `- **Consensus Conviction**: ${task.confidence}%\n`;
      md += `- **Abstract**: ${task.summary}\n`;
      md += `- **Finalized**: ${task.timestamp}\n\n`;
    });
    
    try {
      await navigator.clipboard.writeText(md);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyError("Clipboard permission was blocked. Use Save TXT or Save JSON instead.");
      setTimeout(() => setCopyError(null), 3500);
    }
  };

  const handleExportConsensusPlan = () => {
    if (tasks.length === 0) return;
    const planToExport = {
      topic: topic,
      exportedAt: new Date().toISOString(),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        summary: task.summary,
        confidence: task.confidence,
        approvedBy: task.approvedBy,
        complexity: task.complexity,
        timestamp: task.timestamp
      }))
    };
    downloadFile(
      JSON.stringify(planToExport, null, 2),
      `consensus-plan-${Date.now()}.json`,
      "application/json"
    );
  };

  // Average confidence calculator
  const averageConfidence = tasks.length > 0 
    ? Math.round(tasks.reduce((acc, t) => acc + t.confidence, 0) / tasks.length) 
    : 0;

  return (
    <div className="bg-black border border-white/20 flex flex-col h-[520px] overflow-hidden" id="consensus-board-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-black px-5 py-3 border-b-2 border-white gap-2" id="consensus-board-header">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#00FF41]" />
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-[#00FF41]">Consensus Blueprint</h3>
          </div>
          <Sparkline tasks={tasks} />
          <RadialGauge value={averageConfidence} />
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5" id="consensus-actions">
          {tasks.length > 0 && (
            <>
              <button
                onClick={handleExportConsensusPlan}
                className="flex items-center gap-1.5 font-mono text-[10px] bg-[#00FF41] border border-[#00FF41] text-black font-extrabold px-2.5 py-1 uppercase hover:bg-white hover:text-black hover:border-white transition-all cursor-pointer animate-pulse shrink-0"
                title="Export finalized task list plan for external systems integration"
                id="export-consensus-plan-btn"
              >
                <Download className="h-2.5 w-2.5 stroke-[3.5px]" /> Export Consensus Plan
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1 font-mono text-[10px] bg-neutral-900 border border-white/35 text-slate-300 font-extrabold px-2 py-1 uppercase hover:bg-white hover:text-black hover:border-white transition-colors cursor-pointer shrink-0"
                title="Copy entire blueprint as Markdown document"
              >
                <Copy className="h-2.5 w-2.5" /> {copied ? "COPIED LOCK!" : "COPY MD"}
              </button>
            </>
          )}

          {(history.length > 0 || tasks.length > 0) && (
            <>
              <button
                onClick={handleDownloadTXT}
                className="flex items-center gap-1 font-mono text-[10px] bg-[#00FF41]/10 border border-[#00FF41]/40 text-[#00FF41] font-extrabold px-2 py-1 uppercase hover:bg-[#00FF41] hover:text-black transition-colors cursor-pointer"
                title="Download current debate dialogue transcript & task list as TXT report"
              >
                <FileText className="h-2.5 w-2.5" /> SAVE TXT
              </button>

              <button
                onClick={handleDownloadJSON}
                className="flex items-center gap-1 font-mono text-[10px] bg-[#FF4100]/10 border border-[#FF4100]/40 text-[#FF4100] font-extrabold px-2 py-1 uppercase hover:bg-[#FF4100] hover:text-black transition-colors cursor-pointer"
                title="Download current debate transcript & finalized milestones as structured JSON data"
              >
                <FileJson className="h-2.5 w-2.5" /> SAVE JSON
              </button>
            </>
          )}
        </div>
        {copyError && (
          <div
            id="consensus-copy-error"
            className="w-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-mono font-bold text-rose-300 uppercase"
          >
            {copyError}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 border-b border-white/20 bg-black text-xs font-mono" id="consensus-metrics">
        <div className="border-r border-white/20 p-4 text-center">
          <span className="text-slate-500 text-[10px] uppercase block tracking-wider mb-1">Locked Milestones</span>
          <span className="text-2xl font-black text-[#00FF41]">{tasks.length}</span>
        </div>
        <div className="p-4 text-center">
          <span className="text-slate-500 text-[10px] uppercase block tracking-wider mb-1">Avg Agreement Index</span>
          <span className="text-2xl font-black text-white">{averageConfidence}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" id="consensus-board-scroll">
        {tasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-slate-500 font-mono text-center gap-2">
            <div className="h-10 w-10 border border-white/20 flex items-center justify-center text-sm">
              <ClipboardList className="h-5 w-5 text-slate-500" />
            </div>
            <div className="text-[10px] tracking-widest font-bold">BLUEPRINT EMPTY</div>
            <p className="text-[10px] text-slate-500 max-w-[280px] uppercase leading-relaxed">
              When the physical Pong ball scoring triggers high agreement (&ge; 85%), statements are compiled as verified milestones here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task, index) => (
              <div
                key={task.id}
                className="bg-black border-2 border-white/20 p-4 relative overflow-hidden"
                id={`finalized-task-${task.id}`}
              >
                {/* Accent Line */}
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                  task.complexity === "complex simulation" ? "bg-[#FF4100]" :
                  task.complexity === "deep research" ? "bg-cyan-400" : "bg-[#00FF41]"
                }`} />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-6 w-6 text-black flex items-center justify-center text-xs font-mono font-black shrink-0 ${
                      task.complexity === "complex simulation" ? "bg-[#FF4100]" :
                      task.complexity === "deep research" ? "bg-cyan-400" : "bg-[#00FF41]"
                    }`}>
                      {(index + 1).toString().padStart(2, "0")}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-black text-white uppercase tracking-tight leading-snug">
                          {task.title}
                        </h4>
                        <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 border uppercase leading-none tracking-widest bg-black border ${
                          task.complexity === "complex simulation" ? "text-[#FF4100] border-[#FF4100]/30 animate-pulse" :
                          task.complexity === "deep research" ? "text-cyan-400 border-cyan-400/30" : "text-[#00FF41] border-[#00FF41]/30"
                        }`}>
                          {task.complexity || "quick lookup"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 font-mono leading-relaxed uppercase">
                        {task.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Task metadata footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 mt-4 text-[10px] font-mono text-slate-500">
                  <span className="flex items-center gap-1.5 uppercase">
                    <span className={`h-1.5 w-1.5 ${
                      task.complexity === "complex simulation" ? "bg-[#FF4100]" :
                      task.complexity === "deep research" ? "bg-cyan-400" : "bg-[#00FF41]"
                    }`} />
                    Approved by: <strong className="text-white font-bold">{task.approvedBy}</strong>
                  </span>
                  <span className="flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 text-white font-bold">
                    AGREEMENT: {task.confidence}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
