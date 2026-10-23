// ===== Patternflow pattern =====
// Title:   Flame Test
// Family:  chemistry
// Idea:    On a dark lab bench a hand dips a nichrome wire loop into a row of labelled watch glasses and holds each salt in the pale blue flame of a Bunsen burner, which bursts into the element's colour, sputters with grains of salt and fades back to blue before the loop is cleaned in acid and goes for the next.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after the flame test of the school chemistry lab
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Salt=0..8, Speed=0.2..3, Room=0..1, Air=-1..1
//
// Knob 1: Salt. Which watch glass the loop goes to next: at 0 it works along the row from copper (blue-green) through sodium (yellow-orange), lithium (crimson), barium (apple green), potassium (lilac), calcium (brick red), boric acid (green) and strontium (red); 1 to 8 keeps to one glass, copper at 1 to strontium at 8.
// Knob 2: Speed. How fast the hand works and the flame moves: at 2 a salt burns about 4.5 s and the next one goes into the flame 12 s after it; at 0.2 the hand works ten times slower and the flame slows to a lazy flicker.
// Knob 3: Room. The lab lights, on at 0 and off at 1, where only the flame lights the tiles, the bench and the hand.
// Knob 4: Air. The burner's collar: shut at -1 for a tall, wavering yellow flame that hides the salt's colour, half open near 0 for the quiet blue flame of the test, wide open at 1 for a short roaring flame with a sharp inner cone.
// Buttons: K1 tap sends the loop to the next salt now.

