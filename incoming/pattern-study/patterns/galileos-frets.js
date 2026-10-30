// ===== Patternflow pattern =====
// Title:   Galileo's Frets
// Family:  rhythm
// Idea:    Three grooves run down an inclined plane, each with its own frets and its own ball, all released together from the top: the middle groove's frets sit at the squares 1, 4, 9, 16 so its ball bumps over them on an even beat, the outer two sit at other powers so their beats speed up or slow down, and beside each groove its strikes stand as stripes on a strip of time against the dotted lines of an even metronome.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Galileo's law of fall and the law of odd numbers (Galileo Galilei, Two New Sciences, 1638), the frets on the inclined plane as Stillman Drake read them (The Role of Music in Galileo's Experiments, Scientific American, June 1975), pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Law=1..3, Frets=0..1
//
// Knob 1: Hue. Turns the three grooves round the wheel together. At 0 the left one is azure, Galileo's in the middle green and the right one magenta.
// Knob 2: Speed. How steep the plane is. The acceleration goes as the knob, so a fall takes 4 s at 2 (with 8 frets Galileo's groove strikes every 0.5 s), 12.6 s at 0.2 and 3.3 s at 3.
// Knob 3: Law. The exponent p of the left groove's frets, which sit at (n/N)^p of the plane; the right groove takes 4 - p. At the opening 1, even spacing, whose first strike comes 1.41 s into a 4 s fall and whose last two are 0.26 s apart, against the cubes on the right, which strike first 0.18 s in and last 0.73 s after the one before. At 2 all three grooves are Galileo's and strike together on the beat; at 3 the outer two have swapped.
// Knob 4: Frets. How many frets each groove has: 8 at the opening, 10, 12 and 14 at the quarters, 16 at the end.

// A ball rolling from rest down a plane covers x = a t^2 / 2, so in equal
// times it covers distances in the ratio of the odd numbers 1, 3, 5, 7, and
// after n beats it has gone n^2. Drake read Galileo's working notes as an
// experiment done by ear: gut frets tied round the plane, the ball bumping
// over each, the frets moved until the bumps came on an even beat, and their
// distances then measured from the start, which came out as the squares.
//
// Here the three grooves share one plane, so their balls fall together, and
// they differ only in where their frets are: fret n of N at (n/N)^p of the
// plane's 128 rows. The ball crosses it at (n/N)^(p/2) of the time of the
// fall, and only p = 2 makes that n/N, the beat. Beside each groove is a
// strip of time, 128 rows for the length of the fall, with the metronome's
// N even marks down its left edge and carried across it as dotted lines.
// Stretch n of the groove, fret n - 1 to fret n, and stretch n of the strip,
// strike n - 1 to strike n, are one piece of the fall, once as a distance
// and once as a time. In Galileo's groove the stretches grow 1, 3, 5, 7
// and their times are all equal, so its stripes lie on the dotted lines;
// with even frets the times shrink, with the cubes they grow. A white mark
// runs down the metronome at an even pace while the ball runs down the
// groove ever faster, and both get to the bottom together.

// Each lane is 21 LEDs: the groove between walls 8 apart, then the
// metronome's column and the strip of time.
const W = 64, H = 128, N = W * H, LANES = 3, LW = 21, GR = 8, REST = 0.35;
const { floor, min, max, round, sqrt } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const HUES = [0.57, 0.31, 0.87];

function hsv(h, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const v = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  o[0] = v[0];
  o[1] = v[1];
  o[2] = v[2];
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, law: 1, nf: 8, t: 0, T: 4,
    flash: [new Float32Array(17), new Float32Array(17), new Float32Array(17)],
    buf: new Float32Array(N * 3), col: [0, 0, 0],
  };
}

