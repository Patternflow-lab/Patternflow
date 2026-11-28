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

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, log, sin, cos, atan2, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const lerp = (a, b, t) => a + (b - a) * t;

const N = 220;            // points
const NG = 4;             // slots: a scene gives each of them one piece of curve or one blob
const PER = N / NG;       // points to a slot
const KMAX = 5;           // most clusters
const QM = KMAX + 3;      // columns the subspace carries: the clusters and a few more, so the gap shows
const GAPF = 1e-5;        // floor under 1 - lambda, so a gap between two nearly exact ones does not count
const CX = 32, CYD = 32, CYE = 96;
const RD = 28;            // LEDs to a data unit
const RE = 26;            // LEDs from the centre to a cluster's corner in the embedding
const GAMMA = 1.5;        // how much wider the scatter round a cluster is drawn than it is
const RR = 30.5;          // the radius of the two rings that frame the views

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// a colour of hue h and saturation s, lifted where a hue is dark so each has about the same light
function pal(h, s, o) {
  hsv(h, s, 1, o);
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = pow(0.72 / (l + 0.05), 0.8);
  o[0] = min(1, o[0] * g);
  o[1] = min(1, o[1] * g);
  o[2] = min(1, o[2] * g);
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

// ------------------------------------------------------------ the shapes
// A piece is [cx, cy, r0, r1, a0, span, th]: a spiral arc round (cx, cy) whose radius goes from
// r0 to r1 while the angle goes from a0 through span, and th is the scatter across it. A blob is
// a piece with no radius. A scene is NG pieces, and each point lives in one slot of it for good.
const sp = (cx, cy, r0, r1, a0, span, th) => [cx, cy, r0, r1, a0, span, th];
const blob = (cx, cy, th) => sp(cx, cy, 0, 0, 0, 0, th);
function halves(p) {
  const rm = (p[2] + p[3]) / 2, h = p[5] / 2;
  return [[p[0], p[1], p[2], rm, p[4], h, p[6]], [p[0], p[1], rm, p[3], p[4] + h, h, p[6]]];
}
const ring = (cx, cy, r, th, a0, span) => halves(sp(cx, cy, r, r, a0, span || TAU, th));
const NA = 14;
const AW = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.45, 1, 1];

