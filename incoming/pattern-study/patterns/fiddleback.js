// ===== Patternflow pattern =====
// Title:   Fiddleback
// Family:  wood
// Idea:    Close on the flamed maple back of a violin under amber varnish, the fibres waving in and out of the surface so the board shows wavy cross bands, and as a lamp swings slowly over it the bands that face the lamp glow gold and the others sink to red-brown, swapping and rolling through the wood while a soft varnish highlight slides with the lamp and the board drifts along its length.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the curly or fiddleback figure of maple and its chatoyance; the fibre highlight of James Kajiya and Timothy Kay (1989), as Stephen Marschner, Stephen Westin, Adam Arbree and Jonathan Moon used it for the subsurface fibres of figured wood in Measuring and Modeling the Appearance of Finished Wood (2005)
// Round:   201
// ===============================
// @matrix 64x128
// @knobs Varnish=0..1, Swing=0..3, Curl=-1..1, Figure=-1..1
//
// Knob 1: Varnish. The colour of the varnish: golden amber where the knob opens, then an orange Cremona red, cherry, a dark tobacco brown and a pale blonde straw at the top. The bands that face the lamp take the lighter, yellower end of each and the bands turned away the deeper, redder end.
// Knob 2: Swing. How fast the lamp swings over the board, a long swing about every 16 seconds where the knob opens and every 10 at the top. At the bottom the lamp holds still and only the board keeps sliding, 0.3 LEDs a second (0.8 where the knob opens).
// Knob 3: Curl. The spacing of the bands, 4.6 LEDs from one to the next at the bottom, 7 where the knob opens and 12 at the top; they open or close about the middle of the panel.
// Knob 4: Figure. How far the fibres dip in and out of the surface: plain straight-grained maple with no bands at the bottom, 12 degrees where the knob opens and 21 at the top, where the bands are sharpest. The lamp swings wider with it, so the bands still swap.

const W = 64;
const H = 128;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise in -1..1, smooth, over a lattice of whole units.
function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return 2 * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) - 1;
}

