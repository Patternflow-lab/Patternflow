// ===== Patternflow pattern =====
// Title:   Scytale
// Family:  type
// Idea:    A leather strip hangs beside a bare rod as three columns of scrambled capitals, then winds onto the rod letter by letter as a helix of 16 turns down the 128 rows; the rod steps to the middle and turns a face at a time, and each of its three faces reads one line of the message down the panel, letter under letter, COME BACK WITH, YOUR SHIELD, OR ON IT, until the rod steps aside and the strip comes off again, while a rod with any other number of faces lines the same strip up into nonsense.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Spartan scytale, a transposition cipher written on a strip wound round a rod (Plutarch, Life of Lysander, about AD 100); messages from Plutarch's Sayings of Spartan Women and the Delphic maxims; the 5 by 7 capitals of Word Search (pattern round 82), pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Faces=3..8, Message=0..2
//
// Knob 1: Hue. Turns the ink and the leather round the wheel together: at 0 pale aqua letters on brown leather, at 0.25 pale violet on dark green, at 0.5 pale rose on dark blue, at 0.75 pale lime on plum; the bare rod is a greyer shade of the leather.
// Knob 2: Speed. At 2 the strip goes on at 0.11 s a letter, each letter flying 0.45 s, 5.6 s for all 48 cells; the rod takes 0.8 s to step to the middle, each face is read for 1.8 s and the rod turns to the next in 0.6 s; it steps aside, the strip comes off as fast as it went on, and the ribbon hangs 2.4 s, 22.4 s round. At 0.2 everything takes ten times as long, at 3 two thirds.
// Knob 3: Faces. How many faces the rod has, so how many letters one turn of the strip holds. At 3, the rod the message was written on, each face reads a line. At 4 to 8 the rod is thicker and the same strip takes 12 turns down to 6, leaving the foot of the rod bare; at 4, 5, 7 and 8 every face mixes letters of all three lines, and at 6 each face holds every other letter of one line.
// Knob 4: Message. 0 the Spartan farewell COME BACK WITH YOUR SHIELD OR ON IT, 1 the Delphic KNOW THYSELF NOTHING IN EXCESS, 2 THE ROD IS THE KEY TO THIS LETTER. Turning it rewrites the strip at once.

// A scytale message is written along the rod, one letter on each turn of
// the strip. With N letters to a turn, strip letter i sits on face i mod N,
// turn floor(i / N), so line f of the message runs down face f, and the
// strip read from end to end takes a letter from each line in turn.
// Wound on a rod of M faces the same strip puts letter i on face i mod M,
// and each face reads every M-th letter of the strip. Only M = N reads.
//
// Here N = 3 and a turn is 8 rows, the letter pitch down a face, so the 16
// turns fill the 128 rows. Each line is centred on its face with blank
// turns above and below it, and a word space is a small dot. The strip
// runs 8/M rows lower across each face, so a face's letters stand 8/M rows
// lower than the face before it, and the seams between turns run
// slantwise across the rod. The ribbon hangs the strip in its own order,
// 16 cells to a column, so a column reads C, O Y, M O, E U O down the
// strip where the rod reads COME down a face.
//
// The rod is a prism of M flat faces, each 11 LEDs wide, seen from far
// off, so a face spans R sin(angle) across the screen for the angles of its
// two edges, R = 11 / (2 sin(pi / M)), and its texture is spread evenly
// over that span. Faces turned away are not drawn, and each face is lit by
// a lamp a little to the left of the viewer.

