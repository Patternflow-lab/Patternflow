// ===== Patternflow pattern =====
// Title:   Scarecrow Crows
// Family:  halloween
// Idea:    A black scarecrow with a straw hat and a stitched sack face sways on its pole against a big low moon in a dusk sky, crows fly in and land on its arms and hat, hop, turn, stretch and caw, and when its head twitches round they all burst off flapping, circle above it and come back one by one, the ones that find it full pecking along the glowing horizon.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 43; after the scarecrows and crows of Halloween fields
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Speed=0.2..3, Crows=8..20, Nerves=0..1
//
// Knob 1: Colour. Three skies round the knob: at 0 a pale gold moon in a sky going from violet at the top through rose to orange at the horizon; at 0.33 a toxic green moon in a purple sky over a green glow; at 0.67 a cold white moon in a blue night. Each holds for 0.1 either side of its point and blends into the next in between, and 1 is 0 again.
// Knob 2: Speed. At 2 the first twitch comes at 3.4 seconds, the crows climb for 0.7 of a second, circle 2 to 6 seconds and take 1.5 seconds to land (0.9 to 2.8); at 0.2 everything is ten times slower, at 3 one and a half times faster.
// Knob 3: Crows, 8 to 20. There are seven places on the scarecrow, two on each arm, the crown of the hat and the two ends of its brim, and six on the ground along the horizon; at 8 one crow is left for the ground, at 20 six peck there and seven keep circling. At the start 0.45 of them are already perched, 4 of 8 and 9 of 20.
// Knob 4: Nerves. How jumpy the scarecrow is. At 0.06 the head twitches round every 11.5 seconds on average and a crow spends 41% of its time perched; at 1 every 3 seconds, and the crows hardly ever get to land. The twitch turns the face 0.67 of the way to its side at 0.06 and all the way at 1, and from 0.3 the head keeps glancing about between twitches.
// Buttons: K1 tap twitches the head at once and every perched crow bursts off.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, round, atan2, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + (b - a) * Math.random();

// The horizon, the moon, the scarecrow's neck, and the row its pole sways
// about, in the ground below the horizon.
const HZ = 101, MX = 32, MY = 61, MR = 26, NX = 32, NY = 50, BASE = 118;
// Crows are drawn this many times their unit size: 14 LEDs beak to tail
// sitting, and a little bigger in the air, where the wings spread.
const K = 1.2, KF = 1.45;
// Skies, cycled by K1: sky at the top, in the middle, low down and at the
// horizon; the moon, its seas, and the dim field.
const PAL = [
  [[104, 40, 168], [196, 62, 142], [246, 100, 58], [255, 182, 74], [255, 206, 104], [236, 168, 72], [24, 8, 30]],
  [[70, 30, 140], [128, 46, 172], [150, 70, 176], [130, 236, 92], [176, 255, 96], [134, 218, 64], [10, 22, 14]],
  [[40, 52, 142], [62, 92, 192], [106, 128, 222], [196, 172, 244], [240, 240, 222], [202, 204, 196], [10, 12, 32]],
];
// Places to land: two on each arm, the crown of the hat and the brim's ends.
// Feet at (x, y); arm places dip with their arm, hat places turn with the
// head.
const SLOTS = [
  { x: 6.5, y: 54.4, arm: -1 }, { x: 18, y: 54.4, arm: -1 },
  { x: 46, y: 54.4, arm: 1 }, { x: 57.5, y: 54.4, arm: 1 },
  { x: 32, y: 21.8, arm: 0 }, { x: 18.6, y: 33.3, arm: 0, out: -1 }, { x: 45.4, y: 33.3, arm: 0, out: 1 },
  // And six on the ground along the horizon, against its glow, for the
  // crows that find the scarecrow full; they peck.
  ...[5, 14, 23, 42, 51, 59].map((x) => ({ x, y: HZ, arm: 0, ground: true })),
];

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, count: 8, nerves: 0.06,
    // The head: how far it is turned (-1 left, 1 right), where it is going,
    // and how long it holds there; the shudder of a twitch; the sway.
    turn: 0, turnTo: 0, hold: 0, glance: 2, jolt: 0, sway: 0, next: -1, started: false,
    // Each arm's dip when a crow lands on it: a damped spring.
    dip: [0, 0], dipV: [0, 0],
    crows: [], bg: new Uint8Array(N * 3), bgHue: NaN, m: new Uint8Array(N),
  };
}

