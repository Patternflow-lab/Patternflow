// ===== Patternflow pattern =====
// Title:   Stylolite
// Family:  stylolite
// Idea:    A polished slab of limestone slides down the panel in time-lapse under load, and the jagged black clay seams on it are seen at every age at once: a seam is born at the top as a faint straight line and, as pressure solution eats the rock along it and strong grains hold the interface back, it roughens into teeth, then into deep interlocking pillars with a thick charcoal cap and a rust-orange iron halo, with white calcite fibres across a few teeth, seams drifting together and merging, between soft mottled cream rock with shell flecks.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: pressure-solution seams of limestone and the name stylolite, from the Greek stylos, a pillar (Stockdale, 1922; Heald, 1955, from memory); roughness of the seam that is self-affine with a Hurst exponent near 1.1 at short lengths and near 0.5 at long ones (Schmittbuhl, Renard, Gratier and Toussaint, 2004, from memory); the growth model with elastic energy, surface energy and pinning by strong grains (Koehn, Renard, Toussaint and co-workers, 2007 to 2012, from memory). Original here: every seam carries its own interface that is advanced through one quenched strength field, the whole slab runs as a conveyor, and the tilt of the greatest stress swings seams and teeth together, pattern round 258
// Round:   258
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Load=0.5..4, Grit=-1..1, Tilt=-1..1
//
// Knob 1: Hue. Turns the rock tone round a loop of four stones: ochre and cream limestone at 0, slate blue-grey at 0.25, rose marble at 0.5, olive at 0.75, and back at 1. The rust halo and the clay change with the stone, from rust orange on ochre to a muted brown on slate, brick on rose and amber on olive.
// Knob 2: Load. 0.5 to 4, opening at 2. How hard the slab is squeezed. It sets the speed of the conveyor, 1.5 LED a second for each unit, 3 at the opening and 0.75 at 0.5, and how fast teeth grow, as the load to the power 1.7. At 0.5 the seams cross the panel as nearly straight lines with low teeth; at 4 a seam grows deep pillars and a heavy cap before it is a third of the way down.
// Knob 3: Grit. -1 to 1, opening at 0. The size of the grains in the rock, a factor of 2 to the power 1.1 times the knob: 0.47 at -1, where the teeth are 2 to 3 LED wide, many and thin with a light cap, and 2.1 at 1, where a few pillars 10 LED wide and 20 or more tall stand in a heavy clay seam. The mottle and the shell flecks coarsen with it.
// Knob 4: Tilt. -1 to 1, opening at 0.06. The direction of the greatest stress, 30 degrees for each unit either way. The seams lean and the teeth lean with them, since a stylolite's teeth run along the stress and its seam lies across it; each seam keeps a few degrees of its own, so neighbours close up on one side and part on the other.

// What the picture is. Every seam is a one-dimensional interface u(x) of 192 cells, one grain wide, closed into a ring, advanced by
//   du/dt = V f(x, u) + K u'' - E1 (u - mean over 17 cells) - E2 (u - mean over 65 cells)
// with f the strength field, a quenched random map of grains that is read at (x, u): a strong grain slows the interface to 5 percent of V,
// a weak one speeds it to 1.55 V, and the grains are long in u, three cells wide and five tall, so a held place stays held until the
// neighbours have run past it. That is the pillar. K is the surface energy that smooths short scales and E1, E2 stand for the elastic
// term that smooths long ones. The field is built once and each seam reads it at its own offset. All lengths are in grains, and Grit
// is the size of a grain in LED, so the same interface shows as fine teeth or as coarse pillars.
// The slab slides down at a speed of 1.5 Load. Seams are born above the top edge as straight lines at random gaps and each runs its own
// model at a rate of (Load/2)^1.7, so the panel shows all ages at once. The pre-run conveys the slab from empty to a full panel.
// Drawing. A seam is a chain of round soft stamps along the interface, so a steep flank stays one continuous line; the radius is 1 to 2
// LED, larger where the interface has dissolved more, and the stamps go into a clay layer. A second layer, the same stamps scaled by the
// age of the seam, is blurred three times to make the halo. The rock under them is value noise sampled in the rock's own frame, so it
// travels with the slab, with faint beds across and flecks that sit still in it. Light comes from the left, as a gentle ramp.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, abs, exp, sin, cos, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

