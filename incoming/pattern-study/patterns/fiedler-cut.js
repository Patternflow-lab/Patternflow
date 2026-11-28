// ===== Patternflow pattern =====
// Title:   Fiedler Cut
// Family:  spectralcut
// Idea:    Beads drift as rings, crescents, spiral arms and blobs that morph into one another in the top disc, and in the disc below the same beads stand where the leading eigenvectors of their Gaussian-affinity graph put them, so a tangle of shapes falls apart into separate blobs of the same colours when the bandwidth is right, and smears or merges when it is not.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the second eigenvector of a graph Laplacian, which tells where to cut a graph (Miroslav Fiedler, 1973, from memory), the normalised cut (Jianbo Shi and Jitendra Malik, 2000, from memory), spectral clustering with the top k eigenvectors, rows scaled to length 1, then k-means (Andrew Ng, Michael Jordan and Yair Weiss, 2001, from memory), the eigengap rule for k (Ulrike von Luxburg's tutorial, 2007, from memory), orthogonal iteration with a Rayleigh-Ritz step; the script of shapes, the polygon and the light are original, pattern round 273
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Reach=0..4, Morph=-1..1, Cuts=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of every cluster, one turn over the range. The k hues are 1/k of a turn apart (0.42 for two) and the first is cyan at 0, so the opening three are cyan, magenta and yellow; at 0.25 they are violet-blue, orange and green, at 0.5 red, green and blue. A drift rides on it, 0.20 of a turn on a 295 s sine plus 0.12 on a 122 s one, both starting at 0, so a colour does not come back to the same place.
// Knob 2: Reach. The bandwidth sigma of the affinity, in data units where 1 is the radius of the top disc (28 LEDs): 0.075 exp(0.62 (K - 2)), which is 0.022 at 0, 0.040 at 1, 0.075 at the opening 2, 0.139 at 3 and 0.259 at 4, or 0.6, 1.1, 2.1, 3.9 and 7.3 LEDs. Over 5 min the cut found the drawn curves (every cluster and every curve 95 percent pure) in 32 percent of the held frames at 0, 72 at 1, 86 at 2, 61 at 3 and 25 at 4. Small sigma tears a ring into arcs and the embedding fills with four or five scattered clusters; large sigma lets two shapes into one cluster and the embedding shrinks to a line.
// Knob 3: Morph. The speed of the script and of everything that moves, exp(1.1 K): 0.33 at -1, 1 at the opening 0, 3 at 1. In 5 min 5 scenes came at -1, 14 at 0 and 40 at 1. The turn of the cloud (0.04 rad/s at speed 1), the orbits of the beads, the drift of the hues and the turn of the polygon below follow it.
// Knob 4: Cuts. How many clusters the cut makes, as an offset to the eigengap's choice: k = clamp(k_gap + round(3 K), 2, 5). At 0 the gap decides (2 clusters in 51 percent of the frames at the opening reach, 3 in 48, 4 in 2); at -1 it is always 2, at 0.5 it is 4 or 5, at 1 it is 5. Too few cuts put two shapes in one colour, too many split a ring into arcs.
//
// What the picture is. A graph has a node for each bead and a weight exp(-d^2 / 2 sigma^2) on each pair, d being their distance in the top disc. With the weights W and the degrees D, M = D^-1/2 W D^-1/2 has its largest eigenvalue 1, and a graph of k pieces that hardly touch has k eigenvalues near 1 whose eigenvectors are, up to a turn of the axes, indicators of the pieces. That is why one eigenvector tells where to cut (Fiedler), and why a ring round a ring, which k-means in the plane cannot part, becomes two points. The top disc is the data. In the bottom disc each bead stands by its row of the leading k eigenvectors, scaled to length 1, in the colour the cut gives it. Where the shapes are far enough apart for sigma, a shape's beads sit on one corner of a regular polygon; where not, they lie between.
// The numbers. 220 beads, 55 to each of four slots. Every frame weighs the 24 090 pairs (W_ii = 1, so the kernel stays positive definite) and follows the 8 leading eigenvectors of M by orthogonal iteration, 3 sweeps a frame warm-started from the last (90 at the opening), with a Rayleigh-Ritz step on the 8 by 8 matrix to put them in order. k_gap is where 1 - lambda leaves 0 by the biggest ratio among k = 2 to 5 (floored at 1e-5), changed only when the new ratio is 1.5 times the old one and 0.4 s have passed. At the opening the three clusters stand at 1 - lambda from 1e-7 to 1e-5 and the ring's first harmonic at 2.5e-3, a ratio of 100 to 200. k-means starts each frame from the means of the last frame's clusters, so a cluster keeps its colour, with 2 Lloyd steps. Node measures 2.2 ms for the update and 0.5 for the drawing.
// The shapes. Seven scenes: a ring round two facing arcs (the opening), nested rings, two crescents, three blobs, a pair of spirals, a ring round two blobs, two parallel arcs. Each is four pieces that hold 55 beads for good, so a bead lies on a ring in one scene and in a blob in the next. A scene is mirrored, turned and its slots shuffled at random; its gaps are 0.35 to 0.5 data units, so the cut can work at the opening sigma. A scene is held for 6 to 14 s and then morphs for 9 to 17 s (at speed 1), blending the pieces' parameters and never the beads, so a ring closes to a blob or opens to an arc on the way; the first hold is 16 s, the next scene is none of the last three. Curves wander in centre, radius and scatter, scenes breathe in spread, and each bead orbits 0.01 to 0.032 units. At the opening the cut found the curves in 86 percent of the held frames and 37 of the morphing ones, where the shapes are between two scenes.
// What is exact and what is drawn. The affinity, the matrix, its leading eigenvectors, the unit rows, k-means and the eigengap rule are the method (Ng, Jordan and Weiss zero the diagonal of W; this keeps it at 1). The polygon, the mix of corners by the distance to each centroid, the scatter about a corner drawn 1.8 times as wide as it is, the orbit of 0.7 LED, the turn of the polygon, the hue drift, the soft discs, the two framing rings and the deep blue ground are drawing choices. It opens after a pre-run of 90 sweeps and 36 frames, so the first picture already shows the cut.

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
// A piece is [cx, cy, r0, r1, a0, span, th, curve]: a spiral arc round (cx, cy), radius r0 to r1 as the angle
// runs from a0 through span, th the scatter across it; a blob has no radius. A scene has NG pieces, one for each slot.
const sp = (cx, cy, r0, r1, a0, span, th) => [cx, cy, r0, r1, a0, span, th, 0];
const blob = (cx, cy, th) => [sp(cx, cy, 0, 0, 0, 0, th)];
function halves(p) {
  const rm = (p[2] + p[3]) / 2, h = p[5] / 2;
  return [[p[0], p[1], p[2], rm, p[4], h, p[6], 0], [p[0], p[1], rm, p[3], p[4] + h, h, p[6], 0]];
}
const ring = (cx, cy, r, th, a0, span) => halves(sp(cx, cy, r, r, a0 || 0, span || TAU, th));
const arc = (cx, cy, r, a0, span, th) => [sp(cx, cy, r, r, a0, span, th)];
// A scene is a list of curves, each of one or two pieces, a curve listed twice being heavier: a ring round two facing arcs, nested
// rings, two moons, three blobs, a spiral pair, a ring round two blobs, two parallel arcs
const ARCH = [
  (J, o) => { const rc = J(0.42, 0.1), sa = J(1, 0.1), d = J(0.03, 0.5), y = o(0.12); return [ring(0, 0, J(0.92, 0.03), 0.02), arc(d, y, rc, PI - sa, 2 * sa, 0.025), arc(-d, -y, rc, -sa, 2 * sa, 0.025)]; },
  (J, o) => [ring(o(0.1), o(0.1), J(0.9, 0.04), 0.02), ring(o(0.1), o(0.1), J(0.42, 0.1), 0.02)],
  (J, o) => { const R = J(0.6, 0.04), dx = J(0.3, 0.06), dy = J(0.07, 0.25), t = J(0.03, 0.2); return [ring(-dx, dy, R, t, PI, PI), ring(dx, -dy, R, t, 0, PI)]; },
  (J, o, r) => { const a = TAU * r(), R = J(0.55, 0.1), t = J(0.13, 0.15), c = [0, 1, 2].map((i) => blob(R * cos(a + (i * TAU) / 3), R * sin(a + (i * TAU) / 3), t)); return [...c, c[floor(r() * 3)]]; },
  (J, o, r) => { const a = TAU * r(), s2 = J(1.5 * PI, 0.08), r1 = J(0.94, 0.03); return [halves(sp(0, 0, 0.18, r1, a, s2, 0.02)), halves(sp(0, 0, 0.18, r1, a + PI, s2, 0.02))]; },
  (J, o) => { const d = J(0.32, 0.15), t = J(0.1, 0.2); return [ring(0, 0, J(0.9, 0.04), 0.02), blob(-d, o(0.1), t), blob(d, o(0.1), t)]; },
  (J, o) => { const R = J(1.2, 0.1), sg = J(0.5, 0.12), g = J(0.5, 0.12), t = J(0.025, 0.2); return [ring(0, -g / 2 + R * 0.6, R, t, -PI / 2 - sg, 2 * sg), ring(0, g / 2 + R * 0.6, R, t, -PI / 2 - sg, 2 * sg)]; },
];

