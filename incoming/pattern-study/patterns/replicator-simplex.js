// ===== Patternflow pattern =====
// Title:   Replicator Simplex
// Family:  evolutionarygame
// Idea:    Two triangles, one above the other, each the space of all mixtures of three strategies in a rock-paper-scissors game, with about sixty small populations flowing through each as glowing comets that spiral into coexistence in one triangle while they spiral out towards the edges and corners of the other, and every minute or so the two swap, passing through a moment where both hold closed loops.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: replicator dynamics x_i' = x_i ((A x)_i - x.A x) on the simplex of a cyclic three-strategy game (Peter Taylor and Leo Jonker, 1978; Josef Hofbauer and Karl Sigmund, Evolutionary Games and Population Dynamics, 1998), the interior fixed point as a centre, a stable spiral or an unstable spiral that winds out to a heteroclinic cycle, with the Wright-Fisher diffusion of a population of N (Ronald Fisher and Sewall Wright, 1930s; covariance x_i (delta_ij - x_j) / N), the state space drawn as Maxwell's colour triangle (James Clerk Maxwell, 1855), all from memory, pattern round 241
// Round:   241
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spin=0.6..4, Bias=-1..1, Crowd=-1..1
//
// Knob 1: Hue. Turns the three corner colours round the wheel together, 360 degrees over the knob. At 0 the corners are coral pink, teal and violet and the middle of each triangle blends to a warm pink; at 0.5 they are amber, violet-blue and green. The colours also drift a few tens of degrees by themselves over a couple of minutes.
// Knob 2: Spin. 0.6 to 4, opening at 2. The time scale of the flow: a loop near the middle of a triangle takes 24 s at 0.6, 7.3 s at 2 and 3.6 s at 4. The tails fade in 2 s and are cut at 15 LED, so at high Spin they are shorter in time and the comets look like sparks.
// Knob 3: Bias. -1 to 1, opening at 0. How far the two triangles are pulled apart. At -1 the parameter is held at zero and both triangles hold closed loops, orbits round the centre that never spiral. At 0 it wanders on its own, between about -0.55 and 0.55, crossing zero every minute or so, one triangle spiralling in while the other spirals out. At 1 it is pushed 0.25 one way on top, so the top triangle is a stable spiral most of the time, drawing everyone to a knot at the centre, and the bottom one an unstable spiral whose comets run round the edges and wait at the corners.
// Knob 4: Crowd. -1 to 1, opening near 0. The size of each population, N = 40 at -1, 135 at the opening and 400 at 1, and the number of comets in each triangle, 46 at -1, 65 at the opening and 82 at 1; both swell and thin by a fifth on their own. Small populations are noisy: orbits wander off their loops, comets fall onto the corners and are replaced at once. Large ones follow the clean deterministic curves.

const W = 64, H = 128;
const { floor, ceil, abs, min, max, exp, sqrt, sin, cos, tanh, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- layout -----------------------------------------------------------------
const SIDE = 60;                    // LED along one edge of each triangle
const GAP = 10;                     // dark LED rows between the two
const ROT = 0;                      // radians the triangles are turned from point-up
const ALT = SIDE * 0.8660254;       // altitude: the distance from a corner to the opposite edge
const NP = 256;                     // comets in the pool of each triangle
const C0 = 1.5;                     // dynamic time units a second at Spin 2 (centre loop: 2 pi / (c / sqrt 3))
const T_MAX = 2.0;                  // seconds a comet's tail lasts at most
const L_MAX = 15;                   // LED a tail is cut at, so a fast comet is not a long streak
const HN = 48;                      // points of path each comet remembers
const NOISE_K = 2;                   // variance a dynamic time unit is NOISE_K x_i (1 - x_i) / N

// the palette: three corner colours in OKLCH, degrees at Hue 0
const HUES = [8, 200, 302];
const PL = [0.77, 0.79, 0.66];
const PC = [0.15, 0.12, 0.19];

// ---- colour -----------------------------------------------------------------
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];

// OKLab to linear sRGB, negative channels cut off
function labToLin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  o[0] = r > 0 ? r : 0;
  o[1] = g > 0 ? g : 0;
  o[2] = bl > 0 ? bl : 0;
}
const TMP = [0, 0, 0];

