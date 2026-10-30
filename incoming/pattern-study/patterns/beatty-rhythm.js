// ===== Patternflow pattern =====
// Title:   Beatty Rhythm
// Family:  rhythm
// Idea:    Two voices play a score of ticks that falls down the panel, voice A on every tick floor(k alpha) and voice B on every tick floor(k beta) with 1/alpha + 1/beta = 1, in two lanes side by side where each tick fills as it reaches the playhead, and beside them the reason stands as a picture, the square lattice cut along the line of slope alpha - 1 with its lines x = i in A's colour and y = j in B's, which the line crosses exactly once in every tick, filling each cell it enters in the colour of the line it crossed, until a fraction for alpha sends the line through a lattice point, where both voices strike at once and the tick before goes unstruck.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Beatty's theorem (Samuel Beatty, 1926; Lord Rayleigh, 1894), pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Alpha=0..1, Ticks=0..1
//
// Knob 1: Hue. Turns the two voices round the wheel together, always opposite and at full strength. At 0 voice A is magenta and voice B green; at 1/6 red and cyan, at 0.25 orange and azure, at 0.5 the opening pair swapped.
// Knob 2: Speed. Ticks a second, 1.5 for each unit: 3 at the opening 2, so the score falls 15 LEDs a second at 5 rows a tick; 0.3 ticks a second at 0.2 and 4.5 at 3.
// Knob 3: Alpha. Eight stations, an eighth of the knob each: the golden ratio 1.618 (beta = 2.618, A strikes 61.8% of the ticks), then 8/5, the square root of 2 (beta = 3.414), 7/5, e - 1 = 1.718 (beta = 2.392), 12/7, pi - 2 = 1.142 (beta = 8.062) and 8/7. Each fraction p/q sits after the number it is near, and there the line meets a lattice point every p ticks: both voices strike ticks p, 2p, 3p and nobody strikes p - 1, 2p - 1, ... At pi - 2 voice B strikes every 8th tick fifteen times running and then 9 ticks after; at 8/7 it strikes every 8th tick for ever, and every 8th tick is a double. Alpha stands at the top left in A's colour and beta at the top right in B's.
// Knob 4: Ticks. Rows to a tick, 5 at the opening (24 ticks on the 120 rows under the labels) up to 12 (10 ticks). A lattice cell spans two ticks, 10 to 24 rows, and is always 20 LEDs wide.

// Beatty's theorem: if alpha > 1 is irrational and 1/alpha + 1/beta = 1,
// the numbers floor(k alpha) and floor(k beta), k = 1, 2, 3, ..., take every
// whole number once between them. Rayleigh stated it in The Theory of Sound
// (1894) and Beatty set it as a problem in the American Mathematical Monthly
// (1926).
//
// The picture is the lattice proof. Take the line from the origin in the
// direction (1/alpha, 1/beta) and call t = x + y its time: it crosses the
// line x = i at t = i alpha and the line y = j at t = j beta. Up to time
// N + 1 it has crossed floor((N + 1)/alpha) + floor((N + 1)/beta) lines,
// and the two fractional parts add to exactly 1 because the two quotients
// add to N + 1 and neither is whole, so that is N lines: one more for every
// tick, never two, never none. Each tick of the score is the stretch of
// the line from t = n to n + 1, and the lane that lights is the kind of
// line crossed in it. On the panel t runs up and w = x - t/alpha, how far
// a point is ahead of the line in x at the same t, runs across, so the line
// stands upright in the middle of the ribbon and the square lattice leans:
// its x lines rise to the left, its y lines to the right.

const W = 64, H = 128, PY = 76, TOP = 8, CX = 42, LW = 9;
const { floor, ceil, min, max, round, sqrt, PI, E } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const PHI = (1 + sqrt(5)) / 2;

// The stations of the Alpha knob: each irrational number, then a fraction
// close to it, where the theorem breaks.
const ST = [
  { a: PHI, la: "φ", lb: "φ+1" },
  { p: 8, q: 5, la: "8/5", lb: "8/3" },
  { a: sqrt(2), la: "√2", lb: "2+√2" },
  { p: 7, q: 5, la: "7/5", lb: "7/2" },
  { a: E - 1, la: "e-1", lb: "2.39" },
  { p: 12, q: 7, la: "12/7", lb: "12/5" },
  { a: PI - 2, la: "π-2", lb: "8.06" },
  { p: 8, q: 7, la: "8/7", lb: "8" },
];

