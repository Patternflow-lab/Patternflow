// ===== Patternflow pattern =====
// Title:   Bubble Raft
// Family:  bubbleraft
// Idea:    A raft of about three hundred soap bubbles packs into a two-dimensional crystal that a slow shear and a slow turn keep working, and the flaws of the crystal glow through it, amber for a bubble with five neighbours, magenta for seven, white for four or eight, as bubbles pop and new ones are blown in.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Bragg-Nye bubble raft (William Lawrence Bragg and John Nye, "A dynamical model of a crystal structure", Proceedings of the Royal Society A, 1947), whose flaws are those of a metal: grain boundaries, vacancies and dislocations, a bubble with five neighbours beside one with seven; the melting of such a crystal through a hexatic phase (Halperin and Nelson 1978, Young 1979, from memory); overdamped Brownian dynamics with a soft repulsion and a weak attraction, stepped by Euler and Maruyama, pattern round 239
// Round:   239
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shear=0..2.5, Agitation=0..1.5, Mismatch=0..0.3
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the bubbles with six neighbours are teal with a pale cyan rim, five neighbours amber, seven magenta and four or eight white, over a dark indigo liquid. Turned away from 0 every class keeps its distance on the wheel from the others, and the dim reds are lifted and paled so that nothing goes brown.
// Knob 2: Shear. 0 to 2.5, opening at 2. How hard the driver works the raft: two bands at the top and the bottom edge drag it sideways in opposite directions, and a slow stirring that turns the middle of the raft one way and then the other, each with its own wandering sign. At 0 the raft is left to the pops and to the noise. At 2 the middle bubble drifts about a quarter of its width in a second, the quickest tenth about half, and rows slip past each other all over the panel; at 2.5 a little faster still.
// Knob 3: Agitation. 0 to 1.5, opening at 0. The thermal noise on every bubble. At 0 the raft is a calm crystal that only trembles, about three bubbles in four with six neighbours and the rest strung out in short lines of amber and magenta. In the middle it goes hexatic, the rows bending and the seams joining up. At 1.5 it is a hot liquid that has not quite melted, only three bubbles in ten with six neighbours and the rest amber, magenta or white.
// Knob 4: Mismatch. 0 to 0.3, opening at 0.06. The spread of the bubble sizes, in three classes. At 0 all bubbles are alike and the raft wants to be one perfect crystal. At 0.06 the radii are 2.9, 3.1 and 3.3 LEDs. At 0.3 they are 2.2, 3.1 and 4.0, a crowded mixture that cannot crystallise and shows its seams everywhere. The bubbles grow or shrink to the new size within a second.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, exp, log, pow, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
// The wait between events, in units of the mean wait: two exponentials averaged, so they come a little more evenly than a Poisson stream.
const gap = () => -0.5 * (log(1 - Math.random()) + log(1 - Math.random()));

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour on the red, orange, yellow and olive stretch of the wheel reads brown unless it is bright and pale, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.88 ? sstep(0.88, 0.96, c) : 1 - sstep(0.17, 0.3, c);
  hsv(h, s * (1 - 0.45 * b), min(max(v, 0.93), v * (1 + 1.2 * b * (1 - v)) + 0.1 * b), out, o);
}

// ---- the arena ------------------------------------------------------------
// The raft lives in a box one bubble larger than the panel on every side, so the bubbles against
// the walls are never seen and the panel looks onto the middle of a raft that goes on.
const MG = 6;
const X0 = -MG, Y0 = -MG, LX = W + 2 * MG, LY = H + 2 * MG, X1 = X0 + LX, Y1 = Y0 + LY;
const R0 = 3.1;          // mean bubble radius, in LEDs
const CAP = 480;
const DT = 1 / 60;     // one sub-step of the dynamics
const CS = 12, GX = ceil(LX / CS) + 1, GY = ceil(LY / CS) + 1;
const PHI = 0.93;      // the share of the box the bubbles cover
const KREP = 10;       // repulsion, LEDs a second per LED of overlap
const KATT = 0.55;     // the pull of the film between near bubbles, LEDs a second at its strongest
const KWALL = 16;
const PRE = 26;        // seconds the first update runs before the first frame, so the raft opens already worked

