// ===== Patternflow pattern =====
// Title:   Hexagrammum Mysticum
// Family:  line
// Idea:    Six points slide round an ellipse and the 60 hexagons through them are drawn one a second, each with its sides run out until opposite sides meet, the three meeting points ringed and Pascal's line through all three flashing white, while the Pascal lines of the last eleven hexagons stay behind faintly in the colour of their Steiner triple, so that every third hexagon closes a triple and a gold Steiner point flares where its three lines meet.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pascal's hexagrammum mysticum theorem (Blaise Pascal, 1639), Steiner points (Jakob Steiner, 1828), Kirkman points (Thomas Kirkman, 1849), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lines=12..60, Spread=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the Pascal lines left behind are cyan, azure, blue and violet, a colour for each of the last four triples in turn, the current hexagon's three pairs of opposite sides pink, green and amber, the Steiner points pale gold and the ellipse slate blue; at 0.5 the old lines turn pink, red, lime and green, the sides aqua, violet and blue, the Steiner points pale blue. Pascal's line is always white. The faint colours skip orange and yellow, which read brown and olive when dim.
// Knob 2: Speed. Hexagons a second, half the knob: one a second at 2, so all 60 go by in a minute and a Steiner point closes every 3 s; 0.2 is one hexagon every 10 s, 3 one every 0.67 s. The six points turn round the ellipse together once in 79 s at 2, each swaying 0.08 rad about its place with a period between 6 and 11 s.
// Knob 3: Lines. How many of the latest Pascal lines stay drawn, the current one with them, each fading with age. 12 at the opening: the last three or four triples, so three or four Steiner points. At 30 half of the 60; at 60 all of them, with all 20 Steiner points and the 60 Kirkman points as small gold dots, where three lines meet that are not a Steiner triple and no two of which share a crossing of chords.
// Knob 4: Spread. Draws the six points from the searched gaps towards six equal ones, 85% of the way at 1. Over a minute at 0, 68% of the crossings of opposite sides and 78% of the Steiner points fall on the panel; at 0.25 59% and 60%; at 0.5 55% and 51%; at 1 50% and 50%, as more pairs of sides turn nearly parallel and meet far off.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, exp, hypot, PI, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The ellipse the panel shows, centre and half axes in LEDs.
const CX = 31.5, CY = 63.5, AX = 16, BY = 34;

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The 60 hexagons on six points, each listed once: from point 0, the way
// round that visits the lower of its two neighbours first.
const HEX = [];
(function perm(arr, rest) {
  if (!rest.length) return void (arr[1] < arr[5] && HEX.push(arr));
  for (let i = 0; i < rest.length; i++) perm([...arr, rest[i]], rest.filter((_, j) => j !== i));
})([0], [1, 2, 3, 4, 5]);
const hexIndex = (h) => {
  // Turn and reverse an ordering to its listed form.
  const z = h.indexOf(0), r = [0, 1, 2, 3, 4, 5].map((k) => h[(z + k) % 6]);
  const f = r[1] < r[5] ? r : [0, r[5], r[4], r[3], r[2], r[1]];
  return HEX.findIndex((g) => g.every((v, k) => v === f[k]));
};

// Steiner's triples. Split the six points into two triangles; a hexagon that
// steps from one to the other every side uses six of the nine chords between
// them and leaves out three, one from each point: a matching of the two
// triangles. The three hexagons whose left-out matchings are the even
// permutations meet in one point, and the three odd ones in another, so the
// ten splits give the 20 Steiner points, and every hexagon is in one.
const STEINER = [];
for (let p = 1; p < 6; p++)
  for (let q = p + 1; q < 6; q++) {
    const A = [0, p, q], B = [0, 1, 2, 3, 4, 5].filter((v) => !A.includes(v));
    const tri = [[], []];
    for (const [x, y, z] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      // The hexagon A0 Bx A1 By A2 Bz leaves out A0-By, A1-Bz, A2-Bx.
      const m = [y, z, x], sign = (m[0] - m[1]) * (m[0] - m[2]) * (m[1] - m[2]) > 0 ? 0 : 1;
      const k = hexIndex([A[0], B[x], A[1], B[y], A[2], B[z]]);
      if (!tri[sign].includes(k)) tri[sign].push(k);
    }
    STEINER.push(tri[0], tri[1]);
  }

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  // The hexagons go round triple by triple, so every third one closes a
  // Steiner point.
  const order = [], tripleOf = new Int8Array(60);
  STEINER.forEach((t, j) => t.forEach((k) => (order.push(k), (tripleOf[k] = j))));
  params.s = {
    t: 0, clock: 0, speed: 2, hue: 0, keep: 12, spread: 0,
    order, tripleOf, kirkman: [],
    img: new Float32Array(W * H * 3), pts: [], lines: [],
  };
  findKirkman(params.s);
}

