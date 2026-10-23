// A text layer on its way to the device. The Lab draws the letters into a
// bitmap once (text.ts) and both exports carry that bitmap, so the device
// never needs the font. What was missing until 23 October 2026 was a check
// that the three renderers agree: the Lab preview, the JS the flattener
// writes, and the C++ header the To hardware window builds. The header half
// compiles the scaffold with the host's C++ compiler against the firmware's
// own math, colour, memory and param headers; only the panel, the encoders
// and Arduino.h are stood in for, and the stand-in canvas keeps the frame in
// logical coordinates, the ones the pattern writes. The compiler is the
// host's, not the S3's: the floats are the same 32 bits, but the Xtensa build
// may fuse a multiply and an add that x86 does in two steps.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createIdleInput, PatternRuntime } from "@/lib/pattern/harness";
import type { MatrixSize } from "@/lib/pattern/matrix";
import { LabEngine } from "./engine";
import { flattenLayers } from "./flatten";
import { assembleH, buildHExport } from "./hExport";
import { buildPixelPatternCode } from "./pixelToCode";
import { paintText } from "./text";
import {
  BLEND_MODES,
  DEFAULT_RAMP_STATE,
  TEXT_RAMP_STATE,
  createPixelLayer,
  createTextLayer,
  defaultTextSpec,
  type BlendMode,
  type CodeLayer,
  type Layer,
  type PixelLayer,
  type RampState,
  type TextLayer,
  type TextSpec,
} from "./types";

const FIRMWARE = path.resolve(__dirname, "../../../../firmware/patternflow");

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

// Edge coverage cycles through these, so both sides of each threshold turn
// up: 127 and 128 for sharp edges and pixel masks, 1 and 254 at the ends.
// -1 is a random one. Until the 127 and 128 were here, moving the header's
// mask threshold to 129 passed every case.
const EDGES = [127, 128, 1, 254, 64, 191, -1];

/**
 * Letters stood in for by blocks: glyph-sized boxes on one line, each with
 * holes and edges the font only partly covers. Soft coverage is what a real
 * font leaves on the edge of a stem.
 */
function glyphCoverage(frame: MatrixSize, next: () => number): Uint8ClampedArray {
  const { width, height } = frame;
  const coverage = new Uint8ClampedArray(width * height);
  const glyphW = Math.max(3, Math.floor(width / 10));
  const glyphH = Math.max(4, Math.floor(height / 3));
  const top = Math.floor(next() * (height - glyphH));
  let edges = 0;
  for (let left = Math.floor(next() * glyphW); left + glyphW <= width; left += glyphW + 1 + Math.floor(next() * 3)) {
    for (let y = top; y < top + glyphH; y++) {
      for (let x = left; x < left + glyphW; x++) {
        const edge = x === left || x === left + glyphW - 1 || y === top || y === top + glyphH - 1;
        const hole = !edge && (x - left) % 2 === 1 && (y - top) % 3 === 1;
        if (hole) continue;
        const value = EDGES[edges++ % EDGES.length];
        coverage[y * width + x] = !edge ? 255 : value < 0 ? Math.floor(next() * 256) : value;
      }
    }
  }
  return coverage;
}

function textLayer(
  id: string,
  frame: MatrixSize,
  next: () => number,
  spec: Partial<TextSpec>,
  common: Partial<Pick<TextLayer, "blend" | "opacity" | "role" | "maskInvert">> = {},
  ramp: RampState = TEXT_RAMP_STATE,
): TextLayer {
  const layer = createTextLayer(frame, id);
  const full = { ...defaultTextSpec(frame), ...spec };
  return {
    ...layer,
    ...common,
    id,
    name: id,
    spec: full,
    ramp,
    data: paintText(glyphCoverage(frame, next), full, ramp, frame.width, frame.height),
  };
}

