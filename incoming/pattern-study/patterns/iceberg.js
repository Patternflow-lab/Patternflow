// ===== Patternflow pattern =====
// Title:   Iceberg
// Family:  polar
// Idea:    An iceberg cut through at the waterline: a ninth of it in the air with penguins on top, the rest below in banded glacier blue under shafts of light and bubble streams, until a slab calves off, splashes and sets it rocking.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after the schoolbook drawing of an iceberg with eight ninths of it under the water
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Shape=0..1, Swell=0..1
//
// Knob 1: Light. Midnight sun at 0, gold on the horizon at the right, lighting the berg's right faces; overcast noon in the middle; blue twilight at 1 with a moon, stars and an aurora.
// Knob 2: Speed. At 2 the first slab breaks off 3.5 seconds in and the next every 15 to 25 seconds; 0.2 is ten times slower.
// Knob 3: Shape. A tabular berg at 0, flat topped with five penguins on the snow; a pinnacle at 1, two spires of older, bluer ice over a keel that nearly reaches the bottom.
// Knob 4: Swell. How high the swell runs and how hard the berg bobs and leans in it; faster clouds, whitecaps on the far sea.
// Buttons: K1 tap breaks a slab off the berg now.

const W = 64, H = 128, N = W * H;
// Sea level, horizon, the berg's middle; its grid (u across, v down from sea level) turns about row PV.
const WL = 30, HZ = 26, BX = 28, BW = 64, BH = 128, U0 = -32, V0 = -28, PV = 34, NB = BW * BH;
const { min, max, floor, round, sin, cos, sqrt, exp, abs, PI } = Math;
const hypot = (a, b) => sqrt(a * a + b * b);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y, p = 1e9) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), x1 = (xi + 1) % p, y1 = (yi + 1) % p;
  const a = hash(xi % p, yi % p), b = hash(x1, yi % p), c = hash(xi % p, y1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(x1, y1)) * su * sv;
}
// Caustic noise; the colour the water leaves at each row.
const CT = new Float32Array(4096).map((_, k) => vn(((k & 63) * 20) / 64, ((k >> 6) * 20) / 64, 20));
const AT = new Float32Array(H * 3).map((_, q) => exp(-max(0, floor(q / 3) + 0.5 - WL) / [26, 75, 170][q % 3]));

// The top: a snow plain with sheer cliffs, or two spires.
const PIN = [[-13.5, 1], [-12, -3], [-10, -6], [-7.5, -10], [-5.5, -16], [-3.5, -19.5], [-1.5, -17.5], [0.5, -11], [2.5, -7.5], [4.5, -8.5], [6.5, -13], [8, -16], [9.5, -15], [11.5, -8], [13, -2.5], [14, 1]];
function topAt(u, s) {
  let i = 1;
  while (i < PIN.length - 1 && u > PIN[i][0]) i++;
  const [a, b] = PIN[i - 1], [c, e] = PIN[i], A = u > 0 ? u : -u * 1.05;
  const tab = A < 15 ? -11 + 0.8 * (vn(u * 0.3, 3) - 0.5) + 1.3 * sm(12.5, 15, A) : mix(-9.7, 1, cl((A - 15) / 1.1, 0, 1));
  return mix(tab, b + (e - b) * cl((u - a) / (c - a), 0, 1), s);
}
// Half widths under the water, tabular and pinnacle, a little lopsided.
const CV = [0, 5, 12, 22, 34, 46, 58, 68, 76, 82, 86];
const WT = [16.6, 20.5, 22, 22.5, 21.5, 21, 19.5, 16.5, 12.5, 8, 0];
const WP = [13.6, 15.5, 16.5, 16.5, 15.5, 14, 12, 9.5, 7, 4, 0];
const J = (h) => CV.map((_, i) => (i ? 0.88 + 0.24 * hash(i, h) : 1.03)), JL = J(5), JR = J(9);
function edgeAt(v, s) {
  const q = v / (1 + 0.1 * s);
  if (v < 0 || q >= 86) return [0, 0];
  let i = 0;
  while (CV[i + 1] <= q) i++;
  const f = (q - CV[i]) / (CV[i + 1] - CV[i]), w = mix(mix(WT[i], WP[i], s), mix(WT[i + 1], WP[i + 1], s), f), c = 2 * sin(v * 0.05);
  return [c - w * mix(JL[i], JL[i + 1], f), c + w * mix(JR[i], JR[i + 1], f)];
}

