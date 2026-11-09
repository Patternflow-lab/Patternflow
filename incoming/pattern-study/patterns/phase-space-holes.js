// ===== Patternflow pattern =====
// Title:   Phase Space Holes
// Family:  physics
// Idea:    The phase-space plane of a two-stream plasma, the 64 columns one box length of space and the 128 rows velocity, the electrons that came from the upper beam amber and those from the lower beam azure, where electron holes grow out of the instability as dark-cored vortices with bright rims, wind the two beams into violet filaments, merge when they catch each other and fade where a slow relaxation to the beams refills them, so a changing crowd of holes goes on for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Vlasov equation for electrons on a fixed background of ions (Anatoly Vlasov, 1938, from memory) with Poisson's equation, in one space and one velocity dimension; the two-stream instability (John Pierce, 1948; David Bohm and Eugene Gross, 1949; both from memory) and the collisionless damping of a plasma wave (Lev Landau, 1946, from memory); the steady holes, BGK modes (Ira Bernstein, John Greene and Martin Kruskal, 1957, from memory), and holes as vortices in phase space that trap particles and merge (Keith Roberts and Herbert Berk, 1967; Herbert Berk, C. E. Nielsen and Keith Roberts, 1970; from memory); the drift and kick splitting of Cheng and Knorr (1976, from memory) after Strang (1968), with the positive flux-conservative advection of Filbet, Sonnendruecker and Bertrand (2001, from memory) in place of their spline; relaxation to an equilibrium at a rate nu (Bhatnagar, Gross and Krook, 1954, from memory); the plasma dispersion function (Burton Fried and Samuel Conte, 1961, from memory) for the checks; colour in OKLab (Bjorn Ottosson, 2020, from memory); pattern round 119
// Round:   119
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Drive=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every colour, so one turn comes back to where it began. At 0 the electrons of the upper beam are amber (150, 77, 5 at mid lightness, 255, 166, 102 on a ridge), those of the lower beam azure (10, 107, 149 up to 111, 201, 252) and where the two have mixed, in a hole, orchid (167, 77, 173 up to 244, 148, 249); the hue is 235 degrees for the lower beam, 325 for an even mix and 55 for the upper beam. At 0.25 the beams are green over magenta, at 0.5 azure over amber, at 0.75 magenta over green.
// Knob 2: Flow. Plasma time per second of panel, 1.5 times the knob: 0.75, 3 and 6 time units a second at 0.5, 2 and 4, so one plasma period (2 pi) takes 8.4, 2.1 and 1.05 s. Only the clock moves. Over 400 s at the opening Scale and Drive there are 4.60, 4.61 and 4.67 holes at a time (wells of the potential deeper than 0.02), the field energy per box length is 0.0056, 0.0058 and 0.0059, a well is 13.4, 13.4 and 13.3 columns wide and the dye is mixed in 26.1, 26.2 and 26.6 percent of the dense rows. A frame takes whole steps of at most 0.12: one of 0.025 at 0.5, one of 0.1 at 2 and two of 0.1 at 4.
// Knob 3: Scale. The length of the box in beam speeds over omega_p, 68 times 1.5 to the power of minus the knob: 102, 68 and 45 at -1, 0 and 1, so a column is 1.6, 1.06 and 0.70 of them wide. The fastest-growing wavelength is 10.5 (k = 0.6), so 9.7, 6.5 and 4.3 of them fit across; there are 5.7, 4.6 and 3.3 holes at a time and a well is 10.8, 13.4 and 18.5 columns wide, 17.3, 14.3 and 13.1 in box units. A turn of the knob stretches the box over about a second and the holes follow in a few plasma periods.
// Knob 4: Drive. The rate nu at which every electron is relaxed to the two beams, 0.07 times 2.5 to the knob: 0.028, 0.074 and 0.175 per time unit, so a hole's particles are replaced in 36, 13.5 and 5.7 time units, 12, 4.5 and 1.9 s at Flow 2. At -1 holes live long enough to grow, wind and merge into broad ones (3.8 holes, 16.2 columns wide, 37 percent of the dense rows mixed); at 1 the beams stay nearly whole and the holes are small and brief (4.9 holes, 12.6 columns, 17 percent mixed). The field energy per box length is 0.0035, 0.0058 and 0.0084.

