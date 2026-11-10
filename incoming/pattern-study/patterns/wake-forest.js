// ===== Patternflow pattern =====
// Title:   Wake Forest
// Family:  sim
// Idea:    Water runs down the panel through a stand of round posts, every post sheds its own street of eddies that run into the posts behind, and the lines of dye let into the top are split, caught in the wakes and braided
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   125
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Reynolds=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Flow. draft
// Knob 3: Scale. draft
// Knob 4: Reynolds. draft

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, tanh, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  u0: 3.0, // mean flow, LEDs per model second
  tauU: 2.0, // the mean flow is pulled to its target at this rate
  angS: 0.11, // rms of the direction of the push, radians
  angT: 14, // its correlation time, model seconds
  spdS: 0.22, // rms of the push's strength as a share of u0
  spdT: 9,
  re0: 160, // Reynolds number on the post of the nominal diameter at Reynolds 0
  d0: 5.8, // nominal post diameter
  hyp: 0.004,
  fric: 0.5, // drag on the largest eddies, fric / (1 + (k / fricK)^4), so that wakes do not pile into one big vortex
  fricK: 0.12,
  eta: 0.002, // Brinkman time
  delta: 0.75, // half width of a post's edge, LEDs
  dt: 0.1,
  pre: 28,
  cfl: 0.8,
  nStripe: 12,
  stripeS: 1.1,
  rin: 3.0,
  spg: 0.4, // rate of the screen at the top, 1 / model second, which pulls every eddy back to the mean flow
  ysp: 12,
  yin: 8,
  rout: 1.4,
  yout: 9,
  postTop: 21,
  postBot: 118,
  cdiff: 0.03,
};

// ---- radix-2 FFT, rows contiguous, columns by butterflies across rows ----
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

const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());

// ---- wavenumbers of the torus ----
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N), MIR = new Int32Array(N);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    FIL[p] = exp(-36 * pow(sqrt(K2[p]) / 1.8, 16));
    MIR[p] = ((H - j) & HM) * W + ((W - i) & WM);
  }
// distance across the seam of a torus
const wrapd = (d, L) => {
  d = ((d % L) + L) % L;
  return d > L / 2 ? d - L : d;
};

// ---- where the posts stand ----
// 18 sites. x comes from the golden-ratio sequence so that any first n of them leave no wide lane,
// y from the best of 24 tries (the farthest from the posts already placed); of 30 such stands
// the one in which most posts have another in their wake is kept.
function makeLayout() {
  const PHI = 0.6180339887498949;
  let best = null, bestScore = -1;
  for (let tries = 0; tries < 30; tries++) {
    const off = Math.random() * W, pts = [];
    for (let i = 0; i < 18; i++) {
      const x = (off + i * PHI * W + (Math.random() - 0.5) * 3 + W * 4) % W;
      let by = 0, bd = -1;
      for (let k = 0; k < 24; k++) {
        const y = CFG.postTop + Math.random() * (CFG.postBot - CFG.postTop);
        let d = 1e9;
        for (const q of pts) {
          const dx = wrapd(x - q.x, W), dy = y - q.y;
          d = min(d, dx * dx + dy * dy);
        }
        if (d > bd) (bd = d), (by = y);
      }
      pts.push({ x, y: by });
    }
    let sc = 0;
    for (const n of [12, 15, 18]) {
      let hit = 0;
      for (let i = 0; i < n; i++) {
        let h = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = wrapd(pts[j].x - pts[i].x, W), dy = pts[j].y - pts[i].y;
          if (dy > 12 && dy < 52 && abs(dx) < 6 + 0.12 * dy) h = 1;
        }
        hit += h;
      }
      sc += hit / n;
    }
    if (sc > bestScore) (bestScore = sc), (best = pts);
  }
  return best;
}

function buildMask(S) {
  const chi = S.chi, d = CFG.delta;
  chi.fill(0);
  for (let j = 0; j < S.posts.length; j++) {
    const q = S.posts[j], R = S.R * S.grow[j];
    if (R < 0.9) continue;
    const ext = ceil(R + 4 * d), x0 = floor(q.x), y0 = floor(q.y);
    for (let dy = -ext; dy <= ext; dy++) {
      const yy = y0 + dy;
      if (yy < 0 || yy > HM) continue;
      for (let dx = -ext; dx <= ext; dx++) {
        const xx = (x0 + dx + W * 4) & WM, ry = yy - q.y, rx = x0 + dx - q.x;
        const v = 0.5 * (1 - tanh((sqrt(rx * rx + ry * ry) - R) / d));
        const p = yy * W + xx;
        if (v > chi[p]) chi[p] = v;
      }
    }
  }
}

