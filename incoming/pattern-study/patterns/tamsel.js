// ===== Patternflow pattern =====
// Title:   Tamsel
// Family:  pixel
// Idea:    A hand-pixelled figure of Tamsel, a fourteen-year-old apprentice lamplighter, standing on a display stand that fills the panel: plum ponytail under a teal cap, long teal work coat, tall plum boots, one hand on her hip and the other on a brass lighting pole taller than she is, its hook hanging a little cage of flame over her head. She breathes, blinks, and now and then the case light runs across the gloss.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 85
// Round:   85
// ===============================
// @matrix 64x128
// @knobs Gel=0..1, Stand=0..3, Detail=0..1, Edition=0..1
//
// Knob 1: Gel. The colour of the rim light down her left edges and of the bounce it throws into the shadows next to it: sky blue at 0, magenta from 0.25, green from 0.5, amber from 0.75.
// Knob 2: Stand. What she stands on: a turned wood plinth at 0, white marble from 1, black acrylic with a gold rim from 2, and from 3 an acrylic disc lit from its edge.
// Knob 3: Detail. Below 0.5 the whole figure; from 0.5 her head and chest at exactly twice the size, the way a box shows a close-up.
// Knob 4: Edition. The paint: the standard colours below 0.25, the second-player colours from 0.25, a gold and silver limited plating from 0.5, and from 0.75 the unpainted grey prototype.
// Buttons: K1 tap sends the case light across her; K2 tap makes the brass on her hook wink.

