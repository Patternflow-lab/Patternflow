// ── Text effects: the letters moving, frame by frame ─────────────────────────
// A text layer with an effect hands the compositor a new frame each tick,
// made from its bitmap or its source (types.ts TextSource) at a phase that
// one of the four knobs speeds up. These steps are written three times: here
// for the Lab preview (engine.ts), as JavaScript in the flattened export
// (flatten.ts) and as C++ in the firmware header (hExport.ts). Each pixel is
// whole-number work, and the one float, the phase, only ever adds
// dt × speed and takes a remainder, so the three light the same LEDs
// (textExport.test.ts holds them to it).
//
// Turned all the way down, the knob stops the effect where it is.

import type { TextEffect, TextLayer, TextSource } from "./types";

export type ActiveTextEffect = Exclude<TextEffect, "none">;

/**
 * Phase steps a second with the knob all the way up.
 *   scroll   pixels: a 128-wide panel crossed in a second
 *   twinkle  a beat is 256 steps, so two beats a second
 *   ramp     along the ramp and back is 512 steps, so once a second
 */
export const TEXT_EFFECT_RATE: Record<ActiveTextEffect, number> = {
  scroll: 128,
  twinkle: 512,
  ramp: 512,
};

/** A source is at most this many bytes: as much as the biggest frame (512 × 512) holds. */
const TEXT_SOURCE_MAX_BYTES = 512 * 512 * 4;

/**
 * How many columns a source may have on a frame this tall: never fewer than
 * the frame's, and 4096 on the 128 × 64 panel. Letters past that are left out.
 */
export function sourceColumnLimit(width: number, height: number): number {
  return Math.max(width, Math.floor(TEXT_SOURCE_MAX_BYTES / (height * 4)));
}

/**
 * A source as every reader takes it, or null when the frame would read none
 * of it. Columns past sourceColumnLimit are cut off, as text.ts leaves them
 * out of a line too long to hold. A scroll reads x only modulo the source's
 * width plus the frame's, so x is brought into one span that long, from the
 * source's own width out to the left up to the frame's right edge: the same
 * frames, and a number a reader can bound. A ramp reads x as it is, and one
 * wholly off the frame lights nothing. text.ts, a resize (store/shared.ts)
 * and serialize.ts all pass a source through here, so a save opens with the
 * source it was saved with.
 */
export function placeTextSource(
  source: TextSource,
  effect: "scroll" | "ramp",
  width: number,
  height: number,
): TextSource | null {
  const columns = Math.min(source.width, sourceColumnLimit(width, height));
  let data = source.data;
  if (columns < source.width) {
    data = new Uint8ClampedArray(columns * height * 4);
    for (let y = 0; y < height; y++) {
      const from = y * source.width * 4;
      data.set(source.data.subarray(from, from + columns * 4), y * columns * 4);
    }
  }
  if (effect === "ramp") {
    return source.x <= -columns || source.x >= width ? null : { x: source.x, width: columns, data };
  }
  const period = columns + width;
  const lead = (((width - source.x) % period) + period) % period;
  return { x: width - lead, width: columns, data };
}

const TWINKLE_PERIOD = 256;
const RAMP_PERIOD = 512;

/** A source the layer's frame can be read from: every row, at least one column. */
function sourceFits(source: TextSource | null, height: number): source is TextSource {
  return (
    source !== null &&
    Number.isInteger(source.x) &&
    Number.isInteger(source.width) &&
    source.width > 0 &&
    source.data.length === source.width * height * 4
  );
}

/**
 * The effect the layer actually runs, or null. Scroll and ramp need a source
 * that fits; without one (no letter on the frame, a save from a build that
 * did not keep it) the layer shows its bitmap as it is, and the exports do
 * the same.
 */
export function activeTextEffect(layer: TextLayer): ActiveTextEffect | null {
  const effect = layer.spec.effect;
  if (effect === "none") return null;
  if (effect === "twinkle") return "twinkle";
  return sourceFits(layer.source, layer.height) ? effect : null;
}

/**
 * What the effect draws each frame from: twinkle the bitmap as it stands,
 * scroll and ramp the source. Null when that source does not fit, and then
 * activeTextEffect is null too. flatten.ts and hExport.ts write this out
 * for the exports.
 */
