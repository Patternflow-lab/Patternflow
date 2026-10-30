// ===== Patternflow pattern =====
// Title:   Cistercian Numerals
// Family:  type
// Idea:    One Cistercian cipher stands the full height of the panel, a single stave 122 rows long carrying the units in its top right corner, the tens top left, the hundreds bottom right and the thousands bottom left, and it counts, each corner swinging shut against the stave like a door and opening again on its next figure, so when it counts by one the units corner flaps four times a second, the tens every 2.5 s and the hundreds hardly ever, while a small readout in Arabic figures beside the middle of the stave says the same number.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ciphers of the Cistercian monks, from the 13th century, in the forms David A. King tabulates in The Ciphers of the Monks (2001); the Fibonacci numbers mod 10000 (Pisano period 15000); 5 by 7 figures from Photon Disk (pattern round 70), copied from autogram.js; pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Count=0..3, Weight=0..1
//
// Knob 1: Hue. Turns the four corner colours round the wheel together. At 0 the units are gold, the tens lime, the hundreds aquamarine and the thousands blue, 0.17 of a turn apart; the stave is the units colour washed nearly white.
// Knob 2: Speed. How often the number changes. Counting by one it steps 4 times a second at 2, 0.4 at 0.2 and 6 at 3; the other counts step 1.2 times a second at 2 (0.12 at 0.2, 1.8 at 3) because all four corners turn at once. A corner takes 0.3 s to swing shut and open, never more than 85% of a step.
// Knob 3: Count. What is counted: 0 counts by one from a random number whose four figures are all 1 to 9, 1 the Fibonacci numbers mod 10000, 2 the 1229 primes below 10000 and 3 the squares 1 to 9801. Each wraps round at its end; a new count starts at a random place in it.
// Knob 4: Weight. The stroke: 3.3 LEDs wide at 0, 6 at 0.5 and 8.6 at 1, each with a glow about 2 LEDs deep, so at 1 the narrow angle of a 3, 4 or 5 fills in where it meets the stave.

// Each corner is a box QW LEDs wide and QH tall against one end of the stave.
// In the box of the units, u runs from the stave out to the right (0..1) and
// v from the top end of the stave down (0..1). The nine figures in the
// convention the modern tables take from King (2001):
//   1 a bar along the top            (0,0)-(1,0)
//   2 a bar along the bottom         (0,1)-(1,1)
//   3 a diagonal down, away          (0,0)-(1,1)
//   4 a diagonal up, away            (0,1)-(1,0)
//   5 = 1 + 4, a closed triangle
//   6 the outer upright              (1,0)-(1,1)
//   7 = 1 + 6, 8 = 2 + 6, 9 = 1 + 2 + 6, a closed square against the stave.
// The manuscripts do not all draw them alike; this pattern keeps the
// convention above throughout. The tens are the units mirrored left to
// right, the hundreds the units mirrored top to bottom (their 1 runs along
// the foot of the stave), the thousands both. A blank corner is a 0; the
// bare stave is 0.

const W = 64, H = 128, SX = 32, Y0 = 3, Y1 = 125, QW = 26, QH = 40;
const { floor, round, min, max, abs, sqrt, cos, sin, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const HUE0 = 0.12, HSTEP = 0.17, FLIP = 0.3;

const B1 = [0, 0, 1, 0], B2 = [0, 1, 1, 1], D3 = [0, 0, 1, 1], D4 = [0, 1, 1, 0], U6 = [1, 0, 1, 1];
const FIGURE = [[], [B1], [B2], [D3], [D4], [B1, D4], [U6], [B1, U6], [B2, U6], [B1, B2, U6]];
// Which way u and v run for units, tens, hundreds and thousands.
const SIDE = [1, -1, 1, -1], END = [0, 0, 1, 1];

// The figures 0 to 9 of Photon Disk's 5 x 7 face, rows from the top
// (copied from autogram.js).
const FIG = [
  ".###. #...# #..## #.#.# ##..# #...# .###.", "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.",
  ".###. #...# ....# ...#. ..#.. .#... #####", "##### ...#. ..#.. ...#. ....# #...# .###.",
  "...#. ..##. .#.#. #..#. ##### ...#. ...#.", "##### #.... ####. ....# ....# #...# .###.",
  "..##. .#... #.... ####. #...# #...# .###.", "##### ....# ...#. ..#.. .#... .#... .#...",
  ".###. #...# #...# .###. #...# #...# .###.", ".###. #...# #...# .#### ....# ...#. .##..",
].map((f) => f.replace(/ /g, ""));
// The readout's left edge for thousands, hundreds, tens and units, and its top row.
const RX = [15, 21, 38, 44], RY = 61;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The primes below 10000 by the sieve of Eratosthenes.
const PRIMES = [];
{
  const comp = new Uint8Array(10000);
  for (let n = 2; n < 10000; n++) {
    if (comp[n]) continue;
    PRIMES.push(n);
    for (let m = n * n; m < 10000; m += n) comp[m] = 1;
  }
}

// A new count of kind k at a random place in it.
function start(S, k) {
  S.kind = k;
  if (k === 0) {
    S.val = 0;
    for (let p = 0; p < 4; p++) S.val = S.val * 10 + 1 + floor(Math.random() * 9);
  } else if (k === 1) {
    (S.fa = 0), (S.fb = 1);
    for (let i = floor(Math.random() * 400) + 12; i > 0; i--) [S.fa, S.fb] = [S.fb, (S.fa + S.fb) % 10000];
    S.val = S.fb;
  } else if (k === 2) {
    S.pi = 30 + floor(Math.random() * (PRIMES.length - 60));
    S.val = PRIMES[S.pi];
  } else {
    S.sq = 10 + floor(Math.random() * 80);
    S.val = S.sq * S.sq;
  }
}
function step(S) {
  if (S.kind === 0) S.val = (S.val % 9999) + 1;
  else if (S.kind === 1) ([S.fa, S.fb] = [S.fb, (S.fa + S.fb) % 10000]), (S.val = S.fb);
  else if (S.kind === 2) (S.pi = (S.pi + 1) % PRIMES.length), (S.val = PRIMES[S.pi]);
  else (S.sq = (S.sq % 99) + 1), (S.val = S.sq * S.sq);
}
// Hand the number to the four corners; a corner whose figure changed swings.
function show(S, quiet) {
  for (let p = 0, v = S.val; p < 4; p++, v = floor(v / 10)) {
    const d = v % 10;
    if (d === S.dig[p]) continue;
    S.old[p] = quiet ? d : S.dig[p];
    S.dig[p] = d;
    S.t[p] = quiet ? 9 : 0;
  }
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, kind: -1, hw: 1.67, acc: 0, val: 0, fa: 0, fb: 1, pi: 0, sq: 1,
    dig: [0, 0, 0, 0], old: [0, 0, 0, 0], t: [9, 9, 9, 9],
    buf: new Float32Array(W * H * 3), col: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], pale: [0, 0, 0],
  };
  return params.s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.hw = 1.67 + 2.6 * cl(k[3] || 0, 0, 1);
  const kind = cl(round(k[2] || 0), 0, 3);
  if (kind !== S.kind) {
    const first = S.kind < 0;
    start(S, kind);
    show(S, first);
    S.acc = 0;
  }
  const rate = (S.kind === 0 ? 2 : 0.6) * S.speed;
  S.flip = min(FLIP, 0.85 / rate);
  S.acc += d * rate;
  for (let p = 0; p < 4; p++) S.t[p] += d;
  while (S.acc >= 1) {
    S.acc -= 1;
    step(S);
    show(S, false);
  }
}

