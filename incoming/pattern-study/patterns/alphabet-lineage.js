// ===== Patternflow pattern =====
// Title:   Alphabet Lineage
// Family:  type
// Idea:    A four letter Latin word stacked down the tall panel starts as Proto-Sinaitic pictures, an ox head, a house, water, a human head, and every letter's strokes bend through Phoenician, written right to left, turn over like a card to face the other way as Greek, and settle as Roman capitals with thick and thin strokes and serifs, the letters one after another so the column can hold four eras at once.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the alphabet's descent from Proto-Sinaitic (Wadi el-Hol and Serabit el-Khadim, c. 1850 BCE; read by Alan Gardiner, The Egyptian origin of the Semitic alphabet, 1916) through Phoenician (c. 1050 BCE) and archaic Greek (c. 750 BCE) to Roman inscriptional capitals (1st century); letter shapes drawn for this pattern, pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..5, Lag=0..1
//
// Knob 1: Hue. Turns the four era colours round the wheel together. At 0 the pictographs are gold, Phoenician purple, Greek azure and the Roman capitals warm white.
// Knob 2: Speed. At 2 a letter holds each era 1.2 to 2.6 s and takes 1.8 s to bend into the next, and a whole history with its 1.4 s rewind takes 13.4 s; every time goes as 2 / Speed.
// Knob 3: Word. 0 ROMA, 1 AMOR, 2 ARMA, 3 DONA, 4 BONA, 5 MORA, Latin words that between them use all seven letters drawn here: A, B, D, M, N, O and R.
// Knob 4: Lag. How far each letter runs behind the one above, in eras: 0.06 at the opening, so the word changes almost as one; at 1 the column shows four eras at once, the top letter a Roman capital while the bottom one is still a picture.

// Each letter is a few strokes, and each stroke is a polyline in every era,
// on a 10 by 10 grid with y down. A stroke is resampled to the same number
// of points by arc length in every era, so one era's stroke bends into the
// next point by point. A stroke that is not there in an era has alpha 0 and
// borrows its shape from the next era that has it.
//
// Between two eras a letter may also turn. The ox head lies down on its
// side as Phoenician aleph and stands up again, upside down, as alpha; the
// Greek delta lies on its side to round into D. When Greek settled on
// writing left to right, letters that face a way turned to face the other:
// Phoenician beth, mem, nun and resh look left, Greek beta, mu, nu and rho
// look right. So between Phoenician and Greek every letter except the ox
// head turns over about its upright axis, like a card. The morph bends the
// stroke toward the next era's shape seen from before the turn, and turns
// it on the way; at the end of the morph the turn is complete and the
// stroke is the next era's.
//
// The pen is round and a little thinner each era back. The Roman capitals
// get the shading of a broad edged brush held at 30 degrees, thick where a
// stroke runs across the edge and thin along it (Edward Catich, The Origin
// of the Serif, 1968), and short serifs fade in at their feet.
//
// Phoenician and archaic Greek shapes and stroke directions were checked
// against the Unicode reference glyphs in Noto Sans Phoenician and Noto
// Sans Old Italic; the coordinates are drawn here, not copied.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, sin, cos, abs, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const K = 36;

// Era colours at Hue 0 (h, s), widths of the round pen in grid units.
const ERA = [[0.12, 0.62], [0.82, 0.55], [0.56, 0.62], [0.09, 0.1]];
const PEN = [0.3, 0.34, 0.37, 0.4];
// Seconds at Speed 2: hold in each era, the bend between, the rewind.
const HOLD = [1.6, 1.2, 1.2, 2.6], BEND = 1.8, BACK = 1.4;
const CYCLE = HOLD[0] + HOLD[1] + HOLD[2] + HOLD[3] + 3 * BEND + BACK;

const WORDS = ["ROMA", "AMOR", "ARMA", "DONA", "BONA", "MORA"];

