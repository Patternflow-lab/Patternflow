// ===== Patternflow pattern =====
// Title:   Elastic Turbulence
// Family:  sim
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   119
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Weissenberg=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Flow. draft
// Knob 3: Scale. draft
// Knob 4: Weissenberg. draft

const { floor, ceil, exp, sqrt, abs, sin, cos, log, PI, min, max, pow, tanh, atan2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- grid: 64 LEDs across (x), 128 down (y), one cell per LED, a torus ---------------------------------
const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;

// ---- radix-2 FFT, rows contiguous, columns by butterflies across rows ------------------------------------
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
const PW = plan(W), PH = plan(H);
function fftRows(re, im, inv) {
  const { n, rev, c, s } = PW, sg = inv ? -1 : 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
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
}
function fftCols(re, im, inv) {
  const { n, rev, c, s } = PH, sg = inv ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = i * W, b = j * W;
      for (let x = 0; x < W; x++) {
        let t = re[a + x];
        re[a + x] = re[b + x];
        re[b + x] = t;
        t = im[a + x];
        im[a + x] = im[b + x];
        im[b + x] = t;
      }
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sg * s[t], a = (i + k) * W, b = a + half * W;
        for (let x = 0; x < W; x++) {
          const xr = re[b + x] * wr - im[b + x] * wi, xi = re[b + x] * wi + im[b + x] * wr;
          re[b + x] = re[a + x] - xr;
          im[b + x] = im[a + x] - xi;
          re[a + x] += xr;
          im[a + x] += xi;
        }
      }
  }
}
function fft2(re, im, inv) {
  fftRows(re, im, inv);
  fftCols(re, im, inv);
}

// ---- the model -------------------------------------------------------------------------------------------
// Lengths are LEDs. Time is in units of 1 / gamma0, gamma0 the rms shear rate that the forcing alone would make in a Newtonian
// fluid of the total viscosity (set to 1). C is the polymer conformation tensor, carried as its symmetric square root S (C = S S), whose
// advected copy can be interpolated without leaving the cone of positive semi-definite matrices.
//   C_t + u.grad C = L C + C L^T - (f(tr C) C - I) / lam,       L = [[u_x, u_y], [v_x, v_y]],   f = (LL - 2) / (LL - tr C)   (FENE-P in 2D)
//   beta nabla^2 u - grad p + div tau + F = 0,                  tau = ((1 - beta) / lam) (f C - I),   div u = 0     (Stokes: no inertia)
const BETA = 0.6; // solvent share of the zero-shear viscosity (total viscosity 1)
const LLMAX = 200; // L squared, the squared extensibility of the dumbbell: tr C stays under it

