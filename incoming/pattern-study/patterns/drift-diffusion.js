// ===== Patternflow pattern =====
// Title:   Drift Diffusion
// Family:  driftdiffusion
// Idea:    Evidence runs across the panel and time runs down it between two glowing walls, and simulated decisions leave one start line at staggered times as bright threads that drift and shake until they strike a wall, flash, and fall into a mirrored pair of reaction-time histograms that build up below as light sediment.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the drift-diffusion model of a two-choice decision (Roger Ratcliff, "A theory of memory retrieval", 1978), the sequential probability ratio test that is the same walk (Abraham Wald, 1945), its neurons (Joshua Gold and Michael Shadlen, 2007), start-point variability (from memory, Laming 1968 and Ratcliff and Rouder 1998); names and years recalled, pattern round 272
// Round:   272
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=-6..6, Caution=-1..1, Bias=-1..1
//
// Knob 1: Hue. Turns the three colours of the picture round the hue circle, one turn over the range. The left wall is cyan at 0, the right wall is violet-pink 0.30 of a turn on from it, and an error, a decision against the stimulus, is gold 0.64 on from it. At 0.3 the walls are violet and orange, at 0.5 red and green, at 0.75 lime and blue.
// Knob 2: Drift. The mean drift v of the evidence, 0.03 evidence units a second for each unit of the knob: -0.18 at -6, 0.06 at the opening 2 and 0.18 at 6. Negative sends the traffic left and positive right: over ten minutes the right wall took 7 percent of the decisions at -6, 52 at 0, 74 at 2 and 95 at 6. A slow wander of up to 0.125 either way rides on it, so at the opening the stimulus changes sign now and then, and at the ends of the range it only leans.
// Knob 3: Caution. The separation a of the walls: 31 LEDs at -1, 42 at the opening 0, 53 at 1 (1.15, 1.55 and 1.95 evidence units), and they breathe by up to 0.12 units on two slow sines. Narrow walls decide fast and wrongly, wide ones slowly and rightly: at the opening drift the mean reaction time goes from 3.6 s to 5.9 s to 8.7 s and the share of errors from 27 percent to 22 to 20. The walls glide to a new setting in a quarter of a second and strike a thread they pass.
// Knob 4: Bias. Where the threads start, as the share of the way across the walls: 18 percent at -1, 52 at the opening 0.06, 82 at 1. At -1 the start line sits 7 LEDs from the left wall, 62 percent of decisions go there, and almost half are errors, fast ones: 2.9 s against 5.8 s for the correct. At 1 it is the same on the right and the mean reaction time falls to 3.1 s.
//
// What the picture is. A decision is a number x that gathers evidence. It starts at z between two absorbing bounds, 0 and a, and goes on by dx = v dt + s dW: a steady push v, the drift, and Gaussian noise of size s. The first time it reaches a bound is the decision and the time it took is the reaction time. The panel runs this model. Evidence is the horizontal axis, the bounds are the two walls, and time is the vertical one, with now on row 99 and the past scrolling up at 7 rows a second. A thread born 5 s ago has its start 35 rows above its head, and a finished one climbs and fades until it leaves the top 15 s after it struck. The bottom band holds the reaction-time histograms.
// The walk. Every thread is a true Euler-Maruyama walk, 60 steps a second, with s = 0.30 evidence units per square root of a second and 27 LEDs to an evidence unit. The drift of a trial is fixed when it is born: the stimulus v (the knob's mean plus a wander of three sines, 53, 86 and 31 s long, that do not divide) and a Gaussian scatter of 0.04 from trial to trial, which makes errors slow. The start is z, from the Bias knob, with a uniform scatter of 7 percent of a, which makes errors fast. A decision is an error when it ends at the wall against the sign of its own drift. The pool keeps 15 to 24 threads in flight as its target, which moves on two sines that do not divide, and releases new ones at random while fewer run (13 to 23 over ten minutes). Trials a second follow from the reaction time: 3 at the opening, 5 at Caution -1, 2 at Caution 1.
// What the theory gives, as a check. With the start in the middle, the chance of the upper wall is 1 / (1 + exp(-v a / s^2)), a logistic in v a / s^2, and the mean reaction time is (a / 2v) tanh(v a / 2 s^2). At the opening mean drift (v = 0.06, a = 1.55) that is 74 percent and 6.1 s; the run gave 74 percent and 5.9 s. Reaction times are skewed to the right, with a tail whose time constant is 2 a^2 / (pi^2 s^2) = 5.4 s: in the sediment the peak sits left of the mean and a long shoulder runs out to the right.
// The walls. Each wall is a line 2 LEDs wide with a halo. Each decision leaves a bead on its wall, in the wall's colour or gold for an error, that climbs the wall with the past and fades over about 9 s, so the walls keep a record of the last 15 s of choices, and the halo outside the wall swells where beads pass. The halos and the wash between the walls lean to the side the stimulus pointed to when each row was the present, so the history of v climbs the panel as light, and a fainter line marks z.
// The threads. A path is kept at 10 samples a second and drawn smoothed with a Gaussian of 0.5 s (3.5 rows), so a thread reads as a ribbon 2 LEDs wide and not as one-LED noise. The head is kept exact by an odd reflection about the last sample, and a struck thread is held on its wall. Colour follows the position: the hue runs from the left wall's across to the right wall's as the thread crosses. Brightness is greatest at the head and falls over about 1.6 s down the thread to a faint floor, and three threads in ten are drawn bold, at three times the light of the rest. A finished thread fades to a third and stays until it leaves the top. An error turns gold half a second after it strikes.
// The sediment. Every decision, once its spark has fallen, is added to a histogram of reaction times in 0.25 s bins, one for each wall, split into correct and error, and all of it forgets with a time constant of 40 s, so it never fills and never freezes. The right wall's histogram rises from the baseline and the left wall's hangs below it, smoothed with a Gaussian of 0.3 s or more. The heights share one scale that follows the highest bar, and the gold cap on a bar is its share of errors. The time axis spans 3.2 times the mean reaction time, 4 to 24 s over the 64 columns, and follows it over about 5 s.
// What is exact and what is not. The walk, the bounds, the first passage, the reaction times, the error rule and the histograms are the model's own. The wander of the stimulus, the breathing of the walls, the pool, the scroll, the smoothing, the sparks and all the light are drawing choices. It opens after a pre-run of 90 s at the knobs in force, so threads, beads and sediment are there already.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

