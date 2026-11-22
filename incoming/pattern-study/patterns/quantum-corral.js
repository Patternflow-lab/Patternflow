// ===== Patternflow pattern =====
// Title:   Quantum Corral
// Family:  corral
// Idea:    A scanning tunnelling microscope map of surface electrons on copper, with a round ring of 48 gold iron atoms above and an elliptical ring of 48 below that has a pink cobalt atom on its left focus, where the electrons held inside stand as concentric ripples and petals of local density of states from cobalt blue up to ice-white, and a bias that creeps up and down between k R of 2.2 and 10.3 lights the modes of each ring in turn, each ring at its own energies and each for 2 to 8 seconds, while the ripple leaks out through the atoms when they are made to scatter less.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: quantum corrals of 48 iron atoms on Cu(111) (Michael Crommie, Christopher Lutz and Donald Eigler, 1993), images computed by multiple scattering from the atoms (Eric Heller, Michael Crommie, Christopher Lutz and Donald Eigler, 1994), the quantum mirage of a cobalt atom in an elliptical corral (Hari Manoharan, Christopher Lutz and Donald Eigler, 2000); pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0..3, Leak=0..1, Ellipse=0.5..0.8
//
// Knob 1: Hue. Turns every colour round the wheel, the whole picture together. At 0 the ground is cobalt, the ripples climb through azure and cyan to ice-white and the atoms are gold. At 0.25 the ground is violet and the atoms are green, at 0.5 the ground is olive with orange ripples and blue atoms, and at 1 it is back where it began.
// Knob 2: Sweep. How fast the bias moves, and 0 holds it, so that the opening picture stays on its resonance and only the lobes turn. The bias is k times the radius of the round ring, k R, and it bounces between turning points that wander, 8.1 to 10.3 at the top and 2.2 to 4.0 at the bottom. At 2, where it opens, it moves 0.12 a second at k R = 7, 0.23 in the gaps between resonances and 0.024 on one, which makes about 0.05 a second over a whole sweep. At that rate one ring or the other sits on a resonance 58 percent of the time, in stretches of 4.5 seconds on average. They last about twice as long at 1 and three fifths as long at 3.
// Knob 3: Leak. How much of a wave each atom turns back, which is how well the wall holds the electrons. At 0 an atom scatters as much as a point can (a phase shift of 90 degrees), the lines of the modes are 0.04 wide in k R for the first and 0.25 near k R = 9, the mean density inside stands 14 times the ground at the first mode and 2.6 times near k R = 9, and little shows outside the ring. At 1 each atom scatters 0.64 as much (41 degrees, with 5 percent of the wave lost), the lines are three times as wide and a third as tall, and the ripple runs out through the wall into the ground.
// Knob 4: Ellipse. The eccentricity of the lower ring, 0.5 where it opens and 0.8 at the top. The long axis is 54 LEDs at every setting and the short one 47 at 0.5 and 32 at 0.8, so the two foci are 27 LEDs apart at 0.5 and 43 at 0.8. The cobalt atom stays on the left focus, and at 0.8 it sits 5 LEDs from the wall. The eccentricity also wanders by up to 0.075 either way as the bias travels. The upper ring does not change shape.

