// ===== Patternflow pattern =====
// Title:   Sponge Blend
// Family:  cosmetic
// Idea:    A stripe of colour is laid down a pale base and an unseen damp sponge bounces along it, each dab printing a soft patch of open-cell stipple that lifts colour off the stripe and leaves it further out, until the hard line is bounced out into a wide soft fade and the base is wiped for the next stripe.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 31, after foundation blended out with a damp makeup sponge
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Coverage=0..1, Grain=0..1
//
// Knob 1: Hue. The colour being blended, all the way round the wheel from coral at 0; the base stays a pale ivory with a breath of it, and round orange and gold the colour is lifted so it never goes brown.
// Knob 2: Speed. How fast the sponge bounces: at 2 it dabs about six times a second, lays a stripe on in a second and blends it out in about fifteen; at 0.2 everything runs ten times slower.
// Knob 3: Coverage. How much colour the sponge works: at 0 a sheer wash; at 1 full coverage, deeper and opaque, and the sponge presses a wider patch with every dab.
// Knob 4: Grain. How coarse the sponge is: fine pores a LED or two across in a fresh print at 0, open cells about four across at 1, and the grain of the base grows rougher with it. Dab after dab the pores close up into a fine even finish.
// Buttons: K1 tap lays a fresh stripe of colour for the sponge to blend out.

const W = 64, H = 128, N = W * H;
const TS = 128, TN = TS * TS;
const { min, max, floor, sin, cos, exp, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The sponge's pores: three tiles of noise blurred over 3, 5 and 7 LEDs, 128
// LEDs square and wrapping, each LED's value turned into its rank 0..255.
// Cutting a tile at rank 128 gives cells from two to four LEDs across, half of
// them touching; cutting it lower leaves only the cores, small and sparse.
let TILES = null;
function tiles() {
  const out = [];
  const raw = Float32Array.from({ length: TN }, (_, i) => hash(i + 911) - 0.5);
  for (let r = 1; r <= 3; r++) {
    const b = new Float32Array(TN);
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        let s = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) s += raw[((y + dy) & (TS - 1)) * TS + ((x + dx) & (TS - 1))];
        b[y * TS + x] = s;
      }
    const order = Array.from({ length: TN }, (_, i) => i).sort((p, q) => b[p] - b[q]);
    const rank = new Uint8Array(TN);
    order.forEach((i, k) => (rank[i] = (k * 256) / TN));
    out.push(rank);
  }
  return out;
}

// The base's grain is a fine checker: every other LED sits half a step above
// the base and the rest half a step below, so neighbouring LEDs always differ
// by about the same 28 to 41 levels and nothing reads as an outline. AMP is
// each LED's own share of that step. The pores of a print are soft dips
// spread over three LEDs, a few levels a LED, so they never cut an edge.
const AMP = Float32Array.from({ length: N }, (_, i) => 0.78 + 0.34 * hash(i + 4242));
const ODD = Uint8Array.from({ length: N }, (_, i) => ((i % W) + floor(i / W)) & 1);
const STEP = 0.175;

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5);
  out[o + 1] = f(3);
  out[o + 2] = f(1);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    A: F(N), c: F(N), pm: new Uint8Array(N), cn: F(N), sh: F(N), dist: F(N).fill(99), su: F(N),
    phase: 0, pt: 0, lay: 0, len: 100, pts: F(98), u: 0, dir: 1, pass: 0, side: 1, load: 0, dabT: 0, n: 0,
    hue: 0, speed: 2, cov: 0, grain: 0.06, started: false, col: F(6),
  };
}

