// ===== Patternflow pattern =====
// Title:   Ferrow
// Family:  pixel
// Idea:    A hand-pixelled figure of Ferrow, an old sentinel robot that has kept the last gate of a fallen citadel alone for two hundred years, standing on a display stand that fills the panel: bone-white enamel plates over a gunmetal frame, two exhaust stacks behind the shoulder, an antenna swept back from the ear, amber eyes in a dark visor, a plum tabard at the waist, and a greatsword as tall as he is carried on the shoulder, its fuller glowing like iron just out of the forge. He breathes, steam leaves his stacks, his eyes glance aside and blink, and twice a loop he swings the sword off his shoulder to stand it upright at his hip, turns it over in his hand and drives its point into the stand in a flash and a spray of sparks, leans on it a while and shoulders it again.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 86
// Round:   86
// ===============================
// @matrix 64x128
// @knobs Motion=0..1, Stand=0..3, Effect=0..1, Edition=0..1
//
// Knob 1: Motion. How he moves: below 0.25 he plants the sword twice a loop; from 0.25 he is restless and plants it four times; from 0.5 he stands guard with the sword held upright at his hip and his eyes flared white; from 0.75 he is on standby, leaning on the planted sword with his eyes down to an ember line, and only breathes.
// Knob 2: Stand. What he stands on: a turned wood plinth at 0, white marble from 1, black acrylic with a gold rim from 2, and from 3 an acrylic disc lit from its edge.
// Knob 3: Effect. What comes off him: steam from the stacks and sparks where the point bites below 0.25; from 0.25 a charge that turns his gunmetal and rim live blue with arcs crawling off his outline; from 0.5 an overheat, the gunmetal glowing red and hotter on each in-breath, with heavy steam; from 0.75 none.
// Knob 4: Edition. The paint: bone-white enamel below 0.25, the second-player black and teal from 0.25, a gold and chrome limited plating from 0.5, and from 0.75 the unpainted grey prototype.
// Buttons: K1 tap makes him plant the sword now; K2 tap sends the case light along him; K3 tap toggles the detail cut, his head, chest and sword hand at exactly twice the size; K4 tap makes the sword's point wink.