// the position of a 3x3 matrix power is not needed: the one local update of a cell is (a half step of relaxation, the exact stretch, a half step of relaxation)
const CO = new Float64Array(3);
// Relaxation, C' = (I - f C) / lam with f = (LL - 2) / (LL - tr C), over a step with delta = dt / lam. With f held constant the answer is exact,
// C+ = e C + (1 - e) / f I with e = exp(-f delta), so f is taken at the middle of the step: first backward Euler gives the end of the step
// (C+ = (C + delta I) / (1 + f delta), where f solves LL delta f^2 + (LL - s - LL delta) f - (LL - 2) = 0, s = tr C), then f is read at the mean
// of the two traces. Backward Euler alone is kept for a cell within 0.1 per cent of the bound, where it is the stable one.
let NBE = 0, NCAP = 0; // cells that used backward Euler alone, and cells whose velocity gradient was held at LCAP
const LCAP = 12, LCAP2 = LCAP * LCAP;
function relax(cxx, cxy, cyy, delta, LL) {
  const s = cxx + cyy, B = LL - s - LL * delta, sq = sqrt(B * B + 4 * LL * delta * (LL - 2));
  const fb = B > 0 ? (2 * (LL - 2)) / (B + sq) : (sq - B) / (2 * LL * delta), inv = 1 / (1 + fb * delta), sb = (s + 2 * delta) * inv, sm = 0.5 * (s + sb);
  if (sm < LL * 0.999) {
    const f = (LL - 2) / (LL - sm), e = exp(-f * delta), c = (1 - e) / f;
    if (e * s + 2 * c < LL) {
      CO[0] = e * cxx + c;
      CO[1] = e * cxy;
      CO[2] = e * cyy + c;
      return;
    }
  }
  NBE++;
  CO[0] = (cxx + delta) * inv;
  CO[1] = cxy * inv;
  CO[2] = (cyy + delta) * inv;
}
// The stretch alone, C' = L C + C L^T, is C -> F C F^T with F = exp(L dt) = c I + (sn) L, since L has no trace, L L = q2 I.
function stretch(cxx, cxy, cyy, l11, l12, l21, dt) {
  const q2 = l11 * l11 + l12 * l21, x2 = q2 * dt * dt;
  let c, sn;
  if (x2 > 1e-8) {
    const q = sqrt(q2), e = exp(q * dt), ei = 1 / e;
    c = 0.5 * (e + ei);
    sn = (0.5 * (e - ei)) / q;
  } else if (x2 < -1e-8) {
    const w = sqrt(-q2);
    c = cos(w * dt);
    sn = sin(w * dt) / w;
  } else {
    c = 1 + 0.5 * x2;
    sn = dt * (1 + x2 / 6);
  }
  const f11 = c + sn * l11, f12 = sn * l12, f21 = sn * l21, f22 = c - sn * l11;
  const t11 = f11 * cxx + f12 * cxy, t12 = f11 * cxy + f12 * cyy, t21 = f21 * cxx + f22 * cxy, t22 = f21 * cxy + f22 * cyy;
  CO[0] = t11 * f11 + t12 * f12;
  CO[1] = t11 * f21 + t12 * f22;
  CO[2] = t21 * f21 + t22 * f22;
}
// One local update: relax half a step, stretch a whole one, relax half a step.
const CS = new Float64Array(3);
function local(cxx, cxy, cyy, l11, l12, l21, dt, lam, LL) {
  const dl = (0.5 * dt) / lam;
  relax(cxx, cxy, cyy, dl, LL);
  stretch(CO[0], CO[1], CO[2], l11, l12, l21, dt);
  relax(CO[0], CO[1], CO[2], dl, LL);
}
// The symmetric square root of a 2 by 2 positive definite matrix: S = (C + sqrt(det C) I) / sqrt(tr C + 2 sqrt(det C)).
function sqrtm(cxx, cxy, cyy) {
  const d = cxx * cyy - cxy * cxy, s = d > 1e-300 ? sqrt(d) : 0, t = 1 / sqrt(cxx + cyy + 2 * s);
  CS[0] = (cxx + s) * t;
  CS[1] = cxy * t;
  CS[2] = (cyy + s) * t;
}

const MIR = new Int32Array(N), KX = new Float64Array(N), KY = new Float64Array(N), FILT = new Float64Array(N);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, ni = i < W / 2 ? i : i - W, nj = j < H / 2 ? j : j - H;
    MIR[p] = ((H - j) % H) * W + ((W - i) % W);
    KX[p] = (TAU * ni) / W;
    KY[p] = (TAU * nj) / H;
    const r2 = pow(ni / (W / 2), 2) + pow(nj / (H / 2), 2);
    FILT[p] = ni === -W / 2 || nj === -H / 2 || (!ni && !nj) ? 0 : exp(-36 * pow(r2, 8));
  }

const mk = () => new Float64Array(N);
function makeState() {
  return {
    a: mk(), b: mk(), d: mk(), a2: mk(), b2: mk(), d2: mk(), // S and the next S
    u: mk(), v: mk(), l11: mk(), l12: mk(), l21: mk(), // the flow of the current state
    pu: mk(), pv: mk(), p11: mk(), p12: mk(), p21: mk(), // and the one before
    gu: mk(), gv: mk(), g11: mk(), g12: mk(), g21: mk(), // the Stokes solution the flow is lagging behind
    eu: mk(), ev: mk(), e11: mk(), e12: mk(), e21: mk(), // extrapolated to the middle of the step
    zr: mk(), zi: mk(), ar: mk(), ai: mk(), br: mk(), bi: mk(), cr: mk(), ci: mk(),
    t: 0, dtp: 0, lam: 4, tauU: 0.5, LL: LLMAX, beta: BETA,
    modes: [], force: true, ou: true,
    nclip: 0, steps: 0,
  };
}

