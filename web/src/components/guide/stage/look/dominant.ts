// The dominant colour of what the panel shows. (No three.js here: the page's
// own bundle reads a frame with this before the stage has loaded.)
//
// It used to be a mean — every coloured LED's colour, weighed by how coloured
// and how bright it was. A mean of one colour is that colour; a mean of two
// is neither. Blue squares with an orange slider over them gave the page a
// salmon pink that was nowhere on the panel, and as the squares and the
// slider traded places the page hopped between pink, lilac and sky.
//
// So the hues are counted instead: a histogram of 24 bins round the wheel,
// each LED adding its weight (how coloured × how bright) to its hue's bin,
// and the colour that is handed on is the one in the fullest bin — a colour
// that is on the panel. Two things keep it from flickering between two bins
// that are nearly as full: a bin's count includes half of each neighbour's
// (a hue that falls on a bin's edge is not split in two), and the bin that
// was the fullest last time stays the answer until another beats it by a
// quarter.

export const HUE_BINS = 24;
/** Another hue takes over when its bin is this many times as full as the one held. */
const TAKE_OVER = 1.25;

export type HueHistogram = {
  w: Float32Array;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  /** The bin held from the last read (−1: none yet). */
  held: number;
};

export function hueHistogram(): HueHistogram {
  return { w: new Float32Array(HUE_BINS), r: new Float32Array(HUE_BINS), g: new Float32Array(HUE_BINS), b: new Float32Array(HUE_BINS), held: -1 };
}

export function clearHues(h: HueHistogram) {
  h.w.fill(0);
  h.r.fill(0);
  h.g.fill(0);
  h.b.fill(0);
}

/**
 * Count one LED: `r`, `g`, `b` on any one scale (0…1 or 0…255, light or
 * bytes — the answer comes back on the same), `w` its weight. Returns nothing;
 * a grey LED (no hue) is not counted.
 */
export function addHue(h: HueHistogram, r: number, g: number, b: number, w: number) {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  const d = max - min;
  if (d <= 0 || w <= 0) return;
  // The hue, in sixths of the wheel: 0 red, 2 green, 4 blue.
  let six = max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  if (six < 0) six += 6;
  const bin = Math.min(HUE_BINS - 1, Math.floor((six / 6) * HUE_BINS));
  h.w[bin] += w;
  h.r[bin] += r * w;
  h.g[bin] += g * w;
  h.b[bin] += b * w;
}

function score(h: HueHistogram, i: number) {
  return h.w[i] + 0.5 * (h.w[(i + HUE_BINS - 1) % HUE_BINS] + h.w[(i + 1) % HUE_BINS]);
}

/**
 * The dominant colour of what was counted, written to `out` at full value
 * (its largest channel 1), and how much of all the colour counted is that
 * hue, 0…1 (a rainbow: about an eighth; one colour: 1). Returns 0, and
 * leaves `out`, when nothing with a hue was counted.
 */
export function dominantHue(h: HueHistogram, out: { r: number; g: number; b: number }): number {
  let best = -1;
  let bestScore = 0;
  let total = 0;
  for (let i = 0; i < HUE_BINS; i++) {
    total += h.w[i];
    const s = score(h, i);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  if (best < 0 || total <= 0) {
    h.held = -1;
    return 0;
  }
  // The hue held stays, unless another is clearly ahead of it now.
  if (h.held >= 0 && h.held !== best && score(h, h.held) * TAKE_OVER >= bestScore) best = h.held;
  h.held = best;
  const a = (best + HUE_BINS - 1) % HUE_BINS;
  const c = (best + 1) % HUE_BINS;
  // The colour of that bin, with what little of it fell just over either edge.
  const r = h.r[best] + 0.5 * (h.r[a] + h.r[c]);
  const g = h.g[best] + 0.5 * (h.g[a] + h.g[c]);
  const b = h.b[best] + 0.5 * (h.b[a] + h.b[c]);
  const peak = Math.max(r, g, b);
  if (peak <= 0) return 0;
  out.r = r / peak;
  out.g = g / peak;
  out.b = b / peak;
  return Math.min(1, (h.w[best] + h.w[a] + h.w[c]) / total);
}

/** How much a pattern has one colour to follow, from the dominant hue's share of it: a rainbow has none. */
export function oneColour(share: number): number {
  const t = Math.min(1, Math.max(0, (share - 0.16) / (0.4 - 0.16)));
  return t * t * (3 - 2 * t);
}
