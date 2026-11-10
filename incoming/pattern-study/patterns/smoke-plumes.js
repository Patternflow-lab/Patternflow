// ===== Patternflow pattern =====
// Title:   Smoke Plumes
// Family:  sim
// Idea:    Hot smoke pours out of vents along the floor of the panel, picks up speed as it rises, rolls into curls that crowd and fold into one another, and leaves through the top
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Visual simulation of smoke (Ronald Fedkiw, Jos Stam and Henrik Wann Jensen, 2001): buoyancy from temperature, vorticity confinement (Steinhoff and Underhill, 1994), incompressible flow
// Round:   125
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Heat=-1..1
//
// Knob 1: Hue. Turns the palette round the grey axis.
// Knob 2: Flow. Model seconds per panel second.
// Knob 3: Scale. Vent width and curl size.
// Knob 4: Heat. Buoyancy and the number of vents.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, tanh, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];
const MAXV = 6;

const CFG = {
  dt: 0.1, // the longest step, model seconds
  tscale: 1, // model seconds per panel second at Flow 1
  nu: 0.05, // viscosity, LED^2 per model second
  hyp: 0.003, // fourth order
  fric: 0.12, // drag on every mode with kx not 0
  beta: 2.2, // buoyancy: LEDs per model second squared per unit of T
  tv: 1.0, // temperature of a vent
  sv: 0.5, // smoke density of a vent
  cool: 0.1, // T cools at this rate
  kappa: 0.03, // diffusion of T and smoke
  rv: 1.5, // vent relaxation rate
  jet: 0.5, // upward push of a vent
  conf: 0.08, // vorticity confinement
  draft: 2.5, // the draft up the whole panel, LEDs per model second
  sp: 20, // rows of sponge at the top
  muTop: 1.0, // vorticity drag at the top row
  sTop: 1.2, // smoke removal rate at the top row
  wind: 1.5, // rms of the wind, LEDs per model second
  windT: 40,
  relU: 0.3,
  pre: 24,
  cfl: 0.45,
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
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N);
const CSH = new Float64Array(N), SSH = new Float64Array(N); // the half-cell shift to the corners of the cells
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    FIL[p] = exp(-36 * pow(sqrt(K2[p]) / 1.8, 16)); // the cut: 1.8 rad per LED, 0.6 of the Nyquist
    const nyq = i === W / 2 || j === H / 2;
    CSH[p] = nyq ? 0 : cos(0.5 * (KX[p] + KY[p]));
    SSH[p] = nyq ? 0 : sin(0.5 * (KX[p] + KY[p]));
  }

// ---- the layout of the box: sponge at the top, vents at the floor, the wind profile ----
const smooth = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const SPONGE = new Float64Array(H), VENTY = new Float64Array(H), WINDG = new Float64Array(H);
let GBAR = 0;
for (let y = 0; y < H; y++) {
  const t = cl((CFG.sp - y) / CFG.sp, 0, 1);
  SPONGE[y] = t * t;
  VENTY[y] = smooth(H - 14, H - 6, y + 0.5);
  WINDG[y] = 0.5 * (1 - cos((TAU * (y + 0.5 - (H - 6))) / H));
  GBAR += WINDG[y] / H;
}
// the spectrum of the wind's vorticity for a profile of unit amplitude, on the kx = 0 column: -d u / dy of (g - mean g)
const W0R = new Float64Array(H), W0I = new Float64Array(H);
for (let j = 0; j < H; j++) {
  const nyj = j < H / 2 ? j : j - H;
  let ar = 0, ai = 0;
  for (let y = 0; y < H; y++) {
    const u = WINDG[y] - GBAR, a = (TAU * nyj * y) / H;
    ar += u * cos(a);
    ai -= u * sin(a);
  }
  ar /= H;
  ai /= H;
  const ky = (TAU * nyj) / H; // -i ky (ar + i ai) = ky ai - i ky ar
  W0R[j] = ky * ai;
  W0I[j] = -ky * ar;
}

