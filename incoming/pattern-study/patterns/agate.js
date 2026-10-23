// ===== Patternflow pattern =====
// Title:   Agate
// Family:  mineral
// Idea:    A slice of banded agate lies on a lightbox, so close it fills the panel, its fine fortification bands of pale blue, milky white and smoky lavender following the nodule's rough brown rind in to a hollow of glinting quartz, while a slow saw cuts deeper and the bands flow, open and close.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20, after polished slices of blue lace agate held up to a lightbox
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Stain=0..1, Speed=0.2..3, Width=1..4, Light=-1..1
//
// Knob 1: Stain. The colour of the stone: blue lace agate at 0, then grey, honey and at 1 a pale carnelian, all of them pale the way agate is with light coming through it.
// Knob 2: Speed. How fast the saw cuts down through the nodule and the lamp wanders under the glass: at 2 the bands creep about half a LED a second and a small eye in them opens and closes over ten seconds.
// Knob 3: Width. How thick each band was laid down, from fine bands of about one LED at the start to 4 LED bands.
// Knob 4: Light. Which side of the lightbox the lamp sits under, left at -1, behind the middle at 0, right at 1; it wanders a little either side of there on its own.
// Buttons: K1 tap cuts into a fresh nodule: the blade crosses the lightbox from the left and the new slice follows it.

const W = 64;
const H = 128;
const N = W * H;
// The band field is worked out on a grid with a margin round the panel, so
// the rind can run off the panel's edge without the bands bending to meet it.
const M = 10;
const GW = W + 2 * M;
const GH = H + 2 * M;
const GN = GW * GH;
const NA = 256;
const NB = 120;
const TAU = Math.PI * 2;
// The nodule's outline before its wall wanders: a rounded oblong.
const EA = 37;
const EB = 72;
const SUP = 2.2;
const NW = 5;
const RIND = 2.2;
const CORE = 6;
const FILL = 0.9;
const HOLE = 3.6;
const { sin, cos, sqrt, exp, min, max, floor, abs } = Math;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = Math.imul(n, 9);
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}

// Each stain: clear band, milky band, the smoky tint some packets of clear
// bands take, rind, quartz, and the bare lightbox round the slice.
const STAIN = [
  [[174, 205, 250], [228, 220, 210], [186, 170, 218], [150, 102, 64], [226, 230, 240], [222, 228, 238]],
  [[198, 204, 214], [226, 220, 210], [176, 170, 184], [136, 106, 80], [232, 232, 234], [230, 230, 230]],
  [[244, 204, 136], [238, 226, 204], [210, 158, 108], [144, 92, 50], [240, 234, 220], [238, 232, 216]],
  [[248, 160, 116], [238, 216, 202], [218, 120, 98], [132, 74, 44], [242, 230, 224], [240, 230, 222]],
];