const W = 64, H = 128;
// Each part is a grid, one character per LED and "." where it is clear, drawn
// in ORDER. Materials run light to dark: enamel a b c d, gunmetal g h i j,
// tabard p q r s, blade steel m n o. C I R O are the shadow-side bounce next to
// the rim light z. f u v are the hot amber of the fuller and the eyes, x the
// dark of the visor, w the specular. U V X N are the stand, S T Y the steam.
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
    "....zmmnnnnnoooooo.........................",
    "....zmmmnnnnnoooooo........................",
    ".....zmmmnnnnnoooooo.......................",
    "......zmmmnnonnoooooo......................",
    ".......zmmmoonnnoooooo.....................",
    "........zmmnonnnnoooooo....................",
    ".........zmnmnnnuuoooooo...................",
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
    "..........................mmmmmnnfnnooooooo",
    "...........................mmmmmnnnnnooooo.",
    "............................mmnnnnnnnnooo..",
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
    "dddccccccccaaabbbbbbbbbbbaaa.",
    "dddccccccccbbbaaabbbbbaaabbdd",
    "dddccccccccdddbbbaaaaabbbddxx",
    "zCCcchcccccxxxdddbbbbbdddxxxx",
    "zCCiihhhcccxxxxxxdddddxxxxxxx",
    "zCCiihghcccxxxuuwxxxxxxxuwxxx",
    "zCCiihghcccxxxufffuxxxuffuxxx",
    "zCIiihhhhccxxxxufuuxxxuuuxxxx",
    ".zCIiiiicccxxxxxxxxxxxxxxxxxx",
    ".zCIiiiicccxxxxxxxxxxxxxxxxxx",
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
  torso_u: { x: 38, y: 47, rows: [
    ".bbb.....",
    "bbbb...c.",
    "..b....c.",
    ".......dd",
  ] },
  paulfar_u: { x: 45, y: 45, rows: [
    ".b.",
    "bb.",
    "bb.",
    ".i.",
    ".ii",
    "..j",
  ] },
  chest_u: { x: 41, y: 43, rows: [
    "bb.....",
    "b......",
    "...cb..",
    ".......",
    "..b....",
    ".......",
    ".......",
    ".......",
    ".....dd",
  ] },
  armfar_m: { x: 49, y: 48, rows: [
    "..jhg..........",
    ".jjihgg........",
    "jjjiihhhgg.....",
    "zIIiihhhhbba...",
    "zjjiiihhcbbaa..",
    ".jjjiiiccbbaaa.",
    "..zIIjcccccbbaa",
    "....zIcccccbaaa",
    ".....zcccbbaaaa",
    ".....dcccbbaaa.",
    ".....dcccbbaaa.",
    "....ddcccbbaa..",
    ".....dcccbbaa..",
    ".....dcccbba...",
    "......cccbb....",
    "........c......",
  ] },
  headrim: { x: 19, y: 11, rows: [
    "....z",
    "...z.",
    "..z..",
    ".z...",
    ".z...",
    ".zCC.",
    ".zCC.",
    "zCC..",
    "zCC..",
    "zCC..",
  ] },
  blade_m: { x: 52, y: 4, rows: [
    "....z....",
    "...zOO...",
    "...zOO...",
    "..zOOoo..",
    "..zOOoo..",
    ".zmnoooo.",
    ".zmnoooo.",
    "zmmnooooo",
    "zmmnooooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "nmmnuoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnfoooo",
    "nmmnooooo",
    "nmmnooooo",
    "nmmnooooo",
  ] },
  hilt_m: { x: 50, y: 52, rows: [
    "iiigggggggggg",
    "zIIhhhhhhhhhh",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....zRR.....",
    ".....zRR.....",
    ".....zRR.....",
    ".....zhr.....",
    ".....zgg.....",
    "....zhggh....",
    ".....zhh.....",
    "......z......",
  ] },
  fist_m: { x: 52, y: 56, rows: [
    "...jhg...",
    "..zIhgg..",
    ".zIIhhgw.",
    "zIIihhggg",
    "zIIjhhggg",
    "zIIijjggg",
    ".zIIhhjg.",
    "..zIhgg..",
    "...zhg...",
  ] },
  armfar_b: { x: 49, y: 48, rows: [
    "..jhg..........",
    ".jiiihg........",
    "jjijjihhgg.....",
    "zIIijihhhbba...",
    "zIIijjhhcbbaa..",
    ".zIIjjiccbbaaa.",
    "..zIIjcccbbaaaa",
    "....zIcccbbaaaa",
    ".....zcccbbaaaa",
    ".....dcccbbaaa.",
    ".....dcccbbaaa.",
    "....ddcccbbaa..",
    ".....dcccbbaa..",
    ".....dcccbba...",
    "......cccbb....",
    "........c......",
  ] },
  blade_b: { x: 52, y: 69, rows: [
    "zOOoooooo",
    "zOOoooooo",
    "zmmnooooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnfoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnuoooo",
    "zmmnooooo",
    "zmmnooooo",
    "nmmnooooo",
    "nmmnooooo",
    ".mmnoooo.",
    ".mmnoooo.",
    "..mnooo..",
    "..mnooo..",
    "...noo...",
    "...noo...",
    "....o....",
    "....o....",
  ] },
  hilt_b: { x: 50, y: 46, rows: [
    "......h......",
    ".....hgg.....",
    "....hhggh....",
    ".....hhh.....",
    ".....shr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....zRR.....",
    ".....zRR.....",
    "zIIgggggggggg",
    "zIIhhhhhhhhhh",
  ] },
  fist_b: { x: 52, y: 56, rows: [
    "...jhg...",
    "..zIhgg..",
    ".zIIhhgw.",
    "zIIihhggg",
    "zIIjhhggg",
    "zIIijjggg",
    ".zIIhhjg.",
    "..zIhgg..",
    "...zhg...",
  ] },
  smear_up: { x: 9, y: 0, rows: [
    "......ooommmmmmmmmmmmmmmmmmmmmmmmmmooooo........",
    ".....mmmmmmmmmmmoooooooooooommmmmmmmmmmooo......",
    "..mmmommmoooooooo...........ooooooommmmmmmmm....",
    "mmoooooooo.........................oooommoommm..",
    "oo.....................................ooo.ooomm",
    "..............................................oo",
  ] },
  smear_flip: { x: 54, y: 6, rows: [
    "oo........",
    "oo........",
    "ooo.......",
    ".oo.......",
    ".oo.......",
    ".oo.......",
    ".oo.......",
    ".oo.......",
    "..oo......",
    ".ommo.....",
    ".ommo.....",
    ".ommo.....",
    ".ommo.....",
    "..ommo....",
    "..ommo....",
    "..ommo....",
    "..ommo....",
    "..ommo....",
    "..oommo...",
    "...ommo...",
    "...ommo...",
    "...ommo...",
    "...ommo...",
    "...ommo...",
    "...oommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    "......ommo",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    ".....ommo.",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "....ommo..",
    "...ommoo..",
    "...ommo...",
    "...ommo...",
    "...ommo...",
    "...ommo...",
    "...ommo...",
    "..ommoo...",
    "..ommo....",
    "..ommo....",
    "..ommo....",
    "..ommo....",
    "..ommo....",
    ".ommo.....",
    ".ommo.....",
    ".ommo.....",
    ".ommo.....",
    "..oo......",
    ".oo.......",
    ".oo.......",
    ".oo.......",
    ".oo.......",
    ".oo.......",
    "ooo.......",
    "oo........",
    "oo........",
  ] },
};
// The three poses: the sword on the shoulder, held upright, and planted.
const ORDER = ["base", "pack", "blade", "legfar", "legnear", "spine", "hips", "tabard", "tabtip", "torso", "neck", "paulfar", "armfar", "paulnear", "armnear", "head", "hilt", "fistfar"];
const ORDER_M = ["base", "pack", "legfar", "legnear", "spine", "hips", "tabard", "tabtip", "torso", "torso_u", "neck", "paulfar", "paulfar_u", "chest_u", "armfar_m", "paulnear", "armnear", "head", "headrim", "blade_m", "hilt_m", "fist_m"];
const ORDER_B = ["base", "pack", "legfar", "legnear", "spine", "hips", "tabard", "tabtip", "torso", "torso_u", "neck", "paulfar", "paulfar_u", "chest_u", "armfar_b", "paulnear", "armnear", "head", "headrim", "blade_b", "hilt_b", "fist_b"];
// Which breath each part follows: 0 stays, 1 the chest, 2 the head a beat later, 3 the tabard's hem, which swings sideways, 4 the planted blade, which stays but still takes the case light.
const GROUP = {"base": 0, "pack": 1, "blade": 1, "legfar": 0, "legnear": 0, "spine": 0, "hips": 0, "tabard": 0, "tabtip": 3, "torso": 1, "neck": 1, "paulfar": 1, "armfar": 1, "paulnear": 1, "armnear": 1, "head": 2, "hilt": 1, "fistfar": 1, "armfar_m": 1, "blade_m": 1, "hilt_m": 1, "fist_m": 1, "armfar_b": 1, "blade_b": 4, "hilt_b": 4, "fist_b": 1, "torso_u": 1, "paulfar_u": 1, "chest_u": 1, "headrim": 2, "smear_up": 1, "smear_flip": 1};
const PAL = { a: 0xf2e2c0, b: 0xd8c4a2, c: 0xa7978f, d: 0x6f6684, g: 0x93a3c2, h: 0x5d6890, i: 0x3e4374, j: 0x2b2a56, p: 0xc87a96, q: 0x96507e, r: 0x683768, s: 0x3f1f56, m: 0xe4eef5, n: 0xa8bad4, o: 0x6a7aa6, f: 0xffd884, u: 0xff9b30, v: 0xd2552e, x: 0x2a2450, z: 0x8cccff, w: 0xfffaf0, C: 0xa7978f, I: 0x48538a, R: 0x683768, O: 0x6a7aa6, U: 0x48538a, V: 0x2f2f62, X: 0x2a2450, N: 0xd6b075, S: 0xd6dde6, T: 0xa8bad4, Y: 0x6a7aa6 };
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
// Knob 3: what the frame does to the steel. Steam and off leave it; the charge
// turns the gunmetal, the rim, the eyes and the fuller a live blue that surges
// brighter now and then; the overheat runs the gunmetal orange hot, brighter
// than the enamel, and hotter again on each in-breath.
// Z is the arcs, a shade apart from the charged rim.
const CHARGE = [
  { g: 0x58b0f0, h: 0x3a70d0, i: 0x2c44a0, j: 0x24286e, I: 0x3a5cc0, z: 0xd8f4ff, O: 0x5a90d8, Z: 0x6fd0ff, u: 0x40c8ff, f: 0xa8ecff, v: 0x3a78e0 },
  { g: 0xb8eaff, h: 0x70b8ff, i: 0x4070e0, j: 0x30349a, I: 0x5a88f0, z: 0xf0fcff, O: 0x80b8f8, Z: 0xa8e8ff, u: 0x80e0ff, f: 0xd8f8ff, v: 0x4a90f0 },
];
const HEAT = [
  { g: 0xffe08a, h: 0xffa040, i: 0xd8602c, j: 0x8a3038, I: 0xc05a40 },
  { g: 0xfff0b0, h: 0xffc060, i: 0xf07a34, j: 0xa83a3a, I: 0xd8703c },
];
// The case light: what a glossy character turns into while the band passes.
const UP = {"n": "m", "o": "n", "O": "n", "h": "g", "i": "h", "I": "h", "j": "i"};
// The eyes, x, y and colour, painted over the visor each frame so they can
// look aside, half shut, shut to an ember line, or flare.
const EYES = [[33, 23, "u"], [34, 23, "u"], [35, 23, "w"], [43, 23, "u"], [44, 23, "w"],
  [33, 24, "u"], [34, 24, "f"], [35, 24, "f"], [36, 24, "f"], [37, 24, "u"], [41, 24, "u"], [42, 24, "f"], [43, 24, "f"], [44, 24, "u"],
  [34, 25, "u"], [35, 25, "f"], [36, 25, "u"], [37, 25, "u"], [41, 25, "u"], [42, 25, "u"], [43, 25, "u"]];
