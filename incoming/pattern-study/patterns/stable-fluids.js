// ===== Patternflow pattern =====
// Title:   Stable Fluids
// Family:  sim
// Idea:    Ink in a stirred tank, solved as real incompressible flow on the panel's own 64 by 128 torus: wandering paddles, a vortex pair and a jet push the water, a pressure solve keeps it free of divergence, and three dyes are dragged into filaments and curls that never come back to the same picture.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Stable Fluids (Jos Stam, SIGGRAPH 1999, from memory): a semi-Lagrangian step that traces each cell back along the velocity and cannot blow up at any time step, then a projection onto a divergence-free field with a pressure Poisson solve; vorticity confinement (Ronald Fedkiw, Jos Stam and Henrik Wann Jensen, Visual Simulation of Smoke, SIGGRAPH 2001, from memory); velocity on the staggered grid of the marker-and-cell method (Francis Harlow and Eddie Welch, 1965, from memory); the Poisson solve is a red-black Gauss-Seidel multigrid V-cycle (Achi Brandt, 1977, from memory); Catmull-Rom look-up (Edwin Catmull and Raphael Rom, 1974, from memory); colour mixed in OKLab (Bjorn Ottosson, 2020, from memory); pattern round 114, made on the creator's turn of 8 November toward fields that flow for ever
// Round:   114
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stir=0.8..3.2, Scale=-1..1, Diffusion=0..1
//
// Knob 1: Hue. Turns the three dyes round the colour wheel together. At 0 they are a cyan-blue (OKLab hue 205 degrees), a violet (285) and a rose (352) on a black ground, with a pale gold fleck in the core of the strongest vortices; at 0.25 they are violet, coral and gold, and warm hues come up in lightness sooner so that no dye goes brown in the thin parts. One turn of the knob comes back to where it started.
// Knob 2: Stir. How hard the tank is stirred. It scales the paddles' speed (the first moves at 4.5 LEDs a second on average at 0.8, 11 at 2 and 18 at 3.2), the swirl and the jet, the slow background gyres, and the clock of the dye. The water's rms speed is 1.6 LEDs a second at 0.8, 2.9 at 2 and 4.1 at 3.2, and the fastest 1 percent of it 3.3, 7.1 and 10.3. The dye lasts 9.8 s before it has fallen to 1/e at 0.8, 7.1 s at 2 and 5.6 s at 3.2.
// Knob 3: Scale. The size of the stirrers, and so of the eddies they leave. The first paddle's radius is 2.0 LEDs at -1, 3.4 at 0 and 5.7 at 1 (the second is 1.3 times that, the jet 0.85 times), and the dye emitters grow with the 0.35 power of it. At -1 the ink runs in fine threads and small curls; at 1 it is broad ribbons, and the water is a little faster (rms speed 2.3 LEDs a second at -1, 2.9 at 0, 3.7 at 1) because a bigger paddle moves more of it.
// Knob 4: Diffusion. How far the ink bleeds into the water, Fick's law on the dye with kappa = 1.5 K^2 LED^2 per second. At the opening 0.06 it is 0.005 and a filament keeps its edge; at 0.5 it is 0.38; at 1 it is 1.5, a blob 3 LEDs wide has spread to 4.2 in 3 s and the picture is smoke. The flow is the same at every setting.

// What the field is. Velocity u = (u, v) on a torus 64 LEDs wide and 128 tall, du/dt = -(u.grad)u - grad p + f - drag u with div u = 0.
// Each frame is one step of Stam's method: add the forces f (stirrers, background gyres, vorticity confinement), smooth the grid-scale
// noise, carry u along its own back-traced paths, then subtract the gradient of the p that solves del^2 p = div u. The dye c obeys
// dc/dt + u.grad c = kappa del^2 c - decay c + emitters, carried the same way on a grid twice as fine. u sits on the staggered grid
// (U on the vertical cell faces, V on the horizontal ones, p in the cells), so the divergence the solver drives to zero is the one
// the code measures.

const NX = 64, NY = 128, N = NX * NY, MX = NX - 1, MY = NY - 1;
const DS = 2, DNX = NX * DS, DNY = NY * DS, DN = DNX * DNY, DMX = DNX - 1, DMY = DNY - 1;
const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, log, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- tunables
const SIG0 = 3.4; // stirrer radius (LEDs) at Scale 0
const KAPPA = 3.5; // how fast the fluid inside a stirrer is nudged to the stirrer's own motion, 1/s
const FRIC = 0.12; // linear drag on the whole tank, 1/s
const DECAY = 0.14; // dye decay, 1/s
const EMIT = 1.45; // dye emitter strength, 1/s
const VCAP = 60; // no cell is ever faster than this, LEDs/s
const CYC = 2; // V-cycles per projection
const VORT = 0.4; // vorticity confinement, 1/s
const KDIF = 1.5; // dye diffusion at Diffusion 1, LED^2/s
const KB = 0.35; // how fast the slow background gyres pull the whole tank towards themselves, 1/s
const CLEAR = 1.4; // how hard a wandering emitter turns towards clear water, rad/s
const NU4 = 0.06; // hyperviscosity, LED^4/s. It damps a wave 16 LEDs long at 0.001 a second, 8 LEDs at 0.02, 4 at 0.24 and 2 at 0.9

