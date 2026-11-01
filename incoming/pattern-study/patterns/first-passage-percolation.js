// ===== Patternflow pattern =====
// Title:   First-Passage Percolation
// Family:  sim
// Idea:    Every edge of the 64x128 lattice gets a random passage time, each LED's arrival time from a seed is the least total time over all paths to it, and the ball of LEDs reached by time t grows over the panel with a rough rim, banded by its isochrones and grained by the passage times themselves, nearly round for exponential times and a diamond with flat diagonal facets when four edges in five share the least time.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: first-passage percolation (John Hammersley and Dominic Welsh, 1965), its convex limit shape (J. Theodore Cox and Richard Durrett, 1981) and the flat facets an atom at the least time gives it (Richard Durrett and Thomas Liggett, 1981), the Eden model, the same growth with exponential times on sites (Murray Eden, 1961), the rough front of a row source, believed to be in the Kardar-Parisi-Zhang class (Mehran Kardar, Giorgio Parisi and Yi-Cheng Zhang, 1986), arrival times by Dijkstra's algorithm (Edsger Dijkstra, 1959), pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Law=0..1, Source=0..1
//
// Knob 1: Hue. Turns the ball's ramp round the wheel. At 0 the LEDs by the seed are teal and the bands run out through blue to violet, magenta at the far corners; at 0.5 they run from red through orange to yellow-green.
// Knob 2: Speed. How fast the ball grows. At the opening 2 it covers 86% of the panel 8.6 s after its seed lights, at 0.2 it takes 86 s and at 3 it takes 5.7 s. The full ball stands for 1.2 s at 2, fades, and a new sample starts from the seed; the first sample opens already 1.4 s grown.
// Knob 3: Law. The passage-time distribution. At 0 exponential, at 0.5 uniform on 0..2, and from there an atom at the least time grows while the least time rises to 1: at 1 four edges in five take exactly 1 and the rest are spread over 1 to 4. Past 0.9 the atom is above 0.6447, the threshold of directed bond percolation on the square lattice, and the ball becomes a diamond whose diagonal sides are flat facets. Every law fills the panel in the same time; only the shape and the grain change.
// Knob 4: Source. Where the fire starts, a third of the knob each: the LED in the middle of the panel, the bottom-left corner, which shows a quarter of the shape 128 rows long, or the whole bottom row, whose front climbs the panel as a rough interface.

// Hammersley and Welsh put an independent random time on every edge of the
// lattice and asked how long the quickest path from one site to another
// takes. The arrival time T(x) from the seed is that least total over every
// path, and the ball {T <= t} is everything reached by time t. Cox and
// Durrett showed it grows linearly, t B, towards a convex shape B. B is not
// a disc: it keeps the lattice's imprint, and Durrett and Liggett showed
// that a law with an atom at its least value, heavy enough that edges of
// that value alone percolate along directed paths, makes B touch the
// diamond |x| + |y| <= 1 along whole segments of its edges: flat facets
// around the diagonals.
//
// Each sample draws one uniform number per edge, the passage time is that
// number sent through the law's quantile function, and Dijkstra's
// algorithm with a binary heap finds every T at once. Changing the law
// keeps the uniform numbers and only runs Dijkstra again. Then time only
// reveals what is already worked out: an LED lights when the reveal passes
// its T.
//
// The reveal runs in units of the sample's own arrival time at 86% of the
// panel, so every law and every source fills the panel in the same time.
//
// The colour is a ramp in T cut into bands of equal time, so the band edges
// are isochrones, each band brightening outwards to the next one. Every LED
// is shaded by the edge the fire came in by, bright for a fast edge and dim
// for a slow one by the edge's uniform number, and alike for every edge in
// the atom, so the grain of the picture is the passage times themselves.
//
// With the whole bottom row lit at the start the front is a rough interface
// instead of a ball, and its roughness is believed to grow as t^(1/3), the
// Kardar-Parisi-Zhang exponent.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Hue of the oldest band, how far the ramp turns from the seed to the rim
// at the 86% reveal, and the number of bands over that same stretch.
const HUE0 = 0.47, HSPAN = 0.32, BANDS = 9;
// Seconds of reveal at Speed 1 until 86% of the panel is lit, the share
// itself, the stand and the fade after the last LED is reached (seconds at
// Speed 2), and how far along the first sample opens.
const T86 = 17.2, Q86 = 0.86, HOLD = 1.2, FADE = 0.7, A0 = 0.167;
// The atom's mass at Law 1. Directed bond percolation on the square
// lattice needs 0.6447, which the atom passes at Law 0.903.
const ATOM = 0.8;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, law: 0, src: 0, key: "", age: 0, phase: 0,
    // Uniform numbers of the right and down edge of every LED.
    uR: new Float32Array(N), uD: new Float32Array(N),
    T: new Float64Array(N), inU: new Float32Array(N), t86: 1, tmax: 1,
    // Per-LED jitter of hue and saturation, and the dark ground's noise.
    jh: new Float32Array(N), js: new Float32Array(N), dark: new Uint8Array(N * 3),
    heap: new Int32Array(4 * N + 8), hk: new Float64Array(4 * N + 8), done: new Uint8Array(N),
    c: [0, 0, 0],
  };
  params.s.T.fill(1e30);
  sample(params.s);
  // The first sample opens already a few LEDs across.
  params.s.age = A0;
}

function sample(S) {
  const R = Math.random;
  for (let i = 0; i < N; i++) {
    S.uR[i] = R();
    S.uD[i] = R();
    S.jh[i] = R() - 0.5;
    S.js[i] = R();
    S.dark[i * 3] = floor(R() * 25);
    S.dark[i * 3 + 1] = floor(R() * 25);
    S.dark[i * 3 + 2] = floor(R() * 25);
  }
  S.key = "";
  S.age = 0;
  S.phase = 0;
}

