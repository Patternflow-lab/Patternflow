// ===== Patternflow pattern =====
// Title:   Stochastic Resonance
// Family:  rhythm
// Idea:    Sixty particles each sit in their own copy of the double well V(x) = -x^2/2 + x^4/4, drawn at the top rocking under a periodic push too weak to tip anyone over the hump while white noise kicks them about, and below it every particle's well is written down one row per moment and sinks away, so at the noise where the Kramers escape time is half the push's period the record turns into violet and amber bands in time with the beat, a rhythm made out of noise.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: stochastic resonance (Roberto Benzi, Alfonso Sutera and Angelo Vulpiani, 1981), pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Noise=-1..1, Drive=0.55..0.95
//
// Knob 1: Hue. Turns both wells' colours round the wheel a third apart, the one nearer blue drawn dim; the curve stays white. At 0 the left well is a dim violet and the right amber, at 0.25 bright red and dim green, at 0.5 lime and dim azure, at 0.75 dim teal and magenta.
// Knob 2: Speed. Rows of the record a second, six times the knob: 12 at 2, so the push beats once every 2 seconds and the 97-row record holds four beats; at 0.2 a beat takes 20 seconds, at 3 it takes 1.3.
// Knob 3: Noise. The noise strength D, 0.079 times 3 to the knob. At 0, D = 0.079, where the Kramers time 4.44 e^(0.25/D) is exactly half the push's period, each particle hops about twice a beat and the record is bands; the white bar along the top row, the response at the push's frequency over the newest four beats, stands at about 0.79 of a perfect square wave. At -1 (D = 0.026) a particle hops once in about three beats, the record is long stripes down the panel and the bar shrinks to 0.16; at -0.5 most hops land in time but beats are skipped; at 0.5 (D = 0.137) they hop four times a beat; at 1 (D = 0.237) the record is speckle and the bar is back to 0.52.
// Knob 4: Drive. The push's amplitude as a share of the static threshold 2/(3 sqrt 3) = 0.385, below which a still particle never leaves its well: 0.55 at the start (A = 0.21), 0.95 at the end (A = 0.37), where the hump nearly flattens at each beat and even the quiet setting locks.
// Buttons: K1 tap throws every particle into a well at random, and the record shows the beat pulling them back into step.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, log, cos, sin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The double well: barrier dV = 1/4 between minima at x = +-1, curvature 2
// at the minima and 1 on the hump, so the Kramers escape time is
// (2 pi / sqrt 2) e^(dV / D).
const DV = 0.25;
// Push frequency in the particles' own time. One beat is 209 time units,
// 419 relaxation times of a well, so the particles feel it as slow. A faster
// push (0.1) put the resonance at D = 0.128 with A/D only 1.6, and the bands
// came out ragged; at 0.03 the resonant D is 0.079 and the bands are clean.
const OMEGA = 0.03;
const PERIOD = TAU / OMEGA;
// Time-scale matching: the D at which the Kramers time is half a beat.
const DSTAR = DV / log(1 / (Math.SQRT2 * OMEGA));
// The static threshold: the push that removes the hump of a still particle.
const ACRIT = 2 / (3 * sqrt(3));
// Rows of the record per beat, and rows per second for each unit of Speed.
const ROWS_PER_BEAT = 24, RATE = 6;
const ROWT = PERIOD / ROWS_PER_BEAT;
// Euler-Maruyama step: the well's stiffness 3x^2 - 1 is at most 19 inside
// the clamp at |x| = 2.6, and h = 0.06 keeps 19 h under the limit of 2.
const HSTEP = 0.06;

// Sixty particles in columns 2..61; columns 0 and 63 carry the push.
const N = 60, X0 = 2;
// The well band: rows 0..29. Record rows 31..127, newest at the top.
const BAND = 30, R0 = 31, NR = H - R0;
// The meter reads the newest four beats of the record.
const MROWS = 4 * ROWS_PER_BEAT;
// Column c shows x = (c + 0.5 - 32) / 32 * XS.
const XS = 1.6;
// The curve's height: row = VY - VS * V.
const VY = 9.5, VS = 30;
// Hue of the left well at knob 0, and how far round the right one sits.
const HUE0 = 0.76, HUE_GAP = 0.33;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = round(255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p));
  out[o + 1] = round(255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p));
  out[o + 2] = round(255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p));
}

