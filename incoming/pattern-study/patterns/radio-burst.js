// ===== Patternflow pattern =====
// Title:   Radio Burst
// Family:  fastradio
// Idea:    The dynamic spectrum of a radio telescope scrolls across the panel, radio frequency up the 128 rows and time along the 64 columns, and fast radio bursts sweep through the receiver noise as bright swooping arcs because the cold plasma between the stars delays low frequencies most, while a pulsar puts in a train of fainter arcs, interference draws teal stripes, and a thin trial arc hunts through dispersion measures until one burst matches it and flares.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the dynamic spectrum of single-pulse radio astronomy and the cold plasma dispersion delay (4.149 ms times DM times the difference of nu^-2, after Lorimer and Kramer's handbook, from memory), the first fast radio burst found in old Parkes data by Duncan Lorimer and colleagues (2007), the pulsar found by Jocelyn Bell and Antony Hewish (1967), scatter broadening that goes as nu^-4 and diffractive scintillation (Rickett 1969, from memory), incoherent dedispersion by trial DM as every burst search does it, pattern round 237
// Round:   237
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Dispersion=0..2.5, Scatter=-1..1, Rate=-1..1
//
// Knob 1: Hue. Turns the signal's palette round the wheel. At 0 the noise is indigo, the signal runs violet, magenta, orange and cream, interference is teal and the trial arc is pale green. Turned away from 0 the signal, the stripes and the trial arc take the whole wheel, while the noise ground only sways about indigo, violet and blue so that it never goes brown.
// Knob 2: Dispersion. 0 to 2.5, opening at 2. The typical dispersion measure of the bursts: the time a burst takes to sweep from the top row to the bottom one is 0.3 s at 0, which is 2 columns, so the arcs are almost upright flashes, and 7.5 s at 2.5, which is 60 columns, so each arc is one long shallow swoop that runs off the panel. At 2 it is 3.9 s, about 31 columns. Every burst has its own value around that, and an arc already on the panel stretches as the knob turns.
// Knob 3: Scatter. -1 to 1, opening at 0. At -1 the arcs are sharp, thin and smooth. Turned up, the lower rows of each burst smear to the later side in a tail that grows as the fourth power of the wavelength, up to 20 columns long at the bottom, and scintillation tears the arc into bright blotches with gaps between them, 6 to 14 blotches over the band.
// Knob 4: Rate. -1 to 1, opening near 0. How often a burst arrives, from one every 5 s at -1 to nearly one a second at 1, when a dozen arcs cross each other. The pulsar's train of fainter arcs, one every 2.1 s, comes at every setting, so the panel never has fewer than three or four arcs.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, exp, log, pow, sqrt, sin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// The wait between bursts, in units of the mean wait: two exponentials averaged, so they come a little more evenly than a Poisson stream.
const gap = () => -0.5 * (log(1 - Math.random()) + log(1 - Math.random()));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.5 * b), min(1, v * (1 + 1.1 * b * (1 - v))), out, o);
}

// The ramp from receiver noise to the strongest signal: level, hue, saturation, value.
const KEYS = [
  [0.0, 0.68, 0.9, 0.05],
  [0.1, 0.69, 0.88, 0.14],
  [0.2, 0.7, 0.85, 0.27],
  [0.32, 0.74, 0.78, 0.45],
  [0.46, 0.82, 0.75, 0.66],
  [0.6, 0.9, 0.72, 0.86],
  [0.74, 0.99, 0.7, 1.0],
  [0.86, 1.05, 0.58, 1.0],
  [1.0, 1.11, 0.3, 1.0],
  [1.2, 1.14, 0.12, 1.0],
];
const LUTN = 512, LMAX = 1.2;

