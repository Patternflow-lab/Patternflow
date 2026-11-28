// ===== Patternflow pattern =====
// Title:   Veselago Slab
// Family:  negindex
// Idea:    A point of light near the top throws a fan of rays at a flat slab of negative refractive index, each ray bends the wrong way at the top face, crosses its neighbours inside the slab, bends again at the bottom face and crosses them a second time below it, and as the index wanders past minus one the two crisp foci open into bright cusps.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Index=0..4, Slab=-1..1, Fan=36..64
//
// Knob 1: Hue. draft
// Knob 2: Index. draft
// Knob 3: Slab. draft
// Knob 4: Fan. draft

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const NR = 60;              // rays
const LAMBDA = 7.5;         // LEDs to a wavelength
const NU = 0.75;            // cycles a second
const YT = 26;              // top face
const AREF = 15;            // source to top face
const SIG2 = 2 * 0.8 * 0.8; // ray profile: sigma 0.8 LED, 1.9 LED wide at half
const HW = 2.5;             // ray half width in LEDs, where the profile is cut

const COS = new Float32Array(1024);
for (let i = 0; i < 1024; i++) COS[i] = cos((i / 1024) * TAU);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// a colour lifted so blues and violets carry about the light of greens
function tint(h, s, o) {
  hsv(h, s, 1, o);
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = cl(Math.pow(0.6 / (l + 0.05), 0.7), 0.7, 1.9);
  o[0] *= g;
  o[1] *= g;
  o[2] *= g;
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 12; i++) ph.push(TAU * Math.random());
  params.s = { t: 0, k: null, ph };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 36];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.18);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d;
}

// ------------------------------------------------------------------ drawing
const F = new Float32Array(W * H * 3);
const C = [0, 0, 0];

// one straight piece of a ray: a soft line two LEDs wide, brightness ripples with the phase
function seg(ax, ay, bx, by, S0, nn, s0, col, wgt, clk) {
  const dx = bx - ax, dy = by - ay, L = hypot(dx, dy);
  if (L < 1e-6) return;
  const ux = dx / L, uy = dy / L, cr = col[0] * wgt, cg = col[1] * wgt, cb = col[2] * wgt;
  const ph0 = S0 / LAMBDA - NU * clk, dph = nn / LAMBDA;
  if (abs(uy) >= abs(ux)) {
    const y0 = max(0, ceil(min(ay, by) - 0.5)), y1 = min(H - 1, floor(max(ay, by) - 0.5)), hw = HW / abs(uy);
    for (let iy = y0; iy <= y1; iy++) {
      const yc = iy + 0.5, tc = (yc - ay) / uy, xc = ax + tc * ux;
      const j0 = max(0, ceil(xc - hw - 0.5)), j1 = min(W - 1, floor(xc + hw - 0.5));
      for (let j = j0; j <= j1; j++) {
        const o = j + 0.5 - xc, dd = o * uy, t = cl(tc + o * ux, 0, L);
        const fin = sm(3, 17, s0 + t);
        const mo = 0.62 + 0.38 * COS[(((ph0 + dph * t) * 1024) | 0) & 1023];
        const v = exp(-(dd * dd) / SIG2) * fin * mo, p = (iy * W + j) * 3;
        F[p] += cr * v;
        F[p + 1] += cg * v;
        F[p + 2] += cb * v;
      }
    }
  } else {
    const x0 = max(0, ceil(min(ax, bx) - 0.5)), x1 = min(W - 1, floor(max(ax, bx) - 0.5)), hw = HW / abs(ux);
    for (let ix = x0; ix <= x1; ix++) {
      const xc = ix + 0.5, tc = (xc - ax) / ux, yc = ay + tc * uy;
      const i0 = max(0, ceil(yc - hw - 0.5)), i1 = min(H - 1, floor(yc + hw - 0.5));
      for (let i = i0; i <= i1; i++) {
        const o = i + 0.5 - yc, dd = o * ux, t = cl(tc + o * uy, 0, L);
        const fin = sm(3, 17, s0 + t);
        const mo = 0.62 + 0.38 * COS[(((ph0 + dph * t) * 1024) | 0) & 1023];
        const v = exp(-(dd * dd) / SIG2) * fin * mo, p = (i * W + ix) * 3;
        F[p] += cr * v;
        F[p + 1] += cg * v;
        F[p + 2] += cb * v;
      }
    }
  }
}

function wander(S, t, i0, a, b, c, d, e) {
  const p = S.ph;
  return (a * sin(0.0713 * t + p[i0]) + b * sin(0.1137 * t + p[i0 + 1]) + c * sin(0.1711 * t + p[i0 + 2]) + d * sin(0.2593 * t + p[i0 + 3]) + e * sin(0.0371 * t + p[i0 + 4]));
}

