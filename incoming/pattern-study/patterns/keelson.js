// ===== Patternflow pattern =====
// Title:   Keelson
// Family:  pixel
// Idea:    A hand-pixelled figure of Keelson, a heavy rigger robot from an orbital shipyard who set hull plates with one hydraulic gauntlet as big as his chest, standing on a display stand that fills the panel: glossy crimson lacquer over a graphite frame, a jutting jaw guard, an antenna mast, two cyan eyes under a heavy brow, and the gauntlet raised beside his head, its power cell glowing in the forearm and chrome pistons in the gap. The hydraulics lift his chest, his eyes flick to the fist and back, the grip eases open and shuts hard with a flare of the cell, and now and then the case light runs along the lacquer.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 86
// Round:   86
// ===============================
// @matrix 64x128
// @knobs Glow=0..1, Stand=0..3, Edition=0..1, Pose=0..1
//
// Knob 1: Glow. The colour of his eyes, the gauntlet's cell, the rim light down his right edges and the bounce beside it: cyan at 0, amber from 0.25, red from 0.5, green from 0.75.
// Knob 2: Stand. What he stands on: brushed steel at 0, white ceramic from 1, black acrylic with a gold lip from 2, and from 3 a glass disc lit in the colour of his eyes.
// Knob 3: Edition. The paint: crimson lacquer below 0.25, the second-player cobalt from 0.25, a black and gold limited plating from 0.5, and from 0.75 the unpainted grey prototype.
// Knob 4: Pose. Below 0.5 the gauntlet raised beside his head; from 0.5 lowered, the fist hanging by his knee.
// Buttons: K1 tap sends the case light along him; K2 tap makes the dome wink; K3 tap makes him clench the gauntlet.

