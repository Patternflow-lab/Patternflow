// ===== Patternflow pattern =====
// Title:   Minimum Compliance
// Family:  topoopt
// Idea:    The whole panel is a design domain on which a stiff structure is found live, ivory struts on a deep teal void, standing on a few feet at the bottom and carrying two loads at the top whose points and directions never stop wandering, so the struts thicken where the strain energy runs high, thin where it runs low, reroute and now and then snap to a new branching, the way bone remodels.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: density-based topology optimisation, the material distribution method with a power-law interpolation (Martin Bendsoe, 1989; Michael Zhou and George Rozvany, 1991, from memory), the 99-line Matlab code and the density filter that sets the smallest feature (Ole Sigmund, 2001, from memory), the optimality-criteria update with a move limit (from memory), a Jacobi-preconditioned conjugate gradient solve (Hestenes and Stiefel, 1952, from memory), and trabecular bone adapting to its load (Julius Wolff, 1892, from memory), pattern round 228
// Round:   228
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Load=0.2..4, Material=-1..1, Feature=-1..1
//
// Knob 1: Tint. The hue of the void and of the glow along the struts, which stay ivory: teal-blue at 0 where it opens, cyan-blue at 0.25, blue-violet at 0.5, violet at 0.75, and rose-magenta at 1 (the sweep keeps clear of orange, where a dark tint would turn brown). The warm end of the glow is the opposite hue, pale and light.
// Knob 2: Load. How fast the loads wander over the panel and swing their direction, and so how fast the structure remodels. The load clock runs at 0.25 of its pace at 0.2, 1 where it opens at 2, and 2 at 4; at 2 a load takes about 4.5 seconds to go from one random place to the next, and the branches re-form in a second or two after it. A faster clock also leaves the struts less time to settle, so the web gets busier.
// Knob 3: Material. The share of the panel that is solid, 0.15 at -1 (a thin truss, struts 3 to 4 LEDs across), 0.35 at 0 where it opens (struts 6 to 9 LEDs across, with braces), and 0.55 at +1 (a dense web with small holes). It also drifts by a fifth either way on its own. The structure settles to a new share in one to three seconds.
// Knob 4: Feature. The radius of the density filter, which sets the thinnest strut and how fine the branching can get: 1.25 elements at -1 (fine trabeculae, 3 LEDs across), 1.5 at 0.06 where it opens, and 3.0 at +1 (chunky struts, 8 LEDs and more). An element is 2 by 2 LEDs. It settles in one to three seconds.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, pow, abs, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mix = (a, b, t) => a + (b - a) * t;

// The design domain is NX by NY square elements, each 2 by 2 LEDs, joined at (NX+1) by (NY+1) nodes.
const NX = 32, NY = 64, NEL = NX * NY;
// Node arrays carry a ring of zeros round them (NXP by NYP), so the stiffness stencil needs no edge tests.
const NXP = NX + 3, NYP = NY + 3, NPN = NXP * NYP;
// Element arrays carry RP rings of zeros, so the density filter needs none either.
const RP = 3, EW = NX + 2 * RP, EH = NY + 2 * RP, NE = EW * EH;
const EMIN = 1e-3;   // stiffness of the void, against 1 for solid
const XMIN = 0.01;   // the design variable never goes below this
const MOVE = 0.2;    // the optimality-criteria move limit
const PRE_ITERS = 48; // design steps before the first frame
const NLOADS = 3;    // loads on the top edge
const SEED_X = [16, 6, 26], SEED_TH = [0, 0.45, -0.45]; // where they start, in nodes and radians
const NOW = 0.4;     // how much of the drive is this instant's, the rest the average
const MEM = 4.0, MEM_DT = 0.1; // seconds the structure remembers its loads, and seconds a design step stands for
const CYC = 3;       // frames to a design step
const CG_STEPS = [3, 4, 3]; // conjugate gradient steps in each frame of a cycle

const hash = (n) => {
  const x = sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - floor(x);
};
// A smooth random walk: a fresh random value at each whole step of t, joined by a Catmull-Rom curve, about -1..1.
// Every channel has its own sequence, so no two quantities ever share a clock.
function wander(t, ch) {
  const i = floor(t), f = t - i, o = ch * 101.7;
  const a = hash(i - 1 + o) * 2 - 1, b = hash(i + o) * 2 - 1, c = hash(i + 1 + o) * 2 - 1, d = hash(i + 2 + o) * 2 - 1;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

// The 8 by 8 stiffness matrix of one bilinear plane-stress element of unit size, Poisson ratio 0.3, found by
// two-point Gauss quadrature. Nodes run (0,0), (1,0), (1,1), (0,1) with y pointing down, two dofs each.
function elementStiffness() {
  const nu = 0.3, c = 1 / (1 - nu * nu);
  const D = [c, c * nu, 0, c * nu, c, 0, 0, 0, c * (1 - nu) / 2];
  const sx = [-1, 1, 1, -1], sy = [-1, -1, 1, 1];
  const K = new Float64Array(64);
  const g = 1 / sqrt(3);
  for (const xi of [-g, g])
    for (const eta of [-g, g]) {
      const B = new Float64Array(24);
      for (let a = 0; a < 4; a++) {
        // dN/dx = 2 dN/dxi on a unit element
        const dx = 2 * 0.25 * sx[a] * (1 + sy[a] * eta), dy = 2 * 0.25 * sy[a] * (1 + sx[a] * xi);
        B[0 * 8 + 2 * a] = dx;
        B[1 * 8 + 2 * a + 1] = dy;
        B[2 * 8 + 2 * a] = dy; B[2 * 8 + 2 * a + 1] = dx;
      }
      const dJ = 0.25;
      for (let r = 0; r < 8; r++)
        for (let s = 0; s < 8; s++) {
          let v = 0;
          for (let p = 0; p < 3; p++)
            for (let q = 0; q < 3; q++) v += B[p * 8 + r] * D[p * 3 + q] * B[q * 8 + s];
          K[r * 8 + s] += v * dJ;
        }
    }
  return K;
}
const KE = elementStiffness();
// The same matrix cut in 2 by 2 blocks by node pair (a, b), and where node b sits round node a in a 3 by 3 stencil.
const KB = new Float64Array(64), KOFF = new Int32Array(16);
{
  const ox = [0, 1, 1, 0], oy = [0, 0, 1, 1];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      KOFF[a * 4 + b] = (oy[b] - oy[a] + 1) * 3 + (ox[b] - ox[a] + 1);
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 2; c++) KB[(a * 4 + b) * 4 + r * 2 + c] = KE[(2 * a + r) * 8 + 2 * b + c];
    }
}

