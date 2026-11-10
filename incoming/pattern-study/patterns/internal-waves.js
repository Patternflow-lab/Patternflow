// ===== Patternflow pattern =====
// Title:   Internal Waves
// Family:  wave
// Idea:    A stack of dyed layers in a stratified fluid is shaken by four wavemakers, each sending out a cross of four tilted beams of internal waves that wrap round the edges and cross one another, so the layers ripple, tilt along the beams, steepen and fold over, and where a wave breaks a pale curl rolls up and mixes a patch before the water settles back into layers.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Internal gravity waves in a stably stratified fluid, omega = N cos(theta) with theta the angle of the phase lines to the vertical, and the St Andrew's cross of four beams from a shaken body (Mowbray and Rarity, 1967; Sutherland and Linden, 2002; both from memory); energy going along the beam while the crests move across it (Lighthill, 1978, from memory); beams that wrap or reflect into attractors (Maas and Lam, 1995, from memory); breaking of a beam, and the subharmonic instability that feeds it (Staquet and Sommeria, 2002, review, from memory); the light as synthetic schlieren of the density gradient (Dalziel, Hughes and Sutherland, 2000, from memory); two-dimensional Boussinesq vorticity and buoyancy equations in a gradient-periodic box, as Salt Fingers uses for its background gradients, pseudo-spectral with the two-thirds rule (Orszag, 1971, from memory) and an integrating-factor Adams-Bashforth step (Lawson, 1967, from memory); the thermostat on the forcing amplitude and the colour function are mine in this form; colour in OKLab (Bjorn Ottosson, 2020, from memory); pattern round 124
// Round:   126
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..3.5, Scale=-1..1, Angle=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every colour of the stack, so one turn comes back. At 0 the slabs run through indigo, ultramarine, sea blue, teal, green, ice, cream, coral and rose, between lightness 0.24 and 0.93. Where a turn takes a hue into the orange to olive stretch (about 45 to 135 degrees) the colour is lifted toward lightness 0.88, loses up to 40 per cent of its chroma and is not darkened by the shading, because a dim orange or olive reads as mud on the panel; at 0.4 the old indigo and blue slabs sit in that stretch and come out apricot and butter.
// Knob 2: Pace. Model time units per panel second, 2.2 per unit of the knob, with N, the buoyancy frequency, at 1 per model time unit: the forcing period is 4.5 s at 1, 2.25 s at the opening 2 and 1.28 s at 3.5, and the water's rms speed is 6.0, 13.0 and 20.8 LEDs a second. Nothing else moves with it: the share of the panel that is overturned is 2.4, 2.6 and 2.5 per cent at those three places. Stepping costs 0.47, 0.91 and 1.56 ms a frame in Node.
// Knob 3: Scale. Two sizes move together: the radius of a wavemaker, 3.0 LEDs times 1.45 to the knob (2.1 at -1, 4.35 at 1), and the thickness of the dyed slabs, 1.3 to the knob times the opening's (mean 6.5 LEDs and never under 4 at 0, 5.0 at -1, 8.5 at 1). The panel holds only about two wavelengths across, so the wave field stays near the size of the box: the spectral centroid of b' is at a wavelength of 25.0, 29.4 and 32.4 LEDs at -1, 0 and 1 (42, 47 and 51 LEDs along a row), and the forcing gain the thermostat settles on is 5.3, 3.4 and 2.7.
// Knob 4: Angle. The angle of the beams from the vertical, 52 degrees minus 24 times the knob, so the forcing frequency is omega = N cos(angle): 76 degrees and 0.24 N at -1 (beams almost flat, forcing period 5.9 s), 50.6 degrees and 0.635 N at the opening 0.06, 28 degrees and 0.88 N at 1 (beams nearly upright, period 1.6 s). The rms speed is 8.9, 13.0 and 13.5 LEDs a second at those places. The frequency follows the knob with a time constant of 0.6 s, and the beams need a few forcing periods to turn.

