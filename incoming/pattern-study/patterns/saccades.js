// ===== Patternflow pattern =====
// Title:   Saccades
// Family:  type
// Idea:    A page of Pride and Prejudice set in a drawn 3 x 5 face lies dim on the panel while a simulated reader's gaze fixates, jumps, skips short words, glances back and sweeps down to the next line, each fixation a ring that grows with how long it lasted and the span of sight round it a lit window, so the page ends as a heat map of where the eye has been, with the skipped words as dim holes.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: eye movements in reading, saccades and fixations (Louis Emile Javal, 1879) and the perceptual span (George McConkie and Keith Rayner, 1975), with the text of Pride and Prejudice (Jane Austen, 1813), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1..5, Skipping=0.7..1, Regress=0..0.2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the unread text is dim blue, the span of sight a warm amber white, a forward jump a pale cyan line with a gold ring at its end, a jump back magenta and a sweep to the next line white. A hue that would leave the unread text a dim orange goes to crimson or green instead.
// Knob 2: Speed. The reader's pace, 121 words a minute at 1, 222 at 2, 312 at 3 and 479 at 5, measured over 600 s of panel time. A fixation on a 5 letter word lasts 0.27 s at 2, a jump of 5 characters takes 0.03 s, and both shrink with the pace, the fixation by (2 / K2) ^ 0.9 and the jump by its square root. At 2 a page of 18 lines comes in over 0.9 s, is read in 13 s, held 1.3 s and wiped line by line over 1.4 s, and the next page is read from its first word.
// Knob 3: Skipping. The chance that a word of three letters or fewer, on the line the eye is on, is jumped over when the reader would look at it next: 0.7 at the opening, which passes about 35 % of the short words of the page, 1 for every one that does not start a line. Four letter words are passed half as often when they are function words and a quarter as often when not, nothing longer is skipped, and a reader who skips more also looks for less time, down to 0.7 of it at 1.
// Knob 4: Regress. The chance of a jump back to the word before, after a fixation that was not itself a jump back or a sweep, is 4.4 * K4: 26 % at the opening 0.06 and 88 % at 0.2. Over a page that is 10 jumps back in every 100 jumps at the opening. A jump back lands near the start of the word, is drawn magenta and ends in a longer look, and the reader then goes on from the farthest word it has reached.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, pow, sqrt } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// ---- the face: 3 wide, 5 tall, drawn here ------------------------------
// Capitals only: the page is set in small capitals, five LEDs tall, so every
// letter has the same height and the line is two LEDs from the next. Each
// glyph is five rows of three LEDs; punctuation sits on the baseline, row 4.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  ".": "...|...|...|...|.#.", ",": "...|...|...|.#.|#..", ";": "...|.#.|...|.#.|#..", "?": "##.|..#|.#.|...|.#.",
};
// A glyph as 15 flags, row by row.
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// ---- the text: the opening of Pride and Prejudice (1813) ---------------
const TEXT = [
  "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
  "However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.",
  "My dear Mr. Bennet, said his lady to him one day, have you heard that Netherfield Park is let at last?",
  "Mr. Bennet replied that he had not.",
  "But it is, returned she; for Mrs. Long has just been here, and she told me all about it.",
  "Mr. Bennet made no answer.",
  "Do you not want to know who has taken it? cried his wife impatiently.",
  "You want to tell me, and I have no objection to hearing it.",
  "This was invitation enough.",
];
// Words that pass quickly: the reader looks at them for less time and, when
// they are short, often not at all.
const FUNC = new Set("the of and a to in is that it was he for on as with his at be this have or by had not but all were we there can an which their if do will about out them so her no my you me are from who has what one been".split(" "));

const COLS = 16, NL = 18, LP = 7, Y0 = 1, CW = 4;

