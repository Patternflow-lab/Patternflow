// ===== Patternflow pattern =====
// Title:   Plate Turbulence
// Family:  wave
// Idea:    A thin elastic sheet, shaken at its long wavelengths and rubbed down at its short ones, is solved by the Foppl-von Karman plate equations on the panel's own 64 by 128 torus, and the height of the sheet is drawn lit from one side with a hard glint, so bending waves pass and crumple into bright ridges and cones like a sheet of foil being shaken, and the wrinkles never settle into a picture that comes back.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: von Karman plate equations (August Foppl, 1907; Theodore von Karman, 1910, both from memory), wave turbulence of a vibrating plate (Gustavo During, Christophe Josserand and Sergio Rica, 2006; Nicolas Mordant, 2008; both from memory), pattern round 127
// Round:   127
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.5..3.5, Wavelength=-1..1, Crinkle=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the hue of the palette.
// Knob 2: Drive. The clock of the shaking.
// Knob 3: Wavelength. The wavelength of the shaking.
// Knob 4: Crinkle. How hard the sheet is bent against its own stretching.

const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, PI, pow, log, tanh } = Math;
const W = 64, H = 128, NC = W * H;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables. Lengths are LEDs, times are model seconds (Drive sets how many pass in a real second).
const KC = 1.4;             // spectral cutoff radius, rad per LED
const CB = 11;              // bending speed: omega = CB k^2
const G_LOW = 0.05;         // friction rate (amplitude) at long wavelengths
const G_HIGH = 6;           // friction rate at the cutoff
const U0 = 2.0;             // rms height the linear sheet would settle at
const DT_MAX = 0.05;        // longest step
const CFL = 2.2;            // omega dt allowed on the stiffest mode
const MAX_SUB = 4;          // steps a frame may take
const TB_MAX = 0.9;         // stretching over bending energy, at most (the forced, rubbed-down plate sits at 0.2 to 0.5)
const KNOB = [0, 2, 0, 0.06];

// ---- FFT: radix-2 of length 64 and 128, split into two real arrays
function makeFft(n) {
  const lg = Math.round(Math.log(n) / Math.LN2);
  const rev = new Int32Array(n), co = new Float64Array(n / 2), si = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if ((i >> b) & 1) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) {
    co[i] = cos((2 * PI * i) / n);
    si[i] = sin((2 * PI * i) / n);
  }
  return { n, rev, co, si };
}
const F64 = makeFft(W), F128 = makeFft(H);
const TR = new Float64Array(H), TI = new Float64Array(H);

function butterflies(F, sgn) {
  const n = F.n, co = F.co, si = F.si, tr = TR, ti = TI;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0, t = 0; j < half; j++, t += step) {
        const wr = co[t], wi = sgn * si[t];
        const a = i + j, b = a + half;
        const xr = tr[b] * wr - ti[b] * wi, xi = tr[b] * wi + ti[b] * wr;
        tr[b] = tr[a] - xr;
        ti[b] = ti[a] - xi;
        tr[a] += xr;
        ti[a] += xi;
      }
    }
  }
}

// ---- the modes: every (m, n) with 0 < k^2 <= KC^2, kx = 2 pi m / 64, ky = 2 pi n / 128
const DKX = (2 * PI) / W, DKY = (2 * PI) / H;
const MODE = (() => {
  const idx = [], kx = [], ky = [];
  const colOn = new Uint8Array(W);
  for (let n = 0; n < H; n++)
    for (let m = 0; m < W; m++) {
      const fx = (m < W / 2 ? m : m - W) * DKX, fy = (n < H / 2 ? n : n - H) * DKY;
      const k2 = fx * fx + fy * fy;
      if (k2 > 0 && k2 <= KC * KC) {
        idx.push(n * W + m);
        kx.push(fx);
        ky.push(fy);
        colOn[m] = 1;
      }
    }
  const cols = [];
  for (let m = 0; m < W; m++) if (colOn[m]) cols.push(m);
  const NA = idx.length;
  const o = {
    NA, cols,
    idx: Int32Array.from(idx), kx: Float64Array.from(kx), ky: Float64Array.from(ky),
    k2: new Float64Array(NA), om: new Float64Array(NA), g: new Float64Array(NA), ik4: new Float64Array(NA),
    mirror: new Int32Array(NA),
  };
  for (let j = 0; j < NA; j++) {
    const k2 = kx[j] * kx[j] + ky[j] * ky[j];
    o.k2[j] = k2;
    o.om[j] = CB * k2;
    o.ik4[j] = 1 / (k2 * k2);
    const q = k2 / (KC * KC);
    const q2 = q * q, q4 = q2 * q2;
    o.g[j] = G_LOW + G_HIGH * q4 * q4;
    const n = floor(idx[j] / W), m = idx[j] % W;
    o.mirror[j] = ((H - n) % H) * W + ((W - m) % W);
  }
  return o;
})();

