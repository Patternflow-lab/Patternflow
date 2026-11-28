// ===== Patternflow pattern =====
// Title:   Edge Stopping
// Family:  scalespace
// Idea:    Every row of the panel is the same 64-sample colour strip of stained-glass plateaus after a little more Perona-Malik diffusion than the row above, so the top is the fine strip and the bottom the coarsest, and weak edges melt in a cascade down the panel while the strong ones stand still and crisp until a neighbour squeezes them out.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: nonlinear diffusion with a conductance that falls where the gradient is large (Pietro Perona and Jitendra Malik, "Scale-space and edge detection using anisotropic diffusion", 1990, from memory), the linear scale space it changes (Andrew Witkin, 1983, from memory); pattern round 273
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Edge=0..4, Scale=-1..1, Drift=-1..1
//
// Knob 1: Hue. placeholder
// Knob 2: Edge. placeholder
// Knob 3: Scale. placeholder
// Knob 4: Drift. placeholder

const W = 64, H = 128, N = 64;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const pw = Math.pow;

const M = 4;                 // explicit steps from one row to the next
const D0 = 30;               // diffusion time over the whole panel at Scale 0
const K0 = 0.058;            // the edge threshold at Edge 0
const SMIN = 0.1, SMAX = 0.7;   // the shortest and the longest step between neighbouring strips
const GW = 0.3;              // how far the whole palette slides along the ribbon
const WT = 0.07;             // how far a strip wanders along it on its own
           // half the spread of the strips along the ribbon
const WV = 0.5;              // weight of the brightness channel in the gradient
const HUE0 = 0.0;            // turns added to the ribbon's hue at Hue = 0

// the ribbon: a position t from 0 to 1 is a colour, and a plateau is a position and a brightness
const RIB = [
  [0.00, 90, 125, 240],
  [0.12, 150, 105, 235],
  [0.25, 225, 110, 215],
  [0.38, 245, 105, 135],
  [0.50, 250, 165, 80],
  [0.62, 235, 205, 75],
  [0.75, 170, 225, 95],
  [0.88, 70, 205, 150],
  [1.00, 65, 180, 215],
];
const NL = 256;
const LY = new Float32Array(NL + 1), LI = new Float32Array(NL + 1), LQ = new Float32Array(NL + 1);
for (let k = 0; k <= NL; k++) {
  const t = k / NL;
  let a = 0;
  while (a < RIB.length - 2 && t > RIB[a + 1][0]) a++;
  const A = RIB[a], B = RIB[a + 1], f = cl((t - A[0]) / (B[0] - A[0]), 0, 1), u = f * f * (3 - 2 * f);
  const r = (A[1] + (B[1] - A[1]) * u) / 255, g = (A[2] + (B[2] - A[2]) * u) / 255, b = (A[3] + (B[3] - A[3]) * u) / 255;
  LY[k] = 0.299 * r + 0.587 * g + 0.114 * b;
  LI[k] = 0.596 * r - 0.274 * g - 0.322 * b;
  LQ[k] = 0.211 * r - 0.523 * g + 0.312 * b;
}

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(S) {
  const u = max(S.r(), 1e-9), v = S.r();
  return sqrt(-2 * log(u)) * cos(TAU * v);
}

// ---------------------------------------------------------------- the strip
// a triangle wave: a position that runs off one end of the ribbon comes back along it
function refl(x) {
  const r = x - 2 * floor(x / 2);
  return r > 1 ? 2 - r : r;
}

// A strip takes the colour of the one to its left and goes a step along the ribbon, signed,
// most steps small and a few large (a log-uniform length from 0.03 to 0.55), so the edges
// between strips run from very weak to very strong and the weak ones are the first to melt.
function newStrip(S, born, left) {
  const r = S.r;
  let b = r();
  if (left !== null) {
    // the sign leans toward the middle of the ribbon, so the palette does not pile up at one end
    const up = cl(0.5 + 1.1 * (0.5 - left.b), 0.08, 0.92);
    b = refl(left.b + (r() < up ? 1 : -1) * SMIN * pw(SMAX / SMIN, r()));
  }
  return {
    x: born ? -1.2 : log(0.6 + r() * 1.2), fade: 0, life: 40 + 90 * r(), mu: 0, amp: born ? 0 : 1, age: 0,
    b, ta: 0.35 + 0.65 * r(),
    w1: 0.03 + 0.08 * r(), p1: TAU * r(), w2: 0.05 + 0.1 * r(), p2: TAU * r(),
    va: 0.3 + 0.5 * r(), w3: 0.04 + 0.1 * r(), p3: TAU * r(), v0: r(),
    wj: 0.7 + 1.4 * r(), pj: TAU * r(), aj: 0.05 + 0.1 * r(), w: 4,
  };
}

