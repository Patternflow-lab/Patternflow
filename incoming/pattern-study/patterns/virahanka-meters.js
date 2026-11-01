// ===== Patternflow pattern =====
// Title:   Virahanka's Meters
// Family:  rhythm
// Idea:    Every Sanskrit meter of n matras, a short syllable one cell and a long one a bar two cells wide, is stacked down the panel in Pingala's order, the meters of n - 2 with a long added on top of the meters of n - 1 with a short added, so the stack splits into two blocks of F(n - 1) and F(n) rows and each block splits the same way, while a playhead sweeps the matra columns and all F(n + 1) rows play their rhythms at once, each syllable flashing as it starts and each long holding its glow across its two beats.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the meters of n matras and their count F(n + 1) (Virahanka, between 600 and 800; Gopala, about 1135; Hemachandra, about 1150); the prastara, the fixed order of meters (Pingala, Chandahshastra, about the 3rd to 2nd century BCE); the shallow diagonals of Pascal's triangle summing to Fibonacci numbers (Edouard Lucas, 1876), pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Matras=5..9, Order=0..1
//
// Knob 1: Hue. Turns both syllables round the wheel together. At 0 the shorts are sea green and the longs violet; at 0.25 blue and red, at 0.5 rose and lime. A syllable flashes white as it starts.
// Knob 2: Speed. Matras a second, 1.25 for each unit: 2.5 at the opening 2, so a bar of 5 matras takes 2 s; 0.25 a second at 0.2 and 3.75 at 3.
// Knob 3: Matras. The length n of every meter, 5 to 9, and with it the number of meters F(n + 1): 8 rows 16 LEDs tall at the opening 5, then 13, 21, 34 and 55 rows, the last ones 2 or 3 LEDs tall. The matra columns are 12 LEDs wide at 5 and 7 at 9.
// Knob 4: Order. Below a third, Pingala's order: the meters that end in a long on top of those that end in a short, so the two blocks of the Fibonacci sum and the blocks inside them line up along the right edge. To two thirds, the same recursion on the first syllable: all meters that start with a short, then all that start with a long, and the blocks line up along the left edge. Above that, the meters grouped by how many longs they hold, most first, in blocks of C(n - k, k) rows: 3, 4 and 1 at n = 5, and 5, 20, 21, 8 and 1 at n = 9, Pascal's shallow diagonals. The rows slide to their new places.

// Sanskrit prosody weighs a syllable by its length in matras, morae: a short
// (laghu) is one and a long (guru) two. The meters of n matras are all the
// rows of shorts and longs that add up to n. A meter of n either ends in a
// long, after a meter of n - 2, or in a short, after a meter of n - 1, so
// their number is the sum of the two before it: 1, 2, 3, 5, 8, 13, ...
// Virahanka stated this rule between 600 and 800, and Gopala, about 1135,
// and Hemachandra, about 1150, wrote it out again, centuries before
// Fibonacci's Liber Abaci (1202).
//
// Pingala's prastara lays the meters out in a fixed order. The first row
// holds as many longs as fit, with a short at the front when n is odd;
// each next row puts a short under the first long, copies what lies right
// of it and fills the left with longs again; the last row is all shorts.
// The same list comes from the rule above: the list for n - 2 with a long
// added, then the list for n - 1 with a short added. Read from the bottom
// row up, it counts 0, 1, 2, ... with a long starting at matra i worth the
// Fibonacci number F(i + 2), each number written once as a sum of
// Fibonacci numbers no two in a row: Zeckendorf's representation.
//
// The meters with k longs hold n - k syllables, and the longs can sit at
// any k of them, C(n - k, k) ways. Summed over k these are the shallow
// diagonals of Pascal's triangle, which Lucas showed add up to the
// Fibonacci numbers in 1876. The third order on K4 shows them as blocks.
//
// Every row plays the same bar of n matras at once. A short flashes and
// fades within its beat; a long flashes, then holds its glow, filling the
// bar behind the playhead, and lets go after its second beat. After that a
// syllable keeps an afterglow that fades through the rest of the bar.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Hues of a short and a long, saturation, a syllable's level at rest and
// the playhead's height over the dark gaps.
const HUE_L = 0.43, HUE_G = 0.76, SAT = 0.72, REST = 0.3, PLAY = 0.36;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Pingala's order: P(n) = P(n - 2) + long, then P(n - 1) + short.
function prastara(n) {
  const P = [[[]], [[1]]];
  for (let m = 2; m <= n; m++) P.push([...P[m - 2].map((r) => [...r, 2]), ...P[m - 1].map((r) => [...r, 1])]);
  return P[n];
}

// The same recursion on the first syllable: Q(n) = short + Q(n - 1), then long + Q(n - 2).
function shortFirst(n) {
  const Q = [[[]], [[1]]];
  for (let m = 2; m <= n; m++) Q.push([...Q[m - 1].map((r) => [1, ...r]), ...Q[m - 2].map((r) => [2, ...r])]);
  return Q[n];
}

const longs = (r) => r.reduce((a, v) => a + (v === 2 ? 1 : 0), 0);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 0, order: -1, t: 0,
    meters: [], pos: null, tgt: null,
    r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N), c: [0, 0, 0],
  };
}

