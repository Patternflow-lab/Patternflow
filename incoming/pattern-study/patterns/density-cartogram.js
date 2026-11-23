// ===== Patternflow pattern =====
// Title:   Cartogram
// Family:  cartogram
// Idea:    An abstract map of up to 22 warped Voronoi regions fills the whole panel and is redrawn as a density-equalizing cartogram that never settles: each region's population wanders, a diffusion flow slides the borders so that high populations swell and low ones are squeezed, and the frame edges stay fixed.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: density-equalizing map projection by diffusion (Michael Gastner and Mark Newman, 2004), from memory, pattern round 229
// Round:   229
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tide=0..4, Contrast=-1..1, Regions=-1..1
//
// Knob 1: Hue. Turns the whole palette once round: at 0 the regions run from teal through blue and violet to rose, at 0.25 from violet through rose to amber, at 0.5 from amber through green to cyan, at 0.75 from green through cyan to blue, and at 1 back to the first. Neighbouring regions are always given hues far apart.
// Knob 2: Tide. How fast the populations wander, and how fast the borders chase them: at 0 a region takes about 25 seconds to drift from small to large, at 2 where it opens about 6 seconds, at 4 about 3 seconds and the map never stops sliding.
// Knob 3: Contrast. The spread between the largest and the smallest population. At -1 the regions differ by about a quarter and the map is nearly an even mosaic; at 0 the biggest is 3 to 5 times the smallest; at +1 a few regions take most of the panel and the rest are slivers a few LEDs wide.
// Knob 4: Regions. How many regions the map has, 8 at -1, 15 at 0.06 where it opens and 22 at +1. A region leaves by shrinking away into its neighbours and a new one is born as a speck that swells, so turning the knob down merges the map and up splits it.

