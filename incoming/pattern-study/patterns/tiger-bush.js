// ===== Patternflow pattern =====
// Title:   Tiger Bush
// Family:  tigerbush
// Idea:    Seen from the air, bands of shrubs lie across a gentle slope with bare crusted soil between them, and the whole striped cover creeps uphill because each band drinks the runoff from the bare ground above it and starves on its lower edge, while patchy rain makes the bands thicken, thin, branch, merge and break into arcs.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Klausmeier's model of banded vegetation (Christopher Klausmeier, 1999) and the tiger bush of the Sahel described by Valentin, d'Herbes and Poesen (1999), pattern round 223
// Round:   223
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rain=0..4, Slope=-1..1, Patchy=-1..1
//
// Knob 1: Hue. Turns through four landscapes and back. At 0, where it opens, the soil is ochre to terracotta and the shrubs run from olive and sage at the thin edge to deep green in the core. At 0.25 the soil is pale stone grey and the shrubs blue-green, at 0.5 the soil is dusty rose and the shrubs teal, at 0.75 the soil is dark mauve-grey ash and the shrubs a fresh green, and at 1 it is terracotta again. The colours blend between the four.
// Knob 2: Rain. The year's rain a, from 0.95 at 0 to 1.85 at 4 on a flat Slope (it opens at 2, where a is 1.40; on a steeper slope the top is higher, a_c - 0.18 with a_c = 1.25 + 0.0125 v, the rain at which the cover would close up solid). Gusts of wet and dry years of up to 17% ride on it. Dry, the shrubs hold 27% of the ground (n above 1.5) in 5 thin bands about 26 LEDs apart that tear into arcs; at the opening 43% in 8 bands 16 LEDs apart; wet, 55 to 65% in 9 thick bands 14 LEDs apart with only narrow slits of soil between them. The soil darkens a little and the shrubs go greener as it rises, and more of the thin edge shows at once. The band count follows the knob over 20 to 60 s.
// Knob 3: Slope. How steep the ground is, -1 to 1, opening at 0. The runoff runs v = 62 exp(0.49 K) LEDs per model time unit: 38, 62 and 101. A steeper slope gives fewer, wider-spaced bands (the band count goes as the square root of 62 / v: at the opening Rain 9, 8 and 6 bands), a faster creep (the time scale goes as 2^(0.45 K); at the opening Rain the bands move 0.35 to 0.65 LED a second at -1, 0.5 to 0.9 at 0 and 0.6 to 1.0 at 1, breathing with the gusts) and a longer, darker shade beside each band (x exp(0.35 K)). The creep and the shade show at once; the spacing takes 20 to 60 s to settle.
// Knob 4: Patchy. How unevenly the rain falls, and how well the bands hold together sideways. Rain at a spot is the year's rain times (1 + p f), f the drifting rain-cell field (rms 0.21, between -1 and 1) and p = 1.0 + 0.35 K, so 0.65 at -1 and 1.35 at 1. The lateral diffusion of the shrubs goes as exp(-0.65 K): 1.9 times the opening at -1, where the bands stay long and level with a few forks, and 0.52 at 1, where they tear into arcs, rings and islands. The rain cells show on the bare soil at once as damp and dry patches (the tone swings about 13% rms at 1.0).