// What the picture is. Each ring is a set of point scatterers on a flat gas of surface electrons. One bias is one wave
// number k, the energy going as k squared, and the pattern counts it as k R with R = 26 LEDs, the radius of the round
// ring. The lowest mode of the round ring lights at k R = 2.58, where a hard-walled disc of the same size would give
// 2.405, so the atoms hold the electrons in a disc 24.2 LEDs in radius, 1.8 inside the ring. At the top of the sweep,
// k R = 10.3, the ripples are 8 LEDs from crest to crest and a lobe of a mode is 4 LEDs wide.
// An atom scatters an s wave. Given the wave psi_in on it, it sends out a H0(k r), where H0 = J0 + i Y0 is the Hankel
// function and a = tau psi_in. tau = (S - 1) / 2, with S = eta exp(2 i delta) the atom's scattering phase. Atoms hear
// each other, so a ring of N atoms is the complex system
//   a_i - tau_i sum over j not i of a_j H0(k |r_i - r_j|) = tau_i psi_in(r_i),
// which is solved once for each of NT incoming plane waves, NT = 16, 24 or 32 as the bias needs, and Gaussian elimination
// with row pivoting does it in about half a millisecond. The density of states at a point is the mean of |psi|^2 over a full
// set of incoming waves, 1 on bare surface. The cobalt atom has a tau of its own, delta 0.9 and eta 0.9.
// The density is worked out on a grid of 33 by 33 samples a LED pair apart over each half, a quarter of it each frame,
// in a scrambled order, so that a ring is refreshed every 4 frames. The picture is filled in to every LED by the
// midpoint rule of six taps, (3, -25, 150, 150, -25, 3) / 256, which holds a ripple of 8 LEDs to within 6 percent. The
// field of an atom has a logarithmic spike at its centre, so the distance to an atom is taken as the square root of
// r^2 + 4.5, which rounds the spike off at about 2 LEDs, where the dark moat round each atom hides it. The scattering
// system itself uses the plain distance, never under 0.8 LEDs.
// The panel is cut in two halves of 64 by 64, a ring in the middle of each. The ground ripple fades to nothing at the
// seam between them and the gain, set by the 96th percentile of the density inside each ring, blends from one half to
// the other over rows 52 to 76, so that the seam shows no step. A density L takes the colour
//   u = (log(1 + L / 0.8) / log(1 + G / 0.8)) ^ 1.3,
// where the gain G is 1.1 times the 96th percentile and never under 2.8 (2 when Leak is 1), so that a ring between
// resonances still shows its blend and a ring on one does not wash out.
// The round ring has 48 atoms 3.4 LEDs apart. The ellipse has 48 more at equal steps along its length, 2.9 to 3.3 LEDs
// apart, and one cobalt atom. A bare ring of identical atoms has pairs of modes with the same energy, whose lobes then
// blur into rings. The breathing of the atoms described below splits each pair into its two orientations.
// The same bias always lights the same mode of a ring of one size, so the sizes drift. They follow the distance the bias
// has travelled and not the time, which keeps Sweep 0 on its mode: the round ring's radius by up to 3 percent (26 LEDs
// plus or minus 0.8), the ellipse by 2.3 percent and its eccentricity by 0.075. A resonance moves with the size, 0.2 in
// k R at k R = 7, so a stretch of bias that is crossed a second time finds other modes in it.
//
const W = 64, H = 128, HALF = 64;
const { floor, sqrt, pow, exp, log, sin, cos, PI, min, max, abs, atan2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

const NAT = 48; // iron atoms in each ring
const R0 = 26; // radius of the round ring, in LEDs
const EA = 27; // half the long axis of the ellipse
const QMIN = 2.2, QMAX = 10.3; // k R at the two ends of the sweep
const NTMAX = 32; // most incoming plane waves
const CN = 33; // coarse grid: 33 by 33 samples, one every 2 LEDs, over a half
const CNN = CN * CN;
const NGROUPS = 4; // the coarse grid is refreshed a quarter at a time, in a scrambled order
const L1 = 0.8; // density of states where the colour scale turns from linear to logarithmic
const GORDER = [0, 3, 1, 2];
const XS = 0.025, XINV = 1 / XS, XN = 2000; // Bessel table, to x = 50

// ---- J0 and Y0 on a table. The power series up to x = 14, the Hankel asymptotic series after it.
const JT = new Float64Array(XN + 2), YT = new Float64Array(XN + 2);
(function tables() {
  const EG = 0.5772156649015329;
  for (let n = 0; n <= XN + 1; n++) {
    const x = max(n * XS, 0.01);
    let j, y;
    if (x < 14) {
      const q = (x * x) / 4;
      let term = 1, sj = 1, sy = 0, hk = 0;
      for (let k = 1; k < 70; k++) {
        term *= -q / (k * k);
        hk += 1 / k;
        sj += term;
        sy -= hk * term;
      }
      j = sj;
      y = (2 / PI) * ((log(x / 2) + EG) * sj + sy);
    } else {
      const x2 = 1 / (x * x);
      const P = 1 - (9 / 128) * x2 + (3675 / 32768) * x2 * x2 - (2401245 / 4194304) * x2 * x2 * x2;
      const Q = (-1 / (8 * x)) * (1 - (75 / 128) * x2 + (59535 / 32768) * x2 * x2);
      const ch = x - PI / 4, f = sqrt(2 / (PI * x));
      j = f * (P * cos(ch) - Q * sin(ch));
      y = f * (P * sin(ch) + Q * cos(ch));
    }
    JT[n] = j;
    YT[n] = y;
  }
})();

// ---- colour
function hsvOf(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, mx > 0 ? d / mx : 0, mx / 255];
}
function rgbOf(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [r * 255, g * 255, b * 255];
}
// False colour of the density of states: black-blue, cobalt, azure, cyan, ice, warm white.
const STOPS = [
  [0.0, 1, 2, 12],
  [0.14, 4, 10, 66],
  [0.32, 8, 34, 128],
  [0.52, 16, 92, 192],
  [0.7, 40, 168, 220],
  [0.84, 130, 224, 230],
  [0.94, 220, 244, 236],
  [1.0, 255, 246, 214],
];
function stopColour(t, out) {
  let k = 0;
  while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
  const a = STOPS[k], b = STOPS[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * u;
  out[1] = a[2] + (b[2] - a[2]) * u;
  out[2] = a[3] + (b[3] - a[3]) * u;
}

// ---- one ring: its atoms, the coarse map of the density of states, the scattering amplitudes
function makeCorral(ell) {
  const n = ell ? NAT + 1 : NAT;
  return {
    ell, n,
    ax: new Float64Array(n), ay: new Float64Array(n), // atom positions from the centre of the half, in LEDs
    tr: new Float64Array(n), ti: new Float64Array(n), // tau of each atom
    dist: new Float32Array(CNN * n), // coarse sample to atom distances
    Ar: new Float64Array(n * (n + NTMAX)), Ai: new Float64Array(n * (n + NTMAX)),
    ar: new Float64Array(NTMAX * n), ai: new Float64Array(NTMAX * n),
    ct: new Float64Array(NTMAX), st: new Float64Array(NTMAX),
    L: new Float32Array(CNN).fill(1), // density of states on the coarse grid
    inside: new Int32Array(CNN), nin: 0, // coarse samples well inside the ring
    arc: new Float64Array(721),
    ksnap: 0, nt: 16,
    lref: 8, dos: 0, ex: 0,
    hr: new Float64Array(n), hi: new Float64Array(n),
  };
}

function makeState() {
  const S = {
    t: 0, q: 6.62, dir: 1, gate: 1, dosS: 1.5, frame: 0, trav: 0, sc1: 1, sc2: 1, de: 0, leakNow: 0, eNow: 0.5,
    top: makeCorral(false), bot: makeCorral(true),
    knobs: [0, 2, 0, 0.5],
    lut: new Float32Array(256 * 3), atomCol: [255, 196, 64], coCol: [255, 150, 160], hueDone: -1,
    img: new Float32Array(HALF * W), tmp: new Float32Array(CN * W),
    buf: new Uint8ClampedArray(W * H * 3),
  };
  return S;
}

// Where the atoms are. The round ring is 48 atoms on a circle of 26 LEDs. Its radius also breathes, by 0.23 LEDs in the
// multipole 2 up to 0.38 in the multipole 12 (even ones only, since a mode with m nodes pairs with its twin through
// the multipole 2m), each turning at its own rate between 0.10 and 0.18 radians a second divided by its order. That
// splits a mode with 2m lobes into its two orientations, one at a time, and turns the lobes. The lower ring is an
// ellipse with the same atom count, equal steps along its length, deformed in the same way, and a different atom at
// the left focus.
const NMUL = 4;
const MP = [], MW = [];
for (let i = 0; i < NMUL; i++) {
  MP.push(TAU * ((i * 0.6180339887 + 0.13) % 1));
  MW.push((i % 2 ? -1 : 1) * (0.1 + 0.08 * ((i * 0.7548776662 + 0.3) % 1)));
}
function breath(u, t, seed) {
  let s = 0;
  for (let i = 0; i < NMUL; i++) s += (0.15 + 0.03 * i) * cos((2 * i + 2) * u + MP[(i + seed * 2) % NMUL] + seed + MW[i] * t * (seed ? 1.3 : 1));
  return s;
}
const jit = (i, s) => 0.08 * ((sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1);

function placeAtoms(C, t, e, sc) {
  const n = NAT;
  if (!C.ell) {
    for (let i = 0; i < n; i++) {
      const u = (TAU * i) / n + 0.05, r = R0 * sc + breath(u, t, 0) + jit(i, 1);
      C.ax[i] = r * cos(u);
      C.ay[i] = r * sin(u);
    }
    return;
  }
  // equal steps along the ellipse
  const ea = EA * sc, b = ea * sqrt(1 - e * e), M = 720, arc = C.arc;
  for (let k = 1; k <= M; k++) {
    const u = ((k - 0.5) / M) * TAU;
    arc[k] = arc[k - 1] + sqrt(ea * ea * sin(u) * sin(u) + b * b * cos(u) * cos(u)) * (TAU / M);
  }
  const P = arc[M];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) / n) * P;
    while (k < M - 1 && arc[k + 1] < s) k++;
    const f = (s - arc[k]) / max(1e-9, arc[k + 1] - arc[k]);
    const u = ((k + f) / M) * TAU;
    const nx = b * cos(u), ny = ea * sin(u), nl = sqrt(nx * nx + ny * ny);
    const r = breath(u, t, 1) + jit(i, 2);
    C.ax[i] = ea * cos(u) + (r * nx) / nl;
    C.ay[i] = b * sin(u) + (r * ny) / nl;
  }
  C.ax[n] = -ea * e;
  C.ay[n] = 0;
}