const W = 64, H = 128;
const NX = 32, NY = 64, NC = NX * NY, CS = 2; // simulation grid, 2 LEDs a cell
const K = 22;                                  // regions the map can have
const { floor, sqrt, exp, log, sin, abs, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const KAPPA = 110;     // flow strength, LED^2 a second
const RELAX = 0.04;    // pull of every point back toward the map it started from, a second
const DIFF = 4;       // LED^2 a second, the spreading of the coordinates
const BLUR_R = 1;      // box radius, in cells, of each of the density blur passes
const BLUR_N = 3;      // number of passes
const VMAX = 16;       // LEDs a second
const PEN = 3200;      // power-diagram weight that makes a region vanish
const DRIFT = 5.5;     // LEDs the seeds wander from where they were placed
const HWAN = 0.09;     // how far a region's hue wanders from its place in the palette
const FLOOR = 0.02;    // least share of the panel a region is asked for
const ARC = 0.6;       // share of the hue circle the regions' hues spread over
const PRE = 30;        // seconds run before the first frame, in steps of 0.2 s

// ---- random numbers ----------------------------------------------------------
function ihash(n) {
  let h = (n | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const hv = (i, key) => ihash(Math.imul(i, 73856093) ^ Math.imul(key, 19349663)) * 2 - 1;
// Smooth random walk, about -1..1: a new value at every whole step of t, joined by a Catmull-Rom curve.
function wander(t, key) {
  const i = floor(t), f = t - i;
  const a = hv(i - 1, key), b = hv(i, key), c = hv(i + 1, key), d = hv(i + 2, key);
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}
function vnoise(x, y, key) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => ihash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(key, 83492791)) * 2 - 1;
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// ---- the reference map -------------------------------------------------------
// A point r of the undeformed map sits at w(r) = r + warp(r); its region is the nearest seed to w(r), the seeds
// carrying a power-diagram weight (PEN) that melts a region away. The warp is a table on the simulation grid.
let wx_ = 0, wy_ = 0, wdxx = 0, wdxy = 0, wdyx = 0, wdyy = 0;
function warp(P, rx, ry) {
  let u = rx * 0.5, v = ry * 0.5;
  u = u < 0 ? 0 : u > NX - 0.001 ? NX - 0.001 : u;
  v = v < 0 ? 0 : v > NY - 0.001 ? NY - 0.001 : v;
  const i = u | 0, j = v | 0, fx = u - i, fy = v - j, o = j * (NX + 1) + i, o2 = o + NX + 1;
  const T = P.WXT, S = P.WYT;
  let a = T[o], b = T[o + 1], c = T[o2], d = T[o2 + 1];
  wx_ = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  wdxx = ((b - a) * (1 - fy) + (d - c) * fy) * 0.5;
  wdxy = ((c - a) * (1 - fx) + (d - b) * fx) * 0.5;
  a = S[o]; b = S[o + 1]; c = S[o2]; d = S[o2 + 1];
  wy_ = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  wdyx = ((b - a) * (1 - fy) + (d - c) * fy) * 0.5;
  wdyy = ((c - a) * (1 - fx) + (d - b) * fx) * 0.5;
}

function buildReference(P) {
  const ox = Math.random() * 500, oy = Math.random() * 500;
  const W1 = 5.2, L1 = 38, W2 = 2.3, L2 = 15;
  for (let j = 0; j <= NY; j++)
    for (let i = 0; i <= NX; i++) {
      const x = i * CS, y = j * CS, o = j * (NX + 1) + i;
      P.WXT[o] = W1 * vnoise(x / L1 + ox, y / L1 + oy, 1) + W2 * vnoise(x / L2 + ox * 0.7, y / L2 + oy * 0.7, 2);
      P.WYT[o] = W1 * vnoise(x / L1 + ox + 31.7, y / L1 + oy + 17.3, 3) + W2 * vnoise(x / L2 + ox * 0.7 + 9.1, y / L2 + oy * 0.7 + 4.4, 4);
    }
  // seeds: best-candidate sampling, then Lloyd steps in the warped space
  const sx = [], sy = [];
  for (let n = 0; n < K; n++) {
    let bd = -1, bx = 0, by = 0;
    for (let c = 0; c < 40; c++) {
      const x = 3 + 58 * Math.random(), y = 3 + 122 * Math.random();
      let md = 1e9;
      for (let i = 0; i < n; i++) md = min(md, (x - sx[i]) ** 2 + (y - sy[i]) ** 2);
      md = min(md, 2 * (x < 32 ? x : 64 - x) ** 2 + 4, 2 * (y < 64 ? y : 128 - y) ** 2 + 4);
      if (md > bd) { bd = md; bx = x; by = y; }
    }
    sx.push(bx); sy.push(by);
  }
  const cx = new Float64Array(K), cy = new Float64Array(K), cn = new Float64Array(K);
  const label = new Uint8Array(NC);
  for (let it = 0; it < 9; it++) {
    cx.fill(0); cy.fill(0); cn.fill(0);
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const rx = (i + 0.5) * CS, ry = (j + 0.5) * CS;
        warp(P, rx, ry);
        const ux = rx + wx_, uy = ry + wy_;
        let bd = 1e30, bk = 0;
        for (let k = 0; k < K; k++) { const d = (ux - sx[k]) ** 2 + (uy - sy[k]) ** 2; if (d < bd) { bd = d; bk = k; } }
        cx[bk] += ux; cy[bk] += uy; cn[bk]++;
        label[j * NX + i] = bk;
      }
    for (let k = 0; k < K; k++) if (cn[k] > 0) { sx[k] += 0.7 * (cx[k] / cn[k] - sx[k]); sy[k] += 0.7 * (cy[k] / cn[k] - sy[k]); }
  }
  P.dbgCn = Array.from(cn);
  // order by farthest point, so the first n seeds always spread over the whole panel
  const order = [0];
  let start = 0, bd0 = 1e9;
  for (let k = 0; k < K; k++) { const d = (sx[k] - 32) ** 2 + (sy[k] - 64) ** 2; if (d < bd0) { bd0 = d; start = k; } }
  order[0] = start;
  const used = new Uint8Array(K); used[start] = 1;
  while (order.length < K) {
    let bk = -1, bdist = -1;
    for (let k = 0; k < K; k++) {
      if (used[k]) continue;
      let md = 1e9;
      for (const o of order) md = min(md, (sx[k] - sx[o]) ** 2 + (sy[k] - sy[o]) ** 2);
      if (md > bdist) { bdist = md; bk = k; }
    }
    used[bk] = 1; order.push(bk);
  }
  const inv = new Int32Array(K);
  order.forEach((o, n) => { P.SX0[n] = sx[o]; P.SY0[n] = sy[o]; inv[o] = n; });
  // which regions touch (on the full map), then hues that put far-apart hues on neighbours
  const adj = new Uint8Array(K * K);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = inv[label[j * NX + i]];
      if (i + 1 < NX) { const b = inv[label[j * NX + i + 1]]; if (a !== b) adj[a * K + b] = adj[b * K + a] = 1; }
      if (j + 1 < NY) { const b = inv[label[(j + 1) * NX + i]]; if (a !== b) adj[a * K + b] = adj[b * K + a] = 1; }
    }
  const slot = new Int32Array(K);
  for (let k = 0; k < K; k++) slot[k] = k;
  for (let k = K - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; const t = slot[k]; slot[k] = slot[j]; slot[j] = t; }
  const cost = () => {
    let c = 0;
    for (let a = 0; a < K; a++)
      for (let b = a + 1; b < K; b++) if (adj[a * K + b]) c += exp(-abs(slot[a] - slot[b]) / 3.2);
    return c;
  };
  let cur = cost();
  for (let it = 0; it < 6000; it++) {
    const a = (Math.random() * K) | 0, b = (Math.random() * K) | 0;
    if (a === b) continue;
    let t = slot[a]; slot[a] = slot[b]; slot[b] = t;
    const c = cost();
    if (c <= cur) cur = c; else { t = slot[a]; slot[a] = slot[b]; slot[b] = t; }
  }
  for (let k = 0; k < K; k++) P.slot[k] = slot[k] / (K - 1);
}

