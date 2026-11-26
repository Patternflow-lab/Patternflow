// ===== Patternflow pattern =====
// Title:   Gene Surfing
// Family:  genesurfing
// Idea:    A colony of four fluorescent strains spreads over a black agar plate seen from above, and the panel keeps zooming out as it grows so the bright rough rim stays near the edge while older rings shrink to the middle: drift at the rim sorts the strains into green, red, cyan and yellow sectors with rough wandering boundaries that meet the rim in notches, sectors pinch out and close, and now and then a mutant appears at the rim as a small wedge, the lucky ones open into new sectors and a fitter one bulges out of the rim and widens along curved spiral boundaries.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: genetic drift at the edge of a growing colony that sorts mixed strains into sectors (Hallatschek, Hersen, Ramanathan and Nelson, 2007, PNAS, from memory); sector boundaries as annihilating random walks and the stepping-stone model behind them (Kimura and Weiss, 1964; Korolev, Avlund, Hallatschek and Nelson, 2010, from memory); a fitter mutant's sector opening along logarithmic spirals and bulging out of the front (Korolev, Muller, Karahan, Murray, Hallatschek and Nelson, 2012, from memory); the rough front of the KPZ equation (Kardar, Parisi and Zhang, 1986, from memory). Original here: the colony is kept in a history buffer indexed by log radius and angle, so the view zooms out for ever while the rim stays put, and a hidden census reseeds a wedge whenever drift has thinned the sectors, pattern round 260
// Round:   260
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.5..4, Drift=-1..1, Mutation=-1..1
//
// Knob 1: Hue. Turns the four strain colours round the wheel together, one turn over the knob. At 0 they are GFP green, mCherry red, CFP cyan and YFP yellow; at 0.25 azure, lime, violet and green; at 0.5 magenta, aqua, red and blue; at 0.75 orange, violet, chartreuse and pink. The spacing never changes, so the sectors stay apart.
// Knob 2: Growth. 0.5 to 4, opening at 2. How fast the colony grows and the view zooms out: 2.6 new rings a second plus 0.9 for each unit, 4.4 at the opening, 3.05 at 0.5 and 6.2 at 4. A ring born at the rim reaches half the radius in 9.6 s at the opening, 13.9 s at 0.5 and 6.8 s at 4, and every sector, wedge and bulge keeps that pace.
// Knob 3: Drift. -1 to 1, opening at 0. How strong genetic drift is at the rim. At -1 about 11 broad sectors share the whole rim and their boundaries swing slowly and smoothly; at 0 about 21, whose boundaries wander and fray; at 1 about 28 thin sectors with jagged boundaries that pinch out within seconds while new wedges keep opening, and the rim is twice as rough, 1.7 LED rms against 0.8 at -1.
// Knob 4: Mutation. -1 to 1, opening at 0.06. Mutants with an advantage. At -1 every new wedge is neutral and lives or closes by drift alone. At 0.06 a fitter mutant turns up about every 10 s, opens its sector along curved boundaries at 0.5 LED a ring each side and pushes a soft bulge out of the rim; its edge fades over about 125 rings, so it stops at a third of the plate or so. At 1 one comes every 4 s and opens at 0.75 LED a ring, and fitter ones inside fitter ones sweep the plate in turn.

