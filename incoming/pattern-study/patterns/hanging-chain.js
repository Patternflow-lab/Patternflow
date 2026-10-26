// ===== Patternflow pattern =====
// Title:   Hanging Chain
// Family:  physics
// Idea:    A chain of 32 beads hangs from the middle of the top row and swings in one of its first five normal modes, the J0 Bessel shapes Daniel Bernoulli found for it, while a fading long exposure behind it fills in the swept envelope with its pinched nodes at the heights the zeros of J0 predict, marked by small ticks.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: small oscillations of a hanging chain (Daniel Bernoulli, 1732), the first appearance of the Bessel function J0, taken up by Leonhard Euler (1781), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mode=1..5, Mix=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the chain is cyan with near-white beads, the exposure behind it blue violet and the node ticks pale yellow; at 0.25 the chain is violet over a pink exposure, at 0.5 red over lime, at 0.75 yellow green over teal. The dim exposure skips the orange and yellow part of the wheel, which reads brown and olive.
// Knob 2: Speed. At 2 the first mode swings once every 2.4 seconds, as a chain 2.1 m long would in real time, and the fifth once every 0.39 s; 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Mode. Which normal mode the chain is let go in, rounded to a whole number 1 to 5. Mode n has n - 1 nodes, at 19% of the way up from the free end for mode 2, at 8% and 41% for mode 3, and for mode 5 at 3%, 14%, 34% and 62%, and swings j(0,n) / j(0,1) times as often as the first: 2.296, 3.601, 4.910 and 6.222 times on these 32 beads, against 2.295, 3.599, 4.903 and 6.209 for the continuous chain.
// Knob 4: Mix. How much of the other four modes is let go with the chosen one. At 0 the chain holds one mode and the exposure settles into its clean envelope; at the opening 0.06 each other mode comes in at a tenth of the chosen one's swing at the free end and the chain shivers as it swings; at 1 all five come in equally and, since their frequencies are not in whole ratios, the chain's shape never repeats.
// Buttons: K1 tap lets the chain go again from its starting shape.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, round, abs, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The first five zeros of J0.
const J0Z = [2.404826, 5.520078, 8.653728, 11.791534, 14.930918];
// Beads, and where the chain hangs on the panel. The suspension is row 0
// and bead k hangs k links below it. With all the mass in the beads, the
// link above bead k carries the weight of the N - k + 1 beads below it,
// which is what a continuous chain carries at the middle of that link if
// its free end sits half a link below the last bead. So the continuous
// chain this one stands for is N + 1/2 links long, its free end at row 125.
const N = 32, YFREE = 125, LPX = YFREE / (N + 0.5);
const CX = 31.5, HALF = 29;
// Chain time is measured in units of sqrt(l / g), one link's own time.
// The first mode swings once every 29.8 units; RATE units a second at
// Speed 1 make that 2.4 s at Speed 2.
const RATE = 6.2;
// The leapfrog step, in chain units. The stiffest mode of 32 beads has
// omega near 11.3, so the step must stay below 2 / 11.3 = 0.18; at 0.03
// the energy stays within 3e-4 of where it started.
const HSTEP = 0.03;
// The exposure fades by e every TAU chain units, about one swing of the
// first mode.
const TAU = 30;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Tension in the link above bead k, in bead weights; zero below the last.
const T = (k) => (k <= N ? N - k + 1 : 0);
// Dim orange and yellow read brown and olive, so the exposure's wheel
// skips them.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

