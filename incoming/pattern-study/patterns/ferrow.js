// ===== Patternflow pattern =====
// Title:   Ferrow
// Family:  pixel
// Idea:    A hand-pixelled figure of Ferrow, an old sentinel robot that has kept the last gate of a fallen citadel alone for two hundred years, standing on a display stand that fills the panel: bone-white enamel plates over a gunmetal frame, two exhaust stacks behind the shoulder, an antenna swept back from the ear, amber eyes in a dark visor, a plum tabard at the waist, and a greatsword as tall as he is carried on the shoulder, its fuller glowing like iron just out of the forge. He breathes, steam leaves his stacks, his eyes glance aside and blink, and twice a loop he takes the sword off his shoulder, raises it upright and drives its point into the stand in a spray of sparks, leans on it a while and shoulders it again.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 86
// Round:   86
// ===============================
// @matrix 64x128
// @knobs Motion=0..1, Stand=0..3, Effect=0..1, Edition=0..1
//
// Knob 1: Motion. How he moves: below 0.25 he plants the sword twice a loop; from 0.25 he is restless and plants it four times; from 0.5 he stands guard, the sword planted and his eyes flared; from 0.75 he is on standby with dimmed eyes, breathing and blinking only.
// Knob 2: Stand. What he stands on: a turned wood plinth at 0, white marble from 1, black acrylic with a gold rim from 2, and from 3 an acrylic disc lit from its edge.
// Knob 3: Effect. What comes off him: steam from the stacks and sparks where the point bites below 0.25; from 0.25 a charge that turns his gunmetal and rim live blue with arcs crawling off his outline; from 0.5 an overheat, the gunmetal glowing red and hotter on each in-breath, with heavy steam; from 0.75 none.
// Knob 4: Edition. The paint: bone-white enamel below 0.25, the second-player black and teal from 0.25, a gold and chrome limited plating from 0.5, and from 0.75 the unpainted grey prototype.
// Buttons: K1 tap makes him plant the sword now; K2 tap sends the case light along him; K3 tap toggles the detail cut, his head, chest and sword hand at exactly twice the size; K4 tap makes the sword's point wink.