// Normal deviates two at a time, by Box-Muller.
let spare = 0, hasSpare = false;
function gauss() {
  if (hasSpare) {
    hasSpare = false;
    return spare;
  }
  let u = Math.random();
  if (u < 1e-12) u = 1e-12;
  const r = sqrt(-2 * log(u)), a = TAU * Math.random();
  spare = r * sin(a);
  hasSpare = true;
  return r * cos(a);
}

// How near a hue is to blue (0.62), 0 at the far side of the wheel.
const coolness = (h) => {
  const d = abs(h - floor(h) - 0.62);
  return 0.5 - min(d, 1 - d);
};

const V = (x, f) => -0.5 * x * x + 0.25 * x * x * x * x - f * x;

function scatter(S) {
  for (let i = 0; i < N; i++) {
    const w = Math.random() < 0.5 ? -1 : 1;
    S.x[i] = w + 0.2 * gauss();
    S.s[i] = w;
  }
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, D: DSTAR, A: 0.55 * ACRIT, begun: false,
    // Position and well (-1 left, 1 right) of each particle, the particles'
    // clock, and the time left to the next record row.
    x: new Float32Array(N), s: new Int8Array(N), t: 0, toRow: ROWT,
    // The record as a ring: one byte per particle per row (1 = right well),
    // and the push's sign for each row. head is the newest row.
    rec: new Uint8Array(NR * N), push: new Int8Array(NR), head: 0,
    // Each row's mean well (-1..1) and the push's phase when it was written,
    // and the response at the push's frequency over the last four beats.
    mean: new Float32Array(NR), phase: new Float32Array(NR), R: 0,
    col: new Uint8Array(12), curve: new Int16Array(W), pile: new Uint8Array(W),
  };
  scatter(params.s);
}

// Start with a full record, as if the particles had been running at these
// knobs for four beats already.
function prefill(S) {
  for (let r = 0; r < NR; r++) {
    run(S, ROWT);
    writeRow(S);
  }
  S.begun = true;
}

// Advance every particle by time T: dx = (x - x^3 + A cos(w t)) dt + sqrt(2D) dW.
// A particle changes well only once it is past +-0.5, so jitter on the hump
// is not counted as a hop.
function run(S, T) {
  const n = Math.max(1, round(T / HSTEP)), h = T / n, kick = sqrt(2 * S.D * h), x = S.x, s = S.s;
  for (let k = 0; k < n; k++) {
    const f = S.A * cos(OMEGA * S.t);
    for (let i = 0; i < N; i++) {
      let xi = x[i];
      xi += (xi - xi * xi * xi + f) * h + kick * gauss();
      xi = cl(xi, -2.6, 2.6);
      x[i] = xi;
      if (xi > 0.5) s[i] = 1;
      else if (xi < -0.5) s[i] = -1;
    }
    S.t += h;
  }
}

