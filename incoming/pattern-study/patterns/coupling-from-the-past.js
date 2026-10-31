// ===== Patternflow pattern =====
// Title:   Coupling from the Past
// Family:  noise
// Idea:    Two Ising magnets, one started all up on the top half and one all down on the bottom, run forward from time -T to 0 on the same random numbers while the sites where they still disagree glow pink and dissolve; a run that ends with any left starts again from twice as far back, reusing the numbers for its last stretch, and once the two meet the picture at time 0 is an exact sample, which a check run from twice as far back again lands on LED for LED.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: coupling from the past (James Propp and David Wilson, 1996) on the Ising model (Wilhelm Lenz, 1920) with heat-bath updates, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Beta=0.32..0.43, Field=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel. At 0 an up spin is pale ice blue, a down spin deep indigo and a site where the two chains disagree pink, bright on the top half and deeper on the bottom; at 0.25 they are lilac, purple and yellow, at 0.5 peach, indigo and green, at 0.75 pale green, teal and blue. The down spins keep to the deep arc from teal to purple, since a deep orange reads brown.
// Knob 2: Speed. How fast a run goes from -T to 0. At 2 the first run, 8 sweeps, takes 0.45 s and each doubling 1.37 times longer, so 64 sweeps take 1.15 s and 1024 take 4 s; a sample holds 2 s and a failed run pauses 0.4 s. Every time goes as 2 / Speed.
// Knob 3: Beta. The inverse temperature, in units of the coupling. At the opening 0.32 the chains meet after 35 to 60 sweeps, so the run from -64 is the first that works and a sample comes 4.4 s in, fine grain with small islands; at 0.36 they need 80 to 130 sweeps and at 0.4 about 200 to 370; at 0.43, just short of the critical 0.4407, they need 1000 to 2100, a sample takes 17 to 43 s and is a few big domains. Turning it starts a fresh run.
// Knob 4: Field. An outside field, up to the right, of 0.6 k|k| in units of the coupling: 0.002 at the opening 0.06, too weak to see at Beta 0.32, though at 0.43 it acts on all 3968 spins at once and most samples come out more up than down. At 1 or -1 nine spins in ten or more point its way and the chains meet in 13 to 22 sweeps at any Beta. Turning it starts a fresh run.

// The Ising model on a 64 by 62 torus: each site a spin +1 or -1, and each
// pair of neighbours adds -1 to the energy if they agree and +1 if they do
// not, with -h for every spin up and +h for every spin down. The heat-bath
// update visits a site, sums its four neighbours s, and sets it up with
// probability 1 / (1 + exp(-2 beta (s + h))) whatever it was before. One
// sweep visits every site once in a fixed order.
//
// Coupling from the past (Propp and Wilson, 1996): feed the same uniform
// random number u(t, x) to every chain, so a sweep is one fixed map from
// configurations to configurations. The update is monotone: a chain that
// is up wherever another is up stays so after the sweep. So the chain
// started all up at time -T stays above every other start, and the chain
// started all down below it. If those two agree everywhere at time 0, every
// start agrees with them, and the state at 0 is the end of a chain that has
// run since minus infinity: an exact sample of the Gibbs distribution, not
// an approximation. If they do not, start again from -2T. The random
// numbers for -T..0 must be the same as last time, or the sample is biased,
// so u is a hash of (run seed, t, x) and is never stored.
//
// The top half is the chain from all up, the bottom the chain from all
// down, each 64 by 62. Where they disagree the top one is always up and the
// bottom one down, by monotonicity, and those sites take the disagreement
// colour. Between the halves, framed by a dark row on each side, two rows
// are the timeline from -T at the left to 0 at the right: lit in the
// disagreement colour while the chains differ and in the up colour once
// they have met, with a dark notch where each earlier run started, at -T/2,
// -T/4 and on. After a sample the same seed runs once more from twice as
// far back. That check run lands on the same sample: its chains are held
// between the first run's two from -T on, so they have met by the time the
// first run's did, the gold notch, and from there they replay its last
// stretch sweep for sweep. When it lands on the stored sample LED for LED,
// the whole timeline turns gold while it holds. A run that fails with 48
// sites or fewer still apart rings each of them while it pauses.

