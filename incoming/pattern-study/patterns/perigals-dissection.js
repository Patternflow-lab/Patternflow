// ===== Patternflow pattern =====
// Title:   Perigal's Dissection
// Family:  geometry
// Idea:    The squares on the two legs of a right triangle stand side by side near the top, and the pieces that a tilted square on the hypotenuse cuts out of their tiling slide down in a staggered glide to fill that square, and after a rest there they slide back up.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Perigal's dissection proof of the Pythagorean theorem (Henry Perigal, 1873, year from memory), the Pythagorean tiling by squares of two sizes with lattice vectors (a, b) and (-b, a), polygon clipping (Sutherland and Hodgman, 1974, year from memory), pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Shape=-1..1, Cell=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the four pieces of the b square are azure, magenta, green and red by the quarter of the square they come from, a piece that holds the middle of the b square is gold, and the a square is a cream the knob does not move. Seams and outlines are white, the faint figure that stays behind is a blue grey. Orange and yellow are made paler so they do not read as brown.
// Knob 2: Speed. How fast the pieces go. One round takes 8.4 s at 2: the squares rest 1.2 s, the slide down takes 2.6 s, the c square rests 2.0 s and the slide back takes 2.6 s. That is 33.6 s at 0.5 and 4.2 s at 4. In a slide the pieces that land lowest leave first and the last leaves 0.9 s after them at 2, and on the way back they leave in the opposite order.
// Knob 3: Shape. The triangle, as the ratio of its short leg a to its long leg b with a + b held at 56 LEDs. At 0 it is the 3-4-5 triangle at 24, 32 and 40 LEDs and the c square leans 36.9 degrees. At -1 the ratio is 0.4: legs of 16 and 40, a hypotenuse of 43.1 and a lean of 21.8 degrees. At 1 the triangle is isosceles, 28 and 28 with a hypotenuse of 39.6, the square leans 45 degrees and the four pieces of the b square are right triangles. The tilted square's box is 56 by 56 at every setting.
// Knob 4: Cell. Where the c square lies over the tiling. The first tenth of the knob stops it at Perigal's place, on the middle of the a square, where the cut is five pieces: the a square whole (576 LED2 at 3-4-5) and four of 256, a quarter of the b square each. Past 0.1 it glides 28.3 LEDs (3-4-5) toward the middle of the b square: at about 0.25 two thin pieces appear, seven in all, and from 0.9 two more, nine. At 1 the b square is nearly whole (1000 LED2 and four corners of 6) and the a square is in four pieces of 144. It opens at 0.06, on Perigal's five.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, hypot, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);
const sm5 = (v) => ((v = cl(v, 0, 1)), v * v * v * (v * (v * 6 - 15) + 10));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow come out lighter and paler.
function tint(h, s, v, out) {
  const hh = fr(h);
  if (hh > 0.02 && hh < 0.2) {
    v = 0.5 + 0.5 * v;
    s *= 0.6;
  }
  hsv(hh, s, v, out);
}

// The two squares side by side are a + b = 56 wide, and so is the box of the
// tilted square on the hypotenuse, whatever the triangle.
const SPAN = 56;
const TOP_BASE = 44; // the row the two squares stand on
const CELL_Y = 94; // the row of the middle of the square on the hypotenuse
const TOP_X = (W - SPAN) / 2;

// Seconds at Speed 2, in the order of a round: the squares rest, the pieces slide down, the c square rests, the pieces slide back.
const HOLD_TOP = 1.2, SLIDE = 2.6, HOLD_BOT = 2.0, SPREAD = 0.9;
const CYCLE = HOLD_TOP + SLIDE + HOLD_BOT + SLIDE;

// The triangle from the Shape knob: its legs a <= b with a + b = 56.
function triangle(k) {
  const r = k < 0 ? 0.75 + 0.35 * k : 0.75 + 0.25 * k, b = SPAN / (1 + r);
  return { r, a: r * b, b };
}

// Sutherland-Hodgman: the part of a polygon with n.p >= k (or <= k).
function clip(p, nx, ny, k, keepAbove) {
  const out = [], f = (i) => (p[i] * nx + p[i + 1] * ny - k) * (keepAbove ? 1 : -1);
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length, a = f(i), b = f(j);
    if (a >= 0) out.push(p[i], p[i + 1]);
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b);
      out.push(p[i] + t * (p[j] - p[i]), p[i + 1] + t * (p[j + 1] - p[i + 1]));
    }
  }
  return out;
}
const area2 = (p) => {
  let s = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    s += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return s;
};

