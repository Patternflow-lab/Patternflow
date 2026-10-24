// ===== Patternflow pattern =====
// Title:   Emergence
// Family:  mammal
// Idea:    At dusk over dry hill country a dark ribbon of free-tailed bats pours out of a cave mouth and corkscrews up the whole sky, splits in two and joins again, streams off sideways at the top, and ripples open round a hawk that dives through it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after the summer evening emergence of Mexican free-tailed bats (Tadarida brasiliensis) from the caves of the Texas Hill Country
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Dusk=0..1, Speed=0.2..3, Bats=400..1400, Wind=-1..1
//
// Knob 1: Dusk. How late it is: at 0 the afterglow burns orange behind the far mesa and goes rose, then indigo overhead, and towards 1 it sinks into night, the stars come out and a full moon rises behind the column, so the bats and the hawk cross it as black shapes.
// Knob 2: Speed. The pace of everything: at 2 a bat climbs from the cave mouth to the top of the panel in about four seconds and beats its wings five times a second, and at 0.2 it all runs ten times slower.
// Knob 3: Bats. How many bats are out, from a stream of 400 to a river of 1400 that also widens the column. Turned down, the bats already in the air finish their trip and fewer follow them out of the cave.
// Knob 4: Wind. A crosswind: the column leans downwind and most of the bats peel off that way at the top, and the high cloud streaks drift with it. With no wind about three in four turn right.
// Buttons: K1 tap sends a hawk diving through the column now. On its own the first one comes about four seconds in, then one every fifteen to twenty seconds.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, floor, round, sin, cos, sqrt, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const hyp = (a, b) => sqrt(a * a + b * b);
const rnd = () => Math.random();
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

// The cave mouth: its middle column, floor row, half width and height.
const [CX, CB, CW, CH] = [27, 121, 9, 9.5];
// The row where the bats come out, the most bats the knob asks for, the
// spine's length in rows, and a bat's climb at Speed 2 in LEDs a second.
const [CY, MAXB, HM, V0] = [115, 1400, 118, 28];
// The column's front at the start, and the length of one trip.
const [F0, LT] = [90, 150];

// The sky from the top (0) to the horizon (1): afterglow, late dusk, night.
const SKIES = [
  [[0, 30, 26, 98], [0.2, 66, 46, 138], [0.42, 160, 70, 134], [0.62, 236, 104, 100], [0.8, 255, 146, 72], [1, 255, 196, 112]],
  [[0, 12, 14, 62], [0.3, 30, 30, 100], [0.6, 94, 52, 116], [0.84, 190, 84, 78], [1, 228, 126, 66]],
  [[0, 5, 9, 32], [0.45, 10, 18, 56], [0.8, 22, 30, 74], [1, 44, 42, 84]],
];
// Rock, far hills, scrub and the lit undersides of the clouds at each hour.
const LAND = [
  [92, 64, 54, 116, 72, 96, 34, 36, 24, 255, 178, 150],
  [56, 40, 46, 64, 44, 80, 24, 26, 22, 140, 66, 96],
  [28, 28, 40, 30, 30, 60, 14, 18, 22, 18, 20, 38],
];
// A bat against the light, and the hawk.
const BAT = [14, 10, 12];

