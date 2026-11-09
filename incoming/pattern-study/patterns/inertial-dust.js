// ===== Patternflow pattern =====
// Title:   Inertial Dust
// Family:  particle
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   120
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.6..4, Scale=-1..1, Stokes=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Flow. draft
// Knob 3: Scale. draft
// Knob 4: Stokes. draft

const W = 64, H = 128, N = W * H;
const { floor, min, max, exp, sqrt, abs, cos, sin, PI, log, log2, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The panel is a periodic box 2 pi wide and 4 pi tall, one grid step 2 pi / 64 either way.
const KXC = 21, KYC = 42, DX = (2 * PI) / W;
const CFL = 0.8;
const KF0 = 6, BW = 0.2, TF = 0.3, FRMS = 0.42, MU = 0.01, NU = 12;
const NP = 65536;
const VAR = 0, RHO0 = 2.5, GM = 1.2, HZ = 0.12, TW = 0, RATE = 0.4, ST0 = 0.9, STR = 4.5, PRE = 25, SEEDK = 2, SEEDW = 1, SPIN = 10, SPINK = 0.06;

// ---- radix-2 FFT, in place on (re, im) at off, off + st, off + 2 st, ...
function plan(n) {
  const lg = log2(n), rev = new Uint16Array(n), c = new Float64Array(n >> 1), s = new Float64Array(n >> 1);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) r |= ((i >> b) & 1) << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n >> 1; i++) (c[i] = cos((2 * PI * i) / n)), (s[i] = sin((2 * PI * i) / n));
  return { n, rev, c, s, br: new Float64Array(n), bi: new Float64Array(n) };
}
function fft1(P, re, im, off, st, sign) {
  const { n, rev, c, s, br, bi } = P;
  for (let i = 0; i < n; i++) {
    const j = off + rev[i] * st;
    br[i] = re[j];
    bi[i] = im[j];
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let a0 = 0; a0 < n; a0 += size)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sign * s[t], a = a0 + k, b = a + half;
        const xr = br[b] * wr - bi[b] * wi, xi = br[b] * wi + bi[b] * wr;
        br[b] = br[a] - xr;
        bi[b] = bi[a] - xi;
        br[a] += xr;
        bi[a] += xi;
      }
  }
  for (let i = 0; i < n; i++) (re[off + i * st] = br[i]), (im[off + i * st] = bi[i]);
}
const COLS = [];
for (let x = 0; x < W; x++) if ((x < W / 2 ? x : W - x) <= KXC) COLS.push(x);
function fft2(S, re, im, sign) {
  if (sign < 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
  for (let t = 0; t < COLS.length; t++) fft1(S.py, re, im, COLS[t], W, sign);
  if (sign > 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
}

// Standard normal pair
function gauss2(out) {
  const r = sqrt(-2 * log(1 - Math.random())), a = 2 * PI * Math.random();
  out[0] = r * cos(a);
  out[1] = r * sin(a);
}

// ---- the carrier flow
// dw/dt = -div(u w) - MU w - NU (k/21)^8 w + f, u = (-psi_y, psi_x), w = lap psi
function tendency(S, sr, si, or, oi) {
  const { kx, ky, ik2, keep, neg, ar, ai, br, bi, gu, gv } = S, nk = keep.length;
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], r = sr[i] / N, m = si[i] / N, q = ik2[i];
    ar[i] = (kx[i] * r - ky[i] * m) * q;
    ai[i] = (ky[i] * r + kx[i] * m) * q;
    br[i] = r;
    bi[i] = m;
  }
  fft2(S, ar, ai, 1);
  fft2(S, br, bi, 1);
  let vmax = 0, wsum = 0;
  const gs = 1 / DX;
  for (let i = 0; i < N; i++) {
    const u = ar[i], v = ai[i], w = br[i];
    gu[i] = u * gs;
    gv[i] = v * gs;
    const sp = abs(u) + abs(v);
    if (sp > vmax) vmax = sp;
    wsum += w * w;
    ar[i] = u * w;
    ai[i] = v * w;
  }
  S.wrms = sqrt(wsum / N);
  fft2(S, ar, ai, -1);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], j = neg[i], cr = ar[i], ci = ai[i], dr = ar[j], di = ai[j], a = kx[i], b = ky[i];
    or[i] = 0.5 * (a * (ci - di) - b * (cr - dr));
    oi[i] = -0.5 * (a * (cr + dr) + b * (ci + di));
  }
  return vmax;
}

