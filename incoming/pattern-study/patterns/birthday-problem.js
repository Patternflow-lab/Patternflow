// ===== Patternflow pattern =====
// Title:   Birthday Problem
// Family:  data
// Idea:    People walk into a room one at a time and each lights the day of the year they were born on a calendar of cells until some day is lit twice, the pair is linked and the room starts again, while under the calendar the exact chance 1 - 365!/((365 - n)! 365^n) that it has happened by n people climbs past one half at n = 23, with a marker at the room's n and dots for the share of simulated rooms that did it, scattered around the curve.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The birthday problem (Richard von Mises, 1939, year from memory), its version where birthdays within r days of each other count as a match (Abramson and Moser, 1970, year from memory), Monte Carlo rooms drawn from the same generator; the 3 by 5 digits of Edit Distance (pattern round 110); pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..6, Year=-1..1, Reach=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the people and their calendar cells are cyan, the curve and the water under it violet, the simulated rooms lime, and the pair that met is orange in a white frame, with a pale ring that goes out over the panel and a dashed line down to its place on the curve (a white link too when the two cells differ); the digits are the colour of what they count. Orange is made paler so it does not dim to brown.
// Knob 2: Speed. How many people walk in a second, 2.5 times the knob: 5 at 2, where 23 people take 4.6 s, 1.25 at 0.5 and 15 at 6. A room holds 2.2 s after its pair meets, fades for 0.5 s and starts again, and the simulated rooms keep being replaced at 8 a second whatever this is.
// Knob 3: Year. How many days the year has, 365 times 3 to the power of the knob, whole days: 122 at -1, 211 at -0.5, 365 at 0 (where it opens), 632 at 0.5 and 1095 at 1. The calendar is cells of 5, 4, 3 or 2 LEDs to fit, 12 by 11 cells at 122 days and 32 by 35 at 1095, and the number of people it takes to pass one half moves as about 1.18 times the square root of the days: the number over the dashed crossing reads 14, 18, 23, 30 and 40 (the exact count, the first n where the chance is at least one half).
// Knob 4: Reach. How close two birthdays must be to count as a match, in days either side, snapping at whole numbers: 0 the same day (where it opens), 1 the day before or after as well, 2 and 3. Each person then lights a band of 2 times the knob plus 1 cells, dimmer round the one cell that is theirs, and the half-way count falls to 23, 14, 11 and 9 at 365 days.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow are paler and a little lighter.
function tint(h, s, v) {
  const f = fr(h), out = [0, 0, 0];
  if (f > 0.02 && f < 0.2) {
    s *= 0.6;
    v = min(1, v * 1.2);
  }
  hsv(h, s, v, out);
  return out;
}

// The ten digits and a percent sign, 3 wide and 5 tall, copied from edit-distance.js.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "%": "#.#|..#|.#.|#..|#.#",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

const MAXD = 1100; // 365 * 3 = 1095 is the longest year
const NP = 400; // the exact curve is worked out for 0 to this many people
const NX = 72; // the plot runs from 0 to this many people, where 365 days are 99.9 percent
const MPOOL = 200; // simulated rooms kept
const BG = 8; // simulated rooms replaced each second
const HOLD = 2.2, FADE = 0.5;

// The calendar: cells of p LEDs in as many columns as fit, the biggest p whose
// rows stay under 72 LEDs. A lit cell is p - 1 LEDs across, with a dark LED between
// it and the next, except at p = 3 and p = 2, where it fills the cell.
function layout(d) {
  let p = 2;
  for (const q of [6, 5, 4, 3, 2]) {
    if (ceil(d / floor(W / q)) * q <= 72) {
      p = q;
      break;
    }
  }
  const cols = floor(W / p), rows = ceil(d / cols);
  return { p, cols, rows, sz: p === 3 ? 3 : p >= 4 ? p - 1 : 2, x0: floor((W - cols * p) / 2), y0: 10, bot: 10 + rows * p };
}

// The exact chance that at least two of n people are within r days of each other
// round a year of d days: 1 minus the product of (b + k) / d for k = 1 to n - 1,
// where b = d - n (r + 1). At r = 0 that is 1 - d! / ((d - n)! d^n). Beyond
// d / (r + 1) people it is 1, whatever they do.
function exactP(d, r, N) {
  const P = new Float64Array(N + 1);
  for (let n = 2; n <= N; n++) {
    const b = d - n * (r + 1);
    if (b < 0) {
      P[n] = 1;
      continue;
    }
    let q = 1;
    for (let k = 1; k < n; k++) q *= (b + k) / d;
    P[n] = 1 - q;
  }
  return P;
}

