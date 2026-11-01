// ===== Patternflow pattern =====
// Title:   Rod Numerals
// Family:  type
// Idea:    The panel is a counting board of four place columns and three rows, and a multiplication runs on it the way the Sunzi Suanjing sets it out, multiplier on the top row, multiplicand on the bottom row with its last figure under the multiplier's first, the product growing in the middle row as each pair of figures is multiplied, each used figure of the multiplier taken away and the multiplicand stepping one place right, every figure made of rods that stand upright in the units and hundreds and lie down in the tens and thousands, so a figure that steps one place turns all its rods a quarter turn.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: counting-rod numerals and multiplication on the counting board (Sunzi Suanjing, Master Sun's Mathematical Manual, about the 3rd to 5th century); red rods for positive numbers and black for negative (Liu Hui, commentary on the Nine Chapters, 263); rods drawn for this pattern, pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Problem=0..1, Sign=0..1
//
// Knob 1: Hue. Knob 2: Speed. Knob 3: Problem. Knob 4: Sign.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// Rods are L LEDs long and T thick, laid P apart side by side.
const L = 12, T = 2, P = 3;
// Four place columns 16 LEDs wide, units on the right, ruled at x = 16, 32
// and 48; three rows 42 LEDs tall, ruled at y = 42 and 85.
const COLS = 4, CW = 16, ROWS = [21, 64, 107], RULE_Y = [42, 85];
const PROBLEMS = [
  [81, 81], // Sunzi's own: 6561
  [64, 128], // this panel: 8192
  [45, 89], // 4005, two empty places
  [365, 7], // 2555, the 7 steps right twice
  [99, 99], // 9801
];
// Seconds (at Speed 2) each kind of step lasts, and how much of it the
// rods spend moving.
const DUR = { empty: 0.6, set: 1.4, mul: 1.3, drop: 0.9, shift: 1.3, done: 1.0, hold: 3.2, clear: 0.9 };
const HUE0 = 0.12;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// A place column's centre on the panel; place 0 is the units.
const colX = (place) => (COLS - 1 - place) * CW + 8;

// The rods of figure d (1..9) in a place, as [x, y, angle] centres, the
// rod for five first. Upright (zong) in the units and hundreds: one to five
// rods standing side by side, and from six a lying rod for five across the
// top. Lying (heng) in the tens and thousands: one to five rods lying one
// above the other, and from six a standing rod for five on top. Six is
// never six rods and five never a single rod.
function glyph(d, place, cy, out) {
  const zong = place % 2 === 0, five = d > 5, u = five ? d - 5 : d, cx = colX(place);
  if (zong) {
    const h = five ? L + P : L, top = round(cy - h / 2), left = cx - floor((P * u - 1) / 2);
    if (five) out.push([cx, top + T / 2, 0]);
    for (let i = 0; i < u; i++) out.push([left + T / 2 + P * i, top + h - L / 2, PI / 2]);
  } else {
    const h = (five ? L + 1 : 0) + P * u - 1, top = round(cy - h / 2);
    if (five) out.push([cx, top + L / 2, PI / 2]);
    for (let i = 0; i < u; i++) out.push([cx, top + h - (P * (u - 1 - i)) - T / 2, 0]);
  }
  return out;
}

