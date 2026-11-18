// ===== Patternflow pattern =====
// Title:   Branched Waves
// Family:  light
// Idea:    A plane wave runs down through a smooth random landscape that drifts and boils, and where it focuses it forks into gold veins that cross and sway, each vein drawn with the wave's own fringes, ripples running beside it and diamond lattices where two cross, on deep indigo.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: branched flow solved as a wave, the paraxial (Fresnel) equation i psi_y = -psi_xx / (2 k0) - k0 V psi marched down the panel by split-step Fourier (Fleck, Morris and Feit 1976, from memory), through the random landscape of branched flow of electrons (Topinka et al., Nature 2001; Kaplan 2002; Metz, Kaplan and Heller 2010; Eric Heller and colleagues, all names and years from memory), the wave version of the ray picture in Branched Flow
// Round:   123
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..6, Scale=-1..1, Wavelength=-1..1
//
// Knob 1: Hue. Turns every colour of the ramp round the grey axis by the knob times 360 degrees with luma held, and one turn comes back. At 0 the floor is indigo (22, 26, 108) and the light climbs through violet (58, 44, 164) and rose (196, 76, 120) to amber (252, 172, 52) and cream (255, 246, 214). At 0.25 the floor is dark green (0, 60, 12) and the veins run violet to white, at 0.5 the floor is olive (46, 42, 0) and the veins teal to pale blue, at 0.75 the floor is maroon (76, 9, 56) and the veins olive to lime.
// Knob 2: Flow. Model seconds per panel second, 0.25 times the knob: 0.125 at 0.5, 0.5 at the opening 2 and 1.5 at 6. Everything that moves is in model seconds: the landscape drifts at 0.6 LED a model second times 0.4 to 1.1, each of its waves forgets its amplitude with a time of 25 model seconds, and the plane waves at the top turn at 0.07 to 0.27 radians a model second. The veins lean on the landscape's gradient and the beam is hot, so they move several times faster than the landscape does. The picture is correlated with itself 0.73 half a second on, 0.57 a second on, 0.41 two seconds on, 0.26 four and 0.14 eight at the opening; at 0.5 it is 0.92, 0.83, 0.71, 0.55, 0.39 and at 6 it is 0.52, 0.35, 0.23, 0.12, 0.06.
// Knob 3: Scale. The correlation length of the landscape, xi = 24 LEDs times 1.4 to the knob: 17, 24 and 34 LEDs, a spectrum in a ring round 2 pi / xi, 0.37, 0.26 and 0.19 radians per LED, 0.6 wide in ln k, with 240, 217 and 187 of the 240 pooled waves carrying weight. The rms of V goes as xi to the 0.6, 0.074, 0.090 and 0.110, so the beam is heated to the same angle at every setting (rms 0.36, 0.33 and 0.29 radians at the top edge, 0.56, 0.60 and 0.59 at the bottom). A longer xi gives broader arcs: the autocorrelation of the light along x at a lag of 2 LEDs is 0.13, 0.20 and 0.28, along y at 8 rows 0.27, 0.29 and 0.32. The number of strong veins across a row hardly moves (2.5, 2.4 and 2.3 for a peak over 1.2 after a 2.5 LED blur).
// Knob 4: Wavelength. The carrier wavenumber k0, 3.4 radians per LED times 1.41 to the knob: 2.4, 3.4 (3.5 at the opening) and 4.8, a wavelength of 2.6, 1.8 and 1.3 LEDs. It changes only the wave side, since the rays of one landscape are the same at all three: the fringe where two waves meet at an angle a goes as 2 pi / (k0 a), so for 0.4 radians it is 6.5, 4.6 and 3.3 LEDs. The median gap between neighbouring bright maxima in a row (within 9 LEDs, rows 40 to 127, 20 landscapes) is 4 LEDs at all three, 3 to 6 between the quartiles, since the panel's own pitch cuts the short ones. Waves steeper than 0.7 of the grid's Nyquist angle are taken out, which is 1.8, 1.3 and 0.92 radians, and the share of light still there at the bottom row is 1.000, 0.973 (the opening) and 0.851.

