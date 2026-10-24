// ===== Patternflow pattern =====
// Title:   Gosset Polytope
// Family:  geometry
// Idea:    The 240 roots of E8 and the 6720 edges between them, Gosset's 4₂₁ polytope, projected out of eight dimensions into two windows: the upper one opens on the Coxeter plane picture, eight rings of 30, and swings from there through the Coxeter planes of E7, E6, D5, D4 and D6 and back, while the lower one runs a plane ahead.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gosset's 4₂₁ polytope (Thorold Gosset, 1900) and the E8 root system (Wilhelm Killing 1888, Élie Cartan 1894), in Peter McMullen's Petrie projection, pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Edges=-1..1, Plane=1..5
//
// Knob 1: Hue. Turns the eight ring colours round the colour wheel together; at 0 the inner ring is gold and the outer one cyan.
// Knob 2: Speed. At 2 each plane holds for two and a half seconds and the swing to the next takes three and a half, so the round of six planes takes 36 seconds; at 0.2 it takes six minutes.
// Knob 3: Edges. How bright the web of 6720 edges is: at -1 only the 240 vertices, at 0 a faint web, at 1 four times brighter, where the overlaps burn white.
// Knob 4: Plane. How many planes ahead along the round the lower window runs. At 1 it shows E7's 18-fold picture under the 30-fold one and each picture rises from the lower window to the upper; at 4 it is D4's six-pointed star, and at 5 it runs one plane behind.
// Buttons: K1 tap runs both windows back (or on) along the round until the upper one stands on the Coxeter plane again, in a second or so.

