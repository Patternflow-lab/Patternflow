// ===== Patternflow pattern =====
// Title:   Optimizer Race
// Family:  optimizer
// Idea:    Five optimizers run down one drifting landscape of tinted elevation bands, each leaving a glowing comet trail: gradient descent zig-zags across the narrow valley and crawls along it, momentum overshoots and rings round the valley floor, Nesterov rings less, RMSProp and Adam rescale each axis and cut straight along it, while the valley bends, the basins deepen and merge and every racer that settles or leaves the panel fades and starts again somewhere else.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: gradient descent (Augustin-Louis Cauchy, 1847), momentum (Boris Polyak, 1964), Nesterov accelerated gradient (1983), RMSProp (Geoffrey Hinton, 2012), Adam (Diederik Kingma and Jimmy Ba, 2014), on test surfaces in the manner of Rosenbrock (1960), pattern round 223
// Round:   223
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..3, Relief=-1..1, Noise=-1..1
//
// Knob 1: Hue. Turns the whole picture round the colour wheel, the bands and the five racers together so they keep their places against each other. At 0 the lowlands are deep blue-teal, then sea green, olive and sand, amber and rust, and pale rose on the highest ground, with the racers pink, violet, azure, lemon and white against it; at 0.33 the lowlands are violet and the rust is green.
// Knob 2: Rate. The learning rate of all five, one number. Gradient descent steps by rate times the slope, momentum and Nesterov by a smaller rate (they pile steps up), RMSProp and Adam by rate times a fixed length per step. At 0.25 everyone crawls (gradient descent about 4 LEDs a second along the valley floor, Adam about 6) and the loops are tight; at 1, where it opens, the zig-zag of gradient descent is a 4 to 7 LED swing that dies out in a second and momentum rings across the valley with a wavelength of about 14 LEDs; at 2.5 gradient descent is at the edge of stability, swinging 12 LEDs wall to wall for seconds, momentum rings wide and past the end of the valley, and Adam and RMSProp run about 10 times as fast as at 0.25.
// Knob 3: Relief. How hard the ground is to descend. At 0 the valley is 16 LEDs across the floor and the walls are gentle, the three basins are deep and the hills low, so the landscape is a few wide bowls and everyone arrives; at 0.4, where it opens, the floor is about 9 LEDs across; at 1 it is a 5 LED canyon with steep walls, the basins are half as deep and the ridges twice as high, the contours crowd, and the surface morphs 2.5 times as fast. The narrower the valley the harder it is on gradient descent and the more the adaptive methods win.
// Knob 4: Noise. Gradient noise, the stochastic part of stochastic gradient descent, added to every gradient the racers read. At 0 the paths are the clean textbook curves; at 0.3, where it opens, they shiver by a fraction of a LED; at 1 the noise is as strong as the slope of the valley floor several times over, gradient descent and momentum wander like drunks along the valley while RMSProp and Adam, which divide by the noise they hear, still make headway in a jittery line.