// ---- the flow ----
function rhs(S, wr, wi, oR, oI) {
  const { ar, ai, br, bi } = S, ub = S.ubar, vb = -CFG.draft;
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
  for (let p = 0; p < N; p++) {
    ar[p] = (ar[p] + ub) * br[p] + (ai[p] + vb) * bi[p];
    ai[p] = 0;
  }
  fft2(ar, ai, false);
  const inv = 1 / N, nu = CFG.nu, hy = CFG.hyp, fr = CFG.fric, Fr = S.fr, Fi = S.fi;
  for (let p = 0; p < N; p++) {
    const d = nu * K2[p] + hy * K2[p] * K2[p] + ((p & WM) === 0 ? 0 : fr);
    oR[p] = -ar[p] * inv * FIL[p] - d * wr[p] + Fr[p];
    oI[p] = -ai[p] * inv * FIL[p] - d * wi[p] + Fi[p];
  }
}
// The stream function on the corners of the cells and the vorticity on the cells in one transform (two real fields,
// packed). The velocity on the faces is the difference of the corner values, so its divergence is zero to rounding.
function prep(S) {
  const { wr, wi, ar, ai, U, V, omp } = S;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    let cr = 0, ci = 0;
    if (k2 !== 0) {
      const sr = wr[p] / k2, si = wi[p] / k2;
      cr = sr * CSH[p] - si * SSH[p];
      ci = sr * SSH[p] + si * CSH[p];
    }
    ar[p] = cr - wi[p];
    ai[p] = ci + wr[p];
  }
  fft2(ar, ai, true);
  const ub = S.ubar;
  let mx = 0.5;
  for (let j = 0; j < H; j++) {
    const o = j * W, om = ((j - 1) & HM) * W;
    for (let i = 0; i < W; i++) {
      const p = o + i, u = ar[p] - ar[om + i] + ub, v = -(ar[p] - ar[o + ((i - 1) & WM)]) - CFG.draft;
      U[p] = u;
      V[p] = v;
      omp[p] = ai[p];
      const a = abs(u), b = abs(v);
      if (a > mx) mx = a;
      if (b > mx) mx = b;
    }
  }
  return mx;
}

// ---- the scalars: flux form, second order upwind with the monotonised central limiter ----
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
      const u = U[o + i], ip = (i + 1) & WM, nu = u * dt;
      FX[i] = u > 0 ? u * (R[o + i] + 0.5 * (1 - nu) * SL[i]) : u * (R[o + ip] - 0.5 * (1 + nu) * SL[ip]);
    }
    for (let i = 0; i < W; i++) R[o + i] -= dt * (FX[i] - FX[(i - 1) & WM]);
  }
}
function sweepY(R, V, dt) {
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) SL[j] = mc(R[j * W + i] - R[((j - 1) & HM) * W + i], R[((j + 1) & HM) * W + i] - R[j * W + i]);
    for (let j = 0; j < H; j++) {
      const v = V[j * W + i], jp = (j + 1) & HM, nu = v * dt;
      FX[j] = v > 0 ? v * (R[j * W + i] + 0.5 * (1 - nu) * SL[j]) : v * (R[jp * W + i] - 0.5 * (1 + nu) * SL[jp]);
    }
    for (let j = 0; j < H; j++) R[j * W + i] -= dt * (FX[j] - FX[(j - 1) & HM]);
  }
}

// ---- vents ----
function ventLayout(S, n) {
  S.nv = n;
  const pitch = W / n;
  for (let v = 0; v < MAXV; v++) {
    S.bt[v] = v < n ? (v + 0.5) * pitch + S.off : (v % n + 0.5) * pitch + S.off;
    S.pt[v] = v < n ? 1 : 0;
  }
}
function drift(S, dt) {
  const n = S.nv, pitch = W / n;
  const dd = exp(-dt / 35), qd = sqrt(1 - dd * dd), da = exp(-dt / 20), qa = sqrt(1 - da * da);
  const rp = 1 - exp(-dt / 2), rb = 1 - exp(-dt / 3);
  for (let v = 0; v < MAXV; v++) {
    S.dv[v] = S.dv[v] * dd + 0.3 * pitch * qd * gauss();
    S.az[v] = S.az[v] * da + qa * gauss();
    S.am[v] = cl(1 + 0.4 * S.az[v], 0.35, 1.6);
    S.pr[v] += (S.pt[v] - S.pr[v]) * rp;
    let d = S.bt[v] - S.bx[v];
    d -= W * Math.round(d / W);
    S.bx[v] += d * rb;
  }
  const dw = exp(-dt / CFG.windT), qw = sqrt(1 - dw * dw);
  S.wa = S.wa * dw + CFG.wind * qw * gauss();
  S.ubar = S.wa * GBAR;
}
function ventField(S, sig) {
  const G = S.G;
  G.fill(0);
  for (let v = 0; v < MAXV; v++) {
    const amp = S.pr[v] * S.am[v];
    if (amp < 0.002) continue;
    const x = S.bx[v] + S.dv[v];
    for (let i = 0; i < W; i++) {
      let d = i - x;
      d -= W * Math.round(d / W);
      G[i] += amp * exp((-0.5 * d * d) / (sig * sig));
    }
  }
  for (let i = 0; i < W; i++) G[i] = 1 - exp(-G[i]);
}

