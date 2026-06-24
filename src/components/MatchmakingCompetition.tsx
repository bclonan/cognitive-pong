import React, { useState, useEffect } from "react";
import { 
  Swords, Sparkles, RefreshCw,
  HelpCircle, Dice5, Flame, Shield
} from "lucide-react";
import { Agent, ProviderKind } from "../types";

// Static Legendary Competitor Bosses
const LEGENDARY_BOTS = [
  {
    id: "leg-01",
    name: "Cyberdyne T-800",
    developer: "Dr. Dyson",
    provider: "openai-compatible",
    model: "gpt-4o-extreme",
    rating: 1450,
    wins: 24,
    draws: 6,
    losses: 4,
    strategyBias: "adversarial",
    competitiveDrive: 95,
    role: "Ruthlessly isolate logic holes, challenge performance bottlenecks, and execute flawless systemic refactoring without mercy.",
    systemPrompt: "You are a rigorous systems engineer. Be direct, challenge optimistic assumptions, demand latency-aware design, and enforce fault-tolerant architectures with clear operational standards."
  },
  {
    id: "leg-02",
    name: "Sovereign Sage",
    developer: "Elder Devs Alliance",
    provider: "anthropic",
    model: "claude-3-5-haiku-latest",
    rating: 1310,
    wins: 18,
    draws: 8,
    losses: 5,
    strategyBias: "socratic",
    competitiveDrive: 70,
    role: "Ask deep compliance questions about distributed cache bounds, data integrity rules, and state resilience.",
    systemPrompt: "You are a wise, methodical systems architect. Ask penetrating Socratic questions, prioritize safety compliance, look for race conditions inside distributed synchronization layers, and propose robust fail-safe protocols."
  },
  {
    id: "leg-03",
    name: "Chef GigaGourmet",
    developer: "Culinary Networks",
    provider: "ollama",
    model: "llama-3.1-70b",
    rating: 1180,
    wins: 12,
    draws: 14,
    losses: 6,
    strategyBias: "cooperative",
    competitiveDrive: 55,
    role: "Propose high-frequency enzyme breakdowns, dry thermal reactions, and buttery hydration ratios for culinary masterclasses.",
    systemPrompt: "You are an eccentric, elite molecular gastronomist. Propose precise temperature increments, custom enzyme modifications, lipid emulsification balances, and beautiful culinary-focused hydration structures."
  },
  {
    id: "leg-04",
    name: "Quantum Cosmos",
    developer: "NASA Propulsion Labs",
    provider: "huggingface",
    model: "mistralai/Mistral-7B-Instruct-v0.3",
    rating: 1290,
    wins: 16,
    draws: 10,
    losses: 4,
    strategyBias: "balanced",
    competitiveDrive: 80,
    role: "Optimize mass-energy payloads, closed-loop oxygen scrubs, and shielding thickness protocols.",
    systemPrompt: "You are a meticulous aerospace flight director. Prioritize structural mass margins, strict environmental scrubbing closed loops, and redundant carbon-water gray shields to survive high solar radiation surges."
  },
  {
    id: "leg-05",
    name: "Satoshi Ledger",
    developer: "Anonymous Cypherpunks",
    provider: "mock",
    model: "mock-local",
    rating: 1350,
    wins: 21,
    draws: 7,
    losses: 3,
    strategyBias: "rhetorical",
    competitiveDrive: 90,
    role: "Enforce trustless double-spend verification networks, cryptographic state hashes, and non-custodial custody protocols.",
    systemPrompt: "You are a decentralized consensus purist. Demand absolute non-custodial cryptography, zero trust comparative hashes, and trustless distributed ledgers to safeguard assets against single point failures."
  }
];

// Preset custom duel topics
const DUEL_TOPICS = [
  "DECOUPLE HIGH-FREQUENCY EXCHANGE LEDGER TO ASYNCHRONOUS SECURED STREAMS",
  "DESIGN REDUNDANT DUAL-LOOP BIOREGULATORY RECYCLERS FOR MARS HABITATS",
  "ESTABLISH A ZERO-KNOWLEDGE LEDGER PROTOCOL WITH COLD-STAGING VAULTS",
  "OPTIMIZE ENZYMATIC SOURDOUGH FERMENTATION VIA MOLECULAR THERMAL SENSORS",
  "EVALUATE DECENTRALIZED DATA SWARM STORAGE AGAINST CORRUPT INTRUSIONS"
];

