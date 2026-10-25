// ===== Patternflow pattern =====
// Title:   Haunted Manor
// Family:  halloween
// Idea:    A crooked house with two spired towers and a dead tree stands on a hill under a violet storm, rain slanting across, and every few seconds a branching bolt cracks down behind it, the sky flashes pale violet and the house goes stark black while its orange and green windows flicker, a figure passes behind one and a shutter bangs.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Storm=0..1, Lights=0..1
//
// Knob 1: Hue. The storm's tint, kept to the cool side of the wheel so the dim sky never reads brown: violet at 0, blue at 0.25, teal at 0.5, sea green at 0.75 and a sickly green at 1. The flash pales the same hue; the windows stay orange and green.
// Knob 2: Speed. Rain falls at 115 LEDs a second at 2, so a drop crosses the panel in about a second; 30 at 0.2 and 160 at 3. Clouds, candle flicker, the figure and the shutter run on the same clock, and the gaps between strikes stretch by 2 over Speed, though never past 2.9 times; a flash always lasts the same half second.
// Knob 3: Storm. At 0 a strike comes every 4.2 seconds on average (each gap 0.6 to 1.4 times that) and 90 drops a second fall; at 1 every 1.1 seconds and 330 drops. The first strike always comes 2.4 seconds after the start, down behind the house; later ones may hit the tall spire or the tree.
// Knob 4: Lights. How many of the thirteen windows are lit: 2 at 0, 3 at the opening 0.06, 8 at 0.5 and all 13 at 1, each with a one-LED glow on the wall round it. Every 4 to 8 seconds one room goes dark and another lights. The wet ground under the house mirrors the lower windows and the door, broken into rippling rows.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// A fixed generator for the house and the tree, so they never change with
// the knobs; Math.random is left for the weather.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise on a 16 x 16 lattice that wraps.
const LAT = new Float32Array(256);
{
  const r = prng(7);
  for (let i = 0; i < 256; i++) LAT[i] = r();
}
function noise(x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = LAT[(yi & 15) * 16 + (xi & 15)], b = LAT[(yi & 15) * 16 + ((xi + 1) & 15)];
  const c = LAT[((yi + 1) & 15) * 16 + (xi & 15)], d = LAT[((yi + 1) & 15) * 16 + ((xi + 1) & 15)];
  return mix(mix(a, b, u), mix(c, d, u), v);
}

// The hill's top edge.
const hillTop = (x) => 101 + 0.0075 * (x - 20) * (x - 20);

// The house, part by part: a polygon and how far it leans, in LEDs per row
// above row 108. Windows are rectangles (or a circle) in the part they sit in.
const PARTS = [
  { lean: 0.03, pts: [[1, 50], [11, 50], [11, 108], [1, 108]] },
  { lean: 0.03, pts: [[-1, 51], [13, 51], [8.5, 34], [10, 15], [5.5, 32]] },
  { lean: -0.012, pts: [[10, 74], [36, 74], [36, 108], [10, 108]] },
  { lean: -0.012, pts: [[7.5, 75], [38.5, 75], [24.5, 48], [22.5, 46.5], [20.5, 49]] },
  { lean: 0.05, pts: [[29, 64], [32, 64], [32, 53], [29, 53]] },
  { lean: 0.05, pts: [[28, 53], [33, 53], [33, 51], [28, 51]] },
  { lean: -0.045, pts: [[34, 68], [43, 68], [43, 106], [34, 106]] },
  { lean: -0.045, pts: [[32, 69], [45, 69], [38.5, 49]] },
  { lean: -0.012, pts: [[17, 92], [29, 92], [23, 87]] },
];
// Windows: part, x0, y0, width, height (or round with a radius), colour
// 0 orange, 1 green. The order is the order they light in as Lights rises.
const WINDOWS = [
  { part: 2, x: 11, y: 77, w: 9, h: 10, c: 0 },
  { part: 3, round: true, x: 22.5, y: 63, r: 3.2, c: 1 },
  { part: 2, x: 26, y: 92, w: 9, h: 10, c: 0 },
  { part: 0, x: 4, y: 56, w: 5, h: 9, c: 1, arch: true },
  { part: 2, x: 26, y: 77, w: 9, h: 10, c: 0 },
  { part: 6, x: 36, y: 74, w: 5, h: 8, c: 0, arch: true },
  { part: 2, x: 20.5, y: 94, w: 5, h: 14, c: 0, arch: true, door: true },
  { part: 0, x: 4, y: 72, w: 5, h: 9, c: 0 },
  { part: 2, x: 11, y: 92, w: 9, h: 10, c: 1 },
  { part: 1, x: 6, y: 38, w: 3, h: 5, c: 0, arch: true },
  { part: 3, x: 13, y: 67, w: 3, h: 4, c: 0 },
  { part: 3, x: 29, y: 67, w: 3, h: 4, c: 1 },
  { part: 6, x: 36, y: 89, w: 5, h: 8, c: 0, arch: true },
];
const NW = WINDOWS.length;
// The tip of the tall spire, leant.
const SPIRE = [10 + 0.03 * (108 - 15), 15];

function inPoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// The dead tree: branches as segments, each with its parent, grown once from
// a fixed seed. Each frame they are laid out again with the wind's sway.
function growTree() {
  const r = prng(31), segs = [];
  const grow = (parent, ang, len, depth, width) => {
    const i = segs.length;
    segs.push({ parent, ang, len, width, depth });
    if (depth >= 5 || len < 3) return;
    const kids = depth < 2 ? 2 : r() < 0.35 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const spread = (k - (kids - 1) / 2) * (0.55 + 0.35 * r()) + (r() - 0.5) * 0.3;
      grow(i, ang + spread, len * (0.62 + 0.18 * r()), depth + 1, max(1, width - 1));
    }
  };
  grow(-1, -PI / 2 + 0.1, 22, 0, 3);
  return segs;
}
const TREE_X = 55;

// Branch ends for a given sway, root first; each branch bends with the wind
// in proportion to how far out it is.
function layTree(tree, sway, ends) {
  for (let i = 0; i < tree.length; i++) {
    const g = tree[i];
    const x0 = g.parent < 0 ? TREE_X : ends[g.parent][2], y0 = g.parent < 0 ? hillTop(TREE_X) + 2 : ends[g.parent][3];
    const a = g.ang + sway * g.depth;
    ends[i] = [x0, y0, x0 + cos(a) * g.len, y0 + sin(a) * g.len];
  }
  return ends;
}

