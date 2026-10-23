// ===== Patternflow pattern =====
// Title:   Typewriter
// Family:  type
// Idea:    A manual typewriter types two old poems letter by letter in a 3 by 5 pixel face, each typebar flicking up through the ribbon, while the sheet slides one letter left at every stroke, rings at the line's end and rides back with the carriage to feed up a line.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the portable typewriters of the 1950s, typing Emily Dickinson and Christina Rossetti
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Paper=0..1, Speed=0.2..3, Spacing=1..2, Ribbon=0..1
//
// Knob 1: Paper. The sheet and its ink: white bond with black at 0, then cream with brown, a canary carbon copy in blue and a pink copy in violet.
// Knob 2: Speed. Strokes a second: at 2 a brisk four and a half, at 0.2 one every two seconds, at 3 nearly seven.
// Knob 3: Spacing. The line feed, from single spacing at 1 (7 rows a line) to double at 2 (14 rows).
// Knob 4: Ribbon. At 0 a fresh ribbon, black with the titles on its red half; turned up it wears to a faint grey that drops pixels, and the typist moves to the red half for more and more words.

const W = 64;
const H = 128;
const N = W * H;
// The sheet: 96 LEDs wide (16 letters of 4 LEDs between margins of 16) and
// 320 long. The printing point is column 32; the line being typed has its
// foot on row 83.
const PW = 96;
const PH = 320;
const MARGIN = 16;
const COLS = 16;
const PX = 31;
const BASE = 83;
const TOP = 18;
// Where the paper goes under the card guide, and the machine below it.
const PAPER_END = 88;
// The basket of 15 typebars, fanned below the printing point.
const BX = 32;
const BY = 88;
const BARS = 15;
// The 3 by 5 face, rows top to bottom, one bit per column.
const GLYPHS = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", ".": "000000000000010", ",": "000000000010100",
  "-": "000000111000000", "!": "010010010000010", "?": "110001010000010", "'": "010010000000000",
  ":": "000010000010000", ";": "000010000010100",
};
// Emily Dickinson's "Hope" is the thing with feathers (1891) and Christina
// Rossetti's Who has seen the wind? (1872), and between them the line typists
// learned on. Words in stars go on the ribbon's red half.
const POEMS = [
  "*HOPE*",
  "",
  "HOPE IS THE THING WITH FEATHERS -",
  "THAT PERCHES IN THE SOUL -",
  "AND SINGS THE TUNE WITHOUT THE WORDS -",
  "AND NEVER STOPS - AT ALL -",
  "",
  "AND SWEETEST - IN THE GALE - IS HEARD -",
  "AND SORE MUST BE THE STORM -",
  "THAT COULD ABASH THE LITTLE BIRD",
  "THAT KEPT SO MANY WARM -",
  "",
  "*E. DICKINSON*",
  "",
  "",
  "NOW IS THE TIME FOR ALL GOOD MEN TO COME TO THE AID OF THE PARTY.",
  "",
  "",
  "*WHO HAS SEEN THE WIND?*",
  "",
  "WHO HAS SEEN THE WIND?",
  "NEITHER I NOR YOU:",
  "BUT WHEN THE LEAVES HANG TREMBLING,",
  "THE WIND IS PASSING THROUGH.",
  "",
  "WHO HAS SEEN THE WIND?",
  "NEITHER YOU NOR I:",
  "BUT WHEN THE TREES BOW DOWN THEIR HEADS,",
  "THE WIND IS PASSING BY.",
  "",
  "*C. ROSSETTI*",
  "",
  "",
];
// Paper and ink sets for the Paper knob: paper, ink, red ink.
const SETS = [
  [[236, 236, 228], [20, 20, 26], [196, 26, 30]],
  [[238, 222, 184], [70, 38, 20], [184, 40, 26]],
  [[246, 230, 120], [30, 44, 150], [190, 30, 40]],
  [[244, 196, 204], [76, 30, 120], [176, 20, 46]],
];
const ENAMEL = [92, 150, 132];
const CHROME = [178, 184, 188];
const KEYROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM,."];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The poems broken at 16 letters; a broken line goes on indented by two. A
// line with a starred word is typed in red throughout.
function wrap() {
  const out = [];
  for (const line of POEMS) {
    const red = line.includes("*");
    let row = [];
    let len = 0;
    for (const word of line.replace(/\*/g, "").split(" ")) {
      if (!word) continue;
      if (len && len + 1 + word.length > COLS) {
        out.push(row);
        row = [{ ch: " " }, { ch: " " }];
        len = 2;
      } else if (len) {
        row.push({ ch: " " });
        len++;
      }
      for (const ch of word) row.push({ ch, red });
      len += word.length;
    }
    out.push(row);
  }
  return out;
}

