// ===== Patternflow pattern =====
// Title:   High Striker
// Family:  fair
// Idea:    A high striker stands the full height of a night fair: players from a queue take turns swinging a mallet onto the pad, the puck flies up the rail under real gravity lighting the scale it passes and falls back, and a hit hard enough rings the brass bell at the top, so the tower's bulbs flash and the sky lights up.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20, after the strength-tester towers of fairgrounds and seaside piers
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Bulbs=0..1, Speed=0.2..3, Strength=60..130, Gravity=-1..1
//
// Knob 1: Bulbs. Turns the bulbs up both edges of the tower round the colour wheel, with the light they throw on the striped posts and the night round the tower, starting from gold.
// Knob 2: Speed. How fast the fair runs: at 2 everything moves in real time, a full flight to the bell takes 1.26 s each way; at 0.2 it is ten times slower, at 3 half as fast again.
// Knob 3: Strength. How hard the players hit on average, as the share of the run to the bell an average swing sends the puck: 60% at the minimum, where an average grown-up just lights FAIR, to 130%, where nearly every grown-up rings the bell. Children hit softer and the strongman harder.
// Knob 4: Gravity. The pull on the puck, from 0.57 g at -1 through Earth's at the middle to 1.74 g at 1: the same swing sends it higher and slower, or lower and quicker.
// Buttons: K1 tap makes the next swing a big one that rings the bell, at once if the player is already lifting the mallet.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, abs, round, floor, sin, cos, exp, sqrt, atan2, hypot, asin } = Math;
const rnd = () => Math.random();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => ((x = clamp(x, 0, 1)), x * x * (3 - 2 * x));

// The tower. Striped posts on columns 34..36 and 49..51 hold a crossbar on rows
// 2..4, and the bell hangs from it with its mouth on row 13. The board between
// the posts carries the rail on columns 42 and 43 with the scale either side.
const PL = 34;
const PR = 49;
const CX = 42.5;
const LIP = 13;
// The puck's top row when it rests on the lever, and how far it climbs to the bell.
const REST = 106;
const RUN = REST - LIP - 1;
const NSEG = 22;
const BULBS = 26;
const GROUND = 117;
// The player swings from column 11 onto the rubber of the pad, columns 20..27.
const SPOT = 11;
const PADX = 24;
const PADY = 110;
// One row is 8.5 cm: a player of 20 rows stands 1.7 m, the run to the bell is 7.8 m.
const ROW = 0.085;
const G0 = 9.81 / ROW;
const [WALK, LIFT, AIM, SWING, WATCH, LOWER] = [0, 1, 2, 3, 4, 5];
const DUR = [0, 0.8, 0.35, 0.16, 0, 0.45];
// The mallet held up behind the head, 120 degrees above the horizontal.
const A_BACK = -2.1;
// Words beside the scale in a 3x5 font, one number a row, and the segment each sits at.
const FONT = { B: [6, 5, 6, 5, 6], Y: [5, 5, 2, 2, 2], E: [7, 4, 6, 4, 7], A: [2, 5, 7, 5, 5], F: [7, 4, 6, 4, 4], I: [7, 2, 2, 2, 7], R: [6, 5, 6, 5, 5], G: [3, 4, 5, 5, 3], O: [2, 5, 5, 5, 2], D: [6, 5, 5, 5, 6], H: [5, 5, 7, 5, 5] };
const WORDS = [["BABY", 9], ["FAIR", 13], ["GOOD", 17], ["HERO", 21]];
const SHIRTS = [[60, 110, 210], [210, 60, 70], [235, 205, 70], [60, 175, 110], [175, 80, 195], [235, 135, 50], [225, 225, 230], [50, 165, 185]];
const SKINS = [[225, 172, 132], [165, 112, 76], [240, 200, 166], [125, 84, 58]];
const HAIRS = [[34, 22, 16], [96, 58, 26], [205, 165, 84], [18, 18, 24], [150, 150, 156]];
const PANTS = [[44, 58, 120], [56, 56, 66], [96, 74, 52], [34, 34, 46]];
const GLOW = [[1, 0, 0.34], [-1, 0, 0.34], [0, 1, 0.34], [0, -1, 0.34], [1, 1, 0.14], [-1, 1, 0.14], [1, -1, 0.14], [-1, -1, 0.14], [2, 0, 0.06], [-2, 0, 0.06], [0, 2, 0.06], [0, -2, 0.06]];
const FESTOON = [[255, 90, 70], [255, 205, 90], [90, 210, 120], [100, 150, 255]];
const FLAGS = [[190, 40, 52], [225, 185, 60], [50, 110, 205], [60, 165, 95], [230, 228, 218]];