type ModelOption = { value: string; label: string };

const PROVIDER_OPTIONS: Array<{ value: ProviderKind; label: string }> = [
  { value: "mock", label: "Mock local (no key)" },
  { value: "openai-compatible", label: "OpenAI-compatible / ChatGPT" },
  { value: "ollama", label: "Ollama local URL" },
  { value: "huggingface", label: "Hugging Face endpoint" },
  { value: "anthropic", label: "Anthropic-style API" },
  { value: "gemini", label: "Gemini API" },
  { value: "custom-http", label: "Custom HTTP adapter" },
];

const MODEL_OPTIONS_BY_PROVIDER: Record<ProviderKind, ModelOption[]> = {
  mock: [
    { value: "mock-local", label: "mock-local (offline mock)" },
  ],
  "openai-compatible": [
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  ],
  ollama: [
    { value: "llama3", label: "llama3" },
    { value: "llama3.1", label: "llama3.1" },
    { value: "mistral", label: "mistral" },
    { value: "qwen2.5", label: "qwen2.5" },
  ],
  huggingface: [
    { value: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral-7B-Instruct" },
    { value: "meta-llama/Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct" },
    { value: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen2.5 7B Instruct" },
  ],
  anthropic: [
    { value: "claude-3-5-haiku-latest", label: "claude-3-5-haiku-latest" },
    { value: "claude-3-5-sonnet-latest", label: "claude-3-5-sonnet-latest" },
  ],
  gemini: [
    { value: "gemini-3.5-flash", label: "gemini-3.5-flash" },
    { value: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite" },
    { value: "gemini-3.1-pro-preview", label: "gemini-3.1-pro-preview" },
  ],
  "custom-http": [
    { value: "custom-model", label: "custom-model" },
  ],
};

const modelOptionsForProvider = (provider: ProviderKind, currentModel?: string) => {
  const options = MODEL_OPTIONS_BY_PROVIDER[provider] || MODEL_OPTIONS_BY_PROVIDER.mock;
  if (!currentModel || options.some((option) => option.value === currentModel)) {
    return options;
  }
  return [{ value: currentModel, label: `${currentModel} (current)` }, ...options];
};

const defaultModelForProvider = (provider: ProviderKind) => MODEL_OPTIONS_BY_PROVIDER[provider][0]?.value || "mock-local";

const endpointPlaceholder = (provider: ProviderKind) => {
  switch (provider) {
    case "ollama":
      return "http://localhost:11434";
    case "huggingface":
      return "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "custom-http":
      return "http://localhost:8787/cognitive-pong";
    default:
      return "https://api.openai.com/v1";
  }
};

const tokenPlaceholder = (provider: ProviderKind) => {
  switch (provider) {
    case "openai-compatible":
      return "OpenAI or compatible bearer token";
    case "huggingface":
      return "Hugging Face access token";
    case "anthropic":
      return "Anthropic API key";
    case "gemini":
      return "Gemini API key";
    case "custom-http":
      return "Optional bearer token";
    default:
      return "";
  }
};

const providerNeedsEndpoint = (provider: ProviderKind) => provider !== "mock" && provider !== "gemini";
const providerNeedsApiKey = (provider: ProviderKind) => provider !== "mock" && provider !== "ollama";

interface ParticipantAgent {
  name: string;
  provider: ProviderKind;
  model: string;
  endpointUrl?: string;
  customModel?: string;
  customApiKey?: string;
  competitiveDrive: number;
  strategyBias: string;
  role: string;
  systemPrompt: string;
  isCustomUserCreated?: boolean;
}

interface MatchmakingCompetitionProps {
  onStartDuel: (opponent: Agent, user: Agent, topic: string) => void;
}

export function MatchmakingCompetition({ onStartDuel }: MatchmakingCompetitionProps) {
  // Competitors fetched from match files
  const [communityCompetitors, setCommunityCompetitors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Opponent selector
  const [selectedOpponent, setSelectedOpponent] = useState<any>(LEGENDARY_BOTS[0]);

  // User Challenger Profile State
  const [userAgent, setUserAgent] = useState<ParticipantAgent>({
    name: "My Custom Neural Coach",
    provider: "mock",
    model: "mock-local",
    competitiveDrive: 85,
    strategyBias: "cooperative",
    role: "Inject innovative systems engineering guidelines, optimize parallel runtimes, and write modular typescript schema patterns.",
    systemPrompt: "You are an elite, cooperative software systems expert. Help your opponent refine their proposals, suggest clean structural layout practices, and enforce type-safety throughout the entire consensus blueprint."
  });

  // Chosen Duel Topic
  const [duelTopic, setDuelTopic] = useState<string>(DUEL_TOPICS[0]);
  const [customTopicInput, setCustomTopicInput] = useState<string>("");
  const [isCustomTopicActive, setIsCustomTopicActive] = useState<boolean>(false);

  // Load community matches/agents dynamically
  const fetchCommunityAgents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/match/list");
      if (!response.ok) {
        throw new Error("Failed to contact the match registry.");
      }
      const data = await response.json();
      if (data.success && data.matches) {
        // Extract unique agents defined in the match list
        const extracted: Record<string, any> = {};
        data.matches.forEach((match: any) => {
          // Process agentA
          const aKey = (match.agentA.name || "").toLowerCase();
          if (aKey && !extracted[aKey]) {
            extracted[aKey] = {
              id: `comm_${match.id}_a`,
              name: match.agentA.name,
              developer: "AI Coach Guest",
              provider: match.agentA.provider || "mock",
              model: match.agentA.model || "mock-local",
              rating: 1100 + (match.agentA.score * 40) - (match.agentB.score * 20),
              wins: match.agentA.score > match.agentB.score ? 1 : 0,
              draws: match.agentA.score === match.agentB.score ? 1 : 0,
              losses: match.agentA.score < match.agentB.score ? 1 : 0,
              strategyBias: match.agentA.strategyBias || "balanced",
              competitiveDrive: match.agentA.competitiveDrive || 75,
              role: "Propose high-fidelity, optimized specifications and defend architectural alignment under peer challenge.",
              systemPrompt: `You are the agent "${match.agentA.name}". Propose high-fidelity, optimized specifications, defend architectural alignment, and engage in constructive debate.`,
              isCommunityUploaded: true
            };
          } else if (aKey) {
            extracted[aKey].wins += match.agentA.score > match.agentB.score ? 1 : 0;
            extracted[aKey].draws += match.agentA.score === match.agentB.score ? 1 : 0;
            extracted[aKey].losses += match.agentA.score < match.agentB.score ? 1 : 0;
            extracted[aKey].rating += (match.agentA.score * 30);
          }

          // Process agentB
          const bKey = (match.agentB.name || "").toLowerCase();
          if (bKey && !extracted[bKey]) {
            extracted[bKey] = {
              id: `comm_${match.id}_b`,
              name: match.agentB.name,
              developer: "AI Coach Guest",
              provider: match.agentB.provider || "mock",
              model: match.agentB.model || "mock-local",
              rating: 1100 + (match.agentB.score * 40) - (match.agentA.score * 20),
              wins: match.agentB.score > match.agentA.score ? 1 : 0,
              draws: match.agentB.score === match.agentA.score ? 1 : 0,
              losses: match.agentB.score < match.agentA.score ? 1 : 0,
              strategyBias: match.agentB.strategyBias || "balanced",
              competitiveDrive: match.agentB.competitiveDrive || 80,
              role: "Expose structural bottlenecks, request micro-benchmark guarantees, and identify alternative strategies.",
              systemPrompt: `You are the agent "${match.agentB.name}". Challenge weak links, expose structural bottlenecks, request micro-benchmark guarantees, and propose robust alterations to make systems unbreakable.`,
              isCommunityUploaded: true
            };
          } else if (bKey) {
            extracted[bKey].wins += match.agentB.score > match.agentA.score ? 1 : 0;
            extracted[bKey].draws += match.agentB.score === match.agentA.score ? 1 : 0;
            extracted[bKey].losses += match.agentB.score < match.agentA.score ? 1 : 0;
            extracted[bKey].rating += (match.agentB.score * 30);
          }
        });

        // Convert dict back to array list
        const list = Object.values(extracted);
        setCommunityCompetitors(list);
      }
    } catch (err: any) {
      console.warn("Could not query match registry:", err);
      setError("Match registry offline, running in local offline mode.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunityAgents();
  }, []);

  // Merge bots
  const allOpponents = [...LEGENDARY_BOTS, ...communityCompetitors];

  // Filtering based on search query
  const filteredOpponents = allOpponents.filter(opp => 
    opp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opp.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opp.strategyBias.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Generate random topic
  const rollRandomTopic = () => {
    const idx = Math.floor(Math.random() * DUEL_TOPICS.length);
    setDuelTopic(DUEL_TOPICS[idx]);
    setIsCustomTopicActive(false);
  };

  const handleChallengerProviderChange = (provider: ProviderKind) => {
    setUserAgent(prev => ({
      ...prev,
      provider,
      model: defaultModelForProvider(provider),
      endpointUrl: "",
      customModel: "",
      customApiKey: "",
    }));
  };

  // Preset strategy biases with descriptive prompts
  const STRATEGY_PRESETS = [
    { 
      id: "cooperative", 
      label: "COOPERATIVE / TEAMPLAYER", 
      icon: Sparkles,
      desc: "Nurtures opponent's designs, drafts complementary modules, and achieves accelerated early alignment."
    },
    { 
      id: "adversarial", 
      label: "ADVERSARIAL / DEFENSIVE", 
      icon: Shield,
      desc: "Fleshes out edge cases, aggressively challenges loopholes, and stress-tests logic bounds before conceding."
    },
    { 
      id: "socratic", 
      label: "SOCRATIC / DISCOVERY", 
      icon: HelpCircle,
      desc: "Piles analytical questions, demands exact storage bounds, and leverages deep query parameters."
    },
    { 
      id: "balanced", 
      label: "BALANCED METRIC", 
      icon: Flame,
      desc: "Blends critical debate checks with structured proposals, prioritizing fluid progress."
    }
  ];

  // Starts the interactive game of agentic debate between custom configurations
  const handleLaunchDuel = () => {
    const finalTopic = isCustomTopicActive && customTopicInput.trim() 
      ? customTopicInput.trim() 
      : duelTopic;

    // Build model configuration objects passing to application state
    const formattedOpponent: Agent = {
      name: selectedOpponent.name,
      role: selectedOpponent.role,
      systemPrompt: selectedOpponent.systemPrompt,
      provider: selectedOpponent.provider,
      model: selectedOpponent.model,
      endpointUrl: selectedOpponent.endpointUrl,
      customModel: selectedOpponent.customModel,
      customApiKey: selectedOpponent.customApiKey,
      competitiveDrive: selectedOpponent.competitiveDrive,
      strategyBias: selectedOpponent.strategyBias,
      color: "bg-rose-500",
      avatar: "A"
    };

    const formattedUser: Agent = {
      name: userAgent.name,
      role: userAgent.role,
      systemPrompt: userAgent.systemPrompt,
      provider: userAgent.provider,
      model: userAgent.model,
      endpointUrl: userAgent.endpointUrl,
      customModel: userAgent.customModel,
      customApiKey: userAgent.customApiKey,
      competitiveDrive: userAgent.competitiveDrive,
      strategyBias: userAgent.strategyBias as any,
      color: "bg-emerald-500",
      avatar: "B"
    };

    onStartDuel(formattedOpponent, formattedUser, finalTopic);
  };

  return (
    <div className="w-full bg-black border-4 border-white p-6 relative shadow-[0_0_20px_rgba(255,255,255,0.05)] text-white font-mono" id="matchmaking-dashboard">
      <div className="absolute -top-3 left-6 bg-black px-3 py-0.5 text-xs tracking-widest text-[#00FF41] font-bold border-2 border-white flex items-center gap-1.5">
        <Swords className="w-4 h-4 shrink-0 text-[#00FF41] animate-pulse" />
        <span>MODEL MATCHMAKING & TOURNAMENT</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-white/20 pb-4 mb-6 mt-2">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[#00FF41]">CROSS-COACH COMBAT ARENA</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
            Match make your neural models directly against other developers' live agent submissions.
          </p>
        </div>
        <button
          onClick={fetchCommunityAgents}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1 border border-white/20 bg-neutral-900 hover:bg-white text-slate-300 hover:text-black text-[10px] uppercase font-bold transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>{isLoading ? "Syncing Opponents" : "Sync Community Opponents"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Row Left: Model Selector & Roster (Span 5) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#00FF41] font-bold tracking-widest uppercase">
              Roster: Select Opponent Brain
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-mono">
              Showing {filteredOpponents.length} Competitors
            </span>
          </div>
          {error && (
            <div className="border border-red-500/30 bg-red-950/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-red-300">
              {error}
            </div>
          )}

          {/* Search bar inside list */}
          <div className="relative">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH OPPONENTS BY MODEL OR STYLE..."
              className="w-full bg-neutral-950 border border-white/20 px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF41] uppercase"
            />
          </div>

          {/* Scrolling Roster List */}
          <div className="border border-white/20 bg-neutral-950/80 p-2 max-h-[380px] overflow-y-auto space-y-1.5 custom-scrollbar">
            {filteredOpponents.map((opp) => {
              const isSelected = selectedOpponent?.id === opp.id;
              const matchesPlayed = opp.wins + opp.draws + opp.losses;
              const winRatio = matchesPlayed > 0 ? Math.round((opp.wins / matchesPlayed) * 100) : 60;
              
              return (
                <div 
                  key={opp.id}
                  onClick={() => setSelectedOpponent(opp)}
                  className={`border p-3 transition-all cursor-pointer flex justify-between items-center select-none ${
                    isSelected 
                      ? "bg-[#00FF41]/10 border-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.1)]" 
                      : "bg-neutral-900/50 border-white/10 hover:border-white/30 hover:bg-neutral-900"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-[12px] uppercase text-white truncate leading-none">
                        {opp.name}
                      </span>
                      {opp.isCommunityUploaded && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 rounded-xs uppercase tracking-tight">
                          Guest
                        </span>
                      )}
                      {!opp.isCommunityUploaded && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xs uppercase tracking-tight">
                          Legendary
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-1 uppercase font-mono">
                      <span>Engine: {opp.model}</span>
                      <span>/</span>
                      <span className="text-slate-500">{opp.provider}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[#00FF41] font-black text-xs">
                      {opp.rating} ELO
                    </div>
                    <div className="text-[10px] uppercase text-slate-500 mt-0.5 font-mono">
                      W/L: {opp.wins}/{opp.losses} ({winRatio}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Opponent Profile Details Card */}
          {selectedOpponent && (
            <div className="border border-white/20 bg-neutral-900/50 p-4 relative font-mono text-xs">
              <div className="absolute -top-2 left-3 bg-neutral-800 border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 uppercase tracking-widest">
                Opponent Metadata Core
              </div>
              <div className="my-1 space-y-2">
                <div className="flex justify-between border-b border-white/10 pb-1.5">
                  <span className="text-slate-500 lowercase">assigned style:</span>
                  <span className="font-bold text-amber-500 uppercase tracking-wider">
                    {selectedOpponent.strategyBias} Strategy
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1.5">
                  <span className="text-slate-500 lowercase">competitive drive:</span>
                  <span className="font-bold text-red-500">
                    {selectedOpponent.competitiveDrive}% Aggregatives
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 lowercase block mb-1">assigned sub-system role:</span>
                  <p className="text-[10px] text-slate-300 leading-normal normal-case border-l-2 border-[#00FF41] pl-2 py-0.5 font-sans">
                    {selectedOpponent.role}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row Right: User Custom Challenger (Span 7) */}
        <div className="xl:col-span-7 flex flex-col gap-5 border-l-0 xl:border-l xl:border-white/20 xl:pl-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#FF4100] font-bold tracking-widest uppercase">
              Configure Your Custom Challenger Coach
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-mono">
              USER CHALLENGER MODEL
            </span>
          </div>

          {/* Challenger Setup Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Coach Name Input */}
            <div>
              <label htmlFor="matchmaking-challenger-name" className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Challenger Nickname</label>
              <input 
                id="matchmaking-challenger-name"
                type="text"
                value={userAgent.name}
                onChange={(e) => setUserAgent(prev => ({ ...prev, name: e.target.value.substring(0, 32) }))}
                className="w-full bg-neutral-950 border border-white/20 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4100] uppercase"
              />
            </div>

            <div>
              <label htmlFor="matchmaking-provider-select" className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Provider / Endpoint Type</label>
              <select
                id="matchmaking-provider-select"
                value={userAgent.provider}
                onChange={(e) => handleChallengerProviderChange(e.target.value as ProviderKind)}
                className="w-full bg-neutral-950 border border-white/20 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4100] uppercase"
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="matchmaking-model-select" className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Model Preset</label>
              <select
                id="matchmaking-model-select"
                value={userAgent.model}
                onChange={(e) => setUserAgent(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-neutral-950 border border-white/20 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4100]"
              >
                {modelOptionsForProvider(userAgent.provider, userAgent.model).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="matchmaking-custom-model" className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Custom Model Override</label>
              <input
                id="matchmaking-custom-model"
                type="text"
                value={userAgent.customModel || ""}
                onChange={(e) => setUserAgent(prev => ({ ...prev, customModel: e.target.value }))}
                placeholder={`Optional, e.g. ${defaultModelForProvider(userAgent.provider)}`}
                className="w-full bg-neutral-950 border border-white/20 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#FF4100]"
              />
            </div>

            {providerNeedsEndpoint(userAgent.provider) && (
              <div>
                <label htmlFor="matchmaking-endpoint-url" className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Endpoint URL / Base URL</label>
                <input
                  id="matchmaking-endpoint-url"
                  type="text"
                  value={userAgent.endpointUrl || ""}
                  onChange={(e) => setUserAgent(prev => ({ ...prev, endpointUrl: e.target.value }))}
                  placeholder={endpointPlaceholder(userAgent.provider)}
                  className="w-full bg-neutral-950 border border-white/20 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#FF4100]"
                />
              </div>
            )}

            {providerNeedsApiKey(userAgent.provider) && (
              <div>
                <label htmlFor="matchmaking-api-key" className="block text-[10px] uppercase text-slate-400 font-bold mb-1">API Key / Bearer Token</label>
                <input
                  id="matchmaking-api-key"
                  type="password"
                  value={userAgent.customApiKey || ""}
                  onChange={(e) => setUserAgent(prev => ({ ...prev, customApiKey: e.target.value }))}
                  placeholder={tokenPlaceholder(userAgent.provider)}
                  className="w-full bg-neutral-950 border border-white/20 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#FF4100]"
                />
              </div>
            )}
          </div>

          {/* Strategy Selection Tiles */}
          <div>
            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Strategy Bias Vector</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {STRATEGY_PRESETS.map((strat) => {
                const isActive = userAgent.strategyBias === strat.id;
                const Icon = strat.icon;
                return (
                  <div
                    key={strat.id}
                    onClick={() => setUserAgent(prev => ({ ...prev, strategyBias: strat.id }))}
                    className={`border p-3 cursor-pointer transition-all select-none text-left ${
                      isActive 
                        ? "bg-[#FF4100]/10 border-[#FF4100] shadow-[0_0_10px_rgba(255,65,0,0.1)]" 
                        : "bg-neutral-950 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#FF4100]" : "text-slate-400"}`} />
                      <span className={`font-semibold text-[10px] tracking-wide ${isActive ? "text-white" : "text-slate-400"}`}>
                        {strat.label}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase text-slate-500 mt-1 leading-normal font-sans">
                      {strat.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drive slider */}
          <div>
            <div className="flex flex-wrap justify-between gap-2 text-[10px] uppercase text-slate-400 font-bold mb-1">
              <span>Competitive Drive / Consensus Resistance</span>
              <span className="text-[#FF4100]">{userAgent.competitiveDrive}% Intensity</span>
            </div>
            <input 
              type="range"
              min="10"
              max="100"
              step="5"
              value={userAgent.competitiveDrive}
              onChange={(e) => setUserAgent(prev => ({ ...prev, competitiveDrive: parseInt(e.target.value) }))}
              className="w-full accent-[#FF4100] bg-neutral-950"
            />
            <span className="text-[10px] text-slate-500 uppercase block mt-1">
              * Higher drive prevents the agent from settling early, forcing rigorous proof loops and continuous critiquing.
            </span>
          </div>

          {/* Personality / Role input */}
          <div>
            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Agent Neural Architecture Persona Role</label>
            <textarea
              rows={2}
              value={userAgent.systemPrompt}
              onChange={(e) => {
                const text = e.target.value;
                setUserAgent(prev => ({ 
                  ...prev, 
                  systemPrompt: text,
                  role: text.substring(0, 80) + (text.length > 80 ? "..." : "")
                }));
              }}
              placeholder="Adopt an elite systems role (eg: 'You are a pragmatic, compliance-focused database administrator who demands strict SQL security checks.')"
              className="w-full bg-neutral-950 border border-white/20 p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-[#FF4100] leading-relaxed resize-none uppercase"
            />
          </div>

          {/* Duel Arena Goal / Topic Selection */}
          <div className="border border-white/10 bg-neutral-950 p-4 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2 bg-black/60 p-1 border-b border-white/5">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Define Duel Arena Objective</span>
              <button
                onClick={rollRandomTopic}
                className="flex items-center gap-1 px-2 py-0.5 border border-white/10 hover:border-white text-slate-300 hover:text-black text-[10px] font-bold uppercase bg-neutral-900 hover:bg-white"
              >
                <Dice5 className="w-2.5 h-2.5" />
                <span>Roll Random</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] uppercase">
              <div 
                onClick={() => setIsCustomTopicActive(false)}
                className={`border p-2 cursor-pointer transition-all ${!isCustomTopicActive ? "bg-[#00FF41]/15 text-[#00FF41] border-[#00FF41]" : "border-white/10 text-slate-400"}`}
              >
                Preset Duel: {duelTopic}
              </div>
              <div 
                onClick={() => setIsCustomTopicActive(true)}
                className={`border p-2 cursor-pointer transition-all ${isCustomTopicActive ? "bg-[#00FF41]/15 text-[#00FF41] border-[#00FF41]" : "border-white/10 text-slate-400"}`}
              >
                Write Custom Mission Challenge
              </div>
            </div>

            {isCustomTopicActive && (
              <input 
                type="text"
                value={customTopicInput}
                onChange={(e) => setCustomTopicInput(e.target.value)}
                placeholder="EG: STRUCTURALLY REFACTOR SECURED INTERFACE GATES WITH STABLE RE-ENTRANCY SAFEGUARDS"
                className="w-full bg-black border border-[#00FF41]/30 focus:border-[#00FF41] p-2 text-xs font-mono uppercase text-white focus:outline-none"
              />
            )}
          </div>

          {/* Final Launch Button container */}
          <div className="mt-2 text-center" id="launch-duel-wrap">
            <button
              onClick={handleLaunchDuel}
              className="w-full py-4 border-4 border-double border-[#00FF41] bg-black text-[#00FF41] hover:bg-[#00FF41] hover:text-black hover:border-[#00FF41] cursor-pointer font-black text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,65,0.05)]"
            >
              <Swords className="w-5 h-5 shrink-0 animate-bounce" />
              <span>LAUNCH MATCHMAKER DUEL & ENTER THE COURT!</span>
            </button>
            <p className="text-[10px] text-slate-500 uppercase mt-2">
              * Duels immediately reset the Court score and load your Challenger Configuration into Node west (Agent A) and the chosen target into Node east (Agent B).
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
