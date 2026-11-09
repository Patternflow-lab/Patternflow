// ===== Patternflow pattern =====
// Title:   Phase Space Holes
// Family:  physics
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   119
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Drive=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Flow. draft
// Knob 3: Scale. draft
// Knob 4: Drive. draft

const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, tanh, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables
const NX = 64, NV = 128;
const BEAM = 24; // rows from the middle to each beam
const WID = 8; // rows, the thermal width of a beam
const NM = 8; // how many modes of the box the unevenness of the feed has
const MTAU = 25; // how long it keeps its shape, in plasma time
const DTMAX = 0.12; // longest step of plasma time
const TAU0 = 1.5; // plasma time per second of panel, at Flow 1
const L0 = 68; // box length at Scale 0, in beam speeds over omega_p
const NU0 = 0.07; // relaxation rate at Drive 0
const KNOB = [0, 2, 0, 0.06];

// ---- in-place complex FFT, N a power of two (sign -1 forward, +1 inverse, neither divided by N)
function makeFft(N) {
  const rev = new Uint16Array(N), cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
  const bits = Math.round(Math.log2(N));
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  for (let k = 0; k < N / 2; k++) {
    cs[k] = cos((TAU * k) / N);
    sn[k] = sin((TAU * k) / N);
  }
  return function fft(re, im, sign) {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1, step = N / len;
      for (let s = 0; s < N; s += len)
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const wr = cs[t], wi = sign * sn[t];
          const a = s + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
    }
  };
}

// ---- the plasma. Two arrays, u and l, hold the electrons that started in the upper and in the lower beam, each on nx columns
// (one box length L, periodic) and nv rows of velocity, row 0 the fastest to the right; the index is x * nv + r. Both obey the
// same equation, so f = u + l is the distribution and u / f says where a particle came from. Units: omega_p = 1, the beams sit
// at v = +-1, so dv = 1 / beam.
//   df/dt + v df/dx - E df/dv = nu (f0 - f),     dE/dx = 1 - integral of f dv  (the ions are a fixed uniform background)
function newSim(nx, nv, beam, wid) {
  const A = () => new Float64Array(nx * nv), V = () => new Float64Array(nv), X = () => new Float64Array(nx);
  const S = {
    nx, nv, beam, wid, u: A(), l: A(), u0: V(), l0: V(),
    E: X(), phi: X(), n: X(), mod: X(),
    L: 30, dx: 30 / nx, dv: 1 / beam, nu: 0, modAmp: 0, limit: 1,
    oc: new Float64Array(NM), os: new Float64Array(NM),
    fftx: makeFft(nx), xr: X(), xi: X(), ex: X(), ey: X(), px: X(), py: X(),
    pad: new Float64Array(nv + 8), flux: new Float64Array(nv + 8), rate: V(), edge: V(),
    clampMass: 0, time: 0, mass: 1,
  };
  setEquilibrium(S);
  setEdge(S, 6, 1.5);
  return S;
}
// comps: [weight, centre, sigma] in units of the beam speed; a component above zero is tagged upper, the rest lower
function setEquilibrium(S, comps) {
  const { nv, dv, beam } = S;
  const cs = comps || S.comps || [[0.5, 1, S.wid / beam], [0.5, -1, S.wid / beam]];
  S.comps = cs;
  let m = 0;
  for (let r = 0; r < nv; r++) {
    const v = (nv / 2 - 0.5 - r) / beam;
    let up = 0, lo = 0;
    for (const [w, c, sg] of cs) {
      const q = w * exp(-0.5 * ((v - c) / sg) ** 2);
      if (c > 0) up += q;
      else lo += q;
    }
    S.u0[r] = up;
    S.l0[r] = lo;
    m += up + lo;
  }
  for (let r = 0; r < nv; r++) {
    S.u0[r] /= m * dv;
    S.l0[r] /= m * dv;
  }
}
// the extra relaxation rate in the outermost `w` rows at each end, `peak` per unit time at the very last row, falling off as a cosine squared
function setEdge(S, w, peak) {
  for (let r = 0; r < S.nv; r++) {
    const d = min(r, S.nv - 1 - r);
    S.edge[r] = d < w ? peak * cos((0.5 * PI * d) / w) ** 2 : 0;
  }
}