// The page the reader gets is the next NL lines of the text set 16 characters
// wide, read round and round.
function setLines() {
  const lines = [];
  for (const para of TEXT) {
    let cur = "";
    for (const w of para.split(" ")) {
      if (cur && cur.length + 1 + w.length > COLS) (lines.push(cur), (cur = w));
      else cur = cur ? cur + " " + w : w;
    }
    lines.push(cur);
  }
  return lines.map((l) => l.toUpperCase());
}

// The words of a page: where each stands, its letters, whether it is a
// function word, and a fixation time before the pace is applied: 0.15 s and
// 12.5 ms a letter up to ten, 20 ms less for a function word, 30 ms more for
// a long word, which is a rare one.
function newPage(S) {
  const stream = S.stream, lines = [], words = [], wid = new Int16Array(NL * COLS).fill(-1);
  for (let i = 0; i < NL; i++) lines.push(stream[(S.pageNo * NL + i) % stream.length]);
  lines.forEach((s, l) => {
    const re = /[^ ]+/g;
    let m;
    while ((m = re.exec(s))) {
      const text = m[0], nl = text.replace(/[^a-zA-Z]/g, "").length, low = text.toLowerCase().replace(/[^a-z]/g, "");
      const func = FUNC.has(low);
      const base = 0.21 + 0.0125 * min(nl, 10) - (func ? 0.025 : 0) + (nl >= 8 && !func ? 0.035 : 0);
      for (let c = m.index; c < m.index + text.length; c++) wid[l * COLS + c] = words.length;
      words.push({ line: l, c0: m.index, len: text.length, nl, func, base });
    }
  });
  S.lines = lines;
  S.words = words;
  S.wid = wid;
  S.heat = new Float32Array(words.length);
  S.fixed = new Uint8Array(words.length);
  S.cur = -1;
  S.front = -1;
  S.kind = "fwd";
  S.corTo = -1;
  S.mode = "none";
  S.la = new Float32Array(NL);
}

export function setup(params) {
  params.s = {
    stream: setLines(), pageNo: 0, phase: "in", pt: 0, t: 0, clock: 0, mode: "none", fix: null, sac: null, fixId: 0,
    rings: [], segs: [], glow: 1, hue: 0, sp: 1, pskip: 0.7, preg: 0.2, palHue: -1,
    pal: new Float32Array(30), buf: new Uint8Array(W * H * 3),
  };
  newPage(params.s);
}

// Fixation, hue and pace all come from the knobs; palette slots (3 floats
// each): 0 unread text, 1 span of sight, 2 forward ring, 3 forward line,
// 4 jump back, 5 sweep.
function palette(S) {
  const t = S.pal, h = S.hue;
  // A dim orange or yellow reads as brown on the panel, so the unread text
  // goes to crimson where its hue would land in red to yellow, and to green in
  // yellow to green.
  let hb = h + 0.58;
  hb -= floor(hb);
  hsv(hb < 0.17 ? 0.94 + hb * 0.3 : hb < 0.33 ? 0.33 : hb, 0.62, 1, t, 0);
  hsv(h + 0.12, 0.3, 1, t, 3);
  hsv(h + 0.11, 0.85, 1, t, 6);
  hsv(h + 0.5, 0.2, 1, t, 9);
  hsv(h + 0.88, 0.75, 1, t, 12);
  hsv(h + 0.12, 0.08, 1, t, 15);
  S.palHue = h;
}

function wordRand(a, b) {
  let h = Math.imul(a + 7, 73856093) ^ Math.imul(b + 3, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 1023) / 1024;
}

const pvl = (w) => w.c0 + (w.len - 1) / 2 - 0.4;