// Catmull-Rom weights for drawing: LED x sits at element coordinate (x - 0.5) / 2, so the weights only depend on
// whether the LED is the left or the right of its element.
function interpTables(n, ne) {
  const idx = new Int32Array(n * 4), wt = new Float32Array(n * 4);
  for (let x = 0; x < n; x++) {
    const u = (x - 0.5) / 2, i0 = floor(u), t = u - i0;
    const t2 = t * t, t3 = t2 * t;
    const w = [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2];
    for (let k = 0; k < 4; k++) {
      idx[x * 4 + k] = cl(i0 - 1 + k, 0, ne - 1);
      wt[x * 4 + k] = w[k];
    }
  }
  return { idx, wt };
}

export function setup(P) {
  P.ready = false;
  P.t = 0; P.tl = 0; P.tf = 0; P.frame = 0;
  P.vf = 0.3; P.rmin = 1.5; P.rUsed = -1; P.pen = 3; P.seedMix = 0; P.sideMix = 1;
  P.x = new Float64Array(NE);      // design variables
  P.xp = new Float64Array(NE);     // filtered densities
  P.xd = new Float64Array(NE);     // the same, eased for drawing
  P.E = new Float64Array(NE);      // element stiffness
  P.q = new Float64Array(NE);      // strain energy drive, density^2 times the energy of the unit element
  P.qa = new Float64Array(NE);     // the same, averaged over the last second or two
  P.first = true;
  P.dcs = new Float64Array(NE);
  P.sv = new Float64Array(NE);
  P.xn = new Float64Array(NE);
  P.lo = new Float64Array(NE);
  P.hi = new Float64Array(NE);
  P.invHs = new Float64Array(NE);
  P.wcol = new Float64Array(NE);
  P.tg = new Float64Array(NE);     // glow target
  P.gl = new Float64Array(NE).fill(0.5); // glow, smoothed
  P.hl = new Float64Array(NE);     // halo
  P.hl2 = new Float64Array(NE);
  P.gh = new Float64Array(NE);     // where material has been
  P.kw = new Float64Array(64); P.ko = new Int32Array(64); P.nk = 0;
  P.L = [];
  for (let l = 0; l < NL; l++) P.L.push(makeLevel(NX >> l, NY >> l));
  const f = () => new Float64Array(NPN * 2);
  P.u = f(); P.p = f(); P.qv = f(); P.f = f();
  P.fixed = new Int32Array(NX + 1); P.nfix = 0; P.fixKey = '';
  P.lam = 0;
  P.res = 0;
  // drawing
  P.ix = interpTables(W, NX); P.iy = interpTables(H, NY);
  P.tmp = new Float32Array(NY * W);
  P.dL = new Float32Array(NPX); P.gL = new Float32Array(NPX); P.hL = new Float32Array(NPX); P.kL = new Float32Array(NPX);
  P.out = new Uint8Array(NPX * 3);
  P.pal = new Float32Array(65 * 3);
  P.hue = -1;
}

// ---------- the density filter ----------
function buildFilter(P, rmin) {
  P.rUsed = rmin;
  const { kw, ko } = P;
  let nk = 0;
  const R = Math.ceil(rmin) - 1;
  for (let dj = -R; dj <= R; dj++)
    for (let di = -R; di <= R; di++) {
      const w = rmin - sqrt(di * di + dj * dj);
      if (w > 0) { kw[nk] = w; ko[nk] = dj * EW + di; nk++; }
    }
  P.nk = nk;
  const { invHs, wcol } = P;
  invHs.fill(0); wcol.fill(0);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const e = (j + RP) * EW + i + RP;
      let s = 0;
      for (let dj = -R; dj <= R; dj++)
        for (let di = -R; di <= R; di++) {
          if (i + di < 0 || i + di >= NX || j + dj < 0 || j + dj >= NY) continue;
          const w = rmin - sqrt(di * di + dj * dj);
          if (w > 0) s += w;
        }
      invHs[e] = 1 / s;
    }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const e = (j + RP) * EW + i + RP;
      let s = 0;
      for (let k = 0; k < nk; k++) s += kw[k] * invHs[e + ko[k]];
      wcol[e] = s;
    }
}
function applyFilter(P) {
  const { x, xp, kw, ko, nk, invHs } = P;
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) {
      let s = 0;
      for (let k = 0; k < nk; k++) s += kw[k] * x[e + ko[k]];
      xp[e] = s * invHs[e];
    }
  }
}

