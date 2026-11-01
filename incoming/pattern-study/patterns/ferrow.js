// ===== Patternflow pattern =====
// Title:   Ferrow
// Family:  pixel
// Idea:    A hand-pixelled figure of Ferrow, an old sentinel robot that has kept the last gate of a fallen citadel alone for two hundred years, standing on a display stand that fills the panel: bone-white enamel plates over a gunmetal frame, two exhaust stacks behind the shoulder, an antenna swept back from the ear, amber eyes in a dark visor, a plum tabard at the waist, and a greatsword as tall as he is carried on the shoulder, its fuller glowing like iron just out of the forge. He breathes, his visor shutters blink, the tabard swings, and now and then the case light runs along the steel.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 86
// Round:   86
// ===============================
// @matrix 64x128
// @knobs Gel=0..1, Stand=0..3, Detail=0..1, Edition=0..1
//
// Knob 1: Gel. The colour of the rim light down his left edges and of the bounce it throws into the shadows beside it: sky blue at 0, magenta from 0.25, green from 0.5, warm white from 0.75.
// Knob 2: Stand. What he stands on: a turned wood plinth at 0, white marble from 1, black acrylic with a gold rim from 2, and from 3 an acrylic disc lit from its edge.
// Knob 3: Detail. Below 0.5 the whole figure; from 0.5 his head, chest and sword hand at exactly twice the size, the way a box shows a close-up.
// Knob 4: Edition. The paint: bone-white enamel below 0.25, the second-player black and teal from 0.25, a gold and chrome limited plating from 0.5, and from 0.75 the unpainted grey prototype.
// Buttons: K1 tap sends the case light along him; K2 tap makes the sword's point wink.

