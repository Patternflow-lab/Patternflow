// ===== Patternflow pattern =====
// Title:   Moist Convection
// Family:  weather
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   119
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Moisture=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Flow. draft
// Knob 3: Scale. draft
// Knob 4: Moisture. draft

const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, tanh, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- physics constants (SI)
const G = 9.81, CP = 1004, RD = 287, RV = 461.5, EPS = RD / RV, LV = 2.5e6, P0 = 1e5;
const TH0 = 300; // buoyancy reference potential temperature
const THX = 310; // the reference state's own theta, which sets Exner(z) = 1 - g z / (cp THX)
const LCP = LV / CP, LVRV = LV / RV;
const qsat = (T, p) => {
  const e = 611.2 * exp(LVRV * (1 / 273.15 - 1 / T));
  return (EPS * e) / (p - e);
};

// ---- tunables
const FLOORS = 0.004, SKYB = 0.035, SKYW = 0.12; // the clear sky's share in the picture: floor of the per-row normalisation, lightness swing of buoyancy, hue swing of vertical velocity
const NX = 64, NZ = 128;
const D0 = 40; // metres per LED at Scale 0
const SPS0 = 33; // simulated seconds per panel second at Flow 1
const CFL = 0.6; // sum of Courants allowed in one step
const KE0 = 2; // eddy viscosity and diffusivity at D0, m^2/s
const ZF = 160; // depth the surface exchange is spread over, m
const TAUS = 800; // surface exchange time, s
const TAUR = 10800; // radiative relaxation time in the troposphere, s
const TAUQ = 3600; // drying of the free troposphere toward its target humidity, s
const QC0 = 0.5e-3, KAUTO = 2.5e-3, KACC = 2.2, KEVAP = 0.06; // Kessler warm rain
const ALPHA = 1 / 10800; // drag on vorticity, 1/s
const TAUU = 2400; // relaxation of the mean wind to the shear profile, s
const SHEAR0 = 7; // m/s, the wind at the top relative to the bottom is twice this

// ---- in-place complex FFT, N a power of two (as in rayleigh-benard.js)
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

// ---- state. Scalars live in the nx x nz cells, stream function and vorticity on the (nx x nz+1) corners.
function newState(nx, nz) {
  const n = nx * nz, nn = nx * (nz + 1), h = nx / 2 + 1;
  const F = () => new Float64Array(n), N = () => new Float64Array(nn), Z = () => new Float64Array(nz);
  const S = {
    nx, nz, n, nn, h, D: D0, time: 0,
    TL: F(), QT: F(), QR: F(), QC: F(), B: F(), RH: F(),
    TL1: F(), QT1: F(), DA: F(), SX: F(), SZ: F(), GX: F(), GZ: N(), TLn: F(), QTn: F(),
    P: N(), W: N(), W2: N(), FX: F(), WZ: N(), U: N(), V: N(), Wp: new Float64Array(nx * (nz + 5)),
    fft: makeFft(nx), zr: new Float64Array(nx), zi: new Float64Array(nx),
    Sr: new Float64Array((nz + 1) * h), Si: new Float64Array((nz + 1) * h), Pr: new Float64Array((nz + 1) * h), Pi: new Float64Array((nz + 1) * h),
    cx: new Float64Array(h), ivm: new Float64Array(h * nz), dr: new Float64Array(nz), di: new Float64Array(nz),
    PI: Z(), PRS: Z(), LCJ: Z(), ICE: Z(), QC0J: Z(), KAUJ: Z(), VTF: Z(), THEQ: Z(), KR: Z(), KS: Z(), QEQ: Z(), KQ: Z(), ALP: Z(), ETN: new Float64Array(nz + 1), UTN: Z(),
    TS: new Float64Array(nx), QSF: new Float64Array(nx), ph: new Float64Array(8), wv: new Float64Array(8), kv: new Float64Array(8),
    // knob state
    ks: 0, kq: 0, kf: 2, Ts: 300, wet: 0.85, rhr: 0.4, Jinv: 0, zinv: 3000, qBL: 0.015, cmax: 0, wmax: 0,
    // switches the tests use
    forcing: true, wallB: NaN, wallT: NaN, shearOn: true,
    // budgets
    srcQ: 0, rainOut: 0, radH: 0, surfH: 0, micH: 0,
  };
  for (let k = 0; k < h; k++) S.cx[k] = 2 * cos((TAU * k) / nx) - 2;
  for (let k = 0; k < h; k++) {
    const b = S.cx[k] - 2;
    let m = b;
    S.ivm[k * nz + 1] = 1 / m;
    for (let j = 2; j < nz; j++) {
      m = b - S.ivm[k * nz + j - 1];
      S.ivm[k * nz + j] = 1 / m;
    }
  }
  const ks = [2, 3, 5, 7, 11, 13, 17, 19];
  for (let m = 0; m < 8; m++) {
    S.kv[m] = ks[m];
    S.ph[m] = Math.random() * TAU;
    S.wv[m] = (0.00045 + 0.0006 * Math.random()) * (m % 2 ? 1 : -1);
  }
  return S;
}

