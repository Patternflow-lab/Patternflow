// ===== Patternflow pattern =====
// Title:   Hellschreiber
// Family:  type
// Idea:    A Hellschreiber receiver prints a radio message onto paper tape a column at a time and the tape is cut between words and pasted strip under strip on a slate form: each column of a letter comes in as tone on and off from the bottom up, and the turning helix prints it twice, one copy above the other, so when the receiver's clock runs slow or fast the line slides down or up the tape and wraps from one copy into the other while one whole copy can always be read, and noise, fading and static crashes print as speckle, pale letters and short dashes the eye reads past; when the seventh strip is full the form slides up a slot.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Hellschreiber (Rudolf Hell, patented 1929) and the Feld-Hell timing of 122.5 baud, 7 columns a letter and 2.5 letters a second, each column sent from the bottom up; bold 5 by 7 capitals drawn for this pattern; pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Paper=0..1, Speed=0.2..3, Noise=0..1, Drift=-1..1
//
// Knob 1: Paper. Turns form, tape and ink round the wheel together: at 0 cream tape with navy ink on a slate blue form and a gold print head; at 0.25 pale mint tape with plum ink on a purple form; at 0.5 pale blue tape with olive ink on a brown form; at 0.75 pink tape with dark green ink on a green form.
// Knob 2: Speed. Columns a second, 8.75 times the knob: Feld-Hell's 17.5 (2.5 letters) at 2, so a strip of nine letters takes 3.6 s; 1.75 at 0.2 and 26 at 3. The form slides up a slot in 0.45 s, faster above 2.
// Knob 3: Noise. The band's noise against a signal of 1: 0.19 rms at 0, where 2% of the blank tape takes a grey speck, up to 0.56 at 1, where a quarter of it does and 29% of the ink drops out; with it the fading deepens from 12% to 57% and static crashes, 1.5 to 5 rows of solid ink, come from one in 170 columns to one in 15. Both copies are printed at the same instant, so every speck and crash is printed twice.
// Knob 4: Drift. The receiver's clock against the sender's, from 4% fast at -1 to 4% slow at 1. At the opening 0.06 it is 0.24% slow and the line steps down one row about every strip, a whole copy over the seven strips of the form; at 1 it falls a whole copy every 25 columns, so the letters slant down the tape and each wraps from the lower copy into the upper one; turned below 0 the line climbs instead.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, log, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The face: 5 columns by 7 rows, rows from the top, drawn bold for
// this pattern, the letters and figures the messages use. Feld-Hell sends a
// letter as 7 columns, the glyph's 5 and 2 blank; a space here is 7 blank
// columns. The upright strokes are two columns wide, so when the receiver
// is out of phase and a glyph's lower rows land one column to the left of
// its upper rows (the print's own slant, on a tape one LED a column), the
// stroke still joins.
const FACE = {
  A: ".###.##.####.#########.####.####.##", B: "####.##.####.######.##.####.######.", C: ".######...##...##...##...##....####",
  D: "####.##.####.####.####.####.######.", E: "#######...##...####.##...##...#####", F: "#######...##...####.##...##...##...",
  G: ".######...##...##.####.####.##.####", H: "##.####.####.#########.####.####.##", I: "####..##...##...##...##...##..####.",
  J: "..###...##...##...##...####.##.###.", K: "##..###.######.###..####.##.####..#", L: "##...##...##...##...##...##...#####",
  M: "#...###.########.#.##...##...##...#", N: "#...###..####.##.####..###...##...#", O: ".###.##.####.####.####.####.##.###.",
  P: "####.##.####.######.##...##...##...", Q: ".###.##.####.####.#########.#..##.#", R: "####.##.####.######.####.##.####.##",
  S: ".######...##....###....##...######.", T: "#####.##...##...##...##...##...##..", U: "##.####.####.####.####.####.##.###.",
  V: "##.####.####.####.####.##.###...#..", W: "#...##...##.#.##.#.########.###...#", X: "##.####.##.###...#...###.##.####.##",
  Y: "##.####.##.###..##...##...##...##..", Z: "#####...##..##..##..##...##...#####", 1: ".##..###...##...##...##...##..####.",
  2: ".###.##.##...##..##..##..##...#####", 5: "#######...####....##...####.##.###.", 7: "#####...##..##..##...##...##...##..",
  9: ".###.##.####.##.####...##..##..##..", ".": "..........................##...##..", "-": "...............####................",
};

