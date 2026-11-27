// ===== Patternflow pattern =====
// Title:   Seismite
// Family:  seismite
// Idea:    A trench wall of pale sand, rust silt, grey clay and dense dark sand sinks slowly as new beds settle on top, and each time an earthquake comes at random the wet sand liquefies for a few seconds, the dark sand sinks into the mud in balls and pillows with flames of mud pushed up between them, a crack may run up, fill with sand and blow a boil at the surface, and when the water has drained the folds freeze into the wall and scroll down as the fossil of that quake.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Seismite is Adolf Seilacher's word (1969) for a bed deformed by an earthquake; the structures (ball-and-pillow, flame, convolute bedding, sand dikes and blows) as John Allen (1982), Owen (1987) and Obermeier (1996) describe them; liquefaction as pore pressure reaching the weight of the ground above, Seed and Idriss (1971) and Youd; dense over light going unstable in viscous layers, with a wavelength set by thickness and viscosity contrast, Rayleigh (1883), Taylor (1950), Biot and Ode (1965), Whitehead and Luther (1975); many small and few large quakes, Gutenberg and Richter (1944); markers carried by a flow, Harlow (1964). All cited from memory. The solver, the numbers and the shortcuts under "What is made up" are mine.
// Round:   267
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shaking=0.8..2.6, Water=0..1, Mud=-1..1
//
// Knob 1: Hue. Turns the five bed colours round the wheel together, lightness kept. At 0 and at 1 the sand is pale ochre, the silt rust red, the clay grey-blue, the dense sand dark umber and the boil sand near-white cream; at 0.25 the set is violet, lilac and olive, at 0.5 teal and pale blue, at 0.75 green.
// Knob 2: Shaking. 0.8 to 2.6, opening at 2. How often and how hard the ground shakes. The mean gap between quakes is 22 s at 0.8, 9 s at 2 and 7 s at 2.6, and every size is scaled by 0.6 + 0.2 K, so the biggest is 0.76 of its size at the bottom and 1.12 at the top. A quake under size 0.25 only shivers the wall; over it the sand liquefies; over about 0.4 silt and clay give way too, the band folds, and over 0.45 a crack may open.
// Knob 3: Water. 0 to 1, opening at 0. The depth of the water table, 12 LED down at 0 and 58 at 1. Sand above it is dry and pale and never liquefies; the liquefiable band starts at the table, is 28 LED thick and has a soft 12 LED foot. At 0 the folding is in the top half and cracks reach the surface; at 1 the top half stays flat and the folding is below.
// Knob 4: Mud. -1 to 1, opening at 0.06. How stiff silt and clay are while the wall shakes, as a multiple of liquefied sand: 30 e^(1.9 K), which is 4.5 at -1, 34 at the opening and 200 at 1. Soft mud lets the dark sand sink deep with long flames between the lobes; stiff mud keeps the pillows shallow and the beds flatter.
//
// What the picture is. A vertical cut through wet layered ground, surface at the top edge, depth downward, left and right edges the same ground. Beds of 3 to 14 LED, now and then thicker, settle on top and the pile sinks 0.34 LED a second, so a bed is gone in six minutes. About 20 000 coloured markers carry the beds, splatted with soft weights and sharpened so boundaries stay crisp. Below the water table everything is darker. In a quake the wall shivers sideways and up and down by up to 2 LED, liquefied sand glints paler, the dark sand sinks in rounded balls and the mud rises between them in pointed flames. The folds stop when the pore pressure has drained, about 7 s after the shaking, and are fixed from then on.
// What is exact. Layers of different density and viscosity are a Stokes problem, solved here as one: the stream function on a 32 by 64 grid (2 LED a cell, periodic left to right, rigid lids top and bottom, free slip) from the minimum of viscous dissipation minus buoyancy work, with its own viscosity in every cell. The 1984 unknowns go through a banded Cholesky factorisation, redone when some cell's viscosity has moved by a factor of three; the solve runs 5 times a second while sand is liquefied. Velocities sit on cell faces, so the flow has no divergence and the markers keep their density.
// What is a model. Liquefaction is one number per cell, the pore pressure ratio: it rises toward the shaking times the cell's susceptibility, falls with an 8 s time constant and diffuses a little. From 0.35 the viscosity falls from 10 000 to its own value at 0.8, which is 1 for sand, twice the Mud value for silt and the Mud value for clay. Dark sand is 1.45 as dense as pale sand, silt 0.8 and clay 0.72. A quake's size is 0.04 + 0.96 u^3.5 with u uniform, Gutenberg-Richter in spirit only.
// What is made up. The dike is not computed: a 2 LED crack walks up from a liquefied sand bed at 24 LED a second at 23 to 37 degrees off vertical, wanders a little, may branch once, and turns every marker it passes into sand; at the surface it paints a lopsided pale lens, the boil. The shaking is only a displacement at draw time. Beds come from a shuffled bag so the mix stays even, each with a wavy lower boundary that seeds the instability. Gravity is turned up so a quake finishes in seconds; speed is capped at 2.2 LED a second. The opening is the wall after 240 s run at once without drawing (quakes at least as often as at Shaking 1.4), then a first quake 1.5 s later.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, log, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const F = (n) => new Float32Array(n);

