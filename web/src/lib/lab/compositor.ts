// ── Layer compositor ─────────────────────────────────────────────────────────
// Straight-alpha painter's algorithm over an opaque black base (the physical
// LED panel is black when off). Blend modes are limited to what the firmware
// can afford per pixel; the flattened JS export and the C++ header replicate
// this math 1:1, so keep the three in sync (see flatten.ts and hExport.ts).

import type { BlendMode, Layer } from "./types";

export type CompositeEntry = {
  /** Straight RGBA bytes, width × height × 4 — same frame as the target. */
  data: Uint8ClampedArray;
  opacity: number; // 0..1
  blend: BlendMode;
  /** Binary per-pixel coverage from mask layers: 0 hides the pixel entirely. */
  mask?: Uint8Array;
};

/**
 * The layers an export carries, bottom → top (layers[0] is the top, as in the
 * Layers panel): the visible ones, less each paint layer at 0% and the masks
 * resting on it. A mask over a 0% layer gates nothing. Dropping the 0% layer
 * alone would hand its masks to the next paint layer down, which the preview
 * (engine.ts buildEntries) never does. flatten.ts and hExport.ts both export
 * this stack, so the two can't drift apart.
 */
export function exportStack(layers: Layer[]): Layer[] {
  const stack: Layer[] = [];
  let overZero = false;
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index];
    if (!layer.visible) continue;
    if (layer.role === "mask") {
      if (!overZero) stack.push(layer);
      continue;
    }
    overZero = !(layer.opacity > 0);
    if (!overZero) stack.push(layer);
  }
  return stack;
}

/**
 * AND one mask layer's buffer into a coverage bitmap (1 byte per pixel).
 * Pixel-art masks switch on wherever something was drawn (alpha ≥ 0.5);
 * code masks switch on where luminance × alpha crosses 0.5 — so the layer's
 * color ramp tunes the mask. Keep this math in sync with flatten.ts.
 */
export function applyMaskToCoverage(
  coverage: Uint8Array,
  data: Uint8ClampedArray,
  isPixelLayer: boolean,
  invert: boolean,
  pixelCount: number,
) {
  for (let i = 0; i < pixelCount; i++) {
    if (coverage[i] === 0) continue;
    const j = i * 4;
    let on: boolean;
    if (isPixelLayer) {
      on = data[j + 3] >= 128;
    } else {
      const alpha = data[j + 3] / 255;
      on = (0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]) * alpha >= 127.5;
    }
    if (invert) on = !on;
    if (!on) coverage[i] = 0;
  }
}

/**
 * Blend entries bottom → top over opaque black. Each pixel adds up in floats
 * and is rounded and clamped to a byte once, after the top layer — the order
 * flatten.ts and hExport.ts use. Two add layers at (200, 0, 0) carry R = 400
 * into a multiply above them, so (128, 128, 128) leaves 201 rather than 128.
 */
export function compositeLayers(
  out: Uint8ClampedArray,
  entries: CompositeEntry[],
  pixelCount: number,
) {
  const opacities = entries.map((entry) => Math.max(0, Math.min(1, entry.opacity)));

  for (let i = 0; i < pixelCount; i++) {
    const j = i * 4;
    let r = 0;
    let g = 0;
    let b = 0;

    for (let e = 0; e < entries.length; e++) {
      const opacity = opacities[e];
      if (opacity <= 0) continue;
      const entry = entries[e];
      if (entry.mask && entry.mask[i] === 0) continue;
      const source = entry.data;
      const alpha = (source[j + 3] / 255) * opacity;
      if (alpha <= 0) continue;
      const sr = source[j];
      const sg = source[j + 1];
      const sb = source[j + 2];
      const inv = 1 - alpha;

      if (entry.blend === "add") {
        r += sr * alpha;
        g += sg * alpha;
        b += sb * alpha;
      } else if (entry.blend === "multiply") {
        r = r * inv + ((r * sr) / 255) * alpha;
        g = g * inv + ((g * sg) / 255) * alpha;
        b = b * inv + ((b * sb) / 255) * alpha;
      } else if (entry.blend === "screen") {
        r = r * inv + (255 - ((255 - r) * (255 - sr)) / 255) * alpha;
        g = g * inv + (255 - ((255 - g) * (255 - sg)) / 255) * alpha;
        b = b * inv + (255 - ((255 - b) * (255 - sb)) / 255) * alpha;
      } else {
        r = r * inv + sr * alpha;
        g = g * inv + sg * alpha;
        b = b * inv + sb * alpha;
      }
    }

    // Math.round, not the array's own round-half-to-even: the export's
    // setPixel rounds this way, and the header's (int)(c + 0.5) does too.
    out[j] = Math.min(255, Math.round(r));
    out[j + 1] = Math.min(255, Math.round(g));
    out[j + 2] = Math.min(255, Math.round(b));
    out[j + 3] = 255; // the base is opaque
  }
}