const W = 64;
const H = 128;
const N = W * H;
// The burner's axis, the first row of flame above its barrel, the bench top.
const FX = 21;
const MOUTH = 79;
const BENCH = 94;
const { min, max, floor, ceil, round, sin, cos, exp, abs, sqrt, hypot, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

// The row of watch glasses, left to right: symbol, flame colour, the salt's
// own colour, how long its colour lasts in the flame (s), how strong it is.
const WHITE = [0.92, 0.91, 0.87];
const SALTS = [
  ["Cu", [0, 240, 185], [0.35, 0.75, 0.7], 2, 1],
  ["Na", [255, 175, 10], WHITE, 3.5, 1.25],
  ["Li", [255, 10, 85], WHITE, 2, 1],
  ["Ba", [170, 255, 35], WHITE, 2, 0.95],
  ["K", [190, 100, 255], WHITE, 1.3, 0.8],
  ["Ca", [255, 85, 10], WHITE, 2.2, 1],
  ["B", [35, 255, 60], WHITE, 1.8, 1],
  ["Sr", [255, 5, 25], WHITE, 2.2, 1.1],
];
// A heap of salt in a watch glass: x offset, row, shade.
const HEAP = [[0, 107, 1], [-1, 108, 0.95], [0, 108, 1], [1, 108, 0.8], [-2, 109, 0.85], [-1, 109, 0.9], [0, 109, 0.85], [1, 109, 0.75], [2, 109, 0.65]];
// 3x5 letters for the labels.
const FONT = {
  C: "011/100/100/100/011",
  u: "000/000/101/101/011",
  N: "110/101/101/101/101",
  a: "000/011/101/101/011",
  L: "100/100/100/100/111",
  i: "1/0/1/1/1",
  B: "110/101/110/101/110",
  K: "101/101/110/101/101",
  S: "011/100/010/001/110",
  r: "000/000/101/110/100",
  H: "101/101/111/101/101",
  l: "1/1/1/1/1",
};

// The hand's round: in the flame with a salt, to the acid, dipped, back,
// in the flame to burn the loop clean, to the next glass, dipped, back.
const DUR = [4.5, 1.1, 0.8, 1, 1.4, 1.2, 0.7, 1];
// Where the loop goes, and the holder's angle there.
const FP = [FX + 4, 62, 0.45];
const AT = [51, 75, 1.22];
const AD = [51, 90, 1.22];
const ST = (i) => [4 + 8 * i, 100, 0.52];
const SD = (i) => [4 + 8 * i, 108, 0.52];

// Smooth value noise, wrapping both ways.
function noise(w, h, cell, oct) {
  const out = new Float32Array(w * h);
  let amp = 1;
  let tot = 0;
  for (let o = 0; o < oct; o++, cell /= 2, amp *= 0.55) {
    const gw = w / cell;
    const gh = h / cell;
    const g = Float32Array.from({ length: gw * gh }, rnd);
    const at = (i, j) => g[(j % gh) * gw + (i % gw)];
    for (let y = 0; y < h; y++) {
      const j = floor(y / cell);
      const ty = sm(0, 1, y / cell - j);
      for (let x = 0; x < w; x++) {
        const i = floor(x / cell);
        const tx = sm(0, 1, x / cell - i);
        const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
        const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
        out[y * w + x] += amp * (a + (b - a) * ty);
      }
    }
    tot += amp;
  }
  return out.map((v) => v / tot);
}

// Bilinear lookup in the 64x128 noise tile.
function nz(T, x, y) {
  const xi = floor(x);
  const yi = floor(y);
  const fx = x - xi;
  const r0 = (yi & 127) * 64;
  const r1 = ((yi + 1) & 127) * 64;
  const a = T[r0 + (xi & 63)];
  const b = T[r0 + ((xi + 1) & 63)];
  const c = T[r1 + (xi & 63)];
  const d = T[r1 + ((xi + 1) & 63)];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * (y - yi);
}

// Everything that stands still, as albedo: the tiled wall and its periodic
// table, the gas tap and hose, the burner, the acid, the glasses, the labels.
function build(P) {
  const { alb, spec, G, benchM } = P;
  const put = (x, y, c, s) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = y * W + x;
    alb.set(c, p * 3);
    benchM[p] = 0;
    if (s !== undefined) spec[p] = s;
  };
  const at = (x, y) => alb.slice((y * W + x) * 3, (y * W + x) * 3 + 3);
  const text = (str, cx, top, ink) => {
    const gl = [...str].map((c) => FONT[c].split("/"));
    let x0 = cx - (gl.reduce((s, g) => s + g[0].length + 1, -1) >> 1);
    for (const g of gl) {
      for (let j = 0; j < 5; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === "1") put(x0 + i, top + j, ink);
      x0 += g[0].length + 1;
    }
  };
  const shade = Float32Array.from({ length: 256 }, rnd);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v;
      if (y < BENCH - 1) {
        const gx = (x + 5) % 11;
        const gy = (y + 7) % 11;
        v = gx === 10 || gy === 10 ? 0.36 : 0.45 + 0.05 * shade[(((x + 5) / 11) | 0) * 19 + (((y + 7) / 11) | 0) * 7 & 255] + 0.05 * (1 - (gx + gy) / 18) + (gx === 0 || gy === 0 ? 0.03 : 0);
        put(x, y, [v, v * 1.01, v * 1.03]);
      } else if (y === BENCH - 1) put(x, y, [0.06, 0.06, 0.07]);
      else if (y === BENCH) put(x, y, [0.3, 0.3, 0.32], 0.3);
      else if (y < 125) {
        v = 0.17 + 0.014 * rnd();
        put(x, y, [v, v, v * 1.08]);
        benchM[y * W + x] = 1;
      } else put(x, y, y === 125 ? [0.42, 0.42, 0.44] : [0.1, 0.1, 0.11], y === 125 ? 0.4 : 0);
      // The flame lights the room like a lamp along its height.
      const dx = x - FX;
      const dy = y < 22 ? 22 - y : y > 78 ? y - 78 : 0;
      G[y * W + x] = 1 / (1 + (dx * dx + dy * dy) / 480);
    }
  // A periodic table pinned to the tiles.
  for (let y = 3; y <= 27; y++) for (let x = 39; x <= 62; x++) put(x, y, [0.85, 0.84, 0.78]);
  for (let x = 42; x <= 59; x++) put(x, 5, [0.2, 0.2, 0.28]);
  const cell = (c, y, f) =>
    put(42 + c, y, f ? [0.55, 0.85, 0.8] : c === 0 ? (y === 8 ? [0.7, 0.7, 0.75] : [0.95, 0.35, 0.35]) : c === 1 ? [0.98, 0.62, 0.3] : c < 12 ? [0.95, 0.85, 0.35] : c < 17 ? (c - 12 > (y - 8) / 2 - 1 ? [0.45, 0.8, 0.5] : [0.45, 0.65, 0.95]) : [0.7, 0.5, 0.95]);
  for (let n = 1; n <= 7; n++) for (let c = 0; c < 18; c++) if (n > 3 || (n === 1 ? c === 0 || c === 17 : c < 2 || c > 11)) cell(c, 6 + 2 * n, false);
  for (let c = 3; c < 17; c++) cell(c, 23, true), cell(c, 25, true);
  // The heatproof mat the burner stands on.
  for (let y = 96; y <= 104; y++)
    for (let x = 7 - ((y - 96) >> 1); x <= 35 + ((y - 96) >> 1); x++) {
      const v = y === 104 ? 0.22 : y === 96 ? 0.42 : 0.5 + 0.04 * rnd();
      put(x, y, [v, v * 0.97, v * 0.92]);
    }
  // The gas tap on the wall, its lever, and the orange rubber hose to the burner.
  for (let y = 82; y <= 91; y++) for (let x = 0; x <= 3; x++) put(x, y, [0.4, 0.4, 0.42], x === 0 ? 0.3 : 0);
  for (let y = 86; y <= 89; y++) for (let x = 1; x <= 6; x++) put(x, y, y === 86 ? [0.9, 0.72, 0.2] : [0.62, 0.48, 0.2], y === 86 ? 0.5 : 0);
  for (let x = 7; x <= 9; x++) put(x, 88, [0.72, 0.56, 0.24]);
  for (let j = 0; j < 4; j++) put(4 + (j >> 1), 85 - j, [0.12, 0.12, 0.13]);
  for (let k = 0; k <= 80; k++) {
    const t = k / 80;
    const u = 1 - t;
    const bx = round(u * u * u * 9 + 3 * u * u * t * 17 + 3 * u * t * t * 2 + t * t * t * 10);
    const by = round(u * u * u * 88 + 3 * u * u * t * 94 + 3 * u * t * t * 106 + t * t * t * 101);
    put(bx, by, [0.88, 0.38, 0.14], 0.25);
    put(bx, by + 1, [0.6, 0.24, 0.08]);
  }
  // The burner: a heavy base, the gas inlet, the chrome barrel and its collar.
  const BW = [5, 6, 7, 7, 7];
  for (let j = 0; j < 5; j++)
    for (let x = FX - BW[j]; x <= FX + BW[j]; x++) {
      const v = j === 0 ? 0.42 : j === 4 ? 0.1 : 0.22 - 0.03 * j;
      put(x, 99 + j, [v, v, v * 1.15], j === 0 ? 0.5 : 0);
    }
  for (let x = FX - 7; x <= FX + 8; x++) put(x, 104, at(x, 104).map((v) => v * 0.55));
  for (let x = FX - 11; x < FX - 7; x++) put(x, 100, [0.78, 0.62, 0.3], 0.4), put(x, 101, [0.5, 0.38, 0.18]);
  const BC = [0.28, 0.75, 0.56, 0.38, 0.2];
  for (let y = 80; y <= 98; y++)
    for (let i = 0; i < 5; i++) {
      const v = BC[i] + (y === 80 ? 0.15 : 0);
      put(FX - 2 + i, y, [v, v, v * 1.06], i === 1 ? 0.6 : 0);
    }
  const CC = [0.25, 0.5, 0.8, 0.64, 0.46, 0.3, 0.18];
  for (let y = 89; y <= 95; y++)
    for (let i = 0; i < 7; i++) {
      const v = CC[i] * (y === 89 || y === 95 ? 0.75 : 1);
      put(FX - 3 + i, y, [v, v * 0.8, v * 0.42], i === 2 ? 0.5 : 0);
    }
  // A beaker of dilute hydrochloric acid to clean the loop in.
  for (let y = 75; y <= 101; y++)
    for (let x = 43; x <= 58; x++) {
      if (x === 43 && y > 76) continue;
      if (y === 75 || y === 101 || x === 44 || x === 58 || x === 43) {
        put(x, y, [0.5, 0.55, 0.6], x === 44 || y === 75 ? 0.8 : 0.4);
        continue;
      }
      let c = at(x, y).map((v, i) => v * [0.9, 0.94, 0.98][i]);
      if (y >= 85) c = c.map((v, i) => v * [0.62, 0.68, 0.7][i] + [0.08, 0.11, 0.14][i]);
      put(x, y, c, y === 85 ? 0.6 : x === 45 ? 0.3 : 0);
    }
  P.front = [];
  for (let y = 93; y <= 99; y++) for (let x = 46; x <= 56; x++) put(x, y, [0.88, 0.86, 0.78]), P.front.push(y * W + x);
  text("HCl", 51, 94, [0.07, 0.07, 0.1]);
  // The watch glasses, each with its heap of salt, and the tape with their names.
  for (let i = 0; i < 8; i++) {
    const c = 4 + 8 * i;
    for (let x = c - 3; x <= c + 3; x++) put(x, 112, at(x, 112).map((v) => v * 0.6));
    for (let dy = -2; dy <= 1; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const e = (dx / 3.7) ** 2 + ((dy + 0.5) / 2.1) ** 2;
        if (e < 1) put(c + dx, 110 + dy, e > 0.45 ? [0.5, 0.56, 0.6] : at(c + dx, 110 + dy).map((v) => v * 1.3 + 0.07), e > 0.45 && dy < 0 ? 0.9 : 0.3);
      }
    const k = SALTS[i][2];
    for (const [dx, y, s] of HEAP) put(c + dx, y, k.map((v) => v * s));
  }
  for (let y = 115; y <= 121; y++)
    for (let x = 0; x < W; x++) {
      const v = y === 115 || y === 121 ? 0.62 : 0.82;
      if (x % 8) put(x, y, [v, v * 0.97, v * 0.82]);
    }
  for (let i = 0; i < 8; i++) text(SALTS[i][0], 4 + 8 * i, 116, [0.06, 0.06, 0.09]);
}

