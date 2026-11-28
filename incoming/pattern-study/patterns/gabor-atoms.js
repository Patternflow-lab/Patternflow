// ===== Patternflow pattern =====
// Title:   Gabor Atoms
// Family:  gabor
// Idea:    Gaussian wave packets are born at the right edge of a time-frequency plane in glissando strings, chords and tall bursts and slide left, each drawn as an outlined ellipse of fixed area whose length in time sets its height in frequency, and where two atoms touch their complex amplitudes add, so a bridge, a ring or a dark gap appears there.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the logon, a Gaussian-windowed sinusoid that fills one cell of the time-frequency plane at the least uncertainty (Dennis Gabor, "Theory of communication", J. IEE 93, 1946), sound built as clouds of such grains with glissandi and chords (Iannis Xenakis, Analogique A-B, 1958-59, and Formalized Music; Curtis Roads, granular synthesis, late 1970s and 1980s), interference of overlapping atoms in the spectrogram, all recalled from memory; the voices and the drawing are original, pattern round 272
// Round:   272
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Density=0.5..3.5, Grain=-1..1, Glide=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of all three kinds of atom, one turn over the range. At 0 the glissando strings are gold, the chords rose and the bursts violet; at 0.25 green, yellow and red orange; at 0.5 blue, green cyan and yellow green; at 0.75 magenta, blue and cyan. Each colour is lifted to about the same light.
// Knob 2: Density. How close the atoms of a string or a chord are born, as a share of the closest, 2 widths apart: 0.14 at 0.5, 0.44 at the opening 2 and 1 at 3.5. The spacing is 14, 4.5 and 2 widths of an atom. At 0.5 a string is a few beads far apart (16 atom centres on the panel), at the opening 30 separate ellipses, and at 3.5 they run together into ribbons with fringes (52). It shows at the right edge within a second and fills the panel in 8.5 s.
// Knob 3: Grain. The trade of duration against bandwidth at one area. A glissando atom is 1.6 LED across in time and 4.5 in frequency at -1 (a tall ellipse), 3.2 by 2.2 at 0 and 5.6 by 1.25 at 1 (a flat one), as standard deviations; chords are flatter and bursts taller by a fixed bias at every setting, so one frame holds all three shapes. The area stays 7 LED squared. All atoms on the panel change at once.
// Knob 4: Glide. The slope of the glissando strings in frequency, 11 LED a second for a unit of the knob (0.8 to 1.25 times that for each string) on top of the string's own slope of up to 2.5 LED a second either way. At 1 a string climbs at about 55 degrees against the 7.5 LED a second scroll and at -1 it falls; at 0 the strings keep their own gentle slopes. Chords stay at their frequencies and bursts do not move. A turn shows where atoms are born, at the right edge, within a second, and reaches the left edge 8.5 s later.
//
// What the picture is. The panel is the time-frequency plane of a window that rolls along: time runs across, 64 cells, with the present at the right edge and every atom sliding left at 7.5 LED a second, so it takes 8.5 s to cross; frequency runs up, 128 cells, linear and not logarithmic, since atoms of one bandwidth have one size on a linear axis and a log axis would stretch them with pitch. The scale is a film speed, not seconds of sound. Each atom is a Gaussian wave packet, exp(-(t - t_k)^2 / (2 s^2)) times a carrier of frequency f_k and phase phi_k. Gabor's atom is the one that fills a cell at the least uncertainty, and a packet of any length does so: read through a Gaussian window as wide as the packet, its squared transform is an ellipse with standard deviation s in time and 1 / (2 pi s) in frequency, so the two multiply to 1 / (2 pi) whatever s is. The panel draws that product as 7 LED squared. A short atom is a tall ellipse and a long one a flat ellipse of the same area.
// The sum. The transform of one atom is exp(-(tau - t_k)^2 / (4 s^2)) exp(-pi^2 s^2 (f - f_k)^2) times a phase, phi_k + pi (tau - t_k) (f + f_k), linear in both offsets. In LED units, with A = 7 the area, that phase is phi_k + (x Y_k - x_k Y - x_k Y_k) / (2 A) once the term x Y / (2 A), which every atom shares at a given LED, is dropped, and x, Y are counted from the middle of the panel. The LED shows |sum over atoms of amplitude times Gaussian times e^(i phase)|^2: amplitudes add as complex numbers, so atoms in phase make a bright bridge and atoms in antiphase leave a dark gap or a point of zero. A pair of atoms dY apart in frequency and dx apart in time beat across their overlap at dY / (2 A) rad per LED along time and dx / (2 A) along frequency. Because s is the atom's own, two atoms can beat at most about once across their overlap: a cell cannot be resolved finer than itself. So the structure the sum makes is a bridge between two beads, a ring or a hole where three meet, a notch in a chord: as wide as a cell, 2.9 LED across on the thin side.
// The check. Two atoms of 0.05 s, 40 Hz at 0.10 s and 52 Hz at 0.17 s, with phases 0.7 and 2.1, were run through the transform integral by quadrature at 121 points: the closed form agrees to 3e-15, the dropped-term form gives the same |sum|^2 to 5e-14 of its largest value, and moving both atoms and the point 7.3 LED together leaves |sum|^2 unchanged to 7e-16, which is why the fringes of a pair slide rigidly with the atoms as the plane scrolls. Atoms of different lengths are read each through its own window, which no single transform does, so for those the sum is a drawing choice that keeps the same phase rule.
// The voices. Fourteen voices take turns, each playing one structure and then resting 0.3 to 2.3 s; at most eight play at once. A glissando string (6 to 13 s) is one atom after another along a path whose slope wanders by a sine of period 7.6 s and amplitude 2.7 LED about its own slope and the Glide knob; at most six at once. A chord (6 to 12 s) is two to four lines at fixed frequencies 9 to 14 LED apart, or 3.9 heights, atoms in aligned columns, which is a patch of Gabor's lattice; the lines are the harmonics of one fundamental, which sit at equal spacing on a linear axis; one at a time. A burst is one to three columns of three or four tall atoms stacked 4.6 heights apart, one at a time. A new structure goes where the most room is, the best of eight tries, and waits if the band is more than 3 LED short (8 LED once in eight, so a few overlap). Strings are gold, chords rose and bursts violet; a chord atom is flatter and a burst atom taller by 0.8 and 0.9 in log aspect. Atoms are born 3.4 widths beyond the right edge, out of sight, 2 widths apart over the Density share, and a pair a little closer than 3.7 widths touches. The panel opens after 40 s of this run with the knobs in force.
// Drawing. Each atom has amplitude 1, so one atom is an ellipse with the same edge whatever its colour. The brightness is a body where the intensity I passes 0.18 (1.85 widths out), a rim where it passes 0.3 and a little extra where atoms add: 0.38 smoothstep((I - 0.18) / 0.2) + 0.07 min(I, 2.5) + 0.52 exp(-((I - 0.3) / 0.11)^2), so each atom is a ring with a body and a glow, and a hole where two cancel has its own ring. A LED takes the mix of the colours of the atoms over it, weighted by their power. A faint haze, 0.16 times the root of the sum of the atoms' powers without their phases, blurred, is the average of |sum|^2 over the phases, fringes gone, and the ground is 0.15 of full violet; both keep the gaps between structures from going dead. About 30 atom centres are on the panel at the opening and 41 are alive, 52 and 83 at the top of Density; the pattern's own work is 0.4 ms a frame.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, ceil, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// the plane: NT cells along time (new atoms enter at the high end), NF along frequency
const NT = 64;
const NF = 128;
const NP = NT * NF;

