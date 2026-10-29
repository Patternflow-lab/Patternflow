// ===== Patternflow pattern =====
// Title:   Josephus Problem
// Family:  rhythm
// Idea:    A circle of n lamps fills the top half and a hand goes round it one place a tick, each lamp it passes still lit a beat and every k-th beat an accent that puts that lamp out, so the beat thins into rests as the circle empties, with a roll inside the ring drawing that rhythm and the survivor's number coming up when one lamp is left, while the bottom half holds the table of every circle from 1 to 64 lamps, one row each, coloured by the order its places went out with the survivor white, so the survivors J(n,k) run down the panel as a sawtooth and the row of the circle on top lights as it plays.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Josephus problem (Flavius Josephus, The Jewish War, 1st century; counting-out puzzle in Claude Gaspard Bachet's Problèmes plaisans et délectables, 1612), closed form J(2^m + L) = 2L + 1 (Graham, Knuth and Patashnik, Concrete Mathematics, 1989, chapter 1), pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Step=2..7, Circle=8..64
//
// Knob 1: Hue. Turns the colours of the places put out round the wheel: at 0 the first ones out are a deep blue and the later ones teal, green and gold up to the white survivor, with the lamps still lit a cool white; at 0.25 they run from rose through orange and yellow to green, at 0.5 from yellow-green through red and magenta to blue.
// Knob 2: Speed. The counting tempo: at 2 the hand passes 2(2 + n/6) places a second while every lamp is lit, 6.7 on the opening circle of 8 and 25 on a circle of 64, and hurries by the square root of n over the lamps left as they go out, so the circle of 8 is down to one lamp in 2.1 s and the circle of 64 in 6.4 s, each survivor then holding 1.3 s. At 0.2 the circle of 8 takes 21 s, at 3 it takes 1.4 s.
// Knob 3: Step. k, the beat that goes out, 2 to 7. At 2, the classic, every second lamp goes, a circle of 16 halves its beats every time round (xXxX, x.X., x...X...) and the survivor column climbs 2 places a row and drops back to place 1 at 4, 8, 16, 32 and 64; at 3 it climbs 3 a row and drops at 4, 6, 9, 14, 21, 31 and 47; at 7 there are 15 drops and the roll counts up 1 to 7 in a staircase. A new k redraws the table and starts the circle on top again.
// Knob 4: Circle. The circle the top starts from, 8 to 64 lamps, and the row of the table that lights with it. After each survivor the next circle has one lamp more, so from 8 the top reaches 64 in 6 minutes at Speed 2, and after 64 it comes back to this one.

const W = 64, H = 128, NMAX = 64, TOP = 63;
const { floor, round, min, max, abs, sqrt, exp, atan2, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The circle: centre (32, 32) in LED units, lamps between radius 22 and
// 30.5, the hand's marker just inside them, place 0 at twelve o'clock and
// the places counting clockwise.
const CX = 32, CY = 32, R1 = 22, R2 = 30.5, HR0 = 18.8, HR1 = 21.2, BR = 17.5;
// The rhythm roll inside the circle: one column per tick, newest on the
// right, bars standing on row SB.
const SX0 = 14, SX1 = 49, SB = 43, SN = SX1 - SX0 + 1;
// The hue of the first place out at knob 0, a deep blue.
const HUE0 = 0.7, WHITE = [1, 1, 1];

// 3 x 5 digits, row by row from the top, three bits a row.
const FONT = [
  0b111101101101111, 0b010110010010111, 0b111001111100111, 0b111001111001111, 0b101101111001001,
  0b111100111001111, 0b111100111101111, 0b111001001001001, 0b111101111101111, 0b111101111001111,
];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Every pixel of the top square that a lamp or the hand can light, with its
// angle as a fraction of a turn clockwise from twelve and its radius.
const RING = (() => {
  const idx = [], ang = [], rad = [];
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = sqrt(dx * dx + dy * dy);
      if (r < BR || r > R2 + 0.6) continue;
      let a = atan2(dx, -dy) / (2 * PI);
      if (a < 0) a += 1;
      idx.push(y * W + x), ang.push(a), rad.push(r);
    }
  return { idx: Int32Array.from(idx), ang: Float32Array.from(ang), rad: Float32Array.from(rad) };
})();

