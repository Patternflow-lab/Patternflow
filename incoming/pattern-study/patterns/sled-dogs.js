// ===== Patternflow pattern =====
// Title:   Sled Dogs
// Family:  polar
// Idea:    Seen from straight above, a dog team in pairs on a gangline runs up the panel over sea ice, the musher on the sled runners, and the low sun throws a long blue shadow back from every dog with its legs galloping in it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after dog-sled teams on Arctic sea ice, here in pairs on a gangline (the tandem hitch) rather than the fan hitch used in Greenland
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Dogs=8..14, Wind=0..1
//
// Knob 1: Light. A low gold sun at 0, each dog's shadow nearly three times its height; at a third the sun sits on the horizon in rose light with longer shadows; blue twilight at 0.6; at 1 moonlight from the other side and green aurora light on the snow.
// Knob 2: Speed. At 2 the team covers 20 LEDs a second and each dog takes about one and a half strides; 0.2 is ten times slower.
// Knob 3: Dogs. Eight dogs in four pairs up to fourteen in seven; an odd number runs a single lead dog in front.
// Knob 4: Wind. Turned up from calm, spindrift streams along the sastrugi in thicker, faster ribbons and blows the dogs' breath away; at 1 it hazes the ice.
// Buttons: K1 tap: the musher calls gee or haw and the lead pair swings the team hard toward the middle of the ice, then back to the trail. K2 tap stops the team to rest; tap again, or wait ten seconds, and it runs on.

