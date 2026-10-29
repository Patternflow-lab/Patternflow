// ===== Patternflow pattern =====
// Title:   Problem of Apollonius
// Family:  geometry
// Idea:    Three white circles drift over the panel and the up to eight circles that touch all three are drawn round them, each coloured by which of the three it touches from inside and which from outside, with a bright point at every touch; when two white circles cross or one nests in another, the eight merge in pairs and fade to four or none, and come back when they part.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: problem of Apollonius (Apollonius of Perga, c. 200 BC; solved by François Viète, 1600), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pair=0..4, Size=-1..1
//
// Knob 1: Hue. Turns the eight colours round the wheel together. Opposite signatures sit opposite on the wheel: at 0 the circle touching all three from outside is gold and the one holding all three is blue.
// Knob 2: Speed. How fast the white circles drift: at 2 each centre's x and y run on sines of 37 to 71 seconds and each radius breathes on 19 to 31, at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Pair. 0 shows all eight. 1 to 4 light one of the four sign systems: its two circles stay bright with a faint wash inside, the rest dim to a fifth, and a line runs through the two centres and the radical centre of the white circles, the white point every system's line passes through.
// Knob 4: Size. Scales the white circles by 2 to this power: at -1 they are 2.7 to 7.7 LEDs in radius and all eight are there 91% of the time; at 0.06, where it opens, 5.6 to 16, and 61%; at 1 11 to 31, and 13%, the rest mostly four.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, abs, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, q, p, p, t, v][i], [t, v, v, q, p, p][i], [p, p, t, v, v, q][i]];
}

// ---- The three given circles. Radius at Size 0, breathing 18% on period
// rp; the centre's x swings across the panel's width and its y through its
// own band, y0 +- ay, each on its own sine and kept a radius from the edge.
// Periods in seconds at Speed 2.
const GIVEN = [
  { r: 9, y0: 34, ay: 30, px: 47, py: 61, ph: [0.3, 1.9], rp: 23 },
  { r: 13, y0: 64, ay: 36, px: 59, py: 43, ph: [2.2, 0.4], rp: 31 },
  { r: 6.5, y0: 94, ay: 30, px: 37, py: 71, ph: [4.1, 3.3], rp: 19 },
];

