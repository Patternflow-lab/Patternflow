// ===== Patternflow pattern =====
// Title:   Bandgap Bend
// Family:  photonics
// Idea:    A photonic crystal, a square lattice of dim blue dielectric rods 3 LEDs across with a snaking channel of missing rods through it, in which a finite-difference time-domain model of the electric field Ez runs live, and wave packets of light, gold where Ez is positive and cyan-violet where it is negative, run down the channel and round its four sharp 90 degree corners without leaking into the crystal, one after another every 4 to 9 seconds and sometimes two close together.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: photonic crystals (Eli Yablonovitch and Sajeev John, 1987), the missing-row waveguide and the sharp bend that carries light round a corner (Mekis, Chen, Kurland and Joannopoulos, 1996), the Yee grid and leapfrog scheme of FDTD (Kane Yee, 1966), the Anderson localisation of light in a disordered lattice (Sajeev John, 1984; Diederik Wiersma, 1997), pattern round 213
// Round:   213
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.8..5, Detune=-0.17..0.18, Disorder=0.06..0.36
//
// Knob 1: Hue. Turns the light and the rods round the wheel together. At 0 the positive half waves are gold, the negative ones cyan going to violet where they are faint, and the rods steel blue; at 0.5 the light is blue and orange on rods of dull rust, and at 1 it is back where it began.
// Knob 2: Speed. How fast the model runs, 75 time steps a second for each unit of the knob. A packet crosses the 176 LEDs of channel in about 23 seconds at 0.8, 9 seconds at the opening 2 and 3.7 seconds at 5. Packets are launched on the model's clock, so they come 4 to 9 seconds apart at 2 and 10 to 23 seconds apart at 0.8.
// Knob 3: Detune. The carrier frequency of new packets, as a distance from the middle of the gap, so omega a over 2 pi c is 0.37 plus the knob, from 0.20 to 0.55. On this grid the channel carries light from 0.33 to 0.44, which is -0.04 to 0.07 on the knob. There the packets stay in the channel and go round the corners. Outside it they do not fit and spread through the rods as rings, slow and wide at the low end and fine and quick at the high end. The source is raised there, up to 3.2 times below 0.25 and 1.8 times at 0.52, and a steady source at half a packet's strength runs beside the packets below 0.29 and above 0.49.
// Knob 4: Disorder. Each rod is pushed off its site by a fixed random vector, as long as 1.35 times the knob's distance above 0.06, so the knob reads 0.06 to 0.36 and the push is 0 to 0.405 lattice constants (0 to 3.2 LEDs). At 0.06 the lattice is perfect. The share of a packet's energy that reaches the end, measured over four draws of the rods, is 0.84 at 0.16, 0.43 at 0.26 and 0.09 at 0.36, where rods have drifted into the channel and the light stays in patches near where it was launched. The rods move to a new setting over about a second.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, pow, exp, sin, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// What the model is. Two-dimensional TM light, the fields Ez, Hx and Hy on a Yee grid,
//   dHx/dt = -dEz/dy,  dHy/dt = dEz/dx,  eps dEz/dt = dHy/dx - dHx/dy,
// in units where light in air goes 1 cell a time unit, stepped with Courant number 0.5 (the limit in 2D is 0.707), so a time
// step moves light half a cell. A LED is 2 by 2 cells. Inside a rod of epsilon 8.9 the wavelength is three times shorter, and
// at one cell to a LED a rod would be 3 cells across and the gap would not stay where it belongs.
// The crystal is a square lattice of alumina rods, epsilon 8.9, radius 0.2 a, in air, a = 16 cells = 8 LEDs. That puts 8 rods
// across and 16 down in the panel, each 3.2 LEDs wide. Epsilon in a cell is set by the share of the cell the rod covers, so a rod
// edge is one cell soft and does not stair-step. The lattice goes on 12 cells past every edge of the panel, under the absorbing
// layer, and the channel goes with it, so the light runs on into the absorber and does not come out onto free space and echo.
// The channel is rods taken out along a path: down column 2 to row 4, right along row 4 to column 5, down column 5 to row 9,
// left along row 9 to column 2, then down column 2 and off the bottom. That is 176 LEDs and four 90 degree corners, each made by
// leaving out the one rod at the corner and nothing more.
// Measured on this grid with a broad pulse down the channel, the guided mode passes from f = 0.33 to 0.44 and is gone by 0.31 below
// and 0.46 above. That is the gap of the first TM band of this crystal, 0.30 to 0.44 by Mekis and others. A packet at f = 0.37 has
// 0.63 of its energy left at the bottom edge against what it had at the top, 0.73 without the damping trace below. The rest goes to
// the trace, to the rods and to the corners. Its group velocity is 0.51 of c, 0.128 LEDs a time step, so at 150 steps a second,
// the opening, it crosses the channel in 9.2 s.
// The edge is a sponge 12 cells thick. All three fields are multiplied each step by exp(-s), with s = 0.3 (d/12)^3 for a depth d,
// and with s = 5e-5 everywhere, so that light caught in the lattice falls to a third of its energy in 67 s at the opening speed and
// the total stays bounded. Over 900 s in eight settings spread across the knobs, Speed up to 5 among them, the energy stayed
// between 0.4 and 19 thousand units with no climb, where one packet at its height is about 1.5 thousand.
// A packet is a soft source added to Ez, one blob 2.5 cells wide in the channel at the top edge, a carrier of frequency f under a
// Gaussian envelope 2 cycles wide, cut at 3 widths: about 12 cycles in all. A packet peaks near 1 in the channel. A LED takes the
// mean Ez of its four cells and shows it as 1 - exp(-2.4 |Ez|^1.2), so the half waves have dark edges and bright cores.
// Before the first frame the model runs 1371 steps (about 0.45 s of work): one packet is launched at 0 and has gone 62% of the
// way down the channel when the picture opens, and a second, launched 4.4 s of model time later, has gone 14%.

