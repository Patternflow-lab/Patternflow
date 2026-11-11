// ===== Patternflow pattern =====
// Title:   Oscillon Gas
// Family:  wave
// Idea:    A parametrically pumped, damped sine-Gordon field runs on the panel's own 64 by 128 torus and is drawn as its glowing energy, with the phase of its oscillation against the pump picking the hue, so lumps that pulse in place at half the pump frequency are born out of a shaken vacuum, drift, collide, ring and re-form for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the long-lived pulsing lumps of the two-dimensional sine-Gordon equation (Igor Bogolyubsky and Vladimir Makhankov, 1976, who called them pulsons, from memory) and the name oscillon with their study in the Klein-Gordon field (Marcelo Gleiser, 1994, from memory); the Faraday instability of a shaken layer, which answers at half the shaking frequency (Michael Faraday, 1831, from memory) and its oscillons in a vertically vibrated granular layer (Paul Umbanhowar, Francisco Melo and Harry Swinney, 1996, from memory); the Mathieu equation behind the parametric resonance (Emile Mathieu, 1868, from memory); velocity Verlet (Loup Verlet, 1967, from memory) with the damping as an exact half-step factor on each side; colour in OKLab (Bjorn Ottosson, 2020, from memory); pattern round 128
// Round:   128
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1.7..4, Scale=-1..1, Pump=-1..1
//
// Knob 1: Hue. Adds 360 degrees a unit to the OKLab hue of all three colours, and a full turn comes back. At 0 a lump that swings one way against the
// pump is azure (hue 250), one that swings the other way is amber (75) and one between the two, two lumps meeting or a lump whose phase is turning, is
// rose (335), on a blue-black ground; at 0.5 the pair is yellow-green and blue. Every colour is pulled into the gamut after the panel's 1.62 lift.
// Knob 2: Speed. Model time runs at 0.5 Speed / m a second, so every mass keeps the same pace and the lumps' energy beats once every 6.5 / Speed
// seconds: 3.8 s at 1.7, 3.3 s at the opening 2 and 1.6 s at 4. The time-averaged energy field is correlated with itself at 0.87, 0.84 and 0.65 after 2 s
// (1.7, 2 and 4), and at 0.36, 0.30 and 0.06 after 8 s, so the lumps in view are mostly new after about 8 s at the opening and after 4 s at 4.
// Knob 3: Scale. The mass m = 0.66 x 1.25 to the Scale: 0.53 at -1, 0.66 at the opening 0, 0.83 at 1, and every length in the picture goes as 1 / m.
// The panel holds 39 lumps at -1, 61 at 0 and 84 at 1 (local maxima of the time-averaged energy over m^2 above 2), each lump with its ring covering
// about 70, 50 and 36 LEDs. Under the range the lumps are too few and too big for every 16 by 16 tile to keep changing: at m = 0.43 the last-quarter
// quiet line (0.30) failed in three of four seeds, at 0.22 to 0.24.
// Knob 4: Pump. The pump A = 0.47 x 0.82 to the |Pump| below 0 and 0.47 x 1.66 to the Pump above it: 0.385 at -1, 0.485 at the opening 0.06, 0.78 at 1. The
// gas goes from 36 lumps on a dark ground (21 per cent of the panel above e / m^2 = 1.2) through 61 (37) to 137 (84) packed so close that their rings
// touch. It stays a gas at every position: the knob never sets the pump under 0.385 (its wander moves it by about 5 per cent), and a uniform global pulse
// takes over only below about 0.25 (see below).