function build(S, id) {
  const r = S.r, J = (v, f) => v * (1 + f * (2 * r() - 1)), o = (f) => (r() - 0.5) * f, cs = ARCH[id](J, o, r), seen = [], P = [];
  for (const c of cs) {
    let k = seen.indexOf(c);
    if (k < 0) k = seen.push(c) - 1;
    for (const p of c) P.push(p.slice(0, 7).concat(k));
  }
  // a mirror, a turn and a shuffle of the slots
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
  let id = 0;
  if (S.B) do id = floor(S.r() * ARCH.length); while (S.hist.indexOf(id) >= 0);
  S.A = S.B;
  S.B = build(S, id);
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
  if (S.hist.length > 3) S.hist.shift();
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
    r, t: 0, sc: 0, k: [0, 2, 0, 0.06], ready: false, A: null, B: null, hist: [], u: 0, tm: 16, md: 12, rot: TAU * r(),
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
    S.ux[i] = sqrt(r()) * cos(TAU * r());
    S.uy[i] = sqrt(r()) * sin(TAU * r());
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
// k-means from the means of the last frame's clusters, so a cluster keeps its label and colour; an emptied one
// is taken to the point farthest from the rest
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
// the hues drift a little, slowly and never back (a sum of two sines that do not divide)
const slotHue = (S, j, k) => 0.5 + S.k[0] + 0.2 * sin(0.0213 * S.t) + 0.12 * (1 - cos(0.0517 * S.t)) + (k === 2 ? 0.42 * j : j / k);
// The k corners of a regular polygon, one to a centroid. A point takes the colour of the centroids by how near they are,
// stands at the same mix of the corners, and is off it by its cluster's scatter, GAMMA times as wide. Both glide.
function show(S, d, first) {
  const n = N, k = S.kc, Y = S.Y, C = S.C, vx = S.vx, vy = S.vy, inv = 1 / (2 * 0.36 * 0.36);
  const a = first ? 1 : 1 - exp(-d / 0.2), e = first ? 1 : 1 - exp(-d / 0.14);
  let mx = 0, my = 0, mr = 0;
  for (let c = 0; c < k; c++) {
    const t = PI / 2 + 0.025 * S.t + 0.5 * sin(0.043 * S.t + S.ph[39]) + (k === 2 ? (c ? 1 : -1) * (PI / 4) : (c * TAU) / k);
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
    const sc = 0.045 + GAMMA * min(own, 0.1);
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
  // k: where the eigenvalues leave 1 by the biggest step, the knob adding or taking away cuts
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
    disc(x2, y2, r, g, b, 0.4, 0.95);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, a = AA[p], q = sqrt((x + 0.5 - CX) * (x + 0.5 - CX) + (y + 0.5 - (y < 64 ? CYD : CYE)) ** 2) / RR;
      const gd = 1 + 0.35 * (1 - sm(q * 1.05 - 0.1)) + (q < 1 ? 0.12 * q * q : 0); // a deep blue ground, a little lifted inside each ring
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