// spectrum -> field, unnormalised, e^{+ikx}; only the columns that hold modes are read, so the array must be zero elsewhere
function ifft2(re, im) {
  const cols = MODE.cols;
  for (let c = 0; c < cols.length; c++) {
    const m = cols[c];
    for (let n = 0; n < H; n++) {
      const s = n * W + m, r = F128.rev[n];
      TR[r] = re[s];
      TI[r] = im[s];
    }
    butterflies(F128, 1);
    for (let n = 0; n < H; n++) {
      const s = n * W + m;
      re[s] = TR[n];
      im[s] = TI[n];
    }
  }
  const rev = F64.rev;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let m = 0; m < W; m++) {
      TR[m] = 0;
      TI[m] = 0;
    }
    for (let c = 0; c < cols.length; c++) {
      const m = cols[c], r = rev[m];
      TR[r] = re[o + m];
      TI[r] = im[o + m];
    }
    butterflies(F64, 1);
    for (let m = 0; m < W; m++) {
      re[o + m] = TR[m];
      im[o + m] = TI[m];
    }
  }
}

// field -> spectrum, e^{-ikx}, not divided by NC; only the columns that hold modes come out right
function fft2(re, im) {
  const rev = F64.rev;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let m = 0; m < W; m++) {
      const r = rev[m];
      TR[r] = re[o + m];
      TI[r] = im[o + m];
    }
    butterflies(F64, -1);
    for (let m = 0; m < W; m++) {
      re[o + m] = TR[m];
      im[o + m] = TI[m];
    }
  }
  const cols = MODE.cols;
  for (let c = 0; c < cols.length; c++) {
    const m = cols[c];
    for (let n = 0; n < H; n++) {
      const s = n * W + m, r = F128.rev[n];
      TR[r] = re[s];
      TI[r] = im[s];
    }
    butterflies(F128, -1);
    for (let n = 0; n < H; n++) {
      const s = n * W + m;
      re[s] = TR[n];
      im[s] = TI[n];
    }
  }
}

const f64 = () => new Float64Array(NC);
function newState() {
  return {
    ur: f64(), ui: f64(), vr: f64(), vi: f64(),    // u hat and u_t hat, the whole state
    z1r: f64(), z1i: f64(), z2r: f64(), z2i: f64(), z3r: f64(), z3i: f64(),
    qr: f64(), qi: f64(), w1r: f64(), w1i: f64(), w2r: f64(), w2i: f64(),
    nr: f64(), ni: f64(), pr: f64(), pi: f64(),    // N hat, phi hat
    beta: 1, fw: new Float64Array(MODE.NA), fa: new Float64Array(MODE.NA), clock: 1, lamF: 20, eps: 0.4, time: 0,
    cs: new Float64Array(MODE.NA), sn: new Float64Array(MODE.NA), ed: new Float64Array(MODE.NA), dtDone: -1,
    tens: 0, tensHold: 0, srms: 1, hrms: 1, lrms: 1, ca: new Float64Array(3), cb: new Float64Array(3), cg: new Float64Array(3), hueDone: -999, drift: 0,
  };
}

