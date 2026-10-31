// ===== Patternflow pattern =====
// Title:   Plucked Letters
// Family:  type
// Idea:    A four-letter word of straight strokes stands two over two down the tall panel, every stroke a string pinned between bright points where strokes meet or end, and the strings are plucked letter by letter, each letter rolled as a chord from its longest stroke to its shortest, so that each string flashes, splits its triangle into two kinks that run to the pins, come back upside down and ring away, the long strokes swinging slowly and the short ones buzzing.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: d'Alembert's travelling-wave solution of the vibrating string (Jean le Rond d'Alembert, 1747), capitals drawn for this pattern as straight strokes, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..7, Pluck=0..1
//
// Knob 1: Hue. Turns the strings' colours round the wheel. At 0 the longest strings are violet and the shortest cyan, with azure between; at 0.5 the longest are a yellow green and the shortest a warm red. The pins, the kinks and the flash of a fresh pluck stay near white.
// Knob 2: Speed. The clock of everything. At 2 a wave runs 75 LEDs a second, so a 52-LED stroke swings once in 1.4 s and the 8-LED half of a serif in 0.2 s, a string's swing falls to 37% in 1.5 s, a letter's notes are 0.12 s apart and the next letter comes 0.5 s after the last note: HYMN's 15 strings come round every 3.9 s, the last 1.1 s of it a rest. Every time goes as 2 / Speed.
// Knob 3: Word. 0 HYMN, 1 WAVE, 2 KITE, 3 LYNX, 4 ZEAL, 5 FLAX, 6 TWIN, 7 AXLE, all letters of straight strokes only. Turning it sets the new word at rest and starts it from its first letter.
// Knob 4: Pluck. Where along each string it is pulled: at 0 the middle, at the opening 0.06 at 0.47 of its length, and at 1 at 0.06 of it, close to a pin. From the middle the two kinks part and the string's flat top widens as it sinks, until the string lies straight and the triangle comes back upside down; from near a pin the kinks come in close pairs, each pair a steep step, and the two steps run opposite ways along the string, pass through each other and turn over at the pins.

// A string pinned at x = 0 and x = l, pulled aside into a triangle with
// its peak at p l and let go, moves by d'Alembert's solution of the wave
// equation: y(x, t) = (F(x - c t) + F(x + c t)) / 2, where F is the
// triangle extended to the whole line as an odd function of period 2 l.
// Half the triangle runs left and half runs right; each half reaches a
// pin, where the odd extension sends back the same shape upside down. So
// the string is never a sine. It is straight lines between at most four
// kinks, at x = +-c t +- p l reduced into the string, and that is how it is
// drawn: the kinks are worked out exactly each frame, the string is the
// polyline through them, and each kink is a bright bead. The wave speed
// c is the same on every string, so the period 2 l / c goes as the length
// and the frequency as 1 / l. The swing dies away by one exponential for
// every string, which scales the shape and leaves its corners sharp.
//
// The capitals are drawn on a grid four units wide and eight tall, with
// straight strokes only. A stroke is cut wherever another stroke's end
// lands on it or crosses it, so the crossbar of H makes four strings of
// its two stems, and every cut and every end is a pin.

