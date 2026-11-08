// ===== Patternflow pattern =====
// Title:   Pick's Theorem
// Family:  geometry
// Idea:    A polygon whose corners sit on a lattice of dots slides one corner a lattice step at a time, its inside dots lit in one colour and its boundary dots in another, while below it the dots are tallied, I whole dots and B half dots with one taken off, into a bar that is exactly as long as the polygon's area measured by the shoelace formula in the bar under it.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pick's theorem, A = I + B/2 - 1 (Georg Alexander Pick, 1899, year from memory), and the shoelace formula for the area of a polygon from its corners (Albrecht Ludwig Friedrich Meister, 1769, and Carl Friedrich Gauss, 1795, years from memory); the 3 by 5 digits of Edit Distance (pattern round 110); pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Corners=3..8, Spacing=4..7
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the dots inside the polygon are cyan, the dots on its boundary pink, the corners nearly white, the shoelace bar pale blue and the dot taken off red.
// Knob 2: Speed. How often a corner moves. At 2 one corner steps every 0.45 s; 0.5 is 1.8 s a step and 4 is 0.225 s. The area the polygon aims at rises and falls once every 30 s at 2.
// Knob 3: Corners. The number of corners, 3 to 8, caught at whole numbers. At 3 it opens on a triangle. Raise it and the polygon grows a corner on one of its edges at each step, lower it and a corner is taken out, so the polygon is carried from one count to the next.
// Knob 4: Spacing. How far apart the lattice dots are, 4 to 7 LEDs, caught at whole numbers. At 4 there are 15 dots across and 17 down and the polygon may cover up to 60 squares; at 7 there are 9 across and 10 down and at most 28. A new spacing starts a new polygon.

const W = 64, H = 128;
const { floor, round, min, max, abs, cos, exp, sqrt, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The digits are 3 by 5 and come from edit-distance.js; the signs are drawn here.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "+": "...|.#.|###|.#.|...", "-": "...|...|###|...|...", "=": "...|###|...|###|...", ".": ".|.|.|.|#",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) {
  const rows = FACE[ch].split("|");
  GLYPH[ch] = { w: rows[0].length, bits: rows.join("").split("").map((c) => (c === "#" ? 1 : 0)) };
}

// ---- the geometry, all on integer lattice coordinates -----------------------

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const gcd = (a, b) => {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

// Twice the area by the shoelace formula, an integer.
function area2(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return abs(s);
}

function onSeg(a, b, p) {
  return cross(a, b, p) === 0 && p[0] >= min(a[0], b[0]) && p[0] <= max(a[0], b[0]) && p[1] >= min(a[1], b[1]) && p[1] <= max(a[1], b[1]);
}

// Do the closed segments ab and cd share a point?
function segHit(a, b, c, d) {
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (d1 === 0 && onSeg(a, b, c)) || (d2 === 0 && onSeg(a, b, d)) || (d3 === 0 && onSeg(c, d, a)) || (d4 === 0 && onSeg(c, d, b));
}

// A simple polygon: no corner is flat, and two edges that are not neighbours
// share no point. A flat corner is kept out because it is not a corner, and
// neighbours then meet only at the corner they share.
function isSimple(p) {
  const n = p.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) if (cross(p[i], p[(i + 1) % n], p[(i + 2) % n]) === 0) return false;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segHit(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return false;
    }
  return true;
}

// Crossing number of a ray towards +x from (x, y), for a point off the boundary.
function inside(p, x, y) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j], b = p[i];
    if (a[1] > y !== b[1] > y) {
      const t = (y - a[1]) * (b[0] - a[0]) - (x - a[0]) * (b[1] - a[1]);
      if (b[1] > a[1] ? t > 0 : t < 0) c = !c;
    }
  }
  return c;
}

// Every lattice point, by brute force: 2 on the boundary, 1 inside, 0 outside.
function classify(p, cols, rows, cls) {
  let I = 0, B = 0;
  const n = p.length, pt = [0, 0];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      pt[0] = x;
      pt[1] = y;
      let on = false;
      for (let i = 0; i < n && !on; i++) on = onSeg(p[i], p[(i + 1) % n], pt);
      const c = on ? 2 : inside(p, x, y) ? 1 : 0;
      cls[y * cols + x] = c;
      if (c === 2) B++;
      else if (c === 1) I++;
    }
  return { I, B };
}

// ---- the walk ----------------------------------------------------------------

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const TALLY = 20; // dots to a row in the tally

