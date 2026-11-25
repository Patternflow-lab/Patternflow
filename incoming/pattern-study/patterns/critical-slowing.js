// ===== Patternflow pattern =====
// Title:   Critical Slowing
// Family:  tipping
// Idea:    The panel is four stacked side views of one bistable landscape, each with its own wandering control parameter and its own swarm of about two dozen noisy balls, so at any moment one band is calm and tight, one is flattening and swelling, one is pouring white-hot over its ledge and one is settled in the far well, and every band tips at its own time.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: critical slowing down before a saddle-node bifurcation (Wissel 1984; Scheffer et al. 2009, "Early-warning signals for critical transitions": variance and lag-1 autocorrelation rise as the restoring force weakens, from memory), hysteresis of a bistable system in the potential U = x^4/4 + c x^3/3 - x^2/2 - r x under overdamped Langevin noise (Euler-Maruyama substeps of 1/120 s), pattern round 241
// Round:   241
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Noise=0..4, Drift=-1..1, Bands=0..1
//
// Knob 1: Hue. Turns the whole colour ramp round the wheel. At 0 a calm swarm and its landscape are teal, a well that is flattening goes blue, violet and rose, the plateau and the balls on it amber, and a swarm in free fall white. At 0.25 the calm colour is violet and the warm end green, at 0.5 rose and blue-green, at 0.75 amber and blue.
// Knob 2: Noise. 0 to 4, opening at 2. The strength of the Langevin noise on every ball, 0.08 at 0, 0.32 at 2 and 0.56 at 4, and each band's own share of it wanders between about 0.5 and 1.5 times that. At 0 each swarm is a tight bright knot of dots a column or two wide that holds on until its well is gone. At 2 it is a knot about 6 columns wide in a stiff well that swells to 20 or more on the plateau, with single dots standing off from it. At 4 it is a fat cloud of separate dots that spreads over the hump before the fold, tips early and splits between the two wells.
// Knob 3: Drift. -1 to 1, opening at 0. How fast every control parameter wanders and so the clock of the whole story, 0.47 at -1, 1 at 0 and 2.1 at 1 (the balls themselves only speed up as the cube root of that). At 0 a well vanishes somewhere on the panel every half minute, each band on its own schedule, and some approaches turn back short of the fold. At 1 the story runs twice as fast and swarms lag behind their landscapes; at -1 the swelling and slowing stay in view for minutes.
// Knob 4: Bands. 0 to 1, opening at 0.06. How many landscapes are stacked, 4 up to 0.24, 5 from 0.25 to 0.74 and 6 from 0.75, from the top band down, each with its swarm of 24 balls in a band of 32 rows (16 in a band of 21). All six systems keep running when they are off the panel, so a band that comes back is in a new phase of its story.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sqrt, sin, cos, tanh, acos, cbrt, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- the landscape ------------------------------------------------------------
// U(x; r) = x^4/4 + c x^3/3 - x^2/2 - r x. At r = 0 two wells, the left one narrow and stiff, the right one wide. Raising r lifts
// the left well and sinks the right one until the left well's minimum and the hump meet at the fold (r about 0.4 to 0.53), where
// U'' = 0 and the bottom is a plateau. Lowering r does the same to the right well at about -0.37 to -0.29, so a swarm has to be taken a
// long way back before the old well returns: hysteresis.
const SC = 19.5;                     // columns a unit
const UC = 0.05;                     // the potential drawn on the middle row of a band
const SA = 0.5, SB = 0.35;           // heights past SA either side of the middle are squeezed, so the walls stay inside the band
const HSB = 15;                      // rows a unit of height in a band of 32 rows
const dU = (x, r, c) => x * x * x + c * x * x - x - r;
const d2U = (x, c) => 3 * x * x + 2 * c * x - 1;
const Upot = (x, r, c) => (x * x * x * x) / 4 + (c * x * x * x) / 3 - (x * x) / 2 - r * x;
function soft(z) {
  const a = abs(z);
  return a <= SA ? z : (z < 0 ? -1 : 1) * (SA + SB * tanh((a - SA) / SB));
}
function dsoft(z) {
  const a = abs(z);
  if (a <= SA) return 1;
  const t = tanh((a - SA) / SB);
  return 1 - t * t;
}
// the real roots of U' = 0, smallest first
function roots(r, c) {
  const p = -1 - (c * c) / 3, q = (2 * c * c * c) / 27 + c / 3 - r;
  const disc = 4 * p * p * p + 27 * q * q;
  if (disc < 0) {
    const m = 2 * sqrt(-p / 3), th = acos(cl(((3 * q) / (2 * p)) * sqrt(-3 / p), -1, 1)) / 3;
    return [0, 1, 2].map((k) => m * cos(th - (TAU * k) / 3) - c / 3).sort((a, b) => a - b);
  }
  const s = sqrt((q * q) / 4 + (p * p * p) / 27);
  return [cbrt(-q / 2 + s) + cbrt(-q / 2 - s) - c / 3];
}
// the control parameter at which the left well (L) or the right well (R) vanishes
function fold(c, left) {
  const x = (-c + (left ? -1 : 1) * sqrt(c * c + 3)) / 3;
  return x * x * x + c * x * x - x;
}
const heatTarget = (x, c) => Math.pow(cl(1 - d2U(x, c) / 1.7, 0, 1), 1.3);