// Paint a segment of half-width hw with a glow round it, keeping the
// brighter of what is there and what it brings, channel by channel.
function seg(S, x0, y0, x1, y1, c, a) {
  const hw = S.hw, R = hw + 6, b = S.buf;
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  const ax = max(0, floor(min(x0, x1) - R)), bx = min(W - 1, floor(max(x0, x1) + R));
  const ay = max(0, floor(min(y0, y1) - R)), by = min(H - 1, floor(max(y0, y1) + R));
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = l2 > 0 ? cl((px * dx + py * dy) / l2, 0, 1) : 0;
      const dd = sqrt((px - u * dx) ** 2 + (py - u * dy) ** 2) - hw;
      const v = a * (dd < -0.5 ? 1 : dd < 0.5 ? 0.5 - dd : 0) + a * 0.26 * exp(-max(0, dd) / 1.6);
      if (v <= 0.004) continue;
      const kk = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) b[kk + q] = max(b[kk + q], c[q] * min(1, v));
    }
}

// One corner: figure f of place p, its far side at fraction w of full width
// (1 open, 0 shut against the stave), lit at a.
function corner(S, p, f, w, c, a) {
  const sx = SIDE[p] * QW * w, top = END[p] === 0;
  for (const s of FIGURE[f]) {
    const x0 = SX + s[0] * sx, x1 = SX + s[2] * sx;
    const y0 = top ? Y0 + s[1] * QH : Y1 - s[1] * QH, y1 = top ? Y0 + s[3] * QH : Y1 - s[3] * QH;
    seg(S, x0, y0, x1, y1, c, a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const b = S.buf;
  for (let i = 0; i < W * H; i++) (b[i * 3] = 0.008), (b[i * 3 + 1] = 0.01), (b[i * 3 + 2] = 0.022);
  for (let p = 0; p < 4; p++) hsv(S.hue + HUE0 + p * HSTEP, 0.72, 1, S.col[p]);
  hsv(S.hue + HUE0, 0.16, 0.92, S.pale);
  // The stave first, so the corners' colours win where they meet it.
  seg(S, SX, Y0, SX, Y1, S.pale, 1);
  const hot = [0, 0, 0];
  for (let p = 0; p < 4; p++) {
    const ph = S.t[p] / S.flip, c = S.col[p];
    if (ph < 0.5) {
      // The old figure swings shut: its width goes as the cosine of the turn.
      const w = cos(PI * ph);
      corner(S, p, S.old[p], w, c, 0.35 + 0.65 * w);
    } else {
      // The new one swings open, white hot at first and cooling in about 0.25 s.
      const w = ph >= 1 ? 1 : sin(PI * (ph - 0.5)), heat = exp(-max(0, S.t[p] - 0.5 * S.flip) / 0.12);
      for (let q = 0; q < 3; q++) hot[q] = c[q] + (1 - c[q]) * 0.6 * heat;
      corner(S, p, S.dig[p], w, hot, 0.35 + 0.65 * w);
    }
  }
  // The readout: thousands, hundreds | tens, units, each in its corner's
  // colour, flashing as the corner turns.
  for (let i = 0; i < 4; i++) {
    const p = 3 - i, f = FIG[S.dig[p]], c = S.col[p], fl = exp(-S.t[p] / 0.25);
    for (let r = 0; r < 7; r++)
      for (let q = 0; q < 5; q++) {
        if (f[r * 5 + q] !== "#") continue;
        const kk = ((RY + r) * W + RX[i] + q) * 3;
        for (let z = 0; z < 3; z++) b[kk + z] = 0.25 + 0.75 * (c[z] + (1 - c[z]) * (0.35 + 0.65 * fl));
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const kk = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(b[kk], 0, 1) * 255), round(cl(b[kk + 1], 0, 1) * 255), round(cl(b[kk + 2], 0, 1) * 255));
    }
}
