// ===== Patternflow pattern =====
// Title:   Phonon Focus
// Family:  phononfocus
// Idea:    A heat pulse crosses a germanium-like crystal and lands on the far face as a map of bright caustic lines, a time gate sweeps up through the arrival times so the fast longitudinal map, then the two transverse maps, light up in turn, and one knob bends the crystal's elastic anisotropy until the cusps appear, fold and vanish.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Phonon focusing in solids (Taylor, Maris and Elbaum, 1969) and the phonon images of Ge, Si and GaAs made by scanning a laser heater over one face and reading a bolometer on the other (Northrop and Wolfe, 1980s), from memory; the Christoffel equation for a cubic crystal; the elastic constants are Ge's, c11 129, c12 48.3, c44 67.1 GPa. Original here: the anisotropy is moved while the bulk modulus is held, and the time gate and the drift are for the panel, pattern round 266
// Round:   266
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Anisotropy=0..3, Turn=-1..1, Gate=-1..1
//
// Knob 1: Hue. Turns the whole thermal ramp round the wheel. At 0 it runs black, indigo, purple, crimson, orange and white-hot; at 0.33 the same ramp is teal, green and yellow into white; at 0.66 it is blue, violet and pink. The white-hot end stays white.
// Knob 2: Anisotropy. The crystal's elastic anisotropy ratio A = 2 c44 / (c11 - c12), 0.5 at 0, exactly 1 (an isotropic solid) at 1, 2 where it opens and 3.9 at 3, with the bulk modulus held at Ge's. Ge itself is 1.66 and GaAs 1.84. At 1 the caustics are gone and each branch is a smooth round bloom. Pushed to 1.2 they come back as a thin diamond, at 1.7 and 2 they are a lattice of diamonds with bright caps at top and bottom, at 3 they cross and overlap, and past 3.5 they open into fans. Below 1 the transverse branches change places and the picture is a lens with bright side wings. The value also drifts, by a slow random walk of about 0.2 in the log base 2, so the picture is never quite at the number the knob says.
// Knob 3: Turn. Rotates the crystal about the face normal, 100 degrees either way, so the long axes of the star swing from the 128 rows to the 64 columns and the lobes are cut by the panel's sides. The picture has a two-fold symmetry, so turning by 180 degrees brings back the opening.
// Knob 4: Gate. The width and the speed of the time gate. At -1 the gate is 0.43 as wide and a sweep takes 1.7 times longer (about 8 s), so each branch shows as a thin shell of one arrival time; at 0 it is 5 percent of the whole flight window and a sweep takes about 4.6 s; at 1 it is 2.3 times as wide and a sweep takes 2.6 s, wide enough that a branch shows nearly whole.