// Stirring: stream-function modes of the box. Each is a flow that never leaves the walls, so the raft
// turns and shears without piling up. The (1,1) mode turns the middle, the (1,3) mode drags the top
// and the bottom edge in opposite directions. Each mode's amplitude wanders on its own clock.
const MODES = [[1, 1, 1.0], [1, 2, 0.8], [1, 3, 0.9], [2, 1, 0.55], [2, 2, 0.6], [2, 3, 0.5], [3, 2, 0.4]];
const NM = MODES.length;
const TA = new Float64Array(4), TC = new Float64Array(4), TB = new Float64Array(4), TD = new Float64Array(4);
const MCU = new Float64Array(NM), MCV = new Float64Array(NM);
for (let k = 0; k < NM; k++) {
  const [m, n, g] = MODES[k], cu = n / LY, cv = m / LX, nrm = max(cu, cv);
  MCU[k] = (g * cu) / nrm;
  MCV[k] = (g * cv) / nrm;
}

export function setup(params) {
  const st = {
    k: [0, 2, 0, 0.06], t: 0, acc: 0, init: false, n: 0,
    x: new Float64Array(CAP), y: new Float64Array(CAP), r: new Float64Array(CAP), c: new Float64Array(CAP),
    fx: new Float64Array(CAP), fy: new Float64Array(CAP), nb: new Float64Array(CAP),
    ks: new Int8Array(CAP), pv: new Int8Array(CAP), pt: new Float32Array(CAP), w: new Float32Array(CAP * 4), ph: new Float64Array(CAP), sp: new Float64Array(CAP),
    fl: new Float64Array(CAP), age: new Float64Array(CAP),
    head: new Int32Array(GX * GY), next: new Int32Array(CAP),
    am: new Float64Array(NM), a0: new Float64Array(NM), a1: new Float64Array(NM), mt: new Float64Array(NM), md: new Float64Array(NM),
    band: { a0: 0, a1: 1, t0: 0, d: 20 },
    rings: [], popH: 0, popN: gap(), blowH: 0, blowN: gap(), heat: 1.5,
    lt: [rnd(0, 100), rnd(0, 100), rnd(0, 100), rnd(0, 100)],
    R: new Float32Array(NPX), G: new Float32Array(NPX), B: new Float32Array(NPX),
    cin: new Float32Array(12), cra: new Float32Array(12), crb: new Float32Array(12), cgl: new Float32Array(12),
    colx: new Float32Array(W), coly: new Float32Array(H),
  };
  for (let k = 0; k < NM; k++) {
    st.mt[k] = rnd(-8, 0);
    st.md[k] = rnd(14, 36);
    st.a0[k] = rnd(-1, 1) * 0.7;
    st.a1[k] = nextAmp();
    st.am[k] = st.a0[k];
  }
  // The raft starts as a random scatter of bubbles that the first seconds of noise and repulsion pack.
  const nt = targetCount(0.06);
  for (let i = 0; i < nt; i++) addBubble(st, rnd(X0 + 3, X1 - 3), rnd(Y0 + 3, Y1 - 3), 1);
  params.st = st;
}

const nextAmp = () => (Math.random() < 0.5 ? -1 : 1) * rnd(0.3, 1);
const targetCount = (s) => floor((PHI * LX * LY) / (PI * R0 * R0 * (1 + 0.62 * s * s)));
const radiusOf = (c, s) => R0 * (1 + s * c);
// One of three size classes, a little blurred.
const drawClass = () => {
  const u = Math.random();
  return (u < 0.3 ? -1 : u < 0.7 ? 0 : 1) + 0.1 * gauss();
};

function addBubble(st, x, y, frac0) {
  const i = st.n;
  if (i >= CAP) return -1;
  st.n++;
  st.x[i] = x; st.y[i] = y;
  st.c[i] = drawClass();
  st.r[i] = radiusOf(st.c[i], st.k[3]) * frac0;
  st.ks[i] = 6;
  st.w[i * 4] = 1; st.w[i * 4 + 1] = 0; st.w[i * 4 + 2] = 0; st.w[i * 4 + 3] = 0;
  st.nb[i] = 6; st.pv[i] = 6; st.pt[i] = 0;
  st.ph[i] = rnd(0, TAU);
  st.sp[i] = rnd(0.12, 0.5) * (Math.random() < 0.5 ? -1 : 1);
  st.fl[i] = frac0 < 1 ? 1 : 0;
  st.age[i] = frac0 < 1 ? 0 : 9;
  return i;
}