// The day within r of `day`, round the year, that a person in this room already
// has: -1 if there is none. A person's day is marked with the room's stamp.
function near(mark, stamp, d, r, day) {
  if (mark[day] === stamp) return day;
  for (let j = 1; j <= r; j++) {
    let a = day - j, b = day + j;
    if (a < 0) a += d;
    if (b >= d) b -= d;
    if (mark[a] === stamp) return a;
    if (mark[b] === stamp) return b;
  }
  return -1;
}

// One whole room, drawn the way the live one is: people arrive with a birthday
// from the generator until one is near an earlier one. Returns how many were in
// the room then. Nothing in it knows when that will be.
function simRoom(S) {
  const st = ++S.stamp, d = S.d, r = S.r, mark = S.mark;
  for (let n = 1; ; n++) {
    const day = floor(Math.random() * d);
    if (near(mark, st, d, r, day) >= 0) return n;
    mark[day] = st;
  }
}

function poolPush(S, c) {
  S.pool[S.head] = c;
  S.head = (S.head + 1) % MPOOL;
}

function restart(S) {
  S.rst++;
  S.days.length = 0;
  S.n = 0;
  S.phase = 0;
  S.pair = null;
  S.acc = 0;
}

function configure(S, d, r) {
  S.d = d;
  S.r = r;
  S.lay = layout(d);
  S.P = exactP(d, r, NP);
  S.n50 = 2;
  while (S.n50 < NP && S.P[S.n50] < 0.5) S.n50++;
  S.mark.fill(0);
  S.stamp = 0;
  S.rmark.fill(0);
  S.rst = 0;
  S.head = 0;
  for (let i = 0; i < MPOOL; i++) poolPush(S, simRoom(S));
  restart(S);
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, d: 0, r: -1, t: 0, acc: 0, bg: 0,
    lay: null, P: null, n50: 0,
    mark: new Int32Array(MAXD + 8), stamp: 0,
    rmark: new Int32Array(MAXD + 8), rst: 0,
    born: new Float32Array(MAXD + 8),
    days: [], n: 0, phase: 0, tHit: 0, pair: null,
    pool: new Int16Array(MPOOL), head: 0,
    buf: new Float32Array(W * H * 3),
  };
}

