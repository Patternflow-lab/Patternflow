// ===== Patternflow pattern =====
// Title:   Pearl Chains
// Family:  dielectrophoresis
// Idea:    Microbeads of three sizes and colours are carried down a flow channel past two rows of slanted electrode bars, and an AC frequency that wanders through their crossover frequencies pulls one kind onto the bar edges in pearl chains while it pushes another kind off, so the kinds sort as they pass and a chain bursts away in a shower whenever its sign flips.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: dielectrophoresis, named and first measured by Herbert Pohl (1951; his book of 1978), where the sign of the force on a particle follows the Clausius-Mossotti factor and flips at a crossover frequency that differs from one particle type to the next and where particles also line up in pearl chains along the field lines of an AC field, and the slanted-electrode cell sorters of microfluidics (from memory, 1990s), pattern round 238
// Round:   238
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Frequency=0..4, Voltage=0..1, Flow=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel. At 0 the ground is slate teal, the bars are steel blue with pale edges, and the beads are coral, aqua and lime; turned away from 0 the bars and beads take the whole wheel while the ground only sways about teal and blue, so it never goes brown.
// Knob 2: Frequency. 0 to 4, opening at 2. The mean AC frequency. The aqua beads cross over at 1.3, the lime at 2.0 and the coral at 2.7, and the frequency wanders by about a fifth of the range round the knob with a memory of 30 s, so at 2 the coral hang on the bars in chains and the aqua are pushed off while the lime flips between the two. At 0 every bead clings to the bars, at 4 every bead is thrown off them.
// Knob 3: Voltage. 0 to 1, opening at 0. The field strength. At 0 the field is already two fifths of the full pull, enough to chain the coral and bend the aqua's path; at 1 the chains grow long and hold on, the push on the repelled beads is two and a half times as hard, and the glow round each bar, which is the field, brightens. The field also breathes between about half and full strength on a 40 s memory, so bars clog and clear at every setting.
// Knob 4: Flow. -1 to 1, opening at the middle. How fast the liquid carries the beads, from 1.3 LEDs a second at -1 to 16 at 1, fastest in the middle of the channel and slower at the walls. A fast flow drags the repelled beads over the bars; a slow one lets the field win and the beads linger.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, exp, sqrt, sin, cos, tanh, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
// One step of an Ornstein-Uhlenbeck wander: relaxes to 0 with time constant tau, stationary spread sd.
const ouStep = (v, d, tau, sd) => {
  const a = exp(-d / tau);
  return v * a + sd * sqrt(1 - a * a) * gauss();
};

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.5 * b), min(1, v * (1 + 1.1 * b * (1 - v))), out, o);
}

// ---- the beads ------------------------------------------------------------
// Species 0 is the big coral bead, 1 the small aqua one, 2 the medium lime one. Each has its
// own crossover frequency fc: below it the bead is pulled to the field (positive DEP), above it
// the bead is pushed away (negative DEP).
const SP_R = [2.4, 1.5, 1.95];
const SP_FC = [2.7, 1.3, 2.0];
const SP_HUE = [0.03, 0.47, 0.21];
const SP_SHARE = [0.14, 0.46, 0.40];
const NTARGET = 360;        // beads kept in the channel
const MAXB = 520, PMAX = 9000;

// ---- the physics, in LEDs and seconds -------------------------------------
const LAM = 3.6;            // the gradient of E^2, which is the force, falls off this far from a bar edge
const LAMC = 9;             // the field that lines dipoles up into chains reaches farther
const HW = 2;               // half the width of a bar
const A_DEP = 6;            // speed the field gives a bead at an edge at full strength, LEDs a second
const KAPPA = 1.3;          // how hard a pulled bead is held against the flow
const CCH = 2.2;            // strength of the dipole-dipole chain force
const DB = 0.6;             // Brownian diffusion, LEDs squared a second
const WID = 0.28;           // width of the crossover, in frequency units
const U0 = 4.6;             // flow speed at the middle of the channel at Flow = 0
const SUB = 1 / 45;         // one physics step
const CELL = 11, GX = 6, GY = 14, CUT = 2.2;
const SRC = 2.4, SRK = 1.4;   // soft repulsion: reach in contact distances, and speed at contact
const NBAR = 6;
const LEN = [40, 44, 38, 42, 46, 40];