// Each window is 64 LEDs square; the polytope fills a circle of radius 29.5
// in it, so the outer ring of the Coxeter plane picture has 30 vertices about
// six LEDs apart and the inner one 30 on a circle of radius six.
const W = 64, HV = 64, CX = 31.5, RAD = 29.5;
const { max, floor, ceil, round, sqrt, cos, sin, abs, exp, atan2, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

// The roots: every (±1, ±1, 0, 0, 0, 0, 0, 0) in any order, 112 of them,
// and every (±1/2)^8 with an even number of minus signs, 128 more.
const ROOTS = [];
for (let i = 0; i < 8; i++)
  for (let j = i + 1; j < 8; j++)
    for (let s = 0; s < 4; s++) {
      const v = new Array(8).fill(0);
      v[i] = s & 1 ? -1 : 1;
      v[j] = s & 2 ? -1 : 1;
      ROOTS.push(v);
    }
for (let m = 0; m < 256; m++) {
  let neg = 0;
  for (let k = 0; k < 8; k++) neg += (m >> k) & 1;
  if (neg % 2 === 0) ROOTS.push([...Array(8)].map((_, k) => ((m >> k) & 1 ? -0.5 : 0.5)));
}
const NV = ROOTS.length;
const RF = new Float64Array(NV * 8);
ROOTS.forEach((r, i) => r.forEach((x, k) => (RF[i * 8 + k] = x)));

// Two roots are joined when they stand sqrt 2 apart, when their dot product
// is 1: 56 edges at each vertex, 6720 in all.
const EDGE = [];
for (let i = 0; i < NV; i++) for (let j = i + 1; j < NV; j++) if (dot(ROOTS[i], ROOTS[j]) === 1) EDGE.push(i, j);
const NE = EDGE.length / 2;
const EI = Uint16Array.from(EDGE);

// The simple roots of E8 (Bourbaki's numbering): a1 is the spinor root, a2
// hangs off a4, and a1 a3 a4 a5 a6 a7 a8 is the long arm.
const e = (i, s = 1, j = -1, t = 0) => [...Array(8)].map((_, k) => (k === i ? s : k === j ? t : 0));
const SIMPLE = [[0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5], e(0, 1, 1, 1), e(1, 1, 0, -1), e(2, 1, 1, -1), e(3, 1, 2, -1), e(4, 1, 3, -1), e(5, 1, 4, -1), e(6, 1, 5, -1)];

// The Coxeter plane of a simply laced root system from its simple roots
// (Steinberg): colour the Dynkin diagram black and white, take the
// Perron-Frobenius vector x of the diagram, and the plane is spanned by the
// sum of x_i a_i over the black roots and the same sum over the white ones.
// The product of all the reflections turns it by one h-th of a turn.
function coxeterPlane(S) {
  const k = S.length, adj = S.map((a) => S.map((b) => (dot(a, b) === -1 ? 1 : 0)));
  const col = new Array(k).fill(-1), stack = [0];
  col[0] = 0;
  while (stack.length) {
    const i = stack.pop();
    for (let j = 0; j < k; j++) if (adj[i][j] && col[j] < 0) (col[j] = 1 - col[i]), stack.push(j);
  }
  let x = new Array(k).fill(1), lam = 0;
  for (let it = 0; it < 600; it++) {
    const y = x.map((xi, i) => 2 * xi + adj[i].reduce((s, a, j) => s + a * x[j], 0));
    lam = sqrt(dot(y, y)) - 2;
    x = y.map((v) => v / (lam + 2));
  }
  const u = new Array(8).fill(0), w = new Array(8).fill(0);
  S.forEach((a, i) => a.forEach((ai, d) => ((col[i] ? w : u)[d] += x[i] * ai)));
  const nu = sqrt(dot(u, u));
  for (let d = 0; d < 8; d++) u[d] /= nu;
  const pr = dot(w, u);
  for (let d = 0; d < 8; d++) w[d] -= pr * u[d];
  const nw = sqrt(dot(w, w));
  // The diagram's largest eigenvalue is 2 cos(pi / h), h the Coxeter number.
  return [u, w.map((v) => v / nw), round(PI / Math.acos(lam / 2))];
}

// The round: E8 (30-fold), then down the chain E8 > E7 > E6 > D5 > D4 one
// node of the diagram at a time (18, 12, 8 and 6-fold), up through D6
// (10-fold) and back.
const STOPS = [SIMPLE, SIMPLE.slice(0, 7), SIMPLE.slice(0, 6), SIMPLE.slice(1, 6), SIMPLE.slice(1, 5), SIMPLE.slice(1, 7)].map(coxeterPlane);
const NS = STOPS.length;

// Each swing is the shortest way from one plane to the next (a geodesic in
// the Grassmannian): the two principal angles between the planes, turned
// through together. The frame carries its own turn within the plane from
// one swing to the next, so the windows never jump.
function svd2(a, b, c, d) {
  const E = (a + d) / 2, F = (a - d) / 2, G = (c + b) / 2, H = (c - b) / 2;
  const Q = hypot(E, H), R = hypot(F, G), a1 = atan2(G, F), a2 = atan2(H, E);
  // C = rot(phi) diag(Q + R, Q - R) rot(theta)
  return { s1: Q + R, s2: Q - R, phi: (a2 + a1) / 2, th: (a2 - a1) / 2 };
}
const comb = (p, q, cp, cq) => p.map((x, i) => cp * x + cq * q[i]);
// Each stop is shown turned so a vertex of its outer polygon points straight
// up; the turn is picked among the h equal ones to be the nearest to the
// last, and the swing eases from one to the next.
function upright(u, v, h, near) {
  let best = 0, a = 0;
  for (const r of ROOTS) {
    const x = dot(r, u), y = dot(r, v), q = hypot(x, y);
    if (q > best + 1e-9) (best = q), (a = atan2(y, x));
  }
  const t = -PI / 2 - a, step = (2 * PI) / h;
  return t + round((near - t) / step) * step;
}
const SEG = [];
let F = STOPS[0], turn = upright(F[0], F[1], 30, 0);
for (let k = 0; k < NS; k++) {
  let [v1, v2, h] = STOPS[(k + 1) % NS];
  const [f1, f2] = F;
  if (dot(f1, v1) * dot(f2, v2) - dot(f1, v2) * dot(f2, v1) < 0) v2 = v2.map((x) => -x);
  const { s1, s2, phi, th } = svd2(dot(f1, v1), dot(f1, v2), dot(f2, v1), dot(f2, v2));
  const ca = cos(phi), sa = sin(phi), cb = cos(-th), sb = sin(-th);
  // Principal vectors: P = F rot(phi), Q = V rot(theta)^T.
  const p = [comb(f1, f2, ca, sa), comb(f1, f2, -sa, ca)];
  const q = [comb(v1, v2, cb, sb), comb(v1, v2, -sb, cb)];
  const ang = [], n = [];
  [s1, s2].forEach((s, i) => {
    const t = comb(q[i], p[i], 1, -cl(s, -1, 1)), nt = sqrt(dot(t, t));
    ang.push(Math.acos(cl(s, -1, 1)));
    n.push(nt > 1e-9 ? t.map((x) => x / nt) : new Array(8).fill(0));
  });
  F = [comb(q[0], q[1], cos(phi), -sin(phi)), comb(q[0], q[1], sin(phi), cos(phi))];
  // Back on the Coxeter plane the frame may come round mirrored; the
  // picture there is symmetric under the mirror, so turning a vertex up
  // closes the loop all the same.
  const next = upright(F[0], F[1], h, turn);
  SEG.push({ p, n, ang, phi, t0: turn, t1: next });
  turn = next;
}

// Where the frame stands at phase s (in stops): hold 5/12 of each stop, then
// swing to the next with a smooth start and end. Returns the turn.
const HOLD = 5 / 12;
function frameAt(s, out) {
  const n = ((s % NS) + NS) % NS, k = floor(n), f = n - k, G = SEG[k];
  let m = cl((f - HOLD) / (1 - HOLD), 0, 1);
  m = m * m * m * (m * (m * 6 - 15) + 10);
  const c1 = cos(m * G.ang[0]), s1 = sin(m * G.ang[0]), c2 = cos(m * G.ang[1]), s2 = sin(m * G.ang[1]);
  const cp = cos(G.phi), sp = sin(G.phi);
  for (let d = 0; d < 8; d++) {
    const g1 = c1 * G.p[0][d] + s1 * G.n[0][d], g2 = c2 * G.p[1][d] + s2 * G.n[1][d];
    out[d] = g1 * cp - g2 * sp;
    out[8 + d] = g1 * sp + g2 * cp;
  }
  return G.t0 + (G.t1 - G.t0) * m;
}

// Eight rings of 30 on the Coxeter plane; each vertex keeps the colour of
// its ring wherever the swings carry it.
const RING = new Uint8Array(NV);
{
  const [u, v] = STOPS[0], rr = ROOTS.map((r) => hypot(dot(r, u), dot(r, v)));
  const sorted = [...rr].sort((a, b) => a - b), levels = sorted.filter((x, i) => i === 0 || x - sorted[i - 1] > 1e-3);
  rr.forEach((x, i) => (RING[i] = levels.filter((l) => l < x + 1e-3).length - 1));
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c];
}