// ---- the sounding, in metres. Piecewise-linear lapse rates of theta_l and a decaying total water.
const TH_TAB = [[0, 0], [650, 0], [850, 1.2], [3500, 1.2 + 2.6 * 2.65], [7000, 1.2 + 2.6 * 2.65 + 3.4 * 3.5], [8000, 1.2 + 2.6 * 2.65 + 3.4 * 3.5 + 9], [20000, 1.2 + 2.6 * 2.65 + 3.4 * 3.5 + 9 + 22 * 12]];
function tab(T, z) {
  if (z <= T[0][0]) return T[0][1];
  for (let q = 1; q < T.length; q++)
    if (z <= T[q][0]) return T[q - 1][1] + ((T[q][1] - T[q - 1][1]) * (z - T[q - 1][0])) / (T[q][0] - T[q - 1][0]);
  return T[T.length - 1][1];
}

function thEnv(S, z) {
  return S.Ts - 1.5 + tab(TH_TAB, z) + S.Jinv * sm(S.zinv - 250, S.zinv + 250, z);
}
function qFree(S, j, z) {
  // total water the free troposphere is drawn toward: a share of saturation at the radiative-equilibrium temperature
  return S.rhr * qsat(S.PI[j] * (thEnv(S, z) - 2.2 + 3), S.PRS[j]);
}
function envQ(S, j, z) {
  const s = sm(700, 1400, z);
  return S.qBL * (1 - s) + max(2e-4, qFree(S, j, z)) * s;
}

function profiles(S) {
  const { nz, D } = S;
  const H = nz * D;
  for (let j = 0; j < nz; j++) {
    const z = (j + 0.5) * D;
    S.PI[j] = 1 - (G * z) / (CP * THX);
    S.PRS[j] = P0 * pow(S.PI[j], CP / RD);
    S.LCJ[j] = LCP / S.PI[j];
    S.THEQ[j] = thEnv(S, z) - 2.2;
    S.KR[j] = (1 / TAUR) * (1 + 5 * max(sm(7000, 8500, z), sm(0.78 * H, 0.95 * H, z)));
    S.KS[j] = exp(-z / ZF) / TAUS;
    S.QEQ[j] = max(2e-4, qFree(S, j, z));
    S.KQ[j] = sm(S.zinv - 300, S.zinv + 300, z) / TAUQ + max(sm(6500, 8000, z), sm(0.78 * H, 0.95 * H, z)) / 1800;
    S.ALP[j] = ALPHA + sm(nz - 14, nz, j + 0.5) / 900;
    // above the freezing level cloud turns to snow quickly and the snow falls slowly: anvils shed fall streaks instead of staying
    const fi = max(sm(3800, 5600, z), sm(0.72 * H, 0.95 * H, z));
    S.ICE[j] = fi;
    S.QC0J[j] = QC0 * (1 - 0.9 * fi);
    S.KAUJ[j] = KAUTO * (1 + 3 * fi);
    S.VTF[j] = 1 - 0.65 * fi;
  }
  // target mean wind: linear shear, depth-mean zero, at cell centres; vorticity target at the corners
  let m = 0;
  for (let j = 0; j < nz; j++) {
    S.UTN[j] = ((j + 0.5) / nz - 0.5) * 2;
    m += S.UTN[j];
  }
  for (let j = 0; j < nz; j++) S.UTN[j] -= m / nz;
  for (let j = 1; j < nz; j++) S.ETN[j] = (S.UTN[j] - S.UTN[j - 1]) / D;
  S.ETN[0] = S.ETN[nz] = 0;
  S.Hd = H;
}

function seedState(S) {
  const { nx, nz, D } = S;
  profiles(S);
  for (let j = 0; j < nz; j++) {
    const z = (j + 0.5) * D;
    for (let i = 0; i < nx; i++) {
      S.TL[j * nx + i] = thEnv(S, z);
      S.QT[j * nx + i] = envQ(S, j, z);
    }
  }
  // warm moist swells at several heights, so that the first frame already has thermals standing and rising: shallow and weak
  // under a strong inversion, wide and strong where the air is moist
  const top = min(S.zinv, nz * D * 0.9) - 400, iq = (S.kq + 1) / 2;
  for (let b = 0; b < 9; b++) {
    const x0 = Math.random() * nx, z0 = 250 + Math.random() * (top - 250), wd = ((230 + 200 * Math.random()) / D) * (0.8 + 0.5 * iq), a = (0.45 + 0.7 * Math.random()) * (0.55 + 0.9 * iq);
    for (let j = 0; j < nz; j++) {
      const dz = ((j + 0.5) * D - z0) / D;
      if (abs(dz) > 3 * wd) continue;
      for (let i = 0; i < nx; i++) {
        let dx = abs(i - x0);
        dx = min(dx, nx - dx);
        const g = exp(-(dx * dx + dz * dz) / (wd * wd));
        S.TL[j * nx + i] += a * g;
        S.QT[j * nx + i] += 0.0007 * a * g;
      }
    }
  }
  S.QR.fill(0);
  S.QC.fill(0);
  S.W.fill(0);
  S.P.fill(0);
  fluxes(S);
}