// Forcing: a unit complex Ornstein-Uhlenbeck amplitude zeta (fr, fi) on every mode between kappa 2.4
// and 12.5 that has a conjugate partner, and the force is N gc zeta, where gc is a bump about kf.
function forceStep(S, h) {
  const { fr, fi, fl, neg } = S, a = exp(-h / TF), b = sqrt(1 - a * a), g = [0, 0];
  for (let t = 0; t < fl.length; t++) {
    const i = fl[t], j = neg[i];
    gauss2(g);
    fr[i] = a * fr[i] + b * g[0];
    fi[i] = a * fi[i] + b * g[1];
    fr[j] = fr[i];
    fi[j] = -fi[i];
  }
}

// gc = c exp(-((|k| - kf) / (BW kf))^2), scaled so the forcing's grid variance is FRMS^2
function forceBand(S) {
  const { kk, keep, neg, gc, fl } = S, kf = S.kf;
  let z = 0;
  gc.fill(0);
  for (let t = 0; t < keep.length; t++) {
    const i = keep[t], q = (kk[i] - kf) / (BW * kf), g = exp(-q * q);
    if (g > 0.01) gc[i] = g;
  }
  for (let t = 0; t < fl.length; t++) z += gc[fl[t]] * gc[fl[t]];
  const c = (N * FRMS) / (2 * sqrt(z));
  for (let t = 0; t < keep.length; t++) gc[keep[t]] *= c;
}

function step(S, h) {
  const { wr, wi, nr, ni, p1r, p1i, p2r, p2i, lin, keep, fr, fi, gc } = S;
  forceStep(S, h);
  S.vmax = tendency(S, wr, wi, nr, ni);
  const nk = keep.length;
  const h1 = S.h1, h2 = S.h2;
  let c0 = h, c1 = 0, c2 = 0;
  if (h1 && h2) {
    const a = (h * h * h) / 3, b = (h * h) / 2;
    c0 = (a + (2 * h1 + h2) * b + h1 * (h1 + h2) * h) / (h1 * (h1 + h2));
    c1 = -(a + (h1 + h2) * b) / (h1 * h2);
    c2 = (a + h1 * b) / ((h1 + h2) * h2);
  } else if (h1) (c0 = h * (1 + h / (2 * h1))), (c1 = -(h * h) / (2 * h1));
  for (let t = 0; t < nk; t++) {
    const i = keep[t], e = exp(-h * lin[i]);
    const tr = nr[i] + gc[i] * fr[i], ti = ni[i] + gc[i] * fi[i];
    wr[i] = e * (wr[i] + c0 * tr + c1 * p1r[i] + c2 * p2r[i]);
    wi[i] = e * (wi[i] + c0 * ti + c1 * p1i[i] + c2 * p2i[i]);
    p2r[i] = e * p1r[i];
    p2i[i] = e * p1i[i];
    p1r[i] = e * tr;
    p1i[i] = e * ti;
  }
  S.h2 = h1;
  S.h1 = h;
}

