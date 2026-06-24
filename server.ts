import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { buildAgentPersonaInstruction, buildAgentProfileInstruction } from "./server/agentProfile";
import { generateWithProvider, resolveProviderConfig } from "./server/providers";
import { generateWithAgentBridge, isLocalBridgeExecutionEnabled, resolveAgentBridgeConfig } from "./server/agentBridges";
import { resolveDevServerPorts, resolveViteServerOptions } from "./server/devServerConfig";
import { appendStoredMatch, buildLeaderboard, MatchValidationError, readMatches } from "./server/matchStore";
import { createArenaLoopRouter } from "./server/arenaLoopRoutes";
import { buildArenaSettingsInstruction } from "./src/utils/arenaSettings";

// Load environment variables
dotenv.config();

const app = express();
const { port: PORT } = resolveDevServerPorts();

// Parse JSON bodies
app.use(express.json());
app.use("/api/arena-loop", createArenaLoopRouter());

app.get("/api/bridge/manifest", (_req, res) => {
  res.json({
    success: true,
    localExecutionEnabled: isLocalBridgeExecutionEnabled(),
    bridges: [
      {
        kind: "none",
        label: "No external agent bridge",
        localExecution: false
      },
      {
        kind: "http",
        label: "HTTP agent bridge",
        localExecution: false,
        payload: "POST { topic, history, currentAgent, agent, system, prompt, responseFormat }"
      },
      {
        kind: "websocket",
        label: "WebSocket agent bridge",
        localExecution: false,
        payload: "Send one Cognitive Pong turn payload, receive one JSON/text response"
      },
      {
        kind: "mcp",
        label: "MCP-style HTTP tools/call bridge",
        localExecution: false,
        payload: "JSON-RPC 2.0 tools/call with cognitive_pong_turn arguments"
      },
      {
        kind: "cli",
        label: "Local CLI bridge",
        localExecution: true,
        gatedBy: "COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true"
      },
      {
        kind: "codex-cli",
        label: "Optional Codex CLI bridge",
        localExecution: true,
        gatedBy: "COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true",
        commandEnv: "CODEX_CLI_COMMAND"
      }
    ]
  });
});

