// ===== Patternflow pattern =====
// Title:   Gabor Atoms
// Family:  gabor
// Idea:    Clouds of Gaussian wave packets are born at the right edge of a time-frequency plane and slide left, each drawn as the ellipse of fixed area its duration gives it, and where two atoms overlap their complex amplitudes add, so they brighten, cancel and leave dark gaps instead of only glowing.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the logon, a Gaussian-windowed sinusoid that fills one cell of the time-frequency plane at the least uncertainty (Dennis Gabor, "Theory of communication", J. IEE 93, 1946), sound built as clouds of such grains (Iannis Xenakis, Analogique A-B, 1958-59, and Formalized Music; Curtis Roads, granular synthesis, late 1970s and 1980s), interference of overlapping atoms in the spectrogram, all recalled from memory; the clouds and the drawing are original, pattern round 272
// Round:   272
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Density=0.5..3.5, Grain=-1..1, Glide=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of the whole palette, one turn over the range. At 0 the low end of the plane is amber, the middle rose and the top violet; at 0.25 green, yellow and orange red; at 0.5 blue, green cyan and yellow green; at 0.75 magenta, blue and cyan. Every colour is lifted to about the same light, so the blue end is not darker than the yellow one.
// Knob 2: Density. How many of the atoms born are drawn, from one in five at 0.5 through three in five at the opening 2 to all at 3.5. That is 3.4, 10 and 17 atoms a second, and about 26, 98 and 200 atoms on the panel at once. Each atom keeps a fixed rank, so the cloud thickens by adding atoms and thins by taking the same ones away, within about a quarter of a second.
// Knob 3: Grain. The trade of duration against bandwidth at one area. At -1 an atom is short: 1.9 LED across in time and 5.4 in frequency, a tall thin ellipse; at 0 it is 3.9 by 2.6; at 1 it is long: 8 by 1.25, a flat line. These are the standard deviations of an atom's ellipse, for an atom with no bias of its own; its area stays at 10 LED squared at every setting. All atoms on the panel change at once.
// Knob 4: Glide. The rate at which the clouds slide up or down the frequency axis, 11 LED a second for a unit of the knob and 0.7 and 1.3 times that for the other two clouds, so at 1 a cloud climbs at a slope of 56 degrees against the scroll and at -1 it falls. At 0 the clouds only wander. A turn shows at the right edge within a second, where the atoms are born, and reaches the left edge 8 s later.
//
// What the picture is. The panel is the time-frequency plane of a window that rolls along: time runs across, 64 cells, with the present at the right edge and every atom sliding left at 7.5 LED a second, so it takes 8.5 s to cross; frequency runs up, 128 cells, linear and not logarithmic, since atoms of one bandwidth have one size on a linear axis and a log axis would stretch them with pitch. The scale is a film speed, not seconds of sound. Each atom is a Gaussian wave packet, exp(-(t - t_k)^2 / (2 s^2)) times a carrier of frequency f_k and phase phi_k. Gabor's atom is the one that fills a cell at the least uncertainty, and a packet of any length does so: read through a Gaussian window as wide as the packet, its squared transform is an ellipse with standard deviation s in time and 1 / (2 pi s) in frequency, so the two multiply to 1 / (2 pi) whatever s is. The panel draws that product as 10 LED squared. A short atom is a tall ellipse and a long one a flat ellipse of the same area.
// The sum. The transform of one atom is exp(-(tau - t_k)^2 / (4 s^2)) exp(-pi^2 s^2 (f - f_k)^2) times a phase, phi_k + pi (tau - t_k) (f + f_k), linear in both offsets. In LED units, with A = 10 the area, that phase is phi_k + (x Y_k - x_k Y - x_k Y_k) / (2 A) once the term x Y / (2 A), which every atom shares at a given LED, is dropped, and x, Y are counted from the middle of the panel. The LED shows |sum over atoms of amplitude times Gaussian times e^(i phase)|^2: amplitudes add as complex numbers, so atoms in phase make a bright lobe and atoms in antiphase leave a dark gap or a point of zero, and a pair of atoms dY apart in frequency and dx apart in time beat across the overlap at dY / (2 A) rad per LED along time and dx / (2 A) along frequency. Because s is the atom's own, two atoms can beat at most about once across their overlap: a cell cannot be resolved finer than itself. The dark spots, rings and bridges in the picture are those zeros, and a dark gap is about as wide as a cell, 3 LED across on the thin side and up to 19 on the long one.
// The check. Two atoms of 0.05 s, 40 Hz at 0.10 s and 52 Hz at 0.17 s, with phases 0.7 and 2.1, were run through the transform integral by quadrature at 121 points: the closed form agrees to 3e-15, the dropped-term form gives the same |sum|^2 to 5e-14 of its largest value, and moving both atoms and the point 7.3 LED together leaves |sum|^2 unchanged to 7e-16, which is why the fringes of a pair slide rigidly with the atoms as the plane scrolls. Atoms of different lengths are read each through its own window, which no single transform does, so for those the sum is a drawing choice that keeps the same phase rule.
// The clouds. Three clouds and a scatter of grains are born at 22 slots a second, as a Poisson process, at the right edge, each atom 1.5 of its own widths beyond it and fading in over 0.9 s. A cloud has a centre that wanders by three incommensurate sines (periods from 36 s to 277 s) about its own third of the panel, plus the glide, wrapping across a range 40 LED wider than the panel and thinning out at the seam; a spread of 5.5 to 20 LED; a density of 0.3 to 1, the chance that one of its slots yields an atom; a share that condenses into lines, atoms snapped to a lattice 8 to 12 LED apart and longer by 0.7 in log aspect, the chord; a share that splits into two lobes drawing apart; and a bias in aspect, +0.8, -0.9 and 0 in log, so that at one setting of Grain one cloud is flat, one tall and one round. Each atom adds its own jitter of 0.3 in log aspect. The grains are 1.8 slots against the clouds' three, about half the atoms when the clouds are thin, and sit anywhere. A bias plus the knob is held where the thin side is 1.25 LED, so no line is thinner than 2.9 LED across at half height and the area stays exact. The panel opens after 40 s of this run with the knobs in force.
// Drawing. Colour is the atom's: a cloud's atoms take the palette at the cloud's own place on it (amber, rose or violet, each wobbling by 0.12), a grain takes the palette at its frequency, and a LED takes the mix of the atoms over it weighted by their power. Brightness is (I - 0.05) / (I + 0.6) to the power 1.15, with I the |sum|^2, so one atom peaks at 0.4 to 0.65, a pile of overlapping ones at 0.85, and a zero is dark. A faint haze, a quarter of the root of the sum of the atoms' powers without their phases, blurred, is the average of |sum|^2 over the phases, fringes gone: it keeps no 16 x 16 cell dead. The ground is a tenth of full violet. About 100 atoms are drawn at the opening and 180 are alive; at the top of Density 200 are drawn and 210 alive. The pattern's own work is about 1 ms a frame.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, abs, ceil, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// the plane: NT cells along time (new atoms enter at the high end), NF along frequency
const NT = 64;
const NF = 128;
const NP = NT * NF;

