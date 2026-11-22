// ===== Patternflow pattern =====
// Title:   Cremona Truss
// Family:  statics
// Idea:    A pin-jointed Warren truss spans the top of the panel while one to three loads wander along its chords, and below it, redrawn every frame, stands its Maxwell-Cremona reciprocal diagram, every member's force a segment parallel to the member and as long as the force, amber where the member pulls and blue where it pushes, so the diagram's polygons close joint by joint and reshape as the loads move.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: James Clerk Maxwell, "On reciprocal figures and diagrams of forces" (1864); Karl Culmann, Die graphische Statik (1864-66); Luigi Cremona, "Le figure reciproche nella statica grafica" (1872); Robert Bow's notation for the spaces between members (1873); pattern round 217
// Round:   219
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Depth=0..3, Roam=0..3, Skew=-1..1
//
// Knob 1: Hue. Turns both colour families round the wheel together, about 0.4 of a turn apart. At 0, where it opens, tension is amber to gold and compression is blue to cyan; the pair moves 0.78 of a turn over the knob, to rose for tension and green for compression at 1, and the weakest members stay a violet grey in every setting.
// Knob 2: Depth. The depth of the truss against its 56 LED span, 0.13 of it at 0 (7 LEDs, a shallow truss whose chords carry about 2 times a load at mid span, P L / 4 h, so its diagram runs wide and flat), 0.26 at 2 where it opens (14 LEDs) and 0.36 at 3 (20 LEDs, a deep truss whose chords carry 0.7 times it and whose diagonals stand steep, so its diagram is tall). The depth also breathes by up to 40 percent on three slow sines of 17.9, 37.3 and 61.1 s, never under 0.11 or over 0.38.
// Knob 3: Roam. How fast the loads wander and how many there are. A load moves at 0.375 panels of chord a second (3.5 LEDs) in the typical case at 0 and 2.06 panels (19 LEDs) at 3, its pace forgetting itself over 3 to 4 s, and it turns back 0.7 panel short of the chord's ends. The first load weighs 1. The second, up to 0.4 at 0 and 0.6 from 1.5, fades in and out and comes back on the top or the bottom chord each time; the third joins from 0.9 and weighs up to 0.4 from 1.9.
// Knob 4: Skew. Grades and leans the truss. At +1 the panels widen from left to right to 2.7 times the width, the top chord leans 0.38 of the depth to the right and the right support lifts 0.28 of the depth; at -1 it is the mirror. The diagonals then lie at different angles and carry very different forces, and the diagram loses its symmetry. At 0.06 where it opens the truss is nearly square, and every one of these also drifts by itself, with an arch or a sag of the top chord and a sway of each top joint on its own period. The deformations are taken back when a triangle of the truss would be narrower than 17 degrees.
//
// What the picture is. A truss of 6 Warren panels, 13 joints and 23 members is pinned at its left end and rolls on its right, so its 23 member
// forces and 3 reactions are fixed by the 26 joint equations alone. They are solved every frame by Gaussian elimination with partial pivoting,
// a load on a chord being shared by the two joints either side of it. Maxwell's reciprocal diagram has a point for every space: the 11
// triangles inside the truss and the 13 spaces round it that Bow's notation names between the outer forces. A member's force is the step from
// the point of the space on one side of it to the point of the space on the other, parallel to the member, tension one way and compression the
// other. Round any joint the steps close into a polygon, as the joint is in equilibrium, and the points are placed by walking from the top
// of the load line; the gap left on closing is about 1e-15 of a load. The outer forces make the vertical load line, the reactions marked on
// it in blue-silver. A member and its segment share a colour from the force over the biggest force, smoothed. The diagram is fitted to a
// 57 by 61 box and the fit smoothed over about 0.7 s, aiming 8 to 20 percent short so that it is never past the box. Every few seconds one
// member is picked out in white in both pictures with the two spaces beside it, a dot in the truss and a point in the diagram each, to read
// one against the other. The loads never sit still and the truss never keeps its shape, so no state of the picture comes round again.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, PI, abs, min, max, pow, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// ---- the truss: N panels of a Warren truss, bottom joints 0..N, top joints N+1..2N, no verticals
const N = 6;
const NJ = 2 * N + 1; // joints
const NM = 4 * N - 1; // members; members + 3 reactions = 2 x joints
const NF = 4 * N; // faces: 2N-1 triangles inside and 2N+1 spaces outside, Bow's notation
const NU = NM + 3; // unknowns of the joint equations
const NE = NM + 2 * N + 1; // edges of the force diagram: a member each and an outer force each
const NR = 2 * N; // right-hand sides solved together: the loads as they are, then a unit load on each top joint and on each bottom joint but the supports

