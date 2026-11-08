// ===== Patternflow pattern =====
// Title:   Active Nematic
// Family:  physics
// Idea:    A film of rod-like units that push the fluid themselves is solved as a Q-tensor field with Stokes flow on the panel's own 64 by 128 torus and drawn as the combed fibres of its director, blue where they run across the panel and orange where they run along it, so that bend walls fold and break into pairs of +1/2 and -1/2 defects, black points where the fibres wind through a half turn, which swim, collide and annihilate for ever with nobody stirring.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: active nematic turbulence, seen in suspensions of microtubule bundles driven by kinesin (Sanchez, Chen, DeCamp, Heymann and Dogic, Nature 2012) and modelled by Q-tensor hydrodynamics with an active stress -zeta Q in Stokes flow (Giomi, Bowick, Ma and Marchetti, PRL 2013; Thampi, Golestanian and Yeomans, PRL 2013; review by Doostmohammadi, Ignes-Mullol, Yeomans and Sagues, Nat. Commun. 2018), built on the Beris-Edwards equations (1994) and the active stress of Simha and Ramaswamy (2002), with fibres drawn by line integral convolution (Cabral and Leedom, 1993); every name, year and journal here is from memory
// Round:   116
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Order=2..6
//
// Knob 1: Hue. Adds the knob times 360 degrees to the hue of the ring that the director angle is read on, so one full turn comes back. At 0 a director running across the panel is blue (64, 115, 212), one running along it orange (254, 145, 64), and the two diagonals are magenta (188, 86, 162) for the fibres that run from top left to bottom right and a lighter pink (229, 123, 201) for the other. At 0.25 the across fibres are rose and the along ones green, at 0.5 amber and sky blue, at 0.75 teal and violet. Yellow and orange come up in lightness, so no hue goes brown or olive; before the fibre shading the darkest ring colour at any hue has a brightest channel of 131 and a luma of 88.
// Knob 2: Flow. The activity zeta, which is the clock: 0.5 units of the model's time eta / zeta pass per panel second per unit of Flow, so everything runs faster in proportion and nothing else changes. The rms speed of the fluid, measured over 500 s at Scale 0 and Order 2, is 0.85 LEDs a second at 0.5, 1.74 at 1, 3.37 at the opening 2 and 5.05 at 3; the speed taken each second ranged from 2.25 to 5.72 at Flow 2. The +1/2 defects swim on their own and go faster than the fluid, a net 4.7 LEDs a second at Flow 2 against 2.8 for the -1/2 defects.
// Knob 3: Scale. The active length ell = sqrt(K eta / zeta) = 1.25 times 1.3 to the Scale LEDs, 0.96 at -1, 1.25 at 0 and 1.63 at 1 (the Frank constant K = ell^2 changes, zeta does not). The aligned film is unstable to bend below the wavelength 2 pi ell sqrt(2 / (1 + lambda)), 6.5, 8.5 and 11.1 LEDs, which is 9.8, 7.5 and 5.8 of them across the 64 LEDs. Defects, counted as plaquettes of the 128 by 64 grid round which the director turns by half a turn, mean over 500 s at Order 2: 26.6 at -1 (12 to 42), 18.5 at 0 (6 to 32) and 12.5 at 1 (4 to 22), one for every 17.5, 21 and 25.6 LEDs of spacing; the +1/2 and -1/2 counts were equal at every one-second sample.
// Knob 4: Order. The rate a, in units of zeta / eta, at which the order |q| is driven back to its resting value 1/2, so the core radius xi = ell / sqrt(a) is 0.88 LEDs at Order 2 and 0.51 at 6 at Scale 0. At 2 the cores are soft: 4.4 LEDs on average lie under half the order within three LEDs of a defect, the bend walls between the blue, pink and orange domains are dark lines two or three LEDs wide and there are 18.5 defects. At 4 there are 24.3 and 2.0 LEDs, at 6 there are 29.9 and 1.2 LEDs, the walls are thinner and a core is a LED or less across. At Scale -1 and Order 6 there are 49.7 defects (28 to 68), at Scale 1 and Order 2 there are 12.5.