// ---------- the finite element solve ----------
// The stiffness matrix is kept as a 3 by 3 stencil of 2 by 2 blocks at each node, so K u is 36 products a node.
// Conjugate gradients on a stiff 33 by 65 grid with a void a thousand times softer than the solid would need a
// few hundred steps, so they are preconditioned by one V-cycle of geometric multigrid: four grids, 32 by 64
// elements down to 4 by 8, a symmetric block Gauss-Seidel sweep on each, bilinear transfer, and the element
// stiffness of a coarse element the mean of its four children.
const NL = 4;
function makeLevel(nx, ny) {
  const nxp = nx + 3, nyp = ny + 3, nn = nxp * nyp;
  return {
    nx, ny, nxp, nn,
    S: new Float32Array(nn * 36), Dinv: new Float64Array(nn * 4), fx: new Uint8Array(nn),
    fl: new Int32Array(nn), nfl: 0, E: new Float64Array(nx * ny),
    x: new Float64Array(nn * 2), b: new Float64Array(nn * 2), r: new Float64Array(nn * 2),
  };
}

function assembleLevel(L) {
  const { S, E, nx, ny, nxp, Dinv, fx, nn } = L;
  S.fill(0);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const Ee = E[j * nx + i];
      const n0 = (j + 1) * nxp + i + 1;
      const n1 = n0 + 1, n2 = n0 + nxp + 1, n3 = n0 + nxp;
      for (let a = 0; a < 4; a++) {
        const na = a === 0 ? n0 : a === 1 ? n1 : a === 2 ? n2 : n3;
        for (let b = 0; b < 4; b++) {
          const s = na * 36 + KOFF[a * 4 + b] * 4, kb = (a * 4 + b) * 4;
          S[s] += Ee * KB[kb]; S[s + 1] += Ee * KB[kb + 1]; S[s + 2] += Ee * KB[kb + 2]; S[s + 3] += Ee * KB[kb + 3];
        }
      }
    }
  for (let n = 0; n < nn; n++) {
    const xx = S[n * 36 + 16], xy = S[n * 36 + 17], yx = S[n * 36 + 18], yy = S[n * 36 + 19];
    const det = xx * yy - xy * yx;
    if (fx[n] || !(det > 0)) { Dinv[4 * n] = 0; Dinv[4 * n + 1] = 0; Dinv[4 * n + 2] = 0; Dinv[4 * n + 3] = 0; continue; }
    Dinv[4 * n] = yy / det; Dinv[4 * n + 1] = -xy / det; Dinv[4 * n + 2] = -yx / det; Dinv[4 * n + 3] = xx / det;
  }
}

function matvec(L, u, q) {
  const { S, nx, ny, nxp } = L;
  for (let j = 1; j <= ny + 1; j++) {
    let n = j * nxp + 1;
    for (let i = 1; i <= nx + 1; i++, n++) {
      const sb = n * 36;
      const a = 2 * (n - nxp - 1), b = a + 2, c = a + 4, d = 2 * (n - 1), e = 2 * n, f = e + 2, g = 2 * (n + nxp - 1), h = g + 2, k = g + 4;
      const u0 = u[a], u1 = u[a + 1], u2 = u[b], u3 = u[b + 1], u4 = u[c], u5 = u[c + 1];
      const u6 = u[d], u7 = u[d + 1], u8 = u[e], u9 = u[e + 1], u10 = u[f], u11 = u[f + 1];
      const u12 = u[g], u13 = u[g + 1], u14 = u[h], u15 = u[h + 1], u16 = u[k], u17 = u[k + 1];
      q[e] = S[sb] * u0 + S[sb + 1] * u1 + S[sb + 4] * u2 + S[sb + 5] * u3 + S[sb + 8] * u4 + S[sb + 9] * u5
        + S[sb + 12] * u6 + S[sb + 13] * u7 + S[sb + 16] * u8 + S[sb + 17] * u9 + S[sb + 20] * u10 + S[sb + 21] * u11
        + S[sb + 24] * u12 + S[sb + 25] * u13 + S[sb + 28] * u14 + S[sb + 29] * u15 + S[sb + 32] * u16 + S[sb + 33] * u17;
      q[e + 1] = S[sb + 2] * u0 + S[sb + 3] * u1 + S[sb + 6] * u2 + S[sb + 7] * u3 + S[sb + 10] * u4 + S[sb + 11] * u5
        + S[sb + 14] * u6 + S[sb + 15] * u7 + S[sb + 18] * u8 + S[sb + 19] * u9 + S[sb + 22] * u10 + S[sb + 23] * u11
        + S[sb + 26] * u12 + S[sb + 27] * u13 + S[sb + 30] * u14 + S[sb + 31] * u15 + S[sb + 34] * u16 + S[sb + 35] * u17;
    }
  }
  for (let k = 0; k < L.nfl; k++) { const n = L.fl[k] * 2; q[n] = 0; q[n + 1] = 0; }
}