// periods, in seconds, of the sway of each top joint along the chord and up and down
const TOPX = [29.3, 41.9, 23.1, 53.7, 19.9, 35.3];
const TOPY = [37.1, 21.7, 47.9, 27.7, 59.3, 17.3];
const AMIN = 17; // degrees
const EDGE = 0.7; // a load on the top chord keeps this many panels from its ends, where it would only load the end diagonal
const SPAN = 56; // the bottom chord, LEDs
const XL = 4; // left support, LEDs from the panel's left edge
const YB = 49; // the lowest joint's row
const BX = 32, BY = 96, BW = 57, BH = 61; // the box the diagram is fitted into
const SLACK = 0.92; // the smoothed scale aims short of the box, further the faster the loads go, so a diagram that grows a little faster than it follows still fits

// faces: U(i) the triangle on bottom panel i, D(i) the inverted one at bottom joint i, O(k) the k-th outer space clockwise from the left end
const U = (i) => i;
const D = (i) => N + i - 1;
const O = (k) => 2 * N - 1 + k;

const ma = new Int16Array(NM), mb = new Int16Array(NM), ml = new Int16Array(NM), mr = new Int16Array(NM);
{
  // a member runs a to b; its left face is the one on the left looking from a to b
  for (let i = 0; i < N; i++) {
    // bottom chord i
    ma[i] = i; mb[i] = i + 1; ml[i] = U(i); mr[i] = O(2 * N - i);
    // left diagonal i, bottom joint i up to top joint i
    const l = 2 * N - 1 + i;
    ma[l] = i; mb[l] = N + 1 + i; ml[l] = i === 0 ? O(0) : D(i); mr[l] = U(i);
    // right diagonal i, top joint i down to bottom joint i+1
    const r = 3 * N - 1 + i;
    ma[r] = N + 1 + i; mb[r] = i + 1; ml[r] = i === N - 1 ? O(N) : D(i + 1); mr[r] = U(i);
  }
  for (let i = 0; i < N - 1; i++) {
    // top chord i
    const c = N + i;
    ma[c] = N + 1 + i; mb[c] = N + 2 + i; ml[c] = O(1 + i); mr[c] = D(i + 1);
  }
}
// the joint of the k-th outer force, going clockwise: left support, the top joints, the right support, the bottom joints back to the left
const ej = new Int16Array(2 * N + 1);
for (let k = 0; k <= 2 * N; k++) ej[k] = k === 0 ? 0 : k <= N ? N + k : 2 * N + 1 - k;
// the member on the outside of which outer space k lies
const om = new Int16Array(2 * N + 1);
om[0] = 2 * N - 1;
for (let i = 0; i < N - 1; i++) om[1 + i] = N + i;
om[N] = 4 * N - 2;
for (let i = 0; i < N; i++) om[2 * N - i] = i;

// the edges of the force diagram: edge e runs from face ef[e] to face et[e] and adds a vector to get there
const ef = new Int16Array(NE), et = new Int16Array(NE);
for (let e = 0; e < NM; e++) (ef[e] = ml[e]), (et[e] = mr[e]);
for (let k = 0; k <= 2 * N; k++) (ef[NM + k] = O((k + 2 * N) % (2 * N + 1))), (et[NM + k] = O(k));
// a spanning tree of the faces from O(0), kept as the order the faces are placed in
const TC = [], TP = [], TE = [], TS = [];
{
  const adj = [];
  for (let f = 0; f < NF; f++) adj.push([]);
  for (let e = 0; e < NE; e++) (adj[ef[e]].push(e), adj[et[e]].push(e));
  const seen = new Uint8Array(NF);
  const q = [O(0)];
  seen[O(0)] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const f = q[qi];
    for (const e of adj[f]) {
      const g = ef[e] === f ? et[e] : ef[e];
      if (seen[g]) continue;
      seen[g] = 1;
      TC.push(g); TP.push(f); TE.push(e); TS.push(ef[e] === f ? 1 : -1);
      q.push(g);
    }
  }
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function randn() {
  let a = Math.random();
  if (a < 1e-9) a = 1e-9;
  return sqrt(-2 * log(a)) * cos(TAU * Math.random());
}