// ---- the interface model
const N = 192, NU = 128;             // cells across a seam, rows of the strength field
const DTM = 0.05;                    // model step, in model seconds
const V0 = 0.34;                     // grains a model second that a medium grain lets the interface advance
const KAP = 0.012;                    // surface energy, grains^2 a model second
const E1 = 0.008, R1 = 8;             // short elastic term and the half width of its mean
const E2 = 0.006, R2 = 32;           // long elastic term
const RATE_P = 1.7;                  // the growth rate goes as (Load / 2) to this power
const SPEED = 1.5;                   // LED a second for each unit of Load
const YB = -38;                      // where a seam is born, the row of its anchor, clear of the top even when it leans
const G0 = 1.15, GRIT_OCT = 0.9;     // LED across one grain at the opening, and octaves of grain size for each unit of Grit

function hsh(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// A periodic value-noise field of nx by ny lattice points, sampled at (x, y) in lattice units.
function lattice(nx, ny) {
  const a = new Float32Array(nx * ny);
  for (let i = 0; i < a.length; i++) a[i] = rnd() * 2 - 1;
  return { a, nx, ny };
}
function latAt(L, x, y) {
  const x0 = floor(x), y0 = floor(y);
  let fx = x - x0, fy = y - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const i0 = ((x0 % L.nx) + L.nx) % L.nx, i1 = i0 + 1 === L.nx ? 0 : i0 + 1;
  const j0 = ((y0 % L.ny) + L.ny) % L.ny, j1 = j0 + 1 === L.ny ? 0 : j0 + 1;
  const a = L.a;
  const p = a[j0 * L.nx + i0] + (a[j0 * L.nx + i1] - a[j0 * L.nx + i0]) * fx;
  const q = a[j1 * L.nx + i0] + (a[j1 * L.nx + i1] - a[j1 * L.nx + i0]) * fx;
  return p + (q - p) * fy;
}

// The strength field as a speed factor f for each cell and row: grains are three cells wide and five tall.
function buildField() {
  const A = lattice(48, 14), B = lattice(128, 32);
  const raw = new Float32Array(N * NU);
  let sum = 0, sum2 = 0;
  for (let i = 0; i < N; i++)
    for (let r = 0; r < NU; r++) {
      const v = 0.62 * latAt(A, i / (N / 48), r / (NU / 14)) + 0.38 * latAt(B, i / (N / 128), r / (NU / 32));
      raw[i * NU + r] = v;
      sum += v;
      sum2 += v * v;
    }
  const mean = sum / raw.length, sd = sqrt(sum2 / raw.length - mean * mean);
  const f = new Float32Array(N * NU);
  for (let k = 0; k < f.length; k++) {
    const z = (raw[k] - mean) / sd;
    f[k] = 1 - 0.95 * sm(0.4, 1.15, z) + 0.55 * sm(0.4, 1.35, -z);
  }
  return f;
}

function newSeam(S, odo) {
  const u = new Float32Array(N);
  for (let i = 0; i < N; i++) u[i] = (rnd() - 0.5) * 0.1;
  const fib = [];
  for (let j = 0; j < N; j++) if (rnd() < 0.05) fib.push({ j, len: 3.2 + rnd() * 2.6, w: 0.55 + rnd() * 0.25 });
  return {
    u, ox: floor(rnd() * N), oy: floor(rnd() * NU),
    ax: 24 + 16 * rnd(), vr: 1 + 0.16 * (rnd() - 0.5), bias: (rnd() - 0.5) * 0.17,
    j0: floor(rnd() * N), born: odo, fib, top: YB, tau: 0, rms: 0,
  };
}

const M1 = new Float32Array(N), M2 = new Float32Array(N), DU = new Float32Array(N);
function boxMean(u, out, r) {
  const w = 2 * r + 1;
  let s = 0;
  for (let d = -r; d <= r; d++) s += u[(d + N) % N];
  for (let i = 0; i < N; i++) {
    out[i] = s / w;
    s += u[(i + r + 1) % N] - u[(i - r + N) % N];
  }
}

function stepSeam(S, s) {
  const u = s.u, FV = S.fv, ox = s.ox, oy = s.oy;
  boxMean(u, M1, R1);
  boxMean(u, M2, R2);
  s.tau += DTM;
  // a young seam is nearly uniform: the strength field bites harder as it ages
  const c = 0.12 + 0.88 * sm(3, 26, s.tau);
  for (let i = 0; i < N; i++) {
    const idx = (i + ox) % N * NU;
    const y = u[i] + oy, fl = floor(y), t = y - fl;
    const r0 = ((fl % NU) + NU) % NU, r1 = r0 + 1 === NU ? 0 : r0 + 1;
    const f = FV[idx + r0] * (1 - t) + FV[idx + r1] * t;
    const lap = u[i === 0 ? N - 1 : i - 1] - 2 * u[i] + u[i === N - 1 ? 0 : i + 1];
    DU[i] = V0 * (1 + c * (f - 1)) + KAP * lap - E1 * (u[i] - M1[i]) - E2 * (u[i] - M2[i]);
  }
  for (let i = 0; i < N; i++) u[i] += DTM * DU[i];
}

function makeState() {
  return {
    ready: false, fv: null, salt: floor(rnd() * 1e9),
    seams: [], odo: 0, nextBirth: 0, acc: 0, TA: 0,
    load: 2, gs: 1, G: G0, tilt: 0,
    kn: [0, 2, 0, 0.06],
    cov: new Float32Array(NPX), hs: new Float32Array(NPX), hal: new Float32Array(NPX), tmp: new Float32Array(NPX),
    fib: new Float32Array(NPX), fl: new Float32Array(NPX),
    sx: new Float32Array(N + 1), sy: new Float32Array(N + 1), sr: new Float32Array(N + 1),
    pal: new Float32Array(18), palAt: -1,
    lat1: new Float32Array(80 * 40), lat2: new Float32Array(160 * 80),
  };
}

export function setup(params) {
  const S = makeState();
  S.fv = buildField();
  params.s = S;
}

const knobsOf = (input) => {
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  return [cl(kn[0], 0, 1), cl(kn[1], 0.5, 4), cl(kn[2], -1, 1), cl(kn[3], -1, 1)];
};

function advance(S, dt, kn, snap) {
  const kf = snap ? 1 : 1 - exp(-dt / 0.3);
  S.load += (kn[1] - S.load) * kf;
  S.G += (G0 * Math.pow(2, GRIT_OCT * kn[2]) - S.G) * kf;
  S.tilt += (kn[3] * 0.5236 - S.tilt) * kf;
  S.gs = Math.pow(S.G / G0, 0.6);
  const v = SPEED * S.load, g = Math.pow(S.load / 2, RATE_P);
  S.odo += v * dt;
  S.TA -= (v * dt) / S.gs;
  S.acc += dt * g;
  let n = 0;
  while (S.acc >= DTM && n < 12) {
    for (const s of S.seams) stepSeam(S, s);
    S.acc -= DTM;
    n++;
  }
  if (S.acc > DTM) S.acc = 0;
  while (S.odo >= S.nextBirth) {
    S.seams.push(newSeam(S, S.nextBirth));
    // gaps between seams: 19 to 33 LED, wider in coarse rock, and now and then a close pair that will merge
    S.nextBirth += (rnd() < 0.14 ? 10 + 5 * rnd() : 19 + 14 * rnd()) * (0.8 + 0.2 * S.G / G0);
  }
  S.seams = S.seams.filter((s) => !(s.top > H + 3 && S.odo - s.born > 20));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = knobsOf(input), d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    S.load = kn[1];
    S.G = G0 * Math.pow(2, GRIT_OCT * kn[2]);
    S.tilt = kn[3] * 0.5236;
    S.gs = Math.pow(S.G / G0, 0.6);
    S.TA = rnd() * 50;
    // convey the slab from empty until the first seam has gone and a full panel of seams of every age is on it
    const reach = -YB + H + 60;
    while (S.odo < reach) advance(S, 0.1, kn, true);
  }
  advance(S, d, kn, false);
}

