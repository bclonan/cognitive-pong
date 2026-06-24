import React, { useEffect, useRef, useState } from "react";
import { AgentConfig, DebateTurn, TurnSender } from "../types";
import { Zap, Search, Trophy, Brain } from "lucide-react";
import { SimpleNeuralNetwork } from "../utils/nn";

interface PongGameProps {
  history: DebateTurn[];
  agentConfig: AgentConfig;
  status: "idle" | "debating" | "paused" | "researching_A" | "researching_B" | "scoring_A" | "scoring_B" | "completed";
  onPaddleCollision: (selector: "agentA" | "agentB") => void;
  onGoalCompleted: (selector: "agentA" | "agentB") => void;
  scoreA: number;
  scoreB: number;
  latestScoreType: "consensus" | "rejection" | null;
  latestScoreText: string;
  gameSpeed: number; // 1 to 5
  currentComplexity: "quick lookup" | "deep research" | "complex simulation";
  deployedModel?: SimpleNeuralNetwork | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

// Deterministic court positioning for arguments based on turn metadata
const getSeededCoords = (id: string, index: number, sender: TurnSender) => {
  let hash = 0;
  if (id) {
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
  } else {
    hash = index * 12345;
  }
  hash = Math.abs(hash);
  
  // Left side for Agent A, right side for Agent B, center lane for moderator annotations.
  const xMin = sender === "agentA" ? 60 : sender === "agentB" ? 440 : 250;
  const xRange = sender === "moderator" ? 300 : 300;
  const x = xMin + (hash % xRange);
  
  // Y-axis spread leaving solid margins for safety
  const yMin = 50;
  const yRange = 350; // spread from 50 to 400
  const y = yMin + ((hash >> 2) % yRange);
  
  return { x, y };
};

export const PongGame: React.FC<PongGameProps> = ({
  history,
  agentConfig,
  status,
  onPaddleCollision,
  onGoalCompleted,
  scoreA,
  scoreB,
  latestScoreType,
  latestScoreText,
  gameSpeed,
  currentComplexity,
  deployedModel
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Real-time SVG thermal argument overlay states
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [heatmapMode, setHeatmapMode] = useState<"conviction" | "frequency" | "hybrid">("hybrid");
  const [svgOpacity, setSvgOpacity] = useState<number>(0.75);
  const [heatSpots, setHeatSpots] = useState<any[]>([]);

  const updateHeatmapOpacity = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) return;
    setSvgOpacity(Math.max(0.1, Math.min(1, Number(nextValue.toFixed(2)))));
  };

  // Performance DOM bindings for zero-redraw SVG updates during rapid loop iterations
  const svgBallHeatRef = useRef<SVGCircleElement | null>(null);
  const svgPaddleAHeatRef = useRef<SVGCircleElement | null>(null);
  const svgPaddleBHeatRef = useRef<SVGCircleElement | null>(null);

  // Sync historical argument conviction scores onto visual spots under selected spectrum decay rules
  useEffect(() => {
    // Only parse the last 15 arguments to simulate fading thermal dissipation
    const recentHistory = [...history].slice(-15);
    const spots = recentHistory.map((turn, idx) => {
      const { x, y } = getSeededCoords(turn.id, idx, turn.sender);
      const baseIntensity = turn.convictionScore / 100;
      const ageFactor = (idx + 1) / recentHistory.length; // newer is hotter
      
      let finalIntensity = baseIntensity * ageFactor;
      if (heatmapMode === "conviction") {
        finalIntensity = baseIntensity;
      } else if (heatmapMode === "frequency") {
        finalIntensity = ageFactor;
      }
      
      return {
        id: turn.id,
        sender: turn.sender,
        x,
        y,
        intensity: Math.max(0.1, Math.min(1.0, finalIntensity)),
        conviction: turn.convictionScore,
        type: turn.type
      };
    });
    setHeatSpots(spots);
  }, [history, heatmapMode]);

  // Physical coordinates use a fixed virtual court and scale visually through CSS.
  const ballRef = useRef({ x: 400, y: 225, vx: 4, vy: 2, radius: 8, color: "#22d3ee" });
  
  // Paddles
  const paddleHeight = 80;
  const paddleWidth = 12;
  const paddleARef = useRef({ y: 185, height: paddleHeight, width: paddleWidth });
  const paddleBRef = useRef({ y: 185, height: paddleHeight, width: paddleWidth });
  