const A_CELL = 7;         // sigma_t sigma_f of every atom, in LED squared
const SMIN = 1.25;        // the thin side of an atom is never thinner than this, in sigma
const LR = log(A_CELL / (SMIN * SMIN));
const V_SCROLL = 7.5;     // LED a second
const MAXA = 320;
const NV = 14;            // voices: each plays one structure at a time
const GL0 = 11;           // LED a second of glide for a unit of the Glide knob
const SPF = 2.0;          // spacing of atoms along a stream or a chord at full density, in sigma_t
const BIRTH = 3.4;        // an atom is born this many sigma_t beyond the right edge, out of sight
// stream, chord, burst: bias of the atoms' log aspect, and their hue
const BIAS = [0, 0.8, -0.9];
const HUE = [0.105, 0.945, 0.78];

const SR = new Float32Array(NP), SI = new Float32Array(NP), PW = new Float32Array(NP), PB = new Float32Array(NP);
const QR = new Float32Array(NP), QG = new Float32Array(NP), QB = new Float32Array(NP);
const PW0 = new Float32Array(NP);
const CXR = new Float64Array(160), CXI = new Float64Array(160), CYR = new Float64Array(160), CYI = new Float64Array(160);
const GX2 = new Float64Array(160), GY2 = new Float64Array(160);

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

function gauss(r) {
  let a = 0;
  for (let i = 0; i < 4; i++) a += r();
  return (a - 2) * 1.732;
}

// sigma_t / sigma_f of an atom, in log: the knob and the atom's own bias, held where the thinner side is SMIN LED
const lnRatio = (k3, lam) => cl(0.4 + 1.45 * k3 + lam, -LR, LR);
const sxOf = (k3, lam) => sqrt(A_CELL * exp(lnRatio(k3, lam)));
const syOf = (k3, lam) => sqrt(A_CELL * exp(-lnRatio(k3, lam)));