function hsv(h, s, v) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 255 * v * (1 - s * max(0, min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

const segTop = (i) => REST - 4 * i;
const segH = (i) => 4 * i + 2;
const bulbY = (i) => 7 + 4 * i;

// Three kinds of player: a child (0), a grown-up (1) and a strongman in a singlet
// (2), each with the share of the average swing they put into the mallet.
function newPlayer(x, kind = rnd() < 0.2 ? 0 : rnd() < 0.75 ? 1 : 2) {
  const pick = (a) => a[floor(rnd() * a.length)];
  const h = [15, 20, 23][kind] + floor(rnd() * (kind === 1 ? 4 : 2));
  const p = [0.55, 0.8, 1.75][kind] + rnd() * [0.2, 0.4, 0.3][kind];
  return { x, h, kind, shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIRS), pants: pick(PANTS), p, walk: rnd() * 6, moving: false };
}

// The fair behind the game, painted once: sky, stalls, ground and the tower's wood.
function paint(P) {
  const S = P.bg;
  const set = (x, y, c, k = 1) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    S[o] = c[0] * k;
    S[o + 1] = c[1] * k;
    S[o + 2] = c[2] * k;
  };
  const box = (x0, y0, x1, y1, c, k) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c, k);
  };
  for (let y = 0; y < H; y++) {
    const u = clamp(y / 114, 0, 1);
    for (let x = 0; x < W; x++) set(x, y, [3 + 32 * u ** 2.4 + rnd() * 2, 3 + 12 * u ** 2.2, 13 + 30 * u ** 1.6 + rnd() * 2]);
  }
  for (let n = 0; n < 30; n++) {
    const x = floor(rnd() * W);
    const y = floor(rnd() * 62);
    if (x < 31 || x > 54) set(x, y, [60, 60, 76], 0.4 + rnd() * 0.6);
  }
  for (let y = 28; y <= 36; y++)
    for (let x = 1; x <= 10; x++) {
      const d = hypot(x - 5, y - 32);
      if (d < 3.6 && hypot(x - 6.6, y - 31) > 3) set(x, y, [205, 205, 176], d > 2.8 ? 0.6 : 1);
    }
  // Two stalls: a prize booth behind the queue and a hot-dog stand behind the crowd.
  // Their lit windows sit over the heads, so the people stand against dark boards.
  for (const [x0, x1, awn, win] of [[0, 15, [30, 125, 135], [104, 116, 138]], [55, 63, [125, 50, 155], [150, 104, 46]]]) {
    box(x0, 82, x1, 116, [26, 18, 18]);
    for (let x = x0 + 2; x < x1; x += 4) box(x, 93, x, 116, [20, 14, 14]);
    box(x0 + 1, 83, x1 - 1, 90, win);
    box(x0 + 1, 91, x1 - 1, 92, [110, 60, 32]);
    for (let x = x0; x <= x1; x++) for (let y = 77; y <= 81; y++) set(x, y, floor((x - x0) / 3) % 2 ? [215, 205, 175] : awn, y === 77 ? 0.7 : 1);
    for (let x = x0; x <= x1; x += 2) set(x, 82, floor((x - x0) / 3) % 2 ? [215, 205, 175] : awn, 0.8);
  }
  for (const [x, c] of [[3, [205, 95, 150]], [7, [90, 150, 225]], [11, [235, 205, 85]]]) box(x - 1, 85, x + 1, 87, c, 0.85);
  box(57, 86, 61, 87, [200, 120, 70]);
  box(0, GROUND, 63, H - 1, [30, 22, 18]);
  box(0, GROUND, 63, GROUND, [46, 34, 26]);
  for (let n = 0; n < 160; n++) set(floor(rnd() * W), GROUND + 1 + floor(rnd() * 10), [44, 32, 24], 0.7 + rnd() * 0.5);
  // The posts, striped like a barber's pole and rounded by shade.
  for (let y = 2; y <= 109; y++)
    for (let c = 0; c < 3; c++) {
      const sh = [0.68, 1, 0.82][c];
      set(PL + c, y, floor((y + 40 - c * 1.5) / 4) % 2 ? [225, 205, 165] : [180, 26, 36], sh);
      set(PR + c, y, floor((y + 40 - (2 - c) * 1.5) / 4) % 2 ? [225, 205, 165] : [180, 26, 36], sh);
    }
  box(PL + 3, 5, PR - 1, 109, [14, 16, 42]);
  box(PL + 3, 5, PL + 3, 109, [28, 30, 64]);
  box(PR - 1, 5, PR - 1, 109, [28, 30, 64]);
  box(33, 2, 52, 4, [150, 24, 30]);
  box(33, 2, 52, 2, [205, 155, 64]);
  box(33, 4, 52, 4, [120, 86, 36]);
  for (const x of [34, 50]) box(x, 0, x + 1, 1, [215, 170, 70]);
  // The rail with its stop under the bell.
  for (let y = 14; y <= 109; y++) {
    set(42, y, [130, 134, 150]);
    set(43, y, [70, 74, 90]);
  }
  box(40, 14, 45, 14, [90, 92, 104]);
  // The base and its lever out to the pad.
  box(30, 110, 55, 116, [100, 22, 28]);
  box(30, 110, 55, 110, [195, 145, 62]);
  box(30, 116, 55, 116, [50, 12, 16]);
  for (let x = 32; x <= 53; x += 3) set(x, 113, [195, 145, 62], 0.8);
  box(28, 112, 30, 113, [70, 70, 78]);
  box(19, 111, 28, 116, [44, 44, 52]);
  box(19, 111, 28, 111, [80, 80, 92]);
  // The light of the bulbs over the sky, the posts and the ground, and the wide
  // flash of a ring round the bell.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const d = min(abs(x - 33), abs(x - 52));
      const v = smooth((y - 1) / 8) * smooth((118 - y) / 10);
      let g = v * (0.26 * exp(-(d * d) / 30) + 0.08 * exp(-d / 14));
      if (y >= GROUND - 6) {
        const dx = (x - CX) / 20;
        g += 0.14 * exp(-dx * dx) * exp(-abs(y - GROUND) / 6);
      }
      P.glowM[p] = g;
      P.flashM[p] = 0.55 * exp(-hypot(x - CX, (y - 10) * 0.8) / 24) + 0.07;
    }
}