// ---- colour. Four stones: light tone, dark tone, halo, clay, fleck, calcite
const KEYS = [
  // ochre and cream limestone
  [[234, 222, 198], [178, 150, 112], [200, 92, 30], [26, 18, 14], [250, 244, 226], [255, 252, 244]],
  // slate blue-grey
  [[176, 188, 204], [112, 126, 148], [176, 104, 58], [14, 16, 24], [228, 234, 242], [246, 248, 252]],
  // rose marble
  [[236, 204, 198], [188, 138, 140], [172, 66, 48], [30, 16, 20], [252, 238, 234], [255, 250, 246]],
  // olive
  [[200, 200, 146], [128, 134, 82], [210, 120, 30], [20, 20, 12], [242, 242, 214], [252, 252, 238]],
];
function paletteAt(S, hue) {
  if (S.palAt === hue) return;
  const p = hue * 4, i = floor(p) % 4, u = sm(0, 1, p - floor(p)), a = KEYS[i], b = KEYS[(i + 1) % 4];
  for (let k = 0; k < 6; k++) for (let c = 0; c < 3; c++) S.pal[k * 3 + c] = a[k][c] + (b[k][c] - a[k][c]) * u;
  S.palAt = hue;
}

// ---- layers
function stamp(S, X, Y, rad, a, hw) {
  const ro = rad + 0.7, cov = S.cov, hs = S.hs;
  const x0 = max(0, floor(X - ro - 0.5)), x1 = min(W - 1, ceil(X + ro - 0.5));
  const y0 = max(0, floor(Y - ro - 0.5)), y1 = min(H - 1, ceil(Y + ro - 0.5));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - Y;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - X, d = sqrt(dx * dx + dy * dy);
      let c = (ro - d) / 1.2;
      if (c <= 0) continue;
      if (c > 1) c = 1;
      c = c * c * (3 - 2 * c);
      const p = y * W + x, v = a * c;
      if (v > cov[p]) cov[p] = v;
      const h = hw * c;
      if (h > hs[p]) hs[p] = h;
    }
  }
}

