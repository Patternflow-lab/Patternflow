// Text effects, added 24 October 2026: a text layer scrolls, twinkles or
// runs its ramp at the speed of one knob (textEffects.ts). These tests pin
// the parts around the frames: the phase, the source text.ts draws past the
// frame's edges, the save, a resize, the engine and the store.
// textExport.test.ts holds the preview, the flattened JS and the firmware
// header to the same LEDs.
//
// The canvas is stood in for as in text.test.ts: each character lights a
// 2×2 block on spec.y, the line starting at spec.x (left-aligned here).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./textRaster", () => {
  const lineLeft = (spec: { text: string; x: number; align: string }) =>
    spec.align === "left" ? spec.x : spec.align === "right" ? spec.x - spec.text.length * 2 : spec.x - spec.text.length;
  return {
    textCoverage: vi.fn(
      (spec: { text: string; x: number; y: number; align: string }, _font: string, width: number, height: number, left = 0) => {
        const coverage = new Uint8ClampedArray(width * height);
        const start = lineLeft(spec);
        for (let y = spec.y - 1; y < spec.y + 1; y++) {
          for (let x = start; x < start + spec.text.length * 2; x++) {
            const column = x - left;
            if (column >= 0 && column < width && y >= 0 && y < height) coverage[y * width + column] = 255;
          }
        }
        return coverage;
      },
    ),
    textReach: vi.fn((spec: { text: string; x: number; align: string }) => {
      const start = lineLeft(spec);
      return { left: start - 1, right: start + spec.text.length * 2 + 1 };
    }),
  };
});

import { buildRampLUTRGBA } from "@/lib/pattern/harness";
import { textCoverage } from "./textRaster";
import { drawTextLayer, paintText } from "./text";
import {
  TEXT_EFFECT_RATE,
  activeTextEffect,
  advanceTextPhase,
  placeTextSource,
  renderTextEffect,
  sourceColumnLimit,
  textEffectPeriod,
  twinkleHash,
} from "./textEffects";
import { LabEngine } from "./engine";
import { rampStateToHarness } from "./engine";
import { deserializeProject, serializeProject } from "./serialize";
import { useLabStore } from "./store";
import { resizePixelLayers } from "./store/shared";
import { createPixelLayer, createTextLayer, type Layer, type TextLayer, type TextSpec } from "./types";

const frame = { width: 16, height: 8 };

function textAt(spec: Partial<TextSpec>, size = frame): TextLayer {
  const layer = createTextLayer(size, "Text");
  return drawTextLayer({ ...layer, spec: { ...layer.spec, align: "left", x: 2, y: 4, ...spec } });
}

/** Columns with something lit, as frame x. */
function litColumns(data: Uint8ClampedArray, width: number): number[] {
  const columns = new Set<number>();
  for (let i = 0; i < data.length / 4; i++) if (data[i * 4 + 3] > 0) columns.add(i % width);
  return [...columns].sort((a, b) => a - b);
}

const render = (engine: LabEngine, layers: Layer[], knobs: number[], dt: number, size = frame) =>
  engine.render({ matrix: size, layers, activeLayerId: layers[0].id, knobs, ranges: [[0, 1], [0, 1], [0, 1], [0, 1]] }, dt, 0)
    .data.slice();

/** Columns with an LED on in an engine frame, which is opaque: by colour. */
function shownColumns(data: Uint8ClampedArray, width: number): number[] {
  const columns = new Set<number>();
  for (let i = 0; i < data.length / 4; i++) if (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] > 0) columns.add(i % width);
  return [...columns].sort((a, b) => a - b);
}

describe("the phase", () => {
  it("adds dt × the knob's share of the speed", () => {
    expect(advanceTextPhase(0, 1, 0.5, 128, 1000)).toBe(64);
    expect(advanceTextPhase(10, 0.25, 1, 128, 1000)).toBe(42);
  });

  it("stands still at the bottom of the knob, and with no knob reading at all", () => {
    expect(advanceTextPhase(7, 1, 0, 128, 100)).toBe(7);
    expect(advanceTextPhase(7, 1, -3, 128, 100)).toBe(7);
    expect(advanceTextPhase(7, 1, Number.NaN, 128, 100)).toBe(7);
  });

  it("goes no faster past the top of the knob, and starts again after its period", () => {
    expect(advanceTextPhase(0, 1, 4, 128, 1000)).toBe(128);
    expect(advanceTextPhase(90, 0.25, 1, 128, 100)).toBe(22);
  });

  it("twinkles each LED on its own beat", () => {
    const beats = new Set<number>();
    for (let x = 0; x < 16; x++) beats.add(twinkleHash(x, 3));
    expect(beats.size).toBeGreaterThan(10);
    expect(twinkleHash(5, 2)).toBe(twinkleHash(5, 2));
    for (let i = 0; i < 64; i++) expect(twinkleHash(i, i * 3) & ~255).toBe(0);
  });
});