// The table: for each circle n = 1..64 and each place, the turn at which it
// went out, 0 first and n - 1 the survivor. Counting starts at place 0 as 1,
// the k-th lamp counted goes out and counting goes on from the next lamp
// still lit, the same walk the hand makes on top; its survivor is J(n, k),
// with J(1) = 0 and J(n) = (J(n - 1) + k) mod n.
function table(k) {
  const ord = [], surv = new Int32Array(NMAX + 1);
  for (let n = 1; n <= NMAX; n++) {
    const o = new Int32Array(n), on = new Uint8Array(n).fill(1);
    let left = n, count = 0, r = 0;
    for (let j = 0; left > 1; j++) {
      const q = j % n;
      if (on[q] && ++count === k) (on[q] = 0), (o[q] = r++), (count = 0), left--;
    }
    surv[n] = on.indexOf(1);
    o[surv[n]] = n - 1;
    ord[n] = o;
  }
  return { ord, surv };
}

// A fresh circle of n lamps, all lit, the hand just before place 0.
function begin(S, n) {
  S.n = n, S.alive.fill(0), S.alive.fill(1, 0, n), S.left = n, S.count = 0;
  S.j = 0, S.ph = 0.55, S.phase = n > 1 ? 0 : 1, S.ht = 0, S.born = S.t;
  S.flash.fill(0), S.gone.fill(-9);
  roll(S, -1);
}

function roll(S, mark, c) {
  S.roll[S.rh] = mark;
  if (c) S.rollc[S.rh * 3] = c[0], S.rollc[S.rh * 3 + 1] = c[1], S.rollc[S.rh * 3 + 2] = c[2];
  S.rh = (S.rh + 1) % SN;
}

// The colour of place i of circle m by the turn it went out at: the first
// ones out a deep blue, then teal and green to gold for the last ones out,
// rising in light, and the survivor white.
function cellColour(S, m, i, o) {
  const r = S.tab.ord[m][i];
  if (r >= m - 1) return (o[0] = 1), (o[1] = 1), (o[2] = 1), o;
  const u = m > 2 ? r / (m - 2) : 0;
  return hsv(HUE0 + S.hue - 0.56 * u, 0.9 - 0.3 * u, 0.17 + 0.56 * pow(u, 1.8), o);
}

// The hand reaches place j mod n: a lit lamp is a beat, the k-th beat puts
// it out; a lamp already out is a rest.
function tick(S) {
  const q = S.j % S.n;
  S.j++;
  if (!S.alive[q]) return roll(S, 0);
  S.count++;
  S.flash[q] = 1;
  if (S.count < S.k) return roll(S, S.count);
  S.alive[q] = 0, S.gone[q] = S.t, S.count = 0, S.left--;
  roll(S, 9, cellColour(S, S.n, q, S.c));
  if (S.left <= 1) (S.phase = 1), (S.ht = 0);
}

