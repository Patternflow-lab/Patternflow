// ===== Patternflow pattern =====
// Title:   Center Pivot
// Family:  farm
// Idea:    The plains seen from an airliner window: a grid of round fields on tan square sections between straight gravel roads, each at its own point in the season and each with a silver pivot arm sweeping round and leaving a dark wet wedge that dries behind it, while a combine cuts a gold circle ring by ring and cloud shadows drift over it all.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after center-pivot irrigation seen from the air over Kansas and the Saudi desert
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Season=0..1, Speed=0.2..3, Fields=2..4, Clouds=0..1
//
// Knob 1: Season. Spring at 0: ploughed loam, new corn in green rings, deep green alfalfa and one circle of winter wheat already gold, a combine in it. From a half to three quarters the corn turns gold and the combines go round it; at 1 it is late autumn, grey stubble and disked brown with the new wheat coming up green and the trees by the river gone brown.
// Knob 2: Speed. At 2 an arm goes round in sixteen to twenty-six seconds and its wet wedge dries over about a third of a turn; 0.2 is ten times slower. Everything else keeps the same pace except the crop duster.
// Knob 3: Fields. How many sections fit across: two at 2, each a circle about thirty LEDs wide, and up to four at 4, as from higher up, with more of the river and the farms around it.
// Knob 4: Clouds. A few fair-weather puffs at 0, broken cumulus at 1, each cloud with its shadow lying down and to the right of it in the low sun.
// Buttons: K1 tap switches every pivot on at once, the parked ones too, for one turn. K2 tap sends a yellow crop duster low across the fields, spraying.

const W = 64, H = 128, N = W * H, SEC = 32, RW = 14, BAND = 3.2, TD = 4.5;
const { min, max, floor, ceil, sin, cos, sqrt, exp, abs, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);
const md = (v) => v - floor(v / TAU) * TAU;
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

// A crop's year in stages. The last number of each is how strongly the planted rings show.
const KEY = [
  0, 84, 66, 50, 0.14, 0.1, 92, 76, 52, 0.18, 0.22, 116, 150, 64, 0.2, 0.36, 66, 136, 54, 0.12,
  0.48, 34, 104, 48, 0.08, 0.56, 126, 132, 54, 0.08, 0.63, 222, 186, 64, 0.05, 0.7, 234, 200, 98, 0.05,
  0.78, 224, 210, 158, 0.08, 0.89, 180, 168, 136, 0.08, 0.96, 116, 92, 68, 0.14, 1.01, 84, 66, 50, 0.14,
];
function stageCol(v, o) {
  let a = 0;
  while (KEY[a + 5] < v) a += 5;
  const u = sm(KEY[a], KEY[a + 5], v);
  for (let j = 1; j < 4; j++) o[j - 1] = mix(KEY[a + j], KEY[a + 5 + j], u);
  return mix(KEY[a + 4], KEY[a + 9], u);
}
// Corn and soybeans run from ploughing to stubble, alfalfa stays green. Winter wheat is gold by June and sown again in autumn.
function stageOf(crop, k, off) {
  if (crop === 2) return fr(0.6 + 0.72 * k + off);
  if (crop === 3) return 0.38 + 0.06 * sin(k * 9 + off * 20) + 0.14 * sm(0.75, 1, k);
  return cl(0.86 * k + off - (crop ? 0.06 : 0), 0, 0.985);
}

