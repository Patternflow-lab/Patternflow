// ===== Patternflow pattern =====
// Title:   Current Sheets
// Family:  physics
// Idea:    Two-dimensional magnetohydrodynamics on the panel's own 64 by 128 torus, a stream function and a magnetic flux function stirred at one wavelength under a mean field along the long axis, drawn as the magnetic field lines themselves, one thin line wherever the flux crosses a level and a line every 6 LEDs at the mean field strength, coloured by the current density so that the thin sheets where anti-parallel lines are pressed together burn white, while Alfven waves run up and down the lines and the flow bends them into kinks and loops that never come back to the same picture.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Incompressible magnetohydrodynamics in two dimensions in the stream function and flux function form used for MHD turbulence (Dieter Biskamp and Hans Welter, 1989, from memory); Alfven waves (Hannes Alfven, 1942, from memory) and the picture of two Elsasser fields, u + b and u - b, which run along the mean field in opposite directions and are carried by each other (Walter Elsasser, 1950, from memory), which Roberto Iroshnikov (1963) and Robert Kraichnan (1965), both from memory, turned into a theory of the cascade; reconnecting current sheets (Peter Sweet, 1958, and Eugene Parker, 1957, from memory); pseudo-spectral integration with the two-thirds rule (Steven Orszag, 1971, from memory) and an integrating factor for the linear terms (J. Douglas Lawson, 1967, from memory)
// Round:   118
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3.5, Scale=-1..1, Field=-1..1
//
// Knob 1: Hue. Turns the current ramp round the colour wheel by the knob times 360 degrees, and one full turn comes back to where it began. The ramp is a curve in Oklab from indigo (lightness 0.34, hue 285 degrees) through blue and cyan to gold and then white (0.99), kept far enough inside the gamut that the panel's 1.62 saturation lift clips no channel. At 0 the field lines are blue and cyan and the sheets gold and white; at 0.25 the lines are rose, at 0.5 amber and at 0.75 green. The top of the ramp is white, so a sheet burns white at every setting.
// Knob 2: Flow. Model seconds per panel second. The plasma's rms speed is 1.42 LEDs per model second (measured over 900 s at the opening, with the same 1.48 for the field), which is 0.7 LEDs a second at 0.5, 2.8 at the opening 2 and 5.0 at 3.5. An Alfven wave at the opening Field runs 2.7 LEDs a second along the lines at Flow 2 and 4.8 at 3.5. Only the clock changes: forcing, mean field and dissipation are all per model second, so the picture at 3.5 is the one at 0.5 seen seven times faster. A frame is one step of the integrator up to Flow 2.7 and two above it.
// Knob 3: Scale. The wavelength the flow is stirred at, 24 LEDs times 1.7 to the Scale: 14.1 at -1, 24 at 0, 40.8 at 1. The lines tangle on that scale and the dissipation follows kf to the 0.9 power, so the cascade keeps its room. Measured at Field 0, the strongest current sheets are 2.16, 2.07 and 2.29 LEDs thick (full width at half height of |j|), the flux function has 17.6, 20.5 and 5.0 islands on average in the window, and u_rms is 1.29, 1.42 and 1.24 LEDs per model second. A change eases in over 0.5 s.
// Knob 4: Field. The mean field B0 along the long axis, 1.3 LEDs per model second times 2.4 to the Field: 0.54 at -1, 1.3 at 0 and 3.1 at 1, against a fluctuating b_rms of 1.4. At -1 the mean field is weaker than the fluctuation, the lines close into loops (73 extrema of the flux function in the window on average, sheets 1.87 LEDs thick) and the panel is a tangle; at 0 there are about 20 islands (sheets 2.07); at 1 there is none, the lines run the full height combed with kinks in them (sheets 2.73) and Alfven waves cross the panel in 21 s at Flow 2. The line spacing is 6 LEDs at the mean field strength at every setting, so Field changes how the lines tangle and not how many there are. A change eases in over 0.4 s.