// ---- colour ------------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = h - floor(h);
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

// ---- setup -------------------------------------------------------------------
export function setup(P) {
  P.t = 0;
  P.tp = Math.random() * 1000;
  P.ep = (Math.random() * 1e6) | 0;
  P.ready = false;
  P.WXT = new Float32Array((NX + 1) * (NY + 1));
  P.WYT = new Float32Array((NX + 1) * (NY + 1));
  P.SX = new Float32Array(K); P.SY = new Float32Array(K);
  P.SX0 = new Float32Array(K); P.SY0 = new Float32Array(K);
  P.slot = new Float32Array(K);
  P.pen = new Float32Array(K);
  P.live = new Int32Array(K); P.nlive = 0;
  P.act = new Float32Array(K);
  P.fT = new Float32Array(K);   // target share of the panel
  P.area = new Float32Array(K); // area it has, as a share
  P.lr = new Float32Array(K);   // log density
  P.tv = new Float32Array(K);   // smoothed brightness
  P.col = new Float32Array(K * 3);
  P.BX = new Float32Array(NC); P.BY = new Float32Array(NC);
  P.BX2 = new Float32Array(NC); P.BY2 = new Float32Array(NC);
  P.I1 = new Uint8Array(NC); P.I2 = new Uint8Array(NC);
  P.M1 = new Float32Array(NC); P.GP = new Float32Array(NC); P.GS = new Float32Array(NC);
  P.S = new Float32Array(NC); P.S2 = new Float32Array(NC);
  P.VX = new Float32Array(NC); P.VY = new Float32Array(NC);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { P.BX[j * NX + i] = (i + 0.5) * CS; P.BY[j * NX + i] = (j + 0.5) * CS; }
  buildReference(P);
  P.tv.fill(0.5);
}