const W = 64, H = 128, N = W * H;
// The ice: a ring of world rows, x from -128 to 127.
const RX = 256, XO = 128, RY = 256, RN = RX * RY;
// The shading grid and the window of heights around it.
const TW = 65, TH = 129, MX = 48, MY = 30, HW = TW + 2 * MX, HH = TH + 2 * MY;
// Dogs are drawn in sixths of a metre, grown by Z.
const Z = 1.4, PITCH = 11 * Z, LAT = 2.5 * Z, STRIDE = 9 * Z, SLED = 15 * Z, PL = 1024;
const { min, max, floor, sin, cos, sqrt, exp, abs, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
const rw = (y) => (((y % RY) + RY) % RY) * RX;
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
// The prevailing wind, which the sastrugi follow.
const GX = -0.8, GY = 0.6;
// K1 stops: direct rgb, sky rgb, tan of elevation, aurora.
const KL = [
  [0, 208, 146, 56, 64, 94, 160, 0.3, 0],
  [0.33, 205, 122, 44, 60, 80, 142, 0.17, 0],
  [0.6, 0, 0, 0, 84, 112, 186, 0.2, 0],
  [1, 52, 64, 92, 12, 22, 52, 0.32, 1],
].map((k) => Float64Array.from(k));
// Coats from above, dark with a light face: black, grey, red, sable, black.
const COAT = [
  [28, 26, 30, 64, 60, 60, 236, 232, 228],
  [64, 62, 66, 112, 108, 104, 226, 222, 214],
  [110, 56, 26, 150, 92, 50, 236, 220, 198],
  [58, 42, 28, 104, 80, 56, 232, 216, 192],
  [24, 22, 22, 44, 40, 38, 220, 214, 206],
].map((c) => [0, 3, 6].map((j) => Float64Array.from(c.slice(j, j + 3), (v) => v / 255)));
const HARN = [1, 0.5, 0.04], LINE = [0.2, 0.17, 0.22], WOOD = [0.62, 0.46, 0.3], DARK = [0.26, 0.18, 0.12], LOAD = [0.44, 0.34, 0.24], RED = [0.78, 0.15, 0.1], FUR = [0.74, 0.66, 0.54];
// Side views as capsules (a, h, a, h, r): a dog; the sled and musher.
const DOG = [-2, 2.75, 1.2, 2.95, 0.82, 1.2, 3.2, 2.7, 3.95, 0.6, 2.7, 3.95, 3.9, 3.65, 0.42, 2.55, 4.4, 2.7, 5, 0.22, -2.2, 3.2, -2.6, 4.2, 0.42, -2.6, 4.2, -1.8, 4.7, 0.36];
const SLD = [-1.5, 0.8, 14.5, 0.8, 0.55, 5.5, 1.8, 11.5, 1.8, 1, 2.6, 0.8, 2.6, 5.8, 0.3, 0.45, 0, 0.7, 5, 0.6, 0.7, 5, 0.9, 9, 1.15, 1, 10.2, 1, 10.3, 0.85, 1, 8.4, 2.5, 6, 0.4];

export function setup(params) {
  const F32 = (n) => new Float32Array(n), U8 = (n) => new Uint8ClampedArray(n);
  const S = (params.s = {
    HT: F32(RN), AL: U8(RN * 3), MT: U8(RN), MK: U8(RN), LI: F32(RN), SQ: F32(RN), GN: new Int32Array(RN), gen: 1,
    HL: F32(HW * HH), AM: F32(TW * TH * 3), DI: F32(TW * TH * 3), SM: F32(TW * TH), F: F32(N * 3), L: new Float64Array(9), TM: U8(1200), LC: new Float64Array(3),
    PX: F32(PL), PY: F32(PL), np: PL, acc: 0.01, DX: F32(16), DY: F32(16), DF: F32(16), DO: F32(16), DC: U8(16), BX: F32(256), BY: F32(256), BA: F32(256), bi: 0,
    lx: 0.01, ly: 0.01, th: 0.01, v: 20, vt: 20, ph: 0.01, t: 0.01, cx: -30, cy: -18, gy: 230, nd: 8, sbx: 0.01, sby: 0.01, sfx: 0.01, sfy: 0.01, ux: 0.01, uy: 0.01, run: 0.01, pt: 15.4,
    rest: 0, restT: 0.01, turn: 1, turnT: 0.01, k1: -1, k4: 0.06, wind: 0.01, live: 0, cpY: [400, 50], cpX: [0, 0], feat: [], nf: 0, sk: 0,
  });
  for (let k = 0; k < PL; k++) S.PY[k] = (PL - 1 - k) * 0.5;
  for (let i = 0; i < 16; i++) (S.DO[i] = hash(i, 3)), (S.DC[i] = floor(hash(i, 8) * 5));
  for (let c = 0; c < 1200; c++) S.TM[c] = c < 205 ? c : 205 + 50 * (1 - exp(-(c - 205) / 50));
  plan(S), plan(S), plan(S);
  for (let y = 230; y > -53; y--) genRow(S, y);
  S.gy = -53;
}

// The trail swings between control points.
function trailX(S, y) {
  const Y = S.cpY, X = S.cpX;
  let i = 0;
  while (i < Y.length - 2 && Y[i + 1] > y) i++;
  return mix(X[i], X[i + 1], sm(0, 1, (Y[i] - y) / (Y[i] - Y[i + 1])));
}
// Each obstacle lies across the way on; the trail swings round its end.
function plan(S) {
  const Y = S.cpY, X = S.cpX, ly = Y[Y.length - 1], lx = X[X.length - 1];
  if (S.sk++ % 3 === 2) return Y.push(ly - 60 - 30 * rnd()), X.push(cl(lx + (rnd() - 0.5) * 20, -24, 24));
  const side = abs(lx) > 6 ? (lx > 0 ? 1 : -1) : rnd() < 0.5 ? 1 : -1, x0 = cl(lx - side * (9 + 5 * rnd()), -30, 30), y0 = ly - 60 - 20 * rnd(), sd = floor(rnd() * 999), ph = rnd() * 6;
  Y.push(y0, y0 - 60 - 20 * rnd()), X.push(x0, cl(x0 + side * (9 + 6 * rnd()), -24, 24));
  if (S.nf++ % 2 === 0) {
    // A pressure ridge, square to the sun.
    const a = -side * (0.5 + 0.4 * rnd()), len = 60 + 40 * rnd(), dx = side * cos(a), dy = sin(a);
    S.feat.push({ k: 0, px: x0 + side * 4, py: y0, dx, dy, len, hh: 6 + 4 * rnd(), sd, ph, side, ol: 0, y0: y0 + min(0, dy * len) - 22, y1: y0 + max(0, dy * len) + 22 });
  } else {
    // A lead: slope, swing, wave number and width in dx, dy, len, hh.
    const sl = (rnd() - 0.5) * 0.22, am = 3 + 4 * rnd(), w = 10 + 6 * rnd(), e = abs(sl) * (128 + abs(x0)) + am + w;
    S.feat.push({ k: 1, px: x0, py: y0, dx: sl, dy: am, len: 0.03 + 0.03 * rnd(), hh: w, sd, ph, side, ol: 40 + 40 * rnd(), y0: y0 - e, y1: y0 + e });
  }
}

function genRow(S, y) {
  const o = rw(y), { HT, AL, MT } = S, fs = S.feat.filter((f) => y > f.y0 && y < f.y1);
  for (let i = 0; i < RX; i++) {
    // Sastrugi: crests with a long back to the sun and a steep lee face, broken into pieces.
    const x = i - XO, u = x * GX + y * GY, v = -x * GY + y * GX, c = v * 0.085 + 2.4 * vn(u * 0.012, v * 0.012) + 0.7 * vn(u * 0.045, v * 0.03 + 20), cf = c - floor(c), ci = floor(c);
    const sa = (cf < 0.25 ? cf / 0.25 : (1 - cf) / 0.75) * sm(0.42, 0.75, vn(u * 0.06 + ci * 7.3, ci * 3.1)) * (0.25 + 0.75 * sm(0.3, 0.6, vn(x * 0.022 + 70, y * 0.022)));
    let h = 0.95 * sa * sa + 0.15 * vn(u * 0.09 + 50, v * 0.34) + vn(x * 0.017 + 9, y * 0.017) - 0.5;
    const g = 0.955 + 0.045 * hash(x, y);
    let ar = 0.9 * g, ag = 0.94 * g, ab = g, mt = 0;
    for (const f of fs) {
      if (f.k === 0) {
        // Tilted slabs, rubble at their feet.
        const rx = x - f.px, ry = y - f.py, t = rx * f.dx + ry * f.dy;
        if (t < -8 || t > f.len + 8) continue;
        const s = abs(ry * f.dx - rx * f.dy - 3 * sin(t * 0.06 + f.ph)), bk = floor(t / 3.4), e = sm(-4, 8, t) * sm(f.len + 4, f.len - 16, t), wb = 2.4 + 2.6 * hash(bk, f.sd + 1), gx = floor(x / 3), gy = floor(y / 3);
        const hb = f.hh * (0.45 + 0.55 * hash(bk, f.sd)) * e;
        let hr = hb * (1 - s / wb) + 0.5 * hb * (hash(bk, f.sd + 2) - 0.5) * (t / 3.4 - bk - 0.5), q = hash(bk, f.sd + 3);
        if (hash(gx, gy + f.sd) < 0.2 * e * sm(wb + 6, wb, s) && 0.8 + 1.4 * hash(gy, gx) > hr) (hr = 0.8 + 1.4 * hash(gy, gx)), (q = hash(gx + 7, gy));
        if (hr > 0.2 && hr > h - 0.2) (h = max(h, hr) + 0.15), (mt = 1), (ar = mix(0.84, 0.44, q)), (ag = mix(0.93, 0.76, q)), (ab = mix(1, 0.92, q));
      } else {
        // A refrozen lead: dark young ice with frost flowers, and open water along part of it.
        const yc = f.py + f.dx * (x - f.px) + f.dy * sin(x * f.len + f.ph), e = abs(y - yc) / (f.hh * (0.35 + 0.3 * vn(x * 0.045, f.sd)));
        if (e > 1) {
          h += 0.7 * max(0, 1.4 - e);
          continue;
        }
        const sx = f.side * (x - f.px), gq = mix(0.14, 0.4, e * e) * (0.85 + 0.3 * vn(x * 0.2, y * 0.2)), fr = hash(x + 3, y) < 0.07 ? 0.35 + 0.3 * hash(y, x) : 0;
        (h = -0.45), (mt = 2), (ar = gq * 0.9 + fr), (ag = gq * 0.97 + fr), (ab = gq * 1.06 + fr);
        if (e < 0.8 * sm(5, 10, sx) * sm(f.ol + 10, f.ol, sx)) (mt = 3), (h = -0.6), (ar = 0.03), (ag = 0.07), (ab = 0.11);
      }
    }
    const k = o + i;
    (HT[k] = h), (AL[k * 3] = ar * 255), (AL[k * 3 + 1] = ag * 255), (AL[k * 3 + 2] = ab * 255), (MT[k] = mt), (S.MK[k] = S.GN[k] = 0);
  }
}

// A paw print or runner groove in the snow; young ice takes none.
function stamp(S, x, y, depth, bit) {
  const i = floor(x + 0.5) + XO, yy = floor(y + 0.5), k = rw(yy) + i, A = S.AL;
  if (i < 0 || i >= RX || S.MK[k] & bit || S.MT[k] > 1) return;
  S.MK[k] |= bit;
  (S.HT[k] -= depth), (A[k * 3] *= 0.93), (A[k * 3 + 1] *= 0.95);
  // Light it again.
  for (let j = -2; j < 3; j++) for (let q = max(0, i - 2); q < min(RX, i + 3); q++) S.GN[rw(yy + j) + q] = 0;
}

// The point s LEDs back along the lead dog's path.
const PP = new Float64Array(2);
function pathAt(S, s) {
  const f = S.acc, last = (S.np - 1) & (PL - 1);
  if (s <= f) return (PP[0] = mix(S.lx, S.PX[last], s / max(f, 1e-6))), (PP[1] = mix(S.ly, S.PY[last], s / max(f, 1e-6)));
  const k = (s - f) * 2, i = floor(k), r = k - i, a = (S.np - 1 - i) & (PL - 1), b = (S.np - 2 - i) & (PL - 1);
  (PP[0] = mix(S.PX[a], S.PX[b], r)), (PP[1] = mix(S.PY[a], S.PY[b], r));
}
// Dogs in pairs on the path, the sled behind.
function layout(S) {
  // Long teams close up to fit the panel.
  const n = S.nd, odd = n & 1, pt = (S.pt = min(PITCH, 76 / (((n + 1) >> 1) - 1))), sf = (((n + 1) >> 1) - 1) * pt + 8 * Z;
  for (let i = 0; i < n; i++) {
    const side = odd && !i ? 0 : (odd ? i - 1 : i) & 1 ? 1 : -1, s = ((i + odd) >> 1) * pt + 0.6 * (S.DO[i] - 0.5) + (side > 0 ? 3.5 * Z : 0);
    pathAt(S, s - 1);
    const ax = PP[0], ay = PP[1];
    pathAt(S, s + 1);
    const fx = ax - PP[0], fy = ay - PP[1], l = sqrt(fx * fx + fy * fy) || 1;
    pathAt(S, s);
    (S.DX[i] = PP[0] - (fy / l) * side * LAT), (S.DY[i] = PP[1] + (fx / l) * side * LAT), (S.DF[i] = atan2(fx / l, -fy / l));
  }
  pathAt(S, sf), (S.sfx = PP[0]), (S.sfy = PP[1]);
  pathAt(S, sf + SLED), (S.sbx = PP[0]), (S.sby = PP[1]);
  (S.ux = (S.sfx - S.sbx) / SLED), (S.uy = (S.sfy - S.sby) / SLED);
}

function step(S, d, k4) {
  S.t += d;
  if (S.rest && (S.restT += d) > 10) S.rest = 0;
  S.v += ((S.rest ? 0 : S.vt) - S.v) * min(1, d * (S.rest ? 1.6 : 0.9));
  const v = S.v, rate = 0.065 * v * d;
  // The lead dog aims 22 LEDs up the trail, or swings on a call.
  let des = S.turnT > 0 ? ((S.turnT -= d), S.turn * 1.15) : cl(atan2(trailX(S, S.ly - 22) - S.lx, 22), -0.5, 0.5);
  if (abs(S.lx) > 44) des = S.lx > 0 ? -0.6 : 0.6;
  S.th += cl(des - S.th, -rate, rate);
  const dist = v * d, fx = sin(S.th), fy = -cos(S.th), oph = S.ph;
  (S.lx += fx * dist), (S.ly += fy * dist), (S.acc += dist), (S.ph += dist / STRIDE);
  for (; S.acc >= 0.5; S.np++) (S.acc -= 0.5), (S.PX[S.np & (PL - 1)] = S.lx - fx * S.acc), (S.PY[S.np & (PL - 1)] = S.ly - fy * S.acc);
  layout(S);
  // Each foot leaves a print and each stride a breath; the runners cut grooves.
  for (let i = 0; i < S.nd; i++) {
    const a = sin(S.DF[i]), b = -cos(S.DF[i]), o = S.DO[i];
    for (let l = 0; l < 4; l++) {
      const fa = (LJ[l] + 1.5) * Z, fb = l & 1 ? Z : -Z;
      if (floor(S.ph + o + LO[l]) > floor(oph + o + LO[l])) stamp(S, S.DX[i] + a * fa - b * fb, S.DY[i] + b * fa + a * fb, 0.22, 1);
    }
    if (floor(S.ph + o * 3) > floor(oph + o * 3)) {
      const p = S.bi++ & 255;
      (S.BX[p] = S.DX[i] + a * 4.6 * Z), (S.BY[p] = S.DY[i] + b * 4.6 * Z), (S.BA[p] = 0.01);
    }
  }
  const ux = S.ux, uy = S.uy;
  for (let e = -1; e <= dist - 0.5; e += 0.5) for (let r = -2 * Z; r < 3 * Z; r += 4 * Z) stamp(S, S.sbx - uy * r + ux * e, S.sby + ux * r + uy * e, 0.3, 2);
  // The camera keeps the musher at row 118.
  S.cx += ((S.lx + S.sbx) / 2 - 32 + (S.k1 < 0.6 ? 6 : -6) - S.cx) * min(1, d * 1.5);
  S.cy = S.sby - 118;
  while (S.gy > S.cy - 40) genRow(S, --S.gy);
  while (S.cpY[S.cpY.length - 1] > S.ly - 420) plan(S);
  while (S.cpY.length > 4 && S.cpY[2] > S.ly + 300) S.cpY.shift(), S.cpX.shift();
  S.feat = S.feat.filter((f) => f.y0 < S.gy);
  for (let p = 0, wv = (4 + 60 * k4) * d; p < 256; p++) if (S.BA[p] < 1.5) (S.BA[p] += d), (S.BX[p] += GX * wv), (S.BY[p] += GY * wv);
  S.wind += (8 + 90 * k4) * d;
}

// Each leg from the side, joint to knee to foot; the hind pair lands first.
const LO = [0.5, 0.58, 0, 0.08], LJ = [1.1, 1.1, -1.9, -1.9], LG = new Float64Array(24);
function legs(ph, run, bob) {
  for (let l = 0; l < 4; l++) {
    const p = (((ph + LO[l]) % 1) + 1) % 1, R = 1.8 * run, ja = LJ[l], jh = 2.2 + bob, u = (p - 0.42) / 0.58;
    const fa = ja + (p < 0.42 ? R * (1 - p / 0.21) : -R + 2 * R * u * u * (3 - 2 * u)), fh = p < 0.42 ? 0 : 0.9 * run * sin(PI * u);
    const dx = fa - ja, dy = fh - jh, dd = sqrt(dx * dx + dy * dy), k = sqrt(max(0, 1.69 - (dd * dd) / 4)) / max(dd, 0.01), o = l * 6;
    (LG[o] = ja), (LG[o + 1] = jh), (LG[o + 2] = (ja + fa) / 2 + dy * k), (LG[o + 3] = (jh + fh) / 2 - dx * k), (LG[o + 4] = fa), (LG[o + 5] = fh);
  }
}
// Distance to a capsule; OO keeps the offset for shading.
const OO = new Float64Array(2);
function cap(a, b, a0, b0, a1, b1, r) {
  const pa = a - a0, pb = b - b0, ba = a1 - a0, bb = b1 - b0, t = cl((pa * ba + pb * bb) / (ba * ba + bb * bb + 1e-9), 0, 1), oa = pa - ba * t, ob = pb - bb * t;
  (OO[0] = oa), (OO[1] = ob);
  return sqrt(oa * oa + ob * ob) - r;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 8, 0.06], k1 = cl(k[0], 0, 1), b = input.btnPressed || [];
  (S.vt = 10 * cl(k[1], 0.2, 3)), (S.nd = cl(Math.round(k[2]), 8, 14)), (S.k4 = cl(k[3], 0, 1));
  if (k1 !== S.k1) {
    // New light: all ice is lit again.
    let i = 0;
    while (i < KL.length - 2 && k1 > KL[i + 1][0]) i++;
    for (let j = 1; j < 9; j++) S.L[j] = mix(KL[i][j], KL[i + 1][j], sm(KL[i][0], KL[i + 1][0], k1));
    (S.k1 = k1), S.gen++;
  }
  for (; !S.live; S.live = S.t > 6 ? 1 : 0) step(S, 1 / 30, S.k4);
  if (b[0]) (S.turn = S.lx > 0 ? -1 : 1), (S.turnT = 1.6);
  if (b[1]) (S.rest = 1 - S.rest), (S.restT = 0);
  step(S, cl(dt || 0, 0, 0.1), S.k4);
}