// What the field is. Lengths are LEDs and time is model seconds. The velocity is u = z x grad psi and the magnetic field is B = B0 + b with b = z x grad a, on a torus 64 LEDs
// wide and 128 tall, so div u = 0 and div B = 0 for any fields at all. With the vorticity omega = lap psi and the current j = lap a,
//   d omega/dt = -u.grad omega + B.grad j + F - gamma omega,    d a/dt = -u.grad a + B0.grad psi - gamma a.
// The flux a is carried by the flow, B0.grad psi is the flow stretching the mean field into new flux, and B.grad j is the Lorentz force that bends the flow back; the field
// lines are the level lines of A = a + A0, where A0 is the flux of the uniform field. The mean field lies along the long axis and sways from it by alpha = 0.14 sin(0.0113 t) +
// 0.09 sin(0.0271 t) radians, a slow lean that keeps the lines at the sides of the panel moving as well as those in the middle. F is an Ornstein-Uhlenbeck force
// (correlation time 3) on the modes within a window 0.22 wide in ln k round the wavenumber of Scale, a different random complex amplitude on each of them, so it is solenoidal,
// stationary and has no preferred place. gamma is the same for omega and a, the viscosity nu = the resistivity eta = 0.1, a hyperviscosity 0.08 k^4 (both times (kf / 0.26)^0.9),
// and a friction 0.5 / (1 + (k / 0.08)^4) on the longest waves.
//
// Each step is a Lawson midpoint step: the damping and the Alfven rotation are exact, a 2 x 2 matrix for each mode (omega / k, k a) -> rotation by B0.k dt, so Alfven waves cost no
// accuracy, and only the stresses are second order. u and b come to the grid through two inverse transforms (two real fields in each), the curl of the Reynolds and Maxwell stresses and
// u x b come back through two forward ones, on the 64 by 128 grid, with every mode beyond the circle k = 2 pi / 3 dropped (the two-thirds rule), which leaves 2858 modes, and the
// conjugate symmetry of every field restored after each step. The line a pixel sits on comes from the flux and the field strength at that pixel alone: the distance to the nearest level
// is the flux difference over |B|, in LEDs, so every line is 1.6 LEDs wide on the panel, however steep the field.
//
// What was checked, with the file's own code:
// - Equations. The right-hand side at random fields (u_rms = b_rms = 1.5) against the Poisson brackets -[psi, omega] + [a, j] and -[psi, a] taken by differentiating each field
//   by itself on the grid: relative error 2.8e-15 and 5.1e-16.
// - Alfven waves. A plane wave of 1e-4 advances its phase by B0.k T to 1e-15 (relative) for z+ and z- in five modes, the tilt swaying as in the file, and decays as exp(-gamma T) to
//   four digits; the rotation is in the integrating factor, so that checks the signs and the wiring and not the stepping. The check with teeth is nonlinear. u = -b is an exact solution
//   of the full equations that moves rigidly at v_A = B0 along the field whatever its amplitude, because both stresses and u x b vanish on it. The code carries a random one with
//   u_rms = b_rms = 1.5 (a general state of that size has a nonlinear term 1.8 times the state) through 180 steps, 12 model s at B0 = 2, to within 2.6e-15 of a rigid shift, with the
//   nonlinear term at 1e-15 of the state. A Gaussian pulse 5 LEDs wide travels 39.959 LEDs in 20 model s at B0 = 2; the integral of B0 cos(alpha) over the run is 39.959.
// - Energy. With forcing, dissipation and friction off, from random fields with u_rms = b_rms = 1.5 (an unresolved cascade, harder than anything the panel shows), the largest
//   departure of E = (u^2 + b^2) / 2 over 30 model s is 1.6e-2 at the shipped step of 0.0667 (450 steps), 2.0e-3 at 0.0333 and 2.8e-4 at 0.0167 at B0 = 0, and 1.8e-2, 2.3e-3 and 3.2e-4 at
//   B0 = 1.3: an eight-fold fall a halving. The cross helicity <u.b> is held to 1.1e-3 of E at 0.0667 at B0 = 0 and to 2.6e-4 at B0 = 1.3.
// - div B. B is z x grad a, so its divergence is kx ky a - kx ky a in every mode; on the grid at a random a the largest |div b| is 1.3e-16 against |b| up to 3.8 per LED.
// - Time step. Over 400 model s at three settings of Scale and Field the scheme ran stable at steps of 0.1 and blew up at 0.115 in one of them (after 231 s); the file never takes more than 0.09.
// - Stationarity. Over 900 panel seconds, the mean of E_kinetic = <u^2> / 2 and E_magnetic = <b^2> / 2 in the first and last quarter: at the opening 0.994 and 0.981 (-1.3 per cent),
//   1.076 and 1.107 (+2.9); with every knob at its minimum 1.088 and 1.139 (+4.8), 0.678 and 0.707 (+4.3); at its maximum 0.563 and 0.528 (-6.2), 0.586 and 0.556 (-5.3). The state never
//   left the guard in update (E_kinetic + E_magnetic under 40) in any run.
// - Sheets. Full width at half height of |j| across the strongest sheets (maxima of |j| above 2.5 j_rms, the narrowest of eight cuts), median over 100 s at the opening settings: 2.07 LEDs
//   on this grid, 1.91 on one twice as fine in both directions (a 128 by 256 copy, steps of 0.03, same nu), j_rms 0.712 against 0.730. With nu and nu4 times 0.5 and times 2 on this grid
//   it is 1.82 and 2.55, about nu^0.25. The Lundquist number at the opening, v_A L / eta for a sheet 40 LEDs long, is about 500 (a few hundred with the hyperviscosity counted), far below
//   the 10^4 or so where tearing makes plasmoids (Loureiro et al., 2007, from memory), so the islands here are loops the flow closes and not tearing.
// - Condensation. The mean square of the flux, <a^2>, cascades to long waves in two dimensions. With the friction off and Field at -1, the share of <a^2> below k = 0.12 climbs from 0.04
//   to 0.67 within 190 model s and stays between 0.5 and 0.8, the flux gathered into the largest islands the torus holds; with it on the share stays between 0.01 and 0.06 at the opening
//   (0.02 at the minimum corner) over 900 s, and reaches 0.21 once at the maximum corner, where only a few modes are stirred.
// - Staying alive. The field is forced, and the flux is fed by B0.grad psi, so neither can die while B0 is above zero: with every mode set to zero at the opening, u_rms is 0.26 after 1 panel s,
//   0.92 after 5 and 1.4 after 10, b_rms 0.93 after 5; at Field -1 u_rms is 1.6 after 5 s and b_rms 1.35 after 10.
// - Frame cost in Node is 3.2 ms at the opening, 3.7 at the minimum corner and 5.7 at the maximum, where Flow 3.5 takes two steps a frame; the first frame takes 0.3 s, for the 100 steps run before it.

