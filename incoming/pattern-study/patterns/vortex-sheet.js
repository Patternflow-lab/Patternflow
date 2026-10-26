// ===== Patternflow pattern =====
// Title:   Vortex Sheet
// Family:  sim
// Idea:    A vortex sheet runs up the panel between a stream flowing down on its left and one flowing up on its right, and a small ripple on it grows and rolls up into a double-branched spiral that winds the two fluids into each other in thinner and thinner layers.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kelvin-Helmholtz instability of a vortex sheet (Hermann von Helmholtz, 1868; Lord Kelvin, 1871), computed past Moore's curvature singularity (Derek Moore, 1979) with Robert Krasny's vortex-blob method (1986), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Blob=0.15..0.5, Waves=1..4
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the left stream is dark teal with azure tracers, the right one dark violet with magenta tracers, and the sheet pale lavender; at 0.25 indigo and maroon with a pink sheet; at 0.5 maroon and green with a pale yellow one. The dark streams skip the orange and yellow part of the wheel, which reads brown and olive when dim.
// Knob 2: Speed. At 2 each stream runs 22 LEDs a second at one wave on the panel, the ripple grows by e every 1.1 seconds at the opening Blob, and a fresh sheet starts every 8.6 seconds. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Blob. Krasny's delta, how far each point vortex of the sheet is smoothed, from 0.15 to 0.5. A smaller blob grows the ripple faster and winds the spiral tighter: the ripple grows at 2.64 a unit of time at 0.15, 2.34 at 0.25 and 1.72 at 0.5, against pi for the bare sheet, and 8 seconds into a sheet the row through the core crosses it 25 times at 0.15, 19 at 0.25, 13 at 0.35 and 9 at 0.5. Below 0.15 the 340 points could no longer hold the core and the sheet frayed.
// Knob 4: Waves. How many wavelengths of the sheet stand on the panel, 1 to 4: one period is 128, 64, 43 or 32 LEDs tall, and each rolls up into its own spiral, so 1 opens on one spiral 62 LEDs wide by 8 seconds and 4 makes a chain of four small ones. The sheet is computed over one period and repeated, so four cost what one does.
// Buttons: K1 tap starts a fresh sheet with a new ripple.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, sin, cos, exp, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Sheet time units per second at Speed 1. In one unit the far streams
// slide one wavelength past each other, half a wavelength each way.
const RATE = 0.175;
// Points on a fresh sheet, the most it may grow to, and the widest gap
// (in wavelengths) before a point is put in between. 340 points keep a
// frame near 2 ms; at the opening Blob a sheet has them all after about 3.5
// seconds, and the core goes on winding with the points it has.
const N0 = 96, NMAX = 340, GAP = 0.015;
// A sheet is started again at this age, when the core has wound into a
// disc the LEDs no longer part.
const AGE = 3.0;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim orange and yellow read brown and olive, so the streams' hue wheel
// skips 0.03..0.18 and runs the rest a little faster.
const dimHue = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

export function setup(params) {
  const M = NMAX + 8;
  params.s = {
    n: 0, x: new Float64Array(M), y: new Float64Array(M), g: new Float64Array(M), w: new Float64Array(M),
    // RK4 stages, and the trig of each point packed for the kernel.
    k: Array.from({ length: 8 }, () => new Float64Array(M)), x0: new Float64Array(M), y0: new Float64Array(M),
    pk: new Float64Array(M * 5),
    tx: new Float64Array(600), ty: new Float64Array(600), nt: 0, tWaves: 0,
    tu: new Float64Array(600), tv: new Float64Array(600),
    t: 0, born: false, hue: 0, speed: 2, delta: 0.15, waves: 1,
    side: new Uint8Array(NP), flip: new Int16Array((W + 2) * H), rgb: new Float32Array(NP * 3), old: new Float32Array(NP * 3), fade: 0,
    pal: new Float32Array(24), palHue: -1,
  };
}

// A fresh sheet: Krasny's ripple x = G + a sin 2 pi G, y = -a sin 2 pi G,
// with a random phase and size, so each roll-up stands at its own height
// and comes a little sooner or later. A second harmonic was tried for
// variety; below Blob 0.25 it rolled up into a second small spiral that
// tangled with the first.
function start(S) {
  const R = Math.random, a = 0.035 + 0.02 * R(), ph = R();
  S.n = N0;
  for (let i = 0; i < N0; i++) {
    const G = i / N0, e = a * sin(TAU * (G + ph));
    S.g[i] = G;
    S.x[i] = G + e;
    S.y[i] = -e;
  }
  S.t = 0;
  S.nt = 0;
}