// Where the active player's shoulder is, and the mallet's reach and angles from it.
function grip(P, A) {
  const sx = round(A.x) + 0.5;
  const sy = GROUND - A.h + 5;
  const tx = PADX - sx;
  const ty = PADY - 2 - sy;
  P.mS = [sx, sy];
  P.mL = hypot(tx, ty);
  P.aHit = atan2(ty, tx);
  P.aRest = asin(clamp((GROUND - 2 - sy) / P.mL, -1, 1));
}

// The swing lands: the pad gives, and the puck leaves the lever at the speed
// the swing gave it. Gravity alone decides how high that is.
function strike(P) {
  const A = P.q[0];
  const f = P.big ? 1.35 * (P.g / G0) : (P.str / 100) * A.p * (0.9 + 0.2 * rnd());
  P.big = false;
  Object.assign(P, { vel: sqrt(2 * G0 * f * RUN), hgt: 0, fly: true, peak: 0, lit: 0, padDip: 1, hitT: 0, restT: 0 });
}

function ring(P, v) {
  P.ringT = 0;
  P.ringA = clamp(0.65 + v / 150, 0.65, 1);
  for (let n = 0; n < 26; n++) {
    const a = rnd() * 6.283;
    const s = 22 + rnd() * 40;
    P.sparks.push([CX + cos(a) * 3, 10 + sin(a) * 2, cos(a) * s, sin(a) * s * 0.8 - 12, 0.8 + rnd() * 0.7]);
  }
}