const NX = 32, NY = 64, NCELL = NX * (NY - 1), NU = NX * (NY - 2), BW = 2 * NX;
const PERM = new Int32Array(NX); // folded order keeps the band narrow
for (let i = 0; i < NX; i++) PERM[i] = i < NX / 2 ? 2 * i : 2 * (NX - 1 - i) + 1;

const RHO = [1.0, 0.8, 0.72, 1.45, 0.95];
const CHI = [1.0, 0.72, 0.55, 0.9, 1.0]; // susceptibility to pore pressure
const BASE = [[236, 210, 156], [184, 78, 48], [98, 122, 146], [70, 48, 38], [248, 234, 198]];
const LNF = log(1e4);

const SP = 0.64, COLS = 100, NM = COLS * 208;
const SPEED = 0.34; // LED a second the pile sinks

export function setup(params) {
  const S = {
    ready: false,
    k: [0, 2, 0, 0.06],
    clock: 0,
    MX: F(NM), MY: F(NM).fill(-1e6), MC: new Uint8Array(NM), MT: F(NM), free: new Int32Array(NM), nfree: 0,
    ru: F(NCELL), q: F(NCELL), tmp: F(NCELL), cw: F(NCELL), cr: F(NCELL), cx: F(NCELL), cl: F(NCELL), lne: F(NCELL), mv: new Uint8Array(NCELL),
    A: new Float64Array(NU * (BW + 1)), rhs: new Float64Array(NU), psi: new Float64Array(NX * NY),
    uF: F(NX * NY), vF: F(NX * NY), nodeR: F(NX * NY), lneF: F(NCELL), fv: 0,
    vmax: 0, qMax: 0, ruMax: 0, tk: 0, dep: 0,
    z: 0, beds: [], nb: null, bag: [],
    yw: 12, tq: 5, ev: null, sh: 0, sc: 0.3, dikes: [],
    lut: F(15), lutK: -1, acc: F(5 * W * H), tone: F(W * H), shX: F(H), shY: F(W), M: 30,
  };
  params.s = S;
  return S;
}

function buildLut(S, k1) {
  const c = cos(TAU * k1), s = sin(TAU * k1);
  for (let n = 0; n < 5; n++) {
    const [r, g, b] = BASE[n];
    const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
    const I2 = I * c - Q * s, Q2 = I * s + Q * c;
    S.lut.set([Y + 0.956 * I2 + 0.621 * Q2, Y - 0.272 * I2 - 0.647 * Q2, Y - 1.106 * I2 + 1.703 * Q2].map((v) => cl(v, 0, 255)), n * 3);
  }
  S.lutK = k1;
}

