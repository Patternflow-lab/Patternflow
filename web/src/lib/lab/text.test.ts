// Text layers (창작자 지시 2, 23 October 2026). A text layer is drawn into a
// bitmap whenever its words, font, place or fill change, and from then on it
// is pixel art to the engine, the masks, the save and the export. The canvas
// step (textRaster.ts) is stood in for here by a block per character, so
// these tests pin everything around it: the colouring, the spec, the store
// actions, the save, and the layer working as a mask.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleInput, PatternRuntime } from "@/lib/pattern/harness";

// Each character lights a 2×2 block; the line is centred, left- or
// right-aligned on spec.x and sits on spec.y.
vi.mock("./textRaster", () => ({
  textCoverage: vi.fn((spec: { text: string; x: number; y: number; align: string }, _font: string, width: number, height: number) => {
    const coverage = new Uint8ClampedArray(width * height);
    const lineWidth = spec.text.length * 2;
    const left = spec.align === "left" ? spec.x : spec.align === "right" ? spec.x - lineWidth : spec.x - lineWidth / 2;
    for (let y = spec.y - 1; y < spec.y + 1; y++) {
      for (let x = left; x < left + lineWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) coverage[y * width + x] = 255;
      }
    }
    return coverage;
  }),
}));

import { textCoverage } from "./textRaster";
import { drawTextLayer, inkBounds, paintText } from "./text";
import { LabEngine } from "./engine";
import { flattenLayers } from "./flatten";
import { bytesToBase64, deserializeProject, serializeProject } from "./serialize";
import { useLabStore } from "./store";
import { resizePixelLayers } from "./store/shared";
import {
  DEFAULT_RAMP_STATE,
  TEXT_RAMP_STATE,
  createTextLayer,
  defaultTextSpec,
  normalizeTextSpec,
  type Layer,
  type PixelLayer,
  type RampState,
  type TextLayer,
} from "./types";

const store = () => useLabStore.getState();
const frame = { width: 16, height: 8 };

/** Indices of the lit pixels (alpha > 0), as "x,y". */
function lit(data: Uint8ClampedArray, width: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < data.length / 4; i++) {
    if (data[i * 4 + 3] > 0) out.push(`${i % width},${Math.floor(i / width)}`);
  }
  return out;
}

const blackToWhite: RampState = {
  stops: [
    { position: 0, color: "#000000", alpha: 1 },
    { position: 1, color: "#ffffff", alpha: 1 },
  ],
  mode: "linear",
  wrap: false,
};

describe("paintText", () => {
  it("sharp edges light a pixel the letters cover half of or more, fully", () => {
    const coverage = new Uint8ClampedArray([0, 127, 128, 255]);
    const out = paintText(coverage, { color: "#ff8000", fill: "solid", sharp: true }, DEFAULT_RAMP_STATE, 4, 1);
    expect(Array.from(out)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 255, 128, 0, 255, 255, 128, 0, 255]);
  });

  it("soft edges keep the coverage as a dimmer LED", () => {
    const coverage = new Uint8ClampedArray([0, 64, 255]);
    const out = paintText(coverage, { color: "#ffffff", fill: "solid", sharp: false }, DEFAULT_RAMP_STATE, 3, 1);
    expect([out[3], out[7], out[11]]).toEqual([0, 64, 255]);
  });

  it("a ramp across runs from the first lit column to the last, wherever the word sits", () => {
    // Lit at x = 2..6 of 10: x 2 takes the ramp's start, x 6 its end.
    const coverage = new Uint8ClampedArray(10);
    for (let x = 2; x <= 6; x++) coverage[x] = 255;
    const out = paintText(coverage, { color: "#ffffff", fill: "rampX", sharp: true }, blackToWhite, 10, 1);
    expect(out[2 * 4]).toBe(0);
    expect(out[4 * 4]).toBe(128);
    expect(out[6 * 4]).toBe(255);
    expect(out[7 * 4 + 3]).toBe(0);
  });

  it("a ramp down runs from the first lit row to the last", () => {
    const coverage = new Uint8ClampedArray([255, 255, 255]);
    const out = paintText(coverage, { color: "#ffffff", fill: "rampY", sharp: true }, blackToWhite, 1, 3);
    expect([out[0], out[4], out[8]]).toEqual([0, 128, 255]);
  });

  it("a ramp stop's alpha thins the letters", () => {
    const halfClear: RampState = { ...blackToWhite, stops: blackToWhite.stops.map((stop) => ({ ...stop, alpha: 0.5 })) };
    const out = paintText(new Uint8ClampedArray([255]), { color: "#ffffff", fill: "rampX", sharp: true }, halfClear, 1, 1);
    expect(out[3]).toBe(128);
  });

  it("nothing lit gives an empty bitmap", () => {
    const out = paintText(new Uint8ClampedArray(6), { color: "#ffffff", fill: "rampX", sharp: true }, blackToWhite, 3, 2);
    expect(out.every((byte) => byte === 0)).toBe(true);
    expect(inkBounds(new Uint8ClampedArray(6), 3, 2)).toBeNull();
  });
});