export function setup(params) {
  const house = new Uint8Array(N), win = new Int8Array(N).fill(-1), pane = new Uint8Array(N);
  // Window pixels keep their place in the window, for mullions and figures.
  const wx = new Float32Array(N), wy = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, X = x + 0.5, Y = y + 0.5;
      if (Y >= hillTop(X)) house[p] = 2;
      for (let k = 0; k < PARTS.length; k++) {
        const part = PARTS[k], sx = X - part.lean * (108 - Y);
        if (inPoly(part.pts, sx, Y)) house[p] = 1;
      }
      for (let n = 0; n < NW; n++) {
        const w = WINDOWS[n], part = PARTS[w.part], sx = X - part.lean * (108 - Y);
        let inside = false, u = 0, v = 0;
        if (w.round) {
          const dx = sx - w.x, dy = Y - w.y;
          inside = dx * dx + dy * dy <= w.r * w.r;
          u = dx;
          v = dy;
          if (inside && (abs(dx) < 0.5 || abs(dy) < 0.5)) pane[p] = 1;
        } else {
          inside = sx >= w.x && sx < w.x + w.w && Y >= w.y && Y < w.y + w.h;
          u = sx - w.x;
          v = Y - w.y;
          if (inside && w.arch && v < 1 && (u < 1 || u >= w.w - 1)) inside = false;
          if (inside && !w.door && w.w > 3 && (floor(u) === floor(w.w / 2) || floor(v) === floor(w.h * 0.4))) pane[p] = 1;
        }
        if (inside) {
          win[p] = n;
          wx[p] = u;
          wy[p] = v;
        }
      }
    }
  const tree = growTree(), still = layTree(tree, 0, []);
  let treeTop = [TREE_X, 99];
  for (const e of still) if (e[3] < treeTop[1]) treeTop = [e[2], e[3]];
  // A one-LED glow round each window on the wall: which window, and how
  // strong (full beside an edge, less at a corner).
  const halo = new Int8Array(N).fill(-1), haloW = new Float32Array(N);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (house[p] !== 1 || win[p] >= 0) continue;
      for (const [dx, dy, wt] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 0.5], [-1, 1, 0.5], [1, -1, 0.5], [-1, -1, 0.5]]) {
        const n = win[p + dy * W + dx];
        if (n >= 0 && wt > haloW[p]) (halo[p] = n), (haloW[p] = wt);
      }
    }
  params.s = {
    hue: 0, speed: 2, storm: 0, lights: 0.06,
    t: 0, clock: 0, house, win, pane, wx, wy, halo, haloW,
    tree, treeMask: new Uint8Array(N), ends: [], treeTop,
    drops: [], dropCarry: 0,
    // Windows: how lit each is (0..1), the flicker phase, and the order.
    lit: new Float32Array(NW), fl: new Float32Array(NW),
want: new Uint8Array(NW), order: WINDOWS.map((_, i) => i),
    swapAt: 6, gust: 0,
    // Lightning: when the strike began, its strokes, the bolt as a field.
    strikeAt: -99, nextStrike: 2.4, strikes: 0, strokes: [], bolt: new Float32Array(N), boltX: 32,
    figure: null, figureAt: 4, shutter: null, shutterAt: 3,
    rgb: new Float32Array(3), sky: new Float32Array(3), buf: new Float32Array(N * 3),
  };
}

