// ===== Patternflow pattern =====
// Title:   Rowel
// Family:  pixel
// Idea:    A hand-pixelled figure of Rowel, a clockwork marshal who has walked a desert railroad alone for a hundred years, standing on a display stand that fills the panel: a wide flat-brimmed felt hat tilted over a nickel faceplate, two turquoise eyes under sharp brows, a winding key at his temple, a dusty sand duster with a shoulder cape, nickel legs and spurred boots, one thumb hooked in his gun belt and a long-barrelled revolver held muzzle-up beside the brim. He breathes, the coat tails follow a beat late, his eyes shutter, and now and then the case light runs along the metal.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 88
// Round:   88
// ===============================
// @matrix 64x128
// @knobs Edition=0..1, Stand=0..3, Detail=0..1, Gel=0..1
//
// Knob 1: Edition. The paint: sand duster and indigo felt below 0.25, the second-player charcoal and oxblood from 0.25, a gold and ivory limited plating from 0.5, and from 0.75 the unpainted grey prototype.
// Knob 2: Stand. What he stands on, and the light it throws back up onto the bottom of his boots: a railroad tie below 0.75, red sandstone from 0.75, black acrylic with a gold lip from 1.5 (which throws none), and from 2.25 acrylic lit at the edge.
// Knob 3: Detail. Below 0.5 the whole figure; from 0.5 his head, chest and raised revolver at exactly twice the size.
// Knob 4: Gel. The rim light down his left edges, the bounce beside it and the shaded side of the coat and the deepest shade of each material, as if the sky on his dark side changed: evening violet at 0, dawn blue from 0.25, cactus green from 0.5, night blue from 0.75.
// Buttons: K1 tap sends the case light along him; K2 tap makes the muzzle glint.