const W = 64, H = 128;
// Each part is a grid, one character per LED and "." where it is clear, drawn
// in ORDER. Materials run light to dark: enamel a b c d, gunmetal g h i j,
// tabard p q r s, blade steel m n o. C I R O are the shadow-side bounce next to
// the rim light z. f u v are the hot amber of the
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
  armfar_m: { x: 49, y: 40, rows: [
    "......c......",
    "....cccbb....",
    "...dcccbba...",
    "...dcccbba...",
    "..ddcccbbaa..",
    "...ddccbbaa..",
    "...ddccbbaa..",
    "...ddccbbaa..",
    "..jdcccbbaa..",
    ".jiddccbbaa..",
    "jjjdddcbbaaa.",
    "zIIdddcbbaaa.",
    "zIIidccbbaaa.",
    ".zIIcccbbaaa.",
    "..zICccbbaaa.",
    "...zCCcbbaaa.",
    "....zCCbbaaaa",
    "....zCCbbaaaa",
    "....zCCbbaaaa",
    ".....zCbbaaa.",
    "......zbbaa..",
    ".......zba...",
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
    "..z...",
    "..z...",
    ".zOO..",
    ".zOO..",
    ".zOOn.",
    "zIOon.",
    "zIOonn",
    "zIOonn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIvvnn",
    "zIOonn",
    "zIOonn",
    "zIOonn",
    "zIOonn",
  ] },
  hilt_m: { x: 49, y: 34, rows: [
    "zIIgggggggggg",
    "zIIhhhhhhhhhh",
    ".............",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....sir.....",
    ".....igg.....",
    "....hhggh....",
    ".....hhh.....",
    "......h......",
  ] },
  fist_m: { x: 51, y: 37, rows: [
    "...jhg...",
    "..jihgg..",
    ".jiihhgw.",
    "jjiihhggg",
    "jjjjhhggg",
    "jjiijjggg",
    ".jiihhjg.",
    "..jihgg..",
    "...jhg...",
  ] },
  armfar_b: { x: 49, y: 48, rows: [
    "..jhg........",
    ".jihhg.......",
    "jjihhgg......",
    "zIIihhgg.....",
    "zIIihhhgg....",
    ".zIIihhbba...",
    "..zjiibbbaa..",
    "...jjcbbbaaa.",
    "....ccbbbaaaa",
    "...cccbbbaaaa",
    "..dcccbbbaaaa",
    "..dcccbbbaaa.",
    ".ddcccbbbaa..",
    "..dcccbbba...",
    "..dcccbbb....",
    "...cccbb.....",
    ".....c.......",
  ] },
  blade_b: { x: 50, y: 67, rows: [
    "zIOoooo",
    "zIOoooo",
    "zIOoonn",
    "zIOoonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "zIOvonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "zIOvonn",
    "zIOvonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiovonn",
    "iiooonn",
    "iiooonn",
    "iiooonn",
    "iiooonn",
    ".iooon.",
    ".iooon.",
    ".iooon.",
    "..ooo..",
    "..ooo..",
    "..ooo..",
    "...o...",
    "...o...",
  ] },
  hilt_b: { x: 47, y: 53, rows: [
    "......h......",
    ".....hgg.....",
    "....zhggh....",
    ".....hhh.....",
    "......h......",
    ".............",
    ".............",
    ".............",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    ".....ssr.....",
    "zIIhhhhgggggg",
    "zIIiiihhhhhhh",
  ] },
  fist_b: { x: 49, y: 56, rows: [
    "...zhg...",
    "..zIhgg..",
    ".zIIhhgw.",
    "zIIihhggg",
    "zIIjhhggg",
    "zIIijjggg",
    ".zIIhhjg.",
    "..zIhgg..",
    "...zhg...",
  ] },
};
// The three poses: the sword on the shoulder, held upright, and planted.
const ORDER = ["base", "pack", "blade", "legfar", "legnear", "spine", "hips", "tabard", "tabtip", "torso", "neck", "paulfar", "armfar", "paulnear", "armnear", "head", "hilt", "fistfar"];
const ORDER_M = ["base", "pack", "legfar", "legnear", "spine", "hips", "tabard", "tabtip", "torso", "torso_u", "neck", "paulfar", "paulfar_u", "chest_u", "armfar_m", "paulnear", "armnear", "head", "headrim", "blade_m", "hilt_m", "fist_m"];
const ORDER_B = ["base", "pack", "legfar", "legnear", "spine", "hips", "tabard", "tabtip", "torso", "torso_u", "neck", "paulfar", "paulfar_u", "chest_u", "armfar_b", "paulnear", "armnear", "head", "headrim", "blade_b", "hilt_b", "fist_b"];
// Which breath each part follows: 0 stays, 1 the chest, 2 the head a beat later, 3 the tabard's hem, which swings sideways, 4 the planted blade, which stays but still takes the case light.
const GROUP = {"base": 0, "pack": 1, "blade": 1, "legfar": 0, "legnear": 0, "spine": 0, "hips": 0, "tabard": 0, "tabtip": 3, "torso": 1, "neck": 1, "paulfar": 1, "armfar": 1, "paulnear": 1, "armnear": 1, "head": 2, "hilt": 1, "fistfar": 1, "armfar_m": 1, "blade_m": 1, "hilt_m": 1, "fist_m": 1, "armfar_b": 1, "blade_b": 4, "hilt_b": 4, "fist_b": 1, "torso_u": 1, "paulfar_u": 1, "chest_u": 1, "headrim": 2};
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
// Knob 3: what the frame does to the steel. Steam and off leave it; the charge
// turns the gunmetal and the rim to a live blue; the overheat runs the gunmetal
// red hot, one shade hotter on each in-breath.
// Z is the arcs, a shade apart from the charged rim.
const CHARGE = { g: 0xa6dcf2, h: 0x5a8fc8, i: 0x3a5aa0, j: 0x2c3480, I: 0x4a70b0, z: 0xc8f0ff, O: 0x6aa0d0, Z: 0x6fd0ff };
const HEAT = [
  { g: 0xf0a070, h: 0xc05a48, i: 0x86344c, j: 0x56265a, I: 0x7a3a5a },
  { g: 0xffc080, h: 0xe07448, i: 0xa0404a, j: 0x642a5c, I: 0x8a4058 },
];
// The case light: what a glossy character turns into while the band passes.
const UP = {"n": "m", "o": "n", "O": "n", "h": "g", "i": "h", "I": "h", "j": "i"};
// The eyes, x, y and colour, painted over the visor each frame so they can
// look aside a pixel, half shut, shut to an ember line, flare or dim.
const EYES = [[33, 23, "u"], [34, 23, "u"], [35, 23, "w"], [43, 23, "u"], [44, 23, "w"],
  [33, 24, "u"], [34, 24, "f"], [35, 24, "f"], [36, 24, "f"], [37, 24, "u"], [41, 24, "u"], [42, 24, "f"], [43, 24, "f"], [44, 24, "u"],
  [34, 25, "u"], [35, 25, "f"], [36, 25, "u"], [37, 25, "u"], [41, 25, "u"], [42, 25, "u"], [43, 25, "u"]];
