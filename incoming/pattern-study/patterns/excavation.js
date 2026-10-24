// ===== Patternflow pattern =====
// Title:   Excavation
// Family:  construction
// Idea:    A city excavation cut open in section: an excavator on the floor of a strutted pit heaps up spoil, a clamshell grab on a gantry hauls it a hundred rows up to dump trucks on the street, and each stage deeper a new tier of steel struts is welded in.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after the strutted basement excavations dug between city buildings
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Hour=0..1, Speed=0.2..3, Depth=8..10, Water=0..1
//
// Knob 1: Hour. Midday at 0, a shaft of sun falling through the deck opening past the tiers of struts; afternoon slants it onto the far wall, and at 1 it is night and sodium lamps on the struts and a floodlight on the trolley light the pit.
// Knob 2: Speed. At 2 a grab takes about nine seconds from the heap to the truck and a stage of nine rows about a minute; at 0.2 it all runs ten times slower, clouds and their shadows too.
// Knob 3: Depth. How many of the eleven stages are dug when it starts, eight to ten, each with its strut. After the eleventh the floor gets its concrete and the view moves on to the next lot.
// Knob 4: Water. Groundwater seeping through the lagging, the pool round the pump and the hose's flow; past halfway it rains and the shaft of sun fades.
// Buttons: K1 tap sounds the warning and fires a small blast at the face; dust fills the bottom of the pit and the floor drops.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sin, cos, abs, exp, sqrt, atan2, acos, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
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

// Street, the pit's inside, the opening's edge, the heap, the truck bed, the last stage.
const [GL, PL, PR, OR, HX, TT, FIN] = [20, 10, 53, 33, 21, 43, 11];
const strutY = (k) => 18 + 9 * k, floorY = (k) => 23 + 9 * k;
const KP = [29, 41], EXP = [37, 41, 44, 41];
// Fill, clay, sand and gravel, weathered rock, rock, and the rows they end at.
const STRATA = [[96, 84, 78], [186, 106, 58], [206, 186, 142], [154, 138, 94], [118, 126, 146]];
const BOT = [27, 45, 64, 101, 999];
const layer = (x, y) => {
  let i = 0;
  while (i < 4 && y >= BOT[i] + 5 * (vn(x * 0.09, i * 5.3) - 0.5)) i++;
  return i;
};
// Noon, afternoon, dusk, night: sky top, horizon, sun, ambient, buildings.
const KEYS = [
  [50, 116, 222, 168, 206, 240, 1, 0.95, 0.84, 0.92, 0.95, 1, 150, 158, 176],
  [56, 100, 196, 232, 200, 160, 1, 0.82, 0.56, 0.8, 0.75, 0.72, 140, 128, 132],
  [34, 32, 90, 236, 110, 70, 0.9, 0.5, 0.26, 0.5, 0.42, 0.5, 80, 66, 90],
  [5, 7, 26, 22, 26, 60, 0, 0, 0, 0.13, 0.14, 0.22, 30, 32, 48],
];
const WIN = [255, 196, 120], CAP = [176, 172, 166], DECK = [124, 118, 110], ROAD = [74, 74, 80], RAIN = [190, 210, 240], FLOOD = [1, 0.97, 0.9];
const WALLS = [[8, [120, 86, 54]], [9, [96, 104, 118]], [54, [96, 104, 118]], [55, [120, 86, 54]]];
const YEL = [250, 178, 26], GAN = [244, 204, 50], GRAB = [246, 142, 30], STEEL = [150, 160, 178], HOSE = [50, 80, 170];

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const P = (params.s = {
    f: F32(N * 3), lm: F32(N * 3), so: F32(N * 3), bw: F32(N * 3), sn: F32(N * 3), st: F32(N), shf: F32(N), sh: F32(200), rs: F32(H), srf: F32(W), dig: F32(W),
    t: 0, rt: 0, nk: -1, cx: 42, du: [], pa: [], sl: -1, bl: -1, dust: 0.3, arc: 0, tx: 0, tv: 0, tph: 0, load: 2, tgo: 0,
  });
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, L = layer(x, y), hh = hash(x, y), pd = hypot(x - 3, y - 24.5), px = (x - PL) % 7;
    // The ground in section, each layer with its grain; a water main and ducts.
    let k = 0.86 + 0.22 * hh, c = STRATA[L];
    if (L === 0 && hh > 0.88) c = [150, 146, 140];
    else if (L === 1) k = 0.9 + 0.14 * vn(x * 0.4, y * 0.7);
    else if (L === 2 && hash(x >> 1, y >> 1) < 0.2) c = [136, 132, 128];
    else if (L === 3 && abs(vn(x * 0.3, y * 0.3) - 0.5) < 0.04) k = 0.55;
    else if (L === 4 && (x + y * 0.7 + 5 * vn(x * 0.2, y * 0.1)) % 13 < 0.9) k = 0.6;
    if (pd < 2.2) (c = pd > 1.2 ? [96, 120, 150] : [26, 30, 36]), (k = 1);
    if (x > 57 && x < 63 && (y === 23 || y === 24) && x & 1) (c = [230, 120, 40]), (k = 1);
    // The far wall: H-piles and lagging, shotcrete and rock bolts lower down.
    const q = 0.8 + 0.35 * hash(floor((y - GL) / 3), floor((x - PL) / 7)), r = 0.84 + 0.22 * vn(x * 0.3, y * 0.3);
    const b = y < GL + 2 ? CAP : !px ? [86, 92, 104] : y > 65 ? (px === 3 && y % 8 === 4 ? [60, 60, 66] : [136 * r, 132 * r, 126 * r]) : (y - GL) % 3 > 1 ? [44, 34, 28] : [132 * q, 94 * q, 60 * q];
    for (let j = 0; j < 3; j++) (P.so[o + j] = c[j] * k), (P.bw[o + j] = b[j]);
    P.st[i] = sm(0.42, 0.72, vn(x * 0.8, y * 0.06));
  }
  skyline(P);
}

