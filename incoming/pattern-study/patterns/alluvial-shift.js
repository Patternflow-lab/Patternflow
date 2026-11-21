// ===== Patternflow pattern =====
// Title:   Alluvial Shift
// Family:  alluvial
// Idea:    An alluvial diagram of four moments stacked down the panel, where coloured module bars swell, shrink, slide past each other and fade out and back, and glowing ribbons carry their members from each moment to the next.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: alluvial diagrams (Martin Rosvall and Carl Bergstrom, "Mapping change in large networks", PLoS ONE, 2010); Sankey diagrams (Matthew Sankey, 1898); iterative proportional fitting (W. Edwards Deming and Frederick Stephan, 1940; Richard Sinkhorn, 1964)
// Round:   214
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Churn=0.2..3, Modules=-2..2, Mixing=0..1
//
// Knob 1: Hue. Adds the knob to the hue of every module, so one turn comes back to where it began. At 0 the five modules are coral, amber, teal, azure and violet. At 0.5 coral has become cyan, amber azure, teal red, azure orange and violet green, and at 0.25 coral is yellow-green, teal violet-blue, amber green, azure magenta and violet coral. Ribbons of yellow and orange are laid harder than the rest, so no hue sinks to brown.
// Knob 2: Churn. How fast the modules swell, shrink and change places, from 0.2 to 3. The Lab opens it at 2, and the base rate is set so that 2 is a calm morph. The clock for sizes and for order runs at 0.22 times the knob a second. Measured on the opening picture, a bar's width changes by 0.14 LED a second at 0.2, 1.4 at 2 and 2.0 at 3, and one bar passes another, counting the four tiers together, 3 times a minute at 0.2, 29 at 2 and 42 at 3. The bars follow their ranks with a spring that settles in about 26 s at 0.2, 4 s at 2 and 3 s at 3.
// Knob 3: Modules. How many module identities are alive, as 5 plus the knob: 3 at -2, 5 at the opening 0 and 7 at 2. The count is continuous. Module i has the weight of a smoothstep of the count minus its place, so between -1 and 0 the azure bar thins from full width to nothing while the others widen to fill the row, between -2 and -1 amber goes the same way and coral, teal and violet are left, and the two extras, green and rose, come in between 0 and 1 and between 1 and 2. A bar is 21 LEDs wide on average at 3 modules, 13 at 5 and 9 at 7, and the picture carries 14 ribbons at 3, 22 at 5 and 28 at 7. The count follows the knob with a 0.3 s lag, so a jump from 0 to -2 is a fade of about a second.
// Knob 4: Mixing. How far members move to other modules between two moments. Measured as the share of members that stay in their own module, averaged over time and over the three gaps between tiers: 0.73 at 0 (not 1, since a module that grows from one tier to the next must take members from another), 0.72 at the opening 0.06, 0.70 at 0.25, 0.59 at 0.5, 0.42 at 0.75 and 0.30 at 1. At 0 every ribbon runs down its own module and only what a module gains or loses crosses to a neighbour; at 1 each module sends members to all the others and the ribbons braid across the whole width. The picture carries 22 ribbons at 0.06, 30 at 0.5 and 38 at 1.

