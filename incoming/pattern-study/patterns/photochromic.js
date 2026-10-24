// ===== Patternflow pattern =====
// Title:   Photochromic
// Family:  cosmetic
// Idea:    A pale shimmer polish fills the panel, every LED either bare polish or a mica flake that catches the light or turns away from it; an unseen UV torch, seen only by its faint violet spill, sweeps down or up the panel in a weaving stroke every 13 seconds, and wherever it passes the polish deepens within a quarter of a second to a dark jewel colour that dims and tints the flakes under it, then fades back to pale over the next few seconds, the first-lit parts first.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 38, after photochromic nail polish, pale in the shade, that deepens under UV light and fades back [Beer-Lambert law, August Beer, 1852]
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Flakes=1..4, Fade=-1..1
//
// Knob 1: Hue. Turns the polish round the whole wheel, pale and deep together. At 0 lavender deepening to dark violet; at 0.1 pink to plum; at 0.2 blush to raspberry; at 0.3 cream to tangerine; at 0.4 butter to marigold; at 0.5 pale lime to lime; at 0.6 mint to forest; at 0.7 aqua to deep teal; at 0.8 sky to navy; at 0.9 periwinkle to indigo. From 0.24 to 0.48, and partly from 0.12 to 0.6, where a dark shade would read brown or olive, the polish goes from cream to a bright full colour instead of darkening.
// Knob 2: Speed. At 2 a stroke starts every 13 seconds and takes 1.6 seconds to cross the 128 rows, weaving 20 LEDs either side of the middle about twice on the way; the dye under the middle of the torch is 90% switched in 0.23 seconds. At 0.2 all of it ten times slower, so the first stroke comes at 22 seconds; at 3 one and a half times faster, the first stroke at 1.5 seconds.
// Knob 3: Flakes. The size of the shimmer flakes. At 1 one LED, 38% of them catching the light and 22% turned away, a fine shimmer over every LED; at 2 flakes two LEDs across, 30% catching and 10% turned away, with bare polish between; at 3 small crosses and at 4 round flakes four LEDs across, a coarse glitter.
// Knob 4: Fade. How long the deep colour lasts once the torch has passed. At -1 it is half gone in 1.5 seconds and only a short band trails the torch; at 0.06 half gone in 4.8 seconds; at 1 in 13.5, so the panel is still half deep when the next stroke comes, and the stroke from before the start still shows on the opening picture.
// Buttons: K1 tap sends a stroke now, running the other way from the last one.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sin, exp, round, random, LN10, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Seconds at Speed 2: a stroke every PERIOD, crossing in SWEEP. The first
// stroke of a fresh start begins at FIRST; the one before it, which ended
// 8.4 seconds before the start, is run through when the pattern opens.
const PERIOD = 13, SWEEP = 2.4, FIRST = 2.2;
// The torch: a soft spot of sigma SIG LEDs, weaving AMP LEDs either side of
// the middle; the dye switches at KON per second where it is brightest.
const SIG = 15, AMP = 20, KON = 10;
// Optical density of the switched dye, so the depth of colour goes as
// 1 - 10^(-OD a) (Beer-Lambert): it holds dark while most of the dye is
// still switched and lets go toward the end.
const OD = 2;
// The fade, from a = 0.95 to the a where the colour is half gone.
const HALF_A = 1.856;
// Opening hue: violet, not red.
const H0 = 0.76;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, flakes: 1, fade: 0.06, t: 0, begun: false, k: 0, tx: -99, ty: -99, on: 0,
    a: new Float32Array(N), g: new Float32Array(N), ph: new Float32Array(N), om: new Float32Array(N),
    size: 0, pale: [0, 0, 0], deep: [0, 0, 0], tint: [0, 0, 0], pearl: [0, 0, 0], extra: -1,
  };
}

// The flakes for a size, one glint per LED, every LED of a flake sharing
// it: 1 catches the light, -1 is turned away and shades the polish under
// it, 0 is bare polish. At size 1 every LED holds mica, 38% catching the
// light, 22% turned away; larger flakes are fewer, 30% and 10%.
function flakes(S, size) {
  const { g, ph, om } = S;
  const cw = Math.ceil(W / size), nc = cw * Math.ceil(H / size);
  const cg = new Float32Array(nc), cp = new Float32Array(nc), co = new Float32Array(nc);
  for (let c = 0; c < nc; c++) {
    const u = random();
    if (size === 1) cg[c] = u < 0.4 ? 0 : u < 0.62 ? -1 : 1;
    else cg[c] = u < 0.6 ? 0 : u < 0.7 ? -1 : 1;
    cp[c] = random() * TAU;
    co[c] = 0.8 + 0.7 * random();
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = floor(y / size) * cw + floor(x / size), i = y * W + x;
      // Flakes three or four across lose their corners.
      const ex = x % size === 0 || x % size === size - 1, ey = y % size === 0 || y % size === size - 1;
      g[i] = size > 2 && ex && ey ? 0 : cg[c];
      ph[i] = cp[c];
      om[i] = co[c];
    }
  S.size = size;
}

