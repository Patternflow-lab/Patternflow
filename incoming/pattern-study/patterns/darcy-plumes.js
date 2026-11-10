// ===== Patternflow pattern =====
// Title:   Darcy Plumes
// Family:  sim
// Idea:    Rayleigh-Darcy convection solved on the panel's own 64 columns and 128 rows at a Rayleigh number of 5000: a saturated skin under the top row sheds needle fingers into the rock, the fingers merge into thin, straight, sharply bounded plumes that nothing caps, the plumes run the whole depth to a sink in the bottom row and spread there, and the dip of the layer leans them, so a few chimneys in mint and pale lemon on indigo keep merging and re-forming with nobody stirring.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Convection in a porous layer heated from below (Horton and Rogers, 1945, and Lapwood, 1948, onset at Ra = 4 pi^2 between fixed plates; both from memory) on Darcy's law (Henry Darcy, 1856, from memory), the statistically steady state at large Rayleigh number (Hewitt, Neufeld and Lister, 2012: the flux near 0.0069 Ra and the interior wavenumber 0.48 Ra^0.4 per depth, both from memory) as it is met in the convective dissolution of CO2 in a saline aquifer (Riaz, Hesse, Tchelepi and Orr, 2006; Pau and others, 2010; from memory), an inclined layer (Bories and Combarnous, 1973, from memory), the stream function and the Poisson equation for it solved by a Fourier transform across the columns (James Cooley and John Tukey, 1965, from memory) and a tridiagonal solve down the rows (Llewellyn Thomas, 1949, from memory), semi-Lagrangian back-tracing (Andre Robert, 1981, from memory) with Catmull-Rom look-up (Edwin Catmull and Raphael Rom, 1974, from memory), colour in OKLab (Bjorn Ottosson, 2020, from memory), pattern round 124
// Round:   126
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..3.5, Scale=-1..1, Tilt=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every stop of the ramp, so one turn comes back to where it began. At 0 the heavy water runs from teal (hue 200, lightness 0.40) through mint (168, 0.72) to pale lemon (118, 0.97), the ground between the plumes is dark indigo (hue 235 to 280, lightness 0.15 to 0.33) and the light water that rises from the sink is a little more violet than the ground. Near hue 75 degrees (orange, olive) a dark colour reads as brown on the panel, so there the lit part of the ramp comes up in lightness by up to 0.3 and the ground loses 95 percent of its chroma: at 0.375 the ground is a dark grey-brown under lilac plumes, at 0.625 dark green under coral ones.
// Knob 2: Pace. A clock. B, the speed of the fully loaded fluid through the rock, is 85 Pace LEDs a second and kappa = B d / Ra goes with it, so Ra stays 5000 and the same flow runs faster: B and kappa are 85 and 2.2 at 1, 170 and 4.3 at the opening 2 and 298 and 7.6 at 3.5 (LEDs a second and LEDs squared a second). The rms vertical speed of the water, measured over 150 s, is 6.4, 12.3 and 21.0 LEDs a second, and the fastest 1 percent of it moves faster than 14.6, 28.6 and 49.3. The sway of the tilt and the spin-up keep to the same clock.
// Knob 3: Scale. How wide a column is, in rows of depth: R = 4.2 times 1.5 to the power of minus Scale, 6.3 at -1, 4.2 at 0 and 2.8 at 1, which makes the box 3.2, 2.1 and 1.4 depths wide. Ra does not move, so the plumes keep their shape down the depth and the knob stretches the picture across. At mid-depth the wavelength of the plumes (the centroid of the spectrum of c along a row) is 9.4, 13.1 and 19.4 LEDs, which is 6.8, 4.9 and 3.3 plumes across: thin and many at -1, fat and few at 1. The rms speed is 12.3 LEDs a second at all three.
// Knob 4: Tilt. How far gravity is tilted against the layer, 22 degrees times the knob, as in a dipping aquifer: the buoyancy has a part along the layer, so the heavy water falls at a slant and the plumes lean and bend. Over three runs of 150 s the heavy plumes fell 17 degrees off the vertical to the right at 1 and 21 to the left at -1 (4.6 and 5.8 columns sideways over 64 rows), 6 degrees at 0.5 and 0.6 at the opening 0.06. The rms vertical speed is 12.3 LEDs a second at 0.06, 9.8 at 1 and 11.6 at -1, and the plumes get a little fewer, 4.9 across at 0.06, 4.2 at 1 and 4.5 at -1 (one run each). The tilt also sways about the knob, 4 degrees rms with a correlation time of 45 / Pace seconds, so that even at 0 the plumes lean first one way and then the other.