// Key and typebar for each letter.
function keyOf(ch) {
  for (let r = 0; r < 3; r++) {
    const i = KEYROWS[r].indexOf(ch);
    if (i >= 0) return { r, i, bar: clamp(Math.round(i * 1.45 + r * 0.6), 0, BARS - 1) };
  }
  return { r: 0, i: 9, bar: 14 };
}

function lamp(x, y) {
  return 0.8 + 0.3 * Math.exp(-((x - 6) ** 2 + (y - 10) ** 2) / (2 * 40 * 40));
}

export function setup(params) {
  const P = params;
  P.lines = wrap();
  P.started = false;
  P.ink = new Uint8Array(PW * PH);
  P.inkRed = new Uint8Array(PW * PH);
  P.grain = new Uint8Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) P.grain[i] = Math.floor(Math.random() * 256);
  P.frame = new Float32Array(N * 3);
  P.machine = null;
}

function newSheet(P) {
  P.ink.fill(0);
  P.inkRed.fill(0);
  P.row = 0;
}

// One letter struck at the current column: the strike strength varies from
// letter to letter, and its pixels from one to the next.
function stamp(P, cell, red) {
  const g = GLYPHS[cell.ch];
  if (!g) return;
  const x0 = MARGIN + P.col * 4;
  const y0 = TOP + P.row * P.ls;
  const strike = 0.62 + 0.38 * Math.random();
  const word = red ? 255 : P.wordRand;
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 3; i++) {
      if (g[j * 3 + i] !== "1") continue;
      const p = (y0 + j) * PW + x0 + i;
      if (p < 0 || p >= PW * PH) continue;
      P.ink[p] = Math.round(255 * clamp(strike * (0.8 + 0.2 * Math.random()) + (j === 0 ? -0.06 : 0), 0, 1));
      P.inkRed[p] = word;
    }
}

function linesPerPage(P) {
  return Math.floor((PH - TOP - 24) / P.ls);
}

// The carriage moves on one letter; five letters before the right margin
// the bell rings.
function advance(P) {
  P.col++;
  if (P.col === COLS - 5) P.bell = 1;
}

// The typist, as a little machine of its own: type the line, ring, return.
function step(P, dt) {
  P.timer -= dt;
  if (P.strike) {
    P.strike.t += dt;
    // The letter lands when the typebar reaches the paper, and the carriage
    // escapes one letter as the bar falls back.
    if (P.strike.cell && P.strike.t >= 0.05) {
      stamp(P, P.strike.cell, P.strike.red);
      P.strike.cell = null;
      advance(P);
    }
    if (P.strike.t > 0.16) P.strike = null;
  }
  P.bell = Math.max(0, P.bell - dt * 1.6);
  P.dip = Math.max(0, P.dip - dt * 8);
  // The carriage and the paper follow where the typist put them.
  const want = PX - MARGIN - P.col * 4;
  const rate = P.phase === "type" ? 120 : 220;
  if (P.carX < want) P.carX = Math.min(want, P.carX + rate * dt);
  else if (P.carX > want) P.carX = Math.max(want, P.carX - rate * dt);
  const scroll = TOP + P.row * P.ls + 4 - BASE + P.extra;
  P.scroll += clamp(scroll - P.scroll, -90 * dt, 90 * dt);
  if (P.timer > 0 || (P.strike && P.strike.cell)) return;
  const line = P.lines[P.line % P.lines.length];
  if (P.phase === "type") {
    if (P.col >= line.length) {
      P.phase = "return";
      P.timer = 0.12 + 0.15 / P.speed;
      return;
    }
    const cell = line[P.col];
    P.dip = 1;
    if (cell.ch === " ") {
      P.wordRand = Math.floor(Math.random() * 255);
      P.key = { r: 3, i: 0 };
      advance(P);
    } else {
      const k = keyOf(cell.ch);
      P.key = k;
      P.strike = { bar: k.bar, t: 0, red: cell.red || P.wordRand < 255 * P.redShare, cell };
    }
    const pause = cell.ch === " " ? 0.08 : /[,.:;-]/.test(cell.ch) ? 0.12 : 0;
    P.timer = (0.22 * (0.7 + 0.6 * Math.random())) / P.speed + pause;
  } else if (P.phase === "return") {
    // Carriage return: the paper rides back right and the platen feeds a line.
    P.col = 0;
    P.line++;
    P.row++;
    P.phase = "type";
    P.timer = 0.25 + 0.2 / P.speed;
    P.wordRand = Math.floor(Math.random() * 255);
    if (P.row >= linesPerPage(P)) {
      // The sheet is full: pulled out over the top, and a fresh one wound in.
      P.phase = "page";
      P.timer = 1.8;
      P.extra = 150;
    }
  } else if (P.phase === "page") {
    newSheet(P);
    P.extra = 0;
    P.scroll = TOP + 4 - BASE - 70;
    P.phase = "type";
    P.timer = 1;
  }
}

