// ===== Patternflow pattern =====
// Title:   Plateau Jets
// Family:  capillary
// Idea:    Four liquid jets of different viscosity stream down the panel from above, each swelling in a ripple that grows as it falls until the neck thins to a thread and snaps, so every column ends in a falling train of drops with a small satellite drop between them, and the faster and the thinner the liquid the lower it breaks.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Plateau-Rayleigh instability of a liquid cylinder (Joseph Plateau, 1873; Lord Rayleigh, "On the instability of jets", 1878), the slender-jet equations solved with a minimum-radius cut (Jens Eggers and Todd Dupont, J. Fluid Mech. 262, 1994; Eggers, Rev. Mod. Phys. 69, 1997) and the drops left ringing in Rayleigh's l = 2 mode; Felix Savart's observations of jets breaking into drops (1833); pattern round 217
// Round:   219
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=1.4..2.5, Wave=-0.6..0.45, Visc=0..1
//
// Knob 1: Hue. Turns the four liquids round the wheel together. At 0 they are a cyan water, an amber, a magenta dye and a lime, left to right; at 0.5 the water is red-orange and the lime violet.
// Knob 2: Flow. How fast the liquid leaves the nozzles, 0.7 to 1.25 times the opening speed (1.4 to 2.5, 2 at the opening). At 2 the jets run at 48 to 96 LEDs a second and the intact column ends 63 to 104 rows down (median); a jet breaks after the same time at any speed, so the length goes with the speed: 36 to 65 rows at 1.4, and at 2.5 all four columns run to the bottom of the panel most of the time, rippled, with a bead swelling at the foot.
// Knob 3: Wave. The wavelength the nozzle's noise is strongest at, in nozzle radii: 11.5 at -0.6, 9.0 at 0 where Rayleigh's fastest wave lies and it opens, 7.5 at 0.45. The long end gives fat beads far apart, the short end a close string of small ones whose ripple grows a little slower, as the cut-off at 6.3 radii is near.
// Knob 4: Visc. All four viscosities together, 0.3 times the opening ones at 0 and 4.5 times at 1 (0.55 times at the opening, 0.06). The Ohnesorge numbers of water, amber, magenta and lime are 0.008, 0.14, 0.04 and 0.017 at the opening, 0.006, 0.08, 0.02 and 0.009 at 0 (thin threads, a satellite on every break) and 0.06, 1.2, 0.3 and 0.13 at 1, where the necks are thick and long and the amber is a column with beads on a string that hardly breaks on the panel.