export function setup(params) {
  const P = params;
  const F = (n) => new Float32Array(n);
  Object.assign(P, { alb: F(N * 3), spec: F(N), G: F(N), buf: F(N * 3), benchM: new Uint8Array(N), NT: noise(64, 128, 16, 3) });
  build(P);
  Object.assign(P, { started: false, t: 0, tf: 0, ph: 0, pt: 0, cur: 0, salt: 0, pick: 0, ks: 0, kd: 0, kc: SALTS[0][1], heat: 0, bead: 0, sput: 0, flare: 0, sp: [], hot: [], sAcc: 0, bAcc: 0, air: 0.5, room: 0, from: FP, pos: FP, m: 1 });
}

// Kind 0 is a grain carried up the flame in the salt's colour, kind 1 a grain
// spat out of the loop that glows as it falls, kind 2 a bubble in the acid.
function spark(P, k) {
  if (P.sp.length >= 160) return;
  P.sp.push({
    k,
    x: P.pos[0] + (rnd() - 0.5) * 2.5,
    y: P.pos[1] + (rnd() - 0.5) * 2,
    vx: (rnd() - 0.5) * [14, 60, 2][k],
    vy: -[25 + 45 * rnd(), 10 + 35 * rnd(), 7 + 6 * rnd()][k],
    a: 0,
    l: [0.25 + 0.55 * rnd(), 0.4 + 0.6 * rnd(), 2][k],
    c: P.kc.map((v) => v * 0.6 + 100),
  });
}