function puck(P, h) {
  if (!P.fly) {
    P.restT += h;
    if (P.restT > 1.4) P.lit = max(0, P.lit - 26 * h);
    return;
  }
  const g = P.g;
  const h0 = P.hgt;
  const v0 = P.vel;
  let y = h0 + v0 * h - 0.5 * g * h * h;
  P.vel = v0 - g * h;
  if (y >= RUN) {
    const hit = sqrt(max(0, v0 * v0 - 2 * g * (RUN - h0)));
    y = RUN;
    P.vel = -0.3 * hit;
    ring(P, hit);
  }
  if (y <= 0 && P.vel < 0) {
    y = 0;
    if (P.vel < -40) P.vel *= -0.24;
    else Object.assign(P, { vel: 0, fly: false, restT: 0 });
  }
  P.hgt = y;
  P.peak = max(P.peak, y);
  let n = 0;
  while (n < NSEG && segH(n) <= P.peak) n++;
  P.lit = max(P.lit, n);
}

function walkTo(F, target, v, h) {
  const d = target - F.x;
  F.moving = abs(d) > 0.05;
  if (!F.moving) return true;
  F.x += clamp(d, -v * h, v * h);
  F.walk += h * 10;
  return false;
}

function tick(P, h) {
  P.t += h;
  P.pt += h;
  P.chase += h * 5;
  P.aPrev = P.a;
  const A = P.q[0];
  const ph = P.ph;
  if (ph === WALK) {
    if (walkTo(A, SPOT, 16, h)) {
      grip(P, A);
      P.a = P.aPrev = P.aRest;
      Object.assign(P, { ph: LIFT, pt: 0 });
    }
  } else if (ph === LIFT) P.a = P.aRest + (A_BACK - P.aRest) * smooth(P.pt / DUR[LIFT]);
  else if (ph === AIM) P.a = A_BACK + 0.05 * sin(P.pt * 18);
  else if (ph === SWING) {
    const u = min(1, P.pt / DUR[SWING]);
    P.a = A_BACK + (P.aHit - A_BACK) * u * u;
    if (u >= 1) {
      strike(P);
      Object.assign(P, { ph: WATCH, pt: 0 });
    }
  } else if (ph === WATCH) {
    P.a = P.aHit - 0.22 * max(0, sin(min(P.pt, 0.3) * 10.5)) * exp(-P.pt * 4);
    if (!P.fly && P.restT > 0.45) Object.assign(P, { ph: LOWER, pt: 0 });
  } else if (ph === LOWER) {
    P.a = P.aHit + (P.aRest - P.aHit) * smooth(P.pt / DUR[LOWER]);
    if (P.pt >= DUR[LOWER]) {
      P.leavers.push(P.q.shift());
      P.q.push(newPlayer(P.q[P.q.length - 1].x - 7 - rnd() * 3));
      Object.assign(P, { ph: WALK, pt: 0 });
    }
  }
  if ((ph === LIFT || ph === AIM) && P.pt >= DUR[ph]) Object.assign(P, { ph: ph + 1, pt: 0 });
  for (let i = 1; i < P.q.length; i++) walkTo(P.q[i], min(P.q[i - 1].x - 7, SPOT - 7 * i), 16, h);
  for (const F of P.leavers) walkTo(F, 99, 16, h);
  P.leavers = P.leavers.filter((F) => F.x < 72);
  puck(P, h);
  P.ringT += h;
  P.hitT += h;
  P.padDip = max(0, P.padDip - h * 8);
  for (const s of P.sparks) {
    s[2] *= 1 - 1.2 * h;
    s[3] += 60 * h;
    s[0] += s[2] * h;
    s[1] += s[3] * h;
    s[4] -= h;
  }
  P.sparks = P.sparks.filter((s) => s[4] > 0);
}