// What the picture is. The panel is a map, 64 by 128 LEDs, of a height h(x, y), drawn the way a hypsometric map is drawn: twelve flat colour
// bands from deep blue-teal in the lowest ground through sea green, olive, sand, amber and rust to pale rose on the heights. A band edge is a
// contour line, anti-aliased over one LED, with no line drawn on it. The ground is a sum of terms: a long banana valley, a pseudo-Huber trench
// h = A (sqrt(s^2 + d^2) - s) round a centre line x = c(y) (a sine of 170 LEDs or so plus a small travelling ripple), which is stiff across
// (curvature A / s) and shallow along, the Rosenbrock shape; a tilt along it that drains toward a basin at its end; three anisotropic Gaussian
// wells; and two Gaussian ridges. All of them are rotated and scaled by amounts that drift on periods of 40 to 165 s that do not divide
// one another, so the wells deepen and fade, wander through each other and through the valley, the valley bends and shortens, the basin at
// its end slides up and down, and the contours flow slowly over the panel. The sum is compressed (u / (1 + u / 1.6)) so the far highlands
// do not go flat. Nothing is cached between frames but the time.
//
// Five racers each run one update rule on the true gradient of that surface, read analytically, two iterations a frame (60 a second):
//   gradient descent   x <- x - lr g                                                   (Cauchy)
//   momentum           v <- 0.9 v - lr g ; x <- x + v                                  (Polyak's heavy ball)
//   Nesterov           v <- 0.9 v - lr g(x + 0.9 v) ; x <- x + v                       (gradient read where the step is about to land)
//   RMSProp            s <- 0.9 s + 0.1 g^2 ; x <- x - a g / (sqrt(s) + e)             (per axis)
//   Adam               m <- 0.9 m + 0.1 g ; s <- 0.99 s + 0.01 g^2 ; x <- x - a m^ / (sqrt(s^) + e)   (bias-corrected, per axis)
// with a step clipped to 3 LEDs so none of them can blow up, and zero-mean noise added to g by the Noise knob. Each racer is always the
// same optimizer and keeps its own colour, so the eye learns which path is which. A racer is a comet: a bright head 3.6 LEDs across with a
// white-hot core, and behind it the path of the last 4.6 seconds, 2 to 3 LEDs wide, fading and thinning with age, each drawn over a soft
// dark halo so it reads on any band. A racer settles when the smoothed gradient it feels has been tiny for a while, or it has run its 18 to 32 s, or it has
// left the panel; it then fades in a second, waits a random 0.3 to 2.3 s and starts again. Starts come in two kinds: at a high end of the
// valley, off its axis, so the zig-zag and the rings have something to do; or at the highest of eight random spots. Racers that start
// within six seconds of each other start within 3 LEDs of the same place, so there is often a real race. The first update runs 10 s of
// the race with the opening knobs before the first frame, so trails are already on the ground.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, sin, cos, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- colours: bands and racers, as HSV, turned together by Hue
const NB = 12;
const BANDS = [
  [0.57, 0.80, 0.42],
  [0.535, 0.72, 0.50],
  [0.49, 0.62, 0.57],
  [0.42, 0.50, 0.64],
  [0.32, 0.42, 0.70],
  [0.20, 0.38, 0.78],
  [0.13, 0.36, 0.88],
  [0.095, 0.52, 0.90],
  [0.065, 0.58, 0.80],
  [0.04, 0.58, 0.68],
  [0.025, 0.42, 0.62],
  [0.97, 0.10, 0.93],
];
const RACERS = [
  [0.915, 0.80, 1.0], // gradient descent
  [0.76, 0.62, 1.0], // momentum
  [0.60, 0.66, 1.0], // Nesterov
  [0.165, 0.80, 1.0], // RMSProp
  [0.0, 0.0, 1.0], // Adam
];
function hsv(h, s, v, out, o) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  out[o] = r * 255; out[o + 1] = g * 255; out[o + 2] = b * 255;
}

// ---- the ground
const NG = 9; // 0-2 wells, 3 the basin at the valley's end, 4-5 ridges, 6-8 broad swells
const HS = 2.6;
const DW = 1.3; // the walls of the valley level off toward a plateau of about this height
const HLO = 0.0, HHI = 1.08;
const BAND_SCALE = NB / (HHI - HLO);
const CGAIN = 1.3, CMID = 0.5; // contrast about the plateau, so the bands are used from end to end (the slope the racers feel is not touched)
const HOFF = 0.1;
const WELL = [
  // base depth, sigma x, sigma y, angle, side of the valley
  [0.2, 4.5, 7, 0.6, 1],
  [0.18, 5.5, 6.5, -0.9, -1],
  [0.16, 6.5, 9, 1.4, 1],
];
const WELL_MOVE = [
  // offset from the valley, its swing, its period, cy amp, cy period, phases
  [22, 8, 83.1, 46, 117.3, 0.4, 2.2],
  [23, 8, 61.7, 40, 97.9, 3.3, 5.0],
  [25, 9, 143.7, 56, 71.3, 1.2, 4.1],
];
const RIDGE = [
  [0.42, 5, 15, 0.9],
  [0.38, 7.5, 12, -0.5],
];
const SWELL = [
  // amplitude, sigma
  [0.4, 17],
  [-0.3, 21],
  [0.32, 14],
];
const SWELL_MOVE = [
  [26, 131.3, 52, 89.9, 2.4, 0.3],
  [22, 97.1, 48, 149.3, 5.5, 3.9],
  [28, 73.7, 56, 113.9, 1.1, 5.2],
];
const RIDGE_MOVE = [
  [22, 109.3, 40, 151.9, 0.9, 3.6],
  [18, 77.9, 48, 63.7, 4.4, 1.7],
];

