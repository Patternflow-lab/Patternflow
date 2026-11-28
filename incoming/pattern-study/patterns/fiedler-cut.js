// ===== Patternflow pattern =====
// Title:   Fiedler Cut
// Family:  spectralcut
// Idea:    Draft.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Reach=0..4, Morph=-1..1, Cuts=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Reach. draft
// Knob 3: Morph. draft
// Knob 4: Cuts. draft

const W = 64, H = 128, N = 220, NG = 4, PER = N / NG, KMAX = 5, QM = KMAX + 3;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const lerp = (a, b, t) => a + (b - a) * t;
const CX = 32, CYD = 32, CYE = 96;  // centres of the two views
const RD = 28;      // LEDs to a data unit
const RE = 26;      // LEDs from the centre of the embedding to a cluster's corner
const RR = 30.5;    // radius of the two rings that frame the views
const GAMMA = 1.8;  // how much wider the scatter round a cluster is drawn than it is
const GAPF = 1e-5;  // floor under 1 - lambda, so a gap between two nearly exact eigenvalues does not count

function pal(h, s, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = 1 - s, q = 1 - f * s, t = 1 - (1 - f) * s;
  o[0] = i === 0 || i === 5 ? 1 : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? 1 : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? 1 : i === 2 ? t : i === 5 ? q : p;
  // lifted where a hue is dark, so every cluster has about the same light
  const g = pow(0.72 / (0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2] + 0.05), 0.8);
  for (let c = 0; c < 3; c++) o[c] = min(1, o[c] * g);
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

// ---------------------------------------------------------------- the shapes
// A piece is [cx, cy, r0, r1, a0, span, th, curve]: a spiral arc round (cx, cy) whose radius goes
// from r0 to r1 as the angle goes from a0 through span, th the scatter across it. A blob has no
// radius. A scene is NG pieces; each point lives in one slot of it for good.
const sp = (cx, cy, r0, r1, a0, span, th) => [cx, cy, r0, r1, a0, span, th, 0];
const blob = (cx, cy, th) => [sp(cx, cy, 0, 0, 0, 0, th)];
function halves(p) {
  const rm = (p[2] + p[3]) / 2, h = p[5] / 2;
  return [[p[0], p[1], p[2], rm, p[4], h, p[6], 0], [p[0], p[1], rm, p[3], p[4] + h, h, p[6], 0]];
}
const ring = (cx, cy, r, th, a0, span) => halves(sp(cx, cy, r, r, a0 || 0, span || TAU, th));
const arc = (cx, cy, r, a0, span, th) => [sp(cx, cy, r, r, a0, span, th)];
// a scene is a list of curves, each a list of one or two pieces; a curve that comes twice is heavier
const ARCH = [
  (J, o) => [ring(o(0.1), o(0.1), J(0.9, 0.04), 0.02), ring(o(0.1), o(0.1), J(0.42, 0.1), 0.02)], // nested rings
  (J, o) => { const R = J(0.6, 0.06), dx = J(0.28, 0.1), dy = J(0.14, 0.2), t = J(0.03, 0.2); return [ring(-dx, dy, R, t, PI, PI), ring(dx, -dy, R, t, 0, PI)]; }, // two moons
  (J, o, r) => { const a = TAU * r(), R = J(0.55, 0.1), t = J(0.13, 0.15), c = [0, 1, 2].map((i) => blob(R * cos(a + (i * TAU) / 3), R * sin(a + (i * TAU) / 3), t)); return [...c, c[floor(r() * 3)]]; }, // three blobs
  (J, o, r) => { const a = TAU * r(), s2 = J(2.2 * PI, 0.1), r1 = J(0.92, 0.04); return [halves(sp(0, 0, 0.2, r1, a, s2, 0.02)), halves(sp(0, 0, 0.2, r1, a + PI, s2, 0.02))]; }, // spiral pair
  (J, o, r) => { const a = TAU * r(), R = J(0.68, 0.1), t = J(0.11, 0.2); return [0, 1, 2, 3].map((i) => blob(R * cos(a + (i * TAU) / 4), R * sin(a + (i * TAU) / 4), t)); }, // four blobs
  (J, o) => { const d = J(0.32, 0.15), t = J(0.1, 0.2); return [ring(0, 0, J(0.9, 0.04), 0.02), blob(-d, o(0.1), t), blob(d, o(0.1), t)]; }, // ring round two blobs
  (J, o) => { const rc = J(0.42, 0.1), sa = J(1, 0.1), d = J(0.03, 0.5), y = o(0.12); return [ring(0, 0, J(0.92, 0.03), 0.02), arc(d, y, rc, PI - sa, 2 * sa, 0.025), arc(-d, -y, rc, -sa, 2 * sa, 0.025)]; }, // ring round two facing arcs
  (J, o) => { const R = J(1.2, 0.1), sg = J(0.5, 0.12), g = J(0.5, 0.12), t = J(0.025, 0.2); return [ring(0, -g / 2 + R * 0.6, R, t, -PI / 2 - sg, 2 * sg), ring(0, g / 2 + R * 0.6, R, t, -PI / 2 - sg, 2 * sg)]; }, // two parallel arcs
  (J, o, r) => { const a = TAU * r(), s2 = J(1.6 * PI, 0.1), r1 = J(0.92, 0.04), c = [0, 1, 2].map((i) => [sp(0, 0, 0.28, r1, a + (i * TAU) / 3, s2, 0.02)]); return [...c, c[floor(r() * 3)]]; }, // three spiral arms
  (J, o, r) => { const d = J(0.5, 0.15), t = J(0.17, 0.15), a = TAU * r(), c = [blob(-d * cos(a), -d * sin(a), t), blob(d * cos(a), d * sin(a), t)]; return [c[0], c[1], c[0], c[1]]; }, // two blobs
  (J, o) => { const t = J(0.3, 0.2); return [0, 1, 2, 3].map(() => blob(o(0.08), o(0.08), t)); }, // one blob: everything merged
];
const AW = ARCH.map((_, i) => (i === 10 ? 0.45 : 1));