// ---- the grains
function grains(S, h) {
  const { gx, gy, hx, hy, gu, gv, sl } = S;
  const a = 1 - exp(-h / S.tau);
  for (let i = 0; i < NP; i++) {
    let x = gx[i], y = gy[i];
    const i0 = x | 0, j0 = y | 0, fx = x - i0, fy = y - j0, i1 = (i0 + 1) & (W - 1), j1 = (j0 + 1) & (H - 1);
    const a00 = j0 * W + i0, a10 = j0 * W + i1, a01 = j1 * W + i0, a11 = j1 * W + i1;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const ux = gu[a00] * w00 + gu[a10] * w10 + gu[a01] * w01 + gu[a11] * w11;
    const uy = gv[a00] * w00 + gv[a10] * w10 + gv[a01] * w01 + gv[a11] * w11;
    let vx = hx[i], vy = hy[i];
    const dx = ux - vx, dy = uy - vy;
    sl[i] = dx * dx + dy * dy;
    vx += dx * a;
    vy += dy * a;
    hx[i] = vx;
    hy[i] = vy;
    x += vx * h;
    y += vy * h;
    if (x < 0) x += W;
    else if (x >= W) x -= W;
    if (y < 0) y += H;
    else if (y >= H) y -= H;
    gx[i] = x;
    gy[i] = y;
  }
}

function seed(S) {
  const { wr, wi, k2, mask } = S, k0 = S.kf / SEEDK;
  for (let i = 0; i < N; i++) (wr[i] = Math.random() * 2 - 1), (wi[i] = 0);
  fft2(S, wr, wi, -1);
  let z = 0;
  for (let i = 0; i < N; i++) {
    const q = k2[i] / (k0 * k0), a = mask[i] && k2[i] > 0 ? q * exp(-q) : 0;
    wr[i] *= a;
    wi[i] *= a;
    z += wr[i] * wr[i] + wi[i] * wi[i];
  }
  const g = (SEEDW * N) / sqrt(z);
  for (let i = 0; i < N; i++) (wr[i] *= g), (wi[i] *= g);
  S.h1 = S.h2 = 0;
  const gg = [0, 0], { fl, neg, fr, fi } = S;
  for (let t = 0; t < fl.length; t++) {
    const i = fl[t], j = neg[i];
    gauss2(gg);
    fr[i] = fr[j] = gg[0];
    fi[i] = gg[1];
    fi[j] = -gg[1];
  }
  forceBand(S);
}

export function setup(params) {
  const F = () => new Float64Array(N);
  const S = (params.s = {
    kf: KF0, tau: 1, t: 0, h1: 0, h2: 0, vmax: 1, vs: 1, wrms: 1, om: 1, ready: 0,
    px: plan(W), py: plan(H),
    kx: F(), ky: F(), k2: F(), kk: F(), ik2: F(), lin: F(), mask: new Uint8Array(N), neg: new Int32Array(N),
    wr: F(), wi: F(), nr: F(), ni: F(), p1r: F(), p1i: F(), p2r: F(), p2i: F(), ar: F(), ai: F(), br: F(), bi: F(), fr: F(), fi: F(), gc: F(), spin: 0, ks: 0,
    gu: new Float32Array(N), gv: new Float32Array(N),
    gx: new Float64Array(NP), gy: new Float64Array(NP), hx: new Float32Array(NP), hy: new Float32Array(NP), sl: new Float32Array(NP),
    D: new Float32Array(N), Q: new Float32Array(N),
  });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, jx = x < W / 2 ? x : x - W, jy = y < H / 2 ? y : y - H;
      S.kx[i] = jx;
      S.ky[i] = jy / 2;
      S.k2[i] = jx * jx + (jy * jy) / 4;
      S.kk[i] = sqrt(S.k2[i]);
      S.ik2[i] = S.k2[i] > 0 ? 1 / S.k2[i] : 0;
      S.mask[i] = abs(jx) <= KXC && abs(jy) <= KYC ? 1 : 0;
      S.neg[i] = ((H - y) % H) * W + ((W - x) % W);
      const q = S.k2[i] / (KXC * KXC);
      S.lin[i] = MU + NU * q * q * q * q;
    }
  const keep = [];
  for (let i = 0; i < N; i++) if (S.mask[i]) keep.push(i);
  S.keep = Int32Array.from(keep);
  const fl = [];
  for (const i of keep) if (S.kk[i] >= 2.4 && S.kk[i] <= 12.5 && S.neg[i] > i) fl.push(i);
  S.fl = Int32Array.from(fl);
}