export function setup(params) {
  const P = params;
  const F = (n) => new Float32Array(n);
  Object.assign(P, { buf: F(N * 3), bg: F(N * 3), glowM: F(N), flashM: F(N), bl: F(BULBS + 6) });
  paint(P);
  // The queue opens with a grown-up at the pad, a strongman behind and then a child.
  P.q = [1, 2, 0, undefined].map((kind, i) => newPlayer(SPOT - 7 * i, kind));
  P.crowd = [newPlayer(57, 1), newPlayer(62, 1)];
  P.segCol = Array.from({ length: NSEG }, (_, i) => hsv(0.36 - (0.37 * i) / (NSEG - 1), 0.85, 1));
  Object.assign(P, { t: 0, ph: LIFT, pt: 0.2, hgt: 0, vel: 0, fly: false, peak: 0, lit: 0, restT: 9, ringT: 9, ringA: 0 });
  Object.assign(P, { padDip: 0, hitT: 9, big: false, chase: 0, leavers: [], sparks: [], speed: 1, str: 60, g: G0, col: [255, 196, 71], prevY: REST });
  grip(P, P.q[0]);
  P.a = P.aPrev = P.aRest + (A_BACK - P.aRest) * smooth(0.2 / DUR[LIFT]);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 60, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.col = hsv(0.115 + clamp(k[0], 0, 1), 0.72, 1);
  P.speed = clamp(k[1], 0.2, 3) / 2;
  P.str = clamp(k[2], 60, 130);
  P.g = G0 * 2 ** (0.8 * clamp(k[3], -1, 1));
  if (input.btnPressed && input.btnPressed[0]) {
    P.big = true;
    if (P.ph === LIFT || P.ph === AIM) Object.assign(P, { ph: SWING, pt: 0 });
  }
  P.prevY = REST - P.hgt;
  const h = dt * P.speed;
  const steps = Math.ceil(h / 0.02);
  for (let i = 0; i < steps; i++) tick(P, h / steps);
}

function put(P, x, y, c, k = 1) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  P.buf[o] = c[0] * k;
  P.buf[o + 1] = c[1] * k;
  P.buf[o + 2] = c[2] * k;
}

function add(P, x, y, c, k) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  P.buf[o] += c[0] * k;
  P.buf[o + 1] += c[1] * k;
  P.buf[o + 2] += c[2] * k;
}

function base(P, gl, fl) {
  const { buf, bg, glowM, flashM, col } = P;
  const [r, g, b] = col;
  const fr = (r + 255) * 0.5 * fl;
  const fg = (g + 255) * 0.5 * fl;
  const fb = (b + 255) * 0.5 * fl;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const k = glowM[p] * gl;
    const f = flashM[p];
    buf[o] = bg[o] + r * k + fr * f;
    buf[o + 1] = bg[o + 1] + g * k + fg * f;
    buf[o + 2] = bg[o + 2] + b * k + fb * f;
  }
}