// ---- stream function from vorticity: del^2 psi = -eta, by FFT across the columns and a tridiagonal solve down the rows.
// psi = 0 on the floor and the lid, eta = 0 there (free slip).
function solve(S) {
  const { nx, nz, h, W, P, fft, zr, zi, Sr, Si, Pr, Pi, ivm, cx, D } = S, mx = nx - 1, d2 = D * D;
  for (let j = 0; j < nz; j += 2) {
    const o = j * nx, o2 = o + nx;
    for (let i = 0; i < nx; i++) {
      zr[i] = W[o + i];
      zi[i] = W[o2 + i];
    }
    fft(zr, zi, -1);
    const q = j * h, q2 = q + h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
      Sr[q + k] = 0.5 * (zr[k] + zr[k2]);
      Si[q + k] = 0.5 * (zi[k] - zi[k2]);
      Sr[q2 + k] = 0.5 * (zi[k] + zi[k2]);
      Si[q2 + k] = -0.5 * (zr[k] - zr[k2]);
    }
  }
  const dr = S.dr, di = S.di;
  for (let k = 0; k < h; k++) {
    const ko = k * nz;
    // forward elimination on -eta d2, for the real and the imaginary part together
    let r = -d2 * Sr[h + k], s = -d2 * Si[h + k];
    dr[1] = r * ivm[ko + 1];
    di[1] = s * ivm[ko + 1];
    for (let j = 2; j < nz; j++) {
      r = -d2 * Sr[j * h + k];
      s = -d2 * Si[j * h + k];
      dr[j] = (r - dr[j - 1]) * ivm[ko + j];
      di[j] = (s - di[j - 1]) * ivm[ko + j];
    }
    Pr[(nz - 1) * h + k] = dr[nz - 1];
    Pi[(nz - 1) * h + k] = di[nz - 1];
    for (let j = nz - 2; j >= 1; j--) {
      Pr[j * h + k] = dr[j] - ivm[ko + j] * Pr[(j + 1) * h + k];
      Pi[j * h + k] = di[j] - ivm[ko + j] * Pi[(j + 1) * h + k];
    }
    Pr[k] = Pi[k] = 0;
  }
  for (let j = 0; j < nz; j += 2) {
    const q = j * h, q2 = q + h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
      zr[k] = Pr[q + k] - Pi[q2 + k];
      zi[k] = Pi[q + k] + Pr[q2 + k];
      if (k2 !== k) {
        zr[k2] = Pr[q + k] + Pi[q2 + k];
        zi[k2] = -Pi[q + k] + Pr[q2 + k];
      }
    }
    fft(zr, zi, 1);
    const o = j * nx, s = 1 / nx;
    for (let i = 0; i < nx; i++) {
      P[o + i] = zr[i] * s;
      P[o + nx + i] = zi[i] * s;
    }
  }
  for (let i = 0; i < nx; i++) P[nz * nx + i] = 0;
}

// ---- face fluxes (m^2/s) from psi: FX through the vertical face left of cell (i,j), WZ through the horizontal face under it.
// Their divergence over any cell is zero to rounding, whatever psi is.
function fluxes(S) {
  const { nx, nz, P, FX, WZ } = S, mx = nx - 1;
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) FX[o + i] = -(P[o + nx + i] - P[o + i]);
  }
  for (let j = 0; j <= nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) WZ[o + i] = P[o + ((i + 1) & mx)] - P[o + i];
  }
  // the largest outflow a cell has, in m^2/s: half the sum of |flux| over its four faces. The step is limited by it.
  let m = 0, mw = 0;
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = o + i, w = 0.5 * (abs(WZ[k]) + abs(WZ[k + nx])), a = 0.5 * (abs(FX[k]) + abs(FX[o + ((i + 1) & mx)])) + w;
      if (a > m) m = a;
      if (w > mw) mw = w;
    }
  }
  S.cmax = m;
  S.wmax = mw / S.D;
}

