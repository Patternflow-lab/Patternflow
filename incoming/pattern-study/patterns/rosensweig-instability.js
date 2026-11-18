// ===== Patternflow pattern =====
// Title:   Rosensweig Instability
// Family:  physics
// Idea:    A pool of black ferrofluid seen from a slant stays flat until the magnetic field passes its critical value, then a hexagonal lattice of spikes erupts, five to a row, each with a bright tip and a glint down its flank, and when the field is turned back the spikes stay up well below the value that raised them before the lattice melts out, a gauge down the right edge marking where the pool erupts and where it collapses.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rosensweig instability, the normal-field instability of a ferrofluid (Michael Cowley and Ronald Rosensweig, 1967, from memory), whose hexagonal spikes come up subcritically; the height field follows the Swift-Hohenberg equation with a quadratic term (Jack Swift and Pierre Hohenberg, 1977, from memory), whose hexagons also appear subcritically; the 3 by 5 digits of Kasiski Examination (pattern round 108), copied from edit-distance.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Field=0..1, Lamp=0..1
//
// Knob 1: Hue. Tints the lamp and with it the glints and the bright tips, round the wheel and skipping the oranges that go brown when dim. At 0 the lamp is azure; at 0.25 it is violet, at 0.5 rose red and at 0.75 green.
// Knob 2: Speed. The pace of the model and of the slow cycle together. At the opening 2 the field runs 0.84 to 1.30 of the critical value and back in 40 s, with the spikes standing for about 30 s of it and a flat pool for about 10 s; at 3 the round takes 27 s and at 0.2 it takes 400 s.
// Knob 3: Field. Your hand on the field. At 0, where it opens, the slow cycle runs and starts at 1.16 on the way down. From 0.04 the field is yours, 0.70 to 1.50 of the critical value across the knob, the number at the top giving it in hundredths. A flat pool erupts at 0.40 (1.00). A standing lattice outlasts that mark going down and is gone just below 0.32 (0.93), so at 0.35 (0.96) a lattice that was up stays up and a pool that was flat stays flat.
// Knob 4: Lamp. Where the lamp stands round the pool, once round over the knob's travel. It opens at 0.06, front left, and sways 0.5 radian either way over 23 s at Speed 2 whatever the knob says. At 0.43 the lamp is behind the pool and each tip sits in a ring of rim light; at 0.75 it is at the front right and the glints trail down toward the lower right from every tip.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, sin, cos, round, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
const wheel = (k) => (0.22 + ((0.33 + 0.81 * k) % 0.81)) % 1;

// ---- the pool: a Swift-Hohenberg height field on the 64 x 128 grid, periodic, stepped in Fourier space.
// The lattice constant is 12.8 LEDs: 5 spikes across, 12 rows down. The rows are 10.667 LEDs apart on the
// panel, 11.085 in the field's own units, so the grid carries a regular hexagonal lattice with no strain.
const SY = 1.0392304845, A0 = 12.8, K0 = (4 * PI) / (sqrt(3) * A0);
const G2 = 1.1, STAB = 2, FORCE = 0.01;

const bre = new Float64Array(H), bim = new Float64Array(H);
function makeF(n) {
  const rev = new Uint16Array(n), bits = Math.round(Math.log2(n)), cs = new Float64Array(n / 2), sn = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) (cs[i] = cos((2 * PI * i) / n)), (sn[i] = sin((2 * PI * i) / n));
  return { n, rev, cs, sn };
}
const FX = makeF(W), FY = makeF(H);
function line(re, im, off, stride, F, sign) {
  const n = F.n, rev = F.rev;
  for (let i = 0; i < n; i++) {
    const j = off + rev[i] * stride;
    bre[i] = re[j];
    bim[i] = im[j];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let s = 0; s < n; s += len)
      for (let k = 0; k < half; k++) {
        const wr = F.cs[k * step], wi = sign * F.sn[k * step], a = s + k, b = a + half;
        const tr = bre[b] * wr - bim[b] * wi, ti = bre[b] * wi + bim[b] * wr;
        bre[b] = bre[a] - tr;
        bim[b] = bim[a] - ti;
        bre[a] += tr;
        bim[a] += ti;
      }
  }
  for (let i = 0; i < n; i++) {
    const j = off + i * stride;
    re[j] = bre[i];
    im[j] = bim[i];
  }
}
function fft2(re, im, sign) {
  for (let y = 0; y < H; y++) line(re, im, y * W, 1, FX, sign);
  for (let x = 0; x < W; x++) line(re, im, x, W, FY, sign);
  if (sign > 0) for (let i = 0; i < N; i++) (re[i] /= N), (im[i] /= N);
}