// What the picture is. An aerial photograph of semi-arid ground on a slight slope, uphill at the top of the panel: tiger bush, shrubs in bands across the slope and bare crusted soil between them. The bands creep uphill. Runoff from the bare ground above a band soaks its upper edge, which thickens into a crisp dark line, while the lower edge starves and thins out into a soft olive fringe, so the band moves toward the water.
// This is Klausmeier's model, run in two dimensions on the 64 x 128 grid, one cell to the LED, with the slope along the long axis and the edges joined (a band that leaves the top comes back at the bottom, the left meets the right):
//   dw/dt = a - w - w n^2 + v dw/dy      water, running downhill (toward larger y) at speed v
//   dn/dt = w n^2 - m n + D (n_yy + dx n_xx)    shrub biomass, m = 0.45, D = 0.5 LED^2 per model time unit
// Water relaxes at 1 + n^2 per model time unit, far faster than a band moves, so each step solves it down each column exactly instead of stepping it: across one cell dw/ds = (a - k w) / v with k = 1 + n^2, so the water leaving a cell is a / k + (the water entering - a / k) exp(-k / v). The last row of one step feeds the first row of the next, which closes the loop. Biomass then takes an explicit step of 0.09 model time units with the five-point Laplacian; 1.35 model time units pass a second at the opening, and a second step is taken whenever a frame is long enough to need one.
// The rain is a(x, y, t) = a0 gust(t) (1 + p f(x, y, t)), held between 0.58 (below it the shrubs die back) and a_c - 0.07 (above it the cover goes solid). f is the sum of 14 waves of 10 to 128 LEDs across, each drifting along the slope with its own period of 30 to 80 s, so no arrangement of rain cells comes back; gust(t) is three sines of 47, 83 and 151 s. Every 2.5 to 7.5 s a clump takes root on damp bare ground (n + 3, radius 2.6) or a gap is cut in a band (radius 3.4 to 4.6), so bands fork, break and rejoin. The share of the panel with n above 1.5 is read every half second; if it falls under 0.14 or goes over 0.86 the rain is nudged between 0.65 and 1.5 times, which the 900 s runs at every corner of the knobs never needed.
// The first update starts a 1-D run with the band count the knobs ask for (a cosine start; any count from 3 up to about 11 is stable at the opening), slides its columns up and down by a slow wave across the width so the bands start out bent, and runs the 2-D model on for 30 s of panel time with the rain drifting, so the first frame is already a mature cover.
// The look: cover is a smooth step of n (broken up a little by two fixed textures, one 2 LEDs across and one 7), the shrub colour runs from dry olive through sage to deep green with n, the shade comes from the gradient of a smoothed canopy height with the sun low on the lower left (it swings by about 25 degrees over minutes), soil is ochre to terracotta in broad fixed blotches with a damp darkening where the runoff has gathered ahead of a band (w / a above 0.08) and a short shadow cast toward the top of the panel. The rain cells show as damp and dry soil. Brightness and warmth of the light drift by a few percent over 97, 121 and 143 s. The colours are set a little under the final saturation because the panel raises it 1.62 times.

const W = 64, H = 128, NP = W * H;
const { floor, sqrt, exp, sin, cos, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ---- the model (Klausmeier 1999, water solved along the slope)
const M = 0.45; // plant mortality
const DIFF = 0.5; // diffusion of biomass, LED^2 per model time
const DT = 0.09; // model time per step
const RATE = 1.35; // model time per second of the panel, at Slope 0

// periodic smooth noise from a coarse random grid, 0..1, for the soil and the crowns
function gridNoise(gw, gh) {
  const g = new Float32Array(gw * gh), out = new Float32Array(NP);
  for (let i = 0; i < g.length; i++) g[i] = Math.random();
  for (let y = 0; y < H; y++) {
    const fy = (y * gh) / H, y0 = floor(fy), ty = sm(0, 1, fy - y0), ya = (y0 % gh) * gw, yb = ((y0 + 1) % gh) * gw;
    for (let x = 0; x < W; x++) {
      const fx = (x * gw) / W, x0 = floor(fx), tx = sm(0, 1, fx - x0), xa = x0 % gw, xb = (x0 + 1) % gw;
      const top = g[ya + xa] + (g[ya + xb] - g[ya + xa]) * tx, bot = g[yb + xa] + (g[yb + xb] - g[yb + xa]) * tx;
      out[y * W + x] = top + (bot - top) * ty;
    }
  }
  return out;
}

export function setup(params) {
  params.s = makeState();
}

function makeState() {
  return {
    ready: false, t: 0, acc: 0,
    n: new Float32Array(NP), n2: new Float32Array(NP), w: new Float32Array(NP), rain: new Float32Array(NP),
    wc: new Float32Array(W).fill(0.2),
    kn: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06],
    cov: 0.5, steer: 1, chk: 0,
    nextEv: 6,
    ph: new Array(PW.length).fill(0),
    gp: [0, 0, 0],
    cx: new Float32Array(W), sx: new Float32Array(W), cy: new Float32Array(H), sy: new Float32Array(H),
    hgt: new Float32Array(NP), cvr: new Float32Array(NP), dns: new Float32Array(NP),
    t1: gridNoise(32, 64), t2: gridNoise(9, 16), t3: gridNoise(4, 8),
  };
}

