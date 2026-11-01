// ===== Patternflow pattern =====
// Title:   Chronogram
// Family:  type
// Idea:    A Latin or English inscription is set in four centred lines down the panel in a pixel face drawn for it, and a reader goes through it, lighting each capital that is a Roman numeral in gold and sending a copy of that same letter flying down into a row where the numerals sort themselves largest first, while the total below counts up in big figures by each letter's value until it stops on the year the words hide, flashes, and shows that year as it is usually written in Roman numerals.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: chronograms, inscriptions whose capital Roman numerals add up to a year (James Hilton's collection Chronograms, 1882); ChrIstVs DVX ergo trIVMphVs (1632, a coin of Gustavus Adolphus), LorD haVe MerCIe Vpon Vs (1666, London) and My Day Closed Is In Immortality (1603, the death of Elizabeth I); letters drawn for this pattern; pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Inscription=0..5, Order=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the inscription is pale blue, the numerals and the total are gold and the letter being read is white; at 0.5 the text turns pale amber and the gold turns blue.
// Knob 2: Speed. At 2 the inscription types in for 1 s, the reader spends 0.08 s on a plain letter and 0.55 s on a numeral, whose copy flies down in 0.6 s, and the year flashes and holds 3.2 s before the text fades in 1 s for the next inscription; ChrIstVs DVX ergo trIVMphVs takes 12.9 s in reading order and all six take 70 s. Every time goes as 2 / Speed.
// Knob 3: Inscription. 0 is ChrIstVs DVX ergo trIVMphVs, C + I + V + D + V + X + I + V + M + V = 1632; 1 is LorD haVe MerCIe Vpon Vs, L + D + V + M + C + I + V + V = 1666; 2 is My Day Closed Is In Immortality, where only the capitals count, M + D + C + I + I + I = 1603. 3 to 5 are the same three with the letters that do not count in small capitals six rows tall, as inscriptions cut in capitals often set them, so the counted capitals stand out only by being three rows taller. Each is followed by the next, and turning the knob starts the one it points at.
// Knob 4: Order. The order the reader counts in, a third of the knob each. At 0 and the opening 0.06 it reads the text and the total wanders up, 100, 101, 106, 606 and on; in the middle third it goes straight to the largest numeral left, so the total climbs as the Roman numeral is written, 1000, 1500, 1600; in the top third it takes the smallest first and the thousand comes last. The year is the same every way.

// A chronogram writes a year into a sentence: every letter that is a
// Roman numeral, I V X L C D M, is set as a capital, and the capitals add
// up, each at its own value and in any order, with no subtraction: IV in
// a chronogram is six, not four. U was written V and J was I in the
// inscriptions, so they would count as 5 and 1; none of the three here
// needs them. In the first two every numeral letter in the words is a
// capital. The third sets only the initials as capitals and leaves the l,
// d, m and i inside its words uncounted.
//
// The reader takes the numerals in the order Order sets. Each one turns
// gold, and a copy of its glyph flies down to the row of numerals, where it
// slides in after every numeral at least as large, so the row always reads
// as an additive Roman numeral, largest first: MDCXVVVVII for 1632, which
// the usual subtractive form, shown under the year at the end, writes
// MDCXXXII. The total counts up when the letter lands, eased towards the
// new sum so the figures roll.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seconds at Speed 2.
const TYPE = 1.0, STEP = 0.08, NUM = 0.55, LIFT = 0.15, FLY = 0.6, FLASH = 0.8, HOLD = 2.4, CLEAR = 1.0;
// Rows: the first text line and the line pitch, the row of numerals, the
// value tag, the big figures and the year in the usual Roman form.
const TEXT_Y = 3, PITCH = 16, TRAY_Y = 70, TAG_Y = 87, YEAR_Y = 97, ROMAN_Y = 118;

const VALUE = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000, U: 5, J: 1 };

const INSCRIPTIONS = [
  ["ChrIstVs", "DVX", "ergo", "trIVMphVs"],
  ["LorD", "haVe", "MerCIe", "Vpon Vs"],
  ["My Day", "Closed Is", "In", "Immortality"],
];

