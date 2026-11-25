import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

function color(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`));
  assert.ok(match, `missing color token ${name}`);
  return match.slice(1).map(Number);
}

function luminance(rgb) {
  return rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

test("key text colors have sufficient contrast against their surfaces", () => {
  for (const [text, background] of [
    ["ink", "surface"], ["ink-soft", "surface"], ["ink", "paper"],
    ["ink-soft", "paper"], ["surface", "primary"], ["surface", "primary-dark"],
    ["warning", "warning-light"], ["danger", "danger-light"],
    ["income", "surface"], ["expense", "surface"],
  ]) {
    const values = [luminance(color(text)), luminance(color(background))].sort((a, b) => b - a);
    const ratio = (values[0] + 0.05) / (values[1] + 0.05);
    assert.ok(ratio >= 4.5, `${text} on ${background}: ${ratio.toFixed(2)}:1`);
  }
});