const W = 64, H = 128;
const { floor, round, min, max, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The key, the letter pitch down the rod, the face width, glyph margin.
const KEY = 3, PITCH = 8, FACE = 11, GX0 = 3, TURNS = 16, L = KEY * TURNS;
// Rod centre while it is read and while it is unwound; ribbon columns.
const READ_X = 32, SIDE_X = 15, RIB_X = 33, RIB_STEP = 11;
// Seconds at Speed 2.
const DWELL = 1.8, TURN = 0.6, SLIDE = 0.8, PEEL = 0.11, FLY = 0.45, HANG = 2.4;
const WIND = PEEL * (L - 1) + FLY;

const MESSAGES = [
  ["COME BACK WITH", "YOUR SHIELD", "OR ON IT"],
  ["KNOW THYSELF", "NOTHING IN", "EXCESS"],
  ["THE ROD IS", "THE KEY TO", "THIS LETTER"],
];

// Capitals 5 wide and 7 tall, top row first, from Word Search.
const FONT = (
  ".###. #...# #...# ##### #...# #...# #...#|####. #...# #...# ####. #...# #...# ####.|.###. #...# #.... #.... #.... #...# .###.|" +
  "####. #...# #...# #...# #...# #...# ####.|##### #.... #.... ####. #.... #.... #####|##### #.... #.... ####. #.... #.... #....|" +
  ".###. #...# #.... #.### #...# #...# .####|#...# #...# #...# ##### #...# #...# #...#|.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.|" +
  "..### ...#. ...#. ...#. ...#. #..#. .##..|#...# #..#. #.#.. ##... #.#.. #..#. #...#|#.... #.... #.... #.... #.... #.... #####|" +
  "#...# ##.## #.#.# #.#.# #...# #...# #...#|#...# #...# ##..# #.#.# #..## #...# #...#|.###. #...# #...# #...# #...# #...# .###.|" +
  "####. #...# #...# ####. #.... #.... #....|.###. #...# #...# #...# #.#.# #..#. .##.#|####. #...# #...# ####. #.#.. #..#. #...#|" +
  ".#### #.... #.... .###. ....# ....# ####.|##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..|#...# #...# #...# #...# #...# #...# .###.|" +
  "#...# #...# #...# #...# #...# .#.#. ..#..|#...# #...# #...# #.#.# #.#.# #.#.# .#.#.|#...# #...# .#.#. ..#.. .#.#. #...# #...#|" +
  "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..|##### ....# ...#. ..#.. .#... #.... #####"
)
  .split("|")
  .map((g) => g.split(" ").map((row) => [...row].map((c) => c === "#")));
// Code 26 is the word dot, 27 a blank turn.
const DOT = 26, BLANK = 27;
const ink = (code, gx, gy) => (code < 26 ? FONT[code][gy][gx] : code === DOT ? gx === 2 && gy === 3 : false);

// The strip: line f on face f, centred in the 16 turns.
function strip(m) {
  const s = new Uint8Array(L).fill(BLANK);
  MESSAGES[m].forEach((line, f) => {
    const top = floor((TURNS - line.length) / 2);
    for (let k = 0; k < line.length; k++) s[(top + k) * KEY + f] = line[k] === " " ? DOT : line.charCodeAt(k) - 65;
  });
  return s;
}
const STRIPS = MESSAGES.map((_, m) => strip(m));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function setup(params) {
  params.s = { phase: 0, pt: HANG - OPEN, phi: 0, phi0: 0, rx: SIDE_X, faces: KEY, msg: 0, hue: 0, buf: new Float32Array(W * H * 3) };
}

// Phases, in the order they come: the ribbon hangs, the strip winds on,
// the rod comes to the middle, is read face by face, steps aside again,
// and the strip comes off it. The panel opens 1.2 s before the winding.
const HANGS = 0, WINDS = 1, IN = 2, READS = 3, OUT = 4, UNWINDS = 5, OPEN = 1.2;
function phaseLength(S, p) {
  return [HANG, WIND, SLIDE, S.faces * (DWELL + TURN), SLIDE, WIND][p];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, KEY, 0];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const faces = cl(round(k[2] == null ? KEY : k[2]), 3, 8);
  // A new rod picked up while it is being read starts on its first face.
  if (faces !== S.faces && S.phase === READS) S.pt = 0;
  S.faces = faces;
  S.msg = cl(round(k[3] || 0), 0, MESSAGES.length - 1);
  const step = (d * speed) / 2;
  S.pt += step;
  while (S.pt >= phaseLength(S, S.phase)) {
    S.pt -= phaseLength(S, S.phase);
    S.phase = (S.phase + 1) % 6;
    S.phi0 = S.phi;
  }
  const M = S.faces, pt = S.pt, p = S.phase;
  S.rx = p === READS ? READ_X : p === IN ? SIDE_X + (READ_X - SIDE_X) * ease(pt / SLIDE) : p === OUT ? READ_X + (SIDE_X - READ_X) * ease(pt / SLIDE) : SIDE_X;
  if (p === READS) {
    // A face at a time, the next face coming round from the right.
    const n = floor(pt / (DWELL + TURN)), r = pt - n * (DWELL + TURN);
    S.phi = -(TAU / M) * (n + ease((r - DWELL) / TURN));
  } else if (p === IN) {
    // On its way to the middle the rod settles on its first face.
    S.phi = S.phi0 + (-TAU * Math.ceil(-S.phi0 / TAU - 1e-6) - S.phi0) * ease(pt / SLIDE);
  } else if (p === WINDS || p === UNWINDS) {
    // The rod turns once every 2.4 s while the strip goes on or comes off.
    S.phi = S.phi0 - (TAU / 2.4) * pt;
  }
}