// The noise ground only sways about indigo as the wheel turns, so it never goes brown; from the
// violet end of the signal up, the ramp takes the whole turn of the wheel.
function rampAt(L, hue, c) {
  let k = 0;
  while (k < KEYS.length - 2 && L > KEYS[k + 1][0]) k++;
  const a = KEYS[k], b = KEYS[k + 1], f = cl((L - a[0]) / (b[0] - a[0]), 0, 1);
  const gs = 0.14 * sin(TAU * hue);
  let dl = hue - gs;
  dl -= floor(dl + 0.5);
  dim(a[1] + (b[1] - a[1]) * f + gs + dl * sstep(0.22, 0.58, L), a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, c, 0);
}
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

// The low end of the ramp keeps the brightness it has in indigo whatever the hue.
function buildLut(lut, hue) {
  const c = [0, 0, 0], c0 = [0, 0, 0];
  for (let i = 0; i < LUTN; i++) {
    const L = (i / (LUTN - 1)) * LMAX;
    rampAt(L, hue, c);
    rampAt(L, 0, c0);
    const w = 1 - sstep(0.3, 0.6, L), m = pow(min(2.2, (luma(c0) + 0.01) / (luma(c) + 0.01)), w);
    lut[i * 3] = min(1, c[0] * m) * 255;
    lut[i * 3 + 1] = min(1, c[1] * m) * 255;
    lut[i * 3 + 2] = min(1, c[2] * m) * 255;
  }
}

// ---- hash noise, stable as the picture scrolls ---------------------------
let SALT = 0;
function hash32(a, b) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + SALT, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
const rnd01 = (a, b) => hash32(a, b) / 4294967296;

// ---- the band -------------------------------------------------------------
// 1.5 GHz at the top row down to 0.7 GHz at the bottom. G is the delay of each row as a fraction of
// the delay of the bottom row, which goes as nu^-2 minus nu_hi^-2, so an arc is upright at the top
// and runs flat at the bottom. DG is its slope in fractions per row. Q4 is the scatter of the row
// against the top row, which goes as nu^-4.
const NU_HI = 1.5, NU_LO = 0.7;
const G = new Float64Array(H), DG = new Float64Array(H), Q4 = new Float64Array(H);
{
  const span = 1 / (NU_LO * NU_LO) - 1 / (NU_HI * NU_HI);
  for (let y = 0; y < H; y++) {
    const nu = NU_HI - ((NU_HI - NU_LO) * (y + 0.5)) / H;
    G[y] = (1 / (nu * nu) - 1 / (NU_HI * NU_HI)) / span;
    Q4[y] = pow(NU_HI / nu, 4);
  }
  for (let y = 0; y < H; y++) DG[y] = (G[min(H - 1, y + 1)] - G[max(0, y - 1)]) / (min(H - 1, y + 1) - max(0, y - 1));
}

const SPEED = 8;    // columns of time a second
const TAUMAX = 20;  // the longest scatter tail, in columns
const CAP = 30;     // most arcs alive at once

// ---- the pulse profile ----------------------------------------------------
// A Gaussian of width sigma convolved with the exponential tail of the scatter, tau (the
// exponentially modified Gaussian). z is the distance from the arrival in sigmas, r is tau over sigma.
const POLY = (t) => t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));
function exg(z, r) {
  const a = 1 / r - z;
  if (a > 0) {
    const t = 1 / (1 + 0.35355339 * a);
    return ((0.5 / r) * t) * exp(-0.5 * z * z - 1.26551223 + POLY(t));
  }
  const t = 1 / (1 - 0.35355339 * a);
  const qc = 0.5 * t * exp(-0.5 * a * a - 1.26551223 + POLY(t));
  return (1 / r) * exp(0.5 / (r * r) - z / r) * (1 - qc);
}
// The peak of the profile for 40 values of r, so every arc has the same height however much it scatters.
const R0 = 0.15, RSTEP = 1.16, NPK = 40;
const PEAK = new Float64Array(NPK);
for (let i = 0; i < NPK; i++) {
  const r = R0 * pow(RSTEP, i);
  let pk = 0;
  for (let z = -1; z < 8; z += 0.05) pk = max(pk, exg(z, r));
  PEAK[i] = pk;
}
const peakOf = (r) => {
  const p = cl(log(r / R0) / log(RSTEP), 0, NPK - 1.001), i = floor(p);
  return PEAK[i] + (PEAK[i + 1] - PEAK[i]) * (p - i);
};

