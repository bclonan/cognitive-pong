import assert from "node:assert/strict";
import test from "node:test";
import {
  REDACTED_EXPORT_VALUE,
  redactAgentConfigForExport,
  redactExportSecrets,
} from "../src/utils/exportRedaction";
import { AgentConfig } from "../src/types";

test("redacts provider and bridge secrets without mutating agent config", () => {
  const source: AgentConfig = {
    agentA: {
      name: "Agent A",
      role: "Advocate",
      color: "#00FF41",
      avatar: "A",
      provider: "openai-compatible",
      model: "gpt-4o-mini",
      endpointUrl: "http://localhost:4000/v1",
      customApiKey: "sk-agent-a-secret",
      maxTokens: 768,
    },
    agentB: {
      name: "Agent B",
      role: "Critic",
      color: "#FF4100",
      avatar: "B",
      provider: "huggingface",
      model: "Qwen/Qwen2.5-7B-Instruct",
      endpointUrl: "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct",
      customApiKey: "hf-agent-b-secret",
      bridge: {
        kind: "websocket",
        endpointUrl: "ws://localhost:8787/agent",
        apiKey: "agent-b-bridge-secret",
      },
    },
    bridge: {
      kind: "http",
      endpointUrl: "http://localhost:8787/turn",
      apiKey: "global-bridge-secret",
      timeoutMs: 15000,
    },
    useGrounding: true,
    baseSpeed: 1,
    model: "mock-local",
    defaultComplexity: "auto",
  };

  const redacted = redactAgentConfigForExport(source);

  assert.equal(redacted.agentA.customApiKey, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.agentB.customApiKey, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.agentB.bridge?.apiKey, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.bridge?.apiKey, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.agentA.maxTokens, 768);
  assert.equal(redacted.agentA.endpointUrl, "http://localhost:4000/v1");
  assert.equal(redacted.agentB.model, "Qwen/Qwen2.5-7B-Instruct");
  assert.equal(source.agentA.customApiKey, "sk-agent-a-secret");

  const exportedJson = JSON.stringify(redacted);
  assert.doesNotMatch(exportedJson, /sk-agent-a-secret|hf-agent-b-secret|agent-b-bridge-secret|global-bridge-secret/);
});

test("redacts common token aliases while preserving non-secret numeric token limits", () => {
  const redacted = redactExportSecrets({
    token: "raw-token",
    access_token: "access-token",
    Authorization: "Bearer auth-token",
    nested: {
      clientSecret: "client-secret",
      maxTokens: 2048,
      endpointUrl: "http://localhost:11434",
    },
  });

  assert.equal(redacted.token, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.access_token, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.Authorization, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.nested.clientSecret, REDACTED_EXPORT_VALUE);
  assert.equal(redacted.nested.maxTokens, 2048);
  assert.equal(redacted.nested.endpointUrl, "http://localhost:11434");
});
