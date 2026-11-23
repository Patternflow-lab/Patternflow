// ===== Patternflow pattern =====
// Title:   Optical Flow
// Family:  opticalflow
// Idea:    The top square is a moving picture of a rotating disc, a sliding streaked band and a breathing blob over a drifting field, and the bottom square is the flow a Horn-Schunck solver reads out of it frame by frame, painted with the motion colour wheel, so the colours flood into flat patches, smear across the edges and settle as the iterations pile up.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: optical flow by the variational method of Berthold Horn and Brian Schunck (1981), brightness constancy plus a smoothness term solved by Jacobi iteration with a warm start, the motion colour wheel of the Middlebury flow benchmark (Simon Baker and others, 2007), from memory, pattern round 229
// Round:   229
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Motion=0.3..3, Smoothness=-1..1, Iterations=-1..1
//
// Knob 1: Hue. Where the motion colour wheel starts, and with it the tint of the picture above: at 0 motion to the right is amber, down is green, left is blue and up is magenta, with the picture in teal; 0.25, 0.5 and 0.75 turn all of it a quarter, a half and three quarters round, and 1 is 0 again.
// Knob 2: Motion. How fast the three moving layers and the drift travel, 0.15 times the base pace at 0.3, 1.0 at 2 where it opens and 1.5 at 3. At 0.3 the disc turns once in about 40 seconds and the flow is faint and pale; at 3 the layers move a LED every two frames and the colours blaze.
// Knob 3: Smoothness. The weight alpha of the smoothness term, 0.4 times the opening value at -1 and 2.5 times at +1. Low, the flow follows each streak and edge and leaves the flat patches dark; high, it floods the flat patches and the gaps between layers with the colour of their neighbours and the disc, the band and the blob run into one another.
// Knob 4: Iterations. How many solver sweeps run between two frames, 1 at -1, 4 at 0.06 where it opens and 14 at +1, always warm started from the last frame. At 1 the flow lags behind the motion and its colour creeps out from the edges; at 14 it is settled as soon as the layers move.