// the minibatch ripple: five travelling waves of 8 to 14 LEDs that the Noise knob raises out of the ground
const RIP = [
  // wavelength, direction, rate (rad/s), phase
  [14.1, 0.3, 2.3, 0.4],
  [17.3, 1.1, -1.9, 2.6],
  [21.7, 1.9, 2.9, 4.1],
  [12.9, 2.8, -2.6, 1.2],
  [15.9, 3.6, 2.1, 5.3],
];
const NRIP = RIP.length;

function prepSurface(S, tm, k3, k4) {
  S.rip = k4 * 0.024;
  for (let k = 0; k < NRIP; k++) {
    const r = RIP[k], kk = TAU / r[0];
    S.rkx[k] = kk * cos(r[1]); S.rky[k] = kk * sin(r[1]);
    S.rph[k] = r[3] + r[2] * S.t;
    S.rcd[k] = cos(S.rkx[k]); S.rsd[k] = sin(S.rkx[k]);
  }
  S.sig = 5 * pow(0.3, k3);
  S.wallA = 0.04 + 0.012 * k3;
  S.ac = 13 + 5 * sin((TAU * tm) / 101.3 + 0.7);
  S.ly = 175 + 35 * sin((TAU * tm) / 163.1 + 2.0);
  S.ys = 24 + 22 * sin((TAU * tm) / 137.9 + 4.1);
  S.lb = 43 + 8 * sin((TAU * tm) / 89.7 + 1.2);
  S.bph = (TAU * tm) / 57.7;
  S.ym = 64 + 38 * sin((TAU * tm) / 113.1 + 1.3) + 14 * sin((TAU * tm) / 71.9 + 0.2);
  S.fl = 0.36 + 0.07 * sin((TAU * tm) / 127.7 + 2.7);
  const wm = 1.1 - 0.55 * k3, hm = 0.65 + 0.7 * k3;
  for (let k = 0; k < NG; k++) {
    let cx, cy, amp, sx, sy, ang;
    if (k < 3) {
      const m = WELL_MOVE[k], w = WELL[k];
      cy = 64 + m[3] * sin((TAU * tm) / m[4] + m[6]);
      cx = xcOf(S, cy) + w[4] * (m[0] + m[1] * sin((TAU * tm) / m[2] + m[5]));
      amp = -w[0] * wm * (0.68 + 0.32 * sin((TAU * tm) / (47.3 + 9 * k) + 1.9 * k));
      sx = w[1] * (1 + 0.22 * sin((TAU * tm) / (53.9 + 7 * k) + k));
      sy = w[2] * (1 + 0.22 * sin((TAU * tm) / (69.3 + 11 * k) + 2 * k));
      ang = w[3] + 0.5 * sin((TAU * tm) / (91.7 + 13 * k) + 3 * k);
    } else if (k === 3) {
      cy = S.ym;
      cx = xcOf(S, cy);
      amp = -0.1 * wm;
      sx = 5; sy = 7; ang = 0;
    } else if (k >= 6) {
      const j = k - 6, m = SWELL_MOVE[j], w = SWELL[j];
      cx = 32 + m[0] * sin((TAU * tm) / m[1] + m[4]);
      cy = 64 + m[2] * sin((TAU * tm) / m[3] + m[5]);
      amp = w[0] * (0.75 + 0.25 * sin((TAU * tm) / (87.1 + 23 * j) + 1.7 * j));
      sx = w[1]; sy = w[1] * 1.35; ang = 0.7 * j + 0.6 * sin((TAU * tm) / (131.9 + 17 * j));
    } else {
      const j = k - 4, m = RIDGE_MOVE[j], w = RIDGE[j];
      cx = 32 + m[0] * sin((TAU * tm) / m[1] + m[4]);
      cy = 64 + m[2] * sin((TAU * tm) / m[3] + m[5]);
      amp = w[0] * hm * (0.7 + 0.3 * sin((TAU * tm) / (58.3 + 17 * j) + 2.3 * j));
      sx = w[1] * (1 + 0.2 * sin((TAU * tm) / (73.1 + 5 * j) + j));
      sy = w[2] * (1 + 0.2 * sin((TAU * tm) / (81.7 + 9 * j) + 4 * j));
      ang = w[3] + 0.6 * sin((TAU * tm) / (109.7 + 21 * j) + 5 * j);
    }
    S.gcx[k] = cx; S.gcy[k] = cy; S.ga[k] = amp;
    S.gc[k] = cos(ang); S.gs[k] = sin(ang);
    S.gix[k] = 1 / (sx * sx); S.giy[k] = 1 / (sy * sy);
  }
}

