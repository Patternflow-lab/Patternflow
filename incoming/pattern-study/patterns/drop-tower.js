// ===== Patternflow pattern =====
// Title:   Drop Tower
// Family:  fair
// Idea:    A drop tower at a night fair hauls a ring of riders up the full height of the panel while its marquee lights chase after them, holds them at the top while the lights go out below, lets them fall at the tower's own gravity and stops them hard on the magnetic brakes over a crowd holding up their phones.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the free-fall towers of amusement parks, whose ring of seats is stopped by magnetic brakes
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Lights=0..1, Speed=0.2..3, Height=50..110, Thrill=0..1
//
// Knob 1: Lights. Turns the bulbs of the tower, the ring and the Ferris wheel round the colour wheel together with the glow they throw on the sky, starting from gold marquee bulbs over a violet glow.
// Knob 2: Speed. How fast the night runs: at 2 the ride runs in real time, 19 s a ride with a fall of 2.1 s at 74 km/h from the top of a 50 m tower; at 0.2 it is ten times slower, at 3 half as fast again.
// Knob 3: Height. The tower's height, 50 to 110 m. The tower always stands the full 128 rows, so a taller one makes the 40 m Ferris wheel beside it smaller, the haul longer and the fall slower on the panel, 3.3 s at 110 m.
// Knob 4: Thrill. How long the ring hangs at the top, 1.8 s to 6 s, with the tower beating like a heart until its lights go out from the foot up in the last 1.8 s; and how hard the brakes bite, from a third of the travel at 1.8 g to a fifth at 4 g.
// Buttons: K1 tap drops the ring at once from wherever it is on the way up, or starts the haul when it is waiting at the station.

const W = 64;
const H = 128;
const N = W * H;
// The tower stands on column 40, from the beacon on row 1 and the cap at rows 4..10 to its
// foot on row 121.
const TX = 40;
const YG = 121;
// The riders' seat row at the top of the travel and at the station.
const YTOP = 22;
const YST = 110;
// Ride states.
const BOARD = 0;
const CLIMB = 1;
const HOLD = 2;
const FALL = 3;
const BRAKE = 4;
const SETTLE = 5;
const LOWER = 6;
const G = 9.81;
// The brakes stop the ring 4 m above the station, and it is let down from there.
const STOP = 4;
const SHIRTS = [[170, 40, 50], [40, 90, 170], [220, 210, 200], [50, 150, 70], [190, 140, 40], [130, 60, 160], [40, 40, 48]];
const SKIN = [[210, 160, 120], [150, 100, 70], [235, 190, 155]];
const HAIR = [[30, 20, 16], [90, 60, 30], [200, 170, 90], [20, 20, 24]];
// A bulb's light on its neighbours: 1 LED away, diagonal, 2 away.
const GLOW = [[1, 0, 0.32], [-1, 0, 0.32], [0, 1, 0.32], [0, -1, 0.32], [1, 1, 0.14], [-1, 1, 0.14], [1, -1, 0.14], [-1, -1, 0.14], [2, 0, 0.06], [-2, 0, 0.06], [0, 2, 0.06], [0, -2, 0.06]];

// Colours the Lights knob leaves alone: the wheel's legs and rim, a cabin's window, the
// ring's catch car, seats and bands, the riders' harness, jeans and shoes, the strings'
// wire and warm bulbs, a phone's arm, the beacon, a star and the crowd.
const LEG = [26, 26, 40];
const RIM1 = [40, 40, 58];
const RIM2 = [30, 30, 46];
const WINDOW = [210, 170, 100];
const CAR = [24, 24, 34];
const SEAT = [30, 26, 44];
const BAND = [96, 96, 112];
const BAND2 = [30, 30, 42];
const HARNESS = [90, 86, 30];
const JEANS = [40, 56, 110];
const SHOE = [225, 225, 235];
const WIRE = [12, 10, 16];
const WARM = [255, 196, 120];
const ARM = [6, 6, 10];
const STROBE = [255, 255, 255];
const BEACON = [255, 30, 20];
const STAR = [1, 1, 1.2];
const DARK = [4, 4, 8];