function makeState() {
  const loads = [];
  for (let i = 0; i < 3; i++)
    loads.push({
      u: EDGE + Math.random() * (N - 1 - 2 * EDGE), // where along the top chord, in panels from its left end
      v: (Math.random() - 0.5) * 0.6,
      tau: [3.4, 2.7, 4.1][i], // how long its velocity remembers itself
      vs: [1, 1.15, 0.85][i], // its speed against the others
      a: 0, // its force
      side: 0, // on the top chord or the bottom one
      dead: false,
      ph: Math.random() * TAU,
    });
  return {
    t: 0, ready: false,
    loads,
    ph: [0, 0, 0, 0, 0, 0, 0, 0].map(() => Math.random() * TAU),
    jph: new Float64Array(2 * N).map(() => Math.random() * TAU),
    kn: [0, 2, 0, 0.06],
    jx: new Float64Array(NJ), jy: new Float64Array(NJ), // joints, y up
    sx: new Float64Array(NJ), sy: new Float64Array(NJ), // joints on the panel
    lf: new Float64Array(NJ), // load at each joint, downwards
    A: new Float64Array(NU * (NU + NR)),
    Tq: new Float64Array(NM), qx: new Float64Array(NF), qy: new Float64Array(NF),
    T: new Float64Array(NM), // member forces, tension positive
    ux: new Float64Array(NM), uy: new Float64Array(NM),
    px: new Float64Array(NF), py: new Float64Array(NF), // the vertices of the force diagram
    vx: new Float64Array(NE), vy: new Float64Array(NE),
    fenv: 1, sc: 1, cx: 0, cy: 0, dsc: 1, dcx: 0, dcy: 0,
    ord: new Int16Array(NM),
    hl: -1, hlt: 0, hld: 2.5, hln: 1.2,
    lx: new Float64Array(3), ly: new Float64Array(3), // where each load sits on the panel
    res: 0, depth: 0.26, lam: 1, w: new Float64Array(N), bx: new Float64Array(N + 1),
    fb: new Float32Array(W * H * 3),
  };
}

export function setup(params) {
  params.s = makeState();
}

// ---- Gaussian elimination with partial pivoting on the joint equations, for the loads as they are and for a unit load on each top joint at once
function solve(S) {
  const A = S.A, n = NU, st = n + NR;
  A.fill(0);
  for (let e = 0; e < NM; e++) {
    const a = ma[e], b = mb[e];
    const dx = S.jx[b] - S.jx[a], dy = S.jy[b] - S.jy[a];
    const len = sqrt(dx * dx + dy * dy) || 1e-9;
    const ux = dx / len, uy = dy / len;
    S.ux[e] = ux; S.uy[e] = uy;
    A[2 * a * st + e] += ux; A[(2 * a + 1) * st + e] += uy;
    A[2 * b * st + e] -= ux; A[(2 * b + 1) * st + e] -= uy;
  }
  A[0 * st + NM] = 1; // the left support's horizontal reaction
  A[1 * st + NM + 1] = 1; // its vertical one
  A[(2 * N + 1) * st + NM + 2] = 1; // the right support's vertical one
  for (let j = 0; j < NJ; j++) A[(2 * j + 1) * st + n] = S.lf[j];
  for (let k = 1; k <= N; k++) A[(2 * (N + k) + 1) * st + n + k] = 1;
  for (let k = 1; k < N; k++) A[(2 * k + 1) * st + n + N + k] = 1;
  const nc = n + NR;
  for (let c = 0; c < n; c++) {
    let p = c, best = abs(A[c * st + c]);
    for (let r = c + 1; r < n; r++) {
      const v = abs(A[r * st + c]);
      if (v > best) (best = v), (p = r);
    }
    if (best < 1e-9) return false;
    if (p !== c)
      for (let k = c; k < nc; k++) {
        const tmp = A[c * st + k];
        A[c * st + k] = A[p * st + k];
        A[p * st + k] = tmp;
      }
    const inv = 1 / A[c * st + c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r * st + c] * inv;
      if (f === 0) continue;
      for (let k = c; k < nc; k++) A[r * st + k] -= f * A[c * st + k];
    }
  }
  for (let q = n; q < nc; q++)
    for (let r = n - 1; r >= 0; r--) {
      let s = A[r * st + q];
      for (let k = r + 1; k < n; k++) s -= A[r * st + k] * A[k * st + q];
      A[r * st + q] = s / A[r * st + r];
      if (!isFinite(A[r * st + q])) return false;
    }
  return true;
}

