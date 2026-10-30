// ===== Patternflow pattern =====
// Title:   Cardinal Vowels
// Family:  type
// Idea:    Daniel Jones's vowel chart stands up on the tall panel with its sixteen cardinal vowels in pairs at their eight places, a point that stands for the tongue glides from place to place across it, and above it, between phonetic brackets, the vowel nearest the tongue is drawn with an x-height of 28 LEDs and melts into the next one as the tongue crosses over, while a lip knob turns every letter into its rounded partner, i into y, a into ɶ, ɯ into u.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the cardinal vowels (Daniel Jones, An Outline of English Phonetics, 1918) and the vowel quadrilateral of the International Phonetic Alphabet, pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cardinal=0..8, Lips=0..1
//
// Knob 1: Hue. Turns every colour together. At 0 the spread-lip letters are cyan, the rounded ones pink, the chart's lines slate blue and the tongue warm white; the big letter turns from cyan through blue and violet to pink as the lips round. At 0.5 the spread-lip letters are red and the rounded ones green.
// Knob 2: Speed. How fast the tongue wanders. At 2 it glides to a new place in about 0.8 s and rests 0.7 s; at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Cardinal. 0 lets the tongue wander by itself. 1 to 8 holds it on the place of Jones's primary vowel of that number, in his order round the edge of the chart: 1 close front, down the front to 4 open front, across the floor to 5 open back, and up the back to 8 close back. Between two numbers it stands between the two places, and the big letter is half one and half the other; between 0 and 1 it is pulled from where it wanders toward vowel 1.
// Knob 4: Lips. Rounds the lips: below 0.1 every letter is the spread-lip one (i e ɛ a ɑ ʌ ɤ ɯ), above 0.9 the rounded one (y ø œ ɶ ɒ ɔ o u), and in between the big letter morphs from one to the other and the small pairs on the chart trade brightness. The number in the top left corner is Jones's: 1 to 8 for his primary vowels, 9 to 16 for the secondary ones.

// Daniel Jones fixed eight reference vowels round the edge of the space the
// tongue can reach: 1 [i] with the tongue as high and as far forward as it
// goes without friction, 5 [ɑ] as low and as far back, and between them, on
// the front and back edges, vowels at equal steps of sound. Those are his
// primary cardinal vowels, i e ɛ a ɑ ɔ o u. The secondary ones, 9 to 16,
// take the same tongue and the other lips: y ø œ ɶ ɒ ʌ ɤ ɯ. He recorded
// them himself for the gramophone, in 1917 and again in 1956. The chart the
// International Phonetic Alphabet prints is his quadrilateral, close at the
// top and open at the bottom, front at the left and back at the right, with
// each place holding a pair, the unrounded letter left of its dot and the
// rounded one right of it.
//
// On the panel the chart stands 62 LEDs high and 42 wide at the top, its
// front edge slanting in to half that at the floor as on the IPA chart. The
// big letter is the vowel whose dot is nearest the tongue. When the tongue
// is about as near two dots, the letter is drawn from the blend of the two
// letters' distance fields, so one letter melts into the other instead of
// switching, and Lips blends each letter's field with its rounded
// partner's in the same way. Inside the chart each dot has a faint pool of
// light that fades out where another dot becomes nearer, so the pools are
// the regions that name the same vowel.
//
// Every glyph is drawn here: the big letters as strokes (straight runs,
// ellipse arcs and Catmull-Rom curves) whose distance fields are worked out
// once, the small ones as 5-row pixel letters, and the figures as 3 by 5
// pixel figures.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp, abs, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The chart: close at TY, open at BY; the front edge runs from FX0 to FX1,
// the back edge stands at BX.
const TY = 60, BY = 121, FX0 = 12, FX1 = 33, BX = 54;
// The big letter: x-height XH from row TOP, in rows 0..BH-1.
const XH = 28, TOP = 13, BH = 52, HW = 2.3;

