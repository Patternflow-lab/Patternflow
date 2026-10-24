// ===== Patternflow pattern =====
// Title:   Constant Width
// Family:  geometry
// Idea:    A column of curves of constant width 62, Reuleaux triangles, pentagons and heptagons, smooth curves built from odd harmonics and a disc, slides down a channel exactly 62 LEDs wide, each turning at its own rate while it touches both walls and the lines it shares with the curves above and below, so the stack never jams and never comes apart.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Curves of constant width, the Reuleaux polygons (Franz Reuleaux, 1876), and Barbier's theorem that they all have perimeter pi times their width (Joseph-Émile Barbier, 1860)
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Round=0..1, Spin=0..1
//
// Knob 1: Hue. Turns the eight colours round the wheel together. At 0 the Reuleaux polygons are gold, rose, teal and lime, lit to 81%, and the smooth curves and the disc violet, azure, indigo and sky at 52%. Where a deep one would land between orange and lime it is lifted and paled, since there it would read brown or olive.
// Knob 2: Speed. How fast the column slides: 3 rows a second times the knob, so at 2 a curve takes 10 seconds to pass down its own height of 62 rows and at 0.2 it takes 100.
// Knob 3: Round. Mixes every curve with the disc of the same width, support function by support function, which keeps the width at 62. At 0 the Reuleaux triangle has the least area a curve of width 62 can have, 2709 LEDs; at 1 every curve is the disc, 3019. The perimeter stays 194.8 the whole way.
// Knob 4: Spin. How fast the curves turn, 0.4 radians a second at 0 and 3 at 1; neighbours turn opposite ways and each at its own multiple of that.
// Buttons: K1 tap turns the corner trace on or off: each corner leaves a gold line in its own 62 x 62 square, and a turning Reuleaux triangle draws the square with rounded corners that the Watts drill cuts.

const W = 64, H = 128, WD = 62, N = 256, CYCLE = 8;
const { min, max, floor, ceil, round, sin, cos, sqrt, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The eight curves of the cycle, all of width WD. A Reuleaux n-gon is the
// intersection of the n disks of radius WD centred on the corners of a
// regular n-gon whose corner-to-far-corner distance is WD. A harmonic curve
// has support function h = WD/2 + sum a cos(k t + c) over odd k from 3 up:
// odd k is what makes h(t) + h(t + pi) = WD, the width in every direction,
// and the radius of curvature h + h'' = WD/2 - sum a (k^2 - 1) cos(k t + c)
// stays above 0, so it is convex. The amplitudes below keep that radius at
// least 2 LEDs.
const SHAPES = [
  { n: 3 },
  { harm: [[3, 3.6, 0]] },
  { n: 5 },
  { harm: [[3, 2.2, 0], [5, 0.5, 1.1]] },
  { n: 7 },
  { disc: true },
  { n: 3 },
  { harm: [[3, 2.6, 0], [7, 0.16, 2.0]] },
];
// Base hue and brightness for each place in the cycle. The sharp curves are
// lit brighter than the smooth ones, so the column reads as light and deep
// shapes taking turns as it slides. The map's drift comes mostly from the
// dark corners of each square, which swing round as the curves turn: with
// all eight at one brightness it reads 0.263, with these 0.277.
const BASE = [[0.13, 0.86], [0.76, 0.55], [0.95, 0.86], [0.6, 0.55], [0.48, 0.86], [0.68, 0.55], [0.3, 0.86], [0.54, 0.55]];
// The body angles each curve's trace follows: the n corners of a Reuleaux
// polygon and the k peaks of a curve with one harmonic, which all run round
// the same path, and for a curve of two harmonics the one point where its
// support function peaks, since its corners are not alike and each would
// draw a path of its own.
for (const s of SHAPES) {
  if (s.n) s.tr = Array.from({ length: s.n }, (_, c) => (TAU * c) / s.n);
  else if (s.harm && s.harm.length === 1) {
    const [k, , c0] = s.harm[0];
    s.tr = Array.from({ length: k }, (_, m) => (TAU * m - c0) / k);
  } else if (s.harm) {
    let best = -1e9, at = 0;
    for (let i = 0; i < 3600; i++) {
      const b = (TAU * i) / 3600;
      let h = 0;
      for (const [k, a, c] of s.harm) h += a * cos(k * b + c);
      if (h > best) (best = h), (at = b);
    }
    s.tr = [at];
  } else s.tr = [0];
}

// Support function h and its derivative at body angle b, for a curve mixed
// a share t of the way to the disc.
function support(s, b, t, out) {
  let h, d;
  if (s.n) {
    const n = s.n, R = WD / (2 * cos(PI / (2 * n))), step = TAU / n, half = PI / (2 * n);
    let del = b - round(b / step) * step;
    if (abs(del) <= half) (h = R * cos(del)), (d = -R * sin(del));
    else {
      // The opposite direction falls in a corner's cone, so here the curve
      // is the arc of radius WD round that corner.
      const b2 = b + PI;
      del = b2 - round(b2 / step) * step;
      (h = WD - R * cos(del)), (d = R * sin(del));
    }
  } else if (s.harm) {
    (h = WD / 2), (d = 0);
    for (const [k, a, c] of s.harm) (h += a * cos(k * b + c)), (d -= a * k * sin(k * b + c));
  } else (h = WD / 2), (d = 0);
  out[0] = (1 - t) * h + (t * WD) / 2;
  out[1] = (1 - t) * d;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, round: 0, spin: 0.06,
    // The column's slide in rows and the spin clock in radians.
    slide: 15, clock: 0,
    trace: false, traces: new Map(),
    px: new Float32Array(N), py: new Float32Array(N),
    xl: new Float32Array(H), xr: new Float32Array(H),
    lab: new Int8Array(W * H), rgb: new Float32Array(W * H * 3),
    col: new Float32Array(CYCLE * 6), colHue: NaN, sup: new Float32Array(2),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.round = cl(k[2], 0, 1);
  P.spin = cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) {
    P.trace = !P.trace;
    P.traces.clear();
  }
  P.slide += d * P.speed * 3;
  P.clock += d * (0.4 + 2.6 * P.spin);
}

