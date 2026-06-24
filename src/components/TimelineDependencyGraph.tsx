import React, { useState, useMemo, useRef, useEffect } from "react";
import { DebateTurn, FinalizedTask, AgentConfig } from "../types";
import { getTurnSenderDisplay, isAgentTurnSender } from "../utils/turnDisplay";
import { GitFork, ArrowUpRight, Zap, RefreshCw, Cpu, CheckSquare, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TimelineDependencyGraphProps {
  history: DebateTurn[];
  finalizedTasks: FinalizedTask[];
  agentConfig: AgentConfig;
}

interface NodeLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourceType: "turn" | "task";
  targetType: "turn" | "task";
  type: string; // e.g. "critique", "agreement", "realization", "consensus"
  color: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: "proposal" | "critique" | "rebuttal" | "agreement" | "task";
  sender: DebateTurn["sender"] | "consensus";
  senderName: string;
  timestamp: string;
  convictionScore: number;
  content: string;
  title?: string;
  vx?: number;
  vy?: number;
  x: number;
  y: number;
}

export const TimelineDependencyGraph: React.FC<TimelineDependencyGraphProps> = ({
  history,
  finalizedTasks,
  agentConfig,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"flow" | "matrix">("flow");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  // ResizeObserver for keeping the canvas/SVG coordinate space aligned
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width || 600);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute graph nodes and links based on history and consensus tasks
  const { nodes, links } = useMemo(() => {
    const calculatedNodes: GraphNode[] = [];
    const calculatedLinks: NodeLink[] = [];

    // Lane positioning bounds
    const graphWidth = Math.max(320, containerWidth);
    const colA_X = Math.max(60, Math.min(95, graphWidth * 0.18));       // Left Lane - Agent A
    const colB_X = Math.min(graphWidth - 70, Math.max(225, graphWidth - 110)); // Right Lane - Agent B
    const centerX = graphWidth / 2;     // Central Lane - Timeline/Tasks

    const verticalSpacing = 75; // px between steps
    const topOffset = 40;

    // 1. Build nodes for each debate turn
    history.forEach((turn, idx) => {
      const isAgentA = turn.sender === "agentA";
      const x = turn.sender === "moderator" ? centerX : isAgentA ? colA_X : colB_X;
      const y = topOffset + idx * verticalSpacing;
      const senderDisplay = getTurnSenderDisplay(turn.sender, agentConfig);

      calculatedNodes.push({
        id: turn.id,
        label: turn.proposal ? `Prop: ${turn.proposal}` : `${turn.type.toUpperCase()}`,
        type: turn.type,
        sender: turn.sender,
        senderName: senderDisplay.name,
        timestamp: turn.timestamp,
        convictionScore: turn.convictionScore,
        content: turn.content,
        title: turn.proposal,
        x,
        y,
      });

      // 2. Establish links to previous relevant proposal (dependency mapping)
      if (isAgentTurnSender(turn.sender) && (turn.type === "critique" || turn.type === "rebuttal" || turn.type === "agreement")) {
        // Find most recent opposite agent proposal turn
        const oppProposal = [...history]
          .slice(0, idx)
          .reverse()
          .find((t) => isAgentTurnSender(t.sender) && t.sender !== turn.sender && t.proposal);

        if (oppProposal) {
          calculatedLinks.push({
            id: `link-${oppProposal.id}-${turn.id}`,
            sourceId: oppProposal.id,
            targetId: turn.id,
            sourceType: "turn",
            targetType: "turn",
            type: turn.type,
            color: senderDisplay.color,
          });
        }
      }
    });

    // 3. Add finalized tasks as terminal nodes positioned in the center / downstream
    finalizedTasks.forEach((task, idx) => {
      // Offset y-axis so tasks appear somewhat distributed or aligned with their influencing turns
      let targetY = topOffset + Math.max(1, history.length) * verticalSpacing + (idx * 90);
      
      // If we know which turn influenced it, we can visually align it to be near that turn
      let sourceTurnIdx = -1;
      if (task.influencedByTurnId) {
        sourceTurnIdx = history.findIndex((t) => t.id === task.influencedByTurnId);
      }

      if (sourceTurnIdx !== -1) {
        // Place it vertically between this turn and the next step
        targetY = topOffset + sourceTurnIdx * verticalSpacing + 35;
      }

      calculatedNodes.push({
        id: task.id,
        label: task.title,
        type: "task",
        sender: "consensus",
        senderName: "Consensus Kernel",
        timestamp: task.timestamp,
        convictionScore: task.confidence,
        content: task.summary,
        title: task.title,
        x: centerX,
        y: targetY,
      });

      // Draw wire from influencing turn to this consensus milestone node
      if (task.influencedByTurnId) {
        calculatedLinks.push({
          id: `link-task-${task.influencedByTurnId}-${task.id}`,
          sourceId: task.influencedByTurnId,
          targetId: task.id,
          sourceType: "turn",
          targetType: "task",
          type: "consensus",
          color: "#00FFFF", // Cyan for consensus solidification
        });
      }
    });

    return { nodes: calculatedNodes, links: calculatedLinks };
  }, [history, finalizedTasks, agentConfig, containerWidth]);

  // Find currently selected node representation
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId);
  }, [nodes, selectedNodeId]);
  const clampedSelectedConviction = selectedNode
    ? Math.max(0, Math.min(100, selectedNode.convictionScore || 0))
    : 0;

  // Keep automatically selecting the latest added node if nothing is selected
  useEffect(() => {
    if (nodes.length === 0) {
      setSelectedNodeId(null);
      return;
    }
    if (!selectedNodeId || !nodes.some((node) => node.id === selectedNodeId)) {
      // select latest turn or task
      setSelectedNodeId(nodes[nodes.length - 1].id);
    }
  }, [nodes, selectedNodeId]);

  // Draw smooth cubic bezier or step paths between nodes
  const renderPath = (link: NodeLink) => {
    const sourceNode = nodes.find((n) => n.id === link.sourceId);
    const targetNode = nodes.find((n) => n.id === link.targetId);

    if (!sourceNode || !targetNode || isNaN(sourceNode.x) || isNaN(targetNode.x)) return null;

    const x1 = sourceNode.x;
    const y1 = sourceNode.y;
    const x2 = targetNode.x;
    const y2 = targetNode.y;

    const isHovered = hoveredNodeId === link.sourceId || hoveredNodeId === link.targetId;
    const isSelected = selectedNodeId === link.sourceId || selectedNodeId === link.targetId;

    // Elegant high-curvature bezier curve
    const dx = Math.abs(x2 - x1);
    const controlX = x1 + (x2 > x1 ? dx * 0.5 : -dx * 0.5);
    const pathD = `M ${x1} ${y1} C ${controlX} ${y1}, ${controlX} ${y2}, ${x2} ${y2}`;

    let strokeWidth = 1.5;
    let opacity = 0.45;
    if (isHovered) {
      strokeWidth = 3;
      opacity = 0.9;
    } else if (isSelected) {
      strokeWidth = 2.5;
      opacity = 0.8;
    }

    // Glow effects or unique colors for relation types
    let strokeColor = link.color;
    if (link.type === "consensus") {
      strokeColor = "#00FFFF";
    }

    return (
      <g key={link.id}>
        {/* Glow backdrop for highlighted lines */}
        {(isHovered || isSelected) && (
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth + 4}
            opacity={0.25}
            className="transition-all duration-300"
          />
        )}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          strokeDasharray={link.type === "consensus" ? "none" : "5,4"}
          className="transition-all duration-300"
        />
        {/* Animated flow feedback circles drifting along the connections */}
        {(isHovered || isSelected || link.type === "consensus") && (
          <path
            d={pathD}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            opacity={0.6}
            strokeDasharray="8, 50"
            strokeDashoffset="100"
            className="animate-[dash_1.8s_linear_infinite]"
          />
        )}
      </g>
    );
  };

  const selectNodeByKeyboard = (event: React.KeyboardEvent, nodeId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedNodeId(nodeId);
    }
  };

  return (
    <div
      className="border-2 border-white bg-black p-5 flex flex-col gap-4 relative overflow-hidden"
      id="timeline-dependency-dashboard"
    >
      {/* Absolute Cyberpunk Title */}
      <div className="absolute -top-3 left-4 bg-[#FF4100] text-black px-2 py-0.5 text-xs tracking-widest uppercase font-black">
        COGNITIVE DEPENDENCY TIMELINE
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/20 pb-3 gap-2">
        <div className="space-y-0.5">
          <h4 className="text-xs font-black uppercase text-[#00FF41] tracking-wider flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 animate-pulse" /> Live Schema Trace Generator
          </h4>
          <p className="text-xs text-slate-500 font-mono uppercase">
            Resolving conversational state dependencies & compiled milestone anchors
          </p>
        </div>

        {/* View Switch / Controls */}
        <div className="flex border border-white/20 bg-black overflow-hidden rounded text-xs font-mono self-start sm:self-center">
          <button
            id="trace-topology-flow-button"
            type="button"
            aria-pressed={activeTab === "flow"}
            onClick={() => setActiveTab("flow")}
            className={`px-2.5 py-1 font-bold uppercase cursor-pointer transition-all ${
              activeTab === "flow" ? "bg-white text-black font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            TOPOLOGY FLOW
          </button>
          <button
            id="trace-dependency-ranges-button"
            type="button"
            aria-pressed={activeTab === "matrix"}
            onClick={() => setActiveTab("matrix")}
            className={`px-2.5 py-1 font-bold uppercase cursor-pointer transition-all ${
              activeTab === "matrix" ? "bg-white text-black font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            DEPENDENCY RANGES
          </button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-xs font-mono space-y-4 border border-white/5 bg-neutral-950/40">
          <RefreshCw className="h-6 w-6 text-slate-600 animate-spin" />
          <div className="space-y-1">
            <p className="uppercase text-slate-400 font-bold tracking-widest text-xs">Awaiting Active Argument Output</p>
            <p className="text-xs text-slate-500 uppercase max-w-sm">
              As the multi-agent Pong tournament executes, every paddle crash compiles dynamic claim dependency structures mapping straight onto milestones.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" ref={containerRef}>
          {/* Main Graph Grid Column (left 7 spans) */}
          <div className="lg:col-span-7 flex flex-col bg-neutral-950 border border-white/10 p-3 relative rounded-sm min-h-[380px] max-h-[520px] overflow-y-auto overflow-x-hidden scrollbar-thin select-none">
            {activeTab === "flow" ? (
              <div className="relative w-full" style={{ height: `${Math.max(280, 80 + Math.max(history.length, finalizedTasks.length) * 75 + finalizedTasks.length * 40)}px` }}>
                {/* SVG link canvas strictly absolute behind */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ minHeight: "100%" }}
                >
                  {/* Outer gradient definitions */}
                  <defs>
                    <linearGradient id="neon-cyan" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00FFFF" />
                      <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                  </defs>
                  
                  {/* Connecting Bezier paths */}
                  {links.map((link) => renderPath(link))}
                </svg>

                {/* Render Column headers */}
                <div className="absolute top-0 left-0 w-full flex justify-between px-2 text-xs font-mono text-slate-500 font-bold tracking-widest pointer-events-none uppercase">
                  <span>{agentConfig.agentA.name}</span>
                  <span className="absolute left-1/2 transform -translate-x-1/2 text-cyan-400">SYSTEM AGREEMENTS</span>
                  <span>{agentConfig.agentB.name}</span>
                </div>

                {/* Vertical timeline channel */}
                <div className="absolute left-1/2 top-4 bottom-4 w-[1px] bg-white/5 transform -translate-x-1/2 pointer-events-none" />

                {/* Active graphical nodes */}
                {nodes.map((node) => {
                  const isTurn = node.type !== "task";
                  const isAgentA = node.sender === "agentA";
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;

                  // Define borders & glows depending on node role
                  let glowColor = "rgba(148, 163, 184, 0.25)";
                  let themeBorder = "border-slate-500";
                  let specColor = "text-white";
                  let bgFill = "bg-neutral-900";

                  if (node.type === "proposal") {
                    glowColor = isAgentA ? "rgba(0, 255, 65, 0.45)" : "rgba(255, 65, 0, 0.45)";
                    themeBorder = isAgentA ? "border-[#00FF41]" : "border-[#FF4100]";
                    specColor = isAgentA ? "text-[#00FF41]" : "text-[#FF4100]";
                  } else if (node.type === "critique" || node.type === "rebuttal") {
                    glowColor = isAgentA ? "rgba(16, 185, 129, 0.3)" : "rgba(220, 38, 38, 0.3)";
                    themeBorder = isAgentA ? "border-emerald-500" : "border-red-600";
                    specColor = isAgentA ? "text-emerald-400" : "text-red-500";
                    if (node.sender === "moderator") {
                      glowColor = "rgba(251, 191, 36, 0.35)";
                      themeBorder = "border-amber-400";
                      specColor = "text-amber-300";
                    }
                  } else if (node.type === "agreement") {
                    glowColor = "rgba(234, 179, 8, 0.35)";
                    themeBorder = "border-yellow-500 animate-pulse";
                    specColor = "text-yellow-400";
                  } else if (node.type === "task") {
                    glowColor = "rgba(6, 182, 212, 0.5)";
                    themeBorder = "border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]";
                    specColor = "text-cyan-400";
                    bgFill = "bg-cyan-950/20";
                  }

                  // Coordinate translations
                  const pxX = node.x;
                  const pxY = node.y;

                  return (
                    <div
                      key={node.id}
                      id={`graph-node-${node.id}`}
                      style={{
                        position: "absolute",
                        left: `${pxX}px`,
                        top: `${pxY}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                      className="z-20 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`Inspect ${node.senderName} ${node.type} node`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedNodeId(node.id)}
                      onKeyDown={(event) => selectNodeByKeyboard(event, node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      <motion.div
                        className={`p-2 rounded-sm border-2 ${bgFill} ${themeBorder} flex flex-col justify-center items-center transition-all ${
                          isSelected ? "scale-110 !border-white" : ""
                        } ${isHovered ? "brightness-125" : ""}`}
                        style={{
                          width: isTurn ? "44px" : "150px",
                          height: isTurn ? "44px" : "48px",
                          boxShadow: isSelected || isHovered ? `0 0 14px ${glowColor}` : "none",
                        }}
                      >
                        {isTurn ? (
                          // Argument icon trigger representation
                          <div className={`flex flex-col items-center ${specColor}`}>
                            {node.type === "proposal" ? (
                              <PlusCircle className="h-4 w-4 shrink-0" />
                            ) : node.type === "critique" ? (
                              <GitFork className="h-4 w-4 shrink-0" />
                            ) : node.type === "rebuttal" ? (
                              <ArrowUpRight className="h-4 w-4 shrink-0" />
                            ) : (
                              <Zap className="h-4 w-4 shrink-0" />
                            )}
                            <span className="text-[10px] font-mono font-bold mt-1 uppercase tracking-tight">
                              C:{node.convictionScore}
                            </span>
                          </div>
                        ) : (
                          // Finished blueprint task rectangular representation
                          <div className="w-full text-center truncate space-y-1">
                            <div className="flex items-center justify-center gap-1.5 text-cyan-400">
                              <CheckSquare className="h-3 w-3 shrink-0" />
                              <span className="text-[10px] font-black uppercase tracking-wider">CONSENSUS</span>
                            </div>
                            <p className="text-[10px] text-white truncate font-bold uppercase font-mono px-1">
                              {node.title}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Matrix Grid Relationship ranges view
              <div className="space-y-4 font-mono text-xs text-slate-300">
                <p className="text-xs uppercase text-slate-500 border-b border-white/5 pb-2">
                  Cognitive Influence Mapping: Matrix of agent arguments and matched finalized outputs.
                </p>

                <div className="space-y-3 split-range max-h-[360px] overflow-y-auto">
                  {finalizedTasks.length === 0 ? (
                    <div
                      id="dependency-matrix-empty-state"
                      className="border border-dashed border-white/10 bg-black p-5 text-center text-xs text-slate-500 uppercase"
                    >
                      No finalized consensus plans yet. Matrix rows appear after a scored milestone is locked.
                    </div>
                  ) : finalizedTasks.map((task, idx) => {
                    const matchTurn = history.find((t) => t.id === task.influencedByTurnId);
                    return (
                      <div
                        key={task.id}
                        id={`dependency-matrix-task-${task.id}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Inspect consensus plan ${idx + 1}: ${task.title}`}
                        aria-pressed={selectedNodeId === task.id}
                        onClick={() => setSelectedNodeId(task.id)}
                        onKeyDown={(event) => selectNodeByKeyboard(event, task.id)}
                        className={`p-3 border rounded-sm transition-all cursor-pointer ${
                          selectedNodeId === task.id
                            ? "bg-cyan-950/15 border-cyan-400"
                            : "bg-black hover:bg-neutral-900 border-white/10"
                        }`}
                      >
                        <div className="flex justify-between items-center font-bold text-xs">
                          <span className="text-cyan-400 uppercase">CONSENSUS PLAN #{idx + 1}</span>
                          <span className="text-slate-500 text-[10px]">{task.timestamp}</span>
                        </div>
                        <h4 className="text-[11px] font-extrabold text-white uppercase mt-1">
                          {task.title}
                        </h4>

                        {matchTurn ? (
                          <div className="mt-2 pt-2 border-t border-white/5 font-mono text-xs bg-black/40 p-2 text-slate-400 leading-relaxed uppercase rounded">
                            <span className="font-extrabold text-[#00FF41]">ORIGINATING INFLUENCE TURN ({getTurnSenderDisplay(matchTurn.sender, agentConfig).name}):</span>
                            <p className="text-white font-semibold mt-1">
                              "{matchTurn.proposal || matchTurn.content.slice(0, 120)}..."
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mt-1">
                              <span>CONVICTION: {matchTurn.convictionScore}%</span>
                              <span>TYPE: {matchTurn.type.toUpperCase()}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-yellow-500/80 uppercase mt-2">
                            No active single-turn trace path loaded (General Topic Convergence).
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Node Inspect panel (right 5 spans) */}
          <div className="lg:col-span-5 flex flex-col font-mono" id="node-inspector-pane">
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div
                  key={selectedNode.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="bg-neutral-950 border border-white/10 p-4 rounded-sm flex-grow flex flex-col gap-3 min-h-[350px]"
                >
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-400 uppercase font-black">
                      NODE_INSPECTOR
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {selectedNode.timestamp}
                    </span>
                  </div>

                  {/* Header metadata */}
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      ORIGIN SOURCE / CONTRIBUTOR
                    </span>
                    <h5
                      className={`text-xs font-black uppercase tracking-tight ${
                        selectedNode.sender === "agentA"
                          ? "text-[#00FF41]"
                          : selectedNode.sender === "agentB"
                          ? "text-[#FF4100]"
                          : selectedNode.sender === "moderator"
                          ? "text-amber-300"
                          : "text-cyan-400"
                      }`}
                    >
                      {selectedNode.senderName}
                    </h5>
                  </div>

                  {/* Conviction score display */}
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      CONVICTION / CONFIDENCE METRIC
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-white text-base font-black">
                        {clampedSelectedConviction}%
                      </span>
                      <div className="h-2 flex-grow bg-neutral-900 border border-white/10 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full ${
                            selectedNode.sender === "agentA"
                              ? "bg-[#00FF41]"
                              : selectedNode.sender === "agentB"
                              ? "bg-[#FF4100]"
                              : selectedNode.sender === "moderator"
                              ? "bg-amber-400"
                              : "bg-cyan-400"
                          }`}
                          style={{ width: `${clampedSelectedConviction}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Core statement content / text block */}
                  <div className="flex-grow flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                      COGNITIVE TEXT & STATEMENT
                    </span>
                    <div className="p-2.5 bg-black text-xs leading-relaxed uppercase border-l-2 border-slate-500 text-slate-200 select-text overflow-y-auto max-h-[170px] scrollbar-thin select-text">
                      {selectedNode.content}
                    </div>
                  </div>

                  {/* Related trace statistics */}
                  <div className="pt-2 border-t border-white/5 text-xs text-slate-400 leading-normal space-y-1.5 uppercase">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Node Type Tag:</span>
                      <span className="text-white font-bold">{selectedNode.type.toUpperCase()}</span>
                    </div>

                    {selectedNode.type === "task" && (
                      <div className="text-xs bg-cyan-950/20 border border-cyan-500/20 p-2 text-cyan-300 leading-snug">
                        Approved as part of the permanent blueprint. Derived from scored proposals during the physical convergence match.
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="flex-grow flex items-center justify-center border border-dashed border-white/10 p-5 rounded text-center text-xs text-slate-500 uppercase min-h-[350px]">
                  Select any active node on the graph to inspect cognitive specifications and trace vectors.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};