const W = 64, H = 128, N = 64, G = 32, S = G + 2, TS = 128, TM = TS - 1;
const { floor, sqrt, exp, sin, cos, abs, min, max, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const PRE = 100;        // frames run before the first one is drawn
const DT0 = 1 / 30;     // step of those frames

// ---- the static texture -----------------------------------------------------
function blur(src, sigma) {
  const r = Math.ceil(sigma * 3), k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = exp((-i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i <= 2 * r; i++) k[i] /= sum;
  const tmp = new Float32Array(TS * TS), dst = new Float32Array(TS * TS);
  for (let y = 0; y < TS; y++)
    for (let x = 0; x < TS; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += k[i + r] * src[y * TS + ((x + i) & TM)];
      tmp[y * TS + x] = s;
    }
  for (let y = 0; y < TS; y++)
    for (let x = 0; x < TS; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += k[i + r] * tmp[((y + i) & TM) * TS + x];
      dst[y * TS + x] = s;
    }
  return dst;
}
function unit(a) {
  let m = 0, v = 0;
  for (let i = 0; i < a.length; i++) m += a[i];
  m /= a.length;
  for (let i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m);
  const s = 1 / sqrt(v / a.length + 1e-12);
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - m) * s;
  return a;
}
const noise = () => {
  const n = new Float32Array(TS * TS);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() + Math.random() + Math.random() - 1.5;
  return n;
};
// Soft blobs 4 to 8 LEDs across, in patches: where a patch is faint the picture has hardly any brightness
// gradient, and that is where the solver has nothing to go on.
function buildTexture() {
  const a = unit(blur(noise(), 1.5)), b = unit(blur(noise(), 3.3));
  const low = unit(blur(noise(), 7));
  const t = new Float32Array(TS * TS), f = new Float32Array(TS * TS);
  for (let i = 0; i < t.length; i++) {
    const d = Math.tanh(0.8 * (a[i] * 0.8 + b[i] * 0.6));
    const g = smooth((low[i] + 0.7) / 1.3);
    t[i] = d * (0.06 + 0.94 * g);
    f[i] = d * (0.7 + 0.3 * g);
  }
  for (const q of [t, f]) {
    unit(q);
    for (let i = 0; i < q.length; i++) q[i] = cl(q[i] * 0.7, -1, 1);
  }
  return [t, f];
}
// bilinear read of the periodic texture
function tx(tex, u, v) {
  const iu = floor(u), iv = floor(v), fu = u - iu, fv = v - iv;
  const x0 = iu & TM, x1 = (iu + 1) & TM, y0 = (iv & TM) * TS, y1 = ((iv + 1) & TM) * TS;
  const a = tex[y0 + x0], b = tex[y0 + x1], c = tex[y1 + x0], d = tex[y1 + x1];
  return a + (b - a) * fu + (c - a + (a - b - c + d) * fu) * fv;
}

// ---- colours -----------------------------------------------------------------
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const k = i % 6;
  return k === 0 ? [v, t, p] : k === 1 ? [q, v, p] : k === 2 ? [p, v, t] : k === 3 ? [p, q, v] : k === 4 ? [t, p, v] : [v, p, q];
}
// Four 256-step tables for the video, dark to light, one per layer, each a little differently tinted.
const TINT = [-0.015, 0.05, 0.0, 0.075];
function buildLuts(P, hue) {
  for (let l = 0; l < 4; l++) {
    const h = hue + TINT[l];
    const c0 = hsv(h, 0.8, 0.14), c1 = hsv(h + 0.015, 0.62, 0.56), c2 = hsv(h - 0.03, 0.2, 1.0);
    const lut = P.lut[l];
    for (let i = 0; i < 256; i++) {
      const f = i / 255;
      for (let c = 0; c < 3; c++) {
        lut[i * 3 + c] = 255 * (f < 0.5 ? c0[c] + (c1[c] - c0[c]) * (f * 2) : c1[c] + (c2[c] - c1[c]) * (f * 2 - 1));
      }
    }
  }
  P.lutHue = hue;
}
// The motion wheel, 1024 steps round: one table, colours chosen to stay bright on the panel.
const WSTOPS = [
  [0.0, 255, 64, 72], [0.12, 255, 150, 40], [0.22, 240, 232, 60], [0.34, 90, 235, 90],
  [0.46, 30, 225, 205], [0.58, 40, 150, 255], [0.7, 112, 90, 255], [0.82, 228, 70, 245], [1.0, 255, 64, 72],
];
const WHEEL = new Float32Array(1024 * 3);
for (let i = 0; i < 1024; i++) {
  const f = i / 1024;
  let k = 0;
  while (WSTOPS[k + 1][0] < f) k++;
  const A = WSTOPS[k], B = WSTOPS[k + 1], u = (f - A[0]) / (B[0] - A[0]);
  for (let c = 0; c < 3; c++) WHEEL[i * 3 + c] = A[c + 1] + (B[c + 1] - A[c + 1]) * u;
}
const N0 = [9, 11, 24];

// ---- setup -------------------------------------------------------------------
export function setup(P) {
  P.ready = false;
  P.tau = 0;
  [P.tex, P.texF] = buildTexture();
  P.L = new Float32Array(N * N);
  P.out = new Uint8ClampedArray(W * H * 3);
  P.lut = [0, 1, 2, 3].map(() => new Float32Array(256 * 3));
  P.lutHue = -9;
  const F = () => new Float32Array(S * S);
  P.prev = F(); P.cur = F();
  P.u = F(); P.v = F(); P.u2 = F(); P.v2 = F();
  P.ix = F(); P.iy = F(); P.it = F(); P.kx = F(); P.ky = F();
  P.acc = 0;
  P.fu = new Float32Array(N * N); P.fv = new Float32Array(N * N);
  // bilinear weights from the 32 by 32 cells to the 64 by 64 LEDs
  P.gi0 = new Uint8Array(N); P.gi1 = new Uint8Array(N); P.gw = new Float32Array(N);
  for (let x = 0; x < N; x++) {
    const g = cl((x + 0.5) / 2 - 0.5, 0, G - 1), i0 = min(G - 2, floor(g));
    P.gi0[x] = i0 + 1; P.gi1[x] = i0 + 2; P.gw[x] = g - i0;
  }
}

