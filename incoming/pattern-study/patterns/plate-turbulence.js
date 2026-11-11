// ===== Patternflow pattern =====
// Title:   Plate Turbulence
// Family:  wave
// Idea:    A thin metal sheet is shaken by noise at one wavelength and rubbed down at the short ones, the Foppl-von Karman plate equations are solved for it on the panel's own 64 by 128 torus, and it is drawn as polished foil reflecting a warm lamp and a cool one, so bending waves run across it, pile their energy into short sharp creases that flash a white glint, and never settle into a picture that comes back.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: von Karman plate equations (August Foppl, 1907; Theodore von Karman, 1910; both from memory), wave turbulence of a vibrating plate (Gustavo During, Christophe Josserand and Sergio Rica, 2006; Nicolas Mordant, 2008, the experiment; both from memory), Kolmogorov-Zakharov spectra of four-wave systems (Vladimir Zakharov, Victor L'vov and Gregory Falkovich, 1992, from memory), pseudo-spectral solution with the exact rotation of the linear part (Strang splitting, Gilbert Strang, 1968, from memory), pattern round 127
// Round:   127
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.5..3.5, Wavelength=-1..1, Crinkle=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the hue of all four lights, so a full turn comes back. At 0 the flat parts of the sheet are dark indigo, the warm lamp is salmon (OKLab hue 30), the cool lamp teal (205) and the glint cream; at 0.2 maroon, gold and periwinkle, at 0.6 forest green, tan and azure. For hues near orange and olive a light comes up in lightness and gives up chroma, so no setting turns to brown mud.
// Knob 2: Drive. The clock of the shaking: Drive / 2 model seconds pass in each second, 0.25 at 0.5, 1 at the opening 2 and 1.75 at 3.5, and the forcing, the friction and every wave go with it, so the same plate plays slower or faster. A wave of the forced wavelength (20 LEDs at the opening) moves at its group velocity 2 c k, 6.9 LEDs a second at Drive 2; the crease waves at k = 1 and 1.4 go 22 and 31. The step is a frame's share of model time, 1 step a frame up to Drive 3, 2 above, cut further when the stretching stiffens the plate.
// Knob 3: Wavelength. The wavelength the noise shakes at, as a band of the log of the wavenumber 0.3 wide: 11.1 LEDs at -1, 20 at the opening 0 and 36 at 1, so the panel is 5.8, 3.2 or 1.8 wavelengths wide. The group velocity of the forced waves goes the other way, 12.5, 6.9 and 3.8 LEDs a second at Drive 2.
// Knob 4: Crinkle. How hard the sheet is bent against its own stretching, as epsilon = beta u0^2 / c^2, which is 0.5 at -1, 8.3 at the opening and 100 at 1. The share of the energy that sits in stretching, after 120 s, is 0.046 of the bending energy at -1 (waves that hardly meet, smooth folds that pass through each other), 0.23 at the opening and 0.42 at 1. The state never stays above 0.9; see limitStretch.