// drift by dt: each row moves along the columns at its own velocity, by the flux balance below with a wrap round the box
function drift(S, dt) {
  const { nx, nv, u, l, dx, dv } = S;
  for (let r = 0; r < nv; r++) {
    const d = ((nv / 2 - 0.5 - r) * dv * dt) / dx;
    pfc(S, u, r, nv, nx, d, true);
    pfc(S, l, r, nv, nx, d, true);
  }
}

// Poisson: dE/dx = 1 - n, the mean of n taken out (the ions are the mean). E_k = i n_k / k, no Nyquist.
// phi is the potential energy of an electron, dphi/dx = E.
function field(S) {
  const { nx, nv, u, l, fftx, xr, xi, ex, ey, px, py, n, E, phi, dv, L } = S, h = nx >> 1;
  let mean = 0;
  for (let i = 0; i < nx; i++) {
    let s = 0;
    const o = i * nv;
    for (let r = 0; r < nv; r++) s += u[o + r] + l[o + r];
    n[i] = s * dv;
    mean += n[i];
    xr[i] = n[i];
    xi[i] = 0;
  }
  S.mass = mean / nx;
  fftx(xr, xi, -1);
  const k1 = TAU / L;
  ex.fill(0);
  ey.fill(0);
  px.fill(0);
  py.fill(0);
  for (let k = 1; k < h; k++) {
    const kk = k1 * k, nr = xr[k], ni = xi[k];
    ex[k] = -ni / kk;
    ey[k] = nr / kk;
    ex[nx - k] = ex[k];
    ey[nx - k] = -ey[k];
    px[k] = ey[k] / kk;
    py[k] = -ex[k] / kk;
    px[nx - k] = px[k];
    py[nx - k] = -py[k];
  }
  fftx(ex, ey, 1);
  fftx(px, py, 1);
  for (let i = 0; i < nx; i++) {
    E[i] = ex[i] / nx;
    phi[i] = px[i] / nx;
  }
}

// What the part of a cell `e` wide next to its edge holds, for e in (0, 1], from the cells a, b, c in a row with b the cell:
// the cubic through the running sum of the density (Filbet, Sonnendruecker and Bertrand, 2001, as I remember it), then kept
// between 0 and the whole cell, and, with `lim`, between e times the two cell values b and c.
function part(a, b, c, e, lim) {
  const e2 = 1 - e * e, A = (e * e2) / 6, C = (e * (2 - e) * (1 - e)) / 6, B = ((2 - e) * e2) / 2 - C;
  let p = b * (1 - B) - a * A + c * C;
  if (lim) {
    const lo = b < c ? b : c, hi = b < c ? c : b;
    p = p < e * lo ? e * lo : p > e * hi ? e * hi : p;
  }
  return p < 0 ? 0 : p > b ? b : p;
}

// Moves n cells of F, F[off + j * stride], on by d cells (d may be negative and larger than one) by flux balance: every cell
// gives the part of itself next to its far edge to the next cell. It keeps the sum, it keeps the cells positive, and with
// `per` the line wraps round, otherwise nothing crosses its two ends.
function pfc(S, F, off, stride, n, d, per) {
  const { pad, flux } = S, P = 4, lim = S.limit;
  for (let j = 0; j < n; j++) pad[P + j] = F[off + j * stride];
  for (let j = 1; j <= P; j++) {
    pad[P - j] = per ? pad[P + n - j] : 0;
    pad[P + n - 1 + j] = per ? pad[P + j - 1] : 0;
  }
  const sg = d >= 0 ? 1 : -1, m = d * sg, k = floor(m), e = m - k;
  // flux[j]: what cell j gives to cell j + sg
  for (let j = -1; j <= n; j++) flux[P + j] = e > 0 ? part(pad[P + j - sg], pad[P + j], pad[P + j + sg], e, lim) : 0;
  for (let r = 0; r < n; r++) {
    let q = r - sg * k;
    if (per) q = ((q % n) + n) % n;
    else if (q < 0 || q >= n) {
      F[off + r * stride] = 0;
      continue;
    }
    F[off + r * stride] = pad[P + q] - flux[P + q] + flux[P + q - sg];
  }
}