function build(S, id) {
  const r = S.r, J = (v, f) => v * (1 + f * (2 * r() - 1)), o = (f) => (r() - 0.5) * f, cs = ARCH[id](J, o, r), seen = [], P = [];
  for (const c of cs) {
    let k = seen.indexOf(c);
    if (k < 0) k = seen.push(c) - 1;
    for (const p of c) P.push(p.slice(0, 7).concat(k));
  }
  // a mirror, a turn and a shuffle of the slots, so no scene is another one's twin
  const mir = r() < 0.5 ? -1 : 1, rot = TAU * r();
  for (const p of P) {
    const x = p[0] * mir, y = p[1];
    p[0] = x * cos(rot) - y * sin(rot);
    p[1] = x * sin(rot) + y * cos(rot);
    p[4] = (mir < 0 ? PI - p[4] : p[4]) + rot;
    if (mir < 0) p[5] = -p[5];
  }
  for (let i = NG - 1; i > 0; i--) {
    const j = floor(r() * (i + 1)), t = P[i];
    P[i] = P[j];
    P[j] = t;
  }
  return P;
}

function newScene(S) {
  let tot = 0, id = 0;
  for (let i = 0; i < ARCH.length; i++) if (S.hist.indexOf(i) < 0) tot += AW[i];
  let v = S.r() * tot;
  for (let i = 0; i < ARCH.length; i++) {
    if (S.hist.indexOf(i) >= 0) continue;
    id = i;
    if ((v -= AW[i]) <= 0) break;
  }
  S.A = S.B;
  S.B = build(S, S.first ? 6 : id);
  S.first = false;
  // each arc turns the short way
  if (S.A) {
    for (let g = 0; g < NG; g++) {
      let d = (S.B[g][4] - S.A[g][4]) % TAU;
      if (d > PI) d -= TAU;
      if (d < -PI) d += TAU;
      S.B[g][4] = S.A[g][4] + d;
    }
  }
  S.hist.push(id);
  if (S.hist.length > 4) S.hist.shift();
}