// What the field is. Electrons of mean density 1 in a periodic box of length L on a fixed, uniform background of ions, in units
// where the plasma frequency is 1 and the beams' speed is 1. Their distribution f(x, v, t) obeys
//   f_t + v f_x - E f_v = nu (f0 - f) ,    E_x = 1 - integral of f dv ,
// f0 two Maxwellians of weight 1/2 at v = +-1 and spread 1/3 (24 rows to a unit of velocity, so 8 rows of spread). x is the 64
// columns and v the 128 rows, row 0 the fastest to the right, so the panel is f on its own grid and the velocity runs to +-2.67.
// Two arrays carry it: u, the electrons that began in the upper beam, and l, those of the lower one. Both obey the same equation
// with the same E, so f = u + l and u / f is where a particle came from, and that is the hue.
// One step of dt: half a drift (every row slides along the columns by v dt / 2), the field from the density (a sum over the box's
// harmonics), the kick (every column slides down the rows by E dt), half a drift again, the source. A slide is flux balance:
// each cell hands the part of itself next to its far edge to the next cell, the part read from the cubic through the running sum
// of the density and kept between zero, the whole cell and (the limiter) the two cell values; so it keeps the mass exactly,
// keeps every cell positive and has no wrap across the velocity ends, only round the box. It is fourth order where the density
// is smooth and clips the finest filaments on the grid. The free-streaming equation brings a wave of wavenumber k back after
// 2 pi / (k dv) (134 for the Landau wave below, 250 for k = 0.6) and the grid keeps that: with the source off that wave's field
// is back at 56 percent of its start at 134. At nu 0.028, 0.074 and 0.175 it is back at 0.013, 3e-5 and 5e-11 of it.
// The source relaxes f to f0 at nu everywhere and at up to 1.5 more in the outer six rows at either end (which also keeps the
// far tail of one beam from reaching the other end). Its two beams are not fed evenly along the box: the share of the upper
// beam rides above 1/2 and below it by an amount that wanders in modes 1 to 8 (Ornstein-Uhlenbeck, correlation time 25, rms 0.5
// held under 0.85 by a tanh), with the density, and so the charge, unchanged. Without it the holes settle into a regular lattice
// and recur stays under 0.3 at the small boxes.