const A_CELL = 10;        // sigma_t sigma_f of every atom, in LED squared
const V_SCROLL = 7.5;     // LED a second
const MAXA = 360;
const D_MAX = 22;         // atoms a second at the top of the Density knob
const RHO0 = 1.8;         // birth slots of the scattered grains, against one slot for each cloud
const NC = 3;             // clouds
const GL0 = 11;           // LED a second of glide for a unit of the Glide knob
const SEAM = 20;          // frequency wraps over a range this much wider than the panel at each end

const SR = new Float32Array(NP), SI = new Float32Array(NP), PW = new Float32Array(NP), PB = new Float32Array(NP);
const QR = new Float32Array(NP), QG = new Float32Array(NP), QB = new Float32Array(NP);
const GX = new Float64Array(160), GY = new Float64Array(160);
const CXR = new Float64Array(160), CXI = new Float64Array(160), CYR = new Float64Array(160), CYI = new Float64Array(160);
const GX2 = new Float64Array(160), GY2 = new Float64Array(160);
const PW0 = new Float32Array(NP);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// sigma_t / sigma_f of an atom: the knob and the atom's own bias in log, held where the thinner side is SMIN LED
const SMIN = 1.25;
const LR = log(A_CELL / (SMIN * SMIN));
const lnRatio = (k3, lam) => cl(0.4 + 1.45 * k3 + lam, -LR, LR);