function xcOf(S, y) {
  return 32 + S.ac * sin((TAU * (y - S.ys)) / S.ly) + 3 * sin((TAU * y) / S.lb + S.bph);
}

// the height at (x, y) and, in S.gx, S.gy, its slope
function fieldGrad(S, x, y) {
  const a1 = (TAU * (y - S.ys)) / S.ly, a2 = (TAU * y) / S.lb + S.bph;
  const xc = 32 + S.ac * sin(a1) + 3 * sin(a2);
  const dxc = ((S.ac * TAU) / S.ly) * cos(a1) + ((3 * TAU) / S.lb) * cos(a2);
  const d = x - xc, sg = S.sig, rr = sqrt(sg * sg + d * d);
  const wl = S.wallA * (rr - sg), wd = DW / (DW + wl), wf = wd * wd;
  let u = DW * wl / (DW + wl) + HOFF;
  let ux = ((S.wallA * d) / rr) * wf, uy = -ux * dxc;
  const fy = (y - S.ym) * (1 / 64);
  u += S.fl * fy * fy;
  uy += (2 * S.fl * fy) / 64;
  for (let k = 0; k < NG; k++) {
    const dx = x - S.gcx[k], dy = y - S.gcy[k], c = S.gc[k], s = S.gs[k];
    const uu = c * dx + s * dy, vv = -s * dx + c * dy;
    const q = uu * uu * S.gix[k] + vv * vv * S.giy[k];
    if (q > 24) continue;
    const e = S.ga[k] * exp(-0.5 * q);
    u += e;
    const gu = -e * uu * S.gix[k], gv = -e * vv * S.giy[k];
    ux += c * gu - s * gv;
    uy += s * gu + c * gv;
  }
  if (S.rip > 0) {
    for (let k = 0; k < NRIP; k++) {
      const th = S.rkx[k] * x + S.rky[k] * y + S.rph[k], sn = S.rip * sin(th);
      u += S.rip * cos(th);
      ux -= S.rkx[k] * sn;
      uy -= S.rky[k] * sn;
    }
  }
  if (u > 0) {
    const den = 1 / (1 + u / HS);
    S.gx = ux * den * den;
    S.gy = uy * den * den;
    return u * den;
  }
  S.gx = ux;
  S.gy = uy;
  return u;
}

// the whole panel, into S.hgt
function raster(S) {
  const hgt = S.hgt, sg = S.sig, A = S.wallA;
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    const xc = xcOf(S, yc);
    const fy = (yc - S.ym) * (1 / 64);
    const base = HOFF + S.fl * fy * fy;
    for (let k = 0; k < NG; k++) {
      const dy = yc - S.gcy[k], c = S.gc[k], s = S.gs[k];
      S.ucs[k] = s * dy - c * S.gcx[k];
      S.vcs[k] = c * dy + s * S.gcx[k];
    }
    const row = y * W;
    const rip = S.rip;
    if (rip > 0) {
      for (let k = 0; k < NRIP; k++) {
        const th = S.rkx[k] * 0.5 + S.rky[k] * yc + S.rph[k];
        S.rc[k] = cos(th); S.rs[k] = sin(th);
      }
    }
    for (let x = 0; x < W; x++) {
      const xx = x + 0.5, d = xx - xc;
      const wl = A * (sqrt(sg * sg + d * d) - sg);
      let u = base + (DW * wl) / (DW + wl);
      for (let k = 0; k < NG; k++) {
        const uu = S.gc[k] * xx + S.ucs[k], vv = S.vcs[k] - S.gs[k] * xx;
        const q = uu * uu * S.gix[k] + vv * vv * S.giy[k];
        if (q < 24) u += S.ga[k] * exp(-0.5 * q);
      }
      if (rip > 0) {
        let rs = 0;
        for (let k = 0; k < NRIP; k++) {
          const c = S.rc[k], sn = S.rs[k];
          rs += c;
          S.rc[k] = c * S.rcd[k] - sn * S.rsd[k];
          S.rs[k] = sn * S.rcd[k] + c * S.rsd[k];
        }
        u += rip * rs;
      }
      hgt[row + x] = u > 0 ? u / (1 + u / HS) : u;
    }
  }
}

