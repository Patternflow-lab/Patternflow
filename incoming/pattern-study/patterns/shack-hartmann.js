// ===== Patternflow pattern =====
// Title:   Shack-Hartmann
// Family:  adaptiveoptics
// Idea:    A lattice of 128 star images, one under each lenslet of a wavefront sensor, is shoved about by a moving turbulent atmosphere, each spot sliding, stretching and fading with the local slope and curvature of the phase screen, until a mirror loop pulls the lattice square again.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Johannes Hartmann's plate with holes in front of a lens (1900), the lenslet version by Roland Shack and Ben Platt at the University of Arizona (about 1971), Andrei Kolmogorov's spectrum of turbulence (1941), Horace Babcock's proposal of adaptive optics (1953), David Fried's parameter r0 (1965); pattern round 204
// Round:   204
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0.5..6, Seeing=0.5..3, Loop=0..1
//
// Knob 1: Hue. Turns the star colour round the wheel from the cool white-blue it opens on; the centre of every spot stays white-hot and the warm fringe of atmospheric dispersion stays on the lower edge.
// Knob 2: Wind. How fast the frozen screen slides across the lenslets, from 0.5 LED a second, where the lattice breathes in place on its own boiling, to 6 LEDs a second, where waves of shear cross the 64 LED width in about ten seconds; gusts and a wandering direction ride on top.
// Knob 3: Seeing. How strong the turbulence is, as the width of the star in arcseconds: at 0.5 each spot strays about 0.9 LED from its place and the lattice stays easy to read, at 3 about 2.1 LEDs with peaks at the 3.7 LED clamp, and spots stretch into streaks and now and then drop out in a deep fade.
// Knob 4: Loop. The gain of the deformable mirror that takes out what the sensor measured 0.25 s ago: at 0 the lattice is open loop and takes the whole sky, at 1 it is nearly square with a tight shimmer, and a strong gust still tears it open now and then.

const W = 64;
const H = 128;
const PITCH = 8;
const COLS = 8;
const ROWS = 16;
const NS = COLS * ROWS;
const { floor, ceil, sin, cos, exp, sqrt, abs, tanh, log, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());

// The phase screen is a sum of M plane waves. Wavenumbers are spread evenly in
// log k from a wavelength of 190 LEDs down to 14 LEDs, which is what the 8 LED
// lenslets can still tell apart, and their directions step round by the golden
// angle so no direction is favoured.
const M = 52;
const L_MAX = 190;
const L_MIN = 14;
const TILT_MODES = 4;
// Outer scale of the von Karman spectrum: below this wavelength the spectrum
// is Kolmogorov's, above it the slope variance falls away.
const K0 = (2 * PI) / 70;
const LAG = 0.25;
// A spot centroid is read over a window, not a point, which rounds off the
// smallest waves further: half weight at a wavelength of 38 LEDs.
const KF = (2 * PI) / 38;
// The deformable mirror can only follow structure larger than about 20 LEDs.
const KC = (2 * PI) / 20;
// A spot is 2.6 LEDs wide at half height; the halo is 1.7 times as wide.
const SIGMA = 1.12;
const HALO = 0.17;
// Spots never travel further than this from their rest place, so neighbours
// 8 LEDs apart cannot swap.
const CLAMP = 3.7;
const RING = 96;
const MAX_SPEED = 14;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The lift is a table: level to the power 0.85, in steps of 1/512 up to 4.
const LIFT_N = 2048;
const LIFT = new Float32Array(LIFT_N);
for (let i = 0; i < LIFT_N; i++) LIFT[i] = ((i + 0.5) / 512) ** 0.85;
const wrap = (a) => a - 2 * PI * floor(a / (2 * PI));
const sinc = (x) => (abs(x) < 1e-6 ? 1 : sin(x) / x);

