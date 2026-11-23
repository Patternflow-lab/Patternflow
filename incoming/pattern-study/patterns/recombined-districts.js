// ===== Patternflow pattern =====
// Title:   Recombined Districts
// Family:  redistrict
// Idea:    Fifteen coloured districts, each a connected patch of a 16 by 32 grid of cells and each carrying the same share of a hidden drifting density, have their borders redrawn one pair at a time: two neighbours are merged, a random spanning tree of their cells is drawn, an edge that splits it into two balanced halves becomes the new border, and a bright seam runs out along the tree as the cells change hands, so the outlines wander like a gerrymandered map while dense places pack small districts and thin places let them sprawl.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ReCom, the recombination move on districting plans (Daryl DeFord, Moon Duchin and Justin Solomon, 2018, from memory), uniform spanning trees by loop-erased random walks (David Wilson, 1996, from memory), Metropolis acceptance on border length as a compactness bias (Nicholas Metropolis and colleagues, 1953, from memory), pattern round 227
// Round:   227
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..4, Weight=-1..1, Compact=-1..1
//
// Knob 1: Hue. Turns the whole palette once round: five hues (teal, blue, violet, rose, amber at 0) in three lightness steps, one colour for each of the fifteen districts for its whole life. The palette also sways about 40 degrees either side of the knob over a minute, and each district breathes a few percent in brightness on periods of its own.
// Knob 2: Pace. Borders redrawn a second, doubling with each step: 0.5 at 0 (one every 2 s, each drawn over 1.3 s), 2 at 2 where it opens (1 s each), 8 at 4 (0.5 s each, about 7 a second in practice, as a pair being redrawn is not picked again until it settles).
// Knob 3: Weight. How much the hidden density varies from cell to cell, and so how unequal the districts are. At -1 the biggest district is 1.2 times the smallest (31 to 38 cells of 4 by 4 LEDs); 2.7 times at 0 where it opens (21 to 56 cells); 5.5 times at +1 (14 to 75 cells), small and tight where the density peaks. The shading inside each district shows the density and grows with the knob.
// Knob 4: Compact. A bias against long borders: a proposed split is drawn with weight exp(-beta times its border length), then passes a Metropolis test. At -1 it is plain ReCom with ragged borders, fjords and peninsulas, 214 cell edges in all; 186 where it opens; 146 at +1, where the districts are smooth rounded blobs. The vote that rounds the outlines widens too, from 0.6 to 1.1 cells.

