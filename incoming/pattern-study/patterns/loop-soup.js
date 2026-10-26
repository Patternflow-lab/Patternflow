// ===== Patternflow pattern =====
// Title:   Loop Soup
// Family:  noise
// Idea:    Closed random walks on a lattice of every other LED, rooted anywhere and sized by the scale-invariant loop measure so that each octave of length holds half as many loops as the one below, are born as a Poisson cloud, draw themselves with a white head until they close, and fade after seven seconds, while every cluster of loops that share a site takes the colour of its longest loop, so at the opening c = 1 the soup shows dozens of separate clusters of every size, and as c rises they merge into one that holds nine tenths of the ink.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Brownian loop soup (Gregory Lawler and Wendelin Werner, 2004), random walk loop soup (Gregory Lawler and José Trujillo Ferreras, 2007), CLE from loop-soup clusters (Scott Sheffield and Wendelin Werner, 2012), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Log2 c=-2..2, Smallest=-1..4
//
// Knob 1: Hue. Turns every cluster's colour round the wheel together. Each loop takes the next hue of a golden-ratio sequence, 0.618 of the wheel on from the last, and a cluster shows the hue of its longest loop, so when a long loop is drawn across smaller clusters they all take its colour, and when it fades they get their own back. The wheel skips the orange stretch that reads brown on a fading loop.
// Knob 2: Speed. At 2 a loop lives 7 s: its head draws it in 0.57 s for 4 steps, 0.22 s longer for each doubling up to 2.55 s for 2048, it shines at full as it closes, eases to 70% and fades over its last 2.5 s. At c = 1 about 20 loops are born a second. 0.2 is ten times slower, 3 one and a half times faster.
// Knob 3: Log2 c. The intensity c is 2 to this power, 0.25 to 4, and 1 at the opening 0. The loops alive at any moment are a Poisson soup of c/2 times the random walk loop measure, the normalisation in which c is the central charge, and c = 0.25, 0.5 and 1 go with CLE(kappa) for kappa = 2.81, 3 and 4. Measured over six runs of a minute: up to c = 1.4 the largest of 23 to 59 clusters holds about a third of the inked LEDs and crosses the panel from top to bottom in at most 1% of frames; at 2 it crosses in 6%, at 2.8 in 30% holding 59% of the ink, and at 4 in 86% holding 90%. The ink covers 6% of the panel at 0.25, 21% at 1 and 52% at 4.
// Knob 4: Smallest. The shortest loop, 2 round(2 x 2^K4) steps: at -1 two steps, a dash over one edge and the commonest loop of the measure, 128 of them on the panel at c = 1; at the opening 4 steps, at 2 16 and at 4 64. The small loops are the glue: at c = 4 the largest cluster holds 92% of the ink with the two-step loops in, 90% from 4 steps, 79% from 16 and 71% from 64, and it crosses the panel in 93%, 86%, 58% and 24% of frames.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, log, round, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The lattice: one site every other LED, 32 x 64 on the panel, and the
// LED between two neighbouring sites is the edge joining them. The soup
// lives on a bigger lattice, M sites past every side, so loops come in
// from off the panel and clusters join off it too.
const SW = 32, SH = 64, M = 40, GW = SW + 2 * M, GH = SH + 2 * M;
// Loops have 2j steps, j up to JMAX; the longest, 1024 to 2048 steps, are
// about 70 LEDs across.
const JMAX = 1024;
// A loop lives LIFE seconds of soup time and fades for the last FADE.
const LIFE = 7, FADE = 2.5;
const GOLD = 0.618034;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim orange and yellow read brown and olive, so the wheel skips them.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

// The random walk loop measure: the loops of 2j steps rooted at one site
// weigh p(2j) / 2j, p(2j) the chance a simple random walk is back at its
// start after 2j steps, (C(2j, j) / 4^j)^2, about 1 / (pi j). So per site
// the loops of 2j to 4j steps weigh about 1 / (4 pi j): half as much each
// octave up, the scale invariance of Lawler and Werner's Brownian loop
// measure dt dA / (2 pi t^2).
const WJ = new Float64Array(JMAX + 1);
{
  let r = 1;
  for (let j = 1; j <= JMAX; j++) {
    r *= (2 * j - 1) / (2 * j);
    WJ[j] = (r * r) / (2 * j);
  }
}
// Loops of 2j steps are rooted up to this many sites off the panel.
const reach = (j) => min(M, ceil(1.5 * sqrt(j)));
const area = (j) => (SW + 2 * reach(j)) * (SH + 2 * reach(j));

