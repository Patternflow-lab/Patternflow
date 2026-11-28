// ===== Patternflow pattern =====
// Title:   Raised Beaches
// Family:  isostasy
// Idea:    A side-on cross-section of a glaciated coast in which an ice sheet advances and retreats, the crust under its weight sinks and the viscous mantle below lets it come back slowly, and as the land rises the sea steps back and leaves a staircase of raised beaches.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: viscous relaxation of a half-space under a load, tau = 2 eta k / (rho g) for each wavelength (Norman Haskell, 1935, from memory), flexure of an elastic plate on a fluid as a damping of the short wavelengths, w = -q / (drho g + D k^4) (Vening Meinesz, 1931, from memory), the near-plastic profile of an ice sheet, h = sqrt(2 tau0 / (rho g) (L - x)) (John Nye, 1951, from memory), raised shorelines as glacio-isostatic uplift frozen into the land (Thomas Jamieson, 1865, and Gerard De Geer, 1910, from memory), original code, pattern round 276
// Round:   276
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Viscosity=0..4, Lithosphere=-1..1, Ice=-1..1
//
// Knob 1: Hue. PLACEHOLDER
// Knob 2: Viscosity. PLACEHOLDER
// Knob 3: Lithosphere. PLACEHOLDER
// Knob 4: Ice. PLACEHOLDER
//
// What the picture is. PLACEHOLDER

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, tanh, min, max, abs, pow, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const lerp = (a, b, t) => a + (b - a) * t;
const sp = (u, s) => s * log(1 + exp(u / s));

// ---- the section: a model domain of 128 columns (5 km each), the panel shows columns 0..63 ----
const XL = -32, LM = 128;               // model domain from XL, length LM, columns
const NJ = 257;                         // grid points at half a column
const NM = 36;                          // cosine modes 0..NM
const J0 = 64;                          // grid index of column 0
const YS = 64;                          // row of the datum sea level
const CRUST = 15;                       // rows of crust and lithosphere drawn under the land
const RHO = 0.917 / 3.3;                // ice density over mantle density
const HS = 5;                         // ice thickness 3.6 sqrt(L - x) rows, columns of 5 km, rows of 90 m
const TAU1 = 9.7;                       // relaxation time of the longest mode for eta = 1e21 Pa s, thousand years
const ES = 3;                         // eustatic drop in rows at the largest ice
const PRE = 170;                        // model time run before the first frame, thousand years
const TL = 1.5;                         // time-lapse: thousand years of model time in a second on the panel
const NRID = 14, NDS = 30;

const CT = new Float32Array((NM + 1) * NJ);
const KN = new Float64Array(NM + 1);
for (let n = 0; n <= NM; n++) {
  KN[n] = (n * PI) / LM;
  for (let j = 0; j < NJ; j++) CT[n * NJ + j] = cos((n * PI * j) / (NJ - 1));
}
const ZB = new Float64Array(NJ);        // the land before the ice, rows above the datum
const zbf = (x) => 11 - 0.4 * sp(x - 6, 4) - 0.25 * sp(x - 44, 5);
for (let j = 0; j < NJ; j++) ZB[j] = zbf(XL + 0.5 * j);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
function hsh(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(u, v) {
  const iu = floor(u), iv = floor(v);
  let fu = u - iu, fv = v - iv;
  fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
  const a = hsh(iu, iv), b = hsh(iu + 1, iv), c = hsh(iu, iv + 1), d = hsh(iu + 1, iv + 1);
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}

// a red-noise wander of unit size from six sines on periods that share no factor, drawn once
function wander(n, p0, p1) {
  const per = [], ph = [], am = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const P = p0 * pow(p1 / p0, (i + Math.random()) / n);
    per.push(P); ph.push(TAU * Math.random()); am.push(sqrt(P)); s += P;
  }
  const g = 1 / sqrt(s / 2);
  for (let i = 0; i < n; i++) am[i] *= g;
  return { per, ph, am };
}
const wv = (w, t) => {
  let v = 0;
  for (let i = 0; i < w.per.length; i++) v += w.am[i] * sin((TAU * t) / w.per[i] + w.ph[i]);
  return v;
};

const SH = new Float64Array(NJ);        // ice thickness on the grid
const WP = new Float64Array(129);       // crust displacement at columns 0, 0.5, ... 64
const ZL = new Float64Array(129);

