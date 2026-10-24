// ===== Patternflow pattern =====
// Title:   Implosion
// Family:  construction
// Idea:    An old concrete tower block among low buildings at dawn is brought down by explosive demolition: a siren light flashes, a ripple of charges runs down the floors, the tower folds and drops into its own footprint under a grey-ochre dust cloud that boils up to the top of the panel and drifts off, and in time-lapse the rubble is cleared and a new tower rises in scaffolding for the next blast.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after the explosive demolitions of 1960s concrete tower blocks watched by crowds behind the site fence
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Storeys=20..30, Wind=-1..1
//
// Knob 1: Light. Blue dawn at 0, work lamps in a third of the windows and the floodlights faint; then low morning sun from the left, then flat overcast grey, and at 1 night, when two floodlight masts throw beams up the tower and into the dust.
// Knob 2: Speed. At 2 the charges go 2.4 s in, the tower is down within three seconds and a round from blast to blast takes 36 s; at 0.2 it all runs ten times slower.
// Knob 3: Storeys. Twenty to thirty storeys. Twenty stand 80 rows under the roof plant and the mast; past 26 the floors get lower so the roof stays on the panel.
// Knob 4: Wind. Calm at 0, round clouds and the dust going straight up; either way the clouds stretch into slanting streaks, and the dust cloud, the chimney smoke, the water cannon's spray and the scattering pigeons lean with it.
// Buttons: K1 tap detonates now: the siren, then the charges. During the rebuild it finishes the tower first.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, exp, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise that repeats every cx by cy cells, so the 64x128 tile has no seam.
function vn(x, y, cx = 1e4, cy = 1e4) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const h = (i, j) => hash(((i % cx) + cx) % cx, ((j % cy) + cy) % cy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + h(xi + 1, yi + 1)) * su * sv;
}

// The site's ground row; the tower's front face from x 19, 22 wide, and its side face, 6; roof plant and mast rows.
const G = 110, X0 = 19, TW = 28, CX = 33, MAST = 16;
// A round at Speed 2, in seconds: charges, the fall, diggers in, time-lapse, lot clear, frame rising, frame up, next round.
const T_CH = 2.4, T_FALL = 3, T_EX = 11, T_TL = 19, T_CLR = 25, T_RISE = 26.5, T_UP = 32.5, CYC = 36;
const MP = 240, PF = 12;
// Dawn, morning sun, overcast, night: sky top, middle, horizon; ambient; sun; lit windows; floodlights; cloud lit, dark; cover.
const KEYS = [
  [16, 30, 86, 52, 84, 156, 214, 146, 150, 0.4, 0.45, 0.66, 0.55, 0.32, 0.3, 0.34, 0.35, 236, 156, 156, 58, 60, 108, 0.5],
  [46, 108, 206, 110, 164, 228, 236, 206, 160, 0.55, 0.58, 0.68, 1, 0.86, 0.62, 0.06, 0, 255, 244, 226, 150, 160, 190, 0.38],
  [96, 102, 112, 136, 140, 146, 170, 170, 168, 0.66, 0.66, 0.68, 0.08, 0.08, 0.08, 0.12, 0.12, 190, 192, 196, 100, 104, 112, 0.9],
  [3, 5, 18, 8, 14, 38, 34, 32, 58, 0.14, 0.15, 0.24, 0, 0, 0, 0.5, 1, 40, 38, 58, 12, 14, 28, 0.45],
];
const TILE = [80, 110, 170], BRICK = [170, 84, 56], PALE = [190, 176, 150], RUST = [150, 80, 50];
const COATS = [[30, 34, 56], [56, 30, 36], [34, 46, 34], [50, 44, 34], [250, 120, 20]];
const MID = [0, 0, 0], LAMP = [200, 190, 150], DARK = [30, 28, 28], HOLE = [14, 12, 12], RED = [255, 40, 30];
const CON = [160, 154, 144], WARM = [255, 188, 104], YEL = [242, 182, 32], DUST0 = [150, 147, 142], DUST1 = [190, 164, 120], SIL = [12, 12, 16], AMBER = [255, 150, 30];

function light(h) {
  const u = cl(h, 0, 1) * 3, i = min(2, floor(u)), f = u - i;
  return KEYS[i].map((v, j) => mix(v, KEYS[i + 1][j], f));
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const P = (params.s = { F: f(N * 3), NT: f(N), BA: f(N * 3), BU: f(N), BK: new Uint8Array(N), FL: f(N), SKY: f(H * 3), pf: f(MP * PF), np: 0, db: [], sp: [], T: 0, rt: 0, fr: 0, S: 0, cyc: 0, co: 0, w: 0 });
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6;
    P.NT[i] = 0.5 * vn(x / 16, y / 16, 4, 8) + 0.3 * vn(x / 8, y / 8, 8, 16) + 0.2 * vn(x / 4, y / 4, 16, 32);
    // Two floodlight masts by the fence aim their beams up the tower.
    for (const lx of [2, 61]) {
      const dx = x - lx, dy = y - 82, dd = sqrt(dx * dx + dy * dy) + 0.5, ax = CX - lx, ay = -32, c = (dx * ax + dy * ay) / (dd * sqrt(ax * ax + ay * ay));
      P.FL[i] += exp(-(1 - c) * 32) / (1 + dd / 40) + 0.9 * exp((-dd * dd) / 5);
    }
  }
  scenery(P);
  P.cr = [];
  for (let x = 2; x < 63; x += 3 + floor(rnd() * 3)) if (rnd() < 0.85) P.cr.push([x, 111 + floor(rnd() * 4), 4 + floor(rnd() * 3), rnd(), rnd(), P.cr.length % 7 === 3 ? 4 : floor(rnd() * 4)]);
  newRound(P);
}

