// ===== Patternflow pattern =====
// Title:   Bak-Sneppen
// Family:  data
// Idea:    Sixty-four species stand on a ring as bars of fitness, and every step the least fit one and its two neighbours are redrawn at random, so the floor of the bars climbs by itself to a threshold near two thirds while fresh colours break out in avalanches around the hopping minimum.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bak-Sneppen model of evolution (Per Bak and Kim Sneppen, 1993), with its random-neighbour version (Henrik Flyvbjerg, Kim Sneppen and Per Bak, 1993), pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Random=0..1, Memory=0..1
//
// Knob 1: Hue. Turns the colours of age round the wheel together. At 0 a bar just redrawn is pale gold, then orange, rose and violet as it waits, and a bar left alone for long is deep blue; the gap line and the marked minimum are aqua. At 0.25 fresh bars are lime and old ones crimson; at 0.5 fresh is aqua and old is gold; at 0.75 fresh is pink and old is green.
// Knob 2: Speed. Steps of the model a second, 25 times the knob, so 50 at 2. Each fresh start first runs a climb: 6,000 steps in 1.8 s, slow at first and faster and faster, so the gap line rises evenly from the bottom to 0.645 on average; then the model walks at the knob's pace for 40 s and the bars are thrown again. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Random. The chance that each of the two neighbours redrawn with the minimum is a species picked anywhere on the ring instead of the one beside it. At 0 the classic ring: the floor settles at 0.62 for 64 species, just under the 0.667 tick of the infinite ring, and avalanches stay local. At 0.25 the floor drops to 0.42, at 0.5 to 0.37, and at 1, the random-neighbour model, to 0.35, just over the 1/3 tick, and fresh bars flicker all over the ring.
// Knob 4: Memory. How many steps a bar takes to turn from fresh to old, on a log scale of its age: 150 steps at 0, 184 at the opening 0.06, 820 at 0.5 and 4,500 at 1. Short memory shows only the avalanche of the last second or two as a bright patch on a blue block; long memory paints each bar by how long ago it was touched, so old avalanches stay as bands of rose and violet.
// Buttons: K1 tap throws all 64 bars again from a uniform start and the climb runs anew.

const W = 64, H = 128, N = 64;
const { floor, round, min, max, abs, log, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The climb: CMAX steps in TC seconds at Speed 2, the step count growing as
// CMAX^u, so the gap, which rises about 0.05 for every doubling of the steps,
// rises evenly. Then RATE * Speed steps a second for CYCLE seconds at Speed 2.
const CMAX = 6000, TC = 1.8, RATE = 25, CYCLE = 40;
// The threshold of the infinite ring (Paczuski, Maslov and Bak, 1996) and of
// the random-neighbour model (Flyvbjerg, Sneppen and Bak, 1993).
const FC = 0.66702, FMF = 1 / 3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, rnd: 0, mem: 0.06,
    f: new Float32Array(N), born: new Float64Array(N), step: 0, m: 0, G: 0,
    ph: "climb", pt: 0, acc: 0,
    // 64 colours of age, plus the gap line, its dim twin, the ticks and the
    // marked minimum.
    pal: new Float32Array(70 * 3), palKey: "",
  };
  throwBars(params.s);
}

// A uniform start: every species gets a fitness drawn at random and counts
// as old, so the bars the climb redraws stand out from the first step.
function throwBars(S) {
  for (let i = 0; i < N; i++) (S.f[i] = Math.random()), (S.born[i] = -1e9);
  S.step = 0;
  S.G = 0;
  S.ph = "climb";
  S.pt = 0;
  S.acc = 0;
  S.m = argmin(S.f);
}

function argmin(f) {
  let m = 0;
  for (let i = 1; i < N; i++) if (f[i] < f[m]) m = i;
  return m;
}