export function draw(display, params) {
  const S = params.s, t = S.t;
  const k1 = S.k[0], k2 = cl(S.k[1], 0, 4), k3 = cl(S.k[2], -1, 1), k4 = cl(S.k[3], 36, 64);
  const h0 = 0.5 + k1 + 0.0012 * t + 0.05 * sin(0.031 * t + S.ph[10]);
  const nbar = -(0.4 + 0.4 * k2);
  const amp = 0.34 * Math.pow(-nbar / 1.2, 0.7);
  const n = min(-0.3, nbar + amp * wander(S, t, 0, 0.45, 0.3, 0.2, 0.12, 0.35) / 1.0);
  const a = AREF + 3 * sin(0.093 * t + S.ph[5]) + 1.6 * sin(0.151 * t + S.ph[6]);
  const sx = 32 + 11 * sin(0.067 * t + S.ph[7]) + 5 * sin(0.139 * t + S.ph[8]);
  const d = 40 * exp(0.27 * k3) * (1 + 0.07 * sin(0.083 * t + S.ph[9]) + 0.04 * sin(0.191 * t + S.ph[11]));
  const sy = YT - a, yB = YT + d;
  const fan = (k4 * PI) / 180;

  // ground, slab
  hsv(h0 + 0.1, 0.9, 1, C);
  const gr = C[0], gg = C[1], gb = C[2];
  hsv(h0 + 0.02, 0.6, 1, C);
  const sr = C[0], sg = C[1], sb = C[2];
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    let gl = 0.05 + 0.03 * exp(-((yc - 60) * (yc - 60)) / 1800);
    let sl = 0;
    if (yc > YT && yc < yB) sl = 0.06 + 0.05 * exp(-(yc - YT) * (yc - YT) / 30) + 0.05 * exp(-(yB - yc) * (yB - yc) / 30);
    const e1 = exp(-(yc - YT) * (yc - YT) / SIG2) * 0.3, e2 = exp(-(yc - yB) * (yc - yB) / SIG2) * 0.3;
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      F[p] = gr * gl + sr * (sl + e1 + e2);
      F[p + 1] = gg * gl + sg * (sl + e1 + e2);
      F[p + 2] = gb * gl + sb * (sl + e1 + e2);
    }
  }

  // rays
  const tmp = [0, 0, 0];
  for (let i = 0; i < NR; i++) {
    const u = ((i + 0.5) / NR) * 2 - 1, th = u * fan, sT = sin(th), cT = cos(th);
    tint(h0 + 0.26 * u, 0.85, tmp);
    const wA = sm(1.0, 0.8, abs(u)) * 0.34;
    const x1 = sx + (a * sT) / cT, S1 = a / cT;
    seg(sx, sy, x1, YT, 0, 1, 0, tmp, wA, t);
    const s2 = sT / n;
    if (abs(s2) >= 1) {
      // cannot enter: reflected at the top face
      seg(x1, YT, x1 + 300 * sT, YT - 300 * cT, S1, 1, S1, tmp, wA * 0.55, t);
    } else {
      const c2 = sqrt(1 - s2 * s2), L2 = d / c2, x2 = x1 + (d * s2) / c2;
      seg(x1, YT, x2, yB, S1, n, S1, tmp, wA, t);
      seg(x2, yB, x2 + 300 * sT, yB + 300 * cT, S1 + n * L2, 1, S1 + L2, tmp, wA, t);
    }
  }

  // source
  hsv(h0, 0.35, 1, C);
  for (let y = max(0, floor(sy - 9)); y <= min(H - 1, floor(sy + 9)); y++)
    for (let x = max(0, floor(sx - 9)); x <= min(W - 1, floor(sx + 9)); x++) {
      const r2 = (x + 0.5 - sx) * (x + 0.5 - sx) + (y + 0.5 - sy) * (y + 0.5 - sy);
      const v = 0.45 * exp(-r2 / 14) + 1.4 * exp(-r2 / 3.2), p = (y * W + x) * 3;
      F[p] += C[0] * v;
      F[p + 1] += C[1] * v;
      F[p + 2] += C[2] * v;
    }

  // tone map
  const G = 1.5;
  for (let p = 0; p < W * H; p++) {
    const r = F[p * 3], g = F[p * 3 + 1], b = F[p * 3 + 2];
    const m = max(r, g, b);
    const x = p % W, y = (p / W) | 0;
    if (m < 0.004) {
      display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const o = 1 - exp(-G * m), f = o / m, wh = 0.3 * o * o * o;
    display.setPixel(x, y, min(255, ((r * f + wh) * 255) | 0), min(255, ((g * f + wh) * 255) | 0), min(255, ((b * f + wh) * 255) | 0));
  }
}