// The hexagonal template: three cosines 120 degrees apart, a maximum at (x0, y0) and at every lattice point.
const BV = [[0, K0], [(K0 * sqrt(3)) / 2, -K0 / 2], [(-K0 * sqrt(3)) / 2, -K0 / 2]];
function template(x0, y0) {
  const t = new Float64Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (const [bx, by] of BV) s += cos(bx * (x - x0) + by * (y - y0) * SY);
      t[y * W + x] = s;
    }
  return t;
}

export function setup(params) {
  const S = {
    u: new Float64Array(N), re: new Float64Array(N), im: new Float64Array(N), nr: new Float64Array(N), ni: new Float64Array(N),
    q2: new Float64Array(N), fr: new Float64Array(N), fi: new Float64Array(N), cr: new Float64Array(N), ci: new Float64Array(N),
    gx: new Float64Array(N), gy: new Float64Array(N), kx: new Float64Array(N), ky: new Float64Array(N),
    hue: 0, speed: 2, hand: 0, lamp: 0, T: 0, B: 1.16, Bt: 1.16, tt: 0, rms: 0.6, rgb: new Float32Array(N * 3),
    trail: new Float32Array(40).fill(1.16), tacc: 0,
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const m = x < W / 2 ? x : x - W, n = y < H / 2 ? y : y - H, kx = (2 * PI * m) / W, ky = (2 * PI * n) / (H * SY);
      const q = 1 - (kx * kx + ky * ky) / (K0 * K0), i = y * W + x;
      S.q2[i] = q * q + STAB;
      // derivative multipliers per LED, with the Nyquist lines left out so the field stays real
      S.kx[i] = x === W / 2 ? 0 : kx;
      S.ky[i] = y === H / 2 ? 0 : (2 * PI * n) / H;
    }
  // The seed: a faint copy of the lattice that the field feeds in once it passes the onset, standing in for the shiver
  // of a real pool, so the spikes come up in step with the grid. Below the onset it is off and a flat pool stays flat.
  const t = template(3.2, 5.333);
  for (let i = 0; i < N; i++) S.fr[i] = t[i];
  fft2(S.fr, S.fi, -1);
  const e0 = S.B * S.B - 1;
  for (let i = 0; i < N; i++) S.u[i] = 0.15 * t[i];
  S.re.set(S.u);
  fft2(S.re, S.im, -1);
  for (let k = 0; k < 120; k++) advance(S, 0.5, e0);
  grad(S);
  params.s = S;
}

// One semi-implicit step of du/dt = eps u - (1 + lap)^2 u + g u^2 - u^3 (the wavenumber is scaled so the critical one is 1).
function advance(S, dt, eps) {
  const fk = FORCE * sm((eps + 0.005) / 0.03);
  const u = S.u, nr = S.nr, ni = S.ni, re = S.re, im = S.im, q2 = S.q2, fr = S.fr, fi = S.fi;
  for (let i = 0; i < N; i++) {
    const v = u[i];
    nr[i] = G2 * v * v - v * v * v + STAB * v;
    ni[i] = 0;
  }
  fft2(nr, ni, -1);
  for (let i = 0; i < N; i++) {
    const d = 1 + dt * (q2[i] - eps);
    re[i] = (re[i] + dt * (nr[i] + fk * fr[i])) / d;
    im[i] = (im[i] + dt * (ni[i] + fk * fi[i])) / d;
  }
  nr.set(re);
  ni.set(im);
  fft2(nr, ni, 1);
  u.set(nr);
}

// The slope of the surface, per LED, from the spectrum: both components in one inverse transform.
function grad(S) {
  const { re, im, kx, ky, cr, ci } = S;
  for (let i = 0; i < N; i++) {
    cr[i] = -kx[i] * im[i] - ky[i] * re[i];
    ci[i] = kx[i] * re[i] - ky[i] * im[i];
  }
  fft2(cr, ci, 1);
  S.gx.set(cr);
  S.gy.set(ci);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.hand = cl(kv[2], 0, 1);
  S.lamp = cl(kv[3], 0, 1);
  const c = (d * S.speed) / 2;
  S.tt += c;
  const P = 40, p = (((S.tt + 26.6) / P) % 1 + 1) % 1, tri = 1 - abs(2 * p - 1);
  const auto = 0.84 + 0.46 * (0.7 * tri + 0.3 * (0.5 - 0.5 * cos(PI * tri)));
  S.Bt = S.hand < 0.04 ? auto : 0.7 + (0.8 * (S.hand - 0.04)) / 0.96;
  S.B += (S.Bt - S.B) * (1 - exp(-d * 6));
  const eps = S.B * S.B - 1, ds = 15 * c, n = max(1, Math.ceil(ds / 0.5));
  for (let k = 0; k < n; k++) advance(S, ds / n, eps);
  grad(S);
  let a = 0, b = 0;
  for (let i = 0; i < N; i++) (a += S.u[i]), (b += S.u[i] * S.u[i]);
  S.rms = sqrt(max(0, b / N - (a / N) * (a / N)));
  S.tacc += c;
  if (S.tacc >= 0.25) {
    S.tacc = 0;
    S.trail.copyWithin(1, 0);
    S.trail[0] = S.B;
  }
}