// What the picture is. The colony is a history buffer of rings. Ring n is the rim at the moment it grew past log radius n dl, with dl = 2 pi / 384,
// so a ring is as deep as one of its 384 angular cells is wide and a cell stays square as it shrinks. The rim is drawn 57 LED from the centre
// of the panel and every older ring sits dl further in on the log scale: the view zooms out by a factor e every 61 rings, and the 192 rings kept
// reach from the rim to a disc 5 LED across in the middle, where the mixed inoculum glows pale.
// The rim is a ring of domains, each a lineage with a strain (one of four colours), a fitness, a brightness of its own and a left boundary at a
// real angle. Every ring each boundary moves by gamma (f_left - f_right), so a fitter lineage eats its neighbours at a steady rate and opens a
// logarithmic spiral; by a slow wander (an Ornstein-Uhlenbeck velocity with 40 rings of memory) that bends it; by a quick one (3 rings) and a
// white jitter that fray it; and by a pull into the valleys of the rim, where two growing lobes meet. Two boundaries that cross annihilate and the
// sector between them is gone, which is how sectors coarsen; neighbours of one strain, fitness and brightness merge. Drift sets the quick wander,
// the jitter and the census, and the slow wander shrinks as it grows, so low drift bends and high drift frays.
// A census counts the sectors on the rim every ring. Below its target, 8 at K3 = -1 and 32 at 1, a neutral wedge 2.5 to 4 cells wide is seeded
// in a domain picked by its width squared (oftener while one domain is wider than 1.8 times the mean), in the strain rarest on the rim about half the time, with a start-up advantage of 0.28 that fades with
// 36 rings, so it opens to about 23 cells before drift decides whether it lives or closes. For its first 20 rings drift leaves it alone, so a wedge
// that dies is a long sliver and not a dot. K4 seeds fitter mutants on top, fitness parent + s, s from 0.3 to 0.8. Fitness is kept relative, the
// least fit is 0, and every advantage fades by 0.8 percent a ring.
// The rim's height h(theta), in LED on 192 cells, grows as KPZ: smoothing, a (slope)^2 term that sharpens valleys, noise with 10 rings of
// memory so the bumps creep instead of flicker, a push from fitness that bulges a fitter sector, and a weak pull back to the mean.
// Each ring is rasterised into 384 cells of strain coverage, with partial cells at the boundaries, times a granular texture that sits in the
// colony (value noise in grains 3 cells by 3 rings, and streaks 2 cells by 8 rings), and mipmapped five times in angle and ring together, so the
// shrinking rings are averaged rather than sampled and nothing shimmers near the centre.
// Drawing. Every LED knows its log radius, angle and mip level. It samples two levels trilinearly, squares the strain weights so that two
// colours meet without a muddy band, darkens a little where they meet and notches the rim there by 2.4 LED, and adds a whitish growing rim
// 2 LED deep and a glow beyond it onto the black agar. The grain lifts toward white more than it darkens, since a dim yellow reads as olive.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, log, atan2, min, max, PI, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

// ---- geometry
const CX = 32, CY = 64, R0 = 57;      // centre of the colony and the radius of the rim, LED
const NA = 384, NR = 192, LMAX = 5;   // angular cells, rings kept, mip levels above the first
const NH = 192;                       // cells of the rim height
const DL = TAU / NA;                  // log radius of one ring
const NS = 4;                         // strains

// ---- the rim
const RATE0 = 2.6, RATE = 0.9;        // rings a second at no Growth and for each unit of it
const GAMMA = 1.0;                    // cells a ring a boundary moves for each unit of fitness difference
const RHO = 0.975, RHO_Q = 0.72;      // memory of the slow and the quick wander, per ring: 40 and 3 rings
const TR0 = 0.28, TR_DECAY = 0.972;   // start-up advantage of a neutral wedge and how it fades each ring
const FCAP = 2.6;                     // the fittest domain is at most this many s above the least fit
const FDEC = 0.992;                   // an advantage fades by this each ring, so a sweep stops after a third of the plate or so
const H_NU = 0.08, H_LAM = 0.12, H_KAP = 0.018, H_MAX = 7.5; // smoothing, KPZ slope term, pull to the mean, and the farthest the rim strays, LED

