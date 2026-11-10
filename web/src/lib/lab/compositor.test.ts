// The Lab preview against the flattened export. Until 18 October 2026 the
// preview wrote each layer's result into the byte buffer before blending the
// next one, so anything an add layer pushed past 255 was cut off there. The
// export and the C++ header add up in floats to the top layer and clamp once,
// so two (200, 0, 0) add layers under a (128, 128, 128) multiply showed R 128
// in the Lab and 201 on the device.

import { describe, expect, it } from "vitest";
import { createIdleInput, PatternRuntime } from "@/lib/pattern/harness";
import { compositeLayers, type CompositeEntry } from "./compositor";
import { LabEngine, type EngineProject } from "./engine";
import { flattenLayers, loneCodeLayer } from "./flatten";
import { buildHExport } from "./hExport";
import {
  BLEND_MODES,
  DEFAULT_RAMP_STATE,
  type BlendMode,
  type CodeLayer,
  type Layer,
  type PixelLayer,
} from "./types";

type RGBA = [number, number, number, number];

function solid(pixelCount: number, color: RGBA): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) data.set(color, i * 4);
  return data;
}

function onePixel(entries: CompositeEntry[]): number[] {
  const out = new Uint8ClampedArray(4);
  compositeLayers(out, entries, 1);
  return Array.from(out);
}

const RED_200: RGBA = [200, 0, 0, 255];
const GREY_128: RGBA = [128, 128, 128, 255];

describe("compositeLayers", () => {
  it("carries an add layer's overflow into a multiply above it", () => {
    const add = { data: solid(1, RED_200), opacity: 1, blend: "add" as const };
    const multiply = { data: solid(1, GREY_128), opacity: 1, blend: "multiply" as const };
    expect(onePixel([add, add, multiply])).toEqual([201, 0, 0, 255]);
  });

  it("carries it under a half-opacity normal layer too", () => {
    const add = { data: solid(1, RED_200), opacity: 1, blend: "add" as const };
    const half = { data: solid(1, GREY_128), opacity: 0.5, blend: "normal" as const };
    expect(onePixel([add, add, half])).toEqual([255, 64, 64, 255]);
  });

  it("clamps the finished pixel to 255", () => {
    const add = { data: solid(1, RED_200), opacity: 1, blend: "add" as const };
    expect(onePixel([add, add])).toEqual([255, 0, 0, 255]);
  });

  it("rounds half up once, as the export's setPixel does", () => {
    // 1 × 0.5 = 0.5 → 1. A Uint8ClampedArray store rounds half to even (0).
    const add = { data: solid(1, [1, 3, 5, 255]), opacity: 0.5, blend: "add" as const };
    expect(onePixel([add])).toEqual([1, 2, 3, 255]);
  });

  it("skips a pixel its mask switches off", () => {
    const add = { data: solid(2, RED_200), opacity: 1, blend: "add" as const };
    const masked = { ...add, mask: new Uint8Array([1, 0]) };
    const out = new Uint8ClampedArray(8);
    compositeLayers(out, [add, masked], 2);
    expect(Array.from(out)).toEqual([255, 0, 0, 255, 200, 0, 0, 255]);
  });
});

