// ===== Patternflow pattern =====
// Title:   Whitney Drift
// Family:  type
// Idea:    Nine hundred and sixty dots turn at whole-number speeds round the middle of the tall panel, each ring of them in the colour of its speed, and only when every dot has come back to phase zero at once do they stand as one big bold letter, the words ROSE, STAR and SWIRL written a letter to a beat.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: incremental drift (John Whitney, Catalog, 1961; Digital Harmony, 1980), points at whole-number speeds that all return to phase zero at once, pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..3, Harmonics=7..16, Radius=0.7..1.2
//
// Knob 1: Hue. Turns the colours of the ring speeds round the wheel together. At 0 the slowest, outermost ring is cyan, then blue, violet, magenta and red inward, and the fastest, innermost ring is orange; at 0.25 the outer ring is violet and the inner one green; at 0.5 red outside and blue inside.
// Knob 2: Speed. One beat is 8 / Speed seconds, 16 s at 0.5, 4 s at 2 and 2.7 s at 3, and in a beat the slowest ring turns once. At 2 the letter is within 1.5 LEDs of its place for 0.6 s around the end of the beat, and the last letter of a word stands 1.2 s longer.
// Knob 3: Harmonics. K, the fastest speed. The dots, counted from the middle outward, are split into K rings of equal count and the ring k turns k times a beat, so the inner rings are fast and the outermost goes round once. At 7 a dot runs about 400 LEDs in a beat and the letter stands 0.6 s; at 16 it runs about 830 LEDs and the letter stands 0.45 s.
// Knob 4: Radius. m, how far toward the middle each dot's circle is drawn: the circle goes through the dot's letter point and its centre is m of the way from that point to the middle. At 0.7 a ring swings between 0.4 and 1 times its radius while it turns; at 1 each ring turns rigidly about the middle; at 1.2 the rings swing out to 1.4 times their radius and the outer dots leave the panel.

// John Whitney drew his incremental drift on a computer in the 1960s: a row of
// dots, the dot j turning j times as fast as the first. Most of the time the
// dots lie in spirals, roses and stars. When the first dot has gone round once
// every other dot has gone round a whole number of times, all are back at
// phase zero together, and the row stands as it began.
//
// Here the dot i has a point P_i(n) in the n-th letter of the word, and its
// place at the time tau (0 to 1 over the beat n) is
//     z_i = G_i + rho_i (exp(i k_i theta) - 1),
// where G_i slides from its point in the last letter to its point in this one,
// theta = 2 pi s(tau), and rho_i = m (G_i - C) is a complex number, C being the
// middle of the panel: the circle goes through G_i and its centre lies on the
// line to C, m of the way. At tau = 1, s = 1 and theta = 2 pi, so exp(i k theta)
// is 1 for any whole number k and every dot is on its P_i(n): the letter
// stands. The turning is done on a plane stretched 1.3 times across, so the
// circles are ellipses taller than wide and the swirl fills the tall panel;
// at phase zero the stretch changes nothing.
//
// s(tau) = tau^2.5 / (tau^2.5 + (1 - tau)^2.5) is flat at both ends, so the
// dots linger near phase zero and the letter is held a little before the end
// of the beat and a little after its start instead of for one frame. The
// speed k of a dot is set by its ring, counted from the middle: the innermost
// turns K times a beat, the outermost once.
//
// The letters are strokes 10 LEDs wide through a few points, sampled with
// best-candidate dots. The dots are numbered ring by ring from the middle, and
// round a ring by angle, so a dot goes from its place in one letter to the same
// ring and angle in the next.

