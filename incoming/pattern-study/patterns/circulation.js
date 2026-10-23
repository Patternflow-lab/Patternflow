// ===== Patternflow pattern =====
// Title:   Circulation
// Family:  body
// Idea:    A standing figure drawn head to feet like an anatomical chart, whose heart beats lub-dub and sends each pulse of red blood out along the arteries to the head, hands and feet while blue blood flows back up the veins and the lungs flush pink.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after the anatomical wall charts of the human circulatory system
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Chart=0..1, Rate=1..5, Detail=1..4, Effort=0..1
//
// Knob 1: Chart. The red and blue anatomical chart at 0, an angiogram with the skeleton showing at 0.5, a thermal camera at 1.
// Knob 2: Rate. The resting heart rate, 36 a minute at 1, 72 at 2, 180 at 5; the faster, the closer the pulses follow each other.
// Knob 3: Detail. How far the vessels branch, from the named arteries and veins drawn bold at 1 to the capillaries at 4.
// Knob 4: Effort. From rest to a hard run: the heart beats faster and harder, the breath deepens and the arms and legs flush with blood.
// Buttons: K1 tap startles the figure: one hard beat at once and a rush of adrenaline that races the heart for a few seconds.

const W = 64, H = 128, N = W * H;
const { min, max, abs, exp, sin, cos, atan2, floor, ceil, round, hypot, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => ((v = clamp((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const g2 = (z) => exp(-z * z);
const rnd = () => Math.random();
const F32 = (n) => new Float32Array(n);

// Pulse tables, 100 steps a second; the arterial pulse and the venous return
// run at CA and CV LEDs a second.
const KS = 100, KN = 520, CA = 80, CV = 30;
// Vessel kinds: 0 artery, 1 vein, 2 and 3 the lungs' arteries and veins.
// Branch levels 1..4: spacing, length, radius; the turns a blocked branch tries.
const GAP = [0, 7, 3, 2.2, 1.8], LEN = [0, 9, 7, 5, 3.5], RAD = [0, 0.52, 0.43, 0.37, 0.33];
const TURN = [0, 0.5, -0.5, 1, -1];

// The trunk's half-width row by row, from the base of the neck to the crotch.
const TY = [22.5, 24, 25.5, 27.5, 31, 36, 44, 51, 57, 63, 67, 70.5];
const TW = [4.6, 9.5, 13, 14.3, 13.8, 13, 11.6, 10.3, 11, 12.4, 11.2, 6];
// Arm and leg axes on the viewer's left, x y radius per joint.
const ARM = [18.3, 28.4, 3.4, 12.8, 47, 2.6, 8.6, 64.5, 2.2, 7.6, 70.5, 2.1, 6.6, 76, 1.3];
const LEG = [26.4, 66, 5.9, 26.2, 94, 3.7, 25.8, 119.5, 2, 24, 124.8, 2.2];
// Capsules x1 y1 r1 x2 y2 r2 of the neck, an ear, a thumb, a calf and the
// limbs; the body is folded at the middle, so they stand for both sides.
const CAPS = [[31.5, 14, 4, 31.5, 24, 4.2], [25.1, 8.8, 1.2, 25.3, 11.6, 1], [7, 66.6, 1, 5.3, 70.6, 0.8], [25.6, 98, 3.5, 25.6, 110, 2.6]];
for (const L of [ARM, LEG]) for (let i = 0; i < L.length - 3; i += 3) CAPS.push([0, 1, 2, 3, 4, 5].map((j) => L[i + j]));
// The lungs: centre, radii, hilum. The heart's centre.
const LUNG = [[25, 38.6, 5.4, 11.6, 27.6, 34], [38.2, 39.2, 5.1, 11, 35.6, 34.5]];
const HX = 34.4, HY = 38.4;
// Artery and vein colours from the big trunks to the capillaries.
const RED = [[238, 30, 40], [238, 30, 40], [232, 38, 70], [215, 46, 110], [190, 56, 150]];
const BLUE = [[46, 70, 240], [46, 70, 240], [66, 68, 236], [96, 66, 226], [128, 66, 214]];
// The readout's 3x5 letters, five rows of three bits, and its heart.
const GLYPH = {
  0: 0x7b6f, 1: 0x2c97, 2: 0x73e7, 3: 0x73cf, 4: 0x5bc9, 5: 0x79cf, 6: 0x79ef, 7: 0x7292, 8: 0x7bef, 9: 0x7bcf,
  B: 0x6bae, P: 0x6ba4, M: 0x5fed,
};
const HEART = [10, 31, 31, 14, 4];

// A colour table from stops of position and r g b.
const lut = (s) =>
  Uint8Array.from({ length: 768 }, (_, n) => {
    const v = ((n / 3) | 0) / 255, c = n % 3;
    let j = 0;
    while (j < s.length - 8 && v > s[j + 4]) j += 4;
    return s[j + 1 + c] + (s[j + 5 + c] - s[j + 1 + c]) * clamp((v - s[j]) / (s[j + 4] - s[j]), 0, 1);
  });
// The angiogram and the thermal chart are one value through a colour table;
// the weights are in the order pal() reads them.
const CHARTS = [
  null,
  [lut([0, 0, 0, 0, 0.15, 8, 20, 38, 0.4, 42, 80, 112, 0.7, 150, 196, 220, 1, 240, 252, 255]), 0.04, 0.1, 0.07, 0.14, 0, 0.06, 0, 0, 0.74, 0.05, 0.07, 0.5, 0.5, 0.36, 0.2, 0.5, 0.3, 0.95],
  [lut([0, 0, 0, 10, 0.2, 34, 0, 86, 0.4, 145, 0, 140, 0.6, 232, 64, 36, 0.8, 255, 172, 0, 1, 255, 255, 210]), 0.07, 0.2, -0.05, 0.08, 0.3, 0.2, 0.18, 0.12, 0, 0.5, 0.16, 0.7, 0.3, 0.56, 0.12, 0.8, 0.2, 1],
];

// Distance to a segment, less a radius running r0..r1 along it.
function seg(x, y, x0, y0, x1, y1, r0, r1) {
  const dx = x1 - x0, dy = y1 - y0;
  const t = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1e-6), 0, 1);
  return hypot(x - x0 - dx * t, y - y0 - dy * t) - r0 - (r1 - r0) * t;
}

// Signed distance to the skin, negative inside.
function sdBody(x, y) {
  let d = (hypot((x - 31.5) / 6.4, (y - 9.8) / 8.6) - 1) * 6.4, i = 0;
  while (i < TY.length - 2 && y > TY[i + 1]) i++;
  const u = clamp((y - TY[i]) / (TY[i + 1] - TY[i]), 0, 1);
  d = min(d, max(abs(x - 31.5) - TW[i] - (TW[i + 1] - TW[i]) * u, TY[0] - y, y - TY[TY.length - 1]));
  const xr = x < 31.5 ? x : 63 - x;
  for (const c of CAPS) d = min(d, seg(xr, y, c[0], c[1], c[3], c[4], c[2], c[5]));
  return d;
}

function lung(x, y, j, br) {
  const L = LUNG[j], ry = L[3] * (1 + 0.07 * br);
  const dy = (y - L[1] - (ry - L[3]) * 0.8) / ry;
  return hypot(((x - L[0]) / (L[2] * (1 + 0.04 * br))) * (1 + 0.35 * max(0, -dy)), dy);
}

// The heart in its own frame: v runs from the base to the apex, u across.
function heart(P, x, y, s) {
  const dx = x - HX, dy = y - HY, k = s * 1.12;
  const v = (P.hv = (dx * 0.55 + dy * 0.835) / k), u = (P.hu = (dx * 0.835 - dy * 0.55) / k);
  return v < 0 ? hypot(u / 5, v / 4.6) : hypot(u / (5 * (1 - 0.8 * (v / 7) ** 1.5) + 0.05), v / 7);
}

// Points along a limb axis: t counts joints, f is the share of the radius off
// the axis, toward the outside of the limb when positive.
function limb(L, list) {
  const out = [];
  for (let i = 0; i < list.length; i += 2) {
    const t = list[i], k = min(floor(t), L.length / 3 - 2), u = t - k;
    const [x0, y0, r0, x1, y1, r1] = L.slice(k * 3, k * 3 + 6);
    const dx = x1 - x0, dy = y1 - y0, l = hypot(dx, dy), r = (r0 + (r1 - r0) * u) * list[i + 1];
    out.push(x0 + dx * u - (dy / l) * r, y0 + dy * u + (dx / l) * r);
  }
  return out;
}

export function setup(params) {
  const P = params;
  Object.assign(P, { t: 0, started: false, beats: [], ph: 0, br: 0, brPh: 0, adr: 0, det: -1, eh: 0, last: -9, f: {}, TA: F32(KN) });
  Object.assign(P, { TV: F32(KN), TP: F32(KN), hud: F32(N), c0: F32(3), c1: F32(3) });
  body(P), bones(P), vessels(P);
}

// Skin mask, rim, depth, muscle, and the way through the body from the heart.
function body(P) {
  const [m, rim, dep, mus] = ["m", "rim", "dep", "mus"].map((k) => (P[k] = F32(N)));
  const geo = (P.geo = F32(N).fill(1e4)), room = (P.room = new Uint8Array(N));
  P.tex = F32(N).map(() => 0.75 + 0.35 * rnd());
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p / W) | 0, sd = sdBody(x, y), lu = min(lung(x, y, 0, 0), lung(x, y, 1, 0));
    // Room to grow: 1 in the body but not the lungs or heart, 2 in the lungs.
    room[p] = lu < 0.9 ? 2 : sd < -0.6 && lu > 1.1 && hypot(x - HX, y - HY) > 6.5 ? 1 : 0;
    [m[p], rim[p], dep[p]] = [clamp(0.5 - sd, 0, 1), clamp(1 - abs(sd + 0.7) / 1.1, 0, 1), clamp(-sd / 5, 0, 1)];
    mus[p] = m[p] * (y > 68 ? 1 : smooth(12.5, 14.5, abs(x - 31.5)));
  }
  geo[38 * W + 34] = 0;
  const NB = [1, 1, W, 1, W + 1, 1.414, W - 1, 1.414];
  for (let pass = 0; pass < 4; pass++)
    for (let q = 0, sg = pass & 1 ? 1 : -1; q < N; q++) {
      const p = sg > 0 ? N - 1 - q : q;
      if (m[p] > 0.2)
        for (let j = 0; j < 8; j += 2) if (geo[p + sg * NB[j]] + NB[j + 1] < geo[p]) geo[p] = geo[p + sg * NB[j]] + NB[j + 1];
    }
  P.core = Float32Array.from(geo, (g) => exp(-g / 55));
}

// The skeleton for the angiogram: radius, brightness and a polyline for each
// bone of the left half, which is mirrored.
const BONES = [
  [0.5, 0.8, 26.5, 12.6, 26.9, 15.4, 28.6, 17.3, 31.6, 17.8], [0.55, 0.8, 31.6, 25.4, 25, 24.6, 19.5, 26.4], [0.7, 0.7, 31.6, 26.6, 31.6, 41],
  [0.6, 0.75, 31.6, 63.5, 27.5, 62.4, 23.2, 59.2, 21, 60.5, 21.6, 64.5, 25, 68.8, 29.5, 69.8, 31.6, 69.6],
  [1, 0.9, 26.2, 66.8, 26.4, 70, 26.2, 92], [0.85, 0.9, 26.6, 96, 26.4, 118.5], [0.45, 0.7, 24, 97, 24.4, 118.5],
  [0.7, 0.75, 25.8, 120.5, 24.6, 124.5, 23.2, 126.2], [0.95, 0.9, 18.3, 28.4, 12.9, 46.6],
  [0.55, 0.8, 12.2, 47.8, 7.9, 64.2], [0.55, 0.8, 13.6, 47.6, 9.5, 64.4], [0.45, 0.7, 8.6, 65.6, 6.4, 76],
];
function bones(P) {
  const bone = (P.bone = F32(N)), skull = [0.5, 0.9], all = [skull, ...BONES];
  for (let a = 0; a < 2; a += 0.2) skull.push(31.5 - 5.6 * sin(a), 9.6 - 7.6 * cos(a));
  for (let y = 18.5; y < 64; y += 2.7) all.push([0.8, 0.85, 30.8, y, 32.2, y]);
  for (let i = 0; i < 8; i++) {
    const y = 27.6 + i * 2.5, w = 21.7 + i * 0.3;
    all.push([0.42, 0.65, 30.6, y, 26, y - 0.9, w, y + 1.2, w + 0.2, y + 3.4, w + 3 + i * 0.4, y + 5.2, 29.8 - i * 0.2, y + 6.2 - i * 0.2]);
  }
  for (const [r, v, ...q] of all)
    for (let i = 2; i < q.length; i += 2) {
      const [x0, y0, x1, y1] = q.slice(i - 2, i + 2);
      for (let y = max(0, floor(min(y0, y1) - r - 1)); y <= min(H - 1, ceil(max(y0, y1) + r + 1)); y++)
        for (let x = max(0, floor(min(x0, x1) - r - 1)); x <= min(31, ceil(max(x0, x1) + r + 1)); x++) {
          const a = clamp(0.5 - seg(x, y, x0, y0, x1, y1, r, r), 0, 1) * v, p = y * W + x;
          if (a > bone[p]) bone[p] = bone[p + 63 - 2 * x] = a;
        }
    }
}

// The named vessels; four levels of branches grow between them.
function vessels(P) {
  const ves = (P.ves = []);
  const add = (kind, parent, r, pts) => (ves.push({ kind, parent, r, pts, lv: 0 }), ves[ves.length - 1]);
  const pair = (kind, pr, pl, r, pts) => [add(kind, pr, r, pts), add(kind, pl, r, pts.map((v, i) => (i & 1 ? v : 63 - v)))];
  // Arteries, from the aorta out.
  const ao = add(0, null, 1.3, [33.4, 35.5, 32.4, 31.6, 32.7, 29, 34, 27.6, 35.8, 28.4, 36.1, 31, 34.9, 35, 33.9, 40, 33.4, 47, 33, 55, 31.5, 62.5]);
  const bc = add(0, ao, 1, [32.9, 28.3, 30.8, 26.9, 29.6, 25.6]);
  const carR = add(0, bc, 0.8, [29.6, 25.6, 30, 21.5, 30, 17.5, 29.6, 15]);
  const carL = add(0, ao, 0.8, [34.4, 27.8, 33.4, 24.5, 33, 21.5, 33, 17.5, 33.4, 15]);
  pair(0, carR, carL, 0.6, [29.6, 15, 29.1, 12.2, 29.6, 9.6, 30.8, 8]);
  pair(0, carR, carL, 0.55, [29.6, 15.4, 27.6, 13.6, 26.3, 10.2, 26.6, 6, 28.4, 3]);
  const subR = add(0, bc, 0.9, [29.6, 25.6, 26.2, 26, 22.6, 26.7, 19.8, 28]);
  const subL = add(0, ao, 0.9, [35.8, 28.4, 37.8, 26.6, 40.6, 26.8, 43.2, 28]);
  const [brR, brL] = pair(0, subR, subL, 0.8, [19.8, 28, ...limb(ARM, [0.15, -0.3, 0.5, -0.28, 0.85, -0.22, 1, -0.1])]);
  pair(0, brR, brL, 0.55, limb(ARM, [1, -0.1, 1.2, 0.35, 1.6, 0.42, 2, 0.42, 2.3, 0.15, 2.5, -0.2]));
  const [ilR, ilL] = pair(0, ao, ao, 1, [31.5, 62.5, 30, 64.2, 28.6, 66.3]);
  const [feR, feL] = pair(0, ilR, ilL, 0.85, [28.6, 66.3, ...limb(LEG, [0.08, -0.32, 0.4, -0.3, 0.75, -0.24, 1, -0.12])]);
  pair(0, feR, feL, 0.55, limb(LEG, [1, -0.12, 1.25, -0.32, 1.6, -0.36, 1.95, -0.4, 2.3, -0.15, 2.75, 0.1]));
  pair(0, feR, feL, 0.55, limb(LEG, [1.02, 0, 1.2, 0.36, 1.6, 0.42, 2, 0.32, 2.45, 0.2, 2.95, 0.35]));
  // Veins, from the venae cavae out; the sinus over the brain joins the jugulars.
  const svc = add(1, null, 1.2, [30.3, 35.6, 29.9, 31, 29.9, 27.4]);
  const bvR = add(1, svc, 1, [29.9, 27.4, 28.2, 26, 26.6, 25.4]);
  const bvL = add(1, svc, 0.9, [29.9, 27.4, 32.4, 26.3, 34.8, 25.6, 36.4, 25.4]);
  pair(1, bvR, bvL, 0.8, [28.4, 25.8, 28.4, 21.5, 28.5, 17.5, 28.3, 14.4, 27.6, 11.6, 27.9, 7.2, 29.4, 4.6, 31.5, 3.9]);
  const [axR, axL] = pair(1, bvR, bvL, 0.9, [26.6, 25.4, 23.2, 26.1, 20.4, 27.8]);
  pair(1, axR, axL, 0.55, [20.4, 27.8, ...limb(ARM, [0.2, -0.68, 0.6, -0.64, 1, -0.68, 1.5, -0.78, 2, -0.78, 2.25, -0.45])]);
  pair(1, axR, axL, 0.5, [21.2, 27, ...limb(ARM, [0.08, 0.5, 0.5, 0.64, 1, 0.7, 1.5, 0.78, 2, 0.78, 2.25, 0.5])]);
  const ivc = add(1, null, 1.2, [30.5, 42.5, 30.8, 48, 31, 56, 31.4, 62.8]);
  const [icR, icL] = pair(1, ivc, ivc, 1, [31.4, 62.8, 30, 65.4, 29.8, 67.2]);
  pair(1, icR, icL, 0.8, [29.8, 67.2, ...limb(LEG, [0.1, -0.54, 0.4, -0.54, 0.75, -0.46, 1, -0.3, 1.3, -0.05, 1.7, 0, 2, 0.02, 2.4, -0.1])]);
  pair(1, icR, icL, 0.5, [30, 68, ...limb(LEG, [0.15, -0.8, 0.5, -0.82, 1, -0.82, 1.5, -0.86, 2, -0.85, 2.4, -0.5, 2.8, -0.3])]);
  // The lungs: blue blood out along the pulmonary arteries, red back.
  const pt = add(2, null, 1.1, [32.4, 37, 31.6, 33.4, 31.8, 31.4]);
  pair(2, pt, pt, 0.8, [31.8, 31.4, 29, 31.8, 26.4, 33.4, 25, 35]);
  add(3, null, 0.8, [35, 36.2, 31.4, 37, 28, 37.4, 25.6, 38.6]);
  add(3, null, 0.8, [35.6, 35.8, 37.6, 36.6, 39.2, 37.8]);
  for (const v of ves) samples(v);
  grow(P);
}

// Resample a vessel every 0.4 LED with its distance from the heart.
function samples(v) {
  const { pts, parent: q } = v;
  let d = v.d0 || 0, best = 1e9;
  if (q && v.d0 === undefined)
    for (let i = 0; i < q.x.length; i++) {
      const e = hypot(q.x[i] - pts[0], q.y[i] - pts[1]);
      if (e < best) [best, d] = [e, q.d[i] + e];
    }
  [v.x, v.y, v.d] = [[pts[0]], [pts[1]], [d]];
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2], y0 = pts[i - 1], dx = pts[i] - x0, dy = pts[i + 1] - y0, l = hypot(dx, dy), n = max(1, ceil(l / 0.4));
    for (let k = 1; k <= n; k++) v.x.push(x0 + (dx * k) / n), v.y.push(y0 + (dy * k) / n), v.d.push(d + (l * k) / n);
    d += l;
  }
}