// The barycentric mix x of the three corner colours, blended in OKLab with the weights x_i^pw, the chroma lifted in the middle
// where three hues would cancel to grey, then scaled so the strongest channel is `top`; warm and dim colours are paled
// towards their own luminance so an orange wash does not turn brown.
function mixColour(pal, x1, x2, x3, pw, boost, top, pale, o, oo) {
  let w1 = pow(x1 > 1e-6 ? x1 : 1e-6, pw), w2 = pow(x2 > 1e-6 ? x2 : 1e-6, pw), w3 = pow(x3 > 1e-6 ? x3 : 1e-6, pw);
  const sw = 1 / (w1 + w2 + w3);
  w1 *= sw;
  w2 *= sw;
  w3 *= sw;
  const L = w1 * pal[0] + w2 * pal[3] + w3 * pal[6];
  const s = 1 + boost * 27 * x1 * x2 * x3;
  const a = (w1 * pal[1] + w2 * pal[4] + w3 * pal[7]) * s, b = (w1 * pal[2] + w2 * pal[5] + w3 * pal[8]) * s;
  labToLin(L, a, b, TMP);
  let r = TMP[0], g = TMP[1], bl = TMP[2];
  const m = max(r, g, bl) + 1e-9;
  const k = top / m;
  r *= k;
  g *= k;
  bl *= k;
  if (pale > 0) {
    const warm = cl((r - bl) / top - 0.15, 0, 0.7) / 0.7;
    const q = pale * warm, lu = 0.3 * r + 0.6 * g + 0.1 * bl;
    r += (lu - r) * q * 0.6 + (top - r) * q * 0.25;
    g += (lu - g) * q * 0.6 + (top - g) * q * 0.25;
    bl += (lu - bl) * q * 0.6 + (top - bl) * q * 0.25;
  }
  o[oo] = r;
  o[oo + 1] = g;
  o[oo + 2] = bl;
}

function buildPalette(st, shift) {
  const pal = st.pal;
  for (let i = 0; i < 3; i++) {
    const h = ((HUES[i] + shift) * PI) / 180;
    pal[i * 3] = PL[i];
    pal[i * 3 + 1] = PC[i] * cos(h);
    pal[i * 3 + 2] = PC[i] * sin(h);
  }
}

// the wash and the soft outline of both triangles, in linear light; rebuilt when Hue moves
function buildBase(st) {
  const base = st.base, act = st.act, bx = st.bx, dist = st.dist, pal = st.pal;
  base.fill(0);
  for (let n = 0; n < act.length; n++) {
    const p = act[n], d = dist[p];
    let x1 = bx[p * 3], x2 = bx[p * 3 + 1], x3 = bx[p * 3 + 2];
    if (x1 < 0) x1 = 0;
    if (x2 < 0) x2 = 0;
    if (x3 < 0) x3 = 0;
    const s = 1 / (x1 + x2 + x3);
    x1 *= s;
    x2 *= s;
    x3 *= s;
    const inside = sstep(-0.6, 0.6, d), glow = exp(-(d * d) / (2 * 0.85 * 0.85));
    const o = TMP2;
    mixColour(pal, x1, x2, x3, 1, 1.5, 0.075, 0.9, o, 0);
    mixColour(pal, x1, x2, x3, 1.8, 0.5, 0.21, 1.0, o, 3);
    base[p * 3] = o[0] * inside + o[3] * glow;
    base[p * 3 + 1] = o[1] * inside + o[4] * glow;
    base[p * 3 + 2] = o[2] * inside + o[5] * glow;
  }
}
const TMP2 = new Float64Array(6);

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, shiftB: -999,
    pal: new Float64Array(9),
    base: new Float32Array(W * H * 3), fx: new Float32Array(W * H * 3),
    hx: new Float32Array(2 * NP * HN), hy: new Float32Array(2 * NP * HN), ht: new Float64Array(2 * NP * HN), hc: new Float32Array(2 * NP * HN * 3),
    hi: new Int32Array(2 * NP), hn: new Int32Array(2 * NP), lx: new Float64Array(2 * NP), ly: new Float64Array(2 * NP),
    X: new Float64Array(2 * NP * 3), age: new Float32Array(2 * NP), life: new Float32Array(2 * NP), dwell: new Float32Array(2 * NP),
    alpha: new Float32Array(2 * NP), dying: new Uint8Array(2 * NP), live: new Uint8Array(2 * NP),
    px: new Float64Array(2 * NP), py: new Float64Array(2 * NP),
    Nv: 135, Pv: 64,
    y1: gauss() * 0.3, y2: gauss() * 0.3, ph: [rnd() * TAU, rnd() * TAU, rnd() * TAU], eT: 0.3, eB: -0.3, w: 0,
    V: new Float64Array(12),
  });
  layout(st);
  for (let i = 0; i < 2 * NP; i++) seed(st, i, false);
  return st;
}

