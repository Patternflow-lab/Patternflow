// ===== Patternflow pattern =====
// Title:   Weld Ripples
// Family:  welding
// Idea:    The bead of an arc weld laid across a steel plate seen from above: a white-hot pool under a flickering blue arc crawls along a meandering, weaving line while the plate slides the other way, leaving rows of frozen crescent ripples behind it and, beside it, heat-tint bands of straw, gold, bronze, magenta, blue and grey that are the highest temperature each spot ever reached.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Daniel Rosenthal's solution for a moving point source of heat (1941) and its thin-plate form with surface loss, Nils Christensen with Davies and Gjermundsen on weld isotherms (1965), the temper colours that an oxide film of growing thickness takes on stainless steel, and the pulsed-arc fish-scale of a TIG bead; pattern round 205
// Round:   205
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Travel=1.5..8, Current=60..160, Weave=4..13
//
// Knob 1: Hue. Turns the heat-tint palette round the wheel from the true order it opens on, straw, gold, bronze, magenta, blue, grey, moving outward from the bead; the white-hot pool and the red-orange glow of cooling steel keep their own colour.
// Knob 2: Travel. How fast the torch moves over the plate, from 1.5 LEDs a second, where the ripples sit 2.8 LEDs apart, the tints spread wide and the glowing tail is about 14 LEDs long, to 8 LEDs a second, where they sit 5.7 LEDs apart, the pool stretches into a teardrop and the glow trails past 35 LEDs; it opens at 2.
// Knob 3: Current. The arc current in amperes. At 60 the pool is about 6 LEDs across and the tints reach about 15 LEDs from the bead axis; at 160 the pool is 12 LEDs across and the tints reach past 20, so the halo takes most of the 64 LED width.
// Knob 4: Weave. How far the torch swings from side to side across the seam, from 3 LEDs, a narrow bead with scalloped edges, to 13 LEDs, a wide zigzag whose swings overlap in crescents; the swing takes 3.5 to 9 seconds and wanders.