// What the checks showed (source, sponge and unevenness off unless said; double precision; linear theory is a root of
// D(k, w) = 1 + sum w_j / (k s_j)^2 (1 + xi_j Z(xi_j)), xi_j = (w / k - c_j) / (s_j sqrt 2), by a secant search in the complex plane,
// Z from the trapezoid sum of exp(-t^2) / (t - xi) with Landau's continuation below the real axis).
// Landau damping. A Maxwellian of spread 1 on this grid (velocity to +-6), a 1e-3 ripple at k = 0.5, 40 time units, field frequency
// from the zero crossings of E and rate from its peaks (17 of them): 1.4161 and -0.1534 at dt 0.1 against 1.4157 and -0.1534 from
// the root (1.4156 and -0.1533 as I remember the tables); the frequency error is 1.4e-3, 4.4e-4 and 1.8e-4 at dt 0.2, 0.1 and 0.05.
// As shipped, with the limiter: 1.4188 and -0.1531. At k = 0.3: -0.0126 against -0.0126 and 1.163 against 1.160.
// Two-stream growth. This f0, a seed of 1e-6 in one wavelength of box, k = 0.3, 0.45, 0.6, 0.75, 0.9, 1.05 and 1.2: the roots give
// 0.2087, 0.2636, 0.2845, 0.2749, 0.2369, 0.1698 and 0.0672 (the best k is 0.62 at 0.2846, the cut-off 1.26), the runs at dt 0.1 give
// 0.2082, 0.2623, 0.2855, 0.2747, 0.2372, 0.1701 and 0.0677, ratios 0.995 to 1.007 (1.026 at k = 1.2 for dt 0.2).
// Conservation, with the limiter off and on. Momentum stays at rounding (1e-15 for the wave, 1e-14 for the saturated two-stream).
// Mass falls only by what leaves through the end rows: 6.5e-10 of it in 60 time units for the wave, 1.2e-5 in 100 for the
// two-stream. The total energy of the wave (alpha 0.05, 9.5 plasma periods) drifts by 3.8e-5, 9.1e-6 and 1.8e-6 at dt 0.2, 0.1 and
// 0.05 without the limiter, a factor 4.2 and 5.0 each time the step halves, so second order; with the limiter it is 9.8e-5, 6.7e-5
// and 5.9e-5, a floor that the clipped filaments set. Through the saturation of the two-stream (T = 100) the energy at the end is
// off by 3.1e-3, 1.7e-3, 8.6e-4 and 6.1e-4 at dt 0.2 to 0.025 without the limiter and by 5e-3 with it, 0.5 percent of the total,
// which the grid takes where a vortex winds finer than a row. Without the limiter the field energy U(60) converges to the dt
// 0.0125 run with errors 1.7e-2, 1.05e-2, 3.3e-3 and 8.4e-4, ratios 1.65, 3.2 and 3.9, so second order.
// A hole's width against the depth of its well. An electron in a well that stands still has v^2 / 2 + phi constant, so the
// separatrix, the orbit that just reaches the top, is sqrt(2 depth) wide on either side at the bottom. One hole in the box
// (k = 0.9 to 0.3, depth 0.58 to 1.3, 910 samples from 40 to 160 time units): the half-width of the part of the column where the
// dye is mixed (u / f between 0.15 and 0.85) is 1.08 to 1.12 times sqrt(2 depth), the beams' own spread adds the rest, and the
// log of it goes against the log of sqrt(2 depth) with slope 0.73 (correlation 0.76; 1 is the root). With the source on,
// 5743 wells over 2500 time units at L = 68, nu 0.074: slope 0.88, correlation 0.61, ratio 1.15, wells that are not standing still scatter.
// Hours through update() at 30 frames a second and Flow 4 (6 time units a second). The opening Scale and Drive for three hours
// (64,800 time units), hour by hour: the field energy of the box 0.400, 0.401 and 0.397 (0.09 spread within an hour), 4.58, 4.61
// and 4.63 holes at a time (spread 0.85 to 0.89), the mean of f along x 47.3, 47.5 and 47.0 percent from f0 in L1 (the beams
// are flattened and the gap between them filled, and it stays so), the largest mean velocity 0.033, 0.045 and 0.044, and the
// smallest u or l 1.5e-28, so never below zero. The mass in twelve ten-minute means over two hours (another seed) stays between
// 0.9987 and 0.9991 with no trend. One hour at Scale and Drive 1: field energy 0.388, 3.95 holes, f 39 percent from f0, mass
// 0.9996; at -1: 0.316, 5.11 holes, 52 percent, mass 0.9932 (the end rows lose more than a slow source gives back). Nothing was
// ever non-finite and the restart in update() was never used.
// What went wrong first. A spectral shift in v with an exponential filter spread the ringing of every sharp filament over the whole
// column, 1e-6 of the peak and as much as the far tails hold, so the dye there was noise, and the velocity ends wrapped: the
// momentum jumped to -5 once a large vortex reached them. The flux-balance slide has neither. A shift of f in x by Fourier
// filters did the same along the rows at the tails (f changes by e^3 between neighbouring columns there): now the same slide.
// With a ripple of a few percent and a uniform feed the box fell into a steady lattice of two or three holes (the field energy
// moved by 0.011 round its mean) and recur, which I first read off a grey copy of the picture, was 0.14 to 0.33 at every box
// length. An uneven feed fixes it (Flow 4, Scale 1, three seeds: 0.26 with a feed of three drifting waves, 0.44 with the
// random one); making the box length and nu drift by three sines made it worse (0.19: the sines come round and so does the
// picture); two bumps of 3 percent at +-2 beam speeds on the tails gave nothing; an unbounded feed went negative and the state
// died (recur 0.06). A three-beam equilibrium is nearly stable (U = 0.01). Dye read from rows where f is under e^-7 of the peak
// is noise, so there the hue goes to the beam's own.