// --- Big letters, as strokes in x-height units (y down, 0 top, 1 baseline).
function arc(cx, cy, rx, ry, a0, a1) {
  const n = max(4, round(abs(a1 - a0) * 6)), p = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + rx * cos(a), cy + ry * sin(a)]);
  }
  return p;
}
function curve(...c) {
  const p = [];
  for (let i = 0; i + 1 < c.length; i++) {
    const a = c[max(0, i - 1)], b = c[i], d = c[i + 1], e = c[min(c.length - 1, i + 2)];
    for (let s = 0; s < 6; s++) {
      const t = s / 6, t2 = t * t, t3 = t2 * t;
      const f = (k) => 0.5 * (2 * b[k] + (d[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * d[k] - e[k]) * t2 + (3 * b[k] - a[k] - 3 * d[k] + e[k]) * t3);
      p.push([f(0), f(1)]);
    }
  }
  p.push(c[c.length - 1]);
  return p;
}
const line = (...p) => p;
const mirror = (strokes, w) => strokes.map((s) => s.map(([x, y]) => [w - x, y]));
const O = arc(0.42, 0.5, 0.42, 0.5, 0, 2 * PI);
const SCRIPT_A = [curve([0.78, 0.22], [0.5, 0.0], [0.16, 0.12], [0.04, 0.5], [0.16, 0.88], [0.5, 1.0], [0.78, 0.78]), line([0.8, 0], [0.8, 1])];

// [name, width in x-height units, strokes]
const BIG = {
  i: [0.4, [line([0.2, 0], [0.2, 1]), line([0.2, -0.33], [0.2, -0.3])]],
  e: [0.86, [line([0.06, 0.5], [0.84, 0.5]), curve([0.84, 0.5], [0.76, 0.18], [0.44, 0.0], [0.12, 0.16], [0.03, 0.52], [0.16, 0.87], [0.48, 1.0], [0.8, 0.86])]],
  "ɛ": [0.86, [curve([0.82, 0.14], [0.5, 0.0], [0.2, 0.08], [0.16, 0.32], [0.46, 0.5], [0.12, 0.62], [0.06, 0.86], [0.42, 1.0], [0.84, 0.86]), line([0.46, 0.5], [0.58, 0.5])]],
  a: [0.86, [curve([0.12, 0.12], [0.42, 0.0], [0.72, 0.1], [0.78, 0.4], [0.78, 1.0]), curve([0.78, 0.5], [0.36, 0.48], [0.05, 0.68], [0.14, 0.95], [0.44, 1.0], [0.78, 0.84])]],
  "ɑ": [0.9, SCRIPT_A],
  "ʌ": [0.9, [line([0.02, 1], [0.45, 0], [0.88, 1])]],
  "ɤ": [0.9, [curve([0.02, 0.0], [0.26, 0.38], [0.5, 0.72], [0.57, 0.92], [0.45, 1.01], [0.33, 0.92], [0.4, 0.72], [0.64, 0.38], [0.88, 0.0])]],
  "ɯ": [0.92, [line([0.04, 0], [0.04, 0.62]), arc(0.25, 0.62, 0.21, 0.38, PI, 0), line([0.46, 0], [0.46, 0.62]), arc(0.67, 0.62, 0.21, 0.38, PI, 0), line([0.88, 0], [0.88, 1])]],
  y: [0.9, [line([0.02, 0], [0.47, 0.98]), curve([0.88, 0], [0.47, 0.98], [0.34, 1.24], [0.12, 1.34])]],
  "ø": [0.9, [O, line([-0.04, 1.1], [0.88, -0.1])]],
  "œ": [1.42, [arc(0.36, 0.5, 0.34, 0.5, 0, 2 * PI), line([0.7, 0.5], [1.4, 0.5]), curve([1.4, 0.5], [1.32, 0.18], [1.05, 0.0], [0.76, 0.14], [0.7, 0.5], [0.76, 0.86], [1.06, 1.0], [1.38, 0.86])]],
  "ɶ": [1.34, [curve([0.72, 0.0], [0.3, 0.04], [0.04, 0.5], [0.3, 0.96], [0.72, 1.0]), line([1.32, 0], [0.72, 0], [0.72, 1], [1.32, 1]), line([0.72, 0.5], [1.2, 0.5])]],
  "ɒ": [0.9, mirror(SCRIPT_A, 0.84)],
  "ɔ": [0.84, [curve([0.08, 0.14], [0.42, 0.0], [0.78, 0.28], [0.8, 0.5], [0.78, 0.72], [0.42, 1.0], [0.06, 0.86])]],
  o: [0.84, [O]],
  u: [0.84, [line([0.04, 0], [0.04, 0.62]), arc(0.42, 0.62, 0.38, 0.38, PI, 0), line([0.8, 0], [0.8, 1])]],
};

// --- Small letters, 5 rows of x-height (rows 2..6 of 9: two above for the
// dot of i and the slash of ø, two below for the tail of y).
const SMALL = {
  i: [".#.", "...", "##.", ".#.", ".#.", ".#.", "###"],
  e: [".###.", "#...#", "#####", "#....", ".###."],
  "ɛ": [".####", "#....", ".###.", "#....", ".####"],
  a: [".###.", "....#", ".####", "#...#", ".####"],
  "ɑ": [".##.#", "#..##", "#...#", "#..##", ".##.#"],
  "ʌ": ["..#..", ".#.#.", ".#.#.", "#...#", "#...#"],
  "ɤ": ["#...#", ".#.#.", "..#..", ".#.#.", "..#.."],
  "ɯ": ["#.#.#", "#.#.#", "#.#.#", "#.#.#", ".#.##"],
  y: ["#...#", "#...#", ".#.#.", ".#.#.", "..#..", ".#...", "#...."],
  "ø": ["....#", ".###.", "#..##", "#.#.#", "##..#", ".###.", "#...."],
  "œ": [".##.##.", "#..#..#", "#..####", "#..#...", ".##.###"],
  "ɶ": [".######", "#..#...", "#..####", "#..#...", ".######"],
  "ɒ": ["#.##.", "##..#", "#...#", "##..#", "#.##."],
  "ɔ": [".###.", "....#", "....#", "....#", ".###."],
  o: [".###.", "#...#", "#...#", "#...#", ".###."],
  u: ["#...#", "#...#", "#...#", "#..##", ".##.#"],
};
// Rows above the x-height for each small letter that reaches up.
const RISE = { i: 2, "ø": 1 };

// 3 by 5 figures, drawn for this pattern.
const FIG = ["####.##.##.####", ".#.##..#..#.###", "###..#####..###", "###..#.##..####", "#.##.####..#..#", "####..###..####", "####..####.####", "###..#..#.#..#.", "####.#####.####", "####.####..####"];

// The eight places in Jones's order, as (backness, openness), with the
// spread-lip and rounded letters and their cardinal numbers.
const PLACES = [
  [0, 0, "i", "y", 1, 9],
  [0, 1 / 3, "e", "ø", 2, 10],
  [0, 2 / 3, "ɛ", "œ", 3, 11],
  [0, 1, "a", "ɶ", 4, 12],
  [1, 1, "ɑ", "ɒ", 5, 13],
  [1, 2 / 3, "ʌ", "ɔ", 14, 6],
  [1, 1 / 3, "ɤ", "o", 15, 7],
  [1, 0, "ɯ", "u", 16, 8],
];
const px = (b, v) => FX0 + v * (FX1 - FX0) + b * (BX - FX0 - v * (FX1 - FX0));
const py = (v) => TY + v * (BY - TY);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const c = i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
  o[0] = c[0];
  o[1] = c[1];
  o[2] = c[2];
  return o;
}