function skyline(P) {
  P.bd = [];
  for (let x = 0, w, s; x < W; x += w) (s = !x || x > 50), (w = !x ? 8 : s ? W - x : min(4 + floor(rnd() * 5), 56 - x)), P.bd.push([x, x + w - 1, s ? floor(rnd() * 3) : 6 + floor(rnd() * 8), rnd(), s]);
}

// A new lot, dug to stage k, with the grab already on its way down.
function lot(P, k) {
  Object.assign(P, { k, fy: floorY(k) + 2.5, hv: 64, wx: -1, mat: -1, ex: 41, ei: 1, sc: 1, ec: 0, full: 0, E: { p: [7, -9, 0] }, C: { p: [HX, 30, 1] } });
  P.dig.fill(0);
  go(P.E, 0, 0.7, [12, -3, 0]), go(P.C, 1, (P.fy - 43) / 46, [HX, P.fy - 13, 1]);
}
// A move eases a pose to b; the step functions chain moves.
const go = (m, ph, dur, b) => Object.assign(m, { ph, t: 0, dur: max(0.15, dur), a: m.p.slice(), b });
function tick(m, d) {
  const u = sm(0, 1, (m.t += d) / m.dur);
  for (let i = 0; i < 3; i++) m.p[i] = mix(m.a[i], m.b[i], u);
  return u;
}
const heapH = (P) => min(13, sqrt(1.1 * P.hv));
const heapTop = (P) => P.fy - heapH(P);
const matCol = (P) => STRATA[layer(30, P.fy + 2)];
function puff(P, x, y, n, a, s = 1) {
  for (let i = 0; i < n; i++) P.du.push([x + (rnd() - 0.5) * 6 * s, y - rnd() * 2 * s, (1.5 + rnd() * 2) * s, a, (rnd() - 0.5) * 3 * s, -(2 + rnd() * 3) * s]);
  P.dust = min(1, P.dust + 0.05 * n * a);
}

// Excavator: dig, lift, swing, drop it on the heap, swing back.
function eStep(P, E) {
  const ph = E.ph, up = [7, -9, 0];
  if (ph === 0) go(E, 1, 1, [8, 1.5, 0]);
  else if (ph === 1) {
    const bx = round(P.ex + 8);
    for (let i = -3; i <= 3; i++) if (bx + i <= PR) P.dig[bx + i] = max(P.dig[bx + i], 2.2 * cos(i * 0.39));
    (P.fy += 32 / 44), (P.ec = 1), puff(P, bx, P.fy, 1, 0.3);
    if (P.fy >= floorY(P.k + 1)) (P.fy = floorY(++P.k)), P.k < FIN ? (P.wx = PL) : (P.mat = 0);
    go(E, 2, 0.6, up);
  } else if (ph === 2) go(E, 3, 1, [7, -9, PI]);
  else if (ph === 3) go(E, 4, 0.6, [cl(P.ex - HX - 3, 6, 15), -heapH(P) * 0.7 - 3, PI]);
  else if (ph === 4) (P.hv += 32), (P.ec = 0), puff(P, P.ex - E.p[0], heapTop(P), 2, 0.3), go(E, 5, 1.1, up);
  else if (P.wx >= 0 || P.k >= FIN || P.hv > 150) go(E, 7, 0.5, up);
  else if (ph === 5 && ++P.sc % 3 === 0) (P.ex0 = P.ex), (P.exT = EXP[(P.ei = (P.ei + 1) % 4)]), go(E, 6, 1.4, up);
  else go(E, 0, 0.7, [12, -3, 0]);
}