// A fixation starts: the heat map takes the word under the eye and every word
// the span of sight covers, a ring and the glow begin.
function land(S, wi, col, kind, D) {
  const w = S.words[wi];
  S.cur = wi;
  S.kind = kind;
  S.mode = "fix";
  S.clock = 0;
  S.fix = { w: wi, col, line: w.line, D, t0: S.t, kind };
  S.fixId++;
  S.fixed[wi] = 1;
  S.heat[wi] = 1;
  S.words.forEach((o, i) => {
    if (i === wi || o.line !== w.line) return;
    if (o.c0 + o.len > col - 4 && o.c0 < col + 15) S.heat[i] = max(S.heat[i], 0.28);
  });
  if (wi > S.front) S.front = wi;
  S.rings.push({ x: CW * col + 1, y: Y0 + LP * w.line + 2, R: 1.6 + 20 * max(0, w.base - 0.21), t0: S.t, D, kind });
  if (S.rings.length > 14) S.rings.shift();
}

// The reader's next move: back one or two words, on to the next word, or over
// a short one; a word on another line is a sweep that falls short of the
// line's start and is put right by a small jump. Eight draws, whatever is
// decided, so the same seed reads the same.
function leave(S) {
  const w = S.words, n = w.length, cur = w[S.cur];
  const u = [0, 1, 2, 3, 4, 5, 6, 7].map(() => Math.random());
  const from = S.fix.col;
  let t, kind = "fwd";
  if (S.corTo >= 0) {
    t = S.cur;
    S.corTo = -1;
    return go(S, t, pvl(w[t]), "cor", from, u);
  }
  if (S.front >= n - 1) {
    S.phase = "hold";
    S.pt = 0;
    S.mode = "none";
    return;
  }
  if (u[0] < S.preg && S.cur > 0 && S.kind !== "reg" && S.kind !== "ret" && w[S.cur - 1].line === cur.line) {
    t = S.cur - 1 - (u[1] < 0.3 && S.cur > 1 && w[S.cur - 2].line === cur.line ? 1 : 0);
    kind = "reg";
  } else {
    t = S.front + 1;
    const p = (x) => (x.nl <= 3 ? S.pskip : x.nl === 4 ? S.pskip * (x.func ? 0.5 : 0.25) : 0);
    // Only a word on the line the eye is on can be passed over.
    const here = (i) => w[i].line === cur.line;
    // Whether a word is passed over is fixed by the page and the word, not
    // drawn afresh at each look, so a higher Skipping only ever adds words.
    if (t < n - 1 && here(t) && wordRand(S.pageNo, t) < p(w[t])) {
      t++;
      if (t < n - 1 && here(t) && w[t].nl <= 3 && wordRand(S.pageNo, t + 500) < S.pskip * 0.4) t++;
    }
    if (w[t].line !== w[S.cur].line) kind = "ret";
  }
  const tw = w[t];
  let col = pvl(tw) + (u[4] + u[5] - 1) * 1.8;
  if (kind === "reg") col -= 0.8;
  if (kind === "ret") {
    // The sweep falls short: it lands a couple of characters right of the
    // word's middle, and a small jump brings the eye back.
    col = pvl(tw) + 2.4 + (u[4] - 0.5) * 1.2;
    if (col - pvl(tw) > 1.4 && u[7] < 0.4) S.corTo = t;
  }
  col = cl(col, tw.c0 - 0.5, tw.c0 + tw.len - 0.5);
  go(S, t, col, kind, from, u);
}

