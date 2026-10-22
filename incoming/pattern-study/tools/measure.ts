/**
 * What the map puts each pattern by. Every number comes from frames the Lab
 * engine rendered (lab.ts), at the knobs a paste starts on, so moving a
 * pattern on the map means changing the pattern, never retyping a score.
 */
import zlib from "node:zlib";

import type { Frame } from "./lab";

export type Measures = {
  /** Luminance change per second, 0..1 of full scale, averaged over pixels. */
  motion: number;
  /** Mean step between neighbouring pixels, 0..1. Coarse shapes are low, fine texture high. */
  detail: number;
  /** Of the steps that are there, the share that are hard edges rather than gradients, 0..1. */
  edges: number;
  /** Deflated bytes per pixel of one frame: a ruled grid packs small, noise does not. */
  complexity: number;
  /** Share of LEDs lit above 24 of 255. */
  coverage: number;
  /** Hasler and Süsstrunk's colourfulness, 0..1. */
  colour: number;
  /** How much the picture itself changes over the run, beyond pixels flickering: 0 is a loop that holds still in layout. */
  drift: number;
};

const luma = (rgb: Uint8Array, p: number) => 0.2126 * rgb[p * 3] + 0.7152 * rgb[p * 3 + 1] + 0.0722 * rgb[p * 3 + 2];

export function measure(frames: Frame[], width: number, height: number, fps: number): Measures {
  const pixels = width * height;
  let motion = 0;
  let detail = 0;
  let soft = 0;
  let hard = 0;
  let complexity = 0;
  let coverage = 0;
  let colour = 0;
  let previous: Float32Array | null = null;
  const lumas: Float32Array[] = [];

  for (const frame of frames) {
    const L = new Float32Array(pixels);
    for (let p = 0; p < pixels; p++) L[p] = luma(frame.rgb, p);
    lumas.push(L);

    if (previous) {
      let change = 0;
      for (let p = 0; p < pixels; p++) change += Math.abs(L[p] - previous[p]);
      motion += change / pixels / 255;
    }
    previous = L;

    let steps = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const here = L[y * width + x];
        for (const there of [x + 1 < width ? L[y * width + x + 1] : null, y + 1 < height ? L[(y + 1) * width + x] : null]) {
          if (there === null) continue;
          const step = Math.abs(here - there);
          steps += step;
          if (step > 40) hard++;
          else if (step > 6) soft++;
        }
      }
    }
    detail += steps / (2 * pixels) / 255;

    complexity += zlib.deflateSync(frame.rgb, { level: 9 }).length / pixels;

    let lit = 0;
    let sumRg = 0;
    let sumYb = 0;
    let sumRg2 = 0;
    let sumYb2 = 0;
    for (let p = 0; p < pixels; p++) {
      const r = frame.rgb[p * 3];
      const g = frame.rgb[p * 3 + 1];
      const b = frame.rgb[p * 3 + 2];
      if (Math.max(r, g, b) > 24) lit++;
      const rg = r - g;
      const yb = 0.5 * (r + g) - b;
      sumRg += rg;
      sumYb += yb;
      sumRg2 += rg * rg;
      sumYb2 += yb * yb;
    }
    coverage += lit / pixels;
    const muRg = sumRg / pixels;
    const muYb = sumYb / pixels;
    const sd = Math.sqrt(Math.max(0, sumRg2 / pixels - muRg * muRg) + Math.max(0, sumYb2 / pixels - muYb * muYb));
    colour += (sd + 0.3 * Math.sqrt(muRg * muRg + muYb * muYb)) / 255;
  }

  // Drift: blur each frame to 16×8 blocks and see how far the blocks travel
  // from the first frame. Sparkle averages out inside a block; a layout that
  // rolls, grows or wanders does not.
  const bw = 16;
  const bh = 8;
  const blocks = (L: Float32Array) => {
    const out = new Float32Array(bw * bh);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) out[Math.floor((y * bh) / height) * bw + Math.floor((x * bw) / width)] += L[y * width + x];
    const per = (width / bw) * (height / bh) * 255;
    for (let i = 0; i < out.length; i++) out[i] /= per;
    return out;
  };
  const first = blocks(lumas[0]);
  let drift = 0;
  for (const L of lumas.slice(1)) {
    const b = blocks(L);
    let d = 0;
    for (let i = 0; i < b.length; i++) d += Math.abs(b[i] - first[i]);
    drift = Math.max(drift, d / b.length);
  }

  const n = frames.length;
  return {
    motion: (motion / Math.max(1, n - 1)) * fps,
    detail: detail / n,
    edges: hard + soft > 0 ? hard / (hard + soft) : 0,
    complexity: complexity / n,
    coverage: coverage / n,
    colour: colour / n,
    drift,
  };
}

/** Mean RGB difference of two frames, 0..1. */
export function difference(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length / 255;
}