function nodule(P) {
  P.cx = W / 2 + (Math.random() - 0.5) * 4;
  P.cy = H / 2 + (Math.random() - 0.5) * 10;
  // The wall wanders round the oblong, and wanders differently deeper in.
  P.harm = [];
  for (let m = 2; m <= 7; m++)
    P.harm.push([m, (0.17 / m ** 0.8) * (0.5 + Math.random()), Math.random() * TAU, (Math.random() - 0.5) * 0.09]);
  // Lobes where the gas bubble the agate filled was pinched or swollen.
  P.lobes = [];
  for (let j = 0; j < 3; j++)
    P.lobes.push([Math.random() * TAU, (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4), 0.18 + Math.random() * 0.15, (Math.random() - 0.5) * 0.06]);
  P.rough = [];
  for (const m of [11, 17, 23, 31]) P.rough.push([m, 0.25 + Math.random() * 0.35, Math.random() * TAU]);
  // Slow ripples in the layers themselves, as a field through the stone, a
  // finer crinkle that makes the lace, and a broad wash of tint.
  P.waves = [];
  for (let j = 0; j < NW; j++) {
    const a = Math.random() * TAU;
    const k = j < 3 ? 0.11 + Math.random() * 0.1 : j === 3 ? 0.42 : 0.06;
    P.waves.push([cos(a) * k, sin(a) * k * (j === 3 ? 1 : 0.55), 0.12 + Math.random() * 0.12, Math.random() * TAU]);
    for (let x = 0; x < W; x++) {
      P.wsx[j * W + x] = sin(P.waves[j][0] * (x + 0.5));
      P.wcx[j * W + x] = cos(P.waves[j][0] * (x + 0.5));
    }
  }
  // Band widths, in units of Width, all near one. The bands come in packets
  // of a dozen or so, each laid down from a slightly different solution:
  // mostly pale blue, sometimes near white or smoky lavender. A packet starts
  // with a band laid down twice as thick.
  let u = 0;
  let thick = 0;
  let tint = 0;
  for (let k = 0; k <= NB; k++) {
    P.U[k] = u;
    P.bh[k] = Math.random();
    if (k === thick) {
      const r = Math.random();
      tint = r < 0.65 ? 0.1 * Math.random() : r < 0.85 ? 0.45 + 0.1 * Math.random() : 0.85 + 0.15 * Math.random();
      if (k) u += 1.1;
      thick += 9 + floor(Math.random() * 7);
    }
    P.bz[k] = tint;
    u += 0.88 + Math.random() * 0.24;
  }
  P.seed = (Math.random() * 1e6) | 0;
  P.fresh = true;
  for (let p = 0; p < N; p++) {
    P.rr[p] = Math.random() * 1.3;
    P.rt[p] = Math.random();
  }
  for (let Y = 0; Y < GH; Y++)
    for (let X = 0; X < GW; X++) {
      const i = Y * GW + X;
      const dx = X - M + 0.5 - P.cx;
      const dy = Y - M + 0.5 - P.cy;
      let a = (Math.atan2(dy, dx) / TAU) * NA;
      if (a < 0) a += NA;
      P.ang[i] = a;
      P.rad[i] = sqrt(dx * dx + dy * dy) + 1e-6;
    }
  // How far the wall may reach along each ray before it leaves the grid.
  for (let a = 0; a <= NA; a++) {
    const th = (a / NA) * TAU;
    const c = cos(th);
    const s = sin(th);
    const rx = (c > 0 ? W + M - P.cx : P.cx + M) / (abs(c) + 1e-6);
    const ry = (s > 0 ? H + M - P.cy : P.cy + M) / (abs(s) + 1e-6);
    P.rmax[a] = min(rx, ry) - 3;
  }
}

export function setup(params) {
  const P = params;
  P.U = new Float32Array(NB + 1);
  P.bh = new Float32Array(NB + 1);
  P.bz = new Float32Array(NB + 1);
  for (const k of ["ang", "rad", "Rp", "sx", "sy", "bd", "d"]) P[k] = new Float32Array(GN);
  P.inn = new Uint8Array(GN);
  P.rmax = new Float32Array(NA + 1);
  P.R = new Float32Array(NA + 1);
  P.R0 = new Float32Array(NA + 1);
  P.scale = 1;
  // The stone's own grain: a fixed jitter per LED.
  for (const k of ["g1", "g2", "g3", "fh", "rr", "rt", "off"]) P[k] = new Float32Array(N);
  P.wsx = new Float32Array(NW * W);
  P.wcx = new Float32Array(NW * W);
  P.wsy = new Float32Array(NW * H);
  P.wcy = new Float32Array(NW * H);
  P.lx = new Float32Array(W);
  P.ly = new Float32Array(H);
  P.out = new Uint8ClampedArray(N * 3);
  P.old = new Uint8ClampedArray(N * 3);
  for (let p = 0; p < N; p++) {
    P.g1[p] = Math.random() * 2 - 1;
    P.g2[p] = Math.random() * 2 - 1;
    P.g3[p] = Math.random() * 2 - 1;
    P.fh[p] = Math.random();
  }
  P.t = 0;
  P.z = 0;
  P.wipe = -1;
  P.stain = 0;
  P.width = 1;
  P.side = 0.06;
  nodule(P);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.stain = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0.2, 3) / 2;
  P.width = clamp(k[2], 1, 4);
  P.side = clamp(k[3], -1, 1);
  P.t += dt * speed;
  P.z += dt * speed * 1.6;
  if (input.btnPressed && input.btnPressed[0]) {
    P.old.set(P.out);
    P.wipe = 0;
    nodule(P);
  }
  if (P.wipe >= 0) {
    P.wipe += dt * 48;
    if (P.wipe > W + 2) P.wipe = -1;
  }
}