// ---- one simulation step -----------------------------------------------------
function setTargets(P, nreg, g) {
  const tp = P.tp, ep = P.ep;
  let sum = 0;
  for (let k = 0; k < K; k++) {
    const act = cl(nreg - k, 0, 1);
    P.act[k] = act;
    P.SX[k] = P.SX0[k] + DRIFT * wander(tp / 30 + k * 2.1, ep + k * 31 + 1);
    P.SY[k] = P.SY0[k] + DRIFT * wander(tp / 30 + k * 1.3, ep + k * 31 + 2);
    P.pen[k] = PEN * (1 - act) * (1 - act);
    const z = 0.75 * wander(tp / 11 + k * 1.37, ep + k * 17) + 0.5 * wander(tp / 4.3 + k * 0.61, ep + k * 17 + 7);
    const m = act * act * act * exp(g * z);
    P.fT[k] = m;
    sum += m;
  }
  let nl = 0;
  for (let k = 0; k < K; k++) if (P.pen[k] < PEN * 0.95) P.live[nl++] = k;
  P.nlive = nl;
  let n3 = 0;
  for (let k = 0; k < K; k++) n3 += P.act[k] * P.act[k] * P.act[k];
  for (let k = 0; k < K; k++) P.fT[k] = (P.fT[k] / sum) * (1 - FLOOR * n3) + FLOOR * P.act[k] * P.act[k] * P.act[k];
}

