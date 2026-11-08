// ===== Patternflow pattern =====
// Title:   Quantum Turbulence
// Family:  physics
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   115
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stir=1.6..2.8, Scale=-0.5..1, Damping=0.035..0.1
//
// Knob 1: Hue. draft
// Knob 2: Stir. draft
// Knob 3: Scale. draft
// Knob 4: Damping. draft

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, atan2, exp, min, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- radix-2 FFT ----------------------------------------------------------------------------
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), c = new Float64Array(n / 2), s = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) (c[i] = cos((TAU * i) / n)), (s[i] = -sin((TAU * i) / n));
  return { n, rev, c, s };
}
const PX = plan(W), PY = plan(H);
const TR = new Float64Array(H), TI = new Float64Array(H);

// In place on re[o .. o+n), im[o .. o+n). The forward transform is e^(-i k x); inv flips the sign
// and leaves the 1/n to the caller.
function fft(p, re, im, o, inv) {
  const { n, rev, c, s } = p, sg = inv ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[o + i];
      re[o + i] = re[o + j];
      re[o + j] = t;
      t = im[o + i];
      im[o + i] = im[o + j];
      im[o + j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = o; i < o + n; i += len)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sg * s[t], a = i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}
function fft2(re, im, inv) {
  for (let y = 0; y < H; y++) fft(PX, re, im, y * W, inv);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) (TR[y] = re[y * W + x]), (TI[y] = im[y * W + x]);
    fft(PY, TR, TI, 0, inv);
    for (let y = 0; y < H; y++) (re[y * W + x] = TR[y]), (im[y * W + x] = TI[y]);
  }
}

// ---- the fluid ------------------------------------------------------------------------------
const CS = 11; // sound speed, LEDs per second, whatever Scale is
const NS = 2; // split steps per frame
const DTP = 1 / (30 * NS); // panel seconds per step
const KC = TAU / 3; // k-space radius kept, the 2/3 rule for a cubic term
const NSP = 4;
const OPEN = [0, 2, 0, 0.06];

// Stirrers: heading and speed are sums of slow sines at rates that share no small integer ratio.
const SPH = [[0.0701, 0.116], [0.0932, 0.082], [0.1166, 0.0758], [0.0989, 0.0665]];
const SPS = [[0.2157, 0.2053], [0.2618, 0.2756], [0.2409, 0.2702], [0.2863, 0.2819]];
const SPV = [3.233, 2.987, 3.974, 3.2];

function setup(params) {
  const S = {
    t: 0, acc: 0, xi: 1.5, xt: 1.5, g: 0, mu: 0, gam: 0.06, dt: 0, kkey: "", nrm: 1, me: 0, hd: 0,
    re: new Float64Array(N), im: new Float64Array(N), V: new Float64Array(N),
    Kr: new Float64Array(N), Ki: new Float64Array(N), K2: new Float64Array(N), RR: new Float32Array(N),
    sx: new Float64Array(NSP), sy: new Float64Array(NSP), ph: new Float64Array(NSP * 4), gx: new Float64Array(64), gy: new Float64Array(64),
    U: 7, warm: false, hue: 0, uf: 3.6, x0: 1.5, wsp: 1.5, va: 3, pls: 0.35, nsp: NSP, eb: 0.65, em: 6,
  };
  if (params.tune) Object.assign(S, params.tune);
  for (let i = 0; i < S.ph.length; i++) S.ph[i] = Math.random() * TAU;
  for (let i = 0; i < NSP; i++) (S.sx[i] = Math.random() * W), (S.sy[i] = Math.random() * H);
  params.s = S;
  return S;
}

// Everything that depends on the healing length and the damping: g, the step, the k-space factor.
function constants(S) {
  const xi = S.xi;
  S.g = 1 / (2 * xi * xi);
  S.mu = S.g;
  if (!S.me) S.me = S.g;
  S.dt = (CS * sqrt(2) * xi) / 30 / NS; // model time per step: c dt per frame is CS/30 LEDs
  const key = S.dt + "," + S.gam;
  if (key === S.kkey) return;
  S.kkey = key;
  for (let y = 0; y < H; y++) {
    const ny = y < H / 2 ? y : y - H, ky = (TAU * ny) / H;
    for (let x = 0; x < W; x++) {
      const nx = x < W / 2 ? x : x - W, kx = (TAU * nx) / W, k2 = kx * kx + ky * ky, p = y * W + x;
      S.K2[p] = k2;
      if (k2 > KC * KC) {
        S.Kr[p] = 0;
        S.Ki[p] = 0;
      } else {
        const th = 0.5 * S.dt * k2, d = exp(-S.gam * th);
        S.Kr[p] = d * cos(th);
        S.Ki[p] = -d * sin(th);
      }
    }
  }
}