// A new stripe: a gentle curve down most of the panel, or anywhere when
// laid by hand. Every LED's distance from it and the place along it nearest
// are kept for laying it on and for walking the sponge along it.
function stripe(S, free) {
  const r = Math.random;
  let x0, y0, x1, y1;
  if (free) {
    const a = r() * PI, l = 50 + r() * 50, cx = 16 + r() * 32, cy = 30 + r() * 68;
    x0 = cx - (cos(a) * l) / 2;
    y0 = cy - (sin(a) * l) / 2;
    x1 = cx + (cos(a) * l) / 2;
    y1 = cy + (sin(a) * l) / 2;
  } else {
    x0 = 14 + r() * 36;
    y0 = 8 + r() * 10;
    x1 = 14 + r() * 36;
    y1 = 110 + r() * 10;
  }
  const nx = -(y1 - y0), ny = x1 - x0, nl = sqrt(nx * nx + ny * ny) || 1, bend = (r() - 0.5) * 24;
  const mx = (x0 + x1) / 2 + (nx / nl) * bend, my = (y0 + y1) / 2 + (ny / nl) * bend;
  const P = S.pts;
  let len = 0;
  for (let k = 0; k < 49; k++) {
    const t = k / 48, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    P[k * 2] = a * x0 + b * mx + c * x1;
    P[k * 2 + 1] = a * y0 + b * my + c * y1;
    if (k) len += Math.hypot(P[k * 2] - P[k * 2 - 2], P[k * 2 + 1] - P[k * 2 - 1]);
  }
  S.len = len;
  S.wid = 11 + r() * 3;
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      let best = 1e9, bu = 0;
      for (let k = 0; k < 48; k++) {
        const ax = P[k * 2], ay = P[k * 2 + 1], bx = P[k * 2 + 2] - ax, by = P[k * 2 + 3] - ay;
        const t = cl(((x + 0.5 - ax) * bx + (y + 0.5 - ay) * by) / (bx * bx + by * by + 1e-6), 0, 1);
        const dx = x + 0.5 - ax - bx * t, dy = y + 0.5 - ay - by * t, d = dx * dx + dy * dy;
        if (d < best) (best = d), (bu = (k + t) / 48);
      }
      S.dist[i] = sqrt(best);
      S.su[i] = bu;
    }
  S.phase = 1;
  S.lay = 0;
  S.u = 0;
  S.dir = 1;
  S.pass = 0;
  S.load = 0.3;
}

// Where the sponge comes down next: back and forth along the stripe, a step
// at a time, zig-zagging to either side and further out with each pass.
const REACH = [6, 10, 14, 18, 12];
function target(S) {
  const P = S.pts, u = cl(S.u, 0, 1), k = min(47, floor(u * 48)), t = u * 48 - k;
  const x = P[k * 2] + (P[k * 2 + 2] - P[k * 2]) * t, y = P[k * 2 + 1] + (P[k * 2 + 3] - P[k * 2 + 1]) * t;
  const tx = P[k * 2 + 2] - P[k * 2], ty = P[k * 2 + 3] - P[k * 2 + 1], tl = sqrt(tx * tx + ty * ty) || 1;
  const off = S.side * REACH[S.pass % REACH.length] * (0.2 + 0.8 * Math.random());
  return [x - (ty / tl) * off + (Math.random() - 0.5) * 3, y + (tx / tl) * off + (Math.random() - 0.5) * 3];
}

// One dab: the sponge's touching cells give and take colour until each holds
// nearer the patch's mean, with a little of what the sponge still carries
// from the last dab, so the colour is dragged along the way it bounces. The
// sponge soaks up a little each time, so a stripe thins as it spreads. The
// print shows the touching cells as pores of deeper colour: all of them on a
// fresh patch, and only their cores, smaller and fewer, each time the same
// spot is dabbed again, until the patch is a smooth finish with fine pores.
function dab(S, cx, cy) {
  const cov = S.cov, R = 10 + 3 * cov, ox = floor(Math.random() * TS), oy = floor(Math.random() * TS);
  const g = S.grain, tile = TILES[min(2, floor(g * 3))], rate = 0.7 + 0.25 * cov;
  // A coarse sponge prints more and bigger pores, and prints them in thinner colour.
  const fr = 0.36 + 0.24 * g, lo = 0.25 - 0.13 * g;
  const A = S.A, pm = S.pm, cn = S.cn, sh = S.sh, C = S.c;
  const E = R * 1.25, x0 = max(0, floor(cx - E)), x1 = min(W - 1, floor(cx + E)), y0 = max(0, floor(cy - E)), y1 = min(H - 1, floor(cy + E));
  const p1 = Math.random() * 2 * PI, p2 = Math.random() * 2 * PI;
  let sum = 0, area = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, th = Math.atan2(dy, dx), i = y * W + x;
      // The sponge's tip is not a perfect circle, and turns from dab to dab.
      const d = sqrt(dx * dx + dy * dy) / (R * (1 + 0.13 * sin(2 * th + p1) + 0.08 * sin(3 * th + p2)));
      if (d >= 1) {
        C[i] = 0;
        continue;
      }
      const w = 1 - sm((d - 0.45) / 0.55);
      const rk = tile[((y + oy) & (TS - 1)) * TS + ((x + ox) & (TS - 1))];
      const c = w * (rk < 128 ? 1 : 0.15) * rate;
      C[i] = c;
      sum += c * A[i];
      area += c;
      cn[i] += w;
      sh[i] = max(sh[i], w);
      // The print, except at the very rim where the sponge barely touched.
      // Pores only show where colour sits, fewer the more it was dabbed.
      if (w > 0.3 || hash(i + S.n * 131) < w * 3) pm[i] = A[i] > lo && rk < 256 * max(0.12, fr * exp(-cn[i] / 4)) ? 1 : 0;
    }
  if (area <= 0) return;
  const mean = sum / area, carry = 0.75 * mean + 0.25 * S.load;
  S.load = mean;
  for (let y = y0; y <= y1; y++)
    for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
      const c = C[i];
      if (c > 0) A[i] = (A[i] + (carry - A[i]) * c) * (1 - 0.05 * c);
    }
  S.n++;
}