// Branches grow level by level, shuffled so arteries and veins take their room
// in turn; a branch bends away from the skin or another vessel, or stops.
function grow(P) {
  const occ = new Uint8Array(N);
  const mark = (v) => v.x.forEach((x, i) => (occ[round(v.y[i]) * W + round(x)] = 1));
  P.ves.forEach(mark);
  let front = P.ves.slice();
  for (let lv = 1; lv <= 4; lv++) {
    const next = [];
    front.sort(() => rnd() - 0.5);
    for (const v of front) {
      const n = v.x.length, want = v.kind >= 2 ? 2 : 1;
      for (let s = GAP[lv] * rnd(); s < n * 0.4 - 0.8; s += GAP[lv] * (0.6 + 0.8 * rnd())) {
        const i = min(n - 2, round(s / 0.4)), len = LEN[lv] * (0.5 + rnd());
        let a = atan2(v.y[i + 1] - v.y[i], v.x[i + 1] - v.x[i]) + (rnd() < 0.5 ? -1 : 1) * (0.35 + 0.6 * rnd());
        let x = v.x[i], y = v.y[i];
        const pts = [x, y];
        for (let st = 1; st <= len; st++) {
          a += (rnd() - 0.5) * 0.7;
          const turn = TURN.find((tu) => {
            const nx = x + cos(a + tu), ny = y + sin(a + tu);
            const q = round(ny) * W + round(nx);
            return P.room[q] === want && (st < 2 + v.r || !occ[q]);
          });
          if (turn === undefined) break;
          a += turn;
          pts.push((x += cos(a)), (y += sin(a)));
        }
        if (pts.length < 6) continue;
        const b = { kind: v.kind, parent: v, r: RAD[lv], pts, lv, d0: v.d[i] };
        samples(b), mark(b), next.push(b);
      }
    }
    P.ves.push(...(front = next));
  }
}

