// ===== Patternflow pattern =====
// Title:   Gibbs Phenomenon
// Family:  wave
// Idea:    One period of a square wave runs across the panel and its Fourier partial sums run down it, from one term at the top to 32 at the bottom, and wherever a sum climbs past the wave it is trying to draw it burns white-gold: two horns beside each jump that press closer to the jump with every row and never get any lower, 8.95% of the jump however many terms are added.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gibbs phenomenon (Henry Wilbraham, 1848; J. Willard Gibbs, 1899), with Fejér's means (Lipót Fejér, 1900), pattern round 36
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..1, Fejer=0..1
//
// Knob 1: Hue. Turns the two halves round the wheel together; the horns stay white-gold. At 0 the positive half is azure and the negative half violet; at 0.25 violet and amber, at 0.5 amber and green, at 0.75 green and azure. A half that comes round to orange or yellow is lifted up to 1.8 times and paled a little, so it does not go brown or olive.
// Knob 2: Speed. How fast the wave slides sideways. At 2 one period passes in 16 seconds, four LEDs a second; at 0.2 in 157 seconds, at 3 in 10.5. The rows hold still: row r always sums 32^(r/127) terms, so the count doubles every 25 rows.
// Knob 3: Shape. Square wave at 0, sawtooth at 0.5, triangle at 1, and blends between. At 0 two jumps and four horns; on the way to 0.5 the upward jump smooths into the sawtooth's ramp and its two horns fade, leaving the downward jump and its two; past 0.5 that jump shrinks too, its horns always 8.95% of what is left of it, until the triangle at 1 has no jump and no horn.
// Knob 4: Fejer. Blends each partial sum toward Fejér's mean, the average of all the partial sums up to it. Up to 0.06 the plain sums, horns 8.95% of the jump; at 0.25 8.1%; at 0.5 4.6%; from 0.75 none; at 1 the means alone, which never leave the range of the wave, and the fringes beside the jumps are gone too.
// Buttons: K1 tap races the bottom row from 32 terms to 256 and back over six seconds, the rows above scaling with it, and draws the bottom row's sum as a white graph over the top 48 rows with gold rulers 8.95% of the jump past the wave: the horns press into the jumps and their spikes keep touching the rulers.