export function setup(params) {
  const S = {
    r: mulberry((Math.random() * 4294967296) >>> 0), tau: 0, k: null, strips: [],
    T: new Float32Array(W * H), V: new Float32Array(W * H),
    nz: new Float32Array(2 * N), top: new Float32Array(2 * N),
    ph: [], gh: 0, hue: 0, wr: new Float32Array(H),
  };
  for (let i = 0; i < 6; i++) S.ph.push(TAU * S.r());
  for (let i = 0; i < 13; i++) S.strips.push(newStrip(S, false, i ? S.strips[i - 1] : null));
  params.s = S;
}

function stripWidths(S, tau) {
  const st = S.strips, n = st.length;
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const s = st[j];
    s.w = exp(s.x) * (1 + s.aj * sin(s.wj * tau + s.pj));
    sum += s.w;
  }
  const k = N / sum;
  for (let j = 0; j < n; j++) st[j].w *= k;
}

// advance the slow state by d seconds of strip time
function evolve(S, d, speed) {
  const dt = d * speed;
  S.tau += dt;
  const st = S.strips;
  let n = 0;
  for (let j = 0; j < st.length; j++) if (!st[j].fade) n++;
  const mu = log(N / max(8, n));
  for (let j = st.length - 1; j >= 0; j--) {
    const s = st[j];
    if (s.life > 0) s.life -= dt;
    if (s.life <= 0 && !s.fade && n > 10) { s.fade = 1; n--; }
    if (s.fade) {
      // a strip fades by taking the colour of its left neighbour, and goes when it has
      s.amp += (0 - s.amp) * (1 - exp(-dt / 3.5));
      if (s.amp < 0.04) {
        s.x += (-3.2 - s.x) * (1 - exp(-dt / 1.2));
        if (s.w < 0.4) st.splice(j, 1);
      }
    } else {
      s.amp += (1 - s.amp) * (1 - exp(-dt / 4));
      s.mu += (gauss(S) * 0.3 - s.mu) * (1 - exp(-dt / 7));
      s.x += (mu + s.mu - s.x) * (1 - exp(-dt / 4));
    }
  }
  // a strip is born between two others, narrow, and widens
  const rate = n < 11 ? 0.15 : n < 13 ? 0.05 : n < 15 ? 0.012 : 0;
  if (S.r() < 1 - exp(-rate * dt)) {
    const at = floor(S.r() * (st.length + 1));
    st.splice(at, 0, newStrip(S, true, at ? st[at - 1] : null));
  }
}

// the top row: the strips with their edges and colours, a fine grain
function topRow(S, noise) {
  stripWidths(S, S.tau);
  const st = S.strips, n = st.length, T = S.top, tau = S.tau;
  const ct = new Float32Array(n), cv = new Float32Array(n);
  const gl = GW * (0.6 * sin(0.0113 * tau + S.ph[0]) + 0.4 * sin(0.0179 * tau + S.ph[1]));
  for (let j = 0; j < n; j++) {
    const s = st[j];
    const a = refl(s.b + gl + WT * s.ta * (0.62 * sin(s.w1 * tau + s.p1) + 0.38 * sin(s.w2 * tau + s.p2)));
    const c = 0.5 + 0.5 * s.va * sin(s.w3 * tau + s.p3 + 6 * s.v0);
    const am = s.amp * s.amp * (3 - 2 * s.amp);
    ct[j] = j ? ct[j - 1] + (a - ct[j - 1]) * am : a;
    cv[j] = j ? cv[j - 1] + (c - cv[j - 1]) * am : c;
  }
  let j = 0, edge = st[0].w;
  for (let i = 0; i < N; i++) {
    let t = 0, v = 0, left = 1, x0 = i;
    while (left > 1e-9) {
      while (edge <= x0 + 1e-9 && j < n - 1) {
        j++;
        edge += st[j].w;
      }
      const f = min(left, max(0, edge - x0)) || left;
      t += ct[j] * f;
      v += cv[j] * f;
      left -= f;
      x0 += f;
    }
    T[i] = t + noise * S.nz[i];
    T[N + i] = v + noise * S.nz[N + i];
  }
}