// The vessels Detail shows in a red and a blue layer: weight, key (seconds
// after a beat), level, pulse or flow. Low detail draws the trunks bold.
function raster(P, det) {
  for (const k of ["wR", "kR", "lR", "mR", "wB", "kB", "lB", "mB"]) (P[k] = P[k] || F32(N)).fill(0);
  for (const v of P.ves) {
    const vis = clamp(((det - 1) * 7) / 6 + 1.5 - v.lv, 0, 1);
    if (vis <= 0) continue;
    const red = v.kind === 0 || v.kind === 3, flow = v.kind & 1;
    const [w, kk, l, mo] = red ? [P.wR, P.kR, P.lR, P.mR] : [P.wB, P.kB, P.lB, P.mB];
    const r = v.r * (v.lv ? 1 : 1.25 - 0.15 * (det - 1)), g = v.lv ? 0 : 0.9, e0 = r + g + 0.5;
    for (let i = 0; i < v.x.length; i++) {
      const x = v.x[i], y = v.y[i], key = flow ? max(0, 0.3 + (125 - v.d[i]) / CV) : v.d[i] / CA;
      for (let py = max(0, ceil(y - e0)); py <= min(H - 1, floor(y + e0)); py++)
        for (let px = max(0, ceil(x - e0)); px <= min(W - 1, floor(x + e0)); px++) {
          const e = hypot(px - x, py - y), p = py * W + px;
          let a = clamp(r + 0.5 - e, 0, 1);
          if (g) a = max(a, 0.16 * clamp(e0 - e, 0, 1));
          if ((a *= vis) > w[p]) [w[p], kk[p], l[p], mo[p]] = [a, key, v.lv, flow];
        }
    }
  }
}