// kick by dt: dv/dt = -E, so every column moves down the rows by d = E dt / dv rows
function kick(S, dt) {
  const { nx, nv, E, dv } = S;
  for (let i = 0; i < nx; i++) {
    let d = (E[i] * dt) / dv;
    d = d < -3 ? -3 : d > 3 ? 3 : d;
    pfc(S, S.u, i * nv, 1, nv, d, false);
    pfc(S, S.l, i * nv, 1, nv, d, false);
  }
}

// the source: relax toward the equilibrium at rate nu, and faster in the last rows at either end of the velocity range. The
// share of the upper beam rides above and below a half along the box (mod, set in waves), so the density stays what it was.
function source(S, dt) {
  const { nx, nv, u, l, u0, l0, rate, mod } = S;
  for (let r = 0; r < nv; r++) rate[r] = 1 - exp(-(S.nu + S.edge[r]) * dt);
  for (let i = 0; i < nx; i++) {
    const o = i * nv, am = 0.85 * tanh((S.modAmp * mod[i]) / 0.85);
    for (let r = 0; r < nv; r++) {
      u[o + r] += rate[r] * (u0[r] * (1 + am) - u[o + r]);
      l[o + r] += rate[r] * (l0[r] * (1 - am) - l[o + r]);
    }
  }
}

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}
// the unevenness of the feed along the box: modes 1 .. NM, each a cosine and a sine whose amplitudes wander with a
// correlation time of MTAU (Ornstein-Uhlenbeck), and a variance of one over NM in all
function waves(S, dt) {
  const mod = S.mod, nx = S.nx, a = exp(-dt / MTAU), b = sqrt((1 - a * a) / NM);
  mod.fill(0);
  for (let m = 0; m < NM; m++) {
    S.oc[m] = a * S.oc[m] + b * gauss();
    S.os[m] = a * S.os[m] + b * gauss();
    for (let i = 0; i < nx; i++) {
      const ph = (TAU * (m + 1) * i) / nx;
      mod[i] += S.oc[m] * cos(ph) + S.os[m] * sin(ph);
    }
  }
}
function step(S, dt) {
  waves(S, dt);
  drift(S, 0.5 * dt);
  field(S);
  kick(S, dt);
  drift(S, 0.5 * dt);
  source(S, dt);
  S.time += dt;
}

// energy, momentum, mass of the state as it stands; the field is solved fresh
function diag(S) {
  const { nx, nv, u, l, dv, dx, E } = S;
  field(S);
  let m = 0, p = 0, K = 0, U = 0;
  for (let i = 0; i < nx; i++) {
    const o = i * nv;
    for (let r = 0; r < nv; r++) {
      const v = (nv / 2 - 0.5 - r) * dv, w = u[o + r] + l[o + r];
      m += w;
      p += w * v;
      K += w * v * v;
    }
    U += E[i] * E[i];
  }
  return { mass: m * dv * dx, mom: p * dv * dx, K: 0.5 * K * dv * dx, U: 0.5 * U * dx, E: 0.5 * K * dv * dx + 0.5 * U * dx };
}

// a start: the two beams with a ripple in the first modes, random phases; eps is the amplitude of the electric field it makes
function seedRipple(S, eps, mmax) {
  const { nx, nv, u, l, u0, l0 } = S;
  const A = [], P = [];
  for (let m = 1; m <= mmax; m++) {
    A.push(eps * ((TAU * m) / S.L) * (0.5 + Math.random()));
    P.push(TAU * Math.random());
  }
  for (let i = 0; i < nx; i++) {
    let g = 1;
    for (let m = 1; m <= mmax; m++) g += A[m - 1] * cos((TAU * m * i) / nx + P[m - 1]);
    for (let r = 0; r < nv; r++) {
      u[i * nv + r] = u0[r] * g;
      l[i * nv + r] = l0[r] * g;
    }
  }
}