// What the field is. Convection in a saturated porous layer 127 rows deep, rows 0 and 127 being the plates: the top row holds a
// dissolved solute at c = 1 (a saturated skin) and the bottom row at c = 0 (a sink), so the layer never fills up and the state
// is statistically steady. It is 64 columns across and periodic. The solute makes the water heavier. In rock the water has no
// inertia: Darcy's law makes its velocity the force on it over the drag of the grains, u = -(k/mu)(grad p - rho g), and there is
// no vorticity equation of its own. Taking the curl, with the stream function psi (u = dpsi/dy, v = -dpsi/dx, y runs down) and
// gravity tilted by t from the normal of the layer,
//   del^2 psi = -B (cos t dc/dx - sin t dc/dy),      dc/dt + u.grad c = kappa del^2 c,
// B = k drho g / mu being how fast fully loaded water would fall and Ra = B d / kappa = 5000 the whole of the dimensionless
// problem (the equations are from memory). psi = 0 on both plates, so no water crosses them. Where c varies only across the
// layer this gives v = B (c - its mean along the row): a plume is carried at B times how much heavier than its row it is, with
// nothing to cap it into a mushroom, so it stays as thin as diffusion lets it all the way down.
// A column is R rows of depth wide, not one. With square cells the box would be half a depth wide and hold one chimney; R = 4.2
// makes it 2.1 depths wide. Hewitt's interior wavenumber, 0.48 Ra^0.4 = 14.5 per depth, is a wavelength of 0.43 depths, which is
// 13 LEDs at that R, so about five plumes stand across the panel.
// One step. The concentration is averaged to the LEDs and Fourier transformed along each row. Across the columns the derivatives
// are exact in Fourier space and down the rows they are second order differences, so there is one tridiagonal solve per
// wavenumber for psi, and u and v come back together as the real and imaginary part of one transform per row. A central
// difference across the columns multiplies a stem two columns wide by cos^2(k R / 2), a half, and the thin plumes came out slow:
// at Ra = 10^4 and R = 3.6 the flux through the layer was 33 against 55 with exact derivatives. Then c is traced back along the
// velocity (midpoint rule, bilinear look-up of the LED velocities) and looked up with a Catmull-Rom cubic held between the four
// nearest values, on a grid with two columns to the LED and one row to the row, and diffused, explicitly across the columns and
// implicitly down the rows. The step is the frame's, 1/30 s.
// The tilt term brings a mean flow with it. The k = 0 part of psi is a wind along the plates, u = B sin t (c mean - 1/2): zero
// in the middle of the layer, and in the skin and at the sink it blows one way and the other, 20 rows a second at the plates
// at Tilt 1 and Pace 2 (measured 20.3 at row 1 against 19.2 from the formula) and gone within 4 rows. The tilt is not held
// still: it sways about the knob, an Ornstein-Uhlenbeck wander of 4 degrees rms, so the plumes lean first one way and then the
// other.