// The street, the site, two low blocks, a far skyline with a spire, a factory chimney and a water cannon on a roof.
function scenery(P) {
  const top = new Float32Array(W);
  for (let x = 0; x < W; ) for (let j = 0, w = 3 + floor(rnd() * 6), t = 72 + floor(rnd() * 16); j < w && x < W; j++) top[x++] = t;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, hh = hash(x, y), o = i * 3;
    let k = 2, c = null;
    if (y > 118) c = [58, 58, 64].map((v) => v * (0.9 + 0.2 * hh));
    else if (y === 118) c = [120, 118, 112];
    else if (y >= G) c = [118, 104, 86].map((v) => v * (0.8 + 0.35 * hh));
    else if (x >= 51 && x <= 55 && y >= 85 && y <= 89) c = abs(x - 53) + abs(y - 86.5) < 1.6 ? [40, 44, 50] : [116, 120, 128];
    else if (x <= 14 && y >= 82) {
      c = y < 84 ? [170, 160, 150] : [148, 92, 70].map((v) => v * (0.88 + 0.2 * hash(x >> 1, y)));
      if (y >= 86 && (y < 103 ? (x & 3) && (x & 3) < 3 && (y - 86) % 4 < 2 : y > 104 && x > 1 && x < 13)) (k = 3), (P.BU[i] = y > 104 ? hh * 0.4 : hh);
    } else if (x >= 49 && y >= 90) {
      c = y < 92 ? [190, 182, 170] : [176, 162, 138].map((v) => v * (0.9 + 0.15 * hash(x, y >> 2)));
      if (y >= 94 && y < 108 && (x - 50) % 4 > 0 && (x - 50) % 4 < 3 && (y - 94) % 4 < 2) (k = 3), (P.BU[i] = hh);
    } else if (x >= 56 && x <= 59 && y >= 44) c = y === 44 ? [180, 172, 160] : (y >= 47 && y <= 48) || (y >= 52 && y <= 53) ? [176, 70, 56] : [150, 138, 124];
    else if (y >= top[x] || (y >= 58 && abs(x - 9) <= (y - 58) / 6)) {
      k = hash(x, y >> 1) < 0.07 && y & 1 ? 4 : 1;
      c = [60, 66, 86].map((v) => v * (0.85 + 0.25 * hash(x >> 2, 3)));
    } else k = 0;
    P.BK[i] = k;
    if (c) for (let j = 0; j < 3; j++) P.BA[o + j] = c[j];
  }
}

// The tower's facade for S storeys: one kind per cell, each window's chance to be lit, the crack field.
function facade(P, S) {
  const p = min(4, 100 / S), BH = round(S * p), BT = BH + MAST, n = TW * BT, st = [];
  for (let s = 0; s <= S; s++) st.push(round(s * p));
  const A = new Float32Array(n), K = new Uint8Array(n), U = new Float32Array(n), C = new Float32Array(n), RS = new Int16Array(BT).fill(-1);
  for (let b = 0, s = 0; b < BT; b++) {
    while (s < S - 1 && st[s + 1] <= b) s++;
    const r = b - st[s];
    if (b < BH) RS[b] = s;
    for (let c = 0; c < TW; c++) {
      const j = b * TW + c, q = (c - 1) & 3, bay = (c - 1) >> 2;
      let k = 0, a = 0.92 + 0.14 * hash(s * 7 + bay, 11);
      if (b < BH) {
        if (c < 22) {
          k = r === 0 ? 3 : c > 0 && c < 21 && q < 3 && (r === 1 || r === 2 || (s === 0 && r === 3)) ? 2 : 1;
          if (k === 1 && r === 3 && hash(c, 5) < 0.4) a *= 0.86;
          U[j] = s === 0 ? (bay === 2 ? 0 : 0.95) : hash(s * 13 + bay, 3);
        } else (k = c === 22 ? 4 : (c === 24 || c === 25) && (r === 1 || r === 2) ? 5 : 4), (a = c === 22 ? 1.15 : a), (U[j] = hash(s * 17 + c, 9));
        if (r === 0) a *= 0.8;
      } else if (b === BH) k = c < 22 ? 6 : 0;
      else if (b <= BH + 4 && ((c >= 5 && c <= 14) || (c >= 16 && c <= 19 && b <= BH + 3))) (k = 6), (a = 0.82);
      else if ((c === 10 && b < BT - 1) || (b === BH + 9 && c >= 8 && c <= 12) || (b === BH + 7 && c === 11)) k = 7;
      else if (c === 10 && b === BT - 1) k = 8;
      K[j] = k;
      A[j] = a;
      C[j] = abs(vn(c * 0.3 + 5, b * 0.12) - 0.5) * 2 + 0.6 * abs(vn(c * 0.9, b * 0.7) - 0.5);
    }
  }
  const chg = [];
  for (let s = round(S * 0.78); s >= 2; s -= 3) chg.push(s);
  Object.assign(P, { S, BH, BT, st, fa: A, fk: K, fu: U, fc: C, rs: RS, chg: chg.concat([1, 0]), fold: st[round(S * 0.42)], fls: new Float32Array(S), bl: new Uint8Array(S) });
}

