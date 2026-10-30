// ===== Patternflow pattern =====
// Title:   FRACTRAN
// Family:  number
// Idea:    Conway's PRIMEGAME runs as a bead machine: the exponents of 2, 3, 5 and 7 stand as columns of beads that pump up and down in sawtooth loops while beads rise out of them and fall back in, the first of the fourteen fractions that keeps n whole lights at each step, and whenever n is a bare power of two the machine stops with p beads in the 2 column alone and writes the prime p into the record at the top.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: FRACTRAN and PRIMEGAME (John Horton Conway, 1987, "FRACTRAN: A Simple Universal Programming Language for Arithmetic"), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Start=0..3, Trail=0..1
//
// Knob 1: Hue. Turns every colour together: at 0 the 2 column is gold, 3 cyan, 5 violet and 7 green, the fractions and the state lamps 11 to 29 blue and the record warm white.
// Knob 2: Speed. Steps a second, 2 times 60 to the power (Speed - 0.2) / 1.8: 120 at 2, where 2, 3, 5 and 7 enter the record at 0.2, 1.2, 3.5 and 7.7 s; 2 at 0.2, slow enough to follow every fraction and every bead; 1170 at 3, where 29 arrives at 37 s. On a prime the machine waits for its beads to land and 30 steps more, 0.55 s at 2.
// Knob 3: Start. Where a run begins: n = 2 at 0, then 2^11, 2^19 or 2^29, the states PRIMEGAME is in when it finds those primes, with the primes up to them already in the record. The higher the start, the taller the sawtooth: from 2^29 the 2 and 5 columns climb to 31 beads before 31 arrives at 73 s, and the beads thin from 5 rows to 2. A run ends 3 s after 2^41 and starts again.
// Knob 4: Trail. How long the light stays, 0.05 times 30 to the power Trail seconds. At 0.06 a flying bead leaves almost nothing behind and the tubes show single beads; from 0.4 up each bead draws a full tail, and at 1 the tails last 1.5 s and pile up into lit tubes as bright as their traffic, the fractions glow by how often they fire, and each column keeps a ghost of its last peak that sinks a bead a second.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, exp, pow, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The machine. n is held as its exponents over the ten primes the
// program uses, never as a number. 2, 3, 5 and 7 are the registers; 11 to 29
// never go above 1 and act as the program's state.
const PR = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
const FR = [[17, 91], [78, 85], [19, 51], [23, 38], [29, 33], [77, 29], [95, 23], [77, 19], [1, 17], [11, 13], [13, 11], [15, 2], [1, 7], [55, 1]];
function vec(n) {
  const e = new Int8Array(10);
  for (let i = 0; i < 10; i++) while (n % PR[i] === 0) (n /= PR[i]), e[i]++;
  return e;
}
const NUM = FR.map((f) => vec(f[0])), DEN = FR.map((f) => vec(f[1]));
// Run in Node from n = 2, 2^p first appears at step 19, 69, 281, 710, 2375,
// 3893, 8102, 11361, 19268, 36981, 45680, 75417 and 101354 for p = 2 to 41.
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
const STARTS = [1, 11, 19, 29];

// ---- Digits, 3 by 5.
const DIG = ["###.#.#.#.#.###", ".#.##..#..#.###", "###..#####..###", "###..#.##..####", "#.##.####..#..#", "####..###..####", "####..####.####", "###..#..#.#..#.", "####.#####.####", "####.####..####"];
const textW = (s) => 4 * s.length - 1;

// ---- Layout. The record of primes in two lines at the top, the fourteen
// fractions in two rows of seven, numerator over denominator, the state
// lamps 11 to 29, then the four register columns standing on row 120.
const REC_Y = [1, 7];
const FR_Y = [15, 31];
const ST_Y = 47;
const COL_X = [8, 24, 40, 56], FLOOR = 120, CEIL = 56;
const frX = (k) => 4.5 + 9 * (k % 7);
const frY = (k) => FR_Y[k < 7 ? 0 : 1];
const stX = (j) => 6.5 + 10 * j;
const recPlace = (() => {
  const out = [];
  for (const [line, from, to] of [[0, 0, 7], [1, 7, 13]]) {
    const items = PRIMES.slice(from, to).map(String);
    let x = floor((W - (items.reduce((s, t) => s + textW(t), 0) + 3 * (items.length - 1))) / 2);
    for (const t of items) {
      out.push([x, REC_Y[line]]);
      x += textW(t) + 3;
    }
  }
  return out;
})();