// ---- rain: a patchy field that drifts, a gust factor for wet and dry years
const PW = [ // [cycles across the width, cycles down the height, weight, drift in cycles a second]
  [1, 1, 0.42, 0.0121],
  [2, -1, 0.32, -0.0158],
  [1, 3, 0.28, 0.0192],
  [3, 2, 0.24, -0.0233],
  [2, 5, 0.2, 0.0284],
  [4, -3, 0.16, -0.0325],
  [1, -2, 0.3, 0.0173],
  [3, 4, 0.18, 0.0217],
  [5, 2, 0.14, -0.0251],
  [2, -7, 0.16, 0.0297],
  [6, -5, 0.1, -0.0341],
  [3, 8, 0.12, 0.0263],
  [4, 6, 0.1, -0.0287],
  [1, 6, 0.14, 0.0239],
];
const PSUM = 2.8;

function rainField(S, P) {
  const t = S.t, pat = P.pat;
  const gust = 1 + 0.08 * sin(2 * PI * t / 83 + S.gp[0]) + 0.055 * sin(2 * PI * t / 151 + S.gp[1]) + 0.04 * sin(2 * PI * t / 47 + S.gp[2]);
  const base = P.a0 * gust * S.steer, lo = P.lo, hi = P.hi;
  const rn = S.rain;
  const cx = S.cx, sx = S.sx, cy = S.cy, sy = S.sy;
  const field = S.field || (S.field = new Float32Array(NP));
  field.fill(0);
  for (let k = 0; k < PW.length; k++) {
    const p = PW[k], ph = S.ph[k] + 2 * PI * p[3] * t;
    for (let x = 0; x < W; x++) { const A = 2 * PI * p[0] * x / W; cx[x] = cos(A); sx[x] = sin(A); }
    for (let y = 0; y < H; y++) { const B = 2 * PI * p[1] * y / H + ph; cy[y] = cos(B); sy[y] = sin(B); }
    const wt = p[2] / PSUM;
    for (let y = 0; y < H; y++) {
      const c = cy[y] * wt, s = sy[y] * wt, r = y * W;
      for (let x = 0; x < W; x++) field[r + x] += cx[x] * c - sx[x] * s;
    }
  }
  for (let i = 0; i < NP; i++) {
    const q = base * (1 + pat * field[i]);
    rn[i] = q < lo ? lo : q > hi ? hi : q;
  }
}

// ---- one step of the model
function step(S, dtm, v, dx) {
  const n = S.n, n2 = S.n2, w = S.w, a = S.rain, wc = S.wc;
  const inv = 1 / v;
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const i = r + x, ni = n[i], k = 1 + ni * ni, e = exp(-k * inv), weq = a[i] / k;
      const wi = weq + (wc[x] - weq) * e;
      w[i] = wi;
      wc[x] = wi;
    }
  }
  const dy = DIFF * dtm, dxx = DIFF * dx * dtm, md = M * dtm;
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = ((y + H - 1) % H) * W, rd = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const i = r + x, ni = n[i], xl = x === 0 ? W - 1 : x - 1, xr = x === W - 1 ? 0 : x + 1;
      const lap = dy * (n[ru + x] + n[rd + x] - 2 * ni) + dxx * (n[r + xl] + n[r + xr] - 2 * ni);
      const nn = ni + dtm * w[i] * ni * ni - md * ni + lap;
      n2[i] = nn < 0 ? 0 : nn;
    }
  }
  S.n = n2;
  S.n2 = n;
}