// ---- the scene: three layers over a drifting field, every path a sum of sines that never meet ----------
function scene(P, tau, withColour) {
  const { tex, texF, L, out, lut } = P;
  const s = sin, c = cos;
  // background: a slow pan of the field
  const bgx = 0.2 * tau + 8 * s(0.071 * tau + 1.3) + 4 * s(0.137 * tau + 4.1);
  const bgy = -0.15 * tau + 7 * s(0.083 * tau + 0.2) + 4 * s(0.151 * tau + 2.6);
  // blob that grows and shrinks
  const zx = 17 + 6 * s(0.113 * tau + 2.2) + 3 * s(0.269 * tau + 0.4);
  const zy = 21 + 5 * s(0.097 * tau + 5.2) + 3 * s(0.233 * tau + 1.7);
  const zs = exp(0.5 * s(0.41 * tau + 0.9) + 0.14 * s(0.67 * tau + 3.3));
  const za = 0.5 + 0.45 * s(0.071 * tau + 1.0);
  const zc = c(za), zn = s(za), zi = 1 / zs;
  // rotating disc
  const dx0 = 33 + 5 * s(0.173 * tau + 0.4) + 2.5 * s(0.311 * tau + 2.0);
  const dy0 = 40 + 5 * s(0.131 * tau + 1.7) + 2 * s(0.277 * tau + 0.2);
  const da = 0.5 * tau - (0.45 / 0.083) * c(0.083 * tau + 0.7) - (0.2 / 0.29) * c(0.29 * tau + 2.1);
  const dc = c(da), dn = s(da);
  // sliding band
  const bx0 = 32 + 27 * s(0.157 * tau + 0.9) + 6 * s(0.263 * tau + 1.1);
  const by0 = 32 + 24 * s(0.113 * tau + 3.2) + 5 * s(0.307 * tau + 0.3);
  const ba = 0.8 + 0.55 * s(0.083 * tau + 2.1) + 0.2 * s(0.191 * tau + 0.7);
  const bc = c(ba), bn = s(ba);
  const R = 17, HW = 7, HL = 44, ZA = 14, ZB = 9.5;
  const l0 = lut[0], l1 = lut[1], l2 = lut[2], l3 = lut[3];
  for (let y = 0; y < N; y++) {
    const py = y + 0.5;
    for (let x = 0; x < N; x++) {
      const px = x + 0.5;
      // field
      let lum = 0.26 + 0.2 * tx(tex, (px + bgx) * 0.85 + 11, (py + bgy) * 0.85 + 37);
      let k = (cl(lum, 0, 1) * 255 + 0.5) | 0;
      let r = 0, g = 0, b = 0;
      if (withColour) { r = l0[k * 3]; g = l0[k * 3 + 1]; b = l0[k * 3 + 2]; }
      // blob
      {
        const dx = px - zx, dy = py - zy;
        const xl = (zc * dx + zn * dy) * zi, yl = (-zn * dx + zc * dy) * zi;
        const q = (xl / ZA) * (xl / ZA) + (yl / ZB) * (yl / ZB);
        if (q < 2.2) {
          const d = (sqrt(q) - 1) * 11 * zs;
          const wob = 2.2 * tx(tex, xl * 0.4 + 90, yl * 0.4 + 14);
          const m = smooth(0.5 - (d - wob) / 2.2);
          if (m > 0) {
            const l = 0.5 + 0.3 * tx(tex, xl * 1.15 + 77, yl * 1.15 + 19);
            lum += (l - lum) * m;
            if (withColour) {
              const kk = (cl(l, 0, 1) * 255 + 0.5) | 0;
              r += (l1[kk * 3] - r) * m; g += (l1[kk * 3 + 1] - g) * m; b += (l1[kk * 3 + 2] - b) * m;
            }
          }
        }
      }
      // disc
      {
        const dx = px - dx0, dy = py - dy0;
        const r2 = dx * dx + dy * dy;
        if (r2 < (R + 6) * (R + 6)) {
          const xl = dc * dx + dn * dy, yl = -dn * dx + dc * dy;
          const d = sqrt(r2) - R;
          const wob = 2.4 * tx(tex, xl * 0.42 + 5, yl * 0.42 + 101);
          const m = smooth(0.5 - (d - wob) / 2.2);
          if (m > 0) {
            const l = 0.62 + 0.3 * tx(texF, xl + 40, yl + 66);
            lum += (l - lum) * m;
            if (withColour) {
              const kk = (cl(l, 0, 1) * 255 + 0.5) | 0;
              r += (l2[kk * 3] - r) * m; g += (l2[kk * 3 + 1] - g) * m; b += (l2[kk * 3 + 2] - b) * m;
            }
          }
        }
      }
      // band
      {
        const dx = px - bx0, dy = py - by0;
        const a = bc * dx + bn * dy, bb = -bn * dx + bc * dy;
        const d = abs(bb) - HW;
        if (d < 6 && abs(a) < HL) {
          const wob = 2.2 * tx(tex, a * 0.13 + 8, bb < 0 ? 53.5 : 97.5);
          const m = smooth(0.5 - (d - wob) / 2.2);
          if (m > 0) {
            const l = 0.42 + 0.36 * tx(texF, a * 0.27 + 21, bb + 9);
            lum += (l - lum) * m;
            if (withColour) {
              const kk = (cl(l, 0, 1) * 255 + 0.5) | 0;
              r += (l3[kk * 3] - r) * m; g += (l3[kk * 3 + 1] - g) * m; b += (l3[kk * 3 + 2] - b) * m;
            }
          }
        }
      }
      const i = y * N + x;
      L[i] = lum;
      if (withColour) { const o = i * 3; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
    }
  }
}

// ---- Horn and Schunck on the 32 by 32 cells --------------------------------------------------------
function edgeFill(a) {
  for (let j = 1; j <= G; j++) { a[j * S] = a[j * S + 1]; a[j * S + G + 1] = a[j * S + G]; }
  for (let i = 0; i < S; i++) { a[i] = a[S + i]; a[(G + 1) * S + i] = a[G * S + i]; }
}
function lowRes(P) {
  const { L, prev, cur } = P;
  prev.set(cur);
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      const o = j * 2 * N + i * 2;
      cur[(j + 1) * S + i + 1] = 0.25 * (L[o] + L[o + 1] + L[o + N] + L[o + N + 1]);
    }
  edgeFill(cur);
}
function derivatives(P, a2) {
  const { prev: p, cur: c, ix, iy, it, kx, ky } = P;
  for (let j = 1; j <= G; j++)
    for (let i = 1; i <= G; i++) {
      const o = j * S + i;
      const gx = ((c[o + 1] - c[o - 1]) + (p[o + 1] - p[o - 1])) * 0.25;
      const gy = ((c[o + S] - c[o - S]) + (p[o + S] - p[o - S])) * 0.25;
      const d = 1 / (a2 + gx * gx + gy * gy);
      ix[o] = gx; iy[o] = gy; it[o] = c[o] - p[o]; kx[o] = gx * d; ky[o] = gy * d;
    }
}
function sweeps(P, n) {
  const { ix, iy, it, kx, ky } = P;
  let { u, v, u2, v2 } = P;
  for (let s = 0; s < n; s++) {
    for (let j = 1; j <= G; j++)
      for (let i = 1; i <= G; i++) {
        const o = j * S + i;
        const ub = (u[o - 1] + u[o + 1] + u[o - S] + u[o + S]) * (1 / 6) + (u[o - S - 1] + u[o - S + 1] + u[o + S - 1] + u[o + S + 1]) * (1 / 12);
        const vb = (v[o - 1] + v[o + 1] + v[o - S] + v[o + S]) * (1 / 6) + (v[o - S - 1] + v[o - S + 1] + v[o + S - 1] + v[o + S + 1]) * (1 / 12);
        const p = ix[o] * ub + iy[o] * vb + it[o];
        u2[o] = ub - p * kx[o];
        v2[o] = vb - p * ky[o];
      }
    edgeFill(u2); edgeFill(v2);
    let t = u; u = u2; u2 = t;
    t = v; v = v2; v2 = t;
  }
  P.u = u; P.v = v; P.u2 = u2; P.v2 = v2;
}