// The picture is Rosvall and Bergstrom's. There are four moments, one to a tier, and
// seven module identities, each with a fixed colour. In a tier the modules sit side by
// side as bars, each as wide as its share of the members. Between two tiers a ribbon
// runs from module i above to module j below, as wide as the share of members that go
// from i to j. Its edges are S-curves (smoothstep over the rows between the bars), so
// it leaves its bar and arrives at its bar straight down, and its width along any row
// is the blend of its widths at both ends. A steep S would leave a thin ribbon across
// its own line, so the width along a row is kept above what gives two LEDs across the
// line. Thick ribbons keep their edges and thin ones are held at two LEDs.
//
// Nothing scrolls and nothing repeats. The size of a module in a tier is a smooth
// positive function of the clock: two sines and a small third one, whose rates are all
// different and not multiples of each other, pushed through a power so that a module
// now and then runs down to nothing and comes back. Each tier takes the same sines at
// a different phase, so a tier looks like the tier above a little later, and the ribbons
// between them mostly stay in their own module. The sizes of a tier are scaled to add
// up to 1 over the modules that are alive.
//
// The members that move are found by iterative proportional fitting. The affinity of
// module i above to module j below is large on the diagonal (members stay), falls off
// with the distance between the two bars, and has a slowly changing weight for each
// pair, so that who trades with whom drifts. Rows and columns are then scaled in turn
// until the row sums are the sizes above and the column sums the sizes below. A ribbon
// narrower than about two LEDs is given a small weight and the fit is run again, so its
// members go into ribbons that can be seen. A ribbon that is still under 2 LEDs at
// either end is drawn fainter, and gone below 1.5.
//
// The order of the bars in a tier comes from a second set of slow sines, one for each
// module and tier. A module's rank is how many other modules its key is above, each counted
// by a smoothstep over a small difference of keys, so it is a whole number while the keys
// are apart and passes through the numbers between while two keys cross. Every module has a
// position that follows its rank with a critically damped spring, and the bars are laid out
// by the same kind of smooth count of how many modules are to the left of each, so when two
// exchange places they slide through each other, one over the other, with no jump. A module
// that has run down to nothing takes its rank at once, where nobody can see it. The ribbons
// leaving a bar are stacked in the order of the bars they arrive at, and the ribbons
// arriving in the order of the bars they come from, by a smooth count again, so ribbons
// trade places without a jump too.
//
// A ribbon is its source module's colour laid at 0.6 to 0.82, by hue. Ribbons add in a
// float buffer and the sum is rolled off softly above 0.85, so where two ribbons cross the
// colours mix and glow, to white for complementary hues. The bars are painted over them,
// solid and a little paler, with a dark LED between neighbours. The share of an LED that
// an edge covers goes through a smoothstep so the edges stay crisp. The background is a
// deep plum-black.