// Midnight sun, noon, twilight: sky stops, lit and shaded face, snow, water top
// and bottom, cloud lit and dark, shafts, light's side, ice, caustics.
const KF = [
  [[[0, 28, 50, 116], [10, 100, 104, 166], [19, 232, 158, 132], [26, 250, 200, 128]], [246, 206, 158], [70, 118, 196], [242, 226, 206], [14, 86, 114], [3, 12, 40], [250, 196, 168], [118, 104, 150], [1, 1, 1, 1]],
  [[[0, 118, 130, 148], [10, 156, 164, 178], [19, 186, 192, 200], [26, 200, 205, 210]], [214, 220, 226], [148, 166, 192], [226, 230, 236], [28, 108, 132], [5, 20, 48], [212, 216, 222], [128, 134, 150], [0.35, 0, 1.05, 0.5]],
  [[[0, 6, 12, 42], [10, 16, 30, 80], [19, 38, 62, 120], [26, 62, 94, 148]], [160, 188, 232], [58, 84, 148], [176, 198, 236], [8, 44, 80], [2, 6, 24], [70, 86, 130], [26, 34, 66], [0.45, -1, 0.62, 0.5]],
].map((k) => Float64Array.from(k.flat(2)));
// Glacier ice; the pinnacle is older ice, bluer all through.
const BASE = [92, 192, 226], PALE = [190, 234, 246], CLEAR = [30, 120, 214], VEIN = [12, 50, 172], RIM = [40, 64, 60], TINT = [0.7, 0.9, 1.06];
const BLK = [12, 14, 22], WHT = [226, 228, 236], SUN = [255, 214, 150], MOON = [224, 228, 214], AUR = [30, 190, 110], LT = [0.55, 0.92, 1];

export function setup(params) {
  const F32 = (n) => new Float32Array(n), pen = () => Object.fromEntries("on h u f st tu x y vx vy tt nb lx ly lt".split(" ").map((k) => [k, 0.5]));
  params.s = {
    f: F32(N * 3), ba: F32(N), sf: F32(W), rt: F32(176), row: F32(H * 3), P: new Float64Array(41), ex: F32(BH * 2), TT: F32(BW * 4 + 1),
    M: F32(NB), IC: [F32(NB), F32(NB), F32(NB)], SN: F32(NB), NX: F32(NB), AL: F32(NB), D: F32(NB),
    s: -1, t: 0.01, th: 0.01, thv: 0.01, thq: 0.01, by: 0.01, byv: 0.01, A: 0.5, k1: -1, k4: 0.06, live: 0, kx: 49.5, ky: 112.5,
    next: 3.4, nd: 0.5, pend: null, crack: 0.5, cuts: [], pieces: [], bubs: [], spray: [], rings: [], vacc: [0.5, 0.5, 0.5, 0.5, 0.5], dv: null,
    cl: [0, 1, 2, 3].map((k) => ({ x: 6 + k * 17 + 6 * rnd(), y: 5 + ((k * 5) % 13) + 2 * rnd(), w: 7 + 5 * rnd(), h: 1.7 + rnd() })),
    kr: Array.from({ length: 46 }, () => ({ p: rnd() * 6.3, q: rnd() * 6.3, w: 0.4 + 0.5 * rnd(), r: 1 + 6 * rnd() })),
    pens: [0, 1, 2, 3, 4].map((i) => Object.assign(pen(), { f: i % 2 ? 1 : -1, st: 0 })),
  };
}

const toW = (S, u, v) => [BX + cos(S.th) * u - sin(S.th) * (v - PV), WL + PV + S.by + sin(S.th) * u + cos(S.th) * (v - PV)];
// What the cuts leave at u, v. Cuts heal outward as the berg turns.
function cutA(cuts, u, v) {
  let a = 1;
  for (const c of cuts) if (v < 0.6 && (u - c.cx) ** 2 + (v - c.cy) ** 2 < 225) a *= cl(0.5 - (c.nx * u + c.ny * v - c.d), 0, 1);
  return a;
}
const topB = (S, u) => S.TT[cl(round((u - U0) * 4), 0, BW * 4)];
function edgeU(S, side) {
  for (let a = 0; a < 26; a += 0.5) if (topB(S, side * a) > -1.5 || cutA(S.cuts, side * a, topB(S, side * a) + 0.7) < 0.5) return side * (a - 1);
  return side * 12;
}
const surf = (S, x) => S.sf[cl(round(x), 0, W - 1)];