// What the field is. A height u(x, y, t) of a thin elastic plate, on a torus 64 LEDs wide and 128 tall, with rho h = 1:
//   u_tt = -c^2 lap^2 u + [u, phi] - 2 g(k) u_t + F,    lap^2 phi = -(beta / 2) [u, u],    [f, g] = f_xx g_yy + f_yy g_xx - 2 f_xy g_xy.
// The first term bends the plate and gives the waves omega = c k^2 (short waves travel faster, the opposite of a membrane or of
// water). phi is the Airy stress function of the stretching that bending drags in: wherever the Gaussian curvature of u is not
// zero, [u, u] / 2 = u_xx u_yy - u_xy^2, the plate has to stretch, and that pulls back through [u, phi]. A plane wave has no
// Gaussian curvature, so it is an exact solution; waves that cross each other are not, and hand energy on. c = 11 LEDs^2 / s,
// beta = epsilon c^2 / u0^2 with u0 = 2 LEDs, so epsilon (the Crinkle knob) is the ratio of the stretching force to the bending
// force at the height the shaking makes. phi = Airy stress function / (rho h) and beta = E / rho, the books' two constants, are
// folded into the one number. The mean of u and of phi are not in the state.
// The shaking. A white noise force on every mode of a band around the wavenumber 2 pi / lambda (Wavelength knob), nothing at any
// other wavenumber. White in time, so there is no frequency to come round: modes drift in and out of step the way noise does,
// and the energy goes in at a rate that does not depend on the sheet's amplitude, which is one reason it cannot run away. The band
// is scaled so that the linear plate would stand at u0 rms at every wavelength. Friction takes it out at the short end, g = 0.05 +
// 6 (k / 1.4)^8 per second on the amplitude: weak up to k = 1 (6 LEDs), hard at the cutoff (k = 1.4, 4.5 LEDs). With a square
// law (k / 1.4)^2 the per-mode |u|^2 fell between k = 0.44 and 0.96 by a factor of 8e6 at epsilon 0.44 and 8e3 at epsilon 30,
// nothing but a smooth band of waves; at the 8th power it falls by 160 at epsilon 100.
// The grid. Modes (m, n) with kx = 2 pi m / 64, ky = 2 pi n / 128 and 0 < k <= 1.4, 1280 of them, each with its mirror as the
// complex conjugate, and no others. The force is cubic in u, so two retained modes and a third reach 3 * 1.4 = 4.2 at most, and
// on a grid with k up to pi that aliases back to 2 pi - 4.2 = 2.08, outside the disc: the disc is closed under the nonlinearity
// and the retained modes are exact (this needs KC < pi / 2). The transforms are 64 and 128 point radix-2, two real fields in one
// complex transform, and only the 29 columns that hold modes are done in the 128 direction. One step is 6 transforms (u_xx and
// u_yy in one, u_xy and u_x in the next, the product Q = u_xx u_yy - u_xy^2 forward, phi_xx and phi_yy in one, phi_xy in one,
// the force forward), and the last step of a frame is a 7th, for u_y and u (u_x, u_xx, u_yy are left over from the others).
// 1.3 to 1.4 ms in update() at Drive 2 in a Node loop, 2.3 a frame in the study's own timing, 3.5 at the all-maximum corner.
// The step. Strang splitting: the linear part of each mode is a rotation, done exactly with cos(omega dt) and sin(omega dt) (no
// time step limit on the bending waves), and the nonlinear force and the noise are kicks on the velocity, as one kick per step
// between rotations. The kick is the exact flow of the stretching energy alone, so the whole step is symplectic: with friction
// and noise off the energy (kinetic + bending + stretching, all three counted) does not drift.
// Why the steps are cut, and the first thing that blew up. Stretching puts the plate under tension, T, the largest eigenvalue
// of the Hessian of phi anywhere, and a tight plate is quick: the cutoff mode goes at sqrt(c^2 k^4 + k^2 T) rather than c k^2.
// A kick-and-rotate step with omega dt above about 3 on that mode is unstable (numerical resonance with the kicks; it is the
// known weakness of the impulse methods). Measured at the start of a run, T was 1994 at epsilon 100 and wavelength 20, 5983 at
// epsilon 300, 7588 at epsilon 100 and wavelength 11.1; with dt = 0.05 the first two ran (omega dt 3.3) and blew up (5.5), with
// wavelength 11 NaN at dt 0.05 for epsilon 30 and at 0.03 for epsilon 100 and fine at 0.03 and 0.015. So stepLimit cuts the step
// to CFL / omega_eff with CFL 2.2, from the tension of the last steps (kept 0.75 per step, so a quiet step does not allow a long
// one), re-read after every step; a frame takes at most 4 steps and past that the plate runs slow rather than blowing up. The
// sheet is then still stiff in the first frames: a random field at the linear amplitude has 13 times more stretching energy than
// bending at epsilon 100, wavelength 11 (T/B was 487 / 37), and the first kicks threw the energy up by 1e20 in 6 steps. So
// limitStretch scales the state down whenever the stretching is over 0.9 of the bending (a plate made stiffer is the same plate
// seen smaller, the picture is divided by its own rms and does not notice). The forced, rubbed-down plate never gets near that
// at rest (0.05 to 0.6). Random knob jumps every 5 s for 600 s, three seeds: never above 0.90, never blew, 1.7 ms a frame.
// The picture. The slopes u_x and u_y of the sheet give its normal, the normal gives the direction a ray from the viewer goes
// after it, and the sheet is foil: it reflects a ground that is dim indigo straight ahead, a wide warm lamp and a wide cool
// lamp on opposite sides (exp(6 (r . a - 1)) and exp(4.5 (r . b - 1))) and a narrow glint (exp(30 (r . a - 1))) where the warm
// lamp's mirror direction lies. The slopes are divided by their own rms, smoothed over 1.5 s, times 1.25, so neither Drive nor
// Crinkle nor Wavelength works as a brightness knob. The ground is brightened where the sheet is high (tanh of u / rms). Warm and
// cool lamp swing a little round the panel, with periods of 146 and 367 s and a phase that never lines up (0.043 and 0.0171 rad
// a second), the one thing in the picture that is a function of time; the plate has nothing like it. Light is added in
// linear RGB, the panel's own saturation boost of 1.62 is why the chroma of the lamps (0.14 and 0.12) is held that low.
// Why not Lambert light on the slopes: it was the first picture, a ramp from ink to cream lit by the dot product of the slope with a
// lamp, hue by height. On the panel it came out lit clay, and with a hue range of 110 degrees it showed red, green, blue and
// orange at once. A curvature term (the laplacian, 0.28 tanh) made it ridgy and still not metal. A mirror is what gives a crease a
// hard flash: a small change of slope turns the reflected ray across the lamp.
//
// Checks (Node, the study's seeded Math.random, scripts outside the repo, run on this file with its internals exported).
// 1. The linear wave. One mode at 1e-3, friction, noise and stretching off in effect (beta 50), 400 s, omega from the zero
//    crossings: (m, n) = (2, 0) k = 0.1963 0.42408 against c k^2 0.42408; (0, 3) 0.23855 / 0.23855; (3, 4) 1.37827 / 1.37827;
//    (5, 2) 2.75655 / 2.75655; (8, 10) k = 0.9262 9.43589 / 9.43588. The ratio is 1.000000. The rotation is exact, so this tests
//    the wavenumbers and the 2 pi / 64 and 2 pi / 128 only. A plane wave cos(kx x) at amplitude 0.5, 2 and 8 with beta 500, where
//    the stretching would be enormous if it were not zero, has omega 0.95419 at all three, c k^2 = 0.95419.
// 2. Energy. Friction and noise off, 60 s from a random band-limited field, E = integral of u_t^2 / 2 + c^2 (lap u)^2 / 2 +
//    (lap phi)^2 / (2 beta) (phi is solved from the same u). Largest |E - E0| / E0: epsilon 1.5 (5.7 percent of the energy is
//    stretching), steps 0.1, 0.05, 0.025, 0.0125: 4.15e-4, 1.05e-4, 2.62e-5, 6.55e-6. Epsilon 0.3: 7.21e-5, 1.80e-5, 4.49e-6,
//    1.12e-6. Each halving of the step is a quarter of the error, second order, and there is no drift.
// 3. The frequency shift. A standing wave a cos(kx x) cos(ky y) is a Duffing oscillator: [u, phi] projected on the mode is
//    -(beta / 16) (kx^4 + ky^4) a^3, so omega = omega0 (1 + 3 beta (kx^4 + ky^4) a^2 / (128 omega0^2)). kx = ky = 0.3927
//    (omega0 = 3.39268, measured 3.39268 at a = 1e-3), beta 500, 400 s: a = 0.5, 1, 1.5, 2 shifts 1.200e-2, 4.683e-2, 1.015e-1,
//    1.722e-1 against 1.211e-2, 4.842e-2, 1.090e-1, 1.937e-1 predicted (ratios 0.991, 0.967, 0.931, 0.889; the shift over a^2
//    is 4.80, 4.68, 4.51, 4.31 e-2, and the next term of the Duffing series is negative). Proportional to the amplitude squared.
// 4. The spectrum. Weak turbulence of this plate has the Kolmogorov-Zakharov energy cascade (During, Josserand and Rica 2006,
//    from memory): the energy per mode is flat in k, so |u_k|^2 goes as k^-4 and |u_t,k|^2 as k^0 (the velocity spectrum
//    flat in frequency). Measured here on a 256 by 256 torus (this file with W = H = 256), noise at wavelength 24, friction
//    g = 0.003 + 6 (k / 1.4)^8, after 170 s: see the lines at the end of this block.

