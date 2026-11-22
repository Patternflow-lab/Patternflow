// ===== Patternflow pattern =====
// Title:   Parallel Coordinates
// Family:  multivariate
// Idea:    A parallel-coordinates plot of a drifting Gaussian mixture in six dimensions: each data point is one polyline crossing six vertical axes at its six values, so every cluster is a ribbon that zig-zags down the tall panel, running as a parallel band where neighbouring features correlate and pinching to a crossing waist where they anti-correlate, while the clusters wander through one another, split and merge, and a brush band lights the one ribbon it rests on.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Parallel coordinates (Maurice d'Ocagne, 1885, for nomograms; re-found by Alfred Inselberg in 1959 and developed by him as a plot of many-dimensional points, 1985, where a straight line of points becomes a pencil of lines through one point), their use to find clusters (Edward Wegman, 1990), brushing a selection (Richard Becker and William Cleveland, 1987), the Ornstein-Uhlenbeck walk that drives the drift (Leonard Ornstein and George Uhlenbeck, 1930); pattern round 222
// Round:   222
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0..3, Spread=-1..1, Correlation=-1..1
//
// Knob 1: Hue. Adds the knob, in turns of the colour wheel, to the hue of every cluster, so 0 to 1 goes once round. At the opening 0 the four clusters are cyan (0.50), magenta (0.86), amber (0.12) and azure (0.60); a fifth, born when a cluster splits, is green (0.37). Where two ribbons cross, the pixel takes the hue of the denser one and the other only tints it, so a cyan ribbon crossing an amber one shows green only along a thin seam.
// Knob 2: Drift. How fast the clusters wander, split and merge. The scene clock runs at 0.03 plus 0.36 times the knob: 0.03 at 0, 0.75 at the opening 2 and 1.1 at 3. At 0 the ribbons hold nearly still and only each line's own sway (0.35 of a standard deviation, 0.12 to 0.4 rad/s) and the brush move. A mean forgets where it was in 22 clock seconds (29 s at the opening) and a split or a merge comes every 18 to 46 clock seconds, the first at 24 (32 s at the opening).
// Knob 3: Spread. Scales how wide every cluster is by e to the 0.8 times the knob: 0.45 at -1, 1 at 0 and 2.2 at 1. At 0 a typical line lies 6 LEDs (one standard deviation, 0.042 of the axis height of 143 LEDs, times its own scale, a heavy-tailed 0.4 to 3) from the middle of its cluster; at -1 the ribbons are tight cables a few LEDs across, at 1 they open into fans that cross one another.
// Knob 4: Correlation. Pushes the correlation between neighbouring axes: rho is 0.95 times tanh of 2 times (0.6 q plus 1.5 times the knob), where q is a walk of its own for each pair of axes, with spread 1 and a memory of 14 clock seconds. At -1 nearly every pair sits near -0.94, so each ribbon pinches to a waist half way between two axes and opens again; at 1 nearly every pair sits near 0.94 and the ribbons run as bands of constant width; at the opening 0.06 each pair wanders between the two, so one cluster is a band on one stretch and a crossing on the next.

