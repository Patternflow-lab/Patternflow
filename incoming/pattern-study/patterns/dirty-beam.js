// ===== Patternflow pattern =====
// Title:   Dirty Beam
// Family:  interferometry
// Idea:    The panel is the image a radio interferometer makes of a patch of sky: a Y of 27 dishes is turned by the Earth, every pair of dishes measures one point of the sky's Fourier transform, and the last few seconds of those points are gridded and inverted into the dirty image, so a bent radio galaxy with knots streaming down its jets, a binary and a flaring source come out of the telescope's own blur, a core ringed by six lumps and a blue moat, and the blur clears as the window grows.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: aperture synthesis (Martin Ryle and Antony Hewish, Cambridge, 1950s to 1974), the Very Large Array's Y of 27 dishes on three arms (1980), the van Cittert-Zernike theorem (Pieter van Cittert 1934, Frits Zernike 1938), the dirty beam and dirty image named by Jan Hogbom's CLEAN (1974), gridding and an inverse FFT as radio imagers make the dirty image, Cygnus A as the model double radio galaxy (Jennison and Das Gupta, 1953), wide-angle tails (Owen and Rudnick, 1976); pattern round 208
// Round:   208
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rotation=0..4, Dropout=0..15, Wavelength=-1..1
//
// Knob 1: Hue. Turns the whole ramp round the colour wheel once, the dim blue of the negative bowls with it. It opens on the afmhot ramp, black through crimson and orange to a white-hot core, and comes back to that at 1.
// Knob 2: Rotation. How fast the Earth turns the array: 0.05 radian a second at 0 and 0.45 at 4, 0.25 where it opens. The tracks of the dishes across the u-v plane are arcs of that turn, and the Y's snapshot is a star of six spokes 60 degrees apart, so the window needs 60 degrees of turn to fill the star into rings. At 2 that is 4.2 s of window and the 1.3 s window it opens on has turned a third of that, so the star is still mostly spokes; at 4 it is 2.3 s and the picture is mostly clean; at 0 the window never turns more than 25 degrees and every source keeps its spokes and a speckle of ripples round them.
// Knob 3: Dropout. How many of the 27 dishes are switched off, from none at the opening to 15, which leaves twelve: the three at the ends of the arms and nine more, in an order that is fixed. The tips stay, so the beam stays as narrow, but the gaps in the array come back as ripples and arcs round every source, and the 351 baselines of the full Y are 66.
// Knob 4: Wavelength. How long the waves being observed are. The beam is the width of one wavelength over the array, so at -1 the u-v plane is 1.9 times wider than at the opening and the core is under 2 LED across, at the opening it is 4 LED at half power, and at 1 the plane is 0.57 as wide and the core is 7 LED. The binary, 5 LED apart, is two points at -1 and one lump at 1.

