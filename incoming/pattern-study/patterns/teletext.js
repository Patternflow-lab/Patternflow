// ===== Patternflow pattern =====
// Title:   Teletext
// Family:  type
// Idea:    A sixteen-column teletext page decoded byte by byte the way the Mullard SAA5050 drew one, letters and 2 by 3 mosaics in seven colours where every colour change spends a cell as a space, rolls its header through the magazine until page 100 comes round, then flips through a carousel of three subpages, diagonal mosaic stripes over an index, double-height block numerals and a ringed disc, each written in from the top as it arrives.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: teletext as the BBC's Ceefax (from 1974) and ITV's ORACLE broadcast it, the Level 1 page of World System Teletext with its spacing attributes and 2 by 3 mosaic characters as the Mullard SAA5050 character generator drew them, and the four coloured prompts of Fastext; a 3 by 5 font drawn for this pattern; pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Page=1..5, Speed=0.2..3, Size=0..1, Reception=0..1
//
// Knob 1: Page. The page asked for: 100 at 1, then 200, 300, 400 and 500. Turning it sends the decoder looking again: the old page stays up while the header rolls through the magazine to the new number.
// Knob 2: Speed. Pages going past a second, 20 for each unit: 40 at the opening 2, so the magazine of 100 pages comes round every 2.5 s and brings the next subpage; 4 a second at 0.2, where page 100 takes 12 s to come, and 60 at 3.
// Knob 3: Size. The decoder's size key: below 1/3 the whole page, then the top half at double height, and from 2/3 the bottom half.
// Knob 4: Reception. The share of bytes hit by noise, 0.45 times the square of the knob: 0.16% at the opening 0.06, 2.8% at 0.25, 11% at 0.5, 45% at 1. A hit flips one to three of a byte's eight bits. An odd number fails the parity check and the byte is dropped, leaving a space; two get through as a wrong character, and when that is a spacing attribute the rest of its row changes colour, size or mode.
// Buttons: K1 tap is the reveal key: concealed text on the page shows, or hides again.

// A page here is 16 columns by 21 rows of 4 by 6 LED cells, one byte a
// cell; the SAA5050 drew 40 by 24 cells of 6 by 10 dots. Bytes 0x20 to
// 0x7f are characters. Bytes below 0x20 are spacing attributes: each
// changes the colour, the mode or the size for the rest of its row and is
// itself shown as a space in the background colour. That is where teletext
// art gets its gaps: two mosaics of different colours side by side always
// have a cell between them. A row starts as white letters on black. 0x01
// to 0x07 switch to letters and 0x11 to 0x17 to mosaics in red, green,
// yellow, blue, magenta, cyan and white. In mosaic mode a byte with 0x20 set
// is a 2 by 3 block of sixels, one bit each (0x01 top left, 0x02 top right,
// 0x04 and 0x08 the middle, 0x10 and 0x40 the bottom), drawn here as 2 by 2
// LEDs, or one LED with a gap left and below once 0x1a (separated) has
// been sent. 0x1d makes the foreground colour the background and 0x1c goes
// back to black. 0x0d makes the rest of the row double height, and the row
// under it then shows the lower halves. 0x1e (hold) shows the last mosaic
// again in place of the space an attribute leaves. Background, hold,
// separated, contiguous, conceal, steady and normal size act in their own
// cell; the colours, flash, double height and release from the next cell.
//
// Every byte goes out with an odd parity bit. Noise that flips an odd
// number of the eight bits is caught and the byte dropped; an even number
// gets through as another character, which is how a weak signal used to
// turn the rest of a row green or into graphics. The magazine goes round
// for ever, and the decoder's header shows each page number as it passes
// until the one asked for comes; each time it comes again it brings the
// next subpage.

