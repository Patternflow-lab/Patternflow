// ===== Patternflow pattern =====
// Title:   Yard-Sale Model
// Family:  data
// Idea:    Sixty-four agents start with equal wealth and trade in random pairs, a fair coin deciding who takes a fraction of the poorer one's wealth, and the Lorenz curve on top sags from its diagonal, the sorted fortunes below fall away to one tall bar, and the Gini coefficient climbs toward 1 along the bottom, unless a tax pulls everyone back toward the mean.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lorenz curve (Max Lorenz, 1905), Gini coefficient (Corrado Gini, 1912), yard-sale model of asset exchange (Anirban Chakraborti, 2002; named by Brian Hayes, 2002), wealth condensation and redistribution (Bruce Boghosian and coauthors, 2014 and 2017), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fraction=0.2..0.6, Tax=0..1
//
// Knob 1: Hue. Turns the picture round the wheel. At 0 the gap between the diagonal and the Lorenz curve is azure, the bars rise from violet through blue to azure at the starting level and pale toward the top, and the curve, the trace and the one followed agent are cream; at 0.25 the gap is violet, at 0.5 red, at 0.75 green. Orange and dark yellow are skipped, as they read brown.
// Knob 2: Speed. The clock a run is played on. A run is 1600 rounds of 32 trades, one trade per agent a round on average, on a log clock: the rounds done plus 40 grow e-fold every 5.4 s at Speed 2, so rounds 0 to 40, 40 to 120, 120 to 280 and so on each take 3.7 s, and the run reaches 1600 at 20 s. The trace across the bottom is drawn against the same log clock. At 0.2 ten times slower, at 3 one and a half times faster. The first run opens 14 rounds in, already off the diagonal; every later one starts equal.
// Knob 3: Fraction. The share f of the poorer agent's wealth a trade moves. Over 16 economies at a time with no tax, the Gini coefficient averaged 0.54 at 50 rounds, 0.66 at 100, 0.77 at 200, 0.86 at 400, 0.92 at 800 and 0.95 at 1600 for f = 0.2; for f = 0.4 it was 0.77 at 50 rounds and 0.92 at 200, for f = 0.6 0.88 at 50. A run stops when the economy on the panel reaches 0.95 or 1600 rounds, holds 2.5 s and starts again equal: every 22 s at f = 0.2 (23 of 54 runs went the whole 1600 rounds), every 15 s at 0.4, every 11 s at 0.6.
// Knob 4: Tax. Up to 0.1 there is none; above it every agent pays chi = 0.08 ((K4 - 0.1) / 0.9)^2 of its wealth a round into a pot shared equally, Boghosian's redistribution, and the Gini settles: at f = 0.2 on 0.69 at K4 = 0.25 (chi = 0.0022), 0.41 at 0.5 (0.0158), 0.28 at 0.75 (0.042) and 0.21 at 1 (0.08). In the Fokker-Planck limit it depends on chi / f^2 only; at chi / f^2 = 0.395 the steady Gini was 0.407, 0.403 and 0.396 for f = 0.2, 0.3 and 0.4.
// Buttons: K1 tap restarts the economy with everyone equal.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, log, round, random, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel without orange and dark yellow, 0.03 to 0.17, which read brown.
const wheel = (h) => 0.17 + 0.86 * (h - floor(h));

// N agents, W0 units each, so the total is N W0 = 64000 whole units and no
// trade or tax can make or lose one.
const N = 64, W0 = 1000, TOTAL = N * W0;
// The economy on the panel and 15 more run side by side from the same
// start; the band their Gini coefficients span is drawn behind its own.
const E = 16;
// A round is N / 2 trades, one for each agent on average. A run is 1600
// rounds on a clock that runs in log time, r = R0 (e^(t / TAU) - 1), so
// rounds 0 to 40, 40 to 120, 120 to 280 and so on each take the same time:
// TAU = 5.4 s at Speed 2 and the whole run 20 s.
const R0 = 40, RUN = 1600, LRUN = log(1 + RUN / R0), TAU = 5.4;
const LZ = 63, BAR0 = 101, BARH = 34, TR0 = 127, TRH = 23;
const GSTOP = 0.95, HOLD = 2.5, BLOG = 20;

export function setup(params) {
  params.s = {
    w: new Int32Array(N * E), sorted: new Int32Array(N), ids: new Int32Array(N), L: new Float32Array(N + 1),
    trace: new Float32Array(W).fill(-1), lo: new Float32Array(W).fill(-1), hi: new Float32Array(W).fill(-1),
    rgb: new Float32Array(NP * 3), c: new Float32Array(12),
    old: new Float32Array(NP * 3), rounds: 0, clock: 0, gini: 0, hold: 0, fade: 0, started: false,
    k: [0, 2, 0.2, 0.06], prev: false,
  };
}