const W = 64, H = 128, N = 960, RINGS = 24;
const CX = 32, CY = 64, LX = 1.3;
const { floor, round, min, max, abs, sin, cos, sqrt, atan2, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const warp = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u ** 2.5 / (u ** 2.5 + (1 - u) ** 2.5));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// ---- The letters: strokes in unit coordinates on a box 46 by 88 LEDs, from row 20.
const GY = 20, GW = 46, GH = 88;
const arc = (cx, cy, rx, ry, a0, a1, n = 24, p = 1) => {
  const out = [];
  for (let j = 0; j <= n; j++) {
    const a = ((a0 + ((a1 - a0) * j) / n) * PI) / 180, c = cos(a), s = sin(a);
    out.push([cx + rx * Math.sign(c) * abs(c) ** p, cy + ry * Math.sign(s) * abs(s) ** p]);
  }
  return out;
};
const GLYPHS = {
  R: { w: 10, s: [[[0, 0], [0, 1]], [[0, 0], [0.5, 0], ...arc(0.5, 0.26, 0.5, 0.26, -90, 90, 14), [0, 0.52]], [[0.5, 0.52], [1, 1]]] },
  O: { w: 10, s: [arc(0.5, 0.5, 0.5, 0.5, 0, 360, 48, 0.8)] },
  S: { w: 10, s: [[...arc(0.5, 0.25, 0.5, 0.25, -30, -270, 24), ...arc(0.5, 0.75, 0.5, 0.25, -90, 150, 24)]] },
  E: { w: 10, s: [[[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0.5], [0.85, 0.5]], [[0, 1], [1, 1]]] },
  T: { w: 10, s: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]] },
  A: { w: 10, s: [[[0, 1], [0.5, 0], [1, 1]], [[0.22, 0.68], [0.78, 0.68]]] },
  W: { w: 8, gw: 52, s: [[[0, 0], [0.22, 1], [0.5, 0.3], [0.78, 1], [1, 0]]] },
  I: { w: 10, s: [[[0.5, 0], [0.5, 1]], [[0.12, 0], [0.88, 0]], [[0.12, 1], [0.88, 1]]] },
  L: { w: 10, s: [[[0, 0], [0, 1], [1, 1]]] },
};
const WORDS = ["ROSE", "STAR", "SWIRL"];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// N dots in a letter, each new dot the best of ten candidates, the one
// farthest from the dots already placed, then numbered ring by ring.
function sampleLetter(ch) {
  const g = GLYPHS[ch], hw = g.w / 2, gw = g.gw || GW, gx = CX - gw / 2;
  const segs = [];
  for (const line of g.s)
    for (let j = 0; j + 1 < line.length; j++) {
      const a = line[j], b = line[j + 1];
      segs.push([hw + a[0] * (gw - g.w) + gx, hw + a[1] * (GH - g.w) + GY, hw + b[0] * (gw - g.w) + gx, hw + b[1] * (GH - g.w) + GY]);
    }
  const cand = [];
  for (let y = GY + 0.25; y < GY + GH; y += 0.5)
    for (let x = gx + 0.25; x < gx + gw; x += 0.5) {
      let d2 = 1e9;
      for (const [x0, y0, x1, y1] of segs) {
        const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
        const u = l2 > 0 ? cl(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1) : 0;
        const ex = x0 + u * dx - x, ey = y0 + u * dy - y;
        d2 = min(d2, ex * ex + ey * ey);
      }
      if (d2 <= hw * hw) cand.push(x, y);
    }
  const rand = rng(ch.charCodeAt(0) * 7919 + 13), nc = cand.length / 2;
  const px = new Float64Array(N), py = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let bx = 0, by = 0, bd = -1;
    for (let c = 0; c < (i ? 10 : 1); c++) {
      const j = floor(rand() * nc), x = cand[2 * j], y = cand[2 * j + 1];
      let d = 1e9;
      for (let q = 0; q < i; q++) {
        const dx = px[q] - x, dy = py[q] - y;
        d = min(d, dx * dx + dy * dy);
      }
      if (d > bd) (bd = d), (bx = x), (by = y);
    }
    px[i] = bx;
    py[i] = by;
  }
  // Ring by ring from the middle, RINGS rings of equal count, each by angle.
  const ord = Array.from({ length: N }, (_, i) => i);
  const rr = (i) => (px[i] - CX) ** 2 + (py[i] - CY) ** 2, an = (i) => atan2(py[i] - CY, px[i] - CX);
  ord.sort((a, b) => rr(a) - rr(b));
  const per = N / RINGS, x = new Float64Array(N), y = new Float64Array(N);
  for (let r = 0; r < RINGS; r++) {
    const part = ord.slice(r * per, (r + 1) * per).sort((a, b) => an(a) - an(b));
    part.forEach((i, j) => {
      x[r * per + j] = px[i];
      y[r * per + j] = py[i];
    });
  }
  return { x, y };
}

export function setup(params) {
  const letters = {};
  for (const w of WORDS) for (const ch of w) if (!letters[ch]) letters[ch] = sampleLetter(ch);
  const seq = [];
  for (const w of WORDS) for (let j = 0; j < w.length; j++) seq.push({ ch: w[j], end: j === w.length - 1, j, len: w.length });
  params.s = {
    letters, seq, n: 0, tau: 0.15, rest: -1,
    hue: 0, speed: 2, K: 7, m: 0.7,
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
    x: new Float64Array(N), y: new Float64Array(N), kk: new Int32Array(N),
  };
}

// The speed of dot i, the dots counted from the middle outward: the innermost
// turns K times a beat, the outermost once.
const speedOf = (i, K) => max(1, K - floor(((i + 0.5) / N) * K));

