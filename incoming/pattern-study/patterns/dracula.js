// ===== Patternflow pattern =====
// Title:   Dracula
// Family:  pixel
// Idea:    The creator's AI-made Dracula (11-02), kept dot for dot from craft/dracula/base.js and set moving. The still is cut into parts along the seams where the picture runs straight - head, chest, the front hand, the cane hand, both cape skirts in bands, legs - and each part keeps a copy of the pixels at its edge, so whatever a moving part uncovers is filled with the picture's own colours. He breathes a row, the hems of his cape stir in a draught from the left, his red eyes swell and fade, and now and then he blinks. Every eight seconds or so he draws the cape in with his raised hand and throws it open, the crimson lining widening down his side while his eyes flare, then lets it fall back.
// Author:  patternflow-lab
// Date:    2026-11-02
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: creator's AI picture (craft/dracula/ref.png) by way of craft/dracula/base.js, cut into parts and moved; pattern experiment after round 96
// Round:   97
// ===============================
// @matrix 64x128
// @knobs Act=0..1, Speed=0.5..3, Blood=0..1, Face=0..1
//
// Knob 1: Act. Below 1 he opens the cape between rests; at 1 he only rests.
// Knob 2: Speed. Half the knob is the speed: 2 plays the parts as timed, 0.5 at a quarter, 3 at one and a half.
// Knob 3: Blood. Four hand-made palettes on the same pixels, lining, collar and eyes together: crimson below 0.25, gold from 0.25, spectral cyan with blue-white skin from 0.5, ghoul green with grey-green skin from 0.75.
// Knob 4: Face. Below 0.5 he stands as drawn; from 0.5 the same parts are mirrored.
// Buttons: K1 tap opens the cape once; K2 tap makes the eyes flare.

const W = 64, H = 128;
// The still's 28 colours, dark to light, as base.js has them. C and D are the
// eyes alight, the second the red of the eyes in ref.png before it was shrunk.
const PAL = { a: 0x040217, b: 0x05011c, c: 0x03031b, d: 0x05031e, e: 0x050320, f: 0x08031f, g: 0x130018, h: 0x0e0a23, i: 0x130f2a, j: 0x2c0620, k: 0x19132b, l: 0x181731, m: 0x1b1631, n: 0x1e152f, o: 0x221530, p: 0x1d1933, q: 0x2f1a38, r: 0x4b102c, s: 0x5c0929, t: 0x282540, u: 0x2a304a, v: 0x3f2c48, w: 0x831b2c, x: 0x981523, y: 0x483756, z: 0x71546b, A: 0xac8784, B: 0xe3c9b7, C: 0xc41b25, D: 0xe31a1e };