// What the field is. The panel is a slice of a wave passing down through a medium of index 1 + V(x, y, t), y being the distance along the beam and x across it, in LEDs. The wave is psi(x, y), and
//   i psi_y = -psi_xx / (2 k0) - k0 V psi
// is the paraxial equation of a beam of wavenumber k0 in that index: the same physics as the rays of Branched Flow (a ray bends toward high V, x'' = V_x), solved as a wave. x wraps over the 64 LEDs, y runs from 50 rows above the panel to its bottom edge, and the picture
// is |psi|^2, the intensity, cell-averaged over each LED. Nothing is stored from frame to frame but the landscape: every frame marches the whole wave down through V as it is at that moment, so there is no spin-up, nothing that can blow up and nothing that fades.
// The light does not feel the landscape move; the landscape is a still for the few picoseconds the light takes to cross it.
//
// The march. 128 points across the 64 LEDs (half an LED apart) and a step of half an LED down, 356 steps a frame, Strang's form of the split step: the kinetic half is exp(-i kx^2 dy / (2 k0)) on the Fourier modes and the potential half is exp(i k0 V dy) at the middle of the step, one multiplication
// each, with a complex FFT of 128 points written out in the file between them. V along y is built, not stored: it is a sum of waves cos(kx x + ky y + phase), kx on the lattice of the box (a multiple of 2 pi / 64, so the field wraps), and each wave is a phasor that is turned by exp(i ky dy) a step.
// V is real, so two consecutive rows share one inverse FFT, one in its real and the other in its imaginary part. That is 890 FFTs of 128 points a frame, 2.6 ms for update and march, and 3.1 to 3.5 ms with the drawing in the Lab. The wave is a plane wave at the top, seven of them: q = 0, +-1, +-2, +-3 tilts
// (kx = 2 pi q / 64) with amplitudes 1, 0.14, 0.14, 0.10, 0.10, 0.06, 0.06 and phases turning at their own rates, so the top edge is a plane wave with a few slow broad stripes drifting through it. The mean intensity is 1 at every row (the split step is unitary).
//
// The landscape. A pool of 240 waves, |k| log-uniform from 0.1 to 1.4 radians per LED, directions uniform over a half plane, kx rounded to the lattice. The Scale knob picks a Gaussian in ln k, 0.6 wide, round 2 pi / xi, and weights the pool with it. Each wave has a complex amplitude that is an Ornstein-Uhlenbeck
// process of time 25 model seconds, started from its stationary distribution (so the opening is already the steady state), and a phase that turns at -w.k, with w the drift of 0.6 LED a model second times (0.75 + 0.25 sin + 0.1 sin), its direction wandering on two sines of 0.021 and 0.0077 radians a model second. The
// OU part is what keeps the landscape from being a translation: after any time it is a new Gaussian field of the same statistics. V is scaled every frame so that its rms is s, 0.09 at the opening (0.074 to 0.110 by Scale), with the weights and the amplitudes taken together, and it fades in over 14 rows (smoothstep) from the first row, 50 rows above the panel: switched on at once
// each wave leaves the beam a tilt of kx / ky that depends on where along the wave it started, and the beam breaks into straight columns instead of branches (Branched Flow met the same). The waves with small ky make long vertical columns, and taking them out takes out the force too, which goes as kx: the veins went slack and the columns stayed, so the directions stay isotropic.
//
// Colour. u = 1 - exp(-I / 2.4) on a five-stop ramp, indigo (22, 26, 108), violet, rose, amber and cream (255, 246, 214), at luma 34, 62, 117, 182 and 245. The darkest colour is 0.47 of the mean frame luma (73). The fringes are what the picture is made of, so the curve does not clip them: I of 2.4 is at 63 per cent and 6 at 92.
//
// The grid and what it takes out. The beam is hot: with the landscape 50 rows above the panel and s = 0.09 the rms angle of the light is 0.33 radians at the top row, 0.45 at row 40, 0.50 at 64 and 0.60 at 127 (k0 3.4), so the transverse wavenumber k0 theta reaches 2 radians per LED against the 3.1 a 64-point grid can hold. On 128 points, whose Nyquist
// is 6.3, the tail is gone, and what is left of it (waves steeper than 0.7 of the Nyquist, 4.4 radians per LED) is taken out at a rate 0.25 ((|kx| - 4.4) / 1.9)^2 per LED of y in the kinetic step, so that nothing wraps round the grid. The light this removes by the bottom row is 2.7 per cent of the mean at the opening, 1.8 and 4.1 per cent at Scale -1 and 1, none at Wavelength -1 and 15 per cent at Wavelength 1.
//
// What was checked, with this file's own functions, with copies of its functions that I wrote again with another FFT (any size) and another way of building V, and scripts of mine, not in the repo:
// 1. V = 0. One plane wave stays uniform: |I - 1| is 0 over the whole frame. The seven tilted waves alone, against the analytic sum of seven exp(i (kx x - kx^2 d / (2 k0))) over the distance d from the top, cell-averaged the same way: 6e-8 over the frame (the Float32 the file stores; 0.67 to 1.49 is the range of the free beating).
// 2. The split step is unitary. With the absorber off, the mean of |psi|^2 over a row is 1 to 5.1e-13 over all 128 rows in doubles (the file's own Float32 rows sum to 1 within 1.5e-8, at six settings of the knobs, 8 landscapes each). The file and the other solver agree to 2.6e-8 relative rms over the frame.
// 3. A single weak lens against the rays. V = a cos(kx x) with kx = 3 * 2 pi / 64, a = 0.00223 and no ky, through the same fade, a plane wave in. The ray version, dx/dy = p and dp/dy = V_x with J = dx/dx0 by the variational equation, puts the first caustic, a cusp on the axis, at y = 70.05. On the axis before it the wave's intensity should be 1/J, and it comes to it as k0 goes up
//    (the waves here are from my other solver, 256 points and 0.125 LED, point values; the file cell-averages, which takes 3 to 17 per cent off the sharp peak near the cusp). Rows 20, 40, 50, 60: rays 1.564, 2.475, 3.656, 7.265; wave at k0 = 19.2: 1.559, 2.363, 3.123, 4.259; at 76.8: 1.564, 2.495, 3.379, 6.167. Far from the caustic the wave is the ray density to 0.3 per cent at row 20 for k0 19 and to 0.0 for k0 77, and at row 40 to 4.5 and 0.8 per cent; near it the
//    ray density diverges and the wave's does not. The first peak of the brightest column in the panel comes after the ray caustic by 43, 29 and 19 rows at k0 = 9.6, 19.2 and 38.4, which falls as k0 to the -0.6 (a fold would be -2/3, a cusp -1/2).
// 4. Against a finer solution. 256 points and steps of 0.125 LED, relative rms of the intensity over the top, middle and bottom third of the panel, 3 landscapes each: the file 0.050, 0.067, 0.082 at the opening; 0.067, 0.088, 0.096 at Scale -1; 0.055, 0.061, 0.089 at Scale 1; 0.042, 0.057, 0.073 at Wavelength -1; 0.066, 0.073, 0.096 at 1. Steps of 1 LED: 0.096, 0.127, 0.158 at the opening. 64 points and 1 LED steps (one point to an LED): 0.21, 0.39, 0.51.
// 5. flowcheck, 240 s, six sets (opening; all minimum; all maximum; three random): recur 0.51 to 0.59, dim 0.86 to 0.95, quiet 0.53 to 0.65; the last quarter dim 0.77 to 0.83 and quiet 0.48 to 0.72; luma first to last quarter within 0.8 per cent. 900 s: opening recur 0.53, dim 0.96, quiet 0.61; all minimum 0.48, 0.90, 0.60; the last quarter dim 0.90 and 0.85, quiet 0.56 and 0.62. Cost: 3.1 to 3.5 ms a frame in Node.
//
// What failed first. 1. The first march was on 64 points, one to an LED, and the bottom third was two-LED confetti; item 4 above is the reason, the beam is hotter than the grid can hold. Doubling the points and averaging the two samples of each LED took the confetti out and left the fringes. 2. A spectrum 0.3 wide in ln k gave minutes of lace and minutes of three fat
// columns (the mean horizontal edge of the picture over 600 s: 0.69 +- 0.11, between 0.42 and 0.89); 0.6 wide gave 0.74 +- 0.08, between 0.59 and 0.90. 3. The landscape 26 rows above the panel (s 0.105) left the top quarter a single beam with no flow in it, and the last quarter's quiet came to 0.299 where 0.30 is the line; 50 rows and s 0.09 made it 0.48. With s 0.04 to 0.075 at xi 24 the picture was long vertical strands that branched in the
// last third only; 0.09 and more gives the crossing arms and the lattices. 4. The incoming tilted waves at 0.22 made big soft pink clouds across the top; 0.14 leaves a haze. 5. u = 1 - exp(-I / 1.6) put the veins' cores at white and lost the fringes inside them, and 4 or more lost everything but the brightest lines. 6. Normalising the rms of V every frame did not remove the calm minutes: they are the landscape's own weather, a few bumps over 64 LEDs.
//
// What was not checked: the paraxial equation is not the Helmholtz equation, and at 0.5 radians the phase it leaves out, k0 theta^4 / 24, is 0.009 radians per LED, 0.9 over a hundred rows, so the fringes at the bottom are those of the paraxial equation and not of a real wave; the beam's angle there is 0.60 radians rms. k0 is a number of the model, a wavelength of 1.8 LEDs, and
// does not stand for any real one; the landscape is a scalar index, and in the electron experiments it is a potential with a different dispersion. The absorber takes up to 15 per cent of the light at Wavelength 1. There is no check of the branching depth against the ray version in a random landscape, only against one lens. The Hue knob puts an olive floor at 0.5 and a maroon one at 0.75, as any dark colour of that hue is. Not run on a panel.

