// ===== Patternflow pattern =====
// Title:   Dracula (base)
// Family:  pixel
// Idea:    The creator's AI-made Dracula (11-02), moved onto the 64x128 panel as it is - the target picture for the
//          moving pattern. Still frame only: no parts, no motion yet.
// Author:  patternflow-lab
// Date:    2026-11-02
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: creator's AI picture (craft/dracula/ref.png), converted by the PC session - box filter to 64 wide, 28 colours
// ===============================
// @matrix 64x128
// @knobs
//
// One character per LED, "." is off. Colours run dark to light (a darkest).

const W = 64, H = 128;
const PAL = { a: 0x040217, b: 0x05011c, c: 0x03031b, d: 0x05031e, e: 0x050320, f: 0x08031f, g: 0x130018, h: 0x0e0a23, i: 0x130f2a, j: 0x2c0620, k: 0x19132b, l: 0x181731, m: 0x1b1631, n: 0x1e152f, o: 0x221530, p: 0x1d1933, q: 0x2f1a38, r: 0x4b102c, s: 0x5c0929, t: 0x282540, u: 0x2a304a, v: 0x3f2c48, w: 0x831b2c, x: 0x981523, y: 0x483756, z: 0x71546b, A: 0xac8784, B: 0xe3c9b7 };
const ROWS = [
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "..............................ahaaaafhd.........................",
  "............................acbehhhehihf........................",
  "...........................ededeppthpvuha.......................",
  "..........................adhphddeliityiic......................",
  "..........................ddhlpfdeddflydhd......................",
  "........................adeeddhyAAAzkfioybc.....................",
  "........................ahtpddzAABBBAniAAvd.....................",
  "........................cbhtpfzABBBBBAvBBzd.....................",
  "........................chmhmlyABBBBBBBBBAd.....................",
  "........................cefptkhABBBBBBBBBAd.....................",
  "...................a.aaafpzhkhyAzzABBABABAd.....................",
  "...................cbbdddvBzcbzzyvvABABAAtd.....................",
  "................abbrrrrrhqAzzdzzzyqvAzAzvndbbaaa................",
  "..............afhjsxwwsshoAzzvzAvxxwvvAwxjdrrjgg................",
  "..............afrrsxwwssjioAzvzBAwxxyABxxqbrswxwrj..............",
  "...............aehhrrssssrizAzABBAAAAAByAzersxxxxwbf............",
  ".................ahiipkjjjbiyzzABBBBBBBzBAerswxsjr..............",
  ".................aakpplktldeiyAAABBBABBzBzfswxshcd..............",
  "...................fflmppmmibvAAzBABAyyzzjswxsfa................",
  "...................a.ikpmmmibozAAABBBAAAyjswsgf.................",
  ".....................cipmmlieevAAABvkkozyjswhca.................",
  "...................aabeemmmmmhfyAAzABBAyjswjb...................",
  "...................fffebklmmmhdiyAAAzzAyjssjd...................",
  "................cdbkpphbdhmmmmhyfyAAAAAajwrcbda.................",
  "...............ahlptttliiihhimiqvvvyyyydjsjbbhha................",
  "..............ahtuuuuupmlicbdhifzycdediyjseddlhb................",
  ".............atuuuuuuuuupmlidedbfvAzmfAzbbekputpha..............",
  ".............dtuuuuuttuuutppifpvftzylhzydkvpttuuih..............",
  ".............dtuuttppmtuuuuutizAhqvirssffvAvlmtuplba............",
  "...........afituutmtuutppppppmyzyvtjswwvzzzvtpppttda............",
  "...........ahmtuutmtuupmppmmmmqqzvyzAAAzzyqotppmttda............",
  "...........ahpttmpmkmppmutmnmmmmdpzyyzzyydciputmmmc.............",
  "...........ahpppmpptttuuutmlmihhihyzAzzzybbimutmmmc.............",
  "...........ahmmpmmpuuuuuutnnmhddncvAAAzAydbimutmpmca............",
  "..........fmlmppptuuumppporrcdkqqofzAAzAyiqidktupmba............",
  ".........admmmptuutttmkiqjjjhhqqqtiyAAzzvoqkhhpttphh............",
  ".........admmltuutmmmmhdsjbhnovyqyqbzAzymvqonfhmtupic...........",
  ".........admptuutuvihhjjjkiknnvyvvvtvAzymvqonfhmtutic...........",
  ".........abmtuuupuykhijrfhnnnnvyytyyiAzymvqonfhltuuld...........",
  ".........abmtullytbBBBzbchnnnnvyyvooyfyyhqqonfcbkpuld...........",
  ".........ahptulltyzAAAzzbhnnnnvyyvvvvkvvqvvqofcchitlb...........",
  "........bimputlifzBAAzzBbhnnnnvyyyyyqqfkyyyqofcccdmhd...........",
  "........cimtuttteyABBBAAfhnnnnoqqyyyyyhkyyyqnfccccffd...........",
  "........dimuuptueyABBBAzhinnnnnonvyyyyhmyyyqnfccccdfh...........",
  "........dimutkttfzBAAzvcnnnnnnnnnntyyyhtzyyqnfcbdddhnfa.........",
  "........ditutlttiyAAAAydnnnnnnnnnntyyyhpzyqonfhiiibfhda.........",
  "........ditutmttlyABBAyennnnnnnnnntyyyhmyvoonfhnnkdbbda.........",
  "........diumpupmmihfbafdnnnnnnnnnntyyyhkyvonnfhnnnoidda.........",
  "........diumtupmpihdfjjjiknnnnnnnntyyyhpzyonnfhnootqpff.........",
  "........diuppupmmiddhsssfhnnnnnnnntyyyhtzyonnfhooqyyyhbb........",
  "........diuppupmmibrrsssfhnnnnnnnntyyyhmyvonnfhovvyyyoic........",
  "........fitppuppmibrssssfhnnnnnnnovyyyhkyvoondhnvyvyyqkf........",
  ".......biptptuuumibrssssbhnnnnnnnqyyyyhkyyyqndcbknntyyvoha......",
  ".......ahptlpuutmibrrsrjchnnnnnnnqyyyyhpzyyqnccaknntyyvtha......",
  ".......diptmpuuumhfrrsjcchnnnnonntyyyyhtzyyqofbbknovyyyykf......",
  ".......dimpmpuutmifrssjdchnnnnnnvyyyyyhmyyyqofjrhfoooyyykdc.....",
  ".......dimmmpuutiijrssjdhinnnnnnyyyyvthivvyvqfjsgdkkoyyvqpd.....",
  ".......dimmmpuutbjssssjdnnnnnnnnyyyypddcbvyyyhjsgbbhoyvoyzbca...",
  ".......dimmmpuutdjssssjcnnnnnnnnyyvqhdccdiqvyhjsrjbinqyzAAzna...",
  ".......dimmmtuutdjssssjcnnnonnooyytnhffdchnvyhjssrginoyAAAAvi...",
  ".......bhmmmtuutdjssssjcnnnonnvyyvhdkooiddbtyhjssssjbyzABBBAza..",
  ".......dimmptuutdjssssjcnnnnnnvyqnhitvonihdovhjssssrjqyABBBAAyo.",
  ".......dhmmpuuutdjssssjcnnnnnnvyhdiovyoonkdkofjssssssgvABBBBBAvb",
  ".......dhmmpuuutdjssssjcnnnnoyphbdqyyyoonkdefcjssssssgyBAABBBzvc",
  ".......dimmpuuutdjssssjcnnnqqvkbhhtyyyoniihfccjssssssgyBAzABBzvc",
  ".......dimmpuuutdjssssjcnoovyddbnnvyyyokdhohccjssssssfyByozBBzvb",
  ".....afikmmpuuutdjssssjcnqvqkbhittqqqqihiknkidjssssssfvAyozAAq..",
  ".....chppmmpuuutdjssssjdntypbbiovvoonndhnnnnndjssssssgvAyozAAb..",
  ".....dhpmmmpuuutdjssrbiooifkonvyyyyyhdbhnnnnodjsssssssrfipzofe..",
  ".....chppmmpuutpjjssrciniihkoqvyyyvvhdhinnnqtfjsssssssrdipynhd..",
  ".....chpmmmpuuigssssrcinehnnoyyyyytofbnnnnovyhjsssssssrdinnpkd..",
  ".....chpmmmpuuigssssrcffknnnoyyyyyqhdbnnnnovyhjssssssssrihupkd..",
  ".....chpmmmpuuigssssrcccnnnoqyyyyypcffnnnoovyhjsssssssssjhupkd..",
  ".....bhpmmmpuuigssssrcccnnovyyyyyvhcnnnnnoovyhjsssssssssjhupkd..",
  ".....bhpmmmtuuigssssrchinnovyyyytpfbhhnnnnovyhjswwssssssjhupkd..",
  ".....chpmmmuuuigssssrcinnnnvyyyyoibbcbnnnnovyhjsxxssssssjhupkd..",
  ".....chpmmmuuuihssssrcioonnvyyyyhcbbddknnnovyhjsxxxwssssjfypkd..",
  ".....chpmmmuuuihsswsrcioooovyyyyffgdddknnnovyhjsxxxwssssjhupkb..",
  ".....chpmmmuuuigswxsrcioooovyyyyfjjddbknnnovyhjsxxxwssssjhypkd..",
  ".....chpmmmuuuigswxsrciooqvyyyvqfjjdddnnnnovyhjsxxxwssssjhypkd..",
  ".....fhpmmmuuuigswxsrciootyyyytkhjjdfhnnnoovyhjsxxxwssssjhupkd..",
  "...afmmpmmmuuuhgswxsrciootyyyypbrsjdknooooovyhjsxxxwssssjhupkd..",
  "...afmmpmmmutpjjswxrjciooqyyyypbrsjcnoooooovyhjsxxxwssssjhutpd..",
  "...afmppmmmuthrsswxgcciootyyyypbrsjbnoooooovyhjsxxxwssssjhuutd..",
  "...afmppmmmutfrswxxgcciootyyyoifrssrhfnoooooofjsxxxxxsssghuutd..",
  "...afmmmmmmupdrsxxxjaciootyyyiijssssgcnoooonkdjsxxxxxsssghuutd..",
  "...afmmmmmmupdrsxxxjcciootyyybjsssssgdnoooohbcjsxxxxxsssghuutd..",
  "...afmmmmmmupdrsxxxgfknovvyvtdjswsssgdnoooohdcjsxxxxxsssghuutd..",
  "...afmmnmmmupdrsxxwgfonoyyyqnbjswwssgcnoonnhbajswxxxxsssghuutd..",
  "..cimmmmknmupdrsxxxgfonoyyyqncjswwssgcnnnnnhcrsswxxxxsssghuutd..",
  "..dimmmmmptupdrsxxxgfoooyvvqncrwwwssgcnooonhdrssxxxxxsssjhuutd..",
  "..dimmmpmtuupdrsxxxgfoooyvnoobsxxwssgcnooonhdrssxxxxxsssjhuutd..",
  "..dimmifluuupdrsxxxgfoooyvnhhrwxxxwsgcnoooohdrsswxxxxsssjhuutd..",
  "..dimmiepuuupdrsxxxgfoooyvnhfswxxxwsgcnoooohbrsswxxxxsssghuutd..",
  "..cimmidluuupdrsxxxgfoooyvohfswxxxwsgdnoooohbrssxxxxxsssjhuutd..",
  "ahimmmifluuupersxsjffoqvqqohfswxxxwsgcnoooohbrssxxxxxsssghuutd..",
  "fhnmmmidluuupfrsxsccfovyooohfswxxxwsgdnoooohbrssxxxxxsssjiuutd..",
  "fhnmmmifluuupdrsxsdcfovyooohfswxxxwsgcnoooohbrssxxxxxsssgiuutd..",
  "fhpmmmidluuupdrsxsdhhovyonkkjswxxxwsgcnoooohdrssxxxxxsssjiuutd..",
  "fhpmmmidluuupdrsxsdnoovyoibrsxxxxxwsgcnoooohbrssxxxxxsssjiuutd..",
  "fhpmmmidluuupdrrjhdnoovyoidrsxxxxxwsgdnoooohcgghjjjjjsssjiuutd..",
  "ahkmmmidluuupdjrcddnoovyoicjsxxxxxwrhcnoooohcaaccaacarssjiuutd..",
  "..cipmidluuupddc..dnoytooiccgxxxxxrbddnoooohc........ajsopuutd..",
  "..aiimidluuupda...dnqytooicagrrrrrjadcnooookia........gjnpupld..",
  "...acmidluuupd....dnoytooic..ccccaa.acnoooooofa........dituidd..",
  ".....bedluuupd....dnoooooic.........adnooqyyyha........dkpyha...",
  ".....afdituupd....doqtqqoic.........cdnoqqtttfa........ivvzi....",
  ".......ddpuupd....doqyyyoid.........adnonkbdbca........dpvv.....",
  ".........iiupd....dhimqthf..........cdhhhfdikkhaaa.....efh......",
  "..........atle...adfffimda..........dcffdffkoqnhff.....cca......",
  "...........fde..ebennoheea..........cckofhoooyyyqnbdb...........",
  "...........aaa..dhhoooihda..........cciiffinovvvvvtphf..........",
  "................diooooooda..........cddddddkooooyzzvofa.........",
  "..............aannoooovyca.................ffffhikkhhda.........",
  "..............afoooqqtyyba.................aaaaafaaaaa..........",
  "..............afoooyzzvoba......................................",
  "..............afhhhtttmha.......................................",
  "..............accccbccdc........................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
];

export function setup(params) {
  params.t = 0;
}

export function update(dt, input, params) {
  params.t = (params.t || 0) + Math.min(dt || 0, 0.1);
}

export function draw(display, params) {
  for (let y = 0; y < H; y++) {
    const r = ROWS[y];
    for (let x = 0; x < W; x++) {
      const ch = r[x];
      if (ch === ".") { display.setPixel(x, y, 0, 0, 0); continue; }
      const c = PAL[ch];
      display.setPixel(x, y, (c >> 16) & 255, (c >> 8) & 255, c & 255);
    }
  }
}