export function setup(params) {
  const S = (params.s = {
    t: 0, hue: 0, speed: 2, k: 2, n0: 8, n: 8, alive: new Uint8Array(NMAX), flash: new Float32Array(NMAX),
    gone: new Float32Array(NMAX), left: 8, count: 0, j: 0, ph: 0, phase: 0, ht: 0, born: 0,
    roll: new Int8Array(SN).fill(-2), rollc: new Float32Array(SN * 3), rh: 0,
    fb: new Float32Array(W * H * 3), lamp: new Float32Array(NMAX * 3), burst: new Float32Array(NMAX), c: [0, 0, 0], pale: [0, 0, 0], tab: table(2),
  });
  begin(S, 8);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 2, 8], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  const k = cl(round(kv[2]), 2, 7), n0 = cl(round(kv[3]), 8, NMAX);
  if (k !== S.k) (S.k = k), (S.tab = table(k)), begin(S, S.n);
  if (n0 !== S.n0) (S.n0 = n0), begin(S, n0);
  for (let i = 0; i < S.n; i++) S.flash[i] *= exp(-d / 0.09);
  if (S.phase === 0) {
    // Ticks a second: more for a bigger circle, and faster as it empties.
    let left = d;
    while (left > 0 && S.phase === 0) {
      const rate = S.speed * (2 + S.n / 6) * sqrt(S.n / S.left), need = (1 - S.ph) / rate;
      if (need > left) {
        S.ph += left * rate;
        break;
      }
      left -= need, S.ph = 0;
      tick(S);
    }
  } else if ((S.ht += d) > 0.7 + 1.2 / S.speed) {
    // The next circle has one lamp more; after 64 the top goes back to the
    // circle the Circle knob names.
    begin(S, S.n < NMAX ? S.n + 1 : S.n0);
  }
}

function add(fb, p, r, g, b, a) {
  fb[p * 3] += r * a, fb[p * 3 + 1] += g * a, fb[p * 3 + 2] += b * a;
}