// Kirkman's triples are found by number, once, on six fixed points of an
// ellipse: the triples of Pascal lines that meet in one point, no two of
// them meeting at one of the 45 crossings of chords, that are not
// Steiner's. It finds 60, three through every line.
function findKirkman(S) {
  const P = [0.3, 1.2, 2.0, 3.4, 4.1, 5.3].map((a) => [cos(a), 1.6 * sin(a), 1]);
  const L = HEX.map((h) => pascal(P, h).line);
  const chords = (h) => h.map((v, i) => (1 << v) | (1 << h[(i + 1) % 6]));
  const shares = (a, b) => {
    // Two hexagons share a crossing when a pair of their opposite sides is
    // the same pair of chords.
    const ca = chords(HEX[a]), cb = chords(HEX[b]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = [ca[i], ca[i + 3]].sort().join(), y = [cb[j], cb[j + 3]].sort().join();
      if (x === y) return true;
    }
    return false;
  };
  const st = new Set(STEINER.map((t) => [...t].sort((a, b) => a - b).join()));
  for (let i = 0; i < 60; i++)
    for (let j = i + 1; j < 60; j++) {
      if (shares(i, j)) continue;
      const X = cross(L[i], L[j]);
      for (let k = j + 1; k < 60; k++) {
        const d = abs(X[0] * L[k][0] + X[1] * L[k][1] + X[2] * L[k][2]) / hypot(X[0], X[1], X[2]);
        if (d < 1e-9 && !shares(i, k) && !shares(j, k) && !st.has([i, j, k].join())) S.kirkman.push([i, j, k]);
      }
    }
}

// Pascal's line of hexagon h on points P: the crossings of its three pairs
// of opposite sides, and the line through the first and last, normalised so
// that a x + b y + c is the distance in LEDs.
function pascal(P, h) {
  const side = (i) => cross(P[h[i]], P[h[(i + 1) % 6]]);
  const X = [0, 1, 2].map((i) => cross(side(i), side(i + 3)));
  const l = cross(X[0], X[2]), n = hypot(l[0], l[1]) || 1;
  return { X, line: [l[0] / n, l[1] / n, l[2] / n] };
}

// Where the six points sit round the ellipse, as the angles between
// neighbours. An even spread sends crossings far off: at six equal gaps 12
// of the 45 crossings of chords are at infinity, because chords half a turn
// apart are parallel. These gaps came out of a search over spreads with no
// gap below 0.6, scored by the share of those 45 crossings and of the 20
// Steiner points on the panel as the six turn round the ellipse together,
// less a penalty for crowding to one side: 70% and 84% stay on the panel,
// against 48% and 50% at equal gaps.
const GAPS = [1.766, 1.384, 0.602, 0.601, 0.604, 1.327];
const BASE = GAPS.map((g, i) => GAPS.slice(0, i).reduce((a, b) => a + b, 0));
const SWAY = [0.31, 0.43, 0.37, 0.53, 0.29, 0.47];

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 12, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.keep = round(cl(kv[2], 12, 60));
  S.spread = 0.85 * cl(kv[3], 0, 1);
  S.t += d * S.speed;
  // Hexagons a second: half the speed, one a second at 2.
  S.clock += d * S.speed * 0.5;
  const tau = S.t;
  // The six points turn round the ellipse together and each sways about its
  // place; Spread draws them towards six equal gaps.
  const th = BASE.map((c, i) => c + S.spread * ((PI * i) / 3 + 0.6 - c) - 0.9 + 0.04 * tau + 0.08 * sin(SWAY[i] * tau + i * 2.1));
  const P = th.map((t) => [CX + AX * cos(t), CY + BY * sin(t), 1]);
  S.pts = P;
  S.lines = HEX.map((h) => pascal(P, h));
}

// Additive, anti-aliased drawing into a float image.
function add(img, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const q = (y * W + x) * 3;
  img[q] += r * a;
  img[q + 1] += g * a;
  img[q + 2] += b * a;
}