const YH = 99;            // the row of now: the heads of the threads
const SC = 27;            // LEDs to an evidence unit
const SROW = 7;           // rows of past a second
const SN = 0.30;          // noise size s
const VK = 0.18 / 6;      // drift for each unit of the Drift knob
const DTS = 1 / 60;       // Euler-Maruyama step
const DTP = 0.1;          // seconds between stored path samples
const NB = 160, DB = 0.25; // reaction-time bins
const TH = 40;            // forgetting time of the histograms
const FALL = 0.7;         // seconds a spark takes to reach its bin
const YB = 115;           // baseline of the histograms
const HB = 11;            // tallest bar, in rows
const SIGS = 5;           // smoothing of a path, in samples
const KH = 12;            // kernel half width
const KER = new Float32Array(2 * KH + 1);
{
  let s = 0;
  for (let i = -KH; i <= KH; i++) s += (KER[i + KH] = exp(-(i * i) / (2 * SIGS * SIGS)));
  for (let i = 0; i < KER.length; i++) KER[i] /= s;
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the model
export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  params.s = {
    r, t: 0, k: null, a: 1.5, zf: 0.5, lean: 0, gs: null,
    w: [], hits: [], sparks: [],
    hist: new Float32Array(4 * NB),       // [side * 2 + error][bin]
    dens: new Float32Array(4 * W),        // the smoothed histograms, one row of columns for each
    hn: 2, xmax: 10, rate: 3,
    ph: [TAU * r(), TAU * r(), TAU * r(), TAU * r(), TAU * r()],
  };
}

function gauss(S) {
  if (S.gs !== null) {
    const g = S.gs;
    S.gs = null;
    return g;
  }
  const u = max(S.r(), 1e-9), v = S.r(), m = sqrt(-2 * log(u));
  S.gs = m * sin(TAU * v);
  return m * cos(TAU * v);
}