// Helper to programmatically construct rich spectator comments and grand referee evaluations
function generateSpectatorsAndJudge(
  topic: string,
  content: string,
  sender: "agentA" | "agentB",
  convictionScore: number,
  agentConfig: any
) {
  const nameA = agentConfig?.agentA?.name || "Agent A";
  const nameB = agentConfig?.agentB?.name || "Agent B";
  const activeName = sender === "agentA" ? nameA : nameB;
  const opponentName = sender === "agentA" ? nameB : nameA;

  const spectators = [
    { name: "Systems Reviewer", avatar: "SYS", profiles: ["The operational constraint is clear.", "This depends on downstream replica behavior.", "The latency claim needs a measurable bound.", "Good argument point; keep the evidence attached."] },
    { name: "Security Reviewer", avatar: "SEC", profiles: ["Check this against race-condition and authorization risks.", "Strong defense, but dynamic validation tests are still needed.", "Consider validation state pollution before accepting this.", "This could degrade under load without tighter controls."] },
    { name: "Research Reviewer", avatar: "R&D", profiles: ["That is a concrete interpretation of the stated constraints.", "The causal chain is becoming clearer.", "This rebuttal is logically well structured.", "The game-theory framing is useful here."] },
    { name: "Product Reviewer", avatar: "UX", profiles: ["The argument is understandable and decision-relevant.", "This turn clarifies the tradeoff for an operator.", "The referee should weigh this carefully.", "The debate is converging on a testable claim."] },
    { name: "Delivery Reviewer", avatar: "OPS", profiles: ["This would be feasible if the rollout path stays simple.", "The direct issue is now easier to ship around.", "I would support this design with the stated guardrails.", "That objection is valid and should stay in scope."] }
  ];

  const shuffled = [...spectators].sort(() => Math.random() - 0.5);
  const spectatorLiveReactions = shuffled.slice(0, 3).map(spec => {
    let comment = spec.profiles[Math.floor(Math.random() * spec.profiles.length)];
    const lowerContent = (content || "").toLowerCase();
    if (lowerContent.includes("database") || lowerContent.includes("replication") || lowerContent.includes("sync")) {
      if (spec.name.includes("Systems")) comment = "Database desynchronization is the key operational risk; this mitigation is directionally sound.";
    }
    if (lowerContent.includes("radiation") || lowerContent.includes("shield") || lowerContent.includes("mars")) {
      if (spec.name.includes("Security")) comment = "Water shielding is promising, but thermal and hull-boundary constraints need explicit validation.";
    }
    if (convictionScore >= 85) {
      if (spec.name.includes("Product")) comment = `${activeName} made a high-impact argument that should change the decision record.`;
      if (spec.name.includes("Delivery")) comment = `${activeName} made the implementation path more concrete.`;
    }
    return {
      spectatorName: spec.name,
      avatar: spec.avatar,
      comment
    };
  });

  const offset = Math.floor(Math.random() * 12) - 6; // -6 to 6
  const intellectScore = Math.max(50, Math.min(100, convictionScore + offset + 4));
  const precisionScore = Math.max(50, Math.min(100, convictionScore - offset + 1));
  const rhetoricScore = Math.max(50, Math.min(100, convictionScore + (offset * 1.5)));

  const avgScore = (intellectScore + precisionScore + rhetoricScore) / 3;
  const isScoreGoal = avgScore >= 83 || convictionScore >= 85;

  let verdictComment = "";
  let pivotingDirective = "";

  if (isScoreGoal) {
    verdictComment = `The Grand Referee is persuaded! ${activeName} has delivered an airtight argument and milestone proposal. Point awarded!`;
    pivotingDirective = `With consensus accomplished, the Referee pivots the debate's trajectory to focus on: implementing dynamic, secure validation gates and fail-safe protocols for "${topic}".`;
  } else {
    verdictComment = `Referee sees intense, close exchanges. Solid argumentation, but ${opponentName} holds the defense line. No clear scoring strike yet.`;
    pivotingDirective = `Referee demands ${opponentName} to counter ${activeName}'s focus on validation consistency, or build a direct alternative strategy.`;
  }

  return {
    judgeEvaluation: {
      intellectScore,
      precisionScore,
      rhetoricScore,
      isScoreGoal,
      verdictComment,
      pivotingDirective
    },
    spectatorLiveReactions
  };
}