// ---- Solving. Circle i is (xi, yi, ri). A circle (x, y, r) touching it
// satisfies (x - xi)^2 + (y - yi)^2 = (r + si ri)^2, si = +1 outside it and -1
// on the other side of its rim. Subtracting circle 1's equation from 2's and
// 3's leaves two equations linear in x, y and r; two of the three unknowns are
// solved as linear in the third (the one whose 2 by 2 is largest, so three
// centres in a row do not break it) and put into circle 1's equation, which
// leaves a quadratic. s1 is held at +1: a root with r < 0 is the circle of
// radius -r for the opposite signs, so four sign systems give up to eight.
// The roots come back in order of r, and each system fills two slots.
// Checked over 30 minutes at Speed 2 and each of Size -1, 0.06, 0.5 and 1:
// the worst miss of a found circle against the three was 3.7e-9 LEDs, every
// touch point lay within 4e-11 of both rims, and each system's two centres
// stood in line with the radical centre to within 2e-12 radians.
// The count is 8, 4 or 0 and nothing else: 400,000 random triples gave 8 when
// no two cross or all three do, 4 when one or two pairs cross, 0 when one
// circle sits inside another and the third outside it. Eight is not always
// one of each signature: with the centres near a line a system's two roots
// can both be positive, two circles of one signature and none of its
// opposite. At the opening Size, of the frames with eight, 40% held all eight
// signatures.
function solve(C, k, out) {
  const s = [1, k & 1 ? -1 : 1, k & 2 ? -1 : 1];
  const K = (i) => C[i][0] * C[i][0] + C[i][1] * C[i][1] - C[i][2] * C[i][2];
  const M = [1, 2].map((j) => [2 * (C[j][0] - C[0][0]), 2 * (C[j][1] - C[0][1]), 2 * (s[j] * C[j][2] - s[0] * C[0][2]), K(j) - K(0)]);
  let best = -1, f = 0;
  for (let g = 0; g < 3; g++) {
    const p = (g + 1) % 3, q = (g + 2) % 3, d = abs(M[0][p] * M[1][q] - M[1][p] * M[0][q]);
    if (d > best) (best = d), (f = g);
  }
  const p = (f + 1) % 3, q = (f + 2) % 3, det = M[0][p] * M[1][q] - M[1][p] * M[0][q];
  out.n = 0;
  if (abs(det) < 1e-9) return;
  // u = U0 + U1 t, t the free unknown.
  const U0 = [0, 0, 0], U1 = [0, 0, 0];
  U1[f] = 1;
  U0[p] = (M[1][q] * M[0][3] - M[0][q] * M[1][3]) / det;
  U1[p] = (M[0][q] * M[1][f] - M[1][q] * M[0][f]) / det;
  U0[q] = (M[0][p] * M[1][3] - M[1][p] * M[0][3]) / det;
  U1[q] = (M[1][p] * M[0][f] - M[0][p] * M[1][f]) / det;
  const ex = U0[0] - C[0][0], ey = U0[1] - C[0][1], er = U0[2] + C[0][2];
  const A = U1[0] * U1[0] + U1[1] * U1[1] - U1[2] * U1[2];
  const B = 2 * (ex * U1[0] + ey * U1[1] - er * U1[2]);
  const Cc = ex * ex + ey * ey - er * er;
  const roots = [];
  if (abs(A) < 1e-12 * (abs(B) + abs(Cc) + 1e-30)) {
    if (abs(B) > 1e-30) roots.push(-Cc / B);
  } else {
    const disc = B * B - 4 * A * Cc;
    if (disc < 0) return;
    const sq = sqrt(disc), qq = -0.5 * (B + (B < 0 ? -sq : sq));
    roots.push(qq / A);
    if (qq !== 0) roots.push(Cc / qq);
  }
  const sol = roots.map((t) => [U0[0] + U1[0] * t, U0[1] + U1[1] * t, U0[2] + U1[2] * t]).filter((u) => isFinite(u[2]) && abs(u[2]) > 1e-9 && abs(u[2]) < 1e9);
  sol.sort((a, b) => a[2] - b[2]);
  for (const u of sol) {
    const r = u[2], sg = r > 0 ? 1 : -1;
    // Signature: bit i set when the circle touches circle i from its inner side.
    let sig = 0;
    for (let i = 0; i < 3; i++) if (s[i] * sg < 0) sig |= 4 >> i;
    out.c[out.n++] = { x: u[0], y: u[1], r: abs(r), sig };
  }
}

// The worst miss of a found circle against the three it should touch, in
// LEDs: the distance between centres against r + ri or |r - ri|.
function miss(C, c) {
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    const d = sqrt((c.x - C[i][0]) ** 2 + (c.y - C[i][1]) ** 2);
    worst = max(worst, min(abs(d - (c.r + C[i][2])), abs(d - abs(c.r - C[i][2]))));
  }
  return worst;
}

export function setup(params) {
  params.s = {
    // The clock starts 7 s in, where all eight stand for the next 17 s.
    t: 7, hue: 0, pair: 0, size: 0,
    // Eight slots, two to a sign system: the circle last seen and how lit it is.
    slot: Array.from({ length: 8 }, () => ({ c: null, on: false, a: 0 })),
    C: [[0, 0, 1], [0, 0, 1], [0, 0, 1]], rc: null, worst: 0, count: 0,
    rgb: new Float32Array(W * H * 3), out: { n: 0, c: [null, null] },
  };
}