export function setup(params) {
  const S = {
    t: 0, first: true, k: [0, 2, 0.5, 0.06],
    // wind: offset of the screen, direction, gust process, burst, smoothed knobs
    ox: 0, oy: 0, dir0: 0.3 + 0.5 * Math.random(), dir: 0.5, u: 0, burst: 0,
    wind: 2, see: 0.5, gain: 0.06, spd: 2,
    ring: new Float64Array(RING * 3), rn: 0,
    kx: new Float32Array(M), ky: new Float32Array(M), kk: new Float32Array(M),
    psi: new Float32Array(M), w: new Float32Array(M), D: new Float32Array(M),
    hm: new Float32Array(M), ph: new Float32Array(M), a1: new Float32Array(M), b1: new Float32Array(M),
    sigUnit: 1, ek: new Float32Array(6), ep: new Float32Array(2), ew: new Float32Array(2),
    rx: new Float32Array(NS), ry: new Float32Array(NS),
    px: new Float32Array(NS), py: new Float32Array(NS),
    jxx: new Float32Array(NS), jxy: new Float32Array(NS), jyy: new Float32Array(NS),
    inten: new Float32Array(NS),
    buf: new Float32Array(W * H * 3),
    B: [0.5, 0.8, 1], c: [0, 0, 0],
  };
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      S.rx[j * COLS + i] = PITCH * (i + 0.5);
      S.ry[j * COLS + i] = PITCH * (j + 0.5);
    }
  const lnA = log((2 * PI) / L_MAX), lnB = log((2 * PI) / L_MIN);
  const off = Math.random() * 2 * PI;
  for (let m = 0; m < M; m++) {
    const k = exp(lnA + ((lnB - lnA) * (m + 0.15 + 0.7 * Math.random())) / M);
    const ang = off + m * 2.399963 + 0.5 * (Math.random() - 0.5);
    const kx = k * cos(ang), ky = k * sin(ang);
    S.kx[m] = kx;
    S.ky[m] = ky;
    S.kk[m] = k;
    S.psi[m] = Math.random() * 2 * PI;
    // The slope of a Kolmogorov screen per log k goes as k^4 (k^2 + k0^2)^(-11/6),
    // and a lenslet averages the slope over its own width, which is the sinc.
    const f = sinc((kx * PITCH) / 2) * sinc((ky * PITCH) / 2);
    S.D[m] = (k * k * (k * k + K0 * K0) ** (-11 / 12) * f) / (1 + (k / KF) ** 2);
    // Every mode boils at its own rate, sign and all, so the screen never repeats.
    const sgn = Math.random() < 0.5 ? -1 : 1;
    S.w[m] = sgn * (0.13 + 0.32 * Math.random() + 0.7 * k * Math.random());
    // The smallest waves, wavelength under 25 LEDs, churn fastest: a shimmer with a
    // period of two to five seconds that the mirror's lag cannot follow.
    if (k > (2 * PI) / 25) S.w[m] = sgn * (1.2 + 2.8 * Math.random());
    // What the mirror can follow falls off below a wavelength of 20 LEDs.
    S.hm[m] = 1 / (1 + (k / KC) ** 6);
  }
  // The lowest modes are the global tip and tilt: the whole lattice sliding
  // together. They get 30 percent of the total slope variance and boil
  // faster, so the jitter has a period of a few seconds.
  let rest = 0;
  for (let m = TILT_MODES; m < M; m++) rest += S.D[m] * S.D[m];
  const tiltD = sqrt((0.3 / 0.7) * rest / TILT_MODES);
  for (let m = 0; m < TILT_MODES; m++) {
    S.D[m] = tiltD * (0.8 + 0.4 * Math.random());
    S.w[m] = (m % 2 ? -1 : 1) * (0.35 + 0.8 * Math.random());
  }
  // Two very long waves that carry no displacement of their own. They make the
  // turbulence patchy: where they crest, every spot is pushed harder, so a
  // band of strong shear slides over the panel with the wind.
  for (let e = 0; e < 2; e++) {
    const ang = Math.random() * 2 * PI, k = (2 * PI) / (e ? 105 : 150);
    S.ek[e * 3] = k * cos(ang);
    S.ek[e * 3 + 1] = k * sin(ang);
    S.ep[e] = Math.random() * 2 * PI;
    S.ew[e] = (e ? -1 : 1) * (0.05 + 0.07 * Math.random());
  }
  // One displacement component has an rms of half the root of the summed squares.
  let tot = 0;
  for (let m = 0; m < M; m++) tot += S.D[m] * S.D[m];
  S.sigUnit = 0.5 * sqrt(tot);
  params.s = S;
}

function pushHistory(S) {
  const i = (S.rn++ % RING) * 3;
  S.ring[i] = S.t;
  S.ring[i + 1] = S.ox;
  S.ring[i + 2] = S.oy;
}

// Where the screen was LAG seconds ago, interpolated from the ring.
function lagged(S, out) {
  const target = S.t - LAG;
  const n = min(S.rn, RING);
  let lo = -1;
  for (let a = 1; a <= n; a++) {
    const i = ((S.rn - a) % RING + RING) % RING * 3;
    if (S.ring[i] <= target) {
      lo = i;
      break;
    }
  }
  if (lo < 0) {
    const i = (((S.rn - n) % RING + RING) % RING) * 3;
    out[0] = S.ring[i + 1];
    out[1] = S.ring[i + 2];
    return;
  }
  const hi = (lo / 3 + 1) % RING * 3;
  const t0 = S.ring[lo], t1 = S.ring[hi];
  const u = t1 > t0 && hi !== lo ? cl((target - t0) / (t1 - t0), 0, 1) : 0;
  out[0] = S.ring[lo + 1] + (S.ring[hi + 1] - S.ring[lo + 1]) * u;
  out[1] = S.ring[lo + 2] + (S.ring[hi + 2] - S.ring[lo + 2]) * u;
}