export function textEffectSource(layer: TextLayer, effect: ActiveTextEffect): TextSource | null {
  if (effect === "twinkle") return { x: 0, width: layer.width, data: layer.data };
  return sourceFits(layer.source, layer.height) ? layer.source : null;
}

/** How many steps the phase counts before it starts again. */
export function textEffectPeriod(effect: ActiveTextEffect, layer: TextLayer): number {
  if (effect === "twinkle") return TWINKLE_PERIOD;
  if (effect === "ramp") return RAMP_PERIOD;
  // Scroll: the letters' own width out to the left, then the frame's width
  // coming back in from the right.
  return (layer.source?.width ?? 0) + layer.width;
}

/**
 * The phase after `dt` seconds with the knob at `knob` (0..1 of its range).
 * flatten.ts and hExport.ts write this same sum, in this order.
 */
export function advanceTextPhase(phase: number, dt: number, knob: number, rate: number, period: number): number {
  const n = knob > 0 ? (knob < 1 ? knob : 1) : 0;
  let next = phase + dt * (n * rate);
  if (!(next >= 0)) next = 0;
  else if (next >= period) next %= period;
  return next;
}

/** A byte per LED for the twinkle's beat, the same on every renderer: 32-bit multiplies and shifts. */
export function twinkleHash(x: number, y: number): number {
  let h = Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h & 255;
}

/**
 * Draw the layer's frame at `phase` into `out` (width × height × 4 of the
 * layer). `lut` is the layer's ramp as 256 RGBA entries; only ramp reads it.
 * The effect must be `activeTextEffect(layer)`.
 */
export function renderTextEffect(
  layer: TextLayer,
  effect: ActiveTextEffect,
  phase: number,
  lut: Uint8Array | null,
  out: Uint8ClampedArray,
): void {
  const { width, height } = layer;
  const step = Math.floor(phase);

  if (effect === "twinkle") {
    // Each lit LED runs a triangle beat from full to about a quarter and back,
    // started at its own place in it. Alpha carries the dimming, so over
    // another layer the letters fade towards it rather than to black.
    const data = layer.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const j = (y * width + x) * 4;
        const a = data[j + 3];
        out[j] = data[j];
        out[j + 1] = data[j + 1];
        out[j + 2] = data[j + 2];
        if (a === 0) {
          out[j + 3] = 0;
          continue;
        }
        const u = (step + twinkleHash(x, y)) & 255;
        const tri = u < 128 ? u : 255 - u;
        const k = 255 - tri - (tri >> 1);
        out[j + 3] = Math.floor((a * k + 127) / 255);
      }
    }
    return;
  }

  // activeTextEffect names scroll or ramp only for a source that fits.
  const source = layer.source;
  if (!sourceFits(source, height)) return;
  const src = source.data;
  const srcWidth = source.width;

  if (effect === "scroll") {
    // m counts the columns the letters have travelled, from out of sight on
    // the right; at phase 0 they sit where the Text panel put them.
    const period = srcWidth + width;
    const lead = width - source.x;
    const m = (((step + lead) % period) + period) % period;
    const shift = m - width;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const j = (y * width + x) * 4;
        const c = x + shift;
        if (c < 0 || c >= srcWidth) {
          out[j] = out[j + 1] = out[j + 2] = out[j + 3] = 0;
          continue;
        }
        const i = (y * srcWidth + c) * 4;
        out[j] = src[i];
        out[j + 1] = src[i + 1];
        out[j + 2] = src[i + 2];
        out[j + 3] = src[i + 3];
      }
    }
    return;
  }

  // Ramp: each pixel's place on the ramp moves on by the step, there and
  // back, so the colours never jump from the ramp's end to its start. At
  // phase 0 this is text.ts paintText exactly.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 4;
      const c = x - source.x;
      const i = (y * srcWidth + c) * 4;
      const a = c < 0 || c >= srcWidth ? 0 : src[i + 3];
      if (a === 0 || !lut) {
        out[j] = out[j + 1] = out[j + 2] = out[j + 3] = 0;
        continue;
      }
      const u = (src[i] + step) & 511;
      const k = (u < 256 ? u : 511 - u) * 4;
      out[j] = lut[k];
      out[j + 1] = lut[k + 1];
      out[j + 2] = lut[k + 2];
      out[j + 3] = Math.floor((a * lut[k + 3] + 127) / 255);
    }
  }
}