const W = 64, H = 128, N = W * H;
const M = 7; // module identities
const T = 4; // tiers
const { floor, ceil, min, max, sin, cos, exp, sqrt, pow, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// ---- the page
const TOPS = [9, 43, 77, 111]; // the first row of each tier's bars
const BH = 8; // bar height, rows
const SPAN = 63; // the bars fill the row from x 0.5 to 63.5
const X0 = 0.5;
const RATE = 0.22; // the clock runs at churn times this
const TAU0 = 14; // where the clock opens

// ---- the modules
const HUE = [0.015, 0.485, 0.765, 0.105, 0.6, 0.31, 0.92]; // coral, teal, violet, amber, azure, green, rose
const SAT = [0.74, 0.86, 0.68, 0.9, 0.82, 0.76, 0.66];
// Rates of the three sines of a module's size, and of the two of its order key.
const SA = [0.2113, 0.3177, 0.2631, 0.3791, 0.2399, 0.3473, 0.2937];
const SB = [0.5231, 0.6173, 0.5713, 0.4671, 0.6591, 0.4317, 0.5937];
const SC = [0.8719, 0.7933, 0.9437, 0.8311, 0.7589, 0.9109, 0.8627];
const OA = [0.0779, 0.0601, 0.0967, 0.0680, 0.0859, 0.0650, 0.0907];
const OB = [0.0392, 0.0515, 0.0339, 0.0456, 0.0419, 0.0380, 0.0488];
const KEYSOFT = 0.18; // how far apart two order keys must be before their modules have changed places
const PH = (i, n) => i * 2.3999632 * n + 0.7 * n; // a phase for module i, spread by the golden angle
const TIER_PH = [1.0, 1.2, 0.9]; // how far each sine moves from one tier to the next

// ---- the ribbons
// How strongly a ribbon of hue h is laid, about 0.6: yellow and orange are laid harder, since
// they sink to brown and olive when dim, and so is blue, which looks dark at the same level.
const hueGap = (h, c) => abs(((h - c + 1.5) % 1) - 0.5);
const ribbonAlpha = (h) => 0.62 + 0.2 * exp(-((hueGap(h, 0.13) / 0.13) ** 2)) + 0.16 * exp(-((hueGap(h, 0.62) / 0.1) ** 2)) - 0.04 * exp(-((hueGap(h, 0.5) / 0.08) ** 2));
const BAR_V = [0.97, 0.86, 0.97, 0.95, 0.97, 0.9, 0.97]; // bars are paler than their ribbons, and teal and green are held back from neon
const BG = [14, 4, 19];
const TMIN = 2; // the least a ribbon is across its own line, LEDs
// The diagonal's weight against a typical other pair, as its logarithm at a few places of Mixing,
// joined by straight lines: members hardly leave at 0, and by 1 a module sends more
// members away than it keeps.
const STAY_AT = [[0, 6.2], [0.06, 3.3], [0.25, 1.5], [0.5, 0.45], [0.75, -0.3], [1, -1.1]];
function stayWeight(m) {
  let k = 0;
  while (k < STAY_AT.length - 2 && m > STAY_AT[k + 1][0]) k++;
  const a = STAY_AT[k], b = STAY_AT[k + 1];
  return 0.2 * exp(a[1] + ((b[1] - a[1]) * cl((m - a[0]) / (b[0] - a[0]), 0, 1)));
}

export function setup(params) {
  params.s = {
    init: false, tau: TAU0, c: 5, m: 0, hue: 0, churn: 2,
    buf: new Float32Array(N * 3),
    sz: new Float64Array(T * M),
    p: new Float64Array(T * M), v: new Float64Array(T * M), rank: new Float64Array(T * M),
    bx: new Float64Array(T * M), bw: new Float64Array(T * M),
    flow: new Float64Array((T - 1) * M * M),
    rib: [], built: false,
    tmp: { A: new Float64Array(M * M), F: new Float64Array(M * M), u: new Float64Array(M), w: new Float64Array(M), key: new Float64Array(M), },
    col: new Float64Array(M * 3), barCol: new Float64Array(M * 3), alpha: new Float64Array(M), colKey: "",
  };
}

// ---- sizes and orders at a clock reading
function sizesAt(S) {
  const tau = S.tau, c = S.c, sz = S.sz;
  for (let k = 0; k < T; k++) {
    let sum = 0;
    for (let i = 0; i < M; i++) {
      const x =
        (0.5 * sin(SA[i] * tau + PH(i, 1) + k * TIER_PH[0]) +
          0.4 * sin(SB[i] * tau + PH(i, 2) + k * TIER_PH[1]) +
          0.25 * sin(SC[i] * tau + PH(i, 3) + k * TIER_PH[2] * 2.7)) / 1.15;
      const base = 0.02 + pow(max(0, x + 0.8) / 1.8, 1.35);
      const a = ss(cl(c - i, 0, 1));
      const v = base * a;
      sz[k * M + i] = v;
      sum += v;
    }
    for (let i = 0; i < M; i++) sz[k * M + i] /= sum;
  }
}

// Where each module stands in the order of its tier, as a smooth rank: how many of the other
// modules its key is above, each counted by a smoothstep over KEYSOFT of difference in key.
// A rank is a whole number while the keys are apart, and passes through the numbers between
// while two keys cross, so no module ever changes rank in one step.
function ranksAt(S) {
  const tau = S.tau, key = S.tmp.key;
  for (let k = 0; k < T; k++) {
    for (let i = 0; i < M; i++)
      key[i] = sin(OA[i] * tau + PH(i, 4) + k * 0.9) + 0.6 * sin(OB[i] * tau + PH(i, 5) + k * 1.2);
    for (let i = 0; i < M; i++) {
      let r = 0;
      for (let j = 0; j < M; j++) if (j !== i) r += ss(0.5 + (key[i] - key[j]) / (2 * KEYSOFT));
      S.rank[k * M + i] = r;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const churn = cl(kv[1], 0.2, 3), cT = 5 + cl(kv[2], -2, 2), mT = cl(kv[3], 0, 1);
  S.hue = kv[0];
  S.churn = churn;
  if (!S.init) {
    S.init = true;
    S.c = cT;
    S.m = mT;
    sizesAt(S);
    ranksAt(S);
    S.p.set(S.rank);
  }
  S.c += (cT - S.c) * (1 - exp(-d / 0.3));
  S.m += (mT - S.m) * (1 - exp(-d / 0.3));
  S.tau += d * churn * RATE;
  sizesAt(S);
  ranksAt(S);
  // Each position follows its rank with a critically damped spring, in steps of
  // a sixtieth of a second so the stiffest setting stays stable.
  const om = 0.65 * pow(churn, 0.8);
  const n = max(1, ceil(d * 60)), h = d / n;
  for (let s = 0; s < n; s++)
    for (let j = 0; j < T * M; j++) {
      const acc = om * om * (S.rank[j] - S.p[j]) - 2 * om * S.v[j];
      S.v[j] += acc * h;
      S.p[j] += S.v[j] * h;
    }
  // A module with no width takes its place at once.
  for (let j = 0; j < T * M; j++)
    if (S.sz[j] < 0.004) {
      S.p[j] = S.rank[j];
      S.v[j] = 0;
    }
  build(S);
}

// ---- geometry
// Where each bar of a tier stands, in LEDs: its left edge bx and its width bw.
// A bar's left edge is the sum of the sizes of the modules to its left, each
// counted by a smooth step of how far to the left it is, so bars that exchange
// places slide through each other.
function layout(S, k) {
  const sz = S.sz, p = S.p, bx = S.bx, bw = S.bw, o = k * M;
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < M; i++) {
    if (sz[o + i] < 1e-6) {
      bx[o + i] = 0;
      continue;
    }
    let l = 0;
    for (let j = 0; j < M; j++)
      if (j !== i && sz[o + j] >= 1e-6) l += sz[o + j] * ss(0.5 + p[o + i] - p[o + j]);
    bx[o + i] = l;
    mn = min(mn, l);
    mx = max(mx, l + sz[o + i]);
  }
  const sc = SPAN / (mx - mn);
  for (let i = 0; i < M; i++) {
    if (sz[o + i] < 1e-6) {
      bw[o + i] = 0;
      continue;
    }
    bx[o + i] = X0 + (bx[o + i] - mn) * sc;
    bw[o + i] = sz[o + i] * sc;
  }
}

// Iterative proportional fitting: scale the rows and columns of A in turn until
// its row sums are r and its column sums c.
function fit(A, r, c, F, u, w) {
  for (let i = 0; i < M; i++) u[i] = 1;
  for (let j = 0; j < M; j++) w[j] = 1;
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < M; i++) {
      let s = 0;
      for (let j = 0; j < M; j++) s += A[i * M + j] * w[j];
      u[i] = r[i] > 1e-9 && s > 0 ? r[i] / s : 0;
    }
    for (let j = 0; j < M; j++) {
      let s = 0;
      for (let i = 0; i < M; i++) s += A[i * M + j] * u[i];
      w[j] = c[j] > 1e-9 && s > 0 ? c[j] / s : 0;
    }
  }
  for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) F[i * M + j] = u[i] * A[i * M + j] * w[j];
}