describe("drawing a moving text", () => {
  beforeEach(() => {
    vi.mocked(textCoverage).mockClear();
  });

  it("scroll draws the whole line, past the frame's right edge, and rests where the text sits", () => {
    // 12 characters are 24 columns from x = 2: ten of them past a 16-wide frame.
    const layer = textAt({ text: "PATTERNFLOW!", effect: "scroll" });
    expect(layer.source?.x).toBe(2);
    expect(layer.source?.width).toBe(24);
    expect(activeTextEffect(layer)).toBe("scroll");
    expect(litColumns(layer.data, 16)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(textEffectPeriod("scroll", layer)).toBe(24 + 16);
  });

  it("scroll brings the letters that were off the frame through it", () => {
    const layer = textAt({ text: "PATTERNFLOW!", effect: "scroll" });
    const out = new Uint8ClampedArray(layer.data.length);
    // Twenty columns on, the last ten letters' columns fill the frame from the left.
    renderTextEffect(layer, "scroll", 20, null, out);
    expect(litColumns(out, 16)).toEqual([0, 1, 2, 3, 4, 5]);
    // Twenty-six on, the line has left the frame; one more and it is back on the right.
    renderTextEffect(layer, "scroll", 26, null, out);
    expect(litColumns(out, 16)).toEqual([]);
    renderTextEffect(layer, "scroll", 27, null, out);
    expect(litColumns(out, 16)).toEqual([15]);
  });

  it("a ramp that runs rests on the same colours as a ramp fill that does not", () => {
    const still = textAt({ text: "HEY", fill: "rampX" });
    const running = textAt({ text: "HEY", fill: "rampX", effect: "ramp" });
    expect(Array.from(running.data)).toEqual(Array.from(still.data));
    // Red holds the place on the ramp: the first lit column 0, the last 255.
    const source = running.source!;
    expect(source.data[(3 * source.width) * 4]).toBe(0);
    expect(source.data[(3 * source.width + source.width - 1) * 4]).toBe(255);
  });

  it("a one-colour text that runs the ramp takes the ramp's colours, all letters at once", () => {
    const layer = textAt({ text: "HEY", effect: "ramp" });
    const lut = buildRampLUTRGBA(rampStateToHarness(layer.ramp));
    const j = (4 * 16 + 2) * 4;
    expect(Array.from(layer.data.subarray(j, j + 3))).toEqual(Array.from(lut.subarray(0, 3)));
    const out = new Uint8ClampedArray(layer.data.length);
    renderTextEffect(layer, "ramp", 300, lut, out);
    // 300 is past the far end: back down to 511 - 300 = 211.
    expect(Array.from(out.subarray(j, j + 3))).toEqual(Array.from(lut.subarray(211 * 4, 211 * 4 + 3)));
  });

  it("twinkle needs no source, and dims a lit LED to a quarter at most", () => {
    const layer = textAt({ text: "HEY", effect: "twinkle" });
    expect(layer.source).toBeNull();
    const out = new Uint8ClampedArray(layer.data.length);
    for (let phase = 0; phase < 256; phase += 17) {
      renderTextEffect(layer, "twinkle", phase, null, out);
      for (let i = 0; i < out.length; i += 4) {
        expect(out.subarray(i, i + 3)).toEqual(layer.data.subarray(i, i + 3));
        if (layer.data[i + 3] === 0) expect(out[i + 3]).toBe(0);
        else expect(out[i + 3]).toBeGreaterThanOrEqual(65);
      }
    }
  });

  it("no effect again drops the source", () => {
    const layer = drawTextLayer({ ...textAt({ text: "HEY", effect: "scroll" }), spec: { ...textAt({}).spec, text: "HEY", effect: "none" } });
    expect(layer.source).toBeNull();
  });

  it("a scroll whose source is missing shows the bitmap as it is", () => {
    const layer = { ...textAt({ text: "HEY", effect: "scroll" }), source: null };
    expect(activeTextEffect(layer)).toBeNull();
    const shown = render(new LabEngine(), [layer], [0, 1, 0, 0], 0.5);
    expect(shownColumns(shown, 16)).toEqual(litColumns(layer.data, 16));
  });
});

describe("moving text in the engine", () => {
  it("moves at the knob it is set to: half of the speed knob is 64 pixels a second", () => {
    const layer = textAt({ text: "AB", x: 4, effect: "scroll", effectKnob: 1 });
    const engine = new LabEngine();
    // 1/16 s at half speed is 4 columns to the left.
    expect(shownColumns(render(engine, [layer], [1, 0.5, 1, 1], 1 / 16), 16)).toEqual([0, 1, 2, 3]);
    expect(TEXT_EFFECT_RATE.scroll * 0.5 * (1 / 16)).toBe(4);
  });

  it("the other knobs do nothing to it", () => {
    const layer = textAt({ text: "AB", x: 4, effect: "scroll", effectKnob: 1 });
    expect(shownColumns(render(new LabEngine(), [layer], [1, 0, 1, 1], 1), 16)).toEqual([4, 5, 6, 7]);
  });

  it("a twinkling mask gates the layer under it as it twinkles", () => {
    const art = createPixelLayer(frame, "Art");
    art.data.fill(255);
    const mask: TextLayer = { ...textAt({ text: "ABCDEFGH", x: 0, effect: "twinkle", effectKnob: 0 }), role: "mask" };
    const engine = new LabEngine();
    const lit = (data: Uint8ClampedArray) => {
      let n = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    };
    const counts = new Set<number>();
    for (let f = 0; f < 8; f++) counts.add(lit(render(engine, [mask, art], [1, 0, 0, 0], 1 / 32)));
    // 32 LEDs under the letters; some are below the mask's half at any beat, and which changes.
    expect(Math.max(...counts)).toBeLessThan(32);
    expect(counts.size).toBeGreaterThan(1);
  });

  it("is stretched to a render grid bigger than the layer, the way Graphic Export renders", () => {
    const layer = textAt({ text: "AB", x: 4, effect: "scroll", effectKnob: 1 });
    const big = { width: 32, height: 16 };
    const shown = render(new LabEngine(), [layer], [0, 0.5, 0, 0], 1 / 16, big);
    expect(shownColumns(shown, 32)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("a moving text saved and opened again", () => {
  const project = (layers: Layer[]) => ({ ...useLabStore.getState(), layers, activeLayerId: layers[0].id });

  it("keeps its effect, its knob and what it moves", () => {
    const layer = textAt({ text: "PATTERNFLOW!", effect: "scroll", effectKnob: 3 });
    const opened = deserializeProject(serializeProject(project([layer]))!)!;
    const back = opened.layers[0] as TextLayer;
    expect(back.spec.effect).toBe("scroll");
    expect(back.spec.effectKnob).toBe(3);
    expect(back.source?.x).toBe(2);
    expect(Array.from(back.source!.data)).toEqual(Array.from(layer.source!.data));
  });

  it("opens a save from before effects as still letters", () => {
    const json = JSON.parse(serializeProject(project([textAt({ text: "HEY" })]))!);
    delete json.layers[0].spec.effect;
    delete json.layers[0].spec.effectKnob;
    const back = deserializeProject(JSON.stringify(json))!.layers[0] as TextLayer;
    expect(back.spec.effect).toBe("none");
    expect(back.spec.effectKnob).toBe(1);
    expect(back.source).toBeNull();
  });

  it("drops a source that does not fit its frame, and the scroll then stands", () => {
    const json = JSON.parse(serializeProject(project([textAt({ text: "PATTERNFLOW!", effect: "scroll" })]))!);
    json.layers[0].src.w = 23;
    const back = deserializeProject(JSON.stringify(json))!.layers[0] as TextLayer;
    expect(back.source).toBeNull();
    expect(activeTextEffect(back)).toBeNull();
  });
});

describe("placing a source", () => {
  const scrollFrames = (layer: TextLayer) =>
    Array.from({ length: textEffectPeriod("scroll", layer) + 3 }, (_, phase) => {
      const out = new Uint8ClampedArray(16 * 8 * 4);
      renderTextEffect(layer, "scroll", phase, null, out);
      return Array.from(out);
    });

  it("brings a scroll's x next to the frame and shows the same frames", () => {
    const layer = textAt({ text: "PATTERNFLOW!", effect: "scroll" });
    for (const x of [-5000, -41, -24, 17, 900]) {
      const far = { ...layer, source: { ...layer.source!, x } };
      const placed = placeTextSource(far.source, "scroll", 16, 8)!;
      expect(placed.x).toBeGreaterThan(-placed.width);
      expect(placed.x).toBeLessThanOrEqual(16);
      expect(scrollFrames({ ...layer, source: placed })).toEqual(scrollFrames(far));
    }
  });

  it("keeps a ramp where it is, and drops one wholly off the frame", () => {
    const layer = textAt({ text: "HEY", effect: "ramp" });
    const source = layer.source!;
    expect(placeTextSource({ ...source, x: -3 }, "ramp", 16, 8)?.x).toBe(-3);
    expect(placeTextSource({ ...source, x: -source.width }, "ramp", 16, 8)).toBeNull();
    expect(placeTextSource({ ...source, x: 16 }, "ramp", 16, 8)).toBeNull();
  });

  it("cuts the columns past what the frame's source holds, keeping each row's start", () => {
    const columns = sourceColumnLimit(16, 8) + 5;
    const data = new Uint8ClampedArray(columns * 8 * 4);
    for (let y = 0; y < 8; y++) data[(y * columns + 1) * 4 + 3] = y + 1;
    const placed = placeTextSource({ x: 0, width: columns, data }, "scroll", 16, 8)!;
    expect(placed.width).toBe(sourceColumnLimit(16, 8));
    expect(placed.data.length).toBe(placed.width * 8 * 4);
    for (let y = 0; y < 8; y++) expect(placed.data[(y * placed.width + 1) * 4 + 3]).toBe(y + 1);
  });
});

describe("a moving text on a resized frame", () => {
  it("its source moves with the letters, columns kept and rows re-centred", () => {
    const layer = textAt({ text: "PATTERNFLOW!", effect: "scroll" });
    const [resized] = resizePixelLayers([layer], { width: 24, height: 12 }) as TextLayer[];
    expect(resized.source?.x).toBe(2 + 4);
    expect(resized.source?.width).toBe(24);
    expect(resized.source?.data.length).toBe(24 * 12 * 4);
    // Row 3 of 8 is row 5 of 12.
    expect(resized.source!.data[(5 * 24) * 4 + 3]).toBe(255);
    expect(activeTextEffect(resized)).toBe("scroll");
  });
});

describe("moving text in the store", () => {
  beforeEach(() => {
    useLabStore.getState().discardProject();
    useLabStore.getState().setMatrix(frame);
  });

  const active = () => {
    const state = useLabStore.getState();
    return state.layers.find((layer) => layer.id === state.activeLayerId) as TextLayer;
  };

  it("choosing an effect draws its source, and the knob is kept in range", () => {
    useLabStore.getState().addTextLayer();
    useLabStore.getState().setTextSpec(active().id, { effect: "scroll", effectKnob: 9 });
    expect(active().source).not.toBeNull();
    expect(active().spec.effectKnob).toBe(3);
  });

  it("a ramp edit redraws a one-colour text that runs the ramp", () => {
    useLabStore.getState().addTextLayer();
    useLabStore.getState().setTextSpec(active().id, { effect: "ramp" });
    const before = active().data;
    useLabStore.getState().setLayerRampStops(active().id, [
      { position: 0, color: "#00ff00", alpha: 1 },
      { position: 1, color: "#0000ff", alpha: 1 },
    ]);
    expect(active().data).not.toBe(before);
    const lit = Array.from(active().data).findIndex((byte, i) => (i & 3) === 3 && byte > 0) - 3;
    expect(Array.from(active().data.subarray(lit, lit + 3))).toEqual([0, 255, 0]);
  });

  it("paints a still text exactly as before", () => {
    const layer = textAt({ text: "HEY" });
    const coverage = vi.mocked(textCoverage).mock.results.at(-1)!.value as Uint8ClampedArray;
    expect(Array.from(layer.data)).toEqual(Array.from(paintText(coverage, layer.spec, layer.ramp, 16, 8)));
  });
});