// ---- the flow drawn with the wheel ------------------------------------------------------------------
function paintFlow(P, dt, hueOff, ref) {
  const { u, v, out, gi0, gi1, gw } = P;
  const inv = (2 / max(dt, 1 / 120)) / ref;      // cells a frame to a fraction of the reference speed
  for (let y = 0; y < N; y++) {
    const j0 = gi0[y] * S, j1 = gi1[y] * S, wy = gw[y];
    for (let x = 0; x < N; x++) {
      const a = j0 + gi0[x], b = j0 + gi1[x], c = j1 + gi0[x], d = j1 + gi1[x], wx = gw[x];
      const w00 = (1 - wx) * (1 - wy), w01 = wx * (1 - wy), w10 = (1 - wx) * wy, w11 = wx * wy;
      const fu = (u[a] * w00 + u[b] * w01 + u[c] * w10 + u[d] * w11) * inv;
      const fv = (v[a] * w00 + v[b] * w01 + v[c] * w10 + v[d] * w11) * inv;
      const sp = sqrt(fu * fu + fv * fv);
      const f = 1 - exp(-2 * sp);
      const h = ((((atan2(fv, fu) / TAU + hueOff) % 1) + 1) % 1) * 1024;
      const hi = (h | 0) * 3;
      const o = ((y + N) * W + x) * 3;
      out[o] = N0[0] + (WHEEL[hi] - N0[0]) * f;
      out[o + 1] = N0[1] + (WHEEL[hi + 1] - N0[1]) * f;
      out[o + 2] = N0[2] + (WHEEL[hi + 2] - N0[2]) * f;
    }
  }
}