function layout(st) {
  const R = SIDE / sqrt(3);
  const vx = [0, 0, 0], vy = [0, 0, 0];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < 3; i++) {
    const a = -PI / 2 + ROT + (i * TAU) / 3;
    vx[i] = R * cos(a);
    vy[i] = R * sin(a);
    x0 = min(x0, vx[i]);
    x1 = max(x1, vx[i]);
    y0 = min(y0, vy[i]);
    y1 = max(y1, vy[i]);
  }
  const hh = y1 - y0, ox = W / 2 - (x0 + x1) / 2, top = (H - 2 * hh - GAP) / 2;
  for (let t = 0; t < 2; t++) {
    const oy = top + t * (hh + GAP) - y0;
    for (let i = 0; i < 3; i++) {
      st.V[t * 6 + i * 2] = vx[i] + ox;
      st.V[t * 6 + i * 2 + 1] = vy[i] + oy;
    }
  }
  // per LED: the barycentric coordinates in its triangle, the signed distance to the nearest edge (inside positive)
  const bx = (st.bx = new Float32Array(W * H * 3)), dist = (st.dist = new Float32Array(W * H)), list = [];
  for (let y = 0; y < H; y++) {
    const t = y + 0.5 < H / 2 ? 0 : 1, V = st.V, o = t * 6;
    const ax = V[o], ay = V[o + 1], bX = V[o + 2], bY = V[o + 3], cx = V[o + 4], cy = V[o + 5];
    const det = (bY - cy) * (ax - cx) + (cx - bX) * (ay - cy);
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5, p = y * W + x;
      const l1 = ((bY - cy) * (px - cx) + (cx - bX) * (py - cy)) / det, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
      bx[p * 3] = l1;
      bx[p * 3 + 1] = l2;
      bx[p * 3 + 2] = l3;
      dist[p] = min(l1, l2, l3) * ALT;
      if (dist[p] > -3.5) list.push(p);
    }
  }
  st.act = Int32Array.from(list);
}

function place(st, i) {
  const o = (i < NP ? 0 : 1) * 6, V = st.V, X = st.X;
  st.px[i] = X[i * 3] * V[o] + X[i * 3 + 1] * V[o + 2] + X[i * 3 + 2] * V[o + 4];
  st.py[i] = X[i * 3] * V[o + 1] + X[i * 3 + 1] * V[o + 3] + X[i * 3 + 2] * V[o + 5];
}

// a fresh comet at a random place well inside, its colour computed with the first frame
function seed(st, i, fresh) {
  const th = rnd() * TAU, rho = 0.22 + 0.25 * sqrt(rnd()), X = st.X;
  let x1 = 1 / 3 + (2 / 3) * rho * cos(th), x2 = 1 / 3 + (2 / 3) * rho * cos(th - TAU / 3), x3 = 1 / 3 + (2 / 3) * rho * cos(th + TAU / 3);
  x1 = max(x1, 0.02);
  x2 = max(x2, 0.02);
  x3 = max(x3, 0.02);
  const s = 1 / (x1 + x2 + x3);
  X[i * 3] = x1 * s;
  X[i * 3 + 1] = x2 * s;
  X[i * 3 + 2] = x3 * s;
  st.life[i] = 4 + 5.5 * rnd();
  st.age[i] = fresh ? 0 : rnd() * st.life[i] * 0.9;
  st.alpha[i] = fresh ? 0 : 1;
  st.dying[i] = 0;
  st.dwell[i] = 0;
  st.live[i] = 1;
  place(st, i);
  st.hn[i] = 0;
  st.hi[i] = 0;
  record(st, i, st.t);
}

// remember a point of the comet's path with its colour, when it has moved a third of an LED since the last one
function record(st, i, t) {
  const x = st.px[i], y = st.py[i];
  if (st.hn[i] > 0) {
    const dx = x - st.lx[i], dy = y - st.ly[i];
    if (dx * dx + dy * dy < 0.1225) return;
  }
  const k = i * HN + st.hi[i], X = st.X, o = i * 3;
  st.hx[k] = x;
  st.hy[k] = y;
  st.ht[k] = t;
  mixColour(st.pal, X[o], X[o + 1], X[o + 2], 1.5, 0.9, 1, 0, st.hc, k * 3);
  st.hi[i] = (st.hi[i] + 1) % HN;
  if (st.hn[i] < HN) st.hn[i]++;
  st.lx[i] = x;
  st.ly[i] = y;
}