// Plateau saw it and Rayleigh explained it: a jet of liquid is a cylinder held only by surface tension, and
// any ripple on it longer than its circumference lowers its surface at fixed volume, so it grows. Each jet
// here is the slender-jet model of Eggers and Dupont on a grid of one cell per LED, in the frame that falls
// with the jet. With h the radius in units of the nozzle radius a, v the velocity along the jet in a / tau,
// tau = sqrt(rho a^3 / sigma), and Oh = mu / sqrt(rho sigma a) the Ohnesorge number:
//   d(h^2)/dt + d(h^2 v)/dz = 0
//   dv/dt + v dv/dz = -d kappa/dz + 3 Oh (h^2 dv/dz)' / h^2
//   kappa = 1 / (h sqrt(1 + h'^2)) - h'' / (1 + h'^2)^(3/2)
// h lives at the cells and v at the faces between them, the velocity is updated before the area (so the
// capillary waves do not heat up), the flux of h^2 is centred, and the area is conserved to rounding except
// where a cell is nearly empty and may give away no more than half of what it holds. The step follows the
// stiffest term, dt <= 0.07 dz^2 sqrt(2 / h_max), the speed of the thinning neck, the speed of the flow and
// the viscous term: about 0.0085 tau, thirty or so steps to a frame. The inviscid long-wave growth rate is
//   s^2 = k^2 (1 - k^2) / 2   (a = 1), largest at k = 0.707, so s = 0.354 tau^-1 and a wavelength of 8.9 a,
// next to Rayleigh's exact 0.343 and 0.697 for the full jet; the model has the same cut-off at k a = 1.
//
// The jet is a conveyor: every 1 / U seconds the whole grid moves down a cell and a new cell enters at
// the top with h = 1 + noise, a sum of three lines at the wavelength of the Wave knob (0.88, 1 and 1.13 of
// it) and a white part, times a nozzle radius that wanders by about 15 percent. Each cell is older than the
// one above it, so the ripple grows down the panel, and a faster jet is the same jet stretched: it breaks after
// about the same time, so lower. The speed of the frame itself is held, so the model leaves out the thinning of
// a jet as it falls; gravity acts on the drops once they are free. Where the neck of a cell falls under 0.1 a,
// the thread is cut. The cells below the cut are a fragment: it is split at any other neck into beads, each
// bead becomes a drop of its volume, and the thin cells at the top of each bead, under the neck, a satellite
// (never less than a tenth of the bead, never more than three tenths), which starts as long as the thread was
// and draws itself in. A thread end thinner than the cut is drawn back a cell at a time, and a bead that has
// swollen to a radius of 2.6 a lets go with the thread above it. The drops fall under gravity, 70 LEDs a second
// squared, from the speed of the fluid they were; each rings as a spheroid of fixed volume, axis ratio
// q0^(cos(w t) exp(-b t)) with w^2 = 8 / R^3 (Rayleigh's l = 2 mode) and b = 5 Oh / R^2 (Lamb's rate for a
// viscous drop) with a floor, and two drops that touch merge and ring again. The four jets differ by Oh (0.014,
// 0.26, 0.07 and 0.03 before the knob), by tau (0.097 to 0.13 s), by speed and by radius (2.6 to
// 3.3 LEDs). The speed, the noise lines and level, the viscosity, the wavelength and the nozzle radius wander
// on sines of 29 to 113 s, no two sharing a period, so the point where each jet breaks stutters, from 54 to
// 128 rows for the water at the opening. The first frame runs 7 s of panel time ahead so that the picture opens
// already broken up. If a grid ever goes bad (a negative or huge area, a speed over 80 a / tau) the jet is
// smoothed back to the nozzle's noise and goes on; it did not happen in 900 s at any of the corners tried.
//
// Each column is drawn as a body of revolution: for every row the radius of the profile gives the edge,
// covered by the share of the LED inside it, and the surface normal across the jet and along its slope gives
// a lit cylinder with a specular streak at 0.33 of the radius left of the axis, a dark side, a thin bright rim and
// a faint core line where the liquid is a lens. A thread under 2 LEDs across is drawn 2 wide and dimmer. The
// drops are spheroids lit the same way, with the lens brightening on the side away from the streak.

const W = 64, H = 128;
const NJ = 4;
const N = 144;
const { floor, ceil, sqrt, exp, sin, cos, pow, abs, min, max, PI } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const CX = [8, 24, 40, 56];
const RAD = [3.2, 2.6, 2.9, 3.3];
const OH0 = [0.014, 0.26, 0.07, 0.03];
const TAU = [0.12, 0.105, 0.13, 0.097];
const U0 = [80, 48, 63, 96];
const HUE0 = [0.52, 0.105, 0.885, 0.285];
const WAVE_OFFSET = [0, 0.05, -0.04, 0.03];
const GRAV = 70;
const A_CUT = 0.01;
const A_MIN = 0.0009;
const STEP_CAP = 0.03;
const STIFF = 0.07;
const PRELOAD = 7;
const PERIODS = [
  [37.3, 61.1, 97.7],
  [29.9, 53.3, 83.9],
  [43.1, 71.9, 113.3],
  [33.7, 47.9, 89.3],
];

// Scratch rows for one step of one jet.
const HS = new Float64Array(N + 2);
const KS = new Float64Array(N + 2);
const VN = new Float64Array(N + 2);
const FL = new Float64Array(N + 2);

function wn(t, j, i) {
  return sin((TWO_PI * t) / PERIODS[j][i] + 1.7 * j + 2.3 * i + 0.6);
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.73;
}

