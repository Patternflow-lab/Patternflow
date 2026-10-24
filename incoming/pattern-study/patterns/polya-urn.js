// ===== Patternflow pattern =====
// Title:   Pólya Urn
// Family:  data
// Idea:    Sixty-four Pólya urns run side by side, one per column, each drawing a ball, putting it back and adding another of the same colour, with the draws running down the panel on a logarithmic clock from none at the top to 2000 at the bottom, so every column swings wildly in the top rows and then freezes into its own mix of the two colours, a barcode whose limits are spread evenly from one colour to the other, and when the run is done the columns sort themselves by where they froze and show that spread as a straight ramp.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pólya's urn (Florian Eggenberger and George Pólya, 1923), pattern round 38
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Balls=1..8, Added=1..8
//
// Knob 1: Hue. Turns the two colours round the wheel together, a third of the wheel apart. At 0 teal and violet, mixing to lavender blue; at 0.25 violet and orange, mixing to rose; at 0.5 red and lime, mixing to butter yellow; at 0.75 lime and sky blue, mixing to sea green. Every mix is lifted halfway back to full brightness, and one that lands on orange or yellow is lifted and paled further, so nothing goes brown or olive.
// Knob 2: Speed. How fast the run comes down the panel: at 2 one run fills the 128 rows in 8 seconds, at 0.2 in 80, at 3 in 5.3. The clock is the same at every speed, row r holding draw 2001^(r/127) - 1, so the first draw lands on row 12, the tenth on row 40, the hundredth on row 77, and the last rows go by 116 draws at a time. A finished run holds 1.2 seconds, sorts in about 2.5 and shows its ramp for 3.2 before the next run comes down over it.
// Knob 3: Balls. The balls of each colour in every urn at the start, 1 to 8, one ball added per draw at Added 1. At 1 the limits are uniform: the bottom row holds every mix from one colour to the other in equal measure and the sorted ramp runs evenly from violet to teal. At 3 they are Beta(3, 3), 0.5 +- 0.19; at 8 Beta(8, 8), 0.5 +- 0.12: every column settles near the even mix, the barcode goes to one soft lavender and the ramp is flat with short ends.
// Knob 4: Added. Balls of the drawn colour added after each draw, 1 to 8. The limit is Beta(Balls/Added, Balls/Added), so at Balls 1 and Added 8 it is Beta(1/8, 1/8): most urns lock onto one colour within the first ten draws and the barcode goes nearly two-tone, the sorted ramp a step. Balls and Added equal is the same urn as one and one.