// ---- one burst or one pulse ----------------------------------------------
const lerp = (a, b, f) => a + (b - a) * f;
function newArc(k, t0, A) {
  const lat = new Float32Array(32);
  for (let i = 0; i < 32; i++) lat[i] = Math.random();
  // The spectrum of the arc: a tilt across the band, or in one arc of three a band of its own.
  const env = new Float32Array(H);
  const alpha = (Math.random() - 0.5) * 2.4, bl = k === 0 && Math.random() < 0.34 ? 0.8 + 0.2 * Math.random() : 0;
  const yc = 14 + Math.random() * 100, wy = 16 + Math.random() * 26;
  for (let y = 0; y < H; y++) {
    const broad = exp(alpha * (0.5 - y / 127));
    const band = exp(-0.5 * ((y - yc) / wy) ** 2);
    env[y] = lerp(broad, band, bl);
  }
  let top = 0;
  for (let y = 0; y < H; y++) top = max(top, env[y]);
  for (let y = 0; y < H; y++) env[y] /= top;
  return {
    k, t0, A, env, lat, flare: 0, hit: false,
    rel: cl(exp(0.38 * gauss()), 0.45, 2.2),
    s0: 0.8 + 0.8 * Math.random(),
    tr: 0.5 + 1.1 * Math.random(),
    Ls: 128 / (6 + 8 * Math.random()),
    off: Math.random() * 32,
    drift: (Math.random() - 0.5) * 0.8,
    Ts: 1,
  };
}

// ---- state ----------------------------------------------------------------
const GN = 80;       // columns of grain kept
const NST = 5;       // interference stripes
export function setup(params) {
  SALT = floor(Math.random() * 1e9) | 0;
  params.st = {
    k: [0, 2, 0, 0.06], t: -26, init: false,
    ev: [], haz: 0, hnext: gap(), tp: -26 + Math.random() * 2,
    lg: log(3.9), tf: 0, ph: Math.random() * TAU,
    rf: Array.from({ length: NST }, (_, i) => ({ id: i, on: false, next: -26 + Math.random() * 10, t0: 0, y0: 0, amp: 1, segs: [] })),
    sp: [], nextSp: -26 + Math.random() * 8,
    hue: -9, lut: new Float32Array(LUTN * 3),
    gi: new Int32Array(GN).fill(-1e9), gd: new Float32Array(GN * H),
    L: new Float32Array(NPX), R: new Float32Array(NPX), Gc: new Float32Array(NPX), B: new Float32Array(NPX), cov: new Float32Array(NPX),
    raw: new Float32Array(H + 2), bp: new Float32Array(H), cl: new Float32Array(10 * 22), xg: new Float64Array(H),
  };
}

const tsTyp = (k2) => 0.3 * pow(25, cl(k2, 0, 2.5) / 2.5);
const tsOf = (st, ev) => (ev.k === 0 ? min(11, tsTyp(st.k[1]) * ev.rel) : 0.9 * pow(tsTyp(st.k[1]) / 3, 0.25) * (0.9 + 0.2 * ev.rel / 2.2));
const xTopOf = (ev, t) => W - SPEED * (t - ev.t0);
// The column the trial arc stands on at its top: it slides to and fro over 30 columns and never keeps a place.
const xgOf = (st, t) => 27 + 12 * sin((TAU * t) / 37 + st.ph) + 6 * sin((TAU * t) / 23.3 + 1.7);

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 2.5), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    // Run the last 26 s before the first frame, so the panel opens with arcs already on it.
    while (st.t < 0) step(st, 0.1);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