function removeBubble(st, i) {
  const l = st.n - 1;
  if (i !== l) {
    st.x[i] = st.x[l]; st.y[i] = st.y[l]; st.r[i] = st.r[l]; st.c[i] = st.c[l];
    st.nb[i] = st.nb[l]; st.ks[i] = st.ks[l]; st.pv[i] = st.pv[l]; st.pt[i] = st.pt[l]; st.ph[i] = st.ph[l]; st.sp[i] = st.sp[l];
    st.fl[i] = st.fl[l]; st.age[i] = st.age[l];
    for (let q = 0; q < 4; q++) st.w[i * 4 + q] = st.w[l * 4 + q];
  }
  st.n = l;
}

// ---- the dynamics -----------------------------------------------------------
// The thermal noise, in LEDs per root second, from the Agitation knob.
const sigmaOf = (k3) => 0.35 + 2.4 * pow(cl(k3, 0, 1.5) / 1.5, 1.5) + 0.4 * cl(k3, 0, 1.5);

function substep(st, sig, drv) {
  const { x, y, r, fx, fy, head, next, n } = st;
  head.fill(-1);
  for (let i = 0; i < n; i++) {
    const gx = cl(floor((x[i] - X0) / CS), 0, GX - 1), gy = cl(floor((y[i] - Y0) / CS), 0, GY - 1);
    next[i] = head[gy * GX + gx];
    head[gy * GX + gx] = i;
  }
  fx.fill(0, 0, n);
  fy.fill(0, 0, n);
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], ri = r[i];
    const cx = floor((xi - X0) / CS), cy = floor((yi - Y0) / CS);
    for (let gy = max(0, cy - 1); gy <= min(GY - 1, cy + 1); gy++)
      for (let gx = max(0, cx - 1); gx <= min(GX - 1, cx + 1); gx++)
        for (let j = head[gy * GX + gx]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          const dx = x[j] - xi, dy = y[j] - yi, s = ri + r[j], lim = s * 1.3, d2 = dx * dx + dy * dy;
          if (d2 >= lim * lim) continue;
          const d = sqrt(d2) + 1e-6;
          let f = 0;
          if (d < s) f = KREP * (s - d);
          else {
            const u = (d - s) / (0.25 * s);
            if (u < 1) f = -KATT * sin(PI * u);
          }
          const gx2 = (f * dx) / d, gy2 = (f * dy) / d;
          fx[i] -= gx2; fy[i] -= gy2; fx[j] += gx2; fy[j] += gy2;
        }
  }
  const sq = sqrt(DT), S = drv.S, am = st.am;
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], a = (xi - X0) / LX, b = (yi - Y0) / LY;
    let ux = 0, uy = 0;
    if (S > 0) {
      const s1 = sin(PI * a), c1 = cos(PI * a), t1 = sin(PI * b), d1 = cos(PI * b);
      TA[1] = s1; TA[2] = 2 * s1 * c1; TA[3] = 3 * s1 - 4 * s1 * s1 * s1;
      TC[1] = c1; TC[2] = c1 * c1 - s1 * s1; TC[3] = 4 * c1 * c1 * c1 - 3 * c1;
      TB[1] = t1; TB[2] = 2 * t1 * d1; TB[3] = 3 * t1 - 4 * t1 * t1 * t1;
      TD[1] = d1; TD[2] = d1 * d1 - t1 * t1; TD[3] = 4 * d1 * d1 * d1 - 3 * d1;
      for (let k = 0; k < NM; k++) {
        const m = MODES[k][0], q = MODES[k][1];
        ux += am[k] * MCU[k] * TA[m] * TD[q];
        uy -= am[k] * MCV[k] * TC[m] * TB[q];
      }
      // The two edge bands.
      const wt = sstep(Y0 + 22, Y0 + 2, yi), wb = sstep(Y1 - 22, Y1 - 2, yi);
      ux += drv.band * 1.4 * (wt - wb);
      ux *= S; uy *= S;
    }
    // The walls push back on a bubble that crosses them.
    const ri = r[i];
    let wx = 0, wy = 0;
    if (xi < X0 + ri) wx = KWALL * (X0 + ri - xi);
    else if (xi > X1 - ri) wx = -KWALL * (xi - (X1 - ri));
    if (yi < Y0 + ri) wy = KWALL * (Y0 + ri - yi);
    else if (yi > Y1 - ri) wy = -KWALL * (yi - (Y1 - ri));
    let dx = (fx[i] + ux + wx) * DT + sig * sq * gauss();
    let dy = (fy[i] + uy + wy) * DT + sig * sq * gauss();
    const dm = max(abs(dx), abs(dy));
    if (dm > 0.7) (dx *= 0.7 / dm), (dy *= 0.7 / dm);
    x[i] = cl(xi + dx, X0 + 0.5, X1 - 0.5);
    y[i] = cl(yi + dy, Y0 + 0.5, Y1 - 0.5);
  }
}