const mod = (v, n) => ((v %= n), v < 0 ? v + n : v);
const mimg = (d, n) => d - n * round(d / n);
function randn() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- interpolation on a periodic NX x NY grid. (fi, fj) are index coordinates.
function bil(f, fi, fj) {
  const i0 = floor(fi), j0 = floor(fj), a = fi - i0, b = fj - j0;
  const x0 = i0 & MX, x1 = (i0 + 1) & MX, r0 = (j0 & MY) * NX, r1 = ((j0 + 1) & MY) * NX;
  return (f[r0 + x0] * (1 - a) + f[r0 + x1] * a) * (1 - b) + (f[r1 + x0] * (1 - a) + f[r1 + x1] * a) * b;
}
// Catmull-Rom, clamped to the four cells around the point.
function cub(f, fi, fj) {
  const i1 = floor(fi), j1 = floor(fj), tx = fi - i1, ty = fj - j1;
  const xa = (i1 - 1) & MX, xb = i1 & MX, xc = (i1 + 1) & MX, xd = (i1 + 2) & MX;
  const t2 = tx * tx, t3 = t2 * tx;
  const ax = -0.5 * t3 + t2 - 0.5 * tx, bx = 1.5 * t3 - 2.5 * t2 + 1, cx = -1.5 * t3 + 2 * t2 + 0.5 * tx, dx = 0.5 * t3 - 0.5 * t2;
  const s2 = ty * ty, s3 = s2 * ty;
  const ay = -0.5 * s3 + s2 - 0.5 * ty, by = 1.5 * s3 - 2.5 * s2 + 1, cy = -1.5 * s3 + 2 * s2 + 0.5 * ty, dy = 0.5 * s3 - 0.5 * s2;
  const ra = ((j1 - 1) & MY) * NX, rb = (j1 & MY) * NX, rc = ((j1 + 1) & MY) * NX, rd = ((j1 + 2) & MY) * NX;
  const va = ax * f[ra + xa] + bx * f[ra + xb] + cx * f[ra + xc] + dx * f[ra + xd];
  const vb = ax * f[rb + xa] + bx * f[rb + xb] + cx * f[rb + xc] + dx * f[rb + xd];
  const vc = ax * f[rc + xa] + bx * f[rc + xb] + cx * f[rc + xc] + dx * f[rc + xd];
  const vd = ax * f[rd + xa] + bx * f[rd + xb] + cx * f[rd + xc] + dx * f[rd + xd];
  const r = ay * va + by * vb + cy * vc + dy * vd;
  const p = f[rb + xb], q = f[rb + xc], s = f[rc + xb], u = f[rc + xc];
  const lo = min(min(p, q), min(s, u)), hi = max(max(p, q), max(s, u));
  return r < lo ? lo : r > hi ? hi : r;
}

// ---- the wandering. A walker's heading is a slowly turning mean plus three
// incommensurate sines plus a slow Ornstein-Uhlenbeck noise; its speed is
// breathing on two more sines. Phases wrap every step, so time never grows.
function walker(speed, drift) {
  const w = {
    x: Math.random() * NX, y: Math.random() * NY, base: Math.random() * TAU, dr: drift, ou: 0, speed,
    ph: [], fr: [], am: [0.9, 0.7, 0.45, 0.3, 0.2], vx: 0, vy: 0, th: 0,
  };
  const f0 = [0.17, 0.29, 0.53, 0.23, 0.41];
  for (let k = 0; k < 5; k++) {
    w.ph.push(Math.random() * TAU);
    w.fr.push(f0[k] * (0.8 + 0.4 * Math.random()));
  }
  return w;
}
function walk(w, dt, spd) {
  w.base = mod(w.base + w.dr * dt, TAU);
  w.ou += (-w.ou / 5) * dt + 0.45 * sqrt(dt) * randn();
  for (let k = 0; k < 5; k++) w.ph[k] = mod(w.ph[k] + w.fr[k] * dt, TAU);
  w.th = w.base + w.am[0] * sin(w.ph[0]) + w.am[1] * sin(w.ph[1]) + w.am[2] * sin(w.ph[2]) + w.ou;
  const sp = spd * w.speed * (1 + w.am[3] * sin(w.ph[3]) + w.am[4] * sin(w.ph[4]));
  w.vx = sp * cos(w.th);
  w.vy = sp * sin(w.th);
  w.x = mod(w.x + w.vx * dt, NX);
  w.y = mod(w.y + w.vy * dt, NY);
}