function step(st, d) {
  st.t += d;
  const t = st.t, k4 = st.k[3];
  // Bursts arrive at a mean rate the Rate knob sets.
  const lam = 0.2 * pow(4.5, (k4 + 1) / 2);
  st.haz += lam * d;
  while (st.haz >= st.hnext) {
    st.haz -= st.hnext;
    st.hnext = gap();
    if (st.ev.length < CAP) st.ev.push(newArc(0, t - st.haz / lam, exp(log(0.4) + Math.random() * log(1.2 / 0.4))));
  }
  // The pulsar: a pulse about every 2 s, now and then missing, its amplitude different each time.
  while (st.tp <= t) {
    if (Math.random() > 0.12 && st.ev.length < CAP + 8) st.ev.push(newArc(1, st.tp, 0.2 + 0.34 * Math.random() * Math.random() + 0.1 * Math.random()));
    st.tp += 2.1 * (1 + 0.07 * sin((TAU * st.tp) / 41 + st.ph) + 0.03 * sin((TAU * st.tp) / 97)) * (1 + 0.03 * gauss());
  }
  // Interference stripes switch on at a new channel and off again after seconds to tens of seconds.
  for (const s of st.rf) {
    while (t >= s.next) {
      if (s.on) {
        s.segs.push({ t0: s.t0, t1: s.next, y0: s.y0, amp: s.amp });
        s.on = false;
        s.next += 3 + 22 * pow(Math.random(), 1.2);
      } else {
        s.on = true;
        s.t0 = s.next;
        s.y0 = 2 * floor(2 + Math.random() * 60);
        s.amp = 0.55 + 0.45 * Math.random();
        s.next += 1 + 14 * pow(Math.random(), 1.6);
      }
    }
    while (s.segs.length && s.segs[0].t1 < t - 10) s.segs.shift();
  }
  // Broadband spikes across every channel at once, now and then.
  if (t >= st.nextSp) {
    st.sp.push({ t: st.nextSp, a: 0.7 + 0.3 * Math.random(), salt: floor(Math.random() * 1e6) });
    st.nextSp += 9 + 22 * Math.random();
  }
  while (st.sp.length && st.sp[0].t < t - 10) st.sp.shift();

  // The search. The trial arc's dispersion measure wanders; when a burst is coming up on it, the
  // trial arc hunts around that burst's dispersion measure and settles on it as the burst arrives.
  let tgt = null, best = 1e9;
  const XG = xgOf(st, t);
  for (const ev of st.ev) {
    ev.Ts = tsOf(st, ev);
    if (ev.k !== 0 || ev.hit) continue;
    const dx = xTopOf(ev, t) - XG;
    if (dx < -1.5) ev.hit = true;
    else if (dx < best) (best = dx), (tgt = ev);
  }
  let want;
  if (tgt && best < 46) want = log(tgt.Ts) + 0.55 * sin(TAU * 0.31 * t + st.ph) * cl(best / 40, 0, 1);
  else want = log(tsTyp(st.k[1]) * 1.1) + 0.5 * sin((TAU * t) / 11.3 + 1) + 0.32 * sin((TAU * t) / 17.9 + 2) + 0.2 * sin((TAU * t) / 6.7);
  st.lg += (want - st.lg) * (1 - exp(-d / 0.45));
  let tf = st.tf * exp(-d / 0.9);
  for (const ev of st.ev) {
    ev.flare *= exp(-d / 1.3);
    if (ev.k !== 0) continue;
    const dx = xTopOf(ev, t) - XG;
    if (abs(dx) < 7) {
      const R = exp(-0.5 * (dx / 2.2) ** 2) * exp(-0.5 * ((log(ev.Ts) - st.lg) / 0.12) ** 2);
      if (R > ev.flare) ev.flare = R;
      if (R > tf) tf = R;
    }
  }
  st.tf = tf;

  // Arcs leave once their last visible bit has gone off the left edge.
  const sc = (st.k[2] + 1) / 2;
  const tauTop = 0.06 + pow(sc, 1.4);
  for (let i = st.ev.length - 1; i >= 0; i--) {
    const ev = st.ev[i];
    const xb = xTopOf(ev, t) + SPEED * ev.Ts * G[H - 1];
    const tau = min(TAUMAX, tauTop * ev.tr * (ev.k ? 0.5 : 1) * Q4[H - 1]);
    if (xb + 5 + 4.4 * tau < 0) st.ev.splice(i, 1);
  }
}