// The angle a curve in slot j has turned to: neighbours turn opposite ways,
// each at a rate between 0.7 and 1.3 times the clock, from a start of its own.
const angle = (j, clock) => hash(j * 3 + 1) * TAU + (j & 1 ? -1 : 1) * (0.7 + 0.6 * hash(j * 3 + 2)) * clock;

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { px, py, xl, xr, lab, rgb, col, sup, traces } = P;
  if (P.colHue !== P.hue) {
    // Fill and rim colours for each place in the cycle. The rim is the fill
    // pushed to full brightness and halfway to white, at least 40 levels
    // above every fill so it reads as a hard line.
    // A deep fill from orange round to lime reads as brown or olive, so in
    // that band the deep curves are lifted toward the light ones' level and
    // paled a little.
    for (let c = 0; c < CYCLE; c++) {
      const h = P.hue + BASE[c][0], hf = h - floor(h), band = BASE[c][1] < 0.7 ? max(0, 1 - abs(hf - 0.14) / 0.15) : 0;
      hsv(h, 0.8 - 0.22 * band, (BASE[c][1] + 0.3 * band) * 0.94, col, c * 6);
      hsv(h, 0.45, 1, col, c * 6 + 3);
    }
    P.colHue = P.hue;
  }
  lab.fill(0);
  rgb.fill(0);
  // Slot j's top line sits at row slide - j * WD: the slots stack upward
  // with j and the column slides down as slide grows.
  const jLo = floor((P.slide - H) / WD), jHi = ceil(P.slide / WD);
  const vis = [];
  for (let j = jLo; j <= jHi; j++) {
    const top = P.slide - j * WD;
    if (top >= H || top + WD <= 0) continue;
    const shape = SHAPES[((j % CYCLE) + CYCLE) % CYCLE], phi = angle(j, P.clock);
    // Boundary points from the support function, panel direction a = 2 pi i
    // / N: the point is h u(a) + h' u'(a) with the body angle a - phi. The
    // panel's y runs down, so i = N/2 faces the left wall and 3N/4 faces up.
    for (let i = 0; i < N; i++) {
      const a = (TAU * i) / N, ca = cos(a), sa = sin(a);
      support(shape, a - phi, P.round, sup);
      px[i] = sup[0] * ca - sup[1] * sa;
      py[i] = sup[0] * sa + sup[1] * ca;
    }
    // The left support line on the inner face of the left wall, x = 1, and
    // the top one on the slot's top line. The width is WD in every
    // direction, so the right one lands on x = 63 and the bottom one on the
    // next slot's top line without being placed there.
    const ox = 1 - px[N / 2], oy = top - py[(3 * N) / 4];
    const label = vis.length + 1;
    xl.fill(1e9);
    xr.fill(-1e9);
    for (let i = 0; i < N; i++) {
      const xa = px[i] + ox, ya = py[i] + oy, i2 = (i + 1) % N, xb = px[i2] + ox, yb = py[i2] + oy;
      if (ya === yb) continue;
      const r0 = max(0, ceil(min(ya, yb) - 0.5)), r1 = min(H - 1, floor(max(ya, yb) - 0.5));
      for (let r = r0; r <= r1; r++) {
        const x = xa + ((r + 0.5 - ya) * (xb - xa)) / (yb - ya);
        if (x < xl[r]) xl[r] = x;
        if (x > xr[r]) xr[r] = x;
      }
    }
    for (let r = max(0, floor(top)); r <= min(H - 1, ceil(top + WD)); r++) {
      if (xr[r] < xl[r]) continue;
      const x0 = max(1, ceil(xl[r] - 0.5)), x1 = min(W - 2, floor(xr[r] - 0.5));
      for (let x = x0; x <= x1; x++) lab[r * W + x] = label;
    }
    vis.push({
      j, top, c: ((j % CYCLE) + CYCLE) % CYCLE, shape, phi, ox, oy,
      left: py[N / 2] + oy, right: py[0] + oy, upX: px[(3 * N) / 4] + ox, downX: px[N / 4] + ox,
    });
  }
  // Fill, with a rim wherever a 4-neighbour belongs to something else.
  for (let y = 0; y < H; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, l = lab[p];
      if (!l) continue;
      const rim = lab[p - 1] !== l || lab[p + 1] !== l || (y > 0 && lab[p - W] !== l) || (y < H - 1 && lab[p + W] !== l);
      const o = vis[l - 1].c * 6 + (rim ? 3 : 0), q = p * 3;
      (rgb[q] = col[o]), (rgb[q + 1] = col[o + 1]), (rgb[q + 2] = col[o + 2]);
    }
  // The walls: dim slate, brighter where a slot's line meets them, and white
  // over five rows where a curve touches them.
  for (let y = 0; y < H; y++)
    for (const x of [0, W - 1]) {
      const q = (y * W + x) * 3;
      (rgb[q] = 0.14), (rgb[q + 1] = 0.18), (rgb[q + 2] = 0.24);
    }
  const dot = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const q = (y * W + x) * 3;
    (rgb[q] = r), (rgb[q + 1] = g), (rgb[q + 2] = b);
  };
  for (const v of vis) {
    const ty = floor(v.top);
    for (const x of [0, W - 1]) dot(x, ty, 0.55, 0.6, 0.7);
    for (let e = -2; e <= 2; e++) dot(0, floor(v.left) + e, 1, 1, 1), dot(W - 1, floor(v.right) + e, 1, 1, 1);
    // Above and below: a small white cross where the curve meets the line.
    for (const [cx, cy] of [[v.upX, v.top], [v.downX, v.top + WD]]) {
      const x = floor(cx), y = floor(cy - (cy === v.top ? 0 : 1e-3));
      dot(x, y, 1, 1, 1), dot(x - 1, y, 1, 1, 1), dot(x + 1, y, 1, 1, 1), dot(x, y - 1, 1, 1, 1), dot(x, y + 1, 1, 1, 1);
    }
  }
  // The corner trace, kept in each slot's own square so it slides with it.
  if (P.trace) {
    const seen = new Set();
    for (const v of vis) {
      seen.add(v.j);
      let t = traces.get(v.j);
      if (!t) traces.set(v.j, (t = { xs: [], ys: [], last: null }));
      const tr = v.shape.tr, m = tr.length, now = [];
      for (let c = 0; c < m; c++) {
        // At a peak of the support function h' is 0, so the point is h times
        // the unit vector there.
        const a = tr[c] + v.phi;
        support(v.shape, tr[c], P.round, sup);
        const ca = cos(a), sa = sin(a);
        now.push([sup[0] * ca - sup[1] * sa + v.ox, sup[0] * sa + sup[1] * ca + v.oy - v.top]);
      }
      if (t.xs.length < 12000)
        for (let c = 0; c < m; c++) {
          const [x1, y1] = now[c], [x0, y0] = t.last ? t.last[c] : now[c];
          const steps = max(1, ceil(sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) / 0.7));
          for (let s = 1; s <= steps; s++) t.xs.push(x0 + ((x1 - x0) * s) / steps), t.ys.push(y0 + ((y1 - y0) * s) / steps);
        }
      t.last = now;
      for (let i = 0; i < t.xs.length; i++) dot(floor(t.xs[i]), floor(t.ys[i] + v.top), 1, 0.78, 0.25);
    }
    for (const j of traces.keys()) if (!seen.has(j)) traces.delete(j);
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, min(255, rgb[q] * 255), min(255, rgb[q + 1] * 255), min(255, rgb[q + 2] * 255));
}
