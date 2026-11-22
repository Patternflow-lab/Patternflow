// ===== Patternflow pattern =====
// Title:   Squarified Treemap
// Family:  treemap
// Idea:    Seven groups of jewel-coloured enamel tiles fill the whole panel, each tile's area is a weight that wanders and now and then surges or collapses, the squarified treemap rows stay as they are while they fit and dissolve into a new arrangement once a tile gets too long and thin.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the treemap (Ben Shneiderman, 1991, slice and dice) laid out with the squarified algorithm (Mark Bruls, Kees Huizing and Jarke van Wijk, 2000), two levels deep and fed weights that never settle; pattern round 224
// Round:   224
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.35..3, Groups=-4..2, Burst=0..1
//
// Knob 1: Hue. Turns every group round the colour wheel together, one full turn from 0 to 1. At 0 the seven groups are emerald, indigo, coral, ochre, teal, plum and steel grey; at 0.33 the emerald is a blue and the coral is a green.
// Knob 2: Pace. How fast the weights drift and how fast the tiles follow, on a clock of Pace to the power 0.8. At 2 (where it opens) a leaf's weight forgets where it was in about 23 s, a tile takes 1.4 s to get 90 percent of the way to a new size, and a changed arrangement dissolves in 0.63 s; at 0.35 the forgetting takes 93 s, the tile 3.2 s and the dissolve 1.4 s, at 3 they take 17 s, 1.1 s and 0.48 s.
// Knob 3: Groups. How many groups share the panel, 7 plus the knob, so 3 groups and 21 tiles at -4, 7 and 44 at 0 (where it opens) and 9 and 58 at 2. The knob is not stepped: at 0.5 the eighth group is at half strength, and a group that goes shrinks over a second or two to a sliver and fades as its tiles get under 3 LEDs, while the rest re-flow into its place.
// Knob 4: Burst. How often and how hard a leaf surges or collapses. At 0 none do. At 0.06 (where it opens) one does about every 2 s and its weight changes by a factor of 1.4 to 2.1; at 1 two or three do a second and the factor is 2.8 to 8. A surge blooms: the tile goes lighter and throws a halo about 2 LEDs wide for about a second.

// What the picture is. The panel is one rectangle, 64 by 128 LEDs. The groups are laid into it, then each group's leaves into the group's own rectangle,
// the way a treemap shows two levels of a hierarchy: a rectangle's area is its weight. The squarified algorithm (Bruls, Huizing and van Wijk) fills a rectangle one row at a time along its
// shorter side, adds the next item to the row while the worst aspect ratio in the row does not get worse, and starts a new row when it would. Here it is run to get a partition and nothing more:
// which items share a row, and whether each row is a column on the left or a strip along the top. The order of the items is fixed and nothing is sorted by size. Every frame the rectangles are worked out
// from that partition and the current weights, so a tile's rectangle is a continuous function of the weights, tiles swell and shrink and push their neighbours, and no two tiles ever cross.
// A partition is kept until the worst tile that shows is longer than 3.4 to 1 (groups) or 4.2 to 1 (leaves) and a fresh run brings that under 0.72 of it, and not sooner than 3 s after the last change.
// The change is a dissolve: the old arrangement and the new one are both drawn and mixed over 1.9 / (Pace + 1) s, so nothing flies across the panel. At the opening that happens about seven times a minute, mostly inside a group.
// Weights. Every leaf has a weight whose log is the sum of a mean-reverting random walk (standard deviation 0.5, forgetting in 40 s at Pace 1), two sines with periods of 60 to 150 s and 100 to 260 s
// that are different for every leaf, and a burst term that jumps by a random 0.6 to 1.4 times the Burst strength and fades in 6 s. A burst is more likely a surge when the leaf is small and a collapse when it is big.
// The sum is held between a weight of 0.12 and 8.2 by a tanh, so a tile is never gone for long. A group has a slow weight of its own (standard deviation 0.3 in the log, forgetting in 80 s), and its leaves add to it by their
// count and the fourth root of their mean weight, so the arrangement of the groups changes slowly and the arrangement inside a group changes often. The layout reads the weights through two lags, 0.37 s each at the opening, so a burst arrives as a swell.
// The edge of a tile is a rounded rectangle (radius 1.3 LEDs, less on a small tile) and the coverage of each LED comes from its distance to the edge, so an edge in the middle of an LED is half lit and the growth
// is smooth at a fraction of an LED. Between two leaves of a group there is 1 LED of dark, between two groups 2, and at the edge of the panel 1. A tile whose shorter visible side is under 3.8 LEDs fades with it
// and is gone at 1.4, so there is never a 1-LED speck or line left on the dark. A group that leaves has its weight run down to nothing and takes its tiles out the same way.
// Colour. Each group is one hue family in OKLCH; its leaves differ by a little lightness (plus or minus 0.07), a little hue (plus or minus 9 degrees) and a little chroma. A leaf that has been growing in the last
// second is lighter and a touch more saturated, one that has been shrinking is darker, less saturated and a few degrees toward the cool end of its hue. Inside a tile the light falls from the top left: 14 percent
// lighter in that corner, 14 percent darker in the opposite one, a faint rim, and a soft highlight, so each tile reads as a piece of enamel and not as a box. Nothing else is drawn.

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
const BAD_G = 3.4, BAD_L = 4.2; // worst aspect ratio a row partition may reach, for the groups and for the leaves, before it is replaced
const BETTER = 0.72; // a new partition has to bring the worst aspect ratio under this share of the old one
const HOLD = 3; // seconds a partition stays at least, so that the same two do not take turns
const DISSOLVE = 1.9; // seconds of a dissolve at Pace 1, divided by Pace + 1