/** Pixel art under the text: random colour, a third of it clear, some of it half there. */
function artLayer(id: string, frame: MatrixSize, next: () => number, common: Partial<PixelLayer> = {}): PixelLayer {
  const layer = createPixelLayer(frame, id);
  for (let i = 0; i < frame.width * frame.height; i++) {
    const roll = next();
    if (roll < 0.33) continue;
    layer.data.set(
      [Math.floor(next() * 256), Math.floor(next() * 256), Math.floor(next() * 256), roll < 0.5 ? Math.floor(next() * 256) : 255],
      i * 4,
    );
  }
  return { ...layer, ...common, id, name: id };
}

// One code layer with its C++ written out by hand, the way the To hardware
// window's paste box takes it, so the header has a real layer under a text
// mask and not only the black stub.
const STRIPES_JS = `export function draw(display) {
  for (let y = 0; y < display.height; y++)
    for (let x = 0; x < display.width; x++)
      display.setPixel(x, y, (x * 16) & 255, (y * 32) & 255, 128);
}`;
const STRIPES_CPP = (index: number) => `namespace L${index} {
  void setup() {}
  void update(float dt, const InputFrame& input) { (void)dt; (void)input; }
  void draw() {
    for (int y = 0; y < FRAME_H; y++)
      for (int x = 0; x < FRAME_W; x++)
        L${index}_setPixel(x, y, (x * 16) & 255, (y * 32) & 255, 128);
  }
}`;

function stripes(id: string): CodeLayer {
  return {
    id,
    type: "code",
    name: id,
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    code: STRIPES_JS,
    ramp: DEFAULT_RAMP_STATE,
    recolor: false,
    knobsAnnotationRaw: null,
    matrixAnnotationRaw: null,
  };
}

type Case = { name: string; frame: MatrixSize; layers: Layer[] };

function preview({ frame, layers }: Case): Uint8ClampedArray {
  return new LabEngine().render(
    { matrix: frame, layers, activeLayerId: layers[0].id, knobs: [0, 0, 0, 0], ranges: [[0, 1], [0, 1], [0, 1], [0, 1]] },
    1 / 60,
    0,
  ).data;
}

function exportedJs({ frame, layers }: Case): Uint8ClampedArray {
  const runtime = new PatternRuntime(frame.width, frame.height);
  expect(runtime.loadCode(flattenLayers(layers, frame)).error).toBeUndefined();
  expect(runtime.renderFrame(1 / 60, 0, createIdleInput([0, 0, 0, 0])).error).toBeUndefined();
  return runtime.data;
}

/** The first pixel that differs, as a sentence, or null. RGB only: the panel has no alpha. */
function firstDifference(a: Uint8ClampedArray, b: Uint8ClampedArray, width: number): string | null {
  for (let i = 0; i < a.length / 4; i++) {
    for (let c = 0; c < 3; c++) {
      if (a[i * 4 + c] !== b[i * 4 + c]) {
        return `(${i % width}, ${Math.floor(i / width)}): ${Array.from(a.subarray(i * 4, i * 4 + 3))} against ${Array.from(b.subarray(i * 4, i * 4 + 3))}`;
      }
    }
  }
  return null;
}

// Opacities whose fractions have an odd denominator (4/5, 3/5, 1/5). Every
// value the composite can reach then has an odd denominator too (255 is odd),
// so none is ever exactly half a step. The browser's doubles and the S3's
// floats could still part on a value within a float's error of a half; none
// of these stacks has one. HALVES below takes 50% and 25%.
const ODD_OPACITIES = [1, 0.8, 0.6, 0.2];
const HALF_OPACITIES = [0.5, 0.25];

/** Text and art in any order, blend and opacity, sharp or soft, solid or ramp. */
function randomStack(seed: number, opacities: number[]): Case {
  const frame = { width: 24, height: 12 };
  const next = random(seed);
  const layers: Layer[] = [];
  for (let k = 0; k < 4; k++) {
    const common = {
      blend: BLEND_MODES[Math.floor(next() * BLEND_MODES.length)] as BlendMode,
      opacity: opacities[Math.floor(next() * opacities.length)],
    };
    layers.push(
      k % 2 === 0
        ? textLayer(`Text${k}`, frame, next, {
            fill: (["solid", "rampX", "rampY"] as const)[Math.floor(next() * 3)],
            sharp: next() < 0.5,
            color: `#${Math.floor(next() * 0xffffff).toString(16).padStart(6, "0")}`,
          }, common)
        : artLayer(`Art${k}`, frame, next, common),
    );
  }
  return { name: `Random${seed}`, frame, layers };
}