// ---- state ----------------------------------------------------------------
export function setup(params) {
  const ph = [];
  for (let i = 0; i < 48; i++) ph.push(Math.random() * TAU);
  const nb = () => new Float64Array(NBAR);
  params.st = {
    t: -30, init: false, acc: 0, k: [0, 2, 0, 0.06], n: 0, ph,
    x: new Float32Array(MAXB), y: new Float32Array(MAXB), vx: new Float32Array(MAXB), vy: new Float32Array(MAXB),
    sp: new Uint8Array(MAXB), rad: new Float32Array(MAXB), fj: new Float32Array(MAXB), ts: new Float32Array(MAXB),
    tl: new Float32Array(MAXB), fr: new Float32Array(MAXB), tone: new Float32Array(MAXB),
    ec: new Float32Array(MAXB), nc: new Uint8Array(MAXB), mf: new Float32Array(MAXB), mb: new Float32Array(MAXB), hb: new Float32Array(MAXB), fy: new Float32Array(MAXB),
    e2: new Float32Array(MAXB), nx: new Float32Array(MAXB), ny: new Float32Array(MAXB), sv: new Float32Array(MAXB),
    cs: new Int32Array(GX * GY + 2), cp: new Int32Array(GX * GY + 2), ci: new Int32Array(MAXB), cc: new Int32Array(MAXB),
    pi: new Int32Array(PMAX), pj: new Int32Array(PMAX), np: 0,
    fo: 0.45 * gauss(), z: gauss(), mw: [0.3 * gauss(), 0.3 * gauss(), 0.3 * gauss()],
    I: [0, 0, 0], sa: [0, 0, 0], cnt: [0, 0, 0],
    FD: 0.5, f: 2, U: U0, pf: 0.3,
    bar: { ax: nb(), ay: nb(), ux: nb(), uy: nb(), len: nb() },
    hue: -9, col: new Float32Array(32),
    R: new Float32Array(NPX), G: new Float32Array(NPX), B: new Float32Array(NPX),
    wcx: new Float32Array(3 * W), wsx: new Float32Array(3 * W), wcy: new Float32Array(3 * H), wsy: new Float32Array(3 * H),
  };
}

// The bar bank: two rows of three bars. The top row slants one way and the bottom row the other, so
// the channel reads as a herringbone. Each row slides sideways and rocks in angle on its own slow
// timescale, and every bar wanders a little by itself.
function setBars(st, t) {
  const p = st.ph, b = st.bar;
  for (let row = 0; row < 2; row++) {
    const o = row * 6;
    const al = ((34 + 5 * sin((TAU * t) / (53 + 9 * row) + p[o]) + 2.5 * sin((TAU * t) / (29.3 - 4 * row) + p[o + 1])) * PI) / 180;
    const sl = 2.5 * sin((TAU * t) / (61 + 7 * row) + p[o + 2]) + 1.2 * sin((TAU * t) / (37.7 + 5 * row) + p[o + 3]);
    const sy = 4 * sin((TAU * t) / (71 + 11 * row) + p[o + 4]) + 2 * sin((TAU * t) / (43.1 - 6 * row) + p[o + 5]);
    for (let kk = 0; kk < 3; kk++) {
      const k = row * 3 + kk;
      const wx = 1.8 * sin((TAU * t) / (41 + 6 * k) + p[12 + k]), wy = 2 * sin((TAU * t) / (53 + 5 * k) + p[18 + k]);
      const cx = (row === 0 ? 1 + 21 * kk : 63 - 21 * kk) + sl + wx;
      const cy = (row === 0 ? 35 : 91) + sy + wy;
      const dx = row === 0 ? sin(al) : -sin(al), dy = cos(al), h = LEN[k] / 2;
      b.ax[k] = cx - dx * h;
      b.ay[k] = cy - dy * h;
      b.ux[k] = dx;
      b.uy[k] = dy;
      b.len[k] = LEN[k];
    }
  }
}