// One Gauss-Seidel sweep over the free nodes, a 2 by 2 block at a time, forwards (dir 1) or backwards (dir -1).
function sweep(L, dir) {
  const { S, Dinv, fx, x, b, nx, ny, nxp } = L;
  const j0 = dir > 0 ? 1 : ny + 1, j1 = dir > 0 ? ny + 2 : 0, i0 = dir > 0 ? 1 : nx + 1, i1 = dir > 0 ? nx + 2 : 0;
  for (let j = j0; j !== j1; j += dir)
    for (let i = i0; i !== i1; i += dir) {
      const n = j * nxp + i;
      if (fx[n]) continue;
      const sb = n * 36;
      const a = 2 * (n - nxp - 1), bb = a + 2, c = a + 4, d = 2 * (n - 1), e = 2 * n, f = e + 2, g = 2 * (n + nxp - 1), h = g + 2, k = g + 4;
      const u0 = x[a], u1 = x[a + 1], u2 = x[bb], u3 = x[bb + 1], u4 = x[c], u5 = x[c + 1];
      const u6 = x[d], u7 = x[d + 1], u8 = x[e], u9 = x[e + 1], u10 = x[f], u11 = x[f + 1];
      const u12 = x[g], u13 = x[g + 1], u14 = x[h], u15 = x[h + 1], u16 = x[k], u17 = x[k + 1];
      const rx = b[e] - (S[sb] * u0 + S[sb + 1] * u1 + S[sb + 4] * u2 + S[sb + 5] * u3 + S[sb + 8] * u4 + S[sb + 9] * u5
        + S[sb + 12] * u6 + S[sb + 13] * u7 + S[sb + 16] * u8 + S[sb + 17] * u9 + S[sb + 20] * u10 + S[sb + 21] * u11
        + S[sb + 24] * u12 + S[sb + 25] * u13 + S[sb + 28] * u14 + S[sb + 29] * u15 + S[sb + 32] * u16 + S[sb + 33] * u17);
      const ry = b[e + 1] - (S[sb + 2] * u0 + S[sb + 3] * u1 + S[sb + 6] * u2 + S[sb + 7] * u3 + S[sb + 10] * u4 + S[sb + 11] * u5
        + S[sb + 14] * u6 + S[sb + 15] * u7 + S[sb + 18] * u8 + S[sb + 19] * u9 + S[sb + 22] * u10 + S[sb + 23] * u11
        + S[sb + 26] * u12 + S[sb + 27] * u13 + S[sb + 30] * u14 + S[sb + 31] * u15 + S[sb + 34] * u16 + S[sb + 35] * u17);
      const m = n * 4;
      x[e] = u8 + Dinv[m] * rx + Dinv[m + 1] * ry;
      x[e + 1] = u9 + Dinv[m + 2] * rx + Dinv[m + 3] * ry;
    }
}

// Coarse residual b_c = P^T r, with P the bilinear interpolation from coarse nodes to fine ones.
function restrictTo(F, C) {
  const { r } = F, { b, nx, ny, nxp, fx } = C, fp = F.nxp;
  for (let J = 1; J <= ny + 1; J++)
    for (let I = 1; I <= nx + 1; I++) {
      const cn = J * nxp + I;
      if (fx[cn]) { b[2 * cn] = 0; b[2 * cn + 1] = 0; continue; }
      const fn = (2 * J - 1) * fp + (2 * I - 1);
      const n1 = fn - fp, n2 = fn + fp;
      for (let c = 0; c < 2; c++)
        b[2 * cn + c] = r[2 * fn + c] + 0.5 * (r[2 * (fn - 1) + c] + r[2 * (fn + 1) + c] + r[2 * n1 + c] + r[2 * n2 + c])
          + 0.25 * (r[2 * (n1 - 1) + c] + r[2 * (n1 + 1) + c] + r[2 * (n2 - 1) + c] + r[2 * (n2 + 1) + c]);
    }
}
// x_f += P x_c.
function prolongFrom(C, F) {
  const { x } = F, { nx, ny, nxp } = C, fp = F.nxp, e = C.x;
  for (let J = 1; J <= ny + 1; J++)
    for (let I = 1; I <= nx + 1; I++) {
      const cn = J * nxp + I;
      const e0 = e[2 * cn], e1 = e[2 * cn + 1];
      if (e0 === 0 && e1 === 0) continue;
      const fn = (2 * J - 1) * fp + (2 * I - 1);
      const n1 = fn - fp, n2 = fn + fp;
      x[2 * fn] += e0; x[2 * fn + 1] += e1;
      const h0 = 0.5 * e0, h1 = 0.5 * e1, q0 = 0.25 * e0, q1 = 0.25 * e1;
      x[2 * (fn - 1)] += h0; x[2 * (fn - 1) + 1] += h1; x[2 * (fn + 1)] += h0; x[2 * (fn + 1) + 1] += h1;
      x[2 * n1] += h0; x[2 * n1 + 1] += h1; x[2 * n2] += h0; x[2 * n2 + 1] += h1;
      x[2 * (n1 - 1)] += q0; x[2 * (n1 - 1) + 1] += q1; x[2 * (n1 + 1)] += q0; x[2 * (n1 + 1) + 1] += q1;
      x[2 * (n2 - 1)] += q0; x[2 * (n2 - 1) + 1] += q1; x[2 * (n2 + 1)] += q0; x[2 * (n2 + 1) + 1] += q1;
    }
  // the ring of padding and the pinned nodes stay at zero
  const nxf = F.nx, nyf = F.ny;
  for (let i = 0; i < fp; i++) { x[2 * i] = 0; x[2 * i + 1] = 0; const m = (nyf + 2) * fp + i; x[2 * m] = 0; x[2 * m + 1] = 0; }
  for (let j = 0; j < nyf + 3; j++) { const a = j * fp, m = a + nxf + 2; x[2 * a] = 0; x[2 * a + 1] = 0; x[2 * m] = 0; x[2 * m + 1] = 0; }
  for (let k = 0; k < F.nfl; k++) { const n = F.fl[k] * 2; x[n] = 0; x[n + 1] = 0; }
}

