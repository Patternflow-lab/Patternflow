// ===== Patternflow pattern =====
// Title:   Lonely Runner
// Family:  rhythm
// Idea:    Runners at distinct whole-number speeds climb side by side round a track that is the panel's 128 rows wrapped top to bottom, each a bold bar in its own lane carrying a zone of 128/k rows either way, and whenever no other runner is inside its zone the runner is lonely, so its zone lights up and its bar burns white; with speeds 1 to k they all go lonely together, equally spaced round the track, and with scattered speeds the flares come one by one at odd times.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the lonely runner conjecture (Jörg M. Wills, 1967; Thomas Cusick, 1973), proven for up to seven runners by Javier Barajas and Oriol Serra (2008), pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Runners=3..8, Scatter=0..1
//
// Knob 1: Hue. Turns the runners' colours round the wheel together: at 0 three runners are cyan, magenta and yellow; at 0.25 violet, orange and green; at 0.5 red, green and blue. With more runners the colours sit closer together round the same wheel.
// Knob 2: Speed. At 2 the fastest runner laps in 1.8 seconds; with speeds 1, 2 and 3 the slowest laps in 5.4, and then all three are back on the line together and the race goes round again. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Runners. How many run, 3 to 8, each in its own lane, and the zone shrinks to 128/k rows either way: 43 rows with three, 16 with eight. Turning it starts a new race from the line at the bottom. With eight at speeds 1 to 8 the first lonely moment is a staircase of all eight bars, 1.8 seconds in.
// Knob 4: Scatter. Below 0.2 the speeds are 1, 2, ... k, the case where all the runners go lonely together. In four steps up to 1 they become k different whole numbers drawn from 1 to k+3, k+6, k+9 and k+12, and the lonely moments break apart into single flares, some held for a second or more. Each step starts a new race.

const W = 64, H = 128;
const { floor, min, max, abs, round, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The fastest runner's lap, in story seconds (one a second at Speed 2). The
// slowest runner's lap is the whole race, since every speed is a whole
// number: at its end all of them are back on the line together.
const LAP_FAST = 1.8;
// A runner's bar, in rows, and the row its middle starts on: the bars stand
// on the bottom edge at the start.
const BAR = 14, START = H - BAR / 2;
// Lonely means no other runner nearer than 1/k of a lap, either way round.
// With speeds 1..k the nearest neighbours reach exactly 1/k for a single
// instant, which no frame would ever land on, so the check runs at 24
// moments inside each frame and allows half an LED row (1/256 of a lap).
const SUB = 24, TOL = 1 / 256;
// How long a flare takes to fade after the runner stops being lonely.
const FADE = 0.35;
// The tail behind a bar is this many story seconds of its running.
const TAIL = 0.25;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, k: 0, level: -1,
    v: [], pos: new Float32Array(8), flare: new Float32Array(8), lonely: new Uint8Array(8),
    lane: new Int8Array(W), shade: new Float32Array(W), col: [], colHue: NaN, colK: 0,
  };
}