function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l > 0 ? cl(((x - ax) * dx + (y - ay) * dy) / l, 0, 1) : 0;
  const ex = ax + dx * t - x, ey = ay + dy * t - y;
  return sqrt(ex * ex + ey * ey);
}

// The distance from every LED of the big box to a letter's strokes, in LEDs.
function field(name) {
  const [w, strokes] = BIG[name], x0 = W / 2 - (w * XH) / 2, f = new Float32Array(W * BH);
  const segs = [];
  for (const s of strokes) for (let i = 0; i + 1 < s.length; i++) segs.push([x0 + s[i][0] * XH, TOP + s[i][1] * XH, x0 + s[i + 1][0] * XH, TOP + s[i + 1][1] * XH]);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < W; x++) {
      let d = 1e9;
      for (const g of segs) d = min(d, segDist(x + 0.5, y + 0.5, g[0], g[1], g[2], g[3]));
      f[y * W + x] = d;
    }
  return f;
}

export function setup(params) {
  const F = {};
  for (const name of Object.keys(BIG)) F[name] = field(name);
  // Each LED inside the chart: its nearest place and how near the next.
  const cell = new Int8Array(W * H).fill(-1), pool = new Float32Array(W * H);
  for (let y = TY; y <= BY; y++) {
    const v = (y - TY) / (BY - TY), xf = FX0 + v * (FX1 - FX0);
    for (let x = Math.ceil(xf); x <= BX; x++) {
      let d1 = 1e9, d2 = 1e9, k1 = 0;
      PLACES.forEach((p, k) => {
        const d = Math.hypot(px(p[0], p[1]) - x, py(p[1]) - y);
        if (d < d1) (d2 = d1), (d1 = d), (k1 = k);
        else if (d < d2) d2 = d;
      });
      cell[y * W + x] = k1;
      pool[y * W + x] = 1 - (2 * d1) / (d1 + d2);
    }
  }
  params.s = {
    F, cell, pool, b: 0, v: 0, fb: 0, fv: 0, gb: 0, gv: 0, at: 0, go: 1, rest: 0, trail: [], hue: 0, speed: 1, hand: 0, lips: 0,
    rgb: new Float32Array(W * H * 3),
  };
  pick(params.s);
}