function gridOf(sp) {
  const cols = floor(56 / sp) + 1, rows = floor(66 / sp) + 1;
  return { sp, cols, rows, ox: floor((W - (cols - 1) * sp) / 2), oy: 3 + floor((66 - (rows - 1) * sp) / 2) };
}

// Twice the area of the convex hull of the corners (Andrew's monotone chain).
function hull2(p) {
  const pts = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lo = [], up = [];
  for (const v of pts) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], v) <= 0) lo.pop();
    lo.push(v);
  }
  for (let q = pts.length - 1; q >= 0; q--) {
    const v = pts[q];
    while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], v) <= 0) up.pop();
    up.push(v);
  }
  lo.pop();
  up.pop();
  return area2(lo.concat(up));
}

// The polygons that may stand: inside the lattice, simple, an area between
// the limits, round enough not to be a sliver or a long arm, and with a
// boundary the tally has room for.
function ok(S, q) {
  const n = q.length;
  for (let i = 0; i < n; i++) if (q[i][0] < 0 || q[i][1] < 0 || q[i][0] >= S.cols || q[i][1] >= S.rows) return false;
  if (!isSimple(q)) return false;
  const a2 = area2(q);
  if (a2 < S.a2lo(n) || a2 > S.a2hi) return false;
  let per = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const u = q[i], v = q[(i + 1) % n];
    per += hypot(u[0] - v[0], u[1] - v[1]);
    b += gcd(u[0] - v[0], u[1] - v[1]);
  }
  return b <= 2 * TALLY && (2 * PI * a2) / (per * per) >= 0.25 && a2 >= 0.7 * hull2(q);
}

// The number of lattice points on the boundary, by the gcd of each edge.
function boundary(q) {
  let b = 0;
  for (let i = 0, n = q.length; i < n; i++) b += gcd(q[i][0] - q[(i + 1) % n][0], q[i][1] - q[(i + 1) % n][1]);
  return b;
}

// A try at the next polygon: move a corner one step, or grow or drop one.
function propose(S, want) {
  const p = S.poly, n = p.length;
  let q;
  if (n < want) {
    const e = floor(Math.random() * n), a = p[e], b = p[(e + 1) % n];
    const c = [round((a[0] + b[0]) / 2) + floor(Math.random() * 5) - 2, round((a[1] + b[1]) / 2) + floor(Math.random() * 5) - 2];
    if (p.some((v) => v[0] === c[0] && v[1] === c[1])) return null;
    q = p.slice();
    q.splice(e + 1, 0, c);
  } else if (n > want) {
    q = p.slice();
    q.splice(floor(Math.random() * n), 1);
  } else {
    const i = floor(Math.random() * n), d = DIRS[floor(Math.random() * 8)];
    q = p.slice();
    q[i] = [p[i][0] + d[0], p[i][1] + d[1]];
  }
  return ok(S, q) ? q : null;
}

function settle(S, q) {
  S.old = S.poly;
  S.ghost = 1;
  S.poly = q;
  const prev = S.cls.slice();
  const r = classify(q, S.cols, S.rows, S.cls);
  S.I = r.I;
  S.B = r.B;
  S.A2 = area2(q);
  for (let i = 0; i < prev.length; i++) if (prev[i] !== S.cls[i]) S.flash[i] = 1;
  // The boundary points in the order a walk round the polygon meets them.
  S.bidx.fill(-1);
  let k = 0;
  for (let i = 0, n = q.length; i < n; i++) {
    const a = q[i], b = q[(i + 1) % n], g = gcd(a[0] - b[0], a[1] - b[1]);
    for (let s = 0; s < g; s++) S.bidx[(a[1] + ((b[1] - a[1]) / g) * s) * S.cols + a[0] + ((b[0] - a[0]) / g) * s] = k++;
  }
}