// Per letter: the turn between eras 0-1, 1-2, 2-3 as [degrees clockwise,
// mirrored], and the strokes as [alpha per era, shape per era]. A shape is
// "x,y x,y ..."; a closed stroke ends where it starts; "" borrows.
const LETTERS = {
  // ʾalp, the ox head, muzzle down -> aleph on its side -> alpha -> A.
  A: {
    turn: [[90, 0], [90, 0], [0, 0]],
    strokes: [
      [[1, 1, 1, 1], [
        "3,3.2 3.4,6 4.1,8.2 5,9.1 5.9,8.2 6.6,6 7,3.2",
        "7.9,1.3 4.5,3.7 1,6.3 5.4,6.2 9.7,6.1",
        "8.4,9.5 6.7,5 5,0.6 3.3,5 1.6,9.5",
        "9,9.4 7,4.9 5,0.4 3,4.9 1,9.4",
      ]],
      [[1, 1, 1, 1], [
        "0.6,0.8 1.4,2.4 2.6,3.3 5,3.7 7.4,3.3 8.6,2.4 9.4,0.8",
        "3.6,0.6 4.8,5 6.1,9.4",
        "7.1,5.6 2.9,6.4",
        "7.2,6.5 2.8,6.5",
      ]],
      [[1, 0, 0, 0], ["4.1,5 4.3,5.2", "", "", ""]],
      [[1, 0, 0, 0], ["5.9,5 5.7,5.2", "", "", ""]],
      [[0, 0, 0, 1], ["", "", "", "-0.2,9.4 2.4,9.4"]],
      [[0, 0, 0, 1], ["", "", "", "7.6,9.4 10.2,9.4"]],
    ],
  },
  // bayt, a house with its door -> beth -> beta -> B.
  B: {
    turn: [[0, 0], [0, 1], [0, 0]],
    strokes: [
      [[1, 1, 1, 1], [
        "8.6,5 8.6,1.4 1.4,1.4 1.4,8.6 4,8.6",
        "6.9,5 1.2,4.6 5.8,0.6 6.6,2.6 6.9,5 6.4,7.6 4.4,9 1.8,9.4",
        "2.4,4.8 6.4,4.2 7.4,2.4 6.2,0.8 2.4,0.6 2.4,9.4 7,9.2 8.2,7.2 7,5.2 2.4,4.8",
        "2.2,4.7 5.6,4.6 6.8,3.8 7,2.5 6.6,1.3 5.4,0.6 2.2,0.6 2.2,9.4 6,9.4 7.6,8.6 8,7 7.4,5.5 5.8,4.8 2.2,4.7",
      ]],
      [[1, 0, 0, 0], ["6,8.6 8.6,8.6", "", "", ""]],
      [[0, 0, 0, 1], ["", "", "", "0.8,0.6 2.4,0.6"]],
      [[0, 0, 0, 1], ["", "", "", "0.8,9.4 2.4,9.4"]],
    ],
  },
  // dalt, a door with its leaf -> daleth -> delta -> D, the delta laid on
  // its side as western Greek and Latin wrote it.
  D: {
    turn: [[0, 0], [0, 1], [90, 0]],
    strokes: [
      [[1, 1, 1, 1], [
        "2.4,0.8 7.6,0.8 7.6,9.2 2.4,9.2 2.4,0.8",
        "4.6,0.8 1.6,6 6.4,6 4.6,0.8",
        "5,0.8 0.8,9.2 9.2,9.2 5,0.8",
        "2.2,0.6 5,0.6 7.4,1.8 8.6,3.8 8.8,5 8.6,6.2 7.4,8.2 5,9.4 2.2,9.4 2.2,0.6",
      ]],
      [[1, 1, 0, 0], ["5.6,2.2 6.4,5 5.6,7.8", "6.4,6 8.2,9.2", "9.2,9.2 9.2,9.2", ""]],
      [[0, 0, 0, 1], ["", "", "", "0.8,0.6 2.4,0.6"]],
      [[0, 0, 0, 1], ["", "", "", "0.8,9.4 2.4,9.4"]],
    ],
  },
  // mem, water -> mem with its tail -> mu, long left leg -> M.
  M: {
    turn: [[0, 0], [0, 1], [0, 0]],
    strokes: [
      [[1, 1, 1, 1], [
        "0.4,4 1.6,6 2.8,4 4,6 5.2,4 6.4,6 7.6,4 8.8,6 9.6,4.6",
        "1.1,0.6 3,3 4.7,1.3 6.4,3 9,0.8 8.4,4.8 6.6,8 4,9.6",
        "0.9,9.4 3,0.6 5.4,5.9 7.7,0.6 9.6,5.2",
        "1,9.4 2.1,0.6 5,9.4 7.9,0.6 9,9.4",
      ]],
      [[0, 0, 0, 1], ["", "", "", "-0.2,9.4 2,9.4"]],
      [[0, 0, 0, 1], ["", "", "", "8,9.4 10.2,9.4"]],
    ],
  },
  // nun, a snake -> nun -> nu, long left leg -> N.
  N: {
    turn: [[0, 0], [0, 1], [0, 0]],
    strokes: [
      [[1, 1, 1, 1], [
        "1.4,1.4 2.4,0.6 3.4,1.2 3.6,2.8 5.4,3.4 7.4,2.6 8,4.2 6.6,6 4.6,7 4.4,8.6 6,9.6",
        "1.8,0.6 3.8,3.6 7.4,1.2 6.4,5.6 3.2,9.6",
        "1.2,9.4 3.2,0.6 6.4,6.4 8.8,0.6",
        "1.6,9.4 1.6,0.6 8.4,9.4 8.4,0.6",
      ]],
      [[0, 0, 0, 1], ["", "", "", "0.6,9.4 2.6,9.4"]],
      [[0, 0, 0, 1], ["", "", "", "7.4,0.6 9.4,0.6"]],
    ],
  },
  // ʿayin, an eye -> ayin -> omicron -> O.
  O: {
    turn: [[0, 0], [0, 1], [0, 0]],
    strokes: [
      [[1, 1, 1, 1], [
        "0.4,5 1.8,3.4 3.4,2.5 5,2.2 6.6,2.5 8.2,3.4 9.6,5 8.2,6.6 6.6,7.5 5,7.8 3.4,7.5 1.8,6.6 0.4,5",
        "circle 5,5 3.4",
        "circle 5,5 3.9",
        "circle 5,5 4.5",
      ]],
      [[1, 0, 0, 0], ["circle 5,5 1.3", "circle 5,5 0.2", "", ""]],
    ],
  },
  // rōš, a head in profile looking left -> resh -> rho -> R, whose leg
  // Latin kept to tell it from its own P.
  R: {
    turn: [[0, 0], [0, 1], [0, 0]],
    strokes: [
      [[1, 1, 1, 1], [
        "5.8,9.6 5.8,6.8 7.2,5 7.6,3 6.6,1.2 4.4,0.6 2.4,1.6 1.2,3.4 2.2,3.9 2,4.8 2.8,5.8 4.2,6.2 5.8,6.8",
        "7.8,9.6 6.4,4.4 5.2,0.6 1.4,3.6 6.4,4.4",
        "2.4,9.4 2.4,0.6 6,0.6 7.6,1.6 7.8,3 6.8,4.6 2.4,5",
        "2.2,9.4 2.2,0.6 5.4,0.6 7,1.2 7.6,2.6 7,4 5.4,4.8 2.2,4.8",
      ]],
      [[0, 0, 1, 1], ["5.8,6.8 5.8,6.8", "6.4,4.4 6.4,4.4", "4.2,4.9 4.2,4.9", "4.4,4.8 6.4,7 8.6,9.4"]],
      [[1, 0, 0, 0], ["3.4,2.6 3.6,2.8", "", "", ""]],
      [[0, 0, 0, 1], ["", "", "", "0.8,0.6 2.4,0.6"]],
      [[0, 0, 0, 1], ["", "", "", "0.8,9.4 3.6,9.4"]],
      [[0, 0, 0, 1], ["", "", "", "7.8,9.4 10,9.4"]],
    ],
  },
};