// What the field is. phi(x, y, t) on a 64 by 128 torus, one cell per LED, lengths in LEDs:
//   phi_tt = lap phi - m^2 (1 + A cos theta) sin phi - gamma phi_t,      theta' = Omega,
// with the 5-point Laplacian. With A = 0 and gamma = 0 it is the sine-Gordon equation: mass m, a vacuum at every multiple of 2 pi, kinks between
// them, and in two dimensions the long-lived pulsing lumps called oscillons, whose frequency sits under the mass gap, omega < m. The pump A shakes
// the stiffness, as Faraday shook his dish: a small wave of frequency omega grows when Omega is near 2 omega (the first tongue of the Mathieu
// equation) and the sine's softening stops the growth at a finite size, which is how a lump is made out of nothing. Damping is gamma = 0.03 m,
// the pump runs at Omega = 2 m (1 - 0.04 + 0.02 u), and the colour comes from the energy density e = phi_t^2 / 2 + |grad phi|^2 / 2 + m^2 (1 - cos phi).
// With A and gamma both scaled by m the picture is the same at every mass, only larger or smaller, so Scale is a zoom.
//
// Numerics. Velocity Verlet with the damping as exp(-gamma h / 2) on the velocity before the first kick and after the second (second order, one
// force evaluation a step). A frame takes steps of at most 0.25 model time, equal within the frame and at least one, so the picture moves on every
// frame; model time passes at 0.5 Speed / m a second. The pump's phase theta is integrated, never a clock reading, and the pump frequency and amplitude
// each wander as an Ornstein-Uhlenbeck process, so nothing in it is a period.
//
// What was checked, in the file's own step (a test copy of its functions, 64 by 128 torus, h = 0.25 unless said):
// - Energy. A = 0, gamma = 0, a smooth field of rms 0.9 (E / N = 0.319 at m = 0.5). The largest |E - E0| / E0 over 500 model time is 1.48e-2 at
//   h = 0.25, 3.72e-3 at 0.125, 9.29e-4 at 0.0625 and 2.32e-4 at 0.03125, a quarter for each halving. Over 6000 model time at h = 0.25 the offset
//   goes from -0.87 to -1.10 per cent, a creep of 0.05 per cent every 1000 as the field spreads over its modes.
// - Dispersion. Small waves ring at (2 / h) asin(h w / 2) with w^2 = m^2 + 4 sin^2(kx / 2) + 4 sin^2(ky / 2), the lattice value corrected for the
//   step, to five digits (mode (8, 0) at m = 0.5: 0.91622 measured and predicted). Against w the step adds 0.07 per cent at k = 0 and 0.6 per cent
//   at w = 1.5, a quarter of that at h = 0.125. The continuum sqrt(m^2 + k^2) is 1.8 per cent above the lattice value at 0.91 and 10 per cent above
//   it at 1.5, so the lattice, not the continuum, is what this picture follows.
// - Parametric growth. For phi'' + m^2 (1 + eps cos 2 m t) phi = 0 on the uniform mode the measured growth rate over eps m / 4 is 0.994, 1.001, 1.0015
//   and 1.0008 for eps = 0.02, 0.05, 0.1 and 0.2. A standing wave of 8 periods across the width, pumped at twice its lattice frequency 0.9142: 0.00659 at
//   h = 0.25 and 0.00683 at 0.125, against eps m^2 / (4 w) = 0.00684 (0.00671 with the continuum w); the shortfall at h = 0.25 is the step's frequency
//   shift of 0.0020 against a half width of 0.0068, which predicts 0.00654.
// - Damping threshold. With gamma = 0.02 the net rate at eps = 0.04, 0.08, 0.12, 0.16, 0.2 is -0.00499, 0.00002, 0.00503, 0.01003, 0.01503; the line
//   through them has slope 0.1251 (m / 4 = 0.125) and crosses zero at eps = 0.0799, the threshold 2 gamma / m = 0.0800.
// - Kinks. A kink and an antikink 32 LEDs apart, phi = 4 atan(exp(m (x - 16))) - 4 atan(exp(m (x - 48))): the energy per wall is 0.9966 of the exact
//   8 m at m = 0.5 (0.9978 at 0.4, 0.9941 at 0.66, 0.9914 at 0.8, the lattice's discreteness growing with m^2), and relaxed under damping for 500
//   model time the profile stays within 1.8e-2 rad of the analytic one at m = 0.5 (5.1e-2 at 0.8) with the centre still at 16.000.
// - One oscillon. A Gaussian of height 4 and sigma 4 at m = 0.5, with a sponge round it for the first 600, then free: it keeps a core of energy 66 (within
//   r < 10) down to 56.7 after 20000 model time, about 1400 periods, at a frequency of 0.850, 0.881 and 0.888 m in the windows 1000 to 3000, 8000 to
//   10000 and 16000 to 20000: under the gap, creeping up as it radiates. At h = 0.125 the core is 58.9 against 58.5 at t = 4000 and the frequency
//   0.8557 against 0.8554 m. With damping and no pump the core's energy falls at 1.85 gamma (gamma = 0.0155) and 1.58 gamma (0.04) and is gone by 500;
//   pumped at 2 x 0.8375 m a lone one of this size dies at A = 0.5 and lives past 3000 at A = 0.6 and above. In the gas the neighbours' waves help it.
// - Step. The gas itself is the same at the shipped step and at half and a quarter of it (m = 0.5, the pump 4 per cent under 2 m, no wander):
//   <e> / m^2 is 1.259, 1.261 and 1.254 at A = 0.47 (the share of cells above 1.2 is 35.0, 35.1 and 34.8 per cent) and 2.772, 2.759 and 2.793
//   at A = 0.78, three seeds each, seed to seed 0.01 to 0.03.
// - The uniform state. A pump kept exactly at 2 m lets one global pulse win when A is small: with A = 0.22 at Scale 0 and Speed 3.6 (6500 model time in
//   2400 s) all three seeds ended as the uniform oscillation (contrast of the time-averaged energy 0.00 to 0.04, |phi| under 0.3) by 1600, 2400 and
//   1600 s. With the pump 4 per cent below 2 m, kept still, none of three did. With the wander shipped (detuning 0.04 plus or minus 0.02, size plus or
//   minus 5 per cent) none did either, though two of the three dipped to a few lumps once and came back. In the knob range (A from 0.385) even
//   Omega = 2 m with no wander kept the lumps for 3000 s in all three seeds (contrast 0.93 to 1.23), so the detuning and the wander are margin there,
//   not what keeps it alive.
// - Lock-in phase. Lumps sit at -0.37 to -0.43 rad against the pump's half frequency (two phases, pi apart, energy-weighted, five knob positions,
//   coherence 0.16 to 0.33), which is what PSI0 and the sign of the colour are read against.
// - Staying alive. Over 900 s at the opening, all knobs at their minimum and all at their maximum the lines hold (recur 0.78, 0.76, 0.77; dim 0.96,
//   0.91, 0.97; last-quarter quiet 0.81, 0.67, 0.89; first against last quarter brightness within 0.7 per cent). The field stays bounded: the largest
//   |phi| in 900 s at five knob positions is 7.9 (the dense corner; 0.1 to 8 per cent of the cells are past pi, in the next vacuum, at a sample),
//   and the mean energy over m^2 keeps to 0.7 to 1.0 at the minimum, 1.1 to 1.5 at the opening and 2.2 to 2.9 at the maximum, sampled every 300 s.
//   Frame cost in Node is 0.25 ms to step and 0.6 ms to draw, and the first frame takes 0.1 s for the 240 model time units run before it.

