// ===== Patternflow pattern =====
// Title:   Hopfield Letters
// Family:  type
// Idea:    A Hopfield network of 1,536 neurons, each a 2 by 2 block of LEDs, holds the letters A, T, O and M in its Hebbian weights, and every few seconds it is handed one of them buried under noise and turns its neurons over one at a time, each flip lighting up as it happens, until the energy, traced underneath, can fall no further and the letter stands clean; store more letters and the same descent ends in a blurred blend that is none of them.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hopfield network (John Hopfield, 1982), its storage capacity 0.138 N (Daniel Amit, Hanoch Gutfreund and Haim Sompolinsky, 1985), pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Load=0..1, Noise=0..1
//
// Knob 1: Hue. Turns both states round the wheel. At 0 a neuron at +1 is gold and one at -1 a dim navy, at 0.25 green on plum, at 0.5 blue on a dim olive, at 0.75 magenta on a dim green.
// Knob 2: Speed. Neuron updates a second, 512 for each unit: 1,024 at the opening 2, so one sweep through all 1,536 neurons takes 1.5 s; 0.2 takes 15 s a sweep and 3 takes 1 s. Once no neuron's field points against it the state stands for 1.6 s / Speed, 0.8 s at the opening, before the next cue.
// Knob 3: Load. How many letters the weights hold, 4 at 0 and 10 at 1, added in the order A T O M H E K R S X. Four come back every time from a cue with 26.5% of its neurons wrong. The fifth, H, agrees with M on 90% of the neurons, and with five stored neither M nor H is a valley any more: M's cue ends a dozen neurons or so short of M, and H's cue mostly in a blend that overlaps M by 0.89 and H by 0.90. With six T still comes back 87% of the time and A 43%, from seven no cue finds its letter, and from eight every cue ends in a blend lower in energy than any stored letter. The labels under the bars show which letters are stored.
// Knob 4: Noise. The share of a cue's neurons set wrong, 25% at 0 rising to 50% at 1; at the opening 0.06 it is 26.5%. At 50% the cue is pure noise and says nothing of the letter asked for, so the network falls into whichever valley is nearest: a stored letter, its negative (the ground lit and the letter dark), or a blend.
// Buttons: K1 tap hands the network its next cue at once.

// John Hopfield's network (PNAS, 1982) is N neurons that are each +1 or
// -1 and a symmetric weight between every pair. To store letters xi^1 ...
// xi^P it takes the Hebb rule, W_ij = (1/N) sum over mu of xi_i^mu xi_j^mu,
// with W_ii = 0. A neuron updates by taking the sign of its field
// h_i = sum_j W_ij s_j, and since the weights are symmetric every flip
// lowers (or keeps) the energy E = -1/2 sum_ij W_ij s_i s_j, so updating
// one neuron at a time must end in a state no single flip can improve:
// a valley of E. The stored letters are valleys when they are few and
// unlike each other, and a corrupted letter rolls down into its own.
//
// With the Hebb rule the field never needs the N by N weights: with
// M_mu = sum_j xi_j^mu s_j, the state's overlap with letter mu,
// N h_i = sum_mu xi_i^mu M_mu - P s_i, the last term taking the diagonal
// out. A flip of neuron i changes every M_mu by 2 s_i xi_i^mu, so an
// update costs P steps and the energy is E/N = -1/2 sum_mu m_mu^2 + P/2N
// with m_mu = M_mu / N. The bars under the picture are the m_mu, and the
// trace above them is E/N, which falls in steps between cues and never
// rises while the network is left alone.
//
// Daniel Amit, Hanoch Gutfreund and Haim Sompolinsky (Physical Review
// Letters, 1985) found that random patterns stay retrievable up to
// P = 0.138 N, 212 patterns for these 1,536 neurons. Letters are not
// random: they share a ground and many strokes. Here M and H agree on 90%
// of their neurons (overlap 0.79), and R on 81% with each of E and K.
// Sitting on letter mu, a neuron where every other stored letter
// disagrees with mu feels a field of 1 minus the sum of mu's overlaps
// with them, so once that sum passes 1 such a neuron turns against the
// letter and the letter stops being a valley. Four letters, 0.26% of N,
// are recalled every time; at seven no stored letter is a valley any
// more, and blends of several letters, spurious valleys nobody stored,
// take their place.