// ---- conservative scalar advection: monotonised-central slopes, upwind face values, SSP-RK2.
const lim = (a, b) => (a * b <= 0 ? 0 : a > 0 ? min(0.5 * (a + b), 2 * a, 2 * b) : max(0.5 * (a + b), 2 * a, 2 * b));
function tendency(S, Q, out, c) {
  const { nx, nz, SX, SZ, GX, GZ, FX, WZ } = S, mx = nx - 1;
  for (let j = 0; j < nz; j++) {
    const o = j * nx, edge = j === 0 || j === nz - 1;
    for (let i = 0; i < nx; i++) {
      const k = o + i, q = Q[k];
      SX[k] = lim(q - Q[o + ((i - 1) & mx)], Q[o + ((i + 1) & mx)] - q);
      SZ[k] = edge ? 0 : lim(q - Q[k - nx], Q[k + nx] - q);
    }
  }
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = o + i, f = FX[k], il = o + ((i - 1) & mx);
      GX[k] = f * (f >= 0 ? Q[il] + 0.5 * SX[il] : Q[k] - 0.5 * SX[k]);
    }
  }
  for (let i = 0; i < nx; i++) GZ[i] = GZ[nz * nx + i] = 0;
  for (let k = nx; k < nz * nx; k++) {
    const f = WZ[k], kd = k - nx;
    GZ[k] = f * (f >= 0 ? Q[kd] + 0.5 * SZ[kd] : Q[k] - 0.5 * SZ[k]);
  }
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = o + i;
      out[k] = -c * (GX[o + ((i + 1) & mx)] - GX[k] + GZ[k + nx] - GZ[k]);
    }
  }
}

function advectScalars(S, c) {
  const { n, TL, QT, TL1, QT1, DA } = S;
  for (const [Q, Q1] of [[TL, TL1], [QT, QT1]]) {
    tendency(S, Q, DA, c);
    for (let k = 0; k < n; k++) Q1[k] = Q[k] + DA[k];
    tendency(S, Q1, DA, c);
    for (let k = 0; k < n; k++) Q[k] = 0.5 * (Q[k] + Q1[k] + DA[k]);
  }
}

// rain: first-order upwind with the air's velocity, plus its own fall out of the cell above
function advectRain(S, c) {
  const { nx, nz, QR, FX, WZ, GX, GZ, DA } = S, mx = nx - 1, D = S.D;
  // fall speed of each cell's rain, m/s
  for (let j = 0; j < nz; j++) {
    const vf = S.VTF[j], o = j * nx;
    for (let i = 0; i < nx; i++) {
      const q = QR[o + i];
      DA[o + i] = q > 1e-9 ? vf * cl(6 * sqrt(sqrt(q * 1000)), 2, 10) : 0;
    }
  }
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = o + i, f = FX[k];
      GX[k] = f >= 0 ? f * QR[o + ((i - 1) & mx)] : f * QR[k];
    }
  }
  for (let i = 0; i < nx; i++) {
    GZ[i] = -D * DA[i] * QR[i];
    GZ[nz * nx + i] = 0;
  }
  for (let j = 1; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = o + i, f = WZ[k];
      GZ[k] = (f >= 0 ? f * QR[k - nx] : f * QR[k]) - D * DA[k] * QR[k];
    }
  }
  let out = 0;
  for (let i = 0; i < nx; i++) out += c * D * DA[i] * QR[i];
  S.rainOut += out;
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = o + i;
      let v = QR[k] - c * (GX[o + ((i + 1) & mx)] - GX[k] + GZ[k + nx] - GZ[k]);
      QR[k] = v < 0 ? 0 : v;
    }
  }
}

// ---- explicit diffusion of the two thermodynamic scalars, no flux through the floor and the lid
function diffuse(S, dt) {
  const { nx, nz, TL, QT, TLn, QTn, D } = S, mx = nx - 1;
  const kk = (S.KE * dt) / (D * D);
  for (const [Q, Qn] of [[TL, TLn], [QT, QTn]]) {
    for (let j = 0; j < nz; j++) {
      const o = j * nx, ou = j < nz - 1 ? o + nx : o, od = j > 0 ? o - nx : o;
      for (let i = 0; i < nx; i++) {
        const k = o + i, q = Q[k];
        Qn[k] = q + kk * (Q[o + ((i + 1) & mx)] + Q[o + ((i - 1) & mx)] + Q[ou + i] + Q[od + i] - 4 * q);
      }
    }
    if (Q === TL && S.wallB === S.wallB)
      for (let i = 0; i < nx; i++) {
        Qn[i] += 2 * kk * (S.wallB - Q[i]);
        Qn[(nz - 1) * nx + i] += 2 * kk * (S.wallT - Q[(nz - 1) * nx + i]);
      }
    Q.set(Qn);
  }
}

