// ===== Patternflow pattern =====
// Title:   Horseshoe Orbits
// Family:  coorbital
// Idea:    The panel is the phase plane of two bodies on almost the same orbit, a small one in the middle of the panel as a soft bright disc and a large one that is not drawn, with longitude relative to the small body running the height of the panel and wrapping top to bottom, and the offset of a particle's orbit size running across: ninety test particles are stepped through the real restricted three-body problem and leave glowing trails, so that gold horseshoes run up one side and down the other in nested streams that turn in a hairpin at the disc and pinch round the far side of the orbit, cyan and rose tadpoles circle small eyes about the two triangular points a sixth of the panel above and below the disc, and passing orbits stream by in dim blue, while the mass of the small body breathes and particles that reach the edge of a class change colour and are replaced.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the horseshoe orbit in the restricted three-body problem (Ernest W. Brown, 1911), the Trojan asteroids that librate about Jupiter's L4 and L5 (Max Wolf, 1906, from memory), Janus and Epimetheus, the two moons of Saturn that swap orbits every four years (found 1966, explained by Dermott and Murray and by Yoder and colleagues, early 1980s, from memory), the averaged co-orbital Hamiltonian (3/8)(da)^2 + mu F(phi) whose level curves are the tadpoles and horseshoes (Murray and Dermott, Solar System Dynamics, 1999, from memory)
// Round:   258
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.5..4, Mass=-1..1, Trail=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the horseshoes are gold, the tadpoles about L4 cyan and the tadpoles about L5 rose, the passing orbits a dim cold blue; at 0.33 gold has become green, at 0.5 it is blue, and at 1 it is back where it began.
// Knob 2: Rate. How fast the system runs, 3 time units of the problem a second for each unit of the knob, one time unit being a sixth of an orbit of the small body. At 2, where it opens, a tadpole circles its eye in about 13 s and a horseshoe takes about 17 s round its lens; at 0.5 the streams creep, a lap of a horseshoe taking over a minute, and at 4 they swirl, three times as fast, a passing orbit crossing the panel in under four seconds.
// Knob 3: Mass. The mass of the small body relative to the large one, 8e-4 times 3 to the power of the knob, so 2.7e-4 at -1 and 2.4e-3 at 1, and a few tens of percent more or less as it breathes. The islands and the racetrack widen as its square root: at -1 the horseshoe is a thin leaf 12 LEDs across, at 0 it is 40, and at 1 the fat loops run off the sides of the panel and the outer horseshoes are scattered after a lap or two.
// Knob 4: Trail. How long a particle's trail takes to fade, 4 time units times 4 to the power of the knob, so 1 at -1, 4 at 0 and 16 at 1. At -1 the particles are short comets a few LEDs long; at 0 a trail is 20 to 40 LEDs; at 1 it is a ribbon that draws the whole stream and the lens fills with light.

// What the picture is. The vertical axis is the longitude of a particle relative to the small body, one full turn over the 128 rows, with the
// small body at row 64 and the far side of the orbit, L3, at the seam where the top meets the bottom; L4 and L5 are 60 degrees away, 21 rows
// above and below the disc. The horizontal axis is the particle's osculating semi-major axis da from the co-orbital value, 32 LEDs for DA_WINDOW.
// A particle outside the small body's orbit is slower and drifts down the panel, one inside is faster and drifts up, so the left half runs up
// and the right half runs down.
// The particles are massless and are stepped in the inertial frame by a kick-drift-kick leapfrog, 0.0125 of a time unit a step, round a primary
// of mass 1 - mu at -mu(cos t, sin t) and a secondary of mass mu at (1 - mu)(cos t, sin t), softened by 0.02, and a third body a tenth of mu
// on a circular orbit of radius 1.9 that keeps some orbits drifting. mu breathes by a few tens of percent on three periods that have no
// common multiple. Close to the secondary a particle's orbit is not an ellipse and the osculating da jumps, which is the hairpin turn.
// The class of a particle is read from where it is. In the co-orbital approximation E = 3/8 da^2 + mu F(phi), F = 1 / (2 sin(phi/2)) - cos(phi),
// is conserved, F is 0.5 at the points L4 and L5 and 1.5 at L3, so E under 1.5 mu is a tadpole, E from 1.5 mu to about 3.2 mu a horseshoe
// and anything above it passes. E is read where phi is 35 to 165 degrees from the small body, where the formula holds; closer in, a particle
// keeps the class it had, and a particle that crosses the longitude of the small body is passing. A tadpole is cyan about L4 and rose about
// L5. A particle that is scattered out of the window, runs into the small body or has lived its 18 to 55 seconds is replaced by a new one at
// a random phase of an orbit of a class the crowd lacks, so ninety particles stay on the panel and the picture never settles.
// Drawing. A trail is the path of the particle in the panel, stamped as soft discs 2.3 LEDs across into a buffer that fades by a fixed
// fraction of a time unit, so it is long where a particle is fast and short where it dawdles, and a wrap through the seam carries on at
// the other edge instead of drawing a line across the panel.