function ramp(S, g, c) {
  let j = 0;
  while (j < S.length - 2 && g > S[j + 1][0]) j++;
  const a = S[j], b = S[j + 1];
  return mix(a[c + 1], b[c + 1], cl((g - a[0]) / (b[0] - a[0]), 0, 1));
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const P = (params.s = {
    t: 0, init: false, bg: F(N * 3), f: F(N * 3), D: F(N), key: -1, co: 0, hk: null, ring: null, nh: 3.4,
    S: F(MAXB), V: F(MAXB), A: F(MAXB), B: F(MAXB), TU: F(MAXB), RH: F(MAXB), DR: F(MAXB), JF: F(MAXB), JP: F(MAXB),
    FR: F(MAXB), FP: F(MAXB), OX: F(MAXB), OY: F(MAXB), VX: F(MAXB), VY: F(MAXB), BX: F(MAXB), BY: F(MAXB), Z: F(MAXB),
    SX: F(HM), SR: F(HM), SP: F(HM), SS: F(HM), RID: F(W), FAR: F(W), CT: F(128 * 72),
  });
  // The near hill climbs over the cave; a flat mesa stands far off on the right.
  for (let x = 0; x < W; x++) {
    P.RID[x] = 99 + 0.07 * x - 10 * exp(-(((x - 23) / 15) ** 2)) + 2 * vn(x * 0.13, 3) + 1.2 * vn(x * 0.4, 9) - 1.6;
    P.FAR[x] = 90 + 2.5 * vn(x * 0.09, 1) + 1.5 * vn(x * 0.3, 2) - 7 * sm(38, 43, x) * (1 - sm(57, 61, x)) - 2 * exp(-(((x - 8) / 9) ** 2));
  }
  // Scrub: juniper and mesquite clumps on the slope and along the skyline.
  P.bush = [];
  for (let n = 0; n < 34; n++) {
    const x = rnd() * W, top = n < 10, r = top ? 1 + rnd() * 1.2 : 0.8 + rnd() * 1.3;
    const y = top ? P.RID[floor(x)] - r * 0.4 : P.RID[floor(x)] + 2 + rnd() * (H - P.RID[floor(x)] - 2);
    if (((x - CX) / (CW + 3)) ** 2 + ((CB - y) / (CH + 3)) ** 2 > 1 || y > CB + 2) P.bush.push([x, y, r]);
  }
  P.stars = Array.from({ length: 80 }, () => [floor(rnd() * W), floor(rnd() * 86), 0.4 + rnd() * 0.6, rnd() * 7, 1 + rnd() * 3]);
  // Thin streaks of high cloud, wrapping every 128 columns.
  for (let y = 0; y < 72; y++)
    for (let x = 0; x < 128; x++) {
      const f = (X) => 0.6 * vn(X * 0.035, y * 0.3) + 0.4 * vn(X * 0.11, y * 0.5 + 7);
      const band = sm(0, 10, y) * (1 - sm(56, 72, y)) * (0.5 + 0.5 * sin(y * 0.21 + 1));
      P.CT[y * 128 + x] = sm(0.5, 0.75, mix(f(x), f(x + 128), x / 128)) * band;
    }
}

// Where a bat turns off the column, how wide it swings and which way.
function route(P, i) {
  const top = rnd() < 0.16;
  P.TU[i] = top ? 98 + 14 * rnd() : P.tu + 13 * rnd();
  P.RH[i] = top ? 30 : 15 + 7 * rnd();
  P.DR[i] = rnd() < cl(0.72 + 0.6 * P.w, 0.04, 0.96) ? 1 : -1;
}

