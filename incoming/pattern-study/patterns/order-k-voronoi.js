// ===== Patternflow pattern =====
// Title:   Order-k Voronoi
// Family:  cells
// Idea:    Ten sites drift slowly and every LED takes the colour of the set of its k nearest sites, the mean of their hues, so the panel splits into the regions of the order-k Voronoi diagram with pale lines where the k-th and the (k+1)-th nearest swap, neighbouring regions sharing all but one site and shading into each other, from the ordinary Voronoi diagram at k = 1 to the farthest-point diagram at k = n - 1, whose few unbounded regions meet in a tree that the centre of the smallest circle round the sites lies on, while a bar chart along the bottom counts the regions of every order in the whole plane and on the panel.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: higher-order Voronoi diagrams and the farthest-point diagram (Michael Shamos and Dan Hoey, 1975); the count of their regions (D. T. Lee, 1982); 3 x 5 figures drawn for this pattern; pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Order=1..17, Sites=10..18, Drift=0..1
//
// Knob 1: Hue. Turns the site colours round the wheel together: n hues evenly spaced from Hue + 0.05, so at 0 the ten sites are red-orange, gold, chartreuse, green, sea green, sky blue, blue, violet, magenta and rose at full brightness. A region's colour is the mean of its sites' hues at 30 to 75% saturation, paler where its sites pull in opposite directions; at k = 1 each region is its site's own colour.
// Knob 2: Order. k, the size of the nearest set, held at n - 1 above it. At 1 the ordinary Voronoi diagram, ten regions. At the opening 2 a region is a pair of sites whose cells touch, 3n - 3 - h of them: 21 to 23 over a minute for the opening ten sites as their hull has 6 to 4 corners. At 4 there are 26 to 34, the tallest bar nine tenths of the time (3 has it the rest), and since each site lies in just one region at least 16 of them hold no site at all. At n - 1, 9 at the opening, the farthest-point diagram: one unbounded region for each corner of the hull, 4 to 6 as the sites drift, meeting in a tree; the smallest circle round all the sites is dotted white and its centre, which lies on the tree, is a white star.
// Knob 3: Sites. n, 10 to 18; each whole step adds a site on its own path. At the first moment the chart's bars, orders 1 to n - 1, read 10 21 28 31 27 24 16 11 6 with 10 sites, of which the panel holds 10 19 23 25 22 14 9 5 3, and 18 44 63 79 89 96 95 95 88 75 64 56 43 34 24 16 7 with 18, of which it holds 18 38 49 57 61 67 67 61 55 46 37 26 22 18 16 11 5. The tallest bar is seven LEDs high.
// Knob 4: Drift. How fast the sites run their Lissajous paths: 0.56 LEDs a second on average at 0, 0.68 at the opening 0.06 and 2.6 at 1. The counts in the chart step by one or two as regions are born and die, and the white bar moves with the order.