const W = 64, H = 128;
// Each part is a grid, one character per LED and "." where it is clear, drawn
// in order. Materials run light to dark: canvas a b c d, felt and leather
// f g h, nickel n o p q, brass B C D. t u v are the turquoise of the eyes and
// the grip, z the rim light, K and J the bounce beside it on canvas and on
// metal or felt, w the specular. S T U L are the stand, its shadow and its lip, Y and X the bottom of the boots, which catches the stand's light.
const PARTS = {
  "arml": { x: 42, y: 34, rows: [
    ".........cccb.....",
    "........zcccbb....",
    ".......cccccbbb...",
    ".......zKcccbbb...",
    ".......zKccccbb...",
    ".......zKccccbb...",
    "........zKcccbbb..",
    ".........zKccbbb..",
    ".........zKcccbb..",
    ".........zKcccba..",
    ".........zKcccaaa.",
    "..........zKbbaaa.",
    "..........zKbbaaa.",
    "..........zKbbbaa.",
    "..aaaa..zKccbbbaaa",
    ".aaaaaaaaacccbbaaa",
    "aaaaabbbbbcccbbaaa",
    "bbbbbbbbbbcccbbbaa",
    "bbbbbbbccccccbbba.",
    "bbccccccccccccbb..",
    ".cccccccccc.......",
    "..cccc............",
  ] },
  "armr": { x: 8, y: 48, rows: [
    ".........cccb.....",
    "........cccbbb....",
    ".......cccbbbba...",
    ".......cccbbbaa...",
    ".......ccbbbbaa...",
    "......zcbbbbaaa...",
    ".....zccbbbaaaa...",
    ".....zcbbbbaaa....",
    "....zKbbbbaaaa....",
    "....zKbbbaaaa.....",
    "...zKbbbbaaa......",
    "..zKaabbaaaa......",
    ".zKaaaabaaa.......",
    "zKbbaaaaaaa.......",
    "zKbbbaaaaa........",
    "zKcbbbaaa.........",
    "zKccbbbaaa........",
    ".zKccbbbaaa.......",
    "..zKccbbccaa......",
    "...zKccccccaaa....",
    ".....zKcccccaaa...",
    "......zKcccccaaa..",
    ".......zKcccoona..",
    "........zKpooonnn.",
    "........zKpoooonn.",
    ".........ppoooonnn",
    ".........pooooonnn",
    ".........pooooonnn",
    "..........oooooon.",
    "..........ooqqqqq.",
    "............ooo...",
  ] },
  "base": { x: 5, y: 114, rows: [
    "...............SSSSSSSSSSSSSSSSSSSSSSSSS...............",
    ".......SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS.......",
    "...SSSUUUUUUUUUUUUUUUUUUUSSSUUUUUUUUUUUUUUUUUUUUSSSS...",
    ".SSSSSUUUUUUUUUUUUUUUUUUUSSSUUUUUUUUUUUUUUUUUUUUSSSSSS.",
    "LSSSSSUUUUUUUUUUUUUUUUUUUSSSUUUUUUUUUUUUUUUUUUUUSSSSSSL",
    "TLLSSSUUUUUUUUUUUUUUUUUUUSSSUUUUUUUUUUUUUUUUUUUUSSSSLLT",
    "TTTLLLLSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSLLLLTTT",
    "TTTTTTTLLLLLLLLSSSSSSSSSSSSSSSSSSSSSSSSSLLLLLLLLTTTTTTT",
    "TTTTTTTTTTTTTTTLLLLLLLLLLLLLLLLLLLLLLLLLTTTTTTTTTTTTTTT",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..",
    "......TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT......",
    "..............TTTTTTTTTTTTTTTTTTTTTTTTTTT..............",
  ] },
  "cape": { x: 14, y: 40, rows: [
    "...........c.............z...........",
    "...........zK...........zK...........",
    "..........zKcc.........zKbb..........",
    "..........zKccb.......bbbbb..........",
    ".....zKcbccccbbbbbbbbbbbbbbbaaaa.....",
    "....zKcbbccccbbbbbbbbbbbbbbbaaaaa....",
    "....zKcbbbbcbbbbbbbbbbbbbaaaaaaaa....",
    "...zKccbbbbcbbbbbbbbbbbbbaaaaaaaaa...",
    "..zKccbbbbcbbbbbbbbbbbbbbbaaaaaaaaa..",
    "..zKccbbbbcbbbbbbbbbbbbbbbaaaaaaaaa..",
    ".zKcccbbbbcbbbbbbbbbbbbbbbbaaaaaaaaa.",
    ".zKccbbbbbcbbbbbbbbbbbbbbbbaaaaaaaaa.",
    ".zKccbbbbcbbbbbbbbbbbbbbbbbbaaaaaaaa.",
    ".ccccbbbbcbbbbbbbbbbbbbbbbbbaaaaaaaa.",
    "ccccbbbbbcbbbbbbbbbbbbbbbbbbaaaaaaaaa",
    "ccccbbbbbcbbbbbbbbbbbbbbbbbbbaaaaaaaa",
    "ccccbbbbcbbbbbbbbbbbbbbbbbbbbaaaaaacc",
    ".ccbbbbbcbbbbbbbbbbbbbbbbbbbbbaaacc..",
    "...ccccccccbbbbbbbbbbbbbbcccccccc....",
    "...........cccccccccccccc............",
  ] },
  "coatback": { x: 19, y: 74, rows: [
    "...ddddddddddddddcccccccc...",
    "...ddddddddddddddcccccccc...",
    "...ddddddddddddddcccccccc...",
    "...dddddddddddddddccccccc...",
    "...dddddddddddddddccccccc...",
    "..ddddddddddddddddcccccccc..",
    "..ddddddddddddddddcccccccc..",
    "..ddddddddddddddddcccccccc..",
    "..ddddddddddddddddcccccccc..",
    "..dddddddddddddddddccccccc..",
    "..dddddddddddddddddccccccc..",
    "..dddddddddddddddddccccccc..",
    "..dddddddddddddddddccccccc..",
    "..dddddddddddddddddccccccc..",
    ".ddddddddddddddddddcccccccc.",
    ".dddddddddddddddddddccccccc.",
    ".dddddddddddddddddddccccccc.",
    ".dddddddddddddddddddccccccc.",
    ".dddddddddddddddddddccccccc.",
    ".dddddddddddddddddddccccccc.",
    ".dddddddddddddddddddccccccc.",
    ".ddddddddddddddddddddcccccc.",
    "dddddddddddddddddddddccccccc",
    "dddddddddddd......zKdccccccc",
    "dddddddd.............ccccccc",
    "ddddd...................cccc",
    "d..........................c",
  ] },
  "eyeshalf": { x: 22, y: 28, rows: [
    "ppp....pppp",
    "ppp....pppp",
  ] },
  "eyesshut": { x: 22, y: 28, rows: [
    "ppp....pppp",
    "ppp....pppp",
    "ppp....pppp",
    "vvv....pppp",
    ".......vvvv",
  ] },
  "glint": { x: 51, y: 2, rows: [
    "w.",
    "nw",
    ".w",
  ] },
  "gun": { x: 46, y: 2, rows: [
    "....zJ.....",
    "....zJn....",
    "....zJn....",
    "....zJn....",
    "....zJn....",
    "....zJn....",
    "....zJw....",
    "....zJw....",
    "....zJn....",
    "....zJn....",
    "....zJn....",
    "....zJn....",
    "....zJn....",
    "....zJn....",
    "....pon....",
    "....pon....",
    "....pon....",
    "..ppoqonn..",
    "..zJoqonn..",
    "..zJoqonw..",
    "..zJoqonn..",
    "..zJoqonn..",
    "..zJoqonn..",
    "...zJppp...",
    "...zJppp...",
    ".....zJo...",
    "...zJooonn.",
    "...zJoooon.",
    "..zJpppppnn",
    "..zJooooonn",
    "..zJoooooon",
    ".utooooooo.",
    "uuuooooooo.",
    "vuu..ooo...",
    ".vv........",
  ] },
  "hat": { x: 3, y: 5, rows: [
    "........................z..........z......................",
    "...................zggggggg....zgffff.....................",
    "..................zhgggggggghggggffffff...................",
    "..................zhgggggggghgggggffffff..................",
    ".................zhhgggggggghgggggffffff..................",
    ".................zhhggggggghggggggfffffff.................",
    ".................zhgggggggghggggggfffffff.................",
    ".................zhgggggggghggggggfffffff................z",
    ".................zhgggggggghggggggfffffff...............zf",
    "................zJppppoooooooooooooonnnnnn............zfff",
    "................zJppppoooooooooooooonnwnnn.......ffffffff.",
    "................zJppppoooooooooooooonnnnnnggggggggffffff..",
    "................zhhggggggggggggggggggggggggggggggggghhh...",
    "z...............zggggggggggggggggggggggggggggghhhhhh......",
    "zh...........zggggggggggggggggggggggggghhhhhhh............",
    "zhhhhhhhggggggggggggggggggggggggghhhhhh...................",
    ".zhhhhhhggggggggggggggghhhhhhhhhh.........................",
    "...zhhhhggggghhhhhhhhhh...................................",
    ".......zhhhhh.............................................",
  ] },
  "head": { x: 20, y: 17, rows: [
    "qqqqqqqqqqqqqqqqqqqqqqq....",
    "qqqqqqqqqqqqqqqqqqqqqqq....",
    "qqqqqqqqqqqqqqqqqqqqqqq....",
    "qqqqqqqqqqqqqqqqqqqqqqq....",
    "qqqqqqqqqqqqqqqqqqqqqqq....",
    "ppppppppppppppppppppppp....",
    "zJpoooooooooooopnnnnnnnn...",
    "zJpoooooooooooopnnnnnnnn...",
    "zJqqoooooooqqqqpnnnnnnnn...",
    "zJqqqqooqqqqqoopnnnpppnn.C.",
    "zJpoooooooooooopnnppnppnCBC",
    "zJutoooooouttoopnnpnnnpnCCC",
    "zJuuuoooouuuuooopnppnppnDCD",
    "zJuuuoooouuuuooopnnpppn..D.",
    "zJvuuoooouuuuooopnnnnnn....",
    ".zJoooooovvuuooopnnnnnn....",
    ".zJooooooooooooopnnnnnn....",
    ".zJoooooooqooooopnnnnn.....",
    ".zJooqqqqqoooooopnnnnn.....",
    ".zJooooooooooooopnnnn......",
    "..zJpppppppppppppppp.......",
    "...zJpppppppppppppp........",
    "...zJppppppppppppp.........",
    "....zJppppppppppp..........",
  ] },
  "legfar": { x: 16, y: 74, rows: [
    "..........oooo.......",
    ".........ooooon......",
    "........oooooonn.....",
    ".......poooooonnn....",
    ".......poooooonnn....",
    ".......poooooonnn....",
    ".......poooooonnn....",
    "........oooooonnn....",
    "........oooooonnn....",
    "........oooooonnn....",
    "........oooooonnn....",
    "........oooooonnn....",
    "........oooooonn.....",
    ".......poooooonn.....",
    ".......poooooonn.....",
    ".......poooooonn.....",
    ".......opoooonnn.....",
    "......popooonnnn.....",
    "......pppoooonoo.....",
    "......ppoooooooo.....",
    "......ppoooooooo.....",
    ".......oooooooon.....",
    "........ooooooon.....",
    ".......qqqqqqqqq.....",
    "........ooooonnn.....",
    "........ooooonnn.....",
    ".......oooooonn......",
    ".....zhhgggggfff.....",
    ".....zhhgggggfff.....",
    ".....zhhhhhhhhhh.....",
    ".....zhgggggggff.....",
    ".....zhgggggggff.....",
    ".....zhgggggggfff....",
    ".....zhgggggggfff....",
    ".....zhgggggggfff....",
    ".....zhggggggggff....",
    ".....zhggggggggff....",
    ".....zhggggggggff....",
    ".....zhggggggggff....",
    "...zhhgggggggggfff.B.",
    "..zhhhgggggggggfffC.C",
    "hhhhhhggggggggggff.D.",
    "YYYYYYXXXXXXXXXXff...",
    "YYYYYYXXXXXXXXXXff...",
    "YYYYYYYYYYYYYYYYYY...",
  ] },
  "legnear": { x: 33, y: 74, rows: [
    "...pooo.................",
    "..ppoooo................",
    ".pppooooo...............",
    "pppppooooo..............",
    "pppppooooo..............",
    "pppppooooo..............",
    "pppppooooon.............",
    ".ppppooooon.............",
    "..pppoooooo.............",
    "..pppoooooon............",
    "..pppoooooon............",
    "...ppoooooon............",
    "...pppooooon............",
    "...pppooooonn...........",
    "...pppooooonn...........",
    "....pppoooonn...........",
    "....pppooonnnn..........",
    "....pppoooonoo..........",
    "....pppooooooo..........",
    "....pppooooooo..........",
    ".....ppoooooonn.........",
    "......poooooonn.........",
    ".....qqqqqqqqqn.........",
    ".......oooooonn.........",
    ".......zJoooonnn........",
    ".......zJoooonnn........",
    ".......zhggggggfff......",
    ".......zhggggggfff......",
    ".......zhhhhhhhhhh......",
    ".......zhgggggggff......",
    "......zhggggggggff......",
    "......zhggggggggff......",
    "......zhggggggggff......",
    "......zhggggggggff......",
    "......zhgggggggggf......",
    "......zhgggggggggf......",
    ".....zhhgggggggggf......",
    ".....zhhgggggggggff.....",
    "...B.zhhgggggggggfff....",
    "....Chhggggggggggffff...",
    "...D.hhgggggggggggffff..",
    ".....hhgggggggggggfffff.",
    ".....YYXXXXXXXXXXXffffff",
    ".....YYXXXXXXXXXXXffffff",
    ".....YYYYYYYYYYYYYYYYYYY",
  ] },
  "neck": { x: 28, y: 38, rows: [
    "ppppppoo",
    "qqqqqqoo",
    "ppppppoo",
    "zJqqqqoo",
    "ppppppoo",
    "qqqqqqoo",
    "ppppppoo",
    "qqqqqqoo",
    "ppppppoo",
  ] },
  "skirt": { x: 8, y: 70, rows: [
    ".........cccccbbbbbb..........cccbbbbbba..........",
    ".........cccccbbbbbb..........cccbbbbbba..........",
    "........ccccccbbbbbb..........cccbbbbbbba.........",
    "........zcccccbbbbbb..........cccbbbbbbba.........",
    "........zcccccbbbbbb..........cccbbbbbbba.........",
    "........zccccbbbbbbb...........cccbbbbbbaa........",
    ".......zKccccbbbbbbb...........cccbbbbbbba........",
    ".......zKccccbbbbbbb...........cccbbbbbbba........",
    ".......zKdcccbbbbbbb...........cccbbbbbbbaa.......",
    ".......zKdcccbbbbbbb...........cccbbbbbbbaa.......",
    "......zKcdcccbbbbbbb...........cccbbbbbcbaaa......",
    "......zKdccccbbbbbbb...........cccbbbbbcbbaa......",
    "......zKdccccbbbbbbb...........cccbbbbbcbbaa......",
    ".....zKcdccccbbbbbbb...........cccbbbbbcbbaaa.....",
    ".....zKcdccccbbbbbbb............ccbbbbbbcbaaa.....",
    ".....zKcdcccbbbbbbbb............cccbbbbbcbbaa.....",
    ".....zKcdcccbbbbbbbb............cccbbbbbcbbaaa....",
    "....zKcdccccbbbbbbbb............cccbbbbbcbbaaa....",
    "....zKcdccccbbbbbbbb............cccbbbbbcbbaaa....",
    "....zKcdccccbbbbbbb.............cccbbbbbcbbbaaa...",
    "...zKccdccccbbbbbbb..............ccbbbbbbcbbaaa...",
    "...zKccdccccbbbbbbb..............ccbbbbbbcbbaaa...",
    "...zKcdcccccbbbbbbb..............ccbbbbbbcbbaaa...",
    "...zKcdcccccbbbbbb................cbbbbbbcbbaaaa..",
    "..zKccdcccccbbbbbb................cbbbbbbcbbbaaa..",
    "..zKccdcccccbbbbbb................ccbbbbbcbbbaaa..",
    "..zKccdccccbbbbbbb................ccbbbbbbcbbaaaa.",
    ".zKcccdccccbbbbbbb.................cbbbbbbcbbaaaa.",
    ".zKccdcccccbbbbbb..................cbbbbbbcbbbaaa.",
    ".zKccdcccccbbbbbb..................cbbbbbbcbbbaaaa",
    ".zKccdcccccbddddd...................bbbbbbbccccccc",
    "zKccdddddddd........................ccccccc.......",
    "zKdd..............................................",
  ] },
  "torso": { x: 18, y: 47, rows: [
    "ccccccbbpppoooooonnnnbbbaaaaa",
    "ccccccbdpppoooooonnnncbbaaaaa",
    "ccccccbdpppoooooonnnncbbaaaaa",
    "ccccccbdpppoooooonnnncbbaaaaa",
    "ccccccbdpppoooooonnnncbbaaaaa",
    "ccccccbdpppoooooonnnncbbaaaaa",
    "cccccbbdpppoooooonnnncbbaaaaa",
    "cccccbbdpppoooooonnnncbbaaaaa",
    "cccccbbdpppoooooonnnncbbaaaaa",
    "cccccbbdpppoooooonnnncbbaaaaa",
    "cccccbbdpppoooooonnnncbbaaaaa",
    "cccccbbdpppoooooonnnncbbaaaaa",
    "cccccbbdppooooooonnnncbbaaaac",
    "ccccccccccccccccccccccccccccc",
    "cccccbdpppoooocooonnnnccBaaaa",
    "cccccbdppppppppppppppncCBBaaa",
    ".zKccbdpppoooooooonnnnCCBBBa.",
    ".zKccbdpppoooooooonnnncCCBaa.",
    ".ccccbdpppoooooooonnnncDaCaa.",
    ".cccbbdbpppppppppppppbcbaaaa.",
    ".cccbbdbppoooooooonnnbcbaaaa.",
    ".cccbbdbppoooooooonnnbcbaaaa.",
    "..ccbbdbppoooooooonnnbcbaaa..",
    "..ccbbdbppoooooooonnnbcbaaa.g",
    ".hhhhhgggggCCCCBggggggggggggg",
    ".hhhhhgggggCgggCggggggggggggg",
    ".hhhhhgggggCgggCggggggggggggg",
    ".hhhhhgggggCgggCggggggggggggg",
    ".hhhhhgggggDCCCChhhhhhhhhhhhh",
    ".hhhhhhhhhhhhhh..............",
  ] },
};