function newBed(S, z0) {
  if (S.bag.length < 2) {
    const b = [0, 1, 2, 3, 0, 3, 1, 2, 3, 1];
    for (let i = b.length - 1; i > 0; i--) {
      const j = floor(rnd() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    S.bag.push(...b);
  }
  let c = S.bag.shift();
  if (S.last === c) {
    const n = S.bag.shift();
    S.bag.push(c);
    c = n;
  }
  S.last = c;
  const th = [3.5 + 6 * rnd() * rnd() + 1.5 * rnd(), 3 + 5 * rnd(), 3 + 4 * rnd(), 3 + 3.2 * rnd()][c] * (rnd() < 0.2 ? 1.7 : 1);
  return {
    c, z0, th,
    a: (rnd() < 0.25 ? 1.6 : 0.5) + 1.0 * rnd(), m1: 1 + floor(rnd() * 3), p1: rnd() * TAU, m2: 3 + floor(rnd() * 3), p2: rnd() * TAU, m3: 6 + floor(rnd() * 3), p3: rnd() * TAU,
    ph: rnd() * TAU, lam: c === 0 ? 0.4 + 0.3 * rnd() : 0.12,
  };
}
const bound = (b, x) =>
  b.z0 + b.a * (0.55 * sin((TAU * b.m1 * x) / W + b.p1) + 0.35 * sin((TAU * b.m2 * x) / W + b.p2) + 0.15 * sin((TAU * b.m3 * x) / W + b.p3));

// a slab of markers 0.64 LED thick at the top of the pile (ybase is its upper edge), kinds read from the beds at its height
function slab(S, ybase) {
  const z = S.z;
  S.z += SP;
  if (z >= S.nb.z0 - 1.6) {
    S.beds.push(S.nb);
    if (S.beds.length > 3) S.beds.shift();
    S.nb = newBed(S, S.nb.z0 + S.nb.th);
  }
  for (let cI = 0; cI < COLS; cI++) {
    if (S.nfree <= 0) return;
    const m = S.free[--S.nfree];
    const x = (cI + rnd()) * SP;
    let bd = S.beds[0];
    for (let k = S.beds.length - 1; k >= 0; k--) {
      if (z >= bound(S.beds[k], x)) {
        bd = S.beds[k];
        break;
      }
    }
    S.MX[m] = x;
    S.MY[m] = ybase + rnd() * SP;
    S.MC[m] = bd.c;
    S.MT[m] = bd.lam * sin(z * 1.1 + bd.ph);
  }
}

function bandW(S, Y) {
  return ss(S.yw - 3, S.yw + 3, Y) * (1 - ss(S.yw + 28, S.yw + 40, Y));
}

function quake(S, first) {
  const k2 = S.k[1];
  let s = 0.04 + 0.96 * Math.pow(rnd(), 3.5);
  s *= min(1.12, 0.6 + 0.2 * k2);
  if (first) s = cl(0.28 + 0.12 * k2, 0.3, 0.6);
  const D = 1.3 + 4.4 * s;
  const q = { t: 0, D, s, dk: [] };
  if (s > 0.45 && rnd() < 0.75) {
    const nd = s > 0.8 && rnd() < 0.6 ? 2 : 1;
    for (let i = 0; i < nd; i++) q.dk.push(D * (0.4 + 0.5 * rnd()));
  }
  S.tq = 3 + 9 * -log(1 - rnd());
  return q;
}

function fields(S) {
  const { cw, cr, cx, cl: cL } = S;
  cw.fill(0), cr.fill(0), cx.fill(0), cL.fill(0);
  const lna = [0, log(2 * S.M), log(S.M), 0.2, 0];
  const { MX, MY, MC } = S;
  for (let m = 0; m < NM; m++) {
    const y = MY[m];
    if (y < -1e5) continue;
    let fx = MX[m] * 0.5 - 0.5, fy = (y - 1) * 0.5 - 0.5;
    let i0 = floor(fx), j0 = floor(fy);
    fx -= i0, fy -= j0;
    if (j0 < 0) j0 = 0, fy = 0;
    else if (j0 > NY - 3) j0 = NY - 3, fy = 1;
    i0 = (i0 + NX) % NX;
    const i1 = i0 + 1 === NX ? 0 : i0 + 1, c = MC[m];
    for (let k = 0; k < 4; k++) {
      const w = (k & 1 ? fx : 1 - fx) * (k & 2 ? fy : 1 - fy), a = (j0 + (k >> 1)) * NX + (k & 1 ? i1 : i0);
      cw[a] += w, cr[a] += w * RHO[c], cx[a] += w * CHI[c], cL[a] += w * lna[c];
    }
  }
}

const IX = new Int32Array(4), SG = new Float64Array(4), SGN = [[1, 1, -1, -1], [1, -1, -1, 1]];
function addEl(A, w, kind) {
  let n = 0;
  for (let p = 0; p < 4; p++) if (IX[p] >= 0) (IX[n] = IX[p]), (SG[n++] = SGN[kind][p]);
  for (let p = 0; p < n; p++)
    for (let r = 0; r <= p; r++) {
      const a = IX[p], b = IX[r];
      const row = a > b ? a : b, col = a > b ? b : a;
      A[row * (BW + 1) + col - row + BW] += w * SG[p] * SG[r];
    }
}
const ui = (i, j) => (j < 1 || j > NY - 2 ? -1 : (j - 1) * NX + PERM[(i + NX) % NX]);

function chol(A) {
  const B1 = BW + 1;
  for (let i = 0; i < NU; i++) {
    const ri = i * B1, jmin = i > BW ? i - BW : 0;
    for (let j = jmin; j <= i; j++) {
      const rj = j * B1;
      let s = A[ri + j - i + BW];
      const kmin = j > BW && j - BW > jmin ? j - BW : jmin;
      let pi = ri + kmin - i + BW, pj = rj + kmin - j + BW;
      let k = kmin;
      for (; k + 3 < j; k += 4, pi += 4, pj += 4) s -= A[pi] * A[pj] + A[pi + 1] * A[pj + 1] + A[pi + 2] * A[pj + 2] + A[pi + 3] * A[pj + 3];
      for (; k < j; k++) s -= A[pi++] * A[pj++];
      if (j === i) {
        if (!(s > 1e-9)) return false;
        A[ri + BW] = sqrt(s);
      } else A[ri + j - i + BW] = s / A[rj + BW];
    }
  }
  return true;
}
function cholSolve(A, b) {
  const B1 = BW + 1;
  for (let i = 0; i < NU; i++) {
    const ri = i * B1, jmin = i > BW ? i - BW : 0;
    let s = b[i], p = ri + jmin - i + BW;
    for (let k = jmin; k < i; k++) s -= A[p++] * b[k];
    b[i] = s / A[ri + BW];
  }
  for (let i = NU - 1; i >= 0; i--) {
    const ri = i * B1, jmin = i > BW ? i - BW : 0;
    const x = b[i] / A[ri + BW];
    b[i] = x;
    let p = ri + jmin - i + BW;
    for (let k = jmin; k < i; k++) b[k] -= A[p++] * x;
  }
}

const GRAV = 250, VCAP = 2.2;
function solve(S) {
  const { q, cw, cr } = S;
  for (let c = 0; c < NCELL; c++) {
    const w = cw[c];
    S.lne[c] = (1 - q[c]) * LNF + q[c] * (w > 0.05 ? S.cl[c] / w : LNF);
  }
  if (S.qMax < 0.15) {
    S.uF.fill(0), S.vF.fill(0), S.mv.fill(0), (S.vmax = 0);
    return;
  }
  const A = S.A, b = S.rhs, nR = S.nodeR;
  // the operator is refactored only when some cell's viscosity has moved by a factor of three
  let dm = S.fv ? 0 : 9;
  for (let c = 0; c < NCELL; c++) dm = max(dm, abs(S.lne[c] - S.lneF[c]));
  if (dm > 1.2) {
    A.fill(0);
    for (let j = 1; j < NY - 1; j++)
      for (let i = 0; i < NX; i++) {
        const k = (j - 1) * NX, im = (i + NX - 1) % NX, e = S.lne;
        // weight eta: geometric mean of 4 cells
        IX[0] = ui(i, j + 1), IX[1] = ui(i, j - 1), IX[2] = ui(i + 1, j), IX[3] = ui(i - 1, j);
        addEl(A, exp(0.25 * (e[k + im] + e[k + i] + e[k + NX + im] + e[k + NX + i])), 0);
      }
    for (let j = 0; j < NY - 1; j++)
      for (let i = 0; i < NX; i++) {
        IX[0] = ui(i, j), IX[1] = ui(i + 1, j), IX[2] = ui(i, j + 1), IX[3] = ui(i + 1, j + 1);
        addEl(A, 4 * exp(S.lne[j * NX + i]), 1);
      }
    if (!(S.fv = chol(A) ? 1 : 0)) return;
    S.lneF.set(S.lne);
  }
  for (let j = 1; j < NY - 1; j++)
    for (let i = 0; i < NX; i++) {
      const k = (j - 1) * NX, im = (i + NX - 1) % NX, rr = (c) => (cw[c] > 0.05 ? cr[c] / cw[c] : 0.9);
      nR[j * NX + i] = 0.25 * (rr(k + im) + rr(k + i) + rr(k + NX + im) + rr(k + NX + i));
    }
  for (let j = 1; j < NY - 1; j++)
    for (let i = 0; i < NX; i++) b[ui(i, j)] = (GRAV * (nR[j * NX + ((i + 1) % NX)] - nR[j * NX + ((i + NX - 1) % NX)])) / 2;
  cholSolve(A, b);
  const psi = S.psi;
  psi.fill(0);
  for (let j = 1; j < NY - 1; j++) for (let i = 0; i < NX; i++) psi[j * NX + i] = b[ui(i, j)];
  let vm = 0;
  const uF = S.uF, vF = S.vF;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const i1 = i + 1 === NX ? 0 : i + 1;
      uF[j * NX + i] = j < NY - 1 ? psi[(j + 1) * NX + i] - psi[j * NX + i] : 0;
      vF[j * NX + i] = -(psi[j * NX + i1] - psi[j * NX + i]);
      const sp = abs(uF[j * NX + i]) + abs(vF[j * NX + i]);
      if (sp > vm) vm = sp;
    }
  const sc = vm > VCAP ? VCAP / vm : 1;
  if (sc < 1) for (let k = 0; k < NX * NY; k++) (uF[k] *= sc), (vF[k] *= sc);
  S.vmax = vm * sc;
  for (let j = 0; j < NY - 1; j++)
    for (let i = 0, a = j * NX; i < NX; i++) {
      const i1 = i + 1 === NX ? 0 : i + 1;
      S.mv[a + i] = max(abs(uF[a + i]), abs(uF[a + i1]), abs(uF[a + NX + i]), abs(vF[a + i]), abs(vF[a + NX + i]), abs(vF[a + i1])) > 0.012 ? 1 : 0;
    }
}

let VU = 0, VV = 0;
function vel(S, x, y) {
  let gx = x * 0.5;
  gx -= floor(gx / NX) * NX;
  const gy = cl((y - 1) * 0.5, 0, NY - 1.0001);
  const uF = S.uF, vF = S.vF;
  const i0 = floor(gx), fx = gx - i0, i1 = i0 + 1 >= NX ? 0 : i0 + 1;
  const t = cl(gy - 0.5, 0, NY - 2.0001), j0 = floor(t), fy = t - j0;
  let a = j0 * NX;
  const u0 = uF[a + i0] * (1 - fx) + uF[a + i1] * fx, u1 = uF[a + NX + i0] * (1 - fx) + uF[a + NX + i1] * fx;
  VU = u0 + (u1 - u0) * fy;
  const s = gx - 0.5, k0 = floor(s), kx = s - k0;
  const ka = (((k0 % NX) + NX) % NX), kb = ka + 1 >= NX ? 0 : ka + 1;
  const jj = floor(gy), fy2 = gy - jj;
  a = jj * NX;
  const v0 = vF[a + ka] * (1 - kx) + vF[a + kb] * kx, v1 = vF[a + NX + ka] * (1 - kx) + vF[a + NX + kb] * kx;
  VV = v0 + (v1 - v0) * fy2;
}
function advect(S, dt) {
  const sub = max(1, ceil((S.vmax * dt) / 0.8)), h = dt / sub;
  const { MX, MY, mv } = S;
  for (let m = 0; m < NM; m++) {
    let y = MY[m];
    if (y < -1e5) continue;
    let x = MX[m];
    const ci = floor(cl((y - 1) * 0.5, 0, NY - 1.5)) * NX + (floor(x * 0.5) % NX);
    if (!mv[ci]) continue;
    for (let s = 0; s < sub; s++) {
      vel(S, x, y);
      const xm = x + 0.5 * h * VU, ym = y + 0.5 * h * VV;
      vel(S, xm, ym);
      x += h * VU, y += h * VV;
    }
    MX[m] = x < 0 ? x + W : x >= W ? x - W : x;
    MY[m] = y;
  }
}

function dikeStart(S) {
  const { MX, MY, MC } = S;
  for (let tries = 0; tries < 80; tries++) {
    const m = floor(rnd() * NM);
    const y = MY[m];
    if (y < 6 || y > 110 || (MC[m] !== 0 && MC[m] !== 3)) continue;
    const gi = floor(cl((y - 1) * 0.5 - 0.5, 0, NY - 2)) * NX + (floor(MX[m] * 0.5) % NX);
    if (S.q[gi] < 0.5) continue;
    const ang = (rnd() < 0.5 ? -1 : 1) * (0.4 + 0.25 * rnd());
    S.dikes.push({ x: MX[m], y, ang, a0: ang, rem: 8 + 34 * S.sc * (0.5 + rnd()), w: 1.0 + 0.2 * rnd() });
    return;
  }
}
function dikeGrow(S, dt) {
  const ds = S.dikes;
  for (let n = ds.length - 1; n >= 0; n--) {
    const d = ds[n];
    let go = 24 * dt;
    while (go > 0 && d.rem > 0) {
      const st = min(go, 0.5);
      go -= st, d.rem -= st;
      d.ang = cl(d.ang + (rnd() - 0.5) * 0.3, d.a0 - 0.2, d.a0 + 0.2);
      d.x += sin(d.ang) * st, d.y -= cos(d.ang) * st;
      if (d.x < 0) d.x += W;
      else if (d.x >= W) d.x -= W;
      paint(S, d.x, d.y, d.w, d.w, 0, 0.5);
      if (!d.br && d.rem < 40 && rnd() < 0.012 * st && d.y > 12) {
        d.br = 1;
        const ba = (rnd() < 0.5 ? -1 : 1) * (1.15 + 0.3 * rnd());
        ds.push({ x: d.x, y: d.y, ang: ba, a0: ba, rem: 5 + 6 * rnd(), w: 0.95, br: 1 });
      }
      if (d.y < 2.2 && !d.br) {
        const rx = 5 + 8 * S.sc;
        paint(S, d.x + (rnd() < 0.5 ? -1 : 1) * (0.35 + 0.3 * rnd()) * rx, 0.3, rx, 1.5 + 2.2 * S.sc, 4, 0.2, rnd() * TAU);
        d.rem = 0;
      }
    }
    if (d.rem <= 0) ds.splice(n, 1);
  }
}
// recolour an ellipse of markers as bed c (lumpy if ph is given)
function paint(S, x, y, rx, ry, c, tone, ph) {
  const { MX, MY, MC, MT } = S;
  for (let m = 0; m < NM; m++) {
    const dy = MY[m] - y;
    if (MY[m] < -1e5 || dy > ry * 1.4 || dy < -ry * 1.4) continue;
    let dx = MX[m] - x;
    if (dx > 32) dx -= W;
    else if (dx < -32) dx += W;
    const l = 1 + (ph === undefined ? 0 : 0.35 * sin(dx * 0.7 + ph));
    if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry * l * l) < 1) (MC[m] = c), (MT[m] = tone);
  }
}