function wrmsSpec(S) {
  const { wr, wi, keep } = S;
  let z = 0;
  for (let t = 0; t < keep.length; t++) z += wr[keep[t]] ** 2 + wi[keep[t]] ** 2;
  return sqrt(z) / N;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.6, 4);
  S.scale = cl(k[2], -1, 1);
  S.stokes = ST0 * pow(STR, cl(k[3], -1, 1));
  const kf = KF0 * pow(2, -0.5 * S.scale);
  if (!S.ready) {
    S.ready = 1;
    S.kf = S.ks = kf;
    seed(S);
    // flow alone first, at the largest step the speed limit allows, then the grains with it
    let t = 0;
    while (t < PRE) {
      const h = min(0.1, (CFL * DX) / max(1e-6, S.vmax));
      step(S, h);
      S.om += (wrmsSpec(S) - S.om) * min(1, h / 3);
      t += h;
    }
    for (let i = 0; i < NP; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      S.gx[i] = x;
      S.gy[i] = y;
      S.hx[i] = S.gu[(y | 0) * W + (x | 0)];
      S.hy[i] = S.gv[(y | 0) * W + (x | 0)];
    }
    S.tau = S.stokes / S.om;
    t = 0;
    while (t < 4 + 3 * S.stokes) {
      const h = min(0.1, (CFL * DX) / max(1e-6, S.vmax));
      step(S, h);
      S.om += (wrmsSpec(S) - S.om) * min(1, h / 3);
      S.tau = S.stokes / S.om;
      grains(S, h);
      t += h;
    }
  }
  const ft = cl(dt || 0, 0, 0.1);
  if (abs(log(kf / S.ks)) > SPINK && S.spin <= 0) {
    // a new scale: a fresh field at it, spun up four steps a frame so the new eddies are there in about a second
    S.kf = S.ks = kf;
    seed(S);
    S.spin = SPIN;
  } else if (kf !== S.kf) {
    S.kf = kf;
    forceBand(S);
  }
  let adv = ft * RATE * S.speed * (kf / KF0);
  if (adv <= 0) return;
  const hmax = (CFL * DX) / max(1e-6, S.vmax);
  let n = min(3, Math.ceil(adv / hmax)), h = adv / n;
  if (S.spin > 0) (n = 4), (h = min(0.1, hmax)), (adv = n * h), (S.spin -= adv);
  for (let j = 0; j < n; j++) {
    step(S, h);
    S.om += (wrmsSpec(S) - S.om) * min(1, h / 3);
    S.tau = S.stokes / S.om;
    grains(S, h);
  }
  S.t += adv;
}