const W = 64;
const H = 128;
const NPX = W * H;
const { floor, sin, cos, exp, abs, min, max, sqrt, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const CAP = 21000; // slots in the ring of u-v samples
const RATE = 1150; // u-v samples taken a second at the opening rotation, more when the Earth turns faster
const LMAX = 8.5; // the longest window, seconds
const LMIN = 0.9; // and the shortest, which is a snapshot
const NS = 24; // sources in the sky
const NANT = 27; // dishes, nine on each arm of the Y
const UMAX = 0.18; // the longest baseline, cycles per LED at the opening wavelength
const TAPER = 0.2; // roll-off of the longest baselines
const ROBUST = 0.06; // 0 is uniform weighting in the u-v plane, large is natural
const SHORT = 3; // extra weight on the shortest baselines, which carry the diffuse light
const RINGS = 0.15; // small: the weight grows with baseline length, so the u-v plane is a thick ring and the beam's rings stand out
const EPS = 0.86; // the foreshortening of v: the beam is that much longer than it is wide

// ---- the sky ---------------------------------------------------------------
const sx = new Float64Array(NS);
const sy = new Float64Array(NS);
const sa = new Float64Array(NS);
const sg = new Float64Array(NS); // 2 pi^2 sigma^2, the Gaussian taper in the u-v plane

function put(k, x, y, a, sigma) {
  sx[k] = x - 31.5;
  sy[k] = y - 63.5;
  sa[k] = a;
  sg[k] = 2 * PI * PI * sigma * sigma;
}

function hash2(k, d) {
  const x = sin(k * 127.1 + d * 311.7) * 43758.5453;
  return x - floor(x);
}

// One stream of knots leaving the core along the jet axis. They are born at
// jittered times, so the stream has a rhythm and no period.
function knots(t, slot, dir, P, v, A, dist, ex, ey, cx, cy, tag) {
  const k1 = floor(t / P) + 1;
  const k0 = floor((t - dist / v) / P) - 1;
  let j = 0;
  for (let k = k1; k >= k0 && j < 3; k--) {
    const T = P * (k + 0.6 * (hash2(k, tag) - 0.5));
    const q = (v * (t - T)) / dist;
    if (q <= 0 || q >= 1) continue;
    const s = q * dist * dir;
    put(slot + j, cx + s * ex, cy + s * ey, A * 4 * q * (1 - q), 1.7);
    j++;
  }
  for (; j < 3; j++) sa[slot + j] = 0;
}

// Faint compact sources spread over the field, each on a slow wandering path
// and brightening and fading on its own beat.
const BASE = [[9, 10], [53, 10], [6, 50], [58, 44], [8, 110], [32, 121], [58, 84]];
const BG = BASE.map((p, i) => ({
  x: p[0],
  y: p[1],
  ax: 8 + 8 * hash2(i, 1),
  ay: 10 + 10 * hash2(i, 2),
  fx: 0.045 + 0.08 * hash2(i, 3),
  fy: 0.043 + 0.08 * hash2(i, 4),
  fa: 0.12 + 0.3 * hash2(i, 5),
  px: TAU * hash2(i, 6),
  py: TAU * hash2(i, 7),
  pa: TAU * hash2(i, 8),
  a: 0.3 + 0.4 * hash2(i, 9),
  sg: 0.9 + 0.5 * hash2(i, 10),
}));

function skyAt(t) {
  const th = 0.55 * sin(0.0733 * t + 0.695) + 0.3 * sin(0.1203 * t + 0.133) + 0.14 * sin(0.2503 * t + 1.021);
  const ex = sin(th);
  const ey = -cos(th);
  // the far lobe is bent off the line, as in a wide-angle tail
  const tb = th + 0.42 * sin(0.1088 * t + 2.068) + 0.14 * sin(0.21 * t);
  const bx2 = sin(tb);
  const by2 = -cos(tb);
  const cx = 32 + 8 * sin(0.0464 * t - 0.499) + 4 * sin(0.1204 * t + 0.985);
  const cy = 64 + 10 * sin(0.0345 * t + 0.209) + 4 * sin(0.0898 * t + 0.222);
  // the lobes keep inside the panel however the axis turns
  const room = (19 - abs(cx - 32)) / max(abs(ex), 0.01);
  const da = max(16, min(35 + 5 * sin(0.151 * t + 0.2), room));
  const db = max(15, min(30 + 4 * sin(0.127 * t + 2.4), (19 - abs(cx - 32)) / max(abs(bx2), 0.01)));
  put(0, cx, cy, 1.5 * (1 + 0.1 * sin(0.77 * t + 0.5)), 0.9);
  put(1, cx + 0.8 * da * ex, cy + 0.8 * da * ey, 2.2, 6);
  put(23, cx - 0.8 * db * bx2, cy - 0.8 * db * by2, 1.8, 6);
  put(2, cx + da * ex, cy + da * ey, 3.4 * (1 + 0.35 * sin(0.21 * t + 1)), 2.5);
  put(3, cx - db * bx2, cy - db * by2, 2.9 * (1 + 0.35 * sin(0.173 * t + 4)), 2.3);
  put(4, cx + (da + 5.5) * ex, cy + (da + 5.5) * ey, 0.9 * (1 + 0.25 * sin(0.41 * t)), 1.5);
  put(5, cx - (db + 5) * bx2, cy - (db + 5) * by2, 0.6 * (1 + 0.3 * sin(0.37 * t + 2)), 1.5);
  knots(t, 6, 1, 3.4, 6.5, 1.5, da, ex, ey, cx, cy, 1);
  knots(t, 9, -1, 4.9, 5.4, 0.9, db, bx2, by2, cx, cy, 2);
  const bph = 0.63 * t + 0.6 * sin(0.11 * t);
  const br = 5 + 1.1 * sin(0.29 * t + 0.6);
  const bx = 46 + 6 * sin(0.061 * t + 1) + 2 * sin(0.127 * t);
  const by = 106 + 6 * sin(0.049 * t + 2);
  put(12, bx + 0.4 * br * cos(bph), by + 0.4 * br * sin(bph), 0.8, 0.6);
  put(13, bx - 0.6 * br * cos(bph), by - 0.6 * br * sin(bph), 0.55, 0.6);
  const f = 0.5 + 0.5 * sin(0.231 * t + 0.7);
  put(14, 16 + 6 * sin(0.067 * t + 0.3) + 2 * sin(0.151 * t), 26 + 6 * sin(0.083 * t + 1.9), 0.1 + 1.6 * f * f * f * (0.6 + 0.4 * sin(0.083 * t + 2)), 0.7);
  put(15, 12 + 6 * sin(0.057 * t), 72 + 8 * sin(0.061 * t + 0.4), 0.28 + 0.1 * sin(0.19 * t + 2), 0.8);
  for (let i = 0; i < BG.length; i++) {
    const g = BG[i];
    put(16 + i, g.x + g.ax * sin(g.fx * t + g.px), g.y + g.ay * sin(g.fy * t + g.py), g.a * (1 + 0.6 * sin(g.fa * t + g.pa)), g.sg);
  }
}

// ---- the array ---------------------------------------------------------------
// Nine dishes on each of three arms 120 degrees apart, spaced as a power of the
// distance along the arm so that the short baselines are many, as on the VLA.
const AE = new Float64Array(NANT);
const AN = new Float64Array(NANT);
const RANK = []; // dishes in the order they are switched off; the tips go last
(function layout() {
  const R = UMAX / sqrt(3);
  for (let a = 0; a < 3; a++) {
    const ang = PI / 2 + (a * TAU) / 3;
    for (let i = 1; i <= 9; i++) {
      const r = R * Math.pow(i / 9, 1.45);
      AE[a * 9 + i - 1] = r * cos(ang);
      AN[a * 9 + i - 1] = r * sin(ang);
    }
  }
  const keys = [];
  for (let n = 0; n < NANT; n++) keys.push([(n % 9 === 8 ? 10 : 0) + hash2(n, 7), n]);
  keys.sort((p, q) => p[0] - q[0]);
  for (const k of keys) RANK.push(k[1]);
})();
const BE = new Float64Array(NANT * NANT); // baselines of the dishes still on
const BN = new Float64Array(NANT * NANT);
const BW = new Float64Array(NANT * NANT);

const BR = new Float64Array(NANT * NANT);
const DENS = new Float64Array(16);

function baselines(S, dropped) {
  const on = RANK.slice(dropped).sort((p, q) => p - q);
  let b = 0;
  for (let i = 0; i < on.length; i++) {
    for (let j = i + 1; j < on.length; j++) {
      const e = AE[on[j]] - AE[on[i]];
      const n = AN[on[j]] - AN[on[i]];
      BE[b] = e;
      BN[b] = n;
      BR[b] = sqrt(e * e + n * n) / UMAX;
      b++;
    }
  }
  S.nb = b;
  // Briggs-like weights: the baselines in a ring of the u-v plane share the
  // weight the ring would have if they were spread evenly, so the many short
  // baselines of the Y do not make the beam a core on a pedestal, and the
  // very longest roll off.
  DENS.fill(0);
  for (let k = 0; k < b; k++) DENS[min(15, floor(BR[k] * 14))]++;
  let mean = 0;
  for (let i = 0; i < 16; i++) {
    DENS[i] /= 2 * i + 1;
    mean += DENS[i];
  }
  mean /= 16;
  for (let k = 0; k < b; k++) {
    const r = BR[k];
    BW[k] = ((RINGS + r) * exp(-r * r * TAPER) * (1 + SHORT * exp(-r * r * 25))) / (DENS[min(15, floor(r * 14))] + ROBUST * mean);
  }
}

// ---- the ring of u-v samples ------------------------------------------------
// The u-v plane is gridded on 128 x 256 cells, twice the panel each way, and
// one inverse FFT a frame turns the grid into the dirty image. A sample is
// spread over 6 x 6 cells with a Gaussian, and the image is divided by the
// Gaussian's transform afterwards, which is how a radio imager does it.
const NX = 128;
const NY = 256;
const KS = 0.7; // the gridding kernel's width in cells
const GR = new Float64Array(NX * NY);
const GI = new Float64Array(NX * NY);
const WR = new Float64Array(NX * NY);
const WI = new Float64Array(NX * NY);
const ROWS = new Int32Array(NY); // samples touching each row of the grid
const TR = new Float64Array(NY);
const TI = new Float64Array(NY);
const TC = new Float64Array(NY);
const TS = new Float64Array(NY);
const REV7 = new Int32Array(NX);
const REV8 = new Int32Array(NY);
const CORR = new Float32Array(NPX);
(function tables() {
  for (let k = 0; k < NY; k++) {
    TC[k] = cos((TAU * k) / NY);
    TS[k] = sin((TAU * k) / NY);
  }
  for (let i = 0; i < NX; i++) REV7[i] = (REV7[i >> 1] >> 1) | ((i & 1) << 6);
  for (let i = 0; i < NY; i++) REV8[i] = (REV8[i >> 1] >> 1) | ((i & 1) << 7);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = (x - 32) / NX;
      const fy = (y - 64) / NY;
      CORR[y * W + x] = exp(2 * PI * PI * KS * KS * (fx * fx + fy * fy)) / (KS * KS * TAU);
    }
  }
})();

