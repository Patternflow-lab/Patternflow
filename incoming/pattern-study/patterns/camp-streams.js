// ===== Patternflow pattern =====
// Title:   cAMP Streams
// Family:  amoeba
// Idea:    Starving Dictyostelium amoebae seen in dark field on a 64 by 128 panel, where waves of cyclic AMP run out in rings and spirals from pacemaker clumps and each wave front pulls the cells a couple of LEDs toward its source, so that a haze of blue cells gathers into branching white streams that flow into amber mounds, until a mound culminates and scatters its cells as fresh ones and new pacemakers start elsewhere.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cyclic AMP as the signal of slime mould aggregation (Gerisch, 1960s; Konijn, van de Meene, Bonner and Barkley, 1967), chemotactic aggregation as an instability (Evelyn Keller and Lee Segel, 1970), waves in the aggregating field seen in dark field (Alcantara and Monk, 1974), cAMP waves shown by isotope dilution (Tomchik and Devreotes, 1981), excitable models of the relay (Martiel and Goldbeter, 1987; John Tyson and James Murray, 1989), the two-variable excitable medium of Dwight Barkley (1991); pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Clock=0..3.2, Chemotaxis=-1..1, Excitability=-1..1
//
// Knob 1: Hue. Placeholder.
// Knob 2: Clock. Placeholder.
// Knob 3: Chemotaxis. Placeholder.
// Knob 4: Excitability. Placeholder.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, pow, exp, sin, cos, PI, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

// ---- the excitable field (Barkley form), lengths in LEDs and time in seconds at Clock 2
const EPS = 0.05, FA = 0.84, FB = 0.07, DL = 1.9, TAUV = 1.0;
const G_EX = 2, MA = 0, BQ = 10;
const KM = 3, ALPHA = 0.5, BETA = 0.03, MDIF = 0.05; // trails: how much a trail pulls, how fast flux writes one, how fast it fades, how far it spreads // how much density speeds the relay, and how much cells pull on cells
const HS = 0.03; // longest step
// ---- the cells
const RHO_M = 9; // density cap
const D0 = 0.15, D1 = 3; // random motility, and the push of crowding
const SLOW = 4; // steps between the slow fields

const XP = new Int32Array(N), XM = new Int32Array(N), YP = new Int32Array(N), YM = new Int32Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    XP[i] = y * W + ((x + 1) % W);
    XM[i] = y * W + ((x + W - 1) % W);
    YP[i] = ((y + 1) % H) * W + x;
    YM[i] = ((y + H - 1) % H) * W + x;
  }

function hsvOf(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, mx > 0 ? d / mx : 0, mx / 255];
}
function rgbOf(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [r * 255, g * 255, b * 255];
}

const STOPS = [
  [0.0, 10, 8, 32],
  [0.18, 16, 36, 110],
  [0.4, 40, 140, 220],
  [0.62, 150, 225, 245],
  [0.8, 250, 244, 228],
  [1.0, 255, 205, 120],
];
function stopColour(t, out) {
  let k = 0;
  while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
  const a = STOPS[k], b = STOPS[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * u;
  out[1] = a[2] + (b[2] - a[2]) * u;
  out[2] = a[3] + (b[3] - a[3]) * u;
}

function makeState() {
  const F = () => new Float32Array(N);
  return {
    u: F(), v: F(), un: F(), vn: F(), gate: F(), ph: F(), om: F(), ie: F(), jit: F(),
    rho: F(), rn: F(), rp: F(), rq: F(), mt: F(), fx: F(), tmp2: F(), rb: F(), tmp: F(), age: F(), phi: F(),
    lut: new Float32Array(256 * 3), hueDone: -1, knobs: [0, 2, 0, 0.06],
    tm: 0, nslow: 0, fire: new Int32Array(N), nfire: 0, evK: 0, nextLife: 60, params: null,
  };
}

// 1-2-1 blur along x and y on the torus, twice for the 5-tap binomial
function blur(src, dst, tmp, passes) {
  let a = src;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) tmp[i] = 0.25 * a[XM[i]] + 0.5 * a[i] + 0.25 * a[XP[i]];
    for (let i = 0; i < N; i++) dst[i] = 0.25 * tmp[YM[i]] + 0.5 * tmp[i] + 0.25 * tmp[YP[i]];
    a = dst;
  }
}

