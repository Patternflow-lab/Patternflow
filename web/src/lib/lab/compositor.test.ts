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
import { flattenLayers } from "./flatten";
import { BLEND_MODES, type BlendMode, type PixelLayer } from "./types";

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
      const opacity = [1, 0.5, 0.25, 0.8][Math.floor(next() * 4)];
      layers.unshift(pixelLayer(`paint-${k}`, next, blend, opacity));
    }
    // A mask over the third paint layer from the top.
    layers.splice(2, 0, pixelLayer("mask", next, "normal", 1, "mask"));
    return layers;
  }

  function project(layers: PixelLayer[]): EngineProject {
    return {
      matrix: { width: W, height: H },
      layers,
      activeLayerId: layers[0].id,
      knobs: [0, 0, 0, 0],
      ranges: [[0, 1], [0, 1], [0, 1], [0, 1]],
    };
  }

  function exported(layers: PixelLayer[]): Uint8ClampedArray {
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

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("random stack %i", (seed) => {
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
});
