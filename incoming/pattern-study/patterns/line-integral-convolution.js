// ===== Patternflow pattern =====
// Title:   Line Integral Convolution
// Family:  noise
// Idea:    Every LED averages a texture of noise along the flow line through it with a ripple that slides downstream, so a river with eddies in it shows as combed fibres of light that curl round the eddies while pulses run down each fibre.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: line integral convolution (Brian Cabral and Leith Leedom, Imaging vector fields using line integral convolution, 1993, animated there with a periodic kernel whose phase advances; the fast version is Detlev Stalling and Hans-Christian Hege, 1995; all from memory); the divergence-free field is curl noise (Robert Bridson, Jim Hourihan and Marcus Nordenstam, 2007, from memory) of gradient noise (Ken Perlin, 1985, from memory)
// Round:   114
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.4..4, Scale=32..96, Streak=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel. At 0 the ground is indigo, the fibres run from blue to teal and the brightest crests are pale gold; the hue also leans with the broad swirls, so green fibres lie beside blue ones.
// Knob 2: Flow. How fast the current runs. Ripples slide down the fibres at 5 LEDs a second per unit of the knob where the flow is fast (2 at 0.4, 10 at the opening 2, 20 at 4), and the three octaves of the potential, with the noise, drift and change at the same ratio.
// Knob 3: Scale. The cell of the coarsest noise octave, 32 to 96 LEDs; the two finer octaves keep half and a quarter of it. At 32 the coarse potential has about 8 hills and hollows on the panel and the flow bends round each one; at 96 it has one or two and a single meander crosses the panel.
// Knob 4: Streak. How far each flow line is followed, each way: 6 LEDs at -1, 18 at the opening and 36 at 1. Short is a fine grain of dashes; long is silk, single fibres with three or four ripples running down them.

// The stream function is psi = U . (y, -x) + sum_k a_k S_k n_k, where n_k is
// 3D gradient noise in three octaves (cell S, S/2, S/4, a_k = 1, 0.45, 0.2) and
// the third coordinate of each octave is time, at its own rate (0.043, 0.071
// and 0.119 cells a second at Flow 2). The velocity is v = (dpsi/dy, -dpsi/dx),
// so div v = 0: the flow turns and saddles but has no sink. U is a mean
// current of 0.8, level with the noise's own rms speed of 0.78. Its heading is
// 90 degrees (down the panel) plus three sines that share no factor, at most
// 69 degrees either way, so the current always has some downward travel and
// swings between 21 and 159 degrees. The octaves drift along it at 3.6, 3.0
// and 2.4 LEDs a second at Flow 2. The lattice gradient at each integer cell
// (x, y, floor z) is hashed, never read from a 256-entry permutation table, so
// the field has no period in space or in time.
//
// The picture is Cabral and Leedom's. A texture T of white noise, one value per
// 1.28 LEDs with smoothstep between, on a torus of 256 x 256 LEDs, is averaged
// along the flow line sigma_x through each LED, forward and backward,
//   I(x) = sum_j w_j T(sigma_x(j h)),   w(s) = hann(s) (1 + 1.1 cos(2 pi s / lambda + theta(t))),
// with h = 1.5 LEDs and lambda = 6.5 steps. The phase theta grows at the rate
// that sends the ripples downstream at 5 LEDs a second per unit of Flow. With
// Z(x) = sum_j hann(s) exp(i 2 pi s / lambda) T the picture is a standing
// fibre texture plus 1.1 Re[exp(i theta) Z], whose amplitude and phase turn
// slowly along a fibre: the ripples slide along the noise. Where Cabral and
// Leedom held the texture still, T here drifts with the coarsest octave
// (3.6 LEDs a second at Flow 2), as dye carried by the current would. Held
// still, the noise left some patches of the panel lighter or darker for as
// long as the pattern ran, because every flow line that crosses a patch reads
// the same noise there: over two minutes the dimmest 16 x 16 block sat at
// 0.27 of the mean (0.53 with another noise), and drifting it is 0.90. The
// flow line is traced in RK2 (midpoint) steps through the direction
// v / sqrt(|v|^2 + 0.3^2), a unit vector where the flow is fast and a shorter
// step where it is slow, so streaks are shorter and ripples slower in a quiet
// corner. These are the instantaneous flow lines of each frame, the level
// lines of psi, not paths traced through time. The field is computed once a
// frame on a grid every 2 LEDs, with 38 LEDs of margin round the panel (a
// kernel reaches 36 LEDs at Streak 1) so that every LED has its whole kernel
// and the flow reaches all four edges. The tracer reads the grid bilinearly.
//
// The convolved noise is low contrast, and its spread falls with the kernel (a
// unit-sum kernel over independent samples has variance 1/length). Each frame
// is divided by its own spread and curved by a smoothstep from z = -0.9 (black)
// to 2.3 (white), which leaves the ground low and a thin crest bright. L goes
// through a ramp of indigo, blue, teal, pale aqua, pale gold and cream, a
// little dimmer where the flow is slow, and the hue leans with the value of
// the two coarse octaves of psi, so the colour follows the broad swirls.