function place(P, M) {
  for (let i = 0; i < MAXB; i++) {
    const a = rnd() * 2 - 1;
    P.A[i] = (a < 0 ? -1 : 1) * abs(a) ** 0.8;
    P.B[i] = (rnd() - 0.5) * 1.2;
    P.V[i] = V0 * (0.8 + 0.4 * rnd());
    P.JF[i] = 1.4 + rnd() * 2.4;
    P.JP[i] = rnd() * 7;
    P.FR[i] = 4 + rnd() * 2.6;
    P.FP[i] = rnd();
    route(P, i);
    P.S[i] = i < M ? F0 - rnd() * LT : -1 - rnd() * LT;
  }
  P.init = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1) * (cl(k[1], 0.2, 3) / 2), M = round(cl(k[2], 400, 1400));
  P.k1 = cl(k[0], 0, 1);
  P.w = cl(k[3], -1, 1);
  const T = (P.t += d);
  // The height where the stream peels off wanders slowly.
  P.tu = 80 + 8 * sin(T * 0.23 + 1);
  if (!P.init) place(P, M);
  const w = P.w, { SX, SR, SP, SS } = P;
  P.co += d * (1.2 + 4 * w);

  // The spine of the column: it leans downwind, corkscrews and breathes, and
  // now and then tears in two along its middle and closes again higher up.
  const Rk = 5 + (3.5 * (M - 400)) / 1000, ph = (T - 2.4) % 12, split = T < 2.4 ? 0 : sm(0, 1.4, ph) * (1 - sm(4.6, 6.2, ph));
  for (let h = 0; h < HM; h++) {
    const A = 1 + 7.5 * sm(4, 92, h);
    SX[h] = CX + w * (0.17 * h + 0.0009 * h * h) + A * (sin(0.052 * h - 1.3 * T) + 0.4 * sin(0.12 * h + 0.75 * T + 2));
    SR[h] = Rk * (1.25 - 0.55 * sm(0, 26, h) + 0.3 * sm(20, 50, h)) * (1 + 0.005 * h) * (1 + 0.3 * sin(0.075 * h - 2.1 * T));
    SP[h] = 0.055 * h - 1.7 * T;
    SS[h] = h > 18 && h < 96 ? split * 9 * sin((PI * (h - 18)) / 78) : 0;
  }

  // The hawk: a stoop through the column on a curve, out the other side.
  if (input.btnPressed && input.btnPressed[0] && !P.hk) P.nh = 0;
  if (!P.hk && (P.nh -= d) <= 0) {
    const s = rnd() < 0.5 ? 1 : -1, ht = floor(46 + rnd() * 26), tx = SX[ht], ty = CY - ht, x0 = 32 + s * 46, y0 = -12, x2 = 32 - s * 52, y2 = ty - 34;
    P.hk = { t: 0, x0, y0, x2, y2, cx: 2 * tx - (x0 + x2) / 2, cy: 2 * ty - (y0 + y2) / 2, hit: false };
  }
  const hk = P.hk;
  if (hk) {
    const u = (hk.t += d) / 2.3, v = 1 - u;
    if (u >= 1) (P.hk = null), (P.nh = 12 + rnd() * 6);
    else {
      hk.x = v * v * hk.x0 + 2 * u * v * hk.cx + u * u * hk.x2;
      hk.y = v * v * hk.y0 + 2 * u * v * hk.cy + u * u * hk.y2;
      const dx = v * (hk.cx - hk.x0) + u * (hk.x2 - hk.cx), dy = v * (hk.cy - hk.y0) + u * (hk.y2 - hk.cy), l = hyp(dx, dy) || 1;
      (hk.ux = dx / l), (hk.uy = dy / l), (hk.u = u);
      if (!hk.hit && u >= 0.5) (hk.hit = true), (P.ring = { x: hk.x, y: hk.y, t: 0 });
    }
  }
  const rg = P.ring;
  if (rg && (rg.t += d) > 1.4) P.ring = null;
  const hx = P.hk ? P.hk.x : -999, hy = P.hk ? P.hk.y : -999, rr = rg ? 4 + 26 * rg.t : 0, ra = rg ? 1 - rg.t / 1.4 : 0;

  const { S, V, A, B, TU, RH, DR, JF, JP, OX, OY, VX, VY, BX, BY, Z } = P;
  for (let i = 0; i < MAXB; i++) {
    if (S[i] < 0 && i >= M) continue;
    // Fast out of the mouth, then the steady climb.
    const s = (S[i] += V[i] * d * (S[i] < 40 ? 1.6 - 0.015 * S[i] : 1));
    if (s < 0) continue;
    const hh = min(s, TU[i]), j = min(HM - 2, floor(hh)), f = hh - j;
    const r = mix(SR[j], SR[j + 1], f), p = mix(SP[j], SP[j + 1], f), ca = cos(p), sa = sin(p), a = A[i], b = B[i] * (1.9 - 0.9 * sm(0, 30, hh));
    let x = mix(SX[j], SX[j + 1], f) + r * (a * ca - b * sa) + (a < 0 ? -1 : 1) * mix(SS[j], SS[j + 1], f) + 1.1 * sin(T * JF[i] + JP[i]);
    let y = CY - hh + 0.8 * sin(T * JF[i] * 1.3 + JP[i] * 2);
    Z[i] = a * sa + b * ca;
    if (s > TU[i]) {
      // Off the top of the column in a curve, then straight out sideways.
      const u = s - TU[i], rho = RH[i], al = min(u / rho, 1.25), st = max(0, u - rho * 1.25);
      x += DR[i] * (rho * (1 - cos(al)) + st * 0.949);
      y -= rho * sin(al) + st * 0.315;
    }
    // Away from the hawk and the ring it sends out, then back into the stream.
    let ax = -18 * OX[i] - 6 * VX[i], ay = -18 * OY[i] - 6 * VY[i], dx = x + OX[i] - hx, dy = y + OY[i] - hy, q = dx * dx + dy * dy;
    if (q < 196) {
      const e = sqrt(q) + 0.3, g = (1700 * (1 - e / 14) ** 2) / e;
      (ax += g * dx), (ay += g * dy);
    }
    if (rg) {
      (dx = x + OX[i] - rg.x), (dy = y + OY[i] - rg.y);
      const e = hyp(dx, dy) + 0.5, wv = e - rr;
      if (wv * wv < 30) {
        const g = (480 * ra * exp((-wv * wv) / 6)) / e;
        (ax += g * dx), (ay += g * dy);
      }
    }
    VX[i] += ax * d;
    VY[i] += ay * d;
    OX[i] = cl(OX[i] + VX[i] * d, -16, 16);
    OY[i] = cl(OY[i] + VY[i] * d, -16, 16);
    x += OX[i];
    y += OY[i];
    if (x < -3 || x > W + 2 || y < -3) {
      // Out of sight: back to the cave mouth for another trip.
      S[i] = i < M ? -rnd() * 4 : -1 - rnd() * LT;
      OX[i] = OY[i] = VX[i] = VY[i] = 0;
      route(P, i);
      continue;
    }
    BX[i] = x;
    BY[i] = y;
  }
}