// ---- the surface, the radiation and the dry upper air. Each relaxes exactly over the step.
function forcing(S, dt) {
  const { nx, nz, TL, QT, THEQ, KR, KS, QEQ, KQ, TS, QSF } = S;
  for (let m = 0; m < 8; m++) S.ph[m] += S.wv[m] * dt;
  // the surface is not quite uniform: waves across the columns drift at slow incommensurate rates
  for (let i = 0; i < nx; i++) {
    let a = 0;
    for (let m = 0; m < 6; m++) a += cos((TAU * S.kv[m] * i) / nx + S.ph[m]) / sqrt(S.kv[m]);
    TS[i] = S.Ts + 0.25 * a;
    QSF[i] = S.wet * qsat(TS[i], P0) * (1 + 0.01 * a);
  }
  let dQ = 0;
  for (let j = 0; j < nz; j++) {
    const o = j * nx, kr = KR[j], kq = KQ[j], ks = KS[j];
    if (kr > 0) {
      const f = 1 - exp(-dt * kr), th = THEQ[j];
      let s = 0;
      for (let i = 0; i < nx; i++) {
        const d = (th - TL[o + i]) * f;
        TL[o + i] += d;
        s += d;
      }
      S.radH += s;
    }
    if (kq > 1e-12) {
      const f = 1 - exp(-dt * kq), q = QEQ[j];
      let s = 0;
      for (let i = 0; i < nx; i++) {
        const d = (q - QT[o + i]) * f;
        QT[o + i] += d;
        s += d;
      }
      dQ += s;
    }
    if (ks > 1e-7) {
      const f = 1 - exp(-dt * ks);
      let st = 0, sq = 0;
      for (let i = 0; i < nx; i++) {
        const d1 = (TS[i] - TL[o + i]) * f, d2 = (QSF[i] - QT[o + i]) * f;
        TL[o + i] += d1;
        QT[o + i] += d2;
        st += d1;
        sq += d2;
      }
      S.surfH += st;
      dQ += sq;
    }
  }
  S.srcQ += dQ;
}

// ---- saturation adjustment, warm rain and buoyancy in one pass over the cells
function thermo(S, dt) {
  const { nx, nz, TL, QT, QR, QC, B, RH, PI, PRS, LCJ, QC0J, KAUJ } = S;
  let mic = 0;
  for (let j = 0; j < nz; j++) {
    const pi = PI[j], p = PRS[j], lcj = LCJ[j], o = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = o + i;
      let tl = TL[k], qt = QT[k], qr = QR[k], qc = 0;
      const T0 = pi * tl, es0 = 611.2 * exp(LVRV * (1 / 273.15 - 1 / T0)), qs0 = (EPS * es0) / (p - es0);
      let rh;
      if (qt > qs0) {
        let T = T0, qs = qs0;
        for (let it = 0; it < 6; it++) {
          const dq = qs * (LVRV / (T * T)) * (1 + qs / EPS);
          const d = (qt - qc - qs) / (1 + LCP * dq);
          qc += d;
          if (qc < 0) qc = 0;
          T = T0 + LCP * qc;
          const e = 611.2 * exp(LVRV * (1 / 273.15 - 1 / T));
          qs = (EPS * e) / (p - e);
          if (abs(d) < 1e-12) break;
        }
        rh = 1;
      } else rh = qt / qs0;
      if (qr > 0 || qc > 0) {
        let conv = 0, ev = 0;
        if (qc > 0) {
          let r = KAUJ[j] * (qc > QC0J[j] ? qc - QC0J[j] : 0);
          if (qr > 1e-8) r += KACC * qc * pow(qr, 0.875);
          conv = r * dt;
          if (conv > qc) conv = qc;
        } else if (qr > 0) {
          const def = qs0 - qt;
          if (def > 0) {
            const T0s = T0 * T0, dq0 = qs0 * (LVRV / T0s) * (1 + qs0 / EPS);
            ev = KEVAP * def * sqrt(qr) * dt;
            const emax = def / (1 + LCP * dq0);
            if (ev > emax) ev = emax;
            if (ev > qr) ev = qr;
          }
        }
        if (conv !== 0 || ev !== 0) {
          tl += lcj * (conv - ev);
          mic += lcj * (conv - ev);
          qt += ev - conv;
          qr += conv - ev;
          qc -= conv;
          TL[k] = tl;
          QT[k] = qt;
          QR[k] = qr;
        }
      }
      QC[k] = qc;
      RH[k] = rh;
      const th = tl + lcj * qc;
      B[k] = (G * (th * (1 + 0.608 * (qt - qc) - qc - qr) - TH0)) / TH0;
    }
  }
  S.micH += mic;
}

