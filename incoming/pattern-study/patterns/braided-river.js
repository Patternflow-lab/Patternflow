// ===== Patternflow pattern =====
// Title:   Braided River
// Family:  weather
// Idea:    PLACEHOLDER
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Murray-Paola braided-stream model (A. Brad Murray and Chris Paola, 1994)
// Round:   124
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Water=-1..1
//
// Knob 1: Hue. PLACEHOLDER
// Knob 2: Flow. PLACEHOLDER
// Knob 3: Scale. PLACEHOLDER
// Knob 4: Water. PLACEHOLDER

const W = 64, H = 128;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The model lives on the panel's own torus: 64 columns across the flow, 128 rows along it, one cell to an LED at Scale -1.
const NX = 64, NY = 128, ST = NX + 2; // every array carries a halo column each side, so that the sweep never tests for a wrap
const NC = ST * NY;

const CFG = {
  s0: 0.05, // imposed mean slope: the bed drops 0.05 cell per row on average; z below is what is left after that is taken off
  emax: 0.03, // bedload a cell can pass on in one step when the stream is far above threshold
  uc: 0.0955, // discharge times slope at which the flux is half of emax. emax and uc are K = 10 of the power law
  eps: 0.03, // share of each row's water that is renewed from a sheet, so that channels are always being born
  noise: 0.5, // relative size of the noise on that sheet
  lam: 1, // lateral bedload: down the cross-stream slope, in proportion to the sediment moving
  rep: 0.12, // slope between neighbours across the flow at which a bank collapses (2.4 times s0)
  rrate: 0.25, // share of the excess slope that slides in a step
  dzmax: 0.03, // largest bed change per step; the step is scaled so that it is never exceeded
  gmax: 3,
  z0: 0.06, // rms of the first bed
  spin: 700, // steps before the first frame
};

function makeState(seed) {
  const S = {
    z: new Float64Array(NC), dz: new Float64Array(NC),
    Q: new Float32Array(NC), Q0: new Float32Array(ST), qsm: new Float32Array(NC), sbm: new Float32Array(NC),
    rs: (seed | 1) >>> 0, steps: 0, time: 0, dt: 1,
  };
  // first bed: noise blurred 2 cells across and 16 along the flow, so that it is already streaks
  const n = NX * NY, a = new Float64Array(n), b = new Float64Array(n);
  let rs = S.rs;
  for (let i = 0; i < n; i++) {
    rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
    a[i] = (rs >>> 0) / 4294967296 - 0.5;
  }
  S.rs = rs >>> 0;
  const blur = (src, dst, sx, sy) => {
    const kx = ceil(sx * 2), ky = ceil(sy * 2), wx = [], wy = [];
    for (let k = -kx; k <= kx; k++) wx.push(exp(-(k * k) / (2 * sx * sx)));
    for (let k = -ky; k <= ky; k++) wy.push(exp(-(k * k) / (2 * sy * sy)));
    const t = new Float64Array(n);
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        let acc = 0, w = 0;
        for (let k = -kx; k <= kx; k++) { acc += wx[k + kx] * src[y * NX + ((x + k + NX * 4) % NX)]; w += wx[k + kx]; }
        t[y * NX + x] = acc / w;
      }
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        let acc = 0, w = 0;
        for (let k = -ky; k <= ky; k++) { acc += wy[k + ky] * t[((y + k + NY * 4) % NY) * NX + x]; w += wy[k + ky]; }
        dst[y * NX + x] = acc / w;
      }
  };
  blur(a, b, 2, 16);
  let mean = 0, sd = 0;
  for (let i = 0; i < n; i++) mean += b[i];
  mean /= n;
  for (let i = 0; i < n; i++) sd += (b[i] - mean) * (b[i] - mean);
  sd = sqrt(sd / n);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) S.z[y * ST + x + 1] = ((b[y * NX + x] - mean) / sd) * CFG.z0;
  halo(S.z);
  S.Q.fill(1);
  S.Q0.fill(1);
  return S;
}

function halo(z) {
  for (let y = 0; y < NY; y++) {
    z[y * ST] = z[y * ST + NX];
    z[y * ST + NX + 1] = z[y * ST + 1];
  }
}