// The dissection. Take the plane tiled by squares of side a and of side b,
// the b squares at the lattice points m (a, b) + n (-b, a) and each a square
// in the notch above and to the right of a b square. Lay a c by c square
// over it, c = hypot(a, b), its sides along (a, b) and (-b, a), with its
// middle at (cx, cy) in the frame where the b square is [0, b] x [0, b] and
// the a square is [b, a + b] x [b - a, b]. Each tile the c square covers
// cuts out one piece, and sliding that piece back by its tile's lattice
// vector puts it inside the two squares of the first figure. The pieces of
// the c square are the pieces of the two squares, and nothing else is cut.
function dissect(a, b, cx, cy) {
  const c = hypot(a, b), h = c / 2, e1x = a / c, e1y = b / c, e2x = -b / c, e2y = a / c;
  const cell = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) cell.push(cx + h * (u * e1x + v * e2x), cy + h * (u * e1y + v * e2y));
  const m0 = round((cx * a + cy * b) / (c * c)), n0 = round((-cx * b + cy * a) / (c * c));
  const out = [];
  let sum = 0, sumA = 0, sumB = 0;
  for (let m = m0 - 3; m <= m0 + 3; m++)
    for (let n = n0 - 3; n <= n0 + 3; n++) {
      const lx = m * a - n * b, ly = m * b + n * a;
      for (let kind = 0; kind < 2; kind++) {
        const w = kind ? a : b, x0 = lx + (kind ? b : 0), y0 = ly + (kind ? b - a : 0);
        let q = clip(cell, 1, 0, x0, true);
        if (q.length) q = clip(q, 1, 0, x0 + w, false);
        if (q.length) q = clip(q, 0, 1, y0, true);
        if (q.length) q = clip(q, 0, 1, y0 + w, false);
        if (q.length < 6) continue;
        const ar = area2(q) / 2;
        if (ar < 1e-9) continue;
        sum += ar;
        if (kind) sumA += ar;
        else sumB += ar;
        out.push({ kind, lx, ly, poly: q, area: ar });
      }
    }
  // The proof's own check: the pieces add up to a square on each leg and the square on the hypotenuse.
  if (abs(sum - c * c) > 1e-6 * c * c || abs(sumA - a * a) > 1e-6 * c * c || abs(sumB - b * b) > 1e-6 * c * c)
    throw new Error("the pieces do not add up to a^2 + b^2 = c^2");
  return out;
}

export function setup(params) {
  const t = triangle(0), d = dissect(t.a, t.b, t.b + t.a / 2, t.b - t.a / 2);
  if (abs(t.a * t.a + t.b * t.b - hypot(t.a, t.b) ** 2) > 1e-9 || d.length !== 5) throw new Error("the first dissection is not Perigal's five pieces");
  params.s = {
    hue: 0, speed: 2, k3: 0, k4: 0.06, t: 0, key: "",
    pcs: [], tri: t, buf: new Float32Array(W * H * 3),
  };
}

// The cell goes from the middle of the a square, which is Perigal's place,
// to the middle of the b square, in a straight line. The first tenth of the
// knob is a stop at Perigal's.
function cellAt(t, k) {
  const s = cl((k - 0.1) / 0.9, 0, 1), ax = t.b + t.a / 2, ay = t.b - t.a / 2;
  return [ax + s * (t.b / 2 - ax), ay + s * (t.b / 2 - ay)];
}