// ---- drawing --------------------------------------------------------------
function grainCol(st, i) {
  const s = ((i % GN) + GN) % GN, o = s * H;
  if (st.gi[s] !== i) {
    st.gi[s] = i;
    const raw = st.raw;
    for (let y = -1; y <= H; y++) {
      const h = hash32(i, y);
      raw[y + 1] = ((h & 1023) + ((h >>> 10) & 1023) + ((h >>> 20) & 1023)) / 511.5 - 3;
    }
    // Each channel leans on its neighbours, so the grain is soft, about 2 LEDs a grain, and a lit grain is not a lone dot.
    for (let y = 0; y < H; y++) st.gd[o + y] = (raw[y] + 2 * raw[y + 1] + raw[y + 2]) * 0.40824829;
  }
  return o;
}

// Smooth random value of a lattice at u, 0 to 1.
function vn1(arr, u) {
  const i = floor(u), f = u - i, w = f * f * (3 - 2 * f);
  const a = arr[i & 31], b = arr[(i + 1) & 31];
  return a + (b - a) * w;
}

function drawBackground(st, t) {
  const { L, gd, bp, cl: cloud } = st;
  const scroll = SPEED * t;
  // The bandpass: a few slow ripples across the channels.
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    bp[y] =
      1 +
      0.15 * sin(TAU * 1.6 * v + 0.9 * sin(t * 0.13) + t * 0.19) +
      0.1 * sin(TAU * 3.3 * v + 2.1 - t * 0.27) +
      0.07 * sin(TAU * 6.1 * v + 4.3 + t * 0.37) -
      0.2 * (1 - sstep(0, 0.07, v)) -
      0.2 * sstep(0.94, 1, v);
  }
  // Slow value noise in time and in channel, a lattice 12 columns by 7 rows.
  const ci0 = floor((scroll - W) / 12) - 1;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 22; j++) cloud[i * 22 + j] = rnd01(ci0 + i + 77, j + 500);
  for (let x = 0; x < W; x++) {
    const u = scroll + x + 0.5 - W;
    const i0 = floor(u), f = u - i0;
    const w0 = ((1 - f) * (1 - f) * (1 - f)) / 6, w3 = (f * f * f) / 6;
    const w1 = (3 * f * f * f - 6 * f * f + 4) / 6, w2 = (-3 * f * f * f + 3 * f * f + 3 * f + 1) / 6;
    const nrm = 1 / sqrt(w0 * w0 + w1 * w1 + w2 * w2 + w3 * w3);
    const o0 = grainCol(st, i0 - 1), o1 = grainCol(st, i0), o2 = grainCol(st, i0 + 1), o3 = grainCol(st, i0 + 2);
    // Gain wander in time, a vertical band that slides along with the picture.
    const gu = u / 11, gi = floor(gu), gf = gu - gi, gw = gf * gf * (3 - 2 * gf);
    const gain = 0.88 + 0.24 * (rnd01(gi, 31) * (1 - gw) + rnd01(gi + 1, 31) * gw);
    const cu = u / 12 - ci0, cI = floor(cu), cF = cu - cI, cW = cF * cF * (3 - 2 * cF);
    for (let y = 0; y < H; y++) {
      const gr = (w0 * gd[o0 + y] + w1 * gd[o1 + y] + w2 * gd[o2 + y] + w3 * gd[o3 + y]) * nrm;
      const cv = (y + 0.5) / 7, cj = floor(cv), cf = cv - cj, cw = cf * cf * (3 - 2 * cf);
      const a = cloud[cI * 22 + cj] * (1 - cW) + cloud[(cI + 1) * 22 + cj] * cW;
      const b = cloud[cI * 22 + cj + 1] * (1 - cW) + cloud[(cI + 1) * 22 + cj + 1] * cW;
      const cd = a + (b - a) * cw;
      L[y * W + x] = 0.27 * bp[y] * gain * (0.72 + 0.56 * cd) * exp(0.3 * gr - 0.045);
    }
  }
}