// A number in doubled 3 x 5 digits, centred on column cx, its top on row y.
function number(fb, v, cx, y, col, a) {
  const str = String(v), x0 = round(cx - (str.length * 8 - 2) / 2);
  for (let d = 0; d < str.length; d++) {
    const g = FONT[str.charCodeAt(d) - 48];
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 3; q++)
        if ((g >> (14 - r * 3 - q)) & 1)
          for (let e = 0; e < 4; e++) add(fb, (y + r * 2 + (e >> 1)) * W + x0 + d * 8 + q * 2 + (e & 1), col[0], col[1], col[2], a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const fb = S.fb, c = S.c, n = S.n, t = S.t, lamp = S.lamp;
  fb.fill(0);
  // Lamps still lit are a cool white that the hue knob tints a little.
  const pale = hsv(HUE0 + S.hue - 0.1, 0.14, 0.9, S.pale);
  const fin = S.phase === 1, glow = fin ? 0.8 + 0.2 * Math.cos(S.ht * 9) : 0;
  const fresh = cl((t - S.born) / 0.25, 0, 1);

  // Lamp colours for this frame.
  for (let i = 0; i < n; i++) {
    let r, g, b;
    if (S.alive[i]) {
      const f = S.flash[i], v = fin ? glow : (0.5 + 0.5 * f) * fresh;
      r = fin ? 1 : pale[0] + (1 - pale[0]) * f, g = fin ? 0.97 : pale[1] + (1 - pale[1]) * f, b = fin ? 0.9 : pale[2] + (1 - pale[2]) * f;
      r *= v, g *= v, b *= v;
    } else {
      cellColour(S, n, i, c);
      const a = exp(-(t - S.gone[i]) / 0.22), dim = fin ? 0.7 : 0.42;
      r = c[0] * dim + a, g = c[1] * dim + a * 0.95, b = c[2] * dim + a * 0.9;
    }
    lamp[i * 3] = r, lamp[i * 3 + 1] = g, lamp[i * 3 + 2] = b;
    S.burst[i] = S.alive[i] ? 0 : exp(-(t - S.gone[i]) / 0.2);
  }

  // The lamps, as n wedges of the ring with a gap of about one LED between
  // them, a lamp put out bursting inward for a moment, and the hand as a
  // short bright mark just inside them.
  const hand = fin ? -1 : (((S.j - 1 + S.ph) % n) + n) % n;
  const I = RING.idx, A = RING.ang, RR = RING.rad;
  for (let q = 0; q < I.length; q++) {
    const r = RR[q], p = I[q];
    const u = A[q] * n + 0.5, i = floor(u) % n, f = u - floor(u);
    const side = cl(min(f, 1 - f) * ((2 * PI * r) / n) - 0.1, 0, 1);
    if (r >= R1 - 0.5) {
      const a = side * cl(r - R1 + 0.5, 0, 1) * cl(R2 - r + 0.5, 0, 1);
      if (a > 0) add(fb, p, lamp[i * 3], lamp[i * 3 + 1], lamp[i * 3 + 2], a);
      continue;
    }
    if (S.burst[i] > 0.02) add(fb, p, 1, 0.95, 0.9, S.burst[i] * side * (0.35 + 0.65 * cl((r - BR) / (R1 - BR), 0, 1)));
    if (hand >= 0 && r >= HR0 && r <= HR1) {
      let da = abs(A[q] - hand / n);
      if (da > 0.5) da = 1 - da;
      const a = cl(1.7 - da * 2 * PI * r, 0, 1);
      if (a > 0) add(fb, p, 1, 1, 1, a * 0.9);
    }
  }

  // The circle's size on top inside the ring, and once it is down to one
  // lamp the survivor's place counted from 1, in white.
  if (fin) number(fb, S.tab.surv[n] + 1, CX, 15, WHITE, glow);
  else number(fb, n, CX, 15, pale, 0.55);

  // The rhythm roll: a rest is a dot, a beat a bar as tall as its count, the
  // k-th beat a full bar in the colour of the lamp it put out; a new circle
  // leaves a dotted rule.
  for (let s = 0; s < SN; s++) {
    const h = (S.rh + s) % SN, m = S.roll[h], x = SX0 + s, v = 0.3 + 0.7 * ((s + 1) / SN);
    if (m === -2) continue;
    if (m === -1) for (let y = SB - 12; y <= SB; y += 2) add(fb, y * W + x, 0.35, 0.35, 0.4, v);
    else if (m === 0) add(fb, SB * W + x, 0.4, 0.38, 0.36, v);
    else if (m < 9) {
      const bh = 1 + round((10 * m) / S.k);
      for (let y = SB - bh + 1; y <= SB; y++) add(fb, y * W + x, pale[0], pale[1], pale[2], v * 0.8);
    } else {
      const rc = S.rollc;
      for (let y = SB - 12; y <= SB; y++) add(fb, y * W + x, rc[h * 3] * 0.6 + 0.4, rc[h * 3 + 1] * 0.6 + 0.4, rc[h * 3 + 2] * 0.6 + 0.4, v);
    }
  }

  // The table: circle m on panel row 63 + m, place i in column i, the
  // current row lit and filling in as the circle plays it, with the hand
  // as a white cell.
  for (let m = 1; m <= NMAX; m++) {
    const y = TOP + m, cur = m === n, gain = cur ? 1 : 0.9;
    for (let i = 0; i < m; i++) {
      const p = y * W + i;
      if (cur && S.alive[i] && !fin) {
        add(fb, p, pale[0], pale[1], pale[2], 0.55 * fresh + 0.45 * S.flash[i]);
        continue;
      }
      cellColour(S, m, i, c);
      let a = gain;
      if (cur && !fin) a += exp(-(t - S.gone[i]) / 0.22);
      if (cur && fin && S.tab.surv[m] === i) a = 0.5 + 0.7 * glow;
      add(fb, p, c[0], c[1], c[2], a);
    }
    if (cur) {
      // The current row runs out to the right edge as a dotted line.
      for (let x = m + 1; x < W; x += 2) add(fb, y * W + x, pale[0], pale[1], pale[2], 0.35);
      if (hand >= 0) add(fb, y * W + (round(hand) % m), 1, 1, 1, 1);
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, min(255, fb[k] * 255) | 0, min(255, fb[k + 1] * 255) | 0, min(255, fb[k + 2] * 255) | 0);
    }
}