// tau = (S - 1) / 2 with S = eta exp(2 i delta). delta falls from pi / 2, an atom that turns back as much as a point can, to 0.72 with Leak.
function setTau(C, leak) {
  const delta = 1.5708 - 0.85 * leak, eta = 1 - 0.05 * leak;
  for (let i = 0; i < NAT; i++) {
    C.tr[i] = (eta * cos(2 * delta) - 1) / 2;
    C.ti[i] = (eta * sin(2 * delta)) / 2;
  }
  if (C.ell) {
    const dc = 0.9, ec = 0.9;
    C.tr[NAT] = (ec * cos(2 * dc) - 1) / 2;
    C.ti[NAT] = (ec * sin(2 * dc)) / 2;
  }
}

// Coarse samples inside the ring, for the gain and the sweep.
function markInside(C, e, sc) {
  const list = C.inside, ea = EA * sc, b = ea * sqrt(1 - e * e), rr = (R0 * sc - 3.5) * (R0 * sc - 3.5);
  let m = 0;
  for (let cy = 0; cy < CN; cy++)
    for (let cx = 0; cx < CN; cx++) {
      const x = 2 * cx + 0.5 - 32, y = 2 * cy + 0.5 - 32;
      const inn = C.ell ? (x * x) / ((ea - 3.5) * (ea - 3.5)) + (y * y) / ((b - 3.5) * (b - 3.5)) < 1 : x * x + y * y < rr;
      if (inn) list[m++] = cy * CN + cx;
    }
  C.nin = m;
}