function iceProfile(S, ice) {
  let v = 0;
  const xd = ice.xd, R = ice.R;
  for (let j = 0; j < NJ; j++) {
    const dx = XL + 0.5 * j - xd;
    const s = R - sqrt(dx * dx + 16);
    const h = s > 0 ? HS * sqrt(s) : 0;
    SH[j] = h;
    v += h;
  }
  return v * 0.5;
}

export function setup(params) {
  const dashes = [];
  for (let i = 0; i < NDS; i++)
    dashes.push({ x: -16 + 96 * Math.random(), d: 3 + 46 * Math.pow(Math.random(), 1.2), len: 10 + 16 * Math.random(), a: 0.4 + 0.5 * Math.random() });
  // the biggest sheet, for the scale of the eustatic level
  let vref = 0;
  {
    const xd = -4, R = 84;
    for (let j = 0; j < NJ; j++) {
      const dx = XL + 0.5 * j - xd, s = R - sqrt(dx * dx + 16);
      if (s > 0) vref += HS * sqrt(s) * 0.5;
    }
  }
  params.s = {
    tm: 0, rt: 0, k: null, A: new Float64Array(NM + 1), Rt: new Float64Array(NM + 1), ready: false,
    wl: wander(6, 36, 400), wc: wander(5, 60, 420), wf: wander(4, 9, 52),
    u: 0.5, ice: { xd: -4, R: 40, L: 40, V: 0 }, e: 0, vref,
    sh: { x: NaN, px: NaN, v: 0, quiet: 0, cur: null, lo: NaN, hi: NaN },
    rid: [], dash: dashes, hue: -9, n: 0, wmin: 0, wmax: 0, nform: 0,
  };
  // start the history where the ice has been growing and stands at a middling size, so the first picture is a mature one
  const S = params.s;
  for (let i = 0; i < 400; i++) {
    const off = 600 * Math.random(), a = target(S, off + PRE - 25), b = target(S, off + PRE);
    S.tm = off;
    if (a > 0.45 && a < 0.8 && b > 0.6 && b < 0.85 && b > a) break;
  }
  S.u = target(S, S.tm);
}

const AEQ = new Float64Array(NM + 1);

const target = (S, t) => 0.5 + 0.5 * tanh(1.15 * wv(S.wl, t));