// ---- forcing: a field of large-scale modes whose complex amplitudes wander (Ornstein-Uhlenbeck) ---------------
// Every lattice mode (nx / 64, ny / 128) with |k| under KMAX is kept; the weight of each one is a bump about the forcing wavenumber kf.
const KMAX = 0.5, KXN = 5, KYN = 10, TAUF = 8;
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
function makeModes() {
  const m = [];
  for (let ni = 0; ni <= KXN; ni++)
    for (let nj = -KYN; nj <= KYN; nj++) {
      if (ni === 0 && nj <= 0) continue;
      const kx = (TAU * ni) / W, ky = (TAU * nj) / H, k2 = kx * kx + ky * ky;
      if (k2 > KMAX * KMAX) continue;
      m.push({ p: ((nj + H) % H) * W + ni, pm: ((H - nj) % H) * W + ((W - ni) % W), kx, ky, k2, k: sqrt(k2), zr: gauss() * sqrt(0.5), zi: gauss() * sqrt(0.5), w: 0 });
    }
  return m;
}
function setBand(S, kf) {
  let s2 = 0;
  for (const m of S.modes) {
    m.w = exp(-0.5 * pow((m.k / kf - 1) / 0.3, 2));
    s2 += m.w * m.w;
  }
  S.cf = sqrt(2 / s2);
}
function forceOU(S, dt) {
  const e = exp(-dt / TAUF), s = sqrt(1 - e * e) * sqrt(0.5);
  for (const m of S.modes) {
    m.zr = m.zr * e + s * gauss();
    m.zi = m.zi * e + s * gauss();
  }
}