const W = 64, H = 128, N = W * H;
const { sqrt, sin, cos, exp, log, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const HS = 0.25; // longest model time per step
const RHO = 0.5; // mass-time units per panel second at Speed 1
const M0 = 0.66, MR = 1.25; // mass at Scale 0, and the factor per unit of Scale
const GP = 0.03; // damping over mass
const DET = 0.04, SO = 0.02, SA = 0.05; // mean detuning of the pump below 2 m, its wander, and the wander of the pump's size
const PK = 0.5; // share of the instantaneous energy beside its time average
const PSI0 = -0.4; // the phase the locked lumps sit at against the pump's half frequency, measured

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

export function setup(params) {
  const S = {
    th: 0, m: M0, A: 0.47, Om: 2 * M0, uA: 0, uO: 0, me: 1, warm: false, lh: -1, hue: 0, spd: 2, mt: M0, A0: 0.47, gam: GP * M0,
    phi: new Float64Array(N), v: new Float64Array(N), F: new Float64Array(N),
    E: new Float32Array(N), P: new Float32Array(N), I: new Float32Array(N), Q: new Float32Array(N), B: new Float32Array(3 * N),
  };
  params.s = S;
  return S;
}

// The force on every cell, F = lap phi - m^2 (1 + A cos theta) sin phi.
function force(S) {
  const { phi, F } = S, m2 = S.m * S.m * (1 + S.A * cos(S.th));
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = (y === 0 ? H - 1 : y - 1) * W, rd = (y === H - 1 ? 0 : y + 1) * W;
    let c = phi[r];
    F[r] = phi[r + W - 1] + phi[r + 1] + phi[ru] + phi[rd] - 4 * c - m2 * sin(c);
    for (let x = 1; x < W - 1; x++) {
      const p = r + x;
      c = phi[p];
      F[p] = phi[p - 1] + phi[p + 1] + phi[ru + x] + phi[rd + x] - 4 * c - m2 * sin(c);
    }
    const p = r + W - 1;
    c = phi[p];
    F[p] = phi[p - 1] + phi[r] + phi[ru + W - 1] + phi[rd + W - 1] - 4 * c - m2 * sin(c);
  }
}

// One velocity-Verlet step of length h, with exp(-gamma h / 2) on the velocity before the first kick and after the second.
function step(S, h) {
  const { phi, v, F } = S, e = exp(-0.5 * S.gam * h), hh = 0.5 * h;
  for (let p = 0; p < N; p++) {
    const vv = e * v[p] + hh * F[p];
    v[p] = vv;
    phi[p] += h * vv;
  }
  S.th += S.Om * h;
  force(S);
  for (let p = 0; p < N; p++) v[p] = e * (v[p] + hh * F[p]);
}