function noise1(x, seed) {
  const ix = Math.floor(x);
  let f = x - ix;
  f = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash(ix, seed);
  const b = hash(ix + 1, seed);
  return 2 * (a + (b - a) * f) - 1;
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// The lamp and the eye stand this far above the board, in LEDs, so the half vector between them tilts by one part in NEAR from one LED to the next.
const NEAR = 800;
// Ray flecks: the cell, in LEDs across and along the board, that holds at most one.
const RAYW = 16;
const RAYH = 12;
// Band forks: one pair to a stretch of board this long.
const FORK = 44;
// The varnishes along the Varnish knob: hue, saturation and value of the band that faces the lamp, then of the band turned away.
const VARNISH = [
  [0.125, 0.56, 0.98, 0.045, 0.8, 0.44],
  [0.09, 0.62, 0.95, 0.02, 0.82, 0.42],
  [0.05, 0.56, 0.9, -0.01, 0.78, 0.4],
  [0.09, 0.62, 0.72, 0.04, 0.72, 0.3],
  [0.14, 0.36, 1.0, 0.065, 0.62, 0.5],
];
const STEPS = 256;

export function setup(params) {
  params.t = 0;
  params.lp = 0;
  // The board starts on a stretch where the curl is deep all down the panel.
  params.slide = 290;
  params.kph = 0;
  params.phOff = 0;
  params.amp = 0.22;
  params.lut = new Float32Array(STEPS * 3);
  params.vk = -1;
  params.hx = 0;
  params.hy = 0;
  params.gx = 32;
  params.gy = 64;
  params.lamp = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const swing = clamp(k[1], 0, 3);
  params.lp += dt * 0.2 * swing;
  params.slide += dt * (0.3 + 0.25 * swing);
  const curl = clamp(k[2], -1, 1);
  const lam = curl < 0 ? 7 * (1 + 0.35 * curl) : 7 * (1 + 0.75 * curl);
  const kph = (2 * Math.PI) / lam;
  // A turn of Curl rescales the bands about the middle of the panel, so they open or close from there.
  if (params.kph) params.phOff += (params.kph - kph) * (params.slide + 64);
  params.kph = kph;
  const fig = (clamp(k[3], -1, 1) + 1) / 2;
  params.amp = 0.36 * Math.pow(fig, 0.8);
  // The varnish: a table of colours from the band turned away to the band that faces the lamp.
  const vk = clamp(k[0], 0, 1);
  if (vk !== params.vk) {
    params.vk = vk;
    const c = vk * (VARNISH.length - 1);
    const i = Math.min(VARNISH.length - 2, Math.floor(c));
    const f = c - i;
    const m = [];
    for (let n = 0; n < 6; n++) m.push(VARNISH[i][n] + (VARNISH[i + 1][n] - VARNISH[i][n]) * f);
    const out = [0, 0, 0];
    for (let n = 0; n < STEPS; n++) {
      const q = n / (STEPS - 1);
      const e = q * q * (3 - 2 * q);
      hsv(m[3] + (m[0] - m[3]) * e, m[4] + (m[1] - m[4]) * q, m[5] + (m[2] - m[5]) * q, out);
      params.lut[n * 3] = out[0] * 255;
      params.lut[n * 3 + 1] = out[1] * 255;
      params.lut[n * 3 + 2] = out[2] * 255;
    }
  }
  // The lamp swings along the grain, and less across it, on two sines whose periods never line up and a slow wander; how wide it swings breathes as well.
  // It starts where, two seconds in, it leans well to one side, so the panel opens on strong bands with the highlight at the upper left.
  const lp = params.lp + 29;
  const sw = (0.03 + 0.62 * params.amp) * (0.85 + 0.35 * noise1(0.07 * lp + 2, 35));
  // The swing is squared off a little, so the lamp dwells to either side and crosses the middle quickly.
  const along = 0.6 * Math.sin(lp) + 0.22 * Math.sin(2.414 * lp + 1.3) + 0.3 * noise1(0.31 * lp, 31);
  params.hy = sw * 0.75 * Math.tanh(2 * along) / Math.tanh(1.2);
  params.hx = sw * (0.3 * Math.sin(0.53 * lp + 0.4) + 0.35 * noise1(0.23 * lp + 5, 32));
  params.lamp = 1 + 0.1 * noise1(0.17 * lp, 33);
  // The varnish highlight sits where the lamp would mirror in the board.
  params.gx = 32 + 200 * params.hx;
  params.gy = 64 + 240 * params.hy;
}

export function draw(display, params) {
  const A = params.amp;
  const slide = params.slide;
  const lut = params.lut;
  const kph = params.kph;
  const phOff = params.phOff;
  const w = 0.06 + 0.45 * A;
  // The bands see the lamp no further off than this, so a band that faces it never thins to a dotted line.
  const hcap = 0.03 + 0.85 * A;
  const gx = params.gx;
  const gy = params.gy;
  const lamp = params.lamp;
  // Plain maple with no curl shows its latewood lines more.
  const lk = 0.08 + 0.22 * Math.max(0, 1 - A / 0.12);
  for (let y = 0; y < H; y++) {
    const v = y + 0.5 + slide;
    // Along the board: band slant, spacing drift and figure strength.
    const slant = 0.2 * noise1(v / 90, 11);
    const drift = 3 * noise1(v / 42, 12);
    const envR = 0.7 + 0.3 * noise1(v / 24, 13);
    const j0 = Math.floor(v / FORK);
    const hy = params.hy - (y + 0.5 - 64) / NEAR;
    const hb = hcap * Math.tanh(hy / hcap);
    // Where the lamp stands square over the board the fibre highlight spreads into a sheen, and the bands only faintly split in two.
    const hs = hb / (0.35 * A + 0.01);
    const we = w * (1 + 0.3 * Math.exp(-hs * hs));
    const iw2 = 1 / (we * we);
    const gdy = (y + 0.5 - gy) / 20;
    // Ray flecks: short lighter dashes across the grain, at most one to a cell of RAYW by RAYH LEDs, that catch the lamp from one side.
    const cv = Math.floor(v / RAYH);
    const glint = 0.3 + 0.7 * smooth(-1, 1, -hb / (0.5 * A + 0.02));
    for (let x = 0; x < W; x++) {
      const u = x + 0.5;
      // Fibre position across the board, wandering.
      const f = u + 3.5 * noise2(u / 40 + 7.3, v / 70) + 1.2 * noise2(u / 14, v / 33 + 3.1);
      // Phase of the curl. Each pair of forks adds one band between its two ends: the angle the pair subtends jumps by a whole turn only on the segment between them, where the jump cannot show.
      let ph = kph * (v + drift + slant * (u - 32) + 2.6 * noise2(u / 24 + 1.7, v / 40)) + phOff;
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        if (hash(j, 21) > 0.6) continue;
        const d = 20 + 16 * hash(j, 22);
        const vc = (j + 0.5) * FORK;
        const dv = v - vc;
        if (dv > 2.4 * d || dv < -2.4 * d) continue;
        const uc = 4 + 56 * hash(j, 24);
        const a = (hash(j, 25) < 0.5 ? -1 : 1) * (0.35 + 0.5 * hash(j, 27));
        const ca = Math.cos(a) * d;
        const sa = Math.sin(a) * d;
        const du = u - uc;
        const r = Math.sqrt(du * du + dv * dv);
        const wf = 1 - smooth(1.3 * d, 2.4 * d, r);
        if (wf <= 0) continue;
        const ax = du + ca;
        const ay = dv + sa;
        const bx = du - ca;
        const by = dv - sa;
        const sg = hash(j, 26) < 0.5 ? -1 : 1;
        ph += sg * wf * Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      }
      const env = envR * (0.8 + 0.2 * noise2(u / 30 + 5.1, v / 45 + 2.2));
      const tz = A * env * Math.sin(ph);
      const tx = 0.4 * A * env * Math.cos(ph);
      const hx = params.hx - (u - 32) / NEAR;
      const tl = Math.sqrt(tx * tx + 1 + tz * tz);
      const hl = Math.sqrt(hx * hx + hy * hy + 1);
      const th = (tx * hx + hb + tz) / (tl * hl);
      const S = Math.exp(-th * th * iw2);
      const ll = Math.sqrt(4 * hx * hx + 4 * hy * hy + 1);
      const tL = (2 * tx * hx + 2 * hy + tz) / (tl * ll);
      const D = 1 - tL * tL;
      // Latewood lines run along the fibres.
      const rp = f / 5 + 0.25 * noise1(f / 7, 42);
      const ri = Math.floor(rp);
      const fr = rp - ri - 0.5;
      const late = (0.3 + 0.7 * hash(ri, 41)) * Math.exp(-(fr * fr) / 0.035);
      // Varnish highlight.
      const gdx = (u - gx) / 16;
      const gloss = Math.exp(-(gdx * gdx + gdy * gdy));
      // The board is a little darker and redder in broad patches, as old varnish is.
      const tone = 0.1 * noise2(u / 34 + 9.4, v / 19) + 0.12 * noise2(u / 13 + 2.6, v / 17 + 8.8);
      let ray = 0;
      const cu = Math.floor(u / RAYW);
      if (hash(cu + 17, cv) < 0.32) {
        const ru = (u - (cu * RAYW + 4 + (RAYW - 8) * hash(cu + 18, cv))) / (2.5 + 1.5 * hash(cu + 19, cv));
        const rv = (v - (cv * RAYH + 2.5 + (RAYH - 5) * hash(cu + 20, cv))) / 0.85;
        if (ru > -1 && ru < 1) ray = (1 - ru * ru) * (1 - ru * ru) * Math.exp(-rv * rv) * glint;
      }
      const q = clamp(0.8 * S + 0.3 * (D - 0.6) - lk * late + 0.9 * tone + 0.35 * ray, 0, 1);
      const n = ((q * (STEPS - 1)) | 0) * 3;
      const dim = (1 - (0.02 + lk) * late) * (1 + 0.4 * tone) * (1 + 0.15 * ray) * lamp;
      const r0 = lut[n] * dim + 44 * gloss;
      const g0 = lut[n + 1] * dim + 42 * gloss;
      const b0 = lut[n + 2] * dim + 34 * gloss;
      display.setPixel(x, y, r0 > 255 ? 255 : r0, g0 > 255 ? 255 : g0, b0 > 255 ? 255 : b0);
    }
  }
}
