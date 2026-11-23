// ===== Patternflow pattern =====
// Title:   Cavity Modes
// Family:  lasermode
// Idea:    The red light a laser cavity puts on a screen, a sum of Hermite-Gauss modes of one order whose phases drift against each other, so that a grid of lobes bends into bright loops, curved stripes and rings as a cylindrical-lens converter turns the grid into the donut modes.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hermite-Gaussian and Laguerre-Gaussian resonator modes (Herwig Kogelnik and Tingye Li, 1966, from memory), the astigmatic mode converter that turns one into the other (M. W. Beijersbergen and colleagues, 1993, from memory), geometric modes of a degenerate cavity as spin coherent states (Yung-Fu Chen and Kai-Feng Huang, 2003, from memory), pattern round 225
// Round:   225
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Order=1..2.75, Converter=-1..1, Drift=-1..1
//
// Knob 1: Hue. Turns the tone map once round the wheel. At 0 it runs black, ruby, red, red-orange and cream at the white-hot peaks; at 0.5 it runs through teal and cyan to ice white; 1 is the same as 0.
// Knob 2: Order. The order N = 8K - 6 of the modes, N = m + n, so the cavity holds N + 1 of them: 2 at 1, where a few big lobes fill the panel; 10 at 2, where it opens and the grid is about 4 lobes across and 8 down; 16 at 2.75, a lattice of lobes about 4 LEDs wide. Between whole orders the two pictures cross-fade over the middle 30% of the step.
// Knob 3: Converter. The turn of the cylindrical-lens converter, 0 degrees at -1, 45 at 0 where it opens, 90 at +1. At -1 the pure Hermite-Gauss grid of lobes under a Gaussian bell; at +1 the Laguerre-Gauss donut, a dark core inside rings; between them the grid bends into a bright rim with the lattice inside. The beam is also stretched along the panel, its x scale 1.45 times the y scale at -1 and 2.0 times at +1, so that the rings fill the panel as an ellipse.
// Knob 4: Drift. How many modes of the order take part and how fast their phases part. The weights are a bell of width 0.38 modes at -1 (one mode; a step away the weight is 18% in amplitude), 1.5 at 0.06 where it opens (about 6 modes above a tenth of the peak intensity) and 2.4 at +1 (about 10). The phase step between neighbouring modes turns 0.04 radians a second at -1 (the picture holds one mode for tens of seconds), 0.5 at the opening (a turn in 13 s) and 1.4 at +1 (a turn in 4.5 s). Apart from that, at every setting the bell's centre, the chirp, the converter angle, the tilt, the position and the size of the beam each wander on a random sequence of their own, steps of 10 to 70 s at the opening, so the picture does not come back to an earlier one.

const W = 64, H = 128, NPIX = W * H;
const { floor, sqrt, exp, sin, cos, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const NMIN = 2, NMAX = 16, KMAX = NMAX + 1;
const PI4 = pow(PI, -0.25), SQRT2 = sqrt(2);
// Tone map from the dark screen to the white-hot core: black, ruby, red, red-orange, orange, white.
const STOPS = [
  [0.0, 0, 0, 0],
  [0.3, 45, 0, 8],
  [0.5, 150, 0, 14],
  [0.68, 235, 20, 10],
  [0.82, 255, 105, 8],
  [0.93, 255, 190, 80],
  [1.0, 255, 240, 220],
];
const NPAL = 1024;
const TARGET = 0.213;

// Recurrence weights of the Hermite functions: phi(m+1) = A1 x phi(m) - A2 phi(m-1).
const A1 = new Float64Array(KMAX + 1), A2 = new Float64Array(KMAX + 1);
for (let m = 0; m <= KMAX; m++) {
  A1[m] = sqrt(2 / (m + 1));
  A2[m] = sqrt(m / (m + 1));
}

// The eigenvectors of Jx for the spin N/2 that the modes of order N make up, found by
// Jacobi sweeps once per order. Turning the converter by an angle is then
// V diag(exp(-i angle mu)) V^T, with mu running from -N/2 to N/2.
const jxCache = [];
function jxBasis(N) {
  if (jxCache[N]) return jxCache[N];
  const K = N + 1;
  const A = new Float64Array(K * K), V = new Float64Array(K * K);
  for (let k = 0; k < K; k++) V[k * K + k] = 1;
  for (let k = 0; k < N; k++) A[k * K + k + 1] = A[(k + 1) * K + k] = 0.5 * sqrt((N - k) * (k + 1));
  for (let sweep = 0; sweep < 40; sweep++) {
    let off = 0;
    for (let p = 0; p < K; p++) for (let q = p + 1; q < K; q++) off += A[p * K + q] * A[p * K + q];
    if (off < 1e-24) break;
    for (let p = 0; p < K; p++)
      for (let q = p + 1; q < K; q++) {
        const apq = A[p * K + q];
        if (abs(apq) < 1e-15) continue;
        const th = (A[q * K + q] - A[p * K + p]) / (2 * apq);
        const t = (th >= 0 ? 1 : -1) / (abs(th) + sqrt(th * th + 1));
        const c = 1 / sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < K; k++) {
          const a = A[k * K + p], b = A[k * K + q];
          A[k * K + p] = c * a - s * b;
          A[k * K + q] = s * a + c * b;
        }
        for (let k = 0; k < K; k++) {
          const a = A[p * K + k], b = A[q * K + k];
          A[p * K + k] = c * a - s * b;
          A[q * K + k] = s * a + c * b;
        }
        for (let k = 0; k < K; k++) {
          const a = V[k * K + p], b = V[k * K + q];
          V[k * K + p] = c * a - s * b;
          V[k * K + q] = s * a + c * b;
        }
      }
  }
  const order = [];
  for (let r = 0; r < K; r++) order.push(r);
  order.sort((a, b) => A[a * K + a] - A[b * K + b]);
  const S = new Float64Array(K * K);
  for (let r = 0; r < K; r++) for (let k = 0; k < K; k++) S[k * K + r] = V[k * K + order[r]];
  return (jxCache[N] = S);
}