function parse(text) {
  if (text.startsWith("circle")) {
    const [, c, r] = text.split(" "), [x, y] = c.split(",").map(Number), rr = Number(r), pts = [];
    // Starts at the left, as the eye does, and runs clockwise.
    for (let i = 0; i <= 24; i++) pts.push([x - rr * cos((i / 24) * 2 * PI), y - rr * sin((i / 24) * 2 * PI)]);
    return pts;
  }
  return text.split(" ").map((t) => t.split(",").map(Number));
}

// K points evenly along the polyline.
function resample(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1], out = [];
  let j = 1;
  for (let k = 0; k < K; k++) {
    const s = (total * k) / (K - 1);
    while (j < pts.length - 1 && L[j] < s) j++;
    const seg = L[j] - L[j - 1] || 1, t = total ? cl((s - L[j - 1]) / seg, 0, 1) : 0;
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]);
  }
  return out;
}

// The turn between two eras, about the middle of the grid, and back.
function turn(pts, deg, mir, back) {
  const a = ((back ? -deg : deg) * PI) / 180, c = cos(a), s = sin(a);
  return pts.map(([x, y]) => {
    let dx = x - 5, dy = y - 5;
    if (mir && !back) dx = -dx;
    let rx = dx * c - dy * s, ry = dx * s + dy * c;
    if (mir && back) rx = -rx;
    return [5 + rx, 5 + ry];
  });
}