// one explicit Perona-Malik step on the two channels, shared conductance, reflecting sides
const FT = new Float32Array(N), FV = new Float32Array(N);
function pmStep(T, V, o, dt, ik2) {
  for (let i = 0; i < N - 1; i++) {
    const a = o + i, dT = T[a + 1] - T[a], dV = WV * (V[a + 1] - V[a]);
    const x = (dT * dT + dV * dV) * ik2, g = dt / (1 + x * x);
    FT[i] = g * dT;
    FV[i] = g * (V[a + 1] - V[a]);
  }
  T[o] += FT[0];
  V[o] += FV[0];
  for (let i = 1; i < N - 1; i++) {
    T[o + i] += FT[i] - FT[i - 1];
    V[o + i] += FV[i] - FV[i - 1];
  }
  T[o + N - 1] -= FT[N - 2];
  V[o + N - 1] -= FV[N - 2];
}

function stack(S, K, D, t) {
  const T = S.T, V = S.V, TP = S.top;
  for (let i = 0; i < N; i++) {
    T[i] = TP[i];
    V[i] = TP[N + i];
  }
  const ik2 = 1 / (K * K), wr = S.wr;
  let wsum = 0;
  // the scale axis: row r is a little further along than row r - 1; the weight of the
  // rows breathes so the cascade slides up and down very slowly
  const br = 0.2 * sin(0.0151 * t + S.ph[3]) + 0.12 * sin(0.0263 * t + S.ph[4]);
  for (let r = 1; r < H; r++) {
    wr[r] = pw(1 + r / 24, 0.55 + br);
    wsum += wr[r];
  }
  for (let r = 1; r < H; r++) {
    const o = r * W, p = (r - 1) * W;
    for (let i = 0; i < N; i++) {
      T[o + i] = T[p + i];
      V[o + i] = V[p + i];
    }
    const dt = (D * wr[r]) / wsum / M;
    for (let m = 0; m < M; m++) pmStep(T, V, o, dt, ik2);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    const sp = 0.3 * pw(7, (S.k[3] + 1) / 2);
    for (let i = 0; i < 600; i++) evolve(S, 0.1, sp);
  }
  const al = 1 - exp(-d / 0.2);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  const speed = 0.3 * pw(7, (cl(S.k[3], -1, 1) + 1) / 2);
  if (d > 0) {
    evolve(S, d, speed);
    const a = exp(-d / 0.9), sg = 0.008 * sqrt(1 - a * a);
    for (let i = 0; i < 2 * N; i++) S.nz[i] = S.nz[i] * a + sg * gauss(S);
  }
  const K = K0 * pw(12, cl(S.k[1], 0, 4) / 4);
  const D = D0 * pw(3, cl(S.k[2], -1, 1));
  S.hue = HUE0 + S.k[0];
  topRow(S, 1);
  stack(S, K, D, S.tau);
}

// ------------------------------------------------------------------ drawing
const RY = new Float32Array(NL + 1), RR = new Float32Array(NL + 1), RG = new Float32Array(NL + 1), RB = new Float32Array(NL + 1);
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.T, V = S.V;
  const a = TAU * S.hue, ca = cos(a), sa = sin(a);
  for (let k = 0; k <= NL; k++) {
    const i0 = LI[k], q0 = LQ[k], ii = i0 * ca - q0 * sa, qq = i0 * sa + q0 * ca, y = LY[k];
    RR[k] = y + 0.956 * ii + 0.621 * qq;
    RG[k] = y - 0.272 * ii - 0.647 * qq;
    RB[k] = y - 1.106 * ii + 1.703 * qq;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, f = cl(T[p], 0, 1) * NL, k = min(NL - 1, floor(f)), u = f - k;
      const pa = 0.3 * (1 - cl(V[p], 0, 1)), br = 0.92;
      const r = ((RR[k] + (RR[k + 1] - RR[k]) * u) * (1 - pa) + pa) * br, g = ((RG[k] + (RG[k + 1] - RG[k]) * u) * (1 - pa) + pa) * br, b = ((RB[k] + (RB[k + 1] - RB[k]) * u) * (1 - pa) + pa) * br;
      display.setPixel(x, y, (cl(r, 0, 1) * 255) | 0, (cl(g, 0, 1) * 255) | 0, (cl(b, 0, 1) * 255) | 0);
    }
  }
}