// Data. 240 points, each with a fixed vector of six standard normal scores z and a scale of its own, belong to 4 clusters at the start
// and 3 to 5 later (5 slots). A cluster has a mean profile over the six axes (level, tilt and curvature plus a residual for each
// axis, every one an Ornstein-Uhlenbeck walk pulled to a home value of its slot), a log spread for each axis (also a walk, so the
// cluster breathes) and a correlation for each neighbouring pair (a walk pushed through tanh). A point's values are made along the
// axes: u(0) = z(0), u(j) = rho u(j-1) + sqrt(1 - rho^2) z(j), a Gaussian with that chain of correlations, and
// value(j) = mean(j) + spread(j) scale u(j). The z never change, so a point moves only with its cluster and the ribbons slide
// where a redraw would flicker. A value goes to a row by a soft clip, so a stray bends along the top or bottom edge.
// Events. Every 18 to 46 clock seconds one cluster splits or two merge. A split gives half the points of a cluster of 44 or more
// (those on one side of a random plane through their z) to a new cluster that starts as a copy of the old one, then both are
// pushed apart along that plane and ease back. A merge takes the two clusters with the nearest means and pulls the smaller onto
// the larger, its colour too, over about 20 clock seconds; its points change cluster when the two look alike. With 3 clusters it
// splits, with 5 it merges, with 4 it splits 45 times in 100.
// Drawing. A polyline segment between two axes is drawn a column at a time with a Gaussian profile of sigma 0.85 LED across the
// line, into a plane for its cluster, so the two ends of a joint share the light. Each plane is blurred (5 taps, 1 4 6 4 1) and
// added back at half strength for a glow. The light of a pixel is the sum of the planes, tone mapped so that a lone stray line is
// dim and the lines of a cluster's core reach full brightness.
// The brush is a soft band, sigma 8 LEDs, on one axis. It rests on one cluster for 12 to 26 brush seconds, sliding up and down
// over that cluster's ribbon, then moves to another, and to another axis every 40 to 80. A line that passes through the band is
// up to 5 times as bright and a fifth of its light is turned white.

