// ===== Patternflow pattern =====
// Title:   Stealth Hole
// Family:  hyperuniform
// Idea:    The diffraction pattern of a hundred points on a torus that are driven to scatter no light inside a disc around the centre, so the panel is a black round hole in glowing speckle that grows a bright ring at its edge as the disc widens and then freezes into sharp Bragg spots on black once the disc asks for more than the points can give.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: stealthy hyperuniform point patterns, whose structure factor S(k) = |sum exp(-i k.x)|^2 / N is zero for 0 < |k| < K (Torquato and Stillinger 2003; Uche, Stillinger and Torquato 2004; Batten, Stillinger and Torquato 2008, collective-coordinate optimisation, all from memory); freezing into a crystal once the constraints outnumber the freedom, chi = M / (d (N - 1)) above about 0.5 (from memory); chicken cone photoreceptors as a natural hyperuniform pattern (Jiao et al. 2014, from memory); overdamped Langevin dynamics on U = the sum of S over the constrained half plane, pattern round 240
// Round:   240
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stealth=0..4, Heat=-1..1, Points=-1..1
//
// Knob 1: Hue. Turns the fire ramp round the wheel. At 0 the speckle runs from black through deep violet and magenta to orange, and the strongest peaks reach pale yellow and white.
// Knob 2: Stealth. 0 to 4, opening at 2. The radius K of the dark disc in wave-vector cells (2 LED a cell): 3.6 at 0, 7 at 2 and 10.4 at 4, wandering about one cell either side of the knob on its own, and never wider than the points can keep dark. Low, the hole is a small black dot and speckle fills the rest. In the middle the hole is wide and a bright ring of grains stands just outside it. Past K of about 8 for 100 points the constraints outnumber the freedom, and the speckle collapses into separate white Bragg spots on black, which every quarter of a minute or less glide into another lattice, turned and sheared, and fall apart into speckle again when the disc shrinks.
// Knob 3: Heat. -1 to 1, opening at 0. The thermal noise on the points, 0.0024 at -1, 0.03 at 0 and 0.38 at 1, which is about the mean brightness left inside the hole. At the bottom the hole is black, the speckle drifts slowly and a crystal stands almost still. At the top the hole fills with noise and a crystal is a hot haze with a few spots left in it.
// Knob 4: Points. -1 to 1, opening near 0. The number of points, 70 at -1, 100 at 0 and 130 at 1, added or taken away one every tenth of a second while the pattern runs (each crystal also takes up to 3 more or fewer, because a lattice of a different count is a different crystal). Fewer points freeze to a crystal at a smaller disc, so at the opening disc 70 points are already a lattice of spots; more points keep the same disc a disordered speckle with a strong ring.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- the wave-vector plane --------------------------------------------------
// A cell is one integer wave vector n = (n1, n2), k = 2 pi n, drawn 2 x 2 LED: 32 columns of n1 = -16..15, 64 rows of n2 = -32..31,
// n = (0, 0) between four LEDs at the middle. S is computed on a wider grid (the spline needs neighbours): n1 = -19..19, n2 = -35..35;
// S(-n) = S(n), so only n2 >= 0 is summed.
const N1 = 19, N2 = 35, GW = 2 * N1 + 1, GH = 2 * N2 + 1, HW = N2 + 1;
const NMAX = 140;
const KMAX = 12;                     // the constrained wave vectors never reach past this
const TW = 2 * N1 + 1;               // table rows for n1, then n2 = 0..N2
// The fire ramp: u 0..1 against hue, saturation and value. The dim end stays on violet and magenta, which the panel keeps,
// and the orange is already bright where it arrives so nothing goes brown.
const KEYS = [
  [0.0, 0.74, 0.95, 0.0],
  [0.1, 0.745, 0.95, 0.22],
  [0.26, 0.77, 0.92, 0.5],
  [0.42, 0.865, 0.88, 0.78],
  [0.58, 0.975, 0.84, 0.96],
  [0.72, 1.045, 0.78, 1.0],
  [0.85, 1.115, 0.5, 1.0],
  [0.94, 1.14, 0.22, 1.0],
  [1.0, 1.14, 0.06, 1.0],
];
const LUTN = 512;
const BLOOM = 0.6, BLOOM_K = [1, 0.607, 0.135];
const RD = 0.2;                     // steps a second are RD / T^0.65, so the speckle boils at a speed that rises more slowly than the heat does
const SPEAK = 5;                     // the S that reaches white
const RENV = 26;                     // the form factor of a point of finite size takes the glow down to a half at this many cells

