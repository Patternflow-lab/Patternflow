// ===== Patternflow pattern =====
// Title:   Three Trees
// Family:  type
// Idea:    Characters built from one component written once, twice and three times go down the panel stroke by stroke in stroke order, 木 at the top, 林 in the middle and 森 at the bottom, then 火 炎 焱, 水 沝 淼 and on through eight sets, each in its practice square with its Ideographic Description Sequence in small glyphs beside it, and the strokes a component changes when it shares the square (a right-falling stroke shrunk to a dot, a bottom stroke turned into a rising one) are written in gold; each set is written over the last one, square by square.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: 會意, compound ideographs, one of the six categories (六書) in the postface of the Shuowen Jiezi (Xu Shen, about 100), whose entry for 林 says it is made of two 木 (从二木); the 品 structure (品字形), one component over two; Ideographic Description Characters and Sequences (Unicode 3.0, 1999); the practice square (田字格); strokes drawn for this pattern after the regular script, with the mainland forms 从, 众 and 吕; pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Set=0..8, Paste=0..1
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 the strokes are sky blue, the changed strokes yellow gold, the description's components a dimmer sky blue and the practice squares, stroke counts and the description characters ⿰ and ⿱ a dim blue-grey; at 0.5 the strokes are peach and the changed strokes blue.
// Knob 2: Speed. At 2 the pen writes 40 LEDs a second and rests 0.14 s after each stroke. With the fades between squares a set takes from 13.8 s (人 从 众, 12 strokes) to 23.3 s (石 砳 磊, 30), 木 林 森 20.6 s with its 2.5 s hold, and the eight come round in 149 s; ten times slower at 0.2, half as fast again at 3.
// Knob 3: Set. 0 writes the eight sets in turn: 木 林 森, 火 炎 焱, 水 沝 淼, 土 圭 垚, 人 从 众, 口 吕 品, 日 昌 晶, 石 砳 磊. 1 to 8 write one of them over and over. The panel opens on the first set already written and held.
// Knob 4: Paste. 0 is the characters as written: in 林 the left 木 ends in a dot, in 炎 the upper 火 is smaller and flatter and ends in a dot, in 吕 the upper 口 is the smaller, in 垚 the lower left 土 ends in a rising stroke. 1 pastes the plain component, scaled like a picture, into the halves and quarters the description names, and tints those cells: 林 gets two right-falling strokes that nearly meet in the middle and vertical strokes half as thick, 森 a top tree as wide as the square with horizontal strokes half as thick. In between, strokes, boxes and weights move straight from one to the other.

// Every component is a list of strokes in a box 16 by 16, in stroke order,
// y down. A stroke is h (horizontal), v (vertical), hz (horizontal then
// down), vg (vertical with a hook), hp (horizontal then left-falling), p
// (left-falling), n (right-falling), d (dot) or t (rising); p, n, d and t
// with three points are quadratic curves through a control point. The type
// sets how the width runs along the stroke.
//
// A component sits in one of eight places: S alone, L and R in a left-right
// pair (⿰), T and B in a top-bottom pair (⿱), and t, l and r in the 品
// arrangement (⿱ over ⿰). The variants follow the regular script's habit
// that a character carries one full right-falling stroke: every other one
// becomes a dot, and 土 on the lower left of 垚 takes the rising stroke it
// has as a radical. Each variant keeps the point count of the plain stroke,
// so Paste can move the points in a straight line.

