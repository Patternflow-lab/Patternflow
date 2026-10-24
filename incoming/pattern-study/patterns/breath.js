// ===== Patternflow pattern =====
// Title:   Breath
// Family:  body
// Idea:    A pair of lungs drawn like an anatomical plate from the throat to the diaphragm breathes: the diaphragm drops, the ribs lift, the lungs swell, cold air runs down the bronchial tree into the alveoli and they flush from dusky violet to red, then the warm air rises back out as a puff at the top.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after anatomical plates of the lungs, with the bronchial tree grown by volume-filling branching (Tawhai, Pullan and Hunter, 2000)
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Air=0..1, Rate=0.2..3, Depth=0..1, Altitude=0..1
//
// Knob 1: Air. What is breathed: clear cool air at 0, cold winter air at 0.5 where every breath comes out as a white cloud at the top, and city smog at 1 that browns the sky and leaves soot in the alveoli.
// Knob 2: Rate. Breaths a minute: about 9 asleep at 0.2, 17 at 2 (one every 3.5 s), and a shallow pant of 34 at 3.
// Knob 3: Depth. A quiet breath at 0, where the domes of the diaphragm drop 7 LEDs, up to a deep sigh at 1 that drops them 14 and lifts and spreads the ribs twice as far.
// Knob 4: Altitude. Sea level at 0, the top of Everest at 1: each breath brings less oxygen, so the alveoli flush only to a dusky purple, and the breathing quickens and deepens on its own.
// Buttons: K1 tap makes the lungs cough: a quick gasp, then three jolts that blow warm air up the tree and out in puffs.

const W = 64, H = 128, N = W * H, A0 = 2;
const { min, max, abs, sin, cos, exp, sqrt, floor, ceil, round, hypot, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const F32 = (n) => new Float32Array(n);
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}

// The diaphragm under the lungs breathed out, x then y: the right dome higher
// over the liver, the heart sitting in the dip between the domes.
const DK = [-1, 118.5, 5, 113.8, 9, 108.4, 13, 103.8, 17, 101.6, 21, 101, 25, 101.8, 29, 104.2, 33, 106, 37, 106.6, 41, 106.6, 45, 105.8, 49, 106.8, 53, 110.2, 57, 115, 60, 117.8, 65, 122.5];
const D0T = F32(68);
for (let i = 0, k = 0; i < 68; i++) {
  while (k < DK.length - 4 && i - 1 > DK[k + 2]) k += 2;
  D0T[i] = mix(DK[k + 1], DK[k + 3], (i - 1 - DK[k]) / (DK[k + 2] - DK[k]));
}
for (let n = 0; n < 4; n++) for (let i = 1; i < 67; i++) D0T[i] = (D0T[i - 1] + 2 * D0T[i] + D0T[i + 1]) / 4;
const d0 = (x) => ((x = cl(x + 1, 0, 66.99)), D0T[floor(x)] + (D0T[floor(x) + 1] - D0T[floor(x)]) * (x - floor(x)));
// How far the diaphragm drops at each column: most under the two domes, so
// they flatten.
const GX = Float32Array.from({ length: W }, (_, x) => 0.32 + 0.68 * (exp(-(((x - 17) / 10) ** 2)) + exp(-(((x - 46) / 10) ** 2))));
// The outlines of the right lung (on the viewer's left) and the smaller left
// lung with the heart's notch, breathed out. The diaphragm cuts their bases.
const LUNGS = [
  [19, 21, 15, 22.5, 11.5, 26, 8.5, 32, 6.3, 40, 4.8, 50, 4, 60, 3.6, 72, 3.6, 84, 4, 96, 4.6, 106, 5.6, 126, 28.8, 126, 28.6, 104, 28.2, 98, 27.6, 90, 27.2, 82, 27.6, 74, 28.6, 66, 29, 58, 28.6, 50, 27.8, 42, 26.6, 34, 24.8, 27, 22.5, 22.5],
  [44.5, 22, 48.5, 23.5, 52, 27, 55, 33, 57.2, 41, 58.8, 51, 59.6, 62, 60, 74, 60.2, 86, 60.2, 98, 59.9, 108, 59.2, 126, 41.5, 126, 41.5, 106, 41, 103, 42.4, 98, 44.5, 92, 45.4, 86, 44.4, 80, 41.8, 75, 38.6, 71, 36.6, 66, 36, 58, 36.4, 50, 37.2, 42, 38.4, 34, 40, 28, 42, 23.5],
];
// Airway walls by generation (9 is the channel through the larynx), and how
// strongly each shows over the lung.
const WC = Array.from({ length: 10 }, (_, g) => (g < 2 ? [226, 216, 204] : [232 - 2 * g, 208 - 4 * g, 206]));
const AG = Array.from({ length: 10 }, (_, g) => (g < 2 ? 1 : g > 8 ? 0 : 1.1 - 0.08 * g));
// The cough: seconds and lung volume, and the moments of the three jolts.
const CK = [0, 0, 0.32, 0.97, 0.44, 0.97, 0.54, 0.66, 0.84, 0.66, 0.94, 0.38, 1.24, 0.38, 1.34, 0.12, 1.9, 0];
const CT = [0.44, 0.84, 1.24];

