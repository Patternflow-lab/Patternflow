// ===== Patternflow pattern =====
// Title:   Unconformity
// Family:  strata
// Idea:    A cut through the ground under a shallow sea, where beds of sand, mud and lime settle one on another and the whole pile sinks, until the beds buckle up into folds that rise out of the water, the waves plane them flat, and new level beds settle over the stumps, so the panel fills downwards with tilted packages under flat ones, each cut off at a straight line.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: angular unconformity (James Hutton, Siccar Point, 1788)
// Round:   198
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Fold=-1..1, Beds=0..1
//
// Knob 1: Hue. Turns the colours of the rock together round the wheel, from sandstone, red mudstone, grey lime and dark shale where the knob opens.
// Knob 2: Pace. How fast the beds settle and how soon the ground buckles, from everything standing still at the bottom of the knob. Where it opens a bed a LED thick settles in about a second, and a fold rises, is planed off and is buried in about a minute.
// Knob 3: Fold. How hard the ground has buckled, now and every time before: at the bottom every bed lies flat and the packages read only by their colours; it opens in the middle, and at the top the folds stand taller than the sea is deep and the cuts bite through whole packages.
// Knob 4: Beds. How thick the beds are, from about 4 LEDs where the knob opens to about 14 at the top.

const W = 64;
const H = 128;
// The sea floor lies this many rows down; above it is water.
const FLOOR = 20;
// LEDs of rock that settle each second at Pace 1, and how long a fold takes to rise and to be planed off at Pace 1.
const SETTLE = 0.6;
const RISE = 28;
const PLANE = 22;
// A package grows this thick, give or take half as much again, before the ground buckles.
const PACKAGE = 40;
// The tallest uplift, in LEDs, at Fold 0. It is more than a package is thick, so the waves cut down through the crests into the package below while the troughs keep the young beds.
const UPLIFT = 30;

// The rock: sandstone, red mudstone, grey lime, dark shale, ochre, pale ash, green clay.
const ROCK = [
  [196, 158, 98],
  [158, 66, 46],
  [150, 150, 140],
  [86, 78, 92],
  [206, 128, 44],
  [230, 224, 206],
  [98, 128, 88],
];
// Each package is laid down from one of these threes, so that a package reads apart from the one on top of it.
const SUITES = [
  [0, 1, 5],
  [2, 3, 4],
  [6, 0, 1],
  [4, 5, 3],
  [1, 2, 0],
  [5, 6, 4],
];

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// A new shape for the ground to buckle into: two folds of different lengths and a tilt, all lifting, never sinking.
function shape() {
  return {
    a1: 0.45 + 0.35 * Math.random(),
    k1: (Math.PI * 2) / (30 + 50 * Math.random()),
    p1: Math.random() * Math.PI * 2,
    a2: 0.08 + 0.2 * Math.random(),
    k2: (Math.PI * 2) / (16 + 20 * Math.random()),
    p2: Math.random() * Math.PI * 2,
    tilt: (Math.random() - 0.5) * 0.7,
    // Which colours of the rock this package is made of.
    pal: SUITES[Math.floor(Math.random() * SUITES.length)],
    id: Math.floor(Math.random() * 1e6),
  };
}

// A shape for the package laid on top of one with shape prev, never from the same three colours.
function shapeOn(prev) {
  const sh = shape();
  while (sh.pal === prev.pal) sh.pal = SUITES[Math.floor(Math.random() * SUITES.length)];
  return sh;
}

// How far the shape lifts the ground at column x, in LEDs at Fold 0.
function lift(sh, x) {
  const f1 = 0.5 + 0.5 * Math.sin(sh.k1 * x + sh.p1);
  const f2 = 0.5 + 0.5 * Math.sin(sh.k2 * x + sh.p2);
  const t = sh.tilt >= 0 ? sh.tilt * (x / W) : -sh.tilt * (1 - x / W);
  return UPLIFT * (sh.a1 * f1 + sh.a2 * f2 + t);
}

export function setup(params) {
  params.t = 0;
  params.started = false;
  params.rgb = new Float32Array(3);
}