const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, tanh, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables
const NX = 64, NV = 128;
const BEAM = 24; // rows from the middle to each beam
const WID = 8; // rows, the thermal width of a beam
const NM = 8; // how many modes of the box the unevenness of the feed has
const MTAU = 25; // how long it keeps its shape, in plasma time
const DTMAX = 0.12; // longest step of plasma time
const TAU0 = 1.5; // plasma time per second of panel, at Flow 1
const L0 = 68; // box length at Scale 0, in beam speeds over omega_p
const NU0 = 0.07; // relaxation rate at Drive 0
const KNOB = [0, 2, 0, 0.06];

// ---- the plasma. Two arrays, u and l, hold the electrons that started in the upper and in the lower beam, each on nx columns
// (one box length L, periodic) and nv rows of velocity, row 0 the fastest to the right; the index is x * nv + r. Both obey the
// same equation, so f = u + l is the distribution and u / f says where a particle came from. Units: omega_p = 1, the beams sit
// at v = +-1, so dv = 1 / beam.
//   df/dt + v df/dx - E df/dv = nu (f0 - f),     dE/dx = 1 - integral of f dv  (the ions are a fixed uniform background)
function newSim(nx, nv, beam, wid) {
  const A = () => new Float64Array(nx * nv), V = () => new Float64Array(nv), X = () => new Float64Array(nx);
  const S = {
    nx, nv, beam, wid, u: A(), l: A(), u0: V(), l0: V(),
    E: X(), phi: X(), n: X(), mod: X(),
    L: 30, dx: 30 / nx, dv: 1 / beam, nu: 0, modAmp: 0, limit: 1,
    oc: new Float64Array(NM), os: new Float64Array(NM),
    cs: new Float64Array(nx * (nx >> 1)), sn: new Float64Array(nx * (nx >> 1)),
    pad: new Float64Array(nv + 8), flux: new Float64Array(nv + 8), rate: V(), edge: V(),
    time: 0, mass: 1, restarts: 0,
  };
  for (let k = 1; k < nx >> 1; k++)
    for (let i = 0; i < nx; i++) {
      S.cs[k * nx + i] = cos((TAU * k * i) / nx);
      S.sn[k * nx + i] = sin((TAU * k * i) / nx);
    }
  setEquilibrium(S);
  setEdge(S, 6, 1.5);
  return S;
}
// comps: [weight, centre, sigma] in units of the beam speed; a component above zero is tagged upper, the rest lower
function setEquilibrium(S, comps) {
  const { nv, dv, beam } = S;
  const cs = comps || S.comps || [[0.5, 1, S.wid / beam], [0.5, -1, S.wid / beam]];
  S.comps = cs;
  let m = 0;
  for (let r = 0; r < nv; r++) {
    const v = (nv / 2 - 0.5 - r) / beam;
    let up = 0, lo = 0;
    for (const [w, c, sg] of cs) {
      const q = w * exp(-0.5 * ((v - c) / sg) ** 2);
      if (c > 0) up += q;
      else lo += q;
    }
    S.u0[r] = up;
    S.l0[r] = lo;
    m += up + lo;
  }
  for (let r = 0; r < nv; r++) {
    S.u0[r] /= m * dv;
    S.l0[r] /= m * dv;
  }
}
// the extra relaxation rate in the outermost `w` rows at each end, `peak` per unit time at the very last row, falling off as a cosine squared
function setEdge(S, w, peak) {
  for (let r = 0; r < S.nv; r++) {
    const d = min(r, S.nv - 1 - r);
    S.edge[r] = d < w ? peak * cos((0.5 * PI * d) / w) ** 2 : 0;
  }
}

