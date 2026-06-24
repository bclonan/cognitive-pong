import type { ServerOptions } from "vite";

type EnvKey = "PORT" | "DISABLE_HMR" | "COGNITIVE_PONG_HMR_PORT" | "HMR_PORT";
type EnvLike = Partial<Record<EnvKey, string | undefined>>;
type HmrServerOptions = Pick<ServerOptions, "hmr" | "ws" | "watch">;

function parsePort(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function resolveDevServerPorts(env: EnvLike = process.env) {
  const port = parsePort(env.PORT, 3000);
  const disableHmr = isEnabled(env.DISABLE_HMR);
  const hmrPort = parsePort(env.COGNITIVE_PONG_HMR_PORT || env.HMR_PORT, port + 1000);

  return {
    port,
    disableHmr,
    hmrPort,
  };
}

export function resolveViteServerOptions(env: EnvLike = process.env): HmrServerOptions {
  const { disableHmr, hmrPort } = resolveDevServerPorts(env);

  return {
    hmr: disableHmr ? false : { port: hmrPort },
    ws: disableHmr ? false : undefined,
    watch: disableHmr ? null : {
      ignored: ["**/data/**", "**/outputs/**"],
    },
  };
}