// ---- the flow ----
function rhs(S, wr, wi, oR, oI, save) {
  const { ar, ai, br, bi } = S, Um = S.Um, Vm = S.Vm;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const sr = wr[p] / k2, si = wi[p] / k2;
      ar[p] = KX[p] * sr - KY[p] * si;
      ai[p] = KY[p] * sr + KX[p] * si;
    }
    br[p] = -KX[p] * wi[p] - KY[p] * wr[p];
    bi[p] = KX[p] * wr[p] - KY[p] * wi[p];
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  if (save) {
    // the velocity of the start of the step, which the dye is carried by
    let mx = 0.5;
    for (let p = 0; p < N; p++) {
      const a = ar[p] + Um, b = ai[p] + Vm;
      S.U[p] = a;
      S.V[p] = b;
      if (abs(a) > mx) mx = abs(a);
      if (abs(b) > mx) mx = abs(b);
    }
    S.um = mx;
  }
  for (let p = 0; p < N; p++) {
    ar[p] = (ar[p] + Um) * br[p] + (ai[p] + Vm) * bi[p];
    ai[p] = 0;
  }
  fft2(ar, ai, false);
  const inv = 1 / N, nu = S.nu, hy = CFG.hyp, fr = CFG.fric;
  for (let p = 0; p < N; p++) {
    const q = K2[p] / (CFG.fricK * CFG.fricK), d = nu * K2[p] + hy * K2[p] * K2[p] + fr / (1 + q * q);
    oR[p] = -ar[p] * inv * FIL[p] - d * wr[p];
    oI[p] = -ai[p] * inv * FIL[p] - d * wi[p];
  }
}

// Brinkman step: the total velocity times 1 / (1 + dt chi / eta), then back to the vorticity of that field
// (which is the projection: what the curl leaves out is the part a pressure would take away)
function penalize(S, dt) {
  const { wr, wi, ar, ai, chi } = S;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const sr = wr[p] / k2, si = wi[p] / k2;
      ar[p] = KX[p] * sr - KY[p] * si;
      ai[p] = KY[p] * sr + KX[p] * si;
    }
  }
  fft2(ar, ai, true);
  const a = dt / CFG.eta, Um = S.Um, Vm = S.Vm, spg = S.spg;
  let su = 0, sv = 0;
  for (let p = 0; p < N; p++) {
    const q = spg[p >> 6] * dt, f = 1 / (1 + q + a * chi[p]), u = (ar[p] + Um + q * Um) * f, v = (ai[p] + Vm + q * Vm) * f;
    ar[p] = u;
    ai[p] = v;
    su += u;
    sv += v;
  }
  S.Um = su / N;
  S.Vm = sv / N;
  fft2(ar, ai, false);
  const inv = 1 / N;
  for (let p = 0; p < N; p++) {
    const q = MIR[p], Pr = ar[p], Pi = ai[p], Qr = ar[q], Qi = ai[q];
    const ur = 0.5 * (Pr + Qr), ui = 0.5 * (Pi - Qi), vr = 0.5 * (Pi + Qi), vi = -0.5 * (Pr - Qr);
    // the transform of the packed pair is read before this loop overwrites it, so go through temporaries
    S.tr[p] = (-KX[p] * vi + KY[p] * ui) * inv * FIL[p];
    S.ti[p] = (KX[p] * vr - KY[p] * ur) * inv * FIL[p];
  }
  wr.set(S.tr);
  wi.set(S.ti);
  wr[0] = wi[0] = 0;
}