const W = 64, H = 128;
// Each part is a grid, one character per LED and "." where it is clear, drawn
// in ORDER. Materials run light to dark: skin a b c d, hair and boots h i j k,
// coat and cap p q r s, brass m n o. U V X N M are the stand, z the rim light,
// w the specular, f g the flame, e the whites of the eyes, x the pupils.
const PARTS = {
  base: { x: 6, y: 110, rows: [
    "....................UUUUUUUUUUU....................",
    ".........UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU.........",
    ".....UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU.....",
    "..UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU..",
    ".UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU.",
    "VUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUV",
    "VVUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUVV",
    "VVVVVUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUVVVVV",
    "VVVVVVVVVUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUVVVVVVVVV",
    "VVVVVVVVVVVVVVVVVVVVUUUUUUUUUUUVVVVVVVVVVVVVVVVVVVV",
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "..VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV..",
    ".....VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV.....",
    ".........VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV.........",
    "....................VVVVVVVVVVV....................",
  ] },
  staff: { x: 54, y: 4, rows: [
    "...mmmmm..",
    "..nnnnnmmm",
    ".onnnoooom",
    ".nnn....oo",
    "onn......o",
    "onm......o",
    "onm......m",
    "oom.....nm",
    ".omm..oooo",
    ".onm..gggg",
    ".onm..gggg",
    ".onmm.gggg",
    ".onnm.gggg",
    ".onnm.gggg",
    ".onnm.gggg",
    ".onnm.gggg",
    ".onnm.gggg",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".onnm.....",
    ".oonm.....",
    "..oo......",
  ] },
  hairback: { x: 3, y: 9, rows: [
    ".............iiii...............",
    "...........kiiiiiiiiiiiii.......",
    "..........kijjjjiiiiiiiiiii.....",
    "..........kjjjjjjjjjjjjjiiii....",
    ".........kjjjjjjjjjjjjjjjjiii...",
    "........kjjjjjjjjjjjjjjjjjjiii..",
    "........kjjjjjjjjjjjjjjjjjjjii..",
    ".......kjjjjjjjjjjjjjjjjjjjjjii.",
    ".......jjjjjjjjjjjjjjjjjjjjjjii.",
    "......kjjjjjjjjjjjjjjjjjjjjjjji.",
    ".....kjjjjjjjjjjjjjjjjjjjjjjjjii",
    ".....kjjjjjjjjjjjjjjjjjjjjjjjjii",
    "....kjjjjjjjjjjjjjjjjjjjjjjjjjji",
    "...kkjjjjjjjjjjjjjjjjjjjjjjjjjji",
    "...kkjjjjjjjjjjjjjjjjjjjjjjjjjji",
    "..kkkjjjjjjjjjkjjjjjjjjjjjjjjjji",
    "..kkkjjjjjjjjkkkjjjjjjjjjjjjjjji",
    ".kkkkjjjjjjjkkkkjjjjjjjjjjjjjjji",
    ".kkkkjjjjjjkkkkkkjjjjjjjjjjjjjj.",
    ".kkkjjjjjjkkkkkkkkjjjjjjjjjjjji.",
    ".kkkjjjjjj.kkkkkkkkjjjjjjjjjjji.",
    ".kkkjjjjj...kkkkkkkkkjjjjjjjjk..",
    ".kkkjjjji...kkkkkkkkkkkkkkkkkk..",
    ".kkkjjjj.....kkkkkkkkkkkkkkkk...",
    "kkkkjjji......kkkkkkkkkkkkkk....",
    "kkkkjjj........kkkkkkkkkkkk.....",
    "kkkkjji..........kkkkkkkk.......",
    "kkkkkj..........................",
    "kkkkki..........................",
  ] },
  tailtip: { x: 3, y: 38, rows: [
    "kkkkk",
    "kkkkk",
    "kkkkk",
    ".kkkk",
    ".kkk.",
    ".kkk.",
    "..kk.",
    "..kk.",
  ] },
  armfar: { x: 38, y: 44, rows: [
    ".rppp.................",
    "rrqqpp................",
    "rrqqqpp...............",
    "rrrqqqpp..............",
    "rrrqqqqp..............",
    ".rrrqqqpp.......aaaaa.",
    ".rrrrqqqpp...ppcbbbbaa",
    "..rrrrqqqpppqqpcbbbbba",
    "...rrrqqqqqqqqpcbbbbba",
    "....rrrqqqqqqqpccbbbba",
    "....rrrrqqqqqqpccccccc",
    ".....rrrrqqqqqrrccccc.",
    "......rrrrqqrrr.......",
    ".......rrrrrr.........",
    "........rrr...........",
  ] },
  legs: { x: 23, y: 80, rows: [
    "..iiiii.....kiiii................",
    ".kjjjjii...kjjjjii...............",
    "kkjjjjjii..kjjjjji...............",
    "kkjjjjjji.kkkjjjjii..............",
    "kkjjjjjji.kkkjjjjji..............",
    "kkjjjjjji..kkjjjjji..............",
    "kkjjjjjji..kkkjjjjii.............",
    "kkjjjjjji..kkkjjjjji.............",
    "kkjjjjjji...kkkjjjji.............",
    "kkjjjjjji...kkkjjjjii............",
    "kkjjjjjji....kkjjjjji............",
    "kkjjjjjji....kkkjjjjii...........",
    "kkjjjjjji....kkkjjjjji...........",
    "kkjjjjjji.....kkjjjjji...........",
    "kkjjjjjji.....kkkjjjjii..........",
    "kkjjjjjji.....kkkjjjjji..........",
    "kkjjjjjji......kkkjjjji..........",
    "kkkjjjjji......kkkjjjjii.........",
    "kkkjjjjji.......kkjjjjji.........",
    ".kkjjjjj........kkkjjjji.........",
    ".kkjjjji........kkkjjjjii........",
    ".kkjjjji.........kkkjjjji........",
    ".kkjjjji.........kkkjjjji........",
    ".kkjjjji..........kkjjjjii.......",
    ".kkjjjji..........kkkjjjji.......",
    ".kkjjjji..........kkkjjjji.......",
    ".kkjjjji...........kkjjjji.......",
    ".kkjjjji...........kkkjjjii......",
    ".kkjjjji...........kkkjjjji......",
    ".kkkjjji............kkkjjji......",
    ".kkjjjjiiii.........kkkjjjii.....",
    "..kjjjjjjjiii........kkjjjj......",
    ".kkkjjjjjjjjii.......kkjjjiiiii..",
    ".kkkkkkkjjkkkk.......kkjjjjjjjiii",
    "..kkkkkkkkkkk........kkkkjjjjjjjk",
    "......kkk............kkkkkkkkkkkk",
    ".......................kkkkkkkk..",
  ] },
  skirt: { x: 13, y: 63, rows: [
    ".........kkkkkkkkkkkkkkkkkkkkkk.....",
    ".........kkkkkkkkkkkkkkkkkkkkkk.....",
    ".........kkkkkkkkkkkkkkkkkkkkkk.....",
    "........rrqqqqqqqqqqqqqqqqqqqq......",
    "........rrqqqqqqqqqqqqqqqqqqqpp.....",
    ".......rrqqqqqqqqqqqqqqqqqqqqpp.....",
    ".......rrqqqqqqqqqqqqqqqqqqqqqp.....",
    ".......rrqqqqqqqqqqqqqqqqqqqqqp.....",
    "......rrqqqqqqqqqqqqqqqqqqqqqqpp....",
    "......rrqqqqqqqqqqqqqqqqqqqqqqpp....",
    ".....rrrqqqqqqqqqqqqqqqqqqqqqqqp....",
    ".....rrqqqqqqqqqqqqqqqqqqqqqqqqp....",
    ".....rrqqqqqqqqqqqqqqqqqqqqqqqqpp...",
    "....rrqqqqqqqqqqqqqqqqqqqqqqqqqpp...",
    "....rrqqqqqqqqqqqqqqqqqqqqqqqqqqp...",
    "....rrqqqqqqqqqqqqqqqqqqqqqqqqqqp...",
    "...rrqqqqqqqqqqqqqqqqqqqqqqqqqqqpp..",
    "...rrqqqqqqqqqqqqqqqqqqqqqqqqqqqpp..",
    "..rrqqqqqqqqqqqqqqqqqqqqqqqqqqqqqp..",
    "..rrrrrrrrrrrrrrrrrqqqqqqqqqqqqqqp..",
    "..rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrpp.",
    ".rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.",
    ".rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.",
    "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.",
    "...............rrrrrrrrrrrrrrrrrrrrr",
    ".............................rrrrrrr",
  ] },
  torso: { x: 19, y: 38, rows: [
    "............p.............",
    ".......rrppppppppp........",
    ".....rrrpppqpppppppp......",
    "....rrrqqqqqqqqqqpppp.....",
    "....rrrqqqqqqqqqqqqpp.....",
    "....rrqqqqqqqqqqqqqqpppp..",
    ".....qqqqqqqqqqqqqqqpppp..",
    ".rrrqqqqqqqqqqqqqqqqqqqpp.",
    ".rrrqqqqqqqqqqqqqqqqqqqpp.",
    ".rrrrqqqqqqqqqqqqqqqqqqqpp",
    "rrrrrqqqqqqqqqqqqqqqqqqqpp",
    "rrrrrqqqqqqqqqqqqqqqqqqqqp",
    "rrrrrqqqqqqqqqqqqqqqqqqqqp",
    "rrrrrqqqqqqqqqqqqqqqqqqqqp",
    ".rrrrrqqqqqqqqqqqqqqqqqqq.",
    ".rrrrrqqqqqqqqqqqqqqqqqqp.",
    ".rrrrrqqqqqqqqqqqqqqqqqqp.",
    ".rrrrrqqqqqqqqqqqqqqqqqqp.",
    ".rrrrrrqqqqqqqqqqqqqqqqqp.",
    "..rrrrrqqqqqqqqqqqqqqqqqp.",
    "..rrrrrqqqqqqqqqqqqqqqqqp.",
    "..rrrrrqqqqqqqqqqqqqqqqq..",
    "..rrrrrqqqqqqqqqqqqqqqqp..",
    "...rrrrrrrrrrrrrrrrrrrrr..",
    "...rrrrrrrrrrrrrrrrrrrrr..",
    "...rrrrrrrrrrrrrrrrrrrrr..",
    "...rrrrrrrrrrrrrrrrrrrrr..",
    "...rrrrrrrrrrrrrrrrrrrrr..",
  ] },
  armnear: { x: 5, y: 44, rows: [
    "...............ppp..",
    "..............qqqpp.",
    "............pqqqqqpp",
    "...........qqqqqqqqp",
    "..........qqqqqqqqqp",
    "........pqqqqqqqqqqr",
    ".......qqqqqqqqqqqr.",
    "......qqqqqqqqqqrr..",
    "....pqqqqqqqqqqrr...",
    "...qqqqqqqqqqrr.....",
    "..qqqqqqqqqqrr......",
    ".rqqqqqqqqrr........",
    "rrqqqqqqqqr.........",
    "rrrqqqqqq...........",
    "rrrrqqqqpp..........",
    ".rrrrqqqqpp.........",
    "..rrrrqqqqpp........",
    "...rrrrrqqqpp.......",
    "....rrrrrqqqpr......",
    "......rrrrqqqraaa...",
    ".......rrrrqcbbbaaa.",
    "........rrrrcbbbbba.",
    ".........rrrcbbbbba.",
    "...........rcccbbbc.",
    "............ccccccc.",
    "..............ccc...",
  ] },
  neck: { x: 29, y: 35, rows: [
    "cccccc",
    "cccccc",
    "cccccc",
    "cccccc",
    "cccccc",
    "cccccc",
    "cccccc",
    "cccccc",
  ] },
  head: { x: 25, y: 15, rows: [
    "........aaaaaa........",
    ".....aaaaaaaaaaaa.....",
    "....aaabbbbbbaaaaa....",
    "...cbbbbbbbbbbbbaaa...",
    "..cbbbbbbbbbbbbbbaaa..",
    ".ccbbbbbbbbbbbbbbbaaa.",
    ".ccbbbbbbbbbbbbbbbbaa.",
    ".ccbbbbbbbbbbbbbbbbba.",
    "cccbbbbbbbbbbbbbbbbbaa",
    "cccbbbbbbbbbbbbbbbbbaa",
    "ccccbbbbbbbbbbbbbbbbba",
    "ccccbbbbbbbbbbbbbbbbba",
    "ccccbbbbbbbbbbbbbbbbba",
    "cccccbbbbbbbbbbbbbbbba",
    ".cccccbbbbbbbbbbbbbbb.",
    ".ccccccbbbbbbbbbbbbba.",
    ".cccccccbbbbbbbbbbbbc.",
    "..cccccccccbbbbbbbbc..",
    "...ccccccccccbbbbbb...",
    "....cccccccccccccc....",
    ".....ccccccccccccc....",
    "........ccccccccc.....",
    "..........cccccc......",
  ] },
  hairfront: { x: 14, y: 4, rows: [
    ".............pppppppp.................",
    "........pppppppppppppppppp............",
    "......ppppppqqqqqqqqpppppppp..........",
    "....pppqqqqqqqqqqqqqqqqqqppppp........",
    "...rpqqqqqqqqqqqqqqqqqqqqqqpppp.......",
    "..rrqqqqqqrqqqqqqqqqqqqqqqqqqppp......",
    "..rrqqrrrrrrrrrqqqqqqqqqqqqqqqpp......",
    "..rrrrrrrrrrrrrrrqqqqqqqqqqqqqqp......",
    "..rrrrrrirrrrrrrrrrrrrrrrrrrrrrr.rrr..",
    "..rriiiiiiiiirrrrrrrrrrrrrrrrrrrrrrrr.",
    "..kiiiijiiiiiiirrrrrrrrrrrrrrrrrrrrrr.",
    ".kijjjjjjjjjiiiiiiiiiiiiiiiiiiirrrrrrr",
    ".kjjjjjjjjjjjjiiiiikkiiiiiiiiiir......",
    "kkjjjjjjjjjjjjjjjjkkkjjjjkjjjkki......",
    "kkkjjjjjjjjjjjjjjjkkkkjjkkkjkkkk......",
    "kkkjjjjjjjjjjjjjj..kkkjkkkkkkkkk......",
    "kkkkjjjjjjjjjjjji..kkkk.kkk..kkk......",
    ".kkkkkjjjjjjjjjj....kk...kk...........",
    ".kkkkkkkkkjkjjji....k.................",
    "..kkkkkkkkkkjjji......................",
    "....kkkkkkkkjjji......................",
    "........k.kkjjji......................",
    "..........kkkjji......................",
    "..........kkkjji......................",
    "..........kkkjj.......................",
    "...........kkji.......................",
    "...........kkji.......................",
    "...........kkki.......................",
    "...........kkki.......................",
    "...........kkkk.......................",
    "............kk........................",
    "............kk........................",
    ".............k........................",
  ] },
};
const ORDER = ["base", "staff", "hairback", "tailtip", "armfar", "legs", "skirt", "torso", "armnear", "neck", "head", "hairfront"];
// Which breath each part follows: 0 stays, 1 the chest, 2 the head a beat later, 3 the ponytail's end.
const GROUP = {"base": 0, "staff": 0, "hairback": 2, "tailtip": 3, "armfar": 1, "legs": 0, "skirt": 0, "torso": 1, "armnear": 1, "neck": 1, "head": 2, "hairfront": 2};
// The eyes half shut and shut, laid over the head.
const LIDS = {
  half: { x: 0, y: 0, rows: [
    ".",
  ] },
  shut: { x: 0, y: 0, rows: [
    ".",
  ] },
};
const PAL = { a: 0xf9e1d1, b: 0xe9b9a8, c: 0xcb8b86, d: 0xa0606b, h: 0xe3a3c6, i: 0xb267a9, j: 0x764492, k: 0x423276, p: 0x9edfc6, q: 0x50ada2, r: 0x267b80, s: 0x005362, m: 0xf7e8b3, n: 0xd6b075, o: 0x9e7a60, U: 0x5f74a3, V: 0x464c7f, X: 0x3b2f61, f: 0xffefaf, g: 0xfdae3a, w: 0xfffaf0, z: 0x8cccff, e: 0xe2dcec, N: 0xd6b075, M: 0xf7e8b3, x: 0x3b2f61 };
// Knob 4: the editions, each a hand-picked repaint of some materials.
const EDITIONS = [
  {  },
  {  },
  {  },
  {  },
];
// Knob 2: the stands.
const STANDS = [
  {  },
  {  },
  {  },
  {  },
];
// Knob 1: the gels on the rim light, with the shadow-side bounce they tint.
const GELS = [
  {  },
  {  },
  {  },
  {  },
];
// The wink on the hook: x, y and what the LED turns into.
const GLINT = [[60, 5, "w"]];
// The case light: what a glossy character turns into while the band passes.
const UP = {"j": "i", "i": "h", "k": "j", "n": "m", "o": "n", "N": "M", "V": "U"};