// The weather: a wind that gusts and turns, as random walks, never a cycle.
function weather(S, dt) {
  S.u += (-S.u / 6) * dt + sqrt((2 / 6) * dt) * gauss();
  S.burst *= exp(-dt / 2.2);
  if (Math.random() < dt / 30) S.burst += 1.2 + 2.6 * Math.random();
  S.dir += -0.03 * (S.dir - S.dir0) * dt + 0.22 * sqrt(dt) * gauss();
  const gust = exp(0.38 * S.u) * (1 + S.burst);
  S.spd = min(S.wind * gust, MAX_SPEED);
  S.ox += S.spd * cos(S.dir) * dt;
  S.oy += S.spd * sin(S.dir) * dt;
}

const LG = [0, 0];

// The field at every lenslet: displacement, its Jacobian and the brightness.
function field(S) {
  const t = S.t;
  lagged(S, LG);
  const dox = S.ox - LG[0], doy = S.oy - LG[1];
  const g = S.gain;
  for (let m = 0; m < M; m++) {
    // Wrapped in double precision, so hours of wind never cost the float table its bits.
    const a = S.psi[m] + S.w[m] * t - (S.kx[m] * S.ox + S.ky[m] * S.oy);
    S.ph[m] = wrap(a);
    const delta = S.kx[m] * dox + S.ky[m] * doy - S.w[m] * LAG;
    // The loop gives up on structure that moves faster than it can follow.
    const gm = (g * S.hm[m]) / (1 + (delta / 0.9) ** 2);
    S.a1[m] = 1 - gm * cos(delta);
    S.b1[m] = gm * sin(delta);
  }
  // The seeing itself breathes by up to half, on swings of one to five minutes.
  const breath = 1 + 0.26 * sin(0.047 * t + 1.1) + 0.16 * sin(0.0191 * t + 4.2) + 0.08 * sin(0.113 * t);
  const sd = 1.0 * (2.7 / 1.0) ** cl((S.see - 0.5) / 2.5, 0, 1) * breath;
  const amp = sd / S.sigUnit;
  const { ek, ep, ew } = S;
  const e0 = wrap(ep[0] + ew[0] * t - (ek[0] * S.ox + ek[1] * S.oy));
  const e1 = wrap(ep[1] + ew[1] * t - (ek[3] * S.ox + ek[4] * S.oy));
  const { kx, ky, kk, D, ph, a1, b1 } = S;
  for (let n = 0; n < NS; n++) {
    const x = S.rx[n], y = S.ry[n];
    let dx = 0, dy = 0, jxx = 0, jxy = 0, jyy = 0;
    for (let m = 0; m < M; m++) {
      const th = kx[m] * x + ky[m] * y + ph[m];
      const s = sin(th), c = cos(th);
      const rs = s * a1[m] - c * b1[m];
      const rc = c * a1[m] + s * b1[m];
      const d = D[m] / kk[m];
      dx -= d * kx[m] * rs;
      dy -= d * ky[m] * rs;
      const e = d * rc;
      jxx -= e * kx[m] * kx[m];
      jxy -= e * kx[m] * ky[m];
      jyy -= e * ky[m] * ky[m];
    }
    const patch = (0.9 * exp(0.65 * 0.5 * (cos(ek[0] * x + ek[1] * y + e0) + cos(ek[3] * x + ek[4] * y + e1)))) * amp;
    dx *= patch;
    dy *= patch;
    jxx *= patch;
    jxy *= patch;
    jyy *= patch;
    // Soft clamp on the length of the displacement, the same factor on its slope.
    const r = sqrt(dx * dx + dy * dy) + 1e-6;
    const cf = 1 / (1 + (r / CLAMP) ** 3) ** (1 / 3);
    S.px[n] = x + dx * cf;
    S.py[n] = y + dy * cf;
    // The Jacobian is the spot's local distortion; keep it from blowing up.
    const jn = sqrt(jxx * jxx + jyy * jyy + 2 * jxy * jxy);
    const jc = jn > 0.9 ? 0.9 / jn : 1;
    S.jxx[n] = jxx * jc * cf;
    S.jxy[n] = jxy * jc * cf;
    S.jyy[n] = jyy * jc * cf;
    // Flux through the lenslet follows the curvature of the phase: where the
    // lattice spreads the spot is dim, where it bunches the spot is bright.
    const e = exp(-1.9 * (S.jxx[n] + S.jyy[n]));
    const raw = e > 1 ? 1 + 0.3 * tanh((e - 1) / 0.3) : e;
    const f = cl((raw - 0.05) / 0.4, 0, 1);
    S.inten[n] = raw * f * f * (3 - 2 * f);
  }
}

