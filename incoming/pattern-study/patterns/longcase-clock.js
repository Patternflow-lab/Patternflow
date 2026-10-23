// ===== Patternflow pattern =====
// Title:   Longcase Clock
// Family:  time
// Idea:    A grandfather clock stands the full height of a dark room by candlelight, its brass bob beating seconds behind the trunk glass, its weights sinking on their cables, the moon disc turning in the arch of the dial, and on the hour it strikes and the candle flame jumps.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the eight-day longcase clocks of 18th-century England, with an arched brass dial and a painted moon disc
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Wood=0..1, Speed=0..3, Candle=0..1, Lamp=0..1
//
// Knob 1: Wood. The case, from honey oak at 0 through walnut and red mahogany to ebonised black at 1.
// Knob 2: Speed. How fast the clock's time runs: real time at 0, a minute a second at 2 so the hands move and it strikes the hour once a minute, and at 3 a day goes by in under a second, the weights sink, the moon turns and daylight comes and goes in the window.
// Knob 3: Candle. Where the candle stands: off the left edge at 0, in front of the clock at 0.5, off the right edge at 1, and the case's shadow on the wall swings round to the other side.
// Knob 4: Lamp. The light in the room, from the flickering candle at 0 to steady blue moonlight through a window on the upper right at 1.