// One refresh: atoms, distances, the scattering system and its solution for NT incoming waves at the current k.
function refresh(C, S, eKnob, leak) {
  const n = C.n, k = S.q / R0;
  const e = C.ell ? min(eKnob + S.de, 0.85) : 0, sc = C.ell ? S.sc2 : S.sc1;
  placeAtoms(C, S.t, e, sc);
  setTau(C, leak);
  markInside(C, e, sc);
  const nt = S.q < 4.6 ? 16 : S.q < 7.2 ? 24 : 32;
  C.nt = nt;
  C.ksnap = k;
  const { ax, ay, tr, ti, dist, Ar, Ai, ct, st } = C;
  for (let i = 0; i < n; i++)
    for (let c = 0, cy = 0; cy < CN; cy++) {
      const y = 2 * cy + 0.5 - 32 - ay[i];
      for (let cx = 0; cx < CN; cx++, c++) {
        const x = 2 * cx + 0.5 - 32 - ax[i];
        dist[c * n + i] = sqrt(x * x + y * y + 4.5);
      }
    }
  const stride = n + NTMAX;
  for (let t = 0; t < nt; t++) {
    const th = (TAU * (t + 0.37)) / nt;
    ct[t] = cos(th);
    st[t] = sin(th);
  }
  for (let i = 0; i < n; i++) {
    Ar[i * stride + i] = 1;
    Ai[i * stride + i] = 0;
    for (let j = i + 1; j < n; j++) {
      const dx = ax[i] - ax[j], dy = ay[i] - ay[j];
      const x = k * max(0.8, sqrt(dx * dx + dy * dy)) * XINV;
      let ix = x | 0;
      if (ix > XN - 1) ix = XN - 1;
      const f = x - ix;
      const hr = JT[ix] + (JT[ix + 1] - JT[ix]) * f, hi = YT[ix] + (YT[ix + 1] - YT[ix]) * f;
      // row i gets -tau_i H, row j gets -tau_j H
      Ar[i * stride + j] = -(tr[i] * hr - ti[i] * hi);
      Ai[i * stride + j] = -(tr[i] * hi + ti[i] * hr);
      Ar[j * stride + i] = -(tr[j] * hr - ti[j] * hi);
      Ai[j * stride + i] = -(tr[j] * hi + ti[j] * hr);
    }
    for (let t = 0; t < nt; t++) {
      const ph = k * (ax[i] * ct[t] + ay[i] * st[t]), pr = cos(ph), pi = sin(ph);
      Ar[i * stride + n + t] = tr[i] * pr - ti[i] * pi;
      Ai[i * stride + n + t] = tr[i] * pi + ti[i] * pr;
    }
  }
  solve(C, nt);
}