const W = 64;
const H = 128;
const PS = 2; // plate cells per LED
const MARG = 22; // LEDs of plate kept past every panel edge
const GW = (W + 2 * MARG) * PS;
const GH = (H + 2 * MARG) * PS;
const M2 = MARG * PS;
const NC = GW * GH;
const { floor, sqrt, exp, sin, cos, tanh, abs, min, max, asin, PI, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Excess temperature, in degrees over the plate, at which steel melts.
const TM = 1430;
const T0 = 20;
// Cooling of hot metal after the torch has passed: dE/dt = -C E^3, which is the
// E ~ t^(-1/2) law of a line source in a thin plate.
const COOL = 0.6e-7;
// Surface-loss term of the thin-plate solution and the width the arc melts over.
const LOSS = 0.010;
const R0 = 1.2;

// K0 of the modified Bessel function, times e^z, tabulated (Abramowitz & Stegun 9.8.5 and 9.8.6).
function K0(x) {
  if (x <= 2) {
    const t = x / 3.75, t2 = t * t;
    const I0 = 1 + t2 * (3.5156229 + t2 * (3.0899424 + t2 * (1.2067492 + t2 * (0.2659732 + t2 * (0.0360768 + t2 * 0.0045813)))));
    const y = (x * x) / 4;
    return -log(x / 2) * I0 - 0.57721566 + y * (0.4227842 + y * (0.23069756 + y * (0.0348859 + y * (0.00262698 + y * (0.0001075 + y * 0.0000074)))));
  }
  const y = 2 / x;
  return (exp(-x) / sqrt(x)) * (1.25331414 + y * (-0.07832358 + y * (0.02189568 + y * (-0.01062446 + y * (0.00587872 + y * (-0.0025154 + y * 0.00053208))))));
}
const KN = 4096;
const KZ = 18;
const K0E = new Float32Array(KN + 2);
for (let i = 0; i <= KN + 1; i++) {
  const z = Math.max(0.02, (i * KZ) / KN);
  K0E[i] = K0(z) * exp(z);
}
const KS = KN / KZ;
const k0e = (z) => {
  const f = z * KS;
  const i = f | 0;
  if (i >= KN) return K0E[KN];
  const u = f - i;
  return K0E[i] + (K0E[i + 1] - K0E[i]) * u;
};

// Heat tint: the colour the oxide film takes for the highest temperature reached
// (degrees, absolute). Order is the true one on stainless: straw, gold, bronze,
// magenta, violet, blue, light blue, grey.
const TINT = [
  [200, 0, 0, 0],
  [240, 190, 172, 112],
  [290, 200, 172, 96],
  [335, 228, 164, 34],
  [395, 224, 90, 32],
  [470, 206, 34, 144],
  [600, 40, 92, 240],
  [790, 80, 150, 224],
  [1100, 108, 120, 146],
  [1450, 62, 68, 88],
  [4000, 66, 72, 92],
];
// Incandescence of steel, absolute degrees to light.
const GLOW = [
  [760, 0, 0, 0],
  [840, 64, 3, 0],
  [920, 128, 10, 2],
  [1000, 196, 28, 3],
  [1080, 244, 68, 6],
  [1160, 255, 112, 16],
  [1250, 255, 150, 34],
  [1340, 255, 186, 70],
  [1440, 255, 214, 114],
  [1560, 255, 226, 140],
  [1900, 255, 238, 176],
  [2800, 255, 246, 214],
];
const GN = 520;
const GSTEP = 5;
const GLOWLUT = new Float32Array(GN * 3);
(function () {
  for (let i = 0; i < GN; i++) {
    const T = i * GSTEP + 700;
    let k = 0;
    while (k < GLOW.length - 2 && T > GLOW[k + 1][0]) k++;
    const a = GLOW[k], b = GLOW[k + 1];
    const u = cl((T - a[0]) / (b[0] - a[0]), 0, 1);
    for (let c = 0; c < 3; c++) GLOWLUT[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * u;
  }
})();

const TN = 260;
const TSTEP = 6;
const TLUT = new Float32Array(TN * 4);
function buildTint(L, hue) {
  const th = 2 * PI * hue;
  const c = cos(th), s = sin(th), k = 1 / 3, q = 0.577350269 * s;
  const m00 = c + (1 - c) * k, m01 = (1 - c) * k - q, m02 = (1 - c) * k + q;
  for (let i = 0; i < TN; i++) {
    const T = i * TSTEP + T0;
    let n = 0;
    while (n < TINT.length - 2 && T > TINT[n + 1][0]) n++;
    const a = TINT[n], b = TINT[n + 1];
    const u = cl((T - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * u, g = a[2] + (b[2] - a[2]) * u, bl = a[3] + (b[3] - a[3]) * u;
    let R = m00 * r + m01 * g + m02 * bl;
    let G = m02 * r + m00 * g + m01 * bl;
    let B = m01 * r + m02 * g + m00 * bl;
    R = max(R, 0);
    G = max(G, 0);
    B = max(B, 0);
    const L0 = 0.299 * r + 0.587 * g + 0.114 * bl;
    const L1 = 0.299 * R + 0.587 * G + 0.114 * B + 1e-3;
    let sc = L0 / L1;
    const mx = max(R, G, B) * sc;
    if (mx > 255) sc *= 255 / mx;
    L[i * 4] = R * sc;
    L[i * 4 + 1] = G * sc;
    L[i * 4 + 2] = B * sc;
    L[i * 4 + 3] = sstep(214, 236, T);
  }
}

// Stochastic oscillator: a smooth wander with a period near 2 pi / w and a standard deviation sd.
function osc(o, dt, w, z, sd) {
  const q = 4 * z * w * w * w * sd * sd;
  o.v += (-2 * z * w * o.v - w * w * o.x) * dt + sqrt(q * dt) * gauss();
  o.x += o.v * dt;
}
const MLAM = [170, 100, 60];
const MAMP = [16, 6, 1.5];
const mkosc = (w, z, sd) => ({ x: sd * gauss(), v: sd * w * 0.6 * gauss(), w, z, sd });

const soft = (v, lo, hi) => {
  const m = 0.25 * (hi - lo);
  if (v > hi - m) return hi - m + m * tanh((v - (hi - m)) / m);
  if (v < lo + m) return lo + m - m * tanh((lo + m - v) / m);
  return v;
};

// Cheap lattice noise for the brushed grain of the plate.
function hash2(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function setup(params) {
  const S = {
    t: 0, first: true, k: [0, 2, 60, 4],
    Tpk: new Float32Array(NC), Tcur: new Float32Array(NC), Phi: new Float32Array(NC), Msk: new Float32Array(NC), Fnow: new Float32Array(NC),
    ox: 0, oy: 0, ix0: 0, iy0: 0,
    spd: 2, amp: 60, wv: 3,
    za: mkosc(2 * PI / 190, 0.5, 0.55), zd: 0,
    mph: [6 * Math.random(), 6 * Math.random(), 6 * Math.random()], mll: [0, 0, 0], mla: [gauss(), gauss(), gauss()], ud: gauss(), us: gauss(), uw: gauss(), uf: gauss(),
    wph: Math.random() * 2 * PI, lam: 30, vtot: 2, havePrev2: false,
    pulse: 0, hx: 0, hy: -1, veff: 2,
    mx: 32, my: 40, pmx: 0, pmy: 0, tx: 32, ty: 40, havePrev: false,
    flick: 0, flick2: 0,
    hueBuilt: -9, tl: new Float32Array(TN * 4),
    cx0: new Int32Array(W), cx1: new Int32Array(W), cfx: new Float32Array(W),
    ry0: new Int32Array(H), ry1: new Int32Array(H), rfy: new Float32Array(H),
    aSign: Math.random() < 0.5 ? -1 : 1,
  };
  S.za.x = S.aSign * (0.35 + 0.35 * Math.random());
  params.s = S;
}

function clearCol(S, c) {
  const { Tpk, Tcur, Phi, Msk, Fnow } = S;
  for (let j = 0, i = c; j < GH; j++, i += GW) Tpk[i] = Tcur[i] = Phi[i] = Msk[i] = Fnow[i] = 0;
}
function clearRow(S, r) {
  const a = r * GW, b = a + GW;
  S.Tpk.fill(0, a, b);
  S.Tcur.fill(0, a, b);
  S.Phi.fill(0, a, b);
  S.Msk.fill(0, a, b);
  S.Fnow.fill(0, a, b);
}
const mod = (a, n) => ((a % n) + n) % n;

// The plate is a torus of cells that is a little bigger than the panel. The
// window onto it slides, and the cells that slide out of the far side come
// back bare on the near side.
function slide(S) {
  const nix = floor(S.ox), niy = floor(S.oy);
  while (S.ix0 < nix) { clearCol(S, mod(S.ix0 - M2, GW)); S.ix0++; }
  while (S.ix0 > nix) { clearCol(S, mod(S.ix0 + GW - M2 - 1, GW)); S.ix0--; }
  while (S.iy0 < niy) { clearRow(S, mod(S.iy0 - M2, GH)); S.iy0++; }
  while (S.iy0 > niy) { clearRow(S, mod(S.iy0 + GH - M2 - 1, GH)); S.iy0--; }
}

function path(S, dt) {
  const k = S.k;
  const e = 1 - exp(-dt / 0.8);
  S.spd += (cl(k[1], 1.5, 8) - S.spd) * e;
  S.amp += (cl(k[2], 60, 160) - S.amp) * e;
  S.wv += (cl(k[3], 4, 13) - S.wv) * e;
  // The speed of the plate breathes a little.
  S.us += -S.us / 25 * dt + sqrt(2 / 25 * dt) * gauss();
  const vs = S.spd * exp(0.1 * S.us);
  S.vs0 = vs;
  // The line the plate slides along turns slowly, between straight down and 50 degrees off it.
  osc(S.za, dt, 2 * PI / 190, 0.5, 0.55);
  const a = 0.9 * tanh(S.za.x / 0.9);
  const ex = sin(a), ey = cos(a), nx = cos(a), ny = -sin(a);
  // Where the torch sits along that line and across it. Along, it can move
  // with the plate at up to a third of the plate's speed, never faster.
  S.ud += -S.ud / 5 * dt + sqrt(2 / 5 * dt) * gauss();
  S.zd += (0.35 * vs * tanh(S.ud) - S.zd / 14) * dt;
  // The seam wanders across the plate as three slow waves of different length;
  // their lengths and heights drift, so the line never repeats. Their phase
  // runs with the distance the plate has moved, so the shape does not depend on speed.
  let zl = 0;
  for (let i = 0; i < 3; i++) {
    S.mll[i] += -S.mll[i] / 30 * dt + 0.14 * sqrt(dt) * gauss();
    S.mla[i] += -S.mla[i] / 40 * dt + sqrt(2 / 40 * dt) * gauss();
    const lam = MLAM[i] * exp(cl(S.mll[i], -0.4, 0.4));
    S.mph[i] += (2 * PI * vs * dt) / lam;
    zl += MAMP[i] * exp(0.22 * cl(S.mla[i], -2, 2)) * sin(S.mph[i]);
  }
  const Lh = min(29 / max(abs(ex), 0.05), 60 / max(abs(ey), 0.05));
  const D = 0.62 * Lh;
  const mx = soft(32 - D * ex + zl * nx + S.zd * ex, 6, 58);
  const my = soft(64 - D * ey + zl * ny + S.zd * ey, 8, 120);
  const vpx = vs * ex, vpy = vs * ey;
  if (S.havePrev) {
    // Velocity of the torch over the plate, smoothed: it sets the way the heat field points.
    const vx = (mx - S.pmx) / dt - vpx, vy = (my - S.pmy) / dt - vpy;
    const sp = sqrt(vx * vx + vy * vy) + 1e-6;
    const ke = 1 - exp(-dt / 0.9);
    S.hx += (vx / sp - S.hx) * ke;
    S.hy += (vy / sp - S.hy) * ke;
    const hn = sqrt(S.hx * S.hx + S.hy * S.hy) + 1e-6;
    S.hx /= hn;
    S.hy /= hn;
    S.veff += (cl(sp, 0.5 * vs, 1.6 * vs) - S.veff) * ke;
  } else {
    S.hx = -ex;
    S.hy = -ey;
    S.veff = vs;
  }
  S.pmx = mx;
  S.pmy = my;
  S.havePrev = true;
  S.mx = mx;
  S.my = my;
  // The weave: a zigzag whose wavelength along the seam wanders between 20 and 44 LEDs.
  S.lam += (-(S.lam - 30) / 20) * dt + 1.6 * sqrt(dt) * gauss();
  S.lam = cl(S.lam, 20, 44);
  S.wph += (2 * PI * S.vs0 * dt) / S.lam;
  S.uw += -S.uw / 12 * dt + sqrt(2 / 12 * dt) * gauss();
  const sw = sin(S.wph);
  const wv = 0.55 * sw + 0.45 * (2 / PI) * asin(sw);
  const A = S.wv * cl(0.9 + 0.18 * S.uw, 0.6, 1.2);
  const nhx = -S.hy, nhy = S.hx;
  const ntx = mx + A * wv * nhx, nty = my + A * wv * nhy;
  if (S.havePrev2) {
    const vx = (ntx - S.tx) / dt - vpx, vy = (nty - S.ty) / dt - vpy;
    S.vtot += (sqrt(vx * vx + vy * vy) - S.vtot) * (1 - exp(-dt / 0.25));
  } else S.vtot = vs;
  S.havePrev2 = true;
  S.tx = ntx;
  S.ty = nty;
  S.ox -= 2 * vpx * dt;
  S.oy -= 2 * vpy * dt;
  S.vs = vs;
}

// Heat from the torch at this instant, laid into the plate: the Rosenthal field
// of a moving source in a thin plate with surface loss,
//   T = Q exp(-k x) K0(k' R),  k = v / 2a,  k' = sqrt(k^2 + loss),
// with x along the travel and R the distance to the source. The highest value
// every cell has seen is its peak, and a cell inside the melt is rewritten with
// the phase of the arc pulse, which is what freezes into a ripple.
function stamp(S, dt) {
  const { Tpk, Tcur, Phi, Msk, Fnow } = S;
  // Arc pulses follow the speed of the pool over the plate, so the ripples stay
  // 2.8 to 5.7 LEDs apart along the path however it swings.
  const v = S.veff;
  S.uf += -S.uf / 4 * dt + sqrt(2 / 4 * dt) * gauss();
  const spacing = 2.6 + 0.55 * v;
  S.pulse += (S.vtot / spacing) * exp(0.13 * S.uf) * dt;
  const ph = S.pulse - floor(S.pulse);
  const pp = exp(-4.5 * ph) * 2 - 0.5;
  const kap = 0.04 * v;
  const kp = sqrt(kap * kap + LOSS);
  const Q = (1050 + 280 * v) * (S.amp / 60);
  const hx = S.hx, hy = S.hy;
  const px = S.ox + 2 * S.tx, py = S.oy + 2 * S.ty;
  const BR = 61;
  const lo0 = S.ix0 - M2, lo1 = S.iy0 - M2;
  const ci0 = max(floor(px) - BR, lo0), ci1 = min(floor(px) + BR, lo0 + GW - 1);
  const cj0 = max(floor(py) - BR, lo1), cj1 = min(floor(py) + BR, lo1 + GH - 1);
  const phi = S.pulse;
  for (let cj = cj0; cj <= cj1; cj++) {
    const dy = (cj + 0.5 - py) * 0.5;
    const row = mod(cj, GH) * GW;
    let col = mod(ci0, GW);
    for (let ci = ci0; ci <= ci1; ci++, col = col + 1 === GW ? 0 : col + 1) {
      const dx = (ci + 0.5 - px) * 0.5;
      const d2 = dx * dx + dy * dy;
      const i = row + col;
      if (d2 > 900) {
        Fnow[i] = 0;
        continue;
      }
      const xp = dx * hx + dy * hy;
      const yp = -dx * hy + dy * hx;
      const R = sqrt(d2 + R0 * R0);
      const z = kp * R;
      const F = Q * exp(-kap * xp - z) * k0e(z);
      Fnow[i] = F;
      if (F < 8) continue;
      if (F > Tcur[i]) Tcur[i] = F;
      if (F > Tpk[i]) Tpk[i] = F;
      if (F >= TM) {
        Msk[i] = 1;
        Phi[i] = phi;
      }
    }
  }
}

function cool(S, dt) {
  const { Tcur } = S;
  const c2 = 2 * COOL * dt;
  for (let i = 0; i < NC; i++) {
    const E = Tcur[i];
    if (E > 0) Tcur[i] = E > 3 ? E / sqrt(1 + c2 * E * E) : 0;
  }
}

function advance(S, dt) {
  S.t += dt;
  path(S, dt);
  slide(S);
  cool(S, dt);
  stamp(S, dt);
  S.flick += (-S.flick * 7 * dt) + sqrt(dt) * 5.5 * gauss();
  S.flick2 += (-S.flick2 * 1.5 * dt) + sqrt(dt) * 1.3 * gauss();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 60, 4];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.spd = cl(S.k[1], 1.5, 8);
    S.amp = cl(S.k[2], 60, 160);
    S.wv = cl(S.k[3], 4, 13);
    // Open on a plate that has been welded for as long as the bead takes to cross the panel.
    const T = cl(120 / S.spd, 24, 80);
    for (let t = 0; t < T; t += 0.1) advance(S, 0.1);
    S.first = false;
  }
  advance(S, dt);
}

// Brushed grain, value noise stretched along the brush direction, in plate LEDs.
const BC = cos(0.4), BS = sin(0.4);
function grain(u, v) {
  return vnoise((u * BC + v * BS) * 0.25, (-u * BS + v * BC) * 1.15);
}
function vnoise(s, t) {
  const i = floor(s), j = floor(t);
  let fs = s - i, ft = t - j;
  fs = fs * fs * (3 - 2 * fs);
  ft = ft * ft * (3 - 2 * ft);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * fs + (c - a) * ft + (a - b - c + d) * fs * ft;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { Tpk, Tcur, Phi, Msk, Fnow, tl } = S;
  const hue = S.k[0] || 0;
  if (abs(hue - S.hueBuilt) > 0.001) {
    buildTint(tl, hue);
    S.hueBuilt = hue;
  }
  const ox = S.ox, oy = S.oy;
  for (let x = 0; x < W; x++) {
    const u = ox + 2 * x + 0.5;
    const i0 = floor(u);
    S.cx0[x] = mod(i0, GW);
    S.cx1[x] = mod(i0 + 1, GW);
    S.cfx[x] = u - i0;
  }
  for (let y = 0; y < H; y++) {
    const v = oy + 2 * y + 0.5;
    const j0 = floor(v);
    S.ry0[y] = mod(j0, GH) * GW;
    S.ry1[y] = mod(j0 + 1, GH) * GW;
    S.rfy[y] = v - j0;
  }
  const flare = cl(0.85 + 0.14 * S.flick + 0.08 * S.flick2, 0.45, 1.25);
  const ph = S.pulse - floor(S.pulse);
  const arcBoost = flare * (0.9 + 0.35 * exp(-5 * ph));
  const tx = S.tx, ty = S.ty;
  // The arc stands over the front of the pool.
  const fx = tx + 1.8 * S.hx, fy = ty + 1.8 * S.hy;
  const PR = 34, PG = 42, PB = 58;
  for (let y = 0; y < H; y++) {
    const r0i = S.ry0[y], r1i = S.ry1[y], wy = S.rfy[y];
    const v = (oy + 2 * y + 1) * 0.5;
    for (let x = 0; x < W; x++) {
      const c0 = S.cx0[x], c1 = S.cx1[x], wx = S.cfx[x];
      const i00 = r0i + c0, i01 = r0i + c1, i10 = r1i + c0, i11 = r1i + c1;
      const w00 = (1 - wx) * (1 - wy), w01 = wx * (1 - wy), w10 = (1 - wx) * wy, w11 = wx * wy;
      const tp = Tpk[i00] * w00 + Tpk[i01] * w01 + Tpk[i10] * w10 + Tpk[i11] * w11;
      const u = (ox + 2 * x + 1) * 0.5;
      const gn = grain(u, v);
      let r = PR * (0.84 + 0.32 * gn), g = PG * (0.84 + 0.32 * gn), b = PB * (0.84 + 0.32 * gn);
      if (tp > 12) {
        const tc = Tcur[i00] * w00 + Tcur[i01] * w01 + Tcur[i10] * w10 + Tcur[i11] * w11;
        const m00 = Msk[i00] * w00, m01 = Msk[i01] * w01, m10 = Msk[i10] * w10, m11 = Msk[i11] * w11;
        const ms = m00 + m01 + m10 + m11;
        // Tint of the oxide film, by the peak.
        // The film is a little thicker here and thinner there, so band edges wander.
        const tq = tp * (1 + 0.12 * (vnoise(u * 0.09 + 7.3, v * 0.09 + 2.1) - 0.5));
        const ti = min(TN - 1, (tq / TSTEP) | 0);
        // The film forms once the metal has begun to cool, that is, once the field
        // at this spot has fallen below its peak: ahead of the torch there is no tint.
        const fn = Fnow[i00] * w00 + Fnow[i01] * w01 + Fnow[i10] * w10 + Fnow[i11] * w11;
        const ta = tl[ti * 4 + 3] * (1 - sstep(0.8, 0.93, fn / tp));
        if (ta > 0) {
          const gm = 0.86 + 0.28 * gn;
          r += (tl[ti * 4] * gm - r) * ta;
          g += (tl[ti * 4 + 1] * gm - g) * ta;
          b += (tl[ti * 4 + 2] * gm - b) * ta;
        }
        let sh = 1, sv = 0.5;
        if (ms > 0.01) {
          const phs = (m00 * Phi[i00] + m01 * Phi[i01] + m10 * Phi[i10] + m11 * Phi[i11]) / ms;
          const th = 2 * PI * (phs - floor(phs));
          const fade = sstep(TM, 2.2 * TM, tp);
          let s = 0.5 + 0.5 * (cos(th) + 0.3 * cos(2 * th - 0.9)) / 1.3;
          s *= s;
          sv = (0.25 + 0.75 * fade) * s;
          sh = 0.48 + 1.0 * sv;
          const k = min(1, ms);
          const bm = (0.9 + 0.2 * gn) * sh;
          r += (150 * bm - r) * k;
          g += (162 * bm - g) * k;
          b += (186 * bm - b) * k;
        }
        if (tc > 700) {
          // Ripples that have just frozen: crests run hotter than the troughs between them.
          const te = tc * (ms > 0.5 ? 1 + (0.96 + 0.16 * sv - 1) * (1 - sstep(1250, 1550, tc)) : 1);
          const gi = cl(((te + T0 - 700) / GSTEP) | 0, 0, GN - 1) * 3;
          const gx = sstep(760, 980, te + T0);
          r = r * (1 - gx * 0.92) + GLOWLUT[gi] * gx;
          g = g * (1 - gx * 0.92) + GLOWLUT[gi + 1] * gx;
          b = b * (1 - gx * 0.92) + GLOWLUT[gi + 2] * gx;
        }
      }
      // The arc: a blue-white core and a corona that flickers, laid over with a screen blend.
      const dxa = x + 0.5 - fx, dya = y + 0.5 - fy;
      const da = dxa * dxa + dya * dya;
      if (da < 150) {
        const core = min(1, exp(-da / 2.2) * arcBoost);
        const cor = exp(-da / 14) * arcBoost * 0.75;
        const hal = exp(-da / 60) * flare * 0.6;
        const fr = min(1, core * 0.92 + cor * 0.36 + hal * 0.14);
        const fg = min(1, core * 0.96 + cor * 0.55 + hal * 0.26);
        const fb = min(1, core + cor * 0.95 + hal * 0.62);
        r = 255 - ((255 - r) * (1 - fr));
        g = 255 - ((255 - g) * (1 - fg));
        b = 255 - ((255 - b) * (1 - fb));
      }
      display.setPixel(x, y, min(255, r), min(255, g), min(255, b));
    }
  }
}