// ---- the dye: flux form, second order upwind with the monotonised central limiter ----
const SL = new Float64Array(max(W, H) + 2), FX = new Float64Array(max(W, H) + 2);
const mc = (a, b) => {
  if (a * b <= 0) return 0;
  const s = a > 0 ? 1 : -1, x = abs(a), y = abs(b), z = 0.5 * (x + y);
  return s * min(2 * x, 2 * y, z);
};
function sweepX(R, U, dt) {
  for (let j = 0; j < H; j++) {
    const o = j * W;
    for (let i = 0; i < W; i++) SL[i] = mc(R[o + i] - R[o + ((i - 1) & WM)], R[o + ((i + 1) & WM)] - R[o + i]);
    for (let i = 0; i < W; i++) {
      const ip = (i + 1) & WM, u = 0.5 * (U[o + i] + U[o + ip]), nu = u * dt;
      FX[i] = u > 0 ? u * (R[o + i] + 0.5 * (1 - nu) * SL[i]) : u * (R[o + ip] - 0.5 * (1 + nu) * SL[ip]);
    }
    for (let i = 0; i < W; i++) R[o + i] -= dt * (FX[i] - FX[(i - 1) & WM]);
  }
}
function sweepY(R, V, dt) {
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) SL[j] = mc(R[j * W + i] - R[((j - 1) & HM) * W + i], R[((j + 1) & HM) * W + i] - R[j * W + i]);
    for (let j = 0; j < H; j++) {
      const jp = (j + 1) & HM, v = 0.5 * (V[j * W + i] + V[jp * W + i]), nu = v * dt;
      FX[j] = v > 0 ? v * (R[j * W + i] + 0.5 * (1 - nu) * SL[j]) : v * (R[jp * W + i] - 0.5 * (1 + nu) * SL[jp]);
    }
    for (let j = 0; j < H; j++) R[j * W + i] -= dt * (FX[j] - FX[(j - 1) & HM]);
  }
}

// ---- the push, the inlet stripes ----
function ou(x, T, s, dt) {
  const d = exp(-dt / T);
  return x * d + s * sqrt(1 - d * d) * gauss();
}
function drift(S, dt) {
  S.th = ou(S.th, CFG.angT, CFG.angS, dt);
  S.sp = ou(S.sp, CFG.spdT, CFG.spdS, dt);
  const u = CFG.u0 * cl(1 + S.sp, 0.45, 1.6);
  S.Ux = u * sin(S.th);
  S.Uy = u * cos(S.th);
  for (let i = 0; i < CFG.nStripe; i++) {
    S.sv[i] = ou(S.sv[i], 3.0, 0.5, dt);
    S.sj[i] = ou(S.sj[i], 6.0, 0.8, dt);
  }
}
function stripes(S) {
  const n = CFG.nStripe, sp = W / n, ca = S.c0a, cb = S.c0b, sg = CFG.stripeS;
  ca.fill(0);
  cb.fill(0);
  for (let i = 0; i < n; i++) {
    const xc = (i + 0.5) * sp + S.sj[i], v = cl(0.72 + S.sv[i], 0.2, 1), dst = i % 2 ? cb : ca;
    for (let k = -5; k <= 5; k++) {
      const x = floor(xc) + k, d = x - xc;
      dst[(x + W * 4) & WM] += v * exp(-(d * d) / (2 * sg * sg));
    }
  }
  for (let x = 0; x < W; x++) (ca[x] = min(ca[x], 1)), (cb[x] = min(cb[x], 1));
}

function step(S, dt) {
  const { wr, wi, k1r, k1i, k2r, k2i, tr, ti } = S;
  // Shu and Osher's third order scheme
  rhs(S, wr, wi, k1r, k1i, true);
  for (let p = 0; p < N; p++) (tr[p] = wr[p] + dt * k1r[p]), (ti[p] = wi[p] + dt * k1i[p]);
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (tr[p] = 0.75 * wr[p] + 0.25 * (tr[p] + dt * k2r[p])), (ti[p] = 0.75 * wi[p] + 0.25 * (ti[p] + dt * k2i[p]));
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (wr[p] = (wr[p] + 2 * (tr[p] + dt * k2r[p])) / 3), (wi[p] = (wi[p] + 2 * (ti[p] + dt * k2i[p])) / 3);
  // the dye goes with the velocity at the start of the step
  const n = max(1, ceil((S.um * dt) / CFG.cfl)), ds = dt / n;
  for (let i = 0; i < n; i++)
    for (const c of [S.ca, S.cb]) {
      sweepX(c, S.U, 0.5 * ds);
      sweepY(c, S.V, ds);
      sweepX(c, S.U, 0.5 * ds);
    }
  penalize(S, dt);
  // the push: the mean velocity is pulled to its target
  const a = dt / CFG.tauU;
  S.Um += a * (S.Ux - S.Um);
  S.Vm += a * (S.Uy - S.Vm);
  // dye: stripes let in at the top, taken out at the bottom, no dye in a post, a little diffusion
  const cd = CFG.cdiff * dt, t = S.t2, ch = S.chi;
  for (let d = 0; d < 2; d++) {
    const c = d ? S.cb : S.ca, c0 = d ? S.c0b : S.c0a;
    for (let j = 0; j < H; j++) {
      const o = j * W, up = ((j - 1) & HM) * W, dn = ((j + 1) & HM) * W, ri = S.rin[j], ro = S.rout[j];
      for (let i = 0; i < W; i++) {
        const p = o + i;
        let v = c[p] + cd * (c[o + ((i - 1) & WM)] + c[o + ((i + 1) & WM)] + c[up + i] + c[dn + i] - 4 * c[p]);
        if (ri > 0) v += min(1, ri * dt) * (c0[i] - v);
        if (ro > 0) v -= min(1, ro * dt) * v;
        const cx = ch[p];
        t[p] = cx > 0.55 ? v / (1 + 40 * dt * (cx - 0.55) / 0.45) : v;
      }
    }
    c.set(t);
  }
  S.time += dt;
}