function restart(S) {
  S.w.fill(W0);
  S.trace.fill(-1);
  S.lo.fill(-1);
  S.hi.fill(-1);
  S.trace[0] = S.lo[0] = S.hi[0] = 0;
  S.rounds = S.clock = S.gini = S.hold = 0;
  S.old.set(S.rgb);
  S.fade = 1;
}

// One round of economy e: N / 2 trades, then the tax. In a trade two agents
// are drawn, a fair coin picks the winner, and the winner takes f times the
// poorer agent's wealth, rounded at random to a whole unit so the mean is
// exact. The tax takes chi of every agent's wealth, rounded the same way,
// and shares the pot out equally; the units it cannot share go one each to
// agents drawn at random.
function round1(w, o, f, chi) {
  for (let t = 0; t < N / 2; t++) {
    const i = o + floor(random() * N);
    let j = o + floor(random() * (N - 1));
    if (j >= i) j++;
    const d = floor(f * min(w[i], w[j]) + random());
    if (random() < 0.5) (w[i] += d), (w[j] -= d);
    else (w[i] -= d), (w[j] += d);
  }
  if (chi > 0) {
    let pot = 0;
    for (let i = o; i < o + N; i++) {
      const p = floor(chi * w[i] + random());
      w[i] -= p;
      pot += p;
    }
    const each = floor(pot / N);
    for (let i = o; i < o + N; i++) w[i] += each;
    for (let r = pot - each * N; r > 0; r--) w[o + floor(random() * N)]++;
  }
}

// Sort economy e by wealth and read its Gini coefficient off the Lorenz
// curve: G = 1 - 2 * (area under it), the area by trapezoids, exact in
// whole units.
function sortAndGini(S, e) {
  const { w, ids, sorted } = S, o = e * N;
  for (let i = 0; i < N; i++) ids[i] = i;
  ids.sort((a, b) => w[o + a] - w[o + b] || a - b);
  let cum = 0, area = 0;
  for (let k = 0; k < N; k++) {
    const v = w[o + ids[k]];
    sorted[k] = v;
    area += 2 * cum + v;
    cum += v;
  }
  return 1 - area / (N * TOTAL);
}
// The column of the trace a round falls in.
const colOf = (r) => min(W - 1, round(((W - 1) * log(1 + r / R0)) / LRUN));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.k[0] = k[0];
  S.k[1] = cl(k[1], 0.2, 3);
  S.k[2] = cl(k[2], 0.2, 0.6);
  S.k[3] = cl(k[3], 0, 1);
  const f = S.k[2], t4 = max(0, (S.k[3] - 0.1) / 0.9), chi = 0.08 * t4 * t4;
  const press = !!(input.btnPressed && input.btnPressed[0]);
  if (!S.started || (press && !S.prev)) {
    restart(S);
    // The first run opens 0.3 TAU into its clock, 14 rounds in, so the
    // curve has already left the diagonal; every later run starts equal.
    if (!S.started) (S.clock = 0.3 * TAU), (S.fade = 0);
    S.started = true;
  }
  S.prev = press;
  S.fade = max(0, S.fade - d / 0.6);
  if (S.hold > 0) {
    S.hold += d;
    if (S.hold > HOLD) restart(S);
  } else {
    S.clock += (d * S.k[1]) / 2;
    const target = min(RUN, floor(R0 * (Math.exp(S.clock / TAU) - 1)));
    while (S.rounds < target) {
      for (let e = 0; e < E; e++) round1(S.w, e * N, f, chi);
      S.rounds++;
      const col = colOf(S.rounds);
      if (col !== colOf(S.rounds + 1) || S.rounds === target) {
        const g = sortAndGini(S, 0);
        let lo = g, hi = g;
        for (let e = 1; e < E; e++) {
          const ge = sortAndGini(S, e);
          lo = min(lo, ge);
          hi = max(hi, ge);
        }
        S.trace[col] = g;
        S.lo[col] = lo;
        S.hi[col] = hi;
      }
    }
    if (S.rounds >= RUN) S.hold = 1e-6;
  }
  S.gini = sortAndGini(S, 0);
  if (S.hold === 0 && S.gini >= GSTOP) S.hold = 1e-6;
}