  // Scoring state
  const isGoalTriggeredRef = useRef(false);

  // Particles
  const particlesRef = useRef<Particle[]>([]);

  const complexityRef = useRef(currentComplexity);
  useEffect(() => {
    complexityRef.current = currentComplexity;
  }, [currentComplexity]);

  const deployedModelRef = useRef(deployedModel);
  useEffect(() => {
    deployedModelRef.current = deployedModel;
  }, [deployedModel]);

  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Track state for physicists logic inside RAF
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const gameSpeedRef = useRef(gameSpeed);
  useEffect(() => {
    gameSpeedRef.current = gameSpeed;
  }, [gameSpeed]);

  const prefersReducedMotionRef = useRef(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      prefersReducedMotionRef.current = mediaQuery.matches;
    };
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const createParticles = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: 2 + Math.random() * 3
      });
    }
  };

  // Run the physics/drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastFrameAt = 0;
    const virtualWidth = 800;
    const virtualHeight = 450;

    // Reset ball starting position in middle
    const resetBall = (directionToA = true) => {
      ballRef.current.x = virtualWidth / 2;
      ballRef.current.y = virtualHeight / 2;
      ballRef.current.vx = (directionToA ? -3 : 3) * (0.8 + Math.random() * 0.4);
      ballRef.current.vy = (Math.random() * 4 - 2);
      ballRef.current.color = "#ffffff";
      isGoalTriggeredRef.current = false;
    };

    const updatePhysics = () => {
      const currentStatus = statusRef.current;
      const speedMultiplier = gameSpeedRef.current;
      const ball = ballRef.current;

      // Handle idle/completed
      if (currentStatus === "idle" || currentStatus === "completed") {
        // Just let the ball hover in the center with a gentle wave
        ball.x = virtualWidth / 2;
        ball.y = virtualHeight / 2 + Math.sin(Date.now() * 0.003) * 15;
        ball.color = "#ffffff";
        return;
      }

      // Handle Paused state
      if (currentStatus === "paused") {
        return;
      }

      // Handle scoring transition animations
      if (currentStatus === "scoring_A" || currentStatus === "scoring_B") {
        // Boost the ball! It is a beautiful golden finish
        ball.color = "#ffffff";
        const dy = (virtualHeight / 2) - ball.y;
        
        ball.vx = currentStatus === "scoring_A" ? 14 : -14;
        ball.vy = dy * 0.05;

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Spawn gold trail particles
        if (Math.random() < 0.5) {
          createParticles(ball.x, ball.y, "#ffffff", 2);
        }

        // Trigger goal completion once it passes boundaries
        if (!isGoalTriggeredRef.current && (ball.x > virtualWidth + 10 || ball.x < -10)) {
          isGoalTriggeredRef.current = true;
          onGoalCompleted(currentStatus === "scoring_A" ? "agentA" : "agentB");
          resetBall(currentStatus === "scoring_A");
        }
        return;
      }

      // Apply task complexity speed factor (lower complexity = faster, higher complexity = slower)
      let complexityFactor = 1.0;
      const comp = complexityRef.current || "quick lookup";
      if (comp === "quick lookup") {
        complexityFactor = 1.35;
      } else if (comp === "deep research") {
        complexityFactor = 0.75;
      } else if (comp === "complex simulation") {
        complexityFactor = 0.35;
      }

      // Compute dynamic Neural Model speed multiplier if active
      let nnSpeedModifier = 1.0;
      if (deployedModelRef.current) {
        const lastTurn = historyRef.current[historyRef.current.length - 1];
        const topicLenIn = Math.min(1.0, (lastTurn?.content?.length || 150) / 1000);
        const convictionIn = (lastTurn?.convictionScore || 50) / 100;
        const complexityIn = comp === "complex simulation" ? 1.0 : comp === "deep research" ? 0.6 : 0.2;
        try {
          const outputs = deployedModelRef.current.forward([topicLenIn, convictionIn, complexityIn]);
          nnSpeedModifier = outputs[0] !== undefined ? outputs[0] * 1.6 : 1.0;
        } catch (e) {
          // blank fallback
        }
      }

      // Handle thinking / researching slows down the ball
      let currentVelocityX = ball.vx * speedMultiplier * 0.5 * complexityFactor * nnSpeedModifier;
      let currentVelocityY = ball.vy * speedMultiplier * 0.5 * complexityFactor * nnSpeedModifier;

      if (currentStatus === "researching_A" || currentStatus === "researching_B") {
        // Slow down the ball to a crawl representing research and API execution time
        currentVelocityX *= 0.03;
        currentVelocityY *= 0.03;
      }

      // Move Ball
      ball.x += currentVelocityX;
      ball.y += currentVelocityY;

      // Wall bounds Y
      if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.vy = -ball.vy;
        createParticles(ball.x, ball.y, "#ffffff", 3);
      } else if (ball.y > virtualHeight - ball.radius) {
        ball.y = virtualHeight - ball.radius;
        ball.vy = -ball.vy;
        createParticles(ball.x, ball.y, "#ffffff", 3);
      }

      // Slide paddle automatically to track ball
      const aiPaddleA = paddleARef.current;
      const aiPaddleB = paddleBRef.current;

      // Auto tracking (slightly lazy to look real)
      const trackingSpeed = 0.07 * speedMultiplier;
      
      const targetYA = ball.y - aiPaddleA.height / 2;
      aiPaddleA.y += (targetYA - aiPaddleA.y) * trackingSpeed;
      aiPaddleA.y = Math.max(0, Math.min(virtualHeight - aiPaddleA.height, aiPaddleA.y));

      const targetYB = ball.y - aiPaddleB.height / 2;
      aiPaddleB.y += (targetYB - aiPaddleB.y) * trackingSpeed;
      aiPaddleB.y = Math.max(0, Math.min(virtualHeight - aiPaddleB.height, aiPaddleB.y));

      // Handle paddle collisions
      // Paddle A (Left)
      const paddleAX = 30;
      if (ball.vx < 0 && 
          ball.x - ball.radius <= paddleAX + aiPaddleA.width && 
          ball.x + ball.radius >= paddleAX) {
        if (ball.y >= aiPaddleA.y && ball.y <= aiPaddleA.y + aiPaddleA.height) {
          ball.x = paddleAX + aiPaddleA.width + ball.radius;
          ball.vx = -ball.vx;
          // Alter speed index depending on hit offset
          const relativeHit = (ball.y - (aiPaddleA.y + aiPaddleA.height / 2)) / (aiPaddleA.height / 2);
          ball.vy = relativeHit * 3 + (Math.random() - 0.5);
          ball.color = "#00FF41"; // Neon Green
          createParticles(ball.x, ball.y, "#00FF41", 10);
          onPaddleCollision("agentA");
        }
      }

      // Paddle B (Right)
      const paddleBX = virtualWidth - 30 - aiPaddleB.width;
      if (ball.vx > 0 && 
          ball.x + ball.radius >= paddleBX && 
          ball.x - ball.radius <= paddleBX + aiPaddleB.width) {
        if (ball.y >= aiPaddleB.y && ball.y <= aiPaddleB.y + aiPaddleB.height) {
          ball.x = paddleBX - ball.radius;
          ball.vx = -ball.vx;
          const relativeHit = (ball.y - (aiPaddleB.y + aiPaddleB.height / 2)) / (aiPaddleB.height / 2);
          ball.vy = relativeHit * 3 + (Math.random() - 0.5);
          ball.color = "#FF4100"; // Neon Orange/Red
          createParticles(ball.x, ball.y, "#FF4100", 10);
          onPaddleCollision("agentB");
        }
      }

      // Safeguard against boundary leak
      if (ball.x < 0) {
        resetBall(false);
      } else if (ball.x > virtualWidth) {
        resetBall(true);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, virtualWidth, virtualHeight);

      // Draw dynamic retro grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < virtualWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, virtualHeight);
        ctx.stroke();
      }
      for (let y = 0; y < virtualHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(virtualWidth, y);
        ctx.stroke();
      }

      // Draw table center net line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(virtualWidth / 2, 0);
      ctx.lineTo(virtualWidth / 2, virtualHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const ball = ballRef.current;
      const aiPaddleA = paddleARef.current;
      const aiPaddleB = paddleBRef.current;
      const currentStatus = statusRef.current;

      // Draw Paddles
      // Paddle A (Left)
      ctx.save();
      if (currentStatus === "researching_A") {
        ctx.shadowColor = "#00FF41";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#00FF41";
        // Forcefield shield
        ctx.strokeStyle = "rgba(0, 255, 65, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(36, aiPaddleA.y + aiPaddleA.height/2, 45, -Math.PI/2, Math.PI/2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#00FF41";
        ctx.shadowColor = "#00FF41";
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.rect(30, aiPaddleA.y, aiPaddleA.width, aiPaddleA.height);
      ctx.fill();
      ctx.restore();

      // Paddle B (Right)
      ctx.save();
      if (currentStatus === "researching_B") {
        ctx.shadowColor = "#FF4100";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#FF4100";
        // Forcefield shield
        ctx.strokeStyle = "rgba(255, 65, 0, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(virtualWidth - 36, aiPaddleB.y + aiPaddleB.height/2, 45, Math.PI/2, -Math.PI/2, true);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#FF4100";
        ctx.shadowColor = "#FF4100";
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.rect(virtualWidth - 30 - aiPaddleB.width, aiPaddleB.y, aiPaddleB.width, aiPaddleB.height);
      ctx.fill();
      ctx.restore();

      // Draw Particles
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.rect(p.x - p.size/2, p.y - p.size/2, p.size, p.size); // Square particle style fits brutalist aesthetic
        ctx.fill();
        ctx.restore();
      });
      // Filter dead particles
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

      // Draw Ball
      ctx.save();
      ctx.shadowColor = ball.color;
      ctx.shadowBlur = currentStatus.startsWith("scoring") ? 25 : 10;
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.rect(ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2); // Square pong ball matches design
      ctx.fill();
      ctx.restore();

      // Draw vector wave halo during lookups
      if (currentStatus === "researching_A") {
        ctx.fillStyle = "rgba(0, 255, 65, 0.08)";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (currentStatus === "researching_B") {
        ctx.fillStyle = "rgba(255, 65, 0, 0.08)";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sync SVG real-time heatmap refs without state redraw costs
      if (svgBallHeatRef.current) {
        svgBallHeatRef.current.setAttribute("cx", ball.x.toString());
        svgBallHeatRef.current.setAttribute("cy", ball.y.toString());
      }
      if (svgPaddleAHeatRef.current) {
        svgPaddleAHeatRef.current.setAttribute("cy", (aiPaddleA.y + aiPaddleA.height / 2).toString());
      }
      if (svgPaddleBHeatRef.current) {
        svgPaddleBHeatRef.current.setAttribute("cy", (aiPaddleB.y + aiPaddleB.height / 2).toString());
      }
    };

    const loop = (timestamp: number) => {
      if (prefersReducedMotionRef.current && timestamp - lastFrameAt < 1000 / 15) {
        animId = requestAnimationFrame(loop);
        return;
      }
      lastFrameAt = timestamp;
      updatePhysics();
      draw();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, [onPaddleCollision, onGoalCompleted]);

  // Conviction scores of latest message (to show on hud)
  const lastMsgA = [...history].reverse().find(m => m.sender === "agentA");
  const lastMsgB = [...history].reverse().find(m => m.sender === "agentB");

  const scoreAVal = lastMsgA ? lastMsgA.convictionScore : 50;
  const scoreBVal = lastMsgB ? lastMsgB.convictionScore : 50;

  return (
    <div
      className="relative isolate flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden bg-black p-3 sm:p-5"
      id="pong-game-sandbox"
      style={{ contain: "layout paint", overflowAnchor: "none" }}
    >
      {/* HUD Bar */}
      <div className="relative z-10 order-2 grid min-w-0 grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-white/15 bg-[#070A0E] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3 sm:px-4" id="pong-hud">
        {/* Agent A Summary */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#00FF41]/40 bg-[#00FF41]/10 text-lg sm:h-10 sm:w-10 sm:text-xl">{agentConfig.agentA.avatar}</div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-black uppercase tracking-wide text-[#00FF41] sm:text-sm">{agentConfig.agentA.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="hidden text-xs font-bold uppercase tracking-wide text-slate-500 sm:inline">Conviction</span>
              <span className={`text-xs font-bold font-mono ${scoreAVal >= 85 ? "text-[#00FF41]" : scoreAVal < 50 ? "text-rose-500" : "text-white"}`}>
                {scoreAVal}%
              </span>
            </div>
          </div>
        </div>

        {/* Total Arena Score */}
        <div className="flex min-w-[92px] flex-col items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-2 py-2 sm:min-w-[120px] sm:px-4">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#00FF41] sm:text-xs">Locked points</span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl font-mono text-[#00FF41] font-black sm:text-2xl">{scoreA}</span>
            <span className="text-white/40 font-mono text-sm">:</span>
            <span className="text-xl font-mono text-[#FF4100] font-black sm:text-2xl">{scoreB}</span>
          </div>
        </div>

        {/* Agent B Summary */}
        <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
          <div className="min-w-0 sm:order-1">
            <div className="truncate text-[11px] font-black uppercase tracking-wide text-[#FF7A3D] sm:text-sm">{agentConfig.agentB.name}</div>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="hidden text-xs font-bold uppercase tracking-wide text-slate-500 sm:inline">Conviction</span>
              <span className={`text-xs font-bold font-mono ${scoreBVal >= 85 ? "text-[#00FF41]" : scoreBVal < 50 ? "text-[#FF7A3D]" : "text-white"}`}>
                {scoreBVal}%
              </span>
            </div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#FF7A3D]/40 bg-[#FF7A3D]/10 text-lg sm:order-2 sm:h-10 sm:w-10 sm:text-xl">{agentConfig.agentB.avatar}</div>
        </div>
      </div>

      {/* Active Complexity Info Bar */}
      <div className="order-3 flex flex-col gap-2 rounded-md border border-white/10 bg-[#070A0E] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between" id="complexity-info-bar">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold uppercase tracking-wide text-slate-500">Task profile</span>
          <span className={`rounded-full px-2.5 py-1 font-black uppercase ${
            currentComplexity === "quick lookup" ? "bg-emerald-500/10 text-[#00FF41] border border-[#00FF41]/30" :
            currentComplexity === "deep research" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30" : "bg-red-500/10 text-[#FF4100] border border-[#FF4100]/30"
          }`}>
            {currentComplexity}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold uppercase tracking-wide text-slate-500">Rally friction</span>
          <span className="font-black text-white">
            {currentComplexity === "quick lookup" ? "LOW (SPEEDY 1.35X)" :
             currentComplexity === "deep research" ? "MEDIUM (MEASURED 0.75X)" : "PEAK (DELIBERATE 0.35X)"}
          </span>
        </div>
      </div>

      {/* Neural Network HUD indicator bar */}
      {deployedModel && (
        <div className="order-4 flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between" id="neural-hud-bar">
          <div className="flex items-center gap-2 text-emerald-400">
            <Brain className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold uppercase tracking-wide">Neural trainer</span>
            <span className="rounded-full bg-emerald-500 px-2 py-1 text-[11px] font-black uppercase leading-none tracking-wide text-black">
              Active
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="font-bold uppercase tracking-wide">Gradient velocity</span>
            <span className="rounded border border-[#00FF41]/30 bg-black px-2 py-1 font-black text-[#00FF41]">
              Dynamic
            </span>
            <span className="rounded border border-emerald-400/20 bg-black px-2 py-1 font-black uppercase text-emerald-200">
              {deployedModel.activationType}
            </span>
          </div>
        </div>
      )}

      {/* Real-time Heatmap Control Panel */}
      <div className="order-5 flex flex-col gap-3 rounded-md border border-white/10 bg-neutral-950 px-4 py-3 text-xs 2xl:flex-row 2xl:items-center 2xl:justify-between" id="heatmap-control-bar">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wide text-slate-400">Thermal argument overlay</span>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase transition-all ${
              showHeatmap 
                ? "bg-[#00FF41]/15 border-[#00FF41]/60 text-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,0.1)]" 
                : "bg-black border-white/20 text-slate-500 hover:text-white"
            }`}
          >
            {showHeatmap ? "ONLINE" : "OFFLINE"}
          </button>
        </div>

        {showHeatmap && (
          <div className="flex w-full flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase text-slate-400">Sensitivity</span>
              <button
                type="button"
                onClick={() => updateHeatmapOpacity(svgOpacity - 0.05)}
                disabled={svgOpacity <= 0.1}
                aria-label="Decrease heatmap sensitivity"
                className="flex h-7 w-7 items-center justify-center rounded border border-white/15 bg-black text-sm font-black text-slate-300 transition hover:border-[#00FF41]/50 hover:text-[#00FF41] disabled:cursor-not-allowed disabled:opacity-35"
              >
                -
              </button>
              <input
                id="heatmap-opacity-slider"
                aria-label="Heatmap sensitivity"
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={svgOpacity}
                onChange={(e) => updateHeatmapOpacity(parseFloat(e.target.value))}
                className="w-20 accent-[#00FF41] bg-black h-1.5 rounded cursor-pointer border border-white/10"
              />
              <button
                type="button"
                onClick={() => updateHeatmapOpacity(svgOpacity + 0.05)}
                disabled={svgOpacity >= 1}
                aria-label="Increase heatmap sensitivity"
                className="flex h-7 w-7 items-center justify-center rounded border border-white/15 bg-black text-sm font-black text-slate-300 transition hover:border-[#00FF41]/50 hover:text-[#00FF41] disabled:cursor-not-allowed disabled:opacity-35"
              >
                +
              </button>
              <span className="min-w-[36px] text-right text-xs font-bold text-white">{Math.round(svgOpacity * 100)}%</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold uppercase text-slate-400">Decay</span>
              <div className="flex max-w-full flex-wrap overflow-hidden rounded border border-white/20 bg-black">
                {(["conviction", "frequency", "hybrid"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setHeatmapMode(mode)}
                    className={`px-2.5 py-1.5 text-[11px] font-black uppercase transition-all ${
                      heatmapMode === mode
                        ? "bg-[#00FF41] text-black font-extrabold"
                        : "text-slate-400 hover:text-white bg-transparent"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goal/consensus banner */}
      {latestScoreType && (
        <div className="absolute left-1/2 top-28 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-md border border-black bg-white px-4 py-2 font-black text-black shadow-lg" id="consensus-alert">
          {latestScoreType === "consensus" ? <Trophy className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          <span className="text-xs uppercase tracking-wide">{latestScoreText}</span>
        </div>
      )}

      {/* Actual Physical Canvas */}
      <div
        ref={containerRef}
        className="relative isolate order-1 flex aspect-[16/9] w-full min-w-0 max-w-full items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-[#050505] shadow-inner"
        id="pong-canvas-frame"
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Real-time SVG-based Heatmap Overlay */}
        {showHeatmap && (
          <svg
            viewBox="0 0 800 450"
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen z-10"
            style={{ opacity: svgOpacity }}
            id="pong-heatmap-overlay"
          >
            <defs>
              {/* Agent A - Emerald High Conviction */}
              <radialGradient id="heat-a-vibrant" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00FF41" stopOpacity={0.8} />
                <stop offset="35%" stopColor="#00FF41" stopOpacity={0.35} />
                <stop offset="75%" stopColor="#10b981" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </radialGradient>
              
              {/* Agent A - Low Conviction (Deep Teal) */}
              <radialGradient id="heat-a-low" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0d9488" stopOpacity={0.55} />
                <stop offset="50%" stopColor="#115e59" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </radialGradient>

              {/* Agent A - Ultra Extreme (Gold-White core to Green glow) */}
              <radialGradient id="heat-extreme-a" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
                <stop offset="25%" stopColor="#a3e635" stopOpacity={0.65} />
                <stop offset="65%" stopColor="#00FF41" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </radialGradient>

              {/* Agent B - Crimson-Red High Conviction */}
              <radialGradient id="heat-b-vibrant" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FF4100" stopOpacity={0.8} />
                <stop offset="35%" stopColor="#f97316" stopOpacity={0.35} />
                <stop offset="75%" stopColor="#dc2626" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
              </radialGradient>

              {/* Agent B - Low Conviction (Dim Maroon) */}
              <radialGradient id="heat-b-low" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#be123c" stopOpacity={0.55} />
                <stop offset="50%" stopColor="#881337" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </radialGradient>

              {/* Moderator - Neutral Amber Guidance */}
              <radialGradient id="heat-moderator" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.7} />
                <stop offset="45%" stopColor="#F59E0B" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </radialGradient>

              {/* Agent B - Ultra Extreme (Silver-White core to Red glow) */}
              <radialGradient id="heat-extreme-b" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
                <stop offset="25%" stopColor="#fde047" stopOpacity={0.65} />
                <stop offset="65%" stopColor="#FF4100" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </radialGradient>

              {/* Dynamic Live Heat Source - Ball Glow (Cyan) */}
              <radialGradient id="ball-heat-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00FFFF" stopOpacity={0.7} />
                <stop offset="45%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </radialGradient>

              {/* Paddle Glows */}
              <radialGradient id="paddle-a-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00FF41" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#00FF41" stopOpacity={0} />
              </radialGradient>
              <radialGradient id="paddle-b-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FF4100" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#FF4100" stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* Render Static/Conversational Coords from History mapped on field */}
            {heatSpots.map((spot) => {
              let gradId = "heat-a-vibrant";
              if (spot.sender === "agentA") {
                if (spot.conviction >= 85) gradId = "heat-extreme-a";
                else if (spot.conviction >= 55) gradId = "heat-a-vibrant";
                else gradId = "heat-a-low";
              } else if (spot.sender === "agentB") {
                if (spot.conviction >= 85) gradId = "heat-extreme-b";
                else if (spot.conviction >= 55) gradId = "heat-b-vibrant";
                else gradId = "heat-b-low";
              } else {
                gradId = "heat-moderator";
              }
              const radius = 40 + spot.intensity * 75;

              return (
                <circle
                  key={spot.id}
                  cx={spot.x}
                  cy={spot.y}
                  r={radius}
                  fill={`url(#${gradId})`}
                  opacity={spot.intensity}
                  style={{ mixBlendMode: "screen", transition: "all 0.5s ease" }}
                />
              );
            })}

            {/* Active Real-time tracking overlay elements (Ref Mutated in loop) */}
            {/* 1. Real-time Ball thermal energy footprint */}
            <circle
              ref={svgBallHeatRef}
              cx={400}
              cy={225}
              r={90}
              fill="url(#ball-heat-glow)"
              style={{ mixBlendMode: "screen" }}
            />

            {/* 2. Real-time Paddle A energy flare */}
            <circle
              ref={svgPaddleAHeatRef}
              cx={30}
              cy={225}
              r={120}
              fill="url(#paddle-a-glow)"
              style={{ mixBlendMode: "screen" }}
            />

            {/* 3. Real-time Paddle B energy flare */}
            <circle
              ref={svgPaddleBHeatRef}
              cx={770}
              cy={225}
              r={120}
              fill="url(#paddle-b-glow)"
              style={{ mixBlendMode: "screen" }}
            />
          </svg>
        )}

        {/* Visual Overlays / Forcefield HUD */}
        {status === "researching_A" && (
          <div className="pointer-events-none absolute left-4 top-1/2 hidden max-w-[220px] -translate-y-1/2 flex-col gap-1 rounded-md border border-[#00FF41]/70 bg-black/85 px-4 py-3 shadow-[0_0_15px_rgba(0,255,65,0.2)] sm:flex" id="agent-a-thinking-widget">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#00FF41]">
              <Zap className="h-3 w-3 animate-spin" /> Agent A composing
            </div>
            {agentConfig.useGrounding && (
              <span className="flex items-center gap-1 text-xs text-[#00FF41]/70">
                Grounding enabled
              </span>
            )}
            <span className="mt-1 text-xs text-slate-500">Volley delay active</span>
          </div>
        )}

        {status === "researching_B" && (
          <div className="pointer-events-none absolute right-4 top-1/2 hidden max-w-[220px] -translate-y-1/2 flex-col gap-1 rounded-md border border-[#FF7A3D]/70 bg-black/85 px-4 py-3 text-right shadow-[0_0_15px_rgba(255,65,0,0.2)] sm:flex" id="agent-b-thinking-widget">
            <div className="flex items-center justify-end gap-1.5 text-xs font-bold uppercase text-[#FF7A3D]">
              Agent B composing <Zap className="h-3 w-3 animate-spin" />
            </div>
            {agentConfig.useGrounding && (
              <span className="flex items-center justify-end gap-1 text-xs text-[#FF7A3D]/70">
                Grounding enabled
              </span>
            )}
            <span className="mt-1 text-xs text-slate-500">Volley delay active</span>
          </div>
        )}

        {status === "idle" && (
          <div className="absolute inset-0 flex select-none flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center" id="lobby-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-white/25 bg-white/5 text-2xl font-black">
              🏓
            </div>
            <h3 className="text-lg font-black tracking-tight text-[#00FF41]">Ready for a cognitive rally</h3>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              Choose two agents, give them a debate goal, and start the loop. Each paddle hit becomes a claim, critique, counterexample, or synthesis.
            </p>
          </div>
        )}
      </div>

      {/* Arena Guide Footer */}
      <div className="order-6 flex flex-col justify-between gap-2 border-t border-white/10 px-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:flex-row sm:items-center" id="arena-legend">
        <span>Impact triggers the next reasoning turn</span>
        <span>Longer cognition slows the rally</span>
      </div>
    </div>
  );
};
