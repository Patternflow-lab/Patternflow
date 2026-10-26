// ===== Patternflow pattern =====
// Title:   Crackling Noise
// Family:  noise
// Idea:    A random-field Ising magnet at zero temperature is swept from all down to all up, one avalanche at a time, and each avalanche of flipped spins crawls out across the dark panel in its own colour, the colour drifting along the sweep, until the panel is a patchwork of clusters of every size; then the field is swept back down, the avalanches go dim in another patchwork, and a new disorder is dealt.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Barkhausen noise (Heinrich Barkhausen, 1919), hysteresis and avalanches in the zero-temperature random-field Ising model (James Sethna, Karin Dahmen, Sivan Kartha, James Krumhansl, Bruce Roberts and Joel Shore, 1993), crackling noise (James Sethna, Karin Dahmen and Christopher Myers, 2001), the critical disorder of the two-dimensional model (Djordje Spasojevic, Sanja Janicevic and Milan Knezevic, 2011), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Disorder=1.05..2.6, Grain=0..1.6
//
// Knob 1: Hue. Turns the whole sweep round the wheel. At 0 the first avalanches are teal and the colour drifts through blue and violet to pink by the last; at 0.5 it starts magenta, reaches red a quarter of the way through and goes on from green to cyan. The dim colours of the way back skip orange, which reads brown.
// Knob 2: Speed. At 2 the panel flips 474 spins a second, so an avalanche of 1000 spins takes 2.1 seconds to crawl out and a whole sweep up takes 17 seconds (the first opens 30% done and ends at 12); 0.2 is ten times slower, 3 half as fast again. The way down runs twice as fast, and the holds of 1.5 s at the top and 1 s at the bottom scale with the knob.
// Knob 3: Disorder. R, the width of the Gaussian random field against a coupling of 1 to each of 4 neighbours. At 0.85 and below one avalanche snaps nine tenths of the 64 x 128 panel (the critical width on an endless lattice is 0.54), so the range starts above it. At 1.05 a sweep is about 130 avalanches, the biggest 1000 to 2000 spins and 16 of 100 or more; at 1.6 about 830 with the biggest near 170; at 2.6 about 2400, four in ten of them a lone spin and none over 50.
// Knob 4: Grain. The correlation length of the field: white noise blurred by a Gaussian of 0 to 1.6 LEDs and scaled back to width R. Below 0.25 the field is uncorrelated, the classic model, and the clusters have ragged edges; at 0.8 they are rounded blobs and there are 2.5 times as many; at 1.6 the field is smooth enough that a flat edge of flipped spins holds still, so the avalanches grow as rectangles nested inside each other.

const W = 64, H = 128, N = W * H;
const { floor, min, abs, sqrt, log, exp, cos, ceil, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Spins flipped per second at Speed 2, and the share of the first sweep
// already done when the pattern opens.
const RATE = 474, OPEN = 0.3;
// Seconds held at the top and at the bottom of the loop, at Speed 2.
const HOLD_UP = 1.5, HOLD_DOWN = 1;
// The hue of a flip is set by how far through the sweep its avalanche started.
const SPAN = 0.62;
// Skips orange through lime, which read brown and olive when dim.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return sqrt(-2 * log(u)) * cos(2 * PI * Math.random());
}

function makeSweep() {
  return {
    seq: new Int16Array(N), // sites in the order they flip
    pos: new Int16Array(N), // where each site is in seq
    av: new Int32Array(N), // the avalanche each site flipped in
    start: new Int32Array(N + 1), // where each avalanche starts in seq
    n: 0, // avalanches
    jit: new Float32Array(N), // per avalanche: hue jitter and saturation
    sat: new Float32Array(N),
    col: new Float32Array(N * 3),
  };
}