// ---- beads in and out -----------------------------------------------------
function addBead(st, s, x, y) {
  const i = st.n++;
  st.x[i] = x;
  st.y[i] = y;
  st.sp[i] = s;
  st.rad[i] = SP_R[s] * (0.93 + 0.14 * Math.random());
  st.fj[i] = 0.08 * gauss();
  st.ts[i] = 0;
  st.tl[i] = 8 + 30 * Math.random();
  st.fr[i] = 0;
  st.tone[i] = 0.92 + 0.16 * Math.random();
  st.mf[i] = 1;
  st.vx[i] = 0;
  st.vy[i] = 0;
}
function removeBead(st, i) {
  const l = --st.n;
  if (i === l) return;
  for (const a of [st.x, st.y, st.vx, st.vy, st.sp, st.rad, st.fj, st.ts, st.tl, st.fr, st.tone, st.e2, st.nx, st.ny, st.sv, st.mf, st.ec, st.nc]) a[i] = a[l];
}
function clearAt(st, x, y, r, ymax) {
  const n = st.n, X = st.x, Y = st.y, R = st.rad;
  for (let j = 0; j < n; j++) {
    if (Y[j] > ymax) continue;
    const dx = X[j] - x, dy = Y[j] - y, rr = R[j] + r;
    if (dx * dx + dy * dy < rr * rr) return false;
  }
  return true;
}
// The flow profile across the channel: a parabola with a little slip at the walls.
const profile = (x) => {
  const w = (x - 32) / 32;
  return 0.25 + 0.75 * (1 - min(1, w * w));
};
function spawn(st, s) {
  if (st.n >= MAXB - 4) return false;
  const r = SP_R[s] * 1.07;
  for (let tr = 0; tr < 6; tr++) {
    const x = r + Math.random() * (W - 2 * r);
    if (Math.random() * 1.0 > profile(x)) continue;
    const y = -r - 0.4;
    if (!clearAt(st, x, y, r, 14)) continue;
    addBead(st, s, x, y);
    return true;
  }
  return false;
}
function seed(st) {
  let tries = 0;
  const want = NTARGET * 0.8;
  while (st.n < want && tries < 6000) {
    tries++;
    const q = Math.random(), s = q < SP_SHARE[0] ? 0 : q < SP_SHARE[0] + SP_SHARE[1] ? 1 : 2, r = SP_R[s] * 1.07;
    const x = r + Math.random() * (W - 2 * r), y = Math.random() * H;
    if (clearAt(st, x, y, r, 1e9)) addBead(st, s, x, y);
  }
}