function stepModel(S, dt) {
  const kk = S.k;
  S.tm += dt;
  const t = S.tm;
  // the ice history: a target from the wander, followed slowly on the way up and quickly on the way down
  const lmax = 20 + 26 * (cl(kk[3], -1, 1) + 1);
  const tar = target(S, t);
  S.u += cl(tar - S.u, -dt / 32, dt / 80);
  const L = 11 + (lmax - 11) * S.u;
  const xd = -5 + 11 * tanh(0.9 * wv(S.wc, t));
  const ice = S.ice;
  ice.L = L; ice.xd = xd; ice.R = max(L - xd, 14);
  ice.V = iceProfile(S, ice);
  S.e = -ES * min(1, ice.V / S.vref) + 0.35 * wv(S.wf, t);

  // the load in cosine modes, each mode relaxes toward its own equilibrium
  const alpha = 7 * pow(2, 1.9 * cl(kk[2], -1, 1));
  const visc = pow(2, 1.15 * (cl(kk[1], 0, 4) - 2));
  for (let n = 0; n <= NM; n++) {
    let a = 0;
    const o = n * NJ;
    for (let j = 0; j < NJ; j++) a += SH[j] * CT[o + j] * (j === 0 || j === NJ - 1 ? 0.5 : 1);
    a *= (n === 0 ? 1 : 2) * 0.5 / LM;
    const ka = KN[n] * alpha, fl = 1 + ka * ka * ka * ka;
    const eq = (-RHO * a) / fl;
    const tau = (TAU1 * visc * (n === 0 ? 0.5 : n)) / fl;
    const A = S.A[n], d = A - eq, nA = eq + d * exp(-dt / tau);
    S.Rt[n] = (nA - A) / dt;
    S.A[n] = nA;
  }
  // the land at columns 0 .. 64 in half steps
  for (let i = 0; i <= 128; i++) {
    let w = 0;
    const j = J0 + i;
    for (let n = 0; n <= NM; n++) w += S.A[n] * CT[n * NJ + j];
    WP[i] = w;
    ZL[i] = ZB[j] + w;
  }

  // the shoreline: where the land first goes under the sea, going right from the interior
  const sh = S.sh;
  let xs = NaN;
  for (let i = 1; i <= 128; i++)
    if (ZL[i] < S.e && ZL[i - 1] >= S.e) { xs = 0.5 * (i - 1 + (ZL[i - 1] - S.e) / (ZL[i - 1] - ZL[i])); break; }
  if (Number.isFinite(xs) && Number.isFinite(sh.px)) {
    const v = (xs - sh.px) / dt;
    sh.v += (v - sh.v) * (1 - exp(-dt / 1.5));
  } else sh.v = 9;
  sh.px = xs;
  sh.x = xs;
  const iceAt = (x) => {
    const j = cl(round2(x - XL), 0, NJ - 1);
    return SH[j];
  };
  if (Number.isFinite(xs) && xs > 3 && xs < 61 && iceAt(xs) < 0.8) {
    // the shoreline holds still while it stays inside a window 1.6 columns wide; a beach is cut after 4 seconds there
    if (!Number.isFinite(sh.lo) || xs < sh.hi - 1.6 || xs > sh.lo + 1.6) { sh.lo = sh.hi = xs; sh.quiet = 0; sh.cur = null; }
    else { sh.lo = min(sh.lo, xs); sh.hi = max(sh.hi, xs); sh.quiet += dt; }
    if (sh.quiet > 4) {
      const xr = 0.5 * (sh.lo + sh.hi);
      if (!sh.cur) {
        let near = null;
        for (const r of S.rid) if (abs(r.x - xr) < 2.7 && (!near || abs(r.x - xr) < abs(near.x - xr))) near = r;
        if (near) sh.cur = near;
        else {
          sh.cur = { x: xr, h0: S.e, w0: interpW(xr), t0: S.tm, s: 0.35 };
          S.rid.push(sh.cur); S.nform++;
        }
      }
      sh.cur.s = min(1, sh.cur.s + dt / 26);
    }
  } else { sh.lo = NaN; sh.quiet = 0; sh.cur = null; }
  // erosion, scouring under the ice, and the limit on how many are kept
  for (const r of S.rid) {
    const covered = iceAt(r.x) > 2;
    r.s *= exp(-dt / (covered ? 14 : 300));
  }
  S.rid = S.rid.filter((r) => r.s > 0.1);
  while (S.rid.length > NRID) {
    let k = 0;
    for (let i = 1; i < S.rid.length; i++) if (S.rid[i].s < S.rid[k].s) k = i;
    S.rid.splice(k, 1);
  }
}
const round2 = (x) => floor(2 * x + 0.5);
function interpW(x) {
  const f = cl(2 * x, 0, 127.999), i = floor(f), t = f - i;
  return WP[i] + (WP[i + 1] - WP[i]) * t;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    for (let i = 0; i < floor(PRE / 0.3); i++) stepModel(S, 0.3);
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.rt += d;
  if (d > 0) stepModel(S, d * TL);
}

// ---------------------------------------------------------------- draw
const BUF = new Float32Array(W * H * 3);
const DSH = new Float32Array(W * H);
const SKY = new Float32Array(H * 3), SEA = new Float32Array(100 * 3), ICE = new Float32Array(33 * 3), MAN = new Float32Array(110 * 3);
const EAR = new Float32Array(4 * 3);
const T = [0, 0, 0], T2 = [0, 0, 0];