function stampFib(S, X, Y, rad, a) {
  const ro = rad + 0.6, fib = S.fib;
  const x0 = max(0, floor(X - ro - 0.5)), x1 = min(W - 1, ceil(X + ro - 0.5));
  const y0 = max(0, floor(Y - ro - 0.5)), y1 = min(H - 1, ceil(Y + ro - 0.5));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - Y;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - X, d = sqrt(dx * dx + dy * dy);
      let c = (ro - d) / 1.1;
      if (c <= 0) continue;
      if (c > 1) c = 1;
      const v = a * c * c * (3 - 2 * c), p = y * W + x;
      if (v > fib[p]) fib[p] = v;
    }
  }
}

// Three box blurs of half width 2 along each axis, zero outside the panel: the halo's Gaussian of about 2.4 LED.
function blur(S) {
  const a = S.hs, b = S.tmp, r = 2, w = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      const o = y * W;
      let s = 0;
      for (let x = 0; x <= r; x++) s += a[o + x];
      for (let x = 0; x < W; x++) {
        b[o + x] = s / w;
        if (x + r + 1 < W) s += a[o + x + r + 1];
        if (x - r >= 0) s -= a[o + x - r];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = 0; y <= r; y++) s += b[y * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / w;
        if (y + r + 1 < H) s += b[(y + r + 1) * W + x];
        if (y - r >= 0) s -= b[(y - r) * W + x];
      }
    }
  }
  S.hal = a;
}

function drawSeam(S, s) {
  const G = S.G, GV = G0 * Math.pow(G / G0, 0.8), th = S.tilt + s.bias, c = cos(th), sn = sin(th);
  const K = min(N / 2 - 1, ceil(46 / (G * c)));
  const u = s.u, j0 = s.j0;
  const age = S.odo - s.born, ay = YB + age * s.vr, ax = s.ax;
  let mean = 0, m2 = 0, cnt = 0;
  for (let k = -K; k <= K; k++) {
    const v = u[(j0 + k + N) % N];
    mean += v;
    m2 += v * v;
    cnt++;
  }
  mean /= cnt;
  const sd = sqrt(max(0, m2 / cnt - mean * mean)), rms = sd * GV;
  s.rms = rms;
  const mat = sm(0.4, 3.4, rms);
  const sx = S.sx, sy = S.sy, sr = S.sr;
  const tf = (0.78 + 0.22 * G / G0) * (0.9 + 0.1 * S.load / 2);
  const alpha = 0.34 + 0.66 * mat, hw = 0.22 + 0.78 * mat;
  let top = 1e9;
  for (let k = -K, q = 0; k <= K; k++, q++) {
    const uu = u[(j0 + k + N) % N];
    const ss = k * G, nn = GV * (uu - mean);
    const X = ax + ss * c - nn * sn, Y = ay + ss * sn + nn * c;
    const depth = cl(0.5 + (uu - mean) / (4 * sd + 1.5), 0, 1);
    sx[q] = X;
    sy[q] = Y;
    sr[q] = 0.5 * (1.9 + 1.7 * mat * (0.3 + 0.7 * depth) * tf);
    if (Y < top) top = Y;
  }
  s.top = top;
  const nq = 2 * K + 1;
  for (let q = 0; q < nq - 1; q++) {
    const dX = sx[q + 1] - sx[q], dY = sy[q + 1] - sy[q];
    const m = ceil(sqrt(dX * dX + dY * dY) / 0.8) || 1;
    if (max(sy[q], sy[q + 1]) < -4 || min(sy[q], sy[q + 1]) > H + 4) continue;
    for (let i = 0; i < m; i++) {
      const t = i / m;
      stamp(S, sx[q] + dX * t, sy[q] + dY * t, sr[q] + (sr[q + 1] - sr[q]) * t, alpha, hw);
    }
  }
  // calcite fibres across the steep flanks of a mature seam
  const fo = sm(0.35, 0.75, mat);
  if (fo > 0.01) {
    for (const f of s.fib) {
      const k = ((f.j - j0 + N + N / 2) % N) - N / 2;
      if (k < -K + 1 || k > K - 1) continue;
      const q = k + K, slope = abs(u[(f.j + 1) % N] - u[(f.j - 1 + N) % N]) * 0.5;
      const a = fo * sm(0.5, 1.4, slope);
      if (a < 0.02) continue;
      const X = sx[q], Y = sy[q], half = f.len * 0.5 * (0.6 + 0.4 * min(1, G / G0));
      const nxv = -sn, nyv = c;
      for (let t = -half; t <= half; t += 0.6) stampFib(S, X + nxv * t, Y + nyv * t, f.w, min(1, 1.4 * a) * (1 - 0.3 * abs(t) / half));
    }
  }
}

