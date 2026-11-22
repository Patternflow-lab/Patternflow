// ===== Patternflow pattern =====
// Title:   Pattern Weld
// Family:  patternweld
// Idea:    The ground face of a pattern-welded steel bar, 64 LEDs across and 128 along, etched so that bright nickel layers and blackened high-carbon layers show as contour lines of a layered 3-D volume cut by a grinding plane that slowly sinks and tilts, which turns one deformed stack into straight layers, the ladder, the twist with its chevrons and the raindrop rings in turn.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: pattern welding, a billet of alternating bright and dark steel layers forge-welded, grooved, drilled or twisted, flattened and etched, as made by Roman and Migration-period sword smiths and later called Damascus steel; pattern round 221
// Round:   221
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Grind=0.1..4, Layers=8..34, Forging=0..1
//
// Knob 1: Hue.
// Knob 2: Grind.
// Knob 3: Layers.
// Knob 4: Forging.

const W = 64, H = 128;
const { floor, sqrt, abs, exp, sin, cos, tanh, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TAU = 2 * PI;

const GW = W + 2, GH = H + 2; // phase grid with a one LED border for gradients
const DNOM = 100; // depth that gives Layers pairs at a plane slope of 1
const P_GROOVE = 27; // LEDs between grooves
const DRILL_DY = 37;

function hash(i) {
  let h = Math.imul(i | 0, 374761393) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x) {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
function vnoise2(x, y) {
  const i = floor(x), j = floor(y), fx = x - i, fy = y - j;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash(a * 7919 + b * 104729 + 17);
  const a = h(i, j) * (1 - ux) + h(i + 1, j) * ux, b = h(i, j + 1) * (1 - ux) + h(i + 1, j + 1) * ux;
  return a * (1 - uy) + b * uy;
}

function makeState() {
  const S = {
    ready: false, t: 0, T: 161, z0: 0,
    kn: [0, 2, 8, 0.06],
    phi: new Float32Array(GW * GH), hh: new Float32Array(GW * GH), ff: new Float32Array(GW * GH), hz: new Float32Array(GW * GH),
    rowC: new Float32Array(GH), rowS: new Float32Array(GH), rowG: new Float32Array(GH),
    grain: new Float32Array(W * H),
    drills: [], near: [],
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S.grain[y * W + x] = vnoise2(x / 2.6, y / 24) - 0.5;
  for (let k = -2; k <= 2; k++) {
    const y = 6 + DRILL_DY * k;
    const odd = k & 1;
    if (odd) S.drills.push([0, y, 7.5], [-32, y, 7.0], [32, y, 7.2]);
    else S.drills.push([-16, y, 7.0], [16, y, 7.4]);
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 8, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  const k2 = cl(kn[1], 0.1, 4);
  S.t += d;
  S.T += d * k2 * 0.5;
  S.z0 += d * k2 * 0.7;
  S.ready = true;
}

// ---- colour: bright layer and dark layer of each steel tint
const TINTS = [
  [[156, 176, 198], [20, 28, 42]], // etched steel, blue-grey
  [[192, 194, 198], [26, 28, 34]], // silver and graphite
  [[196, 184, 148], [40, 34, 24]], // straw
  [[184, 152, 124], [38, 28, 24]], // bronze
  [[160, 148, 196], [30, 26, 46]], // violet
  [[112, 146, 208], [14, 24, 52]], // temper blue
];
function tintAt(h, out) {
  const n = TINTS.length, u = (((h % 1) + 1) % 1) * n, i = floor(u) % n, f = u - floor(u), j = (i + 1) % n;
  const s = f * f * (3 - 2 * f);
  for (let c = 0; c < 3; c++) {
    out[c] = TINTS[i][0][c] * (1 - s) + TINTS[j][0][c] * s;
    out[3 + c] = TINTS[i][1][c] * (1 - s) + TINTS[j][1][c] * s;
  }
}

// smoothed triangle wave in -1..1: straight flanks with rounded turns
const tri = (x) => (2 / PI) * Math.asin(0.9 * sin(x)) / Math.asin(0.9);
function fieldOf(S) {
  const kn = S.kn, T = S.T, zl = S.z0;
  const Kl = cl(kn[2], 8, 34), kl = Kl / DNOM, ks = sqrt(Kl / 8);
  const m = cl(kn[3], 0, 1);
  const wob = 0.6 * sin((TAU * T) / 79 + 0.5) + 0.4 * sin((TAU * T) / 131 + 2.2);
  const u = cl(Math.pow(m, 0.55) * (1 + 0.55 * wob), 0, 1);
  // grinding plane: its height above the twist axis wanders, bounded
  const zc = 14 * sin((TAU * T) / 97 + 0.3) + 9 * sin((TAU * T) / 61 + 2.0) + 5 * sin((TAU * T) / 37 + 4.4);
  const tau = 0.22 * sin((TAU * T) / 53 + 1.0);
  const alpha = -0.1 + 0.5 * sin((TAU * T) / 61 + 0.7) + 0.32 * sin((TAU * T) / 97 + 2.1) + 0.12 * sin((TAU * T) / 37 + 4.0);
  const beta = 0.3 + 0.4 * sin((TAU * T) / 109 + 0.2) + 0.25 * sin((TAU * T) / 71 + 3.3);
  const s0 = 0.62 * (1 + 0.45 * sin((TAU * T) / 43 + 1.9) * sin((TAU * T) / 131));
  const ca = cos(alpha) * s0, sa = sin(alpha) * s0, cb = cos(beta), sb = sin(beta);
  // forging
  const Dg = ((1.0 * ks) / kl) * sm(0.03, 0.2, u) * (1 - sm(0.27, 0.42, u));
  const kg = 1.0 + 2.6 * sm(0.05, 0.3, u);
  const Th = 1.0 * sm(0.55, 0.95, u);
  const Pc = 46 - 20 * sm(0.6, 1, u) + 5 * sin((TAU * T) / 89);
  const Dd = ((3.2 * sqrt(ks)) / kl) * sm(0.26, 0.4, u) * (1 - sm(0.58, 0.74, u));
  const Yo = 40 * sin((TAU * T) / 73) + 16 * sin((TAU * T) / 41 + 1.2);
  const phi = S.phi, rowC = S.rowC, rowS = S.rowS, rowG = S.rowG;
  for (let gy = 0; gy < GH; gy++) {
    const Y = gy - 1 + 0.5 - H / 2;
    const th = Th * tri((TAU * (Y - Yo)) / Pc);
    rowC[gy] = cos(th);
    rowS[gy] = sin(th);
    const Yw = Y * (1 + 0.004 * zc) + 0.55 * zc + 2.6 * sin((TAU * Y) / 131 + 0.7) + 1.6 * sin((TAU * Y) / 53 + 2.5);
    rowG[gy] = Dg * 0.5 * (1 + tanh(kg * sin((TAU * Yw) / P_GROOVE)));
  }
  const dr = S.drills, near = S.near;
  const w1 = (TAU * T) / 53 + 1, w2 = (TAU * T) / 83 + 2;
  for (let gy = 0; gy < GH; gy++) {
    const Y = gy - 1 + 0.5 - H / 2;
    const c = rowC[gy], s = rowS[gy], g = rowG[gy];
    near.length = 0;
    for (let k = 0; k < dr.length; k++) if (abs(Y - dr[k][1] - 0.25 * zc) < 30) near.push(dr[k]);
    for (let gx = 0; gx < GW; gx++) {
      const X = gx - 1 + 0.5 - W / 2;
      const zr = zc + tau * X;
      const X0 = X * c + zr * s, Z0 = zr * c - X * s;
      let f = ca * (cb * X0 + sb * Z0) + sa * Y + g;
      f += 4.5 * sin(TAU * (X / 150 + Y / 230) + w1) + 3.5 * sin(TAU * (-X / 120 + Y / 180) + w2);
      if (Dd > 0.01) {
        for (let k = 0; k < near.length; k++) {
          const dx = X - near[k][0] - 0.5 * zc, dy = Y - near[k][1] - 0.25 * zc, sg = near[k][2] * (1 + 0.012 * zc);
          const r2 = (dx * dx + dy * dy) / (sg * sg);
          if (r2 < 9) f += Dd * exp(-0.5 * r2);
        }
      }
      phi[gy * GW + gx] = (f + zl) * kl;
    }
  }
}

// a soft shoulder above 196 so a highlight does not clip to flat white
const soft = (v) => (v > 196 ? 196 + 59 * tanh((v - 196) / 59) : v < 0 ? 0 : v) | 0;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  fieldOf(S);
  const phi = S.phi, hh = S.hh, ff = S.ff, hz = S.hz;
  const K0 = 2.4;
  for (let gy = 1; gy < GH - 1; gy++) {
    for (let gx = 1; gx < GW - 1; gx++) {
      const p = gy * GW + gx;
      const fx = (phi[p + 1] - phi[p - 1]) * 0.5, fy = (phi[p + GW] - phi[p - GW]) * 0.5;
      const g = sqrt(fx * fx + fy * fy);
      const kAA = 1 / (TAU * max(g, 1e-4) * 0.7);
      const k = min(K0, kAA) * (1 - 0.8 * sm(0.3, 0.55, g));
      const hc = 0.5 + 0.5 * tanh(k * cos(TAU * phi[p]));
      const fa = 1 - sm(0.07, 0.15, 3 * g);
      hh[p] = hc;
      ff[p] = fa;
      hz[p] = hc + 0.3 * fa * cos(TAU * 3 * phi[p] + 0.9) * (0.4 + 0.6 * hc);
    }
  }
  const tint = [0, 0, 0, 0, 0, 0];
  tintAt(cl(S.kn[0], 0, 1), tint);
  const ys = H / 2 + 62 * sin((TAU * S.t) / 53 + 0.4) + 22 * sin((TAU * S.t) / 31);
  const RD = 2.2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y + 1) * GW + (x + 1);
      const Hc = hh[p];
      const hx = (hz[p + 1] - hz[p - 1]) * 0.5, hy = (hz[p + GW] - hz[p - GW]) * 0.5;
      const shade = max(0.3, (0.707 + 0.5 * RD * (hx + hy)) / sqrt(1 + RD * RD * (hx * hx + hy * hy)) / 0.707);
      const ph = phi[p];
      const vb = 1 + 0.16 * (vnoise(ph + 31.7) - 0.5), vd = 1 + 0.4 * (vnoise(ph + 0.5 + 77.1) - 0.5);
      const fine = 1 + 0.17 * ff[p] * cos(TAU * 3 * ph + 0.9) * (0.4 + 0.6 * Hc);
      const bevel = 1 + 0.08 * cos(TAU * ph) * Hc;
      const mott = 1 + 0.22 * (vnoise2(x / 26 + 0.013 * S.t, y / 38 - 0.019 * S.t + 9) - 0.5);
      const gr = (1 + 0.1 * S.grain[y * W + x]) * fine * bevel * (1 + (mott - 1) * (1 - Hc));
      const gl = exp(-(((y + 0.2 * (x - 32) - ys) / 22) ** 2));
      const wb = Hc, wd = 1 - Hc;
      const base = (tint[0] * vb) * wb + (tint[3] * vd) * wd, gg = gl * (0.24 * wb + 0.04 * wd);
      const v0 = base * shade * gr + gg * tint[0];
      const v1 = ((tint[1] * vb) * wb + (tint[4] * vd) * wd) * shade * gr + gg * tint[1];
      const v2 = ((tint[2] * vb) * wb + (tint[5] * vd) * wd) * shade * gr + gg * tint[2];
      display.setPixel(x, y, soft(v0), soft(v1), soft(v2));
    }
  }
}
