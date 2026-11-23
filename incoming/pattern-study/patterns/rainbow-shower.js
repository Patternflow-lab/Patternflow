// ===== Patternflow pattern =====
// Title:   Rainbow Shower
// Family:  rainbow
// Idea:    The rainbow of a passing shower worked out from Airy's wave theory, a soft bright primary bow with pink and green supernumerary fringes inside it, a dark band of Alexander and a paler secondary above it, drawn per pixel and per wavelength from the drop size, so that small drops give a wide white fogbow and large drops a narrow saturated bow, seen only where curtains of rain drift between the viewer and a dark sky.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the rainbow as a caustic of the rays inside a water drop (Descartes, 1637, from memory; Newton on its colours, 1704), the interference fringes under the Airy function (Thomas Young, 1804; George Biddell Airy, 1838, from memory), Alexander's dark band (Alexander of Aphrodisias, around 200 AD), the fogbow of small drops (Mie scattering, 1908, from memory), the refractive index of water by a Cauchy fit (from memory), the colour matching functions as a multi-lobe Gaussian fit (Wyman, Sloan and Shirley, 2013, from memory), pattern round 227
// Round:   227
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Drop=0..3, Shower=-1..1, Sun=-1..1
//
// Knob 1: Tint. The colour of the shower's own faint haze and a small lean of the white. The haze is a blue-grey at 0, violet at 0.25, a warm red-orange at 0.5, a yellow-green at 0.75 and cyan at 1, and the bow's white (the fogbow, the veil inside the bow) leans 22 percent toward the same colour. The haze colour also wanders by up to 0.15 of the colour wheel on its own. The spectral colours of the bow itself do not move.
// Knob 2: Drop. The radius of the drops on a log scale, 0.05 mm at 0 (drizzle: the Airy peaks of the twelve wavelengths lie on top of each other and the bow is a pale veil about 18 LEDs across), 0.37 mm at 2 where it opens (a bow about 14 LEDs of colour with fringes 6.6 and 4.6 LEDs apart under it) and 1 mm at 3 (a thin saturated bow, fringes 3.4 LEDs apart that fade into the haze beyond the second). The radius also varies across the panel by a factor of about 0.4 to 2.5 and the whole shower coarsens and thins over a few minutes, so one panel holds both kinds.
// Knob 3: Shower. The share of the panel that is raining: 10 percent at -1 (a few separate sheets with wide dark gaps), 68 percent at 0 where it opens, 98 percent at +1 (a solid wall). The share breathes by about 14 percent as showers pass. Where it rains the bow shows, and in the gaps only a faint haze is left.
// Knob 4: Sun. The height of the sun, which sets where the antisolar point lies. At -1 the primary lies 30 LEDs above the middle of the panel, so the panel is mostly the bright sky inside it and the secondary is off the top; at 0.06 where it opens the primary is 21 LEDs below the middle and the secondary 40 LEDs above it, with Alexander's dark band between; at +1 the bows have sunk, the primary is 68 LEDs below the middle, off the bottom edge, and the panel holds the dark band and the secondary with its fringes above. Whatever the knob, the point drifts: the bows slide by up to 50 LEDs along their normal, tilt by up to 70 degrees from level, and change their curvature by about a third as the stylised scale (0.128 degrees an LED) breathes.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, log, sin, cos, pow, abs, min, max, PI, asin, acos, cbrt } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Twelve wavelengths, 25 nm apart, 412.5 to 687.5 nm.
const NL = 12;
const LAM0 = 412.5, LAMD = 25;

// The Airy function by its power series (ok down to about -9) and its asymptotic form beyond, tabulated as
// Ai(x)^2 over -30..6 in steps of 1/32, divided by its maximum (0.28699 at x = -1.0188) so that a bow peaks at 1.
const XMIN = -30, XSTEP = 32, XMAXI = 36 * XSTEP;
function airy(x) {
  if (x < -9) {
    const z = -x, ze = (2 / 3) * z * sqrt(z), ph = ze + PI / 4;
    return (sin(ph) - (5 / (72 * ze)) * cos(ph)) / (sqrt(PI) * pow(z, 0.25));
  }
  const c1 = 0.355028053887817, c2 = 0.258819403792807;
  const x3 = x * x * x;
  let a = 1, b = x, f = 1, g = x;
  for (let k = 0; k < 90; k++) {
    a *= x3 / ((3 * k + 2) * (3 * k + 3));
    b *= x3 / ((3 * k + 3) * (3 * k + 4));
    f += a; g += b;
    if (abs(a) + abs(b) < 1e-17) break;
  }
  return c1 * f - c2 * g;
}