function reset(S) {
  const p = STARTS[S.start];
  S.e = new Int32Array(10);
  S.e[0] = p;
  S.found = PRIMES.filter((q) => q <= p && p > 1).length;
  S.flights = [];
  S.inc = new Int32Array(10);
  S.heat.fill(0);
  S.scan.fill(0);
  S.ghost = new Float32Array(4);
  S.acc = 0;
  S.pause = 0;
  S.flash = 0;
  S.end = 0;
  S.peak = max(12, p + 1);
  S.pitch = min(5, (FLOOR - CEIL) / S.peak);
  S.glow.fill(0);
  S.last = -1;
}

export function setup(params) {
  params.s = { start: -1, hue: 0, rate: 100, trail: 0.06, heat: new Float32Array(14), scan: new Float32Array(14), glow: new Float32Array(NP * 3), rgb: new Float32Array(NP * 3), sheat: new Float32Array(6), gain: 1, hgain: 1, last: -1, dur: 0.3 };
}

// A bead in flight runs up or down its own column: up from the top of the
// stack and out of the column's head when a denominator takes it, down from
// the head onto the stack when a numerator gives it.
function flight(S, j, y0, y1) {
  if (S.flights.length > 240) {
    if (y1 > y0) S.inc[j]--;
    return;
  }
  S.flights.push({ j, y0, y1, u: 0 });
}

function step(S) {
  const e = S.e;
  let k = 0;
  for (; k < 14; k++) {
    let ok = true;
    for (let j = 0; j < 10 && ok; j++) if (e[j] < DEN[k][j]) ok = false;
    if (ok) break;
    // Tried and passed over: its bar flickers.
    S.scan[k] = min(1, S.scan[k] + 0.35);
  }
  S.heat[k] = min(1.6, S.heat[k] + S.hgain);
  S.last = k;
  for (let j = 0; j < 10; j++) {
    e[j] -= DEN[k][j];
    if (j < 4) for (let d = 0; d < DEN[k][j]; d++) flight(S, j, FLOOR - S.pitch * (e[j] + d + 0.5), CEIL - 2);
  }
  for (let j = 0; j < 10; j++) {
    for (let n = 0; n < NUM[k][j]; n++) {
      e[j]++;
      if (j < 4) {
        S.inc[j]++;
        flight(S, j, CEIL - 2, FLOOR - S.pitch * (e[j] - 0.5));
      }
    }
  }
  let bare = e[0] >= 2;
  for (let j = 1; j < 10 && bare; j++) if (e[j]) bare = false;
  if (bare) {
    S.found = PRIMES.indexOf(e[0]) + 1;
    S.flash = 1;
    // Hold until every bead has landed, then a beat more, so the 2 column
    // stands alone with its p beads.
    S.pause = S.dur + cl(30 / S.rate, 0.25, 1.5);
    if (e[0] >= PRIMES[PRIMES.length - 1]) S.end = 3;
  }
  for (let j = 0; j < 4; j++) if (e[j] + 1 > S.peak) S.peak = e[j] + 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const h = S.hue;
  S.cols = [hsv(0.11 + h, 0.6, 1), hsv(0.5 + h, 0.6, 1), hsv(0.8 + h, 0.5, 1), hsv(0.32 + h, 0.6, 1), hsv(0.61 + h, 0.5, 1)];
  S.rate = 2 * pow(60, (cl(k[1], 0.2, 3) - 0.2) / 1.8);
  S.trail = cl(k[3], 0, 1);
  const start = cl(round(k[2]), 0, 3);
  if (start !== S.start) {
    S.start = start;
    reset(S);
  }
  const tau = 0.05 * pow(30, S.trail);
  // A longer trail lays each pass down fainter, so a path's brightness is
  // its traffic, not how long the light stays. At the shortest trail a bead
  // leaves almost nothing behind it and the tubes show single beads.
  S.gain = min(1, 0.35 / tau) * (0.12 + 0.88 * min(1, S.trail / 0.4));
  const htau = max(0.1, tau, 0.6 / S.rate), fade = exp(-d / tau), hfade = exp(-d / htau);
  S.hgain = min(1, 0.12 / htau);
  for (let i = 0; i < NP * 3; i++) S.glow[i] *= fade;
  for (let i = 0; i < 14; i++) S.heat[i] *= hfade;
  const sfade = exp(-d / 0.06);
  for (let i = 0; i < 14; i++) S.scan[i] *= sfade;
  for (let j = 0; j < 6; j++) S.sheat[j] = S.e[4 + j] > 0 ? 1 : S.sheat[j] * exp(-d / 0.08);
  S.flash *= exp(-d / 0.6);
  // A flight takes 0.3 s at speed, up to 0.6 s when the steps come slower.
  const dur = (S.dur = cl(2.2 / S.rate, 0.3, 0.6));
  const live = [];
  S.busy = [0, 0, 0, 0];
  for (const f of S.flights) S.busy[f.j]++;
  for (const f of S.flights) {
    const u0 = f.u;
    f.u = min(1, f.u + d / dur);
    trace(S, f, u0, f.u);
    if (f.u >= 1) {
      if (f.y1 > f.y0) S.inc[f.j]--;
    } else live.push(f);
  }
  S.flights = live;
  if (S.end > 0) {
    S.end -= d;
    if (S.end <= 0) reset(S);
  } else if (S.pause > 0) S.pause -= d;
  else {
    S.acc += S.rate * d;
    for (let guard = 0; S.acc >= 1 && guard < 200; guard++) {
      S.acc--;
      step(S);
      if (S.pause > 0 || S.end > 0) {
        S.acc = 0;
        break;
      }
    }
  }
  S.pitch += (min(5, (FLOOR - CEIL) / S.peak) - S.pitch) * (1 - exp(-d / 0.4));
  for (let j = 0; j < 4; j++) {
    const c = shown(S, j);
    S.ghost[j] = max(c, S.ghost[j] - d * (1 + 40 * (1 - S.trail) * (1 - S.trail)));
  }
}