// A one-dimensional run for the first update: the bands the model settles to along the slope.
function profile(a, v, bands) {
  const N = H, n = new Float32Array(N), w = new Float32Array(N), lap = new Float32Array(N);
  for (let i = 0; i < N; i++) n[i] = max(0.05, 1.5 + 1.4 * cos((2 * PI * bands * i) / N) + 0.1 * Math.random());
  let wc = 0.2;
  for (let s = 0; s < 1700; s++) {
    for (let i = 0; i < N; i++) {
      const k = 1 + n[i] * n[i], e = exp(-k / v), weq = a / k;
      wc = weq + (wc - weq) * e;
      w[i] = wc;
    }
    for (let i = 0; i < N; i++) lap[i] = n[(i + 1) % N] + n[(i + N - 1) % N] - 2 * n[i];
    for (let i = 0; i < N; i++) {
      const nn = n[i] + 0.1 * (w[i] * n[i] * n[i] - M * n[i] + DIFF * lap[i]);
      n[i] = nn < 0 ? 0 : nn;
    }
  }
  return n;
}

function knobParams(S) {
  const k = S.ks;
  const u = cl(k[1], 0, 4) / 4, k3 = cl(k[2], -1, 1), k4 = cl(k[3], -1, 1);
  const v = 62 * exp(0.49 * k3);
  const ac = 1.25 + 0.0125 * v; // above this rain the cover goes solid
  const a0 = 0.95 + (ac - 0.18 - 0.95) * u;
  // the bands the cover settles to: more of them in wet years, fewer on a steep slope
  const bands = cl(Math.round((5 + 6 * u) * sqrt(62 / v)), 4, 9);
  return { a0, v, ac, u, bands, lo: 0.58, hi: ac - 0.07, pat: 1.0 + 0.35 * k4, dx: exp(-0.65 * k4), rate: RATE * Math.pow(2, 0.45 * k3) };
}

function init(S) {
  S.ready = true;
  S.ks = S.kn.slice();
  for (let i = 0; i < PW.length; i++) S.ph[i] = Math.random() * 2 * PI;
  for (let i = 0; i < 3; i++) S.gp[i] = Math.random() * 2 * PI;
  const P = knobParams(S);
  S.P = P;
  // columns of the 1-D profile, slid up and down by a slow wave across the width so the bands start out bent
  const prof = profile(P.a0, P.v, P.bands);
  const ph1 = Math.random() * 2 * PI, ph2 = Math.random() * 2 * PI;
  for (let x = 0; x < W; x++) {
    const sh = (0.6 + 4.2 * P.pat) * (0.64 * sin(2 * PI * x / W + ph1) + 0.36 * sin(4 * PI * x / W + ph2));
    for (let y = 0; y < H; y++) {
      const yy = y + sh, y0 = floor(yy), f = yy - y0;
      const a = prof[((y0 % H) + H) % H], b = prof[(((y0 + 1) % H) + H) % H];
      S.n[y * W + x] = a + (b - a) * f;
    }
  }
  rainField(S, P);
  // run it on for about 30 s of panel time, the rain drifting as it will, so the first frame is not a fresh start
  for (let s = 0; s < 420; s++) {
    if (s % 6 === 0) rainField(S, P);
    step(S, 0.1, P.v, P.dx);
    S.t += 0.1 / P.rate;
  }
  rainField(S, P);
}