// drift by dt: each row moves along the columns at its own velocity, by the flux balance below with a wrap round the box
function drift(S, dt) {
  const { nx, nv, u, l, dx, dv } = S;
  for (let r = 0; r < nv; r++) {
    const d = ((nv / 2 - 0.5 - r) * dv * dt) / dx;
    pfc(S, u, r, nv, nx, d, true);
    pfc(S, l, r, nv, nx, d, true);
  }
}

// Poisson: dE/dx = 1 - n with the mean of n taken out (the ions are the mean), a sum over the box's harmonics 1 .. nx/2 - 1.
// With n_k = a - i b the field is E = (2 / nx) sum (b cos - a sin) / k and phi, the potential energy of an electron
// (dphi/dx = E), is (2 / nx) sum (a cos + b sin) / k^2, k the wavenumber 2 pi m / L.
function field(S) {
  const { nx, nv, u, l, n, E, phi, dv, cs, sn } = S, h = nx >> 1, k1 = TAU / S.L;
  let mean = 0;
  for (let i = 0; i < nx; i++) {
    let s = 0;
    const o = i * nv;
    for (let r = 0; r < nv; r++) s += u[o + r] + l[o + r];
    n[i] = s * dv;
    mean += n[i];
  }
  S.mass = mean / nx;
  E.fill(0);
  phi.fill(0);
  for (let m = 1; m < h; m++) {
    let a = 0, b = 0;
    const o = m * nx, kk = k1 * m;
    for (let i = 0; i < nx; i++) {
      a += n[i] * cs[o + i];
      b += n[i] * sn[o + i];
    }
    const ce = (2 / nx) / kk, cp = (2 / nx) / (kk * kk);
    for (let i = 0; i < nx; i++) {
      E[i] += ce * (b * cs[o + i] - a * sn[o + i]);
      phi[i] += cp * (a * cs[o + i] + b * sn[o + i]);
    }
  }
}

// What the part of a cell `e` wide next to its edge holds, for e in (0, 1], from the cells a, b, c in a row with b the cell:
// the cubic through the running sum of the density (Filbet, Sonnendruecker and Bertrand, 2001, as I remember it), then kept
// between 0 and the whole cell, and, with `lim`, between e times the two cell values b and c.
function part(a, b, c, e, lim) {
  const e2 = 1 - e * e, A = (e * e2) / 6, C = (e * (2 - e) * (1 - e)) / 6, B = ((2 - e) * e2) / 2 - C;
  let p = b * (1 - B) - a * A + c * C;
  if (lim) {
    const lo = b < c ? b : c, hi = b < c ? c : b;
    p = p < e * lo ? e * lo : p > e * hi ? e * hi : p;
  }
  return p < 0 ? 0 : p > b ? b : p;
}

