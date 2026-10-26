// ===== Patternflow pattern =====
// Title:   Universal Cover
// Family:  topology
// Idea:    A dot loops round a figure-eight at the foot of the panel, one loop a step, while its lift walks the four-way tree above that covers it, the fractal cross of the free group on a and b; the view re-roots on the lift every step so the tree slides and regrows round it, and the reduced word, drawn back to the root and spelled in a strip of blocks, grows by half a letter a step unless Return pulls the lift home.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: universal cover of the figure-eight, the Cayley graph of the free group F2 (Henri Poincaré, 1895; Max Dehn, 1910), with the escape of random walk on the free group (Harry Kesten, 1959), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Return=0.25..0.85, Depth=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the letter a, the left loop and every horizontal edge, is aqua and b, the right loop and every vertical edge, is magenta; the word's path runs in pale tints of the two, the dot and its lift are white and the root wears a gold ring. At 0.25 a is blue and b red, at 0.5 a pink and b aqua, at 0.75 a green and b blue. The wheel skips orange, yellow and lime, which read brown and olive on the dim outer branches.
// Knob 2: Speed. At 2 a step, one loop of the figure-eight below and one edge of the tree above, takes 0.75 s. The lift leaves first and the view follows a quarter of a step behind, so the lift runs up to a quarter of its edge ahead of the centre, 4 LEDs on an a edge and 5.6 on a b edge, before the tree slides under it. Every vertex of the tree lies over the wedge point, and all of them blink as the dot passes it. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Return. The chance a step cancels the word's last letter and sends the lift back towards the root; the other three letters share the rest, and from the root all four lead away. At 0.25 that is the simple random walk, every letter equally likely: the word grows by half a letter a step, Kesten's escape speed, and was 50.2 letters long after 100 steps (mean of 300 runs). At 0.5 the length is a fair coin's walk, 8.3 letters after 100 steps; at 0.6 it averages 2.5, and at 0.85 the lift sits on the root 41% of the time and the word averages 0.71 letters.
// Knob 4: Depth. How many levels of the tree are drawn round the lift, 4 + 2.5 x Depth, from 1.5 to 6.5, the last one fading in. The lift's own edges lengthen as levels drop so the drawing stays 60 LEDs wide: an a edge is 23 LEDs at -1, 15.9 at the opening 0.06 and 15.2 at 1, and a b edge 1.4 times that. Each level halves the edge and dims it by a fifth.

const W = 64, H = 128, N = W * H;
const { floor, min, max, exp, cos, sin, PI, LN2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (t) => t * t * (3 - 2 * t);
// Letters: 0 a, 1 a^-1, 2 b, 3 b^-1; the inverse of l is l ^ 1. a runs right
// in the tree, b runs up.
const DX = [1, -1, 0, 0], DY = [0, 0, -1, 1];
// The tree's centre, how much longer a b edge is drawn than an a edge, the
// strip that spells the word, and the figure-eight's wedge point and radius.
const TX = 32, TY = 43, KB = 1.4, WY = 88, BX = 32, BY = 110, BR = 14.5;
// Seconds a step takes at Speed 2.
const STEP = 0.75;
const WHITE = [1, 1, 1];
const HUE_A = 0.276, HUE_B = 0.73;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel skips orange, yellow and lime, which read brown and olive on
// the dim outer branches.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, ret: 0.25, depth: 0, L0: 15, levels: 4,
    word: [], x: 0, back: false, t: 0, steps: 0, at: 1,
    rgb: new Float32Array(N * 3), col: new Float32Array(12), c: 0, w: 0,
  };
  next(params.s);
}

// The next step: back along the word's last letter with chance Return, or
// on along one of the other three. From the root all four lead away.
function next(S) {
  const word = S.word, last = word.length ? word[word.length - 1] : -1;
  if (last >= 0 && Math.random() < S.ret) S.x = last ^ 1;
  else {
    const k = floor(Math.random() * (last >= 0 ? 3 : 4));
    let l = 0;
    for (let seen = -1; ; l++) if (l !== (last ^ 1) || last < 0) if (++seen === k) break;
    S.x = l;
  }
  S.back = last >= 0 && S.x === (last ^ 1);
  S.t = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.25, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.ret = cl(kv[2], 0.25, 0.85);
  S.depth = cl(kv[3], -1, 1);
  // Levels of the tree drawn round the lift, the last one fading in.
  S.levels = 4 + 2.5 * S.depth;
  // The lift's own edges are as long as keeps the drawn tree 60 LEDs wide:
  // the levels add up to 2 - 2^(1 - levels) edges each way.
  S.L0 = 30 / (2 - Math.pow(2, 1 - S.levels));
  S.t += (d * S.speed) / 2 / STEP;
  if (S.t >= 1) {
    if (S.back) S.word.pop();
    else S.word.push(S.x);
    S.steps++;
    next(S);
  }
  // The dot and its lift ease out of the wedge point and into the next
  // node; the view follows a little behind.
  S.w = ss(cl(S.t, 0, 1));
  S.c = ss(cl((S.t - 0.25) / 0.75, 0, 1));
  // Near either end of a step the dot is at the wedge point and the lift
  // at a vertex.
  S.at = exp(-min(S.t, 1 - S.t) / 0.07);
}