function build(S, id) {
  const r = S.r, J = (v, f) => v * (1 + f * (2 * r() - 1)), o = (f) => (r() - 0.5) * f, P = [];
  const push = (a) => { for (const p of a) P.push(p); };
  switch (id) {
    case 0: // nested rings
      push(ring(o(0.1), o(0.1), J(0.9, 0.04), 0.02, 0));
      push(ring(o(0.1), o(0.1), J(0.42, 0.1), 0.02, 0));
      break;
    case 1: { // two interleaved crescents
      const R = J(0.6, 0.06), dx = J(0.28, 0.1), dy = J(0.14, 0.2), th = J(0.03, 0.2);
      push(ring(-dx, dy, R, th, PI, PI));
      push(ring(dx, -dy, R, th, 0, PI));
      break;
    }
    case 2: { // three blobs, one of them heavier
      const a = TAU * r(), R = J(0.55, 0.1), th = J(0.13, 0.15), c = [];
      for (let i = 0; i < 3; i++) c.push(blob(R * cos(a + (i * TAU) / 3), R * sin(a + (i * TAU) / 3), th));
      push(c);
      P.push(c[floor(r() * 3)].slice());
      break;
    }
    case 3: { // a pair of spirals
      const a = TAU * r(), s2 = J(2.2 * PI, 0.1), r1 = J(0.92, 0.04);
      push(halves(sp(0, 0, 0.2, r1, a, s2, 0.02)));
      push(halves(sp(0, 0, 0.2, r1, a + PI, s2, 0.02)));
      break;
    }
    case 4: { // four blobs
      const a = TAU * r(), R = J(0.68, 0.1), th = J(0.11, 0.2);
      for (let i = 0; i < 4; i++) P.push(blob(R * cos(a + (i * TAU) / 4), R * sin(a + (i * TAU) / 4), th));
      break;
    }
    case 5: { // a ring round two blobs
      const R = J(0.9, 0.04), d = J(0.32, 0.15), th = J(0.1, 0.2);
      push(ring(0, 0, R, 0.02, 0));
      P.push(blob(-d, o(0.1), th), blob(d, o(0.1), th));
      break;
    }
    case 6: { // a ring round two facing arcs
      const R = J(0.92, 0.03), rc = J(0.52, 0.12), sa = J(1.05, 0.12), d = J(0.03, 0.5), y = o(0.2);
      push(ring(0, 0, R, 0.02, 0));
      P.push(sp(d, y, rc, rc, PI - sa, 2 * sa, 0.025), sp(-d, -y, rc, rc, -sa, 2 * sa, 0.025));
      break;
    }
    case 7: { // two parallel arcs
      const R = J(1.2, 0.1), sg = J(0.5, 0.12), gap = J(0.5, 0.12), th = J(0.025, 0.2);
      push(ring(0, -gap / 2 + R * 0.6, R, th, -PI / 2 - sg, 2 * sg));
      push(ring(0, gap / 2 + R * 0.6, R, th, -PI / 2 - sg, 2 * sg));
      break;
    }
    case 8: // three concentric rings
      push(ring(0, 0, J(0.92, 0.03), 0.015, 0));
      P.push(sp(0, 0, J(0.58, 0.05), 0, 0, TAU, 0.015));
      P[2][3] = P[2][2];
      P.push(sp(0, 0, J(0.26, 0.1), 0, 0, TAU, 0.015));
      P[3][3] = P[3][2];
      break;
    case 9: { // three spiral arms
      const a = TAU * r(), s2 = J(1.6 * PI, 0.1), r1 = J(0.92, 0.04);
      for (let i = 0; i < 3; i++) P.push(sp(0, 0, 0.28, r1, a + (i * TAU) / 3, s2, 0.02));
      P.push(P[floor(r() * 3)].slice());
      break;
    }
    case 10: { // two blobs
      const d = J(0.5, 0.15), th = J(0.17, 0.15), a = TAU * r();
      for (let i = 0; i < 4; i++) P.push(blob(((i & 1) * 2 - 1) * d * cos(a), ((i & 1) * 2 - 1) * d * sin(a), th));
      break;
    }
    case 11: { // one blob: everything merged
      const th = J(0.3, 0.2);
      for (let i = 0; i < 4; i++) P.push(blob(o(0.08), o(0.08), th));
      break;
    }
    case 12: { // a ring round a blob
      push(ring(0, 0, J(0.9, 0.04), 0.02, 0));
      P.push(blob(o(0.1), o(0.1), J(0.18, 0.2)), blob(o(0.1), o(0.1), J(0.18, 0.2)));
      break;
    }
    default: { // two rings side by side
      const R = J(0.42, 0.08), dx = J(0.56, 0.06), a = TAU * r();
      push(ring(-dx * cos(a), -dx * sin(a), R, 0.02, 0));
      push(ring(dx * cos(a), dx * sin(a), R, 0.02, 0));
    }
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

function nextId(S) {
  const r = S.r;
  let tot = 0;
  for (let i = 0; i < NA; i++) if (S.hist.indexOf(i) < 0) tot += AW[i];
  let v = r() * tot;
  for (let i = 0; i < NA; i++) {
    if (S.hist.indexOf(i) >= 0) continue;
    v -= AW[i];
    if (v <= 0) return i;
  }
  return 0;
}

function newScene(S, id) {
  const B = build(S, id), A = S.A;
  if (A) {
    // turn each arc by the short way
    for (let g = 0; g < NG; g++) {
      let d = (B[g][4] - A[g][4]) % TAU;
      if (d > PI) d -= TAU;
      if (d < -PI) d += TAU;
      B[g][4] = A[g][4] + d;
    }
  }
  S.B = B;
  S.hist.push(id);
  if (S.hist.length > 4) S.hist.shift();
}

// ------------------------------------------------------------ the numbers
// one product of the normalised kernel matrix with the q columns of Q, into Z
function mulM(S, Q, Z, q) {
  const n = N, Wm = S.M, dis = S.dis, T = S.T;
  for (let j = 0; j < q; j++) {
    const o = j * n;
    for (let i = 0; i < n; i++) T[o + i] = Q[o + i] * dis[i];
  }
  for (let i = 0; i < n; i++) {
    const row = i * n, di = dis[i];
    for (let j = 0; j < q; j++) {
      const o = j * n;
      let s = 0;
      for (let l = 0; l < n; l++) s += Wm[row + l] * T[o + l];
      Z[o + i] = s * di;
    }
  }
}

function orth(S, Q, q) {
  const n = N, r = S.r;
  for (let a = 0; a < q; a++) {
    const oa = a * n;
    for (let b = 0; b < a; b++) {
      const ob = b * n;
      let d = 0;
      for (let i = 0; i < n; i++) d += Q[oa + i] * Q[ob + i];
      for (let i = 0; i < n; i++) Q[oa + i] -= d * Q[ob + i];
    }
    let nn = 0;
    for (let i = 0; i < n; i++) nn += Q[oa + i] * Q[oa + i];
    if (nn < 1e-20) {
      for (let i = 0; i < n; i++) Q[oa + i] = r() - 0.5;
      a--;
      continue;
    }
    nn = 1 / sqrt(nn);
    for (let i = 0; i < n; i++) Q[oa + i] *= nn;
  }
}

// eigenvectors of a small symmetric matrix by Jacobi rotations; the columns of V
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
        const th = (A[q * n + q] - A[p * n + p]) / (2 * apq);
        const t = (th >= 0 ? 1 : -1) / (abs(th) + sqrt(th * th + 1)), c = 1 / sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k * n + p], akq = A[k * n + q];
          A[k * n + p] = c * akp - s * akq;
          A[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p * n + k], aqk = A[q * n + k];
          A[p * n + k] = c * apk - s * aqk;
          A[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k * n + p], vkq = V[k * n + q];
          V[k * n + p] = c * vkp - s * vkq;
          V[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }
}