// What the field is. Q = [[q1, q2], [q2, -q1]] is the order tensor of a two-dimensional film. |q| = S / 2 with S the degree of order, the
// director n lies at the angle theta with 2 theta = atan2(q2, q1), and n and -n are the same, so a loop round a defect may turn
// it by half a turn, +1/2 or -1/2. The film lives on a torus 64 LEDs wide and 128 tall, one cell per LED, one LED the unit of
// length, in units of time where the activity zeta and the viscosity eta are both 1. With E the strain rate and omega the
// vorticity of the fluid velocity u,
//   (d/dt + u.grad) q = omega J q + lambda (E - 4 (q . E) q) + a (1 - 4 |q|^2) q + ell^2 laplacian q,
//   eta laplacian u - grad p = zeta div Q,   div u = 0.
// J turns the pair (q1, q2) through a right angle, so the first term turns the director with the fluid at half the vorticity.
// The second is the flow alignment of Beris and Edwards, lambda (E - 2 tr(QE) Q) written out in two dimensions (0.7 here, below
// the flow-aligning value 1 and so flow-tumbling; it settles cos 2 theta = 1 / lambda in a simple shear at |q| = 1/2, which this
// file does not test). The third is the Landau-de Gennes relaxation of the order and the fourth one-constant elasticity. The
// active stress is -zeta Q with zeta > 0, the extensile sign, which makes the aligned film unstable to bend. Solved in Fourier
// space the Stokes equation is a stream function, u = (psi_y, -psi_x) with psi_hat = -c_hat / k^4 and c_hat = (ky^2 - kx^2) q2_hat +
// 2 kx ky q1_hat, the curl of zeta div Q; the mean flow (k = 0) is zero. Nothing stirs the film from outside, there is no friction
// and no noise: the activity alone keeps it going. The picture's own choices are named where they come.
//
// What is left out. The passive stress of the elasticity (the Ericksen stress and the antisymmetric torque stress of the
// Beris-Edwards equations) is dropped, so the active stress alone drives u, and the viscosity is one number for the whole film.
// With it the active length would not be the only length that the elasticity sets; this file does not test what it would change.
//
// One step of h. Godunov splitting, first order in h: (1) the Stokes solve from the current q; (2) q carried by u through the
// foot of the characteristic with four-point Lagrange look-up, turned by omega h (a series of cos and sin to the sixth power) and
// aligned by an explicit step; (3) the order relaxed with the exact solution of d|q|^2/dt = 2 a |q|^2 (1 - 4 |q|^2); (4) the
// elastic term taken implicitly in Fourier space, q_hat / (1 + h ell^2 k^2), whose spectrum feeds the next Stokes solve. Three
// 64 by 128 transforms a step. A frame is one step of 0.5 Flow / 30 time units (0.033 at the opening, 0.05 at Flow 3) unless
// the largest |u| + |v| would carry a feature more than 0.7 LED, which asks for less and has not happened at any knob in the
// runs below. The first update runs the model from a random director field for 20 time units, about half a second, so the
// picture opens with its defects already made.
//
// Checks, each run on this file:
// 1. The growth rate of the first instability against theory. In an aligned film (director along x, a = 3, ell = 1.25) a
//    director wave of wavevector k at the angle phi to the director has, by linearising the equations above,
//    sigma = (zeta / 2 eta) (cos 2 phi + lambda cos^2 2 phi) - ell^2 k^2. Measured on the mode's amplitude over 2 to 8 time units
//    at h = 0.02 from a start 1e-5 rad deep, in units of 1 / tau:
//      lambda 0.7, bend waves (k along the director, m = 1 to 4 waves across 64 LEDs):
//        theory 0.835, 0.790, 0.715, 0.609; measured 0.827, 0.777, 0.696, 0.581
//      splay waves (k across the director, 1 and 2 waves along 128 LEDs): theory -0.154, -0.165; measured -0.154, -0.165
//      oblique waves (2 across, 3 along; 1 across, 4 along): theory 0.0733, -0.2493; measured 0.0721, -0.2489
//    and for lambda 0 and 1.4 the splay and oblique waves agree to 0.003 in sigma and the bend waves to 0.003 to 0.03 for one
//    to three waves across; the four-wave bend wave is the worst, low by 0.0145, 0.0279 and 0.0435 at lambda 0, 0.7 and 1.4
//    (0.9155 against 0.9590 at 1.4), 2.9, 3.3 and 3.6 percent of its active part. The gap grows as k squared along the
//    director and is what the central differences of u cost: one of them cuts a wave of k = 0.39 by 2.5 percent. This tests the
//    sign and size of the Stokes solve and of the rotation, the flow alignment and the elasticity.
// 2. The order relaxation: the closed form r (t) = r0 e^(2at) / (1 + 4 r0 (e^(2at) - 1)) against a fourth-order Runge-Kutta
//    run of 20000 steps, for four values of a, r0 and t: relative differences 1e-14 to 4e-16.
// 3. Convergence in h. From a developed film (50 time units) the film is run at fixed h against a run at h = 0.00625: the
//    rms difference of q over its rms is 2.0e-2, 9.5e-3 and 4.1e-3 at h = 0.1, 0.05 and 0.025 after half a time unit
//    (ratios 2.1 and 2.3) and 6.8e-2, 3.2e-2 and 1.4e-2 after two (2.1 and 2.3). That is first order. A single trajectory is not
//    what the picture needs, though, and the statistics do not move with h: over 500 s at Order 3 the mean number of defects was
//    22.6 at h = 0.067, 22.2 at 0.0167 and 21.4 at 0.00833, and 21.7, 22.2 and 23.1 for three random starts at the 0.033
//    that the opening uses, so the seed-to-seed spread of 1.4 covers the lot.
// 4. div u = 0 is exact: u and v both come from psi, so i kx u_hat + i ky v_hat vanishes mode by mode, and a transform of the
//    stored u and v gives a residual of 1.4e-14 of the rms of |k u_hat|. A central difference on the grid, which the
//    strain and the vorticity use, gives 4.9e-3 of the rms of |grad u|.
// 5. One length. If ell is the only length, the number of defects goes as 1 / ell^2. n ell^2 over the 8192 LEDs of the panel
//    is 0.0056, 0.0057 and 0.0062 for Scale -1, 0 and 1 at Order 6 (49.7, 29.9, 19.2 defects), and 0.0067, 0.0064 and 0.0067
//    at Order 8, beyond the knob, where the cores are far under a cell. At Order 2 it is 0.0030, 0.0035 and 0.0040: there the
//    core, ell / sqrt(2) = 0.68 to 1.15 LEDs, is not small against the grid and the count falls off slower than 1 / ell^2.
// 6. The defects are made and lost in pairs: the +1/2 and -1/2 counts are equal at every sample (the mean of their
//    difference is 0.00 over 900 s), as a torus requires, and they are made and lost all the time, 19.1 defects on
//    average at the opening over 900 s (6 to 36, 5 to 95 percent 12 to 28), with no drift in the mean: 8.7, 9.6, 9.8, 9.4,
//    8.8, 9.4, 9.3, 11.2 and 9.8 of each sign in nine blocks of 100 s. The film neither orders nor melts: the mean of |q| is
//    0.475 to 0.485 against the resting 0.5 at every corner of Scale and Order, so the order is whole but at the cores and walls.
// 7. A +1/2 defect swims and a -1/2 does not so much: tracked every 0.3 time units over 200, defects that lived at least
//    1.8 time units had net speeds (mean, median, 90th percentile) of 4.7, 5.0 and 6.5 LEDs per time unit for +1/2
//    (226 tracks, life 4.4 mean) and 2.8, 2.6 and 5.0 for -1/2 (153 tracks, life 9.7 mean) at Order 2. The fluid's
//    rms speed was 3.4. Most +1/2 tracks are short: a defect that moves more than 2.5 cells in 0.3 leaves the matching, or
//    flickers on the grid. The figures are for the ones that were followed, so the +1/2 speed is more likely low than high.
// Not checked: the flow-aligning angle in a shear against lambda; the lambda dependence of the defect count (0.7 is used
// throughout); a run at half or twice the resolution, and with the passive stress; the speed of a +1/2 defect against a
// published number; the flow's spectrum.
//
// What the picture adds to the equations, as choices of the picture. The colour is read from 2 theta on a ring of 512 colours
// in Oklab that lies in the sRGB cube: lightness 0.665 + 0.095 cos(2 theta) + 0.06 sin(2 theta), chroma 0.16, hue 338 + 76 cos(2 theta)
// degrees, so the ring runs from orange through magenta to blue and back through pink. The brightness is smoothstep(0.08, 0.4, |q|),
// which blacks out a core and darkens a wall where the order is down. The fibres are line integral convolution of one fixed
// sheet of white noise along the director: every LED follows the line through it 8 steps of 0.8 LEDs each way, the line
// continuing in the sense it had by n n^T d, sums the noise with falling weight 1 to 0.2, and the sum, scaled to unit
// variance over the frame, moves the brightness by 0.28 of that, between 0.3 and 1.25 times the base. The noise stays where
// it is while the director moves, so the fibres show the lines and not the flow that carries them.