// The river, in section units (an LED each at Fields 2), and the signed distance across it.
const rx = (y) => -39 + 13 * exp(-(((y - 16) / 24) ** 2)) + 2.5 * sin(y * 0.09 + 1) + 0.06 * y;
function rd(wx, wy) {
  const s = rx(wy + 0.5) - rx(wy - 0.5);
  return (wx - rx(wy)) / sqrt(1 + s * s);
}
// The eight sections in view at the start, left then right, top down. Each is a crop, how far ahead it is,
// a second crop on the other half and how far ahead that is, and the corner of the farmstead (-1 for none).
const OPEN = [
  [0, 0.2, -1, 0, -1], [3, 0, -1, 0, 2], [2, 0.02, -1, 0, -1], [0, 0.19, 1, 0, -1],
  [0, 0.32, -1, 0, -1], [1, 0, -1, 0, 1], [3, 0.3, 2, 0.06, 2], [1, 0.18, -1, 0, -1],
];
function spec(ci, cj) {
  if (ci >= -1 && ci <= 0 && cj >= -2 && cj <= 1) {
    const o = OPEN[(cj + 2) * 2 + ci + 1];
    return { strips: 0, crop: o[0], off: o[1], crop2: o[2], off2: o[3], farm: o[4] };
  }
  const h = (k) => hash(ci * 31 + k, cj * 17 + 5);
  return { strips: h(1) < 0.14, crop: floor(h(2) * 4), off: h(3) * 0.3, crop2: h(4) < 0.25 ? floor(h(5) * 4) : -1, off2: h(6) * 0.3, farm: h(7) < 0.45 ? floor(h(8) * 4) : -1 };
}

// Per LED: its field, angle and distance from that pivot, how much of it is field; field LEDs grouped by field.
const FID = new Int16Array(N), ANG = new Float32Array(N), RAD = new Float32Array(N), COV = new Float32Array(N), FP = new Int32Array(N);
const BASE = new Float32Array(N * 3), ALT = new Float32Array(N * 3), WET = new Float32Array(N), F = new Float32Array(N * 3), C3 = new Float64Array(3);
// Cloud noise that tiles every 64.
const CN = new Float32Array(4096);
for (let k = 0; k < 4096; k++) {
  const x = k & 63, y = k >> 6;
  CN[k] = 0.55 * vn(x / 8, y / 8, 8) + 0.3 * vn(x / 4 + 9, y / 4, 16) + 0.15 * vn(x / 2, y / 2 + 7, 32);
}
function cloud(u, v) {
  const x0 = floor(u), y0 = floor(v), fx = u - x0, fy = v - y0, a = x0 & 63, a1 = (x0 + 1) & 63, b = (y0 & 63) << 6, b1 = ((y0 + 1) & 63) << 6;
  return mix(mix(CN[b + a], CN[b + a1], fx), mix(CN[b1 + a], CN[b1 + a1], fx), fy);
}

export function setup(params) {
  params.s = { z: -1, k1: -1, t: 0, rt: 0, ox: 20, oy: 30, mist: 0, fields: [], sec: new Map(), tr: [], dust: [], duster: null, spray: [] };
}

function sectionAt(S, wx, wy) {
  const ci = floor(wx / SEC), cj = floor(wy / SEC), key = ci * 1000 + cj;
  let s = S.sec.get(key);
  if (!s) {
    const sp = spec(ci, cj), cx = ci * SEC + 16, cy = cj * SEC + 16, sd = rd(cx, cy);
    s = { ci, cj, sp, f: -1, cx, cy, sd };
    S.sec.set(key, s);
  }
  return s;
}