const CS = 4, CW = 16, CH = 32, N = CW * CH;
const K = 15;
const SEED = 227227;
const { floor, sqrt, exp, sin, cos, pow, abs, min, max, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const BL = 0.28;        // s, in which a cell that the front has reached changes over from the old district to the new
const TAUH = 0.3;       // s, in which the glow of a cell the front has passed dies away
const SIG0 = 0.6, SIG1 = 1.1; // cells, the width of the vote that rounds the borders, at Compact -1 and at +1
const MHB = 0.7, MHF = 0.1, BMAX = 2.9; // Metropolis: the share of beta in the acceptance test, its floor, and beta at Compact +1
const FSPEED = 0.6;     // the hidden density moves at this share of its table speed
const PRE = 1100;       // recombinations run in the first update
const HUE0 = 190;       // degrees on the OKLCH wheel where the palette starts at knob 0: a teal
const HUES = [0, 45, 95, 150, 205];
const PAL_L = [0.58, 0.71, 0.81];
const PAL_C = [0.12, 0.125, 0.1];

// The hidden density, in cell units: six soft blobs, dense and thin, on paths whose frequencies do not divide one another,
// over two long waves.
const BA = [1.0, 0.95, 0.9, -0.75, 0.85, -0.6];
const BR = [3.4, 4.2, 3.0, 4.8, 3.6, 5.0];
const BX = [[8, 6.2, 0.0371, 0.4, 2.1, 0.0829, 1.7], [4, 5.4, 0.0529, 2.9, 2.6, 0.0611, 0.3], [11, 5.8, 0.0293, 5.1, 1.9, 0.0953, 4.2],
  [6, 6.8, 0.0617, 1.2, 3.1, 0.0719, 2.4], [12, 5.0, 0.0457, 3.7, 2.3, 0.0877, 5.5], [9, 6.1, 0.0331, 0.9, 2.8, 0.0563, 3.3]];
const BY = [[10, 11.5, 0.0247, 1.1, 5.2, 0.0743, 4.1], [22, 10.4, 0.0359, 4.3, 4.4, 0.0587, 2.2], [16, 12.6, 0.0193, 2.2, 5.6, 0.0661, 0.6],
  [24, 9.8, 0.0421, 5.8, 3.9, 0.0911, 1.3], [8, 10.2, 0.0287, 0.3, 4.8, 0.0697, 3.5], [18, 12.1, 0.0337, 3.4, 5.1, 0.0523, 5.0]];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The vote that draws a border: for each of the 16 places an LED can sit in its cell, the weight of the 5 by 5 cells round it.
function kernel(P, sigma) {
  const kw = P.kw;
  P.sigma = sigma;
  for (let sy = 0; sy < 4; sy++)
    for (let sx = 0; sx < 4; sx++) {
      const ox = (sx + 0.5) / CS - 0.5, oy = (sy + 0.5) / CS - 0.5;
      let s = 0;
      for (let n = 0; n < 25; n++) {
        const dx = (n % 5) - 2 - ox, dy = floor(n / 5) - 2 - oy;
        const v = exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kw[(sy * 4 + sx) * 25 + n] = v;
        s += v;
      }
      for (let n = 0; n < 25; n++) kw[(sy * 4 + sx) * 25 + n] /= s;
    }
  // Only the cells that count (over 1 percent) are visited.
  P.ku.fill(0);
  for (let q = 0; q < 16; q++) {
    let c = 0;
    for (let n = 0; n < 25; n++)
      if (kw[q * 25 + n] > 0.01) {
        P.ki[q * 25 + c++] = n;
        P.ku[n] = 1;
      }
    P.kn[q] = c;
  }
}

export function setup(P) {
  const F = (n) => new Float32Array(n), I = (n) => new Int16Array(n), U = (n) => new Uint8Array(n);
  P.rand = rng(SEED);
  P.ready = false;
  P.T = 0;
  P.kw = F(16 * 25); P.ki = U(16 * 25); P.kn = U(16); P.ku = U(25); P.sigma = 0;
  P.lab = U(N); P.old = U(N); P.pa = U(N); P.pb = U(N);
  P.tf = F(N).fill(-1e9);
  P.hw = F(N); P.f = F(N); P.w = F(N);
  P.nb = I(N * 4).fill(-1);
  P.dr = I(N).fill(-1);
  P.dl = I(N).fill(-1);
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      if (x < CW - 1) P.nb[i * 4] = i + 1;
      if (x > 0) P.nb[i * 4 + 1] = i - 1;
      if (y < CH - 1) {
        P.nb[i * 4 + 2] = i + CW;
        if (x < CW - 1) P.dr[i] = i + CW + 1;
        if (x > 0) P.dl[i] = i + CW - 1;
      }
      if (y > 0) P.nb[i * 4 + 3] = i - CW;
    }
  P.lock = F(K).fill(-1);
  P.eps = 0.1;  // the tolerance on a district's weight; it opens up when no tree gives a balanced cut
  P.g = 0.75;   // how strongly the density shows in the weights, eased toward the Weight knob
  P.beta = 0; P.hueK = 0; P.tw = 1; P.next = 0; P.stamp = 0; P.nmoves = 0; P.nfail = 0;
  P.dw = F(K); P.ac = I(K * K); P.pairs = I(K * K * 2); P.pw = F(K * K);
  // Scratch for one recombination: the merged cells, the tree, the best split so far, the distances from the cut.
  P.reg = I(N); P.mk = new Int32Array(N); P.inT = U(N); P.par = I(N); P.nxt = I(N); P.head = I(N); P.sib = I(N);
  P.pre = I(N); P.tin = I(N); P.sw = F(N); P.sz = I(N); P.stk = I(N);
  P.bestPar = I(N); P.bestSide = U(N); P.dist = I(N); P.que = I(N); P.tmp = I(4);
  // Per frame.
  P.pal = F(K * 3); P.pl = F(K * 3); P.col = U(K); P.vote = F(K); P.touched = U(20);
  P.ca = U(N); P.cb = U(N); P.cu = F(N); P.ch = F(N); P.sh = F(N); P.act = U(N);
  // Two periods for each district's breathing, a frequency and a phase each.
  P.bp = F(K * 4);
  for (let i = 0; i < K * 4; i++) P.bp[i] = i & 1 ? TAU * P.rand() : 1 / (i & 2 ? 11 + 14 * P.rand() : 23 + 32 * P.rand());
}