// What the checks showed, in the file's own step, with the tilt and its sway off. Growth of the first mode in a box 2 depths
// wide (R = 3.97, so mode 1 is k = pi / d), B = 1 row a second, sigma = B k^2 / (d K^2) - kappa K^2 with K^2 = k^2 + (pi / d)^2:
// at Ra / Ra_c = 2 the rate is 1.893e-3 a second for a step of 10 s, 1.928e-3 for 5 s and 1.946e-3 for 2.5 s, and 1.9635e-3
// extrapolated to a step of nothing against 1.9686e-3 (the error is first order in the step, -0.26 percent). At 5 Ra_c the
// extrapolated rate is 0.15 percent under, at 3 Ra_c 0.19, at 1.1 Ra_c 1.5 (3.505e-4 against 3.557e-4), and the rate crosses zero
// at Ra = 39.88 against 4 pi^2 = 39.48. The flow is divergence-free to 9e-15 of its largest term (spectral across, central down).
// Solute at the opening, Ra 5000 and R 4.2, over 300 s after 60 s: the flux through the top skin is 33.1 times the diffusive
// flux kappa / d, through the bottom skin 33.0, and through rows 8 to 120 between 31.9 and 32.9, so 0.0064 Ra against the 0.0069
// Ra that I remember. At R 2.8 the skin carries 34.7 and the rows 31.4 to 31.8, at R 6.3 30.5 and 33.0 to 34.6. At Ra 2500 it is
// 18.6 and 18.3 (0.0074 Ra), at 7000 42.0 and 41.1 to 43.0 (0.0060 Ra). The advection does not conserve solute, which is the
// difference of up to 10 percent between the skin and the rows; the mean of c over the layer stayed between 0.495 and 0.503 over
// 900 s. Why two columns to the LED: with one, 70 went through the rows and 39 through the skin; with two the skin and the rows
// balance to 3 percent; three give 34.6 and 34.1, so two sit 7 percent low; twice as many rows move the rows' flux from 31.9 to 31.7.
// Numerical diffusion across a stem moving sideways, Catmull-Rom on this grid, against kappa = 4.3 rows^2 a second at the
// opening: a stem 2 columns wide (sigma) moving 3 rows a second across adds 0.05, at 12 adds 0.23; a stem 0.8 columns wide adds
// 0.55 and 1.3. The rms speed across is 5.8 rows a second, so for the thinnest stems the scheme adds 10 to 20 percent to the
// real diffusion.
// At mid-depth the spectrum of c along a row has its centroid at a wavelength of 13.1 LEDs (4.9 across), 0.43 depths, as Hewitt's
// law says. The plumes do not freeze into columns: at rows 32, 64 and 96 the autocorrelation of c - row mean is 0.32 to 0.41 after
// 4 s, 0.08 to 0.23 after 8 s and 0.04 to 0.07 from 30 s on, and c has 10 to 11 sign changes along a row. The sway of the tilt
// was added for the strong tilts: the recur measure at all knobs at the maximum went from 0.459 to 0.568 with it, and at the
// opening from 0.651 to 0.587 (two draws of the same flow, so the second is not a loss I can pin on the sway).
// The spin-up is 100 steps 48 / Pace seconds long from the seed below, about 0.2 s in Node. Cost in Node at the opening: 1.5 ms
// a step and 0.8 ms to draw.

const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, tanh } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- tunables
const NX = 64, NZ = 128; // LEDs: the grid the flow is solved on, rows 0 and 127 being the skin and the sink
const MX = 2, NXF = NX * MX; // the concentration lives on MX columns to the LED, one row to the row
const RA0 = 5000; // Rayleigh number at every knob place
const B0 = 85; // Darcy speed of the fully loaded fluid, LEDs a second, at Pace 1
const R0 = 4.2; // LEDs of depth one column is wide, at Scale 0
const TILT_MAX = 22; // degrees of gravity's tilt at Tilt = 1
const SWAY = 4; // rms of the slow wander of the tilt about the knob, degrees
const SWAY_T = 45; // its correlation time in seconds at Pace 1

// ---- in-place complex FFT, N a power of two
function makeFft(N) {
  const rev = new Uint16Array(N), cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
  const bits = Math.round(Math.log2(N));
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  for (let k = 0; k < N / 2; k++) {
    cs[k] = cos((TAU * k) / N);
    sn[k] = sin((TAU * k) / N);
  }
  // sign -1 forward, +1 inverse, neither divided by N
  return function fft(re, im, sign) {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1, step = N / len;
      for (let s = 0; s < N; s += len)
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const wr = cs[t], wi = sign * sn[t];
          const a = s + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
    }
  };
}

// One Thomas solve down the rows of one wavenumber: a x(j-1) + b x(j) + a x(j+1) = r(j) for rows 1 to nz-2, the rows 0
// and nz-1 keeping the x they hold. The real and imaginary parts go together.
function thomas2(S, a, b, re, im, o, st) {
  const { cp, dp, dq } = S, nz = NZ, e = (nz - 1) * st, l = nz - 2;
  let m = b, rr = re[o + st] - a * re[o], qq = im[o + st] - a * im[o];
  cp[1] = a / m;
  dp[1] = rr / m;
  dq[1] = qq / m;
  for (let j = 2; j < nz - 1; j++) {
    m = b - a * cp[j - 1];
    rr = re[o + j * st];
    qq = im[o + j * st];
    if (j === l) {
      rr -= a * re[o + e];
      qq -= a * im[o + e];
    }
    cp[j] = a / m;
    dp[j] = (rr - a * dp[j - 1]) / m;
    dq[j] = (qq - a * dq[j - 1]) / m;
  }
  re[o + l * st] = dp[l];
  im[o + l * st] = dq[l];
  for (let j = l - 1; j >= 1; j--) {
    re[o + j * st] = dp[j] - cp[j] * re[o + (j + 1) * st];
    im[o + j * st] = dq[j] - cp[j] * im[o + (j + 1) * st];
  }
}