// Gaussian elimination with row pivoting on [M | rhs], then back substitution for each right-hand side.
function solve(C, nt) {
  const n = C.n, s = n + NTMAX, m = n + nt, { Ar, Ai, ar, ai } = C;
  for (let c = 0; c < n; c++) {
    let p = c, pm = Ar[c * s + c] * Ar[c * s + c] + Ai[c * s + c] * Ai[c * s + c];
    for (let r = c + 1; r < n; r++) {
      const v = Ar[r * s + c] * Ar[r * s + c] + Ai[r * s + c] * Ai[r * s + c];
      if (v > pm) {
        pm = v;
        p = r;
      }
    }
    if (p !== c)
      for (let j = c; j < m; j++) {
        let t = Ar[c * s + j];
        Ar[c * s + j] = Ar[p * s + j];
        Ar[p * s + j] = t;
        t = Ai[c * s + j];
        Ai[c * s + j] = Ai[p * s + j];
        Ai[p * s + j] = t;
      }
    const pr = Ar[c * s + c], pi = Ai[c * s + c], inv = 1 / (pr * pr + pi * pi), ir = pr * inv, ii = -pi * inv;
    for (let r = c + 1; r < n; r++) {
      const fr = Ar[r * s + c], fi = Ai[r * s + c];
      if (fr === 0 && fi === 0) continue;
      const mr = fr * ir - fi * ii, mi = fr * ii + fi * ir;
      const rc = r * s, cc = c * s;
      for (let j = c + 1; j < m; j++) {
        const br = Ar[cc + j], bi = Ai[cc + j];
        Ar[rc + j] -= mr * br - mi * bi;
        Ai[rc + j] -= mr * bi + mi * br;
      }
    }
  }
  for (let t = 0; t < nt; t++) {
    const o = t * n;
    for (let r = n - 1; r >= 0; r--) {
      let sr = Ar[r * s + n + t], si = Ai[r * s + n + t];
      const rs = r * s;
      for (let j = r + 1; j < n; j++) {
        sr -= Ar[rs + j] * ar[o + j] - Ai[rs + j] * ai[o + j];
        si -= Ar[rs + j] * ai[o + j] + Ai[rs + j] * ar[o + j];
      }
      const pr = Ar[rs + r], pi = Ai[rs + r], inv = 1 / (pr * pr + pi * pi);
      ar[o + r] = (sr * pr + si * pi) * inv;
      ai[o + r] = (si * pr - sr * pi) * inv;
    }
  }
}