const W = 64;
const H = 128;
const N = W * H;
// Woods at full light: oak, walnut, mahogany, ebonised.
const WOODS = [
  [200, 142, 74],
  [128, 84, 50],
  [158, 60, 34],
  [44, 36, 34],
];
// Materials and what each is at full light. Wood takes the Wood knob.
const WALL = 0;
const FLOOR = 1;
const WOOD = 2;
const BRASS = 3;
const SILVER = 4;
const INSIDE = 5;
const DARK = 6;
const SKIRT = 7;
const FRET = 8;
const BELL = 9;
const COL = [
  [70, 60, 52],
  [120, 84, 52],
  null,
  [235, 184, 92],
  [236, 236, 230],
  null,
  [14, 12, 12],
  [46, 36, 30],
  [8, 6, 6],
  [235, 184, 92],
];
// The dial: centre, the arch and its moon disc, the seconds dial.
const DX = 32;
const DY = 37;
const AY = 24;
const AR = 12.5;
const SY = 31;
// Pendulum: pivot behind the dial, the bob's rest point and its arc; the
// top of the trunk glass.
const PIV = 44;
const BOB = 92;
const ARC = 4.5;
const DT = 58;
const CANDLE = [1, 0.74, 0.46];
const MOONC = [0.42, 0.55, 1];
const SUN = [1, 0.9, 0.7];

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function hyp(a, b) {
  return Math.sqrt(a * a + b * b);
}

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function setup(params) {
  const P = params;
  P.mat = new Uint8Array(N);
  P.tone = new Float32Array(N);
  P.spec = new Float32Array(N);
  P.lamp = new Float32Array(N);
  P.win = new Float32Array(N);
  P.sheen = new Float32Array(N);
  P.buf = new Float32Array(N * 3);
  P.pal = new Float32Array(COL.length * 3);
  P.light = new Float32Array(12);
  P.hcol = new Float32Array(3);
  P.rod = new Float32Array(3);
  P.cab = new Float32Array(3);
  P.pul = new Float32Array(3);
  const { mat, tone, spec } = P;
  const set = (x, y, m, t, s) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    mat[p] = m;
    tone[p] = t;
    spec[p] = s || 0;
  };
  // Wood grain: vertical streaks that wander, or along a moulding.
  const grain = (x, y, along) => {
    const a = along ? y : x;
    const b = along ? x : y;
    return 0.8 + 0.12 * Math.sin(a * 2.3 + 2.6 * Math.sin(b * 0.09 + a * 0.4)) + 0.1 * hash(a, Math.floor(b / 9));
  };
  const box = (x0, y0, x1, y1, m, f) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, m, f ? f(x, y) : 1);
  };
  const woodV = (x, y) => grain(x, y, false);
  // A moulding: rows lit from above, the left end catching the light.
  const mould = (x0, y0, x1, y1) =>
    box(x0, y0, x1, y1, WOOD, (x, y) => grain(x, y, true) * (1.15 - (0.5 * (y - y0)) / (y1 - y0 + 1)) * (x === x0 ? 1.25 : x === x1 ? 0.6 : 1));
  // The room: papered wall with a faint stripe, dado rail, skirting, boards.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y >= 118) set(x, y, FLOOR, (0.75 + 0.2 * hash(Math.floor((x - 32) / (3 + (y - 118) * 0.25)), 1)) * (Math.abs(((x - 32) / (1 + (y - 118) * 0.08)) % 7) < 0.6 ? 0.5 : 1));
      else if (y >= 112) set(x, y, SKIRT, y === 112 ? 1.4 : 1);
      else if (y >= 76 && y <= 78) set(x, y, SKIRT, y === 76 ? 1.5 : 0.8);
      else set(x, y, WALL, (x % 6 < 3 ? 1 : 0.82) * (y > 78 ? 0.8 : 1) * (0.92 + 0.08 * hash(x, y)));
    }
  // Pediment: a broken arch with rosettes and two brass finials, and in
  // its open middle the bell the hours are struck on.
  for (let x = 14; x <= 50; x++) {
    const d = Math.abs(x - DX);
    const top = d < 7 ? 9 : Math.round(3 + 6 * ((d - 7) / 11) ** 1.6);
    for (let y = top; y <= 10; y++) set(x, y, WOOD, grain(x, y, true) * (y === top ? 1.35 : 0.95));
  }
  for (const [fx, fy] of [[15, 3], [49, 3]]) {
    box(fx - 1, fy + 2, fx + 1, 10, WOOD, woodV);
    for (let y = fy - 2; y <= fy + 1; y++)
      for (let x = fx - 2; x <= fx + 2; x++) {
        const r = hyp(x - fx, y - fy);
        if (r <= 1.8) set(x, y, BRASS, 0.7 + 0.3 * (fx - x), 1 - r / 1.8);
      }
    set(fx, fy - 2, BRASS, 0.8, 0.5);
    set(fx, fy - 3, BRASS, 0.6, 0.3);
  }
  for (const rx of [24, 40]) set(rx, 4, BRASS, 1, 0.8);
  for (let y = 2; y <= 8; y++)
    for (let x = 27; x <= 37; x++) {
      const e = ((x - DX) / 4.6) ** 2 + ((y - 7.6) / 5.2) ** 2;
      if (e <= 1 && y <= 7.6) set(x, y, BELL, 0.55 + 0.6 * clamp((DX + 1 - x) / 4, 0, 1), y === 7 ? 0.9 : 0.35 * (1 - e));
    }
  set(DX, 1, BELL, 0.8, 0.4);
  for (const x of [DX - 1, DX, DX + 1]) set(x, 8, DARK, 1);
  // Hood: the frame, brass-capped pillars, the fretted spandrels.
  mould(12, 10, 52, 12);
  box(13, 13, 51, 52, WOOD, woodV);
  for (const cx of [14, 50])
    for (let y = 13; y <= 52; y++)
      for (let x = cx - 1; x <= cx + 1; x++) {
        const cap = y <= 15 || y >= 50;
        set(x, y, cap ? BRASS : WOOD, (cap ? 1 : grain(x, y, false)) * (1.1 - 0.3 * (x - cx + 1)), cap ? 0.8 - 0.3 * (x - cx + 1) : 0);
      }
  for (let y = 13; y <= AY; y++)
    for (let x = 17; x <= 47; x++)
      if (hyp(x - DX, y - AY) > AR + 1.5 && (hash(Math.floor(x / 2), Math.floor(y / 2)) > 0.55 || (x + y) % 4 === 0)) set(x, y, FRET, 1);
  mould(12, 53, 52, 56);
  // Dial: brass plate in the arch and the square, gilt scrolls in the
  // corners, a silvered chapter ring, the seconds dial and winding holes.
  for (let y = 11; y <= 50; y++)
    for (let x = 18; x <= 46; x++) {
      const ra = hyp(x - DX, y - AY);
      if (y < AY && ra > AR + 1) continue;
      const r = hyp(x - DX, y - DY);
      if (y < AY && ra > AR) set(x, y, BRASS, 1.1, 0.6);
      else if (y < AY) set(x, y, DARK, 1);
      else if (r >= 9.6 && r <= 13.2) {
        const a = Math.atan2(y - DY, x - DX) / (Math.PI / 6);
        const tick = Math.abs(a - Math.round(a)) < 0.14 && r > 10.2 && r < 12.6;
        set(x, y, tick ? DARK : SILVER, r > 12.7 || r < 10 ? 0.7 : 1);
      } else if (r > 13.2) {
        const g = Math.sin(x * 1.4 + Math.sin(y * 0.9) * 2) * Math.sin(y * 1.4 + Math.sin(x * 0.9) * 2);
        set(x, y, BRASS, g > 0.15 ? 1.15 : 0.5, g > 0.5 ? 0.6 : 0.1);
      } else {
        const rs = hyp(x - DX, y - SY);
        if (rs <= 3.6 && rs >= 2.4) set(x, y, SILVER, 0.9);
        else set(x, y, BRASS, 0.6 + 0.06 * hash(x, y), 0.05);
      }
    }
  for (const wx of [27, 37]) set(wx, DY + 5, DARK, 1);
  // Trunk: carcass, pilasters, the arched glass door and its escutcheon.
  box(18, 57, 46, 101, WOOD, woodV);
  for (const px of [18, 19, 45, 46]) for (let y = 57; y <= 101; y++) set(px, y, WOOD, grain(px, y, false) * (px === 18 ? 1.3 : px === 46 ? 0.55 : 0.85));
  for (let y = 58; y <= 101; y++)
    for (let x = 21; x <= 43; x++) {
      const glass = x >= 23 && x <= 41 && y <= 99 && (y >= 69 || hyp(x - DX, y - 69) <= 9.5);
      if (glass) set(x, y, INSIDE, grain(x, y, false) * (0.85 + 0.15 * Math.cos((x - DX) * 0.2)));
      else if (y >= 69 || hyp(x - DX, y - 69) <= 11.5) set(x, y, WOOD, grain(x, y, false) * (x < DX ? 1.15 : 0.85));
    }
  set(42, 82, BRASS, 1, 1);
  set(42, 83, DARK, 1);
  // Base: a moulding, the plinth with a figured panel, skirt and feet.
  mould(15, 102, 49, 105);
  box(16, 106, 48, 120, WOOD, woodV);
  for (let y = 109; y <= 117; y++)
    for (let x = 20; x <= 44; x++) {
      const f = Math.sin(hyp(x - DX, (y - 113) * 2.2) * 1.3 + hash(x >> 1, y >> 1) * 1.5);
      set(x, y, WOOD, x === 20 || y === 109 ? 1.3 : x === 44 || y === 117 ? 0.55 : 0.95 + 0.18 * f);
    }
  mould(14, 121, 50, 123);
  for (const fx of [14, 45]) box(fx, 124, fx + 5, 126, WOOD, (x, y) => grain(x, y, true) * (y === 124 ? 1.2 : 0.8));
  // The window: a patch from the upper right, crossed by its glazing bars.
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p - x) / W;
    const u = x + 0.7 * y;
    const v = y - 0.45 * x;
    let mo = clamp((u - 58) / 4, 0, 1) * clamp((116 - u) / 4, 0, 1) * clamp((v + 2) / 4, 0, 1) * clamp((104 - v) / 4, 0, 1);
    if (Math.abs(u - 77) < 1.2 || Math.abs(u - 97) < 1.2 || Math.abs(v - 50) < 1.2) mo *= 0.25;
    P.win[p] = (0.12 + mo) * (mat[p] === INSIDE ? 0.5 : 1);
  }
  P.candleAt = null;
  P.started = false;
  P.t = 0;
  P.flare = 0;
  P.blows = 0;
  P.nextBlow = 0;
  P.day = 0;
}

