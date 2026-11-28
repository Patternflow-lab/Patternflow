// ===== Patternflow pattern =====
// Title:   Limiting Similarity
// Family:  nichepacking
// Idea:    Sixty-four species compete along one resource axis until they stand in evenly spaced clusters, drawn as glowing bands that run down the panel as time with today's population profile as a ridge on top, while a wandering resource curve makes the bands drift, split and merge and immigrants take root in the gaps that a faint blue ground marks.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: limiting similarity, the least spacing at which competing species can share a resource axis (Robert MacArthur and Richard Levins, 1967, from memory), self-organized similarity of competitors in a Lotka-Volterra community fed by immigrants (Marten Scheffer and Egbert van Nes, 2006, from memory), species clustering with a super-Gaussian competition kernel (Simone Pigolotti, Cristobal Lopez and Emilio Hernandez-Garcia, 2007, from memory), original code, pattern round 277
// Round:   277
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Overlap=0..4, Drift=-1..1, Invaders=-1..1
//
// Knob 1: Hue. Turns the whole spectrum round the wheel. A species i has the hue 0.46 + 0.40 x i / 63 + K, so at 0 the axis runs from teal on the left through blue and violet to magenta on the right, at 0.5 from rose through gold to green, and at 1 it is back. The blue ground does not move. The bands already scrolled down turn with it.
// Knob 2: Overlap. The width w of the competition kernel, in species: w = 6 + 1.2 K, 6 at 0, 8.4 at 2 where it opens, 10.8 at 4. Neighbours closer than about w compete as if they were one species, so the clusters stand about 1.4 w apart. Over 900 s at the opening the median count was 5 bands (3 to 7) with 12 columns between neighbours; at 0 it was 7 (3 to 9) and 8 apart, at 4 it was 4 (1 to 6) and 15 apart. Turning it up merges bands within a few seconds, turning it down splits them over about ten. The blue ground and the width of the blur follow at once.
// Knob 3: Drift. How far and how fast the resource curve wanders, -1 to 1, opening at 0. With s = (K + 1) / 2 the centre of the hump swings by 4 + 24 s^0.8 columns (4, 17.8, 28) on clocks of 83 and 37 s that run 0.55 + 2.2 s^2 times real time (0.55, 1.1, 2.75), and the ripples in the curve grow from 0.55 to 1.05 in log resource. At -1 the bands nearly stand: the mean centre moved 0.06 column a second and a band came or went 2.3 times a minute. At the opening 0.10 and 4.0, at 1 the bands are chased about and 0.13 and 7.9.
// Knob 4: Invaders. How often a stranger lands and how often the axis is swept. An immigrant lands on a random species at 0.45 x 4^K a second, 0.11 at -1, 0.49 at 0.06 where it opens, 1.8 at 1, and a disturbance clears 7 to 19 species at 0.02 x 4^K a second, once in 200 s at -1, in 46 s at the opening, in 14 s at 1. At the opening one stranger in ten took root, at -1 almost none (80 landed in 900 s, one grew), at 1 one in four. A swept stretch was back to 80 percent of its brightness 3.6 to 4.6 s later in ten trials of twelve, from the rim that survived and the strangers that land in it.
//
// What the picture is. A species axis across the panel, one column to a species, 64 of them, and time down it. The top 30 rows are the population now: a ridge whose height is the log of each species' count. Under it each row is a moment, newest at the top and 0.25 s to a row, so the 98 rows below are 24 s of history, scrolling smoothly and dimming to 40 percent at the bottom. Brightness is the log of the count from 0.003 to 1.5, the top of the hump being about 1. The hue belongs to the species. Nothing is a label: no axis, no figure.
// The model. N_i is the count of species i at trait x_i = i. dN_i/dt = r N_i (1 - sum_j a(x_i - x_j) N_j / K(x_i)), integrated as N_i x exp(r f_i dt) so that it stays positive, 3 model time units to a real second. The kernel is a(d) = exp(-(|d| / w)^4), the super-Gaussian of Pigolotti and company, whose Fourier transform goes negative, so that a uniform community is unstable and a lumpy one stands. A Gaussian kernel was run beside it with the resource held to a plain hump: the Gaussian settles into one smooth hill with no gaps, the fourth power into six bands 12 columns apart and as still as a comb. Below 0.0001 a species is gone. 80 s are run before the first frame, so the clusters are already up and 24 s of past are already scrolled.
// The resource. K(x) = 0.05 + A exp(-(x - x0)^2 / 2 sK^2 + b eta(x)), a broad hump with sK of 22 +- 7.5 columns, its height wobbling by 20 percent, its centre x0 wandering, and eta a sum of four sine ripples of 13, 20, 30 and 46 columns whose phases slide to and fro by up to 14 columns, on clocks from 43 to 113 s that share no factor, so the environment does not come round again. The ripples are the addition to the model. With a smooth hump alone the clusters lock into a lattice that does not move (0.3 bands came or went a minute); the ripples are what let the bands drift, split and merge. They also bias where a band stands, so the clusters are not pure self-organisation, and a Gaussian kernel with the ripples at this strength makes bands too.
// The gaps. f_i = 1 - sum_j a(x_i - x_j) N_j / K(x_i) is the growth rate a stranger of species i would have, and it is the same number the integration uses. Where it is above 0 an immigrant can take root. It is painted as a cold blue ground, 0 below f = -0.8 and 46 of 255 in blue where f reaches 0, smoothed over 3 columns, and each row keeps its own, so the history carries where the gaps were. About a third of the species are above 0 at any moment, mostly the edges of bands that are still growing, which sit under the light; in the gaps between two settled bands f is about -0.1 to -0.35.
// The disturbance. Now and then a stretch of 7 to 19 species, centred anywhere, has its counts multiplied by exp(-(1 + 12 (1 - u^2))) over 1.3 s, u being the distance from its middle in half widths: a factor of 3 at the edge, and in the middle the counts fall under 0.0001 and the species are gone. A band ends in a steep taper, not a cut. What is left, and what strangers land, grows back along the f of the moment.
// What is exact and what is drawn. The competition, the integration, the immigration, the disturbance and f are the model. The ripples, the 3 times model clock, the log scale, the 1.35 to 1.8 column blur of the counts before they are logged (sigma 0.75 + 0.1 w, so a one-species cluster is a soft band and not one lit column), the ridge, the fade with age and the colours are drawing choices. The hump's floor of 0.05 keeps the edges lit at about half brightness and is not in the papers.