function hsv(h, s, v, out, o) {
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
    let k = 0;
    while (k < KEYS.length - 2 && u > KEYS[k + 1][0]) k++;
    const a = KEYS[k], b = KEYS[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    const h = a[1] + (b[1] - a[1]) * f, s = a[2] + (b[2] - a[2]) * f, v = a[3] + (b[3] - a[3]) * f;
    // A dim colour on the red-orange-yellow-olive stretch of the wheel reads brown on the panel, so there it is paled and lifted,
    // all but the black end of the ramp, which is the hole.
    const hh = h + hue, cc = hh - floor(hh);
    const br = (cc > 0.5 ? sstep(0.8, 0.95, cc) : 1 - sstep(0.22, 0.36, cc)) * sstep(0.1, 0.35, s) * sstep(0.04, 0.3, v), dv = 1 - v;
    hsv(hh, s * (1 - 0.5 * br * dv), min(1, v * (1 + 0.9 * br * dv)), c, 0);
    lut[i * 3] = c[0] * 255;
    lut[i * 3 + 1] = c[1] * 255;
    lut[i * 3 + 2] = c[2] * 255;
  }
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, hue: -9,
    n: 100, x: new Float64Array(NMAX), y: new Float64Array(NMAX),
    gx: new Float64Array(NMAX), gy: new Float64Array(NMAX),
    // tables of cos and sin of 2 pi n1 x_j (rows n1 = -N1..N1) and of 2 pi n2 y_j (rows n2 = 0..N2), one row of NMAX numbers each
    cx: new Float64Array(TW * NMAX), sx: new Float64Array(TW * NMAX),
    cy: new Float64Array((N2 + 1) * NMAX), sy: new Float64Array((N2 + 1) * NMAX),
    // the constrained wave vectors of the half plane
    mq1: new Int16Array(400), mq2: new Int16Array(400), mw: new Float64Array(400), mm: 0, mkey: -9,
    rc: new Float64Array(400), rs: new Float64Array(400),
    S: new Float64Array(GW * HW), U: new Float32Array(GW * GH), C: new Float32Array(GW * GH), tmp: new Float32Array(GW * GH),
    lut: new Float32Array(LUTN * 3), env: new Float32Array(GW * GH),
    acc: 0, nacc: 0, bad: 0, hole: 0, Keff: 6, T: 0.03, Kk: 6.5, Nt: 100, msum: 0,
    frozen: false, pull: false, glide: false, nseed: 0, dn: 0, hist: [], lnmin: 99, life: 0, melt: -1, pt: 0, hot: 1, tx: new Float64Array(NMAX), ty: new Float64Array(NMAX),
    ph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU],
  });
  for (let j = 0; j < NMAX; j++) {
    st.x[j] = rnd();
    st.y[j] = rnd();
  }
  for (let b = 0; b < GH; b++) for (let a = 0; a < GW; a++) st.env[b * GW + a] = exp(-0.693 * (((a - N1) * (a - N1) + (b - N2) * (b - N2)) / (RENV * RENV)));
  // the weights of the four spline taps for each LED column and row, and the cell they start from
  st.ix = new Int32Array(W); st.wxs = new Float32Array(W * 4);
  st.iy = new Int32Array(H); st.wys = new Float32Array(H * 4);
  for (let x = 0; x < W; x++) tapw(((x + 0.5 - 32) / 2) + N1, st.ix, st.wxs, x);
  for (let y = 0; y < H; y++) tapw(((y + 0.5 - 64) / 2) + N2, st.iy, st.wys, y);
  return st;
}
// cubic B-spline weights for a sample at p (in cells from the grid's first cell)
function tapw(p, idx, w, o) {
  const i = floor(p), f = p - i;
  idx[o] = i - 1;
  w[o * 4] = ((1 - f) * (1 - f) * (1 - f)) / 6;
  w[o * 4 + 1] = (3 * f * f * f - 6 * f * f + 4) / 6;
  w[o * 4 + 2] = (-3 * f * f * f + 3 * f * f + 3 * f + 1) / 6;
  w[o * 4 + 3] = (f * f * f) / 6;
}