// The same stack through both paths: the engine the preview draws with, and
// the pattern flattenLayers writes, run by the runtime that plays exported
// patterns. Seeded, so a failure names the same pixels every run.
describe("preview matches the flattened export", () => {
  const W = 16;
  const H = 8;
  const N = W * H;

  function random(seed: number) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  }

  function pixelLayer(
    id: string,
    next: () => number,
    blend: BlendMode,
    opacity: number,
    role: PixelLayer["role"] = "paint",
  ): PixelLayer {
    const data = new Uint8ClampedArray(N * 4);
    for (let i = 0; i < data.length; i++) {
      const roll = next();
      if ((i & 3) !== 3) data[i] = Math.floor(roll * 256);
      // Plenty of fully opaque and fully clear pixels, the rest in between.
      else data[i] = roll < 0.3 ? 255 : roll < 0.5 ? 0 : Math.floor(next() * 256);
    }
    return {
      id,
      type: "pixel",
      name: id,
      visible: true,
      opacity,
      blend,
      role,
      maskInvert: false,
      width: W,
      height: H,
      data,
      rev: 0,
    };
  }

  // layers[0] is the top of the stack, as in the Layers panel.
  function stack(seed: number): PixelLayer[] {
    const next = random(seed);
    const layers: PixelLayer[] = [];
    for (let k = 0; k < 6; k++) {
      const blend = BLEND_MODES[Math.floor(next() * BLEND_MODES.length)];
      // 0 too: seeds 9 and 11 put the mask on a 0% layer.
      const opacity = [1, 0.5, 0.25, 0.8, 0][Math.floor(next() * 5)];
      layers.unshift(pixelLayer(`paint-${k}`, next, blend, opacity));
    }
    // A mask over the third paint layer from the top.
    layers.splice(2, 0, pixelLayer("mask", next, "normal", 1, "mask"));
    return layers;
  }

  function project(layers: Layer[]): EngineProject {
    return {
      matrix: { width: W, height: H },
      layers,
      activeLayerId: layers[0].id,
      knobs: [0, 0, 0, 0],
      ranges: [[0, 1], [0, 1], [0, 1], [0, 1]],
    };
  }

  function exported(layers: Layer[]): Uint8ClampedArray {
    const runtime = new PatternRuntime(W, H);
    const loaded = runtime.loadCode(flattenLayers(layers, { width: W, height: H }));
    expect(loaded.error).toBeUndefined();
    const result = runtime.renderFrame(1 / 60, 0, createIdleInput([0, 0, 0, 0]));
    expect(result.error).toBeUndefined();
    return runtime.data;
  }

  function differences(a: Uint8ClampedArray, b: Uint8ClampedArray): string[] {
    const found: string[] = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) found.push(`byte ${i}: preview ${a[i]}, export ${b[i]}`);
    }
    return found;
  }

  it("the add, add, multiply stack from the bug", () => {
    const add = (id: string): PixelLayer => ({ ...pixelLayer(id, () => 0, "add", 1), data: solid(N, RED_200) });
    const layers: PixelLayer[] = [
      { ...pixelLayer("multiply", () => 0, "multiply", 1), data: solid(N, GREY_128) },
      add("add-2"),
      add("add-1"),
    ];
    const preview = new LabEngine().render(project(layers), 1 / 60, 0).data;
    expect(Array.from(preview.subarray(0, 4))).toEqual([201, 0, 0, 255]);
    expect(differences(preview, exported(layers))).toEqual([]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])("random stack %i", (seed) => {
    const layers = stack(seed);
    const preview = new LabEngine().render(project(layers), 1 / 60, 0).data;
    expect(differences(preview, exported(layers))).toEqual([]);
  });

  it.each([1, 2, 3])("the Pixel panel backdrop, random stack %i", (seed) => {
    const layers = stack(seed);
    const hidden = layers[0].id;
    const backdrop = new LabEngine().compositeBackdrop({ width: W, height: H }, layers, hidden).data;
    const rest = layers.filter((layer) => layer.id !== hidden);
    expect(differences(backdrop, exported(rest))).toEqual([]);
  });

  // A mask over a 0% layer gates nothing. Until 22 October 2026 the export
  // and the header dropped the 0% layer first and handed its mask to the
  // layer below, and the preview did the same for a code layer that had sat
  // at 0% since it was added: it had never run, so it had no buffer to anchor.
  describe("a mask over a 0% layer", () => {
    const RED: RGBA = [255, 0, 0, 255];
    const red = (): PixelLayer => ({ ...pixelLayer("red", () => 0, "normal", 1), data: solid(N, RED) });
    // On over the left half of the frame only.
    const leftHalf = (): PixelLayer => {
      const layer = pixelLayer("mask", () => 0, "normal", 1, "mask");
      for (let i = 0; i < N; i++) layer.data.set(i % W < W / 2 ? [255, 255, 255, 255] : [0, 0, 0, 0], i * 4);
      return layer;
    };
    const blue = (opacity: number): CodeLayer => ({
      id: "blue",
      type: "code",
      name: "blue",
      visible: true,
      opacity,
      blend: "normal",
      role: "paint",
      maskInvert: false,
      code: `export function draw(display) {
  for (let y = 0; y < display.height; y++)
    for (let x = 0; x < display.width; x++) display.setPixel(x, y, 0, 0, 255);
}`,
      ramp: DEFAULT_RAMP_STATE,
      recolor: false,
      knobsAnnotationRaw: null,
      matrixAnnotationRaw: null,
    });

    // The header's composite plan: each paint group and the masks gating it.
    function headerPlan(layers: Layer[]) {
      const { scaffold } = buildHExport({
        name: "Plan",
        matrix: { width: W, height: H },
        layers,
        knobs: [0, 0, 0, 0],
        ranges: [[0, 1], [0, 1], [0, 1], [0, 1]],
        knobLabels: ["A", "B", "C", "D"],
      });
      const names = [...scaffold.matchAll(/^\/\/ {3}L\d+\. (\S+) /gm)].map((match) => match[1]);
      const table = (name: string) =>
        scaffold.match(new RegExp(`${name}\\[\\d+\\]\\s*=\\s*\\{([^}]*)\\}`))![1].split(",").map(Number);
      const at = table("G_MASK_AT");
      const count = table("G_MASK_N");
      const masks = table("MASK_LAYER");
      return table("G_LAYER")
        .slice(0, Number(scaffold.match(/GROUP_N = (\d+)/)![1]))
        .map((layer, group) => ({
          layer: names[layer],
          masks: masks.slice(at[group], at[group] + count[group]).map((mask) => names[mask]),
        }));
    }

    it("a pixel layer: the red under it shows whole, in the preview, the export and the header", () => {
      const layers: Layer[] = [leftHalf(), pixelLayer("zero", () => 0.5, "normal", 0), red()];
      const preview = new LabEngine().render(project(layers), 1 / 60, 0).data;
      expect(differences(preview, solid(N, RED))).toEqual([]);
      expect(differences(preview, exported(layers))).toEqual([]);
      expect(headerPlan(layers)).toEqual([{ layer: "red", masks: [] }]);
    });

    it("the header still hands a mask over a 50% layer to that layer", () => {
      const layers: Layer[] = [leftHalf(), pixelLayer("half", () => 0.5, "normal", 0.5), red()];
      expect(headerPlan(layers)).toEqual([
        { layer: "red", masks: [] },
        { layer: "half", masks: ["mask"] },
      ]);
    });

    it("a code layer at 0% since it was added, as one turned down from 100%", () => {
      const layers: Layer[] = [leftHalf(), blue(0), red()];
      const fresh = new LabEngine().render(project(layers), 1 / 60, 0).data;
      expect(differences(fresh, solid(N, RED))).toEqual([]);
      expect(differences(fresh, exported(layers))).toEqual([]);

      const turnedDown = new LabEngine();
      turnedDown.render(project([leftHalf(), blue(1), red()]), 1 / 60, 0);
      expect(differences(turnedDown.render(project(layers), 1 / 60, 1 / 60).data, fresh)).toEqual([]);
      expect(headerPlan(layers)).toEqual([{ layer: "red", masks: [] }]);
    });
  });

  // The preview runs a code layer written with const, let or class as it
  // runs a function declaration. Until 24 October 2026 the flattened export
  // pasted each layer's code under its own `var setup, update, draw;`, so
  // `const draw = …` failed to load with "Identifier 'draw' has already been
  // declared" and the whole stack went out dead.
  describe("a code layer written with const, let or class", () => {
    const codeLayer = (code: string): CodeLayer => ({
      id: "code",
      type: "code",
      name: "code",
      visible: true,
      opacity: 1,
      blend: "normal",
      role: "paint",
      maskInvert: false,
      code,
      ramp: DEFAULT_RAMP_STATE,
      recolor: false,
      knobsAnnotationRaw: null,
      matrixAnnotationRaw: null,
    });

    const constDraw = `const draw = (display) => {
  for (let y = 0; y < display.height; y++)
    for (let x = 0; x < display.width; x++) display.setPixel(x, y, x * 16, y * 32, 128);
};`;

    it.each([
      ["const draw", constDraw],
      [
        "const setup, let update and const draw",
        `let frames = 0;
let shade = 0;
const setup = () => { shade = 200; };
let update = (dt) => { frames += 1; };
const draw = (display) => {
  for (let y = 0; y < display.height; y++)
    for (let x = 0; x < display.width; x++) display.setPixel(x, y, shade, frames * 40, x * 16);
};`,
      ],
      [
        "a class and let draw",
        `class Bars {
  paint(display) {
    for (let y = 0; y < display.height; y++)
      for (let x = 0; x < display.width; x++) display.setPixel(x, y, x % 2 ? 255 : 0, y * 32, 64);
  }
}
const bars = new Bars();
let draw = function (display) { bars.paint(display); };`,
      ],
    ])("%s, under a pixel layer: it loads, and its pixels match the preview", (_, code) => {
      const layers: Layer[] = [pixelLayer("over", random(7), "normal", 0.5), codeLayer(code)];
      const preview = new LabEngine().render(project(layers), 1 / 60, 0).data;
      // The layer drew: something under the half-opacity pixels is lit.
      expect(Array.from(preview).some((value, i) => i % 4 !== 3 && value > 0)).toBe(true);
      expect(differences(preview, exported(layers))).toEqual([]);
    });

    // Since 24 October 2026 a lone code layer under 100% goes out flattened
    // too (the "one code layer" tests below), so this reached a single layer.
    it("const draw alone at 50%, where it goes out as a stack of one", () => {
      const layers: Layer[] = [{ ...codeLayer(constDraw), opacity: 0.5 }];
      expect(loneCodeLayer(layers)).toBeNull();
      const preview = new LabEngine().render(project(layers), 1 / 60, 0).data;
      expect(differences(preview, exported(layers))).toEqual([]);
    });
  });

  // A code layer under another layer goes out on the export's own display.
  // Until 24 October 2026 that display cut coordinates with `| 0` and left
  // colours to Uint8ClampedArray, where the preview floors and rounds half
  // up. A point at y −0.5 landed on row 0 in the export only, and a red of
  // 0.5 showed 1 in the preview and 0 in the export.
  describe("a code layer drawing between pixels", () => {
    const codeLayer = (code: string): CodeLayer => ({
      id: "code",
      type: "code",
      name: "code",
      visible: true,
      opacity: 1,
      blend: "normal",
      role: "paint",
      maskInvert: false,
      code,
      ramp: DEFAULT_RAMP_STATE,
      recolor: false,
      knobsAnnotationRaw: null,
      matrixAnnotationRaw: null,
    });
    // Clear pixels on top: the stack is flattened, and the code shows as drawn.
    const clear = (): PixelLayer => ({ ...pixelLayer("clear", () => 0, "normal", 1), data: new Uint8ClampedArray(N * 4) });

    function both(code: string) {
      const layers: Layer[] = [clear(), codeLayer(code)];
      expect(loneCodeLayer(layers)).toBeNull();
      return { preview: new LabEngine().render(project(layers), 1 / 60, 0).data, exported: exported(layers) };
    }

    it.each([
      ["setPixel", "display.setPixel(x, y, 255, 255, 255)"],
      ["setValue", "display.setValue(x, y, 1)"],
    ])("a ring that crosses the edge with %s lights the same pixels", (_, call) => {
      const { preview, exported: out } = both(`export function draw(display) {
  for (let a = 0; a < 360; a++) {
    const t = (a * Math.PI) / 180, x = 6 + 9 * Math.cos(t), y = 4 + 5 * Math.sin(t);
    ${call};
  }
}`);
      // The ring drew.
      expect(Array.from(preview).some((value, i) => i % 4 !== 3 && value > 0)).toBe(true);
      expect(differences(preview, out)).toEqual([]);
    });

    it("half values round up", () => {
      const { preview, exported: out } = both(`export function draw(display) {
  for (let y = 0; y < display.height; y++)
    for (let x = 0; x < display.width; x++) display.setPixel(x, y, x * 2 + 0.5, y * 32 + 0.5, 128.5);
}`);
      expect(Array.from(preview.subarray(0, 4))).toEqual([1, 1, 129, 255]);
      expect(differences(preview, out)).toEqual([]);
    });

    it("a colour that is not a finite number is 0, in either form of setPixel", () => {
      const { preview, exported: out } = both(`export function draw(display) {
  for (let x = 0; x < display.width; x++) {
    display.setPixel(x, 0, 1 / 0, -1 / 0, 0 / 0);
    display.setPixel(x, 1, [1 / 0, 200, "200"]);
  }
}`);
      expect(Array.from(preview.subarray(0, 4))).toEqual([0, 0, 0, 255]);
      expect(Array.from(preview.subarray(W * 4, W * 4 + 4))).toEqual([0, 200, 0, 255]);
      expect(differences(preview, out)).toEqual([]);
    });
  });

  // One code layer goes out as its own code only while the preview shows
  // that code as it is. Until 24 October 2026 a white layer at 50% showed 128
  // in the preview and went out as its code alone, so the community and the
  // board got 255. On multiply the preview was black and the board white.
  describe("one code layer", () => {
    const white = (blend: BlendMode, opacity: number): CodeLayer => ({
      id: "white",
      type: "code",
      name: "white",
      visible: true,
      opacity,
      blend,
      role: "paint",
      maskInvert: false,
      code: `export function draw(display) {
  for (let y = 0; y < display.height; y++)
    for (let x = 0; x < display.width; x++) display.setPixel(x, y, 255, 255, 255);
}`,
      ramp: DEFAULT_RAMP_STATE,
      recolor: false,
      knobsAnnotationRaw: null,
      matrixAnnotationRaw: null,
    });

    // What Share publishes and To hardware ports: the layer's own code, or
    // the stack flattened (buildExportCode in PatternLabClient.tsx).
    function published(layers: Layer[]): Uint8ClampedArray {
      const lone = loneCodeLayer(layers);
      if (!lone) return exported(layers);
      const runtime = new PatternRuntime(W, H);
      expect(runtime.loadCode(lone.code).error).toBeUndefined();
      expect(runtime.renderFrame(1 / 60, 0, createIdleInput([0, 0, 0, 0])).error).toBeUndefined();
      return runtime.data;
    }

    it.each([
      ["normal", 0.5, 128],
      ["add", 0.5, 128],
      ["screen", 0.3, 77],
      ["multiply", 1, 0],
      ["multiply", 0.5, 0],
      ["normal", 1, 255],
      ["add", 1, 255],
      ["screen", 1, 255],
    ] as const)("%s at %d is %d in the preview and in what goes out", (blend, opacity, value) => {
      const layers = [white(blend, opacity)];
      const preview = new LabEngine().render(project(layers), 1 / 60, 0).data;
      expect(Array.from(preview.subarray(0, 4))).toEqual([value, value, value, 255]);
      expect(differences(preview, published(layers))).toEqual([]);
    });

    it("goes out as its own code at 100% on normal, add and screen", () => {
      for (const blend of ["normal", "add", "screen"] as const) {
        const layer = white(blend, 1);
        expect(loneCodeLayer([layer])).toBe(layer);
      }
    });

    it("goes to the header as a stack of one, with its opacity and blend", () => {
      const plan = (layer: CodeLayer) => {
        const { scaffold, units } = buildHExport({
          name: "One",
          matrix: { width: W, height: H },
          layers: [layer],
          knobs: [0, 0, 0, 0],
          ranges: [[0, 1], [0, 1], [0, 1], [0, 1]],
          knobLabels: ["A", "B", "C", "D"],
        });
        const table = (name: string) => scaffold.match(new RegExp(`${name}\\[1\\]\\s*=\\s*\\{([^}]*)\\}`))![1].trim();
        return { units: units.length, opacity: table("G_OPACITY"), blend: table("G_BLEND") };
      };
      expect(loneCodeLayer([white("normal", 0.5)])).toBeNull();
      expect(plan(white("normal", 0.5))).toEqual({ units: 1, opacity: "0.5f", blend: "0" });
      expect(loneCodeLayer([white("multiply", 1)])).toBeNull();
      expect(plan(white("multiply", 1))).toEqual({ units: 1, opacity: "1.0f", blend: "2" });
    });
  });
});