const W = 64, H = 128, GW = 32, GH = 48, N = GW * GH, CS = 2;
const { floor, round, min, max, abs, sqrt, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const LIST = "ATOMHEKRSX";
// Rows of the panel under the network: the energy trace, the bars, the labels.
const TR0 = 98, TR1 = 109, BAR0 = 112, BAR1 = 121, LAB = 122, TN = 60;

// The letters as strokes in a 10 by 16 box, drawn for this pattern, then
// set at neuron resolution as every neuron within 3 neurons of a stroke.
const arc = (cx, cy, rx, ry, a0, a1, n) => {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * PI) / 180;
    o.push([cx + rx * cos(a), cy + ry * sin(a)]);
  }
  return o;
};
const STROKES = {
  A: [[[0, 16], [5, 0], [10, 16]], [[2.2, 10.5], [7.8, 10.5]]],
  T: [[[0, 0], [10, 0]], [[5, 0], [5, 16]]],
  O: [arc(5, 8, 5, 8, 0, 360, 24)],
  M: [[[0, 16], [0, 0], [5, 9], [10, 0], [10, 16]]],
  H: [[[0, 0], [0, 16]], [[10, 0], [10, 16]], [[0, 8], [10, 8]]],
  E: [[[10, 0], [0, 0], [0, 16], [10, 16]], [[0, 8], [8, 8]]],
  K: [[[0, 0], [0, 16]], [[10, 0], [0, 9]], [[3.5, 6.5], [10, 16]]],
  R: [[[0, 16], [0, 0], [5, 0], ...arc(5, 4, 5, 4, -90, 90, 8), [0, 8]], [[4, 8], [10, 16]]],
  S: [[...arc(5, 4, 5, 4, -20, -270, 12), ...arc(5, 12, 5, 4, -90, 160, 12)]],
  X: [[[0, 0], [10, 16]], [[10, 0], [0, 16]]],
};
// The same ten as 3 by 5 labels under the bars.
const SMALL = {
  A: ".#. #.# ### #.# #.#", T: "### .#. .#. .#. .#.", O: "### #.# #.# #.# ###", M: "#.# ### ### #.# #.#",
  H: "#.# #.# ### #.# #.#", E: "### #.. ### #.. ###", K: "#.# #.# ##. #.# #.#", R: "##. #.# ##. #.# #.#",
  S: ".## #.. .#. ..# ##.", X: "#.# #.# .#. #.# #.#",
};

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? cl(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  const x = ax + t * dx - px, y = ay + t * dy - py;
  return sqrt(x * x + y * y);
}

function letter(ch) {
  const out = new Int8Array(N), HW = 3, M = 3, sx = (GW - 2 * M - 2 * HW) / 10, sy = (GH - 2 * M - 2 * HW) / 16;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      let d = 1e9;
      for (const pl of STROKES[ch])
        for (let i = 0; i + 1 < pl.length; i++) {
          const a = pl[i], b = pl[i + 1];
          d = min(d, segDist(x + 0.5, y + 0.5, M + HW + a[0] * sx, M + HW + a[1] * sy, M + HW + b[0] * sx, M + HW + b[1] * sy));
        }
      out[y * GW + x] = d <= HW ? 1 : -1;
    }
  return out;
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  const L = [...LIST].map(letter), K = L.length;
  // Overlaps between the letters, for the energy each letter sits at.
  const C = new Float32Array(K * K);
  for (let a = 0; a < K; a++)
    for (let b = 0; b < K; b++) {
      let c = 0;
      for (let p = 0; p < N; p++) c += L[a][p] * L[b][p];
      C[a * K + b] = c / N;
    }
  params.s = {
    L, K, C, P: 4, s: new Int8Array(N), M: new Int32Array(K), flash: new Float32Array(N),
    order: new Uint16Array(N), at: N, total: 0, hold: -1, cue: -1, budget: 0,
    speed: 2, hue: 0, noise: 0.265, trace: new Float32Array(TN), tclock: 0, tn: 0, prev: false,
    ink: [0, 0, 0], gnd: [0, 0, 0],
  };
  for (let i = 0; i < N; i++) params.s.order[i] = i;
}

function overlaps(S) {
  for (let m = 0; m < S.K; m++) {
    let v = 0;
    const x = S.L[m];
    for (let p = 0; p < N; p++) v += x[p] * S.s[p];
    S.M[m] = v;
  }
}

// The next stored letter, with a share of its neurons set wrong.
function kick(S) {
  S.cue = (S.cue + 1) % S.P;
  const x = S.L[S.cue];
  for (let p = 0; p < N; p++) {
    const v = Math.random() < S.noise ? -x[p] : x[p];
    if (v !== S.s[p]) S.flash[p] = 0.5;
    S.s[p] = v;
  }
  overlaps(S);
  S.at = N;
  S.hold = -1;
}

function energy(S) {
  let e = 0;
  for (let m = 0; m < S.P; m++) e += (S.M[m] / N) * (S.M[m] / N);
  return -0.5 * e + S.P / (2 * N);
}

function stable(S) {
  const s = S.s, P = S.P;
  for (let i = 0; i < N; i++) {
    let h = -P * s[i];
    for (let m = 0; m < P; m++) h += S.L[m][i] * S.M[m];
    if (h * s[i] < 0) return false;
  }
  return true;
}

