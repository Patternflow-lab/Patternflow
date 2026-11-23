// ===== Patternflow pattern =====
// Title:   Sparse Atoms
// Family:  receptive
// Idea:    A grid of 128 small image atoms, amber where a weight is positive and teal where it is negative, that keeps learning oriented edge detectors by sparse coding of patches cut from a drifting procedural scene, each atom glowing as the sparse code of the current patches picks it.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: sparse coding with an overcomplete basis (Bruno Olshausen and David Field, 1996), simple cells of cat visual cortex (David Hubel and Torsten Wiesel, 1959 and 1962), iterative soft-thresholding (Ingrid Daubechies, Michel Defrise and Christine De Mol, 2004, from memory), pattern round 225
// Round:   225
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Plasticity=0..4, Sparsity=-1..1, Scene=-1..1
//
// Knob 1: Hue. Turns the pair of colours round the wheel together. At 0 the positive weights are amber and the negative ones teal; at 0.5 they are blue and red.
// Knob 2: Plasticity. The learning rate per patch: 0.0008 at 0 (the atoms hold still and only the glow flickers), 0.35 at 2 where it opens (an atom turns a few degrees a second), 1.0 at 4 (about 15 degrees a second, and an atom now and then hands its edge to a neighbour).
// Knob 3: Sparsity. The soft threshold lambda on a patch of unit length, 0.13 at -1 (about nine atoms speak for a patch, so a quarter of the tiles glow and the atoms are more mixed), 0.3 at 0 (five atoms), 0.69 at +1 (one or two atoms, clean edges, few tiles glow). The atoms re-learn toward it over the next ten seconds.
// Knob 4: Scene. Turns the favoured edge angle of the scene by 45 degrees either way on top of its slow drift, so -1 and +1 are 90 degrees apart. The tiles that glow change at once; the atoms re-orient over the next ten or fifteen seconds, faster while the knob is moving.