function step(S, dt) {
  const { wr, wi, k1r, k1i, k2r, k2i, tr, ti, T, sm, U, V, omp, F } = S;
  const um = prep(S), nsub = max(1, ceil((um * dt) / CFG.cfl)), ds = dt / nsub;
  for (let n = 0; n < nsub; n++)
    for (const R of [sm, T]) {
      sweepX(R, U, 0.5 * ds);
      sweepY(R, V, ds);
      sweepX(R, U, 0.5 * ds);
    }
  // sources and sinks of the scalars
  ventField(S, S.sig);
  const G = S.G, rv = CFG.rv * dt, cool = CFG.cool * dt, kd = CFG.kappa * dt;
  const t2 = S.t2;
  for (let j = 0; j < H; j++) {
    const o = j * W, hv = VENTY[j], sp = SPONGE[j], sr = CFG.sTop * sp * dt, tcool = cool + 2 * sr;
    for (let i = 0; i < W; i++) {
      const p = o + i, g = G[i] * hv * rv;
      sm[p] = sm[p] + g * (CFG.sv - sm[p]) - sr * sm[p];
      T[p] = T[p] + g * (CFG.tv - T[p]) - tcool * T[p];
    }
  }
  for (const R of [sm, T]) {
    for (let j = 0; j < H; j++) {
      const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W;
      for (let i = 0; i < W; i++) {
        const p = o + i;
        t2[p] = R[p] + kd * (R[o + ((i - 1) & WM)] + R[o + ((i + 1) & WM)] + R[u + i] + R[w + i] - 4 * R[p]);
      }
    }
    for (let p = 0; p < N; p++) R[p] = cl(t2[p], 0, 1.2);
  }
  // the force on the vorticity: curl of (buoyancy + vent push), vorticity confinement, drag in the sponge
  const beta = S.beta, jet = CFG.jet, conf = S.conf, mt = CFG.muTop;
  const { ca, cx, cy } = S;
  for (let p = 0; p < N; p++) ca[p] = abs(omp[p]);
  for (let j = 0; j < H; j++) {
    const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W;
    for (let i = 0; i < W; i++) {
      const gx = 0.5 * (ca[o + ((i + 1) & WM)] - ca[o + ((i - 1) & WM)]), gy = 0.5 * (ca[w + i] - ca[u + i]);
      const m = 1 / sqrt(gx * gx + gy * gy + 1e-3);
      cx[o + i] = omp[o + i] * gx * m;
      cy[o + i] = omp[o + i] * gy * m;
    }
  }
  for (let j = 0; j < H; j++) {
    const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W, hv = VENTY[j], mu = mt * SPONGE[j], cm = conf * (1 - SPONGE[j]);
    for (let i = 0; i < W; i++) {
      const p = o + i, ip = (i + 1) & WM, im = (i - 1) & WM;
      const Tx = 0.5 * (T[o + ip] - T[o + im]), Gx = 0.5 * (G[ip] - G[im]) * hv;
      const div = 0.5 * (cx[o + ip] - cx[o + im]) + 0.5 * (cy[w + i] - cy[u + i]);
      F[p] = -beta * Tx - jet * Gx - mu * omp[p] - cm * smooth(0.04, 0.3, sm[p]) * div;
    }
  }
  S.ar.set(F);
  S.ai.fill(0);
  fft2(S.ar, S.ai, false);
  const inv = 1 / N;
  for (let p = 0; p < N; p++) {
    S.fr[p] = S.ar[p] * inv * FIL[p];
    S.fi[p] = S.ai[p] * inv * FIL[p];
  }
  // Shu and Osher's third order scheme for the vorticity
  rhs(S, wr, wi, k1r, k1i);
  for (let p = 0; p < N; p++) (tr[p] = wr[p] + dt * k1r[p]), (ti[p] = wi[p] + dt * k1i[p]);
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (tr[p] = 0.75 * wr[p] + 0.25 * (tr[p] + dt * k2r[p])), (ti[p] = 0.75 * wi[p] + 0.25 * (ti[p] + dt * k2i[p]));
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (wr[p] = (wr[p] + 2 * (tr[p] + dt * k2r[p])) / 3), (wi[p] = (wi[p] + 2 * (ti[p] + dt * k2i[p])) / 3);
  // the mean wind back to its profile
  const a = CFG.relU * dt;
  for (let j = 0; j < H; j++) {
    const p = j * W;
    wr[p] += a * (S.wa * W0R[j] - wr[p]);
    wi[p] += a * (S.wa * W0I[j] - wi[p]);
  }
  wr[0] = wi[0] = 0;
  drift(S, dt);
  S.time += dt;
}