function scale(P) {
  const ring = P.ringT < 1.4 && floor(P.ringT * 8) % 2 === 0;
  const top = P.fly || P.lit < 1 ? -1 : floor(P.lit - 0.001);
  const blink = floor(P.t * 6) % 2 === 0;
  for (let i = 0; i < NSEG; i++) {
    const c = P.segCol[i];
    const on = ring || i < P.lit - 0.5;
    const k = on ? (i === top && blink ? 0.45 : 1) : 0.17;
    for (let r = 0; r < 3; r++)
      for (let x = 38; x <= 47; x++) if (x < 42 || x > 43) put(P, x, segTop(i) + r, c, k * (r === 2 ? 0.72 : 1) * (x === 38 || x === 47 ? 0.8 : 1));
  }
  for (const [w, i] of WORDS) {
    const on = ring || i < P.lit - 0.5;
    const c = on ? P.segCol[i].map((v) => v * 0.7 + 76) : [62, 50, 40];
    for (let n = 0; n < 4; n++)
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if ((FONT[w[n]][y] >> (2 - x)) & 1) put(P, 14 + n * 4 + x, segTop(i) - 1 + y, c);
  }
}

function drawPuck(P) {
  const y = REST - P.hgt;
  const y0 = P.prevY;
  if (abs(y - y0) > 1.5) {
    const n = abs(y - y0);
    for (let s = 1; s < n; s++) {
      const k = 0.7 * (1 - s / n);
      const yy = y + Math.sign(y0 - y) * s + 1;
      add(P, 42, yy, [150, 170, 255], k);
      add(P, 43, yy, [150, 170, 255], k);
    }
  }
  const yi = round(y);
  for (let x = 41; x <= 44; x++) {
    const e = x === 41 || x === 44 ? 0.8 : 1;
    put(P, x, yi, [250, 250, 255], e);
    put(P, x, yi + 1, [205, 212, 230], e);
    put(P, x, yi + 2, [110, 116, 136], e);
  }
}

function bell(P) {
  const s = P.ringT < 1.6 ? round(sin(P.ringT * 42) * 1.3 * exp(-P.ringT * 2.2)) : 0;
  const fl = P.ringT < 1 ? exp(-P.ringT * 4) * P.ringA : 0;
  const HW = [1.5, 3, 4, 4.5, 5, 5.5, 5.5, 6];
  put(P, CX - 0.5, 5, [60, 60, 70]);
  put(P, CX + 0.5, 5, [60, 60, 70]);
  for (let r = 0; r < 8; r++) {
    const y = 6 + r;
    const hw = HW[r];
    for (let x = floor(CX - hw); x < CX + hw; x++) {
      const u = (x + 0.5 - CX) / hw;
      let k = 0.55 + 0.45 * clamp(1 - abs(u + 0.35) * 1.3, 0, 1);
      if (r === 7) k = 0.85 - 0.25 * u;
      const c = [222 * k + 255 * fl, 168 * k + 240 * fl, 70 * k + 200 * fl];
      put(P, x + s, y, c);
    }
  }
}

function bulbs(P) {
  const L = P.bl;
  const ch = floor(P.chase);
  const ringing = P.ringT < 1.8;
  let sum = 0;
  for (let i = 0; i < BULBS + 6; i++) {
    let v;
    if (i < BULBS) {
      const up = BULBS - 1 - i;
      v = (up + 999 - ch) % 3 === 0 ? 0.9 : 0.2;
      if (REST + 1 - bulbY(i) <= 4 * P.lit) v = 1;
    } else v = (i + ch) % 2 ? 1 : 0.35;
    if (ringing) v = floor(P.ringT * 9) % 2 ? 0.25 : 1;
    L[i] = v;
    sum += v;
  }
  return sum / (BULBS + 6);
}