function newState() {
  const n = NX * NZ, nf = NXF * NZ, h = NX / 2 + 1, F = () => new Float64Array(n);
  const S = {
    C: new Float64Array(nf), C2: new Float64Array(nf), Cp: new Float64Array(NXF * (NZ + 4)), Dp: new Float64Array(nf), rowT: new Float64Array(NXF), cpf: new Float64Array(NZ),
    Cc: F(), U: F(), V: F(), DX: F(), DY: F(),
    fft: makeFft(NX), zr: new Float64Array(NX), zi: new Float64Array(NX),
    Cr: new Float64Array(NZ * h), Ci: new Float64Array(NZ * h), Pr: new Float64Array(NZ * h), Pi: new Float64Array(NZ * h),
    cp: new Float64Array(NZ), dp: new Float64Array(NZ), dq: new Float64Array(NZ),
    // the numbers the knobs set
    R: 1, B: 1, kap: 1, pace: 2, tilt: 0, sway: 0, time: 0, kp: 2, ks: 0, kt: 0.06,
    lut: new Float32Array(3 * 512), hueDone: -1, mean: new Float64Array(NZ), loc: F(), bq: F(), bh: F(), sig: 0.1, grm: 0.05, first: 1,
  };
  return S;
}

// Cc: the concentration on the LEDs, the fine columns weighted [1 2 1] / 4, which is the mean over the LED's own cell by the
// trapezoid rule. The plates are uniform, so they keep their value.
function restrict(S) {
  const { C, Cc } = S, mx = NXF - 1;
  for (let j = 0; j < NZ; j++) {
    const o = j * NXF;
    for (let i = 0; i < NX; i++) {
      const I = i * MX;
      Cc[j * NX + i] = (C[o + ((I - 1) & mx)] + 2 * C[o + I] + C[o + ((I + 1) & mx)]) / 4;
    }
  }
}

// del^2 psi = -B (cos t c_x - sin t c_y), psi = 0 on both plates, u = psi_y, v = -psi_x (y runs down). Across the columns the
// derivatives are exact in Fourier space (a central difference would multiply a stem that is two columns wide by cos^2(k R / 2),
// half, and the flow of the thin plumes would come out slow), down the rows they are second order differences. One tridiagonal
// solve per wavenumber; u and v then go back together as the real and imaginary part of one complex transform per row.
function solveFlow(S) {
  const { Cc, fft, zr, zi, Cr, Ci, Pr, Pi, U, V, B, R } = S, nx = NX, nz = NZ, h = nx / 2 + 1, mx = nx - 1;
  const ta = ((S.tilt + S.sway) * PI) / 180, ct = cos(ta), st = sin(ta);
  restrict(S);
  for (let j = 0; j < nz; j += 2) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      zr[i] = Cc[o + i];
      zi[i] = Cc[o + nx + i];
    }
    fft(zr, zi, -1);
    const q = j * h, q2 = q + h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
      Cr[q + k] = 0.5 * (zr[k] + zr[k2]);
      Ci[q + k] = 0.5 * (zi[k] - zi[k2]);
      Cr[q2 + k] = 0.5 * (zi[k] + zi[k2]);
      Ci[q2 + k] = -0.5 * (zr[k] - zr[k2]);
    }
  }
  // psi in Pr, Pi; then the spectra of u and v over the same arrays
  for (let k = 0; k < h; k++) {
    const kx = (TAU * k) / (nx * R), kd = k === nx / 2 ? 0 : kx;
    for (let j = 1; j < nz - 1; j++) {
      const q = j * h + k, cr = Cr[q], ci = Ci[q];
      const dyr = 0.5 * (Cr[q + h] - Cr[q - h]), dyi = 0.5 * (Ci[q + h] - Ci[q - h]);
      Pr[q] = -B * (ct * -kd * ci - st * dyr);
      Pi[q] = -B * (ct * kd * cr - st * dyi);
    }
    Pr[k] = Pi[k] = Pr[(nz - 1) * h + k] = Pi[(nz - 1) * h + k] = 0;
    thomas2(S, 1, -kx * kx - 2, Pr, Pi, k, h);
    // v = -psi_x goes into Cr, Ci; u = psi_y is a central difference of psi down the rows and is taken below
    for (let j = 0; j < nz; j++) {
      const q = j * h + k;
      Cr[q] = kd * Pi[q];
      Ci[q] = -kd * Pr[q];
    }
  }
  for (let j = 0; j < nz; j++) {
    const ja = j === 0 ? 1 : j === nz - 1 ? nz - 2 : j; // the plates: the u of the row next to them
    const j1 = ja + 1 > nz - 1 ? nz - 1 : ja + 1, j0 = ja - 1 < 0 ? 0 : ja - 1;
    const q = j * h, qa = j1 * h, qb = j0 * h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
      const ur = 0.5 * (Pr[qa + k] - Pr[qb + k]), ui = 0.5 * (Pi[qa + k] - Pi[qb + k]);
      const vr = j === 0 || j === nz - 1 ? 0 : Cr[q + k], vi = j === 0 || j === nz - 1 ? 0 : Ci[q + k];
      zr[k] = ur - vi;
      zi[k] = ui + vr;
      if (k2 !== k) {
        zr[k2] = ur + vi;
        zi[k2] = -ui + vr;
      }
    }
    fft(zr, zi, 1);
    const o = j * nx, sc = 1 / nx;
    for (let i = 0; i < nx; i++) {
      U[o + i] = zr[i] * sc;
      V[o + i] = zi[i] * sc;
    }
  }
}

