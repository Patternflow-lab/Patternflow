// ===== Patternflow pattern =====
// Title:   Sobol Boxes
// Family:  noise
// Idea:    Points of the Sobol sequence land on the panel one after another and every box the panel is cut into holds exactly one of them, whatever the box's shape, until the 8,192nd point puts one in every LED, while random points leave empty boxes and crowded ones.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sobol sequence (Ilya Sobol', 1967), (t,m,s)-nets (Harald Niederreiter, 1987), pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Shape=-4..4, Mix=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. A box takes its colour from where it sits among the 64 big boxes of the tiling, over an arc a little under half the wheel wide, and each point is a little lighter or darker than its box. At 0 the arc runs from cyan to pink through blue and violet; each new picture moves it a little.
// Knob 2: Speed. How fast the points come. At 2 the count doubles every 0.36 s: the first point lands at 0.3 s, 26 are down by 2 s, 181 by 3 s and all 8,192 at 4.98 s. The sequence then runs on at 450 points a second, repainting LEDs one by one, until the picture fades at 7.78 s and a new one starts at 9.2 s. 0.5 is four times slower and 4 is twice as fast.
// Knob 3: Shape. The shape of the boxes each point owns, from tall strips at -4 through squares and boxes twice as wide as tall by turns at 0 to wide flat slabs at 4, one step for each halving of the ratio of width to height. It catches at whole numbers. At 8,192 points a box is one LED whatever the knob says.
// Knob 4: Mix. The share of the points drawn at random instead of from the sequence. The first tenth of the knob is the sequence alone, which is where it opens. At 1 every point is random and 37 percent of the LEDs end up with no point of their own, black or the dim fill of a neighbour's box, while some boxes are many times larger than others.

const W = 64, H = 128, NLED = W * H; // 2^6 columns by 2^7 rows: 8,192 boxes of one LED
const NMAX = 16384; // two full panels of points
const { floor, round, min, pow, log2 } = Math;
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