// The density of states at one group of coarse samples: the mean of |psi|^2 over the incoming waves.
function evalGroup(C, g) {
  const n = C.n, nt = C.nt, k = C.ksnap, { dist, ar, ai, ct, st, hr, hi, L } = C;
  const gg = GORDER[g];
  for (let cy = gg >> 1; cy < CN; cy += 2)
    for (let cx = gg & 1; cx < CN; cx += 2) {
      const c = cy * CN + cx, x = 2 * cx + 0.5 - 32, y = 2 * cy + 0.5 - 32, o = c * n;
      let dmin = 1e9;
      for (let i = 0; i < n; i++) {
        if (dist[o + i] < dmin) dmin = dist[o + i];
        const xx = k * dist[o + i] * XINV;
        let ix = xx | 0;
        if (ix > XN - 1) ix = XN - 1;
        const f = xx - ix;
        hr[i] = JT[ix] + (JT[ix + 1] - JT[ix]) * f;
        hi[i] = YT[ix] + (YT[ix + 1] - YT[ix]) * f;
      }
      let sum = 0;
      for (let t = 0; t < nt; t++) {
        const ph = k * (x * ct[t] + y * st[t]);
        let sr = cos(ph), si = sin(ph);
        const b = t * n;
        for (let i = 0; i < n; i++) {
          const a = ar[b + i], d = ai[b + i];
          sr += a * hr[i] - d * hi[i];
          si += a * hi[i] + d * hr[i];
        }
        sum += sr * sr + si * si;
      }
      // within 2.2 LEDs of an atom the field is left at the bare value, and it comes in over the next 1.5
      const w = sm((sqrt(max(0, dmin * dmin - 4.5)) - 2.2) / 1.5);
      L[c] = 1 + (sum / nt - 1) * w;
    }
}

export function setup(params) {
  const S = (params.s = makeState());
  const kn = [0, 2, 0, 0.5];
  S.knobs = kn;
  for (const C of [S.top, S.bot]) {
    refresh(C, S, C.ell ? 0.5 : 0, 0);
    for (let g = 0; g < NGROUPS; g++) evalGroup(C, g);
    innerStats(C);
    C.lref = cl(C.p96 * 1.1, 2.8, 60);
  }
}