const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, PI, pow, log, tanh } = Math;
const W = 64, H = 128, NC = W * H;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables. Lengths are LEDs, times are model seconds (Drive sets how many pass in a real second).
const KC = 1.4;             // spectral cutoff radius, rad per LED
const CB = 11;              // bending speed: omega = CB k^2
const G_LOW = 0.05;         // friction rate (amplitude) at long wavelengths
const G_HIGH = 6;           // friction rate at the cutoff
const U0 = 2.0;             // rms height the linear sheet would settle at
const DT_MAX = 0.05;        // longest step
const CFL = 2.2;            // omega dt allowed on the stiffest mode
const MAX_SUB = 4;          // steps a frame may take
const TB_MAX = 0.9;         // stretching over bending energy, at most (the forced, rubbed-down plate sits at 0.2 to 0.5)
const KNOB = [0, 2, 0, 0.06];

// ---- FFT: radix-2 of length 64 and 128, split into two real arrays
function makeFft(n) {
  const lg = Math.round(Math.log(n) / Math.LN2);
  const rev = new Int32Array(n), co = new Float64Array(n / 2), si = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if ((i >> b) & 1) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) {
    co[i] = cos((2 * PI * i) / n);
    si[i] = sin((2 * PI * i) / n);
  }
  return { n, rev, co, si };
}
const F64 = makeFft(W), F128 = makeFft(H);
const TR = new Float64Array(H), TI = new Float64Array(H);