// ---- the slow wander of the parameter ---------------------------------------
// eps = (b - a) / (a + b) for the payoffs a (lose) and b (win) of the game. Above zero the middle of the triangle is a stable spiral,
// below it an unstable one. Two cascaded low passes of noise (about one crossing a minute), three slow sines of incommensurate period.
const EMAX = 0.65;                  // eps never reaches past this
const WT = 19, WQ = (2 * 0.3) / sqrt(WT);
function wander(st, dt) {
  st.y1 += (-st.y1 / WT) * dt + WQ * sqrt(dt) * gauss();
  st.y2 += ((st.y1 - st.y2) / WT) * dt;
  const t = st.t, ph = st.ph;
  st.w = st.y2 + 0.09 * sin((TAU * t) / 103 + ph[0]) + 0.06 * sin((TAU * t) / 167 + ph[1]) + 0.04 * sin((TAU * t) / 71 + ph[2]);
}

// ---- the dynamics -----------------------------------------------------------
const D = new Float64Array(3);
function drift(x1, x2, x3, a, b) {
  const A1 = -a * x2 + b * x3, A2 = b * x1 - a * x3, A3 = -a * x1 + b * x2;
  const m = x1 * A1 + x2 * A2 + x3 * A3;
  D[0] = x1 * (A1 - m);
  D[1] = x2 * (A2 - m);
  D[2] = x3 * (A3 - m);
}

function stampG(buf, x, y, w, r, g, b, sg) {
  const inv = 1 / (2 * sg * sg), fx = x - 0.5, fy = y - 0.5, ix = floor(fx) - 1, iy = floor(fy) - 1;
  const wx0 = exp(-(ix - fx) * (ix - fx) * inv), wx1 = exp(-(ix + 1 - fx) * (ix + 1 - fx) * inv), wx2 = exp(-(ix + 2 - fx) * (ix + 2 - fx) * inv), wx3 = exp(-(ix + 3 - fx) * (ix + 3 - fx) * inv);
  for (let j = 0; j < 4; j++) {
    const yy = iy + j;
    if (yy < 0 || yy >= H) continue;
    const wy = w * exp(-(yy - fy) * (yy - fy) * inv);
    const o = yy * W;
    for (let i = 0; i < 4; i++) {
      const xx = ix + i;
      if (xx < 0 || xx >= W) continue;
      const q = wy * (i === 0 ? wx0 : i === 1 ? wx1 : i === 2 ? wx2 : wx3), p = (o + xx) * 3;
      buf[p] += q * r;
      buf[p + 1] += q * g;
      buf[p + 2] += q * b;
    }
  }
}

function knobs(st, kv) {
  st.k1 = cl(kv[0], 0, 1);
  st.k2 = cl(kv[1], 0.6, 4);
  st.k3 = cl(kv[2], -1, 1);
  st.k4 = cl(kv[3], -1, 1);
}