// Loops alive at once, per unit of lambda, for the shortest loop 2 jmin.
function table(jmin) {
  const cum = new Float64Array(JMAX + 1);
  let t = 0;
  for (let j = 1; j <= JMAX; j++) {
    if (j >= jmin) t += WJ[j] * area(j);
    cum[j] = t;
  }
  return cum;
}

function poisson(mu) {
  // Knuth for small means, a rounded normal for big ones.
  if (mu > 30) return max(0, round(mu + sqrt(mu) * gauss()));
  let k = 0, p = 1;
  const L = exp(-mu);
  for (;;) {
    p *= Math.random();
    if (p < L) return k;
    k++;
  }
}
function gauss() {
  const u = Math.random() || 1e-9, v = Math.random();
  return sqrt(-2 * log(u)) * Math.cos(6.283185 * v);
}

// A uniform random walk bridge of 2j steps from site (a, b). Turned 45
// degrees, a simple random walk is two independent coin-flip walks, so a
// walk that comes back is two shuffles of j heads and j tails.
function makeLoop(S, j, a, b, age) {
  const n = 2 * j, u = new Int8Array(n), v = new Int8Array(n);
  for (let i = 0; i < n; i++) u[i] = v[i] = i < j ? 1 : -1;
  for (let i = n - 1; i > 0; i--) {
    let k = floor(Math.random() * (i + 1)), t = u[i];
    u[i] = u[k];
    u[k] = t;
    k = floor(Math.random() * (i + 1));
    t = v[i];
    v[i] = v[k];
    v[k] = t;
  }
  // site[t] is the lattice cell after t steps (or -1 off the lattice);
  // led[2t] the edge LED of step t and led[2t + 1] the site LED it reaches.
  const site = new Int32Array(n + 1), led = new Int32Array(2 * n);
  let x = a, y = b;
  const cell = (x, y) => (x >= -M && x < SW + M && y >= -M && y < SH + M ? (y + M) * GW + x + M : -1);
  const px = (X, Y) => (X >= 0 && X < W && Y >= 0 && Y < H ? Y * W + X : -1);
  site[0] = cell(x, y);
  for (let t = 0; t < n; t++) {
    const dx = (u[t] + v[t]) >> 1, dy = (u[t] - v[t]) >> 1;
    led[2 * t] = px(2 * x + dx, 2 * y + dy);
    x += dx;
    y += dy;
    site[t + 1] = cell(x, y);
    led[2 * t + 1] = px(2 * x, 2 * y);
  }
  // A loop draws itself in 0.35 s for two steps and 0.22 s more for each
  // doubling, 2.55 s for 2048.
  const trace = 0.35 + 0.22 * log(j) / log(2);
  S.loops.push({ j, n, a, b, x1: x, y1: y, site, led, age, trace, hue: (S.seq++ * GOLD) % 1, p: 0 });
}

function birth(S, j, age) {
  const r = reach(j);
  const a = floor(-r + Math.random() * (SW + 2 * r)), b = floor(-r + Math.random() * (SH + 2 * r));
  makeLoop(S, j, a, b, age);
}

function pickJ(S) {
  const cum = S.cum, t = Math.random() * cum[JMAX];
  let lo = S.jmin, hi = JMAX;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (cum[m] < t) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, c: 1, jmin: 2, cum: table(2), loops: [], seq: 0, warm: false,
    owner: new Int32Array(GW * GH), lev: new Float32Array(W * H), hueAt: new Float32Array(W * H),
    white: new Uint8Array(W * H), col: new Float32Array(3),
  };
}

