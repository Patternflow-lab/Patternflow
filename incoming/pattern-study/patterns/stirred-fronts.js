// ===== Patternflow pattern =====
// Title:   Stirred Fronts
// Family:  chemistry
// Idea:    A Belousov-Zhabotinsky style excitable medium rides a chaotic flow that fills the panel, so thin blue-white reaction fronts are drawn into hooks and long filaments over a red ground, fold against each other and annihilate, and the purple wake they leave is pulled into streaks that fade back to red.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The excitable medium of Markus Bar and Markus Eiswirth (1993, with the piecewise source in the recovery variable) carried by a kinematic chaotic flow with a random Fourier stream function (chaotic advection, Hassan Aref 1984; the Batchelor-Kraichnan flow, 1959 and 1968), the setting of the front-in-a-flow studies of Edouard, Pomeau and others (1990s) and of Abel, Cencini, Vulpiani, Neufeld and Tel (2000s), and of the stirred Belousov-Zhabotinsky reactor (Zhabotinsky and Zaikin, 1970s); semi-Lagrangian advection (Courant, Isaacson and Rees 1952, Andre Robert 1981, Jos Stam 1999), Catmull-Rom interpolation (1974), Oklab (Bjorn Ottosson 2020). All names and years from memory.
// Round:   123
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Wake=-1..1
//
// Knob 1: Hue. Turns every colour round the grey axis by the knob times 360 degrees, so one turn comes back; between red and green the dark colours are lifted so that they do not read as brown. At 0 a medium long at rest is orange (214, 107, 17), the ground a few reaction units after a front is crimson (198, 38, 56), purple (144, 3, 81) and then indigo (54, 27, 115) right behind the front, and the fronts are azure (43, 158, 240) with white cores (234, 253, 254). At 0.25 the ground runs from green (58, 148, 50) to mustard (199, 110, 19) under orchid fronts (208, 110, 188), at 0.5 it is teal (24, 133, 177) under orange fronts (211, 129, 13), at 0.75 violet (165, 85, 177) to blue (33, 64, 177) under green fronts (34, 178, 108).
// Knob 2: Flow. The clock of the stirring: 0.35 reaction time units pass in a panel second per unit of Flow, so 0.175, 0.7 and 1.4 a second at 0.5, 2 and 4. The flow's rms speed is 6 LED per unit, which is 1.05, 4.2 and 8.4 LED a second, and a bare front runs 2.1 LED per unit (1.5 LED a second at the opening, a third of the flow's rms speed). The picture is the same at every Flow and only goes faster: the share of the panel with u above 0.5 averages 0.147, 0.151 and 0.155 at 0.5, 2 and 4. A small separation grows at the Lyapunov exponent 0.21 per unit at Scale 0, which is 0.037, 0.15 and 0.29 per second, doubling in 3.3 units, 4.7 s at the opening. The velocity at a point is as good as forgotten after 2 units (autocorrelation 0.50 at 1 and 0.16 at 2).
// Knob 3: Scale. Where the spectrum of the stream function peaks, k0, in waves across the 64 LEDs: 1.5 at -1 (a wave is 42.7 LEDs), 2.4 at 0 (26.7) and 5.0 at 1 (12.7), with the same 36 modes' worth at every setting. The speed is 6 LED per unit at all three, so the stretching goes with k0: Lyapunov exponent 0.144, 0.210 and 0.501 per unit. The medium does not change, so the fronts stay as thick (10 to 90 percent in 1.9 to 2.6 LED at -1, 1.9 to 2.9 at 0 and 2.0 to 3.3 at 1, first to third quartile) and a row of 64 LEDs crosses 3.95, 4.01 and 3.62 pulses. What changes is how the flow bends them: longer hooks and S-curves at -1, shorter strokes and small knots at 1.
// Knob 4: Wake. How fast the recovery variable v relaxes, gam = 0.95 times 1.6 to the minus knob per reaction unit: 1.52 at -1, 0.95 at 0 and 0.59 at 1, so v falls by a factor e in 0.66, 1.05 and 1.7 units, which behind a bare front is 1.4, 2.2 and 3.6 LED. A short wake lets the medium fire again at once, so at -1 the share of the panel with u above 0.5 is 0.284 (0.19 to 0.38 over 100 s), a row crosses 5.2 pulses and they are 3.5 LED wide; at 1 it is 0.083 (0.03 to 0.15), 2.6 pulses of 2.0 LED, and the purple streaks behind them are longer than the fronts.