// one frame of the world
function step(st, dt) {
  const t0 = st.t, ph = st.ph;
  st.t += dt;
  wander(st, dt);
  const k3 = st.k3, gain = k3 < 0 ? 1 + k3 : 1, push = k3 > 0 ? 0.25 * k3 : 0;
  const base = 0.55 * tanh(st.w / 0.3) * gain + push, t = st.t, f = 1 - exp(-dt / 1.2);
  // each triangle also has a small wobble of its own on top of the shared parameter, so the two are never exact mirrors
  st.eT += (EMAX * tanh((base + 0.14 * gain * sin((TAU * t) / 61 + ph[1] * 2)) / EMAX) - st.eT) * f;
  st.eB += (-EMAX * tanh((base + 0.14 * gain * sin((TAU * t) / 87 + ph[2] * 3)) / EMAX) - st.eB) * f;
  const ts = st.k2 / 2, tdyn = dt * C0 * ts;
  const nsub = cl(ceil(tdyn / 0.012), 1, 24), h = tdyn / nsub, hr = dt / nsub;
  // the knob values glide in, so the population never jumps
  // the crowd also swells and thins a fifth either way by itself, as a real population does
  const Nt = 40 * pow(10, (st.k4 + 1) / 2 + 0.22 * sin((TAU * t0) / 97 + ph[0] * 3)), Pt = (64 + 18 * st.k4) * (1 + 0.2 * sin((TAU * t0) / 71 + ph[1] * 5));
  const g = 1 - exp(-dt / 0.8);
  st.Nv += (Nt - st.Nv) * g;
  st.Pv += (Pt - st.Pv) * g;
  const P = cl(Math.round(st.Pv), 20, NP), sig = sqrt((NOISE_K * h) / st.Nv);
  const X = st.X, eT = st.eT, eB = st.eB;
  // life: fade in, fade out, reseed
  for (let i = 0; i < 2 * NP; i++) {
    const j = i < NP ? i : i - NP;
    if (!st.live[i]) {
      if (j < P) seed(st, i, true);
      else continue;
    }
    if (st.dying[i]) {
      st.alpha[i] -= dt / 0.7;
      if (st.alpha[i] <= 0) {
        st.alpha[i] = 0;
        if (j < P) seed(st, i, true);
        else st.live[i] = 0;
      }
    } else {
      st.alpha[i] = min(1, st.alpha[i] + dt / 1.0);
      st.age[i] += dt;
      if (st.age[i] > st.life[i] || j >= P) st.dying[i] = 1;
    }
  }
  for (let s = 0; s < nsub; s++) {
    const ts2 = t0 + (s + 1) * hr;
    for (let i = 0; i < 2 * NP; i++) {
      if (!st.live[i]) continue;
      const e = i < NP ? eT : eB, a = 1 - e, b = 1 + e, o = i * 3;
      let x1 = X[o], x2 = X[o + 1], x3 = X[o + 2];
      drift(x1, x2, x3, a, b);
      const d1 = D[0], d2 = D[1], d3 = D[2];
      drift(x1 + h * d1, x2 + h * d2, x3 + h * d3, a, b);
      const q = h * 0.5;
      x1 += q * (d1 + D[0]);
      x2 += q * (d2 + D[1]);
      x3 += q * (d3 + D[2]);
      // Wright-Fisher diffusion: covariance x_i (delta_ij - x_j) / N, from independent noise on each coordinate
      const s1 = sqrt(x1 > 0 ? x1 : 0), s2 = sqrt(x2 > 0 ? x2 : 0), s3 = sqrt(x3 > 0 ? x3 : 0);
      const z1 = gauss(), z2 = gauss(), z3 = gauss(), S = s1 * z1 + s2 * z2 + s3 * z3;
      x1 += sig * (s1 * z1 - x1 * S);
      x2 += sig * (s2 * z2 - x2 * S);
      x3 += sig * (s3 * z3 - x3 * S);
      x1 = abs(x1);
      x2 = abs(x2);
      x3 = abs(x3);
      if (x1 < 1e-5) x1 = 1e-5;
      if (x2 < 1e-5) x2 = 1e-5;
      if (x3 < 1e-5) x3 = 1e-5;
      const n = 1 / (x1 + x2 + x3);
      X[o] = x1 * n;
      X[o + 1] = x2 * n;
      X[o + 2] = x3 * n;
      place(st, i);
      record(st, i, ts2);
    }
  }
  // stuck at a corner: retire
  for (let i = 0; i < 2 * NP; i++) {
    if (!st.live[i] || st.dying[i]) continue;
    const o = i * 3, mx = max(X[o], X[o + 1], X[o + 2]);
    if (mx > 0.97) st.dwell[i] += dt;
    else st.dwell[i] = max(0, st.dwell[i] - 2 * dt);
    if (st.dwell[i] > 0.8) st.dying[i] = 1;
  }
}