function hsv(h, s, v) {
  h -= Math.floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function mix(a, b, u) {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

export function setup(params) {
  const P = params;
  Object.assign(P, { t: 0, started: false, Ht: 0, wheel: 0.3, flash: 0, st: BOARD, e: 0, h: 0, v: 0, hc: 0, hue: 0, thrill: 0 });
  P.buf = new Float32Array(N * 3);
  P.sky = new Float32Array(N * 3);
  P.tw = new Float32Array(N * 3);
  P.tm = new Uint8Array(N);
  P.lv = new Float32Array(H);
  P.gx = new Float32Array(W);
  P.gy = new Float32Array(H);
  // Deep blue overhead, paler towards the horizon, and the stalls' warm light on the
  // ground behind the crowd.
  for (let y = 0; y < H; y++) {
    const c = mix([2, 4, 18], [10, 16, 52], y / (H - 1));
    if (y > 108) for (let i = 0; i < 3; i++) c[i] += [70, 46, 30][i] * ((y - 108) / 13) ** 2;
    for (let x = 0; x < W; x++) P.sky.set(c, (y * W + x) * 3);
  }
  // A game stall on the right: a striped awning, a lit counter with prizes on two shelves.
  const paint = (x, y, c) => P.sky.set(c, (y * W + x) * 3);
  for (let x = 49; x < W; x++) {
    for (let y = 103; y <= 105; y++) paint(x, y, ((x - 49) >> 1) & 1 ? [220, 210, 200] : [200, 40, 50]);
    if ((x & 1) === 0) paint(x, 106, [200, 40, 50]);
    for (let y = 107; y <= 112; y++) paint(x, y, x === 49 || x === 63 ? [60, 40, 30] : [150, 108, 60]);
    for (let y = 113; y <= 118; y++) paint(x, y, y === 113 ? [150, 60, 56] : [80, 30, 34]);
  }
  for (let x = 51; x < 62; x += 2)
    for (const y of [108, 110]) paint(x, y, hsv(Math.random(), 0.8, 1));
  P.stars = [];
  for (let i = 0; i < 34; i++) P.stars.push([Math.floor(Math.random() * W), Math.floor(Math.random() * 64), 20 + Math.random() * 40, Math.random() * 7]);
  // Marquee bulbs every 3 rows down both edges of the tower, counted from the foot.
  P.bulbs = [];
  for (let y = 116; y >= 14; y -= 3) for (const s of [-1, 1]) P.bulbs.push({ x: TX + 5 * s, y, q: (116 - y) / 102, i: (116 - y) / 3, L: 0 });
  // Eight riders round the front of the ring, two LEDs wide.
  P.riders = [];
  for (let i = 0; i < 8; i++) {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    P.riders.push({ x: TX - 15 + 4 * i, shirt: pick(SHIRTS), skin: pick(SKIN), hair: pick(HAIR), bold: Math.random(), kick: Math.random() * 7 });
  }
  // The crowd: heads 3 LEDs wide over shoulders that widen to 7, children lower and a few on shoulders.
  const C = (P.crowd = new Uint8Array(N));
  P.phones = [];
  const person = (hx, hy, rows) => {
    for (let d = 0; d < rows && hy + d < H; d++) {
      const half = d < 3 ? 1 : d === 3 ? 0 : Math.min(3, d - 3);
      for (let x = hx - half; x <= hx + half; x++) if (x >= 0 && x < W && hy + d >= 0) C[(hy + d) * W + x] = 1;
    }
  };
  let j = 0;
  for (let x = -1; x < W + 2; x += 4 + Math.floor(Math.random() * 3)) {
    const r = Math.random();
    const hy = r < 0.2 ? 121 : 117 + Math.floor(Math.random() * 3);
    person(x, hy, 20);
    if (r > 0.93) person(x, hy - 6, 6);
    if (j++ % 2 === 0 && x > 1 && x < W - 2) {
      const side = Math.random() < 0.5 ? -2 : 2;
      P.phones.push({ x: x + side, y: hy - 3, at: 0.1 + 0.75 * Math.random(), up: 0 });
    }
  }
  P.body = [];
  for (let p = W; p < N; p++) if (C[p]) P.body.push(p);
  // Two strings of bulbs from the station canopy out past the panel's edges.
  P.string = [];
  const sag = (x0, y0, x1, y1, s) => {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      P.string.push([x, Math.round(y0 + (y1 - y0) * u + s * 4 * u * (1 - u)), (x - x0) % 3 === 0]);
    }
  };
  sag(0, 86, 29, 99, 5);
  sag(51, 99, 63, 90, 3);
}

// The tower's steel for a height in metres: two rails, an X brace every 5 m, the cap,
// the station, and the scale of everything round it.
function build(P, Ht) {
  P.Ht = Ht;
  P.sc = (YG - 2) / Ht;
  P.h0 = (YG - YST) / P.sc;
  P.h1 = (YG - YTOP) / P.sc;
  P.vc = 3 + Ht / 20;
  P.h = clamp(P.h || P.h0, P.h0, P.h1);
  const T = P.tw;
  const M = P.tm;
  T.fill(0);
  M.fill(0);
  const put = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    T.set(c, (y * W + x) * 3);
    M[y * W + x] = 1;
  };
  // Lit from the fair below: brighter at the foot.
  const steel = (y, f) => mix([30, 34, 54], [72, 62, 66], clamp((y - 40) / 81, 0, 1)).map((v) => v * f);
  for (let y = 11; y <= YG; y++) {
    put(TX - 4, y, steel(y, 1));
    put(TX + 4, y, steel(y, 1));
    put(TX, y, steel(y, 0.45));
  }
  const seg = 5 * P.sc;
  for (let y0 = YG; y0 > 11; y0 -= seg) {
    const y1 = Math.max(11, y0 - seg);
    for (let x = -3; x <= 3; x++) put(TX + x, y0, steel(y0, 0.7));
    for (let s = 0; s <= 1; s += 0.5 / seg) {
      const y = y0 + (y1 - y0) * s;
      put(TX - 4 + 8 * s, y, steel(y, 0.6));
      put(TX + 4 - 8 * s, y, steel(y, 0.6));
    }
  }
  // The cap: the hoist house on top, and a mast for the beacon.
  for (let y = 4; y <= 10; y++) for (let x = TX - 6; x <= TX + 6; x++) put(x, y, y === 4 || Math.abs(x - TX) === 6 ? [64, 62, 84] : [16, 16, 28]);
  for (let y = 1; y < 4; y++) put(TX, y, [50, 50, 64]);
  // The station: a lit deck under the ring and a canopy over the queue.
  for (let x = TX - 15; x <= TX + 15; x++) {
    put(x, YG - 1, [190, 140, 80]);
    put(x, YG, [90, 60, 40]);
  }
  for (let x = TX - 10; x <= TX + 10; x++) put(x, 99, [80, 54, 70]);
  P.steel = [];
  for (let p = 0; p < N; p++) if (M[p]) P.steel.push(p);
}