// ---- one frame ---------------------------------------------------------------------------------------
function step(P, dt, kv, draw) {
  const rate = 0.5 * cl(kv[1], 0.3, 3);
  const alpha = 0.06 * exp(1.5 * cl(kv[2], -1, 1));
  const iters = 1.2 * exp(2.0 * (cl(kv[3], -1, 1) - 0.06));
  P.tau += dt * rate;
  scene(P, P.tau, draw);
  lowRes(P);
  if (P.first) { P.prev.set(P.cur); P.first = false; }
  derivatives(P, alpha * alpha);
  P.acc += (P.boost ? max(iters, 4) : iters) * dt * 30;
  const n = floor(P.acc);
  P.acc -= n;
  if (n > 0) sweeps(P, min(n, 40));
  if (draw) paintFlow(P, dt, cl(kv[0], 0, 1) + 0.12, 6 * (0.4 + 0.6 * rate));
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const hue = cl(kv[0], 0, 1);
  if (abs(hue - P.lutHue) > 1e-4) buildLuts(P, 0.58 + hue);
  if (!P.ready) {
    P.ready = true;
    P.first = true;
    P.boost = true;
    for (let i = 0; i < PRE; i++) step(P, DT0, kv, false);
    P.boost = false;
  }
  step(P, d, kv, true);
}

export function draw(display, P) {
  const { out } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