const W = 64, H = 128, N = W * H;
const { floor, max, min, abs, sqrt, exp, log, pow, sin, cos, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const CFG = {
  ell0: 1.25, // active length at Scale 0, LEDs
  ellk: 1.3, // per unit of Scale
  lam: 0.7, // flow alignment
  ini: 1.5, // correlation length of the random start, LEDs
  hmax: 0.1, // longest step, model time
  umaxLED: 0.7, // longest move in a step, LEDs
  speed: 0.5, // model time per panel second per unit of Flow
};

// ---- Fourier transforms ---------------------------------------------------------------------
function table(n) {
  const rev = new Int32Array(n), wr = new Float64Array(n / 2), wi = new Float64Array(n / 2);
  let lg = 0;
  while (1 << lg < n) lg++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let k = 0; k < n / 2; k++) {
    wr[k] = cos((TAU * k) / n);
    wi[k] = -sin((TAU * k) / n);
  }
  return { n, rev, wr, wi };
}
const T64 = table(64), T128 = table(128);

function fft1(re, im, o, T) {
  const n = T.n, rev = T.rev, wr = T.wr, wi = T.wi;
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
    for (let s = 0; s < n; s += len) {
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const a = o + s + k, b = a + half;
        const c = wr[t], d = wi[t];
        const xr = re[b] * c - im[b] * d, xi = re[b] * d + im[b] * c;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

const CR = new Float64Array(H), CI = new Float64Array(H);
// forward (e^-i), unnormalised
function fft2(re, im) {
  for (let i = 0; i < H; i++) fft1(re, im, i * W, T64);
  for (let j = 0; j < W; j++) {
    for (let i = 0, p = j; i < H; i++, p += W) {
      CR[i] = re[p];
      CI[i] = im[p];
    }
    fft1(CR, CI, 0, T128);
    for (let i = 0, p = j; i < H; i++, p += W) {
      re[p] = CR[i];
      im[p] = CI[i];
    }
  }
}
// inverse, unnormalised (the arrays swapped)
function ifft2(re, im) {
  for (let i = 0; i < H; i++) fft1(im, re, i * W, T64);
  for (let j = 0; j < W; j++) {
    for (let i = 0, p = j; i < H; i++, p += W) {
      CR[i] = re[p];
      CI[i] = im[p];
    }
    fft1(CI, CR, 0, T128);
    for (let i = 0, p = j; i < H; i++, p += W) {
      re[p] = CR[i];
      im[p] = CI[i];
    }
  }
}

// ---- wavenumbers, per slot -------------------------------------------------------------------
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), MIR = new Int32Array(N);
const PSI = new Float64Array(N); // 1 / k^4 with the zero mode and the Nyquist lines off
for (let i = 0; i < H; i++)
  for (let j = 0; j < W; j++) {
    const p = i * W + j, m = j < 32 ? j : j - W, n = i < 64 ? i : i - H;
    KX[p] = (TAU * m) / W;
    KY[p] = (TAU * n) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    MIR[p] = ((H - i) % H) * W + ((W - j) % W);
    PSI[p] = (m === 0 && n === 0) || j === 32 || i === 64 ? 0 : 1 / (K2[p] * K2[p]);
  }

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- state -------------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];