// How far each LED's water came, over dt, in columns (DX) and rows (DY): a midpoint back-trace through the LED grid's velocity.
function displacements(S, dt) {
  const { U, V, DX, DY, R } = S, nx = NX, nz = NZ, mx = nx - 1, ymax = nz - 1, ir = 1 / R;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const xm = i - 0.5 * dt * ir * U[k];
      let ym = j - 0.5 * dt * V[k];
      ym = ym < 0 ? 0 : ym > ymax ? ymax : ym;
      const i0 = floor(xm), j0 = min(floor(ym), ymax - 1), a = xm - i0, b = ym - j0;
      const x0 = i0 & mx, x1 = (i0 + 1) & mx, r0 = j0 * nx, r1 = r0 + nx;
      const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
      DX[k] = dt * ir * (w00 * U[r0 + x0] + w10 * U[r0 + x1] + w01 * U[r1 + x0] + w11 * U[r1 + x1]);
      DY[k] = dt * (w00 * V[r0 + x0] + w10 * V[r0 + x1] + w01 * V[r1 + x0] + w11 * V[r1 + x1]);
    }
}

// Catmull-Rom look-up of c on the fine grid at the foot point (fi, fj), on the array padded with two rows above and below.
// The value is held between the four nearest ones, so c never leaves the range it was in.
function sampleC(A, fi, fj) {
  const mx = NXF - 1;
  const i1 = floor(fi), j1 = floor(fj), tx = fi - i1, ty = fj - j1;
  const xa = (i1 - 1) & mx, xb = i1 & mx, xc = (i1 + 1) & mx, xd = (i1 + 2) & mx;
  const t2 = tx * tx, t3 = t2 * tx;
  const ax = -0.5 * t3 + t2 - 0.5 * tx, bx = 1.5 * t3 - 2.5 * t2 + 1, cx = -1.5 * t3 + 2 * t2 + 0.5 * tx, dx = 0.5 * t3 - 0.5 * t2;
  const s2 = ty * ty, s3 = s2 * ty;
  const ay = -0.5 * s3 + s2 - 0.5 * ty, by = 1.5 * s3 - 2.5 * s2 + 1, cy = -1.5 * s3 + 2 * s2 + 0.5 * ty, dy = 0.5 * s3 - 0.5 * s2;
  const ra = (j1 + 1) * NXF, rb = ra + NXF, rc = rb + NXF, rd = rc + NXF;
  const va = ax * A[ra + xa] + bx * A[ra + xb] + cx * A[ra + xc] + dx * A[ra + xd];
  const vb = ax * A[rb + xa] + bx * A[rb + xb] + cx * A[rb + xc] + dx * A[rb + xd];
  const vc = ax * A[rc + xa] + bx * A[rc + xb] + cx * A[rc + xc] + dx * A[rc + xd];
  const vd = ax * A[rd + xa] + bx * A[rd + xb] + cx * A[rd + xc] + dx * A[rd + xd];
  const r = ay * va + by * vb + cy * vc + dy * vd;
  const p = A[rb + xb], q = A[rb + xc], s = A[rc + xb], u = A[rc + xc];
  const lo = min(min(p, q), min(s, u)), hi = max(max(p, q), max(s, u));
  return r < lo ? lo : r > hi ? hi : r;
}