const W = 64, H = 128;
const NX = 64, NY = 128, N = NX * NY, LX = 64, LY = 128, DX = LX / NX;
const { floor, sqrt, sin, cos, exp, log, min, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- radix-2 FFT ----------------------------------------------------------------------------
// The forward transform is e^(-i k x); the inverse flips the sign and leaves the 1/n to the caller. Only the columns with |n_x| <= 21 hold modes
// inside the circle of k kept, so the 2-D transform runs its column pass on those 43 of 64 and its row pass on all 128 rows.
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), tc = new Float64Array(n), ts = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let h = 1; h < n; h <<= 1)
    for (let k = 0; k < h; k++) (tc[h + k] = cos((PI * k) / h)), (ts[h + k] = -sin((PI * k) / h));
  return { n, rev, tc, ts };
}
const PX = plan(NX), PY = plan(NY);
const TR = new Float64Array(NY), TI = new Float64Array(NY), SR = new Float64Array(NX), SI = new Float64Array(NX);
const COLS = [];
for (let x = 0; x < NX; x++) if (abs(x < NX / 2 ? x : x - NX) <= floor(TAU / 3 / DX / (TAU / LX))) COLS.push(x);

// In place on re[o .. o+n), im[o .. o+n), which are already in bit-reversed order; sg is -1 for the forward transform and +1 for the inverse.
function butterflies(p, re, im, sg) {
  const { n, tc, ts } = p;
  for (let i = 0; i < n; i += 4) {
    const r0 = re[i], i0 = im[i], r1 = re[i + 1], i1 = im[i + 1], r2 = re[i + 2], i2 = im[i + 2], r3 = re[i + 3], i3 = im[i + 3];
    const ar = r0 + r1, ai = i0 + i1, br = r0 - r1, bi = i0 - i1, cr = r2 + r3, ci = i2 + i3, dr = r2 - r3, di = i2 - i3;
    const er = -sg * di, ei = sg * dr;
    re[i] = ar + cr;
    im[i] = ai + ci;
    re[i + 2] = ar - cr;
    im[i + 2] = ai - ci;
    re[i + 1] = br + er;
    im[i + 1] = bi + ei;
    re[i + 3] = br - er;
    im[i + 3] = bi - ei;
  }
  for (let h = 4; h < n; h <<= 1)
    for (let i = 0; i < n; i += h << 1)
      for (let k = 0; k < h; k++) {
        const wr = tc[h + k], wi = -sg * ts[h + k], a = i + k, b = a + h;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
}
function rowFFT(re, im, y, sg) {
  const o = y * NX, rev = PX.rev;
  for (let i = 0; i < NX; i++) (SR[i] = re[o + rev[i]]), (SI[i] = im[o + rev[i]]);
  butterflies(PX, SR, SI, sg);
  for (let i = 0; i < NX; i++) (re[o + i] = SR[i]), (im[o + i] = SI[i]);
}
function colFFT(re, im, x, sg) {
  const rev = PY.rev;
  for (let y = 0; y < NY; y++) (TR[y] = re[rev[y] * NX + x]), (TI[y] = im[rev[y] * NX + x]);
  butterflies(PY, TR, TI, sg);
  for (let y = 0; y < NY; y++) (re[y * NX + x] = TR[y]), (im[y * NX + x] = TI[y]);
}
// Forward or inverse, in place. After a forward transform only the kept columns are meaningful; an inverse transform expects zero in the others.
function fft2(re, im, inv) {
  const sg = inv ? 1 : -1;
  if (inv) {
    for (const x of COLS) colFFT(re, im, x, sg);
    for (let y = 0; y < NY; y++) rowFFT(re, im, y, sg);
  } else {
    for (let y = 0; y < NY; y++) rowFFT(re, im, y, sg);
    for (const x of COLS) colFFT(re, im, x, sg);
  }
}

// ---- the plasma -----------------------------------------------------------------------------
const KC = TAU / 3 / DX; // radius of the circle of k kept: the two-thirds rule
const NU = 0.1; // viscosity = resistivity, LED^2 per model second
const NU4 = 0.08; // hyperviscosity, LED^4 per model second
const DEXP = 0.9; // the dissipation follows the forced wavenumber as kf to this power, so the cascade keeps its room
const MU0 = 0.5; // friction on the longest waves, per model second
const KMU = 0.08; // and the k where it has fallen to a half
const DTMAX = 0.09; // longest step, model seconds
const KFMAX = 0.8; // forced modes live below this k
const TAUF = 3; // forcing correlation time, model seconds
const FA = 0.05; // forcing strength at kf = 0.26
const FEXP = -0.35; // and how it follows kf, so that u_rms stays near 1.4 at every Scale
const B0REF = 1.3, B0RANGE = 2.4; // mean field at Field 0, and its factor per unit of Field
const L0 = 24, LRANGE = 1.7; // forced wavelength at Scale 0, LEDs, and its factor per unit of Scale
const SPACING = 6; // line spacing at the mean field strength, LEDs
const OPEN = [0, 2, 0, 0.06];

// The modes kept, 2858 of 8192, in a compact list; MIDX is each one's place in the transform arrays, MJ its mirror's place in the list.
const KX = new Float64Array(NX), KY = new Float64Array(NY);
for (let x = 0; x < NX; x++) KX[x] = (TAU * (x < NX / 2 ? x : x - NX)) / LX;
for (let y = 0; y < NY; y++) KY[y] = (TAU * (y < NY / 2 ? y : y - NY)) / LY;
const ML = [];
for (let y = 0; y < NY; y++)
  for (let x = 0; x < NX; x++) {
    const k2 = KX[x] * KX[x] + KY[y] * KY[y];
    if (k2 > 0 && k2 < KC * KC) ML.push(y * NX + x);
  }
const NM = ML.length, MIDX = Int32Array.from(ML), MMIR = new Int32Array(NM), MJ = new Int32Array(NM);
const KXc = new Float64Array(NM), KYc = new Float64Array(NM), K2c = new Float64Array(NM), IK2c = new Float64Array(NM);
{
  const at = new Int32Array(N).fill(-1);
  for (let j = 0; j < NM; j++) at[MIDX[j]] = j;
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], x = p % NX, y = (p - x) / NX;
    KXc[j] = KX[x];
    KYc[j] = KY[y];
    K2c[j] = KX[x] * KX[x] + KY[y] * KY[y];
    IK2c[j] = 1 / K2c[j];
    MMIR[j] = ((NY - y) % NY) * NX + ((NX - x) % NX);
    MJ[j] = at[MMIR[j]];
  }
}
// the modes that stand for a pair, and the forced ones: half plane, |k| < KFMAX
const HJ = [], FJ = [];
for (let j = 0; j < NM; j++) {
  if (MJ[j] > j) HJ.push(j);
  if (K2c[j] < KFMAX * KFMAX && (KYc[j] > 0 || (KYc[j] === 0 && KXc[j] > 0))) FJ.push(j);
}
const NH = HJ.length, NF = FJ.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function setup(params) {
  const f = () => new Float64Array(N), m = () => new Float64Array(NM);
  const S = {
    t: 0, acc: 0, warm: false, hue: 0, ft: 0.033, js: 0.5, bm: 2, drawn: false, jb: new Float32Array(N), ramp: new Float32Array(64 * 3), lutHue: -1,
    kf: 0.26, kft: 0.26, b0: B0REF, b0t: B0REF, fa: FA, alpha: 0, dtq: 0, kdt: -1, kdd: 1, resets: 0,
    wr: m(), wi: m(), ar: m(), ai: m(),
    xwr: m(), xwi: m(), xar: m(), xai: m(),
    n1wr: m(), n1wi: m(), n1ar: m(), n1ai: m(),
    n2wr: m(), n2wi: m(), n2ar: m(), n2ai: m(),
    c1r: f(), c1i: f(), c2r: f(), c2i: f(), fr: f(), fi: f(), er: f(), ei: f(),
    dec: m(), ch: m(), sh: m(),
    zr: new Float64Array(NF), zi: new Float64Array(NF), fwr: new Float64Array(NF), fwi: new Float64Array(NF),
    xc: new Float64Array(NX), xs: new Float64Array(NX), yc: new Float64Array(NY), ys: new Float64Array(NY),
    ph: [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU, Math.random() * TAU],
  };
  for (let i = 0; i < NF; i++) (S.zr[i] = gauss() * sqrt(0.5)), (S.zi[i] = gauss() * sqrt(0.5));
  params.s = S;
  return S;
}