// The fields for this height, and each LED's place in them.
function layout(S, k3) {
  const z = (S.z = k3 / 2), fs = (S.fields = []);
  S.sec.clear();
  for (let cj = floor(-2 * z) - 1; cj <= ceil(2 * z); cj++)
    for (let ci = floor(-z) - 1; ci <= ceil(z); ci++) {
      const s = sectionAt(S, ci * SEC + 1, cj * SEC + 1), sp = s.sp;
      if (sp.strips || abs(s.sd) < 6.5) continue;
      const id = fs.length, sg = s.sd > 0 ? 1 : -1, h = (k) => hash(ci * 13 + k, cj * 7 + 3);
      // Where the river and its trees cut the circle, the arm swings to and fro over what is left.
      let run = 0, best = 0, start = 0, first = -1;
      const ok = (k) => rd(s.cx + RW * 0.97 * cos((k * TAU) / 96), s.cy + RW * 0.97 * sin((k * TAU) / 96)) * sg > 4.8;
      for (let k = 0; k < 192; k++) {
        if (ok(k % 96)) {
          if (!run) start = k;
          if (++run > best && run <= 96) (best = run), (first = start);
        } else run = 0;
      }
      if (best < 16) continue;
      const f = { id, s, sg, cx: 32.5 + s.cx / z, cy: 64.5 + s.cy / z, R: RW / z, crop: sp.crop, off: sp.off, crop2: sp.crop2, off2: sp.off2, sa: h(1) * TAU };
      Object.assign(f, { sd: h(2) < 0.5 ? 1 : -1, om: TAU / (16 + 10 * h(3)), a: h(4) * TAU, tint: 0.93 + 0.12 * h(5), boost: 0, wipe: 0, a0: 0, span: TAU, rel: 0 });
      Object.assign(f, { harv: 0, h: 0, h0: 0.3 + 0.4 * h(6), hs: h(7) * TAU, hd: h(8) < 0.5 ? 1 : -1, hst: 0, ht: 0, g: 1, n0: 0, n1: 0, grow: 0 });
      if (best < 96) Object.assign(f, { wipe: 1, a0: ((first + 1) * TAU) / 96, span: ((best - 2) * TAU) / 96, rel: h(4) * ((best - 2) * TAU) / 96 }), (f.a = f.a0 + f.rel);
      s.f = id;
      fs.push(f);
    }
  for (let i = 0; i < N; i++) {
    const wx = ((i & 63) - 32) * z, wy = ((i >> 6) - 64) * z, s = sectionAt(S, wx, wy);
    FID[i] = -1;
    COV[i] = 0;
    if (s.f < 0) continue;
    const f = fs[s.f], dx = wx - s.cx, dy = wy - s.cy, dr = sqrt(dx * dx + dy * dy);
    const c = cl((RW - dr) / z + 0.5, 0, 1) * cl((rd(wx, wy) * f.sg - 4.6) / z + 0.5, 0, 1);
    if (c <= 0) continue;
    (FID[i] = f.id), (COV[i] = c), (ANG[i] = md(atan2(dy, dx))), (RAD[i] = dr / z);
  }
  for (const f of fs) f.n1 = 0;
  for (let i = 0; i < N; i++) if (FID[i] >= 0) fs[FID[i]].n1++;
  let n = 0;
  for (const f of fs) (f.n0 = n), (n += f.n1), (f.n1 = f.n0);
  for (let i = 0; i < N; i++) if (FID[i] >= 0) FP[fs[FID[i]].n1++] = i;
  const vr = [], hr = [];
  for (let m = -4; m <= 4; m++) {
    const x = 32.5 + (m * SEC) / z, y = 64.5 + (m * SEC) / z;
    if (x > 2 && x < 62) vr.push(x);
    if (y > 2 && y < 126) hr.push(y);
  }
  S.tr = [0, 1].map((k) => ({ v: k === 0, c: k ? hr[min(hr.length - 1, 2)] : vr[floor(vr.length / 2)], p: k ? 20 : 100, d: k ? 1 : -1, acc: 0 }));
  S.dust = [];
}

// What stands on the land: trees along the river and in the farmsteads' windbreaks (1), or a farmhouse roof (2)
// with its grain bins (3). 0 is open ground.
function objAt(S, wx, wy) {
  const r = abs(rd(wx, wy));
  if (r > 1.1 && r < 4.4 && vn(wx * 0.55 + 5, wy * 0.55) > 0.22 + 0.11 * r) return 1;
  const s = sectionAt(S, wx, wy), c = s.sp.farm;
  if (c < 0 || s.sp.strips) return 0;
  const lx = wx - s.ci * SEC, ly = wy - s.cj * SEC, u = c & 1 ? SEC - lx : lx, v = c & 2 ? SEC - ly : ly;
  if (u < 1 || v < 1) return 0;
  if ((u < 8.6 && v < 2.7) || (u < 2.7 && v < 8.6)) return hash(floor(u * 1.4), floor(v * 1.4) + c) < 0.85 ? 1 : 0;
  if (u > 3.4 && u < 5.3 && v > 3.4 && v < 5.1) return 2;
  if ((u - 6.4) ** 2 + (v - 3.7) ** 2 < 0.7 || (u - 3.7) ** 2 + (v - 6.4) ** 2 < 0.7) return 3;
  return 0;
}