function newRound(P) {
  Object.assign(P, { cyc: P.cyc + 1, dir: rnd() < 0.5 ? -1 : 1, fi: 0, b0: 0, b1: 0, pd1: 0, pc2: 0, a1: 0, a2: 0, ad: 0, bd: [] });
  if (P.bl) P.bl.fill(0);
  for (let j = 0; j < 8; j++) P.bd.push([0, 0, 0, 0, rnd() * 6.28, 7 + rnd() * 10, 0, rnd() * 6]);
  P.frag = [[-9 + rnd() * 3, 9, 0.6, -0.3], [3 + rnd() * 3, 8, -0.7, 0.25]];
}

// The lower floors give first; the upper block then folds into them.
const fall = (tc) => (tc <= 0 ? [0, 0] : [11 * tc * tc, tc > 0.5 ? 6 * (tc - 0.5) ** 2 : 0]);

function addPuff(P, x, y, vx, vy, r, g, a, life, rise, tint) {
  if (P.np < MP) P.pf.set([x, y, vx, vy, r, r, g, a, 0, life, rise, tint], P.np++ * PF);
}
function basePuff(P, kind) {
  const x = X0 + rnd() * TW, out = x - CX, roll = kind < 2 && rnd() < 0.4;
  addPuff(P, x, G - 1 - rnd() * 4, out * 0.8 + (rnd() - 0.5) * 12 + (roll ? Math.sign(out || 1) * (10 + rnd() * 10) : 0), roll ? -1 - rnd() * 3 : -(5 + rnd() * 12) - (kind === 2 ? 14 : 0), 3 + rnd() * 3, 2 + rnd() * 2.5, 1 + rnd() * 0.5, roll ? 12 + rnd() * 5 : 8.5 + rnd() * 5, roll ? 1 + rnd() * 3 : 8 + rnd() * (kind === 2 ? 30 : 24), rnd());
}
function debris(P, x, y, s) {
  P.db.push([x, y, s * (4 + rnd() * 14), -4 - rnd() * 14, 1.5]);
}