function start(params, k) {
  const f = () => new Float64Array(N);
  const S = {
    q1: f(), q2: f(), n1: f(), n2: f(), // the order parameter, and the next one
    zr: f(), zi: f(), // spectrum of q1 + i q2
    ar: f(), ai: f(), // work
    u: f(), v: f(), // velocity
    om: f(), ex: f(), exy: f(), // vorticity and strain rate
    t: 0, urms: 1, umax: 1, ell: 1.25, lam: CFG.lam, a: 2, hue: 0, c: 1,
  };
  params.s = S;
  S.ell = ellOf(k[2]);
  S.a = cl(k[3], 2, 6);
  init(S);
  let model = 0;
  while (model < 20) {
    const h = stepSize(S);
    step(S, h);
    model += h;
  }
}

const ellOf = (s) => CFG.ell0 * pow(CFG.ellk, cl(s, -1, 1));

// A random director field: two smoothed noise fields (g1, g2), q = (g1, g2) / |g| / 2 so that
// the order is whole everywhere except at the zeros of g, where the defects start.
function init(S) {
  const { ar, ai, q1, q2, zr, zi } = S;
  const ell = S.ell;
  for (let ch = 0; ch < 2; ch++) {
    for (let p = 0; p < N; p++) {
      ar[p] = gauss();
      ai[p] = 0;
    }
    fft2(ar, ai);
    for (let p = 0; p < N; p++) {
      const r = K2[p] * CFG.ini * CFG.ini, g = exp(-0.5 * r);
      ar[p] *= g;
      ai[p] *= g;
    }
    ifft2(ar, ai);
    const dst = ch ? q2 : q1;
    for (let p = 0; p < N; p++) dst[p] = ar[p];
  }
  for (let p = 0; p < N; p++) {
    const g = sqrt(q1[p] * q1[p] + q2[p] * q2[p]) + 1e-9;
    q1[p] = (0.5 * q1[p]) / g;
    q2[p] = (0.5 * q2[p]) / g;
  }
  // spectrum
  for (let p = 0; p < N; p++) {
    zr[p] = q1[p];
    zi[p] = q2[p];
  }
  fft2(zr, zi);
}