// A wavelength's bow: the angle of its minimum deviation from the antisolar point, and the scale of its Airy
// argument. For k internal reflections the deviation is D(i) = k*pi + 2i - 2(k+1)r with sin i = n sin r, and it
// is stationary where cos^2 i = (n^2 - 1)/(k(k+2)). Near that angle D = Dmin + D''(db)^2/2 in the impact
// parameter b, and the wave integral over b is an Airy function of x = dtheta (ka)^(2/3) (2/D''_bb)^(1/3), with
// D''_bb = D''_ii / cos^2 i0. Checked against a direct integral over the exact rays of a drop: the dark and
// bright fringes sit at that x to a few percent from the second fringe on (the first bright fringe sits a
// little nearer the bow than the cubic says), and the fringes scale as a^(-2/3).
function bowOf(n, k) {
  const c2 = (n * n - 1) / (k * (k + 2));
  const i0 = acos(sqrt(c2));
  const D = (i) => k * PI + 2 * i - 2 * (k + 1) * asin(sin(i) / n);
  const h = 1e-4;
  const Dii = (D(i0 + h) - 2 * D(i0) + D(i0 - h)) / (h * h);
  const Dmin = D(i0);
  const alpha = (k === 1 ? PI - Dmin : Dmin - PI) * 180 / PI; // degrees from the antisolar point
  return { alpha, c: cbrt((2 * c2) / abs(Dii)) };
}

// Wyman, Sloan and Shirley's multi-lobe fit of the CIE 1931 colour matching functions.
function lobe(l, mu, s1, s2) {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return exp(-0.5 * t * t);
}
function cmf(l) {
  return [
    1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2),
    0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1),
    1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8),
  ];
}

function hsv(h, s, v) {
  h = h - floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

// Value noise on a 64 x 64 lattice that wraps, two lattices blended by the cosine and sine of an angle that
// turns slowly, so that the field changes in place as well as drifting (a cos + b sin keeps the variance).
function lattice() {
  const a = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) a[i] = Math.random() * 2 - 1;
  return a;
}
function noise(A, B, ca, sa, u, v) {
  const iu = floor(u), iv = floor(v);
  let fu = u - iu, fv = v - iv;
  fu = fu * fu * fu * (fu * (fu * 6 - 15) + 10);
  fv = fv * fv * fv * (fv * (fv * 6 - 15) + 10);
  const i0 = iu & 63, i1 = (iu + 1) & 63, j0 = (iv & 63) << 6, j1 = ((iv + 1) & 63) << 6;
  const a = (A[j0 + i0] * ca + B[j0 + i0] * sa), b = (A[j0 + i1] * ca + B[j0 + i1] * sa);
  const c = (A[j1 + i0] * ca + B[j1 + i0] * sa), d = (A[j1 + i1] * ca + B[j1 + i1] * sa);
  const top = a + (b - a) * fu, bot = c + (d - c) * fu;
  return top + (bot - top) * fv;
}

// A little drift made of sines whose periods do not divide one another.
const wob = (t, a, w1, p1, b, w2, p2, c, w3, p3) => a * sin(w1 * t + p1) + b * sin(w2 * t + p2) + c * sin(w3 * t + p3);

const AMIN = 0.012, AMAX = 2.0; // local drop radius in mm
const REL = 0.14; // spread of the drop radius inside one patch, relative
const NG = 64; // entries of the exposure table, in log drop radius
const NH = 128, HLO = -1.2, HHI = 1.2; // histogram of the rain noise, to put the threshold where the coverage asks