// Each part is a grid, one character per LED and "." where it is clear, drawn
// in ORDER. Laid over each other unmoved they give base.js's still exactly.
// A part also holds, under the parts drawn after it, a copy of the pixels at
// its edge: the row a rising chest leaves behind, and the lining under the
// left cape (part "inside") that shows when the cape opens. The left cape is
// cut in bands from shoulder (capeL0) to hem (capeL11), the right cape's
// skirt in four (capeR0 to the tip capeR3).
const PARTS = {
  inside: { x: 13, y: 29, rows: [
    ".........mmmm.................................",
    ".........hhhh.................................",
    ".........llll.................................",
    ".........pppp.................................",
    ".........uuuu.................................",
    ".........pppp.................................",
    ".........mmmm.................................",
    ".........mmmm.................................",
    ".........mmmm.................................",
    ".........nnnn.................................",
    "..............qqqq............................",
    ".............qqqq.............................",
    "...........nnnn...............................",
    "...........nnnn...............................",
    ".........nnnn.................................",
    "nnnnnnnnnnnnn.................................",
    "nnnnnnnnnnnnn.................................",
    "nnnnnnnnnnnnn.................................",
    "nnnnnnnnnnnnn.................................",
    "nnnnnnnnnnnnn.................................",
    "nnnnnnnnnnn...................................",
    "nnnnnnnnnnn...................................",
    "nnnnnnnnnnn...................................",
    "ihdfjjjnnnn...................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".........nnnn.................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    "......oooo....................................",
    "......nnnn....................................",
    "......nnnn....................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    ".......nnnn...................................",
    "......nnnn....................................",
    "......oooo....................................",
    "......oooo....................................",
    "......oooo....................................",
    "......oooo....................................",
    "......oooo....................................",
    "......oooo...................................u",
    "......oooo...................................u",
    "......oooo...................................u",
    "......oooo...................................u",
    "......oooo...................................u",
    "......oooo...................................u",
    ".....nnnn....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "....oooo.....................................u",
    "..nnnn.......................................u",
    "..nnnn.......................................u",
    "..nnnn.......................................u",
    "...........................................o..",
    "...........................................n..",
    "..........................................d...",
    "..........................................d...",
    "..........................................i...",
    "..........................................d...",
    "..........................................e...",
    "..........................................c...",
  ] },
  legs: { x: 14, y: 107, rows: [
    "....dnoytooiccgxxxxxrbddnoooohc........ajs",
    "....dnqytooicagrrrrrjadcnooookia........gj",
    "....dnoytooic..ccccaa.acnoooooofa.........",
    "....dnoooooic.........adnooqyyyha.........",
    "....doqtqqoic.........cdnoqqtttfa.........",
    "....doqyyyoid.........adnonkbdbca.........",
    "....dhimqthf..........cdhhhfdikkhaaa......",
    "...adfffimda..........dcffdffkoqnhff......",
    "..ebennoheea..........cckofhoooyyyqnbdb...",
    "..dhhoooihda..........cciiffinovvvvvtphf..",
    "..diooooooda..........cddddddkooooyzzvofa.",
    "aannoooovyca.................ffffhikkhhda.",
    "afoooqqtyyba.................aaaaafaaaaa..",
    "afoooyzzvoba..............................",
    "afhhhtttmha...............................",
    "accccbccdc................................",
  ] },
  coat: { x: 19, y: 56, rows: [
    "...................hkyy.................",
    "...................hkyy.......nnty....a.",
    "...................hpzy.......nntyyyyka.",
    "................yyyhtzyyqof...novyyyykf.",
    ".......nnnnnnyyyyyyhmyyyqofjsgfoooyyykdc",
    ".......nnnnnnyyyyvthivvyvqfjsgdkkoyyvqpd",
    ".....nnnnnnnnyyyypddcbvyyyhjsgbbh.......",
    ".....nnnnnnnnyyvqhdccdiqvyhjsrjbi.......",
    ".....nnnonnooyytnhffdchnvyhjssrgi.......",
    ".....nnnonnvyyvhdkooiddbtyhjssssj.......",
    ".....nnnnnnvyqnhitvonihdovhjssssr.......",
    ".....nnnnnnvyhdiovyoonkdkofjsssss.......",
    ".....nnnnoyphbdqyyyoonkdefcjsssss.......",
    ".....nnnqqvkbhhtyyyoniihfccjsssss.......",
    ".....noovyddbnnvyyyokdhohccjsssss.......",
    ".....nqvqkbhittqqqqihiknkidjsssss.......",
    ".....ntypbbiovvoonndhnnnnndjsssss.......",
    "....ooifkonvyyyyyhdbhnnnnodjsssss.......",
    "....niihkoqvyyyvvhdhinnnqtfjsssss.......",
    "....nehnnoyyyyytofbnnnnovyhjsssss.......",
    ".....knnnoyyyyyqhdbnnnnovyhjssssssssr...",
    ".....nnnoqyyyyypcffnnnoovyhjsssssssss...",
    ".....nnovyyyyyvhcnnnnnoovyhjsssssssss...",
    ".....nnovyyyytpfbhhnnnnovyhjswwssssss...",
    "....nnnnvyyyyoibbcbnnnnovyhjsxxssssss...",
    "....oonnvyyyyhcbbddknnnovyhjsxxxwssss...",
    "....oooovyyyyffgdddknnnovyhjsxxxwssss...",
    "....oooovyyyyfjjddbknnnovyhjsxxxwssss...",
    "....ooqvyyyvqfjjdddnnnnovyhjsxxxwssss...",
    "....ootyyyytkhjjdfhnnnoovyhjsxxxwssss...",
    "....ootyyyypbrsjdknooooovyhjsxxxwssss...",
    "....ooqyyyypbrsjcnoooooovyhjsxxxwssss...",
    "....ootyyyypbrsjbnoooooovyhjsxxxwssss...",
    "....ootyyyoifrssrhfnoooooofjsxxxxxsss...",
    "....ootyyyiijssssgcnoooonkdjsxxxxxsss...",
    "....ootyyybjsssssgdnoooohbcjsxxxxxsss...",
    "...novvyvtdjswsssgdnoooohdcjsxxxxxsss...",
    "..onoyyyqnbjswwssgcnoonnhbajswxxxxsss...",
    "..onoyyyqncjswwssgcnnnnnhcrsswxxxxsss...",
    "..oooyvvqncrwwwssgcnooonhdrssxxxxxsss...",
    "..oooyvnoobsxxwssgcnooonhdrssxxxxxsss...",
    "..oooyvnhhrwxxxwsgcnoooohdrsswxxxxsss...",
    "..oooyvnhfswxxxwsgcnoooohbrsswxxxxsss...",
    "..oooyvohfswxxxwsgdnoooohbrssxxxxxsss...",
    "..oqvqqohfswxxxwsgcnoooohbrssxxxxxsss...",
    "..ovyooohfswxxxwsgdnoooohbrssxxxxxsss...",
    "..ovyooohfswxxxwsgcnoooohbrssxxxxxsss...",
    "..ovyonkkjswxxxwsgcnoooohdrssxxxxxsss...",
    "noovyoibrsxxxxxwsgcnoooohbrssxxxxxsss...",
    "noovyoidrsxxxxxwsgdnoooohcgghjjjjjsss...",
    "noovyoicjsxxxxxwrhcnoooohcaaccaacarss...",
  ] },
  capeR0: { x: 58, y: 76, rows: [
    "upkd",
    "upkd",
    "upkd",
    "upkd",
    "upkd",
    "ypkd",
    "upkb",
    "ypkd",
    "ypkd",
    "upkd",
  ] },
  capeR1: { x: 58, y: 86, rows: [
    "upkd",
    "utpd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
  ] },
  capeR2: { x: 58, y: 96, rows: [
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
    "uutd",
  ] },
  capeR3: { x: 55, y: 106, rows: [
    "...uutd",
    ".opuutd",
    ".npupld",
    "dituidd",
    "dkpyha.",
    "ivvzi..",
    "dpvv...",
    "efh....",
    "cca....",
  ] },
  handC: { x: 52, y: 62, rows: [
    "oyvoyzbca...",
    "nqyzAAzna...",
    "noyAAAAvi...",
    "byzABBBAza..",
    "jqyABBBAAyo.",
    "sgvABBBBBAvb",
    "sgyBAABBBzvc",
    "sgyBAzABBzvc",
    "sfyByozBBzvb",
    "sfvAyozAAq..",
    "sgvAyozAAb..",
    "ssrfipzofe..",
    "ssrdipynhd..",
    "ssrdinnpkd..",
    "....ih......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....jf......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....gh......",
    "....gh......",
    "....gh......",
    "....gh......",
    "....gh......",
    "....gh......",
    "....jh......",
    "....jh......",
    "....jh......",
    "....gh......",
    "....jh......",
    "....gh......",
    "....ji......",
    "....gi......",
    "....ji......",
    "....ji......",
    "....ji......",
    "....ji......",
  ] },
  capeL7: { x: 5, y: 60, rows: [
    "..dimmmpuutiijrssjdhi",
    "..dimmmpuutiijrssjdhi",
    "..dimmmpuutbjssssjd..",
    "..dimmmpuutdjssssjc..",
    "..dimmmtuutdjssssjc..",
    "..bhmmmtuutdjssssjc..",
    "..dimmptuutdjssssjc..",
    "..dhmmpuuutdjssssjc..",
    "..dhmmpuuutdjssssjc..",
    "..dimmpuuutdjssssjc..",
    "..dimmpuuutdjssssjc..",
    "afikmmpuuutdjssssjc..",
    "chppmmpuuutdjssssjd..",
    "dhpmmmpuuutdjssrbi...",
    "chppmmpuutpjjssrci...",
    "chpmmmpuuigssssrci...",
    "chpmmmpuuigssssrcff..",
    "chpmmmpuuigssssrccc..",
    "bhpmmmpuuigssssrccc..",
    "bhpmmmtuuigssssrchi..",
    "chpmmmuuuigssssrci...",
    "chpmmmuuuihssssrci...",
    "chpmmmuuuihsswsrci...",
    "chpmmmuuuigswxsrci...",
    "chpmmmuuuigswxsrci...",
    "fhpmmmuuuigswxsrci...",
  ] },
  capeL8: { x: 3, y: 86, rows: [
    "afmmpmmmuuuhgswxsrci",
    "afmmpmmmutpjjswxrjci",
    "afmppmmmuthrsswxgcci",
    "afmppmmmutfrswxxgcci",
    "afmmmmmmupdrsxxxjaci",
    "afmmmmmmupdrsxxxjcci",
    "afmmmmmmupdrsxxxgfk.",
    "afmmnmmmupdrsxxwgf..",
  ] },
  capeL9: { x: 2, y: 94, rows: [
    "cimmmmknmupdrsxxxgf",
    "dimmmmmptupdrsxxxgf",
    "dimmmpmtuupdrsxxxgf",
    "dimmifluuupdrsxxxgf",
    "dimmiepuuupdrsxxxgf",
    "cimmidluuupdrsxxxgf",
  ] },
  capeL10: { x: 0, y: 100, rows: [
    "ahimmmifluuupersxsjff",
    "fhnmmmidluuupfrsxsccf",
    "fhnmmmifluuupdrsxsdcf",
    "fhpmmmidluuupdrsxsdhh",
    "fhpmmmidluuupdrsxsd..",
    "fhpmmmidluuupdrrjhd..",
    "ahkmmmidluuupdjrcdd..",
  ] },
  capeL11: { x: 2, y: 107, rows: [
    "cipmidluuupddc",
    "aiimidluuupda.",
    ".acmidluuupd..",
    "...bedluuupd..",
    "...afdituupd..",
    ".....ddpuupd..",
    ".......iiupd..",
    "........atle..",
    ".........fde..",
    ".........aaa..",
  ] },
  torso: { x: 24, y: 28, rows: [
    ".........yAAAAAajwrc.da...........",
    "..hhi....vvyyyydjsjbbhha..........",
    "..cbdhifzycdediyjseddlhb..........",
    "..lidedbfvAzmfAzbbekputpha........",
    "..ppifpvftzylhzydkvpttuuih........",
    "..uutizAhqvirssffvAvlmtuplba......",
    "..pppmyzyvtjswwvzzzvtpppttda......",
    "..mmmmqqzvyzAAAzzyqotppmttda......",
    "..mnmmmmdpzyyzzyydciputmmmc.......",
    "..mlmihhihyzAzzzybbimutmmmc.......",
    "..nnmhddncvAAAzAydbimutmpmca......",
    ".......qqofzAAzAyiqidktupmba......",
    "......qqqtiyAAzzvoqkhhpttphh......",
    "....novyqyqbzAzymvqonfhmtupic.....",
    "....nnvyvvvtvAzymvqonfhmtutic.....",
    "..nnnnvyytyyiAzymvqonfhltuuld.....",
    "..nnnnvyyvooyfyyhqqonfcbkpuld.....",
    "..nnnnvyyvvvvkvvqvvqofcchitlb.....",
    "..nnnnvyyyyyqqfkyyyqofcccdmhd.....",
    "..nnnnoqqyyyyyhkyyyqnfccccffd.....",
    "..nnnnnonvyyyyhmyyyqnfccccdfh.....",
    "nnnnnnnnnntyyyhtzyyqnfcbdddhnfa...",
    "nnnnnnnnnntyyyhpzyqonfhiiibfhda...",
    "nnnnnnnnnntyyyhmyvoonfhnnkdbbda...",
    "nnnnnnnnnntyyyhkyvonnfhnnnoidda...",
    "..nnnnnnnntyyyhpzyonnfhnootqpff...",
    "..nnnnnnnntyyyhtzyonnfhooqyyyhbb..",
    "..nnnnnnnntyyyhmyvonnfhovvyyyoic..",
    "..nnnnnnnovyyyhkyvoondhnvyvyyqkf..",
    "..nnnnnnnqyyyyhkyyyqndcbknntyyvoha",
    "..nnnnnnnqyyyy....yqnccaknntyyvtha",
    "..nnnnonntyyyy....yqofbbk....yyyk.",
    "..nnnnnnvyyyyy....yqofjrh.........",
    "..nnnnnnyyy...........jsg.........",
  ] },
  capeL0: { x: 15, y: 31, rows: [
    "..........m",
    "uuuuuttu..t",
  ] },
  capeL1: { x: 11, y: 33, rows: [
    "..dtuuttppmtuuu",
    "afituutmtuutppp",
    "ahmtuutmtuupmpp",
  ] },
  capeL2: { x: 11, y: 36, rows: [
    "ahpttmpmkmppmut",
    "ahpppmpptttuuut",
    "ahmmpmmpuuuuuut",
  ] },
  capeL3: { x: 9, y: 39, rows: [
    ".fmlmppptuuumppporrcdk",
    "admmmptuutttmkiqjjjhh.",
  ] },
  capeL4: { x: 9, y: 41, rows: [
    "admmltuutmmmmhdsjbh",
    "admptuutuvihhjjjkik",
    "abmtuuupuykhijrfh..",
  ] },
  capeL5: { x: 8, y: 44, rows: [
    ".abmtully",
    ".ahptullt",
    "bimputlif",
    "cimtuttte",
    "dimuuptue",
    "dimutkttf",
    "ditutltti",
    "ditutmttl",
    "diumpupmm",
  ] },
  capeL6: { x: 7, y: 53, rows: [
    ".diumtupmpihdfjjjik",
    ".diuppupmmiddhsssfh",
    ".diuppupmmibrrsssfh",
    ".fitppuppmibrssssfh",
    "biptptuuumibrssssbh",
    "ahptlpuutmibrrsrjch",
    "diptmpuuumhfrrsjcch",
    "dimpmpuutmifrssjdch",
    "dimmmpuutiijrssjdhi",
  ] },
  handF: { x: 17, y: 44, rows: [
    "tbBBBzbch",
    "yzAAAzzbh",
    "zBAAzzBbh",
    "yABBBAAfh",
    "yABBBAzhi",
    "zBAAzvc..",
    "yAAAAyd..",
    "yABBAye..",
    "ihfbafd..",
  ] },
  head: { x: 13, y: 5, rows: [
    ".................ahaaaafhd.............",
    "...............acbehhhehihf............",
    "..............ededeppthpvuha...........",
    ".............adhphddeliityiic..........",
    ".............ddhlpfdeddflydhd..........",
    "...........adeeddhyAAAzkfioybc.........",
    "...........ahtpddzAABBBAniAAvd.........",
    "...........cbhtpfzABBBBBAvBBzd.........",
    "...........chmhmlyABBBBBBBBBAd.........",
    "...........cefptkhABBBBBBBBBAd.........",
    "......a.aaafpzhkhyAzzABBABABAd.........",
    "......cbbdddvBzcbzzyvvABABAAtd.........",
    "...abbrrrrrhqAzzdzzzyqvAzAzvndbbaaa....",
    ".afhjsxwwsshoAzzvzAvxxwvvAwxjdrrjgg....",
    ".afrrsxwwssjioAzvzBAwxxyABxxqbrswxwrj..",
    "..aehhrrssssrizAzABBAAAAAByAzersxxxxwbf",
    "....ahiipkjjjbiyzzABBBBBBBzBAerswxsjr..",
    "....aakpplktldeiyAAABBBABBzBzfswxshcd..",
    "......fflmppmmibvAAzBABAyyzzjswxsfa....",
    "......a.ikpmmmibozAAABBBAAAyjswsgf.....",
    "........cipmmlieevAAABvkkozyjswhca.....",
    "......aabeemmmmmhfyAAzABBAyjswjb.......",
    "......fffebklmmmhdiyAAAzzAyjssjd.......",
    "...cdbkpphbdhmmmmhyf...........b.......",
    "..ahlptttliii...miqv...................",
    ".ahtuuuuupmli..........................",
    "atuuuuuuuuup...........................",
    "dt........uu...........................",
  ] },
};
const ORDER = ["inside", "legs", "coat", "capeR0", "capeR1", "capeR2", "capeR3", "handC", "capeL7", "capeL8", "capeL9", "capeL10", "capeL11", "torso", "capeL0", "capeL1", "capeL2", "capeL3", "capeL4", "capeL5", "capeL6", "handF", "head"];
// 1 rises with the breath.
const GROUP = { legs: 0, coat: 0, capeR0: 0, capeR1: 0, capeR2: 0, capeR3: 0, handC: 0, capeL7: 0, capeL8: 0, capeL9: 0, capeL10: 0, capeL11: 0, torso: 1, capeL0: 1, capeL1: 1, capeL2: 1, capeL3: 1, capeL4: 1, capeL5: 1, capeL6: 1, handF: 1, head: 1 };

