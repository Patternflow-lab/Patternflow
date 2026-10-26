// ===== Patternflow pattern =====
// Title:   Question Mark Function
// Family:  number
// Idea:    Minkowski's question mark function rises as a filled staircase that zooms for ever into a quadratic irrational, the Farey fractions marked where the dyadic levels meet the stair, while the point's continued fraction digits and the binary digits of its image scroll past underneath as the same runs.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Minkowski's question mark function (Hermann Minkowski, 1904), with Denjoy's continued fraction sum (Arnaud Denjoy, 1938), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Point=0..5, Depth=3..7
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the staircase is azure with a pale rim, the Farey marks and their dyadic lines rose, and the point pale gold, with the lines of its own Stern-Brocot path in a pale grey gold. Underneath, runs of noughts are rose and runs of ones azure.
// Knob 2: Speed. At 2 the bits scroll past at 0.6 a second, so the golden point's loop, where the picture shrinks 6.9 times across and 4 times up, takes 3.3 seconds and the silver point's, 34 times across and 16 up, takes 6.7. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Point. The quadratic irrational the zoom falls into: 0 the golden point 1/phi = [0; 1, 1, 1, ...], where ? is 2/3; 1 the silver point sqrt(2) - 1 = [0; 2, 2, ...], ? = 2/5; 2 sqrt(3) - 1 = [0; 1, 2, 1, 2, ...], ? = 6/7; 3 (sqrt(3) - 1)/2 = [0; 2, 1, ...], ? = 2/7; 4 [0; 3, 3, ...], ? = 2/9; 5 [0; 1, 3, ...], ? = 14/15.
// Knob 4: Depth. How many levels of the Farey tree are marked, counted from the window's own scale: 3 marks the 7 fractions down to the quarters and fifths on the whole graph, 7 marks 127, and each loop of the zoom fades in the next levels as they grow into view. As on a ruler, the deeper the level the fainter its lines.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, pow, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Hue of the staircase at knob 0, azure so the panel never opens on red,
// and the turn to the marks' colour.
const HUE0 = 0.56, MARK = 0.4;
// The graph's box and the two bars under it, in LED rows.
const GT = 1, GB = 105, BAR1 = 110, BAR2 = 120, CELL = 3;
// The periods of the continued fractions the knob chooses from.
const POINTS = [[1], [2], [1, 2], [2, 1], [3], [1, 3]];
// Bits a second at Speed 2.
const RATE = 0.6;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Denjoy's sum: x = [0; a1, a2, ...] goes to 2 (2^-A1 - 2^-A2 + ...), with
// A_k the sum of the first k partial quotients.
function qm(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let y = 0, sg = 1, pw = 2;
  for (let k = 0; k < 80 && x > 1e-13; k++) {
    const inv = 1 / x, a = floor(inv);
    x = inv - a;
    pw *= pow(2, -a);
    y += sg * pw;
    sg = -sg;
    if (pw < 1e-16) break;
  }
  return y;
}

// The point's map phi(t) = [0; a1, ..., ap + t] as a Moebius matrix, its
// two fixed points, and the multiplier at the attracting one. An odd period
// turns the picture over, so it is taken twice.
function point(k) {
  let a = POINTS[k];
  if (a.length % 2) a = a.concat(a);
  let m00 = 1, m01 = 0, m10 = 0, m11 = 1;
  for (const q of a) {
    // Multiply by [[0, 1], [1, q]]: t -> 1 / (q + t).
    const n00 = m01, n01 = m00 + q * m01, n10 = m11, n11 = m10 + q * m11;
    m00 = n00; m01 = n01; m10 = n10; m11 = n11;
  }
  // m10 x^2 + (m11 - m00) x - m01 = 0.
  const b = m11 - m00, disc = sqrt(b * b + 4 * m10 * m01);
  const r1 = (-b + disc) / (2 * m10), r2 = (-b - disc) / (2 * m10);
  const x0 = r1 > 0 && r1 < 1 ? r1 : r2, x1 = x0 === r1 ? r2 : r1;
  const kap = 1 / (m10 * x0 + m11) ** 2;
  let A = 0;
  // The binary digits of ?(x0), the units digit first: a1 noughts, a2
  // ones, a3 noughts and so on.
  const bits = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i]; j++) bits.push(i % 2);
    A += a[i];
  }
  return { a, A, x0, x1, kap, y0: qm(x0), bits, sig: pow(2, -A) };
}

