// ===== Patternflow pattern =====
// Title:   Biliteral Cipher
// Family:  type
// Idea:    A cover sentence is set in capitals ten LEDs wide, five to a line, each one in fount a or fount b, two founts that differ by a slant and a little weight the eye passes over; a reading light then goes along the letters one by one, writes a small a or b under each, and every five of those spell one letter of Bacon's 24-letter alphabet, set below in light until the hidden word is complete, holds, and the next sentence is typed.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Francis Bacon's biliteral cipher in De Augmentis Scientiarum (1623), with his own example, FUGE hidden in MANERE TE VOLO DONEC VENERO; the 5 by 7 capitals of Photon Disk (pattern round 70) doubled; pattern round 72
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Message=0..4, Tell=0..1
//
// Knob 1: Hue. The colour of the reading light, the a and b marks and the hidden word, cyan at 0, violet at 0.25, red at 0.5, yellow-green at 0.75; the cover letters take a pale tint from the opposite side of the wheel, ivory at 0.
// Knob 2: Speed. At 2 a letter is typed every 0.07 s and read every 0.3 s, a hidden letter is set in 0.45 s and the finished word holds 3 s, so Bacon's sentence takes 13 s from first letter to the next sentence. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Message. Which sentence is set first; the rest follow in turn. 0 Bacon's MANERE TE VOLO DONEC VENERO hiding FUGE, 1 THE SEA IS CALM AND STILL TODAY hiding STORM, 2 SAY NOTHING TO ANYONE YET hiding TELL, 3 WE ARE ALL QUITE WELL HERE hiding HELP, 4 BURN THIS LETTER AT ONCE hiding KEEP. Turning it sets the new sentence at once.
// Knob 4: Tell. How far fount b strays from fount a. At 0 they are the same LEDs and only the reading light knows; at the opening 0.06 a b letter leans 0.22 LED over its 14 rows and is 0.12 LED heavier, a change of a few levels on its edge LEDs; at 0.5 it leans 1.8 LEDs, is 1 LED heavier and the b letters read as a faint italic; at 1 it leans 3.6 LEDs and is 2 LEDs heavier, a bold italic, and the hidden word can be read off the page without the light.

// Bacon's cipher writes each letter of the hidden word as five symbols,
// a or b, A = aaaaa through Z = babbb, with I and J sharing abaaa and U and
// V sharing baabb, and prints a cover text of at least five times as many
// letters in two founts: each cover letter in fount a stands for a, each in
// fount b for b. Letters past the last full group are nulls, set in either
// fount and not read; here they are drawn a little dimmer. Bacon's own
// example hides FUGE (flee) in MANERE TE VOLO DONEC VENERO (stay until I
// come): 23 letters, 20 read, ERO left over.
//
// The cover letters here are the 5 by 7 capitals of Photon Disk drawn at
// two LEDs a cell, 10 wide and 14 tall with 3 LEDs between them, so five
// fill 62 of the 64 columns: one group of five to a line. Fount b is the
// same bitmap sheared and thickened, sampled 4 x 4 times a LED, so at a
// small Tell it differs from fount a only in how bright its edge LEDs are.
// A dot halfway up the gap marks the end of a word, as Roman inscriptions
// did, since a line of five has no room for word spaces.

