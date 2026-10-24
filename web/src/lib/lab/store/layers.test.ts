// The @matrix line in a code layer's code. Until 24 October 2026 the Lab
// changed the frame on every keystroke in the editor. Typing 96 over the 128
// of "// @matrix 128x64" passed through 12x64, 1x64 (unreadable, so back to
// 128x64) and 9x64, and each step cropped the pixel and text layers to that
// width: a pixel layer painted edge to edge kept 576 of its 8,192 cells, and
// the text moved to x 47 instead of 48. Now the editor holds the line until
// focus leaves it, a line the Lab cannot read leaves the frame alone, and a
// frame change puts each pixel layer on its undo stack first.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Each character lights a 2×2 block centred on spec.x, as in text.test.ts.
vi.mock("../textRaster", () => ({
  textCoverage: vi.fn((spec: { text: string; x: number; y: number }, _font: string, width: number, height: number) => {
    const coverage = new Uint8ClampedArray(width * height);
    const lineWidth = spec.text.length * 2;
    const left = spec.x - lineWidth / 2;
    for (let y = spec.y - 1; y < spec.y + 1; y++) {
      for (let x = left; x < left + lineWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) coverage[y * width + x] = 255;
      }
    }
    return coverage;
  }),
}));

import { prunePixelHistories, undoPixels } from "../pixelHistory";
import { useLabStore } from "../store";
import type { PixelLayer, TextLayer } from "../types";

const store = () => useLabStore.getState();
const BODY = "export function draw(display) {}\n";
const withLine = (line: string) => `${line}\n${BODY}`;

// Selecting the 128 and typing 96, one keystroke at a time.
const TYPING = ["// @matrix 12x64", "// @matrix 1x64", "// @matrix x64", "// @matrix 9x64", "// @matrix 96x64"];

function lit(layer: { data: Uint8ClampedArray }): number {
  let count = 0;
  for (let i = 3; i < layer.data.length; i += 4) if (layer.data[i] > 0) count++;
  return count;
}

function codeId(): string {
  const layer = store().layers.find((entry) => entry.type === "code");
  if (!layer) throw new Error("no code layer");
  return layer.id;
}

function pixel(): PixelLayer {
  const layer = store().layers.find((entry) => entry.type === "pixel");
  if (layer?.type !== "pixel") throw new Error("no pixel layer");
  return layer;
}

function text(): TextLayer {
  const layer = store().layers.find((entry) => entry.type === "text");
  if (layer?.type !== "text") throw new Error("no text layer");
  return layer;
}

beforeEach(() => {
  prunePixelHistories([]);
  store().discardProject();
  store().updateLayerCode(codeId(), withLine("// @matrix 128x64"));
  store().addPixelLayer();
  store().replacePixelData(pixel().id, new Uint8ClampedArray(128 * 64 * 4).fill(255));
  store().addTextLayer();
  // 11 characters, 22 pixels wide: columns 53 to 74 on rows 31 and 32.
  store().setTextSpec(text().id, { text: "Patternflow", x: 64, y: 32 });
});

describe("the @matrix line while typing", () => {
  it("holds the frame through every keystroke and applies 96x64 once the editor is left", () => {
    expect(lit(pixel())).toBe(8192);
    expect(lit(text())).toBe(44);

    for (const line of TYPING) {
      store().updateLayerCode(codeId(), withLine(line), { holdMatrix: true });
      expect(store().matrix).toEqual({ width: 128, height: 64 });
      expect(lit(pixel())).toBe(8192);
    }

    store().applyMatrixLine(codeId());
    expect(store().matrix).toEqual({ width: 96, height: 64 });
    expect(lit(pixel())).toBe(96 * 64);
    expect(text().spec.x).toBe(48);
    expect(lit(text())).toBe(44);

    // Leaving the editor again with the same line changes nothing.
    store().applyMatrixLine(codeId());
    expect(store().matrix).toEqual({ width: 96, height: 64 });
  });

  it("keeps a frame picked in Preview when the editor is left with the line as it was", () => {
    store().setMatrix({ width: 64, height: 64 });
    store().updateLayerCode(codeId(), `${withLine("// @matrix 128x64")}// tuned\n`, { holdMatrix: true });
    store().applyMatrixLine(codeId());
    expect(store().matrix).toEqual({ width: 64, height: 64 });
  });
});

describe("a line the Lab cannot read", () => {
  it("leaves the frame as it is, pasted or left in the editor", () => {
    store().updateLayerCode(codeId(), withLine("// @matrix 96x64"));
    expect(store().matrix).toEqual({ width: 96, height: 64 });

    for (const line of ["// @matrix 1x64", "// @matrix 600x64", "// matrix gone"]) {
      store().updateLayerCode(codeId(), withLine(line));
      expect(store().matrix).toEqual({ width: 96, height: 64 });
      expect(lit(pixel())).toBe(96 * 64);
    }

    store().updateLayerCode(codeId(), withLine("// @matrix 4x64"), { holdMatrix: true });
    store().applyMatrixLine(codeId());
    expect(store().matrix).toEqual({ width: 96, height: 64 });
    expect(text().spec.x).toBe(48);
  });
});

describe("a frame change and pixel undo", () => {
  it("brings back the columns a narrower @matrix line cut off", () => {
    store().updateLayerCode(codeId(), withLine("// @matrix 12x64"));
    store().updateLayerCode(codeId(), withLine("// @matrix 128x64"));
    expect(lit(pixel())).toBe(12 * 64);

    expect(undoPixels(pixel().id, pixel())).toBe(true);
    expect(lit(pixel())).toBe(12 * 64);
    expect(undoPixels(pixel().id, pixel())).toBe(true);
    expect(lit(pixel())).toBe(8192);
  });

  it("brings back the columns a narrower frame from Preview cut off", () => {
    store().setMatrix({ width: 12, height: 64 });
    store().setMatrix({ width: 128, height: 64 });
    expect(lit(pixel())).toBe(12 * 64);

    undoPixels(pixel().id, pixel());
    undoPixels(pixel().id, pixel());
    expect(lit(pixel())).toBe(8192);
  });
});