// One person walks in. Their day is drawn; if it is within r of an earlier
// person's the room ends, with the pair on record.
function arrive(S) {
  const day = floor(Math.random() * S.d), hit = near(S.rmark, S.rst, S.d, S.r, day);
  S.n++;
  S.days.push(day);
  S.born[day] = S.t;
  if (hit >= 0) {
    S.pair = [hit, day];
    S.phase = 1;
    S.tHit = S.t;
    poolPush(S, S.n);
  } else S.rmark[day] = S.rst;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 6);
  const days = round(365 * pow(3, cl(k[2], -1, 1))), reach = cl(round(k[3]), 0, 3);
  if (days !== S.d || reach !== S.r) configure(S, days, reach);
  S.t += d;
  S.bg += d * BG;
  while (S.bg >= 1) {
    S.bg--;
    poolPush(S, simRoom(S));
  }
  if (S.phase === 0) {
    S.acc += d * S.speed * 2.5;
    while (S.acc >= 1 && S.phase === 0) {
      S.acc--;
      arrive(S);
    }
  } else if (S.t - S.tHit > HOLD + FADE) restart(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.lay) return;
  const buf = S.buf, L = S.lay, d = S.d, r = S.r, P = S.P, t = S.t;
  buf.fill(0);
  const put = (x, y, c, a) => {
    x = round(x);
    y = round(y);
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3, b = 1 - min(1, a);
    buf[o] = buf[o] * b + c[0] * min(1, a);
    buf[o + 1] = buf[o + 1] * b + c[1] * min(1, a);
    buf[o + 2] = buf[o + 2] * b + c[2] * min(1, a);
  };
  const rect = (x, y, w, h, c, a) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, a);
  };
  const glyph = (ch, x, y, c, a, sc = 1) => {
    const g = GLYPH[ch];
    if (!g) return;
    for (let p = 0; p < 15; p++) if (g[p]) rect(x + (p % 3) * sc, y + floor(p / 3) * sc, sc, sc, c, a);
  };
  // Digits left to right from x, each sc times its size; returns the x after the last.
  const text = (s, x, y, c, a, sc = 1) => {
    for (const ch of String(s)) {
      glyph(ch, x, y, c, a, sc);
      x += 4 * sc;
    }
    return x;
  };
  const mix = (c1, c2, f) => [c1[0] + (c2[0] - c1[0]) * f, c1[1] + (c2[1] - c1[1]) * f, c1[2] + (c2[2] - c1[2]) * f];
  const line = (x0, y0, x1, y1, c, a, dash) => {
    const n = max(abs(x1 - x0), abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) if (!dash || floor(i / dash) % 2 === 0) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
  };

  const hb = 0.5 + S.hue, WHITE = [1, 1, 1];
  const PEOPLE = tint(hb, 0.8, 1), CURVE = tint(hb + 0.3, 0.65, 1), DOT = tint(hb - 0.3, 0.6, 1), HOT = tint(hb - 0.43, 0.75, 1);
  // The room after its pair has met holds, then fades back to an empty calendar.
  const since = t - S.tHit, hit = S.phase === 1;
  const fm = hit ? 1 - sm((since - HOLD) / FADE) : 1;

  // The calendar. Every day is a faint dot; a person's day is a lit cell.
  const cellXY = (day) => [L.x0 + (day % L.cols) * L.p, L.y0 + floor(day / L.cols) * L.p];
  for (let i = 0; i < d; i++) {
    const [x, y] = cellXY(i);
    put(x, y, PEOPLE, 0.2);
  }
  const block = (day, c, a) => {
    const [x, y] = cellXY(day);
    rect(x, y, L.sz, L.sz, c, a);
  };
  const centre = (day) => {
    const [x, y] = cellXY(day);
    return [x + (L.sz - 1) / 2, y + (L.sz - 1) / 2];
  };
  if (r > 0)
    for (const day of S.days) for (let j = -r; j <= r; j++) if (j !== 0) block((day + j + d) % d, PEOPLE, 0.36 * fm);
  const last = hit ? S.days.length - 1 : -1;
  S.days.forEach((day, i) => {
    if (i === last) return;
    const age = t - S.born[day], flash = cl(1 - age / 0.4, 0, 1);
    block(day, mix(PEOPLE, WHITE, flash), (0.82 + 0.18 * flash) * fm);
  });

  let plumb = null;
  // The pair that met: the two cells in the colour of the event, a link between
  // them if they are not the same cell, a ring that goes out over the panel, and
  // a dashed line down to the point on the curve it belongs to.
  if (hit && S.pair) {
    const [a, b] = S.pair, pulse = 0.6 + 0.4 * abs(Math.sin(since * 7)), flash = cl(1 - since / 0.5, 0, 1);
    const cb = centre(b), ca = centre(a);
    const col = mix(HOT, WHITE, flash * 0.8);
    if (a !== b) line(ca[0], ca[1], cb[0], cb[1], WHITE, 0.85 * fm);
    block(a, col, fm);
    block(b, col, fm);
    // A frame round each of the two cells, three LEDs off.
    for (const day of a === b ? [a] : [a, b]) {
      const [x, y] = cellXY(day), x1 = x + L.sz + 2, y1 = y + L.sz + 2;
      for (let i = x - 3; i <= x1; i++) {
        put(i, y - 3, WHITE, pulse * fm);
        put(i, y1, WHITE, pulse * fm);
      }
      for (let j = y - 2; j < y1; j++) {
        put(x - 3, j, WHITE, pulse * fm);
        put(x1, j, WHITE, pulse * fm);
      }
    }
    for (const [R, am0] of [[since * 80, 0.9], [since * 80 - 7, 0.5]]) {
      if (since < 0.9 && R > 0) {
        const am = am0 * pow(1 - since / 0.9, 1.5), steps = ceil(R * 8);
        for (let i = 0; i < steps; i++) {
          const an = (i / steps) * 2 * Math.PI, c = Math.cos(an), s2 = Math.sin(an);
          put(cb[0] + R * c, cb[1] + R * s2, mix(HOT, WHITE, 0.6), am);
          put(cb[0] + (R + 1) * c, cb[1] + (R + 1) * s2, mix(HOT, WHITE, 0.6), am * 0.6);
        }
      }
    }
    plumb = cb;
  }

  // The plot: people along x, the chance up y.
  const PX0 = 1, SX = 62 / NX, PYB = 122, PYT = L.bot + 6, AX = 123;
  const xn = (n) => PX0 + min(n, NX) * SX;
  const yP = (p) => PYB - p * (PYB - PYT);
  const pAt = (nn) => {
    const i = floor(nn), f = nn - i;
    return P[i] * (1 - f) + P[min(i + 1, NP)] * f;
  };
  const nNow = S.n, fh = fr(hb + 0.3), boost = fh > 0.02 && fh < 0.2 ? 1.5 : 1;
  // Water under the curve, level up to the room's n, a ghost of the rest.
  let yPrev = yP(0);
  for (let x = 1; x <= 62; x++) {
    const nn = (x - PX0) / SX, y = round(yP(pAt(nn))), passed = nn <= nNow;
    const lo = min(y, yPrev), hi = max(y, yPrev);
    for (let yy = y + 1; yy <= PYB; yy++) {
      const g = (yy - y) / max(1, PYB - y);
      const lit = (0.68 - 0.5 * g) * boost;
      put(x, yy, CURVE, passed ? 0.1 + (lit - 0.1) * fm : 0.1 * boost);
    }
    // The curve itself, joined to its neighbour so a steep stretch has no gaps.
    for (let yy = lo; yy <= hi; yy++) put(x, yy, CURVE, passed ? 0.5 + 0.5 * fm : 0.5);
    yPrev = y;
  }
  // The 50 percent line, and where the curve crosses it, with the count of people
  // standing over it in large digits.
  const y50 = round(yP(0.5)), x50 = round(xn(S.n50));
  const nw = String(S.n50).length * 8 - 2, nx = cl(x50 - floor(nw / 2), 1, 63 - nw), ny = PYT + 2;
  line(1, y50, 62, y50, WHITE, 0.4, 2);
  line(x50, ny + 12, x50, AX - 1, WHITE, 0.4, 2);
  text("50", 1, y50 - 7, WHITE, 0.55);
  put(x50, y50, WHITE, 1);
  text(S.n50, nx, ny, mix(CURVE, WHITE, 0.55), 1, 2);
  // The axis, a tick every ten people.
  line(1, AX, 62, AX, WHITE, 0.3);
  for (let n = 0; n <= NX; n += 10) put(xn(n), AX + 1, WHITE, 0.3);
  // The share of the simulated rooms that were over by n people.
  const hist = new Int32Array(NX + 2);
  for (let i = 0; i < MPOOL; i++) hist[min(S.pool[i], NX + 1)]++;
  let run = hist[0] + hist[1];
  for (let n = 2; n <= NX; n++) {
    run += hist[n];
    if (n % 2 === 0) put(xn(n), yP(run / MPOOL), DOT, 1);
  }
  // Half a year, a long way to the right: the number and an arrow off the edge.
  const half = floor(d / 2), hw = String(half).length * 8 - 2;
  text(half, 62 - hw, 104, WHITE, 0.75, 2);
  line(44, 118, 61, 118, WHITE, 0.7);
  line(58, 115, 61, 118, WHITE, 0.7);
  line(58, 121, 61, 118, WHITE, 0.7);
  // The marker: the room's n on the curve, with a drop line to the axis.
  {
    const mx = round(xn(nNow)), my = round(yP(P[min(nNow, NP)]));
    line(mx, my + 2, mx, AX - 1, WHITE, 0.55);
    if (plumb) {
      line(plumb[0], plumb[1], mx, my, mix(HOT, WHITE, 0.45), 0.6 * fm, 2);
      const f = cl(since / 0.6, 0, 1);
      if (f < 1) rect(round(plumb[0] + (mx - plumb[0]) * f) - 1, round(plumb[1] + (my - plumb[1]) * f) - 1, 3, 3, WHITE, 1);
    }
    const big = hit && since > 0.5 ? 1 : 0, mc = hit ? mix(HOT, WHITE, 0.5 + 0.5 * abs(Math.sin(since * 7))) : WHITE;
    rect(mx - 1 - big, my - 1 - big, 3 + 2 * big, 3 + 2 * big, mc, 1);
  }

  // The numbers: people in the room, the chance that it is over, the days.
  {
    const nc = hit ? mix(HOT, WHITE, cl(1 - since / 0.5, 0, 1) * 0.7) : mix(PEOPLE, WHITE, 0.5);
    text(nNow, 1, 2, nc, 1);
    const pc = min(99, round(P[min(nNow, NP)] * 100));
    const px = text(pc, 22, 2, CURVE, 1);
    glyph("%", px, 2, CURVE, 1);
    const dw = String(d).length * 4 - 1;
    text(d, 62 - dw, 2, PEOPLE, 0.7);
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