// The law's quantile function: exponential at 0, uniform on 0..2 at 0.5,
// and from there an atom of mass up to ATOM at a least time rising to 1,
// the rest spread up to 4.
function quantile(u, law) {
  if (law <= 0.5) {
    const s = law / 0.5;
    return (1 - s) * -log(1 - u * 0.999999) + s * 2 * u;
  }
  const s = (law - 0.5) / 0.5, p = ATOM * s, m = s, M = 2 + 2 * s;
  return u < p ? m : m + ((u - p) / (1 - p)) * (M - m);
}

// Dijkstra from the seed set, lazy deletion on a binary heap.
function solve(S) {
  const T = S.T, inU = S.inU, done = S.done, hp = S.heap, hk = S.hk, law = S.law;
  const wR = new Float32Array(N), wD = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    wR[i] = quantile(S.uR[i], law);
    wD[i] = quantile(S.uD[i], law);
  }
  // Edges in the atom all take the least time: they shade alike.
  const pa = law > 0.5 ? (ATOM * (law - 0.5)) / 0.5 : 0;
  T.fill(1e30);
  done.fill(0);
  let n = 0;
  const push = (v, k) => {
    let j = n++;
    while (j > 0) {
      const p = (j - 1) >> 1;
      if (hk[p] <= k) break;
      hp[j] = hp[p];
      hk[j] = hk[p];
      j = p;
    }
    hp[j] = v;
    hk[j] = k;
  };
  const seeds = [];
  if (S.src === 0) seeds.push((H >> 1) * W + (W >> 1));
  else if (S.src === 1) seeds.push((H - 1) * W);
  else for (let x = 0; x < W; x++) seeds.push((H - 1) * W + x);
  for (const i of seeds) {
    T[i] = 0;
    inU[i] = 0;
    push(i, 0);
  }
  while (n > 0) {
    const v = hp[0], k = hk[0];
    n--;
    if (n > 0) {
      const lv = hp[n], lk = hk[n];
      let j = 0;
      for (;;) {
        let c = 2 * j + 1;
        if (c >= n) break;
        if (c + 1 < n && hk[c + 1] < hk[c]) c++;
        if (hk[c] >= lk) break;
        hp[j] = hp[c];
        hk[j] = hk[c];
        j = c;
      }
      hp[j] = lv;
      hk[j] = lk;
    }
    if (done[v] || k > T[v]) continue;
    done[v] = 1;
    const x = v % W, y = (v / W) | 0;
    // The four edges: right and down are v's own, left and up its
    // neighbours'.
    for (let d = 0; d < 4; d++) {
      let u, w, e;
      if (d === 0) { if (x === W - 1) continue; u = v + 1; e = S.uR[v]; w = wR[v]; }
      else if (d === 1) { if (x === 0) continue; u = v - 1; e = S.uR[u]; w = wR[u]; }
      else if (d === 2) { if (y === H - 1) continue; u = v + W; e = S.uD[v]; w = wD[v]; }
      else { if (y === 0) continue; u = v - W; e = S.uD[u]; w = wD[u]; }
      const nt = k + w;
      if (nt < T[u]) {
        T[u] = nt;
        inU[u] = e < pa ? 0 : e;
        push(u, nt);
      }
    }
  }
  // The arrival time that 86% of the panel beats, and the last one.
  const sorted = Float64Array.from(T).sort();
  S.t86 = max(1e-6, sorted[floor(Q86 * (N - 1))]);
  S.tmax = sorted[N - 1];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.law = round(cl(k[2] || 0, 0, 1) * 100) / 100;
  S.src = min(2, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 3));
  const key = S.law + "/" + S.src;
  if (key !== S.key) {
    S.key = key;
    solve(S);
  }
  // age: reveal in units of the 86% arrival time; phase: seconds after the
  // ball is full.
  if (S.phase === 0) {
    S.age += (d * S.speed) / T86;
    if (S.age * S.t86 >= S.tmax) S.phase = 1e-6;
  } else {
    S.phase += d * S.speed * 0.5;
    if (S.phase > HOLD + FADE) sample(S);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.T, inU = S.inU, jh = S.jh, js = S.js, dk = S.dark, c = S.c;
  const theta = S.age * S.t86, band = S.t86 / BANDS, glow = band * 0.45;
  const fade = S.phase > HOLD ? 1 - (S.phase - HOLD) / FADE : 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, t = T[i];
      if (t > theta) {
        display.setPixel(x, y, dk[i * 3], dk[i * 3 + 1], dk[i * 3 + 2]);
        continue;
      }
      const r = t / S.t86, f = t / band - floor(t / band);
      // Ramp along T, bands brightening outwards, grain from the edge the
      // fire came in by.
      const hue = S.hue + HUE0 + HSPAN * min(1.2, r) + 0.07 * jh[i];
      const sat = 0.68 + 0.3 * js[i];
      let v = (0.4 + 0.6 * f * f) * (1 - 0.4 * inU[i]);
      hsv(hue, sat, v, c);
      // A fresh LED flashes towards white.
      const a = theta - t;
      if (a < glow) {
        const g = 1 - a / glow;
        c[0] += (1 - c[0]) * g * 0.8;
        c[1] += (1 - c[1]) * g * 0.8;
        c[2] += (1 - c[2]) * g * 0.8;
      }
      v = fade * 255;
      let R = c[0] * v, G = c[1] * v, B = c[2] * v;
      if (fade < 1) {
        R = max(R, dk[i * 3]);
        G = max(G, dk[i * 3 + 1]);
        B = max(B, dk[i * 3 + 2]);
      }
      display.setPixel(x, y, round(R), round(G), round(B));
    }
}