// A line a x + b y + c = 0 with a, b normalised, between the parameters
// s0 and s1 along it (measured from the foot of the origin), at width w.
function line(img, L, col, a, s0 = -1e9, s1 = 1e9, w = 0.9) {
  const [la, lb, lc] = L, fx = -la * lc, fy = -lb * lc, tx = -lb, ty = la;
  const span = (x, y) => (x - fx) * tx + (y - fy) * ty;
  if (abs(lb) > abs(la)) {
    for (let x = 0; x < W; x++) {
      const yc = -(la * x + lc) / lb;
      if (yc < -3 || yc > H + 2) continue;
      for (let y = floor(yc - 1.5); y <= floor(yc + 1.5) + 1; y++) {
        const dd = abs(la * x + lb * y + lc), sp = span(x, y);
        if (dd < w + 0.6 && sp >= s0 && sp <= s1) add(img, x, y, col[0], col[1], col[2], a * cl(1 - (dd - 0.15) / w, 0, 1));
      }
    }
  } else {
    for (let y = 0; y < H; y++) {
      const xc = -(lb * y + lc) / la;
      if (xc < -3 || xc > W + 2) continue;
      for (let x = floor(xc - 1.5); x <= floor(xc + 1.5) + 1; x++) {
        const dd = abs(la * x + lb * y + lc), sp = span(x, y);
        if (dd < w + 0.6 && sp >= s0 && sp <= s1) add(img, x, y, col[0], col[1], col[2], a * cl(1 - (dd - 0.15) / w, 0, 1));
      }
    }
  }
}

function dot(img, X, rad, col, a) {
  if (abs(X[2]) < 1e-12) return;
  const x = X[0] / X[2], y = X[1] / X[2];
  if (x < -rad - 2 || x > W + rad + 2 || y < -rad - 2 || y > H + rad + 2) return;
  for (let py = floor(y - rad - 1); py <= y + rad + 1; py++)
    for (let px = floor(x - rad - 1); px <= x + rad + 1; px++) {
      const r = hypot(px - x, py - y);
      add(img, px, py, col[0], col[1], col[2], a * cl(rad + 0.5 - r, 0, 1));
    }
}

function ring(img, X, rad, col, a) {
  if (abs(X[2]) < 1e-12) return;
  const x = X[0] / X[2], y = X[1] / X[2];
  if (x < -rad - 2 || x > W + rad + 2 || y < -rad - 2 || y > H + rad + 2) return;
  for (let py = floor(y - rad - 1); py <= y + rad + 1; py++)
    for (let px = floor(x - rad - 1); px <= x + rad + 1; px++) add(img, px, py, col[0], col[1], col[2], a * cl(1 - abs(hypot(px - x, py - y) - rad) / 0.8, 0, 1));
}

function glow(img, X, rad, col, a) {
  if (abs(X[2]) < 1e-12) return;
  const x = X[0] / X[2], y = X[1] / X[2], R = rad * 2.5;
  if (x < -R || x > W + R || y < -R || y > H + R) return;
  for (let py = floor(y - R); py <= y + R; py++)
    for (let px = floor(x - R); px <= x + R; px++) {
      const r2 = (px - x) * (px - x) + (py - y) * (py - y);
      add(img, px, py, col[0], col[1], col[2], a * exp(-r2 / (rad * rad)));
    }
}