// Each glyph as 5 column masks, bit r the row r counted from the bottom,
// since every column is sent from the bottom up.
const GLYPH = {};
for (const k in FACE) {
  const f = FACE[k], cols = [];
  for (let c = 0; c < 5; c++) {
    let m = 0;
    for (let r = 0; r < 7; r++) if (f[(6 - r) * 5 + c] === "#") m |= 1 << r;
    cols.push(m);
  }
  GLYPH[k] = cols;
}

// ---- What is sent: the teleprinter test line, then the machine's own
// numbers. A message starts a fresh strip of tape; inside one, a strip holds
// whole words up to 9 letters and is cut in the space after the last.
const MESSAGES = ["THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG", "RUDOLF HELL 1929", "FELD-HELL 122.5 BAUD", "7 COLUMNS A LETTER", "2.5 CHARS A SECOND"];
const CAP = 9;
// The column stream of one round of the messages, and the plan of strips
// as [first column, end column) in it: one blank column of tape before the
// first glyph, one after the last. Messages are 14 blank columns apart.
const COLS = [], PLAN = [];
for (const msg of MESSAGES) {
  const words = msg.split(" ");
  let line = [];
  const flush = () => {
    if (!line.length) return;
    const start = COLS.length;
    line.forEach((w, i) => {
      if (i) for (let c = 0; c < 7; c++) COLS.push(0);
      for (const ch of w) {
        for (const m of GLYPH[ch]) COLS.push(m);
        COLS.push(0, 0);
      }
    });
    PLAN.push([start - 1, COLS.length - 1]);
    for (let c = 0; c < 5; c++) COLS.push(0);
    line = [];
  };
  for (const w of words) {
    const n = line.reduce((a, x) => a + x.length + 1, 0) + w.length;
    if (n > CAP) flush();
    line.push(w);
  }
  flush();
  for (let c = 0; c < 7; c++) COLS.push(0);
}
const L = COLS.length;

// ---- The form: seven slots of 18 rows from row 1, each a strip of tape 16
// rows high (a blank row, the 14 rows the helix prints, a blank row) and a
// gap of 2 rows of form.
const SLOT = 18, TAPE = 16, SLOTS = 7;
// Feld-Hell turns 17.5 columns a second, 2.5 letters of 7 columns.
const COLS_PER_S = 17.5;

const hash = (a, b) => {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());
}

function newStrip(S) {
  const [a, b] = PLAN[S.pi];
  const base = S.cyc * L;
  // The receiver keeps turning while the tape that is cut away runs out.
  while (S.phi < base + a) S.phi += S.rho;
  S.strips.push({ id: S.made, x0: 1 + floor(hash(S.made, 7) * 3), end: base + b, len: 0, ink: new Float32Array(W * 7) });
  S.made++;
}

// One turn of the helix: one column of tape, the signal from sender time
// phi to phi + rho, its 7 rows printed twice, one copy above the other.
// Row y of the column is what the helix hears a fraction (y + 1/2) / 7 of
// the way through the turn; when rho is not 1 that drifts through the
// sender's rows from turn to turn.
function turn(S) {
  const st = S.strips[S.strips.length - 1], rho = S.rho, k = st.len;
  for (let y = 0; y < 7; y++) {
    const t = S.phi + (rho * (y + 0.5)) / 7, c = floor(t), r = floor((t - c) * 7);
    const bit = (COLS[((c % L) + L) % L] >> r) & 1;
    // Fading: a slow swell of two periods, 140 and 53 columns.
    const fade = 1 - S.depth * (0.5 + 0.5 * sin((2 * PI * t) / 140 + 1.3 * sin((2 * PI * t) / 53)));
    let a = bit * fade + S.sigma * gauss();
    if (t >= S.c0 && t < S.c1) a += S.ca;
    st.ink[k * 7 + y] = cl((a - 0.3) / 0.45, 0, 1);
  }
  // A static crash: a burst of 1.5 to 5 rows, somewhere in the next turn.
  if (Math.random() < S.crash) {
    S.c0 = S.phi + rho * (1 + Math.random());
    S.c1 = S.c0 + 0.2 + 0.5 * Math.random();
    S.ca = 0.8 + 0.6 * Math.random();
  }
  st.len++;
  S.phi += rho;
  // The strip is cut one blank column after its last glyph, or at the edge.
  if (S.phi >= st.end || st.x0 + st.len >= W - 1) {
    if (++S.pi === PLAN.length) (S.pi = 0), S.cyc++;
    newStrip(S);
  }
}

