// ===== Patternflow pattern =====
// Title:   Gridfonts
// Family:  type
// Idea:    Three lines of three lowercase letters are built only from short strokes joining neighbouring points of a faint 3 by 7 dot grid, as in Douglas Hofstadter's gridfonts, and when the style changes every letter on the panel takes back and draws in its strokes by the same rule at once, cutting its corners, raising gables or opening stencil gaps.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: gridfonts and the Letter Spirit project (Douglas Hofstadter, 1980s; Gary McGraw's thesis, 1995; Hofstadter and the Fluid Analogies Research Group, Fluid Concepts and Creative Analogies, 1995), letters and styles drawn for this pattern, pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Style=0..6, Grid=0..1
//
// Knob 1: Hue. Turns the letters round the wheel from sea green at 0; each style keeps its own small step off that colour.
// Knob 2: Speed. How fast strokes draw and the pages turn: at 2 something changes every 4 seconds, at 0.2 every 40.
// Knob 3: Style. At 0 the six styles take turns, every other change a new style on the same words and then new words in that style; 1 to 6 hold one style: Square, Cut, Lean, Gable, Stencil, Inline.
// Knob 4: Grid. The grid under the letters: dim points at 0, brighter points from 0.06, and toward 1 all 56 strokes every letter could use, faintly, in each letter's cell.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The grid of one letter: 3 points across and 7 down, point p = 3 * row +
// column with row 0 at the top. Rows 2 to 4 are the central zone, from the
// x-height down to the baseline; rows 0 and 1 hold ascenders, 5 and 6
// descenders.
const GC = 3, GR = 7, GP = GC * GR;
// A quantum joins two points that are neighbours across, down or on a
// diagonal. Counted here: 14 across, 18 down and 24 diagonals, 56 in all.
const QA = [], QB = [];
const QID = new Int8Array(GP * GP).fill(-1);
for (let p = 0; p < GP; p++)
  for (let q = p + 1; q < GP; q++)
    if (max(abs((q % GC) - (p % GC)), abs(floor(q / GC) - floor(p / GC))) === 1) {
      QID[p * GP + q] = QID[q * GP + p] = QA.length;
      QA.push(p);
      QB.push(q);
    }
const NQ = QA.length;

// The panel: points 7 LEDs apart, three letters a line with an empty square
// between letters, so the points of all nine letters fall on one lattice of
// 9 by 19 points. Lines share a row of points: one line's descender row is
// the next line's ascender row, and the pages are chosen so that no
// descender meets an ascender there.
const SQ = 7, X0 = 3, PITCH = 3 * SQ, LINE = 6 * SQ, CELLS = 9;

// The base face, written as pen paths. Each pair of digits is a point,
// column then row, and the pen goes straight from one to the next, so one
// step of a path may run over two quanta in a line.
const BASE = {
  a: "022224040323",
  b: "0004242202",
  c: "22020424",
  d: "2024040222",
  e: "032322020424",
  f: "201014 0222",
  g: "240402222606",
  h: "0004 022224",
  i: "1214 1011",
  j: "121606 1011",
  k: "0004 221303 1324",
  l: "1014",
  m: "04022224 1214",
  n: "04022224",
  o: "0222240402",
  p: "0602222404",
  q: "2622020424",
  r: "040222",
  s: "220203232404",
  t: "1114 0222 1424",
  u: "02042422",
  v: "0203142322",
  w: "0204132422",
  x: "0224 2204",
  y: "020424 222606",
  z: "02220424",
};

// A path string to directed quanta [from point, to point] in pen order.
function parse(src) {
  const out = [];
  for (const path of src.split(" "))
    for (let i = 2; i + 1 < path.length; i += 2) {
      let c = +path[i - 2], r = +path[i - 1];
      const c1 = +path[i], r1 = +path[i + 1];
      const sc = Math.sign(c1 - c), sr = Math.sign(r1 - r);
      for (let n = max(abs(c1 - c), abs(r1 - r)); n > 0; n--) {
        out.push([r * GC + c, (r + sr) * GC + c + sc]);
        c += sc;
        r += sr;
      }
    }
  return out;
}