function build(S, s) {
  S.s = s;
  const { M, SN, NX, AL, D, TT, ex } = S, E = [], face = [];
  for (let q = 0; q <= BW * 4; q++) TT[q] = topAt(U0 + q / 4, s);
  for (let q = 0; q < BH * 4; q++) E.push(edgeAt(V0 + (q + 0.5) / 4, s));
  for (let k = 0; k < NB; k++) {
    let n = 0;
    for (let j = 0; j < 16; j++) {
      const qu = (k & 63) * 4 + (j & 3), qv = (k >> 6) * 4 + (j >> 2), u = U0 + (qu + 0.5) / 4, v = V0 + (qv + 0.5) / 4;
      if (v < 0 ? v >= TT[qu] : u > E[qv][0] && u < E[qv][1]) n++;
    }
    M[k] = n / 16;
  }
  // Distance to open water: a glowing rim, a darker core.
  for (let k = 0; k < NB; k++) D[k] = M[k] < 0.5 ? 0 : 20;
  for (let k = BW + 1; k < NB - 1; k++) D[k] = min(D[k], D[k - 1] + 1, D[k - BW] + 1, D[k - BW - 1] + 1.4, D[k - BW + 1] + 1.4);
  for (let k = NB - BW - 2; k > 0; k--) D[k] = min(D[k], D[k + 1] + 1, D[k + BW] + 1, D[k + BW + 1] + 1.4, D[k + BW - 1] + 1.4);
  for (let j = 0; j < BH * 2; j++) ex[j] = j & 1 ? -99 : 99;
  for (let k = 0; k < NB; k++) {
    const gu = k & 63, gv = k >> 6, u = U0 + gu + 0.5, v = V0 + gv + 0.5;
    if (M[k] <= 0) continue;
    // Facets: lit or shaded in the air; below, melt scallops lit on their lower walls.
    let bd = 1e9, id = 0, sv = 0;
    for (let j = 0; j < 9; j++) {
      const cu = floor(u / 5) + (j % 3) - 1, cv = floor(v / 5) + floor(j / 3) - 1, w = (cv + hash(cv, cu + 50)) * 5, dd = (u - (cu + hash(cu, cv)) * 5) ** 2 + (v - w) ** 2;
      if (dd < bd) (bd = dd), (id = hash(cu + 99, cv)), (sv = w);
    }
    const qu = gu * 4 + 2, sl = TT[min(BW * 4, qu + 2)] - TT[max(0, qu - 2)], dep = v - TT[qu];
    NX[k] = mix(sl / sqrt(1 + sl * sl), cl(u / 24 + 1.3 * (id - 0.5), -1, 1), sm(1, 3, dep));
    SN[k] = sm(2.4, 1.3, dep) * sm(1.6, 0.8, abs(sl));
    AL[k] = (0.86 + 0.14 * hash(gu, 7)) * (0.88 + 0.24 * id) * (v > -1.5 && v < 0 ? 0.7 : 1);
    // Layers of white and clear blue ice, dark veins of refrozen meltwater.
    const f = (v + u * 0.14 + 7 * vn(u * 0.04, v * 0.025 + 9)) / 8, n = floor(f), band = f - n, h1 = hash(n, 5);
    const mot = (0.84 + 0.3 * vn(u * 0.1 + 3, v * 0.07)) * (1 + 0.2 * cl((v - sv) / 3, -1, 1));
    const pale = sm(0.5, 0.6, band) * (1 - sm(0.6 + 0.3 * h1, 0.7 + 0.3 * h1, band)) * sm(0.25, 0.5, hash(n, 6)), clear = (1 - sm(0.2, 0.45, band)) * sm(0.4, 0.8, h1);
    const vein = max(sm(0.11, 0.03, abs(vn(u * 0.08 + 11, v * 0.045) * 2 - 1)), 0.8 * sm(0.1, 0.025, abs(vn(u * 0.045 + 31, v * 0.11 + 5) * 2 - 1))) * sm(0.25, 0.5, vn(u * 0.035 + 20, v * 0.03));
    const dk = D[k], core = (0.5 + 0.5 * exp(-max(0, dk - 1) / 5)) * (gv > 1 && M[k - 2 * BW] < 0.5 ? 1.3 : 1) * (gv < BH - 2 && M[k + 2 * BW] < 0.5 ? 0.76 : 1);
    for (let c = 0; c < 3; c++) S.IC[c][k] = mix(mix(mix(BASE[c] * mot, PALE[c], 0.8 * pale), CLEAR[c], 0.6 * clear), VEIN[c], 0.9 * vein) * core * mix(1, TINT[c], s) + exp(-dk / 1.2) * RIM[c];
    if (v > 3 && v < 80 && dk > 1.5) face.push([u, v]);
    (ex[gv * 2] = min(ex[gv * 2], u)), (ex[gv * 2 + 1] = max(ex[gv * 2 + 1], u));
  }
  S.vents = [0, 1, 2, 3, 4].map((i) => face[floor(hash(i, 41) * face.length)]);
  // Penguin places: flat, three columns apart, clear of the slabs.
  const slots = [];
  for (const u of [0.5, -6, 6.5, -3, 3.5, -8, 8, -1.5, 2, -4.5, 5]) {
    const q = round((u - U0) * 4);
    if (abs(TT[q + 6] - TT[q - 6]) < 1.6 && TT[q] < -2.5 && TT[q] > -15 && slots.length < 5 && slots.every((w) => abs(w - u) > 2.9)) slots.push(u + 0.01);
  }
  S.pens.forEach((p, i) => ((p.on = i < slots.length ? 1 : 0), p.on && (p.h = slots[i]), p.st || (p.u = p.h)));
}

