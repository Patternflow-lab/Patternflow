// ===== Patternflow pattern =====
// Title:   Bloch Oscillations
// Family:  wave
// Idea:    A quantum particle on a chain of sites laid across the panel feels a steady force along the chain, and with time running down the scrolling panel it never slides away: started on one site it breathes out into a lens of Bessel fringes 50 sites wide and back to a point once every Bloch period, a broad packet swings from side to side instead, and the hue gives the quasi-momentum, which the force winds steadily through the band.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bloch oscillations (Felix Bloch, 1929; Clarence Zener, 1934) and the Wannier-Stark ladder (Gregory Wannier, 1960), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Force=0.16..0.64, Width=0..1
//
// Knob 1: Hue. Turns the wheel the quasi-momentum k is read on, k being the phase step from each site to the next. At 0 the bottom of the band (k = 0) is azure, a packet moving right at full speed (k = pi/2) violet, one moving left (k = -pi/2) green, and the top of the band (k = pi), where a broad packet is Bragg-reflected and turns back, red; orange takes a narrower slice of k than the other colours. The lens from one site opens violet on its right edge and lime on its left, and as the force winds k down, the right edge turns through blue to azure and the left edge through red to pink.
// Knob 2: Speed. How fast the carpet climbs: one row is 0.75 in units of hbar / J. At 2 sixteen rows a second, so one Bloch period at the opening Force passes in 3.3 s; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Force. F in units of J per site, 0.16 to 0.64. The Bloch period 2 pi / F is 52 rows at 0.16, 26 at 0.32 and 13 at 0.64, and the lens from one site opens to 4J/F either side, 25, 12.5 and 6.3 sites, which is 57, 31 and 17 lit LEDs at its widest. A broad packet swings 24.9, 12.4 and 6.2 sites from side to side, against 4J/F. Turning it mid-run changes the field from the next row on; if more than half the particle has swung off the panel it starts again in the middle.
// Knob 4: Width. The starting packet. Up to 0.1 a single site, and the rows are J_n(4J/F sin(Ft/2))^2 to within 3e-8 of the closed form; above, a Gaussian of width 6 u^2 sites (u from 0 at 0.1 to 1 at 1) moving right at k = pi/2. At 0.3 (0.3 sites) the lens keeps its fringes; at 0.4 (0.7 sites) they are gone and a bright violet edge, the part moving right, runs down the lens from upper left to lower right; at 0.5 (1.2 sites) the lens has become one band swinging in an S, 25 sites peak to peak at the opening Force, and at 1 (6 sites) the band is 38 LEDs wide. Each turn starts the packet again.

const W = 64, H = 128;
// Sites on the chain, and the one under the panel's middle. The panel
// shows sites C - 32 to C + 31; the chain runs 64 further each way, past
// any swing the knobs allow, so its ends are never reached.
const NS = 192, C = 96;
// Time per row in units of hbar / J, cut into SUB exact steps; the row
// shows the probability averaged over them.
const TROW = 0.75, SUB = 4, DT = TROW / SUB;
// Rows per second at Speed 1.
const RATE = 8;
// Bessel orders kept in one step: J_m(2 dt) for m > MB is below 1e-12.
const MB = 10;
// Brightness from the probability on a log scale: 10^LMIN is dark, 10^(LMIN + LSPAN) full.
const LMIN = -3.2, LSPAN = 2.4;
const { floor, min, max, abs, sin, cos, sqrt, exp, round, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, F: 0.16, wid: 0, begun: false,
    re: new Float64Array(NS), im: new Float64Array(NS), nr: new Float64Array(NS), ni: new Float64Array(NS),
    // The step's kernel: Re and Im of i^m J_m(a) e^{-i m F dt / 2}, m = -MB..MB.
    kr: new Float64Array(2 * MB + 1), ki: new Float64Array(2 * MB + 1), kF: -1,
    // The last 128 rows: probability and phase per site, newest at head - 1.
    rho: new Float32Array(W * H), ph: new Float32Array(W * H), head: 0, prog: 0, launched: 0,
    acc: new Float64Array(W), rgb: new Float32Array(W * H * 3),
  };
}

// J_0..J_MB at a small argument, by the power series.
function besselSmall(a, out) {
  for (let m = 0; m <= MB; m++) {
    let term = (a / 2) ** m, s = 0;
    for (let k = 1; k <= m; k++) term /= k;
    for (let k = 0; k < 20; k++) {
      s += term;
      term *= -((a / 2) ** 2) / ((k + 1) * (k + 1 + m));
    }
    out[m] = s;
  }
}