// What the field is. Two-dimensional Boussinesq flow in a vertical slice, x across (64 LEDs) and z up (128 LEDs, the top row of the panel is the top of
// the slice), in LEDs and in 1 / N. The density is N^2 z + b' with b' and the stream function psi periodic in both directions, so there are no walls to
// reflect from and the stratification cannot be mixed away. With u = psi_z, w = -psi_x, the vorticity eta = lap psi, J(psi, f) = u f_x + w f_z:
//   eta_t + J(psi, eta) = -b'_x + nu lap eta - nu4 lap^2 eta - r eta + F,    b'_t + J(psi, b') = -N^2 w + kappa lap b' - kappa4 lap^2 b' - s (mean of b' along the row).
// nu = kappa = 0.3 LED^2 per time unit, nu4 = kappa4 = 0.8 LED^4 per time unit (it takes the grid scale), r = 0.02 and 0.12 on the modes with no x variation
// (a wind along the rows would only shear the picture), s = 0.1. F is four Gaussian blobs of force of the radius of Knob 3, pointing mostly up and
// down, whose strength goes as cos(phase). The phase runs at omega, and the frequency (10 per cent), the strength (30 per cent), the direction and the
// place (6 by 8 LEDs) wander as Ornstein-Uhlenbeck processes of 40 to 250 time units, so each cross swings a few degrees and nothing repeats. The force has no mean
// along a row. A thermostat steers the gain of F so that the rms of b'_z stays at 0.52 N^2 (the average over 12 time units, d ln gain / dt = 0.015
// ln(0.52 / average)): at that level the waves overturn the layers over 2.4 per cent of the panel at any moment, with patches that come and go, and
// without it the energy would pile up or drain depending on the knobs.
// The grid is 32 by 64 cells of 2 LEDs, the two-thirds rule keeps |m| <= 10, |n| <= 21 (wavelengths down to 6.4 LEDs, 451 modes in the half plane), and b' is
// padded with zeros to the panel's 64 by 128 for the picture. For each mode the linear terms (the wave, the viscosity and the drag) are one 2 by 2
// matrix, exponentiated in closed form: exp(-m dt) (cos(Omega dt) + sin(Omega dt) / Omega M0) with Omega^2 = omega_k^2 - delta^2, so the step is limited by the
// advection alone, and the advective terms go through Adams-Bashforth 3 on top of it. The step comes from a ladder 0.25 2^(-l/4) so that
// 1.03 max(|u| + |w|) dt stays under 0.6. The first frame is the linear response to the forcing over 260 time units in big steps (no transforms), scaled to
// the thermostat's level, then 10 time units of the full model: 0.17 s in Node. If rms b'_z ever passes 6 or goes bad the box starts again from there.
//
// The picture. The colour of a pixel is a function of beta = z + b', the height its water would have in the resting column, so every LED shows which
// isopycnal passes through it and the layers are the contours of the solution. The function is a stack of slabs 4 to 10 units thick, each of a colour
// drawn from a shuffled bag of eleven (indigo to rose, Knob 1), joined by soft or sharp steps, with a lamination of period 4 to 6 units at 0.035 of lightness
// inside each slab so that flat colour still shows the water move, and a thin pale line where about 40 per cent of the slabs begin. The lightness of the
// stack follows two swells of period 22 to 30 and 11 to 16 units, and each slab is the colour from the bag closest to the swell at its height. The light on
// the water is the synthetic schlieren of the experiments: 1 + 0.55 q / (1 + |q|) with q = 1.3 b'_z, brighter where the waves squeeze the layers (and
// darker where they pull them apart, not for the hues of Knob 1 that would go brown), so the phase fronts of the beams show as tilted light and dark
// bands over the dyed layers. Where 1 + b'_z falls below 0.15 the water goes toward white, by 0.45 at most at -0.5: the foam of a breaking wave.
//
// What was checked, with the file's own step (the harness is a copy of the file with the dissipation switched off where it says so):
// - Linear frequency. A single mode, amplitude 1e-6, no dissipation, stepped through the real step for 400 time units, crosses zero at omega = N kx / |k|
//   to a relative 5.2e-7, 1.1e-7, 7.0e-9, 7.4e-8 and 4.7e-10 for the modes (m, n) = (3, 2), (5, 9), (2, 20), (8, 1) and (1, 18), omega 0.9487, 0.7433, 0.1961,
//   0.9981 and 0.1104. A wrong sign in either coupling term would have made the mode grow.
// - The advective terms. For psi = A cos(kx x) + B cos(kz z) and b' = Bb cos(kz z) the tendencies of the (2, 3) mode are -3.4139e-5 for eta and -4.5541e-3 for
//   b' against the closed forms A B kx kz (kx^2 - kz^2) / 4 and A kx Bb kz / 4, so u = psi_z, w = -psi_x and the signs of both advections are as written.
//   With all dissipation off, the advective tendencies of the kinetic plus potential energy are 1.1e-16 and 3.4e-16 of the sum of their absolute terms
//   (random states of speed 2.6 and 10.7).
// - Beam angle. One source on its own, linear model, vertical force, radius 2.5 LEDs: the ratio of <b'_z^2> to <b'_x^2> over a forcing period in the ring 20 to 40
//   LEDs from it gives the angle of the beams (the phase lines run along them) of 30.8, 39.1, 51.5, 62.9 and 77.3 degrees from the vertical for omega = N cos(angle)
//   at 28, 40, 52, 64 and 76 degrees. In that run 65 per cent of |b'|^2 sits in modes whose own frequency is between 0.9 and 1.2 of the forcing's (74 per cent up to 1.3).
//   The four beams are plain at a fixed phase and hidden in the power over a period: the near field of the blob is 4.9 times their amplitude. A box 64 LEDs wide
//   holds few modes near the cone omega_k = omega (the two modes (2, 5) and (2, -5) carry 24 per cent of |b'|^2), so the picture shows the beams as a
//   field of tilted fronts that the wandering frequencies keep moving, and not as four clean lines.
// - Energy balance at the opening over 900 s: the input of the force, the sum of 2 Re(eta* F) / k^2 per mode, averages 0.6700 against 0.6684 for the dissipation, a ratio of 1.002.
//   Per minute rms b'_z is 0.50 to 0.55, the gain 2.8 to 4.2, the kinetic and potential energy 3.2 to 4.4 each and the overturned share 2.0 to 2.8 per cent. Nothing
//   piles up in the large scales: every 10 s for 90 s the share of the kinetic energy in modes with no x variation is 3 to 15 per cent.
// - What broke. On a 64 by 128 grid with only nu = kappa = 0.3 the run at all-minimum knobs burst at 60 s and 80 s (b'_z fell to -39 and -52, the largest |u| and the largest |w| added to 59 and 55), at
//   the bottom of the step ladder, so not a step problem: the fold of an overturning beam went to the grid scale. The fourth-order terms (0.1 on that grid, 0.8 on this one) stopped it.
//   Without the relaxation s the share of the potential energy in the row mean of b' went from 0.12 to 0.35 in 60 s (the stratification mixing away under the waves);
//   with s = 0.1 it stays at 0.03 to 0.05, and the row mean of 1 + b'_z over 900 s runs from -0.12 to 2.3 (from -0.40 to 2.5 at s = 0.03).
// - Resolution. The same run on 64 by 128 cells (0.1 on the fourth-order terms), 180 s at the opening: overturned share 2.44 per cent against 2.37, rms speed 10.6 LEDs a second against 11.6,
//   variance of b' at wavelengths under 8 LEDs 1.64 per cent against 0.89, and 7.6 ms a frame against 0.85. The finer grid cost nine times as much and the picture
//   could not be told from it at the panel's pitch, so the file runs the coarse one.
// - The picture and the study's quiet measure. A 16 by 16 block's mean light, for a picture that is a function of the isopycnal, changes only by what flows across the block's edges
//   (the flow is incompressible), so a stack drawn at random left blocks nearly still: over six draws of the stack and with the swells of lightness alone the quiet measure ran from 0.15 to 0.55 at the
//   opening and from 0.07 to 0.41 at all-maximum. With the schlieren shading too it is 0.43 or more in the last quarter of 240 s at the opening over the six draws, 0.42 or more at
//   all-maximum, and 0.42 or more at all-minimum in five of six (0.29 in the sixth). The waves themselves are even: the least active of 32 blocks of 16 by 16 has 0.82 of the mean |db'| per half second.
// - Staying alive. Over 900 s at the opening the thermostat's gain stays between 2.8 and 4.2 and rms b'_z between 0.50 and 0.55 by the minute, recur 0.52 and the picture's brightness 123.2 and 123.3 in the first and last quarter.