function pairWeight(S, k, i, j) {
  // A slow weight in 0.3..1 for each pair at each gap.
  const t = S.tau;
  return 0.65 + 0.35 * sin(0.083 * (1 + ((i * 7 + j * 3 + k) % 5) * 0.21) * t + i * 1.7 + j * 2.9 + k * 1.3);
}

function build(S) {
  for (let k = 0; k < T; k++) layout(S, k);
  const { A, F, u, w } = S.tmp, m = S.m;
  const stay = stayWeight(m);
  const lam = 0.3 + 0.9 * m;
  const off = 0.05 + 0.3 * m;
  const r = new Float64Array(M), c = new Float64Array(M);
  const U = SPAN - 1;
  const ribs = [];
  for (let k = 0; k < T - 1; k++) {
    const o = k * M, o2 = (k + 1) * M;
    for (let i = 0; i < M; i++) {
      r[i] = S.sz[o + i];
      c[i] = S.sz[o2 + i];
    }
    for (let i = 0; i < M; i++)
      for (let j = 0; j < M; j++) {
        const dc = (S.bx[o + i] + S.bw[o + i] / 2 - (S.bx[o2 + j] + S.bw[o2 + j] / 2)) / SPAN;
        const loc = exp(-((dc / lam) * (dc / lam)));
        A[i * M + j] = (i === j ? stay : 0) + off * pairWeight(S, k, i, j) * loc;
      }
    fit(A, r, c, F, u, w);
    // Give up the ribbons that would be too thin to see, and fit again.
    for (let i = 0; i < M; i++)
      for (let j = 0; j < M; j++) A[i * M + j] *= 0.05 + 0.95 * ss((F[i * M + j] * U - 1.2) / 1.1);
    fit(A, r, c, F, u, w);
    for (let i = 0; i < M * M; i++) S.flow[k * M * M + i] = F[i];
  }
  // The ribbons as edges.
  ribs.length = 0;
  for (let k = 0; k < T - 1; k++) {
    const o = k * M, o2 = (k + 1) * M, f = k * M * M;
    for (let i = 0; i < M; i++) {
      const si = S.sz[o + i];
      if (si < 1e-6) continue;
      for (let j = 0; j < M; j++) {
        const sj = S.sz[o2 + j], mass = S.flow[f + i * M + j];
        if (sj < 1e-6 || mass < 1e-5) continue;
        // Share of the bar above and of the bar below, and where the ribbon's
        // slot starts in each, by a smooth count of the ribbons to its left.
        const fa = mass / si, fb = mass / sj;
        let la = 0;
        for (let j2 = 0; j2 < M; j2++) {
          if (j2 === j) continue;
          const m2 = S.flow[f + i * M + j2];
          if (m2 < 1e-5 || S.sz[o2 + j2] < 1e-6) continue;
          la += (m2 / si) * ss(0.5 + (S.bx[o2 + j] + S.bw[o2 + j] / 2 - S.bx[o2 + j2] - S.bw[o2 + j2] / 2) / 8);
        }
        let lb = 0;
        for (let i2 = 0; i2 < M; i2++) {
          if (i2 === i) continue;
          const m2 = S.flow[f + i2 * M + j];
          if (m2 < 1e-5 || S.sz[o + i2] < 1e-6) continue;
          lb += (m2 / sj) * ss(0.5 + (S.bx[o + i] + S.bw[o + i] / 2 - S.bx[o + i2] - S.bw[o + i2] / 2) / 8);
        }
        const iwa = max(0, S.bw[o + i] - 1), iwb = max(0, S.bw[o2 + j] - 1);
        const ta = S.bx[o + i] + 0.5 + la * iwa, wa = fa * iwa;
        const tb = S.bx[o2 + j] + 0.5 + lb * iwb, wb = fb * iwb;
        const q = min(wa, wb);
        const al = ss((q - 1.5) / 0.6);
        if (al <= 0.002) continue;
        ribs.push({ k, i, ta, wa, tb, wb, al });
      }
    }
  }
  S.rib = ribs;
  S.built = true;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
}

