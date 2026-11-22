// ===== Patternflow pattern =====
// Title:   Clonal Sweep
// Family:  clonal
// Idea:    A Muller plot of an evolving cell population pours down the panel, one real Wright-Fisher generation at a time, with nested colour bands for clones, thin buds that mostly die and a few that swell and push their parent out to the edges.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Muller plot, a chart of clone sizes over time with each descendant drawn inside its parent, named for Hermann Joseph Muller; the population model is Wright-Fisher (Sewall Wright 1931, R. A. Fisher 1930) with selection, drift and mutation; two beneficial mutants rising together and the loser sinking is clonal interference (Philip Gerrish and Richard Lenski, 1998). Pattern round 220.
// Round:   220
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3.5, Selection=-1..1, Size=-1..1
//
// Knob 1: Hue.
// Knob 2: Flow.
// Knob 3: Selection.
// Knob 4: Size.

const W = 64, H = 128;
const HR = 136; // rows of history kept
const MAXC = 72; // clone slots
const CAPLIVE = 48; // most clones with cells in them at once; the smallest folds back past it
const NVIS = 4; // cells a clone needs before it is drawn
const M0 = 2.3; // narrowest a bud is drawn, LEDs
const GROW = 5; // rows a bud takes to open to full width
const FADE = 7; // rows a dead clone's tip takes to close
const ALPHA = 0.5; // how much of a generation's change in frequency a row takes
const ANCHOR = 0.58; // hue the family tree is pulled toward at Hue 0
const HW = 0.85; // half width of a soft edge between two bands, LEDs
const { floor, min, max, exp, sqrt, log, abs, cos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const gauss = () => sqrt(-2 * log(Math.random() + 1e-12)) * cos(2 * PI * Math.random());

// Cell counts for one clone in the next generation: Poisson with the mean the selection step left it.
function poisson(l) {
  if (l <= 0) return 0;
  if (l < 24) {
    const L = exp(-l);
    let k = 0, p = Math.random();
    while (p > L) {
      k++;
      p *= Math.random();
    }
    return k;
  }
  const v = l + sqrt(l) * gauss();
  return v > 0 ? floor(v + 0.5) : 0;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const S = {
    ready: false, row: 0, phi: 0, gacc: 0, T: 1000,
    k1: 0, sel: 0.075, N: 1600, lam: 0.1, rowT: 0.16, gpr: 1.7,
    used: new Uint8Array(MAXC), vis: new Uint8Array(MAXC), n: new Float64Array(MAXC), sf: new Float64Array(MAXC), par: new Int16Array(MAXC),
    hue: f(MAXC), sat: f(MAXC), val: f(MAXC), ord: f(MAXC), bias: f(MAXC), ft: f(MAXC),
    born: new Float64Array(MAXC), dead: new Float64Array(MAXC), shown: new Uint8Array(MAXC),
    kids: Array.from({ length: MAXC }, () => []), kc: new Int16Array(MAXC),
    subR: f(MAXC), D: f(MAXC), live: new Uint8Array(MAXC), wt: new Float64Array(MAXC), pre: [],
    segW: f(MAXC * 3), segC: new Int16Array(MAXC * 3), ns: 0,
    sH: f(MAXC * 3), sS: f(MAXC * 3), sV: f(MAXC * 3), sB: f(MAXC * 3),
    HH: f(HR * W), HS: f(HR * W), HV: f(HR * W), head: 0,
  };
  S.byOrd = (a, b) => S.ord[a] - S.ord[b];
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const u = (cl(k[1], 0.5, 3.5) - 0.5) / 3;
  S.k1 = k[0];
  S.sel = 0.06 * exp(1.4 * cl(k[2], -1, 1));
  S.N = 1600 * exp(2.1 * cl(k[3], -1, 1));
  S.lam = cl(0.25 * pow(0.12 / S.sel, 0.5) * pow(S.N / 1600, 0.3), 0.02, 1);
  S.rowT = 0.25 * pow(0.09 / 0.25, u);
  S.gpr = 1 + 1.4 * u;
  if (!S.ready) {
    prerun(S);
    S.ready = true;
  }
  S.phi += d / S.rowT;
  let nt = 0;
  while (S.phi >= 1 && nt < 8) {
    tick(S);
    S.phi -= 1;
    nt++;
  }
  if (S.phi >= 1) S.phi = 0.999;
}

// ---- the population

function pickHue(S, p) {
  let best = 0, bs = -1e9;
  for (let t = 0; t < 10; t++) {
    const mag = (25 + 45 * Math.random()) / 360;
    let h = S.hue[p] + (Math.random() < 0.5 ? -mag : mag);
    h -= floor(h);
    let dmin = 1;
    for (let i = 0; i < MAXC; i++) {
      if (!S.used[i] || S.n[i] <= 0) continue;
      let dd = abs(h - S.hue[i]);
      dd = min(dd, 1 - dd);
      if (dd < dmin) dmin = dd;
    }
    let da = abs(h - ANCHOR);
    da = min(da, 1 - da);
    const score = dmin - 1.2 * max(0, da - 0.27);
    if (score > bs) {
      bs = score;
      best = h;
    }
  }
  return best;
}

function spawn(S, p) {
  let c = -1;
  for (let i = 0; i < MAXC; i++)
    if (!S.used[i]) {
      c = i;
      break;
    }
  if (c < 0) return -1;
  const r = Math.random();
  const dl = r < 0.72 ? 0.3 + 0.8 * -log(Math.random() + 1e-9) : -(0.2 + 0.6 * -log(Math.random() + 1e-9));
  S.used[c] = 1;
  S.vis[c] = p < 0 ? 1 : 0;
  S.n[c] = 1;
  S.par[c] = p;
  S.sf[c] = (p >= 0 ? S.sf[p] : 0) + dl;
  S.hue[c] = p >= 0 ? pickHue(S, p) : ANCHOR;
  S.sat[c] = 0.72 + 0.18 * Math.random();
  S.val[c] = 0.84 + 0.16 * Math.random();
  S.born[c] = S.row;
  S.dead[c] = -1;
  S.shown[c] = 0;
  S.ord[c] = Math.random() * 2 - 1;
  S.bias[c] = (Math.random() - 0.5) * 0.56;
  S.ft[c] = 1 / S.T;
  return c;
}

function generation(S) {
  let smax = -1e9;
  for (let i = 0; i < MAXC; i++) if (S.used[i] && S.n[i] > 0 && S.sf[i] > smax) smax = S.sf[i];
  let tot = 0;
  for (let i = 0; i < MAXC; i++) {
    if (!S.used[i]) continue;
    S.sf[i] -= smax;
    if (S.n[i] > 0) {
      const w = S.n[i] * exp(S.sf[i] * S.sel);
      S.wt[i] = w;
      tot += w;
    }
  }
  let T = 0;
  for (let i = 0; i < MAXC; i++) {
    if (!S.used[i] || S.n[i] <= 0) continue;
    const m = poisson((S.N * S.wt[i]) / tot);
    S.n[i] = m;
    T += m;
    if (m === 0) S.dead[i] = S.row;
    else if (m >= NVIS && !S.vis[i]) {
      for (let a = i; a >= 0 && !S.vis[a]; a = S.par[a]) {
        S.vis[a] = 1;
        S.born[a] = S.row;
      }
    }
  }
  S.T = max(T, 1);
  // mutation: a cell of a clone picked in proportion to its size starts a clone of one
  const k = poisson(S.lam);
  for (let j = 0; j < k; j++) {
    let sum = 0;
    for (let i = 0; i < MAXC; i++) if (S.used[i] && S.n[i] >= 2) sum += S.n[i];
    if (sum <= 0) break;
    let r = Math.random() * sum, p = -1;
    for (let i = 0; i < MAXC; i++) {
      if (!S.used[i] || S.n[i] < 2) continue;
      r -= S.n[i];
      if (r <= 0) {
        p = i;
        break;
      }
    }
    if (p < 0) continue;
    const c = spawn(S, p);
    if (c >= 0) S.n[p] -= 1;
  }
  // too many clones: the smallest leaf folds back into the nearest ancestor that still has cells
  let live = 0;
  for (let i = 0; i < MAXC; i++) if (S.used[i] && S.n[i] > 0) live++;
  while (live > CAPLIVE) {
    for (let i = 0; i < MAXC; i++) S.kc[i] = 0;
    for (let i = 0; i < MAXC; i++) if (S.used[i] && S.par[i] >= 0) S.kc[S.par[i]]++;
    let sm1 = -1;
    for (let i = 0; i < MAXC; i++) if (S.used[i] && S.n[i] > 0 && S.kc[i] === 0 && S.par[i] >= 0 && (sm1 < 0 || S.n[i] < S.n[sm1])) sm1 = i;
    if (sm1 < 0) break;
    let a = S.par[sm1];
    while (a >= 0 && S.n[a] <= 0) a = S.par[a];
    if (a < 0) {
      for (let i = 0; i < MAXC; i++) if (S.used[i] && S.n[i] > 0 && i !== sm1 && (a < 0 || S.n[i] > S.n[a])) a = i;
    }
    if (a >= 0) S.n[a] += S.n[sm1];
    S.n[sm1] = 0;
    S.dead[sm1] = S.row;
    live--;
  }
}

// Once a row: smooth each clone's share, drop the dead, collapse a chain that has nothing left in it, then draw the row.
function tick(S) {
  S.gacc += S.gpr;
  let g = floor(S.gacc);
  S.gacc -= g;
  while (g-- > 0) generation(S);
  S.row++;
  for (let i = 0; i < MAXC; i++) if (S.used[i]) S.ft[i] += (S.n[i] / S.T - S.ft[i]) * ALPHA;
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (let i = 0; i < MAXC; i++) S.kc[i] = 0;
    for (let i = 0; i < MAXC; i++) if (S.used[i] && S.par[i] >= 0) S.kc[S.par[i]]++;
    for (let i = 0; i < MAXC; i++) {
      if (!S.used[i] || S.n[i] > 0) continue;
      if (S.kc[i] === 0) {
        if (!S.vis[i] || !S.shown[i] || (S.row - S.dead[i] >= FADE && S.ft[i] < 0.004)) {
          S.used[i] = 0;
          changed = true;
        }
      } else if (S.kc[i] === 1 && S.vis[i] && S.ft[i] < 0.003) {
        let c = -1;
        for (let j = 0; j < MAXC; j++) if (S.used[j] && S.par[j] === i) c = j;
        S.par[c] = S.par[i];
        S.vis[c] = 1;
        S.used[i] = 0;
        changed = true;
      }
    }
    if (!changed) break;
  }
  render(S);
}