function innerStats(C) {
  const { L, inside } = C, nin = C.nin;
  let s = 0, mx = 0;
  for (let q = 0; q < nin; q++) {
    const v = L[inside[q]];
    s += v;
    if (v > mx) mx = v;
  }
  C.dos = s / max(1, nin);
  C.mx = mx;
  // the 96th percentile of the density inside the ring sets the gain
  const m = nin, tmp = C.qs || (C.qs = new Float32Array(CNN));
  for (let q = 0; q < m; q++) tmp[q] = L[inside[q]];
  tmp.subarray(0, m).sort();
  C.p96 = tmp[min(m - 1, floor(m * 0.96))];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.5], d = cl(dt || 0, 0, 0.1);
  S.knobs = kn;
  S.t += d;
  const e = cl(kn[3], 0.5, 0.8), leak = cl(kn[2], 0, 1);
  const f = S.frame++;
  // A turn of Leak or Ellipse redraws the rings it touches at once, all four quarters, instead of a quarter a frame.
  const leakMoved = leak !== S.leakNow, eMoved = e !== S.eNow;
  S.leakNow = leak;
  S.eNow = e;
  if (leakMoved) {
    refresh(S.top, S, 0, leak);
    for (let g = 0; g < NGROUPS; g++) evalGroup(S.top, g);
  }
  if (leakMoved || eMoved) {
    refresh(S.bot, S, e, leak);
    for (let g = 0; g < NGROUPS; g++) evalGroup(S.bot, g);
  }
  if (f % 3 === 0) refresh(S.top, S, 0, leak);
  else if (f % 3 === 1) refresh(S.bot, S, e, leak);
  const g = f % NGROUPS;
  evalGroup(S.top, g);
  evalGroup(S.bot, g);
  innerStats(S.top);
  innerStats(S.bot);
  // The sweep slows down on a resonance and hurries between them. The mean density of states inside the rings sits
  // under 0.6 between resonances and climbs to 1.5 and well above on one: the speed is 1.9 times its base value in the
  // gaps, 1 at a density of 0.9 and a fifth of it above 2.2.
  const dm = max(S.top.dos, S.bot.dos);
  S.dosS += (dm - S.dosS) * (1 - exp(-d / (dm > S.dosS ? 0.12 : 0.6)));
  S.gate = (0.2 + 0.8 * (1 - sm((S.dosS - 0.9) / 1.3))) * (1 + 0.9 * (1 - sm((S.dosS - 0.3) / 0.6)));
  const sw = cl(kn[1], 0, 3);
  const wob = 1 + 0.3 * sin(0.23 * S.t + 1) + 0.2 * sin(0.071 * S.t + 2.2) + 0.12 * sin(0.53 * S.t);
  const dq = sw * 0.06 * wob * S.gate * sqrt(7 / S.q) * d;
  S.q += S.dir * dq;
  // The rings breathe with the distance the bias has travelled, not with time, so that Sweep 0 keeps its mode.
  S.trav += dq;
  S.sc1 = 1 + 0.022 * sin(0.29 * S.trav) + 0.008 * sin(0.113 * S.trav);
  S.sc2 = 1 + 0.015 * sin(0.19 * S.trav) + 0.008 * sin(0.087 * S.trav);
  S.de = 0.045 * sin(0.23 * S.trav) + 0.03 * sin(0.071 * S.trav);
  // The two turning points wander, 8.1 to 10.3 at the top and 2.2 to 4.0 at the bottom, so that the sweep never
  // runs the same stretch twice.
  const qhi = QMAX - 2.2 * (0.5 + 0.5 * sin(0.0151 * S.t + 0.9)), qlo = QMIN + 1.8 * (0.5 + 0.5 * sin(0.0113 * S.t + 2.1));
  if (S.q > qhi) S.dir = -1;
  else if (S.q < qlo) S.dir = 1;
}

function buildLut(S, hue) {
  const t = [0, 0, 0];
  for (let k = 0; k < 256; k++) {
    stopColour(k / 255, t);
    const [h, s, v] = hsvOf(t[0], t[1], t[2]);
    S.lut.set(rgbOf(h + hue, s, v), k * 3);
  }
  S.atomCol = rgbOf(0.125 + hue, 0.62, 1);
  S.coCol = rgbOf(0.97 + hue, 0.45, 1);
  S.hueDone = hue;
}