// The hidden density at time t, and the weight a cell carries (exp of g times it).
function field(P, T) {
  const f = P.f, w = P.w, g = P.g;
  const t = T * FSPEED;
  const bx = new Float32Array(6), by = new Float32Array(6);
  for (let b = 0; b < 6; b++) {
    const X = BX[b], Y = BY[b];
    bx[b] = X[0] + X[1] * 0.6 * sin(X[2] * t + X[3]) + X[1] * 0.4 * sin(X[5] * t + X[6]);
    by[b] = Y[0] + Y[1] * 0.6 * sin(Y[2] * t + Y[3]) + Y[1] * 0.4 * sin(Y[5] * t + Y[6]);
    bx[b] = cl(bx[b], -2, CW + 1);
    by[b] = cl(by[b], -3, CH + 2);
  }
  const p1 = 0.043 * t, p2 = 0.0271 * t;
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      let s = 0.22 * sin(0.34 * x - 0.19 * y + p1 + 0.7) + 0.16 * sin(-0.21 * x + 0.27 * y - p2 + 2.9);
      for (let b = 0; b < 6; b++) {
        const dx = x - bx[b], dy = y - by[b];
        s += BA[b] * exp(-(dx * dx + dy * dy) / (2 * BR[b] * BR[b]));
      }
      const i = y * CW + x;
      s = 1.3 * tanh(s / 1.3);
      f[i] = s;
      w[i] = exp(g * s);
    }
}

// A start that is already balanced: the cells in a snake, cut into K stretches of equal weight.
function initialPlan(P) {
  const w = P.w;
  let tot = 0;
  for (let i = 0; i < N; i++) tot += w[i];
  let acc = 0, d = 0;
  for (let y = 0; y < CH; y++)
    for (let xx = 0; xx < CW; xx++) {
      const x = y & 1 ? CW - 1 - xx : xx;
      const i = y * CW + x;
      P.lab[i] = d;
      acc += w[i];
      if (acc >= tot * (d + 1) / K && d < K - 1) d++;
    }
}

function weights(P) {
  const dw = P.dw;
  dw.fill(0);
  let tot = 0;
  for (let i = 0; i < N; i++) {
    dw[P.lab[i]] += P.w[i];
    tot += P.w[i];
  }
  P.tw = tot / K;
}

// Which pairs of districts touch, how long the shared border is, and which pair to merge next.
function pickPair(P, ignoreLocks) {
  const { lab, nb, ac, pairs, pw, dw, lock } = P;
  ac.fill(0);
  for (let i = 0; i < N; i++) {
    const a = lab[i];
    const r = nb[i * 4], d = nb[i * 4 + 2];
    if (r >= 0 && lab[r] !== a) { ac[a * K + lab[r]]++; ac[lab[r] * K + a]++; }
    if (d >= 0 && lab[d] !== a) { ac[a * K + lab[d]]++; ac[lab[d] * K + a]++; }
  }
  let n = 0, tot = 0;
  for (let a = 0; a < K; a++) {
    if (!ignoreLocks && lock[a] > P.T) continue;
    for (let b = a + 1; b < K; b++) {
      if (ac[a * K + b] === 0 || (!ignoreLocks && lock[b] > P.T)) continue;
      // Pairs whose weights differ are picked a little more often, so a change of the density is met sooner.
      const v = 1 + 4 * min(1.5, abs(dw[a] - dw[b]) / P.tw);
      pairs[n * 2] = a;
      pairs[n * 2 + 1] = b;
      pw[n] = v;
      tot += v;
      n++;
    }
  }
  if (n === 0) return -1;
  let r = P.rand() * tot;
  for (let i = 0; i < n; i++) {
    r -= pw[i];
    if (r <= 0) return i;
  }
  return n - 1;
}