// Round bales lying on the windrows of a stubble field.
function bale(f, wx, wy) {
  const dx = wx - f.s.cx, dy = wy - f.s.cy, dr = sqrt(dx * dx + dy * dy);
  if (dr > RW - 1 || dr < 2) return 0;
  const q = dr / 3.5, k = floor(q), arc = md(atan2(dy, dx) - f.sa) * dr, c = floor(arc / 4.5);
  return abs(q - k - 0.5) * 3.5 < 0.55 && abs(arc / 4.5 - c - 0.5) * 4.5 < 0.6 && arc < 4.2 * dr && hash(k, c + f.id * 50) < 0.75 ? 1 : 0;
}

// The picture that stays put between knob turns: land, roads, river, farmsteads and each field at its point in the season.
function paint(S, k1) {
  const z = S.z, fs = S.fields, C = C3, L = [mix(156, 172, sm(0, 0.4, k1)), mix(146, 148, k1), mix(100, 106, k1)];
  const leaf = [mix(34, 132, sm(0.72, 0.92, k1)), mix(66, 102, sm(0.72, 0.92, k1)), 38];
  for (const f of fs) {
    f.v = stageOf(f.crop, k1, f.off);
    f.v2 = f.crop2 < 0 ? f.v : stageOf(f.crop2, k1, f.off2);
    f.c1 = [0, 0, 0];
    f.c2 = [0, 0, 0];
    f.a1 = stageCol(f.v, f.c1);
    f.a2 = stageCol(f.v2, f.c2);
    f.grow = (f.v > 0.1 && f.v < 0.57) || (f.v2 > 0.1 && f.v2 < 0.57) ? 1 : 0;
    const hv = f.crop2 < 0 && f.v > 0.6 && f.v < 0.77 ? 1 : 0;
    if (hv !== f.harv) Object.assign(f, { harv: hv, h: f.h0, hst: 0, g: 1 });
  }
  const ringA = sm(1.9, 2.6, 3 / z);
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const x = i & 63, y = i >> 6, wx = (x - 32) * z, wy = (y - 64) * z, s = sectionAt(S, wx, wy), sp = s.sp, r = rd(wx, wy), gr = 0.93 + 0.1 * vn(wx * 0.4, wy * 0.4) + 0.04 * hash(x, y);
    for (let j = 0; j < 3; j++) C[j] = L[j] * gr;
    if (abs(r) < 11) for (let j = 0; j < 3; j++) C[j] = mix(C[j], PASTURE[j] * gr, sm(11, 5, abs(r)) * 0.7);
    if (sp.strips) {
      const q = hash(s.ci, s.cj + 3) < 0.5 ? wx : wy, st = floor(q / 4.5) & 1;
      stageCol(st ? stageOf(2, k1, sp.off) : 0.86, C3);
      for (let j = 0; j < 3; j++) C[j] *= gr;
    }
    const fi = FID[i];
    if (fi >= 0) {
      const f = fs[fi], dx = wx - s.cx, dy = wy - s.cy, dr = sqrt(dx * dx + dy * dy), cv = COV[i];
      const side = f.crop2 < 0 ? 0 : cl((dx * sin(f.sa) - dy * cos(f.sa)) / z + 0.5, 0, 1);
      const amp = mix(f.a1, f.a2, side) * ringA, tk = abs(fr((dr * 5) / RW + 0.5) - 0.5) * (RW / 5 / z);
      let m = f.tint * (1 + amp * cos((dr * TAU) / 3)) * (0.95 + 0.1 * vn(wx * 0.3 + f.id * 7, wy * 0.3));
      if (dr > RW * 0.12) m *= 1 - 0.2 * cl(1 - tk * 1.6, 0, 1);
      m *= 1 - 0.15 * cl(1 - abs(dr - RW + 0.5) / z, 0, 1);
      const v = side > 0.5 ? f.v2 : f.v, wr = v > 0.76 && v < 0.92 ? cl(1 - abs(fr(dr / 3.5) - 0.5) * (3.5 / z) * 1.8, 0, 1) : 0;
      for (let j = 0; j < 3; j++) C[j] = mix(C[j], mix(f.c1[j], f.c2[j], side) * m * (1 - 0.14 * wr), cv);
      if (v > 0.76 && v < 0.92) {
        if (bale(f, wx, wy)) (C[0] = 196), (C[1] = 158), (C[2] = 76);
        else if (bale(f, wx - z, wy - z)) for (let j = 0; j < 3; j++) C[j] *= 0.55;
      }
      if (dr < 0.9) (C[0] = 170), (C[1] = 172), (C[2] = 164);
      // Cut stubble, for a field the combine is in: paler, with a windrow down the middle of each pass.
      if (f.harv) {
        const kb = (RW - dr) / BAND, w2 = cl(1 - abs(fr(kb) - 0.5) * (BAND / z) * 1.6, 0, 1), m2 = f.tint * (0.96 + 0.08 * vn(wx * 0.5, wy * 0.5)) * (1 - 0.18 * w2) * (dr > RW * 0.12 ? 1 - 0.15 * cl(1 - tk * 1.6, 0, 1) : 1);
        ALT[o] = 230 * m2;
        ALT[o + 1] = 216 * m2;
        ALT[o + 2] = 166 * m2;
      }
    }
    const ob = objAt(S, wx, wy);
    if (!ob && objAt(S, wx - z, wy - z)) for (let j = 0; j < 3; j++) C[j] *= 0.6;
    if (ob === 1) for (let j = 0; j < 3; j++) C[j] = leaf[j] * (0.8 + 0.4 * vn(wx * 1.3, wy * 1.3));
    else if (ob === 2) (C[0] = 214), (C[1] = 208), (C[2] = 198);
    else if (ob === 3) (C[0] = 196), (C[1] = 202), (C[2] = 206);
    const aw = cl(1.25 - abs(r) / z, 0, 1);
    if (aw > 0) for (let j = 0; j < 3; j++) C[j] = mix(C[j], WATER[j], aw);
    const lx = wx - s.ci * SEC, ly = wy - s.cj * SEC, dp = min(lx, SEC - lx, ly, SEC - ly) / z, rc = x && y ? cl(0.6 / z + 0.5 - dp, 0, 1) : 0;
    for (let j = 0; j < 3; j++) BASE[o + j] = mix(C[j], GRAVEL[j], rc);
  }
}