const A = 16; // lattice constant, cells
const ROD = 0.2 * A; // rod radius, cells
const EPS = 8.9;
const PAD = 12; // cells of lattice and sponge past each edge
const NX = 128 + 2 * PAD, NY = 256 + 2 * PAD, NC = NX * NY;
const CFL = 0.5;
const F0 = 0.37; // omega a / 2 pi c at mid-gap
const RATE = 75; // time steps a second for each unit of the speed knob
const SIGMA_CYC = 2.0; // width of the envelope, cycles
const AMP = 0.29; // source strength a packet of amplitude 1 is launched with, which puts its peak in the channel near 1
const KICK = 1.35; // rod push, in knob units
const SMAX = 0.3, DAMP = 5e-5;
const TRICKLE = 0.5; // a steady source beside the packets while the frequency is outside the gap, as a share of a packet's
const MAXSTEPS = 60; // a long frame cannot run more steps than this

// The path: is the rod at lattice site (i, j) taken out?
const guide = (i, j) =>
  (i === 2 && (j <= 4 || j >= 9)) || (j === 4 && i >= 2 && i <= 5) || (i === 5 && j >= 4 && j <= 9) || (j === 9 && i >= 2 && i <= 5);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const rods = [];
  for (let i = -1; i <= 8; i++)
    for (let j = -1; j <= 16; j++) {
      if (guide(i, j)) continue;
      // a push inside the unit disc, drawn once and kept
      let u, v;
      do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
      } while (u * u + v * v > 1);
      rods.push({ x: PAD + (i + 0.5) * A, y: PAD + (j + 0.5) * A, u, v });
    }
  // damping: sponge and trace, one factor for all three fields
  const m = new Float32Array(NC);
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) {
      const dx = max(0, PAD - x, x - (NX - 1 - PAD)) / PAD, dy = max(0, PAD - y, y - (NY - 1 - PAD)) / PAD;
      m[y * NX + x] = exp(-(SMAX * (dx * dx * dx + dy * dy * dy) + DAMP));
    }
  // the source blob
  const sx = PAD + 2.5 * A, sy = PAD + 2;
  const si = [], sw = [];
  for (let y = -6; y <= 6; y++)
    for (let x = -6; x <= 6; x++) {
      const w = exp(-(x * x + y * y) / (2 * 2.5 * 2.5));
      if (w > 0.03) {
        si.push((sy + y) * NX + sx + x);
        sw.push(w);
      }
    }
  params.s = {
    Ez: new Float32Array(NC),
    Hx: new Float32Array(NC),
    Hy: new Float32Array(NC),
    cE: new Float32Array(NC),
    m,
    cov: new Float32Array(NC),
    rod: new Float32Array(NPX),
    rods,
    srcI: Int32Array.from(si),
    srcW: Float32Array.from(sw),
    packets: [],
    n: 0,
    next: 0,
    ready: false,
    dis: 0,
    built: -1,
    sinceBuild: 1,
    acc: 0,
    tr: 0,
    trTo: 0,
    cw: 0,
    hue: 0,
    f: F0,
    speed: 2,
    col: [0, 0, 0],
  };
}

