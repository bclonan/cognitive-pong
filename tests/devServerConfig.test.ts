import assert from "node:assert/strict";
import test from "node:test";
import { resolveDevServerPorts, resolveViteServerOptions } from "../server/devServerConfig";

test("dev server defaults keep the app and HMR ports separated", () => {
  assert.deepEqual(resolveDevServerPorts({}), {
    port: 3000,
    disableHmr: false,
    hmrPort: 4000,
  });
  assert.deepEqual(resolveViteServerOptions({}), {
    hmr: { port: 4000 },
    ws: undefined,
    watch: {
      ignored: ["**/data/**", "**/outputs/**"],
    },
  });
});

test("COGNITIVE_PONG_HMR_PORT overrides the derived HMR websocket port", () => {
  assert.deepEqual(resolveDevServerPorts({
    PORT: "3043",
    COGNITIVE_PONG_HMR_PORT: "4444",
  }), {
    port: 3043,
    disableHmr: false,
    hmrPort: 4444,
  });
  assert.deepEqual(resolveViteServerOptions({
    PORT: "3043",
    COGNITIVE_PONG_HMR_PORT: "4444",
  }).hmr, { port: 4444 });
});

test("DISABLE_HMR turns off websocket and watch settings for scripted smokes", () => {
  assert.deepEqual(resolveViteServerOptions({
    PORT: "3042",
    DISABLE_HMR: "true",
  }), {
    hmr: false,
    ws: false,
    watch: null,
  });
});

test("invalid port values fall back to safe local defaults", () => {
  assert.deepEqual(resolveDevServerPorts({
    PORT: "not-a-port",
    COGNITIVE_PONG_HMR_PORT: "70000",
  }), {
    port: 3000,
    disableHmr: false,
    hmrPort: 4000,
  });
});
