import assert from "node:assert/strict";
import test from "node:test";
import { svgColorFromAgentColor } from "../src/utils/replayColors";

test("maps Tailwind-like replay color tokens to SVG-safe fills", () => {
  assert.equal(svgColorFromAgentColor("emerald", "#000000"), "#10B981");
  assert.equal(svgColorFromAgentColor("bg-amber-500", "#000000"), "#F59E0B");
  assert.equal(svgColorFromAgentColor("text-indigo-400", "#000000"), "#6366F1");
  assert.equal(svgColorFromAgentColor("border-teal-300", "#000000"), "#14B8A6");
});

test("preserves custom CSS color values and falls back for unknown tokens", () => {
  assert.equal(svgColorFromAgentColor("#123456", "#000000"), "#123456");
  assert.equal(svgColorFromAgentColor("rgb(1, 2, 3)", "#000000"), "rgb(1, 2, 3)");
  assert.equal(svgColorFromAgentColor("hsl(120, 50%, 50%)", "#000000"), "hsl(120, 50%, 50%)");
  assert.equal(svgColorFromAgentColor("unknown-brand-color", "#ABCDEF"), "#ABCDEF");
  assert.equal(svgColorFromAgentColor(undefined, "#FEDCBA"), "#FEDCBA");
});
