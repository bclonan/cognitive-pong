import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const validTailwindShades = new Set(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]);
const shadeUtilityPattern =
  /\b(?:text|bg|border|from|to|via|ring|placeholder|accent|decoration|outline|divide|scrollbar-thumb|scrollbar-track)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d{2,4})\b/g;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [fullPath] : [];
  });
}

test("source Tailwind color utilities use valid shade steps", () => {
  const invalidUtilities: string[] = [];

  for (const file of sourceFiles(sourceRoot)) {
    const source = fs.readFileSync(file, "utf-8");
    for (const match of source.matchAll(shadeUtilityPattern)) {
      const shade = match[1];
      if (!validTailwindShades.has(shade)) {
        invalidUtilities.push(`${path.relative(sourceRoot, file)}:${match[0]}`);
      }
    }
  }

  assert.deepEqual(invalidUtilities, []);
});

test("source passes the strict unused-code audit", () => {
  const projectRoot = path.join(sourceRoot, "..");
  const tscCli = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(
    process.execPath,
    [tscCli, "--noEmit", "--noUnusedLocals", "--noUnusedParameters", "--pretty", "false"],
    {
      cwd: projectRoot,
      encoding: "utf-8",
      shell: false,
    },
  );

  assert.equal(result.status, 0, [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n"));
});
