import { describe, expect, it } from "vitest";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";
import { accentFor, accentLab, contrast, labToRgb, LED_ORANGE, readPanel, type Rgb } from "./panelTint";
import { COLS, countMatrix, ROWS } from "./Preloader";

// The page's accent follows the panel (ui/panelTint.ts). Whatever the panel
// shows, the accent has to stay something the page can be read in: it is the
// colour of small type on the room's dark, and the ground of a button whose
// label is dark ink.

const GROUND: Rgb = [10, 9, 8];
const CARD: Rgb = [20, 18, 16];
const INK_ON_LED: Rgb = [21, 10, 6];

function frameOf(paint: (x: number, y: number) => Rgb): Uint8ClampedArray {
  const f = new Uint8ClampedArray(PANEL_W * PANEL_H * 4);
  for (let y = 0; y < PANEL_H; y++) {
    for (let x = 0; x < PANEL_W; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * PANEL_W + x) * 4;
      f[i] = r;
      f[i + 1] = g;
      f[i + 2] = b;
      f[i + 3] = 255;
    }
  }
  return f;
}

/** Hue of an sRGB colour, degrees (HSV's: enough to say "it is a blue"). */
function hue([r, g, b]: Rgb) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const PATTERNS: Record<string, Uint8ClampedArray> = {
  dark: frameOf(() => [0, 0, 0]),
  "the reddest": frameOf(() => [255, 0, 0]),
  "the bluest": frameOf(() => [0, 0, 255]),
  "the greenest": frameOf(() => [0, 255, 0]),
  white: frameOf(() => [255, 255, 255]),
  "dim grey": frameOf(() => [40, 40, 40]),
  magenta: frameOf(() => [255, 0, 255]),
  cyan: frameOf(() => [0, 255, 255]),
  yellow: frameOf(() => [255, 255, 0]),
  // Origin, more or less: mostly black, white blocks, a red heart.
  "white with a red heart": frameOf((x, y) => (x > 50 && x < 70 && y > 22 && y < 42 ? [255, 30, 20] : (x >> 3) % 2 && (y >> 3) % 2 ? [255, 255, 255] : [0, 0, 0])),
  // Every hue at once: nothing to follow.
  rainbow: frameOf((x) => {
    const h = (x / PANEL_W) * 6;
    const f = h % 1;
    const s = Math.floor(h);
    const up = Math.round(f * 255);
    const down = 255 - up;
    return ([[255, up, 0], [down, 255, 0], [0, 255, up], [0, down, 255], [up, 0, 255], [255, 0, down]] as Rgb[])[s % 6];
  }),
};

describe("the page's accent, from the panel", () => {
  it("is the LED orange when the panel is dark", () => {
    expect(accentFor(PATTERNS.dark)).toEqual(LED_ORANGE);
  });

  it.each(Object.keys(PATTERNS))("reads on the dark, and under dark ink: %s", (name) => {
    const accent = accentFor(PATTERNS[name]);
    // Small type in the accent on the room's ground and on a card.
    expect(contrast(accent, GROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent, CARD)).toBeGreaterThanOrEqual(4.5);
    // A button's dark label on the accent.
    expect(contrast(INK_ON_LED, accent)).toBeGreaterThanOrEqual(4.5);
    // Never white-hot, never a neon: no channel pinned at both ends.
    const [r, g, b] = accent;
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(205);
  });

  it("takes the panel's hue", () => {
    const blue = hue(accentFor(PATTERNS["the bluest"]));
    expect(blue).toBeGreaterThan(200);
    expect(blue).toBeLessThan(270);
    const green = hue(accentFor(PATTERNS["the greenest"]));
    expect(green).toBeGreaterThan(90);
    expect(green).toBeLessThan(160);
    const red = hue(accentFor(PATTERNS["the reddest"]));
    expect(red < 25 || red > 340).toBe(true);
  });

  it("finds the colour in a pattern that is mostly white", () => {
    const light = readPanel(PATTERNS["white with a red heart"]);
    expect(light.rgb[0]).toBeGreaterThan(200);
    expect(light.rgb[1]).toBeLessThan(80);
    const accent = hue(accentFor(PATTERNS["white with a red heart"]));
    expect(accent < 30 || accent > 340).toBe(true);
  });

  it("pales toward the orange for a white panel, and keeps its warmth", () => {
    const white = accentFor(PATTERNS.white);
    const h = hue(white);
    expect(h).toBeGreaterThan(5);
    expect(h).toBeLessThan(45);
    // Paler than the orange itself.
    const spread = (c: Rgb) => Math.max(...c) - Math.min(...c);
    expect(spread(white)).toBeLessThan(spread(LED_ORANGE));
  });

  it("is in gamut whatever is asked of it", () => {
    for (const name of Object.keys(PATTERNS)) {
      const rgb = labToRgb(accentLab(readPanel(PATTERNS[name])));
      for (const c of rgb) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

// The preloader's counter (ui/Preloader.tsx): the firmware's 5×7 figures, on
// a matrix of LEDs.

function lit(grid: Float32Array) {
  let n = 0;
  for (const v of grid) if (v > 0) n++;
  return n;
}

describe("the preloader's counter", () => {
  const grid = new Float32Array(COLS * ROWS);

  it("draws 000 with its leading zeros faint", () => {
    countMatrix(0, grid);
    const levels = new Set(Array.from(grid).filter((v) => v > 0).map((v) => Number(v.toFixed(2))));
    expect(levels).toEqual(new Set([0.2, 1]));
    // The units' zero is full, the two in front are not.
    expect(grid.filter((v) => v === 1).length * 2).toBe(grid.filter((v) => v > 0 && v < 1).length);
  });

  it("draws 100 with nothing faint", () => {
    countMatrix(100, grid);
    expect(Array.from(grid).every((v) => v === 0 || v === 1)).toBe(true);
    expect(lit(grid)).toBeGreaterThan(100);
  });

  it("keeps every figure inside its window while it rolls", () => {
    let outside = 0;
    for (let v = 0; v <= 100; v += 0.37) {
      countMatrix(v, grid);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (grid[y * COLS + x] && (y < 3 || y >= ROWS - 3 || x < 3 || x >= COLS - 3)) outside++;
        }
      }
    }
    expect(outside).toBe(0);
  });

  it("does not roll when asked not to", () => {
    const a = new Float32Array(COLS * ROWS);
    const b = new Float32Array(COLS * ROWS);
    countMatrix(41.6, a, false);
    countMatrix(41, b, false);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