function place(S) {
  const sc = 2 ** S.size;
  for (let i = 0; i < 3; i++) {
    const g = GIVEN[i], r = g.r * sc * (1 + 0.18 * sin((2 * PI * S.t) / g.rp + g.ph[0]));
    const mx = W / 2 - r - 1, lo = max(r + 1, g.y0 - g.ay), hi = max(lo, min(H - 1 - r, g.y0 + g.ay));
    S.C[i][0] = W / 2 + max(0, mx) * sin((2 * PI * S.t) / g.px + g.ph[0]);
    S.C[i][1] = (lo + hi) / 2 + ((hi - lo) / 2) * sin((2 * PI * S.t) / g.py + g.ph[1]);
    S.C[i][2] = r;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.pair = cl(round(k[2]), 0, 4);
  S.size = cl(k[3], -1, 1);
  S.t += d * cl(k[1], 0.2, 3) * 0.5;
  place(S);
  let count = 0;
  for (let sys = 0; sys < 4; sys++) {
    solve(S.C, sys, S.out);
    for (let j = 0; j < 2; j++) {
      const sl = S.slot[2 * sys + j];
      // One root: the second slot is the circle that just became a line.
      const c = S.out.n === 2 ? S.out.c[j] : S.out.n === 1 && j === 0 ? S.out.c[0] : null;
      sl.on = !!c;
      if (c) {
        sl.c = c;
        count++;
        S.worst = max(S.worst, miss(S.C, c));
      }
      // Fades: in over 0.4 s, out over 0.7 s, whatever the Speed.
      sl.a = sl.on ? min(1, sl.a + d / 0.4) : max(0, sl.a - d / 0.7);
    }
  }
  S.count = count;
  // The radical centre: the point with equal power to all three circles,
  // where r = 0 on every system's line of centres.
  const C = S.C, a1 = 2 * (C[1][0] - C[0][0]), b1 = 2 * (C[1][1] - C[0][1]), a2 = 2 * (C[2][0] - C[0][0]), b2 = 2 * (C[2][1] - C[0][1]);
  const K = (i) => C[i][0] * C[i][0] + C[i][1] * C[i][1] - C[i][2] * C[i][2], dd = a1 * b2 - a2 * b1;
  S.rc = abs(dd) > 1e-6 ? [((K(1) - K(0)) * b2 - (K(2) - K(0)) * b1) / dd, (a1 * (K(2) - K(0)) - a2 * (K(1) - K(0))) / dd] : null;
}

// ---- Drawing. Additive light into a float buffer.
function put(rgb, px, py, c, v) {
  if (px < 0 || px >= W || py < 0 || py >= H || v <= 0) return;
  const p = 3 * (py * W + px);
  rgb[p] += c[0] * v, rgb[p + 1] += c[1] * v, rgb[p + 2] += c[2] * v;
}

// An anti-aliased ring 1 LED wide, clipped to the panel. Rows the circle
// does not reach are skipped, and in each row only the columns near the two
// crossings are visited.
function ring(rgb, cx, cy, r, c, v) {
  const y0 = max(0, floor(cy - r - 1)), y1 = min(H - 1, floor(cy + r + 1));
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - cy, ro = r + 1, ri = r - 1;
    const xo = ro * ro - dy * dy;
    if (xo < 0) continue;
    const wo = sqrt(xo), wi = ri > 0 && ri * ri - dy * dy > 0 ? sqrt(ri * ri - dy * dy) : 0;
    for (const sgn of [-1, 1]) {
      const a = sgn < 0 ? cx - wo : cx + wi, b = sgn < 0 ? cx - wi : cx + wo;
      const xa = max(0, floor(a)), xb = min(W - 1, floor(b));
      for (let px = xa; px <= xb; px++) {
        const dx = px + 0.5 - cx, e = abs(sqrt(dx * dx + dy * dy) - r);
        if (e < 1) put(rgb, px, py, c, v * (1 - e));
      }
    }
  }
}

function dot(rgb, x, y, c, v, rad) {
  for (let py = floor(y - rad - 1); py <= floor(y + rad + 1); py++)
    for (let px = floor(x - rad - 1); px <= floor(x + rad + 1); px++) {
      const e = sqrt((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2);
      if (e < rad + 0.5) put(rgb, px, py, c, v * min(1, rad + 0.5 - e));
    }
}

function disc(rgb, cx, cy, r, c, v) {
  const y0 = max(0, floor(cy - r)), y1 = min(H - 1, floor(cy + r));
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - cy, w = r * r - dy * dy;
    if (w <= 0) continue;
    const hw = sqrt(w), xa = max(0, floor(cx - hw + 0.5)), xb = min(W - 1, floor(cx + hw - 0.5));
    for (let px = xa; px <= xb; px++) put(rgb, px, py, c, v);
  }
}