// One step of the bed. qb is the Water knob's number: the discharge of the whole river against the one that carries a bar.
function step(S, qb) {
  const { z, Q, dz, qsm, sbm, Q0 } = S;
  const SQ = Math.SQRT1_2, s0 = CFG.s0, emax = CFG.emax, eps = CFG.eps, qg = qb / CFG.uc;
  const noise = CFG.noise * 2 * eps, base = 1 - eps;
  let rs = S.rs;
  dz.fill(0);
  for (let x = 0; x < ST; x++) Q[x] = Q0[x]; // row 0 is last step's row 127, routed on, renewed and renormalised
  Q0.fill(0);
  for (let y = 0; y < NY; y++) {
    const o = y * ST, wrapped = y === NY - 1, yn = wrapped ? 0 : y + 1, on = yn * ST;
    const tgt = wrapped ? Q0 : Q, to = wrapped ? 0 : on;
    if (!wrapped) for (let x = 0; x < ST; x++) Q[on + x] = 0;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, j = on + x;
      const zi = z[i] + s0, qi = Q[i];
      // water goes to the three cells below by the square root of the drop to each (the diagonals are sqrt 2 away)
      const sc = zi - z[j], sl = (zi - z[j - 1]) * SQ, sr = (zi - z[j + 1]) * SQ;
      let wc = sc > 0 ? sqrt(sc) : 0, wl = sl > 0 ? sqrt(sl) : 0, wr = sr > 0 ? sqrt(sr) : 0;
      let tot = wc + wl + wr;
      if (tot < 1e-9) {
        // a pit: all to the least uphill of the three
        if (sc >= sl && sc >= sr) wc = 1;
        else if (sl >= sr) wl = 1;
        else wr = 1;
        tot = 1;
      }
      const f = qi / tot;
      tgt[to + x - 1] += wl * f;
      tgt[to + x] += wc * f;
      tgt[to + x + 1] += wr * f;
      // bedload: one flux per cell from its discharge and the discharge-weighted slope, shared out as the water is
      const sb = (wl * sl + wc * sc + wr * sr) / tot;
      let e = 0;
      if (sb > 0) {
        const u = qi * qg * sb;
        const p = u * u * sqrt(u);
        e = (emax * p) / (1 + p);
        const g = e / tot;
        dz[i] -= e;
        dz[j - 1] += g * wl;
        dz[j] += g * wc;
        dz[j + 1] += g * wr;
        sbm[i] = sb;
      } else sbm[i] = 0;
      qsm[i] = e;
    }
    // fold the halo, renew part of the row from the noisy sheet, and make the row carry what every row carries
    tgt[to + 1] += tgt[to + NX + 1];
    tgt[to + NX] += tgt[to];
    let s = 0;
    for (let x = 1; x <= NX; x++) {
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
      const v = base * tgt[to + x] + eps + noise * ((rs >>> 0) / 4294967296 - 0.5);
      tgt[to + x] = v;
      s += v;
    }
    const gn = NX / s;
    for (let x = 1; x <= NX; x++) tgt[to + x] *= gn;
    tgt[to] = tgt[to + NX];
    tgt[to + NX + 1] = tgt[to + 1];
  }
  S.rs = rs >>> 0;
  // sideways: bedload slides down the cross-stream slope in proportion to the sediment moving, and a bank steeper than rep collapses
  const lam = CFG.lam * 0.5, rep = CFG.rep, rr = CFG.rrate;
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, j = i + 1, sx = z[i] - z[j];
      let J = lam * (qsm[i] + qsm[j]) * sx;
      const a = sx < 0 ? -sx : sx;
      if (a > rep) J += rr * (a - rep) * (sx < 0 ? -1 : 1);
      dz[i] -= J;
      dz[j] += J;
    }
  }
  let mx = 0;
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    dz[o + 1] += dz[o + NX + 1];
    dz[o + NX] += dz[o];
    for (let x = 1; x <= NX; x++) {
      const a = dz[o + x], b = a < 0 ? -a : a;
      if (b > mx) mx = b;
    }
  }
  const dt = min(CFG.gmax, CFG.dzmax / (mx + 1e-12));
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    for (let x = 1; x <= NX; x++) z[o + x] += dz[o + x] * dt;
    z[o] = z[o + NX];
    z[o + NX + 1] = z[o + 1];
  }
  S.dt = dt;
  S.time += dt;
  S.steps++;
}

// ---- knobs ---------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const scaleOf = (k) => 1.5 * pow(1.5, cl(k, -1, 1)); // LEDs to a cell: 1.0, 1.5, 2.25
const waterOf = (k) => 0.8 * (k < 0 ? pow(2.3, cl(k, -1, 1)) : pow(1.6, cl(k, -1, 1))); // 0.35, 0.8, 1.28
const STEPS_PER_FLOW = 60; // bed steps a second per unit of Flow

function start(params, k) {
  const S = makeState((Math.random() * 4294967296) >>> 0);
  params.s = S;
  params.sc = scaleOf(k[2]);
  params.qb = waterOf(k[3]);
  params.acc = 0;
  for (let i = 0; i < CFG.spin; i++) step(S, params.qb);
  params.hue = k[0];
  params.lutHue = -9;
  params.gridSc = -9;
}

