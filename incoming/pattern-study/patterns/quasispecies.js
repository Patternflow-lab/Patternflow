// ===== Patternflow pattern =====
// Title:   Quasispecies
// Family:  quasispecies
// Idea:    Eigen's quasispecies equation solved for all 2,048 genomes of 11 bits, one to a 2 by 2 block of the panel through a Gray-code map, so a master sequence and its mutants glow as a self-similar cross of halos that melts into a flat haze when the mutation rate passes the error threshold, takes a one-bit step every few seconds and every half minute or so leaves for a genome far across the hypercube, where its cloud has to grow out of nothing.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the quasispecies equation and its error threshold (Manfred Eigen, 1971), the reflected binary Gray code (Frank Gray, 1953), Hamming distance (Richard Hamming, 1950), all from memory. The map of the 11-cube onto the panel, the walking peak, the jumps and the colours are original, pattern round 270.
// Round:   270
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Mutation=0..4, Selection=-1..1, Peaks=1..7
//
// Knob 1: Hue. Where the palette starts: the master is amber-white at 0 with the halos turning through red and magenta to indigo as they get further from it, green at 0.25, blue at 0.5 and violet at 0.75, while the ground behind stays in the blues (teal to magenta). The palette also creeps on by 0.0012 of a turn a second, once round in about fourteen minutes, so the knob sets where it is and not where it stays.
// Knob 2: Mutation. The mutation rate, as the mean number of bit flips per genome per generation, mu times 11: 0.25 at 0, 0.5 at 1, 1.0 where it opens, 2.0 at 3 and 4.0 at 4. The rate breathes round that setting by up to two octaves either way, on periods of 53, 22 and 9 s, so it spends 80 percent of its time within 0.45 to 2.3 times the setting. With selection at 10 the error threshold sits at 2.2: below it a crisp cross of 1-, 2- and 3-flip halos, near it a woven mesh over the whole panel, above it the cloud melts to a violet haze with a faint warm imprint of the master. Where it opens, over 900 s, the haze is full for 6 percent of the time and the cloud is more than half melted for 12 percent.
// Knob 3: Selection. How much fitter the master is than every other genome, sigma = 10 times 6 to the power of the knob: 1.7 at -1, 4.1 at -0.5, 10 at 0, 24 at 0.5 and 60 at 1. The error threshold moves with it, measured at mu L = 0.59, 1.47, 2.2, 2.8 and 3.4, so a high value keeps a sharp cross standing through mutation rates that melt a low one, and at -1 the opening mutation rate is already past the threshold and the panel is mostly haze.
// Knob 4: Peaks. How many peaks the landscape has, 1 to 7. Each extra peak sits 3 to 9 flips from the others and carries its own cross of halos in the same palette. Their heights agree to within 6 percent before the dips, and each dips by 10 to 18 percent on a period of its own, 37 to 97 s, so which cloud holds the most population trades places over a minute or two. At 1 the panel holds one lattice, at 4 four crosses overlap into a mesh, and at 7 it is a dense field of cores.
//
// What the picture is. Every one of the 2^11 = 2,048 bit strings of length 11 has a place on the panel, a 2 by 2 block, 32 blocks across and 64 down. The five high bits give the column, as the Gray code of the column index, and the six low bits give the row the same way, so one block to the left or right, one up or down, is exactly one bit flipped. A block is lit by how much population its genome holds, on a log scale: white where the master is, then the 11 genomes one flip away along its row and column, the 55 two flips away, and so on, each ring about a decade fainter, until the dark ground. Because a Gray code folds back on itself the rings are not rings: the genomes of one ring lie along the master's row and column and in the rectangles those span, over the whole panel, and together they draw a lattice of crosses with the master at the heart of the brightest.
// What moves. Every few seconds the peak takes one step, one bit of the master flips, and the glow hands over to a neighbour, so the whole lattice re-centres on a block that was a first halo a moment ago. About every 26 s the peak leaves for a genome 3 to 9 flips away, the furthest on the panel from the last six places it sat. The old cloud has nothing to hold it and spreads over the flat landscape while the new peak, fed by the far tails of that spread, grows out of a population of a few parts in 100,000: the lattice smears into a mesh, then the new cross condenses, usually in 1 to 6 s and in 20 s or more if the mutation rate is near the threshold at that moment. The mutation rate breathes, which swells and shrinks every halo.
// The model. Population x on all 2^11 genomes, one generation of Eigen's equation being x'_i = sum_j Q_ij f_j x_j / phi, with phi = sum f_j x_j the mean fitness, f = sigma at a peak and 1 everywhere else, and Q_ij = (1 - mu)^(11 - d) mu^d for Hamming distance d. Q is a tensor product of eleven 2 by 2 matrices, [[1 - mu, mu], [mu, 1 - mu]], one per bit, so it is applied in eleven butterfly passes over the array, about 45,000 multiply-adds a step, no sampling and no noise. A frame advances x by a fraction a = 1.2 dt of a generation, x <- (1 - a) x + a Q f x / phi, the continuous-time form of the same equation, so its fixed points are the equation's own. x is renormalised and floored at 1e-30 every step. Before the first frame 160 steps of half a generation, 80 generations, are run at the knobs as found.
// What is exact and what is not. The equation, the single-peak landscape on a flat plateau and the error threshold near mu L = ln sigma are Eigen's. At L = 11 the threshold is a steep crossover and not a step: the master's share of the population falls from 24 percent at mu L = 1.1 to 0.13 percent at 2.5 with sigma 10, and the measured crossing (master at 10 times its uniform share) is mu L = 2.2 against ln 10 = 2.3, and 3.4 against ln 60 = 4.1 at the top of the knob. The breathing, the one-bit steps, the jumps and the dips of the extra peaks are chosen for the picture. In the haze the colours are drawn against the population's own range, because the log of a population that has gone nearly flat has nothing in it to read, so the brightness there says where the master's imprint is and not how much of the population it holds. A real quasispecies is a population of finite size that wanders by chance; this is its mean-field limit, which is why the picture is smooth and the same numbers always give the same picture.