function hash(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
}
// A number in 0..1 for each integer n and seed.
function grain(n, seed) {
  let h = Math.imul((n + 1) ^ seed, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const digitsOf = (v) => String(v).split("").map(Number);

// The whole run of one multiplication, as a list of boards. A board is the
// figures on it, each with a name that follows it as it moves, and the
// cells lit to show which figures are being multiplied.
function timeline(a, b, sa, sb) {
  const td = digitsOf(a), bd = digitsOf(b), m = td.length, n = bd.length, sp = sa * sb;
  const boards = [];
  const board = (kind, used, shift, mid, showBottom, glow) => {
    const figs = [];
    for (let i = 0; i < m; i++) if (i >= used && td[i]) figs.push({ id: "t" + i, row: 0, place: m - 1 - i, d: td[i], neg: sa < 0 });
    if (mid > 0) {
      const md = digitsOf(mid);
      md.forEach((d, k) => d && figs.push({ id: "m" + (md.length - 1 - k), row: 1, place: md.length - 1 - k, d, neg: sp < 0 }));
    }
    if (showBottom) for (let j = 0; j < n; j++) if (bd[j]) figs.push({ id: "b" + j, row: 2, place: n - 1 - j + shift, d: bd[j], neg: sb < 0 });
    boards.push({ kind, dur: DUR[kind], figs, glow: glow || [] });
  };
  board("empty", 0, m - 1, 0, false);
  board("set", 0, m - 1, 0, true);
  let mid = 0;
  for (let i = 0; i < m; i++) {
    const shift = m - 1 - i;
    for (let j = 0; j < n; j++) {
      const place = n - 1 - j + shift, p = td[i] * bd[j];
      if (!p) continue;
      mid += p * 10 ** place;
      board("mul", i, shift, mid, true, [
        [0, m - 1 - i, 1],
        [2, place, 1],
        [1, place, 0.6],
        [1, place + 1, p > 9 ? 0.6 : 0],
      ]);
    }
    board("drop", i + 1, shift, mid, true);
    if (i < m - 1) board("shift", i + 1, shift - 1, mid, true);
  }
  board("done", m, 0, mid, false);
  board("hold", m, 0, mid, false, [[1, 0, 0.35], [1, 1, 0.35], [1, 2, 0.35], [1, 3, 0.35]]);
  board("clear", m, 0, 0, false);
  for (const B of boards) {
    B.rods = new Map();
    B.cells = new Map();
    for (const f of B.figs) {
      const rs = glyph(f.d, f.place, ROWS[f.row], []);
      rs.forEach((r, k) => B.rods.set(f.id + ":" + k, { x: r[0], y: r[1], a: r[2], neg: f.neg, row: f.row, seed: hash(f.id + ":" + k) }));
      B.cells.set(f.row + "/" + f.place, [f.row, f.place, f.neg]);
    }
  }
  return boards;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, prob: 0, sign: 0, key: "", run: 0, boards: null, k: 0, tau: 0,
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), pos: [0, 0, 0], neg: [0, 0, 0],
  };
}

const SIGNS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

function start(S, idx) {
  const [a, b] = PROBLEMS[idx % PROBLEMS.length], [sa, sb] = SIGNS[S.sign];
  S.run = idx % PROBLEMS.length;
  S.boards = timeline(a, b, sa, sb);
  S.k = 0;
  S.tau = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.prob = min(PROBLEMS.length - 1, floor(cl(k[2] || 0, 0, 1) * PROBLEMS.length));
  S.sign = min(3, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 4));
  const key = S.prob + "/" + S.sign;
  if (key !== S.key) {
    S.key = key;
    start(S, S.prob);
  }
  S.tau += (d * S.speed) / 2;
  while (S.tau >= S.boards[S.k].dur) {
    S.tau -= S.boards[S.k].dur;
    S.k++;
    if (S.k >= S.boards.length) start(S, S.run + 1);
  }
}

// One rod: a T by L bar centred at (x, y), turned by angle a (0 lying,
// pi/2 standing), its cut ends brighter and whiter than its length.
function rod(S, x, y, a, alpha, col, seed) {
  const c = cos(a), s = sin(a), R = S.R, G = S.G, B = S.B, r = L / 2 + 2;
  for (let py = floor(y - r); py <= y + r; py++) {
    if (py < 0 || py >= H) continue;
    for (let px = floor(x - r); px <= x + r; px++) {
      if (px < 0 || px >= W) continue;
      let body = 0, end = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const dx = px + 0.125 + sx * 0.25 - x, dy = py + 0.125 + sy * 0.25 - y;
          const u = dx * c + dy * s, v = -dx * s + dy * c;
          if (abs(u) <= L / 2 && abs(v) <= T / 2) {
            if (abs(u) > L / 2 - 1.5) end++;
            else body++;
          }
        }
      if (!body && !end) continue;
      // The grain along the rod, one step per LED of its length.
      const along = (px + 0.5 - x) * c + (py + 0.5 - y) * s, gr = 0.78 + 0.22 * grain(floor(along + L / 2), seed);
      const o = py * W + px, wb = (body / 16) * alpha * 215 * gr, we = (end / 16) * alpha;
      R[o] += col[0] * wb + (0.55 * col[0] + 0.45) * 255 * we;
      G[o] += col[1] * wb + (0.55 * col[1] + 0.45) * 255 * we;
      B[o] += col[2] * wb + (0.55 * col[2] + 0.45) * 255 * we;
    }
  }
}