// ---------------------------------------------------------------- the numbers
// the normalised kernel matrix times the q columns of Q, into Z: D^-1/2 W D^-1/2 Q
function mulM(S, Q, Z, q) {
  const n = N, Wm = S.M, dis = S.dis, T = S.T;
  for (let j = 0; j < q; j++) for (let i = 0; i < n; i++) T[j * n + i] = Q[j * n + i] * dis[i];
  for (let i = 0; i < n; i++) {
    const row = i * n;
    for (let j = 0; j < q; j++) {
      const o = j * n;
      let s = 0;
      for (let l = 0; l < n; l++) s += Wm[row + l] * T[o + l];
      Z[o + i] = s * dis[i];
    }
  }
}

function orth(S, Q, q) {
  const n = N;
  for (let a = 0; a < q; a++) {
    const oa = a * n;
    for (let b = 0; b < a; b++) {
      let d = 0;
      for (let i = 0; i < n; i++) d += Q[oa + i] * Q[b * n + i];
      for (let i = 0; i < n; i++) Q[oa + i] -= d * Q[b * n + i];
    }
    let nn = 0;
    for (let i = 0; i < n; i++) nn += Q[oa + i] * Q[oa + i];
    if (nn < 1e-20) {
      for (let i = 0; i < n; i++) Q[oa + i] = S.r() - 0.5;
      a--;
    } else for (let i = 0, f = 1 / sqrt(nn); i < n; i++) Q[oa + i] *= f;
  }
}

// eigenvectors of a small symmetric matrix by Jacobi rotations: the columns of V
function jacobi(A, n, V) {
  V.fill(0);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sw = 0; sw < 14; sw++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] * A[p * n + q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q];
        if (abs(apq) < 1e-15) continue;
        const th = (A[q * n + q] - A[p * n + p]) / (2 * apq), t = (th >= 0 ? 1 : -1) / (abs(th) + sqrt(th * th + 1)), c = 1 / sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const a = A[k * n + p], b = A[k * n + q];
          A[k * n + p] = c * a - s * b;
          A[k * n + q] = s * a + c * b;
        }
        for (let k = 0; k < n; k++) {
          const a = A[p * n + k], b = A[q * n + k];
          A[p * n + k] = c * a - s * b;
          A[q * n + k] = s * a + c * b;
          const u = V[k * n + p], v = V[k * n + q];
          V[k * n + p] = c * u - s * v;
          V[k * n + q] = s * u + c * v;
        }
      }
    }
  }
}

export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0), f = (n) => new Float64Array(n);
  const S = {
    r, t: 0, sc: 0, k: [0, 2, 0, 0.06], ready: false, first: true, A: null, B: null, hist: [], u: 0, tm: 16, md: 12, rot: TAU * r(),
    ph: [], grp: new Uint8Array(N), sv: f(N), gx: f(N), gy: f(N), jw: f(N), jp: f(N), jr: f(N), px: f(N), py: f(N),
    M: new Float32Array(N * N), dis: f(N), Q: f(N * QM), Z: f(N * QM), T: f(N * QM), Q2: f(N * QM), lam: f(QM),
    kc: 3, ka: 3, kt: 0, Y: f(N * KMAX), C: f(KMAX * KMAX), lb: new Uint8Array(N).fill(255),
    dx: f(N), dy: f(N), ux: f(N), uy: f(N), cr: f(N), cg: f(N), cb: f(N), vx: f(KMAX), vy: f(KMAX),
  };
  for (let i = 0; i < 40; i++) S.ph.push(TAU * r());
  for (let i = 0; i < N; i++) {
    const m = sqrt(-2 * log(max(r(), 1e-9))), a = TAU * r(), j = i % PER;
    S.grp[i] = floor(i / PER);
    S.sv[i] = (j + 0.15 + 0.7 * r()) / PER;
    S.gx[i] = m * cos(a);
    S.gy[i] = m * sin(a);
    S.ux[i] = cos(TAU * r());
    S.uy[i] = sin(TAU * r());
    S.jr[i] = 0.01 + 0.022 * r();
    S.jw[i] = 0.35 + 1.1 * r();
    S.jp[i] = TAU * r();
  }
  params.s = S;
}