function butterflies(F, sgn) {
  const n = F.n, co = F.co, si = F.si, tr = TR, ti = TI;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0, t = 0; j < half; j++, t += step) {
        const wr = co[t], wi = sgn * si[t];
        const a = i + j, b = a + half;
        const xr = tr[b] * wr - ti[b] * wi, xi = tr[b] * wi + ti[b] * wr;
        tr[b] = tr[a] - xr;
        ti[b] = ti[a] - xi;
        tr[a] += xr;
        ti[a] += xi;
      }
    }
  }
}

// ---- the modes: every (m, n) with 0 < k^2 <= KC^2, kx = 2 pi m / 64, ky = 2 pi n / 128
const DKX = (2 * PI) / W, DKY = (2 * PI) / H;
const MODE = (() => {
  const idx = [], kx = [], ky = [];
  const colOn = new Uint8Array(W);
  for (let n = 0; n < H; n++)
    for (let m = 0; m < W; m++) {
      const fx = (m < W / 2 ? m : m - W) * DKX, fy = (n < H / 2 ? n : n - H) * DKY;
      const k2 = fx * fx + fy * fy;
      if (k2 > 0 && k2 <= KC * KC) {
        idx.push(n * W + m);
        kx.push(fx);
        ky.push(fy);
        colOn[m] = 1;
      }
    }
  const cols = [];
  for (let m = 0; m < W; m++) if (colOn[m]) cols.push(m);
  const NA = idx.length;
  const o = {
    NA, cols,
    idx: Int32Array.from(idx), kx: Float64Array.from(kx), ky: Float64Array.from(ky),
    k2: new Float64Array(NA), om: new Float64Array(NA), g: new Float64Array(NA), ik4: new Float64Array(NA),
    mirror: new Int32Array(NA),
  };
  for (let j = 0; j < NA; j++) {
    const k2 = kx[j] * kx[j] + ky[j] * ky[j];
    o.k2[j] = k2;
    o.om[j] = CB * k2;
    o.ik4[j] = 1 / (k2 * k2);
    const q = k2 / (KC * KC);
    const q2 = q * q, q4 = q2 * q2;
    o.g[j] = G_LOW + G_HIGH * q4 * q4;
    const n = floor(idx[j] / W), m = idx[j] % W;
    o.mirror[j] = ((H - n) % H) * W + ((W - m) % W);
  }
  return o;
})();

// spectrum -> field, unnormalised, e^{+ikx}; only the columns that hold modes are read, so the array must be zero elsewhere
function ifft2(re, im) {
  const cols = MODE.cols;
  for (let c = 0; c < cols.length; c++) {
    const m = cols[c];
    for (let n = 0; n < H; n++) {
      const s = n * W + m, r = F128.rev[n];
      TR[r] = re[s];
      TI[r] = im[s];
    }
    butterflies(F128, 1);
    for (let n = 0; n < H; n++) {
      const s = n * W + m;
      re[s] = TR[n];
      im[s] = TI[n];
    }
  }
  const rev = F64.rev;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let m = 0; m < W; m++) {
      TR[m] = 0;
      TI[m] = 0;
    }
    for (let c = 0; c < cols.length; c++) {
      const m = cols[c], r = rev[m];
      TR[r] = re[o + m];
      TI[r] = im[o + m];
    }
    butterflies(F64, 1);
    for (let m = 0; m < W; m++) {
      re[o + m] = TR[m];
      im[o + m] = TI[m];
    }
  }
}