function drawBulbs(P) {
  const c = P.col;
  const core = c.map((v) => v * 0.6 + 102);
  const at = (x, y, v) => {
    put(P, x, y, core, 0.25 + 0.75 * v);
    for (const [dx, dy, w] of GLOW) add(P, x + dx, y + dy, c, w * v);
  };
  for (let i = 0; i < BULBS; i++) {
    at(33, bulbY(i), P.bl[i]);
    at(52, bulbY(i), P.bl[i]);
  }
  for (let i = 0; i < 6; i++) at(35 + 3 * i, 3, P.bl[BULBS + i]);
  // Festoons along the stall awnings.
  for (let x = 0; x <= 63; x += 3) {
    if (x > 15 && x < 55) continue;
    const tw = 0.75 + 0.25 * sin(P.t * 3 + x);
    put(P, x, 76, FESTOON[(x / 3) % 4], tw);
  }
}

// Bunting from the crossbar down to the stalls, swaying in the night air.
function bunting(P) {
  for (const [x0, y0, x1, y1, sag] of [[0, 15, 33, 3, 5], [52, 3, 63, 17, 3]]) {
    const s = sag + 0.9 * sin(P.t * 1.1 + x0);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const y = round(y0 + (y1 - y0) * u + s * 4 * u * (1 - u));
      put(P, x, y, [44, 40, 46]);
      const n = x - x0 - 2;
      if (n % 5 || x === x0 || x === x1) continue;
      const c = FLAGS[(n / 5) % 5];
      const k = 0.55 + 0.25 * sin(P.t * 2.3 + x);
      for (let r = 1; r <= 3; r++) for (let dx = -1; dx <= 1; dx++) if (abs(dx) <= 2 - r + (r === 1)) put(P, x + dx, y + r, c, k * (dx < 0 ? 0.8 : 1));
    }
  }
}

// A person facing right (or left), feet on the ground row, lit from the tower's side.
function person(P, F, left, dim, held, cheer) {
  const cx = round(F.x);
  const top = GROUND - F.h;
  const col = (dx) => (left ? cx - 1 - dx : cx + dx);
  const T = [F.shirt, F.pants, F.skin, F.hair].map((c) => [c.map((v) => v * dim * 0.78), c.map((v) => v * dim * 1.05)]);
  const tone = (n, x) => T[n][x > cx - 1 ? 1 : 0];
  const arm = F.kind === 2 ? F.skin : F.shirt;
  const torso = round(F.h * 0.36);
  const legTop = top + 4 + torso;
  const sw = F.moving ? sin(F.walk) : 0;
  for (let y = legTop; y < GROUND; y++) {
    const off = round(((sw * 1.6 * (y - legTop)) / (GROUND - legTop)) * (left ? -1 : 1));
    for (let dx = -2; dx <= 1; dx++) {
      const x = col(dx) + (dx < 0 ? -off : off);
      put(P, x, y, y === GROUND - 1 ? [30, 26, 24] : tone(1, x), dx === -1 || dx === 1 ? 0.85 : 1);
    }
  }
  if (!F.moving) put(P, col(2), GROUND - 1, [30, 26, 24]);
  for (let y = top + 4; y < legTop; y++) for (let dx = -2; dx <= (F.kind === 2 ? 2 : 1); dx++) put(P, col(dx), y, tone(0, col(dx)));
  for (let y = top; y < top + 4; y++)
    for (let dx = -1; dx <= 1; dx++) put(P, col(dx), y, tone(y === top || (dx === -1 && y === top + 1) ? 3 : 2, col(dx)));
  if (held) return;
  if (cheer) {
    for (let y = top - 2; y < top + 5; y++) {
      put(P, col(2), y, y < top ? F.skin : arm, dim);
      put(P, col(-3), y, y < top ? F.skin : arm, dim * 0.8);
    }
    return;
  }
  const hx = col(0) + round(sw * 1.2) * (left ? -1 : 1);
  for (let y = top + 5; y < legTop + 1; y++) put(P, y < legTop - 1 ? col(0) : hx, y, y === legTop ? F.skin : arm, dim * 0.85);
}