// A uniform spanning tree of the merged cells (Wilson's loop-erased walks): par[] the parent of each cell, pre[] the cells
// depth-first from the root, tin[] their place in it, sw[] and sz[] the weight and size under each. -1 if a walk strays.
function spanningTree(P, n, st) {
  const { reg, mk, inT, par, nxt, head, sib, pre, tin, sw, sz, stk, nb, w, tmp, rand } = P;
  for (let i = 0; i < n; i++) {
    inT[reg[i]] = 0;
    head[reg[i]] = -1;
  }
  const root = reg[(rand() * n) | 0];
  inT[root] = 1;
  par[root] = -1;
  let guard = 0;
  for (let q = 0; q < n; q++) {
    const s = reg[q];
    if (inT[s]) continue;
    let u = s;
    while (!inT[u]) {
      let c = 0;
      for (let d = 0; d < 4; d++) {
        const v = nb[u * 4 + d];
        if (v >= 0 && mk[v] === st) tmp[c++] = v;
      }
      if (c === 0 || ++guard > 60000) return -1;
      const v = tmp[(rand() * c) | 0];
      nxt[u] = v;
      u = v;
    }
    u = s;
    while (!inT[u]) {
      inT[u] = 1;
      par[u] = nxt[u];
      u = nxt[u];
    }
  }
  for (let i = 0; i < n; i++) {
    const x = reg[i];
    if (x === root) continue;
    sib[x] = head[par[x]];
    head[par[x]] = x;
  }
  let sp = 0, cnt = 0;
  stk[sp++] = root;
  while (sp > 0) {
    const u = stk[--sp];
    pre[cnt] = u;
    tin[u] = cnt++;
    for (let c = head[u]; c >= 0; c = sib[c]) stk[sp++] = c;
  }
  for (let i = 0; i < n; i++) {
    const x = pre[i];
    sw[x] = w[x];
    sz[x] = 1;
  }
  for (let i = n - 1; i > 0; i--) {
    const x = pre[i];
    sw[par[x]] += sw[x];
    sz[par[x]] += sz[x];
  }
  return root;
}

// The length of the border a split makes: the pairs of cells it separates, side by side 1 and corner to corner 0.71, so
// that a round district comes out shorter than a square one (0.95 of the true length for a straight edge at any angle).
// The split is the cells of district a if a >= 0, else the cells whose place in the tree is in lo..hi.
function splitLength(P, n, st, a, lo, hi) {
  const { reg, mk, nb, dr, dl, lab, tin } = P;
  let L = 0;
  for (let q = 0; q < n; q++) {
    const x = reg[q];
    const ix = a >= 0 ? lab[x] === a : tin[x] >= lo && tin[x] < hi;
    for (let k = 0; k < 4; k++) {
      const y = k === 0 ? nb[x * 4] : k === 1 ? nb[x * 4 + 2] : k === 2 ? dr[x] : dl[x];
      if (y < 0 || mk[y] !== st) continue;
      const iy = a >= 0 ? lab[y] === a : tin[y] >= lo && tin[y] < hi;
      if (iy !== ix) L += k < 2 ? 1 : 0.7071;
    }
  }
  return L;
}