const W = 64, H = 128;
const G = 2, PAD = 38;
const GW = (W + 2 * PAD) / G + 1, GH = (H + 2 * PAD) / G + 1;
const TS = 256;
const STEP = 1.5, NMAX = 24, EPS = 0.3, LAMBDA = 6.5, CT = 1.28, BETA = 1.1;
const U0 = 0.8, TRANS = 4, RIPPLE = 5;
const { floor, ceil, sqrt, cos, sin, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Octaves: velocity weight, lattice turn, time rate in cells a second at Flow 2,
// share of the mean current's drift.
const OCT = [
  { a: 1.0, rot: 0.35, zr: 0.043, tr: 0.9, ox: 11.3, oy: 47.9, oz: 3.7 },
  { a: 0.45, rot: 1.12, zr: 0.071, tr: 0.75, ox: 83.1, oy: 5.2, oz: 19.2 },
  { a: 0.2, rot: 2.31, zr: 0.119, tr: 0.6, ox: 29.6, oy: 71.4, oz: 41.8 },
];

function mix(h) {
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

// An integer lattice point to 32 pseudo-random bits, with no table and so no period.
function hash3(x, y, z, s) {
  return mix(Math.imul(x, 0x1b873593) + mix(Math.imul(y, 0x85ebca6b) + mix(Math.imul(z, 0xc2b2ae35) + s)));
}

export function setup(params) {
  // 256 unit vectors, the pool the lattice draws its gradients from.
  const gt = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const z = 2 * Math.random() - 1, a = TAU * Math.random(), r = sqrt(1 - z * z);
    gt[i * 3] = r * cos(a);
    gt[i * 3 + 1] = r * sin(a);
    gt[i * 3 + 2] = z;
  }
  // The noise texture: a torus of 256 x 256 LEDs holding white noise on a
  // lattice of 200 x 200 values (1.28 LEDs apart, so the seam closes), smoothstep
  // between, scaled to unit spread.
  const T = new Float32Array(TS * TS);
  const NC = TS / CT, lat = new Float32Array(NC * NC);
  for (let i = 0; i < lat.length; i++) lat[i] = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  let v2 = 0;
  for (let y = 0; y < TS; y++)
    for (let x = 0; x < TS; x++) {
      const u = x / CT, v = y / CT, iu = floor(u), iv = floor(v), ju = (iu + 1) % NC, jv = (iv + 1) % NC;
      let fu = u - iu, fv = v - iv;
      fu = fu * fu * (3 - 2 * fu);
      fv = fv * fv * (3 - 2 * fv);
      const t = (1 - fv) * ((1 - fu) * lat[iv * NC + iu] + fu * lat[iv * NC + ju]) + fv * ((1 - fu) * lat[jv * NC + iu] + fu * lat[jv * NC + ju]);
      T[y * TS + x] = t;
      v2 += t * t;
    }
  const norm = 1 / sqrt(v2 / T.length);
  for (let i = 0; i < T.length; i++) T[i] *= norm;
  params.s = {
    gt, T,
    D: new Float32Array(GW * GH * 2),
    Q: new Float32Array(GW * GH * 2),
    NA: [], NB: [], NC: [],
    out: new Float32Array(W * H),
    rgb: new Uint8Array(W * H * 3),
    lut: new Uint8Array(32 * 256 * 3),
    lutHue: NaN,
    wp: new Float32Array(NMAX + 1),
    wm: new Float32Array(NMAX + 1),
    w0: 1, nst: 9,
    seeds: [0x9e3779b1, 0x7f4a7c15, 0x1b56c4e9],
    X: [0, 0, 0], Y: [0, 0, 0], z: [0, 0, 0], TX: 0, TY: 0,
    tf: 0, theta: 0, ang: 0.5 * PI,
    hue: 0, flow: 2, S: 32, Lh: 11.7,
    ux: 0, uy: U0,
  };
}

// The heading of the mean current: down the panel, leaning left and right
// over minutes on sines that share no factor.
function heading(tf) {
  return 0.5 * PI + 0.55 * sin(0.0213 * tf + 1.3) + 0.4 * sin(0.0517 * tf + 0.4) + 0.25 * sin(0.1131 * tf + 2.2);
}

// One octave on the grid. At a fixed time the 3D gradient noise is a 2D
// one whose lattice nodes carry a gradient (Ax, Ay) and an offset C: the
// trilinear blend of the two z layers' corner terms g . (f - corner) is
// ((1 - wz) g0 + wz g1) . (fu, fv) + (1 - wz) g0z fz + wz g1z (fz - 1).
// The value and its slope then come from the usual 2D quintic form.
// The slope goes into D (velocity) and the value into Q.
function octave(P, k, first) {
  const o = OCT[k], S = P.S / (1 << k), c = cos(o.rot), s = sin(o.rot), inv = 1 / S;
  const x0 = -PAD - P.X[k] + o.ox * S, y0 = -PAD - P.Y[k] + o.oy * S;
  // lattice coordinates of the grid's corner and per grid step
  const dux = c * G * inv, duy = s * G * inv, dvx = -s * G * inv, dvy = c * G * inv;
  const u00 = (c * x0 + s * y0) * inv, v00 = (-s * x0 + c * y0) * inv;
  const ue = [u00, u00 + dux * (GW - 1), u00 + duy * (GH - 1), u00 + dux * (GW - 1) + duy * (GH - 1)];
  const ve = [v00, v00 + dvx * (GW - 1), v00 + dvy * (GH - 1), v00 + dvx * (GW - 1) + dvy * (GH - 1)];
  const iu0 = floor(min(...ue)), iu1 = floor(max(...ue)) + 1;
  const iv0 = floor(min(...ve)), iv1 = floor(max(...ve)) + 1;
  const nu = iu1 - iu0 + 1, nv = iv1 - iv0 + 1;
  if (!P.NA[k] || P.NA[k].length < nu * nv) {
    P.NA[k] = new Float32Array(nu * nv);
    P.NB[k] = new Float32Array(nu * nv);
    P.NC[k] = new Float32Array(nu * nv);
  }
  const NA = P.NA[k], NB = P.NB[k], NC = P.NC[k], gt = P.gt;
  const zk = P.z[k] + o.oz, iz = floor(zk), fz = zk - iz, wz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const seed = P.seeds[k];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = (hash3(iu0 + i, iv0 + j, iz, seed) >>> 24) * 3, b = (hash3(iu0 + i, iv0 + j, iz + 1, seed) >>> 24) * 3;
      const n = j * nu + i;
      NA[n] = (1 - wz) * gt[a] + wz * gt[b];
      NB[n] = (1 - wz) * gt[a + 1] + wz * gt[b + 1];
      NC[n] = (1 - wz) * gt[a + 2] * fz + wz * gt[b + 2] * (fz - 1);
    }
  const amp = o.a, D = P.D, Q = P.Q;
  for (let gj = 0; gj < GH; gj++)
    for (let gi = 0; gi < GW; gi++) {
      const u = u00 + dux * gi + duy * gj, v = v00 + dvx * gi + dvy * gj;
      const iu = floor(u), iv = floor(v), fu = u - iu, fv = v - iv;
      const n00 = (iv - iv0) * nu + (iu - iu0), n10 = n00 + 1, n01 = n00 + nu, n11 = n01 + 1;
      const ux = fu * fu * fu * (fu * (fu * 6 - 15) + 10), uy = fv * fv * fv * (fv * (fv * 6 - 15) + 10);
      const dux_ = 30 * fu * fu * (fu - 1) * (fu - 1), duy_ = 30 * fv * fv * (fv - 1) * (fv - 1);
      const va = NA[n00] * fu + NB[n00] * fv + NC[n00];
      const vb = NA[n10] * (fu - 1) + NB[n10] * fv + NC[n10];
      const vc = NA[n01] * fu + NB[n01] * (fv - 1) + NC[n01];
      const vd = NA[n11] * (fu - 1) + NB[n11] * (fv - 1) + NC[n11];
      const e = va - vb - vc + vd;
      const val = va + ux * (vb - va) + uy * (vc - va) + ux * uy * e;
      const gu =
        NA[n00] + ux * (NA[n10] - NA[n00]) + uy * (NA[n01] - NA[n00]) + ux * uy * (NA[n00] - NA[n10] - NA[n01] + NA[n11]) +
        dux_ * (vb - va + uy * e);
      const gv =
        NB[n00] + ux * (NB[n10] - NB[n00]) + uy * (NB[n01] - NB[n00]) + ux * uy * (NB[n00] - NB[n10] - NB[n01] + NB[n11]) +
        duy_ * (vc - va + ux * e);
      // slope in the panel's axes, then v = (psi_y, -psi_x)
      const px = c * gu - s * gv, py = s * gu + c * gv, g = (gj * GW + gi) * 2;
      if (first) {
        D[g] = amp * py;
        D[g + 1] = -amp * px;
        Q[g] = 0;
      } else {
        D[g] += amp * py;
        D[g + 1] -= amp * px;
      }
      if (k < 2) Q[g] += val * (k === 0 ? 1 : 0.5);
    }
}