// A small fixed hash, so each Scatter step draws the same speeds every time.
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The speeds for k runners at Scatter step L: 1..k at step 0, otherwise k
// distinct whole numbers from 1..k+3L, shuffled by a fixed seed and sorted
// so the slowest runs in the left lane.
function speeds(k, L) {
  const pool = [];
  for (let i = 1; i <= k + 3 * L; i++) pool.push(i);
  if (L > 0)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = floor(hash(k * 101 + L * 7 + i * 13) * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
  return pool.slice(0, k).sort((a, b) => a - b);
}

// A new race: lanes for k runners with a dark LED between them, and every
// runner back on the line.
function restart(S, k, L) {
  S.k = k;
  S.level = L;
  S.v = speeds(k, L);
  S.t = 0;
  S.flare.fill(0);
  for (let x = 0; x < W; x++) {
    const j = floor((x * k) / W);
    const edge = round(((j + 1) * W) / k) - 1;
    S.lane[x] = x === edge && j < k - 1 ? -1 : j;
    const x0 = round((j * W) / k), u = (x - x0 + 0.5) / (edge - x0 + 1);
    S.shade[x] = 0.62 + 0.38 * (1 - (2 * u - 0.7) ** 2 / 1.69);
  }
}

// Nearest distance from runner i to any other, as a share of a lap, for
// the race at story time t.
function nearest(S, i, t, P) {
  const pi = (S.v[i] * t) / P;
  let d = 1;
  for (let j = 0; j < S.k; j++) {
    if (j === i) continue;
    let g = pi - (S.v[j] * t) / P;
    g -= floor(g);
    d = min(d, g, 1 - g);
  }
  return d;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  const k = cl(round(kv[2]), 3, 8), L = min(4, floor(cl(kv[3], 0, 1) * 5));
  if (k !== S.k || L !== S.level) restart(S, k, L);
  const g = (d * S.speed) / 2, P = LAP_FAST * S.v[k - 1], t0 = S.t;
  S.t += g;
  const need = 1 / k - TOL;
  for (let i = 0; i < k; i++) {
    let lonely = 0;
    for (let s = 1; s <= SUB && !lonely; s++) if (nearest(S, i, t0 + (g * s) / SUB, P) >= need) lonely = 1;
    S.lonely[i] = lonely;
    S.flare[i] = lonely ? 1 : S.flare[i] * exp(-g / FADE);
    const p = (S.v[i] * S.t) / P;
    S.pos[i] = p - floor(p);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const k = S.k;
  if (S.colHue !== S.hue || S.colK !== k) {
    S.col = [];
    for (let i = 0; i < k; i++) S.col.push(hsv(0.5 + S.hue + i / k, 0.9, 1));
    S.colHue = S.hue;
    S.colK = k;
  }
  const R = H / k, half = BAR / 2;
  // Each runner's middle row; it climbs, so the row falls as the lap goes on.
  const c = [];
  for (let i = 0; i < k; i++) c.push(START - S.pos[i] * H);
  for (let y = 0; y < H; y++) {
    // Signed distance in rows from each runner, the short way round.
    const dy = [];
    for (let i = 0; i < k; i++) {
      let e = y + 0.5 - c[i];
      e -= H * floor(e / H + 0.5);
      dy.push(e);
    }
    for (let x = 0; x < W; x++) {
      const ln = S.lane[x];
      let r = 0, gg = 0, b = 0;
      for (let i = 0; i < k; i++) {
        const e = dy[i], a = abs(e), cc = S.col[i], f = S.flare[i];
        let v = 0;
        if (ln === i) {
          // The runner's own lane. Its zone shows faintly; while the runner
          // is lonely it lights up, brightest at the runner, its two edges
          // 128/k rows away drawn as lines. With speeds 1..k those edges
          // land exactly on the neighbours' lines: the case is tight.
          if (a < R) {
            v = 0.1;
            if (f > 0.02) v = max(v, f * (a > R - 1 ? 0.9 : 0.15 + 0.5 * (1 - a / R) ** 1.5));
          }
          // A tail below the bar, as long as a quarter second of its running.
          const tail = TAIL * S.v[i] * (H / (LAP_FAST * S.v[k - 1]));
          if (e > half && e < half + tail) v = max(v, 0.7 * (1 - (e - half) / tail) ** 2);
          if (a < half) v = 1;
          else if (a < half + 1) v = max(v, 1 - (a - half));
          // Lit from the left, so a lane reads as a rounded rod.
          v *= S.shade[x];
        } else if (a < 0.5) {
          // Every runner draws a line across the other lanes at its middle,
          // so in each lane you can see who is inside that runner's zone.
          v = 0.55;
        }
        // A lonely runner's bar burns white-hot for a beat.
        const w = ln === i && a < half + 1 ? 0.55 * f * v : 0;
        r += cc[0] * v + w;
        gg += cc[1] * v + w;
        b += cc[2] * v + w;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, gg)), round(255 * min(1, b)));
    }
  }
}