// Candlelight on every LED from a candle at table height, 30 LEDs in front
// of the clock, at column cx; the case throws its shadow on the wall on the
// far side, and the flame shows as a streak in both panes of glass.
function light(P, cx) {
  const { mat } = P;
  const off = clamp((5 * (32 - cx)) / 66, -6, 6);
  // Scaled so the nearest edge of the case gets the same light wherever
  // the candle stands.
  const near = 1.6 * (1 + (Math.max(0, Math.abs(cx - DX) - 18) ** 2 + 900) / 2600);
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p - x) / W;
    let l = 1 / (1 + ((x - cx) ** 2 + (y - 74) ** 2 + 900) / 2600);
    const m = mat[p];
    if (m === WALL || m === SKIRT || m === FLOOR) {
      const sx = Math.round(x - off);
      const sm = sx >= 0 && sx < W ? mat[p + sx - x] : WALL;
      if ((x > 46 || x < 18) && sm !== WALL && sm !== SKIRT && sm !== FLOOR) l *= 0.3;
    }
    if (m === INSIDE) l *= 0.45;
    P.lamp[p] = l * near;
    const glass = m === INSIDE || (y >= 14 && y <= 50 && x >= 18 && x <= 46 && (m === BRASS || m === SILVER || m === DARK));
    P.sheen[p] = glass ? Math.exp(-((x - 0.35 * y - (y < 57 ? 13 : -3) + (cx + 34) * 0.15) ** 2) / 3) * 0.16 : 0;
  }
}