function palette(S) {
  const key = S.hue.toFixed(4);
  if (key === S.colKey) return;
  S.colKey = key;
  for (let i = 0; i < M; i++) {
    hsv(HUE[i] + S.hue, SAT[i], 1, S.col, i * 3);
    hsv(HUE[i] + S.hue, SAT[i] * 0.72, BAR_V[i], S.barCol, i * 3);
    S.alpha[i] = ribbonAlpha(HUE[i] + S.hue);
  }
}

// Add colour over the columns of [xl, xr] on one row, by how much of each LED the span covers.
// The share is passed through a smoothstep so a sliver of an LED stays dark and the edge is crisp.
function addSpan(buf, y, xl, xr, r, g, b) {
  if (xr <= xl) return;
  const x0 = max(0, floor(xl)), x1 = min(W - 1, ceil(xr) - 1);
  for (let x = x0; x <= x1; x++) {
    const cov = ss(min(x + 1, xr) - max(x, xl));
    if (cov <= 0) continue;
    const p = (y * W + x) * 3;
    buf[p] += r * cov;
    buf[p + 1] += g * cov;
    buf[p + 2] += b * cov;
  }
}

function paintSpan(buf, y, xl, xr, r, g, b, al) {
  if (xr <= xl) return;
  const x0 = max(0, floor(xl)), x1 = min(W - 1, ceil(xr) - 1);
  for (let x = x0; x <= x1; x++) {
    const cov = ss(min(x + 1, xr) - max(x, xl)) * al;
    if (cov <= 0) continue;
    const p = (y * W + x) * 3;
    buf[p] += (r - buf[p]) * cov;
    buf[p + 1] += (g - buf[p + 1]) * cov;
    buf[p + 2] += (b - buf[p + 2]) * cov;
  }
}