// the slow wander of a curve, the same for every piece of it: centre, radius, turn, scatter
function wander(t, c, ph, w) {
  const p = 3 + c * 5;
  w[0] = 0.04 * sin(0.31 * t + ph[p]);
  w[1] = 0.04 * sin(0.27 * t + ph[p + 1]);
  w[2] = 1 + 0.04 * sin(0.23 * t + ph[p + 2]);
  w[3] = 0.1 * sin(0.19 * t + ph[p + 3]);
  w[4] = 1 + 0.2 * sin(0.17 * t + ph[p + 4]);
}
const PB = [[], [], [], []], WA = [], WB = [];
// the data cloud at scene clock S.sc
function place(S) {
  const t = S.sc, u = S.u, A = S.A, B = S.B, ph = S.ph;
  const spread = 1 + 0.26 * sin(0.113 * t + ph[0]) + 0.1 * sin(0.0617 * t + ph[1]), scl = 1 + 0.035 * sin(0.0791 * t + ph[2]);
  for (let g = 0; g < NG; g++) {
    const a = A[g], b = B[g], q = PB[g];
    wander(t, a[7], ph, WA);
    wander(t, b[7], ph, WB);
    q[0] = lerp(a[0] * spread + WA[0], b[0] * spread + WB[0], u);
    q[1] = lerp(a[1] * spread + WA[1], b[1] * spread + WB[1], u);
    q[2] = lerp(a[2] * WA[2], b[2] * WB[2], u);
    q[3] = lerp(a[3] * WA[2], b[3] * WB[2], u);
    q[4] = lerp(a[4] + WA[3], b[4] + WB[3], u);
    q[5] = lerp(a[5], b[5], u);
    q[6] = lerp(a[6] * WA[4], b[6] * WB[4], u);
  }
  const cr = cos(S.rot), sr = sin(S.rot);
  for (let i = 0; i < N; i++) {
    const q = PB[S.grp[i]], s = S.sv[i], an = q[4] + q[5] * s, rr = lerp(q[2], q[3], s), ja = S.jw[i] * S.t + S.jp[i];
    let x = (q[0] + rr * cos(an) + q[6] * S.gx[i] + S.jr[i] * cos(ja)) * scl, y = (q[1] + rr * sin(an) + q[6] * S.gy[i] + S.jr[i] * sin(ja)) * scl;
    const m = sqrt(x * x + y * y);
    if (m > 1) ((x /= m), (y /= m)); // nothing leaves the unit disc
    S.px[i] = x * cr - y * sr;
    S.py[i] = x * sr + y * cr;
  }
}

// the Gaussian affinity W_ij = exp(-d^2 / 2 sigma^2), with W_ii = 1, and D^-1/2
function affinity(S, sig) {
  const n = N, M = S.M, x = S.px, y = S.py, inv = 1 / (2 * sig * sig), dg = S.dis;
  dg.fill(1);
  for (let i = 0; i < n; i++) {
    M[i * n + i] = 1;
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j], dy = y[i] - y[j], q = (dx * dx + dy * dy) * inv, w = q > 13 ? 0 : exp(-q);
      M[i * n + j] = M[j * n + i] = w;
      dg[i] += w;
      dg[j] += w;
    }
  }
  for (let i = 0; i < n; i++) dg[i] = 1 / sqrt(dg[i]);
}

const HM = new Float64Array(QM * QM), HV = new Float64Array(QM * QM);
// sweeps of subspace iteration, then Rayleigh-Ritz: the columns of S.Q are the leading eigenvectors in order
function eigen(S, sweeps) {
  const n = N, q = QM, Q = S.Q, Z = S.Z, Q2 = S.Q2;
  for (let s = 0; s < sweeps; s++) {
    mulM(S, Q, Z, q);
    Q.set(Z);
    orth(S, Q, q);
  }
  mulM(S, Q, Z, q);
  for (let a = 0; a < q; a++) {
    for (let b = a; b < q; b++) {
      let d = 0;
      for (let i = 0; i < n; i++) d += Q[a * n + i] * Z[b * n + i];
      HM[a * q + b] = HM[b * q + a] = d;
    }
  }
  jacobi(HM, q, HV);
  const idx = [...Array(q).keys()].sort((a, b) => HM[b * q + b] - HM[a * q + a]);
  idx.forEach((col, c) => {
    S.lam[c] = HM[col * q + col];
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (let b = 0; b < q; b++) d += Q[b * n + i] * HV[b * q + col];
      Q2[c * n + i] = d;
    }
  });
  Q.set(Q2);
}

