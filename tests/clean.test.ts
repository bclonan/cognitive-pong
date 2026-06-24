import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cleanWorkspace } from "../scripts/clean.mjs";

test("cleanWorkspace removes build outputs inside the workspace", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cognitive-pong-clean-"));
  const distFile = path.join(workspace, "dist", "asset.txt");
  const serverFile = path.join(workspace, "server.js");
  const sourceFile = path.join(workspace, "src", "keep.ts");

  fs.mkdirSync(path.dirname(distFile), { recursive: true });
  fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
  fs.writeFileSync(distFile, "generated");
  fs.writeFileSync(serverFile, "generated");
  fs.writeFileSync(sourceFile, "source");

  cleanWorkspace(workspace);

  assert.equal(fs.existsSync(path.join(workspace, "dist")), false);
  assert.equal(fs.existsSync(serverFile), false);
  assert.equal(fs.readFileSync(sourceFile, "utf-8"), "source");
});

test("cleanWorkspace rejects targets outside the workspace", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cognitive-pong-clean-"));
  assert.throws(() => cleanWorkspace(workspace, ["../outside"]), /outside workspace/);
});