// Enforce a(-k) = conj a(k) on one complex field.
function sym(re, im) {
  for (let i = 0; i < NH; i++) {
    const j = HJ[i], m = MJ[j], a = 0.5 * (re[j] + re[m]), b = 0.5 * (im[j] - im[m]);
    re[j] = a;
    im[j] = b;
    re[m] = a;
    im[m] = -b;
  }
}

// The nonlinear terms. With u = z x grad psi, b = z x grad a, omega = lap psi and j = lap a (so div u = div b = 0),
//   d omega/dt = -(u.grad)omega + (b.grad)j = -[(dyy - dxx)(u_x u_y - b_x b_y) - dxy((u_y^2 - u_x^2) - (b_y^2 - b_x^2))]    (the curl of the Reynolds and Maxwell stresses)
//   d a/dt     = -u.grad a = u_y b_x - u_x b_y.
// The uniform field B0 is not in here; it is in the linear part. Two inverse transforms bring u and b to the grid, two real fields in each, and two forward
// transforms take the products back. All fields are sums, not means: a field on the grid is its transform divided by N.
function rhs(S, wr, wi, ar, ai, nwr, nwi, nar, nai) {
  const { c1r, c1i, c2r, c2i, fr, fi, er, ei } = S, sc = 1 / N;
  c1r.fill(0);
  c1i.fill(0);
  c2r.fill(0);
  c2i.fill(0);
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], kx = KXc[j], ky = KYc[j], ik = IK2c[j] * sc;
    // u_x^ + i u_y^ = (kx + i ky) w^ / k^2, b_x^ + i b_y^ = -(kx + i ky) a^
    c1r[p] = ik * (kx * wr[j] - ky * wi[j]);
    c1i[p] = ik * (kx * wi[j] + ky * wr[j]);
    c2r[p] = -sc * (kx * ar[j] - ky * ai[j]);
    c2i[p] = -sc * (kx * ai[j] + ky * ar[j]);
  }
  fft2(c1r, c1i, true);
  fft2(c2r, c2i, true);
  for (let p = 0; p < N; p++) {
    const ux = c1r[p], uy = c1i[p], bx = c2r[p], by = c2i[p];
    fr[p] = ux * uy - bx * by;
    fi[p] = uy * uy - ux * ux - (by * by - bx * bx);
    er[p] = uy * bx - ux * by;
    ei[p] = 0;
  }
  fft2(fr, fi, false);
  fft2(er, ei, false);
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], m = MMIR[j], kx = KXc[j], ky = KYc[j];
    // P^ = (F(k) + conj F(-k)) / 2, Q^ = (F(k) - conj F(-k)) / 2i
    const pr = 0.5 * (fr[p] + fr[m]), pi = 0.5 * (fi[p] - fi[m]);
    const qr = 0.5 * (fi[p] + fi[m]), qi = -0.5 * (fr[p] - fr[m]);
    const a = ky * ky - kx * kx, b = kx * ky;
    nwr[j] = -(a * pr - b * qr);
    nwi[j] = -(a * pi - b * qi);
    nar[j] = 0.5 * (er[p] + er[m]);
    nai[j] = 0.5 * (ei[p] - ei[m]);
  }
}