// Per frame: the frame, the shadow mask, the light and the LED paint works on.
let F, SM, LC, LL, Lx, Ly, cE, sE, PO, La, Lb;
function put(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  (F[o] += (r - F[o]) * a), (F[o + 1] += (g - F[o + 1]) * a), (F[o + 2] += (b - F[o + 2]) * a);
}
// Lay a part (distance d, radius r, 0 if flat) of colour c on LED PO.
function paint(d, r, c, f) {
  const q = cl(0.5 - d * Z, 0, 1) * f, nz = r ? sqrt(max(0, 1 - (OO[0] * OO[0] + OO[1] * OO[1]) / (r * r))) : 1, df = r ? max(0, ((OO[0] * La + OO[1] * Lb) / r) * cE + nz * sE) : sE;
  if (q > 0) for (let k = 0; k < 3; k++) F[PO + k] += (c[k] * (LL[k + 1] * min(2, df / sE) + LL[k + 4] * (0.55 + 0.45 * nz)) - F[PO + k]) * q;
}
// Nearest capsule of side view P; bob lifts the body.
function side(P, a, h, bob) {
  let d = 99;
  for (let j = 0; j < P.length; j += 5) d = min(d, cap(a, h, P[j], P[j + 1] + bob, P[j + 2], P[j + 3] + bob, P[j + 4]));
  return d;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.k1 < 0) return;
  (F = S.F), (SM = S.SM), (LC = S.LC), (LL = S.L);
  const { HL, HT, AL, MT, AM, DI, L, TM, LI, SQ, GN, cx, cy, t, k4, gen, nd: n } = S, run = (S.run = cl(S.v / 6, 0, 1));
  // Sun in the upper left, moon in the upper right.
  const night = S.k1 > 0.6, lx = (Lx = night ? 0.85 : -0.8), ly = (Ly = night ? -0.53 : -0.6), te = L[7], aur = L[8];
  (cE = 1 / sqrt(1 + te * te)), (sE = te * cE);
  const dON = L[1] + L[2] + L[3] > 3, Kx = -lx / te, Ky = -ly / te, ox = floor(cx), oy = floor(cy), fx = cx - ox, fy = cy - oy;
  let hmax = -9, hmin = 9;
  for (let j = 0, q = 0; j < HH; j++)
    for (let i = 0, ro = rw(oy - MY + j); i < HW; i++, q++) {
      const h = (HL[q] = HT[ro + cl(ox - MX + i + XO, 0, RX - 1)]);
      (hmax = max(hmax, h)), (hmin = min(hmin, h));
    }
  const ms = min(46, floor((hmax - hmin) / te) + 1);
  for (let ty = 0; ty < TH; ty++)
    for (let tx = 0, ro = rw(oy + ty); tx < TW; tx++) {
      const wi = ro + cl(ox + tx + XO, 0, RX - 1);
      // Ice keeps its light until the light or the ice changes.
      if (GN[wi] !== gen) {
        const k = (ty + MY) * HW + tx + MX, h = HL[k], gx = (HL[k + 1] - HL[k - 1]) * 0.7, gy = (HL[k + HW] - HL[k - HW]) * 0.7;
        const inv = 1 / sqrt(gx * gx + gy * gy + 1), dif = (-gx * lx * cE - gy * ly * cE + sE) * inv;
        let lt = 0;
        if (dif > 0 && dON) {
          let px = tx + MX + 0.5, py = ty + MY + 0.5, rh = h, oc = -1;
          for (let s = 0; s < ms && rh <= hmax; s++) (px += lx), (py += ly), (rh += te), (oc = max(oc, HL[(py | 0) * HW + (px | 0)] - rh));
          lt = min(2.2, dif / sE) * (1 - sm(-0.15, 0.3, oc));
        }
        // Slopes facing the light's side of the sky catch more sky.
        const cav = cl(((HL[k - 1] + HL[k + 1] + HL[k - HW] + HL[k + HW]) * 0.25 - h) * 0.6, -0.15, 0.3), nh = cl((-gx * lx - gy * ly) * inv * 2.5, -0.6, 0.6);
        (LI[wi] = lt), (SQ[wi] = (0.6 + 0.4 * inv) * (1 - cav) * (1 + 0.5 * nh)), (GN[wi] = gen);
      }
      // Aurora light; young ice and water mirror the sky.
      const sk = SQ[wi], mt = MT[wi], o = (ty * TW + tx) * 3, lit = LI[wi] * (mt === 3 ? 0.1 : 1);
      const eg = aur > 0 ? aur * 100 * (0.5 + 0.5 * sin((ox + tx) * 0.05 + (oy + ty) * 0.013 + 1.4 * sin((oy + ty) * 0.021 - t * 0.2) + t * 0.3)) ** 8 : 0;
      const rf = mt > 1 ? 0.3 : 0;
      for (let c = 0; c < 3; c++) (AM[o + c] = (AL[wi * 3 + c] / 255) * (L[4 + c] * sk + eg * (c === 1 ? 1 : 0.15)) + rf * L[4 + c]), (DI[o + c] = (AL[wi * 3 + c] / 255) * L[1 + c] * lit);
    }

  // Shadows: each side view thrown along the snow.
  SM.fill(0);
  const ux = S.ux, uy = S.uy;
  for (let i = 0; i < n && dON; i++) {
    const a = S.DF[i], ph = S.ph + S.DO[i], bob = 0.22 * run * sin(2 * PI * ph);
    legs(ph, run, bob);
    shadowOf(S.DX[i] - cx + fx, S.DY[i] - cy + fy, sin(a), -cos(a), Kx, Ky, 4.6, 5.6, DOG, bob, 1);
  }
  if (dON) shadowOf(S.sbx - cx + fx, S.sby - cy + fy, ux, uy, Kx, Ky, 16, 11, SLD, 0, 0);
  // Snow between grid points, shadows taken out.
  for (let i = 0, o = 0; i < TW * TH; i++) for (let c = 0, s = 1 - 0.55 * SM[i]; c < 3; c++, o++) AM[o] += DI[o] * s;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0, q = y * TW * 3; x < W; x++) for (let c = 0; c < 3; c++, p++, q++) F[p] = w00 * AM[q] + w10 * AM[q + 3] + w01 * AM[q + TW * 3] + w11 * AM[q + TW * 3 + 3];

  // Spindrift, under the dogs.
  for (let c = 0; c < 3; c++) LC[c] = L[4 + c] * 0.8 + L[1 + c] * 0.9;
  if (k4 > 0.01) {
    const th = 0.68 - 0.36 * k4, hz = 0.24 * k4 * k4;
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++) {
        const wx = x + cx, wy = y + cy, al = wx * GX + wy * GY - S.wind, ac = -wx * GY + wy * GX, n1 = 0.62 * vn(al * 0.055, ac * 0.325);
        if (n1 + 0.38 < th && hz < 0.004) continue;
        const q = sm(th, th + 0.25, n1 + 0.38 * vn(al * 0.125 + 17, ac * 0.65 + 5)) * (0.4 + 0.6 * k4) * 0.9 + hz, p = i * 3;
        for (let c = 0; c < 3; c++) F[p + c] += ((LC[c] + 25 + 7.5 * c) * 1.1 - F[p + c]) * q;
      }
  }
  // The team, then breath.
  gangline(S);
  for (let i = 0; i < n; i++) dog(S, i);
  sled(S.sbx - cx, S.sby - cy, ux, uy);
  for (let p = 0; p < 256; p++) {
    const ag = S.BA[p], bx = S.BX[p] - cx, by = S.BY[p] - cy, r = 0.7 + ag * (1.2 + k4), al = 0.32 * (1 - ag / 1.5) * (1 - 0.5 * k4);
    for (let y = floor(by - r); y <= by + r && ag < 1.5; y++)
      for (let x = floor(bx - r); x <= bx + r; x++) put(x, y, LC[0] * 1.15, LC[1] * 1.15, LC[2] * 1.15, al * (1 - ((x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2) / (r * r)));
  }
  const tm = (v) => TM[min(1199, v | 0)];
  for (let i = 0, p = 0; i < N; i++, p += 3) display.setPixel(i & 63, i >> 6, tm(F[p]), tm(F[p + 1]), tm(F[p + 2]));
}