// The field of this frame: three octaves and the mean current on the grid.
// D leaves holding the unit-ish direction, Q the speed and the coarse potential.
function field(P) {
  for (let k = 0; k < 3; k++) octave(P, k, k === 0);
  const D = P.D, Q = P.Q;
  for (let g = 0; g < GW * GH * 2; g += 2) {
    const vx = D[g] + P.ux, vy = D[g + 1] + P.uy;
    const sp = sqrt(vx * vx + vy * vy), d = 1 / sqrt(sp * sp + EPS * EPS);
    D[g] = vx * d;
    D[g + 1] = vy * d;
    Q[g + 1] = sp;
  }
}

// The ripple kernel of this frame, taps 0..nst each way.
function kernel(P) {
  const L = P.Lh + 0.5, om = TAU / LAMBDA, th = P.theta;
  const wp = P.wp, wm = P.wm;
  for (let j = 0; j <= NMAX; j++) {
    const win = j <= L ? 0.5 * (1 + cos((PI * j) / L)) : 0;
    wp[j] = win * (1 + BETA * cos(om * j + th));
    wm[j] = win * (1 + BETA * cos(om * j - th));
  }
  P.w0 = 1 + BETA * cos(th);
  P.nst = min(NMAX, floor(L));
}

// The noise at a point, bilinear on the wrapping torus.
function tex(T, tx, ty) {
  const i = floor(tx), j = floor(ty), fx = tx - i, fy = ty - j;
  const i0 = i & (TS - 1), i1 = (i + 1) & (TS - 1), r0 = (j & (TS - 1)) * TS, r1 = ((j + 1) & (TS - 1)) * TS;
  return (1 - fy) * ((1 - fx) * T[r0 + i0] + fx * T[r0 + i1]) + fy * ((1 - fx) * T[r1 + i0] + fx * T[r1 + i1]);
}