// What the field is. Two fields on the panel's 64 by 128 torus, u, which fires, and v, which follows u and holds the medium back
// (it is refractory), both carried by a flow w that is prescribed and never solved for:
//   u_t + w . grad u = Dl lap u + u (1 - u) (u - (v + b) / a) / eps,
//   v_t + w . grad v = kup g(u) - gam v,    g = 0 for u < 1/3,  1 - 6.75 u (u - 1)^2 for 1/3 <= u <= 1,  1 above.
// a = 0.84 and b = 0.1 are Spiral Breakup's numbers, known to give a medium that lives on this torus, and the source of v is
// the piecewise g of Bar and Eiswirth because Barkley's own v_t = u - v does not spread at eps 0.07 (Spiral Breakup found
// the same). Length is in LEDs, time in reaction units. Spiral Breakup has Dl 1.5625 and eps 0.085. Here Dl is 0.9 and
// eps 0.049: Dl / eps is kept, so a bare front runs at the same sqrt(Dl / (2 eps)) (1 - 2 b / a) = 2.31 LED per unit, and
// the front is 0.64 of the thickness, 1.3 LED from 10 to 90 percent (4.4 sqrt(2 Dl eps)) where it was 2.3. kup is 1.8
// where the model has 1: v climbs faster, u falls back sooner, and a pulse is a line 2.4 LED wide (mean width of u above 0.5
// along x) and not a band 4 or 5 wide. The wake behind the line is where the area is. gam is the Wake knob.
//
// What keeps it alive. In an ordinary run nothing is added: the flow pulls a front into a long hook, the hook sheds tips as the
// spirals of Spiral Breakup do, tips meet and annihilate, and new ones are born in the folds faster than the old ones die. The
// share of the panel with u above 0.5 stays between 0.03 and 0.38 over 100 s at every knob setting tried. A net sits under
// that. When under 3 percent of the panel is excited, a disc of u = 1, 2.6 LED in radius, is set at rest where the strain
// is gentlest of eight tries (a disc in a strong strain is pulled thin before it can send a ring out), at up to 4.2 a
// reaction unit, and at 0.2 a unit when more is excited. It needs a patch of 19 by 19 cells with u under 0.04 and v under
// 0.12, so a medium still full of wake gets none. It fired 0 to 3 times in 100 s at the seven settings tried, and 8 times with every knob at its maximum. From a medium with u and v
// set to 0 everywhere it took 11 discs and under 10 s to be back at 0.17, 21 at Scale 1 and Wake 1 and 30 at Flow 4.
//
// The flow. w = (psi_y, -psi_x) with psi a sum of 36 cosines a_k cos(k . x + phi_k) on the integer wavenumbers of the torus,
// so it is incompressible and periodic by construction. The weights are exp(-(ln(q / k0))^2 / (2 0.32^2)) times a random gain
// of 0.75 to 1.25 with the 37th largest taken off all of them, so that exactly 36 stay and the set changes smoothly with k0;
// a_k goes as weight / q, so the velocity amplitudes follow the weights and the rms speed is a number we set, 6 LED per unit.
// The phase is the integral of omega_k = (2 pi / 64) q 6 s_k, s_k drawn from plus or minus 0.15 to 0.75, plus an
// Ornstein-Uhlenbeck process of rms 1.2 rad and correlation time 2.5 units: 36 unrelated frequencies and a random part. One
// inverse FFT gives w on the grid once a frame. It is the flow of Ramp and Cliff, and the code is that file's, but here it
// carries a medium that reacts and not a scalar with a mean gradient.
//
// The grid. u and v live on 128 by 256 cells, half an LED each. A step traces back to the middle of the path with the flow at
// that point, traces the foot, and takes u and v from the foot with one clamped Catmull-Rom cubic. Then the reaction goes in
// explicit Euler steps of up to 0.03 units (the bounds are 0.04 for the laplacian and about 0.1 for the stiff term). A frame
// is one to a few advection steps of at most 1.5 cells, each followed by the reaction steps that fit. setup runs the medium
// before the first frame: 10 half discs on a 64 by 128 grid with the thicker medium (a front 1.3 cells thick crawls at 73
// percent of its speed on the coarse grid, the thick one at 86) for at least 30 units and until over 3 percent is excited, interpolated
// up, then 5 units on the fine grid with the true medium. That is 0.7 s in Node. A frame is 3.2 ms of update at the opening
// and 4.1 to 5.9 ms for update and draw in flowcheck, on a machine with other jobs.
//
// Checks, each run on this file with its internals exported (Node, a seeded Math.random).
// 1. A planar front against theory. For v held at 0 the cubic is the Nagumo equation and a front runs at 2.309 LED per unit. A
//    band on the fine grid grows at 2.105 at h = 0.03 (91.2 percent), 2.142 at 0.015 (92.8) and 2.046 at 0.05 (88.6). At v = 0.2
//    theory gives 0.866 and the grid 0.783 (90.4). On the coarse grid the thick medium gives 1.988 (86.1) at h = 0.09 and the
//    thin one 1.692 (73.3). The deficit is the lattice more than the step, so the panel's fronts run 9 percent slow.
// 2. Carrying. A Gaussian of sigma 3 LED carried 18 LED in 25 and 51 steps (1.44 and 0.7 cells a step) keeps its peak at 0.989
//    and 0.982 with sigma 3.002 and 3.004; sigma 1.5 LED keeps 0.946 and 0.920 with sigma 1.508 and 1.519. The cubic is clamped
//    to the four cells round the foot and does not conserve the sum.
// 3. The flow. The rms speed on the grid is 6.00 LED per unit at all three Scale settings, and the divergence by central
//    differences is 2.8e-4, 5.5e-4 and 2.0e-3 of |grad w| at k0 1.5, 2.4 and 5.04. The largest Lyapunov exponent of the exact
//    flow (two particles 1e-3 LED apart, renormalised every half unit for 400, RK2, one seed each) is 0.144, 0.210 and 0.501 per
//    unit. The velocity autocorrelation at 64 points over 2000 units is 0.73 at a lag of 0.5, 0.50 at 1, 0.16 at 2, 0.03 at 5 and
//    -0.13 at 10, and its largest magnitude for lags of 50 to 1750 is 0.13.
// 4. Front thickness as the picture has it. The 10 to 90 percent width of the leading edges (cells with u from 0.45 to 0.55 and v
//    under 0.1, taken as 1.1 / |grad u|, exact for the tanh profile), quartiles averaged over 100 samples: 1.9, 2.2 and 2.9 LED
//    at the opening, 1.8, 2.0 and 2.5 at Wake -1, 2.0, 2.4 and 3.2 at Wake 1. The equation's own is 1.3, so the flow and the
//    half-LED grid thicken the median by 1.7.
// 5. The share of the panel with u above 0.5 over 100 s, mean (lowest to highest): opening 0.151 (0.105 to 0.201), Scale -1
//    0.152 (0.099 to 0.199), Scale 1 0.139 (0.079 to 0.200), Wake -1 0.284 (0.187 to 0.381), Wake 1 0.083 (0.031 to 0.154), Flow
//    0.5 0.147 (0.092 to 0.211), Flow 4 0.155 (0.068 to 0.216). u and v stay in [0, 1] by the clamps in the reaction step.
// The flowcheck of this study. 240 s at the opening, with every knob at its minimum, at its maximum and at three random
// positions: recur 0.567 to 0.786, dim 0.943 to 0.994, quiet 0.804 to 0.920, drift 0.0 to 0.8 percent; the last quarter dim
// 0.933 to 0.988, quiet 0.522 to 0.886. Worst for recur is every knob at its maximum (0.567, last quarter 0.714), worst for quiet
// every knob at its minimum (0.804, last quarter 0.522).
// 900 s at the opening: recur 0.681, dim 0.991, quiet 0.960, the last quarter 0.709, 0.984 and 0.914 (recur, dim, quiet),
// drift 0.2 percent; every knob at its minimum 0.711, 0.979, 0.889 and 0.799, 0.953, 0.794, drift 0.1; every knob at its maximum
// 0.569, 0.996, 0.952 and 0.652, 0.990, 0.922, drift 0.1. The share of the panel with u above 0.5 over those 900 s, mean (lowest
// to highest) and the discs of the net: 0.149 (0.065 to 0.232) and 7 at the opening, 0.280 (0.142 to 0.386) and 0 at the minimum,
// 0.071 (0.016 to 0.142) and 70 at the maximum, where the flow is fastest, the eddies smallest and the wake longest.
//
// Not checked. A grid finer than 128 by 256, so I do not know how much of the thickness is the grid's. A step under 0.015. A
// pseudo-spectral reference. Any statistic of the tips, and whether the breakup in a flow is the one in Spiral Breakup. The front
// speed in a strong flow against the literature, which I remember only as a speed-up in a moderate flow and a quench in a strong
// one. The numbers in the knob lines come from one seed. Hue 0.24 is the brightest setting (mean luma 150 against 70 to 100
// elsewhere), because the lift for dark yellows puts a mustard ground under it.
//
// What the picture adds. All of it is the picture's choice and none of it is in the equations. A cell's colour is a function of
// (u, v) from a 33 by 65 table in Oklab, read bilinearly after u and v are averaged over the four cells of an LED. The wake
// follows s = log(1 + v / 2e-5) / log(50001), so that the tail of v, which dies as exp(-gam t) and is drawn into streaks by
// the flow, stays in sight for 12 units and not 5: orange at rest, then red and crimson, purple and indigo at the front. The
// front follows u (a smoothstep from 0.15 to 0.55) and goes through azure to white. The ramps are interpolated in the (a, b)
// plane and never in hue, and the Hue knob turns that plane.