// every comet: a bright head and a tail drawn back along its remembered path, 2 LED wide, fading with the time it was left
// and with the length of the path, whichever is the sooner
function render(st) {
  const fx = st.fx, now = st.t;
  fx.fill(0);
  const TW = 0.15, HW = 0.55;
  for (let i = 0; i < 2 * NP; i++) {
    if (!st.live[i] || st.alpha[i] <= 0) continue;
    const al = st.alpha[i], base = i * HN, n = st.hn[i];
    let cx = st.px[i], cy = st.py[i], ct = now, arc = 0;
    // the head takes the colour of the newest remembered point
    const kn = base + ((st.hi[i] - 1 + HN) % HN);
    let cr = st.hc[kn * 3], cg = st.hc[kn * 3 + 1], cb = st.hc[kn * 3 + 2];
    stampG(fx, cx, cy, HW * al, cr, cg, cb, 0.95);
    for (let m = 0; m < n; m++) {
      const k = base + ((st.hi[i] - 1 - m + HN * 2) % HN);
      const qx = st.hx[k], qy = st.hy[k], qt = st.ht[k], qr = st.hc[k * 3], qg = st.hc[k * 3 + 1], qb = st.hc[k * 3 + 2];
      const dx = qx - cx, dy = qy - cy, len = sqrt(dx * dx + dy * dy);
      if (len > 0.02) {
        const ns = max(1, ceil(len / 0.5)), wl = len / ns / 0.5;
        let done = false;
        for (let u = 1; u <= ns; u++) {
          const f = u / ns, uu = max((arc + len * f) / L_MAX, (now - (ct + (qt - ct) * f)) / T_MAX);
          if (uu >= 1) {
            done = true;
            break;
          }
          const wt = TW * wl * al * pow(1 - uu, 1.3);
          stampG(fx, cx + dx * f, cy + dy * f, wt, cr + (qr - cr) * f, cg + (qg - cg) * f, cb + (qb - cb) * f, 0.8);
        }
        if (done) break;
      }
      arc += len;
      cx = qx;
      cy = qy;
      ct = qt;
      cr = qr;
      cg = qg;
      cb = qb;
    }
  }
}

// The corner colours drift on their own a few tens of degrees either way, slowly, on top of Hue, so the picture does not come back
// to the same colours; the wash and the outline are rebuilt when the shift has moved by half a degree.
function sync(st) {
  const t = st.t, ph = st.ph, shift = st.k1 * 360 + 19 * sin((TAU * t) / 131 + ph[0]) + 11 * sin((TAU * t) / 59 + ph[1]) - 3;
  if (abs(shift - st.shiftB) > 0.5) {
    st.shiftB = shift;
    buildPalette(st, shift);
    buildBase(st);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  knobs(st, kv);
  sync(st);
  if (!st.init) {
    st.init = true;
    // the first frame is a picture that has been running a while: the wander, the spirals and the trails already formed
    st.Nv = 40 * pow(10, (st.k4 + 1) / 2);
    st.Pv = 64 + 18 * st.k4;
    st.eT = EMAX * tanh((0.55 * tanh(st.w / 0.3)) / EMAX);
    st.eB = -st.eT;
    for (let i = 0; i < 2 * NP; i++) seed(st, i, false);
    for (let n = 0; n < 540; n++) step(st, 1 / 30);
    sync(st);
    render(st);
  }
  const h = cl(dt || 0, 0, 0.1);
  if (h > 0) {
    step(st, h);
    sync(st);
    render(st);
  }
}

// ---- the panel ---------------------------------------------------------------
export function draw(display, params) {
  if (!params.st) {
    setup(params);
    update(0, { knobValues: [0, 2, 0, 0.06] }, params);
  }
  const st = params.st, base = st.base, fx = st.fx, t = st.t, ph = st.ph;
  // the wash of each triangle breathes by itself, a quarter either way, the two on periods that do not meet
  const gT = 1 + 0.2 * sin((TAU * t) / 83 + ph[2]) + 0.1 * sin((TAU * t) / 41 + ph[0]), gB = 1 + 0.2 * sin((TAU * t) / 109 + ph[1]) + 0.1 * sin((TAU * t) / 47 + ph[2]);
  for (let y = 0, p = 0; y < H; y++) {
    const bg = y < H / 2 ? gT : gB;
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3;
      let r = base[o] * bg + fx[o], g = base[o + 1] * bg + fx[o + 1], b = base[o + 2] * bg + fx[o + 2];
      const m = max(r, g, b);
      if (m > 1e-5) {
        // a soft shoulder above 0.55, and the brightest cores go pale as light does
        let mm = m;
        if (m > 0.55) mm = 0.55 + 0.45 * (1 - exp(-(m - 0.55) / 0.45));
        const s = mm / m;
        r *= s;
        g *= s;
        b *= s;
        if (mm > 0.85) {
          const wh = (mm - 0.85) * 1.6;
          r += (mm - r) * wh;
          g += (mm - g) * wh;
          b += (mm - b) * wh;
        }
      }
      display.setPixel(x, y, gam(r), gam(g), gam(b));
    }
  }
}
