// ===== Patternflow pattern =====
// Title:   Smouldering Front
// Family:  combustion
// Idea:    A sheet of paper smoulders upward and the camera rides the front: dim fibrous parchment above with a scorched brown halo just ahead of the burn, a glowing orange line near the middle of the panel that breaks into fingers, splits at the tips and merges again because the tips get more air than the bays, and below it char black, then pale blue-grey ash with soft ember discs dying from orange to dark red, the whole sheet sliding down as the front climbs.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the fingering of a slow burn front in a thin gap when oxygen is short (Zik, Olami and Moses, "Fingering instability in combustion", Physical Review Letters, 1998, from memory); the front is a height h(x) that grows with a diffusion-limited gain proportional to the wavenumber, is smoothed by heat conduction and spreads sideways along its normal, the form of the Michelson-Sivashinsky flame-front equation (from memory), driven by quenched paper density that enters new at the top; the picture, the numbers and the colours are original, pattern round 243
// Round:   243
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Air=0..4, Damp=0..0.6, Draft=-1..1
//
// Knob 1: Salt. Turns the flame colour round the wheel. At 0 the front is orange with a yellow-white core and the embers fall from orange to dark red; a quarter turn is a green flame, a half turn blue, and the core stays pale whatever the salt.
// Knob 2: Air. 0 to 4, opening at 2. The oxygen the front can reach. Low, the fingers are thin (about 9 LED apart), ragged and slow (2 LED a second), the glow is dim and short. At 2 they are about 14 LED apart and the front climbs 4 LED a second. High, the front is a flat quick line with two or three soft bulges, 7 LED a second, thick and bright.
// Knob 3: Damp. 0 to 0.6, opening at 0. Moisture in the paper. At 0 it burns clean. Raised, wet patches slow the front where they are, tongues of unburnt paper hang behind the fingers, and at 0.6 about one patch in five is left as an island of paper in the char, with a scorched rim.
// Knob 4: Draft. -1 to 1, opening near 0. A sideways draft. At 0 the front is level and the fingers run straight down the sheet; at 1 the front slants 19 degrees (a rise of 22 LED across the panel) and the fingers lean 28 degrees to one side, at -1 to the other.

const W = 64, H = 128;
const NX = 96, XO = 16, KH = 48;     // simulation columns, left margin off screen, spectral modes
const RPL = 2, NR = 512, MASK = NR - 1; // ring of sheet rows, 2 a LED
const YF = 62;                       // screen row the mean front is held at
const RD = 6.5;                      // reach of the front's distance map, LED
const LUTN = 96;
const { floor, ceil, round, min, max, abs, exp, sqrt, sin, cos, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- noise ------------------------------------------------------------------
function hash(ix, iy, sd) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(sd, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x, y, sd) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, sd), b = hash(ix + 1, iy, sd), c = hash(ix, iy + 1, sd), d = hash(ix + 1, iy + 1, sd);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// the real transform of the front's profile, modes 1 .. KH-1
const COS = new Float64Array(KH * NX), SIN = new Float64Array(KH * NX);
for (let k = 0; k < KH; k++) for (let n = 0; n < NX; n++) {
  COS[k * NX + n] = cos((TAU * k * n) / NX);
  SIN[k * NX + n] = sin((TAU * k * n) / NX);
}

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = h - floor(h);
  const hh = h * 6, i = floor(hh) % 6, f = hh - floor(hh), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// heat 0..1 to an additive flame colour: deep red, the salt's colour, a yellower shoulder, a pale core