// ---- the racers
const IT_HZ = 12; // iterations a second; the drawn comet is interpolated between iterations
const IT_DT = 1 / IT_HZ;
const BETA = 0.95;
const MAXSTEP = 4;
const NOISE0 = 0.007;
// gradient descent, momentum, Nesterov: the learning rate times the stiffness of the valley across (A / sigma); RMSProp, Adam: LEDs a step; all at Rate 1
const LR = [1.9, 0.26, 0.34, 1.8, 2.2];
const EPS = 0.0015;
const TN = 200, TT = 6;

function gauss() {
  return Math.random() + Math.random() + Math.random() - 1.5;
}

function makeRacer(id) {
  return {
    id, phase: 0, wait: 0.5 + id * 1.3 + Math.random() * 1.5, age: 0, life: 24, ha: 0,
    x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0, vx: 0, vy: 0, mx: 0, my: 0, sx: 0, sy: 0, n: 0, ge: -1, ox: 0, oy: 0, oage: 0, still: 0,
    tx: new Float32Array(TN), ty: new Float32Array(TN), tt: new Float32Array(TN), tb: new Uint8Array(TN),
    th: 0, tc: 0, brk: 1,
  };
}

function makeState() {
  return {
    ready: false, t: 0, tm: 0, acc: 0, kn: [0, 2, 0, 0.06],
    sig: 5, wallA: 0.03, ac: 13, ly: 175, ys: 24, lb: 43, bph: 0, ym: 64, fl: 0.2, gx: 0, gy: 0,
    gcx: new Float64Array(NG), gcy: new Float64Array(NG), ga: new Float64Array(NG),
    gc: new Float64Array(NG), gs: new Float64Array(NG), gix: new Float64Array(NG), giy: new Float64Array(NG),
    ucs: new Float64Array(NG), vcs: new Float64Array(NG), rip: 0, still2: 25,
    rkx: new Float64Array(NRIP), rky: new Float64Array(NRIP), rph: new Float64Array(NRIP), rc: new Float64Array(NRIP), rs: new Float64Array(NRIP), rcd: new Float64Array(NRIP), rsd: new Float64Array(NRIP),
    hgt: new Float32Array(NPX), px: new Float32Array(NPX * 3),
    cov: new Float32Array(NPX), hal: new Float32Array(NPX), touch: new Int32Array(NPX), nt: 0,
    bcol: new Float32Array(NB * 3), rcol: new Float32Array(5 * 3), hueAt: -1,
    racers: [0, 1, 2, 3, 4].map(makeRacer),
    ax: 32, ay: 20, at: -99,
  };
}

export function setup(params) {
  params.s = makeState();
}

function launch(S, r) {
  let x, y;
  if (S.t - S.at < 6 && Math.random() < 0.85) {
    x = S.ax + (Math.random() - 0.5) * 6;
    y = S.ay + (Math.random() - 0.5) * 6;
  } else {
    if (Math.random() < 0.78) {
      // upstream on the valley floor, a little off its axis, so the zig-zag and the rings have something to do
      let side = Math.random() < 0.5 ? -1 : 1;
      y = S.ym + side * (28 + Math.random() * 50);
      if (y < 4 || y > 124) { side = -side; y = cl(S.ym + side * (28 + Math.random() * 50), 4, 124); }
      x = xcOf(S, y) + (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 3.5);
    } else {
      // the highest of eight spots on a slope
      let best = -9;
      for (let i = 0; i < 8; i++) {
        const cx = 6 + Math.random() * 52, cy = 6 + Math.random() * 116, hh = fieldGrad(S, cx, cy);
        if (hh > best && S.gx * S.gx + S.gy * S.gy > 0.0003) { best = hh; x = cx; y = cy; }
      }
      if (best < -8) { y = 8; x = xcOf(S, y) + 4; }
    }
    S.ax = x; S.ay = y; S.at = S.t;
  }
  r.x = r.px = r.dx = cl(x, 3, 61); r.y = r.py = r.dy = cl(y, 3, 125);
  r.vx = r.vy = r.mx = r.my = r.sx = r.sy = 0;
  r.n = 0; r.ge = -1; r.age = 0; r.ha = 0; r.phase = 1;
  r.life = 18 + Math.random() * 14;
  r.ox = r.x; r.oy = r.y; r.oage = 0; r.still = 0;
  r.brk = 1;
}