// ---- one physics step -----------------------------------------------------
function simStep(st, d) {
  const t = (st.t += d), k = st.k, p = st.ph;
  st.fo = ouStep(st.fo, d, 30, 0.45);
  st.z = ouStep(st.z, d, 40, 1);
  for (let s = 0; s < 3; s++) st.mw[s] = ouStep(st.mw[s], d, 70, 0.3);
  const f = k[1] + st.fo;
  st.f = f;
  const Fv = 1 + 1.5 * k[2];
  const D = 0.45 + 0.55 * sstep(-1.3, 1.3, st.z);
  const FD = Fv * D;
  st.FD = FD;
  const lc = min(0.9, 0.4 + 0.3 * FD);
  const U = U0 * pow(3.5, k[3]) * (1 + 0.2 * sin((TAU * t) / 37 + p[30]) + 0.12 * sin((TAU * t) / 23.3 + p[31]));
  st.U = U;
  setBars(st, t);
  const cf0 = 1.6 * (0.6 + 0.4 * sin((TAU * t) / 71 + p[33])), cp0 = -0.3 * t + p[34];
  const cf1 = 1.1 * (0.6 + 0.4 * sin((TAU * t) / 53 + p[35])), cp1 = 0.23 * t + p[36];
  const cf2 = 0.8 * (0.6 + 0.4 * sin((TAU * t) / 43 + p[37])), cp2 = -0.4 * t + p[38];
  const { x: X, y: Y, vx: VX, vy: VY, sp, rad: R, fj, ts, tl, fr, e2: E2, nx: NX, ny: NY, sv: SV, mf: MF, mb: MB, hb: HB, fy: FY, ec: EC, nc: NC } = st;
  const { ax, ay, ux, uy, len } = st.bar;
  let n = st.n;

  // The field at every bead: the nearest bar, the push or pull from it, and how firmly it holds.
  for (let i = 0; i < n; i++) {
    let px = X[i], py = Y[i], bd = 1e18, bt = 0, bk = 0, bqx = 0, bqy = 0;
    for (let b = 0; b < NBAR; b++) {
      const rx = px - ax[b], ry = py - ay[b];
      let tt = rx * ux[b] + ry * uy[b];
      tt = tt < 0 ? 0 : tt > len[b] ? len[b] : tt;
      const qx = rx - tt * ux[b], qy = ry - tt * uy[b], d2 = qx * qx + qy * qy;
      if (d2 < bd) {
        bd = d2;
        bk = b;
        bt = tt;
        bqx = qx;
        bqy = qy;
      }
    }
    let dist = sqrt(bd), nx, ny;
    if (dist > 1e-4) {
      nx = bqx / dist;
      ny = bqy / dist;
    } else {
      nx = -uy[bk];
      ny = ux[bk];
      dist = 1e-4;
    }
    // The bars lie flat on the floor, so a bead can be carried over one. E^2 is flat across the bar and falls
    // off outside its edge; a bead that has been carried inside is nudged out to the nearer edge if it is
    // pulled and left alone if it is pushed.
    const out = dist > HW;
    const e2 = out ? exp(-(dist - HW) / LAM) : 1;
    E2[i] = e2;
    EC[i] = out ? exp(-(dist - HW) / LAMC) : 1;
    NX[i] = nx;
    NY[i] = ny;
    const s = tanh((SP_FC[sp[i]] + fj[i] - f) / WID);
    SV[i] = s;
    // The force follows the sign of s along the gradient of E^2, which points at the bar.
    const dep = out ? -s * A_DEP * FD * e2 : s > 0 ? 0.5 * s * A_DEP * FD : 0;
    let m = 1;
    if (fr[i] > 0) fr[i] -= d;
    else if (s > 0) m = cl(1 - KAPPA * s * FD * e2 * (NC[i] > 3 ? 0.3 : 1), 0, 1);
    // A bead that has been held for a long time is let go for a few seconds.
    if (m < 0.3) {
      ts[i] += d;
      if (ts[i] > tl[i]) {
        fr[i] = 3 + 6 * Math.random();
        ts[i] = 0;
        tl[i] = 8 + 30 * Math.random();
      }
    } else if (ts[i] > 0) ts[i] = max(0, ts[i] - 2 * d);
    // A slow cross-flow sways the stream from side to side so that no part of the channel stays empty.
    const wf = min(1, px / 8, (W - px) / 8);
    VX[i] = dep * nx + wf * (cf0 * sin(0.06 * py + cp0) + cf1 * sin(0.115 * py + cp1) + cf2 * sin(0.17 * py + cp2));
    VY[i] = dep * ny;
    FY[i] = profile(px) * U;
    MB[i] = m;
    HB[i] = 0;
    NC[i] = 0;
  }

  // Neighbour grid.
  const { cs, cp, ci, cc, pi: PI_, pj: PJ_ } = st;
  cs.fill(0);
  for (let i = 0; i < n; i++) {
    const c = min(GX - 1, floor(X[i] / CELL)) + GX * min(GY - 1, max(0, floor((Y[i] + 8) / CELL)));
    cc[i] = c;
    cs[c + 1]++;
  }
  for (let c = 0; c < GX * GY; c++) cs[c + 1] += cs[c];
  for (let c = 0; c <= GX * GY; c++) cp[c] = cs[c];
  for (let i = 0; i < n; i++) ci[cp[cc[i]]++] = i;

  // Pairs: the dipole chain force, and a list of the near ones for the hard core.
  let np = 0;
  for (let i = 0; i < n; i++) {
    const c0 = cc[i], cx = c0 % GX, cy = (c0 / GX) | 0;
    const xi = X[i], yi = Y[i], ri = R[i], si = SV[i], ei = EC[i];
    for (let gy = max(0, cy - 1); gy <= min(GY - 1, cy + 1); gy++) {
      for (let gx = max(0, cx - 1); gx <= min(GX - 1, cx + 1); gx++) {
        const c = gx + gy * GX, q1 = cs[c + 1];
        for (let q = cs[c]; q < q1; q++) {
          const j = ci[q];
          if (j <= i) continue;
          const dx = xi - X[j], dy = yi - Y[j], d2 = dx * dx + dy * dy, rs = ri + R[j];
          if (d2 > CUT * CUT * rs * rs) continue;
          const dd = sqrt(d2) + 1e-6;
          if (dd < 1.3 * rs && np < PMAX) {
            PI_[np] = i;
            PJ_[np++] = j;
            if (dd < 1.15 * rs) {
              NC[i]++;
              NC[j]++;
            }
          }
          const ss = si * SV[j];
          let qx = dx / rs, qy = dy / rs, rho = dd / rs;
          // Soft repulsion at a distance: a crowd spreads out instead of heaping.
          if (rho < SRC) {
            const w = 1 - rho / SRC, e = 0.5 * (ei + EC[j]), sr = SRK * w * w * (1 - cl(ss * FD * e * 2, 0, 0.9)) / dd;
            VX[i] += dx * sr;
            VY[i] += dy * sr;
            VX[j] -= dx * sr;
            VY[j] -= dy * sr;
          }
          if (ss > -0.01 && ss < 0.01) continue;
          if (rho < 1) {
            qx /= rho;
            qy /= rho;
            rho = 1;
          }
          // The field direction is the normal of whichever bar is nearer.
          let ex, ey;
          if (ei >= EC[j]) {
            ex = NX[i];
            ey = NY[i];
          } else {
            ex = NX[j];
            ey = NY[j];
          }
          const qe = qx * ex + qy * ey, r2 = rho * rho, i5 = 1 / (r2 * r2 * rho), i7 = i5 / r2;
          // Beads that touch along the field direction form a chain, and a chain hangs on whatever holds its end bead.
          if (ss > 0.02 && rho < 1.2 && qe * qe > 0.8 * r2 && NC[i] < 4 && NC[j] < 4) {
            const hi = lc * (1 - MF[j]), hj = lc * (1 - MF[i]);
            if (hi > HB[i]) HB[i] = hi;
            if (hj > HB[j]) HB[j] = hj;
          }
          const tp = 1 - r2 / (CUT * CUT), cw = CCH * FD * 0.5 * (ei + EC[j]) * ss * tp * tp;
          const fx = cw * (6 * qe * ex * i5 - 15 * qe * qe * qx * i7 + 3 * qx * i5);
          const fy = cw * (6 * qe * ey * i5 - 15 * qe * qe * qy * i7 + 3 * qy * i5);
          VX[i] += fx;
          VY[i] += fy;
          VX[j] -= fx;
          VY[j] -= fy;
        }
      }
    }
  }
  st.np = np;

  // Move: drift plus Brownian shake, then the hard core and the walls.
  const sg = sqrt(2 * DB * d);
  for (let i = 0; i < n; i++) {
    const mfin = MB[i] * (1 - HB[i]);
    MF[i] = mfin;
    let vx = VX[i], vy = VY[i] + FY[i] * mfin;
    const v2 = vx * vx + vy * vy;
    if (v2 > 900) {
      const g = 30 / sqrt(v2);
      vx *= g;
      vy *= g;
    }
    X[i] += vx * d + sg * gauss();
    Y[i] += vy * d + sg * gauss();
  }
  for (let it = 0; it < 3; it++) {
    for (let q = 0; q < np; q++) {
      const i = PI_[q], j = PJ_[q];
      const dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy, rs = 0.97 * (R[i] + R[j]);
      if (d2 >= rs * rs) continue;
      const dd = sqrt(d2) + 1e-6, push = (0.5 * (rs - dd)) / dd;
      X[i] += dx * push;
      Y[i] += dy * push;
      X[j] -= dx * push;
      Y[j] -= dy * push;
    }
    for (let i = 0; i < n; i++) X[i] = cl(X[i], R[i], W - R[i]);
  }

  // Beads that have left at the bottom go; the inflow is a feedback on the count of each kind.
  const cnt = st.cnt;
  cnt[0] = cnt[1] = cnt[2] = 0;
  let npd = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (Y[i] > H + R[i] + 1 || !(Y[i] === Y[i]) || !(X[i] === X[i])) {
      removeBead(st, i);
      n--;
    } else {
      cnt[sp[i]]++;
      if (SV[i] > 0.3) npd++;
    }
  }
  // Beads that are pulled onto the bars heap up there, so the channel is kept fuller when they are few.
  st.pf += (npd / max(1, n) - st.pf) * (1 - exp(-d / 8));
  const nt = NTARGET * (1 - 0.4 * st.pf);
  const ttr = H / (0.45 * U);
  let wsum = 0;
  const w0 = SP_SHARE[0] * exp(st.mw[0]), w1 = SP_SHARE[1] * exp(st.mw[1]), w2 = SP_SHARE[2] * exp(st.mw[2]);
  wsum = w0 + w1 + w2;
  for (let s = 0; s < 3; s++) {
    const T = (nt * (s === 0 ? w0 : s === 1 ? w1 : w2)) / wsum, err = T - cnt[s];
    st.I[s] = cl(st.I[s] + 0.001 * err * d, -3, 6);
    const r = cl(T / ttr + 0.1 * err + st.I[s], 0, 0.12 * NTARGET);
    st.sa[s] = min(3, st.sa[s] + r * d);
    while (st.sa[s] >= 1) {
      if (!spawn(st, s)) break;
      st.sa[s] -= 1;
    }
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [cl(kv[0], 0, 1), cl(kv[1], 0, 4), cl(kv[2], 0, 1), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    seed(st);
    // Run the 30 s before the first frame, so chains are already on the bars.
    while (st.t < 0) simStep(st, 1 / 22.5);
  }
  st.acc += cl(dt || 0, 0, 0.1);
  while (st.acc >= SUB) {
    simStep(st, SUB);
    st.acc -= SUB;
  }
}

