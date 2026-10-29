// ===== Patternflow pattern =====
// Title:   Mouse's Tale
// Family:  type
// Idea:    Lewis Carroll's Mouse's Tale hangs down the panel as the tail it was printed as, one or two words a line, each line set where the tail's curve has got to and in smaller type the lower it hangs, from a hand-drawn 5 by 7 face through 4 by 6 and 3 by 5 to the bare shapes of the words, a dot a letter and a dot a word at the tip, while the tail sways slowly and the poem runs down it, new lines coming in at the top and the last ones fading at the tip.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The Mouse's Tale, a figured poem (Lewis Carroll, Alice's Adventures in Wonderland, 1865), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sway=1..3, Taper=0..1
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 the top of the tail is aqua, and the ink turns through green to a yellow at the tip, deeper the lower it hangs.
// Knob 2: Speed. How fast the poem runs down the tail: half a line a second at 2, so the 53 lines come round every 106 s. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Sway. How far the tail swings. At 1 it bends gently and sways once every 9 s; at 3 the bends reach 1.6 times as far, the tip lashes from wall to wall, and it sways once every 4.5 s.
// Knob 4: Taper. How soon the type shrinks. Near 0 the 5 by 7 face holds the top 54 rows, six lines, then two lines of 4 by 6, three of 3 by 5, four of word shapes, six of a dot a letter and five of a dot a word: 26 lines. At 1 only the top line is big, and 42 lines hang there, 30 of them dots.

// Carroll set the tale in Chapter III so that it reads down a mouse's long
// tail: short lines, each shifted to follow the curve, and the type stepping
// down in size until the last words are tiny. Here the poem loops: the line
// that comes in at the top is the one before the top line, so the tail always
// reads downward in the poem's order, and the last line, death, sits just
// above the first, Fury said.
//
// The text is the 1865 tale as the common reprints give it, with the italic
// "you" set plain. The three faces are drawn here, 5 by 7, 4 by 6 and 3 by 5,
// each with its descenders lifted into the cell as small LCD faces do. Below
// those every letter keeps only its word shape on 2 by 3: an ascender LED,
// a body LED or two, a descender LED. Then one LED a letter, then one a word.

const W = 64, H = 128;
const { floor, round, min, max, sin, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = 255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p);
  out[1] = 255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p);
  out[2] = 255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p);
}

// The three drawn faces. Each glyph is its width, then one base-32 digit a
// row from the top, the leftmost LED the highest bit: "a" in 5 by 7 is
// 5, then 0 0 e 1 f h f, rows .....  .....  .###.  ....#  .####  #...#  .####
const FACES = [
  { "a": "500e1fhf", "b": "5ggmphhu", "c": "500egghe", "d": "511djhhf", "e": "500ehvge", "f": "5698s888", "g": "50fhhf1e", "h": "5ggmphhh", "i": "540c444e", "j": "520622ic", "k": "5ggikoki", "l": "5c44444e", "m": "500qllhh", "n": "500mphhh", "o": "500ehhhe", "p": "500uhugg", "r": "500mpggg", "s": "500ege1u", "t": "588s8896", "u": "500hhhjd", "v": "500hhha4", "w": "500hhlla", "y": "500hhf1e", "C": "5ehggghe", "F": "5vgguggg", "I": "5e44444e", "L": "5ggggggv", "S": "5fgge11u", "T": "5v444444", "W": "5hhhllla", ",": "20000312", ".": "20000033", "'": "23120000", ":": "20330033", ";": "20330312", "-": "5000v000", "\"": "5r9i0000" },
  { "a": "4007997", "b": "488e99e", "c": "4007887", "d": "4117997", "e": "4006f87", "f": "434e444", "g": "4079716", "h": "488e999", "i": "1101111", "j": "3101152", "k": "4889ae9", "l": "2222221", "m": "500ulll", "n": "400e999", "o": "4006996", "p": "40e9e88", "r": "3005644", "s": "4007c3e", "t": "3227221", "u": "4009997", "v": "3005552", "w": "500hlla", "y": "4099716", "C": "4788887", "F": "4f8e888", "I": "3722227", "L": "488888f", "S": "478611e", "T": "3722222", "W": "5hhllla", ",": "2000012", ".": "1000001", "'": "2120000", ":": "1001001", ";": "2001012", "-": "4000f00", "\"": "3550000" },
  { "a": "300353", "b": "344656", "c": "300343", "d": "311353", "e": "300376", "f": "212322", "g": "303536", "h": "344655", "i": "110111", "j": "210112", "k": "344565", "l": "111111", "m": "500ull", "n": "300655", "o": "300252", "p": "306564", "r": "200322", "s": "300326", "t": "322723", "u": "300553", "v": "300552", "w": "500lla", "y": "305536", "C": "334443", "F": "374644", "I": "372227", "L": "344447", "S": "334216", "T": "372222", "W": "5hhlla", ",": "100011", ".": "100001", "'": "111000", ":": "101001", ";": "101011", "-": "300700", "\"": "355000" },
];