// Moves n cells of F, F[off + j * stride], on by d cells (d may be negative and larger than one) by flux balance: every cell
// gives the part of itself next to its far edge to the next cell. It keeps the sum, it keeps the cells positive, and with
// `per` the line wraps round, otherwise nothing crosses its two ends.
function pfc(S, F, off, stride, n, d, per) {
  const { pad, flux } = S, P = 4, lim = S.limit;
  for (let j = 0; j < n; j++) pad[P + j] = F[off + j * stride];
  for (let j = 1; j <= P; j++) {
    pad[P - j] = per ? pad[P + n - j] : 0;
    pad[P + n - 1 + j] = per ? pad[P + j - 1] : 0;
  }
  const sg = d >= 0 ? 1 : -1, m = d * sg, k = floor(m), e = m - k;
  // flux[j]: what cell j gives to cell j + sg
  for (let j = -1; j <= n; j++) flux[P + j] = e > 0 ? part(pad[P + j - sg], pad[P + j], pad[P + j + sg], e, lim) : 0;
  for (let r = 0; r < n; r++) {
    let q = r - sg * k;
    if (per) q = ((q % n) + n) % n;
    else if (q < 0 || q >= n) {
      F[off + r * stride] = 0;
      continue;
    }
    F[off + r * stride] = pad[P + q] - flux[P + q] + flux[P + q - sg];
  }
}

// kick by dt: dv/dt = -E, so every column moves down the rows by d = E dt / dv rows
function kick(S, dt) {
  const { nx, nv, E, dv } = S;
  for (let i = 0; i < nx; i++) {
    let d = (E[i] * dt) / dv;
    d = d < -3 ? -3 : d > 3 ? 3 : d;
    pfc(S, S.u, i * nv, 1, nv, d, false);
    pfc(S, S.l, i * nv, 1, nv, d, false);
  }
}

// the source: relax toward the equilibrium at rate nu, and faster in the last rows at either end of the velocity range. The
// share of the upper beam rides above and below a half along the box (mod, set in waves), so the density stays what it was.
function source(S, dt) {
  const { nx, nv, u, l, u0, l0, rate, mod } = S;
  for (let r = 0; r < nv; r++) rate[r] = 1 - exp(-(S.nu + S.edge[r]) * dt);
  for (let i = 0; i < nx; i++) {
    const o = i * nv, am = 0.85 * tanh((S.modAmp * mod[i]) / 0.85);
    for (let r = 0; r < nv; r++) {
      u[o + r] += rate[r] * (u0[r] * (1 + am) - u[o + r]);
      l[o + r] += rate[r] * (l0[r] * (1 - am) - l[o + r]);
    }
  }
}

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}
// the unevenness of the feed along the box: modes 1 .. NM, each a cosine and a sine whose amplitudes wander with a
// correlation time of MTAU (Ornstein-Uhlenbeck), and a variance of one over NM in all
function waves(S, dt) {
  const mod = S.mod, nx = S.nx, a = exp(-dt / MTAU), b = sqrt((1 - a * a) / NM);
  mod.fill(0);
  for (let m = 0; m < NM; m++) {
    S.oc[m] = a * S.oc[m] + b * gauss();
    S.os[m] = a * S.os[m] + b * gauss();
    for (let i = 0; i < nx; i++) {
      const ph = (TAU * (m + 1) * i) / nx;
      mod[i] += S.oc[m] * cos(ph) + S.os[m] * sin(ph);
    }
  }
}
function step(S, dt) {
  waves(S, dt);
  drift(S, 0.5 * dt);
  field(S);
  kick(S, dt);
  drift(S, 0.5 * dt);
  source(S, dt);
  S.time += dt;
}