function stepSize(S) {
  return min(CFG.hmax, CFG.umaxLED / max(S.umax, 1e-6));
}

// One step of h model time (the model time unit is eta / zeta).
function step(S, h) {
  const { q1, q2, n1, n2, zr, zi, ar, ai, u, v, om, ex, exy } = S;
  const ell = S.ell, lam = S.lam, Kc = ell * ell;
  // 1. Stokes: psi_hat = -c_hat / k^4, c_hat = (ky^2 - kx^2) Q2 + 2 kx ky Q1, with Q1, Q2 out of the packed spectrum.
  for (let p = 0; p < N; p++) {
    const m = MIR[p], ar_ = zr[p], ai_ = zi[p], br = zr[m], bi = -zi[m]; // Z(k), conj Z(-k)
    const q1r = 0.5 * (ar_ + br), q1i = 0.5 * (ai_ + bi);
    const q2r = 0.5 * (ai_ - bi), q2i = -0.5 * (ar_ - br); // (Z - conj Z(-k)) / 2i
    const kx = KX[p], ky = KY[p];
    const c = ky * ky - kx * kx, d = 2 * kx * ky, w = -PSI[p];
    const pr = w * (c * q2r + d * q1r), pi = w * (c * q2i + d * q1i);
    // u + i v = ifft( psi_hat (kx + i ky) )
    ar[p] = pr * kx - pi * ky;
    ai[p] = pr * ky + pi * kx;
  }
  ifft2(ar, ai);
  const sc = 1 / N;
  let um = 0, e2 = 0;
  for (let p = 0; p < N; p++) {
    const a = ar[p] * sc, b = ai[p] * sc;
    u[p] = a;
    v[p] = b;
    const s = abs(a) + abs(b);
    if (s > um) um = s;
    e2 += a * a + b * b;
  }
  S.umax = um;
  S.urms = sqrt(e2 / N);
  // 2. strain and vorticity by central differences (periodic)
  for (let y = 0; y < H; y++) {
    const yu = ((y + H - 1) % H) * W, yd = ((y + 1) % H) * W, y0 = y * W;
    for (let x = 0; x < W; x++) {
      const xl = (x + W - 1) & 63, xr = (x + 1) & 63, p = y0 + x;
      const ux = (u[y0 + xr] - u[y0 + xl]) * 0.5, vx = (v[y0 + xr] - v[y0 + xl]) * 0.5;
      const uy = (u[yd + x] - u[yu + x]) * 0.5, vy = (v[yd + x] - v[yu + x]) * 0.5;
      om[p] = vx - uy;
      ex[p] = 0.5 * (ux - vy);
      exy[p] = 0.5 * (uy + vx);
    }
  }
  // 3. advect (semi-Lagrangian, bilinear), rotate, flow-align, relax the magnitude
  const Eh = exp(2 * S.a * h);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let xd = x - u[p] * h, yd = y - v[p] * h;
      xd -= W * floor(xd / W);
      yd -= H * floor(yd / H);
      const x0 = floor(xd), y0 = floor(yd), fx = xd - x0, fy = yd - y0;
      // four-point Lagrange weights along each axis
      const ax = (fx + 1) * (fx - 1) * (fx - 2) * 0.5, bx = -(fx + 1) * fx * (fx - 2) * 0.5, cx = (fx + 1) * fx * (fx - 1) / 6, ox = -fx * (fx - 1) * (fx - 2) / 6;
      const ay = (fy + 1) * (fy - 1) * (fy - 2) * 0.5, by = -(fy + 1) * fy * (fy - 2) * 0.5, cy = (fy + 1) * fy * (fy - 1) / 6, oy = -fy * (fy - 1) * (fy - 2) / 6;
      const x1 = (x0 - 1) & 63, x2 = x0 & 63, x3 = (x0 + 1) & 63, x4 = (x0 + 2) & 63;
      const r1 = ((y0 - 1) & 127) * W, r2 = (y0 & 127) * W, r3 = ((y0 + 1) & 127) * W, r4 = ((y0 + 2) & 127) * W;
      let a = oy * (ox * q1[r1 + x1] + ax * q1[r1 + x2] + bx * q1[r1 + x3] + cx * q1[r1 + x4]) +
        ay * (ox * q1[r2 + x1] + ax * q1[r2 + x2] + bx * q1[r2 + x3] + cx * q1[r2 + x4]) +
        by * (ox * q1[r3 + x1] + ax * q1[r3 + x2] + bx * q1[r3 + x3] + cx * q1[r3 + x4]) +
        cy * (ox * q1[r4 + x1] + ax * q1[r4 + x2] + bx * q1[r4 + x3] + cx * q1[r4 + x4]);
      let b = oy * (ox * q2[r1 + x1] + ax * q2[r1 + x2] + bx * q2[r1 + x3] + cx * q2[r1 + x4]) +
        ay * (ox * q2[r2 + x1] + ax * q2[r2 + x2] + bx * q2[r2 + x3] + cx * q2[r2 + x4]) +
        by * (ox * q2[r3 + x1] + ax * q2[r3 + x2] + bx * q2[r3 + x3] + cx * q2[r3 + x4]) +
        cy * (ox * q2[r4 + x1] + ax * q2[r4 + x2] + bx * q2[r4 + x3] + cx * q2[r4 + x4]);
      // rotation with the fluid: (q1, q2) turns by omega h
      const ph = om[p] * h, c = 1 - ph * ph * 0.5 + ph * ph * ph * ph / 24, s = ph - (ph * ph * ph) / 6;
      const ra = c * a - s * b, rb = s * a + c * b;
      // flow alignment: dq = lam (E - 4 (q . E) q)
      const e1 = ex[p], e2_ = exy[p], qe = ra * e1 + rb * e2_;
      a = ra + h * lam * (e1 - 4 * qe * ra);
      b = rb + h * lam * (e2_ - 4 * qe * rb);
      // magnitude: exact solution of dr/dt = 2 a r (1 - 4 r), r = |q|^2
      const r = a * a + b * b, g = sqrt(Eh / (1 + 4 * r * (Eh - 1)));
      n1[p] = a * g;
      n2[p] = b * g;
    }
  }
  // 4. elastic relaxation, implicit in Fourier space; the spectrum stays for the next Stokes solve
  for (let p = 0; p < N; p++) {
    zr[p] = n1[p];
    zi[p] = n2[p];
  }
  fft2(zr, zi);
  for (let p = 0; p < N; p++) {
    const d = 1 / (1 + h * Kc * K2[p]);
    zr[p] *= d;
    zi[p] *= d;
    ar[p] = zr[p];
    ai[p] = zi[p];
  }
  ifft2(ar, ai);
  for (let p = 0; p < N; p++) {
    q1[p] = ar[p] * sc;
    q2[p] = ai[p] * sc;
  }
  S.t += h;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.5, 3);
  S.ell = ellOf(k[2]);
  S.a = cl(k[3], 2, 6);
  S.hue = k[0];
  const c = flow * CFG.speed, Ht = ft * c;
  S.c = c;
  let t = 0;
  while (t < Ht - 1e-9) {
    const h = min(stepSize(S), Ht - t);
    step(S, h);
    t += h;
  }
  if (!(S.urms < 1e3)) init(S);
}