// What the picture is. A point heater on one face of a (110) cut of a cubic crystal sends phonons in every direction at once, and a detector on the opposite face reads where and when they land. A phonon's
// energy goes along the group velocity, not along its wave vector, so equal steps in the direction of the wave vector land very unevenly on the detector. The map from wave-vector direction to detector position
// folds over on itself, and the energy piles up on the folds as bright lines, the caustics. Here each of tens of thousands of wave-vector directions is pushed to the detector with weight one and splatted
// into a 64 x 128 buffer, and the caustics appear by themselves wherever many directions land on the same LEDs. Nothing is drawn as a line. The arrival time of each direction is the thickness of the
// crystal over the component of its group velocity along the normal, so the longitudinal branch lands first, then the fast transverse one, then the slow one, and a gate in arrival time sweeps through them.
// A pulse fires at a random moment, the gate sweeps up from before the first longitudinal arrival to the end of the slow branch, and under it a faint sum of every direction at every time keeps the map readable.
// What is modelled. The Christoffel equation for a cubic crystal, solved by an eigen decomposition for each direction: the three eigenvalues are the three branches (slow transverse, fast transverse,
// longitudinal) and the group velocity is the gradient of each eigenvalue, from its eigenvector. With the stiffnesses in units of c44 the matrix is 1 + P diag(n^2) plus q on the off diagonals,
// with P = c11/c44 - 1 and q = (c12 + c44)/c44, and the anisotropy A = 2/(P - q + 2). A isotropic at 1. The bulk modulus is held at Ge's, so P and q follow from A alone. The directions are a quarter of
// a hemisphere in the crystal's own mirror planes (lab x along [001], y along [1 -1 0], z along [1 1 0]) and the other three quarters are mirrored copies. The solutions are tabulated in setup at 18 values of the
// anisotropy, 0.25 apart in its log base 2, and each frame interpolates the landing point and the arrival time between them with a cubic, so the anisotropy can move smoothly. Turning the crystal
// about the normal is a rotation of the landing points, which is exact.
// What is not exact. There is no phonon amplitude, so every direction carries the same energy, and no finite size of the heater or the detector, no scattering, and no mode conversion. The three branches are
// weighted by eye, 0.75 for the longitudinal one that heat pulses couple weakly to, 1.0 and 1.15 for the transverse ones, and the gate's width and the sweep's speed are chosen for the panel. The elastic
// constants run through a range no single crystal has, from 0.5 to 3.9 in the ratio A.

const W = 64, H = 128;
const PADM = 5, PW = W + 2 * PADM, PH = H + 2 * PADM; // the buffer the splats go into, with a margin so the edge needs no test
const { floor, sqrt, exp, sin, cos, abs, min, max, PI, pow, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
const R2 = Math.SQRT1_2;

// ---- the physics
const BULK = 75.2 / 67.1; // (c11 + 2 c12) / (3 c44) for Ge, held while the anisotropy moves
const SC = 50; // LEDs per unit of x/L on the detector
const L2A0 = -1.5, DL = 0.25, NS = 18; // stops of log2 A: -1.5, -1.25 ... 2.75; the cubic needs one on either side, so A runs from 2^-1.25 to 2^2.5
const NQ = 14000, NZMIN = 0.1; // directions in a quarter of the hemisphere, from the normal down to cos 84 degrees
const RKEEP = 84; // a direction that never lands within this many LEDs of the middle is dropped
const TCAP = 8, XCAP = 500;
const NPULSE = 4; // pulses in flight at once, at most
const NG = 41; // the grid of shares g the arrival-time quantiles are kept on

// the eigen decomposition of a symmetric 3 x 3 matrix by Jacobi rotations, eigenvalues in ascending order
const JA = new Float64Array(9), JV = new Float64Array(9), JE = new Float64Array(12);
function eig3(a11, a22, a33, a12, a13, a23) {
  JA[0] = a11; JA[1] = a12; JA[2] = a13; JA[3] = a12; JA[4] = a22; JA[5] = a23; JA[6] = a13; JA[7] = a23; JA[8] = a33;
  JV[0] = 1; JV[1] = 0; JV[2] = 0; JV[3] = 0; JV[4] = 1; JV[5] = 0; JV[6] = 0; JV[7] = 0; JV[8] = 1;
  for (let sweep = 0; sweep < 7; sweep++) {
    if (abs(JA[1]) + abs(JA[2]) + abs(JA[5]) < 1e-12) break;
    for (let p = 0; p < 2; p++)
      for (let q = p + 1; q < 3; q++) {
        const apq = JA[p * 3 + q];
        if (abs(apq) < 1e-14) continue;
        const th = (JA[q * 3 + q] - JA[p * 3 + p]) / (2 * apq);
        const t = (th < 0 ? -1 : 1) / (abs(th) + sqrt(th * th + 1));
        const c = 1 / sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) {
          const x = JA[k * 3 + p], y = JA[k * 3 + q];
          JA[k * 3 + p] = c * x - s * y;
          JA[k * 3 + q] = s * x + c * y;
        }
        for (let k = 0; k < 3; k++) {
          const x = JA[p * 3 + k], y = JA[q * 3 + k];
          JA[p * 3 + k] = c * x - s * y;
          JA[q * 3 + k] = s * x + c * y;
        }
        for (let k = 0; k < 3; k++) {
          const x = JV[k * 3 + p], y = JV[k * 3 + q];
          JV[k * 3 + p] = c * x - s * y;
          JV[k * 3 + q] = s * x + c * y;
        }
      }
  }
  let i0 = 0, i1 = 1, i2 = 2;
  const e0 = JA[0], e1 = JA[4], e2 = JA[8];
  let lo = e0, mid = e1, hi = e2;
  if (lo > mid) { const t = lo; lo = mid; mid = t; i0 = 1; i1 = 0; }
  if (mid > hi) { const t = mid; mid = hi; hi = t; const u = i1; i1 = i2; i2 = u; }
  if (lo > mid) { const t = lo; lo = mid; mid = t; const u = i0; i0 = i1; i1 = u; }
  const ids = [i0, i1, i2];
  for (let b = 0; b < 3; b++) {
    const i = ids[b];
    JE[b * 4] = JA[i * 4];
    JE[b * 4 + 1] = JV[i];
    JE[b * 4 + 2] = JV[3 + i];
    JE[b * 4 + 3] = JV[6 + i];
  }
}