// The six sizes down the tail: the three faces, word shapes on 2 by 3, a
// dot a letter, a dot a word. Height, line pitch, the width of a space and
// the gap between letters.
const SIZES = [
  { h: 7, pitch: 9, space: 4, gap: 1 },
  { h: 6, pitch: 8, space: 3, gap: 1 },
  { h: 5, pitch: 6, space: 3, gap: 1 },
  { h: 3, pitch: 4, space: 2, gap: 1 },
  { h: 1, pitch: 2, space: 1, gap: 0 },
  { h: 1, pitch: 2, space: 1, gap: 0 },
];
const LAST = SIZES.length - 1;

// Word shapes: a letter on 2 by 3 keeps whether it rises, sits or hangs.
const RISE = "bdfhklt", HANG = "gjpy", NARROW = "fijlrt", RIGHT = "dgjy";
function shape(ch) {
  if (ch === "I") return [1, [1, 1, 0]];
  if (ch === "W") return [3, [7, 7, 0]];
  if (ch >= "A" && ch <= "Z") return [2, [3, 3, 0]];
  if (ch === ",") return [1, [0, 0, 1]];
  if (ch === "'" || ch === '"') return [1, [1, 0, 0]];
  if (ch === "-") return [2, [0, 3, 0]];
  if (".:;".includes(ch)) return [1, [0, 1, 0]];
  const w = NARROW.includes(ch) ? 1 : ch === "m" || ch === "w" ? 3 : 2;
  const stem = w === 1 ? 1 : RIGHT.includes(ch) ? 1 : 1 << (w - 1);
  return [w, [RISE.includes(ch) ? stem : 0, (1 << w) - 1, HANG.includes(ch) ? stem : 0]];
}

function glyph(size, ch) {
  if (size >= 3) return shape(ch);
  const code = FACES[size][ch];
  if (!code) return [2, [0, 0, 0, 0, 0, 0, 0].slice(0, SIZES[size].h)];
  const rows = [];
  for (let i = 1; i < code.length; i++) rows.push(parseInt(code[i], 32));
  return [+code[0], rows];
}

// One line drawn at one size: width, height and its lit LEDs.
function render(text, size) {
  const S = SIZES[size], h = S.h;
  if (size === LAST) {
    const words = text.split(" ").length, w = 2 * words - 1, bits = new Uint8Array(w);
    for (let i = 0; i < words; i++) bits[2 * i] = 1;
    return { w, h, bits };
  }
  const parts = [];
  let w = 0, joined = false;
  for (const ch of text) {
    if (ch === " ") {
      w += S.space;
      joined = false;
      continue;
    }
    if (joined) w += S.gap;
    const [gw, rows] = size === 4 ? [1, [1]] : glyph(size, ch);
    parts.push({ x: w, gw, rows });
    w += gw;
    joined = true;
  }
  const bits = new Uint8Array(max(1, w) * h);
  for (const p of parts)
    for (let r = 0; r < h; r++)
      for (let c = 0; c < p.gw; c++) if ((p.rows[r] >> (p.gw - 1 - c)) & 1) bits[r * w + p.x + c] = 1;
  return { w, h, bits };
}