// The face: capitals nine rows tall on the baseline at row 8, small
// letters six rows tall, ascenders from row 0 and descenders to row 11.
// Each glyph is its first row and then its rows, top first.
const FACE = {
  C: "0.###.|#...#|#....|#....|#....|#....|#....|#...#|.###.",
  D: "0####.|#...#|#...#|#...#|#...#|#...#|#...#|#...#|####.",
  I: "0###|.#.|.#.|.#.|.#.|.#.|.#.|.#.|###",
  L: "0#....|#....|#....|#....|#....|#....|#....|#....|#####",
  M: "0#.....#|##...##|#.#.#.#|#..#..#|#.....#|#.....#|#.....#|#.....#|#.....#",
  V: "0#...#|#...#|#...#|#...#|#...#|.#.#.|.#.#.|.#.#.|..#..",
  X: "0#...#|#...#|.#.#.|.#.#.|..#..|.#.#.|.#.#.|#...#|#...#",
  a: "3.##.|...#|.###|#..#|#..#|.###",
  d: "0...#|...#|...#|.###|#..#|#..#|#..#|#..#|.###",
  e: "3.##.|#..#|####|#...|#..#|.##.",
  g: "3.###|#..#|#..#|#..#|#..#|.###|...#|#..#|.##.",
  h: "0#...|#...|#...|###.|#..#|#..#|#..#|#..#|#..#",
  i: "1#|.|#|#|#|#|#|#",
  l: "0#.|#.|#.|#.|#.|#.|#.|#.|.#",
  m: "3####.|#.#.#|#.#.#|#.#.#|#.#.#|#.#.#",
  n: "3###.|#..#|#..#|#..#|#..#|#..#",
  o: "3.##.|#..#|#..#|#..#|#..#|.##.",
  p: "3###.|#..#|#..#|#..#|#..#|###.|#...|#...|#...",
  r: "3#.##|##..|#...|#...|#...|#...",
  s: "3.###|#...|#...|.##.|...#|###.",
  t: "1.#.|.#.|###|.#.|.#.|.#.|.#.|..#",
  y: "3#..#|#..#|#..#|#..#|#..#|.###|...#|#..#|.##.",
};
// Small capitals for the letters that do not count, on the x-height.
const SMALL = {
  a: ".##.|#..#|#..#|####|#..#|#..#", d: "###.|#..#|#..#|#..#|#..#|###.", e: "####|#...|###.|#...|#...|####",
  g: ".###|#...|#...|#.##|#..#|.###", h: "#..#|#..#|####|#..#|#..#|#..#", i: "###|.#.|.#.|.#.|.#.|###",
  l: "#...|#...|#...|#...|#...|####", m: "#...#|##.##|#.#.#|#...#|#...#|#...#", n: "#..#|##.#|#.##|#..#|#..#|#..#",
  o: ".##.|#..#|#..#|#..#|#..#|.##.", p: "###.|#..#|#..#|###.|#...|#...", r: "###.|#..#|#..#|###.|#.#.|#..#",
  s: ".###|#...|.##.|...#|...#|###.", t: "###|.#.|.#.|.#.|.#.|.#.", y: "#...#|#...#|.#.#.|..#..|..#..|..#..",
};
function glyphs(face, top) {
  const out = {};
  for (const [ch, code] of Object.entries(face)) {
    const t = top == null ? +code[0] : top, rows = (top == null ? code.slice(1) : code).split("|");
    const dots = [];
    rows.forEach((row, j) => [...row].forEach((c, i) => c === "#" && dots.push([i, t + j])));
    out[ch] = { w: rows[0].length, dots };
  }
  return out;
}
const GLYPH = glyphs(FACE);
const SMALLCAP = { ...GLYPH, ...glyphs(SMALL, 3) };

// Figures 5 by 9 for the total, drawn twice as large.
const FIG = [
  ".###.#...##...##..###.#.###..##...##...#.###.", "..#...##..#.#....#....#....#....#....#..#####",
  ".###.#...#....#....#...#...#...#...#....#####", ".###.#...#....#....#..##.....#....##...#.###.",
  "...#...##..#.#.#..#.#..#.#####...#....#....#.", "######....#....####.....#....#....##...#.###.",
  ".###.#....#....####.#...##...##...##...#.###.", "#####....#....#...#...#....#...#....#....#...",
  ".###.#...##...##...#.###.#...##...##...#.###.", ".###.#...##...##...#.####....#....#....#.###.",
];
// 3 by 5 figures and a plus for the value tag.
const TAG = { "+": "000010111010000", 0: "111101101101111", 1: "010110010010111", 5: "111100111001111" };
const DOT = { w: 1, dots: [[0, 0]] };

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

// Lays an inscription out in a face: four centred lines, each letter with
// its place, its glyph and its value if it is a numeral capital.
function layout(lines, face) {
  const letters = [];
  lines.forEach((line, n) => {
    const chars = [...line];
    let x = floor((W - chars.reduce((s, c) => s + (c === " " ? 3 : face[c].w + 1), -1)) / 2);
    for (const c of chars) {
      if (c !== " ") letters.push({ g: face[c], x, y: TEXT_Y + n * PITCH, v: VALUE[c] || 0 });
      x += c === " " ? 3 : face[c].w + 1;
    }
  });
  const year = letters.reduce((s, l) => s + l.v, 0);
  return { letters, year, roman: [...roman(year)].map((c) => GLYPH[c]) };
}