const W = 64, H = 128;
const L = 11, N = 1 << L, CB = 5, RB = 6, CW = 1 << CB, CH = 1 << RB;
const MAXP = 7;
// RATE generations a second; BA octaves of mutation breathing; the peak steps every HOP0 to HOP0 + HOP1 s; the palette creeps DRIFT of a turn a second
const RATE = 1.2, BA = 2, HOP0 = 1.8, HOP1 = 3.2, DRIFT = 0.0012;
const { floor, min, max, abs, log, exp, pow, sin, PI, LN10 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const gray = (v) => v ^ (v >> 1);

// cell (c, r) -> genome: the column index is the Gray code of the high 5 bits, the row index the Gray code of the low 6
const CELLG = new Int32Array(CW * CH);
for (let r = 0; r < CH; r++) for (let c = 0; c < CW; c++) CELLG[r * CW + c] = (gray(c) << RB) | gray(r);
const IGR = (v) => { let r = v; for (let s = v >> 1; s; s >>= 1) r ^= s; return r; };
// genome -> its cell, for the screen distance between two genomes
const GCX = new Uint8Array(N), GCY = new Uint8Array(N);
for (let g = 0; g < N; g++) { GCX[g] = IGR(g >> RB); GCY[g] = IGR(g & (CH - 1)); }
const PC = new Uint8Array(N);
for (let i = 1; i < N; i++) PC[i] = PC[i >> 1] + (i & 1);
// how much less one more flip is worth when deciding which peak a genome belongs to, for colour only
const SHELL = new Float64Array(L + 1);
for (let d = 0; d <= L; d++) SHELL[d] = pow(0.15, d);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// where the next peak goes: 3 to 9 flips from every live peak, and of 24 tries the one furthest on the panel from the last six places a peak sat
function pickSite(S) {
  let best = 0, bs = -1;
  for (let tries = 0; tries < 24; tries++) {
    const g = floor(Math.random() * N);
    let dm = 99;
    for (let p = 0; p < MAXP; p++) if (S.pm[p] >= 0) dm = min(dm, PC[g ^ S.pm[p]]);
    if (dm < 3 || dm > 9) continue;
    let sc = 99;
    for (let q = 0; q < S.hist.length; q++) {
      const dx = abs(GCX[g] - GCX[S.hist[q]]), dy = abs(GCY[g] - GCY[S.hist[q]]);
      const ex = min(dx, CW - dx) / CW, ey = min(dy, CH - dy) / CH;
      sc = min(sc, ex * ex + ey * ey);
    }
    if (sc > bs) { bs = sc; best = g; }
  }
  S.hist.push(best);
  if (S.hist.length > 6) S.hist.shift();
  return best;
}

// One step of Eigen's equation, a of a generation: fitness, mutation by eleven butterfly passes, selection by the mean fitness
function step(S, mu, a) {
  const { x, z, f } = S;
  f.fill(1);
  for (let p = 0; p < MAXP; p++) if (S.pm[p] >= 0) f[S.pm[p]] = 1 + (S.sigma - 1) * S.ph[p];
  let phi = 0;
  for (let i = 0; i < N; i++) {
    z[i] = f[i] * x[i];
    phi += z[i];
  }
  const m1 = 1 - mu;
  for (let h = 1; h < N; h <<= 1)
    for (let i0 = 0; i0 < N; i0 += 2 * h)
      for (let i = i0; i < i0 + h; i++) {
        const p = z[i], q = z[i + h];
        z[i] = m1 * p + mu * q;
        z[i + h] = mu * p + m1 * q;
      }
  const ia = a / phi, ib = 1 - a;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    let v = ib * x[i] + ia * z[i];
    if (v < 1e-30) v = 1e-30;
    x[i] = v;
    sum += v;
  }
  const inv = 1 / sum;
  for (let i = 0; i < N; i++) x[i] *= inv;
}