// ---- colour. OKLab (Bjorn Ottosson, 2020, constants from memory).
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
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
// ---- the picture. Two things are read from every LED: q, the share of the density that came from the upper beam (u over f),
// which sets the hue from azure through violet and red to amber, and the lightness, which is built from the density.
const NQ = 64, NLV = 64;
const TMP = [0, 0, 0];
function buildLut(S, shift) {
  const lut = S.lut;
  for (let a = 0; a < NQ; a++) {
    const hd = 235 + 180 * (a / (NQ - 1)) + shift, h = (hd * PI) / 180;
    for (let b = 0; b < NLV; b++) {
      const L = 0.1 + 0.88 * (b / (NLV - 1));
      let C = 0.17;
      for (let it = 0; it < 12; it++) {
        lin(L, C * cos(h), C * sin(h), TMP);
        if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
        C *= 0.92;
      }
      const k = 3 * (a * NLV + b);
      lut[k] = L;
      lut[k + 1] = C * cos(h);
      lut[k + 2] = C * sin(h);
    }
  }
  S.hueDone = shift;
}

// ---- Lab hooks
function knobTargets(k) {
  return [cl(k[1], 0.5, 4), cl(k[2], -1, 1), cl(k[3], -1, 1)];
}
function applyKnobs(S) {
  S.L = L0 * pow(1.5, -S.ks);
  S.dx = S.L / S.nx;
  S.nu = NU0 * pow(2.5, S.kq);
  S.modAmp = 0.5;
}

export function setup(params, knobValues) {
  const S = (params.s = newSim(NX, NV, BEAM, WID));
  const n = NX * NV;
  S.lut = new Float32Array(3 * NQ * NLV);
  S.lf = new Float64Array(n);
  S.lb = new Float64Array(n);
  S.qq = new Float64Array(n);
  S.tt = new Float64Array(n);
  S.fbar = new Float64Array(NV);
  S.sr = new Float64Array(2 * NV);
  S.sh = new Float64Array(2 * NV);
  S.hueDone = -1e9;
  [S.kp, S.ks, S.kq] = knobTargets(knobValues || KNOB);
  applyKnobs(S);
  buildLut(S, 0);
  seedRipple(S, 0.03, 8);
  for (let i = 0; i < 400; i++) step(S, 0.12);
  S.time = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, h = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  if (h <= 0) return;
  const tg = knobTargets(k), f = 1 - exp(-4 * h);
  S.kp += (tg[0] - S.kp) * f;
  S.ks += (tg[1] - S.ks) * f;
  S.kq += (tg[2] - S.kq) * f;
  applyKnobs(S);
  const T = h * TAU0 * S.kp, n = max(1, ceil(T / DTMAX - 1e-6));
  for (let i = 0; i < n; i++) step(S, T / n);
  if (!isFinite(S.mass + S.E[0])) {
    // never reached in the runs below; if a value ever went bad, the plasma starts over from its ripple rather than stay dark
    seedRipple(S, 0.03, 8);
    for (let i = 0; i < 400; i++) step(S, 0.12);
  }
}