// the rows of the leading k eigenvectors, each scaled to length 1 (Ng, Jordan and Weiss)
function embed(S) {
  const n = N, k = S.kc, Q = S.Q, Y = S.Y;
  for (let i = 0; i < n; i++) {
    let nn = 0;
    for (let c = 0; c < k; c++) nn += Q[c * n + i] * Q[c * n + i];
    for (let c = 0, f = 1 / (sqrt(nn) + 1e-12); c < k; c++) Y[i * k + c] = Q[c * n + i] * f;
  }
}

const d2 = (Y, i, C, j, k) => { let d = 0; for (let c = 0; c < k; c++) d += (Y[i * k + c] - C[j * k + c]) * (Y[i * k + c] - C[j * k + c]); return d; };
// k-means in the embedding. The centroids are the means of the clusters the last frame found, so a cluster keeps its
// label and its colour; one that has lost every point is taken to the point farthest from the others
function kmeans(S, iters) {
  const n = N, k = S.kc, Y = S.Y, C = S.C, lb = S.lb, cnt = new Float64Array(k);
  const mean = () => {
    C.fill(0, 0, k * k);
    cnt.fill(0);
    for (let i = 0; i < n; i++) if (lb[i] < k) { cnt[lb[i]]++; for (let c = 0; c < k; c++) C[lb[i] * k + c] += Y[i * k + c]; }
    for (let j = 0; j < k; j++) if (cnt[j]) for (let c = 0; c < k; c++) C[j * k + c] /= cnt[j];
  };
  mean();
  const set = [];
  for (let j = 0; j < k; j++) if (cnt[j]) set.push(j);
  for (let j = 0; j < k; j++) {
    if (cnt[j]) continue;
    let bi = floor(S.r() * n), bd = -1;
    if (set.length) for (let i = 0; i < n; i++) { let m = 1e9; for (const l of set) m = min(m, d2(Y, i, C, l, k)); if (m > bd) ((bd = m), (bi = i)); }
    for (let c = 0; c < k; c++) C[j * k + c] = Y[bi * k + c];
    set.push(j);
  }
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let bj = 0, bd = 1e9;
      for (let j = 0; j < k; j++) { const d = d2(Y, i, C, j, k); if (d < bd) ((bd = d), (bj = j)); }
      lb[i] = bj;
    }
    const keep = C.slice(0, k * k);
    mean();
    for (let j = 0; j < k; j++) if (!cnt[j]) for (let c = 0; c < k; c++) C[j * k + c] = keep[j * k + c];
  }
}

const CK = [[], [], [], [], []];
const slotHue = (S, j, k) => 0.5 + S.k[0] + (k === 2 ? 0.42 * j : j / k);
// The k cluster corners are a regular polygon, one corner to a centroid. A point takes the colour of the
// centroids by how near they are, and stands at the same mix of the corners, off its corner by the real
// scatter of its cluster, GAMMA times as wide, in a direction of its own. Both glide.
function show(S, d, first) {
  const n = N, k = S.kc, Y = S.Y, C = S.C, vx = S.vx, vy = S.vy, inv = 1 / (2 * 0.36 * 0.36);
  const a = first ? 1 : 1 - exp(-d / 0.2), e = first ? 1 : 1 - exp(-d / 0.14);
  let mx = 0, my = 0, mr = 0;
  for (let c = 0; c < k; c++) {
    const t = PI / 2 + (k === 2 ? (c ? 1 : -1) * (PI / 4) : (c * TAU) / k);
    vx[c] = cos(t);
    vy[c] = sin(t);
    mx += vx[c] / k;
    my += vy[c] / k;
    pal(slotHue(S, c, k), 0.86, CK[c]);
  }
  for (let c = 0; c < k; c++) {
    vx[c] -= mx;
    vy[c] -= my;
    mr = max(mr, sqrt(vx[c] * vx[c] + vy[c] * vy[c]));
  }
  for (let c = 0; c < k; c++) ((vx[c] /= mr), (vy[c] /= mr));
  for (let i = 0; i < n; i++) {
    let ws = 1e-9, r = 0, g = 0, b = 0, x = 0, y = 0, own = 0;
    for (let j = 0; j < k; j++) {
      const dd = d2(Y, i, C, j, k), w = exp(-dd * inv);
      if (j === S.lb[i]) own = sqrt(dd);
      ws += w;
      r += w * CK[j][0];
      g += w * CK[j][1];
      b += w * CK[j][2];
      x += w * vx[j];
      y += w * vy[j];
    }
    const sc = GAMMA * min(own, 0.1);
    S.cr[i] += (r / ws - S.cr[i]) * a;
    S.cg[i] += (g / ws - S.cg[i]) * a;
    S.cb[i] += (b / ws - S.cb[i]) * a;
    S.dx[i] += (x / ws + sc * S.ux[i] - S.dx[i]) * e;
    S.dy[i] += (y / ws + sc * S.uy[i] - S.dy[i]) * e;
  }
}