describe("normalizeTextSpec", () => {
  const base = defaultTextSpec(frame);

  it("keeps sizes in range and places in whole pixels", () => {
    const spec = normalizeTextSpec({ ...base, size: 900, x: 3.6, y: -2.4 }, base, frame);
    expect(spec.size).toBe(128);
    expect([spec.x, spec.y]).toEqual([4, -2]);
    expect(normalizeTextSpec({ ...base, size: 1 }, base, frame).size).toBe(4);
  });

  it("falls back to the previous value for anything broken", () => {
    const spec = normalizeTextSpec(
      { text: 5 as unknown as string, size: Number.NaN, align: "justify" as never, color: "red", fill: "plaid" as never, font: "" },
      base,
      frame,
    );
    expect(spec).toEqual(base);
  });

  it("cuts the text at 200 characters", () => {
    expect(normalizeTextSpec({ ...base, text: "a".repeat(300) }, base, frame).text).toHaveLength(200);
  });

  it("lets a text slide off the frame, but not to anywhere", () => {
    const spec = normalizeTextSpec({ ...base, x: 1e9, y: -1e9 }, base, frame);
    expect([spec.x, spec.y]).toEqual([64, -32]);
  });
});

describe("drawTextLayer", () => {
  it("draws the spec in the layer's font at the layer's size", () => {
    const layer = drawTextLayer({ ...createTextLayer(frame, "Text 1"), spec: { ...defaultTextSpec(frame), text: "ab" } });
    expect(textCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: "ab", x: 8, y: 4 }),
      expect.stringContaining("Silkscreen"),
      16,
      8,
    );
    expect(lit(layer.data, 16)).toEqual(["6,3", "7,3", "8,3", "9,3", "6,4", "7,4", "8,4", "9,4"]);
    expect(layer.rev).toBe(1);
  });

  it("keeps the bitmap it has where there is no canvas", () => {
    vi.mocked(textCoverage).mockReturnValueOnce(null);
    const before = createTextLayer(frame, "Text 1");
    before.data[3] = 255;
    const after = drawTextLayer(before);
    expect(after.data).toBe(before.data);
  });
});

describe("text layers in the store", () => {
  beforeEach(() => {
    store().discardProject();
    store().setMatrix(frame);
  });

  const text = (): TextLayer => {
    const layer = store().layers.find((entry) => entry.id === store().activeLayerId);
    if (layer?.type !== "text") throw new Error("active layer is not text");
    return layer;
  };

  it("+ Text puts a drawn, selected layer on top", () => {
    store().addTextLayer();
    expect(store().layers[0].type).toBe("text");
    expect(store().layers[0].name).toBe("Text 1");
    expect(store().activeLayerId).toBe(store().layers[0].id);
    expect(lit(text().data, 16).length).toBeGreaterThan(0);
  });

  it("moving the text moves its pixels", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { text: "a", align: "left", x: 0, y: 1 });
    expect(lit(text().data, 16)).toEqual(["0,0", "1,0", "0,1", "1,1"]);
    store().setTextSpec(text().id, { x: 5, y: 6 });
    expect(lit(text().data, 16)).toEqual(["5,5", "6,5", "5,6", "6,6"]);
  });

  it("a ramp edit redraws a ramp-filled text, and leaves a one-colour text alone", () => {
    store().addTextLayer();
    const id = text().id;
    store().setTextSpec(id, { text: "abc", fill: "solid", color: "#00ff00" });
    const solidRev = text().rev;
    store().setLayerRampMode(id, "linear");
    expect(text().rev).toBe(solidRev);

    store().setTextSpec(id, { fill: "rampX" });
    store().setLayerRampStops(id, [
      { position: 0, color: "#ff0000", alpha: 1 },
      { position: 1, color: "#ff0000", alpha: 1 },
    ]);
    const first = lit(text().data, 16)[0].split(",").map(Number);
    const at = (first[1] * 16 + first[0]) * 4;
    expect(Array.from(text().data.subarray(at, at + 4))).toEqual([255, 0, 0, 255]);
  });

  it("duplicating copies the words, ramp and pixels apart from the original", () => {
    store().addTextLayer();
    const original = text();
    store().duplicateLayer(original.id);
    const copy = text();
    expect(copy.id).not.toBe(original.id);
    expect(copy.spec).toEqual(original.spec);
    expect(copy.data).not.toBe(original.data);
    expect(copy.ramp).not.toBe(original.ramp);
    store().setTextSpec(copy.id, { text: "changed" });
    expect(store().layers.find((layer) => layer.id === original.id)).toMatchObject({ spec: { text: "Hello" } });
  });

  it("a new frame size moves the text with its pixels", () => {
    const layer = drawTextLayer(createTextLayer(frame, "Text 1"));
    const [resized] = resizePixelLayers([layer], { width: 20, height: 12 }) as TextLayer[];
    expect([resized.width, resized.height]).toEqual([20, 12]);
    expect([resized.spec.x, resized.spec.y]).toEqual([layer.spec.x + 2, layer.spec.y + 2]);
    // Drawn again where it now is, it lands on the same pixels the resize put it on.
    expect(lit(drawTextLayer(resized).data, 20)).toEqual(lit(resized.data, 20));
  });
});