// One step: free flight in k space, then the kick of the potential and the g |psi|^2 term.
function step(S) {
  const { re, im, V, Kr, Ki, K2 } = S;
  fft2(re, im, false);
  const n0 = S.nrm, sc = n0 / N;
  let tk = 0;
  for (let p = 0; p < N; p++) {
    const a = re[p], b = im[p], kr = Kr[p] * sc, ki = Ki[p] * sc;
    tk += K2[p] * (a * a + b * b);
    re[p] = a * kr - b * ki;
    im[p] = a * ki + b * kr;
  }
  fft2(re, im, true);
  const g = S.g, me = S.me, dt = S.dt, gd = S.gam * dt;
  let sum = 0, sv = 0, sg = 0;
  for (let p = 0; p < N; p++) {
    const a = re[p], b = im[p], r = a * a + b * b, U = V[p] + g * r - me, th = dt * U, c = cos(th), s = sin(th), f = 1 - gd * U;
    const na = f * (a * c + b * s), nb = f * (b * c - a * s);
    re[p] = na;
    im[p] = nb;
    sum += na * na + nb * nb;
    sv += V[p] * r;
    sg += r * r;
  }
  S.nrm = sqrt(N / sum);
  // the chemical potential of the state per unit of mass: kinetic + potential + g rho^2
  S.me = (0.5 * tk * n0 * n0 / N + sv + g * sg) / sum;
}

// Move the stirrers by h seconds and lay their Gaussians into V.
function spots(S, h) {
  const V = S.V, w = S.wsp * S.xi, v0 = S.va * S.mu, t = S.t, gx = S.gx, gy = S.gy, R = Math.ceil(3.2 * w);
  V.fill(0);
  for (let i = 0; i < S.nsp; i++) {
    const a = SPH[i], b = SPS[i], o = i * 4, q = S.ph;
    const th = i * 2.1 + 2.2 * sin(a[0] * t + q[o]) + 1.3 * sin(a[1] * t + q[o + 1]);
    const sp = S.U * (1 + 0.3 * sin(b[0] * t + q[o + 2]) + 0.2 * sin(b[1] * t + q[o + 3]));
    S.sx[i] = (S.sx[i] + sp * cos(th) * h + W) % W;
    S.sy[i] = (S.sy[i] + sp * sin(th) * h + H) % H;
    const amp = v0 * (1 + S.pls * sin(SPV[i] * t + q[o]));
    const cx = floor(S.sx[i]), cy = floor(S.sy[i]);
    for (let d = -R; d <= R; d++) {
      const dx = cx + d - S.sx[i], dy = cy + d - S.sy[i];
      gx[d + R] = exp(-(dx * dx) / (2 * w * w));
      gy[d + R] = exp(-(dy * dy) / (2 * w * w));
    }
    for (let dy = -R; dy <= R; dy++) {
      const y = (cy + dy + H) % H;
      for (let dx = -R; dx <= R; dx++) {
        const x = (cx + dx + W) % W;
        V[y * W + x] += amp * gx[dx + R] * gy[dy + R];
      }
    }
  }
}