function hsv(h, s, v) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  return [k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p, k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p, k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p];
}

// The palette, indexed by intensity over the peak, rebuilt when the hue knob moves.
function palette(P, h0) {
  P.hc = h0;
  for (let i = 0; i < NPAL; i++) {
    const x = i / (NPAL - 1), v = pow(x, 0.7);
    let s = 1;
    while (s < STOPS.length - 1 && STOPS[s][0] < v) s++;
    const a = STOPS[s - 1], b = STOPS[s], f = (v - a[0]) / (b[0] - a[0]);
    const r = (a[1] + (b[1] - a[1]) * f) / 255, g = (a[2] + (b[2] - a[2]) * f) / 255, bl = (a[3] + (b[3] - a[3]) * f) / 255;
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn;
    let h = 0;
    if (d > 0) h = mx === r ? ((g - bl) / d + 6) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
    const c = hsv(h / 6 + h0, mx > 0 ? d / mx : 0, mx);
    P.pal[i * 3] = c[0] * 255;
    P.pal[i * 3 + 1] = c[1] * 255;
    P.pal[i * 3 + 2] = c[2] * 255;
  }
}

// A box blur of radius r, edges repeated, in two passes.
function boxBlur(src, dst, tmp, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const b = y * W;
    let acc = src[b] * (r + 1);
    for (let i = 1; i <= r; i++) acc += src[b + (i < W ? i : W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[b + x] = acc * inv;
      acc += src[b + (x + r + 1 < W ? x + r + 1 : W - 1)] - src[b + (x - r < 0 ? 0 : x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = tmp[x] * (r + 1);
    for (let i = 1; i <= r; i++) acc += tmp[(i < H ? i : H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc * inv;
      acc += tmp[(y + r + 1 < H ? y + r + 1 : H - 1) * W + x] - tmp[(y - r < 0 ? 0 : y - r) * W + x];
    }
  }
}

export function setup(params) {
  params.t = 0;
  params.wc = 43.7;
  params.phi = 0.9;
  params.cr = new Float64Array(KMAX);
  params.ci = new Float64Array(KMAX);
  params.sr = new Float64Array(KMAX);
  params.si = new Float64Array(KMAX);
  params.fx = new Float64Array(W * KMAX);
  params.fy = new Float64Array(H * KMAX);
  params.act = new Int32Array(KMAX);
  params.wr = new Float64Array(KMAX);
  params.wi = new Float64Array(KMAX);
  params.I = new Float32Array(NPIX);
  params.B = new Float32Array(NPIX);
  params.T = new Float32Array(NPIX);
  params.idx = new Uint16Array(NPIX);
  params.pal = new Float32Array(NPAL * 3);
  params.peak = 0;
  params.gain = 1;
  params.hc = -9;
  for (let n = NMIN; n <= NMAX + 1; n++) jxBasis(n);
}

// Smooth random numbers: a new random value at every whole step of t, joined by a
// Catmull-Rom curve, in about -1..1. Each channel has its own sequence, so nothing
// that wanders with one of them repeats with another.
const hash = (n) => {
  const x = sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - floor(x);
};
function wander(t, ch) {
  const i = floor(t), f = t - i, o = ch * 101.7;
  const a = hash(i - 1 + o) * 2 - 1, b = hash(i + o) * 2 - 1, c = hash(i + 1 + o) * 2 - 1, d = hash(i + 2 + o) * 2 - 1;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

// Turns the state of order N about the Jx axis by an angle, in place: V diag(exp(-i angle mu)) V^T.
function rotX(P, N, angle) {
  const K = N + 1, V = jxBasis(N), { cr, ci, sr, si } = P;
  for (let r = 0; r < K; r++) {
    let a = 0, b = 0;
    for (let l = 0; l < K; l++) {
      a += V[l * K + r] * cr[l];
      b += V[l * K + r] * ci[l];
    }
    const mu = r - N / 2, c = cos(angle * mu), s = sin(angle * mu);
    sr[r] = a * c + b * s;
    si[r] = b * c - a * s;
  }
  for (let k = 0; k < K; k++) {
    let a = 0, b = 0;
    for (let r = 0; r < K; r++) {
      a += V[k * K + r] * sr[r];
      b += V[k * K + r] * si[r];
    }
    cr[k] = a;
    ci[k] = b;
  }
}
// Gives mode k the phase exp(-i th (N/2 - k)): a turn about the Jz axis.
function twist(P, N, th) {
  const { cr, ci } = P;
  for (let k = 0; k <= N; k++) {
    const m = th * (N / 2 - k), c = cos(m), s = sin(m), a = cr[k], b = ci[k];
    cr[k] = a * c + b * s;
    ci[k] = b * c - a * s;
  }
}

// The state of the cavity at order N: amplitudes on the modes HG(N-k, k), k = 0..N,
// with a bell of width sigma about a centre k0, a phase step of phi between
// neighbours (the Gouy phase difference of the two axes) and a chirp. Then the
// converter turns the whole thing by alpha about the Jx axis, and the beam turns
// by beta about the optical axis, which is a turn about Jy: Jz twists Jx into Jy.
function state(P, N, sigma, k0, kappa, alpha, beta) {
  const K = N + 1, { cr, ci } = P;
  let tot = 0;
  for (let k = 0; k < K; k++) {
    const d = k - k0;
    // Each mode's amplitude and phase also wander a little on a sequence of its own.
    const a = exp(-(d * d) / (4 * sigma * sigma)) * (1 + 0.3 * wander(P.wc / 14 + k * 0.37, 40 + k));
    const f = k * P.phi + 0.5 * kappa * d * d + 0.3 * wander(P.wc / 19 + k * 0.53, 70 + k);
    cr[k] = a * cos(f);
    ci[k] = a * sin(f);
    tot += a * a;
  }
  const nrm = 1 / sqrt(tot);
  for (let k = 0; k < K; k++) {
    cr[k] *= nrm;
    ci[k] *= nrm;
  }
  rotX(P, N, alpha);
  if (abs(beta) > 1e-4) {
    twist(P, N, -PI / 2);
    rotX(P, N, beta);
    twist(P, N, PI / 2);
  }
}

// Adds wt times the intensity of the field at order N to P.I.
function addField(P, N, wt, sx, sy, ox, oy) {
  const K = N + 1, { fx, fy, cr, ci, act, wr, wi, I } = P;
  for (let i = 0; i < W; i++) {
    const xi = (i - (W - 1) / 2 - ox) * sx, e = PI4 * exp(-0.5 * xi * xi), b = i * K;
    let p0 = e, p1 = SQRT2 * xi * e;
    fx[b + N] = p0;
    if (N >= 1) fx[b + N - 1] = p1;
    for (let m = 1; m < N; m++) {
      const p2 = A1[m] * xi * p1 - A2[m] * p0;
      fx[b + N - m - 1] = p2;
      p0 = p1;
      p1 = p2;
    }
  }
  for (let j = 0; j < H; j++) {
    const eta = (j - (H - 1) / 2 - oy) * sy, e = PI4 * exp(-0.5 * eta * eta), b = j * K;
    let p0 = e, p1 = SQRT2 * eta * e;
    fy[b] = p0;
    if (N >= 1) fy[b + 1] = p1;
    for (let m = 1; m < N; m++) {
      const p2 = A1[m] * eta * p1 - A2[m] * p0;
      fy[b + m + 1] = p2;
      p0 = p1;
      p1 = p2;
    }
  }
  let na = 0;
  for (let k = 0; k < K; k++) if (cr[k] * cr[k] + ci[k] * ci[k] > 1e-6) act[na++] = k;
  for (let j = 0; j < H; j++) {
    const yb = j * K;
    for (let a = 0; a < na; a++) {
      const k = act[a], g = fy[yb + k];
      wr[a] = cr[k] * g;
      wi[a] = ci[k] * g;
    }
    for (let i = 0; i < W; i++) {
      const xb = i * K;
      let re = 0, im = 0;
      for (let a = 0; a < na; a++) {
        const g = fx[xb + act[a]];
        re += wr[a] * g;
        im += wi[a] * g;
      }
      I[j * W + i] += wt * (re * re + im * im);
    }
  }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const u = cl((kv[3] + 1) / 2, 0, 1);
  // Two clocks. s runs the phase step between neighbouring modes and is nearly stopped at
  // the low end of Drift. w runs everything that wanders and never stops: 0.8 at -1, 0.5 at
  // the opening, 0.7 at +1. Slower in the middle, where many modes make the picture busy,
  // so that no scene is close to an earlier one. ga is how far the geometry wanders: 0.7
  // at -1, 1 at +1.
  const s = 0.04 + 1.5 * pow(u, 1.7);
  const w = 0.8 - u + 0.9 * u * u, ga = 0.7 + 0.3 * u;
  P.t += d;
  P.wc += d * w;
  const wc = P.wc, wn = (ch, T) => wander(wc / T + ch * 13.1, ch);
  P.phi += d * s * (0.9 + 0.5 * wn(20, 6.3));
  const alpha = cl(((cl(kv[2], -1, 1) + 1) / 2) * (PI / 2) + 0.25 * ga * wn(6, 20.9), 0, PI / 2);
  const Nc = cl(8 * kv[1] - 6, NMIN, NMAX);
  // Orders are whole numbers; the middle 30% of each step cross-fades two of them.
  const nl = floor(Nc);
  const b = nl >= NMAX ? 0 : smooth((Nc - nl - 0.35) / 0.3);
  const sigma = (0.38 + 2.05 * u) * (1 + 0.35 * wn(11, 23.3));
  // The bell's centre sits near 0.72 N, where the lobes come out square on a panel twice
  // as tall as wide, and wanders by 0.26 N at most. The chirp bends the phase step. The
  // beam turns by up to 0.8 radians about the optical axis (23 degrees of the picture),
  // slides 7 LEDs across and 9 down, and is nearer or further from the waist by 12%. Each
  // of these has its own random sequence, with steps of 10 to 36 clock units.
  const kappa = 1.2 * wn(3, 17.0) + 0.45 * wn(4, 10.3);
  const beta = 0.8 * ga * wn(5, 27.1);
  const ox = 7 * ga * wn(7, 30.5), oy = 9 * ga * wn(8, 24.7);
  const breathe = 1 + ga * 0.12 * wn(9, 33.4) + 0.012 * sin(0.41 * P.t + 1);
  // The converter's lens also stretches x against y, so the rings stay round on the stretched panel.
  const asp = (1.45 + 0.55 * sin(alpha)) * (1 + ga * 0.12 * wn(10, 36.2));
  P.I.fill(0);
  for (let pass = 0; pass < 2; pass++) {
    const wt = pass === 0 ? 1 - b : b, N = nl + pass;
    if (wt <= 0) continue;
    const R = sqrt(2 * N + 2), sy = (breathe * R) / 64, sx = asp * sy;
    const k0 = N * (0.72 + ga * (0.19 * wn(1, 21.6) + 0.07 * wn(2, 12.7)));
    state(P, N, sigma, k0, kappa, alpha, beta);
    addField(P, N, wt, sx, sy, ox, oy);
  }
  let mx = 0;
  const { I } = P;
  for (let i = 0; i < NPIX; i++) if (I[i] > mx) mx = I[i];
  if (P.peak <= 0) P.peak = mx;
  else P.peak += (mx - P.peak) * (1 - exp(-d / (mx > P.peak ? 0.15 : 1.2)));
  // Each LED is shown against a mix of the peak and the local mean, so that the
  // faint lattice inside the bright rim reads as well as the rim does.
  const { B, T, idx } = P;
  boxBlur(I, B, T, 11);
  const pk = P.peak;
  // The screen is a little off square to the beam: a brightness slope across and down
  // that wanders.
  const gx = 0.3 * wn(12, 17.3), gy = 0.3 * wn(13, 22.9), ex = NPAL - 1;
  // A slow gain holds the mean brightness where it was at the opening, so that a sparse
  // scene is not dimmer than a busy one.
  let sum = 0;
  const gain = P.gain;
  for (let y = 0; y < H; y++) {
    const sl = (1 + gy * (y / 63.5 - 1)) * ex * gain;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = (I[i] / (0.22 * pk + 1.6 * B[i])) * sl * (1 + gx * (x / 31.5 - 1));
      idx[i] = v >= NPAL - 1 ? NPAL - 1 : v | 0;
      sum += idx[i];
    }
  }
  const mean = sum / NPIX / (NPAL - 1);
  P.mean = mean;
  P.gain = cl(P.gain * pow(TARGET / (mean + 1e-6), 1 - exp(-d / 25)), 0.6, 1.7);
  const h0 = kv[0];
  if (abs(h0 - P.hc) > 1e-4) palette(P, h0);
}

export function draw(display, P) {
  const { idx, pal } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = idx[y * W + x] * 3;
      display.setPixel(x, y, pal[o], pal[o + 1], pal[o + 2]);
    }
}