// ---- the reciprocal diagram of one solved load case: a member's force is the step from the space on its left to the space on its right
// Returns the biggest member force; px and py get the vertex of each space, the top of the load line at the origin.
function diagram(S, q, T, px, py) {
  const st = NU + NR, c = NU + q, A = S.A, vx = S.vx, vy = S.vy;
  let fm = 0;
  for (let e = 0; e < NM; e++) {
    T[e] = A[e * st + c];
    fm = max(fm, abs(T[e]));
    vx[e] = T[e] * S.ux[e];
    vy[e] = T[e] * S.uy[e];
  }
  for (let k = 0; k <= 2 * N; k++) {
    const j = ej[k];
    let fx = 0, fy = 0;
    if (j === 0) (fx = A[NM * st + c]), (fy = A[(NM + 1) * st + c]);
    else if (j === N) fy = A[(NM + 2) * st + c];
    else fy = -(q === 0 ? S.lf[j] : q <= N ? (j === N + q ? 1 : 0) : j === q - N ? 1 : 0);
    vx[NM + k] = fx;
    vy[NM + k] = fy;
  }
  px[O(0)] = 0; py[O(0)] = 0;
  for (let i = 0; i < TC.length; i++) {
    const cc = TC[i], p = TP[i], e = TE[i], sg = TS[i];
    px[cc] = px[p] + sg * vx[e];
    py[cc] = py[p] + sg * vy[e];
  }
  return fm;
}