const bub = (S, x, y, vy = -(4.5 + 5 * rnd()), wb = 0.6) => S.bubs.length < 260 && S.bubs.push({ x, y, vy, wb, ph: rnd() * 6.3, dead: 0 });
function splash(S, x, v, g) {
  const y = surf(S, x) - 0.5;
  for (let k = 0; k < 7 + 29 * g; k++) S.spray.push({ x: x + (rnd() - 0.5) * (2 + 3 * g), y, vx: (rnd() - 0.5) * (10 + 14 * g), vy: -(6 + rnd() * (9 + 17 * g)), l: 0.99 });
  S.rings.push({ x, t: 0.01, a: g ? min(3.2, 0.1 * v + 1.4) : 0.6 });
  for (let k = 0; k < 8 + 22 * g; k++) bub(S, x + (rnd() - 0.5) * 6, y + 1 + rnd() * (5 + 9 * g));
}

// A crack opens behind a slab of outer ice; it goes half a second later.
function calve(S) {
  if (S.pend || S.pieces.some((p) => p.f)) return;
  let side = rnd() < 0.5 ? -1 : 1;
  if (S.cuts.some((c) => c.side === side && c.age < 40)) side = -side;
  let ue = edgeU(S, side);
  if (abs(ue) < 12) (side = -side), (ue = edgeU(S, side));
  if (abs(ue) < 12) return;
  const px = side * max(9, abs(ue) - 3.5 - 3 * rnd()), nx = side * 0.993, d = nx * px + 0.6;
  const c = { nx, ny: -0.12, d, d0: d, cx: px, cy: -5, side, age: 0.01, bu: 0.5, bv: 0.5, ex: 0.5, hx: 0.5, hy: 0.5 };
  let u0 = 99, u1 = -99, v0 = 99, v1 = -99;
  for (let k = 0; k < NB; k++) {
    const u = U0 + (k & 63) + 0.5, v = V0 + (k >> 6) + 0.5;
    if (S.M[k] > 0.5 && cutA([c], u, v) < 0.5 && cutA(S.cuts, u, v) > 0.5) (u0 = min(u0, u)), (u1 = max(u1, u)), (v0 = min(v0, v)), (v1 = max(v1, v));
  }
  if (u1 - u0 < 1.5) return;
  Object.assign(c, { bu: (u0 + u1) / 2, bv: (v0 + v1) / 2, hx: (u1 - u0) / 2 + 0.5, hy: (v1 - v0) / 2 + 0.5 });
  c.ex = hypot(c.hx, c.hy) + 1.5;
  (S.pend = c), (S.crack = 0.5);
}

