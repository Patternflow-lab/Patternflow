// ===== Patternflow pattern =====
// Title:   Kuppers-Lortz Domains
// Family:  physics
// Idea:    prototype
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: prototype
// Round:   124
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Rotation=-1..1
//
// Knob 1: x
// Knob 2: x
// Knob 3: x
// Knob 4: x

const W = 64, H = 128, N = W * H;
const GW = 32, GH = 64, GN = GW * GH; // the amplitudes live on a grid of 2 by 2 LEDs
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const CFG = {
  eps: 0.3, // distance above onset
  mu: 2.5, // (g+ - g0) / (g0 - g-)
  a0: 0.32, // 1 - g-/g0 at Rotation 0
  ar: 1.58, // and the ratio per unit of Rotation
  lam0: 7,
  lamr: 1.25,
  kc: 0.8, // cut wavenumber of the amplitudes, in units of q0
  noise: 0.035, // white noise per square root of model time, on the 2 by 2 LED grid, in the retained modes
  hmax: 0.5,
  v1: 1.25, // LEDs a second the front of an invader runs along its own roll normal at Flow 1 and Rotation 0
  pre: 300,
  modm: 0.0, // eps modulation depth
  theta0: 0.3, // direction of the first wavevector
};

// ---- Fourier transforms (radix-2, first two stages as radix-4) -----------------------------
function plan(n) {
  const sw = [], tw = new Float64Array(2 * n);
  let lg = 0;
  while (1 << lg < n) lg++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    if (r > i) sw.push(i, r);
  }
  for (let h = 1; h < n; h <<= 1)
    for (let k = 0; k < h; k++) {
      tw[2 * (h - 1 + k)] = cos((PI * k) / h);
      tw[2 * (h - 1 + k) + 1] = -sin((PI * k) / h);
    }
  return { n, sw: Int32Array.from(sw), tw };
}

function fft1(re, im, o, P) {
  const n = P.n, sw = P.sw, tw = P.tw;
  for (let p = 0; p < sw.length; p += 2) {
    const i = o + sw[p], j = o + sw[p + 1];
    let t = re[i];
    re[i] = re[j];
    re[j] = t;
    t = im[i];
    im[i] = im[j];
    im[j] = t;
  }
  for (let a = o; a < o + n; a += 4) {
    const x0r = re[a], x0i = im[a], x1r = re[a + 1], x1i = im[a + 1];
    const x2r = re[a + 2], x2i = im[a + 2], x3r = re[a + 3], x3i = im[a + 3];
    const t0r = x0r + x1r, t0i = x0i + x1i, t1r = x0r - x1r, t1i = x0i - x1i;
    const t2r = x2r + x3r, t2i = x2i + x3i, t3r = x2r - x3r, t3i = x2i - x3i;
    re[a] = t0r + t2r;
    im[a] = t0i + t2i;
    re[a + 2] = t0r - t2r;
    im[a + 2] = t0i - t2i;
    re[a + 1] = t1r + t3i;
    im[a + 1] = t1i - t3r;
    re[a + 3] = t1r - t3i;
    im[a + 3] = t1i + t3r;
  }
  for (let half = 4; half < n; half <<= 1) {
    const len = half << 1, w0 = 2 * (half - 1);
    for (let s = o; s < o + n; s += len)
      for (let k = 0; k < half; k++) {
        const a = s + k, b = a + half, c = tw[w0 + 2 * k], d = tw[w0 + 2 * k + 1];
        const br = re[b], bi = im[b], xr = br * c - bi * d, xi = br * d + bi * c, ar = re[a], ai = im[a];
        re[b] = ar - xr;
        im[b] = ai - xi;
        re[a] = ar + xr;
        im[a] = ai + xi;
      }
  }
}