function simStep(P, dt) {
  const { BX, BY, BX2, BY2, I1, I2, M1, GP, GS, SX, SY, pen, area, lr, S, S2, VX, VY, live, nlive } = P;
  area.fill(0);
  for (let j = 0; j < NY; j++) {
    const jm = j > 0 ? j - 1 : 0, jp = j < NY - 1 ? j + 1 : NY - 1;
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i, im = i > 0 ? i - 1 : 0, ip = i < NX - 1 ? i + 1 : NX - 1;
      const bx = BX[c], by = BY[c];
      warp(P, bx, by);
      const ux = bx + wx_, uy = by + wy_;
      let d1 = 1e30, d2 = 1e30, i1 = 0, i2 = 0;
      for (let q = 0; q < nlive; q++) {
        const k = live[q], dx = ux - SX[k], dy = uy - SY[k], d = dx * dx + dy * dy + pen[k];
        if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = k; } else if (d < d2) { d2 = d; i2 = k; }
      }
      const sx = SX[i2] - SX[i1], sy = SY[i2] - SY[i1], dd = sqrt(sx * sx + sy * sy) + 1e-6;
      const nx = sx / dd, ny = sy / dd, gap = (d2 - d1) / (2 * dd);
      const rx = 1 / ((ip - im) * CS), ry = 1 / ((jp - jm) * CS);
      const bxx = (BX[j * NX + ip] - BX[j * NX + im]) * rx, bxy = (BX[jp * NX + i] - BX[jm * NX + i]) * ry;
      const byx = (BY[j * NX + ip] - BY[j * NX + im]) * rx, byy = (BY[jp * NX + i] - BY[jm * NX + i]) * ry;
      const mx = nx * (1 + wdxx) + ny * wdyx, my = nx * wdxy + ny * (1 + wdyy);
      const gx = mx * bxx + my * byx, gy = mx * bxy + my * byy;
      const gs = cl(sqrt(gx * gx + gy * gy), 0.1, 8);
      const gp = gap / gs;
      const m1 = smooth(0.5 + 0.5 * min(gp / 1.8, 1));
      I1[c] = i1; I2[c] = i2; M1[c] = m1; GP[c] = gp; GS[c] = gs;
      area[i1] += m1; area[i2] += 1 - m1;
    }
  }
  for (let k = 0; k < K; k++) {
    area[k] /= NC;
    lr[k] = cl(log((P.fT[k] + 0.004) / (area[k] + 0.004)), -2.4, 2.4);
  }
  for (let c = 0; c < NC; c++) S[c] = M1[c] * lr[I1[c]] + (1 - M1[c]) * lr[I2[c]];
  // blur the log density (reflecting at the frame edge)
  for (let p = 0; p < BLUR_N; p++) {
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        let s = 0;
        for (let d = -BLUR_R; d <= BLUR_R; d++) { const ii = i + d < 0 ? 0 : i + d >= NX ? NX - 1 : i + d; s += S[j * NX + ii]; }
        S2[j * NX + i] = s / (2 * BLUR_R + 1);
      }
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        let s = 0;
        for (let d = -BLUR_R; d <= BLUR_R; d++) { const jj = j + d < 0 ? 0 : j + d >= NY ? NY - 1 : j + d; s += S2[jj * NX + i]; }
        S[j * NX + i] = s / (2 * BLUR_R + 1);
      }
  }
  // v = -kappa grad ln(rho), nothing through the frame edge
  const kap = P.kappa;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      let vx = 0, vy = 0;
      if (i > 0 && i < NX - 1) vx = -kap * (S[c + 1] - S[c - 1]) / (2 * CS);
      if (j > 0 && j < NY - 1) vy = -kap * (S[c + NX] - S[c - NX]) / (2 * CS);
      const sp = sqrt(vx * vx + vy * vy);
      if (sp > VMAX) { vx *= VMAX / sp; vy *= VMAX / sp; }
      VX[c] = vx; VY[c] = vy;
    }
  // carry the reference coordinates along the flow, and pull them gently back toward the undeformed map
  const rel = 1 - exp(-RELAX * dt);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      let u = i - VX[c] * dt / CS, v = j - VY[c] * dt / CS;
      u = u < 0 ? 0 : u > NX - 1.001 ? NX - 1.001 : u;
      v = v < 0 ? 0 : v > NY - 1.001 ? NY - 1.001 : v;
      const i0 = u | 0, j0 = v | 0, fx = u - i0, fy = v - j0, o = j0 * NX + i0;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const bx = BX[o] * w00 + BX[o + 1] * w10 + BX[o + NX] * w01 + BX[o + NX + 1] * w11;
      const by = BY[o] * w00 + BY[o + 1] * w10 + BY[o + NX] * w01 + BY[o + NX + 1] * w11;
      BX2[c] = bx + ((i + 0.5) * CS - bx) * rel;
      BY2[c] = by + ((j + 0.5) * CS - by) * rel;
    }
  // let the coordinates spread a little, so a band that the flow squeezes cannot get thinner than the LEDs can show;
  // a straight (undeformed) field is left alone, edges included
  const nu = DIFF * dt / (CS * CS);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      let lx = 0, ly = 0, mx = 0, my = 0;
      if (i > 0 && i < NX - 1) { lx = BX2[c - 1] + BX2[c + 1] - 2 * BX2[c]; mx = BY2[c - 1] + BY2[c + 1] - 2 * BY2[c]; }
      if (j > 0 && j < NY - 1) { ly = BX2[c - NX] + BX2[c + NX] - 2 * BX2[c]; my = BY2[c - NX] + BY2[c + NX] - 2 * BY2[c]; }
      BX[c] = BX2[c] + nu * (lx + ly);
      BY[c] = BY2[c] + nu * (mx + my);
    }
}