// Grab: down open, close, haul up, over the truck, open.
function cStep(P, C) {
  const ph = C.ph, top = heapTop(P), up = [HX, 7, 0];
  if (ph === 0) P.hv > 14 ? go(C, 1, 0.3 + (top - 12 - C.p[1]) / 46, [HX, top - 5, 1]) : go(C, 0, 0.3, up);
  else if (ph === 1) go(C, 2, 0.7, [HX, top - 4, 0]);
  else if (ph === 2) {
    const g = min(P.hv, 60);
    (P.hv -= g), (P.full = g > 4), puff(P, HX, top, 2, 0.3), go(C, 3, 0.4 + (C.p[1] - 7) / 36, up);
  } else if (ph < 5) P.tph === 0 && P.load < 3 ? go(C, 5, 1.2, [TT, 7, 0]) : go(C, 4, 0.3, up);
  else if (ph === 5) {
    if (P.full) {
      (P.load++), (P.full = 0), puff(P, TT, 11, 3, 0.5), P.load > 2 && (P.tgo = 0.6);
      for (let i = 0; i < 10; i++) P.pa.push([TT + (rnd() - 0.5) * 6, 13, 0, 4, 0.3, 2]);
    }
    go(C, 6, 0.6, [TT, 7, 1]);
  } else go(C, ph === 6 ? 7 : 0, ph === 6 ? 1.1 : 0.2, up);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 8, 0.06];
  const rd = cl(dt || 0, 0, 0.1), d = rd * (cl(k[1], 0.2, 3) / 2), nk = round(cl(k[2], 8, 10)), h = (P.h = cl(k[0], 0, 1)), wt = (P.wt = cl(k[3], 0, 1));
  if (nk !== P.nk) lot(P, (P.nk = nk));
  (P.t += d), (P.rt += rd), (P.cx += 3.6 * d);
  Object.assign(P, { dayF: 1 - sm(0.55, 0.92, h), sunI: (1 - sm(0.6, 0.85, h)) * (1 - 0.9 * sm(0.3, 0.85, wt)), slope: 0.12 + 0.95 * sm(0, 0.8, h), lampK: sm(0.45, 0.8, h) });
  // K1 tap: the warning lamp, then the blast at the face.
  if (input.btnPressed && input.btnPressed[0] && P.bl < 0) P.bl = 0;
  if (P.bl >= 0 && (P.bl += rd) >= 0.8 && !P.fired) {
    P.fired = 1;
    for (let i = 0; i < 26; i++) P.pa.push([40 + (rnd() - 0.5) * 10, P.fy - 1, (rnd() - 0.5) * 30, -10 - rnd() * 22, 1.6, 2]);
    for (let i = PL; i <= PR; i++) P.dig[i] += 1.4 * exp(-(((i - 40) / 9) ** 2));
    puff(P, 40, P.fy, 9, 1.2, 2), (P.fy += 0.8), (P.hv += 30), (P.dust = 1);
  }
  if (P.bl > 1.5) (P.bl = -1), (P.fired = 0);
  const { E, C } = P, u = tick(E, d);
  if (E.ph === 6) {
    const nx = mix(P.ex0, P.exT, u);
    (P.trk += nx - P.ex), (P.ex = nx);
  }
  if (u >= 1) eStep(P, E);
  if (tick(C, d) >= 1) cStep(P, C);
  if (P.full && C.ph === 3 && rnd() < 4 * d) P.pa.push([C.p[0] + (rnd() - 0.5) * 5, C.p[1] + 7, 0, 2, 2, 2]);
  // A truck leaves with three grabs and an empty one backs in.
  if (P.tph === 0 && P.load > 2 && (P.tgo -= d) <= 0) (P.tph = 1), (P.tv = 0);
  if (P.tph === 1 && (P.tx += (P.tv = min(18, P.tv + 10 * d)) * d) > 30) (P.tph = 2), (P.load = 0);
  if (P.tph === 2 && (P.tx -= (1.5 + 0.8 * P.tx) * d) <= 0) (P.tx = 0), (P.tph = 0);
  // The new strut is welded in from wall to wall.
  if (P.wx >= 0) {
    P.arc = rnd() < 0.85 ? 0.5 + 0.5 * rnd() : 0;
    if (rnd() < 14 * d) P.pa.push([P.wx, strutY(P.k) + 2, (rnd() - 0.5) * 10, -2 - rnd() * 4, 0.6 + rnd() * 0.5, 0]);
    if ((P.wx += 7 * d) > PR + 1) (P.wx = -1), (P.arc = 0);
  }
  // At the bottom: the blinding concrete, then on to the next lot.
  if (P.k >= FIN && P.hv < 15 && (P.mat += d / 6) > 1.4 && P.sl < 0) (P.snap = 1), (P.sl = 0), lot(P, P.nk), skyline(P);
  if (P.sl >= 0 && (P.sl += rd / 2.2) >= 1) P.sl = -1;
  // Seepage drips below the water table.
  const wtY = 78 - 34 * wt, e = exp(-0.25 * d);
  if (P.fy > wtY + 6 && rnd() < 6 * wt * d) P.pa.push([PL + 1 + rnd() * 42, wtY + rnd() * (P.fy - wtY - 5), 0, 0, 3, 1]);
  for (let i = PL; i <= PR; i++) P.dig[i] *= e;
  P.dust = max(0.1, P.dust * e);
  P.du = P.du.filter((p) => ((p[0] += p[4] * d), (p[1] += p[5] * d), (p[2] += 2.2 * d), (p[3] -= 0.22 * d) > 0));
  P.pa = P.pa.filter((p) => ((p[3] += 40 * d), (p[0] += p[2] * d), (p[1] += p[3] * d), (p[4] -= d) > 0 && p[1] < (p[0] >= PL && p[0] <= PR ? P.fy : H)));
}