// The sky, the moon, the hills and the cave, kept until the hour moves.
function backdrop(P, k) {
  const B = P.bg, i0 = k < 0.5 ? 0 : 1, f = k < 0.5 ? k * 2 : k * 2 - 1;
  const L = LAND[i0].map((v, c) => mix(v, LAND[i0 + 1][c], f));
  const glow = 1 - sm(0.2, 0.9, k), mx = 37, my = 134 - 88 * sm(0.12, 1, k), mr = 8.5, mc = [mix(250, 246, sm(100, 60, my)), mix(184, 240, sm(100, 60, my)), mix(124, 220, sm(100, 60, my))];
  P.cc = L.slice(9, 12);
  for (let y = 0; y < H; y++) {
    const g = y / 100, sky = [0, 1, 2].map((c) => mix(ramp(SKIES[i0], g, c), ramp(SKIES[i0 + 1], g, c), f));
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, rid = P.RID[x];
      let col;
      if (y < rid) {
        // Brighter where the sun went down, behind the far mesa.
        const wg = 1 + 0.2 * glow * exp(-(((x - 50) / 20) ** 2)) * sm(0.3, 1, g);
        col = sky.map((v) => v * wg);
        const md = hyp(x + 0.5 - mx, y + 0.5 - my);
        if (md < mr) {
          const ma = 0.82 + 0.18 * sm(0.35, 0.65, vn(x * 0.4 + 3, y * 0.4)) - 0.12 * (md / mr) ** 4;
          col = mc.map((v) => v * ma);
        } else col = col.map((v, c) => v + mc[c] * 0.3 * sm(0.25, 0.8, k) * exp(-(md - mr) / 5));
        if (y >= P.FAR[x]) {
          const fv = 0.86 + 0.14 * vn(x * 0.3, y * 0.3);
          col = col.map((v, c) => mix(v, L[3 + c] * fv, 0.8));
        }
      } else {
        // Limestone with darker strata, catching light along the skyline.
        const n = vn(x * 0.22, y * 0.45), n2 = vn(x * 0.07 + 5, y * 0.16);
        let v = (0.6 + 0.4 * n + 0.25 * sm(0.55, 0.7, n2)) * (1 + 0.3 * exp(-(y - rid) / 2.5)) * (1 - (0.28 * (y - 92)) / 36);
        if (((y + 4 * vn(x * 0.05, 7)) % 6) < 1) v *= 0.72;
        const e = (abs((x + 0.5 - CX) / CW) ** 2.4 + abs((CB - y - 0.5) / CH) ** 2.4) ** (1 / 2.4) * (0.96 + 0.09 * vn(x * 0.7, y * 0.7));
        // The pale outcrop the cave opens in, cracked, with a ledge on top.
        const ot = CB - CH - 6 + 2.5 * vn(x * 0.2, 4), ow = 16 + 4 * vn(y * 0.2, 6) - 6 * sm(CB - 3, CB - CH - 6, y);
        if (y >= ot && y < CB + 1 && abs(x + 0.5 - CX) < ow) {
          v = (1.05 + 0.3 * n) * (y < ot + 1 ? 1.3 : 1) * (vn(x * 0.9, y * 0.1) < 0.28 ? 0.66 : 1) * (1 - 0.25 * sm(ow - 3, ow, abs(x + 0.5 - CX)));
          if (e < 1.35) v *= 0.75 + 0.25 * sm(1, 1.35, e);
        }
        if (y < CB && e < 1) {
          // The mouth, black inside and a little lit at the lip.
          const lip = sm(0.75, 1, e);
          col = [3 + 12 * lip, 2 + 8 * lip, 3 + 8 * lip];
        } else {
          if (y >= CB) v *= (1.1 + 0.25 * hash(x, y)) * (1 - 0.45 * exp(-(((x - CX) / CW) ** 2)) * sm(CB + 5, CB, y));
          col = L.slice(0, 3).map((c) => c * v);
        }
      }
      (B[o] = col[0]), (B[o + 1] = col[1]), (B[o + 2] = col[2]);
    }
  }
  for (const [bx, by, br] of P.bush)
    for (let y = floor(by - br); y <= by + br; y++)
      for (let x = floor(bx - br); x <= bx + br; x++) {
        const e = hyp(x + 0.5 - bx, (y + 0.5 - by) * 1.2) / br;
        if (x < 0 || x >= W || y < 0 || y >= H || e > 1) continue;
        const o = (y * W + x) * 3, v = (0.8 + 0.4 * hash(x, y + 50)) * (y + 0.5 < by - br * 0.3 ? 1.45 : 1);
        for (let c = 0; c < 3; c++) B[o + c] = L[6 + c] * v;
      }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.init) return;
  const k = P.k1, key = round(k * 400);
  if (key !== P.key) backdrop(P, k), (P.key = key);
  const F = P.f, D = P.D, T = P.t;
  F.set(P.bg);
  // Stars come out as the glow goes, behind the cloud streaks.
  const sk = sm(0.4, 0.95, k);
  if (sk > 0)
    for (const [x, y, b, ph, fq] of P.stars) {
      if (y >= P.FAR[x] - 1) continue;
      const o = (y * W + x) * 3, v = sk * b * (0.75 + 0.25 * sin(T * fq + ph));
      (F[o] += 190 * v), (F[o + 1] += 190 * v), (F[o + 2] += 210 * v);
    }
  // High cloud drifts with the wind, lit from below by the sun that has set.
  const cc = P.cc, sh = floor(P.co);
  for (let y = 0; y < 72; y++)
    for (let x = 0; x < W; x++) {
      const a = P.CT[y * 128 + ((x - sh) & 127)];
      if (a < 0.02 || y >= P.FAR[x]) continue;
      const o = (y * W + x) * 3, g = 0.55 + y / 110, al = 0.55 * a;
      for (let c = 0; c < 3; c++) F[o + c] = mix(F[o + c], cc[c] * g, al);
    }

  // Bats and the hawk as darkness laid over the light.
  D.fill(0);
  const put = (x, y, a) => {
    if (x >= 0 && x < W && y >= 0 && y < H) D[y * W + x] += a;
  };
  const M = P.S.length;
  for (let i = 0; i < M; i++) {
    if (P.S[i] < 0) continue;
    const x = round(P.BX[i]), y = round(P.BY[i]), near = P.Z[i] > -0.3, q = floor(((T * P.FR[i] + P.FP[i]) % 1) * 3) - 1;
    if (near) put(x, y, 0.95), put(x - 1, y + q, 0.8), put(x + 1, y + q, 0.8);
    else put(x, y, 0.6), put(x + (q ? 1 : -1), y + q, 0.35);
  }
  const hk = P.hk;
  if (hk && hk.x !== undefined) {
    const { x, y, ux, uy, u } = hk, nx = -uy, ny = ux;
    const seg = (x0, y0, x1, y1, r) => {
      const n = 2 * hyp(x1 - x0, y1 - y0) + 1;
      for (let s = 0; s <= n; s++) {
        const px = mix(x0, x1, s / n), py = mix(y0, y1, s / n);
        for (let yy = floor(py - r); yy <= py + r; yy++) for (let xx = floor(px - r); xx <= px + r; xx++) if (hyp(xx + 0.5 - px, yy + 0.5 - py) <= r + 0.25) put(xx, yy, 0.6);
      }
    };
    seg(x + 2.2 * ux, y + 2.2 * uy, x - 3 * ux, y - 3 * uy, 1);
    seg(x - 3 * ux, y - 3 * uy, x - 4.6 * ux + 0.9 * nx, y - 4.6 * uy + 0.9 * ny, 0.6);
    seg(x - 3 * ux, y - 3 * uy, x - 4.6 * ux - 0.9 * nx, y - 4.6 * uy - 0.9 * ny, 0.6);
    if (u > 0.14 && u < 0.5) {
      // Wings folded back in the stoop.
      for (const sg of [1, -1]) seg(x + 0.8 * ux + sg * nx, y + 0.8 * uy + sg * ny, x - 4 * ux + sg * 2.4 * nx, y - 4 * uy + sg * 2.4 * ny, 0.6);
    } else {
      // Spread and beating as it climbs away.
      const fl = 1.6 * sin(hk.t * 15);
      for (const sg of [1, -1]) {
        const wx = x + sg * 3.2 * nx + 1.1 * ux, wy = y + sg * 3.2 * ny + 1.1 * uy;
        seg(x + 0.5 * ux, y + 0.5 * uy, wx, wy, 0.9);
        seg(wx, wy, x + sg * 6.2 * nx - (0.6 + fl) * ux, y + sg * 6.2 * ny - (0.6 + fl) * uy, 0.55);
      }
    }
  }
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const a = min(1, D[i]), b = 1 - a;
    display.setPixel(i & 63, i >> 6, min(255, F[o] * b + BAT[0] * a) | 0, min(255, F[o + 1] * b + BAT[1] * a) | 0, min(255, F[o + 2] * b + BAT[2] * a) | 0);
  }
}
