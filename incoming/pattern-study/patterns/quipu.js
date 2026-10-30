// ===== Patternflow pattern =====
// Title:   Quipu
// Family:  type
// Idea:    Pendant cords hang the full height from a primary cord across the top, each holding a number tied in decimal place clusters, thousands at the top and units nearest the free end, single knots counted out for the upper places, a long knot of two to nine turns or a figure-eight for the units and bare cord for zero, with the digit written in small figures beside each cluster; the cords count up at their own rates, knots flash as they are tied and fade as a carry unties them, and each change runs along the primary cord to the pale cord at the end of the group, which always comes back to their sum.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: khipu of the Inka as Leland Locke read their decimal knots and sum cords (L. Leland Locke, The Ancient Quipu or Peruvian Knot Record, 1923), with the knot types of Marcia and Robert Ascher (Code of the Quipu, 1981), pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cords=5..8, Step=0..1
//
// Knob 1: Hue. Turns the three cord colours round the wheel together. At 0 they are azure, amber and rose; the sum cord stays a pale cream whatever the knob says.
// Knob 2: Speed. How often the cords count. At 2 the four data cords of the opening tick 0.7 to 2.2 times a second, 5.6 ticks a second in all reaching the sum; 0.2 is ten times slower, 3 half as fast again. A cord jumps from 40% to full strength when it ticks, and the extra light falls to 37% in 0.8 s.
// Knob 3: Cords. Pendants on the primary cord, 5 to 8, the last always the sum of the others. With 4 data cords each counts up to 2499 and wraps to the remainder, with 7 up to 1428, so the sum never needs a fifth place. Up to 7 the cords are 2 LEDs thick; 8 only fit at 1.
// Knob 4: Step. What one tick adds to a data cord, five stations: 1, 10, 100, 111, 1111. At 1 the long knot grows a turn a tick and every tenth tick unties it and ties a ten; at 10 the units hold still and the tens count; at 100 the hundreds count and a thousand is tied every tenth tick; at 111 the units, tens and hundreds each take a knot every tick; at 1111 all four places do, and with 4 data cords a cord passes 2499 every two or three ticks and wraps.

// A khipu records a number on a pendant cord in clusters of knots, one
// cluster for each decimal place, the places at the same height on every
// cord so that they read across as rows. Locke showed this in 1912 and set
// it out in the 1923 monograph, along with cords whose values are the sums
// of a group of pendants. The Aschers' notation names three knots: s, the
// single overhand knot, one for each unit of a place above the units; L,
// the long knot, a coil of 2 to 9 turns that holds the units digit, so the
// units place can be told from the others even where the places of
// neighbouring cords do not line up; and
// E, the figure-eight, for a units digit of 1, since a long knot of one
// turn is just a single knot. A place holding zero is a stretch of bare
// cord.
//
// Here a single knot is a bead one LED wider than the cord on each side
// and 2 rows tall, with a row of bare cord between beads; a long knot is a
// coil of turns 2 rows apart, each slanting across the cord, bright in
// front and dim behind; a figure-eight is two loops stacked on the cord,
// washed toward white. The four places start at rows 8, 37,
// 66 and 96, so nine single knots (26 rows) fit in each. Each data cord
// ticks on its own clock. Its change runs along the primary cord at 80
// LEDs a second (at Speed 2) and the sum cord adds it on arrival, so the
// sum is exact whenever nothing is on its way.

const W = 64, H = 128;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Top row of each place's cluster: units, tens, hundreds, thousands.
const TIER = [96, 66, 37, 8];
const P10 = [1, 10, 100, 1000];
const STEPS = [1, 10, 100, 111, 1111];
// Ticks a second at Speed 1 for each data cord.
const RATE = [0.5, 0.85, 0.35, 1.1, 0.65, 0.95, 0.42];
// LEDs a second a change runs along the primary cord at Speed 1.
const RUN = 40;
// Category hues of the data cords, before the Hue knob.
const CAT = [0.56, 0.11, 0.9];
// Seconds a knot takes to be tied or untied, and for a cord's glow to fall
// to a third.
const TT = 0.3, GLOW = 0.8;
const BLACK = [0, 0, 0];