// The bolt: a jagged main channel by midpoint displacement from the top of
// the panel to its target, and a few branches peeling off it.
function makeBolt(S) {
  const b = S.bolt;
  b.fill(0);
  // The first strike comes down behind the house; later ones may hit the
  // tall spire or the top of the tree instead.
  const first = S.strikes++ === 0, pick = first ? 1 : Math.random();
  const x0 = first ? 30 + Math.random() * 16 : 6 + Math.random() * 52;
  let tx, ty;
  if (pick < 0.2) (tx = SPIRE[0]), (ty = SPIRE[1]);
  else if (pick < 0.35) (tx = S.treeTop[0]), (ty = S.treeTop[1]);
  else (tx = first ? 22 + Math.random() * 14 : 4 + Math.random() * 56), (ty = 100);
  S.boltX = (x0 + tx) / 2;
  const path = (ax, ay, bx, by, rough, depth, out) => {
    if (depth === 0) {
      out.push([bx, by]);
      return;
    }
    const L = sqrt((bx - ax) ** 2 + (by - ay) ** 2);
    const mx = (ax + bx) / 2 + (Math.random() - 0.5) * L * rough, my = (ay + by) / 2 + (Math.random() - 0.5) * L * rough * 0.3;
    path(ax, ay, mx, my, rough, depth - 1, out);
    path(mx, my, bx, by, rough, depth - 1, out);
  };
  const line = (pts, level) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = max(1, Math.ceil(max(abs(bx - ax), abs(by - ay)) * 2));
      for (let s = 0; s <= n; s++) {
        const x = floor(ax + ((bx - ax) * s) / n), y = floor(ay + ((by - ay) * s) / n);
        if (x >= 0 && x < W && y >= 0 && y < H && b[y * W + x] < level) b[y * W + x] = level;
      }
    }
  };
  const main = [[x0, -2]];
  path(x0, -2, tx, ty, 0.55, 6, main);
  line(main, 1);
  const branches = 2 + floor(Math.random() * 3);
  for (let k = 0; k < branches; k++) {
    const at = main[3 + floor(Math.random() * (main.length * 0.6))];
    const side = Math.random() < 0.5 ? -1 : 1, len = 12 + Math.random() * 22;
    const br = [[at[0], at[1]]];
    path(at[0], at[1], at[0] + side * len * 0.8, at[1] + len * 0.7, 0.6, 4, br);
    line(br, 0.55);
  }
  // A glow one LED round the channel.
  const glow = Float32Array.from(b);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (b[p] > 0) continue;
      let g = 0;
      if (x > 0) g = max(g, glow[p - 1]);
      if (x < W - 1) g = max(g, glow[p + 1]);
      if (y > 0) g = max(g, glow[p - W]);
      if (y < H - 1) g = max(g, glow[p + W]);
      b[p] = 0.45 * g;
    }
  // Two to four return strokes down the same channel.
  S.strokes = [0];
  const extra = 1 + floor(Math.random() * 3);
  for (let k = 0; k < extra; k++) S.strokes.push(S.strokes[k] + 0.07 + Math.random() * 0.09);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.storm = cl(k[2], 0, 1);
  S.lights = cl(k[3], 0, 1);
  const sp = S.speed / 2, ds = d * sp;
  S.t += d;
  S.clock += ds;
  S.gust = 0.5 + 0.5 * sin(S.clock * 0.7 + 1.5 * sin(S.clock * 0.23));

  // Lightning on the knob's clock, except the first, at 2.4 s.
  if (S.t >= S.nextStrike) {
    S.strikeAt = S.t;
    makeBolt(S);
    const mean = mix(4.2, 1.1, S.storm);
    S.nextStrike = S.t + (mean * (0.6 + 0.8 * Math.random())) / max(0.35, sp);
  }

  // Rain: drops spawned at the top at a rate set by Storm.
  const rate = mix(90, 330, S.storm) * sp;
  S.dropCarry += rate * d;
  const vy0 = 95 * sp + 20;
  while (S.dropCarry >= 1) {
    S.dropCarry -= 1;
    S.drops.push({ x: -20 + Math.random() * (W + 30), y: -8 - Math.random() * 20, v: vy0 * (0.8 + 0.4 * Math.random()), l: 3 + floor(Math.random() * 4), a: 0.5 + 0.5 * Math.random() });
  }
  const slant = 0.18 + 0.22 * S.gust;
  for (const r of S.drops) {
    r.y += r.v * d;
    r.x += r.v * slant * d;
  }
  S.drops = S.drops.filter((r) => r.y < H + 8 && r.y < hillTop(r.x) + 6);
  S.slant = slant;

  // Windows: the first n of the order want light; now and then one room goes
  // dark and another lights.
  const n = round(2 + 11 * S.lights);
  if (S.clock >= S.swapAt && n < NW) {
    S.swapAt = S.clock + 4 + 4 * Math.random();
    const a = floor(Math.random() * n), b = n + floor(Math.random() * (NW - n));
    [S.order[a], S.order[b]] = [S.order[b], S.order[a]];
  }
  S.want.fill(0);
  for (let i = 0; i < n; i++) S.want[S.order[i]] = 1;
  for (let i = 0; i < NW; i++) S.lit[i] = cl(S.lit[i] + (S.want[i] ? 1 : -1) * d * 3, 0, 1);
  if (S.t < d * 1.5) for (let i = 0; i < NW; i++) S.lit[i] = S.want[i];

  // A figure crossing a lit window, left to right or right to left.
  if (!S.figure && S.clock >= S.figureAt) {
    const cands = [0, 2, 4, 8].filter((i) => S.lit[i] > 0.9);
    if (cands.length) S.figure = { w: cands[floor(Math.random() * cands.length)], u: 0, dir: Math.random() < 0.5 ? 1 : -1 };
    S.figureAt = S.clock + 5 + 5 * Math.random();
  }
  if (S.figure) {
    S.figure.u += ds / 1.8;
    if (S.figure.u >= 1) S.figure = null;
  }
  // A shutter banging shut and swinging open on a gust.
  if (!S.shutter && S.clock >= S.shutterAt) {
    const cands = [];
    for (let i = 0; i < NW; i++) if (S.lit[i] > 0.9 && !WINDOWS[i].round) cands.push(i);
    if (cands.length) S.shutter = { w: cands[floor(Math.random() * cands.length)], u: 0 };
    S.shutterAt = S.clock + 4 + 5 * Math.random();
  }
  if (S.shutter) {
    S.shutter.u += ds;
    if (S.shutter.u >= 1.2) S.shutter = null;
  }
}