// the inverse of a small matrix by Gauss-Jordan; false when it is singular
const GJ = new Float64Array(2 * KMAX * KMAX * 2);
function inverse(A, k, out) {
  const w = 2 * k;
  for (let i = 0; i < k; i++) for (let j = 0; j < w; j++) GJ[i * w + j] = j < k ? A[i * k + j] : j - k === i ? 1 : 0;
  for (let c = 0; c < k; c++) {
    let p = c, best = abs(GJ[c * w + c]);
    for (let i = c + 1; i < k; i++) if (abs(GJ[i * w + c]) > best) ((best = abs(GJ[i * w + c])), (p = i));
    if (best < 1e-12) return false;
    if (p !== c) for (let j = 0; j < w; j++) { const t = GJ[c * w + j]; GJ[c * w + j] = GJ[p * w + j]; GJ[p * w + j] = t; }
    const d = 1 / GJ[c * w + c];
    for (let j = 0; j < w; j++) GJ[c * w + j] *= d;
    for (let i = 0; i < k; i++) {
      if (i === c) continue;
      const f = GJ[i * w + c];
      if (f === 0) continue;
      for (let j = 0; j < w; j++) GJ[i * w + j] -= f * GJ[c * w + j];
    }
  }
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) out[i * k + j] = GJ[i * w + k + j];
  return true;
}

// the orthogonal factor of a small square matrix (Newton's iteration, scaled), into X
const XI = new Float64Array(KMAX * KMAX);
function polar(A, k, X) {
  const kk = k * k;
  for (let i = 0; i < kk; i++) X[i] = A[i];
  for (let i = 0; i < k; i++) X[i * k + i] += 1e-3;
  for (let it = 0; it < 24; it++) {
    if (!inverse(X, k, XI)) break;
    let nx = 0, ni = 0;
    for (let i = 0; i < kk; i++) ((nx += X[i] * X[i]), (ni += XI[i] * XI[i]));
    const g = sqrt(sqrt(ni / nx)), gi = 1 / g;
    let df = 0;
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        const v = 0.5 * (g * X[a * k + b] + gi * XI[b * k + a]);
        df += (v - X[a * k + b]) * (v - X[a * k + b]);
        X[a * k + b] = v;
      }
    }
    if (df < 1e-14) break;
  }
}

// ------------------------------------------------------------ the state
export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const S = {
    r, t: 0, sc: 0, k: [0, 2, 0, 0.06], ready: false, A: null, B: null, hist: [], u: 0, tm: 0, md: 12, rot: TAU * r(),
    ph: [], grp: new Uint8Array(N), sv: new Float64Array(N), gx: new Float64Array(N), gy: new Float64Array(N),
    jr: new Float64Array(N), jw: new Float64Array(N), jp: new Float64Array(N),
    px: new Float64Array(N), py: new Float64Array(N),
    M: new Float32Array(N * N), dis: new Float64Array(N), dg: new Float64Array(N),
    Q: new Float64Array(N * QM), Z: new Float64Array(N * QM), T: new Float64Array(N * QM), Q2: new Float64Array(N * QM),
    kc: 3, ka: 3, kt: 0, lam: new Float64Array(QM), hasLb: false, kPrev: 0,
    Y: new Float64Array(N * KMAX), Yp: new Float64Array(N * KMAX), hasYp: false,
    C: new Float64Array(KMAX * KMAX), hasC: false, lb: new Uint8Array(N),
    dx: new Float64Array(N), dy: new Float64Array(N), cr: new Float64Array(N), cg: new Float64Array(N), cb: new Float64Array(N),
    vx: new Float64Array(KMAX), vy: new Float64Array(KMAX), cxl: new Float64Array(KMAX), cyl: new Float64Array(KMAX), sig: 0.075,
  };
  for (let i = 0; i < 40; i++) S.ph.push(TAU * r());
  for (let g = 0; g < NG; g++) {
    for (let j = 0; j < PER; j++) {
      const i = g * PER + j;
      S.grp[i] = g;
      S.sv[i] = (j + 0.15 + 0.7 * r()) / PER;
      const u1 = max(r(), 1e-9), u2 = r(), m = sqrt(-2 * log(u1));
      S.gx[i] = m * cos(TAU * u2);
      S.gy[i] = m * sin(TAU * u2);
      S.jr[i] = 0.01 + 0.022 * r();
      S.jw[i] = 0.35 + 1.1 * r();
      S.jp[i] = TAU * r();
    }
  }
  params.s = S;
}