const W = 64, H = 128;
// Each part is a grid, one character per LED and "." where it is clear, drawn
// in ORDER. Materials run light to dark: enamel a b c d, gunmetal g h i j,
// tabard p q r s, blade steel m n o. C I R O are the shadow-side bounce next to
// the rim light z, which the gels recolour. f u v are the hot amber of the
// fuller and the eyes, x the dark of the visor, w the specular. U V X N are the stand.
const PARTS = {
  base: { x: 6, y: 111, rows: [
    ".............NNNNNNNNNNNNNNNNNNNNNNNNNN.............",
    "......NNNNNNNUUUUUUUUUUUUUUUUUUUUUUUUUUNNNNNNN......",
    "...NNNUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUNNN...",
    ".NNUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUNN.",
    "NUUUXXXXUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUN",
    "XNNUXXXXXXXXXXXXXXXXXXXXXXXXXXUUUUUUUUUUUUUUUUUUUNNV",
    "XXXNNNUUUUUUUUUUUUUUUUUUUUXXXXXXXXXXXXXXXXXXXXXXXVVV",
    "XXXXXXNNNNNNNUUUUUUUUUUUUUUUUUUUUUUUUUUNNNNNNNVVVVVV",
    "XXXXXXXVVVVVVNNNNNNNNNNNNNNNNNNNNNNNNNNVVVVVVVVVVVVV",
    "XXXXXXXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "XXXXXXXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "..XXXXXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV..",
    ".......VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV.......",
    ".................VVVVVVVVVVVVVVVVVV.................",
  ] },
  pack: { x: 8, y: 27, rows: [
    "..........z....",
    "......zxxxh....",
    "......zIIhhh...",
    "....z.zIIhhh...",
    "zxxxg.zIIhhh...",
    "zIIhggjjihihh..",
    "zIIhggjjihihh..",
    "zIIhgg.zIIhihh.",
    "zIIhgg.zIIhihh.",
    ".zIIgggjjihhgg.",
    ".zIIhggjjiihhgg",
    ".ziihggjjiihhgg",
    ".jjihhgg.......",
    ".jjihhgg.......",
    ".j.............",
  ] },
  blade: { x: 7, y: 2, rows: [
    "z..........................................",
    "zOOn.......................................",
    ".zOOoo.....................................",
    ".zOOnoooo..................................",
    ".zOOnnoooooo...............................",
    "..zOOnnoooooo..............................",
    "..zOOnnnoooooo.............................",
    "...zOOnnnoooooo............................",
    "...zmnnnnnoooooo...........................",
    "...zmmnnnnnoooooo..........................",
    "....zmmnnnnuoooooo.........................",
    "....zmmmnnuuuoooooo........................",
    ".....zmmmnnuuuoooooo.......................",
    "......zmmmnnuuuoooooo......................",
    ".......zmmmoouuuoooooo.....................",
    "........zmmnonuuuoooooo....................",
    ".........zmnmnnuuuoooooo...................",
    "..........zOmmnnuuuoooooo..................",
    "...........zmmmnnuuuoooooo.................",
    "............mmmmnnuufoooooo................",
    ".............mmmmnnfffooooooo..............",
    "..............mmmmnnfffooooooo.............",
    "...............mmmmnnfffooooooo............",
    "................mmmmnnfffooooooo...........",
    ".................mmmmnnfffooooooo..........",
    "..................mmmmnnfffooooooo.........",
    "...................mmmmnnfffooooooo........",
    "...................mmmmmnnfffooooooo.......",
    "....................mmmmmnnfffooooooo......",
    ".....................mmmmmnnfffooooooo.....",
    "......................mmmmmnnfffooooooo....",
    ".......................mmmmmnnfffooooooo...",
    "........................mmmmmnnfffooooooo..",
    ".........................mmmmmnnfffooooooo.",
    "..........................mmmmmnnfffooooooo",
    "...........................mmmmmnnfuuooooo.",
    "............................mmnnnnnuunooo..",
    ".............................mmmmnnnnnno...",
    "..............................mmmmmnnnn....",
    "...............................mmmmmnn.....",
    "................................mmmmm......",
    ".................................mmm.......",
    "..................................m........",
  ] },
  legfar: { x: 35, y: 75, rows: [
    "..jhg.................",
    ".jihhg................",
    "jjihhgg...............",
    "jjihhgg...............",
    "jjiihhgg..............",
    ".jjihhgh..............",
    ".jjiihhhg.............",
    ".jjiihhgg.............",
    "..jjiihhgg............",
    "..jjiihhgg............",
    "...jjihhgg...z........",
    "...jcccaaaaaaa........",
    "....cccaaaaaaaa.......",
    "....cccbbbbbbbb.......",
    "....cccbbbbbbbbb......",
    ".....ccbbbbbbbbb......",
    ".....ccbbbbbbbb.......",
    ".....ccbbbbbbb........",
    ".....zcbbbbbbb........",
    "....zCCcccabbbb.......",
    "....zCCcccabbbb.......",
    "....zCCcccabbbb.......",
    ".....zCCccabbbbb......",
    ".....zCCccabbbbb......",
    ".....zCCccabbbbb......",
    ".....zCCccabbbbb......",
    ".....zCCccabbbb.......",
    "......zCCcabbbb.......",
    "......zCCcabbbb.......",
    "......zCCdccccc.......",
    ".......zCCccccg.......",
    ".......zCCccccg.......",
    ".......zIIihhgg.......",
    "..zbbbbbbbbaaaaaaaa...",
    "..zCCccccccbbbbbbbbb..",
    "..zCCccccccbbbbbbbbb..",
    "..cccccccccbbbbbbbbbb.",
    "..cccccccccbbbbbbbbbbb",
    ".ccccccccccbbbbbbbbbbb",
    ".ccccccccccbbbbbbbbbbb",
    ".iiiiiiiiiihhhhhhhhhhh",
    ".jjjjjjjjjjjjjjjjjjjjj",
  ] },
  legnear: { x: 14, y: 75, rows: [
    "............jhg.....",
    "...........jihhg....",
    "..........jjihhgg...",
    "..........jjihhgg...",
    "..........jjihhgg...",
    "..........jjihhgg...",
    "..........jjjiiih...",
    "..........zIIiihh...",
    "..........zIhhhhh...",
    ".........zIIhhgh....",
    ".........zIIhhghh...",
    ".......zCCaaaaawb...",
    ".......zCCaaaaabb...",
    ".......zCCbbbbbccb..",
    ".......zCCbbbbbccb..",
    "........zCbbbbbcbb..",
    "........zCbbbbbcb...",
    "........zCbbbbcc....",
    "........zCbbbbcc....",
    "......zCCcccabccbb..",
    "......zCCcccabccbb..",
    "......zCCcccabcbbb..",
    "......zCCcccabbbbb..",
    "......zCCcccabbbbb..",
    "......zCCcccabbbbb..",
    "......zCCcccabbbbb..",
    "......zCCcccabbbb...",
    ".......zCCccabbbb...",
    ".......zCCccabbbb...",
    ".......zCCddccccc...",
    "........zCCdcccc....",
    "........zCCdcccc....",
    "........zIIihhgg....",
    ".zbbbbbbbaaaaaaaaa..",
    ".zCCcccccbbbbbbbbb..",
    ".zCCcccccbbbbbbbbbb.",
    ".zCCcccccbbbbbbbbbb.",
    "cccccccccbbbbbbbbbbb",
    "cccccccccbbbbbbbbbbb",
    "iiiiiiiiihhhhhhhhhhh",
    "jjjjjjjjjjjjjjjjjjjj",
  ] },
  spine: { x: 28, y: 59, rows: [
    "jjiihhhgg",
    "jjiihhhgg",
    "zIIjiiihh",
    "zIIjjjjjj",
    "zIIihhhgg",
    "zIIihhhgg",
    "zIIjjjjjj",
    "zIIihhhgg",
    "jjiihhhgg",
    "jjiihhhgg",
    "jjiihhhgg",
  ] },
  hips: { x: 18, y: 67, rows: [
    "..zIIgggggggggggggggggggggg....",
    "..zIIiiiiihhhhhhhhhhggggggg....",
    ".jjjiiiiihhhhhhhhhhhhggggggg...",
    "dddbbbbbbbbbbbhcccaaaaaaaaaa...",
    "dddbbbbbbbbbbb.cccaaaaaaaaaa...",
    "dddcccccccccdd.cccbbbbbbbbbbb..",
    "dddcccccccccdd.cccbbbbbbbbbbb..",
    "dddcccccccccdd.cccbbbbbbbbbbb..",
    "dddcccccccccd...ccbbbbbbbbbbbb.",
    "zCCcccccccccd...ccbbbbbbbbbbbb.",
    "zCCcccccccccd...ccbbbbbbbbbbbbb",
    ".zCCccccccccd...ccbbbbbbbbbbbbb",
    "...zCCddddddd...ccccccccccc....",
    "....zCCdddddd...cccccccc.......",
    ".....z.........................",
  ] },
  tabard: { x: 31, y: 70, rows: [
    ".rrqrqqppp.",
    ".rrqrqqppp.",
    ".rrqrqqppp.",
    ".rrqrqqppp.",
    ".rrqrqqppp.",
    ".zRqrqqppp.",
    ".zRqrqqppp.",
    ".zRqrqqppp.",
    "rrrqrqqpppp",
    "rrrqrqqpppp",
    "rrrqrqqpppp",
    "rrrqrqqpppp",
    "rrrqrqqpppp",
    "rrrqrqqpppp",
    "zRRqrqqpppp",
  ] },
  tabtip: { x: 30, y: 85, rows: [
    ".rrrqrqqqppp.",
    ".rrrqrqqqppp.",
    ".rrrqrqqqppp.",
    ".rrrqrqqqppp.",
    ".rrrqrqqqppp.",
    "rrrrqrrqqpppp",
    "rrrrqrrqqpppp",
    "rrrrqrrqqpppp",
    "rr..zRRqq..pp",
    "r....zRq....p",
    "......z......",
  ] },
  torso: { x: 17, y: 39, rows: [
    "........jjjiihhhhhgghhh.........",
    ".bbbbbbbjjjiihhhhhgggggbbaaaaa..",
    ".bbbbbbbbjjjjiiiiiggggabbbawaa..",
    ".bbbbbbbbjjjjiiiiiggggabbbaaaaa.",
    ".dddccccccccccciabbbbbbbccbbbbb.",
    "ddddccccccccccciabbbbbbbcbbbbbb.",
    "ddddccjjjjjjccciabbbbbbbbbbbbbbb",
    "ddddccccccccccciabbbbbbbbbbcbbbb",
    "ddddccccccccccciabbbbbcccbccbbb.",
    ".dddccjjjjjjccciabbbbccccbccdbb.",
    ".dddccccccccccciabbbbbbcbbccdb..",
    ".ddddddddddddddicccccccccccddd..",
    "..dddddddddddddicccccccccccdd...",
    "..zCCddddddddddiccccccccccccd...",
    ".....zIIiiiiihhhhhhhgggggg......",
    ".....zIIjjjjjjjjjjjjjjjjjj......",
    ".....zIIiiiiihhhhhhhgggggg......",
    "......zIIiiiiihhhhhhggggg.......",
    "......zIIjjjjjjjjjjjjjjjj.......",
    "......zIIiiiiihhhhhhggggg.......",
    ".......zIIiiiihhhhhggggg........",
    ".......zIIiiiihhhhhggggg........",
  ] },
  neck: { x: 28, y: 35, rows: [
    "jjiihhhgg",
    "jjiihhhgg",
    "jjiihhhgg",
    "zIijiiihh",
    "jjjjiiihh",
    "jjiihhhgg",
  ] },
  paulfar: { x: 42, y: 36, rows: [
    ".....a..........",
    "...aaaaaaaaa....",
    "..caaaaaaawaa...",
    "cccaaaaaaaaaaa..",
    "cccbbbbbbbbbbb..",
    ".ccbbbbbbbbbbbb.",
    ".ccbbbbbbbbbbbbb",
    "..cbbbbbbbbbbbbb",
    "..cbbbbbbbbbbbbb",
    "...ccbbbbbbbbbbb",
    "...ccbbbbbbbbbb.",
    "...ccbbbbbbbbbb.",
    "....jiiiiiiiiii.",
    "....jjiiiiiiiii.",
    ".....jjjjj......",
    ".....z..........",
  ] },
  armfar: { x: 48, y: 47, rows: [
    "..cccbb....",
    ".dcccbbb...",
    "ddcccbbba..",
    "ddcccbbba..",
    "dddddcbba..",
    "zCCddccbaa.",
    "zCCcdccbaa.",
    "zCCccccbaa.",
    ".zCCccccaa.",
    ".zCCccccaa.",
    ".zCCcbccaa.",
    "..zCCbbbaa.",
    "..zCCbbbaaa",
    "..zCCbbbaaa",
    "..zCCbbbaaa",
    "...zCbbbaa.",
    "....zbbba..",
    ".....zbb...",
  ] },
  paulnear: { x: 4, y: 36, rows: [
    ".........aaaaaaabb.....",
    "........baaaaaaawbb....",
    "......bbbaaaaaaaabbb...",
    ".....zbbbaaaaaaaaaaaa..",
    "...zCbbbbaaaaaaaaaaaaa.",
    "...zCbbbbbbbbbbbbbbbbbb",
    "..zCCccccccccccbbbbbbbb",
    "..zCCccccccccccbbbbbbbb",
    ".zCCdccccccccccbbbbbbbb",
    ".zCCdccccccccccbbbbbbb.",
    "zCCddddddddddddddddddd.",
    "zCCddccccccccccbbbbbbb.",
    "zCCddccccccccccbbbbbbb.",
    ".zIIiiiiiiiiihhhhhhhhh.",
    ".zIIiiiiiiiiiiiiiii....",
    ".zIIjjjjjjjjjjjjj......",
    "......jjjjjjjj.........",
    "...........j...........",
  ] },
  armnear: { x: 4, y: 49, rows: [
    ".......hhh.........",
    "......jihhg........",
    ".....jjihhgg.......",
    ".....zIIhhgg.......",
    ".....zIIhhgg.......",
    "....zIIhhgg........",
    "....zIIhhgg........",
    "...zIIhhgg.........",
    "...zIIhhgg.........",
    "...zIIhhgg.........",
    "..zIIhhgg..........",
    "..zIIhhgg..........",
    ".zIaaagg...........",
    ".zaaaaaa...........",
    ".zbaaaaaa..........",
    "zCbbaaaaaa.........",
    "zCCbbbaaaaa........",
    "zCCcbbbaaaaa.......",
    ".zCCccbbaaaaa......",
    ".zCCcccbbaaaaa.....",
    "..zCCcccbbbaajjhhg.",
    "....zCCccbbbjijhhgg",
    ".....zCCcccbjijhhgg",
    "......zCCcccjijhhgg",
    ".......zCCccjijhhgg",
    ".........zCCjijhhgg",
    "..........zCIjjhhg.",
    "............z......",
  ] },
  head: { x: 19, y: 6, rows: [
    ".......z.....................",
    "........zCCca................",
    ".........zCCaaaa.............",
    "..........zCbbbbbbb..........",
    "............zbbbbbbb.........",
    "....bbbbaaaaaabbbbbbbw.......",
    "...bbbbbaaaaaaaaaaaaaaaaa....",
    "..bbbbbbaaaaaaaaaaaaaaaaaa...",
    ".bbbbbbbaaaaaaaaaaaaaaaaaa...",
    ".bbbbbbbbbbbbbbbbbbbbbbbbbb..",
    ".ddccccccccccbbbbbbbbbbbbbbb.",
    ".ddccccccccccbbbbbbbbbbbbbbb.",
    "dddccccccccaaaaaaaabbbbbbbbb.",
    "dddccccccccbbbbbbbbaaaaaaaabb",
    "dddccccccccddddddddbbbbbbbbaa",
    "zCCcchcccccccbbbbbbddddddddbb",
    "zCCiihhhccccxxxxxxxxxxxxxxxxx",
    "zCCiihghccccxxxuuwxxxxxxxxxxx",
    "zCCiihghccccxxuffuxxxxxuuxxxx",
    "zCIiihhhhcccxxuuuxxxxxufuxxxx",
    ".zCIiiiiccccxxxxxxxxxxuuxxxxx",
    ".zCIiiiiccccxxxxxxxxxxxxxxxxx",
    ".zCIiiiicccccbbbbbbbbbbbbbbbb",
    ".ddccicccccccbbbbbbbbbbbbbbb.",
    ".ddccccccccccbbbbbbdbbdbbdbb.",
    ".ddccccccccccbbbbbbdbbdbbdbb.",
    "..dccccccccccbbbbbbdbbdbbdb..",
    "..dccccccccccbbbbbbdbbdbbdb..",
    "...ccccccccccbbbbbbbbbbbbb...",
    "...ddddddddddcccccccccccc....",
    "....zCCddddddccccccccccc.....",
    "........zCCddcccccccccc......",
    "...........d.................",
  ] },
  hilt: { x: 40, y: 35, rows: [
    "...........z.......",
    "..........gg.......",
    ".........gghh......",
    "........gghh.......",
    ".......gghh........",
    "......gghh.........",
    ".....gghh..........",
    "....gghh...........",
    "...gghh............",
    "..gghh..sr.........",
    ".gghh...ssr........",
    "gghh.....ssr.......",
    "..h.......ssr......",
    "...........ssr.....",
    "............sss....",
    ".............sss...",
    "..............sshh.",
    "...............hhgw",
    "...............hhgg",
    "...............hhhh",
    "................hh.",
  ] },
  fistfar: { x: 47, y: 42, rows: [
    "..ihhg..",
    ".jihhgg.",
    "jjihhhwg",
    "jjihhhgg",
    "jjihhhgg",
    "jjjjhhgg",
    "jjihhhgg",
    ".jihhgg.",
    "..ihhh..",
  ] },
};
const ORDER = ["base", "pack", "blade", "legfar", "legnear", "spine", "hips", "tabard", "tabtip", "torso", "neck", "paulfar", "armfar", "paulnear", "armnear", "head", "hilt", "fistfar"];
// Which breath each part follows: 0 stays, 1 the chest, 2 the head a beat later, 3 the tabard's hem, which swings sideways.
const GROUP = {"base": 0, "pack": 1, "blade": 1, "legfar": 0, "legnear": 0, "spine": 0, "hips": 0, "tabard": 0, "tabtip": 3, "torso": 1, "neck": 1, "paulfar": 1, "armfar": 1, "paulnear": 1, "armnear": 1, "head": 2, "hilt": 1, "fistfar": 1};
// The visor shutters half shut and shut, laid over the head.
const LIDS = {
  half: { x: 33, y: 23, rows: [
    "xxxx.....",
    "xxxx....xxx",
  ] },
  shut: { x: 33, y: 23, rows: [
    "xxxx.......",
    "xxxx....xxx",
    "vvvv....vvv",
    "xxxx....xxx",
  ] },
};
const PAL = { a: 0xf2e2c0, b: 0xd8c4a2, c: 0xa7978f, d: 0x6f6684, g: 0x93a3c2, h: 0x5d6890, i: 0x3e4374, j: 0x2b2a56, p: 0xc87a96, q: 0x96507e, r: 0x683768, s: 0x3f1f56, m: 0xe4eef5, n: 0xa8bad4, o: 0x6a7aa6, f: 0xffd884, u: 0xff9b30, v: 0xd2552e, x: 0x2a2450, z: 0x8cccff, w: 0xfffaf0, C: 0xa7978f, I: 0x48538a, R: 0x683768, O: 0x6a7aa6, U: 0x48538a, V: 0x2f2f62, X: 0x2a2450, N: 0xd6b075 };
// Knob 4: the editions, each a hand-picked repaint of some materials.
const EDITIONS = [
  {  },
  { a: 0xb4b9cf, b: 0x7f86a6, c: 0x575c82, d: 0x3b3d66, C: 0x575c82, p: 0x6fc7b5, q: 0x3b9590, r: 0x226670, s: 0x1b4560, R: 0x226670 },
  { a: 0xffe7a3, b: 0xe1b45e, c: 0xb07a6a, d: 0x6e4a6e, C: 0xb07a6a, g: 0xe8eef6, h: 0xa7b3c8, i: 0x6c7896, j: 0x3d4568, I: 0x6c7896 },
  { a: 0xe6e2df, b: 0xc4c0be, c: 0x999593, d: 0x706c6a, C: 0x999593, g: 0xbbb7b4, h: 0x8a8684, i: 0x625f5d, j: 0x464341, I: 0x625f5d, p: 0xb0acaa, q: 0x8a8684, r: 0x625f5d, s: 0x464341, R: 0x625f5d, m: 0xede7e3, n: 0xbbb5b1, o: 0x86807d, O: 0x86807d, f: 0xede7e3, u: 0xbbb5b1, v: 0x86807d, x: 0x403d3b },
];
// Knob 2: the stands.
const STANDS = [
  { U: 0xb2815f, V: 0x8d5541, X: 0x67332f, N: 0xe0c29b },
  { U: 0xd5d7dd, V: 0xa9abb2, X: 0x797c84, N: 0xe1e2e8 },
  {  },
  { U: 0x00658c, V: 0x00bcd9, X: 0x0084a8, N: 0xc1f8f9 },
];
// Knob 1: the gels on the rim light, with the shadow-side bounce they tint.
const GELS = [
  {  },
  { z: 0xfb6acd, C: 0xa77096, I: 0x6a3f86, R: 0x8a3577, O: 0x8a5ba6 },
  { z: 0x81ef7e, C: 0x88a184, I: 0x2f6b6a, R: 0x4f6a5a, O: 0x5b9a8a },
  { z: 0xfff1d0, C: 0xbcaa98, I: 0x6a6a8a, R: 0x86506e, O: 0x8f95ae },
];
// The wink on the sword's point: x, y and what the LED turns into.
const GLINT = [[10, 5, "w"], [9, 4, "w"], [11, 5, "w"]];
// The case light: what a glossy character turns into while the band passes.
const UP = {"n": "m", "o": "n", "O": "n", "h": "g", "i": "h", "I": "h", "j": "i"};