const FLARE = { u: "f", f: "w", w: "w" };
const DIM = { u: "v", f: "u", w: "f" };
// The wink on the sword's point: x, y and what the LED turns into.
const GLINT = [[10, 5, "w"], [9, 4, "w"], [11, 5, "w"]];
// Where the planted point bites the stand, and the glow it throws on the rim.
const BITE_X = 53, BITE_Y = 116;
const SPILL = [[51, 118, "u"], [52, 118, "f"], [53, 118, "f"], [54, 118, "f"], [55, 118, "u"], [52, 119, "u"], [53, 119, "u"], [54, 119, "u"]];
// The flash at the moment of the bite, for its first two fifteenths of a second.
const FLASH = [[53, 113, "w"], [52, 115, "w"], [54, 115, "w"], [51, 115, "f"], [55, 115, "f"], [53, 114, "f"], [50, 116, "u"], [56, 116, "u"]];
// The two exhaust mouths, and the shape of a puff as it ages: x, y off its
// centre and the colour, lightest while young.
const STACKS = [[16, 27, 0], [10, 30, 0.5]];
const PUFF = [
  [[0, 0, "n"], [1, 0, "n"]],
  [[0, 0, "n"], [1, 0, "n"], [0, -1, "n"], [1, -1, "o"]],
  [[0, 0, "o"], [1, 0, "n"], [2, 0, "o"], [0, -1, "o"], [1, -1, "n"], [2, -1, "o"]],
  [[0, 0, "h"], [1, 0, "o"], [2, 0, "h"], [0, -1, "h"], [1, -1, "h"], [2, -1, "h"]],
  [[0, 0, "h"], [1, 0, "h"]],
];
const BIG = [[0, 0, "o"], [1, 0, "n"], [2, 0, "n"], [3, 0, "o"], [0, -1, "o"], [1, -1, "n"], [2, -1, "o"], [3, -1, "h"], [1, -2, "o"], [2, -2, "h"]];

const { floor, min, max, abs, sin, cos, PI } = Math;
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
const PLANTS_KEEN = [0.2, 7.0, 13.8, 20.6];
const SCANS = [[4.8, -1, 1.1], [10.95, 1, 0.9], [15.2, -1, 1.1], [18.4, 1, 1.0], [24.4, -1, 1.2]];
const SWEEP_LEN = 2.4;
const GLINT_LEN = 0.17;
// The big move: the sword comes off the shoulder upright, bites the stand
// point first at LIFT, is leant on until DOWN, and goes back up the same way.
const LIFT = 0.23, DOWN = 3.23, PLANT_LEN = 3.46;
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
  if (fx === 1) put(CHARGE);
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
function plantSince(p, t) {
  const list = p.motion === 0 ? PLANTS : p.motion === 1 ? PLANTS_KEEN : null;
  let d = list ? since(list, t, PLANT_LEN) : -1;
  const b = t - p.plantAt;
  if (b >= 0 && b < PLANT_LEN) d = b;
  return d;
}