function advance(S, dt, live) {
  S.clock += dt;
  S.tq -= (dt * (live ? S.k[1] : max(S.k[1], 1.4))) / 1.5;
  if (S.tq <= 0 && !S.ev) {
    const first = S.first;
    S.first = false;
    S.ev = quake(S, first);
    S.sc = S.ev.s;
  }
  // shaking
  let sh = 0;
  const Q = S.ev;
  if (Q) {
    Q.t += dt;
    if (Q.t >= Q.D + 1.0) S.ev = null;
    else if (Q.t <= Q.D) sh = Q.s * Math.pow(sin((PI * Q.t) / Q.D), 0.7);
    for (let i = Q.dk.length - 1; i >= 0; i--)
      if (Q.t >= Q.dk[i]) {
        Q.dk.splice(i, 1);
        dikeStart(S);
      }
  }
  S.sh = sh;
  // pore pressure rises to the shaking times the susceptibility, drains, diffuses
  const { ru, q, tmp: t } = S;
  if (sh > 0 || S.ruMax > 0.01) {
    const up = 1 - exp(-dt / 1.4), dn = exp(-dt / 8), dk = min(0.2, 0.25 * dt);
    for (let j = 0; j < NY - 1; j++) {
      const wb = bandW(S, 2 * j + 2) * 3 * sh;
      for (let i = 0; i < NX; i++) {
        const c = j * NX + i, tg = cl(wb * (S.cx[c] / (S.cw[c] + 1e-6)) - 0.06, 0, 1), r = ru[c];
        t[c] = tg > r ? r + (tg - r) * up : r * dn;
      }
    }
    let mx = 0, qm = 0;
    for (let j = 0; j < NY - 1; j++)
      for (let i = 0; i < NX; i++) {
        const c = j * NX + i, a = j * NX, u = (j > 0 ? j - 1 : j) * NX + i, d = (j < NY - 2 ? j + 1 : j) * NX + i;
        const v = t[c] + dk * (t[a + ((i + NX - 1) % NX)] + t[a + ((i + 1) % NX)] + t[u] + t[d] - 4 * t[c]);
        ru[c] = v, q[c] = ss(0.35, 0.8, v);
        mx = max(mx, v), qm = max(qm, q[c]);
      }
    S.ruMax = mx, S.qMax = qm;
  }
  // deposit and sink
  const sc = SPEED * dt;
  const { MY } = S;
  for (let m = 0; m < NM; m++) {
    const y = MY[m];
    if (y < -1e5) continue;
    const ny = y + sc;
    if (ny > H + 0.8) (MY[m] = -1e6), (S.free[S.nfree++] = m);
    else MY[m] = ny;
  }
  S.dep += sc;
  while (S.dep >= SP) {
    slab(S, S.dep - 2 * SP);
    S.dep -= SP;
  }
  // flow
  S.tk += dt;
  if (S.tk >= (live ? 0.2 : 0.99)) {
    const act = S.ev || S.ruMax > 0.3;
    if (act) {
      fields(S);
      solve(S);
    } else if (S.vmax > 0) (S.vmax = 0), S.mv.fill(0), S.uF.fill(0), S.vF.fill(0);
    S.tk = 0;
  }
  if (S.vmax > 0) advect(S, dt);
  if (S.dikes.length) dikeGrow(S, dt);
}