// ---- state
function newState() {
  const F = () => new Float64Array(N);
  const S = {
    U: F(), V: F(), U2: F(), V2: F(), om: F(), wc: F(), ws: F(), sp: F(), aw: F(), fx: F(), fy: F(),
    D: new Float32Array(3 * DN), D2: new Float32Array(3 * DN),
    lv: [], st: [], em: [], psi: F(), tab: [new Float64Array(NX), new Float64Array(NX), new Float64Array(NY), new Float64Array(NY)], cg: new Float64Array(8 * 16), tick: 0,
    bg: [[1, 1, 1, 0.071], [1, -2, 0.8, 0.093], [2, 1, 0.6, 0.057], [3, -1, 0.45, 0.121]].map(([a, b, w, f]) => ({ a, b, w, f, ph: Math.random() * TAU })),
    emitted: 0, decayed: 0, advErr: 0, mass: 0,
    stir: 2, tempo: 1, nu4: NU4, sg: SIG0, vort: VORT, kdif: 0, hueDone: -1,
    // switches the checks flip to compare: cubic or linear look-up for the velocity (lim) and the dye (dcub), the mass correction (fix), V-cycles per step
    lim: 1, dcub: 1, fix: 1, cyc: CYC,
    wref: 0.3, wpk: 1, uref: 5, lut: [new Float32Array(4 * 1024), new Float32Array(4 * 1024), new Float32Array(4 * 1024)],
  };
  for (let nx = NX, ny = NY; nx >= 4; nx >>= 1, ny >>= 1)
    S.lv.push({ nx, ny, p: new Float64Array(nx * ny), f: new Float64Array(nx * ny), r: new Float64Array(nx * ny) });
  S.st = [
    { kind: 0, w: walker(1.0, 0.05), sg: 1.0, ps: 5.6, v: 0 },
    { kind: 0, w: walker(1.0, -0.04), sg: 1.3, ps: 4.6, v: 0 },
    { kind: 2, w: walker(1.0, 0.035), sg: 1.0, ps: 2.6, v: 5.0, ax: Math.random() * TAU },
    { kind: 3, w: walker(1.0, -0.06), sg: 0.85, ps: 2.8, v: 6.0, al: Math.random() * TAU },
  ];
  const em = (sp, a, o, ps) => ({ sp, a, o, ps, w: walker(1, (Math.random() - 0.5) * 0.12), ph: Math.random() * TAU, fr: 0.3 + 0.15 * Math.random(), mp: Math.random() * TAU, mf: 0.14 + 0.12 * Math.random() });
  // three dyes. One emitter of each rides in the wake of a stirrer; three more of each wander on their own.
  S.em = [em(0, 2, 1.1, 0), em(1, 0, -1.6, 0), em(2, 3, 1.4, 0), em(0, -1, 0, 5.5), em(1, -1, 0, 4.5), em(2, -1, 0, 6.5), em(0, -1, 0, 4), em(1, -1, 0, 6), em(2, -1, 0, 5), em(0, -1, 0, 6.5), em(1, -1, 0, 5), em(2, -1, 0, 4)];
  return S;
}

// Divergence-free start: velocity from a stream function of a few whole-number plane waves.
function seedState(S) {
  const psi = new Float64Array(N);
  for (let m = 0; m < 14; m++) {
    const a = round((Math.random() - 0.5) * 7), b = round((Math.random() - 0.5) * 9);
    if (!a && !b) continue;
    const kx = (TAU * a) / NX, ky = (TAU * b) / NY, ph = Math.random() * TAU;
    const amp = (1.6 * randn()) / sqrt(kx * kx + ky * ky);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) psi[j * NX + i] += amp * sin(kx * i + ky * j + ph);
  }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      S.U[k] = psi[((j + 1) & MY) * NX + i] - psi[k];
      S.V[k] = -(psi[j * NX + ((i + 1) & MX)] - psi[k]);
    }
  for (let b = 0; b < 12; b++) {
    const cx = Math.random() * DNX, cy = Math.random() * DNY, sp = b % 3, sg = (2 + Math.random() * 5) * DS, pk = 0.55 + 0.4 * Math.random();
    const R = ceil(3 * sg);
    for (let dj = -R; dj <= R; dj++)
      for (let di = -R; di <= R; di++) {
        const v = pk * exp(-(di * di + dj * dj) / (2 * sg * sg));
        const k = 3 * (((floor(cy) + dj) & DMY) * DNX + ((floor(cx) + di) & DMX)) + sp;
        S.D[k] = max(S.D[k], v);
      }
  }
}

// ---- forcing. Inside a blob the fluid is nudged towards the stirrer's own motion,
// u += (1 - exp(-kappa g dt)) (target - u), so a long step cannot overshoot.
function nudge(S, cx, cy, sg, kind, ta, tb, q, dt) {
  const { U, V } = S;
  const R = ceil(3.1 * sg * (kind === 1 ? 1.3 : 1));
  const kd = KAPPA * dt, is2 = 1 / (2 * sg * sg * (kind === 1 ? 1.69 : 1)), isw = 1 / (sg * sg);
  const i0 = floor(cx), j0 = floor(cy);
  for (let dj = -R; dj <= R; dj++)
    for (let di = -R; di <= R; di++) {
      const i = i0 + di, j = j0 + dj;
      const k = (j & MY) * NX + (i & MX);
      // U face at (i, j + 1/2)
      let dx = i - cx, dy = j + 0.5 - cy, r2 = dx * dx + dy * dy;
      let g = exp(-r2 * is2);
      if (g > 0.003) {
        const tu = kind === 1 ? q * ta * exp(0.5 - 0.5 * r2 * isw) * -dy * (1 / sg) : ta;
        U[k] += (1 - exp(-kd * g)) * (tu - U[k]);
      }
      // V face at (i + 1/2, j)
      dx = i + 0.5 - cx;
      dy = j - cy;
      r2 = dx * dx + dy * dy;
      g = exp(-r2 * is2);
      if (g > 0.003) {
        const tv = kind === 1 ? q * ta * exp(0.5 - 0.5 * r2 * isw) * dx * (1 / sg) : tb;
        V[k] += (1 - exp(-kd * g)) * (tv - V[k]);
      }
    }
}

// The tank is also rocked: four large gyres (whole-number waves, the longest 64 LEDs across) drift in phase at their own
// slow rates, and the water is pulled gently towards them everywhere, so no corner sits still for long.
function background(S, dt) {
  const { psi, U, V } = S, v0 = 1.2 + 0.7 * S.stir, kd = 1 - exp(-KB * dt);
  psi.fill(0);
  const [sx, cx, sy, cy] = S.tab;
  for (const m of S.bg) {
    m.ph = mod(m.ph + m.f * dt, TAU);
    const kx = (TAU * m.a) / NX, ky = (TAU * m.b) / NY, A = (v0 * m.w) / sqrt(kx * kx + ky * ky);
    for (let i = 0; i < NX; i++) (sx[i] = sin(kx * i + m.ph)), (cx[i] = cos(kx * i + m.ph));
    for (let j = 0; j < NY; j++) (sy[j] = A * sin(ky * j)), (cy[j] = A * cos(ky * j));
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) psi[j * NX + i] += sx[i] * cy[j] + cx[i] * sy[j];
  }
  for (let j = 0; j < NY; j++) {
    const o = j * NX, up = ((j + 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      U[o + i] += kd * (psi[up + i] - psi[o + i] - U[o + i]);
      V[o + i] += kd * (-(psi[o + ((i + 1) & MX)] - psi[o + i]) - V[o + i]);
    }
  }
}