export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const S = {
    r, T: 0, init: false, k: null, n: 0,
    x: new Float64Array(MAXA), y: new Float64Array(MAXA), lam: new Float64Array(MAXA),
    amp: new Float64Array(MAXA), ph: new Float64Array(MAXA),
    hh: new Float64Array(MAXA), alive: new Uint8Array(MAXA),
    vo: [], free: 0,
  };
  for (let v = 0; v < NV; v++) S.vo.push({ st: 0, t: 0.5 + 6 * r(), y: 0, yc: 0, h: 0, sl: 0, gk: 1, ph: 0, gap: 0, n: 1, L: 10, nb: 0, m: 4,  });
  params.s = S;
}

function add(S, x, y, type, lam) {
  if (S.n >= MAXA) return;
  const r = S.r;
  let i = 0;
  while (S.alive[i]) i++;
  S.alive[i] = 1;
  S.n++;
  S.x[i] = x;
  S.y[i] = y;
  S.lam[i] = BIAS[type] + lam;
  S.amp[i] = 1 + 0.06 * (r() - 0.5);
  S.ph[i] = TAU * r();
  S.hh[i] = HUE[type] + 0.015 * gauss(r);
}

// the share of full density that the Density knob asks for: atoms are spaced SPF sigma_t / this apart
const density = (k2) => 0.14 + 0.86 * Math.pow(cl((k2 - 0.5) / 3, 0, 1), 1.5);

// where a new structure goes: the best of a few tries, as far as it can be from the structures that are playing
function place(S, v, h) {
  const r = S.r;
  let best = 60, bd = -1e9;
  for (let q = 0; q < 8; q++) {
    const y = 14 + 100 * r();
    let d = 1e9;
    for (const o of S.vo) if (o !== v && o.st) d = min(d, Math.abs(o.yc - y) - o.h - h);
    if (d > bd) {
      bd = d;
      best = y;
    }
  }
  S.free = bd;
  return best;
}

function start(S, v) {
  const r = S.r, k = S.k;
  // streams are many, a chord and a burst one each at a time
  const cnt = [0, 0, 0, 0];
  for (const o of S.vo) cnt[o.st]++;
  const w1 = cnt[1] < 6 ? 0.5 : 0, w2 = cnt[2] ? 0 : 0.3, w3 = cnt[3] ? 0 : 0.2;
  const u = r() * (w1 + w2 + w3);
  v.st = u < w1 ? 1 : u < w1 + w2 ? 2 : 3;
  v.gap = 0;
  if (v.st === 1) {
    v.t = 6 + 7 * r();
    v.sl = (r() - 0.5) * 5;
    v.gk = 0.8 + 0.45 * r();
    v.ph = TAU * r();
    v.h = 1.85 * syOf(k[2], BIAS[0]) + 6;
    v.y = place(S, v, v.h);
    v.yc = v.y;
  } else if (v.st === 2) {
    v.t = 6 + 6 * r();
    v.L = max(9 + 5 * r(), 3.9 * syOf(k[2], BIAS[1]));
    v.n = min(2 + floor(3 * r()), 1 + floor(100 / v.L));
    v.h = 0.5 * (v.n - 1) * v.L + 5;
    v.yc = place(S, v, v.h);
    v.y = cl(v.yc - 0.5 * (v.n - 1) * v.L, 8, NF - 8 - (v.n - 1) * v.L);
    v.yc = v.y + 0.5 * (v.n - 1) * v.L;
  } else {
    v.t = 1;
    v.nb = 1 + floor(3 * r());
    v.m = 3 + floor(2 * r());
    v.h = 0.5 * (v.m - 1) * 4.6 * syOf(k[2], BIAS[2]) + 6;
    v.y = place(S, v, v.h);
    v.yc = v.y;
  }
  // no room that is clear enough: wait a moment and try again
  if (S.free < (r() < 0.12 ? -8 : -3)) {
    v.st = 0;
    v.t = 0.4 + 0.6 * r();
  }
}