// The tale, broken into lines of one or two words that fit 50 LEDs in the
// largest face. The em dash after "you." is set as a dash.
const TALE =
  "'Fury said to a mouse, That he met in the house, \"Let us both go to law: I will prosecute you.- Come, I'll take no denial; " +
  "We must have a trial: For really this morning I've nothing to do.\" Said the mouse to the cur, \"Such a trial, dear Sir, " +
  "With no jury or judge, would be wasting our breath.\" \"I'll be judge, I'll be jury,\" Said cunning old Fury: " +
  "\"I'll try the whole cause, and condemn you to death.\"'";

function breakLines() {
  const words = TALE.split(" "), lines = [];
  for (let i = 0; i < words.length; ) {
    const two = i + 1 < words.length ? words[i] + " " + words[i + 1] : null;
    if (two && render(two, 0).w <= 50) (lines.push(two), (i += 2));
    else lines.push(words[i++]);
  }
  return lines;
}

export function setup(params) {
  const lines = breakLines();
  params.s = {
    lines,
    drawn: lines.map((t) => SIZES.map((_, k) => render(t, k))),
    q: 0, t: 0, hue: 0, speed: 2, sway: 1, taper: 0.06,
    Y: new Float32Array(80), buf: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
}

// How far down the sizes the tail is at row y, 0 at the top to 5.9 at the
// tip; the size is its whole part.
const depth = (S, y) => 5.9 * pow(cl(y / H, 0, 1), 1.85 - 1.25 * S.taper);
const sizeAt = (S, y) => min(LAST, floor(depth(S, y)));

// The tail's centre line at row y and time t.
function centre(S, y) {
  const u = cl(y / H, 0, 1), z = depth(S, y), s = S.sway;
  const room = 6 + 4.6 * z;
  const wag = 0.32 * s * sin(S.t * ((2 * PI) / 9) * (1 + 0.5 * (s - 1)) - 2.4 * u) * (0.4 + u);
  return W / 2 + room * (0.62 + 0.19 * (s - 1)) * sin(2 * PI * (0.55 * u + 0.8 * u * u) + 0.7 + wag);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.sway = cl(kv[2], 1, 3);
  S.taper = cl(kv[3], 0, 1);
  S.t += d;
  S.q += (d * S.speed) / 4;
  // Line tops down the tail, each a pitch of its own size below the last.
  const Y = S.Y;
  Y[0] = 2;
  let n = 0;
  while (Y[n] < H + 2 && n < Y.length - 1) {
    Y[n + 1] = Y[n] + SIZES[sizeAt(S, Y[n])].pitch;
    n++;
  }
  S.slots = n;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.slots) return;
  const { buf, Y, c, lines, drawn } = S, L = lines.length;
  buf.fill(0);
  const Q = floor(S.q), f = S.q - Q;
  for (let i = -1; i < S.slots; i++) {
    const y0 = i < 0 ? Y[0] - SIZES[0].pitch : Y[i], y1 = Y[i + 1];
    const y = round(y0 + f * (y1 - y0));
    if (y >= H) break;
    const size = sizeAt(S, max(0, y)), z = depth(S, y), img = drawn[(((i - Q) % L) + L) % L][size];
    const x = cl(round(centre(S, y + img.h / 2) - img.w / 2), 0, W - img.w);
    const u = cl(y / H, 0, 1);
    // The ink deepens down the tail, and the last dots fade at the tip.
    hsv(S.hue + 0.47 - 0.3 * u, 0.65 + 0.25 * u, cl((6.1 - z) / 0.9, 0.2, 1), c);
    for (let r = 0; r < img.h; r++) {
      const yy = y + r;
      if (yy < 0 || yy >= H) continue;
      for (let k = 0; k < img.w; k++) {
        if (!img.bits[r * img.w + k]) continue;
        const o = (yy * W + x + k) * 3;
        buf[o] = c[0];
        buf[o + 1] = c[1];
        buf[o + 2] = c[2];
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o], buf[o + 1], buf[o + 2]);
    }
}
