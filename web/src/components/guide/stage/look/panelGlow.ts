import * as THREE from "three";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";
import { addHue, clearHues, dominantHue, hueHistogram, oneColour } from "./dominant";

// The light the LED panel is giving off, read from the frame it is showing.
//
// The Device samples the frame it has just put on the panel (what is *shown*:
// the simulator's frame, held and faded when the power goes) and writes the
// result here every other frame; the stage's lights, the floor and the air
// round the panel read it. Anything else may too — it is plain data, read it
// from a frame loop or subscribe.
//
// The panel stands portrait: the frame's x runs up the device (x 0 at the
// foot, 127 at the top), its y across (y 0 at the left edge, 63 by the
// knobs). `bands` are along the device's height, foot first.

/** How many bands the panel's height is read in. */
export const GLOW_BANDS = 3;

export type PanelGlow = {
  /** The whole panel's mean light, linear RGB, power applied: black when it is dark. */
  mean: THREE.Color;
  /** The same per band up the device's height: [foot, middle, top]. */
  bands: THREE.Color[];
  /** What colour the light is: the pattern's dominant colour (look/dominant.ts — one that is on the panel, not an average of several) at full value, linear RGB, eased. Meaningless while `colour` is 0. */
  hue: THREE.Color;
  /** 0 … 1: how much the panel has a colour to follow (0: dark, white and grey only, or every hue at once), eased. */
  colour: number;
  /** 0 … 1: how lit the panel is (its mean luminance, linear), eased. */
  lit: number;
  /** 0 … 1: the panel's power as shown (it fades when the power is cut). */
  power: number;
};

export const panelGlow: PanelGlow = {
  mean: new THREE.Color(0, 0, 0),
  bands: Array.from({ length: GLOW_BANDS }, () => new THREE.Color(0, 0, 0)),
  hue: new THREE.Color(1, 0.14, 0.05),
  colour: 0,
  lit: 0,
  power: 0,
};

// sRGB byte → linear light.
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

const STEP = 4; // every 4th LED each way: 32 × 16 samples
const acc = new Float32Array(GLOW_BANDS * 3);
const count = new Uint16Array(GLOW_BANDS);
const hues = hueHistogram();
const lead = { r: 0, g: 0, b: 0 };

/**
 * Read a frame (PANEL_W × PANEL_H RGBA bytes, any row order) at `power`
 * (0 … 1) and ease the signal toward it; `dt` is the time since the last
 * read, seconds.
 */
export function readPanelGlow(frame: ArrayLike<number>, power: number, dt: number) {
  acc.fill(0);
  count.fill(0);
  clearHues(hues);
  let weight = 0;
  let n = 0;
  for (let y = STEP >> 1; y < PANEL_H; y += STEP) {
    const row = y * PANEL_W * 4;
    for (let x = STEP >> 1; x < PANEL_W; x += STEP) {
      const i = row + x * 4;
      const r = LIN[frame[i]];
      const g = LIN[frame[i + 1]];
      const b = LIN[frame[i + 2]];
      const band = Math.min(GLOW_BANDS - 1, Math.floor((x * GLOW_BANDS) / PANEL_W)) * 3;
      acc[band] += r;
      acc[band + 1] += g;
      acc[band + 2] += b;
      count[band / 3]++;
      const max = r > g ? (r > b ? r : b) : g > b ? g : b;
      const min = r < g ? (r < b ? r : b) : g < b ? g : b;
      // Coloured and bright counts; a dim wash of colour counts little.
      const w = (max - min) * max;
      addHue(hues, r, g, b, w);
      weight += w;
      n++;
    }
  }
  const g = panelGlow;
  // The light itself follows at once (it is light); a short ease only takes the edge off a pattern that flickers.
  const quick = 1 - Math.exp(-dt / 0.06);
  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (let k = 0; k < GLOW_BANDS; k++) {
    const c = Math.max(1, count[k]);
    const r = (acc[k * 3] / c) * power;
    const gg = (acc[k * 3 + 1] / c) * power;
    const b = (acc[k * 3 + 2] / c) * power;
    const band = g.bands[k];
    band.r += (r - band.r) * quick;
    band.g += (gg - band.g) * quick;
    band.b += (b - band.b) * quick;
    mr += band.r;
    mg += band.g;
    mb += band.b;
  }
  g.mean.setRGB(mr / GLOW_BANDS, mg / GLOW_BANDS, mb / GLOW_BANDS);
  g.power = power;
  // What colour it is, and how much: slower, so a hue turns rather than jumps.
  const slow = 1 - Math.exp(-dt / 0.3);
  const lum = 0.2126 * g.mean.r + 0.7152 * g.mean.g + 0.0722 * g.mean.b;
  g.lit += (Math.min(1, lum / 0.04) - g.lit) * slow;
  // The dominant hue's colour, and how much of the pattern's colour it is.
  const share = weight > 1e-5 ? dominantHue(hues, lead) : 0;
  const colour = n ? Math.min(1, weight / n / 0.03) * Math.min(1, power * 4) * oneColour(share) : 0;
  g.colour += (colour - g.colour) * slow;
  if (share > 0) {
    g.hue.r += (lead.r - g.hue.r) * slow;
    g.hue.g += (lead.g - g.hue.g) * slow;
    g.hue.b += (lead.b - g.hue.b) * slow;
  }
}