// ---- the picture -------------------------------------------------------------------------------
// Fibre noise: white noise, one value per LED, fixed in space.
const PIC = {
  lk: 8, // fibre: steps each way
  lds: 0.8, // and their length, LEDs
  lamp: 0.28, // fibre contrast
};
const NZ = new Float32Array(N), LICB = new Float32Array(N);
for (let p = 0; p < N; p++) NZ[p] = Math.random();
const LUT = new Float64Array(512 * 3);
let lutHue = -1;

function oklab(L, a, b, out) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TMP = [0, 0, 0];

// The ring of colours the director angle is read on. The angle 2 theta runs once round it while
// the director turns half a turn. A horizontal director is blue, a vertical one orange, and the
// diagonals are two roses, a light and a dark one.
const PAL = { hc: 338, hd: 76, L0: 0.665, La: 0.095, Lb: 0.06, C0: 0.16 };
function buildLut(hue) {
  for (let i = 0; i < 512; i++) {
    const ph = (TAU * i) / 512;
    let hd = PAL.hc + PAL.hd * cos(ph) + hue * 360;
    hd -= 360 * floor(hd / 360);
    const h = (hd * PI) / 180;
    // yellow, olive and orange go brown or olive when dark: from 30 to 130 degrees of hue they come up in lightness
    const warm = sm(20, 60, hd) * sm(150, 110, hd);
    const L = max(PAL.L0 + PAL.La * cos(ph) + PAL.Lb * sin(ph), 0.5 + 0.22 * warm);
    let C = PAL.C0;
    for (let it = 0; it < 14; it++) {
      oklab(L, C * cos(h), C * sin(h), TMP);
      if (TMP[0] <= 1 && TMP[1] <= 1 && TMP[2] <= 1 && TMP[0] >= 0 && TMP[1] >= 0 && TMP[2] >= 0) break;
      C *= 0.92;
    }
    oklab(L, C * cos(h), C * sin(h), TMP);
    LUT[i * 3] = 255 * enc(cl(TMP[0], 0, 1));
    LUT[i * 3 + 1] = 255 * enc(cl(TMP[1], 0, 1));
    LUT[i * 3 + 2] = 255 * enc(cl(TMP[2], 0, 1));
  }
}