// A charge goes off on storey s: its windows blow out and spit dust both ways.
function fire(P, s) {
  const y = G - 1 - (P.st[s] + P.st[s + 1]) / 2;
  P.bl[s] = 1;
  for (let n = 0; n < 10; n++) {
    const sd = n & 1 ? 1 : -1, edge = n < 4;
    addPuff(P, edge ? (sd < 0 ? X0 - 1 : X0 + TW) : X0 + 2 + rnd() * (TW - 4), y + (rnd() - 0.5) * 2, edge ? sd * (10 + rnd() * 12) : sd * rnd() * 3, -rnd(), 1 + rnd() * 0.8, 1.2 + rnd(), 0.7, 1.6 + rnd(), 0.5, rnd() * 0.5);
    if (edge) debris(P, sd < 0 ? X0 - 1 : X0 + TW, y, sd);
  }
  if (P.fi === 1) for (const b of P.bd) (b[6] = 1), (b[2] = (b[0] - CX) * 2 + (rnd() - 0.5) * 14 + P.w * 14), (b[3] = -8 - rnd() * 14);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 20, 0.06];
  const rd = cl(dt || 0, 0, 0.1), d = rd * (cl(k[1], 0.2, 3) / 2), S = round(cl(k[2], 20, 30)), w = (P.w = cl(k[3], -1, 1));
  if (S !== P.S) facade(P, S);
  (P.rt += rd), P.fr++;
  if (input.btnPressed && input.btnPressed[0]) {
    if (P.T < T_CH - 0.7) P.T = T_CH - 0.7;
    else if (P.T >= T_TL) newRound(P), (P.T = T_CH - 0.7);
  }
  if ((P.T += d) >= CYC) newRound(P), (P.T -= CYC);
  const T = P.T, tl = 0.85 * sm(T_TL, T_TL + 1.2, T) * (1 - sm(CYC - 2.5, CYC - 0.4, T));
  // Time-lapse: days go by, dawn to night and back every 2 s.
  P.he = mix(cl(k[0], 0, 1), 0.5 - 0.5 * cos((2 * PI * (T - T_TL)) / 2), tl);
  P.L = light(P.he);
  P.co += (w * 2 + tl * (w < 0 ? -24 : 24)) * d;

  // Charges, top to bottom, then the shudder.
  while (P.fi < P.chg.length && T >= T_CH + P.fi * 0.09 && T < T_TL) fire(P, P.chg[P.fi++]);
  P.gfl = 0;
  P.chg.forEach((s, n) => {
    const t0 = T_CH + n * 0.09;
    P.gfl = max(P.gfl, (P.fls[s] = T >= t0 ? exp(-(T - t0) * 9) : 0));
  });
  P.shk = T > T_CH && T < T_FALL + 0.6 ? round((rnd() - 0.5) * 2.6 * (1 - sm(T_FALL, T_FALL + 0.6, T))) : 0;

  // The fall: dust where floors are crushed, at the foot and at the fold.
  const tc = T - T_FALL, [d1, c2] = T < T_TL ? fall(tc) : [0, 0], cons = min(P.BT, d1 + c2), phM = 22 + (P.S - 20) * 0.6;
  if (tc > 0 && T < T_TL) {
    if (!P.b0) for (let n = (P.b0 = 1) && 24; n--; ) basePuff(P, 1);
    const e1 = max(0, d1 - P.pd1), e2 = max(0, c2 - P.pc2);
    if (d1 + c2 < P.BT) (P.a1 += e1 * 1.1), (P.a2 += e2 * 0.35), (P.ad += e1 * 0.5);
    for (; P.a1 >= 1; P.a1--) basePuff(P, 0);
    for (const yf = G - 1 - P.fold + d1; P.a2 >= 1; P.a2--) {
      const sd = rnd() < 0.5 ? -1 : 1;
      addPuff(P, CX + sd * (8 + rnd() * 8), min(G - 2, yf), sd * (8 + rnd() * 14), -2 - rnd() * 6, 2 + rnd() * 1.5, 3 + rnd() * 3, 0.7, 8 + rnd() * 4, 4 + rnd() * 6, rnd());
    }
    for (; P.ad >= 1; P.ad--) debris(P, rnd() < 0.5 ? X0 - 1 : X0 + TW, G - 2 - rnd() * 4, rnd() < 0.5 ? -1 : 1);
    if (!P.b1 && cons >= P.BT) for (let n = (P.b1 = 1) && 20; n--; ) basePuff(P, 2);
    (P.pd1 = d1), (P.pc2 = c2);
  }
  P.ph = T < T_FALL ? 0 : T < T_TL ? phM * sm(0, 1, cons / P.BT) : phM * (1 - sm(T_TL + 0.5, T_CLR - 0.5, T));

  // Dust puffs rise, slow, swell and drift with the wind, stronger aloft.
  const pf = P.pf, e1 = 1 - exp(-0.7 * d), e2 = 1 - exp(-0.9 * d);
  for (let p = 0; p < P.np; p++) {
    const q = p * PF, age = (pf[q + 8] += d);
    if (age > pf[q + 9]) {
      if (p < --P.np) pf.copyWithin(q, P.np * PF, P.np * PF + PF);
      p--;
      continue;
    }
    pf[q + 2] += (w * (3 + 9 * (1 - pf[q + 1] / H)) - pf[q + 2]) * e1;
    pf[q + 3] += (-pf[q + 10] * exp(-age / 4) - pf[q + 3]) * e2;
    (pf[q] += pf[q + 2] * d), (pf[q + 1] += pf[q + 3] * d), (pf[q + 4] += (pf[q + 6] * d) / (1 + 0.4 * age));
    const fl = G - 0.35 * pf[q + 4];
    if (pf[q + 1] > fl) (pf[q + 1] = fl), (pf[q + 3] = min(0, pf[q + 3]));
  }
  P.db = P.db.filter((b) => ((b[3] += 70 * d), (b[0] += b[2] * d), (b[1] += b[3] * d), (b[4] -= d) > 0 && b[1] < G + 1));
  // The water cannon on the right-hand roof wets the site until the time-lapse.
  if (T > 1 && T < T_TL) for (let n = 0; n < 3 && rnd() < 45 * d; n++) P.sp.push([52, 86, -15 - rnd() * 6 + w * 6, -10 - rnd() * 5, 0]);
  P.sp = P.sp.filter((s) => ((s[3] += 26 * d), (s[0] += s[2] * d), (s[1] += s[3] * d), (s[4] += d) < 2 && s[1] < 104));
  // Pigeons circle the roof until the first charge, then scatter.
  for (const b of P.bd)
    if (b[6]) (b[0] += b[2] * d), (b[1] += b[3] * d), (b[3] -= 4 * d), (b[7] += 14 * d);
    else (b[4] += 0.9 * d), (b[0] = CX + cos(b[4]) * b[5] * 1.3), (b[1] = G - P.BH - 10 + sin(b[4]) * b[5] * 0.35), (b[7] += 9 * d);
}

let F, L, P;
const idx = (x, y) => ((x = round(x)), (y = round(y)), x < 0 || x >= W || y < 0 || y >= H ? -1 : (y * W + x) * 3);
function put(x, y, c, a = 1, o = idx(x, y)) {
  if (o >= 0) for (let j = 0; j < 3; j++) F[o + j] += (c[j] - F[o + j]) * a;
}
function add(x, y, c, k, o = idx(x, y)) {
  if (o >= 0) for (let j = 0; j < 3; j++) F[o + j] += c[j] * k;
}
function glow(x, y, c, k, r) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) add(x + i, y + j, c, k * exp(-(i * i + j * j) / (0.3 * r * r)));
}
const lit = (c, m = 1, s = 0.5, fq = 0) => [0, 1, 2].map((j) => c[j] * (L[9 + j] * m + L[12 + j] * s + fq));
function line(x0, y0, x1, y1, c) {
  for (let i = 0, n = max(abs(x1 - x0), abs(y1 - y0)) * 1.4 + 1; i <= n; i++) put(mix(x0, x1, i / n), mix(y0, y1, i / n), c);
}
const fq = (x, y) => (P.FL[cl(round(y), 0, H - 1) * W + cl(round(x), 0, W - 1)] || 0) * L[16];