// ---- colours --------------------------------------------------------------------
// Heat u 0..1: teal when the well is stiff, then blue, violet and rose as it flattens, amber at the fold. White is added on top for
// a swarm that is falling. The hue knob turns the wheel under all of it.
const LUTN = 96;
function hsv2(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function buildLut(lut, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < LUTN; i++) {
    const u = i / (LUTN - 1);
    // the base hue 0.53 is teal, so a knob of 0 leaves it there and 1 brings it round again; the warm end is 0.56 further on
    hsv2(0.53 + hue + 0.56 * sstep(0.2, 0.92, u), 0.85 - 0.25 * sin(PI * u), 1, c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}
// How far a hue h is on the red-orange-yellow-olive stretch of the wheel, where a dim colour reads brown on the panel.
function brownish(h) {
  const c = h - floor(h);
  return c > 0.5 ? sstep(0.8, 0.95, c) : 1 - sstep(0.2, 0.36, c);
}

// ---- state ----------------------------------------------------------------------
const NBMAX = 6, NMAX = 80;
const TS0 = 3.0;                     // model time a second
const R_MEAN = 0.085;
const A1 = 0.30, A2 = 0.20, TOU = 16, SOU = 0.13;
// every band has periods of its own, none dividing another, for the control parameter and for the landscape's three slow wanderers
const T1S = [127, 109.3, 143.7, 97.1, 156.3, 89.9];
const T2S = [51.7, 61.3, 43.9, 67.1, 57.3, 38.9];
const T3 = [104.0, 53.7, 127.3, 58.3, 79.1, 37.1];
const T3K = [1, 1.13, 0.89, 1.21, 0.94, 1.07];
// where each band is in its story when the panel opens: which well the swarm is in, and how far its control parameter is from the fold
const START = [[0, 0.62], [0, 0.2], [0, 0.05], [1, 0.3], [1, 0.55], [0, 0.38]];
const TIER = [1.6, 3.1, 4.6, 6.1];   // rows above the curve of the four heights a ball can sit at, so a knot of balls is a heap and not one disc

function newBand(b) {
  return {
    T1: T1S[b], T2: T2S[b], k3: T3K[b],
    ph: [0, 0], ph2: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU],
    ou: 0, r: 0, c: 0.2, xc: -0.1, hs: 1, nm: 1, ph3: [rnd() * TAU, rnd() * TAU],
    n: 24, x: new Float32Array(NMAX), tier: new Uint8Array(NMAX), tw: new Float32Array(NMAX), twf: new Float32Array(NMAX),
    heat: new Float32Array(NMAX), lp: new Float32Array(NMAX), gl: new Float32Array(NMAX),
    heatM: 0, F: 0, nacc: 0, yc: new Float32Array(W + 2), nv: new Float32Array(W),
    fillL: new Float32Array(48 * 3), skyL: new Float32Array(48 * 3),
  };
}
function newBall(bd, j, x) {
  bd.x[j] = x;
  bd.tier[j] = floor(rnd() * 4);
  bd.tw[j] = rnd() * TAU;
  bd.twf[j] = 0.6 + rnd() * 1.4;
  bd.heat[j] = 0;
  bd.lp[j] = 0;
  bd.gl[j] = 0;
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, hue: -9, s: 0, sig: 0.32, m: 1, nb: 4,
    lut: new Float32Array(LUTN * 3),
    bR: new Float32Array(W * H), bG: new Float32Array(W * H), bB: new Float32Array(W * H),
    b: [],
  });
  for (let i = 0; i < NBMAX; i++) st.b.push(newBand(i));
  return st;
}

