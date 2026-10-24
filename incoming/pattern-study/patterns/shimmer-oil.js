// ===== Patternflow pattern =====
// Title:   Shimmer Oil
// Family:  cosmetic
// Idea:    An unseen fingertip stirs a tinted body oil full of mica, and the countless flat flakes turn with the flow the way they do in rheoscopic fluid, standing up where the oil is stretched and lying flat where it only turns, so the swirl itself shows as pearly silk along the shear layers, rolling eddies and filaments that stretch and fold, with the sheen sliding over them as they move.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 36, after shimmer body oils and Paul Matisse's Kalliroscope rheoscopic fluid (1960s), with the flakes turned by Jeffery's equation (G. B. Jeffery, 1922)
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Stir=0..1, Mica=0..1
//
// Knob 1: Hue. Turns the oil and its sheen once round the wheel; the brightest silk leans 0.12 back from the oil's hue, lilac on the berry oil. At 0 a deep berry oil with pale pink silk; at 0.1 wine, at 0.2 orange, at 0.3 yellow, at 0.45 green, at 0.6 teal, at 0.8 indigo, at 0.9 violet. From orange to lime the oil glows at 0.82 of full instead of 0.34, so it never reads brown or olive.
// Knob 2: Speed. The clock. At 2 the fingertip crosses the panel and back in 9 seconds and runs down and up it in 13, so its path never quite repeats, and the oil near it moves up to 38 LEDs a second; at 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Stir. How hard the fingertip pushes, 1.9 times harder at 0.5 and 5 times at 1. At 0 it trails a slow pair of eddies and the silk lies in long arcs; at 1 the oil near it races at 87 LEDs a second, the eddies roll into each other and the silk folds into tight curls.
// Knob 4: Mica. How much mica the oil carries. At 0 and 0.06 a sheer oil whose flow shows as soft satin; at 0.5 the silk is brighter with a fine grain in it, and 250 large flakes ride in it, each glinting white for a moment as it turns to the strip light; at 1 there are 330 and the brightest silk runs to white.
// Buttons: K1 tap drops a second fingertip somewhere away from the first: it turns a spiral about 20 LEDs across for 0.7 seconds and the silk winds round it.