// A hash of an integer to 0..1, so a cycle is the same however it is reached.
function hash(n) {
  let h = (n | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The first two dimensions of the Sobol sequence, in 16 bits. The first is
// the van der Corput sequence, 1/2, 1/4, 3/4, 1/8 and so on. The second has
// the direction numbers m = 1, 3, 5, 15, 17, 51, 85, 255, from the primitive
// polynomial x + 1: m(i) = 2 m(i-1) xor m(i-1). Taken together the two make
// a (0, m, 2)-net in base 2 for every m: the first 2^m points put exactly one
// point in each box of width 2^-a and height 2^-b whenever a + b = m, for
// every split of m, so for every box shape of that area.
const V1 = [], V2 = [];
{
  let m = 1;
  for (let j = 0; j < 16; j++) {
    V1.push(1 << (15 - j));
    V2.push(m << (15 - j));
    m = (2 * m) ^ m;
  }
}

// Point n of the sequence in Gray code order, a digital shift (an xor on
// every digit) moving the first point off the corner. A shift keeps the net.
function sobolPoints(shiftX, shiftY, ledOut) {
  let x = 0, y = 0;
  for (let n = 0; n < NMAX; n++) {
    if (n > 0) {
      let c = 0, t = n;
      while (!(t & 1)) {
        t >>= 1;
        c++;
      }
      x ^= V1[c];
      y ^= V2[c];
    }
    ledOut[n] = (((y ^ shiftY) >> 9) << 6) | ((x ^ shiftX) >> 10);
  }
}

// Time runs in clock units that the Speed knob stretches: 1 unit is 1 s at 2.
// The count of points doubles every T until the panel is full, then the
// sequence goes on at a slower rate and the second panel of points repaints
// the LEDs one by one, until the picture fades and a new one starts.
const T0 = 0.3, T = 0.36, LEVELS = 13;
const T_FULL = T0 + T * LEVELS;
const HOLD = 2.8, FADE = 0.9, REST = 0.5, SLOW = 450;
const T_END = T_FULL + HOLD + FADE + REST;
const arrive = (n) => (n < NLED ? T0 + T * log2(n + 1) : T_FULL + (n - NLED + 1) / SLOW);
function countAt(tau) {
  if (tau < T0) return 0;
  if (tau < T_FULL) return min(NLED, floor(pow(2, (tau - T0) / T)));
  return min(NMAX, NLED + floor((tau - T_FULL) * SLOW));
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, shape: 0, mix: 0, tau: 0, cycle: 0,
    sob: new Int32Array(NMAX), rnd: new Int32Array(NMAX), flip: new Float32Array(NMAX),
    sn: new Float32Array(NMAX), vn: new Float32Array(NMAX),
    owner: new Int32Array(NLED), list: new Int32Array(NLED), buf: new Uint8Array(NLED * 3),
    shiftH: 0,
  };
  start(params.s);
}

// A new picture: its own shift of the sequence, its own random points and
// its own hue offset, from the cycle number alone.
function start(S) {
  const c = S.cycle * 7 + 3;
  sobolPoints(floor(hash(c) * 65536), floor(hash(c + 1) * 65536), S.sob);
  for (let n = 0; n < NMAX; n++) {
    S.rnd[n] = floor(hash(c * 100003 + n * 2 + 11) * NLED);
    S.flip[n] = hash(c * 100003 + n * 2 + 12);
    S.sn[n] = hash(c * 100003 + n * 3 + 500000);
    S.vn[n] = hash(c * 100003 + n * 3 + 900000);
  }
  S.shiftH = (hash(c + 5) - 0.5) * 0.12;
  S.tau = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.shape = cl(round(k[2]), -4, 4);
  S.mix = cl((cl(k[3], 0, 1) - 0.1) / 0.9, 0, 1);
  S.tau += d * (S.speed / 2);
  if (S.tau > T_END) {
    S.cycle++;
    start(S);
  }
}

// One box of the tiling: lw and lh are the log2 of its width and height.
// A box with one point is a leaf, a box with none stays black, and a box with
// more is cut in half along the side that brings its shape nearer the one the
// Shape knob asks for, until each piece holds one point. With the Sobol
// points a cut always parts the two points it was made for and never leaves
// a half empty, so the boxes come in two sizes at most; with random points
// they come in many.
function tile(S, lo, hi, x0, y0, lw, lh, ctx) {
  const cnt = hi - lo;
  if (cnt === 0) return;
  const w = 1 << lw, h = 1 << lh;
  if (cnt === 1 || (lw === 0 && lh === 0)) {
    leaf(S, S.list[lo], x0, y0, lw, lh, ctx);
    return;
  }
  let splitX = lw - lh > S.shape;
  if (lw === 0) splitX = false;
  else if (lh === 0) splitX = true;
  const list = S.list;
  let i = lo, j = hi - 1;
  if (splitX) {
    const xm = x0 + (w >> 1);
    while (i <= j) {
      if ((list[i] & 63) < xm) i++;
      else {
        const t = list[i];
        list[i] = list[j];
        list[j] = t;
        j--;
      }
    }
    tile(S, lo, i, x0, y0, lw - 1, lh, ctx);
    tile(S, i, hi, xm, y0, lw - 1, lh, ctx);
  } else {
    const ym = y0 + (h >> 1);
    while (i <= j) {
      if ((list[i] >> 6) < ym) i++;
      else {
        const t = list[i];
        list[i] = list[j];
        list[j] = t;
        j--;
      }
    }
    tile(S, lo, i, x0, y0, lw, lh - 1, ctx);
    tile(S, i, hi, x0, ym, lw, lh - 1, ctx);
  }
}

// Which of the 64 big boxes of the tiling a point is in: the first six cuts
// the Shape knob's rule makes, as a number. Its colour comes from there.
function boxOf(led, shape) {
  const px = led & 63, py = led >> 6;
  let x0 = 0, y0 = 0, lw = 6, lh = 7, id = 0;
  for (let i = 0; i < 6; i++) {
    let sx = lw - lh > shape;
    if (lw === 0) sx = false;
    else if (lh === 0) sx = true;
    if (sx) {
      const xm = x0 + (1 << (lw - 1));
      id *= 2;
      if (px >= xm) {
        x0 = xm;
        id++;
      }
      lw--;
    } else {
      const ym = y0 + (1 << (lh - 1));
      id *= 2;
      if (py >= ym) {
        y0 = ym;
        id++;
      }
      lh--;
    }
  }
  return id;
}

// A box is filled with its point's colour: dim while the box is big, a little
// brighter as it shrinks, and never as bright as the point, so an LED that
// holds no point of its own reads as dark next to one that does. The colour
// is saturated, with the light of each point drawn from its own hash. Orange
// and yellow go lighter and paler, because a dim one reads as brown.
const COL = [0, 0, 0];
function leaf(S, led, x0, y0, lw, lh, ctx) {
  const n = S.owner[led], buf = S.buf;
  const w = 1 << lw, h = 1 << lh, a2 = lw + lh;
  let hh = ctx.hue + 0.42 * fr(boxOf(led, S.shape) * 0.6180339887498949), s = 0.94 + 0.06 * S.sn[n], v = 0.64 + 0.36 * S.vn[n];
  hh -= floor(hh);
  if (hh > 0.03 && hh < 0.2) {
    v = 0.8 + 0.2 * S.vn[n];
    s = 0.4 + 0.35 * S.sn[n];
  }
  hsv(hh, s, v, COL);
  const f = 0.22 + 0.2 * sm((10 - a2) / 7);
  const age = (ctx.tau - arrive(n)) / 0.35, fl = age < 1 && a2 >= 3 ? (1 - age) * cl((a2 - 2) / 3, 0, 1) : 0;
  const g = ctx.gm;
  const lv = min(1, f + fl * 0.3) * g, fg = lv * 255;
  const r0 = COL[0] * fg, g0 = COL[1] * fg, b0 = COL[2] * fg;
  for (let y = y0; y < y0 + h; y++) {
    let o = (y * W + x0) * 3;
    for (let x = x0; x < x0 + w; x++, o += 3) {
      buf[o] = r0;
      buf[o + 1] = g0;
      buf[o + 2] = b0;
    }
  }
  // The point itself, a plus in a big box and one LED in a small one, with a
  // flash that fades over 0.35 clock units while its box is still big.
  const px = led & 63, py = led >> 6;
  const dr = min(255, (COL[0] * 255 + fl * 160) * g), dg = min(255, (COL[1] * 255 + fl * 160) * g), db = min(255, (COL[2] * 255 + fl * 160) * g);
  const put = (x, y) => {
    if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return;
    const o = (y * W + x) * 3;
    buf[o] = dr;
    buf[o + 1] = dg;
    buf[o + 2] = db;
  };
  put(px, py);
  if (a2 >= 6) {
    put(px - 1, py);
    put(px + 1, py);
    put(px, py - 1);
    put(px, py + 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const tau = S.tau, buf = S.buf;
  buf.fill(0);
  const N = countAt(tau);
  if (N > 0) {
    const owner = S.owner;
    owner.fill(-1);
    const m = S.mix;
    for (let n = 0; n < N; n++) owner[S.flip[n] < m ? S.rnd[n] : S.sob[n]] = n;
    let cnt = 0;
    for (let i = 0; i < NLED; i++) if (owner[i] >= 0) S.list[cnt++] = i;
    const t1 = T_FULL + HOLD;
    const gm = 1 - sm((tau - t1) / FADE);
    const ctx = { hue: S.hue + 0.5 + S.shiftH, tau, gm };
    tile(S, 0, cnt, 0, 0, 6, 7, ctx);
  }
  for (let p = 0; p < NLED; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