// Epsilon from the rods where they stand now. Each cell takes the largest share of itself that a rod covers.
function build(S, dis) {
  const cov = S.cov, kick = dis * KICK * A;
  cov.fill(0);
  for (const r of S.rods) {
    const cx = r.x + r.u * kick, cy = r.y + r.v * kick;
    const x0 = max(0, floor(cx - ROD - 2)), x1 = min(NX - 1, floor(cx + ROD + 2));
    const y0 = max(0, floor(cy - ROD - 2)), y1 = min(NY - 1, floor(cy + ROD + 2));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const c = cl(0.5 + ROD - sqrt(dx * dx + dy * dy), 0, 1);
        const k = y * NX + x;
        if (c > cov[k]) cov[k] = c;
      }
    }
  }
  const cE = S.cE, rod = S.rod, k1 = EPS - 1;
  for (let k = 0; k < NC; k++) cE[k] = CFL / (1 + k1 * cov[k]);
  // what the panel shows of the rods: the cell shares, averaged to LEDs
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (PAD + 2 * y) * NX + PAD + 2 * x;
      rod[y * W + x] = (cov[k] + cov[k + 1] + cov[k + NX] + cov[k + NX + 1]) * 0.25;
    }
  S.built = dis;
  S.sinceBuild = 0;
}

// Outside the gap a point source couples to no mode and its light spreads through the rods a quarter as strong as the guided
// kind, so the source is raised there to keep the rings in view.
const boost = (f) => 1 + 2.2 * (1 - sm(0.25, 0.33, f)) + 0.8 * sm(0.44, 0.52, f);

function launch(S, amp, startAt) {
  const T = (2 * A) / S.f;
  S.packets.push({ n0: startAt, w: (PI * S.f) / A, sg: SIGMA_CYC * T, amp: amp * AMP * boost(S.f), ph: Math.random() * 6.2832 });
}

// One time step: H from E, E from H, then the sources.
function step(S) {
  const { Ez, Hx, Hy, cE, m } = S;
  for (let j = 0; j < NY - 1; j++) {
    let k = j * NX;
    const e = k + NX - 1;
    for (; k < e; k++) {
      const mm = m[k];
      Hx[k] = mm * Hx[k] - CFL * (Ez[k + NX] - Ez[k]);
      Hy[k] = mm * Hy[k] + CFL * (Ez[k + 1] - Ez[k]);
    }
  }
  for (let j = 1; j < NY - 1; j++) {
    let k = j * NX + 1;
    const e = k + NX - 2;
    for (; k < e; k++) Ez[k] = m[k] * Ez[k] + cE[k] * (Hy[k] - Hy[k - 1] - Hx[k] + Hx[k - NX]);
  }
  const n = ++S.n, ps = S.packets;
  let v = 0;
  S.tr += (S.trTo - S.tr) * 0.003;
  if (S.tr > 1e-4) {
    S.cw += (PI * S.f) / A;
    v += S.tr * sin(S.cw);
  }
  for (let p = ps.length - 1; p >= 0; p--) {
    const P = ps[p], t = n - P.n0 - 3 * P.sg;
    if (t > 3 * P.sg) {
      ps.splice(p, 1);
      continue;
    }
    if (t < -3 * P.sg) continue;
    v += P.amp * exp(-(t * t) / (2 * P.sg * P.sg)) * sin(P.w * t + P.ph);
  }
  if (v !== 0) {
    const si = S.srcI, sw = S.srcW;
    for (let q = 0; q < si.length; q++) Ez[si[q]] += v * sw[q];
  }
  if (n >= S.next) {
    // a packet now; one time in four a second follows it within 2.6 to 3.8 s
    launch(S, 0.75 + 0.25 * Math.random(), n);
    let gap = 0;
    if (Math.random() < 0.26) {
      gap = (2.6 + 1.2 * Math.random()) * 150;
      launch(S, 0.7 + 0.25 * Math.random(), n + floor(gap));
    }
    S.next = n + floor(gap + (4 + 5 * Math.random()) * 150);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kn[0], 0, 1);
  S.speed = cl(kn[1], 0.8, 5);
  S.f = F0 + cl(kn[2], -0.17, 0.18);
  S.trTo = TRICKLE * AMP * boost(S.f) * max(1 - sm(0.29, 0.33, S.f), sm(0.44, 0.49, S.f));
  const target = cl(kn[3] - 0.06, 0, 0.3);
  if (!S.ready) {
    S.ready = true;
    S.dis = target;
    build(S, target);
    // Before the first frame: one packet 62% of the way down the channel and the one after it 14% of the way, 4.4 s behind.
    const sg = SIGMA_CYC * ((2 * A) / S.f);
    S.next = 1e9;
    launch(S, 0.95, 0);
    launch(S, 0.8, 660);
    const run = floor(3 * sg + 852);
    for (let i = 0; i < run; i++) step(S);
    S.next = S.n + 450 + floor(Math.random() * 300);
    return;
  }
  // The disorder eases to the knob. The lattice is rebuilt when it has moved by a hair, and not more than 7 times a second.
  S.dis += (target - S.dis) * (1 - exp(-d / 0.3));
  S.sinceBuild += d;
  if (abs(S.dis - S.built) > 0.005 && S.sinceBuild > 0.14) build(S, S.dis);
  S.acc += d * RATE * S.speed;
  const n = min(MAXSTEPS, floor(S.acc));
  S.acc = min(S.acc - n, 1);
  for (let i = 0; i < n; i++) step(S);
}