// Starts the jump to word t and the fixation it ends in.
function go(S, t, col, kind, from, u) {
  const sp = S.sp, w = S.words[t], l0 = S.fix.line;
  const T = (0.018 + 0.0022 * (abs(col - from) + abs(w.line - l0) * 10)) * pow(sp, 0.5);
  let D = w.base + (u[6] - 0.5) * 0.08 + (kind === "reg" ? 0.03 : 0);
  if (S.corTo >= 0 && kind === "ret") D = 0.1;
  if (kind === "cor") D = max(0.1, w.base * 0.8);
  // A reader who skips more is skimming, and looks for less time.
  D *= pow(sp, 0.9) * (1 - 0.3 * (S.pskip - 0.7) / 0.3);
  S.mode = "sac";
  S.clock = 0;
  S.sac = { t, col, kind, D, T, x0: from, l0, l1: w.line };
  S.segs.push({ x0: CW * from + 1, y0: Y0 + LP * l0 + 2, x1: CW * col + 1, y1: Y0 + LP * w.line + 2, t0: S.t, T, kind });
  if (S.segs.length > 8) S.segs.shift();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  const speed = cl(k[1], 1, 5);
  S.sp = 2 / speed;
  S.pskip = cl(k[2], 0.7, 1);
  S.preg = 4.4 * cl(k[3], 0, 0.2);
  S.t += d;
  S.pt += d;
  const q = pow(S.sp, 0.5);
  // The page comes in a line at a time, and the reader starts on it before
  // the last line is there.
  if (S.phase === "in" || (S.phase === "read" && S.pt < 1.5 * q)) for (let l = 0; l < NL; l++) S.la[l] = cl((S.pt - 0.04 * l * q) / (0.25 * q), 0, 1);
  if (S.phase === "in") {
    if (S.pt >= 0.55 * q) {
      S.phase = "read";
      S.glow = 1;
      const w = S.words[0];
      S.fix = { col: pvl(w), line: 0 };
      land(S, 0, pvl(w), "fwd", w.base * pow(S.sp, 0.9));
      S.corTo = -1;
    }
  } else if (S.phase === "read") {
    let rem = d;
    for (let guard = 0; rem > 0 && S.phase === "read" && guard < 8; guard++) {
      if (S.mode === "fix") {
        const left = S.fix.D - S.clock;
        if (rem < left) (S.clock += rem, (rem = 0));
        else (rem -= left, (S.clock = S.fix.D), leave(S));
      } else {
        const left = S.sac.T - S.clock;
        if (rem < left) (S.clock += rem, (rem = 0));
        else {
          rem -= left;
          const s = S.sac;
          land(S, s.t, s.col, s.kind, s.D);
        }
      }
    }
  } else if (S.phase === "hold") {
    S.glow = exp(-S.pt / (0.35 * q));
    if (S.pt >= 1.3 * q) (S.phase = "out", (S.pt = 0));
  } else {
    for (let l = 0; l < NL; l++) S.la[l] = 1 - cl((S.pt - 0.07 * l * q) / (0.25 * q), 0, 1);
    if (S.pt >= (0.07 * (NL - 1) + 0.25 + 0.3) * q) {
      S.pageNo++;
      S.phase = "in";
      S.pt = 0;
      S.rings.length = 0;
      S.segs.length = 0;
      newPage(S);
    }
  }
  // The heat map fades slowly.
  const f = exp(-d / 40);
  for (let i = 0; i < S.heat.length; i++) S.heat[i] *= f;
}

function circle(put, cx, cy, r, c, a) {
  // Midpoint circle, one LED wide.
  let x = round(r), y = 0, err = 1 - x;
  cx = round(cx);
  cy = round(cy);
  while (x >= y) {
    for (const [px, py] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) put(cx + px, cy + py, c, a);
    y++;
    if (err < 0) err += 2 * y + 1;
    else (x--, (err += 2 * (y - x) + 1));
  }
}

