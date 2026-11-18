// ===== Patternflow pattern =====
// Title:   Dot-Matrix NLQ
// Family:  type
// Idea:    A nine-pin print head runs along the bottom line of a page of capitals and fires its pins as it crosses each dot, every dot flashing white and cooling to ink behind it; in draft it makes one pass and the horizontal strokes stay a row of separate dots, in near letter quality it comes back over the same line half a dot to the side and the gaps fill in, and then the paper climbs one line while the head goes to the nearer end of the next.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: 9-pin dot-matrix printers' draft and near-letter-quality modes (Epson MX-80, 1980), their bidirectional logic seeking and sprocket-fed fan-fold paper; 5 by 7 capitals drawn for this pattern, not taken from a font file; pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Quality=0..1, Ink=-1..1
//
// Knob 1: Hue. Turns the ink, the glow of the head and the tint of the paper round the wheel together. At 0 the ink is sky blue, the freshly struck dots go from white to it, and the bands of the paper behind the text are a blue just above black. A hue that would leave the ink a dim orange goes to rose or green instead.
// Knob 2: Speed. How fast the head runs along the line, 55 LEDs a second to the knob: 110 at 2, so a line of five letters takes 0.56 s a pass, 11 at 0.2 where each pin firing can be followed and 165 at 3. The paper feed between lines goes with it, 0.65 s at 0.2, 0.3 s at 2 and 0.23 s at 3.
// Knob 3: Quality. How much of a second pass the printer makes over each line. At 0 it is draft, one pass, a dot every second LED, so a horizontal stroke is a row of dots with a dark LED between them. Above 0.03 the head turns at the end of the line and strikes every dot again on the way back, one LED to the right, half the dot pitch, with a force that grows with the knob: 44% at 0.25, 66% at 0.5 and full at 1, where every stroke is a solid two LEDs wide. A line keeps the quality it was printed at, and the page the pattern starts on is printed at the knob's setting.
// Knob 4: Ink. How much ink the ribbon gives each dot, from a worn ribbon at -1 through a good one at 0 to an over-inked one at 1. Turned down, each dot loses 20% to 80% of its brightness at -1, a different share for every dot, so the text goes pale and uneven. Turned up, each dot bleeds into the LEDs around it, 40% of its brightness sideways at 1, and the gaps of a draft line begin to close without a second pass. It acts on each dot as the head strikes it, so a line printed while you turn it changes along its length.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, ceil, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals, digits and a full stop, 5 dots wide and 7 tall, one
// string a letter and a bar between rows. Drawn for this pattern.
const FACE = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
  B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####",
  F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.####",
  H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
  J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
  L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
  N: "#...#|#...#|##..#|#.#.#|#..##|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
  R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.",
  T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
  W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
  X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
  Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  0: ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
  1: "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
  2: ".###.|#...#|....#|...#.|..#..|.#...|#####",
  3: "#####|...#.|..#..|...#.|....#|#...#|.###.",
  4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
  5: "#####|#....|####.|....#|....#|#...#|.###.",
  6: "..##.|.#...|#....|####.|#...#|#...#|.###.",
  7: "#####|....#|...#.|..#..|.#...|.#...|.#...",
  8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
  9: ".###.|#...#|#...#|.####|....#|...#.|.##..",
  ".": ".....|.....|.....|.....|.....|.##..|.##..",
};
const GL = {};
for (const ch of Object.keys(FACE)) GL[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// What the printer is sent, a line at a time and never more than five letters
// to a line: the two pangrams every printer was tested with, then its own
// self test, a run of characters that moves along by one on each line.
const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PAGE = [
  "THE", "QUICK", "BROWN", "FOX", "JUMPS", "OVER", "THE", "LAZY", "DOG.", "",
  "WALTZ", "NYMPH", "FOR", "QUICK", "JIGS", "VEX", "BUD", "", "SELF", "TEST",
];
for (let i = 0; i < 8; i++) {
  let s = "";
  for (let j = 0; j < 5; j++) s += CH[(21 + i + j) % CH.length];
  PAGE.push(s);
}
PAGE.push("");

const X0 = 3; // x of the first dot of the first letter
const ADV = 12; // LEDs from one letter to the next: six dot columns of two LEDs
const SLOT = 18; // LEDs of one line: nine pins, two LEDs of paper each
const NEVER = 1e9;
const HEADY = 1 + SLOT * 6; // top row of the line under the head, the bottom of seven
const VEL = 55; // LEDs a second of head travel to the Speed knob
const BAND = 54; // LEDs of one band of the paper and of the gap between two sprocket holes: three lines

// A dim orange or yellow reads as brown on the panel, so where the ink's hue
// would land in orange it goes to rose, and in yellow to green.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.2 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}

function rnd(a, b, c) {
  let x = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(c + 1, 83492791);
  x = Math.imul(x ^ (x >>> 15), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// One line of the page: the dots of its letters, and for each dot the time it
// was struck in the first pass and in the second, NEVER while it has not been,
// the share of full ink the ribbon gave it and how far that ink bled.
function makeLine(g, text, q) {
  const dx = [], dr = [];
  for (let ci = 0; ci < text.length; ci++) {
    const gl = GL[text[ci]];
    if (!gl) continue;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r * 5 + c]) (dx.push(X0 + ADV * ci + 2 * c), dr.push(r));
  }
  const K = dx.length, fl = () => new Float32Array(K);
  return { g, n: text.length, K, dx, dr, b1: fl().fill(NEVER), b2: fl().fill(NEVER), f1: fl(), f2: fl(), u1: fl(), u2: fl(), q, two: q > 0.03 };
}

// A pin fires: the dot is stamped with the time and with the ribbon as it is
// at that moment, so turning Ink changes a line along its length.
function strike(S, L, pass, k, t) {
  const b = pass === 1 ? L.b1 : L.b2, f = pass === 1 ? L.f1 : L.f2, u = pass === 1 ? L.u1 : L.u2;
  b[k] = t;
  f[k] = 1 - max(0, -S.ink) * (0.2 + 0.6 * rnd(L.g, k, pass));
  u[k] = max(0, S.ink);
}

export function setup(params) {
  params.s = {
    ready: false, t: 0, hue: 0, speed: 2, q: 0, ink: 0.06,
    lines: [], cur: 6, phase: 1, pass: 1, hx: 1, dir: 1, sx: 1, ex: 1, wait: 0, fe: 0, off: 0,
    buf: new Uint8Array(W * H * 3),
  };
}

// The page the printer was in the middle of when the pattern starts: six lines
// done at the knobs' setting, and the head about to print the seventh.
function prefill(S) {
  for (let g = 0; g < S.cur; g++) {
    const L = makeLine(g, PAGE[g % PAGE.length], S.q);
    for (let k = 0; k < L.K; k++) (strike(S, L, 1, k, -100), strike(S, L, 2, k, -100));
    S.lines.push(L);
  }
  begin(S);
}

// Sets the head going on the line it has come to: the nearer end of the line
// first, as a logic-seeking printer does, and out along it from there.
function begin(S) {
  const g = S.cur, text = PAGE[g % PAGE.length], L = makeLine(g, text, S.q);
  S.lines.push(L);
  while (S.lines[0].g < S.cur - 8) S.lines.shift();
  if (!L.n) return feed(S);
  const a = X0 - 2, b = X0 + ADV * (L.n - 1) + 12;
  if (abs(S.hx - a) <= abs(S.hx - b)) (S.sx = a, S.ex = b, S.dir = 1);
  else (S.sx = b, S.ex = a, S.dir = -1);
  S.pass = 1;
  S.phase = 0;
}

function feed(S) {
  S.cur++;
  S.off = SLOT;
  S.fe = 0;
  S.phase = 3;
}

function step(S, h) {
  S.t += h;
  const v = VEL * S.speed, L = S.lines[S.lines.length - 1];
  if (S.phase === 0) {
    const to = S.sx - S.hx, mv = 2.6 * v * h;
    if (abs(to) <= mv) {
      S.hx = S.sx;
      S.phase = 1;
    } else S.hx += to > 0 ? mv : -mv;
  } else if (S.phase === 1) {
    S.hx += S.dir * v * h;
    // A pin fires as the head crosses its column; the second pass strikes a
    // LED to the right of the first.
    const b = S.pass === 1 ? L.b1 : L.b2, o = S.pass - 1;
    for (let k = 0; k < L.K; k++) {
      if (b[k] < NEVER) continue;
      const x = L.dx[k] + o;
      if (S.dir > 0 ? S.hx >= x : S.hx <= x) strike(S, L, S.pass, k, S.t - abs(S.hx - x) / v);
    }
    if (S.dir > 0 ? S.hx >= S.ex : S.hx <= S.ex) {
      S.hx = S.ex;
      // Whether the head comes back is settled at the end of the first pass.
      if (S.pass === 1) {
        L.q = S.q;
        L.two = S.q > 0.03;
      }
      if (L.two && S.pass === 1) {
        S.pass = 2;
        S.dir = -S.dir;
        const t = S.sx;
        S.sx = S.ex;
        S.ex = t;
        S.wait = 0.05;
        S.phase = 2;
      } else feed(S);
    }
  } else if (S.phase === 2) {
    S.wait -= h;
    if (S.wait <= 0) S.phase = 1;
  } else {
    S.fe += h / (0.3 / (0.4 + 0.3 * S.speed));
    S.off = SLOT * (1 - sm(S.fe));
    if (S.fe >= 1) {
      S.off = 0;
      begin(S);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.q = cl(k[2], 0, 1);
  S.ink = cl(k[3], -1, 1);
  if (!S.ready) {
    S.ready = true;
    prefill(S);
  }
  const d = cl(dt || 0, 0, 0.1), n = max(1, ceil(d / 0.01));
  for (let i = 0; i < n; i++) step(S, d / n);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf, h = S.hue, off = round(S.off);
  const INK = [0, 0, 0], HOT = [1, 0.92, 0.78], PAP = [0, 0, 0], HEAD = [0, 0, 0], HOLE = [0, 0, 0];
  const hi = dim(h + 0.55);
  hsv(hi, 0.85, 0.9, INK);
  hsv(hi, 0.55, 0.065, PAP);
  hsv(hi, 0.25, 1, HEAD);
  hsv(hi, 0.2, 0.3, HOLE);
  buf.fill(0);
  const put = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = min(255, buf[o] + r * 255);
    buf[o + 1] = min(255, buf[o + 1] + g * 255);
    buf[o + 2] = min(255, buf[o + 2] + b * 255);
  };

  // The paper: green-bar bands of three lines and a sprocket hole down each
  // edge in the middle of every band, all of it carried up with the lines.
  for (let y = 0; y < H; y++) {
    const G = y - HEADY - off + SLOT * S.cur, band = floor(G / BAND), gm = G - band * BAND;
    if ((band & 1) === 0) for (let x = 0; x < W; x++) put(x, y, PAP[0], PAP[1], PAP[2]);
    if (gm >= 26 && gm < 28) {
      put(0, y, HOLE[0], HOLE[1], HOLE[2]);
      put(W - 1, y, HOLE[0], HOLE[1], HOLE[2]);
    }
  }

  for (const L of S.lines) {
    const yt = HEADY + SLOT * (L.g - S.cur) + off;
    if (yt > H - 1 || yt < -SLOT) continue;
    // The lines dim a little as they climb, so the one being printed is the
    // brightest.
    const ab = 1 - 0.42 * cl((HEADY + SLOT - yt) / (HEADY + SLOT), 0, 1), p2 = pow(L.q, 0.6);
    for (let pass = 1; pass <= (L.two ? 2 : 1); pass++) {
      const b = pass === 1 ? L.b1 : L.b2, f = pass === 1 ? L.f1 : L.f2, u = pass === 1 ? L.u1 : L.u2, gain = pass === 1 ? ab : ab * p2;
      for (let k = 0; k < L.K; k++) {
        if (b[k] >= NEVER) continue;
        const age = max(0, S.t - b[k]), x = L.dx[k] + pass - 1, y = yt + 2 + 2 * L.dr[k];
        // The strike is a white flash for a twentieth of a second, the dot is
        // warm for a second after it, and then it is ink.
        const sp = age < 0.4 ? exp(-age * 22) : 0, ht = age < 1.6 ? exp(-age * 3.5) : 0, a = f[k] * gain;
        const r = (INK[0] + HOT[0] * ht * 0.6) * a + sp * 0.8;
        const g = (INK[1] + HOT[1] * ht * 0.6) * a + sp * 0.8;
        const bl = (INK[2] + HOT[2] * ht * 0.6) * a + sp * 0.8;
        put(x, y, r, g, bl);
        put(x, y + 1, r, g, bl);
        // Over-inked, the dot spreads 40% of its brightness to the LEDs on
        // either side and a quarter above and below.
        if (u[k] > 0.02) {
          const c = a * u[k], sx = c * 0.4, sy = c * 0.25;
          for (let yy = y; yy <= y + 1; yy++) {
            put(x - 1, yy, INK[0] * sx, INK[1] * sx, INK[2] * sx);
            put(x + 1, yy, INK[0] * sx, INK[1] * sx, INK[2] * sx);
          }
          put(x, y - 1, INK[0] * sy, INK[1] * sy, INK[2] * sy);
          put(x, y + 2, INK[0] * sy, INK[1] * sy, INK[2] * sy);
        }
        if (sp > 0.05) {
          const e = sp * 0.22;
          put(x - 1, y, e, e, e);
          put(x - 1, y + 1, e, e, e);
          put(x + 1, y, e, e, e);
          put(x + 1, y + 1, e, e, e);
        }
      }
    }
  }

  // The head: the nine pins of the line it stands on, with a dim shoulder on
  // either side.
  const hx = round(S.hx);
  for (let y = HEADY; y < HEADY + SLOT; y++) {
    put(hx, y, HEAD[0] * 0.45, HEAD[1] * 0.45, HEAD[2] * 0.45);
    put(hx - 1, y, HEAD[0] * 0.14, HEAD[1] * 0.14, HEAD[2] * 0.14);
    put(hx + 1, y, HEAD[0] * 0.14, HEAD[1] * 0.14, HEAD[2] * 0.14);
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