// A smooth value that wanders: it moves between random targets, each held for its own time, re-drawn every time it arrives.
function wander(st, t) {
  for (let k = 0; k < NM; k++) {
    while (t >= st.mt[k] + st.md[k]) {
      st.mt[k] += st.md[k];
      st.a0[k] = st.a1[k];
      st.a1[k] = nextAmp();
      st.md[k] = rnd(14, 40);
    }
    st.am[k] = st.a0[k] + (st.a1[k] - st.a0[k]) * sstep(st.mt[k], st.mt[k] + st.md[k], t);
  }
  const b = st.band;
  while (t >= b.t0 + b.d) {
    b.t0 += b.d;
    b.a0 = b.a1;
    b.a1 = nextAmp();
    b.d = rnd(9, 26);
  }
  return b.a0 + (b.a1 - b.a0) * sstep(b.t0, b.t0 + b.d, t);
}

function visibleBubble(st) {
  for (let tries = 0; tries < 24; tries++) {
    const i = floor(Math.random() * st.n);
    if (st.x[i] > -1 && st.x[i] < W + 1 && st.y[i] > -1 && st.y[i] < H + 1 && st.age[i] > 1.2) return i;
  }
  return -1;
}

function popOne(st) {
  const i = visibleBubble(st);
  if (i < 0) return;
  st.rings.push({ x: st.x[i], y: st.y[i], r: st.r[i], a: 0, w: st.w[i * 4 + 3] });
  removeBubble(st, i);
}

// A new bubble is blown in at a random spot, mostly the roomiest of a few. The spots reach a little
// beyond the panel, so a hole at its edge fills as well as one in the middle.
function blowOne(st) {
  let bx = 0, by = 0, best = -1e9;
  const tries = Math.random() < 0.6 ? 7 : 1;
  for (let q = 0; q < tries; q++) {
    const px = rnd(-3, W + 3), py = rnd(-3, H + 3);
    let room = 1e9;
    for (let j = 0; j < st.n; j++) {
      const d = sqrt((st.x[j] - px) ** 2 + (st.y[j] - py) ** 2) - st.r[j];
      if (d < room) room = d;
    }
    if (room > best) (best = room), (bx = px), (by = py);
  }
  addBubble(st, bx, by, 0.2);
}

// The neighbours of a bubble: the Gabriel graph of the centres (an edge when no third centre lies
// in the disc on the edge as a diameter, which is the Delaunay triangulation without its long
// sliver edges), cut off at 1.4 touching distances so that a bubble across a hole is not a neighbour.
function countNeighbours(st) {
  const { x, y, r, nb, head, next, n } = st;
  nb.fill(0, 0, n);
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], cx = floor((xi - X0) / CS), cy = floor((yi - Y0) / CS);
    const gx0 = max(0, cx - 1), gx1 = min(GX - 1, cx + 1), gy0 = max(0, cy - 1), gy1 = min(GY - 1, cy + 1);
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++)
        for (let j = head[gy * GX + gx]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          const dx = x[j] - xi, dy = y[j] - yi, s = r[i] + r[j], d2 = dx * dx + dy * dy;
          if (d2 > 1.96 * s * s) continue;
          const mx = xi + dx * 0.5, my = yi + dy * 0.5, rr = d2 * 0.25 * 0.97;
          let ok = true;
          for (let gy3 = gy0; ok && gy3 <= gy1; gy3++)
            for (let gx3 = gx0; ok && gx3 <= gx1; gx3++)
              for (let k = head[gy3 * GX + gx3]; k >= 0; k = next[k]) {
                if (k === i || k === j) continue;
                const ex = x[k] - mx, ey = y[k] - my;
                if (ex * ex + ey * ey < rr) { ok = false; break; }
              }
          if (ok) { nb[i]++; nb[j]++; }
        }
  }
}