const sigOf = (v) => 2.4 * pow(1.5, cl(v, -1.2, 1.2));
const confOf = (v) => CFG.conf * pow(1.6, -cl(v, -1.2, 1.2));
const betaOf = (v) => CFG.beta * pow(1.7, cl(v, -1.2, 1.2));
const nvOf = (v) => cl(floor(4.5 + 1.7 * cl(v, -1.2, 1.2)), 3, 6);

function start(params, k) {
  const mk = () => new Float64Array(N);
  const S = {
    wr: mk(), wi: mk(), ar: mk(), ai: mk(), br: mk(), bi: mk(), k1r: mk(), k1i: mk(), k2r: mk(), k2i: mk(), tr: mk(), ti: mk(),
    fr: mk(), fi: mk(), F: mk(), U: mk(), V: mk(), T: mk(), sm: mk(), t2: mk(), omp: mk(), ca: mk(), cx: mk(), cy: mk(),
    G: new Float64Array(W), bx: new Float64Array(MAXV), bt: new Float64Array(MAXV), dv: new Float64Array(MAXV), az: new Float64Array(MAXV),
    am: new Float64Array(MAXV), pr: new Float64Array(MAXV), pt: new Float64Array(MAXV),
    nv: 0, off: Math.random() * W, wa: gauss() * CFG.wind, ubar: 0, sig: sigOf(k[2]), beta: betaOf(k[3]), conf: confOf(k[2]),
    time: 0, acc: 0, ready: false, hue: 0, lutHue: -9, tau: mk(), sky: new Float64Array(H * 3), lut: new Float64Array(256 * 3),
  };
  S.ubar = S.wa * GBAR;
  params.s = S;
  ventLayout(S, nvOf(k[3]));
  for (let v = 0; v < MAXV; v++) (S.bx[v] = S.bt[v]), (S.pr[v] = S.pt[v]), (S.dv[v] = 0.3 * (W / S.nv) * gauss()), (S.az[v] = gauss());
  for (let t = 0; t < CFG.pre; t += 0.08) step(S, 0.08);
  S.ready = true;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const r = 1 - exp(-ft / 0.5);
  S.sig += (sigOf(k[2]) - S.sig) * r;
  S.conf += (confOf(k[2]) - S.conf) * r;
  S.beta += (betaOf(k[3]) - S.beta) * r;
  const nt = nvOf(k[3]);
  if (nt !== S.nv) ventLayout(S, nt);
  const dm = ft * flow * CFG.tscale, ns = max(1, ceil(dm / CFG.dt - 1e-9));
  if (dm > 0) for (let i = 0; i < ns; i++) step(S, dm / ns);
  if (!isFinite(S.wr[1] + S.sm[N >> 1] + S.T[N >> 1])) start(params, k);
}