// ---- the joints of the truss for a depth h and a set of deformations, each taken lam of the way; the narrowest angle of any triangle comes back
function shape(S, lam, h, g, lean, rise, camber, t) {
  const jx = S.jx, jy = S.jy, w = S.w, bx = S.bx;
  g *= lam; lean *= lam; rise *= lam; camber *= lam;
  let sum = 0;
  for (let i = 0; i < N; i++) (w[i] = exp(1.1 * g * (i / (N - 1) - 0.5))), (sum += w[i]);
  bx[0] = 0;
  for (let i = 0; i < N; i++) bx[i + 1] = bx[i] + (w[i] * SPAN) / sum;
  for (let i = 0; i <= N; i++) (jx[i] = bx[i]), (jy[i] = (rise * h * bx[i]) / SPAN);
  for (let i = 0; i < N; i++) {
    const mid = 0.5 * (bx[i] + bx[i + 1]), pw = (w[i] * SPAN) / sum;
    // each top joint also sways on its own, along the chord and up and down, so no two panels keep the same shape
    const sxj = lam * pw * 0.22 * sin((TAU * t) / TOPX[i] + S.jph[i]), syj = lam * h * 0.1 * sin((TAU * t) / TOPY[i] + S.jph[N + i]);
    jx[N + 1 + i] = mid + lean * h + sxj;
    jy[N + 1 + i] = (rise * h * mid) / SPAN + h * (1 + camber * 4 * (mid / SPAN) * (1 - mid / SPAN)) + syj;
  }
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (let j = 0; j < NJ; j++) (mnx = min(mnx, jx[j])), (mxx = max(mxx, jx[j])), (mny = min(mny, jy[j])), (mxy = max(mxy, jy[j]));
  const kx = SPAN / max(mxx - mnx, 1);
  // the truss stands at most 36 LEDs high, so the loads' arrows keep room above it
  const ky = mxy - mny > 36 ? 36 / (mxy - mny) : 1;
  for (let j = 0; j < NJ; j++) {
    jx[j] = XL + kx * (jx[j] - mnx);
    jy[j] = (jy[j] - mny) * ky;
    S.sx[j] = jx[j];
    S.sy[j] = YB - jy[j];
  }
  let ang = 10;
  for (let q = 0; q < 2 * N - 1; q++) {
    // U(i) is joints i, i+1, N+1+i; D(i) is joints N+i, N+1+i, i
    const i = q < N ? q : q - N + 1;
    const t0 = q < N ? i : N + i, t1 = q < N ? i + 1 : N + 1 + i, t2 = q < N ? N + 1 + i : i;
    const tri = [t0, t1, t2];
    for (let k = 0; k < 3; k++) {
      const pp = tri[k], qq = tri[(k + 1) % 3], rr = tri[(k + 2) % 3];
      const ux = jx[qq] - jx[pp], uy = jy[qq] - jy[pp], vx = jx[rr] - jx[pp], vy = jy[rr] - jy[pp];
      ang = min(ang, abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)));
    }
  }
  return (ang * 180) / PI;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const k1 = cl(kn[0], 0, 1), k2 = cl(kn[1], 0, 3), k3 = cl(kn[2], 0, 3), k4 = cl(kn[3], -1, 1);
  S.kn[0] = k1; S.kn[1] = k2; S.kn[2] = k3; S.kn[3] = k4;
  S.t += d;
  const t = S.t, ph = S.ph;

  // ---- the loads wander along the top chord: a velocity that forgets itself, reflected off the ends
  const m = 0.5 + 0.75 * k3;
  for (let i = 0; i < 3; i++) {
    const L = S.loads[i];
    const vstd = 0.75 * m * L.vs, sg = vstd * sqrt(2 / L.tau);
    L.v += (-L.v / L.tau) * d + sg * sqrt(d) * randn();
    L.v = cl(L.v, -3 * vstd, 3 * vstd);
    L.u += L.v * d;
    const lo = L.side ? 1 : EDGE, hi = N - 1 - (L.side ? 0 : EDGE);
    if (L.u < lo) (L.u = 2 * lo - L.u), (L.v = -L.v);
    if (L.u > hi) (L.u = 2 * hi - L.u), (L.v = -L.v);
    L.u = cl(L.u, lo, hi);
  }
  // their weights: the first stays 1, the others come and go
  const e2 = sm(-1.2, 0.0, 0.62 * sin((TAU * t) / 23.7 + S.loads[1].ph) + 0.38 * sin((TAU * t) / 9.1 + S.loads[1].ph * 2.3));
  const e3 = sm(-0.2, 0.6, 0.6 * sin((TAU * t) / 31.3 + S.loads[2].ph) + 0.4 * sin((TAU * t) / 11.9 + S.loads[2].ph * 1.7));
  S.loads[0].a = 1;
  S.loads[1].a = (0.4 + 0.2 * sm(0, 1.5, k3)) * lerp(e2, 1, sm(0.7, 1.8, k3));
  S.loads[2].a = 0.4 * lerp(e3, 1, sm(1.7, 2.7, k3)) * sm(0.9, 1.9, k3);
  // a load that has faded out comes back on either chord, anywhere along it
  for (let i = 1; i < 3; i++) {
    const L = S.loads[i];
    if (L.a < 0.01 && !L.dead) {
      L.dead = true;
      L.side = Math.random() < 0.5 ? 1 : 0;
      L.u = L.side ? 1 + Math.random() * (N - 2) : EDGE + Math.random() * (N - 1 - 2 * EDGE);
      L.v = 0;
    } else if (L.a > 0.03) L.dead = false;
  }

  // ---- the geometry
  const dtarget = 0.13 * pow(2.77, k2 / 3);
  const dr = cl(dtarget * (1 + 0.22 * sin((TAU * t) / 37.3 + ph[0]) + 0.12 * sin((TAU * t) / 17.9 + ph[1]) + 0.06 * sin((TAU * t) / 61.1 + ph[2])), 0.11, 0.38);
  S.depth += (dr - S.depth) * (S.ready ? 1 - exp(-d / 0.35) : 1);
  const h = S.depth * SPAN;
  const g = cl(0.9 * k4 + 0.4 * sin((TAU * t) / 31.7 + ph[3]) + 0.2 * sin((TAU * t) / 13.3 + ph[4]), -1.3, 1.3);
  const lean = cl(0.38 * k4 + 0.15 * sin((TAU * t) / 47.3 + ph[5]) + 0.07 * sin((TAU * t) / 19.7 + ph[0]), -0.55, 0.55);
  const rise = 0.28 * k4 + 0.15 * sin((TAU * t) / 61.9 + ph[1]) + 0.07 * sin((TAU * t) / 26.9 + ph[2]);
  // the top chord arches over the middle or sags in it, a bowstring or its opposite
  const camber = max(0.1 + 0.35 * sin((TAU * t) / 43.7 + ph[6]) + 0.18 * sin((TAU * t) / 23.9 + ph[7]), -0.3);
  // the deformations are taken back as far as it needs for no triangle of the truss to be narrower than AMIN degrees, where the joint
  // equations stop being well conditioned
  let lam = 1;
  if (shape(S, 1, h, g, lean, rise, camber, t) < AMIN) {
    let lo = 0, hi = 1;
    for (let it = 0; it < 7; it++) {
      const mid = 0.5 * (lo + hi);
      if (shape(S, mid, h, g, lean, rise, camber, t) >= AMIN) lo = mid;
      else hi = mid;
    }
    lam = lo;
  }
  S.lam = S.ready ? min(lam, S.lam + 0.6 * d) : lam;
  shape(S, S.lam, h, g, lean, rise, camber, t);

  // ---- the loads become joint loads: each is shared by the two top joints either side of it
  S.lf.fill(0);
  for (let i = 0; i < 3; i++) {
    const L = S.loads[i];
    const k = min(floor(L.u), N - 2), f = L.u - k;
    const j0 = L.side ? k : N + 1 + k;
    S.lf[j0] += L.a * (1 - f);
    S.lf[j0 + 1] += L.a * f;
    S.lx[i] = lerp(S.sx[j0], S.sx[j0 + 1], f);
    S.ly[i] = lerp(S.sy[j0], S.sy[j0 + 1], f);
  }

  // ---- the member forces and the diagram; the colours are scaled by the force of the worst unit load on any joint times the loads' sum, a little,
  // so they do not swing with every move of the loads
  if (solve(S)) {
    const px = S.px, py = S.py, vx = S.vx, vy = S.vy;
    diagram(S, 0, S.T, px, py);
    let res = 0;
    for (let e = 0; e < NE; e++) res = max(res, abs(px[et[e]] - px[ef[e]] - vx[e]) + abs(py[et[e]] - py[ef[e]] - vy[e]));
    S.res = res;
    let fb = 0;
    for (let q = 1; q < NR; q++) fb = max(fb, diagram(S, q, S.Tq, S.qx, S.qy));
    let pt = 0;
    for (let i = 0; i < 3; i++) pt += S.loads[i].a;
    let fm = 0;
    for (let e = 0; e < NM; e++) fm = max(fm, abs(S.T[e]));
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (let f = 0; f < NF; f++) (mnx = min(mnx, px[f])), (mxx = max(mxx, px[f])), (mny = min(mny, py[f])), (mxy = max(mxy, py[f]));
    // the diagram is fitted to its box, and the scale that does it is smoothed; it aims short of the fit, and what is drawn is never past it
    const fitNow = min(BW / max(mxx - mnx, 1e-3), BH / max(mxy - mny, 1e-3));
    const tsc = (SLACK - 0.12 * sm(0, 3, S.kn[2])) * fitNow;
    const tf = lerp(fm, pt * fb, 0.6);
    if (isFinite(tsc + tf + mnx + mxx + mny + mxy) && tf > 1e-6) {
      const cxn = 0.5 * (mnx + mxx), cyn = 0.5 * (mny + mxy);
      if (!S.ready) {
        S.sc = tsc; S.cx = cxn; S.cy = cyn; S.fenv = tf;
        S.ready = true;
      } else {
        const a = 1 - exp(-d / 0.7);
        S.sc += (tsc - S.sc) * a;
        S.cx += (cxn - S.cx) * a;
        S.cy += (cyn - S.cy) * a;
        S.fenv += (tf - S.fenv) * a;
      }
      // whatever the smoothing did, the drawn diagram stays inside its box
      S.dsc = min(S.sc, fitNow);
      S.dcx = cl(S.cx, mxx - BW / (2 * S.dsc), mnx + BW / (2 * S.dsc));
      S.dcy = cl(S.cy, mxy - BH / (2 * S.dsc), mny + BH / (2 * S.dsc));
    }
  }

  // ---- the member that is picked out in both pictures
  S.hlt += d;
  if (S.hlt > S.hld + S.hln) {
    let pick = -1;
    for (let tries = 0; tries < 10; tries++) {
      const e = floor(Math.random() * NM);
      if (e !== S.hl && abs(S.T[e]) > 0.2 * S.fenv) {
        pick = e;
        break;
      }
    }
    if (pick < 0) pick = floor(Math.random() * NM);
    S.hl = pick; S.hlt = 0; S.hld = 1.6 + 1.8 * Math.random(); S.hln = 0.3 + 0.8 * Math.random();
  }
}