const BL = [0, 0, 0, 0, 0, 0, 0];
const PB = [[], [], [], []];
// the data cloud at scene clock S.sc
function place(S) {
  const t = S.sc, u = S.u, A = S.A, B = S.B, ph = S.ph;
  const spread = 1 + 0.26 * sin(0.113 * t + ph[0]) + 0.1 * sin(0.0617 * t + ph[1]);
  const scl = 1 + 0.035 * sin(0.0791 * t + ph[2]);
  for (let g = 0; g < NG; g++) {
    const a = A[g], b = B[g], q = PB[g], p = 3 + g * 5;
    q[0] = lerp(a[0], b[0], u) * spread + 0.04 * sin(0.31 * t + ph[p]);
    q[1] = lerp(a[1], b[1], u) * spread + 0.04 * sin(0.27 * t + ph[p + 1]);
    q[2] = lerp(a[2], b[2], u) * (1 + 0.04 * sin(0.23 * t + ph[p + 2]));
    q[3] = lerp(a[3], b[3], u) * (1 + 0.04 * sin(0.23 * t + ph[p + 2]));
    q[4] = lerp(a[4], b[4], u) + 0.1 * sin(0.19 * t + ph[p + 3]);
    q[5] = lerp(a[5], b[5], u);
    q[6] = lerp(a[6], b[6], u) * (1 + 0.2 * sin(0.17 * t + ph[p + 4]));
  }
  const cr = cos(S.rot), sr = sin(S.rot);
  for (let i = 0; i < N; i++) {
    const q = PB[S.grp[i]], s = S.sv[i], an = q[4] + q[5] * s, rr = q[2] + (q[3] - q[2]) * s;
    let x = q[0] + rr * cos(an) + q[6] * S.gx[i], y = q[1] + rr * sin(an) + q[6] * S.gy[i];
    const ja = S.jw[i] * S.t + S.jp[i];
    x += S.jr[i] * cos(ja);
    y += S.jr[i] * sin(ja);
    x *= scl;
    y *= scl;
    const m = sqrt(x * x + y * y);
    if (m > 1) ((x *= 1 / m), (y *= 1 / m)); // nothing leaves the unit disc
    S.px[i] = x * cr - y * sr;
    S.py[i] = x * sr + y * cr;
  }
}

function affinity(S, sig) {
  const n = N, M = S.M, x = S.px, y = S.py, deg = S.dg, inv = 1 / (2 * sig * sig);
  deg.fill(1);
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], row = i * n;
    M[row + i] = 1;
    for (let j = i + 1; j < n; j++) {
      const dx = xi - x[j], dy = yi - y[j], q = (dx * dx + dy * dy) * inv, w = q > 13 ? 0 : exp(-q);
      M[row + j] = w;
      M[j * n + i] = w;
      deg[i] += w;
      deg[j] += w;
    }
  }
  for (let i = 0; i < n; i++) S.dis[i] = 1 / sqrt(deg[i]);
}