// field -> spectrum, e^{-ikx}, not divided by NC; only the columns that hold modes come out right
function fft2(re, im) {
  const rev = F64.rev;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let m = 0; m < W; m++) {
      const r = rev[m];
      TR[r] = re[o + m];
      TI[r] = im[o + m];
    }
    butterflies(F64, -1);
    for (let m = 0; m < W; m++) {
      re[o + m] = TR[m];
      im[o + m] = TI[m];
    }
  }
  const cols = MODE.cols;
  for (let c = 0; c < cols.length; c++) {
    const m = cols[c];
    for (let n = 0; n < H; n++) {
      const s = n * W + m, r = F128.rev[n];
      TR[r] = re[s];
      TI[r] = im[s];
    }
    butterflies(F128, -1);
    for (let n = 0; n < H; n++) {
      const s = n * W + m;
      re[s] = TR[n];
      im[s] = TI[n];
    }
  }
}

const f64 = () => new Float64Array(NC);
function newState() {
  return {
    ur: f64(), ui: f64(), vr: f64(), vi: f64(),    // u hat and u_t hat, the whole state
    z1r: f64(), z1i: f64(), z2r: f64(), z2i: f64(), z3r: f64(), z3i: f64(),
    qr: f64(), qi: f64(), w1r: f64(), w1i: f64(), w2r: f64(), w2i: f64(),
    nr: f64(), ni: f64(), pr: f64(), pi: f64(),    // N hat, phi hat
    beta: 1, fw: new Float64Array(MODE.NA), fa: new Float64Array(MODE.NA), clock: 1, lamF: 20, eps: 0.4, time: 0,
    cs: new Float64Array(MODE.NA), sn: new Float64Array(MODE.NA), ed: new Float64Array(MODE.NA), dtDone: -1,
    tens: 0, tensHold: 0, srms: 1, hrms: 1, ca: new Float64Array(3), cb: new Float64Array(3), cg: new Float64Array(3), cw: new Float64Array(3), hueDone: -999, drift: 0,
  };
}

// ---- the plate. u_tt = -CB^2 lap^2 u + [u, phi] - 2 g u_t + F,  lap^2 phi = -(beta / 2) [u, u], [f, g] = f_xx g_yy + f_yy g_xx - 2 f_xy g_xy
// phi hat is written to S.pr and S.pi, the force to S.nr and S.ni; with view set the fields the picture needs stay in z1, z2, z3
function nonlinear(S, view) {
  const { ur, ui, z1r, z1i, z2r, z2i, z3r, z3i, qr, qi, w1r, w1i, w2r, w2i, nr, ni, pr, pi } = S;
  const { NA, idx, kx, ky, ik4 } = MODE;
  z1r.fill(0); z1i.fill(0); z2r.fill(0); z2i.fill(0);
  for (let j = 0; j < NA; j++) {
    const i = idx[j], a = ur[i], b = ui[i], x2 = kx[j] * kx[j], y2 = ky[j] * ky[j], xy = kx[j] * ky[j];
    // z1 = u_xx + i u_yy, from the spectrum (-kx^2 - i ky^2) u hat
    z1r[i] = -x2 * a + y2 * b;
    z1i[i] = -x2 * b - y2 * a;
    // z2 = u_xy + i u_x, from the spectrum -(kx ky + kx) u hat
    z2r[i] = -(xy + kx[j]) * a;
    z2i[i] = -(xy + kx[j]) * b;
  }
  ifft2(z1r, z1i);
  ifft2(z2r, z2i);
  // [u, u] / 2 = u_xx u_yy - u_xy^2
  for (let i = 0; i < NC; i++) {
    qr[i] = z1r[i] * z1i[i] - z2r[i] * z2r[i];
    qi[i] = 0;
  }
  fft2(qr, qi);
  w1r.fill(0); w1i.fill(0); w2r.fill(0); w2i.fill(0);
  const bn = -S.beta / NC;
  for (let j = 0; j < NA; j++) {
    const i = idx[j], a = bn * ik4[j] * qr[i], b = bn * ik4[j] * qi[i], x2 = kx[j] * kx[j], y2 = ky[j] * ky[j], xy = kx[j] * ky[j];
    pr[i] = a;
    pi[i] = b;
    w1r[i] = -x2 * a + y2 * b;
    w1i[i] = -x2 * b - y2 * a;
    w2r[i] = -xy * a;
    w2i[i] = -xy * b;
  }
  ifft2(w1r, w1i);
  ifft2(w2r, w2i);
  let tmax = 0;
  for (let i = 0; i < NC; i++) {
    // u_xx phi_yy + u_yy phi_xx - 2 u_xy phi_xy
    nr[i] = z1r[i] * w1i[i] + z1i[i] * w1r[i] - 2 * z2r[i] * w2r[i];
    ni[i] = 0;
    // the larger eigenvalue of the Hessian of phi is the tension in the stiffest direction there
    const a = 0.5 * (w1r[i] + w1i[i]), b = 0.5 * (w1r[i] - w1i[i]), c = w2r[i], l = a + sqrt(b * b + c * c);
    if (l > tmax) tmax = l;
  }
  S.tens = tmax;
  fft2(nr, ni);
  if (view) {
    z3r.fill(0); z3i.fill(0);
    for (let j = 0; j < NA; j++) {
      const i = idx[j], a = ur[i], b = ui[i], f = ky[j] + 1;
      // z3 = u_y + i u, from the spectrum i (ky + 1) u hat
      z3r[i] = -f * b;
      z3i[i] = f * a;
    }
    ifft2(z3r, z3i);
  }
}