// ---- vorticity: semi-Lagrangian advection with limited Catmull-Rom look-up (as rayleigh-benard.js), buoyancy, drag
function sampleCR(Wp, nx, fi, fj) {
  const mx = nx - 1;
  const i1 = floor(fi), j1 = floor(fj), tx = fi - i1, ty = fj - j1;
  const xa = (i1 - 1) & mx, xb = i1 & mx, xc = (i1 + 1) & mx, xd = (i1 + 2) & mx;
  const t2 = tx * tx, t3 = t2 * tx;
  const ax = -0.5 * t3 + t2 - 0.5 * tx, bx = 1.5 * t3 - 2.5 * t2 + 1, cx = -1.5 * t3 + 2 * t2 + 0.5 * tx, dx = 0.5 * t3 - 0.5 * t2;
  const s2 = ty * ty, s3 = s2 * ty;
  const ay = -0.5 * s3 + s2 - 0.5 * ty, by = 1.5 * s3 - 2.5 * s2 + 1, cy = -1.5 * s3 + 2 * s2 + 0.5 * ty, dy = 0.5 * s3 - 0.5 * s2;
  const ra = (j1 + 1) * nx, rb = ra + nx, rc = rb + nx, rd = rc + nx;
  const va = ax * Wp[ra + xa] + bx * Wp[ra + xb] + cx * Wp[ra + xc] + dx * Wp[ra + xd];
  const vb = ax * Wp[rb + xa] + bx * Wp[rb + xb] + cx * Wp[rb + xc] + dx * Wp[rb + xd];
  const vc = ax * Wp[rc + xa] + bx * Wp[rc + xb] + cx * Wp[rc + xc] + dx * Wp[rc + xd];
  const vd = ax * Wp[rd + xa] + bx * Wp[rd + xb] + cx * Wp[rd + xc] + dx * Wp[rd + xd];
  const r = ay * va + by * vb + cy * vc + dy * vd;
  const p = Wp[rb + xb], q = Wp[rb + xc], s = Wp[rc + xb], u = Wp[rc + xc];
  const lo = min(min(p, q), min(s, u)), hi = max(max(p, q), max(s, u));
  return r < lo ? lo : r > hi ? hi : r;
}

function vorticity(S, dt) {
  const { nx, nz, P, W, W2, U, V, Wp, B, D } = S, mx = nx - 1, id = 1 / D;
  // node velocities by central differences of psi: u = -dpsi/dz, w = dpsi/dx, m/s
  for (let j = 1; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      U[o + i] = -0.5 * (P[o + nx + i] - P[o - nx + i]) * id;
      V[o + i] = 0.5 * (P[o + ((i + 1) & mx)] - P[o + ((i - 1) & mx)]) * id;
    }
  }
  for (let i = 0; i < nx; i++) {
    U[i] = U[nx + i];
    V[i] = 0;
    U[nz * nx + i] = U[(nz - 1) * nx + i];
    V[nz * nx + i] = 0;
  }
  // padded copy with two ghost rows, odd about the walls
  for (let j = 0; j <= nz; j++) {
    const o = j * nx, q = (j + 2) * nx;
    for (let i = 0; i < nx; i++) Wp[q + i] = W[o + i];
  }
  for (let g = 1; g <= 2; g++)
    for (let i = 0; i < nx; i++) {
      Wp[(2 - g) * nx + i] = -W[g * nx + i];
      Wp[(nz + 2 + g) * nx + i] = -W[(nz - g) * nx + i];
    }
  const dd = dt * id;
  for (let j = 1; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const xm = i - 0.5 * dd * U[k];
      let ym = j - 0.5 * dd * V[k];
      ym = ym < 0 ? 0 : ym > nz ? nz : ym;
      const i0 = floor(xm), j0 = min(floor(ym), nz - 1), a = xm - i0, b = ym - j0;
      const x0 = i0 & mx, x1 = (i0 + 1) & mx, r0 = j0 * nx, r1 = r0 + nx;
      const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
      const u1 = w00 * U[r0 + x0] + w10 * U[r0 + x1] + w01 * U[r1 + x0] + w11 * U[r1 + x1];
      const v1 = w00 * V[r0 + x0] + w10 * V[r0 + x1] + w01 * V[r1 + x0] + w11 * V[r1 + x1];
      let yf = j - dd * v1;
      yf = yf < 0 ? 0 : yf > nz ? nz : yf;
      W2[k] = sampleCR(Wp, nx, i - dd * u1, yf);
    }
  for (let i = 0; i < nx; i++) W2[i] = W2[nz * nx + i] = 0;
  // buoyancy: d eta / dt = -dB/dx, B in the cells around each corner
  const bk = dt / (2 * D);
  for (let j = 1; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      const im = (i - 1) & mx;
      W2[o + i] -= bk * (B[o - nx + i] + B[o + i] - B[o - nx + im] - B[o + im]);
    }
  }
  // viscosity and drag, then the horizontal mean relaxed to the shear profile
  const kk = (S.KE * dt) / (D * D);
  for (let j = 1; j < nz; j++) {
    const o = j * nx, al = dt * S.ALP[j];
    for (let i = 0; i < nx; i++) {
      const k = o + i, w = W2[k];
      W[k] = w + kk * (W2[o + ((i + 1) & mx)] + W2[o + ((i - 1) & mx)] + W2[k + nx] + W2[k - nx] - 4 * w) - al * w;
    }
  }
  for (let i = 0; i < nx; i++) W[i] = W[nz * nx + i] = 0;
  const f = 1 - exp(-dt / TAUU), A = S.shearOn ? S.shear : 0;
  for (let j = 1; j < nz; j++) {
    const o = j * nx;
    let m = 0;
    for (let i = 0; i < nx; i++) m += W[o + i];
    const d = (m / nx - A * S.ETN[j]) * f;
    for (let i = 0; i < nx; i++) W[o + i] -= d;
  }
}