// The still parts of the machine below the paper, drawn once.
function buildMachine(P) {
  const M = new Float32Array(N * 3);
  const put = (x, y, c) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = (y * W + x) * 3;
    M[p] = c[0];
    M[p + 1] = c[1];
    M[p + 2] = c[2];
  };
  // The desk lamp at the upper left, and the wall behind the machine, warm
  // where the lamp falls on it.
  P.lamp = new Float32Array(N);
  for (let p = 0; p < N; p++) P.lamp[p] = lamp(p % W, Math.floor(p / W));
  for (let y = 0; y <= PAPER_END; y++) for (let x = 0; x < W; x++) put(x, y, [22, 17, 14].map((v) => v * P.lamp[y * W + x]));
  for (let y = PAPER_END + 1; y < H; y++)
    for (let x = 0; x < W; x++) {
      // The enamel body, lit from the lamp at the upper left, its front
      // falling away into shade.
      const l = lamp(x, y) * (1 - 0.35 * ((y - 90) / 38));
      put(x, y, ENAMEL.map((v) => v * l));
    }
  // The carriage rail and the opening of the type basket.
  for (let x = 0; x < W; x++) put(x, PAPER_END + 1, CHROME.map((v) => v * lamp(x, 89)));
  for (let y = PAPER_END + 2; y < 110; y++)
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - BX, y - BY);
      if (r < 21.5 && y > BY) put(x, y, [14, 15, 16]);
      if (r >= 21.5 && r < 22.6 && y > BY) put(x, y, CHROME.map((v) => v * 0.8));
    }
  // Keys: three staggered rows of round caps with chrome rims, and a space bar.
  P.keys = [];
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < KEYROWS[r].length; i++) {
      const kx = 3 + r * 2 + i * 6;
      const ky = 111 + r * 5;
      P.keys.push([r, i, kx, ky]);
    }
  for (let x = 18; x < 47; x++) {
    put(x, 126, CHROME.map((v) => v * 0.85));
    put(x, 127, [30, 30, 32]);
  }
  P.machine = M;
}

function drawKey(F, kx, ky, down) {
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      if ((i === 0 || i === 3) && (j === 0 || j === 3)) continue;
      const rim = i === 0 || i === 3 || j === 0 || j === 3;
      const c = rim ? (down ? [110, 114, 118] : [196, 200, 204]) : down ? [8, 8, 9] : [26, 26, 28];
      const y = ky + j + (down ? 1 : 0);
      const p = (y * W + kx + i) * 3;
      if (y < H) {
        F[p] = c[0];
        F[p + 1] = c[1];
        F[p + 2] = c[2];
      }
    }
}

