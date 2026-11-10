// Text layers drawn through textRaster.ts itself, added 25 October 2026.
// text.test.ts and textEffects.test.ts replace that file with a block per
// character, which never says "no letters" and never measures a line past
// what a source holds. Here the canvas is the fake one: it sets each
// character as a solid block half the font size wide and the font size
// tall, and a space as a gap. test/setup.ts's canvas measures nothing and
// draws nothing, so it is swapped for this one around every test.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildRampLUTRGBA } from "@/lib/pattern/harness";
import { rampStateToHarness, LabEngine } from "./engine";
import { buildPixelPatternCode } from "./pixelToCode";
import { deserializeProject, serializeProject } from "./serialize";
import { useLabStore } from "./store";
import { activeTextEffect, renderTextEffect, sourceColumnLimit, textEffectPeriod } from "./textEffects";
import type { TextLayer, TextSpec } from "./types";

const advance = (size: number) => Math.ceil(size / 2);

class LetterContext {
  textAlign = "left";
  textBaseline = "top";
  fillStyle = "#ffffff";
  private size = 10;
  private lines: { text: string; x: number; y: number }[] = [];

  set font(value: string) {
    this.size = Number.parseFloat(value);
  }

  get font(): string {
    return `${this.size}px sans-serif`;
  }

  measureText(line: string) {
    const width = line.length * advance(this.size);
    return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width };
  }

  clearRect() {
    this.lines = [];
  }

  fillText(text: string, x: number, y: number) {
    this.lines.push({ text, x, y });
  }

  getImageData(_x: number, _y: number, width: number, height: number) {
    const data = new Uint8ClampedArray(width * height * 4);
    const step = advance(this.size);
    for (const line of this.lines) {
      [...line.text].forEach((char, index) => {
        if (char === " ") return;
        const left = line.x + index * step;
        for (let y = Math.max(0, line.y); y < Math.min(height, line.y + this.size); y++) {
          for (let x = Math.max(0, left); x < Math.min(width, left + step - 1); x++) data[(y * width + x) * 4 + 3] = 255;
        }
      });
    }
    return { width, height, data };
  }
}

let stubbed: PropertyDescriptor | undefined;

beforeAll(() => {
  stubbed = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "getContext");
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => new LetterContext(),
  });
});

afterAll(() => {
  if (stubbed) Object.defineProperty(HTMLCanvasElement.prototype, "getContext", stubbed);
});

const store = () => useLabStore.getState();

const active = (): TextLayer => {
  const layer = store().layers.find((entry) => entry.id === store().activeLayerId);
  if (layer?.type !== "text") throw new Error("active layer is not text");
  return layer;
};

function textLayer(spec: Partial<TextSpec>): TextLayer {
  store().addTextLayer();
  store().setTextSpec(active().id, spec);
  return active();
}

function litCount(data: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
  return count;
}

/** The layer's frame at each of these phases, as the preview draws it. */
function frames(layer: TextLayer, phases: number[]): number[][] {
  const effect = activeTextEffect(layer);
  if (!effect) throw new Error("the layer does not move");
  const lut = effect === "ramp" ? buildRampLUTRGBA(rampStateToHarness(layer.ramp)) : null;
  return phases.map((phase) => {
    const out = new Uint8ClampedArray(layer.width * layer.height * 4);
    renderTextEffect(layer, effect, phase, lut, out);
    return Array.from(out);
  });
}

const reopen = () => deserializeProject(serializeProject(store())!)!.layers[0] as TextLayer;

beforeEach(() => {
  store().discardProject();
  store().setMatrix({ width: 32, height: 16 });
});

describe("a moving text whose words are deleted", () => {
  it.each([
    ["scroll", ""],
    ["scroll", "\n"],
    ["ramp", ""],
    ["ramp", "\n"],
  ] as const)("%s, with the text set to %j, lights nothing, as a still one does", (effect, emptied) => {
    const layer = textLayer({ text: "HEY", size: 8, effect });
    expect(layer.source).not.toBeNull();
    expect(litCount(layer.data)).toBeGreaterThan(0);

    store().setTextSpec(layer.id, { text: emptied });
    const empty = active();
    expect(empty.source).toBeNull();
    expect(activeTextEffect(empty)).toBeNull();
    expect(litCount(empty.data)).toBe(0);

    // The preview, a second on at full speed, and Copy as code.
    const engine = new LabEngine();
    const frame = engine.render(
      { matrix: { width: 32, height: 16 }, layers: [empty], activeLayerId: empty.id, knobs: [1, 1, 1, 1], ranges: [[0, 1], [0, 1], [0, 1], [0, 1]] },
      1,
      0,
    );
    expect(Array.from(frame.data).some((byte, i) => (i & 3) !== 3 && byte > 0)).toBe(false);
    expect(buildPixelPatternCode(empty)).toBeNull();

    store().setTextSpec(layer.id, { effect: "none" });
    expect(Array.from(active().data)).toEqual(Array.from(empty.data));
  });
});

describe("a line longer than its source holds", () => {
  // 200 characters at 64 px set 6,400 pixels: past the 4,096 columns a
  // 128 × 64 source holds.
  const long = "PATTERNFLOW ".repeat(17).slice(0, 200);

  it.each(["scroll", "ramp"] as const)(
    "keeps its %s running after the panel turns from 128 × 64 to 64 × 128 and the project reopens",
    (effect) => {
      store().setMatrix({ width: 128, height: 64 });
      const wide = textLayer({ text: long, size: 64, align: "left", x: 0, effect });
      expect(wide.source!.width).toBeGreaterThan(sourceColumnLimit(64, 128));

      store().setMatrix({ width: 64, height: 128 });
      const turned = active();
      expect(turned.source!.width).toBeLessThanOrEqual(sourceColumnLimit(64, 128));
      expect(turned.source!.data.length).toBeLessThanOrEqual(512 * 512 * 4);

      const back = reopen();
      expect(activeTextEffect(back)).toBe(effect);
      const phases = [0, 1, 63, 64, 300, textEffectPeriod(effect, turned) - 1];
      expect(frames(back, phases)).toEqual(frames(turned, phases));
    },
  );

  it("keeps scrolling after the project reopens when it is set right of its X", () => {
    store().setMatrix({ width: 128, height: 64 });
    const layer = textLayer({ text: long, size: 64, align: "right", x: 120, effect: "scroll" });
    expect(activeTextEffect(layer)).toBe("scroll");

    const back = reopen();
    expect(activeTextEffect(back)).toBe("scroll");
    const phases = [0, 1, 127, 128, 2000, textEffectPeriod("scroll", layer) - 1];
    expect(frames(back, phases)).toEqual(frames(layer, phases));
  });
});
