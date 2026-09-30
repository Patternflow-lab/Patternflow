import { describe, expect, it } from "vitest";
import { GLCD_FONT, glcdColumns } from "./glcdFont";
import {
  asciiFold,
  brightnessPercent,
  drawOverlay,
  drawText,
  FIRMWARE,
  measureText,
  PANEL_COLORS,
  PANEL_H,
  PANEL_W,
  stepBrightness,
  stepSelect,
  toPanelXY,
  wrapIndex,
  type PanelOverlay,
  type Rgb,
} from "./panelScreens";

const BYTES = PANEL_W * PANEL_H * 4;

function solid(r: number, g: number, b: number): Uint8ClampedArray {
  const f = new Uint8ClampedArray(BYTES);
  for (let i = 0; i < BYTES; i += 4) {
    f[i] = r;
    f[i + 1] = g;
    f[i + 2] = b;
    f[i + 3] = 255;
  }
  return f;
}

function px(f: Uint8ClampedArray, x: number, y: number): [number, number, number] {
  const i = (y * PANEL_W + x) * 4;
  return [f[i], f[i + 1], f[i + 2]];
}

/** The pixel at logical (x, y) of the portrait screen (rotation 1). */
function portraitPx(f: Uint8ClampedArray, x: number, y: number): [number, number, number] {
  const [panelX, panelY] = toPanelXY(1, x, y);
  return px(f, panelX, panelY);
}