function go(P, st) {
  P.st = st;
  P.e = 0;
  P.hc = P.h;
}

function fall(P) {
  go(P, FALL);
  P.v = 0;
}

function ride(P, d) {
  P.e += d;
  if (P.st === BOARD) {
    P.h = P.h0;
    if (P.e > 3.5) go(P, CLIMB);
  } else if (P.st === CLIMB) {
    // An even haul that eases in and out: the speed peaks at twice the average.
    const u = Math.min(1, P.e / Math.max(1, (P.h1 - P.hc) / P.vc));
    P.h = P.hc + (P.h1 - P.hc) * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI));
    if (u >= 1) go(P, HOLD);
  } else if (P.st === HOLD) {
    P.h = P.h1;
    if (P.e > P.hold) fall(P);
  } else if (P.st === FALL) {
    P.v -= G * d;
    P.h += P.v * d;
    if (P.h <= P.hB) {
      go(P, BRAKE);
      P.a = (P.v * P.v) / (2 * Math.max(0.5, P.h - P.hS));
      P.flash = 1;
    }
  } else if (P.st === BRAKE) {
    P.v += P.a * d;
    P.h += P.v * d;
    if (P.v >= 0) {
      P.v = 0;
      go(P, SETTLE);
    }
  } else if (P.st === SETTLE) {
    // The ring rocks on the brake fins and comes to rest.
    P.h = P.hc + (0.3 + 0.9 * P.thrill) * Math.sin(P.e * 13) * Math.exp(-P.e * 5);
    if (P.e > 1.2) go(P, LOWER);
  } else {
    P.h = Math.max(P.h0, P.hc - 1.5 * P.e);
    if (P.h <= P.h0) go(P, BOARD);
  }
}

