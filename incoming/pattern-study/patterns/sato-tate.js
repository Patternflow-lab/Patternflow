// ===== Patternflow pattern =====
// Title:   Sato-Tate
// Family:  number
// Idea:    Primes rain down the panel, each dropping at the column of a_p / (2 sqrt p) for an elliptic curve counted exactly mod p, and pile into a histogram that fills the faint semicircle (2/pi) sqrt(1 - x^2) layer by layer, each new layer as many primes as all the layers under it, while a curve with complex multiplication sends half its primes down the middle and heaps the rest against the walls.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sato-Tate conjecture (Mikio Sato and John Tate, 1963), proved for elliptic curves without complex multiplication (Laurent Clozel, Michael Harris, Nicholas Shepherd-Barron and Richard Taylor, 2008-2011), pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Curve=0..1, Bins=-1..1
//
// Knob 1: Hue. Turns the layers round the wheel. At 0 the first layer of primes is cyan and each later one a step further round, through azure and blue to violet and rose at the top of the full pile; at 0.5 the first is red and the later ones orange, yellow, lime and green. The outline stays a pale cream.
// Knob 2: Speed. At 2 the first drop lands at 0.9 seconds, the first 512 primes fill the dome by 2.6, the next four layers take 2.9, 4.5, 8.2 and 24 seconds, the last reaching p = 84,053, and after a 2.5 second hold the pile sinks and the count starts again from p = 3. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Curve. Three curves in steps. Below 1/3 the curve 37a, y^2 + y = x^3 - x, with no complex multiplication, whose primes fill the semicircle; from 1/3 y^2 = x^3 - x, where every p = 3 mod 4 has a_p = 0 and falls down the middle, and the rest follow 1/(pi sqrt(1 - x^2)) up the two walls; from 2/3 y^2 = x^3 + 1, the same for p = 2 mod 3. A new curve starts the count again.
// Knob 4: Bins. How the 63 columns of the plot are grouped: at -1 seven bins 9 LEDs wide, at -0.5 nine bins of 7, from -0.2 (so at the opening 0.06) 21 bins of 3, and from 0.6 every column its own bin. The counts are kept per column, so the bars regroup at once.
// Buttons: K1 tap lets the pile sink now and starts the count again from p = 3.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sqrt, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The plot: x = a_p / (2 sqrt p) in [-1, 1] over columns 0..62, x = c/31 - 1,
// so x = 0 is column 31 and every bin count that divides 63 has a middle bin.
// The end columns hold half the width of the others.
const COLS = 63, MID = 31;
const WIDTH = new Float32Array(COLS).fill(1 / 31);
WIDTH[0] = WIDTH[COLS - 1] = 0.5 / 31;
// Rows: the readout on rows 1..5, the rain from row 7, the pile standing on
// row 127. A density of 2/pi, the top of the semicircle, stands 50 rows tall;
// no bar stands above 72.
const TOP = 7, BASE = 127, HS = 50 / (2 / PI), HMAX = 72;
// Drops in rows and story seconds: they leave at V0 and gain G a second.
const V0 = 55, G = 170;

// The three curves, each as the cubic f with y^2 = f(x) (after completing the
// square, so 37a's y^2 + y = x^3 - x is (2y + 1)^2 = 4x^3 - 4x + 1), with the
// odd primes of bad reduction to skip, and its law: 0 the semicircle, 1 half
// the mass at 0 and half on 1/(pi sqrt(1 - x^2)).
const CURVES = [
  { f: [4, 0, -4, 1], bad: 37, cm: 0 },
  { f: [1, 0, -1, 0], bad: 0, cm: 1 },
  { f: [1, 0, 0, 1], bad: 3, cm: 1 },
];
// The density of each law at x, without the point mass.
const law = (cm, x) => (cm ? 1 / (2 * PI * sqrt(max(1e-6, 1 - x * x))) : (2 / PI) * sqrt(max(0, 1 - x * x)));

// The odd primes below 86,000, by a sieve: 8,400 of them, enough for the
// 8,192 a run counts on every curve.
const PMAX = 86000;
const PRIMES = (() => {
  const comp = new Uint8Array(PMAX), out = [];
  for (let i = 3; i < PMAX; i += 2) {
    if (comp[i]) continue;
    out.push(i);
    for (let j = i * i; j < PMAX; j += 2 * i) comp[j] = 1;
  }
  return Int32Array.from(out);
})();