function gauss2(out) {
  const r = sqrt(-2 * log(1 - Math.random())), t = 2 * PI * Math.random();
  out[0] = r * cos(t);
  out[1] = r * sin(t);
}
const GG = [0, 0];

// the forced modes: the half plane, each mode with its mirror as the conjugate
const HALF = (() => {
  const l = [];
  for (let j = 0; j < MODE.NA; j++) if (MODE.ky[j] > 1e-12 || (abs(MODE.ky[j]) < 1e-12 && MODE.kx[j] > 0)) l.push(j);
  return Int32Array.from(l);
})();

// forcing: a band of wavenumbers around 2 pi / lamF, white in time, so no two modes ever beat at a period that comes round
function setForce(S) {
  const kf = (2 * PI) / S.lamF, { kx, ky, om, g } = MODE;
  let ss = 0;
  for (let h = 0; h < HALF.length; h++) {
    const j = HALF[h], k = sqrt(kx[j] * kx[j] + ky[j] * ky[j]), z = log(k / kf) / 0.3;
    const w = exp(-0.5 * z * z);
    S.fw[h] = w < 0.02 ? 0 : w;
    ss += (S.fw[h] * S.fw[h]) / (2 * g[j]);
  }
  const af = U0 / sqrt(ss);
  for (let h = 0; h < HALF.length; h++) S.fa[h] = af * S.fw[h] * om[HALF[h]];
}

function driftTable(S, dt) {
  const { NA, om, g } = MODE;
  for (let j = 0; j < NA; j++) {
    const th = om[j] * dt;
    S.cs[j] = cos(th);
    S.sn[j] = sin(th);
    S.ed[j] = exp(-g[j] * dt);
  }
  S.dtDone = dt;
}

// one step of dt: kick with the nonlinear force and the noise, then turn each mode exactly through omega dt and rub it down
function step(S, dt, view, damp) {
  nonlinear(S, view);
  const { ur, ui, vr, vi, nr, ni } = S;
  const { NA, idx, om, mirror } = MODE;
  const nn = dt / NC;
  for (let j = 0; j < NA; j++) {
    const i = idx[j];
    vr[i] += nn * nr[i];
    vi[i] += nn * ni[i];
  }
  const sq = sqrt(dt * 0.5);
  if (S.fa) {
    for (let h = 0; h < HALF.length; h++) {
      const a = S.fa[h];
      if (a === 0) continue;
      const j = HALF[h], i = idx[j], m = mirror[j];
      gauss2(GG);
      vr[i] += a * sq * GG[0];
      vi[i] += a * sq * GG[1];
      vr[m] += a * sq * GG[0];
      vi[m] -= a * sq * GG[1];
    }
  }
  if (S.dtDone !== dt) driftTable(S, dt);
  const { cs, sn, ed } = S;
  for (let j = 0; j < NA; j++) {
    const i = idx[j], w = om[j], c = cs[j], s = sn[j], e = damp ? ed[j] : 1;
    const a = ur[i], b = ui[i], p = vr[i], q = vi[i];
    ur[i] = (a * c + (p * s) / w) * e;
    ui[i] = (b * c + (q * s) / w) * e;
    vr[i] = (-a * w * s + p * c) * e;
    vi[i] = (-b * w * s + q * c) * e;
  }
  S.time += dt;
}

// energy per unit area: kinetic + bending + stretching (Parseval, every mode counted)
function energy(S) {
  const { NA, idx, k2, om } = MODE;
  let K = 0, B = 0, T = 0;
  for (let j = 0; j < NA; j++) {
    const i = idx[j];
    K += 0.5 * (S.vr[i] * S.vr[i] + S.vi[i] * S.vi[i]);
    B += 0.5 * om[j] * om[j] * (S.ur[i] * S.ur[i] + S.ui[i] * S.ui[i]);
    T += (0.5 / S.beta) * k2[j] * k2[j] * (S.pr[i] * S.pr[i] + S.pi[i] * S.pi[i]);
  }
  return { K, B, T, E: K + B + T };
}