function back() {
  const { BA, BU, BK, FL, NT, SKY } = P, aw = abs(P.w), sx = 0.6 - 0.3 * aw, sh = 0.85 * P.w, sy = 1 + 0.8 * aw, th = 0.5 + (0.5 - L[23] - 0.15 * aw) * 0.32, co = P.co;
  for (let y = 0; y < H; y++) {
    const t = min(1, y / 96), s1 = sm(0, 0.6, t), s2 = sm(0.4, 1, t) ** 2;
    for (let c = 0; c < 3; c++) SKY[y * 3 + c] = mix(mix(L[c], L[3 + c], s1), L[6 + c], s2);
  }
  const sunV = sm(0.12, 0.3, P.he) * (1 - sm(0.42, 0.58, P.he)), night = sm(0.78, 1, P.he), fld = L[16], lw = L[15];
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, k = BK[i], fb = fld * FL[i];
    let r, g, b;
    if (k === 0) {
      (r = SKY[y * 3]), (g = SKY[y * 3 + 1]), (b = SKY[y * 3 + 2]);
      // Round clouds when calm, slanting streaks in wind.
      if (y < 96) {
        const n = NT[((floor(y * sy + 40) & 127) << 6) | (floor(x * sx + y * sh + co) & 63)], cd = sm(th - 0.06, th + 0.08, n) * (1 - sm(66, 96, y)) * 0.9;
        if (cd > 0) {
          const lb = cl(0.15 + y / 110 + (n - th) * 2, 0, 1);
          (r = mix(r, mix(L[20], L[17], lb), cd)), (g = mix(g, mix(L[21], L[18], lb), cd)), (b = mix(b, mix(L[22], L[19], lb), cd));
        }
      }
      let sg = 0;
      if (sunV > 0) {
        const ds = (x - 9) ** 2 + (y - 60) ** 2;
        sg = sunV * (255 * exp(-ds / 7) + 70 * exp(-sqrt(ds) / 9));
      }
      if (night > 0) sg += night * (((x - 52) ** 2 + (y - 20) ** 2 < 6) * 220 + (y < 70 && hash(x, y) > 0.985 ? 90 + 60 * sin(P.rt * 3 + x) : 0));
      (r += sg + 56 * fb), (g += sg * 0.9 + 60 * fb), (b += sg * 0.7 + 66 * fb);
    } else if (k === 1 || k === 4) {
      const hz = 0.55 - y / 400;
      (r = mix(BA[o] * L[9], SKY[y * 3], hz)), (g = mix(BA[o + 1] * L[10], SKY[y * 3 + 1], hz)), (b = mix(BA[o + 2] * L[11], SKY[y * 3 + 2], hz));
      if (k === 4 && hash(x, 77) < lw * 1.4) (r += 120), (g += 86), (b += 40);
    } else if (k === 3 && BU[i] < lw * 1.1) (r = WARM[0] * 0.8), (g = WARM[1] * 0.8), (b = WARM[2] * 0.8);
    else {
      const m = k === 3 ? 0.25 : 1, f = (y < 84 ? 0.35 : 0.5) * (x < 15 || x > 55 ? 1 : 0.6);
      (r = BA[o] * m * (L[9] + L[12] * f + fb * 0.6)), (g = BA[o + 1] * m * (L[10] + L[13] * f + fb * 0.6)), (b = BA[o + 2] * m * (L[11] + L[14] * f + fb * 0.6));
      if (k === 3) (r += SKY[y * 3] * 0.2), (g += SKY[y * 3 + 1] * 0.2), (b += SKY[y * 3 + 2] * 0.25);
    }
    (F[o] = r), (F[o + 1] = g), (F[o + 2] = b);
  }
  // Light masts at night, and the chimney's smoke bending with the wind.
  for (const lx of [2, 61]) for (let y = 82; y < G; y++) put(lx, y, [30, 30, 34]);
  if (fld > 0.05) for (const lx of [2, 61]) put(lx, 82, [255, 250, 230], min(1, fld * 1.5));
  const sc = lit([176, 172, 168], 1, 0.6), ph = (P.rt * 0.5) % 1;
  for (let j = 0; j < 12; j++) {
    const s = j + ph, x = 57.5 + P.w * (s * 2.2 + s * s * 0.14) + sin(P.rt * 0.7 + j) * 0.6, y = 42 - s * 2.4 * (1 - 0.55 * aw), r = 1.4 + s * 0.42, a = 0.45 * (1 - s / 12.5) * min(1, s);
    for (let v = -ceil(r); v <= r; v++) for (let u = -ceil(r); u <= r; u++) { const q = 1 - (u * u + v * v) / (r * r); if (q > 0) put(x + u, y + v, sc, a * q); }
  }
}