const W = 64, H = 128;
// Each part is a grid, one character per LED and "." where it is clear, drawn
// in order. Materials run light to dark: lacquer a b c d e, graphite g h i j.
// u v y are the glow of the eyes, P Q R the glow of the cell, z the rim light,
// K and J the bounce beside it on lacquer and on graphite, w the specular.
// U V X N S are the stand and the shadow the feet throw on it.
const PARTS = {
  "antenna": { x: 42, y: 2, rows: [
    "...hi.",
    "ghhhhh",
    "..hi..",
    "..hi..",
    "..hi..",
    "..hi..",
    ".hi...",
    ".hi...",
  ] },
  "armfar": { x: 50, y: 53, rows: [
    "hgghhi.....",
    "hgghhi.....",
    "hggJJz.....",
    "hggJJz.....",
    "hggJJz.....",
    "hggJJz.....",
    "hggJJz.....",
    ".ggJJz.....",
    ".ggJJz.....",
    ".ggJJz.....",
    ".ggJJz.....",
    ".ggJJz.....",
    ".ggJJz.....",
    ".gggJz.....",
    ".gghJJz....",
    "hhhhJJz....",
    "ihhiJJz....",
    ".iiiJJz....",
    "..jbbbz....",
    "bbbbbbz....",
    "ccccKKz....",
    "ccccdKKz...",
    ".cccdKKz...",
    ".cccdKKz...",
    ".cccdKKz...",
    ".ccccKKz...",
    ".ccccKKz...",
    ".ccccKKz...",
    ".ccccdKKz..",
    "..cccdKKz..",
    "..cccdKKz..",
    "..KKz......",
    "..hhhhJJz..",
    "..hhhhJJz..",
    "..hhhhJJz..",
    "...hhhiJJz.",
    "...hhhiJJz.",
    "...hiihi.Jz",
    "...hi.hi.Jz",
    "...ii.ii.Jz",
    "...ii.ii.Jz",
    "...ii.ii.Jz",
    "...ii.Jz...",
    "...ii.Jz...",
  ] },
  "base": { x: 5, y: 113, rows: [
    ".............UUUUUUUUUUUUUUUUUUUUUUUUUUU..............",
    "......UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU.......",
    "...UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUS....",
    ".UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUSSSSSSSSUUUUUUUUSSS..",
    "NUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUSSSSSSSSUUUUUUUUSSSN.",
    "VNNUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUSSSSSSSSUUUUUUUUUNNVV",
    "VVVNNNUUUUUUUUUUUUUUUUUUUUUUUUUUUSSSSSSSSUUUUUUNNNVVVV",
    "VVVVVVNNNNNNNUUUUUUUUUUUUUUUUUUUUSSSSSSSNNNNNNNVVVVVVV",
    "VVVVVVVVVVVVVNNNNNNNNNNNNNNNNNNNNNNNNNNNVVVVVVVVVVVVVV",
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "..XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...",
    "......XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.......",
    "..............XXXXXXXXXXXXXXXXXXXXXXXXX...............",
  ] },
  "eyes": { x: 22, y: 20, rows: [
    "vv...........",
    "vvvy.....vvvv",
    "vuvv...vvuvvv",
    "yvvy...yvvvvy",
  ] },
  "eyeshalf": { x: 22, y: 20, rows: [
    "jj...........",
    "jjjj.....jjjj",
    "vvvv...vvvvvv",
    "yvvy...yvvvvy",
  ] },
  "eyesl": { x: 22, y: 20, rows: [
    "vv...........",
    "vvvy.....vvvv",
    "uvvv...vuvvvv",
    "yvvy...yvvvvy",
  ] },
  "eyesr": { x: 22, y: 20, rows: [
    "vv...........",
    "vvvy.....vvvv",
    "vvuv...vvvuvv",
    "yvvy...yvvvvy",
  ] },
  "eyesshut": { x: 22, y: 20, rows: [
    "jj...........",
    "jjjj.....jjjj",
    "jjjj...jjjjjj",
    "yyyy...yyyyyy",
  ] },
  "fist": { x: 1, y: 14, rows: [
    ".aab...aab...bbc.",
    "aawbcjaawbcjbbccd",
    "abbbcjabbbcjbcccd",
    "bbbcdjbbbcdjccddd",
    "ccdddjccdddjdddde",
    "ghhhijghhhijhhhij",
    "hhhhijhhhhijhhiij",
    "hhhijjhhhijjhiijj",
    "gggggggggggghiijj",
    "ghhhhhhhhhhhhi...",
    "hhhhhhhhhhhhhij..",
    "ihhhhhhhhhhhiij..",
    ".iiiiiiiiiiijj...",
    "jiiiiiiiiiiij....",
  ] },
  "fistopen": { x: 1, y: 13, rows: [
    ".aab...aab...bbc.",
    "aabbcjaabbcjbbccd",
    "abbbcjabbbcjbcccd",
    "bbbcdjbbbcdjccddd",
    "ccdddjccdddjdddde",
    "ghhhijghhhijhhhij",
    "hhhhijhhhhijhhiij",
    "hhhijjhhhijjhiijj",
    "hhiijjhhiijjiiijj",
    "gggggggggggghiijj",
    "ghhhhhhhhhhhhi...",
    "hhhhhhhhhhhhhij..",
    "ihhhhhhhhhhhiij..",
    ".iiiiiiiiiiijj...",
    "jiiiiiiiiiiij....",
  ] },
  "gauntlet": { x: 0, y: 28, rows: [
    "baaabbbbbbcddddd...",
    "bbbbbccccccddddd...",
    "dddddddddddddddd...",
    "ggghhhhhhhhiiiij.g.",
    "ggghhhhhhhhiii.j.gi",
    ".gggYYYYYYhiii.j.gi",
    ".ggYRRRRRRYiiij..gi",
    ".ggYRQQQQRYiiij..gi",
    ".ggYRQPPQRYii.j..gi",
    ".ggYRQPPQRYii.j.gi.",
    ".ggYRQQQQRYii.j.gi.",
    ".ggYRRRRRRYii.j.gi.",
    "..ggYYYYYYiiij..gi.",
    "..ggghhhhhii.j..gi.",
    "..ggghhhhhii.j..g..",
    ".....hhh...........",
    "...ggghhhi.........",
    "..gggghhiijhhh.....",
    "..ggghhhiijggg.....",
    ".hgghhhhiijjgg.....",
    ".hhhhhhiijjjgg.....",
    ".ihhhiiijjjjhh.....",
    "..iiiiijjjjhhh.....",
    "..iiijjjjjjiii.....",
    "...jjjjjjjiiii.....",
    ".....jjj...........",
  ] },
  "gauntlet_low": { x: 0, y: 52, rows: [
    "...........hhggghhhii...",
    "...........hhggghhhii...",
    "...........hhggghhhii...",
    "...........hhggghhhii...",
    "...........hhggghhhii...",
    "...........hhggghhhii...",
    "............hggghhhii...",
    "............hggghhhii...",
    "............hggghhhii...",
    "............hggghhhii...",
    "............hghghhhii...",
    "...........hgghhijhii...",
    "..........hggghhiij.....",
    "..........ggghhhiij.....",
    "..........gghhhhiij.....",
    ".........ihhhhhiijjj....",
    "..........hhhiiijjj.....",
    "..........iiiiijjjj.....",
    "..........jiijjjjjj.....",
    "...........jjjjjjj......",
    "......aaaaaaaaaaaaaaa...",
    "......aaaaaaaaaaaaaaa...",
    "..gh..bbbbbccccccccdd...",
    "..gh.cbbbbbccccccccddd..",
    "..gh.cbbbbbccccccccddd..",
    "..gh.bbbbbbccccccccddd..",
    ".gh..bbbbbbccccccccddd..",
    ".gh..bbbbbRRRRRRRccddd..",
    ".gh..bbbbbRQQQQQRccddd..",
    ".gh.cbbbbbRQPPPQRccdddd.",
    ".gh.bbbbbbRQPPPQRcccddd.",
    ".gh.bbbbbbRQPPPQRcccddd.",
    ".gh.bbbbbbRQQQQQRcccddd.",
    ".gh.bbbbbbRRRRRRRcccddd.",
    "gh..bbbbbbccccccccccddd.",
    "gh.bbbbbbbccccccccccdddd",
    "gh.bbbbbbbccccccccccdddd",
    "gh.bbbbbbbccccccccccdddd",
    "gh.......jiiiiiiiiiiij..",
    "........jjiiiiiiiiiii...",
    ".......jiihhhhhhhhhhhi..",
    ".......jihhhhhhhhhhhhh..",
    "........ihhhhhhhhhhhhg..",
    ".....jjiihgggggggggggg..",
    ".....jjiihjjihhhjjihhh..",
    ".....jiihhjihhhhjihhhh..",
    ".....jihhhjihhhgjihhhg..",
    ".....eddddjdddccjdddcc..",
    ".....dddccjdcbbbjdcbbb..",
    ".....dcccbjcbbbajcbbba..",
    ".....dccbbjcbbaajcbbaa..",
    "......cbb...baa...baa...",
  ] },
  "head": { x: 20, y: 8, rows: [
    "..........bbbbbbbbbb.........",
    ".......baaaabbbccdddddd......",
    ".....bbaawwabbbbccddddddd....",
    "....bbaaaabbbbbbccdddddKKz...",
    "...bbbaabbbbbbbbbccdddddKKz..",
    "..bbbbbbbbbbbbbbbccdddddKKz..",
    "..bbbbbbbbbbbbbbbccddddddKKz.",
    ".bbbbbbbbbbbbbbbbbccdddddKKz.",
    "bbbbbbbbbbbbbbbbbbccdddddKKz.",
    "ccccccccccccccccccccdhhhhhhz.",
    "ccccccccccccccccccccdhghhhhz.",
    ".eeecccccceeeeeeeeccdhiiiiJJz",
    ".jjjeejjjejjjjjjjcccdhiiiiJJz",
    ".YjjjjeeejjjjjjYccccdhijjjJJz",
    ".YjjjjYYYjjjjjcccdccdhiiiiJJz",
    ".YjjjjYYYjjjjjcccddddhijjjJJz",
    ".iYYYYiiiYYYYYccdddddhiiiiJJz",
    ".iiiiiiiiiiiiiccdddddhiiiiJJz",
    ".iiiiiiiiiiiiiccdddddjjjjjJJz",
    "..iiiiiiiiiiccccdddddddddKKz.",
    ".chjhjhjhjhjcccddddddddddKKz.",
    "cchjhjhjhjhjcccdddddddddKKz..",
    "bchjhjhjhjhjcccdddddddddKKz..",
    "bbhjhjhjhjhjcccddddddddKKz...",
    "bbbbbbbbbbbbcccdddddddKKz....",
    "cccccccccccccccddddddKKz.....",
    ".cccccccccccccccddddddd......",
    "..dddddddddddddddddddd.......",
    "...ddddddddddddddddd.........",
    "....dddddddddddddd...........",
  ] },
  "hips": { x: 22, y: 62, rows: [
    ".......hhhhiiiiijjjj........",
    ".......iiiiiiijjjjjj........",
    ".......hhhhiiiiijjjj........",
    ".......iiiiiiijjjjjj........",
    ".......hhhhiiiiijjjj........",
    ".......iiiiiiijjjjjj........",
    ".......hhhhiiiiijjjj........",
    ".......iiiiiiijjjjjj........",
    ".......hhhhiiiiijjjj........",
    ".......iiiiiiijjjjjj........",
    ".......hhhhiiiiijjjj........",
    ".......iiiiiiijjjjjj........",
    ".......hhhhiiiiijjjj........",
    ".......iiiiiiijjjjjj........",
    ".....hhhhhhhhhhhhhhhhhhi....",
    ".....iiiiiiiiiiiiijjjjjj....",
    ".....iiiiiiiiiiiiijjjjjj....",
    ".....aaaaaiiiiiiiijjjjjj....",
    "aaaaabbcccijaaaaaaaidccccccc",
    "bbwbbbbcccijbbbcccciddddddd.",
    "bbbbbbbcccijbbbcccciddddddd.",
    "bbbbbbbcccijbbbcccciddddddd.",
    "bbbbbbbcccijbbbccccidddddddd",
    "bbbbbbbcccijbbbcccciiddddddd",
    ".dbbbbbcdddjbbbcccciiddddddd",
    "..ddbbddiiijbbbcccciiddddddd",
    "....ddiiiiijbbbcccciidddddd.",
    "............bbbcccc...dddd..",
    ".............bbccc.....dd...",
    "..............bcc...........",
    "...............c............",
  ] },
  "legfar": { x: 38, y: 87, rows: [
    "ihhhiiiii..........",
    "iccccciii..........",
    "iddddiiii..........",
    "iddddiiii..........",
    "iddddiiii..........",
    ".ddddiiii..........",
    ".ddddiiii..........",
    ".ddhiiiii..........",
    ".hhhiiiii..........",
    "cbbbbbbbcd.........",
    "cccwcccccKKz.......",
    "ccccccccdKKz.......",
    "dddddddddKKz.......",
    "dddddddddKKz.......",
    "dddddddddKKz.......",
    ".ddddddKKz.........",
    ".jjjjjjjjJJz.......",
    ".ccccddddKKz.......",
    ".ccccddddKKz.......",
    "..cccddddKKz.......",
    "..cccddddKKz.......",
    "...hhhiiJJz........",
    "...iiiiiicbbbbbz...",
    "..hhhhhhhcccccKKz..",
    "..hhhhhhhdddddddKKz",
    "..iiiiiiidddddddKKz",
    "..iiiiiiidddddddKKz",
    "..iiiiiiidddddddKKz",
    "..iiiiiiidddddddKKz",
  ] },
  "legnear": { x: 13, y: 87, rows: [
    "............hhggghhhiii......",
    "............hhggghhhiii......",
    "............bbbbbbhhiii......",
    "............baaaaachiii......",
    "............bbbbbbchiii......",
    "............bbbbbbchiii......",
    ".............bbbbbchiii......",
    ".............bbbbbchiii......",
    ".............bbgghchiii......",
    ".............aaaabbciii......",
    "........bbawwbbbbbbbbbc......",
    "........cbbbbbbbbbbdddd......",
    "........cccccccccccdddd......",
    "........cccccccccccdddd......",
    ".........cccccccccddddd......",
    "..........ccccccccddd........",
    ".............................",
    "..........jjjjjjjjjjjjj......",
    "..........bbbbbccccddd.......",
    "..........bbbbbccccddd.......",
    "..........bbbbbccccddd.......",
    "...........bbbbccccdddd......",
    "...........bbbbccccdddd......",
    ".............hhggghhhiij.....",
    ".............hhhhhhhhhhhhh...",
    "......bbbaaaaaabcggggggggjg..",
    "...awwaaabbbbbbbchhhhhhhhjjj.",
    "bbbbbbbbbbbbbcccchhhhhhhhjjj.",
    "cbbbbcccccccccccchhhhhhhhjjj.",
    "ccccccccccccccccchhhhhhhhjjj.",
    "ccccccccccccccccchhhhhhhhjjj.",
    "ddddddddddddddddddiiiiiiijjji",
    "ddddddddddddddddddiiiiiiiiiii",
  ] },
  "neck": { x: 31, y: 33, rows: [
    "jjjjjjjjj",
    "jjjjjjjjj",
    "hggghhiij",
    "hggghhiij",
    "hggghhiJz",
    "hggghhJJz",
    "hggghhiij",
    "hggghhiij",
    "hggghhiij",
  ] },
  "paulfar": { x: 44, y: 39, rows: [
    "....cccKKz....",
    "...bbcccKKz...",
    "..bbbccccKKz..",
    ".bbbbcccccKKz.",
    "cbbcccccccdKKz",
    "ccccccccccdKKz",
    "cccccccccddKKz",
    "ccccccccdddKKz",
    "cccccccddddKKz",
    "ccccccddddeKKz",
    "dcccdddddeeKKz",
    ".dddddddeeKKz.",
    "..ddddeeeKKz..",
    "...eeeeeKKz...",
    ".eeeeeeeeeKKz.",
    ".eeeeeeeeeKKz.",
  ] },
  "paulnear": { x: 12, y: 36, rows: [
    "......bbbbbccd......",
    "....baaaabbbcccd....",
    "...aaaaaabbbcccdd...",
    "..aaaaawwbbbcccdde..",
    "..aaaaawbbbccccdde..",
    ".baaaaabbbbcccdddee.",
    ".bbabbbbbbccccdddee.",
    "cbbbbbbbbccccdddeeee",
    "cbbbbbbcccccddddeeee",
    "ccbbcccccccddddeeeee",
    ".cccccccccddddeeeee.",
    ".cccccccdddddeeeeee.",
    "..dddddddddeeeeeee..",
    "..ddddddddeeeeeeee..",
    "..eeeeeeeeeeeeeeeee.",
    "....dddddddddddd....",
    "......eeeeeeee......",
  ] },
  "torso": { x: 23, y: 40, rows: [
    ".......baaaaaaaabccccc.....",
    "....baaaacccccccccdcccc....",
    "..bbawaaccccccccccddddccc..",
    ".bbbbbbbccccccccccdddddddc.",
    ".bbbbbbbccbbbbbbbcddddddddd",
    ".bbbbbbbccbbbbbbbcddddddddd",
    "bbbbbbbbccbbbbbbbcddddddddd",
    "bbbbbbbbccbbbbbbbcddddddddd",
    "bbbbbbbbccbbbbbbbcddddddddd",
    "bbbbbbbbccbbbbbbbcddddddddd",
    "bbccccccccccccccccddddddddd",
    "bbbbbbbbccbbbbbbbcddddddddd",
    "cbbbbbbbccbbbbbbbcddddddddd",
    ".ccbbbbbbbbbbbbbbcdddddddd.",
    "..ccbbbbbbbbbbbbbcddddddd..",
    "..hcccbbbbbbbbbbccdddddd...",
    "..hhcccbbbbbbbbcccdddddi...",
    "..hhhcccccbbbbcccdddddii...",
    "..hhhhhccccccccccddddiii...",
    "...hhhhhccccccccddddiii....",
    "...hhhhhhcccccccddciiii....",
    "....hhhhhhhcccccdiiiii.....",
    "....hhhhhhhicccciiiiii.....",
    ".....hhhhhhiicciiiiii......",
    ".....hhhhhhiiiiiiiiii......",
    "......hhhhhiiiiiiiii.......",
  ] },
};
const ORDER_UP = ["base", "legfar", "legnear", "hips", "torso", "neck", "armfar", "paulfar", "paulnear", "gauntlet", "fist", "head", "antenna"];
const ORDER_LOW = ["base", "legfar", "legnear", "hips", "torso", "neck", "armfar", "paulfar", "gauntlet_low", "paulnear", "head", "antenna"];
// Which breath each part follows: 0 stays, 1 the chest, 2 the head a beat later.
const GROUP = {"antenna": 2, "armfar": 1, "base": 0, "eyes": 2, "eyeshalf": 2, "eyesl": 2, "eyesr": 2, "eyesshut": 2, "fist": 1, "fistopen": 1, "gauntlet": 1, "gauntlet_low": 1, "head": 2, "hips": 0, "legfar": 0, "legnear": 0, "neck": 1, "paulfar": 1, "paulnear": 1, "torso": 1};
const PAL = { a: 0xffb0a4, b: 0xff5a5c, c: 0xd22c4e, d: 0x951f58, e: 0x5a1a52, g: 0xa8b2d0, h: 0x67729e, i: 0x444c7e, j: 0x2e3260, u: 0xeaffff, v: 0x4cf0f2, y: 0x1696c0, z: 0x7ae8ff, K: 0x6a3a90, J: 0x3e6aa2, Y: 0x1c5a86, w: 0xfff6ee, U: 0x3e4472, V: 0x30315c, X: 0x28284e, N: 0xd9b46e, S: 0x2a2a54 };
// Knob 3: the editions, each a hand-picked repaint of the lacquer and sometimes the frame.
const EDITIONS = [
  {  },
  { a: 0xc4e0ff, b: 0x5aa0ff, c: 0x2f64dc, d: 0x283f9c, e: 0x1e2766, K: 0x3a3a9a },
  { a: 0xfff0b4, b: 0xffd064, c: 0xd99a32, d: 0x9c5c3c, e: 0x5e3448, K: 0x8a4a5a, g: 0xa6aec8, h: 0x5c6288, i: 0x3c4068, j: 0x2c2e56, J: 0x3c4a7a },
  { a: 0xe6e4e2, b: 0xc8c4c2, c: 0x9c9896, d: 0x706c6c, e: 0x4c484a, K: 0x6a6670, g: 0xbcb9b7, h: 0x8c8987, i: 0x63605f, j: 0x484544, J: 0x5a5a62 },
];
// Knob 2: the stands. The last takes its colours from LIT.
const STANDS = [
  { U: 0x98a2b6, V: 0x6e778f, X: 0x545a72, N: 0xe2e8f2, S: 0x5c6278 },
  { U: 0xdadbe0, V: 0xafb1b9, X: 0x878992, N: 0xf4f4f8, S: 0xa0a2ac },
  {  },
  {  },
];
// Knob 1: the glow of the eyes and the cell, the rim light and the bounce it throws.
const GLOWS = [
  { P: 0xeaffff, Q: 0x4cf0f2, R: 0x1696c0 },
  { u: 0xfff4d8, v: 0xffb43c, y: 0xc8681e, z: 0xffc670, K: 0xb04234, J: 0x8a6456, Y: 0x7a4a24, P: 0xfff4d8, Q: 0xffb43c, R: 0xc8681e },
  { u: 0xffe8fa, v: 0xff52da, y: 0xb0249a, z: 0xff8ae6, K: 0xa22a8c, J: 0x7a4aa0, Y: 0x6a2070, P: 0xffe8fa, Q: 0xff52da, R: 0xb0249a },
  { u: 0xecffe8, v: 0x6cff7c, y: 0x22a24e, z: 0x8eff9c, K: 0x6a5a4c, J: 0x3e7a62, Y: 0x1e6a3e, P: 0xecffe8, Q: 0x6cff7c, R: 0x22a24e },
];
const LIT = [
  { U: 0x1c5a7a, V: 0x1aa8c8, X: 0x16708e, N: 0xb8fbff, S: 0x173e64 },
  { U: 0x7a4a24, V: 0xd88a2a, X: 0x9a5a22, N: 0xffe4b0, S: 0x5a3420 },
  { U: 0x6a2468, V: 0xd040b8, X: 0x8e2a86, N: 0xffc4f2, S: 0x4c1c52 },
  { U: 0x1e6a3e, V: 0x2ec060, X: 0x1e8446, N: 0xc4ffcc, S: 0x184a34 },
];
// The case light: what a glossy character turns into while the band passes.
const UP = {"b": "a", "c": "b", "d": "c"};
// The cell flaring as the grip shuts, as character codes.
const FLARE = {81: 117, 82: 118};
// The dome's highlight that winks white.
const GLINT_AT = new Set([604, 605, 606, 607, 667, 668, 671, 730, 731, 732, 733, 794, 795]);

