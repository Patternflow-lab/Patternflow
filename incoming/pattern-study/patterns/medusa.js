// ===== Patternflow pattern =====
// Title:   Medusa
// Family:  halloween
// Idea:    A Gorgon's head stands against a purple night with an orange glow over her crown: a crown of green and violet snakes rises from her hair and hangs past her cheeks, writhing, flicking their tongues and striking, until her eyes open toxic green and a ring of their light runs out from her gaze, turning snakes, face and robe to grey stone that holds, cracks and falls away in flakes so the colour and the writhing come back.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 53, after the Gorgon Medusa of Greek myth
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Snakes=9..17, Writhe=-1..1
//
// Knob 1: Hue. Turns the snakes, her eyes and the ring of her gaze round the wheel together. At 0 two snakes in three are toxic green with a black zigzag, the third violet with an orange one, and her eyes and the ring are green; her face, robe and the night keep their colours.
// Knob 2: Speed. At 2 a wave runs up each snake at 13 to 23 LEDs a second, each snake strikes every 4 to 7 seconds and flicks its tongue every 1.6 to 2.6, and she looks 3.4 seconds in and then every 13.4: her eyes open in 0.35 seconds, the stone takes 1.7 to pass every corner, holds about 1.3, cracks over 0.8 and falls away over 1.8. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Snakes. How many snakes grow from her hair, 9 to 17. With 9 one hangs on each side and seven rise; from 13 two hang on each side.
// Knob 4: Writhe. How hard they writhe: at -1 the bends are a third as deep and slower, at 0.06 where it opens a little over the middle, at 1 they coil and knot.
// Buttons: K1 tap while the snakes writhe: she looks at you now and the stone wave starts.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Her eyes sit at (CX -+ EDX, EY); the gaze runs out from between them.
const CX = 32, EY = 72, EDX = 6.5;
// Snakes: up to MS of them, each cut into stone segments SEG LEDs long.
const SEG = 5, MSEG = 16, MS = 17;
const SKIN = [178, 222, 166];

// Half width of the face at height y: a dome over the brow, a long jaw to
// a narrow chin at y = 96.
function faceHW(y) {
  if (y < 70) return y < 55 ? 0 : 13.2 * sqrt(max(0, 1 - ((70 - y) / 15) ** 2));
  const t = (y - 70) / 26;
  return t >= 1 ? 0 : 13.2 * sqrt(1 - t ** 2.5) * (1 - 0.25 * t);
}

// The night behind her: distance from the glow over her crown, colour.
const GLOW = [[0, 255, 132, 34], [16, 236, 62, 92], [30, 120, 26, 128], [48, 40, 8, 62], [72, 12, 3, 22]];
function glow(d) {
  let i = 0;
  while (i < GLOW.length - 2 && d > GLOW[i + 1][0]) i++;
  const A = GLOW[i], B = GLOW[i + 1], u = cl((d - A[0]) / (B[0] - A[0]), 0, 1);
  return [lerp(A[1], B[1], u), lerp(A[2], B[2], u), lerp(A[3], B[3], u)];
}

