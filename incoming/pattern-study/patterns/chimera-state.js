// ===== Patternflow pattern =====
// Title:   Chimera State
// Family:  rhythm
// Idea:    256 identical phase oscillators on a ring, each pulled by all the others and hardest by its near neighbours, split into a stretch that moves in step and a stretch whose phases scatter; the top 20 rows plot every phase against its place, a smooth arc beside a spray of dots, and below them each row is one moment, newest at the top, so the part in step runs down the middle as one smooth cyan band while the scattered sides fill with the dark strokes of oscillators slipping a turn behind.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Chimera states (Yoshiki Kuramoto and Dorjsuren Battogtokh, 2002)
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lag=80..88, Stride=0.8..4
//
// Knob 1: Hue. Turns the wheel that colours the phase. At 0 the part in step is cyan, and an oscillator slipping a turn goes through blue and violet, dark at half a turn, and back through yellow and green.
// Knob 2: Speed. Four time units of the equation a second times the knob. The oscillators in the middle of the scattered stretch slip a turn every 10.8 time units, so at 2 about every 1.4 s, and at Stride 0.8 the history moves down 10 rows a second.
// Knob 3: Lag. The phase lag α in degrees. At 80 (β = 90 - α = 10°, near Abrams and Strogatz's 0.18 rad) 30% of the ring moves in step, a band 19 columns wide; at 84 22%, at 88 14%, 9 columns. The lag follows the knob a tenth of a degree per time unit, so the whole range takes 80 time units, 10 s at Speed 2, and the band widens or narrows as it scrolls.
// Knob 4: Stride. Time units between two rows of the history, 0.8 to 4. At 0.8 the 107 rows hold 86 time units and each slip is a thick dark stroke, the strokes lined up in chevrons; at 4 they hold 428 and the strokes break into speckle.
// Buttons: K1 tap draws a new random start: two thirds of the ring are thrown out of step around a band about 45% wide, and in the next 30 time units, 4 s at Speed 2, the scattered stretch eats back into the band. Each new draw grows at 84 degrees for 100 time units before the lag returns to the knob.