const same = (a: readonly number[], b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

const OVERLAYS: PanelOverlay[] = [
  { kind: "brightness", percent: 80 },
  { kind: "brightness", percent: 100, portrait: true },
  { kind: "brightness", percent: 100, powerLimit: { allowedPercent: 60, estimateMa: 1800 } },
  { kind: "network", wifi: "CONNECTED", ip: "192.168.0.144" },
  { kind: "network", wifi: "CONNECTING", ip: "-", rows: [{ name: "OSC", on: true }, { name: "AUD", on: false }] },
  { kind: "network", wifi: "CONNECTING", ip: "-", hotspotName: "patternflow-a1b2" },
  { kind: "knobmap", activeKnob: null },
  { kind: "knobmap", activeKnob: 3, activeKnobs: [0] },
  { kind: "select", rank: 1, count: 1, name: "Origin" },
  { kind: "select", rank: 20, count: 34, name: "Two-stream phase-space vortices, very long indeed" },
  { kind: "update", ip: "10.0.0.5" },
  { kind: "update", phase: "flashing", percent: 42 },
  { kind: "update", phase: "done" },
];

describe("drawOverlay", () => {
  it("writes only whole in-bounds pixels for every screen", () => {
    for (const overlay of OVERLAYS) {
      const target = solid(1, 2, 3);
      const written = new Set<number>();
      const outOfRange: string[] = [];
      const spy = new Proxy(target, {
        set(t, key, value) {
          const i = Number(key);
          if (!(Number.isInteger(i) && i >= 0 && i < BYTES)) outOfRange.push(String(key));
          written.add(i);
          return Reflect.set(t, key, value);
        },
        get: (t, key) => Reflect.get(t, key),
      });
      drawOverlay(spy, overlay);
      expect(outOfRange).toEqual([]);
      expect(written.size).toBeGreaterThan(0);
      // Every touched pixel was written as a whole, opaque RGBA quad.
      let partial = 0;
      for (const i of written) {
        const base = i - (i % 4);
        if (!written.has(base) || !written.has(base + 1) || !written.has(base + 2) || !written.has(base + 3)) partial++;
        if (target[base + 3] !== 255) partial++;
      }
      expect(partial).toBe(0);
    }
  });

  it("clips off-panel drawing instead of wrapping it into the previous row", () => {
    // Portrait brightness: the scrim runs to logical y = 134 and the bar sits
    // at y = 131, past the 128-px edge. Unclipped, those would land at physical
    // x = -7..-1 and wrap to the right end (x >= 121) of the row above.
    const f = solid(1, 2, 3);
    drawOverlay(f, { kind: "brightness", percent: 100, portrait: true });
    let changed = 0;
    for (let y = 0; y < PANEL_H; y++) {
      for (let x = 100; x < PANEL_W; x++) if (!same(px(f, x, y), [1, 2, 3])) changed++;
    }
    expect(changed).toBe(0);
    // ...while the part that is on the panel did draw: the scrim at logical (0, 110).
    expect(portraitPx(f, 0, 110)).toEqual([0, 0, 0]);
  });

  it("draws text: every screen's labels are non-empty and in the firmware's colours", () => {
    const net = solid(0, 0, 0);
    drawOverlay(net, { kind: "network", wifi: "CONNECTED", ip: "192.168.0.144" });
    let green = 0;
    let gray = 0;
    let led = 0;
    for (let y = 0; y < PANEL_H; y++) {
      for (let x = 0; x < PANEL_W; x++) {
        const c = px(net, x, y);
        if (same(c, PANEL_COLORS.green)) green++;
        if (same(c, PANEL_COLORS.gray)) gray++;
        if (same(c, PANEL_COLORS.led)) led++;
      }
    }
    expect(green).toBeGreaterThan(20); // CONNECTED
    expect(gray).toBeGreaterThan(20); // the IP
    expect(led).toBeGreaterThan(20); // header dot + "K1 = SLEEP"
    // Header dot: fillRect(x, 7, 2, 2) with x = (64 - (42 + 6)) / 2 = 8 (patternflow.ino:651-652).
    expect(portraitPx(net, 8, 7)).toEqual([...PANEL_COLORS.led]);
    // Header rule: drawFastHLine(4, 15, 56) (patternflow.ino:656).
    expect(portraitPx(net, 4, 15)).toEqual([...PANEL_COLORS.rule]);
    expect(portraitPx(net, 59, 15)).toEqual([...PANEL_COLORS.rule]);
    expect(portraitPx(net, 60, 15)).toEqual([0, 0, 0]);
  });

  it("composes SELECT over the pattern, leaving most of it visible", () => {
    const f = solid(7, 77, 177);
    drawOverlay(f, { kind: "select", rank: 3, count: 12, name: "Origin" });
    let kept = 0;
    for (let i = 0; i < BYTES; i += 4) if (f[i] === 7 && f[i + 1] === 77 && f[i + 2] === 177) kept++;
    expect(kept / (PANEL_W * PANEL_H)).toBeGreaterThan(0.6);
    // Position track: tx = 12, marker at tx + 37 * (3 - 1) / 11 = 18 (integer), rows 22..24.
    expect(portraitPx(f, 18, 23)).toEqual([...PANEL_COLORS.led]);
    expect(portraitPx(f, 20, 23)).toEqual([...PANEL_COLORS.led]);
    expect(portraitPx(f, 21, 23)).toEqual([...PANEL_COLORS.dim]);
  });

  it("puts the SELECT marker at the ends of the track for the first and last pattern", () => {
    const first = solid(0, 0, 0);
    drawOverlay(first, { kind: "select", rank: 1, count: 34, name: "Origin" });
    expect(portraitPx(first, 12, 23)).toEqual([...PANEL_COLORS.led]);
    const last = solid(0, 0, 0);
    drawOverlay(last, { kind: "select", rank: 34, count: 34, name: "Origin" });
    expect(portraitPx(last, 49, 23)).toEqual([...PANEL_COLORS.led]);
    expect(portraitPx(last, 51, 23)).toEqual([...PANEL_COLORS.led]);
  });

  it("clears the panel for the screens the firmware draws on black", () => {
    for (const overlay of [
      { kind: "network", wifi: "CONNECTED", ip: "10.0.0.5" },
      { kind: "knobmap", activeKnob: null },
      { kind: "update" },
    ] as PanelOverlay[]) {
      const f = solid(200, 100, 50);
      drawOverlay(f, overlay);
      let leftover = 0;
      for (let i = 0; i < BYTES; i += 4) if (f[i] === 200 && f[i + 1] === 100 && f[i + 2] === 50) leftover++;
      expect(leftover).toBe(0);
    }
  });

  it("lights the turned knob with the LED-orange ring on the KNOB MAP", () => {
    const f = solid(0, 0, 0);
    drawOverlay(f, { kind: "knobmap", activeKnob: 0 });
    // K1 is top-right in portrait: centre (51, 14), r = 10 -> topmost ring pixel (51, 4).
    expect(portraitPx(f, 51, 4)).toEqual([...PANEL_COLORS.led]);
    expect(portraitPx(f, 51, 8)).toEqual([...PANEL_COLORS.knobActiveFill]);
    expect(portraitPx(f, 13, 4)).toEqual([...PANEL_COLORS.white]); // K2 idle
  });

  it("throws on a frame that is not 128x64 RGBA", () => {
    expect(() => drawOverlay(new Uint8ClampedArray(10), { kind: "knobmap", activeKnob: null })).toThrow(RangeError);
  });
});

describe("classic font", () => {
  it("holds Adafruit's glyph bytes, 'A' included", () => {
    expect(GLCD_FONT.length).toBe(256 * 5);
    expect(glcdColumns(0x41)).toEqual([0x7c, 0x12, 0x11, 0x12, 0x7c]);
    expect(glcdColumns(0x20)).toEqual([0, 0, 0, 0, 0]);
  });

  it("draws 'A' column by column, LSB at the top", () => {
    const f = solid(0, 0, 0);
    const end = drawText(f, 10, 20, "A", [255, 255, 255]);
    expect(end).toEqual({ x: 16, y: 20 });
    const cols = glcdColumns(0x41);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 8; j++) {
        const on = i < 5 && ((cols[i] >> j) & 1) === 1;
        expect(px(f, 10 + i, 20 + j)).toEqual(on ? [255, 255, 255] : [0, 0, 0]);
      }
    }
  });

  it("maps rotation 1 the way setRotation(1) does: logical (x, y) -> panel (127 - y, x)", () => {
    const f = solid(0, 0, 0);
    drawText(f, 0, 0, "A", [255, 255, 255], 1, 1);
    // Column 0 of 'A' is 0x7c: logical (0, 2..6) -> physical (125..121, 0).
    for (let j = 0; j < 8; j++) {
      const on = ((0x7c >> j) & 1) === 1;
      expect(px(f, 127 - j, 0)).toEqual(on ? [255, 255, 255] : [0, 0, 0]);
    }
  });

  it("doubles every pixel at size 2", () => {
    const f = solid(0, 0, 0);
    drawText(f, 0, 0, "A", [255, 255, 255], 2);
    // 'A' column 0 bit 2 -> a 2x2 block at (0..1, 4..5).
    for (const [x, y] of [[0, 4], [1, 4], [0, 5], [1, 5]]) expect(px(f, x, y)).toEqual([255, 255, 255]);
    expect(px(f, 0, 3)).toEqual([0, 0, 0]);
  });

  it("wraps an 11th character on the 64 px portrait line, as GFX does on the panel", () => {
    // "TURN = SHOW" (KNOB MAP, patternflow.ino:995) measures as two lines...
    expect(measureText("TURN = SHOW", 1, 1)).toEqual({ x1: 0, y1: 0, w: 60, h: 16 });
    // ...and prints its 'W' at x = 0 on the next line, y = 66 + 8.
    const f = solid(0, 0, 0);
    drawOverlay(f, { kind: "knobmap", activeKnob: null });
    let lit = 0;
    for (let x = 0; x < 5; x++) for (let y = 74; y < 81; y++) if (portraitPx(f, x, y)[0] > 0) lit++;
    expect(lit).toBeGreaterThan(5);
  });
});