function stepRacer(S, r, rho, nz) {
  const id = r.id, lam = S.wallA / S.sig, lrs = rho / lam;
  let px = r.x, py = r.y;
  if (id === 2) { px += BETA * r.vx; py += BETA * r.vy; }
  fieldGrad(S, px, py);
  const gn = sqrt(S.gx * S.gx + S.gy * S.gy);
  r.ge = r.ge < 0 ? gn : r.ge + (gn - r.ge) * 0.03;
  const gx = S.gx + nz * gauss(), gy = S.gy + nz * gauss();
  let dx, dy;
  if (id === 0) {
    dx = -lrs * LR[0] * gx; dy = -lrs * LR[0] * gy;
  } else if (id === 1 || id === 2) {
    const lr = lrs * LR[id];
    r.vx = BETA * r.vx - lr * gx; r.vy = BETA * r.vy - lr * gy;
    const vn = sqrt(r.vx * r.vx + r.vy * r.vy);
    if (vn > MAXSTEP) { r.vx *= MAXSTEP / vn; r.vy *= MAXSTEP / vn; }
    dx = r.vx; dy = r.vy;
  } else if (id === 3) {
    r.sx = 0.9 * r.sx + 0.1 * gx * gx; r.sy = 0.9 * r.sy + 0.1 * gy * gy;
    const a = rho * LR[3];
    dx = (-a * gx) / (sqrt(r.sx) + EPS); dy = (-a * gy) / (sqrt(r.sy) + EPS);
  } else {
    r.n++;
    r.mx = 0.9 * r.mx + 0.1 * gx; r.my = 0.9 * r.my + 0.1 * gy;
    r.sx = 0.99 * r.sx + 0.01 * gx * gx; r.sy = 0.99 * r.sy + 0.01 * gy * gy;
    const c1 = 1 / (1 - pow(0.9, r.n)), c2 = 1 / (1 - pow(0.99, r.n)), a = rho * LR[4];
    dx = (-a * r.mx * c1) / (sqrt(r.sx * c2) + EPS); dy = (-a * r.my * c1) / (sqrt(r.sy * c2) + EPS);
  }
  const sn = sqrt(dx * dx + dy * dy);
  if (sn > MAXSTEP) { dx *= MAXSTEP / sn; dy *= MAXSTEP / sn; }
  r.x += dx; r.y += dy;
}