// The tree stops above the strip, so a zoomed-in tree never runs over
// the figure-eight.
let YMAX = H;
function plot(rgb, x, y, c, o, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= YMAX) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = min(1, (dx ? tx : 1 - tx) * wy * 1.8) * a, p = (yy * W + xx) * 3;
      if (rgb[p] < c[o] * w) rgb[p] = c[o] * w;
      if (rgb[p + 1] < c[o + 1] * w) rgb[p + 1] = c[o + 1] * w;
      if (rgb[p + 2] < c[o + 2] * w) rgb[p + 2] = c[o + 2] * w;
    }
  }
}
function seg(rgb, xa, ya, xb, yb, c, o, a) {
  if (max(xa, xb) < -1 || min(xa, xb) > W + 1 || max(ya, yb) < -1 || min(ya, yb) > H + 1) return;
  const n = Math.ceil(Math.hypot(xb - xa, yb - ya) * 3) || 1;
  for (let e = 0; e <= n; e++) plot(rgb, xa + ((xb - xa) * e) / n, ya + ((yb - ya) * e) / n, c, o, a);
}

// The tree drawn from u, the node the lift leaves. An edge is drawn
// L0 / 2^e long, e being its nearer end's distance from the root of the
// view: from u at the start of a step and from v at the end, so e slides
// from d to d - 1 on v's side and to d + 1 elsewhere while the view
// follows. The edge from u to v keeps e = 0.
function grow(S, rgb, x, y, d, inV, last) {
  const c = S.c, L0 = S.L0, col = S.col;
  for (let l = 0; l < 4; l++) {
    if (last >= 0 && l === (last ^ 1)) continue;
    const e = d === 0 ? (l === S.x ? 0 : c) : inV ? d - c : d + c;
    const len = L0 * exp(-e * LN2) * (l >= 2 ? KB : 1);
    if (e >= S.levels || len < 0.5) continue;
    const nx = x + DX[l] * len, ny = y + DY[l] * len;
    const a = Math.pow(0.8, e) * cl(len / 2, 0.3, 1) * cl(S.levels - e, 0, 1);
    // Edges near the lift are drawn up to two LEDs wide.
    const half = e < 1 ? 0.45 * (1 - e) : 0;
    if (half > 0.05) {
      const ox = l >= 2 ? half : 0, oy = l >= 2 ? 0 : half;
      seg(rgb, x - ox, y - oy, nx - ox, ny - oy, col, l >= 2 ? 3 : 0, a);
      seg(rgb, x + ox, y + oy, nx + ox, ny + oy, col, l >= 2 ? 3 : 0, a);
    } else seg(rgb, x, y, nx, ny, col, l >= 2 ? 3 : 0, a);
    // Every vertex lies over the wedge point, and they all blink as the
    // dot passes it.
    if (S.at > 0.03 && len > 1.2) plot(rgb, nx, ny, WHITE, 0, S.at * a * 1.2);
    grow(S, rgb, nx, ny, d + 1, d === 0 ? l === S.x : inV, l);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, col = S.col, L0 = S.L0, x = S.x;
  rgb.fill(0);
  const hA = wheel(HUE_A + S.hue), hB = wheel(HUE_B + S.hue);
  hsv(hA, 0.8, 1, col, 0); // a edges
  hsv(hB, 0.75, 1, col, 3); // b edges
  hsv(hA, 0.35, 1, col, 6); // a on the word's path
  hsv(hB, 0.3, 1, col, 9); // b on the word's path
  // u sits back from the centre by the share of its edge to v that the
  // view has covered.
  const luv = L0 * (x >= 2 ? KB : 1);
  const ux = TX - DX[x] * luv * S.c, uy = TY - DY[x] * luv * S.c;
  YMAX = WY - 2;
  grow(S, rgb, ux, uy, 0, false, -1);

  // The reduced word, drawn back from u to the root. On a step that
  // cancels the last letter the edge to v is that letter, and it goes out
  // behind the lift as the lift runs down it.
  const word = S.word, m = word.length;
  let px = ux, py = uy, rootSeen = 0;
  for (let j = m - 1, dd = 0; j >= 0; j--, dd++) {
    const l = word[j] ^ 1, inV = dd === 0 ? l === x : (word[m - 1] ^ 1) === x;
    const e = dd === 0 ? (l === x ? 0 : S.c) : inV ? dd - S.c : dd + S.c;
    const len = L0 * exp(-e * LN2) * (l >= 2 ? KB : 1);
    let sx = px, sy = py;
    if (dd === 0 && S.back) (sx = px + DX[l] * len * S.w), (sy = py + DY[l] * len * S.w);
    const nx = px + DX[l] * len, ny = py + DY[l] * len;
    for (const r of [-0.5, 0.5]) {
      const ox = l >= 2 ? r : 0, oy = l >= 2 ? 0 : r;
      seg(rgb, sx + ox, sy + oy, nx + ox, ny + oy, col, l >= 2 ? 9 : 6, 1);
    }
    (px = nx), (py = ny);
    if (len < 0.3) break;
    if (j === 0) rootSeen = cl(len / 2, 0, 1);
  }
  if (m === 0) rootSeen = 1;
  // The step itself: on a step away from the root the word gains x, drawn
  // out behind the lift.
  const lx = ux + DX[x] * luv * S.w, ly = uy + DY[x] * luv * S.w;
  if (!S.back)
    for (const r of [-0.5, 0.5]) {
      const ox = x >= 2 ? r : 0, oy = x >= 2 ? 0 : r;
      seg(rgb, ux + ox, uy + oy, lx + ox, ly + oy, col, x >= 2 ? 9 : 6, 1);
    }
  const gold = [1, 0.93, 0.7];
  // The root, the identity, while it is near enough to see.
  if (rootSeen > 0) {
    const rx = m === 0 ? ux : px, ry = m === 0 ? uy : py;
    for (let k = 0; k < 24; k++) plot(rgb, rx + 2.6 * cos((TAU * k) / 24), ry + 2.6 * sin((TAU * k) / 24), gold, 0, rootSeen);
  }
  // The lift.
  for (let yy = -3; yy <= 3; yy++)
    for (let xx = -3; xx <= 3; xx++) if (Math.hypot(xx, yy) <= 2.6) plot(rgb, lx + xx * 0.6, ly + yy * 0.6, WHITE, 0, 1);
  YMAX = H;

  // The word as a strip, oldest letter at the left: a in its colour, b in
  // its own, the inverses at half strength. Past 16 letters the start slides off.
  const shown = S.back ? m - S.w : m + (S.t > 0 ? S.w : 0);
  const total = Math.ceil(shown), first = max(0, total - 16);
  for (let j = first; j < total; j++) {
    const l = j < m ? word[j] : x, a = j < shown - 1 ? 1 : shown - j;
    const bright = (l & 1 ? 0.45 : 1) * a, o = l >= 2 ? 9 : 6;
    const x0 = 1 + (j - first) * 4;
    for (let yy = WY; yy < WY + 3; yy++)
      for (let xx = x0; xx < x0 + 3; xx++) {
        const p = (yy * W + xx) * 3;
        for (let k = 0; k < 3; k++) rgb[p + k] = max(rgb[p + k], col[o + k] * bright);
      }
  }

  // The figure-eight: loop a on the left, loop b on the right, both run
  // anticlockwise from the wedge point, and the dot goes round the loop of
  // this step's letter, backwards for an inverse.
  for (let k = 0; k < 200; k++) {
    const th = (TAU * k) / 200;
    plot(rgb, BX - BR + BR * cos(th), BY - BR * sin(th), col, 0, 0.7);
    plot(rgb, BX + BR - BR * cos(th), BY + BR * sin(th), col, 3, 0.7);
  }
  // Arrowheads at the tops of the loops show which way the letter runs.
  for (const side of [-1, 1]) {
    const cx = BX + side * BR, ty = BY - BR, o = side < 0 ? 0 : 3;
    for (let k = 1; k <= 3; k++) {
      plot(rgb, cx - 1.2 + k, ty - k * 0.9, col, o, 0.9);
      plot(rgb, cx - 1.2 + k, ty + k * 0.9, col, o, 0.9);
    }
  }
  const loopA = x < 2, sgn = x & 1 ? -1 : 1, o = loopA ? 6 : 9;
  const at = (u) => {
    const th = sgn * TAU * u;
    return loopA ? [BX - BR + BR * cos(th), BY - BR * sin(th)] : [BX + BR - BR * cos(th), BY + BR * sin(th)];
  };
  const steps = floor(S.w * 120);
  for (let k = 0; k <= steps; k++) {
    const u = (k / 120), [qx, qy] = at(u);
    plot(rgb, qx, qy, col, o, 0.35 + 0.65 * (u / max(S.w, 1e-3)));
  }
  if (S.at > 0.03) for (let k = 0; k < 28; k++) plot(rgb, BX + 3.4 * cos((TAU * k) / 28), BY + 3.4 * sin((TAU * k) / 28), WHITE, 0, S.at);
  const [dx, dy] = at(S.w);
  for (let yy = -3; yy <= 3; yy++)
    for (let xx = -3; xx <= 3; xx++) if (Math.hypot(xx, yy) <= 2.6) plot(rgb, dx + xx * 0.6, dy + yy * 0.6, WHITE, 0, 1);

  for (let y = 0, p = 0; y < H; y++)
    for (let xx = 0; xx < W; xx++, p += 3) display.setPixel(xx, y, (255 * cl(rgb[p], 0, 1)) | 0, (255 * cl(rgb[p + 1], 0, 1)) | 0, (255 * cl(rgb[p + 2], 0, 1)) | 0);
}