// Clock seconds per real second for the Speed knob.
function rate(k) {
  return k <= 2 ? 60 ** (k / 2) : 60 * (100000 / 60) ** (k - 2);
}

function advance(P, dt, speed) {
  const r = rate(speed);
  const hourBefore = Math.floor(P.clock / 3600);
  P.clock += dt * r;
  P.t += dt;
  // Eight days of fall on the weights; wound again at the bottom.
  P.fall += (dt * r) / (8 * 86400);
  if (P.fall > 1) P.fall -= 1;
  // The strike is held off while the hands are spun round fast.
  if (Math.floor(P.clock / 3600) !== hourBefore && P.blows === 0 && r < 3000) {
    P.blows = Math.floor(P.clock / 3600) % 12 || 12;
    P.nextBlow = P.t;
  }
  if (P.blows > 0 && P.t >= P.nextBlow) {
    P.blows--;
    P.flare = 1;
    P.nextBlow = P.t + 1.5;
  }
  P.flare *= Math.exp(-dt / 0.45);
  // Daylight in the window, eased so days that fly by read as a glow.
  const h = (P.clock / 3600) % 24;
  const sun = clamp((h - 5.5) / 2, 0, 1) * clamp((19.5 - h) / 2, 0, 1);
  P.day += (sun - P.day) * (1 - Math.exp(-dt / 0.8));
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.wood = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3);
  P.rate = rate(speed);
  const cx = Math.round((-34 + 132 * clamp(k[2], 0, 1)) * 2) / 2;
  if (cx !== P.candleAt) {
    P.candleAt = cx;
    light(P, cx);
  }
  P.lampK = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    // Eight and a half minutes to ten at night, twelve days into the
    // moon's month, weights half down; then six seconds at the knob's pace,
    // so at Speed 2 it strikes ten from 2.5 s on.
    P.clock = 21 * 3600 + 51.5 * 60;
    P.age = 12.4;
    P.fall = 0.45;
    for (let i = 0; i < 180; i++) advance(P, 1 / 30, speed);
    P.t = 0;
    P.nextBlow = 0;
  }
  advance(P, dt, speed);
}

function woodColour(w) {
  const f = w * 3;
  const i = Math.min(2, Math.floor(f));
  const u = f - i;
  return WOODS[i].map((c, j) => c + (WOODS[i + 1][j] - c) * u);
}