export function setup(params) {
  params.s = {
    ph: 0, lead: 1, hue: -1, ew: 1, snap: null,
    buf: new Float32Array(W * HV * 2 * 3), fr: new Float64Array(16),
    px: new Float32Array(NV), py: new Float32Array(NV),
    vc: new Float32Array(NV * 3), ec: new Float32Array(NE * 3), rc: new Float32Array(8 * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const sp = cl(k[1], 0.2, 3);
  P.lead = cl(k[3], 1, 5);
  P.ew = cl(k[2], -1, 1);
  const hue = k[0] || 0;
  if (hue !== P.hue) {
    P.hue = hue;
    for (let r = 0; r < 8; r++) hsv(0.15 + hue - r * 0.095, 0.95 - 0.02 * r, 1, P.rc, r * 3);
    for (let i = 0; i < NV; i++) for (let c = 0; c < 3; c++) P.vc[i * 3 + c] = P.rc[RING[i] * 3 + c];
    for (let j = 0; j < NE; j++) for (let c = 0; c < 3; c++) P.ec[j * 3 + c] = (P.vc[EI[2 * j] * 3 + c] + P.vc[EI[2 * j + 1] * 3 + c]) / 2;
  }
  if (P.snap) {
    P.snap.t += d;
    const u = cl(P.snap.t / P.snap.T, 0, 1), m = u * u * (3 - 2 * u);
    P.ph = P.snap.a + (P.snap.b - P.snap.a) * m;
    if (u >= 1) P.snap = null;
  } else {
    P.ph = (P.ph + (d * sp) / 12) % NS;
    // K1: run back or on to the nearer Coxeter plane, 0.4 s a stop.
    if (input.btnPressed && input.btnPressed[0]) {
      const b = round(P.ph / NS) * NS;
      P.snap = { a: P.ph, b, t: 0, T: max(0.8, abs(b - P.ph) * 0.4) };
    }
  }
}

// One window: project the 240 roots onto the plane, draw the 6720 edges as
// additive light, then the vertices on top.
function view(P, ph, y0) {
  const fr = P.fr, buf = P.buf, px = P.px, py = P.py;
  const a = frameAt(ph, fr), ca = cos(a), sa = sin(a);
  let rmax = 0;
  for (let i = 0; i < NV; i++) {
    let x = 0, y = 0;
    for (let d = 0, o = i * 8; d < 8; d++) (x += RF[o + d] * fr[d]), (y += RF[o + d] * fr[8 + d]);
    px[i] = ca * x - sa * y;
    py[i] = sa * x + ca * y;
    rmax = max(rmax, px[i] * px[i] + py[i] * py[i]);
  }
  const sc = RAD / sqrt(rmax), cy = y0 + 31.5;
  for (let i = 0; i < NV; i++) (px[i] = CX + px[i] * sc - 0.5), (py[i] = cy + py[i] * sc - 0.5);
  const ew = P.ew <= -1 ? 0 : 0.012 * (P.ew + 1) * (P.ew + 1), ec = P.ec, W3 = W * 3;
  // RAD keeps every point a pixel inside the window, so no line needs clipping.
  if (ew > 0)
    for (let j = 0; j < NE; j++) {
      const i0 = EI[2 * j], i1 = EI[2 * j + 1];
      let x = px[i0], y = py[i0];
      const dx = px[i1] - x, dy = py[i1] - y, adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
      const n = ceil(adx > ady ? adx : ady) || 1, w = (ew * sqrt(dx * dx + dy * dy)) / n;
      const r = ec[j * 3] * w, g = ec[j * 3 + 1] * w, b = ec[j * 3 + 2] * w, sx = dx / n, sy = dy / n;
      for (let s = 0; s <= n; s++, x += sx, y += sy) {
        const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, q = (yi * W + xi) * 3;
        const w11 = fx * fy, w10 = fx - w11, w01 = fy - w11, w00 = 1 - fx - w01;
        buf[q] += r * w00;
        buf[q + 1] += g * w00;
        buf[q + 2] += b * w00;
        buf[q + 3] += r * w10;
        buf[q + 4] += g * w10;
        buf[q + 5] += b * w10;
        buf[q + W3] += r * w01;
        buf[q + W3 + 1] += g * w01;
        buf[q + W3 + 2] += b * w01;
        buf[q + W3 + 3] += r * w11;
        buf[q + W3 + 4] += g * w11;
        buf[q + W3 + 5] += b * w11;
      }
    }
  // With the web turned off the vertices burn brighter.
  const vc = P.vc, vw = 0.6 + 0.5 * max(0, -P.ew);
  for (let i = 0; i < NV; i++) {
    const x = px[i], y = py[i], xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, q = (yi * W + xi) * 3;
    const w11 = fx * fy * vw, w10 = fx * vw - w11, w01 = fy * vw - w11, w00 = vw - fx * vw - w01;
    for (let c = 0; c < 3; c++) {
      const v = vc[i * 3 + c];
      buf[q + c] += v * w00;
      buf[q + 3 + c] += v * w10;
      buf[q + W3 + c] += v * w01;
      buf[q + W3 + 3 + c] += v * w11;
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const buf = P.buf;
  buf.fill(0);
  view(P, P.ph, 0);
  view(P, P.ph + P.lead, HV);
  for (let p = 0, y = 0; y < 2 * HV; y++)
    for (let x = 0; x < W; x++, p += 3)
      display.setPixel(x, y, 255 * (1 - exp(-1.6 * buf[p])), 255 * (1 - exp(-1.6 * buf[p + 1])), 255 * (1 - exp(-1.6 * buf[p + 2])));
}
