// ===== Patternflow pattern =====
// Title:   Recurrence Plot
// Family:  recurrenceplot
// Idea:    A signal that wanders between quasi-periodic, intermittent, drifting, chaotic and suddenly retuned stretches is delay-embedded in three dimensions and each of its 64 latest samples is compared with each of the 32 latest, painted as a matrix of 2 by 2 LED cells that slides one cell down and across with every new sample, the pairs closer than a threshold solid teal, the distance a ramp from ink to sand and the identity line ivory.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: recurrence plot (Jean-Pierre Eckmann, Sylvie Oliffson Kamphorst and David Ruelle, 1987), delay embedding of a scalar signal (Floris Takens, 1981), the reading of its textures in the review of Norbert Marwan and co-authors (2007), all from memory; the intermittent stretches follow the type I laminar and burst map (Yves Pomeau and Paul Manneville, 1980, from memory); pattern round 235
// Round:   235
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Epsilon=-1..1, Delay=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel: at 0 the recurrent pairs are teal (breathing a little towards green and sky blue), the distance ramp runs from black through blue slate and dusk to sand, and the identity line is ivory; at 0.5 the teal is red and the sand is pale blue, and at 0.25 and 0.75 the darks go violet and teal.
// Knob 2: Speed. New samples a second, which is how fast the matrix slides one cell (2 LED down and 2 across): 1.5 at 0.3, 5.5 at the opening 2, 11.9 at 3, so the 64 rows hold 43 seconds of signal at the slowest and 5.4 at the fastest. The stretches (oscillators, intermittent, drift, chaos) last 34 to 130 samples, which is 23 to 88 seconds at the slowest and 3 to 11 at the fastest.
// Knob 3: Epsilon. The threshold below which two embedded samples count as a recurrence, as a share of the median distance in the window: 0.14 at -1 (the identity line and the tightest returns, teal only at the cores of the lines), 0.32 at the opening 0 (the cores of the lines, with sand round them), 0.73 at 1 (the lines fatten into solid teal ribbons and blocks). The threshold itself breathes by about 28 percent over a minute or two.
// Knob 4: Delay. The embedding delay tau in samples, 0.6 at -1, 3.4 at the opening 0.06, 5.8 at 1, with a breath of 0.6 and 0.35 samples on top that never repeats. The oscillators run 8.5 to 18.5 samples a period, so near a quarter period only the true recurrences stay, as parallel lines, and a delay of 0.6 or 5.8 leaves hatching in both diagonal directions, a lattice of rings and crosses, because the three coordinates then move together or fold back.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, PI, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// The window: 65 rows by 33 columns of cells, each 2 by 2 LED. Row r holds
// the sample n - 64 + r and column c the sample n - 32 + c, n the newest
// sample, so the 64 latest run down the panel against the 32 latest across
// it and the identity line, row = column + 32, starts at the left edge in the
// middle of the panel and ends in the bottom right corner.
const RW = 65, CW = 33, RING = 256, MASK = RING - 1;

const QP = 0, INT = 1, DRIFT = 2, CHAOS = 3;

export function setup(params) {
  const g = {
    n: 0, buf: new Float64Array(RING), kind: QP, left: 0,
    ph: [0, 0, 0], per: [8, 13, 5], x: 0.1, s: 0, v: 0, jit: 0, chirp: 0, ic: 1, il: 1, ir: 0.16, ib: 0.5, io: 0, since: 0,
    script: [[INT, 46], [QP, 31], [QP, 120]],
  };
  const st = {
    g, acc: 0, t: 0, k: [0, 2, 0, 0.06],
    E: new Float64Array(RW * 3), D: new Float32Array(RW * CW), hist: new Int32Array(160), sc: 0, cell: new Float32Array(RW * CW * 3), pal: new Float32Array(8 * 3),
  };
  params.st = st;
  // 46 + 31 + 33 samples: the opening already has a full window, with the jump
  // of frequency 33 samples back and the current stretch still 87 long.
  for (let i = 0; i < 110; i++) sample(g);
}

// ---- the signal -----------------------------------------------------------