function frame(S, d, kn) {
  S.t += d;
  const k3 = cl(0.5 + 0.5 * kn[2], 0, 1), rho = 0.25 * pow(4, cl(kn[1], 0, 3) / 2), q4 = (cl(kn[3], -1, 1) + 1) / 2, k4 = q4 * q4, nz = k4 * NOISE0;
  S.tm += d * (0.7 + 1.05 * k3);
  prepSurface(S, S.tm, k3, k4);
  const rad = 1.6 + 3.4 * min(1, rho);
  S.still2 = rad * rad;
  S.acc += d;
  const R = S.racers;
  while (S.acc >= IT_DT) {
    S.acc -= IT_DT;
    for (let i = 0; i < 5; i++) {
      const r = R[i];
      if (r.phase !== 1) continue;
      r.px = r.x; r.py = r.y;
      stepRacer(S, r, rho, nz);
    }
  }
  const fr = S.acc / IT_DT;
  for (let i = 0; i < 5; i++) {
    const r = R[i];
    r.dx = r.px + (r.x - r.px) * fr;
    r.dy = r.py + (r.y - r.py) * fr;
  }
  let alive = 0;
  for (let i = 0; i < 5; i++) if (R[i].phase === 1) alive++;
  for (let i = 0; i < 5; i++) {
    const r = R[i];
    if (r.phase === 0) {
      r.wait -= d;
      if (r.wait <= 0) { launch(S, r); alive++; }
    } else if (r.phase === 1) {
      r.age += d;
      r.ha = min(1, r.age / 0.4);
      let dead = r.x < -4 || r.x > 68 || r.y < -4 || r.y > 132 || r.age > r.life;
      if (!dead && r.age > 2.5 && r.ge < 0.0008) dead = true;
      // it has stayed within 5 LEDs (less at a low Rate) of one spot for two windows of 1.2 s in a row: it has arrived, or it is ringing in place
      r.oage += d;
      const mv = (r.x - r.ox) * (r.x - r.ox) + (r.y - r.oy) * (r.y - r.oy);
      if (mv > S.still2) { r.ox = r.x; r.oy = r.y; r.oage = 0; r.still = 0; }
      else if (r.oage > 1.2) {
        if (++r.still >= 2 && r.age > 3) dead = true;
        r.ox = r.x; r.oy = r.y; r.oage = 0;
      }
      if (dead) { r.phase = 2; alive--; }
      else {
        const h = r.th;
        r.tx[h] = r.dx; r.ty[h] = r.dy; r.tt[h] = S.t; r.tb[h] = r.brk;
        r.brk = 0;
        r.th = (h + 1) % TN;
        if (r.tc < TN) r.tc++;
      }
    } else {
      r.ha -= d / 1.0;
      if (r.ha <= 0) { r.ha = 0; r.phase = 0; r.wait = (alive < 3 ? 0.15 : 0.4) + Math.random() * 1.9; }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    for (let f = 0; f < 300; f++) frame(S, 1 / 30, kn);
  }
  frame(S, d, kn);
  raster(S);
}

// ---- drawing
function setPalette(S, hue) {
  if (S.hueAt === hue) return;
  S.hueAt = hue;
  for (let b = 0; b < NB; b++) hsv(BANDS[b][0] + hue, BANDS[b][1], BANDS[b][2], S.bcol, b * 3);
  for (let i = 0; i < 5; i++) hsv(RACERS[i][0] + hue, RACERS[i][1], RACERS[i][2], S.rcol, i * 3);
}

function bands(S) {
  const hgt = S.hgt, px = S.px, bc = S.bcol;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const hx = (hgt[x < W - 1 ? i + 1 : i] - hgt[x > 0 ? i - 1 : i]) * (x > 0 && x < W - 1 ? 0.5 : 1);
      const hy = (hgt[y < H - 1 ? i + W : i] - hgt[y > 0 ? i - W : i]) * (y > 0 && y < H - 1 ? 0.5 : 1);
            let s = ((hgt[i] - CMID) * CGAIN + CMID - HLO) * BAND_SCALE - 0.9, gk = 1;
      if (s > 7.5) {
        // the top of the range is eased so the pale highlands are peaks and not plains
        gk = exp(-(s - 7.5) / 5.2);
        s = 7.5 + 5.2 * (1 - gk);
      }
      const gm = sqrt(hx * hx + hy * hy) * BAND_SCALE * CGAIN * gk + 1e-5;
      let b = floor(s);
      let r, g, bl;
      if (b < 0) b = 0;
      else if (b >= NB) b = NB - 1;
      const f = cl(s - b, 0, 1);
      r = bc[b * 3]; g = bc[b * 3 + 1]; bl = bc[b * 3 + 2];
      const dl = f / gm, du = (1 - f) / gm;
      if (dl < 0.5 && b > 0) {
        const w = 0.5 - dl, o = (b - 1) * 3;
        r += (bc[o] - r) * w; g += (bc[o + 1] - g) * w; bl += (bc[o + 2] - bl) * w;
      } else if (du < 0.5 && b < NB - 1) {
        const w = 0.5 - du, o = (b + 1) * 3;
        r += (bc[o] - r) * w; g += (bc[o + 1] - g) * w; bl += (bc[o + 2] - bl) * w;
      }
      px[i * 3] = r; px[i * 3 + 1] = g; px[i * 3 + 2] = bl;
    }
  }
}

function touch(S, i) {
  S.touch[S.nt++] = i;
}