// The pile when the panel opens: four old packages already folded, planed and buried, and a young one partly grown. Each package was planed when the beds had reached the place where the next one begins.
function start(params) {
  params.S = 400;
  // The young package is nearly grown, so the first fold rises a few seconds after the panel opens.
  params.cur = { sh: shape(), base: params.S - 16, grow: 20 };
  params.done = [];
  let top = params.cur.base;
  let above = params.cur.sh;
  for (let i = 0; i < 4; i++) {
    const base = top - PACKAGE * (0.7 + 0.6 * Math.random());
    const sh = shapeOn(above);
    params.done.push({ sh, top, base });
    top = base;
    above = sh;
  }
  params.phase = 0;
  params.prog = 0;
  params.cut = 0;
  params.started = true;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  if (!params.started) start(params);
  params.t += dt;
  const pace = clamp(k[1], 0, 3);
  const u = clamp(k[2], -1, 1);
  params.fold = u < 0 ? 1 + u : 1 + 0.7 * u;
  params.thick = 4 + 10 * clamp(k[3], 0, 1);
  params.hue = k[0];
  const cur = params.cur;
  const g = dt * pace;
  if (params.phase === 0) {
    // Beds settle and the pile sinks as fast as they come, so the sea floor stays on its row.
    params.S += g * SETTLE;
    if (params.S - cur.base >= cur.grow) params.phase = 1;
  } else if (params.phase === 1) {
    params.prog = Math.min(1, params.prog + g / RISE);
    if (params.prog >= 1) {
      params.phase = 2;
      params.cut = 1;
    }
  } else {
    // The waves plane the land down from its highest point to the sea floor.
    params.cut = Math.max(0, params.cut - g / PLANE);
    if (params.cut <= 0) {
      params.done.unshift({ sh: cur.sh, top: params.S, base: cur.base });
      params.cur = { sh: shapeOn(cur.sh), base: params.S, grow: PACKAGE * (0.7 + 0.6 * Math.random()) };
      params.phase = 0;
      params.prog = 0;
      // Packages buried deeper than the panel are let go.
      let z = 0;
      for (let i = 0; i < params.done.length; i++) {
        z += params.done[i].top - params.done[i].base;
        if (z > H * 3) {
          params.done.length = i + 1;
          break;
        }
      }
    }
  }
}

// Turns a colour round the grey axis by angle a.
function turn(c, a, out) {
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const k = (1 - cs) / 3;
  const q = Math.sqrt(1 / 3) * sn;
  out[0] = c[0] * (cs + k) + c[1] * (k - q) + c[2] * (k + q);
  out[1] = c[0] * (k + q) + c[1] * (cs + k) + c[2] * (k - q);
  out[2] = c[0] * (k - q) + c[1] * (k + q) + c[2] * (cs + k);
}

export function draw(display, params) {
  const { S, cur, done, fold, thick, rgb } = params;
  const a = params.hue * Math.PI * 2;
  const highest = params.phase > 0 ? UPLIFT * fold * 1.4 : 0;
  // The cut sweeps from above the tallest fold down to the sea floor.
  const cut = params.phase === 2 ? -highest * params.cut : -Infinity;
  const segs = done.length + 1;
  const from = new Float32Array(segs);
  const len = new Float32Array(segs);
  const top = new Float32Array(segs);
  const up = new Float32Array(segs);
  for (let x = 0; x < W; x++) {
    // Each package down the column: where it starts below the sea floor, how long it runs, and the bed at its top edge.
    const uc = lift(cur.sh, x + 0.5) * fold * params.prog;
    from[0] = -uc;
    len[0] = S - cur.base;
    top[0] = S;
    up[0] = uc;
    let z0 = -uc + (S - cur.base);
    for (let i = 0; i < done.length; i++) {
      const p = done[i];
      const ui = lift(p.sh, x + 0.5) * fold;
      from[i + 1] = z0;
      len[i + 1] = p.top - p.base - ui;
      top[i + 1] = p.top;
      up[i + 1] = ui;
      z0 += p.top - p.base - ui;
    }
    const rock = Math.max(cut, -uc);
    for (let y = 0; y < H; y++) {
      const z = y + 0.5 - FLOOR;
      if (z < rock) {
        // Water: dark at the top, lighter towards the floor, with the line of the sea floor itself.
        const d = clamp((z + FLOOR) / FLOOR, 0, 1);
        const edge = z > -1 && z <= 0 ? 1 : 0;
        display.setPixel(x, y, 6 + 10 * d + 30 * edge, 14 + 26 * d + 50 * edge, 24 + 34 * d + 56 * edge);
        continue;
      }
      let i = 0;
      while (i < segs - 1 && (len[i] <= 0 || z >= from[i] + len[i])) i++;
      const p = i === 0 ? cur : done[i - 1];
      // The bed: how far below the top of its package the point lies once the package's own lift is taken off, counted in beds that are each a little thicker or thinner than the last.
      const s = top[i] - (z - from[i]) - up[i];
      const q = s / thick;
      const w = q + 0.32 * Math.sin(q * 0.9 + p.sh.id) + 0.18 * Math.sin(q * 2.3 + p.sh.id * 0.7);
      const n = Math.floor(w);
      const pick = p.sh.pal[(n + Math.floor(hash(n, p.sh.id) * 2.6)) % 3];
      // The cut itself, where a package meets the one under it, is drawn as a darker seam one LED deep.
      const seam = i > 0 && z - from[i] < 1 ? 0.55 : 1;
      const bright = (0.8 + 0.2 * hash(n, p.sh.id + 7)) * (1 - 0.15 * clamp(z / (H - FLOOR), 0, 1)) * seam;
      turn(ROCK[pick], a, rgb);
      display.setPixel(x, y, clamp(rgb[0] * bright, 0, 255), clamp(rgb[1] * bright, 0, 255), clamp(rgb[2] * bright, 0, 255));
    }
  }
}