const FLARE = { u: "f", f: "w", w: "w" };
// The wink on the sword's point: x, y and what the LED turns into.
const GLINT = [[10, 5, "w"], [9, 4, "w"], [11, 5, "w"]];
// Where the planted point bites the stand, and the glow it throws on the rim.
const BITE_X = 56, BITE_Y = 116;
// What does not sink with him.
const FIRM = { base: 1, legfar: 1, legnear: 1 };
const SPILL = [[53, 118, "f"], [54, 118, "w"], [55, 118, "w"], [56, 118, "w"], [57, 118, "f"], [54, 119, "f"], [55, 119, "f"], [56, 119, "f"]];
// A ring running out along the stand from the bite, a step at a time.
const SHOCK = [4, 9, 15, 22, 30, 38];
// The flash at the moment of the bite, for its first two fifteenths of a second.
const FLASH = [[56, 111, "f"], [56, 112, "w"], [56, 113, "w"], [56, 114, "w"], [53, 116, "w"], [54, 116, "w"], [55, 116, "w"], [57, 116, "w"], [58, 116, "w"], [51, 116, "f"], [52, 116, "f"], [59, 116, "f"], [60, 116, "f"], [54, 114, "f"], [58, 114, "f"], [53, 113, "u"], [59, 113, "u"], [56, 110, "u"]];
// The two exhaust mouths and how late each puffs after the other. A
// puff swells and thins as it rises up and away to the left: S T Y light to
// dim, its own letters so a repaint of the steel never reaches it.
const STACKS = [[16, 27, 0], [10, 30, 0.2]];
const PUFF = [
  [".S.", "SSS", ".S."],
  [".SSS.", "SSSSS", "SSSST", ".STT."],
  [".SSSS.", "SSSSST", "SSSSTT", "TSSTTT", ".TTT.."],
  ["..TTT..", ".TTTTTY", "TTTTTYY", "TTTYYY.", ".YYY..."],
  ["..YYY.", ".YYYYY", "YYYYY.", ".YY..."],
  [".YY.", "YYYY"],
];