function newCrow(i) {
  return {
    i, st: "circle", x: 32, y: 30, vx: 0, vy: 0, face: 1, slot: -1, flap: Math.random() * TAU,
    beak: 0, cawT: 0, hop: 0, hopT: -1, flip: false, wing: 0, stretchT: 0, peck: 0, peckT: 0, act: rnd(0.4, 1.5),
    circ: 0, ang: Math.random() * TAU, dir: Math.random() < 0.5 ? -1 : 1, rx: rnd(16, 31), ry: rnd(6, 13), cy: rnd(12, 22), wait: rnd(2, 6), delay: 0,
  };
}

// The opening: 0.45 of the crows already perched, 4 of 8, the rest in the
// air coming down one by one.
function start(S) {
  S.crows = [];
  for (let i = 0; i < 20; i++) S.crows.push(newCrow(i));
  const first = [1, 2, 4, 6, 0, 3, 5, 8, 11, 9];
  const n0 = round(S.count * 0.45);
  for (let i = 0; i < n0; i++) perch(S, S.crows[i], first[i], i & 1 ? -1 : 1, false);
  for (let i = n0; i < 20; i++) {
    const c = S.crows[i];
    c.ang = (i * 2.3) % TAU;
    c.x = NX + c.rx * cos(c.ang);
    c.y = c.cy + c.ry * sin(c.ang);
    c.wait = 0.3 + (i - n0) * 0.8;
  }
  S.started = true;
}

function perch(S, c, slot, face, bounce) {
  c.st = "perch";
  c.slot = slot;
  // On a brim end a crow faces out, or it is lost against the crown.
  c.face = SLOTS[slot].out || face;
  c.vx = c.vy = 0;
  c.act = rnd(0.3, 1.2);
  const arm = SLOTS[slot].arm;
  if (bounce && arm) S.dipV[arm > 0 ? 1 : 0] += 9;
}

// Every point of the scarecrow goes through here: the sway leans it about
// row BASE, and a twitch shudders it.
function body(S, x, y, out) {
  out[0] = x + S.sway * (BASE - y);
  out[1] = y + S.jolt;
}

// A point of an arm, dipping more the further it is from the shoulder.
function armPoint(S, x, y, out) {
  const side = x < NX ? 0 : 1, reach = cl((abs(x - NX) - 8) / 22, 0, 1.2);
  body(S, x, y + S.dip[side] * reach, out);
}

// A point of the head or hat, tilted and shifted with the turn.
function headPoint(S, x, y, out) {
  const a = 0.15 * S.turn, c = cos(a), s = sin(a), dx = x - NX, dy = y - NY;
  body(S, NX + 1.4 * S.turn + dx * c - dy * s, NY + dx * s + dy * c, out);
}

function slotPos(S, k, out) {
  const s = SLOTS[k];
  if (s.ground) (out[0] = s.x), (out[1] = s.y);
  else if (s.arm) armPoint(S, s.x, s.y, out);
  else headPoint(S, s.x, s.y, out);
}

function twitch(S) {
  S.turnTo = (Math.random() < 0.5 ? -1 : 1) * (0.65 + 0.35 * S.nerves);
  S.hold = rnd(0.7, 1.2);
  S.jolt = -1.6;
  for (const c of S.crows) {
    if (c.i >= S.count) continue;
    if (c.st === "perch" || c.st === "land") {
      c.delay = c.st === "land" ? 0 : rnd(0, 0.25);
      c.st = "flee";
      c.slot = -1;
      c.circ = 0;
    }
    // Back one by one: each circles 2 to 6 seconds before it tries to land.
    c.wait = max(c.wait, rnd(2, 6));
  }
}

const P = [0, 0];