function vcycle(P, l) {
  const L = P.L[l];
  L.x.fill(0);
  if (l === NL - 1) {
    for (let s = 0; s < 4; s++) { sweep(L, 1); sweep(L, -1); }
    return;
  }
  sweep(L, 1);
  matvec(L, L.x, L.r);
  const { b, r } = L;
  for (let d = 0; d < r.length; d++) r[d] = b[d] - r[d];
  for (let k = 0; k < L.nfl; k++) { const n = L.fl[k] * 2; r[n] = 0; r[n + 1] = 0; }
  const C = P.L[l + 1];
  restrictTo(L, C);
  vcycle(P, l + 1);
  prolongFrom(C, L);
  sweep(L, -1);
}

// The pinned nodes of every grid: a coarse node is pinned when any fine node it takes from is.
function setFixedLevels(P) {
  for (let l = 0; l < NL; l++) {
    const L = P.L[l];
    L.fx.fill(0);
    if (l === 0) {
      for (let k = 0; k < P.nfix; k++) L.fx[P.fixed[k]] = 1;
    } else {
      const F = P.L[l - 1], j = L.ny + 1;
      for (let i = 1; i <= L.nx + 1; i++) {
        const fn = (2 * j - 1) * F.nxp + 2 * i - 1;
        if (F.fx[fn - 1] || F.fx[fn] || F.fx[fn + 1]) L.fx[j * L.nxp + i] = 1;
      }
    }
    let nf = 0;
    for (let n = 0; n < L.nn; n++) if (L.fx[n]) L.fl[nf++] = n;
    L.nfl = nf;
  }
}

function assemble(P) {
  const L0 = P.L[0], { E, xp } = P;
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) {
      const xe = xp[e];
      const Ee = EMIN + pow(xe, P.pen) * (1 - EMIN);
      E[e] = Ee;
      L0.E[j * NX + i] = Ee;
    }
  }
  for (let l = 1; l < NL; l++) {
    const F = P.L[l - 1], C = P.L[l];
    for (let J = 0; J < C.ny; J++)
      for (let I = 0; I < C.nx; I++) {
        const a = 2 * J * F.nx + 2 * I;
        C.E[J * C.nx + I] = 0.25 * (F.E[a] + F.E[a + 1] + F.E[a + F.nx] + F.E[a + F.nx + 1]);
      }
  }
  for (let l = 0; l < NL; l++) assembleLevel(P.L[l]);
}

// Preconditioned conjugate gradients on the free dofs, started from the last displacement. A run is started
// when the stiffness or the loads change and carried on over the frames between, a few steps at a time.
function cgStart(P) {
  const L = P.L[0], u = P.u, r = L.b, z = L.x, p = P.p, qv = P.qv, f = P.f;
  const nd = L.nn * 2;
  matvec(L, u, qv);
  let ff = 0;
  for (let d = 0; d < nd; d++) { r[d] = f[d] - qv[d]; ff += f[d] * f[d]; }
  for (let k = 0; k < L.nfl; k++) { const n = L.fl[k] * 2; r[n] = 0; r[n + 1] = 0; }
  vcycle(P, 0);
  let rz = 0;
  for (let d = 0; d < nd; d++) { p[d] = z[d]; rz += r[d] * z[d]; }
  P.rz = rz; P.ff = ff;
}
function cgRun(P, iters) {
  const L = P.L[0], u = P.u, r = L.b, z = L.x, p = P.p, qv = P.qv;
  const nd = L.nn * 2;
  let rz = P.rz;
  for (let it = 0; it < iters; it++) {
    if (!(rz > 1e-30)) break;
    matvec(L, p, qv);
    let pq = 0;
    for (let d = 0; d < nd; d++) pq += p[d] * qv[d];
    if (!(pq > 1e-30)) break;
    const al = rz / pq;
    for (let d = 0; d < nd; d++) { u[d] += al * p[d]; r[d] -= al * qv[d]; }
    vcycle(P, 0);
    let rz2 = 0;
    for (let d = 0; d < nd; d++) rz2 += r[d] * z[d];
    const be = rz2 / rz;
    rz = rz2;
    for (let d = 0; d < nd; d++) p[d] = z[d] + be * p[d];
  }
  P.rz = rz;
  let rn = 0;
  for (let d = 0; d < nd; d++) rn += r[d] * r[d];
  P.res = sqrt(rn / (P.ff + 1e-30));
  // A solve that has gone wrong starts again from rest.
  if (!(rn >= 0) || rn > 1e30 || !isFinite(rz)) { u.fill(0); cgStart(P); }
}