function advect(S) {
  const { C, C2, Cp, DX, DY } = S, mx = NX - 1, ymax = NZ - 1, top = 0, bot = ymax * NXF;
  for (let J = 0; J < NZ; J++) {
    const o = J * NXF, q = (J + 2) * NXF;
    for (let I = 0; I < NXF; I++) Cp[q + I] = C[o + I];
  }
  // two ghost rows beyond each plate, odd about the plate's value, so a straight profile stays straight up to the plate
  for (let g = 1; g <= 2; g++) {
    const a = (2 - g) * NXF, c = (NZ + 1 + g) * NXF;
    for (let I = 0; I < NXF; I++) {
      Cp[a + I] = 2 * C[top + I] - C[g * NXF + I];
      Cp[c + I] = 2 * C[bot + I] - C[bot - g * NXF + I];
    }
  }
  // a fine column is either on an LED (its displacement is the LED's) or half way between two (the mean of the two)
  for (let J = 1; J < NZ - 1; J++) {
    const r0 = J * NX;
    for (let I = 0; I < NXF; I++) {
      const i0 = I >> 1, x1 = (i0 + 1) & mx;
      let dx = DX[r0 + i0], dy = DY[r0 + i0];
      if (I & 1) {
        dx = 0.5 * (dx + DX[r0 + x1]);
        dy = 0.5 * (dy + DY[r0 + x1]);
      }
      const fj = J - dy;
      C2[J * NXF + I] = sampleC(Cp, I - MX * dx, fj < 0 ? 0 : fj > ymax ? ymax : fj);
    }
  }
  for (let I = 0; I < NXF; I++) {
    C2[top + I] = C[top + I];
    C2[bot + I] = C[bot + I];
  }
}

// c_t = kappa del^2 c, across the columns explicit (in as many sub-steps as 0.4 asks for) and down the rows implicit, one
// tridiagonal solve per column, so that the step can be as long as the flow lets it be. The plates keep their value.
function diffuse(S, dt) {
  const { C, Dp, rowT, cpf } = S, mx = NXF - 1, last = (NZ - 1) * NXF;
  const kx = (S.kap * dt * MX * MX) / (S.R * S.R), ky = S.kap * dt;
  const ns = max(1, ceil(kx / 0.4)), ax = kx / ns;
  for (let s = 0; s < ns; s++)
    for (let J = 1; J < NZ - 1; J++) {
      const o = J * NXF;
      for (let I = 0; I < NXF; I++) rowT[I] = C[o + I];
      for (let I = 0; I < NXF; I++) C[o + I] = rowT[I] + ax * (rowT[(I + 1) & mx] + rowT[(I - 1) & mx] - 2 * rowT[I]);
    }
  // -ky c(J-1) + (1 + 2 ky) c(J) - ky c(J+1) = rhs, for all columns at once, row by row
  const b = 1 + 2 * ky;
  cpf[1] = -ky / b;
  for (let I = 0; I < NXF; I++) Dp[NXF + I] = (C[NXF + I] + ky * C[I]) / b;
  for (let J = 2; J < NZ - 1; J++) {
    const m = b + ky * cpf[J - 1], o = J * NXF, q = o - NXF, w = J === NZ - 2 ? ky : 0;
    cpf[J] = -ky / m;
    for (let I = 0; I < NXF; I++) Dp[o + I] = (C[o + I] + w * C[last + I] + ky * Dp[q + I]) / m;
  }
  for (let I = 0; I < NXF; I++) C[last - NXF + I] = Dp[last - NXF + I];
  for (let J = NZ - 3; J >= 1; J--) {
    const o = J * NXF, q = o + NXF;
    for (let I = 0; I < NXF; I++) C[o + I] = Dp[o + I] - cpf[J] * C[q + I];
  }
}