// The tower, standing, falling or rising again in scaffolding.
function tower() {
  const { fa: A, fk: K, fu: U, fc: C, rs: RS, FL, SKY, T, BT, BH, fold: F0 } = P, tc = T - T_FALL;
  if (T >= T_TL && T < T_RISE) return;
  const reb = T >= T_RISE, built = reb ? BH * sm(T_RISE, T_UP, T) : BT, strip = reb ? BT * (1 - sm(T_UP, CYC - 0.6, T)) : 0;
  const [d1, c2] = reb ? [0, 0] : fall(tc), l1 = reb ? 0 : P.dir * 3 * sm(0.1, 1.2, tc), l2 = reb ? 0 : -P.dir * 10 * sm(0.3, 1.6, tc), ck = reb ? 0 : 0.09 * sm(0, 1.2, tc), lw = L[15], fld = L[16], tick = floor(T * 20);
  const scaf = lit([184, 186, 178], 1, 0.6), net = lit([64, 124, 104], 1, 0.4), slab = lit([130, 126, 118]), mast = lit([120, 124, 132], 1, 0.6);
  for (let y = max(0, G - BT - 1); y < G; y++) {
    let b = G - 1 + d1 + c2 - y, xo, up = 1;
    if (b >= F0 + c2 && b < BT) xo = l1 + (l2 * (b - F0 - c2)) / (BT - F0);
    else if ((b = G - 1 + d1 - y) >= 0 && b < F0) (xo = (l1 * b) / F0), (up = 0);
    else continue;
    const bi = floor(b), xs = round(xo + P.shk), s = RS[bi], fl = s >= 0 ? P.fls[s] : 0, rag = tc > 0 && !reb && (G - y < 3 || (up && c2 > 0 && b - F0 - c2 < 2));
    const top = sm(70, 25, y), hy = (y >> 1) * 3;
    for (let c = 0; c < TW; c++) {
      const j = bi * TW + c, k = K[j], x = X0 + c + xs;
      if (!k || x < 0 || x >= W || (rag && hash(x * 13 + y, tick) < 0.4)) continue;
      const i = y * W + x, o = i * 3, side = k === 4 || k === 5, fq = FL[i] * fld;
      let col = MID;
      if (reb && (bi < strip || (k > 5 && strip > BH))) {
        if (bi >= built || k > 5) continue;
        col = c % 3 === 0 || bi % 3 === 0 ? scaf : hash(c >> 2, bi >> 3) < 0.4 ? net : k === 3 ? slab : hash(c >> 1, s) < 0.12 ? LAMP : DARK;
      } else if (k === 2 || k === 5) {
        const v = side ? 0.65 : 1;
        if (s >= 0 && P.bl[s]) col = HOLE;
        else if (U[j] < lw) for (let q = 0, u = (0.7 + 0.3 * sin(U[j] * 60)) * v; q < 3; q++) MID[q] = WARM[q] * u;
        else for (let q = 0; q < 3; q++) MID[q] = (SKY[hy + q] * 0.45 + L[6 + q] * 0.12 + 76 * fq) * v;
      } else if (k === 7) col = mast;
      else if (k === 8) col = (P.rt * 1.5) % 1 < 0.5 ? RED : HOLE;
      else for (let q = 0, a = A[j] * (C[j] < ck ? 0.3 : 1), m = side ? 0.6 : 1, sn = (side ? 0.06 : 0.55) + top * 0.4; q < 3; q++) MID[q] = CON[q] * a * (L[9 + q] * m + L[12 + q] * sn + fq * 1.6);
      const f2 = rag ? 0.55 : 1;
      (F[o] = col[0] * f2 + fl * 300), (F[o + 1] = col[1] * f2 + fl * 250), (F[o + 2] = col[2] * f2 + fl * 170);
    }
    if (reb && bi < min(built, strip)) for (const x of [X0 - 1 + xs, X0 + TW + xs]) put(x, y, scaf);
  }
  // Each charge lights the air round its floor.
  P.chg.forEach((s) => {
    const fl = P.fls[s];
    if (fl > 0.02) for (let y = -6, yc = G - 1 - (P.st[s] + P.st[s + 1]) / 2; y <= 6; y++) for (let x = X0 - 9; x < X0 + TW + 9; x++) {
      const dx = x < X0 ? X0 - x : x >= X0 + TW ? x - X0 - TW + 1 : 0;
      if (dx) add(x, yc + y, [255, 196, 120], fl * exp(-(dx * dx) / 12 - (y * y) / 8));
    }
  });
}