const CASES: Case[] = [];
{
  const panel = { width: 128, height: 64 };
  CASES.push({ name: "Alone", frame: panel, layers: [textLayer("Hello", panel, random(1), {})] });
}
{
  const frame = { width: 64, height: 32 };
  const next = random(2);
  CASES.push({
    name: "SoftRampOverArt",
    frame,
    layers: [
      textLayer("Soft", frame, next, { fill: "rampX", sharp: false }, { blend: "screen", opacity: 0.8 }, {
        ...TEXT_RAMP_STATE,
        stops: TEXT_RAMP_STATE.stops.map((stop, i) => ({ ...stop, alpha: i === 1 ? 0.4 : 1 })),
      }),
      artLayer("Art", frame, next),
    ],
  });
}
{
  const frame = { width: 32, height: 16 };
  CASES.push({
    name: "MaskOverCode",
    frame,
    layers: [textLayer("Mask", frame, random(3), { fill: "rampY" }, { role: "mask" }), stripes("Stripes")],
  });
}
{
  const frame = { width: 32, height: 16 };
  const next = random(4);
  CASES.push({
    name: "InvertedMaskOverArt",
    frame,
    layers: [
      textLayer("Top", frame, next, { color: "#3fa7ff" }, { blend: "add", opacity: 0.6 }),
      textLayer("Mask", frame, next, { sharp: false }, { role: "mask", maskInvert: true }),
      artLayer("Art", frame, next),
    ],
  });
}
// Seeded, so a failure names the same pixels every run.
for (let seed = 11; seed <= 30; seed++) CASES.push(randomStack(seed, ODD_OPACITIES));

// At 50% and 25% too. A channel can then land on exactly half a step, and
// the header and the preview may round it apart (the header tests below).
const HALVES: Case[] = [];
for (let seed = 11; seed <= 60; seed++) {
  HALVES.push({ ...randomStack(seed, [...ODD_OPACITIES, ...HALF_OPACITIES]), name: `Halves${seed}` });
}

// The half step the seeds first found: an art pixel (131, 7, 75) at alpha
// 187, added at 50%. Its blue is 75 × 187/255 × 0.5 = 27.5.
const HALF_STEP: Case = (() => {
  const frame = { width: 1, height: 1 };
  const art = createPixelLayer(frame, "HalfStep");
  art.data.set([131, 7, 75, 187]);
  return { name: "HalfStep", frame, layers: [{ ...art, id: "HalfStep", blend: "add", opacity: 0.5 }] };
})();

describe("a text layer in the flattened JS", () => {
  it.each([...CASES, ...HALVES].map((entry) => [entry.name, entry] as const))("%s: same pixels as the preview", (_name, entry) => {
    expect(firstDifference(preview(entry), exportedJs(entry), entry.frame.width)).toBeNull();
  });
});

// ── the C++ header ──