const W = 64, H = 128;
const { floor, min, max, round, abs, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- 5 x 7 capitals from Photon Disk, rows from the top.
const G57 = {
  A: ".###. #...# #...# ##### #...# #...# #...#", B: "####. #...# #...# ####. #...# #...# ####.", C: ".###. #...# #.... #.... #.... #...# .###.",
  D: "####. #...# #...# #...# #...# #...# ####.", E: "##### #.... #.... ####. #.... #.... #####", F: "##### #.... #.... ####. #.... #.... #....",
  G: ".###. #...# #.... #.### #...# #...# .####", H: "#...# #...# #...# ##### #...# #...# #...#", I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  J: "..### ...#. ...#. ...#. ...#. #..#. .##..", K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#", L: "#.... #.... #.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #.#.# #...# #...# #...#", N: "#...# #...# ##..# #.#.# #..## #...# #...#", O: ".###. #...# #...# #...# #...# #...# .###.",
  P: "####. #...# #...# ####. #.... #.... #....", Q: ".###. #...# #...# #...# #.#.# #..#. .##.#", R: "####. #...# #...# ####. #.#.. #..#. #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.", T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..", U: "#...# #...# #...# #...# #...# #...# .###.",
  V: "#...# #...# #...# #...# #...# .#.#. ..#..", W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.", X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..", Z: "##### ....# ...#. ..#.. .#... #.... #####",
};
const BITS = {};
for (const k in G57) {
  const s = G57[k].replace(/ /g, ""), b = new Uint8Array(35);
  for (let i = 0; i < 35; i++) b[i] = s[i] === "#" ? 1 : 0;
  BITS[k] = b;
}
// The marks, a 3 by 5 a and b drawn for this pattern.
const MARK = ["....###.##.#.##".replace(/\./g, "0").replace(/#/g, "1"), "#..#..##.#.###.".replace(/\./g, "0").replace(/#/g, "1")];
// Bacon's alphabet of 24: J reads as I, V as U.
const ABC = "ABCDEFGHIKLMNOPQRSTUWXYZ";
const code = (ch) => ABC.indexOf(ch === "J" ? "I" : ch === "V" ? "U" : ch);

const MESSAGES = [
  ["MANERE TE VOLO DONEC VENERO", "FUGE"],
  ["THE SEA IS CALM AND STILL TODAY", "STORM"],
  ["SAY NOTHING TO ANYONE YET", "TELL"],
  ["WE ARE ALL QUITE WELL HERE", "HELP"],
  ["BURN THIS LETTER AT ONCE", "KEEP"],
];

// ---- Layout: a letter is 10 x 14 LEDs in a cell 13 wide; a line is 22
// rows, the letter, a blank row, the 5-row mark and two blank rows.
const CX = (c) => 1 + 13 * c, CY = (r) => 1 + 22 * r, HY = 112, RULE = 110;
const GW = 16, GOX = 3; // glyph raster: columns -3..12 of the cell

// Coverage of one glyph in fount b at a given tell, 16 x 14 LEDs. Shear s
// leans the top s/2 right and the foot s/2 left; weight w widens every
// stroke by w, half to each side.
function raster(ch, t) {
  const bm = BITS[ch], out = new Float32Array(GW * 14);
  const s = 3.6 * t, w = 2 * t;
  const on = (x, y) => {
    const c = floor(x / 2), r = floor(y / 2);
    return c >= 0 && c < 5 && r >= 0 && r < 7 && bm[r * 5 + c] === 1;
  };
  for (let y = 0; y < 14; y++)
    for (let gx = 0; gx < GW; gx++) {
      let n = 0;
      for (let j = 0; j < 4; j++) {
        const Y = y + (j + 0.5) / 4, sh = s * (0.5 - Y / 14);
        for (let i = 0; i < 4; i++) {
          const x = gx - GOX + (i + 0.5) / 4 - sh;
          if (on(x, Y) || (w > 0 && (on(x - w / 2, Y) || on(x + w / 2, Y)))) n++;
        }
      }
      out[y * GW + gx] = n / 16;
    }
  return out;
}

function prepare(s, mi) {
  const [cover, hidden] = MESSAGES[mi];
  const letters = [], dots = [];
  for (const ch of cover) {
    if (ch === " ") {
      if (letters.length % 5) dots.push(letters.length - 1);
    } else letters.push(ch);
  }
  const n = min(hidden.length, floor(letters.length / 5), 5);
  const fount = letters.map(() => (Math.random() < 0.5 ? 1 : 0));
  for (let i = 0; i < n; i++) {
    const v = code(hidden[i]);
    for (let k = 0; k < 5; k++) fount[i * 5 + k] = (v >> (4 - k)) & 1;
  }
  // Read it back the way a decipherer would, so a wrong table cannot pass.
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < 5; k++) v = v * 2 + fount[i * 5 + k];
    if (ABC[v] !== hidden[i]) throw new Error(`message ${mi} letter ${i} reads ${ABC[v]}`);
  }
  s.mi = mi;
  s.letters = letters.slice(0, 25);
  s.fount = fount;
  s.dots = dots;
  s.hidden = hidden.slice(0, n);
  s.n = n;
  s.phase = 0; // 0 type, 1 read, 2 set, 3 hold, 4 clear
  s.t = 0;
  s.typed = 0;
  s.read = 0;
  s.set = 0;
  s.born = letters.map(() => -1);
  s.markAt = letters.map(() => -1);
  s.setAt = [-1, -1, -1, -1, -1];
}

export function setup(params) {
  const s = (params.s = {});
  s.clock = 0;
  s.knobMsg = -1;
  s.cache = {};
  s.tellKey = -1;
  s.fb = new Uint8ClampedArray(W * H * 3);
  prepare(s, 0);
}

const T_TYPE = 0.07, T_READ = 0.3, T_SET = 0.45, T_HOLD = 3, T_CLEAR = 0.6;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.hue = k[0] || 0;
  s.tell = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const rate = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  const mi = round(cl(k[2] || 0, 0, 4));
  if (mi !== s.knobMsg) {
    s.knobMsg = mi;
    prepare(s, mi);
  }
  s.clock += dt;
  s.t += dt * rate;
  const L = s.letters.length, R = s.n * 5;
  for (let guard = 0; guard < 40; guard++) {
    if (s.phase === 0) {
      if (s.t < T_TYPE) break;
      s.t -= T_TYPE;
      s.born[s.typed++] = s.clock;
      if (s.typed >= L) (s.phase = 1), (s.t = -0.25);
    } else if (s.phase === 1) {
      if (s.t < T_READ) break;
      s.t -= T_READ;
      if (s.markAt[s.read] < 0) s.markAt[s.read] = s.clock;
      s.read++;
      if (s.read % 5 === 0) (s.phase = 2), (s.setAt[s.read / 5 - 1] = s.clock);
    } else if (s.phase === 2) {
      if (s.t < T_SET) break;
      s.t -= T_SET;
      s.set++;
      s.phase = s.read >= R ? 3 : 1;
    } else if (s.phase === 3) {
      if (s.t < T_HOLD) break;
      s.t -= T_HOLD;
      s.phase = 4;
    } else {
      if (s.t < T_CLEAR) break;
      prepare(s, (s.mi + 1) % MESSAGES.length);
    }
  }
  // The mark under a letter is written 60% of the way through its reading.
  if (s.phase === 1 && s.read < R && s.t > 0.6 * T_READ && s.markAt[s.read] < 0) s.markAt[s.read] = s.clock;
}