// the three terms of the lightness: how the density stands against the row it is in (a hole is below its row, a ridge above),
// its fine structure (against a 3 x 3 blur), and the rim where the origin of the particles changes quickly
const LP = { base: 0.5, mix: 0.07, tail: 0.08, ratio: 0.3, fine: 0.2, rim: 0.25, floor: 0.35 };
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { nx, nv, u, l, lut, fbar, lf, lb, qq, tt } = S, o = [0, 0, 0], mx = nx - 1;
  let fm = 0;
  for (let r = 0; r < nv; r++) if (S.u0[r] + S.l0[r] > fm) fm = S.u0[r] + S.l0[r];
  const lfm = log(fm);
  for (let r = 0; r < nv; r++) {
    let m = 0;
    for (let i = 0; i < nx; i++) m += u[i * nv + r] + l[i * nv + r];
    fbar[r] = m / nx + 1e-300;
  }
  for (let k = 0; k < nx * nv; k++) {
    const f = u[k] + l[k] + 1e-300;
    lf[k] = log(f);
    qq[k] = u[k] / f;
  }
  // blur [1 2 1] across the columns, then down the rows
  for (let x = 0; x < nx; x++) {
    const xm = ((x - 1) & mx) * nv, xp = ((x + 1) & mx) * nv, x0 = x * nv;
    for (let y = 0; y < nv; y++) tt[x0 + y] = 0.25 * lf[xm + y] + 0.5 * lf[x0 + y] + 0.25 * lf[xp + y];
  }
  for (let x = 0; x < nx; x++) {
    const x0 = x * nv;
    for (let y = 0; y < nv; y++) lb[x0 + y] = 0.25 * tt[x0 + (y > 0 ? y - 1 : 0)] + 0.5 * tt[x0 + y] + 0.25 * tt[x0 + (y < nv - 1 ? y + 1 : nv - 1)];
  }
  // how far the density strays from its row, and how much fine structure it has, row by row, so that a faint tail is read as
  // boldly as the beams; the spread of a row is never taken below LP.floor of the whole panel's
  const sr = S.sr, sh = S.sh;
  let ar = 0, ah = 0;
  for (let y = 0; y < nv; y++) {
    const lfb = log(fbar[y]);
    let a = 0, b = 0;
    for (let x = 0; x < nx; x++) {
      const k = x * nv + y, d = lf[k] - lfb, e = lf[k] - lb[k];
      a += d * d;
      b += e * e;
    }
    sr[y] = a / nx;
    sh[y] = b / nx;
    ar += sr[y];
    ah += sh[y];
  }
  ar = sqrt(ar / nv) * LP.floor;
  ah = sqrt(ah / nv) * LP.floor;
  for (let y = 0; y < nv; y++) {
    const y0 = y > 0 ? y - 1 : 0, y1 = y < nv - 1 ? y + 1 : nv - 1;
    sr[y + nv] = 1 / max(sqrt(0.25 * sr[y0] + 0.5 * sr[y] + 0.25 * sr[y1]), ar);
    sh[y + nv] = 1 / max(sqrt(0.25 * sh[y0] + 0.5 * sh[y] + 0.25 * sh[y1]), ah);
  }
  for (let y = 0; y < nv; y++) {
    // far out on the tails the density falls by e^8 or more and the columns can no longer hold its steep ripple (it changes
    // by e^3 between neighbours), so there the fine structure and the rim fade out, the ratio is read from the blurred density and
    // the hue goes to that of the beam the row belongs to
    const lfb = log(fbar[y]), tr = sm(-11, -7, lfb - lfm), gr = 0.9 * sr[y + nv], gh = 1.2 * sh[y + nv] * tr, qp = y < nv / 2 ? 1 : 0;
    for (let x = 0; x < nx; x++) {
      const k = x * nv + y;
      const q = qp + tr * (qq[k] - qp);
      const qx = qq[((x + 1) & mx) * nv + y] - qq[((x - 1) & mx) * nv + y];
      const qy = qq[x * nv + (y < nv - 1 ? y + 1 : y)] - qq[x * nv + (y > 0 ? y - 1 : y)];
      const Lm = LP.base + LP.tail * (1 - tr) + LP.mix * 4 * q * (1 - q) + LP.ratio * tanh(gr * (lb[k] + tr * (lf[k] - lb[k]) - lfb)) + LP.fine * tanh(gh * (lf[k] - lb[k])) + LP.rim * tr * tanh(3 * sqrt(qx * qx + qy * qy));
      const idx = 3 * (((q * (NQ - 1) + 0.5) | 0) * NLV + (((Lm < 0.1 ? 0.1 : Lm > 0.98 ? 0.98 : Lm) - 0.1) * ((NLV - 1) / 0.88) + 0.5 | 0));
      lin(lut[idx], lut[idx + 1], lut[idx + 2], o);
      display.setPixel(x, y, gam(o[0]), gam(o[1]), gam(o[2]));
    }
  }
}