// the mutation rate's breathing, in octaves, three sines whose periods (53.1, 21.7 and 9.37 s) share no ratio of small whole numbers
const breath = (t) => 0.5 * sin(TAU * (t / 53.1) + 0.9) + 0.32 * sin(TAU * (t / 21.7) + 2.1) + 0.2 * sin(TAU * (t / 9.37) + 4.0);

// each peak's height dips on a period of its own, and the peaks after the first sit a hair below it
const PERIOD = [61, 43, 79, 53, 97, 37, 71];
const BASE = [1, 0.99, 0.98, 0.97, 0.96, 0.95, 0.94];

export function setup(params) {
  const S = {
    x: new Float64Array(N).fill(1 / N), z: new Float64Array(N), f: new Float64Array(N),
    lum: new Float32Array(N), db: new Float32Array(N), tt: new Float32Array(N), col: new Float32Array(N * 3),
    pm: new Int32Array(MAXP).fill(-1), ph: new Float64Array(MAXP), pphase: new Float64Array(MAXP), pamp: new Float64Array(MAXP),
    hist: [], old: [], hd: 0, nh: new Float64Array(MAXP), last: new Int32Array(MAXP).fill(-1), t: 0, nextJump: 0, sigma: 10, mL0: 1, nExtra: 0, init: false, hue: 0, loc: 1, mL: 1,
  };
  for (let p = 0; p < MAXP; p++) {
    S.pphase[p] = TAU * Math.random();
    S.pamp[p] = p === 0 ? 0.06 : 0.1 + 0.08 * Math.random();
  }
  S.pm[0] = floor(Math.random() * N);
  S.hist.push(S.pm[0]);
  S.nextJump = 14 + 22 * Math.random();
  for (let p = 0; p < MAXP; p++) S.nh[p] = HOP0 + HOP1 * Math.random();
  params.s = S;
}