const CXX = ["c++", "g++", "clang++"].find((compiler) => {
  try {
    execFileSync(compiler, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});

// GitHub's runners have g++. A desk without a compiler skips the header half;
// CI does not get to.
if (!CXX && process.env.CI) throw new Error("no C++ compiler on this runner, and the header test needs one");

const STUBS: Record<string, string> = {
  "Arduino.h": `#pragma once
#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307179586476925286766559
#define HALF_PI 1.5707963267948966192313216916398
`,
  "config.h": `#pragma once
#define PANEL_RES_W 128
#define PANEL_RES_H 64
`,
  "src/core_display.h": `#pragma once
`,
  // Field for field as firmware/patternflow/src/core_encoders.h has it.
  "src/core_encoders.h": `#pragma once
#include <Arduino.h>
struct InputFrame {
  long knobs[4];
  int knobDeltas[4];
  bool btnPressed[4];
  bool btnHeld[4];
  uint32_t now;
  bool knobAudioActive[4];
  float knobAudioValue[4];
  bool paramAbsoluteActive[4];
  uint16_t paramAbsolute[4];
};
`,
  "src/core_canvas.h": `#pragma once
#include <Arduino.h>
#include "config.h"
namespace PFCanvas {
inline uint8_t frame[PANEL_RES_W * PANEL_RES_H * 3];
inline int frameW = PANEL_RES_W, frameH = PANEL_RES_H;
inline int presents = 0;
inline void setFrame(int w, int h) { frameW = w; frameH = h; }
inline void setPixel(int x, int y, uint8_t r, uint8_t g, uint8_t b) {
  if ((unsigned)x >= (unsigned)frameW || (unsigned)y >= (unsigned)frameH) return;
  uint8_t* p = frame + ((size_t)y * frameW + x) * 3;
  p[0] = r; p[1] = g; p[2] = b;
}
inline void present() { presents++; }
}
`,
};

type HeaderCase = Case & { namespaceName: string };

/** Every case's header in one program: build once, print each frame as hex. */
function runHeaders(cases: Case[]): Map<string, Uint8ClampedArray> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pf-text-header-"));
  dirs.push(dir);
  for (const [file, text] of Object.entries(STUBS)) {
    fs.mkdirSync(path.dirname(path.join(dir, "stub", file)), { recursive: true });
    fs.writeFileSync(path.join(dir, "stub", file), text);
  }

  const headers: HeaderCase[] = cases.map((entry) => {
    const built = buildHExport({
      name: entry.name,
      matrix: entry.frame,
      layers: entry.layers,
      knobs: [0, 0, 0, 0],
      ranges: [[0, 1], [0, 1], [0, 1], [0, 1]],
      knobLabels: ["A", "B", "C", "D"],
    });
    const units: Record<number, string> = {};
    built.units.forEach((unit) => (units[unit.index] = STRIPES_CPP(unit.index)));
    fs.writeFileSync(path.join(dir, `${entry.name}.h`), assembleH(built.scaffold, units));
    return { ...entry, namespaceName: built.namespaceName };
  });

  const main = `#include <stdio.h>
${headers.map((entry) => `#include "${entry.name}.h"`).join("\n")}

static void dump(const char* name) {
  printf("%s ", name);
  for (int i = 0; i < PFCanvas::frameW * PFCanvas::frameH * 3; i++) printf("%02x", PFCanvas::frame[i]);
  printf(" %d\\n", PFCanvas::presents);
}

int main() {
  InputFrame input{};
${headers
  .map(
    (entry) => `  PFCanvas::setFrame(PANEL_RES_W, PANEL_RES_H);
  PFCanvas::presents = 0;
  memset(PFCanvas::frame, 0, sizeof PFCanvas::frame);
  ${entry.namespaceName}::setup();
  ${entry.namespaceName}::update(1.0f / 60.0f, input);
  ${entry.namespaceName}::draw();
  dump("${entry.name}");`,
  )
  .join("\n")}
  return 0;
}
`;
  fs.writeFileSync(path.join(dir, "main.cpp"), main);
  const binary = path.join(dir, "headers");
  execFileSync(CXX!, ["-std=c++17", "-O0", "-Wall", "-Werror", "-Wno-unused-function", "-Wno-unused-variable", "-I", path.join(dir, "stub"), "-I", FIRMWARE, "-I", dir, "main.cpp", "-o", binary], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const frames = new Map<string, Uint8ClampedArray>();
  for (const line of execFileSync(binary, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim().split("\n")) {
    const [name, hex, presents] = line.split(" ");
    expect(presents, `${name} presented once`).toBe("1");
    const entry = cases.find((candidate) => candidate.name === name)!;
    const rgba = new Uint8ClampedArray(entry.frame.width * entry.frame.height * 4);
    for (let i = 0; i < rgba.length / 4; i++) {
      for (let c = 0; c < 3; c++) rgba[i * 4 + c] = parseInt(hex.slice((i * 3 + c) * 2, (i * 3 + c) * 2 + 2), 16);
      rgba[i * 4 + 3] = 255;
    }
    frames.set(name, rgba);
  }
  return frames;
}

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ── exact fractions, for the half steps ──

type Fraction = [bigint, bigint];

// The site's TypeScript targets ES2017, so no 1n literals: BigInt(1).
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

function gcd(a: bigint, b: bigint): bigint {
  a = a < ZERO ? -a : a;
  while (b) [a, b] = [b, a % b];
  return a;
}
function fraction(n: bigint | number, d: bigint | number = 1): Fraction {
  const [bn, bd] = [BigInt(n), BigInt(d)];
  const g = gcd(bn, bd) || ONE;
  return [bn / g, bd / g];
}
const plus = (a: Fraction, b: Fraction) => fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const times = (a: Fraction, b: Fraction) => fraction(a[0] * b[0], a[1] * b[1]);
const minus = (a: Fraction, b: Fraction) => plus(a, [-b[0], b[1]]);

const OPACITY_FRACTIONS = new Map<number, Fraction>(
  ([[1, 1, 1], [0.8, 4, 5], [0.6, 3, 5], [0.2, 1, 5], [0.5, 1, 2], [0.25, 1, 4]] as const).map(
    ([opacity, n, d]) => [opacity, fraction(n, d)],
  ),
);

/**
 * One channel of the composite before it is rounded, worked in fractions:
 * compositor.ts's sums with nothing lost. For stacks of paint layers only,
 * which is what HALVES holds.
 */
function exactChannel(layers: Layer[], pixel: number, channel: number): Fraction {
  let value = fraction(0);
  const full = fraction(255);
  for (const layer of [...layers].reverse()) {
    const data = (layer as PixelLayer | TextLayer).data;
    const a = times(fraction(data[pixel * 4 + 3], 255), OPACITY_FRACTIONS.get(layer.opacity)!);
    if (a[0] === ZERO) continue;
    const s = fraction(data[pixel * 4 + channel]);
    const keep = times(value, minus(fraction(1), a));
    if (layer.blend === "add") value = plus(value, times(s, a));
    else if (layer.blend === "multiply") value = plus(keep, times(times(value, fraction(s[0], 255)), a));
    else if (layer.blend === "screen") {
      const screened = minus(full, times(times(minus(full, value), minus(full, s)), fraction(1, 255)));
      value = plus(keep, times(screened, a));
    } else value = plus(keep, times(s, a));
  }
  return value;
}

/** n + 1/2 for a whole n: a value two correct roundings may take either way. */
const isHalfStep = ([n, d]: Fraction) => d === TWO && n % TWO !== ZERO;

describe.skipIf(!CXX)("a text layer in the C++ header", () => {
  let frames: Map<string, Uint8ClampedArray> | null = null;
  const header = (name: string) => (frames ??= runHeaders([...CASES, ...HALVES, HALF_STEP])).get(name)!;

  it.each(CASES.map((entry) => [entry.name, entry] as const))("%s: same pixels as the preview", (name, entry) => {
    expect(firstDifference(preview(entry), header(name), entry.frame.width)).toBeNull();
  }, 60_000);

  // The browser works in doubles and the S3 in floats. Neither holds 187/255
  // exactly, so at 27.5 one lands a hair under and the other a hair over, and
  // the LED is one step brighter on the panel than in the Lab.
  it("an exact half step can round either way: one level, in the one channel", () => {
    const shown = preview(HALF_STEP);
    const panel = header(HALF_STEP.name);
    expect(exactChannel(HALF_STEP.layers, 0, 2)).toEqual(fraction(55, 2));
    expect([shown[2], panel[2]]).toEqual([27, 28]);
    expect(firstDifference(shown.slice(0, 2), panel.slice(0, 2), 1)).toBeNull();
  }, 60_000);

  it("at 50% and 25% the two part only on half steps, and by one", () => {
    const parted: string[] = [];
    for (const entry of HALVES) {
      const shown = preview(entry);
      const panel = header(entry.name);
      for (let i = 0; i < shown.length; i++) {
        if ((i & 3) === 3 || shown[i] === panel[i]) continue;
        const pixel = i >> 2;
        const exact = exactChannel(entry.layers, pixel, i & 3);
        expect(isHalfStep(exact), `${entry.name} (${pixel % entry.frame.width}, ${Math.floor(pixel / entry.frame.width)}) is ${exact[0]}/${exact[1]}`).toBe(true);
        expect(Math.abs(shown[i] - panel[i])).toBe(1);
        parted.push(entry.name);
      }
    }
    // Rare, and not none: the check above has something to look at.
    console.log("PARTED", parted.join(" "));
    expect(parted.length).toBeGreaterThan(0);
    expect(parted.length).toBeLessThan(20);
  }, 60_000);
});

// ── Copy as code ──

describe("a text layer copied as code", () => {
  const alone = (layer: TextLayer): Case => ({
    name: layer.name,
    frame: { width: layer.width, height: layer.height },
    layers: [{ ...layer, opacity: 1, blend: "normal", role: "paint" }],
  });

  function run(code: string, frame: MatrixSize, time = 0): Uint8ClampedArray {
    const runtime = new PatternRuntime(frame.width, frame.height);
    expect(runtime.loadCode(code).error).toBeUndefined();
    expect(runtime.renderFrame(1 / 60, time, createIdleInput([0, 0, 0, 0])).error).toBeUndefined();
    return runtime.data;
  }

  const sharp = CASES[0].layers[0] as TextLayer;
  const soft = CASES[1].layers[0] as TextLayer;

  it.each([["sharp, one colour", sharp], ["soft, a ramp with a see-through stop", soft]] as const)(
    "%s: draws the pixels the preview shows, with no font",
    (_name, layer) => {
      const code = buildPixelPatternCode(layer)!;
      expect(code).toContain(`// Text: "${layer.spec.text}"`);
      expect(firstDifference(preview(alone(layer)), run(code, alone(layer).frame), layer.width)).toBeNull();
    },
  );

  it("marks where a warp and a change of light go", () => {
    const code = buildPixelPatternCode(sharp)!;
    expect(code).toContain("// ── DISTORT HERE ──");
    expect(code).toContain("// ── LIGHT HERE ──");
  });

  // The header's examples are what a model copies first, so they have to work.
  it("its scroll example moves the letters left a pixel at a time and brings them back", () => {
    const layer = alone(sharp);
    const code = buildPixelPatternCode(sharp)!.replace(
      "// ── DISTORT HERE ──",
      `const span = display.width + SPRITE_W;
      sx = ((Math.round(sx + time * 20) % span) + span) % span;
      // ──`,
    );
    const still = run(buildPixelPatternCode(sharp)!, layer.frame);
    expect(firstDifference(run(code, layer.frame, 0), still, 128)).toBeNull();

    // One second is 20 pixels to the left.
    const moved = run(code, layer.frame, 1);
    const shifted = new Uint8ClampedArray(still.length);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128 - 20; x++) shifted.set(still.subarray((y * 128 + x + 20) * 4, (y * 128 + x + 21) * 4), (y * 128 + x) * 4);
    }
    const lit = (data: Uint8ClampedArray) => data.some((byte, i) => (i & 3) !== 3 && byte > 0);
    expect(lit(still)).toBe(true);
    // The columns the letters left, and nothing yet coming in on the right.
    expect(firstDifference(moved, shifted, 128)).toBeNull();
  });

  it("its twinkle example runs", () => {
    const code = buildPixelPatternCode(soft)!.replace(
      "// ── LIGHT HERE ──",
      `const tw = 0.6 + 0.4 * Math.sin(time * 6 + x * 1.7 + y * 2.3);
      r *= tw; g *= tw; b *= tw;
      a *= 0.5 + 0.5 * Math.sin(time * 2);
      // ──`,
    );
    run(code, alone(soft).frame, 0.3);
  });

  it("is null when no letter lands on the frame", () => {
    expect(buildPixelPatternCode({ ...sharp, data: new Uint8ClampedArray(sharp.data.length) })).toBeNull();
  });
});