function drawArcs(st, t) {
  const L = st.L, sc = (st.k[2] + 1) / 2;
  const tauTop = 0.06 + pow(sc, 1.4), mod0 = 0.05 + 0.95 * pow(sc, 1.1);
  for (const ev of st.ev) {
    const pulse = ev.k === 1;
    const sweep = SPEED * ev.Ts, xTop = xTopOf(ev, t);
    const tt = tauTop * ev.tr * (pulse ? 0.5 : 1), mod = mod0 * (pulse ? 0.6 : 1);
    const Aeff = ev.A * (1 + 0.5 * ev.flare) + 0.3 * ev.flare;
    for (let y = 0; y < H; y++) {
      const xc = xTop + sweep * G[y];
      const sm = 0.6 * sweep * DG[y];
      const sg = sqrt(ev.s0 * ev.s0 + sm * sm);
      if (xc - 3.6 * sg > W) continue;
      const tau = min(TAUMAX, tt * Q4[y]), r = tau / sg;
      const xb = xc + 3.6 * sg + (r > R0 ? 4.4 * tau : 0);
      if (xb < 0) continue;
      let amp = Aeff * ev.env[y] * sqrt(ev.s0 / sg);
      if (amp < 0.01) continue;
      const su = y / ev.Ls + ev.off + ev.drift * ev.Ts * G[y];
      const n = vn1(ev.lat, su);
      amp *= 1 - mod + mod * min(1.5, 2.6 * n * n);
      if (amp < 0.01) continue;
      const pk = r > R0 ? sqrt(peakOf(r) / PEAK[0]) / peakOf(r) : 1;
      const x0 = max(0, floor(xc - 3.6 * sg)), x1 = min(W - 1, ceil(xb));
      const row = y * W, is = 1 / sg;
      if (r > R0) for (let x = x0; x <= x1; x++) L[row + x] += amp * pk * exg((x + 0.5 - xc) * is, r);
      else for (let x = x0; x <= x1; x++) {
        const z = (x + 0.5 - xc) * is;
        L[row + x] += amp * exp(-0.5 * z * z);
      }
    }
  }
}

// A line of width 2 through the points (xs[r], r + 0.5), coverage into buf.
function stroke(buf, xs) {
  for (let r = 0; r < H - 1; r++) {
    const xa = xs[r], xb = xs[r + 1], ya = r + 0.5, yb = r + 1.5;
    const lo = min(xa, xb) - 1.5, hi = max(xa, xb) + 1.5;
    if (hi < 0 || lo > W) continue;
    const px0 = max(0, floor(lo)), px1 = min(W - 1, floor(hi));
    const dx = xb - xa, dy = 1, l2 = dx * dx + dy * dy;
    for (let py = max(0, r - 1); py <= min(H - 1, r + 2); py++) {
      const cy = py + 0.5 - ya;
      for (let px = px0; px <= px1; px++) {
        const cx = px + 0.5 - xa;
        const q = cl((cx * dx + cy * dy) / l2, 0, 1);
        const ex = cx - q * dx, ey = cy - q * dy;
        const c = cl(1.5 - sqrt(ex * ex + ey * ey), 0, 1);
        const o = py * W + px;
        if (c > buf[o]) buf[o] = c;
      }
    }
  }
}