// a peak's height, 0 to 1 of sigma - 1: its baseline less its dip, scaled in as the Peaks knob reaches it
function target(S, p) {
  const pres = p === 0 ? 1 : cl(S.nExtra - (p - 1), 0, 1);
  return BASE[p] * (1 - S.pamp[p] * (0.5 + 0.5 * sin((TAU * S.t) / PERIOD[p] + S.pphase[p]))) * pres;
}

function jump(S) {
  // the crown moves: usually the peak that holds the most, sometimes another, to a genome far from all of them
  let best = -1, bx = -1, n = 0;
  for (let p = 0; p < MAXP; p++)
    if (S.pm[p] >= 0) {
      n++;
      if (S.x[S.pm[p]] > bx) { bx = S.x[S.pm[p]]; best = p; }
    }
  let pick = best;
  if (n > 1 && Math.random() < 0.3) {
    let r = floor(Math.random() * n);
    for (let p = 0; p < MAXP; p++) if (S.pm[p] >= 0 && r-- === 0) pick = p;
  }
  S.old.push(S.pm[pick]);
  S.pm[pick] = pickSite(S);
  S.ph[pick] = 0;
  S.nextJump = S.t + 14 + 22 * Math.random();
}

// the peak takes one step: a single bit of its genome flips, never the one it flipped last
function hop(S, p) {
  for (let tries = 0; tries < 6; tries++) {
    const b = floor(Math.random() * L);
    if (b === S.last[p]) continue;
    const g = S.pm[p] ^ (1 << b);
    let free = true;
    for (let q = 0; q < MAXP; q++) if (S.pm[q] === g) free = false;
    if (!free) continue;
    S.old.push(S.pm[p]);
    S.pm[p] = g;
    S.last[p] = b;
    break;
  }
  S.nh[p] = S.t + HOP0 + HOP1 * Math.random();
}