const drawnSteps = (L) => (L.age >= L.trace ? L.n : floor((L.n * L.age) / L.trace));
// A loop's brightness: full as it closes, easing to 70% and fading out.
const bright = (L) => {
  if (L.age < L.trace) return 1;
  const a = L.age - L.trace;
  if (L.age > LIFE - FADE) return 0.7 * max(0, (LIFE - L.age) / FADE);
  return 0.7 + 0.3 * exp(-a / 0.6);
};

function find(par, i) {
  while (par[i] !== i) i = par[i] = par[par[i]];
  return i;
}

function step(S, ds) {
  const lam = S.c / 2;
  // Age and drop.
  const loops = S.loops;
  let w = 0;
  for (const L of loops) {
    L.age += ds;
    if (L.age < LIFE) loops[w++] = L;
  }
  loops.length = w;
  // Poisson births: lam = c/2 times the measure, spread over a lifetime, so
  // the loops alive at any moment are a loop soup of central charge c.
  const k = poisson((lam * S.cum[JMAX] * ds) / LIFE);
  for (let i = 0; i < k; i++) birth(S, pickJ(S), Math.random() * ds);
}

// Clusters: loops that share a site, drawn so far, on or off the panel.
function cluster(S) {
  const { loops, owner } = S, n = loops.length, par = new Int32Array(n);
  owner.fill(-1);
  for (let i = 0; i < n; i++) par[i] = i;
  for (let i = 0; i < n; i++) {
    const L = loops[i], s = L.site, k = drawnSteps(L);
    for (let t = 0; t <= k; t++) {
      const g = s[t];
      if (g < 0) continue;
      const o = owner[g];
      if (o < 0) owner[g] = i;
      else {
        const ra = find(par, o), rb = find(par, i);
        if (ra !== rb) par[ra] = rb;
      }
    }
  }
  // Each cluster takes the colour of its longest loop, the oldest of those.
  const lead = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const r = find(par, i), l = lead[r];
    if (l < 0 || loops[i].n > loops[l].n || (loops[i].n === loops[l].n && loops[i].age > loops[l].age)) lead[r] = i;
  }
  for (let i = 0; i < n; i++) loops[i].p = loops[lead[find(par, i)]].hue;
  S.par = par;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.c = 2 ** cl(k[2], -2, 2);
  const jmin = max(1, round(2 * 2 ** cl(k[3], -1, 4)));
  if (jmin !== S.jmin) {
    S.jmin = jmin;
    S.cum = table(jmin);
    S.loops = S.loops.filter((L) => L.j >= jmin);
  }
  if (!S.warm) {
    // Open on a soup already at its steady state: every length its Poisson
    // count, each loop somewhere in its life.
    const lam = S.c / 2;
    for (let j = jmin; j <= JMAX; j++) {
      const q = poisson(lam * WJ[j] * area(j));
      for (let i = 0; i < q; i++) birth(S, j, Math.random() * LIFE);
    }
    S.warm = true;
  }
  step(S, (d * S.speed) / 2);
  cluster(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { lev, hueAt, white, col } = S;
  lev.fill(0);
  white.fill(0);
  for (const L of S.loops) {
    const b = bright(L), k = drawnSteps(L), led = L.led;
    if (b <= 0) continue;
    // The root LED, then every step drawn so far.
    const r = led[2 * L.n - 1];
    if (r >= 0 && b > lev[r]) (lev[r] = b), (hueAt[r] = L.p);
    for (let i = 0; i < 2 * k; i++) {
      const p = led[i];
      if (p >= 0 && b > lev[p]) (lev[p] = b), (hueAt[p] = L.p);
    }
    // The walker's head, white, while the loop is being drawn.
    if (k < L.n && k > 0) {
      const p = led[2 * k - 1];
      if (p >= 0) white[p] = 1;
    }
  }
  const h0 = S.hue + 0.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (white[p]) {
        display.setPixel(x, y, 255, 255, 255);
        continue;
      }
      const v = lev[p];
      if (v <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      hsv(wheel(h0 + hueAt[p]), 0.8, v, col, 0);
      display.setPixel(x, y, round(col[0] * 255), round(col[1] * 255), round(col[2] * 255));
    }
}