const { floor, min, max, abs, cos, sin, PI } = Math;
// The events run on a fixed loop of exactly eight breaths, so they always meet
// the breath at the same phase. Blinks come 2 to 3.3 s apart and never while
// the head is moving; the case light every 6.8 s, taking 2.4 s to cross, at a
// phase where no breath step meets its edge; the glint on the point every 3 or
// more, always while the sword is on the shoulder. The sword comes down twice
// a loop and the eyes glance aside between. None falls between 1.5 and 2.5 s,
// where the still is taken.
const CYCLE = 27.2;
const BLINKS = [0.6, 3.3, 6.4, 9.0, 12.0, 14.3, 17.6, 20.1, 23.4, 25.8];
const SWEEPS = [4.3, 11.1, 17.9, 24.7];
const GLINTS = [3.0, 12.6, 15.8, 25.0];
const PLANTS = [7.0, 20.6];
const PLANTS_KEEN = [1.6, 8.4, 15.2, 22.0];
const SCANS = [[4.8, -2, 1.1], [10.95, 2, 0.9], [15.2, -2, 1.1], [18.4, 2, 1.0], [24.4, -2, 1.2]];
const SWEEP_LEN = 2.4;
const GLINT_LEN = 0.17;
// The big move: the sword comes off the shoulder upright, bites the stand
// point first at LIFT, is leant on until DOWN, and goes back up the same way.
// Each knob 1 stop has a pose it rests in between: shouldered, shouldered,
// held upright on guard, and planted on standby.
const LIFT = 6 / 15, DOWN = 51 / 15, PLANT_LEN = 55 / 15;
const REST = [0, 0, 1, 2];
// The swing drawn behind the figure as the pose changes, by from * 3 + to: an
// arc over the head between shoulder and upright, and a crescent down the right
// side as the sword turns over in the hand.
const SMEAR = [null, "smear_up", null, "smear_up", null, "smear_flip", null, "smear_flip", null];
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

