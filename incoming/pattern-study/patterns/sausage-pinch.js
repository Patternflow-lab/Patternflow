// ===== Patternflow pattern =====
// Title:   Sausage Pinch
// Family:  zpinch
// Idea:    A Z-pinch plasma column stands the height of the panel, pinched by its own current, and the sausage instability grows necks in it that flash white and break the column into a chain of bright beads, while a shear in the axial flow holds the column straight and the kink bends its axis into a wandering line.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Bennett pinch, the self-pinched column in which the magnetic pressure of its own current holds the plasma (Bennett 1934, from memory); the m = 0 sausage instability and the m = 1 kink of the linear pinch (Kruskal and Schwarzschild 1954; Kruskal and Shafranov, from memory); the flow-stabilised Z-pinch, in which a sheared axial flow quenches the sausage mode (Shumlak et al. 2001, from memory); the growth curve, the neck collapse and the model are original, pattern round 242
// Round:   242
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shear=0..4, Current=-1..1, Kink=0..1
//
// Knob 1: Hue. Turns the plasma colour round the wheel and opens in magenta, with the core pale lavender and blue-white and the rim deep violet.
// Knob 2: Shear. 0 to 4, opening at 2: the shear of the axial flow. At 0 the necks grow fast and the column breaks into beads over its upper half; at the top the column stands straight and only small ripples run up it.
// Knob 3: Current. -1 to 1, opening at 0: the current in the column. It sets the radius and how fast the neck closes, and a wider column breaks into fewer, larger beads.
// Knob 4: Kink. 0 to 1, opening at 0.06: how far the axis of the column bends. At the top it is a wandering line across the panel.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, sqrt, exp, log, pow, tanh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- the column -------------------------------------------------------------
// The column is a row of cells that ride up with the flow. Each cell holds the radius as a fraction above or below the
// resting one (s), the mass per length (n), the bend of the axis (x, within -1..1) and a flash (f). A cell is one LED
// long; the grid reaches MARG cells past the top and the bottom of the panel, so the column leaves by the edges.
const MARG = 10, M = H + 2 * MARG;
const DT = 1 / 30;
const L = 24;                 // taps either side of a cell in the growth kernel
const PRE = 55;               // seconds run before the first frame
const MU = 22;                // how fast mass runs from the necks into the bulges
const DN = 9;                 // how far the pressure spreads the mass along the column
const DIFF = 1.2;             // the smoothing that takes the short waves out of the radius

// A growth rate against wave number y = k / k*: zero for a long wave, one at k*, back to nothing for a short wave.
const growth = (y) => y * y * exp(1 - y * y);

// The kernel whose Fourier symbol is growth(k / kstar), taps stride cells apart.
function buildKernel(out, kstar, stride) {
  const kmax = PI / stride, n = 120, dk = kmax / n;
  for (let m = 0; m <= L; m++) {
    let a = 0;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) * dk;
      a += growth(k / kstar) * cos(k * m * stride);
    }
    out[L + m] = out[L - m] = (a * dk * stride) / PI;
  }
}

