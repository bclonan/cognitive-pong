import assert from "node:assert/strict";
import test from "node:test";
import { SimpleNeuralNetwork } from "../src/utils/nn";

test("deployed neural network forward uses its stored activation type by default", () => {
  const network = new SimpleNeuralNetwork([1, 1, 1], 0.1, "relu");
  network.weights = [[[1]], [[2]]];
  network.biases = [[-0.5], [0]];

  const defaultOutput = network.forward([-1])[0];
  const reluOutput = network.forward([-1], "relu")[0];
  const sigmoidOutput = network.forward([-1], "sigmoid")[0];

  assert.equal(network.activationType, "relu");
  assert.ok(Math.abs(defaultOutput - reluOutput) < 1e-12);
  assert.notEqual(defaultOutput, sigmoidOutput);
});