// Light a cell of the board: a place in a row. The fill has a fine grain.
function cell(S, row, place, w, col, lev) {
  if (w <= 0) return;
  const x0 = colX(place) - 7, y0 = RULE_Y[row - 1] + 1 || 0, y1 = row < 2 ? RULE_Y[row] - 1 : H - 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x0 + 14; x++) {
      if (x < 0 || x >= W) continue;
      const o = y * W + x, l = lev * w * (0.8 + 0.4 * grain(o, 7));
      S.R[o] += col[0] * l;
      S.G[o] += col[1] * l;
      S.B[o] += col[2] * l;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.boards) return;
  const R = S.R, G = S.G, B = S.B;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  const pos = hsv(S.hue + HUE0, 0.55, 1, S.pos), neg = hsv(S.hue + HUE0 + 0.5, 0.6, 1, S.neg);

  // The rules of the board.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (x === 16 || x === 32 || x === 48 || y === RULE_Y[0] || y === RULE_Y[1]) {
        R[o] = 30;
        G[o] = 34;
        B[o] = 44;
      }
    }

  const now = S.boards[S.k], prev = S.boards[max(0, S.k - 1)];
  const u = S.k === 0 ? 1 : ease(cl(S.tau / min(0.65, now.dur * 0.5), 0, 1));

  // Every cell that holds a figure is faintly lit, so a zero, an empty
  // place, stands out dark between them.
  const held = new Map();
  for (const [key, c] of prev.cells) held.set(key, [c[0], c[1], c[2], S.k > 0 ? 1 - u : 0]);
  for (const [key, c] of now.cells) {
    const g = held.get(key);
    if (g) g[3] += u;
    else held.set(key, [c[0], c[1], c[2], u]);
  }
  for (const [row, place, ng, w] of held.values()) cell(S, row, place, w, ng ? neg : pos, 30);

  // Lit cells, fading from the last board's to this one's.
  const glow = new Map();
  for (const [row, place, w] of prev.glow) glow.set(row + "/" + place, [row, place, w * (1 - u)]);
  for (const [row, place, w] of now.glow) {
    const g = glow.get(row + "/" + place);
    if (g) g[2] += w * u;
    else glow.set(row + "/" + place, [row, place, w * u]);
  }
  for (const [row, place, w] of glow.values()) {
    const neg0 = [...prev.figs, ...now.figs].some((f) => f.row === row && f.neg);
    cell(S, row, place, w, neg0 ? neg : pos, 46);
  }

  // Rods that stay move and turn; new ones slide in, the middle row's up
  // from below as the product is laid; gone ones slide away and fade.
  const off = [-14, 16, 14], gone = [-14, -10, 14], col = [0, 0, 0];
  for (const [key, b] of now.rods) {
    const a = prev.rods.get(key);
    let x, y, ang, al, ng;
    if (a && S.k > 0) {
      x = a.x + (b.x - a.x) * u;
      y = a.y + (b.y - a.y) * u;
      ang = a.a + (b.a - a.a) * u;
      ng = a.neg ? 1 - u : 0;
      ng += b.neg ? u : 0;
      al = 1;
    } else {
      x = b.x;
      y = b.y + off[b.row] * (1 - u);
      ang = b.a;
      al = u;
      ng = b.neg ? 1 : 0;
    }
    for (let c = 0; c < 3; c++) col[c] = pos[c] * (1 - ng) + neg[c] * ng;
    rod(S, x, y, ang, al, col, b.seed);
  }
  if (S.k > 0)
    for (const [key, a] of prev.rods) {
      if (now.rods.has(key)) continue;
      const ng = a.neg ? 1 : 0;
      for (let c = 0; c < 3; c++) col[c] = pos[c] * (1 - ng) + neg[c] * ng;
      rod(S, a.x, a.y + gone[a.row] * u, a.a, 1 - u, col, a.seed);
    }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      display.setPixel(x, y, min(255, round(R[o])), min(255, round(G[o])), min(255, round(B[o])));
    }
}