const SHOULDER = 0.85;
const roll = (x) => (x <= SHOULDER ? x : SHOULDER + (1 - SHOULDER) * (1 - exp(-(x - SHOULDER) / (1 - SHOULDER))));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.built) return;
  palette(S);
  const buf = S.buf;
  buf.fill(0);
  // Ribbons.
  for (const R of S.rib) {
    const yt = TOPS[R.k] + BH, yb = TOPS[R.k + 1];
    const a = R.al * S.alpha[R.i];
    const cr = S.col[R.i * 3] * a, cg = S.col[R.i * 3 + 1] * a, cb = S.col[R.i * 3 + 2] * a;
    const ca = R.ta + R.wa / 2, cb2 = R.tb + R.wb / 2, dx = cb2 - ca, span = yb - yt;
    for (let y = yt; y < yb; y++) {
      const t = (y + 0.5 - yt) / span, u = ss(t);
      // The edges are S-curves, so the band is as wide along the row as the blend of its
      // two ends. Where the line runs steeply that would leave a thin band across the line,
      // so the width along the row is kept above what gives the band TMIN across it.
      const sl = (6 * t * (1 - t) * dx) / span;
      const hw = max(R.wa + (R.wb - R.wa) * u, TMIN * sqrt(1 + sl * sl)) / 2;
      const xc = ca + dx * u;
      addSpan(buf, y, xc - hw, xc + hw, cr, cg, cb);
    }
  }
  // Bars, painted over the ribbons.
  for (let k = 0; k < T; k++)
    for (let i = 0; i < M; i++) {
      const bw = S.bw[k * M + i];
      const iw = bw - 1;
      if (iw <= 0.05) continue;
      const al = ss((iw - 1) / 1.2);
      const xl = S.bx[k * M + i] + 0.5;
      for (let y = TOPS[k]; y < TOPS[k] + BH; y++)
        paintSpan(buf, y, xl, xl + iw, S.barCol[i * 3], S.barCol[i * 3 + 1], S.barCol[i * 3 + 2], al);
    }
  // Out to the panel: a soft shoulder over the sum, on a plum-black ground.
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) {
      const r = BG[0] + (255 - BG[0]) * roll(buf[p]);
      const g = BG[1] + (255 - BG[1]) * roll(buf[p + 1]);
      const b = BG[2] + (255 - BG[2]) * roll(buf[p + 2]);
      display.setPixel(x, y, r, g, b);
    }
}
