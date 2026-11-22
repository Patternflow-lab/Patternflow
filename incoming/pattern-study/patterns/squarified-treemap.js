// ===== Patternflow pattern =====
// Title:   Squarified Treemap
// Family:  treemap
// Idea:    Seven groups of jewel-coloured enamel tiles fill the whole panel, each tile's area is a weight that wanders and now and then surges or collapses, the squarified treemap layout is redone every frame, and the tiles glide to their new places instead of popping.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the treemap (Ben Shneiderman, 1991, slice and dice) laid out with the squarified algorithm (Mark Bruls, Kees Huizing and Jarke van Wijk, 2000), two levels deep and fed weights that never settle; pattern round 224
// Round:   224
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.2..3, Groups=-4..2, Burst=0..1
//
// Knob 1: Hue. Turns every group round the colour wheel together, one full turn from 0 to 1. At 0 the seven groups are emerald, indigo, coral, ochre, teal, plum and steel grey; at 0.33 the emerald is a blue and the coral is a green.
// Knob 2: Pace. How fast the weights drift and how fast the tiles follow. At 2 (where it opens) a leaf's weight forgets where it was in about 11 s and a tile closes 90 percent of the way to its new place in about 0.7 s; at 0.2 it is ten times slower in the drift and 1.4 s in the glide, at 3 half as slow again.
// Knob 3: Groups. How many groups share the panel, 7 plus the knob, so 3 at -4 and 9 at 2. A group is given a third of a knob step to grow in: at 6.5 the seventh is half weight and at 5.2 the sixth has lost most of its area. Changing it re-flows the rest, and the groups that go shrink to nothing and fade as their tiles get under 3 LEDs.
// Knob 4: Burst. How often and how hard a leaf surges or collapses. At 0 none do. At 0.06 (where it opens) a leaf somewhere does about every 3 s and its weight changes by a factor of about 1.9; at 1 about twice a second and the factor is 5.5. A surge bloom is a brief halo and a lighter tile.

// What the picture is. The panel is one rectangle, 64 by 128 LEDs. The groups are squarified into it, then each group's leaves are squarified into the group's own rectangle,
// the way a treemap shows two levels of a hierarchy: a rectangle's area is its weight. The squarified algorithm (Bruls, Huizing and van Wijk) fills the rectangle one row at a time along its
// shorter side, adds the next item to the row while the worst aspect ratio of the row does not get worse, and starts a new row when it would. The order of the items is fixed,
// nothing is sorted by size, so a tile stays on its side of the panel and only the places where a row breaks move. Each row break has a little hysteresis, 12 percent, or the tiles at a tie would flip every few frames.
// Weights. Every leaf has a weight whose log is the sum of a mean-reverting random walk (standard deviation 0.45, relaxing in 22 s at Pace 1), two sines of 34 to 90 s and 61 to 150 s with a fresh
// period for every leaf, and a burst term that jumps by a random 0.6 to 1.4 times the Burst strength and decays in 3.5 s. A burst is more likely a surge when the leaf is small and a collapse when it is big.
// The sum is held between a weight of 0.12 and 8 by a tanh, so a tile is never gone for long. A group has a slow weight of its own that wanders too, and its leaves add to it by their count and the root of their mean.
// The tiles. Each tile is drawn from a spring: all four edges follow the place the layout gives them with a critically damped spring, so they glide, pass each other, and settle without a bounce. A tile that is going
// faster is painted on top of a slower one, which hides the moment two of them cross. The edge is a rounded rectangle (radius 1.3 LEDs, less on a small tile) and the coverage of each LED comes from its distance
// to the edge, so an edge in the middle of an LED is half lit and the motion is smooth at a fraction of an LED. Between two leaves of a group there is 1 LED of dark, between two groups 2, and at the panel's edge 1.
// A tile whose shorter visible side is under 3.8 LEDs fades with it, and is gone at 1.4, so no 1-LED speck or line is ever left on the dark.
// Colour. Each group is one hue family in OKLCH; its leaves differ by a little lightness (plus or minus 0.07), a little hue (plus or minus 9 degrees) and a little chroma. A leaf that has been growing in the last second
// is lighter and a touch more saturated, one that has been shrinking is darker, less saturated and a few degrees toward the cool end of its hue. Inside a tile the light falls from the top left: 14 percent lighter in that corner,
// 14 percent darker in the opposite one, a faint rim, and a soft highlight, so each tile reads as a piece of enamel and not as a box. Nothing else is drawn.