function pileH(x) {
  const u = (x - CX) / 22;
  return abs(u) >= 1 || P.ph < 0.3 ? 0 : P.ph * (1 - u * u) ** 0.8 * (0.8 + 0.4 * vn(x * 0.25, P.cyc * 7)) + (hash(x, P.cyc) - 0.5) * 1.6 * min(1, P.ph / 4);
}
// Rubble: broken slabs, rebar and bits of painted rooms; two pieces of facade still with their windows.
function pile() {
  if (P.ph < 0.3) return;
  for (let x = CX - 22; x <= CX + 22; x++) {
    const hp = pileH(x), sl = pileH(x + 1) - pileH(x - 1), sn = cl(0.45 - 0.3 * sl, 0, 1);
    for (let y = round(G - hp), y0 = y; y < G + 3; y++) {
      const cx = floor((x + (y >> 1) * 1.7) / 3), cy = y >> 1, v = hash(cx, cy + P.cyc * 97), e = (y & 1) === 0 ? 1.18 : 0.86, dp = 1 - 0.35 * sm(0, 12, y - y0);
      const c = v > 0.96 ? TILE : v < 0.05 ? BRICK : v > 0.9 ? PALE : CON, o = (y * W + x) * 3, f = fq(x, y);
      let m = dp * (c === CON ? (0.65 + 0.45 * v) * e : 1);
      if (y === y0 && hash(x, 9) < 0.3) m = -1;
      else if (hash(cx * 7 + x, y * 3 + P.cyc) < 0.1) m *= 0.22;
      if (y < H) for (let j = 0; j < 3; j++) F[o + j] = m < 0 ? RUST[j] * (L[9 + j] + 0.3) : c[j] * m * (L[9 + j] + L[12 + j] * sn + f);
    }
  }
  if (P.ph > 6)
    for (const [dx, w, sk, tl] of P.frag) {
      const fx = CX + dx, fy = G - pileH(fx + w / 2) + 3;
      for (let u = 0; u < w; u++) for (let v = 0; v < 7; v++) {
        const hole = (v === 1 || v === 2 || v === 5) && u % 3 > 0;
        put(fx + u + v * sk, fy - v + u * tl, hole ? [16, 14, 14] : lit(CON.map((q) => q * (v === 0 ? 0.7 : 0.95)), 1, 0.6, fq(fx, fy)));
      }
    }
}

// Two long-reach diggers climb onto the heap and pick it apart, faster in the time-lapse.
function digger(x, f, ph) {
  const g = round(G - max(0, pileH(x) - 1)), q = fq(x, g) + 0.32, Y = lit(YEL, 1, 0.6, q), Yd = Y.map((v) => v * 0.7), D = lit([70, 68, 66], 1, 0.4, q);
  for (let i = -4; i <= 4; i++) put(x + i, g - 1, i & 1 ? D : D.map((v) => v * 1.8)), put(x + i, g - 2, D);
  for (let i = -5; i <= 2; i++) for (let j = 3; j <= 5; j++) put(x + i * f, g - j, i < -3 ? Yd : Y);
  for (let j = 6; j <= 9; j++) for (let i = 1; i <= 3; i++) put(x + i * f, g - j, i === 2 && j > 6 && j < 9 ? lit([90, 130, 170], 1, 0.8, q) : Y);
  const a1 = 1 + 0.3 * sin(ph), bx = x + 2 * f, by = g - 5, ex = bx + f * cos(a1) * 11, ey = by - sin(a1) * 11, a2 = -1.2 + 0.5 * sin(ph + 1.3), kx = ex + f * cos(a2) * 8, ky = ey - sin(a2) * 8;
  line(bx, by, ex, ey, Y), line(bx - f, by, ex - f, ey, Yd), line(ex, ey, kx, ky, Y);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) put(kx + i * f, ky + j, D);
  if ((P.rt * 1.6 + f * 0.25) % 1 < 0.5) glow(x + 2 * f, g - 10, AMBER, 0.45, 2);
}
function machines() {
  const T = P.T;
  if (T < T_EX || T > T_CLR + 1) return;
  const tl = T > T_TL ? 1 : 0, out = sm(T_CLR - 1, T_CLR + 0.5, T);
  for (const [x0, xa, f, j] of [[-10, CX - 13, 1, 0], [76, CX + 13, -1, 1]]) {
    const x = mix(mix(x0, xa, sm(T_EX + j, T_EX + 2.5 + j, T)), x0, out) + tl * round((hash(floor(T * 4), j) - 0.5) * 6);
    digger(round(x), f, T * (tl ? 9 : 2.2) + j * 2);
  }
}

// Fence with mesh, posts and barrier tape; the siren lights on two posts.
function fence() {
  const mc = lit([150, 152, 158], 1, 0.4), pc = lit([96, 98, 104], 1, 0.5);
  for (let y = 102; y < 118; y++) for (let x = 0; x < W; x++) {
    if (x % 12 === 5 || y === 102) put(x, y, pc);
    else if ((x + y) % 3 === 0 || (x - y + 300) % 3 === 0) put(x, y, mc, 0.28);
  }
  for (let x = 0; x < W; x++) put(x, 107 + round(sin(x * 0.6 + P.rt * 5) * (0.3 + abs(P.w))), (x + 40) % 4 < 2 ? lit([250, 210, 40], 1, 0.5, 0.15) : [20, 20, 20]);
  const T = P.T;
  for (const [x, s] of [[5, 0], [53, 0.5]]) {
    const on = T < T_FALL + 0.8 && (P.rt * 2.5 + s) % 1 < 0.45;
    put(x, 100, on ? [255, 190, 80] : [90, 50, 20]), put(x, 101, [60, 60, 60]);
    if (on) glow(x, 100, AMBER, 0.6, 5);
  }
}