function init(S) {
  S.nfree = 0;
  for (let m = NM - 1; m >= 0; m--) S.free[S.nfree++] = m;
  S.first = true;
  S.z = 0;
  S.nb = newBed(S, 0);
  for (let n = 0; n < 203; n++) slab(S, H + 0.6 - (n + 1) * SP);
  S.dep = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = (input && input.knobValues) || S.k;
  for (let k = 0; k < 4; k++) S.k[k] = Number.isFinite(kn[k]) ? kn[k] : S.k[k];
  const d = cl(dt || 0, 0, 0.1);
  S.yw0 = 12 + 46 * cl(S.k[2], 0, 1);
  S.M = 30 * exp(1.9 * cl(S.k[3], -1, 1));
  if (!S.ready) {
    S.yw = S.yw0;
    init(S);
    S.tq = 4;
    for (let t = 0; t < 240; t++) advance(S, 1.0, false);
    // let the last event finish before the first frame
    S.tq = 1.5;
    S.first = true;
    S.ready = true;
  }
  S.yw += (S.yw0 - S.yw) * (1 - exp(-d / 1.5));
  if (abs(S.lutK - S.k[0]) > 0.002) buildLut(S, S.k[0]);
  if (d > 0) advance(S, d, true);
}

const BT = F(W * H);
function blur(a, o) {
  for (let y = 0; y < H; y++) {
    const r = o + y * W;
    for (let x = 0; x < W; x++) BT[y * W + x] = 0.25 * a[r + (x + W - 1) % W] + 0.5 * a[r + x] + 0.25 * a[r + ((x + 1) % W)];
  }
  for (let y = 0; y < H; y++) {
    const u = y > 0 ? y - 1 : 0, d = y < H - 1 ? y + 1 : H - 1;
    for (let x = 0; x < W; x++) a[o + y * W + x] = 0.25 * BT[u * W + x] + 0.5 * BT[y * W + x] + 0.25 * BT[d * W + x];
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const { MX, MY, MC, MT, acc, tone, lut, q } = S;
  acc.fill(0), tone.fill(0);
  const sh = S.sh, t = S.clock;
  const amp = sh > 0 ? 0.45 + 1.5 * sh : 0;
  if (amp > 0) {
    for (let r = 0; r < H; r++) S.shX[r] = amp * sin(TAU * 2.3 * t - 0.11 * r + 1.3) * 0.9;
    for (let c = 0; c < W; c++) S.shY[c] = amp * 0.7 * sin(TAU * 3.1 * t + 0.23 * c);
  }
  const N = W * H;
  for (let m = 0; m < NM; m++) {
    let y = MY[m];
    if (y < -1e5 || y > H + 1.5) continue;
    let x = MX[m];
    if (amp > 0) {
      const xx = x;
      x += S.shX[cl(floor(y), 0, H - 1)];
      y += S.shY[cl(floor(xx), 0, W - 1)];
    }
    const u = x - 0.5, v = y - 0.5;
    let i0 = floor(u), j0 = floor(v);
    const fx = u - i0, fy = v - j0;
    const i1 = (i0 + 1 + W) % W;
    i0 = (i0 + W) % W;
    const base = MC[m] * N, tn = MT[m];
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    if (j0 >= 0 && j0 < H) {
      const p = j0 * W;
      acc[base + p + i0] += w00, acc[base + p + i1] += w10;
      tone[p + i0] += w00 * tn, tone[p + i1] += w10 * tn;
    }
    if (j0 + 1 >= 0 && j0 + 1 < H) {
      const p = (j0 + 1) * W;
      acc[base + p + i0] += w01, acc[base + p + i1] += w11;
      tone[p + i0] += w01 * tn, tone[p + i1] += w11 * tn;
    }
  }
  for (let n = 0; n < 6; n++) blur(n < 5 ? acc : tone, n < 5 ? n * N : 0);
  const lq = S.qMax > 0.05;
  for (let y = 0; y < H; y++) {
    const wet = 1.04 - 0.3 * ss(S.yw - 5, S.yw + 7, y + 0.5);
    const cy = cl((y + 0.5 - 1) * 0.5 - 0.5, 0, NY - 2.001), j0 = floor(cy), fy = cy - j0;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let a0 = acc[p], a1 = acc[N + p], a2 = acc[2 * N + p], a3 = acc[3 * N + p], a4 = acc[4 * N + p];
      const tot = a0 + a1 + a2 + a3 + a4;
      if (tot < 0.08) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      a0 *= a0 * a0, a1 *= a1 * a1, a2 *= a2 * a2, a3 *= a3 * a3, a4 *= a4 * a4;
      const sm = 1 / (a0 + a1 + a2 + a3 + a4);
      const tn = 1 + 0.2 * (tone[p] / tot);
      const k = wet * tn;
      let r = (a0 * lut[0] + a1 * lut[3] + a2 * lut[6] + a3 * lut[9] + a4 * lut[12]) * sm * k;
      let g = (a0 * lut[1] + a1 * lut[4] + a2 * lut[7] + a3 * lut[10] + a4 * lut[13]) * sm * k;
      let b = (a0 * lut[2] + a1 * lut[5] + a2 * lut[8] + a3 * lut[11] + a4 * lut[14]) * sm * k;
      if (lq) {
        const cx = (x + 0.5) * 0.5 - 0.5, i0 = floor(cx), fx = cx - i0, i1 = (i0 + 1) % NX, ii = (i0 + NX) % NX;
        const qa = q[j0 * NX + ii] * (1 - fx) + q[j0 * NX + i1] * fx, qb = q[(j0 + 1) * NX + ii] * (1 - fx) + q[(j0 + 1) * NX + i1] * fx;
        const ql = qa + (qb - qa) * fy;
        const gl = ql * (0.2 + 0.5 * (a0 + a3 + a4) * sm), kk = 1 + 0.4 * gl;
        r = r * kk + 16 * gl, g = g * kk + 12 * gl, b = b * kk + 4 * gl;
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