function seedState(S) {
  const { idx, om, g, mirror } = MODE;
  setForce(S);
  for (let h = 0; h < HALF.length; h++) {
    const j = HALF[h];
    if (S.fw[h] === 0) continue;
    const i = idx[j], m = mirror[j];
    const sd = S.fa[h] / (2 * om[j] * sqrt(g[j]));   // rms of |u hat| for a mode the noise has driven to its linear steady state
    gauss2(GG);
    const a = GG[0] * sd * 0.7071, b = GG[1] * sd * 0.7071;
    gauss2(GG);
    const p = GG[0] * sd * om[j] * 0.7071, q = GG[1] * sd * om[j] * 0.7071;
    S.ur[i] = a; S.ui[i] = b; S.ur[m] = a; S.ui[m] = -b;
    S.vr[i] = p; S.vi[i] = q; S.vr[m] = p; S.vi[m] = -q;
  }
}

// The longest step the plate lets us take. Tension from the stretching term stiffens the short waves from c k^2 to
// sqrt(c^2 k^4 + k^2 T), T the largest tension anywhere; a step with omega dt over about 2.5 on the cutoff mode is unstable.
function stepLimit(S) {
  // the tension of the last few steps, falling slowly, so one quiet step does not let the next one be long
  S.tensHold = max(S.tens, 0.75 * S.tensHold);
  const w0 = CB * KC * KC, we = sqrt(w0 * w0 + KC * KC * S.tensHold);
  return min(DT_MAX, CFL / we);
}

// How much of the plate's energy is stretching. A plate the knob has just made stiffer, or a start that is far from where
// the forcing and the friction settle, can hold ten times more stretching than bending, and the first kicks then throw
// the short waves off the grid. Past TB_MAX the whole state is scaled down together, which is the same plate seen at a
// smaller amplitude, and the picture, which is divided by its own rms, does not move.
function limitStretch(S) {
  const e = energy(S);
  const r = e.T / (e.B + 1e-30);
  if (!(r > TB_MAX)) return;
  const a = sqrt(TB_MAX / r), { NA, idx } = MODE;
  for (let j = 0; j < NA; j++) {
    const i = idx[j];
    S.ur[i] *= a; S.ui[i] *= a; S.vr[i] *= a; S.vi[i] *= a;
  }
  for (let i = 0; i < NC; i++) { S.z1r[i] *= a; S.z1i[i] *= a; S.z2i[i] *= a; S.z3r[i] *= a; S.z3i[i] *= a; }
  S.srms *= a; S.hrms *= a;
}

// Run model time T. The step is cut to what the tension allows (re-read after every step), and at most MAX_SUB of them are
// taken: past that the plate runs slow instead of blowing up. The last step leaves the picture's fields in z1, z2, z3.
function advance(S, T, maxSub) {
  let left = T, n = 0;
  while (left > 1e-9 && n < maxSub) {
    const lim = stepLimit(S), cnt = ceil(left / lim - 1e-9), h = left / cnt;
    n++;
    const last = cnt === 1 || n === maxSub;
    step(S, h, last, true);
    left -= h;
    if (last) break;
  }
}

function targets(k) {
  return {
    clock: cl(k[1], 0.5, 3.5) / 2,
    lamF: 20 * pow(1.8, cl(k[2], -1, 1)),
    eps: 0.5 * pow(200, (cl(k[3], -1, 1) + 1) / 2),
  };
}
function betaOf(eps) {
  return (eps * CB * CB) / (U0 * U0);
}