function enter(P) {
  const ph = P.ph;
  P.from = P.pos;
  if (ph === 5) P.cur = P.pick ? P.pick - 1 : (P.cur + 1) % 8;
  if (ph === 7) P.bead = 1;
  if (ph === 0) {
    P.salt = P.cur;
    P.kc = SALTS[P.cur][1];
    for (let i = 0; i < 16; i++) spark(P, i & 1);
  }
  // Even a clean loop shows a flash of sodium from the acid and the fingers.
  if (ph === 4) P.kc = SALTS[1][1];
}

function step(P, h) {
  P.t += h;
  P.pt += h;
  while (P.pt >= DUR[P.ph]) {
    P.pt -= DUR[P.ph];
    P.ph = (P.ph + 1) % 8;
    enter(P);
  }
  const ph = P.ph;
  const s = P.pt / DUR[ph];
  const e = sm(0, 1, s);
  const dip = sm(0, 0.35, s) * sm(1, 0.62, s);
  let pos;
  if (ph === 0 || ph === 4) pos = [FP[0] + 0.5 * sin(P.t * 1.3), FP[1] + 0.5 * sin(P.t * 1.9 + 1), FP[2]];
  else if (ph === 2 || ph === 6) {
    pos = ph === 2 ? mix3(AT, AD, dip) : mix3(ST(P.cur), SD(P.cur), dip);
    pos[0] += sin(s * 19) * 0.7 * dip;
  } else {
    pos = mix3(P.from, ph === 1 ? AT : ph === 5 ? ST(P.cur) : FP, e);
    pos[1] -= 5 * sin(PI * e);
  }
  P.pos = pos;
  const inF = ph === 0 || ph === 4;
  const wet = ph === 2 && dip > 0.6;
  P.heat += ((inF ? 1 : 0) - P.heat) * (1 - exp(-h / (inF ? 0.35 : wet ? 0.07 : 0.9)));
  if (ph === 0) P.bead = max(0, 1 - P.pt / 0.9);

  // The salt's colour: a burst as the loop goes in, a while at full, then a fade.
  const S = SALTS[P.salt];
  let tgt = 0;
  P.sput = 0;
  if (ph === 0) {
    tgt = S[4] * (P.pt < 1.3 ? sm(0, 0.18, P.pt) : exp(-(P.pt - 1.3) / S[3]));
    P.sput = S[4] * (exp(-P.pt / 0.9) + 0.3 * exp(-P.pt / 2.5));
  } else if (ph === 4) {
    tgt = 0.85 * sm(0, 0.15, P.pt) * exp(-P.pt / 0.5);
    P.sput = 0.5 * exp(-P.pt / 0.35);
  }
  P.ks += (tgt - P.ks) * (1 - exp(-h / (tgt > P.ks ? 0.06 : 0.22)));
  P.flare *= exp(-h / 0.15);
  P.kd = P.ks * (0.78 + 0.3 * nz(P.NT, P.t * 9, 40.5)) + P.flare;
  // Grains crackle off the loop, now and then a whole crust at once.
  if (P.sput > 0.02) {
    P.sAcc += 40 * P.sput * h;
    for (; P.sAcc >= 1; P.sAcc--) spark(P, rnd() < 0.7 ? 0 : 1);
    if (rnd() < 3 * P.sput * h) {
      P.flare += 0.3 * P.ks;
      for (let i = 0; i < 8; i++) spark(P, i % 3 ? 0 : 1);
    }
  }
  if (wet) for (P.bAcc += 22 * h; P.bAcc >= 1; P.bAcc--) spark(P, 2);
  P.sp = P.sp.filter((p) => {
    p.a += h;
    if (p.k === 0) {
      p.vy -= 30 * h;
      p.vx *= exp(-2 * h);
    } else if (p.k === 1) p.vy += 90 * h;
    p.x += p.vx * h;
    p.y += p.vy * h;
    return p.a < p.l && !(p.k === 2 && p.y < 85.5) && p.x >= 0 && p.x <= 63 && p.y >= 0 && p.y <= 124;
  });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt, 0, 0.1);
  P.pick = cl(round(k[0]), 0, 8);
  P.m = cl(k[1], 0.2, 3) / 2;
  const room = cl(k[2], 0, 1);
  const air = (cl(k[3], -1, 1) + 1) / 2;
  if (!P.started) {
    P.started = true;
    P.air = air;
    P.room = room;
    P.cur = P.pick ? P.pick - 1 : 0;
    enter(P);
    // Open a moment after the first salt went into the flame.
    for (let i = 0; i < 8; i++) step(P, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0] && P.ph < 5) {
    P.ph = 5;
    P.pt = 0;
    enter(P);
  }
  P.air += (air - P.air) * (1 - exp(-dt / 0.25));
  P.room += (room - P.room) * (1 - exp(-dt / 0.12));
  P.tf += dt * (0.3 + 0.7 * P.m);
  step(P, dt * P.m);
}