// The ring form is Daniel Abrams and Steven Strogatz's (2004): N identical
// phase oscillators at x_j = -pi + 2 pi j / N, each pulled by all the others
// through the kernel G(x) = (1 + A cos x) / 2 pi and a phase lag alpha,
//   dθ_j/dt = ω - (2 pi / N) Σ_k G(x_j - x_k) sin(θ_j - θ_k + α),
// their A = 0.995 and their start θ_j = 6 r_j exp(-0.76 x_j²), r_j uniform
// in [-1/2, 1/2]. Every oscillator obeys the same law, yet the ring splits
// into a stretch that moves in step and a stretch whose phases scatter.
const W = 64, H = 128, N = 256, PER = N / W, TOP = 20, Y0 = TOP + 1, ROWS = H - Y0;
const A = 0.995, STEP = 0.1, MAXSTEPS = 30, RATE = 4, HUE0 = 0.55;
const { min, floor, round, sqrt, sin, cos, exp, atan2, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (v, m) => v - m * round(v / m);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A new random draw of the Abrams-Strogatz start, its scattered hump at x0.
// The part in step forms on the calm side, opposite x0; on the first draw
// the columns are set to put it in the middle of the panel.
function seed(P, x0, place) {
  for (let j = 0; j < N; j++) {
    const d = wrap(-PI + (TAU * j) / N - x0, TAU);
    P.th[j] = 6 * (Math.random() - 0.5) * exp(-0.76 * d * d);
  }
  if (place) {
    P.xs = ((x0 + 2 * PI) / TAU) * W;
    P.xs -= W * floor(P.xs / W);
    P.col = round(P.xs) % W;
  }
  P.dead = 0;
  P.age = 0;
  P.lag = 84;
}

// The sum over k is the local field R_j e^{iΘ_j} = (1/N) Σ_k (1 + A cos(x_j
// - x_k)) e^{iθ_k}, and with cos(x_j - x_k) = cos x_j cos x_k + sin x_j sin
// x_k it is three sums over the ring, Σ e^{iθ}, Σ cos x e^{iθ} and
// Σ sin x e^{iθ}, read off at each x_j: O(N) a step instead of O(N²). Then
// dθ_j/dt = ω - R_j sin(θ_j - Θ_j + α).
function deriv(P, t, d, frame) {
  const { cx, sx, c: C, s: S } = P;
  let p0r = 0, p0i = 0, pcr = 0, pci = 0, psr = 0, psi = 0;
  for (let k = 0; k < N; k++) {
    const c = cos(t[k]), s = sin(t[k]);
    C[k] = c;
    S[k] = s;
    p0r += c;
    p0i += s;
    pcr += cx[k] * c;
    pci += cx[k] * s;
    psr += sx[k] * c;
    psi += sx[k] * s;
  }
  const ca = P.ca, sa = P.sa;
  let wx = 0, wy = 0;
  for (let j = 0; j < N; j++) {
    const rr = (p0r + A * (cx[j] * pcr + sx[j] * psr)) / N, ri = (p0i + A * (cx[j] * pci + sx[j] * psi)) / N;
    const c = C[j], s = S[j];
    d[j] = -((s * ca + c * sa) * rr - (c * ca - s * sa) * ri);
    if (frame) {
      const r2 = rr * rr + ri * ri;
      wx += r2 * cx[j];
      wy += r2 * sx[j];
    }
  }
  if (frame) {
    // The field is strongest over the part in step. Its centre xc, and the
    // field's phase there, give the frame that turns with that part.
    const xc = atan2(wy, wx), cc = cos(xc), sc = sin(xc);
    P.xc = xc;
    P.phi = atan2(p0i + A * (cc * pci + sc * psi), p0r + A * (cc * pcr + sc * psr));
    P.z = sqrt(p0r * p0r + p0i * p0i) / N;
  }
}

// One RK4 step of 0.1. The right side is never more than 1 + A in size, so
// the step is far inside RK4's reach at every Lag. Before it the whole ring
// is turned back by the phase of the part in step, which the equation does
// not see (every oscillator is the same, so ω is free): that part's phases
// stand still and only the scattered ones move.
function step(P) {
  const { th, k1, k2, k3, k4, tmp } = P, h = STEP;
  // Each draw grows at 84 degrees for 100 time units, and only then does
  // the lag move to the knob, a tenth of a degree per time unit. From the
  // Abrams-Strogatz start right at 80 degrees, 6 draws in 30 fell into step
  // everywhere within 65 time units; grown at 84 and brought down to 80 (or
  // up to 88) after, none of 30 did in 1000. A sudden jump from 88 to 80 on
  // a grown chimera ended 1 of 20, hence the slow turn.
  P.age += h;
  const want = P.age < 100 ? 84 : P.lagKnob;
  P.lag += cl(want - P.lag, -0.01, 0.01);
  P.ca = cos((P.lag * PI) / 180);
  P.sa = sin((P.lag * PI) / 180);
  deriv(P, th, k1, true);
  const phi = P.phi;
  for (let j = 0; j < N; j++) th[j] -= phi;
  for (let j = 0; j < N; j++) tmp[j] = th[j] + 0.5 * h * k1[j];
  deriv(P, tmp, k2, false);
  for (let j = 0; j < N; j++) tmp[j] = th[j] + 0.5 * h * k2[j];
  deriv(P, tmp, k3, false);
  for (let j = 0; j < N; j++) tmp[j] = th[j] + h * k3[j];
  deriv(P, tmp, k4, false);
  for (let j = 0; j < N; j++) th[j] = wrap(th[j] + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]), TAU);
  // With 256 oscillators the chimera wanders round the ring, a few columns
  // in a thousand time units. The history keeps the ring's own columns, so
  // the wandering shows as a lean in the band; the panel as a whole slides
  // a column after it once the part in step is three columns off the middle.
  P.xs = wrap(P.xs + 0.002 * wrap(((P.xc + PI) / TAU) * W - P.xs, W), W);
  if (abs(wrap(P.xs - P.col, W)) > 3) P.col = ((round(P.xs) % W) + W) % W;
  // A draw can still fall into step everywhere, the other state this ring
  // can rest in. After 30 time units of that, a new draw.
  P.dead = P.z > 0.99 ? P.dead + h : 0;
  if (P.dead > 30) seed(P, (TAU * P.col) / W, false);
}

const osc = (P, c, k) => ((((P.col - W / 2 + c) * PER + k) % N) + N) % N;

// A row of the history keeps one oscillator of every four, in the ring's
// own columns.
function record(P) {
  P.head = (P.head + ROWS - 1) % ROWS;
  const o = P.head * W;
  for (let c = 0; c < W; c++) P.hist[o + c] = P.th[c * PER + 1];
}

