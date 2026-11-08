// ===== Patternflow pattern =====
// Title:   Branched Flow
// Family:  particle
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   117
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=1..4, Scale=-1..1, Strength=-1..1
//
// Knob 1: Hue.
// Knob 2: Flow.
// Knob 3: Scale.
// Knob 4: Strength.

const W = 64, H = 128;
const { floor, ceil, min, max, sqrt, sin, cos, exp, log, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the landscape grid ---------------------------------------------------------------------
const GH = 0.5, GI = 1 / GH; // grid spacing in LEDs
const PAD = 32; // LEDs of beam and landscape above the panel
const YT = -PAD - 1, YB = H + 3; // top and bottom row of the grid, in LED coordinates
const YEXIT = H + 2, YTURN = -PAD - 0.5;
const NR = Math.round((YB - YT) / GH), NC = Math.round(W / GH); // cells: nodes are NR+1 by NC+1
const NN = (NR + 1) * (NC + 1), NCN = NC + 1;
const NRE = NR + 3, NCE = NC + 3; // extended rows and columns for the central differences

// ---- wave pool ------------------------------------------------------------------------------
const NP = 160;
const KMIN = 0.3, KMAX = 2.0;
const DKX = TAU / W;
const SIGK = 0.3; // width of the spectrum in ln k

// ---- the particles --------------------------------------------------------------------------
const RHO0 = 3.4; // particles per LED^2 in the beam
const V0 = 12; // LEDs a second at Flow 2
const HMAX = 0.4; // longest step, LEDs
const CAP = Math.round(RHO0 * W * (H + PAD + 4) * 1.5);
const DTRAIN = 1.4; // spacing of particles along a ray when the first frame is laid down

// The landscape fades in over the first TAPER LEDs of the beam's run, above the panel. Switched on all at once, a wave
// leaves each ray with a tilt of a kx / ky that depends on where along the wave it started, and the beam gets a phase
// screen of long straight columns instead of branches.
const TAPER = 14;
const TAPER_G = new Float64Array(NRE);
for (let e = 0; e < NRE; e++) {
  const t = cl((YT + (e - 1) * GH - YT) / TAPER, 0, 1);
  TAPER_G[e] = t * t * (3 - 2 * t);
}

const OPEN = [0, 2, 0, 0.06];
const NF = 10; // frames between two snapshots of the landscape
const NSL = 9; // of which this many compute rows of the next one

const WD = 0.8; // LEDs a second the whole landscape drifts at Flow 2
const OMS = 0.08; // spread of the waves' own frequencies, rad a second
const BREATH = 0.45, MU0 = 0.07; // each wave's amplitude swells and fades by 45 % at its own rate around 0.07 rad a second

function mkpool(n) {
  return {
    n,
    x: new Float32Array(n), y: new Float32Array(n),
    px: new Float32Array(n), py: new Float32Array(n),
    ax: new Float32Array(n), ay: new Float32Array(n),
    alive: new Uint8Array(n), free: new Int32Array(n), nfree: 0,
  };
}
function clearpool(P) {
  P.alive.fill(0);
  for (let i = 0; i < P.n; i++) P.free[i] = P.n - 1 - i;
  P.nfree = P.n;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Strength knob (-1..1) to the rms of V, and Scale knob to the correlation length in LEDs.
const strengthOf = (k) => 0.029 * pow(1.8, cl(k, -1, 1));
const xiOf = (k) => 14 * pow(1.5, cl(k, -1, 1));

export function setup(params, knobs) {
  const k = knobs || OPEN;
  const S = {
    tau: 0, f: 0, ft: 1 / 30, pace: cl(k[1], 1, 4) / 2,
    ks: TAU / xiOf(k[2]), ss: strengthOf(k[3]), // smoothed spectrum centre and strength
    ph: new Float64Array(NP), om: new Float64Array(NP), mu: new Float64Array(NP), ze: new Float64Array(NP),
    pk: new Float64Array(NP), pkx: new Float64Array(NP), pky: new Float64Array(NP),
    cx: new Float32Array(NP * NCE), sx: new Float32Array(NP * NCE),
    cy: new Float32Array(NP * NRE), sy: new Float32Array(NP * NRE),
    vext: new Float32Array(NRE * NCE),
    V0: new Float32Array(NN), V1: new Float32Array(NN), VN: new Float32Array(NN),
    X0: new Float32Array(NN), X1: new Float32Array(NN), XN: new Float32Array(NN),
    Y0: new Float32Array(NN), Y1: new Float32Array(NN), YN: new Float32Array(NN),
    GX: new Float32Array(NN), GY: new Float32Array(NN),
    act: new Int32Array(NP), nact: 0, amp: new Float64Array(NP), tcos: new Float64Array(NP), tsin: new Float64Array(NP),
    wx: 0, wy: 0, tilt: 0, w: 0,
    P: mkpool(CAP),
    buf: new Float32Array(W * H * 3), tmp: new Float32Array(W * H * 3),
    ramp: new Float32Array(256 * 3), hue: -1,
    births: 0, nin: 0, nout: 0, mh: 0,
  };
  clearpool(S.P);
  // The pool: wavenumbers log-uniform between KMIN and KMAX, directions uniform in a half plane, kx on the box's lattice.
  for (let j = 0; j < NP; j++) {
    const kk = KMIN * exp(Math.random() * log(KMAX / KMIN));
    let m = Math.round((kk * cos(Math.random() * PI)) / DKX);
    while (abs(m) * DKX > kk) m -= m > 0 ? 1 : -1; // rounding must not push kx past k
    const kx = m * DKX, ky = sqrt(max(0, kk * kk - kx * kx));
    S.pk[j] = sqrt(kx * kx + ky * ky);
    S.pkx[j] = kx;
    S.pky[j] = ky;
    S.ph[j] = Math.random() * TAU;
    S.om[j] = (Math.random() * 2 - 1) * OMS;
    S.mu[j] = MU0 * (0.4 + 1.6 * Math.random());
    S.ze[j] = Math.random() * TAU;
    for (let c = 0; c < NCE; c++) {
      S.cx[j * NCE + c] = cos(kx * (c - 1) * GH);
      S.sx[j * NCE + c] = sin(kx * (c - 1) * GH);
    }
    for (let r = 0; r < NRE; r++) {
      S.cy[j * NRE + r] = cos(ky * (YT + (r - 1) * GH));
      S.sy[j * NRE + r] = sin(ky * (YT + (r - 1) * GH));
    }
  }
  drive(S);
  selectWaves(S, 0);
  targetPhases(S, 0);
  vrows(S, 0, NRE);
  gradient(S, S.V0, S.X0, S.Y0);
  S.V1.set(S.V0);
  S.X1.set(S.X0);
  S.Y1.set(S.Y0);
  params.s = S;
  blend(S, 0);
  preroll(S);
  buildRamp(S, k[0]);
  return S;
}

// Where the landscape drifts and where the beam points at model time tau.
function drive(S) {
  const t = S.tau, psi = 0.6 + 1.9 * sin(0.021 * t + 0.4) + 1.3 * sin(0.0077 * t + 1.1);
  const sp = WD * (0.75 + 0.25 * sin(0.0153 * t + 2.0) + 0.1 * sin(0.0271 * t));
  S.wx = sp * cos(psi);
  S.wy = sp * sin(psi);
  S.tilt = 0.025 * sin(0.19 * t + 1.3) + 0.02 * sin(0.113 * t + 4.1) + 0.02 * sin(0.067 * t + 2.2) + 0.015 * sin(0.29 * t + 0.7);
}

// Pick the waves that carry weight at the current centre of the spectrum and give each its amplitude, so the field has
// the variance ss^2.
function selectWaves(S, tt) {
  let n = 0, e = 0;
  for (let j = 0; j < NP; j++) {
    const z = log(S.pk[j] / S.ks) / SIGK, w = exp(-0.5 * z * z) * (1 + BREATH * sin(S.mu[j] * tt + S.ze[j]));
    if (w < 0.08) continue;
    S.act[n] = j;
    S.amp[n] = w;
    e += w * w;
    n++;
  }
  const g = (S.ss * sqrt(2)) / sqrt(e);
  for (let m = 0; m < n; m++) S.amp[m] *= g;
  S.nact = n;
}

// The phases the active waves will have after `frames` more frames at the present pace.
function targetPhases(S, frames) {
  const dtau = frames * S.ft * S.pace;
  for (let m = 0; m < S.nact; m++) {
    const j = S.act[m], p = S.ph[j] + (S.om[j] - S.wx * S.pkx[j] - S.wy * S.pky[j]) * dtau;
    S.tcos[m] = cos(p);
    S.tsin[m] = sin(p);
  }
}

function vrows(S, e0, e1) {
  const { vext, act, amp, tcos, tsin, cx, sx, cy, sy } = S, nact = S.nact;
  for (let e = e0; e < e1; e++) {
    const o = e * NCE;
    for (let c = 0; c < NCE; c++) vext[o + c] = 0;
    const g = TAPER_G[e];
    for (let m = 0; m < nact; m++) {
      const j = act[m], a = amp[m], cyy = cy[j * NRE + e], syy = sy[j * NRE + e];
      const A = g * a * (cyy * tcos[m] - syy * tsin[m]), B = g * a * (syy * tcos[m] + cyy * tsin[m]);
      const q = j * NCE;
      for (let c = 0; c < NCE; c++) vext[o + c] += A * cx[q + c] - B * sx[q + c];
    }
  }
}

function gradient(S, V, X, Y) {
  const { vext } = S;
  for (let r = 0; r <= NR; r++)
    for (let c = 0; c <= NC; c++) {
      const e = (r + 1) * NCE + c + 1, o = r * NCN + c;
      V[o] = vext[e];
      X[o] = (vext[e + 1] - vext[e - 1]) * (0.5 * GI);
      Y[o] = (vext[e + NCE] - vext[e - NCE]) * (0.5 * GI);
    }
}

// Blend the two snapshots at weight w into the field the particles read.
function blend(S, w) {
  const { X0, X1, Y0, Y1, GX, GY } = S, a = 1 - w;
  S.w = w;
  for (let i = 0; i < NN; i++) {
    GX[i] = a * X0[i] + w * X1[i];
    GY[i] = a * Y0[i] + w * Y1[i];
  }
}

function vAt(S, x, y) {
  const u = x * GI, v = (y - YT) * GI, ix = u | 0, iy = v | 0, fx = u - ix, fy = v - iy, o = iy * NCN + ix;
  const f = (A) => A[o] * (1 - fx) * (1 - fy) + A[o + 1] * fx * (1 - fy) + A[o + NCN] * (1 - fx) * fy + A[o + NCN + 1] * fx * fy;
  return (1 - S.w) * f(S.V0) + S.w * f(S.V1);
}

// Leapfrog on H = |p| - n(x), n = 1 + V: unit speed, p kicked by grad V.
function move(P, i0, i1, h, GX, GY) {
  const { x, y, px, py, ax, ay, alive } = P, hh = 0.5 * h;
  for (let i = i0; i < i1; i++) {
    if (!alive[i]) continue;
    const qx = px[i] + hh * ax[i], qy = py[i] + hh * ay[i];
    const inv = h / sqrt(qx * qx + qy * qy);
    let X = x[i] + qx * inv;
    const Y = y[i] + qy * inv;
    if (X >= W) X -= W;
    else if (X < 0) X += W;
    if (Y >= YEXIT || Y < YTURN) {
      alive[i] = 0;
      P.free[P.nfree++] = i;
      continue;
    }
    const u = X * GI, v = (Y - YT) * GI, ix = u | 0, iy = v | 0, fx = u - ix, fy = v - iy, o = iy * NCN + ix;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const gx = GX[o] * w00 + GX[o + 1] * w10 + GX[o + NCN] * w01 + GX[o + NCN + 1] * w11;
    const gy = GY[o] * w00 + GY[o + 1] * w10 + GY[o + NCN] * w01 + GY[o + NCN + 1] * w11;
    x[i] = X;
    y[i] = Y;
    ax[i] = gx;
    ay[i] = gy;
    px[i] = qx + hh * gx;
    py[i] = qy + hh * gy;
  }
}

function spawn(S, P, X, Y, tilt) {
  if (!P.nfree) return -1;
  const j = P.free[--P.nfree], n = 1 + vAt(S, X, Y);
  P.alive[j] = 1;
  P.x[j] = X;
  P.y[j] = Y;
  P.px[j] = n * sin(tilt);
  P.py[j] = n * cos(tilt);
  P.ax[j] = 0;
  P.ay[j] = 0;
  return j;
}

// The first frame: rays from the top edge through the landscape as it stands, each carrying a train of particles
// DTRAIN apart, so the beam is already branched down the whole panel.
function preroll(S) {
  const NRAY = Math.round(RHO0 * W * DTRAIN), R = mkpool(NRAY), P = S.P, h = HMAX;
  clearpool(R);
  const nxt = new Float64Array(NRAY);
  for (let j = 0; j < NRAY; j++) {
    spawn(S, R, ((j + Math.random()) * W) / NRAY, -PAD, S.tilt);
    nxt[j] = Math.random() * DTRAIN;
  }
  let l = 0;
  for (let step = 0; step < 2000 && R.nfree < NRAY; step++) {
    move(R, 0, NRAY, h, S.GX, S.GY);
    l += h;
    for (let j = 0; j < NRAY; j++) {
      if (!R.alive[j]) continue;
      while (l >= nxt[j]) {
        nxt[j] += DTRAIN;
        if (!P.nfree) break;
        const i = P.free[--P.nfree];
        P.alive[i] = 1;
        P.x[i] = R.x[j];
        P.y[i] = R.y[j];
        P.px[i] = R.px[j];
        P.py[i] = R.py[j];
        P.ax[i] = R.ax[j];
        P.ay[i] = R.ay[j];
      }
    }
  }
}

const SINMAX = 0.25;
function buildRamp(S, hue) {
  S.hue = hue;
  for (let i = 0; i < 256; i++) {
    const u = i / 127.5 - 1, a = pow(abs(u), 0.8);
    const h = 0.7 + (u < 0 ? -0.18 : 0.18) * a + hue, sat = 0.2 + 0.8 * a;
    hsv(h, sat, 1, S.ramp, i * 3);
    const y = 0.299 * S.ramp[i * 3] + 0.587 * S.ramp[i * 3 + 1] + 0.114 * S.ramp[i * 3 + 2], g = 0.8 / y;
    for (let c = 0; c < 3; c++) S.ramp[i * 3 + c] *= g;
  }
}

export function update(dt, input, params) {
  const k = (input && input.knobValues) || OPEN;
  if (!params.s) setup(params, k);
  advance(params.s, cl(dt || 0, 0, 0.1), k);
}

function advance(S, ft, k) {
  const pace = cl(k[1], 1, 4) / 2, dtau = ft * pace;
  S.ft = ft;
  S.pace = pace;
  const aa = 1 - exp(-ft / 0.5);
  S.ks += (TAU / xiOf(k[2]) - S.ks) * aa;
  S.ss += (strengthOf(k[3]) - S.ss) * aa;
  S.tau += dtau;
  drive(S);
  for (let j = 0; j < NP; j++) S.ph[j] += (S.om[j] - S.wx * S.pkx[j] - S.wy * S.pky[j]) * dtau;
  // the next snapshot is computed a slice a frame
  const f = S.f;
  if (f === 0) {
    selectWaves(S, S.tau + 2 * NF * ft * pace);
    targetPhases(S, 2 * NF);
  }
  if (f < NSL) {
    const n = ceil(NRE / NSL);
    vrows(S, f * n, min(NRE, (f + 1) * n));
  } else if (f === NSL) gradient(S, S.VN, S.XN, S.YN);
  blend(S, (f + 1) / NF);
  if (f === NF - 1) {
    let t = S.V0; S.V0 = S.V1; S.V1 = S.VN; S.VN = t;
    t = S.X0; S.X0 = S.X1; S.X1 = S.XN; S.XN = t;
    t = S.Y0; S.Y0 = S.Y1; S.Y1 = S.YN; S.YN = t;
    S.f = 0;
  } else S.f = f + 1;
  if (S.hue !== k[0]) buildRamp(S, k[0]);
  // particles
  const dl = V0 * dtau, ns = ceil(dl / HMAX), h = dl / ns, P = S.P;
  for (let s = 0; s < ns; s++) {
    S.births += RHO0 * W * h * cos(S.tilt);
    while (S.births >= 1) {
      S.births -= 1;
      if (spawn(S, P, Math.random() * W, -PAD + Math.random() * h, S.tilt) >= 0) S.nin++;
    }
    const before = P.nfree;
    move(P, 0, CAP, h, S.GX, S.GY);
    S.nout += P.nfree - before;
  }
  deposit(S, exp(-dl / 2.5));
}

function deposit(S, decay) {
  const { buf, ramp } = S, { x, y, px, py, alive } = S.P, q0 = (1 - decay) * 1;
  for (let i = 0; i < buf.length; i++) buf[i] *= decay;
  const C1 = 1 / SINMAX, ct = cos(S.tilt), st = sin(S.tilt), mh0 = S.mh;
  let hs = 0, nh = 0;
  for (let i = 0; i < CAP; i++) {
    if (!alive[i]) continue;
    const X = x[i] - 0.5, Y = y[i] - 0.5;
    if (Y < -1 || Y >= H) continue;
    let ix = floor(X), iy = floor(Y);
    const fx = X - ix, fy = Y - iy;
    if (ix < 0) ix += W;
    const ix1 = ix + 1 === W ? 0 : ix + 1;
    const dxv = (px[i] * ct - py[i] * st) / sqrt(px[i] * px[i] + py[i] * py[i]);
    hs += dxv;
    nh++;
    let ri = (((dxv - mh0) * C1 + 1) * 127.5) | 0;
    ri = ri < 0 ? 0 : ri > 255 ? 255 : ri;
    const R = ramp[ri * 3] * q0, G = ramp[ri * 3 + 1] * q0, B = ramp[ri * 3 + 2] * q0;
    for (let dy = 0; dy < 2; dy++) {
      const yy = iy + dy;
      if (yy < 0 || yy >= H) continue;
      const wy = dy ? fy : 1 - fy;
      const a = (1 - fx) * wy, b = fx * wy, o0 = (yy * W + ix) * 3, o1 = (yy * W + ix1) * 3;
      buf[o0] += R * a; buf[o0 + 1] += G * a; buf[o0 + 2] += B * a;
      buf[o1] += R * b; buf[o1 + 1] += G * b; buf[o1 + 2] += B * b;
    }
  }
  if (nh) S.mh += (hs / nh - S.mh) * (1 - exp(-S.ft / 1.5));
}

const GAIN = 0.6, THR = 0.3, BX = 0.18, BY = 0.25;
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, tmp } = S;
  // a light blur, wider along y than along x because the veins mostly run down the panel: [bx 1-2bx bx] along x
  // (the panel wraps), [by 1-2by by] along y
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xl = x === 0 ? W - 1 : x - 1, xr = x === W - 1 ? 0 : x + 1;
      for (let c = 0; c < 3; c++) tmp[(y * W + x) * 3 + c] = BX * buf[(y * W + xl) * 3 + c] + (1 - 2 * BX) * buf[(y * W + x) * 3 + c] + BX * buf[(y * W + xr) * 3 + c];
    }
  for (let y = 0; y < H; y++) {
    const yu = y === 0 ? 0 : y - 1, yd = y === H - 1 ? H - 1 : y + 1;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, ou = (yu * W + x) * 3, od = (yd * W + x) * 3, v = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const r = (BY * tmp[ou + c] + (1 - 2 * BY) * tmp[o + c] + BY * tmp[od + c]) / RHO0;
        const q = 1 - exp(-GAIN * max(0, r - THR));
        v[c] = 235 * q + 20 * min(1, q * 25);
      }
      display.setPixel(x, y, v[0], v[1], v[2]);
    }
  }
}