// One recombination of districts a and b; true if the border moved. With `instant` the cells change at once (the first
// update); otherwise each flips at a time that grows with its distance along the tree from the new cut, over `dur` s from t0.
function recom(P, a, b, instant, t0, dur) {
  const { lab, old, tf, w, nb, reg, mk, pre, tin, sw, sz, par, head, sib, bestPar, bestSide, rand } = P;
  const st = ++P.stamp;
  let n = 0, S = 0;
  for (let i = 0; i < N; i++) {
    const l = lab[i];
    if (l === a || l === b) {
      reg[n++] = i;
      mk[i] = st;
      S += w[i];
    }
  }
  if (n < 2) return false;
  const T = P.tw;
  const off = abs(S - 2 * T) / T;
  const Lold = splitLength(P, n, st, a, 0, 0);
  const beta = P.beta;
  const wantC = 1 + (beta > 0.02 ? floor(min(9, beta * 3.5)) : 0);
  const side = bestSide;
  let found = false, bestV = -1, bestRoot = -1, Lsel = 0, Z = 0;
  let trees = 0;
  const maxTrees = 14;
  while (trees < maxTrees) {
    const allow = max(P.eps, 0.5 * off + 0.5 * P.eps);
    let cands = 0;
    for (let t = 0; t < 5 && trees < maxTrees && cands < wantC; t++, trees++) {
      const root = spanningTree(P, n, st);
      if (root < 0) return false;
      for (let i = 1; i < n; i++) {
        const v = pre[i];
        const w1 = sw[v], w2 = S - w1;
        if (max(abs(w1 - T), abs(w2 - T)) > allow * T) continue;
        cands++;
        const lo = tin[v], hi = lo + sz[v];
        const L = splitLength(P, n, st, -1, lo, hi);
        const wc = exp(-beta * (L - Lold));
        Z += wc;
        if (rand() * Z < wc) {
          // This one is the pick so far (reservoir sampling, so the pick is drawn by exp(-beta L)).
          found = true;
          bestV = v;
          bestRoot = root;
          Lsel = L;
          for (let q = 0; q < n; q++) {
            const x = reg[q];
            side[x] = tin[x] >= lo && tin[x] < hi ? 1 : 0;
            bestPar[x] = par[x];
          }
        }
        if (cands >= 8) break;
      }
    }
    if (found) break;
    // No balanced cut in any of the trees: the tolerance gives a little. It tightens again after a good move.
    P.eps = min(0.4, P.eps * 1.15);
  }
  if (!found) {
    P.nfail++;
    return false;
  }
  // The Metropolis step against the border now: a longer border is accepted with exp(-beta times the change).
  if (beta > 0 && Lsel > Lold) {
    const pa = max(MHF, exp(-MHB * beta * (Lsel - Lold)));
    if (rand() > pa) {
      P.nfail++;
      return false;
    }
  }
  P.eps = max(0.1, P.eps * 0.985);
  // Which of the two labels the subtree takes: the one that moves fewer cells.
  let subA = 0, subB = 0, restA = 0, restB = 0;
  for (let q = 0; q < n; q++) {
    const x = reg[q];
    if (side[x]) lab[x] === a ? subA++ : subB++;
    else lab[x] === a ? restA++ : restB++;
  }
  const subLab = subB + restA <= subA + restB ? a : b;
  const restLab = subLab === a ? b : a;
  // Distances from the cut along the tree, so the front can run away from it.
  let dmax = 1;
  const dist = P.dist;
  if (!instant) {
    for (let q = 0; q < n; q++) {
      const x = reg[q];
      head[x] = -1;
    }
    for (let q = 0; q < n; q++) {
      const x = reg[q];
      if (x === bestRoot) continue;
      sib[x] = head[bestPar[x]];
      head[bestPar[x]] = x;
      dist[x] = -1;
    }
    dist[bestRoot] = -1;
    const que = P.que;
    const pv = bestPar[bestV];
    let qh = 0, qt = 0;
    dist[bestV] = 0;
    dist[pv] = 0;
    que[qt++] = bestV;
    que[qt++] = pv;
    while (qh < qt) {
      const u = que[qh++];
      const du = dist[u] + 1;
      const pu = bestPar[u];
      if (pu >= 0 && dist[pu] < 0 && !(u === bestV && pu === pv)) {
        dist[pu] = du;
        que[qt++] = pu;
      }
      for (let c = head[u]; c >= 0; c = sib[c]) {
        if (dist[c] < 0 && !(c === bestV && u === pv)) {
          dist[c] = du;
          que[qt++] = c;
        }
      }
    }
    for (let q = 0; q < n; q++) if (dist[reg[q]] > dmax) dmax = dist[reg[q]];
  }
  // Every cell of the merged region is reached by the front, so the eye follows the redraw even where a cell keeps its district.
  for (let q = 0; q < n; q++) {
    const x = reg[q];
    const nl = side[x] ? subLab : restLab;
    old[x] = lab[x];
    P.hw[x] = nl === lab[x] ? 0.7 : 1;
    P.pa[x] = a;
    P.pb[x] = b;
    lab[x] = nl;
    tf[x] = instant ? -1e9 : t0 + dur * (dist[x] / (dmax + 0.5));
  }
  P.nmoves++;
  return true;
}

