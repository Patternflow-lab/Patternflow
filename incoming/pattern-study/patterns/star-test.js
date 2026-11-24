// ===== Patternflow pattern =====
// Title:   Star Test
// Family:  aberration
// Idea:    Three images of one star through one slowly wandering lens, a little inside focus, at focus and a little outside, are each the squared Fourier transform of a pupil with a central shadow and a drifting wavefront error, worked out for red, green and blue light separately, so the same Airy rings swell into comets, crossed lines, triangles and haloed donuts together.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Airy disc and its rings (George Airy, 1835), the Zernike polynomials for wavefront error on a circular pupil (Frits Zernike, 1934), the Strehl ratio (Karl Strehl, 1895, from memory), the through-focus star test of telescope makers with its inside and outside focus images (19th century, from memory), the image as the squared modulus of the pupil's Fourier transform (Fraunhofer diffraction, 1820s, from memory), pattern round 235
// Round:   235
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Aberration=1.4..5.5, Stop=0..0.45, Family=0..1
//
// Knob 1: Hue. Turns the light of the star round the wheel; the hottest core of every image stays white. At 0 it is an azure white, at 0.25 magenta, at 0.5 amber, at 0.75 green, and 1 is 0 again.
// Knob 2: Aberration. The RMS of the wavefront error in waves of green light, on average over its slow breathing, which swings it from a quarter to nearly three times the average. At 1.4 the average is 0.07 of a wave (Strehl ratio 0.84, and now and then a tight Airy disc with thin rings), at the opening 2 it is 0.10 (Strehl 0.69), at 5.5 it is 0.31 (Strehl 0.02) and the core has gone into lobes.
// Knob 3: Stop. How much of the pupil's radius is covered from the rim, which makes the lens slower while its error stays the same in waves: at 0 the Airy first dark ring is 6.1 LED from the core and the rings are 5 LED apart, at 0.2 they are 7.6 and 6.3, at 0.45 they are 11.1 and 9.1. The outer two images are 0.8 of a wave out of focus, so their blur grows from 16 LED in radius at 0 to 29 at 0.45, past the 21 LED edge of their window.
// Knob 4: Family. Which error the lens has most of: at 0 coma, which pulls a comet tail; at 0.25 astigmatism, which splits the core into crossed lines that turn a quarter turn between the inside and the outside image; at 0.5 spherical aberration, a halo and rings that differ inside and outside; at 0.75 trefoil, a triangle; at 1 quadrafoil, a four-lobed flower. In between two errors mix.