function pose(S) {
  const t = triangle(S.k3), [cx, cy] = cellAt(t, S.k4);
  const key = t.r.toFixed(4) + "," + cx.toFixed(3) + "," + cy.toFixed(3);
  if (key === S.key) return;
  S.key = key;
  S.tri = t;
  const { a, b } = t, c = hypot(a, b), e1x = a / c, e1y = b / c, e2x = -b / c, e2y = a / c;
  const list = dissect(a, b, cx, cy);
  const pcs = [];
  for (const P of list) {
    const p = P.poly, n = p.length / 2;
    // The centroid, in the first figure's frame.
    let gx = 0, gy = 0, A = 0;
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length, cr = p[i] * p[j + 1] - p[j] * p[i + 1];
      gx += (p[i] + p[j]) * cr;
      gy += (p[i + 1] + p[j + 1]) * cr;
      A += cr;
    }
    gx = gx / (3 * A) - P.lx;
    gy = gy / (3 * A) - P.ly;
    // Colour: the a square's pieces are one pale colour; a b piece takes its
    // colour from which quarter of the b square it came from, quarters cut by
    // lines through its middle along the cell's sides (Perigal's two cuts).
    let col = -1;
    if (!P.kind) {
      const dx = gx - b / 2, dy = gy - b / 2;
      if (hypot(dx, dy) < 0.1 * b) col = 4;
      else col = (floor(atan2(dx * e2x + dy * e2y, dx * e1x + dy * e1y) / (PI / 2)) + 4) % 4;
    }
    const top = new Float64Array(p.length), bot = new Float64Array(p.length);
    for (let i = 0; i < n; i++) {
      top[i * 2] = p[i * 2] - P.lx + TOP_X;
      top[i * 2 + 1] = p[i * 2 + 1] - P.ly + TOP_BASE - b;
      bot[i * 2] = p[i * 2] - cx + W / 2;
      bot[i * 2 + 1] = p[i * 2 + 1] - cy + CELL_Y;
    }
    pcs.push({ kind: P.kind, col, area: P.area, top, bot, mid: new Float64Array(p.length), gy: 0, u: 0, hx: 0, hy: 0, bx: 0, by: 0 });
    // The middle of the piece at home and in the cell, for its path and for
    // the order the pieces leave in.
    const q = pcs[pcs.length - 1];
    for (let i = 0; i < n; i++) {
      q.hx += top[i * 2] / n;
      q.hy += top[i * 2 + 1] / n;
      q.bx += bot[i * 2] / n;
      q.by += bot[i * 2 + 1] / n;
    }
    q.gy = q.by;
  }
  for (const q of pcs) q.u = cl((q.gy - (CELL_Y - SPAN / 2)) / SPAN, 0, 1);
  S.pcs = pcs;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.k3 = cl(k[2], -1, 1);
  S.k4 = cl(k[3], 0, 1);
  S.t += (d * S.speed) / 2;
  pose(S);
}

// How far down piece u is, 0 at the squares and 1 in the cell. The pieces
// that land lowest leave first on the way down and last on the way back.
function lower(tm, u) {
  const dur = SLIDE - SPREAD;
  if (tm < HOLD_TOP) return 0;
  if (tm < HOLD_TOP + SLIDE) return sm5((tm - HOLD_TOP - (1 - u) * SPREAD) / dur);
  if (tm < HOLD_TOP + SLIDE + HOLD_BOT) return 1;
  return 1 - sm5((tm - HOLD_TOP - SLIDE - HOLD_BOT - u * SPREAD) / dur);
}