// exp(L dt/2) on (w, a): the damping and the Alfven rotation by theta = (B0 . k) dt/2, which for the pair p = w/k, q = k a is
// d/dt (p, q) = (-i Omega q, -i Omega p) - gamma (p, q) with Omega = B0 . k.
function lin(S, ow_r, ow_i, oa_r, oa_i, wr, wi, ar, ai) {
  const { ch, sh } = S;
  for (let j = 0; j < NM; j++) {
    const c = ch[j], s = sh[j], k2 = K2c[j], ik2 = IK2c[j];
    const w0 = wr[j], w1 = wi[j], a0 = ar[j], a1 = ai[j];
    ow_r[j] = c * w0 + s * k2 * a1;
    ow_i[j] = c * w1 - s * k2 * a0;
    oa_r[j] = c * a0 + s * ik2 * w1;
    oa_i[j] = c * a1 - s * ik2 * w0;
  }
}

function constants(S, dt) {
  const dth = 0.5 * dt, bx = S.b0 * sin(S.alpha), by = S.b0 * cos(S.alpha), dd = pow(S.kf / 0.26, DEXP);
  if (dt !== S.kdt || abs(dd / S.kdd - 1) > 0.003) {
    S.kdt = dt;
    S.kdd = dd;
    for (let j = 0; j < NM; j++) {
      const k2 = K2c[j], k = sqrt(k2);
      S.dec[j] = exp(-(dd * (NU * k2 + NU4 * k2 * k2) + MU0 / (1 + (k / KMU) ** 4)) * dth);
    }
  }
  const { xc, xs, yc, ys } = S;
  for (let x = 0; x < NX; x++) (xc[x] = cos(bx * KX[x] * dth)), (xs[x] = sin(bx * KX[x] * dth));
  for (let y = 0; y < NY; y++) (yc[y] = cos(by * KY[y] * dth)), (ys[y] = sin(by * KY[y] * dth));
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], x = p % NX, y = (p - x) / NX;
    const c = xc[x] * yc[y] - xs[x] * ys[y], s = xs[x] * yc[y] + xc[x] * ys[y];
    S.ch[j] = S.dec[j] * c;
    S.sh[j] = S.dec[j] * s;
  }
}