const nuOf = (v) => (CFG.u0 * CFG.d0) / (CFG.re0 * pow(1.6, cl(v, -1.2, 1.2)));
const radOf = (v) => 2.9 * pow(1.2, cl(v, -1.2, 1.2));
const cntOf = (v) => 15 - 3 * cl(v, -1.2, 1.2);

function start(params, k) {
  const mk = () => new Float64Array(N);
  const S = {
    wr: mk(), wi: mk(), ar: mk(), ai: mk(), br: mk(), bi: mk(), k1r: mk(), k1i: mk(), k2r: mk(), k2i: mk(), tr: mk(), ti: mk(),
    U: mk(), V: mk(), ca: mk(), cb: mk(), t2: mk(), chi: mk(), om: new Float32Array(N), os: 0, c0a: new Float64Array(W), c0b: new Float64Array(W),
    rin: new Float64Array(H), spg: new Float64Array(H), rout: new Float64Array(H), sv: new Float64Array(CFG.nStripe), sj: new Float64Array(CFG.nStripe),
    um: 0, Um: 0, Vm: CFG.u0, Ux: 0, Uy: CFG.u0, th: 0, sp: 0,
    nu: nuOf(k[3]), R: radOf(k[2]), cnt: cntOf(k[2]), grow: new Float64Array(18), posts: null, rr: -1, hue: 0, lutHue: -9, col: null, acc: 0, time: 0, ready: false,
  };
  params.s = S;
  S.posts = makeLayout();
  for (let y = 0; y < H; y++) {
    if (y < CFG.yin) S.rin[y] = CFG.rin * 0.5 * (1 + cos((PI * y) / CFG.yin));
    if (y < CFG.ysp) S.spg[y] = CFG.spg * 0.5 * (1 + cos((PI * y) / CFG.ysp));
    const e = y - (H - CFG.yout);
    if (e >= 0) S.rout[y] = CFG.rout * 0.5 * (1 - cos((PI * (e + 0.5)) / CFG.yout));
  }
  for (let i = 0; i < CFG.nStripe; i++) (S.sv[i] = gauss() * 0.5), (S.sj[i] = gauss() * 0.8);
  S.th = gauss() * CFG.angS;
  S.sp = gauss() * CFG.spdS;
  drift(S, 0);
  S.Um = S.Ux;
  S.Vm = S.Uy;
  for (let j = 0; j < 18; j++) S.grow[j] = cl(S.cnt - j, 0, 1);
  buildMask(S);
  // a little vorticity at the scale of the wakes to start the first eddies
  for (let p = 1; p < N; p++) {
    const kk = sqrt(K2[p]);
    if (kk > 0.12 && kk < 0.9 && p < MIR[p]) {
      const gr = 0.02 * gauss(), gi = 0.02 * gauss();
      S.wr[p] = gr;
      S.wi[p] = gi;
      S.wr[MIR[p]] = gr;
      S.wi[MIR[p]] = -gi;
    }
  }
  stripes(S);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) (S.ca[j * W + i] = j < H - CFG.yout ? S.c0a[i] : 0), (S.cb[j * W + i] = j < H - CFG.yout ? S.c0b[i] : 0);
  S.um = CFG.u0;
  for (let t = 0; t < CFG.pre; ) {
    const h = S.um * 1.8 * CFG.dt > 1.4 ? 0.5 * CFG.dt : CFG.dt;
    drift(S, h);
    stripes(S);
    step(S, h);
    t += h;
  }
  S.ready = true;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const f = 1 - exp(-ft / 0.5);
  S.nu += (nuOf(k[3]) - S.nu) * f;
  const Rt = radOf(k[2]), nt = cntOf(k[2]);
  S.R += (Rt - S.R) * f;
  S.cnt += (nt - S.cnt) * f;
  let ch = false;
  for (let j = 0; j < 18; j++) {
    const g = S.grow[j], tg = cl(S.cnt - j, 0, 1), ng = g + (tg - g) * f;
    if (abs(ng - g) > 1e-4 || tg !== g) ch = true;
    S.grow[j] = ng;
  }
  if (ch || abs(Rt - S.R) > 1e-3) buildMask(S);
  S.acc += ft * flow;
  let steps = 0;
  while (steps < 24) {
    // half a step when the fastest water would cross more than 1.4 / 1.8 of a cell, the limit of the scheme in time
    const h = S.um * 1.8 * CFG.dt > 1.4 ? 0.5 * CFG.dt : CFG.dt;
    if (S.acc < h) break;
    drift(S, h);
    stripes(S);
    step(S, h);
    S.acc -= h;
    steps++;
  }
  if (steps === 24) S.acc = min(S.acc, CFG.dt);
  S.ar.set(S.wr);
  S.ai.set(S.wi);
  fft2(S.ar, S.ai, true);
  let e = 0;
  for (let p = 0; p < N; p++) e += S.ar[p] * S.ar[p];
  S.os = S.os ? S.os + (sqrt(e / N) - S.os) * 0.05 : sqrt(e / N);
  for (let p = 0; p < N; p++) S.om[p] = S.ar[p];
  const chk = S.wr[1] + S.ca[N >> 1] + S.cb[N >> 1] + S.Um;
  if (!isFinite(chk)) start(params, k);
}