// one capsule of a trail into the coverage and halo buffers (maximum, so joints do not double up)
function capsule(S, xa, ya, ra, aa, xb, yb, rb, ab) {
  const pad = max(ra, rb) + 3;
  const x0 = max(0, floor(min(xa, xb) - pad)), x1 = min(W - 1, floor(max(xa, xb) + pad));
  const y0 = max(0, floor(min(ya, yb) - pad)), y1 = min(H - 1, floor(max(ya, yb) + pad));
  const ex = xb - xa, ey = yb - ya, el2 = ex * ex + ey * ey, inv = el2 > 1e-6 ? 1 / el2 : 0;
  const cov = S.cov, hal = S.hal;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5 - ya;
    for (let x = x0; x <= x1; x++) {
      const pxx = x + 0.5 - xa;
      const u = cl((pxx * ex + py * ey) * inv, 0, 1);
      const dx = pxx - u * ex, dy = py - u * ey, dist = sqrt(dx * dx + dy * dy);
      const R = ra + (rb - ra) * u, a = aa + (ab - aa) * u;
      const e = cl((R + 0.6 - dist) / 1.6, 0, 1);
      const eh = cl((R + 2.2 - dist) / 2.2, 0, 1);
      const i = y * W + x;
      if (cov[i] === 0 && hal[i] === 0) touch(S, i);
      const c = e * e * (3 - 2 * e) * a, h = eh * eh * (3 - 2 * eh) * a * 0.62;
      if (c > cov[i]) cov[i] = c;
      if (h > hal[i]) hal[i] = h;
    }
  }
}

function drawRacer(S, r, col) {
  const px = S.px;
  // the trail, newest point first
  S.nt = 0;
  let any = false;
  for (let j = 0; j < r.tc - 1; j++) {
    const a = (r.th - 1 - j + 2 * TN) % TN, b = (a - 1 + TN) % TN;
    const ageA = S.t - r.tt[a];
    if (ageA > TT) break;
    if (r.tb[a]) continue;
    const ageB = S.t - r.tt[b];
    const fa = 1 - ageA / TT, fb = max(0, 1 - ageB / TT);
    capsule(S, r.tx[a], r.ty[a], 1.25 + 0.8 * fa, pow(fa, 0.8), r.tx[b], r.ty[b], 1.25 + 0.8 * fb, pow(fb, 0.8));
    any = true;
  }
  if (any) {
    const cov = S.cov, hal = S.hal, T = S.touch;
    for (let n = 0; n < S.nt; n++) {
      const i = T[n], hv = 1 - hal[i], cv = cov[i], o = i * 3;
      let rr = px[o] * hv, gg = px[o + 1] * hv, bb = px[o + 2] * hv;
      rr += (col[0] - rr) * cv; gg += (col[1] - gg) * cv; bb += (col[2] - bb) * cv;
      px[o] = rr; px[o + 1] = gg; px[o + 2] = bb;
      cov[i] = 0; hal[i] = 0;
    }
  }
  // the head
  if (r.ha > 0 && r.tc > 0) {
    const hx = r.dx, hy = r.dy, ha = r.ha;
    const x0 = max(0, floor(hx - 5)), x1 = min(W - 1, floor(hx + 5)), y0 = max(0, floor(hy - 5)), y1 = min(H - 1, floor(hy + 5));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - hx, dy = y + 0.5 - hy, dd = sqrt(dx * dx + dy * dy);
        const eh = cl((4.4 - dd) / 3.0, 0, 1), halo = eh * eh * (3 - 2 * eh) * 0.6 * ha;
        const ec = cl((2.3 - dd) / 1.3, 0, 1), cv = ec * ec * (3 - 2 * ec) * ha;
        if (halo <= 0 && cv <= 0) continue;
        const o = (y * W + x) * 3, hv = 1 - halo, w = cl((1.45 - dd) / 1.45, 0, 1) * 0.75;
        const cr = col[0] + (255 - col[0]) * w, cg = col[1] + (255 - col[1]) * w, cb = col[2] + (255 - col[2]) * w;
        let rr = px[o] * hv, gg = px[o + 1] * hv, bb = px[o + 2] * hv;
        rr += (cr - rr) * cv; gg += (cg - gg) * cv; bb += (cb - bb) * cv;
        px[o] = rr; px[o + 1] = gg; px[o + 2] = bb;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  setPalette(S, cl(S.kn[0], 0, 1));
  bands(S);
  for (let i = 0; i < 5; i++) drawRacer(S, S.racers[i], S.rcol.subarray(i * 3, i * 3 + 3));
  const px = S.px;
  for (let i = 0; i < NPX; i++) {
    display.setPixel(i % W, (i / W) | 0, cl(px[i * 3], 0, 255) | 0, cl(px[i * 3 + 1], 0, 255) | 0, cl(px[i * 3 + 2], 0, 255) | 0);
  }
}