export function update(dt, input, params) {
  const P = params;
  if (!P.ves) setup(P);
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  P.chart = clamp(k[0], 0, 1);
  const rate = clamp(k[1], 1, 5), det = clamp(k[2], 1, 4), E = (P.E = clamp(k[3], 0, 1));
  if (abs(det - P.det) > 0.02) raster(P, (P.det = det));
  let kick = false;
  if (input.btnPressed && input.btnPressed[0]) {
    P.adr = 1;
    if (P.t - P.last > 0.28) [P.ph, kick] = [1, true];
  }
  P.adr *= exp(-dt / 5);
  P.bpm = min(200, 36 * rate * (1 + 0.6 * E * E) + 75 * P.adr);
  const T = (P.T = 60 / P.bpm);
  P.tsys = clamp(0.16 + 0.17 * T, 0.2, 0.36);
  P.stroke = 1 + 0.45 * E + 0.5 * P.adr;
  if (!P.started) {
    // Open as if the heart had been beating for a while.
    P.started = true;
    for (let i = 12; i >= 1; i--) P.beats.push([-(i - 0.6) * T, P.stroke]);
    [P.ph, P.last, P.brPh] = [0.6, -0.6 * T, 0.15];
  }
  P.t += dt;
  if ((P.ph += dt / T) >= 1) {
    P.last = P.t - (P.ph = kick ? 0 : P.ph % 1) * T;
    P.beats.push([P.last, P.stroke * (kick ? 1.5 : 1)]);
  }
  while (P.beats.length && P.t - P.beats[0][0] > 5.6) P.beats.shift();
  P.brPh += dt / max(1, 4.4 - 2.6 * E - 1.2 * P.adr);
  P.br = (0.5 - 0.5 * cos(2 * PI * P.brPh)) * (0.55 + 0.45 * E + 0.4 * P.adr);
  P.eh = (P.eh + dt * 16) % 18;
  tables(P), readout(P);
}