const STOPS = [
  [0.0, 0.0, 1.0, 0.0],
  [0.1, -0.03, 1.0, 0.32],
  [0.3, -0.01, 0.97, 0.8],
  [0.55, 0.02, 0.88, 1.0],
  [0.8, 0.045, 0.5, 1.0],
  [1.0, 0.05, 0.14, 1.0],
];
function buildLut(st) {
  const h0 = 0.045 + st.k[0], tmp = [0, 0, 0];
  for (let n = 0; n < LUTN; n++) {
    const e = n / (LUTN - 1);
    let j = 1;
    while (j < STOPS.length - 1 && STOPS[j][0] < e) j++;
    const a = STOPS[j - 1], b = STOPS[j], f = cl((e - a[0]) / (b[0] - a[0]), 0, 1);
    hsv(h0 + a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, tmp, 0);
    st.lut[n * 3] = tmp[0];
    st.lut[n * 3 + 1] = tmp[1];
    st.lut[n * 3 + 2] = tmp[2];
  }
  st.lutHue = st.k[0];
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const sd = () => (Math.random() * 1e9) | 0;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0,
    u: 0.5, w: 0, dr: 0.06, tilt: 0, drift: 0,
    gr: new Float64Array(KH), gi: new Float64Array(KH), g: new Float64Array(NX), f: new Float64Array(NX),
    h: new Float64Array(NX), hp: new Float64Array(NX),
    H0: 0, cam: 0, hbar: 0, vH: 0,
    FIB: new Float32Array(NR * NX), FU: new Float32Array(NR * NX), MO: new Float32Array(NR * NX), TB: new Float32Array(NR * NX),
    rTop: 0, sd: [sd(), sd(), sd(), sd(), sd(), sd(), sd(), sd()],
    emb: [], ea: 0,
    dm: new Float32Array(W * H), lut: new Float32Array(LUTN * 3), lutHue: -9,
  });
  return st;
}

// ---- the sheet --------------------------------------------------------------
// One row of paper, made when it comes into view: its fibres, its density and its wetness. They are the same for ever after.
function makeRow(st, r) {
  const o = (r & MASK) * NX, s = (r + 0.5) / RPL, sd = st.sd;
  for (let i = 0; i < NX; i++) {
    const a = vn(i * 0.2, s * 0.8, sd[0]), b = vn((i + s) * 0.16, (i - s) * 0.62, sd[1]), c = vn((i - s) * 0.16, (i + s) * 0.62, sd[2]);
    let fib = 0.42 * a + 0.29 * b + 0.29 * c;
    fib = cl(0.5 + (fib - 0.5) * 2.1 + (hash(i, r, sd[3]) - 0.5) * 0.12, 0, 1);
    const mott = 0.6 * vn(i / 11, s / 11, sd[4]) + 0.4 * vn(i / 5, s / 5, sd[5]);
    st.FIB[o + i] = fib;
    st.FU[o + i] = cl(0.5 + (0.55 * mott + 0.45 * fib - 0.5) * 1.8, 0, 1);
    st.MO[o + i] = cl(0.5 + (0.7 * vn(i / 8.5, s / 8.5, sd[6]) + 0.3 * vn(i / 4, s / 4, sd[7]) - 0.5) * 2.6, 0, 1);
    st.TB[o + i] = 1e9;
  }
}
function growSheet(st) {
  while ((st.rTop + 0.5) / RPL < st.cam + YF + 12) makeRow(st, st.rTop++);
}
// a field at sheet height s of column i, linear between ring rows
function sample(A, i, s) {
  const rf = s * RPL - 0.5, j = floor(rf), f = rf - j;
  const a = A[(j & MASK) * NX + i];
  return a + (A[((j + 1) & MASK) * NX + i] - a) * f;
}

// ---- the front --------------------------------------------------------------
// h(x) = H0 + g(x) + tilt (x - mid). g grows by a gain on each mode proportional to its wavenumber (the tips get the air), is
// smoothed by conduction, and the front spreads along its normal; a draft carries g sideways.
function targets(u) {
  return {
    V0: 2.4 * pow(3, u),         // LED a second, flat front, no noise
    A: 2.8 - 2.1 * u,            // the oxygen gain
    NU: (2.8 - 2.1 * u) * (1.2 + 0.6 * u), // conduction, wide enough that a cusp is a few LED across
    LAM: 1.4 + 0.8 * u * u,     // spreading along the normal
    NZ: 0.75 * (1.3 - u),       // how much the paper's density moves the speed
    KL: 0.2,                     // the air comes from a finite distance: waves longer than this get no gain
  };
}

