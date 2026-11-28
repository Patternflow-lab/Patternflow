// ===== Patternflow pattern =====
// Title:   Sabattier Print
// Family:  darkroom
// Idea:    A print is exposed to a few drifting soft lamps, developed part way, fogged with a second short flash and developed on, so the densest parts shade themselves from the flash and the thin parts take all of it, the tones fold over, bright glowing contours stand round every lamp and a thin Mackie line runs along each edge.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Sabattier effect, pseudo-solarisation (Armand Sabattier, 1862, from memory), characteristic curves of density against log exposure (Ferdinand Hurter and Vero Driffield, 1890, from memory), the Mackie line and the adjacency effect of development (Mackie, 1932, from memory), made famous by Man Ray and Lee Miller; original code, pattern round 274
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Tone=0..1, Flash=0..4, Develop=-1..1, Adjacency=-1..1
//
// Knob 1: Tone.
// Knob 2: Flash.
// Knob 3: Develop.
// Knob 4: Adjacency.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, pow, ceil, PI } = Math;
const TAU = 2 * PI;
const LOG10E = 1 / Math.LN10;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---------------------------------------------------------------- buffers
const LG = new Float32Array(N);     // log10 of the relative exposure of the first picture
const DF = new Float32Array(N);     // the density the first exposure alone would reach, developed to the end
const D1 = new Float32Array(N);     // the density after the first development, adjacency included
const TA = new Float32Array(N), TB = new Float32Array(N);
const PAD = new Float32Array(W + 64);
const NL = 7, NB = 2;
const GX = new Float32Array(NL * W), GY = new Float32Array(NL * H);
const AY = new Float32Array(NL);
const SX = new Float32Array(W), CX = new Float32Array(W), SY = new Float32Array(H), CY = new Float32Array(H);
const KER = new Float32Array(16);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// look-up tables
const LN = 1024;
const L_LO = -3.2, L_HI = 1.8, L_SC = (LN - 1) / (L_HI - L_LO);
const LUT_DF = new Float32Array(LN + 1), LUT_D1 = new Float32Array(LN + 1);
const ZN = 1024, Z_LO = -3, Z_HI = 3, Z_SC = (ZN - 1) / (Z_HI - Z_LO);
const LUT_F = new Float32Array(ZN + 1);
const RN = 768;
const RAMP = new Float32Array((RN + 1) * 3);

const DMAX = 3.0;        // the densest the paper goes
const LC = -0.15;        // log exposure at the middle of the curve
const D_DEEP = 3.15;     // the density that shows as the deepest shadow
const D_PALE = -0.3;     // a density below the paper's own, which only the Mackie line reaches, shows as the palest highlight
const U_SC = 1 / (D_DEEP - D_PALE);