// peaks the knob has added are placed, peaks it has taken away are dropped once their height has faded
function present(S) {
  for (let p = 1; p < MAXP; p++) {
    const want = cl(S.nExtra - (p - 1), 0, 1) > 0;
    if (want && S.pm[p] < 0) {
      S.pm[p] = pickSite(S);
      S.ph[p] = 0;
    } else if (!want && S.pm[p] >= 0 && S.ph[p] < 0.02) {
      S.pm[p] = -1;
      S.ph[p] = 0;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.mL0 = 0.25 * pow(16, cl(k[1], 0, 4) / 4);
  S.sigma = 10 * pow(6, cl(k[2], -1, 1));
  S.nExtra = cl(k[3], 1, 7) - 1;
  present(S);
  if (!S.init) {
    S.init = true;
    for (let p = 0; p < MAXP; p++) if (S.pm[p] >= 0) S.ph[p] = 1;
    S.mL = S.mL0 * pow(2, BA * breath(79));
    for (let i = 0; i < 160; i++) step(S, S.mL / L, 0.5);
  }
  S.t += d;
  S.hd += d * DRIFT;
  if (S.t >= S.nextJump) jump(S);
  for (let p = 0; p < MAXP; p++) if (S.pm[p] >= 0 && S.t >= S.nh[p] && S.ph[p] > 0.5) hop(S, p);
  const e = 1 - exp(-d / 0.9);
  for (let p = 0; p < MAXP; p++) if (S.pm[p] >= 0) S.ph[p] += (target(S, p) - S.ph[p]) * e;
  S.mL = S.mL0 * pow(2, BA * breath(S.t + 79));
  step(S, cl(S.mL / L, 0.002, 0.45), min(0.5, RATE * d));
  // how localised the population is: 1 with the top peak standing a thousand times over a uniform spread, 0 when it is lost in it
  let xm = 0;
  for (let i = 0; i < N; i++) xm = max(xm, S.x[i]);
  // places a peak has left stay as colour anchors while the cloud they held is still there
  const keep = [];
  for (let q = S.old.length - 1; q >= 0 && keep.length < 10; q--) if (S.x[S.old[q]] > 2e-5 * xm && keep.indexOf(S.old[q]) < 0) keep.push(S.old[q]);
  S.old = keep;
  S.loc += (sm((log(xm * N) / LN10 - 0.3) / 1.7) - S.loc) * min(1, 6 * d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { x, lum, db, tt } = S, loc = S.loc;
  // brightness is the log of the enrichment over a uniform spread: the master and its halos up to white, the dark ground below it.
  // Once the population has melted into the spread there is nothing to read in the log, so the glow is drawn against its own range
  let mean = 0, top = -99;
  for (let g = 0; g < N; g++) {
    const lr = log(x[g] * N) / LN10;
    lum[g] = lr;
    mean += lr;
    if (lr > top) top = lr;
  }
  mean /= N;
  const rng = max(top - mean, 1e-4);
  for (let g = 0; g < N; g++) {
    const lr = lum[g], t = cl((lr - mean) / rng, -0.5, 1);
    const va = lr >= -1.2 ? 0.14 + 0.86 * pow(min(1, (lr + 1.2) / 4.5), 1.5) : 0.05 + 0.09 * cl((lr + 6.5) / 5.3, 0, 1);
    lum[g] = loc * va + (1 - loc) * (0.24 + 0.36 * t);
    tt[g] = t > 0 ? t : 0;
  }
  // distance to the cloud each genome belongs to, soft over the live peaks
  const anc = S.old.slice();
  for (let p = 0; p < MAXP; p++) if (S.pm[p] >= 0) anc.push(S.pm[p]);
  for (let g = 0; g < N; g++) {
    let sw = 0, sd = 0;
    for (let q = 0; q < anc.length; q++) {
      const m = anc[q], dd = PC[g ^ m], w = x[m] * SHELL[dd];
      sw += w;
      sd += w * dd;
    }
    db[g] = sd / sw;
  }
  // The ground and the glow stay in the blues, 0.54 to 0.86 of the wheel, whatever the hue is; the cloud itself takes the palette, white where the master is and
  // turning from the hue knob's colour through 0.39 of the wheel to indigo with distance. In the glow the cloud's faint imprint
  // gets the warm end of it.
  // the way round the wheel to indigo is the short one, faded through nothing where the two ways are of equal length
  const s0 = S.hue + S.hd + 0.11;
  const gh = 0.7 + 0.16 * sin(TAU * (s0 - 0.11));
  let dl = gh - s0;
  dl -= floor(dl + 0.5);
  dl *= 1 - sm((abs(dl) - 0.475) / 0.025);
  const ca = [0, 0, 0], cb = [0, 0, 0], col = S.col;
  for (let g = 0; g < N; g++) {
    const v = lum[g], dd = min(db[g], 5.2);
    const sat = 0.85 - 0.6 * loc * (1 - sm(dd / 1.4)) - 0.1 * (1 - loc);
    hsv(s0 + (dl * (dd * loc + 1.2 * (1 - loc))) / 5.2, sat, v, ca);
    hsv(gh + 0.03 * tt[g], 0.85, v, cb);
    const n = loc * sm((v - 0.12) / 0.22) + (1 - loc) * 0.9 * sm(tt[g] / 0.6);
    col[g * 3] = (cb[0] + (ca[0] - cb[0]) * n) * 255;
    col[g * 3 + 1] = (cb[1] + (ca[1] - cb[1]) * n) * 255;
    col[g * 3 + 2] = (cb[2] + (ca[2] - cb[2]) * n) * 255;
  }
  for (let y = 0; y < H; y++)
    for (let xx = 0; xx < W; xx++) {
      const g3 = CELLG[(y >> 1) * CW + (xx >> 1)] * 3;
      display.setPixel(xx, y, col[g3], col[g3 + 1], col[g3 + 2]);
    }
}