let F, LM;
const at = (x, y) => ((x = round(x)), (y = round(y)), x < 0 || x >= W || y < 0 || y >= H ? -1 : (y * W + x) * 3);
function sur(x, y, r, g, b, k = 1, o = at(x, y)) {
  if (o >= 0) (F[o] = r * LM[o] * k), (F[o + 1] = g * LM[o + 1] * k), (F[o + 2] = b * LM[o + 2] * k);
}
const surc = (x, y, c, k = 1) => sur(x, y, c[0], c[1], c[2], k);
function put(x, y, c, a = 1, o = at(x, y)) {
  if (o >= 0) for (let i = 0; i < 3; i++) F[o + i] = mix(F[o + i], c[i], a);
}
function add(x, y, c, k, o = at(x, y)) {
  if (o >= 0) for (let i = 0; i < 3; i++) F[o + i] += c[i] * k;
}
function line(x0, y0, x1, y1, c, k = 1) {
  const n = max(abs(x1 - x0), abs(y1 - y0)) * 1.3 + 1;
  for (let i = 0; i <= n; i++) surc(mix(x0, x1, i / n), mix(y0, y1, i / n), c, k);
}
const cloudA = (P, x, y) => cl((0.6 * vn((x + P.cx) * 0.07, y * 0.18) + 0.4 * vn((x + P.cx) * 0.19, y * 0.4 + 5) - 0.6 + 0.3 * P.wt) * 5, 0, 1);

function lamp(x0, y0, r2, k, c) {
  const R = Math.ceil(sqrt(r2 * 4.6)), gx = [];
  for (let x = max(0, x0 - R); x <= min(W - 1, x0 + R); x++) gx.push(x, k * exp(-((x - x0) ** 2) / r2));
  for (let y = max(0, y0 - R); y <= min(H - 1, y0 + R); y++)
    for (let i = 0, g = exp(-((y - y0) ** 2) / r2); i < gx.length; i += 2) for (let j = 0, o = (y * W + gx[i]) * 3; j < 3; j++) LM[o + j] += c[j] * gx[i + 1] * g;
}