const W = 64, H = 128;
const { floor, sqrt, abs, exp, sin, cos, atan2, PI, min, max } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the problem
const NP = 90; // test particles
const MU0 = 8e-4; // mass ratio at Mass 0
const SOFT = 0.02; // softening length of the small bodies
const HSTEP = 0.0125; // longest step, in time units
const M3 = 0.1, A3 = 1.9, PH3 = 1.3; // the third body: its mass in units of mu, orbit radius, starting angle
const DA_WINDOW = 0.12; // half the panel is this much semi-major axis
const SEC_ROW = 64, SEC_COL = 32; // where the small body sits on the panel
const PER = [1073, 691, 389]; // breathing periods of mu, time units
const AMP = [0.17, 0.12, 0.07]; // and their size, as a fraction of mu
const LIFE_LO = 110, LIFE_HI = 330; // a particle's life, time units
const E_TAD = 1.5, E_HS = 3.2; // class limits in units of mu

// ---- the crowd
const TARGET = [11, 11, 42, 26]; // L4 tadpoles, L5 tadpoles, horseshoes, passing
const CLS_RGB = [[40, 224, 238], [255, 82, 140], [255, 190, 44], [48, 90, 232]];
const CLS_GAIN = [0.9, 0.9, 1.0, 0.42];

// ---- the drawing
const SIG = 0.98; // stamp width, LEDs
const STEP_LED = 0.7; // spacing of stamps along a path
const DEPOSIT = 1 / (2.5 * SIG); // weight a LED of path adds, so a line peaks at about 1
const TONE_N = 1024, TONE_MAX = 4;
const TONE = new Float32Array(TONE_N + 1);
for (let i = 0; i <= TONE_N; i++) TONE[i] = 1 - exp((-1.8 * (i * TONE_MAX)) / TONE_N);
const GT = new Float32Array(64); // Gaussian of a distance in sixteenths of a LED
for (let i = 0; i < 64; i++) GT[i] = exp(-((i / 16) * (i / 16)) / (2 * SIG * SIG));

const F = (phi) => 1 / (2 * sin(0.5 * abs(phi))) - cos(phi);

function makeState() {
  const S = {
    ready: false, kn: [0, 2, 0, 0.06],
    t: 0, mu: MU0, muK: MU0, ac: Math.pow(1 - MU0, 1 / 3),
    ph: [Math.random() * TP, Math.random() * TP, Math.random() * TP],
    // particle arrays
    px: new Float64Array(NP), py: new Float64Array(NP), vx: new Float64Array(NP), vy: new Float64Array(NP),
    ax: new Float64Array(NP), ay: new Float64Array(NP),
    phi: new Float64Array(NP), phiU: new Float64Array(NP), da: new Float64Array(NP),
    cls: new Int8Array(NP), age: new Float64Array(NP), life: new Float64Array(NP), alpha: new Float32Array(NP),
    cr: new Float32Array(NP), cg: new Float32Array(NP), cb: new Float32Array(NP),
    sx: new Float32Array(NP), sy: new Float32Array(NP), // last stamped position of each particle
    buf: new Float32Array(W * H * 3),
    hueMat: new Float32Array(9), hueAt: -1,
    out: new Uint8Array(W * H * 3),
  };
  return S;
}

export function setup(params) {
  params.s = makeState();
}

const rnd = Math.random;

