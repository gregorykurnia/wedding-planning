import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Task 8.4, guide §8 "Contrast": the pairs listed at the foot of tokens.css are computed from the token
// values themselves, so a changed colour that drops a pair under its bar fails here.

const css = readFileSync("src/veil/styles/tokens.css", "utf8");

function token(name: string): [number, number, number] {
  if (name === "white") return [255, 255, 255];
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6}|rgba\\([^)]*\\))`));
  if (!m) throw new Error(`${name} isn't in tokens.css`);
  const v = m[1];
  if (v.startsWith("#")) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
  // A translucent surface sits on a white card.
  const [r, g, b, a] = v.slice(5, -1).split(",").map(Number);
  return [r, g, b].map((c) => Math.round(c * a + 255 * (1 - a))) as [number, number, number];
}

const light = (rgb: number[]) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg: string, bg: string) => {
  const [a, b] = [light(token(fg)), light(token(bg))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

// [text colour, background, the ratio tokens.css records, the bar it must clear]
const TEXT: [string, string, number, number][] = [
  ["--color-text", "white", 14.44, 4.5],
  ["--color-text", "--glow-blush", 12.15, 4.5],
  ["--color-text", "--glow-champagne", 12.1, 4.5],
  ["--color-text", "--surface-champagne-hover", 11.09, 4.5],
  ["--color-text", "--surface-petal", 13.56, 4.5],
  ["--color-text", "--surface-mist", 13.4, 4.5],
  ["white", "--color-text-strong-hover", 10.99, 4.5],
  ["--accent-toast-action", "--color-text", 10.45, 4.5],
  ["--color-text-muted", "white", 5.68, 4.5],
  ["--color-text-muted", "--surface-warm", 5.46, 4.5],
  ["--color-text-muted", "--surface-petal", 5.33, 4.5],
  ["--color-text-muted", "--surface-flag-calm", 4.98, 4.5],
  ["--color-text-muted", "--glow-blush", 4.78, 4.5],
  ["--color-text-muted", "--glow-champagne", 4.76, 4.5],
  ["--accent-attention-text", "white", 5.68, 4.5],
  ["--accent-attention-text", "--surface-warm", 5.46, 4.5],
  ["--accent-attention-text", "--accent-attention-wash", 4.85, 4.5],
  ["--accent-attention-text", "--glow-blush", 4.78, 4.5],
  ["--accent-settled-text", "white", 5.89, 4.5],
  ["--accent-settled-text", "--accent-settled-wash", 5.01, 4.5],
  ["--accent-gold-text", "white", 5.02, 4.5],
  ["--accent-gold-text", "--surface-warm", 4.83, 4.5],
  ["--accent-gold-text", "--surface-mist", 4.66, 4.5],
  ["--accent-gold-text-on-tint", "--surface-banner", 5.2, 4.5],
  ["--accent-gold-text-on-tint", "--glow-champagne", 4.97, 4.5],
  ["white", "--color-text-muted", 5.68, 4.5],
  // Large text only (the 44px overview names).
  ["--accent-gold-text", "--glow-blush", 4.23, 3],
];
const MARKS: [string, string, number, number][] = [
  ["--color-control-outline", "white", 3.34, 3],
  ["--accent-gold-text", "white", 5.02, 3],
];

describe("contrast pairs from tokens.css (guide §8)", () => {
  it.each(TEXT)("%s on %s is at least %s and clears %s:1", (fg, bg, recorded, bar) => {
    const got = ratio(fg, bg);
    expect(got).toBeGreaterThanOrEqual(bar);
    expect(got).toBeCloseTo(recorded, 1);
  });

  it.each(MARKS)("mark %s on %s clears 3:1", (fg, bg, recorded, bar) => {
    const got = ratio(fg, bg);
    expect(got).toBeGreaterThanOrEqual(bar);
    expect(got).toBeCloseTo(recorded, 1);
  });

  it("the surface-note pair that 'just passes' still passes", () => {
    expect(ratio("--accent-gold-text", "--surface-note")).toBeGreaterThanOrEqual(4.5);
  });
});
