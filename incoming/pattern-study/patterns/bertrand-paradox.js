// ===== Patternflow pattern =====
// Title:   Bertrand Paradox
// Family:  data
// Idea:    Three discs stacked down the panel are filled with random chords chosen three different ways, two random points on the rim, a random point on a random radius and a random midpoint, chords longer than the side of the inscribed triangle in one colour and shorter ones in the opposite, while a gauge beside each disc counts the long ones and settles on its own answer, 1/3, 1/2 and 1/4.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bertrand paradox (Joseph Bertrand, 1889), pattern round 33
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Chords=0..1, Persist=0..1
//
// Knob 1: Hue. Turns the pair of colours round the wheel together. At 0 the long chords are magenta and the short ones green; at 0.25 orange and azure; at 0.5 the two swap.
// Knob 2: Speed. The clock of the whole picture. At 2 each disc takes 24 chords a second and a chord crumbles away over about a second; at 0.2 both run ten times slower, so each disc holds the same few chords, they change slowly and the counts creep.
// Knob 3: Chords. How many chords each disc takes a second: 24 at 0, 76 at 0.5, 240 at 1. Turned up, the lines give way to a stipple of each method's own density: heavy at the rim in the top disc, even in the middle one, hollow in the bottom one, with the long colour filling the circle of half the radius that only long chords cross.
// Knob 4: Persist. How long a chord takes to crumble: about a second at the opening, about six at 1, where the old chords pile up under the new ones into the same density stipple.
// Buttons: K1 tap clears the three discs and their counts, and the gauges start again from nothing.

const W = 64, H = 128, N = W * H;
const { floor, round, sqrt, sin, cos, abs, exp, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// One disc in each third of the 128 rows, 40 LEDs across, set left, right,
// left so each has 22 columns beside it for its gauge.
const R = 19.5;
const DISCS = [
  { cx: 20.5, cy: 21.5, side: 1, num: 1, den: 3 },
  { cx: 43.5, cy: 64, side: -1, num: 1, den: 2 },
  { cx: 20.5, cy: 106.5, side: 1, num: 1, den: 4 },
];
const BAR = 40;
// The points each method picked for its newest chords, shown white for a
// quarter of a second: the rim pair, the point on the radius, the midpoint.
const SEEDS = 16, SEED_LIFE = 0.25;
// Chords a second times the fade time at the opening knobs.
const OPEN = 24 * 1.1 * 7 ** 0.06;

// 3 x 5 digits, row by row from the top, three bits a row.
const FONT = {
  0: 0b111101101101111, 1: 0b010110010010111, 2: 0b111001111100111, 3: 0b111001111001111,
  4: 0b101101111001001, 5: 0b111100111001111, 6: 0b111100111101111, 7: 0b111001001001001,
  8: 0b111101111101111, 9: 0b111101111001111, "/": 0b001001010100100, "-": 0b000000111000000,
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map((c) => c * 255);
}

// The faint frame: each disc's rim and its inscribed triangle, point up.
// They sit at 24 of 255, just visible on the panel and still dark to the
// study's count of lit LEDs, which starts above 24.
function buildFrame() {
  const f = new Uint8Array(N);
  for (const d of DISCS) {
    for (let a = 0; a < 720; a++) {
      const t = (a / 720) * 2 * PI, x = floor(d.cx + R * cos(t)), y = floor(d.cy + R * sin(t));
      if (x >= 0 && x < W && y >= 0 && y < H) f[y * W + x] = 1;
    }
    for (let k = 0; k < 3; k++) {
      const a0 = -PI / 2 + (k * 2 * PI) / 3, a1 = a0 + (2 * PI) / 3;
      const x0 = d.cx + R * cos(a0), y0 = d.cy + R * sin(a0), x1 = d.cx + R * cos(a1), y1 = d.cy + R * sin(a1);
      const n = 80;
      for (let j = 0; j <= n; j++) f[floor(y0 + ((y1 - y0) * j) / n) * W + floor(x0 + ((x1 - x0) * j) / n)] = 2;
    }
  }
  return f;
}

export function setup(params) {
  const thr = new Float32Array(N);
  // Each LED lets go of a fading chord at its own level, so a chord crumbles
  // LED by LED instead of dimming, and every lit LED is at full brightness.
  // Half-lit lines would turn the saturated pair towards grey.
  for (let i = 0; i < N; i++) thr[i] = 0.1 + 0.9 * Math.random();
  params.s = {
    accL: new Float32Array(N), accS: new Float32Array(N), thr, frame: buildFrame(),
    long: [0, 0, 0], total: [0, 0, 0], carry: 0, hue: 0, clock: 0, scale: 1, cap: 2.5,
    seeds: new Int32Array(3 * SEEDS).fill(-1), born: new Float32Array(3 * SEEDS), next: [0, 0, 0],
  };
}

// A chord of the unit circle by method m, as its two ends and its distance
// p from the centre. It is longer than the triangle's side, sqrt 3, exactly
// when p < 1/2, when it cuts the triangle's incircle.
function chord(m) {
  const rnd = Math.random;
  if (m === 0) {
    // Two uniform points on the rim: long with probability 1/3.
    const a = 2 * PI * rnd(), b = 2 * PI * rnd();
    return [cos(a), sin(a), cos(b), sin(b), abs(cos((a - b) / 2))];
  }
  // A uniform point on a random radius (m = 1, long with probability 1/2)
  // or a uniform point in the disc (m = 2, 1/4) as the chord's midpoint.
  const f = 2 * PI * rnd(), p = m === 1 ? rnd() : sqrt(rnd()), h = sqrt(1 - p * p), c = cos(f), s = sin(f);
  return [p * c - h * s, p * s + h * c, p * c + h * s, p * s - h * c, p];
}

function seed(P, d, x, y) {
  x = floor(x);
  y = floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const j = d * SEEDS + P.next[d];
  P.next[d] = (P.next[d] + 1) % SEEDS;
  P.seeds[j] = y * W + x;
  P.born[j] = P.clock;
}

// Disc d draws its chords by method d.
function lay(P, d) {
  const D = DISCS[d], [ax, ay, bx, by, p] = chord(d), isLong = p < 0.5;
  if (d === 0) {
    seed(P, d, D.cx + R * ax, D.cy + R * ay);
    seed(P, d, D.cx + R * bx, D.cy + R * by);
  } else seed(P, d, D.cx + (R * (ax + bx)) / 2, D.cy + (R * (ay + by)) / 2);
  const acc = isLong ? P.accL : P.accS;
  const x0 = D.cx + R * ax, y0 = D.cy + R * ay, dx = R * (bx - ax), dy = R * (by - ay);
  const n = Math.ceil(max(abs(dx), abs(dy)));
  let last = -1;
  for (let j = 0; j <= n; j++) {
    const x = floor(x0 + (dx * j) / max(1, n)), y = floor(y0 + (dy * j) / max(1, n));
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const i = y * W + x;
    if (i === last) continue;
    last = i;
    acc[i] = min(acc[i] + 1, P.cap);
  }
  P.total[d]++;
  if (isLong) P.long[d]++;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  const clock = d * (cl(k[1], 0.2, 3) / 2);
  const rate = 24 * 10 ** cl(k[2], 0, 1), tau = 1.1 * 7 ** cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) {
    P.accL.fill(0);
    P.accS.fill(0);
    P.long = [0, 0, 0];
    P.total = [0, 0, 0];
    P.seeds.fill(-1);
  }
  P.clock += clock;
  // With more chords alive than at the opening, the level an LED needs to
  // light rises with them (to the 0.85th power), so the discs turn from a
  // few lines into a stipple of each method's own density instead of
  // filling solid: even in the middle disc, heavy at the rim in the top one,
  // hollow in the bottom one.
  P.scale = max(1, (rate * tau) / OPEN) ** 0.85;
  P.cap = 2.5 * P.scale;
  const fade = exp(-clock / tau), aL = P.accL, aS = P.accS;
  for (let i = 0; i < N; i++) {
    aL[i] *= fade;
    aS[i] *= fade;
  }
  P.carry += rate * clock;
  const n = floor(P.carry);
  P.carry -= n;
  for (let j = 0; j < n; j++) for (let m = 0; m < 3; m++) lay(P, m);
}