const HM = new Float64Array(QM * QM), HV = new Float64Array(QM * QM);
// sweeps of subspace iteration, then Rayleigh-Ritz: the columns of S.Q are the leading eigenvectors in order
function eigen(S, sweeps) {
  const n = N, q = QM, Q = S.Q, Z = S.Z;
  for (let s = 0; s < sweeps; s++) {
    mulM(S, Q, Z, q);
    Q.set(Z.subarray(0, n * q));
    orth(S, Q, q);
  }
  mulM(S, Q, Z, q);
  for (let a = 0; a < q; a++) {
    for (let b = a; b < q; b++) {
      let d = 0;
      for (let i = 0; i < n; i++) d += Q[a * n + i] * Z[b * n + i];
      HM[a * q + b] = d;
      HM[b * q + a] = d;
    }
  }
  jacobi(HM, q, HV);
  const idx = [];
  for (let i = 0; i < q; i++) idx.push(i);
  idx.sort((a, b) => HM[b * q + b] - HM[a * q + a]);
  const Q2 = S.Q2;
  for (let c = 0; c < q; c++) {
    const col = idx[c];
    S.lam[c] = HM[col * q + col];
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (let b = 0; b < q; b++) d += Q[b * n + i] * HV[b * q + col];
      Q2[c * n + i] = d;
    }
  }
  Q.set(Q2.subarray(0, n * q));
}

const MA = new Float64Array(KMAX * KMAX), RA = new Float64Array(KMAX * KMAX), CN = new Float64Array(KMAX * KMAX), RD2 = new Float64Array(KMAX * KMAX);
function embed(S) {
  const n = N, k = S.kc, Q = S.Q, Y = S.Y, Yp = S.Yp;
  for (let i = 0; i < n; i++) {
    let nn = 0;
    for (let c = 0; c < k; c++) nn += Q[c * n + i] * Q[c * n + i];
    nn = 1 / (sqrt(nn) + 1e-12);
    for (let c = 0; c < k; c++) Y[i * k + c] = Q[c * n + i] * nn;
  }
  // the turn that lays this frame's embedding over the last one: no flips, no spin
  if (S.hasYp) {
    MA.fill(0);
    for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) MA[a * k + b] += Y[i * k + a] * Yp[i * k + b];
    polar(MA, k, RA);
    const tmp = S.Z;
    for (let i = 0; i < n; i++) {
      for (let b = 0; b < k; b++) {
        let d = 0;
        for (let a = 0; a < k; a++) d += Y[i * k + a] * RA[a * k + b];
        tmp[b] = d;
      }
      for (let b = 0; b < k; b++) Y[i * k + b] = tmp[b];
    }
  }
  Yp.set(Y.subarray(0, n * k));
  S.hasYp = true;
}

function kmeans(S, iters) {
  const n = N, k = S.kc, Y = S.Y, C = S.C, lb = S.lb;
  if (!S.hasC) {
    // the clusters keep their labels across a change of k: seed from the points each held, then farthest first
    const sum0 = new Float64Array(k * k), cnt0 = new Float64Array(k);
    let have = 0;
    if (S.hasLb) {
      for (let i = 0; i < n; i++) {
        const l = lb[i];
        if (l >= k) continue;
        cnt0[l]++;
        for (let c = 0; c < k; c++) sum0[l * k + c] += Y[i * k + c];
      }
      while (have < k && cnt0[have] > 0) have++;
      for (let j = 0; j < have; j++) for (let c = 0; c < k; c++) C[j * k + c] = sum0[j * k + c] / cnt0[j];
    }
    const dm = new Float64Array(n).fill(1e9);
    const upd = (l) => {
      for (let i = 0; i < n; i++) {
        let d = 0;
        for (let c = 0; c < k; c++) d += (Y[i * k + c] - C[l * k + c]) * (Y[i * k + c] - C[l * k + c]);
        if (d < dm[i]) dm[i] = d;
      }
    };
    if (have === 0) {
      const f = floor(S.r() * n);
      for (let c = 0; c < k; c++) C[c] = Y[f * k + c];
      have = 1;
    }
    for (let j = 0; j < have; j++) upd(j);
    while (have < k) {
      let bi = 0, bd = -1;
      for (let i = 0; i < n; i++) if (dm[i] > bd) ((bd = dm[i]), (bi = i));
      for (let c = 0; c < k; c++) C[have * k + c] = Y[bi * k + c];
      upd(have);
      have++;
    }
    S.hasC = true;
    iters = 12;
  }
  const sum = new Float64Array(k * k), cnt = new Float64Array(k);
  for (let it = 0; it < iters; it++) {
    sum.fill(0);
    cnt.fill(0);
    for (let i = 0; i < n; i++) {
      let bj = 0, bd = 1e9;
      for (let j = 0; j < k; j++) {
        let d = 0;
        for (let c = 0; c < k; c++) d += (Y[i * k + c] - C[j * k + c]) * (Y[i * k + c] - C[j * k + c]);
        if (d < bd) ((bd = d), (bj = j));
      }
      lb[i] = bj;
      cnt[bj]++;
      for (let c = 0; c < k; c++) sum[bj * k + c] += Y[i * k + c];
    }
    for (let j = 0; j < k; j++) {
      if (cnt[j] === 0) {
        // an empty cluster is taken to the point farthest from every centroid
        let bi = 0, bd = -1;
        for (let i = 0; i < n; i++) {
          let m = 1e9;
          for (let l = 0; l < k; l++) {
            let d = 0;
            for (let c = 0; c < k; c++) d += (Y[i * k + c] - C[l * k + c]) * (Y[i * k + c] - C[l * k + c]);
            if (d < m) m = d;
          }
          if (m > bd) ((bd = m), (bi = i));
        }
        for (let c = 0; c < k; c++) C[j * k + c] = Y[bi * k + c];
      } else for (let c = 0; c < k; c++) C[j * k + c] = sum[j * k + c] / cnt[j];
    }
  }
  S.hasLb = true;
}