// The still layer: the night, her hair, face, neck and robe. fig marks the
// LEDs that turn to stone; cell and edge split them into flakes.
function still(S) {
  const { bg, fig, col, stone, cell, edge, cells } = S;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), cx = x + 0.5, cy = y + 0.5, o = 3 * p;
    const c = glow(hypot((cx - 32) * 1.15, cy - 44));
    bg[o] = c[0];
    bg[o + 1] = c[1];
    bg[o + 2] = c[2];
    let f = 0, r = 0, g = 0, b = 0;
    const ax = abs(cx - CX), hw = faceHW(cy), u = (cx - CX) / max(hw, 1e-3);
    const neckHW = 6.5 + max(0, cy - 98) * 0.5, shTop = 100 + 11 * max(0, (ax - 7) / 25) ** 1.2;
    const hairE = ((cx - CX) / 17.5) ** 2 + ((cy - 66) / 13.5) ** 2;
    if (ax < hw) {
      // Skin: pale jade, lit from the upper left, the sides falling off.
      f = 1;
      let k = (0.5 + 0.5 * sqrt(max(0, 1 - u * u))) * (1 - 0.14 * u) * (cy < 70 ? 1.04 : 1);
      [r, g, b] = SKIN;
      for (const s of [-1, 1]) {
        const ex = CX + s * EDX, e = ((cx - ex) / 4.8) ** 2 + ((cy - 71.6) / 3) ** 2;
        // Sockets in lavender shadow.
        if (e < 1) (k *= 0.6 + 0.4 * e), (r = lerp(150, r, e)), (g = lerp(110, g, e)), (b = lerp(170, b, e));
        // Brows: dark bars rising outward, the inner ends low.
        const bx0 = CX + s * 2.4, by0 = 67.4, bx1 = CX + s * 10.6, by1 = 64.4;
        const t = cl(((cx - bx0) * (bx1 - bx0) + (cy - by0) * (by1 - by0)) / ((bx1 - bx0) ** 2 + (by1 - by0) ** 2), 0, 1);
        if (hypot(cx - lerp(bx0, bx1, t), cy - lerp(by0, by1, t)) < 0.8) (r = 52), (g = 30), (b = 58), (k = 1);
        // The hollow under the cheekbone.
        if (s * u > 0.5 && s * u < 0.86 && cy > 79 && cy < 87) k *= 0.82;
      }
      // Nose: a lit ridge, its shadow side, the shade under it, two nostrils.
      if (x === 31 && y >= 71 && y <= 80) k *= 1.13;
      if ((x === 33 || x === 34) && y >= 74 && y <= 81) k *= 0.74;
      if (y === 83 && x >= 29 && x <= 35) k *= 0.72;
      if (y === 82 && (x === 30 || x === 34)) (k = 0.45), (r = 120), (g = 80), (b = 110);
      // Mouth: dark lips, the line between them and turned-down corners.
      if (y === 87 && x >= 28 && x <= 36) (r = 132), (g = 50), (b = 122), (k = 1);
      if (y === 88 && x >= 27 && x <= 37) (r = 46), (g = 10), (b = 44), (k = 1);
      if (y === 89 && x >= 28 && x <= 36) (r = 176), (g = 78), (b = 160), (k = 1);
      if (y === 89 && (x === 27 || x === 37)) (r = 46), (g = 10), (b = 44), (k = 1);
      if (y === 90 && x >= 29 && x <= 35) k *= 0.8;
      if (y >= 92 && y <= 93 && ax < 3) k *= 1.08;
      // The jaw's edge darkens so the face stands off the neck.
      if (abs(u) > 0.88 || faceHW(cy + 1.2) < ax) k *= 0.62;
      (r *= k), (g *= k), (b *= k);
    } else if (hairE < 1 && (cy < 74 || cy < 88 - ax * 0.3)) {
      // The hair the snakes grow from: dark violet coils.
      f = 1;
      const coil = sin(cx * 1.3 + cy * 0.6) + sin(cy * 1.1 - cx * 0.7);
      const k = 0.7 + 0.3 * (1 - hairE) + (coil > 1 ? 0.5 : 0);
      (r = 34 * k), (g = (coil > 1.3 ? 52 : 12) * k), (b = 46 * k);
    } else if (cy >= 89 && cy < shTop + 2 && ax < neckHW) {
      // Neck, in the jaw's shadow at the top.
      f = 1;
      const v = (cx - CX) / neckHW;
      let k = (0.45 + 0.4 * sqrt(max(0, 1 - v * v))) * (1 - 0.1 * v);
      if (cy < 95) k *= 0.62;
      (r = SKIN[0] * k), (g = SKIN[1] * k), (b = SKIN[2] * k);
    } else if (cy >= shTop) {
      f = 1;
      // The robe: violet, its shoulders and collar rimmed, with folds.
      let k = 1, rr = 92, gg = 30, bb = 124;
      const dy = cy - 104;
      for (const fx of [9.5 + dy * 0.35, 18 + dy * 0.55, 26 + dy * 0.75]) {
        if (abs(ax - fx) < 0.6) k = 0.48;
        else if (abs(ax - fx - 1) < 0.5) k = 1.4;
      }
      if (cy < shTop + 1.4) (rr = 180), (gg = 86), (bb = 204), (k = 1);
      (r = rr * k), (g = gg * k), (b = bb * k);
      // A clasp: a toxic green stone at the collar.
      if (hypot(cx - CX, cy - 104) < 1.7) (r = 70), (g = 240), (b = 90);
    }
    fig[p] = f;
    col[o] = min(255, r);
    col[o + 1] = min(255, g);
    col[o + 2] = min(255, b);
    grey(stone, o, r, g, b, p);
  }
  // Flakes: cells round a jittered 6 LED grid; their borders are the cracks.
  const G = 6, GW = 11, GH = 22, sx = [], sy = [];
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) sx.push(i * G + 3 + (hash(j * 97 + i) - 0.5) * 4), sy.push(j * G + 3 + (hash(j * 89 + i + 5000) - 0.5) * 4);
  for (let p = 0; p < N; p++) {
    if (!fig[p]) continue;
    const x = (p % W) + 0.5, y = floor(p / W) + 0.5, gi = floor(x / G), gj = floor(y / G);
    let best = 1e9, id = 0;
    for (let j = gj - 1; j <= gj + 1; j++)
      for (let i = gi - 1; i <= gi + 1; i++) {
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        const d = (x - sx[j * GW + i]) ** 2 + (y - sy[j * GW + i]) ** 2;
        if (d < best) (best = d), (id = j * GW + i);
      }
    cell[p] = id;
  }
  for (let p = 0; p < N; p++) {
    if (!fig[p]) continue;
    edge[p] = (p % W < W - 1 && fig[p + 1] && cell[p + 1] !== cell[p]) || (p + W < N && fig[p + W] && cell[p + W] !== cell[p]) ? 1 : 0;
    (cells[cell[p]] || (cells[cell[p]] = [])).push(p);
  }
}