// Each beat's waves by the time since it: TA the sharp arterial pulse with its
// dicrotic notch, TP the softer flush of the tissue, TV the venous swell.
function tables(P) {
  const { TA, TV, TP, t } = P, td = 0.13 * (1 + 0.4 * P.E);
  TA.fill(0), TV.fill(0), TP.fill(0);
  const span = (age, a, b, fn) => {
    for (let k = max(0, ceil((age - a) * KS)); k <= min(KN - 1, floor((age + b) * KS)); k++) fn(k, age - k / KS);
  };
  for (const [tb, a] of P.beats) {
    const age = t - tb;
    span(age, 0.9, 0, (k, s) => (TA[k] += a * ((1 - exp(-s / 0.02)) * exp(-s / td) + 0.22 * g2((s - 0.3) / 0.05))));
    span(age, 1.4, 0, (k, s) => (TP[k] += a * (1 - exp(-s / 0.06)) * exp(-s / 0.26)));
    span(age, 0.4, 0.4, (k, s) => (TV[k] += a * g2(s / 0.13)));
  }
}

const look = (T, key) => {
  const f = key * KS, i = f | 0;
  return i < KN - 1 ? T[i] + (T[i + 1] - T[i]) * (f - i) : 0;
};

function ecgAt(P, tt) {
  let v = 0;
  for (const [tb] of P.beats) {
    const s = tt - tb;
    if (s > -0.3 && s < 0.6)
      v += 0.13 * g2((s + 0.16) / 0.03) - 0.12 * g2((s + 0.022) / 0.01) + g2(s / 0.016) - 0.28 * g2((s - 0.03) / 0.012) + 0.3 * g2((s - P.tsys + 0.07) / 0.055);
  }
  return v;
}