// ---- one particle's birth: a random phase of an orbit of the given class
function sample(S, c) {
  const mu = S.mu, sm = sqrt(mu), lim = 0.94 * DA_WINDOW;
  for (let k = 0; k < 120; k++) {
    let phi, da;
    if (c < 2) {
      phi = (0.55 + rnd() * 2.3) * (c === 0 ? 1 : -1);
      da = (rnd() * 2 - 1) * 1.7 * sm;
      const e = (0.375 * da * da) / mu + F(phi);
      if (e > 1.35) continue;
    } else if (c === 2) {
      phi = (rnd() * 2 - 1) * PI;
      if (abs(phi) < 0.4) continue;
      da = (rnd() * 2 - 1) * 2.9 * sm;
      const e = (0.375 * da * da) / mu + F(phi);
      if (e < 1.7 || e > 3.0) continue;
    } else {
      phi = (rnd() * 2 - 1) * PI;
      const lo = min(3.3 * sm, lim * 0.7);
      da = (lo + rnd() * (lim - lo)) * (rnd() < 0.5 ? -1 : 1);
    }
    if (abs(da) > lim) continue;
    return [phi, da];
  }
  return [(rnd() * 2 - 1) * PI, (rnd() < 0.5 ? -1 : 1) * lim];
}

function place(S, i, c) {
  const [phi, da] = sample(S, c), mu = S.mu, t = S.t;
  const r = S.ac + da, vc = sqrt((1 - mu) / r), ang = phi + t;
  const qx = -mu * cos(t), qy = -mu * sin(t);
  S.px[i] = qx + r * cos(ang);
  S.py[i] = qy + r * sin(ang);
  S.vx[i] = mu * sin(t) - vc * sin(ang);
  S.vy[i] = -mu * cos(t) + vc * cos(ang);
  S.phi[i] = phi;
  S.phiU[i] = phi;
  S.da[i] = da;
  S.cls[i] = c;
  S.age[i] = 0;
  S.life[i] = LIFE_LO + rnd() * (LIFE_HI - LIFE_LO);
  S.alpha[i] = 0;
  S.cr[i] = CLS_RGB[c][0];
  S.cg[i] = CLS_RGB[c][1];
  S.cb[i] = CLS_RGB[c][2];
  S.sx[i] = NaN;
  S.ax[i] = NaN;
}

function pickClass(S) {
  const cnt = [0, 0, 0, 0];
  for (let i = 0; i < NP; i++) if (S.alpha[i] >= 0 && S.cls[i] >= 0) cnt[S.cls[i]]++;
  let best = 2, bd = -9;
  for (let c = 0; c < 4; c++) {
    const d = (TARGET[c] - cnt[c]) / TARGET[c] + rnd() * 0.15;
    if (d > bd) { bd = d; best = c; }
  }
  return best;
}

// ---- the physics, a frame's worth
function bodies(S, t, B) {
  const mu = S.mu, c = cos(t), s = sin(t);
  B[0] = -mu * c; B[1] = -mu * s; // primary
  B[2] = (1 - mu) * c; B[3] = (1 - mu) * s; // secondary
  const a3 = PH3 + t / (A3 * sqrt(A3));
  B[4] = A3 * cos(a3); B[5] = A3 * sin(a3); // third body
}

function force(S, i, B, out) {
  const mu = S.mu, m3 = M3 * mu;
  const x = S.px[i], y = S.py[i];
  let dx = x - B[0], dy = y - B[1], r2 = dx * dx + dy * dy, k = (1 - mu) / (r2 * sqrt(r2));
  let ax = -k * dx, ay = -k * dy;
  dx = x - B[2]; dy = y - B[3]; r2 = dx * dx + dy * dy + SOFT * SOFT; k = mu / (r2 * sqrt(r2));
  ax -= k * dx; ay -= k * dy;
  dx = x - B[4]; dy = y - B[5]; r2 = dx * dx + dy * dy + SOFT * SOFT; k = m3 / (r2 * sqrt(r2));
  ax -= k * dx; ay -= k * dy;
  out[0] = ax; out[1] = ay;
}

const BB = new Float64Array(6), AA = new Float64Array(2);