const W = 64, H = 128, NG = 128; // the wave lives on 128 points across the 64 LEDs, half an LED apart
const { max, sqrt, sin, cos, exp, log, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];
const DKX = TAU / W;

// ---- 128-point complex FFT, written out ----
const REV = new Uint8Array(NG), FC = new Float64Array(NG / 2), FS = new Float64Array(NG / 2);
for (let i = 0; i < NG; i++) {
  let r = 0;
  for (let b = 0; b < 7; b++) if (i & (1 << b)) r |= 1 << (6 - b);
  REV[i] = r;
}
for (let i = 0; i < NG / 2; i++) (FC[i] = cos((TAU * i) / NG)), (FS[i] = sin((TAU * i) / NG));
function fft(re, im, inv) {
  for (let i = 0; i < NG; i++) {
    const j = REV[i];
    if (j > i) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  const sg = inv ? 1 : -1;
  for (let len = 2; len <= NG; len <<= 1) {
    const half = len >> 1, step = NG / len;
    for (let i = 0; i < NG; i += len)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = FC[t], wi = sg * FS[t], a = i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}

// ---- wave pool ----
const NP = 240, KMIN = 0.1, KMAX = 1.4;

const CFG = {
  s: 0.09, // rms of V at Scale 0 (index minus 1)
  xi: 24, // correlation length at Scale 0, LEDs
  xf: 1.4, // Scale 1 multiplies it by this, -1 divides
  sx: 0.6, // V's rms goes as xi to this power
  k0: 3.4, // carrier wavenumber at Wavelength 0, radians per LED
  wf: 1.41, // Wavelength 1 multiplies it by this
  sk: 0.6, // width of the landscape's spectrum in ln k
  pad: 50, // rows of landscape above the panel
  taper: 14, // rows the landscape takes to fade in
  dy: 0.5, // step down the panel, LEDs
  ga: 0.25, // rate at the grid's edge at which unresolved waves are taken out, per LED
  i0: 2.4, // intensity that maps to 63 per cent of the ramp
  tc: 25, // correlation time of each wave's amplitude, model seconds
  drift: 0.6, // LEDs per model second
  rate: 0.25, // model seconds per panel second and per unit of Flow
};
const xiOf = (k) => CFG.xi * pow(CFG.xf, cl(k, -1, 1));
const strengthOf = (k) => CFG.s * pow(xiOf(k) / CFG.xi, CFG.sx);
const k0Of = (k) => CFG.k0 * pow(CFG.wf, cl(k, -1, 1));

// Waves steeper than 0.7 of the grid's Nyquist angle are not resolved by 128 points; they are taken out at a rate that grows as the square of the excess.
const KN = (PI * NG) / W, KC = 0.7 * KN;
const absorb = (kx) => (abs(kx) > KC ? CFG.ga * pow((abs(kx) - KC) / (KN - KC), 2) : 0);

function gauss() {
  let u = Math.random();
  if (u < 1e-12) u = 1e-12;
  return sqrt(-2 * log(u)) * cos(TAU * Math.random());
}

export function setup(params, knobs) {
  const k = knobs || OPEN;
  const S = {
    tau: 0,
    ks: TAU / xiOf(k[2]), ss: strengthOf(k[2]), k0: k0Of(k[3]),
    px: new Float64Array(NP), py: new Float64Array(NP), pk: new Float64Array(NP), pm: new Int16Array(NP),
    cr: new Float64Array(NP), ci: new Float64Array(NP), ph: new Float64Array(NP),
    act: new Int32Array(NP), amp: new Float64Array(NP), nact: 0,
    zr: new Float64Array(NP), zi: new Float64Array(NP), rr: new Float64Array(NP), ri: new Float64Array(NP),
    pr: new Float64Array(NG), pi: new Float64Array(NG), vr: new Float64Array(NG), vi: new Float64Array(NG),
    kin: new Float64Array(NG * 2), kk: -1, kdy: -1,
    I: new Float32Array(W * H),
    q: new Float64Array(8), qp: new Float64Array(8), qw: new Float64Array(8), ea: [1, 0.14, 0.14, 0.1, 0.1, 0.06, 0.06],
    lut: new Float32Array(1024 * 3), hue: -1, hueK: cl(k[0], 0, 1),
  };
  for (let j = 0; j < NP; j++) {
    const kk = KMIN * exp(Math.random() * log(KMAX / KMIN));
    let m = Math.round((kk * cos(Math.random() * PI)) / DKX);
    while (abs(m) * DKX > kk) m -= m > 0 ? 1 : -1;
    const kx = m * DKX, ky = sqrt(max(0, kk * kk - kx * kx));
    S.pm[j] = m;
    S.px[j] = kx;
    S.py[j] = ky;
    S.pk[j] = sqrt(kx * kx + ky * ky);
    S.cr[j] = gauss() * sqrt(0.5);
    S.ci[j] = gauss() * sqrt(0.5);
    S.ph[j] = Math.random() * TAU;
  }
  // incoming wave: tilted plane waves q = 0, +-1, +-2, +-3
  const qs = [0, 1, -1, 2, -2, 3, -3];
  for (let n = 0; n < 7; n++) {
    S.q[n] = qs[n];
    S.qp[n] = Math.random() * TAU;
    S.qw[n] = (0.07 + 0.2 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
  }
  params.s = S;
  select(S);
  march(S);
  return S;
}

function select(S) {
  let n = 0, e = 0;
  for (let j = 0; j < NP; j++) {
    const z = log(S.pk[j] / S.ks) / CFG.sk, w = exp(-0.5 * z * z);
    if (w < 0.06) continue;
    S.act[n] = j;
    S.amp[n] = w;
    e += w * w * (S.cr[j] * S.cr[j] + S.ci[j] * S.ci[j]);
    n++;
  }
  const g = (S.ss * sqrt(2)) / sqrt(e);
  for (let m = 0; m < n; m++) S.amp[m] *= g;
  S.nact = n;
}

// The field at the present moment: the wave marched from PAD rows above the panel to the bottom edge, steps of dy.
function march(S) {
  const { pr, pi, vr, vi, kin, I, zr, zi, rr, ri, act, amp } = S, nact = S.nact, k0 = S.k0, dy = CFG.dy;
  if (S.kk !== k0 || S.kdy !== dy) {
    S.kk = k0;
    S.kdy = dy;
    for (let m = 0; m < NG; m++) {
      const kx = (m < NG / 2 ? m : m - NG) * DKX, a = (-kx * kx * dy) / (2 * k0), d = absorb(kx) * dy, f = exp(-d) / NG; // the 1/NG of the inverse transform is folded in
      kin[2 * m] = cos(a) * f;
      kin[2 * m + 1] = sin(a) * f;
    }
  }
  // the incoming wave, normalised to a mean intensity of 1
  pr.fill(0);
  pi.fill(0);
  let e = 0;
  const ea = S.ea;
  for (let n = 0; n < 7; n++) e += ea[n] * ea[n];
  for (let n = 0; n < 7; n++) {
    const a = ea[n] / sqrt(e), ph = S.qp[n] + S.qw[n] * S.tau, b = (S.q[n] + NG) % NG;
    pr[b] += a * cos(ph);
    pi[b] += a * sin(ph);
  }
  fft(pr, pi, true);
  const PAD = CFG.pad, TAPER = CFG.taper, NSTEP = Math.round((PAD + H) / dy), y0 = -PAD;
  // the landscape's phasors at the middle of the first step
  for (let m = 0; m < nact; m++) {
    const j = act[m], a = amp[m], th = S.ph[j] + S.py[j] * (y0 + 0.5 * dy), c = cos(th), s = sin(th);
    zr[m] = a * (S.cr[j] * c - S.ci[j] * s);
    zi[m] = a * (S.cr[j] * s + S.ci[j] * c);
    rr[m] = cos(S.py[j] * dy);
    ri[m] = sin(S.py[j] * dy);
  }
  for (let r = 0; r < NSTEP; r++) {
    if ((r & 1) === 0) {
      // V along two consecutive steps at once: both rows are real, so one complex inverse FFT carries one in its real
      // and the other in its imaginary part
      vr.fill(0);
      vi.fill(0);
      for (let m = 0; m < nact; m++) {
        const b = (S.pm[act[m]] + NG) % NG, nb = (NG - b) % NG, hr = 0.5 * zr[m], hi = 0.5 * zi[m];
        vr[b] += hr;
        vi[b] += hi;
        vr[nb] += hr;
        vi[nb] -= hi;
        const t = zr[m] * rr[m] - zi[m] * ri[m];
        zi[m] = zr[m] * ri[m] + zi[m] * rr[m];
        zr[m] = t;
        const h2r = 0.5 * zr[m], h2i = 0.5 * zi[m];
        vr[b] -= h2i;
        vi[b] += h2r;
        vr[nb] += h2i;
        vi[nb] += h2r;
        const t2 = zr[m] * rr[m] - zi[m] * ri[m];
        zi[m] = zr[m] * ri[m] + zi[m] * rr[m];
        zr[m] = t2;
      }
      fft(vr, vi, true);
    }
    const V = (r & 1) === 0 ? vr : vi;
    const ym = y0 + (r + 0.5) * dy, u = cl((ym - y0) / TAPER, 0, 1), g = u * u * (3 - 2 * u);
    const kp = k0 * g * dy;
    for (let x = 0; x < NG; x++) {
      const a = kp * V[x], c = cos(a), s = sin(a), re = pr[x] * c - pi[x] * s, im = pr[x] * s + pi[x] * c;
      pr[x] = re;
      pi[x] = im;
    }
    fft(pr, pi, false);
    for (let m = 0; m < NG; m++) {
      const c = kin[2 * m], s = kin[2 * m + 1], re = pr[m] * c - pi[m] * s, im = pr[m] * s + pi[m] * c;
      pr[m] = re;
      pi[m] = im;
    }
    fft(pr, pi, true);
    const yend = y0 + (r + 1) * dy, row = Math.round(yend);
    if (row >= 0 && row < H && abs(yend - row) < 1e-9) {
      // each LED takes the light over its own half-LED either side: 1/4, 1/2, 1/4 of three samples
      const o = row * W;
      for (let x = 0; x < W; x++) {
        const c = 2 * x, a = (c + NG - 1) % NG, b = (c + 1) % NG;
        I[o + x] = 0.25 * (pr[a] * pr[a] + pi[a] * pi[a]) + 0.5 * (pr[c] * pr[c] + pi[c] * pi[c]) + 0.25 * (pr[b] * pr[b] + pi[b] * pi[b]);
      }
    }
  }
}

export function update(dt, input, params) {
  const k = (input && input.knobValues) || OPEN;
  if (!params.s) setup(params, k);
  const S = params.s;
  S.hueK = cl(k[0], 0, 1);
  const ft = cl(dt || 0, 0, 0.1), dtau = ft * cl(k[1], 0.1, 8) * CFG.rate;
  const aa = 1 - exp(-ft / 0.5);
  S.ks += (TAU / xiOf(k[2]) - S.ks) * aa;
  S.ss += (strengthOf(k[2]) - S.ss) * aa;
  S.k0 += (k0Of(k[3]) - S.k0) * aa;
  S.tau += dtau;
  const d = exp(-dtau / CFG.tc), sg = sqrt(1 - d * d) * sqrt(0.5);
  const t = S.tau, psi = 0.6 + 1.9 * sin(0.021 * t + 0.4) + 1.3 * sin(0.0077 * t + 1.1);
  const sp = CFG.drift * (0.75 + 0.25 * sin(0.0153 * t + 2.0) + 0.1 * sin(0.0271 * t)), wx = sp * cos(psi), wy = sp * sin(psi);
  for (let j = 0; j < NP; j++) {
    S.cr[j] = S.cr[j] * d + sg * gauss();
    S.ci[j] = S.ci[j] * d + sg * gauss();
    S.ph[j] -= (wx * S.px[j] + wy * S.py[j]) * dtau;
  }
  select(S);
  march(S);
}

// Indigo to gold. Every stop sits at a luma that climbs with the light, and the Hue knob turns (I, Q) of YIQ, so luma stays put.
const STOPS = [
  [0.0, 22, 26, 108],
  [0.3, 58, 44, 164],
  [0.55, 196, 76, 120],
  [0.78, 252, 172, 52],
  [1.0, 255, 246, 214],
];
function buildLut(S, hue) {
  S.hue = hue;
  const th = TAU * hue, ch = cos(th), sh = sin(th);
  for (let i = 0; i < 1024; i++) {
    const u = i / 1023;
    let a = 0;
    while (a < STOPS.length - 2 && u > STOPS[a + 1][0]) a++;
    const p = STOPS[a], q = STOPS[a + 1], f = cl((u - p[0]) / (q[0] - p[0]), 0, 1);
    const r = p[1] + (q[1] - p[1]) * f, g = p[2] + (q[2] - p[2]) * f, b = p[3] + (q[3] - p[3]) * f;
    const Y = 0.299 * r + 0.587 * g + 0.114 * b, I0 = 0.596 * r - 0.274 * g - 0.322 * b, Q0 = 0.211 * r - 0.523 * g + 0.312 * b;
    const I1 = I0 * ch - Q0 * sh, Q1 = I0 * sh + Q0 * ch;
    S.lut[i * 3] = cl(Y + 0.956 * I1 + 0.621 * Q1, 0, 255);
    S.lut[i * 3 + 1] = cl(Y - 0.272 * I1 - 0.647 * Q1, 0, 255);
    S.lut[i * 3 + 2] = cl(Y - 1.106 * I1 + 1.703 * Q1, 0, 255);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.hue !== S.hueK) buildLut(S, S.hueK);
  const { I, lut } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = 1 - exp(-I[y * W + x] / CFG.i0), o = ((u * 1023) | 0) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
}
