// ── Text layers: from words to an RGBA bitmap ────────────────────────────────
// A text layer is drawn once per change, not per frame. The canvas measures
// how much of each LED the letters cover (textRaster.ts); this file colours
// that coverage into the same straight-RGBA bitmap a pixel layer holds. From
// there on a text layer IS pixel art to the compositor, the masks, the
// Graphic Export stage and both exports: what the device runs never needs
// the font (flatten.ts and hExport.ts carry the bitmap).
//
// A layer that scrolls or runs its ramp is drawn once more, into its source
// (types.ts TextSource): the whole of each line, past the frame's edges, which
// textEffects.ts turns into a frame per tick. Its bitmap is then that frame
// at phase 0, so the Layers panel, Copy as code and a save show the letters
// where the effect starts them.

import { buildRampLUTRGBA } from "@/lib/pattern/harness";
import { hexToRgb } from "@/lib/pattern/color";
import { rampStateToHarness } from "./engine";
import { placeTextSource, renderTextEffect, sourceColumnLimit } from "./textEffects";
import { ensureFontReady, resolveFont } from "./textFonts";
import { textCoverage, textReach } from "./textRaster";
import type { RampState, TextLayer, TextSource, TextSpec } from "./types";

type InkBounds = { minX: number; minY: number; maxX: number; maxY: number };

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

/** Coverage as the alpha a pixel shows: all or nothing when sharp. */
function textAlpha(coverage: Uint8ClampedArray, sharp: boolean, count: number): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(count);
  for (let i = 0; i < count; i++) {
    const a = coverage[i] ?? 0;
    alpha[i] = sharp ? (a >= 128 ? 255 : 0) : a;
  }
  return alpha;
}

/**
 * Where each pixel sits on the ramp, 0..255: from the first lit column to
 * the last (rampX) or the first lit row to the last (rampY). Null for solid.
 */
function rampPlace(fill: TextSpec["fill"], bounds: InkBounds): ((x: number, y: number) => number) | null {
  if (fill === "solid") return null;
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  return (x, y) => {
    const t = fill === "rampX" ? (x - bounds.minX) / spanX : (y - bounds.minY) / spanY;
    return Math.round(Math.max(0, Math.min(1, t)) * 255);
  };
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
  const alpha = textAlpha(coverage, spec.sharp, count);
  const out = new Uint8ClampedArray(count * 4);
  const bounds = inkBounds(alpha, width, height);
  if (!bounds) return out;

  const solid = hexToRgb(spec.color);
  const place = rampPlace(spec.fill, bounds);
  const lut = place ? buildRampLUTRGBA(rampStateToHarness(ramp)) : null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = alpha[i];
      if (a === 0) continue;
      const j = i * 4;
      if (!place || !lut) {
        out[j] = solid[0];
        out[j + 1] = solid[1];
        out[j + 2] = solid[2];
        out[j + 3] = a;
        continue;
      }
      const k = place(x, y) * 4;
      out[j] = lut[k];
      out[j + 1] = lut[k + 1];
      out[j + 2] = lut[k + 2];
      out[j + 3] = Math.round((a * lut[k + 3]) / 255);
    }
  }
  return out;
}

/**
 * The ramp effect's source from a coverage map: red is each pixel's place
 * on the ramp (0 everywhere for a solid fill, so the whole word changes
 * colour at once), alpha is how much the letters cover it. Unlit pixels are
 * all zero, so a run of them packs into one RLE entry.
 */
export function rampSource(
  coverage: Uint8ClampedArray,
  spec: Pick<TextSpec, "fill" | "sharp">,
  width: number,
  height: number,
): Uint8ClampedArray {
  const count = width * height;
  const alpha = textAlpha(coverage, spec.sharp, count);
  const out = new Uint8ClampedArray(count * 4);
  const bounds = inkBounds(alpha, width, height);
  if (!bounds) return out;
  const place = rampPlace(spec.fill, bounds);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alpha[i] === 0) continue;
      out[i * 4] = place ? place(x, y) : 0;
      out[i * 4 + 3] = alpha[i];
    }
  }
  return out;
}

/**
 * Cut a coverage strip down to the columns something is lit in, by the
 * layer's sharpness. Null when nothing is.
 */
function cropToLetters(
  coverage: Uint8ClampedArray,
  sharp: boolean,
  left: number,
  width: number,
  height: number,
): { x: number; width: number; coverage: Uint8ClampedArray } | null {
  const bounds = inkBounds(textAlpha(coverage, sharp, width * height), width, height);
  if (!bounds) return null;
  const cropWidth = bounds.maxX - bounds.minX + 1;
  const cropped = new Uint8ClampedArray(cropWidth * height);
  for (let y = 0; y < height; y++) {
    const from = y * width + bounds.minX;
    cropped.set(coverage.subarray(from, from + cropWidth), y * cropWidth);
  }
  return { x: left + bounds.minX, width: cropWidth, coverage: cropped };
}

/**
 * The scroll or ramp source for a spec, or null when no letter lands in it
 * (or, for a ramp, none on the frame). Undefined where there is no canvas
 * to draw on.
 */
function drawTextSource(
  spec: TextSpec,
  effect: "scroll" | "ramp",
  ramp: RampState,
  fontCss: string,
  width: number,
  height: number,
): TextSource | null | undefined {
  const reach = textReach(spec, fontCss);
  if (!reach) return undefined;
  const columns = Math.min(reach.right - reach.left, sourceColumnLimit(width, height));
  if (columns <= 0) return null;
  const coverage = textCoverage(spec, fontCss, columns, height, reach.left);
  if (!coverage) return undefined;
  const letters = cropToLetters(coverage, spec.sharp, reach.left, columns, height);
  if (!letters) return null;
  const data =
    effect === "ramp"
      ? rampSource(letters.coverage, spec, letters.width, height)
      : paintText(letters.coverage, spec, ramp, letters.width, height);
  return placeTextSource({ x: letters.x, width: letters.width, data }, effect, width, height);
}

/**
 * The layer drawn again from its spec and ramp at its own size. Where there
 * is no canvas (the server, a test) the bitmap stays as it was. A font still
 * on its way draws with the fallback now and again when it lands
 * (store.ts listens to textFonts).
 */
export function drawTextLayer(layer: TextLayer): TextLayer {
  const { spec, width, height } = layer;
  const font = resolveFont(spec.font);
  ensureFontReady(spec.font, spec.size);
  const size = width * height * 4;
  const kept = layer.data.length === size ? layer.data : new Uint8ClampedArray(size);

  if (spec.effect === "scroll" || spec.effect === "ramp") {
    const source = drawTextSource(spec, spec.effect, layer.ramp, font.css, width, height);
    if (source === undefined) return { ...layer, data: kept, rev: layer.rev + 1 };
    const next: TextLayer = { ...layer, source, data: new Uint8ClampedArray(size), rev: layer.rev + 1 };
    if (source) {
      const lut = spec.effect === "ramp" ? buildRampLUTRGBA(rampStateToHarness(layer.ramp)) : null;
      renderTextEffect(next, spec.effect, 0, lut, next.data);
    }
    return next;
  }

  const coverage = textCoverage(spec, font.css, width, height);
  const data = coverage ? paintText(coverage, spec, layer.ramp, width, height) : kept;
  return { ...layer, data, source: coverage ? null : layer.source, rev: layer.rev + 1 };
}
