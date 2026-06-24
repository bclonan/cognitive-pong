import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAgentModelSelection,
  applyAgentProviderSelection,
  applyAgentTemplatePreservingRuntime,
  endpointPlaceholder,
  modelOptionsForProvider,
  providerNeedsEndpoint,
  resolveAgentModelSelection,
  resolvedEndpointLabel,
} from "../src/utils/providerControls";
import { Agent } from "../src/types";

test("agent templates preserve provider runtime selections", () => {
  const current: Agent = {
    name: "Current Agent",
    role: "Current role",
    color: "emerald",
    avatar: "A",
    provider: "ollama",
    endpointUrl: "http://localhost:11434",
    model: "llama3.1",
    customModel: "llama3.1:8b-instruct",
    customApiKey: "local-token",
    temperature: 0.4,
    maxTokens: 768,
  };
  const template: Agent = {
    name: "Template Agent",
    role: "Template role",
    color: "cyan",
    avatar: "T",
  };

  const merged = applyAgentTemplatePreservingRuntime(template, current);

  assert.equal(merged.name, "Template Agent");
  assert.equal(merged.role, "Template role");
  assert.equal(merged.provider, "ollama");
  assert.equal(merged.endpointUrl, "http://localhost:11434");
  assert.equal(merged.model, "llama3.1");
  assert.equal(merged.customModel, "llama3.1:8b-instruct");
  assert.equal(merged.customApiKey, "local-token");
  assert.equal(merged.temperature, 0.4);
  assert.equal(merged.maxTokens, 768);
});

test("provider helpers expose local and hosted endpoint controls", () => {
  assert.equal(providerNeedsEndpoint("ollama"), true);
  assert.equal(providerNeedsEndpoint("huggingface"), true);
  assert.equal(providerNeedsEndpoint("mock"), false);
  assert.equal(modelOptionsForProvider("huggingface").some((option) => option.value === "Qwen/Qwen2.5-7B-Instruct"), true);
  assert.equal(resolvedEndpointLabel("mock"), "Managed by provider");
  assert.equal(resolvedEndpointLabel("ollama"), "http://localhost:11434 (default)");
  assert.equal(
    endpointPlaceholder("huggingface", "Qwen/Qwen2.5-7B-Instruct"),
    "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct"
  );
  assert.equal(
    resolvedEndpointLabel("huggingface", undefined, "mistralai/Mistral-7B-Instruct-v0.3"),
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3 (default)"
  );
  assert.equal(resolvedEndpointLabel("huggingface", "https://hf.local/models/custom"), "https://hf.local/models/custom");
});

test("provider selection applies provider defaults and clears stale runtime overrides", () => {
  const current: Agent = {
    name: "Runtime Agent",
    role: "Test role",
    color: "cyan",
    avatar: "A",
    provider: "huggingface",
    endpointUrl: "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct",
    model: "Qwen/Qwen2.5-7B-Instruct",
    customModel: "Qwen/custom",
    customApiKey: "hf-secret",
  };

  const ollama = applyAgentProviderSelection(current, "ollama");
  const openAiCompatible = applyAgentProviderSelection(current, "openai-compatible");

  assert.equal(ollama.name, "Runtime Agent");
  assert.equal(ollama.provider, "ollama");
  assert.equal(ollama.model, "llama3");
  assert.equal(ollama.endpointUrl, "");
  assert.equal(ollama.customModel, "");
  assert.equal(ollama.customApiKey, "");

  assert.equal(openAiCompatible.provider, "openai-compatible");
  assert.equal(openAiCompatible.model, "gpt-4o-mini");
  assert.equal(openAiCompatible.endpointUrl, "");
  assert.equal(openAiCompatible.customApiKey, "");
});

test("model selection clears stale custom override so preset choices take effect", () => {
  const current: Agent = {
    name: "Runtime Agent",
    role: "Test role",
    color: "cyan",
    avatar: "A",
    provider: "openai-compatible",
    model: "gpt-4o-mini",
    customModel: "router/custom-gpt",
  };

  const next = applyAgentModelSelection(current, "gpt-4o");

  assert.equal(next.model, "gpt-4o");
  assert.equal(next.customModel, "");
});

test("agent model selection resolves provider defaults instead of leaking global mock model", () => {
  assert.equal(
    resolveAgentModelSelection({ provider: "ollama" }, "mock-local"),
    "llama3"
  );
  assert.equal(
    resolveAgentModelSelection({ provider: "huggingface" }, "mock-local"),
    "mistralai/Mistral-7B-Instruct-v0.3"
  );
  assert.equal(
    resolveAgentModelSelection({ provider: "openai-compatible", model: "gpt-4o" }, "mock-local"),
    "gpt-4o"
  );
  assert.equal(resolveAgentModelSelection({ provider: "mock" }, "mock-local"), "mock-local");
});