function steam(buf, tt, heavy) {
  const period = heavy ? 0.12 : 0.2, life = heavy ? 2.4 : 1.8;
  for (let s = 0; s < STACKS.length; s++) {
    const [x0, y0, off] = STACKS[s];
    const k1 = floor(tt / period - off);
    for (let k = max(0, k1 - floor(life / period) - 1); k <= k1; k++) {
      const age = tt - (k + off) * period;
      if (age < 0 || age >= life) continue;
      const a = age / life;
      const wob = floor(sin(age * 2.6 + k * 1.7) + 0.5);
      const x = floor(x0 - age * 2.5 + wob + 0.5), y = floor(y0 - 1 - age * 9 + 0.5);
      const shape = heavy && a >= 0.25 && a < 0.6 ? BIG : PUFF[min(4, floor(a * 5))];
      for (let n = 0; n < shape.length; n++) under(buf, x + shape[n][0], y + shape[n][1], shape[n][2]);
    }
  }
}

function sparks(buf, sd, tt0, tt, seed) {
  for (let n = 0; n < 14; n++) {
    const h = hash(seed * 31 + n);
    const ang = -PI * (0.4 + 0.45 * (h & 1023) / 1023);
    const sp = 50 + ((h >>> 10) & 31), life = 0.4 + ((h >>> 15) & 15) / 30;
    const age = tt - tt0;
    if (age < 0 || age >= life) continue;
    const at = (q) => [floor(BITE_X + cos(ang) * sp * q + 0.5), floor(BITE_Y + sin(ang) * sp * q + 55 * q * q + 0.5)];
    const [x, y] = at(age);
    if (y > BITE_Y + 2) continue;
    const [px, py] = at(max(0, age - 1 / 15));
    const steps = max(abs(x - px), abs(y - py));
    for (let k = 1; k < steps; k++) over(buf, px + floor((x - px) * k / steps + 0.5), py + floor((y - py) * k / steps + 0.5), age < 0.35 ? "u" : "v");
    over(buf, x, y, age < 0.14 ? "w" : age < 0.45 ? "f" : "u");
  }
}