const W = 64;
const H = 128;
const { floor, sqrt, sin, cos, exp, abs, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// ---- Geometry. The pupil is sampled on NP x NP cells, DG of them across its
// diameter, with the edges worked out as coverage so the circle is not a
// staircase. The image of one star is then the Fourier sum of that field at
// every LED, done straight as a matrix product, so the scale is free: one
// (wavelength x F-number) is PG LEDs for green, 5, which puts the first dark
// ring of the Airy disc 6.1 LEDs from the core and each ring 5 LEDs wide.
// Red light has a longer wavelength, so its pattern is bigger; blue's is smaller.
const NP = 26, DG = 24, EPS = 0.3;
const STEP0 = 0.8; // waves of defocus between one image and the next
const PG = 5;
const LAM = [1.045, 1, 0.955];
const NT = 3, TH = 43;
const CY = [128 / 6, 64, 128 - 128 / 6];
const Y0 = [0, 42, 85];
const PACE = 1.7;
const WIN_IN = 9, WIN_OUT = 21.3;
const REFRESH = 3; // frames between two images of the same tile; the frames between blend

const pAmp = [], pRho = [], pTh = [], pXs = [], pYs = [];
const colStart = new Int32Array(NP + 1);
for (let i = 0; i < NP; i++) {
  colStart[i] = pAmp.length;
  for (let j = 0; j < NP; j++) {
    const X = (i - (NP - 1) / 2) / DG, Y = (j - (NP - 1) / 2) / DG;
    const rho = 2 * sqrt(X * X + Y * Y);
    const a = cl((DG / 2) * (1 - rho) + 0.5, 0, 1);
    if (a <= 0) continue;
    pAmp.push(a), pRho.push(rho), pTh.push(Math.atan2(Y, X)), pXs.push(X), pYs.push(Y);
  }
}
colStart[NP] = pAmp.length;
const PC = pAmp.length;
// The total amplitude of a full, unobstructed pupil, for the peak of a perfect lens to be 1.
let full = 0;
for (let i = 0; i < NP; i++)
  for (let j = 0; j < NP; j++) {
    const X = (i - (NP - 1) / 2) / DG, Y = (j - (NP - 1) / 2) / DG;
    full += cl((DG / 2) * (1 - 2 * sqrt(X * X + Y * Y)) + 0.5, 0, 1);
  }
const NORM = 1 / (full * full);

// ---- Zernike terms are worked out in refresh(), each scaled to an RMS of 1 wave
// over the pupil that the stop leaves open. The angles are fixed per cell.
const C1 = new Float32Array(PC), S1 = new Float32Array(PC), C2 = new Float32Array(PC), S2 = new Float32Array(PC);
const C3 = new Float32Array(PC), S3 = new Float32Array(PC), C4 = new Float32Array(PC), S4 = new Float32Array(PC);
const NZ = 9;
for (let p = 0; p < PC; p++) {
  const th = pTh[p];
  C1[p] = cos(th), S1[p] = sin(th), C2[p] = cos(2 * th), S2[p] = sin(2 * th);
  C3[p] = cos(3 * th), S3[p] = sin(3 * th), C4[p] = cos(4 * th), S4[p] = sin(4 * th);
}
const RHO = Float32Array.from(pRho);
const Z6 = sqrt(6), Z8 = sqrt(8), Z5 = sqrt(5), Z10 = sqrt(10);

// ---- Twiddles, all fixed. Eu: across, per channel, LED column by pupil column.
// Ev: down, per channel and tile, per pupil cell by tile row.
const EUC = [], EUS = [];
const EVC = [], EVS = [];
for (let ch = 0; ch < 3; ch++) {
  const sc = PG * LAM[ch];
  const c = new Float32Array(W * NP), s = new Float32Array(W * NP);
  for (let x = 0; x < W; x++)
    for (let i = 0; i < NP; i++) {
      const th = (-TAU * (x + 0.5 - W / 2) * ((i - (NP - 1) / 2) / DG)) / sc;
      c[x * NP + i] = cos(th);
      s[x * NP + i] = sin(th);
    }
  EUC.push(c), EUS.push(s);
  for (let k = 0; k < NT; k++) {
    const vc = new Float32Array(PC * TH), vs = new Float32Array(PC * TH);
    for (let p = 0; p < PC; p++)
      for (let r = 0; r < TH; r++) {
        const th = (-TAU * (Y0[k] + r + 0.5 - CY[k]) * pYs[p]) / sc;
        vc[p * TH + r] = cos(th);
        vs[p * TH + r] = sin(th);
      }
    EVC.push(vc), EVS.push(vs);
  }
}

// ---- Windows: each image sits in a round window and fades to black at its
// edge, so three images stack on the panel with dark between them and no frame.
const WIN = new Float32Array(NT * TH * W);
for (let k = 0; k < NT; k++)
  for (let r = 0; r < TH; r++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - W / 2, Y0[k] + r + 0.5 - CY[k]);
      WIN[(k * TH + r) * W + x] = d <= WIN_IN ? 1 : d >= WIN_OUT ? 0 : 0.5 + 0.5 * cos((PI * (d - WIN_IN)) / (WIN_OUT - WIN_IN));
    }

export function setup(params) {
  const S = {
    t: 0, n: 0, first: true,
    kk: [0, 2, 0, 0.06],
    c: new Float32Array(NZ), sh: new Float32Array(14),
    wf: new Float32Array(PC), amp: new Float32Array(PC),
    pr: new Float32Array(PC), pi: new Float32Array(PC),
    gr: new Float32Array(NP * TH), gi: new Float32Array(NP * TH),
    // per tile and channel: the older and the newer image, and when the newer was made
    A: [], B: [], tB: new Float64Array(NT), pkA: new Float32Array(NT), pkB: new Float32Array(NT),
    tint: [1, 0.8, 0.5], tints: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    R: new Float32Array(W * H), G: new Float32Array(W * H), Bl: new Float32Array(W * H),
  };
  for (let k = 0; k < NT; k++) {
    S.A.push([new Float32Array(W * TH), new Float32Array(W * TH), new Float32Array(W * TH)]);
    S.B.push([new Float32Array(W * TH), new Float32Array(W * TH), new Float32Array(W * TH)]);
  }
  params.s = S;
}