function add(rgb, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  rgb[o] += r;
  rgb[o + 1] += g;
  rgb[o + 2] += b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, c, sorted, L } = S, h = S.k[0];
  sortAndGini(S, 0);
  rgb.fill(0);
  // Colours: 0 the gap between the diagonal and the curve, 3 the share
  // under the curve, 6 the curve and the trace.
  hsv(wheel(0.48 + h), 0.75, 0.52, c, 0);
  hsv(wheel(0.68 + h), 0.6, 0.1, c, 3);
  hsv(0.12 + h, 0.15, 1, c, 6);

  // The Lorenz square, rows 0 to 63: share of agents across, share of
  // wealth up. L(k) is the wealth of the poorest k agents over the total.
  L[0] = 0;
  for (let kk = 0; kk < N; kk++) L[kk + 1] = L[kk] + sorted[kk] / TOTAL;
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W, p = u * N, i = min(N - 1, floor(p)), lv = L[i] + (L[i + 1] - L[i]) * (p - i);
    const yd = LZ - u * LZ, yl = LZ - lv * LZ;
    for (let y = 0; y <= LZ; y++) {
      if (y < yd - 0.5) continue;
      if (y < yl - 0.5) add(rgb, x, y, c[0] * 255, c[1] * 255, c[2] * 255);
      else add(rgb, x, y, c[3] * 255, c[4] * 255, c[5] * 255);
    }
  }
  for (let x = 0; x < W; x++) add(rgb, x, round(LZ - ((x + 0.5) / W) * LZ), 40, 40, 40);
  // A dot every tenth of the agents and every tenth of the wealth.
  for (let i = 1; i < 10; i++)
    for (let j = 1; j < 10; j++) add(rgb, round((i * W) / 10 - 0.5), round(LZ - (j * LZ) / 10), 34, 34, 38);
  // The curve as an unbroken line: in each column, every row between its
  // heights at the column's two edges.
  for (let x = 0; x < W; x++) {
    const ya = LZ - L[x] * LZ, yb = LZ - L[x + 1] * LZ;
    for (let y = round(yb); y <= round(ya); y++) add(rgb, x, y, c[6] * 230, c[7] * 230, c[8] * 230);
  }

  // The sorted fortunes, rows 67 to 101, poorest at the left, on a log
  // scale, log(1 + w / 20) over log(1 + all / 20), each LED coloured by its
  // height: violet low, the hue of the gap at the starting level, paler
  // above it. Agent 0 is drawn cream, so one fortune can be followed as it
  // changes rank.
  const top = log(1 + TOTAL / BLOG), y0 = (BARH * log(1 + W0 / BLOG)) / top;
  for (let kk = 0; kk < N; kk++) {
    const hgt = (BARH * log(1 + sorted[kk] / BLOG)) / top;
    for (let y = 0; y < hgt; y++) {
      const a = min(1, hgt - y);
      if (y < y0) hsv(wheel(0.72 + h - (0.24 * y) / y0), 0.8, 0.45 + (0.35 * y) / y0, c, 0);
      else hsv(wheel(0.48 + h), 0.8 * (1 - (y - y0) / (BARH - y0)) + 0.1, 0.8 + (0.2 * (y - y0)) / (BARH - y0), c, 0);
      if (S.ids[kk] === 0) add(rgb, kk, BAR0 - y, c[6] * 230 * a, c[7] * 230 * a, c[8] * 230 * a);
      else add(rgb, kk, BAR0 - y, c[0] * 255 * a, c[1] * 255 * a, c[2] * 255 * a);
    }
  }
  for (let x = 0; x < W; x += 2) add(rgb, x, round(BAR0 - y0), 50, 50, 50);

  // The Gini trace, rows 104 to 127, against rounds on a log scale: G = 0 at
  // the bottom and 1 at the top, the highest a 64-agent economy can reach,
  // 1 - 1/64, dotted. Behind the panel's own economy, bright, the band from
  // the lowest to the highest of the sixteen.
  for (let x = 0; x < W; x += 2) add(rgb, x, round(TR0 - (1 - 1 / N) * TRH), 50, 50, 50);
  hsv(wheel(0.48 + h), 0.75, 0.42, c, 0);
  hsv(wheel(0.48 + h), 0.75, 0.16, c, 3);
  for (let x = 0; x < W; x++) {
    const g = S.trace[x];
    if (g < 0) continue;
    const yt = round(TR0 - g * TRH), ylo = round(TR0 - S.lo[x] * TRH), yhi = round(TR0 - S.hi[x] * TRH);
    for (let y = yhi; y <= TR0; y++) {
      const o = y <= ylo ? 0 : 3;
      add(rgb, x, y, c[o] * 255, c[o + 1] * 255, c[o + 2] * 255);
    }
    add(rgb, x, yt, c[6] * 255, c[7] * 255, c[8] * 255);
  }

  const fd = S.fade, old = S.old;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) {
      let r = min(255, rgb[p]), g = min(255, rgb[p + 1]), b = min(255, rgb[p + 2]);
      if (fd > 0) (r = r * (1 - fd) + old[p] * fd), (g = g * (1 - fd) + old[p + 1] * fd), (b = b * (1 - fd) + old[p + 2] * fd);
      (rgb[p] = r), (rgb[p + 1] = g), (rgb[p + 2] = b);
      display.setPixel(x, y, r, g, b);
    }
}