// A shadow: each grid point maps back to (a, h) in side view P.
function shadowOf(x, y, Fx, Fy, Kx, Ky, A, Hh, P, bob, withLegs) {
  const det = Fx * Ky - Fy * Kx, ax = abs(Fx) * A * Z, ay = abs(Fy) * A * Z, hx = Kx * Hh * Z, hy = Ky * Hh * Z;
  for (let py = max(0, floor(y - ay + min(0, hy))); py <= min(TH - 1, y + ay + max(0, hy)) && abs(det) > 0.05; py++)
    for (let px = max(0, floor(x - ax + min(0, hx))); px <= min(TW - 1, x + ax + max(0, hx)); px++) {
      const rx = (px + 0.5 - x) / Z, ry = (py + 0.5 - y) / Z, a = (rx * Ky - ry * Kx) / det, h = (Fx * ry - Fy * rx) / det, i = py * TW + px;
      if (h < -0.6 || h > Hh || a < -A || a > A) continue;
      let d = side(P, a, h, bob);
      for (let o = 0; o < 24 && withLegs && h < 3.2; o += 6) if (abs(a - LG[o + 2]) < 2.2) d = min(d, cap(a, h, LG[o], LG[o + 1], LG[o + 2], LG[o + 3], 0.36), cap(a, h, LG[o + 2], LG[o + 3], LG[o + 4], LG[o + 5], 0.28));
      SM[i] = max(SM[i], cl(0.6 - d * 1.4 * Z, 0, 1));
    }
}
// The gangline, in soft dots from the lead dog to the sled.
function gangline(S) {
  for (let s = (S.nd & 1 ? 2.6 : -1) * Z; s < (((S.nd + 1) >> 1) - 1) * S.pt + 8 * Z; s += 0.6) {
    pathAt(S, s);
    const x = PP[0] - S.cx - 0.5, y = PP[1] - S.cy - 0.5;
    for (let j = 0; j < 4; j++) {
      const X = floor(x) + (j & 1), Y = floor(y) + (j >> 1);
      put(X, Y, LINE[0] * LC[0], LINE[1] * LC[1], LINE[2] * LC[2], 0.45 * (1 - abs(x - X)) * (1 - abs(y - Y)));
    }
  }
}