const col = (p) => p % GC, row = (p) => floor(p / GC);
const other = (s, p) => (s[0] === p ? s[1] : s[0]);

// Style rules. Each takes a letter's directed quanta and gives new ones, the
// same rule for every letter, which is what Hofstadter meant by a gridfont
// having one spirit.

// Cut corners. Where exactly two quanta meet at a point, one across and one
// down, both go and the diagonal across the corner takes their place. The
// mask says which corners of a box: 1 top left, 2 top right, 4 bottom left,
// 8 bottom right. A quantum is used by one corner at most.
function cut(list, mask) {
  const at = Array.from({ length: GP }, () => []);
  list.forEach((s, i) => (at[s[0]].push(i), at[s[1]].push(i)));
  const out = list.slice(), gone = new Uint8Array(list.length);
  list.forEach((s, i) => {
    for (const p of [s[1], s[0]]) {
      if (gone[i] || at[p].length !== 2) continue;
      const j = at[p][0] === i ? at[p][1] : at[p][0];
      if (gone[j]) continue;
      const a = other(s, p), b = other(list[j], p);
      const horiz = (q) => row(q) === row(p), vert = (q) => col(q) === col(p);
      let hq, vq;
      if (horiz(a) && vert(b)) (hq = a), (vq = b);
      else if (vert(a) && horiz(b)) (hq = b), (vq = a);
      else continue;
      const east = col(hq) > col(p), south = row(vq) > row(p);
      const bit = east ? (south ? 1 : 4) : south ? 2 : 8;
      if (!(mask & bit)) continue;
      out[i] = s[1] === p ? [a, b] : [b, a];
      gone[i] = gone[j] = 1;
      out[j] = null;
    }
  });
  return out.filter(Boolean);
}

// Gables. A full bar at the x-height whose both ends go on down becomes a
// roof peaked one square higher; a full bar on the baseline whose both ends
// come up becomes a keel one square lower. A stroke that met the middle of
// the bar is carried on to the peak or the keel.
function gable(list) {
  const out = list.map((s) => s.slice());
  const has = (a, b) => out.findIndex((s) => (s[0] === a && s[1] === b) || (s[0] === b && s[1] === a));
  const goes = (p, dr) => out.some((s) => (s[0] === p || s[1] === p) && row(other(s, p)) === row(p) + dr);
  for (const [r, dr] of [[2, 1], [4, -1]]) {
    const L = r * GC, M = L + 1, R = L + 2, apex = M - dr * GC;
    const i = has(L, M), j = has(M, R);
    if (i < 0 || j < 0 || !goes(L, dr) || !goes(R, dr)) continue;
    const meets = out.some((s, k) => k !== i && k !== j && (s[0] === M || s[1] === M));
    out[i] = out[i].map((p) => (p === M ? apex : p));
    out[j] = out[j].map((p) => (p === M ? apex : p));
    if (meets) out.push(dr > 0 ? [apex, M] : [M, apex]);
  }
  return out;
}

// Six styles. cut is a corner mask for cut(), gable says gable() runs, gap
// opens every quantum away from the points it joins so each one stands
// alone as in a stencil, ring draws a stroke as its outline, and hue is the
// style's step off the Hue knob.
const STYLES = [
  { name: "Square", hue: 0, cut: 0, gable: 0, gap: 0, ring: 0 },
  { name: "Cut", hue: 0.06, cut: 15, gable: 0, gap: 0, ring: 0 },
  { name: "Lean", hue: -0.06, cut: 1 | 8, gable: 0, gap: 0, ring: 0 },
  { name: "Gable", hue: 0.12, cut: 0, gable: 1, gap: 0, ring: 0 },
  { name: "Stencil", hue: -0.12, cut: 0, gable: 0, gap: 1, ring: 0 },
  { name: "Outline", hue: 0.18, cut: 0, gable: 0, gap: 0, ring: 1 },
];
const NS = STYLES.length;