function hsv(h, s, v, out) {
  h = h - floor(h);
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const u = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? u : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? u : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? u : k === 5 ? q : p;
}

function makeJet() {
  return {
    A: new Float64Array(N),
    v: new Float64Array(N),
    M: 0,
    s: 0,
    ph: [Math.random() * TWO_PI, Math.random() * TWO_PI, Math.random() * TWO_PI],
    kk: [0.6, 0.7, 0.8],
    am: [0.01, 0.02, 0.01],
    sig: 0.006,
    rn: 1,
    cap: 0.01,
    cut: -1,
    U: 50,
    oh: 0.05,
    resets: 0,
  };
}

function insertCell(jt, dz) {
  let e = jt.sig * gauss();
  for (let m = 0; m < 3; m++) {
    jt.ph[m] += jt.kk[m] * dz;
    e += jt.am[m] * sin(jt.ph[m]);
  }
  const h = cl((1 + e) * jt.rn, 0.6, 1.5);
  const keep = min(jt.M, N - 1);
  jt.A.copyWithin(1, 0, keep);
  jt.v.copyWithin(1, 0, keep);
  jt.A[0] = h * h;
  jt.v[0] = 0;
  jt.M = min(jt.M + 1, N);
  jt.v[jt.M - 1] = 0;
}

// One step of the slender-jet equations on a jet of M cells of size dz, closed at both ends.
function physStep(jt, dt, oh, dz) {
  const M = jt.M, A = jt.A, v = jt.v;
  const idz = 1 / dz, idz2 = idz * idz;
  for (let i = 0; i < M; i++) HS[i] = sqrt(A[i]);
  for (let i = 0; i < M; i++) {
    const h0 = HS[i];
    const hm = i > 0 ? HS[i - 1] : h0;
    const hp = i < M - 1 ? HS[i + 1] : h0;
    const d1 = 0.5 * (hp - hm) * idz;
    const d2 = (hp - 2 * h0 + hm) * idz2;
    const s2 = 1 + d1 * d1;
    const s = sqrt(s2);
    KS[i] = 1 / (h0 * s) - d2 / (s2 * s);
  }
  const L = M - 1;
  const oh3 = 3 * oh;
  for (let f = 0; f < L; f++) {
    const vf = v[f];
    const vl = f > 0 ? v[f - 1] : 0;
    const vr = f < L - 1 ? v[f + 1] : 0;
    const Af = 0.5 * (A[f] + A[f + 1]);
    const visc = (oh3 * (A[f + 1] * (vr - vf) - A[f] * (vf - vl)) * idz2) / Af;
    VN[f] = vf + dt * (-(KS[f + 1] - KS[f]) * idz - vf * (vr - vl) * 0.5 * idz + visc);
  }
  // The flux of area is centred, and no cell may give away more than half of what it holds through one face.
  const lim = 0.5 * dz / dt;
  for (let f = 0; f < L; f++) {
    const w = VN[f];
    v[f] = w;
    let fx = 0.5 * (A[f] + A[f + 1]) * w;
    const room = lim * (w > 0 ? A[f] : A[f + 1]);
    if (fx > room) fx = room;
    else if (fx < -room) fx = -room;
    FL[f] = fx;
  }
  v[L] = 0;
  for (let i = 0; i < M; i++) {
    const fl = i > 0 ? FL[i - 1] : 0;
    const fr = i < L ? FL[i] : 0;
    let a = A[i] - dt * idz * (fr - fl);
    if (a < A_MIN) a = A_MIN;
    A[i] = a;
  }
}