// A slow wander of amplitude a, two sines with frequencies from the golden ratio
// and its cousins, so no two wanders in the lens ever line up.
const frac = (v) => v - floor(v);
function wob(t, n, a) {
  const f = 0.0133 + 0.037 * frac(n * 0.6180339 + 0.17), g = 0.024 + 0.046 * frac(n * 0.7548776 + 0.31);
  return a * (0.62 * sin(TAU * f * t + TAU * frac(n * 0.5698403 + 0.2)) + 0.38 * sin(TAU * g * t + TAU * frac(n * 0.4142136 + 0.6)));
}

// ---- The lens. Every error wanders on two or three slow sines whose
// frequencies do not divide each other, so the lens never comes back to a
// state it has had, and the whole error breathes between nearly perfect and
// bad over about a minute. Time is in seconds of the panel's clock, sped up by PACE.
function lens(S, t, out) {
  const K2 = S.kk[1], K4 = S.kk[3];
  const e1 = 0.5 + 0.5 * sin(TAU * 0.0137 * t + 0.7), e2 = 0.5 + 0.5 * sin(TAU * 0.0229 * t + 2.1);
  const total = 0.058 * K2 * (0.55 + 0.9 * (0.6 * e1 + 0.4 * e2));
  // How much of each family: a triangle round its place on the knob, and a floor so every one wanders.
  const cen = [0, 0.25, 0.5, 0.75, 1];
  const w = [];
  for (let f = 0; f < 5; f++) w.push(0.22 + max(0, 1 - abs(K4 - cen[f]) / 0.28));
  // Each family breathes on its own.
  const br = [
    0.7 + 0.3 * sin(TAU * 0.0191 * t + 0.3),
    0.7 + 0.3 * sin(TAU * 0.0153 * t + 1.9),
    0.7 + 0.3 * sin(TAU * 0.0117 * t + 4.1),
    0.7 + 0.3 * sin(TAU * 0.0211 * t + 5.2),
    0.7 + 0.3 * sin(TAU * 0.0171 * t + 2.6),
  ];
  let q = 0;
  for (let f = 0; f < 5; f++) q += w[f] * w[f] * br[f] * br[f];
  const unit = total / sqrt(q);
  const m = (f) => unit * w[f] * br[f];
  // Orientations drift and swing.
  const aTre = 1.7 + TAU * 0.0053 * t + 1.2 * sin(TAU * 0.0197 * t + 1.1);
  const aQua = 0.2 + TAU * 0.0047 * t + 1.3 * sin(TAU * 0.0161 * t + 5.0);
  // Coma swings mostly left and right of the star, and astigmatism mostly along the diagonals,
  // so the images are seldom mirror images about the vertical, which on a tall panel reads as a face.
  const sx = 0.6 * sin(TAU * 0.0173 * t + 0.4) + 0.5 * sin(TAU * 0.0291 * t + 2.4) + 0.25 * sin(TAU * 0.0083 * t + 4.8);
  const sy = 0.5 * sin(TAU * 0.0149 * t + 1.9) + 0.4 * sin(TAU * 0.0257 * t + 0.1);
  const sa = 0.5 * sin(TAU * 0.0139 * t + 3.3) + 0.4 * sin(TAU * 0.0227 * t + 1.7);
  const sb = 0.6 * sin(TAU * 0.0107 * t + 0.6) + 0.5 * sin(TAU * 0.0269 * t + 5.1) + 0.2 * sin(TAU * 0.0061 * t + 2.2);
  out[0] = m(1) * 0.9 * sa, out[1] = m(1) * 1.4 * sb;
  out[2] = m(0) * 1.4 * sx, out[3] = m(0) * 0.8 * sy;
  out[4] = m(3) * cos(3 * aTre), out[5] = m(3) * sin(3 * aTre);
  // Spherical aberration changes sign slowly, passing through none.
  out[6] = m(2) * Math.tanh(2.2 * (0.7 * sin(TAU * 0.0127 * t + 1.3) + 0.5 * sin(TAU * 0.0203 * t + 0.2)));
  out[7] = m(4) * cos(4 * aQua), out[8] = m(4) * sin(4 * aQua);
  // The star drifts across the field, and the line of sight tilts through focus, so the
  // three images are not on one vertical: a shift for the middle image, and a slope per step.
  const sh = S.sh;
  sh[0] = 5.5 * sin(TAU * 0.0113 * t + 0.5) + 2.5 * sin(TAU * 0.0271 * t + 2.2);
  sh[1] = 3.4 * sin(TAU * 0.0089 * t + 4.0) + 1.6 * sin(TAU * 0.0233 * t + 0.8);
  sh[2] = 3.2 * sin(TAU * 0.0151 * t + 1.4) + 1.2 * sin(TAU * 0.0317 * t + 5.5);
  sh[3] = 2.4 * sin(TAU * 0.0127 * t + 3.3) + 1.0 * sin(TAU * 0.0289 * t + 2.9);
  // Each image also has its own small jitter of place and of focus, as if the three
  // were taken one after another.
  for (let n = 0; n < 6; n++) sh[5 + n] = wob(t, n, 5.0);
  for (let n = 0; n < 3; n++) sh[11 + n] = wob(t, 6 + n, 0.12);
  // The spacing of the three images breathes a little, and best focus drifts either side of the middle one.
  sh[4] = 1 + 0.05 * sin(TAU * 0.0181 * t + 1.1) + 0.03 * sin(TAU * 0.0343 * t + 4.4);
  return 0.1 * sin(TAU * 0.0237 * t + 0.9) + 0.05 * sin(TAU * 0.0391 * t + 3.5);
}