// ---- drawing into a float frame: every line and dot is a distance-based coverage, laid over what is there
function over(fb, x, y, cov, r, g, b) {
  if (cov <= 0) return;
  const o = (y * W + x) * 3, k = 1 - cov;
  fb[o] = fb[o] * k + r * cov;
  fb[o + 1] = fb[o + 1] * k + g * cov;
  fb[o + 2] = fb[o + 2] * k + b * cov;
}
function seg(fb, x0, y0, x1, y1, wd, r, g, b, a) {
  const hw = 0.5 * wd, pad = hw + 1;
  const xa = max(0, floor(min(x0, x1) - pad)), xb = min(W - 1, ceil(max(x0, x1) + pad));
  const ya = max(0, floor(min(y0, y1) - pad)), yb = min(H - 1, ceil(max(y0, y1) + pad));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const cx = x + 0.5 - x0, cy = y + 0.5 - y0;
      const t = L2 > 1e-9 ? cl((cx * dx + cy * dy) / L2, 0, 1) : 0;
      const ex = cx - t * dx, ey = cy - t * dy;
      const c = cl(hw + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * a;
      if (c > 0) over(fb, x, y, c, r, g, b);
    }
}
function dot(fb, x0, y0, rad, r, g, b, a) {
  const pad = rad + 1;
  const xa = max(0, floor(x0 - pad)), xb = min(W - 1, ceil(x0 + pad));
  const ya = max(0, floor(y0 - pad)), yb = min(H - 1, ceil(y0 + pad));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const ex = x + 0.5 - x0, ey = y + 0.5 - y0;
      const c = cl(rad + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * a;
      if (c > 0) over(fb, x, y, c, r, g, b);
    }
}