// Looks for a neck to cut and sets the next step. False when the grid has gone bad.
function scan(jt, oh, dz) {
  const A = jt.A, v = jt.v;
  // A thread end thinner than the cut is drawn back a cell at a time.
  while (jt.M > 10 && A[jt.M - 1] < A_CUT) jt.M--;
  jt.v[jt.M - 1] = 0;
  const M = jt.M;
  let amin = 9, imin = -1, amax = 0, vmax = 0, aneck = 9;
  for (let i = 0; i < M; i++) {
    const a = A[i];
    if (!(a >= 0 && a < 60)) return false;
    if (a > amax) amax = a;
    if (i >= 3 && i <= M - 2) {
      if (a < aneck) aneck = a;
      if (a < amin && a <= A[i - 1] && a <= A[i + 1]) {
        amin = a;
        imin = i;
      }
    }
    const w = abs(v[i]);
    if (!(w < 80)) return false;
    if (w > vmax) vmax = w;
  }
  jt.cut = amin < A_CUT ? imin : -1;
  if (jt.cut < 0 && amax > 7) {
    // A bead that has swollen past anything a ripple makes lets go with the thread above it.
    let im = 0;
    for (let i = 0; i < M; i++) if (A[i] === amax) im = i;
    let lo = im;
    while (lo > 3 && A[lo - 1] > 0.4) lo--;
    if (lo >= 3 && lo < M - 1) jt.cut = lo - 1;
  }
  const hmax = sqrt(max(amax, 0.25));
  const hn = sqrt(min(aneck, 1));
  jt.cap = min(
    STEP_CAP,
    STIFF * dz * dz * sqrt(2 / hmax),
    (0.4 * dz) / (vmax + 0.01),
    0.42 * hn * sqrt(hn),
    (0.2 * dz * dz) / (6 * oh + 1e-4),
  );
  if (jt.cap < 1e-4) jt.cap = 1e-4;
  return true;
}

function addDrop(params, j, y, vy, vol, q0) {
  const a = RAD[j];
  const Ra = pow(0.75 * vol, 1 / 3);
  const oh = params.jets[j].oh;
  const om = min(sqrt(8 / (Ra * Ra * Ra)), 3.2) / TAU[j];
  const be = min(5 * oh / (Ra * Ra) + 0.2, 3.5) / TAU[j];
  const drops = params.drops;
  if (drops.length > 60) drops.shift();
  drops.push({ j, y, vy: cl(vy, 0, 400), V: vol, R: Ra * a, q0, om, be, age: 0 });
}

// Cuts the jet at the neck j: what lies below becomes drops, and the thread above is left to draw itself in.
function pinch(params, jt, j, dz) {
  const A = jt.A, v = jt.v, M = jt.M;
  const jet = params.jets.indexOf(jt);
  const a = RAD[jet];
  const velScale = a / TAU[jet];
  const edges = [j + 1];
  for (let i = j + 4; i < M - 3; i++) {
    if (A[i] < 0.64 && A[i] <= A[i - 1] && A[i] <= A[i + 1]) {
      edges.push(i);
      i += 3;
    }
  }
  edges.push(M);
  for (let b = 0; b < edges.length - 1; b++) {
    const b0 = edges[b], b1 = edges[b + 1];
    let vol = 0, zs = 0, vs = 0;
    for (let i = b0; i < b1; i++) {
      const w = A[i] * dz;
      vol += w;
      zs += w * i;
      vs += w * 0.5 * ((i > 0 ? v[i - 1] : 0) + v[i]);
    }
    if (vol < 0.02) continue;
    const zc = zs / vol;
    const vm = cl(vs / vol, -1.2, 1.2) * velScale;
    // The thin cells at the top of the bead, under the neck, are its satellite.
    let nz = 0, vz = 0, zz = 0, vzv = 0;
    for (let i = b0; i < b1 && A[i] < 0.25; i++) {
      const w = A[i] * dz;
      nz++;
      vz += w;
      zz += w * i;
      vzv += w * 0.5 * ((i > 0 ? v[i - 1] : 0) + v[i]);
    }
    const yTop = jt.s + 0.5;
    let main = vol;
    if (nz >= 2 && vol > 0.5) {
      const vs2 = cl(vz, 0.1 * vol, 0.3 * vol);
      main = vol - vs2;
      const zsat = zz / max(vz, 1e-6);
      const len = nz * dz;
      const Rs = pow(0.75 * vs2, 1 / 3);
      addDrop(params, jet, yTop + zsat, jt.U + cl(vzv / max(vz, 1e-6), -1.2, 1.2) * velScale, vs2, cl(len / (2 * Rs), 1, 3.4));
    }
    const lenB = (b1 - b0) * dz;
    const Rb = pow(0.75 * main, 1 / 3);
    addDrop(params, jet, yTop + zc, jt.U + vm, main, cl(lenB / (2 * Rb), 1, 1.7));
  }
  jt.M = j + 1;
  jt.v[j] = 0;
}