// A dog from above: legs, saddle, harness, neck, head, curled tail.
function dog(S, i) {
  const x = S.DX[i] - S.cx, y = S.DY[i] - S.cy, an = S.DF[i], Fx = sin(an), Fy = -cos(an), ph = S.ph + S.DO[i], [BK, SD, FC] = COAT[S.DC[i]], ext = sin(2 * PI * ph) * S.run, ts = i & 1 ? 1 : -1;
  (La = (Lx * Fx + Ly * Fy) * cE), (Lb = (-Lx * Fy + Ly * Fx) * cE);
  legs(ph, S.run, 0);
  for (let py = max(0, floor(y - 5.4 * Z)); py <= min(H - 1, y + 5.4 * Z); py++)
    for (let px = max(0, floor(x - 5.4 * Z)); px <= min(W - 1, x + 5.4 * Z); px++) {
      const qx = (px + 0.5 - x) / Z, qy = (py + 0.5 - y) / Z, a = qx * Fx + qy * Fy, b = -qx * Fy + qy * Fx;
      if (a * a + b * b > 30) continue;
      PO = (py * W + px) * 3;
      for (let l = 0; l < 24; l += 6) paint(cap(a, b, LG[l], l % 12 ? 0.85 : -0.85, LG[l + 4], l % 12 ? 0.95 : -0.95, 0.38), 0.38, SD, 1);
      const d = cap(a, b, -2.1 - 0.25 * ext, 0, 1.1 + 0.15 * ext, 0, 1.12), q = cl(0.5 - d * Z, 0, 1);
      paint(d, 1.12, SD, 1);
      if (q > 0) paint(d, 1.12, BK, sm(0.85, 0.35, abs(OO[1])) * q), abs(a - 0.7) < 0.45 && paint(d, 1.12, HARN, q);
      paint(cap(a, b, 1.4, 0, 2.7, 0, 0.55), 0.55, SD, 1);
      paint(cap(a, b, 3, 0, 3.3, 0, 0.8), 0.8, FC, 1);
      paint(cap(a, b, 3.5, 0, 4.4, 0, 0.42), 0.42, FC, 1);
      paint(cap(a, b, -2.2, ts * 0.35, -2.2, ts * 0.35, 0.75), 0.75, FC, 1);
    }
}