const COL = [0, 0, 0, 2];
const TMP = [0, 0, 0];
const GREY = [0, 0, 0];
hsv(0.72, 0.2, 0.58, GREY);
// the colour of a member from its force: amber to gold when it pulls, blue to cyan when it pushes, a violet grey when it carries nothing
function style(F, S, hs, hlA) {
  const a = min(1, abs(F) / S.fenv), z = sm(0.03, 0.13, a);
  if (F >= 0) hsv(0.118 + 0.03 * a + hs, 0.95 - 0.35 * a * a, 0.84 + 0.16 * pow(a, 0.6), TMP);
  else hsv(0.62 - 0.1 * a + hs, 0.9 - 0.4 * a * a, 0.8 + 0.2 * pow(a, 0.6), TMP);
  let r = lerp(GREY[0], TMP[0], z), g = lerp(GREY[1], TMP[1], z), b = lerp(GREY[2], TMP[2], z);
  // a pulled-down mix of amber and grey reads as brown on the panel, so the weak members stay light and only lose their colour
  const top = max(r, g, b), want = lerp(0.58, 0.88, sm(0.03, 0.13, a));
  if (top < want) (r *= want / top), (g *= want / top), (b *= want / top);
  r = lerp(r, 1, 0.5 * hlA); g = lerp(g, 1, 0.5 * hlA); b = lerp(b, 1, 0.5 * hlA);
  COL[0] = r * 255; COL[1] = g * 255; COL[2] = b * 255;
  COL[3] = 2.3 + 0.9 * sm(0.55, 0.95, a) + 0.9 * hlA;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const fb = S.fb;
  for (let i = 0; i < W * H; i++) (fb[i * 3] = 3), (fb[i * 3 + 1] = 5), (fb[i * 3 + 2] = 14);
  const hs = 0.78 * S.kn[0];
  const hlA = S.hl >= 0 ? sin(PI * cl(S.hlt / S.hld, 0, 1)) ** 2 : 0;

  // members by force, the weak first so the strong lie on top
  const ord = S.ord;
  for (let e = 0; e < NM; e++) ord[e] = e;
  ord.sort((p, q) => abs(S.T[p]) - abs(S.T[q]));

  // ---- the force diagram
  const sc = S.dsc, X = (x) => BX + sc * (x - S.dcx), Y = (y) => BY - sc * (y - S.dcy);
  const px = S.px, py = S.py;
  // the load line: the outer forces end to end, the loads in a pale lavender and the two reactions over them in a blue-silver
  {
    const xl = X(px[O(0)]);
    for (let pass = 0; pass < 2; pass++)
      for (let k = 1; k <= 2 * N + 1; k++) {
        const j = ej[k % (2 * N + 1)], isReaction = j === 0 || j === N;
        if (isReaction !== (pass === 1)) continue;
        seg(fb, xl, Y(py[O(k - 1)]), xl, Y(py[O(k % (2 * N + 1))]), 3, isReaction ? 150 : 205, isReaction ? 175 : 205, isReaction ? 215 : 235, isReaction ? 0.85 : 0.95);
      }
  }
  for (let q = 0; q < NM; q++) {
    const e = ord[q];
    const hh = e === S.hl ? hlA : 0;
    if (e === S.hl) continue;
    style(S.T[e], S, hs, hh);
    seg(fb, X(px[ml[e]]), Y(py[ml[e]]), X(px[mr[e]]), Y(py[mr[e]]), COL[3], COL[0], COL[1], COL[2], 1);
  }
  if (S.hl >= 0) {
    const e = S.hl;
    style(S.T[e], S, hs, hlA);
    seg(fb, X(px[ml[e]]), Y(py[ml[e]]), X(px[mr[e]]), Y(py[mr[e]]), COL[3], COL[0], COL[1], COL[2], 1);
  }
  for (let f = 0; f < NF; f++) dot(fb, X(px[f]), Y(py[f]), 1.25, 215, 220, 245, 0.8);

  // ---- the truss
  const sx = S.sx, sy = S.sy;
  for (let q = 0; q < NM; q++) {
    const e = ord[q];
    if (e === S.hl) continue;
    style(S.T[e], S, hs, 0);
    seg(fb, sx[ma[e]], sy[ma[e]], sx[mb[e]], sy[mb[e]], COL[3], COL[0], COL[1], COL[2], 1);
  }
  if (S.hl >= 0) {
    const e = S.hl;
    style(S.T[e], S, hs, hlA);
    seg(fb, sx[ma[e]], sy[ma[e]], sx[mb[e]], sy[mb[e]], COL[3], COL[0], COL[1], COL[2], 1);
  }
  for (let j = 0; j < NJ; j++) dot(fb, sx[j], sy[j], 1.5, 232, 238, 255, 0.92);
  // supports
  for (const j of [0, N]) {
    const x = sx[j], y = sy[j] + 2;
    seg(fb, x, y, x - 3.5, y + 4.5, 1.6, 150, 160, 205, 0.9);
    seg(fb, x, y, x + 3.5, y + 4.5, 1.6, 150, 160, 205, 0.9);
    seg(fb, x - 3.5, y + 4.5, x + 3.5, y + 4.5, 1.6, 150, 160, 205, 0.9);
  }
  // the loads
  for (let i = 0; i < 3; i++) {
    const a = S.loads[i].a;
    if (a < 0.03) continue;
    const al = cl(a * 5, 0, 1), x = S.lx[i];
    if (S.loads[i].side === 0) {
      // a load on the top chord comes down on it
      const y = S.ly[i] - 1.5, len = min(7 + 10 * a, S.ly[i] - 9);
      seg(fb, x, y - len - 3, x, y - 3, 2, 250, 250, 255, al);
      seg(fb, x, y, x - 2.8, y - 3.8, 1.8, 250, 250, 255, al);
      seg(fb, x, y, x + 2.8, y - 3.8, 1.8, 250, 250, 255, al);
    } else {
      // one on the bottom chord hangs from it
      const y0 = S.ly[i] + 2, len = min(6 + 8 * a, 61 - y0);
      seg(fb, x, y0, x, y0 + len - 3, 2, 250, 250, 255, al);
      seg(fb, x, y0 + len, x - 2.8, y0 + len - 3.8, 1.8, 250, 250, 255, al);
      seg(fb, x, y0 + len, x + 2.8, y0 + len - 3.8, 1.8, 250, 250, 255, al);
    }
  }
  // the two spaces on each side of the picked member, in both pictures
  if (S.hl >= 0 && hlA > 0.02) {
    const e = S.hl;
    let mx = 0, my = 0;
    for (let j = 0; j < NJ; j++) (mx += sx[j]), (my += sy[j]);
    mx /= NJ; my /= NJ;
    const fs = [ml[e], mr[e]];
    for (let s = 0; s < 2; s++) {
      const f = fs[s];
      let x, y;
      if (f < 2 * N - 1) {
        if (f < N) (x = (sx[f] + sx[f + 1] + sx[N + 1 + f]) / 3), (y = (sy[f] + sy[f + 1] + sy[N + 1 + f]) / 3);
        else {
          const i = f - N + 1; // D(i): top joints i-1 and i, bottom joint i
          x = (sx[N + i] + sx[N + 1 + i] + sx[i]) / 3;
          y = (sy[N + i] + sy[N + 1 + i] + sy[i]) / 3;
        }
      } else {
        const k = f - (2 * N - 1), me = om[k];
        const xa = 0.5 * (sx[ma[me]] + sx[mb[me]]), ya = 0.5 * (sy[ma[me]] + sy[mb[me]]);
        let nx = -(sy[mb[me]] - sy[ma[me]]), ny = sx[mb[me]] - sx[ma[me]];
        const nl = sqrt(nx * nx + ny * ny) || 1;
        nx /= nl; ny /= nl;
        if (nx * (xa - mx) + ny * (ya - my) < 0) (nx = -nx), (ny = -ny);
        x = xa + 3.6 * nx; y = ya + 3.6 * ny;
      }
      dot(fb, x, y, 2.1, 255, 255, 255, 0.95 * hlA);
      dot(fb, X(px[f]), Y(py[f]), 2.3, 255, 255, 255, 0.95 * hlA);
    }
  }

  const o = fb;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, cl((o[i] + 0.5) | 0, 0, 255), cl((o[i + 1] + 0.5) | 0, 0, 255), cl((o[i + 2] + 0.5) | 0, 0, 255));
    }
}