const W = 64, H = 128, NMAX = 32, RACE = 8;
// Subsamples per column: four, and 24 in a column within one LED of a jump.
const SS = 4, SSJ = 24;
// How far either side of a point the wave's own range is read, in radians:
// a sum is past the wave where it leaves [min, max] of the wave over x +- DEL.
const DEL = 0.12;
// The limit of the overshoot: (1/pi) int_0^pi sin t / t dt - 1/2 of the jump.
const GIBBS = 0.0894899;
// The graph the button draws: value v at row GY - GS v.
const GY = 24, GS = 16;
const { floor, min, max, abs, sin, cos, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// The three waves on [0, 2 pi), all between -1 and 1. The square is 1 on
// (0, pi) and -1 on (pi, 2 pi); the sawtooth rises as x / pi from -1 just past
// pi to 1 just before it; the triangle peaks at 1 at pi/2.
const sq = (x) => (x < PI ? 1 : -1);
const saw = (x) => (x < PI ? x / PI : x / PI - 2);
const tri = (x) => (x < PI / 2 ? (2 * x) / PI : x < (3 * PI) / 2 ? 2 - (2 * x) / PI : (2 * x) / PI - 4);
// Their sine coefficients: 4 / (pi k) on odd k; 2 (-1)^(k+1) / (pi k);
// 8 (-1)^((k-1)/2) / (pi k)^2 on odd k.
const bSq = (k) => (k & 1 ? 4 / (PI * k) : 0);
const bSaw = (k) => ((k & 1 ? 2 : -2) / (PI * k));
const bTri = (k) => (k & 1 ? ((k & 2 ? -8 : 8) / (PI * PI * k * k)) : 0);

// Shape 0..1 as weights on square, sawtooth and triangle.
function weights(s) {
  return s < 0.5 ? [1 - 2 * s, 2 * s, 0] : [0, 2 - 2 * s, 2 * s - 1];
}

const wave = (x, w) => w[0] * sq(x) + w[1] * saw(x) + w[2] * tri(x);

// The wave's range over [x - DEL, x + DEL]: the ends, and both sides of any
// jump or corner inside.
const SPECIAL = [0, PI / 2, PI, (3 * PI) / 2, TAU];
const waveAt = (t, w) => wave(t - floor(t / TAU) * TAU, w);
function localRange(x, w, out) {
  let lo = waveAt(x - DEL, w), hi = lo, v = waveAt(x + DEL, w);
  if (v < lo) lo = v;
  if (v > hi) hi = v;
  for (let n = -1; n <= 1; n++)
    for (let j = 0; j < SPECIAL.length; j++) {
      const t = SPECIAL[j] + n * TAU;
      if (t <= x - DEL || t >= x + DEL) continue;
      for (const u of [t - 1e-9, t + 1e-9]) {
        v = waveAt(u, w);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
  out[0] = lo;
  out[1] = hi;
}

export function setup(params) {
  const NS = W * SSJ;
  params.s = {
    hue: 0, speed: 2, shape: 0, fejer: 0, phase: 0, race: -1, bo: new Float64Array(RACE * NMAX + 2), bs: new Float64Array(RACE * NMAX + 2),
    sx: new Float64Array(NS), sl: new Float64Array(NS), sh: new Float64Array(NS),
    sum: new Float32Array(H), ex: new Float32Array(H), gmin: new Float32Array(W), gmax: new Float32Array(W), rk: new Float64Array(H),
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H), rr: [0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.shape = cl(k[2], 0, 1);
  // Up to 0.06 the plain sums, so the opening shows the full 8.95%.
  S.fejer = (max(0, cl(k[3], 0, 1) - 0.06) / 0.94) ** 2;
  // At Speed 2 the wave slides 0.4 radians a second.
  S.phase = (S.phase + d * S.speed * 0.2) % TAU;
  if (input.btnPressed && input.btnPressed[0] && S.race < 0) S.race = 0;
  if (S.race >= 0) {
    S.race += d;
    if (S.race > 6) S.race = -1;
  }
}

// The race: the bottom row's count of terms is multiplied by up to 8, rising
// over 2.5 seconds, holding for 2 and coming back in 1.5.
function raceFactor(t) {
  if (t < 0) return 1;
  const u = t < 2.5 ? t / 2.5 : t < 4.5 ? 1 : max(0, (6 - t) / 1.5);
  const e = u * u * (3 - 2 * u);
  return RACE ** e;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, sx, sl, sh, sum, ex, rk, rr } = S;
  const w = weights(S.shape), lam = S.fejer, nTop = NMAX * raceFactor(S.race);
  const NN = Math.ceil(nTop);
  // Row r sums the first n = 32^(r / 127) terms of each series, so the count
  // doubles every 25 rows, continuous in n: between n and n + 1 the next
  // term comes in by the fraction. The square and the triangle have only odd
  // harmonics, so their n-th term is harmonic 2n - 1; the sawtooth's is n.
  for (let r = 0; r < H; r++) rk[r] = nTop ** (r / (H - 1));
  const { bo, bs } = S;
  for (let n = 1; n <= NN; n++) {
    bo[n] = w[0] * bSq(2 * n - 1) + w[2] * bTri(2 * n - 1);
    bs[n] = w[1] * bSaw(n);
  }
  // The jumps of the wave, where it has any, set where the columns go fine.
  const jumpAt = [];
  if (w[0] > 0.001) jumpAt.push(0);
  if (w[0] + w[1] > 0.001) jumpAt.push(PI);
  // The overshoot the rulers stand at: the larger jump, the one at pi, is
  // 2 (w0 + w1) tall, from -(w0 + w1) to w0 + w1.
  const top = w[0] + w[1], ruler = top * (1 + 2 * GIBBS);

  const cp = [0, 0, 0], cn = [0, 0, 0], gold = [1, 0.85, 0.52];
  // Round orange and yellow a half is lifted, up to 1.8 times, and paled a
  // little, so it reads amber or butter and not brown or olive.
  for (const [h, out] of [[S.hue + 0.56, cp], [S.hue + 0.8, cn]]) {
    const hh = h - floor(h), warm = cl(1 - abs(hh - 0.11) / 0.1, 0, 1);
    hsv(h, 0.85 - 0.25 * warm, 1 + 0.8 * warm, out);
  }
  const graph = S.race >= 0;
  for (let col = 0; col < W; col++) {
    // Wave coordinate of the column's left edge.
    const x0 = (col / W) * TAU - S.phase;
    let near = false;
    for (const j of jumpAt) {
      const dj = ((((x0 + PI / W - j) % TAU) + TAU + PI) % TAU) - PI;
      if (abs(dj) < (1.6 * TAU) / W) near = true;
    }
    const ns = near ? SSJ : SS;
    let fbar = 0;
    for (let i = 0; i < ns; i++) {
      let x = x0 + ((i + 0.5) / ns) * (TAU / W);
      x -= floor(x / TAU) * TAU;
      sx[i] = x;
      fbar += wave(x, w) / ns;
      localRange(x, w, rr);
      sl[i] = rr[0];
      sh[i] = rr[1];
    }
    sum.fill(0);
    ex.fill(0);
    let gmin = Infinity, gmax = -Infinity;
    for (let i = 0; i < ns; i++) {
      const x = sx[i], c1 = 2 * cos(x), c2 = 2 * cos(2 * x), lo = sl[i], hi = sh[i];
      // sin(nx) and sin((2n - 1)x) by the Chebyshev recurrence.
      let a0 = 0, a1 = sin(x), o0 = -sin(x), o1 = sin(x);
      // Plain sums and Fejer means of the odd series and of the sawtooth.
      // Fejer averages the partial sums over the harmonic index: S_0..S_K
      // over K + 1, so the odd series adds its unchanged even-index sum too.
      let So = 0, To = 0, fo = 0, Ss = 0, Ts = 0, fs = 0, r = 0, last = 0;
      for (let n = 1; n <= NN && r < H; n++) {
        const So0 = So, fo0 = fo, Ss0 = Ss, fs0 = fs;
        To += So;
        So += bo[n] * o1;
        To += So;
        fo = To / (2 * n);
        Ss += bs[n] * a1;
        Ts += Ss;
        fs = Ts / (n + 1);
        while (r < H && rk[r] <= n + 1e-9) {
          const q = rk[r] - (n - 1);
          const plain = So0 + q * (So - So0) + Ss0 + q * (Ss - Ss0), mean = fo0 + q * (fo - fo0) + fs0 + q * (fs - fs0);
          // Past the wave: above its local top where the sum is positive, below
          // its local bottom where negative. Falling short is not overshoot.
          const v = (1 - lam) * plain + lam * mean, e = v > 0 ? v - hi : lo - v;
          sum[r] += v;
          if (e > ex[r]) ex[r] = e;
          if (r === H - 1) last = v;
          r++;
        }
        const a2 = c1 * a1 - a0;
        a0 = a1;
        a1 = a2;
        const o2 = c2 * o1 - o0;
        o0 = o1;
        o1 = o2;
      }
      // The bottom row's sum, for the graph.
      if (last < gmin) gmin = last;
      if (last > gmax) gmax = last;
    }
    S.gmin[col] = gmin;
    S.gmax[col] = gmax;
    for (let r = 0; r < H; r++) {
      const v = sum[r] / ns, c = v >= 0 ? cp : cn;
      // The wave's own halves: 0.1 plus 0.32 times the size of the sum, and
      // 1.8 times how far the sum is past the wave (outward) or short of it,
      // so the fringes beside each jump show as light and dark bands.
      const lv = cl(0.1 + 0.32 * min(1, abs(v)) + 1.8 * (v >= 0 ? v - fbar : fbar - v), 0, 0.8);
      // Past the wave: white-gold, full from about 80% of the overshoot's
      // limit, so the horns burn and the ripples of the first rows glow.
      const g = sm(0.25, 0.85, ex[r] / (2 * GIBBS)), p = r * W + col;
      R[p] = 255 * (c[0] * lv * (1 - g) + gold[0] * g);
      G[p] = 255 * (c[1] * lv * (1 - g) + gold[1] * g);
      B[p] = 255 * (c[2] * lv * (1 - g) + gold[2] * g);
    }
  }

  if (graph) {
    // The bottom row's sum as a graph over the top of the panel, with dim
    // rulers at the wave's top and bottom and gold ones 8.95% of the jump
    // past them.
    const t = S.race, fade = min(1, t / 0.3, (6 - t) / 0.5);
    const rows = GY + GS * 1.45;
    for (let r = 0; r <= rows; r++)
      for (let col = 0; col < W; col++) {
        const p = r * W + col, k = 1 - 0.8 * fade;
        R[p] *= k;
        G[p] *= k;
        B[p] *= k;
      }
    const rule = (v, col3, lv) => {
      const r = round(GY - GS * v);
      for (let x = 0; x < W; x += 2) {
        const p = r * W + x;
        R[p] += col3[0] * lv * fade;
        G[p] += col3[1] * lv * fade;
        B[p] += col3[2] * lv * fade;
      }
    };
    rule(top, [1, 1, 1], 70);
    rule(-top, [1, 1, 1], 70);
    rule(ruler, gold, 220);
    rule(-ruler, gold, 220);
    for (let col = 0; col < W; col++) {
      const ra = round(GY - GS * S.gmax[col]), rb = round(GY - GS * S.gmin[col]);
      for (let r = max(0, ra); r <= min(H - 1, rb); r++) {
        const p = r * W + col;
        R[p] = 255 * fade + R[p] * (1 - fade);
        G[p] = 255 * fade + G[p] * (1 - fade);
        B[p] = 255 * fade + B[p] * (1 - fade);
      }
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, round(min(255, R[p])), round(min(255, G[p])), round(min(255, B[p])));
    }
}