const ORDER = ["base", "coatback", "legfar", "legnear", "skirt", "torso", "arml", "armr", "cape", "neck", "head", "hat", "gun"];
const GROUP = {"arml":  1, "armr":  1, "base":  0, "cape":  1, "coatback":  0, "eyeshalf":  2, "eyesshut":  2, "glint":  2, "gun":  1, "hat":  2, "head":  2, "legfar":  0, "legnear":  0, "neck":  1, "skirt":  3, "torso":  1};
const PAL = { a: 0xe2cea6, b: 0xb49c7c, c: 0x8c6c80, d: 0x5e4a6e, f: 0x8c7caa, g: 0x5c4c82, h: 0x3c3062, n: 0xdce6f0, o: 0xb2c2d6, p: 0x7a88aa, q: 0x4e5484, B: 0xffe08a, C: 0xe0a848, D: 0xa8604a, t: 0xb4fff0, u: 0x3edcc6, v: 0x1a979e, z: 0xb49cff, K: 0x8a6ab0, J: 0x6a64b8, w: 0xfffaf0, S: 0x3a3a5e, T: 0x2e2c52, U: 0x25234a, L: 0xffe08a, Y: 0x3c3062, X: 0x5c4c82 };
const EDITIONS = [
  {  },
  { a: 0x9096bc, b: 0x646a98, c: 0x444878, d: 0x2e2e5e, f: 0xc86a7e, g: 0x963a5e, h: 0x5e2648 },
  { a: 0xf6ead0, b: 0xdcc8a2, c: 0xb08e98, d: 0x7a5e80, n: 0xffe6a0, o: 0xe6b652, p: 0xb0784a, q: 0x7a4262, f: 0x7c9cb4, g: 0x4c6c92, h: 0x324c74 },
  { a: 0xcacad2, b: 0x9c9cac, c: 0x70708a, d: 0x4e4e6c, f: 0x8c8ca2, g: 0x646480, h: 0x464660, B: 0xc8c8d0, C: 0x9c9cac, D: 0x70708a },
];
const STANDS = [
  { S: 0xb08068, T: 0x7c5060, U: 0x5a3e58, L: 0xd8a07c },
  { S: 0xda8c76, T: 0xa65a64, U: 0x784258, L: 0xf4b49a },
  {  },
  { S: 0x4a5a8e, T: 0x6ea4e8, U: 0x2c2c5a, L: 0xd2f4ff },
];
// The light each stand throws back up onto his soles; the black acrylic throws none.
const SOLES = [0x8c5c5a, 0xb06e6e, -1, 0x5c9ae6];
const BOOTS = [0xa0727a, 0xc08088, -1, 0x7cb0f0];
const GELS = [
  {  },
  { z: 0x8ed8ff, K: 0x7a96b4, J: 0x5a88ba, c: 0x6e7a96, d: 0x4e5c7e, q: 0x42668e, h: 0x2e4668 },
  { z: 0x8cf0a0, K: 0x86a07c, J: 0x5a9c8c, c: 0x6e8272, d: 0x4c6662, q: 0x3c6c70, h: 0x2c4c50 },
  { z: 0x6e8cff, K: 0x6a6caa, J: 0x4e5eb2, c: 0x64669c, d: 0x3e4a88, q: 0x384c98, h: 0x282e74 },
];
// The case light lifts the glossy materials above the legs one step: nickel and brass.
const UP = { o: "n", p: "o", q: "p", C: "B", D: "C" };
const SWEEPABLE = { torso: 1, arml: 0, armr: 1, gun: 1, head: 1, neck: 1 };