// The linearised bead chain is x'' = -K x with K tridiagonal:
//   (K x)_k = T_k (x_k - x_{k-1}) + T_{k+1} (x_k - x_{k+1}),  x_0 = 0.
// A mode with K v = lambda v is found by running that row from the free
// end upward with v_N = 1: the row for bead k gives v_{k-1}, and lambda is
// an eigenvalue when the value it gives at the suspension, v_0, is zero.
// This is Bernoulli's own way down the chain, link by link.
function upward(lam, v) {
  v[N] = 1;
  v[N - 1] = ((T(N) - lam) * v[N]) / T(N);
  for (let k = N - 1; k >= 1; k--) v[k - 1] = ((T(k) + T(k + 1) - lam) * v[k] - T(k + 1) * v[k + 1]) / T(k);
  return v[0];
}
function modes() {
  const out = [], v = new Float64Array(N + 1);
  let lam = 1e-4, f = upward(lam, v);
  while (out.length < 5) {
    const next = lam + 0.002, g = upward(next, v);
    if (f * g < 0) {
      let lo = lam, hi = next;
      for (let i = 0; i < 50; i++) {
        const m = (lo + hi) / 2;
        if (upward(m, v) * upward(lo, v) <= 0) hi = m;
        else lo = m;
      }
      upward((lo + hi) / 2, v);
      v[0] = 0;
      out.push({ lam: (lo + hi) / 2, v: Float64Array.from(v) });
    }
    (lam = next), (f = g);
  }
  return out;
}

export function setup(params) {
  params.s = {
    modes: modes(),
    x: new Float64Array(N + 2), p: new Float64Array(N + 2), a: new Float64Array(N + 2),
    row: new Float32Array(H), prev: new Float32Array(H),
    E: new Float32Array(W * H), scale: HALF,
    hue: 0, speed: 2, mode: 1, mix: 0.06, key: "", warm: false, t: 0,
    col: new Float32Array(15),
  };
}

function accel(S) {
  const { x, a } = S;
  for (let k = 1; k <= N; k++) a[k] = -T(k) * (x[k] - x[k - 1]) + T(k + 1) * (x[k + 1] - x[k]);
}

// Let go from rest in the chosen mode plus Mix of each other one. Every
// mode is 1 at the free end and no more than 1 anywhere, so at the moment
// of release the free end is out by the sum of the weights, which is put
// at HALF LEDs from the plumb line.
function release(S) {
  const { x, p } = S, w = S.modes.map((_, i) => (i === S.mode - 1 ? 1 : 0.25 * sqrt(S.mix) + 0.75 * S.mix));
  const sum = w.reduce((u, v) => u + v, 0);
  S.scale = HALF / sum;
  x.fill(0);
  p.fill(0);
  S.modes.forEach((m, i) => {
    for (let k = 1; k <= N; k++) x[k] += w[i] * m.v[k];
  });
  accel(S);
  S.t = 0;
  rows(S, S.prev);
}

// Where the chain crosses each row, in LEDs from the plumb line: straight
// links between the beads, so the chain is a function of height.
function rows(S, out) {
  const { x } = S;
  for (let y = 0; y < H; y++) {
    const u = min(y / LPX, N), k = min(floor(u), N - 1), f = u - k;
    out[y] = S.scale * (x[k] * (1 - f) + x[k + 1] * f);
  }
}

// Velocity Verlet, the leapfrog: symplectic, so the energy wobbles at the
// size of the step squared and does not drift. After each step the chain's
// crossing of each row moved from prev to row, and the exposure gets the
// time the chain spent over each LED it passed: the step over the LEDs
// crossed, so the turning points, where the chain lingers, burn brightest.
function step(S, span) {
  const n = max(1, ceil(span / HSTEP)), h = span / n, { x, p, a, row, prev, E } = S;
  const fade = exp(-span / TAU);
  for (let i = 0; i < E.length; i++) E[i] *= fade;
  for (let s = 0; s < n; s++) {
    for (let k = 1; k <= N; k++) p[k] += 0.5 * h * a[k];
    for (let k = 1; k <= N; k++) x[k] += h * p[k];
    accel(S);
    for (let k = 1; k <= N; k++) p[k] += 0.5 * h * a[k];
    rows(S, row);
    const top = min(H - 1, floor(N * LPX));
    for (let y = 0; y <= top; y++) {
      const a0 = CX + min(prev[y], row[y]), a1 = CX + max(prev[y], row[y]);
      const i0 = cl(floor(a0), 0, W - 1), i1 = cl(floor(a1), 0, W - 1), wgt = h / (i1 - i0 + 1);
      for (let i = i0; i <= i1; i++) E[y * W + i] += wgt;
      prev[y] = row[y];
    }
  }
  S.t += span;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.mode = cl(round(k[2]), 1, 5);
  S.mix = cl(k[3], 0, 1);
  // A new mode or mix lets the chain go again; the old exposure fades out.
  const key = S.mode + ":" + S.mix.toFixed(3);
  if (key !== S.key || (input.btnPressed && input.btnPressed[0])) {
    S.key = key;
    release(S);
  }
  if (!S.warm) {
    // Open on a chain that has been swinging for a second and a half.
    for (let i = 0; i < 45; i++) step(S, (2 * RATE) / 30);
    S.warm = true;
  }
  step(S, d * S.speed * RATE);
}