const FONT = [
  "### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# .## ..# ###", "#.# #.# ### ..# ..#",
  "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ###",
].map((s) => s.split(" "));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [
    255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p),
    255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p),
    255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p),
  ];
}

const newCord = (v, rate, x) => ({ v, pv: v, tc: 9, glow: 0, acc: Math.random(), rate, x, end: 116 + floor(Math.random() * 7), ph: floor(Math.random() * 3) });

function build(S, n) {
  S.n = n;
  S.cw = n <= 7 ? 2 : 1;
  S.cap = floor(9999 / (n - 1));
  S.cords = [];
  S.sparks = [];
  // Each cord needs its beads (x - 1 to x + cw) and its figures (x + cw + 2
  // to x + cw + 4) and a dark LED either side of them.
  const span = 63 - (S.cw + 5);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const x = 1 + round((i * span) / (n - 1));
    if (i < n - 1) {
      const v = floor(Math.random() * (S.cap + 1));
      total += v;
      S.cords.push(newCord(v, RATE[i], x));
    } else S.cords.push(newCord(total, 0, x));
  }
}

export function setup(params) {
  params.s = { n: 0, cw: 2, cap: 0, hue: 0, speed: 2, step: 1, cords: [], sparks: [], buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const n = cl(floor((k[2] == null ? 5 : k[2]) + 0.25), 5, 8);
  if (n !== S.n) build(S, n);
  S.step = STEPS[min(4, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 5))];
  const C = S.cords, sum = C[n - 1], fade = exp(-d / GLOW);
  for (let i = 0; i < n; i++) {
    const c = C[i];
    c.tc += d;
    c.glow *= fade;
    if (i === n - 1) break;
    c.acc += d * S.speed * c.rate;
    while (c.acc >= 1) {
      c.acc -= 1;
      c.pv = c.v;
      c.v = (c.v + S.step) % (S.cap + 1);
      c.tc = 0;
      c.glow = 1;
      // A wrap carries a negative amount.
      S.sparks.push({ i, x: c.x, delta: c.v - c.pv });
    }
  }
  const run = RUN * S.speed * d;
  S.sparks = S.sparks.filter((sp) => {
    sp.x += run;
    if (sp.x < sum.x) return true;
    sum.pv = sum.v;
    sum.v += sp.delta;
    sum.tc = 0;
    sum.glow = 1;
    return false;
  });
}

// Strength of the cord being drawn, set before each part of it.
let GAIN = 1;

function put(buf, x, y, c, b, w) {
  b *= GAIN;
  if (x < 0 || x >= W || y < 0 || y >= H || b < 0) return;
  const o = (y * W + x) * 3;
  buf[o] = (c[0] + (255 - c[0]) * w) * b;
  buf[o + 1] = (c[1] + (255 - c[1]) * w) * b;
  buf[o + 2] = (c[2] + (255 - c[2]) * w) * b;
}

function bar(buf, x0, x1, y, c, b, w) {
  for (let x = x0; x <= x1; x++) put(buf, x, y, c, b, w);
}

// How a knot that is there, being tied or being untied, is drawn: its
// strength and how far it is washed toward white. A new knot flashes
// nearly white for the first third of its tying.
function look(k, d, pd, u) {
  if (k < d && k < pd) return [1, 0.15];
  if (k < d) return u < 0.35 ? [1.15, 0.85] : [1, 0.15 + 0.7 * (1 - u)];
  if (k < pd) return [0.9 * (1 - u), 0.1];
  return null;
}