const W = 64, H = 128, NPIX = W * H;
const NG = 9;
const COUNTS = [7, 6, 8, 5, 6, 7, 5, 6, 8]; // leaves in each group; the first seven make 44 tiles
const NL = COUNTS.reduce((a, b) => a + b, 0);
const START = [];
for (let g = 0, s = 0; g < NG; g++) { START.push(s); s += COUNTS[g]; }
const TAU = 6.283185307179586;
const { floor, ceil, sqrt, abs, exp, sin, cos, tanh, pow, min, max, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ---- layout constants, all in LEDs
const GAP_LEAF = 1.0; // dark between two leaves of a group
const GAP_GROUP = 2.0; // dark between two groups
const EDGE = 1.0; // dark between a tile and the edge of the panel
const HYST_G = 0.22, HYST_L = 0.15; // a row break has to be this much better to change, for groups and for leaves

// ---- weights
const OU_REL = 40; // seconds a leaf's random walk takes to forget, at Pace 1
const OU_SD = 0.45; // standard deviation of the walk, in log weight
const SINE1 = [60, 150, 0.34], SINE2 = [100, 260, 0.24]; // period range in s at Pace 1, then the amplitude
const BURST_TAU = 6; // seconds a burst takes to fade, at Pace 1
const LIM = 2.1; // the log weight is held within this by a tanh
const G_REL = 90, G_SD = 0.24; // the group's own walk
const LAG = 0.8; // seconds the layout's weights lag the leaves' own
const ALIVE_T = 0.7; // seconds a group takes to follow the Groups knob
const FADE_LO = 1.4, FADE_HI = 3.8; // shorter visible side where a tile starts to fade in, and where it is whole

// ---- colour, OKLCH: hue in degrees, lightness, chroma
const GROUPS = [
  [158, 0.6, 0.125], // emerald
  [276, 0.5, 0.155], // indigo
  [30, 0.7, 0.135], // coral
  [86, 0.74, 0.12], // ochre
  [205, 0.62, 0.1], // teal
  [332, 0.52, 0.145], // plum
  [246, 0.67, 0.055], // steel
  [10, 0.55, 0.145], // garnet
  [126, 0.67, 0.105], // moss
];
const BG = [4, 5, 9];
const SHADOW = 0.5; // how dark the shadow of a fast tile is, at most

function gauss() {
  return sqrt(-2 * log(Math.random() + 1e-9)) * cos(TAU * Math.random());
}

function makeState() {
  const f = (n) => new Float64Array(n);
  const S = {
    ready: false, tt: 0,
    alive: f(NG), gy: f(NG), gw: f(NG),
    gx0: f(NG), gy0: f(NG), gx1: f(NG), gy1: f(NG),
    sx0: f(NG), sy0: f(NG), sx1: f(NG), sy1: f(NG), svx0: f(NG), svy0: f(NG), svx1: f(NG), svy1: f(NG),
    ou: f(NL), bs: f(NL), bloom: f(NL), w: f(NL), lw: f(NL), ph1: f(NL), ph2: f(NL), p1: f(NL), p2: f(NL),
    dL: f(NL), dH: f(NL), dC: f(NL),
    tx0: f(NL), ty0: f(NL), tx1: f(NL), ty1: f(NL),
    x0: f(NL), y0: f(NL), x1: f(NL), y1: f(NL),
    vx0: f(NL), vy0: f(NL), vx1: f(NL), vy1: f(NL),
    lnA: f(NL), gr: f(NL),
    cr: f(NL), cg: f(NL), cb: f(NL), spd: f(NL),
    order: new Int16Array(NL), gi: new Uint8Array(NL), jg: new Uint8Array(NG), jl: new Uint8Array(NL),
    buf: new Float32Array(NPIX * 3),
  };
  for (let l = 0; l < NL; l++) {
    S.ou[l] = OU_SD * gauss();
    S.ph1[l] = Math.random() * TAU; S.ph2[l] = Math.random() * TAU;
    S.p1[l] = SINE1[0] + (SINE1[1] - SINE1[0]) * Math.random();
    S.p2[l] = SINE2[0] + (SINE2[1] - SINE2[0]) * Math.random();
    S.dL[l] = (Math.random() * 2 - 1) * 0.07;
    S.dH[l] = (Math.random() * 2 - 1) * 9;
    S.dC[l] = (Math.random() * 2 - 1) * 0.02;
    S.order[l] = l;
  }
  for (let g = 0; g < NG; g++) for (let q = 0; q < COUNTS[g]; q++) S.gi[START[g] + q] = g;
  for (let g = 0; g < NG; g++) S.gy[g] = G_SD * gauss();
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// ---- the squarified treemap (Bruls, Huizing, van Wijk 2000) for items off .. off + n of wt, laid into x, y, w, h.
// The order is the order given. joined[i] says whether item i shared a row with the one before it last time,
// which gives each row break a little hysteresis.
function squarify(wt, off, n, x, y, w, h, o0, o1, o2, o3, joined, hyst) {
  let tot = 0;
  for (let i = 0; i < n; i++) tot += wt[off + i];
  if (w * h < 1e-6 || tot <= 0) {
    for (let i = 0; i < n; i++) { o0[off + i] = o2[off + i] = x + w / 2; o1[off + i] = o3[off + i] = y + h / 2; }
    return;
  }
  const k = (w * h) / tot; // area for one unit of weight
  let i = 0;
  while (i < n) {
    const side = min(w, h);
    if (side < 1e-5) {
      for (let q = i; q < n; q++) { o0[off + q] = o2[off + q] = x; o1[off + q] = o3[off + q] = y; }
      return;
    }
    const s2 = side * side;
    let a = wt[off + i] * k, sum = a, mx = a, mn = a;
    let worst = max((s2 * mx) / (sum * sum), (sum * sum) / (s2 * mn));
    let j = i + 1;
    while (j < n) {
      a = wt[off + j] * k;
      const ns = sum + a, nmx = max(mx, a), nmn = min(mn, a);
      const nw = max((s2 * nmx) / (ns * ns), (ns * ns) / (s2 * nmn));
      if (nw <= worst * (joined[off + j] ? 1 + hyst : 1 - hyst)) { sum = ns; mx = nmx; mn = nmn; worst = nw; j++; } else break;
    }
    joined[off + i] = 0;
    for (let q = i + 1; q < j; q++) joined[off + q] = 1;
    const t = sum / side; // thickness of the row
    if (w >= h) { // a column on the left, its tiles stacked
      let yy = y;
      for (let q = i; q < j; q++) {
        const hh = (wt[off + q] * k) / t;
        o0[off + q] = x; o1[off + q] = yy; o2[off + q] = x + t; o3[off + q] = yy + hh;
        yy += hh;
      }
      x += t; w -= t;
    } else { // a strip along the top, its tiles side by side
      let xx = x;
      for (let q = i; q < j; q++) {
        const ww = (wt[off + q] * k) / t;
        o0[off + q] = xx; o1[off + q] = y; o2[off + q] = xx + ww; o3[off + q] = y + t;
        xx += ww;
      }
      y += t; h -= t;
    }
    i = j;
  }
}

// ---- the weights
function stepWeights(S, d, pace, burst, G) {
  const dtE = d * pow(pace, 0.8); // time on the weights' own clock
  S.tt += dtE;
  const lam = 0.03 * sqrt(burst), amp = 0.45 + 1.25 * burst;
  const kOu = OU_SD * sqrt((2 * dtE) / OU_REL) , kG = G_SD * sqrt((2 * dtE) / G_REL);
  const fOu = dtE / OU_REL, fG = dtE / G_REL;
  const fB = exp(-dtE / BURST_TAU), fBloom = exp(-d / 0.9);
  for (let g = 0; g < NG; g++) {
    const tgt = cl(G - g, 0, 1);
    S.alive[g] += (tgt - S.alive[g]) * (1 - exp(-d / ALIVE_T));
    S.gy[g] += -S.gy[g] * fG + kG * gauss();
  }
  for (let l = 0; l < NL; l++) {
    S.ou[l] += -S.ou[l] * fOu + kOu * gauss();
    S.bs[l] *= fB;
    S.bloom[l] *= fBloom;
    const x0 = S.ou[l] + SINE1[2] * sin((TAU * S.tt) / S.p1[l] + S.ph1[l]) + SINE2[2] * sin((TAU * S.tt) / S.p2[l] + S.ph2[l]);
    if (lam > 0 && Math.random() < lam * dtE) {
      const x = x0 + S.bs[l];
      const up = Math.random() < 1 / (1 + exp(1.6 * x));
      const a = amp * (0.6 + 0.8 * Math.random());
      S.bs[l] = cl(S.bs[l] + (up ? a : -a), -2.4, 2.4);
      S.bloom[l] = up ? 1 : 0.55;
    }
    const x = x0 + S.bs[l];
    S.w[l] = exp(LIM * tanh(x / LIM));
  }
}

// ---- the layout: groups into the panel (target rectangles), then the group's own rectangle follows its target on a spring,
// and the leaves are squarified into that moving rectangle. A group that changes place slides as a block and its tiles keep
// their order inside it, so only the groups cross each other, not every tile.
function layoutGroups(S, d, snap) {
  // the weights the layout reads follow the leaves' own weights with a lag of 0.8 s, so a burst
  // reaches the rows as a swell and not as a step
  const k = snap ? 1 : 1 - exp(-d / LAG);
  for (let l = 0; l < NL; l++) S.lw[l] += (S.w[l] - S.lw[l]) * k;
  for (let g = 0; g < NG; g++) {
    let sum = 0;
    for (let q = 0; q < COUNTS[g]; q++) sum += S.lw[START[g] + q];
    const n = COUNTS[g];
    S.gw[g] = max(1e-5, ss(S.alive[g]) * exp(S.gy[g]) * n * pow(sum / n, 0.25));
  }
  const r0 = EDGE - GAP_GROUP / 2;
  squarify(S.gw, 0, NG, r0, r0, W - 2 * r0, H - 2 * r0, S.gx0, S.gy0, S.gx1, S.gy1, S.jg, HYST_G);
}

function layoutLeaves(S) {
  const ins = (GAP_GROUP - GAP_LEAF) / 2;
  for (let g = 0; g < NG; g++) {
    let x = S.sx0[g], y = S.sy0[g], w = S.sx1[g] - x, h = S.sy1[g] - y;
    const nw = max(w - 2 * ins, 0), nh = max(h - 2 * ins, 0);
    x += (w - nw) / 2; y += (h - nh) / 2;
    squarify(S.lw, START[g], COUNTS[g], x, y, nw, nh, S.tx0, S.ty0, S.tx1, S.ty1, S.jl, HYST_L);
  }
}

// ---- one spring per tile edge, critically damped, solved exactly for a target that stands still over the step
function spring(S, d, omega) {
  for (let l = 0; l < NL; l++) {
    // a group that is arriving or leaving keeps its tiles tight in its own rectangle, so they do not pile up
    const om = omega * (1 + 3 * (1 - S.alive[S.gi[l]]));
    const e = exp(-om * d);
    const go = (p, v, t) => {
      const x = S[p][l] - t, tmp = (S[v][l] + om * x) * d;
      S[p][l] = t + (x + tmp) * e;
      S[v][l] = (S[v][l] - om * tmp) * e;
    };
    go("x0", "vx0", S.tx0[l]); go("y0", "vy0", S.ty0[l]);
    go("x1", "vx1", S.tx1[l]); go("y1", "vy1", S.ty1[l]);
    S.spd[l] = abs(S.vx0[l]) + abs(S.vy0[l]) + abs(S.vx1[l]) + abs(S.vy1[l]);
  }
}

function springGroups(S, d, omega) {
  const e = exp(-omega * d);
  const go = (p, v, t, g) => {
    const x = S[p][g] - t, tmp = (S[v][g] + omega * x) * d;
    S[p][g] = t + (x + tmp) * e;
    S[v][g] = (S[v][g] - omega * tmp) * e;
  };
  for (let g = 0; g < NG; g++) {
    go("sx0", "svx0", S.gx0[g], g); go("sy0", "svy0", S.gy0[g], g);
    go("sx1", "svx1", S.gx1[g], g); go("sy1", "svy1", S.gy1[g], g);
  }
}

// ---- colour
function oklch(L, C, hDeg) {
  const h = (hDeg * PI) / 180;
  for (let it = 0; it < 9; it++) {
    const a = C * cos(h), b = C * sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (it < 8 && (r < -0.002 || g < -0.002 || bl < -0.002 || r > 1.002 || g > 1.002 || bl > 1.002)) { C *= 0.9; continue; }
    const enc = (v) => {
      v = cl(v, 0, 1);
      return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
    };
    return [enc(r), enc(g), enc(bl)];
  }
  return [128, 128, 128];
}

function colours(S, hue) {
  for (let g = 0; g < NG; g++) {
    const G = GROUPS[g];
    for (let q = 0; q < COUNTS[g]; q++) {
      const l = START[g] + q;
      const gs = tanh(S.gr[l] / 0.35); // growing is positive
      const bl = S.bloom[l];
      const L = cl(G[1] + S.dL[l] + 0.1 * gs + 0.07 * bl, 0.34, 0.86);
      const C = max(0.02, G[2] * (1 + 0.2 * gs) + S.dC[l]);
      const c = oklch(L, C, G[0] + hue * 360 + S.dH[l] - 9 * gs);
      S.cr[l] = c[0]; S.cg[l] = c[1]; S.cb[l] = c[2];
    }
  }
}

function frame(S, d, snap, kn) {
  const pace = cl(kn[1], 0.2, 3), burst = cl(kn[3], 0, 1), G = 7 + cl(kn[2], -4, 2);
  if (snap) for (let g = 0; g < NG; g++) S.alive[g] = cl(G - g, 0, 1);
  if (snap) {
    // the weights are already wandering when the panel opens: 24 s of them, with the knobs where they stand
    for (let k = 0; k < 240; k++) stepWeights(S, 0.1, pace, burst, G);
  } else {
    stepWeights(S, d, pace, burst, G);
  }
  layoutGroups(S, d, snap);
  // while the Groups knob is being turned the springs are tightened, up to three times, so the panel re-flows in half a second
  // instead of dragging its tiles across each other for two
  let churn = 0;
  for (let g = 0; g < NG; g++) churn += abs(S.alive[g] - cl(G - g, 0, 1));
  const omega = (3 + 1.6 * pace) * (1 + 2 * min(1, churn));
  if (snap) {
    for (let g = 0; g < NG; g++) { S.sx0[g] = S.gx0[g]; S.sy0[g] = S.gy0[g]; S.sx1[g] = S.gx1[g]; S.sy1[g] = S.gy1[g]; }
  } else {
    springGroups(S, d, omega * 0.65);
  }
  layoutLeaves(S);
  if (snap) {
    for (let l = 0; l < NL; l++) {
      S.x0[l] = S.tx0[l]; S.y0[l] = S.ty0[l]; S.x1[l] = S.tx1[l]; S.y1[l] = S.ty1[l];
      S.vx0[l] = S.vy0[l] = S.vx1[l] = S.vy1[l] = 0;
      S.lnA[l] = log(max(1, (S.tx1[l] - S.tx0[l]) * (S.ty1[l] - S.ty0[l])));
      S.gr[l] = 0;
    }
  } else {
    spring(S, d, omega);
    const kr = 1 - exp(-d / 0.9);
    for (let l = 0; l < NL; l++) {
      const ln = log(max(1, (S.tx1[l] - S.tx0[l]) * (S.ty1[l] - S.ty0[l])));
      const rate = d > 0 ? (ln - S.lnA[l]) / d : 0;
      S.lnA[l] = ln;
      S.gr[l] += (cl(rate, -3, 3) - S.gr[l]) * kr;
    }
  }
  colours(S, kn[0]);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    frame(S, 0, true, kn);
    return;
  }
  frame(S, d, false, kn);
}

// ---- drawing: tiles in order of speed, the quickest on top
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf;
  for (let i = 0; i < NPIX; i++) { buf[i * 3] = BG[0]; buf[i * 3 + 1] = BG[1]; buf[i * 3 + 2] = BG[2]; }
  const ord = S.order, spd = S.spd;
  for (let i = 1; i < NL; i++) { // insertion sort; the order hardly changes between frames
    const v = ord[i];
    let j = i - 1;
    while (j >= 0 && spd[ord[j]] > spd[v]) { ord[j + 1] = ord[j]; j--; }
    ord[j + 1] = v;
  }
  const ins = GAP_LEAF / 2;
  for (let oi = 0; oi < NL; oi++) {
    const l = ord[oi];
    const x0 = S.x0[l] + ins, y0 = S.y0[l] + ins, x1 = S.x1[l] - ins, y1 = S.y1[l] - ins;
    const w = x1 - x0, h = y1 - y0;
    if (w < 0.4 || h < 0.4) continue;
    const m = min(w, h);
    const op = ss((m - FADE_LO) / (FADE_HI - FADE_LO)) * ss(S.alive[S.gi[l]] / 0.2);
    if (op < 0.01) continue;
    const bloom = S.bloom[l] > 0.03 ? S.bloom[l] * op : 0;
    const rad = min(1.3, 0.3 * m);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = w / 2 - rad, hy = h / 2 - rad;
    const R = S.cr[l], G = S.cg[l], B = S.cb[l];
    // a tile that is moving casts a soft shadow, so that where it crosses another it reads as a piece lifted over it
    const sh = SHADOW * ss((spd[l] / 4 - 1.2) / 6) * op;
    if (sh > 0.02) {
      const sx = cx + 0.7, sy = cy + 1.1;
      const xa = max(0, floor(x0 - 4)), xb = min(W - 1, ceil(x1 + 5));
      const ya = max(0, floor(y0 - 4)), yb = min(H - 1, ceil(y1 + 5));
      for (let py = ya; py <= yb; py++) {
        const qy = abs(py + 0.5 - sy) - hy;
        for (let px = xa; px <= xb; px++) {
          const qx = abs(px + 0.5 - sx) - hx;
          const sd = (qx > 0 && qy > 0 ? sqrt(qx * qx + qy * qy) : max(qx, qy)) - rad;
          const c = 0.5 - sd / 2.2;
          if (c <= 0) continue;
          const f = 1 - sh * (c > 1 ? 1 : c);
          const k = (py * W + px) * 3;
          buf[k] *= f; buf[k + 1] *= f; buf[k + 2] *= f;
        }
      }
    }
    const pad = bloom > 0 ? 3 : 1;
    const xa = max(0, floor(x0 - pad)), xb = min(W - 1, ceil(x1 + pad));
    const ya = max(0, floor(y0 - pad)), yb = min(H - 1, ceil(y1 + pad));
    for (let py = ya; py <= yb; py++) {
      const qy = abs(py + 0.5 - cy) - hy;
      const v = cl((py + 0.5 - y0) / h, 0, 1);
      for (let px = xa; px <= xb; px++) {
        const qx = abs(px + 0.5 - cx) - hx;
        let sdf;
        if (qx > 0 && qy > 0) sdf = sqrt(qx * qx + qy * qy) - rad;
        else sdf = max(qx, qy) - rad;
        const k = (py * W + px) * 3;
        let cov = 0.5 - sdf;
        if (cov <= 0) {
          if (bloom > 0 && sdf < 3) {
            const hl = bloom * 0.34 * exp(-sdf / 1.0);
            buf[k] += R * hl; buf[k + 1] += G * hl; buf[k + 2] += B * hl;
          }
          continue;
        }
        if (cov > 1) cov = 1;
        const u = cl((px + 0.5 - x0) / w, 0, 1);
        const inner = sdf < 0 ? -sdf : 0;
        // light from the top left, a faint rim, a soft highlight in the top left corner
        const shade = (1.14 - 0.28 * 0.5 * (u + v)) * (1 - 0.16 * exp(-inner / 0.8));
        const du = u - 0.2, dv = v - 0.16;
        const gloss = 0.1 * exp(-(du * du + dv * dv) / 0.035);
        const bl = bloom * 0.2;
        const cr = min(255, R * shade + 255 * (gloss + bl) * 0.6);
        const cg = min(255, G * shade + 255 * (gloss + bl) * 0.6);
        const cb = min(255, B * shade + 255 * (gloss + bl) * 0.6);
        const a = cov * op;
        buf[k] += (cr - buf[k]) * a; buf[k + 1] += (cg - buf[k + 1]) * a; buf[k + 2] += (cb - buf[k + 2]) * a;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[k]) | 0, min(255, buf[k + 1]) | 0, min(255, buf[k + 2]) | 0);
    }
  }
}