function advance(st, d, quiet) {
  st.acc += d;
  const k2 = st.k[1], k4 = st.k[3], sig = sigmaOf(st.k[2]) * (1 + 2.2 * st.heat);
  let steps = 0;
  while (st.acc >= DT && steps < 8) {
    st.acc -= DT;
    steps++;
    st.t += DT;
    const bandA = wander(st, st.t);
    // Radii follow the Mismatch knob.
    const kr = 1 - exp(-DT / 0.35);
    for (let i = 0; i < st.n; i++) {
      const grow = st.age[i] < 0.9 ? 0.55 + 0.45 * sstep(0, 0.9, st.age[i]) : 1;
      const rt = radiusOf(st.c[i], k4) * grow;
      st.r[i] += (rt - st.r[i]) * (st.age[i] < 0.9 ? 1 - exp(-DT / 0.16) : kr);
      st.age[i] += DT;
      st.fl[i] *= exp(-DT / 0.9);
      st.ph[i] += st.sp[i] * DT;
    }
    st.heat *= exp(-DT / 1.6);
    const drv = { S: 1.5 * k2, band: bandA };
    substep(st, sig, drv);
  }
  // Pops and new bubbles, balanced about the number that fills the box.
  const nt = targetCount(k4), dev = (st.n - nt) / 4;
  st.popH += d * cl(0.8 + dev, 0.1, 3);
  st.blowH += d * cl(0.8 - dev, 0.1, 3);
  while (st.popH >= st.popN) { st.popH -= st.popN; st.popN = gap(); popOne(st); }
  while (st.blowH >= st.blowN) { st.blowH -= st.blowN; st.blowN = gap(); if (st.n < CAP - 2) blowOne(st); }
  for (let i = st.rings.length - 1; i >= 0; i--) {
    st.rings[i].a += d;
    if (st.rings[i].a > 0.5) st.rings.splice(i, 1);
  }
  // Colour classes follow the neighbour count once it has held for a moment, and glide.
  if (steps > 0 && !quiet) countNeighbours(st);
  const kc = 1 - exp(-d / 0.2);
  for (let i = 0; i < st.n; i++) {
    const nbi = st.nb[i];
    if (nbi === st.ks[i]) st.pt[i] = 0;
    else if (nbi !== st.pv[i]) (st.pv[i] = nbi), (st.pt[i] = 0);
    else if ((st.pt[i] += d) > 0.22) (st.ks[i] = nbi), (st.pt[i] = 0);
    const kk = st.ks[i], cls = kk === 6 ? 0 : kk === 5 ? 1 : kk === 7 ? 2 : 3, o = i * 4;
    for (let q = 0; q < 4; q++) st.w[o + q] += ((q === cls ? 1 : 0) - st.w[o + q]) * kc;
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 2.5), cl(kv[2], 0, 1.5), cl(kv[3], 0, 0.3)];
  if (!st.init) {
    st.init = true;
    // The raft opens already worked: run the first seconds before the first frame.
    for (let i = 0; i < PRE * 30; i++) advance(st, 1 / 30, i < PRE * 30 - 40);
    for (let i = 0; i < st.n; i++) st.age[i] = max(st.age[i], 9);
    st.rings.length = 0;
  }
  advance(st, cl(dt || 0, 0, 0.1));
}