const W = 64, H = 128;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const CFG = {
  gw: 128, // sim grid: 128 x 256 cells, half an LED each
  gh: 256,
  // the medium (Bar-Eiswirth), lengths in LEDs, time in reaction units
  a: 0.84,
  b: 0.1,
  eps: 0.049, // time scale of u
  Dl: 0.9, // diffusivity of u, LED^2 per reaction unit
  epsC: 0.085, // the same two for the run-up on the coarse grid, where a front has to be 3 LEDs thick to be seen
  DlC: 1.5625,
  hrd: 0.03, // reaction substep
  tps: 0.35, // reaction units per panel second per unit of Flow
  // the flow
  urms: 6, // LEDs per reaction unit
  nmodes: 36,
  sig: 0.32,
  smin: 0.15,
  smax: 0.75,
  ouT: 2.5, // reaction units
  ouS: 1.2,
  // ignition
  ign0: 0.2, // ignitions per reaction unit over the panel, always
  ign1: 4, // and this many more when nothing is excited
  actMin: 0.03, // share of the panel with u above 0.5 at which the extra ignitions stop
  igR: 2.6, // LEDs
  // wake
  gam0: 0.95, // v decay rate at Wake 0
  kup: 1.8, // v rise rate
  pre: 30, // run-up on the coarse grid, reaction units
  pre2: 5, // and on the fine grid
};