function writeRow(S) {
  S.head = (S.head + NR - 1) % NR;
  const o = S.head * N;
  let m = 0;
  for (let i = 0; i < N; i++) {
    S.rec[o + i] = S.s[i] > 0 ? 1 : 0;
    m += S.s[i];
  }
  const ph = OMEGA * S.t;
  S.push[S.head] = cos(ph) >= 0 ? 1 : -1;
  S.mean[S.head] = m / N;
  S.phase[S.head] = ph;
  // The meter: the first Fourier coefficient of the mean well over four
  // whole beats, |(2/n) sum m e^(-i w t)|, as a share of the 4/pi a square
  // wave in perfect step would give.
  let re = 0, im = 0;
  for (let r = 0; r < MROWS; r++) {
    const k = (S.head + r) % NR;
    re += S.mean[k] * cos(S.phase[k]);
    im += S.mean[k] * sin(S.phase[k]);
  }
  S.R = ((2 / MROWS) * sqrt(re * re + im * im)) / (4 / PI);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.55];
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.D = DSTAR * Math.pow(3, cl(kv[2], -1, 1));
  S.A = cl(kv[3], 0.55, 0.95) * ACRIT;
  if (!S.begun) prefill(S);
  if (input.btnPressed && input.btnPressed[0]) scatter(S);
  // Particle time this frame; a record row each time it passes a row mark.
  let T = cl(dt || 0, 0, 0.1) * S.speed * RATE * ROWT;
  while (T > 0) {
    const step = min(T, S.toRow);
    run(S, step);
    T -= step;
    S.toRow -= step;
    if (S.toRow <= 1e-9) {
      writeRow(S);
      S.toRow += ROWT;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const C = S.col;
  // Left well, right well, and the same two lighter for the particles. Of
  // the two hues the one nearer blue is drawn dim: a dim red or yellow
  // turns to maroon and olive on the panel, a dim blue or violet does not.
  const ha = HUE0 + S.hue, hb = ha + HUE_GAP;
  const dimA = coolness(ha) >= coolness(hb);
  hsv(ha, dimA ? 0.72 : 0.86, dimA ? 0.5 : 1, C, 0);
  hsv(hb, dimA ? 0.86 : 0.72, dimA ? 1 : 0.5, C, 3);
  hsv(ha, 0.55, 1, C, 6);
  hsv(hb, 0.6, 1, C, 9);

  // The well band. The curve under the push now, one row per column.
  const f = S.A * cos(OMEGA * S.t), cv = S.curve;
  for (let c = 0; c < W; c++) cv[c] = round(VY - VS * V(((c + 0.5 - 32) / 32) * XS, f));
  // Ground under the curve: deep navy, so the well reads as a shape.
  for (let c = 0; c < W; c++) {
    const top = max(0, cv[c] + 1);
    for (let y = top; y < BAND; y++) display.setPixel(c, y, 18, 12, 46);
  }
  // The curve itself, joined to its neighbours so the steep walls stay whole.
  for (let c = 0; c < W; c++) {
    const a = cv[c], b = c ? cv[c - 1] : a, c1 = c < W - 1 ? cv[c + 1] : a;
    const lo = min(a, round((a + b) / 2), round((a + c1) / 2)), hi = max(a, round((a + b) / 2), round((a + c1) / 2));
    for (let y = max(0, lo); y <= min(BAND - 1, hi); y++) display.setPixel(c, y, 210, 210, 225);
  }
  // Particles resting on the curve, piled up where they crowd.
  const pile = S.pile;
  pile.fill(0);
  for (let i = 0; i < N; i++) {
    const c = cl(floor((S.x[i] / XS + 1) * 32), 0, W - 1);
    const y = cv[c] - 1 - pile[c]++;
    if (y < 0 || y >= BAND) continue;
    const o = S.s[i] > 0 ? 9 : 6;
    display.setPixel(c, y, C[o], C[o + 1], C[o + 2]);
  }

  // The meter along the top row, out from the middle both ways: 56 LEDs
  // wide when the record is a square wave in perfect step with the push.
  const mw = round(cl(S.R, 0, 1) * 28);
  for (let c = 32 - mw; c < 32 + mw; c++) display.setPixel(c, 0, 150, 150, 165);

  // The record: newest row at the top, sinking a row at a time.
  for (let r = 0; r < NR; r++) {
    const y = R0 + r, ring = (S.head + r) % NR, o = ring * N;
    // The push's direction down both edges, in the colour of the well it favours.
    const pc = S.push[ring] > 0 ? 3 : 0;
    display.setPixel(0, y, C[pc], C[pc + 1], C[pc + 2]);
    display.setPixel(W - 1, y, C[pc], C[pc + 1], C[pc + 2]);
    for (let i = 0; i < N; i++) {
      const k = S.rec[o + i] ? 3 : 0;
      display.setPixel(X0 + i, y, C[k], C[k + 1], C[k + 2]);
    }
  }
}