// a_p = p + 1 - #E(F_p) = -(sum over x of the Legendre symbol (f(x) | p)),
// exactly: a table of the squares mod p, then f(x) walked by its finite
// differences, so the loop over x adds and never multiplies.
const CHI = new Int8Array(PMAX);
function ap(p, c) {
  CHI.fill(-1, 0, p);
  CHI[0] = 0;
  for (let i = 1, sq = 0, n = (p - 1) >> 1; i <= n; i++) {
    sq += 2 * i - 1;
    if (sq >= p) sq -= p;
    CHI[sq] = 1;
  }
  const m = (v) => ((v % p) + p) % p;
  let f = m(c[3]), d1 = m(c[0] + c[1] + c[2]), d2 = m(6 * c[0] + 2 * c[1]), s = 0;
  const d3 = m(6 * c[0]);
  for (let x = 0; x < p; x++) {
    s += CHI[f];
    f = f + d1 - p;
    f += (f >> 31) & p;
    d1 = d1 + d2 - p;
    d1 += (d1 >> 31) & p;
    d2 = d2 + d3 - p;
    d2 += (d2 >> 31) & p;
  }
  return -s;
}

// Layers: the first 512 primes, then each layer as many as all before it.
// The pile is drawn so the layers so far fill the outline, and when a layer
// is in, the scale halves for the next.
const TARGET = [512, 1024, 2048, 4096, 8192], LAYERS = TARGET.length, LAST = TARGET[LAYERS - 1];
const layerOf = (i) => {
  let k = 0;
  while (i >= TARGET[k]) k++;
  return k;
};
// How many primes have left the top by story time t of a run, piecewise linear.
const KNOTS = [[0, 0], [1.9, 512], [4.8, 1024], [9.3, 2048], [17.5, 4096], [41.5, LAST]];
function countAt(t) {
  for (let i = 1; i < KNOTS.length; i++) {
    const [t0, n0] = KNOTS[i - 1], [t1, n1] = KNOTS[i];
    if (t < t1) return n0 + ((n1 - n0) * max(0, t - t0)) / (t1 - t0);
  }
  return LAST;
}
function timeOf(n) {
  for (let i = 1; i < KNOTS.length; i++) {
    const [t0, n0] = KNOTS[i - 1], [t1, n1] = KNOTS[i];
    if (n < n1) return t0 + ((t1 - t0) * (n - n0)) / (n1 - n0);
  }
  return KNOTS[KNOTS.length - 1][0];
}
// Bins on Knob 4: 7, 9, 21 or 63 bins, 9, 7, 3 or 1 columns wide.
const binWidth = (k) => (k < -0.6 ? 9 : k < -0.2 ? 7 : k < 0.6 ? 3 : 1);

// Digits 3 x 5 for the readout, a bit per LED from the top left, then a
// minus sign, a p and an a.
const FONT = [0x7b6f, 0x2c97, 0x73e7, 0x73cf, 0x5bc9, 0x79cf, 0x79ef, 0x7292, 0x7bef, 0x7bcf, 0x01c0, 0x7be4, 0x076b];

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, bw: 3, curve: -1, t: 0, pi: 0, spawned: 0, landed: 0, sc: 1 / TARGET[0], done: -1, sink: -1,
    lastP: 0, lastA: 0, shown: [0, 0], shownAt: -1,
    cnt: new Float32Array(LAYERS * COLS), flash: new Float32Array(COLS), drops: [],
    height: new Float32Array(COLS), binOf: new Int16Array(COLS), buf: new Float32Array(N * 3), pal: [],
  };
  begin(params.s, 0);
}

// A fresh run on curve k: an empty pile, the primes from 3.
function begin(S, k) {
  S.curve = k;
  S.t = 0;
  S.pi = 0;
  S.spawned = 0;
  S.landed = 0;
  S.sc = 1 / TARGET[0];
  S.done = -1;
  S.sink = -1;
  S.cnt.fill(0);
  S.flash.fill(0);
  S.drops.length = 0;
  S.shownAt = -1;
}