// ---- Fourier transforms (as cellular-flame.js) ---------------------------------------------
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

// ---- the grid -----------------------------------------------------------------------------
function makeGrid(gw, gh) {
  const n = gw * gh;
  return {
    gw, gh, n, mx: gw - 1, my: gh - 1, sc: gw / W,
    Tx: table(gw), Ty: table(gh),
    re: new Float64Array(n), im: new Float64Array(n),
    cr: new Float64Array(gh), ci: new Float64Array(gh), cols: new Uint8Array(gw),
    U: new Float32Array(n), V: new Float32Array(n),
    u: new Float32Array(n), v: new Float32Array(n), u2: new Float32Array(n), v2: new Float32Array(n),
    umax: 0,
  };
}

// ---- the flow ------------------------------------------------------------------------------
const LIB = [];
for (let m = -12; m <= 12; m++)
  for (let n = 0; n <= 24; n++) {
    if (n === 0 && m <= 0) continue;
    const q = sqrt(m * m + (n * n) / 4);
    if (q >= 0.9 && q <= 11.5) LIB.push({ m, n, q });
  }
const NL = LIB.length;

function randn() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function makeFlow() {
  const F = {
    g: new Float64Array(NL), s: new Float64Array(NL), ph: new Float64Array(NL), xi: new Float64Array(NL),
    w: new Float64Array(NL), k0: -1, norm: 1, tmp: new Float64Array(NL),
  };
  for (let i = 0; i < NL; i++) {
    F.g[i] = 0.75 + 0.5 * Math.random();
    F.s[i] = (CFG.smin + (CFG.smax - CFG.smin) * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    F.ph[i] = TAU * Math.random();
    F.xi[i] = CFG.ouS * randn();
  }
  return F;
}

function weights(F, k0) {
  const { w, tmp, g } = F;
  for (let i = 0; i < NL; i++) {
    const r = log(LIB[i].q / k0) / CFG.sig;
    w[i] = exp(-0.5 * r * r) * g[i];
    tmp[i] = w[i];
  }
  tmp.sort();
  const cap = tmp[NL - 1 - CFG.nmodes];
  let s2 = 0;
  for (let i = 0; i < NL; i++) {
    w[i] = max(0, w[i] - cap);
    s2 += w[i] * w[i];
  }
  F.norm = 1 / sqrt(0.5 * s2);
  F.k0 = k0;
}

function flowStep(F, h) {
  const f = exp(-h / CFG.ouT), n = CFG.ouS * sqrt(1 - f * f);
  for (let i = 0; i < NL; i++) {
    if (F.w[i] === 0) continue;
    F.ph[i] += h * (TAU / W) * LIB[i].q * CFG.urms * F.s[i];
    F.xi[i] = F.xi[i] * f + n * randn();
  }
}

// The flow on the grid in cells per reaction unit: u = (psi_y, -psi_x) as the real and imaginary part of one transform.
function synth(g, F) {
  const { re, im, gw, gh, mx, my, sc, Tx, Ty, cr, ci, cols } = g;
  re.fill(0);
  im.fill(0);
  cols.fill(0);
  const norm = (F.norm * CFG.urms) / (TAU / W);
  for (let i = 0; i < NL; i++) {
    const wgt = F.w[i];
    if (wgt === 0) continue;
    const { m, n, q } = LIB[i];
    const kx = (TAU * m) / W, ky = (TAU * n) / H;
    const a = (norm * wgt) / q;
    const c = 0.5 * a * sc;
    const ph = F.ph[i] + F.xi[i], cp = cos(ph), sp = sin(ph);
    const p1 = (n & my) * gw + (m & mx), p2 = (-n & my) * gw + (-m & mx);
    re[p1] += c * (kx * cp - ky * sp);
    im[p1] += c * (kx * sp + ky * cp);
    re[p2] -= c * (kx * cp + ky * sp);
    im[p2] -= c * (ky * cp - kx * sp);
    cols[m & mx] = cols[-m & mx] = 1;
  }
  for (let j = 0; j < gw; j++) {
    if (!cols[j]) continue;
    for (let i = 0, p = j; i < gh; i++, p += gw) {
      cr[i] = re[p];
      ci[i] = im[p];
    }
    fft1(ci, cr, 0, Ty);
    for (let i = 0, p = j; i < gh; i++, p += gw) {
      re[p] = cr[i];
      im[p] = ci[i];
    }
  }
  const U = g.U, V = g.V;
  let um = 0;
  for (let i = 0; i < gh; i++) {
    fft1(im, re, i * gw, Tx);
    for (let j = 0, p = i * gw; j < gw; j++, p++) {
      const u = re[p], v = im[p];
      U[p] = u;
      V[p] = v;
      const s = u * u + v * v;
      if (s > um) um = s;
    }
  }
  g.umax = sqrt(um);
}

// ---- advection: semi-Lagrangian, midpoint trace, clamped Catmull-Rom, u and v from the same foot ----
function advect(g, h) {
  const { gw, gh, mx, my, U, V, u, v, u2, v2 } = g;
  const hh = 0.5 * h;
  for (let i = 0; i < gh; i++) {
    for (let j = 0, p = i * gw; j < gw; j++, p++) {
      let x = j - hh * U[p], y = i - hh * V[p];
      let ix = floor(x), iy = floor(y), tx = x - ix, ty = y - iy;
      const c0 = ix & mx, c1 = (ix + 1) & mx, r0 = (iy & my) * gw, r1 = ((iy + 1) & my) * gw;
      const um = (U[r0 + c0] * (1 - tx) + U[r0 + c1] * tx) * (1 - ty) + (U[r1 + c0] * (1 - tx) + U[r1 + c1] * tx) * ty;
      const vm = (V[r0 + c0] * (1 - tx) + V[r0 + c1] * tx) * (1 - ty) + (V[r1 + c0] * (1 - tx) + V[r1 + c1] * tx) * ty;
      x = j - h * um;
      y = i - h * vm;
      ix = floor(x);
      iy = floor(y);
      tx = x - ix;
      ty = y - iy;
      const t2 = tx * tx, t3 = t2 * tx, s2 = ty * ty, s3 = s2 * ty;
      const w0 = -0.5 * t3 + t2 - 0.5 * tx, w1 = 1.5 * t3 - 2.5 * t2 + 1, w2 = -1.5 * t3 + 2 * t2 + 0.5 * tx, w3 = 0.5 * t3 - 0.5 * t2;
      const z0 = -0.5 * s3 + s2 - 0.5 * ty, z1 = 1.5 * s3 - 2.5 * s2 + 1, z2 = -1.5 * s3 + 2 * s2 + 0.5 * ty, z3 = 0.5 * s3 - 0.5 * s2;
      const k0 = (ix - 1) & mx, k1 = ix & mx, k2 = (ix + 1) & mx, k3 = (ix + 2) & mx;
      const q0 = ((iy - 1) & my) * gw, q1 = (iy & my) * gw, q2 = ((iy + 1) & my) * gw, q3 = ((iy + 2) & my) * gw;
      let va = z0 * (w0 * u[q0 + k0] + w1 * u[q0 + k1] + w2 * u[q0 + k2] + w3 * u[q0 + k3]) +
        z1 * (w0 * u[q1 + k0] + w1 * u[q1 + k1] + w2 * u[q1 + k2] + w3 * u[q1 + k3]) +
        z2 * (w0 * u[q2 + k0] + w1 * u[q2 + k1] + w2 * u[q2 + k2] + w3 * u[q2 + k3]) +
        z3 * (w0 * u[q3 + k0] + w1 * u[q3 + k1] + w2 * u[q3 + k2] + w3 * u[q3 + k3]);
      let vb = z0 * (w0 * v[q0 + k0] + w1 * v[q0 + k1] + w2 * v[q0 + k2] + w3 * v[q0 + k3]) +
        z1 * (w0 * v[q1 + k0] + w1 * v[q1 + k1] + w2 * v[q1 + k2] + w3 * v[q1 + k3]) +
        z2 * (w0 * v[q2 + k0] + w1 * v[q2 + k1] + w2 * v[q2 + k2] + w3 * v[q2 + k3]) +
        z3 * (w0 * v[q3 + k0] + w1 * v[q3 + k1] + w2 * v[q3 + k2] + w3 * v[q3 + k3]);
      let a1 = u[q1 + k1], a2 = u[q1 + k2], a3 = u[q2 + k1], a4 = u[q2 + k2];
      const lo = min(a1, a2, a3, a4), hi = max(a1, a2, a3, a4);
      va = va < lo ? lo : va > hi ? hi : va;
      a1 = v[q1 + k1];
      a2 = v[q1 + k2];
      a3 = v[q2 + k1];
      a4 = v[q2 + k2];
      const lo2 = min(a1, a2, a3, a4), hi2 = max(a1, a2, a3, a4);
      vb = vb < lo2 ? lo2 : vb > hi2 ? hi2 : vb;
      u2[p] = va;
      v2[p] = vb;
    }
  }
  g.u = u2;
  g.u2 = u;
  g.v = v2;
  g.v2 = v;
}

// ---- reaction and diffusion, explicit Euler ----------------------------------------------------
//   u_t = Dl lap u + u (1 - u) (u - (v + b) / a) / eps,   v_t = g(u) - gam v
function react(g, h, gam, Dl, eps) {
  const { gw, gh, mx, my, u, v, u2, v2, sc } = g;
  const ia = 1 / CFG.a, b = CFG.b, dte = h / eps, kup = CFG.kup;
  // lengths here are in cells: lap in cell units, D in cell^2 = Dl * sc^2
  const Dc = Dl * sc * sc * h;
  for (let i = 0; i < gh; i++) {
    const up = ((i - 1) & my) * gw, md = i * gw, dn = ((i + 1) & my) * gw;
    for (let j = 0; j < gw; j++) {
      const p = md + j;
      const c = u[p], vv = v[p];
      const l = md + ((j - 1) & mx), r = md + ((j + 1) & mx);
      let nu = c + Dc * (u[l] + u[r] + u[up + j] + u[dn + j] - 4 * c) + dte * c * (1 - c) * (c - (vv + b) * ia);
      const gg = c < 0.3333333333 ? 0 : c > 1 ? 1 : 1 - 6.75 * c * (c - 1) * (c - 1);
      let nv = vv + h * (kup * gg - gam * vv);
      u2[p] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
      v2[p] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
    }
  }
  g.u = u2;
  g.u2 = u;
  g.v = v2;
  g.v2 = v;
}

// ---- ignition ------------------------------------------------------------------------------
function ignite(g, cx, cy, r) {
  const { gw, gh, mx, my, u } = g;
  const rc = r * g.sc, r2 = rc * rc;
  for (let dy = -ceil(rc); dy <= ceil(rc); dy++)
    for (let dx = -ceil(rc); dx <= ceil(rc); dx++) {
      if (dx * dx + dy * dy > r2) continue;
      u[(((cy + dy) & my) * gw) + ((cx + dx) & mx)] = 1;
    }
}

// New fronts. A disc of u = 1 goes where the medium is at rest and the stirring is gentlest (the least strain of eight tries),
// since a disc in a strong strain is pulled thin before it can send a ring out.
function strainAt(g, x, y) {
  const { gw, mx, my, U, V } = g;
  const p = y * gw + x, l = y * gw + ((x - 1) & mx), r = y * gw + ((x + 1) & mx), u = ((y - 1) & my) * gw + x, d = ((y + 1) & my) * gw + x;
  const a = U[r] - U[l] - (V[d] - V[u]), b = U[d] - U[u] + (V[r] - V[l]);
  return a * a + b * b;
}

function nucleate(S, dtT, g) {
  S.ignAcc += (CFG.ign0 + CFG.ign1 * cl(1 - S.act / CFG.actMin, 0, 1)) * dtT;
  const R = ceil(CFG.igR * g.sc * 1.6);
  while (S.ignAcc >= 1) {
    S.ignAcc -= 1;
    let bx = -1, by = 0, bs = 1e30;
    for (let tries = 0; tries < 8; tries++) {
      const x = floor(Math.random() * g.gw), y = floor(Math.random() * g.gh);
      let ok = true;
      for (let dy = -R; dy <= R && ok; dy += 2)
        for (let dx = -R; dx <= R; dx += 2) {
          const p = (((y + dy) & g.my) * g.gw) + ((x + dx) & g.mx);
          if (g.u[p] > 0.04 || g.v[p] > 0.12) {
            ok = false;
            break;
          }
        }
      if (!ok) continue;
      const st = strainAt(g, x, y);
      if (st < bs) {
        bs = st;
        bx = x;
        by = y;
      }
    }
    if (bx >= 0) {
      ignite(g, bx, by, CFG.igR);
      S.ign++;
    }
  }
}

// ---- state and frame -----------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const k0Of = (s) => 2.4 * pow(s < 0 ? 1.6 : 2.1, cl(s, -1, 1));
const gamOf = (k) => CFG.gam0 * pow(1.6, -cl(k, -1, 1));

function frame(S, dtT, cfl, hmax) {
  const g = S.g, F = S.F;
  flowStep(F, dtT / 2);
  synth(g, F);
  const nA = max(1, ceil((dtT * g.umax) / cfl));
  const ha = dtT / nA, mR = max(1, ceil(ha / hmax)), hr = ha / mR;
  for (let i = 0; i < nA; i++) {
    advect(g, ha);
    for (let j = 0; j < mR; j++) react(g, hr, S.gam, S.Dl, S.eps);
  }
  flowStep(F, dtT / 2);
}

function cubic(t, w) {
  const t2 = t * t, t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t;
  w[1] = 1.5 * t3 - 2.5 * t2 + 1;
  w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  w[3] = 0.5 * t3 - 0.5 * t2;
}

function upsample(gc, g) {
  const cw = gc.gw, kk = g.gw / cw, wx = [0, 0, 0, 0], wy = [0, 0, 0, 0];
  for (let i = 0; i < g.gh; i++)
    for (let j = 0; j < g.gw; j++) {
      const x = j / kk, y = i / kk, ix = floor(x), iy = floor(y);
      cubic(x - ix, wx);
      cubic(y - iy, wy);
      let a = 0, b = 0;
      for (let r = 0; r < 4; r++) {
        const row = ((iy - 1 + r) & gc.my) * cw;
        for (let c = 0; c < 4; c++) {
          const w = wx[c] * wy[r], q = row + ((ix - 1 + c) & gc.mx);
          a += w * gc.u[q];
          b += w * gc.v[q];
        }
      }
      g.u[i * g.gw + j] = cl(a, 0, 1);
      g.v[i * g.gw + j] = cl(b, 0, 1);
    }
}

// Half discs: u = 1 on one half and v = 0.6 on the other, at random places and turns; each is a broken wave and curls into a spiral pair.
function seedHalfDiscs(g, count) {
  const { gw, gh, u, v } = g;
  for (let k = 0; k < count; k++) {
    const cx = Math.random() * gw, cy = Math.random() * gh, ang = Math.random() * TAU;
    const rr = (7.5 * (0.6 + 0.8 * Math.random()) * g.sc);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        let dx = x - cx, dy = y - cy;
        dx -= gw * Math.round(dx / gw);
        dy -= gh * Math.round(dy / gh);
        if (dx * dx + dy * dy < rr * rr) {
          if (dx * cos(ang) + dy * sin(ang) > 0) u[y * gw + x] = 1;
          else v[y * gw + x] = 0.6;
        }
      }
  }
}