function glyphOf(s, ch, b) {
  const key = b ? round(s.tell * 400) : 0;
  if (b && key !== s.tellKey) (s.cache = {}), (s.tellKey = key);
  const id = ch + (b ? "b" : "a");
  if (!s.cache[id]) s.cache[id] = raster(ch, b ? key / 400 : 0);
  return s.cache[id];
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const fb = s.fb;
  const ha = 0.5 + s.hue;
  const acc = hsv(ha, 0.85, 255), ink = hsv(ha + 0.6, 0.24, 225), bg = hsv(ha, 0.6, 7);
  for (let i = 0; i < W * H; i++) (fb[i * 3] = bg[0]), (fb[i * 3 + 1] = bg[1]), (fb[i * 3 + 2] = bg[2]);
  const add = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const i = (y * W + x) * 3;
    fb[i] = max(fb[i], c[0] * a);
    fb[i + 1] = max(fb[i + 1], c[1] * a);
    fb[i + 2] = max(fb[i + 2], c[2] * a);
  };
  const mix = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const i = (y * W + x) * 3;
    fb[i] += (c[0] - fb[i]) * a;
    fb[i + 1] += (c[1] - fb[i + 1]) * a;
    fb[i + 2] += (c[2] - fb[i + 2]) * a;
  };
  const fade = s.phase === 4 ? 1 - cl(s.t / T_CLEAR, 0, 1) : 1;
  const R = s.n * 5;
  const reading = s.phase === 1 && s.t >= 0 && s.read < R ? s.read : -1;
  const p = reading >= 0 ? cl(s.t / T_READ, 0, 1) : 0;

  // The reading light: a dim box behind the letter and a bright line
  // crossing it left to right.
  if (reading >= 0) {
    const x0 = CX(reading % 5), y0 = CY(floor(reading / 5));
    const env = sin(PI * cl(p * 1.15, 0, 1)) * 0.22 + 0.06;
    for (let y = y0 - 1; y <= y0 + 14; y++) for (let x = x0 - 2; x <= x0 + 11; x++) add(x, y, acc, env);
  }
  // Cover letters.
  for (let j = 0; j < s.typed; j++) {
    const c = j % 5, r = floor(j / 5), x0 = CX(c), y0 = CY(r);
    const g = glyphOf(s, s.letters[j], s.fount[j]);
    const age = s.clock - s.born[j], flash = cl(1 - age / 0.25, 0, 1);
    let col = ink, lv = fade;
    if (j >= R) lv *= 0.62;
    // A group glows as its letter is set below; in the hold the b letters
    // keep a tint.
    const sa = j < R ? s.setAt[floor(j / 5)] : -1;
    let u = sa >= 0 ? 0.4 * cl(1 - (s.clock - sa) / 0.6, 0, 1) : 0;
    if (s.phase === 3 && s.fount[j] && j < R) u = max(u, 0.3);
    if (u > 0) col = [ink[0] + (acc[0] - ink[0]) * u, ink[1] + (acc[1] - ink[1]) * u, ink[2] + (acc[2] - ink[2]) * u];
    const scan = j === reading ? x0 - 1 + p * 12 : -99;
    for (let y = 0; y < 14; y++)
      for (let gx = 0; gx < GW; gx++) {
        const v = g[y * GW + gx];
        if (v <= 0) continue;
        const X = x0 + gx - GOX, Y = y0 + y;
        mix(X, Y, col, v * lv);
        if (flash > 0) mix(X, Y, [255, 255, 255], v * flash * 0.8);
        const d = abs(X - scan);
        if (d < 1.5) mix(X, Y, [acc[0] * 0.5 + 127, acc[1] * 0.5 + 127, acc[2] * 0.5 + 127], v * (1 - d / 1.5));
      }
  }
  if (reading >= 0) {
    const x = round(CX(reading % 5) - 1 + p * 12), y0 = CY(floor(reading / 5));
    for (let y = y0 - 1; y <= y0 + 14; y++) add(x, y, acc, 0.55);
  }
  // Word dots in the gaps.
  for (const j of s.dots)
    if (j + 1 < s.typed && j % 5 < 4) {
      const x = CX(j % 5) + 11, y = CY(floor(j / 5)) + 6;
      add(x, y, ink, 0.5 * fade), add(x, y + 1, ink, 0.5 * fade);
    }
  // The a and b marks.
  for (let j = 0; j < R; j++) {
    if (s.markAt[j] < 0) continue;
    const age = s.clock - s.markAt[j], m = MARK[s.fount[j]], x0 = CX(j % 5) + 3, y0 = CY(floor(j / 5)) + 15;
    const grp = floor(j / 5), sa = s.setAt[grp];
    let lv = cl(age / 0.12, 0, 1) * 0.78;
    if (sa >= 0) lv = 0.78 + 0.22 * cl(1 - abs(s.clock - sa - 0.2) / 0.3, 0, 1);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (m[y * 3 + x] === "1") add(x0 + x, y0 + y, acc, lv * fade);
  }
  // The rule over the hidden word, and the word.
  for (let x = 2; x < W - 2; x++) add(x, RULE, acc, 0.13 * fade);
  for (let i = 0; i < s.n; i++) {
    if (s.setAt[i] < 0) continue;
    const age = s.clock - s.setAt[i], g = glyphOf(s, s.hidden[i], 0), x0 = CX(i);
    const grow = cl(age / 0.3, 0, 1), flash = cl(1 - age / 0.5, 0, 1);
    for (let y = 0; y < 14; y++) {
      if (y > grow * 14 + 0.5) continue;
      for (let gx = 0; gx < GW; gx++) {
        const v = g[y * GW + gx];
        if (v <= 0) continue;
        mix(x0 + gx - GOX, HY + y, acc, v * fade);
        if (flash > 0) mix(x0 + gx - GOX, HY + y, [255, 255, 255], v * flash * 0.7 * fade);
      }
    }
    // A soft glow under a freshly set letter.
    if (flash > 0) for (let y = HY - 1; y <= HY + 14; y++) for (let x = x0 - 1; x <= x0 + 10; x++) add(x, y, acc, 0.12 * flash * fade);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, fb[i] | 0, fb[i + 1] | 0, fb[i + 2] | 0);
    }
}