// The holder: the wire loop, the nichrome wire, the aluminium handle, the
// hand round it and the white sleeve of a lab coat. The loop and the first
// few LEDs of wire are kept to glow when hot.
function holder(P, light) {
  const [lx, ly, th] = P.pos;
  const ux = cos(th);
  const uy = -sin(th);
  P.hot = [];
  for (let y = max(0, floor(ly + 100 * uy - 7)); y <= min(H - 1, ceil(ly + 7)); y++)
    for (let x = max(0, floor(lx - 3)); x < W; x++) {
      const dx = x - lx;
      const dy = y - ly;
      const s = dx * ux + dy * uy;
      const q = dx * uy - dy * ux;
      if (s < -2.5 || abs(q) > 6.2) continue;
      let c = null;
      const hand = ((s - 31) / 4.3) ** 2 + ((q + 0.3) / 3.7) ** 2;
      if (((s - 27.5) / 2.6) ** 2 + ((q - 2.5) / 1.3) ** 2 < 1) c = [1, 0.78, 0.64];
      else if (hand < 1) {
        // Curled fingers under the handle, the knuckles above it.
        const k = 0.84 + 0.07 * q - (q < -0.8 && abs(((s - 29.5) % 2) - 1) < 0.45 ? 0.22 : 0);
        c = [k, 0.72 * k, 0.58 * k];
      } else if (s > 34 && s < 37.5 && abs(q + 0.5) < 3) c = [0.88, 0.62, 0.5];
      else if (s >= 37 && abs(q + 0.6) < 5.4) {
        const k = (s < 39 ? 0.74 : 0.9) + 0.03 * q;
        c = [0.88 * k, 0.89 * k, 0.92 * k];
      } else if (s >= 9 && s < 30 && q > -1 && q < 0.6) c = q > -0.2 ? [0.66, 0.68, 0.74] : [0.36, 0.37, 0.42];
      else if ((s >= 1 && s < 9 && abs(q) < 0.6) || (s < 1.8 && abs(hypot(dx, dy) - 1.25) < 0.55)) {
        c = [0.55, 0.55, 0.52];
        if (s < 5) P.hot.push(y * W + x, 1 - max(0, s) / 6);
      }
      if (c) light(y * W + x, c);
    }
}