// ---- one row of the plot

function render(S) {
  const { kids, subR, D, live, used, n, ft } = S;
  let root = -1;
  for (let i = 0; i < MAXC; i++) {
    kids[i].length = 0;
    if (used[i] && S.par[i] < 0) root = i;
  }
  for (let i = 0; i < MAXC; i++) if (used[i] && S.vis[i] && S.par[i] >= 0) kids[S.par[i]].push(i);
  for (let i = 0; i < MAXC; i++) if (kids[i].length > 1) kids[i].sort(S.byOrd);
  // preorder, then size up from the leaves
  const pre = S.pre;
  pre.length = 0;
  const stack = [root];
  while (stack.length) {
    const i = stack.pop();
    pre.push(i);
    for (const c of kids[i]) stack.push(c);
  }
  for (let q = pre.length - 1; q >= 0; q--) {
    const i = pre[q];
    let r = W * ft[i], dsum = 0, lv = n[i] > 0 ? 1 : 0;
    for (const c of kids[i]) {
      r += subR[c];
      dsum += D[c];
      if (live[c]) lv = 1;
    }
    live[i] = lv;
    subR[i] = r;
    const age = S.row - S.born[i];
    let m = M0 * sm(0, GROW, age + 0.5);
    if (n[i] <= 0) m *= lv ? 0 : 1 - sm(0, FADE, S.row - S.dead[i]);
    D[i] = max(sqrt(r * r + m * m), dsum);
    S.shown[i] = 1;
  }
  S.ns = 0;
  lay(S, root, W);
  // segment boundaries and colours
  let x = 0;
  for (let k = 0; k < S.ns; k++) {
    x += S.segW[k];
    S.sB[k] = x;
    const c = S.segC[k], age = S.row - S.born[c];
    const gl = n[c] > 0 ? exp(-age / 9) : 0;
    S.sH[k] = S.hue[c];
    S.sS[k] = S.sat[c] * (1 - 0.42 * gl);
    S.sV[k] = min(1, S.val[c] + 0.14 * gl);
  }
  // each LED: the bands' colours crossfaded over the edges, a faint seam and a faint shadow near an edge
  const ns = S.ns;
  S.head = (S.head + 1) % HR;
  const o = S.head * W;
  for (let p = 0; p < W; p++) {
    const xc = p + 0.5;
    let h = S.sH[0], s = S.sS[0], v = S.sV[0], seam = 0, near = 99;
    for (let j = 0; j < ns - 1; j++) {
      const d = xc - S.sB[j], ad = abs(d);
      if (ad < near) near = ad;
      if (d < -5) break;
      let dh = S.sH[j + 1] - S.sH[j];
      dh -= Math.round(dh);
      const t = d >= HW ? 1 : d <= -HW ? 0 : sm(-HW, HW, d);
      h += dh * t;
      s += (S.sS[j + 1] - S.sS[j]) * t;
      v += (S.sV[j + 1] - S.sV[j]) * t;
      if (ad < 2) seam += exp(-(d * d) / 0.5);
    }
    v *= 1 - 0.2 * min(seam, 1) - 0.1 * (1 - sm(0, 5, near));
    h -= floor(h);
    S.HH[o + p] = h;
    S.HS[o + p] = cl(s, 0, 1);
    S.HV[o + p] = cl(v, 0, 1);
  }
}