// Where stroke k has the torch at progress s (0..1): strokes alternate down
// and up the panel, weaving side to side, each a little different.
function torchAt(S, k, s) {
  const down = (k & 1) === 0, w = 2.4 + 0.5 * ((k * 0.618 + 10) % 1), ph = k * 2.4;
  S.ty = down ? -30 + s * (H + 60) : H + 30 - s * (H + 60);
  S.tx = W / 2 + AMP * sin(TAU * w * s + ph);
}

// Advance the dye by dt seconds of pattern time: switched by the torch at
// KON times its intensity, back by the thermal fade.
function dye(S, dt) {
  const a = S.a, half = 4.5 * 3 ** S.fade, decay = exp((-HALF_A / half) * dt);
  for (let i = 0; i < N; i++) a[i] *= decay;
  if (!S.on) return;
  const R = 3 * SIG, x0 = max(0, floor(S.tx - R)), x1 = min(W - 1, Math.ceil(S.tx + R));
  const y0 = max(0, floor(S.ty - R)), y1 = min(H - 1, Math.ceil(S.ty + R));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - S.tx, dy = y + 0.5 - S.ty, I = exp(-(dx * dx + dy * dy) / (2 * SIG * SIG));
      if (I < 0.01) continue;
      const i = y * W + x;
      a[i] += (1 - a[i]) * (1 - exp(-KON * I * dt));
    }
}

// Run the clock from t0 to t1 in steps, strokes switching on and off.
function run(S, t0, t1, step) {
  for (let t = t0; t < t1 - 1e-9; t += step) {
    const d = min(step, t1 - t), tm = t + d;
    const k = floor((tm - FIRST) / PERIOD), s = (tm - FIRST - k * PERIOD) / SWEEP;
    S.on = 0;
    if (s <= 1) {
      S.on = 1;
      S.k = k;
      torchAt(S, k, s);
    }
    if (S.extra >= 0) {
      const se = (tm - S.extra) / SWEEP;
      if (se <= 1) {
        S.on = 1;
        torchAt(S, S.k + 1, se);
      } else S.extra = -1;
    }
    dye(S, d);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.flakes = cl(k[2], 1, 4);
  S.fade = cl(k[3], -1, 1);
  const size = round(S.flakes);
  if (size !== S.size) flakes(S, size);
  if (!S.begun) {
    S.t = FIRST - PERIOD - 0.3;
    run(S, S.t, 0, 0.1);
    S.t = 0;
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0] && S.extra < 0) S.extra = S.t;
  const step = (d * S.speed) / 2;
  if (step > 0) run(S, S.t, S.t + step, step);
  S.t += step;
}

function palette(S) {
  const h = S.hue + H0, hh = h - floor(h);
  // Red, orange, yellow and lime go brown or olive when dark: there the
  // polish deepens to a bright full colour instead, from a cream.
  const dw = min(abs(hh - 0.12), 1 - abs(hh - 0.12)), warm = 1 - sm(0.12, 0.24, dw);
  hsv(h, 0.32 - 0.1 * warm, 0.52 + 0.04 * warm, S.pale);
  hsv(h + 0.015 * (1 - warm), 0.92 + 0.06 * warm, 0.11 + 0.5 * warm, S.deep);
  hsv(h, 0.6 - 0.1 * warm, 0.5 + 0.4 * warm, S.tint);
  hsv(h, 0.12, 1, S.pearl);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const { a, g, ph, om, pale, deep, tint, pearl } = S, t = S.t, k = -OD * LN10, norm = 1 - exp(k);
  const sig2 = 2 * (SIG * 1.2) ** 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // How deep the colour is: Beer-Lambert in the switched dye.
      const D = (1 - exp(k * a[i])) / norm;
      let r = pale[0] + (deep[0] - pale[0]) * D;
      let gg = pale[1] + (deep[1] - pale[1]) * D;
      let b = pale[2] + (deep[2] - pale[2]) * D;
      // The flake: pearl white in the pale polish; under the dark dye the light
      // crosses the dye twice on its way to the flake and back, so the
      // flake goes dim and takes the colour. Now and then a flake turns half
      // away from the room light.
      const gl = g[i] * (sin(ph[i] + t * om[i]) > -0.8 ? 1 : 0.5);
      if (gl < 0) {
        r *= 1 + 0.3 * gl;
        gg *= 1 + 0.3 * gl;
        b *= 1 + 0.3 * gl;
      } else if (gl > 0) {
        r += (pearl[0] + (tint[0] - pearl[0]) * D - r) * gl;
        gg += (pearl[1] + (tint[1] - pearl[1]) * D - gg) * gl;
        b += (pearl[2] + (tint[2] - pearl[2]) * D - b) * gl;
      }
      // The torch's violet spill.
      if (S.on) {
        const dx = x + 0.5 - S.tx, dy = y + 0.5 - S.ty, v = 0.12 * exp(-(dx * dx + dy * dy) / sig2);
        r += v * 0.45;
        b += v;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, gg)), round(255 * min(1, b)));
    }
}