function stepPerched(S, c, d) {
  // On the scarecrow: now and then a hop, a turn, a stretch or a caw.
  c.act -= d;
  if (c.hopT >= 0) {
    c.hopT += d;
    const u = c.hopT / 0.4;
    c.hop = 3.4 * 4 * u * (1 - u);
    c.wing = sin(PI * cl(u, 0, 1)) * 0.9;
    if (u > 0.5 && c.flip) (c.face = -c.face), (c.flip = false);
    if (u >= 1) (c.hopT = -1), (c.hop = 0), (c.wing = 0);
  }
  if (c.stretchT > 0) {
    c.stretchT -= d;
    c.wing = sin(PI * cl(1 - c.stretchT / 0.8, 0, 1));
    if (c.stretchT <= 0) c.wing = 0;
  }
  if (c.cawT > 0) {
    c.cawT -= d;
    c.beak = sin(((0.9 - c.cawT) / 0.45) * PI) > 0.2 ? 1 : 0;
    if (c.cawT <= 0) c.beak = 0;
  }
  if (c.peckT > 0) {
    // Two jabs at the ground in 0.7 of a second.
    c.peckT -= d;
    c.peck = max(0, sin(((0.7 - c.peckT) / 0.35) * PI));
    if (c.peckT <= 0) c.peck = 0;
  }
  if (c.act <= 0 && c.hopT < 0 && c.cawT <= 0 && c.stretchT <= 0 && c.peckT <= 0) {
    const r = Math.random();
    const fixed = !!SLOTS[c.slot].out;
    if (SLOTS[c.slot].ground && r < 0.5) c.peckT = 0.7;
    else if (r < 0.35) (c.hopT = 0), (c.flip = !fixed && Math.random() < 0.6);
    else if (r < 0.55 && !fixed) c.face = -c.face;
    else if (r < 0.75) c.stretchT = 0.8;
    else c.cawT = 0.9;
    c.act = rnd(0.4, 1.6);
  }
  slotPos(S, c.slot, P);
  c.x = P[0];
  c.y = P[1] - c.hop;
}

function stepCrow(S, c, d) {
  c.flap += d * (c.st === "flee" ? 38 : 25);
  if (c.st === "perch") return stepPerched(S, c, d);
  if (c.st === "flee") {
    // Burst off: up and away from the head, wings going hard.
    if (c.delay > 0) {
      c.delay -= d;
      return;
    }
    if (c.circ === 0) {
      const away = c.x < NX ? -1 : 1;
      c.vx = away * rnd(16, 30);
      c.vy = -rnd(26, 40);
      c.beak = c.hop = c.wing = c.peck = 0;
      c.hopT = -1;
      c.stretchT = c.cawT = c.peckT = 0;
    }
    c.circ += d;
    c.vy += 22 * d;
    c.x += c.vx * d;
    c.y += c.vy * d;
    c.face = c.vx >= 0 ? 1 : -1;
    if (c.circ > 0.7) {
      // Join its own ellipse where it is, going round the way it flies.
      c.st = "circle";
      c.ang = atan2((c.y - c.cy) / c.ry, (c.x - NX) / c.rx);
      c.dir = -sin(c.ang) * c.vx >= 0 ? 1 : -1;
    }
    return;
  }
  if (c.st === "circle") {
    // Round and round above the scarecrow, each on an ellipse of its own;
    // when its time is up and a place is free, come in to land.
    c.ang += d * c.dir * (24 / ((c.rx + c.ry) / 2));
    steer(c, NX + c.rx * cos(c.ang), c.cy + c.ry * sin(c.ang), 34, d, 3);
    c.wait -= d;
    if (c.wait <= 0) {
      const k = freeSlot(S, c);
      if (k >= 0) (c.st = "land"), (c.slot = k);
      else c.wait = rnd(1, 3);
    }
    return;
  }
  // Landing: come in above the place, then drop onto it.
  slotPos(S, c.slot, P);
  const dx = P[0] - c.x, dy = P[1] - c.y, dist = sqrt(dx * dx + dy * dy);
  steer(c, P[0], P[1] - (dist > 9 ? 6 : 0), min(30, 4 + dist * 2.6), d, 5);
  if (dist < 0.8) perch(S, c, c.slot, c.vx >= 0 ? 1 : -1, true);
}

function steer(c, tx, ty, speed, d, k) {
  const dx = tx - c.x, dy = ty - c.y, L = sqrt(dx * dx + dy * dy) || 1;
  const v = min(speed, L * 4), f = min(1, d * k);
  c.vx += ((dx / L) * v - c.vx) * f;
  c.vy += ((dy / L) * v - c.vy) * f;
  c.x += c.vx * d;
  c.y += c.vy * d;
  if (abs(c.vx) > 3) c.face = c.vx > 0 ? 1 : -1;
}