// Ornstein-Uhlenbeck forcing of the vorticity on the long modes, through a window of width 0.22 in ln k round kf.
function forcing(S, dt) {
  const r = exp(-dt / TAUF), q = sqrt(1 - r * r), kf = S.kf, { zr, zi, fwr, fwi } = S;
  for (let i = 0; i < NF; i++) {
    zr[i] = zr[i] * r + q * gauss() * sqrt(0.5);
    zi[i] = zi[i] * r + q * gauss() * sqrt(0.5);
    const j = FJ[i], k = sqrt(K2c[j]), l = log(k / kf), w = S.fa * pow(kf / 0.26, FEXP) * N * k * exp(-0.5 * (l / 0.22) ** 2);
    fwr[i] = w * zr[i];
    fwi[i] = w * zi[i];
  }
}
function addForce(S, nwr, nwi) {
  const { fwr, fwi } = S;
  for (let i = 0; i < NF; i++) {
    const j = FJ[i], m = MJ[j];
    nwr[j] += fwr[i];
    nwi[j] += fwi[i];
    nwr[m] += fwr[i];
    nwi[m] -= fwi[i];
  }
}

// One step of dt model seconds: Lawson midpoint, the damping and the Alfven rotation exact, the rest second order.
function step(S, dt) {
  S.alpha = ALPHA[0] * sin(ALPHA[1] * S.t + S.ph[0]) + ALPHA[2] * sin(ALPHA[3] * S.t + S.ph[1]);
  constants(S, dt);
  forcing(S, dt);
  const { wr, wi, ar, ai, xwr, xwi, xar, xai, n1wr, n1wi, n1ar, n1ai, n2wr, n2wi, n2ar, n2ai } = S;
  rhs(S, wr, wi, ar, ai, n1wr, n1wi, n1ar, n1ai);
  addForce(S, n1wr, n1wi);
  // w = E v (kept in n1's place later), then x = w + dt/2 E N1
  lin(S, xwr, xwi, xar, xai, wr, wi, ar, ai);
  lin(S, n2wr, n2wi, n2ar, n2ai, n1wr, n1wi, n1ar, n1ai);
  for (let j = 0; j < NM; j++) {
    n1wr[j] = xwr[j];
    n1wi[j] = xwi[j];
    n1ar[j] = xar[j];
    n1ai[j] = xai[j];
    xwr[j] += 0.5 * dt * n2wr[j];
    xwi[j] += 0.5 * dt * n2wi[j];
    xar[j] += 0.5 * dt * n2ar[j];
    xai[j] += 0.5 * dt * n2ai[j];
  }
  rhs(S, xwr, xwi, xar, xai, n2wr, n2wi, n2ar, n2ai);
  addForce(S, n2wr, n2wi);
  for (let j = 0; j < NM; j++) {
    n1wr[j] += dt * n2wr[j];
    n1wi[j] += dt * n2wi[j];
    n1ar[j] += dt * n2ar[j];
    n1ai[j] += dt * n2ai[j];
  }
  lin(S, wr, wi, ar, ai, n1wr, n1wi, n1ar, n1ai);
  sym(wr, wi);
  sym(ar, ai);
  S.t += dt;
}