// the slowly varying mean wind: a sum of two sines at incommensurate periods, so it never repeats
function shearAt(t) {
  return SHEAR0 * (0.65 * sin(TAU * t / 4700 + 0.7) + 0.45 * sin(TAU * t / 7919 + 2.1));
}

function step(S, dt) {
  const c = dt / (S.D * S.D);
  advectScalars(S, c);
  advectRain(S, c);
  diffuse(S, dt);
  if (S.forcing) forcing(S, dt);
  thermo(S, dt);
  S.shear = shearAt(S.time);
  vorticity(S, dt);
  solve(S);
  fluxes(S); // for the next step, and for its size
  S.time += dt;
}

function dtMax(S) {
  // the outflow Courant number of the advection, the rain's own fall on top of the vertical wind, and the diffusion
  const D = S.D;
  return min((CFL * D * D) / (S.cmax + 1e-9), (0.8 * D) / (S.wmax + 10), (0.2 * D * D) / S.KE);
}

// ---- knobs
const KNOB = [0, 2, 0, 0.06];
function applyKnobs(S, kf, ks, kq) {
  const D = D0 * pow(1.6, ks), i = 0.5 * (cl(kq, -1, 1) + 1);
  S.kf = kf;
  S.ks = ks;
  S.kq = kq;
  S.Ts = 299.3 + 3.2 * i;
  S.wet = 0.82 + 0.1 * i;
  S.rhr = 0.2 + 0.4 * i;
  S.Jinv = 7 * pow(1 - i, 1.3);
  S.zinv = 2600 + 3400 * i;
  S.qBL = 0.78 * qsat(S.Ts - 1.5, P0);
  S.KE = KE0 * pow(D / D0, 4 / 3);
  if (abs(D - S.D) > 1e-9 * D || !S.Hd) {
    S.D = D;
    profiles(S);
  } else profiles(S);
}


// ---- colour. OKLab (Bjorn Ottosson, 2020, constants from memory)
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

// the sky, one colour per row: lightness, chroma and hue from the horizon up
function skyRows(S, shift) {
  const { nz } = S;
  for (let j = 0; j < nz; j++) {
    const u = j / (nz - 1);
    let L = 0.74 - 0.34 * pow(u, 0.75), C = 0.1 + 0.07 * u;
    const hd = 214 + 44 * pow(u, 0.9) + shift;
    // a dark orange or olive reads as brown on the panel, so the warm hues come up in lightness
    let dh = (((hd - 85) % 360) + 360) % 360;
    if (dh > 180) dh -= 360;
    S.bw[j] = exp(-(dh * dh) / 4200);
    S.bl[j] = 1 - sm(0.1, 0.3, u);
    S.sL[j] = L;
    S.sC[j] = C;
    S.sH[j] = (hd * PI) / 180;
  }
  S.hueDone = shift;
}