// One dot's place, from G sliding between the two letters and the circle
// round it. tau runs 0 to 1 over a beat; at 1 the circle term is 0 exactly.
function place(i, A, B, tau, m, out) {
  const s = warp(tau), k = out.k, th = TAU * s * k;
  const gx = A.x[i] + (B.x[i] - A.x[i]) * s, gy = A.y[i] + (B.y[i] - A.y[i]) * s;
  const u = (gx - CX) * LX, v = gy - CY, c = cos(th) - 1, sn = sin(th);
  out.x = gx + (m * (u * c - v * sn)) / LX;
  out.y = gy + m * (u * sn + v * c);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 3, 0.5];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 4);
  S.K = cl(round(k[2]), 1, 24);
  S.m = cl(k[3], 0, 1.5);
  const T = 8 / S.speed;
  if (S.rest >= 0) {
    S.rest -= dt;
    if (S.rest < 0) {
      S.rest = -1;
      S.n = (S.n + 1) % S.seq.length;
      S.tau = 0;
    }
  } else {
    S.tau += dt / T;
    if (S.tau >= 1) {
      if (S.seq[S.n].end) {
        S.tau = 1;
        S.rest = 1.2;
      } else {
        S.tau -= 1;
        S.n = (S.n + 1) % S.seq.length;
      }
    }
  }
}

function splat(S, x, y, r, g, b, bloom) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
  const e = 1 - 0.55 * bloom;
  for (let q = 0; q < 4; q++) {
    const px = ix + (q & 1), py = iy + (q >> 1);
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    const w = ((q & 1 ? ax : 1 - ax) * (q >> 1 ? ay : 1 - ay)) ** e, o = py * W + px;
    S.R[o] += r * w;
    S.G[o] += g * w;
    S.B[o] += b * w;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B } = S;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  const L = S.letters, len = S.seq.length;
  const cur = S.seq[S.n], prev = S.seq[(S.n + len - 1) % len];
  const A = L[prev.ch], Bz = L[cur.ch];
  const K = S.K, m = S.m, T = 8 / S.speed;
  const s = warp(S.tau), eps = min(s, 1 - s);
  const focus = 1 / (1 + (m * 24 * K * TAU * eps / 3) ** 2);
  const pal = [];
  for (let q = 1; q <= K; q++) pal[q] = hsv(S.hue + 0.5 + 0.62 * (K > 1 ? (q - 1) / (K - 1) : 0), 0.92, 1);
  const o = { x: 0, y: 0, k: 1 }, o2 = { x: 0, y: 0, k: 1 };
  const bright = 0.55 + 0.55 * focus, wmix = 0.35 * focus, bloom = 0.35 + 0.65 * focus;
  const J = 5;
  for (let i = 0; i < N; i++) {
    const k = speedOf(i, K);
    o.k = o2.k = k;
    place(i, A, Bz, S.tau, m, o);
    const c = pal[k];
    let r = c[0] + (1 - c[0]) * wmix, g = c[1] + (1 - c[1]) * wmix, b = c[2] + (1 - c[2]) * wmix;
    r *= bright;
    g *= bright;
    b *= bright;
    // The tail is the dot's own path a moment ago, at most about 9 LEDs of it.
    const dtau = 0.12 / T;
    place(i, A, Bz, max(0, S.tau - dtau), m, o2);
    const d = sqrt((o.x - o2.x) ** 2 + (o.y - o2.y) ** 2);
    if (d > 0.8) {
      const span = min(1, 9 / d) * dtau, mv = cl(d / 2.5, 0, 1);
      for (let j = 1; j <= J; j++) {
        place(i, A, Bz, max(0, S.tau - (span * j) / J), m, o2);
        const w = 0.55 ** j * mv * 0.8;
        splat(S, o2.x, o2.y, r * w, g * w, b * w, 0);
      }
    }
    splat(S, o.x, o.y, r, g, b, bloom);
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q++) {
      const a = R[q], b = G[q], c = B[q];
      if (a + b + c > 0.004) display.setPixel(x, y, 255 * (1 - exp(-1.5 * a)), 255 * (1 - exp(-1.5 * b)), 255 * (1 - exp(-1.5 * c)));
    }
  // The key to the colours at the top, slowest speed at the left, and under
  // the letter a pip for each letter of the word, the ones written lit.
  const kx = round(CX - (K * 4 - 1) / 2);
  for (let q = 1; q <= K; q++) {
    const c = pal[q];
    for (let y = 3; y < 5; y++) for (let x = 0; x < 3; x++) display.setPixel(kx + (q - 1) * 4 + x, y, c[0] * 150, c[1] * 150, c[2] * 150);
  }
  const sh = S.tau < 0.5 ? prev : cur;
  const px0 = round(CX - (sh.len * 5 - 2) / 2);
  for (let q = 0; q < sh.len; q++) {
    const v = q < sh.j ? 0.45 : q === sh.j ? 0.45 + 0.55 * focus : 0.12;
    for (let y = 120; y < 122; y++) for (let x = 0; x < 3; x++) display.setPixel(px0 + q * 5 + x, y, 215 * v, 225 * v, 255 * v);
  }
}