// Every LED: the noise summed along its flow line, RK2 steps both ways.
function lic(P) {
  const D = P.D, T = P.T, out = P.out, wp = P.wp, wm = P.wm, n = P.nst, w0 = P.w0;
  const hg = STEP / G, hh = 0.5 * hg, gmax = GW - 1.0001, gmay = GH - 1.0001;
  // the noise drifts with the current: a LED reads the torus where it was
  const ox = PAD + P.TX, oy = PAD + P.TY;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let acc = w0 * tex(T, x - P.TX, y - P.TY);
      for (let dir = 0; dir < 2; dir++) {
        const sg = dir === 0 ? 1 : -1, w = dir === 0 ? wp : wm;
        let px = (x + PAD) / G, py = (y + PAD) / G;
        for (let j = 1; j <= n; j++) {
          let i = px | 0, r = py | 0, fx = px - i, fy = py - r, a = (r * GW + i) * 2, b = a + GW * 2;
          const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
          let ax = w00 * D[a] + w10 * D[a + 2] + w01 * D[b] + w11 * D[b + 2];
          let ay = w00 * D[a + 1] + w10 * D[a + 3] + w01 * D[b + 1] + w11 * D[b + 3];
          let mx = px + sg * hh * ax, my = py + sg * hh * ay;
          mx = mx < 0 ? 0 : mx > gmax ? gmax : mx;
          my = my < 0 ? 0 : my > gmay ? gmay : my;
          i = mx | 0;
          r = my | 0;
          fx = mx - i;
          fy = my - r;
          a = (r * GW + i) * 2;
          b = a + GW * 2;
          const v00 = (1 - fx) * (1 - fy), v10 = fx * (1 - fy), v01 = (1 - fx) * fy, v11 = fx * fy;
          ax = v00 * D[a] + v10 * D[a + 2] + v01 * D[b] + v11 * D[b + 2];
          ay = v00 * D[a + 1] + v10 * D[a + 3] + v01 * D[b + 1] + v11 * D[b + 3];
          px += sg * hg * ax;
          py += sg * hg * ay;
          px = px < 0 ? 0 : px > gmax ? gmax : px;
          py = py < 0 ? 0 : py > gmay ? gmay : py;
          acc += w[j] * tex(T, px * G - ox, py * G - oy);
        }
      }
      out[y * W + x] = acc;
    }
}

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[k + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[k + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// Indigo ground, blue, teal, pale aqua, pale gold crest. A row of the table
// is one hue lean, from -0.15 to +0.15 of the wheel, a column one value of L.
const STOPS = [
  [0.0, 0.7, 0.9, 0.04],
  [0.18, 0.66, 0.92, 0.28],
  [0.4, 0.57, 0.88, 0.58],
  [0.62, 0.49, 0.72, 0.85],
  [0.82, 0.44, 0.38, 1.0],
  [0.93, 0.14, 0.45, 1.0],
  [1.0, 0.1, 0.12, 1.0],
];

function buildLut(P) {
  const lut = P.lut, tmp = new Float32Array(3);
  for (let q = 0; q < 32; q++) {
    const lean = (q / 31 - 0.5) * 0.3 + P.hue;
    let s = 0;
    for (let l = 0; l < 256; l++) {
      const L = l / 255;
      while (s < STOPS.length - 2 && L > STOPS[s + 1][0]) s++;
      const A = STOPS[s], B = STOPS[s + 1], f = cl((L - A[0]) / (B[0] - A[0]), 0, 1);
      const sm = f * f * (3 - 2 * f);
      let dh = B[1] - A[1];
      dh -= Math.round(dh);
      hsv(A[1] + dh * sm + lean, A[2] + (B[2] - A[2]) * sm, A[3] + (B[3] - A[3]) * sm, tmp, 0);
      const o = (q * 256 + l) * 3;
      lut[o] = tmp[0];
      lut[o + 1] = tmp[1];
      lut[o + 2] = tmp[2];
    }
  }
  P.lutHue = P.hue;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 32, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.flow = cl(k[1], 0.4, 4);
  P.S = cl(k[2], 32, 96);
  P.Lh = 4 + 20 * Math.pow((cl(k[3], -1, 1) + 1) / 2, 1.5);
  const fl = P.flow / 2;
  // time: the flow clock, the ripple phase, the drift of each octave
  P.tf += d * fl;
  P.ang = heading(P.tf);
  P.ux = U0 * cos(P.ang);
  P.uy = U0 * sin(P.ang);
  for (let o = 0; o < 3; o++) {
    P.X[o] += d * fl * TRANS * OCT[o].tr * cos(P.ang);
    P.Y[o] += d * fl * TRANS * OCT[o].tr * sin(P.ang);
    P.z[o] += d * fl * OCT[o].zr;
  }
  // the noise travels with the coarsest octave, wrapped on its torus
  P.TX += d * fl * TRANS * OCT[0].tr * cos(P.ang);
  P.TY += d * fl * TRANS * OCT[0].tr * sin(P.ang);
  P.TX -= TS * floor(P.TX / TS);
  P.TY -= TS * floor(P.TY / TS);
  P.theta += (d * TAU * RIPPLE * P.flow) / (LAMBDA * STEP);
  P.theta -= TAU * floor(P.theta / TAU);
  if (P.lutHue !== P.hue) buildLut(P);
  field(P);
  kernel(P);
  lic(P);
  // spread of the convolved noise in this frame
  const out = P.out, N = W * H;
  let m = 0;
  for (let i = 0; i < N; i++) m += out[i];
  m /= N;
  let v = 0;
  for (let i = 0; i < N; i++) v += (out[i] - m) * (out[i] - m);
  const sd = sqrt(v / N) + 1e-6;
  const inv = 1 / sd, rgb = P.rgb, lut = P.lut, Q = P.Q;
  for (let y = 0; y < H; y++) {
    const gy = (y + PAD) / G, r = gy | 0, fy = gy - r;
    for (let x = 0; x < W; x++) {
      const gx = (x + PAD) / G, i = gx | 0, fx = gx - i, a = (r * GW + i) * 2, b = a + GW * 2;
      const sp =
        (1 - fx) * (1 - fy) * Q[a + 1] + fx * (1 - fy) * Q[a + 3] + (1 - fx) * fy * Q[b + 1] + fx * fy * Q[b + 3];
      const ps = (1 - fx) * (1 - fy) * Q[a] + fx * (1 - fy) * Q[a + 2] + (1 - fx) * fy * Q[b] + fx * fy * Q[b + 2];
      const z = (out[y * W + x] - m) * inv;
      const t = cl((z + 0.9) / 3.2, 0, 1);
      let L = t * t * (3 - 2 * t);
      L *= 0.7 + 0.3 * (sp / (sp + 0.8));
      const q = cl(floor((0.5 + ps * 0.9) * 32), 0, 31), li = cl(floor(L * 255.99), 0, 255);
      const o = (q * 256 + li) * 3, p = (y * W + x) * 3;
      rgb[p] = lut[o];
      rgb[p + 1] = lut[o + 1];
      rgb[p + 2] = lut[o + 2];
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const rgb = P.rgb;
  for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, rgb[p], rgb[p + 1], rgb[p + 2]);
}
