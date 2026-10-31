// ===== Patternflow pattern =====
// Title:   Baudot Tape
// Family:  type
// Idea:    Five-hole teleprinter tape runs up the whole height of the panel, each character arriving down the line as five pulses that set the punch at the bottom, punched as one row of holes with the small feed hole between the third and the fourth, and typed beside its row as it is punched, so the message reads down the panel next to its own code and passes under the reader at the top; line noise flips a pulse now and then, and when the pulse it flips belongs to a shift code the rest of the line comes out in the wrong shift, 1234567890 as QWERTYUIOP.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the five-unit code of Emile Baudot (1870s), rearranged by Donald Murray for a keyboard and punched tape (1901), in the letters and figures of International Telegraph Alphabet No. 2; 5 by 7 capitals and 3 by 5 tags drawn for this pattern, pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Message=0..2, Noise=0..1
//
// Knob 1: Hue. Turns the paper, the ink and the marks round the wheel together. At 0 the tape is cream, the typed characters pale azure, the line hits pink and the punch's selectors gold; at 0.25 the tape is pale green and the ink violet, at 0.5 pale blue tape with peach ink, at 0.75 lilac tape with green ink.
// Knob 2: Speed. Characters a second, 1.5 times the knob: 3 at 2, so a row takes 0.33 s and the tape climbs 24 LEDs a second; 0.3 at 0.2 and 4.5 at 3. Each character spends half its time arriving, a pulse at a time, and the rest punched and moving up one row of 8 LEDs.
// Knob 3: Message. 0 the teleprinter test line THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 1234567890, 1 the RYRY test, R 01010 and Y 10101 in turn so the tape is a checkerboard, 2 a telegram, ARRIVE FRIDAY 10.45 STOP MEET TRAIN; after each the next one follows. Every message opens with a letters shift. Turning it starts the new message on the next row.
// Knob 4: Noise. The chance a character takes a line hit that flips one of its five pulses, 0.6 times the knob: 3.6% at the opening 0.06, 15% at 0.25, 60% at 1. A hit row gets a pink tick in the margin and a pink ring round the flipped hole, and whatever the receiver types wrong is pink. A hit on the figures shift before 1234567890 leaves the receiver in letters, and the digits come out QWERTYUIOP; a hit on the letters shift that opens the RYRY test leaves it in figures, and it comes out 464646.

// ITA2 sends a character as five pulses, each mark or space; a punched
// tape keeps them as five holes across one row, bit 1 on the left, with
// a smaller feed hole between bit 3 and bit 4 that the sprocket pulls the
// tape by. Thirty-two codes are not enough for letters and figures, so
// two of them are shifts: 11011 puts the receiver in figures and 11111
// back in letters, and every other code means a letter or a figure by
// which shift came last. Space 00100, carriage return 00010 and line feed
// 01000 mean the same in both. The figures drawn here are the digits, on
// the top row of letters Q W E R T Y U I O P, and the marks on A B C K L
// M N S V X Z; J in figures rings the bell, drawn as a bell, and D F G H
// in figures get no figure here and are drawn as an empty box.
//
// The receiver keeps only the shift, so a single flipped pulse in a shift
// code changes how everything after it reads, up to the next shift code.
// Each row is decoded as it is punched, by the receiver's own shift, and
// compared with what was sent: what does not match is typed in pink.
//
// The tape climbs: rows are punched at the bottom, under the punch at row
// 106, and a row that has climbed twelve rows stops under the reader at
// row 10, whose pins drop through the holes they find.