export function setup(P) {
  P.t = 0;
  P.ready = false;
  P.kv = [0, 2, 0, 0.06];
  // Airy tables, bow by wavelength.
  const n = XMAXI + 2;
  P.ai = new Float32Array(n);
  P.mean = new Float32Array(n);
  P.wt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = XMIN + i / XSTEP, z = max(0.4, -x);
    const a = airy(x);
    P.ai[i] = (a * a) / 0.28699;
    // Drops of one patch are not all one size: with a spread of REL in radius the fringe of phase (2/3) z^(3/2)
    // loses its contrast as exp(-(phase REL)^2 / 2), so the fringes give way to their mean, which falls on as
    // 1/(2 pi sqrt z) and is thinned further deep inside the bow.
    const ph = (2 / 3) * z * sqrt(z) * REL;
    P.wt[i] = x > -1 ? 0 : 1 - exp(-0.5 * ph * ph);
    P.mean[i] = (1 / (2 * PI * sqrt(z)) / 0.28699) * (0.12 + 0.4 * exp(-(z / 7) * (z / 7)));
  }
  const ap = new Float64Array(NL), as = new Float64Array(NL), kp = new Float64Array(NL), ks = new Float64Array(NL);
  const wr = new Float64Array(NL), wg = new Float64Array(NL), wb = new Float64Array(NL);
  let sr = 0, sg = 0, sb = 0;
  for (let l = 0; l < NL; l++) {
    const lam = LAM0 + LAMD * l; // nm
    const nw = 1.3236 + 3260 / (lam * lam); // refractive index of water, Cauchy fit
    const p = bowOf(nw, 1), s = bowOf(nw, 2);
    ap[l] = p.alpha; as[l] = s.alpha;
    // x per degree for a drop of 1 m radius, times a^(2/3) in metres.
    const q = pow(TAU / (lam * 1e-9), 2 / 3) * PI / 180;
    kp[l] = q * p.c; ks[l] = q * s.c;
    const [X, Y, Z] = cmf(lam);
    const r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    const g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    const b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
    wr[l] = r; wg[l] = g; wb[l] = b;
    sr += r; sg += g; sb += b;
  }
  // White balance: an equal-energy spectrum is (1, 1, 1), so a bow wide enough to cover all twelve is white.
  for (let l = 0; l < NL; l++) { wr[l] /= sr; wg[l] /= sg; wb[l] /= sb; }
  P.ap = ap; P.as = as; P.kp = kp; P.ks = ks; P.wr = wr; P.wg = wg; P.wb = wb;
  P.apm = ap[5] * 0.5 + ap[6] * 0.5; P.asm = as[5] * 0.5 + as[6] * 0.5;
  // Exposure: the brightest the primary gets for each drop radius, summed over the twelve wavelengths. A sharp
  // bow spreads its light over many colours and is dimmer than a fogbow, so each size is brought part of the
  // way back to one level.
  P.gain = new Float32Array(NG + 1);
  const lum = new Float64Array(NG + 1);
  for (let g = 0; g <= NG; g++) {
    const a = AMIN * pow(AMAX / AMIN, g / NG) * 1e-3;
    const a23 = pow(a, 2 / 3);
    let best = 0;
    for (let k = 0; k < 600; k++) {
      const alpha = 38 + k * (46 - 38) / 600;
      let R = 0, G = 0, B = 0;
      for (let l = 0; l < NL; l++) {
        const x = (alpha - ap[l]) * kp[l] * a23;
        if (x > 5.9 || x < XMIN) continue;
        const f = (x - XMIN) * XSTEP, i = f | 0, u = f - i;
        const v = P.ai[i] + (P.ai[i + 1] - P.ai[i]) * u;
        R += wr[l] * v; G += wg[l] * v; B += wb[l] * v;
      }
      const m = min(R, G, B);
      if (m < 0) { R -= m; G -= m; B -= m; }
      const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      if (y > best) best = y;
    }
    lum[g] = best;
  }
  // The fogbow of drizzle is a wide veil more than a bow, and is kept a little under that level.
  for (let g = 0; g <= NG; g++) {
    const amm = AMIN * pow(AMAX / AMIN, g / NG);
    P.gain[g] = pow(0.55 / max(0.05, lum[g]), 0.85) * (0.55 + 0.45 * smooth((amm - 0.025) / 0.25));
  }
  // Noise lattices: three octaves of rain, one of drop size.
  P.nA = [lattice(), lattice(), lattice(), lattice()];
  P.nB = [lattice(), lattice(), lattice(), lattice()];
  P.out = new Uint8Array(NPX * 3);
  P.nz = new Float32Array(NPX);
  P.grid = new Float32Array(33 * 65);
  P.dgrid = new Float32Array(17 * 33);
  P.hist = new Float32Array(NH);
}