const idOf = (s) => QID[s[0] * GP + s[1]];
const keyOf = (l) => l.map(idOf).sort((a, b) => a - b).join();
const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

// Every letter in every style, as directed quanta with no quantum twice.
const FACES = STYLES.map((st) => {
  const make = (ch, mask) => {
    let l = parse(BASE[ch]);
    if (mask) l = cut(l, mask);
    if (st.gable) l = gable(l);
    const seen = new Uint8Array(NQ);
    return l.filter((s) => {
      const id = idOf(s);
      if (id < 0 || seen[id]) return false;
      return (seen[id] = 1);
    });
  };
  const face = {};
  for (const ch in BASE) face[ch] = make(ch, st.cut);
  // The letter comes before the style. Cut makes u the same quanta as v, so
  // a letter the rule turns into another letter backs off, cutting as many
  // of its corners as it can and still be itself.
  const clash = (ch) => Object.keys(face).some((o) => o !== ch && keyOf(face[o]) === keyOf(face[ch]));
  for (const ch in BASE) {
    if (!st.cut || !clash(ch) || keyOf(face[ch]) === keyOf(parse(BASE[ch]))) continue;
    const masks = [];
    for (let m = st.cut - 1; m >= 0; m--) if ((m & st.cut) === m) masks.push(m);
    masks.sort((a, b) => bits(b) - bits(a));
    for (const m of masks) if (((face[ch] = make(ch, m)), !clash(ch))) break;
  }
  return face;
});

// Pages of three three-letter lines. The alphabet pages are the specimen
// sheet every gridfont was shown on.
const PAGES = ["the", "sly", "fox", "abc", "def", "ghi", "web", "zig", "zag", "jkl", "mno", "pqr", "sea", "and", "sky", "stu", "vwx", "yz ", "art", "for", "all"]
  .join("")
  .match(/.{9}/g);

// Timing in seconds at Speed 2: a change every BEAT; quanta that leave take
// back over BACK, those that come draw over DRAW one STEP apart in pen order,
// after the leaving is done; each letter starts LAG after the one before.
const BEAT = 4, BACK = 0.3, DRAW = 0.2, STEP = 0.09, LAG = 0.06, CLEAR = 0.4;

// Stroke profile against distance from the stroke's middle line, 64 steps
// a LED: a 1 LED core, a shoulder to 1.25 LEDs and a glow that dies by 3.5.
const PROF = new Float32Array(256);
for (let k = 0; k < 256; k++) {
  const d = k / 64;
  PROF[k] = d < 0.55 ? 1 : d < 1.25 ? 1 - ((d - 0.55) / 0.7) * 0.55 : 0.45 * exp(-(d - 1.25) * 1.35);
}
const REACH = 3.5;
// The outline style lights the edge of a stroke this far out.
const RING = 2.1;

export function setup(params) {
  // The lattice points, and every quantum of every cell as a one-LED line.
  const dot = new Uint8Array(N), mesh = new Uint8Array(N);
  for (let gy = 0; gy <= 18; gy++) for (let gx = 0; gx < 9; gx++) dot[gy * SQ * W + X0 + gx * SQ] = 1;
  for (let c = 0; c < CELLS; c++) {
    const ox = X0 + (c % 3) * PITCH, oy = floor(c / 3) * LINE;
    for (let id = 0; id < NQ; id++) {
      const ax = ox + col(QA[id]) * SQ, ay = oy + row(QA[id]) * SQ;
      const sx = col(QB[id]) - col(QA[id]), sy = row(QB[id]) - row(QA[id]);
      for (let k = 1; k < SQ; k++) {
        const x = ax + sx * k, y = ay + sy * k;
        if (y < H) mesh[y * W + x] = 1;
      }
    }
  }
  const Q = CELLS * NQ;
  params.s = {
    dot, mesh, D: new Float32Array(N), B: new Float32Array(N), Wh: new Float32Array(N),
    kind: new Uint8Array(Q), t0: new Float32Array(Q), dir: new Uint8Array(Q), ord: new Uint8Array(Q),
    T: 0, next: BEAT, page: 0, style: 0, knob: -1, flip: 0, ready: false,
    from: STYLES[0], to: STYLES[0], styleT: -9, hue: 0, grid: 0.06,
  };
}

