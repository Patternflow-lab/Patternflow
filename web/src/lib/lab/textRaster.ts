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

/**
 * Coverage per pixel, row-major, or null where there is no canvas to draw on
 * (the server, a test without one).
 *
 * Each line's left edge and the block's top are rounded to whole pixels
 * before drawing. Letting the canvas centre a line puts a pixel font's stems
 * on half pixels whenever the line is an odd number of pixels wide, and the
 * sharp edges then drop or double a column.
 */
export function textCoverage(
  spec: TextSpec,
  fontCss: string,
  width: number,
  height: number,
): Uint8ClampedArray | null {
  if (typeof document === "undefined") return null;
  scratch ??= document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const context = scratch.getContext("2d", { willReadFrequently: true });
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
    const lineWidth = context.measureText(line).width;
    const left =
      spec.align === "left"
        ? Math.round(spec.x)
        : spec.align === "right"
          ? Math.round(spec.x - lineWidth)
          : Math.round(spec.x - lineWidth / 2);
    context.fillText(line, left, top + index * spec.size);
  });

  const pixels = context.getImageData(0, 0, width, height).data;
  const coverage = new Uint8ClampedArray(width * height);
  for (let i = 0; i < coverage.length; i++) coverage[i] = pixels[i * 4 + 3];
  return coverage;
}