export function setup(params) {
  const cx = new Float64Array(N), sx = new Float64Array(N);
  for (let j = 0; j < N; j++) (cx[j] = cos(-PI + (TAU * j) / N)), (sx[j] = sin(-PI + (TAU * j) / N));
  const f = () => new Float64Array(N);
  params.s = {
    cx, sx, th: f(), k1: f(), k2: f(), k3: f(), k4: f(), tmp: f(), c: f(), s: f(),
    ca: 0, sa: 1, lag: 84, lagKnob: 80, age: 0, xc: PI, phi: 0, z: 0, xs: 0, col: 0, dead: 0,
    hist: new Float32Array(ROWS * W), head: 0, clock: 0, since: 0, fresh: true,
    hue: 0, speed: 2, stride: 1, pal: new Float32Array(256 * 3), dot: new Float32Array(256 * 3), palHue: NaN,
    acc: new Float32Array(W * TOP * 3),
  };
  seed(params.s, 0, true);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 80, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.lagKnob = cl(k[2], 80, 88);
  P.stride = cl(k[3], 0.8, 4);
  if (P.fresh) {
    // 150 time units to grow and reach the knob's lag; a draw that still
    // falls into step is drawn again. Then the whole history is run once so
    // the panel opens full: 5,780 steps at Stride 4, about 0.3 s once.
    for (let tries = 0; tries < 8; tries++) {
      if (tries) seed(P, 0, true);
      for (let i = 0; i < 1500; i++) step(P);
      if (P.z < 0.9) break;
    }
    for (let r = 0; r < ROWS; r++) {
      for (let t = 0; t < P.stride - 1e-9; t += STEP) step(P);
      record(P);
    }
    P.fresh = false;
  }
  if (input.btnPressed && input.btnPressed[0]) seed(P, (TAU * P.col) / W, false);
  P.clock += d * RATE * P.speed;
  let n = 0;
  for (; P.clock >= STEP && n < MAXSTEPS; n++) {
    step(P);
    P.clock -= STEP;
    P.since += STEP;
    if (P.since >= P.stride - 1e-9) {
      record(P);
      P.since -= P.stride;
    }
  }
  if (n === MAXSTEPS) P.clock = 0;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { pal, dot, hist, th, acc } = P;
  if (P.palHue !== P.hue) {
    // Phase round the colour wheel. In the history the brightness also
    // follows the phase, full at the phase of the part in step and dark
    // half a turn away, so each slip of a scattered oscillator is a dark
    // stroke through its column.
    for (let i = 0; i < 256; i++) {
      const t = (i / 256) * TAU;
      hsv(P.hue + HUE0 + i / 256, 0.85, 0.5 + 0.5 * cos(t), pal, i * 3);
      hsv(P.hue + HUE0 + i / 256, 0.75, 1, dot, i * 3);
    }
    P.palHue = P.hue;
  }
  // The present, in the top 20 rows: every oscillator a dot, its phase up
  // and down against its place on the ring.
  acc.fill(0);
  for (let c = 0; c < W; c++)
    for (let k = 0; k < PER; k++) {
      const t = th[osc(P, c, k)], y = TOP / 2 - 0.5 + (t / PI) * (TOP / 2 - 0.5), y0 = floor(y), f = y - y0;
      const q = (floor((t / TAU + 1) * 256) & 255) * 3;
      if (y0 >= 0) {
        const o = (y0 * W + c) * 3, a = 0.7 * (1 - f);
        (acc[o] += a * dot[q]), (acc[o + 1] += a * dot[q + 1]), (acc[o + 2] += a * dot[q + 2]);
      }
      if (y0 + 1 < TOP) {
        const o = ((y0 + 1) * W + c) * 3, a = 0.7 * f;
        (acc[o] += a * dot[q]), (acc[o + 1] += a * dot[q + 1]), (acc[o + 2] += a * dot[q + 2]);
      }
    }
  for (let y = 0, o = 0; y < TOP; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, min(255, acc[o] * 255), min(255, acc[o + 1] * 255), min(255, acc[o + 2] * 255));
  for (let x = 0; x < W; x++) display.setPixel(x, TOP, 0, 0, 0);
  // The past: one row per moment, the newest at the top.
  for (let r = 0; r < ROWS; r++) {
    const o = ((P.head + r) % ROWS) * W, c0 = P.col + W / 2;
    for (let x = 0; x < W; x++) {
      const q = (floor((hist[o + ((c0 + x) % W)] / TAU + 1) * 256) & 255) * 3;
      display.setPixel(x, Y0 + r, pal[q] * 255, pal[q + 1] * 255, pal[q + 2] * 255);
    }
  }
}