// The year as it is usually written, with subtraction.
function roman(n) {
  let out = "";
  for (const [v, r] of [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]])
    while (n >= v) (out += r), (n -= v);
  return out;
}
// The three inscriptions in small letters, then the three in small capitals.
const SETS = [...INSCRIPTIONS.map((lines) => layout(lines, GLYPH)), ...INSCRIPTIONS.map((lines) => layout(lines, SMALLCAP))];

export function setup(params) {
  params.s = { ins: -1, knob: -1, order: 0, hue: 0, rgb: new Float32Array(W * H * 3) };
}

// A new inscription: it types in, then the reader starts.
function begin(S, ins) {
  S.ins = ins;
  S.set = SETS[ins];
  S.typeT = 0;
  read(S);
}

// The reader starts again: the order it visits the letters in, and
// nothing counted yet. In reading order it passes every letter; by value
// it goes straight from numeral to numeral, ties in reading order.
function read(S) {
  const L = S.set.letters, idx = L.map((_, i) => i);
  const nums = idx.filter((i) => L[i].v);
  S.seq = S.order === 0 ? idx : nums.sort((a, b) => (S.order === 1 ? L[b].v - L[a].v : L[a].v - L[b].v) || a - b);
  S.done = new Uint8Array(L.length);
  S.phase = 0;
  S.t = 0;
  S.clock = 0;
  S.cur = 0;
  S.dwell = 0;
  S.launched = false;
  S.gold = new Float32Array(S.set.letters.length).fill(-1);
  S.tray = [];
  S.flights = [];
  S.target = 0;
  S.shown = 0;
  S.tag = null;
}

// Where each numeral in the row sits, centred, with one LED between.
function trayLayout(tray) {
  let x = floor((W - tray.reduce((s, e) => s + e.g.w + 1, -1)) / 2);
  for (const e of tray) {
    e.tx = x;
    x += e.g.w + 1;
  }
}

function launch(S, i) {
  const l = S.set.letters[i];
  // After every numeral at least as large: the row stays largest first.
  let at = 0;
  while (at < S.tray.length && S.tray[at].v >= l.v) at++;
  const e = { g: l.g, v: l.v, x: 0, tx: 0, landed: false };
  S.tray.splice(at, 0, e);
  trayLayout(S.tray);
  S.flights.push({ e, x0: l.x, y0: l.y, t: 0 });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const ins = round(cl(k[2] || 0, 0, SETS.length - 1)), order = floor(cl(k[3] == null ? 0.06 : k[3], 0, 0.999) * 3);
  // Turning the knob starts the inscription it points at; on its own the
  // pattern goes on to the next one.
  if (ins !== S.knob) (S.knob = ins), (S.order = order), begin(S, ins);
  else if (order !== S.order) (S.order = order), read(S);
  const step = (d * speed) / 2;
  if (S.typeT < TYPE) {
    S.typeT = min(TYPE, S.typeT + step);
    return;
  }
  S.t += step;
  S.clock += step;
  const L = S.set.letters;
  // Flights: each copy goes down in FLY seconds and adds its value on landing.
  for (const f of S.flights) {
    f.t += step;
    if (f.t >= FLY && !f.e.landed) {
      f.e.landed = true;
      f.e.x = f.e.tx;
      S.target += f.e.v;
      S.tag = { v: f.e.v, t: 0 };
    }
  }
  S.flights = S.flights.filter((f) => f.t < FLY);
  for (const e of S.tray) if (e.landed) e.x += (e.tx - e.x) * (1 - exp(-step * 12));
  if (S.tag) S.tag.t += step;
  // The total rolls towards the sum.
  S.shown += (S.target - S.shown) * (1 - exp(-step * 7));
  if (abs(S.target - S.shown) < 0.5) S.shown = S.target;
  if (S.phase === 0) {
    S.dwell += step;
    const i = S.seq[S.cur], l = L[i];
    if (l.v && S.gold[i] < 0) S.gold[i] = S.clock;
    if (l.v && !S.launched && S.dwell >= LIFT) {
      launch(S, i);
      S.launched = true;
    }
    if (S.dwell >= (l.v ? NUM : STEP)) {
      S.dwell = 0;
      S.launched = false;
      S.done[i] = 1;
      if (++S.cur >= S.seq.length) S.phase = 1;
    }
  } else if (S.phase === 1) {
    // Wait for the last copy to land and the figures to settle, then flash.
    if (!S.flights.length && S.shown === S.target) {
      S.phase = 2;
      S.t = 0;
    }
  } else if (S.phase === 2) {
    if (S.t >= FLASH + HOLD) {
      S.phase = 3;
      S.t = 0;
    }
  } else if (S.t >= CLEAR) begin(S, (S.ins + 1) % SETS.length);
}