const VG = new Float64Array(9);
// group velocity of each branch for the unit wave vector (n1, n2, n3) in the crystal's own axes, in units of the square root of c44 over the density
function groupVelocity(P, q, n1, n2, n3) {
  const p1 = P + 1;
  eig3(1 + P * n1 * n1, 1 + P * n2 * n2, 1 + P * n3 * n3, q * n1 * n2, q * n1 * n3, q * n2 * n3);
  for (let b = 0; b < 3; b++) {
    const lam = JE[b * 4], e1 = JE[b * 4 + 1], e2 = JE[b * 4 + 2], e3 = JE[b * 4 + 3];
    const q11 = e1 * e1, q22 = e2 * e2, q33 = e3 * e3;
    // the gradient of e . Gamma(k) . e, Gamma(k) = (p1 k1^2 + k2^2 + k3^2, ...) with q k_i k_j off the diagonal
    const d1 = 2 * n1 * (q11 * p1 + q22 + q33) + 2 * q * (e1 * e2 * n2 + e1 * e3 * n3);
    const d2 = 2 * n2 * (q11 + q22 * p1 + q33) + 2 * q * (e1 * e2 * n1 + e2 * e3 * n3);
    const d3 = 2 * n3 * (q11 + q22 + q33 * p1) + 2 * q * (e1 * e3 * n1 + e2 * e3 * n2);
    const inv = 0.5 / sqrt(lam);
    VG[b * 3] = d1 * inv;
    VG[b * 3 + 1] = d2 * inv;
    VG[b * 3 + 2] = d3 * inv;
  }
}

