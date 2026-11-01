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
    "....................NNNNNNNNNNN....................",
    ".........NNNNNNNNNNNUUUUUUUUUUNNNNNNNNNNNN.........",
    ".....NNNNUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUNNwN.....",
    "..NNNUUUUUUUUUUXXXXXXXXXXUUUUUUUUUUUUUUUUUUUUUNNN..",
    ".NUUUUUUUUUUUXXXXXXXXXXXXXXUUUUUUUUUUUUUUUUUUUUUUN.",
    "VNUUUUUUUUUUUUXXXXXXXXXXXXUUUUUUUUUXXXXXXXXXXUUXXNV",
    "VVMMMUUUUUUUUUUUUUUUUUUUUUUUUUUUUUXXXXXXXXXXXXMMMVV",
    "VVVVVMMMMUUUUUUUUUUUUUUUUUUUUUUUUUUXXXXXXXMMMMVVVVV",
    "VVVVVVVVVMMMMMMMMMMMUUUUUUUUUUUMMMMMMMMMMMVVVVVVwVV",
    "VVVVVVVVVVVVVVVVVVVVMMMMMMMMMMMVVVVVVVVVVVVVVVVVVVV",
    "XXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVXX",
    "..XXXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVXXX..",
    ".....XXXXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVXXXX.....",
    ".........XXXXXXXXXXXVVVVVVVVVVVXXXXXXXXXXX.........",
    "....................XXXXXXXXXXX....................",
  ] },
  staff: { x: 54, y: 3, rows: [
    "...nnnw...",
    "..nn..mmm.",
    "onm.....mm",
    "onm.....nm",
    "onm.....nm",
    "onm.....om",
    "onm.....o.",
    "onm.....o.",
    "onm.....o.",
    "onm...onno",
    "onm...offo",
    "onm...offo",
    "onm...ogfo",
    "onm...oggo",
    "onm...onno",
    "onm....oo.",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "onm.......",
    "oom.......",
    "ooo.......",
  ] },
  hairback: { x: 3, y: 8, rows: [
    ".............zJ................",
    "...........zJJjjj..............",
    "..........zJJjjjjj.............",
    ".........zJJjjjjjjjjj..........",
    "........zJJjjjjiiijjjjjj.......",
    "........zJJjjjjiiijjjjjjjj.....",
    ".......zJJjjjjiiiijjjjjjjjj....",
    ".......zJJjjjjiiijjjjjjjjjjj...",
    "......zJJjjjjiiiijjjjjjjjjjjj..",
    "......zJJjjjiiiijjjjjjjjjjjjj..",
    ".....zJJjjjhhiijjjjjjjjjjjjjjj.",
    "....zKKjjjjhhiijjjjjjjjjjjjjjj.",
    "....zKKkjjhhiijjjjjjjjjjjjjjjj.",
    "...zKKkkjhhiiijjjjjjjjjjjjjjjj.",
    "...zKKkjjhiiijjjjjjjjjjjjjjjjjj",
    "..zKKkkjjiiijjjjjjjjjjjjjjjjjjj",
    "..zKKkkjjiiijjjjjjjjjjjjjjjjjjj",
    ".zKKkkjjiiikjjjjjjjjjjjjjjjjjjj",
    ".zKKkkjhiiikkjjjjjjjjjjjjjjjjj.",
    ".zKKkjjhiikkkkjjjjjjjjjjjjjjjj.",
    ".zKKkjhhiikkkkkjjjjjjjjjjjjjjj.",
    ".zKKkjhii.zKKkkkjjjjjjjjjjjjjj.",
    ".zKKjjhii..zKKkkjjjjjjjjjjjjj..",
    "zKKkjjii...zKKkkkjjjjjjjjjjjj..",
    "zKKkjjii....zKKkkkjjjjjjjjjj...",
    "zKKjjji......zKKkkkjjjjjjjj....",
    "zKKjjii.......zKKkkkjjjjjj.....",
    "zKKjji..........zKKkkjjj.......",
    "zKJjji.............zk..........",
    "zKJjj..........................",
    "zJJjj..........................",
    ".jjj...........................",
  ] },
  tailtip: { x: 3, y: 34, rows: [
    ".jjj..",
    "zKjjj.",
    "zKKji.",
    "zKKji.",
    "zKKji.",
    "zKKji.",
    ".zKJi.",
    ".zKJi.",
    "..zJi.",
    "..zJi.",
    "..zJJ.",
    "...zJ.",
    "....zk",
    ".....z",
  ] },
  armfar: { x: 38, y: 44, rows: [
    ".qqqp...............",
    "qqqqpp..............",
    "qqqqqpp.............",
    "qqqqqqpp............",
    "qqqqqqqp............",
    ".qrrqqqqq......bbbb.",
    ".qrrrqqqqp..ssbbaaaa",
    "..rrrqqqqpssssbbaaaa",
    "...rrrqqqqsssbcccaab",
    "....rrrqqqsssbbcbbbb",
    "....rrrqqqssssccbbbb",
    ".....rrrqqqsssccccc.",
    "......rrrrrrrr......",
    ".......rrrrr........",
    "........rrr.........",
  ] },
  legs: { x: 23, y: 80, rows: [
    "..jjjjj.....jjjjj................",
    ".jjjjjjj...jjjjjjj...............",
    "jjjjjjjjj..jjjjjjj...............",
    "jjjjjjjjj.jjjjjjjjj..............",
    "jjjjjjjjj.jjjjjjjjj..............",
    "kkkjjjjjj..kkjjjjjj..............",
    "kkkjjjjjj..kkjjjjjjj.............",
    "zKKjjjjii..kkjjjjjij.............",
    "zKKjjjjii...zKJjjjii.............",
    "zKKjjjjii...zKJjjjiij............",
    "ziiiiiiii....ziiiiiij............",
    "zKKkkkkkk....zKKkkkkij...........",
    "zKKjjjhiw....zKKjjjiij...........",
    "zKKjjjhii.....zKJjjjii...........",
    "zKKjjjhii.....zKJjjjiii..........",
    "zKKjjjhii.....zKJjjjjii..........",
    "zKKjjjhii......zKJjjjii..........",
    "zKKjjjhii......zKJjjjjii.........",
    "zKKjjjhii.......zKJjjjii.........",
    ".zKJjjhi........zKJjjhii.........",
    ".zKJjjhi........zKJjjhhwi........",
    ".zKJjjhi.........zKJjjhii........",
    ".zKJjjhi.........zKJjjhii........",
    ".zKJjjji..........zJJjhhii.......",
    ".zKJjjji..........zKJjjhii.......",
    ".zKJjjji..........zKJjjhii.......",
    ".zKJjjji...........zJJjjji.......",
    ".zKJjjji...........zKJjjjii......",
    ".zKJjjji...........zKJjjjji......",
    ".zKJjjjj............zJJjjji......",
    ".zJJjjjjjii.........zJJjjjjj.....",
    "..jjjjjjiiiii........jjjjjj......",
    ".jjjjjjjjiiijj.......jjjjjjjiii..",
    ".jjjjjjjjjjjjj.......jjjjjjiiiiij",
    "..kkkkjjjkkkk........jjjjjjjjiijj",
    "......kkk............kkjjjjjjjjkk",
    ".......................kkkkkkkk..",
  ] },
  skirt: { x: 13, y: 63, rows: [
    ".........rrrrrqqqqqqqqqqqqqqqq......",
    ".........rrrrrqqqqqqqqqqqqqqqq......",
    ".........rrrrrqqqqqqqqqqqqqqqq......",
    "........rrrrrrqqqqqqqqqqqqqppp......",
    "........rrrrrrqqqqqqqqqqqqqpppq.....",
    ".......rrrrrrrqqqqqqqqqqqqqpppq.....",
    ".......rrrrrrrqqqqqqqqqqqqqpppq.....",
    ".......zRRrrrrqqqqrqqqqqqqqpppp.....",
    "......zRRrrrrrqqqqrqqqqqqqqppppq....",
    "......zRRrrrrrqqqqrqqqqqqqqqpppq....",
    ".....zRRrrrrrrqqqqrqqqqqqqqqpppp....",
    ".....zRRrrrrrrqqqqrqqqqqqqqqpppp....",
    ".....zRRrrrrrrqqqqrrqqqqqqqqppppq...",
    "....zRRrrrrrrrqqqqrrqqqqqqqqppppq...",
    "....zRRrrrrrrrqqqqrrqqqqqqqqqpppp...",
    "....zRRrrrrrrrqqqqrrqqqqqqqqqpppp...",
    "...zRRrrrrrrrqqqqqrrqqqqqqqqqppppp..",
    "...zRRrrrrrrrqqqqqrrqqqqqqqqqppppp..",
    "..zRRrrrrrrrrqqqqqrrqqqqqqqqqppppp..",
    "..zRRrrrrrrrrqqqqqrrqqqqqqqqqppppp..",
    "..zRRrrrrrrrrqqqqqrrqqqqqqqqqqppppp.",
    ".zRRrrrrrrrrrqqqqqrrqqqqqqqqqqppppp.",
    ".zRRrrrrrrrrrqqqqqrrqqqqqqqqqqppppp.",
    "zTTssssssssssssqqqrrqqqqqqqqqqppppp.",
    "...............ssssssssssssssqpppppp",
    ".............................ssqqqqq",
  ] },
  torso: { x: 19, y: 39, rows: [
    "..........zQQqq...........",
    "......zQQqqqqqppppp.......",
    ".....zRRrqqqpppppppp......",
    "....zRRrrqqqppppppppp.....",
    "....zRRrrqqqqppppppppppp..",
    ".....zRRrqqqqqpppppqpppp..",
    ".rrrrrrrrqqqqqqqqqqqppppp.",
    ".rrrrrrrrqqqqqqqqqqqppppp.",
    ".rrrrrqssssssssssssqpppppp",
    "rrrrrrqqqqqqqqqqqrpqpppppp",
    "rrrrrrqqqqqqqqqqqrpqqppppp",
    "rrrrrrrqqqqqqqqqqrpqqppppp",
    "rrrrrrrqqqqqqqqqqrpqqppppp",
    ".rrrrrrqqqqqqqqqqrpqqpppp.",
    ".rrrrrrqqqqqqqqqqrpqqpppp.",
    ".zRRrrrqqqqqqqqqqrpqqpppp.",
    ".zRRrrrqqqqqqqqqqrpqqpppp.",
    ".zRRrrrqqqqqqqqqqqrpqpppp.",
    "..zRRrrrqqqqqqqqqqrpqpppp.",
    "..zRRrrrqqqqqqqqqqrpqpppp.",
    "..zRRrrrqqqqqqqqqqrpqppp..",
    "..zRRrrrqqqqqqqqqqrpqppp..",
    "..zRRrrrqqqqqqqqqqrpqppp..",
    "...zRRrrqqqqqqqqqqrpqppp..",
    "...rrrrrqqqqqqqqqqqqqppp..",
    "...rrrrrqqqqqqqqqqqqqppp..",
    "...rrrrrqqqqqqqqqqqqqppp..",
  ] },
  belt: { x: 22, y: 63, rows: [
    "kkkkkkkkkjjjjnnnjjjjjj",
    "kkkkkkkkkiiiinwoiiiiii",
    ".kkkkkkkkkkkknookkkkk.",
  ] },
  armnear: { x: 5, y: 44, rows: [
    "...............zQQ..",
    "..............zppqq.",
    "............zppppqqq",
    "...........zppppqqqq",
    "..........zpppqqqqqq",
    "........zppppqqqqqqq",
    ".......zpppqqrrqqqq.",
    "......zpppqqrrrqqq..",
    "....zppppqqrrrqqq...",
    "...zpppqqqrrrqq.....",
    "..zpppqqqrrrqq......",
    ".zQQqqqqrrrr........",
    "zQQqqqrrrrr.........",
    "zQQqqrrrq...........",
    "zQQqqrrqqq..........",
    ".zQQqrqqqqq.........",
    "..zRRqqqqsss........",
    "...zRRqqssqqq.......",
    "....zRRqssqqqs......",
    "......zTTssqssbbb...",
    ".......zTTsssbbaaaa.",
    "........zTTsbbbaaaaa",
    ".........zTTbbbaaab.",
    "...........zccbbbbb.",
    "............zccccc..",
    "..............ccc...",
  ] },
  neck: { x: 29, y: 35, rows: [
    "cccccc",
    "cccccc",
    "dddddd",
    "dddddc",
    "cccccc",
    "cccccc",
    "cccccc",
    "cccccc",
  ] },
  head: { x: 26, y: 16, rows: [
    ".......bbbbbbb.......",
    ".....bbbbbbbbbbb.....",
    "....bbbbbbbbbbbbb....",
    "...bbbbbbbbbbbbbbb...",
    "..cccbbbbccbbbccbcc..",
    ".cccccbccbbbbbbbbbbb.",
    ".cccccbbbbbbbbbbbbba.",
    "ccccccbbbbbbbbbxxxbaa",
    "ccccccbxxxxbbbxbbbxaa",
    "ccccccxbbbbbbbbbbbbaa",
    "ccccccbxxxxbbbbxxxbaa",
    "ccccccbaxxabbbbxxabaa",
    "cccccccaxxgbbbbxxgaaa",
    "cccccccagggbbbbgggaaa",
    ".cccccccggbbbbbbgbaa.",
    ".cccccccbbbbbbbbbbaaa",
    "..ccccccbbbbbbbbbbbc.",
    "...ccccccbbbbbbbbbb..",
    "....ccccccbbbbbdbb...",
    ".....ccccccbcddbb....",
    ".......cccccccccc....",
    ".........ccccccc.....",
  ] },
  hairfront: { x: 16, y: 4, rows: [
    ".........zQQqqqqqqppp..............",
    ".....zQQqqqqqqqqppppppppp..........",
    "...zRRqqqqqqqqqpppppppppppp........",
    "..zRRrqqqqqqqqqppppppppppppp.......",
    ".rrrrrqqqqqqqqqpppppppppppppp......",
    "rrrrrrqqqqqqqqqqppppppppppppqq.....",
    "rrrrrrrrrqqqqqqqqqqppppppqqqqq.....",
    "rrrrrrrrrrrrrrqqqqqqqqqqqqqqqq.....",
    "rrrrrrrrrrrrrrqqqqqqqqpppppppppppp.",
    "rrrrrrrrrrrrrrqqqqqqqqppppppppppqqq",
    ".ssssssssssssskkkkkkkkkkkkkkkkkqqqq",
    "..............kkkkkkkkkkkkkkkkkssss",
    "...............jjjjjjjjjjjjjjjj....",
    "........k......jjjjjjjjjjiiiiii....",
    "........kkjjjii.jjjjjjjjjihhhii....",
    "........kkjjjii.jjjjjjjjjiiiiii....",
    "........kkjjjii..jj..jjj..i..ii....",
    "........kkjjjii.......j...i........",
    "........kkjjjii....................",
    "........kkjjjii....................",
    "........kkjjjii....................",
    ".........kjjji.....................",
    ".........kjjji.....................",
    ".........kjjji.....................",
    ".........kkjji.....................",
    ".........kkjji.....................",
    ".........kkjji.....................",
    ".........kkjji.....................",
    "..........kjj......................",
    "..........kjj......................",
    "..........jjj......................",
    "...........jj......................",
  ] },
};
const ORDER = ["base", "staff", "hairback", "tailtip", "armfar", "legs", "skirt", "torso", "belt", "armnear", "neck", "head", "hairfront"];
// Which breath each part follows: 0 stays, 1 the chest, 2 the head a beat later, 3 the ponytail's end.
const GROUP = {"base": 0, "staff": 0, "hairback": 2, "tailtip": 3, "armfar": 1, "legs": 0, "skirt": 0, "torso": 1, "belt": 0, "armnear": 1, "neck": 1, "head": 2, "hairfront": 2};
// The eyes half shut and shut, laid over the head.
const LIDS = {
  half: { x: 33, y: 26, rows: [
    "bbbb....bbb",
    "xxxx....xxx",
  ] },
  shut: { x: 33, y: 26, rows: [
    "bbbb....bbb",
    "bbbb....bbb",
    "bbbb....bbb",
    "xxxx....xxx",
    "bbbb....bbb",
  ] },
};
const PAL = { a: 0xf9e1d1, b: 0xe9b9a8, c: 0xcb8b86, d: 0xa0606b, h: 0xe3a3c6, i: 0xb267a9, j: 0x764492, k: 0x423276, p: 0x9edfc6, q: 0x50ada2, r: 0x267b80, s: 0x005362, m: 0xf7e8b3, n: 0xd6b075, o: 0x9e7a60, U: 0x5f74a3, V: 0x464c7f, X: 0x3b2f61, f: 0xffefaf, g: 0xfdae3a, w: 0xfffaf0, z: 0x8cccff, e: 0xe2dcec, N: 0xd6b075, M: 0xf7e8b3, x: 0x3b2f61, K: 0x423276, R: 0x267b80, T: 0x005362, J: 0x764492, Q: 0x50ada2 };
// Knob 4: the editions, each a hand-picked repaint of some materials.
const EDITIONS = [
  {  },
  { p: 0xfcb6a4, q: 0xdf6f71, r: 0xab4660, s: 0x752d4f, h: 0x90c3d9, i: 0x2e89b8, j: 0x005d97, k: 0x1c3c73, K: 0x1c3c73, R: 0xab4660, T: 0x752d4f, J: 0x005d97, Q: 0xdf6f71 },
  { p: 0xeae8e0, q: 0xadb7c0, r: 0x77828e, s: 0x4c5564, h: 0xf2e2a9, i: 0xd7b06d, j: 0xaf7c4d, k: 0x7e4d38, a: 0xf8dec6, b: 0xe1b198, c: 0xbc8374, d: 0x8f5a58, K: 0x7e4d38, R: 0x77828e, T: 0x4c5564, J: 0xaf7c4d, Q: 0xadb7c0 },
  { a: 0xe6e2df, b: 0xc4c0be, c: 0x999593, d: 0x706c6a, h: 0xb9b5b3, i: 0x84807e, j: 0x5c5957, k: 0x403d3b, p: 0xd5d1ce, q: 0xa19d9b, r: 0x726f6d, s: 0x4e4b49, m: 0xede7e3, n: 0xbbb5b1, o: 0x86807d, f: 0xede7e3, g: 0xbbb5b1, e: 0xdbd6d4, x: 0x494644, K: 0x403d3b, R: 0x726f6d, T: 0x4e4b49, J: 0x5c5957, Q: 0xa19d9b },
];
// Knob 2: the stands.
const STANDS = [
  { U: 0xb2815f, V: 0x8d5541, X: 0x67332f, N: 0xcea378, M: 0xe0c29b },
  { U: 0xd5d7dd, V: 0xa9abb2, X: 0x797c84, N: 0xb5b5c0, M: 0xe1e2e8 },
  {  },
  { U: 0x00658c, V: 0x00bcd9, X: 0x0084a8, N: 0x7de1ed, M: 0xc1f8f9 },
];
// Knob 1: the gels on the rim light, with the shadow-side bounce they tint.
const GELS = [
  {  },
  { z: 0xfb6acd, K: 0x74266e, R: 0x7b4c89, T: 0x5f376b, J: 0x9f3d88, Q: 0x9f87b9 },
  { z: 0x81ef7e, K: 0x004d41, R: 0x297554, T: 0x005742, J: 0x006c6f, Q: 0x5ab788 },
  { z: 0xffbf5d, K: 0x7c343b, R: 0x866139, T: 0x6e3f2a, J: 0xa04657, Q: 0x98a76d },
];
// The wink on the hook: x, y and what the LED turns into.
const GLINT = [[60, 3, "w"], [59, 3, "w"], [61, 4, "w"]];
// The case light: what a glossy character turns into while the band passes.
const UP = {"j": "i", "J": "i", "i": "h", "k": "j", "K": "j", "n": "m", "o": "n", "N": "M"};

const { floor, min, max } = Math;
// The events run on a fixed 25 s loop. Blinks come 2.2 to 4.2 s apart, the
// case light every 7.8 to 9.4 s, taking 2.4 s to cross, the glint on the hook every 6 or more; none
// falls between 1.5 and 2.5 s, where the still is taken.
const CYCLE = 25;
const BLINKS = [0.9, 3.4, 6.1, 8.3, 11.9, 14.6, 16.9, 20.4, 23.1];
const SWEEPS = [4.6, 12.4, 20.2];
const GLINTS = [3.0, 9.6, 15.8, 22.0];
const SWEEP_LEN = 2.4;
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
        if (s >= 0 && s < 6) {
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

  // The case light passes over the gloss above the stand; the boots and the stand keep still.
  for (let n = 0; n < ORDER.length; n++) {
    const name = ORDER[n];
    blit(buf, PARTS[name], 0, off[GROUP[name]], sweep && name !== "legs" && name !== "base", band);
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