function stepSim(st, dt) {
  const P = targets(st.u), N = NX, g = st.g, f = st.f, h = st.h, hp = st.hp;
  const w = st.w, thr = 1.12 - 0.5 * w, sw = 0.88 * sstep(0, 0.15, w);
  const s0 = st.tilt, c = st.drift;
  // what pushes each column: the paper under the front, the wet patches, the sideways spread
  let fm = 0;
  for (let i = 0; i < N; i++) {
    const hi = h[i], fu = sample(st.FU, i, hi), mo = sample(st.MO, i, hi);
    const gx = cl((g[(i + 1) % N] - g[(i + N - 1) % N]) * 0.5, -5, 5) + s0;
    f[i] = P.V0 * (1 + P.NZ * 2 * (fu - 0.5)) * (1 - sw * sstep(thr - 0.3, thr + 0.05, mo)) + 0.5 * P.LAM * gx * gx;
    fm += f[i];
  }
  fm /= N;
  st.H0 += fm * dt;
  for (let i = 0; i < N; i++) f[i] -= fm;
  // each mode: grow, smooth, carry, push
  const gr = st.gr, gi = st.gi;
  for (let k = 1; k < KH; k++) {
    const kap = (TAU * k) / N, sig = P.A * kap * (kap * kap) / (kap * kap + P.KL * P.KL) - P.NU * kap * kap, ph = kap * c * dt;
    const ex = exp(sig * dt), er = ex * cos(ph), ei = -ex * sin(ph);
    let fr = 0, fi = 0;
    const o = k * N;
    for (let n = 0; n < N; n++) {
      fr += f[n] * COS[o + n];
      fi -= f[n] * SIN[o + n];
    }
    // phi = (E - 1) / L, L = sig - i kap c
    const lr = sig, li = -kap * c, den = lr * lr + li * li;
    let pr, pi;
    if (den < 1e-10) { pr = dt; pi = 0; } else {
      const nr = er - 1, ni = ei;
      pr = (nr * lr + ni * li) / den;
      pi = (ni * lr - nr * li) / den;
    }
    const a = gr[k], b = gi[k];
    gr[k] = er * a - ei * b + pr * fr - pi * fi;
    gi[k] = er * b + ei * a + pr * fi + pi * fr;
  }
  // back to columns
  const sc = 2 / N;
  for (let n = 0; n < N; n++) g[n] = 0;
  for (let k = 1; k < KH; k++) {
    const o = k * N, a = gr[k] * sc, b = gi[k] * sc;
    for (let n = 0; n < N; n++) g[n] += a * COS[o + n] - b * SIN[o + n];
  }
  // the front never stands taller than a quarter of the sheet: if it would, every mode is eased down together
  let gm = 0;
  for (let n = 0; n < N; n++) gm = max(gm, abs(g[n]));
  if (gm > 14) {
    const e = 14 / gm;
    for (let k = 1; k < KH; k++) { gr[k] *= e; gi[k] *= e; }
    for (let n = 0; n < N; n++) g[n] *= e;
  }
  // the new front, and the moment it crossed each row
  const t0 = st.t, mid = N / 2;
  for (let i = 0; i < N; i++) {
    hp[i] = h[i];
    h[i] = st.H0 + g[i] + s0 * (i + 0.5 - mid);
    const hO = hp[i], hN = h[i];
    if (hN > hO) {
      const j1 = floor(hN * RPL - 0.5);
      for (let j = floor(hO * RPL - 0.5) + 1; j <= j1 && j < floor(hO * RPL - 0.5) + 40; j++) {
        const sj = (j + 0.5) / RPL;
        st.TB[(j & MASK) * NX + i] = t0 + ((sj - hO) / (hN - hO)) * dt;
      }
    }
  }
  st.t += dt;
  // the camera: the mean of what is on screen, led by its own speed
  let hb = 0;
  for (let n = XO; n < XO + W; n++) hb += h[n];
  hb /= W;
  const v = (hb - st.hbar) / dt;
  st.hbar = hb;
  st.vH += (v - st.vH) * (1 - exp(-dt / 5));
  st.cam += (st.vH + (hb - st.cam) / 1.1) * dt;
  growSheet(st);
  embers(st, dt);
}