export function update(dt, input, P) {
  const kvIn = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const kv = P.kv;
  if (!P.ready) {
    P.ready = true;
    for (let i = 0; i < 4; i++) kv[i] = kvIn[i];
  } else {
    const e = 1 - exp(-d / 0.18);
    for (let i = 0; i < 4; i++) kv[i] += (kvIn[i] - kv[i]) * e;
  }
  P.t += d;
  render(P);
}

function render(P) {
  const { out, ai, mean, wt, ap, as, kp, ks, wr, wg, wb, gain, nA, nB, nz, hist } = P;
  const t = P.t * 1.6;
  const kTint = cl(P.kv[0], 0, 1), kDrop = cl(P.kv[1], 0, 3), kRain = cl(P.kv[2], -1, 1), kSun = cl(P.kv[3], -1, 1);

  // Where the antisolar point is. sc is the stylised magnification in degrees per LED; the point lies far off the
  // panel, along a direction tilted by phi from straight down, at the distance that puts the primary q LEDs
  // below the middle of the panel along that direction.
  const sc = 0.128 * (1 + 0.14 * sin(0.0319 * t + 5.2) + 0.08 * sin(0.0571 * t + 1.9) + 0.1 * sin(0.0087 * t + 0.4));
  const phi = 0.1 + wob(t, 0.5, 0.0213, 1.1, 0.32, 0.0137, 3.9, 0.12, 0.0431, 0.3) + 0.22 * sin(0.0097 * t + 2.6);
  const ks0 = kSun - 0.06;
  const q0 = 21 + (ks0 < 0 ? 48 : 50) * ks0;
  const q = q0 + wob(t, 17, 0.0327, 0.7, 12, 0.0462, 2.4, 2.5, 0.357, 4.4) + 20 * sin(0.0119 * t + 3.3);
  const dA = 41.9 / sc + q;
  const Ax = 31.5 + dA * sin(phi), Ay = 63.5 + dA * cos(phi);

  // The shower: three octaves of noise stretched along the fall of the rain, the streaks tilted by a shear that
  // changes slowly, each octave drifting at a speed and on a turning blend of its own.
  const shear = 0.06 + wob(t, 0.1, 0.0273, 2.0, 0.07, 0.0617, 0.0, 0, 1, 0);
  const ox = 0.9 * t + wob(t, 18, 0.037, 0.4, 9, 0.0913, 2.2, 0, 1, 0);
  const oy = wob(t, 14, 0.031, 1.7, 8, 0.0707, 3.1, 0, 1, 0);
  const LXs = [15, 7.5, 3.8], LYs = [100, 56, 34], MX = [1.0, 1.35, 1.8], FALL = [1.2, 3.0, 6.5];
  const WTS = [0.6, 0.3, 0.07], TW = [0.047, 0.083, 0.137];
  const oct = [];
  for (let k = 0; k < 3; k++) {
    const th = TW[k] * t + 0.9 * sin(0.0113 * (k + 1) * t + k * 2.1);
    oct.push([ox * MX[k], -FALL[k] * t + oy * (1 + 0.4 * k), cos(th), sin(th)]);
  }
  const thD = 0.029 * t + 1.3 * sin(0.0083 * t + 0.5);
  const cD = cos(thD), sD = sin(thD);
  const dox = 0.5 * t + 12 * sin(0.0191 * t + 4.0), doy = -0.3 * t + 20 * sin(0.0137 * t + 1.0);
  // drop radius from the knob (mm), on a log scale, with the whole shower coarsening and thinning over minutes
  const lnA0 = log(0.05) + (kDrop / 3) * log(20) + wob(t, 0.5, 0.0237, 1.7, 0.35, 0.0613, 4.2, 0.3, 0.0113, 5.1);

  // First pass: the noise of the rain curtain everywhere, and the threshold that leaves the asked share of the
  // panel raining. That share is 10 percent at Shower -1, 60 at 0 and 97 at +1, and a shower passing makes it
  // breathe by about a tenth.
  hist.fill(0);
  let sum = 0, sum2 = 0;
  // The noise is smooth over a few LEDs, so it is taken on every second LED each way and filled in between.
  const GW2 = W / 2 + 1, GH2 = H / 2 + 1, g = P.grid;
  for (let gy = 0; gy < GH2; gy++) {
    const y = gy * 2;
    for (let gx = 0; gx < GW2; gx++) {
      const xs = gx * 2 - 31.5 - shear * (y - 63.5);
      let v = 0;
      for (let k = 0; k < 3; k++) {
        const c = oct[k];
        v += WTS[k] * noise(nA[k], nB[k], c[2], c[3], (xs + c[0]) / LXs[k], (y + c[1]) / LYs[k]);
      }
      g[gy * GW2 + gx] = v;
    }
  }
  for (let y = 0; y < H; y++) {
    const gy = y >> 1, fy = (y & 1) * 0.5, r0 = gy * GW2, r1 = r0 + GW2;
    for (let x = 0; x < W; x++) {
      const gx = x >> 1, fx = (x & 1) * 0.5;
      const top = g[r0 + gx] + (g[r0 + gx + 1] - g[r0 + gx]) * fx, bot = g[r1 + gx] + (g[r1 + gx + 1] - g[r1 + gx]) * fx;
      const v = top + (bot - top) * fy;
      nz[y * W + x] = v;
      sum += v; sum2 += v * v;
      const hb = cl(((v - HLO) / (HHI - HLO)) * NH, 0, NH - 1e-3);
      hist[hb | 0]++;
    }
  }
  const mu = sum / NPX, sd = sqrt(max(1e-6, sum2 / NPX - mu * mu));
  let cov = (kRain < 0 ? 0.68 + 0.58 * kRain : 0.68 + 0.3 * kRain) + 0.14 * (0.6 * sin(0.0267 * t + 0.6) + 0.4 * sin(0.0719 * t + 2.2));
  cov = cl(cov, 0.04, 0.985);
  let acc = 0, thr = HHI;
  const want = (1 - cov) * NPX;
  for (let i = 0; i < NH; i++) {
    if (acc + hist[i] >= want) {
      thr = HLO + ((i + (hist[i] > 0 ? (want - acc) / hist[i] : 0)) / NH) * (HHI - HLO);
      break;
    }
    acc += hist[i];
  }
  const wd = 1.0 * sd;

  // The drop size field, smooth over tens of LEDs, on every fourth LED each way.
  const dg = P.dgrid;
  for (let gy = 0; gy < 33; gy++)
    for (let gx = 0; gx < 17; gx++) dg[gy * 17 + gx] = noise(nA[3], nB[3], cD, sD, (gx * 4 + dox) / 60, (gy * 4 + doy) / 90);

  // Colours of the tint: the glow, and the white's lean.
  // the haze colour also wanders a little on its own
  const hue = 0.58 + 0.9 * kTint + 0.09 * sin(0.0317 * t + 1.4) + 0.06 * sin(0.0773 * t + 4.1);
  const gl = hsv(hue, 0.55, 1);
  const gy = 0.2126 * gl[0] + 0.7152 * gl[1] + 0.0722 * gl[2];
  const glow = [gl[0] / gy, gl[1] / gy, gl[2] / gy];
  const tn = hsv(hue, 0.6, 1);
  const ty = 0.2126 * tn[0] + 0.7152 * tn[1] + 0.0722 * tn[2];
  const lean = [1 + 0.22 * (tn[0] / ty - 1), 1 + 0.22 * (tn[1] / ty - 1), 1 + 0.22 * (tn[2] / ty - 1)];
  // the haze and the bow's strength rise and fall as the shower thickens and thins
  const hz = 1 + 0.3 * sin(0.0233 * t + 0.9) + 0.2 * sin(0.0917 * t + 3.0), bz = 1 + 0.16 * sin(0.0411 * t + 2.0) + 0.12 * sin(0.1137 * t + 0.6);
  const G_IN = 0.06 * hz, G_OUT = 0.022 * hz, G_MID = 0.009 * hz, GW = 2.6;
  const SAT = 0.8;
  const SECOND = 0.55; // the secondary is dimmer than the primary
  const lnSpan = log(AMAX / AMIN), LNMIN = log(AMIN), LNMAX = log(AMAX) - 0.01;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = y * W + x, o = px * 3;
      const m = smooth((nz[px] - thr + wd) / (2 * wd));
      // angle from the antisolar point
      const dx = x - Ax, dy = y - Ay;
      const al = sqrt(dx * dx + dy * dy) * sc;
      // the shower's own light: brighter inside the primary than outside the secondary, dim between
      const gin = (1 - smooth((al - P.apm) / GW + 0.5)) * (0.25 + 0.75 * exp(-max(0, P.apm - al) / 5)), gout = smooth((al - P.asm) / GW + 0.5);
      const gg = G_MID + (G_IN - G_MID) * gin + (G_OUT - G_MID) * gout;
      // the haze follows the rain's density more loosely than the bow does, so it carries the curtains
      const dens = smooth((nz[px] - mu) / (3 * sd) + 0.5);
      const mg = (0.12 + 0.88 * smooth((nz[px] - thr + 2.2 * wd) / (4.4 * wd))) * (0.55 + 0.45 * dens);
      let R = gg * glow[0] * mg, G = gg * glow[1] * mg, B = gg * glow[2] * mg;
      if (m >= 0.004) {
        // drop radius here
        const dr0 = (y >> 2) * 17 + (x >> 2), fx = (x & 3) * 0.25, fy = (y & 3) * 0.25;
        const dtp = dg[dr0] + (dg[dr0 + 1] - dg[dr0]) * fx, dbt = dg[dr0 + 17] + (dg[dr0 + 18] - dg[dr0 + 17]) * fx;
        const nd = dtp + (dbt - dtp) * fy;
        const lnA = cl(lnA0 + 1.0 * nd, LNMIN, LNMAX);
        const a23 = exp((2 / 3) * (lnA - 6.9078)); // radius in metres to the 2/3 (1e-3 m is ln -6.9078)
        const ex = ((lnA - LNMIN) / lnSpan) * NG, ei = ex | 0;
        const ga = gain[ei] + (gain[ei + 1] - gain[ei]) * (ex - ei);
        // fringes closer than about 3.6 LEDs would only alias: beyond that depth they give way to their mean
        const kpix = (kp[6] * a23 * sc * 3.6) / PI;
        const zf = cl(1 / (kpix * kpix), 1.5, 40);
        let bR = 0, bG = 0, bB = 0;
        for (let l = 0; l < NL; l++) {
          let v = 0;
          const xp = (al - ap[l]) * kp[l] * a23;
          if (xp < 5.9) {
            const f = (xp < XMIN ? 0 : xp - XMIN) * XSTEP, i = f | 0;
            v = ai[i] + (ai[i + 1] - ai[i]) * (f - i);
            if (xp < -1) {
              let w = wt[i];
              if (-xp > zf) w = max(w, smooth((-xp - zf) / (0.5 * zf)));
              v += (mean[i] - v) * w;
            }
          }
          const xq = (as[l] - al) * ks[l] * a23;
          if (xq < 5.9) {
            const f = (xq < XMIN ? 0 : xq - XMIN) * XSTEP, i = f | 0;
            let u = ai[i] + (ai[i + 1] - ai[i]) * (f - i);
            if (xq < -1) {
              let w = wt[i];
              if (-xq > zf) w = max(w, smooth((-xq - zf) / (0.5 * zf)));
              u += (mean[i] - u) * w;
            }
            v += SECOND * u;
          }
          bR += wr[l] * v; bG += wg[l] * v; bB += wb[l] * v;
        }
        const mm = min(bR, bG, bB);
        if (mm < 0) { bR -= mm; bG -= mm; bB -= mm; }
        // a little of the colours' purity goes back to white, as the sky behind the rain would take it
        // and where the bow is dim its colour thins toward grey, so a faint orange skirt does not read as brown
        const yl = 0.2126 * bR + 0.7152 * bG + 0.0722 * bB;
        // thicker and thinner places inside the rain, whatever the share of the panel that is raining
        const k = ga * bz * m * (0.5 + 0.5 * dens), sat = SAT * (0.35 + 0.65 * smooth((yl * k) / 0.2));
        R += (yl + (bR - yl) * sat) * k * lean[0];
        G += (yl + (bG - yl) * sat) * k * lean[1];
        B += (yl + (bB - yl) * sat) * k * lean[2];
      }
      out[o] = enc(R); out[o + 1] = enc(G); out[o + 2] = enc(B);
    }
  }
}

// linear to 8 bit: a soft shoulder, then a gamma of 1/2.2
function enc(v) {
  if (v <= 0) return 0;
  v = v / (1 + 0.28 * v);
  return (255 * pow(v, 0.4545) + 0.5) | 0;
}

export function draw(display, P) {
  const { out } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