const { floor, min, max } = Math;
// The events run on a fixed 25 s loop. Blinks come 2.2 to 4.2 s apart, the
// case light every 7.8 to 9.4 s, the glint on the hook every 6 or more; none
// falls between 1.5 and 2.5 s, where the still is taken.
const CYCLE = 25;
const BLINKS = [0.9, 3.4, 6.1, 8.3, 11.9, 14.6, 16.9, 20.4, 23.1];
const SWEEPS = [4.6, 12.4, 20.2];
const GLINTS = [3.0, 9.6, 15.8, 22.0];
const SWEEP_LEN = 1.2;
const GLINT_LEN = 0.17;
// One breath is 3.2 s: the chest rises a pixel, the head follows a quarter
// second later and the ponytail's end a tenth after that, and both ends of the
// breath are held longer than the moves between them.
const BREATH = 3.2;
// The detail cut's top left corner, in figure LEDs.
const CUT_X = 20, CUT_Y = 3;

function since(list, t, len) {
  const u = t % CYCLE;
  for (let i = 0; i < list.length; i++) {
    const d = u - list[i];
    if (d >= 0 && d < len) return d;
  }
  return -1;
}

function lut(ed, stand, gel) {
  const t = new Int32Array(128).fill(-1);
  const put = (p) => {
    for (const ch in p) t[ch.charCodeAt(0)] = p[ch];
  };
  put(PAL);
  put(EDITIONS[ed]);
  put(STANDS[stand]);
  put(GELS[gel]);
  return t;
}