const W = 64, H = 128;
const S = 7, N = S * S;          // an atom is 7 x 7 pixels
const K = 128, NCOL = 8, NROW = 16;         // 128 atoms in 8 columns by 16 rows of 8 x 8 LED tiles
const { floor, sqrt, exp, log, sin, cos, abs, pow, max, min, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const SWEEPS = 3;                // sweeps of soft-thresholding per patch
const CAND = 40;                 // most atoms swept for one patch
const RATE = 800;                // patches learnt per second of panel time
const ETA_TOP = 1;              // learning rate per patch at Plasticity 4
const SHOW = 15;                 // patches a second whose code lights the grid
const PRE = 5200;                // patches learnt before the first frame
const DEAD_T = 6;                // seconds without a hit before an atom is re-seeded
const GLOW_T = 0.2;              // seconds for a glow to fall by a factor of e
const GAMMA = 0.02;              // weight decay of an atom, as a share of its step
const BETA = 2.5;                  // how hard a dense code pulls an atom toward its blur
const IDLE = 0.7;                // brightness of an atom that no patch is using

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
function gauss(rand) {
  return sqrt(-2 * log(rand() + 1e-9)) * cos(TAU * rand());
}

function hsv(h, s, v, out, o) {
  h = h - floor(h);
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// The scene's statistics at time t. They move on sines whose periods do not
// divide each other, so the mix never comes round to an earlier one. phi is the
// favoured edge angle, spread how tightly edges hug it, mix how many edges
// follow it at all, soft the blur of an edge in LEDs and len the half length of
// an edge segment. kn is the Scene knob, -1..1.
function scene(t, kn) {
  return {
    phi: 0.9 * sin((TAU * t) / 37.1 + 0.4) + 0.55 * sin((TAU * t) / 21.3 + 2.1) + 0.3 * sin((TAU * t) / 13.7 + 4) + 0.79 * kn,
    spread: 0.3 + 0.08 * sin((TAU * t) / 61.7 + 1.7),
    mix: 0.7 + 0.08 * sin((TAU * t) / 73.9 + 0.9),
    scale: exp(0.32 * sin((TAU * t) / 53.3 + 1) + 0.22 * sin((TAU * t) / 31.7 + 3.1) + 0.12 * sin((TAU * t) / 17.3 + 0.3)),
  };
}

// One 7 x 7 patch of the scene, zero mean and unit length, into P.x. A scene is
// edge segments at random places, angles and signed contrasts, seen through the
// band-pass of an eye: an edge is a signed lobe either side of its line (odd) and
// a thin bar is a ridge with a trough either side (even), each cut off along its
// length. Now and then there is a soft blob, and always a little noise. A few
// contrasts dominate each patch, which is what makes its code sparse.
function genPatch(P, sc) {
  const { rand, x } = P;
  for (;;) {
    x.fill(0);
    const u = rand();
    const ne = u < 0.45 ? 1 : u < 0.8 ? 2 : 3;
    for (let e = 0; e < ne; e++) {
      const al = rand() < sc.mix ? sc.phi + sc.spread * gauss(rand) : PI * rand();
      const ca = cos(al), sa = sin(al);
      const px = (rand() - 0.5) * 9, py = (rand() - 0.5) * 9;
      const iw = 1 / ((0.5 + 0.8 * sc.scale) * exp(0.25 * gauss(rand)));
      const il = 1 / (3.4 * (0.6 + 0.4 * sc.scale) * exp(0.35 * gauss(rand)));
      const amp = (rand() < 0.5 ? -1 : 1) * exp(0.8 * gauss(rand));
      const odd = rand() < 0.62;
      for (let y = 0; y < S; y++)
        for (let xx = 0; xx < S; xx++) {
          const dx = xx - 3 - px, dy = y - 3 - py;
          const v = (dx * ca + dy * sa) * il;
          const w = 1 / (1 + v * v * v * v);
          const q = (dy * ca - dx * sa) * iw;
          const g = exp(-0.5 * q * q);
          x[y * S + xx] += amp * w * g * (odd ? 1.65 * q : 1 - q * q);
        }
    }
    if (rand() < 0.2) {
      const bx = (rand() - 0.5) * 7, by = (rand() - 0.5) * 7;
      const ir = 1 / (2 * pow(1.2 + 1.6 * rand() * sc.scale, 2));
      const amp = (rand() < 0.5 ? -0.8 : 0.8) * exp(0.6 * gauss(rand));
      for (let y = 0; y < S; y++)
        for (let xx = 0; xx < S; xx++) {
          const dx = xx - 3 - bx, dy = y - 3 - by;
          x[y * S + xx] += amp * exp(-(dx * dx + dy * dy) * ir);
        }
    }
    let m = 0;
    for (let i = 0; i < N; i++) {
      x[i] += 0.04 * gauss(rand);
      m += x[i];
    }
    m /= N;
    let e = 0;
    for (let i = 0; i < N; i++) {
      x[i] -= m;
      e += x[i] * x[i];
    }
    if (e < 1e-4) continue;
    e = 1 / sqrt(e);
    for (let i = 0; i < N; i++) x[i] *= e;
    return;
  }
}

// Make atom j zero mean and unit length.
function tidy(D, j, rand) {
  const o = j * N;
  let m = 0;
  for (let i = 0; i < N; i++) m += D[o + i];
  m /= N;
  let e = 0;
  for (let i = 0; i < N; i++) {
    const v = D[o + i] - m;
    D[o + i] = v;
    e += v * v;
  }
  if (!(e > 1e-12)) {
    // Collapsed or not a number: start from noise.
    e = 0;
    for (let i = 0; i < N; i++) e += (D[o + i] = rand() - 0.5) ** 2;
  }
  e = 1 / sqrt(e);
  for (let i = 0; i < N; i++) D[o + i] *= e;
}

// The sparse code of P.x on the current atoms, into P.a, leaving the residual in
// P.r. It is iterative soft-thresholding done one atom at a time (the sweep form
// of the Daubechies iteration, which needs no step size and so cannot diverge on
// a dictionary whose atoms overlap): a_j <- soft(a_j + d_j . r, lambda), then r is
// brought up to date. Only atoms whose correlation with the patch is at least
// 0.55 lambda are swept, the best first, three times round. The threshold is
// capped just under the best correlation, so a patch always picks an atom.
function encode(P, lam) {
  const { D, x, a, r, c, cand } = P;
  let cm = 0;
  for (let j = 0; j < K; j++) {
    const o = j * N;
    let s = 0;
    for (let i = 0; i < N; i++) s += D[o + i] * x[i];
    c[j] = s;
    if (abs(s) > cm) cm = abs(s);
  }
  if (lam > 0.9 * cm) lam = 0.9 * cm;
  const th = 0.55 * lam;
  // The candidates, best first, at most CAND of them.
  let m = 0;
  for (let j = 0; j < K; j++) {
    const ac = abs(c[j]);
    if (ac <= th) continue;
    let q;
    if (m < CAND) q = m++;
    else if (ac > abs(c[cand[CAND - 1]])) q = CAND - 1;
    else continue;
    while (q > 0 && abs(c[cand[q - 1]]) < ac) {
      cand[q] = cand[q - 1];
      q--;
    }
    cand[q] = j;
  }
  P.nc = m;
  a.fill(0);
  r.set(x);
  for (let sw = 0; sw < SWEEPS; sw++)
    for (let q = 0; q < m; q++) {
      const j = cand[q], o = j * N;
      let s = a[j];
      for (let i = 0; i < N; i++) s += D[o + i] * r[i];
      const nv = s > lam ? s - lam : s < -lam ? s + lam : 0;
      const dv = nv - a[j];
      if (dv !== 0) {
        for (let i = 0; i < N; i++) r[i] -= dv * D[o + i];
        a[j] = nv;
      }
    }
}

// The Hebbian step, D_j += eta * (x - D a) * a_j for every atom the code used,
// then back to unit length. Records the hits for the glow and the idle clocks.
function learn(P, eta, glowOn) {
  const { D, a, r, rand } = P;
  let en = 0;
  for (let i = 0; i < N; i++) en += r[i] * r[i];
  for (let q = 0; q < P.nc; q++) {
    const j = P.cand[q], aj = a[j];
    if (aj === 0) continue;
    if (abs(aj) > 0.04) {
      if (P.idle[j] >= 0) P.idle[j] = 0;
      P.use[j] += 1;
    }
    if (glowOn) {
      const gv = cl(0.3 + abs(aj) * 1.6, 0, 1);
      if (gv > P.glow[j]) {
        P.glow[j] = gv;
        P.gsign[j] = aj > 0 ? 1 : -1;
      }
    }
    if (eta > 0) {
      const o = j * N, e = eta * aj;
      if (P.beta > 0) {
        // Dense codes reward smooth atoms, so below lambda 0.3 the step also
        // pulls the atom toward its own 3 x 3 blur, the more so the denser the code.
        const b = P.beta, tmp = P.tmp;
        for (let y = 0; y < S; y++)
          for (let xx = 0; xx < S; xx++) {
            const x0 = xx > 0 ? xx - 1 : 0, x1 = xx < S - 1 ? xx + 1 : xx;
            const y0 = y > 0 ? y - 1 : 0, y1 = y < S - 1 ? y + 1 : y;
            tmp[y * S + xx] =
              0.0625 * (D[o + y0 * S + x0] + D[o + y0 * S + x1] + D[o + y1 * S + x0] + D[o + y1 * S + x1]) +
              0.125 * (D[o + y0 * S + xx] + D[o + y1 * S + xx] + D[o + y * S + x0] + D[o + y * S + x1]) +
              0.25 * D[o + y * S + xx];
          }
        for (let i = 0; i < N; i++) D[o + i] += e * (r[i] + b * (tmp[i] - D[o + i]));
      } else for (let i = 0; i < N; i++) D[o + i] += e * r[i];
      // A weight below the decay it is given each step is cut to zero, so the
      // background of an atom stays dark and only the lobes that keep being
      // fed by the residual survive.
      const sh = eta * abs(aj) * GAMMA;
      for (let i = 0; i < N; i++) {
        const v = D[o + i];
        D[o + i] = v > sh ? v - sh : v < -sh ? v + sh : 0;
      }
      tidy(D, j, rand);
    }
  }
  // Keep the patch for the pool of seeds; reseed() picks the worst explained of a few.
  const o = P.pn * N;
  for (let i = 0; i < N; i++) P.pool[o + i] = P.x[i];
  P.pe[P.pn] = en;
  P.pn = (P.pn + 1) % 24;
}

function reseed(P, j) {
  const { D, pool, pe, rand } = P;
  // The worst explained of six recent patches, taken as it is.
  let best = -1, be = 0;
  for (let n = 0; n < 6; n++) {
    const k = floor(rand() * 24);
    if (pe[k] > be) {
      be = pe[k];
      best = k;
    }
  }
  const o = j * N;
  if (best < 0) for (let i = 0; i < N; i++) D[o + i] = rand() - 0.5;
  else for (let i = 0; i < N; i++) D[o + i] = pool[best * N + i];
  tidy(D, j, rand);
  P.idle[j] = -2.5;
  P.use[j] = 1;
  P.born[j] = 1;
}

// The learning done before the first frame, so the opening is already a
// half-organised dictionary: the scene's clock runs 14 s up to the moment the
// panel starts, the rate falls from 0.09 to 0.025, and the glow is left alone.
function pretrain(P, lam, kn) {
  const { idle } = P;
  idle.fill(0);
  for (let n = 0; n < PRE; n++) {
    const f = n / PRE;
    genPatch(P, scene(-14 + 14 * f, kn));
    encode(P, lam);
    learn(P, 0.09 - 0.065 * f, false);
    // Here the idle clocks count patches. Every 25 patches the atom unused the longest is re-seeded.
    for (let j = 0; j < K; j++) idle[j]++;
    if (n % 25 === 24 && f < 0.85) {
      let worst = -1, wi = 200;
      for (let j = 0; j < K; j++) if (idle[j] > wi) {
        wi = idle[j];
        worst = j;
      }
      if (worst >= 0) {
        reseed(P, worst);
        idle[worst] = -100;
      }
    }
  }
  idle.fill(0);
  P.use.fill(1);
  P.born.fill(0);
  P.disp.set(P.D);
  for (let j = 0; j < K; j++) {
    let m = 0;
    for (let i = 0; i < N; i++) m = max(m, abs(P.D[j * N + i]));
    P.dmax[j] = m;
  }
}

export function setup(params) {
  const P = params;
  P.rand = rng(225225);
  P.t = 0;
  P.ready = false;
  P.D = new Float32Array(K * N);
  P.disp = new Float32Array(K * N);
  P.dmax = new Float32Array(K).fill(0.3);
  P.x = new Float32Array(N);
  P.r = new Float32Array(N);
  P.a = new Float32Array(K);
  P.c = new Float32Array(K);
  P.tmp = new Float32Array(N);
  P.beta = 0;
  P.cand = new Int32Array(CAND);
  P.nc = 0;
  P.pool = new Float32Array(24 * N);
  P.pe = new Float32Array(24);
  P.pn = 0;
  P.glow = new Float32Array(K);
  P.gsign = new Float32Array(K).fill(1);
  P.idle = new Float32Array(K);
  P.use = new Float32Array(K).fill(1);
  P.born = new Float32Array(K);
  P.owed = 0;
  P.owedG = 0;
  P.dc = 0;
  P.hc = -9;
  P.pos = new Float32Array(256 * 3);
  P.neg = new Float32Array(256 * 3);
  // Atoms start as lightly smoothed noise.
  const D = P.D, rand = P.rand;
  for (let j = 0; j < K; j++) {
    const o = j * N;
    for (let i = 0; i < N; i++) D[o + i] = rand() - 0.5;
    for (let pass = 0; pass < 2; pass++)
      for (let y = 0; y < S; y++)
        for (let xx = 0; xx < S; xx++) {
          const i = o + y * S + xx;
          const l = xx > 0 ? D[i - 1] : D[i], rr = xx < S - 1 ? D[i + 1] : D[i];
          D[i] = 0.5 * D[i] + 0.25 * (l + rr);
        }
    tidy(D, j, rand);
  }
  P.disp.set(D);
}

function palettes(P, h0) {
  P.hc = h0;
  const hn = h0 + 0.43;
  for (let i = 0; i < 256; i++) {
    const b = i / 255;
    const sat = 0.97 - 0.4 * b * b * b;
    const v = b === 0 ? 0 : 0.2 + 0.8 * pow(b, 0.8);
    hsv(h0, sat, v, P.pos, i * 3);
    hsv(hn, sat, v, P.neg, i * 3);
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  const kn = cl(k[3], -1, 1);
  const ks = cl(k[2], -1, 1);
  const lam = 0.3 * pow(2, 1.2 * ks);
  P.beta = ks < 0 ? BETA * pow(-ks, 1.2) : 0;
  const kp = cl(k[1], 0, 4) / 4;
  let eta = 0.0008 + ETA_TOP * kp * pow(kp, 0.5);
  const d = cl(dt, 0, 0.1);

  const h0 = 0.085 + k[0];
  if (abs(h0 - P.hc) > 1e-4) palettes(P, h0);
  if (!P.ready) {
    P.ready = true;
    P.kns = kn;
    pretrain(P, lam, kn);
  }
  P.t += d;
  // A sudden turn of Scene makes every old edge wrong at once, and the atoms
  // learn faster for a couple of seconds, the way a surprise speeds learning.
  P.kns += (kn - P.kns) * (1 - exp(-d / 2));
  eta = min(1.2, eta * (1 + 4 * min(1, 1.5 * abs(kn - P.kns))));

  const sc = scene(P.t, kn);
  P.owed += RATE * d;
  const np = floor(P.owed);
  P.owed -= np;
  const decay = exp(-d / GLOW_T);
  for (let j = 0; j < K; j++) P.glow[j] *= decay;
  // Every few frames one patch is the one whose code is shown, glowing the atoms it picks.
  P.owedG += SHOW * d;
  for (let n = 0; n < np; n++) {
    genPatch(P, sc);
    encode(P, lam);
    const show = n === 0 && P.owedG >= 1;
    if (show) P.owedG -= 1;
    learn(P, eta, show);
  }
  if (P.owedG > 2) P.owedG = 2;

  // Idle clocks, dead atoms and twins. An atom no patch has used for a while is
  // given a new edge from a recent patch; of two near copies the less used one is.
  const { idle, use, born, D } = P;
  const ud = exp(-d / 8);
  let worst = -1, wi = DEAD_T;
  for (let j = 0; j < K; j++) {
    idle[j] += d;
    use[j] *= ud;
    born[j] = born[j] > 0 ? born[j] - d / 0.9 : 0;
    if (idle[j] > wi) {
      wi = idle[j];
      worst = j;
    }
  }
  if (worst >= 0 && eta > 0.002) reseed(P, worst);
  {
    const i = P.dc;
    P.dc = (P.dc + 1) % K;
    const oi = i * N;
    for (let j = 0; j < K; j++) {
      if (j === i) continue;
      const oj = j * N;
      let s = 0;
      for (let q = 0; q < N; q++) s += D[oi + q] * D[oj + q];
      if (abs(s) > 0.94 && use[i] < use[j] && idle[i] >= 0 && eta > 0.002) {
        reseed(P, i);
        break;
      }
    }
  }

  // What is drawn eases toward the atoms, so a fast learner shimmers and does not flicker.
  const { disp, dmax } = P;
  const ea = 1 - exp(-d / 0.12);
  for (let j = 0; j < K; j++) {
    const o = j * N;
    let m = 0;
    for (let i = 0; i < N; i++) {
      const v = (disp[o + i] += ea * (D[o + i] - disp[o + i]));
      const av = v < 0 ? -v : v;
      if (av > m) m = av;
    }
    dmax[j] += ea * (m - dmax[j]);
  }
}

export function draw(display, params) {
  const P = params;
  const { disp, dmax, glow, gsign, pos, neg } = P;
  if (!P.ready) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
    return;
  }
  // The gaps between tiles carry the halo of the tiles on either side of them.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const tx = x >> 3, ty = y >> 3, ox = x & 7, oy = y & 7;
      const j = ty * NCOL + tx;
      if (ox < 7 && oy < 7) {
        const o = j * N + oy * S + ox;
        const sc = 1 / (0.72 * (dmax[j] > 0.12 ? dmax[j] : 0.12));
        const u = disp[o] * sc;
        const au = u < 0 ? -u : u;
        let b = (au - 0.1) / 0.9;
        if (b <= 0) {
          display.setPixel(x, y, 0, 0, 0);
          continue;
        }
        if (b > 1) b = 1;
        const f = IDLE + (1 - IDLE) * glow[j];
        const lut = u > 0 ? pos : neg;
        const li = ((b * 255) | 0) * 3;
        display.setPixel(x, y, lut[li] * f, lut[li + 1] * f, lut[li + 2] * f);
      } else {
        // Gap pixel: the brightest glow of the tiles that touch it.
        const j0 = j, hasR = ox === 7 && tx + 1 < NCOL, hasB = oy === 7 && ty + 1 < NROW;
        let hv = glow[j0], sg = gsign[j0];
        if (hasR && glow[j0 + 1] > hv) {
          hv = glow[j0 + 1];
          sg = gsign[j0 + 1];
        }
        if (hasB && glow[j0 + NCOL] > hv) {
          hv = glow[j0 + NCOL];
          sg = gsign[j0 + NCOL];
        }
        if (hasR && hasB && glow[j0 + NCOL + 1] > hv) {
          hv = glow[j0 + NCOL + 1];
          sg = gsign[j0 + NCOL + 1];
        }
        const lut = sg > 0 ? pos : neg;
        const li = ((cl(hv * hv * 0.8, 0, 1) * 255) | 0) * 3;
        display.setPixel(x, y, lut[li], lut[li + 1], lut[li + 2]);
      }
    }
}