// ---- update ------------------------------------------------------------------
export function update(dt, input, P) {
  dt = dt > 0.1 ? 0.1 : dt;
  const kv = input.knobValues;
  const tide = kv[1], con = kv[2], reg = kv[3];
  P.hue = kv[0];
  const rate = 0.55 + 0.5 * tide;
  const u = (con + 1) * 0.5, g = 0.5 + 0.7 * u + 2.3 * u * u * u;
  const nreg = 8 + 14 * ((reg + 1) * 0.5);
  P.kappa = KAPPA * (0.75 + 0.25 * rate);
  if (!P.ready) {
    P.ready = true;
    for (let s = 0; s < PRE / 0.2; s++) {
      P.tp += 0.2 * rate;
      setTargets(P, nreg, g);
      simStep(P, 0.2);
    }
  }
  P.t += dt;
  P.tp += dt * rate;
  P.nreg = nreg;
  setTargets(P, nreg, g);
  simStep(P, dt);
  // colours: hue by region, brightness by the area the region really has
  let nEff = 0;
  for (let k = 0; k < K; k++) nEff += P.act[k];
  const h0 = 0.52 + P.hue, ka = min(1, dt * 2.5);
  for (let k = 0; k < K; k++) {
    const ratio = P.area[k] * nEff + 1e-3;
    const tg = cl(0.5 + 0.5 * log(ratio) / 1.5, 0, 1);
    P.tv[k] += (tg - P.tv[k]) * ka;
    const t = P.tv[k];
    const h = h0 + ARC * P.slot[k] + HWAN * wander(P.tp / 35 + k * 3.1, P.ep + k * 53 + 9), hf = h - floor(h), hd = min(abs(hf - 0.11), 1 - abs(hf - 0.11));
    const vlo = 0.44 + 0.3 * exp(-(hd / 0.11) * (hd / 0.11));
    hsv(h, 0.84 - 0.24 * t, vlo + (1 - vlo) * (0.25 + 0.75 * t), P.col, k * 3);
  }
}

// ---- draw --------------------------------------------------------------------
// Catmull-Rom reading of the reference coordinates at a point inside cell (i0, j0), so that a border does not
// bend at every second LED where the map is squeezed hard.
const cwx = new Float64Array(4), cwy = new Float64Array(4), dwx = new Float64Array(4), dwy = new Float64Array(4);
let cbx = 0, cby = 0, cxx = 0, cxy = 0, cyx = 0, cyy = 0;
function cubic(BX, BY, i0, j0, fx, fy) {
  const fx2 = fx * fx, fx3 = fx2 * fx, fy2 = fy * fy, fy3 = fy2 * fy;
  cwx[0] = -0.5 * fx3 + fx2 - 0.5 * fx; cwx[1] = 1.5 * fx3 - 2.5 * fx2 + 1; cwx[2] = -1.5 * fx3 + 2 * fx2 + 0.5 * fx; cwx[3] = 0.5 * fx3 - 0.5 * fx2;
  cwy[0] = -0.5 * fy3 + fy2 - 0.5 * fy; cwy[1] = 1.5 * fy3 - 2.5 * fy2 + 1; cwy[2] = -1.5 * fy3 + 2 * fy2 + 0.5 * fy; cwy[3] = 0.5 * fy3 - 0.5 * fy2;
  dwx[0] = -1.5 * fx2 + 2 * fx - 0.5; dwx[1] = 4.5 * fx2 - 5 * fx; dwx[2] = -4.5 * fx2 + 4 * fx + 0.5; dwx[3] = 1.5 * fx2 - fx;
  dwy[0] = -1.5 * fy2 + 2 * fy - 0.5; dwy[1] = 4.5 * fy2 - 5 * fy; dwy[2] = -4.5 * fy2 + 4 * fy + 0.5; dwy[3] = 1.5 * fy2 - fy;
  let sx = 0, sy = 0, ax = 0, ay = 0, bx = 0, by = 0;
  for (let q = 0; q < 4; q++) {
    let jj = j0 + q - 1; jj = jj < 0 ? 0 : jj >= NY ? NY - 1 : jj;
    const row = jj * NX, wy = cwy[q], dy = dwy[q];
    let rx = 0, ry = 0, ex = 0, ey = 0;
    for (let r = 0; r < 4; r++) {
      let ii = i0 + r - 1; ii = ii < 0 ? 0 : ii >= NX ? NX - 1 : ii;
      const vx = BX[row + ii], vy = BY[row + ii];
      rx += cwx[r] * vx; ry += cwx[r] * vy; ex += dwx[r] * vx; ey += dwx[r] * vy;
    }
    sx += wy * rx; sy += wy * ry; ax += wy * ex; ay += wy * ey; bx += dy * rx; by += dy * ry;
  }
  cbx = sx; cby = sy;
  cxx = ax / CS; cyx = ay / CS; cxy = bx / CS; cyy = by / CS; // d(Bx)/dx, d(By)/dx, d(Bx)/dy, d(By)/dy
}