// OKLCH to sRGB, 0-255. A colour outside the gamut is pulled toward the grey of its own luminance just far enough to fit,
// which keeps it from jumping as the hue sways.
const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
function oklch(L, C, hdeg, out, o) {
  const h = (hdeg * PI) / 180, a = C * cos(h), b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const c = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  let t = 1;
  for (const v of c) t = v > 1 ? min(t, (1 - Y) / (v - Y)) : v < 0 ? min(t, Y / (Y - v)) : t;
  for (let i = 0; i < 3; i++) out[o + i] = 255 * enc(cl(Y + (c[i] - Y) * t, 0, 1));
}

function palette(P) {
  // The whole palette sways a little round the knob's hue, on three periods that do not divide one another.
  const T = P.T;
  const base = HUE0 + 360 * P.hueK + 32 * sin((TAU * T) / 131 + 1.1) + 18 * sin((TAU * T) / 53 + 4) + 11 * sin((TAU * T) / 23 + 2);
  for (let c = 0; c < K; c++) {
    const h = (c / 3) | 0, l = c % 3;
    oklch(PAL_L[l], PAL_C[l], base + HUES[h], P.pal, c * 3);
  }
}

// A district keeps its colour for life. They are handed out once, after the first mature plan, so that districts that
// touch then get colours that are far apart: a few thousand swaps that lower the sum of closeness over shared borders.
function assignColours(P) {
  palette(P);
  const pal = P.pal;
  const dist = (i, j) => {
    const dr = pal[i * 3] - pal[j * 3], dg = pal[i * 3 + 1] - pal[j * 3 + 1], db = pal[i * 3 + 2] - pal[j * 3 + 2];
    return sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
  };
  pickPair(P, true);
  const ac = P.ac;
  const col = P.col;
  const perm = [];
  for (let c = 0; c < K; c++) perm.push(c);
  for (let i = K - 1; i > 0; i--) {
    const j = (P.rand() * (i + 1)) | 0;
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  const cost = () => {
    let s = 0;
    for (let a = 0; a < K; a++)
      for (let b = a + 1; b < K; b++) {
        const e = ac[a * K + b];
        if (e) s += e / (dist(perm[a], perm[b]) + 12);
      }
    return s;
  };
  let cur = cost();
  for (let it = 0; it < 4000; it++) {
    const i = (P.rand() * K) | 0, j = (P.rand() * K) | 0;
    if (i === j) continue;
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    const c2 = cost();
    if (c2 <= cur) cur = c2;
    else { perm[j] = perm[i]; perm[i] = t; }
  }
  for (let d = 0; d < K; d++) col[d] = perm[d];
}

export function update(dt, input, P) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  P.hueK = cl(k[0], 0, 1);
  const rate = 0.5 * pow(2, cl(k[1], 0, 4));
  const gk = (cl(k[2], -1, 1) + 1) / 2;
  const gT = 0.05 + 1.4 * pow(gk, 0.9);
  const c = (cl(k[3], -1, 1) + 1) / 2;
  P.beta = c < 0.02 ? 0 : BMAX * pow(c, 4);
  const sg = SIG0 + (SIG1 - SIG0) * c;
  if (abs(sg - P.sigma) > 0.004) kernel(P, sg);
  if (!P.ready) {
    P.g = gT;
    field(P, 0);
    initialPlan(P);
    weights(P);
    for (let m = 0; m < PRE; m++) {
      const pr = pickPair(P, true);
      if (pr >= 0) recom(P, P.pairs[pr * 2], P.pairs[pr * 2 + 1], true, 0, 0);
      if ((m & 15) === 15) weights(P);
    }
    weights(P);
    assignColours(P);
    P.ready = true;
    P.next = 0.2;
  }
  P.T += dt;
  const T = P.T;
  P.g += (gT - P.g) * (1 - exp(-dt / 1.5));
  field(P, T);
  weights(P);
  const dur = cl(1.4 / sqrt(rate), 0.45, 1.3);
  let guard = 0;
  while (T >= P.next && guard++ < 5) {
    const pr = pickPair(P, false);
    if (pr < 0) {
      P.next = T + 0.05;
      break;
    }
    const a = P.pairs[pr * 2], b = P.pairs[pr * 2 + 1];
    const ok = recom(P, a, b, false, T, dur);
    if (ok) {
      P.lock[a] = P.lock[b] = T + dur + BL + 0.1;
      P.next += (0.7 + 0.6 * P.rand()) / rate;
      if (P.next < T - 1) P.next = T;
      weights(P);
    } else P.next = T + 0.03;
  }
}