// ---- rock: value noise in the rock's own frame, beds across it, flecks that sit still
const bedAt = (S, ry) => {
  const a = ry / 9.5, i = floor(a);
  let f = a - i;
  f = f * f * (3 - 2 * f);
  const v1 = hsh(i, 7, S.salt) * (1 - f) + hsh(i + 1, 7, S.salt) * f;
  const b = ry / 4.3, j = floor(b);
  let g = b - j;
  g = g * g * (3 - 2 * g);
  const v2 = hsh(j, 11, S.salt) * (1 - g) + hsh(j + 1, 11, S.salt) * g;
  const c = ry / 31, k = floor(c);
  let h = c - k;
  h = h * h * (3 - 2 * h);
  const v3 = hsh(k, 13, S.salt) * (1 - h) + hsh(k + 1, 13, S.salt) * h;
  return (v1 - 0.5) * 0.46 + (v2 - 0.5) * 0.18 + (v3 - 0.5) * 0.22;
};

const FXC = 13, FYC = 9;
function stampFlecks(S) {
  const gs = S.gs, fl = S.fl, TA = S.TA;
  fl.fill(0);
  const tx0 = 32 + (-4 - 32) / gs, tx1 = 32 + (W + 4 - 32) / gs;
  const ty0 = TA + (-6 - 64) / gs, ty1 = TA + (H + 6 - 64) / gs;
  for (let ky = floor(ty0 / FYC); ky <= floor(ty1 / FYC); ky++)
    for (let kx = floor(tx0 / FXC); kx <= floor(tx1 / FXC); kx++) {
      if (hsh(kx, ky, S.salt + 1) > 0.34) continue;
      const tx = (kx + hsh(kx, ky, S.salt + 2)) * FXC, ty = (ky + hsh(kx, ky, S.salt + 3)) * FYC;
      const X = 32 + (tx - 32) * gs, Y = 64 + (ty - TA) * gs;
      const ang = (hsh(kx, ky, S.salt + 4) - 0.5) * 1.1, ca = cos(ang), sa = sin(ang);
      const big = 0.8 + 0.6 * hsh(kx, ky, S.salt + 5);
      const A = max(1.9, 2.1 * gs * big), B = max(1.05, 1.1 * gs * big);
      const strength = 0.18 + 0.2 * hsh(kx, ky, S.salt + 6);
      const x0 = max(0, floor(X - A - 1)), x1 = min(W - 1, ceil(X + A + 1)), y0 = max(0, floor(Y - A - 1)), y1 = min(H - 1, ceil(Y + A + 1));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - X, dy = y + 0.5 - Y;
          const px = (dx * ca + dy * sa) / A, py = (-dx * sa + dy * ca) / B;
          const e = px * px + py * py;
          if (e >= 1.4) continue;
          const v = strength * sm(1.4, 0.3, e);
          const p = y * W + x;
          if (v > fl[p]) fl[p] = v;
        }
    }
}