function step(S, d) {
  const t = (S.t += d), A = S.A, sf = S.sf;
  // The swell, and rings running out from each splash.
  const swell = (x) => A * (0.7 * sin(x * 0.15 - t * 1.4) + 0.3 * sin(x * 0.34 + t * 0.95 + 1));
  for (let x = 0; x < W; x++) {
    sf[x] = WL + swell(x + 0.5);
    for (const r of S.rings) {
      const q = abs(x + 0.5 - r.x) - 11 * r.t;
      sf[x] += r.a * exp(-r.t * 0.5 - (q / 5) ** 2) * sin(q * 0.9);
    }
  }
  for (const r of S.rings) r.t += d;
  S.rings = S.rings.filter((r) => r.t < 7);
  S.thv += (-2.4 * (S.th - S.thq - 0.022 * A * cos(BX * 0.15 - t * 1.4)) - 0.45 * S.thv) * d;
  S.byv += (-3 * (S.by - 0.5 * swell(BX)) - 1.2 * S.byv) * d;
  (S.th += S.thv * d), (S.by += S.byv * d), (S.thq *= exp(-d / 60));
  for (const c of S.cl) (c.x += (0.7 + 3 * S.k4) * d) > W + c.w + 2 && (c.x = -c.w - 2);

  if (S.live && (S.next -= d) <= 0) calve(S), (S.next = 15 + 10 * rnd());
  if (S.pend && (S.crack -= d) <= 0) {
    // The berg loses weight on that side, rocks and settles leaning a little.
    const c = S.pend, [x, y] = toW(S, c.bu, c.bv);
    S.cuts.push(c);
    S.pieces.push({ c, x, y, vx: c.side * 2.5, vy: 0.5, a: S.th, va: c.side * (1.4 + rnd()), f: 1, ta: 0.5 });
    (S.pend = null), (S.thv -= c.side * 0.1), (S.thq -= c.side * 0.012), (S.byv -= 1.6);
  }
  for (const c of S.cuts) (c.age += d) > 20 && (c.d += d * 0.12);
  S.cuts = S.cuts.filter((c) => c.age < 130);
  for (const p of S.pieces) {
    if (p.f) {
      (p.vy += 45 * d), (p.x += p.vx * d), (p.y += p.vy * d), (p.a += p.va * d);
      if (p.y > surf(S, p.x) - 1) splash(S, p.x, p.vy, 1), (p.f = 0), (p.vy *= 0.3), (p.ta = round(p.a / (PI / 2)) * (PI / 2));
    } else {
      const c = p.c, hy = abs(sin(p.a - S.th)) * c.hx + abs(cos(p.a - S.th)) * c.hy;
      (p.vy += (-5 * (p.y - surf(S, p.x) - 0.75 * hy) - 1.8 * p.vy) * d), (p.va += (-4 * (p.a - p.ta) - 1.6 * p.va) * d);
      (p.y += p.vy * d), (p.a += p.va * d), (p.x += c.side * 1.4 * d);
    }
  }
  S.pieces = S.pieces.filter((p) => abs(p.x - W / 2) < W / 2 + p.c.ex + 2);
  S.vents.forEach((v, i) => {
    if (sin(t * 0.6 + i * 2.1) > -0.2) for (S.vacc[i] += d * 3.5; S.vacc[i] >= 1; S.vacc[i]--) bub(S, ...toW(S, v[0], v[1]), -(5 + 0.6 * i + 1.2 * rnd()), 0.9);
  });
  for (const b of S.bubs) {
    (b.y += b.vy * d), (b.x += sin(t * 6 + b.ph) * b.wb * d);
    if (b.y < surf(S, b.x) + 0.3 || b.x < -1 || b.x > W + 1) b.dead = 1;
  }
  S.bubs = S.bubs.filter((b) => !b.dead);
  for (const p of S.spray) (p.vy += 50 * d), (p.x += p.vx * d), (p.y += p.vy * d), (p.l -= d * 0.8);
  S.spray = S.spray.filter((p) => p.l > 0 && !(p.vy > 0 && p.y > surf(S, p.x) + 0.5));
  (S.kx = 49 + 8 * sin(t * 0.1)), (S.ky = 112 + 7 * sin(t * 0.13 + 1));
  penguins(S, d, t);
}