export function setup(params) {
  params.s = {
    R: -1, grain: -1, hue: -1, phase: 0, cur: 0, wait: 0, started: false,
    white: new Float64Array(N), h: new Float64Array(N), tmp: new Float64Array(N),
    key: new Float64Array(N), fl: new Uint8Array(N),
    hk: new Float64Array(6 * N), hs: new Int32Array(6 * N),
    up: makeSweep(), dn: makeSweep(),
    bg: new Float32Array(N * 3),
  };
}

function deal(S) {
  for (let i = 0; i < N; i++) S.white[i] = gauss();
  for (const sw of [S.up, S.dn])
    for (let a = 0; a < N; a++) {
      sw.jit[a] = (Math.random() - 0.5) * 0.08;
      sw.sat[a] = 0.5 + 0.45 * Math.random();
    }
}

// The frozen field: the white noise, blurred on the torus by a Gaussian of
// radius grain, then shifted to mean 0 and scaled to standard deviation R.
function makeField(S) {
  const { white, h, tmp } = S, sg = S.grain;
  if (sg < 0.25) h.set(white);
  else {
    const r = ceil(2.5 * sg), k = new Float64Array(2 * r + 1);
    for (let d = -r; d <= r; d++) k[d + r] = exp((-d * d) / (2 * sg * sg));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let d = -r; d <= r; d++) a += k[d + r] * white[y * W + ((x + d + 4 * W) % W)];
        tmp[y * W + x] = a;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let d = -r; d <= r; d++) a += k[d + r] * tmp[((y + d + 4 * H) % H) * W + x];
        h[y * W + x] = a;
      }
  }
  let m = 0, v = 0;
  for (let i = 0; i < N; i++) m += h[i];
  m /= N;
  for (let i = 0; i < N; i++) v += (h[i] -= m) * h[i];
  const f = S.R / sqrt(v / N);
  for (let i = 0; i < N; i++) h[i] *= f;
}

// One branch of the hysteresis loop. Spin i, still down, flips up once
// h_i + H + J (up neighbours - down neighbours) > 0 with J = 1, so its
// key h_i + 2 (up neighbours) - 4 says the field H at which it goes. The
// sweep raises H just to the largest key left, flips that spin, and lets
// the avalanche run at that H, breadth first, each flip adding 2 to the key
// of its neighbours. The way back down is the same sweep for the field -h,
// since flipping every spin and both fields maps one branch onto the other.
// Keys only grow, so a heap with stale entries skipped does the search.
function sweep(S, sw, sign) {
  const { key, fl, hk, hs, h } = S, seq = sw.seq;
  let hn = 0;
  const push = (k, s) => {
    let i = hn++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p] >= k) break;
      hk[i] = hk[p];
      hs[i] = hs[p];
      i = p;
    }
    hk[i] = k;
    hs[i] = s;
  };
  const pop = () => {
    const k = hk[--hn], s = hs[hn];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= hn) break;
      if (c + 1 < hn && hk[c + 1] > hk[c]) c++;
      if (hk[c] <= k) break;
      hk[i] = hk[c];
      hs[i] = hs[c];
      i = c;
    }
    hk[i] = k;
    hs[i] = s;
  };
  fl.fill(0);
  for (let i = 0; i < N; i++) push((key[i] = sign * h[i] - 4), i);
  let pos = 0, n = 0;
  while (pos < N) {
    let i, k;
    do {
      i = hs[0];
      k = hk[0];
      pop();
    } while (fl[i] || k !== key[i]);
    const field = -k;
    sw.start[n] = pos;
    fl[i] = 1;
    seq[pos++] = i;
    for (let q = pos - 1; q < pos; q++) {
      const s = seq[q], x = s % W, y = (s - x) / W;
      for (let d = 0; d < 4; d++) {
        const j = d === 0 ? y * W + ((x + 1) % W) : d === 1 ? y * W + ((x + W - 1) % W) : d === 2 ? ((y + 1) % H) * W + x : ((y + H - 1) % H) * W + x;
        if (fl[j]) continue;
        key[j] += 2;
        if (key[j] + field > 0) {
          fl[j] = 1;
          seq[pos++] = j;
        } else push(key[j], j);
      }
    }
    n++;
  }
  sw.start[n] = N;
  sw.n = n;
  for (let a = 0; a < n; a++) for (let p = sw.start[a]; p < sw.start[a + 1]; p++) {
    sw.av[seq[p]] = a;
    sw.pos[seq[p]] = p;
  }
}