// ---- colour: a ground and two dyes that add, with a soft shoulder ----
const GROUND = [30, 28, 40], DYE_A = [255, 84, 60], DYE_B = [255, 206, 80], POST = [10, 8, 12], RIM = [150, 118, 64], TINT = [14, 4, -8];
function setColors(S, hue) {
  const a = hue * TAU, c = cos(a), s = sin(a), k1 = (1 - c) / 3, k2 = sqrt(1 / 3) * s;
  const m = [c + k1, k1 - k2, k1 + k2, k1 + k2, c + k1, k1 - k2, k1 - k2, k1 + k2, c + k1];
  const rot = (v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  S.col = [rot(GROUND), rot(DYE_A), rot(DYE_B), rot(POST), rot(RIM), rot(TINT)];
}
const EASE = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) EASE[i] = pow(1 - exp(-(i / 1024) * 1.25 / 0.4), 2);
const ease = (c) => (c <= 0 ? 0 : EASE[min(1024, (c * 819.2) | 0)]);
const shoulder = (v) => (v < 0 ? 0 : v < 170 ? v : 170 + 85 * tanh((v - 170) / 85));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), setColors(S, S.hue);
  const { ca, cb, chi, col } = S, il = 1.5 / max(1e-6, S.os), [G, A, B, P, R, T] = col;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const x2 = chi[p], z = S.om[p] * il, w = (z / (1 + (z < 0 ? -z : z))) * (1 - x2), sh = 1 + 0.3 * w, a = ease(ca[p]), b = ease(cb[p]);
      let r = (G[0] + T[0] * w + A[0] * a + B[0] * b) * sh, g = (G[1] + T[1] * w + A[1] * a + B[1] * b) * sh, bl = (G[2] + T[2] * w + A[2] * a + B[2] * b) * sh;
      r = shoulder(r);
      g = shoulder(g);
      bl = shoulder(bl);
      if (x2 > 0.01) {
        const rim = 2.4 * x2 * (1 - x2), d = cl((x2 - 0.3) / 0.6, 0, 1);
        r = r * (1 - d) + P[0] * d + R[0] * rim;
        g = g * (1 - d) + P[1] * d + R[1] * rim;
        bl = bl * (1 - d) + P[2] * d + R[2] * rim;
      }
      display.setPixel(x, y, cl(r, 0, 255), cl(g, 0, 255), cl(bl, 0, 255));
    }
}