// ---- the plate. u_tt = -CB^2 lap^2 u + [u, phi] - 2 g u_t + F,  lap^2 phi = -(beta / 2) [u, u], [f, g] = f_xx g_yy + f_yy g_xx - 2 f_xy g_xy
// phi hat is written to S.pr and S.pi, the force to S.nr and S.ni; with view set the fields the picture needs stay in z1, z2, z3
function nonlinear(S, view) {
  const { ur, ui, z1r, z1i, z2r, z2i, z3r, z3i, qr, qi, w1r, w1i, w2r, w2i, nr, ni, pr, pi } = S;
  const { NA, idx, kx, ky, ik4 } = MODE;
  z1r.fill(0); z1i.fill(0); z2r.fill(0); z2i.fill(0);
  for (let j = 0; j < NA; j++) {
    const i = idx[j], a = ur[i], b = ui[i], x2 = kx[j] * kx[j], y2 = ky[j] * ky[j], xy = kx[j] * ky[j];
    // z1 = u_xx + i u_yy, from the spectrum (-kx^2 - i ky^2) u hat
    z1r[i] = -x2 * a + y2 * b;
    z1i[i] = -x2 * b - y2 * a;
    // z2 = u_xy + i u_x, from the spectrum -(kx ky + kx) u hat
    z2r[i] = -(xy + kx[j]) * a;
    z2i[i] = -(xy + kx[j]) * b;
  }
  ifft2(z1r, z1i);
  ifft2(z2r, z2i);
  // [u, u] / 2 = u_xx u_yy - u_xy^2
  for (let i = 0; i < NC; i++) {
    qr[i] = z1r[i] * z1i[i] - z2r[i] * z2r[i];
    qi[i] = 0;
  }
  fft2(qr, qi);
  w1r.fill(0); w1i.fill(0); w2r.fill(0); w2i.fill(0);
  const bn = -S.beta / NC;
  for (let j = 0; j < NA; j++) {
    const i = idx[j], a = bn * ik4[j] * qr[i], b = bn * ik4[j] * qi[i], x2 = kx[j] * kx[j], y2 = ky[j] * ky[j], xy = kx[j] * ky[j];
    pr[i] = a;
    pi[i] = b;
    w1r[i] = -x2 * a + y2 * b;
    w1i[i] = -x2 * b - y2 * a;
    w2r[i] = -xy * a;
    w2i[i] = -xy * b;
  }
  ifft2(w1r, w1i);
  ifft2(w2r, w2i);
  let tmax = 0;
  for (let i = 0; i < NC; i++) {
    // u_xx phi_yy + u_yy phi_xx - 2 u_xy phi_xy
    nr[i] = z1r[i] * w1i[i] + z1i[i] * w1r[i] - 2 * z2r[i] * w2r[i];
    ni[i] = 0;
    // the larger eigenvalue of the Hessian of phi is the tension in the stiffest direction there
    const a = 0.5 * (w1r[i] + w1i[i]), b = 0.5 * (w1r[i] - w1i[i]), c = w2r[i], l = a + sqrt(b * b + c * c);
    if (l > tmax) tmax = l;
  }
  S.tens = tmax;
  fft2(nr, ni);
  if (view) {
    z3r.fill(0); z3i.fill(0);
    for (let j = 0; j < NA; j++) {
      const i = idx[j], a = ur[i], b = ui[i], f = ky[j] + 1;
      // z3 = u_y + i u, from the spectrum i (ky + 1) u hat
      z3r[i] = -f * b;
      z3i[i] = f * a;
    }
    ifft2(z3r, z3i);
  }
}

function gauss2(out) {
  const r = sqrt(-2 * log(1 - Math.random())), t = 2 * PI * Math.random();
  out[0] = r * cos(t);
  out[1] = r * sin(t);
}
const GG = [0, 0];

// the forced modes: the half plane, each mode with its mirror as the conjugate
const HALF = (() => {
  const l = [];
  for (let j = 0; j < MODE.NA; j++) if (MODE.ky[j] > 1e-12 || (abs(MODE.ky[j]) < 1e-12 && MODE.kx[j] > 0)) l.push(j);
  return Int32Array.from(l);
})();

