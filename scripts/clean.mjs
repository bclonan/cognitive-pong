import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_CLEAN_TARGETS = ["dist", "server.js"];

function assertInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside workspace: ${candidate}`);
  }
}

export function cleanWorkspace(root = process.cwd(), targets = DEFAULT_CLEAN_TARGETS) {
  const workspaceRoot = path.resolve(root);

  for (const target of targets) {
    const resolved = path.resolve(workspaceRoot, target);
    assertInsideRoot(workspaceRoot, resolved);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cleanWorkspace();
}