// ---- the tables: for each direction in the quarter, each branch and each stop of the anisotropy, where the direction lands (LEDs from the middle) and when
function buildTables() {
  const GA = 0.6180339887498949;
  const dx = new Float64Array(NQ), dy = new Float64Array(NQ), dz = new Float64Array(NQ);
  for (let i = 0; i < NQ; i++) {
    // a Fibonacci lattice, uniform in solid angle, folded into the quadrant, a little jittered
    const nz = 1 - ((i + 0.5 + 0.35 * (rnd() - 0.5)) / NQ) * (1 - NZMIN);
    const f = (i * GA + 0.004 * (rnd() - 0.5)) % 1;
    const ph = cl((f < 0 ? f + 1 : f) * (PI / 2), 0.003, PI / 2 - 0.003);
    const r = sqrt(1 - nz * nz);
    dx[i] = r * cos(ph); dy[i] = r * sin(ph); dz[i] = nz;
  }
  const tab = new Float32Array(NQ * 3 * NS * 3);
  const near = new Uint8Array(NQ * 3);
  for (let s = 0; s < NS; s++) {
    const A = pow(2, L2A0 + DL * s);
    const q = BULK + 1 - 2 / (3 * A), P = q + 2 / A - 2;
    for (let k = 0; k < NQ; k++) {
      const lx = dx[k], ly = dy[k], lz = dz[k];
      groupVelocity(P, q, (ly + lz) * R2, (lz - ly) * R2, lx);
      for (let b = 0; b < 3; b++) {
        const v1 = VG[b * 3], v2 = VG[b * 3 + 1], v3 = VG[b * 3 + 2];
        const gx = v3, gy = (v1 - v2) * R2, gz = (v1 + v2) * R2;
        const o = ((k * 3 + b) * NS + s) * 3;
        if (gz > 0.1) {
          const x = cl(SC * gx / gz, -XCAP, XCAP), y = cl(SC * gy / gz, -XCAP, XCAP);
          tab[o] = x; tab[o + 1] = y; tab[o + 2] = min(TCAP, 1 / gz);
          if (x * x + y * y < RKEEP * RKEEP) near[k * 3 + b] = 1;
        } else {
          tab[o] = gx >= 0 ? XCAP : -XCAP; tab[o + 1] = gy >= 0 ? XCAP : -XCAP; tab[o + 2] = TCAP;
        }
      }
    }
  }
  const keep = [0, 1, 2].map((b) => {
    const l = [];
    for (let k = 0; k < NQ; k++) if (near[k * 3 + b]) l.push(k);
    return Int32Array.from(l);
  });
  // when the energy lands: for each stop, the arrival time below which a share g of the directions that land on the panel have arrived
  const qt = new Float32Array(NS * NG);
  for (let s = 0; s < NS; s++) {
    const ts = [];
    for (let b = 0; b < 3; b++) {
      const list = keep[b];
      for (let j = 0; j < list.length; j++) {
        const o = ((list[j] * 3 + b) * NS + s) * 3;
        if (abs(tab[o]) < 40 && abs(tab[o + 1]) < 72 && tab[o + 2] < TCAP) ts.push(tab[o + 2]);
      }
    }
    const a = Float32Array.from(ts).sort();
    for (let i = 0; i < NG; i++) qt[s * NG + i] = a[floor((0.004 + 0.97 * (i / (NG - 1))) * (a.length - 1))];
  }
  return { tab, keep, qt };
}