const W = 64, LH = 62, N = W * LH, BOT = 66, LINE = 63;
const { floor, round, exp, pow, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seconds at Speed 2: the first run, the growth of a run's length with each
// doubling, the hold on a sample and the pause on a run that failed.
const T0 = 8, D0 = 0.45, GROW = 0.45, HOLD = 2, FAIL = 0.4, TMAX = 1 << 16;

// Neighbours on the torus. A sweep visits the sites in index order.
const NB = new Int32Array(N * 4);
for (let y = 0; y < LH; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    NB[i * 4] = y * W + ((x + 1) % W);
    NB[i * 4 + 1] = y * W + ((x + W - 1) % W);
    NB[i * 4 + 2] = ((y + 1) % LH) * W + x;
    NB[i * 4 + 3] = ((y + LH - 1) % LH) * W + x;
  }

// Murmur3's finaliser, a bijection on 32 bits.
function mix(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
// u(seed, t, x): a key for the sweep at time t, mixed with the site. The
// same three numbers give the same u in every run that passes through t.
const keyOf = (seed, t) => mix(seed ^ Math.imul(t, 0x9e3779b1));
const uOf = (key, i) => mix(key ^ Math.imul(i + 1, 0x27d4eb2f));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map((c) => round(c * 255));
}

// A run of length T at Speed 2 lasts D0 (T / T0)^GROW seconds.
const span = (T) => D0 * pow(T / T0, GROW);

function fresh(S) {
  S.run++;
  S.seed = mix(S.base + Math.imul(S.run, 0x632be5ab)) | 0;
  S.T = T0;
  S.check = false;
  S.metFirst = null;
  begin(S);
}

// Both chains to their extremes at time -T.
function begin(S) {
  S.up.fill(1);
  S.dn.fill(-1);
  S.t = -S.T;
  S.dis = N;
  S.met = null;
  S.acc = 0;
  S.phase = "run";
  S.wait = 0;
  S.same = false;
}

// One sweep from time t to t + 1 on both chains with the same u.
function sweep(S) {
  const a = S.up, b = S.dn, thr = S.thr, key = keyOf(S.seed, S.t), one = S.dis === 0;
  for (let i = 0; i < N; i++) {
    const u = uOf(key, i), j = i * 4;
    a[i] = u < thr[a[NB[j]] + a[NB[j + 1]] + a[NB[j + 2]] + a[NB[j + 3]] + 4] ? 1 : -1;
    if (!one) b[i] = u < thr[b[NB[j]] + b[NB[j + 1]] + b[NB[j + 2]] + b[NB[j + 3]] + 4] ? 1 : -1;
  }
  S.t++;
  if (one) b.set(a);
  else {
    let d = 0;
    for (let i = 0; i < N; i++) if (a[i] !== b[i]) d++;
    S.dis = d;
    if (!d) S.met = S.t;
  }
}

export function setup(params) {
  params.s = {
    up: new Int8Array(N), dn: new Int8Array(N), thr: new Float64Array(9), sample: new Int8Array(N),
    base: floor(Math.random() * 2147483647), run: 0, seed: 0, T: T0, t: -T0, dis: N, met: null, metFirst: null,
    check: false, same: false, acc: 0, phase: "run", wait: 0, beta: -1, field: -9, hue: 0, speed: 2, flash: 0,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const beta = cl(k[2] || 0, 0.32, 0.43), k4 = cl(k[3] == null ? 0.06 : k[3], -1, 1), field = 0.6 * k4 * abs(k4);
  if (abs(beta - S.beta) > 1e-4 || abs(field - S.field) > 1e-4) {
    S.beta = beta;
    S.field = field;
    // Probability of up, as a 32-bit threshold, for each neighbour sum s.
    for (let s = -4; s <= 4; s++) S.thr[s + 4] = floor(4294967296 / (1 + exp(-2 * beta * (s + field))));
    fresh(S);
  }
  const rate = S.speed / 2;
  S.flash = max(0, S.flash - d * 2.5 * rate);
  if (S.phase !== "run") {
    S.wait -= d * rate;
    if (S.wait > 0) return;
    if (S.phase === "fail") {
      S.T = min(TMAX, S.T * 2);
      begin(S);
    } else if (!S.check) {
      // The same seed from twice as far back: the check run.
      const met = S.met;
      S.T *= 2;
      begin(S);
      S.check = true;
      S.metFirst = met;
    } else fresh(S);
    return;
  }
  // Sweeps owed this frame; a long run gets more of them each second.
  S.acc += (d * rate * S.T) / span(S.T);
  let n = floor(S.acc);
  S.acc -= n;
  // Past 24 sweeps a frame the run would cost more than 2 ms a frame.
  n = min(n, 24, -S.t);
  for (let i = 0; i < n; i++) sweep(S);
  if (S.t >= 0) {
    if (S.dis === 0) {
      S.phase = "hold";
      S.wait = HOLD;
      S.flash = 1;
      if (S.check) {
        let same = true;
        for (let i = 0; i < N; i++) if (S.sample[i] !== S.up[i]) same = false;
        S.same = same;
      } else S.sample.set(S.up);
    } else {
      S.phase = "fail";
      S.wait = FAIL;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  // Up is a pale tint of the hue. Down stays in the deep cool arc from teal
  // to violet as the hue goes round, since a deep orange or yellow reads
  // brown on the panel; the disagreement takes the hue's far side.
  const h = S.hue + 0.55;
  const UP = hsv(h, 0.3, 0.88), DN = hsv(0.675 + 0.175 * Math.sin(2 * Math.PI * S.hue), 0.85, 0.45);
  const XT = hsv(h + 0.37, 0.65, 1), XB = hsv(h + 0.37, 0.95, 0.8);
  const a = S.up, b = S.dn, f = S.flash * 0.3;
  const lift = (c) => [round(c[0] + (255 - c[0]) * f), round(c[1] + (255 - c[1]) * f), round(c[2] + (255 - c[2]) * f)];
  const U = lift(UP), D = lift(DN);
  for (let y = 0; y < LH; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, sa = a[i];
      if (sa !== b[i]) {
        display.setPixel(x, y, XT[0], XT[1], XT[2]);
        display.setPixel(x, y + BOT, XB[0], XB[1], XB[2]);
      } else {
        const c = sa > 0 ? U : D;
        display.setPixel(x, y, c[0], c[1], c[2]);
        display.setPixel(x, y + BOT, c[0], c[1], c[2]);
      }
    }

  // The rings round the sites a failed run left apart, pulsing twice.
  if (S.phase === "fail" && S.dis <= 48) {
    const v = 0.5 + 0.5 * Math.cos((1 - S.wait / FAIL) * 4 * Math.PI);
    for (let i = 0; i < N; i++) {
      if (a[i] === b[i]) continue;
      const x0 = i % W, y0 = floor(i / W);
      for (let k = -2; k <= 2; k++)
        for (const [dx, dy] of [[k, -2], [k, 2], [-2, k], [2, k]]) {
          const x = (x0 + dx + W) % W, y = (y0 + dy + LH) % LH, j = y * W + x;
          const ct = a[j] !== b[j] ? XT : a[j] > 0 ? U : D, cb = a[j] !== b[j] ? XB : a[j] > 0 ? U : D;
          display.setPixel(x, y, round(ct[0] + (255 - ct[0]) * v), round(ct[1] + (255 - ct[1]) * v), round(ct[2] + (255 - ct[2]) * v));
          display.setPixel(x, y + BOT, round(cb[0] + (255 - cb[0]) * v), round(cb[1] + (255 - cb[1]) * v), round(cb[2] + (255 - cb[2]) * v));
        }
    }
  }

  // The timeline, -T at the left edge and 0 at the right, between two dark
  // rows. The x of time t is W (1 + t / T).
  const T = S.T, X = (t) => min(W - 1, floor(W * (1 + t / T)));
  const ahead = hsv(h, 0.45, 0.17), gold = hsv(h + 0.6, 0.75, 1), notch = [0, 0, 0];
  const now = S.phase === "run" ? X(S.t) : W;
  const met = S.met === null ? W : X(S.met);
  for (let x = 0; x < W; x++) {
    let c = x >= now ? ahead : x < met ? XB : UP;
    if (S.same && S.phase === "hold") c = gold;
    // Earlier runs started at -T/2, -T/4, ... down to -T0.
    for (let q = T / 2; q >= T0; q /= 2) if (x === X(-q)) c = notch;
    if (S.metFirst !== null && x === X(S.metFirst)) c = gold;
    if (x === now) c = [255, 255, 255];
    display.setPixel(x, LINE - 1, 0, 0, 0);
    display.setPixel(x, LINE, c[0], c[1], c[2]);
    display.setPixel(x, LINE + 1, c[0], c[1], c[2]);
    display.setPixel(x, LINE + 2, 0, 0, 0);
  }
}