const { floor, min, max } = Math;

// One loop of 27.2 s (eight breaths). Nothing blinks, sweeps or glints
// between 1.5 and 2.5 s, where the still is taken.
const CYCLE = 27.2;
const BREATH = 3.4;
const BLINKS = [3.1, 6.6, 9.2, 13.4, 16.1, 20.5, 23.2];
const SWEEPS = [4.4, 12.6, 21.0];
const GLINTS = [7.4, 11.6, 18.0, 25.1];
const SWEEP_LEN = 3.0;
const GLINT_LEN = 0.2;
const BLINK_LEN = 0.34;

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
  const put = (m) => { for (const k in m) t[k.charCodeAt(0)] = m[k]; };
  put(PAL);
  put(EDITIONS[ed]);
  put(STANDS[stand]);
  put(GELS[gel]);
  // The boots' lowest rows carry the stand's light, Y where the leather is
  // darkest and X on its middle shade; the black acrylic throws none.
  t[89] = SOLES[stand] >= 0 ? SOLES[stand] : t[104];
  t[88] = BOOTS[stand] >= 0 ? BOOTS[stand] : t[103];
  return t;
}

function blit(buf, part, dx, dy, band, lowFrom, lowDx) {
  const rows = part.rows;
  for (let j = 0; j < rows.length; j++) {
    const y0 = part.y + j;
    const y = y0 + dy;
    if (y < 0 || y >= H) continue;
    const r = rows[j];
    const sx = y0 >= lowFrom ? dx + lowDx : dx;
    for (let i = 0; i < r.length; i++) {
      const ch = r.charCodeAt(i);
      if (ch === 46) continue;
      const x = part.x + i + sx;
      if (x < 0 || x >= W) continue;
      let c = ch;
      if (band > -99) {
        const s = x + y0 * 0.5 - band;
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
  params.ed = 0;
  params.stand = 2;
  params.detail = false;
  params.gel = 0;
}

export function update(dt, input, params) {
  if (!params.buf) setup(params);
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += min(dt || 0, 0.1);
  params.ed = min(3, max(0, floor(k[0] * 4)));
  params.stand = min(3, max(0, floor(k[1] * 4 / 3)));
  params.detail = k[2] >= 0.5;
  params.gel = min(3, max(0, floor(k[3] * 4)));
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

  // The breath lifts the chest, arms and revolver a pixel and holds it; the
  // head follows a quarter second later and the coat tails swing a pixel
  // after that. Legs and stand stay put. While the case light passes he holds
  // where he is, so the band never meets a part mid-step.
  let sw = since(SWEEPS, t, SWEEP_LEN);
  if (t - p.sweepAt < SWEEP_LEN) sw = t - p.sweepAt;
  const band = sw >= 0 ? -10 + (sw / SWEEP_LEN) * (W + H * 0.5 + 20) : -100;
  const tb = sw >= 0 ? t - sw : t;
  const u = (((tb - 0.4) % BREATH) + BREATH) % BREATH;
  const up1 = u >= 0.9 && u < 2.3 ? -1 : 0;
  const up2 = u >= 1.15 && u < 2.55 ? -1 : 0;
  const swing = u >= 1.35 && u < 2.75 ? 1 : 0;
  const dy = [0, up1, up2, 0];

  for (let n = 0; n < ORDER.length; n++) {
    const name = ORDER[n];
    const g = GROUP[name];
    const bd = SWEEPABLE[name] ? band : -100;
    if (name === "skirt") blit(buf, PARTS[name], 0, 0, -100, 94, swing);
    else blit(buf, PARTS[name], 0, dy[g], bd, 999, 0);
  }

  // Eyes: the shutters drop through a half-closed step and back.
  const db = since(BLINKS, t, BLINK_LEN);
  if (db >= 0) blit(buf, db < 0.1 || db >= 0.24 ? PARTS.eyeshalf : PARTS.eyesshut, 0, dy[2], -100, 999, 0);

  let dg = since(GLINTS, t, GLINT_LEN);
  if (t - p.glintAt < GLINT_LEN) dg = t - p.glintAt;
  if (dg >= 0) blit(buf, PARTS.glint, 0, dy[1], -100, 999, 0);

  const L = p.lut;
  // Detail cut: the box x 22-53, y 2-65 at exactly twice the size.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = p.detail ? buf[((y >> 1) + 2) * W + (x >> 1) + 22] : buf[y * W + x];
      if (!ch) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const c = L[ch];
      if (c < 0) display.setPixel(x, y, 255, 0, 255);
      else display.setPixel(x, y, (c >> 16) & 255, (c >> 8) & 255, c & 255);
    }
  }
}