// The eyes, laid over the head: as drawn, alight, flaring, lids half down.
const EYES = {
  eyes: { x: 33, y: 18, rows: [
    "xxw...wx",
    "wxx...xx",
  ] },
  eyesglow: { x: 33, y: 18, rows: [
    "CCx...xC",
    "xCC...CC",
  ] },
  eyesflare: { x: 33, y: 18, rows: [
    "DDC...CD",
    "CDD...DD",
  ] },
  eyeshalf: { x: 33, y: 18, rows: [
    "vvv...vv",
    "wxx...xx",
  ] },
};

// The cape's poses: how far each left-cape band, capeL0 to capeL10, stands
// off. Each band carries the cape with its red lining, so the lining keeps its
// folds and what opens is the coat behind; from the hand down to the knee the
// cape moves as one piece. The front hand goes with capeL5, the band it holds,
// and lifts a row when the cape is open.
const POSES = {
  gather: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  half: [0, 0, -1, -1, -2, -2, -2, -2, -2, -1, -1, 0],
  open: [0, -1, -2, -3, -4, -4, -4, -4, -3, -2, -1, 0],
};
// The cape, in ticks of 1/60 s from the start of the act: drawn in, half
// open, open while the eyes flare, half closed, down.
const ACT = [[0, "gather"], [12, "half"], [20, "open"], [104, "half"], [116, null]];
const ACT_LEN = 116 / 60;
const ACT_AT = 1.6;
const ACT_EVERY = 8.4;