const W = 64, H = 128, N = W * H;
const { floor, round, sqrt, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;

// Plain components. Each has its 7 by 7 glyph for the description column.
const C = {
  wood: {
    s: [
      ["h", [1.5, 5.2, 14.5, 5.2]],
      ["v", [8, 1, 8, 15.6]],
      ["p", [7.7, 5.7, 6.4, 10, 1, 13.8]],
      ["n", [8.3, 5.7, 9.6, 10, 15, 13.8]],
    ],
    g: ["...#...", "#######", "..###..", ".#.#.#.", "#..#..#", "...#...", "...#..."],
  },
  fire: {
    s: [
      ["d", [3.3, 5, 3.8, 6.4, 4.8, 7.8]],
      ["p", [12.9, 4.4, 12.4, 6.2, 11, 7.8]],
      ["p", [8, 1, 8, 10.5, 1.2, 15.3]],
      ["n", [8.3, 8.8, 10, 12.8, 15, 15.3]],
    ],
    g: ["...#...", "#..#..#", ".#.#.#.", "...#...", "..#.#..", ".#...#.", "#.....#"],
  },
  water: {
    s: [
      ["vg", [8, 1, 8, 15, 6, 13.4]],
      ["hp", [2, 5.6, 6.6, 5.6, 1.2, 12.8]],
      ["p", [13.6, 3.6, 12.4, 5.6, 9.6, 7.4]],
      ["n", [9, 6.6, 10.6, 10.8, 15.2, 14.2]],
    ],
    g: ["...#...", "...#..#", "##.#.#.", ".#.##..", ".#.#.#.", "#..#..#", "..##..."],
  },
  earth: {
    s: [
      ["h", [3.4, 6.4, 12.6, 6.4]],
      ["v", [8, 1.6, 8, 14.4]],
      ["h", [1.2, 14.4, 14.8, 14.4]],
    ],
    g: ["...#...", "...#...", ".#####.", "...#...", "...#...", "...#...", "#######"],
  },
  person: {
    s: [
      ["p", [8.6, 1, 8, 9.6, 1.2, 15.2]],
      ["n", [8, 6.2, 9.8, 11.8, 15, 15.2]],
    ],
    g: ["...#...", "...#...", "...#...", "..#.#..", "..#.#..", ".#...#.", "#.....#"],
  },
  mouth: {
    s: [
      ["v", [3, 3.4, 3.4, 13.6]],
      ["hz", [3, 3.4, 13, 3.4, 12.6, 13.6]],
      ["h", [3.4, 13.1, 12.6, 13.1]],
    ],
    g: [".......", "#######", "#.....#", "#.....#", "#.....#", "#######", "......."],
  },
  sun: {
    s: [
      ["v", [3.6, 1.4, 3.6, 14.8]],
      ["hz", [3.6, 1.4, 12.4, 1.4, 12.4, 14.8]],
      ["h", [3.6, 8.1, 12.4, 8.1]],
      ["h", [3.6, 14.3, 12.4, 14.3]],
    ],
    g: [".#####.", ".#...#.", ".#...#.", ".#####.", ".#...#.", ".#...#.", ".#####."],
  },
  stone: {
    s: [
      ["h", [1.4, 2.6, 14.6, 2.6]],
      ["p", [7.6, 2.8, 6.2, 8.6, 1.2, 14.4]],
      ["v", [5.4, 8.4, 5.4, 15.2]],
      ["hz", [5.4, 8.4, 13.8, 8.4, 13.8, 15.2]],
      ["h", [5.4, 14.6, 13.8, 14.6]],
    ],
    g: ["#######", "..#....", "..#....", ".#.####", ".#.#..#", "#..#..#", "...####"],
  },
};

// Variants: place -> [stroke index, type, points]. Dots stand where the
// right-falling stroke would be, slanting the same way.
const DOT = {
  wood: [3, "d", [9.6, 7, 10.8, 8.2, 12.4, 9.8]],
  fire: [3, "d", [8.9, 9.6, 10, 10.8, 11.8, 12.2]],
  water: [3, "d", [9.4, 7.4, 10.6, 8.6, 12.4, 10.2]],
  person: [1, "d", [7.6, 8, 8.6, 9.6, 10.6, 11.4]],
};
const V = {
  wood: { L: [DOT.wood, [0, "h", [1, 5.2, 14, 5.2]], [1, "v", [9, 1, 9, 15.6]], [2, "p", [8.6, 5.7, 7.2, 10, 1, 13.4]]], t: [DOT.wood], l: [DOT.wood] },
  fire: { T: [DOT.fire, [2, "p", [8, 1.6, 8, 9.6, 2, 14.2]]], t: [DOT.fire], l: [DOT.fire] },
  water: { L: [DOT.water], t: [DOT.water], l: [DOT.water] },
  person: { L: [DOT.person, [0, "p", [8, 1, 7.6, 9, 2.6, 15.2]]], t: [DOT.person], l: [DOT.person] },
  earth: {
    T: [[2, "h", [2.4, 14.4, 13.6, 14.4]]],
    t: [[2, "h", [2.4, 14.4, 13.6, 14.4]]],
    l: [[0, "h", [3, 6.2, 11.6, 6.2]], [1, "v", [7.2, 1.6, 7.2, 13.6]], [2, "t", [1.4, 15.4, 13.6, 12.2]]],
  },
  stone: {
    L: [[0, "h", [1.8, 2.6, 12.8, 2.6]], [1, "p", [6.8, 2.8, 5.6, 9, 1, 15.2]], [2, "v", [6, 8.8, 6, 14.6]], [3, "hz", [6, 8.8, 13, 8.8, 13, 14.6]], [4, "h", [6, 14, 13, 14]]],
    l: [[0, "h", [1.8, 2.6, 12.8, 2.6]], [1, "p", [6.8, 2.8, 5.6, 9, 1, 15.2]], [2, "v", [6, 8.8, 6, 14.6]], [3, "hz", [6, 8.8, 13, 8.8, 13, 14.6]], [4, "h", [6, 14, 13, 14]]],
  },
};

// The sets: component, pair layout (⿰ or ⿱), the three characters.
const SETS = [
  ["wood", "H", "木林森"],
  ["fire", "V", "火炎焱"],
  ["water", "H", "水沝淼"],
  ["earth", "V", "土圭垚"],
  ["person", "H", "人从众"],
  ["mouth", "V", "口吕品"],
  ["sun", "V", "日昌晶"],
  ["stone", "H", "石砳磊"],
];

// Boxes in the square, [x, y, w, h], as written and as the description
// cuts it.
const BOX = {
  S: [[0, 0, 1, 1], [0, 0, 1, 1]],
  L: [[0.02, 0.03, 0.42, 0.94], [0, 0, 0.5, 1]],
  R: [[0.45, 0, 0.55, 1], [0.5, 0, 0.5, 1]],
  T: [[0.18, 0, 0.64, 0.45], [0, 0, 1, 0.5]],
  B: [[0.03, 0.46, 0.94, 0.54], [0, 0.5, 1, 0.5]],
  t: [[0.22, 0, 0.56, 0.47], [0, 0, 1, 0.5]],
  l: [[0, 0.5, 0.48, 0.5], [0, 0.5, 0.5, 0.5]],
  r: [[0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
};
const PLACES = [["S"], { H: ["L", "R"], V: ["T", "B"] }, ["t", "l", "r"]];
// Stroke weight in LEDs for one, two and three components.
const WEIGHT = [3, 2.5, 2.2];

// Width along a stroke, u from 0 to 1, as a share of the weight.
function profile(type, u) {
  if (type === "p") return 1.05 - 0.6 * u;
  if (type === "n") return u < 0.85 ? 0.6 + 0.8 * (u / 0.85) : 1.4 - 3.4 * (u - 0.85);
  if (type === "d") return 0.8 + 0.55 * u;
  if (type === "t") return 1.25 - 0.8 * u;
  if (type === "vg") return u < 0.8 ? 1 : 1 - 2 * (u - 0.8);
  return 1;
}

// Squares: left edge 11, 42 LEDs wide, at rows 0, 43 and 86. The strokes
// are drawn inside 40 of them.
const SQ = 42, SX = 11, SY = [0, 43, 86];

// The strokes of one character as pixels: for each stroke its pixel list,
// coverage, place along it, length, accent and points.
const COV = new Float32Array(N), POS = new Float32Array(N);
function rasterStroke(pts, wid) {
  const touched = [];
  let len = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, sl = sqrt(l2);
    const wm = max(wid[i], wid[i + 1]) / 2 + 1;
    const x0 = max(0, floor(min(ax, bx) - wm)), x1 = min(W - 1, floor(max(ax, bx) + wm));
    const y0 = max(0, floor(min(ay, by) - wm)), y1 = min(H - 1, floor(max(ay, by) + wm));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        const u = l2 > 0 ? cl((px * dx + py * dy) / l2, 0, 1) : 0;
        const ex = px - u * dx, ey = py - u * dy, d = sqrt(ex * ex + ey * ey);
        const c = cl(lerp(wid[i], wid[i + 1], u) / 2 + 0.5 - d, 0, 1);
        if (c <= 0) continue;
        const p = y * W + x;
        if (COV[p] === 0) touched.push(p);
        if (c > COV[p]) {
          COV[p] = c;
          POS[p] = len + u * sl;
        }
      }
    len += sl;
  }
  const px = new Int32Array(touched.length), cv = new Float32Array(touched.length), ps = new Float32Array(touched.length);
  touched.forEach((p, i) => {
    px[i] = p;
    cv[i] = COV[p];
    ps[i] = POS[p];
    COV[p] = 0;
  });
  return { px, cv, ps, len: max(len, 1), pts };
}

// One stroke of a component in a place, Paste u, onto the panel. As
// written, every stroke keeps the weight of its band. Pasted, the plain
// component is scaled into its box like a picture, so its strokes thin with
// the box: in a half as wide as the square a vertical stroke is half as
// thick and a horizontal one stays, in a quarter every stroke is half.
function strokeGeom(comp, place, i, u, band, weight) {
  const plain = C[comp].s[i];
  const vars = (V[comp] && V[comp][place]) || [];
  const v = vars.find((q) => q[0] === i);
  const ta = v ? v[1] : plain[0], pa = v ? v[2] : plain[1], tb = plain[0], pb = plain[1];
  const box = BOX[place][0].map((b, k) => lerp(b, BOX[place][1][k], u));
  const sx = BOX[place][1][2], sy = BOX[place][1][3];
  const P = pa.map((a, k) => lerp(a, pb[k], u));
  const toPx = (cx, cy) => [SX + 1 + (box[0] + (cx / 16) * box[2]) * (SQ - 2), SY[band] + 1 + (box[1] + (cy / 16) * box[3]) * (SQ - 2)];
  // Points along the stroke with the direction there; a polyline repeats
  // its corners so each leg keeps its own direction.
  const sm = [];
  if (P.length === 6 && (tb === "p" || tb === "n" || tb === "d" || tb === "t")) {
    for (let k = 0; k <= 10; k++) {
      const s = k / 10, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
      sm.push([a * P[0] + b * P[2] + c * P[4], a * P[1] + b * P[3] + c * P[5], (1 - s) * (P[2] - P[0]) + s * (P[4] - P[2]), (1 - s) * (P[3] - P[1]) + s * (P[5] - P[3])]);
    }
  } else {
    for (let k = 0; k + 3 < P.length; k += 2) {
      const dx = P[k + 2] - P[k], dy = P[k + 3] - P[k + 1];
      sm.push([P[k], P[k + 1], dx, dy], [P[k + 2], P[k + 3], dx, dy]);
    }
  }
  let total = 0;
  const at = [0];
  for (let k = 1; k < sm.length; k++) at.push((total += Math.hypot(sm[k][0] - sm[k - 1][0], sm[k][1] - sm[k - 1][1])));
  const pts = [], wid = [];
  sm.forEach(([cx, cy, dx, dy], k) => {
    const s = total > 0 ? at[k] / total : 0, dl = Math.hypot(dx, dy) || 1;
    const pasted = (WEIGHT[0] * sx * sy) / Math.hypot((sx * dx) / dl, (sy * dy) / dl);
    pts.push(toPx(cx, cy));
    wid.push(lerp(weight * profile(ta, s), pasted * profile(tb, s), u));
  });
  const g = rasterStroke(pts, wid);
  g.accent = v && ta !== tb ? 1 - u : 0;
  return g;
}

// A whole set: three bands of strokes in writing order.
function buildSet(si, u) {
  const [comp, pair] = SETS[si];
  const bands = [];
  for (let b = 0; b < 3; b++) {
    const places = b === 1 ? PLACES[1][pair] : PLACES[b], list = [];
    for (const pl of places) for (let i = 0; i < C[comp].s.length; i++) list.push(strokeGeom(comp, pl, i, u, b, WEIGHT[b]));
    bands.push(list);
  }
  return { si, u, bands };
}

// Description column: the glyphs top to bottom for each band.
function idsOf(si) {
  const [comp, pair] = SETS[si];
  const sym = pair === "H" ? "H" : "V";
  return [[comp], [sym, comp, comp], ["V", comp, "H", comp, comp]];
}
const IDC = {
  H: ["#######", "#..#..#", "#..#..#", "#..#..#", "#..#..#", "#..#..#", "#######"],
  V: ["#######", "#.....#", "#.....#", "#######", "#.....#", "#.....#", "#######"],
};
const DIG = ["###", "#.#", "#.#", "#.#", "###", ".#.", "##.", ".#.", ".#.", "###", "###", "..#", "###", "#..", "###", "###", "..#", "###", "..#", "###", "#.#", "#.#", "###", "..#", "..#", "###", "#..", "###", "..#", "###", "###", "#..", "###", "#.#", "###", "###", "..#", "..#", "..#", "..#", "###", "#.#", "###", "#.#", "###", "###", "#.#", "###", "..#", "###"];

// Times, in seconds at Speed 2: pen speed in LEDs a second, rest after a
// stroke, the old band's fade, the pause between bands and the hold.
const PEN = 40, REST = 0.14, FADE = 0.5, GAP = 0.5, HOLD = 2.5;

function schedule(set) {
  let t = 0;
  const marks = [];
  set.bands.forEach((list, b) => {
    const start = t;
    t += FADE;
    const strokes = list.map((g) => {
      const s = { g, t0: t, t1: t + g.len / PEN };
      t = s.t1 + REST;
      return s;
    });
    marks.push({ start, strokes, end: t });
    t += GAP;
  });
  return { marks, total: t + HOLD };
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  params.s = { t: 0, hue: 0, setKnob: 0, paste: 0.06, order: 0, cur: null, prev: null, plan: null, buf: new Float32Array(N * 3) };
}

function startSet(S, si) {
  S.prev = S.cur;
  S.cur = buildSet(si, S.paste);
  S.plan = schedule(S.cur);
  S.t = 0;
}

function nextIndex(S) {
  return S.setKnob >= 1 ? S.setKnob - 1 : (S.order = (S.order + 1) % SETS.length);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const setKnob = cl(floor(k[2] == null ? 0 : k[2]), 0, 8);
  const paste = round(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 50) / 50;
  if (!S.cur || setKnob !== S.setKnob) {
    // The panel opens on a set already written and held, about to be written over.
    S.setKnob = setKnob;
    S.order = setKnob >= 1 ? setKnob - 1 : 0;
    S.paste = paste;
    S.prev = null;
    S.cur = buildSet(S.order, paste);
    S.plan = schedule(S.cur);
    S.t = S.plan.total - HOLD;
  }
  if (paste !== S.paste) {
    S.paste = paste;
    S.cur = buildSet(S.cur.si, paste);
    if (S.prev) S.prev = buildSet(S.prev.si, paste);
    const t = S.t;
    S.plan = schedule(S.cur);
    S.t = t;
  }
  S.t += (d * speed) / 2;
  if (S.t >= S.plan.total) startSet(S, nextIndex(S));
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  const buf = S.buf, t = S.t, hue = S.hue + 0.56;
  buf.fill(0);
  const ink = hsv(hue, 0.55, 1), gold = hsv(hue + 0.59, 0.78, 1), grid = hsv(hue, 0.35, 0.16);
  const add = (p, c, a) => {
    buf[p * 3] = max(buf[p * 3], c[0] * a);
    buf[p * 3 + 1] = max(buf[p * 3 + 1], c[1] * a);
    buf[p * 3 + 2] = max(buf[p * 3 + 2], c[2] * a);
  };
  // Ink goes over what is under it, so a later stroke covers an earlier one.
  const over = (p, c, a) => {
    for (let k = 0; k < 3; k++) buf[p * 3 + k] += (c[k] - buf[p * 3 + k]) * a;
  };
  // Practice squares: dashed edges and a dashed cross.
  for (let b = 0; b < 3; b++) {
    const y0 = SY[b], x0 = SX;
    for (let i = 0; i < SQ; i += 2) {
      add(y0 * W + x0 + i, grid, 1);
      add((y0 + SQ - 1) * W + x0 + i, grid, 1);
      add((y0 + i) * W + x0, grid, 1);
      add((y0 + i) * W + x0 + SQ - 1, grid, 1);
      add((y0 + SQ / 2) * W + x0 + i, grid, 0.7);
      add((y0 + i) * W + x0 + SQ / 2, grid, 0.7);
    }
  }
  // Pasted, the halves and quarters the description cuts the square into
  // are tinted, one cell a little brighter than the next.
  if (S.paste > 0.02) {
    const pair = SETS[S.cur.si][1];
    for (let b = 0; b < 3; b++) {
      const places = b === 1 ? PLACES[1][pair] : PLACES[b];
      places.forEach((pl, j) => {
        const bx = BOX[pl][1], tint = hsv(hue, 0.6, (0.09 + 0.05 * (j % 2)) * S.paste);
        const x0 = round(SX + 1 + bx[0] * (SQ - 2)), x1 = round(SX + 1 + (bx[0] + bx[2]) * (SQ - 2));
        const y0 = round(SY[b] + 1 + bx[1] * (SQ - 2)), y1 = round(SY[b] + 1 + (bx[1] + bx[3]) * (SQ - 2));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) add(y * W + x, tint, 1);
      });
    }
  }
  const plan = S.plan;
  for (let b = 0; b < 3; b++) {
    const m = plan.marks[b];
    // The old character stays, dimmed, until the pen comes to its square.
    if (S.prev && t < m.start + FADE) {
      const a = t < m.start ? 0.4 : 0.4 * (1 - (t - m.start) / FADE);
      for (const g of S.prev.bands[b]) {
        // Paled toward white so a dimmed gold or orange does not turn brown.
        const col = mix(g.accent > 0 ? mix(ink, gold, g.accent) : ink, [1, 1, 1], 0.45);
        for (let i = 0; i < g.px.length; i++) add(g.px[i], col, g.cv[i] * a);
      }
    }
    if (t < m.start) continue;
    // Description column and stroke count.
    const ids = idsOf(S.cur.si)[b];
    const shown = cl((t - m.start) / FADE, 0, 1);
    ids.forEach((name, j) => {
      const rows = IDC[name] || C[name].g, col = IDC[name] ? grid : ink, a = IDC[name] ? 3.2 * shown : 0.55 * shown;
      for (let yy = 0; yy < 7; yy++)
        for (let xx = 0; xx < 7; xx++) if (rows[yy][xx] === "#") add((SY[b] + 2 + j * 8 + yy) * W + 55 + xx, col, a);
    });
    let done = 0;
    for (const s of m.strokes) {
      if (t < s.t0) break;
      const g = s.g, reach = cl((t - s.t0) / (s.t1 - s.t0), 0, 1) * g.len;
      if (reach >= g.len) done++;
      // Fresh ink is near white and cools to its colour in 0.6 s.
      const cool = cl((t - s.t1) / 0.6, 0, 1);
      const base = g.accent > 0 ? mix(ink, gold, g.accent) : ink;
      const col = mix([1, 1, 1], base, cool);
      for (let i = 0; i < g.px.length; i++) {
        const e = cl(reach + 0.8 - g.ps[i], 0, 1);
        if (e > 0) over(g.px[i], col, g.cv[i] * e);
      }
      if (reach < g.len) {
        // The pen tip.
        const q = tipAt(g, reach);
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const x = floor(q[0]) + dx, y = floor(q[1]) + dy;
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const r2 = (x + 0.5 - q[0]) ** 2 + (y + 0.5 - q[1]) ** 2;
            over(y * W + x, [1, 1, 1], cl(1.3 - r2 / 3, 0, 1));
          }
      }
    }
    // Strokes written so far, in 3 by 5 digits under the square's top left.
    const txt = String(done);
    for (let c = 0; c < txt.length; c++) {
      const dg = +txt[c];
      for (let yy = 0; yy < 5; yy++)
        for (let xx = 0; xx < 3; xx++) if (DIG[dg * 5 + yy][xx] === "#") add((SY[b] + 2 + yy) * W + 2 + c * 4 + xx, grid, 3.2 * shown);
    }
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), round(min(1, buf[p * 3]) * 255), round(min(1, buf[p * 3 + 1]) * 255), round(min(1, buf[p * 3 + 2]) * 255));
}

function mix(a, b, u) {
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

function tipAt(g, s) {
  let acc = 0;
  for (let i = 0; i + 1 < g.pts.length; i++) {
    const [ax, ay] = g.pts[i], [bx, by] = g.pts[i + 1], l = sqrt((bx - ax) ** 2 + (by - ay) ** 2);
    if (acc + l >= s) {
      const u = l > 0 ? (s - acc) / l : 0;
      return [lerp(ax, bx, u), lerp(ay, by, u)];
    }
    acc += l;
  }
  return g.pts[g.pts.length - 1];
}