function fresh(S, sp, want) {
  const g = gridOf(sp);
  Object.assign(S, g);
  const cells = g.cols * g.rows;
  S.cls = new Uint8Array(cells);
  S.bidx = new Int16Array(cells);
  S.flash = new Float32Array(cells);
  S.ahi = min(60, floor(0.4 * (g.cols - 1) * (g.rows - 1)));
  S.a2hi = 2 * S.ahi;
  S.alo = (n) => 4 + n;
  S.a2lo = (n) => 2 * (4 + n);
  const cx = floor(g.cols / 2), cy = floor(g.rows / 2), r = min(3, floor(g.cols / 3));
  let q = [[cx - r, cy + r - 1], [cx + r, cy + r], [cx + 1, cy - r]];
  if (!ok(S, q)) q = [[cx - 2, cy + 1], [cx + 2, cy + 1], [cx, cy - 2]];
  S.poly = q;
  for (let tries = 0; q.length < want && tries < 600; tries++) {
    const c = propose(S, want);
    if (c) {
      q = c;
      S.poly = q;
    }
  }
  S.old = q;
  settle(S, q);
  S.flash.fill(0);
  S.sp = sp;
  S.vi = S.I;
  S.vb = S.B / 2;
  S.va = S.A2 / 2;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, want: 3, spacing: -1, t: 0, next: 0.6, ph: PI / 2, ghost: 0, pulse: 0,
    buf: new Float32Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 4], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.want = cl(round(k[2]), 3, 8);
  const sp = cl(round(k[3]), 4, 7);
  if (sp !== S.spacing) {
    S.spacing = sp;
    fresh(S, sp, S.want);
    S.next = S.t + 0.6;
  }
  S.t += d;
  S.ph += (d * S.speed * 2 * PI) / 60;
  S.pulse += d * S.speed * 0.5;
  S.ghost = max(0, S.ghost - d * 2.2);
  const decay = exp(-d * 3.2);
  for (let i = 0; i < S.flash.length; i++) S.flash[i] *= decay;

  // One step: of a few polygons that may stand, the one whose area is nearest
  // the area the walk is aiming at, which rises and falls, with some noise so
  // the walk wanders.
  while (S.t >= S.next) {
    S.next += 0.9 / S.speed;
    const tgt = (S.alo(S.want) + S.ahi) / 2 + ((S.ahi - S.alo(S.want)) / 2) * -cos(S.ph);
    let best = null, bs = 1e9;
    for (let t = 0; t < 9; t++) {
      const q = propose(S, S.want);
      if (!q) continue;
      let off = 0;
      for (const v of q) off += hypot(v[0] - (S.cols - 1) / 2, v[1] - (S.rows - 1) / 2);
      const sc = abs(area2(q) / 2 - tgt) + Math.random() * 2.5 - 0.3 * boundary(q) + (0.5 * off) / q.length;
      if (sc < bs) {
        bs = sc;
        best = q;
      }
    }
    if (best) settle(S, best);
  }

  // The bars and the numbers glide to the counts.
  const e = 1 - exp(-d * 11);
  S.vi += (S.I - S.vi) * e;
  S.vb += (S.B / 2 - S.vb) * e;
  S.va += (S.A2 / 2 - S.va) * e;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.poly) return;
  const buf = S.buf, sp = S.sp, ox = S.ox, oy = S.oy, cols = S.cols, rows = S.rows;
  buf.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    const r = c[0] * a, g = c[1] * a, b = c[2] * a;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
  };
  const line = (x0, y0, x1, y1, c, a) => {
    const dx = abs(x1 - x0), dy = -abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  // Colours.
  const hb = 0.5 + S.hue;
  const cI = [0, 0, 0], cB = [0, 0, 0], cV = [0, 0, 0], cA = [0, 0, 0], cM = [0, 0, 0], cD = [0, 0, 0], cW = [1, 1, 1];
  hsv(hb, 0.8, 1, cI);
  hsv(hb + 0.4, 0.75, 1, cB);
  hsv(hb + 0.4, 0.18, 1, cV);
  hsv(hb + 0.08, 0.28, 1, cA);
  hsv(hb + 0.5, 0.9, 1, cM);
  hsv(hb + 0.04, 0.4, 1, cD);
  const mix = (c, f) => [c[0] + (1 - c[0]) * f, c[1] + (1 - c[1]) * f, c[2] + (1 - c[2]) * f];

  const P = S.poly, n = P.length;
  const X = (v) => ox + sp * v[0], Y = (v) => oy + sp * v[1];

  // The polygon drawn filled, faintly, at the LEDs themselves.
  {
    let y0 = 1e9, y1 = -1e9;
    for (const v of P) {
      y0 = min(y0, Y(v));
      y1 = max(y1, Y(v));
    }
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % n], ya = Y(a), yb = Y(b);
        if (ya <= y !== yb <= y) xs.push(X(a) + ((y - ya) * (X(b) - X(a))) / (yb - ya));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.ceil(xs[q]); x < Math.ceil(xs[q + 1]); x++) put(x, y, cA, 0.15);
    }
  }
  // The polygon a step ago, fading.
  if (S.ghost > 0) {
    const O = S.old;
    for (let i = 0; i < O.length; i++) {
      const a = O[i], b = O[(i + 1) % O.length];
      line(X(a), Y(a), X(b), Y(b), cB, 0.3 * S.ghost);
    }
  }
  // Its edges.
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    line(X(a), Y(a), X(b), Y(b), cB, 0.5);
  }

  // The lattice.
  const isV = new Uint8Array(cols * rows);
  for (const v of P) isV[v[1] * cols + v[0]] = 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const o = j * cols + i, c = S.cls[o], px = ox + sp * i, py = oy + sp * j, f = S.flash[o];
      if (c === 0) {
        put(px, py, cD, 0.3 + 0.5 * f);
      } else if (c === 1) {
        const col = f > 0.02 ? mix(cI, f * 0.8) : cI;
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) put(px + dx, py + dy, col, 1);
      } else {
        const wave = 0.5 + 0.5 * Math.sin(2 * PI * (S.pulse - S.bidx[o] / max(1, S.B)));
        const a = isV[o] ? 1 : 0.7 + 0.3 * wave;
        const col = f > 0.02 ? mix(isV[o] ? cV : cB, f * 0.8) : isV[o] ? cV : cB;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(px + dx, py + dy, col, a);
      }
    }

  // ---- the tally ------------------------------------------------------------
  const I = S.I, B = S.B;
  const digits = (str, x, y, cols_) => {
    for (let q = 0; q < str.length; q++) {
      const g = GLYPH[str[q]];
      if (!g) continue;
      for (let r = 0; r < 5; r++) for (let c = 0; c < g.w; c++) if (g.bits[r * g.w + c]) put(x + c, y + r, cols_[q], 1);
      x += g.w + 1;
    }
  };
  const width = (str) => {
    let w = -1;
    for (const ch of str) w += GLYPH[ch].w + 1;
    return w;
  };
  // I + B/2 - 1 = A, each number in the colour of its dots.
  {
    const half = B / 2, A = S.A2 / 2;
    const parts = [String(I), "+", String(half), "-1", "=", String(A)];
    const cs = [cI, cW, cB, cM, cW, cA];
    const str = parts.join(""), colors = [];
    parts.forEach((s, q) => {
      for (let z = 0; z < s.length; z++) colors.push(q === 1 || q === 4 ? [0.6, 0.6, 0.6] : cs[q]);
    });
    digits(str, floor((W - width(str)) / 2), 78, colors);
  }
  // I whole dots.
  for (let q = 0; q < I; q++) {
    const x = 2 + 3 * (q % TALLY), y = 90 + 3 * floor(q / TALLY);
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(x + dx, y + dy, cI, 1);
  }
  // B half dots, half as tall.
  for (let q = 0; q < B; q++) {
    const x = 2 + 3 * (q % TALLY), y = 102 + 2 * floor(q / TALLY);
    for (let dx = 0; dx < 2; dx++) put(x + dx, y, cB, 1);
  }

  // The bars, one LED to a square of area. The top one is the tally laid end
  // to end with one taken off; the bottom one is the shoelace area.
  const bar = (x0, x1, y0, y1, c, a) => {
    for (let x = floor(x0); x < Math.ceil(x1); x++) {
      const cv = cl(min(x1, x + 1) - max(x0, x), 0, 1);
      for (let y = y0; y <= y1; y++) put(x, y, c, a * cv);
    }
  };
  const bx = 2, vi = S.vi, vb = S.vb, va = S.va;
  const barA = (x0, x1, y0, y1, c, a) => {
    // additive, so two runs meeting inside one LED blend
    for (let x = floor(x0); x < Math.ceil(x1); x++) {
      const cv = cl(min(x1, x + 1) - max(x0, x), 0, 1) * a;
      for (let y = y0; y <= y1; y++) {
        const o = (y * W + x + bx) * 3;
        if (x + bx < 0 || x + bx >= W) continue;
        buf[o] = min(1, buf[o] + c[0] * cv);
        buf[o + 1] = min(1, buf[o + 1] + c[1] * cv);
        buf[o + 2] = min(1, buf[o + 2] + c[2] * cv);
      }
    }
  };
  const ty0 = 110, ty1 = 115, by0 = 119, by1 = 124;
  barA(0, vi, ty0, ty1, cI, 1);
  barA(vi, vi + vb - 1, ty0, ty1, cB, 1);
  // the one taken off
  bar(bx + vi + vb - 1, bx + vi + vb, ty0, ty1, cM, 0.35);
  barA(0, va, by0, by1, cA, 1);
  // where the two bars end
  for (let y = ty1 + 1; y < by0; y++) put(bx + floor(va + 1e-6), y, cW, 0.8);

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