// Digits 3 wide and 5 tall, copied from edit-distance.js, for the field readout.
const DIG = ["###|#.#|#.#|#.#|###", ".#.|##.|.#.|.#.|###", "###|..#|###|#..|###", "###|..#|###|..#|###", "#.#|#.#|###|..#|..#", "###|#..|###|..#|###", "###|#..|###|#.#|###", "###|..#|..#|.#.|.#.", "###|#.#|###|#.#|###", "###|#.#|###|..#|###"].map((d) => d.replace(/\|/g, "").split("").map((c) => c === "#"));
// The gauge: a strip down the right edge, B from 0.70 to 1.50 of the critical field, top to bottom.
const GX = 61, GY0 = 8, GY1 = 121, BLO = 0.7, BHI = 1.5, B_ON = 1.0, B_OFF = 0.93;
const PW = 0.3, ZS = 17, U0 = 2.4, DL = 0.15, WG = 1.0, WF = 0.3, WH = 0.3, WT = 0.8, FL = 0.16, TILT = 0.7, DY = 0.5, NS = 520;
const gy = (b) => GY1 - ((cl(b, BLO, BHI) - BLO) / (BHI - BLO)) * (GY1 - GY0);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const u = S.u, gx = S.gx, gyy = S.gy, rgb = S.rgb;
  let um = 0.05;
  for (let i = 0; i < N; i++) if (u[i] > um) um = u[i];
  const amp = sm((um - 0.15) / 0.8), hb = wheel(S.hue);
  const key = hsv(hb, 0.5, 1, [0, 0, 0]), fillc = hsv(hb + 0.16, 0.6, 1, [0, 0, 0]), body = hsv(hb, 0.9, 1, [0, 0, 0]);
  const sway = 0.5 * sin((2 * PI * S.tt) / 23);
  const az = 2 * PI * (S.lamp - 0.06) + 2.4 + sway, zen = 1.0, az2 = az + PI + 0.6, zen2 = 1.1;
  const l1x = sin(zen) * cos(az), l1y = sin(zen) * sin(az), l1z = cos(zen);
  const l2x = sin(zen2) * cos(az2), l2y = sin(zen2) * sin(az2), l2z = cos(zen2);
  const ux = cos(az), uy = sin(az);
  // The camera looks down at the pool from the bottom of the panel, TILT off the vertical.
  const CT = cos(TILT), ST = sin(TILT);
  const v1x = l1x, v1y = l1y + ST, v1z = l1z + CT, h1 = 1 / sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const v2x = l2x, v2y = l2y + ST, v2z = l2z + CT, h2l = 1 / sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  const ZV = pow(U0 + 0.5 + DL, PW);
  rgb.fill(0);
  for (let x = 0; x < W; x++) {
    let ybuf = H;
    for (let k = 0; k < NS && ybuf > 0; k++) {
      const yg = 128 - k * DY, ym = ((yg % H) + H) % H, i0 = floor(ym), fr = ym - i0, j0 = i0 * W + x, j1 = (((i0 + 1) % H) * W) + x;
      const uu = u[j0] + (u[j1] - u[j0]) * fr, q = U0 - uu + DL, qp = pow(q, PW);
      const z = ZS * (ZV - qp), den = (ZS * PW * qp) / q;
      const zx = den * (gx[j0] + (gx[j1] - gx[j0]) * fr), zy = den * (gyy[j0] + (gyy[j1] - gyy[j0]) * fr);
      const ys = 127.5 - (128 - yg) * CT - z * ST;
      if (ys >= ybuf) continue;
      const nz = 1 / sqrt(1 + zx * zx + zy * zy), nx = -zx * nz, ny = -zy * nz;
      let ndh = (nx * v1x + ny * v1y + nz * v1z) * h1;
      ndh = ndh > 0 ? ndh : 0;
      let g1 = ndh * ndh;
      const broad = g1 * g1;
      g1 *= g1;
      g1 *= g1;
      g1 *= g1;
      g1 *= g1;
      g1 *= g1;
      ndh = (nx * v2x + ny * v2y + nz * v2z) * h2l;
      ndh = ndh > 0 ? ndh : 0;
      let g2 = ndh * ndh;
      g2 *= g2;
      g2 *= g2;
      g2 *= g2;
      g2 *= g2;
      const hr = uu > 0 ? uu / um : 0, h2 = hr * hr, tip = sm((hr - 0.74) / 0.22) * amp;
      const fog = 0.45 + 0.55 * cl(ys / 128, 0, 1);
      const n3 = nz * nz * nz, sky = 0.012 + FL * n3 * n3 * pow(1 - ys / 128, 1.4) * (0.8 + 0.2 * ux * (x - 32) / 32);
      const vb = sky + WH * broad * (0.3 + 0.7 * amp) + 0.4 * h2 * h2 * hr * amp;
      const r = fog * (vb * body[0] * 0.8 + (WG * g1 + WT * tip * tip) * key[0] + WF * g2 * fillc[0]);
      const g = fog * (vb * body[1] * 0.8 + (WG * g1 + WT * tip * tip) * key[1] + WF * g2 * fillc[1]);
      const b = fog * (vb * body[2] * 0.8 + (WG * g1 + WT * tip * tip) * key[2] + WF * g2 * fillc[2]);
      // This sample shows from its top edge ys down to what is already drawn in front of it.
      const top = ys > 0 ? ys : 0;
      for (let row = floor(top); row < ybuf && row < H; row++) {
        const cov = min(row + 1, ybuf) - max(row, top);
        if (cov <= 0) continue;
        const o = (row * W + x) * 3;
        rgb[o] += r * cov;
        rgb[o + 1] += g * cov;
        rgb[o + 2] += b * cov;
      }
      ybuf = ys;
    }
  }
  // The gauge, over a darkened strip, and the field in hundredths of the critical one.
  const put = (x, yy, c, a) => {
    if (x < 0 || x >= W || yy < 0 || yy >= H || a <= 0) return;
    const o = (yy * W + x) * 3;
    for (let k = 0; k < 3; k++) rgb[o + k] += (c[k] - rgb[o + k]) * min(1, a);
  };
  const dark = [0, 0, 0], pale = hsv(hb, 0.2, 1, [0, 0, 0]), lamp = hsv(hb, 0.6, 1, [0, 0, 0]);
  for (let yy = 0; yy < H; yy++) for (let x = GX - 1; x < W; x++) put(x, yy, dark, 0.8);
  for (let x = 47; x < GX - 1; x++) for (let yy = 0; yy < 8; yy++) put(x, yy, dark, 0.8);
  const on = sm((S.rms - 0.05) / 0.3);
  for (let yy = GY0; yy <= GY1; yy++) put(GX + 1, yy, lamp, 0.18);
  for (let yy = round(gy(B_ON)); yy <= round(gy(B_OFF)); yy++) put(GX + 2, yy, lamp, 0.55);
  for (let x = GX - 1; x < W; x++) put(x, round(gy(B_ON)), pale, 0.95);
  for (let x = GX; x < W - 1; x++) put(x, round(gy(B_OFF)), lamp, 0.7);
  for (let k = 0; k < S.trail.length; k++) put(GX + 1, round(gy(S.trail[k])), lamp, 0.45 * (1 - k / S.trail.length));
  const my = round(gy(S.B)), mc = [lamp[0] + (1 - lamp[0]) * on, lamp[1] + (1 - lamp[1]) * on, lamp[2] + (1 - lamp[2]) * on];
  for (let k = 0; k < 3; k++) put(GX + k, my, mc, 1);
  put(GX + 1, my - 1, mc, 1);
  put(GX + 2, my - 1, mc, 1);
  put(GX + 1, my + 1, mc, 1);
  put(GX + 2, my + 1, mc, 1);
  const pct = String(round(cl(S.B, 0, 9.99) * 100));
  for (let k = 0; k < pct.length; k++) {
    const gl = DIG[pct.charCodeAt(k) - 48];
    for (let q = 0; q < 15; q++) if (gl[q]) put(49 + k * 4 + (q % 3), 1 + floor(q / 3), on > 0.5 ? pale : lamp, 0.9);
  }
  for (let i = 0; i < N; i++) display.setPixel(i & 63, i >> 6, (255 * cl(rgb[i * 3], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 1], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 2], 0, 1)) | 0);
}