const W = 64, H = 128, NMAX = 18, STRIP = 114; // the chart takes rows 114..127
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, hypot, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => {
  const t = cl((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// 3 x 5 figures, drawn for this pattern, rows from the top.
const FIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  // Each site runs a slow Lissajous path that keeps it 3 LEDs inside the
  // panel and clear of the chart. The first ten centres take one band each
  // of the height, shuffled, so the opening ten spread down the panel.
  const band = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 9; i > 0; i--) {
    const j = floor(random() * (i + 1));
    [band[i], band[j]] = [band[j], band[i]];
  }
  const path = [];
  for (let i = 0; i < NMAX; i++) {
    const ax = 4 + random() * 9, ay = 4 + random() * 8, room = STRIP - 6 - 2 * ay;
    path.push({
      cx: 3 + ax + random() * (58 - 2 * ax), cy: 3 + ay + room * (i < 10 ? (band[i] + random()) / 10 : random()), ax, ay,
      wx: 0.06 + random() * 0.08, wy: 0.05 + random() * 0.07, px: random() * 2 * PI, py: random() * 2 * PI,
    });
  }
  params.s = {
    path, t: 0, n: 10, k: 2, hue: 0, sx: new Float64Array(NMAX), sy: new Float64Array(NMAX),
    plane: new Int32Array(NMAX), panel: new Int32Array(NMAX),
  };
  return params.s;
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 10, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.n = cl(round(kv[2]), 3, NMAX);
  S.k = cl(round(kv[1]), 1, S.n - 1);
  S.t += d * (0.8 + 3 * cl(kv[3], 0, 1));
  for (let i = 0; i < NMAX; i++) {
    const p = S.path[i];
    S.sx[i] = p.cx + p.ax * sin(p.wx * S.t + p.px);
    S.sy[i] = p.cy + p.ay * sin(p.wy * S.t + p.py);
  }
}

// The number of i-sets for every i: sets of i sites that a line cuts off
// from the rest, which are the unbounded regions of the order-i diagram.
// Sweeping a direction u round the circle, the i sites furthest along u
// change only when u is square to a line through two sites.
function isets(S, e) {
  const n = S.n, ang = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) if (i !== j) ang.push((atan2(S.sy[j] - S.sy[i], S.sx[j] - S.sx[i]) + 2.5 * PI) % (2 * PI));
  ang.sort((a, b) => a - b);
  const seen = [];
  for (let i = 0; i < n; i++) seen.push(new Set());
  const ord = [];
  for (let s = 0; s < ang.length; s++) {
    const a = (ang[s] + (s + 1 < ang.length ? ang[s + 1] : ang[0] + 2 * PI)) / 2, ux = cos(a), uy = sin(a);
    ord.length = 0;
    for (let i = 0; i < n; i++) ord.push(i);
    ord.sort((p, q) => S.sx[q] * ux + S.sy[q] * uy - (S.sx[p] * ux + S.sy[p] * uy));
    let m = 0;
    for (let i = 1; i < n; i++) seen[i].add((m |= 1 << ord[i - 1]));
  }
  for (let i = 1; i < n; i++) e[i] = seen[i].size;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { n, k, sx, sy } = S;
  // The regions of the order-j diagram in the whole plane, for every j:
  // 2jn - j^2 - n + 1 less the i-sets for every i below j (D. T. Lee, 1982).
  // Against a brute-force count, the distinct j-nearest sets round every
  // crossing of two bisectors, it agreed for 319 random sets of 5 to 14
  // sites and for 60 moments of this drift at 10, 14 and 18 sites; the one
  // random set it missed had three sites on a line. Points in convex
  // position give j(n - j) + 1, and j = 2 gives 3n - 3 - h for h corners
  // of the hull, the number of Delaunay edges: an order-2 region is a pair
  // of sites whose Voronoi cells touch.
  const e = new Int32Array(NMAX);
  isets(S, e);
  let sum = 0;
  for (let j = 1; j < n; j++) {
    S.plane[j] = 2 * j * n - j * j - n + 1 - sum;
    sum += e[j];
  }
  // Site colours: n hues evenly round the wheel, so their unit vectors sum
  // to nothing. A region takes the direction of the sum over its k sites,
  // so two regions that share k - 1 sites differ by one vector in k, and in
  // the farthest-point diagram the region that leaves out site p takes the
  // hue opposite p's. Saturation follows the length of the sum against
  // sqrt(k (n - k) / (n - 1)), its root mean square over random k-sets.
  const hx = [], hy = [];
  for (let i = 0; i < n; i++) (hx[i] = cos(2 * PI * (i / n + S.hue + 0.05))), (hy[i] = sin(2 * PI * (i / n + S.hue + 0.05)));
  const ref = sqrt((k * (n - k)) / (n - 1));
  const cache = new Map();
  const colour = (m) => {
    let c = cache.get(m);
    if (c) return c;
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) (x += hx[i]), (y += hy[i]);
    const z = hypot(x, y) / ref;
    c = hsv(atan2(y, x) / (2 * PI), 0.3 + 0.45 * smooth(0, 1.4, z), 1);
    cache.set(m, c);
    return c;
  };
  const d2 = new Float64Array(NMAX), id = new Int32Array(NMAX);
  // Every prefix of the sorted list is the region of one order, so one pass
  // counts the regions with an LED centre on the panel for every order.
  const sets = [];
  for (let j = 0; j < n; j++) sets.push(new Set());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // All n distances, sorted by insertion: n is at most 18.
      for (let i = 0; i < n; i++) {
        const v = (x + 0.5 - sx[i]) ** 2 + (y + 0.5 - sy[i]) ** 2;
        let j = i;
        while (j > 0 && d2[j - 1] > v) (d2[j] = d2[j - 1]), (id[j] = id[j - 1]), j--;
        d2[j] = v;
        id[j] = i;
      }
      let m = 0;
      for (let j = 0; j < k; j++) m |= 1 << id[j];
      let q = 0;
      for (let j = 1; j < n; j++) sets[j].add((q |= 1 << id[j - 1]));
      // The region ends where the k-th and the (k+1)-th nearest swap: the
      // distance to the bisector of those two sites.
      const a = id[k - 1], b = id[k];
      const edge = (d2[k] - d2[k - 1]) / (2 * hypot(sx[a] - sx[b], sy[a] - sy[b]));
      const c = colour(m);
      const v = 0.76 + 0.24 * smooth(0, 7, edge), line = 1 - smooth(0.3, 1.1, edge);
      let r = c[0] * v, g = c[1] * v, bl = c[2] * v;
      r += (0.95 - r) * line;
      g += (0.95 - g) * line;
      bl += (0.95 - bl) * line;
      // Under the chart the diagram goes on at a twelfth.
      const f = y < STRIP ? 255 : 21;
      display.setPixel(x, y, r * f, g * f, bl * f);
    }
  for (let j = 1; j < n; j++) S.panel[j] = sets[j].size;
  // The farthest-point diagram: the smallest circle round all the sites,
  // dotted, and its centre, which lies on the tree.
  if (k === n - 1) {
    const [cx, cy, R] = enclosing(S);
    const steps = round(2 * PI * R);
    for (let i = 0; i < steps; i += 2) {
      const x = round(cx + R * cos((2 * PI * i) / steps) - 0.5), y = round(cy + R * sin((2 * PI * i) / steps) - 0.5);
      if (x >= 0 && x < W && y >= 0 && y < STRIP) display.setPixel(x, y, 235, 235, 235);
    }
    const x = round(cx - 0.5), y = round(cy - 0.5);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const r = max(abs(dx), abs(dy));
        if (r === 1 || x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= STRIP) continue;
        if (r === 0) display.setPixel(x, y, 255, 255, 255);
        else if (dx === 0 || dy === 0 || abs(dx) === abs(dy)) display.setPixel(x + dx, y + dy, 255, 255, 255);
      }
  }
  // The sites, white with a dark rim.
  for (let i = 0; i < n; i++) {
    const x = floor(sx[i]), y = floor(sy[i]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) display.setPixel(x + dx, y + dy, 20, 20, 30);
    display.setPixel(x, y, 255, 255, 255);
  }
  // The chart: one bar for each order 1 to n - 1, as tall as its count of
  // regions in the whole plane, the part that has an LED on the panel
  // brighter, the bar of this order white with its count above it.
  let fmax = 1;
  for (let j = 1; j < n; j++) fmax = max(fmax, S.plane[j]);
  const bw = floor(60 / (n - 1)), x0 = floor((W - bw * (n - 1)) / 2);
  for (let j = 1; j < n; j++) {
    const hp = max(1, round((7 * S.plane[j]) / fmax)), hv = min(hp, round((7 * S.panel[j]) / fmax)), on = j === k;
    for (let r = 0; r < hp; r++)
      for (let c = 0; c < bw - 1; c++) {
        const lit = r < hv;
        const col = on ? (lit ? [255, 255, 255] : [120, 120, 130]) : lit ? [110, 125, 150] : [45, 50, 64];
        display.setPixel(x0 + (j - 1) * bw + c, 127 - r, col[0], col[1], col[2]);
      }
  }
  const txt = String(S.plane[k]), tw = txt.length * 4 - 1;
  const tx = cl(round(x0 + (k - 1) * bw + (bw - 1) / 2 - tw / 2), 1, W - 1 - tw);
  for (let c = 0; c < txt.length; c++) {
    const f = FIG[txt.charCodeAt(c) - 48];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") display.setPixel(tx + c * 4 + q, 115 + r, 255, 255, 255);
  }
}