const W = 64, H = 128;
const { floor, min, max, round, sqrt, exp, log, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const LETTERS = {
  A: "0 8 2 0|2 0 4 8|0.75 5 3.25 5",
  E: "4 0 0 0|0 0 0 8|0 8 4 8|0 4 3.4 4",
  F: "4 0 0 0|0 0 0 8|0 4 3.4 4",
  H: "0 0 0 8|4 0 4 8|0 4 4 4",
  I: "2 0 2 8|0.6 0 3.4 0|0.6 8 3.4 8",
  K: "0 0 0 8|4 0 0 5|1.6 3 4 8",
  L: "0 0 0 8|0 8 4 8",
  M: "0 8 0 0|0 0 2 5|2 5 4 0|4 0 4 8",
  N: "0 8 0 0|0 0 4 8|4 8 4 0",
  T: "0 0 4 0|2 0 2 8",
  V: "0 0 2 8|2 8 4 0",
  W: "0 0 1 8|1 8 2 3|2 3 3 8|3 8 4 0",
  X: "0 0 4 8|4 0 0 8",
  Y: "0 0 2 4|4 0 2 4|2 4 2 8",
  Z: "0 0 4 0|4 0 0 8|0 8 4 8",
};
const WORDS = ["HYMN", "WAVE", "KITE", "LYNX", "ZEAL", "FLAX", "TWIN", "AXLE"];

// A letter's box: 22 by 52 LEDs, two over two.
const UX = 5.5, UY = 6.5;
const CELLS = [[5, 6], [37, 6], [5, 70], [37, 70]];

// At Speed 2, in seconds: the wave speed in LEDs a second, the ring-down,
// the flash, the notes of a letter, the gap to the next letter, the rest.
const WAVE = 75, RING = 1.5, FLASH = 0.16, NOTE = 0.12, NEXT = 0.5, REST = 1.1;
const PIN = [1, 0.97, 0.9];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Strings and pins of a word.
function build(S, word) {
  const strings = [], pins = [], seen = {};
  const pin = (x, y) => {
    const k = round(x * 8) + "," + round(y * 8);
    if (!seen[k]) {
      seen[k] = 1;
      pins.push([x, y]);
    }
  };
  for (let li = 0; li < word.length && li < 4; li++) {
    const strokes = LETTERS[word[li]].split("|").map((s) => s.split(" ").map(Number));
    const [cx, cy] = CELLS[li], mine = [];
    for (const a of strokes) {
      // Where the other strokes meet this one, as fractions along it.
      const cuts = [0, 1];
      const dx = a[2] - a[0], dy = a[3] - a[1];
      for (const b of strokes) {
        if (b === a) continue;
        const ex = b[2] - b[0], ey = b[3] - b[1], den = dx * ey - dy * ex;
        if (abs(den) < 1e-9) continue;
        const fx = b[0] - a[0], fy = b[1] - a[1];
        const ta = (fx * ey - fy * ex) / den, tb = (fx * dy - fy * dx) / den;
        if (ta > 1e-6 && ta < 1 - 1e-6 && tb > -1e-6 && tb < 1 + 1e-6) cuts.push(ta);
      }
      cuts.sort((p, q) => p - q);
      for (let i = 1; i < cuts.length; i++) {
        if (cuts[i] - cuts[i - 1] < 1e-6) continue;
        const ax = cx + (a[0] + dx * cuts[i - 1]) * UX, ay = cy + (a[1] + dy * cuts[i - 1]) * UY;
        const bx = cx + (a[0] + dx * cuts[i]) * UX, by = cy + (a[1] + dy * cuts[i]) * UY;
        const l = sqrt((bx - ax) ** 2 + (by - ay) ** 2);
        mine.push({ ax, ay, bx, by, l, ex: (bx - ax) / l, ey: (by - ay) / l, t: 1e9, sign: mine.length & 1 ? 1 : -1, rank: 0, li });
        pin(ax, ay);
        pin(bx, by);
      }
    }
    // A letter is a chord rolled from its lowest note, the longest string.
    mine.sort((p, q) => q.l - p.l);
    for (const s of mine) strings.push(s);
  }
  let lmin = 1e9, lmax = 0;
  for (const s of strings) {
    lmin = min(lmin, s.l);
    lmax = max(lmax, s.l);
  }
  for (const s of strings) s.rank = (log(s.l) - log(lmin)) / (log(lmax / lmin) || 1);
  // The score: when each string is plucked, in seconds at Speed 2.
  const score = [];
  let at = 0, li = -1;
  for (let i = 0; i < strings.length; i++) {
    if (i) at += strings[i].li !== li ? NEXT : NOTE;
    li = strings[i].li;
    score.push(at);
  }
  S.strings = strings;
  S.pins = pins;
  S.score = score;
  S.cycle = at + REST;
  S.clk = 0;
  S.next = 0;
}

export function setup(params) {
  params.s = { buf: new Float32Array(W * H * 3), hue: 0, word: -1, p: 0.47, clk: 0, next: 0, strings: [], pins: [], score: [], cycle: 1, c: [0, 0, 0], g: [0, 0, 0], w: [0, 0, 0], xs: new Float32Array(8), ys: new Float32Array(8) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const wi = round(cl(k[2] || 0, 0, WORDS.length - 1));
  S.p = 0.5 - 0.44 * cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (wi !== S.word) {
    S.word = wi;
    build(S, WORDS[wi]);
  }
  const step = (d * speed) / 2;
  for (const s of S.strings) s.t += step;
  // Pluck every string whose time came in this step.
  let left = step;
  while (left > 0) {
    const due = S.score[S.next] - S.clk;
    if (due > left) {
      S.clk += left;
      break;
    }
    S.clk += due;
    left -= due;
    const s = S.strings[S.next];
    s.t = left;
    s.sign = -s.sign;
    S.next++;
    if (S.next >= S.score.length) {
      // The rest after the word, then from the top.
      S.next = 0;
      S.clk -= S.cycle;
    }
  }
}

function seg(S, x0, y0, x1, y1, w, c) {
  const buf = S.buf, len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), n = max(1, Math.ceil(len / 6));
  for (let i = 0; i < n; i++) {
    const ax = x0 + ((x1 - x0) * i) / n, ay = y0 + ((y1 - y0) * i) / n, bx = x0 + ((x1 - x0) * (i + 1)) / n, by = y0 + ((y1 - y0) * (i + 1)) / n;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, e = w / 2 + 0.5;
    for (let y = max(0, floor(min(ay, by) - e)); y <= min(H - 1, floor(max(ay, by) + e)); y++)
      for (let x = max(0, floor(min(ax, bx) - e)); x <= min(W - 1, floor(max(ax, bx) + e)); x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay, t = cl((px * dx + py * dy) / L2, 0, 1);
        const ex = px - t * dx, ey = py - t * dy, a = cl(e - sqrt(ex * ex + ey * ey), 0, 1);
        if (a <= 0) continue;
        const p = (y * W + x) * 3;
        if (c[0] * a > buf[p]) buf[p] = c[0] * a;
        if (c[1] * a > buf[p + 1]) buf[p + 1] = c[1] * a;
        if (c[2] * a > buf[p + 2]) buf[p + 2] = c[2] * a;
      }
  }
}

function bead(S, x0, y0, r, c) {
  const buf = S.buf;
  for (let y = max(0, floor(y0 - r - 1)); y <= min(H - 1, floor(y0 + r + 1)); y++)
    for (let x = max(0, floor(x0 - r - 1)); x <= min(W - 1, floor(x0 + r + 1)); x++) {
      const ex = x + 0.5 - x0, ey = y + 0.5 - y0, a = cl(r + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (a <= 0) continue;
      const p = (y * W + x) * 3;
      buf[p] += (c[0] - buf[p]) * a;
      buf[p + 1] += (c[1] - buf[p + 1]) * a;
      buf[p + 2] += (c[2] - buf[p + 2]) * a;
    }
}

// The odd, 2l-periodic extension of the plucked triangle, peak 1 at x = q.
function tri(x, l, q) {
  x -= floor(x / (2 * l)) * 2 * l;
  if (x > l) return -tri(2 * l - x, l, q);
  return x < q ? x / q : (l - x) / (l - q);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  S.buf.fill(0);
  const c = S.c, xs = S.xs, ys = S.ys, ghost = S.g, white = S.w;
  for (const s of S.strings) {
    const env = exp(-s.t / RING), fl = exp(-s.t / FLASH);
    hsv(S.hue + 0.5 + 0.24 * s.rank, 0.78 - 0.6 * fl, min(1, 0.56 + 0.3 * env + 0.4 * fl), c);
    const l = s.l, q = S.p * l, amp = s.sign * min(0.13 * l, 6) * env;
    const nx = -s.ey, ny = s.ex;
    if (abs(amp) < 0.04) {
      seg(S, s.ax, s.ay, s.bx, s.by, 2.2, c);
      continue;
    }
    // The rest line, faint under the moving string.
    hsv(S.hue + 0.5 + 0.24 * s.rank, 0.7, 0.16, ghost);
    seg(S, s.ax, s.ay, s.bx, s.by, 1.6, ghost);
    // The kinks inside the string: +-ct +- pl, reduced mod 2l.
    const ct = (s.t * WAVE) % (2 * l);
    let n = 0;
    xs[n++] = 0;
    for (const k of [ct + q, ct - q, -ct + q, -ct - q]) {
      const x = k - floor(k / (2 * l)) * 2 * l;
      if (x > 1e-3 && x < l - 1e-3) xs[n++] = x;
    }
    xs[n++] = l;
    // Sort the few vertices in place.
    for (let i = 1; i < n; i++)
      for (let j = i; j > 0 && xs[j] < xs[j - 1]; j--) {
        const t = xs[j];
        xs[j] = xs[j - 1];
        xs[j - 1] = t;
      }
    for (let i = 0; i < n; i++) ys[i] = (amp * (tri(xs[i] - ct, l, q) + tri(xs[i] + ct, l, q))) / 2;
    for (let i = 1; i < n; i++)
      seg(S, s.ax + s.ex * xs[i - 1] + nx * ys[i - 1], s.ay + s.ey * xs[i - 1] + ny * ys[i - 1], s.ax + s.ex * xs[i] + nx * ys[i], s.ay + s.ey * xs[i] + ny * ys[i], 2.2, c);
    // The kinks as beads, while the swing is still worth watching.
    white[0] = white[1] = min(1, 1.6 * env);
    white[2] = white[0] * 0.92 + 0.08;
    if (env > 0.2) for (let i = 1; i < n - 1; i++) bead(S, s.ax + s.ex * xs[i] + nx * ys[i], s.ay + s.ey * xs[i] + ny * ys[i], 1 + 1.3 * fl, white);
  }
  for (const p of S.pins) bead(S, p[0], p[1], 0.9, PIN);
  const buf = S.buf;
  for (let i = 0; i < W * H; i++)
    display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