function glyph(display, ch, x0, y0, sc, c) {
  const bits = FONT[ch];
  for (let r = 0; r < 5; r++)
    for (let q = 0; q < 3; q++)
      if ((bits >> (14 - r * 3 - q)) & 1)
        for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) display.setPixel(x0 + q * sc + u, y0 + r * sc + v, c[0], c[1], c[2]);
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  // Magenta for the long chords, green for the short: at full saturation
  // the pair sits as far apart as two colours can on the panel's red-green
  // and yellow-blue axes, and neither opens on red.
  const cL = hsv(P.hue + 5 / 6, 1, 1), cS = hsv(P.hue + 1 / 3, 1, 1);
  const { accL, accS, thr, frame } = P, sc = P.scale;
  for (let i = 0; i < N; i++) {
    const a = accL[i], b = accS[i], t = a + b, x = i % W, y = (i / W) | 0;
    if (t > thr[i] * sc) {
      // A lit LED is at full brightness: the fade shows as crumbling.
      const c = a >= b ? cL : cS;
      display.setPixel(x, y, c[0], c[1], c[2]);
    } else if (frame[i]) display.setPixel(x, y, 24, 24, 24);
    else display.setPixel(x, y, 0, 0, 0);
  }
  for (let j = 0; j < P.seeds.length; j++) {
    const i = P.seeds[j];
    if (i >= 0 && P.clock - P.born[j] < SEED_LIFE) display.setPixel(i % W, (i / W) | 0, 255, 255, 255);
  }
  for (let d = 0; d < 3; d++) {
    const D = DISCS[d], yb = round(D.cy + R) - 1, top = yb - BAR + 1;
    const bx = D.side > 0 ? 43 : 18, tx = D.side > 0 ? 49 : 1;
    const tot = P.total[d], f = tot ? P.long[d] / tot : 0, hgt = round(f * BAR);
    // The bar: the share of long chords so far, out of 40 rows.
    for (let j = 0; j < hgt; j++) for (let q = 0; q < 3; q++) display.setPixel(bx + q, yb - j, cL[0], cL[1], cL[2]);
    // The answer this method gives, as a white tick and its fraction.
    const ty = yb - round((D.num / D.den) * BAR);
    for (let q = -1; q <= 3; q++) display.setPixel(bx + q, ty, 255, 255, 255);
    const lx = D.side > 0 ? tx : tx + 3;
    glyph(display, D.num, lx, ty - 2, 1, cS);
    glyph(display, "/", lx + 4, ty - 2, 1, cS);
    glyph(display, D.den, lx + 8, ty - 2, 1, cS);
    // The running share in percent, two digits, in the long colour.
    const pct = min(99, round(f * 100));
    const s = tot ? [floor(pct / 10), pct % 10] : ["-", "-"];
    glyph(display, s[0], tx, top + 1, 2, cL);
    glyph(display, s[1], tx + 8, top + 1, 2, cL);
  }
}
