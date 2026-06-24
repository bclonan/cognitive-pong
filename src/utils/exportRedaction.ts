import { AgentConfig } from "../types";

export const REDACTED_EXPORT_VALUE = "[redacted]";

const SENSITIVE_EXPORT_KEYS = new Set([
  "apikey",
  "customapikey",
  "token",
  "accesstoken",
  "bearertoken",
  "refreshtoken",
  "idtoken",
  "authtoken",
  "hftoken",
  "openaitoken",
  "anthropickey",
  "geminikey",
  "authorization",
  "password",
  "secret",
  "clientsecret",
]);

const normalizeExportKey = (key: string) => key.replace(/[\s_-]/g, "").toLowerCase();

const isSensitiveExportKey = (key: string) => SENSITIVE_EXPORT_KEYS.has(normalizeExportKey(key));

export function redactExportSecrets<T>(value: T): T {
  const visit = (node: unknown, key?: string): unknown => {
    if (key && isSensitiveExportKey(key)) {
      return node === undefined || node === null || node === "" ? node : REDACTED_EXPORT_VALUE;
    }

    if (Array.isArray(node)) {
      return node.map((item) => visit(item));
    }

    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([entryKey, entryValue]) => [
          entryKey,
          visit(entryValue, entryKey),
        ]),
      );
    }

    return node;
  };

  return visit(value) as T;
}

export function redactAgentConfigForExport(agentConfig: AgentConfig): AgentConfig {
  return redactExportSecrets(agentConfig);
}