// Circulation carried by each point: half the gap in G to each neighbour.
function weights(S) {
  const { n, g, w } = S;
  for (let i = 0; i < n; i++) {
    const a = i ? g[i - 1] : g[n - 1] - 1, b = i + 1 < n ? g[i + 1] : g[0] + 1;
    w[i] = (b - a) / 2;
  }
}

// The blob kernel for one period of the sheet, with total circulation 1:
//   u_i = -1/2 sum w_j sinh 2pi(y_i - y_j) / D,  v_i = 1/2 sum w_j sin 2pi(x_i - x_j) / D,
//   D = cosh 2pi(y_i - y_j) - cos 2pi(x_i - x_j) + delta^2.
// The differences come from products of each point's own trig, packed five
// numbers a point with its weight, and each pair is visited once since the
// kernel is odd.
function pack(S, X, Y) {
  const { n, w, pk } = S;
  for (let i = 0, o = 0; i < n; i++, o += 5) {
    const a = TAU * X[i], e = exp(TAU * Y[i]), ie = 1 / e;
    pk[o] = cos(a);
    pk[o + 1] = sin(a);
    pk[o + 2] = (e + ie) / 2;
    pk[o + 3] = (e - ie) / 2;
    pk[o + 4] = w[i];
  }
}
function velocity(S, X, Y, U, V) {
  const { n, pk } = S, d2 = S.delta * S.delta;
  pack(S, X, Y);
  U.fill(0, 0, n);
  V.fill(0, 0, n);
  for (let i = 0, oi = 0; i < n; i++, oi += 5) {
    const ci = pk[oi], si = pk[oi + 1], hi = pk[oi + 2], gi = pk[oi + 3], wi = pk[oi + 4];
    let ui = 0, vi = 0;
    for (let j = i + 1, o = oi + 5; j < n; j++, o += 5) {
      const cj = pk[o], sj = pk[o + 1], hj = pk[o + 2], gj = pk[o + 3], wj = pk[o + 4];
      const q = 0.5 / (hi * hj - gi * gj - ci * cj - si * sj + d2), fu = (gi * hj - hi * gj) * q, fv = (si * cj - ci * sj) * q;
      ui -= wj * fu;
      vi += wj * fv;
      U[j] += wi * fu;
      V[j] -= wi * fv;
    }
    U[i] += ui;
    V[i] += vi;
  }
}

function rk4(S, h) {
  const { n, x, y, x0, y0, k } = S;
  for (let i = 0; i < n; i++) (x0[i] = x[i]), (y0[i] = y[i]);
  const cs = [0, 0.5, 0.5, 1];
  for (let st = 0; st < 4; st++) {
    if (st) for (let i = 0; i < n; i++) (x[i] = x0[i] + cs[st] * h * k[2 * st - 2][i]), (y[i] = y0[i] + cs[st] * h * k[2 * st - 1][i]);
    velocity(S, x, y, k[2 * st], k[2 * st + 1]);
  }
  for (let i = 0; i < n; i++) {
    x[i] = x0[i] + (h / 6) * (k[0][i] + 2 * k[2][i] + 2 * k[4][i] + k[6][i]);
    y[i] = y0[i] + (h / 6) * (k[1][i] + 2 * k[3][i] + 2 * k[5][i] + k[7][i]);
  }
}

// Where a gap has opened wider than GAP, a point goes in at the middle G,
// placed on the cubic through the four points around it. The points run
// once round the period in order of G; the one after the last is the
// first moved on by a whole period, so a point that goes in there is
// simply added at the end.
function refine(S) {
  const { x, y, g } = S;
  const at = (q, o) => {
    const n = S.n, f = floor(q / n), m = q - f * n;
    o[0] = x[m] + f;
    o[1] = y[m];
    o[2] = g[m] + f;
  };
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], e = [0, 0, 0];
  for (let i = 0; i < S.n && S.n < NMAX; i++) {
    at(i, b);
    at(i + 1, c);
    const dx = c[0] - b[0], dy = c[1] - b[1];
    if (dx * dx + dy * dy < GAP * GAP) continue;
    at(i - 1, a);
    at(i + 2, e);
    const n = S.n;
    for (let m = n; m > i + 1; m--) (x[m] = x[m - 1]), (y[m] = y[m - 1]), (g[m] = g[m - 1]);
    x[i + 1] = (-a[0] + 9 * b[0] + 9 * c[0] - e[0]) / 16;
    y[i + 1] = (-a[1] + 9 * b[1] + 9 * c[1] - e[1]) / 16;
    g[i + 1] = (b[2] + c[2]) / 2;
    S.n++;
    i++;
  }
}