// Colours per avalanche. Up: by where it started in the sweep, a little
// jitter so neighbours from the same moment part, and brightness by size,
// 232 for a lone spin up to 255 from 400 spins. Down: the same drift, dim.
function paint(S) {
  for (const [sw, up] of [[S.up, true], [S.dn, false]]) {
    for (let a = 0; a < sw.n; a++) {
      const m = sw.start[a] / N, size = sw.start[a + 1] - sw.start[a];
      if (up) hsv(wheel(0.27 + S.hue + SPAN * m + sw.jit[a]), sw.sat[a], 0.91 + 0.09 * min(1, log(size) / log(400)), sw.col, a * 3);
      else hsv(wheel(0.6 + S.hue + 0.4 * m + 2 * sw.jit[a]), sw.sat[a] + 0.05, 0.12 + 0.24 * (sw.sat[a] - 0.5), sw.col, a * 3);
    }
  }
}

function rebuild(S) {
  makeField(S);
  sweep(S, S.up, 1);
  sweep(S, S.dn, -1);
  paint(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1.05, 0];
  const d = cl(dt || 0, 0, 0.1), speed = cl(kv[1], 0.2, 3) / 2;
  const R = cl(kv[2], 1.05, 2.6), grain = cl(kv[3], 0, 1.6), hue = cl(kv[0], 0, 1);
  if (!S.started) {
    deal(S);
    S.started = true;
    // The first sweep opens part done, so the patchwork is already there.
    S.cur = OPEN * N;
  }
  if (abs(R - S.R) > 1e-4 || abs(grain - S.grain) > 1e-3) {
    // A new disorder width or grain reshapes the same noise and the
    // sweep stays as far through as it was.
    S.R = R;
    S.grain = grain;
    S.hue = hue;
    rebuild(S);
  } else if (abs(hue - S.hue) > 1e-4) {
    S.hue = hue;
    paint(S);
  }
  // 0 up, 1 held up, 2 down, 3 held down.
  if (S.phase === 0 || S.phase === 2) {
    S.cur += RATE * (S.phase === 2 ? 2 : 1) * speed * d;
    if (S.cur >= N) {
      S.cur = N;
      S.phase++;
      S.wait = S.phase === 1 ? HOLD_UP : HOLD_DOWN;
    }
  } else {
    S.wait -= speed * d;
    if (S.wait <= 0) {
      if (S.phase === 3) {
        // The dim patchwork of the way down stays under the next sweep.
        for (let i = 0; i < N; i++) {
          const o = S.dn.av[i] * 3;
          S.bg[i * 3] = S.dn.col[o];
          S.bg[i * 3 + 1] = S.dn.col[o + 1];
          S.bg[i * 3 + 2] = S.dn.col[o + 2];
        }
        deal(S);
        rebuild(S);
      }
      S.phase = (S.phase + 1) % 4;
      S.cur = 0;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.R < 0) return;
  const c = floor(S.cur), ph = S.phase, up = S.up, dn = S.dn;
  for (let i = 0; i < N; i++) {
    let col = up.col, o = up.av[i] * 3;
    if (ph === 0) {
      if (up.pos[i] >= c) {
        col = S.bg;
        o = i * 3;
      }
    } else if (ph === 3 || (ph === 2 && dn.pos[i] < c)) {
      col = dn.col;
      o = dn.av[i] * 3;
    }
    display.setPixel(i % W, (i / W) | 0, col[o] | 0, col[o + 1] | 0, col[o + 2] | 0);
  }
}