function hsh(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function makeState() {
  const lv = [];
  for (let L = 0; L <= LMAX; L++) {
    const na = NA >> L, nr = NR >> L;
    lv.push({ na, nr, w: new Float32Array(na * nr * NS), t: new Float32Array(na * nr) });
  }
  const S = {
    ready: false, lv, n: -1, acc: 0, salt: floor(rnd() * 1e9),
    dom: [], h: new Float32Array(NH), hn: new Float32Array(NH), hz: new Float32Array(NH), fc: new Float32Array(NA), lc: new Float32Array(NA), share: new Float32Array(NS),
    kn: [0, 2, 0, 0.06], hue: 0, grow: 2, u3: 0.5, u4: 0.53,
    pa: new Float32Array(NPX), pl: new Float32Array(NPX), pr: new Float32Array(NPX), plod: new Float32Array(NPX),
    // each LED's angular cells and weights at its two mip levels, which never change
    ca: new Int16Array(NPX * 4), cf: new Float32Array(NPX * 2),
    pal: new Float32Array(NS * 3), cen: new Float32Array(3), acc5: new Float64Array(5),
  };
  for (let p = 0; p < NPX; p++) {
    const x = p % W, y = (p / W) | 0;
    const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = max(0.3, sqrt(dx * dx + dy * dy));
    let a = atan2(dy, dx) / TAU;
    if (a < 0) a += 1;
    S.pa[p] = a * NA;
    S.pl[p] = log(r / R0) / DL;
    S.pr[p] = r;
    // footprint of one LED in cells (and in rings, the same): NA / (2 pi r)
    const lod = cl(log(max(1, NA / (TAU * r) * 0.9)) / Math.LN2, 0, LMAX - 0.001);
    S.plod[p] = lod;
    for (let e = 0; e < 2; e++) {
      const L = min(LMAX, (lod | 0) + e), sc = 1 << L, na = NA >> L, c = (a * NA) / sc - 0.5;
      let c0 = floor(c);
      S.cf[p * 2 + e] = c - c0;
      c0 = ((c0 % na) + na) % na;
      S.ca[p * 4 + e * 2] = c0;
      S.ca[p * 4 + e * 2 + 1] = c0 + 1 === na ? 0 : c0 + 1;
    }
  }
  // the inoculum: a fine mix of all four strains
  let b = 0;
  while (b < NA - 2) {
    S.dom.push({ b, col: floor(rnd() * NS), fit: 0, tr: 0, v: 0, q: 0, lum: lumNew(), age: 99 });
    b += 2 + 3 * rnd();
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

const knobsOf = (input) => {
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  return [cl(kn[0], 0, 1), cl(kn[1], 0.5, 4), cl(kn[2], -1, 1), cl(kn[3], -1, 1)];
};

// ---- the domains on the rim, kept sorted with the first boundary in [0, NA)
function normalize(D) {
  if (!D.length) return;
  while (D[0].b < 0) {
    const d = D.shift();
    d.b += NA;
    D.push(d);
  }
  while (D[D.length - 1].b >= NA) {
    const d = D.pop();
    d.b -= NA;
    D.unshift(d);
  }
}

// each lineage glows a little brighter or dimmer than its neighbours of the same strain
const lumNew = () => 0.94 + 0.16 * rnd();

const rightOf = (D, i) => (i + 1 < D.length ? D[i + 1].b : D[0].b + NA);

function hGrad(S, b) {
  const x = (b * NH) / NA, i = ((floor(x) % NH) + NH) % NH, j = i + 1 === NH ? 0 : i + 1;
  return S.h[j] - S.h[i];
}

function census(S) {
  const D = S.dom, m = D.length;
  let c = 0;
  for (let i = 0; i < m; i++) if (D[i].col !== D[(i - 1 + m) % m].col) c++;
  return max(1, c);
}

function spawn(S, s) {
  const D = S.dom, m = D.length;
  // a wide domain is likelier to throw a wedge: pick by width squared
  let tot = 0;
  for (let i = 0; i < m; i++) tot += (rightOf(D, i) - D[i].b) ** 2;
  let z = rnd() * tot, i = 0;
  for (; i < m - 1; i++) {
    z -= (rightOf(D, i) - D[i].b) ** 2;
    if (z < 0) break;
  }
  const par = D[i], lo = par.b, hi = rightOf(D, i), w0 = 2.5 + 1.5 * rnd();
  if (hi - lo < w0 + 4) return;
  const p = lo + 2 + w0 * 0.5 + rnd() * (hi - lo - 4 - w0);
  // the strain rarest on the rim, most of the time; never the parent's
  let col = -1;
  if (rnd() < 0.45) {
    let best = 2;
    for (let k = 0; k < NS; k++) if (k !== par.col && S.share[k] < best) { best = S.share[k]; col = k; }
  } else {
    col = (par.col + 1 + floor(rnd() * (NS - 1))) % NS;
  }
  const nd = { b: p - w0 * 0.5, col, fit: par.fit + s, tr: s > 0 ? 0 : TR0, v: 0, q: 0, lum: lumNew(), age: 0 };
  const tail = { b: p + w0 * 0.5, col: par.col, fit: par.fit, tr: par.tr, v: par.v, q: par.q, lum: par.lum, age: par.age };
  D.splice(i + 1, 0, nd, tail);
  normalize(D);
}

function stepRim(S) {
  const D = S.dom, u3 = S.u3, u4 = S.u4;
  // wander: a quick one (3 rings of memory) for the wiggles, a slow one (25 rings) for the meanders, and a white jitter for the grain
  const vq = 0.06 + 0.56 * u3, vs = 0.55 - 0.5 * u3 + 0.2 * u3 * u3, sj = 0.02 + 0.42 * pow(u3, 1.2), kv = 0.2 + 0.35 * u3;
  const sAdv = 0.3 + 0.5 * u4;
  // relative fitness
  let fmin = 1e9;
  for (const d of D) if (d.fit < fmin) fmin = d.fit;
  for (const d of D) d.fit = min((d.fit - fmin) * FDEC, FCAP * sAdv);
  // move the boundaries
  let m = D.length;
  if (m > 1) {
    for (let i = 0; i < m; i++) {
      const d = D[i], L = D[(i - 1 + m) % m];
      // a wedge younger than twenty rings opens cleanly before drift gets a hold of its sides
      const yg = sm(4, 20, min(d.age, L.age));
      d.v = d.v * RHO + vs * 0.222 * gauss();
      d.q = d.q * RHO_Q + vq * 0.69 * gauss();
      d.b += GAMMA * (L.fit + L.tr - d.fit - d.tr) + yg * (d.v + d.q + sj * gauss() - kv * hGrad(S, d.b));
    }
    // a domain whose boundaries crossed is gone; the two around it now meet half way
    for (let guard = 0; guard < 64 && D.length > 1; guard++) {
      m = D.length;
      let hit = -1;
      for (let i = 0; i < m; i++) if (rightOf(D, i) - D[i].b <= 0) { hit = i; break; }
      if (hit < 0) break;
      const nx = (hit + 1) % m, mid = (D[hit].b + rightOf(D, hit)) * 0.5;
      D[nx].b = hit + 1 < m ? mid : mid - NA;
      D[nx].v = (D[nx].v + D[hit].v) * 0.5;
      D[nx].q = (D[nx].q + D[hit].q) * 0.5;
      D.splice(hit, 1);
      if (D.length) {
        D.sort((a, c) => a.b - c.b);
        normalize(D);
      }
    }
    normalize(D);
    // neighbours of one strain and one fitness are one domain
    for (let i = D.length - 1; i >= 0 && D.length > 1; i--) {
      const j = (i - 1 + D.length) % D.length;
      if (j !== i && D[i].col === D[j].col && abs(D[i].fit - D[j].fit) < 0.05 && abs(D[i].lum - D[j].lum) < 0.03) {
        D[j].tr = max(D[j].tr, D[i].tr);
        D.splice(i, 1);
      }
    }
    normalize(D);
  }
  for (const d of D) {
    d.tr *= TR_DECAY;
    d.age++;
  }
  // the census, and new wedges
  const target = 8 + 24 * pow(u3, 1.2), have = census(S);
  const pN = 0.004 + 0.018 * u3 + 0.4 * cl((target - have) / target, 0, 1);
  let wide = 0;
  for (let i = 0; i < D.length; i++) wide = max(wide, rightOf(D, i) - D[i].b);
  if (rnd() < pN + 0.2 * cl((wide * target) / NA - 1.8, 0, 1)) spawn(S, 0);
  const pA = 0.055 * pow(sm(0.02, 1, u4), 1.4);
  if (rnd() < pA) spawn(S, sAdv);
}

// rasterise the rim into ring n, update the rim height, and build the mips
function layRing(S) {
  const n = ++S.n, D = S.dom, m = D.length, L0 = S.lv[0];
  const row = (n % NR) * NA, w = L0.w, t = L0.t, fc = S.fc, sh = S.share, lc = S.lc;
  w.fill(0, row * NS, (row + NA) * NS);
  fc.fill(0);
  lc.fill(0);
  sh.fill(0);
  for (let i = 0; i < m; i++) {
    const d = D[i], lo = d.b, hi = rightOf(D, i), col = d.col, f = d.fit + d.tr, lu = d.lum;
    sh[col] += (hi - lo) / NA;
    for (let c = floor(lo); c < hi; c++) {
      const cov = min(hi, c + 1) - max(lo, c);
      if (cov <= 0) continue;
      const cc = c >= NA ? c - NA : c;
      w[(row + cc) * NS + col] += cov;
      fc[cc] += cov * f;
      lc[cc] += cov * lu;
    }
  }
  // granular texture that sits in the colony: grains 3 cells by 3 rings, and streaks 2 cells by 8 rings
  const salt = S.salt;
  const ja = floor(n / 3), fa0 = n / 3 - ja, fa = fa0 * fa0 * (3 - 2 * fa0);
  const jb = floor(n / 8), fb0 = n / 8 - jb, fb = fb0 * fb0 * (3 - 2 * fb0);
  for (let c = 0; c < NA; c++) {
    let ia = floor(c / 3), ga = c / 3 - ia;
    ga = ga * ga * (3 - 2 * ga);
    const ia1 = ia + 1 === NA / 3 ? 0 : ia + 1;
    const a0 = hsh(ia, ja, salt) + (hsh(ia1, ja, salt) - hsh(ia, ja, salt)) * ga;
    const a1 = hsh(ia, ja + 1, salt) + (hsh(ia1, ja + 1, salt) - hsh(ia, ja + 1, salt)) * ga;
    let ib = floor(c / 2), gb = c / 2 - ib;
    gb = gb * gb * (3 - 2 * gb);
    const ib1 = ib + 1 === NA / 2 ? 0 : ib + 1;
    const b0 = hsh(ib, jb, salt + 7) + (hsh(ib1, jb, salt + 7) - hsh(ib, jb, salt + 7)) * gb;
    const b1 = hsh(ib, jb + 1, salt + 7) + (hsh(ib1, jb + 1, salt + 7) - hsh(ib, jb + 1, salt + 7)) * gb;
    t[row + c] = lc[c] * (1 + 0.4 * (a0 + (a1 - a0) * fa - 0.5) + 0.32 * (b0 + (b1 - b0) * fb - 0.5));
  }
  // the rim height
  const u3 = S.u3, u4 = S.u4, h = S.h, hn = S.hn, hz = S.hz;
  let fm = 0;
  for (let c = 0; c < NA; c++) fm += fc[c];
  fm /= NA;
  const sig = 0.06 + 0.12 * u3, bf = 0.05 + 0.05 * u4;
  // the push on the rim is noise with ten rings of memory, so the bumps grow and shift slowly instead of flickering
  for (let i = 0; i < NH; i++) hz[i] = hz[i] * 0.9 + 0.436 * gauss();
  for (let i = 0; i < NH; i++) {
    const a = h[i === 0 ? NH - 1 : i - 1], c = h[i === NH - 1 ? 0 : i + 1];
    const g = (c - a) * 0.5;
    hn[i] = h[i] + H_NU * (a - 2 * h[i] + c) + H_LAM * g * g + bf * ((fc[2 * i] + fc[2 * i + 1]) * 0.5 - fm) - H_KAP * h[i] + sig * hz[i];
  }
  let mean = 0;
  for (let i = 0; i < NH; i++) mean += hn[i];
  mean /= NH;
  for (let i = 0; i < NH; i++) h[i] = cl(hn[i] - mean, -H_MAX, H_MAX);
  // mips: level L holds the average of 2^L rings by 2^L cells, built when its last ring is laid
  for (let L = 1; L <= LMAX; L++) {
    if ((n + 1) % (1 << L) !== 0) break;
    const g = ((n + 1) >> L) - 1, P = S.lv[L - 1], Q = S.lv[L];
    const ra = ((2 * g) % P.nr) * P.na, rb = ((2 * g + 1) % P.nr) * P.na, rq = (g % Q.nr) * Q.na;
    for (let j = 0; j < Q.na; j++) {
      const a0 = ra + 2 * j, b0 = rb + 2 * j;
      for (let k = 0; k < NS; k++)
        Q.w[(rq + j) * NS + k] = 0.25 * (P.w[a0 * NS + k] + P.w[(a0 + 1) * NS + k] + P.w[b0 * NS + k] + P.w[(b0 + 1) * NS + k]);
      Q.t[rq + j] = 0.25 * (P.t[a0] + P.t[a0 + 1] + P.t[b0] + P.t[b0 + 1]);
    }
  }
}

function grow(S) {
  stepRim(S);
  layRing(S);
}

function ease(S, kn, kf) {
  S.hue += (kn[0] - S.hue) * kf;
  S.grow += (kn[1] - S.grow) * kf;
  S.u3 += ((kn[2] + 1) * 0.5 - S.u3) * kf;
  S.u4 += ((kn[3] + 1) * 0.5 - S.u4) * kf;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = knobsOf(input), d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    ease(S, kn, 1);
    // grow from the inoculum until the buffer holds a full, sorted colony and the census has settled
    for (let i = 0; i < NR + 320; i++) grow(S);
    S.acc = rnd();
  }
  ease(S, kn, 1 - exp(-d / 0.3));
  S.acc += d * (RATE0 + RATE * S.grow);
  let k = 0;
  while (S.acc >= 1 && k < 10) {
    grow(S);
    S.acc -= 1;
    k++;
  }
  if (S.acc >= 1) S.acc = 0.999;
}

// ---- colour: four fluorescent strains, a quarter turn and a bit apart, turned together by K1
const BASE = [0.355, 0.975, 0.515, 0.16]; // GFP green, mCherry red, CFP cyan, YFP yellow
function hueRGB(hh, out, o) {
  const h6 = (((hh % 1) + 1) % 1) * 6, i = floor(h6), f = h6 - i;
  let r, g, b;
  switch (i) {
    case 0: r = 1; g = f; b = 0; break;
    case 1: r = 1 - f; g = 1; b = 0; break;
    case 2: r = 0; g = 1; b = f; break;
    case 3: r = 0; g = 1 - f; b = 1; break;
    case 4: r = f; g = 0; b = 1; break;
    default: r = 1; g = 0; b = 1 - f;
  }
  // lift the dark blues and purples toward white so every strain glows about as bright
  const y = 0.3 * r + 0.59 * g + 0.11 * b, wl = max(0, 0.42 - y) * 0.75;
  out[o] = 255 * (r + (1 - r) * wl);
  out[o + 1] = 255 * (g + (1 - g) * wl);
  out[o + 2] = 255 * (b + (1 - b) * wl);
}

function sampleAt(S, L, A, c0, c1, fc, wgt, acc) {
  const lv = S.lv[L], na = lv.na, nr = lv.nr, sc = 1 << L;
  const gmax = ((S.n + 1) >> L) - 1, gmin = gmax - nr + 1;
  let g = (A - (sc - 1) * 0.5) / sc;
  if (g > gmax) g = gmax;
  if (g < gmin) g = gmin;
  const g0 = floor(g), fg = g - g0, g1 = g0 + 1 > gmax ? gmax : g0 + 1;
  const r0 = (g0 % nr) * na, r1 = (g1 % nr) * na;
  const w00 = (1 - fg) * (1 - fc) * wgt, w01 = (1 - fg) * fc * wgt, w10 = fg * (1 - fc) * wgt, w11 = fg * fc * wgt;
  const W4 = lv.w, T = lv.t;
  const i00 = r0 + c0, i01 = r0 + c1, i10 = r1 + c0, i11 = r1 + c1;
  const j00 = i00 * NS, j01 = i01 * NS, j10 = i10 * NS, j11 = i11 * NS;
  acc[0] += w00 * W4[j00] + w01 * W4[j01] + w10 * W4[j10] + w11 * W4[j11];
  acc[1] += w00 * W4[j00 + 1] + w01 * W4[j01 + 1] + w10 * W4[j10 + 1] + w11 * W4[j11 + 1];
  acc[2] += w00 * W4[j00 + 2] + w01 * W4[j01 + 2] + w10 * W4[j10 + 2] + w11 * W4[j11 + 2];
  acc[3] += w00 * W4[j00 + 3] + w01 * W4[j01 + 3] + w10 * W4[j10 + 3] + w11 * W4[j11 + 3];
  acc[4] += w00 * T[i00] + w01 * T[i01] + w10 * T[i10] + w11 * T[i11];
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const pal = S.pal;
  for (let k = 0; k < NS; k++) hueRGB(BASE[k] + S.hue, pal, k * 3);
  // the middle: the average of the oldest ring at the coarsest level
  {
    const lv = S.lv[LMAX], gmax = ((S.n + 1) >> LMAX) - 1, gmin = gmax - lv.nr + 1, row = (gmin % lv.nr) * lv.na;
    const cw = [0, 0, 0, 0];
    for (let j = 0; j < lv.na; j++) for (let k = 0; k < NS; k++) cw[k] += lv.w[(row + j) * NS + k] / lv.na;
    // the inoculum is thick and mixed: a pale glow of all the strains there are
    for (let ch = 0; ch < 3; ch++) S.cen[ch] = 0.55 * (cw[0] * pal[ch] + cw[1] * pal[3 + ch] + cw[2] * pal[6 + ch] + cw[3] * pal[9 + ch]) + 0.45 * 235;
  }
  const acc = S.acc5, phi = S.acc, n = S.n, h = S.h;
  const pa = S.pa, pl = S.pl, pr = S.pr, plod = S.plod, ca = S.ca, cf = S.cf;
  for (let p = 0; p < NPX; p++) {
    const a = pa[p], r = pr[p];
    // the rim at this angle
    const hx = (a * NH) / NA, hi = floor(hx), hf = hx - hi, hj = hi + 1 === NH ? 0 : hi + 1;
    const d0 = R0 + h[hi] + (h[hj] - h[hi]) * hf - r;
    if (d0 < -7) {
      display.setPixel(p % W, (p / W) | 0, 0, 0, 0);
      continue;
    }
    const k = -pl[p] - phi;
    const A = n - (k > 0 ? k : 0);
    const lod = plod[p], L0 = lod | 0, lf = lod - L0;
    acc[0] = acc[1] = acc[2] = acc[3] = acc[4] = 0;
    sampleAt(S, L0, A, ca[p * 4], ca[p * 4 + 1], cf[p * 2], 1 - lf, acc);
    if (lf > 0.02) sampleAt(S, L0 + 1, A, ca[p * 4 + 2], ca[p * 4 + 3], cf[p * 2 + 1], lf, acc);
    let w0 = acc[0], w1 = acc[1], w2 = acc[2], w3 = acc[3];
    const tot = w0 + w1 + w2 + w3 + 1e-6;
    const pur = max(max(w0, w1), max(w2, w3)) / tot;
    // sharpen the mix so two strains meet without a muddy band
    w0 *= w0; w1 *= w1; w2 *= w2; w3 *= w3;
    const q = 1 / (w0 + w1 + w2 + w3 + 1e-9);
    let R = (w0 * pal[0] + w1 * pal[3] + w2 * pal[6] + w3 * pal[9]) * q;
    let G = (w0 * pal[1] + w1 * pal[4] + w2 * pal[7] + w3 * pal[10]) * q;
    let B = (w0 * pal[2] + w1 * pal[5] + w2 * pal[8] + w3 * pal[11]) * q;
    const cm = sm(5, 1.2, r);
    if (cm > 0) {
      R += (S.cen[0] - R) * cm;
      G += (S.cen[1] - G) * cm;
      B += (S.cen[2] - B) * cm;
    }
    // the grain darkens only a little, since a dim yellow reads as olive on the panel, and lifts toward white where it is bright
    const tv = acc[4] / tot - 1, tex = tv < 0 ? 1 + 0.4 * tv : 1 + 0.2 * tv, tw = tv > 0 ? 0.3 * tv : 0;
    const mix = sm(0.95, 0.5, pur), seam = 1 - 0.55 * mix * sm(3, 10, r);
    // where two strains meet the rim it is notched: the two lobes grow past the boundary between them
    const d = d0 - 2.4 * mix;
    // inside: brightest just behind the rim, a bright whitish band at the rim itself; beyond it the glow on the agar
    const e = cl(d + 0.5, 0, 1), di = d > 0 ? d : 0, rim = exp(-di / 1.6);
    const body = 0.93 + 0.08 * exp(-di / 16) + 0.06 * sm(16, 3, r);
    const glow = 0.45 * exp((d < 0 ? d : 0) / 1.3);
    const lum = ((body + 0.5 * rim) * tex * e + glow * (1 - e)) * seam;
    const wht = (0.5 * rim + tw * seam) * e;
    R = R * lum + 255 * wht;
    G = G * lum + 255 * wht;
    B = B * lum + 255 * wht;
    display.setPixel(p % W, (p / W) | 0, R > 255 ? 255 : R | 0, G > 255 ? 255 : G | 0, B > 255 ? 255 : B | 0);
  }
}