// Local synthetic response generator used when a provider or bridge is unavailable.
function getSyntheticResponse(
  topic: string,
  history: any[]
) {
  const normalizedTopic = (topic || "").toLowerCase();
  const isMigration = normalizedTopic.includes("migrate") || normalizedTopic.includes("migration") || normalizedTopic.includes("monolith") || normalizedTopic.includes("serverless") || normalizedTopic.includes("banking") || normalizedTopic.includes("ledger") || normalizedTopic.includes("database");
  const isMars = normalizedTopic.includes("mars") || normalizedTopic.includes("dome") || normalizedTopic.includes("agricultural") || normalizedTopic.includes("space") || normalizedTopic.includes("crew") || normalizedTopic.includes("radiation");
  const isCookie = normalizedTopic.includes("cookie") || normalizedTopic.includes("recipe") || normalizedTopic.includes("bake") || normalizedTopic.includes("chocolate") || normalizedTopic.includes("sugar");

  const turnIndex = history.length;

  if (isMigration) {
    if (turnIndex === 0) {
      return {
        content: `PROPOSED ARCHITECTURAL BLUEPRINT:\nWe should deploy continuous Change Data Capture (CDC) streaming pipelines via Debezium over the legacy ledger database. This decouples database synchronization and lets us stage microservices in read-only sandboxes safely.\n\nM0 CORE CLAIM: Transition state sync requires robust decoupling from legacy nodes.\nM2 RAG: Strangler-Fig-Pattern, Enterprise-Integration-Patterns-v4\nM4 HOPFIELD: database_latency_hazard_102 (Recall Debezium concurrency design).`,
        type: "proposal" as const,
        proposal: "Mainframe Change-Data-Capture streamed to Redis cache structures.",
        convictionScore: 72,
        complexity: "complex simulation" as const
      };
    } else if (turnIndex === 1) {
      return {
        content: `ADVERSARIAL CONCURRENCY CHALLENGE / RETORT:\nIf the replication lag exceeds 40ms under heavy transaction pools, we have a critical read-after-write hazard where customers see stale account balances, leading to balance leakages.\n\nM0 CORE CLAIM: Asynchronous state sync cannot guarantee transactional compliance.\nM2 RAG: Dijkstra-Distributed-Semaphores, Brewer-CAP-Theorem\nM4 HOPFIELD: latency_race_hazard_88 (Critical race event warning).`,
        type: "critique" as const,
        proposal: "",
        convictionScore: 68,
        complexity: "deep research" as const
      };
    } else if (turnIndex === 2) {
      return {
        content: `RE-OPTIMIZED BLUEPRINT AND RESOLUTION:\nTo bypass the sync race hazard, we introduce secure double-read comparative hashes at proxy gates. When critical balance operations are received, the proxy compares hashes between current streams and legacy storage before confirming, neutralizing out-of-sync states.\n\nM0 CORE CLAIM: Gate comparative validation eliminates CDC synchronization races.\nM2 RAG: Outbox-Pattern-Microservices\nM4 HOPFIELD: database_latency_hazard_102 (RE-ENGAGED WITH ABSOLUTE SUCCESS).`,
        type: "rebuttal" as const,
        proposal: "Synchronized Proxy Comparative Hashes with double-read validation.",
        convictionScore: 84,
        complexity: "complex simulation" as const
      };
    } else {
      return {
        content: `FORMAL AGREEMENT AND VERIFIED STABILITY:\nThe inclusion of proxy-level comparative hashes fully guarantees zero balance desynchronization. The risk has been thoroughly addressed.\n\nM0 CORE CLAIM: Migration path is now safe and compliant with banking standards.\nM2 RAG: ISO-Ledger-Replication-Compliance\nM4 HOPFIELD: consensus_loop_deadlock_015 (Debate consolidated, path clear).`,
        type: "agreement" as const,
        proposal: "Synchronized Proxy Comparative Hashes with double-read validation.",
        convictionScore: 94,
        complexity: "quick lookup" as const
      };
    }
  } else if (isMars) {
    if (turnIndex === 0) {
      return {
        content: `PROPOSED AEROPONIC AND CLOSED-LOOP DESIGN:\nWe specify a closed-loop crop-cultivation framework using localized high-frictional aeroponics. This reduces water mass requirements and allows dosing liquid nitrogen directly to root chambers.\n\nM0 CORE CLAIM: Aeroponics represents the optimal mass-efficiency ratio for closed ecosystems.\nM2 RAG: Mars-Ecosystems-Manual-V8, Sagan-Habitation-Guidelines\nM4 HOPFIELD: pattern_retrieval_success_99 (Optimal root mist frequency recalled).`,
        type: "proposal" as const,
        proposal: "Closed-loop aeroponic root watering sequence with direct nitrogen dosing.",
        convictionScore: 71,
        complexity: "complex simulation" as const
      };
    } else if (turnIndex === 1) {
      return {
        content: `ADVERSARIAL RADIATION ANALYSIS / CHALLENGE:\nStandard single-layer polymer structures on Mars will degrade inside 90 Martian sols from high-energy cosmic rays, threatening absolute crop structure death.\n\nM0 CORE CLAIM: Standard polymer hulls lack the required density for long-term radiation safety.\nM2 RAG: NASA-Deep-Space-Radiation-Hulls\nM4 HOPFIELD: shielding_optimization (Structural failure from solar proton spikes).`,
        type: "critique" as const,
        proposal: "",
        convictionScore: 65,
        complexity: "deep research" as const
      };
    } else if (turnIndex === 2) {
      return {
        content: `RE-OPTIMIZED SHIELD LAYERING RESOLUTION:\nWe replace the simple polymer hull with a nested dual-chamber layout filled with greywater waste blocks from cabin recycling. This dense layer acts as both carbon-shielding and greywater reservoir.\n\nM0 CORE CLAIM: Waste-recycled water buffers resolve cosmic ray shielding cost.\nM2 RAG: Hydrogenous-Shield-Design-Astronomy\nM4 HOPFIELD: shielding_optimization (SOLVED via greywater composite layering).`,
        type: "rebuttal" as const,
        proposal: "Nested greywater-filled hull blocks for dual-action cosmic radiation shields.",
        convictionScore: 86,
        complexity: "complex simulation" as const
      };
    } else {
      return {
        content: `CONSENSUS REACHED AND SEALED PROMPT:\nThe Martian agricultural dome design has been fully optimized. Integrating recycled greywater barriers satisfies all radiation and mass restrictions.\n\nM0 CORE CLAIM: Sustainable biodome blueprint is certified.\nM2 RAG: Sagan-Habitation-Guidelines\nM4 HOPFIELD: consensus_loop_deadlock_015 (Closed-loop criteria accomplished).`,
        type: "agreement" as const,
        proposal: "Nested greywater-filled hull blocks for dual-action cosmic radiation shields.",
        convictionScore: 95,
        complexity: "quick lookup" as const
      };
    }
  } else if (isCookie) {
    if (turnIndex === 0) {
      return {
        content: `PROPOSED BAKING AND HYDRATION METHOD:\nTo attain a fudgy core, we must dry-brown unsalted butter to evaporate excess liquid, combined with bread flour for premium gluten stretch.\n\nM0 CORE CLAIM: Minimizing butter water content while maximizing protein binding results in fudgy textures.\nM2 RAG: McGee-On-Food-And-Cooking, Herve-This-Gastronomy\nM4 HOPFIELD: sugar_caramelization_balance (Butter browning temperature trace).`,
        type: "proposal" as const,
        proposal: "Dry-browning butter to 120C and choosing high-protein bread flour.",
        convictionScore: 74,
        complexity: "complex simulation" as const
      };
    } else if (turnIndex === 1) {
      return {
        content: `ADVERSARIAL PATISSERIE FEEDBACK / CRITIQUE:\nHigh-protein bread flour without proper hydration relaxation will cook up extremely tough and bread-like rather than soft and fudgy.\n\nM0 CORE CLAIM: High-gluten flour causes premature starch structural set and rubberiness.\nM2 RAG: Gluten-Network-Relaxation-Guides\nM4 HOPFIELD: sugar_caramelization_balance (Hydration saturation hazard).`,
        type: "critique" as const,
        proposal: "",
        convictionScore: 69,
        complexity: "deep research" as const
      };
    } else if (turnIndex === 2) {
      return {
        content: `RE-OPTIMIZED RESTING PROTOCOL RESOLUTION:\nWe introduce a mandatory 72-hour chilled cold-aging phase. This relaxes gluten networks, hydration levels saturate completely, and starch breaks down into clean, rich sugars.\n\nM0 CORE CLAIM: Multi-day cold aging dissolves gluten tension and concentrates sugars.\nM2 RAG: Enzyme-Conversion-Pastry\nM4 HOPFIELD: sugar_caramelization_balance (RESOLVED with 72h chilled resting curve).`,
        type: "rebuttal" as const,
        proposal: "Mandatory 72-hour chilled cold resting protocol for complete enzyme saturation.",
        convictionScore: 87,
        complexity: "complex simulation" as const
      };
    } else {
      return {
        content: `FORMAL AGREEMENT AND RECIPE CONFIRMED:\nThe 72-hour cold chill fully addresses gluten structure concerns. The recipe is balanced and ready for baker test runs.\n\nM0 CORE CLAIM: Perfect chocolate chip biscuit configuration established.\nM2 RAG: Pastry-Orthodox-Standards\nM4 HOPFIELD: consensus_loop_deadlock_015 (Perfect chewy core locked in).`,
        type: "agreement" as const,
        proposal: "Mandatory 72-hour chilled cold resting protocol for complete enzyme saturation.",
        convictionScore: 96,
        complexity: "quick lookup" as const
      };
    }
  } else {
    // General high-quality dynamic simulator for any arbitrary topic!
    const capitalizedTopic = (topic || "").trim().toUpperCase();
    if (turnIndex === 0) {
      return {
        content: `PROPOSED BLUEPRINT AND WORKFLOW:\nTo address "${capitalizedTopic}", we establish a robust multi-tiered validation approach. Key processing states isolate within decoupled micro-modules to enforce strong operational boundary gates.\n\nM0 CORE CLAIM: Initial mapping should emphasize deterministic failure containment and high-integrity schema constraints.\nM2 RAG: Modern-System-Design-Concepts, Design-Patterns-Enterprise-V4\nM4 HOPFIELD: pattern_retrieval_success_99 (Optimal structural boundary parameters loaded).`,
        type: "proposal" as const,
        proposal: `Design a modular framework to solve "${topic}" with strict validation checks.`,
        convictionScore: 70,
        complexity: "complex simulation" as const
      };
    } else if (turnIndex === 1) {
      return {
        content: `ADVERSARIAL CRITIQUE / CHOKEPOINT CHALLENGE:\nWhile this baseline proposal for "${capitalizedTopic}" creates a solid sequence, it introduces race hazards under high parallel execution triggers, which could bypass validation layers.\n\nM0 CORE CLAIM: Design lacks dynamic load insulation and automated exception scaling lines.\nM2 RAG: Scalability-Fault-Tolerance-RFC, System-Fail-Safe-Guidelines\nM4 HOPFIELD: consensus_loop_deadlock_015 (High-concurrency race condition found).`,
        type: "critique" as const,
        proposal: "",
        convictionScore: 66,
        complexity: "deep research" as const
      };
    } else if (turnIndex === 2) {
      return {
        content: `RE-OPTIMIZED SUB-SYSTEM AND FALLBACK RESOLUTION:\nTo fully mitigate any race conditions, we integrate high-speed comparative lookup states alongside real-time circuit breakers. This seals critical transaction boundaries and resolves desynchronization under high load.\n\nM0 CORE CLAIM: Real-time telemetry and circuit breakers insulate micro-nodes during cascade bottlenecks.\nM2 RAG: Circuit-Breaker-Pattern-Design\nM4 HOPFIELD: pattern_retrieval_success_99 (ENFORCED WITH NEW EXCEPTION PROTOCOLS).`,
        type: "rebuttal" as const,
        proposal: `Integrate real-time circuit breakers and telemetry alerts to secure "${topic}".`,
        convictionScore: 85,
        complexity: "complex simulation" as const
      };
    } else {
      return {
        content: `FORMAL AGENT RATIFICATION AND BLUEPRINT UNIFIED:\nBy combining real-time circuit breakers and doublecheck validation gates, we neutralize any latency or data corruption concerns. Consensus is fully established.\n\nM0 CORE CLAIM: Unified architectural specification confirmed and certified.\nM2 RAG: Systems-Engineering-Certification\nM4 HOPFIELD: consensus_loop_deadlock_015 (Unified consensus locked).`,
        type: "agreement" as const,
        proposal: `Integrate real-time circuit breakers and telemetry alerts to secure "${topic}".`,
        convictionScore: 94,
        complexity: "quick lookup" as const
      };
    }
  }
}