function step(S) {
  if (S.at >= N) {
    // A new sweep in a fresh random order.
    S.at = 0;
    const o = S.order;
    for (let i = N - 1; i > 0; i--) {
      const j = floor(Math.random() * (i + 1)), t = o[i];
      o[i] = o[j];
      o[j] = t;
    }
  }
  const i = S.order[S.at++], s = S.s, P = S.P;
  let h = -P * s[i];
  for (let m = 0; m < P; m++) h += S.L[m][i] * S.M[m];
  const v = h > 0 ? 1 : h < 0 ? -1 : s[i];
  if (v !== s[i]) {
    for (let m = 0; m < S.K; m++) S.M[m] += 2 * v * S.L[m][i];
    s[i] = v;
    S.flash[i] = 1;
    S.total++;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.noise = 0.25 + 0.25 * cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const P = 4 + round(cl(k[2] || 0, 0, 1) * 6);
  if (P !== S.P) {
    S.P = P;
    S.cue = S.cue % P;
    S.hold = -1;
  }
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (S.cue < 0 || (btn && !S.prev)) kick(S);
  S.prev = btn;
  for (let p = 0; p < N; p++) S.flash[p] = max(0, S.flash[p] - d * 3.5);
  if (S.hold >= 0) {
    S.hold -= d;
    if (S.hold < 0) kick(S);
  } else {
    S.budget += d * S.speed * 512;
    const before = S.total;
    while (S.budget >= 1) {
      S.budget -= 1;
      step(S);
    }
    // No flip this frame: if no neuron's field opposes it, the state is a
    // valley, and it stands for 1.6 s / Speed before the next cue.
    if (S.total === before && stable(S)) S.hold = 1.6 / S.speed;
  }
  // The energy, ten samples a second, the newest at the right.
  S.tclock += d;
  while (S.tclock >= 0.1) {
    S.tclock -= 0.1;
    S.trace.copyWithin(0, 1);
    S.trace[TN - 1] = energy(S);
    S.tn = min(TN, S.tn + 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const ink = hsv(S.hue + 0.13, 0.85, 1, S.ink), gnd = hsv(S.hue + 0.64, 0.75, 0.3, S.gnd);
  const ir = ink[0] * 255, ig = ink[1] * 255, ib = ink[2] * 255, gr = gnd[0] * 255, gg = gnd[1] * 255, gb = gnd[2] * 255;
  // The network: +1 in the letter colour, -1 in the dim ground, a neuron
  // that has just flipped flaring towards white.
  for (let y = 0; y < 96; y++)
    for (let x = 0; x < W; x++) {
      const p = floor(y / CS) * GW + floor(x / CS), f = S.flash[p] * S.flash[p];
      let r, g, b;
      if (S.s[p] > 0) (r = ir), (g = ig), (b = ib);
      else (r = gr), (g = gg), (b = gb);
      display.setPixel(x, y, round(r + (255 - r) * f), round(g + (255 - g) * f), round(b + (255 - b) * f));
    }
  for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  // The energy trace: 0 at the top row, and the deepest stored letter's
  // own energy three quarters of the way down, marked by a dotted line.
  let el = 0;
  for (let a = 0; a < S.P; a++) {
    let e = 0;
    for (let b = 0; b < S.P; b++) e += S.C[a * S.K + b] * S.C[a * S.K + b];
    el = min(el, -0.5 * e + S.P / (2 * N));
  }
  const span = TR1 - TR0, ey = (e) => TR0 + cl((-e / -el) * 0.75, 0, 1) * span;
  const yl = round(ey(el));
  for (let x = 2; x < W - 2; x += 3) display.setPixel(x, yl, round(gr * 1.6), round(gg * 1.6), round(gb * 1.6));
  let last = -1;
  for (let i = TN - S.tn; i < TN; i++) {
    const x = 2 + i, y = round(ey(S.trace[i]));
    const a = last < 0 ? y : last, lo = min(a, y), hi = max(a, y);
    for (let yy = lo; yy <= hi; yy++) display.setPixel(x, yy, round(ir), round(ig), round(ib));
    for (let yy = hi + 1; yy <= TR1; yy++) display.setPixel(x, yy, round(gr * 0.8), round(gg * 0.8), round(gb * 0.8));
    last = y;
  }
  // One bar per letter in LIST: its overlap with the state, |m| tall, in
  // the letter colour when m > 0 and in the ground colour lifted when the
  // state leans to the letter's negative. Letters not stored are grey.
  for (let m = 0; m < S.K; m++) {
    const x0 = 2 + m * 6, stored = m < S.P, v = S.M[m] / N, hgt = round(abs(v) * (BAR1 - BAR0 + 1));
    for (let y = BAR1 - hgt + 1; y <= BAR1; y++)
      for (let x = x0; x < x0 + 4; x++) {
        if (!stored) display.setPixel(x, y, 46, 46, 46);
        else if (v > 0) display.setPixel(x, y, round(ir), round(ig), round(ib));
        else display.setPixel(x, y, round(min(255, gr * 2.6)), round(min(255, gg * 2.6)), round(min(255, gb * 2.6)));
      }
    const g = SMALL[LIST[m]].split(" "), cue = stored && m === S.cue;
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 3; q++)
        if (g[r][q] === "#") {
          if (cue) display.setPixel(x0 + q, LAB + r, 255, 255, 255);
          else if (stored) display.setPixel(x0 + q, LAB + r, round(ir * 0.8), round(ig * 0.8), round(ib * 0.8));
          else display.setPixel(x0 + q, LAB + r, 60, 60, 60);
        }
  }
}