export function setup(params) {
  start(params, OPEN);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const ft = cl(dt || 0, 0, 0.1), f = 1 - exp(-ft / 0.5);
  params.sc += (scaleOf(k[2]) - params.sc) * f;
  params.qb += (waterOf(k[3]) - params.qb) * f;
  params.hue = k[0];
  params.acc += ft * STEPS_PER_FLOW * cl(k[1], 0.5, 4);
  let n = 0;
  while (params.acc >= 1 && n < 10) {
    step(params.s, params.qb);
    params.acc -= 1;
    n++;
  }
  if (params.acc > 4) params.acc = 4;
  derive(params);
}

// ---- the picture ---------------------------------------------------------------------------
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
  return ((v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0;
};
const RGB = [0, 0, 0];
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const NL = 17;
function buildLuts(P, hue) {
  if (!P.wl) {
    P.wl = new Uint8Array(NL * NL * 3);
    P.sl = new Uint8Array(NL * NL * 3);
    // the sand does not turn with the Hue knob
    for (let id = 0; id < NL; id++) {
      const dry = id / (NL - 1);
      for (let is = 0; is < NL; is++) {
        const sh = is / (NL - 1);
        let L = 0.46 + 0.28 * dry;
        L *= 0.8 + 0.4 * sh;
        okRgb(min(L, 0.92), 0.05 - 0.015 * dry, 62 + 25 * dry + (0.5 - sh) * 40, RGB);
        const o = (id * NL + is) * 3;
        P.sl[o] = enc(RGB[0]);
        P.sl[o + 1] = enc(RGB[1]);
        P.sl[o + 2] = enc(RGB[2]);
      }
    }
  }
  P.lutHue = hue;
  const hw = 205 + 360 * hue;
  for (let id = 0; id < NL; id++) {
    const d = id / (NL - 1); // 0 shallow, 1 deep
    for (let iv = 0; iv < NL; iv++) {
      const v = iv / (NL - 1);
      const L = 0.82 - 0.46 * d + 0.1 * v * (1 - 0.5 * d);
      const C = 0.1 + 0.04 * d + 0.03 * v;
      const h = hw - 32 + 50 * d - 10 * v;
      okRgb(L, C, h, RGB);
      const o = (id * NL + iv) * 3;
      P.wl[o] = enc(RGB[0]);
      P.wl[o + 1] = enc(RGB[1]);
      P.wl[o + 2] = enc(RGB[2]);
    }
  }
}

// Per-cell picture fields, six to a cell: wet cover, depth, speed, hillshade, wide wetness, bar height.
const NF = 6;
function derive(P) {
  const S = P.s, z = S.z, Q = S.Q, sbm = S.sbm;
  if (!P.F) {
    P.F = new Float32Array(NC * NF);
    P.A = new Float32Array(NC);
    P.B = new Float32Array(NC);
    P.Zb = new Float32Array(NC);
  }
  const F = P.F, A = P.A, B = P.B, Zb = P.Zb;
  for (let y = 0; y < NY; y++) {
    const o = y * ST, ou = (y > 0 ? y - 1 : NY - 1) * ST, od = (y < NY - 1 ? y + 1 : 0) * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, q = Q[i];
      A[i] = sm(0.45, 1.5, q);
      // light low in the north-west
      const gx = (z[i - 1] - z[i + 1]) * 0.5, gy = (z[ou + x] - z[od + x]) * 0.5;
      const sh = 0.5 + 0.5 * tanh((gx * 0.9 + gy * 0.4) * 20);
      const c = i * NF;
      F[c + 1] = cl(log(q / 0.7) / log(6.5), 0, 1);
      F[c + 2] = cl(sqrt(sbm[i] / CFG.s0) / 1.5, 0, 1);
      F[c + 3] = sh;
    }
    A[o] = A[o + NX];
    A[o + NX + 1] = A[o + 1];
  }
  // wide wetness and bar height: a 5 by 5 binomial of the cover and of the bed
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x;
      B[i] = (A[i - 2 + (x < 2 ? NX : 0)] + 4 * A[i - 1] + 6 * A[i] + 4 * A[i + 1] + A[i + 2 - (x > NX - 2 ? NX : 0)]) * 0.0625;
      Zb[i] = (z[i - 2 + (x < 2 ? NX : 0)] + 4 * z[i - 1] + 6 * z[i] + 4 * z[i + 1] + z[i + 2 - (x > NX - 2 ? NX : 0)]) * 0.0625;
    }
  }
  for (let y = 0; y < NY; y++) {
    const o = y * ST, ou2 = ((y + NY - 2) % NY) * ST, ou = ((y + NY - 1) % NY) * ST, od = ((y + 1) % NY) * ST, od2 = ((y + 2) % NY) * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, c = i * NF;
      F[c] = A[i];
      F[c + 4] = (B[ou2 + x] + 4 * B[ou + x] + 6 * B[i] + 4 * B[od + x] + B[od2 + x]) * 0.0625;
      F[c + 5] = z[i] - (Zb[ou2 + x] + 4 * Zb[ou + x] + 6 * Zb[i] + 4 * Zb[od + x] + Zb[od2 + x]) * 0.0625;
    }
    for (let k = 0; k < NF; k++) {
      F[(o) * NF + k] = F[(o + NX) * NF + k];
      F[(o + NX + 1) * NF + k] = F[(o + 1) * NF + k];
    }
  }
}