// ---- the physics ------------------------------------------------------------
// cos and sin of 2 pi n x for every point, by the angle-addition recurrence.
function tables(st) {
  const n = st.n, cx = st.cx, sx = st.sx, cy = st.cy, sy = st.sy;
  for (let j = 0; j < n; j++) {
    const a = TAU * st.x[j], b = TAU * st.y[j];
    const c1 = cos(a), s1 = sin(a), d1 = cos(b), t1 = sin(b);
    let c = 1, s = 0;
    cx[N1 * NMAX + j] = 1;
    sx[N1 * NMAX + j] = 0;
    for (let m = 1; m <= N1; m++) {
      const cn = c * c1 - s * s1;
      s = s * c1 + c * s1;
      c = cn;
      cx[(N1 + m) * NMAX + j] = c;
      sx[(N1 + m) * NMAX + j] = s;
      cx[(N1 - m) * NMAX + j] = c;
      sx[(N1 - m) * NMAX + j] = -s;
    }
    c = 1;
    s = 0;
    cy[j] = 1;
    sy[j] = 0;
    for (let m = 1; m <= N2; m++) {
      const cn = c * d1 - s * t1;
      s = s * d1 + c * t1;
      c = cn;
      cy[m * NMAX + j] = c;
      sy[m * NMAX + j] = s;
    }
  }
}

// The wave vectors held at zero: the half plane with 0 < |n| < K, the last half cell fading in.
function modes(st, K) {
  const key = round(K * 50);
  if (key === st.mkey) return;
  st.mkey = key;
  let m = 0, ws = 0;
  const lim = min(KMAX, floor(K + 1));
  for (let n2 = 0; n2 <= lim; n2++) {
    for (let n1 = -lim; n1 <= lim; n1++) {
      if (n2 === 0 && n1 <= 0) continue;
      const r = sqrt(n1 * n1 + n2 * n2), w = sstep(K + 0.5, K - 0.5, r);
      if (w <= 0) continue;
      st.mq1[m] = n1;
      st.mq2[m] = n2;
      st.mw[m] = w;
      ws += w;
      m++;
    }
  }
  st.mm = m;
  st.msum = ws;
}

// One step of overdamped Langevin dynamics: down the gradient of U = sum of w S(n) over the held wave vectors, plus noise.
// d|rho|^2 / dx_j = 4 pi n1 (Rs cos th_j - Rc sin th_j), th_j = 2 pi n . x_j, Rc and Rs the sums of cos and sin over the points.
function step(st, eta, T) {
  const n = st.n, M = st.mm, gx = st.gx, gy = st.gy;
  tables(st);
  gx.fill(0);
  gy.fill(0);
  const cx = st.cx, sx = st.sx, cy = st.cy, sy = st.sy, rc = st.rc, rs = st.rs;
  let hole = 0, wsum = 0;
  for (let q = 0; q < M; q++) {
    const oa = (st.mq1[q] + N1) * NMAX, ob = st.mq2[q] * NMAX;
    let Rc = 0, Rs = 0;
    for (let j = 0; j < n; j++) {
      const a = cx[oa + j], b = sx[oa + j], c = cy[ob + j], d = sy[ob + j];
      Rc += a * c - b * d;
      Rs += b * c + a * d;
    }
    rc[q] = Rc;
    rs[q] = Rs;
    hole += st.mw[q] * (Rc * Rc + Rs * Rs);
    wsum += st.mw[q];
  }
  st.hole = hole / (n * max(wsum, 1e-9));
  const k4 = (4 * PI) / n;
  for (let q = 0; q < M; q++) {
    const oa = (st.mq1[q] + N1) * NMAX, ob = st.mq2[q] * NMAX, Rc = rc[q], Rs = rs[q];
    const ax = k4 * st.mq1[q] * st.mw[q], ay = k4 * st.mq2[q] * st.mw[q];
    for (let j = 0; j < n; j++) {
      const a = cx[oa + j], b = sx[oa + j], c = cy[ob + j], d = sy[ob + j];
      const t = Rs * (a * c - b * d) - Rc * (b * c + a * d);
      gx[j] += ax * t;
      gy[j] += ay * t;
    }
  }
  const noise = sqrt(2 * eta * T);
  for (let j = 0; j < n; j++) {
    let px = st.x[j] - eta * gx[j] + noise * gauss(), py = st.y[j] - eta * gy[j] + noise * gauss();
    px -= floor(px);
    py -= floor(py);
    st.x[j] = px;
    st.y[j] = py;
  }
}

