import React, { useState } from "react";
import {
  BookOpen, Brain, Scale, Sliders,
  HelpCircle, Book, Activity, Award, ChevronDown, ChevronRight, Quote, Heart
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TraitCardProps {
  name: string;
  impact: string;
  tuningGuide: string;
  examplePromptSnippet: string;
  icon: any;
  metricColor: string;
}
const TraitCard: React.FC<TraitCardProps> = ({ 
  name, impact, tuningGuide, examplePromptSnippet, icon: Icon, metricColor 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-white/10 bg-neutral-950/80 p-4 transition-all hover:border-white/30" id={`trait-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-xs ${metricColor} bg-opacity-10 text-white border border-white/10`}>
            <Icon className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <h4 className="font-mono text-xs font-black uppercase text-white tracking-wider">{name}</h4>
            <p className="text-[10px] text-slate-400 font-sans mt-0.5">{impact}</p>
          </div>
        </div>
        <button className="text-slate-500 hover:text-white transition-colors">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-3 pt-3 border-t border-white/5 space-y-3 mr-4"
          >
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Psychological Tuning Handbook:</span>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed normal-case">
                {tuningGuide}
              </p>
            </div>
            <div className="bg-black/60 p-2.5 border border-white/10 font-mono text-[10px] rounded-xs relative">
              <span className="absolute top-1.5 right-2 text-[10px] text-slate-600 uppercase font-mono tracking-tight font-extrabold">SYSTEM PROMPT WRAPPER</span>
              <span className="text-[#00FF41] block mb-1 font-bold">Recommended System Bias Trigger:</span>
              <code className="text-slate-400 select-all whitespace-pre-wrap leading-normal">
                "{examplePromptSnippet}"
              </code>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function AboutScienceManual() {
  const [activeSection, setActiveSection] = useState<"introduction" | "psychology" | "science" | "tuning">("introduction");

  const sections = [
    { id: "introduction", label: "General Manual & Guide", icon: BookOpen },
    { id: "psychology", label: "Psychological Trait Tuning", icon: Brain },
    { id: "science", label: "Architecture & Research", icon: Scale },
    { id: "tuning", label: "Features & Operational Tuning", icon: Sliders }
  ];

  return (
    <div className="w-full bg-black border-4 border-white p-6 relative shadow-[0_0_20px_rgba(255,255,255,0.05)] text-white font-mono" id="about-manual-dashboard">
      <div className="absolute -top-3 left-6 bg-black px-3 py-0.5 text-xs tracking-widest text-[#00FF41] font-bold border-2 border-white flex items-center gap-1.5">
        <Book className="w-4 h-4 shrink-0 text-[#00FF41]" />
        <span>ABOUT & DIALECTICAL CONSENSUS MANUAL</span>
      </div>

      {/* Main Grid structure */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-4">
        
        {/* Left Sidebar Table of Contents */}
        <div className="xl:col-span-3 flex flex-col gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">
            Manual Sections
          </span>
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`py-3 px-4 text-left font-mono text-xs uppercase font-extrabold border transition-all cursor-pointer flex items-center gap-2.5 ${
                  isActive 
                    ? "bg-[#00FF41]/10 border-[#00FF41] text-white shadow-[0_0_8px_rgba(0,255,65,0.05)]" 
                    : "bg-neutral-950 border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                }`}
                id={`manual-toc-${sec.id}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#00FF41]" : "text-slate-500"}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}

          <div className="border border-white/10 bg-neutral-900/40 p-4 mt-6 text-[10px] space-y-2 select-none">
            <span className="text-[#00FF41] font-black uppercase text-[10px] tracking-wider block">SYSTEM STATS</span>
            <div className="flex justify-between font-mono">
              <span className="text-slate-500 text-[10px]">Model System:</span>
              <span className="text-white text-[10px]">Mock, Local & Cloud Adapters</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-slate-500 text-[10px]">Consensus Engine:</span>
              <span className="text-white text-[10px]">Consensus Runtime v1.9</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-slate-500 text-[10px]">Persistence Unit:</span>
              <span className="text-white text-[10px]">JSON Ledger & Runtime Memory</span>
            </div>
          </div>
        </div>

        {/* Right content view area */}
        <div className="xl:col-span-9 border-l-0 xl:border-l xl:border-white/20 xl:pl-8">
          <AnimatePresence mode="wait">
            {activeSection === "introduction" && (
              <motion.div
                key="sec-introduction"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.12 }}
                className="space-y-6"
                id="manual-intro-view"
              >
                <div>
                  <h3 className="text-base font-black text-[#00FF41] flex items-center gap-1.5">
                    <Activity className="w-5 h-5 text-[#00FF41]" />
                    SYSTEM GENERAL OVERVIEW & USER WORKFLOW
                  </h3>
                  <div className="h-0.5 bg-gradient-to-r from-[#00FF41] to-transparent w-full mt-2" />
                </div>

                <p className="text-xs font-sans text-slate-300 leading-relaxed normal-case">
                  The Consensus Arena is a collaborative computer laboratory simulating decentralized deliberation between separate Artificial Intelligence agents. Designed as an interface modeling the age-old philosophical concept of <strong>dialectics</strong>, the system places two distinct expert personalities (the Challenger and the Defender) into an algorithmic discourse, forcing them to mutually iron out robust, type-safe blueprint guidelines.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-white/20 bg-neutral-950 p-4">
                    <span className="text-[#00FF41] text-[10px] font-bold uppercase tracking-wider block mb-2">WHAT IS IT?</span>
                    <p className="text-[11px] font-sans text-slate-400 leading-relaxed normal-case">
                      It is an agentic game platform mimicking human focus alignment. Instead of relying on a single top-level context, the application triggers a sequential, back-and-forth micro-debate where agents draft proposals, challenge underlying parameters, assign consensus agreements, and output a singular finalized task blueprint.
                    </p>
                  </div>
                  <div className="border border-white/20 bg-neutral-950 p-4">
                    <span className="text-[#00FF41] text-[10px] font-bold uppercase tracking-wider block mb-2">WHY USE IT?</span>
                    <p className="text-[11px] font-sans text-slate-400 leading-relaxed normal-case">
                      Single-turn LLM completions often miss subtle architecture bottlenecks or fall victim to passive alignment bias. By introducing competitive drive and opposing feedback loops, the generated solutions are tested for security, performance integrity, and logical failure bounds before outputting.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] text-[#00FF41] uppercase tracking-widest font-black block">
                    Three-Step Golden Setup Loop
                  </span>
                  <div className="space-y-2">
                    <div className="flex gap-3 items-start border border-white/10 p-3 bg-neutral-900/30">
                      <div className="bg-[#00FF41] text-black font-extrabold w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</div>
                      <div>
                        <span className="text-[11px] font-bold uppercase block text-white">Select a Problem Arena Topic</span>
                        <p className="text-[10px] text-slate-400 font-sans normal-case">Choose a preset blueprint scenario (like Aerospace fuel recyclers, double-spend cryptographic staging) or type a bespoke, localized software challenge.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start border border-white/10 p-3 bg-neutral-900/30">
                      <div className="bg-[#00FF41] text-black font-extrabold w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</div>
                      <div>
                        <span className="text-[11px] font-bold uppercase block text-white">Tune the Agents' Psychological Profiles</span>
                        <p className="text-[10px] text-slate-400 font-sans normal-case">Navigate to our matchmaking board, configure the drive intensity, select from our system strategy biases (Socratic, Adversarial, Cooperative), or write custom human psychology rules.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start border border-white/10 p-3 bg-neutral-900/30">
                      <div className="bg-[#00FF41] text-black font-extrabold w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</div>
                      <div>
                        <span className="text-[11px] font-bold uppercase block text-white">Launch the Arena Combat Loop</span>
                        <p className="text-[10px] text-slate-400 font-sans normal-case">Initiate the court. Watch the visual feedback play in real time, extract finalized JSON consensus plans using our exports, and use the D3 Sparklines to trend agreement levels.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "psychology" && (
              <motion.div
                key="sec-psychology"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.12 }}
                className="space-y-6"
                id="manual-psychology-view"
              >
                <div>
                  <h3 className="text-base font-black text-[#00FF41] flex items-center gap-1.5">
                    <Brain className="w-5 h-5 text-[#00FF41]" />
                    PSYCHOLOGICAL TRAIT TUNING HANDBOOK
                  </h3>
                  <div className="h-0.5 bg-gradient-to-r from-[#00FF41] to-transparent w-full mt-2" />
                </div>

                <p className="text-xs font-sans text-slate-300 leading-relaxed normal-case">
                  Beneath the logical rules, LLM personalities behave based on specific linguistic framing. By tweaking virtual psychological properties, we alter what the systems prioritize. Expanding on basic prompts, we can inject specialized human traits to prevent monotonous alignment.
                </p>

                <div className="border border-white/10 bg-neutral-950 p-3 text-[11px] leading-relaxed text-slate-300 normal-case" id="manual-live-trait-prompt-map">
                  The live debate prompt receives four explicit personality fields from each agent: <strong className="text-white">COMPETITIVE DRIVE</strong>, <strong className="text-white">STRATEGY PROFILE</strong>, <strong className="text-white">AGGRESSIVENESS</strong>, and <strong className="text-white">EMPATHY</strong>. These values alter tone, critique pattern, persuasion style, and willingness to concede before the next paddle volley is generated.
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] text-[#00FF41] uppercase tracking-widest font-black block">
                    Core Traits Integration Index
                  </span>
                  
                  <div className="space-y-2.5">
                    <TraitCard 
                      name="Empathy & Nurturing Quotient"
                      impact="Forces the agent to value previous proposals, align formatting, and build off complex nested architectures rather than rewriting."
                      tuningGuide="When Empathy is elevated (80%+), the agent acknowledges previous turns, starts with positive reinforcement signals (e.g. 'Your proposed storage ledger makes absolute sense'), and limits disruptive refactoring."
                      examplePromptSnippet="Prioritize the previous agent's architectural groundwork. Formulate solutions directly integrated into their structure, starting with an empathetic synthesis of their logic."
                      icon={Heart}
                      metricColor="text-pink-500"
                    />

                    <TraitCard 
                      name="Aggressiveness / Skeptical Challenge"
                      impact="Raises critique pressure, exposes weak assumptions faster, and makes the agent less willing to accept vague consensus."
                      tuningGuide="The AGGRESSIVENESS field in the active prompt tells the model to challenge claims more directly, identify fatal flaws earlier, and maintain a rigorous skeptical stance when the score is high."
                      examplePromptSnippet="Do not agree with proposals unless they provide explicit type-safety properties and concrete error boundary fallbacks. Challenge optimistic assumptions."
                      icon={HelpCircle}
                      metricColor="text-amber-500"
                    />

                    <TraitCard 
                      name="Competitive Drive / Ego Bias"
                      impact="Forces the agent to advocate for its own structures, resist complete conformity, and fight for its signature components."
                      tuningGuide="Elevated competitive drive results in assertive vocabulary, detailed benchmark assertions, and rhetorical defenses of its specific architectural approach."
                      examplePromptSnippet="Advocate strongly for your proposed system layout. Point out structural inefficiencies in alternative viewpoints before granting any compromise."
                      icon={Award}
                      metricColor="text-red-500"
                    />

                    <TraitCard 
                      name="Strategy Profile / Rhetorical Bias"
                      impact="Selects the debate posture used for the next turn: cooperative synthesis, Socratic diagnosis, rhetorical persuasion, adversarial red-team pressure, or balanced proposal building."
                      tuningGuide="The STRATEGY PROFILE field maps directly to the configured gameplay profile. Rhetorical mode emphasizes structured persuasion, crisp analogies, and audience-aware framing while still preserving factual discipline."
                      examplePromptSnippet="Use a rhetorical strategy: frame the strongest argument clearly, persuade with concise analogies, and keep every claim anchored to the implementation evidence."
                      icon={Quote}
                      metricColor="text-teal-500"
                    />
                  </div>
                </div>

                <div className="border border-white/20 p-4 bg-neutral-950">
                  <span className="text-[10px] text-[#00FF41] font-bold uppercase block mb-1">ADVANCED METHOD: MANUAL EMOTIONAL PROMPTING</span>
                  <p className="text-[11px] font-sans text-slate-400 leading-relaxed normal-case">
                    Linguistic studies show that LLMs correspond positively to emotional feedback and urgency signals. If you wish to achieve highly secure code blueprints, add sentences like: <strong>"This is critical for our team's survival, double check all lock-staging mechanics."</strong> directly into the System Custom prompt field.
                  </p>
                </div>
              </motion.div>
            )}

            {activeSection === "science" && (
              <motion.div
                key="sec-science"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.12 }}
                className="space-y-6"
                id="manual-science-view"
              >
                <div>
                  <h3 className="text-base font-black text-[#00FF41] flex items-center gap-1.5">
                    <Scale className="w-5 h-5 text-[#00FF41]" />
                    ARCHITECTURE & MULTI-AGENT COGNITION
                  </h3>
                  <div className="h-0.5 bg-gradient-to-r from-[#00FF41] to-transparent w-full mt-2" />
                </div>

                <p className="text-xs font-sans text-slate-300 leading-relaxed normal-case">
                  The architecture combines multi-agent debate, provider-agnostic model adapters, a match ledger, and deterministic visualization layers. This section documents how the consensus core behaves in the current app.
                </p>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs text-[#00FF41] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#00FF41] shrink-0" />
                      1. Debate Roles in Agent Pair Space
                    </h4>
                    <p className="text-[11px] font-sans text-slate-400 mt-1.5 leading-relaxed normal-case">
                      Each debate round is modeled as a paired review: one agent proposes, the opponent audits, and the judge condenses accepted points into durable milestones. Within the Consensus Arena:
                    </p>
                    <ul className="text-[11.5px] font-mono text-slate-300 pl-4 list-disc space-y-1 mt-2 uppercase">
                      <li><strong className="text-white font-bold">Agent A:</strong> Node west initiates the proposed spec blueprint.</li>
                      <li><strong className="text-white font-bold">Agent B:</strong> Node east audits the draft, raising critiques and edge-condition warnings.</li>
                      <li><strong className="text-white font-bold">Judge:</strong> The moderator condenses accepted points into finalized milestones.</li>
                    </ul>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-xs text-[#00FF41] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#00FF41] shrink-0" />
                      2. Generative Consensus & Scope Safeguards
                    </h4>
                    <p className="text-[11px] font-sans text-slate-400 mt-1.5 leading-relaxed normal-case">
                      The two-agent loop is designed to surface scope drift, missing constraints, and unnecessary implementation layers. Competitive drive and critique strength tune how aggressively each model challenges the proposed plan before the judge accepts a milestone.
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-xs text-[#00FF41] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#00FF41] shrink-0" />
                      3. Projected Signal Networks
                    </h4>
                    <p className="text-[11px] font-sans text-slate-400 mt-1.5 leading-relaxed normal-case">
                      The bottom training panel visualizes debate state as configurable signal weights. As turns advance, agreement and critique signals update the displayed node network so users have a direct visual anchor for convergence.
                    </p>
                  </div>
                </div>

                <div className="border border-white/10 bg-neutral-950 p-4 border-l-4 border-l-[#00FF41]">
                  <Quote className="w-4 h-4 text-slate-500 mb-1" />
                  <p className="text-[11px] font-serif italic text-slate-300 normal-case">
                    "Cognition is inherently conversational. By distributing problem structures into distinct computational minds, we discover the hidden edge conditions that unified models fail to isolate."
                  </p>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2 block">
                    Cognitive Pong Architecture Notes, 2026
                  </span>
                </div>
              </motion.div>
            )}

            {activeSection === "tuning" && (
              <motion.div
                key="sec-tuning"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.12 }}
                className="space-y-6"
                id="manual-tuning-view"
              >
                <div>
                  <h3 className="text-base font-black text-[#00FF41] flex items-center gap-1.5">
                    <Sliders className="w-5 h-5 text-[#00FF41]" />
                    DETAILED APP FEATURES & OPERATIONAL TUNING
                  </h3>
                  <div className="h-0.5 bg-gradient-to-r from-[#00FF41] to-transparent w-full mt-2" />
                </div>

                <p className="text-xs font-sans text-slate-300 leading-relaxed normal-case">
                  Each physical module on your screen is fine-tuned to represent a piece of the unified consensus system. Here is a feature guide with mechanical operations.
                </p>

                <div className="space-y-4">
                  
                  {/* Module 1: Consensus Board */}
                  <div className="border border-white/10 bg-neutral-900/20 p-4 space-y-1.5">
                    <span className="text-[10px] text-[#00FF41] font-bold uppercase tracking-wider block">Module 01: Consensus Board Header Widgets</span>
                    <p className="text-[11px] font-sans text-slate-400 leading-relaxed normal-case">
                      The consensus card features live SVG monitoring meters and export controls:
                    </p>
                    <ul className="text-[10.5px] font-mono pl-4 list-disc text-slate-300 space-y-1 uppercase">
                      <li>
                        <strong className="text-white">Sparkline Graph:</strong> Re-renders when at least two finalized milestones exist, tracking confidence movement across recent consensus outputs.
                      </li>
                      <li>
                        <strong className="text-white">Radial Agreement Gauge:</strong> Calculates the sliding mathematical mean confidence across all codified agreements, displaying the current collective alignment score.
                      </li>
                      <li>
                        <strong className="text-white">Exports:</strong> Save consensus plans as JSON or text, or copy Markdown when browser clipboard permission allows it.
                      </li>
                    </ul>
                  </div>

                  {/* Module 2: Matchmaking */}
                  <div className="border border-white/10 bg-neutral-900/20 p-4 space-y-1.5">
                    <span className="text-[10px] text-[#00FF41] font-bold uppercase tracking-wider block">Module 02: Model Matchmaking Arena</span>
                    <p className="text-[11px] font-sans text-slate-400 leading-relaxed normal-case">
                      This tab pulls active opponent submissions from saved public matches, letting you test customized coach configurations. Select an opponent, choose your challenger provider/model/endpoint settings, and launch a duel that resets the court, assigns your challenger to Agent A, assigns the opponent to Agent B, and scrolls the Pong canvas into view.
                    </p>
                  </div>

                  {/* Module 3: Pong Debates */}
                  <div className="border border-white/10 bg-neutral-900/20 p-4 space-y-1.5">
                    <span className="text-[10px] text-[#00FF41] font-bold uppercase tracking-wider block">Module 03: Physical Pong Logic</span>
                    <p className="text-[11px] font-sans text-slate-400 leading-relaxed normal-case">
                      The dynamic canvas-based retro Pong game handles rally timing. Each paddle bounce can trigger an agent exchange turn while the loop is running. Use Autonomy Speed controls to tune ball velocity, Step Volley for a single forced turn, and Reset to clear the run.
                    </p>
                  </div>

                  {/* Module 4: Neural network training */}
                  <div className="border border-white/10 bg-neutral-900/20 p-4 space-y-1.5">
                    <span className="text-[10px] text-[#00FF41] font-bold uppercase tracking-wider block">Module 04: Neural Synaptic Backpropagation</span>
                    <p className="text-[11px] font-sans text-slate-400 leading-relaxed normal-case">
                      The training core converts seed samples and live debate turns into local neural-network training data. Click <strong>"RUN BACKWARD PROPAGATION"</strong> to train, <strong>"STOP GRADIENT DESCENT"</strong> to commit partial epochs, then deploy the fine-tuned brain to influence Pong velocity through the Neural trainer HUD.
                    </p>
                  </div>

                </div>

                <div className="border border-[#00FF41]/20 bg-[#00FF41]/5 p-4 rounded-sm text-center">
                  <span className="text-[#00FF41] text-xs font-black uppercase tracking-widest block mb-1">QUICK-START TIP</span>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed normal-case">
                    For no-key testing, keep both agents on Mock local. For a local live model, choose Ollama local URL, set the instance to http://localhost:11434, select a pulled model such as llama3.1, set Competitive Drive near 85%, and launch the green matchmaking duel.
                  </p>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
