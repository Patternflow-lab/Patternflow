// ===== Patternflow pattern =====
// Title:   Ground Tracks
// Family:  altimetry
// Idea:    A radar altimeter satellite measures the height of the sea surface only along its own thin ground track, so the panel shows a map of sea-surface height rebuilt from those stripes alone, where each new pass lights a well-measured corridor across a dim sea that nobody has looked at lately and the drifting eddies underneath rise and sink between visits.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: satellite radar altimetry, begun with Seasat (1978) and made routine by TOPEX/Poseidon (1992) and the Jason satellites, from memory; the sea-surface height anomaly of mesoscale eddies and Rossby waves; gridding along-track samples by optimal interpolation with a Gaussian correlation scale (Gandin 1963, Bretherton, Davis and Fandry 1976, from memory); the ground track of an inclined circular orbit, a diamond lattice of rising and falling passes that the turning Earth shifts about 27 degrees west each orbit, pattern round 238
// Round:   238
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Eddies=0..3, Scale=3..14, Satellites=-1..1
//
// Knob 1: Hue. Turns the sea's palette round the wheel. At 0 a low sea surface is deep ultramarine and teal, a level one is pale lime-white and a high one is warm coral, a place measured a while ago is the same ramp darker and cooler, and the satellites are magenta-pink. The dim colours and the warm end are lifted and paled where the wheel passes orange, so nothing goes brown.
// Knob 2: Eddies. 0 to 3, opening at 2. How alive the hidden ocean is. At 0 there are no eddies and only the planetary wave moves the surface, broad bands and ripples that travel west and swell and fade each on its own beat. Turned up, up to 36 eddies 5 to 14 LED in radius come in, each a hill or a hollow that drifts west and a little north or south, lives 30 to 100 s, swells and dies away, and the knob also raises their height and lowers the wave's.
// Knob 3: Scale. 3 to 14, opening at 3. The correlation length of the mapping in LED, the distance at which a measurement has fallen to 4 percent of its weight. At 3 the map is a lattice of narrow bright stripes along the passes over a dimmer sea. At 14 each measurement reaches almost half the width of the panel, the corridors run together and the whole sea shows as one smooth map, the small eddies blurred out and its colours stretched to keep it vivid.
// Knob 4: Satellites. -1 to 1, opening near 0. How many satellites fly, 1 at -1, 2 at 0 and 4 at 1, a satellite fading in as the knob passes its number. Their orbits take 7.25 to 7.95 s, so a pass runs across the panel in about 4 s, and each one added weaves the lattice shut faster and puts more trails on the panel.

