import React, { useEffect, useState } from "react";
import { AgentBridgeConfig, AgentBridgeKind, AgentConfig, ArenaAdvancedSettings, ArenaLoopRuntimeSettings, ArenaSearchProvider, ProviderKind } from "../types";
import { PRESET_SCENARIOS } from "../data/presets";
import { ChevronDown, Sliders, ShieldAlert, Cpu, Sparkles, Landmark, Check, Terminal, Minus, Plus } from "lucide-react";
import {
  ARENA_MATCH_ENGINE_OPTIONS,
  ARENA_MEMORY_OPTIONS,
  ARENA_OPTIMIZER_OPTIONS,
  ARENA_POPULATION_OPTIONS,
  ARENA_PROMOTION_OPTIONS,
  ARENA_SANDBOX_OPTIONS,
  normalizeArenaSettings,
} from "../utils/arenaSettings";
import {
  ARENA_SEARCH_PROVIDER_OPTIONS,
  normalizeArenaLoopRuntimeSettings,
} from "../utils/arenaLoop";
import {
  MODEL_OPTIONS,
  PROVIDER_OPTIONS,
  applyAgentModelSelection,
  applyAgentProviderSelection,
  applyAgentTemplatePreservingRuntime,
  endpointPlaceholder,
  modelOptionsForProvider,
  modelPlaceholder,
  providerNeedsApiKey,
  providerNeedsEndpoint,
  providerTokenPlaceholder,
  resolveAgentModelSelection,
} from "../utils/providerControls";
import { copyTextToClipboard } from "../utils/clipboard";
import {
  BRIDGE_OPTIONS,
  bridgeEndpointPlaceholder,
  bridgeProfilePlaceholder,
  bridgeUsesCommand,
  bridgeUsesEndpoint,
  defaultBridgeProfileForKind,
} from "../utils/agentBridgeControls";

interface ConfigPanelProps {
  topic: string;
  onTopicChange: (topic: string) => void;
  agentConfig: AgentConfig;
  onAgentConfigChange: (config: AgentConfig) => void;
  status: "idle" | "debating" | "paused" | "researching_A" | "researching_B" | "scoring_A" | "scoring_B" | "completed";
  onStartMatch: () => void;
  onPauseMatch: () => void;
  onResetMatch: () => void;
  onStepTurn: () => void;
  onModeratorIntervene: (comment: string) => void;
  gameSpeed: number;
  onSpeedChange: (speed: number) => void;
  isPublicMatch: boolean;
  onIsPublicMatchChange: (val: boolean) => void;
  onPublishMatch: () => void;
  isPublishing: boolean;
  isPublished: boolean;
  canPublishMatch: boolean;
  onOpenReplay?: () => void;
  canEditAgentRuntime?: boolean;
  mode?: "full" | "advancedOnly";
}