// A line of width w from (x0, y0) to (x1, y1), blended over the buffer.
function stroke(buf, x0, y0, x1, y1, w, c, a) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L2 = dx * dx + dy * dy || 1;
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - w - 1));
  const yb = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + w + 1));
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - w - 1));
  const xb = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + w + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const u = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1);
      const ex = x - x0 - u * dx;
      const ey = y - y0 - u * dy;
      const al = clamp(w + 0.5 - Math.sqrt(ex * ex + ey * ey), 0, 1) * a;
      if (al <= 0) continue;
      const p = (y * W + x) * 3;
      for (let i = 0; i < 3; i++) buf[p + i] += (c[i] - buf[p + i]) * al;
    }
}

export function draw(display, params) {
  const P = params;
  const buf = P.buf;
  const t = P.t;
  const lk = P.lampK;
  // The candle breathes and flickers in a draught, and jumps at each blow.
  const fl = (1 + (1 - lk) * (0.1 * Math.sin(0.62 * t + 0.4) + 0.05 * Math.sin(1.9 * t + 1.1) + 0.03 * Math.sin(5.3 * t + 2) + 0.02 * Math.sin(13.1 * t))) * (1 + 0.22 * P.flare);
  const L = P.light;
  // The window: moonlight at night, brighter near the full moon, and
  // daylight when the clock is run on into the day.
  const lunar = ((P.age + P.clock / 86400) % 29.53) / 29.53;
  const full = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(2 * Math.PI * lunar));
  for (let i = 0; i < 3; i++) {
    L[i] = 0.05 + (0.2 - 0.025 * i) * P.day;
    L[3 + i] = CANDLE[i] * (1 - lk) * fl;
    L[6 + i] = MOONC[i] * lk * 1.5 * full * (1 - P.day) + SUN[i] * 2.2 * P.day;
    L[9 + i] = L[i] + L[3 + i] * 0.55 + L[6 + i] * 0.5;
  }
  const wood = woodColour(P.wood);
  for (let m = 0; m < COL.length; m++)
    for (let i = 0; i < 3; i++) P.pal[m * 3 + i] = m === WOOD ? wood[i] : m === INSIDE ? wood[i] * 0.45 + 6 : COL[m][i];
  shadeAll(P, buf, L);
  if (P.flare > 0.02) fret(P, buf);
  moonDisc(P, buf, L, lunar);
  hands(P, buf, L);
  hammer(P, buf, L);
  pendulum(P, buf, L, t);
  weights(P, buf, L);
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p & 63, p >> 6, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
}

// Every LED lit by the room: ambient, candle and window.
function shadeAll(P, buf, L) {
  const { mat, tone, spec, lamp, win, sheen, pal } = P;
  const a0 = L[0];
  const a1 = L[1];
  const a2 = L[2];
  const l0 = L[3];
  const l1 = L[4];
  const l2 = L[5];
  const m0 = L[6];
  const m1 = L[7];
  const m2 = L[8];
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const q = mat[p] * 3;
    const tn = tone[p];
    const la = lamp[p];
    const mo = win[p];
    const s = spec[p] * 255;
    const g = (s * 0.5 + sheen[p] * 255) * la;
    const sm = s * 0.3 * mo;
    buf[o] = pal[q] * tn * (a0 + l0 * la + m0 * mo) + g * l0 + sm * m0;
    buf[o + 1] = pal[q + 1] * tn * (a1 + l1 * la + m1 * mo) + g * l1 + sm * m1;
    buf[o + 2] = pal[q + 2] * tn * (a2 + l2 * la + m2 * mo) + g * l2 + sm * m2;
  }
}