// A grid that has gone bad is smoothed over: the jet keeps its length and its ripple starts again from the nozzle's noise.
function resetJet(params, jt) {
  const M = jt.M;
  jt.A.fill(1);
  jt.v.fill(0);
  for (let i = 0; i < M; i++) {
    const h = 1 + 0.02 * gauss();
    jt.A[i] = h * h;
  }
  jt.cut = -1;
  jt.cap = 0.01;
  jt.resets++;
}

// Advances one jet by dtSec seconds of its own time.
function advance(params, jt, j, dtSec, oh, dz) {
  let rem = dtSec / TAU[j];
  let guard = 0;
  while (rem > 1e-9 && jt.M >= 8 && guard++ < 3000) {
    if (!scan(jt, oh, dz)) {
      resetJet(params, jt);
      return;
    }
    if (jt.cut >= 0) {
      pinch(params, jt, jt.cut, dz);
      continue;
    }
    const dt = min(rem, jt.cap);
    physStep(jt, dt, oh, dz);
    rem -= dt;
  }
}

function mergeDrops(params) {
  const d = params.drops;
  for (let a = 0; a < d.length; a++) {
    for (let b = a + 1; b < d.length; b++) {
      const p = d[a], q = d[b];
      if (p.j !== q.j) continue;
      if (abs(p.y - q.y) < 0.8 * (p.R + q.R)) {
        const vol = p.V + q.V;
        p.y = (p.y * p.V + q.y * q.V) / vol;
        p.vy = (p.vy * p.V + q.vy * q.V) / vol;
        p.V = vol;
        const Ra = pow(0.75 * vol, 1 / 3);
        const oh = params.jets[p.j].oh;
        p.R = Ra * RAD[p.j];
        p.q0 = 1.45;
        p.age = 0;
        p.om = min(sqrt(8 / (Ra * Ra * Ra)), 3.2) / TAU[p.j];
        p.be = min((5 * oh) / (Ra * Ra) + 0.2, 3.5) / TAU[p.j];
        d.splice(b, 1);
        b = a;
      }
    }
  }
}

function stepFrame(params, dt, k) {
  const t = params.t;
  const f = k[1] / 2;
  const ka0 = 0.7 + (k[2] < 0 ? 0.26 : 0.3) * k[2];
  const visc = 0.3 + 4.2 * k[3];
  for (let j = 0; j < NJ; j++) {
    const jt = params.jets[j];
    const dz = 1 / RAD[j];
    jt.U = U0[j] * f * (1 + 0.16 * wn(t, j, 0) + 0.1 * wn(t, j, 1) + 0.06 * wn(t, j, 2));
    jt.oh = cl(OH0[j] * visc * (1 + 0.12 * wn(t, j, 1)), 0.006, 1.5);
    const ka = ka0 * (1 + WAVE_OFFSET[j]) * (1 + 0.035 * wn(t, j, 2));
    jt.kk[0] = ka * 0.88;
    jt.kk[1] = ka;
    jt.kk[2] = ka * 1.13;
    const g = exp(0.55 * wn(t, j, 1) + 0.3 * wn(t, j, 2));
    jt.am[0] = 0.025 * g;
    jt.am[1] = 0.055 * g;
    jt.am[2] = 0.03 * g;
    jt.sig = 0.02 * exp(0.5 * wn(t, j, 0));
    jt.rn = 1 + 0.09 * wn(t + 17, j, 1) + 0.07 * wn(t + 41, j, 2) - 0.05 * wn(t + 5, j, 0);
    jt.s += jt.U * dt;
    let guard = 0;
    while (jt.s >= 1 && guard++ < 12) {
      jt.s -= 1;
      insertCell(jt, dz);
    }
    advance(params, jt, j, dt, jt.oh, dz);
  }
  const drops = params.drops;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.age += dt;
    d.vy += GRAV * dt;
    d.y += d.vy * dt;
    if (d.y - d.R * 2.2 > H) drops.splice(i, 1);
  }
  mergeDrops(params);
  params.t += dt;
}