const { floor, min, max } = Math;
// The events run on a fixed loop of exactly eight breaths, so they always meet
// the breath at the same phase. Nothing falls between 1.5 and 2.5 s, where the
// still is taken.
const CYCLE = 25.6;
const BREATH = 3.2;
const BLINKS = [0.6, 3.6, 7.9, 10.9, 14.6, 17.4, 21.3, 23.9];
const GLANCES = [[5.0, 1.5, -1], [12.4, 1.1, 1], [18.6, 1.6, -1]];
const CLENCHES = [6.9, 15.9, 22.4];
const SWEEPS = [3.0, 9.4, 15.8, 22.2];
const GLINTS = [4.4, 11.6, 19.8];
const SWEEP_LEN = 3.0;
const GLINT_LEN = 0.17;
const CLENCH_LEN = 1.3;

function since(list, t, len) {
  const u = t % CYCLE;
  for (let i = 0; i < list.length; i++) {
    const d = u - list[i];
    if (d >= 0 && d < len) return d;
  }
  return -1;
}

function glance(t) {
  const u = t % CYCLE;
  for (let i = 0; i < GLANCES.length; i++) {
    const g = GLANCES[i];
    if (u >= g[0] && u < g[0] + g[1]) return g[2];
  }
  return 0;
}

function lut(glow, stand, ed) {
  const t = new Int32Array(128).fill(-1);
  const put = (p) => {
    for (const ch in p) t[ch.charCodeAt(0)] = p[ch];
  };
  put(PAL);
  put(EDITIONS[ed]);
  put(STANDS[stand]);
  put(GLOWS[glow]);
  if (stand === 3) put(LIT[glow]);
  return t;
}