const W = 64, H = 128, N = W * H;
const { floor, min, round, sqrt, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Letters shift, bit 1 first.
const LT = {
  A: "11000", B: "10011", C: "01110", D: "10010", E: "10000", F: "10110", G: "01011", H: "00101", I: "01100",
  J: "11010", K: "11110", L: "01001", M: "00111", N: "00110", O: "00011", P: "01101", Q: "11101", R: "01010",
  S: "10100", T: "00001", U: "11100", V: "01111", W: "11001", X: "10111", Y: "10101", Z: "10001",
};
// Figures shift on the same codes; "*" is the bell, "#" an empty box.
const FG = {
  Q: "1", W: "2", E: "3", R: "4", T: "5", Y: "6", U: "7", I: "8", O: "9", P: "0",
  A: "-", B: "?", C: ":", K: "(", L: ")", M: ".", N: ",", S: "'", V: "=", X: "/", Z: "+", J: "*",
  D: "#", F: "#", G: "#", H: "#",
};
const SP = 4, CR = 2, LF = 8, FIGS = 27, LTRS = 31, NUL = 0;
const C2L = [], C2F = [], F2C = {};
for (const ch in LT) {
  const c = parseInt(LT[ch], 2);
  C2L[c] = ch;
  C2F[c] = FG[ch];
  if (FG[ch] !== "#" && FG[ch] !== "*") F2C[FG[ch]] = c;
}

const MSG = [
  "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 1234567890",
  "RYRYRYRYRYRYRYRYRYRYRYRY",
  "ARRIVE FRIDAY 10.45 STOP MEET TRAIN",
];

// 5 by 7 capitals, figures and marks: seven rows, each a base-32 digit
// whose five bits are the row's LEDs, left first.
const BIG = {
  A: "ehhvhhh", B: "uhhuhhu", C: "ehggghe", D: "uhhhhhu", E: "vgguggv", F: "vgguggg", G: "ehgjhhe", H: "hhhvhhh",
  I: "e44444e", J: "72222ic", K: "hikokih", L: "ggggggv", M: "hrllhhh", N: "hhpljhh", O: "ehhhhhe", P: "uhhuggg",
  Q: "ehhhlid", R: "uhhukih", S: "fgge11u", T: "v444444", U: "hhhhhhe", V: "hhhhha4", W: "hhhllla", X: "hha4ahh",
  Y: "hha4444", Z: "v1248gv", 0: "ehjlphe", 1: "4c4444e", 2: "eh1248v", 3: "v2421he", 4: "26aiv22", 5: "vgu11he",
  6: "68guhhe", 7: "v124888", 8: "ehhehhe", 9: "ehhf12c", ".": "00000cc", ",": "0000c48", "-": "000v000",
  "?": "eh12404", "'": "4480000", ":": "0cc0cc0", "(": "2488842", ")": "8422248", "/": "01248g0", "=": "00v0v00",
  "+": "044v440", "#": "0eaaae0", "*": "4eeev04",
};
// 3 by 5 letters for the tags of the codes that type nothing: five rows,
// each an octal digit.
const SMALL = { C: "74447", F: "74644", G: "74557", I: "72227", L: "44447", R: "65655", T: "72222" };

// Geometry: row pitch, the punch and reader rows, the five hole columns
// and the feed hole's, the tape's edges, the typed column.
const RP = 8, YP = 106, YR = 10, HX = [8, 14, 20, 32, 38], FX = 26, TX0 = 3, TX1 = 43, GX = 51;
const KEEP = 20;

// A message as rows: what is punched and what the row should type.
function encode(text) {
  const rows = [{ code: LTRS, want: "LTR" }];
  let fig = false;
  for (const ch of text) {
    if (ch === " ") rows.push({ code: SP, want: " " });
    else if (LT[ch]) {
      if (fig) rows.push({ code: LTRS, want: "LTR" }), (fig = false);
      rows.push({ code: parseInt(LT[ch], 2), want: ch });
    } else if (F2C[ch] != null) {
      if (!fig) rows.push({ code: FIGS, want: "FIG" }), (fig = true);
      rows.push({ code: F2C[ch], want: ch });
    }
  }
  rows.push({ code: CR, want: "CR" }, { code: LF, want: "LF" }, { code: NUL, want: "" }, { code: NUL, want: "" });
  return rows;
}
const ENC = MSG.map(encode);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// The receiver: the row as it came down the line, decoded in the shift it
// is in.
function receive(S, sent, n) {
  let flip = 0;
  if (Math.random() < S.noise) flip = 1 << floor(Math.random() * 5);
  const code = sent.code ^ flip;
  let key;
  if (code === LTRS) (S.fig = false), (key = "LTR");
  else if (code === FIGS) (S.fig = true), (key = "FIG");
  else if (code === SP) key = " ";
  else if (code === CR) key = "CR";
  else if (code === LF) key = "LF";
  else if (code === NUL) key = "";
  else key = S.fig ? C2F[code] : C2L[code];
  return { code, flip, key, bad: key !== sent.want, n, age: 0 };
}

function queue(S, m) {
  S.m = ((m % MSG.length) + MSG.length) % MSG.length;
  S.q = ENC[S.m].slice();
}

function next(S) {
  if (!S.q.length) queue(S, S.m + 1);
  S.cur = S.q.shift();
  S.curRx = null;
}

export function setup(params) {
  params.s = {
    hue: 0, noise: 0.1, knob: -1, m: 0, q: [], rows: [], cur: null, curRx: null, fig: false,
    ph: 0, T: 0, base: 0, buf: new Float32Array(N * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.noise = 0.6 * cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const km = round(cl(k[2] || 0, 0, 2));
  if (km !== S.knob) {
    if (S.knob < 0) {
      // A fresh tape opens on the end of the message before, already
      // punched and typed, with the receiver in letters.
      const before = ENC[(km + MSG.length - 1) % MSG.length];
      const tail = before.slice(before.length - 15);
      tail.forEach((r, i) => S.rows.push(receive(S, r, i - tail.length)));
      for (const r of S.rows) r.age = 9;
      queue(S, km);
      next(S);
    } else queue(S, km);
    S.knob = km;
  }
  const rate = 1.5 * speed, was = S.ph;
  S.ph += d * rate;
  for (const r of S.rows) r.age += d;
  // Half way through its time the row is punched and typed.
  if (!S.curRx) S.curRx = receive(S, S.cur, S.base);
  if (was < 0.5 && S.ph >= 0.5) {
    S.curRx.age = 0;
    S.rows.push(S.curRx);
    if (S.rows.length > KEEP) S.rows.shift();
  }
  // Then the tape moves up one row, from 0.55 to 0.95 of the time.
  if (S.ph >= 1) {
    S.ph -= 1;
    S.base++;
    next(S);
  }
  S.T = S.base + smooth((S.ph - 0.55) / 0.4);
}

function px(buf, x, y, c, a) {
  if (a <= 0 || x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  if (a > 1) a = 1;
  buf[p] += (c[0] - buf[p]) * a;
  buf[p + 1] += (c[1] - buf[p + 1]) * a;
  buf[p + 2] += (c[2] - buf[p + 2]) * a;
}

// A disc (or a ring of width w) centred on (x, y).
function disc(buf, x, y, r, c, a, w) {
  for (let Y = floor(y - r - 1); Y <= y + r + 1; Y++)
    for (let X = floor(x - r - 1); X <= x + r + 1; X++) {
      const e = sqrt((X + 0.5 - x) ** 2 + (Y + 0.5 - y) ** 2);
      const cov = w ? cl(w / 2 + 0.5 - abs(e - r), 0, 1) : cl(r + 0.5 - e, 0, 1);
      px(buf, X, Y, c, a * cov);
    }
}

// A glyph of rows (base-32 for the capitals, octal for the tags) with its
// top at a fractional row, the fraction shared between two LED rows.
// Bold doubles each lit LED to the right, as a typewheel's heavy face.
function glyph(buf, rows, base, wide, x0, top, c, a, bold) {
  const y0 = floor(top), f = top - y0;
  for (let r = 0; r < rows.length; r++) {
    const bits = parseInt(rows[r], base);
    for (let j = 0; j < wide; j++)
      if ((bits >> (wide - 1 - j)) & 1)
        for (let b = 0; b <= bold; b++) {
          px(buf, x0 + j + b, y0 + r, c, a * (1 - f));
          px(buf, x0 + j + b, y0 + r + 1, c, a * f);
        }
  }
}

function typed(buf, key, top, c, a) {
  if (!key || key === " ") return;
  if (BIG[key]) return glyph(buf, BIG[key], 32, 5, GX, top, c, a, 1);
  // A tag: two or three small letters, centred on the capitals' column.
  const w = key.length * 4 - 1;
  let x = GX + 3 - floor(w / 2);
  for (const ch of key) glyph(buf, SMALL[ch], 8, 3, x, top + 1, c, a, 0), (x += 4);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, h = S.hue;
  buf.fill(0);
  const paper = hsv(h + 0.13, 0.3, 0.72), ink = hsv(h + 0.55, 0.42, 1), dim = hsv(h + 0.55, 0.3, 0.55);
  const hit = hsv(h + 0.95, 0.65, 1), gold = hsv(h + 0.12, 0.7, 1), steel = [0.42, 0.44, 0.48], white = [1, 1, 1];

  // The paper, a little darker at its edges.
  for (let y = 0; y < H; y++)
    for (let x = TX0; x <= TX1; x++) {
      const e = min(x - TX0, TX1 - x), v = e === 0 ? 0.62 : e === 1 ? 0.85 : 1, p = (y * W + x) * 3;
      buf[p] = paper[0] * v;
      buf[p + 1] = paper[1] * v;
      buf[p + 2] = paper[2] * v;
    }

  // The punched rows climbing, their holes, their line hits, and beside
  // each the character it typed.
  const black = [0, 0, 0];
  let under = null;
  for (const r of S.rows) {
    const y = YP - (S.T - r.n) * RP;
    if (y < -RP || y > H + RP) continue;
    if (abs(y - YR) < 0.5) under = r;
    disc(buf, FX + 0.5, y + 0.5, 1.05, black, 1);
    for (let b = 0; b < 5; b++) {
      const on = (r.code >> (4 - b)) & 1;
      if (on) disc(buf, HX[b] + 0.5, y + 0.5, 2.1, black, 1);
      if ((r.flip >> (4 - b)) & 1) disc(buf, HX[b] + 0.5, y + 0.5, 2.8, hit, 1, 1.1);
    }
    // A line hit also gets a pink tick in the margin beside its row.
    if (r.flip) for (let dy = -2; dy <= 3; dy++) for (let x = TX1 + 2; x <= TX1 + 3; x++) px(buf, x, round(y) + dy, hit, 0.85);
    const fresh = smooth(1 - r.age * 4), tag = r.key.length > 1;
    const base = r.bad ? hit : tag ? dim : ink;
    const c = [base[0] + (1 - base[0]) * fresh, base[1] + (1 - base[1]) * fresh, base[2] + (1 - base[2]) * fresh];
    typed(buf, r.key, y - 3, c, 1);
  }

  // The punch: two steel bars across the tape, and between them the row
  // being received, each mark pulse lighting its selector as it arrives.
  for (let x = TX0 - 2; x <= TX1 + 2; x++) {
    px(buf, x, YP - 3, steel, 1);
    px(buf, x, YP + 4, steel, 1);
    px(buf, x, YR - 3, steel, 1);
    px(buf, x, YR + 4, steel, 1);
  }
  for (const yy of [YP - 3, YP + 4, YR - 3, YR + 4]) {
    px(buf, TX0 - 3, yy, steel, 0.6);
    px(buf, TX1 + 3, yy, steel, 0.6);
  }
  if (S.curRx && S.ph < 0.5) {
    for (let b = 0; b < 5; b++) {
      const at = 0.07 + 0.07 * b;
      if (S.ph >= at && (S.curRx.code >> (4 - b)) & 1) disc(buf, HX[b] + 0.5, YP + 0.5, 0.9, gold, smooth((S.ph - at) / 0.05));
    }
  }
  // The punch fires: a flash round the new holes.
  const last = S.rows[S.rows.length - 1];
  if (last && last.age < 0.25) {
    const y = YP - (S.T - last.n) * RP, a = 1 - last.age / 0.25;
    for (let b = 0; b < 5; b++) if ((last.code >> (4 - b)) & 1) disc(buf, HX[b] + 0.5, y + 0.5, 2.4, white, a, 0.8);
  }

  // The reader: a pin over each hole column, dropped through where it
  // finds a hole, resting on the paper where it does not.
  for (let b = 0; b < 5; b++) {
    const through = under && (under.code >> (4 - b)) & 1;
    disc(buf, HX[b] + 0.5, YR + 0.5, through ? 1.1 : 0.7, through ? gold : steel, 1);
  }

  for (let i = 0; i < N; i++)
    display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