// Now and then a penguin waddles to the edge, jumps, swims to the krill and leaps back.
function penguins(S, d, t) {
  for (const p of S.pens) if (!p.st && rnd() < d * 0.2) p.f = -p.f;
  let p = S.dv;
  if (!p && S.live && (S.nd -= d) <= 0) {
    const free = S.pens.filter((q) => !q.st && q.on);
    if (!free.length) return;
    p = S.dv = free.reduce((a, q) => (q.u > a.u ? q : a));
    Object.assign(p, { st: 1, tu: edgeU(S, 1) - 0.5 });
  }
  if (!p) return;
  if (p.st === 1 || p.st === 5) {
    const g = p.st === 1 ? p.tu : p.h;
    p.f = g > p.u ? 1 : -1;
    p.u += p.f * min(abs(g - p.u), 4 * d);
    if (abs(g - p.u) < 0.01) {
      if (p.st === 5) (p.st = 0), (S.dv = null), (S.nd = 5 + 6 * rnd());
      else ([p.x, p.y] = toW(S, p.u, topB(S, p.u) - 0.3)), Object.assign(p, { st: 2, vx: 7, vy: -9 });
    }
  } else if (p.st === 2) {
    (p.vy += 40 * d), (p.x += p.vx * d), (p.y += p.vy * d);
    if (p.vy > 0 && p.y > surf(S, p.x)) splash(S, p.x, 8, 0), Object.assign(p, { st: 3, vy: 12, vx: 3, tt: 0.01, nb: 0.01 });
  } else if (p.st === 3) {
    const back = (p.tt += d) > 5, dx = (back ? W - 6 : S.kx + 5 * cos(t * 2.2)) - p.x, dy = (back ? WL - 2 : S.ky + 3 * sin(t * 2.2)) - p.y, r = hypot(dx, dy) + 1e-6, sp = back ? 17 : 14;
    (p.vx += ((dx / r) * sp - p.vx) * min(1, 2.2 * d)), (p.vy += ((dy / r) * sp - p.vy) * min(1, 2.2 * d));
    (p.x = cl(p.x + p.vx * d, 1, W - 2)), (p.y = min(p.y + p.vy * d, H - 3));
    if ((p.nb += d) > 0.07) (p.nb = 0), bub(S, p.x - p.vx * 0.12, p.y - p.vy * 0.12);
    if (back && p.y < surf(S, p.x) + 1.5) splash(S, p.x, 6, 0), Object.assign(p, { st: 4, lx: p.x, ly: p.y, lt: 0.01, u: edgeU(S, 1) - 1 });
  } else {
    const [lx, ly] = toW(S, p.u, topB(S, p.u) - 0.3), l = (p.lt = min(1, p.lt + d / 0.7));
    (p.vx = lx - p.x), (p.vy = ly - p.y), (p.x = mix(p.lx, lx, l)), (p.y = mix(p.ly, ly, l) - 40 * l * (1 - l));
    if (l >= 1) p.st = 5;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], k1 = cl(k[0], 0, 1), k3 = cl(k[2], 0, 1);
  if (abs(k3 - S.s) > 0.01) build(S, k3);
  (S.k4 = cl(k[3], 0, 1)), (S.A = 0.45 + 3 * S.k4);
  if (k1 !== S.k1) {
    const [a, b, u] = k1 < 0.5 ? [0, 1, sm(0, 0.5, k1)] : [1, 2, sm(0.5, 1, k1)];
    for (let j = 0; j < 41; j++) S.P[j] = mix(KF[a][j], KF[b][j], u);
    S.k1 = k1;
  }
  for (; !S.live; S.live = S.t > 4 ? 1 : 0) step(S, 1 / 30);
  if (input.btnPressed && input.btnPressed[0]) S.next = 0;
  step(S, cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3) * 0.5);
}