function nextRegime(g) {
  let kind, len;
  if (g.script.length) {
    [kind, len] = g.script.shift();
    if (kind === QP) retune(g);
  } else {
    const u = Math.random();
    // Where a stretch leads: back to oscillators (a new set of frequencies
    // when it came from oscillators), or into one of the other three.
    const from = g.kind;
    const ways = from === QP ? [[QP, 0.3], [INT, 0.28], [DRIFT, 0.2], [CHAOS, 0.22]]
      : from === INT ? [[QP, 0.6], [DRIFT, 0.2], [CHAOS, 0.2]]
      : from === DRIFT ? [[QP, 0.6], [INT, 0.2], [CHAOS, 0.2]]
      : [[QP, 0.6], [INT, 0.2], [DRIFT, 0.2]];
    let acc = 0;
    kind = ways[ways.length - 1][0];
    for (const [k, w] of ways) {
      acc += w;
      if (u < acc) {
        kind = k;
        break;
      }
    }
    if (kind === QP) retune(g);
    len = kind === QP ? 55 + floor(Math.random() * 75) : kind === INT ? 60 + floor(Math.random() * 55) : kind === CHAOS ? 45 + floor(Math.random() * 50) : 34 + floor(Math.random() * 30);
  }
  if (kind === CHAOS) g.jit = 0.16 + Math.random() * 0.26;
  if (kind === INT) {
    // Each intermittent stretch has its own laminar level, creep rate, ripple,
    // burst size and share of the oscillators underneath.
    g.x = 0.04 + Math.random() * 0.25;
    g.ic = 1 + Math.random() * 1.8;
    g.il = Math.random() < 0.5 ? 1 : -1;
    g.ir = 0.3 * Math.random();
    g.ib = 0.25 + Math.random() * 0.55;
    g.io = 0.5 * Math.random();
  }
  g.kind = kind;
  g.left = len;
  g.since = 0;
}

// New periods in samples, from a band for each oscillator and with ratios no
// small whole number reaches.
function retune(g) {
  const p1 = 8.5 + Math.random() * 10;
  g.per[0] = p1;
  g.per[1] = p1 * (1.47 + Math.random() * 0.33);
  g.per[2] = p1 * (0.5 + Math.random() * 0.2);
  // The periods also slide steadily over the stretch, up to a third longer or
  // shorter by its end, so the lines of recurrence fan out or draw together.
  g.chirp = (Math.random() - 0.5) * 0.0042;
}

function sample(g) {
  if (g.left <= 0) nextRegime(g);
  g.left--;
  g.since++;
  const n = ++g.n;
  const per = g.per, ph = g.ph;
  per[0] = cl(per[0] * (1 + g.chirp), 6, 24);
  per[1] = cl(per[1] * (1 + g.chirp), 9, 40);
  per[2] = cl(per[2] * (1 + g.chirp), 3, 17);
  // The periods wobble a little at rates that do not divide each other.
  ph[0] += TAU / (per[0] * (1 + 0.2 * sin(n * 0.0213 + 0.4)));
  ph[1] += TAU / (per[1] * (1 + 0.2 * sin(n * 0.0347 + 1.9)));
  ph[2] += TAU / (per[2] * (1 + 0.16 * sin(n * 0.0159 + 4.1)));
  // In a chaotic stretch each phase is also kicked at random, so a line of
  // recurrences breaks after about a dozen samples.
  if (g.kind === CHAOS) for (let i = 0; i < 3; i++) ph[i] += g.jit * gauss();
  // Amplitude and coupling breathe slowly. The second oscillator is phase
  // modulated by the first, so the pair is not a plain sum.
  const a2 = 0.62 + 0.3 * sin(n * 0.0459 + 1.1);
  const cpl = 0.6 + 0.5 * sin(n * 0.0710 + 2.3);
  const osc = 0.9 * (1.05 * sin(ph[0]) + a2 * 1.3 * sin(ph[1] + cpl * sin(ph[0])) + 0.22 * sin(ph[2]));
  let s;
  if (g.kind === QP || g.kind === CHAOS) {
    s = osc;
  } else if (g.kind === INT) {
    // Laminar phases creep away from the fixed point of x -> x + x^2 and a
    // burst ends each one, throwing x back near zero to start the next.
    let x = g.x + g.ic * g.x * g.x;
    if (x >= 1) x = 0.02 + Math.random() * 0.1;
    g.x = max(x, 0.02);
    s = g.il * 1.45 * (2 * g.x - 1) + g.ir * sin(ph[2]) + g.io * osc + (g.x > 0.4 ? g.ib * gauss() : 0);
  } else {
    // A drift: a velocity that is pulled back and kicked at random, summed
    // into a position that is pulled back more weakly, under a weaker
    // version of the oscillators, so the lines fade out towards the corners.
    if (g.since === 1) (g.s = 0), (g.v = 0);
    g.v += -0.12 * g.v + 0.05 * gauss();
    g.s += g.v - 0.06 * g.s;
    s = g.s + 0.6 * osc;
  }
  // The whole signal swells and shrinks over minutes, so the same threshold
  // catches more of it in a quiet stretch and less in a loud one.
  g.buf[n & MASK] = s * (1 + 0.3 * sin(n * 0.0147 + 0.8) + 0.15 * sin(n * 0.0331 + 2));
}

// ---- the picture ----------------------------------------------------------