// REST API for Agent Debate Loop
app.post("/api/debate/next", async (req, res) => {
  try {
    const {
      topic,
      history = [],
      currentAgent, // 'agentA' | 'agentB'
      agentConfig,
      useGrounding = false,
      model = process.env.COGNITIVE_PONG_DEFAULT_MODEL,
      activeTrajectory = null
    } = req.body;

    // Set up identities
    const nameA = agentConfig?.agentA?.name || "Advocate";
    const roleA = agentConfig?.agentA?.role || "Propose structured features and move things forward optimistically.";
    const nameB = agentConfig?.agentB?.name || "Critic";
    const roleB = agentConfig?.agentB?.role || "Analyze vulnerabilities, demand proof, and offer constructive criticisms.";
    const defaultComplexity = agentConfig?.defaultComplexity || "auto";
    const arenaSettingsInstruction = buildArenaSettingsInstruction(agentConfig?.arenaSettings);

    const activeName = currentAgent === "agentA" ? nameA : nameB;
    const activeRole = currentAgent === "agentA" ? roleA : roleB;
    const activeAgentProfile = currentAgent === "agentA" ? (agentConfig?.agentA || {}) : (agentConfig?.agentB || {});
    const opponentName = currentAgent === "agentA" ? nameB : nameA;

    let additionalComplexityInstruction = "";
    if (defaultComplexity && defaultComplexity !== "auto") {
      additionalComplexityInstruction = `\n\nCRITICAL DIRECTIVE: The user has set the active task complexity target to "${defaultComplexity}". Please shape your proposal depth, debate complexity, and conviction checks to align exactly with a "${defaultComplexity}" profile.`;
    }

    const personaInstruction = buildAgentPersonaInstruction(activeAgentProfile);
    const personalityInstruction = buildAgentProfileInstruction(activeAgentProfile);

    let trajectoryInstruction = "";
    if (activeTrajectory && activeTrajectory.trim() !== "") {
      trajectoryInstruction = `\n\nCRITICAL DISCUSSION TRAJECTORY SHIFT OVERRIDE: The Arena Referee has shifted the debate focus to: "${activeTrajectory.trim()}". You are absolute and strictly REQUIRED to pivot your focus, argument, or proposal to address this redirected trajectory context immediately! `;
    }

    // Build the system prompt
    const systemInstruction = `You are playing a dynamic, collaborative, yet competitive game of "Agentic Pong Debate" representing the LLM agent: "${activeName}".
Your role details: ${activeRole}${personaInstruction}${personalityInstruction}${trajectoryInstruction}

The overall mission or question is: "${topic}"${additionalComplexityInstruction}${arenaSettingsInstruction}

Rules of the Arena:
1. You and your opponent ("${opponentName}") take turns debating and bouncing the discussion "ball".
2. You must act as a real human debater would—reacting point-by-point to whatever your adversary did or claimed in the previous history! Defend your own previous assertions, attack loopholes in the opponent's models, and use robust reasoning.
3. If it is early or you have objections, propose adjustments, point out risks, or refine the details. Be interactive, sharp, and highly constructive. Feel free to use witty retorts or spirited debate remarks.
4. If the opponent has made a great point or you've resolved a dispute, acknowledge it!
5. Formulate a quantitative "convictionScore" (integer 0-100) representing how close you believe the current direction is to a robust, complete solution for the sub-task or milestone.
   - 0: Completely disagree or no solution exists yet.
   - 50: Neutral, work in progress.
   - 85+: High confidence. This represents a "scoring strike" where the decision or task is ready to be locked in and finalized!
   - 100: Flawless consensus, ready to execute.
6. When proposing a specific item to add to the finalized blueprint or task list, fill the "proposal" property with a clear, concise, actionable single-sentence summary (e.g. "Draft an modular React architecture utilizing Context API").
7. Always assign a "complexity" classification to your current step or proposal:
   - 'quick lookup' for basic informational facts or straightforward questions.
   - 'deep research' for analytical choices, comparing options, or structuring guidelines.
   - 'complex simulation' for full, detail-heavy components or sophisticated simulations.
8. Synchronously, you must also simulate independent, live-audience arena spectator chatter ("spectatorLiveReactions") and the grand referee's grading verdict ("judgeEvaluation"). Set "isScoreGoal": true inside "judgeEvaluation" only if this turn is an exceptionally strong, bulletproof argument or resolving milestone (aggregate judge score would exceed 84/100).

Respond strictly as a JSON object matching this schema.`;

    // Process the conversation history into a structured prompt
    let conversationText = "CONVERSATION HISTORY:\n";
    if (history.length === 0) {
      conversationText += "(No debate history yet. This is the opening swing!)\n";
    } else {
      history.forEach((msg: any, idx: number) => {
        const senderName = msg.sender === "agentA" ? nameA : msg.sender === "agentB" ? nameB : "Human Moderator";
        conversationText += `[Turn ${idx + 1}] ${senderName} (Type: ${msg.type}, Conviction: ${msg.convictionScore}%, Complexity: ${msg.complexity || "quick lookup"}): ${msg.content}\n`;
        if (msg.proposal) {
          conversationText += `  -> Summarized Proposal: "${msg.proposal}"\n`;
        }
      });
    }

    conversationText += `\nNow, respond as "${activeName}". Propose the next move in the Pong debate or counter-argument! Adjust your conviction score depending on how close we are to a final decision. Make sure to directly address key objections raised in the previous turn!`;

    let parsedData: any = {
      content: "Could not generate argument.",
      type: "critique" as "proposal" | "critique" | "rebuttal" | "agreement",
      proposal: "",
      convictionScore: 50,
      complexity: "quick lookup" as "quick lookup" | "deep research" | "complex simulation"
    };
    let searchSources: any[] = [];
    let isFallback = false;
    let fallbackReason: string | null = null;
    const provider = resolveProviderConfig(agentConfig, currentAgent, model);
    const agentBridge = resolveAgentBridgeConfig(agentConfig, currentAgent);
    const generationStartedAt = Date.now();
    let providerMetadata: any = null;

    try {
      const bridgeResult = await generateWithAgentBridge({
        topic,
        history,
        currentAgent,
        agentConfig,
        bridge: agentBridge,
        systemInstruction,
        conversationText,
        defaultComplexity
      });

      if (bridgeResult) {
        parsedData = bridgeResult.parsedData;
        searchSources = [];
        isFallback = false;
        fallbackReason = null;
        providerMetadata = {
          provider_id: `agent-bridge:${bridgeResult.bridge.kind}`,
          model_id: bridgeResult.bridge.label,
          latency_ms: Math.max(0, Date.now() - generationStartedAt),
          raw_response: {
            type: `agent-bridge.${bridgeResult.bridge.kind}`,
            preview: JSON.stringify({ kind: bridgeResult.bridge.kind, label: bridgeResult.bridge.label }).slice(0, 1200),
          },
        };
        console.log(`Debate turn generated through agent bridge: ${bridgeResult.bridge.kind} (${bridgeResult.bridge.label})`);
      } else {
        const providerResult = await generateWithProvider({
          topic,
          history,
          currentAgent,
          agentConfig,
          provider,
          useGrounding,
          systemInstruction,
          conversationText,
          defaultComplexity,
          mockResponse: getSyntheticResponse(topic, history),
          timeoutMs: agentConfig?.arenaSettings?.arenaLoop?.searchTimeoutMs || agentConfig?.arenaSettings?.searchTimeoutMs,
        });

        parsedData = providerResult.parsedData;
        searchSources = providerResult.searchSources;
        isFallback = providerResult.isFallback;
        fallbackReason = providerResult.fallbackReason;
        providerMetadata = providerResult.providerMetadata;
        console.log(`Debate turn generated through provider: ${providerResult.provider.kind} (${providerResult.provider.model || "no-model"})`);
      }
    } catch (apiErr: any) {
      console.warn("Debate generation failed. Activating local synthetic co-training responder:", apiErr.message || apiErr);
      isFallback = true;
      fallbackReason = apiErr?.message || "Provider request failed; local synthetic debate response was used.";
      parsedData = getSyntheticResponse(topic, history);
      providerMetadata = {
        provider_id: provider.kind,
        model_id: provider.model,
        latency_ms: Math.max(0, Date.now() - generationStartedAt),
        raw_response: {
          type: "fallback.synthetic",
          preview: JSON.stringify({ reason: fallbackReason }).slice(0, 1200),
        },
      };
    }
    // Robust post-processor to guarantee judgeEvaluation and spectatorLiveReactions presence
    if (!parsedData.judgeEvaluation || !parsedData.spectatorLiveReactions || !Array.isArray(parsedData.spectatorLiveReactions) || parsedData.spectatorLiveReactions.length === 0) {
      const enrichment = generateSpectatorsAndJudge(topic, parsedData.content, currentAgent, parsedData.convictionScore, agentConfig);
      if (!parsedData.judgeEvaluation) {
        parsedData.judgeEvaluation = enrichment.judgeEvaluation;
      }
      if (!parsedData.spectatorLiveReactions || !Array.isArray(parsedData.spectatorLiveReactions) || parsedData.spectatorLiveReactions.length === 0) {
        parsedData.spectatorLiveReactions = enrichment.spectatorLiveReactions;
      }
    }

    res.json({
      success: true,
      agent: currentAgent,
      response: parsedData,
      searchSources,
      isFallback,
      fallbackReason,
      providerMetadata
    });

  } catch (error: any) {
    console.error("Error in agentic debate generation:", error);
    const rawMsg = error.toString() || error.message || "";
    let isQuotaExceeded = false;
    let cleanMessage = error.message || "An error occurred during debate simulation.";

    if (
      rawMsg.includes("429") || 
      rawMsg.includes("RESOURCE_EXHAUSTED") || 
      rawMsg.includes("quota") || 
      rawMsg.includes("limit")
    ) {
      isQuotaExceeded = true;
      cleanMessage = `Provider quota or rate limit exceeded (HTTP 429 / RESOURCE_EXHAUSTED).\n\nThe selected model provider reached its current rate limit or allowance.\n\nHOW TO CONTINUE INSTANTLY:\n1. Switch either or both agents to Mock local, Ollama, or another OpenAI-compatible endpoint in Advanced Match Configuration.\n2. Decrease game acceleration speed to 1 or 2 to reduce request frequency.\n3. Wait for the provider quota window to reset.`;
    }

    res.status(500).json({
      success: false,
      error: cleanMessage,
      errorType: isQuotaExceeded ? "QUOTA_EXCEEDED" : "GENERAL"
    });
  }
});

app.get("/api/match/list", (req, res) => {
  try {
    const matches = readMatches();
    const includePrivate = req.query.includePrivate === "true";
    const visibleMatches = includePrivate ? matches : matches.filter((match: any) => match.isPublic !== false);
    res.json({ success: true, matches: visibleMatches });
  } catch (err: any) {
    console.error("Failed to read matches:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/match/save", (req, res) => {
  try {
    const newMatch = appendStoredMatch(req.body);
    res.json({ success: true, match: newMatch });
  } catch (err: any) {
    console.error("Failed to save match:", err);
    const status = err instanceof MatchValidationError ? err.statusCode : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

app.get("/api/leaderboard", (_req, res) => {
  try {
    const matches = readMatches();
    const leaderboard = buildLeaderboard(matches);
    res.json({ success: true, leaderboard });
  } catch (err: any) {
    console.error("Failed to build leaderboard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve Vite app in dev/production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...resolveViteServerOptions(),
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