function tick(P, dt) {
  while (dt > 1e-6) {
    const d = Math.min(dt, 1 / 60);
    dt -= d;
    ride(P, d);
    P.t += d;
    P.wheel += d * 0.1;
    P.flash *= Math.exp(-d / 0.3);
    const high = P.st >= CLIMB && P.st <= BRAKE ? (P.h - P.h0) / (P.h1 - P.h0) : P.st === SETTLE ? 1 : -1;
    for (const f of P.phones) f.up = clamp(f.up + (high > f.at ? d * 2 : -d * 0.6), 0, 1);
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 50, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.hue = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3);
  const Ht = clamp(k[2], 50, 110);
  P.thrill = clamp(k[3], 0, 1);
  if (Math.abs(Ht - P.Ht) > 0.25) build(P, Ht);
  P.hold = 1.8 + 4.2 * P.thrill;
  P.hS = P.h0 + STOP;
  P.hB = P.hS + (0.32 - 0.14 * P.thrill) * (P.h1 - P.h0);
  if (!P.started) {
    // The fair has been open a while: the panel opens on the ring hanging at the top,
    // and at the opening knobs it falls 2 s in.
    P.started = true;
    for (let i = 0; i < 307; i++) tick(P, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    if (P.st === BOARD) go(P, CLIMB);
    else if ((P.st === CLIMB || P.st === HOLD) && P.h > P.hB + 2) fall(P);
  }
  tick(P, (dt * speed) / 2);
}

// How bright each tower bulb is in this part of the ride.
function bulbLevel(P, b, ys) {
  const t = P.t;
  if (P.st === CLIMB) {
    // A three-bulb chase running up at 12 bulbs a second, brighter under the ring.
    const on = (((Math.floor(t * 12) - b.i) % 3) + 3) % 3 === 0;
    return (on ? 1 : 0.2) * (b.y > ys ? 1 : 0.5) * (0.8 + 0.2 * Math.sin(t * 7.5));
  }
  if (P.st === HOLD) {
    // The tower beats like a heart while the ring hangs. In the last 1.8 s its lights go
    // out from the foot up, and those by the ring blink faster and faster.
    const f = 1 - (P.hold - P.e) / 1.8;
    if (f > 0 && b.q < f * 1.05) return 0.03;
    if (Math.abs(b.y - ys) < 9) return Math.sin(P.e * (8 + 34 * clamp(f, 0, 1))) > 0 ? 1 : 0.12;
    return f > 0 ? 0.75 : 0.3 + 0.7 * Math.max(0, Math.sin(P.e * 7)) ** 3;
  }
  if (P.st === FALL) return b.y < ys ? 1 : 0.04;
  if (P.st === BRAKE) return Math.floor(P.e * 18) & 1 ? 1 : 0.3;
  if (P.st === SETTLE) return 1;
  // Waiting and letting down: a two-phase marquee, twice a second.
  const idle = (b.i + Math.floor(t * 2)) & 1 ? 0.85 : 0.22;
  return P.st === LOWER ? Math.max(idle, 1 - P.e / 3) : idle;
}

export function draw(display, params) {
  const P = params;
  const B = P.buf;
  const t = P.t;
  const hA = 0.12 + P.hue;
  const cA = hsv(hA, 0.72, 1);
  const cB = hsv(hA + 0.47, 0.7, 1);
  const add = (x, y, c, w) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H || w <= 0) return;
    const o = (y * W + x) * 3;
    B[o] += c[0] * w;
    B[o + 1] += c[1] * w;
    B[o + 2] += c[2] * w;
  };
  const set = (x, y, c, f = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 3;
    B[o] = c[0] * f;
    B[o + 1] = c[1] * f;
    B[o + 2] = c[2] * f;
  };
  const bulb = (x, y, c, L) => {
    add(x, y, c, L);
    for (const g of GLOW) add(x + g[0], y + g[1], c, L * g[2]);
  };
  const ys = YST - (P.h - P.h0) * P.sc;
  // Each tower bulb's level, and the glow they throw on the sky round the tower.
  let lit = 0;
  for (const b of P.bulbs) lit += b.L = bulbLevel(P, b, ys);
  lit /= P.bulbs.length;
  const lv = P.lv;
  lv.fill(0);
  for (const b of P.bulbs) if (b.L > 0.1) for (let y = Math.max(0, b.y - 14); y < Math.min(H, b.y + 15); y++) lv[y] += b.L * (1 - Math.abs(y - b.y) / 15);
  const gx = P.gx;
  for (let x = 0; x < W; x++) gx[x] = Math.exp(-(((x - TX) / 10) ** 2));
  const halo = hsv(hA, 0.75, 0.3);
  // The fair's glow on the low sky, in the lights' second colour, brighter while the tower is lit.
  const glow = hsv(hA + 0.6, 0.65, 0.3 + 0.12 * lit);
  sky(B, P.sky, lv, gx, halo, glow);
  for (const q of P.stars) add(q[0], q[1], STAR, q[2] * (0.7 + 0.3 * Math.sin(t * 1.7 + q[3])));
  // The Ferris wheel, 40 m across, behind the tower on the left.
  const R = 20 * P.sc;
  const wx = 8 - 0.55 * R;
  const wy = YG - R - 3 * P.sc;
  for (const s of [-1, 1]) for (let u = 0; u < 1; u += 0.5 / R) add(wx + s * 0.45 * R * u, wy + (YG - wy) * u, LEG, 1);
  for (let k = 0; k < 16; k++) {
    const a = P.wheel + (k * Math.PI) / 8;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let r = 2; r < R - 1; r += 0.8) {
      const x = wx + r * ca;
      if (x < -0.5) continue;
      add(x, wy + r * sa, cB, 0.14 + 0.3 * Math.max(0, Math.sin((r / R) * 9 - t * 3 + k * 0.4)));
    }
  }
  for (let a = -Math.PI / 2; a < Math.PI / 2; a += 0.8 / R) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    add(wx + R * ca, wy + R * sa, RIM1, 1);
    add(wx + (R - 2) * ca, wy + (R - 2) * sa, RIM2, 1);
  }
  const nb = Math.floor((2 * Math.PI * R) / 3);
  for (let j = 0; j < nb; j++) {
    const a = P.wheel + (j * 2 * Math.PI) / nb;
    const x = wx + R * Math.cos(a);
    if (x < -2) continue;
    bulb(x, wy + R * Math.sin(a), j & 1 ? cB : cA, (j + Math.floor(t * 4)) % 3 === 0 ? 0.9 : 0.4);
  }
  const cabin = cB.map((v) => v * 0.22);
  for (let k = 0; k < 12; k++) {
    const a = P.wheel + (k * Math.PI) / 6;
    const x = Math.round(wx + R * Math.cos(a));
    const y = Math.round(wy + R * Math.sin(a));
    if (x < -2) continue;
    for (let dy = 1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) set(x + dx, y + dy, dy === 2 && dx === 0 ? WINDOW : cabin);
  }
  // The tower's steel over everything behind it.
  steel(B, P.tw, P.steel);
  // The brake fins: copper plates on both faces over the last metres, white hot while they bite.
  const heat = P.st === BRAKE ? 1 : P.st === SETTLE ? Math.exp(-P.e * 3) : 0;
  const fin = mix([100, 60, 40], [255, 235, 210], heat);
  for (let y = Math.round(YST - (P.hB - P.h0) * P.sc); y <= YST - (P.hS - P.h0) * P.sc + 6; y += 2) for (const x of [TX - 2, TX + 2]) set(x, y, fin);
  const white = mix(cA, [255, 250, 240], 0.55);
  const hot = P.st === FALL || P.st === BRAKE;
  for (const b of P.bulbs) bulb(b.x, b.y, hot ? white : cA, b.L);
  for (let x = TX - 6; x <= TX + 6; x += 2) bulb(x, 4, cB, (x / 2 + Math.floor(t * 3)) & 1 ? 0.7 : 0.25);
  // The beacon: a red light once every 1.5 s, a white strobe while the ring hangs at the top.
  if (P.st === HOLD) bulb(TX, 1, STROBE, Math.sin(P.e * 20) > 0.6 ? 1.6 : 0);
  else bulb(TX, 1, BEACON, t % 1.5 < 0.25 ? 1.2 : 0.15);
  // The ring: the catch car round the tower, the seats, the riders and their legs.
  const yi = Math.round(ys);
  const drop = hot || (P.st === SETTLE && P.e < 0.6);
  for (let y = yi - 6; y <= yi + 1; y++) for (let x = TX - 4; x <= TX + 4; x++) set(x, y, CAR);
  for (let x = TX - 16; x <= TX + 16; x++) {
    for (let y = yi - 4; y < yi; y++) set(x, y, SEAT);
    set(x, yi, BAND);
    if (Math.abs(x - TX) < 16) set(x, yi + 1, BAND2);
  }
  for (let x = TX - 15; x <= TX + 15; x += 2) {
    const on = drop ? 1 : P.st === HOLD ? (Math.sin(P.e * 12) > 0 ? 1 : 0.2) : (x / 2 + Math.floor(t * 6)) % 3 === 0 ? 1 : 0.35;
    bulb(x, yi + 1, drop ? white : ((x + 1) / 2) & 1 ? cA : cB, on * 0.9);
  }
  for (const r of P.riders) {
    for (let dx = 0; dx < 2; dx++) {
      const x = r.x + dx;
      set(x, yi - 5, r.hair);
      set(x, yi - 4, r.skin);
      set(x, yi - 3, HARNESS);
      set(x, yi - 2, r.shirt);
      set(x, yi - 1, r.shirt, 0.7);
    }
    if (drop) {
      // On the drop the legs fly up and the arms go up: about half the riders' at Thrill 0,
      // everyone's at 1.
      set(r.x, yi + 2, JEANS);
      set(r.x + 1, yi + 2, JEANS);
      set(r.x - 1, yi + 3, SHOE);
      set(r.x + 2, yi + 3, SHOE);
      if (r.bold < 0.45 + 0.55 * P.thrill)
        for (let y = yi - 7; y <= yi - 4; y++) {
          set(r.x - 1, y, r.skin, y === yi - 7 ? 1 : 0.8);
          set(r.x + 2, y, r.skin, y === yi - 7 ? 1 : 0.8);
        }
    } else {
      const sway = Math.sin(t * 2.2 + r.kick) > 0.6 ? 1 : 0;
      for (let y = yi + 2; y <= yi + 4; y++) {
        set(r.x, y, JEANS);
        set(r.x + 1, y, JEANS, 0.8);
      }
      set(r.x + sway, yi + 5, SHOE);
    }
  }
  // Strings of bulbs from the station canopy, warm white with every third one in the tower's colour.
  let n = 0;
  for (const q of P.string) {
    const x = q[0];
    const y = q[1];
    if (!q[2]) {
      set(x, y, WIRE);
      continue;
    }
    n++;
    bulb(x, y + 1, n % 3 === 0 ? cA : WARM, 0.55 + 0.15 * Math.sin(t * 2.3 + n * 1.7));
  }
  // The crowd in silhouette, its heads rimmed by the fair's light, and phones held up to film.
  const rim = mix([20, 16, 24], cA, 0.08 + 0.1 * lit);
  const C = P.crowd;
  for (const p of P.body) set(p % W, Math.floor(p / W), C[p - W] ? DARK : rim);
  for (const f of P.phones) {
    if (f.up <= 0.05) continue;
    const y = Math.round(f.y + (1 - f.up) * 5);
    const g = 0.75 + 0.6 * P.flash;
    for (let a = y + 2; a < y + 5; a++) if (!C[a * W + f.x]) set(f.x, a, ARM);
    set(f.x, y, [150 * g, 185 * g, Math.min(255, 255 * g)]);
    set(f.x, y + 1, [120 * g, 150 * g, 220 * g]);
  }
  // The brakes' flash lights the tower, the ring and the faces below.
  if (P.flash > 0.01) flash(B, gx, P.gy, ys, P.flash);
  show(display, B);
}