const W = 64, H = 128, COLS = 16, ROWS = 21, CW = 4, CH = 6, Y0 = 1, N = ROWS * COLS;
const { floor, min, round, sin, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Attribute bytes: A(c) letters and G(c) mosaics in colour c.
const A = (c) => c, G = (c) => 0x10 + c;
const FLASH = 0x08, STEADY = 0x09, NORMAL = 0x0c, DOUBLE = 0x0d, CONCEAL = 0x18;
const CONTIG = 0x19, SEP = 0x1a, BLACKBG = 0x1c, NEWBG = 0x1d, HOLD = 0x1e, RELEASE = 0x1f;
const RED = 1, GREEN = 2, YELLOW = 3, BLUE = 4, MAGENTA = 5, CYAN = 6, WHITE = 7;

// 3 by 5 letters for 0x20 to 0x7f in the English set (0x23 is a pound sign,
// 0x5b to 0x5e arrows and a half, 0x5f #, 0x7b to 0x7e quarters, a double
// bar and a division sign, 0x7f a block). Each digit is a row, top first,
// 4 the left LED and 1 the right; lower case has a sixth row for descenders.
const FONT = (
  "0 22202 55 34647 36236 51245 25253 22 12221 42224 0525 0272 00024 007 00002 11244 " +
  "75557 26227 71747 71317 55711 74717 74757 71222 75757 75717 0202 02024 12421 0707 42124 71202 " +
  "25743 25755 65656 34443 65556 74647 74644 34553 55755 72227 11152 55655 44447 57755 65555 25552 " +
  "65644 25563 65655 34216 72222 55557 55552 55775 55255 55222 71247 24742 45123 21712 27222 57575 " +
  "007 00357 44656 00343 11353 02563 12722 035316 44655 20222 101152 44565 62227 00775 00655 00252 " +
  "065644 035311 00344 00326 22723 00553 00552 00577 00525 055316 00623 44131 55555 66131 20702 77777"
)
  .split(" ")
  .map((s) => [0, 1, 2, 3, 4, 5].map((i) => +(s[i] || 0)));

// ---- Building pages -------------------------------------------------------

const blank = () => new Uint8Array(N).fill(0x20);

// Bytes and strings into row r from column c.
function put(p, r, c, ...items) {
  for (const it of items) {
    if (typeof it === "number") p[r * COLS + c++] = it;
    else for (const ch of it) p[r * COLS + c++] = ch.charCodeAt(0);
  }
}

// The mosaic byte for six sixels in reading order.
const MOS = [0x01, 0x02, 0x04, 0x08, 0x10, 0x40];
function mosaic(bits) {
  let b = 0x20;
  for (let i = 0; i < 6; i++) if (bits & (1 << i)) b |= MOS[i];
  return b;
}

// Paint a picture f(sx, sy) -> colour (0 for none), in sixels, into rows
// r0..r1 and columns c0..c1 the way a teletext artist had to: one colour to
// a cell and a cell for every change of colour. An empty cell before a new
// colour takes the attribute for nothing; a lit one is lost to it, and
// that is the gap. `pre` gives bytes to start each row with.
function paint(p, r0, r1, c0, c1, f, pre) {
  for (let r = r0; r <= r1; r++) {
    let c = c0, fg = -1;
    for (const b of pre ? pre(r) : []) {
      p[r * COLS + c++] = b;
      if (b > 0x10 && b < 0x18) fg = b - 0x10;
    }
    const want = [], bits = [];
    for (let k = c; k <= c1; k++) {
      const n = [0, 0, 0, 0, 0, 0, 0, 0], sc = [];
      for (let i = 0; i < 6; i++) sc.push(f(2 * k + (i & 1), 3 * r + (i >> 1)));
      for (const v of sc) n[v]++;
      let best = 0;
      for (let v = 1; v < 8; v++) if (n[v] && (!best || n[v] > n[best])) best = v;
      let b = 0;
      sc.forEach((v, i) => (b |= best && v === best ? 1 << i : 0));
      want.push(best);
      bits.push(b);
    }
    for (let k = c; k <= c1; k++) {
      const i = k - c, w = want[i], nx = want[i + 1] || 0;
      if (w && w !== fg) (p[r * COLS + k] = G(w)), (fg = w);
      else if (!w && nx && nx !== fg) (p[r * COLS + k] = G(nx)), (fg = nx);
      else p[r * COLS + k] = mosaic(w ? bits[i] : 0);
    }
  }
}

// Big numerals: the 3 by 5 font with every dot sw by sh sixels, from
// sixel (x0, y0), a digit every `pitch` sixels, each in its own colour.
function bigDigits(s, x0, y0, sw, sh, pitch, colours) {
  return (sx, sy) => {
    const d = floor((sx - x0) / pitch), cx = floor((sx - x0 - d * pitch) / sw), cy = floor((sy - y0) / sh);
    if (sx < x0 || cy < 0 || cy > 4 || d >= s.length || cx > 2) return 0;
    return (FONT[s.charCodeAt(d) - 32][cy] >> (2 - cx)) & 1 ? colours[d % colours.length] : 0;
  };
}

// The title band: a background across the row and a double-height word.
function title(p, bg, fg, word, sub) {
  put(p, 1, 0, A(bg), NEWBG, A(fg), DOUBLE, word);
  put(p, 1, 11, NORMAL, A(WHITE), sub);
}

// Fastext prompts along the bottom: the four other pages in red, green,
// yellow and cyan.
function prompts(p, page) {
  let c = 0, k = 0;
  for (let q = 1; q <= 5; q++) if (q !== page) put(p, 20, (c += 4) - 4, A([RED, GREEN, YELLOW, CYAN][k++]), q + "00");
}

// ---- The pages ------------------------------------------------------------
// Each page is its subpages in the order the magazine sends them.

const PAGES = [
  [
    // 100, 1/3: stripes over an index of the other pages.
    (p) => {
      title(p, BLUE, YELLOW, "LIGHT", "1/3");
      paint(p, 3, 10, 0, 15, (x, y) => ((x + y) % 8 < 6 ? [MAGENTA, GREEN, WHITE, YELLOW][floor((x + y) / 8) % 4] : 0));
      ["WAVE", "COLOUR", "NUMBER", "SHAPE"].forEach((w, i) => put(p, 12 + 2 * i, 0, A(YELLOW), w, A(CYAN)));
      for (let i = 0; i < 4; i++) put(p, 12 + 2 * i, 13, i + 2 + "01");
      prompts(p, 1);
    },
    // 2/3: the round in double-height block numerals.
    (p) => {
      title(p, MAGENTA, WHITE, "P100", "2/3");
      put(p, 4, 0, A(WHITE), "PATTERN ROUND");
      for (let r = 10; r <= 18; r += 2) paint(p, r, r, 0, 15, bigDigits("78", 6, 30, 4, 6, 14, [MAGENTA, GREEN]), () => [DOUBLE]);
      prompts(p, 1);
    },
    // 3/3: a ringed disc and a question with its answer concealed.
    (p) => {
      title(p, GREEN, BLUE, "SHAPE", "3/3");
      put(p, 4, 0, A(WHITE), "WHAT COLOUR?");
      paint(p, 6, 16, 0, 15, (x, y) => {
        const d = (x - 16) * (x - 16) + (y - 34) * (y - 34);
        return d < 144 ? (d < 49 ? YELLOW : RED) : 0;
      });
      put(p, 18, 0, A(CYAN), "ANSWER", A(RED), CONCEAL, "RED");
      prompts(p, 1);
    },
  ],
  [
    // 200: three waves, then a field of separated dots.
    (p) => {
      title(p, CYAN, RED, "WAVE", "1/2");
      paint(p, 4, 19, 0, 15, (x, y) => {
        for (let i = 0; i < 3; i++) if (Math.abs(y - 20 - 14 * i - 6 * sin(x / 4 + i)) < 2.6) return [YELLOW, MAGENTA, GREEN][i];
        return 0;
      });
      prompts(p, 2);
    },
    (p) => {
      title(p, RED, CYAN, "WAVE", "2/2");
      paint(p, 3, 19, 0, 15, (x, y) => ((x + floor(y / 6) * 3) % 8 < 3 ? (y < 34 ? CYAN : YELLOW) : 0), () => [SEP]);
      prompts(p, 2);
    },
  ],
  [
    // 300: colour bars, then each colour behind its opposite, the bands
    // that hold graphics run on without a gap where the hatch turns white.
    (p) => {
      title(p, BLUE, WHITE, "COLOUR", "1/2");
      for (let r = 3; r < 19; r++) {
        [WHITE, YELLOW, CYAN, GREEN, MAGENTA, RED, BLUE].forEach((k, i) => put(p, r, 2 * i, A(k), NEWBG));
        put(p, r, 14, BLACKBG);
      }
      prompts(p, 3);
    },
    (p) => {
      title(p, YELLOW, BLUE, "COLOUR", "2/2");
      [RED, GREEN, YELLOW, CYAN, BLUE, MAGENTA].forEach((k, i) => {
        for (let r = 3 + 2 * i; r < 5 + 2 * i; r++) {
          const pre = i & 1 ? [G(k), NEWBG, HOLD] : [G(k), NEWBG];
          paint(p, r, r, 0, 15, (x, y) => ((x + y) % 4 < 2 ? (x < 18 ? 7 - k : WHITE) : 0), () => pre);
        }
      });
      prompts(p, 3);
    },
  ],
  [
    // 400: numerals, one a subpage, the second in separated mosaics.
    (p) => {
      title(p, RED, YELLOW, "NUMBER", "1/3");
      paint(p, 4, 18, 0, 15, bigDigits("1", 10, 12, 4, 9, 14, [YELLOW]));
      prompts(p, 4);
    },
    (p) => {
      title(p, RED, YELLOW, "NUMBER", "2/3");
      paint(p, 4, 18, 0, 15, bigDigits("2", 10, 12, 4, 9, 14, [CYAN]), () => [SEP]);
      prompts(p, 4);
    },
    (p) => {
      title(p, RED, YELLOW, "NUMBER", "3/3");
      paint(p, 4, 18, 0, 15, bigDigits("3", 10, 12, 4, 9, 14, [MAGENTA]));
      prompts(p, 4);
    },
  ],
  [
    // 500: a triangle on a block, then rings.
    (p) => {
      title(p, MAGENTA, GREEN, "SHAPE", "1/2");
      paint(p, 3, 19, 0, 15, (x, y) => (y - 9 > Math.abs(x - 16) * 1.6 && y < 60 ? (y < 34 ? CYAN : RED) : 0));
      prompts(p, 5);
    },
    (p) => {
      title(p, BLUE, CYAN, "SHAPE", "2/2");
      paint(p, 3, 19, 0, 15, (x, y) => {
        const d = hypot(x - 16, y - 34);
        return floor(d / 3) % 2 === 0 && d < 16 ? [YELLOW, MAGENTA, YELLOW, GREEN, WHITE, BLUE][floor(d / 3)] : 0;
      });
      prompts(p, 5);
    },
  ],
].map((subs) =>
  subs.map((make) => {
    const p = blank();
    make(p);
    return p;
  }),
);

const NAME = "PATTERN";
// The magazine was at its page 52 when the set was switched on.
const START = 52;

// ---- Reception ------------------------------------------------------------

// A byte with its odd parity bit as bit 7.
function parity(b) {
  let n = 0;
  for (let i = 0; i < 7; i++) n += (b >> i) & 1;
  return n & 1 ? b : b | 0x80;
}

// One byte through the noise; -1 when the parity check catches it.
function receive(b, q) {
  if (q <= 0 || Math.random() >= q) return b;
  const u = Math.random(), n = u < 0.5 ? 1 : u < 0.85 ? 2 : 3;
  let v = parity(b), used = 0;
  for (let k = 0; k < n; ) {
    const bit = 1 << floor(Math.random() * 8);
    if (!(used & bit)) (used |= bit), (v ^= bit), k++;
  }
  return n & 1 ? -1 : v & 0x7f;
}

// ---- State ----------------------------------------------------------------

export function setup(params) {
  params.s = {
    want: -1, pos: 0, found: false, cycles: 0, wr: ROWS, mem: blank(), head: new Uint8Array(COLS).fill(0x20),
    size: 0, q: 0, speed: 2, reveal: false, flash: 0, dblRow: false, code: new Uint8Array(W * H),
  };
}

// A header going past: the page asked for, the page passing, the service.
function header(S, n) {
  const h = S.head;
  put(h, 0, 0, "P" + (S.want + 1) + "00", A(GREEN), S.want + 1 + String(n).padStart(2, "0"), A(YELLOW));
  for (let i = 0; i < NAME.length; i++) {
    const b = receive(NAME.charCodeAt(i), S.q);
    if (b >= 0) h[9 + i] = b;
  }
}

// The page asked for comes round: the decoder clears its page and writes
// the subpage in, each byte through the noise.
function arrive(S) {
  const subs = PAGES[S.want], src = subs[S.cycles % subs.length], m = S.mem;
  for (let i = COLS; i < N; i++) {
    const b = receive(src[i], S.q);
    m[i] = b < 0 ? 0x20 : b;
  }
  S.wr = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [1, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const page = cl(round(k[0] == null ? 1 : k[0]), 1, 5) - 1;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const z = cl(k[2] || 0, 0, 1);
  S.size = z < 1 / 3 ? 0 : z < 2 / 3 ? 1 : 2;
  const rx = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.q = 0.45 * rx * rx;
  if (input.btnPressed && input.btnPressed[0]) S.reveal = !S.reveal;
  if (page !== S.want) {
    S.want = page;
    S.found = false;
    header(S, START);
  }
  S.flash += d;
  const before = floor(S.pos);
  S.pos += d * S.speed * 20;
  for (let i = before + 1; i <= floor(S.pos); i++) {
    const n = (START + i) % 100;
    if (n === 0) {
      // The page address is Hamming coded, so only a heavier hit loses it.
      if (Math.random() >= S.q * S.q) {
        S.found = true;
        header(S, n);
        arrive(S);
      }
      S.cycles++;
    } else if (!S.found) header(S, n);
  }
  // The rows come in over 8 page slots, top first.
  if (S.wr < ROWS) S.wr = min(ROWS, S.wr + d * S.speed * 20 * (ROWS / 8));
}

// ---- Drawing --------------------------------------------------------------

// One cell: mode 0 a space, 1 a mosaic, 2 a letter; half 1 is the lower
// half of a double-height cell.
function cell(code, x0, y0, fg, bg, b, mode, sep, dbl, half) {
  for (let yy = 0; yy < CH; yy++) {
    const y = y0 + yy, gy = dbl ? (yy + half * CH) >> 1 : yy;
    for (let xx = 0; xx < CW; xx++) {
      let on = false;
      if (mode === 1) {
        on = (b & MOS[(gy >> 1) * 2 + (xx >> 1)]) !== 0;
        if (on && sep) on = (xx & 1) === 1 && (dbl ? (yy + half * CH) % 4 !== 3 : (gy & 1) === 0);
      } else if (mode === 2 && xx < 3) on = ((FONT[b - 32][gy] >> (2 - xx)) & 1) === 1;
      code[y * W + x0 + xx] = on ? fg : bg;
    }
  }
}

// Decode one row of bytes and draw it; true when it went double height.
function row(S, bytes, r, code) {
  let fg = WHITE, bg = 0, gfx = false, sep = false, hold = false, held = 0x20, heldSep = false;
  let dbl = false, conceal = false, flash = false, any = false;
  const y0 = Y0 + r * CH, lit = S.flash % 1 < 0.75, last = r === 0 || r === ROWS - 1;
  const show = (c, mode, b, s) => {
    const m = (conceal && !S.reveal) || (flash && !lit) || b === 0x20 ? 0 : mode;
    cell(code, c * CW, y0, fg, bg, b, m, s, dbl, 0);
    if (dbl) cell(code, c * CW, y0 + CH, fg, bg, b, m, s, true, 1);
    else if (S.dblRow) cell(code, c * CW, y0 + CH, fg, bg, b, 0, false, false, 0);
  };
  for (let c = 0; c < COLS; c++) {
    const b = bytes[c] & 0x7f;
    if (b >= 0x20) {
      if (gfx && b & 0x20) {
        held = b;
        heldSep = sep;
        show(c, 1, b, sep);
      } else show(c, 2, b, false);
      continue;
    }
    // Set-at: these act in this cell.
    if (b === STEADY) flash = false;
    else if (b === NORMAL) {
      if (dbl) held = 0x20;
      dbl = false;
    } else if (b === CONCEAL) conceal = true;
    else if (b === CONTIG) sep = false;
    else if (b === SEP) sep = true;
    else if (b === BLACKBG) bg = 0;
    else if (b === NEWBG) bg = fg;
    else if (b === HOLD) hold = true;
    if (hold && gfx) show(c, 1, held, heldSep);
    else show(c, 0, 0x20, false);
    // Set-after: these act from the next cell.
    if (b >= 1 && b <= 7) {
      if (gfx) held = 0x20;
      (gfx = false), (fg = b), (conceal = false);
    } else if (b >= 0x11 && b <= 0x17) {
      if (!gfx) held = 0x20;
      (gfx = true), (fg = b - 0x10), (conceal = false);
    } else if (b === FLASH) flash = true;
    else if (b === DOUBLE && !last) {
      if (!dbl) held = 0x20;
      dbl = any = true;
    } else if (b === RELEASE) hold = false;
  }
  return any;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const code = S.code;
  code.fill(0);
  S.dblRow = false;
  row(S, S.head, 0, code);
  for (let r = 1; r < S.wr && r < ROWS; r++) {
    const bytes = S.mem.subarray(r * COLS, r * COLS + COLS);
    // A row with double height in it covers the row under it as well.
    S.dblRow = r < ROWS - 1 && bytes.some((b) => (b & 0x7f) === DOUBLE);
    if (row(S, bytes, r, code)) r++;
  }
  for (let y = 0; y < H; y++) {
    const sy = S.size === 0 ? y : S.size === 1 ? y >> 1 : 64 + (y >> 1);
    for (let x = 0; x < W; x++) {
      const v = code[sy * W + x];
      display.setPixel(x, y, v & 1 ? 255 : 0, v & 2 ? 255 : 0, v & 4 ? 255 : 0);
    }
  }
}