// ---- colour: two ramps in Oklab, one for the strain side and one for the rotation side
const RGB = [0, 0, 0];
function lin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  RGB[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  RGB[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  RGB[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const inside = (e) => RGB[0] > -e && RGB[0] < 1 + e && RGB[1] > -e && RGB[1] < 1 + e && RGB[2] > -e && RGB[2] < 1 + e;
function okLab(L, a0, b0) {
  for (let i = 0; i <= 20; i++) {
    lin(L, a0 * (1 - i / 20), b0 * (1 - i / 20));
    if (i === 20 || inside(0.002)) return;
  }
}
const enc = (v) => ((((v = cl(v, 0, 1)) <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0);
// stops [v, L, C, hue degrees]
const RA = [[0, 0.14, 0.06, 272], [0.2, 0.34, 0.14, 268], [0.45, 0.6, 0.14, 240], [0.7, 0.84, 0.09, 205], [0.88, 0.93, 0.07, 95], [1, 0.99, 0.03, 100]];
const RB = [[0, 0.14, 0.06, 335], [0.2, 0.34, 0.14, 325], [0.45, 0.6, 0.14, 250], [0.7, 0.84, 0.09, 205], [0.88, 0.93, 0.07, 95], [1, 0.99, 0.03, 100]];
const NB = 128, NT = 17, LUT = new Uint8Array(NB * NT * 3);
function ramp(st, v, hue, o) {
  let j = 1;
  while (j < st.length - 1 && v > st[j][0]) j++;
  const A = st[j - 1], B = st[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
  const ha = ((A[3] + hue) * PI) / 180, hb = ((B[3] + hue) * PI) / 180;
  o[0] = A[1] + (B[1] - A[1]) * t;
  o[1] = A[2] * cos(ha) * (1 - t) + B[2] * cos(hb) * t;
  o[2] = A[2] * sin(ha) * (1 - t) + B[2] * sin(hb) * t;
}
const PA = [0, 0, 0], PB = [0, 0, 0];
function buildLut(hue) {
  for (let i = 0; i < NB; i++) {
    const v = i / (NB - 1);
    ramp(RA, v, hue * 360, PA);
    ramp(RB, v, hue * 360, PB);
    for (let k = 0; k < NT; k++) {
      const m = k / (NT - 1);
      okLab(PA[0] + (PB[0] - PA[0]) * m, PA[1] + (PB[1] - PA[1]) * m, PA[2] + (PB[2] - PA[2]) * m);
      const o = (i * NT + k) * 3;
      LUT[o] = enc(RGB[0]);
      LUT[o + 1] = enc(RGB[1]);
      LUT[o + 2] = enc(RGB[2]);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildLut(S.hue);
  const { gx, gy, D, Q, sl, gu, gv } = S;
  D.fill(0);
  Q.fill(0);
  for (let i = 0; i < NP; i++) {
    const x = gx[i], y = gy[i], i0 = x | 0, j0 = y | 0, fx = x - i0, fy = y - j0, i1 = (i0 + 1) & (W - 1), j1 = (j0 + 1) & (H - 1);
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy, s = sl[i];
    const a00 = j0 * W + i0, a10 = j0 * W + i1, a01 = j1 * W + i0, a11 = j1 * W + i1;
    D[a00] += w00;
    D[a10] += w10;
    D[a01] += w01;
    D[a11] += w11;
    Q[a00] += w00 * s;
    Q[a10] += w10 * s;
    Q[a01] += w01 * s;
    Q[a11] += w11 * s;
  }
  const mean = NP / N, om2 = S.om * S.om, hz = HZ + 0.4 * exp(-(S.stokes * S.stokes) / 0.12);
  for (let y = 0; y < H; y++) {
    const u1 = ((y + 1) & (H - 1)) * W, d1 = ((y - 1) & (H - 1)) * W, o = y * W;
    for (let x = 0; x < W; x++) {
      const i = o + x, r1 = (x + 1) & (W - 1), l1 = (x - 1) & (W - 1);
      const rho = D[i] / mean;
      // Okubo-Weiss: W = s_n^2 + s_s^2 - w^2 from the grid velocity (cells per model time)
      const ux = 0.5 * (gu[o + r1] - gu[o + l1]), vx = 0.5 * (gv[o + r1] - gv[o + l1]), uy = 0.5 * (gu[u1 + x] - gu[d1 + x]), vy = 0.5 * (gv[u1 + x] - gv[d1 + x]);
      const sn = ux - vy, ss = vx + uy, wz = vx - uy, OW = (sn * sn + ss * ss - wz * wz) / om2;
      let a = pow(1 - exp(-rho / RHO0), GM), t;
      if (VAR === 1) t = cl(0.5 + 0.5 * (sqrt(Q[i] / max(D[i], 0.05)) / (0.5 * sqrt(om2) * 3.0) - 0.3), 0, 1);
      else if (VAR === 2) t = cl(0.5 + 0.5 * (wz / sqrt(om2)) / 1.5, 0, 1);
      else t = 0.5 + 0.5 * Math.tanh(wz / (0.7 * sqrt(om2)));
      if (VAR !== 1) a = a + (1 - a) * hz * cl((abs(wz) / sqrt(om2) - 0.5) / 1.5, 0, 1);
      const j = ((a * (NB - 1) + 0.5) | 0) * NT * 3 + ((t * (NT - 1) + 0.5) | 0) * 3;
      display.setPixel(x, y, LUT[j], LUT[j + 1], LUT[j + 2]);
    }
  }
}