export function setup(params) {
  params.s = {
    hue: 0, sp: 2, pk: -1, P: null, z: 0, depth: 3, ys: new Float64Array(W + 1),
    mk: [], buf: new Float32Array(W * H * 3), pal: new Float32Array(24), palHue: -1,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.sp = cl(kv[1], 0.2, 3);
  const pk = round(cl(kv[2], 0, POINTS.length - 1));
  s.depth = cl(kv[3], 3, 7);
  if (pk !== s.pk) {
    s.pk = pk;
    s.P = point(pk);
    s.z = 0;
  }
  // One loop of the zoom is one period of the digits, A bits.
  s.z += (d * RATE * (s.sp / 2)) / s.P.A;
  s.z -= floor(s.z);
}

function palette(s) {
  const P = s.pal, h = HUE0 + s.hue;
  hsv(h, 0.8, 1, P, 0); // stair fill, scaled down the column
  hsv(h - 0.03, 0.3, 1, P, 3); // stair edge
  hsv(h + MARK, 0.6, 1, P, 6); // mark
  hsv(h + MARK, 0.55, 0.36, P, 9); // dyadic arm
  hsv(h + 0.62, 0.45, 1, P, 12); // probe ring and path
  hsv(h + MARK, 0.8, 0.95, P, 15); // a run of noughts
  hsv(h, 0.75, 0.95, P, 18); // a run of ones
  hsv(h + 0.62, 0.22, 0.42, P, 21); // dyadic arm on the point's path
  s.palHue = s.hue;
}

// Screen to x and back. u = (x - x0)/(x - x1) turns phi into u -> kap u,
// so the window kap^z u(s) for s in [0, 1] is the whole graph at z = 0 and
// its copy one period down at z = 1, and the loop has no seam.
function uOf(P, x) { return (x - P.x0) / (x - P.x1); }
function xOf(P, u) { return (P.x0 - u * P.x1) / (1 - u); }

// The Stern-Brocot tree inside the window: each mediant of two Farey
// neighbours goes to the midpoint of their images, which is what ? is.
function walk(s, P, xlo, xhi, a, b, c, dd, ylo, yhi, lev, maxLev, path) {
  if (lev > maxLev) return;
  if (c / dd < xlo || a / b > xhi) return;
  const p = a + c, q = b + dd, m = p / q, ym = (ylo + yhi) / 2;
  const onPath = path && P.x0 > a / b && P.x0 < c / dd;
  s.mk.push(m, ym, lev, onPath ? 1 : 0);
  walk(s, P, xlo, xhi, a, b, p, q, ylo, ym, lev + 1, maxLev, onPath);
  walk(s, P, xlo, xhi, p, q, c, dd, ym, yhi, lev + 1, maxLev, onPath);
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.P) return;
  if (s.palHue !== s.hue) palette(s);
  const { buf: B, pal: C, P, z } = s;
  B.fill(0);
  const add = (x, y, o, k) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    B[i] += C[o] * k;
    B[i + 1] += C[o + 1] * k;
    B[i + 2] += C[o + 2] * k;
  };
  const kx = pow(P.kap, z), ky = pow(P.sig, z);
  const sx = (x) => xOf(P, uOf(P, x) / kx); // x -> screen 0..1
  const xs = (t) => xOf(P, kx * uOf(P, t)); // screen 0..1 -> x
  const ry = (y) => P.y0 + (y - P.y0) / ky; // y -> screen 0..1, up
  const GHt = GB - GT;
  const row = (r) => GB - r * GHt; // screen up 0..1 -> LED row (float)

  // The stair: ? at the 65 column edges. It only rises, so between two
  // edges the graph fills exactly the span of the two values.
  for (let c = 0; c <= W; c++) s.ys[c] = row(ry(qm(xs(c / W))));
  for (let c = 0; c < W; c++) {
    const top = s.ys[c + 1], bot = s.ys[c];
    // Fill from the floor of the box up to the low end of the span,
    // brightest just under the rim.
    const yTop = max(GT, floor(top)), yBot = min(GB, floor(bot));
    for (let y = GB; y > yBot; y--) add(c, y, 0, 0.18 + 0.5 * exp((-5 * (y - bot)) / GHt));
    // The span itself, a riser where ? climbs and a tread where it is flat.
    for (let y = yBot; y >= yTop; y--) if (y >= GT && y <= GB) add(c, y, 3, 0.9);
  }

  // Farey marks down to Depth levels below the window's own scale. A level
  // grows one period deeper each loop, so rel = level - A z is the same at
  // z = 0 and z = 1.
  const D = s.depth, maxLev = floor(D + P.A * z) + 1;
  s.mk.length = 0;
  const xlo = xs(0), xhi = xs(1);
  walk(s, P, xlo, xhi, 0, 1, 1, 1, 0, 1, 1, maxLev, true);
  const mk = s.mk;
  for (let i = 0; i < mk.length; i += 4) {
    const rel = mk[i + 2] - P.A * z, w = cl(D + 1 - rel, 0, 1);
    if (w <= 0) continue;
    const px = floor(sx(mk[i]) * W), py = round(row(ry(mk[i + 1])));
    if (px < 0 || px >= W) continue;
    const path = mk[i + 3] === 1;
    // A dyadic line from the left edge to its fraction, above the stair,
    // and a cut down through the fill under it. Like the ticks of a ruler,
    // the deeper the level the fainter both are.
    const tick = w * (1 - 0.65 * cl((rel - 1) / max(1, D - 1), 0, 1));
    if (py >= GT && py <= GB) {
      for (let x = 0; x < px; x++) add(x, py, path ? 21 : 9, tick);
      for (let y = py + 2; y <= GB; y++) {
        const i3 = (y * W + px) * 3;
        B[i3] *= 1 - 0.7 * tick;
        B[i3 + 1] *= 1 - 0.7 * tick;
        B[i3 + 2] *= 1 - 0.7 * tick;
      }
      const o = path ? 12 : 6;
      add(px, py, o, w);
      if (rel < D - 1.5) add(px, py - 1, o, 0.6 * w), add(px + 1, py, o, 0.6 * w), add(px - 1, py, o, 0.6 * w), add(px, py + 1, o, 0.4 * w);
    }
  }

  // The point itself, fixed at the centre of the zoom.
  const qx = floor(P.x0 * W), qy = round(row(P.y0));
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = qx + dx, y = qy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i3 = (y * W + x) * 3, ring = max(abs(dx), abs(dy)) === 2 && abs(dx) + abs(dy) < 4;
      B[i3] *= 0.15;
      B[i3 + 1] *= 0.15;
      B[i3 + 2] *= 0.15;
      if (ring) add(x, y, 12, 1);
    }
  add(qx, qy, 3, 1.5);

  // Underneath: the continued fraction as blocks a_k cells wide, and the
  // binary digits of ?(x0) as cells, noughts dim and ones bright. Each block
  // sits over the run of bits it becomes, so a gap in the top bar falls
  // wherever the bits below change. Both scroll A cells a loop and the
  // digits repeat every A cells, so the loop has no seam.
  const bits = P.bits, L = bits.length, off = round(P.A * z * CELL);
  for (let x = 0; x < W; x++) {
    const q = x + off, k = floor(q / CELL) % L, e = q % CELL, bit = bits[k];
    const last = e === CELL - 1, runEnd = last && bits[(k + 1) % L] !== bit, o = bit ? 18 : 15;
    if (!runEnd) for (let y = BAR1; y < BAR1 + 7; y++) add(x, y, o, y === BAR1 || y === BAR1 + 6 ? 0.95 : 0.4);
    if (!last) for (let y = BAR2; y < BAR2 + 6; y++) add(x, y, o, bit ? 1 : 0.25);
  }

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3)
      display.setPixel(x, y, min(255, round(B[p] * 255)), min(255, round(B[p + 1] * 255)), min(255, round(B[p + 2] * 255)));
}