function setupDraw(S) {
  const nz = S.nz;
  S.sL = new Float64Array(nz);
  S.sC = new Float64Array(nz);
  S.sH = new Float64Array(nz);
  S.SH = new Float64Array(S.n);
  S.bm = new Float64Array(nz);
  S.bw = new Float64Array(nz);
  S.bl = new Float64Array(nz);
  S.bs = new Float64Array(nz);
  S.ws = new Float64Array(nz);
  S.hueDone = -999;
  S.pt = 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { nx, nz, QC, QR, RH, B, WZ, D, SH, sL, sC, sH, bm, bs, bw, bl, ws } = S, mx = nx - 1, o = [0, 0, 0];
  // buoyancy against its level mean, in units of that level's rms (never less than a share of the panel's)
  let gs = 0;
  for (let j = 0; j < nz; j++) {
    let m = 0;
    for (let i = 0; i < nx; i++) m += B[j * nx + i];
    bm[j] = m / nx;
    let v = 0;
    for (let i = 0; i < nx; i++) v += (B[j * nx + i] - bm[j]) ** 2;
    bs[j] = sqrt(v / nx);
    gs += bs[j];
  }
  gs /= nz;
  for (let j = 0; j < nz; j++) bs[j] = 1 / max(bs[j], FLOORS * gs, 1e-9);
  let gw = 0;
  for (let j = 0; j < nz; j++) {
    let v = 0;
    for (let i = 0; i < nx; i++) v += (WZ[j * nx + i] + WZ[(j + 1) * nx + i]) ** 2;
    ws[j] = sqrt(v / nx) / 2 / D;
    gw += ws[j];
  }
  gw /= nz;
  for (let j = 0; j < nz; j++) ws[j] = 1 / max(ws[j], FLOORS * gw, 1e-9);
  // the sun wanders slowly across the upper sky (two sines of incommensurate periods); what lies on the ray toward it shades a cell
  const t = S.pt, xs = 32 - 30 * (0.62 + 0.38 * (0.6 * sin((TAU * t) / 157 + 0.9) + 0.4 * sin((TAU * t) / 241 + 2.3))), ys = 14 + 8 * sin((TAU * t) / 197 + 1.7), sl = (32 - xs) / 24;
  for (let i = 0; i < nx; i++) SH[(nz - 1) * nx + i] = 0;
  for (let j = nz - 2; j >= 0; j--) {
    const o1 = j * nx, o2 = o1 + nx;
    for (let i = 0; i < nx; i++) {
      const xf = i - sl, x0 = floor(xf), f = xf - x0, a = o2 + (x0 & mx), b = o2 + ((x0 + 1) & mx);
      SH[o1 + i] = 0.84 * ((1 - f) * (SH[a] + QC[a]) + f * (SH[b] + QC[b]));
    }
  }
  for (let y = 0; y < nz; y++) {
    const j = nz - 1 - y, Lr = sL[j], Cr = sC[j], Hr = sH[j];
    for (let x = 0; x < nx; x++) {
      const k = j * nx + x, qc = QC[k], qr = QR[k];
      const w = (0.5 * (WZ[k] + WZ[k + nx])) / D;
      const hz = sm(0.15, 1, RH[k]);
      const gx = x - xs, gy = y - ys, glow = exp(-(gx * gx + gy * gy) / 500), am = 1 + 2 * bl[j];
      let L = Lr + 0.08 * hz + 0.09 * glow + SKYB * am * tanh((B[k] - bm[j]) * bs[j]), C = Cr * (1 - 0.3 * hz), h = Hr + SKYW * (1 + 0.5 * bl[j]) * tanh(w * ws[j]);
      const cold = sm(0.01, 0.08, bm[j] - B[k]) * bl[j];
      L -= 0.09 * cold;
      h -= 0.12 * cold;
      if (qr > 1e-6) {
        // rain darkens and deepens the sky behind it; snow above the freezing level whitens it
        const ar = 1 - exp(-qr * 2500), ic = S.ICE[j];
        L = L * (1 - 0.35 * ar * (1 - ic)) + 0.12 * ar * ic;
        C *= 1 + 0.25 * ar * (1 - ic);
      }
      const a = 1 - exp(-qc * 4000);
      if (a > 0.002) {
        const lit = exp(-(SH[k] + 0.25 * qc) * 360);
        L += (0.42 + 0.58 * lit - L) * a;
        C += (0.015 + 0.045 * (1 - lit) - C) * a;
      }
      if (j < 3) {
        L = 0.24 + 0.1 * tanh((S.TS[x] - S.Ts) * 2);
        C = 0.08;
      }
      L += 0.3 * bw[j] * (1 - sm(0.5, 0.9, L));
      lin(L, C * cos(h), C * sin(h), o);
      display.setPixel(x, y, gam(o[0]), gam(o[1]), gam(o[2]));
    }
  }
}

// The Lab calls setup(params) with no knobs, so the state is built on the first update, from the knobs it is handed: a panel that
// opens at Moisture 1 starts as a deep-convective sky, not as the default one that then has to be turned into it.
function build(params, k) {
  const S = (params.s = newState(NX, NZ));
  S.Hd = 0;
  applyKnobs(S, cl(k[1], 0.5, 4), cl(k[2], -1, 1), cl(k[3], -1, 1));
  seedState(S);
  setupDraw(S);
  skyRows(S, cl(k[0], 0, 1) * 360);
  // a spin-up of 500 s of model time, so that the first frame has clouds standing
  let left = 500;
  while (left > 1e-6) {
    const dm = dtMax(S), n = ceil(left / dm - 1e-9), d = left / n;
    step(S, d);
    left -= d;
  }
  S.time = 0;
}

export function setup(params, knobValues) {
  params.s = null;
  if (knobValues) build(params, knobValues);
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) build(params, k);
  const S = params.s, h = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) skyRows(S, hue);
  if (h <= 0) return;
  S.pt += h;
  const f = 1 - exp(-4 * h);
  applyKnobs(S, S.kf + (cl(k[1], 0.5, 4) - S.kf) * f, S.ks + (cl(k[2], -1, 1) - S.ks) * f, S.kq + (cl(k[3], -1, 1) - S.kq) * f);
  let left = h * SPS0 * S.kf * pow(S.D / D0, 0.5);
  while (left > 1e-6) {
    const dm = dtMax(S), n = ceil(left / dm - 1e-9), d = left / n;
    step(S, d);
    left -= d;
  }
  // never reached in the runs below; if a value ever went bad, start the sky over rather than stay dark
  if (!isFinite(S.TL[S.n >> 1] + S.QT[S.n >> 2] + S.P[S.nn >> 1] + S.W[S.nn >> 2])) build(params, k);
}
