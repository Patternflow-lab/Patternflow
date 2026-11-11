// ===== Patternflow pattern =====
// Title:   Oscillon Gas
// Family:  wave
// Idea:    A pumped, damped sine-Gordon field is solved on the panel's own 64 by 128 torus, its energy glows and its oscillation phase picks the hue, so lumps that pulse in place are born from a shaken vacuum, drift, collide, ring and re-form for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: oscillons (Igor Bogolyubsky and Vladimir Makhankov, 1976, from memory; the name from Marcelo Gleiser, 1994, from memory); the Faraday instability of a shaken layer (Michael Faraday, 1831, from memory) and its oscillons in a vibrated granular layer (Paul Umbanhowar, Francisco Melo and Harry Swinney, 1996, from memory); parametric resonance and the Mathieu equation (Emile Mathieu, 1868, from memory); velocity Verlet with the damping as an exact half-step factor on each side (Loup Verlet, 1967, from memory); pattern round 128
// Round:   128
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1.4..3.6, Scale=-1..1, Pump=-1..1
//
// Knob 1: Hue.
// Knob 2: Speed.
// Knob 3: Scale.
// Knob 4: Pump.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, log, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];
const PK = 0.5; // share of the instantaneous energy beside its time average
const PSI0 = -0.6; // the phase the locked lumps sit at against the pump's half frequency, measured

const HS = 0.25; // model time per step
const RHO = 0.5; // mass-time units per panel second at Speed 1
const M0 = 0.66, MR = 1.25; // mass at Scale 0, and the factor per unit of Scale
const GP = 0.03; // damping over mass


function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function setup(params, k) {
  const S = {
    t: 0, th: 0, acc: 0, m: M0, A: 0.46, Om: 2 * M0, uA: 0, uO: 0, me: 1, warm: false, sa: 0.05, so: 0.015,
    phi: new Float64Array(N), v: new Float64Array(N), F: new Float64Array(N),
    E: new Float32Array(N), P: new Float32Array(N), I: new Float32Array(N), Q: new Float32Array(N), tmp: new Float64Array(N),
  };
  params.s = S;
  return S;
}

// the force on every cell, F = lap phi - m^2 (1 + A cos th) sin phi, on the torus
function force(S) {
  const { phi, F } = S, m2 = S.m * S.m * (1 + S.A * cos(S.th));
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = (y === 0 ? H - 1 : y - 1) * W, rd = (y === H - 1 ? 0 : y + 1) * W;
    let c = phi[r], l = phi[r + W - 1], rr = phi[r + 1];
    F[r] = l + rr + phi[ru] + phi[rd] - 4 * c - m2 * sin(c);
    for (let x = 1; x < W - 1; x++) {
      const p = r + x;
      c = phi[p];
      F[p] = phi[p - 1] + phi[p + 1] + phi[ru + x] + phi[rd + x] - 4 * c - m2 * sin(c);
    }
    const p = r + W - 1;
    c = phi[p];
    F[p] = phi[p - 1] + phi[r] + phi[ru + W - 1] + phi[rd + W - 1] - 4 * c - m2 * sin(c);
  }
}

// One velocity-Verlet step with the damping as exp(-gamma h / 2) on the velocity before the first kick and after the second.
function step(S) {
  const { phi, v, F } = S, e = exp(-0.5 * S.gam * HS), hh = 0.5 * HS;
  for (let p = 0; p < N; p++) {
    const vv = e * v[p] + hh * F[p];
    v[p] = vv;
    phi[p] += HS * vv;
  }
  S.th += S.Om * HS;
  force(S);
  for (let p = 0; p < N; p++) v[p] = e * (v[p] + hh * F[p]);
}

function smoothField(a, rms) {
  const b = new Float64Array(N);
  for (let p = 0; p < N; p++) a[p] = gauss();
  for (let it = 0; it < 3; it++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; b[p] = 0.5 * a[p] + 0.25 * (a[y * W + (x + 1) % W] + a[y * W + (x + W - 1) % W]); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; a[p] = 0.5 * b[p] + 0.25 * (b[((y + 1) % H) * W + x] + b[((y + H - 1) % H) * W + x]); }
  }
  let s = 0;
  for (let p = 0; p < N; p++) s += a[p] * a[p];
  s = rms / sqrt(s / N);
  for (let p = 0; p < N; p++) a[p] *= s;
}

function knobs(S, k) {
  S.hue = cl(k[0], 0, 1);
  S.spd = cl(k[1], 0.2, 5);
  S.mt = M0 * pow(MR, cl(k[2], -1, 1));
  const q = cl(k[3], -1, 1);
  S.A0 = 0.47 * (q < 0 ? pow(0.82, -q) : pow(1.66, q));
}

// Ornstein-Uhlenbeck step in panel seconds, unit variance, correlation time tc
function ou(u, d, tc) {
  const a = exp(-d / tc);
  return u * a + sqrt(1 - a * a) * gauss();
}