function glyph(rgb, g, x, y, c, v) {
  for (const [i, j] of g.dots) {
    const px = x + i, py = y + j;
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    const p = (py * W + px) * 3;
    rgb[p] = max(rgb[p], c[0] * v);
    rgb[p + 1] = max(rgb[p + 1], c[1] * v);
    rgb[p + 2] = max(rgb[p + 2], c[2] * v);
  }
}

function block(rgb, x, y, c, v) {
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const p = ((y + j) * W + x + i) * 3;
      rgb[p] = c[0] * v;
      rgb[p + 1] = c[1] * v;
      rgb[p + 2] = c[2] * v;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.set) return;
  const rgb = S.rgb, h = S.hue;
  rgb.fill(0);
  const ink = hsv(h + 0.58, 0.36, 1), gold = hsv(h + 0.12, 0.78, 1), white = [1, 1, 1];
  const L = S.set.letters;
  // The flash when the year is reached, and the fade before the next one.
  const flash = S.phase === 2 ? max(0, 1 - S.t / FLASH) : 0;
  const fade = S.phase === 3 ? 1 - S.t / CLEAR : 1;
  const typed = S.typeT < TYPE ? (S.typeT / TYPE) * L.length : L.length;
  // The inscription: unread letters in ink, read ones at half, the letter
  // being read white, and the numerals gold from the moment it reaches them.
  for (let i = 0; i < L.length && i < typed; i++) {
    const l = L[i];
    let c = ink, v = 1;
    if (S.gold[i] >= 0) c = mix(mix(white, gold, ease((S.clock - S.gold[i]) / 0.3)), white, flash * 0.7);
    else if (S.phase === 0 && i === S.seq[S.cur]) c = white;
    else if (S.phase > 0 || S.done[i]) v = 0.5;
    glyph(rgb, l.g, l.x, l.y, c, v * fade);
  }
  // The numerals in the air, on an arc down to their place in the row.
  for (const f of S.flights) {
    const u = ease(f.t / FLY), x = f.x0 + (f.e.tx - f.x0) * u, y = f.y0 + (TRAY_Y - f.y0) * u;
    glyph(rgb, f.e.g, round(x + sin(u * PI) * 6 * (f.e.tx > f.x0 ? -1 : 1)), round(y), gold, 1);
  }
  // The row of numerals, largest first.
  for (const e of S.tray) if (e.landed) glyph(rgb, e.g, round(e.x), TRAY_Y, mix(gold, white, flash), fade);
  // The value tag over the figures as a letter lands.
  if (S.tag && S.tag.t < 0.8 && S.phase < 3) {
    const s = "+" + S.tag.v, v = 1 - S.tag.t / 0.8;
    let x = floor((W - (s.length * 4 - 1)) / 2);
    for (const ch of s) {
      const g = TAG[ch];
      for (let j = 0; j < 15; j++) if (g[j] === "1") glyph(rgb, DOT, x + (j % 3), TAG_Y + floor(j / 3), mix(gold, white, 0.4), v);
      x += 4;
    }
  }
  // The total in four big figures, places not reached yet as dim zeros.
  const n = round(S.shown), digits = String(n).padStart(4, "0");
  const lead = n > 0 ? 4 - String(n).length : 3;
  for (let q = 0; q < 4; q++) {
    const f = FIG[+digits[q]], lit = q >= lead;
    const c = lit ? mix(gold, white, flash) : ink, v = (lit ? 1 : 0.16) * fade;
    for (let j = 0; j < 45; j++) if (f[j] === "#") block(rgb, 7 + q * 13 + (j % 5) * 2, YEAR_Y + floor(j / 5) * 2, c, v);
  }
  // Once the year is reached, the same year as it is usually written.
  if (S.phase >= 2) {
    const R = S.set.roman, v = min(1, S.phase === 2 ? S.t / FLASH : 1) * fade * 0.8;
    let x = floor((W - R.reduce((s, g) => s + g.w + 1, -1)) / 2);
    for (const g of R) {
      glyph(rgb, g, x, ROMAN_Y, ink, v);
      x += g.w + 1;
    }
  }
  for (let p = 0, i = 0; p < W * H; p++, i += 3) display.setPixel(p % W, (p / W) | 0, round(rgb[i] * 255), round(rgb[i + 1] * 255), round(rgb[i + 2] * 255));
}