// A complex 2D transform of a gw x gh array, row-major. inv = true is unnormalised.
function fft2set(gw, gh) {
  const PW = plan(gw), PH = plan(gh), CR = new Float64Array(gh), CI = new Float64Array(gh);
  return (re, im, inv) => {
    for (let y = 0; y < gh; y++) (inv ? fft1(im, re, y * gw, PW) : fft1(re, im, y * gw, PW));
    for (let x = 0; x < gw; x++) {
      for (let y = 0, p = x; y < gh; y++, p += gw) {
        CR[y] = re[p];
        CI[y] = im[p];
      }
      if (inv) fft1(CI, CR, 0, PH);
      else fft1(CR, CI, 0, PH);
      for (let y = 0, p = x; y < gh; y++, p += gw) {
        re[p] = CR[y];
        im[p] = CI[y];
      }
    }
  };
}
const FG = fft2set(GW, GH), FL = fft2set(W, H);

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- the state -----------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const lamOf = (s) => CFG.lam0 * pow(CFG.lamr, cl(s, -1, 1));
const aOf = (s) => CFG.a0 * pow(CFG.ar, cl(s, -1, 1));

const DIR = [0, 1, 2].map((j) => [cos(CFG.theta0 + (TAU * j) / 3), sin(CFG.theta0 + (TAU * j) / 3)]);

function start(params, k) {
  const vec = () => new Float64Array(GN);
  const S = {
    ar: [vec(), vec(), vec()], ai: [vec(), vec(), vec()],
    tr: vec(), ti: vec(),
    E: [vec(), vec(), vec()], eh: -1, lam: -1,
    kx: vec(), ky: vec(),
    keep: new Int32Array(GN), nk: 0,
    lam: -1, a: 0, t: 0, hue: 0,
    gp: 0, gm: 0,
  };
  params.s = S;
  prepare(S, lamOf(k[2]), aOf(k[3]));
  // a smooth random start: three random fields on the first modes, amplitudes of a few per cent of sqrt(eps)
  for (let j = 0; j < 3; j++) {
    for (let q = 0; q < GN; q++) {
      S.tr[q] = 0;
      S.ti[q] = 0;
    }
    for (let jy = 0; jy < GH; jy++)
      for (let jx = 0; jx < GW; jx++) {
        const q = jy * GW + jx;
        const kk = sqrt(S.kx[q] * S.kx[q] + S.ky[q] * S.ky[q]);
        if (kk > 0.5) continue;
        S.tr[q] = gauss();
        S.ti[q] = gauss();
      }
    FG(S.tr, S.ti, true);
    let m = 0;
    for (let q = 0; q < GN; q++) m += S.tr[q] * S.tr[q] + S.ti[q] * S.ti[q];
    m = sqrt(m / GN);
    for (let q = 0; q < GN; q++) {
      S.ar[j][q] = (0.5 * sqrt(CFG.eps) * S.tr[q]) / m;
      S.ai[j][q] = (0.5 * sqrt(CFG.eps) * S.ti[q]) / m;
    }
  }
  advance(S, CFG.pre, CFG.hmax);
}

function prepare(S, lam, a) {
  S.a = a;
  S.gm = 1 - a;
  S.gp = 1 + CFG.mu * a;
  if (lam === S.lam) return;
  S.lam = lam;
  for (let jy = 0; jy < GH; jy++)
    for (let jx = 0; jx < GW; jx++) {
      const m = jx < GW / 2 ? jx : jx - GW, n = jy < GH / 2 ? jy : jy - GH;
      S.kx[jy * GW + jx] = (lam * m) / 64;
      S.ky[jy * GW + jx] = (lam * n) / 128;
    }
  S.eh = -1;
  let c = 0;
  for (let q = 0; q < GN; q++) if (S.kx[q] * S.kx[q] + S.ky[q] * S.ky[q] <= CFG.kc * CFG.kc) S.keep[c++] = q;
  S.nk = c;
}

function linear(S, h) {
  if (S.eh === h) return;
  S.eh = h;
  const norm = 1 / GN;
  for (let j = 0; j < 3; j++)
    for (let q = 0; q < GN; q++) {
      const kx = S.kx[q], ky = S.ky[q], k2 = kx * kx + ky * ky;
      if (k2 > CFG.kc * CFG.kc) {
        S.E[j][q] = 0;
        continue;
      }
      const s = DIR[j][0] * kx + DIR[j][1] * ky + 0.5 * k2;
      S.E[j][q] = exp(-h * s * s) * norm;
    }
}