function step(S, d) {
  S.T += d;
  const k = S.k, r = S.r, dist = V_SCROLL * d, pd = density(k[1]);
  for (let i = 0; i < MAXA; i++) {
    if (!S.alive[i]) continue;
    S.x[i] -= dist;
    if (S.x[i] < -3.6 * sxOf(k[2], S.lam[i])) {
      S.alive[i] = 0;
      S.n--;
    }
  }
  for (const v of S.vo) {
    if (!v.st) {
      v.t -= d;
      if (v.t <= 0) start(S, v);
      continue;
    }
    v.t -= d;
    v.gap -= dist;
    if (v.st === 1) {
      v.y += (v.sl + k[3] * GL0 * v.gk + 2.2 * sin(0.83 * S.T + v.ph)) * d;
      v.yc = v.y;
      let guard = 0;
      while (v.gap <= 0 && guard++ < 4) {
        const lam = 0.1 * gauss(r), sx = sxOf(k[2], BIAS[0] + lam);
        add(S, NT + BIRTH * sx + v.gap, v.y + 0.6 * gauss(r), 0, lam);
        v.gap += (SPF * sx * (0.85 + 0.3 * r())) / pd;
      }
      if (v.y < 3 || v.y > NF - 3 || v.t <= 0) {
        v.st = 0;
        v.t = 0.3 + 2 * r();
      }
    } else if (v.st === 2) {
      let guard = 0;
      while (v.gap <= 0 && guard++ < 4) {
        const sx = sxOf(k[2], BIAS[1]), x = NT + BIRTH * sx + v.gap;
        for (let n = 0; n < v.n; n++) add(S, x, v.y + n * v.L + 0.4 * gauss(r), 1, 0.08 * gauss(r));
        v.gap += (SPF * sx * (0.9 + 0.2 * r())) / pd;
      }
      if (v.t <= 0) {
        v.st = 0;
        v.t = 0.3 + 2 * r();
      }
    } else if (v.gap <= 0) {
      const sx = sxOf(k[2], BIAS[2]), sy = syOf(k[2], BIAS[2]), x = NT + BIRTH * sx + v.gap;
      for (let n = 0; n < v.m; n++) add(S, x + 1.2 * gauss(r), v.y + (n - 0.5 * (v.m - 1)) * 4.6 * sy + 0.8 * gauss(r), 2, 0.08 * gauss(r));
      v.nb--;
      v.gap += ((3 + 3 * r()) * sx) / pd;
      if (v.nb <= 0) {
        v.st = 0;
        v.t = 0.3 + 2 * r();
      }
    }
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
    // run the voices for a while with the knobs in force so the plane opens full
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

// a hue lifted so that every colour has about the same light
function pal(h, hue, o) {
  hsv(h + hue, 0.9, 1, o);
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = 0.8 / (l + 0.12);
  o[0] *= g;
  o[1] *= g;
  o[2] *= g;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  const k = S.k;
  const hue = k[0];
  SR.fill(0);
  SI.fill(0);
  PW.fill(0);
  QR.fill(0);
  QG.fill(0);
  QB.fill(0);
  const cT = NT * 0.5, cF = NF * 0.5;
  for (let i = 0; i < MAXA; i++) {
    if (!S.alive[i]) continue;
    const lr = lnRatio(k[2], S.lam[i]), sx = sqrt(A_CELL * exp(lr)), sy = sqrt(A_CELL * exp(-lr));
    const x0 = S.x[i], y0 = S.y[i];
    const t0 = max(0, ceil(x0 - 0.5 - 3.4 * sx)), t1 = min(NT - 1, floor(x0 - 0.5 + 3.4 * sx));
    const f0 = max(0, ceil(y0 - 0.5 - 3.4 * sy)), f1 = min(NF - 1, floor(y0 - 0.5 + 3.4 * sy));
    if (t1 < t0 || f1 < f0) continue;
    const a = S.amp[i];
    // phase of the atom's transform, in centred coordinates: ph0 + (x Yi - xi Y - xi Yi) / (2A)
    const xi = x0 - cT, Yi = y0 - cF;
    const c0 = S.ph[i] - (xi * Yi) / (2 * A_CELL);
    const qx = 1 / (4 * sx * sx), qy = 1 / (4 * sy * sy);
    const nx = t1 - t0 + 1, ny = f1 - f0 + 1;
    pal(S.hh[i], hue, C);
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
  const gr = C[0] * 0.15, gg = C[1] * 0.15, gb = C[2] * 0.15;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (H - 1 - y) * NT + x;
      const I = SR[p] * SR[p] + SI[p] * SI[p];
      // a body, a bright rim where the intensity passes 0.3 and a little extra where atoms add
      const dI = (I - 0.3) / 0.11;
      const b = min(1, 0.38 * sm((I - 0.18) / 0.2) + 0.07 * min(I, 2.5) + 0.52 * exp(-dI * dI));
      const hz = 0.16 * sqrt(PB[p]);
      const iw = 1 / (PW0[p] + 1e-6), lr = QR[p] * iw, lg = QG[p] * iw, lb = QB[p] * iw;
      const wh = 0.15 * b * b * b;
      const r = gr + lr * (b + hz) + wh, g = gg + lg * (b + hz) + wh, bl = gb + lb * (b + hz) + wh;
      display.setPixel(x, y, min(255, (r * 255) | 0), min(255, (g * 255) | 0), min(255, (bl * 255) | 0));
    }
  }
}