// the stimulus: the knob's mean drift and a slow wander that crosses zero
function stim(S, t) {
  return S.k[1] * VK + 0.06 * sin(0.1187 * t + S.ph[0]) + 0.04 * sin(0.0731 * t + S.ph[1]) + 0.025 * sin(0.2053 * t + S.ph[2]);
}

function birth(S) {
  const a = S.a, hw = a / 2;
  const v = stim(S, S.t) + 0.04 * gauss(S);
  const u0 = cl((S.zf - 0.5) * a + 0.07 * a * (S.r() - 0.5), -0.92 * hw, 0.92 * hw);
  S.w.push({ t0: S.t, u: u0, v, ts: [S.t], us: [u0], ns: S.t + DTP, te: -1, side: 0, err: 0, rt: 0, gain: S.r() < 0.3 ? 1.5 : 0.4 + 0.3 * S.r() });
}

function absorb(S, w, side) {
  const hw = S.a / 2;
  w.u = side ? hw : -hw;
  w.ts.push(S.t);
  w.us.push(w.u);
  w.te = S.t;
  w.side = side;
  w.rt = S.t - w.t0;
  w.err = (side === 1) !== (w.v > 0) ? 1 : 0;
  S.hits.push({ t: S.t, side, err: w.err });
  S.rate += 1 / 6;
  S.sparks.push({ t: S.t, side, err: w.err, rt: w.rt });
}

function step(S, h) {
  S.t += h;
  const hw = S.a / 2, sq = SN * sqrt(h);
  let live = 0;
  for (let i = 0; i < S.w.length; i++) if (S.w[i].te < 0) live++;
  const nT = floor(19.5 + 2.7 * sin(0.173 * S.t + S.ph[3]) + 1.6 * sin(0.411 * S.t + S.ph[4]));
  if (live < nT && S.r() < min(1, (nT - live) * 25 * h)) birth(S);
  for (let i = 0; i < S.w.length; i++) {
    const w = S.w[i];
    if (w.te >= 0) continue;
    w.u += w.v * h + sq * gauss(S);
    if (w.u >= hw) absorb(S, w, 1);
    else if (w.u <= -hw) absorb(S, w, 0);
    else if (S.t >= w.ns) {
      w.ts.push(S.t);
      w.us.push(w.u);
      w.ns += DTP;
    }
  }
}

