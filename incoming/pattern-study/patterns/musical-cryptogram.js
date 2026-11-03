// ===== Patternflow pattern =====
// Title:   Musical Cryptogram
// Family:  type
// Idea:    Names that are also melodies stand down the panel, each written in pixel capitals over a five-line staff with a treble clef, and in turn each letter drops off the name, folding as it falls into the notehead of the note it names, so B-A-C-H lands as B flat, A, C and B natural with a flat and a natural sign beside them; a playhead then walks the motif twice in one bar, lighting letter and note together, and the notes rise back into the letters, the four names a quarter cycle apart so one is falling while another plays; the fourth knob swaps German note names for the French table of the 1909 Haydn pieces, the alphabet in rows of seven under A to G written out at the top, whose cells light as HAYDN, RAVEL and DUKAS are spelled through it.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: musical cryptograms in German note names, where B is B flat, H is B natural and S (Es) is E flat: B-A-C-H in the last fugue of Die Kunst der Fuge (Johann Sebastian Bach, left unfinished 1750), A-B-E-G-G in the Abegg Variations Op. 1 (Robert Schumann, 1830), A-S-C-H, S-C-H-A and As-C-H in Carnaval Op. 9 (Schumann, 1835), F-A-E in the F-A-E Sonata (Schumann, Johannes Brahms and Albert Dietrich, 1853), G-A-D-E in Nordisches Lied of Album für die Jugend Op. 68 (Schumann, 1848), D-S-C-H in the String Quartet No. 8 Op. 110 (Dmitri Shostakovich, 1960); and the French method, the alphabet written in rows of seven under A to G, as in the pieces on the name of Haydn for his centenary in 1909, where HAYDN is B-A-D-D-G (Maurice Ravel, Menuet sur le nom d'Haydn); the other French names are spelled here by that table, not quoted from pieces; 5 by 7 capitals, clef and signs drawn for this pattern; pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Names=0..1, French=0..1
//
// Knob 1: Hue. Turns every colour round a wheel that steps over orange and yellow. At 0 the four names are azure, violet, pink and green, each letter a little further round than the one before so letter and note can be matched by colour; the staves are blue grey, the clefs pale blue, the flats and naturals pale coral, and a note being played goes white. At 0.5 the names are red, green, cyan and violet.
// Knob 2: Speed. At 2 a name's cycle is 8.4 s: 0.3 s at rest, its letters falling 0.22 s apart in 0.5 s each, then after 0.3 s the motif played in a 1.8 s bar, 0.45 s a note for four letters and 0.36 s for five, a 0.2 s breath and the bar again, and 0.4 s later the notes rising 0.15 s apart in 0.45 s each; a four-letter name then rests 1.8 s with its letters home. The names start 2.1 s apart (2.8 s with three), so at the opening BACH and GADE are playing, ABEGG is about to fall and DSCH is rising. Everything goes as Speed / 2.
// Knob 3: Names. Two sets. 0: BACH, ABEGG, DSCH, GADE. 1: S-C-H-A, As-C-H and A-S-C-H, the three Sphinxes of Carnaval, and F-A-E, As written as a capital and a small s over one A flat. With French on, 0 is HAYDN, RAVEL, DUKAS and 1 is DEBUSSY, WIDOR, HAHN; seven letters close the notes up from 10 to 7 LEDs apart.
// Knob 4: French. Below 0.5 the German names: B is B flat, H is B natural, S is E flat, each motif in its own register between F4 and G5. From 0.5 the French method: the top 31 rows hold the alphabet in four rows of seven, A to G in coral as the note names, and three names stand below; as a letter falls its cell and the note at the head of its column light white, so RAVEL reads down the table as D A A E E. H lights its own cell under A but the B column, because the HAYDN of 1909 kept the German H, B natural: B-A-D-D-G. French notes are all natural and sit between E4 and D5.

// German note names have eight letters, A to H, with B for B flat and H for
// B natural, and two more from the names of flats: Es, said "S", is E flat,
// and As is A flat. A name made only of those letters is a melody. Bach's
// own, B-A-C-H, enters as the third subject of the unfinished last fugue of
// Die Kunst der Fuge. Schumann wrote ABEGG on the name in his dedication, ASCH
// for the town of Asch and SCHA from the letters of his own name, and GADE
// for Niels Gade; Shostakovich signed D-S-C-H, D. Sch. in German spelling.
//
// The French method takes the whole alphabet: written in rows of seven,
// A B C D E F G / H I J K L M N / O P Q R S T U / V W X Y Z, a letter sounds
// the note at the head of its column. In code that is the letter's place in
// the alphabet mod 7. For the centenary of Haydn's death in 1909 six composers
// wrote on HAYDN, read B A D D G: Y and N by the table, H by German use.
//
// A letter falls by folding: its 5 by 7 pixels are sorted top to bottom and
// each goes to one of the eleven pixels of the notehead, so the capital
// collapses into the oval as it drops, falling under gravity, and unfolds
// again on the way up. The stem points down from the middle line up and up
// below it, as engravers set it.