// pointwise: A_j' = A_j (eps - |A_j|^2 - g+ |A_j+1|^2 - g- |A_j-1|^2)
function local(S, tau) {
  const { ar, ai, gp, gm } = S, e = CFG.eps;
  const a0 = ar[0], b0 = ai[0], a1 = ar[1], b1 = ai[1], a2 = ar[2], b2 = ai[2];
  for (let q = 0; q < GN; q++) {
    const i0 = a0[q] * a0[q] + b0[q] * b0[q], i1 = a1[q] * a1[q] + b1[q] * b1[q], i2 = a2[q] * a2[q] + b2[q] * b2[q];
    const r0 = e - i0 - gp * i1 - gm * i2, r1 = e - i1 - gp * i2 - gm * i0, r2 = e - i2 - gp * i0 - gm * i1;
    const h = 0.5 * tau;
    const j0 = i0 * exp(2 * h * r0), j1 = i1 * exp(2 * h * r1), j2 = i2 * exp(2 * h * r2);
    const s0 = e - j0 - gp * j1 - gm * j2, s1 = e - j1 - gp * j2 - gm * j0, s2 = e - j2 - gp * j0 - gm * j1;
    const f0 = exp(tau * s0), f1 = exp(tau * s1), f2 = exp(tau * s2);
    a0[q] *= f0;
    b0[q] *= f0;
    a1[q] *= f1;
    b1[q] *= f1;
    a2[q] *= f2;
    b2[q] *= f2;
  }
}

function step(S, h) {
  linear(S, h);
  local(S, 0.5 * h);
  const { tr, ti, keep, nk } = S;
  const sn = (CFG.noise * sqrt(h)) / sqrt(GN);
  for (let j = 0; j < 3; j++) {
    const ar = S.ar[j], ai = S.ai[j], E = S.E[j];
    tr.set(ar);
    ti.set(ai);
    FG(tr, ti, false);
    for (let q = 0; q < GN; q++) {
      tr[q] *= E[q];
      ti[q] *= E[q];
    }
    if (sn > 0)
      for (let c = 0; c < nk; c++) {
        const q = keep[c];
        tr[q] += sn * gauss();
        ti[q] += sn * gauss();
      }
    FG(tr, ti, true);
    ar.set(tr);
    ai.set(ti);
  }
  local(S, 0.5 * h);
  S.t += h;
}

function advance(S, Ht, hmax) {
  const n = max(1, ceil(Ht / hmax - 1e-9)), h = Ht / n;
  for (let i = 0; i < n; i++) step(S, h);
}

export function setup(params) {
  start(params, OPEN);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  prepare(S, lamOf(k[2]), aOf(k[3]));
  const ell = S.lam / TAU, tps = (CFG.v1 * cl(k[1], 0.5, 3)) / (2 * sqrt(CFG.eps * CFG.a0) * ell);
  advance(S, ft * tps, CFG.hmax);
  // Never reached in the runs in the header. If the amplitudes ever went bad, start over.
  if (!(S.ar[0][0] * S.ar[0][0] + S.ai[1][GN >> 1] * S.ai[1][GN >> 1] < 100 * CFG.eps)) {
    params.s = null;
    update(dt, input, params);
  }
}

// ---- colour --------------------------------------------------------------------------------
function okRgb(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r;
      out[1] = g;
      out[2] = bb;
      return;
    }
  }
}
const enc = (v) => {
  v = cl(v, 0, 1);
  return (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255;
};
const RGB = [0, 0, 0];

const HUE0 = 75; // Oklab hue of orientation 0 at Knob 1 = 0, degrees
const NT = 128;
function buildLut(S, hue) {
  S.lutHue = hue;
  if (!S.lut) S.lut = new Float64Array(4 * NT * 3);
  for (let j = 0; j < 4; j++) {
    const h = HUE0 + 120 * j + 360 * hue, grey = j === 3;
    for (let i = 0; i < NT; i++) {
      const t = i / (NT - 1);
      const L = 0.1 + 0.78 * pow(t, 0.9), C = 0.16 * sm(0.03, 0.55, t) * (1 - 0.35 * sm(0.75, 1, t));
      okRgb(L, grey ? 0 : C, h, RGB);
      const o = (j * NT + i) * 3;
      S.lut[o] = enc(RGB[0]);
      S.lut[o + 1] = enc(RGB[1]);
      S.lut[o + 2] = enc(RGB[2]);
    }
  }
}

const PR = [new Float64Array(N), new Float64Array(N), new Float64Array(N)], PI_ = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];