// ---- drawing --------------------------------------------------------------
// The classes: teal for six neighbours, amber for five, magenta for seven, white for the rest.
// Per class: hue, then the interior (saturation, value) and the rim (saturation, value).
const CLS = [
  [0.5, 0.86, 0.4, 0.42, 1.0],
  [0.09, 0.7, 0.75, 0.5, 1.0],
  [0.9, 0.78, 0.56, 0.42, 1.0],
  [0.13, 0.22, 0.9, 0.05, 1.0],
];

function palette(st, hue) {
  for (let c = 0; c < 4; c++) {
    const [h, si, vi, sr, vr] = CLS[c], hh = h + hue;
    dim(hh, si, vi, st.cin, c * 3);
    dim(hh - 0.045, sr, vr, st.cra, c * 3);
    dim(hh + 0.05, sr, vr, st.crb, c * 3);
    dim(hh, 0.8, 0.55, st.cgl, c * 3);
  }
}

const LIGHT_X = -0.55, LIGHT_Y = -0.835;

function drawLiquid(st, t, hue) {
  const { R, G, B, colx, coly, lt } = st;
  for (let xx = 0; xx < W; xx++) colx[xx] = sin(xx * 0.11 + t * 0.09 + lt[0]) + 0.6 * sin(xx * 0.27 - t * 0.13 + lt[1]);
  for (let yy = 0; yy < H; yy++) coly[yy] = sin(yy * 0.06 - t * 0.07 + lt[2]) + 0.6 * sin(yy * 0.17 + t * 0.11 + lt[3]);
  const hb = 0.64 + hue + 0.05 * sin(t * 0.021 + lt[0]) + 0.03 * sin(t * 0.047 + lt[2]);
  const c1 = [0, 0, 0], c2 = [0, 0, 0];
  dim(hb, 0.8, 0.12, c1, 0);
  dim(hb + 0.1, 0.7, 0.22, c2, 0);
  for (let yy = 0, o = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++, o++) {
      const f = cl(0.5 + 0.2 * colx[xx] * coly[yy], 0, 1);
      R[o] = (c1[0] + (c2[0] - c1[0]) * f) * 255;
      G[o] = (c1[1] + (c2[1] - c1[1]) * f) * 255;
      B[o] = (c1[2] + (c2[2] - c1[2]) * f) * 255;
    }
}

// Light from the seams: a bubble that is not teal leaks a soft glow into the liquid round it.
function drawGlow(st) {
  const { R, G, B, w, x, y, r, cgl } = st;
  for (let i = 0; i < st.n; i++) {
    const wd = 1 - w[i * 4];
    if (wd < 0.1) continue;
    const xi = x[i], yi = y[i], rg = r[i] * 1.75;
    if (xi < -rg || xi > W + rg || yi < -rg || yi > H + rg) continue;
    let cr = 0, cg = 0, cb = 0;
    for (let q = 1; q < 4; q++) {
      cr += w[i * 4 + q] * cgl[q * 3]; cg += w[i * 4 + q] * cgl[q * 3 + 1]; cb += w[i * 4 + q] * cgl[q * 3 + 2];
    }
    const x0 = max(0, floor(xi - rg)), x1 = min(W - 1, ceil(xi + rg)), y0 = max(0, floor(yi - rg)), y1 = min(H - 1, ceil(yi + rg));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - xi, dy = py + 0.5 - yi, e = exp(-(dx * dx + dy * dy) / (r[i] * r[i] * 1.7)) * 0.4;
        const o = py * W + px;
        R[o] += cr * 255 * e; G[o] += cg * 255 * e; B[o] += cb * 255 * e;
      }
  }
}