let F, G, PL, RT, LR, LS, LC;
const LA = [0, 0, 0, 0], C3 = new Float64Array(3);
// Light under water: slanting shafts, and caustics on the ice (one noise twice, crossed).
function glow(x, y, dep, b) {
  const q = x + LS * (y - WL) + 56, q0 = cl(floor(q), 0, 174);
  let L = LR * mix(RT[q0], RT[q0 + 1], q - q0) * exp(-dep / 36) * 64 * (1 + 0.5 * b);
  if (b > 0 && dep < 34) L += LC * sm(0.75, 1, 1 - abs(CT[((y + LA[1]) & 63) * 64 + ((x + LA[0]) & 63)] - CT[((x + LA[2]) & 63) * 64 + ((y + LA[3]) & 63)]) * 4) * exp(-dep / 12) * (80 * b + 22);
  return L;
}
function put(x, y, c, a = 1) {
  (x = floor(x)), (y = floor(y));
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  for (let i = 0, o = (y * W + x) * 3; i < 3; i++) F[o + i] = mix(F[o + i], c[i], a);
}
const bl = (A, k, fx, fy) => mix(mix(A[k], A[k + 1], fx), mix(A[k + BW], A[k + BW + 1], fx), fy);
// One LED of the berg, or of slab q, read at body point u, v.
function paint(x, y, u, v, q) {
  const S = G, P = PL, gx = u - U0 - 0.5, gy = v - V0 - 0.5, x0 = floor(gx), y0 = floor(gy), i = y * W + x, o = i * 3, s = S.sf[x], c = C3, pc = S.pend;
  if (x0 < 0 || y0 < 0 || x0 >= BW - 1 || y0 >= BH - 1 || (q && (v > 0.6 || (u - q.cx) ** 2 + (v - q.cy) ** 2 > 225))) return;
  const k = y0 * BW + x0, fx = gx - x0, fy = gy - y0, a = bl(S.M, k, fx, fy) * (q ? cl(0.5 + (q.nx * u + q.ny * v - q.d0), 0, 1) : S.cuts.length && v < 0.6 ? cutA(S.cuts, u, v) : 1);
  if (a < 0.02) return;
  if (y + 0.5 < s) {
    const nx = bl(S.NX, k, fx, fy), sn = bl(S.SN, k, fx, fy), al = bl(S.AL, k, fx, fy), li = P[38] ? cl(0.5 + 0.8 * nx * P[38], 0, 1) : 0.6 + 0.25 * nx;
    for (let j = 0; j < 3; j++) c[j] = mix(mix(P[19 + j], P[16 + j], li), P[22 + j] * (0.88 + 0.12 * li), sn) * al;
  } else {
    const L = glow(x, y, y + 0.5 - s, 1);
    for (let j = 0; j < 3; j++) c[j] = bl(S.IC[j], k, fx, fy) * AT[y * 3 + j] * P[39] + 0.35 * S.row[y * 3 + j] + L * LT[j];
  }
  const ck = pc && v < 0.6 && abs(pc.nx * u + pc.ny * v - pc.d) < 0.6 ? 0.4 : 1;
  for (let j = 0; j < 3; j++) F[o + j] = mix(q ? F[o + j] : 0, c[j] * ck, q ? a : 1);
  S.ba[i] = max(S.ba[i], a);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.k1 < 0) return;
  F = S.f;
  const { ba, sf, rt, row, t, P, k1, ex } = S;
  const sunA = 1 - sm(0, 0.4, k1), moonA = sm(0.6, 1, k1), aur = sm(0.7, 1, k1), stars = sm(0.55, 0.9, k1);
  for (let y = 0; y < H; y++) {
    let k = 0;
    while (k < 2 && y > P[k * 4 + 4]) k++;
    const u = y <= HZ ? sm(P[k * 4], P[k * 4 + 4], y) : cl((y - WL) / 97, 0, 1) ** 0.75;
    for (let j = 0; j < 3; j++) row[y * 3 + j] = y <= HZ ? mix(P[k * 4 + 1 + j], P[k * 4 + 5 + j], u) : mix(P[25 + j], P[28 + j], u);
  }
  for (let q = 0; q < 176; q++) rt[q] = sm(0.45, 0.82, vn((q - 56) * 0.13 - t * 0.3, t * 0.05 + 7));
  (G = S), (PL = P), (RT = rt), (LR = P[37]), (LS = P[38] * 0.45), (LC = P[40] * (0.7 + 0.6 * S.k4));
  [7, -5, -6, 4].forEach((v, j) => (LA[j] = floor(t * v)));

  // The berg first, then the background where it shows, then the slabs.
  ba.fill(0);
  const ct = cos(S.th), st = sin(S.th), oy = WL + PV + S.by;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - oy, g0 = floor(ct * dy + PV - V0 - 0.5);
    let u0 = 99, u1 = -99;
    for (let j = max(0, g0 - 3); j <= min(BH - 1, g0 + 3); j++) (u0 = min(u0, ex[j * 2])), (u1 = max(u1, ex[j * 2 + 1]));
    for (let x = max(0, floor(BX + u0 - st * dy - 2)); x < min(W, BX + u1 - st * dy + 3); x++) {
      const dx = x + 0.5 - BX;
      paint(x, y, ct * dx + st * dy, -st * dx + ct * dy + PV, null);
    }
  }
  const sx = 55, sy = 21.5, mx = 12, my = 8, c = C3;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, A = ba[i], dep = y + 0.5 - sf[x];
    if (A > 0.995) continue;
    let g = 0, e = 0;
    if (y < HZ) {
      const ds = hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.1), dm = hypot(x + 0.5 - mx, y + 0.5 - my), cu = aur > 0 ? 0.5 + 0.5 * sin(x * 0.2 + 3 * vn(x * 0.05 + t * 0.06, 1) + t * 0.25) : 0;
      g = moonA * (0.25 * exp(-dm / 5) + (dm < 2.6 && hypot(x - 0.8 - mx, y + 1.1 - my) > 2.3 ? 0.9 : 0)) + (stars > 0 && hash(x, y + 11) < 0.016 ? stars * (0.25 + 0.5 * hash(y, x)) * (0.7 + 0.3 * sin(t * 3 + x * y)) * sm(HZ, 8, y) : 0);
      e = cu ? aur * sm(19, 6, y) * sm(0, 4, y) * cu * cu * vn(x * 0.6, t * 0.4) : 0;
      const gs = ds < 30 ? sunA * (0.55 * exp(-ds / 7) + (ds < 2.6 ? 1.2 : 0)) : 0;
      for (let j = 0; j < 3; j++) c[j] = row[y * 3 + j] + SUN[j] * gs + MOON[j] * g + AUR[j] * e;
      for (const q of S.cl) {
        const qx = (x + 0.5 - q.x) / q.w, qy = (y + 0.5 - q.y) / q.h;
        if (qx * qx + qy * qy > 2) continue;
        const a = 0.92 * sm(0, 0.45, 1 - qx * qx - qy * qy + 0.45 * (vn(x * 0.35 + q.w, y * 0.6) - 0.5)), u = sm(-1, 1, qy);
        for (let j = 0; j < 3; j++) c[j] = mix(c[j], mix(P[34 + j], P[31 + j], u), a);
      }
    } else if (dep < 0) {
      // The far sea: the sun's glitter path, whitecaps.
      g = sunA * (abs(x + 0.5 - sx) < 1.5 + (y - HZ) * 1.2 && hash(x, y + floor(t * 7) * 64) < 0.45 ? 0.75 : 0);
      e = S.k4 > 0.35 && hash(x + floor(t * 2) * 7, y) < (S.k4 - 0.35) * 0.3 ? 0.8 : 0;
      for (let j = 0; j < 3; j++) c[j] = mix(row[36 + j] * 0.55 + row[90 + j] * 0.45 + SUN[j] * g, 230, e);
    } else {
      // The surface's silver underside.
      (g = glow(x, y, dep, 0)), (e = dep < 2.5 ? (1 - dep / 2.5) * 0.5 : 0);
      for (let j = 0; j < 3; j++) c[j] = mix(row[y * 3 + j] + (j ? 90 : 60) * e + g * LT[j], row[78 + j] * 0.9, dep < 1 ? 0.55 : 0);
    }
    for (let j = 0; j < 3; j++) F[o + j] = mix(c[j], F[o + j], A);
  }
  for (const p of S.pieces) {
    const ca = cos(p.a), sa = sin(p.a), e = p.c.ex;
    for (let y = max(0, floor(p.y - e)); y < min(H, p.y + e); y++)
      for (let x = max(0, floor(p.x - e)); x < min(W, p.x + e); x++) {
        const dx = x + 0.5 - p.x, dy = y + 0.5 - p.y;
        paint(x, y, p.c.bu + ca * dx + sa * dy, p.c.bv - sa * dx + ca * dy, p.c);
      }
  }
  sprites(S, t, ba);
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}