function startWet(S) {
  for (const f of S.fields)
    for (let n = f.n0; n < f.n1; n++) {
      const i = FP[n];
      let age = 99;
      if (f.grow) {
        if (!f.wipe) age = md((f.a - ANG[i]) * f.sd) / f.om;
        else {
          const r = md(ANG[i] - f.a0), p = f.rel;
          if (r <= f.span) age = (f.sd > 0 ? (r <= p ? p - r : p + r) : r >= p ? r - p : 2 * f.span - r - p) / f.om;
        }
      }
      WET[i] = exp(-age / TD);
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 0.06], k1 = cl(k[0], 0, 1), k3 = cl(k[2], 2, 4), ts = cl(k[1], 0.2, 3) / 2, rt = cl(dt || 0, 0, 0.1), d = rt * ts;
  let fresh = 0;
  if (abs(k3 / 2 - S.z) > 0.004) layout(S, k3), (fresh = 1);
  if (fresh || abs(k1 - S.k1) > 0.002) paint(S, k1), (S.k1 = k1);
  if (fresh) startWet(S);
  (S.k4 = cl(k[3], 0, 1)), (S.t += d), (S.rt += rt);
  const bp = input.btnPressed || [];
  if (bp[0]) {
    for (const f of S.fields) f.boost = f.wipe ? 2 * f.span : TAU;
    S.mist = 3;
  }
  if (bp[1] && !S.duster) {
    const xs = S.fields.map((f) => f.cx).filter((x) => x > 4 && x < 60), x = xs.length ? xs[floor(rnd() * xs.length)] + (rnd() - 0.5) * 6 : 32, dn = rnd() < 0.5;
    S.duster = { x, y: dn ? -8 : H + 8, vy: dn ? 30 : -30, acc: 0 };
  }
  S.mist = max(0, S.mist - rt);
  (S.ox += 2 * d), (S.oy += 1.4 * d);
  const dec = exp(-d / TD);
  for (const f of S.fields) {
    const on = f.grow || f.boost > 0, D = f.om * d;
    if (on) f.boost -= D;
    let lo = 1, hi = 0;
    if (on && !f.wipe) (lo = f.a), (f.a = md(f.a + f.sd * D));
    else if (on) {
      const p = f.rel;
      let q = p + f.sd * D;
      (lo = min(p, q)), (hi = max(p, q));
      if (q > f.span) (q = 2 * f.span - q), (f.sd = -1), (lo = min(p, q)), (hi = f.span);
      if (q < 0) (q = -q), (f.sd = 1), (lo = 0), (hi = max(p, q));
      (f.rel = q), (f.a = f.a0 + q);
    }
    for (let n = f.n0; n < f.n1; n++) {
      const i = FP[n];
      let w = WET[i] * dec;
      if (on) {
        if (!f.wipe) {
          if (md((ANG[i] - lo) * f.sd) <= D) w = 1;
        } else {
          const r = md(ANG[i] - f.a0);
          if (r >= lo && r <= hi) w = 1;
        }
      }
      WET[i] = w;
    }
    // The combine goes round at a steady walk, so the inner rings take less time.
    if (f.harv) {
      if (f.hst === 0) {
        const rh = max(1.5, f.R - (BAND / S.z) * (floor(f.h) + 0.5));
        f.h += (d * 5) / (TAU * rh * S.z);
        if (f.h >= ceil(RW / BAND)) (f.hst = 1), (f.ht = 14);
      } else if (f.hst === 1) {
        if ((f.ht -= d) <= 0) f.hst = 2;
      } else if ((f.g -= d / 3) <= 0) Object.assign(f, { hst: 0, h: 0, g: 1 });
    }
  }
  // Trucks on the gravel roads and the dust they leave hanging.
  for (const tr of S.tr) {
    if (tr.c === undefined) continue;
    tr.p += tr.d * 6 * d;
    const lim = tr.v ? H : W;
    if (tr.p > lim + 30) tr.p = -30;
    if (tr.p < -30) tr.p = lim + 30;
    if ((tr.acc += d) > 0.1) {
      tr.acc = 0;
      S.dust.push({ x: tr.v ? tr.c : tr.p, y: tr.v ? tr.p : tr.c, t: S.t });
    }
  }
  S.dust = S.dust.filter((p) => S.t - p.t < 3.5);
  const du = S.duster;
  if (du) {
    du.y += du.vy * rt;
    if ((du.acc += rt) > 0.04) (du.acc = 0), S.spray.push({ x: du.x, y: du.y - Math.sign(du.vy) * 3, t: S.rt });
    if (du.y < -20 || du.y > H + 20) S.duster = null;
  }
  S.spray = S.spray.filter((p) => S.rt - p.t < 4);
}