function place(S, snap) {
  const P = S.meters, R = P.length;
  let rows;
  if (S.order === 0) rows = P.map((_, i) => i);
  else if (S.order === 1) {
    const at = new Map(P.map((r, i) => [r.join(""), i]));
    rows = shortFirst(S.n).map((r) => at.get(r.join("")));
  } else rows = P.map((_, i) => i).sort((a, b) => longs(P[b]) - longs(P[a]) || a - b);
  for (let k = 0; k < R; k++) S.tgt[rows[k]] = k;
  if (snap) S.pos.set(S.tgt);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const n = round(cl(k[2] == null ? 5 : k[2], 5, 9));
  const order = min(2, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 3));
  if (n !== S.n) {
    S.n = n;
    S.order = order;
    S.meters = prastara(n);
    S.pos = new Float32Array(S.meters.length);
    S.tgt = new Float32Array(S.meters.length);
    place(S, true);
  } else if (order !== S.order) {
    S.order = order;
    place(S, false);
  }
  const ease = min(1, d * 5);
  for (let i = 0; i < S.pos.length; i++) S.pos[i] += (S.tgt[i] - S.pos[i]) * ease;
  S.t += d * S.speed * 1.25;
  if (S.t > 5040) S.t -= 5040; // a common multiple of 5..9 bars
}

// How lit a syllable is, tau matras after its onset, and how white.
function envelope(len, tau, o) {
  let e, w;
  if (tau < len) {
    w = exp(-7 * tau);
    e = len === 1 ? 0.25 + 0.75 * exp(-2.6 * tau) : 0.62 + 0.38 * exp(-3.5 * tau);
  } else {
    const end = len === 1 ? 0.25 + 0.75 * exp(-2.6) : 0.62 + 0.38 * exp(-7);
    e = end * exp(-1.1 * (tau - len));
    w = 0;
  }
  o[0] = e;
  o[1] = w;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pos) return;
  const n = S.n, P = S.meters, R = P.length, RH = H / R;
  const cw = floor(W / n), x0 = floor((W - cw * n) / 2);
  const gx = cw >= 10 ? 2 : 1, gy = RH >= 10 ? 2 : RH >= 3 ? 1 : 0;
  const ph = S.t % n, xph = x0 + ph * cw;
  const Rr = S.r, Gg = S.g, Bb = S.b, c = S.c, env = [0, 0];
  Rr.fill(0);
  Gg.fill(0);
  Bb.fill(0);

  for (let m = 0; m < R; m++) {
    const y = S.pos[m] * RH, ya = y + gy / 2, yb = y + RH - gy / 2;
    // With no gap between rows every other row is a little dimmer.
    const stripe = gy === 0 && round(S.pos[m]) % 2 === 1 ? 0.8 : 1;
    const row = P[m];
    let a = 0;
    for (let j = 0; j < row.length; j++) {
      const len = row[j];
      const xa = x0 + a * cw + gx / 2, xb = x0 + (a + len) * cw - gx / 2;
      let tau = ph - a;
      if (tau < 0) tau += n;
      envelope(len, tau, env);
      const active = tau < len;
      const v = REST + (1 - REST) * env[0];
      hsv(S.hue + (len === 1 ? HUE_L : HUE_G), SAT * (1 - 0.8 * env[1]), 1, c);
      // The rounded rectangle, antialiased by its signed distance.
      const hx = (xb - xa) / 2, hy = (yb - ya) / 2, cx = xa + hx, cy = ya + hy;
      const rad = min(4, 0.38 * min(hx, hy) * 2);
      // A ring of light just outside the cell while the onset flash lasts.
      const halo = env[1] * 0.75;
      const X0 = max(0, floor(xa - 1)), X1 = min(W - 1, floor(xb + 1)), Y0 = max(0, floor(ya - 1)), Y1 = min(H - 1, floor(yb + 1));
      for (let py = Y0; py <= Y1; py++) {
        const qy = Math.abs(py + 0.5 - cy) - (hy - rad);
        const shade = (1.08 - 0.22 * ((py + 0.5 - ya) / (yb - ya))) * stripe;
        for (let px = X0; px <= X1; px++) {
          const qx = Math.abs(px + 0.5 - cx) - (hx - rad);
          const ox = max(qx, 0), oy = max(qy, 0);
          const sd = sqrt(ox * ox + oy * oy) + min(max(qx, qy), 0) - rad;
          const cov = cl(0.5 - sd, 0, 1);
          if (cov <= 0) {
            if (halo > 0.02 && sd < 1.6) {
              const k = halo * (1 - sd / 1.6) * 255 * stripe, i = py * W + px;
              Rr[i] += (0.5 + 0.5 * c[0]) * k;
              Gg[i] += (0.5 + 0.5 * c[1]) * k;
              Bb[i] += (0.5 + 0.5 * c[2]) * k;
            }
            continue;
          }
          // A long fills behind the playhead while it holds.
          let lv = v;
          if (active && len === 2) lv = v * (0.55 + 0.45 * cl(xph - px, 0, 1));
          const k = cov * lv * shade * 255, i = py * W + px;
          Rr[i] += c[0] * k;
          Gg[i] += c[1] * k;
          Bb[i] += c[2] * k;
        }
      }
      a += len;
    }
  }

  // The playhead, a soft line through the gaps and over the cells.
  for (let px = max(0, floor(xph - 3)); px <= min(W - 1, floor(xph + 3)); px++) {
    const dx = px + 0.5 - xph, gl = PLAY * exp(-(dx * dx) / 1.4) * 255;
    for (let py = 0; py < H; py++) {
      const i = py * W + px;
      Rr[i] += gl;
      Gg[i] += gl * 0.95;
      Bb[i] += gl * 0.85;
    }
  }

  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      display.setPixel(px, py, min(255, round(Rr[i])), min(255, round(Gg[i])), min(255, round(Bb[i])));
    }
}
