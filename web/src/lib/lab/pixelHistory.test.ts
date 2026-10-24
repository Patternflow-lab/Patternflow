// Pixel undo frames across a matrix resize. Until 16 October 2026 a frame was a
// bare buffer, so undo after shrinking the matrix threw a RangeError from
// Uint8ClampedArray.set, and undo after growing it wrote the old rows across
// the new, wider ones.

import { beforeEach, describe, expect, it } from "vitest";
import { MAX_UNDO, prunePixelHistories, redoPixels, snapshotPixels, undoPixels } from "./pixelHistory";
import { resizeSurface, type PixelSurface, type RGBA } from "./pixelTools";

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

function blank(width: number, height: number): PixelSurface {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

function paint(surface: PixelSurface, x: number, y: number, color: RGBA): void {
  surface.data.set(color, (y * surface.width + x) * 4);
}

function rgba(surface: PixelSurface, x: number, y: number): number[] {
  const i = (y * surface.width + x) * 4;
  return Array.from(surface.data.subarray(i, i + 4));
}

// What resizePixelLayers does to a layer: a new buffer, same id.
function resized(surface: PixelSurface, width: number, height: number): PixelSurface {
  return { data: resizeSurface(surface.data, surface.width, surface.height, width, height), width, height };
}

beforeEach(() => prunePixelHistories([]));

describe("pixel undo", () => {
  it("undo and redo at one size", () => {
    const layer = blank(3, 3);
    snapshotPixels("a", layer);
    paint(layer, 1, 1, RED);
    expect(undoPixels("a", layer)).toBe(true);
    expect(rgba(layer, 1, 1)).toEqual(CLEAR);
    expect(redoPixels("a", layer)).toBe(true);
    expect(rgba(layer, 1, 1)).toEqual(RED);
    expect(redoPixels("a", layer)).toBe(false);
  });

  it("after the matrix shrinks, undo puts the frame back cropped to the new size", () => {
    const layer = blank(4, 2);
    paint(layer, 1, 0, RED);
    snapshotPixels("a", layer);
    paint(layer, 2, 1, BLUE);
    // 4×2 to 2×2 keeps the middle two columns: x 1 becomes 0, x 2 becomes 1
    const small = resized(layer, 2, 2);
    expect(rgba(small, 1, 1)).toEqual(BLUE);

    expect(undoPixels("a", small)).toBe(true);
    expect(rgba(small, 0, 0)).toEqual(RED);
    expect(rgba(small, 1, 1)).toEqual(CLEAR);
    expect(redoPixels("a", small)).toBe(true);
    expect(rgba(small, 1, 1)).toEqual(BLUE);
  });

  it("after the matrix grows, undo puts the old rows back centred", () => {
    const layer = blank(2, 1);
    paint(layer, 0, 0, RED);
    paint(layer, 1, 0, BLUE);
    snapshotPixels("a", layer);
    paint(layer, 1, 0, RED);
    // 2×1 to 4×3 pads one pixel on each side: the row lands at y 1, x 1 and 2
    const big = resized(layer, 4, 3);

    expect(undoPixels("a", big)).toBe(true);
    const expected = blank(4, 3);
    paint(expected, 1, 1, RED);
    paint(expected, 2, 1, BLUE);
    expect(Array.from(big.data)).toEqual(Array.from(expected.data));
  });

  it("frames from both sides of a resize come back in order", () => {
    const layer = blank(4, 2);
    snapshotPixels("a", layer);
    paint(layer, 1, 0, RED);
    const small = resized(layer, 2, 2);
    snapshotPixels("a", small);
    paint(small, 1, 1, BLUE);

    expect(undoPixels("a", small)).toBe(true);
    expect(rgba(small, 0, 0)).toEqual(RED);
    expect(rgba(small, 1, 1)).toEqual(CLEAR);
    expect(undoPixels("a", small)).toBe(true);
    expect(rgba(small, 0, 0)).toEqual(CLEAR);
    expect(undoPixels("a", small)).toBe(false);
  });

  it("redo after a resize between the undo and the redo", () => {
    const layer = blank(4, 2);
    snapshotPixels("a", layer);
    paint(layer, 2, 1, BLUE);
    undoPixels("a", layer);
    const small = resized(layer, 2, 2);

    expect(redoPixels("a", small)).toBe(true);
    expect(rgba(small, 1, 1)).toEqual(BLUE);
  });

  it(`keeps the last ${MAX_UNDO} frames`, () => {
    const layer = blank(1, 1);
    for (let i = 0; i <= MAX_UNDO; i++) snapshotPixels("a", layer);
    for (let i = 0; i < MAX_UNDO; i++) expect(undoPixels("a", layer)).toBe(true);
    expect(undoPixels("a", layer)).toBe(false);
  });

  it("prune drops the stacks of layers that are gone", () => {
    const layer = blank(1, 1);
    snapshotPixels("kept", layer);
    snapshotPixels("gone", layer);
    prunePixelHistories(["kept"]);
    expect(undoPixels("gone", layer)).toBe(false);
    expect(undoPixels("kept", layer)).toBe(true);
  });
});

// Since 24 October 2026 a frame change snapshots the layer before it crops or
// pads it (resizePixelLayers). Right after the change that snapshot is the
// picture as it is, so undo goes past it, and only past that kind.
describe("pixel undo across a frame change's snapshot", () => {
  it("goes past one that changes nothing, to the stroke before", () => {
    const layer = blank(4, 2);
    snapshotPixels("a", layer);
    paint(layer, 1, 0, RED);
    snapshotPixels("a", layer, true);
    const small = resized(layer, 2, 2);

    expect(undoPixels("a", small)).toBe(true);
    expect(rgba(small, 0, 0)).toEqual(CLEAR);
    expect(redoPixels("a", small)).toBe(true);
    expect(rgba(small, 0, 0)).toEqual(RED);
  });

  it("restores one that brings back what a smaller frame cut off", () => {
    const layer = blank(4, 2);
    paint(layer, 0, 0, RED);
    snapshotPixels("a", layer, true);
    const small = resized(layer, 2, 2);
    snapshotPixels("a", small, true);
    const grown = resized(small, 4, 2);
    expect(rgba(grown, 0, 0)).toEqual(CLEAR);

    expect(undoPixels("a", grown)).toBe(true);
    expect(rgba(grown, 0, 0)).toEqual(RED);
  });

  it("still takes a stroke's snapshot that changes nothing as a step", () => {
    // Esc on a selection lifted from empty pixels undoes the lift, and only it.
    const layer = blank(2, 2);
    snapshotPixels("a", layer);
    paint(layer, 1, 1, BLUE);
    snapshotPixels("a", layer);

    expect(undoPixels("a", layer)).toBe(true);
    expect(rgba(layer, 1, 1)).toEqual(BLUE);
  });
});