function tick(S, d, kv, first, adv) {
  const al = first ? 1 : 1 - exp(-d / 0.18);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  if (adv) {
    const speed = exp(1.1 * S.k[2]);
    S.t += d * speed;
    S.sc += d * speed;
    S.rot += d * speed * 0.04;
    // the script of shapes: hold, morph, and a new scene made at random each time
    if (S.sc > S.tm + S.md) {
      newScene(S);
      S.tm = S.sc + 6 + 8 * S.r();
      S.md = 9 + 8 * S.r();
    }
    S.u = sm((S.sc - S.tm) / S.md);
  }
  place(S);
  affinity(S, 0.075 * exp(0.62 * (S.k[1] - 2)));
  eigen(S, first ? 90 : 3);
  // the number of clusters: where the eigenvalues leave 1 by the biggest step (the eigengap); the knob adds or takes away cuts
  S.kt += d;
  let bk = 2, br = 0, rk = 0;
  for (let j = 2; j <= KMAX; j++) {
    const rj = (1 - S.lam[j] + GAPF) / (1 - S.lam[j - 1] + GAPF);
    if (rj > br) ((br = rj), (bk = j));
    if (j === S.ka) rk = rj;
  }
  if (first) S.ka = bk;
  else if (bk !== S.ka && br > 1.5 * rk && S.kt > 0.4) ((S.ka = bk), (S.kt = 0));
  S.kc = cl(S.ka + Math.round(3 * S.k[3]), 2, KMAX);
  embed(S);
  kmeans(S, first ? 12 : 2);
  show(S, d, first);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    for (let i = 0; i < N * QM; i++) S.Q[i] = S.r() - 0.5;
    orth(S, S.Q, QM);
    newScene(S);
    newScene(S);
    S.ready = true;
    // the opening is already settled: eigenvectors, clusters and colours have run for a second
    tick(S, 1 / 30, kv, true, false);
    for (let i = 0; i < 36; i++) tick(S, 1 / 30, kv, false, false);
  }
  tick(S, d, kv, false, true);
}

// ---------------------------------------------------------------- drawing
const AA = new Float32Array(W * H), AR = new Float32Array(W * H), AG = new Float32Array(W * H), AB = new Float32Array(W * H);
const DR = new Float32Array(W * H), DG = new Float32Array(W * H), DB = new Float32Array(W * H);