const { floor, sqrt, sin, cos, exp, abs, min, max, pow, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables --------------------------------------------------------------------------------------
const LX = 64, LZ = 128, NP = LX * LZ; // the panel: 64 columns, 128 rows, one LED is one length unit
const RS = 2; // LEDs per cell of the simulation grid
const SX = LX / RS, SZ = LZ / RS, NS_ = SX * SZ;
const KXM = floor(SX / 3), KZM = floor(SZ / 3); // modes kept: |m| <= KXM, |n| <= KZM (two-thirds rule)
const KMAX = max((TAU * KXM) / LX, (TAU * KZM) / LZ);
const NBV = 1; // buoyancy frequency N, the unit of inverse time
const NU = 0.3, KAP = 0.3, NU4 = 0.8, KAP4 = 0.8, DRAG = 0.02, DRAGM = 0.12, BREL = 0.1; // viscosity, diffusivity (LED^2 per time unit), the same at fourth order (LED^4), drag, extra drag on modes with no x variation, and a relaxation of the mean of b' along a row to zero
const NW = 4; // wavemakers
const SRC = [[17, 104], [47, 76], [17, 44], [47, 14]]; // where they sit, x and z (z up, rows from the bottom)
const SIG0 = 3.0; // radius of a wavemaker in LEDs at Scale 0
const EPS = 0.52; // rms of the buoyancy gradient b'_z / N^2 the forcing amplitude is steered to hold
const DTL = []; // time step ladder, 0.25 down to 0.005 in steps of 2^(1/4)
for (let l = 0; l < 24; l++) DTL.push(0.25 * pow(2, -l / 4));
const CFL_UP = 0.45, CFL_OK = 0.6, CFL_DN = 0.8;
const TMS = 2.2; // model time units per panel second at Pace 1

// ---- radix-2 FFT of nx by nz, rows contiguous, columns by butterflies across rows ----------------------------
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), c = new Float64Array(n / 2), s = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) (c[i] = cos((TAU * i) / n)), (s[i] = -sin((TAU * i) / n));
  return { n, rev, c, s };
}
// The columns of the spectrum that can hold a kept mode are 0 to KXM and nx - KXM to nx - 1, so the transforms down the columns run over
// those two stretches only: the inverse does its columns first, the forward its rows first.
function makeFft(nx, nz) {
  const PX = plan(nx), PZ = plan(nz);
  function rows(re, im, inv) {
    const { n, rev, c, s } = PX, sg = inv ? -1 : 1;
    for (let y = 0; y < nz; y++) {
      const o = y * nx;
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
        const half = len >> 1, step = n / len;
        for (let i = o; i < o + n; i += len)
          for (let k = 0, t = 0; k < half; k++, t += step) {
            const wr = c[t], wi = sg * s[t], a = i + k, b = a + half;
            const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
            re[b] = re[a] - xr;
            im[b] = im[a] - xi;
            re[a] += xr;
            im[a] += xi;
          }
      }
    }
  }
  function cols(re, im, inv) {
    const { n, rev, c, s } = PZ, sg = inv ? -1 : 1;
    for (let pass = 0; pass < 2; pass++) {
      const x0 = pass ? nx - KXM : 0, x1 = pass ? nx : KXM + 1;
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (j > i) {
          const a = i * nx, b = j * nx;
          for (let x = x0; x < x1; x++) {
            let t = re[a + x];
            re[a + x] = re[b + x];
            re[b + x] = t;
            t = im[a + x];
            im[a + x] = im[b + x];
            im[b + x] = t;
          }
        }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const half = len >> 1, step = n / len;
        for (let i = 0; i < n; i += len)
          for (let k = 0, t = 0; k < half; k++, t += step) {
            const wr = c[t], wi = sg * s[t], a = (i + k) * nx, b = a + half * nx;
            for (let x = x0; x < x1; x++) {
              const xr = re[b + x] * wr - im[b + x] * wi, xi = re[b + x] * wi + im[b + x] * wr;
              re[b + x] = re[a + x] - xr;
              im[b + x] = im[a + x] - xi;
              re[a + x] += xr;
              im[a + x] += xi;
            }
          }
      }
    }
  }
  return (re, im, inv) => {
    if (inv) {
      cols(re, im, true);
      rows(re, im, true);
    } else {
      rows(re, im, false);
      cols(re, im, false);
    }
  };
}
const fftS = makeFft(SX, SZ), fftO = makeFft(LX, LZ);