// ---- embers -----------------------------------------------------------------
function embers(st, dt) {
  const emb = st.emb, u = st.u;
  for (let n = emb.length - 1; n >= 0; n--) {
    emb[n].age += dt;
    if (emb[n].age > emb[n].life) emb.splice(n, 1);
  }
  st.ea += (4.5 + 5 * u) * dt * (0.5 + st.fuelMean);
  while (st.ea >= 1) {
    st.ea -= 1;
    if (emb.length > 70) break;
    const x = XO - 1 + Math.random() * (W + 2), i = cl(floor(x), 0, NX - 1);
    const s = st.h[i] - (0.7 + Math.random() * 3.3);
    const mo = sample(st.MO, i, s);
    if (mo > 1.12 - 0.5 * st.w) continue;
    emb.push({ sx: x - XO + 0.5, s, age: 0, life: 1.8 + Math.random() * 3.6, ph: Math.random() * TAU });
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  const gu = cl(st.k[1] / 4, 0, 1), gw = cl(st.k[2] / 0.6, 0, 1), gd = cl(st.k[3], -1, 1);
  st.fuelMean = 0.5;
  if (!st.init) {
    st.init = true;
    st.u = gu; st.w = gw; st.dr = gd;
    st.tilt = 0.34 * gd; st.drift = 2.2 * gd;
    st.H0 = 400;
    st.cam = 400;
    st.rTop = floor((400 - 30) * RPL);
    growSheet(st);
    // a slightly rough start: a faint random profile, then run until the sheet below the front is all burnt through
    for (let k = 1; k < KH; k++) {
      const a = Math.random() * TAU, m = (st.u < 0.5 ? 0.8 : 0.3) * (1 / (1 + k * 0.5));
      st.gr[k] = m * cos(a) * NX;
      st.gi[k] = m * sin(a) * NX;
    }
    for (let n = 0; n < NX; n++) {
      let a = 0;
      for (let k = 1; k < KH; k++) a += st.gr[k] * COS[k * NX + n] - st.gi[k] * SIN[k * NX + n];
      st.g[n] = (a * 2) / NX;
      st.h[n] = st.H0 + st.g[n] + st.tilt * (n + 0.5 - NX / 2);
    }
    let hb = 0;
    for (let n = XO; n < XO + W; n++) hb += st.h[n];
    st.hbar = hb / W;
    st.cam = st.hbar;
    const c0 = st.cam;
    for (let n = 0; n < 3000 && st.cam - c0 < 82; n++) stepSim(st, 1 / 30);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  const b = 1 - exp(-dt / 0.3);
  st.u += (gu - st.u) * b;
  st.w += (gw - st.w) * b;
  st.dr += (gd - st.dr) * b;
  st.tilt = 0.34 * st.dr;
  st.drift = 2.2 * st.dr;
  const n = ceil(dt / 0.04);
  for (let i = 0; i < n; i++) stepSim(st, dt / n);
}

// ---- draw -------------------------------------------------------------------
const PAPER = [118, 102, 78], SCORCH = [78, 40, 16], ASH = [84, 96, 112];

function distanceMap(st) {
  const dm = st.dm, h = st.h, cam = st.cam;
  dm.fill(RD);
  for (let i = XO - 1; i < XO + W; i++) {
    const x0 = i + 0.5 - XO, x1 = x0 + 1, ya = cam + YF - h[i], yb = cam + YF - h[i + 1];
    const ex = x1 - x0, ey = yb - ya, ll = ex * ex + ey * ey;
    const xa = max(0, floor(x0 - RD)), xb = min(W - 1, floor(x1 + RD));
    const yl = max(0, floor(min(ya, yb) - RD)), yh = min(H - 1, floor(max(ya, yb) + RD));
    for (let y = yl; y <= yh; y++) {
      const py = y + 0.5 - ya;
      for (let x = xa; x <= xb; x++) {
        const px = x + 0.5 - x0;
        const tt = cl((px * ex + py * ey) / ll, 0, 1), dx = px - tt * ex, dy = py - tt * ey;
        const d2 = dx * dx + dy * dy;
        if (d2 < RD * RD) {
          const d = sqrt(d2), p = y * W + x;
          if (d < dm[p]) dm[p] = d;
        }
      }
    }
  }
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.lutHue) > 1e-4) buildLut(st);
  distanceMap(st);
  const lut = st.lut, dm = st.dm, h = st.h, cam = st.cam, t = st.t, u = st.u, w = st.w;
  const thr = 1.12 - 0.5 * w;
  const rag = 0.5 + 1.0 * (1 - u), tau = 1.2 + 1.1 * u, gain = 0.82 + 0.3 * u;
  const buf = st.buf || (st.buf = new Float32Array(W * H * 3));
  for (let y = 0; y < H; y++) {
    const s = cam + YF - (y + 0.5);
    const rf = s * RPL - 0.5, j0 = floor(rf), fr = rf - j0;
    const b0 = (j0 & MASK) * NX, b1 = ((j0 + 1) & MASK) * NX;
    for (let x = 0; x < W; x++) {
      const i = x + XO, p = y * W + x;
      const fib = st.FIB[b0 + i] * (1 - fr) + st.FIB[b1 + i] * fr;
      const fu = st.FU[b0 + i] * (1 - fr) + st.FU[b1 + i] * fr;
      const mo = st.MO[b0 + i] * (1 - fr) + st.MO[b1 + i] * fr;
      let D = (y + 0.5 > cam + YF - h[i] ? dm[p] : -dm[p]) + rag * (fib - 0.5);
      // when the front crossed here
      const ta = st.TB[b0 + i], tb = st.TB[b1 + i];
      let age = 0;
      if (ta < 1e8) age = t - (tb < 1e8 ? ta + (tb - ta) * fr : ta);
      if (age < 0) age = 0;
      const iso = sstep(thr, thr + 0.08, mo), rim = sstep(thr - 0.2, thr, mo) * (1 - iso);
      // paper, scorched ahead of the front and round a damp island
      const pv = 0.78 + 0.4 * fib;
      const sc = max(D < 0 ? exp(D / 3.0) * (1 - sstep(4.2, RD, -D)) * 0.82 : 0, rim * 0.8);
      const sv = 0.6 + 0.8 * fib;
      const pr = (PAPER[0] * pv) * (1 - sc) + SCORCH[0] * sv * sc;
      const pg = (PAPER[1] * pv) * (1 - sc) + SCORCH[1] * sv * sc;
      const pb = (PAPER[2] * pv) * (1 - sc) + SCORCH[2] * sv * sc;
      // char, then ash that keeps the print of the fibres
      const ch = 12 + 18 * fu, wa = sstep(2.1, 4.8, age + (fu - 0.5) * 1.6), av = 0.76 + 0.48 * fib;
      const br = (ch * (1 - wa) + ASH[0] * av * wa), bg = (ch * 0.9 * (1 - wa) + ASH[1] * av * wa), bb = (ch * 0.9 * (1 - wa) + ASH[2] * av * wa);
      const bw = sstep(-0.5, 0.8, D) * (1 - iso);
      let r = pr + (br - pr) * bw, g = pg + (bg - pg) * bw, bl = pb + (bb - pb) * bw;
      // the front's own light
      let hd = D < -0.2 ? exp((D + 0.2) / 0.8) : D < 0.5 ? 1 : exp(-(D - 0.5) / tau);
      hd = max(hd, 0.42 * exp(-age / 1.0) * sstep(-0.3, 0.6, D));
      hd = (hd * (1 - 0.85 * iso) + rim * 0.5 * exp(-age / 1.4) * sstep(0, 1, D)) * gain;
      const li = round(cl(hd, 0, 1) * (LUTN - 1)) * 3;
      r += lut[li]; g += lut[li + 1]; bl += lut[li + 2];
      const q = p * 3;
      buf[q] = r; buf[q + 1] = g; buf[q + 2] = bl;
    }
  }
  // soft ember discs
  const emb = st.emb;
  for (let n = 0; n < emb.length; n++) {
    const e = emb[n], fl = 1 - e.age / e.life;
    if (fl <= 0) continue;
    const ey = cam + YF - e.s;
    if (ey < -2 || ey > H + 2) continue;
    const hv = 0.9 * pow(fl, 1.2) * (0.92 + 0.08 * sin(t * 7 + e.ph)), al = sstep(0, 0.22, fl);
    const li = round(cl(hv, 0, 1) * (LUTN - 1)) * 3;
    const x0 = max(0, floor(e.sx - 2)), x1 = min(W - 1, floor(e.sx + 2)), y0 = max(0, floor(ey - 2)), y1 = min(H - 1, floor(ey + 2));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - e.sx, dy = y + 0.5 - ey, d = sqrt(dx * dx + dy * dy);
        const a = (1 - sstep(0.6, 1.5, d)) * al;
        if (a > 0) {
          const q = (y * W + x) * 3;
          buf[q] += lut[li] * a; buf[q + 1] += lut[li + 1] * a; buf[q + 2] += lut[li + 2] * a;
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[q], 0, 255) | 0, cl(buf[q + 1], 0, 255) | 0, cl(buf[q + 2], 0, 255) | 0);
    }
  }
}