function refresh(S, k, t, dst) {
  const c = S.c, wf = S.wf, pr = S.pr, pi = S.pi, gr = S.gr, gi = S.gi;
  const best = lens(S, t * PACE, c);
  const step = STEP0 * S.sh[4];
  const d = best + (k - 1) * step + S.sh[11 + k];
  // a shift of s LEDs for green is a tilt of s / PG waves across the pupil's diameter
  const tx = (S.sh[0] + (k - 1) * S.sh[2] + S.sh[5 + 2 * k]) / PG, ty = (S.sh[1] + (k - 1) * S.sh[3] + S.sh[6 + 2 * k]) / PG;
  const irs = 1 / (1 - S.kk[2]);
  for (let p = 0; p < PC; p++) {
    const r = RHO[p] * irs, r2 = r * r, r3 = r2 * r;
    const ast = Z6 * r2, com = Z8 * (3 * r3 - 2 * r), tre = Z8 * r3, qua = Z10 * r2 * r2;
    wf[p] =
      d * r2 + tx * pXs[p] + ty * pYs[p] +
      ast * (c[0] * C2[p] + c[1] * S2[p]) + com * (c[2] * C1[p] + c[3] * S1[p]) + tre * (c[4] * C3[p] + c[5] * S3[p]) +
      c[6] * Z5 * (6 * r2 * r2 - 6 * r2 + 1) + qua * (c[7] * C4[p] + c[8] * S4[p]);
  }
  // The pupil: the shadow of the secondary mirror in the middle, and a stop that cuts the rim.
  const rs = 1 - S.kk[2], amp = S.amp;
  for (let p = 0; p < PC; p++) amp[p] = cl((DG / 2) * (rs - pRho[p]) + 0.5, 0, 1) * cl((DG / 2) * (pRho[p] - EPS) + 0.5, 0, 1);
  let pk = 0;
  for (let ch = 0; ch < 3; ch++) {
    for (let p = 0; p < PC; p++) {
      const ph = (TAU * wf[p]) / LAM[ch];
      pr[p] = amp[p] * cos(ph);
      pi[p] = amp[p] * sin(ph);
    }
    const EVc = EVC[ch * NT + k], EVs = EVS[ch * NT + k];
    gr.fill(0);
    gi.fill(0);
    // down: for each pupil column, the sum over its cells at every tile row
    for (let i = 0; i < NP; i++) {
      const o = i * TH;
      for (let p = colStart[i]; p < colStart[i + 1]; p++) {
        const ar = pr[p], ai = pi[p], b = p * TH;
        for (let r = 0; r < TH; r++) {
          const cc = EVc[b + r], ss = EVs[b + r];
          gr[o + r] += ar * cc - ai * ss;
          gi[o + r] += ar * ss + ai * cc;
        }
      }
    }
    // across: for each LED, the sum over pupil columns
    const Euc = EUC[ch], Eus = EUS[ch], out = dst[ch];
    for (let r = 0; r < TH; r++) {
      for (let x = 0; x < W; x++) {
        const w = WIN[(k * TH + r) * W + x];
        if (w <= 0) {
          out[r * W + x] = 0;
          continue;
        }
        let sr = 0, si = 0;
        const b = x * NP;
        for (let i = 0; i < NP; i++) {
          const cc = Euc[b + i], ss = Eus[b + i], gR = gr[i * TH + r], gI = gi[i * TH + r];
          sr += gR * cc - gI * ss;
          si += gR * ss + gI * cc;
        }
        const v = (sr * sr + si * si) * NORM;
        out[r * W + x] = v;
        if (v * w > pk) pk = v * w;
      }
    }
  }
  return pk;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  dt = cl(dt || 0, 0, 0.1);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const kc = [k[0], cl(k[1], 1.4, 5.5), cl(k[2], 0, 0.45), cl(k[3], 0, 1)];
  if (S.first) {
    S.kk = kc.slice();
    S.t = 0;
    for (let i = 0; i < NT; i++) {
      // an older image three frames before, so the blend has something to start from
      S.pkA[i] = refresh(S, i, -REFRESH / 30, S.A[i]);
      S.pkB[i] = refresh(S, i, 0, S.B[i]);
      S.tB[i] = 0;
    }
    S.first = false;
    S.n = 0;
  } else {
    const e = 1 - exp(-dt / 0.3);
    for (let i = 1; i < 4; i++) S.kk[i] += (kc[i] - S.kk[i]) * e;
    S.kk[0] = kc[0];
    S.t += dt;
    S.n++;
    const tile = S.n % REFRESH;
    if (tile < NT) {
      const a = S.A[tile], b = S.B[tile];
      S.A[tile] = b;
      S.B[tile] = a;
      S.pkA[tile] = S.pkB[tile];
      S.pkB[tile] = refresh(S, tile, S.t, S.B[tile]);
      S.tB[tile] = S.t;
    }
  }
  for (let k = 0; k < NT; k++) hsv(0.58 + S.kk[0] + wob(S.t * PACE, 20 + k, 0.035), 0.62 + wob(S.t * PACE, 23 + k, 0.12), 1, S.tints[k]);
}