// ---- modes. The half plane (ni > 0, or ni = 0 and nj > 0) is stepped, the other half is its conjugate. ---------------------
// A mode's number is its index m in these lists; the state is kept per mode, and mP, mQ (the mode and its mirror) place it on the
// simulation grid, oP, oQ on the panel's grid.
const MP = [], MQ = [], OP = [], OQ = [], MKX = [], MKZ = [], MT = [], MNI = [], MNJ = [];
for (let nj = -KZM; nj <= KZM; nj++)
  for (let ni = 0; ni <= KXM; ni++) {
    if (ni === 0 && nj <= 0) continue;
    MP.push(((nj + SZ) % SZ) * SX + ni);
    MQ.push(((SZ - nj) % SZ) * SX + ((SX - ni) % SX));
    OP.push(((nj + LZ) % LZ) * LX + ni);
    OQ.push(((LZ - nj) % LZ) * LX + ((LX - ni) % LX));
    MKX.push((TAU * ni) / LX);
    MKZ.push((TAU * nj) / LZ);
    MT.push(ni * (KZM + 1) + abs(nj));
    MNI.push(ni);
    MNJ.push(nj);
  }
const NM = MP.length;
const mP = Int32Array.from(MP), mQ = Int32Array.from(MQ), oP = Int32Array.from(OP), oQ = Int32Array.from(OQ), mT = Int32Array.from(MT);
const mKX = Float64Array.from(MKX), mKZ = Float64Array.from(MKZ), mNI = Int32Array.from(MNI), mNJ = Int32Array.from(MNJ);
const mK2 = new Float64Array(NM), mIK2 = new Float64Array(NM);
for (let m = 0; m < NM; m++) {
  mK2[m] = mKX[m] * mKX[m] + mKZ[m] * mKZ[m];
  mIK2[m] = 1 / mK2[m];
}
const NT = (KXM + 1) * (KZM + 1);

// The exact propagator of one step for the linear terms of a mode (eta, b):
//   eta_t = -a eta - i kx b,   b_t = -d b - i (N^2 kx / k2) eta,   a = nu k2 + nu4 k4 + drag, d = kappa k2 + kappa4 k4 (+ relaxation).
// With m = (a + d) / 2, delta = (a - d) / 2, omega^2 = N^2 kx^2 / k2 this is exp(-m dt) (C I + S M0) with M0 the traceless part and
// (M0)^2 = (delta^2 - omega^2) I, so C = cos, S = sin / Omega for Omega^2 = omega^2 - delta^2 (cosh and sinh when it is negative).
// Four numbers per mode and step: e11, e22, f12 = kx S e, f21 = (N^2 kx / k2) S e.
function makeTables(dt) {
  const T = new Float64Array(NT * 4);
  for (let ni = 0; ni <= KXM; ni++)
    for (let nj = 0; nj <= KZM; nj++) {
      const q = (ni * (KZM + 1) + nj) * 4;
      const kx = (TAU * ni) / LX, kz = (TAU * nj) / LZ, k2 = kx * kx + kz * kz;
      if (k2 === 0) continue;
      const a = NU * k2 + NU4 * k2 * k2 + (ni === 0 ? DRAGM : DRAG), d = KAP * k2 + KAP4 * k2 * k2 + (ni === 0 ? BREL : 0);
      const m = 0.5 * (a + d), dl = 0.5 * (a - d), w2 = (NBV * NBV * kx * kx) / k2;
      const s2 = dl * dl - w2, ef = exp(-m * dt);
      let C, S;
      if (s2 < -1e-12) {
        const O = sqrt(-s2);
        C = cos(O * dt);
        S = sin(O * dt) / O;
      } else if (s2 > 1e-12) {
        const O = sqrt(s2);
        C = Math.cosh(O * dt);
        S = Math.sinh(O * dt) / O;
      } else {
        C = 1;
        S = dt;
      }
      T[q] = ef * (C - S * dl);
      T[q + 1] = ef * (C + S * dl);
      T[q + 2] = kx * S * ef;
      T[q + 3] = ((NBV * NBV * kx) / k2) * S * ef;
    }
  return T;
}
const TABS = DTL.map(makeTables);

// ---- state --------------------------------------------------------------------------------------------
const F64 = (n) => new Float64Array(n);
function makeState() {
  const hist = () => ({ er: F64(NM), ei: F64(NM), br: F64(NM), bi: F64(NM) });
  const S = {
    ready: false, t: 0, acc: 0, lv: 8, ord: 0, up: 0, umax: 0, wmax: 0, uw: 0,
    X: hist(), Nn: hist(), H1: hist(), H2: hist(), // the state, the tendency and two histories, per kept mode
    ar: F64(NS_), ai: F64(NS_), br_: F64(NS_), bi_: F64(NS_), cr: F64(NS_), ci: F64(NS_), pr: F64(NS_), pi: F64(NS_),
    fr: F64(NP), fi: F64(NP), bR: new Float32Array(NP), bZ: new Float32Array(NP), dirty: true,
    src: [], gA: 1, epsS: EPS, eps: EPS, om: 0.62, omT: 0.62, sig: SIG0, sigT: SIG0, sc: 1, scT: 1, pace: 2, hue: 0, lutHue: -1,
    lut: new Float32Array(LUTN * 4), ex: F64(2 * KXM + 2), ez: F64(2 * (2 * KZM + 1)),
  };
  for (let s = 0; s < NW; s++)
    S.src.push({ x0: SRC[s][0], z0: SRC[s][1], ph: Math.random() * TAU, a0: 0.5 * PI + (Math.random() - 0.5) * 1.2, fz: 0, az: 0, pz: 0, qz: 0, oa: 0 });
  return S;
}
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
const ou = (x, dt, tau) => {
  const e = exp(-dt / tau);
  return x * e + sqrt(1 - e * e) * gauss();
};