// What the knobs mean in model terms.
function derive(S) {
  const k = S.knobs;
  const k3 = cl(k[2], -1, 1), k4 = cl(k[3], -1, 1);
  return { chi: 7 * pow(2.2, k3), tpm: 7.4 * pow(1.32, -k4), clock: cl(k[1], 0, 3.2) / 2 };
}

// The slow fields: the smoothed density, what it does to the excitability and to the pacemaker clocks
function slow(S, P, h) {
  const { rho, rp, tmp, ie, om, jit } = S;
  blur(rho, rp, tmp, 2);
  blur(rp, S.rq, tmp, BQ);
  blur(S.mt, S.tmp2, tmp, 1);
  for (let i = 0; i < N; i++) S.mt[i] += MDIF * (S.tmp2[i] - S.mt[i]);
  const w1 = 1 / P.tpm;
  for (let i = 0; i < N; i++) {
    const s = sm((rp[i] - 0.5) / 3);
    ie[i] = (1 + G_EX * s) / EPS;
    const p = sm((rp[i] - 1.7) / 2.2);
    om[i] = (1 / 150000 + (w1 - 1 / 150000) * p) * jit[i];
  }
}

function step(S, P, h) {
  const { u, v, un, vn, gate, ph, om, ie, rho, rn, phi, rq, mt, fx } = S;
  const ginv = 1 / (0.6 * h);
  S.nfire = 0;
  for (let i = 0; i < N; i++) {
    const ui = u[i], vi = v[i];
    const lap = u[XP[i]] + u[XM[i]] + u[YP[i]] + u[YM[i]] - 4 * ui;
    let nu = ui + h * (DL * lap + ui * (1 - ui) * (ui - (vi + FB) / FA) * ie[i]);
    let p = ph[i] + h * om[i];
    const g0 = (nu - ui) * ginv;
    if (nu > 0.3 && g0 > 0.3) p = 0;
    else if (p >= 1) {
      if (ui < 0.08 && vi < 0.2) S.fire[S.nfire++] = i;
      p = 1;
    }
    ph[i] = p;
    nu = nu < 0 ? 0 : nu > 1 ? 1 : nu;
    const g = (nu - ui) * ginv;
    gate[i] = g < 0 ? 0 : g > 1 ? 1 : g;
    un[i] = nu;
    phi[i] = nu * (1 + MA * rq[i] + (KM * mt[i]) / (1 + mt[i]));
    vn[i] = vi + (h * (ui - vi)) / TAUV;
  }
  S.u = un; S.un = u; S.v = vn; S.vn = v;
  for (let f = 0; f < S.nfire; f++) {
    const i = S.fire[f], x = i % W, y = (i - x) / W;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 5) continue;
        const j = ((y + dy + H) % H) * W + ((x + dx + W) % W);
        S.u[j] = 1;
        S.ph[j] = 0;
      }
  }
  // cells: climb the field while it is rising, spread when crowded
  const uu = phi;
  rn.set(rho);
  fx.fill(0);
  const chi = P.chi * h;
  for (let i = 0; i < N; i++) {
    const ri = rho[i], ui = uu[i], gi = gate[i];
    for (let f = 0; f < 2; f++) {
      const j = f === 0 ? XP[i] : YP[i];
      const rj = rho[j], uj = uu[j], gj = gate[j];
      let fl = 0;
      const du = uj - ui;
      if (du > 0) fl += ri * gi * min(chi * du, 0.15) * (rj < RHO_M ? 1 - rj / RHO_M : 0);
      else if (du < 0) fl -= rj * gj * min(chi * -du, 0.15) * (ri < RHO_M ? 1 - ri / RHO_M : 0);
      const q = (ri + rj) * (0.5 / RHO_M);
      const d = min(D0 + D1 * q * q, 3);
      fl += h * d * (ri - rj);
      rn[i] -= fl;
      rn[j] += fl;
      const af = fl < 0 ? -fl : fl;
      fx[i] += af;
      fx[j] += af;
    }
  }
  S.rho = rn; S.rn = rho;
  const al = ALPHA, de = 1 - h * BETA;
  for (let i = 0; i < N; i++) mt[i] = mt[i] * de + al * fx[i];
}