// The arcs for one tenth of a second, worked out once from where the outline
// is when it starts and drawn over whatever moves under it, so a breath step
// inside it cannot make an LED flick for one frame.
function arcs(buf, slot) {
  const out = [];
  const h = hash(slot * 7 + 3);
  if ((h & 3) === 0) return out;
  const count = h & 16 ? 2 : 1;
  for (let a = 0; a < count; a++) {
    const g = hash(h + a * 101);
    const y0 = 22 + (g % 88), left = (g >>> 8) & 1;
    let x = -1;
    if (left) { for (let i = 0; i < W; i++) if (buf[y0 * W + i]) { x = i; break; } }
    else { for (let i = W - 1; i >= 0; i--) if (buf[y0 * W + i]) { x = i; break; } }
    if (x < 0) continue;
    let y = y0;
    const len = 3 + ((g >>> 10) % 4);
    for (let k = 1; k <= len; k++) {
      x += left ? -1 : 1;
      y += ((g >>> (12 + k * 2)) % 3) - 1;
      if (y >= 0 && y < H && x >= 0 && x < W && !buf[y * W + x]) out.push([x, y, k === 1 ? "w" : "Z"]);
    }
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
  if (b && b[0] && plantSince(params, params.t) < 0) params.plantAt = params.t;
  if (b && b[1]) params.sweepAt = params.t;
  if (b && b[2]) params.zoom = !params.zoom;
  if (b && b[3]) params.glintAt = params.t;
}

export function draw(display, params) {
  const p = params;
  if (!p.buf) setup(p);
  const t = p.t;
  // Steam, sparks and arcs step at 15 a second, so no LED holds a state for
  // a single frame.
  const tt = floor(t * 15 + 0.25) / 15;
  const buf = p.buf;
  buf.fill(0);

  const u = (((t - 1.5) % BREATH) + BREATH) % BREATH;
  const dy = [0, u >= 1.1 && u < 2.8 ? -1 : 0, u >= 1.35 && u < 3.05 ? -1 : 0, 0, 0];
  const dx = [0, 0, 0, u >= 1.45 && u < 3.15 ? -1 : 0, 0];

  // Shouldered, upright, or planted; guard mode keeps it planted.
  const d = plantSince(p, t);
  let pose = p.motion === 2 ? 2 : 0;
  if (d >= 0) pose = d < LIFT ? 1 : d < DOWN || p.motion === 2 ? 2 : 1;
  const sd = d >= LIFT ? d - LIFT : -1;
  // The bite goes through him: the head drops a pixel, the chest after it.
  if (sd >= 0 && sd < 0.27) dy[2] += 1;
  if (sd >= 0.07 && sd < 0.23) dy[1] += 1;

  let sw = since(SWEEPS, t, SWEEP_LEN);
  if (t - p.sweepAt < SWEEP_LEN) sw = t - p.sweepAt;
  const sweep = sw >= 0;
  const band = -8 + (sw / SWEEP_LEN) * (W + H * 0.5 + 16);

  // The case light passes over the steel above the stand; the legs and the stand keep still.
  const order = pose === 0 ? ORDER : pose === 1 ? ORDER_M : ORDER_B;
  for (let n = 0; n < order.length; n++) {
    const name = order[n], g = GROUP[name];
    blit(buf, PARTS[name], dx[g], dy[g], sweep && g !== 0, band);
  }

  // The eyes: clear the visor behind them, then paint them where they look.
  const hy = dy[2];
  for (let y = 23; y <= 25; y++) {
    for (let x = 31; x <= 46; x++) {
      const i = (y + hy) * W + x, c = buf[i];
      if (c === 117 || c === 102 || c === 119) buf[i] = 120;
    }
  }
  const db = since(BLINKS, t, 0.3);
  const lid = db < 0 ? 0 : db < 0.08 || db >= 0.2 ? 1 : 2;
  let look = 0;
  if (d < 0 && p.motion !== 3) {
    const u2 = t % CYCLE;
    for (let s = 0; s < SCANS.length; s++) if (u2 >= SCANS[s][0] && u2 < SCANS[s][0] + SCANS[s][2]) look = SCANS[s][1];
  }
  const mood = (d >= 0 && d < 1.4) || p.motion === 2 ? FLARE : p.motion === 3 ? DIM : null;
  for (let e = 0; e < EYES.length; e++) {
    const [x, y, c] = EYES[e];
    if (lid === 1 && y === 23) continue;
    if (lid === 2 && y !== 24) continue;
    over(buf, x + look, y + hy, lid === 2 ? "v" : mood ? mood[c] : c);
  }

  let dg = since(GLINTS, t, GLINT_LEN);
  if (t - p.glintAt < GLINT_LEN) dg = t - p.glintAt;
  if (dg >= 0 && pose === 0) {
    for (let i = 0; i < GLINT.length; i++) {
      const g = GLINT[i], at = (g[1] + dy[1]) * W + g[0];
      if (buf[at]) buf[at] = g[2].charCodeAt(0);
    }
  }

  const fx = p.fx;
  if (fx === 0 || fx === 2) steam(buf, tt, fx === 2);
  if (fx === 1) {
    const slot = floor(t * 10 + 0.25);
    if (slot !== p.arcSlot) {
      p.arcSlot = slot;
      p.arcPix = arcs(buf, slot);
    }
    for (let i = 0; i < p.arcPix.length; i++) over(buf, p.arcPix[i][0], p.arcPix[i][1], p.arcPix[i][2]);
  }
  if (fx !== 3 && sd >= 0 && sd < 0.9) {
    const t0 = t - sd;
    sparks(buf, sd, floor(t0 * 15 + 0.25) / 15, tt, floor(t0 * 10));
    if (sd < 0.3) for (let i = 0; i < SPILL.length; i++) over(buf, SPILL[i][0], SPILL[i][1], sd < 0.15 ? SPILL[i][2] : "v");
    if (sd < 0.14) for (let i = 0; i < FLASH.length; i++) over(buf, FLASH[i][0], FLASH[i][1], FLASH[i][2]);
  }

  const tier = fx === 2 && dy[1] < 0 ? 1 : 0;
  const key = p.ed * 64 + p.stand * 16 + fx * 4 + tier;
  if (key !== p.key) {
    p.key = key;
    p.lut = lut(p.ed, p.stand, fx, tier);
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