// A convex polygon, filled and edged, into buf. The fill is the share of a
// LED the polygon covers, the edge a line a LED wide along its boundary.
function polygon(buf, v, fc, fa, ec, ea) {
  const n = v.length / 2;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    x0 = min(x0, v[i * 2]);
    x1 = max(x1, v[i * 2]);
    y0 = min(y0, v[i * 2 + 1]);
    y1 = max(y1, v[i * 2 + 1]);
  }
  const sg = area2(v) > 0 ? 1 : -1;
  const ex = new Float64Array(n), ey = new Float64Array(n), el = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    ex[i] = v[j * 2] - v[i * 2];
    ey[i] = v[j * 2 + 1] - v[i * 2 + 1];
    el[i] = hypot(ex[i], ey[i]) || 1e-9;
  }
  for (let y = max(0, floor(y0 - 1)); y <= min(H - 1, ceil(y1 + 1)); y++)
    for (let x = max(0, floor(x0 - 1)); x <= min(W - 1, ceil(x1 + 1)); x++) {
      const px = x + 0.5, py = y + 0.5;
      let inner = 1e9, bd = 1e9;
      for (let i = 0; i < n; i++) {
        const ax = v[i * 2], ay = v[i * 2 + 1], qx = px - ax, qy = py - ay;
        inner = min(inner, (sg * (ex[i] * qy - ey[i] * qx)) / el[i]);
        const t = cl((qx * ex[i] + qy * ey[i]) / (el[i] * el[i]), 0, 1);
        bd = min(bd, hypot(qx - t * ex[i], qy - t * ey[i]));
      }
      const o = (y * W + x) * 3, cov = cl((inner >= 0 ? bd : -bd) + 0.5, 0, 1);
      if (fa > 0 && cov > 0) for (let k = 0; k < 3; k++) buf[o + k] += (fc[k] - buf[o + k]) * fa * cov;
      const e = ea * cl(1.2 - 1.2 * max(0, bd - 0.15), 0, 1);
      if (e > 0) for (let k = 0; k < 3; k++) buf[o + k] += (ec[k] - buf[o + k]) * e;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pcs.length) return;
  const buf = S.buf, { a, b } = S.tri;
  buf.fill(0);
  const hb = S.hue;
  // Four hues for the quarters of the b square, a pale cream for the a square,
  // gold for a piece that holds the b square's middle.
  const PAL = [];
  for (const [h, s, v] of [[0.58, 0.85, 0.95], [0.86, 0.85, 0.95], [0.33, 0.85, 0.9], [0.99, 0.82, 0.95], [0.14, 0.8, 0.95]]) {
    const c = [0, 0, 0];
    tint(hb + h, s, v, c);
    PAL.push(c);
  }
  const CREAM = [1, 0.96, 0.86], EDGE = [1, 1, 1];
  const GHOST = [0.62, 0.66, 0.8];

  // Where the pieces stand when they are home: the two squares, and the c
  // square with the four triangles round it that its box holds.
  const tx = TOP_X, ty = TOP_BASE - b;
  const sqA = [tx + b, ty + b - a, tx + a + b, ty + b - a, tx + a + b, ty + b, tx + b, ty + b];
  const sqB = [tx, ty, tx + b, ty, tx + b, ty + b, tx, ty + b];
  const dl = (b - a) / 2, x0 = W / 2 - SPAN / 2, x1 = W / 2 + SPAN / 2, y0 = CELL_Y - SPAN / 2, y1 = CELL_Y + SPAN / 2;
  const cellTop = [W / 2 + dl, y0], cellRight = [x1, CELL_Y + dl], cellBot = [W / 2 - dl, y1], cellLeft = [x0, CELL_Y - dl];
  const cell = [...cellTop, ...cellRight, ...cellBot, ...cellLeft];
  polygon(buf, sqA, GHOST, 0, GHOST, 0.45);
  polygon(buf, sqB, GHOST, 0, GHOST, 0.45);
  // The triangle: its right angle at the foot of the b square's right side,
  // the b leg up that side, the a leg along the a square's base, and the
  // hypotenuse between them. Its hypotenuse runs the way Perigal's two cuts do.
  const TRI = [tx + b, ty, tx + b, ty + b, tx + a + b, ty + b];
  polygon(buf, TRI, GHOST, 0.18, GHOST, 0.45);
  polygon(buf, [TRI[0], TRI[1], TRI[4], TRI[5]], GHOST, 0, GHOST, 0.8);
  for (const t of [
    [x0, y0, cellTop[0], y0, cellLeft[0], cellLeft[1]],
    [x1, y0, x1, cellRight[1], cellTop[0], y0],
    [x1, y1, cellBot[0], y1, x1, cellRight[1]],
    [x0, y1, x0, cellLeft[1], cellBot[0], y1],
  ])
    polygon(buf, t, GHOST, 0.2, GHOST, 0.45);
  polygon(buf, cell, GHOST, 0, GHOST, 0.8);

  const tm = S.t % CYCLE;
  // How whole the figure is: 1 while the pieces rest at home, 0 once the first leaves.
  const T1 = HOLD_TOP + SLIDE, T2 = T1 + HOLD_BOT, ease = (v) => sm5(cl(v, 0, 1));
  const fuseTop = tm < T1 - 0.5 * SLIDE;
  const fuse = fuseTop ? ease(tm / 0.5) * (1 - ease((tm - HOLD_TOP + 0.4) / 0.4)) : tm >= T1 && tm < T2 + 0.5 * SLIDE ? ease((tm - T1) / 0.5) * (1 - ease((tm - T2 + 0.4) / 0.4)) : 0;
  // Each piece's path, faint, while it is under way.
  for (const q of S.pcs) {
    if (q.area < 0.3) continue;
    const p = lower(tm, q.u);
    if (p <= 0 || p >= 1) continue;
    const col = q.kind ? CREAM : PAL[q.col];
    polygon(buf, [q.hx, q.hy, q.bx, q.by], col, 0, col, 0.5);
  }
  for (const q of S.pcs) {
    if (q.area < 0.3) continue;
    const p = lower(tm, q.u), m = q.mid;
    for (let i = 0; i < m.length; i++) m[i] = q.top[i] + (q.bot[i] - q.top[i]) * p;
    polygon(buf, m, q.kind ? CREAM : PAL[q.col], 0.92, EDGE, 0.95 - 0.6 * fuse);
  }
  // Whole, the pieces' seams sink and the outline of what they make stands out.
  if (fuse > 0.01) polygon(buf, fuseTop ? [tx, ty, tx + b, ty, tx + b, ty + b - a, tx + a + b, ty + b - a, tx + a + b, ty + b, tx, ty + b] : cell, EDGE, 0, EDGE, 0.95 * fuse);
  for (let p = 0; p < W * H; p++) display.setPixel(p % W, (p / W) | 0, (255 * cl(buf[p * 3], 0, 1)) | 0, (255 * cl(buf[p * 3 + 1], 0, 1)) | 0, (255 * cl(buf[p * 3 + 2], 0, 1)) | 0);
}