// The hem tips in the draught: [how far at most, lag in seconds]. Both swing
// in towards the legs, the left one further; neither leaves the panel.
const FLUTTER = { capeL10: [1, 0], capeL11: [2, 0.2], capeR2: [-1, 0.1], capeR3: [-1, 0.3] };
// A breath is half the breath time between two acts, so every act comes at
// the same point of it, the chest down and the hems at rest.
const BREATH = (ACT_EVERY - ACT_LEN) / 2;
const FLUTTER_P = BREATH;
// Two breaths: the eyes swell once and blink once in it.
const EYE_CYCLE = 2 * BREATH;

// Knob 3: what each palette puts in place of the crimson ones.
const BLOODS = [
  {},
  { r: 0x4b300c, s: 0x5c3a09, w: 0x83601b, x: 0x987015, j: 0x2c1a06, g: 0x130c00, C: 0xc49a1b, D: 0xe3c01a },
  { r: 0x0c3a4b, s: 0x094a5c, w: 0x1b6f83, x: 0x158498, j: 0x06222c, g: 0x001318, C: 0x1bb0c4, D: 0x1ad8e3, A: 0x8495ac, B: 0xc9dbe3, z: 0x54607a },
  { r: 0x1c3a1a, s: 0x1f4a18, w: 0x3a6a26, x: 0x4a7f22, j: 0x0f2210, g: 0x081208, C: 0x7ac43a, D: 0xa8e05a, A: 0x8f9a80, B: 0xc8d4b4, z: 0x5e6858 },
];

