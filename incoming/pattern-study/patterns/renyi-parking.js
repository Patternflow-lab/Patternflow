// ===== Patternflow pattern =====
// Title:   Rényi Parking
// Family:  data
// Idea:    Each of the 128 rows is a street 60 LEDs long where cars of one length arrive at random points and park only where they fit; the streets scroll down, so the panel runs from empty streets at the top through filling ones to jammed ones at the bottom, packed to about 73% as Rényi's parking problem says, with the latecomers that squeezed into the last gaps lit warm and a gauge at the side holding the last 128 jammed streets against the prediction.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rényi's parking problem (Alfréd Rényi, 1958), with its lattice form, Flory's dimers (Paul Flory, 1939)
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Length=6..15, Lattice=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the first cars to park are azure, later ones violet and rose, and the last ones, squeezed into gaps barely a car long, gold; the gauge's tick is gold too.
// Knob 2: Speed. How fast the streets scroll: 2 rows a second times the knob, so at 2 a street takes 32 seconds from empty at the top to jammed at the bottom, and at 0.2 over five minutes.
// Knob 3: Length. The car length in LEDs, 6 to 15 in whole LEDs, so a street is 10 to 4 car lengths long. A street x car lengths long holds 0.7476 x - 0.2524 cars on average once jammed, 7.224 at 6 LEDs, so the share it fills falls from 0.722 at 6 LEDs to 0.686 at 15; the gold tick moves with it.
// Knob 4: Lattice. Below 0.07 cars park anywhere. Above it they may only stop on a grid of k points to a car length, k = 1 / Lattice rounded: 4 points at 0.25, where a jammed street of 6-LED cars fills 0.784; 2 at 0.5, Flory's dimers, 0.851 here and 1 - e^-2 = 0.865 on an endless street; from 0.67 up every car has its own bay and every bay fills, which for 6-LED cars is the whole street.
// Buttons: K1 tap stops the streets and slides every car to the left end of its street, so each row becomes a bar as long as its fill and the ragged right edge draws how a street fills as it travels down; the gold line is the prediction, and the bars of the jammed rows stand along it. Three seconds later the cars slide back and the streets move on.