const closed = (p) => Math.hypot(p[0][0] - p[K - 1][0], p[0][1] - p[K - 1][1]) < 1e-6;
const gap = (a, b) => a.reduce((s, p, i) => s + (p[0] - b[i][0]) ** 2 + (p[1] - b[i][1]) ** 2, 0);

// The target turned to face the source the nearest way: reversed if open,
// and for a closed stroke also started at the best point.
function align(src, tgt) {
  let best = tgt, bg = gap(src, tgt);
  const rev = tgt.slice().reverse();
  if (gap(src, rev) < bg) {
    best = rev;
    bg = gap(src, rev);
  }
  if (closed(tgt)) {
    const ring = tgt.slice(0, K - 1);
    for (const dir of [ring, ring.slice().reverse()])
      for (let sft = 0; sft < K - 1; sft++) {
        const c = [];
        for (let i = 0; i < K - 1; i++) c.push(dir[(i + sft) % (K - 1)]);
        c.push(c[0]);
        const g = gap(src, c);
        if (g < bg) {
          bg = g;
          best = c;
        }
      }
  }
  return best;
}

// Every letter's strokes for every era and every bend.
function build() {
  const out = {};
  for (const ch in LETTERS) {
    const L = LETTERS[ch], strokes = [];
    for (const [alpha, shapes] of L.strokes) {
      const g = shapes.map((t) => (t ? resample(parse(t)) : null));
      for (let e = 1; e < 4; e++) if (!g[e] && g[e - 1]) g[e] = turn(g[e - 1], L.turn[e - 1][0], L.turn[e - 1][1], false);
      for (let e = 2; e >= 0; e--) if (!g[e] && g[e + 1]) g[e] = turn(g[e + 1], L.turn[e][0], L.turn[e][1], true);
      // For each bend, the next era's shape seen from before the turn.
      const to = [0, 1, 2].map((e) => align(g[e], turn(g[e + 1], L.turn[e][0], L.turn[e][1], true)));
      strokes.push({ alpha, g, to });
    }
    out[ch] = { turn: L.turn, strokes };
  }
  return out;
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
}

const ease = (u) => u * u * (3 - 2 * u);

// The era position 0..3 of a letter whose own clock reads t seconds.
function eraAt(t) {
  if (t <= 0) return 0;
  t %= CYCLE;
  let x = 0;
  for (let e = 0; e < 3; e++) {
    if (t < HOLD[e]) return e;
    t -= HOLD[e];
    if (t < BEND) return e + t / BEND;
    t -= BEND;
  }
  if (t < HOLD[3]) return 3;
  t -= HOLD[3];
  x = 3 * (1 - ease(t / BACK));
  return x;
}

export function setup(params) {
  params.s = { glyphs: build(), clock: 0, hue: 0, word: 0, lag: 0.06, ink: new Float32Array(N), owner: new Int8Array(N) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.clock += cl(dt || 0, 0, 0.1) * (speed / 2);
  S.hue = k[0] || 0;
  S.word = round(cl(k[2] || 0, 0, WORDS.length - 1));
  S.lag = cl(k[3] == null ? 0.06 : k[3], 0, 1);
}

// Distance from (px, py) to the segment a-b.
function seg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 > 1e-9 ? cl(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1) : 0;
  const ex = px - ax - t * dx, ey = py - ay - t * dy;
  return sqrt(ex * ex + ey * ey);
}

