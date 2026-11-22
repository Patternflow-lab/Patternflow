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
// @knobs Hue=0..1, Grind=0..4, Layers=8..60, Forging=0..1
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
const P_GROOVE = 23; // LEDs between grooves
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
    ready: false, t: 0, T: 11, z0: 0,
    kn: [0, 2, 8, 0.06],
    phi: new Float32Array(GW * GH), hh: new Float32Array(GW * GH),
    rowC: new Float32Array(GH), rowS: new Float32Array(GH), rowG: new Float32Array(GH),
    grain: new Float32Array(W * H),
    drills: [],
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
  const k2 = cl(kn[1], 0, 4);
  S.t += d;
  S.T += d * k2 * 0.5;
  S.z0 += d * k2 * 0.5;
  S.ready = true;
}

// ---- colour: bright layer and dark layer of each steel tint
const TINTS = [
  [[178, 198, 218], [22, 30, 44]], // etched steel, blue-grey
  [[218, 220, 222], [28, 30, 36]], // silver and graphite
  [[226, 206, 150], [44, 34, 20]], // straw
  [[214, 160, 112], [44, 26, 20]], // bronze
  [[184, 158, 226], [34, 24, 54]], // violet
  [[118, 158, 238], [14, 26, 62]], // temper blue
];
function tintAt(h, out) {
  const n = TINTS.length, u = (((h % 1) + 1) % 1) * n, i = floor(u) % n, f = u - floor(u), j = (i + 1) % n;
  const s = f * f * (3 - 2 * f);
  for (let c = 0; c < 3; c++) {
    out[c] = TINTS[i][0][c] * (1 - s) + TINTS[j][0][c] * s;
    out[3 + c] = TINTS[i][1][c] * (1 - s) + TINTS[j][1][c] * s;
  }
}

function fieldOf(S) {
  const kn = S.kn, T = S.T, z0 = S.z0;
  const Kl = cl(kn[2], 8, 60), kl = Kl / DNOM;
  const m = cl(kn[3], 0, 1), u = Math.pow(m, 0.55);
  // grinding plane
  const alpha = -0.1 + 0.55 * sin((TAU * T) / 61 + 0.7) + 0.32 * sin((TAU * T) / 97 + 2.1) + 0.12 * sin((TAU * T) / 37 + 4.0);
  const s0 = 0.7 * (1 + 0.4 * sin((TAU * T) / 43 + 1.9) * sin((TAU * T) / 131));
  const ca = cos(alpha) * s0, sa = sin(alpha) * s0;
  // forging
  const Dg = 34 * sm(0.04, 0.3, u) * (1 - 0.6 * sm(0.55, 0.95, u));
  const om = (PI / 24) * sm(0.3, 1.0, u) * (1 + 0.18 * sin((TAU * T) / 89));
  const Dd = 22 * sm(0.3, 0.5, u) * (1 - sm(0.7, 0.95, u));
  const Yo = 30 * sin((TAU * T) / 73);
  const phi = S.phi, rowC = S.rowC, rowS = S.rowS, rowG = S.rowG;
  for (let gy = 0; gy < GH; gy++) {
    const Y = gy - 1 + 0.5 - H / 2;
    const th = om * (Y - Yo);
    rowC[gy] = cos(th);
    rowS[gy] = sin(th);
    rowG[gy] = Dg * 0.5 * (1 + tanh(2.2 * sin((TAU * Y) / P_GROOVE)));
  }
  const dr = S.drills;
  for (let gy = 0; gy < GH; gy++) {
    const Y = gy - 1 + 0.5 - H / 2;
    const c = rowC[gy], s = rowS[gy], g = rowG[gy];
    const near = [];
    for (let k = 0; k < dr.length; k++) if (abs(Y - dr[k][1]) < 22) near.push(dr[k]);
    for (let gx = 0; gx < GW; gx++) {
      const X = gx - 1 + 0.5 - W / 2;
      let z = z0 + ca * X + sa * Y;
      z += g;
      z = z * c - X * s;
      if (Dd > 0.01) {
        for (let k = 0; k < near.length; k++) {
          const dx = X - near[k][0], dy = Y - near[k][1], sg = near[k][2];
          const r2 = (dx * dx + dy * dy) / (sg * sg);
          if (r2 < 9) z += Dd * exp(-0.5 * r2);
        }
      }
      phi[gy * GW + gx] = z * kl;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  fieldOf(S);
  const phi = S.phi, hh = S.hh;
  const K0 = 2.4;
  for (let gy = 1; gy < GH - 1; gy++) {
    for (let gx = 1; gx < GW - 1; gx++) {
      const p = gy * GW + gx;
      const fx = (phi[p + 1] - phi[p - 1]) * 0.5, fy = (phi[p + GW] - phi[p - GW]) * 0.5;
      const g = sqrt(fx * fx + fy * fy);
      const kAA = 1 / (TAU * max(g, 1e-4) * 0.7);
      const k = min(K0, kAA) * (1 - 0.8 * sm(0.3, 0.55, g));
      hh[p] = 0.5 + 0.5 * tanh(k * cos(TAU * phi[p]));
    }
  }
  const tint = [0, 0, 0, 0, 0, 0];
  tintAt(cl(S.kn[0], 0, 1), tint);
  const ys = H / 2 + 80 * sin((TAU * S.t) / 53 + 0.4) + 25 * sin((TAU * S.t) / 31);
  const RD = 2.2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y + 1) * GW + (x + 1);
      const Hc = hh[p];
      const hx = (hh[p + 1] - hh[p - 1]) * 0.5, hy = (hh[p + GW] - hh[p - GW]) * 0.5;
      const shade = (0.707 + 0.5 * RD * (hx + hy)) / sqrt(1 + RD * RD * (hx * hx + hy * hy)) / 0.707;
      const ph = phi[p];
      const vb = 1 + 0.16 * (vnoise(ph + 31.7) - 0.5), vd = 1 + 0.4 * (vnoise(ph + 0.5 + 77.1) - 0.5);
      const gr = 1 + 0.07 * S.grain[y * W + x];
      const gl = exp(-(((y + 0.2 * (x - 32) - ys) / 20) ** 2));
      const wb = Hc, wd = 1 - Hc;
      let out = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const bright = tint[c] * vb, dark = tint[3 + c] * vd;
        let v = (bright * wb + dark * wd) * shade * gr;
        v += gl * (0.22 * tint[c] * wb + 0.04 * tint[c] * wd);
        out[c] = cl(v, 0, 255) | 0;
      }
      display.setPixel(x, y, out[0], out[1], out[2]);
    }
  }
}