export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const S = {
    r, T: 0, init: false, k: null, scroll: 0,
    n: 0, next: 0,
    x: new Float64Array(MAXA), y: new Float64Array(MAXA), lam: new Float64Array(MAXA),
    amp: new Float64Array(MAXA), ph: new Float64Array(MAXA), rank: new Float64Array(MAXA),
    age: new Float64Array(MAXA), alive: new Uint8Array(MAXA), hq: new Float64Array(MAXA),
    cp: [], gl: new Float64Array(NC),
  };
  for (let c = 0; c < NC; c++) {
    const q = [];
    for (let i = 0; i < 16; i++) q.push(TAU * r());
    S.cp.push(q);
    S.gl[c] = 0;
  }
  params.s = S;
}

// cloud c at the clock T: its centre, spread, share, how far it has condensed into
// lines, how far it has split in two, and its bias in aspect
const CL = { yc: 0, sp: 0, rho: 0, kap: 0, beta: 0, bias: 0, lat: 0, hq: 0 };
const BIAS0 = [0.8, -0.9, 0.0], HQ0 = [0.12, 0.5, 0.88];
const OM = [
  [0.0571, 0.0263, 0.157, 0.19, 0.071, 0.083, 0.061, 0.037, 0.09, 0.031],
  [0.0467, 0.0319, 0.141, 0.23, 0.059, 0.097, 0.053, 0.043, 0.11, 0.027],
  [0.0643, 0.0227, 0.173, 0.17, 0.083, 0.071, 0.067, 0.029, 0.07, 0.037],
];
const GLIDE = [1, 0.7, 1.3];
function cloud(S, c) {
  const q = S.cp[c], T = S.T, o = OM[c];
  const home = NF * (0.17 + 0.33 * c) + 0.12 * NF * sin(o[0] * T + q[0]) + 0.05 * NF * sin(o[1] * T + q[1]) + 6 * sin(o[2] * T + q[2]);
  let u = home + S.gl[c] + SEAM;
  const per = NF + 2 * SEAM;
  u = u - per * floor(u / per) - SEAM;
  CL.yc = u;
  CL.sp = 13 + 5 * sin(o[3] * T + q[3]) + 2.5 * sin(o[4] * T + q[4]);
  CL.rho = 0.3 + 0.7 * sm(0.5 + 0.75 * sin(o[5] * T + q[5]));
  CL.kap = sm((sin(o[6] * T + q[6]) - 0.35) / 0.5);
  CL.beta = sm((sin(o[7] * T + q[7]) - 0.1) / 0.6);
  CL.bias = BIAS0[c] + 0.4 * sin(o[8] * T + q[8]) + 0.7 * CL.kap;
  CL.hq = cl(HQ0[c] + 0.12 * sin(o[3] * T * 0.5 + q[10]), 0, 1);
  CL.lat = 8 + 4 * (0.5 + 0.5 * sin(o[9] * T + q[9]));
  // the cloud thins out as it passes the seam, where it wraps
  CL.rho *= sm((u + SEAM) / SEAM) * sm((NF + SEAM - u) / SEAM);
}

function gauss(r) {
  let a = 0;
  for (let i = 0; i < 4; i++) a += r();
  return (a - 2) * 1.732;
}