// ---- weights
const OU_REL = 40; // seconds a leaf's random walk takes to forget, at Pace 1
const OU_SD = 0.5; // standard deviation of the walk, in log weight
const SINE1 = [60, 150, 0.34], SINE2 = [100, 260, 0.24]; // period range in s at Pace 1, then the amplitude
const BURST_TAU = 6; // seconds a burst takes to fade, at Pace 1
const LIM = 2.1; // the log weight is held within this by a tanh
const G_REL = 80, G_SD = 0.3; // the group's own walk
const LAG = 1.1; // the layout reads the weights through two lags of LAG / (Pace + 1) seconds each
const ALIVE_T = 0.9; // seconds a group takes to follow the Groups knob
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


function gauss() {
  return sqrt(-2 * log(Math.random() + 1e-9)) * cos(TAU * Math.random());
}

function makeState() {
  const f = (n) => new Float64Array(n);
  const S = {
    ready: false, tt: 0, dis: 0,
    alive: f(NG), gy: f(NG), gw: f(NG),
    gx0: f(NG), gy0: f(NG), gx1: f(NG), gy1: f(NG), // the group rectangles
    hx0: f(NG), hy0: f(NG), hx1: f(NG), hy1: f(NG), // the same under the partition that is dissolving
    ou: f(NL), bs: f(NL), bloom: f(NL), w: f(NL), lw0: f(NL), lw: f(NL), ph1: f(NL), ph2: f(NL), p1: f(NL), p2: f(NL),
    dL: f(NL), dH: f(NL), dC: f(NL),
    tx0: f(NL), ty0: f(NL), tx1: f(NL), ty1: f(NL), // the leaf rectangles, for the growth
    rx0: f(NL), ry0: f(NL), rx1: f(NL), ry1: f(NL), // scratch for drawing
    ox0: f(NL), oy0: f(NL), ox1: f(NL), oy1: f(NL),
    lnA: f(NL), gr: f(NL),
    cr: f(NL), cg: f(NL), cb: f(NL),
    gst: null, gold: null, gp: 0, gt: 0,
    lst: [], lold: [], lp: f(NG), lt: f(NG),
    buf: new Float32Array(NPIX * 3), bufA: new Float32Array(NPIX * 3), bufB: new Float32Array(NPIX * 3), sb: new Float32Array(NPIX * 3),
  };
  for (let l = 0; l < NL; l++) {
    S.ou[l] = OU_SD * gauss();
    S.ph1[l] = Math.random() * TAU; S.ph2[l] = Math.random() * TAU;
    S.p1[l] = SINE1[0] + (SINE1[1] - SINE1[0]) * Math.random();
    S.p2[l] = SINE2[0] + (SINE2[1] - SINE2[0]) * Math.random();
    S.dL[l] = (Math.random() * 2 - 1) * 0.07;
    S.dH[l] = (Math.random() * 2 - 1) * 9;
    S.dC[l] = (Math.random() * 2 - 1) * 0.02;
  }
  for (let g = 0; g < NG; g++) { S.gy[g] = G_SD * gauss(); S.lst.push(null); S.lold.push(null); }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// ---- a row partition: which items share a row, and for each row whether it is a column on the left or a strip along the top.
// buildStruct runs the squarified algorithm (Bruls, Huizing, van Wijk 2000) on items off .. off + n of wt for a w by h
// rectangle and keeps only that partition. layoutStruct then gives every item its rectangle from the partition and the
// weights, so a tile's rectangle is a continuous function of the weights and no two tiles of a partition ever cross.
function mkStruct(n) {
  return { nr: 0, rs: new Int8Array(n + 1), rn: new Int8Array(n + 1), co: new Uint8Array(n + 1) };
}

function buildStruct(wt, off, n, w, h) {
  const st = mkStruct(n);
  let tot = 0;
  for (let i = 0; i < n; i++) tot += wt[off + i];
  if (w * h < 1e-6 || tot <= 0) { st.rs[0] = 0; st.rn[0] = n; st.co[0] = 1; st.nr = 1; return st; }
  const k = (w * h) / tot; // area for one unit of weight
  let i = 0;
  while (i < n) {
    const side = min(w, h);
    if (side < 1e-5) { st.rs[st.nr] = i; st.rn[st.nr] = n - i; st.co[st.nr] = 1; st.nr++; break; }
    const s2 = side * side;
    let a = wt[off + i] * k, sum = a, mx = a, mn = a;
    let worst = max((s2 * mx) / (sum * sum), (sum * sum) / (s2 * mn));
    let j = i + 1;
    while (j < n) {
      a = wt[off + j] * k;
      const ns = sum + a, nmx = max(mx, a), nmn = min(mn, a);
      const nw = max((s2 * nmx) / (ns * ns), (ns * ns) / (s2 * nmn));
      if (nw <= worst) { sum = ns; mx = nmx; mn = nmn; worst = nw; j++; } else break;
    }
    st.rs[st.nr] = i; st.rn[st.nr] = j - i; st.co[st.nr] = w >= h ? 1 : 0; st.nr++;
    const t = sum / side;
    if (w >= h) w -= t; else h -= t;
    i = j;
  }
  return st;
}

function layoutStruct(wt, off, st, x, y, w, h, o0, o1, o2, o3) {
  let rest = 0;
  for (let r = 0; r < st.nr; r++) for (let q = 0; q < st.rn[r]; q++) rest += wt[off + st.rs[r] + q];
  for (let r = 0; r < st.nr; r++) {
    const i0 = off + st.rs[r], c = st.rn[r];
    let s = 0;
    for (let q = 0; q < c; q++) s += wt[i0 + q];
    const frac = rest > 1e-12 ? s / rest : 1;
    if (st.co[r]) { // a column on the left, its tiles stacked
      const t = w * frac;
      let yy = y;
      for (let q = 0; q < c; q++) {
        const hh = s > 0 ? (h * wt[i0 + q]) / s : 0;
        o0[i0 + q] = x; o1[i0 + q] = yy; o2[i0 + q] = x + t; o3[i0 + q] = yy + hh;
        yy += hh;
      }
      x += t; w -= t;
    } else { // a strip along the top, its tiles side by side
      const t = h * frac;
      let xx = x;
      for (let q = 0; q < c; q++) {
        const ww = s > 0 ? (w * wt[i0 + q]) / s : 0;
        o0[i0 + q] = xx; o1[i0 + q] = y; o2[i0 + q] = xx + ww; o3[i0 + q] = y + t;
        xx += ww;
      }
      y += t; h -= t;
    }
    rest -= s;
  }
}

// the worst aspect ratio among the tiles that will show: rectangles with a shorter side under minSide, and groups that are leaving, are left out
function worstAspect(o0, o1, o2, o3, off, n, minSide) {
  let m = 1;
  for (let i = off; i < off + n; i++) {
    const w = o2[i] - o0[i], h = o3[i] - o1[i];
    const sh = w < h ? w : h;
    if (sh < minSide) continue;
    const a = (w < h ? h : w) / sh;
    if (a > m) m = a;
  }
  return m;
}

// ---- the weights
function stepWeights(S, d, pace, burst, G) {
  const dtE = d * pow(pace, 0.8); // time on the weights' own clock
  S.tt += dtE;
  const lam = 0.03 * sqrt(burst), amp = 0.45 + 1.25 * burst;
  const kOu = OU_SD * sqrt((2 * dtE) / OU_REL), kG = G_SD * sqrt((2 * dtE) / G_REL);
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

// ---- the layout. The layout reads the weights through two lags, which makes a burst a swell with no corner at its start.
const R0 = EDGE - GAP_GROUP / 2;
const INS = (GAP_GROUP - GAP_LEAF) / 2;

function groupRects(S, st, o0, o1, o2, o3) {
  layoutStruct(S.gw, 0, st, R0, R0, W - 2 * R0, H - 2 * R0, o0, o1, o2, o3);
}

// the rectangle the leaves of group g are laid into: the group's own, less the half gap
function inner(a0, a1, a2, a3, g, out) {
  let x = a0[g], y = a1[g], w = a2[g] - x, h = a3[g] - y;
  const nw = max(w - 2 * INS, 0), nh = max(h - 2 * INS, 0);
  out[0] = x + (w - nw) / 2; out[1] = y + (h - nh) / 2; out[2] = nw; out[3] = nh;
}
const IN = [0, 0, 0, 0];

function layoutStep(S, d, pace, snap) {
  const k = snap ? 1 : 1 - exp(-d * (pace + 1) / LAG);
  for (let l = 0; l < NL; l++) { S.lw0[l] += (S.w[l] - S.lw0[l]) * k; S.lw[l] += (S.lw0[l] - S.lw[l]) * k; }
  for (let g = 0; g < NG; g++) {
    let sum = 0;
    for (let q = 0; q < COUNTS[g]; q++) sum += S.lw[START[g] + q];
    const n = COUNTS[g];
    S.gw[g] = max(1e-5, ss(S.alive[g]) * exp(S.gy[g]) * n * pow(sum / n, 0.25));
  }
  const dur = DISSOLVE / (pace + 1);
  if (snap) S.gst = buildStruct(S.gw, 0, NG, W - 2 * R0, H - 2 * R0);
  groupRects(S, S.gst, S.gx0, S.gy0, S.gx1, S.gy1);
  if (S.gold) {
    groupRects(S, S.gold, S.hx0, S.hy0, S.hx1, S.hy1);
    S.gp += d;
    if (S.gp >= dur) S.gold = null;
  }
  S.gt += d;
  // the groups: a new partition once the worst tile that shows is too long and thin, and the new one is a good deal better
  if (!snap && !S.gold && S.gt > HOLD) {
    let bad = 1;
    for (let g = 0; g < NG; g++) {
      if (S.alive[g] < 0.5) continue;
      const w = S.gx1[g] - S.gx0[g], h = S.gy1[g] - S.gy0[g], sh = min(w, h);
      if (sh >= 8) bad = max(bad, max(w, h) / sh);
    }
    if (bad > BAD_G) {
      const cand = buildStruct(S.gw, 0, NG, W - 2 * R0, H - 2 * R0);
      groupRects(S, cand, S.hx0, S.hy0, S.hx1, S.hy1);
      let cb = 1;
      for (let g = 0; g < NG; g++) {
        if (S.alive[g] < 0.5) continue;
        const w = S.hx1[g] - S.hx0[g], h = S.hy1[g] - S.hy0[g], sh = min(w, h);
        if (sh >= 8) cb = max(cb, max(w, h) / sh);
      }
      if (cb < BETTER * bad) {
        S.gold = S.gst; S.gst = cand; S.gp = 0; S.gt = 0;
        S.dis++;
        groupRects(S, S.gold, S.hx0, S.hy0, S.hx1, S.hy1);
        groupRects(S, S.gst, S.gx0, S.gy0, S.gx1, S.gy1);
      }
    }
  }
  // the leaves of each group
  for (let g = 0; g < NG; g++) {
    inner(S.gx0, S.gy0, S.gx1, S.gy1, g, IN);
    if (snap) S.lst[g] = buildStruct(S.lw, START[g], COUNTS[g], IN[2], IN[3]);
    layoutStruct(S.lw, START[g], S.lst[g], IN[0], IN[1], IN[2], IN[3], S.tx0, S.ty0, S.tx1, S.ty1);
    if (S.lold[g]) { S.lp[g] += d; if (S.lp[g] >= dur) S.lold[g] = null; }
    S.lt[g] += d;
    if (snap || S.lold[g] || S.lt[g] <= HOLD || S.alive[g] < 0.5) continue;
    const bad = worstAspect(S.tx0, S.ty0, S.tx1, S.ty1, START[g], COUNTS[g], 5);
    if (bad <= BAD_L) continue;
    const cand = buildStruct(S.lw, START[g], COUNTS[g], IN[2], IN[3]);
    layoutStruct(S.lw, START[g], cand, IN[0], IN[1], IN[2], IN[3], S.rx0, S.ry0, S.rx1, S.ry1);
    if (worstAspect(S.rx0, S.ry0, S.rx1, S.ry1, START[g], COUNTS[g], 5) < BETTER * bad) {
      S.lold[g] = S.lst[g]; S.lst[g] = cand; S.lp[g] = 0; S.lt[g] = 0;
      S.dis++;
    }
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
      const gs = tanh(S.gr[l] / 0.13); // growing is positive
      const bl = S.bloom[l];
      const L = cl(G[1] + S.dL[l] + (gs > 0 ? 0.1 : 0.075) * gs + 0.07 * bl, 0.34, 0.86);
      const C = max(0.02, G[2] * (1 + 0.2 * gs) + S.dC[l]);
      const c = oklch(L, C, G[0] + hue * 360 + S.dH[l] - 9 * gs);
      S.cr[l] = c[0]; S.cg[l] = c[1]; S.cb[l] = c[2];
    }
  }
}

function frame(S, d, snap, kn) {
  const pace = cl(kn[1], 0.35, 3), burst = cl(kn[3], 0, 1), G = 7 + cl(kn[2], -4, 2);
  if (snap) {
    for (let g = 0; g < NG; g++) S.alive[g] = cl(G - g, 0, 1);
    // the weights are already wandering when the panel opens: 24 s of them, with the knobs where they stand
    for (let k = 0; k < 240; k++) stepWeights(S, 0.1, pace, burst, G);
  } else {
    stepWeights(S, d, pace, burst, G);
  }
  layoutStep(S, d, pace, snap);
  const kr = 1 - exp(-d / 0.9);
  for (let l = 0; l < NL; l++) {
    const ln = log(max(1, (S.tx1[l] - S.tx0[l]) * (S.ty1[l] - S.ty0[l])));
    if (snap) { S.lnA[l] = ln; S.gr[l] = 0; continue; }
    const rate = d > 0 ? (ln - S.lnA[l]) / d : 0;
    S.lnA[l] = ln;
    S.gr[l] += (cl(rate, -3, 3) - S.gr[l]) * kr;
  }
  colours(S, kn[0]);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.pace = cl(kn[1], 0.35, 3);
  if (!S.ready) {
    S.ready = true;
    frame(S, 0, true, kn);
    return;
  }
  frame(S, d, false, kn);
}

// ---- drawing. One tile at a time, rectangle a0..a3 of leaf l, onto buf.
function drawTile(S, buf, l, a0, a1, a2, a3) {
  const ins = GAP_LEAF / 2;
  const x0 = a0[l] + ins, y0 = a1[l] + ins, x1 = a2[l] - ins, y1 = a3[l] - ins;
  const w = x1 - x0, h = y1 - y0;
  if (w < 0.4 || h < 0.4) return;
  const m = min(w, h);
  const op = ss((m - FADE_LO) / (FADE_HI - FADE_LO)) * ss(S.alive[gOf(l)] / 0.2);
  if (op < 0.01) return;
  const bloom = S.bloom[l] > 0.03 ? S.bloom[l] * op : 0;
  const rad = min(1.3, 0.3 * m);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = w / 2 - rad, hy = h / 2 - rad;
  const R = S.cr[l], G = S.cg[l], B = S.cb[l];
  const pad = bloom > 0 ? 3 : 1;
  const xa = max(0, floor(x0 - pad)), xb = min(W - 1, ceil(x1 + pad));
  const ya = max(0, floor(y0 - pad)), yb = min(H - 1, ceil(y1 + pad));
  for (let py = ya; py <= yb; py++) {
    const qy = abs(py + 0.5 - cy) - hy;
    const v = cl((py + 0.5 - y0) / h, 0, 1);
    for (let px = xa; px <= xb; px++) {
      const qx = abs(px + 0.5 - cx) - hx;
      const sdf = (qx > 0 && qy > 0 ? sqrt(qx * qx + qy * qy) : max(qx, qy)) - rad;
      const k = (py * W + px) * 3;
      let cov = 0.5 - sdf;
      if (cov <= 0) {
        if (bloom > 0 && sdf < 3) { // a surge throws a short halo
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
      const lift = 255 * (0.1 * exp(-(du * du + dv * dv) / 0.035) + bloom * 0.2) * 0.6;
      const a = cov * op;
      buf[k] += (min(255, R * shade + lift) - buf[k]) * a;
      buf[k + 1] += (min(255, G * shade + lift) - buf[k + 1]) * a;
      buf[k + 2] += (min(255, B * shade + lift) - buf[k + 2]) * a;
    }
  }
}

const GI = new Uint8Array(NL);
for (let g = 0; g < NG; g++) for (let q = 0; q < COUNTS[g]; q++) GI[START[g] + q] = g;
const gOf = (l) => GI[l];

function fillBg(buf, xa, xb, ya, yb) {
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) { const k = (y * W + x) * 3; buf[k] = BG[0]; buf[k + 1] = BG[1]; buf[k + 2] = BG[2]; }
}

// the whole panel for one set of group rectangles. A group whose leaf partition is being replaced is drawn twice: the old
// one as it was, then the new one into a scratch buffer, and the two are mixed inside the group's rectangle by the dissolve.
function renderPanel(S, buf, A0, A1, A2, A3) {
  fillBg(buf, 0, W - 1, 0, H - 1);
  for (let g = 0; g < NG; g++) {
    if (S.alive[g] < 0.02) continue;
    inner(A0, A1, A2, A3, g, IN);
    const lo = S.lold[g], n = COUNTS[g], s0 = START[g];
    if (lo) layoutStruct(S.lw, s0, lo, IN[0], IN[1], IN[2], IN[3], S.ox0, S.oy0, S.ox1, S.oy1);
    layoutStruct(S.lw, s0, S.lst[g], IN[0], IN[1], IN[2], IN[3], S.rx0, S.ry0, S.rx1, S.ry1);
    if (!lo) {
      for (let q = 0; q < n; q++) drawTile(S, buf, s0 + q, S.rx0, S.ry0, S.rx1, S.ry1);
      continue;
    }
    for (let q = 0; q < n; q++) drawTile(S, buf, s0 + q, S.ox0, S.oy0, S.ox1, S.oy1);
    const xa = max(0, floor(A0[g])), xb = min(W - 1, ceil(A2[g]) - 1), ya = max(0, floor(A1[g])), yb = min(H - 1, ceil(A3[g]) - 1);
    fillBg(S.sb, xa, xb, ya, yb);
    for (let q = 0; q < n; q++) drawTile(S, S.sb, s0 + q, S.rx0, S.ry0, S.rx1, S.ry1);
    const p = ss(S.lp[g] / (DISSOLVE / (S.pace + 1)));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const k = (y * W + x) * 3;
        buf[k] += (S.sb[k] - buf[k]) * p; buf[k + 1] += (S.sb[k + 1] - buf[k + 1]) * p; buf[k + 2] += (S.sb[k + 2] - buf[k + 2]) * p;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  let buf = S.buf;
  if (S.gold) {
    // the groups' partition is being replaced: the panel drawn under the old one and under the new one, mixed
    renderPanel(S, S.bufA, S.hx0, S.hy0, S.hx1, S.hy1);
    renderPanel(S, S.bufB, S.gx0, S.gy0, S.gx1, S.gy1);
    const p = ss(S.gp / (DISSOLVE / (S.pace + 1)));
    for (let i = 0; i < NPIX * 3; i++) S.buf[i] = S.bufA[i] + (S.bufB[i] - S.bufA[i]) * p;
  } else {
    renderPanel(S, buf, S.gx0, S.gy0, S.gx1, S.gy1);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[k]) | 0, min(255, buf[k + 1]) | 0, min(255, buf[k + 2]) | 0);
    }
  }
}