function flame(P) {
  const { buf, NT, kd, kc } = P;
  const a = P.air;
  const t = P.tf;
  const k1 = min(1, kd);
  const Yf = sm(0.5, 0.06, a);
  const Rf = sm(0.6, 1, a);
  const Cf = sm(0.12, 0.6, a);
  const bl = sm(0.06, 0.5, a);
  const fl = 1 + (0.06 * sin(t * 7.3) + 0.05 * sin(t * 12.9 + 1)) * (1 + Yf);
  const Hf = mix(mix(76, 58, bl), 47, Rf) * (1 + 0.2 * k1) * fl;
  const Wm = mix(8.5, 6.4, bl) - Rf + 1.6 * k1;
  const Hi = mix(7, 15, sm(0.15, 1, a));
  const A = mix(5, 2, bl) * (1 - 0.6 * Rf);
  const ws = mix(4.5, 6.5, a) + 7 * Rf;
  const vs = mix(30, 46, a) + 40 * Rf;
  const tn = mix(0.75, 0.5, a);
  const [lx, ly] = P.pos;
  const inF = P.heat > 0.5;
  const salt = 1 - 0.8 * Yf;
  for (let y = max(0, floor(MOUTH - Hf * 1.3)); y <= MOUTH; y++) {
    const hg = MOUTH + 1 - y;
    const v = hg / Hf;
    const cx = FX + A * v ** 1.4 * sin(0.11 * hg - ws * t) + 0.45 * A * v * sin(0.23 * hg - 1.7 * ws * t + 2);
    const hw = max(0.7, (2.6 + (Wm - 2.6) * sm(0, 0.3, v)) * sqrt(max(0, 1.05 - v)));
    const yw = Yf * sm(2, 9, hg);
    const ri = 2.5 * max(0, 1 - hg / Hi) ** 0.8 + 0.25;
    const cxi = FX + 0.35 * sin(t * 9 + hg * 0.3) * (1 - Rf);
    const above = sm(ly + 5, ly - 2, y);
    for (let x = max(0, floor(cx - hw * 1.7 - 3)); x <= min(W - 1, ceil(cx + hw * 1.7 + 3)); x++) {
      const n = nz(NT, x * 1.1 + 7, y * 0.55 + t * vs * 0.55);
      const d2 = abs(x - cx) / hw + (n - 0.5) * tn * (0.25 + v);
      const O = sm(1.12, 0.55, d2) * sm(1, 0.72, v + (n - 0.5) * 0.45 * v);
      let r = 0;
      let g = 0;
      let b = 0;
      // The outer flame: pale blue, or yellow with soot when the collar is shut.
      if (O > 0.002) {
        const ob = O * (0.62 + 0.38 * (1 - v)) * (0.85 + 0.25 * n) * (0.8 + 0.25 * Rf);
        const core = sm(0.85, 0.2, d2) * (1 - 0.5 * v);
        const lum = O * (0.75 + 0.35 * n);
        r = mix(58 * ob, 255 * lum, yw);
        g = mix(98 * ob, lum * (95 + 150 * core - 60 * v), yw);
        b = mix(225 * ob, O * (10 + 120 * core * core), yw);
      }
      // The inner cone, brightest along its surface.
      if (hg < Hi + 1) {
        const di = abs(x - cxi);
        const C = sm(ri + 0.75, ri - 0.35, di) * Cf * (0.92 + 0.08 * sin(t * 61 + hg));
        if (C > 0) {
          const rim = sm(ri - 1.3, ri - 0.3, di);
          r += (60 + 100 * rim) * C;
          g += (140 + 100 * rim) * C;
          b += 255 * C;
        }
      }
      // The salt's colour rises from the loop and fills the flame above it in tongues.
      let ps = 0;
      if (kd > 0.01) {
        const n2 = nz(NT, x * 1.6 + 31, y * 0.8 + t * vs * 0.9 + 53);
        ps = kd * salt * (O * above * (0.4 + 0.95 * n2) + (inF ? 0.9 * exp(-((x - lx) ** 2 + (y - ly) ** 2) / 10) : 0));
        const q = max(0, 1 - 1.4 * ps);
        r = r * q + kc[0] * ps;
        g = g * q + kc[1] * ps;
        b = b * q + kc[2] * ps;
      }
      if (r + g + b < 1) continue;
      const o = (y * W + x) * 3;
      const dim = 1 - 0.4 * min(1, O + 0.5 * ps);
      buf[o] = buf[o] * dim + r;
      buf[o + 1] = buf[o + 1] * dim + g;
      buf[o + 2] = buf[o + 2] * dim + b;
    }
  }
}