// A stable step size: the stiffest curvature of U grows as the sum of w n^2 and as 1 + |rho|, so the step shrinks while the hole
// is still full of light.
function stepSize(st) {
  let s = 0;
  for (let q = 0; q < st.mm; q++) s += st.mw[q] * (st.mq1[q] * st.mq1[q] + st.mq2[q] * st.mq2[q]);
  return (0.4 * st.n) / (4 * PI * PI * max(s, 20) * (0.5 + 0.5 * sqrt(1 + st.n * st.hole)));
}

// ---- the crystal ------------------------------------------------------------
// A lattice of N points on the torus is the points j (p, q) / N mod 1. Its diffraction is zero except at the wave vectors n with
// n1 p + n2 q = 0 mod N, so the shortest of those, as long as possible, is a lattice as near hexagonal as the square torus allows.
// It is a ground state of every stealthy disc smaller than that, which is why the points freeze into it once the disc is large.
const lats = {};
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// Every lattice of N points that differs in shape (the two shortest Bragg vectors and the angle between them, not its turn or
// mirror image), the best first, as [p, q, shortest, second]. The best is near hexagonal.
function lattices(N) {
  if (lats[N]) return lats[N];
  const seen = {}, all = [];
  for (let p = 1; p <= N / 2 + 1; p++) {
    for (let q = 1; q <= p; q++) {
      if (gcd(gcd(N, p), q) !== 1) continue;
      const vs = [];
      for (let n2 = 0; n2 <= 14; n2++) {
        for (let n1 = -14; n1 <= 14; n1++) {
          if (n2 === 0 && n1 <= 0) continue;
          if ((((n1 * p + n2 * q) % N) + N) % N === 0) vs.push([n1, n2, sqrt(n1 * n1 + n2 * n2)]);
        }
      }
      vs.sort((u, v) => u[2] - v[2]);
      const a = vs[0], b = a && vs.find((v) => a[0] * v[1] - a[1] * v[0] !== 0);
      if (!b) continue;
      const key = a[2].toFixed(1) + "|" + b[2].toFixed(1) + "|" + round(Math.acos(abs(a[0] * b[0] + a[1] * b[1]) / (a[2] * b[2])) * 57.3);
      if (seen[key]) continue;
      seen[key] = 1;
      all.push([p, q, a[2], b[2]]);
    }
  }
  all.sort((u, v) => v[2] - u[2]);
  return (lats[N] = all);
}
// Send every point to a site of a lattice with its own orientation and shift: at once, or by a pull that takes a few seconds.
// Each crystal has a point count of its own, up to 3 more or fewer than the knob says: a lattice of a different N is a different
// crystal, and that keeps one freeze from looking like the last.
function freeze(st, at) {
  st.dn = floor(rnd() * 7) - 3;
  const Nf = cl(st.Nt + st.dn, 60, NMAX - 2);
  while (st.n < Nf) {
    st.x[st.n] = rnd();
    st.y[st.n] = rnd();
    st.n++;
  }
  while (st.n > Nf) {
    const j = floor(rnd() * st.n);
    st.n--;
    st.x[j] = st.x[st.n];
    st.y[j] = st.y[st.n];
  }
  // Any lattice whose first spot lets the disc be wide enough to hold the freeze (chi 0.42), and not one of the last three.
  const N = st.n, all = lattices(N), lo = max(0.8 * all[0][2], 0.6 + sqrt(0.53 * (N - 1)));
  let cand = all.filter((c) => c[2] >= lo);
  if (!cand.length) cand = [all[0]];
  let l, id;
  for (let tries = 0; tries < 10; tries++) {
    l = cand[floor(rnd() * cand.length)];
    id = N * 10000 + l[0] * 100 + l[1];
    if (!st.hist.includes(id)) break;
  }
  st.hist.push(id);
  if (st.hist.length > 3) st.hist.shift();
  const fx = rnd() < 0.5, fy = rnd() < 0.5, sw = rnd() < 0.5;
  st.lnmin = l[2];
  const ox = rnd(), oy = rnd();
  const sx = new Float64Array(N), sy = new Float64Array(N), used = new Uint8Array(N);
  for (let j = 0; j < N; j++) {
    let a = ((j * l[0]) % N) / N, b = ((j * l[1]) % N) / N;
    if (sw) [a, b] = [b, a];
    if (fx) a = 1 - a;
    if (fy) b = 1 - b;
    sx[j] = (a + ox) % 1;
    sy[j] = (b + oy) % 1;
  }
  for (let j = 0; j < N; j++) {
    let best = 0, bd = 9;
    for (let m = 0; m < N; m++) {
      if (used[m]) continue;
      let dx = sx[m] - st.x[j], dy = sy[m] - st.y[j];
      dx -= round(dx);
      dy -= round(dy);
      const d = dx * dx + dy * dy;
      if (d < bd) (bd = d), (best = m);
    }
    used[best] = 1;
    st.tx[j] = sx[best];
    st.ty[j] = sy[best];
    if (at) {
      st.x[j] = sx[best];
      st.y[j] = sy[best];
    }
  }
  st.frozen = true;
  st.pull = true;
  st.glide = !at;
  st.pt = 0;
  st.melt = -1;
  st.life = 11 + 9 * rnd();
  st.nseed = st.Nt;
}