function seedField(S) {
  const { rho, jit, tmp } = S;
  for (let i = 0; i < N; i++) tmp[i] = Math.random();
  blur(tmp, jit, S.rp, 3);
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < N; i++) { lo = min(lo, jit[i]); hi = max(hi, jit[i]); }
  for (let i = 0; i < N; i++) jit[i] = 0.9 + 0.2 * ((jit[i] - lo) / (hi - lo));
  for (let i = 0; i < N; i++) tmp[i] = Math.random();
  blur(tmp, rho, S.rp, 4);
  lo = 1e9; hi = -1e9;
  for (let i = 0; i < N; i++) { lo = min(lo, rho[i]); hi = max(hi, rho[i]); }
  for (let i = 0; i < N; i++) rho[i] = 0.55 + 0.9 * ((rho[i] - lo) / (hi - lo));
  // a few clumps of cells to start the first pacemakers from
  const seeds = [[20, 30], [44, 70], [18, 104], [48, 12]];
  for (const [cx, cy] of seeds)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let dx = abs(x - cx), dy = abs(y - cy);
        if (dx > W / 2) dx = W - dx;
        if (dy > H / 2) dy = H - dy;
        rho[y * W + x] += 4 * exp(-(dx * dx + dy * dy) / 18);
      }
  let tot = 0;
  for (let i = 0; i < N; i++) tot += rho[i];
  for (let i = 0; i < N; i++) rho[i] *= N / tot;
  for (let i = 0; i < N; i++) S.ph[i] = 0.6 * Math.random();
}

export function setup(params) {
  const S = (params.s = makeState());
  seedField(S);
  S.knobs = [0, 2, 0, 0.06];
  const P = derive(S);
  slow(S, P, HS);
  const steps = 1800;
  for (let n = 0; n < steps; n++) {
    step(S, P, HS);
    if (++S.nslow % SLOW === 0) slow(S, P, HS * SLOW);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.knobs = input.knobValues || [0, 2, 0, 0.06];
  const P = derive(S);
  let rest = cl(dt || 0, 0, 0.1) * P.clock * 2 * 0.5;
  rest = cl(dt || 0, 0, 0.1) * P.clock;
  while (rest > 1e-9) {
    const h = min(rest, HS);
    step(S, P, h);
    if (++S.nslow % SLOW === 0) slow(S, P, h * SLOW);
    rest -= h;
  }
}

function buildLut(S, hue) {
  const t = [0, 0, 0];
  for (let k = 0; k < 256; k++) {
    stopColour(k / 255, t);
    const [h, s, v] = hsvOf(t[0], t[1], t[2]);
    S.lut.set(rgbOf(h + hue, s, v), k * 3);
  }
  S.hueDone = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.knobs[0], 0, 1) + 0.0;
  if (S.hueDone !== hue) buildLut(S, hue);
  const { u, rho, rb, tmp, lut } = S;
  blur(rho, rb, tmp, 2);
  for (let i = 0; i < N; i++) {
    const L = 1 - exp(-rb[i] / 2.2);
    const w = u[i];
    const s = cl(L * 0.8 + w * 0.3 * (0.4 + L), 0, 1);
    const li = ((s * 255) | 0) * 3;
    const f = 1;
    display.setPixel(i % W, (i / W) | 0, lut[li] * f, lut[li + 1] * f, lut[li + 2] * f);
  }
}