// ---- noise that seeds the column --------------------------------------------
// A two-pole resonator: noise that wavers round the wave number theta, unit variance.
function res(z, theta, RR) {
  const c = cos(theta), a1 = 2 * RR * c, a2 = -RR * RR;
  const v = (1 + RR * RR) / ((1 - RR * RR) * ((1 + RR * RR) * (1 + RR * RR) - 4 * RR * RR * c * c));
  const o = a1 * z[0] + a2 * z[1] + gauss();
  z[1] = z[0];
  z[0] = o;
  return o / sqrt(v);
}

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
// The ramp of the plasma by intensity: black violet, deep violet, purple, magenta, pink, pale lavender, blue white.
const KEYS = [
  [0.0, 0.7, 0.9, 0.06],
  [0.05, 0.72, 0.92, 0.17],
  [0.14, 0.76, 0.94, 0.34],
  [0.3, 0.82, 0.92, 0.6],
  [0.5, 0.88, 0.82, 0.88],
  [0.72, 0.87, 0.52, 1.0],
  [0.95, 0.78, 0.25, 1.0],
  [1.2, 0.64, 0.12, 1.0],
  [1.4, 0.6, 0.05, 1.0],
];
const NL = 256, IMAX = 1.4;
function buildLut(lut, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const u = (i / (NL - 1)) * IMAX;
    let k = 0;
    while (k < KEYS.length - 2 && u > KEYS[k + 1][0]) k++;
    const a = KEYS[k], b = KEYS[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    const h = mix(a[1], b[1], f) + hue, s = mix(a[2], b[2], f), v = mix(a[3], b[3], f);
    // a dim colour on the red, orange and yellow stretch of the wheel reads brown on the panel, so it is paled and lifted
    const hh = h - floor(h), br = (hh > 0.5 ? sstep(0.8, 0.95, hh) : 1 - sstep(0.16, 0.3, hh)) * (1 - v) * sstep(0.1, 0.4, v);
    hsv(h, s * (1 - 0.32 * br), min(1, v * (1 + 0.35 * br)), c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, acc: 0, off: 0, hue: -9,
    s: new Float32Array(M), n: new Float32Array(M).fill(1), x: new Float32Array(M), f: new Float32Array(M),
    cs: new Float32Array(M), cx: new Float32Array(M), fl: new Float32Array(M), ft: new Float32Array(M),
    kern: new Float32Array(2 * L + 1), kern1: new Float32Array(2 * L + 1), kb: -1, kb1: -1,
    zs: [0, 0], zx: [0, 0], ou: [0, 0, 0, 0],
    lut: new Float32Array(NL * 3),
    ss: 0.5, ik: 1, R0: 7, kap: 0.06, stab: 0.3, gam: 0.22,
    row: new Float32Array(H * 5),
  };
  return params.st;
}

function derive(st) {
  const kv = st.k;
  st.ss = cl(kv[1] / 4, 0, 1);
  st.ik = pow(2, cl(kv[2], -1, 1));
  st.R0 = 7 * sqrt(st.ik);
  st.kap = cl(kv[3], 0, 1);
  st.stab = 1.25 * pow(st.ss, 3);
  st.gam = 0.3 * pow(st.ik, 0.7);
}

// How far the axis can bend in LED, and what that is at the knob's opening.
const bendOf = (kap) => 8 + 16 * pow(kap, 0.6);

// ---- one step of the column -------------------------------------------------
function seedCell(st, i, ks) {
  const th = cl(ks * (1 + 0.25 * cl(st.ou[3], -1.5, 1.5)), 0.05, 0.9);
  st.s[i] = 0.14 * res(st.zs, th, 0.92);
  st.n[i] = 1;
  st.x[i] = 0.35 * res(st.zx, 0.085, 0.97);
  st.f[i] = 0;
}

function step(st, dt) {
  const { s, n, x, f, cs, cx, fl, ft } = st;
  // slow surges of the current, of the preferred wavelength and of the flow
  const tau = [14, 23, 17, 29];
  for (let j = 0; j < 4; j++) st.ou[j] += (-st.ou[j] / tau[j]) * dt + sqrt((2 * dt) / tau[j]) * gauss();
  const gam = st.gam * cl(1 + 0.22 * st.ou[0], 0.55, 1.5);
  const ks = (1.43 / st.R0) * exp(0.17 * cl(st.ou[1], -1.8, 1.8));
  if (st.kb < 0 || abs(log(ks / st.kb)) > 0.04) {
    buildKernel(st.kern, ks, 1);
    st.kb = ks;
  }
  const gam1 = 0.02 + 0.14 * sqrt(st.kap);
  if (st.kb1 < 0) {
    buildKernel(st.kern1, 0.085, 2);
    st.kb1 = 0.085;
  }
  const kern = st.kern, kern1 = st.kern1;
  // the growth: a kernel of the radius, which a neck turns up as it narrows
  for (let i = 0; i < M; i++) {
    let a = 0, b = 0;
    const m0 = max(-L, -i), m1 = min(L, M - 1 - i);
    for (let m = m0; m <= m1; m++) a += kern[L + m] * s[i + m];
    cs[i] = a;
    const q0 = max(-L, -floor(i / 2)), q1 = min(L, floor((M - 1 - i) / 2));
    for (let q = q0; q <= q1; q++) b += kern1[L + q] * x[i + 2 * q];
    cx[i] = b;
  }
  for (let i = 0; i < M; i++) {
    const si = s[i], d = max(0, -si - 0.15), g = 1 + 12 * d * d;
    const lap = (i > 0 ? s[i - 1] : si) - 2 * si + (i < M - 1 ? s[i + 1] : si);
    let v = si + dt * (gam * (g * cs[i] - st.stab * si - 16 * d * d * (1 - st.ss * st.ss)) + DIFF * lap);
    if (v > 0.7) v = 0.7 + 0.3 * tanh((v - 0.7) / 0.3);
    s[i] = max(v, -0.86);
    x[i] = tanh(x[i] + dt * gam1 * cx[i]);
  }
  // the mass runs from the necks toward the bulges, by the radius seen over a few cells
  for (let p = 0; p < 2; p++) {
    const src = p ? ft : s, dst = p ? cs : ft;
    for (let i = 0; i < M; i++) {
      let a = 0;
      for (let m = -2; m <= 2; m++) a += src[cl(i + m, 0, M - 1)];
      dst[i] = a / 5;
    }
  }
  for (let i = 0; i < M - 1; i++) {
    const u = MU * (cs[i + 1] - cs[i]);
    let q = u > 0 ? n[i] * u * dt : n[i + 1] * u * dt;
    const lim = 0.3 * (q > 0 ? n[i] : n[i + 1]);
    q = cl(q, -lim, lim);
    fl[i] = q;
  }
  n[0] += -fl[0];
  for (let i = 1; i < M - 1; i++) n[i] += fl[i - 1] - fl[i];
  n[M - 1] += fl[M - 2];
  // and the pressure of the plasma spreads a bead as far as the pull of the radius allows
  for (let i = 0; i < M; i++) ft[i] = n[i] + DN * dt * ((i > 0 ? n[i - 1] : n[i]) - 2 * n[i] + (i < M - 1 ? n[i + 1] : n[i]));
  n.set(ft);
  // the flash spreads along the column and dies
  const dec = exp(-dt / 0.5);
  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < M; i++) ft[i] = f[i] + 0.25 * ((i > 0 ? f[i - 1] : 0) - 2 * f[i] + (i < M - 1 ? f[i + 1] : 0));
    f.set(ft);
  }
  for (let i = 0; i < M; i++) f[i] *= dec;
  // a neck that has closed to a thread flashes and breaks: the column is cut there, the mass in it goes to the beads either side
  const Rb = max(3.0, 0.42 * st.R0);
  for (let i = 4; i < M - 4; i++) {
    if (st.R0 * (1 + s[i]) < Rb && s[i] <= s[i - 1] && s[i] <= s[i + 1]) {
      const amp = min(1, 0.5 + 0.5 * n[i]);
      for (let d = -10; d <= 10; d++) {
        const j = i + d;
        if (j >= 0 && j < M) f[j] = min(1.3, f[j] + amp * exp(-(d * d) / 18));
      }
      let take = 0;
      for (let d = -3; d <= 3; d++) {
        take += 0.8 * n[i + d];
        n[i + d] *= 0.2;
      }
      for (let d = 6; d <= 9; d++) {
        if (i - d >= 0) n[i - d] = min(4, n[i - d] + take / 8);
        if (i + d < M) n[i + d] = min(4, n[i + d] + take / 8);
      }
      // the neck is let go, and the two ends swell
      for (let d = -12; d <= 12; d++) {
        const w = exp(-(d * d) / 8), a = abs(d) - 7, j = i + d;
        if (j >= 0 && j < M) s[j] = min(0.7, s[j] * (1 - w) + 0.1 * w + 0.3 * exp(-(a * a) / 12));
      }
    }
  }
  for (let i = 0; i < M; i++) if (n[i] < 0.08) n[i] = 0.08;
  // the flow carries every cell up; a new cell comes in at the foot
  const v = (4 + 6 * st.ss) * pow(st.ik, 0.2) * cl(1 + 0.1 * st.ou[2], 0.7, 1.3);
  st.off += v * dt;
  while (st.off >= 1) {
    st.off -= 1;
    s.copyWithin(1, 0, M - 1);
    n.copyWithin(1, 0, M - 1);
    x.copyWithin(1, 0, M - 1);
    f.copyWithin(1, 0, M - 1);
    seedCell(st, 0, ks);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  derive(st);
  if (!st.init) {
    st.init = true;
    for (let j = 0; j < 4; j++) st.ou[j] = gauss() * 0.6;
    const ks = 1.43 / st.R0;
    for (let i = M - 1; i >= 0; i--) seedCell(st, i, ks);
    for (let i = 0; i < PRE / DT; i++) step(st, DT);
  }
  st.acc += cl(dt || 0, 0, 0.1);
  while (st.acc >= DT) {
    st.acc -= DT;
    st.t += DT;
    step(st, DT);
  }
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = 0.0 + st.k[0];
  if (abs(hue - st.hue) > 1e-4) (st.hue = hue), buildLut(st.lut, hue);
  const lut = st.lut, row = st.row, { s, n, x, f } = st;
  const bend = bendOf(st.kap), R0 = st.R0;
  // one row of the panel: where the axis is, how wide the column is and how bright
  for (let y = 0; y < H; y++) {
    const jf = H - 0.5 - y + MARG - st.off, j = floor(jf), u = jf - j;
    const si = mix(s[j], s[j + 1], u), ni = mix(n[j], n[j + 1], u), xi = mix(x[j], x[j + 1], u), fi = mix(f[j], f[j + 1], u);
    const R = cl(R0 * (1 + si), 2.6, 19);
    const B = min(4.5, ni) / pow(max(0.4, 1 + si), 1.6) + fi;
    const I = min(1.3, 1.35 * (1 - exp(-0.65 * B)));
    row[y * 5] = R;
    row[y * 5 + 4] = fi;
    row[y * 5 + 1] = I;
    row[y * 5 + 2] = 32 + xi * bend;
  }
  for (let y = 0; y < H; y++) {
    const R = row[y * 5], fi = row[y * 5 + 4], I = row[y * 5 + 1], cx = row[y * 5 + 2];
    const sg = 0.4 * R + 2.2 * fi, sh = 1.05 * R + 3 * fi, sw = 20 + 0.8 * R;
    const i2 = -1 / (2 * sg * sg), h2 = -1 / (2 * sh * sh), w2 = -1 / (2 * sw * sw), r0 = 2.4 * R, rw = 1 / (0.6 * R);
    const wide = 0.045 * sqrt(I), fh = 0.5 * fi * fi;
    for (let xx = 0; xx < W; xx++) {
      const d = xx + 0.5 - cx, d2 = d * d;
      const e = (abs(d) - r0) * rw, hg = exp(d2 * h2);
      const v = I * (exp(d2 * i2) + 0.32 * hg + 0.05 * exp(-0.5 * e * e)) + fh * hg + wide * exp(d2 * w2);
      const li = floor(cl(v, 0, IMAX) * ((NL - 1) / IMAX) + 0.5) * 3;
      display.setPixel(xx, y, lut[li] | 0, lut[li + 1] | 0, lut[li + 2] | 0);
    }
  }
}