// Send the current page in the current style to the cells. Quanta the old
// and the new letter share stay lit; the rest take back or draw in. kind is
// 0 dark, 1 drawing or drawn, 2 taking back.
function show(S, first) {
  const text = PAGES[S.page], face = FACES[S.style];
  const want = new Int16Array(NQ);
  for (let c = 0; c < CELLS; c++) {
    want.fill(-1);
    const list = face[text[c]] || [];
    list.forEach((s, j) => (want[idOf(s)] = j));
    for (let id = 0; id < NQ; id++) {
      const k = c * NQ + id;
      if (S.kind[k] !== 1 || want[id] >= 0) continue;
      // One that has not begun to draw just never comes.
      if (S.t0[k] > S.T) S.kind[k] = 0;
      else (S.kind[k] = 2), (S.t0[k] = S.T + c * LAG);
    }
    let n = 0;
    const start = S.T + c * LAG + (first ? 0 : CLEAR);
    list.forEach((s, j) => {
      const id = idOf(s), k = c * NQ + id;
      S.dir[k] = s[0] === QA[id] ? 0 : 1;
      S.ord[k] = j;
      if (S.kind[k] === 1) return;
      S.kind[k] = 1;
      S.t0[k] = start + n++ * STEP;
    });
  }
}

const blend = (S) => {
  const e = smooth((S.T - S.styleT) / 0.9), f = S.from, t = S.to;
  return { hue: f.hue + (t.hue - f.hue) * e, gap: f.gap + (t.gap - f.gap) * e, ring: f.ring + (t.ring - f.ring) * e };
};

function restyle(S, style) {
  // The blend starts from wherever the last one had got to.
  S.from = blend(S);
  S.to = STYLES[style];
  S.style = style;
  S.styleT = S.T;
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.grid = cl(k[3], 0, 1);
  const want = cl(round(k[2]), 0, NS);
  if (!S.ready) {
    S.ready = true;
    S.knob = want;
    S.style = want > 0 ? want - 1 : 0;
    S.from = S.to = STYLES[S.style];
    show(S, true);
  } else if (want !== S.knob) {
    S.knob = want;
    if (want > 0 && want - 1 !== S.style) {
      restyle(S, want - 1);
      show(S, false);
    }
  }
  S.T += (dt * cl(k[1], 0.05, 3)) / 2;
  while (S.T >= S.next) {
    S.next += BEAT;
    // Held: new words each beat. Taking turns: a new style on the same
    // words, then new words in that style.
    if (S.knob === 0 && (S.flip ^= 1)) restyle(S, (S.style + 1) % NS);
    else S.page = (S.page + 1) % PAGES.length;
    show(S, false);
  }
}

// One stroke from (x0, y0) to (x1, y1), its pen position running s0 to s1.
// Each LED keeps the distance to the nearest stroke (so the outline of
// strokes that meet is one outline) and how near that stroke's stretch is
// to the light running along the pen path at P.
function stroke(S, x0, y0, x1, y1, s0, s1, P, fade) {
  const { D, B } = S;
  const bx0 = max(0, floor(min(x0, x1) - REACH)), bx1 = min(W - 1, ceil(max(x0, x1) + REACH));
  const by0 = max(0, floor(min(y0, y1) - REACH)), by1 = min(H - 1, ceil(max(y0, y1) + REACH));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const t = cl(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1);
      const ex = x - x0 - t * dx, ey = y - y0 - t * dy;
      const d = sqrt(ex * ex + ey * ey) + fade, p = y * W + x;
      if (d >= D[p]) continue;
      D[p] = d;
      const u = s0 + (s1 - s0) * t - P;
      B[p] = u * u < 9 ? exp(-u * u * 1.2) : 0;
    }
}