const chiOf = (st) => st.msum / (2 * (st.n - 1));
const MELT = 3.5;                    // seconds a crystal is heated before it freezes again
const FREEZE = 0.5;                  // chi = M / (d (N - 1)) above which the points freeze

function knobsToState(st) {
  const k = st.k;
  st.Kk = 3.6 + 1.7 * cl(k[1], 0, 4);
  st.T = 0.03 * Math.pow(10, 1.1 * cl(k[2], -1, 1));
  st.Nt = round(100 + 30 * cl(k[3], -1, 1));
}

// No lattice of N points has a Bragg spot nearer the centre than the best one the torus allows (about sqrt(2 N / sqrt 3), a bit
// less), so a disc wider than that cannot be dark: it stops opening a little short of the first spot.
function capK(st, K) {
  return min(K, (st.frozen ? st.lnmin : lattices(st.n)[0][2]) - 0.6);
}

// Steps a second, slower as the heat rises.
const clampR = (T) => cl(RD / Math.pow(T, 0.65), 1.2, 14);

function wander(t, st) {
  return 0.62 * sin((TAU * t) / 61 + st.ph[0]) + 0.38 * sin((TAU * t) / 37 + st.ph[1]);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  knobsToState(st);
  if (!st.init) {
    st.init = true;
    st.n = st.Nt;
    st.Keff = capK(st, st.Kk + wander(0, st));
    modes(st, st.Keff);
    const eta = stepSize(st);
    if (chiOf(st) > FREEZE) {
      freeze(st, true);
      // a crystal at the heat the knobs ask for, on the same loose rein the running pattern keeps
      const b = 1 - exp(-1 / (clampR(st.T) * 14));
      for (let i = 0; i < 300; i++) {
        step(st, eta, st.T);
        for (let j = 0; j < st.n; j++) {
          let dx = st.tx[j] - st.x[j], dy = st.ty[j] - st.y[j];
          dx -= round(dx);
          dy -= round(dy);
          st.x[j] += b * dx;
          st.y[j] += b * dy;
        }
      }
    } else {
      for (let i = 0; i < 700; i++) step(st, eta, i < 500 ? 0 : st.T);
    }
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  const Kt = capK(st, st.Kk + wander(st.t, st));
  st.Keff += (Kt - st.Keff) * (1 - exp(-dt / 0.4));
  modes(st, st.Keff);
  // points come and go one at a time, about every 0.1 s
  st.nacc += dt;
  while (st.nacc > 0.1) {
    st.nacc -= 0.1;
    const goal = st.Nt + (st.frozen ? st.dn : 0);
    if (st.n < goal) {
      st.x[st.n] = rnd();
      st.y[st.n] = rnd();
      st.tx[st.n] = st.x[st.n];
      st.ty[st.n] = st.y[st.n];
      st.n++;
    } else if (st.n > goal) {
      const j = floor(rnd() * st.n);
      st.n--;
      st.x[j] = st.x[st.n];
      st.y[j] = st.y[st.n];
      st.tx[j] = st.tx[st.n];
      st.ty[j] = st.ty[st.n];
    }
  }
  // Past chi = 0.5 the ground state is a crystal, and gradient steps alone stick in a jumble of rings and rows on the way to it,
  // so the points are drawn onto a lattice and the speckle collapses into spots. Below 0.38 the lattice is let go.
  const chi = chiOf(st);
  if (st.frozen && st.melt < 0) {
    // a crystal holds for a quarter of a minute or less, then the points glide into another lattice, turned and sheared
    st.life -= dt;
    if (st.life < 0) freeze(st, false);
  }
  if (st.melt >= 0) {
    // when the disc shrinks below the freezing point the crystal is heated for a few seconds until it is haze
    st.melt += dt;
    const g = sin((PI * st.melt) / MELT);
    st.hot = 1 + 15 * g * g;
    if (st.melt > MELT) {
      st.melt = -1;
      st.hot = 1;
      st.frozen = false;
      st.pull = false;
    }
  }
  if (!st.frozen && chi > FREEZE) freeze(st, false);
  else if (st.frozen && st.melt < 0 && chi < FREEZE - 0.12) (st.melt = 0), (st.pull = false);
  else if (st.frozen && abs(st.Nt - st.nseed) > 2) freeze(st, false);
  const eta = stepSize(st), Teff = st.T * st.hot * exp(0.5 * (0.6 * sin((TAU * st.t) / 43 + st.ph[2]) + 0.4 * sin((TAU * st.t) / 27 + st.ph[3])));
  st.acc += dt * clampR(st.T);
  let guard = 0;
  while (st.acc >= 1 && guard++ < 12) {
    st.acc -= 1;
    step(st, eta, Teff);
  }
  if (st.acc > 1) st.acc = 1;
  // When the hole is far from as dark as the heat allows (the disc just widened, points just came in) the points slide downhill
  // for a few extra steps a frame without noise, so the hole closes in a second or two.
  for (let i = 0; i < 4 && st.hole > 1.6 * Teff + 0.03; i++) step(st, eta, 0);
  // The lattice holds the points on a loose rein, so the Bragg spots shimmer with the heat and do not blur away; on the way
  // there the rein is short, and it loosens once the points have arrived.
  if (st.pull) {
    const b = 1 - exp(-dt / (st.glide ? 1.1 : 14));
    let r2 = 0;
    for (let j = 0; j < st.n; j++) {
      let dx = st.tx[j] - st.x[j], dy = st.ty[j] - st.y[j];
      dx -= round(dx);
      dy -= round(dy);
      st.x[j] += b * dx;
      st.y[j] += b * dy;
      r2 += dx * dx + dy * dy;
    }
    if (st.glide && (r2 / st.n < 4e-5 || (st.pt += dt) > 4)) st.glide = false;
  }
  // A hole that stays far from dark for a long time is a poor minimum: a tenth of the points start over.
  if (!st.frozen && st.hole > 5 * st.T + 0.15) st.bad += dt;
  else st.bad = max(0, st.bad - dt);
  if (st.bad > 12) {
    st.bad = 0;
    for (let j = 0; j < st.n; j++) {
      if (rnd() < 0.12) {
        st.x[j] = rnd();
        st.y[j] = rnd();
      }
    }
  }
}

// ---- drawing ----------------------------------------------------------------
// S on the wider grid, from the tables left by the last step.
function structure(st) {
  tables(st);
  const n = st.n, cx = st.cx, sx = st.sx, cy = st.cy, sy = st.sy, S = st.S, U = st.U;
  const inv = 1 / n;
  for (let b = 0; b <= N2; b++) {
    const ob = b * NMAX;
    for (let a = 0; a < GW; a++) {
      const oa = a * NMAX;
      let Rc = 0, Rs = 0;
      for (let j = 0; j < n; j++) {
        const p = cx[oa + j], q = sx[oa + j], c = cy[ob + j], d = sy[ob + j];
        Rc += p * c - q * d;
        Rs += q * c + p * d;
      }
      S[b * GW + a] = (Rc * Rc + Rs * Rs) * inv;
    }
  }
  // fill the full plane: row n2 < 0 is row -n2 turned about the centre
  for (let b = -N2; b <= N2; b++) {
    for (let a = 0; a < GW; a++) {
      const s = b >= 0 ? S[b * GW + a] : S[-b * GW + (GW - 1 - a)];
      U[(b + N2) * GW + a] = s;
    }
  }
}

function toLevel(st) {
  const U = st.U, env = st.env;
  for (let i = 0; i < U.length; i++) U[i] = cl((sqrt((U[i] * env[i]) / SPEAK) - 0.09) / 0.91, 0, 1.8);
  // the n = 0 spike is as big as N: drawn as a small calm glow instead
  const c = N2 * GW + N1;
  U[c] = 0.5;
  // a soft bloom round the brightest spots
  const B = st.tmp, K = BLOOM_K;
  for (let i = 0; i < U.length; i++) B[i] = cl((U[i] - 1) / 0.6, 0, 1);
  const C = st.C;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      let v = B[y * GW + x];
      for (let d = 1; d <= 2; d++) v += K[d] * ((x >= d ? B[y * GW + x - d] : 0) + (x + d < GW ? B[y * GW + x + d] : 0));
      C[y * GW + x] = v;
    }
  }
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      let v = C[y * GW + x];
      for (let d = 1; d <= 2; d++) v += K[d] * ((y >= d ? C[(y - d) * GW + x] : 0) + (y + d < GH ? C[(y + d) * GW + x] : 0));
      U[y * GW + x] = max(U[y * GW + x], BLOOM * v);
    }
  }
}