// a start: the two beams with a ripple in the first modes, random phases; eps is the amplitude of the electric field it makes
function seedRipple(S, eps, mmax) {
  const { nx, nv, u, l, u0, l0 } = S;
  const A = [], P = [];
  for (let m = 1; m <= mmax; m++) {
    A.push(eps * ((TAU * m) / S.L) * (0.5 + Math.random()));
    P.push(TAU * Math.random());
  }
  for (let i = 0; i < nx; i++) {
    let g = 1;
    for (let m = 1; m <= mmax; m++) g += A[m - 1] * cos((TAU * m * i) / nx + P[m - 1]);
    for (let r = 0; r < nv; r++) {
      u[i * nv + r] = u0[r] * g;
      l[i * nv + r] = l0[r] * g;
    }
  }
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
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
// ---- the picture. Two things are read from every LED: q, the share of the density that came from the upper beam (u over f),
// which sets the hue from azure through violet and red to amber, and the lightness, which is built from the density.
const NQ = 64, NLV = 64;
const TMP = [0, 0, 0];
function buildLut(S, shift) {
  const lut = S.lut;
  for (let a = 0; a < NQ; a++) {
    const hd = 235 + 180 * (a / (NQ - 1)) + shift, h = (hd * PI) / 180;
    for (let b = 0; b < NLV; b++) {
      const L = 0.1 + 0.88 * (b / (NLV - 1));
      let C = 0.17;
      for (let it = 0; it < 12; it++) {
        lin(L, C * cos(h), C * sin(h), TMP);
        if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
        C *= 0.92;
      }
      const k = 3 * (a * NLV + b);
      lut[k] = L;
      lut[k + 1] = C * cos(h);
      lut[k + 2] = C * sin(h);
    }
  }
  S.hueDone = shift;
}

// ---- Lab hooks
function knobTargets(k) {
  return [cl(k[1], 0.5, 4), cl(k[2], -1, 1), cl(k[3], -1, 1)];
}
function applyKnobs(S) {
  S.L = L0 * pow(1.5, -S.ks);
  S.dx = S.L / S.nx;
  S.nu = NU0 * pow(2.5, S.kq);
  S.modAmp = 0.5;
}

export function setup(params, knobValues) {
  const S = (params.s = newSim(NX, NV, BEAM, WID));
  const n = NX * NV;
  S.lut = new Float32Array(3 * NQ * NLV);
  S.lf = new Float64Array(n);
  S.lb = new Float64Array(n);
  S.qq = new Float64Array(n);
  S.tt = new Float64Array(n);
  S.fbar = new Float64Array(NV);
  S.sr = new Float64Array(2 * NV);
  S.sh = new Float64Array(2 * NV);
  S.hueDone = -1e9;
  [S.kp, S.ks, S.kq] = knobTargets(knobValues || KNOB);
  applyKnobs(S);
  buildLut(S, 0);
  seedRipple(S, 0.03, 8);
  for (let i = 0; i < 400; i++) step(S, 0.12);
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
  S.kq += (tg[2] - S.kq) * f;
  applyKnobs(S);
  const T = h * TAU0 * S.kp, n = max(1, ceil(T / DTMAX - 1e-6));
  for (let i = 0; i < n; i++) step(S, T / n);
  if (!isFinite(S.mass + S.E[0])) {
    // never reached in the runs below; if a value ever went bad, the plasma starts over from its ripple rather than stay dark
    S.restarts++;
    seedRipple(S, 0.03, 8);
    for (let i = 0; i < 400; i++) step(S, 0.12);
  }
}

// the three terms of the lightness: how the density stands against the row it is in (a hole is below its row, a ridge above),
// its fine structure (against a 3 x 3 blur), and the rim where the origin of the particles changes quickly
const LP = { base: 0.5, mix: 0.07, tail: 0.08, ratio: 0.3, fine: 0.2, rim: 0.25, floor: 0.35 };
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { nx, nv, u, l, lut, fbar, lf, lb, qq, tt } = S, o = [0, 0, 0], mx = nx - 1;
  let fm = 0;
  for (let r = 0; r < nv; r++) if (S.u0[r] + S.l0[r] > fm) fm = S.u0[r] + S.l0[r];
  const lfm = log(fm);
  for (let r = 0; r < nv; r++) {
    let m = 0;
    for (let i = 0; i < nx; i++) m += u[i * nv + r] + l[i * nv + r];
    fbar[r] = m / nx + 1e-300;
  }
  for (let k = 0; k < nx * nv; k++) {
    const f = u[k] + l[k] + 1e-300;
    lf[k] = log(f);
    qq[k] = u[k] / f;
  }
  // blur [1 2 1] across the columns, then down the rows
  for (let x = 0; x < nx; x++) {
    const xm = ((x - 1) & mx) * nv, xp = ((x + 1) & mx) * nv, x0 = x * nv;
    for (let y = 0; y < nv; y++) tt[x0 + y] = 0.25 * lf[xm + y] + 0.5 * lf[x0 + y] + 0.25 * lf[xp + y];
  }
  for (let x = 0; x < nx; x++) {
    const x0 = x * nv;
    for (let y = 0; y < nv; y++) lb[x0 + y] = 0.25 * tt[x0 + (y > 0 ? y - 1 : 0)] + 0.5 * tt[x0 + y] + 0.25 * tt[x0 + (y < nv - 1 ? y + 1 : nv - 1)];
  }
  // how far the density strays from its row, and how much fine structure it has, row by row, so that a faint tail is read as
  // boldly as the beams; the spread of a row is never taken below LP.floor of the whole panel's
  const sr = S.sr, sh = S.sh;
  let ar = 0, ah = 0;
  for (let y = 0; y < nv; y++) {
    const lfb = log(fbar[y]);
    let a = 0, b = 0;
    for (let x = 0; x < nx; x++) {
      const k = x * nv + y, d = lf[k] - lfb, e = lf[k] - lb[k];
      a += d * d;
      b += e * e;
    }
    sr[y] = a / nx;
    sh[y] = b / nx;
    ar += sr[y];
    ah += sh[y];
  }
  ar = sqrt(ar / nv) * LP.floor;
  ah = sqrt(ah / nv) * LP.floor;
  for (let y = 0; y < nv; y++) {
    const y0 = y > 0 ? y - 1 : 0, y1 = y < nv - 1 ? y + 1 : nv - 1;
    sr[y + nv] = 1 / max(sqrt(0.25 * sr[y0] + 0.5 * sr[y] + 0.25 * sr[y1]), ar);
    sh[y + nv] = 1 / max(sqrt(0.25 * sh[y0] + 0.5 * sh[y] + 0.25 * sh[y1]), ah);
  }
  for (let y = 0; y < nv; y++) {
    // far out on the tails the density falls by e^8 or more and the columns can no longer hold its steep ripple (it changes
    // by e^3 between neighbours), so there the fine structure and the rim fade out, the ratio is read from the blurred density and
    // the hue goes to that of the beam the row belongs to
    const lfb = log(fbar[y]), tr = sm(-11, -7, lfb - lfm), gr = 0.9 * sr[y + nv], gh = 1.2 * sh[y + nv] * tr, qp = y < nv / 2 ? 1 : 0;
    for (let x = 0; x < nx; x++) {
      const k = x * nv + y;
      const q = qp + tr * (qq[k] - qp);
      const qx = qq[((x + 1) & mx) * nv + y] - qq[((x - 1) & mx) * nv + y];
      const qy = qq[x * nv + (y < nv - 1 ? y + 1 : y)] - qq[x * nv + (y > 0 ? y - 1 : y)];
      const Lm = LP.base + LP.tail * (1 - tr) + LP.mix * 4 * q * (1 - q) + LP.ratio * tanh(gr * (lb[k] + tr * (lf[k] - lb[k]) - lfb)) + LP.fine * tanh(gh * (lf[k] - lb[k])) + LP.rim * tr * tanh(3 * sqrt(qx * qx + qy * qy));
      const idx = 3 * (((q * (NQ - 1) + 0.5) | 0) * NLV + (((Lm < 0.1 ? 0.1 : Lm > 0.98 ? 0.98 : Lm) - 0.1) * ((NLV - 1) / 0.88) + 0.5 | 0));
      lin(lut[idx], lut[idx + 1], lut[idx + 2], o);
      display.setPixel(x, y, gam(o[0]), gam(o[1]), gam(o[2]));
    }
  }
}