function blend(x, y, c, a) {
  x = floor(x);
  y = floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  for (let j = 0; j < 3; j++) F[o + j] = mix(F[o + j], c[j], min(1, a));
}
function shade(x, y, k) {
  x = floor(x);
  y = floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let j = 0; j < 3; j++) F[o + j] *= k;
}
// A soft dot spread over the four LEDs around it.
function puff(x, y, c, a) {
  const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  blend(x0, y0, c, a * (1 - fx) * (1 - fy)), blend(x0 + 1, y0, c, a * fx * (1 - fy)), blend(x0, y0 + 1, c, a * (1 - fx) * fy), blend(x0 + 1, y0 + 1, c, a * fx * fy);
}

const SILVER = [214, 220, 226], MIST = [236, 242, 248], DUST = [246, 238, 216], RED = [204, 52, 36], YEL = [244, 212, 46], WHITE = [246, 248, 250], TANK = [236, 224, 196], TRUCK = [56, 64, 84];
const PLANE = [0, 1, -2, 0, -1, 0, 0, 0, 1, 0, 2, 0, 0, -1, 0, -2, -1, -2, 1, -2], BODY = [250, 226, 80];
const PASTURE = [96, 118, 70], WATER = [84, 120, 146], GRAVEL = [206, 196, 168], CLOUD = [250, 250, 248], CLOUD_SH = [150, 160, 182];
// How close a point along an arm of length R is to one of its towers.
const tw = (u, R) => cl(1 - abs(fr((u * 5) / R + 0.5) - 0.5) * (R / 5) * 1.5, 0, 1) * (u > R * 0.12 ? 1 : 0);
// The arm and its shadow, its towers, the mist trailing it and the end gun's spray.
function arm(S, f) {
  const R = f.R, ca = cos(f.a), sa = sin(f.a), on = f.grow || f.boost > 0, ms = (on ? 1 : 0) * (1 + (S.mist > 0 ? 1.2 : 0)), tf = floor(S.rt * 7);
  const x0 = max(0, floor(min(f.cx, f.cx + R * ca) - 3)), x1 = min(W - 1, ceil(max(f.cx, f.cx + R * ca) + 3));
  const y0 = max(0, floor(min(f.cy, f.cy + R * sa) - 3)), y1 = min(H - 1, ceil(max(f.cy, f.cy + R * sa) + 3));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - f.cx, qy = y + 0.5 - f.cy, t = qx * ca + qy * sa, c = qy * ca - qx * sa, ts = t - ca - sa, cs = c - ca + sa;
      const o = (y * W + x) * 3, as = ts > -0.5 && ts < R + 0.5 ? cl(1 - abs(cs), 0, 1) : 0, aa = t > -0.5 && t < R + 0.3 ? cl(1.1 - abs(c), 0, 1) : 0;
      if (as > 0) for (let j = 0; j < 3; j++) F[o + j] *= 1 - 0.4 * as * (1 + 0.5 * tw(ts, R));
      if (ms > 0 && t > R * 0.15 && t < R + 2.5 && c * f.sd < -0.3 && c * f.sd > (t > R ? -2.2 : -1.8)) {
        const sp = hash(x * 31 + y, tf + f.id * 977);
        blend(x, y, MIST, ms * (0.13 + (sp > 0.74 ? 0.5 : 0)) * (t > R ? 1.3 : 1));
      }
      if (aa > 0) {
        const e = 0.6 * tw(t, R);
        for (let j = 0; j < 3; j++) F[o + j] = mix(F[o + j], mix(SILVER[j], 250, e), 0.9 * aa);
      }
    }
  // The wheeled towers, each with its short shadow.
  for (let k = 1; k <= 5; k++) {
    const x = f.cx + ((R * k) / 5 - 0.3) * ca, y = f.cy + ((R * k) / 5 - 0.3) * sa;
    shade(x + 1, y + 1, 0.55), blend(x, y, WHITE, 0.85);
  }
  blend(f.cx, f.cy, WHITE, 1);
  shade(f.cx + 1, f.cy + 1, 0.55);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.z < 0) return;
  const fs = S.fields;
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const fi = FID[i];
    let g = 0;
    if (fi >= 0) {
      const f = fs[fi];
      if (f.harv && f.hst) g = f.g;
      else if (f.harv) {
        const rel = md((ANG[i] - f.hs) * f.hd) / TAU;
        if (floor((f.R - RAD[i]) / (BAND / S.z)) + rel < f.h) g = 1;
      }
    }
    const w = WET[i] > 0.004 ? WET[i] ** 0.8 * (fi >= 0 ? COV[i] : 0) : 0, k = 1 - 0.5 * w;
    for (let j = 0; j < 3; j++) {
      let c = BASE[o + j];
      if (g > 0) c = mix(c, ALT[o + j], g * COV[i]);
      F[o + j] = c * k * (1 + (j - 1) * 0.08 * w);
    }
  }
  for (const f of fs) {
    if (f.harv && f.hst === 0) {
      const z = S.z, rh = max(1.5, f.R - (BAND / z) * (floor(f.h) + 0.5)), th = f.hs + f.hd * fr(f.h) * TAU, x = f.cx + rh * cos(th), y = f.cy + rh * sin(th);
      for (let j = 1; j < 9; j++) {
        const b = th - f.hd * (j * 0.7) / rh;
        puff(f.cx + rh * cos(b) + 0.3 * j, f.cy + rh * sin(b) + 0.4 * j, DUST, 0.32 * (1 - j / 9));
      }
      shade(x + 1, y + 1, 0.5), shade(x + 2, y + 1, 0.6);
      blend(x, y, RED, 1), blend(x + 1, y, TANK, 1);
    }
  }
  for (const f of fs) arm(S, f);
  for (const p of S.dust) {
    const a = S.t - p.t;
    const e = 0.8 * exp(-a / 1.7), sp = 0.4 + 0.6 * a, x = p.x + a * 1.7, y = p.y + a * 1.2;
    puff(x, y, DUST, e), puff(x + sp, y + sp * 0.5, DUST, e * 0.6), puff(x - sp * 0.5, y + sp, DUST, e * 0.6);
  }
  for (const tr of S.tr) {
    if (tr.c === undefined) continue;
    const x = tr.v ? tr.c : tr.p, y = tr.v ? tr.p : tr.c;
    shade(x + 1, y + 1, 0.55);
    blend(x, y, TRUCK, 1);
  }
  for (const p of S.spray) {
    const a = S.rt - p.t;
    const e = 0.6 * exp(-a / 1.5), sp = 1.2 + 0.9 * a, x = p.x + a * 1.2, y = p.y + a * 0.8;
    puff(x, y, MIST, e * 0.7), puff(x - sp, y, MIST, e), puff(x + sp, y, MIST, e);
  }
  const du = S.duster;
  if (du) {
    // A biplane seen from above: nose, wings, body and tail, with its shadow close by.
    const sy = Math.sign(du.vy), X = floor(du.x), Y = floor(du.y);
    for (let k = 0; k < 20; k += 2) shade(X + PLANE[k] + 3, Y + PLANE[k + 1] * sy + 4, 0.55);
    for (let k = 0; k < 20; k += 2) blend(X + PLANE[k], Y + PLANE[k + 1] * sy, PLANE[k + 1] === 0 && PLANE[k] ? YEL : BODY, 1);
  }
  // Clouds and their shadows, lit from the upper left.
  const thr = 0.69 - 0.2 * S.k4, ox = S.ox, oy = S.oy;
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const x = i & 63, y = i >> 6, u = (x - ox) * 0.3, v = (y - oy) * 0.27;
    const sh = sm(thr, thr + 0.06, cloud(u - 1.8, v - 2.4)), n = cloud(u, v), ca = sm(thr, thr + 0.05, n);
    let k = 1 - 0.45 * sh;
    for (let j = 0; j < 3; j++) F[o + j] *= k * (j === 2 ? 1 + 0.05 * sh : 1);
    if (ca > 0) {
      const lit = cl(0.7 - (n - cloud(u + 0.5, v + 0.5)) * 12 + 2 * (n - thr), 0, 1);
      for (let j = 0; j < 3; j++) F[o + j] = mix(F[o + j], mix(CLOUD_SH[j], CLOUD[j], lit), 0.92 * ca);
    }
    const lt = 1.02 - 0.09 * (x / W) - 0.07 * (y / H);
    display.setPixel(x, y, min(255, F[o] * lt + 8) | 0, min(255, F[o + 1] * lt * 0.98 + 8) | 0, min(255, F[o + 2] * lt * 0.95 + 10) | 0);
  }
}