// Now and then a clump takes root on damp bare ground or a gap opens in a band, so bands branch, break and rejoin.
function event(S) {
  const n = S.n, w = S.w, a = S.rain;
  const seed = Math.random() < (S.cov < 0.2 ? 0.8 : 0.5);
  for (let tries = 0; tries < 40; tries++) {
    const x = floor(Math.random() * W), y = floor(Math.random() * H), i = y * W + x;
    if (seed ? !(n[i] < 0.1 && w[i] / a[i] > 0.1) : !(n[i] > 4)) continue;
    const rad = seed ? 2.6 : 3.4 + 1.2 * Math.random(), R = 3 * floor(rad) + 1;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const g = exp(-(dx * dx + dy * dy) / (2 * rad * rad)), j = ((y + dy + H) % H) * W + ((x + dx + W) % W);
      if (seed) n[j] += 3 * g;
      else n[j] *= 1 - 0.97 * g;
    }
    return;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  if (input.knobValues) S.kn = input.knobValues;
  if (!S.ready) init(S);
  const sk = 1 - exp(-d / 0.3);
  for (let i = 0; i < 4; i++) S.ks[i] += (S.kn[i] - S.ks[i]) * sk;
  S.t += d;
  const P = knobParams(S);
  rainField(S, P);
  S.chk += d;
  if (S.chk >= 0.5) {
    S.chk = 0;
    let c = 0;
    const n = S.n;
    for (let i = 0; i < NP; i++) if (n[i] > 1.5) c++;
    S.cov = c / NP;
    if (S.cov < 0.14) S.steer = min(1.5, S.steer + 0.02);
    else if (S.cov > 0.86) S.steer = max(0.65, S.steer - 0.02);
    else S.steer += (1 - S.steer) * 0.03;
  }
  S.nextEv -= d;
  if (S.nextEv <= 0) {
    event(S);
    S.nextEv = (S.cov < 0.2 ? 1.5 : 2.5) + Math.random() * 5;
  }
  S.acc += d * P.rate * (1 + 0.16 * sin(2 * PI * S.t / 53 + S.gp[2]) + 0.1 * sin(2 * PI * S.t / 91 + S.gp[0]));
  while (S.acc >= DT) {
    step(S, DT, P.v, P.dx);
    S.acc -= DT;
  }
}

// ---- colour
const PAL = [
  // soil lit, soil dark, damp tint, dry plant, mid plant, deep plant, shadow tint
  { sa: [198, 172, 138], sb: [176, 138, 114], dm: [0.78, 0.7, 0.66], dr: [156, 150, 112], md: [100, 124, 88], dp: [44, 84, 60], sh: [0.72, 0.66, 0.7] },
  { sa: [178, 172, 158], sb: [150, 144, 134], dm: [0.82, 0.84, 0.88], dr: [150, 148, 112], md: [88, 118, 98], dp: [40, 78, 76], sh: [0.68, 0.7, 0.78] },
  { sa: [204, 170, 156], sb: [178, 132, 124], dm: [0.78, 0.7, 0.72], dr: [154, 146, 110], md: [78, 120, 102], dp: [34, 82, 78], sh: [0.72, 0.64, 0.74] },
  { sa: [122, 110, 106], sb: [100, 90, 90], dm: [0.82, 0.8, 0.82], dr: [146, 154, 100], md: [88, 128, 80], dp: [34, 92, 60], sh: [0.72, 0.72, 0.8] },
];
const KEYS = ["sa", "sb", "dm", "dr", "md", "dp", "sh"];

function palette(hue) {
  const p = (((hue % 1) + 1) % 1) * PAL.length, i = floor(p), f = sm(0, 1, p - i);
  const A = PAL[i % PAL.length], B = PAL[(i + 1) % PAL.length], out = {};
  for (const key of KEYS) out[key] = [mix(A[key][0], B[key][0], f), mix(A[key][1], B[key][1], f), mix(A[key][2], B[key][2], f)];
  return out;
}