export function setup(params) {
  params.s = {
    strips: [], made: 0, pi: 0, cyc: 0, phi: PLAN[0][0] - 0.06, rho: 1, acc: 0, scroll: 0, ready: false,
    hue: 0, speed: 2, sigma: 0.2, crash: 0.01, depth: 0.1, c0: -1, c1: -1, ca: 0,
    buf: new Float32Array(W * H * 3),
  };
  newStrip(params.s);
  return params.s;
}

function knobs(S, k) {
  S.hue = k[0] || 0;
  S.speed = cl(k[1] ?? 2, 0.2, 3);
  const n = cl(k[2] || 0, 0, 1), dr = cl(k[3] ?? 0.06, -1, 1);
  S.sigma = 0.19 + 0.37 * n;
  S.crash = 0.006 + 0.06 * n;
  S.depth = 0.12 + 0.45 * n;
  // The receiver's turn against the sender's column: up to 4% slow or fast.
  S.rho = 1 + 0.04 * dr;
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const d = cl(dt || 0, 0, 0.1);
  knobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.ready) {
    // The form opens with five strips already pasted.
    S.ready = true;
    while (S.strips.length < 6) turn(S);
  }
  S.acc += (d * COLS_PER_S * S.speed) / 2;
  while (S.acc >= 1) {
    S.acc -= 1;
    turn(S);
  }
  // When the seventh slot is full the form slides up a slot in 0.45 s and
  // the top strip leaves it.
  const target = max(0, S.strips.length - SLOTS);
  S.scroll = min(target, S.scroll + d * 2.2 * max(1, S.speed / 2));
  while (S.scroll >= 1) {
    S.strips.shift();
    S.scroll -= 1;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const h = S.hue, buf = S.buf;
  const F = hsv(0.58 + h, 0.42, 0.4), R = hsv(0.58 + h, 0.32, 0.52), P = hsv(0.11 + h, 0.1, 0.97), I = hsv(0.66 + h, 0.8, 0.24);
  const HD = hsv(0.12 + h, 0.55, 1);
  // The form, with a ruled line in the middle of each gap.
  const off = S.scroll * SLOT;
  for (let y = 0; y < H; y++) {
    const ry = (((y + off - 17.5) % SLOT) + SLOT) % SLOT;
    const C = ry < 1 ? R : F;
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      buf[p] = C[0];
      buf[p + 1] = C[1];
      buf[p + 2] = C[2];
    }
  }
  const last = S.strips.length - 1;
  S.strips.forEach((st, j) => {
    const Y = Math.round(1 + SLOT * (j - S.scroll));
    if (Y > H || Y + TAPE + 1 < 0) return;
    const x1 = st.x0 + st.len;
    // Shadow under and right of the pasted strip.
    for (let y = Y + 1; y <= Y + TAPE; y++)
      for (let x = st.x0 + 1; x <= x1; x++) {
        if (y < 0 || y >= H || x >= W) continue;
        if (y === Y + TAPE || x === x1) {
          const p = (y * W + x) * 3;
          buf[p] *= 0.55;
          buf[p + 1] *= 0.55;
          buf[p + 2] *= 0.55;
        }
      }
    for (let y = Y; y < Y + TAPE; y++) {
      if (y < 0 || y >= H) continue;
      const pr = Y + 14 - y, row = pr >= 0 && pr < 14 ? pr % 7 : -1;
      for (let x = st.x0; x < x1; x++) {
        const k = x - st.x0, ink = row >= 0 ? st.ink[k * 7 + row] : 0, f = 0.93 + 0.07 * hash(st.id * 64 + k, y - Y);
        const p = (y * W + x) * 3;
        buf[p] = P[0] * f * (1 - ink) + I[0] * ink;
        buf[p + 1] = P[1] * f * (1 - ink) + I[1] * ink;
        buf[p + 2] = P[2] * f * (1 - ink) + I[2] * ink;
      }
    }
    if (j === last) {
      // The print head at the next column: a bar over the tape, and the two
      // points where the helix touches it, one turn's progress up the copy.
      const hx = min(W - 1, x1), ph = floor(S.acc * 7);
      for (let y = Y - 1; y <= Y + TAPE; y++) {
        if (y < 0 || y >= H) continue;
        const p = (y * W + hx) * 3, dot = y === Y + 14 - ph || y === Y + 7 - ph;
        buf[p] = dot ? 1 : HD[0];
        buf[p + 1] = dot ? 1 : HD[1];
        buf[p + 2] = dot ? 1 : HD[2];
      }
    }
  });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, (255 * buf[p]) | 0, (255 * buf[p + 1]) | 0, (255 * buf[p + 2]) | 0);
    }
}