// Share of the panel with u above 0.5, sampled every third cell.
function share(g) {
  const u = g.u;
  let c = 0;
  for (let i = 0; i < g.n; i += 3) if (u[i] > 0.5) c++;
  return c / (g.n / 3);
}

function start(params, k) {
  const g = makeGrid(CFG.gw, CFG.gh), gc = makeGrid(CFG.gw / 2, CFG.gh / 2);
  const F = makeFlow();
  const S = { g, F, k0: k0Of(k[2]), gam: gamOf(k[3]), hue: 0, ignAcc: 0, ign: 0, act: 0, lut: null, lutHue: -9, Dl: CFG.Dl, eps: CFG.eps };
  params.s = S;
  weights(F, S.k0);
  // The run-up has two parts. On the coarse grid, one cell to an LED and fronts 3 LEDs thick: half discs for the first spirals, then
  // the flow and the medium together until the share excited is over actMin (at least CFG.pre reaction units). Then the fields go
  // up to the fine grid and run CFG.pre2 more with the true medium, whose fronts are thinner than a coarse cell resolves.
  seedHalfDiscs(gc, 10);
  const S2 = { g: gc, F, gam: S.gam, ignAcc: 0, ign: 0, act: 0.1, Dl: CFG.DlC, eps: CFG.epsC };
  const st = 0.12;
  for (let t = 0; t < CFG.pre * 2.5; t += st) {
    frame(S2, st, 2.2, 0.09);
    S2.act = share(gc);
    nucleate(S2, st, gc);
    if (t >= CFG.pre && S2.act > CFG.actMin) break;
  }
  upsample(gc, g);
  for (let t = 0; t < CFG.pre2; t += 0.1) frame(S, 0.1, 3, 0.05);
  S.act = share(g);
}