export function setup(params) {
  params.t = 0;
  params.ready = false;
  params.jets = [];
  for (let j = 0; j < NJ; j++) params.jets.push(makeJet());
  params.drops = [];
  params.rr = new Float64Array(H + 2);
  params.buf = new Float32Array(W * H * 3);
  params.body = [new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)];
  params.tint = [new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)];
  params.k = [0, 2, 0, 0.06];
}

export function update(dt, input, params) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const k = params.k;
  k[0] = kv[0];
  k[1] = cl(kv[1], 1.4, 2.5);
  k[2] = cl(kv[2], -0.6, 0.45);
  k[3] = cl(kv[3], 0, 1);
  if (!params.ready) {
    params.ready = true;
    for (let i = 0; i < PRELOAD * 30; i++) stepFrame(params, 1 / 30, k);
  }
  stepFrame(params, min(dt, 0.1), k);
  for (let j = 0; j < NJ; j++) {
    hsv(HUE0[j] + k[0], 0.86, 1, params.body[j]);
    hsv(HUE0[j] + k[0], 0.2, 1, params.tint[j]);
  }
}

// Light from the upper left and front; H is the half vector to the viewer.
const LX = -0.6, LY = -0.3, LZ = 0.74;
const HX = -0.325, HY = -0.162, HZ = 0.941;
const OUT = new Float32Array(3);

// Colour of one point of the liquid with unit normal (nx, ny, nz); lens is its brightening where the light is focused.
function lit(body, tint, nx, ny, nz, lens, dim) {
  const dif = max(0, nx * LX + ny * LY + nz * LZ);
  const sp = max(0, (nx * HX + ny * HY + nz * HZ) / 0.9955);
  const spec = pow(sp, 38);
  const edge = 1 - nz;
  const rim = edge * edge * edge * edge;
  const lum = (0.2 + 0.55 * dif + 0.38 * lens) * dim;
  const wl = min(1, 0.95 * spec * dim * dim + 0.25 * rim * dim);
  OUT[0] = body[0] * lum + tint[0] * 0.55 * rim * dim + wl * (0.3 + 0.7 * tint[0]);
  OUT[1] = body[1] * lum + tint[1] * 0.55 * rim * dim + wl * (0.3 + 0.7 * tint[1]);
  OUT[2] = body[2] * lum + tint[2] * 0.55 * rim * dim + wl * (0.3 + 0.7 * tint[2]);
}

function put(buf, p, cov) {
  const o = p * 3;
  const inv = 1 - cov;
  buf[o] = buf[o] * inv + OUT[0] * 255 * cov;
  buf[o + 1] = buf[o + 1] * inv + OUT[1] * 255 * cov;
  buf[o + 2] = buf[o + 2] * inv + OUT[2] * 255 * cov;
}