const W = 64, H = 128, S = 60, MAXC = 32, GX = 61;
// Rényi's constant, the share an endless street fills once jammed.
const C = 0.7475979202534114;
const { min, max, floor, ceil, round, log, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The street's own clock: t car arrivals have been tried per car length of
// street by the time it has come down tau rows. It runs slowly at the top
// and without end at row 127, so every street leaves the panel jammed.
// With 6-LED cars a street is on average 0.29 full at row 42 (t = 0.45),
// 0.54 at row 85 (t = 1.8) and 0.70 at row 120, and from there to the
// bottom the few cars that still fit squeeze in: the slow end of the
// filling, which on an endless street never stops.
const A = 0.9;
const clockAt = (tau) => (tau >= H - 1 ? Infinity : (A * tau) / (H - 1 - tau));

// The mean number of cars a jammed street holds. Parked anywhere, a street
// x car lengths long holds M(x), where M = 0 below 1 and
// M(x) = 1 + 2/(x - 1) times the integral of M from 0 to x - 1, since the
// first car splits the street into two streets of random length. That is
// solved here in steps of 1/2048 of a car: 7.2236 cars at x = 10, the
// 6-LED cars, a fill of 0.7224. Rényi's C (x + 1) - 1 agrees with it to
// 1e-5 from x = 6 up and is 0.0045 cars low at x = 4. On a grid of N
// points with k to a car the same split gives M(n) = 1 + 2/(n - k + 1)
// times the sum of M(j) for j <= n - k, summed exactly.
function renyi(x) {
  const h = 1 / 2048, n = round(x / h), one = 2048;
  if (n < one) return 0;
  const m = new Float64Array(n + 1), area = new Float64Array(n + 1);
  for (let i = one; i <= n; i++) {
    // area[i] is the integral of M from 1 to i h by trapezoids, M being 0
    // below 1 and jumping to 1 there.
    m[i] = i === one ? 1 : 1 + (2 / (i * h - 1)) * area[i - one];
    if (i > one) area[i] = area[i - 1] + (h * (m[i] + m[i - 1])) / 2;
  }
  return m[n];
}
function predict(L, k) {
  if (!k) return (renyi(S / L) * L) / S;
  const N = floor((S * k) / L + 1e-9), m = new Float64Array(N + 1);
  let sum = 0;
  for (let n = 0; n <= N; n++) {
    if (n >= k) sum += m[n - k];
    m[n] = n < k ? 0 : 1 + (2 * sum) / (n - k + 1);
  }
  return (m[N] * L) / S;
}

function newStreet() {
  return { pos: new Float32Array(MAXC), at: new Float32Array(MAXC), n: 0, L: 6, k: 0, F: 0, next: 0, last: 1 };
}

// Where a car can still stop: for every gap the start points that leave room
// for it, as a length in LEDs (anywhere) or a count of grid points (on a
// grid). With pick >= 0 it returns the start point that far into them.
// rate() turns the total into tries that succeed per unit of the street's
// clock: one try per car length of street, spread evenly.
function feasible(st, pick) {
  const { pos, n, L, k } = st;
  let total = 0, start = 0;
  if (!k) {
    for (let i = 0; i <= n; i++) {
      const end = i < n ? pos[i] : S, room = end - start - L;
      if (room > 0) {
        if (pick >= 0 && pick < total + room) return start + (pick - total);
        total += room;
      }
      if (i < n) start = pos[i] + L;
    }
  } else {
    const d = L / k, N = floor((S * k) / L + 1e-9);
    for (let i = 0; i <= n; i++) {
      const end = i < n ? round(pos[i] / d) : N, room = end - start - k + 1;
      if (room > 0) {
        if (pick >= 0 && pick < total + room) return (start + floor(pick - total)) * d;
        total += room;
      }
      if (i < n) start = round(pos[i] / d) + k;
    }
  }
  return pick >= 0 ? -1 : total;
}

const rate = (st) => (st.k ? st.F / st.k : st.F / st.L);

function reset(st, L, k, pred) {
  st.n = 0;
  st.L = L;
  st.k = k;
  // The share parked when the last car is due to come, so the colours run
  // from the first car to the last whatever the length.
  st.last = max(0.05, pred - L / S);
  st.F = feasible(st, -1);
  st.next = -log(1 - Math.random()) / rate(st);
}

// Run a street's clock on to t: a try that lands in a feasible stretch
// parks a car at a uniform place in it. Tries that land anywhere else are
// turned away and change nothing, so only the successes are drawn, at the
// rate of the feasible stretch. Each car keeps the share of the street that
// was already parked when it came.
function advance(st, t) {
  while (st.F > 0 && st.next <= t) {
    const x = feasible(st, Math.random() * st.F);
    if (x < 0) break;
    let i = st.n;
    while (i > 0 && st.pos[i - 1] > x) (st.pos[i] = st.pos[i - 1]), (st.at[i] = st.at[i - 1]), i--;
    st.pos[i] = x;
    st.at[i] = (st.n * st.L) / S;
    st.n++;
    st.F = feasible(st, -1);
    if (st.F > 0) st.next += -log(1 - Math.random()) / rate(st);
  }
}

export function setup(params) {
  const streets = [];
  for (let i = 0; i < H; i++) streets.push(newStreet());
  params.s = {
    streets, head: 0, phase: 0.5, primed: false,
    hue: 0, speed: 2, L: 6, k: 0, pred: predict(6, 0),
    // The fills of the last 128 jammed streets of the current length and
    // grid, as they leave the bottom.
    outs: new Float32Array(H), outN: 0, outI: 0,
    pack: -1, rgb: new Float32Array(W * H * 3), pal: new Float32Array(33 * 3), palHue: NaN,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, kv = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = kv[0];
  P.speed = cl(kv[1], 0.2, 3);
  const L = round(cl(kv[2], 6, 15)), g = cl(kv[3], 0, 1), k = g < 0.07 ? 0 : max(1, round(1 / g));
  if (L !== P.L || k !== P.k) {
    P.L = L;
    P.k = k;
    P.pred = predict(L, k);
    P.outN = P.outI = 0;
  }
  // The first frame fills the panel with streets at every stage, each run
  // on to the clock of its row, so the picture starts whole.
  if (!P.primed) {
    for (let r = 0; r < H; r++) {
      const st = P.streets[(P.head + r) % H];
      reset(st, L, k, P.pred);
      advance(st, clockAt(r + P.phase));
    }
    P.primed = true;
  }
  if (input.btnPressed && input.btnPressed[0] && P.pack < 0) P.pack = 0;
  if (P.pack >= 0) {
    // The tap: 0.6 s to pack, 3 s held, 0.6 s back; the streets wait.
    P.pack += d;
    if (P.pack >= 4.2) P.pack = -1;
    return;
  }
  P.phase += d * P.speed * 2;
  while (P.phase >= 1) {
    P.phase -= 1;
    // The jammed bottom street leaves and comes back empty at the top.
    const bottom = P.streets[(P.head + H - 1) % H];
    if (bottom.L === P.L && bottom.k === P.k) {
      P.outs[P.outI] = (bottom.n * bottom.L) / S;
      P.outI = (P.outI + 1) % H;
      P.outN = min(H, P.outN + 1);
    }
    P.head = (P.head + H - 1) % H;
    reset(bottom, L, k, P.pred);
  }
  for (let r = 0; r < H; r++) advance(P.streets[(P.head + r) % H], clockAt(r + P.phase));
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.primed) return;
  const { rgb, pal } = P;
  if (P.palHue !== P.hue) {
    // 33 steps from the first car to come to the last: azure through
    // violet and rose to gold, brighter as it goes, so the latecomers read
    // first. Between orange and lime a dim car would read brown or olive,
    // so there the dim end is lifted.
    for (let i = 0; i <= 32; i++) {
      const u = i / 32, h = P.hue + 0.58 + 0.55 * u, band = max(0, 1 - abs(h - floor(h) - 0.14) / 0.13);
      const v = 0.6 + 0.4 * u;
      hsv(h, 0.75 - 0.1 * u, max(v, v + (0.92 - v) * band), pal, i * 3);
    }
    P.palHue = P.hue;
  }
  rgb.fill(0);
  const e = P.pack < 0 ? 0 : P.pack < 0.6 ? sm(P.pack / 0.6) : P.pack < 3.6 ? 1 : sm((4.2 - P.pack) / 0.6);
  for (let r = 0; r < H; r++) {
    const st = P.streets[(P.head + r) % H], L = st.L;
    for (let i = 0; i < st.n; i++) {
      // A car covers the LEDs whose centres fall inside it, less half an
      // LED at each end: L - 1 LEDs and a dark one, so cars that touch
      // still read as two.
      const x = st.pos[i] + (i * L - st.pos[i]) * e, x0 = max(0, ceil(x)), x1 = min(S - 1, ceil(x + L - 1) - 1);
      const c = min(32, round((st.at[i] / st.last) * 32)) * 3;
      for (let px = x0; px <= x1; px++) {
        const q = (r * W + px) * 3;
        (rgb[q] = pal[c]), (rgb[q + 1] = pal[c + 1]), (rgb[q + 2] = pal[c + 2]);
      }
    }
  }
  const gold = [];
  hsv(P.hue + 0.13, 0.7, 1, gold, 0);
  // Packed, the gold line stands at the predicted fill across the streets.
  if (e > 0.5) {
    const gx = min(S - 1, floor(P.pred * S));
    for (let r = 0; r < H; r++) {
      const q = (r * W + gx) * 3;
      (rgb[q] = gold[0]), (rgb[q + 1] = gold[1]), (rgb[q + 2] = gold[2]);
    }
  }
  // The gauge, three LEDs wide, from a fill of 0.65 at the bottom to 1 at
  // the top: a bar to the mean of the last jammed streets, a white tick at
  // Rényi's constant for an endless street and a gold one at the
  // prediction for this one.
  const rowOf = (f) => cl(round(H - 1 - ((f - 0.65) / 0.35) * (H - 1)), 0, H - 1);
  if (P.outN) {
    let s = 0;
    for (let i = 0; i < P.outN; i++) s += P.outs[i];
    const top = rowOf(s / P.outN);
    for (let y = top; y < H; y++)
      for (let x = GX; x < W; x++) {
        const q = (y * W + x) * 3;
        (rgb[q] = 0.36), (rgb[q + 1] = 0.4), (rgb[q + 2] = 0.5);
      }
  }
  const tick = (f, c) => {
    const y = rowOf(f);
    for (let x = GX - 1; x < W; x++) {
      const q = (y * W + x) * 3;
      (rgb[q] = c[0]), (rgb[q + 1] = c[1]), (rgb[q + 2] = c[2]);
    }
  };
  tick(C, [0.85, 0.85, 0.85]);
  tick(P.pred, gold);
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, min(255, rgb[q] * 255), min(255, rgb[q + 1] * 255), min(255, rgb[q + 2] * 255));
}