const { floor, min, max, sin, PI } = Math;

function lut(blood) {
  const t = new Int32Array(128).fill(-1);
  for (const k in PAL) t[k.charCodeAt(0)] = PAL[k];
  const b = BLOODS[blood];
  for (const k in b) t[k.charCodeAt(0)] = b[k];
  return t;
}

function blit(buf, part, dx, dy) {
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
      buf[y * W + x] = ch;
    }
  }
}

// Where the act is at time t: [seconds into it, or -1].
function actAt(t, p) {
  if (t - p.tapAt >= 0 && t - p.tapAt < ACT_LEN) return t - p.tapAt;
  if (p.rest) return -1;
  const u = t - ACT_AT;
  if (u < 0) return -1;
  const w = u % ACT_EVERY;
  return w < ACT_LEN ? w : -1;
}

// The time the breath and the draught have run: the clock less the time spent in acts.
function breathTime(t, p) {
  if (p.rest || t < ACT_AT) return t;
  const u = t - ACT_AT;
  const n = floor(u / ACT_EVERY);
  return t - n * ACT_LEN - min(u - n * ACT_EVERY, ACT_LEN);
}

function poseAt(a) {
  if (a < 0) return null;
  const tick = floor(a * 60 + 1e-6);
  let name = null;
  for (const [at, n] of ACT) if (tick >= at) name = n;
  return name;
}