// 3 by 5 figures and signs, drawn for this pattern; φ, π and √ are wider.
const GL = {
  0: "### #.# #.# #.# ###", 1: ".#. ##. .#. .#. ###", 2: "### ..# ### #.. ###", 3: "### ..# .## ..# ###",
  4: "#.# #.# ### ..# ..#", 5: "### #.. ### ..# ###", 6: "### #.. ### #.# ###", 7: "### ..# ..# .#. .#.",
  8: "### #.# ### #.# ###", 9: "### #.# ### ..# ###", ".": "... ... ... ... .#.", "/": "..# ..# .#. #.. #..",
  "+": "... .#. ### .#. ...", "-": "... ... ### ... ...", e: ".#. #.# ### #.. .##",
  "φ": "..#.. .###. #.#.# .###. ..#..", "π": "..... ##### .#.#. .#.#. .#..#", "√": "..### ..#.. #.#.. ##... .#...",
};

function hsv(h, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - i;
  const v = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  o[0] = round(v[0] * 255);
  o[1] = round(v[1] * 255);
  o[2] = round(v[2] * 255);
  return o;
}

const cdiv = (a, b) => floor((a + b - 1) / b);

// How many multiples of alpha (voice A) and of beta (voice B) have floor n.
function hits(S, n) {
  const s = S.st;
  if (n < 1) return [0, 0];
  if (s.p) {
    const p = s.p, q = s.q, r = p - q;
    return [cdiv((n + 1) * q, p) - cdiv(n * q, p), cdiv((n + 1) * r, p) - cdiv(n * r, p)];
  }
  return [ceil((n + 1) * S.ia) - ceil(n * S.ia), ceil((n + 1) * S.ib) - ceil(n * S.ib)];
}