const sig = (z) => 1 / (1 + exp(-z));

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- state
export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const lamps = [];
  for (let i = 0; i < NL; i++) {
    const big = i < 5;
    lamps.push({
      cx: 8 + 48 * ((i * 0.618 + 0.13 + 0.2 * r()) % 1), cy: 12 + 104 * ((i * 0.382 + 0.05 + 0.2 * r()) % 1),
      ax: 8 + 12 * r(), ay: 16 + 26 * r(),
      wx1: 0.03 + 0.12 * r(), wx2: 0.02 + 0.07 * r(), wy1: 0.025 + 0.1 * r(), wy2: 0.015 + 0.06 * r(),
      px1: TAU * r(), px2: TAU * r(), py1: TAU * r(), py2: TAU * r(),
      sx: big ? 8 + 9 * r() : 5 + 3 * r(), sy: big ? 12 + 16 * r() : 7 + 5 * r(),
      ws: 0.02 + 0.05 * r(), ps: TAU * r(),
      a0: big ? 0.9 + 2.2 * r() : 0.8 + 1.2 * r(), wa: 0.02 + 0.06 * r(), pa: TAU * r(),
    });
  }
  const bands = [];
  for (let i = 0; i < NB; i++) {
    bands.push({
      th: TAU * r(), wth: 0.011 + 0.017 * r(), ath: 0.7, pth: TAU * r(),
      ao: 26 + 14 * r(), wo: 0.03 + 0.05 * r(), po: TAU * r(), wo2: 0.013 + 0.02 * r(), po2: TAU * r(),
      w: 5 + 5 * r(), a0: 0.6 + 1.4 * r(), wa: 0.02 + 0.05 * r(), pa: TAU * r(),
    });
  }
  const st = {
    th: TAU * r(), wth: 0.013 + 0.01 * r(), pth: TAU * r(), P: 24 + 8 * r(), wP: 0.011 + 0.01 * r(), pP: TAU * r(),
    ph: TAU * r(), wph: 0.2 + 0.12 * r(),
    ex: 31 + 10 * r(), ey: 40 + 20 * r(), ax: 14, ay: 26, wx1: 0.037 + 0.02 * r(), wy1: 0.029 + 0.02 * r(), wx2: 0.0143, wy2: 0.0111, px: TAU * r(), py: TAU * r(), px2: TAU * r(), py2: TAU * r(),
    sx: 22 + 6 * r(), sy: 34 + 12 * r(), a0: 2.0 + 0.8 * r(), wa: 0.027 + 0.02 * r(), pa: TAU * r(),
    wk: [TAU * r(), TAU * r(), TAU * r(), TAU * r()],
  };
  params.s = {
    t: 24 * r(), k: null, lamps, bands, st,
    gph: TAU * r(), gps: TAU * r(), gpl: TAU * r(), gpa: TAU * r(),
    lutK3: -9, rampK1: -9, dtl: 1 / 30, mu: undefined, sd: 0,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.2);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  S.t += d * 1.3;
  S.dtl = d;
}