describe("saving a text layer", () => {
  beforeEach(() => {
    store().discardProject();
    store().setMatrix(frame);
  });

  it("comes back with its words, font, ramp and the pixels it was drawn as", () => {
    store().addTextLayer();
    const before = store().layers[0] as TextLayer;
    store().setTextSpec(before.id, { text: "hi", font: "file:Brand Sans", fill: "rampY", sharp: false });
    const json = serializeProject(store());
    expect(json).not.toBeNull();
    const restored = deserializeProject(json!)!;
    const after = restored.layers[0] as TextLayer;
    const saved = store().layers[0] as TextLayer;
    expect(after.type).toBe("text");
    expect(after.spec).toEqual(saved.spec);
    expect(after.ramp).toEqual(saved.ramp);
    expect(Array.from(after.data)).toEqual(Array.from(saved.data));
  });

  it("a text layer saved without a ramp or a whole spec opens with the defaults", () => {
    const json = JSON.stringify({
      version: 2,
      matrix: frame,
      layers: [{
        type: "text", id: "t", name: "T", width: 16, height: 8,
        px: bytesToBase64(new Uint8ClampedArray(16 * 8 * 4)),
        spec: { text: "ok", size: "big" },
      }],
    });
    const layer = deserializeProject(json)!.layers[0] as TextLayer;
    expect(layer.spec).toEqual({ ...defaultTextSpec(frame), text: "ok" });
    expect(layer.ramp).toEqual(TEXT_RAMP_STATE);
  });
});

describe("a text layer as a mask", () => {
  const W = 16;
  const H = 8;

  function red(): PixelLayer {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) data.set([255, 0, 0, 255], i * 4);
    return {
      id: "red", type: "pixel", name: "red", visible: true, opacity: 1, blend: "normal",
      role: "paint", maskInvert: false, width: W, height: H, data, rev: 0,
    };
  }

  function mask(): TextLayer {
    const layer = drawTextLayer({
      ...createTextLayer({ width: W, height: H }, "Text 1"),
      spec: { ...defaultTextSpec({ width: W, height: H }), text: "ab", align: "left", x: 2, y: 4 },
    });
    return { ...layer, role: "mask" };
  }

  it("shows the layer below only through the letters, in the preview and the export alike", () => {
    const layers: Layer[] = [mask(), red()];
    const preview = new LabEngine().render(
      { matrix: { width: W, height: H }, layers, activeLayerId: "red", knobs: [0, 0, 0, 0], ranges: [[0, 1], [0, 1], [0, 1], [0, 1]] },
      1 / 60,
      0,
    ).data;
    const redPixels = [];
    for (let i = 0; i < W * H; i++) if (preview[i * 4] === 255) redPixels.push(`${i % W},${Math.floor(i / W)}`);
    expect(redPixels).toEqual(["2,3", "3,3", "4,3", "5,3", "2,4", "3,4", "4,4", "5,4"]);

    const runtime = new PatternRuntime(W, H);
    expect(runtime.loadCode(flattenLayers(layers, { width: W, height: H })).error).toBeUndefined();
    runtime.renderFrame(1 / 60, 0, createIdleInput([0, 0, 0, 0]));
    expect(Array.from(runtime.data)).toEqual(Array.from(preview));
  });
});