function addForces(S, dt) {
  const k2 = S.stir, sg0 = S.sg;
  for (const s of S.st) {
    const w = s.w;
    walk(w, dt, k2 * s.ps);
    const sg = sg0 * s.sg;
    if (s.kind === 0) nudge(S, w.x, w.y, sg, 0, w.vx, w.vy, 0, dt);
    else if (s.kind === 2) {
      s.ax = mod(s.ax + 0.11 * dt, TAU);
      const d = 1.25 * sg, ux = cos(s.ax) * d, uy = sin(s.ax) * d, v = s.v * k2;
      nudge(S, w.x + ux, w.y + uy, sg, 1, v, 0, 1, dt);
      nudge(S, w.x - ux, w.y - uy, sg, 1, v, 0, -1, dt);
    } else {
      s.al = mod(s.al + (0.19 + 0.3 * sin(w.ph[0])) * dt, TAU);
      const v = s.v * k2;
      nudge(S, w.x, w.y, sg, 0, v * cos(s.al), v * sin(s.al), 0, dt);
    }
  }
  background(S, dt);
  // nobody pushes the tank as a whole: take out the mean current
  let mu = 0, mv = 0;
  for (let k = 0; k < N; k++) (mu += S.U[k]), (mv += S.V[k]);
  mu /= N;
  mv /= N;
  if (!isFinite(mu + mv)) {
    // never reached in the runs below; if a value ever went bad, start the tank over rather than stay dark
    S.U.fill(0);
    S.V.fill(0);
    S.D.fill(0);
    seedState(S);
    return;
  }
  const fr = exp(-FRIC * dt);
  for (let k = 0; k < N; k++) {
    S.U[k] = cl((S.U[k] - mu) * fr, -VCAP, VCAP);
    S.V[k] = cl((S.V[k] - mv) * fr, -VCAP, VCAP);
  }
}

// u -= c del^4 u, on both components, as two passes of the five-point Laplacian
function lap(f, g) {
  for (let j = 0; j < NY; j++) {
    const o = j * NX, up = ((j + 1) & MY) * NX, dn = ((j - 1) & MY) * NX;
    for (let i = 0; i < NX; i++) g[o + i] = f[o + ((i + 1) & MX)] + f[o + ((i - 1) & MX)] + f[up + i] + f[dn + i] - 4 * f[o + i];
  }
}
function hyper(S, dt) {
  const c = min(S.nu4 * dt, 0.02);
  if (c <= 0) return;
  for (const F of [S.U, S.V]) {
    lap(F, S.fx);
    lap(S.fx, S.fy);
    for (let k = 0; k < N; k++) F[k] -= c * S.fy[k];
  }
}