const TLIFE = (YH + 10) / SROW; // seconds a mark stays on the panel
function advance(S, d, kv) {
  S.rate *= exp(-d / 6);
  const n = max(1, ceil(d / DTS)), h = d / n;
  for (let i = 0; i < n; i++) step(S, h);
    const f = exp(-d / TH), hs = S.hist;
  for (let i = 0; i < hs.length; i++) hs[i] *= f;
  for (let i = S.sparks.length - 1; i >= 0; i--) {
    const sp = S.sparks[i];
    if (S.t >= sp.t + FALL) {
      hs[(sp.side * 2 + sp.err) * NB + min(NB - 1, floor(sp.rt / DB))] += 1;
      S.sparks.splice(i, 1);
    }
  }
  for (let i = S.w.length - 1; i >= 0; i--) {
    const w = S.w[i];
    if (w.te >= 0 && S.t - w.te > TLIFE) S.w.splice(i, 1);
    else {
      // keep only the part of a path that can still be seen
      while (w.ts.length > 2 && S.t - w.ts[1] > TLIFE) {
        w.ts.shift();
        w.us.shift();
      }
    }
  }
  for (let i = S.hits.length - 1; i >= 0; i--) if (S.t - S.hits[i].t > TLIFE) S.hits.splice(i, 1);
  let sn = 0, st = 0;
  for (let q = 0; q < 4; q++) for (let b = 0; b < NB; b++) {
    const c = hs[q * NB + b];
    sn += c;
    st += c * (b + 0.5) * DB;
  }
  if (sn > 3) S.xmax = exp(log(S.xmax) + (log(cl(3.2 * st / sn, 4, 24)) - log(S.xmax)) * (1 - exp(-d / 5)));
    const sig = max(0.3, 1.3 * S.xmax / W);
  let top = 0;
  for (let side = 0; side < 2; side++) {
    for (let c = 0; c < W; c++) {
      const rt = (c + 0.5) / W * S.xmax;
      const lo = max(0, floor((rt - 3 * sig) / DB)), hi = min(NB - 1, ceil((rt + 3 * sig) / DB));
      let a0 = 0, a1 = 0;
      for (let b = lo; b <= hi; b++) {
        const x = (b + 0.5) * DB, kw = exp(-((x - rt) * (x - rt)) / (2 * sig * sig));
        a0 += hs[(side * 2) * NB + b] * kw;
        a1 += hs[(side * 2 + 1) * NB + b] * kw;
      }
      a0 /= sig * 2.5066;
      a1 /= sig * 2.5066;
      S.dens[(side * 2) * W + c] = a0;
      S.dens[(side * 2 + 1) * W + c] = a1;
      top = max(top, a0 + a1);
    }
  }
  S.hn += (max(2, top * 1.05) - S.hn) * (1 - exp(-d / (top * 1.05 > S.hn ? 0.8 : 6)));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const aOf = (k) => 1.55 + 0.4 * cl(k, -1, 1), zOf = (k) => 0.5 + 0.32 * cl(k, -1, 1);
  const aT = (Q) => aOf(Q.k[2]) + 0.07 * sin(0.1337 * Q.t + Q.ph[0] * 2.3) + 0.05 * sin(0.0891 * Q.t + Q.ph[1] * 1.7);
  if (!S.k) {
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    S.zf = zOf(S.k[3]);
    S.lean = cl(stim(S, 0) / (6 * VK), -1, 1);
    for (let i = 0; i < 2700; i++) {
      S.a = aT(S);
      advance(S, 1 / 30);
      S.lean = cl(stim(S, S.t) / (6 * VK), -1, 1);
    }
  }
  const al = 1 - exp(-d / 0.18);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  S.a += (aT(S) - S.a) * (1 - exp(-d / 0.25));
  S.zf += (zOf(S.k[3]) - S.zf) * (1 - exp(-d / 0.25));
  S.lean += (cl(stim(S, S.t) / (6 * VK), -1, 1) - S.lean) * (1 - exp(-d / 0.6));
  // a wall that closes on a thread strikes it
  if (d > 0) {
    advance(S, d);
    const hw = S.a / 2;
    for (let i = 0; i < S.w.length; i++) {
      const w = S.w[i];
      if (w.te < 0 && abs(w.u) >= hw) absorb(S, w, w.u > 0 ? 1 : 0);
    }
  }
}

// ------------------------------------------------------------------ drawing
const FR = new Float32Array(W * H), FG = new Float32Array(W * H), FB = new Float32Array(W * H);
const TR = new Float32Array(W * H), TG = new Float32Array(W * H), TB = new Float32Array(W * H);
const GR = new Float32Array(W * H), GG = new Float32Array(W * H), GB = new Float32Array(W * H);
const CL = [0, 0, 0], CR = [0, 0, 0], CE = [0, 0, 0], CN = [0.72, 0.8, 1.0], CT = [0, 0, 0];

// a colour of hue h and saturation s, lifted where a hue is dark so each has about the same light
function pal(h, s, o) {
  hsv(h, s, 1, o);
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = pow(0.7 / (l + 0.05), 0.8);
  o[0] *= g;
  o[1] *= g;
  o[2] *= g;
}

// a soft round dot about 2 LED across (sigma 0.85), or wider, at (x, y)
function dot(x, y, r, g, b, k) {
  const x0 = floor(x - 0.5) - 1, y0 = floor(y - 0.5) - 1, inv = 1 / (2 * (k || 0.78) * (k || 0.78));
  const nn = k ? ceil(k * 3.2) + 1 : 4;
  for (let j = 0; j < nn; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= H) continue;
    const ey = yy + 0.5 - y;
    for (let i = 0; i < nn; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= W) continue;
      const ex = xx + 0.5 - x, w = exp(-(ex * ex + ey * ey) * inv), p = yy * W + xx;
      FR[p] += r * w;
      FG[p] += g * w;
      FB[p] += b * w;
    }
  }
}

function blur(a, b, st, k) {
  const c = 1 - 2 * k;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const l = x - st >= 0 ? a[row + x - st] : a[row + x], rr = x + st < W ? a[row + x + st] : a[row + x];
      b[row + x] = k * l + c * a[row + x] + k * rr;
    }
  }
  for (let y = 0; y < H; y++) {
    const ya = max(y - st, 0) * W, yb = min(y + st, H - 1) * W, row = y * W;
    for (let x = 0; x < W; x++) a[row + x] = k * b[ya + x] + c * b[row + x] + k * b[yb + x];
  }
}