// ---- drawing --------------------------------------------------------------
// Colours as 0 to 255 floats: ground, glow, bar body, bar edge, then interior and rim for each bead kind.
function colours(st, hue) {
  const c = st.col, gs = 0.13 * sin(TAU * hue);
  hsv(0.5 + gs, 0.66, 1, c, 0);
  hsv(0.54 + gs, 0.55, 1, c, 3);
  dim(0.58 + hue, 0.55, 0.46, c, 6);
  hsv(0.56 + hue, 0.16, 1, c, 9);
  for (let s = 0; s < 3; s++) {
    dim(SP_HUE[s] + hue, 0.7, 0.72, c, 12 + 6 * s);
    hsv(SP_HUE[s] + hue, 0.3, 1, c, 15 + 6 * s);
  }
}

const WK = [
  [0.09, 0.05, 0.31, 1],
  [-0.06, 0.11, -0.23, 2],
  [0.15, -0.08, 0.47, 3],
];
function paintField(st, t) {
  const { R, G, B, col: c, wcx, wsx, wcy, wsy } = st;
  const { ax, ay, ux, uy, len } = st.bar;
  for (let j = 0; j < 3; j++) {
    const kx = WK[j][0], ky = WK[j][1], ph = WK[j][2] * t + st.ph[40 + j];
    for (let x = 0; x < W; x++) {
      wcx[j * W + x] = cos(kx * (x + 0.5) + ph);
      wsx[j * W + x] = sin(kx * (x + 0.5) + ph);
    }
    for (let y = 0; y < H; y++) {
      wcy[j * H + y] = cos(ky * (y + 0.5));
      wsy[j * H + y] = sin(ky * (y + 0.5));
    }
  }
  const amp = min(1.5, st.FD), gk = 0.2 * amp;
  const gr = c[0], gg = c[1], gb = c[2], lr = c[3], lg = c[4], lb = c[5];
  const br = c[6], bg = c[7], bb = c[8], er = c[9], eg = c[10], eb = c[11];
  const edgeK = 0.6 + 0.4 * min(1, amp);
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const o = y * W + x, px = x + 0.5;
      const wv = wcx[x] * wcy[y] - wsx[x] * wsy[y] + 0.7 * (wcx[W + x] * wcy[H + y] - wsx[W + x] * wsy[H + y]) + 0.5 * (wcx[2 * W + x] * wcy[2 * H + y] - wsx[2 * W + x] * wsy[2 * H + y]);
      const gnd = 0.2 + 0.045 * wv;
      let bd = 1e18;
      for (let b = 0; b < NBAR; b++) {
        const rx = px - ax[b], ry = py - ay[b];
        let tt = rx * ux[b] + ry * uy[b];
        tt = tt < 0 ? 0 : tt > len[b] ? len[b] : tt;
        const qx = rx - tt * ux[b], qy = ry - tt * uy[b], d2 = qx * qx + qy * qy;
        if (d2 < bd) bd = d2;
      }
      const de = sqrt(bd) - HW;
      const gl = de < 18 ? gk * (de > 0 ? exp(-de / LAM) : 1) : 0;
      let r = gr * gnd + lr * gl, g = gg * gnd + lg * gl, b = gb * gnd + lb * gl;
      if (de < 0.5) {
        const cov = min(1, 0.5 - de), ew = exp(-(((de + 0.55) / 0.75) ** 2)) * edgeK;
        const cr = br + (er - br) * ew, cg = bg + (eg - bg) * ew, cb = bb + (eb - bb) * ew;
        r += (cr - r) * cov;
        g += (cg - g) * cov;
        b += (cb - b) * cov;
      }
      R[o] = r;
      G[o] = g;
      B[o] = b;
    }
  }
}