const W = 64, H = 128;
const { floor, round, min, max, exp, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// 5 by 7 capitals.
const FONT = {
  A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110", C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110", E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111", H: "10001100011000111111100011000110001", I: "01110001000010000100001000010001110",
  J: "00111000100001000010000101001001100", K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001", N: "10001100011100110101100111000110001", O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000", Q: "01110100011000110001101011001001101", R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100", U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100", W: "10001100011000110101101011010101010", X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100", Z: "11111000010001000100010001000011111",
};
// A small s for As, 3 by 5, on the baseline.
const SMALL_S = "011100010001110";
// The treble clef, rows from 16 above the G line to 7 below it.
const CLEF = [
  "....#...", "...#.#..", "...#.#..", "...#.#..", "...#.#..", "...#.#..", "...#.#..", "...##...",
  "...##...", "..##....", ".#.#....", "#..###..", "#.#.#.#.", "#.#.#..#", "#.#.#..#", "#..##..#",
  "#...#..#", ".#..#.#.", "..####..", "....#...", "....#...", "....#...", ".##.#...", ".###....",
];
// Flat from 4 rows above the note to 1 below; natural from 3 above to 3 below.
const FLAT = ["100", "100", "100", "110", "101", "110"];
const NATURAL = ["100", "100", "111", "101", "111", "001", "001"];
const HEAD = [".###.", "#####", ".###."];

// A note is [letters shown, staff step from E4 = 0, accidental 0 none 1 flat 2 natural].
// German names: B is B flat, H is B natural, S is E flat, As is A flat.
const N = (s) => s.split(" ").map((t) => { const [l, st, a] = t.split(":"); return [l, +st, +(a || 0)]; });
const GERMAN = [
  [N("B:4:1 A:3 C:5 H:4:2"), N("A:3 B:4:1 E:7 G:9 G:9"), N("D:6 S:7:1 C:5 H:4:2"), N("G:2 A:3 D:6 E:7")],
  [N("S:7:1 C:5 H:4:2 A:3"), N("As:3:1 C:5 H:4:2"), N("A:3 S:7:1 C:5 H:4:2"), N("F:1 A:3 E:7")],
];
const FRENCH = [["HAYDN", "RAVEL", "DUKAS"], ["DEBUSSY", "WIDOR", "HAHN"]];
// The French method: the alphabet in rows of seven under A to G, so a
// letter's note is its column; H alone kept its German B natural in 1909.
const STEP = { E: 0, F: 1, G: 2, A: 3, B: 4, C: 5, D: 6 };
function french(name) {
  return name.split("").map((l) => {
    const i = l.charCodeAt(0) - 65, col = l === "H" ? 1 : i % 7;
    return [l, STEP["ABCDEFG"[col]], 0, i];
  });
}

// Seconds at Speed 2: a band's cycle, the letters' rest, each letter's fall
// and the stagger between them, the bar a name is played in (twice, with a
// breath between), the rise and its stagger.
const CYCLE = 8.4, REST = 0.3, FALL = 0.5, LSTEP = 0.22, BAR = 1.8, BREATH = 0.2, RISE = 0.45, RSTEP = 0.15;

// Each band's place on the wheel: azure, violet, pink and green at Hue 0.
const BAND_U = [0, 0.2, 0.4, 0.72];
// A hue wheel with orange and yellow taken out: u runs 0..1 over 0.2..1.03.
const wheel = (u) => 0.2 + 0.83 * (u - floor(u));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map((x) => x * 255);
}

// The pixels of a letter token, as [x, y] from its top left.
function letterPixels(t) {
  const out = [];
  const g = FONT[t[0]];
  for (let k = 0; k < 35; k++) if (g[k] === "1") out.push([(k % 5) - (t.length > 1 ? 2 : 0), floor(k / 5)]);
  if (t.length > 1) for (let k = 0; k < 15; k++) if (SMALL_S[k] === "1") out.push([4 + (k % 3), 2 + floor(k / 3)]);
  return out;
}
const headPixels = [];
for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) if (HEAD[y][x] === "#") headPixels.push([x, y - 1]);