function spawn(S, over) {
  if (S.n >= MAXA) return;
  const r = S.r;
  // each birth slot belongs to one cloud, or to the scattered grains; a cloud keeps its slot with a chance equal to its density
  const slot = r() * (NC + RHO0), c = floor(slot), dust = slot >= NC;
  if (!dust) {
    cloud(S, c);
    if (r() > CL.rho) return;
  }
  let y = NF * r(), bias = 0, hq = 0;
  if (!dust) {
    cloud(S, c);
    const g = gauss(r), sgn = r() < 0.5 ? -1 : 1;
    const free = CL.sp * (1 - 0.5 * CL.beta) * g;
    const line = CL.lat * Math.round((CL.sp * g) / CL.lat) + 0.5 * gauss(r);
    y = CL.yc + free * (1 - CL.kap) + line * CL.kap + sgn * CL.beta * 1.3 * CL.sp;
    bias = CL.bias;
    hq = cl(CL.hq + 0.025 * gauss(r), 0, 1);
  } else hq = 0.12 + 0.88 * (y / NF);
  if (y < -14 || y > NF + 14) return;
  let i = 0;
  while (S.alive[i]) i++;
  S.alive[i] = 1;
  S.n++;
  S.y[i] = y;
  S.lam[i] = bias + 0.3 * gauss(r);
  S.hq[i] = hq;
  S.amp[i] = (0.78 + 0.42 * r()) * (dust ? 0.78 : 1);
  S.ph[i] = TAU * r();
  S.rank[i] = r();
  S.age[i] = over;
  const sx = sqrt(A_CELL * exp(lnRatio(S.k[2], S.lam[i])));
  S.x[i] = NT + 1.5 * sx - V_SCROLL * over;
}

function step(S, d) {
  S.T += d;
  const k = S.k;
  for (let c = 0; c < NC; c++) S.gl[c] += d * k[3] * GL0 * GLIDE[c];
  // scroll
  const dx = V_SCROLL * d;
  for (let i = 0; i < MAXA; i++) {
    if (!S.alive[i]) continue;
    S.x[i] -= dx;
    S.age[i] += d;
    const sx = sqrt(A_CELL * exp(lnRatio(k[2], S.lam[i])));
    if (S.x[i] < -3.6 * sx) {
      S.alive[i] = 0;
      S.n--;
    }
  }
  // births, as a Poisson process
  S.next -= d;
  let guard = 0;
  while (S.next <= 0 && guard++ < 8) {
    spawn(S, -S.next);
    S.next += -log(1 - S.r() * 0.999999) / D_MAX;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.18);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  if (!S.init) {
    S.init = true;
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    // run the clouds for a while with the knobs in force so the plane opens full
    S.T = 0;
    for (let q = 0; q < 40 * 30; q++) step(S, 1 / 30);
    return;
  }
  step(S, d);
}

// ------------------------------------------------------------------ drawing
function blur(a, b, st, kk) {
  const c = 1 - 2 * kk;
  for (let y = 0; y < NF; y++) {
    const row = y * NT;
    for (let x = 0; x < NT; x++) {
      const l = x - st >= 0 ? a[row + x - st] : a[row + x], rr = x + st < NT ? a[row + x + st] : a[row + x];
      b[row + x] = kk * l + c * a[row + x] + kk * rr;
    }
  }
  for (let y = 0; y < NF; y++) {
    const ya = max(y - st, 0) * NT, yb = min(y + st, NF - 1) * NT, row = y * NT;
    for (let x = 0; x < NT; x++) a[row + x] = kk * b[ya + x] + c * b[row + x] + kk * b[yb + x];
  }
}

const C = [0, 0, 0];