const HTTP_AGENT_BRIDGE_EXAMPLE = [
  "const express = require('express');",
  "const app = express();",
  "app.use(express.json({ limit: '1mb' }));",
  "",
  "app.post('/cognitive-pong/turn', async (req, res) => {",
  "  const { topic, currentAgent, prompt } = req.body;",
  "  // Forward prompt to your local agent, service, or coding tool here.",
  "  // Return Cognitive Pong JSON. Plain text also works.",
  "  res.json({",
  "    content: `Bridge turn for ${currentAgent}: reviewed ${topic}.`,",
  "    type: 'critique',",
  "    proposal: '',",
  "    convictionScore: 64,",
  "    complexity: 'deep research'",
  "  });",
  "});",
  "",
  "app.listen(8787, () => {",
  "  console.log('Cognitive Pong bridge listening on http://localhost:8787/cognitive-pong/turn');",
  "});",
].join("\n");

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  topic,
  onTopicChange,
  agentConfig,
  onAgentConfigChange,
  status,
  onStartMatch,
  onPauseMatch,
  onResetMatch,
  onStepTurn,
  onModeratorIntervene,
  gameSpeed,
  onSpeedChange,
  isPublicMatch,
  onIsPublicMatchChange,
  onPublishMatch,
  isPublishing,
  isPublished,
  canPublishMatch,
  onOpenReplay,
  canEditAgentRuntime = true,
  mode = "full"
}) => {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(0);
  const [modComment, setModComment] = useState("");
  const [guideTab, setGuideTab] = useState<"ollama" | "codex" | "tunnel">("ollama");
  const [isGuideExpanded, setIsGuideExpanded] = useState<boolean>(false);
  const [copiedOllamaCmd, setCopiedOllamaCmd] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    const didCopy = await copyTextToClipboard(text);

    if (didCopy) {
      setCopyError(null);
      setCopiedOllamaCmd(label);
      setTimeout(() => setCopiedOllamaCmd(null), 2000);
      return;
    }

    setCopyError("Clipboard permission was blocked. Select the command text and copy it manually.");
    setTimeout(() => setCopyError(null), 3500);
  };

  useEffect(() => {
    if (selectedPreset === null) return;
    const preset = PRESET_SCENARIOS[selectedPreset];
    if (!preset) {
      setSelectedPreset(null);
      return;
    }

    const matchesPreset =
      topic === preset.topic &&
      agentConfig.agentA.name === preset.agentA.name &&
      agentConfig.agentA.role === preset.agentA.role &&
      agentConfig.agentA.avatar === preset.agentA.avatar &&
      agentConfig.agentB.name === preset.agentB.name &&
      agentConfig.agentB.role === preset.agentB.role &&
      agentConfig.agentB.avatar === preset.agentB.avatar;

    if (!matchesPreset) {
      setSelectedPreset(null);
    }
  }, [
    selectedPreset,
    topic,
    agentConfig.agentA.name,
    agentConfig.agentA.role,
    agentConfig.agentA.avatar,
    agentConfig.agentB.name,
    agentConfig.agentB.role,
    agentConfig.agentB.avatar,
  ]);

  const handleTopicChange = (value: string) => {
    onTopicChange(value);
    setSelectedPreset(null);
  };

  const handleSelectPreset = (index: number) => {
    if (!isConfigurable) return;
    setSelectedPreset(index);
    const preset = PRESET_SCENARIOS[index];
    onTopicChange(preset.topic);
    onAgentConfigChange({
      ...agentConfig,
      agentA: applyAgentTemplatePreservingRuntime(preset.agentA, agentConfig.agentA),
      agentB: applyAgentTemplatePreservingRuntime(preset.agentB, agentConfig.agentB)
    });
  };

  const handleAgentInputChange = (
    agent: "agentA" | "agentB",
    field: "name" | "role" | "color" | "avatar" | "provider" | "endpointUrl" | "customModel" | "customApiKey" | "model" | "systemPrompt" | "temperature" | "maxTokens" | "competitiveDrive" | "strategyBias" | "aggressiveness" | "empathy",
    value: string | number
  ) => {
    const nextAgent =
      field === "model"
        ? applyAgentModelSelection(agentConfig[agent], String(value))
        : {
            ...agentConfig[agent],
            [field]: value
          };

    onAgentConfigChange({
      ...agentConfig,
      [agent]: nextAgent
    });
    setSelectedPreset(null); // Deselect presets on direct customization
  };

  const handleAgentProviderChange = (agent: "agentA" | "agentB", provider: ProviderKind) => {
    if (!canEditAgentRuntime) return;
    onAgentConfigChange({
      ...agentConfig,
      [agent]: applyAgentProviderSelection(agentConfig[agent], provider),
    });
    setSelectedPreset(null);
  };

  const renderAgentProviderControls = (agentKey: "agentA" | "agentB") => {
    const agent = agentConfig[agentKey];
    const provider = agent.provider || "mock";
    const selectedModel = resolveAgentModelSelection(agent, agentConfig.model);
    const idPrefix = agentKey === "agentA" ? "agent-a" : "agent-b";
    const accentText = agentKey === "agentA" ? "text-[#00FF41]" : "text-[#FF4100]";
    const focusBorder = agentKey === "agentA" ? "focus:border-[#00FF41]" : "focus:border-[#FF4100]";
    const borderTop = agentKey === "agentA" ? "border-[#00FF41]/20" : "border-[#FF4100]/20";

    return (
      <div className={`space-y-2 pt-2 border-t ${borderTop}`}>
        <div>
          <label htmlFor={`${idPrefix}-provider-select`} className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Provider / engine</label>
          <select
            id={`${idPrefix}-provider-select`}
            value={provider}
            disabled={!canEditAgentRuntime}
            onChange={(e) => handleAgentProviderChange(agentKey, e.target.value as ProviderKind)}
            className={`w-full bg-black border border-white/20 p-1 text-[10px] text-white focus:outline-none ${focusBorder} font-mono`}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-model-select`} className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Model preset</label>
          <select
            id={`${idPrefix}-model-select`}
            value={selectedModel}
            disabled={!canEditAgentRuntime}
            onChange={(e) => handleAgentInputChange(agentKey, "model", e.target.value)}
            className={`w-full bg-black border border-white/20 p-1 text-[10px] ${accentText} focus:outline-none ${focusBorder} font-mono`}
          >
            {modelOptionsForProvider(provider, selectedModel).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-custom-model-input`} className={`text-[10px] font-mono ${accentText} uppercase block mb-0.5`}>Custom model override</label>
          <input
            id={`${idPrefix}-custom-model-input`}
            type="text"
            value={agent.customModel || ""}
            placeholder={`Optional, e.g. ${modelPlaceholder(provider)}`}
            disabled={!canEditAgentRuntime}
            onChange={(e) => handleAgentInputChange(agentKey, "customModel", e.target.value)}
            className={`w-full bg-black border border-white/20 p-1 text-[10px] text-slate-300 focus:outline-none ${focusBorder} font-mono`}
          />
        </div>

        {providerNeedsEndpoint(provider) && (
          <div>
            <label htmlFor={`${idPrefix}-endpoint-url-input`} className={`text-[10px] font-mono ${accentText} uppercase block mb-0.5`}>Endpoint URL / base URL</label>
            <input
              id={`${idPrefix}-endpoint-url-input`}
              type="text"
              value={agent.endpointUrl || ""}
              placeholder={endpointPlaceholder(provider, agent.customModel || selectedModel)}
              disabled={!canEditAgentRuntime}
              onChange={(e) => handleAgentInputChange(agentKey, "endpointUrl", e.target.value)}
              className={`w-full bg-black border border-white/20 p-1 text-[10px] text-slate-300 focus:outline-none ${focusBorder} font-mono`}
            />
          </div>
        )}

        {providerNeedsApiKey(provider) && (
          <div>
            <label htmlFor={`${idPrefix}-api-key-input`} className={`text-[10px] font-mono ${accentText} uppercase block mb-0.5`}>API key / bearer token</label>
            <input
              id={`${idPrefix}-api-key-input`}
              type="password"
              value={agent.customApiKey || ""}
              placeholder={providerTokenPlaceholder(provider)}
              disabled={!canEditAgentRuntime}
              onChange={(e) => handleAgentInputChange(agentKey, "customApiKey", e.target.value)}
              className={`w-full bg-black border border-white/20 p-1 text-[10px] text-slate-300 focus:outline-none ${focusBorder} font-mono`}
            />
          </div>
        )}
      </div>
    );
  };

  const updateBridgeConfig = (patch: Partial<AgentBridgeConfig>) => {
    const nextBridge: AgentBridgeConfig = {
      kind: agentConfig.bridge?.kind || "none",
      ...agentConfig.bridge,
      ...patch,
    };

    if (patch.kind === "none") {
      onAgentConfigChange({
        ...agentConfig,
        bridge: { kind: "none" },
      });
      return;
    }

    if (bridgeUsesEndpoint(patch.kind)) {
      delete nextBridge.command;
      delete nextBridge.args;
      delete nextBridge.cwd;
      delete nextBridge.profileId;
    }

    if (bridgeUsesCommand(patch.kind)) {
      delete nextBridge.endpointUrl;
      delete nextBridge.apiKey;
      delete nextBridge.toolName;
      delete nextBridge.command;
      delete nextBridge.args;
      delete nextBridge.cwd;
      nextBridge.profileId = nextBridge.profileId || defaultBridgeProfileForKind(patch.kind);
    }

    onAgentConfigChange({
      ...agentConfig,
      bridge: nextBridge,
    });
  };

  const handleInjectedIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modComment.trim()) return;
    onModeratorIntervene(modComment.trim());
    setModComment("");
  };

  const isConfigurable = status === "idle" || status === "paused" || status === "completed";
  const arenaSettings = normalizeArenaSettings(agentConfig.arenaSettings);
  const arenaLoopSettings = normalizeArenaLoopRuntimeSettings(agentConfig.arenaLoop);

  const handleArenaSettingChange = <K extends keyof ArenaAdvancedSettings>(
    field: K,
    value: ArenaAdvancedSettings[K]
  ) => {
    onAgentConfigChange({
      ...agentConfig,
      arenaSettings: {
        ...arenaSettings,
        [field]: value,
      },
    });
  };

  const handleArenaLoopSettingChange = <K extends keyof ArenaLoopRuntimeSettings>(
    field: K,
    value: ArenaLoopRuntimeSettings[K]
  ) => {
    onAgentConfigChange({
      ...agentConfig,
      arenaLoop: normalizeArenaLoopRuntimeSettings({
        ...arenaLoopSettings,
        [field]: value,
      }),
    });
  };

  const handleSpeedInput = (value: number) => {
    if (!Number.isFinite(value)) return;
    onSpeedChange(Math.max(1, Math.min(5, Math.round(value))));
  };

  const handleAgentNumberKnob = (
    agent: "agentA" | "agentB",
    field: "competitiveDrive" | "temperature" | "maxTokens" | "aggressiveness" | "empathy",
    value: number,
    min: number,
    max: number,
    step: number
  ) => {
    if (!Number.isFinite(value)) return;
    const stepped = Math.round(value / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    const normalized = step < 1 ? Number(clamped.toFixed(1)) : Math.round(clamped);
    handleAgentInputChange(agent, field, normalized);
  };

  const renderAgentNumberKnob = (
    agent: "agentA" | "agentB",
    field: "competitiveDrive" | "temperature" | "maxTokens" | "aggressiveness" | "empathy",
    label: string,
    options: {
      min: number;
      max: number;
      step: number;
      fallback: number;
      suffix?: string;
      decimals?: number;
      lowLabel?: string;
      highLabel?: string;
      accentClass: string;
      focusBorderClass: string;
      textClass: string;
      isEditable?: boolean;
    }
  ) => {
    const agentLabel = agent === "agentA" ? "Agent A" : "Agent B";
    const idPrefix = agent === "agentA" ? "agent-a" : "agent-b";
    const fieldId = field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const value = Number(agentConfig[agent][field] ?? options.fallback);
    const displayValue = Number.isFinite(value) ? value : options.fallback;
    const canEditKnob = options.isEditable ?? isConfigurable;
    const formatted = options.decimals !== undefined
      ? displayValue.toFixed(options.decimals)
      : Math.round(displayValue).toString();

    return (
      <div>
        <div className="flex justify-between text-[10px] font-mono mb-1 text-slate-400">
          <label htmlFor={`${idPrefix}-${fieldId}-slider`}>{label}</label>
          <span className={`${options.textClass} font-bold`}>{formatted}{options.suffix || ""}</span>
        </div>
        <div className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-2">
          <button
            id={`${idPrefix}-${fieldId}-decrease`}
            type="button"
            aria-label={`Decrease ${agentLabel} ${label.toLowerCase()}`}
            disabled={!canEditKnob || displayValue <= options.min}
            onClick={() => handleAgentNumberKnob(agent, field, displayValue - options.step, options.min, options.max, options.step)}
            className={`flex h-7 w-7 items-center justify-center border border-white/20 bg-white/5 text-slate-300 transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-35 ${options.focusBorderClass}`}
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            id={`${idPrefix}-${fieldId}-slider`}
            type="range"
            min={options.min}
            max={options.max}
            step={options.step}
            value={displayValue}
            disabled={!canEditKnob}
            aria-label={`${agentLabel} ${label.toLowerCase()}`}
            onInput={(e) => handleAgentNumberKnob(agent, field, parseFloat(e.currentTarget.value), options.min, options.max, options.step)}
            onChange={(e) => handleAgentNumberKnob(agent, field, parseFloat(e.currentTarget.value), options.min, options.max, options.step)}
            className={`w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer ${options.accentClass}`}
          />
          <button
            id={`${idPrefix}-${fieldId}-increase`}
            type="button"
            aria-label={`Increase ${agentLabel} ${label.toLowerCase()}`}
            disabled={!canEditKnob || displayValue >= options.max}
            onClick={() => handleAgentNumberKnob(agent, field, displayValue + options.step, options.min, options.max, options.step)}
            className={`flex h-7 w-7 items-center justify-center border border-white/20 bg-white/5 text-slate-300 transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-35 ${options.focusBorderClass}`}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {(options.lowLabel || options.highLabel) && (
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
            <span>{options.lowLabel}</span>
            <span>{options.highLabel}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 bg-black" id="config-panel-container">
      {mode !== "advancedOnly" && (
        <>
      {/* Preset Scenarios */}
      <div className="border border-white/20 p-4 relative" id="preset-scenarios-card">
        <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-[#00FF41]" /> PRESETS & AGENT TEMPLATES
        </h3>
        <div className="grid grid-cols-2 gap-2" id="scenarios-grid">
          {PRESET_SCENARIOS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(idx)}
              disabled={!isConfigurable}
              className={`text-left p-2.5 transition-colors border cursor-pointer ${
                selectedPreset === idx
                  ? "bg-[#00FF41] border-[#00FF41] text-black font-black"
                  : "bg-black hover:bg-neutral-900 border-white/20 text-slate-300"
              } disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-black`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide truncate">{preset.title}</span>
              </div>
              <p className={`text-[10px] line-clamp-1 mt-1 font-mono ${selectedPreset === idx ? "text-black/80" : "text-slate-500"}`}>
                {preset.topic}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Goal / Questions */}
      <div className="border border-white/20 p-4 space-y-4" id="goal-settings-card">
        <div>
          <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00FF41] flex items-center gap-1.5 mb-2">
            <Landmark className="h-3.5 w-3.5" /> OVERARCHING MISSION PROMPT
          </h3>
          <textarea
            value={topic}
            onChange={(e) => handleTopicChange(e.target.value)}
            disabled={!isConfigurable}
            rows={2}
            className="w-full bg-black border border-white/20 p-3 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF41] disabled:opacity-60 disabled:cursor-not-allowed font-mono leading-relaxed resize-none"
            placeholder="TYPE INTENT OR MISSION PROFILE..."
          />
        </div>

        {/* Global LLM settings */}
        <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2" id="global-llm-settings">
          <div>
            <label htmlFor="global-default-model-select" className="text-[10px] font-mono text-slate-500 uppercase font-black block mb-2">
              Default model / adapter target
            </label>
            <select
              id="global-default-model-select"
              value={agentConfig.model}
              disabled={!isConfigurable}
              onChange={(e) => onAgentConfigChange({ ...agentConfig, model: e.target.value })}
              className="w-full bg-black border border-white/20 px-2 py-1.5 text-[10px] text-white font-mono focus:outline-none focus:border-[#00FF41] disabled:opacity-60 cursor-pointer"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase font-black block mb-2">
              GROUNDING ENHANCEMENT
            </label>
            <button
              id="grounding-toggle-button"
              type="button"
              aria-pressed={agentConfig.useGrounding}
              onClick={() => onAgentConfigChange({ ...agentConfig, useGrounding: !agentConfig.useGrounding })}
              disabled={!isConfigurable}
              className={`w-full py-1.5 px-2 border text-[10px] font-mono font-black transition-colors cursor-pointer ${
                agentConfig.useGrounding
                  ? "bg-black border-[#00FF41] text-[#00FF41]"
                  : "bg-black border-white/20 text-slate-500"
              }`}
            >
              {agentConfig.useGrounding ? "LIVE WEB SEARCH" : "OFFBOARD"}
            </button>
          </div>
        </div>

        {/* Task Complexity Selection */}
        <div className="border-t border-white/10 pt-4" id="task-complexity-selection">
          <label className="text-[10px] font-mono uppercase font-black block mb-2 text-slate-400">
            PRESETS COMPLEXITY OVERRIDE
          </label>
          <div className="grid grid-cols-2 gap-1 px-0.5 sm:grid-cols-4" id="complexity-preset-grid">
            {(["auto", "quick lookup", "deep research", "complex simulation"] as const).map((level) => (
              <button
                key={level}
                disabled={!isConfigurable}
                onClick={() => onAgentConfigChange({ ...agentConfig, defaultComplexity: level })}
                className={`text-[10px] font-bold font-mono py-1 border uppercase text-center cursor-pointer transition-colors leading-tight disabled:opacity-50 disabled:cursor-not-allowed ${
                  (agentConfig.defaultComplexity === level || (!agentConfig.defaultComplexity && level === "auto"))
                    ? "bg-[#00FF41] text-black border-[#00FF41]"
                    : "bg-black text-slate-400 border-white/20 hover:border-white/40 hover:text-white"
                }`}
                title={
                  level === "auto" ? "Respect agent proposed dynamic task complexity" :
                  level === "quick lookup" ? "Force high ball speed (1.35x)" :
                  level === "deep research" ? "Force medium ball speed (0.75x)" : "Force slow ball speed (0.35x)"
                }
              >
                {level === "auto" ? "Auto" : level}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-1 font-mono uppercase leading-snug">
            * Auto adjusts via Agent proposals. Specific choices force friction dynamics (Fast to Slow).
          </p>
        </div>

        {/* physical Speed Multiplier (Pong speed) */}
        <div className="border-t border-white/10 pt-4" id="physics-speed-slider">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-2">
            <span>BALL TRAVEL VECTOR SCALE</span>
            <span className="text-[#00FF41] font-black">{gameSpeed}X</span>
          </div>
          <div className="grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2">
            <button
              type="button"
              aria-label="Decrease ball travel speed"
              title="Decrease speed"
              disabled={gameSpeed <= 1}
              onClick={() => handleSpeedInput(gameSpeed - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/15 bg-white/[0.04] text-slate-200 hover:border-[#00FF41]/50 hover:text-[#00FF41] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={gameSpeed}
              onInput={(e) => handleSpeedInput(parseInt(e.currentTarget.value, 10))}
              onChange={(e) => handleSpeedInput(parseInt(e.currentTarget.value, 10))}
              aria-label="Ball travel speed"
              className="w-full h-1 bg-neutral-800 appearance-none cursor-pointer accent-[#00FF41] focus:outline-none"
            />
            <button
              type="button"
              aria-label="Increase ball travel speed"
              title="Increase speed"
              disabled={gameSpeed >= 5}
              onClick={() => handleSpeedInput(gameSpeed + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/15 bg-white/[0.04] text-slate-200 hover:border-[#00FF41]/50 hover:text-[#00FF41] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-1">
            <span>SLOW INTERACTION RATE</span>
            <span>FAST LOOP</span>
          </div>
        </div>
      </div>

      {/* Agent Profiles Configuration */}
      <div className="border border-white/20 p-4 space-y-4" id="agent-profiles-card">
        <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-[#00FF41]" /> LLM OPPONENT CONSTRUCTS
        </h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" id="agents-config">
          {/* Agent A settings */}
          <div className="p-3 border border-[#00FF41]/40 space-y-3 bg-black">
            <div className="flex items-center gap-1 pb-2 border-b border-white/10">
              <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-[#00FF41]/35 bg-[#00FF41]/10 text-[10px] font-black text-[#00FF41]">A</span>
              <span className="text-[10px] font-mono text-[#00FF41] font-bold">LEFT_PADDLE: ALPHA</span>
            </div>
            <div>
              <label htmlFor="agent-a-name-input" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">AGENT NAME</label>
              <input
                id="agent-a-name-input"
                type="text"
                value={agentConfig.agentA.name}
                disabled={!isConfigurable}
                onChange={(e) => handleAgentInputChange("agentA", "name", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-white focus:outline-none focus:border-[#00FF41]"
              />
            </div>
            <div>
              <label htmlFor="agent-a-avatar-input" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">AVATAR EMOJI</label>
              <input
                id="agent-a-avatar-input"
                type="text"
                value={agentConfig.agentA.avatar}
                disabled={!isConfigurable}
                onChange={(e) => handleAgentInputChange("agentA", "avatar", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-white focus:outline-none focus:border-[#00FF41]"
              />
            </div>
            <div>
              <label htmlFor="agent-a-role-textarea" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">ROLE INSTRUCTION</label>
              <textarea
                id="agent-a-role-textarea"
                value={agentConfig.agentA.role}
                disabled={!isConfigurable}
                rows={3}
                onChange={(e) => handleAgentInputChange("agentA", "role", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-[#00FF41] resize-none font-mono tracking-tight"
              />
            </div>
            <div>
              <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="agent-a-system-prompt-textarea" className="text-[10px] font-mono text-slate-500 uppercase">SYSTEM PERSONA PROMPT</label>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  <button
                    id="agent-a-persona-skeptic"
                    aria-label="Apply Agent A skeptic persona"
                    onClick={() => handleAgentInputChange("agentA", "systemPrompt", "You are extremely skeptical, cynical, and challenge every claim. Demands rigorous evidence and points out fatal flaws.")}
                    disabled={!isConfigurable}
                    type="button"
                    title="The Skeptic Persona"
                    className="text-[10px] px-1 bg-white/10 text-white border border-white/25 hover:bg-[#00FF41] hover:text-black hover:border-[#00FF41] transition-all font-mono leading-none py-0.5 cursor-pointer rounded-sm"
                  >
                    Skeptic
                  </button>
                  <button
                    id="agent-a-persona-visionary"
                    aria-label="Apply Agent A visionary persona"
                    onClick={() => handleAgentInputChange("agentA", "systemPrompt", "You are an optimistic visionary seeing revolutionary potential. Pushes for high ambition, bold scaling, and futuristic dreams.")}
                    disabled={!isConfigurable}
                    type="button"
                    title="The Visionary Persona"
                    className="text-[10px] px-1 bg-white/10 text-white border border-white/25 hover:bg-[#00FF41] hover:text-black hover:border-[#00FF41] transition-all font-mono leading-none py-0.5 cursor-pointer rounded-sm"
                  >
                    Visionary
                  </button>
                  <button
                    id="agent-a-persona-tech"
                    aria-label="Apply Agent A tech lead persona"
                    onClick={() => handleAgentInputChange("agentA", "systemPrompt", "You are a sharp, analytical, and highly structured computer scientist. Speaks in technical, concise, precise terminology.")}
                    disabled={!isConfigurable}
                    type="button"
                    title="The Tech Lead Persona"
                    className="text-[10px] px-1 bg-white/10 text-white border border-white/25 hover:bg-[#00FF41] hover:text-black hover:border-[#00FF41] transition-all font-mono leading-none py-0.5 cursor-pointer rounded-sm"
                  >
                    Tech
                  </button>
                </div>
              </div>
              <textarea
                id="agent-a-system-prompt-textarea"
                value={agentConfig.agentA.systemPrompt || ""}
                disabled={!isConfigurable}
                rows={2}
                placeholder="E.g., Speak like a skeptic... or select a preset persona above."
                onChange={(e) => handleAgentInputChange("agentA", "systemPrompt", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-[#00FF41] resize-none font-mono tracking-tight"
              />
            </div>
            {renderAgentProviderControls("agentA")}

            {/* Advanced Tuning Segments for Agent A */}
            <div className="pt-2.5 border-t border-white/10 mt-2.5">
              <details id="agent-a-ml-parameters-details" className="group cursor-pointer select-none">
                <summary id="agent-a-ml-parameters-summary" className="text-[10px] font-mono text-[#00FF41] font-bold uppercase flex items-center justify-between group-open:mb-2 text-left">
                  <span className="flex items-center gap-1.5"><Sliders className="h-3 w-3" /> ML & GAMEPLAY PARAMETERS</span>
                  <ChevronDown className="h-3 w-3 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                
                <div className="space-y-3.5 pl-1.5 pt-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                  
                  {renderAgentNumberKnob("agentA", "competitiveDrive", "COMPETITIVE INTENSITY", {
                    min: 10,
                    max: 100,
                    step: 5,
                    fallback: 50,
                    suffix: "%",
                    lowLabel: "Cooperative",
                    highLabel: "Relentless to Win",
                    accentClass: "accent-[#00FF41]",
                    focusBorderClass: "hover:border-[#00FF41] hover:bg-[#00FF41]",
                    textClass: "text-[#00FF41]",
                  })}

                  {/* Strategic Analytical style dropdown */}
                  <div>
                    <label htmlFor="agent-a-strategy-bias-select" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">STRATEGIC GAMEPLAY PROFILE</label>
                    <select
                      id="agent-a-strategy-bias-select"
                      value={agentConfig.agentA.strategyBias ?? "balanced"}
                      disabled={!isConfigurable}
                      onChange={(e) => handleAgentInputChange("agentA", "strategyBias", e.target.value)}
                      className="w-full bg-black border border-white/20 p-1 text-[10px] text-[#00FF41] focus:outline-none focus:border-[#00FF41] font-mono"
                    >
                      <option value="balanced">Balanced General debater</option>
                      <option value="cooperative">Cooperative additive loop</option>
                      <option value="socratic">Socratic critical questioning</option>
                      <option value="rhetorical">Rhetorician formal persuasion</option>
                      <option value="adversarial">Adversarial Red-teaming</option>
                    </select>
                  </div>

                  {renderAgentNumberKnob("agentA", "temperature", "TEMPERATURE (CREATIVITY)", {
                    min: 0.1,
                    max: 1.5,
                    step: 0.1,
                    fallback: 0.7,
                    decimals: 1,
                    accentClass: "accent-[#00FF41]",
                    focusBorderClass: "hover:border-[#00FF41] hover:bg-[#00FF41]",
                    textClass: "text-[#00FF41]",
                    isEditable: canEditAgentRuntime,
                  })}

                  {renderAgentNumberKnob("agentA", "maxTokens", "MAX TOKEN OUTPUT", {
                    min: 128,
                    max: 2048,
                    step: 128,
                    fallback: 1024,
                    accentClass: "accent-[#00FF41]",
                    focusBorderClass: "hover:border-[#00FF41] hover:bg-[#00FF41]",
                    textClass: "text-[#00FF41]",
                    isEditable: canEditAgentRuntime,
                  })}

                </div>
              </details>
            </div>

            {/* Personality Modifiers Segment */}
            <div className="pt-2.5 border-t border-white/10 mt-2.5">
              <details id="agent-a-personality-modifiers-details" className="group cursor-pointer select-none" open>
                <summary id="agent-a-personality-modifiers-summary" className="text-[10px] font-mono text-[#00FF41] font-bold uppercase flex items-center justify-between group-open:mb-2 text-left">
                  <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> PERSONALITY MODIFIERS</span>
                  <ChevronDown className="h-3 w-3 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                
                <div className="space-y-3.5 pl-1.5 pt-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                  {renderAgentNumberKnob("agentA", "aggressiveness", "AGGRESSIVENESS", {
                    min: 0,
                    max: 100,
                    step: 5,
                    fallback: 50,
                    suffix: "%",
                    accentClass: "accent-[#00FF41]",
                    focusBorderClass: "hover:border-[#00FF41] hover:bg-[#00FF41]",
                    textClass: "text-[#00FF41]",
                  })}

                  {renderAgentNumberKnob("agentA", "empathy", "EMPATHY", {
                    min: 0,
                    max: 100,
                    step: 5,
                    fallback: 50,
                    suffix: "%",
                    accentClass: "accent-[#00FF41]",
                    focusBorderClass: "hover:border-[#00FF41] hover:bg-[#00FF41]",
                    textClass: "text-[#00FF41]",
                  })}
                </div>
              </details>
            </div>
          </div>

          {/* Agent B settings */}
          <div className="p-3 border border-[#FF4100]/40 space-y-3 bg-black">
            <div className="flex items-center gap-1 pb-2 border-b border-white/10">
              <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-[#FF4100]/35 bg-[#FF4100]/10 text-[10px] font-black text-[#FF4100]">B</span>
              <span className="text-[10px] font-mono text-[#FF4100] font-bold">RIGHT_PADDLE: BETA</span>
            </div>
            <div>
              <label htmlFor="agent-b-name-input" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">AGENT NAME</label>
              <input
                id="agent-b-name-input"
                type="text"
                value={agentConfig.agentB.name}
                disabled={!isConfigurable}
                onChange={(e) => handleAgentInputChange("agentB", "name", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-white focus:outline-none focus:border-[#FF4100]"
              />
            </div>
            <div>
              <label htmlFor="agent-b-avatar-input" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">AVATAR EMOJI</label>
              <input
                id="agent-b-avatar-input"
                type="text"
                value={agentConfig.agentB.avatar}
                disabled={!isConfigurable}
                onChange={(e) => handleAgentInputChange("agentB", "avatar", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-white focus:outline-none focus:border-[#FF4100]"
              />
            </div>
            <div>
              <label htmlFor="agent-b-role-textarea" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">ROLE INSTRUCTION</label>
              <textarea
                id="agent-b-role-textarea"
                value={agentConfig.agentB.role}
                disabled={!isConfigurable}
                rows={3}
                onChange={(e) => handleAgentInputChange("agentB", "role", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-[#FF4100] resize-none font-mono tracking-tight"
              />
            </div>
            <div>
              <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="agent-b-system-prompt-textarea" className="text-[10px] font-mono text-slate-500 uppercase">SYSTEM PERSONA PROMPT</label>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  <button
                    id="agent-b-persona-skeptic"
                    aria-label="Apply Agent B skeptic persona"
                    onClick={() => handleAgentInputChange("agentB", "systemPrompt", "You are extremely skeptical, cynical, and challenge every claim. Demands rigorous evidence and points out fatal flaws.")}
                    disabled={!isConfigurable}
                    type="button"
                    title="The Skeptic Persona"
                    className="text-[10px] px-1 bg-white/10 text-white border border-white/25 hover:bg-[#FF4100] hover:text-black hover:border-[#FF4100] transition-all font-mono leading-none py-0.5 cursor-pointer rounded-sm"
                  >
                    Skeptic
                  </button>
                  <button
                    id="agent-b-persona-visionary"
                    aria-label="Apply Agent B visionary persona"
                    onClick={() => handleAgentInputChange("agentB", "systemPrompt", "You are an optimistic visionary seeing revolutionary potential. Pushes for high ambition, bold scaling, and futuristic dreams.")}
                    disabled={!isConfigurable}
                    type="button"
                    title="The Visionary Persona"
                    className="text-[10px] px-1 bg-white/10 text-white border border-white/25 hover:bg-[#FF4100] hover:text-black hover:border-[#FF4100] transition-all font-mono leading-none py-0.5 cursor-pointer rounded-sm"
                  >
                    Visionary
                  </button>
                  <button
                    id="agent-b-persona-tech"
                    aria-label="Apply Agent B tech lead persona"
                    onClick={() => handleAgentInputChange("agentB", "systemPrompt", "You are a sharp, analytical, and highly structured computer scientist. Speaks in technical, concise, precise terminology.")}
                    disabled={!isConfigurable}
                    type="button"
                    title="The Tech Lead Persona"
                    className="text-[10px] px-1 bg-white/10 text-white border border-white/25 hover:bg-[#FF4100] hover:text-black hover:border-[#FF4100] transition-all font-mono leading-none py-0.5 cursor-pointer rounded-sm"
                  >
                    Tech
                  </button>
                </div>
              </div>
              <textarea
                id="agent-b-system-prompt-textarea"
                value={agentConfig.agentB.systemPrompt || ""}
                disabled={!isConfigurable}
                rows={2}
                placeholder="E.g., Speak like a visionary... or select a preset persona above."
                onChange={(e) => handleAgentInputChange("agentB", "systemPrompt", e.target.value)}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-[#FF4100] resize-none font-mono tracking-tight"
              />
            </div>
            {renderAgentProviderControls("agentB")}

            {/* Advanced Tuning Segments for Agent B */}
            <div className="pt-2.5 border-t border-white/10 mt-2.5">
              <details id="agent-b-ml-parameters-details" className="group cursor-pointer select-none">
                <summary id="agent-b-ml-parameters-summary" className="text-[10px] font-mono text-[#FF4100] font-bold uppercase flex items-center justify-between group-open:mb-2 text-left">
                  <span className="flex items-center gap-1.5"><Sliders className="h-3 w-3" /> ML & GAMEPLAY PARAMETERS</span>
                  <ChevronDown className="h-3 w-3 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                
                <div className="space-y-3.5 pl-1.5 pt-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                  
                  {renderAgentNumberKnob("agentB", "competitiveDrive", "COMPETITIVE INTENSITY", {
                    min: 10,
                    max: 100,
                    step: 5,
                    fallback: 50,
                    suffix: "%",
                    lowLabel: "Cooperative",
                    highLabel: "Relentless to Win",
                    accentClass: "accent-[#FF4100]",
                    focusBorderClass: "hover:border-[#FF4100] hover:bg-[#FF4100]",
                    textClass: "text-[#FF4100]",
                  })}

                  {/* Strategic Analytical style dropdown */}
                  <div>
                    <label htmlFor="agent-b-strategy-bias-select" className="text-[10px] font-mono text-slate-500 uppercase block mb-1">STRATEGIC GAMEPLAY PROFILE</label>
                    <select
                      id="agent-b-strategy-bias-select"
                      value={agentConfig.agentB.strategyBias ?? "balanced"}
                      disabled={!isConfigurable}
                      onChange={(e) => handleAgentInputChange("agentB", "strategyBias", e.target.value)}
                      className="w-full bg-black border border-white/20 p-1 text-[10px] text-[#FF4100] focus:outline-none focus:border-[#FF4100] font-mono"
                    >
                      <option value="balanced">Balanced General debater</option>
                      <option value="cooperative">Cooperative additive loop</option>
                      <option value="socratic">Socratic critical questioning</option>
                      <option value="rhetorical">Rhetorician formal persuasion</option>
                      <option value="adversarial">Adversarial Red-teaming</option>
                    </select>
                  </div>

                  {renderAgentNumberKnob("agentB", "temperature", "TEMPERATURE (CREATIVITY)", {
                    min: 0.1,
                    max: 1.5,
                    step: 0.1,
                    fallback: 0.7,
                    decimals: 1,
                    accentClass: "accent-[#FF4100]",
                    focusBorderClass: "hover:border-[#FF4100] hover:bg-[#FF4100]",
                    textClass: "text-[#FF4100]",
                    isEditable: canEditAgentRuntime,
                  })}

                  {renderAgentNumberKnob("agentB", "maxTokens", "MAX TOKEN OUTPUT", {
                    min: 128,
                    max: 2048,
                    step: 128,
                    fallback: 1024,
                    accentClass: "accent-[#FF4100]",
                    focusBorderClass: "hover:border-[#FF4100] hover:bg-[#FF4100]",
                    textClass: "text-[#FF4100]",
                    isEditable: canEditAgentRuntime,
                  })}

                </div>
              </details>
            </div>

            {/* Personality Modifiers Segment */}
            <div className="pt-2.5 border-t border-white/10 mt-2.5">
              <details id="agent-b-personality-modifiers-details" className="group cursor-pointer select-none" open>
                <summary id="agent-b-personality-modifiers-summary" className="text-[10px] font-mono text-[#FF4100] font-bold uppercase flex items-center justify-between group-open:mb-2 text-left">
                  <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> PERSONALITY MODIFIERS</span>
                  <ChevronDown className="h-3 w-3 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                
                <div className="space-y-3.5 pl-1.5 pt-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                  {renderAgentNumberKnob("agentB", "aggressiveness", "AGGRESSIVENESS", {
                    min: 0,
                    max: 100,
                    step: 5,
                    fallback: 50,
                    suffix: "%",
                    accentClass: "accent-[#FF4100]",
                    focusBorderClass: "hover:border-[#FF4100] hover:bg-[#FF4100]",
                    textClass: "text-[#FF4100]",
                  })}

                  {renderAgentNumberKnob("agentB", "empathy", "EMPATHY", {
                    min: 0,
                    max: 100,
                    step: 5,
                    fallback: 50,
                    suffix: "%",
                    accentClass: "accent-[#FF4100]",
                    focusBorderClass: "hover:border-[#FF4100] hover:bg-[#FF4100]",
                    textClass: "text-[#FF4100]",
                  })}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* External Agent Bridge Configuration */}
      <div className="border border-white/20 p-4 bg-black space-y-3" id="agent-bridge-config-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00FF41] flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-[#00FF41]" /> EXTERNAL AGENT BRIDGE
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 border border-white/10 px-1.5 py-0.5">
            {agentConfig.bridge?.kind && agentConfig.bridge.kind !== "none" ? agentConfig.bridge.kind : "off"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Bridge adapter</label>
            <select
              value={agentConfig.bridge?.kind || "none"}
              disabled={!isConfigurable}
              onChange={(e) => updateBridgeConfig({ kind: e.target.value as AgentBridgeKind })}
              className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-white focus:outline-none focus:border-[#00FF41] font-mono"
            >
              {BRIDGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Timeout</label>
            <input
              type="number"
              min={1000}
              max={120000}
              step={1000}
              value={agentConfig.bridge?.timeoutMs || 15000}
              disabled={!isConfigurable || !agentConfig.bridge?.kind || agentConfig.bridge.kind === "none"}
              onChange={(e) => updateBridgeConfig({ timeoutMs: Number(e.target.value) || 15000 })}
              className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-white focus:outline-none focus:border-[#00FF41] font-mono disabled:opacity-50"
            />
          </div>
        </div>

        {bridgeUsesEndpoint(agentConfig.bridge?.kind) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Bridge endpoint</label>
              <input
                type="text"
                value={agentConfig.bridge.endpointUrl || ""}
                placeholder={bridgeEndpointPlaceholder(agentConfig.bridge.kind)}
                disabled={!isConfigurable}
                onChange={(e) => updateBridgeConfig({ endpointUrl: e.target.value })}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-[#00FF41] font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                {agentConfig.bridge.kind === "mcp" ? "Tool name" : "Bearer token"}
              </label>
              <input
                type={agentConfig.bridge.kind === "mcp" ? "text" : "password"}
                value={agentConfig.bridge.kind === "mcp" ? (agentConfig.bridge.toolName || "") : (agentConfig.bridge.apiKey || "")}
                placeholder={agentConfig.bridge.kind === "mcp" ? "cognitive_pong_turn" : "optional"}
                disabled={!isConfigurable}
                onChange={(e) => updateBridgeConfig(agentConfig.bridge?.kind === "mcp" ? { toolName: e.target.value } : { apiKey: e.target.value })}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-[#00FF41] font-mono"
              />
            </div>
          </div>
        )}

        {bridgeUsesCommand(agentConfig.bridge?.kind) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Server profile</label>
              <input
                type="text"
                value={agentConfig.bridge.profileId || defaultBridgeProfileForKind(agentConfig.bridge.kind)}
                placeholder={bridgeProfilePlaceholder(agentConfig.bridge.kind)}
                disabled={!isConfigurable}
                onChange={(e) => updateBridgeConfig({ profileId: e.target.value })}
                className="w-full bg-black border border-white/20 p-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-[#00FF41] font-mono"
              />
            </div>
            <div className="border border-white/10 bg-black/50 px-3 py-2 text-[10px] font-mono uppercase text-slate-300">
              <span className="block text-slate-500">Command source</span>
              <span className="text-white">Server allowlist only</span>
            </div>
            <div className="md:col-span-2 border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-mono uppercase text-amber-200">
              Local command bridges require COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true. Commands, args, cwd, and sandbox flags must be configured in server-side CLI profiles.
            </div>
          </div>
        )}
      </div>

      {/* Local Model & Bridge Setup Guide */}
      <div className="border border-white/20 p-4 bg-black space-y-4" id="local-model-integrator-card">
        <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setIsGuideExpanded(!isGuideExpanded)}>
          <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00FF41] flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-[#00FF41] animate-pulse" /> LOCAL DEV HARNESS SETUP
          </h3>
          <button
            id="local-setup-toggle"
            type="button"
            aria-expanded={isGuideExpanded}
            aria-controls="local-model-integrator-body"
            className="text-[10px] font-mono font-black text-[#00FF41] hover:text-white transition-colors uppercase"
          >
            {isGuideExpanded ? "[ HIDE SETUPS ]" : "[ SHOW SETUPS ]"}
          </button>
        </div>
        
        {isGuideExpanded && (
          <div className="space-y-3.5 pt-2 border-t border-white/10" id="local-model-integrator-body">
            <p className="text-[10px] text-slate-400 font-mono leading-relaxed uppercase">
              Configure local models, user-owned endpoints, or external agent bridges for the Cognitive Pong runtime:
            </p>

            {/* Protocol Tabs */}
            <div className="grid grid-cols-1 gap-1 pl-0.5 sm:grid-cols-3">
              <button
                id="setup-guide-tab-ollama"
                type="button"
                aria-controls="ollama-guide"
                aria-selected={guideTab === "ollama"}
                onClick={() => setGuideTab("ollama")}
                className={`text-[10px] py-1 border font-bold font-mono uppercase text-center cursor-pointer transition-colors ${
                  guideTab === "ollama"
                    ? "bg-[#00FF41] text-black border-transparent"
                    : "bg-[#111] text-slate-400 border-white/10 hover:border-white/30"
                }`}
              >
                Ollama Local
              </button>
              <button
                id="setup-guide-tab-bridge"
                type="button"
                aria-controls="custom-cli-guide"
                aria-selected={guideTab === "codex"}
                onClick={() => setGuideTab("codex")}
                className={`text-[10px] py-1 border font-bold font-mono uppercase text-center cursor-pointer transition-colors ${
                  guideTab === "codex"
                    ? "bg-[#00FF41] text-black border-transparent"
                    : "bg-[#111] text-slate-400 border-white/10 hover:border-white/30"
                }`}
              >
                Agent Bridge
              </button>
              <button
                id="setup-guide-tab-tunnel"
                type="button"
                aria-controls="tunneling-instructions"
                aria-selected={guideTab === "tunnel"}
                onClick={() => setGuideTab("tunnel")}
                className={`text-[10px] py-1 border font-bold font-mono uppercase text-center cursor-pointer transition-colors ${
                  guideTab === "tunnel"
                    ? "bg-[#00FF41] text-black border-transparent"
                    : "bg-[#111] text-slate-400 border-white/10 hover:border-white/30"
                }`}
              >
                cloud tunnels
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-[#0c0c0c] border border-white/10 p-3 space-y-3 font-mono">
              {/* Tab 1: Ollama Setup */}
              {guideTab === "ollama" && (
                <div className="space-y-3" id="ollama-guide">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black">
                    <span>1. START OLLAMA WITH CORS OPENED</span>
                    <span className="text-[#00FF41]">Unix / Win</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
                    Ollama blocks external remote APIs by default. Launch with CORS rules set to "*" to grant connection permissions:
                  </p>
                  <div className="relative">
                    <pre className="bg-black/50 border border-white/10 px-2.5 py-2 text-[10px] text-lime-400 overflow-x-auto whitespace-pre-wrap rounded-sm break-all font-mono select-all pr-20">
                      {`OLLAMA_ORIGINS="*" ollama serve`}
                    </pre>
                    <button
                      id="copy-ollama-cors-command"
                      type="button"
                      aria-label="Copy Ollama CORS command"
                      onClick={() => copyToClipboard(`OLLAMA_ORIGINS="*" ollama serve`, "ollama-cors")}
                      className="absolute top-1 right-1 text-[10px] text-white bg-white/10 px-1 py-0.5 hover:bg-[#00FF41] hover:text-black hover:border-transparent transition-all uppercase rounded-sm border border-white/10 cursor-pointer"
                    >
                      {copiedOllamaCmd === "ollama-cors" ? "COPIED" : "COPY"}
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black pt-1">
                    <span>2. PULL / LOAD DESIRED MODEL</span>
                    <span className="text-[#00FF41]">LOCAL</span>
                  </div>
                  <div className="relative">
                    <pre className="bg-black/50 border border-white/10 px-2.5 py-2 text-[10px] text-slate-200 overflow-x-auto whitespace-pre-wrap rounded-sm break-all font-mono select-all pr-20">
                      {`ollama run llama3`}
                    </pre>
                    <button
                      id="copy-ollama-run-command"
                      type="button"
                      aria-label="Copy Ollama run command"
                      onClick={() => copyToClipboard(`ollama run llama3`, "ollama-run")}
                      className="absolute top-1 right-1 text-[10px] text-white bg-white/10 px-1 py-0.5 hover:bg-[#00FF41] hover:text-black hover:border-transparent transition-all uppercase rounded-sm border border-white/10 cursor-pointer"
                    >
                      {copiedOllamaCmd === "ollama-run" ? "COPIED" : "COPY"}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Agent Bridge */}
              {guideTab === "codex" && (
                <div className="space-y-2.5" id="custom-cli-guide">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black">
                    <span>HTTP AGENT BRIDGE FOR EXTERNAL TOOLS</span>
                    <span className="text-[#00FF41]">PORT 8787</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
                    Run a small local service to map Cognitive Pong turns to your own agent runtime. CLI and Codex CLI bridges are also supported through server-side allowlisted profiles, with local command execution explicitly gated by environment variables.
                  </p>

                  <div className="relative">
                    <pre className="bg-black/80 border border-white/10 p-2 pr-24 text-[10px] text-[#00FF41] overflow-x-auto max-h-[150px] overflow-y-auto rounded-sm leading-tight whitespace-pre font-mono select-all">
                      {HTTP_AGENT_BRIDGE_EXAMPLE}
                    </pre>
                    <button
                      id="copy-agent-bridge-script"
                      type="button"
                      aria-label="Copy HTTP agent bridge example"
                      onClick={() => copyToClipboard(HTTP_AGENT_BRIDGE_EXAMPLE, "agent-bridge-script")}
                      className="absolute top-1.5 right-1.5 text-[10px] text-white bg-white/10 px-1 py-0.5 hover:bg-[#00FF41] hover:text-black hover:border-transparent transition-all uppercase rounded-sm border border-white/10 cursor-pointer"
                    >
                      {copiedOllamaCmd === "agent-bridge-script" ? "COPIED" : "COPY CODE"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal uppercase">
                    Quickstart: save as <span className="text-white">bridge.js</span>, run <span className="text-white">npm install express</span>, start <span className="text-white">node bridge.js</span>, then select <span className="text-white">HTTP agent bridge</span> above and set the endpoint.
                  </p>
                  <p className="text-[10px] text-slate-500 leading-normal uppercase">
                    Direct CLI: configure <span className="text-white">CODEX_CLI_COMMAND</span>/<span className="text-white">CODEX_CLI_ARGS</span> or <span className="text-white">COGNITIVE_PONG_CLI_PROFILES</span> on the server, then select the matching profile in the agent card. Local command execution requires <span className="text-white">COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true</span>.
                  </p>
                </div>
              )}

              {/* Tab 3: Tunneling Guide */}
              {guideTab === "tunnel" && (
                <div className="space-y-3" id="tunneling-instructions">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black font-mono">
                    <span>LAUNCH REVERSE LINK TUNNEL</span>
                    <span className="text-[#00FF41]">INGRESS PROTOCOL</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
                    If this Arena app is running somewhere that cannot reach your local port directly, expose your port with a loopback tunnel:
                  </p>

                  <div className="space-y-2 pt-1 border-t border-white/5">
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold text-slate-500">
                      <span>FOR OLLAMA (Local Port 11434)</span>
                      <span>NGROK COMMAND</span>
                    </div>
                    <div className="relative">
                      <pre className="bg-black/50 border border-white/10 px-2.5 py-1.5 text-[10px] text-cyan-300 overflow-x-auto rounded-sm font-mono whitespace-pre-wrap select-all pr-20 break-all">
                        {`ngrok http 11434`}
                      </pre>
                      <button
                        id="copy-ngrok-ollama-command"
                        type="button"
                        aria-label="Copy ngrok Ollama tunnel command"
                        onClick={() => copyToClipboard(`ngrok http 11434`, "ngrok-ollama")}
                        className="absolute top-1 right-1 text-[10px] text-white bg-white/10 px-1 py-0.5 hover:bg-[#00FF41] hover:text-black hover:border-transparent transition-all uppercase rounded-sm border border-white/10 cursor-pointer"
                      >
                        {copiedOllamaCmd === "ngrok-ollama" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-white/5">
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold text-slate-500">
                      <span>FOR HTTP AGENT BRIDGE (Local Port 8787)</span>
                      <span>LOCALTUNNEL COMMAND</span>
                    </div>
                    <div className="relative">
                      <pre className="bg-black/50 border border-white/10 px-2.5 py-1.5 text-[10px] text-cyan-300 overflow-x-auto rounded-sm font-mono whitespace-pre-wrap select-all pr-20 break-all">
                        {`npx localtunnel --port 8787`}
                      </pre>
                      <button
                        id="copy-localtunnel-bridge-command"
                        type="button"
                        aria-label="Copy localtunnel bridge command"
                        onClick={() => copyToClipboard(`npx localtunnel --port 8787`, "lt-custom")}
                        className="absolute top-1 right-1 text-[10px] text-white bg-white/10 px-1 py-0.5 hover:bg-[#00FF41] hover:text-black hover:border-transparent transition-all uppercase rounded-sm border border-white/10 cursor-pointer"
                      >
                        {copiedOllamaCmd === "lt-custom" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  </div>

                  <p className="pt-1 text-[10px] font-semibold leading-relaxed text-slate-300">
                    <span className="font-bold text-[#00FF41]">Bridge endpoint:</span> Run either command above, copy the produced public URL (for example <span className="text-[#00FF41]">https://xxxxx.ngrok-free.app</span>), and paste it into the agent endpoint URL field.
                  </p>
                </div>
              )}
            </div>
            {copyError && (
              <div
                id="setup-copy-error"
                className="border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[10px] font-mono font-bold text-rose-300 uppercase"
              >
                {copyError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced ARENA Configuration */}
      <div className="border border-white/20 p-4 space-y-4 bg-black" id="arena-config-card">
        <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00FF41] flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-[#00FF41]" /> ADVANCED ARENA SETTINGS
        </h3>

        <div className="space-y-3 border-b border-white/10 pb-4" id="arena-loop-runtime-settings">
          <div className="grid grid-cols-1 gap-3 font-mono text-[10px] sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label htmlFor="arena-max-loop-passes-input" className="text-slate-500 uppercase font-black block mb-1">LOOP PASSES</label>
              <input
                id="arena-max-loop-passes-input"
                type="number"
                min={1}
                max={25}
                value={arenaLoopSettings.maxLoopPasses}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("maxLoopPasses", Number(e.target.value))}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] text-[10px]"
              />
            </div>
            <div>
              <label htmlFor="arena-max-candidates-input" className="text-slate-500 uppercase font-black block mb-1">CANDIDATES/PASS</label>
              <input
                id="arena-max-candidates-input"
                type="number"
                min={1}
                max={5}
                value={arenaLoopSettings.maxCandidatesPerPass}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("maxCandidatesPerPass", Number(e.target.value))}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] text-[10px]"
              />
            </div>
            <div>
              <label htmlFor="arena-max-queries-input" className="text-slate-500 uppercase font-black block mb-1">MAX SEARCHES</label>
              <input
                id="arena-max-queries-input"
                type="number"
                min={0}
                max={5}
                value={arenaLoopSettings.maxQueriesPerTurn}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("maxQueriesPerTurn", Number(e.target.value))}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] text-[10px]"
              />
            </div>
            <div>
              <label htmlFor="arena-max-sources-input" className="text-slate-500 uppercase font-black block mb-1">MAX SOURCES</label>
              <input
                id="arena-max-sources-input"
                type="number"
                min={0}
                max={10}
                value={arenaLoopSettings.maxSourcesPerTurn}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("maxSourcesPerTurn", Number(e.target.value))}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] text-[10px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 font-mono text-[10px] md:grid-cols-3">
            <div>
              <label htmlFor="arena-search-provider-select" className="text-slate-500 uppercase font-black block mb-1">SEARCH PROVIDER</label>
              <select
                id="arena-search-provider-select"
                value={arenaLoopSettings.searchProvider}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("searchProvider", e.target.value as ArenaSearchProvider)}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
              >
                {ARENA_SEARCH_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="arena-search-timeout-input" className="text-slate-500 uppercase font-black block mb-1">MODEL / SEARCH TIMEOUT MS</label>
              <input
                id="arena-search-timeout-input"
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={arenaLoopSettings.searchTimeoutMs}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("searchTimeoutMs", Number(e.target.value))}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] text-[10px]"
              />
            </div>
            <div>
              <label htmlFor="arena-judging-mode-select" className="text-slate-500 uppercase font-black block mb-1">JUDGING MODE</label>
              <select
                id="arena-judging-mode-select"
                value={arenaLoopSettings.judgingMode}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("judgingMode", e.target.value as ArenaLoopRuntimeSettings["judgingMode"])}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
              >
                <option value="local-deterministic">Local deterministic judge</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 font-mono text-[10px] md:grid-cols-[minmax(0,1fr)_130px_130px]">
            <div>
              <label htmlFor="arena-search-endpoint-input" className="text-slate-500 uppercase font-black block mb-1">SEARCH ENDPOINT URL</label>
              <input
                id="arena-search-endpoint-input"
                type="text"
                value={arenaLoopSettings.searchEndpointUrl || ""}
                placeholder={arenaLoopSettings.searchProvider === "searxng" ? "http://localhost:8080/search" : "Optional provider endpoint override"}
                disabled={!isConfigurable || arenaLoopSettings.searchProvider === "mock"}
                onChange={(e) => handleArenaLoopSettingChange("searchEndpointUrl", e.target.value)}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF41] text-[10px] disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="arena-source-excerpt-input" className="text-slate-500 uppercase font-black block mb-1">EXCERPT CHARS</label>
              <input
                id="arena-source-excerpt-input"
                type="number"
                min={80}
                max={1200}
                value={arenaLoopSettings.maxSourceExcerptLength}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("maxSourceExcerptLength", Number(e.target.value))}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] text-[10px]"
              />
            </div>
            <div>
              <label htmlFor="arena-memory-size-input" className="text-slate-500 uppercase font-black block mb-1">MEMORY CHARS</label>
              <input
                id="arena-memory-size-input"
                type="number"
                min={300}
                max={8000}
                step={100}
                value={arenaLoopSettings.maxMemoryCharacters}
                disabled={!isConfigurable}
                onChange={(e) => handleArenaLoopSettingChange("maxMemoryCharacters", Number(e.target.value))}
                className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] text-[10px]"
              />
            </div>
          </div>

          <p className="text-[10px] font-mono uppercase leading-snug text-slate-500">
            Mock research works without keys. Brave and Tavily use server environment keys; SearXNG uses the configured endpoint.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-3 font-mono text-[10px] sm:grid-cols-2">
          <div>
            <label htmlFor="arena-match-engine-select" className="text-slate-500 uppercase font-black block mb-1">ARENA MATCH ENGINE</label>
            <select
              id="arena-match-engine-select"
              value={arenaSettings.matchEngine}
              disabled={!isConfigurable}
              onChange={(e) => handleArenaSettingChange("matchEngine", e.target.value as ArenaAdvancedSettings["matchEngine"])}
              className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
            >
              {ARENA_MATCH_ENGINE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="arena-population-range-select" className="text-slate-500 uppercase font-black block mb-1">POPULATION RANGE (N)</label>
            <select
              id="arena-population-range-select"
              value={arenaSettings.populationRange}
              disabled={!isConfigurable}
              onChange={(e) => handleArenaSettingChange("populationRange", e.target.value as ArenaAdvancedSettings["populationRange"])}
              className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
            >
              {ARENA_POPULATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 font-mono text-[10px] sm:grid-cols-2">
          <div>
            <label htmlFor="arena-memory-fabric-select" className="text-slate-500 uppercase font-black block mb-1">MEMORY FABRICS</label>
            <select
              id="arena-memory-fabric-select"
              value={arenaSettings.memoryFabric}
              disabled={!isConfigurable}
              onChange={(e) => handleArenaSettingChange("memoryFabric", e.target.value as ArenaAdvancedSettings["memoryFabric"])}
              className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
            >
              {ARENA_MEMORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="arena-sandbox-rules-select" className="text-slate-500 uppercase font-black block mb-1">SANDBOX SHELL RULES</label>
            <select
              id="arena-sandbox-rules-select"
              value={arenaSettings.sandboxRules}
              disabled={!isConfigurable}
              onChange={(e) => handleArenaSettingChange("sandboxRules", e.target.value as ArenaAdvancedSettings["sandboxRules"])}
              className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
            >
              {ARENA_SANDBOX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 font-mono text-[10px] sm:grid-cols-2">
          <div>
            <label htmlFor="arena-optimizer-metric-select" className="text-slate-500 uppercase font-black block mb-1">OPTIMIZER METRIC</label>
            <select
              id="arena-optimizer-metric-select"
              value={arenaSettings.optimizerMetric}
              disabled={!isConfigurable}
              onChange={(e) => handleArenaSettingChange("optimizerMetric", e.target.value as ArenaAdvancedSettings["optimizerMetric"])}
              className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
            >
              {ARENA_OPTIMIZER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="arena-promotion-standard-select" className="text-slate-500 uppercase font-black block mb-1">PROMOTION STANDARD</label>
            <select
              id="arena-promotion-standard-select"
              value={arenaSettings.promotionStandard}
              disabled={!isConfigurable}
              onChange={(e) => handleArenaSettingChange("promotionStandard", e.target.value as ArenaAdvancedSettings["promotionStandard"])}
              className="w-full bg-black border border-white/20 px-2 py-1.5 text-white focus:outline-none focus:border-[#00FF41] cursor-pointer text-[10px]"
            >
              {ARENA_PROMOTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Moderator Intervention Panel */}
      <div className="border border-white/20 p-4 space-y-3 bg-black" id="referee-intervention-card">
        <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-[#FF4100] flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" /> REACTION INJECTION (REFEREE REVIEW)
        </h3>
        <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
          Break dead-ends, correct factual errors, or guide their dialogue. Type your review below:
        </p>
        <form onSubmit={handleInjectedIntervention} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={modComment}
            onChange={(e) => setModComment(e.target.value)}
            disabled={status === "idle"}
            className="min-w-0 flex-1 bg-black border border-white/20 focus:border-[#FF4100] px-3 py-1.5 text-[10px] text-white placeholder-slate-600 focus:outline-none"
            placeholder={status === "idle" ? "START MATCH TO INPUT GUIDELINE REVIEW..." : "TYPE DIRECTION HERE..."}
          />
          <button
            type="submit"
            disabled={status === "idle" || !modComment.trim()}
            className="bg-[#FF4100] hover:bg-white text-black font-extrabold px-3 py-1.5 uppercase text-[10px] transition-colors cursor-pointer"
          >
            INJECT
          </button>
        </form>
      </div>

      {/* Arena Action Controls */}
      {mode !== "advancedOnly" && (
      <div className="border-2 border-white p-4 bg-black flex flex-col gap-3" id="match-operations">
        
        {/* Public Match Selector Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-neutral-900 border border-white/10 rounded-sm" id="public-match-selector-box">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-mono font-bold text-slate-300 uppercase leading-tight">Public Match Ledger</span>
            <span className="text-[10px] font-mono text-slate-500 uppercase">Save outcome to leaderboard</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={isPublicMatch} 
              onChange={(e) => onIsPublicMatchChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00FF41] peer-checked:after:bg-black"></div>
          </label>
        </div>

        {/* Publish Button manually triggered */}
        {!isPublished ? (
          <button
            onClick={onPublishMatch}
            disabled={isPublishing || !canPublishMatch}
            className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-white hover:to-white text-black font-black py-2.5 px-3 text-[10px] uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 cursor-pointer rounded-sm border-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:from-amber-400 disabled:hover:to-yellow-500"
            title={canPublishMatch ? "Publish current match score and task blueprints to global records registry" : "Run at least one turn before publishing"}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isPublishing ? "TRANSMITTING TO CLOUD..." : canPublishMatch ? "PUBLISH RUN TO GLOBAL LEADERBOARD" : "RUN A TURN BEFORE PUBLISHING"}
          </button>
        ) : (
          <div className="w-full bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 py-2.5 px-3 text-[10px] uppercase font-bold tracking-wider text-center flex items-center justify-center gap-1.5 rounded-sm">
            <Check className="w-3.5 h-3.5 text-[#00FF41]" />
            Match registered in public ledger!
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {status === "idle" || status === "paused" ? (
            <button
              onClick={onStartMatch}
              disabled={!topic.trim()}
              className="w-full bg-[#00FF41] hover:bg-white text-black font-extrabold py-3.5 text-xs uppercase transition-colors cursor-pointer"
            >
              START ARENA LOOP
            </button>
          ) : (
            <button
              onClick={onPauseMatch}
              className="w-full bg-[#FF4100] hover:bg-white text-black font-extrabold py-3.5 text-xs uppercase transition-colors cursor-pointer"
            >
              PAUSE AGENT LOOP
            </button>
          )}

          <button
            onClick={onStepTurn}
            disabled={status === "idle" || status.startsWith("researching") || status.startsWith("scoring")}
            className="w-full bg-black hover:bg-white hover:text-black text-white border-2 border-white font-extrabold py-3.5 text-xs uppercase transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Slam the virtual paddle and step debate turn immediately"
          >
            STEP VECTOR TURN
          </button>
        </div>

        {onOpenReplay && (
          <button
            onClick={onOpenReplay}
            className="w-full bg-[#00FF41]/10 hover:bg-[#00FF41] text-[#00FF41] hover:text-black border border-[#00FF41]/40 hover:border-transparent font-extrabold py-2.5 text-[10px] font-mono uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-sm"
            title="Launch full retro visual match re-enactment overlay player"
          >
            <span>REPLAY VISUALS (RE-ENACT RUN)</span>
          </button>
        )}

        <button
          onClick={onResetMatch}
          className="w-full border border-white/20 text-slate-500 hover:text-rose-500 hover:border-rose-500/50 py-2.5 text-[10px] font-mono font-black uppercase transition-colors cursor-pointer"
        >
          RESET RUN SESSION
        </button>
      </div>
      )}
    </div>
  );
};