// One step of the model: the least fit species and two others get new
// fitnesses, and the gap, the largest minimum seen since the start, may rise.
function step(S) {
  const f = S.f, m = S.m;
  if (f[m] > S.G) S.G = f[m];
  S.step++;
  const a = Math.random() < S.rnd ? floor(Math.random() * N) : (m + N - 1) % N;
  const b = Math.random() < S.rnd ? floor(Math.random() * N) : (m + 1) % N;
  for (const i of [m, a, b]) (f[i] = Math.random()), (S.born[i] = S.step);
  S.m = argmin(f);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.rnd = cl(k[2], 0, 1);
  S.mem = cl(k[3], 0, 1);
  const d = cl(dt || 0, 0, 0.1), v = S.speed / 2;
  if (input.btnPressed && input.btnPressed[0]) throwBars(S);
  S.pt += d * v;
  if (S.ph === "climb") {
    const u = min(1, S.pt / TC), target = round(pow(CMAX, u)) - 1;
    while (S.step < target) step(S);
    if (u >= 1) (S.ph = "walk"), (S.pt = 0);
  } else {
    S.acc += d * RATE * S.speed;
    while (S.acc >= 1) step(S), (S.acc -= 1);
    if (S.pt > CYCLE) throwBars(S);
  }
}

// Colours of age: index 0 is a bar redrawn this step, 63 a bar older than
// the memory. Then 64 the gap line, 65 the line's dim twin over the dark,
// 66 the threshold ticks, 67 the marked minimum, 68 the pointer above it.
function palette(S) {
  const key = S.hue + ":" + S.mem;
  if (key === S.palKey) return;
  S.palKey = key;
  const P = S.pal, h = S.hue + 0.14;
  for (let i = 0; i < 64; i++) {
    const u = i / 63;
    // Warm white, gold, orange, rose and violet to deep blue; the value
    // stays above 0.55, and old ages near orange and yellow stay brighter
    // still, so no age turns brown or olive whatever the hue.
    const hh = h - 0.48 * pow(u, 0.8), dw = abs(hh - floor(hh) - 0.11), warm = max(0, 1 - min(dw, 1 - dw) / 0.14);
    hsv(hh, 0.4 + 0.48 * min(1, u * 3), min(1, (1 - 0.45 * u) * (1 + 0.55 * warm * u)), P, i * 3);
  }
  hsv(h + 0.38, 0.3, 1, P, 64 * 3);
  hsv(h + 0.38, 0.45, 0.6, P, 65 * 3);
  hsv(h, 0.05, 1, P, 66 * 3);
  hsv(h + 0.38, 0.55, 1, P, 67 * 3);
  hsv(h + 0.38, 0.6, 0.45, P, 68 * 3);
}

const row = (f) => cl(round(H - f * H), 0, H - 1);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const P = S.pal, f = S.f, born = S.born, step = S.step;
  // Ages on a log scale up to the memory, 150 to 4,500 steps.
  const M = 150 * pow(30, S.mem), lm = log(1 + M);
  const yG = S.G > 0 ? row(S.G) : -1, y1 = row(FC), y2 = row(FMF);
  for (let x = 0; x < W; x++) {
    const top = row(f[x]), mark = x === S.m;
    const c = min(63, round((63 * log(1 + step - born[x])) / lm)) * 3;
    // Every other bar a shade darker, so 64 bars read as 64 and not a block.
    const sh = x & 1 ? 0.86 : 1;
    for (let y = 0; y < H; y++) {
      let o = -1, s = 1;
      if (y >= top) {
        o = mark ? 67 * 3 : c;
        s = y === top ? 1.12 : sh;
      } else if (mark) o = 68 * 3;
      if (y === yG) o = y >= top ? 64 * 3 : 65 * 3;
      if ((y === y1 || y === y2) && (x < 3 || x > W - 4)) o = 66 * 3;
      if (o < 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      // Channels in steps of 4 of 255: too fine to see, and a frame packs smaller.
      display.setPixel(x, y, min(255, round((P[o] * s) / 4) * 4), min(255, round((P[o + 1] * s) / 4) * 4), min(255, round((P[o + 2] * s) / 4) * 4));
    }
  }
}