// Vortex dipoles imprinted with the phase of the plane vortex and its eight periodic images.
function imprint(S) {
  const xi = S.xi, vs = [], nd = Math.round(13 * (1.5 / xi) * (1.5 / xi));
  for (let d = 0; d < nd; d++) {
    const cx = Math.random() * W, cy = Math.random() * H, an = Math.random() * TAU, sep = 6 + 8 * Math.random(), sg = Math.random() < 0.5 ? 1 : -1;
    vs.push([cx + 0.5 * sep * cos(an), cy + 0.5 * sep * sin(an), sg], [cx - 0.5 * sep * cos(an), cy - 0.5 * sep * sin(an), -sg]);
  }
  let sum = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ph = 0, rho = 1;
      for (const [vx, vy, sg] of vs) {
        for (let my = -1; my <= 1; my++)
          for (let mx = -1; mx <= 1; mx++) ph += sg * atan2(y - vy - my * H, x - vx - mx * W);
        let dx = x - vx, dy = y - vy;
        dx -= W * Math.round(dx / W);
        dy -= H * Math.round(dy / H);
        const r2 = dx * dx + dy * dy;
        rho *= r2 / (r2 + 2 * xi * xi);
      }
      const p = y * W + x, a = sqrt(rho);
      S.re[p] = a * cos(ph);
      S.im[p] = a * sin(ph);
      sum += rho;
    }
  const s = sqrt(N / sum);
  for (let p = 0; p < N; p++) (S.re[p] *= s), (S.im[p] *= s);
  S.nrm = 1;
}

function advance(S, ft, k) {
  S.hue = cl(k[0], 0, 1);
  S.U = S.uf * cl(k[1], 0.2, 5);
  S.xt = S.x0 * pow(1.6, cl(k[2], -1, 1));
  S.gam = cl(k[3], 0, 0.5);
  S.xi += (S.xt - S.xi) * (1 - exp(-ft / 0.3));
  constants(S);
  S.hd += ft * (0.04 + 0.02 * sin(0.0731 * S.t) + 0.015 * sin(0.1913 * S.t + 1));
  S.acc = min(S.acc + ft + 1e-9, 8 * DTP);
  while (S.acc >= DTP) {
    S.acc -= DTP;
    S.t += DTP;
    spots(S, DTP);
    step(S);
  }
}

// ---- colour ---------------------------------------------------------------------------------
// The hue wheel, with blue pulled toward periwinkle so that it does not read as a hole.
const HL = 1024, HUE = new Float32Array(HL * 3);
for (let i = 0; i < HL; i++) {
  const h = i / HL, s = 1 - 0.38 * exp(-(((h - 0.665) / 0.06) ** 2)), q = (h * 6) % 6, f = q - floor(q), k = floor(q);
  const p = 1 - s, qq = 1 - f * s, tt = 1 - (1 - f) * s;
  HUE[i * 3] = k === 0 || k === 5 ? 1 : k === 1 ? qq : k === 4 ? tt : p;
  HUE[i * 3 + 1] = k === 1 || k === 2 ? 1 : k === 0 ? tt : k === 3 ? qq : p;
  HUE[i * 3 + 2] = k === 3 || k === 4 ? 1 : k === 2 ? tt : k === 5 ? qq : p;
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  if (!S.warm) {
    S.warm = true;
    S.xi = S.xt = S.x0 * pow(1.6, cl(k[2], -1, 1));
    imprint(S);
    constants(S);
    for (let i = 0; i < 14; i++) advance(S, 1 / 30, [k[0], k[1], k[2], 0.4]);
    for (let i = 0; i < 70; i++) advance(S, 1 / 30, k);
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { re, im, RR } = S, h0 = S.hue + 0.55 + S.hd;
  // a reference wave tilted across the panel, turning slowly
  const ga = 0.9 * sin(0.0213 * S.t + S.ph[0]) + 0.6 * sin(0.0517 * S.t + S.ph[1]), gm = 1.1, gx = (gm * cos(ga)) / 64, gy = (gm * sin(ga)) / 64;
  for (let q = 0; q < N; q++) RR[q] = re[q] * re[q] + im[q] * im[q];
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const rho = RR[p];
      let hu = atan2(im[p], re[p]) / TAU + h0 + gx * (x - 31.5) + gy * (y - 63.5);
      hu -= floor(hu);
      const hi = ((hu * HL) | 0) * 3;
      let v = cl((rho - 0.03) / 0.47, 0, 1);
      v *= v * (3 - 2 * v);
      // sound ripples as relief, lit from the upper left
      const xp = y * W + (x + 1) % W, xm = y * W + (x + W - 1) % W, yp = ((y + 1) % H) * W + x, ym = ((y + H - 1) % H) * W + x;
      v *= cl(S.eb + S.em * (RR[xm] - RR[xp] + RR[ym] - RR[yp]), 0.25, 1.2);
      if (v > 1) v = 1;
      v *= 255;
      display.setPixel(x, y, v * HUE[hi], v * HUE[hi + 1], v * HUE[hi + 2]);
    }
}