// The beads a column shows. Below 10 steps a second a given bead joins the
// stack when its flight lands; faster than that a flight outlasts many
// steps, so the stack shows the register as it is and the flights are the
// traffic through it.
const shown = (S, j) => S.e[j] - (S.rate < 10 ? S.inc[j] : 0);

// Falling beads speed up, rising ones slow down, like a ball thrown up.
const fly = (f, u) => f.y0 + (f.y1 - f.y0) * (f.y1 > f.y0 ? u * u : u * (2 - u));

function trace(S, f, u0, u1) {
  const a = fly(f, u0), b = fly(f, u1), col = S.cols[f.j];
  const lo = round(min(a, b)), hi = round(max(a, b)), x = COL_X[f.j];
  for (let y = lo; y <= hi; y++) {
    if (y < 0 || y >= H) continue;
    const w = S.gain * min(1, 14 / S.busy[f.j]) * (0.12 + 0.33 * (f.y1 > f.y0 ? (y - lo + 1) / (hi - lo + 1) : (hi - y + 1) / (hi - lo + 1)));
    for (let dx = -1; dx <= 1; dx++) {
      const o = (y * W + x + dx) * 3, ww = dx ? 0.5 * w : w;
      S.glow[o] += col[0] * ww;
      S.glow[o + 1] += col[1] * ww;
      S.glow[o + 2] += col[2] * ww;
    }
  }
}

function put(S, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  S.rgb[o] += c[0] * a;
  S.rgb[o + 1] += c[1] * a;
  S.rgb[o + 2] += c[2] * a;
}