// Tracers: dots laid on a grid of the period, moved by the sheet's own
// velocity, so the two streams and the winding read away from the sheet.
function seedTracers(S) {
  const sc = H / S.waves, rows = max(2, round(sc / 6)), cols = 11;
  S.nt = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (S.nt >= 600) break;
      S.tx[S.nt] = (r + 0.5) / rows;
      S.ty[S.nt] = ((c + 0.5) / cols - 0.5) * (W / sc);
      S.nt++;
    }
  S.tWaves = S.waves;
}

// Tracers feel every other point of the sheet, each carrying the
// circulation of two: they only have to read the streams, and it halves
// their cost.
function tracerVel(S, TX, TY, n, U, V) {
  const { pk } = S, d2 = S.delta * S.delta, np = S.n;
  for (let i = 0; i < n; i++) {
    const a = TAU * TX[i], e = exp(TAU * TY[i]), ie = 1 / e;
    const ci = cos(a), si = sin(a), hi = (e + ie) / 2, gi = (e - ie) / 2;
    let u = 0, v = 0;
    for (let j = 0, o = 0; j + 1 < np; j += 2, o += 10) {
      const cj = pk[o], sj = pk[o + 1], hj = pk[o + 2], gj = pk[o + 3];
      const q = (0.5 * (pk[o + 4] + pk[o + 9])) / (hi * hj - gi * gj - ci * cj - si * sj + d2);
      u -= (gi * hj - hi * gj) * q;
      v += (si * cj - ci * sj) * q;
    }
    U[i] = u;
    V[i] = v;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.15, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.delta = cl(kv[2], 0.15, 0.5);
  S.waves = cl(round(kv[3]), 1, 4);
  const tap = input.btnPressed && input.btnPressed[0];
  if (!S.born || tap || S.t > AGE) {
    if (S.born) S.fade = 1;
    start(S);
    S.born = true;
  }
  if (S.tWaves !== S.waves || !S.nt) seedTracers(S);
  S.fade = max(0, S.fade - d * 2);
  // A point at the core's centre turns at up to pi / delta^2 radians a unit
  // of time if all the circulation sat in its blob, and about half does.
  // Steps are cut so RK4 turns it under 2.5 radians, inside its stable 2.8;
  // at Speed 3 that is one step a frame, and a run with four times the
  // steps put every point within 0.05 LED of it after 2.6 units.
  const h = d * S.speed * RATE, sub = Math.ceil(h / (2.5 / (PI / (2 * S.delta * S.delta))));
  for (let k = 0; k < sub; k++) {
    weights(S);
    rk4(S, h / sub);
    S.t += h / sub;
    refine(S);
  }
  // Tracers take one step with the sheet where it now is.
  weights(S);
  pack(S, S.x, S.y);
  const nt = S.nt, TX = S.tx, TY = S.ty, TU = S.tu, TV = S.tv;
  tracerVel(S, TX, TY, nt, TU, TV);
  for (let i = 0; i < nt; i++) {
    TX[i] += h * TU[i];
    TY[i] += h * TV[i];
    TX[i] -= floor(TX[i]);
  }
}

function palette(S) {
  const P = S.pal, h = 0.55 + S.hue;
  hsv(dimHue(h), 0.8, 0.26, P, 0); // left fluid
  hsv(dimHue(h + 0.3), 0.8, 0.26, P, 3); // right fluid
  hsv(h, 0.6, 0.75, P, 6); // left tracers
  hsv(h + 0.3, 0.6, 0.75, P, 9); // right tracers
  hsv(h + 0.15, 0.3, 0.95, P, 12); // sheet
  S.palHue = S.hue;
}

// Points laid along a line every third of an LED, each lighting its four
// nearest LEDs by how close it falls; an LED keeps the brightest.
function plot(S, x, y, P, o, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy, rgb = S.rgb;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const k = min(1, (dx ? tx : 1 - tx) * wy * 1.7) * a, p = (yy * W + xx) * 3;
      if (rgb[p] < P[o] * k) rgb[p] = P[o] * k;
      if (rgb[p + 1] < P[o + 1] * k) rgb[p + 1] = P[o + 1] * k;
      if (rgb[p + 2] < P[o + 2] * k) rgb[p + 2] = P[o + 2] * k;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  if (S.palHue !== S.hue) palette(S);
  const { x, y, n, rgb, flip } = S, P = S.pal;
  const sc = H / S.waves, ox = W / 2;
  const PX = (Y) => ox + Y * sc, PY = (X, k) => (X + k) * sc;
  // Which fluid each LED holds: the crossings of the sheet to its left,
  // counted row by row. The sheet spans every row, so the far left is
  // always the left stream.
  flip.fill(0);
  for (let k = -1; k <= S.waves; k++)
    for (let i = 0; i < n; i++) {
      const j = i + 1 < n ? i + 1 : 0, wrap = j === 0 ? 1 : 0;
      const ya = PY(x[i], k), yb = PY(x[j] + wrap, k), xa = PX(y[i]), xb = PX(y[j]);
      const lo = Math.ceil(min(ya, yb) - 0.5), hi = Math.ceil(max(ya, yb) - 0.5);
      for (let r = max(0, lo); r < min(H, hi); r++) {
        const f = (r + 0.5 - ya) / (yb - ya), xc = xa + f * (xb - xa);
        flip[r * (W + 2) + cl(Math.ceil(xc - 0.5), 0, W)] ^= 1;
      }
    }
  for (let r = 0; r < H; r++) {
    let par = 0;
    for (let c = 0; c < W; c++) {
      par ^= flip[r * (W + 2) + c];
      const p = (r * W + c) * 3, o = par ? 3 : 0;
      rgb[p] = P[o];
      rgb[p + 1] = P[o + 1];
      rgb[p + 2] = P[o + 2];
      S.side[r * W + c] = par;
    }
  }
  // Tracers, in the colour of the fluid they are in now, each with a streak
  // of where it was a tenth of a second ago.
  const back = 0.1 * S.speed * RATE;
  for (let k = -1; k <= S.waves; k++)
    for (let i = 0; i < S.nt; i++) {
      const px = PX(S.ty[i]), py = PY(S.tx[i], k);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const o = S.side[floor(py) * W + floor(px)] ? 9 : 6, ex = S.tv[i] * back * sc, ey = S.tu[i] * back * sc;
      for (let e = 3; e >= 0; e--) plot(S, px - (ex * e) / 3, py - (ey * e) / 3, P, o, 1 - e * 0.22);
    }
  // The sheet on top.
  for (let k = -1; k <= S.waves; k++)
    for (let i = 0; i < n; i++) {
      const j = i + 1 < n ? i + 1 : 0, wrap = j === 0 ? 1 : 0;
      const xa = PX(y[i]), ya = PY(x[i], k), xb = PX(y[j]), yb = PY(x[j] + wrap, k);
      if ((ya < -2 && yb < -2) || (ya > H + 2 && yb > H + 2)) continue;
      const m = Math.ceil(Math.hypot(xb - xa, yb - ya) * 3) || 1;
      for (let e = 0; e <= m; e++) plot(S, xa + ((xb - xa) * e) / m, ya + ((yb - ya) * e) / m, P, 12, 1);
    }
  const f = S.fade, old = S.old;
  for (let r = 0, p = 0; r < H; r++)
    for (let c = 0; c < W; c++, p += 3) {
      let R = rgb[p], G = rgb[p + 1], B = rgb[p + 2];
      if (f > 0) (R = R * (1 - f) + old[p] * f), (G = G * (1 - f) + old[p + 1] * f), (B = B * (1 - f) + old[p + 2] * f);
      else (old[p] = R), (old[p + 1] = G), (old[p + 2] = B);
      display.setPixel(c, r, (255 * min(1, R)) | 0, (255 * min(1, G)) | 0, (255 * min(1, B)) | 0);
    }
}