const W = 64, H = 128, M = 64, PH = 30, NR = 108;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const STEP = 0.05;      // real seconds per integration step
const ROW = 0.25;       // real seconds per row of history
const SPEED = 3;        // model time per real second
const NLO = 3e-3;       // population that reads as black
const NHI = 1.5;        // and as full light
const EXT = 1e-4;       // below this a species is gone
const KFL = 0.05;       // resource that is left far from the hump
const PRE = 80;         // seconds run before the first frame
const PERIOD = [83, 37, 61, 53, 97, 89, 47, 71, 43, 113, 67, 59, 101];
const LAM = [13, 20, 30, 46];                 // wavelengths of the ripples in the resource, LEDs
const CAM = [0.5, 0.45, 0.4, 0.35];           // their weights
const SLIDE = [[8, 5], [7, 4.5], [9, 5.5], [6, 4]]; // how far each one slides to and fro, LEDs
const KK = LAM.map((l) => TAU / l);

const GK = new Float64Array(9);

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 16; i++) ph.push(TAU * Math.random());
  const mk = () => { const a = []; for (let r = 0; r < NR; r++) a.push(new Float32Array(M)); return a; };
  const N = new Float64Array(M);
  for (let i = 0; i < M; i++) N[i] = 0.15 + 0.4 * Math.random();
  params.s = {
    ph, N, K: new Float64Array(M), F: new Float64Array(M), tab: new Float64Array(M), wB: -1,
    th: PERIOD.map((_, i) => ph[i]), ps: new Float64Array(4), dc: 0, dh: 0, dl: 0, acc: 0, rowAcc: 0, k: null, head: 0,
    hd: mk(), hf: mk(), ld: new Float32Array(M), lf: new Float32Array(M), tmp: new Float64Array(M + 8),
  };
}