function blit(buf, part, dx, dy, sweep, band) {
  const rows = part.rows;
  for (let j = 0; j < rows.length; j++) {
    const y = part.y + j + dy;
    if (y < 0 || y >= H) continue;
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const ch = r.charCodeAt(i);
      if (ch === 46) continue;
      const x = part.x + i + dx;
      if (x < 0 || x >= W) continue;
      let c = ch;
      if (sweep) {
        const s = x + y * 0.5 - band;
        if (s >= 0 && s < 5) {
          const up = UP[r[i]];
          if (up) c = up.charCodeAt(0);
        }
      }
      buf[y * W + x] = c;
    }
  }
}

export function setup(params) {
  params.t = 0;
  params.buf = new Uint8Array(W * H);
  params.key = -1;
  params.sweepAt = -10;
  params.glintAt = -10;
  params.gel = 0;
  params.stand = 2;
  params.zoom = false;
  params.ed = 0;
}

export function update(dt, input, params) {
  if (!params.buf) setup(params);
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += min(dt || 0, 0.1);
  params.gel = min(3, max(0, floor(k[0] * 4)));
  params.stand = min(3, max(0, floor(k[1])));
  params.zoom = k[2] >= 0.5;
  params.ed = min(3, max(0, floor(k[3] * 4)));
  const b = input.btnPressed;
  if (b && b[0]) params.sweepAt = params.t;
  if (b && b[1]) params.glintAt = params.t;
}