// ---- the wavemakers --------------------------------------------------------------------------------
// Each is a Gaussian blob of force of radius sig, pointing along the angle a0 (mostly up and down), whose strength goes as cos(phase).
// The phase runs at om (the frequency, in units of N) and the frequency, the strength, the direction and the place wander as
// slow Ornstein-Uhlenbeck processes, so that the four beams of a cross swing a few degrees and nothing repeats. The force has no mean along a
// row (modes with no x variation are left out): a horizontal push on a whole row would only shear it.
const FWAND = 0.1, AWAND = 0.3, PWAND = 6, ZWAND = 8, OWAND = 0.5;
function advanceSources(S, dt) {
  for (const q of S.src) {
    q.fz = ou(q.fz, dt, 40);
    q.az = ou(q.az, dt, 70);
    q.pz = ou(q.pz, dt, 250);
    q.qz = ou(q.qz, dt, 250);
    q.oa = ou(q.oa, dt, 150);
    q.ph = (q.ph + S.om * (1 + FWAND * q.fz) * dt) % TAU;
  }
}
// adds the force on the vorticity to the tendency
function addForcing(S, O) {
  const sig = S.sig, s2 = sig * sig, c0 = (TAU * s2) / NS_;
  const { ex, ez } = S;
  for (const q of S.src) {
    const xs = q.x0 + PWAND * q.pz, zs = q.z0 + ZWAND * q.qz, al = q.a0 + OWAND * q.oa;
    const amp = S.gA * max(0.2, 1 + AWAND * q.az) * cos(q.ph), ca = cos(al), sa = sin(al);
    // x factor: exp(-s2 kx^2 / 2) e^{-i kx xs}, (re, im) interleaved, for kx = 2 pi ni / LX
    for (let ni = 1; ni <= KXM; ni++) {
      const kx = (TAU * ni) / LX, g = exp(-0.5 * s2 * kx * kx);
      ex[2 * ni - 2] = g * cos(kx * xs);
      ex[2 * ni - 1] = -g * sin(kx * xs);
    }
    for (let nj = -KZM; nj <= KZM; nj++) {
      const kz = (TAU * nj) / LZ, g = exp(-0.5 * s2 * kz * kz) * c0;
      ez[2 * (nj + KZM)] = g * cos(kz * zs);
      ez[2 * (nj + KZM) + 1] = -g * sin(kz * zs);
    }
    for (let m = 0; m < NM; m++) {
      const ni = mNI[m];
      if (!ni) continue;
      const xr = ex[2 * ni - 2], xi = ex[2 * ni - 1], zr = ez[2 * (mNJ[m] + KZM)], zi = ez[2 * (mNJ[m] + KZM) + 1];
      const gr = xr * zr - xi * zi, gi = xr * zi + xi * zr, c = amp * (mKZ[m] * ca - mKX[m] * sa);
      O.er[m] -= c * gi; // i c g = c (-g_i, g_r)
      O.ei[m] += c * gr;
    }
  }
}

// ---- the advective terms and the forcing ---------------------------------------------------------------------
// N_eta = -(u eta_x + w eta_z), N_b = -(u b_x + w b_z), all in real space with u = psi_z, w = -psi_x, psi = -eta / k2.
// Three inverse transforms with two real fields packed in each (u + iw, eta_x + i eta_z, b_x + i b_z) and one forward transform of
// N_eta + i N_b, whose two halves are separated by conjugate pairs.
function evalN(S, O, lin) {
  O.er.fill(0);
  O.ei.fill(0);
  O.br.fill(0);
  O.bi.fill(0);
  if (!lin) {
    const { X, ar, ai, br_, bi_, cr, ci, pr, pi } = S;
    ar.fill(0);
    ai.fill(0);
    br_.fill(0);
    bi_.fill(0);
    cr.fill(0);
    ci.fill(0);
    for (let m = 0; m < NM; m++) {
      const p = mP[m], q = mQ[m], kx = mKX[m], kz = mKZ[m], ik2 = mIK2[m];
      const er = X.er[m], ei = X.ei[m], bR = X.br[m], bI = X.bi[m];
      const sr = -er * ik2, si = -ei * ik2; // psi
      const ur = -kz * si, ui = kz * sr, wr = kx * si, wi = -kx * sr; // u^ = i kz psi^, w^ = -i kx psi^
      ar[p] = ur - wi;
      ai[p] = ui + wr;
      ar[q] = ur + wi;
      ai[q] = -ui + wr;
      // eta_x, eta_z
      let xr = -kx * ei, xi = kx * er, zr = -kz * ei, zi = kz * er;
      br_[p] = xr - zi;
      bi_[p] = xi + zr;
      br_[q] = xr + zi;
      bi_[q] = -xi + zr;
      // b_x, b_z
      xr = -kx * bI;
      xi = kx * bR;
      zr = -kz * bI;
      zi = kz * bR;
      cr[p] = xr - zi;
      ci[p] = xi + zr;
      cr[q] = xr + zi;
      ci[q] = -xi + zr;
    }
    fftS(ar, ai, true);
    fftS(br_, bi_, true);
    fftS(cr, ci, true);
    let um = 0, wm = 0, uw = 0;
    for (let p = 0; p < NS_; p++) {
      const u = ar[p], w = ai[p];
      const au = u < 0 ? -u : u, aw = w < 0 ? -w : w;
      if (au > um) um = au;
      if (aw > wm) wm = aw;
      if (au + aw > uw) uw = au + aw;
      pr[p] = -(u * br_[p] + w * bi_[p]);
      pi[p] = -(u * cr[p] + w * ci[p]);
    }
    S.umax = um;
    S.wmax = wm;
    S.uw = uw;
    fftS(pr, pi, false);
    const s1 = 0.5 / NS_;
    for (let m = 0; m < NM; m++) {
      const p = mP[m], q = mQ[m], a = pr[p], b = pi[p], c = pr[q], d = pi[q];
      O.er[m] = s1 * (a + c);
      O.ei[m] = s1 * (b - d);
      O.br[m] = s1 * (b + d);
      O.bi[m] = -s1 * (a - c);
    }
  }
  addForcing(S, O);
}