// -------------------------------------------------------------------- drawing

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const Ez = S.Ez, rod = S.rod, h = S.hue;
  // gold and cyan-violet, each in three tones: faint, full and the pale core of the strongest light
  const gl = [0, 0, 0], gm = [0, 0, 0], gh = [0, 0, 0], cl0 = [0, 0, 0], cm = [0, 0, 0], ch = [0, 0, 0], rc = [0, 0, 0];
  hsv(0.1 + h, 1, 0.6, gl);
  hsv(0.115 + h, 0.95, 1, gm);
  hsv(0.14 + h, 0.42, 1, gh);
  hsv(0.7 + h, 0.9, 0.55, cl0);
  hsv(0.54 + h, 0.92, 0.95, cm);
  hsv(0.5 + h, 0.38, 1, ch);
  hsv(0.6 + h, 0.4, 1, rc);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = (PAD + 2 * y) * NX + PAD + 2 * x;
      const e = (Ez[k] + Ez[k + 1] + Ez[k + NX] + Ez[k + NX + 1]) * 0.25;
      const a = abs(e);
      const b = 1 - exp(-2.4 * pow(a, 1.2));
      let r = 0, g = 0, bl = 0;
      if (b > 0.004) {
        const lo = e > 0 ? gl : cl0, mid = e > 0 ? gm : cm, hi = e > 0 ? gh : ch;
        if (b < 0.3) {
          const t = b / 0.3;
          r = lo[0] * t;
          g = lo[1] * t;
          bl = lo[2] * t;
        } else if (b < 0.7) {
          const t = (b - 0.3) / 0.4;
          r = lo[0] + (mid[0] - lo[0]) * t;
          g = lo[1] + (mid[1] - lo[1]) * t;
          bl = lo[2] + (mid[2] - lo[2]) * t;
        } else {
          const t = (b - 0.7) / 0.3;
          r = mid[0] + (hi[0] - mid[0]) * t;
          g = mid[1] + (hi[1] - mid[1]) * t;
          bl = mid[2] + (hi[2] - mid[2]) * t;
        }
      }
      const rv = rod[y * W + x] * 0.45 * (1 - 0.6 * b);
      r += rc[0] * rv;
      g += rc[1] * rv;
      bl += rc[2] * rv;
      display.setPixel(x, y, (cl(r, 0, 1) * 255 + 0.5) | 0, (cl(g, 0, 1) * 255 + 0.5) | 0, (cl(bl, 0, 1) * 255 + 0.5) | 0);
    }
  }
}
