import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

test("Gemini SDK is optional provider infrastructure", () => {
  assert.equal(packageJson.dependencies?.["@google/genai"], undefined);
  assert.equal(typeof packageJson.optionalDependencies?.["@google/genai"], "string");
});