// The mean field leans from the long axis by alpha = 0.14 sin(0.0113 t) + 0.09 sin(0.0271 t), t in model seconds, a slow sway that keeps the lines
// at the sides of the panel moving as well as those in the middle.
const ALPHA = [0.14, 0.0113, 0.09, 0.0271];

function energy(S) {
  let ek = 0, em = 0;
  for (let j = 0; j < NM; j++) {
    ek += IK2c[j] * (S.wr[j] * S.wr[j] + S.wi[j] * S.wi[j]);
    em += K2c[j] * (S.ar[j] * S.ar[j] + S.ai[j] * S.ai[j]);
  }
  return [ek / (2 * N * N), em / (2 * N * N)];
}

// A first state at about the strength the forced field settles to: the forced modes with random phases, u and b both near 1.4 LEDs per model second.
function seed(S) {
  S.wr.fill(0);
  S.wi.fill(0);
  S.ar.fill(0);
  S.ai.fill(0);
  for (let i = 0; i < NF; i++) {
    const j = FJ[i], m = MJ[j], k = sqrt(K2c[j]), g = exp(-0.5 * (log(k / S.kf) / 0.3) ** 2);
    S.wr[j] = S.wr[m] = g * k * gauss();
    S.wi[j] = g * k * gauss();
    S.wi[m] = -S.wi[j];
    S.ar[j] = S.ar[m] = (g / k) * gauss();
    S.ai[j] = (g / k) * gauss();
    S.ai[m] = -S.ai[j];
  }
  const [ek, em] = energy(S), su = 1.4 / sqrt(2 * ek), sb = 1.3 / sqrt(2 * em);
  for (let j = 0; j < NM; j++) {
    S.wr[j] *= su;
    S.wi[j] *= su;
    S.ar[j] *= sb;
    S.ai[j] *= sb;
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  const ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.2, 5);
  S.ft = ft;
  S.hue = cl(k[0], 0, 1);
  S.b0t = B0REF * pow(B0RANGE, cl(k[3], -1, 1));
  S.kft = TAU / (L0 * pow(LRANGE, cl(k[2], -1, 1)));
  if (!S.warm) {
    S.warm = true;
    S.kf = S.kft;
    S.b0 = S.b0t;
    seed(S);
    for (let i = 0; i < 100; i++) step(S, 0.07);
  }
  S.kf += (S.kft - S.kf) * (1 - exp(-ft / 0.5));
  S.b0 += (S.b0t - S.b0) * (1 - exp(-ft / 0.4));
  // model seconds per step: a frame's worth at this Flow in as few equal steps as keep each under DTMAX, held to steps of 2^(1/32) so that the
  // damping factors are kept from frame to frame
  S.dtq = pow(2, Math.round((log(cl(flow / 30 / Math.ceil(flow / 30 / DTMAX - 1e-9), 0.002, DTMAX)) / Math.LN2) * 32) / 32);
  S.acc = min(S.acc + ft * flow, 8 * S.dtq);
  while (S.acc >= S.dtq) {
    S.acc -= S.dtq;
    step(S, S.dtq);
  }
  // The scheme is stable at these steps and the field is forced and damped, so this has never fired in a run; it is here for a step that is too long.
  const [ek, em] = energy(S);
  if (!(ek + em < 40)) {
    seed(S);
    S.resets++;
  }
}