const W = 64, H = 128, ND = 6, NP = 240, MC = 5;
const { floor, sqrt, exp, log, sin, cos, tanh, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const AXX = [5.5, 16.1, 26.7, 37.3, 47.9, 58.5]; // the six axes, in LED units (pixel centres at +0.5)
const SLOT_HUE = [0.5, 0.86, 0.12, 0.6, 0.37]; // cyan, magenta, amber, azure, green
const HOME = [
  [0.3, -0.14, 0.1],
  [0.7, 0.16, -0.08],
  [0.5, 0.0, 0.16],
  [0.78, -0.1, -0.12],
  [0.22, 0.12, -0.05],
];
const MODE_SD = [0.15, 0.2, 0.17]; // stationary spread of the level, tilt and curvature walks
const RES_SD = 0.06;
const TAU = 22; // clock seconds a walk takes to forget
const BASE_SPREAD = 0.042; // a point's own scale, e to a normal of 0.5, makes the tails heavier than a Gaussian's
const SIGMA = 0.85; // LED, the perpendicular sigma of a line
const CUT = 2.5; // LED, where a line stops
const LUTN = 256;
const LUT = new Float32Array(LUTN + 1);
for (let i = 0; i <= LUTN; i++) LUT[i] = exp(-0.5 * ((i / LUTN) * CUT * CUT) / (SIGMA * SIGMA));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mkCluster(S, slot) {
  const g = S.gauss;
  const c = {
    on: false, n: 0, hue: SLOT_HUE[slot], slot,
    mode: new Float64Array(3), res: new Float64Array(ND), po: new Float64Array(ND), pt: new Float64Array(ND), so: new Float64Array(ND), q: new Float64Array(ND),
    mu: new Float64Array(ND), sd: new Float64Array(ND), rho: new Float64Array(ND), rs: new Float64Array(ND),
  };
  for (let m = 0; m < 3; m++) c.mode[m] = HOME[slot][m] + MODE_SD[m] * g();
  for (let j = 0; j < ND; j++) {
    c.res[j] = RES_SD * g();
    c.so[j] = 0.3 * g();
    c.q[j] = g();
  }
  return c;
}

export function setup(params) {
  const rnd = mulberry(7);
  const gauss = () => sqrt(-2 * log(rnd() + 1e-12)) * cos(2 * PI * rnd());
  const S = {
    rnd, gauss, t: 0, bt: 0, evT: 24, mg: null,
    hue: 0, drift: 2, sp: 0, cr: 0.06,
    z: new Float32Array(NP * ND), ww: new Float32Array(NP * ND), wp: new Float32Array(NP * ND),
    cid: new Int8Array(NP), amp: new Float32Array(NP), sc: new Float32Array(NP), pg: new Float32Array(NP).fill(1),
    Y: new Float32Array(NP * ND),
    cs: [], bw: new Float32Array(ND), ba: 2, bnext: 50, yc: 64, bc: 0, bk: 14,
    acc: new Float32Array((MC + 1) * W * H), tmp: new Float32Array(W * H), blr: new Float32Array((MC + 1) * W * H), ax: new Float32Array(W * H),
  };
  for (let i = 0; i < NP * ND; i++) {
    S.z[i] = gauss();
    S.ww[i] = 0.12 + 0.28 * rnd();
    S.wp[i] = 2 * PI * rnd();
  }
  for (let c = 0; c < MC; c++) S.cs.push(mkCluster(S, c));
  const share = [0.3, 0.27, 0.23, 0.2];
  for (let i = 0; i < NP; i++) {
    let r = rnd(), c = 0;
    while (c < 3 && r > share[c]) (r -= share[c]), c++;
    S.cid[i] = c;
    S.amp[i] = 0.75 + 0.5 * rnd();
    S.sc[i] = cl(exp(0.5 * gauss()), 0.4, 3);
  }
  for (let c = 0; c < 4; c++) S.cs[c].on = true;
  S.bw[S.ba] = 1;
  params.s = S;
  layout(S);
}

// A value, 0 to 1 over the axis, to a row. The ends are soft: a value past them bends along the top or bottom.
function rowOf(v) {
  const x = (v - 0.5) * 2.3;
  return 64 + 62 * (x / sqrt(sqrt(1 + x * x * x * x)));
}

// Mean profile, spread, correlations and then the row of every value of every point.
function layout(S) {
  const cs = S.cs;
  for (let c = 0; c < MC; c++) {
    const C = cs[c];
    if (!C.on) continue;
    const a = C.mode[0], b = C.mode[1], k = C.mode[2];
    for (let j = 0; j < ND; j++) {
      const t = (j - 2.5) / 2.5;
      C.mu[j] = a + b * t + k * (t * t - 0.4) + C.res[j] + C.po[j];
      C.sd[j] = BASE_SPREAD * exp(0.8 * S.sp) * exp(C.so[j]);
      const r = 0.95 * tanh(2 * (0.6 * C.q[j] + 1.5 * S.cr));
      C.rho[j] = r;
      C.rs[j] = sqrt(1 - r * r);
    }
  }
  const t = S.t, Y = S.Y, z = S.z, ww = S.ww, wp = S.wp;
  for (let i = 0; i < NP; i++) {
    const C = cs[S.cid[i]], o = i * ND, sc = S.sc[i];
    let u = 0;
    for (let j = 0; j < ND; j++) {
      const zz = z[o + j] + 0.35 * sin(ww[o + j] * t + wp[o + j]);
      u = j === 0 ? zz : C.rho[j] * u + C.rs[j] * zz;
      const v = C.mu[j] + C.sd[j] * sc * u;
      Y[o + j] = rowOf(v);
    }
  }
}

function advance(S, h) {
  const cs = S.cs, g = S.gauss;
  const k = h / TAU, sk = sqrt(2 * k), kq = h / 14, sq = sqrt(2 * kq);
  for (let c = 0; c < MC; c++) {
    const C = cs[c];
    if (!C.on) continue;
    const merging = S.mg && S.mg.b === c;
    if (merging) {
      const A = cs[S.mg.a], kp = 1 - exp(-h / 7), nz = 0.25;
      for (let m = 0; m < 3; m++) C.mode[m] += (A.mode[m] - C.mode[m]) * kp + nz * MODE_SD[m] * sk * g();
      for (let j = 0; j < ND; j++) {
        C.res[j] += (A.res[j] - C.res[j]) * kp;
        C.po[j] += (A.po[j] - C.po[j]) * kp;
        C.pt[j] = A.pt[j];
        C.so[j] += (A.so[j] - C.so[j]) * kp;
        C.q[j] += (A.q[j] - C.q[j]) * kp;
      }
      const dh = A.hue - C.hue;
      C.hue += (dh - Math.round(dh)) * (1 - exp(-h * 0.35));
    } else {
      for (let m = 0; m < 3; m++) C.mode[m] += (HOME[C.slot][m] - C.mode[m]) * k + MODE_SD[m] * sk * g();
      for (let j = 0; j < ND; j++) {
        C.res[j] += -C.res[j] * k + RES_SD * sk * g();
        C.po[j] += (C.pt[j] - C.po[j]) * (1 - exp(-h / 5));
        C.pt[j] *= exp(-h / 30);
        C.so[j] += -C.so[j] * k + 0.3 * sk * g();
        C.q[j] += -C.q[j] * kq + sq * g();
      }
      const dh = SLOT_HUE[C.slot] - C.hue;
      C.hue += (dh - Math.round(dh)) * (1 - exp(-h * 0.35));
    }
  }
  S.evT -= h;
  if (S.mg) {
    // finished when the absorbed cluster looks like the one it joins
    const A = cs[S.mg.a], B = cs[S.mg.b];
    S.mg.age += h;
    let dmax = 0;
    for (let j = 0; j < ND; j++) {
      const t = (j - 2.5) / 2.5;
      const da = A.mode[0] + A.mode[1] * t + A.mode[2] * (t * t - 0.4) + A.res[j] + A.po[j];
      const db = B.mode[0] + B.mode[1] * t + B.mode[2] * (t * t - 0.4) + B.res[j] + B.po[j];
      dmax = max(dmax, abs(da - db), abs(A.so[j] - B.so[j]) * 0.15, abs(A.q[j] - B.q[j]) * 0.06);
    }
    const dh = A.hue - B.hue;
    dmax = max(dmax, abs(dh - Math.round(dh)) * 0.5);
    if ((dmax < 0.015 && S.mg.age > 6) || S.mg.age > 50) {
      for (let i = 0; i < NP; i++) if (S.cid[i] === S.mg.b) S.cid[i] = S.mg.a;
      B.on = false;
      S.mg = null;
      S.evT = max(S.evT, 10);
    }
  } else if (S.evT <= 0) {
    S.evT = 18 + 28 * S.rnd();
    event(S);
  }
}

function counts(S) {
  for (const C of S.cs) C.n = 0;
  for (let i = 0; i < NP; i++) S.cs[S.cid[i]].n++;
}

function event(S) {
  counts(S);
  const act = [];
  for (let c = 0; c < MC; c++) if (S.cs[c].on) act.push(c);
  const doSplit = act.length <= 3 ? true : act.length >= MC ? false : S.rnd() < 0.45;
  if (doSplit) {
    const elig = act.filter((c) => S.cs[c].n >= NP * 0.18);
    let f = -1;
    for (let c = 0; c < MC; c++) if (!S.cs[c].on) f = c;
    if (!elig.length || f < 0) return;
    const c = elig[floor(S.rnd() * elig.length)], P = S.cs[c], N = S.cs[f];
    const dir = [];
    let nrm = 0;
    for (let j = 0; j < ND; j++) {
      const v = S.gauss();
      dir.push(v);
      nrm += v * v;
    }
    nrm = sqrt(nrm);
    for (let j = 0; j < ND; j++) dir[j] /= nrm;
    N.on = true;
    N.hue = P.hue;
    for (let m = 0; m < 3; m++) N.mode[m] = P.mode[m];
    for (let j = 0; j < ND; j++) {
      // both halves start where the parent is; a push along the cut slides them apart
      N.res[j] = P.res[j];
      N.po[j] = P.po[j];
      N.pt[j] = P.pt[j] + 0.5 * dir[j];
      P.pt[j] -= 0.5 * dir[j];
      N.so[j] = P.so[j];
      N.q[j] = P.q[j];
    }
    for (let i = 0; i < NP; i++) {
      if (S.cid[i] !== c) continue;
      let key = 0;
      for (let j = 0; j < ND; j++) key += S.z[i * ND + j] * dir[j];
      if (key > 0) S.cid[i] = f;
    }
  } else {
    let bd = 1e9, ba = -1, bb = -1;
    for (const a of act)
      for (const b of act) {
        if (a >= b) continue;
        let d = 0;
        for (let j = 0; j < ND; j++) d += (S.cs[a].mu[j] - S.cs[b].mu[j]) ** 2;
        if (d < bd) (bd = d), (ba = a), (bb = b);
      }
    if (ba < 0) return;
    const big = S.cs[ba].n >= S.cs[bb].n;
    S.mg = { a: big ? ba : bb, b: big ? bb : ba, age: 0 };
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const e = 1 - exp(-d * 4);
  S.hue += (cl(kn[0], 0, 1) - S.hue) * e;
  S.drift += (cl(kn[1], 0, 3) - S.drift) * e;
  S.sp += (cl(kn[2], -1, 1) - S.sp) * e;
  S.cr += (cl(kn[3], -1, 1) - S.cr) * e;
  const rate = 0.03 + 0.36 * S.drift;
  advance(S, d * rate);
  S.t += d;
  // the brush slides on its own clock, a little faster than the clusters
  const br = d * (0.25 + 0.4 * S.drift);
  S.bt += br;
  // The brush rests on one cluster for 12 to 26 brush seconds, sliding up and down across its ribbon, then moves on to another
  S.bk -= br;
  if (S.bk <= 0 || !S.cs[S.bc].on) {
    S.bk = 12 + 14 * S.rnd();
    const on = [];
    for (let c = 0; c < MC; c++) if (S.cs[c].on && c !== S.bc) on.push(c);
    if (on.length) S.bc = on[floor(S.rnd() * on.length)];
  }
  const tgt = rowOf(S.cs[S.bc].mu[S.ba]) + 15 * sin(0.37 * S.bt + 1.3) + 7 * sin(0.91 * S.bt);
  S.yc += (tgt - S.yc) * (1 - exp(-d * 0.9));
  S.bnext -= br;
  if (S.bnext <= 0) {
    S.bnext = 40 + 40 * S.rnd();
    let a = floor(S.rnd() * ND);
    if (a === S.ba) a = (a + 1 + floor(S.rnd() * (ND - 1))) % ND;
    S.ba = a;
  }
  const eb = 1 - exp(-d * 0.6);
  for (let j = 0; j < ND; j++) S.bw[j] += ((j === S.ba ? 1 : 0) - S.bw[j]) * eb;
  // A cluster of many points would burn out, so each point's light follows the size of the cluster it is in, slowly
  counts(S);
  const eg = 1 - exp(-d * 0.5);
  for (let i = 0; i < NP; i++) {
    S.pg[i] += (cl(sqrt(NP / 4 / S.cs[S.cid[i]].n), 0.55, 1.25) - S.pg[i]) * eg;
  }
  layout(S);
}

const WHITE = 0.2, LO = 0.4, HI = 1.7, LINE = 1.0, HB = 8, TM = 0.14, GLOW = 0.5;
const AXC = [0.18, 0.23, 0.36]; // the cool grey of an axis, and of the brush band on it

// Planes: one for the light of each cluster slot, and one (MC) for the part of the light that the brush turns white. A pixel
// takes its hue from the clusters' hues weighted by the square of their light, so where two ribbons cross the denser one
// keeps its colour and the other only tints it, and the light itself is their sum.
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc, N = W * H, Y = S.Y, rgb = [0, 0, 0], ax = S.ax;
  acc.fill(0);
  const hb2 = 1 / (2 * HB * HB);
  for (let i = 0; i < NP; i++) {
    const o = i * ND, pl = S.cid[i] * N, pw = MC * N;
    let m = 0;
    for (let j = 0; j < ND; j++) {
      const w = S.bw[j];
      if (w > 0.01) {
        const dy = Y[o + j] - S.yc;
        m += w * exp(-dy * dy * hb2);
      }
    }
    m = min(1, m);
    const g = (LO + HI * m) * LINE * S.amp[i] * S.pg[i], hw = g * m * WHITE;
    for (let j = 0; j < ND - 1; j++) {
      const xa = AXX[j], xb = AXX[j + 1], ya = Y[o + j], yb = Y[o + j + 1];
      const sl = (yb - ya) / (xb - xa), sq = sqrt(1 + sl * sl), inv = 1 / sq, span = CUT * sq;
      const x0 = max(0, floor(xa - 0.5)), x1 = min(W - 1, floor(xb + 0.5));
      for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5;
        const wx = cl(cx - xa + 0.5, 0, 1) * cl(xb - cx + 0.5, 0, 1);
        if (wx <= 0) continue;
        const yl = ya + sl * (cx - xa);
        const r0 = max(0, Math.ceil(yl - span - 0.5)), r1 = min(H - 1, floor(yl + span - 0.5));
        for (let py = r0; py <= r1; py++) {
          const d = (py + 0.5 - yl) * inv;
          const p = LUT[((d * d * LUTN) / (CUT * CUT)) | 0] * wx;
          const q = py * W + px;
          acc[pl + q] += g * p;
          acc[pw + q] += hw * p;
        }
      }
    }
  }
  // axes, and the brush band on them
  ax.fill(0);
  for (let j = 0; j < ND; j++) {
    const bw = S.bw[j], X = AXX[j];
    for (let px = max(0, floor(X - 5)); px <= min(W - 1, floor(X + 5)); px++) {
      const dx = px + 0.5 - X;
      const a0 = exp((-dx * dx) / (2 * 0.6 * 0.6)) * 0.5, bx = exp((-dx * dx) / (2 * 2.2 * 2.2)) * bw * 0.7;
      for (let py = 0; py < H; py++) {
        const dy = py + 0.5 - S.yc;
        ax[py * W + px] += a0 + bx * exp(-dy * dy * hb2);
      }
    }
  }
  // glow: a 5 tap blur of each plane, added back
  const blr = S.blr, tmp = S.tmp;
  for (let ch = 0; ch <= MC; ch++) {
    const base = ch * N;
    for (let y = 0; y < H; y++) {
      const r = y * W;
      for (let x = 0; x < W; x++) {
        const xm2 = x < 2 ? 0 : x - 2, xm1 = x < 1 ? 0 : x - 1, xp1 = x > W - 2 ? W - 1 : x + 1, xp2 = x > W - 3 ? W - 1 : x + 2;
        tmp[r + x] = (acc[base + r + xm2] + 4 * acc[base + r + xm1] + 6 * acc[base + r + x] + 4 * acc[base + r + xp1] + acc[base + r + xp2]) * 0.0625;
      }
    }
    for (let y = 0; y < H; y++) {
      const ym2 = (y < 2 ? 0 : y - 2) * W, ym1 = (y < 1 ? 0 : y - 1) * W, yp1 = (y > H - 2 ? H - 1 : y + 1) * W, yp2 = (y > H - 3 ? H - 1 : y + 2) * W, r = y * W;
      for (let x = 0; x < W; x++) blr[base + r + x] = (tmp[ym2 + x] + 4 * tmp[ym1 + x] + 6 * tmp[r + x] + 4 * tmp[yp1 + x] + tmp[yp2 + x]) * 0.0625;
    }
  }
  const tp = 1 / (2 * PI), ang = [], cs = S.cs;
  for (let c = 0; c < MC; c++) ang.push(2 * PI * (cs[c].hue + S.hue));
  const ca = ang.map(cos), sa = ang.map(sin);
  for (let q = 0; q < N; q++) {
    const a = ax[q];
    let D = 0, cx = 0, cy = 0, wsum = 0, r = 0, g = 0, b = 0, v = 0;
    for (let c = 0; c < MC; c++) {
      const d = acc[c * N + q] + GLOW * blr[c * N + q];
      if (d <= 0) continue;
      D += d;
      const w = d * d;
      wsum += w;
      cx += w * ca[c];
      cy += w * sa[c];
    }
    if (D > 1e-3) {
      const wf = (acc[MC * N + q] + GLOW * blr[MC * N + q]) / D, R = sqrt(cx * cx + cy * cy) / wsum;
      const x = D * TM, t0 = min(1, (x * 1.25) / (1 + x));
      v = Math.pow(t0, 1.4);
      hsv(Math.atan2(cy, cx) * tp, cl(0.95 * (0.35 + 0.65 * R) * (1 - wf), 0, 1), v, rgb);
      r = rgb[0];
      g = rgb[1];
      b = rgb[2];
    }
    if (a > 0.001) {
      const k = a * (1 - v);
      r += AXC[0] * k;
      g += AXC[1] * k;
      b += AXC[2] * k;
    }
    display.setPixel(q % W, (q / W) | 0, min(255, r * 255), min(255, g * 255), min(255, b * 255));
  }
}