// A smooth random field of the given rms: white noise through three 1-2-1 passes each way.
function smoothField(a, rms) {
  const b = new Float64Array(N);
  for (let p = 0; p < N; p++) a[p] = gauss();
  for (let it = 0; it < 3; it++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; b[p] = 0.5 * a[p] + 0.25 * (a[y * W + (x + 1) % W] + a[y * W + (x + W - 1) % W]); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; a[p] = 0.5 * b[p] + 0.25 * (b[((y + 1) % H) * W + x] + b[((y + H - 1) % H) * W + x]); }
  }
  let s = 0;
  for (let p = 0; p < N; p++) s += a[p] * a[p];
  s = rms / sqrt(s / N);
  for (let p = 0; p < N; p++) a[p] *= s;
}

function knobs(S, k) {
  S.hue = cl(k[0], 0, 1);
  S.spd = cl(k[1], 0.2, 5);
  S.mt = M0 * pow(MR, cl(k[2], -1, 1));
  const q = cl(k[3], -1, 1);
  S.A0 = 0.47 * (q < 0 ? pow(0.82, -q) : pow(1.66, q));
}

// An Ornstein-Uhlenbeck step of d panel seconds with unit variance and correlation time tc.
function ou(u, d, tc) {
  const a = exp(-d / tc);
  return u * a + sqrt(1 - a * a) * gauss();
}

// One frame: d panel seconds, or mdl model time units when given (the warm-up).
function advance(S, d, mdl) {
  S.uA = ou(S.uA, d, 60);
  S.uO = ou(S.uO, d, 25);
  S.m += (S.mt - S.m) * (1 - exp(-d / 0.5));
  S.A = S.A0 * exp(SA * S.uA);
  S.Om = 2 * S.m * (1 - DET + SO * S.uO);
  S.gam = GP * S.m;
  const model = min(mdl || (d * RHO * S.spd) / S.m, 40 * HS), n = max(1, Math.ceil(model / HS - 1e-9)), h = model / n;
  for (let i = 0; i < n; i++) step(S, h);
  // Time averages: the energy over 1.6 / m, and phi against cos and sin of half the pump's phase over 6 / m (the lock-in that gives the lumps' phase).
  const { phi, v, E, P, I, Q } = S, m2 = S.m * S.m;
  const ae = 1 - exp(-(model * S.m) / 1.6), ai = 1 - exp(-(model * S.m) / 6), c = cos(0.5 * S.th), sn = sin(0.5 * S.th);
  let sum = 0;
  for (let y = 0; y < H; y++) {
    const r = y * W, rd = (y === H - 1 ? 0 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const p = r + x, dx = phi[x === W - 1 ? r : p + 1] - phi[p], dy = phi[rd + x] - phi[p];
      const e = 0.5 * v[p] * v[p] + 0.5 * (dx * dx + dy * dy) + m2 * (1 - cos(phi[p]));
      P[p] = e;
      E[p] += ae * (e - E[p]);
      sum += E[p];
      I[p] += ai * (phi[p] * c - I[p]);
      Q[p] += ai * (phi[p] * sn - Q[p]);
    }
  }
  S.me += (sum / N / m2 - S.me) * (1 - exp(-d / 20)); // the picture's exposure follows the mean energy over 20 s
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  knobs(S, k);
  if (!S.warm) {
    // 240 model time units from a smooth random field of rms 0.4 (about 0.1 s), so the first frame already holds lumps
    S.warm = true;
    S.m = S.mt;
    S.A = S.A0;
    S.gam = GP * S.m;
    smoothField(S.phi, 0.4);
    force(S);
    for (let i = 0; i < 40; i++) advance(S, 0.2, 6);
    let sum = 0;
    for (let p = 0; p < N; p++) sum += S.E[p];
    S.me = sum / N / (S.m * S.m);
  }
  advance(S, cl(dt || 0, 0, 0.1));
}

