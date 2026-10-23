// ── Text layers: from words to an RGBA bitmap ────────────────────────────────
// A text layer is drawn once per change, not per frame. The canvas measures
// how much of each LED the letters cover (textRaster.ts); this file colours
// that coverage into the same straight-RGBA bitmap a pixel layer holds. From
// there on a text layer IS pixel art to the compositor, the masks, the
// Graphic Export stage and both exports: what the device runs never needs
// the font (flatten.ts and hExport.ts carry the bitmap).

import { buildRampLUTRGBA } from "@/lib/pattern/harness";
import { hexToRgb } from "@/lib/pattern/color";
import { rampStateToHarness } from "./engine";
import { ensureFontReady, resolveFont } from "./textFonts";
import { textCoverage } from "./textRaster";
import type { RampState, TextLayer, TextSpec } from "./types";

export type InkBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** The box around every lit pixel, or null when nothing is lit. */
export function inkBounds(alpha: Uint8ClampedArray, width: number, height: number): InkBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * Colour a coverage map into straight RGBA.
 *
 * Sharp: a pixel is lit when the letters cover half of it or more, then fully.
 * Soft: the coverage is the alpha, so an edge is a dimmer LED.
 * A ramp fill runs from the first lit column to the last (rampX) or the
 * first lit row to the last (rampY), so the whole ramp spans the word wherever
 * it sits; the ramp's own alpha multiplies in.
 */
export function paintText(
  coverage: Uint8ClampedArray,
  spec: Pick<TextSpec, "color" | "fill" | "sharp">,
  ramp: RampState,
  width: number,
  height: number,
): Uint8ClampedArray {
  const count = width * height;
  const alpha = new Uint8ClampedArray(count);
  for (let i = 0; i < count; i++) {
    const a = coverage[i] ?? 0;
    alpha[i] = spec.sharp ? (a >= 128 ? 255 : 0) : a;
  }

  const out = new Uint8ClampedArray(count * 4);
  const bounds = inkBounds(alpha, width, height);
  if (!bounds) return out;

  const solid = hexToRgb(spec.color);
  const lut = spec.fill === "solid" ? null : buildRampLUTRGBA(rampStateToHarness(ramp));
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = alpha[i];
      if (a === 0) continue;
      const j = i * 4;
      if (!lut) {
        out[j] = solid[0];
        out[j + 1] = solid[1];
        out[j + 2] = solid[2];
        out[j + 3] = a;
        continue;
      }
      const t = spec.fill === "rampX" ? (x - bounds.minX) / spanX : (y - bounds.minY) / spanY;
      const k = Math.round(Math.max(0, Math.min(1, t)) * 255) * 4;
      out[j] = lut[k];
      out[j + 1] = lut[k + 1];
      out[j + 2] = lut[k + 2];
      out[j + 3] = Math.round((a * lut[k + 3]) / 255);
    }
  }
  return out;
}

/**
 * The layer drawn again from its spec and ramp at its own size. Where there
 * is no canvas (the server, a test) the bitmap stays as it was. A font still
 * on its way draws with the fallback now and again when it lands
 * (store.ts listens to textFonts).
 */
export function drawTextLayer(layer: TextLayer): TextLayer {
  const font = resolveFont(layer.spec.font);
  ensureFontReady(layer.spec.font, layer.spec.size);
  const coverage = textCoverage(layer.spec, font.css, layer.width, layer.height);
  const size = layer.width * layer.height * 4;
  const data = coverage
    ? paintText(coverage, layer.spec, layer.ramp, layer.width, layer.height)
    : layer.data.length === size
      ? layer.data
      : new Uint8ClampedArray(size);
  return { ...layer, data, rev: layer.rev + 1 };
}