// ---- the colour ramp, black through indigo, purple, crimson and orange to white-hot, with the hue turned by K1
const TARGET = 0.26; // the mean of 1 - exp(-a) over the panel that the exposure aims for
const PN = 1024, PEXP = 128; // the lookup is indexed by the accumulated brightness a, in 1/128 steps; the ramp is 1 - exp(-a)
const RAMP = [
  // u, hue, saturation, value
  [0.0, 0.72, 1.0, 0.0],
  [0.05, 0.72, 1.0, 0.22],
  [0.16, 0.74, 1.0, 0.55],
  [0.32, 0.86, 1.0, 0.82],
  [0.48, 0.975, 1.0, 0.96],
  [0.62, 1.03, 1.0, 1.0],
  [0.76, 1.085, 1.0, 1.0],
  [0.88, 1.14, 0.85, 1.0],
  [1.0, 1.15, 0.22, 1.0],
];
const EXPT = new Float32Array(PN);
for (let i = 0; i < PN; i++) EXPT[i] = 1 - exp(-i / PEXP);
function hsv(h, s, v, out, o) {
  h = h - floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  out[o] = floor(r * 255 + 0.5); out[o + 1] = floor(g * 255 + 0.5); out[o + 2] = floor(b * 255 + 0.5);
}
function buildPalette(pal, hue) {
  for (let i = 0; i < PN; i++) {
    const u = 1 - exp(-i / PEXP);
    let j = 0;
    while (j < RAMP.length - 2 && u > RAMP[j + 1][0]) j++;
    const a = RAMP[j], b = RAMP[j + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    hsv(a[1] + (b[1] - a[1]) * f + hue, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, pal, i * 3);
  }
}

// ---- the state
export function setup(params) {
  const { tab, keep, qt } = buildTables();
  params.s = {
    tab, keep, qt, qf: new Float64Array(NG),
    acc: new Float32Array(PW * PH), tmp: new Float32Array(PW * PH),
    idx: new Uint16Array(W * H),
    pal: new Uint8Array(PN * 3), palHue: -9,
    pulses: [], act: new Float64Array(NPULSE * 8), gap: 0, started: false,
    ag: 1, dz: 0, dla: 0, dlb: 0, dph: 0, hx: 0, hy: 0, la: 0, phi: 0, gate: 0,
  };
}

// the arrival time at which a share g of the energy has landed, between the grid's points, carried on past its ends at the slope they have
function quant(qf, g) {
  const x = g * (NG - 1);
  if (x <= 0) return qf[0] + x * (qf[1] - qf[0]);
  if (x >= NG - 1) return qf[NG - 1] + (x - (NG - 1)) * (qf[NG - 1] - qf[NG - 2]);
  const i = floor(x), f = x - i;
  return qf[i] + f * (qf[i + 1] - qf[i]);
}

const wts = new Float64Array(4);
function cubic(u) {
  const u2 = u * u, u3 = u2 * u;
  wts[0] = 0.5 * (-u3 + 2 * u2 - u);
  wts[1] = 0.5 * (3 * u3 - 5 * u2 + 2);
  wts[2] = 0.5 * (-3 * u3 + 4 * u2 + u);
  wts[3] = 0.5 * (u3 - u2);
}

const BW = [1.15, 1.0, 0.75]; // branch weights, slow transverse first: see the header
const pw = new Float64Array(NPULSE);
function newPulse(ph) {
  const g = gauss();
  return {
    ph, rate: 1 / (3.4 + 2.6 * rnd()), wf: exp(cl(0.35 * gauss(), -0.6, 0.6)), amp: 0.85 + 0.3 * rnd(),
    ox: cl(2 * gauss(), -5, 5), oy: cl(2 * gauss(), -5, 5),
    bw: [exp(cl(0.5 * g, -0.9, 0.7)), exp(cl(0.5 * gauss(), -0.9, 0.7)), exp(cl(0.6 * gauss(), -1.2, 0.5))],
  };
}
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);

  // palette
  const hue = cl(kn[0], 0, 1);
  if (hue !== S.palHue) { buildPalette(S.pal, hue); S.palHue = hue; }

  // the knobs and the slow drifts: the anisotropy wanders as a share of how far the knob has taken it from isotropic, and a little beside it
  const adt = d / 14, bdt = d / 22, rdt = d / 35, hdt = d / 14;
  S.dla += -S.dla * adt + 0.9 * sqrt(2 * adt) * gauss();
  S.dlb += -S.dlb * bdt + 0.14 * sqrt(2 * bdt) * gauss();
  S.dph += -S.dph * rdt + 0.7 * sqrt(2 * rdt) * gauss();
  S.dz += -S.dz * (d / 20) + 0.32 * sqrt(2 * d / 20) * gauss();
  S.hx += -S.hx * hdt + 15 * sqrt(2 * hdt) * gauss();
  S.hy += -S.hy * hdt + 24 * sqrt(2 * hdt) * gauss();
  const Ak = pow(2, cl(kn[1], 0, 3) - 1);
  const Ae = cl(1 + (Ak - 1) * exp(0.5 * S.dla) + S.dlb, 0.45, 5.4);
  const laT = log(Ae) / log(2);
  const phiT = cl(kn[2], -1, 1) * 1.745 + S.dph;
  const gate = cl(kn[3], -1, 1);
  if (!S.started) { S.la = laT; S.phi = phiT; S.gate = gate; } // the first frame opens on the knobs
  const sm = 1 - exp(-d / 0.12);
  S.la += (laT - S.la) * sm;
  S.phi += (phiT - S.phi) * sm;
  S.gate += (gate - S.gate) * sm;

  // where in the stops the anisotropy is
  const fs = (S.la - L2A0) / DL;
  const s0 = cl(floor(fs), 1, NS - 3), u = fs - s0;
  cubic(u);
  const c0 = wts[0], c1 = wts[1], c2 = wts[2], c3 = wts[3];
  const tab = S.tab;

  // the arrival-time quantiles at this anisotropy
  const qf = S.qf, qt = S.qt;
  for (let i = 0; i < NG; i++)
    qf[i] = c0 * qt[(s0 - 1) * NG + i] + c1 * qt[s0 * NG + i] + c2 * qt[(s0 + 1) * NG + i] + c3 * qt[(s0 + 2) * NG + i];
  const wf = pow(2, 1.2 * S.gate), sp = pow(2, 0.8 * S.gate);

  // pulses: a gate sweeping up through the arrival times, fired at random moments, each with a heater spot, a width, a speed and branch weights of its own
  const first = !S.started;
  if (!S.started) {
    S.started = true;
    S.pulses.push(newPulse(0.3));
    S.gap = 1.2 + 2 * rnd();
  }
  S.gap -= d * sp;
  let live = 0;
  for (const p of S.pulses) if (p.ph > 0.05 && p.ph < 0.92) live++;
  if ((S.gap <= 0 || live === 0) && S.pulses.length < NPULSE) {
    S.pulses.push(newPulse(rnd() < 0.35 ? 0.12 + 0.3 * rnd() : -0.05));
    S.gap = 0.4 + 1.6 * rnd() * rnd() + 0.6 * rnd();
  }
  const act = S.act;
  let NA = 0;
  for (let i = S.pulses.length - 1; i >= 0; i--) {
    const p = S.pulses[i];
    p.ph += d * sp * p.rate;
    if (p.ph > 1.07) { S.pulses.splice(i, 1); continue; }
    const g = p.ph;
    const hw = 0.05 * wf * p.wf;
    const fade = min(1, (g + 0.05) / 0.06) * min(1, (1.07 - g) / 0.1) * p.amp * 0.16 * pow(0.05 / hw, 0.5);
    const o = NA++ * 8;
    const tc = quant(qf, g), tlo = quant(qf, g - 2.6 * hw), thi = quant(qf, g + 2.6 * hw);
    act[o] = tc; act[o + 1] = 1 / max(tc - tlo, 0.004); act[o + 2] = 1 / max(thi - tc, 0.004);
    act[o + 3] = fade * p.bw[0]; act[o + 4] = fade * p.bw[1]; act[o + 5] = fade * p.bw[2];
    act[o + 6] = p.ox; act[o + 7] = p.oy;
  }

  // splat
  const acc = S.acc;
  acc.fill(0);
  const zm = exp(cl(S.dz, -0.45, 0.45)), cph = zm * cos(S.phi), sph = zm * sin(S.phi);
  const bx = W / 2 + PADM, by = H / 2 + PADM;
  const ox = bx + S.hx, oy = by + S.hy;
  const base = 0.007;
  const keep = S.keep;
  const ST = NS * 3;
  for (let b = 0; b < 3; b++) {
    const list = keep[b], n = list.length, wb = BW[b];
    for (let j = 0; j < n; j++) {
      const k = list[j];
      const o = (k * 3 + b) * ST + (s0 - 1) * 3;
      let pass = 0;
      if (NA) {
        const t = c0 * tab[o + 2] + c1 * tab[o + 5] + c2 * tab[o + 8] + c3 * tab[o + 11];
        for (let a = 0; a < NA; a++) {
          const o8 = a * 8, df = t - act[o8], dd = df * (df < 0 ? act[o8 + 1] : act[o8 + 2]);
          if (dd > -1 && dd < 1) { const e = 1 - dd * dd; pw[a] = act[o8 + 3 + b] * e * e; pass = 1; } else pw[a] = 0;
        }
      }
      const wbase = (j & 3) === 0 ? base * 4 * wb : 0;
      if (!pass && wbase === 0) continue;
      const x = c0 * tab[o] + c1 * tab[o + 3] + c2 * tab[o + 6] + c3 * tab[o + 9];
      const y = c0 * tab[o + 1] + c1 * tab[o + 4] + c2 * tab[o + 7] + c3 * tab[o + 10];
      const xr = cph * x, xs = sph * x, yr = cph * y, ys = sph * y;
      if (wbase > 0) {
        splat(acc, ox + xr - ys, oy + xs + yr, wbase);
        splat(acc, ox - xr - ys, oy - xs + yr, wbase);
        splat(acc, ox + xr + ys, oy + xs - yr, wbase);
        splat(acc, ox - xr + ys, oy - xs - yr, wbase);
      }
      if (pass)
        for (let a = 0; a < NA; a++) {
          const w = pw[a] * wb;
          if (w === 0) continue;
          const px = ox + act[a * 8 + 6], py = oy + act[a * 8 + 7];
          const ar = xr, as = xs, br = yr, bs = ys;
          splat(acc, px + ar - bs, py + as + br, w);
          splat(acc, px - ar - bs, py - as + br, w);
          splat(acc, px + ar + bs, py + as - br, w);
          splat(acc, px - ar + bs, py - as - br, w);
        }
    }
  }

  // blur, then colour
  const tmp = S.tmp;
  for (let y = PADM - 2; y < PADM + H + 2; y++) {
    const r = y * PW;
    for (let x = PADM; x < PADM + W; x++) {
      const i = r + x;
      tmp[i] = (acc[i - 2] + 2 * acc[i - 1] + 3 * acc[i] + 2 * acc[i + 1] + acc[i + 2]) * (1 / 9);
    }
  }
  // the exposure follows the mean brightness the panel would show, so a pulse's quiet moments are not dim ones: the first frame settles it at once
  const idx = S.idx;
  const rounds = first ? 6 : 1;
  for (let round = 0; round < rounds; round++) {
    const gain = S.ag * PEXP;
    let o2 = 0, sum = 0;
    for (let y = 0; y < H; y++) {
      const r = (y + PADM) * PW + PADM;
      for (let x = 0; x < W; x++) {
        const i = r + x;
        const v = (tmp[i - 2 * PW] + 2 * tmp[i - PW] + 3 * tmp[i] + 2 * tmp[i + PW] + tmp[i + 2 * PW]) * (1 / 9);
        const q = (v * gain) | 0;
        const qq = q > PN - 1 ? PN - 1 : q;
        idx[o2++] = qq;
        sum += EXPT[qq];
      }
    }
    const m = sum / (W * H);
    S.ag = cl(S.ag * pow(TARGET / max(m, 0.01), first ? 0.8 : min(1, d * 1.5)), 0.3, 4);
  }
}

function splat(acc, px, py, w) {
  const ix = floor(px), iy = floor(py);
  if (ix < 1 || iy < 1 || ix >= PW - 2 || iy >= PH - 2) return;
  const fx = px - ix, fy = py - iy;
  const i = iy * PW + ix;
  const a = w * (1 - fx), b = w * fx;
  acc[i] += a * (1 - fy);
  acc[i + 1] += b * (1 - fy);
  acc[i + PW] += a * fy;
  acc[i + PW + 1] += b * fy;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const idx = S.idx, pal = S.pal;
  let o = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = idx[o++] * 3;
      display.setPixel(x, y, pal[p], pal[p + 1], pal[p + 2]);
    }
}