function integrate(S, dtSys) {
  const n = max(1, Math.ceil(dtSys / HSTEP)), h = dtSys / n;
  const px = S.px, py = S.py, vx = S.vx, vy = S.vy, ax = S.ax, ay = S.ay;
  bodies(S, S.t, BB);
  for (let i = 0; i < NP; i++) if (ax[i] !== ax[i]) { force(S, i, BB, AA); ax[i] = AA[0]; ay[i] = AA[1]; }
  for (let s = 0; s < n; s++) {
    const tn = S.t + h * (s + 1);
    bodies(S, tn, BB);
    for (let i = 0; i < NP; i++) {
      vx[i] += 0.5 * h * ax[i]; vy[i] += 0.5 * h * ay[i];
      px[i] += h * vx[i]; py[i] += h * vy[i];
      force(S, i, BB, AA);
      ax[i] = AA[0]; ay[i] = AA[1];
      vx[i] += 0.5 * h * AA[0]; vy[i] += 0.5 * h * AA[1];
    }
  }
  S.t += dtSys;
}

// read the orbit of every particle after a frame, and keep the class
function observe(S, dtSys) {
  const mu = S.mu, t = S.t, c = cos(t), s = sin(t), qx = -mu * c, qy = -mu * s;
  const vqx = mu * s, vqy = -mu * c, lim = 1.08 * DA_WINDOW, sm = sqrt(mu);
  for (let i = 0; i < NP; i++) {
    const rx = S.px[i] - qx, ry = S.py[i] - qy, r = sqrt(rx * rx + ry * ry);
    const wx = S.vx[i] - vqx, wy = S.vy[i] - vqy;
    const a = 1 / (2 / r - (wx * wx + wy * wy) / (1 - mu));
    const da = a - S.ac;
    let phi = atan2(ry, rx) - t;
    phi -= TP * Math.round(phi / TP);
    const prev = S.phi[i];
    let d = phi - prev; d -= TP * Math.round(d / TP);
    S.phiU[i] += d;
    S.phi[i] = phi; S.da[i] = da;
    S.age[i] += dtSys;
    let c0 = S.cls[i];
    if (prev * phi < 0 && abs(phi) < 2) c0 = 3; // crossed the small body's longitude
    const ap = abs(phi);
    if (c0 !== 3 || (ap > 0.6 && ap < 2.9)) {
      if (ap > 0.6 && ap < 2.9) {
        const e = (0.375 * da * da) / mu + F(phi);
        if (e < E_TAD) c0 = phi > 0 ? 0 : 1;
        else if (e < E_HS) c0 = 2;
        else c0 = 3;
      }
    }
    S.cls[i] = c0;
    const dx = S.px[i] - (1 - mu) * c, dy = S.py[i] - (1 - mu) * s;
    const bad = !(a > 0) || abs(da) > lim || dx * dx + dy * dy < 0.012 * 0.012 || r > 3 || S.age[i] > S.life[i];
    if (bad) place(S, i, pickClass(S));
  }
}

// the soft stamp
function stamp(buf, xc, yc, r, g, b, w) {
  const x0 = floor(xc - 2), y0 = floor(yc - 2);
  for (let j = 0; j < 5; j++) {
    const yy = y0 + j, gy = GT[min(63, (abs(yy + 0.5 - yc) * 16) | 0)];
    if (gy < 0.01) continue;
    const row = (((yy % H) + H) % H) * W;
    for (let k = 0; k < 5; k++) {
      const xx = x0 + k;
      if (xx < 0 || xx >= W) continue;
      const gx = GT[min(63, (abs(xx + 0.5 - xc) * 16) | 0)];
      const v = w * gx * gy, o = (row + xx) * 3;
      buf[o] += r * v; buf[o + 1] += g * v; buf[o + 2] += b * v;
    }
  }
}