function rOf(st, bd) {
  return R_MEAN + A1 * sin((TAU * st.s) / bd.T1 + bd.ph[0]) + A2 * sin((TAU * st.s) / bd.T2 + bd.ph[1]) + bd.ou;
}
// the landscape's own slow wanderers: the cubic term (0.05 to 0.35, which moves the folds), the stretch of its height, its sideways drift
function shape(st, bd) {
  const s = st.s / bd.k3, p = bd.ph2;
  bd.c = 0.2 + 0.09 * sin((TAU * s) / T3[0] + p[0]) + 0.06 * sin((TAU * s) / T3[1] + p[1]);
  bd.hs = 1 + 0.14 * sin((TAU * s) / T3[2] + p[2]) + 0.08 * sin((TAU * s) / T3[3] + p[3]);
  bd.nm = 1 + 0.3 * sin((TAU * s) / 71.3 + bd.ph3[0]) + 0.18 * sin((TAU * s) / 43.7 + bd.ph3[1]);
  bd.xc = -0.1 + 0.15 * sin((TAU * s) / T3[4] + p[4]) + 0.09 * sin((TAU * s) / T3[5] + p[5]);
}

function knobsToState(st) {
  const k = st.k;
  st.sig = 0.08 + 0.12 * cl(k[1], 0, 4);
  st.m = Math.pow(2, 1.1 * cl(k[2], -1, 1));
  st.nb = cl(round(4 + 2 * cl(k[3], 0, 1)), 4, 6);
}

function initBand(st, b) {
  const bd = st.b[b], side = START[b][0], dist = START[b][1];
  shape(st, bd);
  const tgt = side === 0 ? fold(bd.c, true) - dist : fold(bd.c, false) + dist;
  // phases that put this band's control parameter where its part of the story begins, moving toward the fold it is heading for
  let best = 9;
  let bph = null, bou = 0;
  for (let tries = 0; tries < 400; tries++) {
    bd.ph = [rnd() * TAU, rnd() * TAU];
    bd.ou = 0.5 * SOU * gauss();
    const r = rOf(st, bd), sl = ((TAU * A1) / bd.T1) * cos((TAU * st.s) / bd.T1 + bd.ph[0]) + ((TAU * A2) / bd.T2) * cos((TAU * st.s) / bd.T2 + bd.ph[1]);
    const toward = side === 0 ? sl : -sl;
    const bad = abs(r - tgt) + 12 * max(0, 0.004 - toward) + 12 * max(0, toward - 0.011);
    if (bad < best) {
      best = bad;
      bph = bd.ph.slice();
      bou = bd.ou;
    }
    if (bad < 0.03) break;
  }
  bd.ph = bph;
  bd.ou = bou;
  bd.r = rOf(st, bd);
  const rt = roots(bd.r, bd.c), x0 = side === 0 ? rt[0] : rt[rt.length - 1];
  bd.n = 24;
  for (let j = 0; j < bd.n; j++) newBall(bd, j, x0 + 0.05 * gauss());
  // let the swarm find the shape of its well before the first frame
  for (let i = 0; i < 420; i++) {
    const hm = 0.02, nz = st.sig * bd.nm * sqrt(hm);
    for (let j = 0; j < bd.n; j++) bd.x[j] = cl(bd.x[j] - dU(bd.x[j], bd.r, bd.c) * hm + nz * gauss(), -1.7, 1.5);
  }
  for (let j = 0; j < bd.n; j++) {
    bd.heat[j] = heatTarget(bd.x[j], bd.c);
    bd.lp[j] = dU(bd.x[j], bd.r, bd.c);
  }
  bd.heatM = bd.heat[0];
}