function paintBeads(st) {
  const { R: PR, G: PG, B: PB, col: c, x: X, y: Y, rad: Rd, sp, tone, e2: E2, n } = st;
  const eamp = min(1, st.FD);
  for (let i = 0; i < n; i++) {
    const cx = X[i], cy = Y[i], r = Rd[i], s = sp[i], o0 = 12 + 6 * s, tn = tone[i];
    const x0 = max(0, floor(cx - r - 1)), x1 = min(W - 1, ceil(cx + r + 1)), y0 = max(0, floor(cy - r - 1)), y1 = min(H - 1, ceil(cy + r + 1));
    if (x0 > x1 || y0 > y1) continue;
    const ir = 1 / r, hx = cx - 0.38 * r, hy = cy - 0.38 * r, ih = 1 / (0.55 * r * 0.55 * r);
    const rimk = 0.55 + 0.45 * eamp * E2[i];
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5, dy = py - cy;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, dx = px - cx, dist = sqrt(dx * dx + dy * dy);
        const a = cl(r + 0.5 - dist, 0, 1);
        if (a <= 0) continue;
        const u = dist * ir, rw = sstep(0.45, 0.95, u) * rimk, hl = 0.3 * exp(-((px - hx) * (px - hx) + (py - hy) * (py - hy)) * ih);
        const kf = tn * (1 - 0.18 * u * u);
        const cr = c[o0] * kf + (c[o0 + 3] - c[o0] * kf) * rw + 255 * hl;
        const cg = c[o0 + 1] * kf + (c[o0 + 4] - c[o0 + 1] * kf) * rw + 255 * hl;
        const cb = c[o0 + 2] * kf + (c[o0 + 5] - c[o0 + 2] * kf) * rw + 255 * hl;
        const o = y * W + x;
        PR[o] += (cr - PR[o]) * a;
        PG[o] += (cg - PG[o]) * a;
        PB[o] += (cb - PB[o]) * a;
      }
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) {
    st.hue = hue;
    colours(st, hue);
  }
  paintField(st, st.t);
  paintBeads(st);
  const { R, G, B } = st;
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, floor(min(255, R[o])), floor(min(255, G[o])), floor(min(255, B[o])));
}