// Where the slice's wall lies this deep into the nodule, and how far every
// point inside is from it: the layers were laid down on the wall, so each band
// is the wall drawn again a little further in.
function field(P) {
  const z = P.z;
  for (let a = 0; a <= NA; a++) {
    const th = (a / NA) * TAU;
    let r = 1 / ((abs(cos(th)) / EA) ** SUP + (abs(sin(th)) / EB) ** SUP) ** (1 / SUP);
    let f = 1;
    for (const [m, amp, ph, om] of P.harm) f += amp * sin(m * th + ph + om * z);
    r *= f;
    for (const [c0, amp, wd, om] of P.lobes) {
      let e = th - c0 - om * z;
      e -= TAU * Math.round(e / TAU);
      r += amp * exp(-(e * e) / (wd * wd));
    }
    for (const [m, amp, ph] of P.rough) r += amp * sin(m * th + ph);
    P.R0[a] = r;
  }
  const { inn, sx, sy, bd, Rp, rad, ang, R } = P;
  // The stone is held so close that it covers about the same share of the
  // lightbox whatever its shape: the outline swells or shrinks to suit.
  for (let it = P.fresh ? 8 : 1; it > 0; it--) {
    for (let a = 0; a <= NA; a++) R[a] = min(P.R0[a] * P.scale, P.rmax[a]);
    let cov = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y + M) * GW + x + M;
        const af = ang[i];
        const a0 = af | 0;
        if (rad[i] < R[a0] + (R[a0 + 1] - R[a0]) * (af - a0)) cov++;
      }
    P.scale = clamp(P.scale * (1 + 0.8 * (FILL - cov / N)), 0.8, 1.4);
  }
  for (let i = 0; i < GN; i++) {
    const af = ang[i];
    const a0 = af | 0;
    const r = R[a0] + (R[a0 + 1] - R[a0]) * (af - a0);
    Rp[i] = r;
    inn[i] = rad[i] < r ? 1 : 0;
    bd[i] = 1e9;
  }
  // Seeds: the wall's own point on the ray through each edge cell.
  for (let Y = 1; Y < GH - 1; Y++)
    for (let X = 1; X < GW - 1; X++) {
      const i = Y * GW + X;
      if (!inn[i] || (inn[i - 1] && inn[i + 1] && inn[i - GW] && inn[i + GW])) continue;
      const q = Rp[i] / rad[i];
      const px = X - M + 0.5;
      const py = Y - M + 0.5;
      sx[i] = P.cx + (px - P.cx) * q;
      sy[i] = P.cy + (py - P.cy) * q;
      bd[i] = (sx[i] - px) ** 2 + (sy[i] - py) ** 2;
    }
  // Two sweeps carry the nearest wall point inward.
  const take = (i, j, px, py) => {
    if (bd[j] > 1e8) return;
    const ax = sx[j] - px;
    const ay = sy[j] - py;
    const e = ax * ax + ay * ay;
    if (e < bd[i]) {
      bd[i] = e;
      sx[i] = sx[j];
      sy[i] = sy[j];
    }
  };
  for (let Y = 1; Y < GH - 1; Y++) {
    const py = Y - M + 0.5;
    for (let X = 1; X < GW - 1; X++) {
      const i = Y * GW + X;
      if (!inn[i]) continue;
      const px = X - M + 0.5;
      take(i, i - 1, px, py);
      take(i, i - GW - 1, px, py);
      take(i, i - GW, px, py);
      take(i, i - GW + 1, px, py);
    }
    for (let X = GW - 2; X > 0; X--) {
      const i = Y * GW + X;
      if (inn[i]) take(i, i + 1, X - M + 0.5, py);
    }
  }
  let dmax = 0;
  for (let Y = GH - 2; Y > 0; Y--) {
    const py = Y - M + 0.5;
    for (let X = GW - 2; X > 0; X--) {
      const i = Y * GW + X;
      if (!inn[i]) continue;
      const px = X - M + 0.5;
      take(i, i + 1, px, py);
      take(i, i + GW + 1, px, py);
      take(i, i + GW, px, py);
      take(i, i + GW - 1, px, py);
    }
    for (let X = 1; X < GW - 1; X++) {
      const i = Y * GW + X;
      if (!inn[i]) continue;
      take(i, i - 1, X - M + 0.5, py);
      const d = sqrt(bd[i]);
      P.d[i] = d;
      if (d > dmax) dmax = d;
    }
  }
  P.dmax = dmax;
}