// Each bar's height in rows, per column, from the counts and the scale.
function heights(S) {
  const w = S.bw, nb = COLS / w, cnt = S.cnt, h = S.height;
  for (let b = 0; b < nb; b++) {
    let n = 0, dx = 0;
    for (let c = b * w; c < b * w + w; c++) {
      dx += WIDTH[c];
      for (let L = 0; L < LAYERS; L++) n += cnt[L * COLS + c];
    }
    const v = (n * S.sc * HS) / dx;
    for (let c = b * w; c < b * w + w; c++) (h[c] = v), (S.binOf[c] = b);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.bw = binWidth(cl(k[3], -1, 1));
  const curve = min(2, floor(cl(k[2], 0, 1) * 3));
  if (curve !== S.curve) begin(S, curve);
  if (input.btnPressed && input.btnPressed[0] && S.sink < 0) S.sink = S.t;
  const ds = (d * S.speed) / 2, C = CURVES[S.curve];
  S.t += ds;
  // New primes leave the top on the schedule, at most 60 a frame.
  if (S.sink < 0) {
    const want = min(LAST, floor(countAt(S.t)));
    for (let n = 0; S.spawned < want && n < 60; n++) {
      let p = PRIMES[S.pi++];
      if (p === C.bad) p = PRIMES[S.pi++];
      const a = ap(p, C.f), x = a / (2 * sqrt(p));
      S.drops.push({ c: round((x + 1) * MID), t0: timeOf(S.spawned), L: layerOf(S.spawned) });
      S.spawned++;
      S.lastP = p;
      S.lastA = a;
    }
  }
  // The readout keeps each prime for a sixth of a second.
  if (S.t - S.shownAt > 1 / 6 && S.lastP) (S.shown = [S.lastP, S.lastA]), (S.shownAt = S.t);
  // The scale: the layers landed so far fill the outline.
  let e = 0;
  while (e < LAYERS - 1 && S.landed >= TARGET[e]) e++;
  S.sc += (1 / TARGET[e] - S.sc) * (1 - exp(-ds / 0.18));
  heights(S);
  // Drops fall and land on their bar.
  const keep = [];
  for (const D of S.drops) {
    const s = S.t - D.t0;
    D.y = TOP + V0 * s + 0.5 * G * s * s;
    D.v = V0 + G * s;
    const floorY = S.sink >= 0 ? H + 12 : BASE + 1 - min(HMAX, S.height[D.c]);
    if (D.y >= floorY) {
      if (S.sink < 0) {
        S.cnt[D.L * COLS + D.c]++;
        S.landed++;
        S.flash[D.c] = 1;
      }
      continue;
    }
    keep.push(D);
  }
  S.drops = keep;
  for (let c = 0; c < COLS; c++) S.flash[c] *= exp(-ds / 0.12);
  // A full run holds for 2.5 seconds, then the pile sinks in 1.5 and the
  // count starts again.
  if (S.landed >= LAST && S.done < 0) S.done = S.t;
  if (S.done >= 0 && S.sink < 0 && S.t > S.done + 2.5) S.sink = S.t;
  if (S.sink >= 0 && S.t > S.sink + 1.5) begin(S, S.curve);
}

// Layer colours round the wheel: at Hue 0 the first layer cyan, then azure,
// blue, violet and rose for the later ones.
function palette(S) {
  if (S.palHue === S.hue) return;
  S.palHue = S.hue;
  S.pal = [];
  for (let L = 0; L < LAYERS; L++) S.pal.push(hsv(0.5 + S.hue + 0.09 * L, 0.82, 1));
}

function glyph(buf, g, x0, y0, c, a) {
  for (let j = 0; j < 15; j++) {
    if (!((g >> (14 - j)) & 1)) continue;
    const x = x0 + (j % 3), y = y0 + floor(j / 3);
    if (x < 0 || x >= W) continue;
    const o = 3 * (y * W + x);
    for (let i = 0; i < 3; i++) buf[o + i] = c[i] * a;
  }
}
// A number in 3 x 5 digits ending at column x1 (right aligned), or starting at x0.
function number(buf, v, x, y, right, c) {
  const s = String(abs(v)), n = s.length + (v < 0 ? 1 : 0);
  let px = right ? x - 4 * n + 1 : x;
  if (v < 0) glyph(buf, FONT[10], px, y, c, 1), (px += 4);
  for (const ch of s) glyph(buf, FONT[ch.charCodeAt(0) - 48], px, y, c, 1), (px += 4);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const buf = S.buf, pal = S.pal, cnt = S.cnt, w = S.bw, cm = CURVES[S.curve].cm;
  buf.fill(0);
  const sink = S.sink >= 0 ? (HMAX + 4) * ease((S.t - S.sink) / 1.5) : 0;
  // The pile: each column's bar in its layers, oldest at the bottom; a bar
  // too tall for the panel keeps its layers in proportion under the ceiling.
  // Every other bin is a shade darker so the bins read apart.
  const cum = new Float32Array(LAYERS);
  for (let c = 0; c < COLS; c++) {
    const b = S.binOf[c], h0 = S.height[c];
    if (h0 <= 0.02) continue;
    let tot = 0;
    for (let L = 0; L < LAYERS; L++) {
      let n = 0;
      for (let cc = b * w; cc < b * w + w; cc++) n += cnt[L * COLS + cc];
      tot += n;
      cum[L] = tot;
    }
    const h = min(h0, HMAX), k = h / tot, shade = w > 1 && b % 2 ? 0.8 : 1;
    const top = floor(h - 1e-4), lift = h0 > HMAX ? 0.75 : 0.25 + 0.6 * S.flash[c];
    for (let r = 0, L = 0; r <= top; r++) {
      const y = BASE - r + round(sink);
      if (y < 0 || y >= H) continue;
      while (L < LAYERS - 1 && cum[L] * k <= r + 0.5) L++;
      const col = pal[L], a = (r < top ? 1 : h - r) * shade, o = 3 * (y * W + c);
      const wt = r === top ? lift : 0;
      for (let i = 0; i < 3; i++) buf[o + i] = (col[i] * (1 - wt) + wt) * a;
    }
  }
  // The outline of the law in pale cream, brighter where it crosses a bar.
  // A curve with complex multiplication also gets a dotted line up the middle
  // for the half of its primes that sits at x = 0.
  const line = [1, 0.86, 0.62];
  let prev = -1;
  for (let c = 0; c < COLS; c++) {
    const y = round(BASE + 1 - min(HMAX + 2, HS * law(cm, c / MID - 1))) + round(sink);
    const y0 = prev < 0 ? y : prev < y ? prev + 1 : y, y1 = prev < 0 ? y : prev > y ? prev - 1 : y;
    for (let yy = min(y0, y1); yy <= max(y0, y1); yy++) {
      if (yy < TOP || yy >= H) continue;
      const o = 3 * (yy * W + c), inside = buf[o] + buf[o + 1] + buf[o + 2] > 0.3;
      for (let i = 0; i < 3; i++) buf[o + i] = inside ? buf[o + i] * 0.45 + line[i] * 0.55 : line[i] * 0.34;
    }
    prev = y;
  }
  if (cm)
    for (let y = BASE + 1 - HMAX - 2 + round(sink); y <= BASE; y += 3) {
      if (y < TOP || y >= H) continue;
      const o = 3 * (y * W + MID);
      if (buf[o] + buf[o + 1] + buf[o + 2] < 0.3) for (let i = 0; i < 3; i++) buf[o + i] = line[i] * 0.34;
    }
  // Drops: a bright head and a short tail, in the colour of their layer.
  for (const D of S.drops) {
    if (D.y === undefined) continue;
    const col = pal[D.L], tail = min(7, 2 + D.v * 0.03), hy = floor(D.y);
    for (let j = 0; j <= tail; j++) {
      const y = hy - j;
      if (y < TOP || y >= H) continue;
      const a = j === 0 ? 1 : 0.85 * (1 - j / (tail + 1)) ** 1.5, wt = j === 0 ? 0.55 : j === 1 ? 0.2 : 0, o = 3 * (y * W + D.c);
      for (let i = 0; i < 3; i++) buf[o + i] = max(buf[o + i], (col[i] * (1 - wt) + wt) * a);
    }
  }
  // The readout: the newest prime at the left, its a_p at the right.
  if (S.shown[0]) {
    const grey = [0.62, 0.62, 0.62], lab = pal[layerOf(min(LAST - 1, S.spawned))];
    glyph(buf, FONT[11], 1, 1, lab, 1);
    number(buf, S.shown[0], 6, 1, false, grey);
    glyph(buf, FONT[12], 62 - 4 * (String(abs(S.shown[1])).length + (S.shown[1] < 0 ? 1 : 0)) - 4, 1, lab, 1);
    number(buf, S.shown[1], 62, 1, true, grey);
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) display.setPixel(x, y, round(min(1, buf[3 * p]) * 255), round(min(1, buf[3 * p + 1]) * 255), round(min(1, buf[3 * p + 2]) * 255));
}