// ---- colour ---------------------------------------------------------------------------------
// LUT[(sign * LS + level) * 3]: the level is the energy through a curve, the sign is the cosine of the lumps' phase against the pump. A lump that
// swings one way against the pump is cool, one that swings the other way is warm, and one between the two (a ring of two lumps meeting, or a lump
// whose phase is turning) takes the middle hue. Chroma comes in with the level, so the ground is a dark blue-black.
const GS = 20, LS = 40;
function oklab2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
  return [e(r), e(g), e(bb)];
}
// Chroma is pulled in until the colour fits sRGB after the panel's 1.62 saturation lift, so the lift clips no channel.
function fit(L, a, b) {
  for (let k = 0; k < 40; k++) {
    const c = oklab2rgb(L, a, b), y = (c[0] * 77 + c[1] * 150 + c[2] * 29) / 256;
    if (c.every((v) => v >= 0 && v <= 1 && y + (v - y) * 1.62 >= -0.01 && y + (v - y) * 1.62 <= 1.01)) return c;
    a *= 0.96;
    b *= 0.96;
  }
  return oklab2rgb(L, a, b).map((v) => cl(v, 0, 1));
}
const HUES = [235, 320, 420]; // cool, middle and warm in degrees of OKLab hue, before the knob's turn
function buildLut(S) {
  const lut = S.lut || (S.lut = new Float32Array(GS * LS * 3)), off = 15 + 360 * S.hue, hg = ((HUES[0] + 25 + off) * PI) / 180;
  for (let gi = 0; gi < GS; gi++) {
    const g = (gi / (GS - 1)) * 2 - 1, u = (g + 1) / 2, hd = u < 0.5 ? HUES[0] + (HUES[1] - HUES[0]) * (u * 2) : HUES[1] + (HUES[2] - HUES[1]) * (u * 2 - 1);
    const hr = ((hd + off) * PI) / 180, cg = 0.7 + 0.3 * Math.abs(g);
    for (let li = 0; li < LS; li++) {
      // Lightness 0.17 to 0.92; the ground (the lowest 0.04 to 0.45 of the level) blends from a faint blue-black into the hue in a, b, not in angle,
      // because the angle from blue to amber runs through red and gave the ground a maroon tint.
      const t = li / (LS - 1), w = cl((t - 0.04) / 0.41, 0, 1), sw = w * w * (3 - 2 * w), L = 0.17 + 0.75 * t ** 1.6, C = 0.17 * sin(PI * pow(t, 0.7)) * cg;
      const c = fit(L, (1 - sw) * 0.035 * cos(hg) + sw * C * cos(hr), (1 - sw) * 0.035 * sin(hg) + sw * C * sin(hr)), o = (gi * LS + li) * 3;
      lut[o] = c[0];
      lut[o + 1] = c[1];
      lut[o + 2] = c[2];
    }
  }
  S.lh = S.hue;
}

// The energy shown is its time average plus PK of the difference to the instant, so a lump beats and a ring shows, and its level is read against the
// mean energy over the last 20 s (to the power 0.7), so a dense gas does not wash out. Energy and the two lock-in channels get a 1-2-1 across and down:
// the cell-sized grain of a large mass goes, a lump keeps its shape.
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  if (Math.abs(S.lh - S.hue) > 0.004) buildLut(S);
  const { E, P, I, Q, lut, B } = S, c0 = cos(PSI0), s0 = sin(PSI0), ex = pow(cl(S.me, 0.4, 4), 0.7), is = 1 / (S.m * S.m * ex);
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const l = r + (x === 0 ? W - 1 : x - 1), c = r + x, rr = r + (x === W - 1 ? 0 : x + 1), o = 3 * c;
      B[o] = E[l] + 2 * E[c] + E[rr] + PK * (P[l] + 2 * P[c] + P[rr] - E[l] - 2 * E[c] - E[rr]);
      B[o + 1] = I[l] + 2 * I[c] + I[rr];
      B[o + 2] = Q[l] + 2 * Q[c] + Q[rr];
    }
  }
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = (y === 0 ? H - 1 : y - 1) * W, rd = (y === H - 1 ? 0 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const o = 3 * (r + x), u = 3 * (ru + x), d = 3 * (rd + x);
      const en = (B[u] + 2 * B[o] + B[d]) * 0.0625 * is, bi = B[u + 1] + 2 * B[o + 1] + B[d + 1], bq = B[u + 2] + 2 * B[o + 2] + B[d + 2];
      const t = cl(en / 6, 0, 1) ** 0.8, g = (bi * c0 + bq * s0) / (sqrt(bi * bi + bq * bq) + 1e-9);
      const k = 3 * ((((g * 0.5 + 0.5) * (GS - 1) + 0.5) | 0) * LS + ((t * (LS - 1) + 0.5) | 0));
      display.setPixel(x, y, lut[k] * 255, lut[k + 1] * 255, lut[k + 2] * 255);
    }
  }
}