// Dust: each puff is a ball lit from the sun's side and from the sky above, laid over the ones before it, so the billows keep their edges.
function dust() {
  const { NT, pf, FL } = P, fld = L[16] * 1.8, gf = P.gfl * 0.6, [L9, L10, L11, L12, L13, L14] = L.slice(9, 15);
  for (let p = 0; p < P.np; p++) {
    const q = p * PF, px = pf[q], py = pf[q + 1], r = pf[q + 4], age = pf[q + 8], life = pf[q + 9];
    const a = pf[q + 7] * sm(0, 0.25, age) * (1 - sm(0.4 * life, life, age)) * (pf[q + 5] / r) ** 0.35;
    if (a < 0.01) continue;
    const t = pf[q + 11], ox = (p * 23) & 63, oy = p * 41 + floor(age * 3), ir = 1 / r, pb = 0.85 + 0.3 * hash(p, P.cyc);
    const a0 = mix(DUST0[0], DUST1[0], t) * pb, a1 = mix(DUST0[1], DUST1[1], t) * pb, a2 = mix(DUST0[2], DUST1[2], t) * pb;
    for (let y = max(0, ceil(py - r)), y1 = min(H - 1, floor(py + r)); y <= y1; y++) {
      const dy = (y - py) * ir, dy2 = dy * dy, row = y * W, nr = ((y + oy) & 127) << 6, n2 = ((y + oy + 64) & 127) << 6, sh = 0.45 + 0.55 * sm(G, 40, y), sk = 0.8 - 0.25 * dy;
      for (let x = max(0, ceil(px - r)), x1 = min(W - 1, floor(px + r)); x <= x1; x++) {
        const dx = (x - px) * ir, d2 = dx * dx + dy2;
        if (d2 >= 1) continue;
        let e = 2 - d2 * (0.7 + 2.4 * NT[nr | ((x + ox) & 63)]);
        if (e <= 0.02) continue;
        if (e > 1) e = 1;
        const k = min(0.95, a * e * e * (3 - 2 * e)), i = row + x, o = i * 3, l = -0.6 * dx - 0.5 * dy + 0.62 * sqrt(1 - d2);
        const gr = 0.6 + 0.8 * NT[n2 | ((x * 2 + ox) & 63)], sun = (0.25 + 0.8 * (l > 0 ? l : 0)) * sh * gr, sky = sk * (0.55 + 0.45 * gr), fl = FL[i] * fld + gf;
        F[o] += (a0 * (L9 * sky + L12 * sun + fl) - F[o]) * k;
        F[o + 1] += (a1 * (L10 * sky + L13 * sun + fl) - F[o + 1]) * k;
        F[o + 2] += (a2 * (L11 * sky + L14 * sun + fl) - F[o + 2]) * k;
      }
    }
  }
}

function people() {
  const T = P.T, ph = T > T_CH - 1.5 && T < T_TL ? 0.6 : 0.12, rim = lit([70, 70, 80], 1, 0.5, 0).map((v) => v + P.gfl * 120);
  for (const [x, hy0, w, r1, r2, cc] of P.cr) {
    const hy = hy0 - (T > T_FALL && T < T_TL && r2 < 0.35 && sin(P.rt * 9 + r2 * 40) > 0.6 ? 1 : 0), hw = w >> 1, coat = lit(COATS[cc & 3], 0.5, 0.25, 0.1), vest = cc === 4;
    for (let y = hy + 3; y < H; y++) for (let i = -hw + (y === hy + 3); i <= hw - (w & 1 ? 0 : 1) - (y === hy + 3); i++) put(x + i, y, vest && y > hy + 3 && y < hy + 9 ? (y === hy + 6 ? lit([220, 220, 210], 1, 0.5, 0.3) : lit(COATS[4], 1, 0.5, 0.2)) : coat);
    for (let j = 0; j < 3; j++) for (let i = -1; i <= 1; i++) if (j || !i) put(x + i, hy + j, SIL);
    add(x, hy, rim, 0.5), add(x - hw + 1, hy + 3, rim, 0.35);
    if (r1 < ph) {
      put(x + 2, hy + 2, SIL), put(x + 2, hy + 1, SIL), put(x + 2, hy, SIL);
      const fl = T > T_CH && T < T_TL - 8 && hash(P.fr, x) < 0.015;
      put(x + 2, hy - 1, fl ? [255, 255, 255] : [150, 180, 240]), put(x + 2, hy - 2, fl ? [255, 255, 255] : [150, 180, 240]);
    }
  }
}

export function draw(display, params) {
  P = params.s;
  if (!P || !P.L || !P.fk) return;
  (F = P.F), (L = P.L);
  back();
  tower();
  pile();
  machines();
  fence();
  for (const [x, y] of P.db) put(x, y, lit([150, 144, 136], 1, 0.6, fq(x, y)));
  const wl = lit([170, 190, 210], 1, 0.5, 0.2);
  for (const [x, y] of P.sp) add(x, y, wl, 0.16), add(x + 1, y, wl, 0.08), add(x, y + 1, wl, 0.08);
  dust();
  for (const b of P.bd) {
    const up = sin(b[7]) > 0 ? -1 : 0, c = L[16] > 0.7 ? [140, 140, 150] : [24, 24, 30];
    put(b[0], b[1], c), put(b[0] - 1, b[1] + up, c), put(b[0] + 1, b[1] + up, c);
  }
  people();
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, cl(F[o], 0, 255) | 0, cl(F[o + 1], 0, 255) | 0, cl(F[o + 2], 0, 255) | 0);
}