function sdPoly(v, px, py) {
  let d = 1e9, s = 1;
  for (let i = 0, j = v.length - 2; i < v.length; j = i, i += 2) {
    const ex = v[j] - v[i], ey = v[j + 1] - v[i + 1], wx = px - v[i], wy = py - v[i + 1];
    const t = cl((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * t, by = wy - ey * t;
    d = min(d, bx * bx + by * by);
    const c1 = py >= v[i + 1], c2 = py < v[j + 1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * sqrt(d);
}
// The colour being built for one LED, and mixing toward another by k.
const C = F32(3);
const DA = [74, 58, 156];
const bl = (r, g, b, k) => ((C[0] += (r - C[0]) * k), (C[1] += (g - C[1]) * k), (C[2] += (b - C[2]) * k));
function samp(A, x, y) {
  x = cl(x, 0, 62.999);
  y = cl(y, 0, 126.999);
  const xi = x | 0, yi = y | 0, fx = x - xi, p = yi * W + xi, a = A[p] + (A[p + 1] - A[p]) * fx;
  return a + (A[p + W] + (A[p + W + 1] - A[p + W]) * fx - a) * (y - yi);
}

export function setup(params) {
  const P = (params.s = {
    t: 0, ph: 0.68, lp: 0.68, vol: 0.6, D: 0.5, air: 0, ct: -1, jolt: 0, hp: 0, hb: 0, envIn: 0, envOut: 0, Fin: -1, Fx: 2, bf: [], puffs: [],
    sd: F32(N), own: new Int16Array(N).fill(-1), und: F32(N * 3), ua: F32(N), GL: F32(N),
    SX: F32(H), KY: F32(W), alvA: F32(N), alvS: F32(N), alvK: new Int16Array(N), trA: F32(N), trV: F32(N), trS: F32(N), trG: new Int8Array(N), rib: F32(N), O: F32(N * 3),
    seg: [], ax: [], ay: [], as: [], soot: [], cd: [], cb: [], trH: F32(N),
  });
  build(P);
}

function addSeg(P, x0, y0, x1, y1, r, g, d) {
  const e = d + hypot(x1 - x0, y1 - y0);
  P.seg.push(x0, y0, x1, y1, r, g, d, e);
  return e;
}

// Volume-filling branching: a branch's alveoli are split by the line from its
// end through their centroid, and each half gets a child that runs 40% of the
// way to its own centroid, until a handful is left: one grape cluster.
function grow(P, x0, y0, dx, dy, pts, g, r, d) {
  const { ax, ay } = P, n = pts.length;
  let cx = 0, cy = 0;
  for (const i of pts) (cx += ax[i]), (cy += ay[i]);
  (cx /= n), (cy /= n);
  if (n <= 7 || g > 8) {
    for (const i of pts) (P.ak[i] = P.cd.length), (ax[i] += (cx - ax[i]) * 0.3), (ay[i] += (cy - ay[i]) * 0.3);
    P.cd.push(d + hypot(cx - x0, cy - y0));
    P.cb.push(0.84 + 0.32 * rnd());
    return;
  }
  // The lobes split along the line from the branch to their centroid; past
  // them each set is cut across its long axis, a near half and a far one.
  let ux = cx - x0, uy = cy - y0, ul = hypot(ux, uy), ox = x0, oy = y0;
  if (g > 2) {
    let sxx = 0, syy = 0, sxy = 0;
    for (const i of pts) (sxx += (ax[i] - cx) ** 2), (syy += (ay[i] - cy) ** 2), (sxy += (ax[i] - cx) * (ay[i] - cy));
    const th = 0.5 * atan2(2 * sxy, sxx - syy) + PI / 2;
    (ux = cos(th)), (uy = sin(th)), (ul = 1), (ox = cx), (oy = cy);
  }
  if (ul < 0.5) (ux = dx), (uy = dy), (ul = hypot(dx, dy));
  (ux /= ul), (uy /= ul);
  const side = (i) => (ax[i] - ox) * uy - (ay[i] - oy) * ux;
  let A = pts.filter((i) => side(i) > 0), B = pts.filter((i) => side(i) <= 0);
  if (A.length < 2 || B.length < 2) {
    const s = pts.slice().sort((i, j) => side(i) - side(j));
    (A = s.slice(0, n >> 1)), (B = s.slice(n >> 1));
  }
  const pa = atan2(dy, dx), lim = g === 2 ? 1.75 : 1.1;
  for (const Q of [A, B]) {
    let qx = 0, qy = 0;
    for (const i of Q) (qx += ax[i]), (qy += ay[i]);
    (qx = qx / Q.length - x0), (qy = qy / Q.length - y0);
    let a = atan2(qy, qx), da = a - pa;
    da = atan2(sin(da), cos(da));
    if (abs(da) > lim) a = pa + Math.sign(da) * lim;
    let len = max(1.2, hypot(qx, qy) * (Q.length <= 7 ? 0.55 : 0.4)), x1, y1;
    for (;;) {
      (x1 = x0 + cos(a) * len), (y1 = y0 + sin(a) * len);
      if (len <= 1.2 || samp(P.sd, x1, y1) < -0.6) break;
      len *= 0.8;
    }
    const rr = max(0.5, r * Math.cbrt(Q.length / n));
    grow(P, x1, y1, x1 - x0, y1 - y0, Q, g + 1, rr, addSeg(P, x0, y0, x1, y1, rr, g, d));
  }
}

function build(P) {
  const { sd, own, GL } = P;
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, sl = d0(x + 0.5) - d0(x - 0.5), cut = (y - d0(x) + 0.6) / sqrt(1 + sl * sl);
    const a = y < 15 ? 6 : max(sdPoly(LUNGS[0], x, y), cut), b = y < 15 ? 6 : max(sdPoly(LUNGS[1], x, y), cut);
    sd[p] = min(a, b) + 0.9 * (vn(x * 0.32, y * 0.32) - 0.5);
    GL[p] = exp(-(((x - 32) / 26) ** 2) - (((y - 66) / 50) ** 2));
  }
  // Alveoli on a jittered honeycomb inside the lungs.
  const pts = [[], []];
  for (let j = 0; j < 56; j++)
    for (let i = 0; i < 29; i++) {
      const x = 1 + i * 2.25 + (j & 1) * 1.125 + (rnd() - 0.5) * 0.7, y = 19 + j * 1.95 + (rnd() - 0.5) * 0.7;
      if (x > 62.5 || y > 125 || samp(sd, x, y) > -1) continue;
      pts[x < 32 ? 0 : 1].push(P.ax.length);
      P.ax.push(x), P.ay.push(y), P.as.push(0.86 + 0.28 * rnd()), P.soot.push(rnd());
    }
  P.ak = new Int16Array(P.ax.length);
  // The larynx and trachea, the short steep right bronchus and the longer
  // left one, then the trees.
  let d = addSeg(P, 32, 3, 32, 16.5, 1, 9, 0);
  d = addSeg(P, 32, 16.5, 32, 48.5, 3, 0, d);
  grow(P, 26.6, 57, -4.8, 8.5, pts[0], 2, 2.3, addSeg(P, 31.3, 48.5, 26.6, 57, 2.3, 1, d));
  grow(P, 40.4, 56.6, 7.8, 8.1, pts[1], 2, 2.05, addSeg(P, 32.7, 48.5, 40.4, 56.6, 2.05, 1, d));
  P.dmax = max(...P.cd);
  P.cd = Float32Array.from(P.cd, (v) => v / P.dmax);
  P.cox = F32(P.cd.length).fill(0.55);
  P.airK = F32(P.cd.length);
  // Each lung pixel takes the cluster of its nearest alveolus.
  const best = F32(N).fill(9);
  P.ax.forEach((cx, i) => {
    const cy = P.ay[i];
    for (let y = max(0, round(cy) - 3); y <= min(H - 1, round(cy) + 3); y++)
      for (let x = max(0, round(cx) - 3); x <= min(W - 1, round(cx) + 3); x++) {
        const e = hypot(x - cx, y - cy), p = y * W + x;
        if (e < best[p]) (best[p] = e), (own[p] = P.ak[i]);
      }
  });
  under(P);
}

// What lies behind the lungs, breathed out, as colour times cover: the
// larynx, the diaphragm and, dim under it, the liver and the stomach.
function under(P) {
  const { und, ua } = P;
  const lay = (p, r, g, b, a) => {
    if (a <= 0) return;
    const o = p * 3;
    (und[o] += (r - und[o]) * a), (und[o + 1] += (g - und[o + 1]) * a), (und[o + 2] += (b - und[o + 2]) * a), (ua[p] += (1 - ua[p]) * a);
  };
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, t = y - d0(x), ax = abs(x - 32);
    if (t > 3) {
      const xb = 37 + 3 * sin(y * 0.21), f = (1 - 0.55 * sm(3, 20, t)) * (0.7 + 0.5 * vn(x * 0.17, y * 0.17)) * (0.4 + 0.6 * sm(0.3, 2, abs(x - xb)));
      x < xb ? lay(p, 60 * f, 20 * f, 22 * f, cl(t - 3, 0, 1)) : lay(p, 50 * f, 30 * f, 44 * f, cl(t - 3, 0, 1));
    }
    // The diaphragm: a band of muscle with a lit upper face, its tendon pale
    // in the middle under the heart.
    if (t > -0.5 && t < 4) {
      const ten = sm(24, 29, x) * sm(43, 38, x), st = 0.8 + 0.2 * sin(x * 1.9 + t * 0.9), lit = 1 + 0.45 * sm(1.6, 0, t);
      lay(p, mix(232 * st, 214, ten) * 0.72 * lit, mix(82 * st, 198, ten) * 0.66 * lit, mix(96, 188, ten) * 0.66 * lit, cl(min(t + 0.5, 4 - t), 0, 1));
    }
    if (y < 19) {
      const hy = 3.4 + 0.03 * ax * ax;
      if (ax < 9.5) lay(p, 200, 192, 176, 0.5 * cl(1 - abs(y - hy) / 0.9, 0, 1));
      const top = 6 + 2.2 * max(0, 1 - ax / 2.4), hw = 7.4 - 0.42 * (y - 6), e = min(y - top, 14.6 - y, hw - ax);
      // The thyroid cartilage, its left plate lit and the right in shade.
      if (e > -0.5) lay(p, 206, 196, 184, cl(e + 0.5, 0, 1) * (0.42 + 0.2 * exp(-((ax / 1.8) ** 2)) + 0.25 * sm(1.2, 0.2, e)) * (x < 32 ? 1.05 : 0.78));
      if (y > 15 && y < 17.6 && ax < 4.9) lay(p, 214, 204, 192, 0.55 * cl(4.9 - ax, 0, 1));
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  P.t += dt;
  P.air = cl(k[0], 0, 1);
  const rate = cl(k[1], 0.2, 3), dep = cl(k[2], 0, 1), alt = cl(k[3], 0, 1);
  const bpm = (8 + 4.5 * rate + 12 * max(0, rate - 2) ** 2) * (1 + 0.45 * alt);
  P.D = (0.5 + 0.5 * dep) * (1 - 0.4 * sm(2, 3, rate)) * (1 + 0.22 * alt);
  if (input.btnPressed && input.btnPressed[0] && P.ct < 0) (P.ct = 0), (P.cv = P.vol), (P.cn = 0);
  let vol = 0, envIn = 0, envOut = 0, Fin = -1, Fx = 2;
  P.bf = [];
  P.jolt = 0;
  if (P.ct >= 0) {
    // A gasp, then three coughs, each a jolt and a burst of warm air up the tree.
    const c = (P.ct += dt);
    let j = 0;
    while (j < CK.length - 4 && c > CK[j + 2]) j += 2;
    vol = mix(j ? CK[j + 1] : P.cv, CK[j + 3], sm(CK[j], CK[j + 2], c));
    if (c < 0.4) (envIn = sin((PI * c) / 0.4) ** 0.5), (Fin = 1.12 * (1 - (1 - cl(c / 0.3, 0, 1)) ** 2));
    for (const tc of CT) {
      const u = c - tc;
      if (u > 0 && u < 0.7) P.bf.push(1 - u * 3.2), (P.jolt = max(P.jolt, 2.4 * exp(-u / 0.08)));
    }
    if (P.cn < 3 && c > CT[P.cn] + 0.28) P.puffs.push([0, 2, rnd()]), P.cn++;
    if (c > 1.9) (P.ct = -1), (P.ph = 0.9);
  } else {
    // In for 38% of a breath, out for half, then a short rest.
    const p = (P.ph = (P.ph + (dt * bpm) / 60) % 1);
    if (p < 0.38) (vol = 0.5 - 0.5 * cos((PI * p) / 0.38)), (envIn = sin((PI * p) / 0.38) ** 0.5), (Fin = 1.12 * (1 - (1 - cl(p / 0.3, 0, 1)) ** 2));
    else if (p < 0.88) {
      const u = (p - 0.38) / 0.5;
      (vol = 0.5 + 0.5 * cos(PI * u)), (envOut = sin(PI * u) ** 0.5), (Fx = 1.06 - 1.2 * sm(0.02, 0.8, u));
    }
    if (P.lp < 0.64 && p >= 0.64) P.puffs.push([0, 1, rnd()]);
    P.lp = p;
  }
  Object.assign(P, { vol, envIn, envOut, Fin, Fx });
  // The alveoli the cold air has reached take up oxygen fast; the rest give it
  // up slowly to the blood that carries it away.
  const wS = max(0, 2 * P.air - 1), hi = 1 - 0.66 * alt - 0.14 * wS, { cd, cox, airK } = P;
  for (let i = 0; i < cd.length; i++) {
    cox[i] += Fin > cd[i] ? (hi - cox[i]) * (1 - exp(-dt * 7)) : (0.05 - cox[i]) * (1 - exp(-dt * 0.85));
    airK[i] = envIn * exp(-(((Fin - cd[i]) / 0.07) ** 2));
  }
  P.hp = (P.hp + (dt * (62 + 10 * rate + 40 * alt)) / 60) % 1;
  P.hb = exp(-(((P.hp - 0.06) / 0.05) ** 2)) + 0.6 * exp(-(((P.hp - 0.3) / 0.05) ** 2));
  P.puffs = P.puffs.filter((f) => (f[0] += dt) < 5);
}

// Rest coordinates to the panel, breathed in by the per-row and per-column
// scales: out to the sides, down with the diaphragm.
let FX = 0, FY = 0;
function fw(P, xr, yr) {
  const { SX, KY } = P, kx = cl(32 + (xr - 32) * SX[cl(round(yr), 0, H - 1)], 0, 62.99), ki = floor(kx);
  FY = A0 + (yr - A0) * (KY[ki] + (KY[ki + 1] - KY[ki]) * (kx - ki));
  FX = 32 + (xr - 32) * SX[cl(round(FY), 0, H - 1)];
}

function alveoli(P) {
  const { alvA, alvS, alvK, ax, ay, as } = P, rA = 1.02 + 0.52 * P.vol * P.D;
  alvA.fill(0);
  for (let i = 0; i < ax.length; i++) {
    fw(P, ax[i], ay[i]);
    const cx = FX, cy = FY, r = rA * as[i], lim = (r + 0.5) ** 2;
    for (let y = max(0, ceil(cy - r - 0.5)); y <= min(H - 1, floor(cy + r + 0.5)); y++)
      for (let x = max(0, ceil(cx - r - 0.5)); x <= min(W - 1, floor(cx + r + 0.5)); x++) {
        const dx = x - cx, dy = y - cy, e2 = dx * dx + dy * dy;
        if (e2 >= lim) continue;
        const e = sqrt(e2), a = cl(r + 0.5 - e, 0, 1), p = y * W + x;
        const q = e / r, hx = dx + 0.4 * r, hy = dy + 0.45 * r, hl = max(0, 1 - sqrt(hx * hx + hy * hy) / (0.75 * r));
        const s = 0.72 + 0.28 * sqrt(max(0, 1 - q * q)) + 0.38 * hl * hl;
        if (a * s > alvA[p] * alvS[p]) (alvA[p] = a), (alvS[p] = s), (alvK[p] = i);
      }
  }
}

function tree(P) {
  const { seg: S, trA, trV, trS, trG, trH } = P, dil = 1 + 0.1 * P.vol * P.D;
  trA.fill(0);
  trH.fill(0);
  for (let j = 0; j < S.length; j += 8) {
    fw(P, S[j], S[j + 1]);
    const x0 = FX, y0 = FY;
    fw(P, S[j + 2], S[j + 3]);
    const ex = FX - x0, ey = FY - y0, l2 = ex * ex + ey * ey || 1e-6, r = S[j + 4] * dil, g = S[j + 5], da = S[j + 6], db = S[j + 7], lim = (r + 1.7) ** 2, hr = min(1, r);
    for (let y = max(0, floor(min(y0, FY) - r - 1)); y <= min(H - 1, ceil(max(y0, FY) + r + 1)); y++)
      for (let x = max(0, floor(min(x0, FX) - r - 1)); x <= min(W - 1, ceil(max(x0, FX) + r + 1)); x++) {
        const t = cl(((x - x0) * ex + (y - y0) * ey) / l2, 0, 1), px = x - x0 - ex * t, py = y - y0 - ey * t, e2 = px * px + py * py;
        if (e2 >= lim) continue;
        const e = sqrt(e2), a = cl(r + 0.5 - e, 0, 1), p = y * W + x, h = cl(r + 1.7 - e, 0, 1) * hr;
        if (h > trH[p]) trH[p] = h;
        if (a > trA[p]) (trA[p] = a), (trS[p] = da + (db - da) * t), (trV[p] = e / r), (trG[p] = g);
      }
  }
}

// The collarbones and ten ribs, faint arcs that lift and spread on a breath.
function ribs(P) {
  const { rib, SX } = P, v = P.vol * P.D;
  rib.fill(0);
  const dot = (fx, fy, rad, k) => {
    for (let y = max(0, round(fy) - 1); y <= min(H - 1, round(fy) + 1); y++)
      for (let x = max(0, round(fx) - 1); x <= min(W - 1, round(fx) + 1); x++) {
        const a = cl(rad + 0.5 - sqrt((x - fx) ** 2 + (y - fy) ** 2), 0, 1) * k, p = y * W + x;
        if (a > rib[p]) rib[p] = a;
      }
  };
  for (let i = 0; i <= 10; i++)
    for (const s of [-1, 1]) {
      if (i === 0) {
        for (let n = 0; n <= 50; n++) {
          const u = n / 50;
          dot(32 + s * (4.5 + 21 * u), 18.6 - 4.2 * u + 1.4 * sin(PI * u) - 1.2 * v, 0.5 + 0.4 * (2 * u - 1) ** 2, 0.85);
        }
        continue;
      }
      const yr = 23 + (i - 1) * 8.4, y0 = yr - v * (1 + 0.42 * i), hw = (1.5 + 28.4 * (1 - exp(-(yr - 15) / 14))) * SX[round(yr)];
      const rx = hw - 3, ry = (5.5 + 0.55 * i) * (1 - 0.25 * v), n = ceil((rx + ry) * 2.2);
      for (let m = 0; m <= n; m++) {
        const th = (1.62 * m) / n;
        dot(32 + s * (3 + rx * sin(th)), y0 + ry * (1 - cos(th)), 0.7, sm(0.2, 0.6, th));
      }
    }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.cox) return;
  const { SX, KY, sd, own, cox, cb, airK, und, ua, alvA, alvS, alvK, trA, trV, trS, trG, trH, rib, O, ak, soot, GL } = P, dm = 1 / P.dmax;
  const t = P.t, v = P.vol * P.D, air = P.air, hb = P.hb, { envIn, envOut, Fin, Fx, bf } = P;
  const wC = max(0, 1 - 2 * air), wW = 1 - abs(2 * air - 1), wS = max(0, 2 * air - 1);
  const pal = (c, w, s) => [0, 1, 2].map((i) => c[i] * wC + w[i] * wW + s[i] * wS);
  const bgT = pal([3, 7, 18], [16, 26, 48], [62, 50, 32]), bgB = pal([2, 4, 12], [8, 14, 30], [36, 28, 20]), glo = pal([8, 18, 40], [22, 38, 64], [40, 30, 18]);
  const cold = pal([150, 205, 255], [215, 238, 255], [196, 178, 128]), warm = pal([255, 196, 160], [255, 224, 206], [190, 160, 130]);
  const puffC = pal([255, 214, 196], [236, 242, 255], [168, 158, 144]), puffK = 0.6 * wC + 1.5 * wW + 0.7 * wS;
  const oxA = [240 - 64 * wS, 46 + 26 * wS, 58 + 20 * wS];
  for (let y = 0; y < H; y++) SX[y] = 1 + 0.085 * v * (0.25 + 0.75 * sm(15, 115, y));
  for (let x = 0; x < W; x++) KY[x] = 1 + 0.14 * v * GX[x];
  alveoli(P);
  tree(P);
  ribs(P);
  // The breath leaving at the top: each puff rises, spreads and thins.
  const pf = [];
  for (const [age, str, sd0] of P.puffs) {
    const R = 3 + (5 + 8 * wW) * age;
    pf.push(32 + (sd0 - 0.5) * 8, 6 - 3.2 * age, R, str * sm(0, 0.25, age) * exp(-age / (0.9 + 1.6 * wW)), sd0 * 40);
  }
  const hs = 1 / (1 - 0.035 * hb);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const fy = y / 127, gl = GL[p];
      let hz = 1;
      if (wS > 0) hz = 1 + wS * (0.18 * sin(x * 0.2 + y * 0.05 + t * 0.6) + 0.18 * sin(y * 0.13 - x * 0.06 - t * 0.35));
      for (let c = 0; c < 3; c++) C[c] = (bgT[c] + (bgB[c] - bgT[c]) * fy + glo[c] * gl) * hz;
      const xr = cl(32 + (x - 32) / SX[y], 0, 62.999), yr = cl(A0 + (y - A0) / KY[x], 0, 126.999);
      const xi = xr | 0, yi = yr | 0, fx = xr - xi, fz = yr - yi, q = yi * W + xi;
      if (ua[q] + ua[q + 1] + ua[q + W] + ua[q + W + 1] > 0) {
        const w0 = (1 - fx) * (1 - fz) * ua[q], w1 = fx * (1 - fz) * ua[q + 1], w2 = (1 - fx) * fz * ua[q + W], w3 = fx * fz * ua[q + W + 1], a = 1 - w0 - w1 - w2 - w3;
        const o0 = q * 3, o2 = o0 + W * 3;
        for (let c = 0; c < 3; c++) C[c] = C[c] * a + und[o0 + c] * w0 + und[o0 + 3 + c] * w1 + und[o2 + c] * w2 + und[o2 + 3 + c] * w3;
      }
      // The heart, dim behind the lungs, its apex down to the left.
      if (xr > 20 && xr < 56 && yr > 60 && yr < 110) {
        const dx = xr - 36.6, dy = yr - 86, hv = (dx * 0.6 + dy * 0.8) * hs, hu = (dx * 0.8 - dy * 0.6) * hs, eu = hu / (12.5 * (1 - 0.36 * sm(-6, 19, hv))), ev = hv / 19;
        const a = cl((1 - sqrt(eu * eu + ev * ev)) * 9, 0, 1);
        if (a > 0) {
          const k = (0.4 + 0.32 * hb) * (0.65 + 0.45 * sm(9, -9, hu));
          bl(150 * k, 26 * k, 44 * k, a);
        }
      }
      // The lung: a dusky body, the grape clusters of alveoli, the capillary
      // net shimmering on them, the pleura at the edge.
      const s = samp(sd, xr, yr), qn = round(yr) * W + round(xr);
      let m = 0;
      if (s < 1.2) {
        const c = own[qn], ox = c >= 0 ? cox[c] : 0.3;
        m = cl(0.5 - s, 0, 1);
        if (m > 0) bl(24 + 56 * ox, 14 - 4 * ox, 50 - 20 * ox, 0.92 * m);
        const aa = alvA[p];
        if (aa > 0) {
          const i = alvK[p], cc = ak[i], o = cox[cc], sh = alvS[p] * cb[cc] * (soot[i] < wS * 0.4 ? 0.3 : 1), af = 0.4 * airK[cc];
          for (let c = 0; c < 3; c++) C[c] += ((DA[c] + (oxA[c] - DA[c]) * o) * sh + cold[c] * af - C[c]) * aa;
        }
        const cv = hash(qn, 5);
        if (m > 0 && cv > 0.6) {
          const k = (cv - 0.35) * (0.75 + 0.75 * sin(t * 6 + cv * 90 + 2 * hb)) * (0.12 + 0.34 * ox) * m;
          (C[0] += 230 * k), (C[1] += 30 * k), (C[2] += 50 * k);
        }
        const rm = cl(1 - abs(s + 0.45) / 0.75, 0, 1) * 0.5;
        if (rm > 0) bl(126 + 129 * ox, 100 + 24 * ox, 214 - 70 * ox, rm);
        // A shadow along each airway lifts the tree off the alveoli.
        bl(0, 0, 0, trH[p] * 0.5 * m);
      }
      // The airways, and the air in them.
      const ta = trA[p];
      if (ta > 0) {
        const gg = trG[p], vv = trV[p], d = trS[p] * dm, wc = WC[gg], al = AG[gg] * ta;
        let wb = 0.85;
        if (gg <= 1) {
          const ring = 0.5 + 0.5 * cos(trS[p] * 2.73);
          wb = (0.5 + 0.5 * sm(0.35, 0.95, vv)) * (0.66 + 0.44 * ring * ring);
        } else if (gg <= 3) wb = 0.65 + 0.35 * sm(0.3, 1, vv);
        bl(wc[0] * wb, wc[1] * wb, wc[2] * wb, al);
        let ca = 0, wa = 0;
        if (envIn > 0 && d < Fin) ca = envIn * (0.3 + 0.7 * exp(-(((Fin - d) / 0.05) ** 2)));
        if (envOut > 0 && d > Fx) wa = envOut * (0.24 + 0.76 * exp(-(((d - Fx) / 0.05) ** 2)));
        for (const f of bf) wa += 1.3 * exp(-(((d - f) / 0.06) ** 2)) + (d > f ? 0.25 : 0);
        const lf = (gg <= 1 ? 1 - 0.5 * sm(0.55, 1, vv) : 1) * ta * (gg === 9 ? 0.8 : 0.9);
        for (let c = 0; c < 3; c++) C[c] += (cold[c] * ca + warm[c] * wa) * lf;
      }
      const rb = rib[p];
      if (rb > 0) bl(220, 210, 196, rb * (0.42 + 0.1 * m));
      if (y < 48 && pf.length) {
        let pa = 0;
        for (let j = 0; j < pf.length; j += 5) {
          const dx = (x - pf[j]) / (pf[j + 2] * 1.4), dy = (y - pf[j + 1]) / pf[j + 2], e = dx * dx + dy * dy;
          if (e < 4) pa += pf[j + 3] * exp(-e * 1.4) * cl(0.4 + 1.4 * (vn(x * 0.2 + pf[j + 4], y * 0.2 + t * 0.9) - 0.5) + 0.5 * exp(-e * 3), 0, 1.4);
        }
        if (pa > 0) bl(puffC[0], puffC[1], puffC[2], min(1, pa * puffK));
      }
      if (wS > 0) bl(120, 96, 62, 0.14 * wS * hz);
      O.set(C, p * 3);
    }
  // A cough jolts the whole chest up.
  const jl = round(P.jolt);
  for (let y = 0; y < H; y++) {
    const o = min(H - 1, y + jl) * W * 3;
    for (let x = 0; x < W; x++) display.setPixel(x, y, min(255, O[o + x * 3]) | 0, min(255, O[o + x * 3 + 1]) | 0, min(255, O[o + x * 3 + 2]) | 0);
  }
}