function lutSet(arr, i, c) { arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
function buildColors(h) {
  const he = 0.14 * sin(TAU * h);
  for (let y = 0; y < H; y++) {
    const t = cl(y / 74, 0, 1), q = t * t;
    const q2 = q * q;
    hsv(lerp(0.615, 0.54, q2) + h, lerp(0.7, 0.22, q2), lerp(0.4, 0.9, q2), T);
    lutSet(SKY, y, T);
  }
  for (let d = 0; d < 100; d++) {
    hsv(0.49 + h + 0.05 * sm(0, 40, d), lerp(0.5, 0.85, sm(0, 30, d)), 0.2 + 0.55 * exp(-d / 9), T);
    lutSet(SEA, d, T);
  }
  for (let i = 0; i <= 32; i++) {
    const f = i / 32;
    hsv(0.5 + h + 0.04 * f, lerp(0.05, 0.62, sm(0.1, 1, f)), lerp(0.98, 0.66, f), T);
    lutSet(ICE, i, T);
  }
  for (let d = 0; d < 110; d++) {
    hsv(0.03 + he + 0.03 * sm(0, 90, d), lerp(0.66, 0.74, sm(0, 60, d)), lerp(0.27, 0.62, sm(0, 100, d)), T);
    lutSet(MAN, d, T);
  }
  hsv(0.065 + he, 0.6, 0.32, T); lutSet(EAR, 0, T);    // umber
  hsv(0.1 + he, 0.56, 0.64, T); lutSet(EAR, 1, T);     // ochre
  hsv(0.125 + he, 0.28, 0.95, T); lutSet(EAR, 2, T);   // beach sand
  hsv(0.09 + he, 0.5, 0.58, T); lutSet(EAR, 3, T);     // soil
}

const CY = new Float32Array(W), CS = new Float32Array(W), CI = new Float32Array(W), CB = new Float32Array(W), CW = new Float32Array(W), CR = new Float32Array(W), CH = new Float32Array(W);
const S0 = (d) => { const t = cl((d + 0.85) / 1.7, 0, 1); return t * t * (3 - 2 * t); };

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  if (abs(S.hue - S.k[0]) > 0.0005) { buildColors(S.k[0]); S.hue = S.k[0]; }
  const rt = S.rt, ice = S.ice, ysea = YS - S.e;

  // per column: the land, the ice, the crust base, the beach weight
  for (let x = 0; x < W; x++) {
    const w = WP[2 * x + 1], j = J0 + 2 * x + 1, xc = x + 0.5;
    let bump = 0, rw = 0;
    for (const r of S.rid) {
      const u = (xc - r.x) / 1.5;
      if (u > -3.2 && u < 3.2) { const g = exp(-u * u); bump += (1.1 + 1.9 * r.s) * g; rw += r.s * g; }
    }
    const ys = YS - ZB[j] - w - bump;
    CS[x] = ys;
    CB[x] = YS - ZB[j] + CRUST - w;
    CH[x] = SH[j];
    CI[x] = ys - SH[j];
    CR[x] = min(1, rw * 1.3);
    CW[x] = w;
  }

  DSH.fill(0);
  drawDashes(S);

  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, sk = y * 3;
    for (let x = 0; x < W; x++) {
      const ys = CS[x], yb = CB[x], yi = CI[x], hi = CH[x];
      let r = SKY[sk], g = SKY[sk + 1], b = SKY[sk + 2];
      // thin high cloud drifting, a few percent of the sky's light
      const cd = 1 + 0.09 * (vn(x * 0.05 + rt * 0.09 + 11, yc * 0.2 + 3) - 0.5) * (1 - yc / 80);
      r *= cd; g *= cd; b *= cd;
      // sea: between the sea surface and the land
      const cw = S0(yc - ysea) * (1 - S0(yc - ys));
      if (cw > 0.002) {
        const dd = cl(yc - ysea, 0, 99), di = floor(dd), fr = dd - di, i0 = di * 3, i1 = min(99, di + 1) * 3;
        let sr = SEA[i0] + (SEA[i1] - SEA[i0]) * fr, sg = SEA[i0 + 1] + (SEA[i1 + 1] - SEA[i0 + 1]) * fr, sb = SEA[i0 + 2] + (SEA[i1 + 2] - SEA[i0 + 2]) * fr;
        const shallow = exp(-(ys - ysea) / 5) * exp(-(ys - yc) / 3);
        sr += 55 * shallow; sg += 70 * shallow; sb += 40 * shallow;
        const rp = 1 + 0.17 * exp(-(yc - ysea) / 6) * sin(x * 0.62 - rt * 1.9 + (yc - ysea) * 1.1);
        sr *= rp; sg *= rp; sb *= rp;
        r += (sr - r) * cw; g += (sg - g) * cw; b += (sb - b) * cw;
      }
      // ice: white on top and glacier blue at the base, with flow-line streaks that creep toward the margin and a bright rim
      const ci = hi > 0.05 ? S0(yc - yi) * (1 - S0(yc - ys)) : 0;
      if (ci > 0.002) {
        const dy = yc - yi, f = cl(dy / max(hi, 1), 0, 1), fi = f * 32, i0 = floor(fi), fr = fi - i0, a0 = i0 * 3, a1 = min(32, i0 + 1) * 3;
        let ir = ICE[a0] + (ICE[a1] - ICE[a0]) * fr, ig = ICE[a0 + 1] + (ICE[a1 + 1] - ICE[a0 + 1]) * fr, ib = ICE[a0 + 2] + (ICE[a1 + 2] - ICE[a0 + 2]) * fr;
        const sx = (x + 0.5 - ice.xd) / ice.R;
        const nz = vn(sx * 5.5 + 7.1, f * 1.9 + 1.4 * sx - rt * 0.03) * 0.65 + vn(sx * 13 + 2.2, f * 4.4 + 2.6 * sx - rt * 0.05) * 0.35;
        const dk = sm(0.44, 0.62, nz) * (0.3 + 0.7 * f);
        ir *= 1 - 0.5 * dk; ig *= 1 - 0.36 * dk; ib *= 1 - 0.14 * dk;
        const rim = 0.2 * (1 - sm(0.5, 2.6, dy));
        ir += (255 - ir) * rim; ig += (255 - ig) * rim; ib += (255 - ib) * rim;
        if (yc > ysea) { ir *= 0.8; ig *= 0.95; }
        r += (ir - r) * ci; g += (ig - g) * ci; b += (ib - b) * ci;
      }
      // land
      const cl2 = S0(yc - ys) * (1 - S0(yc - yb));
      if (cl2 > 0.002) {
        const dp = yc - ys, rho = yc + CW[x] - 0.6 * (YS - ZB[J0 + 2 * x + 1]);
        const st = sm(0.25, 0.75, 0.5 + 0.5 * sin(rho * 1.25 + 3.2 * vn(x * 0.04 + 3.1, rho * 0.09)));
        let lr = EAR[0] + (EAR[3] - EAR[0]) * st, lg = EAR[1] + (EAR[4] - EAR[1]) * st, lb = EAR[2] + (EAR[5] - EAR[2]) * st;
        const so = 0.7 * (1 - sm(0.5, 3.5, dp));
        lr += (EAR[9] - lr) * so; lg += (EAR[10] - lg) * so; lb += (EAR[11] - lb) * so;
        const pw = CR[x] * (1 - sm(1.2, 4.2, dp));
        lr += (EAR[6] - lr) * pw; lg += (EAR[7] - lg) * pw; lb += (EAR[8] - lb) * pw;
        r += (lr - r) * cl2; g += (lg - g) * cl2; b += (lb - b) * cl2;
      }
      // mantle: dark umber under the crust to glowing amber at the bottom, with slow blotches and the streaks of flow
      const cm = S0(yc - yb);
      if (cm > 0.002) {
        const dm = cl(yc - yb, 0, 108), i0 = floor(dm) * 3;
        const nb = vn(x * 0.07 + rt * 0.03, yc * 0.09 - rt * 0.045 + 4.3);
        const lum = 0.82 + 0.36 * nb + 0.22 * sm(88, 128, yc);
        let mr = MAN[i0] * lum, mg = MAN[i0 + 1] * lum * (0.92 + 0.16 * nb), mb = MAN[i0 + 2] * lum;
        const dsh = DSH[y * W + x];
        mr += 255 * 0.55 * dsh; mg += 190 * 0.55 * dsh; mb += 80 * 0.55 * dsh;
        r += (mr - r) * cm; g += (mg - g) * cm; b += (mb - b) * cm;
      }
      const o = (y * W + x) * 3;
      BUF[o] = r; BUF[o + 1] = g; BUF[o + 2] = b;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(BUF[o], 0, 255) | 0, cl(BUF[o + 1], 0, 255) | 0, cl(BUF[o + 2], 0, 255) | 0);
    }
}