// ---------- the optimality-criteria update ----------
function ocStep(P, vf, move) {
  const { u, xp, x, q, qa, dcs, invHs, wcol, kw, ko, nk, sv, xn, lo, hi } = P;
  const al = P.first ? (P.first = false, 1) : 1 - exp(-MEM_DT / MEM);
  // The strain energy of every element at unit stiffness, then the sensitivity of the compliance to its density.
  let qs = 0, xs = 1e-9;
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) {
      const n0 = (j + 1) * NXP + i + 1, a = 2 * n0, b = a + 2, c = 2 * (n0 + NXP + 1), d = 2 * (n0 + NXP);
      const u0 = u[a], u1 = u[a + 1], u2 = u[b], u3 = u[b + 1], u4 = u[c], u5 = u[c + 1], u6 = u[d], u7 = u[d + 1];
      let ce = 0;
      for (let r = 0; r < 8; r++) {
        const kr = r * 8;
        ce += (r === 0 ? u0 : r === 1 ? u1 : r === 2 ? u2 : r === 3 ? u3 : r === 4 ? u4 : r === 5 ? u5 : r === 6 ? u6 : u7)
          * (KE[kr] * u0 + KE[kr + 1] * u1 + KE[kr + 2] * u2 + KE[kr + 3] * u3 + KE[kr + 4] * u4 + KE[kr + 5] * u5 + KE[kr + 6] * u6 + KE[kr + 7] * u7);
      }
      const xe = xp[e];
      const qe = pow(xe, P.pen - 1) * ce;
      q[e] = qe;
      // The structure answers to the loads of the last second or two, not to this instant's alone.
      const qm = qa[e] + (qe - qa[e]) * al;
      qa[e] = qm;
      dcs[e] = (NOW * qe + (1 - NOW) * qm) * invHs[e];
      const w = xe * xe * xe;
      qs += w * Math.log(qe + 1e-12); xs += w;
    }
  }
  // lam is the typical q on the struts, a weighted geometric mean; the glow reads against it.
  const lg = qs / xs;
  P.lam = P.lam > 0 ? exp(Math.log(P.lam) + (lg - Math.log(P.lam)) * 0.3) : exp(lg);
  // B = the filtered sensitivity over the filtered volume sensitivity, and the update x * sqrt(B / lambda),
  // held to the move limit; lambda is found by bisection so that the filtered volume is the share asked for.
  let sm = 0;
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) {
      let s = 0;
      for (let k = 0; k < nk; k++) s += kw[k] * dcs[e + ko[k]];
      const B = s / wcol[e];
      const v = x[e] * sqrt(B > 0 ? B : 0);
      sv[e] = v; sm += v;
      lo[e] = max(XMIN, x[e] - move); hi[e] = min(1, x[e] + move);
    }
  }
  sm /= NEL;
  if (!(sm > 1e-30) || !isFinite(sm)) return;
  const target = vf * NEL;
  let a = -9, b = 9;
  for (let it = 0; it < 26; it++) {
    const mu = sm > 0 ? pow(10, 0.5 * (a + b)) / sm : 1;
    let vol = 0;
    for (let j = 0; j < NY; j++) {
      let e = (j + RP) * EW + RP;
      for (let i = 0; i < NX; i++, e++) {
        const v = sv[e] * mu;
        vol += wcol[e] * (v < lo[e] ? lo[e] : v > hi[e] ? hi[e] : v);
      }
    }
    if (vol > target) b = 0.5 * (a + b); else a = 0.5 * (a + b);
  }
  const mu = pow(10, 0.5 * (a + b)) / sm;
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) {
      const v = sv[e] * mu;
      x[e] = v < lo[e] ? lo[e] : v > hi[e] ? hi[e] : v;
    }
  }
  applyFilter(P);
}