// a soft round dot, sigma sg LEDs, into the point layer
function disc(x, y, r, g, b, a, sg) {
  const x0 = floor(x - 0.5) - 2, y0 = floor(y - 0.5) - 2, inv = 1 / (2 * sg * sg), nn = ceil(sg * 3) + 3;
  for (let j = 0; j < nn; j++) {
    const yy = y0 + j, ey = yy + 0.5 - y;
    if (yy < 0 || yy >= H) continue;
    for (let i = 0; i < nn; i++) {
      const xx = x0 + i, ex = xx + 0.5 - x, w = a * exp(-(ex * ex + ey * ey) * inv), p = yy * W + xx;
      if (xx < 0 || xx >= W) continue;
      AA[p] += w;
      AR[p] += w * r;
      AG[p] += w * g;
      AB[p] += w * b;
    }
  }
}
// the haze under the points: a wide dot from a table, at the nearest LED
const HK = new Float32Array(121);
for (let j = 0; j < 11; j++) for (let i = 0; i < 11; i++) HK[j * 11 + i] = exp(-((i - 5) * (i - 5) + (j - 5) * (j - 5)) / (2 * 2.4 * 2.4));
function halo(x, y, r, g, b, k) {
  const xc = floor(x), yc = floor(y);
  for (let j = 0; j < 11; j++) {
    const yy = yc + j - 5;
    if (yy < 0 || yy >= H) continue;
    for (let i = 0; i < 11; i++) {
      const xx = xc + i - 5, w = k * HK[j * 11 + i], p = yy * W + xx;
      if (xx < 0 || xx >= W) continue;
      DR[p] += r * w;
      DG[p] += g * w;
      DB[p] += b * w;
    }
  }
}
// a thin ring, about 1.6 LED wide, into the decoration layer
function ring2(cx, cy, rad, r, g, b, k) {
  const x0 = max(0, floor(cx - rad - 3)), x1 = min(W - 1, ceil(cx + rad + 3)), y0 = max(0, floor(cy - rad - 3)), y1 = min(H - 1, ceil(cy + rad + 3));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const e = sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy)) - rad, w = k * exp(-(e * e) / 0.9), p = y * W + x;
      DR[p] += r * w;
      DG[p] += g * w;
      DB[p] += b * w;
    }
  }
}
// the ground: a deep blue everywhere, lifted a little inside each of the two rings
const GROUND = new Float32Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dy = y + 0.5 - (y < 64 ? CYD : CYE), dx = x + 0.5 - CX, q = sqrt(dx * dx + dy * dy) / RR;
    GROUND[y * W + x] = 1 + 0.35 * (1 - sm(q * 1.05 - 0.1)) + (q < 1 ? 0.12 * q * q : 0);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  for (const A of [AA, AR, AG, AB, DR, DG, DB]) A.fill(0);
  ring2(CX, CYD, RR, 0.5, 0.6, 0.9, 0.2);
  ring2(CX, CYE, RR, 0.5, 0.6, 0.9, 0.2);
  const k = S.kc;
  for (let j = 0; j < k; j++) ring2(CX + S.vx[j] * RE, CYE + S.vy[j] * RE, 4.6, CK[j][0], CK[j][1], CK[j][2], 0.2);
  for (let i = 0; i < N; i++) {
    const x1 = CX + S.px[i] * RD, y1 = CYD + S.py[i] * RD, ja = S.jw[i] * 1.7 * S.t + S.jp[i];
    const x2 = CX + S.dx[i] * RE + 0.7 * cos(ja), y2 = CYE + S.dy[i] * RE + 0.7 * sin(ja), r = S.cr[i], g = S.cg[i], b = S.cb[i];
    disc(x1, y1, r, g, b, 0.9, 0.85);
    disc(x2, y2, r, g, b, 0.3, 0.95);
    halo(x1, y1, r, g, b, 0.04);
    halo(x2, y2, r, g, b, 0.07);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, a = AA[p], gd = GROUND[p];
      let r = 0.034 * gd + DR[p], g = 0.052 * gd + DG[p], b = 0.1 * gd + DB[p];
      if (a > 1e-4) {
        const f = (1 - exp(-(y < 64 ? 1.4 : 1.1) * a)) / a;
        r += AR[p] * f;
        g += AG[p] * f;
        b += AB[p] * f;
      }
      const m = max(r, g, b);
      if (m > 0.85) {
        const f = (0.85 + 0.15 * (1 - exp(-(m - 0.85) / 0.15))) / m;
        r *= f;
        g *= f;
        b *= f;
      }
      display.setPixel(x, y, min(255, (r * 255) | 0), min(255, (g * 255) | 0), min(255, (b * 255) | 0));
    }
  }
}