// ---- the flow: Stokes, solved in Fourier space from the polymer stress and the forcing ---------------------------
// With u = (psi_y, -psi_x): beta k^4 psi = curl(div tau + F) = (ky^2 - kx^2) tau_xy - kx ky (tau_yy - tau_xx) + curl F. The stress is the FFT of
// z = tau_xy + i (tau_yy - tau_xx), two real fields in one transform. The velocity and its gradient come back in three transforms.
function flow(S, dt) {
  const { a, b, d, zr, zi, ar, ai, br, bi, cr, ci } = S, LL = S.LL, G = (1 - S.beta) / S.lam, iN = 1 / N;
  for (let p = 0; p < N; p++) {
    const sa = a[p], sb = b[p], sd = d[p], cxx = sa * sa + sb * sb, cxy = sb * (sa + sd), cyy = sb * sb + sd * sd;
    const s = min(cxx + cyy, LL * (1 - 1e-9)), g = (G * (LL - 2)) / (LL - s);
    zr[p] = g * cxy;
    zi[p] = g * (cyy - cxx);
  }
  fft2(zr, zi, false);
  for (let p = 0; p < N; p++) {
    const q = MIR[p], kx = KX[p], ky = KY[p], k2 = kx * kx + ky * ky;
    if (!FILT[p]) {
      ar[p] = ai[p] = 0;
      continue;
    }
    const tr = zr[p] + zr[q], ti = zi[p] - zi[q], nr = zi[p] + zi[q], ni = zr[q] - zr[p];
    ar[p] = (0.5 * iN) * ((ky * ky - kx * kx) * tr - kx * ky * nr);
    ai[p] = (0.5 * iN) * ((ky * ky - kx * kx) * ti - kx * ky * ni);
  }
  if (S.force) {
    if (S.ou) forceOU(S, dt);
    for (const m of S.modes) {
      const amp = 0.5 * m.k2 * S.cf * m.w; // a = k^2 g, the coefficient of cos is a / 2 at k and at -k
      const xr = amp * m.zr, xi = amp * m.zi;
      ar[m.p] += xr;
      ai[m.p] += xi;
      ar[m.pm] += xr;
      ai[m.pm] -= xi;
    }
  }
  const ib = 1 / S.beta;
  for (let p = 0; p < N; p++) {
    const f = FILT[p];
    if (!f) {
      br[p] = bi[p] = cr[p] = ci[p] = 0;
      continue;
    }
    const kx = KX[p], ky = KY[p], k2 = kx * kx + ky * ky, c = (ib * f) / (k2 * k2), pr = ar[p] * c, pi = ai[p] * c;
    // u = i ky psi, v = -i kx psi, L11 = -kx ky psi, L12 = -ky^2 psi, L21 = kx^2 psi; A = u + i L11, B = v + i L12
    const l11r = -kx * ky * pr, l11i = -kx * ky * pi, l12r = -ky * ky * pr, l12i = -ky * ky * pi;
    ar[p] = -ky * pi - l11i;
    ai[p] = ky * pr + l11r;
    br[p] = kx * pi - l12i;
    bi[p] = -kx * pr + l12r;
    cr[p] = kx * kx * pr;
    ci[p] = kx * kx * pi;
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  fft2(cr, ci, true);
  // the flow of the step before moves back one place, the new one is read off the transforms
  let t = S.pu;
  S.pu = S.u;
  S.u = t;
  t = S.pv;
  S.pv = S.v;
  S.v = t;
  t = S.p11;
  S.p11 = S.l11;
  S.l11 = t;
  t = S.p12;
  S.p12 = S.l12;
  S.l12 = t;
  t = S.p21;
  S.p21 = S.l21;
  S.l21 = t;
  // the flow follows its Stokes solution with a lag tauU, y' = (g - y) / tauU, stepped exactly for a g that is linear over the step
  const { u, v, l11, l12, l21, pu, pv, p11, p12, p21, gu, gv, g11, g12, g21 } = S, h = dt / S.tauU, ee = dt > 0 ? exp(-h) : 0, c1 = dt > 0 ? 1 - ee : 0, c2 = dt > 0 ? 1 - c1 / h : 1;
  for (let p = 0; p < N; p++) {
    let g = ar[p];
    u[p] = ee * pu[p] + c1 * gu[p] + c2 * (g - gu[p]);
    gu[p] = g;
    g = ai[p];
    l11[p] = ee * p11[p] + c1 * g11[p] + c2 * (g - g11[p]);
    g11[p] = g;
    g = br[p];
    v[p] = ee * pv[p] + c1 * gv[p] + c2 * (g - gv[p]);
    gv[p] = g;
    g = bi[p];
    l12[p] = ee * p12[p] + c1 * g12[p] + c2 * (g - g12[p]);
    g12[p] = g;
    g = cr[p];
    l21[p] = ee * p21[p] + c1 * g21[p] + c2 * (g - g21[p]);
    g21[p] = g;
  }
}

// ---- look-up -------------------------------------------------------------------------------------------------
// bilinear, for the velocity and its gradient (smooth)
let b00 = 0, b10 = 0, b01 = 0, b11 = 0, bwx = 0, bwy = 0;
function locate(x, y) {
  const ix = floor(x), iy = floor(y), r0 = (iy & HM) * W, r1 = ((iy + 1) & HM) * W, x0 = ix & WM, x1 = (ix + 1) & WM;
  bwx = x - ix;
  bwy = y - iy;
  b00 = r0 + x0;
  b10 = r0 + x1;
  b01 = r1 + x0;
  b11 = r1 + x1;
}
function samp(F) {
  const t0 = F[b00] + (F[b10] - F[b00]) * bwx, t1 = F[b01] + (F[b11] - F[b01]) * bwx;
  return t0 + (t1 - t0) * bwy;
}
// cubic Lagrange over 4 by 4 nodes, then held between the smallest and the largest of the four nearest nodes
const XI = new Int32Array(4), YR = new Int32Array(4), WX = new Float64Array(4), WY = new Float64Array(4);
function locate4(x, y) {
  const ix = floor(x), iy = floor(y);
  let t = x - ix;
  WX[0] = (-t * (t - 1) * (t - 2)) / 6;
  WX[1] = ((t + 1) * (t - 1) * (t - 2)) / 2;
  WX[2] = (-(t + 1) * t * (t - 2)) / 2;
  WX[3] = ((t + 1) * t * (t - 1)) / 6;
  t = y - iy;
  WY[0] = (-t * (t - 1) * (t - 2)) / 6;
  WY[1] = ((t + 1) * (t - 1) * (t - 2)) / 2;
  WY[2] = (-(t + 1) * t * (t - 2)) / 2;
  WY[3] = ((t + 1) * t * (t - 1)) / 6;
  for (let k = 0; k < 4; k++) {
    XI[k] = (ix + k - 1) & WM;
    YR[k] = ((iy + k - 1) & HM) * W;
  }
}
function cubic(F) {
  let v = 0;
  for (let j = 0; j < 4; j++) {
    const o = YR[j];
    v += WY[j] * (WX[0] * F[o + XI[0]] + WX[1] * F[o + XI[1]] + WX[2] * F[o + XI[2]] + WX[3] * F[o + XI[3]]);
  }
  const q = F[YR[1] + XI[1]], r = F[YR[1] + XI[2]], s = F[YR[2] + XI[1]], w = F[YR[2] + XI[2]];
  const lo = min(min(q, r), min(s, w)), hi = max(max(q, r), max(s, w));
  return v < lo ? lo : v > hi ? hi : v;
}

// ---- one step: extrapolate the flow to the middle of the step, trace each cell back along it, and update locally there ------------
function step(S, dt) {
  const { a, b, d, a2, b2, d2, u, v, l11, l12, l21, pu, pv, p11, p12, p21, eu, ev, e11, e12, e21 } = S, lam = S.lam, LL = S.LL;
  const r = S.dtp > 0 ? dt / (2 * S.dtp) : 0, hd = 0.5 * dt;
  for (let p = 0; p < N; p++) {
    eu[p] = u[p] + (u[p] - pu[p]) * r;
    ev[p] = v[p] + (v[p] - pv[p]) * r;
    e11[p] = l11[p] + (l11[p] - p11[p]) * r;
    e12[p] = l12[p] + (l12[p] - p12[p]) * r;
    e21[p] = l21[p] + (l21[p] - p21[p]) * r;
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      locate(x - hd * eu[p], y - hd * ev[p]);
      let um = samp(eu), vm = samp(ev);
      locate(x - hd * um, y - hd * vm);
      um = samp(eu);
      vm = samp(ev);
      let g11 = samp(e11), g12 = samp(e12), g21 = samp(e21);
      const gg = g11 * g11 + g12 * g12 + g21 * g21;
      if (gg > LCAP2) {
        const k = LCAP / sqrt(gg);
        (g11 *= k), (g12 *= k), (g21 *= k);
        NCAP++;
      }
      locate4(x - dt * um, y - dt * vm);
      const sa = cubic(a), sb = cubic(b), sd = cubic(d);
      local(sa * sa + sb * sb, sb * (sa + sd), sb * sb + sd * sd, g11, g12, g21, dt, lam, LL);
      sqrtm(CO[0], CO[1], CO[2]);
      a2[p] = CS[0];
      b2[p] = CS[1];
      d2[p] = CS[2];
    }
  S.a = a2;
  S.b = b2;
  S.d = d2;
  S.a2 = a;
  S.b2 = b;
  S.d2 = d;
  S.t += dt;
  S.dtp = dt;
  S.steps++;
  flow(S, dt);
}

// start: C = I, the flow of that state
function reset(S) {
  S.a.fill(1);
  S.b.fill(0);
  S.d.fill(1);
  S.t = 0;
  S.dtp = 0;
  S.steps = 0;
  for (const k of ["gu", "gv", "g11", "g12", "g21"]) S[k].fill(0);
  flow(S, 0);
  S.pu.set(S.u);
  S.pv.set(S.v);
  S.p11.set(S.l11);
  S.p12.set(S.l12);
  S.p21.set(S.l21);
}

// ---- the picture --------------------------------------------------------------------------------------------------
// e = ln(tr C / 2) / ln(LL / 2) is how far a cell is stretched, 0 for relaxed fluid and 1 at the bound; the picture shows e between its
// 6th and 99.5th percentile of the frame (followed over about 6 s, so the contrast does not depend on Wi). The vorticity w = v_x - u_y gives
// the colour pair: the sense of the turning. Two frames are kept, the newest step and the one before, and the panel shows the mix.
const NQ = 128, hist = new Int32Array(NQ);
function shade(S) {
  const { a, b, d, l12, l21 } = S, il = 1 / log(S.LL / 2);
  let t = S.eA;
  S.eA = S.eB;
  S.eB = t;
  t = S.wA;
  S.wA = S.wB;
  S.wB = t;
  const { eB, wB } = S;
  hist.fill(0);
  let om = 0, bad = 0;
  for (let p = 0; p < N; p++) {
    const sa = a[p], sb = b[p], sd = d[p], tr = sa * sa + 2 * sb * sb + sd * sd, w = l21[p] - l12[p];
    const e = cl(log(tr * 0.5) * il, 0, 0.9999);
    if (!(tr < 1e6)) bad = 1;
    eB[p] = e;
    wB[p] = w;
    hist[(e * NQ) | 0]++;
    om += w * w;
  }
  let c = 0, q0 = 0, q1 = NQ;
  for (let k = 0; k < NQ; k++) {
    c += hist[k];
    if (c < 0.06 * N) q0 = k + 1;
    if (c < 0.995 * N) q1 = k + 1;
  }
  S.q0 = q0 / NQ;
  S.q1 = max(q1 / NQ, S.q0 + 0.1);
  S.om = sqrt(om / N) + 1e-9;
  return bad;
}

// ---- colour: two ramps in Oklab, a cool one for fluid turning one way and a warm one for the other, both from a dark base ------------
function okLab(L, a0, b0, out) {
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = a0 * k, b = b0 * k;
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
const enc = (v) => ((((v = cl(v, 0, 1)) <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0);
const RGB = [0, 0, 0];
// stops [v, L, C, hue] of the warm ramp (w = +1) and of the cool one (w = -1). The stop at zero does not turn with Hue, so the dark between
// the filaments stays a deep indigo or plum at every setting.
const WARM = [[0, 0.2, 0.07, 335], [0.3, 0.46, 0.17, 12], [0.62, 0.7, 0.18, 45], [0.88, 0.9, 0.1, 85], [1, 0.99, 0.03, 100]];
const COOL = [[0, 0.2, 0.07, 265], [0.3, 0.46, 0.15, 258], [0.62, 0.7, 0.13, 220], [0.88, 0.9, 0.06, 200], [1, 0.99, 0.02, 200]];
const NW = 17, LUT = new Uint8Array(NQ * NW * 3);
// the largest chroma sRGB holds at lightness L and hue h (radians), by bisection
function cmax(L, h) {
  const ch = cos(h), sh = sin(h);
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 12; i++) {
    const c = 0.5 * (lo + hi), a = c * ch, b = c * sh;
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (r > 0 && r < 1 && g > 0 && g < 1 && bb > 0 && bb < 1) lo = c;
    else hi = c;
  }
  return lo;
}
// the stops of a ramp as [v, L, a, b]: Hue is added to the hue of every stop but the one at zero, and the lightness of a stop is raised, never
// lowered and by at most 0.12, until its hue can hold 85 per cent of its chroma (a dark yellow-green is olive, so it comes up to a lighter lime).
// The colours between two stops are joined in a and b, so a turn of Hue goes through grey and not through the rainbow.
function stops(st, hue) {
  return st.map(([v, L0, C, h0]) => {
    const h = ((h0 + (v > 0 ? hue : 0)) * PI) / 180;
    let L = L0;
    while (L < L0 + 0.12 && cmax(L, h) < 0.85 * C) L += 0.015;
    return [v, L, C * cos(h), C * sin(h)];
  });
}
function ramp(sl, v, o) {
  let j = 1;
  while (j < sl.length - 1 && v > sl[j][0]) j++;
  const A = sl[j - 1], B = sl[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
  o[0] = A[1] + (B[1] - A[1]) * t;
  o[1] = A[2] + (B[2] - A[2]) * t;
  o[2] = A[3] + (B[3] - A[3]) * t;
}
const RA = [0, 0, 0], RB = [0, 0, 0];
function buildLut(hue) {
  const sw = stops(WARM, hue * 360), sc = stops(COOL, hue * 360);
  for (let i = 0; i < NQ; i++) {
    const v = i / (NQ - 1);
    ramp(sw, v, RA);
    ramp(sc, v, RB);
    for (let k = 0; k < NW; k++) {
      const m = k / (NW - 1);
      okLab(RB[0] + (RA[0] - RB[0]) * m, RB[1] + (RA[1] - RB[1]) * m, RB[2] + (RA[2] - RB[2]) * m, RGB);
      const o = (i * NW + k) * 3;
      LUT[o] = enc(RGB[0]);
      LUT[o + 1] = enc(RGB[1]);
      LUT[o + 2] = enc(RGB[2]);
    }
  }
}

// ---- the pattern --------------------------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const DT0 = 0.05, MAXSTEPS = 6, CLOCK = 0.5, KF0 = 0.2, PRE = 10; // step (units of 1 / gamma0), most steps a frame, model time a second per unit of Flow, forcing wavenumber at Scale 0
const LAM0 = 2.5, LAMB = 2.4; // Weissenberg number lam gamma0 = 2.5 times 2.4 to the knob
const KFB = 1.3, GAM = 1.8;

export function setup(params) {
  const S = makeState();
  S.modes = makeModes();
  Object.assign(S, { eA: new Float32Array(N), eB: new Float32Array(N), wA: new Float32Array(N), wB: new Float32Array(N), acc: 0, ready: false, lutHue: -1, hue: 0, flowk: 2, lamT: 3, kfT: KF0, elo: 0.1, ehi: 0.7, om: 1, q0: 0.1, q1: 0.7, nbad: 0 });
  params.s = S;
  return S;
}
function spin(S) {
  setBand(S, S.kfT);
  reset(S);
  shade(S);
  shade(S);
  // the polymer is let in slowly, lam from 0.3 to its value over the first 8 / 10 of the run: from fluid at rest the first stretch has nothing to push back
  while (S.t < PRE) {
    S.lam = S.lamT * (0.1 + 0.9 * sm(0, 0.8 * PRE, S.t));
    step(S, DT0);
  }
  S.lam = S.lamT;
  shade(S);
}
export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN, ft = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.flowk = cl(k[1], 0.1, 8);
  S.lamT = LAM0 * pow(LAMB, cl(k[3], -1.2, 1.2));
  S.kfT = KF0 * pow(KFB, -cl(k[2], -1.2, 1.2));
  if (!S.ready) {
    S.ready = true;
    S.kf = S.kfT;
    S.elo = S.q0 = 0.1;
    spin(S);
    S.elo = S.q0;
    S.ehi = S.q1;
  }
  const f = 1 - exp(-ft / 1.2);
  S.lam += (S.lamT - S.lam) * f;
  S.kf += (S.kfT - S.kf) * f;
  setBand(S, S.kf);
  S.acc += ft * CLOCK * S.flowk * (S.kf / KF0);
  let n = 0;
  while (S.acc >= DT0 && n < MAXSTEPS) {
    step(S, DT0);
    S.acc -= DT0;
    n++;
    if (shade(S)) S.nbad++;
  }
  if (n === MAXSTEPS) S.acc = min(S.acc, DT0);
  const g = 1 - exp(-ft / 6);
  S.elo += (S.q0 - S.elo) * g;
  S.ehi += (S.q1 - S.ehi) * g;
}
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) {
    S.lutHue = S.hue;
    buildLut(S.hue);
  }
  const { eA, eB, wA, wB } = S, ph = cl(S.acc / DT0, 0, 1), il = 1 / (S.ehi - S.elo), lo = S.elo, iw = 1.2 / S.om;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const e = eA[p] + (eB[p] - eA[p]) * ph, w = wA[p] + (wB[p] - wA[p]) * ph;
      const v = pow(cl((e - lo) * il, 0, 1), GAM), m = tanh(w * iw) * 0.5 + 0.5, o = ((((v * (NQ - 1) + 0.5) | 0) * NW) + ((m * (NW - 1) + 0.5) | 0)) * 3;
      display.setPixel(x, y, LUT[o], LUT[o + 1], LUT[o + 2]);
    }
}