function put(display, x, y, c, o, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  display.setPixel(x, y, round(c[o] * v), round(c[o + 1] * v), round(c[o + 2] * v));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.col, h = S.hue;
  hsv(wheel(h + 0.78), 0.75, 1, c, 0); // exposure
  hsv(h + 0.52, 0.85, 1, c, 3); // links
  hsv(h + 0.52, 0.25, 1, c, 6); // beads
  hsv(h + 0.15, 0.45, 1, c, 9); // node ticks
  hsv(h + 0.6, 0.3, 1, c, 12); // plumb line and suspension
  const { E, row, x } = S, bead = N * LPX;
  // The rest position, a dotted plumb line, and the ticks where mode n's
  // nodes fall on the continuous chain: J0(j_n sqrt(s / L)) = 0 at
  // s / L = (j_m / j_n)^2 for each zero j_m below j_n.
  const tick = new Uint8Array(H), n = S.mode;
  for (let m = 0; m < n - 1; m++) tick[round(YFREE * (1 - (J0Z[m] / J0Z[n - 1]) ** 2))] = 1;
  for (let y = 0; y < H; y++)
    for (let xx = 0; xx < W; xx++) {
      // The exposure, toned so a wide swing still reads and a narrow one
      // does not burn out.
      const e = E[y * W + xx], b = e > 0 ? 1 - exp(-e / 1.1) : 0;
      let v = 150 * b, o = 0;
      if (xx === 31 && (y & 1) === 0 && y <= bead + 1 && v < 46) (v = 46), (o = 12);
      if (tick[y] && abs(xx - CX) > 2 && abs(xx - CX) < 6) (v = max(v, 150)), (o = 9);
      if (tick[y] && (xx < 3 || xx > W - 4)) (v = 150), (o = 9);
      if (y === 0 && abs(xx - CX) < 5) (v = 200), (o = 12);
      put(display, xx, y, c, o, v);
    }
  // The links, a line one LED wide down the chain's crossing of each row,
  // stretched across the row where the chain leans.
  const top = min(H - 1, floor(bead));
  for (let y = 0; y <= top; y++) {
    const up = y > 0 ? (row[y - 1] + row[y]) / 2 : row[0], dn = y < top ? (row[y] + row[y + 1]) / 2 : row[y];
    const lo = CX + min(up, dn) - 0.5, hi = CX + max(up, dn) + 0.5;
    for (let i = floor(lo); i <= floor(hi); i++) {
      const cover = min(hi, i + 1) - max(lo, i);
      if (cover > 0.05) put(display, i, y, c, 3, 80 + 140 * min(1, cover));
    }
  }
  // The beads, small round dots brighter than the links.
  for (let k = 1; k <= N; k++) {
    const bx = CX + S.scale * x[k], by = k * LPX;
    for (let yy = floor(by) - 1; yy <= floor(by) + 2; yy++)
      for (let xx = floor(bx) - 1; xx <= floor(bx) + 2; xx++) {
        const dx = xx + 0.5 - bx, dy = yy + 0.5 - by, w = cl(1.9 - sqrt(dx * dx + dy * dy), 0, 1);
        if (w > 0.1) put(display, xx, yy, c, 6, 120 + 135 * w);
      }
  }
}