// The monitor beside the feet: an ECG sweep on the left, the rate on the right.
function readout(P) {
  const { hud } = P;
  hud.fill(0, 100 * W, 120 * W);
  for (let y = 104; y < 117; y += 3) for (let x = 2; x < 19; x += 3) hud[y * W + x] = 0.12;
  for (let c = 0; c < 18; c++) {
    const a = (P.eh - c + 18) % 18;
    if (a > 16.4) continue;
    let lo = 999, hi = 0;
    for (let s = 0; s <= 6; s++) {
      const yy = round(112 - 8 * ecgAt(P, P.t - (a + s / 6) / 16));
      [lo, hi] = [min(lo, yy), max(hi, yy)];
    }
    for (let y = max(101, lo); y <= min(118, hi); y++) hud[y * W + c + 1] = a < 1 ? 1 : 0.95 - (0.55 * a) / 18;
  }
  const fl = 0.45 + 0.55 * g2((P.t - P.last - 0.05) / 0.08);
  HEART.forEach((row, j) => {
    for (let i = 0; i < 5; i++) if ((row >> (4 - i)) & 1) hud[(105 + j) * W + 46 + i] = fl;
  });
  const put = (s, x0, y0, b) => {
    for (let n = 0; n < s.length; n++)
      for (let q = 0; q < 15; q++) if ((GLYPH[s[n]] >> (14 - q)) & 1) hud[(y0 + ((q / 3) | 0)) * W + x0 + n * 4 + (q % 3)] = b;
  };
  const txt = String(round(P.bpm));
  put(txt, 63 - txt.length * 4, 105, 0.95);
  put("BPM", 51, 112, 0.55);
}