function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

function lut(ed, stand, fx, tier) {
  const t = new Int32Array(128).fill(-1);
  const put = (p) => {
    for (const ch in p) t[ch.charCodeAt(0)] = p[ch];
  };
  put(PAL);
  put(EDITIONS[ed]);
  put(STANDS[stand]);
  if (fx === 1) put(CHARGE[tier]);
  if (fx === 2) put(HEAT[tier]);
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

// Into clear LEDs only, so it passes behind the figure.
function under(buf, x, y, ch) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = y * W + x;
  if (!buf[i]) buf[i] = ch.charCodeAt(0);
}

function over(buf, x, y, ch) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  buf[y * W + x] = ch.charCodeAt(0);
}

// Seconds since the sword started down, or -1.
function plantSince(p, t, motion) {
  const list = motion === 0 ? PLANTS : motion === 1 ? PLANTS_KEEN : null;
  let d = list ? since(list, t, PLANT_LEN) : -1;
  const b = t - p.plantAt;
  if (b >= 0 && b < PLANT_LEN) d = b;
  return d;
}

// A puff leaves each stack once each half of the breath has settled, and twice
// as often on the overheat.
function steam(buf, t, heavy) {
  const life = heavy ? 2.0 : 1.8, phases = heavy ? [1.3, 2.15, 3.0, 0.45] : [1.3, 3.0];
  for (let s = 0; s < STACKS.length; s++) {
    const [x0, y0, lag] = STACKS[s];
    for (let f = 0; f < phases.length; f++) {
      const at = phases[f] + lag;
      const age = t - (at + floor((t - at) / BREATH) * BREATH);
      if (age < 0 || age >= life) continue;
      const shape = PUFF[min(5, floor(age / life * 6))];
      const cx = floor(x0 - age * (heavy ? 5 : 4) + 0.5), cy = floor(y0 - 1 - age * 7 + 0.5);
      const x1 = cx - (shape[0].length >> 1), y1 = cy - shape.length + 1;
      for (let j = 0; j < shape.length; j++) {
        for (let i = 0; i < shape[j].length; i++) if (shape[j][i] !== ".") under(buf, x1 + i, y1 + j, shape[j][i]);
      }
    }
  }
}