// Daylight with cloud shadows, the shaft of sun, the lamps.
function light(P, K) {
  const { sunI: sI, slope: s, rs, sh, shf, k: pk, lampK: nl } = P, ks = min(pk, FIN - 1);
  for (let i = 0; i < 200; i++) sh[i] = 1 - 0.85 * cloudA(P, i - 96, 7);
  rs.fill(1);
  for (let j = 1, y; j <= ks; j++) (y = strutY(j)), (rs[y + 2] = rs[y + 4] = 0.6), (rs[y + 3] = 0.4);
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, x0 = x - s * (y - GL), out = y < GL + 2;
    const a = out ? 1 : (0.62 - 0.003 * (y - GL)) * (x > OR ? 0.75 : 1);
    const l = out ? 0.5 * sI * sh[x + 80] : sI > 0 && x0 > PL - 1.5 && x0 < OR + 1.5 ? sI * sm(PL - 1.5, PL + 1, x0) * (1 - sm(OR - 1, OR + 1.5, x0)) * sh[floor(x0) + 80] * rs[y] * (1 - 0.0025 * (y - GL)) : 0;
    shf[i] = out ? 0 : l;
    for (let c = 0; c < 3; c++) LM[o + c] = K[9 + c] * a + K[6 + c] * l * 0.95;
  }
  // Floods on the lowest strut; sodium lamps after dark.
  lamp(17, strutY(ks) + 2, 260, 0.7, FLOOD), lamp(47, strutY(ks) + 2, 260, 0.7, FLOOD);
  if (nl > 0) for (let j = 1; j <= ks; j++) lamp(j & 1 ? 12 : 51, strutY(j) + 2, 60, 1.3 * nl, [1, 0.62, 0.24]);
  if (P.arc > 0) lamp(round(P.wx), strutY(pk) + 1, 70, 1.4 * P.arc, [0.7, 0.85, 1]);
  if (P.bl > 0.8) lamp(40, round(P.fy) - 3, 260, 1.8 * (1 - sm(0.8, 1.2, P.bl)), [1, 0.8, 0.5]);
  const tx = P.C.p[0];
  if (nl > 0)
    for (let y = 8; y < min(H, P.fy + 2); y++)
      for (let hw = 1.5 + 0.16 * (y - 7), x = max(0, floor(tx - hw)); x <= min(W - 1, tx + hw); x++)
        for (let c = 0, e = ((0.9 * nl) / (1 + (y - 7) / 70)) * (1 - abs(x - tx) / hw); c < 3; c++) LM[(y * W + x) * 3 + c] += e * (c > 1 ? 0.92 : 1);
}

function sky(P, K) {
  const ov = 0.75 * sm(0.2, 1, P.wt), day = P.dayF, dk = 0.3 + 0.7 * day, cc = [0, 1, 2].map((c) => mix(mix(K[3 + c], 255, 0.55) * dk, 130 * dk, ov));
  for (let i = 0; i < GL * W; i++) {
    const x = i & 63, y = i >> 6, u = y / (GL - 1), a = cloudA(P, x, y) * (0.9 - 0.4 * u);
    for (let c = 0; c < 3; c++) F[i * 3 + c] = mix(mix(mix(K[c], K[3 + c], u * u), 120 * (0.25 + 0.75 * day), ov), cc[c], a);
  }
  // The street's buildings, the two beside the pit tall.
  for (const [x0, x1, top, v, side] of P.bd)
    for (let y = top; y < GL; y++)
      for (let x = x0; x <= x1; x++) {
        const win = (x - x0) % 3 === 1 && (y - top) % 3 === 1 && x < x1, lit = hash(x * 7, y + floor(v * 99)) < 0.45 && day < 0.7;
        for (let c = 0, b; c < 3; c++) (b = K[12 + c] * (0.78 + 0.3 * v) * (x === x0 ? 0.8 : 1)), (b = win ? (lit ? WIN[c] * (1 - day) : b * 0.55 + 18 * c * day) : b), (F[(y * W + x) * 3 + c] = side ? b : mix(b, K[3 + c], 0.3));
      }
}