// ---------- the loads and the feet ----------
// Two loads on the top edge, each a sum of Gaussian weights over a few nodes, with a direction that swings up to
// about 70 degrees from straight down. Each quantity walks on a random sequence of its own.
function setLoads(P) {
  const { f } = P;
  for (let i = 0; i <= NX; i++) {
    const n = NXP + i + 1;
    f[2 * n] = 0; f[2 * n + 1] = 0;
  }
  for (let j = 0; j <= NY; j++) {
    const n = (j + 1) * NXP + 1, n2 = n + NX;
    f[2 * n] = 0; f[2 * n + 1] = 0; f[2 * n2] = 0; f[2 * n2 + 1] = 0;
  }
  const tl = P.tl;
  // Muscle pulls: a push inward on the left edge and another on the right, at heights that wander, that come and go.
  for (let m = 0; m < 2; m++) {
    const ch = 30 + m * 7, sgn = m === 0 ? 1 : -1;
    const yc = NY * (0.14 + 0.58 * (0.5 + 0.5 * cl(1.15 * wander(tl / 6.5 + m * 23.7, ch), -1, 1)));
    const mag = P.sideMix * cl(0.3 + 0.5 * wander(tl / 8 + m * 4.4, ch + 1), 0, 0.7);
    const ph = 0.6 * wander(tl / 4.1 + m * 6.3, ch + 2);
    const sg = 1.6, lo = max(0, floor(yc - 4)), hi = min(NY, Math.ceil(yc + 4));
    let ws = 0;
    for (let j = lo; j <= hi; j++) ws += exp(-((j - yc) * (j - yc)) / (2 * sg * sg));
    for (let j = lo; j <= hi; j++) {
      const w = mag * exp(-((j - yc) * (j - yc)) / (2 * sg * sg)) / ws;
      const n = (j + 1) * NXP + 1 + (m === 0 ? 0 : NX);
      f[2 * n] += sgn * w * cos(ph); f[2 * n + 1] += w * sin(ph);
    }
  }
  for (let m = 0; m < NLOADS; m++) {
    const ch = 10 + m * 7;
    // The first load may stand anywhere on the edge, the second keeps to the left part and the third to the right.
    const u01 = 0.5 + 0.5 * cl(1.15 * wander(tl / 4.5 + m * 17.3, ch), -1, 1);
    const xc0 = 2 + (NX - 4) * (m === 0 ? 0.25 + 0.5 * u01 : m === 1 ? 0.4 * u01 : 0.6 + 0.4 * u01);
    // Before the first frame the loads start spread evenly and slide over to where they wander.
    const th0 = cl(1.3 * wander(tl / 3.3 + m * 9.1, ch + 1), -1.3, 1.3);
    const xc = mix(xc0, SEED_X[m], P.seedMix), th = mix(th0, SEED_TH[m], P.seedMix);
    const mag = m === 0 ? 1 : cl(0.7 + 0.5 * wander(tl / 9 + 3.3 + m, ch + 2), 0.35, 1);
    const sg = 1.5;
    let ws = 0;
    const lo = max(0, floor(xc - 4)), hi = min(NX, Math.ceil(xc + 4));
    for (let i = lo; i <= hi; i++) ws += exp(-((i - xc) * (i - xc)) / (2 * sg * sg));
    const fx = mag * sin(th) / ws, fy = mag * cos(th) / ws;
    for (let i = lo; i <= hi; i++) {
      const w = exp(-((i - xc) * (i - xc)) / (2 * sg * sg));
      const n = NXP + i + 1;
      f[2 * n] += fx * w; f[2 * n + 1] += fy * w;
    }
  }
}
// Four feet at the bottom edge. Each drifts on a slow sequence of its own, and each has a width of its own that
// changes too; the nodes in reach of a foot are pinned.
function setFeet(P) {
  const tf = P.tf;
  const home = [0.1, 0.37, 0.63, 0.9], sway = [0.12, 0.17, 0.17, 0.12];
  const cen = [], rad = [];
  for (let m = 0; m < 4; m++) {
    cen.push(NX * (home[m] + sway[m] * cl(1.1 * wander(tf / 14 + m * 5.7, 40 + m), -1, 1)));
    // a foot that shrinks below 0.6 of a node is gone, and the structure has to find the others; the second always stays
    rad.push(m === 1 ? max(1, 1.3 + 1.1 * wander(tf / 23 + m * 3.1, 50 + m)) : 1.3 + 1.1 * wander(tf / 23 + m * 3.1, 50 + m));
  }
  const mark = new Uint8Array(NX + 1);
  let key = '';
  for (let i = 0; i <= NX; i++) {
    for (let m = 0; m < 4; m++) if (rad[m] > 0.6 && abs(i - cen[m]) <= rad[m]) mark[i] = 1;
    key += mark[i];
  }
  if (key === P.fixKey) return false;
  P.fixKey = key;
  let nf = 0;
  for (let i = 0; i <= NX; i++) if (mark[i]) {
    const n = (NY + 1) * NXP + i + 1;
    P.fixed[nf++] = n;
    P.u[2 * n] = 0; P.u[2 * n + 1] = 0;
  }
  P.nfix = nf;
  setFixedLevels(P);
  return true;
}

// ---------- one pass of the whole method ----------
function glowTargets(P) {
  const { q, tg, lam } = P;
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) {
      const v = q[e] / (lam + 1e-30);
      tg[e] = cl(0.58 + 0.2 * Math.log2(v + 1e-6), 0, 1);
    }
  }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const tint = cl(kv[0], 0, 1), load = cl(kv[1], 0.2, 4), mat = cl(kv[2], -1, 1), feat = cl(kv[3], -1, 1);
  const rate = load < 2 ? 0.25 + 0.75 * (load - 0.2) / 1.8 : 1 + (load - 2) / 2;
  const vfT = 0.35 + 0.20 * mat;
  const rT = feat < 0.06 ? 1.5 + 0.25 * (feat - 0.06) / 1.06 : 1.5 + 1.5 * (feat - 0.06) / 0.94;
  if (!P.ready) {
    P.ready = true;
    P.vf = vfT; P.rmin = rT;
    buildFilter(P, rT);
    for (let e = 0; e < NE; e++) P.x[e] = 0;
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) P.x[(j + RP) * EW + i + RP] = cl(vfT + 0.06 * (Math.random() - 0.5), XMIN, 1);
    applyFilter(P);
    for (let it = 0; it < PRE_ITERS; it++) {
      P.tl += 0.11; P.tf += 0.11;
      P.pen = 1.6 + 1.4 * smooth(it / (PRE_ITERS * 0.8));
      P.seedMix = 1 - smooth(it / (PRE_ITERS * 0.75));
      P.sideMix = smooth(it / (PRE_ITERS * 0.75));
      setLoads(P); setFeet(P);
      assemble(P);
      cgStart(P);
      cgRun(P, it < 2 ? 40 : it < 30 ? 5 : 9);
      ocStep(P, vfT, it < PRE_ITERS * 0.6 ? 0.3 : MOVE);
    }
    P.seedMix = 0; P.sideMix = 1;
    glowTargets(P);
    P.gl.set(P.tg);
    P.gh.set(P.xp);
    P.xd.set(P.xp);
  }
  P.t += d; P.frame++;
  P.pen = 3 + 0.3 * wander(P.t / 37 + 4.2, 77);
  P.tl += d * rate; P.tf += d;
  // The share of material and the filter radius glide to their knobs.
  const k = 1 - exp(-d / 0.2);
  P.vf += (vfT * (1 + 0.2 * wander(P.t / 45 + 9, 78)) - P.vf) * k;
  P.rmin += (rT - P.rmin) * k;
  // A design cycle takes CYC frames. At its start the loads and the feet move, the filter is rebuilt if the
  // feature size has moved, the stiffness is assembled and the solve is restarted; the solve goes on over the
  // frames after, and the optimality-criteria update closes the cycle.
  const c = P.frame % CYC;
  if (c === 0) {
    if (abs(P.rmin - P.rUsed) > 0.02) { buildFilter(P, P.rmin); applyFilter(P); }
    setLoads(P); setFeet(P);
    assemble(P);
    cgStart(P);
  }
  cgRun(P, CG_STEPS[c]);
  if (c === CYC - 1) {
    ocStep(P, P.vf, MOVE);
    glowTargets(P);
  }
  const { gl, tg, gh, xp, xd } = P;
  const kg = 1 - exp(-d / 0.25), kd = exp(-d / 12), kx = 1 - exp(-d / 0.08);
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) {
      gl[e] += (tg[e] - gl[e]) * kg;
      xd[e] += (xp[e] - xd[e]) * kx;
      const g = gh[e] * kd;
      gh[e] = xd[e] > g ? xd[e] : g;
    }
  }
  halo(P);
  render(P, tint);
}