export function draw(display, params) {
  const P = params;
  if (!P.wR) return;
  const { m, rim, dep, core, geo, bone, tex, mus, hud, TA, TV, TP, wR, kR, lR, mR, wB, kB, lB, mB, f, c0, c1, E, br } = P;
  const fc = P.chart * 2, i0 = min(1, floor(fc)), u = smooth(0.3, 0.7, fc - i0);
  // The heart squeezes in systole and flashes on the first sound, less on the second.
  const since = P.t - P.last, sys = since < P.tsys ? sin((PI * since) / P.tsys) ** 0.7 : 0;
  const s = 1 - (0.1 + 0.08 * E + 0.05 * P.adr) * sys;
  const flash = g2((since - 0.03) / 0.06) + 0.6 * g2((since - P.tsys) / 0.045);
  // The more capillaries drawn, the more the skin flushes as a pulse passes.
  const bla = 0.3 + 0.24 * (P.det - 1);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      Object.assign(f, { y, m: m[p], rim: rim[p], dep: dep[p], core: core[p], mus: mus[p], bone: bone[p], hud: hud[p], lw: 0, hw: 0, ho: 0 });
      f.bl = m[p] > 0 ? look(TP, geo[p] / CA + 0.04) * (bla + 0.3 * E + 0.7 * E * mus[p]) : 0;
      if (x > 17 && x < 46 && y > 24 && y < 54) {
        const e0 = lung(x, y, 0, br), e1 = lung(x, y, 1, br), e = min(e0, e1), L = LUNG[e0 < e1 ? 0 : 1];
        if (e < 1.05) {
          f.lw = clamp((1.03 - e) * 7, 0, 1) * m[p];
          f.lrim = clamp(1 - abs(e - 0.92) / 0.1, 0, 1);
          f.ox = clamp(0.2 + 0.4 * br + 0.5 * look(TP, hypot(x - L[4], y - L[5]) / 40 + 0.06), 0, 1.2);
          f.lt = tex[p];
        }
      }
      if ((f.wb = wB[p]) > 0) [f.bm, f.bp, f.lb] = [mB[p], look(mB[p] ? TV : TA, kB[p]), lB[p]];
      if ((f.wr = wR[p]) > 0) [f.rm, f.rp, f.lr] = [mR[p], look(mR[p] ? TV : TA, kR[p]), lR[p]];
      if (x > 24 && x < 45 && y > 27 && y < 49) {
        const e = heart(P, x, y, s);
        f.ho = clamp((1.3 - e) * 5, 0, 1);
        if (e < 1.1) {
          f.hw = clamp((1.02 - e) * 5, 0, 1);
          f.hs = smooth(-0.9, 0.3, P.hu);
          f.hr = clamp(1 - abs(e - 0.86) / 0.16, 0, 1);
          f.hb = 0.62 + 0.45 * flash + 0.2 * sys - (abs(P.hu + 0.3) < 0.4 && P.hv > -2 ? 0.25 : 0);
        }
      }
      if (i0 === 0) anat(f, c0);
      else pal(f, CHARTS[1], c0, E);
      if (u > 0) {
        pal(f, CHARTS[i0 + 1], c1, E);
        for (let c = 0; c < 3; c++) c0[c] += (c1[c] - c0[c]) * u;
      }
      display.setPixel(x, y, min(255, c0[0]), min(255, c0[1]), min(255, c0[2]));
    }
}