function fft(re, im, o, n, rev) {
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[o + i];
      re[o + i] = re[o + j];
      re[o + j] = t;
      t = im[o + i];
      im[o + i] = im[o + j];
      im[o + j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = NY / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = o + i + j;
        const b = a + half;
        const xr = re[b] * TC[k] - im[b] * TS[k];
        const xi = re[b] * TS[k] + im[b] * TC[k];
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

const wxs = new Float64Array(6);
const wys = new Float64Array(6);

// Put one sample on the grid (sign +1) or take it off (sign -1).
function addSlot(S, i, sign) {
  const w = S.sw[i] * sign;
  const vr = S.svr[i] * w;
  const vi = S.svi[i] * w;
  S.wsum += w;
  const fx = S.su[i] * NX;
  const fy = S.sv[i] * NY;
  const x0 = floor(fx) - 2;
  const y0 = floor(fy) - 2;
  const k = -1 / (2 * KS * KS);
  for (let j = 0; j < 6; j++) {
    const dx = x0 + j - fx;
    const dy = y0 + j - fy;
    wxs[j] = exp(k * dx * dx);
    wys[j] = exp(k * dy * dy);
  }
  for (let jy = 0; jy < 6; jy++) {
    const row = (y0 + jy) & (NY - 1);
    ROWS[row] += sign;
    const ry = row * NX;
    const wy = wys[jy];
    for (let jx = 0; jx < 6; jx++) {
      const g = wy * wxs[jx];
      const o = ry + ((x0 + jx) & (NX - 1));
      GR[o] += vr * g;
      GI[o] += vi * g;
    }
  }
}

// The dirty image: inverse FFT along the grid's rows, then along the columns
// the panel shows, keeping the real part.
function dirtyImage(S) {
  const img = S.acc;
  for (let ky = 0; ky < NY; ky++) {
    if (ROWS[ky] <= 0) continue;
    const o = ky * NX;
    for (let kx = 0; kx < NX; kx++) {
      WR[o + kx] = GR[o + kx];
      WI[o + kx] = GI[o + kx];
    }
    fft(WR, WI, o, NX, REV7);
  }
  for (let x = 0; x < W; x++) {
    const p = (x - 32) & (NX - 1);
    for (let ky = 0; ky < NY; ky++) {
      if (ROWS[ky] > 0) {
        TR[ky] = WR[ky * NX + p];
        TI[ky] = WI[ky * NX + p];
      } else {
        TR[ky] = 0;
        TI[ky] = 0;
      }
    }
    fft(TR, TI, 0, NY, REV8);
    for (let y = 0; y < H; y++) img[y * W + x] = TR[(y - 64) & (NY - 1)] * CORR[y * W + x];
  }
}

// Measure one baseline of the array at time tj: where the Earth has turned it
// to, which point of the u-v plane that is, and what the sky there looks like.
function putSlot(S, i, tj, c) {
  if (S.skyT !== tj) {
    skyAt(tj);
    S.skyT = tj;
  }
  const b = (c * 61) % S.nb;
  const h = S.H - S.om * (S.T - tj);
  const ch = cos(h);
  const sh = sin(h);
  const u = S.sc * (BE[b] * ch - BN[b] * sh);
  const v = S.sc * EPS * (BE[b] * sh + BN[b] * ch);
  const rr = u * u + v * v;
  let vr = 0;
  let vi = 0;
  for (let k = 0; k < NS; k++) {
    const a = sa[k];
    if (a < 0.002) continue;
    const amp = a * exp(-sg[k] * rr);
    const ph = TAU * (u * sx[k] + v * sy[k]);
    vr += amp * cos(ph);
    vi -= amp * sin(ph);
  }
  // the LEDs sit half a cell off the grid's origin; the shift goes in the phase
  const sh2 = PI * (u + v);
  const c2 = cos(sh2);
  const s2 = sin(sh2);
  S.t[i] = tj;
  S.c[i] = c;
  S.su[i] = u;
  S.sv[i] = v;
  S.svr[i] = vr * c2 - vi * s2;
  S.svi[i] = vr * s2 + vi * c2;
  S.sw[i] = BW[b];
}

function pushSlot(S, tj) {
  if (S.count >= CAP) popSlot(S);
  const i = S.head;
  putSlot(S, i, tj, S.ctr++);
  addSlot(S, i, 1);
  S.head = (i + 1) % CAP;
  S.count++;
}

function popSlot(S) {
  addSlot(S, S.tail, -1);
  S.tail = (S.tail + 1) % CAP;
  S.count--;
  if (S.sweep > 0) S.sweep--;
}

// How long a window of the data is used, seconds. It breathes between a
// couple of seconds, a snapshot, and the whole 8.5, at rates that do not divide.
function windowAt(t) {
  const q = 0.5 * (0.55 * sin(0.1401 * t - 1.404) + 0.45 * sin(0.0945 * t - 0.334));
  return LMIN + (LMAX - LMIN) * cl(0.5 + 1.6 * q, 0, 1);
}

// ---- the colour ---------------------------------------------------------------
// OKLCH stops (position, lightness, chroma, hue in degrees): afmhot-like.
const POS = [
  [0.0, 0.0, 0.0, -5],
  [0.08, 0.16, 0.06, -5],
  [0.26, 0.34, 0.14, 18],
  [0.46, 0.5, 0.19, 32],
  [0.66, 0.72, 0.17, 56],
  [0.83, 0.9, 0.16, 93],
  [1.0, 0.985, 0.03, 100],
];
const NEG = [
  [0.0, 0.0, 0.0, 275],
  [0.5, 0.27, 0.12, 282],
  [1.0, 0.44, 0.16, 272],
];

function encode(x) {
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function oklch(L, C, hue, out, o) {
  const h = (hue * PI) / 180;
  const a = C * cos(h);
  const b = C * sin(h);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  out[o] = 255 * encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  out[o + 1] = 255 * encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  out[o + 2] = 255 * encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}

function ramp(stops, x, rot, out, o) {
  let j = 0;
  while (j < stops.length - 2 && stops[j + 1][0] <= x) j++;
  const p = stops[j];
  const q = stops[j + 1];
  const t = cl((x - p[0]) / (q[0] - p[0]), 0, 1);
  oklch(p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, p[3] + (q[3] - p[3]) * t + rot, out, o);
}

const GAMMA = 0.58; // lifts the faint sidelobes
const FLOOR = 0.05; // the faintest ripple that is drawn, against the peak
const NEGFULL = 0.4; // a bowl this deep, against the peak, is the dim blue at its brightest

function buildLut(S, rot) {
  for (let i = 0; i < 256; i++) ramp(POS, Math.pow(max(0, i / 255 - FLOOR) / (1 - FLOOR), GAMMA), rot, S.lutP, i * 3);
  for (let i = 0; i < 128; i++) ramp(NEG, max(0, i / 127 - 0.12) / 0.88, rot, S.lutN, i * 3);
  S.lutRot = rot;
}

// ---- the pattern ---------------------------------------------------------------
export function setup(params) {
  // the grid is module-wide; a second setup starts it clean
  GR.fill(0);
  GI.fill(0);
  ROWS.fill(0);
  params.s = {
    ready: false,
    acc: new Float32Array(NPX),
    wsum: 0,
    t: new Float64Array(CAP),
    c: new Float64Array(CAP),
    su: new Float32Array(CAP),
    sv: new Float32Array(CAP),
    svr: new Float32Array(CAP),
    svi: new Float32Array(CAP),
    sw: new Float32Array(CAP),
    head: 0,
    tail: 0,
    count: 0,
    ctr: 0,
    sweep: 0,
    nb: 0,
    skyT: -1e9,
    T: 0,
    H: 0.5,
    om: 0.2,
    rate: RATE,
    sc: 1,
    drop: 0,
    sig: "",
    peak: 1,
    lutP: new Uint8Array(256 * 3),
    lutN: new Uint8Array(128 * 3),
    lutRot: -1,
    carry: 0,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const hue = cl(kn[0], 0, 1);
  const rot = cl(kn[1], 0, 4);
  const drop = floor(cl(kn[2], 0, 15) + 0.5);
  const wl = cl(kn[3], -1, 1);

  const sig = floor(rot * 40 + 0.5) + ":" + drop + ":" + floor(wl * 50 + 0.5);
  const ang = floor(hue * 256) / 256;
  if (ang !== S.lutRot) buildLut(S, ang * 360);

  S.om = 0.05 + 0.1 * rot;
  S.rate = RATE * cl(S.om / 0.25, 0.5, 2.1);
  S.sc = exp(-0.6 * (wl - 0.06));
  if (drop !== S.drop || !S.ready) {
    S.drop = drop;
    baselines(S, drop);
  }

  if (!S.ready) {
    // Pre-roll: the window as it would stand if the Y had been watching the
    // sky for as long as the window is long.
    S.ready = true;
    S.sig = sig;
    const t0 = 2;
    S.T = t0;
    S.H = 0.5 + S.om * t0;
    const L = windowAt(t0);
    const n = floor(S.rate * L);
    for (let k = 0; k < n; k++) {
      const tj = floor((t0 - L + (L * (k + 0.5)) / n) * 30) / 30;
      pushSlot(S, tj);
    }
  } else {
    S.T += d;
    S.H += S.om * d;
    if (sig !== S.sig) {
      S.sig = sig;
      S.sweep = 0;
    }
    // the dishes take their samples
    S.carry += S.rate * d;
    const n = floor(S.carry);
    S.carry -= n;
    for (let k = 0; k < n; k++) pushSlot(S, S.T);
    // the oldest samples leave
    const L = windowAt(S.T);
    while (S.count > 0 && S.T - S.t[S.tail] > L) popSlot(S);
    // after a knob has moved, measure the window again, a few dozen slots a frame
    let budget = 450;
    while (S.sweep < S.count && budget-- > 0) {
      const i = (S.tail + S.sweep) % CAP;
      addSlot(S, i, -1);
      putSlot(S, i, S.t[i], S.c[i]);
      addSlot(S, i, 1);
      S.sweep++;
    }
  }

  dirtyImage(S);
  // The picture's own exposure follows the brightest value slowly
  const acc = S.acc;
  let mx = 0;
  for (let i = 0; i < NPX; i++) if (acc[i] > mx) mx = acc[i];
  const peak = mx / max(S.wsum, 1e-9);
  const k = 1 - exp(-d / 3);
  S.peak = S.peak + (max(peak, 0.3) - S.peak) * (d > 0 ? k : 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const acc = S.acc;
  const lp = S.lutP;
  const ln = S.lutN;
  const gp = 255 / (S.peak * S.wsum);
  const gn = 127 / (NEGFULL * S.peak * S.wsum);
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const a = acc[i];
      if (a >= 0) {
        const p = 3 * min(255, floor(a * gp + 0.5));
        display.setPixel(x, y, lp[p], lp[p + 1], lp[p + 2]);
      } else {
        const p = 3 * min(127, floor(-a * gn + 0.5));
        display.setPixel(x, y, ln[p], ln[p + 1], ln[p + 2]);
      }
    }
  }
}