function hem(t, amp, lag) {
  if (t < 1) return 0;
  const s = sin((2 * PI * (t - 1.762 - lag)) / FLUTTER_P);
  const a = amp < 0 ? -amp : amp;
  const n = a > 1 && s > 0.8 ? 2 : s > 0.35 ? 1 : 0;
  return amp < 0 ? -n : n;
}

export function setup(params) {
  params.t = 0;
  params.buf = new Uint8Array(W * H);
  params.key = -1;
  params.rest = false;
  params.speed = 1;
  params.blood = 0;
  params.flip = false;
  params.tapAt = -99;
  params.flareAt = -99;
}

export function update(dt, input, params) {
  if (!params.buf) setup(params);
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.rest = k[0] >= 1;
  params.speed = min(3, max(0.5, k[1])) / 2;
  params.blood = min(3, max(0, floor(k[2] * 4)));
  params.flip = k[3] >= 0.5;
  params.t += min(dt || 0, 0.1) * params.speed;
  const b = input.btnPressed;
  if (b && b[0] && actAt(params.t, params) < 0) params.tapAt = params.t;
  if (b && b[1]) params.flareAt = params.t;
}

export function draw(display, params) {
  const p = params;
  if (!p.buf) setup(p);
  if (p.key !== p.blood) {
    p.key = p.blood;
    p.lut = lut(p.blood);
  }
  const t = p.t;
  const buf = p.buf;
  buf.fill(46);

  const a = actAt(t, p);
  const pose = POSES[poseAt(a)];
  // The breath and the draught hold while the cape is up.
  const tb = breathTime(t, p);
  // Everything above the waist rises a row, then a second, and settles the
  // same way.
  const ub = tb % BREATH;
  const up = a < 0 ? (ub >= 0.45 && ub < 1.15 ? -2 : ub >= 0.2 && ub < 1.4 ? -1 : 0) : 0;

  for (const name of ORDER) {
    let dx = 0;
    if (name.startsWith("capeL")) {
      const band = +name.slice(5);
      if (pose) dx += pose[band];
    }
    let dy = GROUP[name] ? up : 0;
    if (name === "handF" && pose) {
      dx += pose[4];
      if (pose === POSES.open) dy = -1;
    }
    const f = FLUTTER[name];
    if (f && a < 0) dx += hem(tb, f[0], f[1]);
    blit(buf, PARTS[name], dx, dy);
  }

  // The eyes: a slow swell, a blink now and then, a flare while the cape is open.
  // They keep the breath's clock and change only while the chest is down, a
  // tenth of a second or more from its moves, so no two changes meet.
  let eyes = EYES.eyes;
  const w = tb % EYE_CYCLE - BREATH;
  if (a < 0 && w >= 1.7 && w < 2.5) eyes = w >= 1.9 && w < 2.3 ? EYES.eyesflare : EYES.eyesglow;
  if (a < 0 && w >= -1.43 && w < -1.23) eyes = EYES.eyeshalf;
  const tick = a < 0 ? -1 : floor(a * 60 + 1e-6);
  const fl = t - p.flareAt;
  if ((tick >= 20 && tick < 104) || (fl >= 0 && fl < 1.4)) {
    const edge = (tick >= 0 && (tick < 28 || tick >= 96)) || (fl >= 0 && (fl < 0.13 || fl >= 1.27));
    eyes = edge ? EYES.eyesglow : EYES.eyesflare;
  }
  blit(buf, eyes, 0, up);

  const L = p.lut;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = buf[y * W + (p.flip ? W - 1 - x : x)];
      if (ch === 46) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const c = L[ch];
      if (c < 0) display.setPixel(x, y, 255, 0, 255);
      else display.setPixel(x, y, (c >> 16) & 255, (c >> 8) & 255, c & 255);
    }
  }
}