// Exponents of the three grooves' frets: Law, Galileo's 2, and 4 - Law.
const laws = (S) => [S.law, 2, 4 - S.law];

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.law = cl(k[2] == null ? 1 : k[2], 1, 3);
  S.nf = 8 + round(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 8);
  // The acceleration goes as Speed, so the time of a fall as 1/sqrt(Speed).
  S.T = 4 * sqrt(2 / S.speed);
  const u0 = S.t / S.T;
  S.t += d;
  const u1 = S.t / S.T, P = laws(S);
  for (const f of S.flash) for (let n = 0; n < f.length; n++) f[n] = max(0, f[n] - d * 4);
  // A fret struck between the last frame and this one flashes.
  for (let L = 0; L < LANES; L++)
    for (let n = 1; n <= S.nf; n++) {
      const tn = (n / S.nf) ** (P[L] / 2);
      if (tn > u0 && tn <= u1) S.flash[L][n] = 1;
    }
  if (S.t >= S.T + REST) S.t = 0;
}

function add(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  buf[p] += c[0] * a;
  buf[p + 1] += c[1] * a;
  buf[p + 2] += c[2] * a;
}

function band(buf, x0, x1, y0, y1, c, a) {
  for (let y = max(0, y0); y <= min(H - 1, y1); y++) for (let x = x0; x <= x1; x++) add(buf, x, y, c, a);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, col = S.col, nf = S.nf, u = min(1, S.t / S.T), by = (H - 1) * u * u, P = laws(S);
  buf.fill(0);
  const white = [1, 1, 1];
  for (let L = 0; L < LANES; L++) {
    const ox = L * LW, p = P[L], fl = S.flash[L], gr = ox + GR, mx = gr + 2, sx = gr + 4, ex = ox + LW - 1, bx = ox + GR / 2;
    hsv(S.hue + HUES[L], col);
    // The stretches of the groove and of the strip: the strip's shaded
    // alternately, and both lit while the ball is in that stretch.
    let g0 = 0, s0 = 0;
    for (let n = 1; n <= nf; n++) {
      const g1 = round((H - 1) * (n / nf) ** p), s1 = round((H - 1) * (n / nf) ** (p / 2)), f = fl[n];
      const now = u < 1 && by < g1 && by >= g0;
      band(buf, ox + 1, gr - 1, g0 + 1, g1 - 1, col, now ? 0.5 : 0.03);
      band(buf, sx, ex, s0 + 1, s1 - 1, col, (n % 2 ? 0.26 : 0.08) + (now ? 0.4 : 0));
      // The fret, and the strike in the strip, flash white as the ball
      // bumps over it.
      band(buf, ox, gr, g1, g1, col, 0.6 + 0.4 * f);
      band(buf, ox, gr, g1, g1, white, 0.7 * f);
      band(buf, sx, ex, s1, s1, col, 0.6 + 0.4 * f);
      band(buf, sx, ex, s1, s1, white, 0.7 * f);
      g0 = g1;
      s0 = s1;
    }
    band(buf, ox, ox, 0, H - 1, col, 0.25);
    band(buf, gr, gr, 0, H - 1, col, 0.25);
    // The metronome down the strip's left edge: N even marks, and time
    // running down past them at an even pace.
    const ty = round((H - 1) * u);
    band(buf, mx, mx + 1, 0, ty, white, 0.1);
    for (let n = 1; n <= nf; n++) {
      const y = round(((H - 1) * n) / nf);
      band(buf, mx, mx + 1, y, y, white, 0.45);
      // Carried across the strip as a dotted line, so a strike on the beat
      // lies on it.
      for (let x = sx + 1; x <= ex; x += 2) add(buf, x, y, white, 0.3);
    }
    band(buf, mx, mx + 1, ty, ty, white, 1);
    // The ball, and a streak over the ground it covered in the last 6% of
    // the fall's time.
    const v = 2 * (H - 1) * u, tail = min(by, v * 0.06);
    for (let y = floor(by - tail); y <= by; y++) add(buf, bx, y, white, 0.2 + 0.4 * (1 - (by - y) / max(1, tail)));
    const yb = round(by);
    band(buf, bx - 1, bx + 1, yb - 1, yb, white, 0.7);
    band(buf, bx, bx, yb - 1, yb, white, 0.3);
  }
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