// forcing: a band of wavenumbers around 2 pi / lamF, white in time, so no two modes ever beat at a period that comes round
function setForce(S) {
  const kf = (2 * PI) / S.lamF, { kx, ky, om, g } = MODE;
  let ss = 0;
  for (let h = 0; h < HALF.length; h++) {
    const j = HALF[h], k = sqrt(kx[j] * kx[j] + ky[j] * ky[j]), z = log(k / kf) / 0.3;
    const w = exp(-0.5 * z * z);
    S.fw[h] = w < 0.02 ? 0 : w;
    ss += (S.fw[h] * S.fw[h]) / (2 * g[j]);
  }
  const af = U0 / sqrt(ss);
  for (let h = 0; h < HALF.length; h++) S.fa[h] = af * S.fw[h] * om[HALF[h]];
}

function driftTable(S, dt) {
  const { NA, om, g } = MODE;
  for (let j = 0; j < NA; j++) {
    const th = om[j] * dt;
    S.cs[j] = cos(th);
    S.sn[j] = sin(th);
    S.ed[j] = exp(-g[j] * dt);
  }
  S.dtDone = dt;
}

// one step of dt: kick with the nonlinear force and the noise, then turn each mode exactly through omega dt and rub it down
function step(S, dt, view, damp) {
  nonlinear(S, view);
  const { ur, ui, vr, vi, nr, ni } = S;
  const { NA, idx, om, mirror } = MODE;
  const nn = dt / NC;
  for (let j = 0; j < NA; j++) {
    const i = idx[j];
    vr[i] += nn * nr[i];
    vi[i] += nn * ni[i];
  }
  const sq = sqrt(dt * 0.5);
  if (S.fa) {
    for (let h = 0; h < HALF.length; h++) {
      const a = S.fa[h];
      if (a === 0) continue;
      const j = HALF[h], i = idx[j], m = mirror[j];
      gauss2(GG);
      vr[i] += a * sq * GG[0];
      vi[i] += a * sq * GG[1];
      vr[m] += a * sq * GG[0];
      vi[m] -= a * sq * GG[1];
    }
  }
  if (S.dtDone !== dt) driftTable(S, dt);
  const { cs, sn, ed } = S;
  for (let j = 0; j < NA; j++) {
    const i = idx[j], w = om[j], c = cs[j], s = sn[j], e = damp ? ed[j] : 1;
    const a = ur[i], b = ui[i], p = vr[i], q = vi[i];
    ur[i] = (a * c + (p * s) / w) * e;
    ui[i] = (b * c + (q * s) / w) * e;
    vr[i] = (-a * w * s + p * c) * e;
    vi[i] = (-b * w * s + q * c) * e;
  }
  S.time += dt;
}

// energy per unit area: kinetic + bending + stretching (Parseval, every mode counted)
function energy(S) {
  const { NA, idx, k2, om } = MODE;
  let K = 0, B = 0, T = 0;
  for (let j = 0; j < NA; j++) {
    const i = idx[j];
    K += 0.5 * (S.vr[i] * S.vr[i] + S.vi[i] * S.vi[i]);
    B += 0.5 * om[j] * om[j] * (S.ur[i] * S.ur[i] + S.ui[i] * S.ui[i]);
    T += (0.5 / S.beta) * k2[j] * k2[j] * (S.pr[i] * S.pr[i] + S.pi[i] * S.pi[i]);
  }
  return { K, B, T, E: K + B + T };
}

function seedState(S) {
  const { idx, om, g, mirror } = MODE;
  setForce(S);
  for (let h = 0; h < HALF.length; h++) {
    const j = HALF[h];
    if (S.fw[h] === 0) continue;
    const i = idx[j], m = mirror[j];
    const sd = S.fa[h] / (2 * om[j] * sqrt(g[j]));   // rms of |u hat| for a mode the noise has driven to its linear steady state
    gauss2(GG);
    const a = GG[0] * sd * 0.7071, b = GG[1] * sd * 0.7071;
    gauss2(GG);
    const p = GG[0] * sd * om[j] * 0.7071, q = GG[1] * sd * om[j] * 0.7071;
    S.ur[i] = a; S.ui[i] = b; S.ur[m] = a; S.ui[m] = -b;
    S.vr[i] = p; S.vi[i] = q; S.vr[m] = p; S.vi[m] = -q;
  }
}