// ---- Tone. From its peak to its fourth ring an image falls a thousand to one, so
// the curve is a low power with a floor under which the LED stays off, and a core
// that reaches the top goes white however the light is tinted.
const GAMMA = 0.27, FLOOR = 0.09;
export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { R, G, Bl, tint } = S;
  R.fill(0), G.fill(0), Bl.fill(0);
  const dtm = REFRESH / 30;
  for (let k = 0; k < NT; k++) {
    const f = cl((S.t - S.tB[k]) / dtm, 0, 1);
    const A = S.A[k], B = S.B[k];
    // Each image is exposed on its own peak, so a blurred one is as bright as a sharp one.
    const pk = S.pkA[k] + (S.pkB[k] - S.pkA[k]) * f;
    const ex = 1 / max(pk, 0.004);
    // A spread-out image has strong ripples, so it gets a steeper curve; a sharp one has faint rings to show.
    const lv = (k === 1 ? 1.03 : 0.97) + wob(S.t * PACE, 33 + k, k === 1 ? 0.14 : 0.24);
    const gm = GAMMA + 0.2 * (1 - cl(pk / 0.5, 0, 1)) + wob(S.t * PACE, 30 + k, 0.03);
    for (let r = 0; r < TH; r++) {
      const y = Y0[k] + r;
      if (y < 0 || y >= H) continue;
      for (let x = 0; x < W; x++) {
        const w = WIN[(k * TH + r) * W + x];
        if (w <= 0) continue;
        const o = r * W + x, po = y * W + x;
        for (let ch = 0; ch < 3; ch++) {
          const I = (A[ch][o] + (B[ch][o] - A[ch][o]) * f) * ex;
          const q = pow(I, gm);
          const v = q > FLOOR ? ((q - FLOOR) / (1 - FLOOR)) * w : 0;
          const t = S.tints[k][ch];
          const val = lv * (v * t + (1 - t) * v * v * v);
          if (ch === 0) R[po] += val;
          else if (ch === 1) G[po] += val;
          else Bl[po] += val;
        }
      }
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const r = R[o], g = G[o], b = Bl[o];
      if (r + g + b < 0.004) continue;
      display.setPixel(x, y, (min(1, r) * 255) | 0, (min(1, g) * 255) | 0, (min(1, b) * 255) | 0);
    }
}