// A clone's band inside the width it is given: its own cells split to the two sides, its children as one block near the middle.
function lay(S, i, Wi) {
  const ks = S.kids[i];
  let C = 0;
  for (const c of ks) C += S.D[c];
  let k = 1, own = Wi - C;
  if (own < 0) {
    k = Wi / C;
    own = 0;
  }
  const left = own * (0.5 + S.bias[i]);
  emit(S, i, left);
  for (const c of ks) lay(S, c, S.D[c] * k);
  emit(S, i, own - left);
}

function emit(S, i, w) {
  if (w < 0.02 || S.ns >= S.segW.length) return;
  S.segW[S.ns] = w;
  S.segC[S.ns] = i;
  S.ns++;
}

// A good opening: three or more clones sharing the row, none holding most of it, and a young mutant on its way up.
function goodScene(S) {
  let big = 0, mx = 0, bud = false;
  for (let i = 0; i < MAXC; i++) {
    if (!S.used[i] || S.n[i] <= 0) continue;
    if (S.ft[i] > 0.06) big++;
    if (S.ft[i] > mx) mx = S.ft[i];
    const age = S.row - S.born[i];
    if (age < 30 && S.ft[i] > 0.004 && S.ft[i] < 0.25 && S.par[i] >= 0 && S.sf[i] > S.sf[S.par[i]]) bud = true;
  }
  return big >= 3 && mx < 0.7 && bud;
}