// The longest step the plate lets us take. Tension from the stretching term stiffens the short waves from c k^2 to
// sqrt(c^2 k^4 + k^2 T), T the largest tension anywhere; a step with omega dt over about 2.5 on the cutoff mode is unstable.
function stepLimit(S) {
  // the tension of the last few steps, falling slowly, so one quiet step does not let the next one be long
  S.tensHold = max(S.tens, 0.75 * S.tensHold);
  const w0 = CB * KC * KC, we = sqrt(w0 * w0 + KC * KC * S.tensHold);
  return min(DT_MAX, CFL / we);
}

// How much of the plate's energy is stretching. A plate the knob has just made stiffer, or a start that is far from where
// the forcing and the friction settle, can hold ten times more stretching than bending, and the first kicks then throw
// the short waves off the grid. Past TB_MAX the whole state is scaled down together, which is the same plate seen at a
// smaller amplitude, and the picture, which is divided by its own rms, does not move.
function limitStretch(S) {
  const e = energy(S);
  const r = e.T / (e.B + 1e-30);
  if (!(r > TB_MAX)) return;
  const a = sqrt(TB_MAX / r), { NA, idx } = MODE;
  for (let j = 0; j < NA; j++) {
    const i = idx[j];
    S.ur[i] *= a; S.ui[i] *= a; S.vr[i] *= a; S.vi[i] *= a;
  }
  for (let i = 0; i < NC; i++) { S.z1r[i] *= a; S.z1i[i] *= a; S.z2i[i] *= a; S.z3r[i] *= a; S.z3i[i] *= a; }
  S.srms *= a; S.hrms *= a; S.lrms *= a;
}

// Run model time T. The step is cut to what the tension allows (re-read after every step), and at most MAX_SUB of them are
// taken: past that the plate runs slow instead of blowing up. The last step leaves the picture's fields in z1, z2, z3.
function advance(S, T, maxSub) {
  let left = T, n = 0;
  while (left > 1e-9 && n < maxSub) {
    const lim = stepLimit(S), cnt = ceil(left / lim - 1e-9), h = left / cnt;
    n++;
    const last = cnt === 1 || n === maxSub;
    step(S, h, last, true);
    left -= h;
    if (last) break;
  }
}

function targets(k) {
  return {
    clock: cl(k[1], 0.5, 3.5) / 2,
    lamF: 20 * pow(1.8, cl(k[2], -1, 1)),
    eps: 2 * pow(50, (cl(k[3], -1, 1) + 1) / 2),
  };
}
const BETA_REF = 1;
function betaOf(eps) {
  return (eps * CB * CB) / (U0 * U0) * BETA_REF;
}