function line(F, x0, y0, x1, y1, c) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / n);
    const y = Math.round(y0 + ((y1 - y0) * s) / n);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const p = (y * W + x) * 3;
    F[p] = c[0];
    F[p + 1] = c[1];
    F[p + 2] = c[2];
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.paper = clamp(k[0], 0, 1);
  P.speed = clamp(k[1], 0.05, 3) / 2;
  P.wear = clamp(k[3], 0, 1);
  P.redShare = 0.45 * P.wear * P.wear;
  const ls = Math.round(7 * clamp(k[2], 1, 2));
  if (!P.started) {
    P.started = true;
    P.ls = ls;
    newSheet(P);
    // The page is half typed when the panel opens: the first lines are already
    // on it, and the typist has been at the next for three seconds.
    const half = Math.floor(linesPerPage(P) / 2);
    P.line = 0;
    for (; P.row < half; P.row++, P.line++) {
      const row = P.lines[P.line % P.lines.length];
      for (P.col = 0; P.col < row.length; P.col++) {
        if (row[P.col].ch === " " || !P.col) P.wordRand = Math.floor(Math.random() * 255);
        stamp(P, row[P.col], row[P.col].red);
      }
    }
    P.col = 0;
    Object.assign(P, { phase: "type", timer: 0, strike: null, bell: 0, dip: 0, key: null, extra: 0, wordRand: 0 });
    P.carX = PX - MARGIN;
    P.scroll = TOP + P.row * P.ls + 4 - BASE;
    for (let i = 0; i < 90; i++) step(P, 1 / 30);
  }
  P.ls = ls;
  step(P, dt);
}