// The exact propagator of the tilted chain over one step dt, found by
// taking out the phase e^{-i F n t} and summing the hopping in momentum
// space with the Jacobi-Anger expansion. With
// H = -J sum (|n><n+1| + h.c.) + F sum n |n><n| and J = 1,
//   psi_n(t + dt) = e^{-i F n dt} sum_m i^m J_m(a) e^{-i m F dt / 2} psi_{n+m}(t),
//   a = (4J / F) sin(F dt / 2).
// The site index n is counted from C.
function kernel(S) {
  const F = S.F, a = (4 / F) * sin((F * DT) / 2), b = new Float64Array(MB + 1);
  besselSmall(a, b);
  for (let m = -MB; m <= MB; m++) {
    const Jm = m >= 0 ? b[m] : m & 1 ? -b[-m] : b[-m], p = m * (PI / 2 - (F * DT) / 2);
    S.kr[m + MB] = Jm * cos(p);
    S.ki[m + MB] = Jm * sin(p);
  }
  S.kF = F;
}

function step(S) {
  if (S.kF !== S.F) kernel(S);
  const { re, im, nr, ni, kr, ki } = S, F = S.F;
  for (let n = 0; n < NS; n++) {
    let sr = 0, si = 0;
    const lo = max(-MB, -n), hi = min(MB, NS - 1 - n);
    for (let m = lo; m <= hi; m++) {
      const a = kr[m + MB], b = ki[m + MB], x = re[n + m], y = im[n + m];
      sr += a * x - b * y;
      si += a * y + b * x;
    }
    const p = -F * (n - C) * DT, c = cos(p), s = sin(p);
    nr[n] = sr * c - si * s;
    ni[n] = sr * s + si * c;
  }
  re.set(nr);
  im.set(ni);
}

// A packet on the middle site: a Gaussian of width sigma (one site at 0)
// with momentum pi / 2, so a broad one starts at full speed to the right
// and swings evenly about the middle.
function launch(S) {
  const sg = S.wid, { re, im } = S;
  let nrm = 0;
  for (let n = 0; n < NS; n++) {
    const x = n - C, g = sg > 0 ? exp(-(x * x) / (4 * sg * sg)) : x === 0 ? 1 : 0;
    re[n] = g * cos((PI / 2) * x);
    im[n] = g * sin((PI / 2) * x);
    nrm += g * g;
  }
  nrm = 1 / sqrt(nrm);
  for (let n = 0; n < NS; n++) (re[n] *= nrm), (im[n] *= nrm);
  S.launched = S.wid;
}

// One row: SUB steps, probability averaged over them, phase at the last.
function row(S) {
  const { acc, re, im } = S;
  acc.fill(0);
  for (let k = 0; k < SUB; k++) {
    step(S);
    for (let x = 0; x < W; x++) {
      const n = C - 32 + x;
      acc[x] += (re[n] * re[n] + im[n] * im[n]) / SUB;
    }
  }
  // Half the probability left the panel after a turn of Force mid-swing:
  // start again from the middle.
  let on = 0;
  for (let x = 0; x < W; x++) on += acc[x];
  if (on < 0.5) launch(S);
  const o = S.head * W;
  for (let x = 0; x < W; x++) {
    const n = C - 32 + x;
    S.rho[o + x] = acc[x];
    // The local quasi-momentum, the phase step from this site to the next.
    S.ph[o + x] = atan2(re[n] * im[n + 1] - im[n] * re[n + 1], re[n] * re[n + 1] + im[n] * im[n + 1]);
  }
  S.head = (S.head + 1) % H;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.16, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.F = cl(k[2], 0.16, 0.64);
  // Width: one site up to 0.1, then sigma = 6 u^2 sites, so the turn from
  // breathing to swinging (sigma 0.5 to 2) gets the first half of the knob.
  const u = max(0, (cl(k[3], 0, 1) - 0.1) / 0.9);
  S.wid = 6 * u * u;
  if (!S.begun) {
    launch(S);
    for (let r = 0; r < H; r++) row(S);
    S.begun = true;
  }
  if (abs(S.wid - S.launched) > 1e-6) launch(S);
  S.prog += d * S.speed * RATE;
  while (S.prog >= 1) {
    S.prog -= 1;
    row(S);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rho, ph, rgb } = S, hb = 0.55 + S.hue;
  for (let y = 0; y < H; y++) {
    const r = (S.head + y) % H;
    for (let x = 0; x < W; x++) {
      const p = r * W + x, o = (y * W + x) * 3;
      const L = cl((Math.log10(rho[p] + 1e-12) - LMIN) / LSPAN, 0, 1);
      if (L <= 0) {
        rgb[o] = rgb[o + 1] = rgb[o + 2] = 0;
        continue;
      }
      // k round the wheel, with orange given a narrower slice of it. Dim
      // orange and yellow read brown and olive, so there they are lifted
      // and paled toward peach and butter.
      const u = hb + ph[p] / (2 * PI), h = u + 0.07 * sin(2 * PI * (u - 0.11));
      const wm = cl(1 - abs(h - floor(h) - 0.12) / 0.1, 0, 1);
      hsv(h, (0.85 - 0.45 * L * L) * (1 - 0.3 * wm), min(1, (0.06 + 0.94 * L) * (1 + 0.35 * wm)), rgb, o);
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(255 * rgb[o]), round(255 * rgb[o + 1]), round(255 * rgb[o + 2]));
}