// One step of the Adams-Bashforth integrating-factor scheme (Lawson), orders 1 and 2 at the start and after a change of step, then 3.
// The histories H1, H2 are kept already carried forward by the propagator, as Salt Fingers does.
function step(S, lin) {
  const O = S.Nn;
  advanceSources(S, DTL[S.lv]);
  evalN(S, O, lin);
  if (!lin) {
    const om = KMAX * S.uw;
    let l = S.lv;
    if (DTL[l] * om > CFL_DN) {
      while (l < DTL.length - 1 && DTL[l] * om > CFL_OK) l++;
      S.ord = 0;
      S.up = 0;
    } else if (l > 0 && DTL[l - 1] * om < CFL_UP) {
      if (++S.up > 40) (l--, (S.ord = 0), (S.up = 0));
    } else S.up = 0;
    S.lv = l;
  }
  const dt = DTL[S.lv], E = TABS[S.lv], { X, H1, H2 } = S;
  const c0 = S.ord === 0 ? 1 : S.ord === 1 ? 1.5 : 23 / 12, c1 = S.ord === 0 ? 0 : S.ord === 1 ? -0.5 : -16 / 12, c2 = S.ord >= 2 ? 5 / 12 : 0;
  for (let m = 0; m < NM; m++) {
    const t = mT[m] * 4, e11 = E[t], e22 = E[t + 1], f12 = E[t + 2], f21 = E[t + 3];
    const er = X.er[m] + dt * (c0 * O.er[m] + c1 * H1.er[m] + c2 * H2.er[m]);
    const ei = X.ei[m] + dt * (c0 * O.ei[m] + c1 * H1.ei[m] + c2 * H2.ei[m]);
    const br = X.br[m] + dt * (c0 * O.br[m] + c1 * H1.br[m] + c2 * H2.br[m]);
    const bi = X.bi[m] + dt * (c0 * O.bi[m] + c1 * H1.bi[m] + c2 * H2.bi[m]);
    // propagate: eta' = e11 eta + (-i f12) b,  b' = e22 b + (-i f21) eta
    X.er[m] = e11 * er + f12 * bi;
    X.ei[m] = e11 * ei - f12 * br;
    X.br[m] = e22 * br + f21 * ei;
    X.bi[m] = e22 * bi - f21 * er;
    // H2 <- E H1, H1 <- E N0
    let a = H1.er[m], b = H1.ei[m], c = H1.br[m], d = H1.bi[m];
    H2.er[m] = e11 * a + f12 * d;
    H2.ei[m] = e11 * b - f12 * c;
    H2.br[m] = e22 * c + f21 * b;
    H2.bi[m] = e22 * d - f21 * a;
    a = O.er[m];
    b = O.ei[m];
    c = O.br[m];
    d = O.bi[m];
    H1.er[m] = e11 * a + f12 * d;
    H1.ei[m] = e11 * b - f12 * c;
    H1.br[m] = e22 * c + f21 * b;
    H1.bi[m] = e22 * d - f21 * a;
  }
  if (S.ord < 2) S.ord++;
  S.t += dt;
  return dt;
}

// rms of b'_z (the share of the background stratification the waves undo, 1 would be a mixed patch everywhere)
function epsilon(S) {
  const { X } = S;
  let s = 0;
  for (let m = 0; m < NM; m++) s += mKZ[m] * mKZ[m] * (X.br[m] * X.br[m] + X.bi[m] * X.bi[m]);
  return sqrt(2 * s);
}
function energy(S) {
  const { X } = S;
  let ke = 0, pe = 0;
  for (let m = 0; m < NM; m++) {
    ke += (X.er[m] * X.er[m] + X.ei[m] * X.ei[m]) * mIK2[m];
    pe += X.br[m] * X.br[m] + X.bi[m] * X.bi[m];
  }
  return [ke, pe / (NBV * NBV)]; // sums over the half plane of |eta|^2 / k2 and |b|^2 / N^2, the kinetic and potential energy per unit area
}

