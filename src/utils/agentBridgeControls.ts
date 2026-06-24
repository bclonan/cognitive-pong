import { AgentBridgeKind } from "../types";

export const BRIDGE_OPTIONS: Array<{ value: AgentBridgeKind; label: string }> = [
  { value: "none", label: "No external bridge" },
  { value: "http", label: "HTTP agent bridge" },
  { value: "websocket", label: "WebSocket agent bridge" },
  { value: "mcp", label: "MCP-style tools/call bridge" },
  { value: "cli", label: "Any local CLI bridge" },
  { value: "codex-cli", label: "Codex CLI bridge" },
];

export const bridgeEndpointPlaceholder = (kind?: AgentBridgeKind) => {
  switch (kind) {
    case "websocket":
      return "ws://localhost:8787/cognitive-pong";
    case "mcp":
      return "http://localhost:8787/mcp";
    case "http":
      return "http://localhost:8787/cognitive-pong/turn";
    default:
      return "";
  }
};

export const defaultBridgeProfileForKind = (kind?: AgentBridgeKind) => {
  if (kind === "codex-cli") return "codex";
  if (kind === "cli") return "default";
  return "";
};

export const defaultBridgeArgsForKind = (kind?: AgentBridgeKind) => {
  if (kind === "codex-cli") return ["exec", "{prompt}"];
  return [];
};

export const bridgeProfilePlaceholder = (kind?: AgentBridgeKind) => {
  if (kind === "codex-cli") return "codex";
  if (kind === "cli") return "default";
  return "";
};

export const bridgeUsesEndpoint = (kind?: AgentBridgeKind) => {
  return kind === "http" || kind === "websocket" || kind === "mcp";
};

export const bridgeUsesCommand = (kind?: AgentBridgeKind) => {
  return kind === "cli" || kind === "codex-cli";
};