export function draw(display, params) {
  const P = params;
  if (!P.started) return;
  const { buf, alb, spec, G, benchM, kc } = P;
  const a = P.air;
  const Yf = sm(0.5, 0.06, a);
  const k1 = min(1.3, P.kd) * (1 - 0.8 * Yf);
  const fl = 0.9 + 0.1 * nz(P.NT, P.tf * 11, 70.5) + 0.12 * Yf * sin(P.tf * 9);
  // The flame's own colour, which lights the room.
  const FC = [0, 1, 2].map((i) => (mix([58, 98, 225][i] * 0.85, [255, 165, 40][i], Yf) * (1 - 0.8 * min(1, k1)) + kc[i] * k1) * fl);
  const [gr, gg, gb] = FC.map((v) => v * (0.52 + 0.3 * Yf));
  const A = 150 * (1 - P.room) ** 1.3 + 1.5;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const g = G[p];
    const s = spec[p];
    buf[o] = alb[o] * (A + gr * g) + s * (0.3 * A + 1.4 * gr * g);
    buf[o + 1] = alb[o + 1] * (A + gg * g) + s * (0.3 * A + 1.4 * gg * g);
    buf[o + 2] = alb[o + 2] * (A * 0.95 + gb * g) + s * (0.3 * A + 1.4 * gb * g);
  }
  const add = (p, c, f) => {
    for (let i = 0; i < 3; i++) buf[p * 3 + i] += c[i] * f;
  };
  // The glossy bench: the ceiling lights along its back and the flame under the burner.
  for (let x = 0; x < W; x++) for (const [y, k] of [[96, 0.22], [97, 0.12]]) if (benchM[y * W + x]) add(y * W + x, [A, A, A], k);
  const sway = 1.5 * sin(P.tf * 4.1);
  for (let y = 105; y <= 124; y++) {
    const w = 2 + (y - 105) * 0.22;
    const k = 0.34 * exp(-(y - 105) / 7);
    for (let x = max(0, floor(FX - 3 * w)); x <= min(W - 1, ceil(FX + 3 * w)); x++)
      if (benchM[y * W + x]) add(y * W + x, FC, k * exp(-(((x - FX - (sway * (y - 105)) / 20) / w) ** 2)));
  }
  const light = (p, c) => {
    const g = G[p];
    buf[p * 3] = c[0] * (A + gr * g);
    buf[p * 3 + 1] = c[1] * (A + gg * g);
    buf[p * 3 + 2] = c[2] * (A * 0.95 + gb * g);
  };
  // The air hole in the collar opens as the collar turns.
  const hole = round(4 * a);
  for (let y = 91; y <= 93; y++) for (let x = FX - (hole >> 1); x < FX - (hole >> 1) + hole; x++) light(y * W + x, [0.03, 0.03, 0.03]);
  for (const p of P.sp) if (p.k === 2) light(round(p.y) * W + round(p.x), [0.7, 0.75, 0.8]);
  holder(P, light);
  // The label on the beaker hides the loop behind it.
  if (P.ph >= 1 && P.ph <= 3) for (const p of P.front) light(p, alb.subarray(p * 3, p * 3 + 3));
  flame(P);
  for (const p of P.sp) {
    const f = 1 - p.a / p.l;
    if (p.k < 2) add(round(p.y) * W + round(p.x), p.k ? [255 * sqrt(f), 210 * f * f, 120 * f * f * f] : p.c, p.k ? 1 : f);
  }
  // The loop glows red hot in the flame; the salt on it shows until it melts.
  const ht = P.heat;
  if (ht > 0.02) for (let i = 0; i < P.hot.length; i += 2) add(P.hot[i], [255, 70 + 90 * ht, 25 * ht], ht * P.hot[i + 1]);
  if (P.bead > 0.05) {
    const c = SALTS[P.cur][2];
    const p = round(P.pos[1]) * W + round(P.pos[0]);
    for (let i = 0; i < 3; i++) buf[p * 3 + i] = mix(buf[p * 3 + i], c[i] * (A + 60) + [180, 140, 90][i] * ht, P.bead);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
}