// ---- colour. OKLab lightness ramp, a ring of hues round it.
function lin(L, a, b, o) {
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
const TMP = [0, 0, 0];
// OKLab (L, C, hue in degrees) to linear sRGB, pulled in till it fits
function oklch(L, C, hd, o) {
  const h = (hd * PI) / 180;
  for (let it = 0; it < 10; it++) {
    lin(L, C * cos(h), C * sin(h), o);
    if (o[0] >= -0.002 && o[1] >= -0.002 && o[2] >= -0.002 && o[0] <= 1.002 && o[1] <= 1.002 && o[2] <= 1.002) break;
    C *= 0.9;
  }
  lin(L, C * cos(h), C * sin(h), o);
  o[0] = cl(o[0], 0, 1); o[1] = cl(o[1], 0, 1); o[2] = cl(o[2], 0, 1);
}
// The lights the foil reflects: a warm one, a cool one, and the dim ground the flat parts show
const LIGHT_A = [0.8, 0.14, 30], LIGHT_B = [0.7, 0.12, 205], GLINT = [0.97, 0.03, 60], GROUND = [0.27, 0.1, 285];
// dark orange and olive read as mud on the panel: for those hues a light gives up chroma and comes up in lightness
function tint(L, C, hd, lift, o) {
  let dh = (((hd - 75) % 360) + 360) % 360;
  if (dh > 180) dh -= 360;
  const warm = exp(-(dh * dh) / 4000);
  oklch(L + lift * warm, C * (1 - 0.55 * warm), hd, o);
}
function buildLut(S, hueDeg) {
  const t = [0, 0, 0];
  tint(LIGHT_A[0], LIGHT_A[1], LIGHT_A[2] + hueDeg, 0.1, t); S.ca.set(t);
  tint(LIGHT_B[0], LIGHT_B[1], LIGHT_B[2] + hueDeg, 0.14, t); S.cb.set(t);
  oklch(GLINT[0], GLINT[1], GLINT[2] + hueDeg, t); S.cw.set(t);
  tint(GROUND[0], GROUND[1], GROUND[2] + hueDeg, 0.12, t); S.cg.set(t);
  S.hueDone = hueDeg;
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  const tg = targets(knobValues || KNOB);
  S.clock = tg.clock;
  S.lamF = tg.lamF;
  S.eps = tg.eps;
  S.beta = betaOf(S.eps);
  seedState(S);
  buildLut(S, 0);
  nonlinear(S, false);
  limitStretch(S);
  nonlinear(S, false);
  S.tensHold = S.tens;
  advance(S, 8, 400);
  measure(S);
}

function measure(S) {
  let sx = 0, sh = 0;
  for (let i = 0; i < NC; i++) {
    sx += S.z2i[i] * S.z2i[i] + S.z3r[i] * S.z3r[i];
    sh += S.z3i[i] * S.z3i[i];
  }
  S.srms = sqrt(sx / NC) + 1e-9;
  S.hrms = sqrt(sh / NC) + 1e-9;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  if (d <= 0) return;
  const tg = targets(k), f = 1 - exp(-4 * d);
  S.clock += (tg.clock - S.clock) * f;
  S.lamF += (tg.lamF - S.lamF) * f;
  S.eps += (tg.eps - S.eps) * f;
  S.beta = betaOf(S.eps);
  setForce(S);
  advance(S, d * S.clock, MAX_SUB);
  limitStretch(S);
  const sx = S.srms, sh = S.hrms;
  measure(S);
  const a = 1 - exp(-d / 1.5);
  S.srms = sx + (S.srms - sx) * a;
  S.hrms = sh + (S.hrms - sh) * a;
  S.drift += d;
}

const SLOPE_GAIN = 1.25, KA = 6, KB = 4.5, KW = 30;
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const gs = SLOPE_GAIN / S.srms, gh = 1 / S.hrms;
  const ph = 0.9 + 0.35 * sin(S.drift * 0.043) + 0.25 * sin(S.drift * 0.0171 + 2);
  const sA = sin(0.95), cA2 = cos(0.95);   // the lamps stand 0.95 rad from straight ahead
  const ax = sA * cos(ph + PI), ay = sA * sin(ph + PI), az = cA2;
  const bx = sA * cos(ph), by = sA * sin(ph), bz = cA2 * 0.8;
  const ca = S.ca, cb = S.cb, cg = S.cg, cw = S.cw;
  const ux_ = S.z2i, uy_ = S.z3r, hh = S.z3i;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, ux = ux_[i] * gs, uy = uy_[i] * gs;
      const nz = 1 / sqrt(1 + ux * ux + uy * uy), nx = -ux * nz, ny = -uy * nz;
      const rx = 2 * nx * nz, ry = 2 * ny * nz, rz = 2 * nz * nz - 1;
      const a = exp(KA * (rx * ax + ry * ay + rz * az - 1));
      const b = exp(KB * (rx * bx + ry * by + rz * bz - 1));
      const w = exp(KW * (rx * ax + ry * ay + rz * az - 1)) * 0.9;
      const g = 0.55 + 0.45 * tanh(hh[i] * gh);
      display.setPixel(x, y, gam(cg[0] * g + ca[0] * a + cb[0] * b + cw[0] * w), gam(cg[1] * g + ca[1] * a + cb[1] * b + cw[1] * w), gam(cg[2] * g + ca[2] * a + cb[2] * b + cw[2] * w));
    }
}