function blit(buf, part, dx, dy, band) {
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
      if (band > -99) {
        const s = x + (part.y + j) * 0.5 - band;
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
  params.clenchAt = -10;
  params.glow = 0;
  params.stand = 2;
  params.ed = 0;
  params.low = false;
}

export function update(dt, input, params) {
  if (!params.buf) setup(params);
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += min(dt || 0, 0.1);
  params.glow = min(3, max(0, floor(k[0] * 4)));
  params.stand = min(3, max(0, floor(k[1])));
  params.ed = min(3, max(0, floor(k[2] * 4)));
  params.low = k[3] >= 0.5;
  const b = input.btnPressed;
  if (b && b[0]) params.sweepAt = params.t;
  if (b && b[1]) params.glintAt = params.t;
  if (b && b[2]) params.clenchAt = params.t;
}

export function draw(display, params) {
  const p = params;
  if (!p.buf) setup(p);
  const t = p.t;
  const key = p.ed * 16 + p.stand * 4 + p.glow;
  if (key !== p.key) {
    p.key = key;
    p.lut = lut(p.glow, p.stand, p.ed);
  }
  const buf = p.buf;
  buf.fill(0);

  // The hydraulics lift the chest a pixel and hold it; the head follows a
  // quarter second later. Legs and stand stay put.
  // While the case light passes he holds where he is, so the band never
  // meets a part mid-step.
  let sw = since(SWEEPS, t, SWEEP_LEN);
  if (t - p.sweepAt < SWEEP_LEN) sw = t - p.sweepAt;
  const band = sw >= 0 ? -10 + (sw / SWEEP_LEN) * (W + H * 0.5 + 20) : -100;
  const tb = sw >= 0 ? t - sw : t;
  const u = (((tb - 1.5) % BREATH) + BREATH) % BREATH;
  const dy = [0, u >= 1.0 && u < 2.6 ? -1 : 0, u >= 1.25 && u < 2.85 ? -1 : 0];

  let cl = since(CLENCHES, t, CLENCH_LEN);
  if (t - p.clenchAt < CLENCH_LEN) cl = t - p.clenchAt;

  const order = p.low ? ORDER_LOW : ORDER_UP;
  for (let n = 0; n < order.length; n++) {
    let name = order[n];
    const g = GROUP[name];
    // The grip eases open for half a second, then shuts hard and the cell flares.
    if (name === "fist" && cl >= 0.1 && cl < 0.6) name = "fistopen";
    blit(buf, PARTS[name], 0, dy[g], g === 0 ? -100 : band);
  }

  // Eyes: a glance moves both pupils a pixel; a blink drops the shutters.
  const db = since(BLINKS, t, 0.3);
  const look = glance(t);
  let eyes = look < 0 ? PARTS.eyesl : look > 0 ? PARTS.eyesr : PARTS.eyes;
  if (db >= 0) eyes = db < 0.08 || db >= 0.22 ? PARTS.eyeshalf : PARTS.eyesshut;
  blit(buf, eyes, 0, dy[2], -100);

  const L = p.lut;
  const flare = !p.low && cl >= 0.6 && cl < 1.1;
  let dg = since(GLINTS, t, GLINT_LEN);
  if (t - p.glintAt < GLINT_LEN) dg = t - p.glintAt;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let ch = buf[y * W + x];
      if (!ch) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      if (flare && FLARE[ch]) ch = FLARE[ch];
      if (dg >= 0 && ch === 97 && GLINT_AT.has(y * W + x - dy[2] * W)) ch = 119;
      const c = L[ch];
      if (c < 0) display.setPixel(x, y, 255, 0, 255);
      else display.setPixel(x, y, (c >> 16) & 255, (c >> 8) & 255, c & 255);
    }
  }
}