export function draw(display, params) {
  const P = params;
  if (!P.started) return;
  if (!P.machine) buildMachine(P);
  const F = P.frame;
  F.set(P.machine);
  // Paper and ink for the Paper knob, between its four sets.
  const u = P.paper * 3;
  const i0 = Math.min(2, Math.floor(u));
  const [paper, ink, red] = [0, 1, 2].map((j) => mix(SETS[i0][j], SETS[i0 + 1][j], u - i0));
  const cx = Math.round(P.carX);
  const sc = Math.round(P.scroll);
  const wear = P.wear;
  const fade = 1 - 0.5 * wear;
  // The platen, rubber black, with a knob at either end, all riding with the paper.
  for (let y = 75; y <= PAPER_END; y++)
    for (let x = 0; x < W; x++) {
      const px = x - cx;
      const p = (y * W + x) * 3;
      const t = (y - 75) / 13;
      const shade = 0.5 + 0.9 * Math.exp(-((t - 0.3) ** 2) / 0.03);
      if (px >= -6 && px < PW + 6) {
        F[p] = 26 * shade;
        F[p + 1] = 26 * shade;
        F[p + 2] = 30 * shade;
      } else if ((px >= -12 && px < -6) || (px >= PW + 6 && px < PW + 12)) {
        const ridge = (px & 1) === 0 ? 1 : 0.7;
        F[p] = 118 * shade * ridge;
        F[p + 1] = 110 * shade * ridge;
        F[p + 2] = 100 * shade * ridge;
      }
    }
  // The carriage return lever, chrome, standing up from the left knob.
  line(F, cx - 10, 74, cx - 18, 64, CHROME);
  line(F, cx - 18, 64, cx - 24, 63, CHROME);
  // The sheet.
  const top = Math.max(0, -sc);
  for (let y = top; y <= PAPER_END; y++) {
    const py = y + sc;
    if (py >= PH) break;
    for (let x = 0; x < W; x++) {
      const px = x - cx;
      if (px < 0 || px >= PW) continue;
      const p = (y * W + x) * 3;
      // The sheet bends away round the platen in its last rows.
      const l = P.lamp[y * W + x] * (y > 84 ? 1 - 0.09 * (y - 84) : 1);
      let r = paper[0] * l;
      let g = paper[1] * l;
      let b = paper[2] * l;
      const q = py * PW + px;
      const s = P.ink[q];
      if (s) {
        const gr = P.grain[q] / 255;
        const a = clamp((s / 255) * fade - wear * 0.35 * (1 - gr), 0, 1);
        const c = P.inkRed[q] === 255 || P.inkRed[q] < 255 * P.redShare ? red : ink;
        r += (c[0] * l - r) * a;
        g += (c[1] * l - g) * a;
        b += (c[2] * l - b) * a;
      }
      F[p] = r;
      F[p + 1] = g;
      F[p + 2] = b;
    }
  }
  // The ribbon, black over red, from spool to spool past the printing point,
  // lifted over the line while a typebar strikes.
  const st = P.strike;
  const lift = st ? clamp(st.t < 0.05 ? st.t / 0.05 : 1 - (st.t - 0.08) / 0.08, 0, 1) : 0;
  const rib = [mix([16, 16, 18], [74, 72, 76], wear), mix([164, 24, 28], [124, 64, 62], wear)];
  for (let x = 12; x < 53; x++) {
    const dx = Math.abs(x - 32);
    const y = dx < 6 ? 84 : 84 + Math.round((dx - 6) * 0.28);
    for (let j = 0; j < 2; j++) {
      const p = ((y + j) * W + x) * 3;
      const c = rib[j];
      F[p] = c[0];
      F[p + 1] = c[1];
      F[p + 2] = c[2];
    }
  }
  if (lift > 0.3) {
    const y0 = 84 - Math.round(lift * 5);
    for (let y = y0; y < y0 + 5; y++)
      for (let x = 29; x < 36; x++) {
        const p = (y * W + x) * 3;
        const c = rib[st.red ? 1 : 0];
        F[p] = c[0];
        F[p + 1] = c[1];
        F[p + 2] = c[2];
      }
  }
  // The card guide round the printing point.
  for (let x = 25; x < 40; x++) {
    if (x === 31 || x === 33 || x === 32) continue;
    const p = (86 * W + x) * 3;
    F[p] = CHROME[0];
    F[p + 1] = CHROME[1];
    F[p + 2] = CHROME[2];
  }
  // Ribbon spools, their hubs turning a little at every stroke.
  for (const [sx, dir] of [
    [6, 1],
    [58, -1],
  ])
    for (let y = 89; y < 101; y++)
      for (let x = sx - 6; x <= sx + 6; x++) {
        const r = Math.hypot(x - sx, y - 95);
        if (r > 5.6 || x < 0 || x >= W) continue;
        const p = (y * W + x) * 3;
        const a = Math.atan2(y - 95, x - sx) * dir + (P.line * COLS + P.col) * 0.15;
        let c;
        if (r < 1.6) c = CHROME;
        else if (r < 3.2) c = Math.cos(a * 3) > 0.4 ? CHROME.map((v) => v * 0.8) : [20, 20, 22];
        else c = y < 95 ? rib[0].map((v) => v + 20) : rib[1];
        F[p] = c[0];
        F[p + 1] = c[1];
        F[p + 2] = c[2];
      }
  // The typebars, fanned in the basket; the one striking swings up to the paper.
  for (let b = 0; b < BARS; b++) {
    const a = Math.PI * (0.1 + (0.8 * b) / (BARS - 1));
    const ox = BX + 20 * Math.cos(a);
    const oy = BY + 20 * Math.sin(a);
    let tx = BX + 6 * Math.cos(a);
    let ty = BY + 6 * Math.sin(a);
    if (st && st.bar === b) {
      const s = clamp(st.t < 0.05 ? st.t / 0.05 : 1 - (st.t - 0.05) / 0.09, 0, 1);
      tx += (32 - tx) * s;
      ty += (82 - ty) * s;
    }
    line(F, ox, oy, tx, ty, st && st.bar === b ? [230, 232, 236] : [120, 124, 128]);
  }
  // The keys, the struck one pressed down.
  for (const [r, i, kx, ky] of P.keys) drawKey(F, kx, ky, P.dip > 0.2 && P.key && P.key.r === r && P.key.i === i);
  if (P.dip > 0.2 && P.key && P.key.r === 3) for (let x = 18; x < 47; x++) for (let j = 126; j < 128; j++) F[(j * W + x) * 3] *= 0.6;
  // The bell, a brass dome under the right spool, flashing as it rings and
  // throwing its flash on the enamel round it.
  const bell = P.bell * P.bell;
  for (let y = 99; y < 110; y++)
    for (let x = 51; x < W; x++) {
      const dx = x - 58;
      const dy = y - 105;
      const p = (y * W + x) * 3;
      const dome = dy >= -1 && dy <= 1 && Math.abs(dx) <= (dy === -1 ? 1 : dy === 0 ? 2 : 3);
      if (dome) {
        const c = mix(dy === -1 ? [210, 170, 70] : [160, 116, 40], [255, 244, 190], bell);
        F[p] = c[0];
        F[p + 1] = c[1];
        F[p + 2] = c[2];
      } else if (bell > 0.01) {
        const g = bell * Math.exp(-(dx * dx + dy * dy) / 8);
        F[p] += (255 - F[p]) * g * 0.8;
        F[p + 1] += (230 - F[p + 1]) * g * 0.8;
        F[p + 2] += (140 - F[p + 2]) * g * 0.8;
      }
    }
  for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, F[p], F[p + 1], F[p + 2]);
}