const W = 64, H = 128;
const { floor, min, sqrt, sin, cos, exp, abs, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// The flow lives on a grid of NX x NY cells, HS LEDs each, with free-slip
// walls round the panel. It is solved as vorticity and stream function: the
// stream function vanishes on the walls, so a sine series holds it exactly,
// and the Poisson equation is a division in that series.
const NX = 24, NY = 48, HS = W / NX, MX = NX - 1, MY = NY - 1, GW = NX + 1, GN = GW * (NY + 1);
const SX = new Float32Array(MX * MX), SY = new Float32Array(MY * MY), LAM = new Float32Array(MX * MY);
for (let k = 1; k <= MX; k++) for (let i = 1; i <= MX; i++) SX[(k - 1) * MX + i - 1] = sin((PI * k * i) / NX);
for (let k = 1; k <= MY; k++) for (let i = 1; i <= MY; i++) SY[(k - 1) * MY + i - 1] = sin((PI * k * i) / NY);
// Eigenvalues of the five-point Laplacian, so the stream function's
// finite-difference Laplacian is exactly minus the vorticity.
for (let l = 1; l <= MY; l++)
  for (let k = 1; k <= MX; k++)
    LAM[(l - 1) * MX + k - 1] = (4 / (HS * HS)) * (sin((PI * k) / (2 * NX)) ** 2 + sin((PI * l) / (2 * NY)) ** 2);

// Two-dimensional sine transform of the interior nodes (MY rows of MX).
function dst2(src, dst, tmp) {
  for (let j = 0; j < MY; j++) {
    const r = j * MX;
    for (let k = 0; k < MX; k++) {
      const s = k * MX;
      let a = 0;
      for (let i = 0; i < MX; i++) a += src[r + i] * SX[s + i];
      tmp[r + k] = a;
    }
  }
  for (let l = 0; l < MY; l++) {
    const s = l * MY, r = l * MX;
    for (let k = 0; k < MX; k++) dst[r + k] = 0;
    for (let j = 0; j < MY; j++) {
      const c = SY[s + j], q = j * MX;
      if (c === 0) continue;
      for (let k = 0; k < MX; k++) dst[r + k] += c * tmp[q + k];
    }
  }
}

// Flow constants at Speed 2: viscosity in LED^2 a second, skin friction a
// second, and how fast the flakes settle back toward lying in the film, a
// second.
const NU = 0.6, MU = 0.12, SETTLE = 0.24;
// The largest traceless part of M: eigenvalues 36 and 1/36, a stretch of 6.
const DMAX = (36 - 1 / 36) / 2;
// Flakes: a parcel of them to each LED, and one parcel in 25 also carries a
// single large flake that glints. A flake's normal m turns with the flow as
// A m, A = F^-T for the deformation F since the flakes lay down. The flakes
// at rest lean E0 (about 14 degrees) every way, so a parcel's spread of
// normals is set by M = A A^T alone (the turn left in A only spins an even
// spread) and M is all a parcel carries. With M's eigenvalues s^2 and 1/s^2
// and its axis e1 the flakes lie at E0 (s cos phi e1 + sin phi e2 / s), so
// how they catch a light hangs on the stretch s and, for a light from one
// side, on the angle between that side and e1.
const NP = W * H;
// The tables hold the averages over phi, for s from 1 to 12 laid out on
// 1 - 1/s.
const E0 = 0.25, NS = 96, NC = 33, SMAX = 12, EL = 0.95;
// Soft front light, ring light, strip light by angle.
const RF = new Float32Array(NS), RR = new Float32Array(NS), RS = new Float32Array(NS * NC);
{
  const NPHI = 48, se = sin(EL), ce = cos(EL), cd = [], sd = [];
  for (let j = 0; j < NC; j++) {
    const dl = 0.5 * Math.acos(-1 + (2 * j) / (NC - 1));
    cd.push(se * cos(dl));
    sd.push(se * sin(dl));
  }
  for (let i = 0; i < NS; i++) {
    const sg = 1 / (1 - (i / (NS - 1)) * (1 - 1 / SMAX));
    let f = 0, r = 0;
    for (let k = 0; k < NPHI; k++) {
      const ph = (PI * (k + 0.5)) / NPHI, m0 = E0 * sg * cos(ph), m1 = (E0 / sg) * sin(ph), inv = 1 / sqrt(1 + m0 * m0 + m1 * m1);
      const i2 = inv * inv, i4 = i2 * i2, i8 = i4 * i4;
      f += i8 * i8 * i8;
      // Flakes standing at about 45 degrees catch a low ring of light from
      // every side; flat ones and edge-on ones miss most of it.
      const rq = (inv - 0.707) * 3.5, rb = rq * rq < 1 ? 1 - rq * rq : 0;
      r += 0.05 + 0.95 * rb * rb;
      for (let j = 0; j < NC; j++) {
        const d = (m0 * cd[j] + m1 * sd[j] + ce) * inv, d2 = d * d, d4 = d2 * d2;
        RS[i * NC + j] += (d4 * d4) / NPHI;
      }
    }
    RF[i] = f / NPHI;
    RR[i] = r / NPHI;
  }
}

// The fingertip's push, its radius in LEDs.
const SIG = 6.5;

export function setup(params) {
  const S = {
    hue: 0, speed: 2, stir: 0, mica: 0.06, t: 0, fa: 0, par: 0, mdt: [0, 0], warm: false,
    w: new Float32Array(GN), w2: new Float32Array(GN), psi: new Float32Array(GN),
    u: new Float32Array(GN), v: new Float32Array(GN), ux: new Float32Array(GN), uy: new Float32Array(GN), vx: new Float32Array(GN),
    a: new Float32Array(MX * MY), b: new Float32Array(MX * MY), c: new Float32Array(MX * MY), d: new Float32Array(MX * MY), q: new Float32Array((GW + 2) * (NY + 3)),
    px: new Float32Array(NP), py: new Float32Array(NP),
    M0: new Float32Array(NP), M1: new Float32Array(NP), M2: new Float32Array(NP),
    gx: new Float32Array(NP), gy: new Float32Array(NP),
    kp: new Float32Array(NP), cnt: new Int32Array(W * H), own: new Int32Array(W * H), gl: new Float32Array(W * H), lit: new Float32Array(W * H), wt: new Float32Array(W * H), tmp: new Float32Array(W * H),
    swirl: null, c0: [0, 0, 0], c1: [0, 0, 0], c2: [0, 0, 0],
  };
  // Parcels start one to each LED, their flakes at rest.
  for (let p = 0; p < NP; p++) {
    S.px[p] = (p % W) + random();
    S.py[p] = floor(p / W) + random();
    S.M0[p] = S.M2[p] = 1;
    S.kp[p] = 0.8 + 0.4 * random();
    if (random() < 0.04) {
      const a = random() * 2 * PI, r = E0 * (0.4 + 0.6 * random());
      S.gx[p] = r * cos(a);
      S.gy[p] = r * sin(a) + 1e-6;
    }
  }
  // And the oil has been swirled before: a dozen soft eddies of either sign.
  for (let n = 0; n < 12; n++) {
    const cx = 8 + random() * (W - 16), cy = 8 + random() * (H - 16), r = 6 + random() * 8, k = (random() < 0.5 ? -1 : 1) * (2 + 3 * random());
    for (let j = 1; j < NY; j++)
      for (let i = 1; i < NX; i++) {
        const dx = i * HS - cx, dy = j * HS - cy;
        S.w[j * GW + i] += k * exp(-(dx * dx + dy * dy) / (r * r));
      }
  }
  params.s = S;
}

// Where the fingertip is at time t: a slow loop that wanders over the panel.
function finger(t) {
  return [32 + 19 * sin(t * 0.7) + 4 * sin(t * 1.9), 64 + 44 * sin(t * 0.47 + 0.6) + 8 * cos(t * 1.3)];
}

// One step of the flow: carry the vorticity, push it with the fingertip,
// let it decay, and solve for the stream function, velocity and its gradient.
function flowStep(S, dt) {
  const { w, w2, psi, u, v, ux, uy, vx, a, b, c } = S;
  const force = 16 * (0.45 + 0.5 * S.stir + 1.3 * S.stir * S.stir);
  const [fx, fy] = finger(S.t), [gx, gy] = finger(S.t + 0.02);
  const vxs = (gx - fx) / 0.02, vys = (gy - fy) / 0.02;
  const fr = exp(-MU * dt), sw = S.swirl;
  for (let j = 1; j < NY; j++)
    for (let i = 1; i < NX; i++) {
      const g = j * GW + i;
      // Back along the flow, in grid units.
      let X = i - (u[g] * dt) / HS, Y = j - (v[g] * dt) / HS;
      X = X < 0 ? 0 : X > NX - 1e-4 ? NX - 1e-4 : X;
      Y = Y < 0 ? 0 : Y > NY - 1e-4 ? NY - 1e-4 : Y;
      const i0 = X | 0, j0 = Y | 0, tx = X - i0, ty = Y - j0, q = j0 * GW + i0;
      let val = (w[q] * (1 - tx) + w[q + 1] * tx) * (1 - ty) + (w[q + GW] * (1 - tx) + w[q + GW + 1] * tx) * ty;
      // The fingertip drags the oil along with it: the curl of a force along
      // its velocity, spread over a Gaussian of radius SIG.
      const dx = i * HS - fx, dy = j * HS - fy, r2 = (dx * dx + dy * dy) / (SIG * SIG);
      if (r2 < 9) val += ((force * dt * -2) / (SIG * SIG)) * exp(-r2) * (vys * dx - vxs * dy);
      if (sw) {
        const ex = i * HS - sw.x, ey = j * HS - sw.y, e2 = (ex * ex + ey * ey) / (sw.r * sw.r);
        if (e2 < 9) val += sw.k * dt * exp(-e2) * (1 - 0.6 * e2);
      }
      w2[g] = val * fr;
    }
  if (sw && (sw.left -= dt) <= 0) S.swirl = null;
  // Viscosity, one explicit step of the five-point Laplacian (the vorticity
  // is 0 on the walls).
  const nu = (NU * dt) / (HS * HS);
  for (let j = 1; j < NY; j++)
    for (let i = 1; i < NX; i++) {
      const g = j * GW + i;
      w[g] = w2[g] + nu * (w2[g - 1] + w2[g + 1] + w2[g - GW] + w2[g + GW] - 4 * w2[g]);
      a[(j - 1) * MX + i - 1] = w[g];
    }
  // The stream function: a division in the sine series.
  dst2(a, b, c);
  const norm = 4 / (NX * NY);
  for (let n = 0; n < MX * MY; n++) b[n] *= norm / LAM[n];
  dst2(b, c, S.d);
  for (let j = 1; j < NY; j++) for (let i = 1; i < NX; i++) psi[j * GW + i] = c[(j - 1) * MX + i - 1];
  // Velocity u = dpsi/dy, v = -dpsi/dx and its gradient, by central
  // differences; past a wall the stream function is mirrored with its sign
  // turned over, as the sine series has it.
  const Q = S.q, QW = GW + 2;
  for (let j = 0; j <= NY; j++) {
    const r = (j + 1) * QW + 1;
    for (let i = 0; i <= NX; i++) Q[r + i] = psi[j * GW + i];
    Q[r - 1] = -Q[r + 1];
    Q[r + NX + 1] = -Q[r + NX - 1];
  }
  for (let i = 0; i < QW; i++) {
    Q[i] = -Q[2 * QW + i];
    Q[(NY + 2) * QW + i] = -Q[NY * QW + i];
  }
  const h2 = 1 / (HS * HS), i2 = 1 / (2 * HS);
  for (let j = 0; j <= NY; j++)
    for (let i = 0; i <= NX; i++) {
      const g = j * GW + i, q = (j + 1) * QW + i + 1, p0 = Q[q];
      const pe = Q[q + 1], pw = Q[q - 1], pn = Q[q - QW], ps = Q[q + QW];
      u[g] = (ps - pn) * i2;
      v[g] = -(pe - pw) * i2;
      uy[g] = (ps - 2 * p0 + pn) * h2;
      vx[g] = -(pe - 2 * p0 + pw) * h2;
      ux[g] = (Q[q + QW + 1] - Q[q - QW + 1] - Q[q + QW - 1] + Q[q - QW - 1]) * 0.25 * h2;
    }
}

// The parcels ride the flow, and every flake in one turns as a flat disc of
// no thickness does (Jeffery's equation): its normal m follows
// dm/dt = K m with K = -(grad u)^T, so a flake turns its face across the
// stretching and lies along the flow lines in shear. Then M follows
// dM/dt = K M + M K^T, and the film draws M back toward the identity, the
// flakes settling to rest.
function flakeStep(S, dt) {
  const { psi, ux, uy, vx, px, py, M0, M1, M2 } = S;
  // Half the parcels turn their flakes each step, by the time since their
  // last turn; all of them move.
  const par = (S.par ^= 1), dm = S.mdt[par] + dt;
  S.mdt[par] = 0;
  S.mdt[par ^ 1] += dt;
  const st = exp(-SETTLE * dm), ih = 1 / HS, XM = NX - 1e-4, YM = NY - 1e-4, hd = 0.5 * dt * ih;
  for (let p = 0; p < NP; p++) {
    let x = px[p], y = py[p];
    let X = x * ih, Y = y * ih;
    X = X > XM ? XM : X;
    Y = Y > YM ? YM : Y;
    const i0 = X | 0, j0 = Y | 0, tx = X - i0, ty = Y - j0, g = j0 * GW + i0;
    // Velocity from the bilinear stream function: divergence-free inside
    // every cell.
    const p00 = psi[g], p10 = psi[g + 1], p01 = psi[g + GW], p11 = psi[g + GW + 1];
    const U = (1 - tx) * (p01 - p00) + tx * (p11 - p10), V = (1 - ty) * (p10 - p00) + ty * (p11 - p01);
    if ((p & 1) === par) {
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const a = ux[g] * w00 + ux[g + 1] * w10 + ux[g + GW] * w01 + ux[g + GW + 1] * w11;
      const b = uy[g] * w00 + uy[g + 1] * w10 + uy[g + GW] * w01 + uy[g + GW + 1] * w11;
      const c = vx[g] * w00 + vx[g + 1] * w10 + vx[g + GW] * w01 + vx[g + GW + 1] * w11;
      // grad u = [[a, b], [c, -a]]. One step of m' = K m is the Cayley
      // transform C = (I - K dt/2)^-1 (I + K dt/2); K has no trace, so
      // C = ((1 - D) I + K dt) / (1 + D) with D = det(K dt) / 4, and det C = 1
      // exactly, as the flow keeps area. M' = C M C^T.
      const D = (dm * dm * (-a * a - b * c)) / 4, iD = 1 / (D > -0.8 ? 1 + D : 0.2), q = 1 - D;
      const c00 = (q - dm * a) * iD, c01 = -dm * c * iD, c10 = -dm * b * iD, c11 = (q + dm * a) * iD;
      const mp = M0[p], mq = M1[p], mr = M2[p];
      const t00 = c00 * mp + c01 * mq, t01 = c00 * mq + c01 * mr, t10 = c10 * mp + c11 * mq, t11 = c10 * mq + c11 * mr;
      // Settling: M's traceless part decays at the rate SETTLE, and past a
      // stretch of 6 the film's drag holds it, so the flakes stop short of
      // standing on edge. det M stays 1, as the flow keeps it: with the
      // traceless part (d0, d1) the trace is 2 sqrt(1 + d0^2 + d1^2).
      let d0 = 0.5 * (t00 * c00 + t01 * c01 - t10 * c10 - t11 * c11) * st, d1 = (t00 * c10 + t01 * c11) * st;
      const dd = d0 * d0 + d1 * d1;
      if (dd > DMAX * DMAX) {
        const f = DMAX / sqrt(dd);
        d0 *= f;
        d1 *= f;
      }
      const h = sqrt(1 + d0 * d0 + d1 * d1);
      M0[p] = h + d0;
      M1[p] = d1;
      M2[p] = h - d0;
    }
    // The parcel moves by the midpoint rule.
    let Xm = X + hd * U, Ym = Y - hd * V;
    Xm = Xm < 0 ? 0 : Xm > XM ? XM : Xm;
    Ym = Ym < 0 ? 0 : Ym > YM ? YM : Ym;
    const im = Xm | 0, jm = Ym | 0, sx = Xm - im, sy = Ym - jm, gm = jm * GW + im;
    const q00 = psi[gm], q10 = psi[gm + 1], q01 = psi[gm + GW], q11 = psi[gm + GW + 1];
    x += ((1 - sx) * (q01 - q00) + sx * (q11 - q10)) * ih * dt;
    y -= ((1 - sy) * (q10 - q00) + sy * (q11 - q01)) * ih * dt;
    px[p] = x < 0.01 ? 0.01 : x > W - 0.01 ? W - 0.01 : x;
    py[p] = y < 0.01 ? 0.01 : y > H - 0.01 ? H - 0.01 : y;
  }
}

// The flow keeps the oil's density even, and so would the parcels if they
// moved exactly. Where they have drifted out of a LED that its neighbours
// still reach, a parcel from a crowded LED is moved in, taking on the flakes
// of a neighbour; up to 400 a frame.
function even(S) {
  const { px, py, M0, M1, M2, cnt, own } = S;
  cnt.fill(0);
  for (let p = 0; p < NP; p++) {
    const o = (py[p] | 0) * W + (px[p] | 0);
    cnt[o]++;
    own[o] = p;
  }
  let d = 0, moved = 0;
  const start = (random() * W * H) | 0;
  for (let n = 0; n < W * H && moved < 400; n++) {
    const e = (start + n) % (W * H);
    if (cnt[e] !== 0) continue;
    const x = e % W, y = (e / W) | 0;
    const nb = x > 0 && cnt[e - 1] ? e - 1 : x < W - 1 && cnt[e + 1] ? e + 1 : y > 0 && cnt[e - W] ? e - W : y < H - 1 && cnt[e + W] ? e + W : -1;
    if (nb < 0) continue;
    while (d < W * H && cnt[d] < 3) d++;
    if (d >= W * H) break;
    const p = own[d], q = own[nb];
    cnt[d]--;
    cnt[e] = 1;
    px[p] = x + 0.1 + 0.8 * random();
    py[p] = y + 0.1 + 0.8 * random();
    M0[p] = M0[q];
    M1[p] = M1[q];
    M2[p] = M2[q];
    moved++;
  }
}

// The flow is solved every 1/15 s of oil time, the flakes moved every step.
function step(S, dt) {
  S.fa += dt;
  if (S.fa > 1 / 15 - 1e-6) {
    flowStep(S, S.fa);
    S.fa = 0;
  }
  flakeStep(S, dt);
  S.t += dt;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.stir = cl(k[2], 0, 1);
  S.mica = cl(k[3], 0, 1);
  if (!S.warm) {
    // Open on oil that has been stirred for 5.4 seconds, the flakes laid
    // down for the last 4.2 of them.
    for (let i = 0; i < 4; i++) (S.t += 0.3), flowStep(S, 0.3);
    for (let i = 0; i < 6; i++) step(S, 0.4);
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    // A fingertip lands well away from the stirring one and turns a spiral.
    const [fx, fy] = finger(S.t);
    let x = 0, y = 0;
    for (let n = 0; n < 8; n++) {
      x = 16 + random() * (W - 32);
      y = 20 + random() * (H - 40);
      if ((x - fx) ** 2 + (y - fy) ** 2 > 40 * 40) break;
    }
    S.swirl = { x, y, r: 10, k: random() < 0.5 ? 22 : -22, left: 0.7 };
  }
  // Oil time runs at Speed / 2, in steps no longer than 1/15 s.
  let left = (d * S.speed) / 2;
  while (left > 1e-6) {
    const h = min(left, 1 / 15);
    step(S, h);
    left -= h;
  }
  even(S);
}

function blur(F, T) {
  for (let y = 0; y < H; y++) {
    const r = y * W;
    T[r] = 0.75 * F[r] + 0.25 * F[r + 1];
    for (let x = 1; x < W - 1; x++) T[r + x] = 0.5 * F[r + x] + 0.25 * (F[r + x - 1] + F[r + x + 1]);
    T[r + W - 1] = 0.75 * F[r + W - 1] + 0.25 * F[r + W - 2];
  }
  for (let x = 0; x < W; x++) {
    F[x] = 0.75 * T[x] + 0.25 * T[x + W];
    F[(H - 1) * W + x] = 0.75 * T[(H - 1) * W + x] + 0.25 * T[(H - 2) * W + x];
  }
  for (let o = W; o < (H - 1) * W; o++) F[o] = 0.5 * T[o] + 0.25 * (T[o - W] + T[o + W]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { px, py, M0, M1, M2, gx, gy, kp, lit, wt, gl } = S;
  const mica = S.mica, t = S.t;
  // Three lights: a soft one over the viewer's shoulder for the flakes that
  // lie flat, a low ring for the ones the flow has half stood up, and a strip
  // low at one side, slowly circling, for those leaning toward it.
  const az = 0.6 + 0.35 * t, c2a = cos(2 * az), s2a = sin(2 * az);
  const h2x = sin(EL) * cos(az), h2y = sin(EL) * sin(az), h2z = cos(EL);
  const wf = 0.15, wr = 0.85 + 0.3 * mica, ws = 1 + 0.6 * mica, wg = 0.5 + 1.5 * mica, gs = 0.6 * mica;
  lit.fill(0);
  wt.fill(0);
  gl.fill(0);
  // Large flakes glint once Mica brings them in, the flattest first.
  const gcut = E0 * (1.05 - mica), sc = (NS - 1) / (1 - 1 / SMAX);
  for (let p = 0; p < NP; p++) {
    const mp = M0[p], mq = M1[p], mr = M2[p], fro = mp + mr;
    // The stretch s, the root of M's larger eigenvalue, and e1's angle to
    // the strip.
    const dd = mp - mr, an = sqrt(dd * dd + 4 * mq * mq), s1 = sqrt(0.5 * (fro + an));
    const c2 = an > 1e-6 ? (dd * c2a + 2 * mq * s2a) / an : 0;
    const ii = ((s1 > 1 ? 1 - 1 / s1 : 0) * sc + 0.5) | 0, i = ii < NS ? ii : NS - 1, j = ((c2 + 1) * 0.5 * (NC - 1) + 0.5) | 0;
    let val = wf * RF[i] + wr * RR[i] + ws * RS[i * NC + j];
    val *= 1 - gs + gs * kp[p];
    // Into the LED the parcel is over; the blur below spreads it. A large
    // flake's glint stays in its own LED.
    const o = (py[p] | 0) * W + (px[p] | 0), ex = gx[p], ey = gy[p];
    if (ey !== 0 && ex * ex + ey * ey > gcut * gcut) {
      // Its normal is sqrt(M) times its resting tilt; det M = 1, so
      // sqrt(M) = (M + I) / sqrt(trace + 2).
      const is = 1 / sqrt(fro + 2);
      const m0 = ((mp + 1) * ex + mq * ey) * is, m1 = (mq * ex + (mr + 1) * ey) * is, inv = 1 / sqrt(1 + m0 * m0 + m1 * m1);
      const d = abs(h2x * m0 + h2y * m1 + h2z) * inv, d2 = d * d, d4 = d2 * d2, d8 = d4 * d4;
      gl[o] += wg * d8 * d8 * d8;
    }
    lit[o] += val;
    wt[o] += 1;
  }
  // A LED sees a little past its own square: a 1-2-1 blur each way.
  blur(lit, S.tmp);
  blur(wt, S.tmp);
  blur(lit, S.tmp);
  blur(wt, S.tmp);
  // Colours: the oil's body and its sheen, whose brightest light leans a
  // little round the wheel as pearl pigment does.
  const h = S.hue + 0.88, hh = h - floor(h);
  // Deep orange reads brown on the panel and deep yellow olive, so from
  // orange to lime the oil glows instead: 0.82 of full, not 0.34.
  const warm = sm(0.015, 0.05, hh) * (1 - sm(0.3, 0.38, hh));
  const { c0, c1, c2 } = S;
  hsv(h, 0.9 - 0.1 * warm, 0.34 + 0.48 * warm, c0);
  hsv(h - 0.02, 0.42 - 0.12 * warm, 1, c1);
  hsv(h - 0.12, 0.38 - 0.1 * warm, 1, c2);
  const rest = RF[0] * wf + RR[0] * wr + RS[(NC - 1) >> 1] * ws;
  for (let o = 0; o < W * H; o++) {
    // An LED no parcel reached shows flakes at rest.
    const val = (lit[o] + 0.05 * rest) / (wt[o] + 0.05) + gl[o] * 0.5;
    const s = val > 1.4 ? 1.4 : val, fl = val < 0.4 ? 0 : val > 1 ? 1 : (val - 0.4) / 0.6, f = fl * fl * (3 - 2 * fl);
    const sr = c1[0] + (c2[0] - c1[0]) * f, sg = c1[1] + (c2[1] - c1[1]) * f, sb = c1[2] + (c2[2] - c1[2]) * f;
    const body = 1 - 0.55 * (s > 1 ? 1 : s);
    // The brightest sheen runs on toward white.
    const wl = val < 0.75 ? 0 : val > 1.3 ? 1 : (val - 0.75) / 0.55, wh = wl * wl * (1.5 - wl), k = s * 0.85 * (1 - wh);
    const r = 255 * (c0[0] * body + sr * k + wh), g = 255 * (c0[1] * body + sg * k + wh), b = 255 * (c0[2] * body + sb * k + wh);
    display.setPixel(o % W, (o / W) | 0, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
  }
}