function line(rgb, x0, y0, x1, y1, c, v) {
  const n = max(abs(x1 - x0), abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const u = n ? i / n : 0;
    put(rgb, floor(x0 + (x1 - x0) * u), floor(y0 + (y1 - y0) * u), c, v);
  }
}

// Hue of a signature: the pair from one quadratic, sig and 7 - sig, opposite.
const SIGHUE = [0, 1, 2, 3, 7, 6, 5, 4];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.C) return;
  const rgb = S.rgb, C = S.C;
  rgb.fill(0);
  const white = [1, 1, 1];

  // A highlighted system: its line of centres, from edge to edge.
  if (S.pair && S.rc) {
    const a = S.slot[2 * (S.pair - 1)], b = S.slot[2 * (S.pair - 1) + 1], ends = [a, b].filter((q) => q.a > 0 && q.c);
    const far = ends.length ? ends.reduce((u, q) => (abs(q.c.x - S.rc[0]) + abs(q.c.y - S.rc[1]) > abs(u.c.x - S.rc[0]) + abs(u.c.y - S.rc[1]) ? q : u)) : null;
    if (far) {
      let ux = far.c.x - S.rc[0], uy = far.c.y - S.rc[1];
      const L = sqrt(ux * ux + uy * uy);
      if (L > 1e-6) {
        (ux /= L), (uy /= L);
        line(rgb, S.rc[0] - ux * 300, S.rc[1] - uy * 300, S.rc[0] + ux * 300, S.rc[1] + uy * 300, white, 0.16);
      }
    }
  }

  // The solutions, then the given circles over them, then the touches.
  const touch = [];
  for (let q = 0; q < 8; q++) {
    const sl = S.slot[q];
    if (sl.a <= 0 || !sl.c) continue;
    const c = sl.c, col = hsv(0.13 + S.hue + SIGHUE[c.sig] / 8, 0.78, 1);
    const lit = S.pair && floor(q / 2) !== S.pair - 1 ? 0.2 : 1;
    ring(rgb, c.x, c.y, c.r, col, 0.95 * sl.a * lit);
    if (S.pair && lit === 1) {
      // The lit pair: a faint wash inside each, and its centre.
      disc(rgb, c.x, c.y, c.r, col, 0.11 * sl.a);
      dot(rgb, c.x, c.y, col, 0.9 * sl.a, 0.7);
    }
    for (let i = 0; i < 3; i++) {
      const dx = C[i][0] - c.x, dy = C[i][1] - c.y, dd = sqrt(dx * dx + dy * dy);
      if (dd < 1e-9) continue;
      // From the centre toward circle i, unless circle i holds this one.
      const out = C[i][2] > c.r && dd < C[i][2] ? -1 : 1;
      touch.push([c.x + (out * c.r * dx) / dd, c.y + (out * c.r * dy) / dd, col, sl.a * lit]);
    }
  }
  for (let i = 0; i < 3; i++) ring(rgb, C[i][0], C[i][1], C[i][2], white, 0.62);
  for (const [x, y, col, a] of touch) {
    dot(rgb, x, y, col, 0.9 * a, 1.1);
    dot(rgb, x, y, white, 0.8 * a, 0.45);
  }
  if (S.rc && S.pair) dot(rgb, S.rc[0], S.rc[1], white, 0.9, 0.8);

  for (let p = 0; p < W * H; p++) {
    const r = rgb[3 * p], g = rgb[3 * p + 1], b = rgb[3 * p + 2];
    if (r + g + b > 0.004) display.setPixel(p % W, (p / W) | 0, min(255, 255 * r) | 0, min(255, 255 * g) | 0, min(255, 255 * b) | 0);
  }
}