// ---- vorticity (at cell corners) and the confinement force
function vorticity(S) {
  const { U, V, om } = S;
  // corner (i, j) is at x = i, y = j
  for (let j = 0; j < NY; j++) {
    const ro = j * NX, rm = ((j - 1) & MY) * NX;
    for (let i = 0; i < NX; i++) om[ro + i] = V[ro + i] - V[ro + ((i - 1) & MX)] - (U[ro + i] - U[rm + i]);
  }
}
function confine(S, dt, eps) {
  const { U, V, om, fx, fy } = S;
  vorticity(S);
  // the vorticity at a cell centre is the mean of its four corners
  const wc = S.wc, aw = S.aw;
  for (let j = 0; j < NY; j++) {
    const ro = j * NX, rp = ((j + 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      const ip = (i + 1) & MX;
      const w = 0.25 * (om[ro + i] + om[ro + ip] + om[rp + i] + om[rp + ip]);
      wc[ro + i] = w;
      aw[ro + i] = abs(w);
    }
  }
  let ss = 0;
  for (let k = 0; k < N; k++) ss += wc[k] * wc[k];
  S.wref += (sqrt(ss / N) - S.wref) * 0.02;
  // The same field through a 3 x 3 box. The confinement force and the picture both read this one: built from the raw
  // field the force fed on grid-scale noise. wpk follows the peak of it.
  let pk = 0;
  for (let j = 0; j < NY; j++) {
    const ra = ((j - 1) & MY) * NX, rb = j * NX, rc = ((j + 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      const il = (i - 1) & MX, ir = (i + 1) & MX;
      const wv = (wc[ra + il] + wc[ra + i] + wc[ra + ir] + wc[rb + il] + wc[rb + i] + wc[rb + ir] + wc[rc + il] + wc[rc + i] + wc[rc + ir]) / 9;
      S.ws[rb + i] = wv;
      aw[rb + i] = abs(wv);
      if (abs(wv) > pk) pk = abs(wv);
    }
  }
  S.wpk += (pk - S.wpk) * 0.03;
  for (let j = 0; j < NY; j++) {
    const ro = j * NX, rp = ((j + 1) & MY) * NX, rm = ((j - 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      const gx = aw[ro + ((i + 1) & MX)] - aw[ro + ((i - 1) & MX)], gy = aw[rp + i] - aw[rm + i];
      const m = sqrt(gx * gx + gy * gy) + 1e-9, w = S.ws[ro + i];
      fx[ro + i] = (gy / m) * w * eps;
      fy[ro + i] = (-gx / m) * w * eps;
    }
  }
  for (let j = 0; j < NY; j++) {
    const ro = j * NX, rm = ((j - 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      const im = (i - 1) & MX;
      U[ro + i] += 0.5 * dt * (fx[ro + im] + fx[ro + i]);
      V[ro + i] += 0.5 * dt * (fy[rm + i] + fy[ro + i]);
    }
  }
}

// ---- semi-Lagrangian advection of the two staggered velocity components,
// midpoint back-trace, cubic look-up. U sits at (i, j + 1/2), V at (i + 1/2, j).
function advectVel(S, dt) {
  const { U, V, U2, V2 } = S;
  const cu = S.lim ? cub : bil;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      // U face
      let x = i, y = j + 0.5;
      let u = U[k], v = bil(V, x - 0.5, y);
      let xm = x - 0.5 * dt * u, ym = y - 0.5 * dt * v;
      u = bil(U, xm, ym - 0.5);
      v = bil(V, xm - 0.5, ym);
      U2[k] = cu(U, x - dt * u, y - dt * v - 0.5);
      // V face
      x = i + 0.5;
      y = j;
      v = V[k];
      u = bil(U, x, y - 0.5);
      xm = x - 0.5 * dt * u;
      ym = y - 0.5 * dt * v;
      u = bil(U, xm, ym - 0.5);
      v = bil(V, xm - 0.5, ym);
      V2[k] = cu(V, x - dt * u - 0.5, y - dt * v);
    }
  S.U = U2;
  S.U2 = U;
  S.V = V2;
  S.V2 = V;
}

// ---- pressure: Poisson solve on the torus, red-black Gauss-Seidel V-cycle
function gs(a, sweeps) {
  const { nx, ny, p, f } = a, mx = nx - 1, my = ny - 1;
  for (let s = 0; s < sweeps; s++)
    for (let c = 0; c < 2; c++)
      for (let j = 0; j < ny; j++) {
        const o = j * nx, up = ((j + 1) & my) * nx, dn = ((j - 1) & my) * nx;
        for (let i = (j + c) & 1; i < nx; i += 2) p[o + i] = 0.25 * (p[o + ((i + 1) & mx)] + p[o + ((i - 1) & mx)] + p[up + i] + p[dn + i] - f[o + i]);
      }
}
function residual(a) {
  const { nx, ny, p, f, r } = a, mx = nx - 1, my = ny - 1;
  for (let j = 0; j < ny; j++) {
    const o = j * nx, up = ((j + 1) & my) * nx, dn = ((j - 1) & my) * nx;
    for (let i = 0; i < nx; i++) r[o + i] = f[o + i] - (p[o + ((i + 1) & mx)] + p[o + ((i - 1) & mx)] + p[up + i] + p[dn + i] - 4 * p[o + i]);
  }
}
function vcycle(lv, l, pre, post) {
  const a = lv[l];
  if (l === lv.length - 1) {
    gs(a, 40);
    let m = 0;
    for (let k = 0; k < a.p.length; k++) m += a.p[k];
    m /= a.p.length;
    for (let k = 0; k < a.p.length; k++) a.p[k] -= m;
    return;
  }
  gs(a, pre);
  residual(a);
  const b = lv[l + 1], nx = a.nx, bx = b.nx, by = b.ny, mxb = bx - 1, myb = by - 1;
  for (let J = 0; J < by; J++)
    for (let I = 0; I < bx; I++) {
      const o = 2 * J * nx + 2 * I;
      b.f[J * bx + I] = a.r[o] + a.r[o + 1] + a.r[o + nx] + a.r[o + nx + 1];
      b.p[J * bx + I] = 0;
    }
  vcycle(lv, l + 1, pre, post);
  // bilinear prolongation of the correction: 3/4 the nearest coarse cell, 1/4 the next one over
  for (let J = 0; J < by; J++)
    for (let I = 0; I < bx; I++)
      for (let q = 0; q < 2; q++) {
        const Jn = (J + (q ? 1 : -1)) & myb;
        for (let h = 0; h < 2; h++) {
          const In = (I + (h ? 1 : -1)) & mxb;
          const c = 0.5625 * b.p[J * bx + I] + 0.1875 * (b.p[J * bx + In] + b.p[Jn * bx + I]) + 0.0625 * b.p[Jn * bx + In];
          a.p[(2 * J + q) * nx + 2 * I + h] += c;
        }
      }
  gs(a, post);
}
function divergence(S, out) {
  const { U, V } = S;
  let m = 0;
  for (let j = 0; j < NY; j++) {
    const o = j * NX, up = ((j + 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      const d = U[o + ((i + 1) & MX)] - U[o + i] + V[up + i] - V[o + i];
      if (out) out[o + i] = d;
      if (abs(d) > m) m = abs(d);
    }
  }
  return m;
}
function project(S, cycles) {
  const a = S.lv[0];
  divergence(S, a.f);
  for (let c = 0; c < cycles; c++) vcycle(S.lv, 0, 2, 2);
  const { p } = a, { U, V } = S;
  for (let j = 0; j < NY; j++) {
    const o = j * NX, dn = ((j - 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      U[o + i] -= p[o + i] - p[o + ((i - 1) & MX)];
      V[o + i] -= p[o + i] - p[dn + i];
    }
  }
}

// ---- dye: 128 x 256, three dyes interleaved. Midpoint back-trace on the staggered velocity, Catmull-Rom look-up clamped to the
// four cells around the foot of the path.
function advectDye(S, dt) {
  const { U, V, D, D2 } = S;
  let after = 0;
  const dec = exp(-DECAY * S.tempo * dt);
  for (let jd = 0; jd < DNY; jd++) {
    const y = (jd + 0.5) / DS;
    for (let id = 0; id < DNX; id++) {
      const x = (id + 0.5) / DS;
      const u1 = bil(U, x, y - 0.5), v1 = bil(V, x - 0.5, y);
      const xm = x - 0.5 * dt * u1, ym = y - 0.5 * dt * v1;
      const u2 = bil(U, xm, ym - 0.5), v2 = bil(V, xm - 0.5, ym);
      const fi = (x - dt * u2) * DS - 0.5, fj = (y - dt * v2) * DS - 0.5;
      const i0 = floor(fi), j0 = floor(fj), a = fi - i0, b = fj - j0, o = 3 * (jd * DNX + id);
      let c0, c1, c2;
      if (S.dcub) {
        const t2 = a * a, t3 = t2 * a, s2 = b * b, s3 = s2 * b;
        const ax = -0.5 * t3 + t2 - 0.5 * a, bx = 1.5 * t3 - 2.5 * t2 + 1, cx = -1.5 * t3 + 2 * t2 + 0.5 * a, dx = 0.5 * t3 - 0.5 * t2;
        const ay = -0.5 * s3 + s2 - 0.5 * b, by = 1.5 * s3 - 2.5 * s2 + 1, cy = -1.5 * s3 + 2 * s2 + 0.5 * b, dy = 0.5 * s3 - 0.5 * s2;
        const xa = (i0 - 1) & DMX, xb = i0 & DMX, xc = (i0 + 1) & DMX, xd = (i0 + 2) & DMX;
        const ra = ((j0 - 1) & DMY) * DNX, rb = (j0 & DMY) * DNX, rc = ((j0 + 1) & DMY) * DNX, rd = ((j0 + 2) & DMY) * DNX;
        const qa = 3 * (ra + xa), qb = 3 * (ra + xb), qc = 3 * (ra + xc), qd = 3 * (ra + xd);
        const ea = 3 * (rb + xa), eb = 3 * (rb + xb), ec = 3 * (rb + xc), ed = 3 * (rb + xd);
        const fa = 3 * (rc + xa), fb = 3 * (rc + xb), fc = 3 * (rc + xc), fd = 3 * (rc + xd);
        const ga = 3 * (rd + xa), gb = 3 * (rd + xb), gc = 3 * (rd + xc), gd = 3 * (rd + xd);
        let r0 = 0, r1 = 0, r2 = 0;
        for (let c = 0; c < 3; c++) {
          const v0 = ax * D[qa + c] + bx * D[qb + c] + cx * D[qc + c] + dx * D[qd + c];
          const v1 = ax * D[ea + c] + bx * D[eb + c] + cx * D[ec + c] + dx * D[ed + c];
          const v2 = ax * D[fa + c] + bx * D[fb + c] + cx * D[fc + c] + dx * D[fd + c];
          const v3 = ax * D[ga + c] + bx * D[gb + c] + cx * D[gc + c] + dx * D[gd + c];
          let r = ay * v0 + by * v1 + cy * v2 + dy * v3;
          const p = D[eb + c], q = D[ec + c], u = D[fb + c], w = D[fc + c];
          const lo = min(min(p, q), min(u, w)), hi = max(max(p, q), max(u, w));
          r = r < lo ? lo : r > hi ? hi : r;
          if (c === 0) r0 = r;
          else if (c === 1) r1 = r;
          else r2 = r;
        }
        c0 = r0;
        c1 = r1;
        c2 = r2;
      } else {
        const x0 = i0 & DMX, x1 = (i0 + 1) & DMX, r0 = (j0 & DMY) * DNX, r1 = ((j0 + 1) & DMY) * DNX;
        const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
        const p00 = 3 * (r0 + x0), p10 = 3 * (r0 + x1), p01 = 3 * (r1 + x0), p11 = 3 * (r1 + x1);
        c0 = w00 * D[p00] + w10 * D[p10] + w01 * D[p01] + w11 * D[p11];
        c1 = w00 * D[p00 + 1] + w10 * D[p10 + 1] + w01 * D[p01 + 1] + w11 * D[p11 + 1];
        c2 = w00 * D[p00 + 2] + w10 * D[p10 + 2] + w01 * D[p01 + 2] + w11 * D[p11 + 2];
      }
      after += c0 + c1 + c2;
      D2[o] = c0 * dec;
      D2[o + 1] = c1 * dec;
      D2[o + 2] = c2 * dec;
    }
  }
  // A semi-Lagrangian step does not keep the total. Taking the dye back to the mass it had before the step
  // (one factor for the whole field, 0.004 % a step at 30 fps and 0.17 % at most for a step of a second) makes
  // emitted - decayed = the change in the total exact.
  S.advErr += after - S.mass;
  const fx = S.fix && after > 1e-9 ? S.mass / after : 1;
  if (fx !== 1) for (let k = 0; k < 3 * DN; k++) D2[k] *= fx;
  S.decayed += (S.fix ? S.mass : after) * (1 - dec);
  S.D = D2;
  S.D2 = D;
}
// Where the water is clear the droppers go. Every fifth frame the dye is sampled over 8 x 16 blocks of 8 x 8
// LEDs, and each wandering emitter turns its mean heading a little towards the clear blocks near it, the more
// the clearer and the closer. It never stops wandering: its heading is still sines plus noise on top.
function clearWater(S, dt) {
  const { D, cg } = S;
  if (S.tick++ % 5 === 0) {
    cg.fill(0);
    for (let jd = 0; jd < DNY; jd += 2)
      for (let id = 0; id < DNX; id += 2) {
        const o = 3 * (jd * DNX + id);
        cg[(jd >> 4) * 8 + (id >> 4)] += D[o] + D[o + 1] + D[o + 2];
      }
  }
  let mean = 0;
  for (let k = 0; k < 128; k++) mean += cg[k];
  mean = mean / 128 + 1e-6;
  for (const e of S.em) {
    if (e.a >= 0) continue;
    const w = e.w;
    let fx = 0, fy = 0;
    for (let k = 0; k < 128; k++) {
      const def = max(0, mean - cg[k]) / mean;
      if (def <= 0) continue;
      const dx = mimg((k & 7) * 8 + 4 - w.x, NX), dy = mimg((k >> 3) * 8 + 4 - w.y, NY), d2 = dx * dx + dy * dy + 1e-6, d = sqrt(d2);
      const g = def / (1 + d2 / 576);
      fx += (g * dx) / d;
      fy += (g * dy) / d;
    }
    const m = sqrt(fx * fx + fy * fy);
    if (m > 1e-6) w.base = mod(w.base + CLEAR * min(1, m) * sin(Math.atan2(fy, fx) - w.th) * dt, TAU);
  }
}

function emit(S, dt) {
  const D = S.D;
  let added = 0;
  for (const e of S.em) {
    let wx, wy;
    if (e.a >= 0) {
      const st = S.st[e.a], w = st.w, th = st.kind === 3 ? st.al : w.th, o = e.o * S.sg * (1 + 0.3 * sin(e.mp));
      wx = w.x - cos(th) * o + sin(e.ph) * 0.6 * S.sg;
      wy = w.y - sin(th) * o + cos(e.ph) * 0.6 * S.sg;
    } else {
      walk(e.w, dt, (0.5 + 0.25 * S.stir) * e.ps);
      wx = e.w.x;
      wy = e.w.y;
    }
    const cx = wx * DS, cy = wy * DS;
    const sg = 2.55 * pow(S.sg / SIG0, 0.35) * DS, R = ceil(3 * sg), is2 = 1 / (2 * sg * sg);
    const rate = EMIT * (e.a >= 0 ? 1 : 0.55) * S.tempo * pow(SIG0 / S.sg, 0.8) * (0.65 + 0.35 * sin(e.mp)) * dt;
    const i0 = floor(cx), j0 = floor(cy);
    for (let dj = -R; dj <= R; dj++)
      for (let di = -R; di <= R; di++) {
        const dx = i0 + di + 0.5 - cx, dy = j0 + dj + 0.5 - cy;
        const g = exp(-(dx * dx + dy * dy) * is2);
        if (g < 0.01) continue;
        const k = 3 * (((j0 + dj) & DMY) * DNX + ((i0 + di) & DMX)) + e.sp;
        const add = (1 - D[k]) * (1 - exp(-rate * g));
        D[k] += add;
        added += add;
      }
  }
  S.emitted += added;
}
// Fick's law for the ink: D += c (sum of four neighbours - 4 D), explicit, c = kappa dt / h^2 with h half an LED.
// The sum over the torus does not change.
function diffuseDye(S, dt) {
  const c = min((S.kdif * dt) / 0.25, 0.2);
  if (c < 1e-4) return;
  const { D, D2 } = S;
  for (let j = 0; j < DNY; j++) {
    const up = ((j + 1) & DMY) * DNX, dn = ((j - 1) & DMY) * DNX, o = j * DNX;
    for (let i = 0; i < DNX; i++) {
      const r = 3 * (o + ((i + 1) & DMX)), l = 3 * (o + ((i - 1) & DMX)), u = 3 * (up + i), d = 3 * (dn + i), k = 3 * (o + i);
      D2[k] = D[k] + c * (D[r] + D[l] + D[u] + D[d] - 4 * D[k]);
      D2[k + 1] = D[k + 1] + c * (D[r + 1] + D[l + 1] + D[u + 1] + D[d + 1] - 4 * D[k + 1]);
      D2[k + 2] = D[k + 2] + c * (D[r + 2] + D[l + 2] + D[u + 2] + D[d + 2] - 4 * D[k + 2]);
    }
  }
  S.D = D2;
  S.D2 = D;
}
function advanceClocks(S, dt) {
  for (const e of S.em) {
    e.ph = mod(e.ph + e.fr * dt, TAU);
    e.mp = mod(e.mp + e.mf * dt, TAU);
  }
}
function dyeMass(S) {
  let m = 0;
  for (let k = 0; k < 3 * DN; k++) m += S.D[k];
  return m;
}

function step(S, dt) {
  addForces(S, dt);
  hyper(S, dt);
  confine(S, dt, S.vort);
  advectVel(S, dt);
  project(S, S.cyc);
  let sq = 0;
  for (let j = 0; j < NY; j++) {
    const o = j * NX, up = ((j + 1) & MY) * NX;
    for (let i = 0; i < NX; i++) {
      const u = 0.5 * (S.U[o + i] + S.U[o + ((i + 1) & MX)]), v = 0.5 * (S.V[o + i] + S.V[up + i]);
      sq += S.sp[o + i] = u * u + v * v;
    }
  }
  S.uref += (sqrt(sq / N) - S.uref) * 0.02;
  S.mass = dyeMass(S);
  advectDye(S, dt);
  diffuseDye(S, dt);
  advanceClocks(S, dt);
  clearWater(S, dt);
  emit(S, dt);
  S.mass = dyeMass(S);
}

// ---- colour. OKLab (Ottosson 2020, constants from memory), each dye its own ramp of lightness and chroma.
const HUES = [205, 285, 352], ACC = 85;
const CPK = [0.13, 0.2, 0.21], LSC = [1.0, 0.88, 0.97];
const LN = 1024, SMAX = 2.2, KT = 2.4, LTOP = 0.93;
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const TMP = [0, 0, 0];
function buildLut(S, shift) {
  for (let i = 0; i < 3; i++) {
    const h = ((HUES[i] + shift) * PI) / 180, lut = S.lut[i];
    for (let k = 0; k < LN; k++) {
      const s = (k / (LN - 1)) * SMAX, t = 1 - exp(-KT * s);
      // a dark orange or yellow reads as brown on the panel, so warm hues come up in lightness sooner
      let dh = mod(HUES[i] + shift - 75, 360);
      if (dh > 180) dh -= 360;
      const warm = exp(-(dh * dh) / 2500);
      const L = LTOP * LSC[i] * pow(t, 0.85 - 0.3 * warm);
      let C = CPK[i] * sin(min(1, t / 0.5) * 1.5708) * (1 - 0.55 * sm(0.6, 1, t));
      for (let it = 0; it < 8; it++) {
        lin(L, C * cos(h), C * sin(h), TMP);
        if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
        C *= 0.88;
      }
      lut[4 * k] = L;
      lut[4 * k + 1] = C * cos(h);
      lut[4 * k + 2] = C * sin(h);
      lut[4 * k + 3] = C;
    }
  }
  S.hueDone = shift;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];

export function setup(params) {
  const S = (params.s = newState());
  buildLut(S, 0);
  seedState(S);
  // let the first seconds happen before the first frame, in coarse steps
  for (let n = 0; n < 40; n++) step(S, 0.1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const stir = cl(k[1], 0.8, 3.2), scale = cl(k[2], -1, 1), diff = cl(k[3], 0, 1), h = cl(dt || 0, 0, 0.1);
  const f = 1 - exp(-4 * h);
  S.stir += (stir - S.stir) * f;
  S.tempo = 0.55 + 0.225 * S.stir;
  S.sg += (SIG0 * pow(2, 0.75 * scale) - S.sg) * f;
  S.kdif += (KDIF * diff * diff - S.kdif) * f;
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  step(S, h);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { D, lut, wc } = S;
  const sc = (LN - 1) / SMAX, l0 = lut[0], l1 = lut[1], l2 = lut[2];
  const o = [0, 0, 0];
  const iw2 = 1 / max(1e-6, S.wpk), iu = 1 / max(1e-6, S.uref);
  const ha = ((ACC + S.hueDone) * PI) / 180, ca = cos(ha), sa = sin(ha);
  const hg = ((HUES[1] + S.hueDone) * PI) / 180, cg = cos(hg), sg = sin(hg);
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) {
      const a = 3 * (2 * y * DNX + 2 * x), b = a + 3 * DNX;
      const c0 = (D[a] + D[a + 3] + D[b] + D[b + 3]) * 0.25, c1 = (D[a + 1] + D[a + 4] + D[b + 1] + D[b + 4]) * 0.25, c2 = (D[a + 2] + D[a + 5] + D[b + 2] + D[b + 5]) * 0.25;
      const s = c0 + c1 + c2;
      let L = 0, A = 0, B = 0;
      if (s > 1e-4) {
        const idx = 4 * min(LN - 1, (s * sc) | 0), w0 = c0 / s, w1 = c1 / s, w2 = c2 / s;
        L = w0 * l0[idx] + w1 * l1[idx] + w2 * l2[idx];
        A = w0 * l0[idx + 1] + w1 * l1[idx + 1] + w2 * l2[idx + 1];
        B = w0 * l0[idx + 2] + w1 * l1[idx + 2] + w2 * l2[idx + 2];
        const C = w0 * l0[idx + 3] + w1 * l1[idx + 3] + w2 * l2[idx + 3];
        const m = sqrt(A * A + B * B);
        if (m > 1e-5) {
          A *= C / m;
          B *= C / m;
        }
      }
      // second layer. Where the water moves fast a faint violet glow lights the bare ground; the sign of the
      // vorticity turns the dye's hue a few degrees one way or the other; the cores of the strongest vortices
      // carry a thin pale-gold glint.
      const k = y * NX + x, wv = S.ws[k], q = abs(wv) * iw2;
      const gl = 0.16 * sm(0.5, 2.4, sqrt(S.sp[k]) * iu);
      const th = 0.3 * Math.tanh((0.8 * wv) / max(1e-6, S.wref)), ct = cos(th), st = sin(th);
      const A1 = A * ct - B * st;
      B = A * st + B * ct;
      A = A1;
      L += gl * (1 - L);
      A += gl * 0.3 * cg * (1 - L);
      B += gl * 0.3 * sg * (1 - L);
      const gn = 0.55 * sm(0.62, 0.95, q);
      L += gn * (0.92 - L);
      A += gn * (0.07 * ca - A);
      B += gn * (0.07 * sa - B);
      lin(L, A, B, o);
      display.setPixel(x, y, gam(o[0]), gam(o[1]), gam(o[2]));
    }
}