// The nearest free place, so crows do not cross each other's paths.
function freeSlot(S, me) {
  let best = -1, bd = 1e9;
  for (let k = 0; k < SLOTS.length; k++) {
    let taken = false;
    for (const c of S.crows) if (c !== me && c.i < S.count && c.slot === k) taken = true;
    if (taken) continue;
    slotPos(S, k, P);
    const dd = (P[0] - me.x) ** 2 + (P[1] - me.y) ** 2;
    if (dd < bd) (bd = dd), (best = k);
  }
  return best;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 8, 0.06], d0 = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.count = cl(round(k[2]), 8, 20);
  S.nerves = cl(k[3], 0, 1);
  if (!S.started) start(S);
  const d = d0 * S.speed * 0.5;
  S.t += d;
  // Twitches come every 11.5 seconds on average at Nerves 0.06, every 3 at
  // 1; the first at 0.3 of the interval, 3.4 seconds at the start knobs.
  const T = mix(12, 3, S.nerves);
  if (S.next < 0) S.next = 0.3 * T;
  const tap = !!(input.btnPressed && input.btnPressed[0]);
  if (tap || S.t >= S.next) {
    twitch(S);
    S.next = S.t + T * rnd(0.7, 1.3);
  }
  // The head snaps to its side, holds, then comes slowly back; between
  // twitches a nervous one glances about.
  if (S.hold > 0) {
    S.hold -= d;
    if (S.hold <= 0) S.turnTo = 0;
  } else {
    S.glance -= d;
    if (S.glance <= 0) {
      S.turnTo = S.nerves > 0.3 ? (rnd(-1, 1) * 0.45 * (S.nerves - 0.3)) / 0.7 : 0;
      S.glance = rnd(0.8, 2.5);
    }
  }
  S.turn += (S.turnTo - S.turn) * min(1, d * (S.hold > 0 ? 30 : 2.2));
  S.jolt *= exp(-d * 9);
  // The wind leans the scarecrow up to 2 LEDs at the hat.
  S.sway = 0.012 * sin(S.t * 0.8) + 0.007 * sin(S.t * 2.1 + 1);
  for (let a = 0; a < 2; a++) {
    S.dipV[a] += (-60 * S.dip[a] - 5 * S.dipV[a]) * d;
    S.dip[a] += S.dipV[a] * d;
  }
  for (const c of S.crows) {
    if (c.i >= S.count) {
      // A crow the knob takes away is gone, and its place is free.
      c.slot = -1;
      if (c.st !== "circle") c.st = "circle";
      continue;
    }
    stepCrow(S, c, d);
  }
}

// --- drawing: a sky, then one silhouette mask for the scarecrow and crows ---

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillPoly(m, pts, v) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < pts.length; i += 2) (x0 = min(x0, pts[i])), (x1 = max(x1, pts[i])), (y0 = min(y0, pts[i + 1])), (y1 = max(y1, pts[i + 1]));
  for (let y = max(0, floor(y0)); y <= min(H - 1, floor(y1)); y++)
    for (let x = max(0, floor(x0)); x <= min(W - 1, floor(x1)); x++) if (inPoly(x + 0.5, y + 0.5, pts)) m[y * W + x] = v;
}

function fillEllipse(m, cx, cy, rx, ry, rot, v) {
  const c = cos(rot), s = sin(rot), R = max(rx, ry) + 1;
  for (let y = max(0, floor(cy - R)); y <= min(H - 1, floor(cy + R)); y++)
    for (let x = max(0, floor(cx - R)); x <= min(W - 1, floor(cx + R)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * c + dy * s) / rx, w = (-dx * s + dy * c) / ry;
      if (u * u + w * w <= 1) m[y * W + x] = v;
    }
}

function stroke(m, x0, y0, x1, y1, r, v) {
  const dx = x1 - x0, dy = y1 - y0, ll = dx * dx + dy * dy || 1e-9;
  for (let y = max(0, floor(min(y0, y1) - r)); y <= min(H - 1, floor(max(y0, y1) + r)); y++)
    for (let x = max(0, floor(min(x0, x1) - r)); x <= min(W - 1, floor(max(x0, x1) + r)); x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = cl((px * dx + py * dy) / ll, 0, 1), ex = px - u * dx, ey = py - u * dy;
      if (ex * ex + ey * ey <= r * r) m[y * W + x] = v;
    }
}