// Lerp o toward the colour c at brightness b by w; past full brightness it
// runs toward a hot pale core.
function tint(o, c, b, w) {
  const k = min(b, 1), h = max(0, b - 1) * 0.9;
  o[0] += (c[0] * k + 255 * h - o[0]) * w;
  o[1] += (c[1] * k + 190 * h - o[1]) * w;
  o[2] += (c[2] * k + 170 * h - o[2]) * w;
}

// The anatomical chart: a pale ghost of a body on a slate ground.
function anat(f, o) {
  const top = 1 - f.y / H, t = f.rim, bl = f.bl;
  [o[0], o[1], o[2]] = [2 + 3 * top, 5 + 5 * top, 12 + 9 * top];
  if (f.m > 0) tint(o, [18 + 34 * t + 8 * f.dep + 80 * bl, 26 + 44 * t + 10 * f.dep + 14 * bl, 42 + 50 * t + 16 * f.dep + 40 * bl], 1, f.m);
  if (f.lw > 0) {
    const ox = f.ox;
    tint(o, [70 + 170 * ox, 60 + 30 * ox, 160 - 40 * ox], f.lt * (0.55 + 0.35 * ox) + 0.35 * f.lrim, f.lw);
  }
  const vb = () => f.wb > 0 && tint(o, BLUE[f.lb], (f.bm ? 0.36 + 0.8 * f.bp : 0.4 + 1.05 * f.bp) + 0.04 * f.lb, f.wb);
  const vr = () => f.wr > 0 && tint(o, RED[f.lr], (f.rm ? 0.36 + 0.8 * f.rp : 0.32 + 1.05 * f.rp) + 0.05 * f.lr, f.wr);
  // The vessel that owns the LED is drawn last.
  if (f.wb > f.wr) vr(), vb();
  else vb(), vr();
  for (let c = 0; c < 3; c++) o[c] *= 1 - 0.55 * f.ho;
  if (f.hw > 0) {
    const hs = f.hs, b = f.hb, k = 0.45 * f.hr;
    tint(o, [(70 + 170 * hs) * b + 255 * k, (80 - 45 * hs) * b + 170 * k, (230 - 185 * hs) * b + 180 * k], 1, f.hw);
  }
  [40, 235, 140].forEach((c, i) => (o[i] += c * f.hud));
}

// The angiogram and the thermal chart: one value, then its colour table.
function pal(f, c, o, E) {
  const [lt, bg, t0, rim, dep, core, bl, mus, heat, bone, lung, ox, a0, a1, v0, v1, h0, h1, hud] = c;
  let v = bg * (1.2 - (0.6 * f.y) / H);
  if (f.m > 0) v += (t0 + rim * f.rim + dep * f.dep + core * f.core + bl * f.bl + (heat + mus * f.mus) * E - v) * f.m;
  if (f.lw > 0) v += (lung + ox * f.ox * f.lt - v) * f.lw;
  v += (bone - v) * f.bone * f.m * (bone > 0);
  if (f.wb > 0) v += ((f.bm ? v0 + v1 * f.bp : a0 * 0.9 + a1 * f.bp) * (1 - 0.08 * f.lb) - v) * f.wb;
  if (f.wr > 0) v += ((f.rm ? v0 + v1 * f.rp : a0 + a1 * f.rp) * (1 - 0.08 * f.lr) - v) * f.wr;
  v *= 1 - 0.35 * f.ho;
  if (f.hw > 0) v += (h0 + h1 * (f.hb - 0.62) + 0.15 * f.hr - v) * f.hw;
  const i = clamp(round(max(v, f.hud * hud) * 255), 0, 255) * 3;
  [o[0], o[1], o[2]] = [lt[i], lt[i + 1], lt[i + 2]];
}