// How bright the strike is t seconds after it began: a spike for each
// return stroke and a slow afterglow.
function flashAt(S, t) {
  if (t < 0 || t > 3) return [0, 0, 0];
  let spike = 0, chan = 0;
  for (const s of S.strokes)
    if (t >= s) {
      spike = max(spike, exp(-(t - s) / 0.05));
      chan = max(chan, exp(-(t - s) / 0.12));
    }
  return [spike, exp(-t / 0.55), chan];
}

// How much of the window a shutter covers, from its hinge: shut in 0.06 s,
// open again, a smaller swing back, and still by 1.2.
function shutterCover(u) {
  if (u < 0.06) return u / 0.06;
  if (u < 0.3) return 1 - sm(0.06, 0.3, u);
  if (u < 0.5) return 0.6 * sm(0.3, 0.42, u) * (1 - sm(0.42, 0.5, u));
  if (u < 0.75) return 0.25 * sm(0.5, 0.6, u) * (1 - sm(0.6, 0.75, u));
  return 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { house, win, pane, wx, wy, bolt, lit, halo, haloW } = S;
  const ts = S.t - S.strikeAt, [spike, glow, chan] = flashAt(S, ts);
  // The channel stays a moment after the strokes as a fading violet trace.
  const flash = min(1, 0.62 * spike + 0.3 * glow), boltOn = max(chan, 0.3 * glow * glow);
  const skyH = 0.76 - 0.44 * S.hue, col = S.rgb, lite = S.sky;
  // What the sky turns to at full flash: the storm's own hue, pale.
  hsv(skyH, 0.32, 1, lite);
  // The tree, laid out with the wind.
  const tm = S.treeMask;
  tm.fill(0);
  const sway = (S.gust - 0.5) * 0.08 + 0.02 * sin(S.clock * 5.3);
  const ends = layTree(S.tree, sway, S.ends);
  for (let i = 0; i < S.tree.length; i++) {
    const g = S.tree[i], [x0, y0, x1, y1] = ends[i];
    const steps = Math.ceil(g.len * 2), hw = g.width / 2;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      for (let yy = floor(y - hw + 0.5); yy <= floor(y + hw - 0.5); yy++)
        for (let xx = floor(x - hw + 0.5); xx <= floor(x + hw - 0.5); xx++) if (xx >= 0 && xx < W && yy >= 0 && yy < H) tm[yy * W + xx] = 1;
    }
  }
  // The figure's place, in the window's own columns.
  const fig = S.figure, fw = fig ? WINDOWS[fig.w] : null;
  const fx = fig ? (fig.dir > 0 ? mix(-3, fw.w + 3, fig.u) : mix(fw.w + 3, -3, fig.u)) : 0;
  const sh = S.shutter, shCover = sh ? shutterCover(sh.u) : 0;
  const rgb = S.buf, fl = S.fl;
  for (let n = 0; n < NW; n++) fl[n] = lit[n] * (0.78 + 0.22 * noise(S.clock * 7 + n * 3.7, n * 5.1));
  for (let y = 0; y < H; y++) {
    const yt = y / 100;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, q = p * 3;
      let r, g, b;
      const hm = house[p] || tm[p];
      if (!hm) {
        // Sky: a violet gradient, brighter toward the hill, with storm
        // clouds drifting across, lit up by the flash nearest the bolt.
        const c1 = noise(x / 20 + S.clock * 0.25, y / 13 + 2), c2 = noise(x / 11 + S.clock * 0.45 + 5, y / 8);
        const cloud = cl((0.75 * c1 + 0.25 * c2 - 0.35) * 1.8, 0, 1) * (1 - sm(0.3, 0.85, yt));
        hsv(skyH + 0.03 * yt, 0.72 - 0.15 * yt - 0.25 * cloud, 0.2 + 0.2 * yt + 0.16 * cloud, col);
        const near = 0.55 + 0.45 * exp(-((x - S.boltX) ** 2) / 600);
        const f = flash * near * (0.85 + 0.25 * cloud);
        r = mix(col[0], lite[0], f);
        g = mix(col[1], lite[1], f);
        b = mix(col[2], lite[2], f);
        const bl = bolt[p] * boltOn;
        if (bl > 0) {
          const wt = min(1, chan * 2);
          r = mix(r, mix(lite[0], 1, wt), bl);
          g = mix(g, mix(lite[1], 1, wt), bl);
          b = mix(b, mix(lite[2], 1, wt), bl);
        }
      } else {
        // Hill, house and tree: dark, and black while the sky is lit.
        const k = 1 - min(1, flash * 2.2);
        r = 0.07 * k;
        g = 0.04 * k;
        b = 0.1 * k;
        const n = house[p] === 1 ? win[p] : -1;
        if (house[p] === 2 && !tm[p] && y > 108) {
          // The wet ground under the house mirrors what is lit above row
          // 108, each row shifted a little and some rows dropped, more of
          // them further down. Rows above are already drawn, so it copies.
          const dy = y - 108, sy = 216 - y, sx = x + round(0.9 * sin(dy * 3.1 + S.clock * 4));
          if (sx >= 0 && sx < W && sin(dy * 2.3 - S.clock * 5) > -0.6 + dy / 16) {
            const sp = sy * W + sx;
            if (house[sp] === 1 && win[sp] >= 0) {
              r = 0.8 * rgb[sp * 3];
              g = 0.8 * rgb[sp * 3 + 1];
              b = 0.8 * rgb[sp * 3 + 2];
            }
          }
        }
        const hn = house[p] === 1 ? halo[p] : -1;
        if (hn >= 0 && fl[hn] > 0) {
          const a = 0.42 * haloW[p] * fl[hn] * k, c = WINDOWS[hn].c;
          r += ((c ? 0.45 : 1) - r) * a;
          g += ((c ? 1 : 0.5) - g) * a;
          b += ((c ? 0.18 : 0.1) - b) * a;
        }
        if (n >= 0 && lit[n] > 0) {
          const w = WINDOWS[n];
          let on = fl[n];
          if (pane[p]) on *= 0.15;
          if (fig && fig.w === n) {
            const u = wx[p], v = wy[p], du = u - fx;
            if (du * du + (v - 2.2) ** 2 < 2.6 || (v > 3.6 && abs(du) < 1.2 + 0.6 * (v - 3.6))) on *= 0.06;
          }
          if (sh && sh.w === n && wx[p] >= w.w * (1 - shCover)) on *= 0.04;
          if (w.c === 0) (r = 1 * on), (g = 0.5 * on), (b = 0.1 * on);
          else (r = 0.45 * on), (g = 1 * on), (b = 0.18 * on);
        }
      }
      rgb[q] = r;
      rgb[q + 1] = g;
      rgb[q + 2] = b;
    }
  }
  // Rain over everything, pale, turning white while the sky is lit.
  const sl = S.slant, rl = mix(0.28, 0.85, flash);
  for (const d of S.drops) {
    for (let s = 0; s < d.l; s++) {
      const x = floor(d.x - sl * s), y = floor(d.y - s);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const q = (y * W + x) * 3, a = d.a * rl * (1 - s / (d.l + 1));
      rgb[q] += (0.75 - rgb[q]) * a;
      rgb[q + 1] += (0.72 - rgb[q + 1]) * a;
      rgb[q + 2] += (0.95 - rgb[q + 2]) * a;
    }
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