export function draw(display, P) {
  if (!P.ready) return;
  const T = P.T;
  const { lab, old, tf, ca, cb, cu, ch, sh, act, f, vote, touched, pl, hw, pa, pb, kw: KW, ki, kn, ku } = P;
  palette(P);
  // Each district breathes a little, on two periods of its own.
  for (let l = 0; l < K; l++) {
    const k = l * 4;
    const br = 1 + 0.15 * sin(TAU * P.bp[k] * T + P.bp[k + 1]) + 0.06 * sin(TAU * P.bp[k + 2] * T + P.bp[k + 3]);
    const o = P.col[l] * 3;
    for (let c = 0; c < 3; c++) pl[l * 3 + c] = P.pal[o + c] * br;
  }
  // The shading in a district shows the density: brighter where it is dense. It grows with the Weight knob.
  const shAmp = 0.26 * cl((P.g - 0.05) / 0.9, 0, 1.4);
  for (let i = 0; i < N; i++) {
    sh[i] = 1 + shAmp * cl(f[i] - 0.15, -1.2, 1.4);
    const t0 = tf[i];
    if (t0 > -1e8) {
      const e = T - t0;
      if (e > 1.9) {
        tf[i] = -1e9;
        ca[i] = cb[i] = lab[i];
        cu[i] = 1;
        ch[i] = 0;
        act[i] = 0;
      } else {
        ca[i] = old[i];
        cb[i] = lab[i];
        cu[i] = smooth(e / BL);
        ch[i] = e >= 0 ? hw[i] * exp(-e / TAUH) : 0;
        act[i] = 1;
      }
    } else {
      ca[i] = cb[i] = lab[i];
      cu[i] = 1;
      ch[i] = 0;
      act[i] = 0;
    }
  }
  const nbc = new Int16Array(25);
  for (let cy = 0; cy < CH; cy++)
    for (let cx = 0; cx < CW; cx++) {
      const ci = cy * CW + cx;
      let still = act[ci] === 0;
      for (let n = 0; n < 25; n++) {
        const x = cl(cx + (n % 5) - 2, 0, CW - 1), y = cl(cy + floor(n / 5) - 2, 0, CH - 1);
        const j = y * CW + x;
        nbc[n] = j;
        if (ku[n] && (act[j] || lab[j] !== lab[ci])) still = false;
      }
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const kw = (sy * 4 + sx) * 25, kc = kn[sy * 4 + sx];
          let shade = 0;
          let r, g, b;
          if (still) {
            for (let q = 0; q < kc; q++) {
              const n = ki[kw + q];
              shade += KW[kw + n] * sh[nbc[n]];
            }
            const o = lab[ci] * 3;
            r = pl[o] * shade;
            g = pl[o + 1] * shade;
            b = pl[o + 2] * shade;
          } else {
            let nt = 0, heat = 0;
            for (let q = 0; q < kc; q++) {
              const n = ki[kw + q];
              const j = nbc[n], wk = KW[kw + n];
              shade += wk * sh[j];
              heat += wk * ch[j];
              const u = cu[j];
              if (u < 0.999) {
                const la = ca[j];
                if (vote[la] === 0) touched[nt++] = la;
                vote[la] += wk * (1 - u);
              }
              if (u > 0.001) {
                const lb = cb[j];
                if (vote[lb] === 0) touched[nt++] = lb;
                vote[lb] += wk * u;
              }
            }
            let l1 = -1, l2 = -1, v1 = 0, v2 = 0;
            for (let q = 0; q < nt; q++) {
              const l = touched[q], v = vote[l];
              vote[l] = 0;
              if (v > v1) { l2 = l1; v2 = v1; l1 = l; v1 = v; }
              else if (v > v2) { l2 = l; v2 = v; }
            }
            const o1 = l1 * 3;
            let sm = 0, tb = 0, sf = 0;
            if (l2 >= 0) {
              tb = v2 / (v1 + v2);
              // The seam: dark where the two top votes are close, about one LED wide, and a wider band of the same for the flash.
              // The vote gets flatter as sigma grows, so the margin is scaled to keep the seam as wide in LEDs.
              const mg = ((v1 - v2) / (v1 + v2)) * (P.sigma / 0.6);
              sm = 1 - cl(mg / 0.3, 0, 1);
              sm = sm * sm * (3 - 2 * sm);
              sf = 1 - cl(mg / 0.55, 0, 1);
              sf = sf * sf * (3 - 2 * sf);
            }
            const o2 = l2 >= 0 ? l2 * 3 : o1;
            r = (pl[o1] * (1 - tb) + pl[o2] * tb) * shade;
            g = (pl[o1 + 1] * (1 - tb) + pl[o2 + 1] * tb) * shade;
            b = (pl[o1 + 2] * (1 - tb) + pl[o2 + 2] * tb) * shade;
            const dk = 1 - 0.88 * sm;
            r *= dk; g *= dk; b *= dk;
            if (heat > 0.004) {
              // The cells the front has just passed lighten, and the border between the two districts of that move
              // flashes where the front has reached it (not the borders to the districts that took no part).
              const hi = min(1, heat * 1.6);
              r += r * 0.2 * hi + 8 * hi;
              g += g * 0.2 * hi + 8 * hi;
              b += b * 0.2 * hi + 8 * hi;
              if (l2 >= 0) {
                let hz = 0;
                for (let q = 0; q < kc; q++) {
                  const n = ki[kw + q];
                  const j = nbc[n];
                  if (ch[j] > 0.01 && ((pa[j] === l1 && pb[j] === l2) || (pa[j] === l2 && pb[j] === l1))) hz += KW[kw + n] * ch[j];
                }
                let hf = min(1, hz * 2.6);
                hf = hf * hf * sf;
                r += hf * (236 - 0.5 * r);
                g += hf * (226 - 0.5 * g);
                b += hf * (200 - 0.5 * b);
              }
            }
          }
          // The light steps, the breathing and the shading together can pass white: roll the top off, keeping the hue.
          const mx = max(r, g, b);
          if (mx > 205) {
            const k = (205 + 50 * (1 - exp(-(mx - 205) / 50))) / mx;
            r *= k; g *= k; b *= k;
          }
          display.setPixel(cx * CS + sx, cy * CS + sy, r, g, b);
        }
    }
}