function drawColumn(params, j) {
  const jt = params.jets[j];
  const M = jt.M;
  if (M < 2) return;
  const buf = params.buf, rr = params.rr;
  const a = RAD[j];
  const A = jt.A;
  const s = jt.s;
  const cx = CX[j] + 0.35 * sin(params.t * 0.31 + j * 1.9) + 0.25 * sin(params.t * 0.173 + j * 0.7);
  const body = params.body[j], tint = params.tint[j];
  const yTip = M - 1 + s + 0.5;
  const rTip = max(1, a * sqrt(A[M - 1]));
  for (let y = 0; y < H + 2; y++) {
    const fy = y - s;
    let r;
    if (fy <= 0) r = a * sqrt(A[0]);
    else if (fy >= M - 1) {
      const d = y + 0.5 - yTip;
      r = d < rTip ? sqrt(max(0, rTip * rTip - d * d)) : 0;
    } else {
      const i = floor(fy), u = fy - i;
      r = a * ((1 - u) * sqrt(A[i]) + u * sqrt(A[i + 1]));
    }
    rr[y] = r;
  }
  for (let y = 0; y < H; y++) {
    const rp0 = rr[y];
    if (rp0 <= 0.05) continue;
    const thin = cl(0.4 + 0.46 * rp0, 0.4, 1);
    const r = max(rp0, 1);
    const slope = 0.5 * (max(rr[y + 1], 1) - max(y > 0 ? rr[y - 1] : rr[0], 1));
    const inv = 1 / sqrt(1 + slope * slope);
    const x0 = max(0, floor(cx - r - 1)), x1 = min(W - 1, ceil(cx + r + 1));
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      let cov = cl((r - abs(dx)) * inv + 0.5, 0, 1);
      if (cov <= 0) continue;
      cov = cov * cov * (3 - 2 * cov);
      const u = cl(dx / r, -0.999, 0.999);
      const nz = sqrt(1 - u * u);
      const nn = 1 / sqrt(1 + slope * slope);
      const core = exp(-((u - 0.04) * (u - 0.04)) / 0.03);
      const cau = exp(-((u - 0.5) * (u - 0.5)) / 0.05);
      lit(body, tint, u * nn, -slope * nn, nz * nn, 0.3 * core + 0.55 * cau, thin);
      put(buf, y * W + x, cov);
    }
  }
}

function drawDrop(params, d) {
  const buf = params.buf;
  const j = d.j;
  const cx = CX[j] + 0.35 * sin(params.t * 0.31 + j * 1.9) + 0.25 * sin(params.t * 0.173 + j * 0.7);
  const body = params.body[j], tint = params.tint[j];
  const q = exp(Math.log(d.q0) * cos(d.om * d.age) * exp(-d.be * d.age));
  let R = d.R;
  const thin = cl(0.4 + 0.46 * R, 0.4, 1);
  R = max(R, 1);
  const rz = R * q, rx = R / sqrt(q);
  const y0 = max(0, floor(d.y - rz - 1)), y1 = min(H - 1, ceil(d.y + rz + 1));
  const x0 = max(0, floor(cx - rx - 1)), x1 = min(W - 1, ceil(cx + rx + 1));
  const irx = 1 / (rx * rx), irz = 1 / (rz * rz);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - d.y;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const ex = dx * dx * irx, ey = dy * dy * irz;
      const f = ex + ey - 1;
      const gr = 2 * sqrt(dx * dx * irx * irx + dy * dy * irz * irz) + 1e-6;
      let cov = cl(-f / gr + 0.5, 0, 1);
      if (cov <= 0) continue;
      cov = cov * cov * (3 - 2 * cov);
      const zz = sqrt(max(0, 1 - ex - ey)) * rx;
      let nx = dx * irx, ny = dy * irz, nz = zz * irx;
      const nl = 1 / sqrt(nx * nx + ny * ny + nz * nz + 1e-9);
      nx *= nl;
      ny *= nl;
      nz *= nl;
      const px = dx / rx - 0.34, py = dy / rz - 0.3;
      const lens = 0.7 * exp(-(px * px + py * py) / 0.12);
      lit(body, tint, nx, ny, nz, lens, thin);
      put(buf, y * W + x, cov);
    }
  }
}

export function draw(display, params) {
  const buf = params.buf;
  for (let y = 0; y < H; y++) {
    const g = y / (H - 1);
    const r = 3 + 3 * g, gg = 5 + 4 * g, b = 15 + 11 * g;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      buf[o] = r;
      buf[o + 1] = gg;
      buf[o + 2] = b;
    }
  }
  for (let j = 0; j < NJ; j++) drawColumn(params, j);
  const drops = params.drops;
  for (let i = 0; i < drops.length; i++) drawDrop(params, drops[i]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[o], 0, 255) | 0, cl(buf[o + 1], 0, 255) | 0, cl(buf[o + 2], 0, 255) | 0);
    }
  }
}