const { floor, min, max } = Math;
// The events run on a fixed loop of exactly eight breaths, so they always meet
// the breath at the same phase. Blinks come 2 to 3.3 s apart and never while
// the head is moving; the case light every 6.8 s, taking 2.4 s to cross, at a
// phase where no breath step meets its edge; the glint on the point every 6 or
// more. None falls between 1.5 and 2.5 s, where the still is taken.
const CYCLE = 27.2;
const BLINKS = [0.6, 3.3, 6.4, 9.0, 12.0, 14.3, 17.6, 20.1, 23.4, 25.8];
const SWEEPS = [4.3, 11.1, 17.9, 24.7];
const GLINTS = [3.0, 9.6, 15.8, 22.0];
const SWEEP_LEN = 2.4;
const GLINT_LEN = 0.17;
// One breath is 3.4 s: the chest rises a pixel, the head follows a quarter
// second later, and the tabard's hem swings a pixel sideways a beat after
// that; both ends of each move are held longer than the moves between them.
const BREATH = 3.4;
// The detail cut's top left corner, in figure LEDs.
const CUT_X = 16, CUT_Y = 6;

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
  const dy = [0, u >= 1.1 && u < 2.8 ? -1 : 0, u >= 1.35 && u < 3.05 ? -1 : 0, 0];
  const dx = [0, 0, 0, u >= 1.45 && u < 3.15 ? -1 : 0];

  let sw = since(SWEEPS, t, SWEEP_LEN);
  if (t - p.sweepAt < SWEEP_LEN) sw = t - p.sweepAt;
  const sweep = sw >= 0;
  const band = -8 + (sw / SWEEP_LEN) * (W + H * 0.5 + 16);

  // The case light passes over the steel above the stand; the legs and the stand keep still.
  for (let n = 0; n < ORDER.length; n++) {
    const name = ORDER[n], g = GROUP[name];
    blit(buf, PARTS[name], dx[g], dy[g], sweep && g !== 0, band);
  }

  const db = since(BLINKS, t, 0.3);
  if (db >= 0) blit(buf, db < 0.08 || db >= 0.2 ? LIDS.half : LIDS.shut, 0, dy[2], false, 0);

  let dg = since(GLINTS, t, GLINT_LEN);
  if (t - p.glintAt < GLINT_LEN) dg = t - p.glintAt;
  if (dg >= 0) {
    for (let i = 0; i < GLINT.length; i++) {
      const g = GLINT[i], at = (g[1] + dy[1]) * W + g[0];
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