function rowOf(S, dv, fp) {
  const { N, F, tmp } = S;
  const sg = 0.75 + 0.1 * S.wB;
  for (let k = -4; k <= 4; k++) GK[k + 4] = exp(-(k * k) / (2 * sg * sg));
  for (let i = 0; i < M; i++) {
    let s = 0;
    for (let k = -4; k <= 4; k++) {
      const j = i + k;
      if (j >= 0 && j < M) s += GK[k + 4] * N[j];
    }
    dv[i] = s <= 0 ? 0 : cl(log(s / NLO) / log(NHI / NLO), 0, 1);
    tmp[i + 4] = sm(-0.8, 0, F[i]);
  }
  tmp[3] = tmp[4]; tmp[M + 4] = tmp[M + 3];
  for (let i = 0; i < M; i++) fp[i] = 0.25 * tmp[i + 3] + 0.5 * tmp[i + 4] + 0.25 * tmp[i + 5];
}

function simStep(S) {
  const k = S.k, N = S.N, K = S.K, F = S.F, tab = S.tab, th = S.th;
  const w = 6 + 1.2 * cl(k[1], 0, 4);
  if (abs(w - S.wB) > 0.005) {
    S.wB = w;
    for (let d = 0; d < M; d++) { const q = d / w; tab[d] = exp(-(q * q) * (q * q)); }
  }
  const s01 = (cl(k[2], -1, 1) + 1) / 2;
  const v = 0.55 + 2.2 * s01 * s01, A = 4 + 24 * pow(s01, 0.8);
  for (let i = 0; i < PERIOD.length; i++) th[i] += (TAU * STEP * v) / PERIOD[i];
  const x0 = 32 + A * (0.6 * sin(th[0]) + 0.4 * sin(th[1]));
  const sK = 22 + 5 * sin(th[2]) + 2.5 * sin(th[3]);
  const amp = 1 + 0.2 * sin(th[4]);
  const is = 0.5 / (sK * sK);
  const rb = 0.55 + 0.5 * s01;
  const ps = S.ps;
  for (let m = 0; m < 4; m++) ps[m] = S.ph[8 + m] + KK[m] * (SLIDE[m][0] * sin(th[5 + 2 * m]) + SLIDE[m][1] * sin(th[6 + 2 * m]));
  for (let i = 0; i < M; i++) {
    const q = i - 32;
    let eta = 0;
    for (let m = 0; m < 4; m++) eta += CAM[m] * sin(KK[m] * q + ps[m]);
    K[i] = KFL + amp * exp(-(i - x0) * (i - x0) * is + rb * eta);
  }
  const g = STEP * SPEED;
  for (let i = 0; i < M; i++) {
    let s = 0;
    for (let j = 0; j < M; j++) s += tab[i > j ? i - j : j - i] * N[j];
    const f = 1 - s / K[i];
    F[i] = f;
    let n = N[i] * exp(g * (f < -2.5 ? -2.5 : f));
    if (n < EXT) n = 0;
    N[i] = n;
  }
  const kv = cl(k[3], -1, 1);
  const lam = 0.45 * pow(4, kv), mu = 0.02 * pow(4, kv);
  if (Math.random() < lam * STEP) {
    const i = floor(Math.random() * M);
    if (N[i] < 6e-3) N[i] = 6e-3;
  }
  if (S.dl <= 0 && Math.random() < mu * STEP) {
    S.dc = Math.random() * M; S.dh = 3.5 + 6 * Math.random(); S.dl = 1.3;
  }
  if (S.dl > 0) {
    // a disturbance sweeps a stretch of the axis clean over a second or so, hardest at its middle
    S.dl -= STEP;
    for (let i = 0; i < M; i++) {
      const u = abs(i - S.dc) / S.dh;
      if (u < 1) { const sh = 1 - u * u; N[i] *= exp(-(STEP / 1.3) * (1 + 12 * sh)); }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  let first = false;
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    first = true;
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.acc += first ? PRE : d;
  while (S.acc >= STEP) {
    S.acc -= STEP;
    simStep(S);
    S.rowAcc += STEP;
    if (S.rowAcc >= ROW) {
      S.rowAcc -= ROW;
      S.head = (S.head + 1) % NR;
      rowOf(S, S.hd[S.head], S.hf[S.head]);
    }
  }
  rowOf(S, S.ld, S.lf);
}

const C = [0, 0, 0];
const HG = new Float32Array(M + 2);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const hue = S.k[0];
  const phase = S.rowAcc / ROW;
  const ld = S.ld, lf = S.lf;
  for (let x = 0; x < M; x++) HG[x + 1] = (PH - 0.5) * pow(ld[x], 1.5);
  HG[0] = HG[1]; HG[M + 1] = HG[M];

  for (let y = 0; y < H; y++) {
    const hist = y >= PH, yb = PH - 1 - y;
    let a = 0, b = 0, fr = 0;
    if (hist) {
      const yy = y - PH;
      if (yy < phase) { fr = yy / phase; a = -1; }
      else { const q = yy - phase, i = floor(q); fr = q - i; a = i; b = i + 1; }
    }
    const ageF = hist ? 1 - 0.6 * pow((y - PH) / (H - PH), 0.9) : 1;
    const ia = hist && a >= 0 ? (S.head - a + NR * 2) % NR : 0, ib = hist && a >= 0 ? (S.head - b + NR * 2) % NR : 0;
    for (let x = 0; x < W; x++) {
      let dv, fp, v;
      if (!hist) {
        dv = ld[x]; fp = lf[x];
        const hl = 0.5 * (HG[x] + HG[x + 1]), hc = HG[x + 1], hr = 0.5 * (HG[x + 1] + HG[x + 2]);
        const lo = min(hl, hc, hr), hi = max(hl, hc, hr);
        const ins = cl(hi - yb, 0, 1) * min(1, 0.4 + 0.3 * (1 - yb / PH) + 0.55 * exp(-max(0, lo - yb - 1) / 1.8));
        const gap = yb > hi ? yb - hi : 0;
        const glow = 0.45 * exp(-gap / 1.5) * sm(0.04, 0.2, dv) * (1 - cl(hi - yb, 0, 1));
        v = max(ins, glow);
      } else if (a < 0) {
        const h0 = S.hd[S.head], g0 = S.hf[S.head];
        dv = ld[x] + (h0[x] - ld[x]) * fr; fp = lf[x] + (g0[x] - lf[x]) * fr;
        v = pow(dv, 1.05) * ageF * 0.95;
      } else {
        const ra = S.hd[ia], rb = S.hd[ib], fa = S.hf[ia], fb = S.hf[ib];
        dv = ra[x] + (rb[x] - ra[x]) * fr; fp = fa[x] + (fb[x] - fa[x]) * fr;
        v = pow(dv, 1.05) * ageF * 0.95;
      }
      hsv(0.46 + 0.4 * (x / (M - 1)) + hue, 0.92 - 0.5 * dv * dv * dv, v, C);
      const o = 255 * 0.18 * fp * (hist ? 0.6 + 0.4 * ageF : 1);
      const r = 255 * C[0] + o * 0.28, g = 255 * C[1] + o * 0.5, bl = 255 * C[2] + o;
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, bl > 255 ? 255 : bl | 0);
    }
  }
}