export function setup(params) {
  const S = {
    T: 0, c0: 0, first: true, hue: -1, palHue: -2, n: 9, amp: 1, R: -1, ph: -9, look: 0, lastT: 0,
    bg: new Float32Array(N * 3), col: new Float32Array(N * 3), stone: new Float32Array(N * 3), buf: new Float32Array(N * 3),
    fig: new Uint8Array(N), cell: new Int16Array(N), edge: new Uint8Array(N), cells: [],
    cellState: new Uint8Array(242), cellCrack: new Float32Array(242), cellFlake: new Float32Array(242),
    own: new Int8Array(N), dd: new Float32Array(N), vv: new Float32Array(N), ss: new Float32Array(N),
    snakes: [], segStone: new Uint8Array(MS * MSEG), segCrack: new Float32Array(MS * MSEG), segFlake: new Float32Array(MS * MSEG),
    parts: [], pal: [], eye: [0, 0, 0],
  };
  still(S);
  for (let i = 0; i < MS; i++) S.snakes.push({ tau: hash(i * 13 + 7) * 20, rate: 1, frozen: false, pts: new Float32Array(720), np: 0, L: 40, strike: 0, mouth: 0, tongue: 0 });
  params.s = S;
}

// The story, in seconds at Speed 2 after her eyes start to open: the stone
// wave leaves her eyes at OPEN and takes WAVE to pass every corner, cracks
// run from CRACK - 0.8, flakes fall from FLAKE, her eyes close from BACK and
// at END the snakes writhe again until the next look.
const OPEN = 0.35, WAVE = 1.7, CRACK = 4.1, FLAKE = 4.2, BACK = 6.3, END = 6.6;
const gazeAt = (S) => (S.first ? 3.4 : 6.8);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 9, 0.06];
  const step = cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3) * 0.5;
  S.hue = cl(k[0], 0, 1);
  S.n = cl(Math.round(k[2]), 9, MS);
  const wr = cl(k[3], -1, 1);
  S.amp = 1 + 0.65 * wr;
  S.T += step;
  let g = S.T - S.c0 - gazeAt(S);
  if (input.btnPressed && input.btnPressed[0] && g < 0) (S.c0 = S.T - gazeAt(S)), (g = 0);
  if (g >= END) {
    // A new cycle: the stone is gone and every snake moves.
    S.c0 = S.T;
    S.first = false;
    S.cellState.fill(0);
    S.segStone.fill(0);
    for (const sn of S.snakes) sn.frozen = false;
    g = -gazeAt(S);
  }
  S.ph = g;
  // The wave's radius, from her eyes out past every corner.
  S.R = g < OPEN ? -1 : g < WAVE + OPEN ? ((g - OPEN) / WAVE) * 125 : 200;
  S.look = g < 0 ? 0 : g < OPEN ? g / OPEN : g < BACK ? 1 : 1 - (g - BACK) / (END - BACK);
  for (let i = 0; i < MS; i++) {
    const sn = S.snakes[i];
    // A snake stops when the wave reaches its root and moves again once its
    // last flake is off.
    if (sn.frozen && g > FLAKE) {
      let left = 0;
      for (let j = 0; j < MSEG; j++) if (S.segStone[i * MSEG + j] === 1) left++;
      if (left === 0) sn.frozen = false;
    }
    sn.rate = sn.frozen ? 0 : min(1, sn.rate + step * 3);
    sn.tau += step * sn.rate * (1 + 0.2 * wr);
  }
}