function advance(S, d, mdl) {
  S.uA = ou(S.uA, d, 60);
  S.uO = ou(S.uO, d, 25);
  S.m += (S.mt - S.m) * (1 - exp(-d / 0.5));
  S.A = S.A0 * exp(S.sa * S.uA);
  S.Om = 2 * S.m * (1 - 0.04 + S.so * S.uO);
  S.gam = GP * S.m;
  const model = mdl || d * RHO * S.spd / S.m;
  S.acc = min(S.acc + model, 40 * HS);
  let n = 0;
  while (S.acc >= HS) {
    S.acc -= HS;
    step(S);
    n++;
  }
  if (!n) return;
  // time averages: energy over about 1.6 / m, and the lock-in of phi against the pump's half frequency over 6 / m
  const { phi, v, E, P, I, Q } = S, m2 = S.m * S.m, mdt = n * HS;
  const ae = 1 - exp(-mdt * S.m / 1.6), ai = 1 - exp(-mdt * S.m / 6), c = cos(0.5 * S.th), sn = sin(0.5 * S.th);
  let sum = 0;
  for (let y = 0; y < H; y++) {
    const r = y * W, rd = (y === H - 1 ? 0 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const p = r + x, dx = phi[x === W - 1 ? r : p + 1] - phi[p], dy = phi[rd + x] - phi[p];
      const e = 0.5 * v[p] * v[p] + 0.5 * (dx * dx + dy * dy) + m2 * (1 - cos(phi[p]));
      P[p] = e;
      E[p] += ae * (e - E[p]);
      sum += E[p];
      I[p] += ai * (phi[p] * c - I[p]);
      Q[p] += ai * (phi[p] * sn - Q[p]);
    }
  }
  S.me += (sum / N / m2 - S.me) * (1 - exp(-d / 20));
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  knobs(S, k);
  if (!S.warm) {
    S.warm = true;
    S.m = S.mt;
    smoothField(S.phi, 0.4);
    S.A = S.A0;
    S.me = 1;
    S.gam = GP * S.m;
    force(S);
    for (let i = 0; i < 40; i++) advance(S, 0.2, 6);
    let sum = 0;
    for (let p = 0; p < N; p++) sum += S.E[p];
    S.me = sum / N / (S.m * S.m);
  }
  advance(S, cl(dt || 0, 0, 0.1));
}

// ---- colour ---------------------------------------------------------------------------------
// LUT[(sign * LS + level) * 3]: level is the time-averaged energy through a knee, sign is the cosine of the lumps' phase against the pump.
const GS = 24, LS = 48;
function oklab2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
  return [e(r), e(g), e(bb)];
}
function fit(L, a, b) {
  for (let k = 0; k < 40; k++) {
    const c = oklab2rgb(L, a, b), y = (c[0] * 77 + c[1] * 150 + c[2] * 29) / 256;
    if (c.every((v) => v >= 0 && v <= 1 && y + (v - y) * 1.62 >= -0.01 && y + (v - y) * 1.62 <= 1.01)) return c;
    a *= 0.96;
    b *= 0.96;
  }
  return oklab2rgb(L, a, b).map((v) => cl(v, 0, 1));
}
const HUES = [235, 320, 420]; // cool, middle, warm, in degrees of OKLab hue; the knob adds 360 per unit to all three
function buildLut(S) {
  const lut = S.lut || (S.lut = new Float32Array(GS * LS * 3)), off = 15 + 360 * S.hue, hg = ((HUES[0] + 25 + off) * PI) / 180;
  for (let gi = 0; gi < GS; gi++) {
    const g = (gi / (GS - 1)) * 2 - 1, u = (g + 1) / 2, hd = u < 0.5 ? HUES[0] + (HUES[1] - HUES[0]) * (u * 2) : HUES[1] + (HUES[2] - HUES[1]) * (u * 2 - 1);
    const hr = ((hd + off) * PI) / 180, cg = 0.7 + 0.3 * Math.abs(g);
    for (let li = 0; li < LS; li++) {
      const t = li / (LS - 1), w = cl((t - 0.04) / 0.41, 0, 1), sw = w * w * (3 - 2 * w), L = 0.17 + 0.75 * t ** 1.6, C = 0.17 * sin(PI * pow(t, 0.7)) * cg;
      const c = fit(L, (1 - sw) * 0.035 * cos(hg) + sw * C * cos(hr), (1 - sw) * 0.035 * sin(hg) + sw * C * sin(hr)), o = (gi * LS + li) * 3;
      lut[o] = c[0];
      lut[o + 1] = c[1];
      lut[o + 2] = c[2];
    }
  }
  S.lh = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  if (S.lh !== S.hue) buildLut(S);
  const { E, P, I, Q, lut } = S, c0 = cos(PSI0), s0 = sin(PSI0), ex = pow(cl(S.me, 0.4, 4), 0.85), is = 1 / (S.m * S.m * ex);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const en = (E[p] + PK * (P[p] - E[p])) * is, t = cl(en / 6, 0, 1) ** 0.8;
      const a = sqrt(I[p] * I[p] + Q[p] * Q[p]) + 1e-9, g = (I[p] * c0 + Q[p] * s0) / a;
      const o = (((g * 0.5 + 0.5) * (GS - 1) + 0.5) | 0) * LS + ((t * (LS - 1) + 0.5) | 0);
      display.setPixel(x, y, lut[o * 3] * 255, lut[o * 3 + 1] * 255, lut[o * 3 + 2] * 255);
    }
}