function stain(P) {
  const s = P.stain * 3;
  const i = min(2, floor(s));
  const f = s - i;
  return STAIN[i].map((c, j) => c.map((v, ch) => v + (STAIN[i + 1][j][ch] - v) * f));
}

export function draw(display, params) {
  const P = params;
  // The wall moves far slower than the ripples in the layers, so its
  // distances are worked out again only each time the saw has gone a little
  // deeper.
  if (P.fresh || abs(P.z - P.fz) > 0.3) {
    field(P);
    P.fz = P.z;
    P.fresh = false;
  }
  const [CT, CM, CS, CR, CQ, CL] = stain(P);
  const CW = CT.map((v, c) => v + (CM[c] - v) * 0.5);
  const tmax = max(CT[0], CT[1], CT[2]);
  const { t, z, out, old, waves, seed, wsx, wcx, wsy, wcy, U, bh, bz, inn, lx, ly, d: D, rr, rt, fh, g1, g2, g3, off } = P;
  // The lamp under the glass: broad, and wandering slowly sideways.
  const lampX = W / 2 + 30 * P.side + 14 * sin(t * 0.55);
  const lampY = H / 2 + 34 * sin(t * 0.31 + 1);
  for (let x = 0; x < W; x++) lx[x] = 0.24 * exp(-((x + 0.5 - lampX) ** 2) / 1800);
  for (let y = 0; y < H; y++) ly[y] = exp(-((y + 0.5 - lampY) ** 2) / 7200);
  const wd = P.width;
  const dCore = P.dmax - CORE;
  for (let j = 0; j < NW; j++)
    for (let y = 0; y < H; y++) {
      const a = waves[j][1] * (y + 0.5) + waves[j][2] * z + waves[j][3];
      wsy[j * H + y] = sin(a);
      wcy[j * H + y] = cos(a);
    }
  // Eyes: small knots in the layers that the saw passes through, each a
  // little bullseye that opens, holds and closes again over ten seconds or so.
  off.fill(0);
  for (let j = floor((z - 24) / 14); j <= floor((z + 24) / 14); j++) {
    const ex = 6 + 52 * hash(seed + j * 131 + 1);
    const ey = 10 + 108 * hash(seed + j * 131 + 2);
    const gi = (floor(ey) + M) * GW + floor(ex) + M;
    if (!inn[gi]) continue;
    const dc = D[gi];
    const f = clamp((dCore - 5 - dc) / 5, 0, 1) * clamp((dc - 6) / 4, 0, 1);
    const A = 7 * f * exp(-(((z - j * 14 - 7 * hash(seed + j * 131 + 3)) / 7) ** 2));
    const sg = 2.8 + 2.2 * hash(seed + j * 131 + 4);
    if (A < 0.05) continue;
    for (let y = max(0, floor(ey - 3 * sg)); y < min(H, ey + 3 * sg); y++)
      for (let x = max(0, floor(ex - 3 * sg)); x < min(W, ex + 3 * sg); x++)
        off[y * W + x] += A * exp(-((x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2) / (sg * sg));
  }
  const wipe = P.wipe;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    const c0 = wcy[y], s0 = wsy[y], c1 = wcy[H + y], s1 = wsy[H + y], c2 = wcy[2 * H + y], s2 = wsy[2 * H + y];
    const c3 = wcy[3 * H + y], s3 = wsy[3 * H + y], c4 = wcy[4 * H + y], s4 = wsy[4 * H + y];
    const lyy = ly[y];
    for (let x = 0; x < W; x++) {
      const i = (y + M) * GW + x + M;
      const p = y * W + x;
      const q = p * 3;
      if (wipe >= 0 && x > wipe - 1) {
        // The blade crossing the lightbox, the old slice still beyond it.
        if (x > wipe) display.setPixel(x, y, old[q], old[q + 1], old[q + 2]);
        else display.setPixel(x, y, 30, 28, 34);
        continue;
      }
      const L = 0.76 + lx[x] * lyy;
      let cr;
      let cg;
      let cb;
      let tau;
      if (!inn[i]) {
        cr = CL[0];
        cg = CL[1];
        cb = CL[2];
        tau = 0.92;
      } else if (D[i] < RIND + rr[p]) {
        // The rind: rough, nearly opaque, with chalky flecks.
        cr = CR[0];
        cg = CR[1];
        cb = CR[2];
        tau = rt[p] < 0.3 ? 0.62 : 0.26 + 0.16 * rt[p];
      } else {
        const dd =
          D[i] +
          off[p] +
          0.8 * (wsx[x] * c0 + wcx[x] * s0 + wsx[W + x] * c1 + wcx[W + x] * s1 + wsx[2 * W + x] * c2 + wcx[2 * W + x] * s2) +
          0.4 * (wsx[3 * W + x] * c3 + wcx[3 * W + x] * s3);
        if (dd > dCore + HOLE) {
          // Where the crystals did not meet, the slice is open and the
          // lightbox shines straight through.
          cr = CL[0];
          cg = CL[1];
          cb = CL[2];
          tau = 1;
        } else if (dd > dCore) {
          // Quartz druzy: each tiny crystal throws the lamp back when its
          // face turns toward it, and the saw keeps cutting new ones.
          const fa = hash(p * 31 + floor(z * 0.4 + fh[p]) * 977 + seed);
          cr = CQ[0];
          cg = CQ[1];
          cb = CQ[2];
          if (dd < dCore + 0.9) tau = 0.9;
          else if (fa < 0.33) tau = 0.16 + 0.3 * fa;
          else {
            const ax = lampX - x - 0.5;
            const ay = lampY - py;
            const c = (cos(fa * 40) * ax + sin(fa * 40) * ay) / (sqrt(ax * ax + ay * ay) + 1);
            tau = 0.5 + 0.4 * fa + (c > 0 ? 0.7 * c ** 8 : 0);
          }
        } else {
          const u = (dd - RIND) / wd;
          let k = min(NB - 1, max(0, floor(u)));
          while (k > 0 && U[k] > u) k--;
          while (k < NB - 1 && U[k + 1] <= u) k++;
          if (k & 1) {
            cr = CM[0];
            cg = CM[1];
            cb = CM[2];
            tau = 0.165 + 0.05 * bh[k];
          } else {
            // The clear bands, in the packet's tint, washed a little warmer
            // or cooler across the slice, all equally clear.
            const zt = bz[k] + 0.1 * (wsx[4 * W + x] * c4 + wcx[4 * W + x] * s4);
            const ms = clamp((zt - 0.6) / 0.3, 0, 1);
            const mw = clamp((zt - 0.15) / 0.3, 0, 1) - ms;
            cr = CT[0] + (CW[0] - CT[0]) * mw + (CS[0] - CT[0]) * ms;
            cg = CT[1] + (CW[1] - CT[1]) * mw + (CS[1] - CT[1]) * ms;
            cb = CT[2] + (CW[2] - CT[2]) * mw + (CS[2] - CT[2]) * ms;
            tau = ((0.94 + 0.1 * bh[k] + 0.03 * g3[p]) * tmax) / max(cr, cg, cb);
          }
        }
      }
      const v = L * tau;
      let r = cr * v;
      let g = cg * v;
      let b = cb * v;
      // The grain: the two weaker channels of every LED wander a little.
      const j1 = 12 * g1[p];
      const j2 = 12 * g2[p];
      if (b >= r && b >= g) {
        r = min(b, max(0, r + j1));
        g = min(b, max(0, g + j2));
      } else if (r >= g) {
        g = min(r, max(0, g + j1));
        b = min(r, max(0, b + j2));
      } else {
        r = min(g, max(0, r + j1));
        b = min(g, max(0, b + j2));
      }
      out[q] = r;
      out[q + 1] = g;
      out[q + 2] = b;
      display.setPixel(x, y, out[q], out[q + 1], out[q + 2]);
    }
  }
}