// The pen's head while a quantum draws: a small white spark.
function spark(Wh, x, y, lv) {
  for (let yy = max(0, floor(y - 2)); yy <= min(H - 1, ceil(y + 2)); yy++)
    for (let xx = max(0, floor(x - 2)); xx <= min(W - 1, ceil(x + 2)); xx++) {
      const d2 = (xx - x) * (xx - x) + (yy - y) * (yy - y);
      const v = lv * exp(-d2 / 1.1), p = yy * W + xx;
      if (v > Wh[p]) Wh[p] = v;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S.ready) return;
  const { D, B, Wh, kind, t0, dir, ord, T } = S;
  D.fill(REACH);
  B.fill(0);
  Wh.fill(0);
  const { hue, gap, ring } = blend(S);
  for (let c = 0; c < CELLS; c++) {
    const ox = X0 + (c % 3) * PITCH, oy = floor(c / 3) * LINE;
    // A light runs along each letter's pen path, a quantum in 0.3 s, the
    // letters a little apart in reading order.
    const P = ((T - c * 0.23) * 3.3) % 18 - 2;
    for (let id = 0; id < NQ; id++) {
      const k = c * NQ + id, kd = kind[k];
      if (!kd) continue;
      const tt = T - t0[k];
      let u0 = 0, u1 = 1, fade = 0, head = 0;
      if (kd === 1) {
        const p = tt / DRAW;
        if (p <= 0) continue;
        if (p < 1) (u1 = p), (head = 1 - p * 0.5);
      } else {
        const q = tt / BACK;
        if (q >= 1) continue;
        if (q > 0) (u0 = q), (fade = 1.2 * q);
      }
      let a = QA[id], b = QB[id];
      if (dir[k]) [a, b] = [b, a];
      const ax = ox + col(a) * SQ, ay = oy + row(a) * SQ;
      const dx = (col(b) - col(a)) * SQ, dy = (row(b) - row(a)) * SQ;
      // Stencil: pull both ends back from the points.
      const g = (gap * 1.8) / sqrt(dx * dx + dy * dy);
      u0 = max(u0, g);
      u1 = min(u1, 1 - g);
      if (u1 <= u0) continue;
      const o = ord[k];
      stroke(S, ax + dx * u0, ay + dy * u0, ax + dx * u1, ay + dy * u1, o + u0, o + u1, P, fade);
      if (head > 0) spark(Wh, ax + dx * u1, ay + dy * u1, head);
    }
  }
  const [lr, lg, lb] = hsv(0.42 + S.hue + hue, 0.72, 1);
  const [gr, gg, gb] = hsv(0.36 + S.hue + hue, 0.35, 1);
  const G = S.grid;
  const dotL = 44 + 60 * min(1, G * 3), meshL = 78 * max(0, (G - 0.08) / 0.92);
  const rc = RING * ring;
  const { dot, mesh } = S;
  for (let p = 0; p < N; p++) {
    const d = D[p];
    let v = 0, w = Wh[p];
    if (d < REACH) {
      const k = (abs(d - rc) * 64) | 0;
      v = k < 256 ? PROF[k] : 0;
      const b = B[p];
      w += 0.3 * b * v;
      v *= 0.7 + 0.3 * b;
    }
    const base = (dot[p] ? dotL : mesh[p] ? meshL : 0) * (1 - v);
    // The middle of a lit stroke runs a little toward white.
    const hot = v > 0.75 ? (v - 0.75) * 1.2 : 0;
    display.setPixel(
      p % W,
      (p / W) | 0,
      min(255, 255 * (lr * v + (1 - lr) * hot + w) + gr * base),
      min(255, 255 * (lg * v + (1 - lg) * hot + w) + gg * base),
      min(255, 255 * (lb * v + (1 - lb) * hot + w) + gb * base),
    );
  }
}