// ---- knobs and the clock --------------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
function targets(S, k) {
  S.hue = cl(k[0], 0, 1);
  S.pace = cl(k[1], 0.5, 4);
  S.scT = pow(1.3, cl(k[2], -1.2, 1.2));
  S.sigT = SIG0 * pow(1.45, cl(k[2], -1.2, 1.2));
  const phi = ((52 - 24 * cl(k[3], -1.2, 1.2)) * PI) / 180; // beam angle from the vertical
  S.omT = cos(phi);
}
function follow(S, f) {
  S.om += (S.omT - S.om) * f;
  S.sig += (S.sigT - S.sig) * f;
  S.sc += (S.scT - S.sc) * f;
}
const EPS_TAU = 12, EPS_K = 0.015;
function thermostat(S, dt) {
  const e = epsilon(S);
  S.eps = e;
  S.epsS += (e - S.epsS) * min(1, dt / EPS_TAU);
  S.gA = cl(S.gA * exp(EPS_K * dt * log(EPS / max(1e-6, S.epsS))), 0.02, 40);
}

function advance(S, ft) {
  follow(S, 1 - exp(-ft / 0.6));
  S.acc += ft * TMS * S.pace;
  let n = 0;
  while (n < 10) {
    if (S.acc < DTL[S.lv]) break;
    const dt = step(S, false);
    S.acc -= dt;
    thermostat(S, dt);
    n++;
  }
  if (n === 10) S.acc = min(S.acc, 0.05);
  S.dirty = true;
  if (!isFinite(S.eps) || S.eps > 6) spin(S);
}

const LIN_T = 260, PRE_T = 10;
function spin(S) {
  for (const f of [S.X, S.Nn, S.H1, S.H2]) for (const key in f) f[key].fill(0);
  S.ord = 0;
  S.lv = 0;
  S.t = 0;
  S.acc = 0;
  S.gA = 1;
  // the linear response first: no transforms, big steps, the propagators carry the waves exactly
  while (S.t < LIN_T) step(S, true);
  const g = EPS / max(1e-9, epsilon(S));
  for (const key in S.X) {
    const a = S.X[key];
    for (let i = 0; i < NM; i++) a[i] *= g;
  }
  S.gA = g;
  S.epsS = EPS;
  S.eps = EPS;
  S.ord = 0;
  S.lv = 8;
  S.t = 0;
  while (S.t < PRE_T) {
    const dt = step(S, false);
    thermostat(S, dt);
  }
}

export function setup(params, knobValues) {
  const S = (params.s = makeState());
  S.strata = makeStrata();
  targets(S, knobValues || OPEN);
  S.om = S.omT;
  S.sig = S.sigT;
  S.sc = S.scT;
  spin(S);
  S.ready = true;
  return S;
}

export function update(dt, input, params) {
  const S = params.s || setup(params, input.knobValues);
  targets(S, input.knobValues || OPEN);
  advance(S, cl(dt || 0, 0, 0.1));
}