function line(put, x0, y0, x1, y1, c, a) {
  x0 = round(x0);
  y0 = round(y0);
  x1 = round(x1);
  y1 = round(y1);
  const dx = abs(x1 - x0), dy = abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx - dy;
  for (let n = 0; n < 300; n++) {
    put(x0, y0, c, a);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -dy) (e -= dy, (x0 += sx));
    if (e2 < dx) (e += dx, (y0 += sy));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const buf = S.buf, pal = S.pal, q = pow(S.sp, 0.5);
  buf.fill(0);
  // A pixel takes the brighter of what is there and the new colour.
  const lit = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
  };
  // Where the eye is, in characters and lines, while it is fixed and while it
  // jumps.
  let gx = 0, gl = 0;
  if (S.mode === "fix") (gx = S.fix.col, (gl = S.fix.line));
  else if (S.mode === "sac") {
    const e = ease(S.clock / S.sac.T);
    gx = S.sac.x0 + (S.sac.col - S.sac.x0) * e;
    gl = S.sac.l0 + (S.sac.l1 - S.sac.l0) * e;
  } else if (S.fix) (gx = S.fix.col, (gl = S.fix.line));
  const glow = S.mode === "sac" ? S.glow * 0.7 : S.glow;
  const span = (dx) => (dx >= 0 ? (dx < 15 ? (1 - dx / 15) ** 2 : 0) : dx > -4 ? (1 + dx / 4) ** 2 : 0);
  // The span of sight as a soft lit window behind the line the eye is on.
  const gy = Y0 + LP * gl + 2;
  if (glow > 0.01 && S.phase !== "out")
    for (let y = max(0, round(gy - 5)); y <= min(H - 1, round(gy + 5)); y++) {
      const vp = max(0, 1 - abs(y - gy) / 5.5) ** 1.5;
      for (let x = 0; x < W; x++) {
        const w = span((x - 1) / CW - gx) * vp * glow * 0.2;
        if (w > 0.01) lit(x, y, pal[3] * w, pal[4] * w, pal[5] * w);
      }
    }
  // The text.
  for (let l = 0; l < NL; l++) {
    const la = S.la[l], s = S.lines[l];
    if (la <= 0.001) continue;
    const dl = abs(l - gl), vb = dl < 1 ? (1 - dl) ** 1.2 : dl < 2 ? 0.14 * (2 - dl) : 0;
    const y = Y0 + LP * l;
    for (let c = 0; c < s.length; c++) {
      const g = GLYPH[s[c]];
      if (!g) continue;
      const wi = S.wid[l * COLS + c], heat = wi >= 0 ? S.heat[wi] : 0;
      const w = span(c - gx) * vb * glow, lvl = 0.15 + 0.4 * heat;
      const val = (lvl + (1 - lvl) * w * 0.95) * la, m = min(1, w * 1.2);
      const r = (pal[0] * (1 - m) + pal[3] * m) * val, gg = (pal[1] * (1 - m) + pal[4] * m) * val, b = (pal[2] * (1 - m) + pal[5] * m) * val;
      for (let i = 0; i < 15; i++) if (g[i]) lit(c * CW + (i % 3), y + floor(i / 3), r, gg, b);
    }
  }
  // The scanpath: each jump a line that fades, each fixation a ring that
  // grows as long as it lasts and then fades.
  const fade = 1.7 * q, kcol = { fwd: 9, reg: 12, ret: 15, cor: 9 }, rcol = { fwd: 6, reg: 12, ret: 6, cor: 6 };
  for (const s of S.segs) {
    const end = s.t0 + s.T, a = S.t < end ? 1 : exp(-(S.t - end) / (0.55 * q));
    if (a < 0.04) continue;
    const e = S.t < end ? ease((S.t - s.t0) / s.T) : 1, c = kcol[s.kind];
    line((x, y, cc, aa) => lit(x, y, pal[cc] * aa, pal[cc + 1] * aa, pal[cc + 2] * aa), s.x0, s.y0, s.x0 + (s.x1 - s.x0) * e, s.y0 + (s.y1 - s.y0) * e, c, a * 0.85);
  }
  for (const r of S.rings) {
    const end = r.t0 + r.D, a = S.t < end ? 1 : exp(-(S.t - end) / fade);
    if (a < 0.05) continue;
    const rad = r.R * ease((S.t - r.t0) / r.D), c = rcol[r.kind];
    circle((x, y, cc, aa) => lit(x, y, pal[cc] * aa, pal[cc + 1] * aa, pal[cc + 2] * aa), r.x, r.y, max(0.6, rad), c, a * 0.9);
  }
  if (S.mode === "fix" && S.phase === "read") lit(round(CW * S.fix.col + 1), round(Y0 + LP * S.fix.line + 2), 255, 255, 255);
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