function drawBubble(st, i) {
  const { R, G, B, w, cin, cra, crb } = st;
  const xi = st.x[i], yi = st.y[i], ri = st.r[i], Rd = ri * 0.97;
  if (xi < -ri - 1 || xi > W + ri + 1 || yi < -ri - 1 || yi > H + ri + 1 || Rd < 0.4) return;
  // The weights are sharpened, so that a bubble changing class passes quickly through the grey between two colours.
  const o4 = i * 4;
  let w0 = sstep(0.1, 0.9, w[o4]), w1 = sstep(0.1, 0.9, w[o4 + 1]), w2 = sstep(0.1, 0.9, w[o4 + 2]), w3 = sstep(0.1, 0.9, w[o4 + 3]);
  const wn = 1 / (w0 + w1 + w2 + w3 + 1e-6);
  w0 *= wn; w1 *= wn; w2 *= wn; w3 *= wn;
  const mix = (a, q) => w0 * a[q] + w1 * a[3 + q] + w2 * a[6 + q] + w3 * a[9 + q];
  const fl = st.fl[i], phi = st.ph[i], cph = cos(phi), sph = sin(phi);
  const gi = 0.93 + 0.07 * sin(2 * phi + 1);
  const inr = mix(cin, 0), ing = mix(cin, 1), inb = mix(cin, 2);
  const rar = mix(cra, 0), rag = mix(cra, 1), rab = mix(cra, 2);
  const rbr = mix(crb, 0), rbg = mix(crb, 1), rbb = mix(crb, 2);
  const hx = xi - 0.34 * Rd, hy = yi - 0.4 * Rd, sg2 = 2 * pow(0.26 * Rd + 0.3, 2);
  const x0 = max(0, floor(xi - Rd - 1)), x1 = min(W - 1, ceil(xi + Rd + 1)), y0 = max(0, floor(yi - Rd - 1)), y1 = min(H - 1, ceil(yi + Rd + 1));
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - xi, dy = py + 0.5 - yi, d = sqrt(dx * dx + dy * dy);
      const cov = cl(Rd + 0.5 - d, 0, 1);
      if (cov <= 0) continue;
      const nx = d > 1e-4 ? dx / d : 0, ny = d > 1e-4 ? dy / d : 0;
      const rho = min(1, d / Rd), film = sstep(0.42, 0.9, rho);
      const lit = nx * LIGHT_X + ny * LIGHT_Y;
      const gain = (0.5 + 0.85 * max(0, lit) + 0.22 * max(0, -lit) + 0.5 * fl) * gi;
      const rm = 0.5 + 0.5 * (nx * cph + ny * sph);
      const dome = 0.8 + 0.3 * (1 - rho) + 0.4 * fl;
      let cr = inr * dome * (1 - film) + (rar + (rbr - rar) * rm) * gain * film;
      let cg = ing * dome * (1 - film) + (rag + (rbg - rag) * rm) * gain * film;
      let cb = inb * dome * (1 - film) + (rab + (rbb - rab) * rm) * gain * film;
      const hd = (px + 0.5 - hx) ** 2 + (py + 0.5 - hy) ** 2, hl = 0.62 * exp(-hd / sg2);
      cr += (1 - cr) * hl; cg += (1 - cg) * hl; cb += (1 - cb) * hl;
      const o = py * W + px;
      R[o] += (min(1, cr) * 255 - R[o]) * cov;
      G[o] += (min(1, cg) * 255 - G[o]) * cov;
      B[o] += (min(1, cb) * 255 - B[o]) * cov;
    }
}

// A popped bubble flashes white and a ring runs out from where it was.
function drawRings(st) {
  const { R, G, B } = st;
  for (const g of st.rings) {
    const u = g.a / 0.5, rr = g.r + 4.5 * (1 - (1 - u) * (1 - u)), fade = (1 - u) * (1 - u);
    const x0 = max(0, floor(g.x - rr - 2)), x1 = min(W - 1, ceil(g.x + rr + 2)), y0 = max(0, floor(g.y - rr - 2)), y1 = min(H - 1, ceil(g.y + rr + 2));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const d = sqrt((px + 0.5 - g.x) ** 2 + (py + 0.5 - g.y) ** 2);
        const k = cl(1.6 - abs(d - rr), 0, 1) * fade * 0.85 + (d < g.r * 0.8 ? fade * fade * 0.25 : 0);
        if (k <= 0) continue;
        const o = py * W + px;
        R[o] += (255 - R[o]) * k; G[o] += (250 - G[o]) * k; B[o] += (240 - B[o]) * k;
      }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  palette(st, hue);
  drawLiquid(st, st.t, hue);
  drawGlow(st);
  for (let i = 0; i < st.n; i++) drawBubble(st, i);
  drawRings(st);
  const { R, G, B } = st;
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, floor(min(255, R[o])), floor(min(255, G[o])), floor(min(255, B[o])));
}