export function setup(params) {
  params.s = {
    T: 40, hue: 0, speed: 2, k: -1, st: ST[0], ia: 1 / PHI, ib: 1 - 1 / PHI, R: 6, S: 20,
    id: new Int32Array(W * H), code: new Uint8Array(W * H), ca: [0, 0, 0], cb: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const ki = min(ST.length - 1, floor(cl(k[2] || 0, 0, 1) * ST.length));
  if (ki !== S.k) {
    S.k = ki;
    S.st = ST[ki];
    const a = S.st.p ? S.st.p / S.st.q : S.st.a;
    S.ia = 1 / a;
    S.ib = 1 - 1 / a;
  }
  S.R = 5 + round(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 7);
  S.T += d * S.speed * 1.5;
}

// Cell (i, j) of the square lattice, x in [i, i+1) and y in [j, j+1), is on
// the walk when the times the line spends in its column and in its row meet.
// Returns 0 when it is not, else when and how it was entered: 1 across a
// line x = i (voice A), 2 across y = j (voice B), 3 through a corner.
function cell(S, i, j) {
  if (i < 0 || j < 0) return [0, 0];
  const s = S.st;
  if (s.p) {
    const r = s.p - s.q;
    // i alpha < (j + 1) beta and j beta < (i + 1) alpha, times q r / p.
    if (!(i * r < (j + 1) * s.q && j * s.q < (i + 1) * r)) return [0, 0];
    const ta = i * r, tb = j * s.q;
    return [ta > tb ? 1 : ta < tb ? 2 : 3, (max(ta, tb) * s.p) / (s.q * r)];
  }
  const ta = i / S.ia, tb = j / S.ib;
  if (!(ta < (j + 1) / S.ib && tb < (i + 1) / S.ia)) return [0, 0];
  return [ta > tb ? 1 : 2, max(ta, tb)];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { id, code, R } = S, T = S.T, sw = S.S;
  code.fill(0);
  id.fill(0);
  const cells = new Map();
  const tlo = T - (H - PY) / R - 2, ib0 = floor(tlo * S.ia) - 4, jb0 = floor(tlo * S.ib) - 4;
  // Every LED's cell of the lattice, visited or not, as 1 + a key; the
  // line is w = 0, between columns CX - 1 and CX.
  for (let py = TOP; py < H; py++) {
    const t = T + (PY - py - 0.5) / R;
    if (t <= 0) continue;
    for (let px = 0; px < W; px++) {
      const w = (px - CX + 0.5) / sw, x = w + t * S.ia, y = t * S.ib - w;
      const i = floor(x), j = floor(y), key = (i - ib0) * 1024 + (j - jb0);
      if (!cells.has(key)) cells.set(key, cell(S, i, j));
      id[py * W + px] = key + 1;
    }
  }
  // 0 off the walk, 1 a cell the walk has entered, 2 one it has yet to enter.
  const state = (v) => {
    if (!v) return 0;
    const c = cells.get(v - 1);
    return !c[0] ? 0 : c[1] <= T ? 1 : 2;
  };
  for (let py = TOP; py < H; py++)
    for (let px = 0; px < W; px++) {
      const p = py * W + px, v = id[p];
      if (!v) continue;
      const c = cells.get(v - 1), st = state(v), r = px < W - 1 ? id[p + 1] : 0, dn = py < H - 1 ? id[p + W] : 0;
      if (st === 1) {
        // Entered: filled in the colour of the voice that crossed into it,
        // with a dark seam where it meets the next cell.
        if (!((r !== v && state(r) === 1) || (dn !== v && state(dn) === 1))) code[p] = c[0] === 3 ? (px < CX ? 1 : 2) : c[0];
        continue;
      }
      // Not yet entered: only the lattice lines round it, a line x = i in
      // voice A's colour and a line y = j in B's, and the line of the walk.
      for (const q of [r, dn]) {
        if (!q || q === v || state(q) === 1 || (st !== 2 && state(q) !== 2)) continue;
        code[p] = floor((q - 1) / 1024) !== floor((v - 1) / 1024) ? 1 : 2;
      }
      if (st === 2 && px === CX) code[p] = c[0] === 3 ? 2 : c[0];
    }
  // The two voices side by side at the left: one block per tick, voice A
  // in the outer lane, B in the inner one. A struck block throws a line to
  // the point where the walk crosses into its next cell.
  const n0 = floor(T - (H - PY) / R) - 1, n1 = ceil(T + (PY - TOP) / R) + 1;
  for (let n = max(1, n0); n <= n1; n++) {
    const [a, b] = hits(S, n);
    const yb = round(PY - (n - T) * R), ya = yb - R + 1;
    // Not yet struck: an outline; struck: filled. A tick neither voice
    // strikes, which only a rational alpha leaves, is a box round both lanes.
    const done = n <= T;
    for (let py = max(TOP, ya); py < min(H, yb); py++) {
      const edge = py === ya || py === yb - 1;
      for (let px = 0; px < 2 * LW; px++) {
        const c = px < LW ? 1 : 2, on = c === 1 ? a : b, side = px === 0 || px === 2 * LW - 1;
        if ((on && (done || edge || side || px === LW - 1 || px === LW)) || (!a && !b && (edge || side))) code[py * W + px] = c;
      }
    }
    const age = T - n;
    if (age >= 0 && age < 0.7) {
      const x1 = round(2 * LW + (CX - 2 * LW) * (1 - age / 0.7));
      for (const [v, inv, c] of [[a, S.ia, 1], [b, S.ib, 2]]) {
        if (!v) continue;
        const te = ceil(n * inv - 1e-9) / inv, py = round(PY - (te - T) * R - 0.5);
        if (py >= TOP && py < H) for (let px = 2 * LW; px < x1; px++) code[py * W + px] = c;
      }
    }
  }
  // alpha and beta, top left and top right.
  const label = (s, x0, cc, right) => {
    const gl = [...s].map((ch) => GL[ch].split(" "));
    let wd = -1;
    for (const g of gl) wd += g[0].length + 1;
    let x = right ? W - 1 - wd : x0;
    for (const g of gl) {
      for (let r = 0; r < 5; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === "#") code[(1 + r) * W + x + q] = cc;
      x += g[0].length + 1;
    }
  };
  label(S.st.la, 1, 1, false);
  label(S.st.lb, 0, 2, true);
  const ca = hsv(S.hue + 5 / 6, S.ca), cb = hsv(S.hue + 1 / 3, S.cb);
  for (let p = 0; p < W * H; p++) {
    const c = code[p], x = p % W, y = (p - x) / W;
    if (c === 1) display.setPixel(x, y, ca[0], ca[1], ca[2]);
    else if (c === 2) display.setPixel(x, y, cb[0], cb[1], cb[2]);
    else display.setPixel(x, y, 0, 0, 0);
  }
}