function setAt(m, x, y, v) {
  x = floor(x);
  y = floor(y);
  if (x >= 0 && x < W && y >= 0 && y < H) m[y * W + x] = v;
}

// A flat list of points [x0, y0, x1, y1, ...] moved through fn.
function moved(S, fn, pts) {
  const out = [];
  for (let i = 0; i < pts.length; i += 2) {
    fn(S, pts[i], pts[i + 1], P);
    out.push(P[0], P[1]);
  }
  return out;
}

function scarecrow(S, m) {
  const t = S.t, A = [0, 0], B = [0, 0];
  // Pole, shirt with a ragged hem, and the sleeves on the crossbar.
  body(S, NX, 60, A);
  body(S, NX, H + 4, B);
  stroke(m, A[0], A[1], B[0], B[1], 1.4, 1);
  fillPoly(m, moved(S, body, [24, 53, 40, 53, 42.5, 68, 44, 82, 42, 85.5, 40, 83, 37.5, 86, 35, 83.2, 32.5, 86.5, 30, 83.2, 27, 86, 24.5, 83, 22, 85.5, 20, 82, 21.5, 68]), 1);
  fillPoly(m, moved(S, armPoint, [3.5, 54.6, 22, 54.6, 42, 54.6, 60.5, 54.6, 61.8, 60, 56, 59, 42, 59.6, 32, 60, 22, 59.6, 8, 59, 2.2, 60]), 1);
  // Straw: out of the cuffs, the hem and the neck, trembling in the air.
  const straw = (fn, x, y, a, L, n) => {
    fn(S, x, y, A);
    const w = a + 0.18 * sin(t * 4.1 + n * 1.7) + 0.08 * sin(t * 9.3 + n);
    stroke(m, A[0], A[1], A[0] + L * cos(w), A[1] + L * sin(w), 0.5, 1);
  };
  for (let n = 0; n < 4; n++) {
    straw(armPoint, 3, 58, PI * (0.62 + 0.09 * n), 4.5 + (n & 1), n);
    straw(armPoint, 61, 58, PI * (0.38 - 0.09 * n), 4.5 + (n & 1), n + 4);
  }
  for (let n = 0; n < 6; n++) straw(body, 23 + n * 3.6, 85, PI * (0.5 + 0.06 * (n - 2.5)), 3 + (n % 3), n + 8);
  for (let n = 0; n < 3; n++) straw(headPoint, NX, 51.5, PI * (0.25 + 0.25 * n), 3.5, n + 14);
  // Head: a sack, tied at the neck, under a straw hat; all of it turns.
  headPoint(S, NX, 41.5, A);
  fillEllipse(m, A[0], A[1], 7.6, 8.4, 0.15 * S.turn, 1);
  headPoint(S, NX, 50.5, A);
  fillEllipse(m, A[0], A[1], 3.4, 1.9, 0, 1);
  fillPoly(m, moved(S, headPoint, [16.5, 34.5, 21, 31.6, 43, 31.6, 47.5, 34.5, 41, 34.2, 23, 34.2]), 1);
  fillPoly(m, moved(S, headPoint, [24, 31.8, 24.8, 25.5, 27, 22.6, 32, 21.6, 37, 22.6, 39.2, 25.5, 40, 31.8]), 1);
  for (let n = 0; n < 3; n++) {
    straw(headPoint, 17 + n * 1.3, 34.2, PI * (0.62 - 0.05 * n), 2.6, n + 17);
    straw(headPoint, 47 - n * 1.3, 34.2, PI * (0.38 + 0.05 * n), 2.6, n + 20);
  }
  // The face is cut out, so the moon shows through: X-stitched eyes and a
  // stitched mouth, sliding to the side the head turns to.
  const tu = S.turn, fx = NX + 4.4 * tu, sp = 3.4 * (1 - 0.45 * abs(tu));
  for (const e of [-1, 1]) {
    headPoint(S, fx + e * sp, 39.5, A);
    for (const [ox, oy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) setAt(m, A[0] + ox, A[1] + oy, 0);
  }
  const half = 4.2 * (1 - 0.35 * abs(tu));
  for (let u = -half; u <= half + 0.01; u += 1) {
    headPoint(S, fx + u, 45.5 - (abs(u) > half - 1.2 ? 0.8 : 0), A);
    setAt(m, A[0], A[1], 0);
    if (round(u + half) % 2 === 1) {
      setAt(m, A[0], A[1] - 1, 0);
      setAt(m, A[0], A[1] + 1, 0);
    }
  }
}

// Wings from a shoulder at (x, y): a near and a far one, root along the
// back, tip out and up (a > 0) or down. pt maps body coordinates (u along,
// v below) to the panel.
function wings(m, pt, a, L) {
  for (const [k, back, sh] of [[1, 0, 0], [0.8, -1.2, 0.35]]) {
    const l = L * k, sa = sin(a + sh), ca = cos(a + sh);
    fillPoly(m, [...pt(1.4 + back * 0.3, -0.6), ...pt(0.2 + back - 1.2 * ca, -0.6 - 0.6 * l * sa), ...pt(-1.6 + back - 2.2 * ca, -0.6 - l * sa), ...pt(-1.8 + back * 0.3, -0.6)], 1);
  }
}

// A crow standing, feet at (fx, fy), facing f (1 right, -1 left), beak open
// when b is 1, wings raised by w (0 folded, 1 stretched high), head down to
// the ground by p (0 up, 1 pecking).
function crowSitting(m, fx, fy, f, b, w, p) {
  const pt = (u, v) => [fx + f * u * K, fy + v * K];
  // The head and beak swing down about the shoulder as it pecks.
  const hp = (u, v) => pt(mix(u, 1.2 + 0.25 * (u - 1.2) + 0.95 * (v + 4.2), p), mix(v, -2.4 + 0.25 * (v + 4.2) + 0.95 * (u - 1.2), p));
  stroke(m, ...pt(-0.8, -2), ...pt(-0.8, -0.2), 0.5, 1);
  stroke(m, ...pt(0.6, -2), ...pt(0.6, -0.2), 0.5, 1);
  const bc = pt(-0.6, -3.6), hc = hp(2.1, -5.6);
  fillEllipse(m, bc[0], bc[1], 3 * K, 2 * K, (-0.35 + 0.5 * p) * f, 1);
  fillEllipse(m, hc[0], hc[1], 1.6 * K, 1.5 * K, 0, 1);
  fillPoly(m, [...pt(-2.6, -4.6), ...pt(-6, -1.4 - 2 * p), ...pt(-5.4, -0.4 - 2 * p), ...pt(-2.4, -2.4)], 1);
  if (b) {
    fillPoly(m, [...hp(3.2, -6.6), ...hp(5.7, -7.6), ...hp(3.4, -5.6)], 1);
    fillPoly(m, [...hp(3.2, -5.2), ...hp(5.2, -3.8), ...hp(3.2, -4.4)], 1);
  } else fillPoly(m, [...hp(3.2, -6.5), ...hp(5.8, -5.5), ...hp(3.2, -4.6)], 1);
  if (w > 0.05) wings(m, (u, v) => pt(u - 0.8, v - 4.2), 0.2 + 1.1 * w, 6.5 * K * w + 1);
  const e = hp(2.5, -6.1);
  setAt(m, e[0], e[1], 2);
}

// A crow in the air, centre (x, y), facing f, nose tilted down by tilt,
// wings at angle a, drawn a little from above so both wings show.
function crowFlying(m, x, y, f, a, tilt) {
  const c = cos(tilt), s = sin(tilt);
  const pt = (u, v) => [x + f * KF * (u * c - v * s), y + KF * (u * s + v * c)];
  fillEllipse(m, x, y, 3.2 * KF, 1.5 * KF, tilt * f, 1);
  const hd = pt(3.2, -0.6);
  fillEllipse(m, hd[0], hd[1], 1.4 * KF, 1.3 * KF, 0, 1);
  fillPoly(m, [...pt(4.2, -1), ...pt(6, -0.4), ...pt(4.2, 0.1)], 1);
  fillPoly(m, [...pt(-2.6, -0.8), ...pt(-6, -1.6), ...pt(-6, 1.2), ...pt(-2.6, 0.8)], 1);
  wings(m, pt, a, 7.5);
  const e = pt(3.6, -1.1);
  setAt(m, e[0], e[1], 2);
}

function palette(S) {
  const h = (S.hue - floor(S.hue)) * 3, i = floor(h) % 3, f = h - floor(h), j = (i + 1) % 3;
  const g = cl((f - 0.3) / 0.4, 0, 1), sm = g * g * (3 - 2 * g);
  return PAL[0].map((_, n) => [0, 1, 2].map((ch) => mix(PAL[i][n][ch], PAL[j][n][ch], sm)));
}

// The sky, the moon and the field only change with the colour.
function background(S) {
  const [top, midc, low, hz, moon, sea, field] = palette(S), bg = S.bg;
  const lerp3 = (a, b, u) => [0, 1, 2].map((ch) => mix(a[ch], b[ch], u));
  // Violet at the top, the middle colour at row 45, the low one at row 80
  // and the horizon's glow at 101.
  const skyAt = (y) => (y < 45 ? lerp3(top, midc, y / 45) : y < 80 ? lerp3(midc, low, (y - 45) / 35) : lerp3(low, hz, (y - 80) / (HZ - 80)));
  for (let y = 0; y < H; y++) {
    const sky = skyAt(y);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let c = sky;
      if (y >= HZ) {
        // The field: dark, with furrows running to the foot of the pole.
        const u = (x + 0.5 - NX) / (y + 1 - HZ + 4), lane = abs(u * 3 - round(u * 3));
        c = field.map((v) => v * (lane < 0.1 + (0.02 * (y - HZ)) / 4 ? 1.9 : 1));
      } else {
        const dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
        if (r < MR) {
          let s = 0;
          for (const [sx, sy, sr] of [[-8, -6, 6], [6, 4, 5], [-3, 10, 4], [9, -10, 3.5]]) if ((dx - sx) ** 2 + (dy - sy) ** 2 < sr * sr) s = 1;
          c = s ? sea : moon;
        } else if (r < MR + 3) c = sky.map((v, ch) => min(255, v + 0.25 * (moon[ch] - v)));
      }
      bg[o] = c[0];
      bg[o + 1] = c[1];
      bg[o + 2] = c[2];
    }
  }
  // Three pumpkins left in the field, lit orange whatever the sky.
  for (const [px, py, rx, ry] of [[11, 113, 5.5, 4.2], [53, 109, 4.2, 3.3], [41, 121, 6.5, 4.8]]) {
    for (let y = floor(py - ry - 2); y <= floor(py + ry); y++)
      for (let x = floor(px - rx); x <= floor(px + rx); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const u = (x + 0.5 - px) / rx, v = (y + 0.5 - py) / ry, o = (y * W + x) * 3;
        let c = null;
        if (u * u + v * v <= 1) {
          // Ribs as darker grooves, and a darker rim at the bottom.
          const rib = abs(abs(u) - 0.45) < 0.13 || abs(u) < 0.07 ? 0.62 : 1, rim = v > 0.65 ? 0.75 : 1;
          c = [236 * rib * rim, 112 * rib * rim, 18 * rib * rim];
        } else if (abs(x + 0.5 - px) < 0.9 && y + 0.5 < py - ry + 0.6 && y + 0.5 > py - ry - 2) c = [70, 120, 30];
        if (c) (bg[o] = c[0]), (bg[o + 1] = c[1]), (bg[o + 2] = c[2]);
      }
  }
  S.bgHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  if (S.bgHue !== S.hue) background(S);
  const m = S.m, bg = S.bg;
  m.fill(0);
  scarecrow(S, m);
  for (const c of S.crows) {
    if (c.i >= S.count) continue;
    if (c.st === "perch" || (c.st === "flee" && c.delay > 0)) crowSitting(m, c.x, c.y, c.face, c.beak, c.wing, c.peck);
    else {
      // Flapping in the air; gliding with wings raised on the way in.
      const glide = c.st === "land" && Math.hypot(c.vx, c.vy) < 14;
      crowFlying(m, c.x, c.y, c.face, glide ? 0.75 : 0.25 + sin(c.flap), cl(c.vy / 60, -0.5, 0.5));
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const v = m[p];
      if (v === 1) display.setPixel(x, y, 6, 2, 10);
      else if (v === 2) display.setPixel(x, y, 150, 140, 120);
      else display.setPixel(x, y, bg[p * 3], bg[p * 3 + 1], bg[p * 3 + 2]);
    }
}