const seen = new Int32Array(K), cand = new Int32Array(8), offs = new Int32Array(4);

export function draw(display, P) {
  const { I1, I2, GP, SX, SY, pen, col, BX, BY } = P;
  seen.fill(0);
  let stamp = 0;
  for (let y = 0; y < H; y++) {
    let v = (y + 0.5) / CS - 0.5;
    v = v < 0 ? 0 : v > NY - 1.001 ? NY - 1.001 : v;
    const j0 = v | 0, fy = v - j0;
    for (let x = 0; x < W; x++) {
      let u = (x + 0.5) / CS - 0.5;
      u = u < 0 ? 0 : u > NX - 1.001 ? NX - 1.001 : u;
      const i0 = u | 0, fx = u - i0, o = j0 * NX + i0;
      const a = I1[o], b = I1[o + 1], c = I1[o + NX], d = I1[o + NX + 1];
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      let dpx, id, id2 = 0;
      const gmin = min(min(GP[o], GP[o + 1]), min(GP[o + NX], GP[o + NX + 1]));
      if (a === b && a === c && a === d && gmin > 3.4) {
        id = a;
        dpx = GP[o] * w00 + GP[o + 1] * w10 + GP[o + NX] * w01 + GP[o + NX + 1] * w11;
      } else {
        cubic(BX, BY, i0, j0, fx, fy);
        const bx = cbx, by = cby;
        warp(P, bx, by);
        const ux = bx + wx_, uy = by + wy_;
        const st = ++stamp;
        let n = 0;
        offs[0] = o; offs[1] = o + 1; offs[2] = o + NX; offs[3] = o + NX + 1;
        for (let q = 0; q < 4; q++) {
          const oo = offs[q];
          let k = I1[oo];
          if (seen[k] !== st) { seen[k] = st; cand[n++] = k; }
          k = I2[oo];
          if (seen[k] !== st) { seen[k] = st; cand[n++] = k; }
        }
        let d1 = 1e30, d2 = 1e30, i1 = 0, i2 = 0;
        for (let q = 0; q < n; q++) {
          const k = cand[q], dx = ux - SX[k], dy = uy - SY[k], dd = dx * dx + dy * dy + pen[k];
          if (dd < d1) { d2 = d1; i2 = i1; d1 = dd; i1 = k; } else if (dd < d2) { d2 = dd; i2 = k; }
        }
        id = i1; id2 = i2;
        const sx = SX[i2] - SX[i1], sy = SY[i2] - SY[i1], dd = sqrt(sx * sx + sy * sy) + 1e-6;
        let gs = 1;
        if (n > 1) {
          const nx = sx / dd, ny = sy / dd;
          const mx = nx * (1 + wdxx) + ny * wdyx, my = nx * wdxy + ny * (1 + wdyy);
          const gx = mx * cxx + my * cyx, gy = mx * cxy + my * cyy;
          gs = cl(sqrt(gx * gx + gy * gy), 0.1, 8);
        }
        dpx = n > 1 ? (d2 - d1) / (2 * dd * gs) : 9;
      }
      const e = smooth((dpx - 0.2) / 1.2);
      const inner = 0.86 + 0.14 * smooth((dpx - 1.2) / 3.6);
      const k3 = id * 3;
      let r = col[k3] * inner, g = col[k3 + 1] * inner, bl = col[k3 + 2] * inner;
      if (e < 1) {
        const m3 = id2 * 3;
        const gr = (col[k3] + col[m3]) * 0.07, gg = (col[k3 + 1] + col[m3 + 1]) * 0.07, gb = (col[k3 + 2] + col[m3 + 2]) * 0.07;
        r = gr + (r - gr) * e; g = gg + (g - gg) * e; bl = gb + (bl - gb) * e;
      }
      display.setPixel(x, y, r + 0.5, g + 0.5, bl + 0.5);
    }
  }
}