// ---------------------------------------------------------------- the toning ramp
// OKLab lightness runs from a deep jewel shadow to a pale highlight; the hue of the shadow and of the highlight
// are the two tones, and K1 walks them round a table of pairs (hue in degrees of OKLCH)
const TONES = [
  [268, 28], [236, 82], [205, 12], [165, 335], [305, 100], [350, 205], [255, 140], [285, 60],
];
const lin2srgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
function toRgb(L, c, h, o, k) {
  const a = c * cos(h), b = c * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const TMP3 = [0, 0, 0];
function oklch(L, C, hd, o, k) {
  const h = (hd * PI) / 180;
  toRgb(L, C, h, TMP3);
  let c = C;
  if (TMP3[0] < 0 || TMP3[0] > 1 || TMP3[1] < 0 || TMP3[1] > 1 || TMP3[2] < 0 || TMP3[2] > 1) {
    let lo = 0, hi = C;
    for (let it = 0; it < 12; it++) {
      c = 0.5 * (lo + hi);
      toRgb(L, c, h, TMP3);
      if (TMP3[0] < 0 || TMP3[0] > 1 || TMP3[1] < 0 || TMP3[1] > 1 || TMP3[2] < 0 || TMP3[2] > 1) hi = c; else lo = c;
    }
    toRgb(L, lo, h, TMP3);
  }
  o[k] = lin2srgb(cl(TMP3[0], 0, 1)); o[k + 1] = lin2srgb(cl(TMP3[1], 0, 1)); o[k + 2] = lin2srgb(cl(TMP3[2], 0, 1));
}
function buildRamp(k1) {
  const x = cl(k1, 0, 1) * (TONES.length - 1), i = min(floor(x), TONES.length - 2), f = x - i;
  const a = TONES[i], b = TONES[i + 1];
  let ds = b[0] - a[0], dh = b[1] - a[1];
  ds -= 360 * Math.round(ds / 360); dh -= 360 * Math.round(dh / 360);
  const hs = a[0] + ds * f, hh = a[1] + dh * f;
  let arc = hh - hs;
  arc -= 360 * Math.round(arc / 360);
  for (let n = 0; n <= RN; n++) {
    const u = n / RN;
    const w = sm(0.08, 0.97, u);
    const L = 0.27 + 0.70 * pow(u, 1.3);
    const C = (0.15 + 0.07 * sm(0, 0.35, u)) * (1 - 0.82 * pow(sm(0.5, 1, u), 1.2));
    oklch(L, C, hs + arc * w, RAMP, n * 3);
  }
}

function buildLut(gam, t1) {
  for (let n = 0; n <= LN; n++) {
    const L = L_LO + n / L_SC;
    const df = DMAX * (0.68 * sig(gam * (L - LC)) + 0.32 * sig(0.42 * gam * (L - LC - 0.4)));
    const prog = 1 - exp(-t1 * 1.5 * pow(10, 0.55 * (L - LC)));
    LUT_DF[n] = df;
    LUT_D1[n] = df * prog;
  }
}

function buildFlashLut(g2) {
  for (let n = 0; n <= ZN; n++) LUT_F[n] = sig(g2 * (Z_LO + n / Z_SC));
}

// ---------------------------------------------------------------- blur
function kernel(sigma) {
  const R = min(ceil(2.8 * sigma), 12);
  let sum = 1;
  KER[0] = 1;
  for (let j = 1; j <= R; j++) {
    KER[j] = exp(-(j * j) / (2 * sigma * sigma));
    sum += 2 * KER[j];
  }
  for (let j = 0; j <= R; j++) KER[j] /= sum;
  return R;
}

function blur(src, dst, tmp, R) {
  for (let y = 0; y < H; y++) {
    const b = y * W;
    for (let i = 0; i < R; i++) PAD[i] = src[b];
    for (let x = 0; x < W; x++) PAD[R + x] = src[b + x];
    for (let i = 0; i < R; i++) PAD[R + W + i] = src[b + W - 1];
    for (let x = 0; x < W; x++) {
      const c = R + x;
      let acc = KER[0] * PAD[c];
      for (let j = 1; j <= R; j++) acc += KER[j] * (PAD[c - j] + PAD[c + j]);
      tmp[b + x] = acc;
    }
  }
  for (let y = 0; y < H; y++) {
    const b = y * W;
    for (let x = 0; x < W; x++) dst[b + x] = KER[0] * tmp[b + x];
    for (let j = 1; j <= R; j++) {
      const bl = (y - j < 0 ? 0 : y - j) * W, br = (y + j > H - 1 ? H - 1 : y + j) * W, kj = KER[j];
      for (let x = 0; x < W; x++) dst[b + x] += kj * (tmp[bl + x] + tmp[br + x]);
    }
  }
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t, k = S.k;
  const tone = cl(k[0], 0, 1), flash = cl(k[1], 0, 4), dev = cl(k[2], -1, 1), adj = cl((cl(k[3], -1, 1) + 1) * 0.5, 0, 1);

  // ---- the curves
  if (abs(dev - S.lutK3) > 1e-4) {
    S.lutK3 = dev;
    buildLut(3.4 * pow(2, 0.8 * dev), 1.0 * pow(2, 1.2 * dev));
    buildFlashLut(9);
  }
  if (abs(tone - S.rampK1) > 1e-4) {
    S.rampK1 = tone;
    buildRamp(tone);
  }

  // ---- the first picture: lamps, bands and a plane of light
  const lamps = S.lamps, bands = S.bands;
  for (let i = 0; i < NL; i++) {
    const m = lamps[i];
    const cx = m.cx + m.ax * sin(m.wx1 * T + m.px1) + 0.6 * m.ax * sin(m.wx2 * T + m.px2);
    const cy = m.cy + m.ay * sin(m.wy1 * T + m.py1) + 0.6 * m.ay * sin(m.wy2 * T + m.py2);
    const br = 1 + 0.3 * sin(m.ws * T + m.ps);
    const sx = m.sx * br, sy = m.sy * (2 - br);
    const ix = -1 / (2 * sx * sx), iy = -1 / (2 * sy * sy);
    for (let x = 0; x < W; x++) GX[i * W + x] = exp(ix * (x - cx) * (x - cx));
    for (let y = 0; y < H; y++) GY[i * H + y] = exp(iy * (y - cy) * (y - cy));
    AY[i] = m.a0 * (1 + 0.45 * sin(m.wa * T + m.pa));
  }
  const b0 = bands[0], b1 = bands[1];
  const th0 = b0.th + b0.ath * sin(b0.wth * T + b0.pth), th1 = b1.th + b1.ath * sin(b1.wth * T + b1.pth);
  const c0 = cos(th0), s0 = sin(th0), c1 = cos(th1), s1 = sin(th1);
  const o0 = b0.ao * sin(b0.wo * T + b0.po) + 0.5 * b0.ao * sin(b0.wo2 * T + b0.po2);
  const o1 = b1.ao * sin(b1.wo * T + b1.po) + 0.5 * b1.ao * sin(b1.wo2 * T + b1.po2);
  const ba0 = b0.a0 * (1 + 0.5 * sin(b0.wa * T + b0.pa)), ba1 = b1.a0 * (1 + 0.5 * sin(b1.wa * T + b1.pa));
  const iw0 = -1 / (2 * b0.w * b0.w), iw1 = -1 / (2 * b1.w * b1.w);
  const st = S.st;
  const sth = st.th + 0.6 * sin(st.wth * T + st.pth), sc = cos(sth), ss = sin(sth);
  const sP = st.P * (1 + 0.25 * sin(st.wP * T + st.pP)), skk = TAU / sP, sph = st.wph * T + st.ph;
  const ecx = st.ex + st.ax * sin(st.wx1 * T + st.px) + 0.6 * st.ax * sin(st.wx2 * T + st.px2);
  const ecy = st.ey + st.ay * sin(st.wy1 * T + st.py) + 0.6 * st.ay * sin(st.wy2 * T + st.py2);
  const sAmp = st.a0 * (1 + 0.45 * sin(st.wa * T + st.pa));
  const w0 = st.wk[0] + 0.23 * T, w1 = st.wk[1] + 0.17 * T, w2 = st.wk[2] - 0.13 * T, w3 = st.wk[3] + 0.11 * T;
  const iex = -1 / (2 * st.sx * st.sx), iey = -1 / (2 * st.sy * st.sy);
  const plA = TAU * (0.0017 * T + S.gpl), pcx = cos(plA), pcy = sin(plA);
  const plK = 0.039, plAmp = 0.3, plPh = 0.021 * T + S.gph;
  for (let y = 0; y < H; y++) {
    const yy = y - 63.5;
    for (let i = 0; i < NL; i++) PAD[i] = AY[i] * GY[i * H + y];
    const eyv = iey * (y - ecy) * (y - ecy);
    for (let x = 0; x < W; x++) {
      const xx = x - 31.5;
      let e = 0.12;
      for (let i = 0; i < NL; i++) e += PAD[i] * GX[i * W + x];
      const u0 = xx * c0 + yy * s0 - o0, u1 = xx * c1 + yy * s1 - o1;
      e += ba0 * exp(iw0 * u0 * u0) + ba1 * exp(iw1 * u1 * u1);
      const wv = 0.7 * sin(0.047 * xx + 0.033 * yy + w0) + 0.5 * sin(-0.029 * xx + 0.052 * yy + w1) + 0.35 * sin(0.061 * xx - 0.021 * yy + w2) + 0.25 * sin(0.019 * xx + 0.071 * yy + w3);
      const q = 0.5 + 0.5 * sin(skk * ((xx * sc + yy * ss) + 5 * wv) + sph);
      e += sAmp * exp(iex * (x - ecx) * (x - ecx) + eyv) * q * q;
      LG[y * W + x] = log(e) * LOG10E + plAmp * sin(plK * (xx * pcx + yy * pcy) + plPh);
    }
  }
  // the printer sets the exposure so the picture sits on the curve: mean and spread of log exposure, followed slowly
  let sm1 = 0, sm2 = 0;
  for (let n = 0; n < N; n++) { const v = LG[n]; sm1 += v; sm2 += v * v; }
  sm1 /= N; sm2 = sqrt(max(sm2 / N - sm1 * sm1, 1e-4));
  if (S.mu === undefined) { S.mu = sm1; S.sd = sm2; }
  const ak = 1 - exp(-S.dtl / 2);
  S.mu += (sm1 - S.mu) * ak; S.sd += (sm2 - S.sd) * ak;
  const gsc = cl(0.62 / S.sd, 0.5, 2.2), gof = LC - S.mu * gsc;
  for (let n = 0; n < N; n++) LG[n] = LG[n] * gsc + gof;

  // ---- first development, partial, with its adjacency
  const wA = adj;
  const sigA = 0.9 + 2.9 * wA, a1 = 1.2 * wA, a2 = 2.2 * wA;
  const R = kernel(sigA);
  for (let n = 0; n < N; n++) {
    let q = (LG[n] - L_LO) * L_SC;
    q = q < 0 ? 0 : q > LN - 1 ? LN - 1 : q;
    const i = q | 0, f = q - i;
    DF[n] = LUT_DF[i] + (LUT_DF[i + 1] - LUT_DF[i]) * f;
    TA[n] = LUT_D1[i] + (LUT_D1[i + 1] - LUT_D1[i]) * f;
  }
  blur(TA, D1, TB, R);
  for (let n = 0; n < N; n++) {
    const v = TA[n] + a1 * (TA[n] - D1[n]);
    D1[n] = v < 0 ? 0 : v;
  }

  // ---- the second flash, shaded by what is already dense
  const gate = sm(0, 0.25, flash);
  const sF = -0.5 + 0.12 * flash + 0.04 * flash * flash;
  const gph = 0.017 * T + S.gps, gang = 0.9 + 0.5 * sin(0.0071 * T + S.gpa), gk = 0.0092;
  const gcx = cos(gang), gcy = sin(gang);
  for (let x = 0; x < W; x++) { const a = gk * (x - 31.5) * gcx + gph; SX[x] = sin(a); CX[x] = cos(a); }
  for (let y = 0; y < H; y++) { const a = gk * (y - 63.5) * gcy; SY[y] = sin(a); CY[y] = cos(a); }
  const CAP = 0.42 + 0.1 * flash;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = y * W + x;
      const g = 0.6 * (SX[x] * CY[y] + CX[x] * SY[y]);
      let q = (sF + g - D1[n] - Z_LO) * Z_SC;
      q = q < 0 ? 0 : q > ZN - 1 ? ZN - 1 : q;
      const i = q | 0, f = q - i;
      const fl = (LUT_F[i] + (LUT_F[i + 1] - LUT_F[i]) * f) * gate;
      TA[n] = DF[n] + CAP * (DMAX - DF[n]) * fl;
    }
  }
  blur(TA, D1, TB, R);

  // ---- show it
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = y * W + x;
      const d = TA[n] + a2 * (TA[n] - D1[n]);
      let u = (D_DEEP - d) * U_SC;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const q = (u * RN + 0.5) | 0;
      const dth = (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) * 0.0625 - 0.5;
      display.setPixel(
        x, y,
        (RAMP[q * 3] * 255 + dth + 0.5) | 0,
        (RAMP[q * 3 + 1] * 255 + dth + 0.5) | 0,
        (RAMP[q * 3 + 2] * 255 + dth + 0.5) | 0
      );
    }
  }
}