function ground(P) {
  const { so, bw, srf, wt, st, fy } = P, wtY = 78 - 34 * wt, sec = 0.42 + 0.52 * P.dayF, mc = matCol(P), hh = heapH(P), kc = STEEL.map((v) => v * 0.5 * sec);
  for (let x = PL; x <= PR; x++) srf[x] = fy + P.dig[x] + 0.6 * (hash(x, 7) - 0.5);
  for (let i = GL * W; i < N; i++) {
    // Pavement, deck and caps; far wall and heap; the ground in section.
    const x = i & 63, y = i >> 6, o = i * 3, pit = x >= PL && x <= PR;
    let A = so, a = o, L = 0, k = sec;
    if (y < GL + 2 && !(pit && x <= OR)) (A = (x > 6 && x < PL) || (x > PR && x < 57) ? CAP : x > OR && x < 56 ? DECK : ROAD), (a = 0), (L = 1), (k = y === GL ? 1.18 : A === DECK && (x + y) & 1 ? 0.86 : 1);
    else if (pit && y < srf[x]) (L = 1), y >= srf[x] - max(0, hh - abs(x - HX) * 1.1) ? ((A = mc), (a = 0), (k = 0.85 + 0.3 * hash(x, y))) : ((A = bw), (k = y > wtY ? 1 - 0.5 * wt * st[i] : 1));
    else if (pit && y < srf[x] + 1) (L = 1), (k = 1.15);
    else if (!pit && y > wtY + 4) k *= 1 - 0.12 * wt;
    for (let c = 0; c < 3; c++) F[o + c] = A[a + c] * k * (L ? LM[o + c] : 1);
  }
  // Walls and king posts down to their toes; the deck's beams.
  for (let y = GL + 2; y < 126; y++) {
    for (const [x, c] of WALLS) for (let i = 0; i < 3; i++) F[(y * W + x) * 3 + i] = c[i] * sec;
    for (const x of KP) for (let i = 0; i < 2; i++) y < srf[x] ? sur(x + i, y, ...STEEL, 0.62 + 0.23 * i) : put(x + i, y, kc);
  }
  for (let x = OR + 1; x <= PR; x++) sur(x, GL + 2, 70, 74, 84), sur(x, GL + 3, 90, 94, 104, x % 6 ? 0.7 : 1.2);
  // Struts with wales and jacks.
  for (let j = 1; j <= min(P.k, FIN - 1); j++) {
    const y = strutY(j), end = j === P.k && P.wx >= 0 ? P.wx : PR;
    for (let x = PL; x <= end; x++) sur(x, y, ...STEEL, x % 11 === 3 ? 0.8 : 1.25), sur(x, y + 1, ...STEEL, 0.75);
    for (let i = -1; i <= 2; i++) {
      for (const x of [PL, PL + 1, PR - 1, PR]) sur(x, y + i, 80, 84, 96);
      if (end >= PR) for (let x = 46; x <= 48; x++) surc(x, y + i, YEL, i < 0 || i > 1 ? 0.7 : 1);
    }
  }
  // Blinding concrete on the last floor.
  const me = PL + min(1, P.mat) * (P.ex - PL - 8);
  if (P.mat > 0) for (let x = PL; x <= me; x++) for (let j = 0, o; j < 3; j++) (o = at(x, srf[x] - j)), put(x, srf[x] - j, [0, 1, 2].map((c) => 200 * max(0.55, LM[o + c]) * (j ? 0.9 : 1.1)));
  if (P.mat > 0 && P.mat < 1) line(30, GL + 1, me, fy - 3, [96, 96, 104]);
  // The pump's pool, and its hose up the wall to the tank.
  for (let x = 45; x <= PR; x++)
    for (let y = round(fy - 0.4 - 2.6 * wt), g; y < srf[x]; y++) (g = 0.5 + 0.5 * sin(x * 1.3 + P.t * 5 + y * 2)), sur(x, y, 60 + 60 * g, 96 + 60 * g, 132 + 50 * g);
  for (let j = 1; j <= 2; j++) sur(51, fy - j, ...HOSE), sur(52, fy - j, ...HOSE);
  for (let y = fy - 2; y > GL - 2; y--) surc(PR, y, HOSE);
  for (let x = PR; x < 60; x++) surc(x, GL - 2, HOSE);
  for (let x = 59; x <= 62; x++) for (let y = 16; y < GL; y++) sur(x, y, 120, 140, 160, y === 16 ? 1.2 : 0.8);
  if (wt > 0.03) for (let j = 0; j < 2; j++) put(59 + j, GL - 2 + j, RAIN, min(1, wt * 6) * (0.5 + 0.5 * sin(P.t * 20 + j)));
}