// ---- colour. OKLab lightness ramp, a ring of hues round it.
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const TMP = [0, 0, 0];
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
// OKLab (L, C, hue in degrees) to linear sRGB, pulled in till it fits
function oklch(L, C, hd, o) {
  const h = (hd * PI) / 180;
  for (let it = 0; it < 10; it++) {
    lin(L, C * cos(h), C * sin(h), o);
    if (o[0] >= -0.002 && o[1] >= -0.002 && o[2] >= -0.002 && o[0] <= 1.002 && o[1] <= 1.002 && o[2] <= 1.002) break;
    C *= 0.9;
  }
  lin(L, C * cos(h), C * sin(h), o);
  o[0] = cl(o[0], 0, 1); o[1] = cl(o[1], 0, 1); o[2] = cl(o[2], 0, 1);
}
// The lights the foil reflects: a warm one, a cool one, and the dim ground the flat parts show
const LIGHT_A = [0.84, 0.13, 30], LIGHT_B = [0.72, 0.12, 205], GROUND = [0.24, 0.1, 285];
function buildLut(S, hueDeg) {
  const t = [0, 0, 0];
  oklch(LIGHT_A[0], LIGHT_A[1], LIGHT_A[2] + hueDeg, t); S.ca.set(t);
  oklch(LIGHT_B[0], LIGHT_B[1], LIGHT_B[2] + hueDeg, t); S.cb.set(t);
  let hd = GROUND[2] + hueDeg, L = GROUND[0], C = GROUND[1];
  let dh = (((hd - 75) % 360) + 360) % 360;
  if (dh > 180) dh -= 360;
  const warm = exp(-(dh * dh) / 4000);
  L += 0.1 * warm; C *= 1 - 0.6 * warm;
  oklch(L, C, hd, t); S.cg.set(t);
  S.hueDone = hueDeg;
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  const tg = targets(knobValues || KNOB);
  S.clock = tg.clock;
  S.lamF = tg.lamF;
  S.eps = tg.eps;
  S.beta = betaOf(S.eps);
  seedState(S);
  buildLut(S, 0);
  nonlinear(S, false);
  limitStretch(S);
  nonlinear(S, false);
  S.tensHold = S.tens;
  advance(S, 8, 400);
  measure(S);
}

function measure(S) {
  let sx = 0, sh = 0, sl = 0;
  for (let i = 0; i < NC; i++) {
    sx += S.z2i[i] * S.z2i[i] + S.z3r[i] * S.z3r[i];
    sh += S.z3i[i] * S.z3i[i];
    const l = S.z1r[i] + S.z1i[i];
    sl += l * l;
  }
  S.srms = sqrt(sx / NC) + 1e-9;
  S.hrms = sqrt(sh / NC) + 1e-9;
  S.lrms = sqrt(sl / NC) + 1e-9;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  if (d <= 0) return;
  const tg = targets(k), f = 1 - exp(-4 * d);
  S.clock += (tg.clock - S.clock) * f;
  S.lamF += (tg.lamF - S.lamF) * f;
  S.eps += (tg.eps - S.eps) * f;
  S.beta = betaOf(S.eps);
  setForce(S);
  advance(S, d * S.clock, MAX_SUB);
  limitStretch(S);
  const sx = S.srms, sh = S.hrms, sl = S.lrms;
  measure(S);
  const a = 1 - exp(-d / 1.5);
  S.srms = sx + (S.srms - sx) * a;
  S.hrms = sh + (S.hrms - sh) * a;
  S.lrms = sl + (S.lrms - sl) * a;
  S.drift += d;
}

const SLOPE_GAIN = 1.0, KA = 7, KB = 5;
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const gs = SLOPE_GAIN / S.srms, gh = 1 / S.hrms;
  const ph = 0.9 + 0.35 * sin(S.drift * 0.043) + 0.25 * sin(S.drift * 0.0171 + 2);
  const st = 0.95, ct = cos(0.95);   // lobe elevation
  const sA = sin(0.95), cA2 = cos(0.95);
  const ax = sA * cos(ph + PI), ay = sA * sin(ph + PI), az = cA2;
  const bx = sA * cos(ph), by = sA * sin(ph), bz = cA2 * 0.8;
  const ca = S.ca, cb = S.cb, cg = S.cg;
  const ux_ = S.z2i, uy_ = S.z3r, hh = S.z3i;
  void st; void ct;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, ux = ux_[i] * gs, uy = uy_[i] * gs;
      const nz = 1 / sqrt(1 + ux * ux + uy * uy), nx = -ux * nz, ny = -uy * nz;
      const rx = 2 * nx * nz, ry = 2 * ny * nz, rz = 2 * nz * nz - 1;
      const a = exp(KA * (rx * ax + ry * ay + rz * az - 1));
      const b = exp(KB * (rx * bx + ry * by + rz * bz - 1));
      const g = 0.55 + 0.45 * tanh(hh[i] * gh);
      display.setPixel(x, y, gam(cg[0] * g + ca[0] * a + cb[0] * b), gam(cg[1] * g + ca[1] * a + cb[1] * b), gam(cg[2] * g + ca[2] * a + cb[2] * b));
    }
}