// A_j on the LEDs by zero padding the spectrum of the grid
function upsample(S) {
  const { tr, ti } = S;
  for (let j = 0; j < 3; j++) {
    tr.set(S.ar[j]);
    ti.set(S.ai[j]);
    FG(tr, ti, false);
    const re = PR[j], im = PI_[j];
    re.fill(0);
    im.fill(0);
    const sc = 1 / GN;
    for (let jy = 0; jy < GH; jy++) {
      const m = jy < GH / 2 ? jy : jy - GH, Y = (m + H) % H;
      for (let jx = 0; jx < GW; jx++) {
        const n = jx < GW / 2 ? jx : jx - GW, X = (n + W) % W;
        if (jx === GW / 2 || jy === GH / 2) continue;
        re[Y * W + X] = tr[jy * GW + jx] * sc;
        im[Y * W + X] = ti[jy * GW + jx] * sc;
      }
    }
    FL(re, im, true);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.hue, 0, 1);
  if (S.lutHue !== hue || !S.lut) buildLut(S, hue);
  upsample(S);
  const q = TAU / S.lam, lut = S.lut, ref = 1.5 / (2 * sqrt(CFG.eps));
  const [d0, d1, d2] = DIR;
  const dc0 = cos(q * d0[0]), ds0 = sin(q * d0[0]), dc1 = cos(q * d1[0]), ds1 = sin(q * d1[0]), dc2 = cos(q * d2[0]), ds2 = sin(q * d2[0]);
  const A0r = PR[0], A0i = PI_[0], A1r = PR[1], A1i = PI_[1], A2r = PR[2], A2i = PI_[2];
  for (let y = 0; y < H; y++) {
    // the carrier of each orientation along the row, by rotating a unit vector one LED at a time
    const yy = y - 63.5;
    let p0 = q * (-31.5 * d0[0] + yy * d0[1]), p1 = q * (-31.5 * d1[0] + yy * d1[1]), p2 = q * (-31.5 * d2[0] + yy * d2[1]);
    let c0 = cos(p0), s0 = sin(p0), c1 = cos(p1), s1 = sin(p1), c2 = cos(p2), s2 = sin(p2);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const a0 = A0r[p], b0 = A0i[p], a1 = A1r[p], b1 = A1i[p], a2 = A2r[p], b2 = A2i[p];
      const U = 2 * (a0 * c0 - b0 * s0 + a1 * c1 - b1 * s1 + a2 * c2 - b2 * s2);
      const i0 = a0 * a0 + b0 * b0, i1 = a1 * a1 + b1 * b1, i2 = a2 * a2 + b2 * b2;
      const w0 = i0 * i0, w1 = i1 * i1, w2 = i2 * i2, inv = 1 / (w0 + w1 + w2 + 1e-12);
      const t = 0.5 + 0.5 * tanh(U * ref), i = (t * (NT - 1)) | 0;
      // the length of the three weights summed on the colour wheel: 1 in one orientation's domain, 0 where all three are equal
      const vx = (w0 - 0.5 * (w1 + w2)) * inv, vy = 0.8660254 * (w1 - w2) * inv, m = vx * vx + vy * vy;
      const o0 = i * 3, o1 = (NT + i) * 3, o2 = (2 * NT + i) * 3, o3 = (3 * NT + i) * 3, f0 = w0 * inv * m, f1 = w1 * inv * m, f2 = w2 * inv * m, f3 = 1 - m;
      display.setPixel(
        x,
        y,
        (lut[o0] * f0 + lut[o1] * f1 + lut[o2] * f2 + lut[o3] * f3 + 0.5) | 0,
        (lut[o0 + 1] * f0 + lut[o1 + 1] * f1 + lut[o2 + 1] * f2 + lut[o3 + 1] * f3 + 0.5) | 0,
        (lut[o0 + 2] * f0 + lut[o1 + 2] * f1 + lut[o2 + 2] * f2 + lut[o3 + 2] * f3 + 0.5) | 0,
      );
      let t0 = c0 * dc0 - s0 * ds0;
      s0 = s0 * dc0 + c0 * ds0;
      c0 = t0;
      t0 = c1 * dc1 - s1 * ds1;
      s1 = s1 * dc1 + c1 * ds1;
      c1 = t0;
      t0 = c2 * dc2 - s2 * ds2;
      s2 = s2 * dc2 + c2 * ds2;
      c2 = t0;
    }
  }
}