export function draw(display, params) {
  const p = params;
  if (!p.buf) setup(p);
  const t = p.t;
  const key = p.ed * 16 + p.stand * 4 + p.gel;
  if (key !== p.key) {
    p.key = key;
    p.lut = lut(p.ed, p.stand, p.gel);
  }
  const buf = p.buf;
  buf.fill(0);

  const u = (((t - 1.5) % BREATH) + BREATH) % BREATH;
  const off = [0, u >= 1.1 && u < 2.7 ? -1 : 0, u >= 1.35 && u < 2.95 ? -1 : 0, u >= 1.45 && u < 3.05 ? -1 : 0];

  let sw = since(SWEEPS, t, SWEEP_LEN);
  if (t - p.sweepAt < SWEEP_LEN) sw = t - p.sweepAt;
  const sweep = sw >= 0;
  const band = -8 + (sw / SWEEP_LEN) * (W + H * 0.5 + 16);

  for (let n = 0; n < ORDER.length; n++) {
    const name = ORDER[n];
    blit(buf, PARTS[name], 0, off[GROUP[name]], sweep, band);
  }

  const db = since(BLINKS, t, 0.3);
  if (db >= 0) blit(buf, db < 0.08 || db >= 0.2 ? LIDS.half : LIDS.shut, 0, off[2], false, 0);

  let dg = since(GLINTS, t, GLINT_LEN);
  if (t - p.glintAt < GLINT_LEN) dg = t - p.glintAt;
  if (dg >= 0) {
    for (let i = 0; i < GLINT.length; i++) {
      const g = GLINT[i], at = g[1] * W + g[0];
      if (buf[at]) buf[at] = g[2].charCodeAt(0);
    }
  }

  const L = p.lut;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = p.zoom ? buf[(CUT_Y + (y >> 1)) * W + CUT_X + (x >> 1)] : buf[y * W + x];
      const c = ch ? L[ch] : -1;
      if (c < 0) display.setPixel(x, y, 0, 0, 0);
      else display.setPixel(x, y, (c >> 16) & 255, (c >> 8) & 255, c & 255);
    }
  }
}