// One frame's worth of Euler-Maruyama steps, none longer than 1/120 of a second.
function swarm(st, bd, dt) {
  const nsub = max(1, Math.ceil(dt * 120)), h = dt / nsub, hm = h * TS0 * Math.pow(st.m, 0.33), nz = st.sig * bd.nm * sqrt(hm), r = bd.r, c = bd.c, n = bd.n, x = bd.x;
  for (let i = 0; i < nsub; i++) {
    for (let j = 0; j < n; j++) {
      let v = x[j] - dU(x[j], r, c) * hm + nz * gauss();
      if (v < -1.7) v = -1.7 + (-1.7 - v) * 0.3;
      else if (v > 1.5) v = 1.5 - (v - 1.5) * 0.3;
      x[j] = v;
    }
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  knobsToState(st);
  if (!st.init) {
    st.init = true;
    // The story starts as if forty-five clock-seconds old, so the Drift knob has had time to matter.
    st.s = 45 * st.m;
    for (let b = 0; b < NBMAX; b++) initBand(st, b);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  const ds = dt * st.m;
  st.s += ds;
  const nTarget = round((24 * (H / st.nb)) / 32);
  for (let b = 0; b < NBMAX; b++) {
    const bd = st.b[b];
    // the control parameter: two slow sines that do not share a period, and an Ornstein-Uhlenbeck wander on top
    bd.ou += -(bd.ou / TOU) * ds + SOU * sqrt((2 * ds) / TOU) * gauss();
    shape(st, bd);
    bd.r = rOf(st, bd);
    swarm(st, bd, dt);
    // balls come and go one at a time, a ball cloned from the swarm and put a hair to one side
    if (b < st.nb) {
      bd.nacc += dt;
      while (bd.nacc > 0.025) {
        bd.nacc -= 0.025;
        if (bd.n < nTarget) {
          const src = floor(rnd() * bd.n), j = bd.n;
          newBall(bd, j, bd.x[src] + 0.02 * gauss());
          bd.heat[j] = bd.heat[src];
          bd.lp[j] = bd.lp[src];
          bd.n++;
        } else if (bd.n > nTarget) {
          const j = floor(rnd() * bd.n), l = bd.n - 1;
          bd.x[j] = bd.x[l];
          bd.tier[j] = bd.tier[l];
          bd.tw[j] = bd.tw[l];
          bd.twf[j] = bd.twf[l];
          bd.heat[j] = bd.heat[l];
          bd.lp[j] = bd.lp[l];
          bd.gl[j] = bd.gl[l];
          bd.n--;
        }
      }
    }
    // per ball: how flat the ground is under it (heat), the drift it has been feeling for a fifth of a second (a fall is a drift
    // that does not change sign, noise is one that does), and a glint now and then
    const n = bd.n, r = bd.r, c = bd.c, a1 = 1 - exp(-dt / 0.45), a2 = 1 - exp(-dt / 0.2), dec = exp(-dt / 0.25), pg = dt * 0.05;
    let hs = 0, ho = 0;
    for (let j = 0; j < n; j++) {
      bd.heat[j] += (heatTarget(bd.x[j], c) - bd.heat[j]) * a1;
      bd.lp[j] += (dU(bd.x[j], r, c) - bd.lp[j]) * a2;
      bd.gl[j] *= dec;
      if (rnd() < pg) bd.gl[j] = 1;
      hs += bd.heat[j];
      ho += sstep(0.3, 0.65, abs(bd.lp[j]));
    }
    bd.heatM += (hs / n - bd.heatM) * (1 - exp(-dt / 0.8));
    bd.F += (ho / n - bd.F) * (1 - exp(-dt / 0.3));
  }
}

// ---- drawing --------------------------------------------------------------------
export function draw(display, params) {
  if (!params.st) setup(params);
  const st = params.st;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.hue) > 1e-4) {
    st.hue = st.k[0];
    buildLut(st.lut, st.hue);
  }
  const lut = st.lut, nb = st.nb, hue0 = 0.53 + st.k[0];
  const bR = st.bR, bG = st.bG, bB = st.bB;
  bR.fill(0);
  bG.fill(0);
  bB.fill(0);
  const c3 = [0, 0, 0];
  const wsc = 0.95;
  for (let b = 0; b < nb; b++) {
    const bd = st.b[b], y0 = floor((b * H) / nb), y1 = floor(((b + 1) * H) / nb), hb = y1 - y0;
    const hsr = HSB * (hb / 32) * bd.hs, yb = y0 + 0.5 * hb, r = bd.r, c = bd.c, F = bd.F, yc = bd.yc, nv = bd.nv;
    // the curve, a column at a time (yc[i + 1] is column i, so the slope can look a column either side)
    for (let i = -1; i <= W; i++) {
      const x = bd.xc + (i + 0.5 - 32) / SC;
      yc[i + 1] = yb - hsr * soft(Upot(x, r, c) - UC);
    }
    for (let i = 0; i < W; i++) {
      const sl = (yc[i + 2] - yc[i]) * 0.5;
      nv[i] = 1 / sqrt(1 + sl * sl);
    }
    // the band's colours: the swarm's heat, and white as it falls
    const hu = cl(bd.heatM * 1.55, 0, 1), li = hu * (LUTN - 1), li0 = floor(li), li1 = min(LUTN - 1, li0 + 1), lf = li - li0;
    const tr = lut[li0 * 3] * (1 - lf) + lut[li1 * 3] * lf, tg = lut[li0 * 3 + 1] * (1 - lf) + lut[li1 * 3 + 1] * lf, tb = lut[li0 * 3 + 2] * (1 - lf) + lut[li1 * 3 + 2] * lf;
    const fw = 0.65 * F;
    const lr = (tr * (1 - fw) + fw) * 190, lg = (tg * (1 - fw) + fw) * 190, lb = (tb * (1 - fw) + fw) * 190;
    // The ground and the haze keep to the cool half of the ramp, so the amber stays on the curve and the balls where it is bright; a dim
    // warm tint is lifted and paled so it does not go brown.
    const ug = min(hu, 0.55), hg = hue0 + 0.56 * sstep(0.2, 0.92, ug), sg = 0.85 - 0.25 * sin(PI * ug), br = brownish(hg);
    const FL = bd.fillL, SK = bd.skyL;
    for (let i = 0; i < 48; i++) {
      const d = i + 0.5;
      const v = (0.08 + 0.3 * exp(-d / 7)) * (1 + 0.5 * F), vv = min(1, v * (1 + 1.1 * br * (1 - v))), ss = sg * (1 - 0.45 * br * (1 - v));
      hsv2(hg, ss, vv, c3, 0);
      FL[i * 3] = c3[0] * 255;
      FL[i * 3 + 1] = c3[1] * 255;
      FL[i * 3 + 2] = c3[2] * 255;
      const v2 = 0.065 + 0.11 * exp(-d / 8), vv2 = min(1, v2 * (1 + 1.1 * br * (1 - v2))), ss2 = sg * (1 - 0.45 * br * (1 - v2));
      hsv2(hg, ss2, vv2, c3, 0);
      SK[i * 3] = c3[0] * 255;
      SK[i * 3 + 1] = c3[1] * 255;
      SK[i * 3 + 2] = c3[2] * 255;
    }
    // the balls, each a soft dot with a bright core
    for (let j = 0; j < bd.n; j++) {
      const x = bd.x[j];
      const px = 32 + (x - bd.xc) * SC, z = Upot(x, r, c) - UC;
      const y = yb - hsr * soft(z), sl = (-hsr * dsoft(z) * dU(x, r, c)) / SC, nn = 1 / sqrt(1 + sl * sl);
      const off = TIER[bd.tier[j]];
      const bx = px + off * sl * nn, by = y - off * nn;
      // colour: the heat of the ground it stands on, going to white in a fall or a glint
      const hu2 = cl(bd.heat[j], 0, 1) * (LUTN - 1), i0 = floor(hu2), i1 = min(LUTN - 1, i0 + 1), f = hu2 - i0;
      const w = max(sstep(0.3, 0.65, abs(bd.lp[j])), bd.gl[j]) * 0.85;
      const cr = (lut[i0 * 3] * (1 - f) + lut[i1 * 3] * f) * (1 - w) + w, cg = (lut[i0 * 3 + 1] * (1 - f) + lut[i1 * 3 + 1] * f) * (1 - w) + w, cb = (lut[i0 * 3 + 2] * (1 - f) + lut[i1 * 3 + 2] * f) * (1 - w) + w;
      const tw = 0.8 + 0.2 * sin(bd.tw[j] + bd.twf[j] * st.t * 2.3);
      const bb = tw * (1 + 0.5 * w) * wsc;
      const x0 = floor(bx - 3), yy0 = floor(by - 3);
      for (let yy = max(y0, yy0); yy <= min(y1 - 1, yy0 + 6); yy++) {
        const dy = yy + 0.5 - by;
        for (let xx = max(0, x0); xx <= min(W - 1, x0 + 6); xx++) {
          const dx = xx + 0.5 - bx, d2 = dx * dx + dy * dy;
          const a = bb * (exp(-d2 / 0.72) + 0.16 * exp(-d2 / 7.2));
          const o = yy * W + xx;
          bR[o] += a * cr;
          bG[o] += a * cg;
          bB[o] += a * cb;
        }
      }
    }
    // compose the band
    for (let cx = 0; cx < W; cx++) {
      const yct = yc[cx + 1], inv = nv[cx];
      for (let row = y0; row < y1; row++) {
        const dy = row + 0.5 - yct, d = dy * inv, ad = abs(d), rin = row - y0;
        let R, G, B;
        // a dark seam at the top and bottom row of every band
        const seam = min(sstep(0, 2.2, rin), sstep(0, 2.2, hb - 1 - rin) * 0.9 + 0.1);
        const di = min(47, floor(ad)) * 3;
        if (dy > 0) {
          R = FL[di];
          G = FL[di + 1];
          B = FL[di + 2];
        } else {
          R = SK[di];
          G = SK[di + 1];
          B = SK[di + 2];
        }
        const line = sstep(1.6, 0.6, ad), glow = 0.2 * exp(-ad / 2.4);
        const lk = line + glow;
        R = (R + lr * lk) * seam;
        G = (G + lg * lk) * seam;
        B = (B + lb * lk) * seam;
        const o = row * W + cx;
        R += bR[o] * 255;
        G += bG[o] * 255;
        B += bB[o] * 255;
        // soft shoulder so a crowd of balls goes pale and bright, not clipped
        const m = max(R, G, B);
        if (m > 140) {
          const k = (140 + 115 * (1 - exp(-(m - 140) / 120))) / m;
          R *= k;
          G *= k;
          B *= k;
        }
        display.setPixel(cx, row, R | 0, G | 0, B | 0);
      }
    }
  }
}