export function setup(params) {
  start(params, OPEN);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.5, 4);
  const f = 1 - exp(-ft / 0.4);
  S.k0 += (k0Of(k[2]) - S.k0) * f;
  if (abs(S.k0 - S.F.k0) > 0.003) weights(S.F, S.k0);
  S.gam += (gamOf(k[3]) - S.gam) * f;
  S.hue = k[0];
  const dtT = ft * flow * CFG.tps;
  frame(S, dtT, 1.5, CFG.hrd);
  nucleate(S, dtT, S.g);
  S.act = share(S.g);
  // Never reached in the runs in the header. If the fields ever went bad, start over.
  if (!isFinite(S.g.u[0] + S.g.v[S.g.n >> 1] + S.act)) start(params, k);
}

// ---- colour ---------------------------------------------------------------------------------
function okRgb(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r;
      out[1] = g;
      out[2] = bb;
      return;
    }
  }
}
const enc = (v) => {
  v = cl(v, 0, 1);
  return ((v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0;
};
const RGB = [0, 0, 0];
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// The wake, by s = log(1 + v / 0.00002) / log(50001): [s, L, C, h] in Oklab, from the medium at rest to the freshest wake.
const WAKE = [
  [0, 0.58, 0.16, 52],
  [0.3, 0.54, 0.19, 32],
  [0.6, 0.48, 0.2, 14],
  [0.8, 0.41, 0.18, 350],
  [0.92, 0.35, 0.16, 320],
  [1, 0.32, 0.14, 290],
];
// The front, by u: [u, L, C, h]. It takes the place of the wake as u climbs through 0.15 to 0.55.
const FRONT = [
  [0, 0.5, 0.18, 280],
  [0.5, 0.68, 0.17, 245],
  [0.8, 0.9, 0.07, 220],
  [1, 0.98, 0.02, 200],
];
const NU = 33, NV = 65, VF = 0.00002;
const SVN = 1 / log(1 + 1 / VF);
const svOf = (v) => log(1 + v / VF) * SVN;
const ab = (c) => [c[1] * cos((c[2] * PI) / 180), c[1] * sin((c[2] * PI) / 180)]; // [L, C, h] to Oklab (a, b)
const WAB = WAKE.map((c) => ab(c.slice(1))), FAB = FRONT.map((c) => ab(c.slice(1)));
const ramp = (T, TAB, x) => {
  let j = 1;
  while (j < T.length - 1 && x > T[j][0]) j++;
  const t = cl((x - T[j - 1][0]) / (T[j][0] - T[j - 1][0]), 0, 1);
  return [T[j - 1][1] + (T[j][1] - T[j - 1][1]) * t, TAB[j - 1][0] + (TAB[j][0] - TAB[j - 1][0]) * t, TAB[j - 1][1] + (TAB[j][1] - TAB[j - 1][1]) * t];
};

function buildLut(S, hue) {
  if (!S.lut) S.lut = new Uint8Array(NU * NV * 3);
  S.lutHue = hue;
  const rot = hue * TAU, cr = cos(rot), sr = sin(rot);
  for (let iv = 0; iv < NV; iv++) {
    const wk = ramp(WAKE, WAB, iv / (NV - 1));
    for (let iu = 0; iu < NU; iu++) {
      const u = iu / (NU - 1), fr = ramp(FRONT, FAB, u), m = sm(0.15, 0.55, u);
      const L = wk[0] + (fr[0] - wk[0]) * m, aa = wk[1] + (fr[1] - wk[1]) * m, bb = wk[2] + (fr[2] - wk[2]) * m;
      // turn (a, b) round the grey axis by the Hue knob
      const ra = aa * cr - bb * sr, rb = aa * sr + bb * cr, h = (Math.atan2(rb, ra) * 180) / PI;
      // A dark orange or olive is brown on the panel: between red and green the dark colours are lifted.
      const Ll = L + max(0, 1 - abs(((h - 80 + 540) % 360) - 180) / 70) * max(0, 0.66 - L) * 1.3;
      okRgb(Ll, sqrt(ra * ra + rb * rb), h, RGB);
      const o = (iv * NU + iu) * 3;
      S.lut[o] = enc(RGB[0]);
      S.lut[o + 1] = enc(RGB[1]);
      S.lut[o + 2] = enc(RGB[2]);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.hue, 0, 1);
  if (abs(S.lutHue - hue) > 0.001) buildLut(S, hue);
  const g = S.g, { gw, u, v } = g, lut = S.lut;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = 2 * y * gw + 2 * x;
      const uu = (u[p] + u[p + 1] + u[p + gw] + u[p + gw + 1]) * 0.25;
      const vv = (v[p] + v[p + 1] + v[p + gw] + v[p + gw + 1]) * 0.25;
      const fu = cl(uu, 0, 1) * (NU - 1), fv = svOf(cl(vv, 0, 1)) * (NV - 1);
      const iu = min(NU - 2, fu | 0), iv = min(NV - 2, fv | 0), tu = fu - iu, tv = fv - iv;
      const o00 = (iv * NU + iu) * 3, o10 = o00 + 3, o01 = o00 + NU * 3, o11 = o01 + 3;
      const w00 = (1 - tu) * (1 - tv), w10 = tu * (1 - tv), w01 = (1 - tu) * tv, w11 = tu * tv;
      display.setPixel(
        x, y,
        (lut[o00] * w00 + lut[o10] * w10 + lut[o01] * w01 + lut[o11] * w11 + 0.5) | 0,
        (lut[o00 + 1] * w00 + lut[o10 + 1] * w10 + lut[o01 + 1] * w01 + lut[o11 + 1] * w11 + 0.5) | 0,
        (lut[o00 + 2] * w00 + lut[o10 + 2] * w10 + lut[o01 + 2] * w01 + lut[o11 + 2] * w11 + 0.5) | 0,
      );
    }
}