function text(S, s, x, y, c, a) {
  for (let i = 0; i < s.length; i++) {
    const g = DIG[s.charCodeAt(i) - 48];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "#") put(S, x + 4 * i + q, y + r, c, a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.e) return;
  const h = S.hue, rgb = S.rgb;
  const cols = S.cols, ink = hsv(0.58 + h, 0.45, 1), warm = hsv(0.1 + h, 0.5, 1);
  rgb.fill(0);
  // The record.
  for (let i = 0; i < S.found; i++) {
    const [x, y] = recPlace[i], t = String(PRIMES[i]), lastOne = i === S.found - 1;
    if (lastOne && S.flash > 0.02) for (let yy = y - 1; yy <= y + 5; yy++) for (let xx = x - 1; xx <= x + textW(t); xx++) put(S, xx, yy, cols[0], 0.35 * S.flash);
    text(S, t, x, y, lastOne ? [1, 1, 1] : warm, lastOne ? 0.75 + 0.25 * S.flash : 0.6);
  }
  // The fractions.
  for (let k = 0; k < 14; k++) {
    const x = frX(k), y = frY(k), hk = min(1, max(S.heat[k], k === S.last ? 0.55 : 0)), [a, b] = FR[k].map(String);
    if (hk > 0.02) for (let yy = y - 1; yy <= y + 13; yy++) for (let xx = floor(x - 4); xx <= floor(x + 4); xx++) put(S, xx, yy, ink, 0.16 * hk);
    const lv = 0.2 + 0.8 * hk;
    text(S, a, round(x - textW(a) / 2), y, ink, lv);
    for (let xx = round(x - 3.5); xx < round(x + 3.5); xx++) put(S, xx, y + 6, ink, min(1, lv * 0.8 + 0.6 * S.scan[k]));
    text(S, b, round(x - textW(b) / 2), y + 8, ink, lv);
  }
  // The state lamps.
  for (let j = 0; j < 6; j++) {
    const on = S.e[4 + j] > 0;
    text(S, String(PR[4 + j]), round(stX(j) - 3.5), ST_Y, on ? [1, 1, 1] : cols[4], on ? 0.95 : 0.22 + 0.5 * S.sheat[j]);
  }
  // The columns: a rod, the ghost of the last peak, and the beads.
  const pitch = S.pitch, bh = max(0.8, pitch - 1.4);
  for (let j = 0; j < 4; j++) {
    const c = cols[j], cx = COL_X[j], n = shown(S, j);
    for (let y = CEIL; y <= FLOOR; y++) put(S, cx, y, c, 0.12);
    text(S, String(PR[j]), cx - 1, FLOOR + 2, c, 0.7);
    const top = S.ghost[j];
    for (let i = 0; i < Math.ceil(top); i++) {
      const lit = i < n, yc = FLOOR - pitch * (i + 0.5), a = lit ? 1 : 0.45 * min(1, top - i);
      const glow = j === 0 && S.flash > 0.02 && lit ? S.flash : 0;
      for (let y = floor(yc - bh / 2 - 1); y <= floor(yc + bh / 2 + 1); y++) {
        const cov = cl(min(y + 1, yc + bh / 2) - max(y, yc - bh / 2), 0, 1);
        if (cov <= 0) continue;
        for (let dx = -5; dx <= 5; dx++) {
          const u = dx / 5.6, shade = 0.3 + 0.7 * sqrt(1 - u * u) - 0.25 * (y + 0.5 - yc) / (bh / 2 + 0.5);
          put(S, cx + dx, y, c, a * cov * cl(shade, 0, 1) * 0.85);
          if (glow) put(S, cx + dx, y, [1, 1, 1], 0.5 * glow * cov);
        }
      }
    }
  }
  // Beads in flight: a small bright bead at the head of each trail.
  // A crowded column dims its heads, so fast traffic reads as a lit tube in
  // the column's colour rather than as white.
  const busy = [0, 0, 0, 0];
  for (const f of S.flights) busy[f.j]++;
  for (const f of S.flights) {
    const y = fly(f, f.u), c = S.cols[f.j], a = min(1, 14 / busy[f.j]);
    const core = [0.5 + 0.5 * c[0], 0.5 + 0.5 * c[1], 0.5 + 0.5 * c[2]];
    for (let dy = 0; dy < 2; dy++) for (let dx = -2; dx <= 2; dx++) put(S, COL_X[f.j] + dx, round(y) + dy - 1, abs(dx) < 2 ? core : c, a * (abs(dx) < 2 ? 0.85 : 0.5));
  }
  // The trails keep their colour: a pixel's glow is held under 0.7 of full,
  // hue kept, so heavy traffic makes a coloured tube and not a white one.
  for (let p = 0; p < NP * 3; p += 3) {
    const g = S.glow, m = max(g[p], g[p + 1], g[p + 2]), q = m > 0.7 ? 0.7 / m : 1;
    rgb[p] += g[p] * q;
    rgb[p + 1] += g[p + 1] * q;
    rgb[p + 2] += g[p + 2] * q;
  }
  for (let p = 0; p < NP; p++) {
    const o = p * 3;
    display.setPixel(p % W, floor(p / W), min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
  }
}