// Blend the colour c (0 to 1) into the pixel o by k.
function blend(st, o, c, k) {
  st.R[o] += (c[0] * 255 - st.R[o]) * k;
  st.Gc[o] += (c[1] * 255 - st.Gc[o]) * k;
  st.B[o] += (c[2] * 255 - st.B[o]) * k;
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const t = st.t, hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) (st.hue = hue), buildLut(st.lut, hue);
  const { L, R, Gc, B, lut } = st;
  drawBackground(st, t);
  drawArcs(st, t);
  for (let o = 0; o < NPX; o++) {
    // Where arcs overlap the level rounds off towards 1.3 instead of flooding to white.
    const v = L[o], lv = v > 0.8 ? 0.8 + 0.5 * (1 - exp(-(v - 0.8) / 0.5)) : v;
    const i = cl(floor((lv / LMAX) * (LUTN - 1) + 0.5), 0, LUTN - 1) * 3;
    R[o] = lut[i];
    Gc[o] = lut[i + 1];
    B[o] = lut[i + 2];
  }

  // Interference: teal stripes 2 LEDs high, a column wide when they begin and end.
  const col = [0, 0, 0], scroll = SPEED * t;
  hsv(0.5 + hue, 0.75, 0.9, col, 0);
  for (const s of st.rf) {
    const segs = s.on ? s.segs.concat([{ t0: s.t0, t1: t + 1e3, y0: s.y0, amp: s.amp }]) : s.segs;
    for (const g of segs) {
      const xs = W - SPEED * (t - g.t0), xe = min(W + 1, W - SPEED * (t - g.t1));
      if (xe < 0) continue;
      for (let x = max(0, floor(xs)); x <= min(W - 1, floor(xe)); x++) {
        const k = cl(x + 1 - xs, 0, 1) * cl(xe - x, 0, 1);
        const fl = 0.7 + 0.3 * rnd01(floor(scroll + x + 0.5 - W), s.id + 999);
        for (let dy = 0; dy < 2; dy++) {
          const o = (g.y0 + dy) * W + x;
          blend(st, o, col, k * fl * g.amp * 0.9 * (1 - 0.55 * min(1, L[o])));
        }
      }
    }
  }
  // Broadband spikes, a column and a half wide, stronger in some channels than others.
  hsv(0.5 + hue, 0.3, 1, col, 0);
  for (const sp of st.sp) {
    const xs = W - SPEED * (t - sp.t);
    if (xs < -2 || xs > W + 2) continue;
    for (let x = max(0, floor(xs - 2)); x <= min(W - 1, floor(xs + 2)); x++) {
      const kx = cl(1.4 - abs(x + 0.5 - xs), 0, 1);
      if (kx <= 0) continue;
      for (let y = 0; y < H; y++) {
        const v = vn1Hash(sp.salt, y / 9);
        const o = y * W + x;
        blend(st, o, col, kx * sp.a * (0.1 + 0.5 * v) * (1 - 0.5 * min(1, L[o])));
      }
    }
  }

  // The trial arc.
  const xg = st.xg, ts = exp(st.lg) * SPEED;
  const XG = xgOf(st, t);
  for (let y = 0; y < H; y++) xg[y] = XG + ts * G[y];
  st.cov.fill(0);
  stroke(st.cov, xg);
  hsv(0.37 + hue, 0.28, 0.95, col, 0);
  const wf = st.tf;
  for (let o = 0; o < NPX; o++) {
    const c = st.cov[o];
    if (c <= 0.002) continue;
    blend(st, o, col, c * (0.5 + 0.45 * wf));
  }

  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, floor(min(255, R[o])), floor(min(255, Gc[o])), floor(min(255, B[o])));
}

function vn1Hash(salt, u) {
  const i = floor(u), f = u - i, w = f * f * (3 - 2 * f);
  return rnd01(i, salt) * (1 - w) + rnd01(i + 1, salt) * w;
}