// Where a letter's cell is, at its face's centre, on the rod as it stands.
function cellOnRod(S, i) {
  const M = S.faces, f = i % M, r = floor(i / M);
  const R = FACE / (2 * sin(PI / M)), th = S.phi + (TAU * f) / M;
  const x = S.rx + R * cos(PI / M) * sin(th);
  const y = r * PITCH + round(((f + 0.5) * PITCH) / M) + 1;
  return [x - 3.5, y - 1];
}

// How far letter i is from the rod to its ribbon slot, 0 on the rod, 1 hung.
// The strip goes on from its first letter and comes off from its last.
function away(S, i) {
  if (S.phase === WINDS) return 1 - ease((S.pt - PEEL * i) / FLY);
  if (S.phase === UNWINDS) return ease((S.pt - PEEL * (L - 1 - i)) / FLY);
  return S.phase === HANGS ? 1 : 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  buf.fill(0);
  const set = (x, y, c, k) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = c[0] * k;
    buf[o + 1] = c[1] * k;
    buf[o + 2] = c[2] * k;
  };
  const M = S.faces, text = STRIPS[S.msg];
  const inkC = hsv(S.hue + 0.47, 0.5, 255);
  const leather = hsv(0.07 + S.hue, 0.72, 110);
  const wood = hsv(0.09 + S.hue, 0.45, 95);
  const R = FACE / (2 * sin(PI / M));
  const gone = new Uint8Array(L);
  for (let i = 0; i < L; i++) gone[i] = away(S, i) > 0 ? 1 : 0;

  // The rod, face by face.
  for (let f = 0; f < M; f++) {
    const th = S.phi + (TAU * f) / M, c = cos(th);
    if (c <= 0.01) continue;
    const xa = S.rx + R * sin(th - PI / M), xb = S.rx + R * sin(th + PI / M);
    // Lamp 20 degrees to the left of the viewer.
    const lamp = 0.3 + 0.7 * max(0, cos(th + 0.35));
    for (let x = max(0, floor(xa)); x <= min(W - 1, floor(xb)); x++) {
      const xc = x + 0.5;
      if (xc < xa || xc >= xb) continue;
      const u = ((xc - xa) / (xb - xa)) * FACE, ui = floor(u);
      const off = ((f + u / FACE) * PITCH) / M;
      const gyTop = round(((f + 0.5) * PITCH) / M) + 1;
      for (let y = 0; y < H; y++) {
        const yy = y - off, r = floor(yy / PITCH), i = r * M + f;
        if (r < 0 || i >= L || gone[i]) {
          set(x, y, wood, lamp);
          continue;
        }
        if (yy - r * PITCH < 1) {
          set(x, y, leather, lamp * 0.35);
          continue;
        }
        const gx = ui - GX0, gy = y - r * PITCH - gyTop;
        const on = gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && ink(text[i], gx, gy);
        set(x, y, on ? inkC : leather, lamp);
      }
    }
  }

  // Letters off the rod: hung in the ribbon or on their way.
  const tile = (x0, y0, code, k) => {
    for (let ty = 0; ty < PITCH; ty++)
      for (let tx = 0; tx < 7; tx++) {
        const gx = tx - 1, gy = ty - 1;
        const on = gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && ink(code, gx, gy);
        set(x0 + tx, y0 + ty, on ? inkC : leather, on ? 1 : k);
      }
  };
  for (let i = 0; i < L; i++) {
    const a = away(S, i);
    if (a <= 0) continue;
    const sx = RIB_X + floor(i / TURNS) * RIB_STEP, sy = (i % TURNS) * PITCH;
    if (a >= 1) {
      tile(sx, sy, text[i], 0.8);
      continue;
    }
    // Off the rod sideways first, then along the ribbon to the slot.
    const [rx, ry] = cellOnRod(S, i);
    tile(round(rx + (sx - rx) * a), round(ry + (sy - ry) * a * a), text[i], 0.9);
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(buf[o]), round(buf[o + 1]), round(buf[o + 2]));
}