function bilin(a, fx, fy) {
  const x0 = floor(fx), y0 = floor(fy), tx = fx - x0, ty = fy - y0;
  const xa = ((x0 % W) + W) % W, xb = (xa + 1) % W, ya = (((y0 % H) + H) % H) * W, yb = ((((y0 + 1) % H) + H) % H) * W;
  const top = a[ya + xa] + (a[ya + xb] - a[ya + xa]) * tx, bot = a[yb + xa] + (a[yb + xb] - a[yb + xa]) * tx;
  return top + (bot - top) * ty;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const pal = palette(S.ks[0]);
  const relief = 2.6 * exp(0.35 * cl(S.ks[2], -1, 1)); // a steeper slope throws more shade
  // the light drifts over minutes: the sun swings a little, cloud thins and thickens, the tint warms and cools
  const T2 = 2 * PI * S.t, th = 0.41 + 0.32 * sin(T2 / 173 + S.gp[0] * 2) + 0.12 * sin(T2 / 67 + S.gp[1] * 3);
  const SUN = [-sin(th), cos(th)];
  const lum = 1 + 0.05 * sin(T2 / 97 + S.gp[1]) + 0.035 * sin(T2 / 143 + S.gp[2] * 2), warm = 0.04 * sin(T2 / 121 + S.gp[0] * 3);
  const lr = lum * (1 + warm), lg = lum, lb = lum * (1 - warm);
  const n = S.n, w = S.w, hg = S.hgt, cv = S.cvr, dn = S.dns, a = S.rain, t1 = S.t1, t2 = S.t2, t3 = S.t3, fld = S.field, P = S.P, u = P.u, pt = P.pat;
  const wk = 7.5 * (0.35 + 0.65 * pt); // rain cells show on the soil as damp and dry patches
  const c0 = 0.75 - 0.3 * (u - 0.5); // wetter years show more of the thin edge
  for (let i = 0; i < NP; i++) {
    const ni = n[i];
    hg[i] = 1 - exp(-ni / 3);
    const eff = ni * (0.74 + 0.52 * (0.3 * t1[i] + 0.7 * t2[i]));
    cv[i] = sm(c0, c0 + 1.3, eff);
    dn[i] = sm(1.5, 7.5, eff);
  }
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = ((y + H - 1) % H) * W, rd = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const i = r + x, xl = x === 0 ? W - 1 : x - 1, xr = x === W - 1 ? 0 : x + 1;
      const gx = (hg[r + xr] - hg[r + xl]) * 0.5, gy = (hg[rd + x] - hg[ru + x]) * 0.5;
      const lit = cl(-(gx * SUN[0] + gy * SUN[1]) * relief, -1, 1);
      const c = cv[i], wet = fld[i] * wk, dens = cl(dn[i] + 0.14 * (u - 0.5) + 0.07 * wet, 0, 1);
      // soil: ochre to terracotta in broad blotches, a little grain, damp where the runoff gathers, a short shadow under the canopy
      const sv = cl(0.5 + (t3[i] - 0.5) * 1.8 + (t1[i] - 0.5) * 0.5, 0, 1);
      let sr = mix(pal.sa[0], pal.sb[0], sv), sg = mix(pal.sa[1], pal.sb[1], sv), sb = mix(pal.sa[2], pal.sb[2], sv);
      const damp = sm(0.08, 0.18, w[i] / a[i]), tone = (1.06 - 0.12 * u - 0.085 * wet) * (0.96 + 0.08 * t1[i]);
      sr *= mix(1, pal.dm[0], damp) * tone; sg *= mix(1, pal.dm[1], damp) * tone; sb *= mix(1, pal.dm[2], damp) * tone;
      const shd = max(0, bilin(cv, x + SUN[0] * 1.8, y + SUN[1] * 1.8) - c) * 0.8;
      sr *= mix(1, pal.sh[0], shd); sg *= mix(1, pal.sh[1], shd); sb *= mix(1, pal.sh[2], shd);
      // plant: dry olive at the thin edge, deep green in the core, lit on the sunward side
      let pr, pg, pb;
      if (dens < 0.5) { const q = dens * 2; pr = mix(pal.dr[0], pal.md[0], q); pg = mix(pal.dr[1], pal.md[1], q); pb = mix(pal.dr[2], pal.md[2], q); }
      else { const q = dens * 2 - 1; pr = mix(pal.md[0], pal.dp[0], q); pg = mix(pal.md[1], pal.dp[1], q); pb = mix(pal.md[2], pal.dp[2], q); }
      const lf = (1 + 0.32 * lit) * (0.93 + 0.14 * t1[i]);
      pr *= lf; pg *= lf; pb *= lf;
      const rr = mix(sr, pr, c), gg = mix(sg, pg, c), bb = mix(sb, pb, c);
      display.setPixel(x, y, cl(rr * lr, 0, 255) | 0, cl(gg * lg, 0, 255) | 0, cl(bb * lb, 0, 255) | 0);
    }
  }
}