// Colours, as hues before Hue turns them: the four triples on the panel at
// the opening take four cool hues in turn, the current hexagon's three pairs
// of opposite sides three warm ones, and the Steiner points are pale gold.
// The faint colours go through a wheel that skips orange and yellow, which
// read brown and olive when dim.
const TRIPLE = [0.376, 0.471, 0.576, 0.682];
const PAIR = [0.92, 0.3, 0.12];
const GOLD = 0.14;
const wheel = (h) => 0.18 + 0.85 * (h - floor(h));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pts.length) return;
  const img = S.img, P = S.pts, hu = S.hue;
  img.fill(0);
  const c = [0, 0, 0];
  // The ellipse.
  hsv(wheel(0.494 + hu), 0.45, 0.4, c, 0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x - CX) / AX, v = (y - CY) / BY, dd = abs((u * u + v * v - 1) / (2 * hypot(u / AX, v / BY)));
      if (dd < 1.4) add(img, x, y, c[0], c[1], c[2], cl(1.2 - dd, 0, 1));
    }
  const cur = floor(S.clock), ph = S.clock - cur, n = S.order.length;
  // Past Pascal lines, fading with age, in the colour of their triple. The
  // order is a cycle, so at the start the lines of its last lap are there.
  const present = new Float32Array(60);
  for (let age = S.keep - 1; age >= 1; age--) {
    const k = S.order[(((cur - age) % n) + n) % n], fade = 1 - (age - 1) / S.keep;
    present[k] = fade;
    hsv(wheel(TRIPLE[S.tripleOf[k] % 4] + hu), 0.75, 1, c, 0);
    line(img, S.lines[k].line, c, 0.1 + 0.2 * fade);
  }
  // The current hexagon: its sides grow out into long lines, then the three
  // crossings of opposite sides light, then Pascal's line through them.
  const k = S.order[cur % n], h = HEX[k], pl = S.lines[k];
  const grow = 1 - (1 - cl(ph / 0.3, 0, 1)) ** 2, pop = cl((ph - 0.28) / 0.1, 0, 1), flash = cl((ph - 0.4) / 0.08, 0, 1), dim = cl((ph - 0.55) / 0.45, 0, 1);
  for (let i = 0; i < 6; i++) {
    const A = P[h[i]], B = P[h[(i + 1) % 6]], l = cross(A, B), nn = hypot(l[0], l[1]), L = [l[0] / nn, l[1] / nn, l[2] / nn];
    const fx = -L[0] * L[2], fy = -L[1] * L[2], tx = -L[1], ty = L[0];
    const sa = (A[0] - fx) * tx + (A[1] - fy) * ty, sb = (B[0] - fx) * tx + (B[1] - fy) * ty;
    const lo = min(sa, sb), hi = max(sa, sb), X = pl.X[i % 3];
    hsv(PAIR[i % 3] + hu, 0.7, 1, c, 0);
    // The whole side faintly, the chord bright, and the stretch from the
    // chord out to where it meets its opposite side growing in.
    line(img, L, c, 0.14 * grow);
    line(img, L, c, 0.95, lo, hi, 1.1);
    const far = abs(X[2]) < 1e-9 * hypot(X[0], X[1]);
    const sx = far ? (X[0] * tx + X[1] * ty > 0 ? 1e4 : -1e4) : (X[0] / X[2] - fx) * tx + (X[1] / X[2] - fy) * ty;
    const e = 0.62 - 0.25 * dim;
    if (sx > hi) line(img, L, c, e, hi, hi + (min(sx, hi + 300) - hi) * grow);
    else if (sx < lo) line(img, L, c, e, lo - (lo - max(sx, lo - 300)) * grow, lo);
  }
  if (flash > 0) {
    present[k] = 1;
    line(img, pl.line, [1, 1, 1], 0.35 + 0.65 * flash * (1 - 0.45 * dim), -1e9, 1e9, 1.15);
  }
  for (let i = 0; i < 3; i++) {
    hsv(PAIR[i] + hu, 0.55, 1, c, 0);
    ring(img, pl.X[i], 2.6, c, 1.4 * pop * (1 - 0.4 * dim));
    dot(img, pl.X[i], 0.9, [1, 1, 1], pop);
  }
  // Steiner points where all three lines of a triple are drawn; the point
  // the current hexagon closes flares.
  hsv(GOLD + hu, 0.45, 1, c, 0);
  STEINER.forEach((t) => {
    const a = min(present[t[0]], present[t[1]], present[t[2]]);
    if (a <= 0) return;
    const X = cross(S.lines[t[0]].line, S.lines[t[1]].line);
    const fresh = t.includes(k) ? flash * (1 - dim * 0.7) : 0;
    glow(img, X, 1.4 + 2.2 * fresh, c, 0.45 + 0.35 * a + 0.8 * fresh);
    dot(img, X, 0.7 + 0.6 * fresh, [1, 1, 1], 0.6 + 0.4 * a);
  });
  // Kirkman points, small, once all three of their lines are drawn.
  for (const [i, j, q] of S.kirkman) {
    const a = min(present[i], present[j], present[q]);
    if (a > 0) dot(img, cross(S.lines[i].line, S.lines[j].line), 0.5, c, 0.35 + 0.45 * a);
  }
  // The six points.
  for (const X of P) dot(img, X, 1.25, [1, 1, 1], 1);
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, (255 * min(1, img[q])) | 0, (255 * min(1, img[q + 1])) | 0, (255 * min(1, img[q + 2])) | 0);
}