function paint(S, tau, dtSys, fade) {
  const buf = S.buf;
  if (fade) {
    const f = exp(-dtSys / tau);
    for (let i = 0; i < buf.length; i++) buf[i] *= f;
  }
  const ROWS = H / TP;
  for (let i = 0; i < NP; i++) {
    const c = S.cls[i];
    const rr = CLS_RGB[c], k = 1 - exp(-dtSys / 6);
    S.cr[i] += (rr[0] - S.cr[i]) * k; S.cg[i] += (rr[1] - S.cg[i]) * k; S.cb[i] += (rr[2] - S.cb[i]) * k;
    const x = SEC_COL + (S.da[i] / DA_WINDOW) * 32, y = SEC_ROW - S.phiU[i] * ROWS;
    // fade a particle in over a few time units and out in the last few
    S.alpha[i] = min(S.age[i] / 5, (S.life[i] - S.age[i]) / 5, 1);
    if (S.sx[i] !== S.sx[i]) { S.sx[i] = x; S.sy[i] = y; }
    let dx = x - S.sx[i], dy = y - S.sy[i];
    const len = sqrt(dx * dx + dy * dy);
    if (len > 24) { S.sx[i] = x; S.sy[i] = y; dx = 0; dy = 0; }
    const n = max(1, Math.ceil(len / STEP_LED)), w = DEPOSIT * (len / n || 0.05) * CLS_GAIN[c] * max(S.alpha[i], 0) / 255;
    for (let s = 1; s <= n; s++) {
      const u = s / n;
      stamp(buf, S.sx[i] + dx * u, S.sy[i] + dy * u, S.cr[i], S.cg[i], S.cb[i], w);
    }
    S.sx[i] = x; S.sy[i] = y;
  }
}

function advance(S, dtSys, tau, fade) {
  integrate(S, dtSys);
  observe(S, dtSys);
  paint(S, tau, dtSys, fade);
}

function breathe(S) {
  let b = 0;
  for (let k = 0; k < 3; k++) b += AMP[k] * sin((TP * S.t) / PER[k] + S.ph[k]);
  S.mu = S.muK * exp(b);
  S.ac = Math.pow(1 - S.mu, 1 / 3);
}

const PREROLL = 240, PRE_STEP = 0.2;
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  S.kn = kn;
  const rate = 3 * cl(kn[1], 0.5, 4);
  const target = MU0 * Math.pow(3, cl(kn[2], -1, 1));
  const tau = 4 * Math.pow(4, cl(kn[3], -1, 1));
  if (!S.ready) {
    S.ready = true;
    S.muK = target;
    breathe(S);
    for (let i = 0; i < NP; i++) place(S, i, pickClass(S));
    for (let i = 0; i < NP; i++) S.age[i] = rnd() * S.life[i];
    for (let t = 0; t < PREROLL; t += PRE_STEP) {
      breathe(S);
      advance(S, PRE_STEP, tau, t > PREROLL - 6 * tau - 10);
    }
  }
  const d = cl(dt || 0, 0, 0.1);
  S.muK += (target - S.muK) * (1 - exp(-d / 1.2));
  breathe(S);
  advance(S, d * rate, tau, true);
}

// ---- colour
function hueMatrix(S, hue) {
  if (S.hueAt === hue) return;
  const A = TP * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  S.hueAt = hue;
}

const GROUND = [2, 4, 12];
const DISC = [255, 236, 200], HALO = [255, 190, 110];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  hueMatrix(S, cl(S.kn[0], 0, 1));
  const m = S.hueMat, buf = S.buf;
  const rd = 3 * Math.pow(S.mu / MU0, 1 / 3);
  const kt = TONE_N / TONE_MAX;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const dx = x + 0.5 - SEC_COL, dy = y + 0.5 - SEC_ROW, rr = sqrt(dx * dx + dy * dy);
      const core = rr < rd + 1.5 ? 1 - cl((rr - (rd - 1.2)) / 2.4, 0, 1) : 0;
      const halo = 0.1 * exp(-(rr * rr) / (2 * rd * rd * 2.2));
      const r = GROUND[0] + 255 * TONE[min(TONE_N, (buf[o] * kt) | 0)] + core * DISC[0] + halo * HALO[0];
      const g = GROUND[1] + 255 * TONE[min(TONE_N, (buf[o + 1] * kt) | 0)] + core * DISC[1] + halo * HALO[1];
      const b = GROUND[2] + 255 * TONE[min(TONE_N, (buf[o + 2] * kt) | 0)] + core * DISC[2] + halo * HALO[2];
      const R = r * m[0] + g * m[1] + b * m[2], G = r * m[3] + g * m[4] + b * m[5], B = r * m[6] + g * m[7] + b * m[8];
      display.setPixel(x, y, cl(R, 0, 255) | 0, cl(G, 0, 255) | 0, cl(B, 0, 255) | 0);
    }
  }
}