describe("firmware behaviour helpers", () => {
  it("maps brightness bytes to the percentage the panel prints", () => {
    expect(brightnessPercent(FIRMWARE.defaultBrightness)).toBe(80);
    expect(FIRMWARE.defaultBrightnessPercent).toBe(80);
    expect(brightnessPercent(5)).toBe(2);
    expect(brightnessPercent(255)).toBe(100);
    expect(stepBrightness(250, 3)).toBe(255);
    expect(stepBrightness(10, -4)).toBe(5);
    expect(stepBrightness(204, -1)).toBe(199);
  });

  it("steps SELECT every third detent and keeps the signed remainder", () => {
    expect(stepSelect(0, 2)).toEqual({ steps: 0, accum: 2 });
    expect(stepSelect(2, 1)).toEqual({ steps: 1, accum: 0 });
    expect(stepSelect(2, -1)).toEqual({ steps: 0, accum: 1 });
    expect(stepSelect(0, -7)).toEqual({ steps: -2, accum: -1 });
    expect(wrapIndex(-1, 34)).toBe(33);
    expect(wrapIndex(34, 34)).toBe(0);
  });

  it("folds names to the panel's ASCII", () => {
    expect(asciiFold("Poincaré Sphere")).toBe("Poincare Sphere");
    expect(asciiFold("달빛 wave")).toBe("?? wave");
    expect(asciiFold("x".repeat(60)).length).toBe(39);
  });
});