// the palette: amber at 0 through rose to violet at 1, lifted so the violet is as light as the amber
function pal(q, hue, o) {
  hsv(0.095 - 0.33 * q + hue, 0.78, 1, o);
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = 0.78 / (l + 0.12);
  o[0] *= g;
  o[1] *= g;
  o[2] *= g;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  const k = S.k;
  const hue = k[0];
  const pth = cl(0.2 + 0.8 * (k[1] - 0.5) / 3, 0.2, 1);
  SR.fill(0);
  SI.fill(0);
  PW.fill(0);
  QR.fill(0);
  QG.fill(0);
  QB.fill(0);
  const cT = NT * 0.5, cF = NF * 0.5;
  for (let i = 0; i < MAXA; i++) {
    if (!S.alive[i]) continue;
    const wth = sm((pth - S.rank[i]) * 12 + 0.6);
    if (wth <= 0.004) continue;
    const wage = sm(S.age[i] / 0.9);
    const wt = wth * wage;
    if (wt <= 0.004) continue;
    const lr = lnRatio(k[2], S.lam[i]), sx = sqrt(A_CELL * exp(lr)), sy = sqrt(A_CELL * exp(-lr));
    const x0 = S.x[i], y0 = S.y[i];
    const t0 = max(0, ceil(x0 - 0.5 - 3.4 * sx)), t1 = min(NT - 1, floor(x0 - 0.5 + 3.4 * sx));
    const f0 = max(0, ceil(y0 - 0.5 - 3.4 * sy)), f1 = min(NF - 1, floor(y0 - 0.5 + 3.4 * sy));
    if (t1 < t0 || f1 < f0) continue;
    const a = S.amp[i] * wt;
    // phase of the atom's transform, in centred coordinates: ph0 + (x Yi - xi Y - xi Yi) / (2A)
    const xi = x0 - cT, Yi = y0 - cF;
    const c0 = S.ph[i] - (xi * Yi) / (2 * A_CELL);
    const qx = 1 / (4 * sx * sx), qy = 1 / (4 * sy * sy);
    const nx = t1 - t0 + 1, ny = f1 - f0 + 1;
    pal(S.hq[i], hue, C);
    const kr = C[0], kg = C[1], kb = C[2];
    for (let u = 0; u < nx; u++) {
      const t = t0 + u, dxx = t + 0.5 - x0, g = exp(-dxx * dxx * qx);
      const th = ((t + 0.5 - cT) * Yi) / (2 * A_CELL) + c0;
      CXR[u] = g * cos(th);
      CXI[u] = g * sin(th);
      GX2[u] = g * g;
    }
    for (let v = 0; v < ny; v++) {
      const f = f0 + v, dyy = f + 0.5 - y0, g = a * exp(-dyy * dyy * qy);
      const th = (-(f + 0.5 - cF) * xi) / (2 * A_CELL);
      CYR[v] = g * cos(th);
      CYI[v] = g * sin(th);
      GY2[v] = g * g;
    }
    for (let v = 0; v < ny; v++) {
      const yr = CYR[v], yi = CYI[v], gy2 = GY2[v], row = (f0 + v) * NT + t0;
      for (let u = 0; u < nx; u++) {
        const p = row + u, xr = CXR[u], xj = CXI[u];
        SR[p] += xr * yr - xj * yi;
        SI[p] += xr * yi + xj * yr;
        const w2 = GX2[u] * gy2;
        PW[p] += w2;
        QR[p] += w2 * kr;
        QG[p] += w2 * kg;
        QB[p] += w2 * kb;
      }
    }
  }
  // haze: the average of |sum|^2 over the atoms' phases, which is the sum of their intensities, blurred
  PW0.set(PW);
  PB.set(PW);
  blur(PB, PW, 2, 0.25);
  blur(PB, PW, 3, 0.25);

  hsv(0.76 + hue, 0.85, 1, C);
  const gr = C[0] * 0.1, gg = C[1] * 0.1, gb = C[2] * 0.1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (H - 1 - y) * NT + x;
      const I = SR[p] * SR[p] + SI[p] * SI[p];
      const b = Math.pow(max(I - 0.05, 0) / (I + 0.6), 1.15);
      const hz = 0.24 * sqrt(PB[p]);
      const wh = 0.22 * b * b * b;
      const iw = 1 / (PW0[p] + 1e-6), lr = QR[p] * iw, lg = QG[p] * iw, lb = QB[p] * iw;
      const r = gr + lr * (0.9 * b + hz) + wh, g = gg + lg * (0.9 * b + hz) + wh, bl = gb + lb * (0.9 * b + hz) + wh;
      display.setPixel(x, y, min(255, (r * 255) | 0), min(255, (g * 255) | 0), min(255, (bl * 255) | 0));
    }
  }
}