// Ink a segment with a round pen of radius w and a soft halo.
function stamp(S, band, ax, ay, bx, by, w, a) {
  const x0 = max(0, floor(min(ax, bx) - w - 2)), x1 = min(W - 1, floor(max(ax, bx) + w + 2));
  const y0 = max(0, floor(min(ay, by) - w - 2)), y1 = min(H - 1, floor(max(ay, by) + w + 2));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = seg(x + 0.5, y + 0.5, ax, ay, bx, by);
      const v = a * max(cl(w + 0.5 - d, 0, 1), 0.3 * exp(-((d - w) * (d - w)) / 2.2));
      const i = y * W + x;
      if (v > S.ink[i]) {
        S.ink[i] = v;
        S.owner[i] = band;
      }
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  S.ink.fill(0);
  const word = WORDS[S.word], step = HOLD[1] + BEND;
  // Grid unit in LEDs and the 32 row band of each letter.
  const U = 2.7, colours = [];
  for (let n = 0; n < 4; n++) {
    const G = S.glyphs[word[n]], yc = n * 32 + 16, xc = 33;
    const x = eraAt(S.clock - n * S.lag * step);
    const e = min(2, floor(x)), u = ease(x - e);
    const [deg, mir] = G.turn[e];
    const a = ((deg * u) * PI) / 180, ca = cos(a), sa = sin(a);
    const flip = mir ? cos(PI * u) : 1;
    const shade = mir ? 0.5 + 0.5 * abs(flip) : 1;
    // Roman shading comes in over the last bend.
    const roman = e === 2 ? u : 0;
    const pen = PEN[e] + (PEN[e + 1] - PEN[e]) * u;
    const c0 = hsv(S.hue + ERA[e][0], ERA[e][1], 1), c1 = hsv(S.hue + ERA[e + 1][0], ERA[e + 1][1], 1);
    colours.push(c0.map((v, i) => (v + (c1[i] - v) * u) * 255 * shade));
    for (const st of G.strokes) {
      const al = st.alpha[e] + (st.alpha[e + 1] - st.alpha[e]) * u;
      if (al < 0.01) continue;
      const src = st.g[e], tgt = st.to[e];
      let px = 0, py = 0;
      for (let i = 0; i < K; i++) {
        let gx = src[i][0] + (tgt[i][0] - src[i][0]) * u - 5, gy = src[i][1] + (tgt[i][1] - src[i][1]) * u - 5;
        gx *= flip;
        const rx = gx * ca - gy * sa, ry = gx * sa + gy * ca;
        const qx = xc + rx * U, qy = yc + ry * U;
        if (i > 0) {
          // A broad edge at 30 degrees: thick across it, thin along it.
          const dx = qx - px, dy = qy - py, L = Math.hypot(dx, dy) || 1;
          const nib = abs((dx / L) * 0.5 + (dy / L) * 0.866);
          const w = (pen + roman * (0.22 + 0.5 * nib - pen)) * U;
          stamp(S, n, px, py, qx, qy, w, al);
        }
        px = qx;
        py = qy;
      }
    }
    // The era rail at the left: four ticks and where the letter is.
    for (let t = 0; t < 4; t++) stamp(S, n, 6, yc - 10.5 + 7 * t, 6, yc - 10.5 + 7 * t, 0.2, 0.35);
    stamp(S, n, 6, yc - 10.5 + 7 * x, 6, yc - 10.5 + 7 * x, 0.9, 1);
    // The writing direction at the right: left for Phoenician, then turned.
    const dirA = e === 0 ? u : 1, f = mir ? flip : e === 0 ? 1 : -1;
    const ax = 57 + 2.5 * f, bx = 57 - 2.5 * f;
    stamp(S, n, ax, yc - 3.5, bx, yc, 0.35, 0.8 * dirA);
    stamp(S, n, bx, yc, ax, yc + 3.5, 0.35, 0.8 * dirA);
  }
  for (let i = 0; i < N; i++) {
    const v = S.ink[i], c = colours[S.owner[i]];
    display.setPixel(i % W, (i / W) | 0, round(c[0] * v), round(c[1] * v), round(c[2] * v));
  }
}