// ---- colour ----
// The smoke's colour follows its temperature on a log scale, so young smoke is gold and orange, then apricot and rose, then
// the grey of smoke that has cooled. All colours are turned round the grey axis by Hue, so one turn comes back.
const SKY = [[98, 78, 104], [138, 90, 90], [190, 100, 66]]; // top, middle, horizon
const RAMP = [
  [0.0, 150, 140, 164],
  [0.28, 176, 150, 156],
  [0.5, 214, 160, 140],
  [0.72, 244, 150, 80],
  [0.88, 255, 190, 100],
  [1.0, 255, 238, 176],
];
function rotate(c, a) {
  const co = cos(a), si = sin(a), k1 = (1 - co) / 3, k2 = sqrt(1 / 3) * si;
  const m = [co + k1, k1 - k2, k1 + k2, k1 + k2, co + k1, k1 - k2, k1 - k2, k1 + k2, co + k1];
  return [
    cl(m[0] * c[0] + m[1] * c[1] + m[2] * c[2], 0, 255),
    cl(m[3] * c[0] + m[4] * c[1] + m[5] * c[2], 0, 255),
    cl(m[6] * c[0] + m[7] * c[1] + m[8] * c[2], 0, 255),
  ];
}
function buildPalette(S, hue) {
  const a = hue * TAU, sk = SKY.map((c) => rotate(c, a));
  for (let y = 0; y < H; y++) {
    const t = y / HM, u = cl(t / 0.55, 0, 1), v = cl((t - 0.55) / 0.45, 0, 1);
    for (let k = 0; k < 3; k++) S.sky[y * 3 + k] = t < 0.55 ? sk[0][k] + (sk[1][k] - sk[0][k]) * u : sk[1][k] + (sk[2][k] - sk[1][k]) * v * v;
  }
  for (let i = 0; i < 256; i++) {
    const b = i / 255;
    let j = 0;
    while (j < RAMP.length - 2 && b > RAMP[j + 1][0]) j++;
    const A = RAMP[j], B = RAMP[j + 1], t = cl((b - A[0]) / (B[0] - A[0]), 0, 1);
    const c = rotate([A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, A[3] + (B[3] - A[3]) * t], a);
    S.lut[i * 3] = c[0];
    S.lut[i * 3 + 1] = c[1];
    S.lut[i * 3 + 2] = c[2];
  }
}
const ALPHA = new Float64Array(257), LEXP = new Float64Array(257), TONE = new Uint8Array(1025);
for (let i = 0; i <= 256; i++) {
  ALPHA[i] = 1 - exp((-3 * i) / 213);
  LEXP[i] = exp((-i / 256) * 2.4);
}
for (let i = 0; i <= 1024; i++) TONE[i] = cl(log(1 + ((i / 1024) * (i / 1024)) / 0.004) / log(251), 0, 1) * 255;

const LX = -0.45, LY = -0.89; // towards the light: up and to the left

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildPalette(S, S.hue);
  const { sm, T, tau, sky, lut } = S;
  // the optical depth towards the light, which is up and to the left: a running sum along (-1, -2), (-1, -1) and (0, -1)
  for (let y = 0; y < H; y++) {
    const o = y * W, o1 = ((y - 1) & HM) * W, o2 = ((y - 2) & HM) * W;
    for (let x = 0; x < W; x++) {
      const xm = (x - 1) & WM;
      const up = y >= 2 ? 0.4 * tau[o2 + xm] : 0, ul = y >= 1 ? 0.35 * tau[o1 + xm] + 0.25 * tau[o1 + x] : 0;
      tau[o + x] = 0.8 * (up + ul) + 0.35 * sm[o + x];
    }
  }
  for (let y = 0, p = 0; y < H; y++) {
    const sr = sky[y * 3], sg = sky[y * 3 + 1], sb = sky[y * 3 + 2];
    for (let x = 0; x < W; x++, p++) {
      const s = cl(sm[p], 0, 1.2), al = ALPHA[(s * 213) | 0];
      const L = LEXP[min(256, (tau[p] * 256) | 0)], o = TONE[(sqrt(cl(T[p], 0, 1)) * 1024) | 0] * 3;
      const gx = 0.25 * (sm[y * W + ((x + 2) & WM)] - sm[y * W + ((x - 2) & WM)]), gy = 0.25 * (sm[((y + 2) & HM) * W + x] - sm[((y - 2) & HM) * W + x]);
      const f = 0.5 + 0.55 * L + cl(-4 * (gx * LX + gy * LY), -0.25, 0.45);
      display.setPixel(x, y, sr + (lut[o] * f - sr) * al, sg + (lut[o + 1] * f - sg) * al, sb + (lut[o + 2] * f - sb) * al);
    }
  }
}