const W = 64, H = 128;
// The clock: row r is draw n(r) = N0 ((1 + NMAX / N0)^(r / 127) - 1), 0 at
// the top and NMAX at the bottom: the first draw lands on row 12, the tenth
// on row 40, the hundredth on row 77.
const NMAX = 2000, N0 = 1;
// One run fills the panel in FILL / Speed seconds; the finished run waits
// HOLD1 seconds, sorts at SORTS transposition rounds a second, then shows the
// ramp for HOLD2 seconds before the next run comes down over it.
const FILL = 16, HOLD1 = 1.2, SORTS = 26, HOLD2 = 3.2;
const { floor, min, max, abs, round, random, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Draw count at each row boundary.
const NAT = new Float64Array(H);
for (let r = 0; r < H; r++) NAT[r] = round(N0 * (pow(1 + NMAX / N0, r / (H - 1)) - 1));

export function setup(params) {
  params.s = {
    init: false, phase: 0, t: 0, front: 0, rounds: 0, still: false,
    balls: 1, added: 1, hue: 0, speed: 2,
    // Each urn: balls of the first colour, all balls, draws made.
    A: new Float64Array(W), T: new Float64Array(W), n: new Float64Array(W),
    // Share of the first colour at each row, this run and the run before.
    cur: new Float32Array(W * H), old: new Float32Array(W * H),
    ca: [0, 0, 0], cb: [0, 0, 0],
  };
}

function startRun(S) {
  for (let i = 0; i < W; i++) {
    S.A[i] = S.balls;
    S.T[i] = 2 * S.balls;
    S.n[i] = 0;
  }
  S.front = 0;
  S.t = 0;
  S.phase = 0;
  S.rounds = 0;
  S.still = false;
}

// Run every urn on to row r's draw count and write the shares of the rows it
// passes; the row the front stands in shows the share as it is now.
function advance(S, rf) {
  const { A, T, n, cur } = S, c = S.added;
  const r1 = min(H - 1, floor(rf));
  for (let i = 0; i < W; i++) {
    let a = A[i], t = T[i], k = n[i];
    for (let r = S.front; r <= r1; r++) {
      const goal = NAT[r];
      while (k < goal) {
        if (random() * t < a) a += c;
        t += c;
        k++;
      }
      cur[r * W + i] = a / t;
    }
    // Draws inside the row the front is crossing, toward the next row.
    if (r1 < H - 1) {
      const goal = NAT[r1] + (NAT[r1 + 1] - NAT[r1]) * (rf - r1);
      while (k < goal) {
        if (random() * t < a) a += c;
        t += c;
        k++;
      }
      cur[(r1 + 1) * W + i] = a / t;
    }
    A[i] = a;
    T[i] = t;
    n[i] = k;
  }
  S.front = r1 + 1;
}

// One round of odd-even transposition sort on the columns, by the bottom
// row's share; whole columns move, their history with them.
function sortRound(S) {
  const { cur } = S, base = (H - 1) * W, odd = S.rounds & 1;
  let moved = false;
  for (let i = odd; i + 1 < W; i += 2) {
    if (cur[base + i] > cur[base + i + 1]) {
      for (let r = 0; r < H; r++) {
        const p = r * W + i, v = cur[p];
        cur[p] = cur[p + 1];
        cur[p + 1] = v;
      }
      moved = true;
    }
  }
  S.rounds++;
  return moved;
}

function firstRun(S) {
  // The panel opens on a finished run, so the first run comes down over it.
  startRun(S);
  advance(S, H - 1);
  while (sortRound(S) || sortRound(S));
  S.old.set(S.cur);
  startRun(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const balls = round(cl(k[2], 1, 8)), added = round(cl(k[3], 1, 8));
  // A change of Balls or Added starts a fresh run under the new rule.
  if (S.init && (balls !== S.balls || added !== S.added)) {
    S.balls = balls;
    S.added = added;
    // What is on the panel now becomes the run the new one comes down over.
    if (S.phase === 0) S.old.set(S.cur.subarray(0, S.front * W));
    else S.old.set(S.cur);
    startRun(S);
  }
  S.balls = balls;
  S.added = added;
  if (!S.init) {
    firstRun(S);
    S.init = true;
  }
  S.t += d;
  if (S.phase === 0) {
    const rf = min(H - 1, (S.t * S.speed * (H - 1)) / FILL);
    advance(S, rf);
    if (rf >= H - 1) {
      S.phase = 1;
      S.t = 0;
    }
  } else if (S.phase === 1) {
    if (S.t > HOLD1) {
      S.phase = 2;
      S.t = 0;
    }
  } else if (S.phase === 2) {
    // Sorting rounds at SORTS a second; two rounds in a row that move
    // nothing mean the columns are in order.
    while (S.t > 1 / SORTS) {
      S.t -= 1 / SORTS;
      const moved = sortRound(S);
      if (!moved && S.still) {
        S.phase = 3;
        S.t = 0;
        break;
      }
      S.still = !moved;
    }
  } else if (S.t > HOLD2) {
    S.old.set(S.cur);
    startRun(S);
  }
}

function colours(S) {
  // The first colour, and the second a third of the wheel on; orange and
  // yellow are paled and lifted.
  for (const [h, out] of [[S.hue + 0.47, S.ca], [S.hue + 0.8, S.cb]]) {
    const hh = h - floor(h), warm = cl(1 - abs(hh - 0.12) / 0.1, 0, 1);
    hsv(h, 0.78 - 0.3 * warm, 1, out);
    if (warm > 0) {
      const lift = 1 + 0.25 * warm;
      out[0] = min(1, out[0] * lift);
      out[1] = min(1, out[1] * lift);
      out[2] = min(1, out[2] * lift);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  colours(S);
  const { ca, cb, cur, old } = S;
  const fill = S.phase === 0, fr = S.front;
  for (let y = 0; y < H; y++) {
    const live = !fill || y < fr;
    const atFront = fill && y === fr - 1;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, s = live ? cur[p] : old[p];
      // The mix of the two colours by the share of the first, lifted halfway
      // back to full brightness, so two colours either side of yellow mix to
      // yellow and not olive. A mix in orange or yellow is lifted and paled
      // further, a quarter of the way to white. The run before waits under
      // the front at 70%, sorted, so the new barcode reads against its ramp.
      let r = s * ca[0] + (1 - s) * cb[0], g = s * ca[1] + (1 - s) * cb[1], b = s * ca[2] + (1 - s) * cb[2];
      const m = max(r, g, b), warm = cl((min(r, g) - b) / m, 0, 1);
      const k = ((live ? 0.95 : 0.7) + (live ? 0.05 : 0.3) * warm) * (0.5 + 0.5 / m), pale = 0.25 * warm;
      r = r * k + (1 - r * k) * pale;
      g = g * k + (1 - g * k) * pale;
      b = b * k + (1 - b * k) * pale;
      if (atFront) {
        r = r * 0.5 + 0.5;
        g = g * 0.5 + 0.5;
        b = b * 0.5 + 0.5;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
  }
}