// Fibres: every LED sums the noise along the line of the director through it, followed LIC_K
// steps of LIC_DS LEDs each way with a falling weight (line integral convolution, Cabral and
// Leedom 1993). The next direction is n n^T d, which keeps the sense the line was going in
// although n and -n are the same director.
const LIC_K = PIC.lk, LIC_DS = PIC.lds, LIC_AMP = PIC.lamp;
const LW = [];
let lsum = 1;
for (let k = 1; k <= LIC_K; k++) {
  const w = 1 - (k - 1) / (LIC_K + 1);
  LW.push(w);
  lsum += 2 * w;
}

const UC = new Float32Array(N), US = new Float32Array(N), T2 = new Float32Array(N), MG = new Float32Array(N);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.hue, 0, 1);
  if (lutHue !== hue) {
    lutHue = hue;
    buildLut(hue);
  }
  const { q1, q2 } = S;
  // per LED: the magnitude, the angle 2 theta and the unit vector of the nematic tensor
  for (let p = 0; p < N; p++) {
    const a = q1[p], b = q2[p], m = sqrt(a * a + b * b);
    MG[p] = m;
    T2[p] = atan2(b, a);
    const r = 1 / (m + 1e-9);
    UC[p] = a * r;
    US[p] = b * r;
  }
  let m1 = 0, m2 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, t2 = T2[p], nx = cos(0.5 * t2), ny = sin(0.5 * t2);
      let acc = NZ[p];
      for (let dir = -1; dir <= 1; dir += 2) {
        let dx = dir * nx, dy = dir * ny, px = x, py = y;
        for (let k = 0; k < LIC_K; k++) {
          px += dx * LIC_DS;
          py += dy * LIC_DS;
          const fx0 = floor(px), fy0 = floor(py), fx = px - fx0, fy = py - fy0;
          const xa = fx0 & 63, xb = (fx0 + 1) & 63, ya = (fy0 & 127) * W, yb = ((fy0 + 1) & 127) * W;
          const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
          acc += LW[k] * (NZ[ya + xa] * w00 + NZ[ya + xb] * w10 + NZ[yb + xa] * w01 + NZ[yb + xb] * w11);
          const qa = UC[ya + xa] * w00 + UC[ya + xb] * w10 + UC[yb + xa] * w01 + UC[yb + xb] * w11;
          const qb = US[ya + xa] * w00 + US[ya + xb] * w10 + US[yb + xa] * w01 + US[yb + xb] * w11;
          const wx = dx * (1 + qa) + dy * qb, wy = dx * qb + dy * (1 - qa);
          const wl = sqrt(wx * wx + wy * wy);
          if (wl > 1e-6) {
            dx = wx / wl;
            dy = wy / wl;
          }
        }
      }
      acc /= lsum;
      LICB[p] = acc;
      m1 += acc;
      m2 += acc * acc;
    }
  m1 /= N;
  const sd = sqrt(max(m2 / N - m1 * m1, 1e-6));
  for (let p = 0; p < N; p++) {
    const lic = (LICB[p] - m1) / sd;
    const br = sm(0.08, 0.4, MG[p]) * cl(0.82 + LIC_AMP * lic, 0.3, 1.25);
    const i = ((((T2[p] + PI) * 512) / TAU) | 0) % 512;
    display.setPixel(p & 63, p >> 6, cl(LUT[i * 3] * br, 0, 255) | 0, cl(LUT[i * 3 + 1] * br, 0, 255) | 0, cl(LUT[i * 3 + 2] * br, 0, 255) | 0);
  }
}