const CK = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
function slotHue(S, j, k) {
  const base = 0.5 + S.k[0];
  return base + (k === 2 ? 0.42 * j : j / k);
}
function recolor(S, d) {
  const n = N, k = S.kc, Y = S.Y, C = S.C;
  for (let j = 0; j < k; j++) pal(slotHue(S, j, k), 0.86, CK[j]);
  // each point takes the colours of the centroids by how near they are
  const inv = 1 / (2 * 0.36 * 0.36), a = 1 - exp(-d / 0.22);
  for (let i = 0; i < n; i++) {
    let ws = 0, r = 0, g = 0, b = 0;
    for (let j = 0; j < k; j++) {
      let dd = 0;
      for (let c = 0; c < k; c++) dd += (Y[i * k + c] - C[j * k + c]) * (Y[i * k + c] - C[j * k + c]);
      const w = exp(-dd * inv);
      ws += w;
      r += w * CK[j][0];
      g += w * CK[j][1];
      b += w * CK[j][2];
    }
    if (ws < 1e-9) ((r = g = b = 0.5), (ws = 1));
    S.cr[i] += (r / ws - S.cr[i]) * a;
    S.cg[i] += (g / ws - S.cg[i]) * a;
    S.cb[i] += (b / ws - S.cb[i]) * a;
  }
}

// where each point stands in the embedding picture: the cluster corners on a regular polygon
function layout(S, d, first) {
  const n = N, k = S.kc, Y = S.Y, C = S.C;
  for (let j = 0; j < k; j++) {
    let nn = 0;
    for (let c = 0; c < k; c++) nn += C[j * k + c] * C[j * k + c];
    nn = 1 / (sqrt(nn) + 1e-12);
    for (let c = 0; c < k; c++) CN[j * k + c] = C[j * k + c] * nn;
  }
  polar(CN, k, RD2);
  // R = RD2^T maps each centroid to its own axis
  const ang = [], vx = S.vx, vy = S.vy;
  let mx = 0, my = 0;
  for (let c = 0; c < k; c++) {
    const a = k === 2 ? -PI / 2 + (c ? 1 : -1) * (PI / 4) : -PI / 2 + (c * TAU) / k;
    vx[c] = cos(a);
    vy[c] = sin(a);
    mx += vx[c] / k;
    my += vy[c] / k;
  }
  let mr = 0;
  for (let c = 0; c < k; c++) {
    vx[c] -= mx;
    vy[c] -= my;
    mr = max(mr, sqrt(vx[c] * vx[c] + vy[c] * vy[c]));
  }
  for (let c = 0; c < k; c++) ((vx[c] /= mr), (vy[c] /= mr));
  // position = Y R (vx, vy), with R[b][c] = RD2[c][b]
  const px = new Float64Array(k), py = new Float64Array(k);
  for (let b = 0; b < k; b++) {
    for (let c = 0; c < k; c++) {
      px[b] += RD2[c * k + b] * vx[c];
      py[b] += RD2[c * k + b] * vy[c];
    }
  }
  const a = first ? 1 : 1 - exp(-d / 0.14);
  const cx = S.cxl, cy = S.cyl;
  for (let j = 0; j < k; j++) {
    let x = 0, y = 0;
    for (let b = 0; b < k; b++) ((x += C[j * k + b] * px[b]), (y += C[j * k + b] * py[b]));
    cx[j] = x;
    cy[j] = y;
  }
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0;
    for (let b = 0; b < k; b++) {
      x += Y[i * k + b] * px[b];
      y += Y[i * k + b] * py[b];
    }
    // the scatter round a cluster is drawn GAMMA times as wide as it is
    const l = S.lb[i];
    x = cx[l] + GAMMA * (x - cx[l]);
    y = cy[l] + GAMMA * (y - cy[l]);
    const m = sqrt(x * x + y * y);
    if (m > 1.04) ((x *= 1.04 / m), (y *= 1.04 / m));
    S.dx[i] += (x - S.dx[i]) * a;
    S.dy[i] += (y - S.dy[i]) * a;
  }
}