const DP = [0, 0];
function dispAt(S, x, d, out) {
  // the displacement of a point of the mantle at x columns and d rows under the crust: each mode decays with depth
  let dx = 0, dy = 0;
  const xr = x - XL;
  for (let n = 0; n <= NM; n++) {
    const k = max(KN[n], 0.012), a = S.A[n] * exp(-k * d), ph = KN[n] * xr;
    dx -= a * sin(ph);
    dy += a * cos(ph);
  }
  out[0] = dx; out[1] = dy;
}
function drawDashes(S) {
  for (const q of S.dash) {
    const NP = ceil(q.len / 1.0);
    for (let i = 0; i < NP; i++) {
      const xb = q.x + (i / (NP - 1) - 0.5) * q.len;
      const yb = YS - zbf(xb) + CRUST + q.d;
      dispAt(S, xb, q.d, DP);
      const px = xb + DP[0], py = yb - DP[1];
      const env = pow(sin((PI * (i + 0.5)) / NP), 0.7) * q.a;
      const x0 = floor(px) - 3, y0 = floor(py) - 2;
      for (let yy = max(0, y0); yy <= min(H - 1, y0 + 4); yy++)
        for (let xx = max(0, x0); xx <= min(W - 1, x0 + 6); xx++) {
          const ddx = xx + 0.5 - px, ddy = yy + 0.5 - py;
          DSH[yy * W + xx] += 0.28 * env * exp(-(ddx * ddx * 0.5 + ddy * ddy * 1.1));
        }
    }
  }
}