// One snake's centreline: its root on the crown, a heading that bends with
// a wave running from root to head, and the strike that throws the head
// out. The outermost snakes hang down past her cheeks and lift their heads
// beside her shoulders; the rest rise in a fan above her.
function body(S, i) {
  const sn = S.snakes[i], n = S.n, r = (q) => hash(i * 31 + q);
  const nh = n >= 13 ? 2 : 1, hang = i < nh || i >= n - nh, sd = i < n / 2 ? -1 : 1;
  const t = sn.tau, amp = S.amp;
  // Strikes every 4 to 7 seconds: out fast, back slower.
  const per = 4 + 3 * r(1), sp = ((t + per * r(2)) % per) / 0.5;
  const strike = sp < 1 ? (sp < 0.25 ? sp / 0.25 : 1 - ((sp - 0.25) / 0.75) ** 1.5) : 0;
  sn.strike = strike;
  sn.mouth = sp < 0.7 ? 1 : 0;
  const tp = 1.6 + r(3), tf = ((t + tp * r(4)) % tp) / tp;
  sn.tongue = tf < 0.12 ? sin((tf / 0.12) * PI * 2) : 0;
  let phi, th, kap, kh, L0;
  if (hang) {
    const o = sd < 0 ? i : n - 1 - i;
    phi = sd < 0 ? -PI + 0.12 + 0.3 * o : -0.12 - 0.3 * o;
    th = sd < 0 ? PI - 0.8 - 0.25 * o : 0.8 + 0.25 * o;
    kap = sd * (0.032 - 0.006 * o);
    kh = -sd * 0.13;
    L0 = 46 + 5 * r(5) - 6 * o;
  } else {
    const nr = n - 2 * nh, u = (i - nh + 0.5) / nr;
    phi = -PI + 0.5 + u * (PI - 1);
    th = lerp(phi, -PI / 2, 0.5);
    kap = (u - 0.5) * 0.012;
    kh = (u < 0.5 ? -1 : 1) * 0.05;
    L0 = 64 - 52 * abs(u - 0.5) ** 1.5 - 5 * r(5);
  }
  th += 0.2 * sin(t * 0.5 + 9 * r(7)) * amp;
  const L = L0 * (0.94 + 0.06 * sin(t * 0.9 + 6 * r(6))) + 12 * strike;
  sn.L = L;
  const lam = 20 + 6 * r(9), w = 4 + 1.5 * r(10), A = 1.05 * amp * (1 - 0.75 * strike);
  let x = CX + 15.5 * cos(phi), y = 66 + 11 * sin(phi), m = 0;
  const P = sn.pts;
  for (let s = 0; s <= L && m < P.length; s += 0.5) {
    const hth = th + A * (0.35 + (0.65 * s) / L) * sin((TAU * s) / lam - w * t + 7 * r(12));
    P[m++] = x;
    P[m++] = y;
    P[m++] = hth;
    P[m++] = s;
    th += 0.5 * (s > L - 12 ? kh * (1 - strike) : kap);
    x += 0.5 * cos(hth);
    y += 0.5 * sin(hth);
  }
  sn.np = m >> 2;
}