const W = 64, H = 128, NPX = W * H;
const { floor, round, min, max, abs, exp, sqrt, sin, cos, atan2, asin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// ---- the map window ---------------------------------------------------------
// 64 columns are 120 degrees of longitude and wrap round; 128 rows are latitude +66 at the top
// to -66 at the bottom, which is as far as a 66 degree orbit goes.
const DLON = 120 / W, DLAT = 132 / H;
const INC = (66 * PI) / 180, SINI = sin(INC), COSI = cos(INC);
// The Earth turns 27.4 degrees under a 7.6 s orbit.
const OMEGA_E = (27.4 * PI) / 180 / 7.6;
const DEG = 180 / PI;

const NSAT = 4;
const SAT_T = [7.6, 7.25, 7.95, 7.4];  // seconds an orbit takes
const TRAIL_S = 6;                     // seconds a trail takes to fade
const CAPT = 420;
const TAU_AGE = 38;                    // seconds a sample keeps its weight, as exp(-age / TAU_AGE)
const TAU_SEEN = 6;                    // seconds a place stays "recently measured", which sets how bright it is
const W0 = 2, W0C = 1.5;                 // weight of the prior against the samples, slow and fast
const NOISE = 0.05;
const GAIN = 1.6, REF = 0.3;           // the ramp reaches its ends at a height of 0.62 when the map's spread is 0.3

// Where a satellite is on the panel at time t: x in columns (not wrapped), y in rows.
function satXY(s, t, out) {
  // The orbit's phase and its node wander a little (drag, and a bulging Earth), so the diamond mesh never lays itself down twice.
  const u = s.u0 + s.n * t + s.a1 * sin(s.w1 * t + s.p1);
  const su = sin(u), cu = cos(u);
  let lon = atan2(COSI * su, cu);
  lon += TAU * round((u - lon) / TAU);
  lon += s.l0 + s.b1 * sin(s.w2 * t + s.p2) - OMEGA_E * t;
  out[0] = (lon * DEG) / DLON;
  out[1] = (66 - asin(SINI * su) * DEG) / DLAT - 0.5;
}

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown on the panel, so it is lifted and paled
// there, over a wide enough stretch of hue that no step shows in the ramp.
function lift(h, s, v, out, o) {
  // A colour close to grey has no steady hue, so it is left alone.
  const c = h - floor(h), b = (c > 0.5 ? sstep(0.8, 0.95, c) : 1 - sstep(0.13, 0.26, c)) * sstep(0.12, 0.35, s);
  const dv = 1 - v;
  hsv(h, s * (1 - 0.45 * b * dv), min(1, v * (1 + 0.9 * b * dv)), out, o);
}

// The sea-surface ramp, height anomaly against colour as hue, saturation and value. The hue is carried through the
// ramp as a number of its own, so it runs from ultramarine down through teal and lime to coral without a jump.
const KEYS = [
  [-1.0, 0.667, 0.72, 0.96],
  [-0.65, 0.616, 0.79, 0.96],
  [-0.32, 0.497, 0.82, 0.76],
  [-0.1, 0.422, 0.37, 0.92],
  [0.0, 0.246, 0.2, 0.97],
  [0.14, 0.127, 0.25, 1.0],
  [0.36, 0.074, 0.45, 1.0],
  [0.66, 0.017, 0.59, 1.0],
  [1.0, -0.026, 0.66, 0.98],
];
const SMIN = -1.3, SMAX = 1.3, LUTN = 512, GROUND = LUTN * 9;
const SPAN = SMAX - SMIN;
// The same ramp as it looks where the last measurement is a while old, as if seen through deeper water: darker, the
// pale middle gone to mint and lavender, the warm end gone to rose.
const DKEYS = [
  [-1.0, 0.632, 0.78, 0.8],
  [-0.65, 0.596, 0.8, 0.8],
  [-0.32, 0.518, 0.83, 0.69],
  [-0.1, 0.478, 0.63, 0.73],
  [0.0, 0.465, 0.49, 0.78],
  [0.14, 0.49, 0.22, 0.74],
  [0.36, 0.944, 0.26, 0.8],
  [0.66, 0.932, 0.48, 0.77],
  [1.0, 0.917, 0.53, 0.68],
];
function rampRaw(keys, s, out) {
  let k = 0;
  while (k < keys.length - 2 && s > keys[k + 1][0]) k++;
  const a = keys[k], b = keys[k + 1], f = cl((s - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * f;
  out[1] = a[2] + (b[2] - a[2]) * f;
  out[2] = a[3] + (b[3] - a[3]) * f;
}
// lut: the ramp for a hue offset, the dimmed ramp, that once more at 0.7 of its brightness (a sea nobody has
// measured lately), then the satellite colours.
function put(lut, o, c) {
  lut[o] = c[0] * 255;
  lut[o + 1] = c[1] * 255;
  lut[o + 2] = c[2] * 255;
}
function buildLut(lut, hue) {
  const c = [0, 0, 0], h = [0, 0, 0];
  for (let i = 0; i < LUTN; i++) {
    const lev = SMIN + (i / (LUTN - 1)) * SPAN;
    for (let k = 0; k < 3; k++) {
      rampRaw(k ? DKEYS : KEYS, lev, h);
      lift(h[0] + hue, h[1], h[2] * (k === 2 ? 0.7 : 1), c, 0);
      put(lut, (k * LUTN + i) * 3, c);
    }
  }
  const g = GROUND;
  // The trail, and the white-hot core of a head.
  hsv(0.86 + hue, 0.62, 1, c, 0);
  lut[g + 3] = c[0] * 255;
  lut[g + 4] = c[1] * 255;
  lut[g + 5] = c[2] * 255;
  hsv(0.86 + hue, 0.14, 1, c, 0);
  lut[g + 6] = c[0] * 255;
  lut[g + 7] = c[1] * 255;
  lut[g + 8] = c[2] * 255;
}

// ---- the hidden ocean -------------------------------------------------------
// Eddies are slots that are born, drift west, swell and shrink, die and are born again somewhere
// else. Their place at any time follows from their birth, so nothing is integrated.
const NED = 36;
// The planetary wave: a few waves with whole numbers of crests round the window, going west,
// each with an amplitude that rises and falls on its own slow period.
const NWV = 28, NBROAD = 11;
const PGW = 16, PGH = 32, PRIOR = 0.85;

function respawn(st, i, t) {
  const E = st.ed;
  E.x0[i] = Math.random() * W;
  E.y0[i] = rnd(6, H - 6);
  E.vx[i] = -3.1 * (0.1 + 0.5 * Math.random() * Math.random() + 0.1 * Math.random());
  E.vy[i] = (Math.random() < 0.5 ? -1 : 1) * rnd(0.08, 0.6);
  E.R[i] = 5 + 9 * Math.pow(Math.random(), 1.2);
  E.A[i] = (Math.random() < 0.5 ? -1 : 1) * (0.35 + 0.65 * Math.pow(Math.random(), 0.8));
  E.tb[i] = t;
  E.life[i] = rnd(30, 100);
}

function initOcean(st, t) {
  const E = (st.ed = {
    x0: new Float32Array(NED), y0: new Float32Array(NED), vx: new Float32Array(NED), vy: new Float32Array(NED),
    R: new Float32Array(NED), A: new Float32Array(NED), tb: new Float64Array(NED), life: new Float32Array(NED),
    th: new Float32Array(NED),
    cx: new Float32Array(NED), cy: new Float32Array(NED), cs: new Float32Array(NED), ca: new Float32Array(NED), cr: new Float32Array(NED),
  });
  // Each slot switches on at its own level of the Eddies knob.
  const order = Array.from({ length: NED }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (let i = 0; i < NED; i++) {
    respawn(st, i, t);
    E.tb[i] = t - Math.random() * E.life[i];
    E.th[order[i]] = 0.04 + (0.86 * (i + Math.random())) / NED;
  }
  const wv = (st.wv = {
    kx: new Float32Array(NWV), ky: new Float32Array(NWV), om: new Float32Array(NWV), ph: new Float32Array(NWV),
    a0: new Float32Array(NWV), mo: new Float32Array(NWV), mph: new Float32Array(NWV), fw: new Float32Array(NWV), fp: new Float32Array(NWV),
    a: new Float32Array(NWV), p: new Float32Array(NWV),
  });
  for (let m = 0; m < NWV; m++) {
    // Three of the waves are bands across the panel (no crests along it) that creep up or down, eight are
    // broad ones with one or two crests round the window, the rest are shorter ripples.
    const band = m < 3, broad = m < 11;
    const nx = band ? 0 : broad ? 1 + floor(Math.random() * 2) : 2 + floor(Math.random() * 3);
    const sgn = Math.random() < 0.5 ? -1 : 1;
    wv.kx[m] = (TAU * nx) / W;
    wv.ky[m] = (TAU * (band ? rnd(1.4, 3.8) : broad ? sgn * rnd(0.4, 2.2) : sgn * rnd(1, 4.2))) / H;
    wv.om[m] = band ? sgn * rnd(0.04, 0.12) : wv.kx[m] * rnd(1.4, 3.2);
    wv.ph[m] = Math.random() * TAU;
    wv.a0[m] = band ? rnd(0.04, 0.08) : broad ? rnd(0.15, 0.3) : rnd(0.06, 0.13);
    wv.mo[m] = rnd(0.08, 0.25);
    wv.mph[m] = Math.random() * TAU;
    wv.fw[m] = rnd(0.03, 0.09);
    wv.fp[m] = Math.random() * TAU;
  }
}

// The ocean at time t: eddy places, sizes and heights, and the wave's amplitudes.
function stepOcean(st, t) {
  const E = st.ed, a = st.act;
  const gain = 0.9 + 1.2 * a;
  for (let i = 0; i < NED; i++) {
    if (t >= E.tb[i] + E.life[i]) respawn(st, i, t);
    const age = max(0, t - E.tb[i]), f = min(1, age / E.life[i]), sf = sin(PI * f);
    const env = Math.pow(sf, 1.3), sg = 0.6 * E.R[i] * (0.72 + 0.28 * sf);
    let x = E.x0[i] + E.vx[i] * age;
    x -= W * floor(x / W);
    E.cx[i] = x;
    // North and south drift folds back at the edges of the window, so an eddy stays on the panel.
    let y = (E.y0[i] + E.vy[i] * age - 3) % 244;
    if (y < 0) y += 244;
    E.cy[i] = 3 + (y > 122 ? 244 - y : y);
    E.cs[i] = 1 / (2 * sg * sg);
    E.ca[i] = E.A[i] * env * gain * sstep(E.th[i], E.th[i] + 0.12, a);
    E.cr[i] = 7.8 * sg * sg;
  }
  const wv = st.wv, wg = 1.0 - 0.62 * a;
  for (let m = 0; m < NWV; m++) {
    wv.a[m] = wg * wv.a0[m] * (0.62 + 0.38 * sin(wv.mo[m] * t + wv.mph[m]));
    // The phase speed itself swings by a third either way on a slow beat, so a wave never comes round to where it was.
    wv.p[m] = wv.ph[m] + wv.om[m] * (t + (0.33 / wv.fw[m]) * sin(wv.fw[m] * t + wv.fp[m]));
  }
}

function truth(st, x, y) {
  const E = st.ed, wv = st.wv;
  let s = 0;
  for (let i = 0; i < NED; i++) {
    const ca = E.ca[i];
    if (ca === 0) continue;
    let dx = x - E.cx[i];
    dx -= W * floor(dx / W + 0.5);
    const dy = y - E.cy[i], r2 = dx * dx + dy * dy;
    if (r2 > E.cr[i]) continue;
    s += ca * exp(-r2 * E.cs[i]);
  }
  for (let m = 0; m < NWV; m++) s += wv.a[m] * cos(wv.kx[m] * x + wv.ky[m] * y + wv.p[m]);
  return s;
}

// ---- state ------------------------------------------------------------------
const PRE = 100;     // seconds run before the first frame, so the lattice is already woven
export function setup(params) {
  const base = Math.random() * TAU;
  const sats = [];
  for (let j = 0; j < NSAT; j++) {
    const o = { n: TAU / SAT_T[j], u0: base + j * rnd(1.4, 2.2) + Math.random(), l0: Math.random() * TAU, a1: rnd(0.35, 0.6), w1: rnd(0.045, 0.09), p1: Math.random() * TAU, b1: rnd(0.25, 0.4), w2: rnd(0.03, 0.07), p2: Math.random() * TAU, w: 0, tx: new Float32Array(CAPT), ty: new Float32Array(CAPT), tt: new Float32Array(CAPT), th: 0, tn: 0 };
    sats.push(o);
  }
  const st = (params.st = {
    k: [0, 2, 3, 0.06], t: -PRE, init: false, act: 2 / 3,
    sats,
    S: new Float32Array(NPX), Wt: new Float32Array(NPX), Wc: new Float32Array(NPX),
    bs: new Float32Array(NPX), bw: new Float32Array(NPX), bc: new Float32Array(NPX), tmp: new Float32Array(NPX), cs: new Float32Array(W),
    lut: new Float32Array(GROUND + 9), hue: -9, cov: new Float32Array(NPX),
    R: new Float32Array(NPX), G: new Float32Array(NPX), B: new Float32Array(NPX),
    E: new Float32Array(NPX), scaled: false, mean: 0, rms: 0.3,
    pg: new Float32Array(PGW * PGH), ix0: new Int32Array(W), ix1: new Int32Array(W), fx: new Float32Array(W), iy0: new Int32Array(H), fy: new Float32Array(H),
  });
  initOcean(st, st.t);
  stepOcean(st, st.t);
  for (let x = 0; x < W; x++) {
    const g = (x + 0.5) / 4 - 0.5, i = floor(g);
    st.ix0[x] = (i + PGW) % PGW;
    st.ix1[x] = (i + 1 + PGW) % PGW;
    st.fx[x] = g - i;
  }
  for (let y = 0; y < H; y++) {
    const g = cl((y + 0.5) / 4 - 0.5, 0, PGH - 1.001), i = floor(g);
    st.iy0[y] = i;
    st.fy[y] = g - i;
  }
}

function satCount(k4) {
  return k4 < 0 ? 2 + k4 : 2 + 2 * k4;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 3, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 3), cl(kv[2], 3, 14), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    st.act = st.k[1] / 3;
    // Run the first PRE seconds before the first frame: coarse at first, then at frame rate.
    while (st.t < -8) step(st, 0.1);
    while (st.t < 0) step(st, 1 / 30);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

function step(st, d) {
  if (d <= 0) return;
  const t0 = st.t;
  st.t += d;
  const t = st.t;
  st.act += (st.k[1] / 3 - st.act) * (1 - exp(-d / 0.6));
  stepOcean(st, t);
  // The age weight: one decay of both accumulators a step.
  const f = exp(-d / TAU_AGE), fc = exp(-d / TAU_SEEN), S = st.S, Wt = st.Wt, Wc = st.Wc;
  for (let i = 0; i < NPX; i++) {
    let v = S[i] * f;
    S[i] = v > -1e-9 && v < 1e-9 ? 0 : v;
    v = Wt[i] * f;
    Wt[i] = v < 1e-9 ? 0 : v;
    v = Wc[i] * fc;
    Wc[i] = v < 1e-9 ? 0 : v;
  }
  const cnt = satCount(st.k[3]);
  const m = cl(Math.ceil(d / 0.006), 1, 24);
  const p = [0, 0], q0 = [0, 0];
  for (let j = 0; j < NSAT; j++) {
    const s = st.sats[j];
    s.w = cl(cnt - j, 0, 1);
    satXY(s, t0, q0);
    for (let q = 1; q <= m; q++) {
      satXY(s, t0 + (d * q) / m, p);
      // Each measurement weighs the length of track it stands for.
      let ddx = p[0] - q0[0];
      ddx -= W * round(ddx / W);
      const len = sqrt(ddx * ddx + (p[1] - q0[1]) * (p[1] - q0[1]));
      q0[0] = p[0];
      q0[1] = p[1];
      if (s.w < 0.01) continue;
      const v = truth(st, p[0], p[1]) + NOISE * gauss();
      splat(st, p[0], p[1], v, s.w * len);
    }
    satXY(s, t, p);
    // A point for the trail each step, at least 12 ms apart.
    const last = (s.th + CAPT - 1) % CAPT;
    if (s.tn === 0 || t - s.tt[last] > 0.012) {
      s.tx[s.th] = p[0] - W * floor(p[0] / W);
      s.ty[s.th] = p[1];
      s.tt[s.th] = t;
      s.th = (s.th + 1) % CAPT;
      if (s.tn < CAPT) s.tn++;
    }
  }
}

// Drop one measurement into the two accumulators, shared between the four pixels it falls among.
function splat(st, x, y, v, w) {
  const gx = x - 0.5, gy = y - 0.5, ix = floor(gx), iy = floor(gy), fx = gx - ix, fy = gy - iy;
  const S = st.S, Wt = st.Wt, Wc = st.Wc;
  for (let b = 0; b < 2; b++) {
    const yy = iy + b;
    if (yy < 0 || yy >= H) continue;
    const wy = b ? fy : 1 - fy;
    for (let a = 0; a < 2; a++) {
      const o = yy * W + ((ix + a) & 63), ww = w * wy * (a ? fx : 1 - fx);
      S[o] += ww * v;
      Wt[o] += ww;
      Wc[o] += ww;
    }
  }
}

// ---- the mapping: a Gaussian correlation as three box blurs each way -------------
function boxH(src, dst, r, fr) {
  const inv = 1 / (2 * r + 1 + 2 * fr);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[o + (k & 63)];
    for (let x = 0; x < W; x++) {
      dst[o + x] = (sum + fr * (src[o + ((x - r - 1) & 63)] + src[o + ((x + r + 1) & 63)])) * inv;
      sum += src[o + ((x + r + 1) & 63)] - src[o + ((x - r) & 63)];
    }
  }
}
function boxV(src, dst, r, fr, cs) {
  const inv = 1 / (2 * r + 1 + 2 * fr);
  cs.fill(0);
  for (let y = 0; y <= min(r, H - 1); y++) for (let x = 0; x < W; x++) cs[x] += src[y * W + x];
  for (let y = 0; y < H; y++) {
    const ya = y - r - 1, yb = y + r + 1, o = y * W;
    for (let x = 0; x < W; x++) {
      let e = 0;
      if (ya >= 0) e += src[ya * W + x];
      if (yb < H) e += src[yb * W + x];
      dst[o + x] = (cs[x] + fr * e) * inv;
    }
    if (yb < H) for (let x = 0; x < W; x++) cs[x] += src[yb * W + x];
    if (y - r >= 0) for (let x = 0; x < W; x++) cs[x] -= src[(y - r) * W + x];
  }
}
function blur3(a, out, tmp, r, fr, cs) {
  boxH(a, tmp, r, fr);
  boxH(tmp, out, r, fr);
  boxH(out, tmp, r, fr);
  boxV(tmp, out, r, fr, cs);
  boxV(out, tmp, r, fr, cs);
  boxV(tmp, out, r, fr, cs);
}

// ---- drawing ----------------------------------------------------------------
// A line of width 2 from (xa, ya) to (xb, yb), the column index wrapping, into cov as the larger of what is there and c0.
function stroke(cov, xa, ya, xb, yb, c0) {
  let dx = xb - xa;
  dx -= W * round(dx / W);
  const dy = yb - ya, l2 = dx * dx + dy * dy + 1e-9;
  const lo = min(xa, xa + dx) - 1.5, hi = max(xa, xa + dx) + 1.5;
  const py0 = max(0, floor(min(ya, yb) - 1.5)), py1 = min(H - 1, floor(max(ya, yb) + 1.5));
  for (let py = py0; py <= py1; py++) {
    const cy = py + 0.5 - ya;
    for (let px = floor(lo); px <= floor(hi); px++) {
      const cx = px + 0.5 - xa;
      const q = cl((cx * dx + cy * dy) / l2, 0, 1);
      const ex = cx - q * dx, ey = cy - q * dy;
      const c = cl(1.5 - sqrt(ex * ex + ey * ey), 0, 1) * c0;
      const o = py * W + (px & 63);
      if (c > cov[o]) cov[o] = c;
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) (st.hue = hue), buildLut(st.lut, hue);
  const lut = st.lut;

  // The correlation length L is 2.5 sigma of the Gaussian weights.
  const L = st.k[2], sg2 = 0.16 * L * L;
  const rr = (-1 + sqrt(1 + 4 * sg2)) / 2, ri = floor(rr), fr = rr - ri;
  blur3(st.S, st.bs, st.tmp, ri, fr, st.cs);
  blur3(st.Wt, st.bw, st.tmp, ri, fr, st.cs);
  blur3(st.Wc, st.bc, st.tmp, ri, fr, st.cs);
  const nrm = 2 * PI * sg2, bs = st.bs, bw = st.bw, bc = st.bc, cov = st.cov, R = st.R, G = st.G, B = st.B;

  cov.fill(0);
  const head = [];
  for (let j = 0; j < NSAT; j++) {
    const s = st.sats[j];
    if (s.w < 0.01) continue;
    for (let n = 1; n < s.tn; n++) {
      const i1 = (s.th - n + CAPT) % CAPT, i0 = (i1 - 1 + CAPT) % CAPT;
      const age = st.t - s.tt[i1];
      if (age > TRAIL_S) break;
      const a = Math.pow(1 - age / TRAIL_S, 2.2) * 0.95 * s.w;
      stroke(cov, s.tx[i0], s.ty[i0], s.tx[i1], s.ty[i1], a);
    }
    head.push(j);
  }

  const tr = lut[GROUND + 3], tg = lut[GROUND + 4], tb = lut[GROUND + 5];
  // The prior: the broad waves, which a model could forecast, on a grid of 4 LED cells and spread to the pixels.
  const pgd = st.pg, wv = st.wv, ix0 = st.ix0, ix1 = st.ix1, fx = st.fx, iy0 = st.iy0, fy = st.fy;
  for (let gj = 0; gj < PGH; gj++) {
    for (let gi = 0; gi < PGW; gi++) {
      const x = (gi + 0.5) * 4, y = (gj + 0.5) * 4;
      let v = 0;
      for (let m = 0; m < NBROAD; m++) v += wv.a[m] * cos(wv.kx[m] * x + wv.ky[m] * y + wv.p[m]);
      pgd[gj * PGW + gi] = v * PRIOR;
    }
  }
  // The map: what the samples say, pulled to the prior where there are few of them.
  const E = st.E;
  let sum = 0, sum2 = 0;
  for (let o = 0; o < NPX; o++) {
    const x = o & 63, y = o >> 6, ya = iy0[y] * PGW, fyy = fy[y];
    const pa = pgd[ya + ix0[x]] + (pgd[ya + ix1[x]] - pgd[ya + ix0[x]]) * fx[x];
    const pb2 = pgd[ya + PGW + ix0[x]] + (pgd[ya + PGW + ix1[x]] - pgd[ya + PGW + ix0[x]]) * fx[x];
    const prior = pa + (pb2 - pa) * fyy;
    const W1 = bw[o] * nrm, v = (bs[o] * nrm + W0 * prior) / (W1 + W0);
    E[o] = v;
    sum += v;
    sum2 += v * v;
  }
  // Like a plotted map, the colours are laid about the map's own mean and stretched to its own spread, so a smooth
  // map keeps its colour and a map with one broad band on it does not turn into one colour.
  const mean = sum / NPX, rms = sqrt(max(1e-6, sum2 / NPX - mean * mean));
  if (!st.scaled) (st.scaled = true), (st.mean = mean), (st.rms = rms);
  st.mean += (mean - st.mean) * 0.06;
  st.rms += (rms - st.rms) * 0.06;
  const gain = cl(GAIN * Math.pow(REF / st.rms, 0.6), 0.8, 4.5), mu = st.mean;
  for (let o = 0; o < NPX; o++) {
    const W1 = bw[o] * nrm, gs = W1 / (W1 + W0), C1 = bc[o] * nrm, gf = C1 / (C1 + W0C);
    let e = (E[o] - mu) * gain;
    e = 1.15 * Math.tanh(e / 1.15);
    const i = cl(floor(((e - SMIN) / SPAN) * (LUTN - 1) + 0.5), 0, LUTN - 1) * 3;
    const cr = lut[i], cg = lut[i + 1], cb = lut[i + 2], j = i + LUTN * 3, k2 = i + LUTN * 6;
    // Three levels: the dim ground where nothing has been measured, the map dimmed where it was
    // measured a while ago, the map in full where a satellite has just been.
    const dr = lut[k2] + (lut[j] - lut[k2]) * gs, dg = lut[k2 + 1] + (lut[j + 1] - lut[k2 + 1]) * gs, db = lut[k2 + 2] + (lut[j + 2] - lut[k2 + 2]) * gs;
    let r = dr + (cr - dr) * gf, g = dg + (cg - dg) * gf, b = db + (cb - db) * gf;
    const c = cov[o];
    if (c > 0.003) {
      r += (tr - r) * c;
      g += (tg - g) * c;
      b += (tb - b) * c;
    }
    R[o] = r;
    G[o] = g;
    B[o] = b;
  }
  // The heads: a white-hot core in a pink glow about 4 LED across.
  const hr = lut[GROUND + 6], hg = lut[GROUND + 7], hb = lut[GROUND + 8];
  for (const j of head) {
    const s = st.sats[j], last = (s.th + CAPT - 1) % CAPT, hx = s.tx[last], hy = s.ty[last];
    for (let py = max(0, floor(hy - 5)); py <= min(H - 1, floor(hy + 5)); py++) {
      for (let px = floor(hx - 5); px <= floor(hx + 5); px++) {
        const dx = px + 0.5 - hx, dy = py + 0.5 - hy, r2 = dx * dx + dy * dy;
        const halo = exp(-r2 / 5.5) * 0.9 * s.w, core = exp(-r2 / 1.6) * s.w;
        const o = py * W + (px & 63);
        R[o] += (tr - R[o]) * halo;
        G[o] += (tg - G[o]) * halo;
        B[o] += (tb - B[o]) * halo;
        R[o] += (hr - R[o]) * core;
        G[o] += (hg - G[o]) * core;
        B[o] += (hb - B[o]) * core;
      }
    }
  }
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, floor(min(255, R[o])), floor(min(255, G[o])), floor(min(255, B[o])));
}