function gauss() {
  return sqrt(-2 * Math.log(1 - Math.random())) * cos(TAU * Math.random());
}
function step(S, dt) {
  const e = exp((-dt * S.pace) / SWAY_T);
  S.sway = S.sway * e + SWAY * sqrt(1 - e * e) * gauss();
  solveFlow(S);
  displacements(S, dt);
  advect(S);
  const t = S.C;
  S.C = S.C2;
  S.C2 = t;
  diffuse(S, dt);
  S.time += dt;
}

// The start: both skins as an exponential layer 3 rows thick about a mixed middle of 0.5, and 24 cosines across the box of
// random phase and an amplitude that falls with the wavenumber, standing on the middle of the depth and the two layers.
function seedState(S) {
  const { C } = S, M = 24, ph = [], am = [], d = NZ - 1;
  for (let m = 0; m < M; m++) {
    ph.push(Math.random() * TAU);
    am.push((0.1 * (Math.random() + 0.4)) / (1 + 0.15 * m));
  }
  for (let J = 0; J < NZ; J++) {
    const top = exp(-J / 3), bot = exp(-(d - J) / 3);
    const base = 0.5 + 0.5 * top - 0.5 * bot, env = sin((PI * J) / d) * (0.4 + 0.6 * (top + bot));
    for (let I = 0; I < NXF; I++) {
      let a = 0;
      for (let m = 0; m < M; m++) a += am[m] * cos((TAU * (m + 1) * I) / NXF + ph[m]);
      C[J * NXF + I] = cl(base + env * a, 0, 1);
    }
  }
  for (let I = 0; I < NXF; I++) {
    C[I] = 1;
    C[d * NXF + I] = 0;
  }
}

function setParams(S, ra, R, pace, tilt) {
  S.R = R;
  S.pace = pace;
  S.B = B0 * pace;
  S.kap = (S.B * (NZ - 1)) / ra;
  S.tilt = tilt;
}
const KNOB = [0, 2, 0, 0.06];
function knobTargets(k) {
  return [cl(k[1], 1, 3.5), cl(k[2], -1, 1), cl(k[3], -1, 1)];
}
function applyKnobs(S) {
  setParams(S, RA0, R0 * pow(1.5, -S.ks), S.kp, TILT_MAX * S.kt);
}

// ---- colour. OKLab (Bjorn Ottosson, 2020, constants from memory).
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
// t, lightness, chroma, hue in degrees
const STOPS = [
  [0.0, 0.33, 0.14, 280],
  [0.25, 0.22, 0.09, 266],
  [0.5, 0.15, 0.035, 235],
  [0.65, 0.4, 0.11, 200],
  [0.8, 0.72, 0.14, 168],
  [1.0, 0.97, 0.06, 118],
];
const LN = 512;
const TMP = [0, 0, 0];
function buildLut(S, shift) {
  const lut = S.lut;
  for (let k = 0; k < LN; k++) {
    const t = k / (LN - 1);
    let q = 1;
    while (q < STOPS.length - 1 && STOPS[q][0] < t) q++;
    const A = STOPS[q - 1], B = STOPS[q], u = (t - A[0]) / (B[0] - A[0]), w = u * u * (3 - 2 * u);
    let L = A[1] + (B[1] - A[1]) * w, C = A[2] + (B[2] - A[2]) * w;
    const hd = A[3] + (B[3] - A[3]) * w + shift, h = (hd * PI) / 180;
    // a dark orange or olive reads as brown on the panel: the lit part of the ramp comes up in lightness there, and the dark
    // ground goes towards grey
    let dh = (((hd - 75) % 360) + 360) % 360;
    if (dh > 180) dh -= 360;
    const warm = exp(-(dh * dh) / 5000), ground = 1 - sm(0.22, 0.36, L);
    L += 0.3 * warm * (1 - sm(0.45, 0.8, L)) * (1 - ground);
    C *= 1 - 0.95 * warm * ground;
    for (let it = 0; it < 8; it++) {
      lin(L, C * cos(h), C * sin(h), TMP);
      if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
      C *= 0.9;
    }
    lut[3 * k] = L;
    lut[3 * k + 1] = C * cos(h);
    lut[3 * k + 2] = C * sin(h);
  }
  S.hueDone = shift;
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  buildLut(S, 0);
  [S.kp, S.ks, S.kt] = knobTargets(knobValues || KNOB);
  applyKnobs(S);
  seedState(S);
  // 100 steps that are 48 / Pace seconds long, the same stretch of flow at every Pace, so that the first frame already has plumes
  const dt = 48 / (S.kp * 100);
  for (let n = 0; n < 100; n++) step(S, dt);
  S.time = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, h = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  if (h <= 0) return;
  const tg = knobTargets(k), f = 1 - exp(-4 * h);
  S.kp += (tg[0] - S.kp) * f;
  S.ks += (tg[1] - S.ks) * f;
  S.kt += (tg[2] - S.kt) * f;
  applyKnobs(S);
  const n = max(1, ceil(h * 30 - 1e-6));
  for (let i = 0; i < n; i++) step(S, h / n);
  if (!isFinite(S.U[S.U.length >> 1] + S.C[S.C.length >> 1])) seedState(S);
}