// Lays out one band: where each letter and note goes and how the letter's
// pixels map onto the notehead's as it folds.
function layout(notes, y0) {
  const L = notes.length, sp = L <= 5 ? 10 : floor(50 / L);
  const x0 = 12 + round((50 - (L - 1) * sp - 5) / 2);
  return notes.map((n, i) => {
    const nx = x0 + i * sp, ny = y0 + 29 - 2 * n[1];
    const lp = letterPixels(n[0]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const map = lp.map((p, k) => headPixels[floor((k * headPixels.length) / lp.length)]);
    return { l: n[0], step: n[1], acc: n[2], cell: n[3], nx, ny, ly: y0 + 1, lp, map, i };
  });
}

function build(S) {
  const fr = S.french, set = S.names;
  const rows = fr ? FRENCH[set].map(french) : GERMAN[set];
  const top = fr ? 32 : 0;
  S.bands = rows.map((notes, b) => ({ y0: top + 32 * b, notes: layout(notes, top + 32 * b) }));
  S.off = CYCLE / S.bands.length;
}

export function setup(params) {
  params.s = { t: 0, hue: 0, names: -1, french: -1, bands: [], off: 1, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const names = round(cl(k[2] || 0, 0, 1)), fr = cl(k[3] == null ? 0.06 : k[3], 0, 1) >= 0.5 ? 1 : 0;
  if (names !== S.names || fr !== S.french) {
    S.names = names;
    S.french = fr;
    build(S);
  }
  S.t += (d * speed) / 2;
}

// Where one letter of a band is at band time tau: 0 resting on the name,
// 0..1 falling, 1 on the staff, 1..2 rising back, and how bright its note is
// from being played.
function stateOf(n, L, tau) {
  const f0 = REST + n.i * LSTEP, f1 = f0 + FALL, note = BAR / L;
  const p0 = REST + (L - 1) * LSTEP + FALL + 0.3;
  const r0 = p0 + 2 * BAR + BREATH + 0.4 + n.i * RSTEP, r1 = r0 + RISE;
  let pos;
  if (tau < f0) pos = 0;
  else if (tau < f1) pos = (tau - f0) / FALL;
  else if (tau < r0) pos = 1;
  else if (tau < r1) pos = 1 + (tau - r0) / RISE;
  else pos = 0;
  let play = 0, head = false;
  for (const start of [p0, p0 + BAR + BREATH]) {
    const pn = start + n.i * note;
    if (tau >= pn && tau < r0) play = max(play, exp(-(tau - pn) / (note * 1.2)));
    if (tau >= pn && tau < pn + note) head = true;
  }
  return { pos, play, head, landed: tau - f1, f0 };
}

function add(buf, x, y, c, a) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * a, X = xi + i, Y = yi + j;
      if (w <= 0 || X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const o = (Y * W + X) * 3;
      buf[o] += c[0] * w;
      buf[o + 1] += c[1] * w;
      buf[o + 2] += c[2] * w;
    }
}
const put = (buf, x, y, c, a) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = max(buf[o], c[0] * a);
  buf[o + 1] = max(buf[o + 1], c[1] * a);
  buf[o + 2] = max(buf[o + 2], c[2] * a);
};

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.bands.length) return;
  const buf = S.buf;
  buf.fill(0);
  const u0 = 0.458 + S.hue;
  const staffC = hsv(wheel(u0 + 0.06), 0.3, 0.34), clefC = hsv(wheel(u0 + 0.03), 0.3, 0.85), accC = hsv(wheel(u0 + 0.5), 0.35, 1);
  const white = [255, 255, 255];

  // The French table: A to G on top, the note names, and the rest of the
  // alphabet in rows of seven under them.
  const flash = new Float32Array(26), colFlash = new Float32Array(7);
  S.bands.forEach((band, b) => {
    const tau = (((S.t - b * S.off) % CYCLE) + CYCLE) % CYCLE;
    for (const n of band.notes) {
      if (n.cell == null) continue;
      const age = tau - (REST + n.i * LSTEP);
      if (age >= 0 && age < 1.2) {
        const a = exp(-age / 0.45);
        flash[n.cell] = max(flash[n.cell], a);
        const col = [4, 5, 6, 0, 1, 2, 3][n.step];
        colFlash[col] = max(colFlash[col], a);
      }
    }
  });
  if (S.french)
    for (let i = 0; i < 26; i++) {
      const r = floor(i / 7), c = i % 7, x = 3 + 9 * c, y = 1 + 8 * r;
      const base = r === 0 ? hsv(wheel(u0 + 0.5), 0.45, 1) : hsv(wheel(u0), 0.35, 0.55);
      const f = r === 0 ? colFlash[c] : flash[i];
      const col = base.map((v, j) => v * (1 - f) + white[j] * f);
      const g = FONT[String.fromCharCode(65 + i)];
      for (let k = 0; k < 35; k++) if (g[k] === "1") put(buf, x + (k % 5), y + floor(k / 5), col, 1);
    }

  S.bands.forEach((band, b) => {
    const y0 = band.y0, notes = band.notes, L = notes.length;
    const tau = (((S.t - b * S.off) % CYCLE) + CYCLE) % CYCLE;
    // The staff, the clef on the G line and a final barline.
    for (let l = 0; l < 5; l++) for (let x = 0; x < W; x++) put(buf, x, y0 + 13 + 4 * l, staffC, 1);
    for (let y = 0; y < CLEF.length; y++)
      for (let x = 0; x < 8; x++) if (CLEF[y][x] === "#") put(buf, 1 + x, y0 + 9 + y, clefC, 1);
    for (let y = y0 + 13; y <= y0 + 29; y++) {
      put(buf, 60, y, staffC, 1.6);
      put(buf, 62, y, clefC, 0.9);
      put(buf, 63, y, clefC, 0.9);
    }
    let playX = -1;
    for (const n of notes) {
      const st = stateOf(n, L, tau);
      const c = hsv(wheel(u0 + BAND_U[b] + 0.03 * n.i), 0.62, 1);
      const lit = c.map((v, j) => v * (1 - st.play) + white[j] * st.play);
      if (st.head) playX = n.nx + 2;
      // The name: full when the letter is home, a ghost while its note is down.
      const home = st.pos === 0 ? 1 : st.pos < 1 ? 1 - 0.6 * ease(st.pos * 2) : st.pos === 1 ? 0.4 : 0.4 + 0.6 * ease((st.pos - 1) * 2 - 1);
      const la = st.pos === 1 ? max(home, st.play) : home;
      for (const [x, y] of n.lp) put(buf, n.nx + x, n.ly + y, st.pos === 1 ? lit : c, la);
      if (st.pos > 0 && st.pos < 2 && st.pos !== 1) {
        // Folding: each letter pixel travels to a notehead pixel, falling
        // under gravity on the way down and easing on the way up.
        const u = st.pos < 1 ? st.pos : 2 - st.pos;
        const ux = ease(u), uy = st.pos < 1 ? u * u : ease(u);
        n.lp.forEach(([x, y], k) => {
          const [tx, ty] = n.map[k];
          const px = n.nx + x + (n.nx + tx - n.nx - x) * ux, py = n.ly + y + (n.ny + ty - n.ly - y) * uy;
          add(buf, px, py, c, 0.75);
        });
      } else if (st.pos === 1) {
        for (const [x, y] of headPixels) put(buf, n.nx + x, n.ny + y, lit, 1);
        const a = cl(st.landed / 0.2, 0, 1);
        // The stem: down on the left from the middle line up, else up on the right.
        if (n.step >= 4) for (let y = 1; y <= 9; y++) put(buf, n.nx, n.ny + y, lit, a);
        else for (let y = 1; y <= 9; y++) put(buf, n.nx + 4, n.ny - y, lit, a);
        const sign = n.acc === 1 ? FLAT : n.acc === 2 ? NATURAL : null;
        if (sign) {
          const dy = n.acc === 1 ? -4 : -3;
          for (let y = 0; y < sign.length; y++)
            for (let x = 0; x < 3; x++) if (sign[y][x] === "1") put(buf, n.nx - 4 + x, n.ny + dy + y, accC.map((v, j) => v * (1 - st.play) + white[j] * st.play), a);
        }
      }
    }
    // The playhead: a faint line through the staff at the note sounding.
    if (playX >= 0) for (let y = y0 + 10; y <= y0 + 31; y++) put(buf, playX, y, white, 0.22);
  });

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(buf[o], 0, 255)), round(cl(buf[o + 1], 0, 255)), round(cl(buf[o + 2], 0, 255)));
    }
}