function sprites(S, t, ba) {
  for (const k of S.kr) {
    const x = S.kx + cos(k.p + t * k.w) * k.r * 1.3, y = S.ky + sin(k.q + t * k.w * 1.3) * k.r * 0.7, i = floor(y) * W + floor(x);
    if (i >= 0 && i < N && ba[i] < 0.5) put(x, y, [255, 128, 118], (0.25 + 0.35 * S.P[39]) * (0.7 + 0.3 * sin(t * 4 + k.p * 9)));
  }
  for (const b of S.bubs) put(b.x, b.y, [214, 246, 255], 0.6);
  for (const p of S.pens) {
    if (!p.st && !p.on) continue;
    if (p.st === 0 || p.st === 1 || p.st === 5) {
      const [x, y] = toW(S, p.u, topB(S, p.u) - 0.3), f = p.f, B = round(x - 0.5) + (f > 0 ? 0 : 1), Y = floor(y) - (p.st && sin(t * 14) > 0 ? 1 : 0);
      put(B, Y - 3, BLK), put(B + f, Y - 3, BLK), put(B + 2 * f, Y - 3, [240, 168, 60], 0.8);
      for (let j = 0; j < 3; j++) put(B, Y - j, BLK), put(B + f, Y - j, WHT);
    } else {
      const r = hypot(p.vx, p.vy) + 1e-6, ux = p.vx / r, uy = p.vy / r;
      for (let j = -1.5; j <= 1.5; j += 0.5) put(p.x + ux * j, p.y + uy * j, BLK), j < 1 && put(p.x + ux * j - uy * (ux < 0 ? -1 : 1), p.y + uy * j + abs(ux), WHT, 0.9);
    }
  }
  for (const p of S.spray) put(p.x, p.y, [232, 240, 246], min(1, p.l * 1.3));
}