// The sled: runners, slats, load, handlebar, the musher.
function sled(x, y, Fx, Fy) {
  (La = (Lx * Fx + Ly * Fy) * cE), (Lb = (-Lx * Fy + Ly * Fx) * cE);
  for (let py = max(0, floor(y - 17 * Z)); py <= min(H - 1, y + 17 * Z); py++)
    for (let px = max(0, floor(x - 17 * Z)); px <= min(W - 1, x + 17 * Z); px++) {
      const qx = (px + 0.5 - x) / Z, qy = (py + 0.5 - y) / Z, a = qx * Fx + qy * Fy, b = -qx * Fy + qy * Fx, ab = abs(b);
      if (a < -3 || a > 16 || ab > 3.2) continue;
      PO = (py * W + px) * 3;
      paint(cap(a, ab, -2.2, 2, 14.6, 2, 0.4), 0, DARK, 1);
      paint(max(ab - 1.7, abs(a - 8.4) - 5.6), 0, a % 1.6 < 1.1 ? WOOD : DARK, 1);
      paint(max(ab - 1.3, abs(a - 8.7) - 3.2) - 0.25, 0, LOAD, 1);
      paint(cap(a, b, 2.7, -2.3, 2.7, 2.3, 0.35), 0, DARK, 1);
      paint(cap(a, b, 0.7, -1.4, 0.7, 1.4, 1), 1, RED, 1);
      paint(cap(a, b, 1, 0, 1, 0, 1.1), 1.1, FUR, 1);
    }
}