function steel(B, T, list) {
  for (let i = 0; i < list.length; i++) {
    const o = list[i] * 3;
    B[o] = T[o] + B[o] * 0.3;
    B[o + 1] = T[o + 1] + B[o + 1] * 0.3;
    B[o + 2] = T[o + 2] + B[o + 2] * 0.3;
  }
}

// The sky, with the tower's glow round it and the fair's on the low sky.
function sky(B, S, lv, gx, halo, glow) {
  for (let y = 0, o = 0; y < H; y++) {
    const v = y < YG ? Math.min(1.6, lv[y] / 6) : 0;
    const w = y < 48 || y >= YG ? 0 : ((y - 48) / 73) ** 1.4;
    const r = glow[0] * w;
    const g = glow[1] * w;
    const b = glow[2] * w;
    for (let x = 0; x < W; x++, o += 3) {
      const u = v * gx[x];
      B[o] = S[o] + halo[0] * u + r;
      B[o + 1] = S[o + 1] + halo[1] * u + g;
      B[o + 2] = S[o + 2] + halo[2] * u + b;
    }
  }
}

function flash(B, gx, gy, ys, f) {
  for (let x = 0; x < W; x++) gx[x] = Math.exp(-((x - TX) ** 2) / 390);
  for (let y = 0; y < H; y++) gy[y] = f * 0.85 * Math.exp(-((y - ys) ** 2) / 390);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) {
      const w = gx[x] * gy[y];
      B[p] += 190 * w;
      B[p + 1] += 215 * w;
      B[p + 2] += 255 * w;
    }
}

function show(display, B) {
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, B[p] > 255 ? 255 : B[p], B[p + 1] > 255 ? 255 : B[p + 1], B[p + 2] > 255 ? 255 : B[p + 2]);
}