// Radius of a snake at s: a taper to the neck, then the wide flat head.
function radius(s, L) {
  const hs = (s - (L - 7)) / 7;
  if (hs <= 0) return 2.5 - 1.15 * (s / (L - 7));
  return hs < 0.4 ? 1.35 + 1.25 * (hs / 0.4) : 2.6 - 1.6 * ((hs - 0.4) / 0.6) ** 1.5;
}

// Stone grey for a lit colour, speckled per LED.
function grey(buf, o, r, g, b, p) {
  const l = (0.35 * r + 0.5 * g + 0.15 * b) / 255, sp = (hash(p * 3 + 1) - 0.5) * 22;
  buf[o] = 50 + 160 * l + sp;
  buf[o + 1] = 48 + 156 * l + sp;
  buf[o + 2] = 58 + 160 * l + sp;
}

function put(buf, x, y, c) {
  x = floor(x);
  y = floor(y);
  if (x >= 0 && x < W && y >= 0 && y < H) (buf[3 * (y * W + x)] = c[0]), (buf[3 * (y * W + x) + 1] = c[1]), (buf[3 * (y * W + x) + 2] = c[2]);
}

const TONGUE = [255, 50, 40], CRACKC = [30, 28, 36];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { bg, col, stone, buf, fig, cell, edge, own, dd, vv, ss, snakes, segStone, segCrack, segFlake, cellState, cellCrack, cellFlake, cells, parts } = S;
  const g = S.ph, R = S.R, n = S.n;
  if (S.palHue !== S.hue) {
    // Two kinds of snake: toxic green with a black zigzag, and violet with
    // an orange one.
    S.pal = [];
    for (let i = 0; i < MS; i++) S.pal.push(i % 3 === 1 ? [hsv(S.hue + 0.78, 0.62, 235), hsv(0.07, 0.86, 255)] : [hsv(S.hue + 0.33, 0.76, 240), [10, 18, 12]]);
    S.eye = hsv(S.hue + 0.36, 0.62, 255);
    S.palHue = S.hue;
  }
  buf.set(bg);
  own.fill(-1);
  // Snakes: the middle ones first, so the outer ones lie over them.
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => abs(a - (n - 1) / 2) - abs(b - (n - 1) / 2));
  for (const i of order) {
    body(S, i);
    const sn = snakes[i], P = sn.pts, L = sn.L;
    for (let q = 0; q < sn.np; q++) {
      const px = P[q * 4], py = P[q * 4 + 1], th = P[q * 4 + 2], s = P[q * 4 + 3], rad = radius(s, L);
      // The stone wave marks the segments it has passed.
      if (R > 0 && hypot(px - CX, py - EY) < R) {
        const j = min(MSEG - 1, floor(s / SEG)), z = i * MSEG + j;
        if (!segStone[z]) (segStone[z] = 1), (segCrack[z] = CRACK - 0.8 + 0.8 * hash(z)), (segFlake[z] = FLAKE + 1.6 * (0.45 * hash(z + 99) + 0.55 * (1 - j / MSEG)));
        if (q === 0) sn.frozen = true;
      }
      const tx = cos(th), ty = sin(th);
      for (let yy = floor(py - rad); yy <= floor(py + rad); yy++)
        for (let xx = floor(px - rad); xx <= floor(px + rad); xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const dx = xx + 0.5 - px, dy = yy + 0.5 - py, d = hypot(dx, dy) / rad;
          if (d > 1) continue;
          const p = yy * W + xx;
          if (own[p] !== i || d < dd[p]) (own[p] = i), (dd[p] = d), (vv[p] = (tx * dy - ty * dx) / rad), (ss[p] = s);
        }
    }
  }
  // Shade them: round bodies with a dark rim, a zigzag down the back.
  for (let p = 0; p < N; p++) {
    const i = own[p];
    if (i < 0) continue;
    const sn = snakes[i], s = ss[p], v = cl(vv[p], -1, 1), L = sn.L, o = 3 * p, head = s > L - 7;
    const zz = 0.55 * (abs((((s + i * 2.3) / 3.2) % 2) - 1) * 2 - 1);
    const c = !head && abs(v - zz) < 0.3 ? S.pal[i][1] : S.pal[i][0];
    let k = (0.42 + 0.58 * sqrt(1 - v * v)) * (1 - 0.18 * v);
    if (abs(v) > 0.72) k *= 0.38;
    if (head) k *= abs(v) < 0.5 ? 0.95 : 0.8;
    let r = c[0] * k, gg = c[1] * k, b = c[2] * k;
    if (head && sn.mouth && sn.strike > 0.15 && s > L - 3 && abs(v) < 0.5) (r = 120), (gg = 0), (b = 36);
    const z = i * MSEG + min(MSEG - 1, floor(s / SEG));
    if (segStone[z] === 1) {
      grey(buf, o, r, gg, b, p);
      if (g > segCrack[z] && (s % SEG < 0.55 || abs(v - 0.3 * sin(s * 2 + z)) < 0.12)) buf.set(CRACKC, o);
    } else (buf[o] = r), (buf[o + 1] = gg), (buf[o + 2] = b);
  }
  // Their eyes and tongues.
  for (let i = 0; i < n; i++) {
    const sn = snakes[i], P = sn.pts, q = sn.np - 1;
    if (q < 8) continue;
    const st = segStone[i * MSEG + min(MSEG - 1, floor(P[q * 4 + 3] / SEG))] === 1;
    const hx = P[(q - 6) * 4], hy = P[(q - 6) * 4 + 1], th = P[(q - 6) * 4 + 2], nx = -sin(th), ny = cos(th);
    for (const sd of [-1, 1]) {
      const p = floor(hy + ny * sd * 1.4) * W + floor(hx + nx * sd * 1.4);
      if (p >= 0 && p < N && own[p] === i) buf.set(st ? [70, 68, 76] : i % 3 === 1 ? [140, 255, 70] : [255, 196, 30], 3 * p);
    }
    if (!st && sn.tongue > 0 && !sn.frozen) {
      const a = P[q * 4 + 2], tl = 1 + 3.2 * sn.tongue, tx = P[q * 4] + cos(a) * 0.5, ty = P[q * 4 + 1] + sin(a) * 0.5;
      for (let u = 0.5; u <= tl; u += 0.5) put(buf, tx + cos(a) * u, ty + sin(a) * u, TONGUE);
      for (const sd of [-1, 1]) put(buf, tx + cos(a) * tl + cos(a + sd * 0.9), ty + sin(a) * tl + sin(a + sd * 0.9), TONGUE);
    }
  }
  // Her head and robe, and the stone over them.
  for (let p = 0; p < N; p++) {
    if (!fig[p]) continue;
    const o = 3 * p, c = cell[p], dist = hypot((p % W) + 0.5 - CX, floor(p / W) + 0.5 - EY);
    if (cellState[c] === 0 && R > 0 && dist < R) (cellState[c] = 1), (cellCrack[c] = CRACK - 0.8 + 0.8 * hash(c + 7)), (cellFlake[c] = FLAKE + 1.8 * (0.5 * hash(c + 77) + 0.5 * (1 - floor(p / W) / H)));
    const src = cellState[c] === 1 && dist < R ? (edge[p] && g > cellCrack[c] ? null : stone) : col;
    if (src) (buf[o] = src[o]), (buf[o + 1] = src[o + 1]), (buf[o + 2] = src[o + 2]);
    else buf.set(CRACKC, o);
  }
  // Her eyes: shut lids, or open and glowing, or stone.
  const look = ease(S.look), e = S.eye;
  for (const sd of [-1, 1]) {
    const ex = CX + sd * EDX;
    const stoneEye = cellState[cell[EY * W + floor(ex)]] === 1 && g > OPEN + 0.25;
    for (let y = 68; y <= 76; y++)
      for (let x = floor(ex - 5); x <= floor(ex + 5); x++) {
        const o = 3 * (y * W + x), dx = (x + 0.5 - ex) / 3.7, dy = y + 0.5 - 72;
        const hh = 1.7 * look * sqrt(max(0, 1 - dx * dx));
        if (abs(dx) <= 1 && look < 0.15 && y === floor(72.6 + 0.9 * (1 - dx * dx))) buf.set([40, 26, 46], o);
        else if (abs(dx) <= 1 && abs(dy) <= hh) {
          const pupil = abs(x + 0.5 - ex) < 0.6;
          buf.set(stoneEye ? (pupil ? [38, 36, 44] : [168, 166, 176]) : pupil ? [8, 30, 10] : e, o);
        } else if (!stoneEye && look > 0) {
          // A green glow round the open eye.
          const gl = look * 0.5 * max(0, 1 - hypot((x + 0.5 - ex) / 6, (y + 0.5 - 72) / 3.5));
          (buf[o] += e[0] * gl), (buf[o + 1] += e[1] * gl), (buf[o + 2] += e[2] * gl);
        }
      }
  }
  // The wave itself: a ring of the eyes' green running out.
  if (R > 0 && R < 130)
    for (let p = 0; p < N; p++) {
      const a = 0.7 * (1 - abs(hypot((p % W) + 0.5 - CX, floor(p / W) + 0.5 - EY) - R) / 3.2);
      if (a > 0) (buf[3 * p] += e[0] * a), (buf[3 * p + 1] += e[1] * a), (buf[3 * p + 2] += e[2] * a);
    }
  // Flakes whose time has come break off and fall.
  if (g > FLAKE) {
    for (let c = 0; c < cells.length; c++) {
      if (cellState[c] !== 1 || g < cellFlake[c] || !cells[c]) continue;
      cellState[c] = 2;
      spawn(S, cells[c], c);
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < MSEG; j++) {
        const z = i * MSEG + j;
        if (segStone[z] !== 1 || g < segFlake[z]) continue;
        segStone[z] = 2;
        const px = [];
        for (let p = 0; p < N; p++) if (own[p] === i && min(MSEG - 1, floor(ss[p] / SEG)) === j) px.push(p);
        spawn(S, px, z + 500);
      }
  }
  const dt = max(0, S.T - S.lastT);
  S.lastT = S.T;
  for (let a = parts.length - 1; a >= 0; a--) {
    const f = parts[a];
    f.vy += 90 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.y > H + 8) {
      parts.splice(a, 1);
      continue;
    }
    for (let q = 0; q < f.dx.length; q++) {
      const x = floor(f.x + f.dx[q]), y = floor(f.y + f.dy[q]);
      if (x >= 0 && x < W && y >= 0 && y < H) {
        const o = 3 * (y * W + x);
        (buf[o] = f.c[3 * q]), (buf[o + 1] = f.c[3 * q + 1]), (buf[o + 2] = f.c[3 * q + 2]);
      }
    }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, max(0, buf[o])), min(255, max(0, buf[o + 1])), min(255, max(0, buf[o + 2])));
}

// A flake: the stone LEDs it covers, as they are now, falling away.
function spawn(S, px, seed) {
  if (!px.length) return;
  let mx = 0, my = 0;
  for (const p of px) (mx += p % W), (my += floor(p / W));
  mx /= px.length;
  my /= px.length;
  const f = { x: mx, y: my, vx: (mx - 32) * 0.4 + (hash(seed + 3) - 0.5) * 10, vy: -6 - 10 * hash(seed + 5), dx: [], dy: [], c: [] };
  for (const p of px) f.dx.push((p % W) - mx), f.dy.push(floor(p / W) - my), f.c.push(S.buf[3 * p], S.buf[3 * p + 1], S.buf[3 * p + 2]);
  S.parts.push(f);
}