// The smallest circle holding every site: it passes through two sites on a
// diameter or through three, so try every pair and triple. 18 sites make
// 816 triples.
function enclosing(S) {
  const { n, sx, sy } = S;
  let best = [0, 0, 1e9];
  const holds = (cx, cy, r) => {
    for (let i = 0; i < n; i++) if ((sx[i] - cx) ** 2 + (sy[i] - cy) ** 2 > r * r + 1e-6) return false;
    return true;
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const cx = (sx[i] + sx[j]) / 2, cy = (sy[i] + sy[j]) / 2, r = hypot(sx[i] - sx[j], sy[i] - sy[j]) / 2;
      if (r < best[2] && holds(cx, cy, r)) best = [cx, cy, r];
      for (let l = j + 1; l < n; l++) {
        const ax = sx[j] - sx[i], ay = sy[j] - sy[i], bx = sx[l] - sx[i], by = sy[l] - sy[i], dd = 2 * (ax * by - ay * bx);
        if (abs(dd) < 1e-9) continue;
        const ux = (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / dd, uy = (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / dd;
        const R = hypot(ux, uy);
        if (R < best[2] && holds(sx[i] + ux, sy[i] + uy, R)) best = [sx[i] + ux, sy[i] + uy, R];
      }
    }
  return best;
}