// The next place to glide to: another cardinal vowel, or now and then a
// point between them.
function pick(S) {
  S.fb = S.b;
  S.fv = S.v;
  if (Math.random() < 0.25) {
    S.gb = 0.15 + 0.7 * Math.random();
    S.gv = 0.1 + 0.8 * Math.random();
  } else {
    let k;
    do k = floor(Math.random() * 8);
    while (PLACES[k][0] === S.gb && PLACES[k][1] === S.gv);
    S.gb = PLACES[k][0];
    S.gv = PLACES[k][1];
  }
  const d = Math.hypot((S.gb - S.fb) * 0.7, S.gv - S.fv);
  S.go = 0.45 + 0.5 * d;
  S.at = 0;
}

// Where knob 3 puts the tongue: along the edge through the places 1..8.
function edge(c) {
  const k = min(6, floor(c - 1)), f = c - 1 - k, a = PLACES[k], b = PLACES[k + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  S.hand = cl(k[2] || 0, 0, 8);
  S.lips = sm(0.1, 0.9, cl(k[3] == null ? 0.06 : k[3], 0, 1));
  // The wander.
  if (S.rest > 0) {
    S.rest -= d * S.speed;
    if (S.rest <= 0) pick(S);
  } else {
    S.at += (d * S.speed) / S.go;
    if (S.at >= 1) (S.at = 1), (S.rest = 0.7);
  }
  const e = sm(0, 1, S.at);
  let b = S.fb + (S.gb - S.fb) * e, v = S.fv + (S.gv - S.fv) * e;
  if (S.hand > 0) {
    // The hand: pulled from the wander toward vowel 1 below 1, along the
    // edge above it, and eased so a turned knob glides rather than jumps.
    const [hb, hv] = edge(max(1, S.hand)), f = min(1, S.hand), a = 1 - exp(-d * 12);
    b += (hb - b) * f;
    v += (hv - v) * f;
    S.b += (b - S.b) * a;
    S.v += (v - S.v) * a;
  } else (S.b = b), (S.v = v);
  S.trail.push([px(S.b, S.v), py(S.v)]);
  if (S.trail.length > 36) S.trail.shift();
}

function add(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  rgb[o] = max(rgb[o], c[0] * a);
  rgb[o + 1] = max(rgb[o + 1], c[1] * a);
  rgb[o + 2] = max(rgb[o + 2], c[2] * a);
}

function small(rgb, name, x, y, c, a) {
  const rows = SMALL[name], rise = RISE[name] || 0;
  for (let r = 0; r < rows.length; r++)
    for (let i = 0; i < rows[r].length; i++) if (rows[r][i] === "#") add(rgb, x + i, y - rise + r, c, a);
}

function figure(rgb, n, x, y, c, a) {
  const s = String(n);
  for (let j = 0; j < s.length; j++) {
    const g = FIG[+s[j]];
    for (let r = 0; r < 5; r++) for (let i = 0; i < 3; i++) if (g[r * 3 + i] === "#") add(rgb, x + j * 4 + i, y + r, c, a);
  }
}

function seg(rgb, x0, y0, x1, y1, c, a) {
  const n = max(abs(x1 - x0), abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) add(rgb, round(x0 + ((x1 - x0) * i) / n), round(y0 + ((y1 - y0) * i) / n), c, a);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, hue = S.hue, lips = S.lips;
  rgb.fill(0);
  const cu = hsv(0.5 + hue, 0.85, 1, [0, 0, 0]), cr = hsv(0.9 + hue, 0.7, 1, [0, 0, 0]), lineC = hsv(0.62 + hue, 0.45, 1, [0, 0, 0]);
  // The letter's colour turns the short way round the wheel, through blue.
  const cl2 = hsv(0.5 + 0.4 * lips + hue, 0.85 - 0.15 * lips, 1, [0, 0, 0]);
  const tx = px(S.b, S.v), ty = py(S.v);
  // The two places nearest the tongue.
  let d1 = 1e9, d2 = 1e9, k1 = 0, k2 = 1;
  PLACES.forEach((p, k) => {
    const d = Math.hypot(px(p[0], p[1]) - tx, py(p[1]) - ty);
    if (d < d1) (d2 = d1), (k2 = k1), (d1 = d), (k1 = k);
    else if (d < d2) (d2 = d), (k2 = k);
  });
  const m = 0.5 * sm(0.3, 0.5, d1 / (d1 + d2));
  // The pools.
  for (let p = 0; p < W * H; p++) {
    const k = S.cell[p];
    if (k < 0) continue;
    const a = (k === k1 ? 0.3 : 0.13) * S.pool[p];
    rgb[p * 3] = cl2[0] * a;
    rgb[p * 3 + 1] = cl2[1] * a;
    rgb[p * 3 + 2] = cl2[2] * a;
  }
  // The chart's lines: the edge, the close-mid and open-mid lines, the
  // central line.
  const L = 0.42, L2 = 0.22;
  seg(rgb, FX0, TY, BX, TY, lineC, L);
  seg(rgb, BX, TY, BX, BY, lineC, L);
  seg(rgb, FX1, BY, BX, BY, lineC, L);
  seg(rgb, FX0, TY, FX1, BY, lineC, L);
  for (const v of [1 / 3, 2 / 3]) seg(rgb, round(px(0, v)), round(py(v)), BX, round(py(v)), lineC, L2);
  seg(rgb, round(px(0.5, 0)), TY, round(px(0.5, 1)), BY, lineC, L2);
  // The pairs.
  PLACES.forEach((p, k) => {
    const x = round(px(p[0], p[1])), y = round(py(p[1]));
    const near = k === k1 ? 1 : k === k2 ? 2 * m : 0;
    add(rgb, x, y, [1, 1, 1], 0.6 + 0.4 * near);
    const wl = SMALL[p[2]][SMALL[p[2]].length - 1].length;
    const au = 0.16 + (0.56 + 0.28 * near) * (1 - lips), ar = 0.16 + (0.56 + 0.28 * near) * lips;
    const wu = [0, 0, 0], wr = [0, 0, 0];
    for (let c = 0; c < 3; c++) (wu[c] = cu[c] + (1 - cu[c]) * 0.5 * near * (1 - lips)), (wr[c] = cr[c] + (1 - cr[c]) * 0.5 * near * lips);
    small(rgb, p[2], x - 2 - wl, y - 2, wu, au);
    small(rgb, p[3], x + 2, y - 2, wr, ar);
  });
  // The tongue and where it has been.
  for (let i = 0; i < S.trail.length; i++) {
    const [x, y] = S.trail[i];
    add(rgb, floor(x), floor(y), [1, 0.85, 0.65], 0.12 + (0.35 * i) / S.trail.length);
  }
  const tc = hsv(0.1 + hue, 0.3, 1, [0, 0, 0]);
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      const r = Math.hypot(i + floor(tx) + 0.5 - tx, j + floor(ty) + 0.5 - ty);
      add(rgb, floor(tx) + i, floor(ty) + j, tc, cl(1.6 - r, 0, 1) + 0.25 * exp(-r));
    }
  // The big letter: the nearest place's letter, blended toward the next
  // nearest by m and toward its rounded partner by lips.
  const P1 = PLACES[k1], P2 = PLACES[k2], F = S.F;
  const a1 = F[P1[2]], b1 = F[P1[3]], a2 = F[P2[2]], b2 = F[P2[3]];
  // A blend of two fields thins out where the letters part, so the stroke
  // swells by up to 1.25 LEDs halfway.
  const thick = 5 * max(m * (1 - m), lips * (1 - lips));
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let d = a1[p];
      if (lips > 0) d += (b1[p] - d) * lips;
      if (m > 0) d += (a2[p] + (b2[p] - a2[p]) * lips - d) * m;
      d -= thick;
      const core = cl(HW + 0.5 - d, 0, 1), glow = 0.2 * exp(-max(0, d - HW) / 2.2);
      add(rgb, x, y, cl2, core + (1 - core) * glow);
    }
  // Phonetic brackets round it, and Jones's number for it.
  const bc = lineC, BT = 5, BB = 48;
  seg(rgb, 3, BT, 3, BB, bc, 0.55);
  seg(rgb, 3, BT, 6, BT, bc, 0.55);
  seg(rgb, 3, BB, 6, BB, bc, 0.55);
  seg(rgb, 60, BT, 60, BB, bc, 0.55);
  seg(rgb, 57, BT, 60, BT, bc, 0.55);
  seg(rgb, 57, BB, 60, BB, bc, 0.55);
  const n = lips < 0.5 ? P1[4] : P1[5];
  figure(rgb, n, 8, 7, [1, 1, 1], 0.6);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, round(rgb[o] * 255)), min(255, round(rgb[o + 1] * 255)), min(255, round(rgb[o + 2] * 255)));
    }
}