function at(g, x) {
  const i = floor(x), f = x - i;
  return g.buf[i & MASK] * (1 - f) + g.buf[(i + 1) & MASK] * f;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0.3, 3), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  const rate = 5.5 * pow(2, (st.k[1] - 2) / 0.9);
  st.t += cl(dt || 0, 0, 0.1);
  st.acc += cl(dt || 0, 0, 0.1) * rate;
  while (st.acc >= 1) {
    st.acc -= 1;
    sample(st.g);
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const g = st.g, k = st.k, E = st.E, cell = st.cell, pal = st.pal, t = st.t;
  // The threshold and the teal breathe over a minute or two, at rates that do
  // not divide each other, so the same picture is never quite the same colour.
  const eps = 0.7 * pow(2.3, k[2]) * (1 + 0.18 * sin(t * 0.0517 + 1.3) + 0.1 * sin(t * 0.0911 + 4.4));
  const th = 0.5 + 0.035 * sin(t * 0.0731 + 0.6) + 0.015 * sin(t * 0.1213 + 2.9);
  const tau = max(0.3, 3.2 + 2.6 * k[3] + 0.6 * sin(t * 0.0553 + 2.1) + 0.35 * sin(t * 0.0937 + 5.2));
  const hue = k[0];
  // The delay embedding of the sample m: (s(m), s(m - tau), s(m - 2 tau)).
  for (let r = 0; r < RW; r++) {
    const m = g.n - 64 + r;
    E[r * 3] = at(g, m);
    E[r * 3 + 1] = at(g, m - tau);
    E[r * 3 + 2] = at(g, m - 2 * tau);
  }
  // The distance ramp, ink to sand in four tones. The dark tones keep to a hue
  // that stays clean when dark: blue at 0, violet, blue again, teal.
  const dh = 0.64 + 0.2 * sin(TAU * hue);
  hsv(dh, 0.85, 0.07, pal, 0);
  hsv(dh, 0.62, 0.20, pal, 3);
  hsv(dh, 0.50, 0.36, pal, 6);
  hsv(hue + 0.10, 0.32, 0.70, pal, 9);
  hsv(hue + 0.12, 0.14, 1.0, pal, 12); // the identity line, lit
  hsv(hue + th - 0.01, 0.92, 0.66, pal, 15); // recurrent, the lesser share
  hsv(hue + th, 0.55, 1.0, pal, 18); // recurrent, close
  // Every distance in the window, and the median of them, which sets the
  // scale of the ramp and of the threshold: a loud stretch and a quiet one
  // both fill the picture with the same share of every tone.
  const D = st.D, hist = st.hist;
  hist.fill(0);
  for (let r = 0; r < RW; r++) {
    for (let c = 0; c < CW; c++) {
      const a = r * 3, b = (c + 32) * 3;
      const dx = E[a] - E[b], dy = E[a + 1] - E[b + 1], dz = E[a + 2] - E[b + 2];
      const d = sqrt(dx * dx + dy * dy + dz * dz);
      D[r * CW + c] = d;
      hist[min(159, floor(d * 20))]++;
    }
  }
  // The median inside its bin, so the scale moves smoothly and no cell
  // blinks as it passes a tone edge.
  const half = RW * CW * 0.5;
  let acc = 0, bin = 0;
  while (bin < 159 && acc + hist[bin] < half) acc += hist[bin++];
  const med = (bin + (half - acc) / max(1, hist[bin])) / 20;
  const target = cl(med / 2.2, 0.5, 1.6);
  st.sc = st.sc ? st.sc + (target - st.sc) * 0.04 : target;
  // The tones round the teal keep their width when the threshold grows.
  const sc = st.sc, e1 = eps * sc, e0 = e1 * 0.5, t1 = max(1.15, eps + 0.45) * sc, t2 = t1 + 0.55 * sc, t3 = t2 + 0.5 * sc;
  for (let r = 0; r < RW; r++) {
    for (let c = 0; c < CW; c++) {
      const d = D[r * CW + c];
      let p;
      if (r - c === 32) p = 12;
      else if (d < e0) p = 18;
      else if (d < e1) p = 15;
      else p = d < t1 ? 9 : d < t2 ? 6 : d < t3 ? 3 : 0;
      const o = (r * CW + c) * 3;
      cell[o] = pal[p];
      cell[o + 1] = pal[p + 1];
      cell[o + 2] = pal[p + 2];
    }
  }
  // The matrix slides one cell down and across between two samples, and the
  // half way position is shifted by one LED.
  const off = st.acc >= 0.5 ? 1 : 0;
  for (let y = 0; y < H; y++) {
    const r = (y + off) >> 1;
    for (let x = 0; x < W; x++) {
      const o = (r * CW + ((x + off) >> 1)) * 3;
      display.setPixel(x, y, Math.round(cell[o] * 255), Math.round(cell[o + 1] * 255), Math.round(cell[o + 2] * 255));
    }
  }
}