// At each blow the bell flashes and rings, and the fret round the dial
// arch catches it.
function fret(P, buf) {
  const f = P.flare;
  for (let p = 0; p < 30 * W; p++) {
    const m = P.mat[p];
    if (m !== FRET && m !== BELL) continue;
    const h = m === BELL ? f * (0.6 + 0.4 * Math.sin(P.t * 50 + (p % W))) : f * 0.5 * hash(p, 3);
    buf[p * 3] += 255 * h;
    buf[p * 3 + 1] += 205 * h;
    buf[p * 3 + 2] += 120 * h;
  }
  for (let y = 0; y <= 14; y++)
    for (let x = 20; x <= 44; x++) {
      const h = 70 * f * Math.exp(-((x - DX) ** 2 + (y - 5) ** 2) / 28);
      const o = (y * W + x) * 3;
      buf[o] += h;
      buf[o + 1] += h * 0.8;
      buf[o + 2] += h * 0.5;
    }
}

// The hammer: an arm up through the moulding to the right of the bell,
// lifted back before each blow and let fall on it.
function hammer(P, buf, L) {
  const wait = P.blows > 0 ? P.nextBlow - P.t : 9;
  const lift = clamp((0.5 - wait) / 0.5, 0, 1) ** 2 * 0.7;
  const a = -0.45 - lift;
  const hx = 38 + 6 * Math.sin(a);
  const hy = 12 - 6 * Math.cos(a);
  const col = P.hcol;
  stroke(buf, 38, 12, hx, hy, 0.35, col, 1);
  stroke(buf, hx - 0.6, hy - 0.4, hx + 0.6, hy + 0.4, 0.9, col, 1);
}

// The moon disc in the arch, turning once in two lunations, its moon
// hidden and shown by the two painted humps.
function moonDisc(P, buf, L, lunar) {
  const phi = Math.PI * (lunar * 2 - 1);
  const ca = Math.cos(phi);
  const sa = Math.sin(phi);
  const d0 = L[0] + L[3] * 0.7 + L[6] * 0.5 + 0.12;
  const d1 = L[1] + L[4] * 0.7 + L[7] * 0.5 + 0.12;
  const d2 = L[2] + L[5] * 0.7 + L[8] * 0.5 + 0.12;
  for (let y = AY - 13; y < AY; y++)
    for (let x = DX - 13; x <= DX + 13; x++) {
      const p = y * W + x;
      if (P.mat[p] !== DARK || hyp(x - DX, y - AY) > AR) continue;
      let r;
      let g;
      let b;
      const hx = x < DX ? DX - 6.5 : DX + 6.5;
      if (hyp(x - hx, y - AY) < 6.3) {
        const land = hyp(x - hx - 1, y - AY + 2) < 3.5;
        r = land ? 110 : 50;
        g = land ? 160 : 100;
        b = land ? 90 : 170;
      } else {
        const u = (x - DX) * ca + (y - AY) * sa;
        const v = (y - AY) * ca - (x - DX) * sa;
        const dm = Math.min(hyp(u, v + 7.5), hyp(u, v - 7.5));
        if (dm < 4.3) (r = 245), (g = 232), (b = 190);
        else if (dm < 5) (r = 200), (g = 170), (b = 110);
        else if (hash(Math.round(u * 1.3) + 40, Math.round(v * 1.3) + 40) > 0.93) (r = 250), (g = 210), (b = 110);
        else (r = 28), (g = 46), (b = 120);
      }
      buf[p * 3] = r * d0;
      buf[p * 3 + 1] = g * d1;
      buf[p * 3 + 2] = b * d2;
    }
}

// Hands: blued steel. A hand swept faster than the eye fades to a blur.
function hands(P, buf, L) {
  const T = P.clock;
  const r = P.rate;
  const col = P.hcol;
  for (let i = 0; i < 3; i++) col[i] = 12 + 30 * L[3 + i] + 20 * L[6 + i] + (i === 2 ? 10 : 0);
  const hand = (turns, len, w, tail, perFrame) => {
    const a = turns * 2 * Math.PI;
    const sx = Math.sin(a);
    const cy = -Math.cos(a);
    stroke(buf, DX - sx * tail, DY - cy * tail, DX + sx * len, DY + cy * len, w, col, clamp(1.6 - perFrame / 20, 0.15, 1));
  };
  hand(T / 43200, 7.5, 1.2, 2, r / 3600);
  hand(T / 3600, 12, 0.75, 3, r / 300);
  const sec = r < 2 ? Math.floor(T) : T;
  const sa = (sec / 60) * 2 * Math.PI;
  stroke(buf, DX, SY, DX + 3.2 * Math.sin(sa), SY - 3.2 * Math.cos(sa), 0.3, col, clamp(1.6 - r / 15, 0.2, 1));
}