function sparks(buf, tt0, tt, seed) {
  // Embers skid out along the stand top, most of them to the left.
  for (let n = 0; n < 6; n++) {
    const h = hash(seed * 17 + n + 99);
    const age = tt - tt0, life = 0.3 + (h & 7) / 30;
    if (age < 0 || age >= life) continue;
    const v = (40 + ((h >>> 3) & 31)) * (n < 4 ? -1 : 1);
    const x = floor(BITE_X + v * age * (1 - age) + 0.5), y = BITE_Y + 1 - ((h >>> 9) & 1);
    if (x >= 0 && x < W && buf[y * W + x]) over(buf, x, y, age < 0.15 ? "w" : "f");
  }
  for (let n = 0; n < 14; n++) {
    const h = hash(seed * 31 + n);
    const ang = -PI * (0.35 + 0.42 * (h & 1023) / 1023);
    const sp = 55 + ((h >>> 10) & 31), life = 0.4 + ((h >>> 15) & 15) / 30;
    const age = tt - tt0;
    if (age < 0 || age >= life) continue;
    const at = (q) => [floor(BITE_X + cos(ang) * sp * q + 0.5), floor(BITE_Y + sin(ang) * sp * q + 55 * q * q + 0.5)];
    const [x, y] = at(age);
    if (y > BITE_Y + 2) continue;
    const [px, py] = at(max(0, age - 1 / 15));
    const steps = max(abs(x - px), abs(y - py));
    for (let k = 1; k < steps; k++) over(buf, px + floor((x - px) * k / steps + 0.5), py + floor((y - py) * k / steps + 0.5), age < 0.35 ? "f" : "u");
    over(buf, x, y, age < 0.3 ? "w" : "f");
  }
}

// The arcs for two fifteenths of a second, worked out once from where the
// outline is when they start.
function arcs(buf, slot) {
  const out = [];
  const h = hash(slot * 7 + 3);
  if ((h & 7) === 0) return out;
  const count = 1 + ((h >>> 4) & 1) + ((h >>> 5) & 1);
  for (let a = 0; a < count; a++) {
    const g = hash(h + a * 101);
    const y0 = 22 + (g % 88), left = (g >>> 8) & 1;
    let x = -1;
    if (left) { for (let i = 0; i < W; i++) if (buf[y0 * W + i]) { x = i; break; } }
    else { for (let i = W - 1; i >= 0; i--) if (buf[y0 * W + i]) { x = i; break; } }
    if (x < 0) continue;
    // A jagged run outward, never level for two steps, with a fork off its
    // second step that kicks the other way.
    let y = y0, fx = 0, fy = 0;
    const len = 4 + ((g >>> 10) % 5), step = left ? -1 : 1;
    const put = (px, py, ch) => {
      if (py >= 0 && py < H && px >= 0 && px < W && !buf[py * W + px]) out.push([px, py, ch]);
    };
    for (let k = 1; k <= len; k++) {
      x += step;
      y += (g >>> (12 + k)) & 1 ? 1 : -1;
      put(x, y, k < len ? "w" : "Z");
      if (k === 2) { fx = x; fy = y; }
    }
    const kick = (g >>> 13) & 1 ? -1 : 1;
    put(fx + step, fy + kick * 2, "Z");
    put(fx + step * 2, fy + kick * 3, "Z");
  }
  return out;
}

