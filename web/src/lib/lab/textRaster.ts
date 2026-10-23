// ── Text coverage on a canvas ────────────────────────────────────────────────
// The one browser-only step of drawing a text layer: the font lays the words
// out on a canvas the size of the frame, and what comes back is how much of
// each LED the letters cover, 0..255. lib/lab/text.ts turns that into colour.
// Kept apart so the colouring can be tested without a canvas.

import type { TextSpec } from "./types";

let scratch: HTMLCanvasElement | null = null;

/** Lines, top to bottom. An empty text draws nothing. */
export function textLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

function context2d(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  scratch ??= document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  return scratch.getContext("2d", { willReadFrequently: true });
}

/** Where a line starts, in whole frame pixels, given how wide the font sets it. */
function lineLeft(spec: TextSpec, lineWidth: number): number {
  return spec.align === "left"
    ? Math.round(spec.x)
    : spec.align === "right"
      ? Math.round(spec.x - lineWidth)
      : Math.round(spec.x - lineWidth / 2);
}

/**
 * The frame columns the lines reach, from the first to one past the last,
 * with a pixel to spare on each side for a glyph that leans out of its box.
 * Null where there is no canvas, or no letters.
 */
export function textReach(spec: TextSpec, fontCss: string): { left: number; right: number } | null {
  const context = context2d(1, 1);
  if (!context) return null;
  context.font = `${spec.size}px ${fontCss}`;
  let left = Infinity;
  let right = -Infinity;
  for (const line of textLines(spec.text)) {
    if (!line) continue;
    const metrics = context.measureText(line);
    const start = lineLeft(spec, metrics.width);
    left = Math.min(left, start - Math.max(0, metrics.actualBoundingBoxLeft || 0));
    right = Math.max(right, start + Math.max(metrics.width, metrics.actualBoundingBoxRight || 0));
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return { left: Math.floor(left) - 1, right: Math.ceil(right) + 1 };
}

/**
 * Coverage per pixel in rows from the top, for `width` columns from frame
 * column `left`. Null where there is no canvas to draw on: the server, a
 * test without one.
 *
 * Each line's left edge and the block's top are rounded to whole pixels
 * before drawing. Letting the canvas centre a line puts a pixel font's stems
 * on half pixels whenever the line is an odd number of pixels wide, and the
 * sharp edges then drop or double a column. `left` is whole too, so a strip
 * wider than the frame covers each LED the frame shares with it exactly as
 * the frame does.
 */
export function textCoverage(
  spec: TextSpec,
  fontCss: string,
  width: number,
  height: number,
  left = 0,
): Uint8ClampedArray | null {
  const context = context2d(width, height);
  if (!context) return null;

  context.clearRect(0, 0, width, height);
  context.font = `${spec.size}px ${fontCss}`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#ffffff";

  const lines = textLines(spec.text);
  const top = Math.round(spec.y - (lines.length * spec.size) / 2);
  lines.forEach((line, index) => {
    if (!line) return;
    context.fillText(line, lineLeft(spec, context.measureText(line).width) - left, top + index * spec.size);
  });

  const pixels = context.getImageData(0, 0, width, height).data;
  const coverage = new Uint8ClampedArray(width * height);
  for (let i = 0; i < coverage.length; i++) coverage[i] = pixels[i * 4 + 3];
  return coverage;
}