// 6-tap midpoint interpolation, (3, -25, 150, 150, -25, 3) / 256, of the coarse grid up to full size.
function upsample(C, S, out, y0) {
  const { L } = C, tmp = S.tmp;
  for (let cy = 0; cy < CN; cy++) {
    const row = cy * CN;
    for (let x = 0; x < W; x += 2) tmp[cy * W + x] = L[row + (x >> 1)];
    for (let x = 1; x < W; x += 2) {
      const j = x >> 1;
      const a = L[row + max(j - 2, 0)], b = L[row + max(j - 1, 0)], c = L[row + j], d = L[row + j + 1];
      const e = L[row + min(j + 2, CN - 1)], f = L[row + min(j + 3, CN - 1)];
      tmp[cy * W + x] = (3 * (a + f) - 25 * (b + e) + 150 * (c + d)) / 256;
    }
  }
  for (let y = 0; y < HALF; y++) {
    const j = y >> 1;
    if ((y & 1) === 0) {
      for (let x = 0; x < W; x++) out[y * W + x] = tmp[j * W + x];
    } else {
      const r0 = max(j - 2, 0) * W, r1 = max(j - 1, 0) * W, r2 = j * W, r3 = (j + 1) * W, r4 = min(j + 2, CN - 1) * W, r5 = min(j + 3, CN - 1) * W;
      for (let x = 0; x < W; x++) out[y * W + x] = (3 * (tmp[r0 + x] + tmp[r5 + x]) - 25 * (tmp[r1 + x] + tmp[r4 + x]) + 150 * (tmp[r2 + x] + tmp[r3 + x])) / 256;
    }
  }
}

function paintHalf(C, S, yoff, flip) {
  const img = S.img, buf = S.buf, lut = S.lut;
  upsample(C, S, img, 0);
  // gain follows the tallest ripple inside the ring, and blends from one half to the other over rows 52 to 76
  const lt = log(S.top.lref), lb = log(S.bot.lref);
  for (let y = 0; y < HALF; y++) {
    const w = sm((yoff + y - 52) / 24), k1 = 1 / log(1 + exp(lt + (lb - lt) * w) / L1);
    // fade of the ground ripple towards the seam between the halves
    const ds = flip ? y + 0.5 : HALF - y - 0.5;
    const fade = sm(ds / 6);
    for (let x = 0; x < W; x++) {
      let L = img[y * W + x];
      L = 1 + (L - 1) * fade;
      if (L < 0) L = 0;
      const u = pow(cl(log(1 + L / L1) * k1, 0, 1), 1.3);
      const li = ((u * 255) | 0) * 3, o = ((yoff + y) * W + x) * 3;
      buf[o] = lut[li];
      buf[o + 1] = lut[li + 1];
      buf[o + 2] = lut[li + 2];
    }
  }
  // atoms: a dark halo, then a gold bump
  const n = C.n;
  for (let i = 0; i < n; i++) {
    const co = C.ell && i === NAT;
    const px = 32 + C.ax[i], py = 32 + C.ay[i];
    const col = co ? S.coCol : S.atomCol, sg = co ? 1.25 : 1.0;
    const x0 = max(0, floor(px - 4)), x1 = min(W - 1, floor(px + 4)), y0 = max(0, floor(py - 4)), y1 = min(HALF - 1, floor(py + 4));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px, dy = y + 0.5 - py, d2 = dx * dx + dy * dy;
        const o = ((yoff + y) * W + x) * 3;
        const halo = 0.7 * exp(-d2 / (2 * 1.7 * 1.7 * sg));
        const a = cl(1.7 * exp(-d2 / (2 * 0.85 * 0.85 * sg)), 0, 1);
        for (let c = 0; c < 3; c++) {
          let v = buf[o + c] * (1 - halo);
          v += (col[c] - v) * a;
          buf[o + c] = v;
        }
      }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.knobs[0], 0, 1), leak = cl(S.knobs[2], 0, 1);
  if (S.hueDone !== hue) buildLut(S, hue);
  for (const C of [S.top, S.bot]) {
    const target = cl((C.p96 || 6) * 1.1, 2.8 - 0.8 * leak, 60);
    C.lref += (target - C.lref) * 0.08;
  }
  paintHalf(S.top, S, 0, false);
  paintHalf(S.bot, S, HALF, true);
  const buf = S.buf;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o], buf[o + 1], buf[o + 2]);
    }
}