const WLR = new Float32Array(H * 3), WRR = new Float32Array(H * 3), HYL = new Float32Array(H), HYR = new Float32Array(H), LY = new Float32Array(H), hLw = new Float32Array(W), hRw = new Float32Array(W), TP = new Float32Array(W), WCR = new Float32Array(W), WCG = new Float32Array(W), WCB = new Float32Array(W);
const lnL = new Float32Array(W), lnR = new Float32Array(W), hL = new Float32Array(W), hR = new Float32Array(W), sp = new Float32Array(W);
const PTS = new Float32Array(512), PUS = new Float32Array(512), PSM = new Float32Array(512);

function drawThread(S, w, now, hw, hue) {
  const live = w.te < 0, n0 = w.ts.length;
  let n = 0;
  for (let i = 0; i < n0; i++) {
    PTS[n] = w.ts[i];
    PUS[n] = w.us[i];
    n++;
  }
  if (live) {
    if (now - PTS[n - 1] > 0.02) {
      PTS[n] = now;
      PUS[n] = w.u;
      n++;
    } else {
      PTS[n - 1] = now;
      PUS[n - 1] = w.u;
    }
  }
  if (n < 2) return;
  // smooth: Gaussian over the samples, the head held by an odd reflection, a struck thread held on its wall
  const last = PUS[n - 1];
  for (let i = 0; i < n; i++) {
    const yi = YH - (now - PTS[i]) * SROW;
    if (yi < -10 - 3 * SIGS) {
      PSM[i] = PUS[i];
      continue;
    }
    let acc = 0;
    for (let j = -KH; j <= KH; j++) {
      const idx = i + j;
      let v;
      if (idx < 0) v = PUS[0];
      else if (idx >= n) v = live ? 2 * last - PUS[max(0, 2 * (n - 1) - idx)] : last;
      else v = PUS[idx];
      acc += KER[j + KH] * v;
    }
    PSM[i] = acc;
  }
  const tHead = live ? now : w.te;
  const fa = live ? 1 : 0.3 + 0.7 * exp(-(now - w.te) / 3.2);
  const gold = !live && w.err ? 0.65 * sm((now - w.te) / 0.5) : 0;
  let px = 0, py = 0, pr = 0, pg = 0, pb = 0, pbr = 0, has = false;
  for (let i = 0; i < n; i++) {
    const y = YH - (now - PTS[i]) * SROW, x = 32 + PSM[i] * SC;
    const f = cl(PSM[i] / hw, -1, 1);
    pal(hue + 0.3 * (0.5 + 0.5 * f), 0.62 + 0.14 * abs(f), CT);
    let r = CT[0], g = CT[1], b = CT[2];
    r += (CE[0] - r) * gold;
    g += (CE[1] - g) * gold;
    b += (CE[2] - b) * gold;
    const br = (0.08 + 0.92 * exp(-(tHead - PTS[i]) / 1.6)) * w.gain * fa * sm((y + 4) / 14);
    if (has && y > -6) {
      const L = sqrt((x - px) * (x - px) + (y - py) * (y - py)), m2 = max(1, ceil(L / 0.6));
      for (let t = 0; t < m2; t++) {
        const q = (t + 0.5) / m2, k = 0.36 * (L / m2) * (pbr + (br - pbr) * q);
        dot(px + (x - px) * q, py + (y - py) * q, (pr + (r - pr) * q) * k, (pg + (g - pg) * q) * k, (pb + (b - pb) * q) * k);
      }
    }
    px = x;
    py = y;
    pr = r;
    pg = g;
    pb = b;
    pbr = br;
    has = true;
  }
  if (live) dot(px, YH, pr * 0.8 + 0.2, pg * 0.8 + 0.2, pb * 0.8 + 0.2, 0.9);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const now = S.t, hue = 0.5 + S.k[0];
  pal(hue, 0.78, CL);
  pal(hue + 0.3, 0.72, CR);
  pal(hue + 0.64, 0.5, CE);
  const hw = S.a / 2, xl = 32 - hw * SC, xr = 32 + hw * SC, xz = 32 + (S.zf - 0.5) * S.a * SC;
  FR.fill(0);
  FG.fill(0);
  FB.fill(0);

  // ---- threads
  for (let i = 0; i < S.w.length; i++) drawThread(S, S.w[i], now, hw, hue);

  // ---- the beads on the walls, one set for each, and the flashes
  HYL.fill(1);
  HYR.fill(1);
  for (let y = 0; y < H; y++) {
    const e = y <= YH + 1 ? 1 : exp(-(y - YH - 1) / 2);
    for (let c = 0; c < 3; c++) {
      WLR[y * 3 + c] = 0.5 * CL[c] * e;
      WRR[y * 3 + c] = 0.5 * CR[c] * e;
    }
  }
  for (let i = 0; i < S.hits.length; i++) {
    const hi = S.hits[i], age = now - hi.t, yc = YH - age * SROW, C = hi.err ? CE : hi.side ? CR : CL, A = hi.side ? WRR : WLR;
    const amp = (hi.err ? 1.5 : 1.15) * exp(-age / 9) * sm((yc + 4) / 14);
    const y0 = max(0, floor(yc - 7)), y1 = min(H - 1, ceil(yc + 7)), HY = hi.side ? HYR : HYL;
    for (let y = max(0, floor(yc - 14)); y <= min(H - 1, ceil(yc + 14)); y++) HY[y] += 0.55 * exp(-age / 10) * exp(-((y - yc) * (y - yc)) / 60) * sm((yc + 4) / 14);
    for (let y = y0; y <= y1; y++) {
      const e = (y + 0.5 - yc) / 2.1, wv = amp * exp(-e * e / 2);
      for (let c = 0; c < 3; c++) A[y * 3 + c] += C[c] * wv;
    }
    if (age < 0.6) {
      const k = (hi.err ? 2.3 : 1.7) * exp(-age / 0.17) * 5 / (5 + S.rate), xw = hi.side ? xr : xl;
      const r = hi.err ? 1.1 : 0.7;
      dot(xw, yc, (C[0] + 0.25) * k, (C[1] + 0.25) * k, (C[2] + 0.25) * k, (hi.err ? 2.6 : 2.0) + age * 3);
      if (hi.err) dot(xw, yc, r * k, r * k, r * k, 1.2);
    }
  }

  // ---- the sediment: two histograms mirrored about a baseline, and the sparks that fall into them
  for (let side = 0; side < 2; side++) {
    const C = side ? CR : CL, dir = side ? -1 : 1;
    for (let c = 0; c < W; c++) {
      const dc = S.dens[(side * 2) * W + c], de = S.dens[(side * 2 + 1) * W + c];
      const tot = dc + de, hh = HB * min(1.1, tot / S.hn);
      if (hh < 0.04) continue;
      const eShare = de / max(tot, 1e-6), cut = hh * (1 - eShare);
      const nr = ceil(hh);
      for (let i = 0; i < nr; i++) {
        const cov = cl(hh - i, 0, 1), y = YB + dir * (1 + i), cap = cov < 1 || i === nr - 1 ? 1 : 0;
        const CC = i + 0.5 > cut ? CE : C;
        const val = cov * (0.34 + 0.1 * (1 - i / HB) + 0.55 * cap);
        const p = y * W + c;
        if (y < 0 || y >= H) continue;
        FR[p] += CC[0] * val;
        FG[p] += CC[1] * val;
        FB[p] += CC[2] * val;
      }
    }
  }
  for (let c = 0; c < W; c++) {
    const p = YB * W + c;
    FR[p] += CN[0] * 0.1;
    FG[p] += CN[1] * 0.1;
    FB[p] += CN[2] * 0.12;
  }
  for (let i = 0; i < S.sparks.length; i++) {
    const sp = S.sparks[i], tau = cl((now - sp.t) / FALL, 0, 1);
    const C = sp.err ? CE : sp.side ? CR : CL;
    const xw = sp.side ? xr : xl, xt = min(W - 1, (sp.rt / S.xmax) * W), yt = YB + (sp.side ? -2 : 2);
    const x = xw + (xt - xw) * sm(tau), y = YH + 1 + (yt - YH - 1) * tau * tau * (3 - 2 * tau) ;
    const k = 0.9 * (1 - 0.5 * tau);
    dot(x, y, (C[0] + 0.3) * k, (C[1] + 0.3) * k, (C[2] + 0.3) * k, 0.9);
  }

  // ---- bloom: the lines are blurred once, a wide copy is added under them
  blur(FR, TR, 1, 0.14);
  blur(FG, TG, 1, 0.14);
  blur(FB, TB, 1, 0.14);
  GR.set(FR);
  GG.set(FG);
  GB.set(FB);
  blur(GR, TR, 2, 0.25);
  blur(GG, TG, 2, 0.25);
  blur(GB, TB, 2, 0.25);
  blur(GR, TR, 4, 0.25);
  blur(GG, TG, 4, 0.25);
  blur(GB, TB, 4, 0.25);

  // ---- per column: the wall lines, their halos, the start line
  // the stimulus as it was when each row was the present, so the wash carries its history up the panel
  for (let y = 0; y < H; y++) LY[y] = cl(stim(S, now - max(0, YH - y) / SROW) / (6 * VK), -1, 1);
  for (let x = 0; x < W; x++) {
    const cx = x + 0.5, dl = cx - xl, dr = cx - xr, dz = cx - xz;
    lnL[x] = exp(-dl * dl / 1.3);
    lnR[x] = exp(-dr * dr / 1.3);
    hL[x] = 0.05 * exp(-dl * dl / 72);
    hR[x] = 0.05 * exp(-dr * dr / 72);
    hLw[x] = 0.05 * exp(-dl * dl / 450);
    hRw[x] = 0.05 * exp(-dr * dr / 450);
    sp[x] = exp(-dz * dz / 2.2);
    // a faint wash between the walls, the hue running across it as it does along a thread
    const t = cl((cx - xl) / (xr - xl), 0, 1);
    TP[x] = 2 * t - 1;
    const inn = sm((cx - xl) / 3) * sm((xr - cx) / 3);
    pal(hue + 0.3 * t, 0.6, CT);
    WCR[x] = CT[0] * 0.05 * inn;
    WCG[x] = CT[1] * 0.05 * inn;
    WCB[x] = CT[2] * 0.05 * inn;
  }

  // ---- compose: ground, wash, walls, then the light, tone mapped
  const G = 1.7;
  for (let y = 0; y < H; y++) {
    const vy = y <= YH + 2 ? 1 : 0.8, ly = LY[y], aL = 0.8 + 0.5 * max(0, -ly) - 0.15 * max(0, ly), aR = 0.8 + 0.5 * max(0, ly) - 0.15 * max(0, -ly);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = 0.012, g = 0.02, b = 0.058;
      const gl = hL[x] * aL * HYL[y] * vy + hLw[x], gr = hR[x] * aR * HYR[y] * vy + hRw[x], ww = (y <= YH + 1 ? 1 : 0.4) * (1 + 0.7 * ly * TP[x]);
      r += gl * CL[0] + gr * CR[0] + WCR[x] * ww;
      g += gl * CL[1] + gr * CR[1] + WCG[x] * ww;
      b += gl * CL[2] + gr * CR[2] + WCB[x] * ww;
      const wl = lnL[x], wr = lnR[x], s0 = sp[x] * 0.05 * (y <= YH + 1 ? 1 : 0);
      r += wl * WLR[y * 3] + wr * WRR[y * 3] + s0 * CN[0];
      g += wl * WLR[y * 3 + 1] + wr * WRR[y * 3 + 1] + s0 * CN[1];
      b += wl * WLR[y * 3 + 2] + wr * WRR[y * 3 + 2] + s0 * CN[2];
      r += FR[p] + 0.1 * GR[p];
      g += FG[p] + 0.1 * GG[p];
      b += FB[p] + 0.1 * GB[p];
      const m = max(r, g, b);
      if (m < 0.004) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const o = 1 - exp(-G * m), f = o / m, wh = 0.4 * o * o * o;
      display.setPixel(x, y, min(255, ((r * f + wh) * 255) | 0), min(255, ((g * f + wh) * 255) | 0), min(255, ((b * f + wh) * 255) | 0));
    }
  }
}