function grid(P) {
  const sc = P.sc;
  P.gridSc = sc;
  if (!P.gx) {
    P.gx = new Int32Array(W); P.gfx = new Float32Array(W);
    P.gy = new Int32Array(H); P.gfy = new Float32Array(H);
  }
  for (let px = 0; px < W; px++) {
    const cx = 31.5 + (px - 31.5) / sc, i = floor(cx);
    P.gx[px] = i + 1; // +1 for the halo column
    P.gfx[px] = cx - i;
  }
  for (let py = 0; py < H; py++) {
    const cy = 63.5 + (py - 63.5) / sc, i = floor(cy);
    P.gy[py] = ((i % NY) + NY) % NY;
    P.gfy[py] = cy - i;
  }
}

export function draw(display, params) {
  const P = params;
  if (!P.s || !P.F) return;
  const hue = cl(P.hue, 0, 1);
  if (abs(P.lutHue - hue) > 0.001 || !P.wl) buildLuts(P, hue);
  if (abs(P.gridSc - P.sc) > 0.002) grid(P);
  const F = P.F, wl = P.wl, sl = P.sl;
  const out = [0, 0, 0, 0, 0, 0];
  for (let py = 0; py < H; py++) {
    const y0 = P.gy[py], y1 = y0 + 1 < NY ? y0 + 1 : 0, ty = P.gfy[py];
    const r0 = y0 * ST, r1 = y1 * ST;
    for (let px = 0; px < W; px++) {
      const x0 = P.gx[px], tx = P.gfx[px];
      const c00 = (r0 + x0) * NF, c10 = c00 + NF, c01 = (r1 + x0) * NF, c11 = c01 + NF;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      for (let k = 0; k < NF; k++) out[k] = F[c00 + k] * w00 + F[c10 + k] * w10 + F[c01 + k] * w01 + F[c11 + k] * w11;
      const a = out[0], td = out[1], v = out[2], sh = out[3], wd = out[4], hz = out[5];
      // water
      let fd = td * (NL - 1), fv = v * (NL - 1);
      let id = min(NL - 2, fd | 0), iv = min(NL - 2, fv | 0);
      let ad = fd - id, av = fv - iv;
      let o00 = (id * NL + iv) * 3, o10 = o00 + NL * 3;
      let q00 = (1 - ad) * (1 - av), q10 = ad * (1 - av), q01 = (1 - ad) * av, q11 = ad * av;
      const lit = 0.92 + 0.16 * (sh - 0.5) * (1 - td);
      const wr = (wl[o00] * q00 + wl[o10] * q10 + wl[o00 + 3] * q01 + wl[o10 + 3] * q11) * lit;
      const wg = (wl[o00 + 1] * q00 + wl[o10 + 1] * q10 + wl[o00 + 4] * q01 + wl[o10 + 4] * q11) * lit;
      const wb = (wl[o00 + 2] * q00 + wl[o10 + 2] * q10 + wl[o00 + 5] * q01 + wl[o10 + 5] * q11) * lit;
      // sand
      const dry = cl(1 - wd * 1.6 + hz * 3, 0, 1);
      fd = dry * (NL - 1);
      fv = sh * (NL - 1);
      id = min(NL - 2, fd | 0);
      iv = min(NL - 2, fv | 0);
      ad = fd - id;
      av = fv - iv;
      o00 = (id * NL + iv) * 3;
      o10 = o00 + NL * 3;
      q00 = (1 - ad) * (1 - av); q10 = ad * (1 - av); q01 = (1 - ad) * av; q11 = ad * av;
      const sr = sl[o00] * q00 + sl[o10] * q10 + sl[o00 + 3] * q01 + sl[o10 + 3] * q11;
      const sg = sl[o00 + 1] * q00 + sl[o10 + 1] * q10 + sl[o00 + 4] * q01 + sl[o10 + 4] * q11;
      const sb = sl[o00 + 2] * q00 + sl[o10 + 2] * q10 + sl[o00 + 5] * q01 + sl[o10 + 5] * q11;
      display.setPixel(px, py, (sr + (wr - sr) * a + 0.5) | 0, (sg + (wg - sg) * a + 0.5) | 0, (sb + (wb - sb) * a + 0.5) | 0);
    }
  }
}
