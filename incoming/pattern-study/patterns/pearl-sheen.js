// ===== Patternflow pattern =====
// Title:   Pearl Sheen
// Family:  cosmetic
// Idea:    Pearl pigment pours slowly down the panel in long satin streaks while a strip light's reflection slides across it, and each LED takes its colour from thin-film interference in the coat of the mica flakes, so flakes lying flat show one pearl colour and flakes tilted along the streaks flip to a second.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 30, after thin-film interference in pearlescent mica pigments (titania-coated mica)
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shift=0..1, Sheen=0..1
//
// Knob 1: Hue. Turns the whole pigment round the colour wheel, flip colour and all. At 0 the flat flakes are pearl rose and the tilted ones peach; at 0.5 aqua turning periwinkle, at 0.75 lavender turning magenta.
// Knob 2: Speed. How fast the pour runs. At 2 the broad swells slide down about 10 LEDs a second and the fine striations inside them 48, so the top layer slips past the body of the pour; at 0.2 a tenth of that.
// Knob 3: Shift. The duochrome's strength: how much shorter a tilted flake's light path is than a flat one's. At 0 it is 3%, 950 nm against 980, a faint peach on rose; at 1 it is 14.5%, 840 nm, and the flanks of the streaks turn gold.
// Knob 4: Sheen. The width of the strip light's reflection. At 0 a soft satin glow about 45 LEDs across over a pale body; at 1 a wet gloss, a band about 10 LEDs across that the swells break into white-hot lines, over deeper colour.
// Buttons: K1 tap drags a spatula down through the pour: in 2.5 s a kink runs from the top to the bottom pushing the streaks up to 10 LEDs aside, and over the next 6 s they ease back.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, tanh, atan2, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Smooth noise in a 256 x 256 tile, three octaves of 8, 16 and 32 cells,
// built once in setup. The streaks are this tile stretched about twelve times
// along the flow.
const T = 256, TM = T - 1;
const TEX = new Float32Array(T * T);
const fade = (t) => t * t * (3 - 2 * t);
function buildTex() {
  TEX.fill(0);
  let amp = 1, tot = 0;
  for (let o = 0; o < 3; o++) {
    const cells = 8 << o, size = T / cells, g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = Math.random() * 2 - 1;
    for (let y = 0; y < T; y++) {
      const gy = floor(y / size), fy = fade(y / size - gy), y1 = (gy + 1) % cells;
      for (let x = 0; x < T; x++) {
        const gx = floor(x / size), fx = fade(x / size - gx), x1 = (gx + 1) % cells;
        const a = g[gy * cells + gx], b = g[gy * cells + x1], c = g[y1 * cells + gx], d = g[y1 * cells + x1];
        const top = a + (b - a) * fx;
        TEX[y * T + x] += (top + (c + (d - c) * fx - top) * fy) * amp;
      }
    }
    tot += amp;
    amp *= 0.45;
  }
  for (let i = 0; i < TEX.length; i++) TEX[i] /= tot;
}
function tap(u, v) {
  const fu = floor(u), fv = floor(v), x0 = fu & TM, y0 = fv & TM, x1 = (x0 + 1) & TM, y1 = (y0 + 1) & TM;
  const tx = u - fu, ty = v - fv;
  const a = TEX[y0 * T + x0], b = TEX[y0 * T + x1], c = TEX[y1 * T + x0], d = TEX[y1 * T + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

// The interference colour of the flakes' coat against the optical path
// difference 2 n d cos(theta), 0 to 1600 nm in 1024 steps. Each entry sums
// the two-beam reflectance over the spectrum, 400 to 700 nm every 5 nm, under
// three bell-shaped channel curves at 600, 545 and 455 nm. The air-to-titania
// face turns its beam over and the titania-to-mica face does not, so the
// reflectance is (1 - cos(2 pi path / lambda)) / 2. Only the chroma is kept,
// the colour less its grey, scaled so the second order's strongest is about 1.
const LN = 1024, OPD_MAX = 1600;
const RAW = new Float32Array(LN * 3);
function buildRaw() {
  const chan = [[600, 45], [545, 40], [455, 32]], norm = [0, 0, 0], wts = [];
  for (let l = 400; l <= 700; l += 5) {
    const w = chan.map(([m, s]) => exp(-(((l - m) / s) ** 2) / 2));
    wts.push([l, w]);
    for (let c = 0; c < 3; c++) norm[c] += w[c];
  }
  for (let i = 0; i < LN; i++) {
    const opd = (i / (LN - 1)) * OPD_MAX, acc = [0, 0, 0];
    for (const [l, w] of wts) {
      const r = 0.5 - 0.5 * cos((2 * PI * opd) / l);
      for (let c = 0; c < 3; c++) acc[c] += r * w[c];
    }
    for (let c = 0; c < 3; c++) acc[c] /= norm[c];
    const m = (acc[0] + acc[1] + acc[2]) / 3;
    for (let c = 0; c < 3; c++) RAW[i * 3 + c] = (acc[c] - m) / 0.45;
  }
}

// The angle of a chroma round the grey axis, red at 0.
const chromaAngle = (r, g, b) => atan2((sqrt(3) / 2) * (g - b), r - (g + b) / 2);

// Hue turns the table round the grey axis. Warm entries get LIFT: orange and
// yellow at half light read as brown and olive on the panel, so they are
// lifted and their deep tones kept lighter.
const LUT = new Float32Array(LN * 3), LIFT = new Float32Array(LN);
let lutRot = NaN;
function buildLut(a) {
  const c = cos(a), s = sin(a), k = (1 - c) / 3, q = s / sqrt(3), m0 = c + k, m1 = k - q, m2 = k + q;
  for (let i = 0, j = 0; j < LN; i += 3, j++) {
    const r = RAW[i], g = RAW[i + 1], b = RAW[i + 2];
    LUT[i] = r * m0 + g * m1 + b * m2;
    LUT[i + 1] = r * m2 + g * m0 + b * m1;
    LUT[i + 2] = r * m1 + g * m2 + b * m0;
    const y = cos(chromaAngle(LUT[i], LUT[i + 1], LUT[i + 2]) - 1);
    LIFT[j] = y > 0 ? y * y : 0;
  }
}

// A flat flake's light path: the second order's magenta, 980 nm. A tilted
// flake sees the light slant through its coat, 2 n d cos(theta) is shorter,
// and the colour moves on through orange to gold. Hue then turns the table so
// the flat colour sits on the knob's hue and the gold on its neighbour.
const BASE = 980;
let baseAng = 0;

export function setup(params) {
  buildTex();
  buildRaw();
  const bi = round((BASE / OPD_MAX) * (LN - 1)) * 3;
  baseAng = chromaAngle(RAW[bi], RAW[bi + 1], RAW[bi + 2]);
  lutRot = NaN;
  params.s = {
    t: 0, flow: 0, hue: 0, shift: 0, sheen: 0.06, stir: -1,
    u: new Float32Array(N), h: new Float32Array(N), big: new Float32Array(N), fine: new Float32Array(N),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.shift = cl(k[2], 0, 1);
  P.sheen = cl(k[3], 0, 1);
  P.t += d;
  P.flow += d * cl(k[1], 0.2, 3);
  if (P.stir >= 0) {
    P.stir += d;
    if (P.stir > 12) P.stir = -1;
  }
  if (input.btnPressed && input.btnPressed[0]) P.stir = 0;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const rot = 2 * PI * (P.hue + 0.97) - baseAng;
  if (rot !== lutRot) buildLut((lutRot = rot));
  const ub = P.u, hb = P.h, bb = P.big, fb = P.fine, t = P.t, f = P.flow;

  // Across-the-flow coordinate u: the panel's x bent by two slow warps, one
  // carried down by the pour and one drifting on its own. A streak is a line
  // of constant u. The spatula pushes u aside above its edge.
  const sa0 = P.stir, sy = sa0 >= 0 ? -0.3 + (4.6 * sa0) / 2.5 : 0;
  const sAmp = sa0 < 0 ? 0 : 0.32 * (sa0 < 2.5 ? 1 : exp(-(sa0 - 2.5) / 1.6));
  for (let y = 0; y < H; y++) {
    const Y = y / 32, push = sAmp > 0 ? sAmp * 0.5 * (1 + tanh((sy - Y) / 0.22)) : 0;
    for (let x = 0; x < W; x++) {
      const X = x / 32;
      ub[y * W + x] = X + tap(X * 6 + 40, Y * 5 - f * 0.5 + 7) * 1.4 + tap(X * 3 + t * 0.3, Y * 3 + 90) * 0.9 - push * sin((PI * (x + 0.5)) / W);
    }
  }
  // The surface: broad swells (big) and fine striations (fine), both long
  // along u. Where the warp squeezes the striations finer than two LEDs can
  // hold, they fade out instead of breaking into stair steps.
  for (let y = 0; y < H; y++) {
    const Y = y / 32, yu = (y > 0 ? y - 1 : y) * W, yd = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, u = ub[i];
      const dx = ub[y * W + (x < W - 1 ? x + 1 : x)] - ub[y * W + (x > 0 ? x - 1 : x)], dy = ub[yd + x] - ub[yu + x];
      const over = 27 * sqrt(dx * dx + dy * dy) - 2;
      const big = tap(u * 22 + 130, Y * 4 - f * 0.6);
      const fine = tap(u * 55, Y * 4 - f * 3) / (1 + (over > 0 ? over * over : 0));
      bb[i] = big;
      fb[i] = fine;
      hb[i] = big + fine * 0.12;
    }
  }

  const sh = P.shift, sp = 0.2 + 0.8 * P.sheen;
  // How much shorter a fully tilted flake's path is, and how much the coat's
  // thickness varies along the striations.
  const dmax = 0.03 + 0.115 * sh, thin = 10 + 40 * sh;
  // A long strip light seen in the surface. Its reflection sweeps across and
  // back every 21 s with a second, dimmer strip trailing it; Sheen narrows both.
  const sw = 0.8 - 0.65 * sp, iw = 1 / sw, amp = 0.46 + 0.3 * sp;
  const sc = 1.2 * sin(t * 0.3), sc2 = sc + (sc > 0 ? -1.6 : 1.6), sa = 0.25 * sin(t * 0.13);
  for (let y = 0; y < H; y++) {
    const yu = (y > 0 ? y - 1 : y) * W, yd = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, xl = y * W + (x > 0 ? x - 1 : x), xr = y * W + (x < W - 1 ? x + 1 : x);
      const hx = (hb[xr] - hb[xl]) * 8, hy = (hb[yd + x] - hb[yu + x]) * 8;
      const n2 = 1 / (1 + hx * hx + hy * hy);
      // The straight-on view reflected, r = 2 (n.v) n - v, on a swatch that
      // bulges a little, so the strip lands as one broad band.
      const bulge = 0.8 * ((x - 32) / 32 + (y - 64) / 160);
      const rq = -2 * n2 * (hx + sa * hy) + bulge, q = (rq - sc) * iw, q2 = (rq - sc2) * iw;
      const glow = exp(-q * q) + 0.6 * exp(-q2 * q2);
      // The flakes lie along the flow and tilt with the fine striations. A
      // tilted flake sees the light at an angle, which shortens its path:
      // flip runs from 0 for flakes within 18 degrees of flat to 1 past 45.
      const fx = ((fb[xr] - fb[xl]) * 4 + hx * 0.4) * 2.2, fy = ((fb[yd + x] - fb[yu + x]) * 4 + hy * 0.4) * 2.2;
      const c2 = 1 / (1 + fx * fx + fy * fy);
      const a = cl((0.9 - c2) * 2.5, 0, 1), flip = a * a * (3 - 2 * a);
      const j = cl(round((((BASE + thin * fb[i]) * (1 - dmax * flip)) / OPD_MAX) * (LN - 1)), 0, LN - 1), li = j * 3;
      // The flakes catch the strip in finer lines of their own.
      const fq = (bulge - 2 * c2 * (fx + sa * fy) - sc) * 2.2;
      const gl = 0.75 * glow + 0.25 * exp(-fq * fq);
      // Deep tones only in the troughs of the broad swells.
      const B = bb[i], deep = B < -0.1 ? (B > -0.35 ? (-0.1 - B) / 0.25 : 1) : 0;
      let lum = 0.64 - 0.12 * sp + amp * gl - 0.26 * deep + (0.1 * flip * dmax) / 0.13;
      if (lum > 0.95) lum = 0.95 + (lum - 0.95) * 0.4;
      const sat = 0.45 + 0.12 * sp - 0.32 * gl + 0.45 * deep + 0.3 * sh * flip;
      const yl = LIFT[j], L = (lum + 0.12 * yl + 0.2 * yl * deep) * 235, S = sat * (1 - 0.3 * yl);
      display.setPixel(x, y, cl(L * (1 + S * LUT[li]), 0, 255), cl(L * (1 + S * LUT[li + 1]), 0, 255), cl(L * (1 + S * LUT[li + 2]), 0, 255));
    }
  }
}