// ---- colour ---------------------------------------------------------------------------------
function oklab2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
  return [e(r), e(g), e(bb)];
}
function fit(L, a, b) {
  for (let k = 0; k < 40; k++) {
    const c = oklab2rgb(L, a, b), y = (c[0] * 77 + c[1] * 150 + c[2] * 29) / 256;
    if (c.every((v) => v >= 0 && v <= 1 && y + (v - y) * 1.62 >= -0.01 && y + (v - y) * 1.62 <= 1.01)) return c;
    a *= 0.96;
    b *= 0.96;
  }
  return oklab2rgb(L, a, b).map((v) => cl(v, 0, 1));
}
// current ramp: [place, L, C, h]
const RAMP = [
  [0, 0.34, 0.1, 285],
  [0.25, 0.55, 0.14, 255],
  [0.5, 0.78, 0.12, 205],
  [0.75, 0.88, 0.14, 90],
  [1, 0.99, 0.02, 90],
];
const NR = 64;
function buildRamp(S, hue) {
  S.lutHue = hue;
  for (let i = 0; i < NR; i++) {
    const v = i / (NR - 1);
    let j = 1;
    while (j < RAMP.length - 1 && v > RAMP[j][0]) j++;
    const A = RAMP[j - 1], B = RAMP[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
    const L = A[1] + (B[1] - A[1]) * t, C = A[2] + (B[2] - A[2]) * t, h = (A[3] + (B[3] - A[3]) * t + hue * 360) * (PI / 180);
    const c = fit(L, C * cos(h), C * sin(h));
    S.ramp[i * 3] = c[0];
    S.ramp[i * 3 + 1] = c[1];
    S.ramp[i * 3 + 2] = c[2];
  }
}

// distance from a line in 1/16 LED -> brightness: a Gaussian 0.7 LED wide (sigma), 1.6 LEDs across at half height
const NPR = 128, LINE = new Float32Array(NPR);
for (let i = 0; i < NPR; i++) LINE[i] = exp(-0.5 * (i / 16 / 0.7) ** 2);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  if (S.lutHue !== S.hue) buildRamp(S, S.hue);
  const { c1r, c1i, c2r, c2i, ramp, ar, ai } = S, sc = 1 / N;
  c1r.fill(0);
  c1i.fill(0);
  c2r.fill(0);
  c2i.fill(0);
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], k2 = K2c[j], kx = KXc[j], ky = KYc[j];
    c1r[p] = (ar[j] + k2 * ai[j]) * sc;
    c1i[p] = (ai[j] - k2 * ar[j]) * sc;
    c2r[p] = (ky * ai[j] - kx * ar[j]) * sc;
    c2i[p] = (-ky * ar[j] - kx * ai[j]) * sc;
  }
  fft2(c1r, c1i, true);
  fft2(c2r, c2i, true);
  // a = c1r, j = c1i, b_x = c2r, b_y = c2i
  const b0 = S.b0, bx0 = b0 * sin(S.alpha), by0 = b0 * cos(S.alpha), ca = cos(S.alpha), sa = sin(S.alpha);
  let sj = 0, sb = 0;
  for (let p = 0; p < N; p++) {
    sj += c1i[p] * c1i[p];
    const bx = bx0 + c2r[p], by = by0 + c2i[p];
    sb += sqrt(bx * bx + by * by);
  }
  // the scales that the line spacing and the colour are measured against follow the field with a 6 s memory, so a change of Field or Scale does not flash
  const rate = S.drawn ? 1 - exp(-S.ft / 6) : 1;
  S.drawn = true;
  S.js += (sqrt(sj / N) - S.js) * rate;
  S.bm += (sb / N - S.bm) * rate;
  const delta = S.bm * SPACING, ij = 1 / (2.2 * S.js), jb = S.jb;
  // |j| with a 3 x 3 average, so that the colour of a line changes smoothly along it
  for (let y = 0; y < H; y++) {
    const y0 = ((y + H - 1) % H) * W, y1 = y * W, y2 = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const xm = (x + W - 1) % W, xp = (x + 1) % W;
      jb[y1 + x] = (abs(c1i[y0 + xm]) + abs(c1i[y0 + x]) + abs(c1i[y0 + xp]) + abs(c1i[y1 + xm]) + 2 * abs(c1i[y1 + x]) + abs(c1i[y1 + xp]) + abs(c1i[y2 + xm]) + abs(c1i[y2 + x]) + abs(c1i[y2 + xp])) / 10;
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const bx = bx0 + c2r[p], by = by0 + c2i[p], bm = sqrt(bx * bx + by * by) + 1e-6;
      const at = c1r[p] + b0 * (ca * (x - 31.5) - sa * (y - 63.5)), phi = at / delta, f = phi - floor(phi + 0.5);
      const di = min(NPR - 1, (abs(f) * delta * 16 / bm) | 0);
      const jn = cl(jb[p] * ij, 0, 1), jr = cl(abs(c1i[p]) * ij, 0, 1), o = ((jn * (NR - 1) + 0.5) | 0) * 3;
      const g3 = phi * 3, f3 = g3 - floor(g3 + 0.5), d3 = min(NPR - 1, (abs(f3) * delta * 16 / (3 * bm)) | 0);
      const jf = 0.5 * (jn + jr), fill = jf < 0.4 ? 0 : (jf - 0.4) / 0.6, v = min(1, LINE[di] * (0.7 + 0.3 * jn) + 0.22 * LINE[d3] + 0.55 * fill * fill) * 255;
      display.setPixel(x, y, v * ramp[o], v * ramp[o + 1], v * ramp[o + 2]);
    }
}