// The units: a figure-eight for 1, a long knot of d turns for 2 to 9.
function units(buf, x, cw, d, pd, u, c) {
  const y0 = TIER[0], xr = x + cw;
  if (d === 1 || pd === 1) {
    // Steady, being tied, or fading under the long knot that replaces it.
    const [b, w] = d !== 1 ? [0.9 * (1 - u), 0.1] : pd === 1 ? [1, 0.2] : u < 0.35 ? [1.15, 0.85] : [1, 0.2 + 0.65 * (1 - u)];
    for (let r = 0; r < 5; r++) {
      if (r % 2) {
        put(buf, x - 1, y0 + r, c, b, w);
        put(buf, xr, y0 + r, c, b, w);
        bar(buf, x, xr - 1, y0 + r, BLACK, 1, 0);
      } else bar(buf, x, xr - 1, y0 + r, c, b, r === 2 ? 0.7 : max(w, 0.35));
    }
  }
  // Each turn of a long knot slants across the cord: its front a bright
  // row from the left, its back a dim row to the right.
  const ld = d >= 2 ? d : 0, lp = pd >= 2 ? pd : 0, m = max(ld, lp);
  for (let t = 0; t < m; t++) {
    const lk = look(t, ld, lp, u);
    if (!lk) continue;
    const y = y0 + 2 * t;
    bar(buf, x - 1, xr - 1, y, c, lk[0], lk[1]);
    put(buf, xr, y, BLACK, 1, 0);
    put(buf, x - 1, y + 1, BLACK, 1, 0);
    bar(buf, x, xr, y + 1, c, lk[0] * 0.5, lk[1]);
  }
}

function digit(buf, x, y, dg, c, b) {
  const g = FONT[dg];
  for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === "#") put(buf, x + q, y + r, c, b, 0.25);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const { buf, cords, n, cw } = S;
  buf.fill(0);
  GAIN = 1;
  // The primary cord, three rows of plied cotton.
  const pc = hsv(0.09, 0.3, 1);
  for (let y = 2; y <= 4; y++) for (let x = 0; x < W; x++) put(buf, x, y, pc, (x + 2 * y) % 3 === 0 ? 0.32 : 0.55, 0);
  for (let i = 0; i < n; i++) {
    const cd = cords[i], x = cd.x, xr = x + cw;
    const col = i === n - 1 ? hsv(0.12, 0.18, 1) : hsv(S.hue + CAT[i % 3], 0.8, 1);
    // The pendant, hitched over the primary cord, plied in a slant, and
    // fraying at its free end. It dims at rest and brightens as it changes.
    GAIN = 0.4 + 0.6 * cd.glow;
    put(buf, x - 1, 1, col, 0.6, 0);
    put(buf, xr, 1, col, 0.6, 0);
    for (let y = 1; y <= cd.end; y++) for (let c = 0; c < cw; c++) put(buf, x + c, y, col, (y + c + cd.ph) % 3 === 0 ? 0.5 : 0.8, 0);
    for (let y = cd.end + 1; y <= cd.end + 3; y++) {
      put(buf, x - 1, y, col, 0.5 - 0.1 * (y - cd.end), 0);
      put(buf, xr, y, col, 0.5 - 0.1 * (y - cd.end), 0);
    }
    // Knots and figures stay near full strength.
    GAIN = 0.85 + 0.15 * cd.glow;
    const u = min(1, cd.tc / TT), v = cd.v, pv = cd.pv;
    for (let q = 3; q >= 0; q--) {
      const dd = floor(v / P10[q]) % 10, pd = floor(pv / P10[q]) % 10;
      if (q > 0) {
        for (let kk = 0; kk < max(dd, pd); kk++) {
          const lk = look(kk, dd, pd, u);
          if (!lk) continue;
          const y = TIER[q] + 3 * kk;
          bar(buf, x - 1, xr, y, col, lk[0], lk[1]);
          bar(buf, x - 1, xr, y + 1, col, lk[0], lk[1]);
        }
      } else units(buf, x, cw, dd, pd, u, col);
      // The written digit beside the cluster, from the leading place down.
      if (v >= P10[q] || q === 0) digit(buf, xr + 2, TIER[q], dd, col, dd === pd || u >= 1 ? 0.8 : 1);
    }
  }
  GAIN = 1;
  // Changes on their way to the sum cord, a bright head with a short tail.
  for (const sp of S.sparks) {
    const col = hsv(S.hue + CAT[sp.i % 3], 0.8, 1), hx = round(sp.x);
    for (let t = 0; t < 5; t++) for (let y = 2; y <= 4; y++) put(buf, hx - t, y, col, t ? 0.8 - 0.15 * t : 1, t ? 0 : 0.6);
  }
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, round(buf[p])), min(255, round(buf[p + 1])), min(255, round(buf[p + 2])));
}