// cubic B-spline prefilter along rows and columns so the spline passes through the cell values
function prefilter(st) {
  const A = st.C, z = -0.2679491924;
  A.set(st.U);
  for (let y = 0; y < GH; y++) {
    const o = y * GW;
    for (let x = 1; x < GW; x++) A[o + x] += z * A[o + x - 1];
    A[o + GW - 1] = (z / (z * z - 1)) * (z * A[o + GW - 2] + A[o + GW - 1]);
    for (let x = GW - 2; x >= 0; x--) A[o + x] = z * (A[o + x + 1] - A[o + x]);
  }
  for (let x = 0; x < GW; x++) {
    for (let y = 1; y < GH; y++) A[y * GW + x] += z * A[(y - 1) * GW + x];
    A[(GH - 1) * GW + x] = (z / (z * z - 1)) * (z * A[(GH - 2) * GW + x] + A[(GH - 1) * GW + x]);
    for (let y = GH - 2; y >= 0; y--) A[y * GW + x] = z * (A[(y + 1) * GW + x] - A[y * GW + x]);
  }
  for (let i = 0; i < A.length; i++) A[i] *= 36;
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.hue) > 1e-4) {
    st.hue = st.k[0];
    buildLut(st.lut, st.hue);
  }
  structure(st);
  toLevel(st);
  prefilter(st);
  const A = st.C, lut = st.lut, ix = st.ix, iy = st.iy, wx = st.wxs, wy = st.wys;
  for (let y = 0; y < H; y++) {
    const y0 = iy[y], wy0 = wy[y * 4], wy1 = wy[y * 4 + 1], wy2 = wy[y * 4 + 2], wy3 = wy[y * 4 + 3];
    for (let x = 0; x < W; x++) {
      const x0 = ix[x], w0 = wx[x * 4], w1 = wx[x * 4 + 1], w2 = wx[x * 4 + 2], w3 = wx[x * 4 + 3];
      let v = 0;
      for (let r = 0; r < 4; r++) {
        const o = (y0 + r) * GW + x0, wr = r === 0 ? wy0 : r === 1 ? wy1 : r === 2 ? wy2 : wy3;
        v += wr * (w0 * A[o] + w1 * A[o + 1] + w2 * A[o + 2] + w3 * A[o + 3]);
      }
      const i = cl(round(v * (LUTN - 1)), 0, LUTN - 1) * 3;
      display.setPixel(x, y, lut[i] | 0, lut[i + 1] | 0, lut[i + 2] | 0);
    }
  }
}