// ---- the picture. The colour is read from the anomaly of c against its mean along the row, over the rms of that anomaly in
// the neighbourhood (11 columns by 21 rows, never less than LFLOOR of the whole panel's), with a share of the raw c added back
// so that the saturated skin and the sink still read, and a rim from the laplacian of c.
const GAIN = 0.8, WALL = 0.5, RIM = 0.25, LFLOOR = 0.6;
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  restrict(S);
  const { Cc, lut, mean, loc, bq, bh } = S, o = [0, 0, 0], mx = NX - 1, ir2 = 1 / (S.R * S.R), cnt = NX * (NZ - 2);
  let ss = 0, gs = 0;
  for (let j = 0; j < NZ; j++) {
    let m = 0;
    for (let i = 0; i < NX; i++) m += Cc[j * NX + i];
    mean[j] = m / NX;
  }
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i, q = Cc[k] - mean[j];
      bq[k] = q * q;
      if (j > 0 && j < NZ - 1) {
        ss += q * q;
        gs += ((Cc[j * NX + ((i + 1) & mx)] - Cc[j * NX + ((i - 1) & mx)]) * ir2) ** 2 * 0.25 + (Cc[k + NX] - Cc[k - NX]) ** 2 * 0.25;
      }
    }
  const a = S.first ? 1 : 0.05;
  S.first = 0;
  S.sig += (sqrt(ss / cnt) - S.sig) * a;
  S.grm += (sqrt(gs / cnt) - S.grm) * a;
  for (let j = 0; j < NZ; j++) {
    const o0 = j * NX;
    let s = 0;
    for (let d = -5; d <= 5; d++) s += bq[o0 + ((d + NX) & mx)];
    for (let i = 0; i < NX; i++) {
      bh[o0 + i] = s;
      s += bq[o0 + ((i + 6) & mx)] - bq[o0 + ((i - 5 + NX) & mx)];
    }
  }
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NZ; j++) {
      let s = 0, n = 0;
      for (let d = -10; d <= 10; d++) {
        const jj = j + d;
        if (jj >= 0 && jj < NZ) {
          s += bh[jj * NX + i];
          n++;
        }
      }
      loc[j * NX + i] = sqrt(s / (n * 11));
    }
  const floorLoc = LFLOOR * S.sig, il = 1 / (1.5 * max(1e-4, S.grm));
  for (let y = 0; y < NZ; y++)
    for (let x = 0; x < NX; x++) {
      const k = y * NX + x, q = (Cc[k] - mean[y]) / max(loc[k], floorLoc);
      let t = 0.5 + 0.45 * tanh(GAIN * q) + WALL * (Cc[k] - 0.5);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const idx = 3 * ((t * (LN - 1) + 0.5) | 0);
      let L = lut[idx];
      if (y > 0 && y < NZ - 1) {
        const lap = (Cc[y * NX + ((x + 1) & mx)] + Cc[y * NX + ((x - 1) & mx)] - 2 * Cc[k]) * ir2 + Cc[k + NX] + Cc[k - NX] - 2 * Cc[k];
        L += RIM * tanh(lap * il);
      }
      L = L < 0.05 ? 0.05 : L > 0.98 ? 0.98 : L;
      lin(L, lut[idx + 1], lut[idx + 2], o);
      display.setPixel(x, y, gam(o[0]), gam(o[1]), gam(o[2]));
    }
}