// ---- colour ----------------------------------------------------------------------------------------------------
// The colour of a pixel is a function of the height its water would have in the resting column, beta = z + b' / N^2: the isopycnal that
// passes through it. The function is a stack of random slabs, each with its own pair of colours, so the stripes carry the flow
// and never repeat.
const LUTN = 1312, LUT0 = -100, LUTR = 4;
function lin2(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const TMP = [0, 0, 0];
// colours of a slab, [lightness, chroma, hue in degrees, weight]
const PAL = [
  [0.27, 0.09, 280, 2],
  [0.35, 0.13, 262, 2],
  [0.24, 0.07, 308, 1],
  [0.5, 0.15, 258, 2],
  [0.62, 0.12, 233, 2],
  [0.72, 0.11, 198, 2],
  [0.58, 0.12, 170, 1],
  [0.93, 0.03, 215, 2],
  [0.9, 0.05, 92, 1],
  [0.72, 0.14, 25, 1],
  [0.55, 0.16, 358, 1],
];
// slabs come from a shuffled bag that holds each colour as many times as its weight, so that the stack uses all of them
let BAG = [];
function pick() {
  if (!BAG.length) {
    for (let i = 0; i < PAL.length; i++) for (let k = 0; k < PAL[i][3]; k++) BAG.push(i);
    for (let i = BAG.length - 1; i > 0; i--) {
      const j = floor(Math.random() * (i + 1)), t = BAG[i];
      BAG[i] = BAG[j];
      BAG[j] = t;
    }
  }
  return BAG.pop();
}
// two slabs that are close in lightness and in hue would read as one
const near = (a, b) => abs(a[0] - b[0]) < 0.16 && abs((((a[2] - b[2]) % 360) + 540) % 360 - 180) < 45;
// The lightness of the stack follows two slow swells (periods near 26 and 13 units), and each slab is the colour from the bag that is
// closest to the swell at its height. So a window of 16 rows always holds a light part and a dark one, and the water moving past it
// changes its mean light wherever the window is, which a stack drawn at random does not do.
function makeStrata() {
  const nodes = [];
  let u = LUT0 - 10, prev = -1;
  const P1 = 22 + 8 * Math.random(), P2 = 11 + 5 * Math.random(), f1 = Math.random() * TAU, f2 = Math.random() * TAU;
  BAG = [];
  while (u < LUT0 + LUTN / LUTR + 10) {
    const want = 0.58 + 0.2 * sin((TAU * u) / P1 + f1) + 0.12 * sin((TAU * u) / P2 + f2);
    let c = -1, best = 9;
    for (let t = 0; t < 7; t++) {
      const k = pick();
      const e = abs(PAL[k][0] - want) + 0.08 * Math.random() + (k === prev || (prev >= 0 && near(PAL[k], PAL[prev])) ? 1 : 0);
      if (e < best) (best = e), (c = k);
    }
    const w = 4 + 6 * pow(Math.random(), 1.4);
    nodes.push({ u, c, w, sharp: Math.random() < 0.3, line: Math.random() < 0.4, lam: 4 + 2 * Math.random(), ph: Math.random() * TAU });
    u += w;
    prev = c;
  }
  return nodes;
}
function buildLut(S) {
  const nodes = S.strata, lut = S.lut, hue = S.hue * 360, HC = [];
  for (const [L, C, h0] of PAL) {
    const hd = h0 + hue, h = (hd * PI) / 180;
    // a dark orange, olive or brown reads as mud on the panel: in that stretch of hues the lightness comes up and the chroma eases
    let dd = (((hd - 90) % 360) + 360) % 360;
    if (dd > 180) dd -= 360;
    const g = exp(-(dd * dd) / (2 * 45 * 45)), L2 = L + (0.88 - L) * g * (1 - sm(0.6, 0.88, L));
    let Cc = C * (1 - 0.4 * g);
    for (let it = 0; it < 8; it++) {
      lin2(L2, Cc * cos(h), Cc * sin(h), TMP);
      if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
      Cc *= 0.9;
    }
    HC.push([L2, Cc * cos(h), Cc * sin(h), 1 - 0.9 * g]); // the last is how far the light may darken this colour
  }
  let k = 0;
  for (let i = 0; i < LUTN; i++) {
    const uu = LUT0 + i / LUTR;
    while (k < nodes.length - 2 && nodes[k + 1].u <= uu) k++;
    const n0 = nodes[k], n1 = nodes[k + 1], t = (uu - n0.u) / n0.w, A = HC[n0.c], B = HC[n1.c];
    // a sharp slab keeps its colour and changes over its last 1.5 units, a soft one over the whole slab
    const x = n0.sharp ? sm(1 - 1.5 / n0.w, 1, t) : sm(0, 1, t);
    let L = A[0] + (B[0] - A[0]) * x;
    // fine lamination inside the slab, so that the water shows its motion where the colour is flat
    L += LAMP * sin((TAU * (uu - n0.u)) / n0.lam + n0.ph) * sm(0, 0.12, t) * (1 - sm(0.88, 1, t));
    // a thin pale line where a slab begins
    if (n0.line) L += (0.97 - L) * exp(-(t * n0.w * t * n0.w) / 1.6) * 0.7;
    lin2(L, A[1] + (B[1] - A[1]) * x, A[2] + (B[2] - A[2]) * x, TMP);
    lut[4 * i] = gam(TMP[0]);
    lut[4 * i + 1] = gam(TMP[1]);
    lut[4 * i + 2] = gam(TMP[2]);
    lut[4 * i + 3] = A[3] + (B[3] - A[3]) * x;
  }
  S.lutHue = S.hue;
}
const LAMP = 0.035;

// b' and b'_z on the panel's grid, one inverse transform with the two packed; the spectrum is padded with zeros up to the panel's size
function fields(S) {
  const { fr, fi, X, bR, bZ } = S;
  fr.fill(0);
  fi.fill(0);
  for (let m = 0; m < NM; m++) {
    const p = oP[m], q = oQ[m], kz = mKZ[m], br = X.br[m], bi = X.bi[m];
    // X^ = b^, Y^ = i kz b^ ; packed X + iY
    const yr = -kz * bi, yi = kz * br;
    fr[p] = br - yi;
    fi[p] = bi + yr;
    fr[q] = br + yi;
    fi[q] = -bi + yr;
  }
  fftO(fr, fi, true);
  for (let p = 0; p < NP; p++) {
    bR[p] = fr[p];
    bZ[p] = fi[p];
  }
}

// The colour is the isopycnal; the light on it is the synthetic schlieren of the experiments: brighter where the waves squeeze the layers
// together (b'_z above zero), darker where they pull them apart, so the phase fronts of the beams show as tilted light and dark bands
// across the dyed layers; and where the stratification is reversed the water goes pale, the foam of a breaking wave.
const SH = 0.55, FOAM = 0.45;
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.dirty) {
    S.dirty = false;
    fields(S);
  }
  if (S.lutHue !== S.hue) buildLut(S);
  const { bR, bZ, lut, sc } = S, isc = 1 / sc;
  for (let y = 0; y < LZ; y++) {
    const z = LZ - 1 - y;
    for (let x = 0; x < LX; x++) {
      const o = z * LX + x, bz = bZ[o], beta = z + bR[o];
      const f = ((beta - 64) * isc + 64 - LUT0) * LUTR, i0 = f | 0, t = f - i0, i = 4 * cl(i0, 0, LUTN - 2);
      const q = 1.3 * bz, g0 = (SH * q) / (1 + (q < 0 ? -q : q)), fo = FOAM * sm(0.15, -0.5, 1 + bz);
      const kd = lut[i + 3] + (lut[i + 7] - lut[i + 3]) * t, g = 1 + (g0 < 0 ? g0 * kd : g0);
      const r = (lut[i] + (lut[i + 4] - lut[i]) * t) * g, gg = (lut[i + 1] + (lut[i + 5] - lut[i + 1]) * t) * g, b = (lut[i + 2] + (lut[i + 6] - lut[i + 2]) * t) * g;
      display.setPixel(x, y, r + (255 - r) * fo, gg + (255 - gg) * fo, b + (255 - b) * fo);
    }
  }
}
