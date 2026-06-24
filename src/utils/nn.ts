export interface TrainingSample {
  topicLength: number;       // input 0
  convictionScore: number;   // input 1
  complexityValue: number;   // input 2 (0.2: quick, 0.6: deep, 1.0: simulation)
  targetSpeed: number;       // target 0
  targetEfficiency: number;  // target 1
  label?: string;            // friendly tag
}

export class SimpleNeuralNetwork {
  public layers: number[];
  public lr: number;
  public activationType: "sigmoid" | "relu";
  public weights: number[][][]; // weights[lay_idx][to_node][from_node]
  public biases: number[][];    // biases[lay_idx][node]
  public activations: number[][];

  constructor(layers: number[], lr: number = 0.15, activationType: "sigmoid" | "relu" = "sigmoid") {
    this.layers = layers;
    this.lr = lr;
    this.activationType = activationType;
    this.weights = [];
    this.biases = [];
    this.activations = [];

    // Initialize activations
    for (let i = 0; i < layers.length; i++) {
      this.activations.push(new Array(layers[i]).fill(0));
    }

    // Initialize weights and biases
    for (let l = 1; l < layers.length; l++) {
      const currentLayerSize = layers[l];
      const prevLayerSize = layers[l - 1];

      const layerWeights: number[][] = [];
      const layerBiases: number[] = [];

      for (let j = 0; j < currentLayerSize; j++) {
        const nodeWeights: number[] = [];
        for (let i = 0; i < prevLayerSize; i++) {
          // Xavier/He-like random initial weights between -0.5 and 0.5
          nodeWeights.push(Math.random() - 0.5);
        }
        layerWeights.push(nodeWeights);
        layerBiases.push(Math.random() - 0.5);
      }

      this.weights.push(layerWeights);
      this.biases.push(layerBiases);
    }
  }

  // Activation functions
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private sigmoidDerivative(y: number): number {
    return y * (1 - y);
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  private reluDerivative(y: number): number {
    return y > 0 ? 1 : 0;
  }

  // Forward pass
  public forward(inputs: number[], activationType: "sigmoid" | "relu" = this.activationType): number[] {
    this.activations[0] = [...inputs];

    for (let l = 0; l < this.weights.length; l++) {
      const prevActivation = this.activations[l];
      const currentWeights = this.weights[l];
      const currentBiases = this.biases[l];
      const currentActivation = this.activations[l + 1];

      for (let j = 0; j < currentActivation.length; j++) {
        let sum = currentBiases[j];
        for (let i = 0; i < prevActivation.length; i++) {
          sum += prevActivation[i] * currentWeights[j][i];
        }
        
        if (l === this.weights.length - 1) {
          // Output layer: always use standard Sigmoid for scale limits 0.0 - 1.0
          currentActivation[j] = this.sigmoid(sum);
        } else {
          // Hidden layer
          currentActivation[j] = activationType === "sigmoid" ? this.sigmoid(sum) : this.relu(sum);
        }
      }
    }

    return this.activations[this.activations.length - 1];
  }

  // Backpropagation pass - returns training mean absolute error
  public backprop(targets: number[], activationType: "sigmoid" | "relu" = this.activationType): number {
    const outputs = this.activations[this.activations.length - 1];
    let errors: number[][] = [];

    // Initialize error structures
    for (let i = 0; i < this.layers.length; i++) {
      errors.push(new Array(this.layers[i]).fill(0));
    }

    // Output layer errors
    let absoluteErrorSum = 0;
    const outputLayerIdx = this.layers.length - 1;
    for (let j = 0; j < outputs.length; j++) {
      const diff = targets[j] - outputs[j];
      errors[outputLayerIdx][j] = diff * this.sigmoidDerivative(outputs[j]);
      absoluteErrorSum += Math.abs(diff);
    }

    // Hidden layers errors (backpropagating backwards)
    for (let l = this.weights.length - 1; l > 0; l--) {
      const currentLayerIdx = l; // layer being backpropagated TO (hidden layer)
      const nextLayerIdx = l + 1;
      const currentWeights = this.weights[l]; // weights between current hidden and next layer
      const numHiddenNodes = this.layers[currentLayerIdx];
      const numNextNodes = this.layers[nextLayerIdx];

      for (let i = 0; i < numHiddenNodes; i++) {
        let errorSum = 0;
        for (let j = 0; j < numNextNodes; j++) {
          errorSum += errors[nextLayerIdx][j] * currentWeights[j][i];
        }

        const activation = this.activations[currentLayerIdx][i];
        const derivative = activationType === "sigmoid" 
          ? this.sigmoidDerivative(activation) 
          : this.reluDerivative(activation);

        errors[currentLayerIdx][i] = errorSum * derivative;
      }
    }

    // Weight and bias adjustments
    for (let l = 0; l < this.weights.length; l++) {
      const prevActivations = this.activations[l];
      const layerErrors = errors[l + 1];
      const currentWeights = this.weights[l];
      const currentBiases = this.biases[l];

      for (let j = 0; j < currentWeights.length; j++) {
        for (let i = 0; i < currentWeights[j].length; i++) {
          currentWeights[j][i] += this.lr * layerErrors[j] * prevActivations[i];
        }
        currentBiases[j] += this.lr * layerErrors[j];
      }
    }

    return absoluteErrorSum / targets.length;
  }
}

// Generate starting default synthetic dataset if training logs are light
export function getSyntheticTrainData(): TrainingSample[] {
  return [
    { topicLength: 0.15, convictionScore: 0.35, complexityValue: 0.2, targetSpeed: 0.85, targetEfficiency: 0.22, label: "Simple factual exchange" },
    { topicLength: 0.45, convictionScore: 0.55, complexityValue: 0.6, targetSpeed: 0.52, targetEfficiency: 0.48, label: "Detailed code challenge critique" },
    { topicLength: 0.95, convictionScore: 0.88, complexityValue: 1.0, targetSpeed: 0.22, targetEfficiency: 0.91, label: "Multi-parameter cloud deployment simulation" },
    { topicLength: 0.25, convictionScore: 0.92, complexityValue: 0.2, targetSpeed: 0.78, targetEfficiency: 0.88, label: "Factual trivia speed match" },
    { topicLength: 0.70, convictionScore: 0.75, complexityValue: 0.6, targetSpeed: 0.41, targetEfficiency: 0.72, label: "Database architectural trade-off session" },
    { topicLength: 0.88, convictionScore: 0.20, complexityValue: 1.0, targetSpeed: 0.15, targetEfficiency: 0.31, label: "Complex quantum network packet simulation" },
    { topicLength: 0.32, convictionScore: 0.15, complexityValue: 0.2, targetSpeed: 0.92, targetEfficiency: 0.18, label: "Quick check of ports on host machine" }
  ];
}