function tick(S, d, kv, first, adv) {
  const al = first ? 1 : 1 - exp(-d / 0.18);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  S.sig = 0.075 * exp(0.62 * (S.k[1] - 2));
  if (adv) {
    const speed = exp(1.1 * S.k[2]);
    S.t += d;
    S.sc += d * speed;
    S.rot += d * speed * 0.04;
    // the script of shapes: hold, morph, and a new scene made at random each time
    if (S.sc > S.tm + S.md) {
      S.A = S.B;
      newScene(S, nextId(S));
      S.tm = S.sc + 6 + 8 * S.r();
      S.md = 9 + 8 * S.r();
    }
    S.u = sm((S.sc - S.tm) / S.md);
  }
  place(S);
  affinity(S, S.sig);
  eigen(S, first ? 90 : 3);
  // the number of clusters: where the eigenvalues leave 1 by the biggest step (the eigengap), the knob adding or taking away cuts
  S.kt += d;
  let bk = 2, br = 0, rk = 0;
  for (let j = 2; j <= KMAX; j++) {
    const rj = (1 - S.lam[j] + GAPF) / (1 - S.lam[j - 1] + GAPF);
    if (rj > br) ((br = rj), (bk = j));
    if (j === S.ka) rk = rj;
  }
  if (first) S.ka = bk;
  else if (bk !== S.ka && br > 1.5 * rk && S.kt > 0.4) ((S.ka = bk), (S.kt = 0));
  const kn = cl(S.ka + Math.round(3 * S.k[3]), 2, KMAX);
  if (kn !== S.kc || first) {
    S.kPrev = S.kc;
    S.kc = kn;
    S.hasYp = false;
    S.hasC = false;
  }
  embed(S);
  kmeans(S, 2);
  recolor(S, first ? 100 : d);
  layout(S, d, first);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    for (let i = 0; i < N * QM; i++) S.Q[i] = S.r() - 0.5;
    orth(S, S.Q, QM);
    newScene(S, 6);
    S.A = S.B;
    newScene(S, nextId(S));
    S.tm = 16;
    S.md = 12;
    S.ready = true;
    // the opening is already settled: the eigenvectors, the clusters and the colours have run for a second
    tick(S, 1 / 30, kv, true, false);
    for (let i = 0; i < 36; i++) tick(S, 1 / 30, kv, false, false);
  }
  tick(S, d, kv, false, true);
}

// ------------------------------------------------------------ drawing
const AA = new Float32Array(W * H), AR = new Float32Array(W * H), AG = new Float32Array(W * H), AB = new Float32Array(W * H);
const DR = new Float32Array(W * H), DG = new Float32Array(W * H), DB = new Float32Array(W * H);

function disc(x, y, r, g, b, a, sg) {
  const x0 = floor(x - 0.5) - 2, y0 = floor(y - 0.5) - 2, inv = 1 / (2 * sg * sg), nn = ceil(sg * 3) + 3;
  for (let j = 0; j < nn; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= H) continue;
    const ey = yy + 0.5 - y;
    for (let i = 0; i < nn; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= W) continue;
      const ex = xx + 0.5 - x, w = a * exp(-(ex * ex + ey * ey) * inv), p = yy * W + xx;
      AA[p] += w;
      AR[p] += w * r;
      AG[p] += w * g;
      AB[p] += w * b;
    }
  }
}

// a thin ring, 1.6 LED wide, added to the decoration layer
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

