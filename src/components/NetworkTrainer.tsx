import React, { useState, useEffect, useRef } from "react";
import { SimpleNeuralNetwork, TrainingSample, getSyntheticTrainData } from "../utils/nn";
import { Brain, Settings2, Play, CheckCircle2, RefreshCw, BarChart2, Zap, Cpu, Download, Database, FileCode, ArrowRight } from "lucide-react";
import { DebateTurn } from "../types";
import { genericTurnSenderLabel } from "../utils/turnDisplay";

interface NetworkTrainerProps {
  history: DebateTurn[];
  activeTopic: string;
  onDeployModel: (nn: SimpleNeuralNetwork | null) => void;
}

export const NetworkTrainer: React.FC<NetworkTrainerProps> = ({
  history,
  activeTopic,
  onDeployModel,
}) => {
  // Settings / Hyperparameters
  const [layersConfig, setLayersConfig] = useState<string>("3-8-2"); // Input-Hidden-Output
  const [learningRate, setLearningRate] = useState<number>(0.15);
  const [activationType, setActivationType] = useState<"sigmoid" | "relu">("sigmoid");
  const [epochsCount, setEpochsCount] = useState<number>(100);

  // Training state
  const [dataset, setDataset] = useState<TrainingSample[]>([]);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [currentEpoch, setCurrentEpoch] = useState<number>(0);
  const [trainedEpochs, setTrainedEpochs] = useState<number>(0);
  const [latestLoss, setLatestLoss] = useState<number | null>(null);
  const [isDeployed, setIsDeployed] = useState<boolean>(false);

  // Neural network instance ref
  const nnRef = useRef<SimpleNeuralNetwork | null>(null);
  const trainingIntervalRef = useRef<any>(null);
  const trainingRunEpochsRef = useRef<number>(0);

  // Initialize network and dataset
  useEffect(() => {
    // Generate active dataset based on current game debate turns + standard seeds
    const seeds = getSyntheticTrainData();
    const gameSamples: TrainingSample[] = history.map((turn, idx) => {
      const complexVal = 
        turn.complexity === "complex simulation" ? 1.0 :
        turn.complexity === "deep research" ? 0.6 : 0.2;
      const normalizedLen = Math.min(1.0, (turn.content.length % 1000) / 1000);
      const normalizedScore = turn.convictionScore / 100;

      return {
        topicLength: normalizedLen,
        convictionScore: normalizedScore,
        complexityValue: complexVal,
        targetSpeed: Math.max(0.2, 1.35 - complexVal * 0.8), // simulated realistic targets
        targetEfficiency: Math.max(0.1, normalizedScore * (1.1 - Math.abs(normalizedLen - normalizedScore))),
        label: `Active Game turn #${idx + 1} (${genericTurnSenderLabel(turn.sender)})`
      };
    });

    setDataset([...gameSamples, ...seeds]);
  }, [history, activeTopic]);

  // Construct neural network weights on layers changes
  const resetNetwork = () => {
    const nodes = layersConfig.split("-").map(Number);
    nnRef.current = new SimpleNeuralNetwork(nodes, learningRate, activationType);
    setTrainedEpochs(0);
    setCurrentEpoch(0);
    setLossHistory([]);
    setLatestLoss(null);
    setIsDeployed(false);
    trainingRunEpochsRef.current = 0;
    onDeployModel(null);
  };

  useEffect(() => {
    resetNetwork();
  }, [layersConfig, learningRate, activationType]);

  // Execute Backprop Training Loop (animated epoch by epoch)
  const commitCompletedRunEpochs = () => {
    const completedEpochs = trainingRunEpochsRef.current;
    if (completedEpochs > 0) {
      setTrainedEpochs((prev) => prev + completedEpochs);
      trainingRunEpochsRef.current = 0;
    }
  };

  const stopTraining = (commitPartial = true) => {
    if (trainingIntervalRef.current) {
      clearInterval(trainingIntervalRef.current);
      trainingIntervalRef.current = null;
    }
    if (commitPartial) {
      commitCompletedRunEpochs();
    }
    setIsTraining(false);
  };

  const startTraining = () => {
    if (isTraining) {
      stopTraining();
      return;
    }

    if (dataset.length === 0) return;

    const nodes = layersConfig.split("-").map(Number);
    // If we haven't initialized or if we are continuing, make sure nnRef exists
    if (!nnRef.current) {
      nnRef.current = new SimpleNeuralNetwork(nodes, learningRate, activationType);
    } else {
      // update learning rate dynamically in case they adjusted it in UI
      nnRef.current.lr = learningRate;
      nnRef.current.activationType = activationType;
    }

    setIsTraining(true);
    trainingRunEpochsRef.current = 0;
    let epoch = 0;
    const tempLosses: number[] = [];

    trainingIntervalRef.current = setInterval(() => {
      if (epoch >= epochsCount) {
        stopTraining(false);
        commitCompletedRunEpochs();
        return;
      }

      let epochLossSum = 0;
      // Shuffle dataset for mini batches gradient descent approximation
      const shuffled = [...dataset].sort(() => Math.random() - 0.5);

      shuffled.forEach((sample) => {
        const inputs = [sample.topicLength, sample.convictionScore, sample.complexityValue];
        const targets = [sample.targetSpeed, sample.targetEfficiency];

        // Forward
        nnRef.current!.forward(inputs, activationType);
        // Backprop
        const sampleError = nnRef.current!.backprop(targets, activationType);
        epochLossSum += sampleError;
      });

      const avgEpochLoss = epochLossSum / shuffled.length;
      tempLosses.push(avgEpochLoss);
      
      // Update state in increments to keep browser smooth
      const completedEpoch = epoch + 1;
      trainingRunEpochsRef.current = completedEpoch;

      if (epoch % Math.max(1, Math.floor(epochsCount / 40)) === 0 || epoch === epochsCount - 1) {
        // Keep only last 100 historical records for beautiful canvas chart
        setLossHistory([...tempLosses]);
        setLatestLoss(avgEpochLoss);
        setCurrentEpoch(completedEpoch);
      }

      epoch = completedEpoch;
    }, 15); // highly accelerated animated epoch steps
  };

  useEffect(() => {
    return () => {
      if (trainingIntervalRef.current) {
        clearInterval(trainingIntervalRef.current);
      }
    };
  }, []);

  const handleDeploy = () => {
    if (!nnRef.current || trainedEpochs === 0) return;
    const targetState = !isDeployed;
    setIsDeployed(targetState);
    onDeployModel(targetState ? nnRef.current : null);
  };

  // --- CO-TRAINING AND MODEL COMPETITIVE EXPORTERS ---
  const downloadJSONFile = (dataObj: any, filename: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportWeightsAsJson = () => {
    if (!nnRef.current || trainedEpochs === 0) {
      alert("Please run backward propagation training to populate weights before exporting matrices!");
      return;
    }
    const nodes = layersConfig.split("-").map(Number);
    const weightArtifact = {
      modelName: "Agentic_Debate_Pong_Tuned_Brain",
      epochTrained: trainedEpochs,
      layers: nodes,
      learningRate: learningRate,
      activationType: activationType,
      weights: nnRef.current.weights,
      biases: nnRef.current.biases,
      timestamp: new Date().toISOString()
    };
    downloadJSONFile(weightArtifact, "pong_neural_weights.json");
  };

  const exportTrainingDataJSONL = () => {
    if (history.length === 0) {
      alert("No active debate turns to compile into a JSONL fine-tuning dataset yet!");
      return;
    }
    let jsonlContent = "";
    history.forEach((turn, idx) => {
      const precedingCtx = history.slice(0, idx).map(t => `${genericTurnSenderLabel(t.sender)}: ${t.content}`).join("\n\n");
      const sampleObj = {
        messages: [
          {
            role: "system",
            content: `You are in a live agentic competitive debate on: "${activeTopic}". Act point-by-point like a human reacting directly to loopholes.`
          },
          {
            role: "user",
            content: precedingCtx ? `Historical context:\n${precedingCtx}\n\nFormulate your next retort or proposal!` : `Open the debate on the topic: "${activeTopic}"`
          },
          {
            role: "assistant",
            content: JSON.stringify({
              content: turn.content,
              type: turn.type,
              proposal: turn.proposal || "",
              convictionScore: turn.convictionScore,
              complexity: turn.complexity
            })
          }
        ]
      };
      jsonlContent += JSON.stringify(sampleObj) + "\n";
    });

    const dataUri = "data:text/plain;charset=utf-8," + encodeURIComponent(jsonlContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataUri);
    downloadAnchor.setAttribute("download", "arena_debate_training_data.jsonl");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportExecutableCode = () => {
    if (!nnRef.current || trainedEpochs === 0) {
      alert("No trained network weights available to export yet. Train epochs first!");
      return;
    }
    const nodes = layersConfig.split("-").map(Number);
    const serializedWeights = JSON.stringify(nnRef.current.weights);
    const serializedBiases = JSON.stringify(nnRef.current.biases);

    const tsCode = `/**
 * Standalone Executable SimpleNeuralNetwork class encapsulating trained weights.
 * Generated from the Agentic Pong Debate Competative Loop on ${new Date().toLocaleDateString()}.
 */
export class PortableDebateEvaluator {
  private layers: number[] = ${JSON.stringify(nodes)};
  private activationType: string = "${activationType}";
  private weights: number[][][] = ${serializedWeights};
  private biases: number[][] = ${serializedBiases};

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  /**
   * Run forward prediction inference through your fine-tuned model architecture!
   * @param inputs [normalizedTopicLen, convictionScore, complexityValue]
   * @returns [predictedTargetSpeed, predictedEfficiency]
   */
  public predict(inputs: number[]): number[] {
    let currentActivations = [...inputs];

    for (let l = 0; l < this.weights.length; l++) {
      const currentWeights = this.weights[l];
      const currentBiases = this.biases[l];
      const nextActivations: number[] = [];

      for (let j = 0; j < currentWeights.length; j++) {
        let sum = currentBiases[j];
        for (let i = 0; i < currentActivations.length; i++) {
          sum += currentActivations[i] * currentWeights[j][i];
        }

        // Output layer uses sigmoid; hidden layers use configured activation function
        if (l === this.weights.length - 1) {
          nextActivations.push(this.sigmoid(sum));
        } else {
          nextActivations.push(this.activationType === "sigmoid" ? this.sigmoid(sum) : this.relu(sum));
        }
      }
      currentActivations = nextActivations;
    }

    return currentActivations;
  }
}
`;
    const dataUri = "data:text/typescript;charset=utf-8," + encodeURIComponent(tsCode);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataUri);
    downloadAnchor.setAttribute("download", "TrainedBrainEvaluator.ts");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Node graph coordinates computation
  const width = 460;
  const height = 180;
  const parseLayers = layersConfig.split("-").map(Number);

  const getNeuronCoords = () => {
    const coords: { x: number; y: number; layerIdx: number; nodeIdx: number; val: number }[] = [];
    const layCount = parseLayers.length;
    const stepX = width / (layCount + 1);

    for (let l = 0; l < layCount; l++) {
      const nodeCount = parseLayers[l];
      const stepY = height / (nodeCount + 1);
      const x = stepX * (l + 1);

      for (let n = 0; n < nodeCount; n++) {
        const y = stepY * (n + 1);
        let currentActivationValue = 0;
        if (nnRef.current && nnRef.current.activations[l]) {
          currentActivationValue = nnRef.current.activations[l][n] || 0;
        }
        coords.push({ x, y, layerIdx: l, nodeIdx: n, val: currentActivationValue });
      }
    }
    return coords;
  };

  const coords = getNeuronCoords();

  // Draw synapses (connections) lines
  const renderSynapses = () => {
    if (!nnRef.current) return null;
    const synapses: React.ReactNode[] = [];
    
    // weights[layerIdx][toNode][fromNode]
    for (let l = 0; l < nnRef.current.weights.length; l++) {
      const currentLayerWeights = nnRef.current.weights[l];
      for (let j = 0; j < currentLayerWeights.length; j++) {
        for (let i = 0; i < currentLayerWeights[j].length; i++) {
          const weight = currentLayerWeights[j][i];
          
          // Locate corresponding coordinate points
          const fromNode = coords.find(c => c.layerIdx === l && c.nodeIdx === i);
          const toNode = coords.find(c => c.layerIdx === l + 1 && c.nodeIdx === j);

          if (fromNode && toNode) {
            // Cyan/Green for positive weight bounds, Red/Orange for negative
            const color = weight >= 0 ? "rgba(0, 255, 65, " : "rgba(255, 65, 0, ";
            const absWeight = Math.min(2.5, Math.abs(weight));
            const opacity = Math.max(0.08, Math.min(0.85, absWeight / 2.0));
            const strokeWidth = Math.max(0.5, Math.min(3.5, absWeight * 1.5));

            synapses.push(
              <line
                key={`synapse-${l}-${j}-${i}`}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={`${color}${opacity})`}
                strokeWidth={strokeWidth}
                className={isTraining ? "animate-pulse" : ""}
              />
            );
          }
        }
      }
    }
    return synapses;
  };

  return (
    <div className="min-w-0 overflow-hidden border border-white/20 bg-black mt-6 relative" id="neural-net-trainer-sandbox">
      {/* Tab/Panel Header */}
      <div className="flex flex-col gap-2 border-b border-white/20 px-4 py-3 bg-[#0d0d0d] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Brain className="h-4.5 w-4.5 text-[#00FF41] shrink-0" />
          <span className="min-w-0 text-[11px] font-mono font-black uppercase tracking-widest text-white">
            CUSTOM DEEP NEURAL NETWORK TRAINER
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-neutral-900 border border-white/10 text-slate-500 uppercase font-black leading-none">
            EIGEN_LAYER_v2.5
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-mono">
          <span className="h-2 w-2 bg-[#00FF41] rounded-full inline-block animate-ping" />
          <span className="text-slate-400 font-bold uppercase tracking-wide">ACTIVE MATCH LEARNING ENABLED</span>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 p-4 lg:grid-cols-12">
        {/* Column 1: NN Controls & Hyperparameters */}
        <div className="min-w-0 space-y-4 border-b border-white/10 pb-4 lg:col-span-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
          <div className="flex items-center gap-1.5 pb-2 border-b border-white/10">
            <Settings2 className="h-3.5 w-3.5 text-[#00FF41]" />
            <span className="text-[10px] font-mono font-bold text-white uppercase">TRAINING HYPERPARAMETERS</span>
          </div>

          <div className="space-y-3 font-mono text-[10px]">
            {/* Net Structure */}
            <div>
              <label className="text-slate-500 block mb-1 uppercase font-black leading-tight">HIDDEN LAYER PRESETS</label>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                {[
                  { label: "Small (3-4-2)", val: "3-4-2" },
                  { label: "Deep (3-8-2)", val: "3-8-2" },
                  { label: "Double (3-8-4-2)", val: "3-8-4-2" }
                ].map((item) => (
                  <button
                    key={item.val}
                    id={`trainer-layer-preset-${item.val}`}
                    type="button"
                    aria-pressed={layersConfig === item.val}
                    disabled={isTraining}
                    onClick={() => setLayersConfig(item.val)}
                    className={`py-1 text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                      layersConfig === item.val
                        ? "bg-[#00FF41] border-[#00FF41] text-black"
                        : "bg-black text-slate-400 border-white/20 hover:border-white/40"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Learning rate / Activations */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1 uppercase font-black">LEARNING RATE</label>
                <select
                  id="trainer-learning-rate-select"
                  aria-label="Trainer learning rate"
                  value={learningRate}
                  disabled={isTraining}
                  onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                  className="w-full bg-black border border-white/20 py-1 px-1 focus:outline-none focus:border-[#00FF41] text-white font-bold cursor-pointer"
                >
                  <option value="0.05">0.05 (Conservative)</option>
                  <option value="0.15">0.15 (Balanced)</option>
                  <option value="0.3">0.30 (Aggressive)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-500 block mb-1 uppercase font-black">ACTIVATION</label>
                <select
                  id="trainer-activation-select"
                  aria-label="Trainer activation"
                  value={activationType}
                  disabled={isTraining}
                  onChange={(e) => setActivationType(e.target.value as "sigmoid" | "relu")}
                  className="w-full bg-black border border-white/20 py-1 px-1 focus:outline-none focus:border-[#00FF41] text-white font-bold cursor-pointer"
                >
                  <option value="sigmoid">Sigmoid</option>
                  <option value="relu">ReLU (Rectified)</option>
                </select>
              </div>
            </div>

            {/* Epoch Target */}
            <div>
              <label className="text-slate-500 block mb-1 uppercase font-black">TRAINING TARGET (EPOCHS)</label>
              <select
                id="trainer-epochs-select"
                aria-label="Trainer epoch target"
                value={epochsCount}
                disabled={isTraining}
                onChange={(e) => setEpochsCount(parseInt(e.target.value))}
                className="w-full bg-black border border-white/20 py-1 px-1 focus:outline-none focus:border-[#00FF41] text-white font-bold cursor-pointer"
              >
                <option value="50">50 EPOCHS (Fast Calibration)</option>
                <option value="100">100 EPOCHS (Standard Tuning)</option>
                <option value="250">250 EPOCHS (Deep Backprop Convergence)</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                id="trainer-run-stop-button"
                type="button"
                onClick={startTraining}
                className={`w-full py-2 flex items-center justify-center gap-1.5 border font-mono uppercase text-[10px] font-black cursor-pointer transition-colors ${
                  isTraining
                    ? "bg-[#FF4100] border-[#FF4100] text-black hover:bg-[#FF4100]/90"
                    : "bg-[#00FF41] border-[#00FF41] text-black hover:bg-[#00FF41]/90"
                }`}
              >
                {isTraining ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin text-black" />
                    STOP GRADIENT DESCENT
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 fill-black text-black" />
                    RUN BACKWARD PROPAGATION
                  </>
                )}
              </button>

              <button
                id="trainer-deploy-button"
                type="button"
                disabled={trainedEpochs === 0 || isTraining}
                onClick={handleDeploy}
                className={`w-full py-1.5 flex items-center justify-center gap-1 border font-mono uppercase text-[10px] font-black cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDeployed && trainedEpochs > 0
                    ? "bg-black text-rose-400 border-rose-400/40 hover:bg-neutral-900"
                    : "bg-black text-cyan-400 border-cyan-400/40 hover:bg-neutral-900"
                }`}
              >
                {isDeployed ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-rose-400" />
                    DISMANTLE DEPLOYED MATRIX
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 text-cyan-400 fill-cyan-400/20" />
                    DEPLOY FINE-TUNED BRAIN
                  </>
                )}
              </button>
            </div>

            {/* Model & Dataset Export Suite */}
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">
                COMPETITIVE CO-TRAINING EXPORTS
              </span>
              
              <button
                id="trainer-export-weights-button"
                type="button"
                onClick={exportWeightsAsJson}
                disabled={trainedEpochs === 0 || isTraining}
                className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-neutral-900 border border-white/10 hover:border-[#00FF41]/40 text-[10px] font-mono text-slate-300 hover:text-[#00FF41] cursor-pointer transition-colors font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:border-white/10"
                title={trainedEpochs === 0 ? "Train at least one epoch before exporting weights" : "Download the full neural networks weight matrix as a portable JSON file"}
              >
                <Download className="h-3.5 w-3.5" /> Download Weights (.JSON)
              </button>

              <button
                id="trainer-export-dataset-button"
                type="button"
                onClick={exportTrainingDataJSONL}
                disabled={history.length === 0 || isTraining}
                className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-neutral-900 border border-white/10 hover:border-cyan-400/40 text-[10px] font-mono text-slate-300 hover:text-cyan-400 cursor-pointer transition-colors font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:border-white/10"
                title={history.length === 0 ? "Run at least one debate turn before exporting training data" : "Download cumulative debate transcript items as provider-neutral JSONL training data"}
              >
                <Database className="h-3.5 w-3.5" /> Download Training Dataset (.JSONL)
              </button>

              <button
                id="trainer-export-model-button"
                type="button"
                onClick={exportExecutableCode}
                disabled={trainedEpochs === 0 || isTraining}
                className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-neutral-900 border border-white/10 hover:border-rose-400/40 text-[10px] font-mono text-slate-300 hover:text-rose-400 cursor-pointer transition-colors font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:border-white/10"
                title={trainedEpochs === 0 ? "Train at least one epoch before exporting executable weights" : "Download complete auto-generated TypeScript class initialized with these trained weights to run predictions anywhere"}
              >
                <FileCode className="h-3.5 w-3.5" /> Export Trained Model (.TS)
              </button>
            </div>

          </div>
        </div>

        {/* Column 2: Live Nodes Visualization Map */}
        <div className="min-w-0 flex flex-col justify-between lg:col-span-8">
          <div className="flex flex-col gap-2 border-b border-white/10 pb-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-[10px] font-mono font-bold text-white uppercase tracking-wider">
              <Cpu className="h-3.5 w-3.5 text-[#00FF41]" /> ARCHITECTURE VISUALIZER MAP
            </span>
            <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-500 uppercase font-bold">
              <span className="flex items-center gap-1 hover:text-cyan-400 select-none">
                <span className="h-1.5 w-1.5 bg-[#00FF41] inline-block" /> Pos Weights
              </span>
              <span className="flex items-center gap-1 hover:text-[#FF4100] select-none">
                <span className="h-1.5 w-1.5 bg-[#FF4100] inline-block" /> Neg Weights
              </span>
            </div>
          </div>

          {/* SVG Map Container */}
          <div className="bg-black/60 border border-white/10 py-1 flex items-center justify-center relative overflow-x-auto overflow-y-hidden" style={{ height: height + 20 }}>
            {isTraining && (
              <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />
            )}
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[500px] max-h-full overflow-visible">
              {/* Render synapse connections links */}
              {renderSynapses()}

              {/* Render Nodes Neurons circles */}
              {coords.map((neuron, idx) => {
                let size = 6;
                let textOffset = 18;

                if (neuron.layerIdx === 0) {
                  size = 7;
                } else if (neuron.layerIdx === parseLayers.length - 1) {
                  size = 8;
                }

                return (
                  <g key={`neuron-layer-${neuron.layerIdx}-n-${neuron.nodeIdx}-${idx}`}>
                    <circle
                      cx={neuron.x}
                      cy={neuron.y}
                      r={size}
                      className="stroke-[1.5] transition-all"
                      stroke={neuron.layerIdx === 0 ? "#00FF41" : neuron.layerIdx === parseLayers.length - 1 ? "#FF4100" : "rgba(255,255,255,0.4)"}
                      fill={neuron.val > 0.5 ? "rgba(0, 255, 65, 0.25)" : "black"}
                    />
                    {/* Input labels */}
                    {neuron.layerIdx === 0 && (
                      <text
                        x={neuron.x - textOffset}
                        y={neuron.y + 3}
                        textAnchor="end"
                        className="fill-slate-500 text-[10px] font-mono select-none"
                      >
                        {neuron.nodeIdx === 0 ? "text_len" : neuron.nodeIdx === 1 ? "conviction" : "complexity"}
                      </text>
                    )}
                    {/* Output labels */}
                    {neuron.layerIdx === parseLayers.length - 1 && (
                      <text
                        x={neuron.x + textOffset}
                        y={neuron.y + 3}
                        className="fill-slate-300 text-[10px] font-mono select-none"
                      >
                        {neuron.nodeIdx === 0 ? "y_friction" : "y_efficiency"}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Neural Matrix Stats overlay */}
            <div className="absolute bottom-2.5 left-2.5 px-2 py-1 bg-black/85 border border-white/10 text-[10px] font-mono leading-relaxed uppercase space-y-0.5">
              <div>Network Node Config: <span id="trainer-network-config" className="text-white font-black">{layersConfig}</span></div>
              <div>Training Epochs: <span id="trainer-epoch-status" className="text-white font-black">{currentEpoch || trainedEpochs} / {epochsCount}</span></div>
              <div>Loss MAE Gradient: <span id="trainer-loss-status" className="text-[#FF4100] font-black">{latestLoss ? latestLoss.toFixed(5) : "---"}</span></div>
              <div>Injected State: <span id="trainer-deploy-status" className={isDeployed ? "text-cyan-400 font-bold" : "text-slate-500 font-bold"}>{isDeployed ? "DEPLOYED" : "OFFLINE"}</span></div>
            </div>
          </div>

          {/* Loss graph or helper footer */}
          <div className="mt-3 flex flex-col gap-2 bg-white/5 border border-white/10 px-3 py-2 text-[10px] font-mono leading-relaxed text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 uppercase shrink-0">
              <BarChart2 className="h-3.5 w-3.5 text-cyan-400" /> LOSS MINIMIZATION GRAPH:
            </div>
            {lossHistory.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2 overflow-x-hidden sm:justify-end">
                <span className="text-[10px] text-slate-500">START: {lossHistory[0].toFixed(3)}</span>
                <ArrowRight className="h-3 w-3 text-neutral-500" aria-hidden="true" />
                <div className="flex gap-0.5 items-end justify-end w-32 h-4 border-b border-white/20 px-1">
                  {lossHistory.filter((_, i) => i % Math.max(1, Math.floor(lossHistory.length / 15)) === 0).map((loss, idx) => {
                    const normalizedHeight = Math.max(1, Math.min(16, (1.0 - loss) * 16));
                    return (
                      <div
                        key={idx}
                        className="w-1.5 bg-[#00FF41]/40"
                        style={{ height: `${normalizedHeight}px` }}
                      />
                    );
                  })}
                </div>
                <ArrowRight className="h-3 w-3 text-neutral-500" aria-hidden="true" />
                <span className="text-[10px] text-[#00FF41] font-bold">ACCURACY: {((1.0 - (latestLoss || 0.5)) * 100).toFixed(1)}%</span>
              </div>
            ) : (
              <span className="min-w-0 flex-1 text-left text-[10px] text-slate-600 uppercase select-none sm:text-right">
                INITIATE NETWORK BACKPROPAGATION TO COMPILE A TRAINED WEIGHT MATRIX MATCH
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dataset collection log */}
      <div className="min-w-0 border-t border-white/10 px-4 py-3 bg-[#080808]" id="nn-dataset-samples">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">
            <Settings2 className="h-3.5 w-3.5 text-[#00FF41]" /> LOGGED COGNITIVE TRANSCRIPTION POINTS
          </span>
          <span id="trainer-dataset-count" className="text-left text-[10px] font-mono text-slate-500 uppercase sm:text-right">
            Captured {dataset.length} frames of active conversation
          </span>
        </div>
        <div id="nn-dataset-source-disclosure" className="mb-2 text-[10px] font-mono uppercase tracking-wide text-amber-300/90">
          Dataset combines live match turns with deterministic seed samples used only to keep the trainer testable before a long match exists.
        </div>
        <div className="max-h-[85px] max-w-full overflow-x-auto overflow-y-auto rounded border border-white/10">
          <table id="trainer-dataset-table" className="min-w-[680px] w-full text-left font-mono text-[10px] leading-tight select-none">
            <thead>
              <tr className="bg-neutral-900 border-b border-white/10 text-slate-500 uppercase font-black text-[10px]">
                <th className="py-1 px-2">Index</th>
                <th className="py-1 px-2">Label/Origin File</th>
                <th className="py-1 px-2 text-right">Length (In)</th>
                <th className="py-1 px-2 text-right">Conviction (In)</th>
                <th className="py-1 px-2 text-right">Complexity (In)</th>
                <th className="py-1 px-2 text-right text-cyan-400">Target Speed</th>
                <th className="py-1 px-2 text-right text-rose-400">Target Conf</th>
              </tr>
            </thead>
            <tbody>
              {dataset.map((data, idx) => (
                <tr
                  key={idx}
                  id={`trainer-dataset-row-${idx}`}
                  data-sample-source={data.label?.startsWith("Active Game turn") ? "active" : "seed"}
                  className="hover:bg-neutral-950 font-medium text-slate-400 border-b border-white/5 py-0.5 leading-none h-5"
                >
                  <td className="py-1 px-2 text-slate-600">FRM_{idx.toString().padStart(3, "0")}</td>
                  <td className="py-1 px-2 truncate max-w-[120px] text-zinc-300 uppercase">{data.label}</td>
                  <td className="py-1 px-2 text-right">{data.topicLength.toFixed(3)}</td>
                  <td className="py-1 px-2 text-right">{(data.convictionScore * 100).toFixed(0)}%</td>
                  <td className="py-1 px-2 text-right">{data.complexityValue === 1.0 ? "Simulation (1.0)" : data.complexityValue === 0.6 ? "Research (0.6)" : "Lookup (0.2)"}</td>
                  <td className="py-1 px-2 text-right text-cyan-400 font-bold">{data.targetSpeed.toFixed(2)}x</td>
                  <td className="py-1 px-2 text-right text-rose-400 font-bold">{data.targetEfficiency.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