const LX1 = 6, LY1 = 4.6, LX2 = 3, LY2 = 2.3;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  paletteAt(S, S.kn[0]);
  const P = S.pal, gs = S.gs, TA = S.TA, salt = S.salt;
  S.cov.fill(0);
  S.hs.fill(0);
  S.fib.fill(0);
  for (const s of S.seams) drawSeam(S, s);
  blur(S);
  stampFlecks(S);

  // lattice rows and columns of the mottle for this frame
  const tyA = TA + (0 - 64) / gs, tyB = TA + (H - 64) / gs;
  const txA = 32 + (0 - 32) / gs, txB = 32 + (W - 32) / gs;
  const ky1 = floor(tyA / LY1), kx1 = floor(txA / LX1), ky2 = floor(tyA / LY2), kx2 = floor(txA / LX2);
  const nx1 = floor(txB / LX1) - kx1 + 2, nx2 = floor(txB / LX2) - kx2 + 2;
  const ny1 = floor(tyB / LY1) - ky1 + 2, ny2 = floor(tyB / LY2) - ky2 + 2;
  const L1 = S.lat1, L2 = S.lat2;
  for (let j = 0; j < ny1; j++) for (let i = 0; i < nx1; i++) L1[j * nx1 + i] = hsh(kx1 + i, ky1 + j, salt + 21) - 0.5;
  for (let j = 0; j < ny2; j++) for (let i = 0; i < nx2; i++) L2[j * nx2 + i] = hsh(kx2 + i, ky2 + j, salt + 22) - 0.5;
  const c1i = new Int16Array(W), c1f = new Float32Array(W), c2i = new Int16Array(W), c2f = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const tx = 32 + (x + 0.5 - 32) / gs;
    let a = tx / LX1, i = floor(a), f = a - i;
    c1i[x] = i - kx1; c1f[x] = f * f * (3 - 2 * f);
    a = tx / LX2; i = floor(a); f = a - i;
    c2i[x] = i - kx2; c2f[x] = f * f * (3 - 2 * f);
  }

  const A0 = P[0], A1 = P[1], A2 = P[2], B0 = P[3], B1 = P[4], B2 = P[5];
  const H0 = P[6], H1 = P[7], H2 = P[8], C0 = P[9], C1 = P[10], C2 = P[11];
  const F0 = P[12], F1 = P[13], F2 = P[14], K0 = P[15], K1 = P[16], K2 = P[17];
  const cov = S.cov, hal = S.hal, fib = S.fib, fl = S.fl;
  for (let y = 0; y < H; y++) {
    const ty = TA + (y + 0.5 - 64) / gs;
    let a = ty / LY1, j = floor(a), f = a - j;
    const r1 = (j - ky1) * nx1, w1 = f * f * (3 - 2 * f);
    a = ty / LY2; j = floor(a); f = a - j;
    const r2 = (j - ky2) * nx2, w2 = f * f * (3 - 2 * f);
    const bed = bedAt(S, y + 0.5 - S.odo);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i1 = r1 + c1i[x], fx1 = c1f[x];
      const m1 = (L1[i1] + (L1[i1 + 1] - L1[i1]) * fx1) * (1 - w1) + (L1[i1 + nx1] + (L1[i1 + nx1 + 1] - L1[i1 + nx1]) * fx1) * w1;
      const i2 = r2 + c2i[x], fx2 = c2f[x];
      const m2 = (L2[i2] + (L2[i2 + 1] - L2[i2]) * fx2) * (1 - w2) + (L2[i2 + nx2] + (L2[i2 + nx2 + 1] - L2[i2 + nx2]) * fx2) * w2;
      const t = cl(0.62 + bed + 0.34 * m1 + 0.14 * m2, 0, 1);
      const lit = 1.06 - 0.15 * (x / (W - 1));
      let r = (B0 + (A0 - B0) * t) * lit, g = (B1 + (A1 - B1) * t) * lit, b = (B2 + (A2 - B2) * t) * lit;
      const fv = fl[p];
      if (fv > 0) {
        r += (F0 - r) * fv;
        g += (F1 - g) * fv;
        b += (F2 - b) * fv;
      }
      const hv = cl(hal[p] * 2.7, 0, 1) * 0.8;
      if (hv > 0.004) {
        const k = 0.6 + 0.4 * t;
        r += (H0 * k - r) * hv;
        g += (H1 * k - g) * hv;
        b += (H2 * k - b) * hv;
      }
      const cv = cov[p];
      if (cv > 0) {
        r += (C0 - r) * cv;
        g += (C1 - g) * cv;
        b += (C2 - b) * cv;
      }
      const fb = fib[p];
      if (fb > 0) {
        r += (K0 - r) * fb;
        g += (K1 - g) * fb;
        b += (K2 - b) * fb;
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