export function setup(params) {
  params.t = 0;
  params.buf = new Uint8Array(W * H);
  params.key = -1;
  params.sweepAt = -10;
  params.glintAt = -10;
  params.plantAt = -10;
  params.arcSlot = -1;
  params.arcPix = [];
  params.motion = 0;
  params.stand = 2;
  params.fx = 0;
  params.zoom = false;
  params.ed = 0;
  params.tick = -1;
  params.now = [0, 2, 0, 0, false];
}

export function update(dt, input, params) {
  if (!params.buf) setup(params);
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += min(dt || 0, 0.1);
  params.motion = min(3, max(0, floor(k[0] * 4)));
  params.stand = min(3, max(0, floor(k[1])));
  params.fx = min(3, max(0, floor(k[2] * 4)));
  params.ed = min(3, max(0, floor(k[3] * 4)));
  const b = input.btnPressed;
  if (b && b[0] && plantSince(params, params.t, params.motion) < 0) params.plantAt = params.t;
  if (b && b[1]) params.sweepAt = params.t;
  if (b && b[2]) params.zoom = !params.zoom;
  if (b && b[3]) params.glintAt = params.t;
}

export function draw(display, params) {
  const p = params;
  if (!p.buf) setup(p);
  // Everything steps at 15 a second, two of the Lab's frames, so no LED can
  // hold a state for a single frame.
  const tick = floor(p.t * 15 + 0.25), t = tick / 15;
  // Knobs and the cut are taken at the step too.
  if (tick !== p.tick) {
    p.tick = tick;
    p.now = [p.motion, p.stand, p.fx, p.ed, p.zoom];
  }
  const [motion, stand, fx, ed, zoom] = p.now;
  const buf = p.buf;
  buf.fill(0);

  const u = (((t - 1.5) % BREATH) + BREATH) % BREATH;
  const dy = [0, u >= 1.1 && u < 2.8 ? -1 : 0, u >= 1.35 && u < 3.05 ? -1 : 0, 0, 0];
  const dx = [0, 0, 0, u >= 1.45 && u < 3.15 ? -1 : 0, 0];

  // Shouldered, upright or planted, and the swing behind the figure for the
  // two steps after it changes.
  const poseAt = (q) => {
    const e = plantSince(p, q, motion);
    return e < 0 ? REST[motion] : e < LIFT || e >= DOWN ? 1 : 2;
  };
  const d = plantSince(p, t, motion);
  const pose = poseAt(t), was = poseAt((tick - 2) / 15);
  const smear = was !== pose ? SMEAR[was * 3 + pose] : null;
  const sd = d >= LIFT && d < DOWN ? d - LIFT : -1;
  // He sinks into his knees a pixel as he swings, and two as the point bites;
  // only the legs, the stand and the planted sword stay. On standby the head
  // hangs a pixel.
  const sink = d >= 0 && d < 2 / 15 ? 1 : sd >= 0 && sd < 2 / 15 ? 2 : sd >= 0 && sd < 4 / 15 ? 1 : 0;
  dy[1] += sink;
  dy[3] += sink;
  dy[2] += sink + (motion === 3 && d < 0 ? 1 : 0);

  let sw = since(SWEEPS, t, SWEEP_LEN);
  if (t >= p.sweepAt && t - p.sweepAt < SWEEP_LEN) sw = t - p.sweepAt;
  const sweep = sw >= 0;
  const band = -8 + (sw / SWEEP_LEN) * (W + H * 0.5 + 16);

  // The case light passes over the steel above the stand; the legs and the stand keep still.
  const order = pose === 0 ? ORDER : pose === 1 ? ORDER_M : ORDER_B;
  if (smear) blit(buf, PARTS[smear], 0, dy[1], false, 0);
  for (let n = 0; n < order.length; n++) {
    const name = order[n], g = GROUP[name];
    blit(buf, PARTS[name], dx[g], dy[g] + (g === 0 && !FIRM[name] ? sink : 0), sweep && g !== 0, band);
  }

  // The eyes: clear the visor behind them, then paint them where they look.
  const hy = dy[2];
  for (let y = 23; y <= 25; y++) {
    for (let x = 31; x <= 46; x++) {
      const i = (y + hy) * W + x, c = buf[i];
      if (c === 117 || c === 102 || c === 119) buf[i] = 120;
    }
  }
  // On standby the eyes are down to the ember line between the shutters.
  const db = since(BLINKS, t, 0.3);
  const lid = motion === 3 && d < 0 ? 2 : db < 0 ? 0 : db < 0.08 || db >= 0.2 ? 1 : 2;
  let look = 0;
  if (d < 0 && motion !== 3) {
    const u2 = t % CYCLE;
    for (let s = 0; s < SCANS.length; s++) if (u2 >= SCANS[s][0] && u2 < SCANS[s][0] + SCANS[s][2]) look = SCANS[s][1];
  }
  const mood = (d >= 0 && d < LIFT + 1) || motion === 2 ? FLARE : null;
  for (let e = 0; e < EYES.length; e++) {
    const [x, y, c] = EYES[e];
    if (lid === 1 && y === 23) continue;
    if (lid === 2 && y !== 24) continue;
    over(buf, x + look, y + hy, lid === 2 ? "v" : mood ? mood[c] : c);
  }

  let dg = since(GLINTS, t, GLINT_LEN);
  if (t >= p.glintAt && t - p.glintAt < GLINT_LEN) dg = t - p.glintAt;
  if (dg >= 0 && pose === 0) {
    for (let i = 0; i < GLINT.length; i++) {
      const g = GLINT[i], at = (g[1] + dy[1]) * W + g[0];
      if (buf[at]) buf[at] = g[2].charCodeAt(0);
    }
  }

  if ((fx === 0 || fx === 2) && motion !== 3) steam(buf, t, fx === 2);
  if (fx === 1) {
    const slot = tick >> 1;
    if (slot !== p.arcSlot) {
      p.arcSlot = slot;
      p.arcPix = arcs(buf, slot);
    }
    for (let i = 0; i < p.arcPix.length; i++) under(buf, p.arcPix[i][0], p.arcPix[i][1], p.arcPix[i][2]);
  }
  if (fx !== 3 && sd >= 0 && sd < 0.9) {
    const t0 = t - sd;
    sparks(buf, t0, t, floor(t0 * 10 + 0.5));
    // The stand's gold ring answers the bite: white, then amber.
    if (sd < 4 / 15) {
      const ring = sd < 2 / 15 ? 119 : 102;
      for (let i = 104 * W; i < H * W; i++) if (buf[i] === 78) buf[i] = ring;
    }
    if (sd < 0.3) for (let i = 0; i < SPILL.length; i++) over(buf, SPILL[i][0], SPILL[i][1], sd < 0.15 ? SPILL[i][2] : "u");
    const r = SHOCK[floor(sd * 15 + 0.5)];
    if (r) {
      for (let s = -1; s <= 1; s += 2) {
        const x = BITE_X + s * r;
        if (x >= 0 && x < W && buf[117 * W + x]) over(buf, x, 117, "w");
        if (x - s >= 0 && x - s < W && buf[117 * W + x - s]) over(buf, x - s, 117, "f");
      }
    }
    if (sd < 0.14) for (let i = 0; i < FLASH.length; i++) over(buf, FLASH[i][0], FLASH[i][1], FLASH[i][2]);
  }

  const tier = fx === 2 ? (u >= 1.1 && u < 2.8 ? 1 : 0) : fx === 1 ? (hash((tick >> 1) * 13 + 5) % 7 === 0 ? 1 : 0) : 0;
  const key = ed * 64 + stand * 16 + fx * 4 + tier;
  if (key !== p.key) {
    p.key = key;
    p.lut = lut(ed, stand, fx, tier);
  }
  const L = p.lut;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = zoom ? buf[(CUT_Y + (y >> 1)) * W + CUT_X + (x >> 1)] : buf[y * W + x];
      const c = ch ? L[ch] : -1;
      if (c < 0) display.setPixel(x, y, 0, 0, 0);
      else display.setPixel(x, y, (c >> 16) & 255, (c >> 8) & 255, c & 255);
    }
  }
}