// The bob's shadow on the backboard, the rod and the brass bob, beating
// seconds whatever the clock's own speed.
function pendulum(P, buf, L, t) {
  const th = Math.asin(ARC / (BOB - PIV)) * Math.sin(Math.PI * t);
  const bx = DX + (BOB - PIV) * Math.sin(th);
  const by = PIV + (BOB - PIV) * Math.cos(th);
  for (let y = Math.floor(by - 5); y <= by + 8; y++)
    for (let x = Math.floor(bx - 3); x <= bx + 10; x++) {
      const p = y * W + x;
      if (P.mat[p] !== INSIDE) continue;
      const sh = 0.45 + 0.55 * clamp((hyp(x - bx - 3.5, y - by - 1.5) - 3) / 3, 0, 1);
      buf[p * 3] *= sh;
      buf[p * 3 + 1] *= sh;
      buf[p * 3 + 2] *= sh;
    }
  const rod = P.rod;
  for (let i = 0; i < 3; i++) rod[i] = [200, 150, 80][i] * L[9 + i];
  stroke(buf, DX, DT, bx, by, 0.45, rod, 1);
  for (let y = Math.floor(by - 6); y <= by + 6; y++)
    for (let x = Math.floor(bx - 6); x <= bx + 6; x++) {
      const d = hyp(x - bx, (y - by) * 1.05);
      if (d > 5.2) continue;
      const a = clamp(5.2 - d, 0, 1);
      const shade = 0.75 + 0.3 * ((bx - x) / 5) + 0.15 * ((by - y) / 5);
      const hl = 255 * Math.exp(-((x - bx + 1.6) ** 2 + (y - by + 1.6) ** 2) / 2.2);
      const p = (y * W + x) * 3;
      for (let i = 0; i < 3; i++) {
        const c = COL[BRASS][i] * shade * (L[9 + i] + 0.15) + hl * (L[3 + i] * 0.8 + L[6 + i] * 0.4);
        buf[p + i] += (c - buf[p + i]) * a;
      }
    }
}

// Going weight on the right, striking weight on the left, each under a
// pulley on a doubled cable; the striking train runs down a little faster.
function weights(P, buf, L) {
  const cab = P.cab;
  for (let i = 0; i < 3; i++) cab[i] = [110, 100, 90][i] * L[9 + i] + 8;
  const pul = P.pul;
  for (let i = 0; i < 3; i++) pul[i] = [150, 120, 70][i] * L[9 + i];
  for (let w = 0; w < 2; w++) {
    const wx = w ? 38 : 26;
    const wy = 64 + 26 * (w ? P.fall : (P.fall * 1.06) % 1);
    stroke(buf, wx - 1.5, DT, wx - 1.5, wy - 2, 0.2, cab, 0.8);
    stroke(buf, wx + 1.5, DT, wx + 1.5, wy - 2, 0.2, cab, 0.8);
    stroke(buf, wx - 1.5, wy - 2.5, wx + 1.5, wy - 2.5, 0.6, pul, 1);
    for (let y = Math.round(wy); y <= wy + 12; y++)
      for (let x = wx - 2; x <= wx + 2; x++) {
        const p = (y * W + x) * 3;
        const cyl = Math.cos(((x - wx + 0.6) / 3) * 1.4);
        for (let i = 0; i < 3; i++) buf[p + i] = COL[BRASS][i] * (0.35 + 0.75 * cyl) * (L[9 + i] + 0.1) + 96 * cyl ** 8 * L[3 + i];
      }
  }
}