// the haze is made at half size: points are splatted on a 32 by 64 grid, blurred, and read back bilinearly
const HW = W / 2, HHT = H / 2, KH = 4, KG = new Float32Array(2 * KH + 1), TMP = new Float32Array(HW * HHT);
{
  let t = 0;
  for (let i = -KH; i <= KH; i++) t += KG[i + KH] = exp(-(i * i) / (2 * 1.25 * 1.25));
  for (let i = 0; i < KG.length; i++) KG[i] /= t;
}
function blur(A) {
  for (let y = 0; y < HHT; y++) {
    for (let x = 0; x < HW; x++) {
      let s = 0;
      for (let i = -KH; i <= KH; i++) {
        const xx = x + i;
        if (xx >= 0 && xx < HW) s += A[y * HW + xx] * KG[i + KH];
      }
      TMP[y * HW + x] = s;
    }
  }
  for (let y = 0; y < HHT; y++) {
    for (let x = 0; x < HW; x++) {
      let s = 0;
      for (let i = -KH; i <= KH; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < HHT) s += TMP[yy * HW + x] * KG[i + KH];
      }
      A[y * HW + x] = s;
    }
  }
}
function splat(x, y, r, g, b, k) {
  x = x / 2;
  y = y / 2;
  const xi = floor(x - 0.5), yi = floor(y - 0.5), fx = x - 0.5 - xi, fy = y - 0.5 - yi;
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      const xx = xi + i, yy = yi + j;
      if (xx < 0 || xx >= HW || yy < 0 || yy >= HHT) continue;
      const w = k * (i ? fx : 1 - fx) * (j ? fy : 1 - fy), p = yy * HW + xx;
      HR[p] += r * w;
      HG[p] += g * w;
      HB[p] += b * w;
    }
  }
}
const HR = new Float32Array(HW * HHT), HG = new Float32Array(HW * HHT), HB = new Float32Array(HW * HHT);
// the haze at LED (x, y), bilinear
function haze(A, x, y) {
  const u = (x + 0.5) / 2 - 0.5, v = (y + 0.5) / 2 - 0.5, xi = floor(u), yi = floor(v), fx = u - xi, fy = v - yi;
  const x0 = cl(xi, 0, HW - 1), x1 = cl(xi + 1, 0, HW - 1), y0 = cl(yi, 0, HHT - 1), y1 = cl(yi + 1, 0, HHT - 1);
  return (A[y0 * HW + x0] * (1 - fx) + A[y0 * HW + x1] * fx) * (1 - fy) + (A[y1 * HW + x0] * (1 - fx) + A[y1 * HW + x1] * fx) * fy;
}

const TRC = [3 * PER / 4 | 0, PER + 20, 2 * PER + 31, 3 * PER + 8, PER + 44];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  AA.fill(0);
  AR.fill(0);
  AG.fill(0);
  AB.fill(0);
  DR.fill(0);
  DG.fill(0);
  DB.fill(0);
  HR.fill(0);
  HG.fill(0);
  HB.fill(0);
  ring2(CX, CYD, RR, 0.5, 0.6, 0.9, 0.2);
  ring2(CX, CYE, RR, 0.5, 0.6, 0.9, 0.2);
  const k = S.kc;
  for (let j = 0; j < k; j++) {
    pal(slotHue(S, j, k), 0.86, CK[j]);
    ring2(CX + S.vx[j] * RE, CYE + S.vy[j] * RE, 4.6, CK[j][0], CK[j][1], CK[j][2], 0.2);
  }
  for (let i = 0; i < N; i++) {
    const x1 = CX + S.px[i] * RD, y1 = CYD + S.py[i] * RD, x2 = CX + S.dx[i] * RE, y2 = CYE + S.dy[i] * RE;
    disc(x1, y1, S.cr[i], S.cg[i], S.cb[i], 0.9, 0.85);
    disc(x2, y2, S.cr[i], S.cg[i], S.cb[i], 0.5, 1.05);
    splat(x1, y1, S.cr[i], S.cg[i], S.cb[i], 0.3);
    splat(x2, y2, S.cr[i], S.cg[i], S.cb[i], 0.5);
  }
  // a few points are followed: a pale ring round each in both views
  for (let m = 0; m < TRC.length; m++) {
    const i = TRC[m], x1 = CX + S.px[i] * RD, y1 = CYD + S.py[i] * RD, x2 = CX + S.dx[i] * RE, y2 = CYE + S.dy[i] * RE;
    ring2(x1, y1, 3.3, 0.8, 0.8, 0.85, 0.6);
    ring2(x2, y2, 3.3, 0.8, 0.8, 0.85, 0.6);
  }
  blur(HR);
  blur(HG);
  blur(HB);
  const G = 1.4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, a = AA[p];
      let r = 0.01 + DR[p] + haze(HR, x, y), g = 0.014 + DG[p] + haze(HG, x, y), b = 0.03 + DB[p] + haze(HB, x, y);
      if (a > 1e-4) {
        const t = 1 - exp(-G * a), f = t / a;
        r += AR[p] * f;
        g += AG[p] * f;
        b += AB[p] * f;
      }
      const m = max(r, g, b);
      if (m > 0.85) {
        const f = (0.85 + (1 - 0.85) * (1 - exp(-(m - 0.85) / 0.15))) / m;
        r *= f;
        g *= f;
        b *= f;
      }
      display.setPixel(x, y, min(255, (r * 255) | 0), min(255, (g * 255) | 0), min(255, (b * 255) | 0));
    }
  }
}