function advance(S, dt) {
  S.t += dt;
  // Smooth the knobs so a turned detent eases in over about half a second.
  const e = 1 - exp(-dt / 0.5);
  S.wind += (cl(S.k[1], 0.5, 6) - S.wind) * e;
  S.see += (cl(S.k[2], 0.5, 3) - S.see) * e;
  S.gain += (cl(S.k[3], 0, 1) - S.gain) * e;
  weather(S, dt);
  pushHistory(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0.5, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.wind = cl(S.k[1], 0.5, 6);
    S.see = cl(S.k[2], 0.5, 3);
    S.gain = cl(S.k[3], 0, 1);
    S.dir = S.dir0;
    S.t = 0;
    pushHistory(S);
    // Open on a sky that has already been moving for 40 s.
    for (let t = 0; t < 40; t += 0.1) advance(S, 0.1);
    S.first = false;
  }
  advance(S, dt);
  field(S);
}

// One star image: a soft core and a wider halo, as two Gaussians sharing one
// exponential, since the core is the halo cubed. The red channel sits a
// little lower and the blue a little higher, the way a prism of air spreads
// a star. The covariance is the lenslet's own blur plus the spread of the
// slope across it.
function spot(S, n, dyR, dyB) {
  const { buf } = S;
  const cx = S.px[n], cy = S.py[n];
  const jxx = S.jxx[n], jxy = S.jxy[n], jyy = S.jyy[n];
  const k2 = (PITCH * PITCH) / 12;
  const s2 = SIGMA * SIGMA;
  const cxx = s2 + k2 * (jxx * jxx + jxy * jxy);
  const cyy = s2 + k2 * (jyy * jyy + jxy * jxy);
  const cxy = k2 * jxy * (jxx + jyy);
  const det = cxx * cyy - cxy * cxy;
  const tr = cxx + cyy;
  const lam = tr / 2 + sqrt(max(0, (tr * tr) / 4 - det));
  const ixx = cyy / det, ixy = -cxy / det, iyy = cxx / det;
  // The same flux spread over a larger area is a lower peak.
  const peak = S.inten[n] * (s2 / sqrt(det)) ** 0.75;
  const R = ceil(4.2 * sqrt(lam) + 0.6);
  const ix = floor(cx), iy = floor(cy);
  for (let ch = 0; ch < 3; ch++) {
    const oy = ch === 0 ? dyR : ch === 2 ? dyB : 0;
    for (let py = iy - R; py <= iy + R; py++) {
      if (py < 0 || py >= H) continue;
      const dy = py + 0.5 - (cy + oy);
      for (let px = ix - R; px <= ix + R; px++) {
        if (px < 0 || px >= W) continue;
        const dx = px + 0.5 - cx;
        const q = ixx * dx * dx + 2 * ixy * dx * dy + iyy * dy * dy;
        if (q > 19) continue;
        const a = exp(-q / 6);
        buf[(py * W + px) * 3 + ch] += peak * (a * a * a + HALO * a);
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { buf, B, c } = S;
  buf.fill(0);
  // Atmospheric dispersion grows with the zenith angle, which drifts slowly.
  const t = S.t;
  const zen = cl(0.5 + 0.3 * sin(0.0137 * t + 0.9) + 0.2 * sin(0.0059 * t + 2.3), 0, 1);
  const dz = 0.08 + 0.2 * zen;
  for (let n = 0; n < NS; n++) spot(S, n, dz, -dz);
  hsv(0.585 + S.k[0], 0.55, 1, B);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      let e0 = buf[i], e1 = buf[i + 1], e2 = buf[i + 2];
      if (e0 < 0.02 && e1 < 0.02 && e2 < 0.02) continue;
      // A small lift to the dim end, where a dark orange halo would go brown on the panel.
      e0 = LIFT[min(LIFT_N - 1, (e0 * 512) | 0)];
      e1 = LIFT[min(LIFT_N - 1, (e1 * 512) | 0)];
      e2 = LIFT[min(LIFT_N - 1, (e2 * 512) | 0)];
      // The colour is in the halo; the more light, the whiter, up to white-hot.
      c[0] = min(1, e0 * B[0] + (1 - B[0]) * e0 * e0 * e0);
      c[1] = min(1, e1 * B[1] + (1 - B[1]) * e1 * e1 * e1);
      c[2] = min(1, e2 * B[2] + (1 - B[2]) * e2 * e2 * e2);
      display.setPixel(x, y, 255 * c[0], 255 * c[1], 255 * c[2]);
    }
}