function excavator(P) {
  const ex = P.ex, gy = round(P.fy), [bu, bv, ph] = P.E.p, f = cos(ph), X = (u) => ex + u * f, hw = 4.5 * abs(f) + 3.2 * abs(sin(ph)), nl = P.lampK;
  for (let i = -6; i <= 6; i++) for (let j = 1; j <= 3; j++) (abs(i) < 6 || j === 2) && sur(ex + i, gy - j, ...(j !== 2 && (i + floor(P.trk)) & 1 ? [92, 92, 96] : [46, 46, 50]));
  for (let i = -3; i <= 3; i++) sur(ex + i, gy - 4, 52, 50, 48);
  for (let j = 5; j <= 7; j++) for (let x = round(ex - hw); x <= round(ex + hw); x++) surc(x, gy - j, YEL, j === 5 ? 0.7 : (x - ex) * f < -2.5 ? 0.82 : 1);
  const ca = round(min(X(0.5), X(3.5))), cb = max(ca + 1, round(max(X(0.5), X(3.5))));
  for (let j = 8; j <= 11; j++) for (let x = ca; x <= cb; x++) j === 11 || x === (f >= 0 ? ca : cb) ? surc(x, gy - j, YEL) : (sur(x, gy - j, 110, 150, 180, 0.9), add(x, gy - j, WIN, 0.5 * nl));
  // Boom and arm reach the bucket by two-link IK.
  const [pu, pv, L1, L2] = [3, -6, 9, 8.5];
  let tu = bu - pu, tv = bv - pv;
  const dd = hypot(tu, tv) || 1, dc = cl(dd, 2, L1 + L2 - 0.05);
  (tu *= dc / dd), (tv *= dc / dd);
  const t1 = atan2(tv, tu) - acos(cl((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1)), eu = pu + L1 * cos(t1), ev = pv + L1 * sin(t1), bx = X(pu + tu), by = gy + pv + tv;
  line(X(pu), gy + pv, X(eu), gy + ev, YEL), line(X(pu), gy + pv + 1, X(eu), gy + ev + 1, YEL, 0.75);
  line(X(4), gy - 5, X(pu + (eu - pu) * 0.55), gy + pv + (ev - pv) * 0.55 + 1, [150, 150, 156]);
  line(X(eu), gy + ev, bx, by, YEL, 0.9);
  for (let i = 0; i <= 2; i++) sur(bx - i * f, by, 74, 74, 80), sur(bx - i * f, by + 1, 74, 74, 80, 0.8), P.ec && surc(bx - i * f, by - 1, matCol(P), 1.1);
  add(X(4.5), gy - 9, FLOOD, 255 * nl);
}

// A worker in hi-vis, feet on row y; a headlamp after dusk.
function man(P, x, y, arm) {
  sur(x, y, 40, 48, 90), sur(x, y - 1, 255, 128, 20), sur(x, y - 2, 255, 255, 240), arm && sur(x + 1, y - 2 - (arm > 0.5), 255, 128, 20);
  add(x, y - 2, FLOOD, 200 * P.lampK);
}

function grab(P) {
  const [tx, by, op] = P.C.p, X = round(tx), Y = round(by), HW = [3, 3.4, 3.4, 3, 2];
  for (let y = 7; y < Y; y++) sur(X - 1, y, 200, 200, 210), sur(X + 1, y, 200, 200, 210);
  for (let i = -1; i <= 1; i++) surc(X + i, Y, GAN, 1.2), surc(X + i, Y + 1, GAN, 0.85);
  for (let j = 0; j < 5; j++)
    for (let i = -6, a; i <= 6; i++) (a = abs(i)) >= op * (0.4 + 0.9 * j) - 0.01 && a <= HW[j] + op * 0.9 * j && (j === 4 || (op < 0.3 && !i) ? sur(X + i, Y + 2 + j, 96, 100, 110) : surc(X + i, Y + 2 + j, GRAB, j ? 1 : 1.2));
  if (P.full && op < 0.5) for (let i = -2; i <= 2; i++) surc(X + i, Y + 2, matCol(P), 1.2);
  for (let i = -3; i <= 3; i++) sur(X + i, 5, 70, 74, 84), surc(X + i, 6, GAN, abs(i) < 2 ? 0.6 : 1);
}

function gantry(P) {
  for (let y = 2; y < GL; y++) for (const x of [4, 58]) surc(x, y, GAN), (y + (x >> 2)) % 3 && surc(x + 1, y, GAN, 0.7);
  for (let x = 3; x <= 60; x++) surc(x, 2, GAN, 1.1), surc(x, 4, GAN), (x + 1) % 3 || surc(x, 3, GAN, 0.8);
  put(32, 1, P.rt % 1.4 < 0.7 ? [255, 40, 30] : [90, 16, 14]);
  // The railing, and the signalman at the edge.
  for (let x = 8; x <= OR; x++) sur(x, 17, ...((x >> 1) & 1 ? [230, 60, 50] : [236, 236, 236])), x % 6 === 2 && (sur(x, 18, 200, 200, 200), sur(x, 19, 200, 200, 200));
  man(P, 35, GL - 1, P.C.ph < 3 ? (P.rt * 2) % 1 : 0);
}

function truck(P) {
  const o = round(P.tx), mc = matCol(P), hL = [0, 1.6, 2.7, 3.7][min(3, P.load)];
  if (o > 30) return;
  for (let x = 37; x <= 50; x++)
    for (let y = 9; y <= 16; y++)
      y > 12 ? sur(x + o, y, 196, 56, 44, y === 13 ? 1.25 : (x - 37) % 4 ? 1 : 0.75) : y > 12 - hL * (1 - ((x - 43.5) / 7) ** 2) && surc(x + o, y, mc, 0.85 + 0.3 * hash(x, y));
  for (let x = 51; x <= 56; x++) for (let y = 10; y <= 16; y++) (y > 10 || x > 51) && (y < 14 && y > 10 && x > 52 ? sur(x + o, y, 60, 90, 120) : sur(x + o, y, 50, 96, 200));
  for (let x = 37; x <= 56; x++) sur(x + o, 17, 50, 50, 54);
  for (const x of [39, 43, 53]) sur(x + o, 18, 30, 30, 34), sur(x + o + 1, 18, 30, 30, 34), sur(x + o, 19, 120, 120, 126), sur(x + o + 1, 19, 30, 30, 34);
  add(57 + o, 15, FLOOD, 255 * P.lampK), add(36 + o, 16, [255, 30, 20], P.lampK);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || P.h === undefined) return;
  [F, LM] = [P.f, P.lm];
  if (P.snap) P.sn.set(F), (P.snap = 0);
  const hh = P.h * 3, i0 = min(2, floor(hh)), K = KEYS[i0].map((v, c) => mix(v, KEYS[i0 + 1][c], hh - i0)), mc = matCol(P), fy = round(P.fy);
  light(P, K), sky(P, K), gantry(P), ground(P), excavator(P);
  man(P, 12, round(P.srf[12] - max(0, heapH(P) - 9.9)) - 1, 0);
  if (P.wx >= 0) man(P, round(P.wx) - 1, fy - 1, 1);
  truck(P), grab(P);
  // Sparks, drips, spoil and dust.
  for (const [x, y, , , l, k] of P.pa) k ? (k > 1 ? surc(x, y, mc, 1.3) : put(x, y, [170, 210, 255], 0.8)) : put(x, y, [255, 200, 90], min(1, l * 2));
  for (const [px, py, r, a] of P.du) {
    const o0 = at(cl(px, 0, 63), cl(py, 0, 127)), R = Math.ceil(r), pc = mc.map((v, c) => mix(v, 210, 0.5) * min(1.3, 0.3 + LM[o0 + c]));
    for (let y = round(py) - R; y <= py + R; y++)
      for (let x = round(px) - R, q; x <= px + R; x++) (q = 1 - ((x - px) ** 2 + (y - py) ** 2) / (r * r)) > 0 && put(x, y, pc, min(1, a * q * q * 0.9));
  }
  // Haze in the shaft, thicker with dust.
  for (let i = 0, hz = 8 + 30 * P.dust; i < N; i++) if (P.shf[i] > 0.01) for (let c = 0; c < 3; c++) F[i * 3 + c] += K[6 + c] * P.shf[i] * hz;
  if (P.arc > 0) add(round(P.wx), strutY(P.k) + 1, FLOOD, 500);
  if (P.bl >= 0 && P.bl < 0.8 && P.bl % 0.3 < 0.15) put(34, GL - 4, [255, 170, 30]), add(34, GL - 3, [255, 140, 20], 0.6);
  // Rain past halfway, not under the deck.
  for (let i = 0, rain = sm(0.45, 1, P.wt); i < 160 * rain; i++) {
    const y = ((hash(i, 2) * 150 + P.t * 70) % 150) - 10, x = (hash(i, 1) * 80 + y * 0.25) % 64;
    if (x <= OR + 0.5 || x >= PR + 1 || y <= GL + 1) for (let j = 0; j < 3; j++) put(x - j * 0.25, y - j, RAIN, 0.6 * (1 - j / 3) * (0.4 + 0.6 * P.dayF));
  }
  const off = P.sl >= 0 ? round(64 * sm(0, 1, P.sl)) : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xs = x + off, B = xs < W && off ? P.sn : F, o = (y * W + (xs % W)) * 3;
      display.setPixel(x, y, min(255, B[o]) | 0, min(255, B[o + 1]) | 0, min(255, B[o + 2]) | 0);
    }
}