// A soft blur of the density, for the faint light the struts put into the void.
function halo(P) {
  const { xd, hl, hl2 } = P;
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) hl2[e] = 0.25 * xd[e - 1] + 0.5 * xd[e] + 0.25 * xd[e + 1];
  }
  for (let j = 0; j < NY; j++) {
    let e = (j + RP) * EW + RP;
    for (let i = 0; i < NX; i++, e++) hl[e] = 0.25 * hl2[e - EW] + 0.5 * hl2[e] + 0.25 * hl2[e + EW];
  }
}

// ---------- drawing ----------
function interp(P, src, dst) {
  const { ix, iy, tmp } = P;
  for (let j = 0; j < NY; j++) {
    const row = (j + RP) * EW + RP;
    for (let x = 0; x < W; x++) {
      const o = x * 4;
      let v = ix.wt[o] * src[row + ix.idx[o]] + ix.wt[o + 1] * src[row + ix.idx[o + 1]] + ix.wt[o + 2] * src[row + ix.idx[o + 2]] + ix.wt[o + 3] * src[row + ix.idx[o + 3]];
      tmp[j * W + x] = v;
    }
  }
  for (let y = 0; y < H; y++) {
    const o = y * 4;
    const r0 = iy.idx[o] * W, r1 = iy.idx[o + 1] * W, r2 = iy.idx[o + 2] * W, r3 = iy.idx[o + 3] * W;
    const w0 = iy.wt[o], w1 = iy.wt[o + 1], w2 = iy.wt[o + 2], w3 = iy.wt[o + 3];
    for (let x = 0; x < W; x++) {
      const v = w0 * tmp[r0 + x] + w1 * tmp[r1 + x] + w2 * tmp[r2 + x] + w3 * tmp[r3 + x];
      dst[y * W + x] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
}

function hsv(h, s, v) {
  h = h - floor(h);
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

function render(P, tint) {
  const { dL, gL, hL, kL, out, pal } = P;
  interp(P, P.xd, dL);
  interp(P, P.gl, gL);
  interp(P, P.hl, hL);
  interp(P, P.gh, kL);
  const hue = 0.53 + 0.40 * tint;
  // The colour of a strut by how hard it is working: cool and pale, ivory, warm and pale. Ivory sits at 0.58.
  const cool = hsv(hue, 0.30, 1.0), warm = hsv(hue + 0.55, 0.36, 1.0), ivory = [0.98, 0.945, 0.87];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    for (let c = 0; c < 3; c++)
      pal[i * 3 + c] = 255 * (t < 0.58 ? mix(cool[c], ivory[c], smooth(t / 0.58)) : mix(ivory[c], warm[c], smooth((t - 0.58) / 0.42)));
  }
  const vd = hsv(hue, 0.9, 0.17), vh = hsv(hue, 0.65, 0.6), vg = hsv(hue + 0.04, 0.6, 0.5);
  const TH = 0.42, WD = 0.17;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3;
      const d = dL[p];
      const cover = smooth((d - (TH - WD)) / (2 * WD));
      const hh = hL[p], gg = kL[p];
      const vr = 255 * vd[0] + 255 * (vh[0] * hh * 0.5 + vg[0] * gg * 0.22);
      const vgc = 255 * vd[1] + 255 * (vh[1] * hh * 0.5 + vg[1] * gg * 0.22);
      const vb = 255 * vd[2] + 255 * (vh[2] * hh * 0.5 + vg[2] * gg * 0.22);
      let r = vr, g = vgc, b = vb;
      if (cover > 0.002) {
        const gi = (gL[p] * 64 + 0.5) | 0;
        const core = 0.84 + 0.16 * smooth((d - TH) / (1 - TH));
        const sr = pal[gi * 3] * core, sg = pal[gi * 3 + 1] * core, sb = pal[gi * 3 + 2] * core;
        r = vr + (sr - vr) * cover; g = vgc + (sg - vgc) * cover; b = vb + (sb - vb) * cover;
      }
      out[o] = r > 255 ? 255 : r; out[o + 1] = g > 255 ? 255 : g; out[o + 2] = b > 255 ? 255 : b;
    }
}

export function draw(display, P) {
  const { out } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