function prerun(S) {
  const r = spawn(S, -1);
  S.n[r] = S.N;
  S.T = S.N;
  S.ft[r] = 1;
  S.hue[r] = ANCHOR;
  for (let t = 0; t < 2600; t++) tick(S);
  for (let t = 0; t < 5000 && !goodScene(S); t++) tick(S);
}

// ---- drawing

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const k1 = S.k1, phi = S.phi;
  for (let y = 0; y < H; y++) {
    const a = ((S.head - y + HR * 2) % HR) * W, b = ((S.head - y - 1 + HR * 2) % HR) * W;
    for (let x = 0; x < W; x++) {
      let dh = S.HH[a + x] - S.HH[b + x];
      dh -= Math.round(dh);
      const h6 = (S.HH[b + x] + dh * phi + k1) * 6;
      const s = S.HS[b + x] + (S.HS[a + x] - S.HS[b + x]) * phi;
      const v = S.HV[b + x] + (S.HV[a + x] - S.HV[b + x]) * phi;
      const hh = h6 - floor(h6 / 6) * 6;
      const vs = v * s;
      const k0 = (5 + hh) % 6, k2 = (3 + hh) % 6, k3 = (1 + hh) % 6;
      display.setPixel(
        x, y,
        255 * (v - vs * max(0, min(k0, 4 - k0, 1))),
        255 * (v - vs * max(0, min(k2, 4 - k2, 1))),
        255 * (v - vs * max(0, min(k3, 4 - k3, 1))),
      );
    }
  }
}