function mallet(P) {
  const [sx, sy] = P.mS;
  const L = P.mL;
  const head = (a, k) => {
    const dx = cos(a);
    const dy = sin(a);
    for (let u = -1.5; u <= 1.5; u += 0.5)
      for (let v = -2.5; v <= 2.5; v += 0.5) {
        const c = abs(v) > 1.7 ? [170, 170, 184] : u < -0.7 ? [150, 96, 46] : [210, 146, 76];
        put(P, sx + dx * (L + u) - dy * v - 0.5, sy + dy * (L + u) + dx * v - 0.5, c, k);
      }
  };
  if (P.ph === SWING || (P.ph === WATCH && P.pt < 0.05)) for (let n = 1; n <= 3; n++) head(P.a + (P.aPrev - P.a) * (n / 3), 0.32);
  const dx = cos(P.a);
  const dy = sin(P.a);
  for (let t = 4; t <= L - 1.5; t += 0.5) put(P, sx + dx * t - 0.5, sy + dy * t - 0.5, [196, 150, 92]);
  head(P.a, 1);
  const A = P.q[0];
  if (P.ph === WALK) return;
  for (let t = 0; t <= 6; t += 0.5) put(P, sx + dx * t - 0.5, sy + dy * t - 0.5, t > 4.5 || A.kind === 2 ? A.skin : A.shirt, t > 4.5 ? 1 : 0.9);
}

function arcs(P) {
  if (P.ringT > 1.4) return;
  const c = P.col.map((v) => v * 0.5 + 128);
  for (let n = 0; n < 2; n++) {
    const r = 8 + (P.ringT - 0.28 * n) * 34;
    if (r < 8) continue;
    const k = P.ringA * clamp(1 - (r - 8) / 44, 0, 1);
    for (let a = -0.9; a <= 0.9; a += 0.6 / r) {
      add(P, CX - 0.5 - r * cos(a), 9 + r * sin(a) * 0.9, c, k);
      add(P, CX - 0.5 + r * cos(a), 9 + r * sin(a) * 0.9, c, k);
    }
  }
}

export function draw(display, params) {
  const P = params;
  const gl = bulbs(P);
  const fl = P.ringT < 2.5 ? P.ringA * exp(-P.ringT * 2.2) : 0;
  base(P, 0.25 + 0.75 * gl, fl);
  bunting(P);
  scale(P);
  drawPuck(P);
  bell(P);
  drawBulbs(P);
  // The pad's rubber, pressed down a row by the blow.
  const dip = P.padDip > 0.3 ? 1 : 0;
  for (let x = 20; x <= 27; x++) {
    put(P, x, PADY + dip, [150, 34, 34]);
    put(P, x, PADY + 1, [96, 22, 24]);
  }
  if (P.hitT < 0.12) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [2, -1], [-2, -1]]) put(P, PADX + dx - 0.5, PADY - 1 + dy, [255, 250, 230]);
  const cheer = P.ringT < 1.6;
  P.crowd.forEach((F, i) => person(P, F, true, 0.62, false, cheer && floor(P.ringT * 6 + i) % 2 === 0));
  for (let i = P.q.length - 1; i >= 1; i--) person(P, P.q[i], false, 0.78, false, false);
  const A = P.q[0];
  person(P, A, false, 1, P.ph !== WALK, false);
  mallet(P);
  for (const F of P.leavers) person(P, F, false, 0.95, false, false);
  arcs(P);
  const sc = P.col.map((v) => v * 0.45 + 140);
  for (const [x, y, , , life] of P.sparks) {
    const k = min(1, life * 1.2);
    put(P, x, y, sc, k);
    if (life > 0.9) for (const [dx, dy, w] of GLOW.slice(0, 4)) add(P, x + dx, y + dy, sc, w * k);
  }
  flush(display, P.buf);
}

function flush(display, buf) {
  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
}