function stepT(S, st) {
  if (S.phase === 1) {
    // Laying the stripe on, top to bottom, in about a second.
    S.lay = min(1, S.lay + st * 1.1);
    const w2 = S.wid / 2, A = S.A;
    for (let i = 0; i < N; i++) {
      const f = (S.lay - S.su[i]) * S.len;
      if (f <= 0) continue;
      // A soft shoulder three LEDs wide on each side and at the tip, never a cliff.
      const v = (1 - sm((S.dist[i] - w2 + 1.5) / 3)) * sm(f / 3);
      if (v > A[i]) A[i] = v;
    }
    if (S.lay >= 1) {
      S.phase = 2;
      S.pt = 0;
      S.dabT = 0.15;
    }
    return;
  }
  if (S.phase === 2) {
    S.pt += st;
    S.dabT -= st;
    if (S.dabT <= 0) {
      S.dabT += 0.17 * (0.85 + 0.3 * Math.random());
      const [x, y] = target(S);
      dab(S, x, y);
      S.side = -S.side;
      S.u += (S.dir * 6.5) / S.len;
      if (S.u > 1 || S.u < 0) {
        S.dir = -S.dir;
        S.u = cl(S.u, 0, 1);
        S.pass++;
      }
    }
    if (S.pass >= REACH.length) {
      S.phase = 3;
      S.pt = 0;
    }
    return;
  }
  if (S.phase === 3) {
    // A slow wipe from the top takes the colour off; then the next stripe.
    S.pt += st;
    const edge = S.pt * 110 - 10, A = S.A, cn = S.cn;
    for (let y = 0; y < H; y++) {
      const k = cl((edge - y) / 12, 0, 1) * 0.25;
      if (k <= 0) break;
      for (let x = 0, i = y * W; x < W; x++, i++) {
        A[i] *= 1 - k;
        cn[i] *= 1 - k;
        if (A[i] < 0.25) S.pm[i] = 0;
      }
    }
    if (S.pt > 1.6) stripe(S, false);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  S.cov = cl(k[2], 0, 1);
  S.grain = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    if (!TILES) TILES = tiles();
    // Open with the stripe more than half laid on.
    stripe(S, false);
    for (let i = 0; i < 12; i++) stepT(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    stripe(S, true);
  }
  const st = (d * S.speed) / 2;
  stepT(S, st);
  // The wet shine dries in real time, so a fast sponge leaves several at once.
  const fade = exp(-d * 3);
  for (let i = 0; i < N; i++) S.sh[i] *= fade;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const A = S.A, pm = S.pm, sh = S.sh, col = S.col;
  const h = S.hue + 0.05, cov = S.cov;
  // The base: a pale ivory with a breath of the hue. The colour: the hue at
  // nearly the same brightness, so the blend shows as colour on a steady grain.
  // Orange and gold read brown when dim, so round them the colour is lifted.
  const hf = h - floor(h), wm = sm((hf - 0.03) / 0.05) * (1 - sm((hf - 0.15) / 0.07));
  hsv(h, 0.06, 224, col, 0);
  hsv(h, 0.5 + 0.18 * cov + 0.1 * wm, 220 + 20 * wm, col, 3);
  // Grain also roughens the base: the checker's step grows by half from 0 to 1.
  const g = S.grain, op = 0.65 + 0.35 * cov, dip = 0.05 + 0.03 * g, gs = STEP * (0.9 + 0.55 * g);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      // How much pore is round this LED, 0..1 over its 3x3 neighbourhood.
      let pv = 0;
      for (let yy = max(0, y - 1); yy <= min(H - 1, y + 1); yy++) for (let xx = max(0, x - 1), j = yy * W + xx; xx <= min(W - 1, x + 1); xx++, j++) pv += pm[j];
      pv /= 9;
      // A pore holds more colour and sits a little deeper. A fresh dab is
      // wet for a moment: its colour reads deeper and the base a touch
      // brighter, then it dries back.
      const ac = sqrt(cl(A[i], 0, 1)), wet = sh[i];
      const a = min(1, ac * op * (1 + 0.45 * wet) + 0.45 * pv);
      const l = 1 + 0.03 * wet - dip * pv + gs * AMP[i] * (ODD[i] ? -0.5 : 0.5);
      display.setPixel(x, y, (col[0] + (col[3] - col[0]) * a) * l, (col[1] + (col[4] - col[1]) * a) * l, (col[2] + (col[5] - col[2]) * a) * l);
    }
}
