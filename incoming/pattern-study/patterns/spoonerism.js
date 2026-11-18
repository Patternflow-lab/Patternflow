// ===== Patternflow pattern =====
// Title:   Spoonerism
// Family:  type
// Idea:    A phrase stacks down the panel as lettered tiles, one word to a line, each word in its own colour, and the first letters of two words lift off and swing across each other on arcs to trade places, so that "a lack of pies" lands as "a pack of lies", the tile keeping the colour of the word it came from, and when a hop leaves a word one letter longer or shorter the rest of its line slides to make room.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the spoonerism (William Archibald Spooner, 1844-1930, warden of New College, Oxford; many sayings told of him are thought to be invented), the 3 by 5 capitals of Saccades (pattern round 106), copied from kasiski-examination.js; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..3, Phrase=0..6, Loft=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the words are cyan, violet, green, pink and blue from the top, each tile dim with its letter bright and pale, and the colours that would dim to brown are made paler.
// Knob 2: Speed. How fast the show goes, a phrase to a phrase. At 2 one phrase takes 6.6 s: the tiles come in over 0.5 s, the phrase is held for 1.7 s, the letters are in the air for 1.5 s, the new phrase is held for 2.4 s and it fades over 0.5 s. At 3 that is 4.4 s and at 0.4 it is 33 s.
// Knob 3: Phrase. Which phrase it is on, from 0 to 6, a whole number. Turning it jumps there and the show goes on from that phrase through the rest and round again. 0 a lack of pies, 1 tons of soil, 2 a well-oiled bicycle, 3 you have hissed my mystery lectures, 4 a blushing crow, 5 tease my ears, 6 jelly beans.
// Knob 4: Loft. How high and how wide the letters are thrown. At 0 the one that goes over is thrown 0.3 of the way between its two lines above the straight path, and half a tile more, swings one tile to the side and looks 1.3 times as big at the top; at 1 it is thrown 0.85 of the way, as high as the panel lets it, swings 2.1 tiles aside and looks 2.2 times as big. The one that goes under rises 0.3 as much and swings 0.8 as far. Four fading copies of each tile follow it along its path.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: a dim orange or yellow is made paler and a good deal lighter.
function tint(h, s, v, out) {
  const f = fr(h);
  if (f > 0.02 && f < 0.2) {
    s *= 0.4;
    v = min(1, v * 1.7);
  }
  hsv(h, s, v, out);
}

// The face: capitals 3 wide and 5 tall from saccades.js by way of
// kasiski-examination.js, and a hyphen.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###", "-": "...|...|###|...|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// The phrases. s is the size of a letter cell in LEDs: a letter is 3 cells by
// 5 on a tile one LED larger on every side. A line of the phrase is a word, or
// two short ones. moves lists the letters that fly, as the line and place they
// leave in "before", the line and place they land in "after", and g: 0 for the
// one that goes over the top, 1 for the one that goes under.
const PHRASES = [
  { s: 3, before: ["a", "lack", "of", "pies"], after: ["a", "pack", "of", "lies"], moves: [[1, 0, 3, 0, 0], [3, 0, 1, 0, 1]] },
  { s: 4, before: ["tons", "of", "soil"], after: ["sons", "of", "toil"], moves: [[0, 0, 2, 0, 0], [2, 0, 0, 0, 1]] },
  { s: 2, before: ["a", "well-", "oiled", "bicycle"], after: ["a", "well-", "boiled", "icicle"], moves: [[3, 0, 2, 0, 0]] },
  { s: 2, before: ["you have", "hissed", "my", "mystery", "lectures"], after: ["you have", "missed", "my", "history", "lectures"], moves: [[1, 0, 3, 0, 0], [3, 0, 1, 0, 1]] },
  { s: 2, before: ["a", "blushing", "crow"], after: ["a", "crushing", "blow"], moves: [[1, 0, 2, 0, 0], [1, 1, 2, 1, 0], [2, 0, 1, 0, 1], [2, 1, 1, 1, 1]] },
  { s: 3, before: ["tease", "my", "ears"], after: ["ease", "my", "tears"], moves: [[0, 0, 2, 0, 0]] },
  { s: 3, before: ["jelly", "beans"], after: ["belly", "jeans"], moves: [[0, 0, 1, 0, 0], [1, 0, 0, 0, 1]] },
];
const NP = PHRASES.length;
const HUES = [0.52, 0.78, 0.33, 0.93, 0.62];

// The time of one phrase, in seconds of the show at Speed 2.
const IN = 0.5, H1 = 1.7, FLY = 1.5, H2 = 2.4, OUT = 0.5;
const T1 = IN + H1, T2 = T1 + FLY, T3 = T2 + H2, TOTAL = T3 + OUT;

// Each phrase is turned into its tiles once. A tile is a letter with the cell
// it stands in before and after, the line it came from (its colour), and what
// it does: 0 stays put, 1 flies, 2 stays and turns into another letter (the
// spelling of "icicle" is not the sound of "bicycle" with a letter taken off).
const TILES = PHRASES.map((ph) => {
  const s = ph.s, adv = 3 * s + 2, th = 5 * s + 2, L = ph.before.length;
  const pitch = min(floor((120 - th) / (L - 1)), L === 2 ? 70 : th + 36), block = (L - 1) * pitch + th, top = floor((H - block) / 2);
  const cell = (lines, li, ci) => ({ x: floor((W - lines[li].length * adv) / 2) + ci * adv, y: top + li * pitch });
  const list = (lines) => {
    const out = [];
    lines.forEach((ln, li) => {
      for (let ci = 0; ci < ln.length; ci++) if (ln[ci] !== " ") out.push({ li, ci, ch: ln[ci].toUpperCase() });
    });
    return out;
  };
  const from = list(ph.before), to = list(ph.after);
  const tiles = [];
  for (const mv of ph.moves) {
    const a = from.find((c) => c.li === mv[0] && c.ci === mv[1]), b = to.find((c) => c.li === mv[2] && c.ci === mv[3]);
    a.used = b.used = true;
    tiles.push({ kind: 1, g: mv[4], ch0: a.ch, ch1: b.ch, a: cell(ph.before, a.li, a.ci), b: cell(ph.after, b.li, b.ci), hue: a.li, order: from.indexOf(a) });
  }
  const restA = from.filter((c) => !c.used), restB = to.filter((c) => !c.used);
  restA.forEach((a, i) => {
    const b = restB[i];
    tiles.push({ kind: a.ch === b.ch ? 0 : 2, g: 0, ch0: a.ch, ch1: b.ch, a: cell(ph.before, a.li, a.ci), b: cell(ph.after, b.li, b.ci), hue: a.li, order: from.indexOf(a) });
  });
  return { s, adv, tw: adv, th, pitch, tiles, sentence: [ph.before.join(" "), ph.after.join(" ")] };
});

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, loft: 0.06, ph: 0, clk: 0, knob: -1,
    buf: new Float32Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.4, 3);
  const kp = cl(round(k[2]), 0, NP - 1);
  S.loft = cl(k[3], 0, 1);
  // The knob jumps to its phrase when it is turned; after that the show
  // carries on by itself from there.
  if (kp !== S.knob) {
    S.knob = kp;
    S.ph = kp;
    S.clk = 0;
  }
  S.clk += (d * S.speed) / 2;
  if (S.clk >= TOTAL) {
    S.clk -= TOTAL;
    S.ph = (S.ph + 1) % NP;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, clk = S.clk, P = TILES[S.ph], s = P.s, tw = P.tw, th = P.th;
  buf.fill(0);
  const hb = S.hue;
  const fade = (1 - sm((clk - T3) / OUT)) * 1;
  const TILEC = [0, 0, 0], LETC = [0, 0, 0];

  // One tile, its top left at (left, top) after being scaled by f about its
  // centre: a dim tile in its colour with the corners cut and the letter on
  // it. gl is the letter's cells, 0 to 1 each, and tv how bright the tile is.
  const tile = (cx, cy, f, gl, hue, tv, a, letter) => {
    tint(hb + HUES[hue % HUES.length], 0.85, tv, TILEC);
    tint(hb + HUES[hue % HUES.length], 0.28, 1, LETC);
    const w = round(tw * f), h = round(th * f), left = round(cx - w / 2), top = round(cy - h / 2);
    for (let y = 0; y < h; y++) {
      const yy = top + y;
      if (yy < 0 || yy >= H) continue;
      const ly = (y + 0.5) / f;
      for (let x = 0; x < w; x++) {
        const xx = left + x;
        if (xx < 0 || xx >= W) continue;
        const lx = (x + 0.5) / f;
        if ((lx < 1 || lx > tw - 1) && (ly < 1 || ly > th - 1)) continue;
        let v = 0;
        if (letter && lx >= 1 && lx < 1 + 3 * s && ly >= 1 && ly < 1 + 5 * s) v = gl[floor((ly - 1) / s) * 3 + floor((lx - 1) / s)];
        const o = (yy * W + xx) * 3;
        for (let c = 0; c < 3; c++) {
          const val = (TILEC[c] + (LETC[c] - TILEC[c]) * v) * a;
          if (val > buf[o + c]) buf[o + c] = val;
        }
      }
    }
  };
  // The same, with a clear ring a LED wide round it first, so a tile in the
  // air reads over what it crosses.
  const halo = (cx, cy, f) => {
    const w = round(tw * f), h = round(th * f), left = round(cx - w / 2) - 1, top = round(cy - h / 2) - 1;
    for (let y = max(0, top); y < min(H, top + h + 2); y++) for (let x = max(0, left); x < min(W, left + w + 2); x++) {
      const o = (y * W + x) * 3;
      buf[o] = buf[o + 1] = buf[o + 2] = 0;
    }
  };

  // The reading light: a line at a time, down the phrase, from time t0.
  const sweep = (li, t0) => exp(-(((clk - t0 - li * 0.28) / 0.2) ** 2));

  const glyphA = (t) => GLYPH[t.ch0], glyphB = (t) => GLYPH[t.ch1];
  const mix = (A, B, m) => {
    const out = new Array(15);
    for (let i = 0; i < 15; i++) out[i] = A[i] + (B[i] - A[i]) * m;
    return out;
  };

  const flyers = [];
  for (const t of P.tiles) {
    const appear = sm((clk - 0.045 * t.order) / 0.3) * fade;
    if (appear <= 0) continue;
    const fly = t.kind === 1;
    let x, y, gl = glyphA(t), tv = 0.22;
    const es = sm((clk - T1 - 0.05) / (FLY * 0.7));
    if (fly) {
      // Before it goes the tile is marked, after it lands it stays marked.
      const dur = FLY * 0.86, u = cl((clk - T1 - t.g * 0.14 * FLY) / dur, 0, 1);
      const cx0 = t.a.x + tw / 2, cy0 = t.a.y + th / 2, cx1 = t.b.x + tw / 2, cy1 = t.b.y + th / 2;
      const mark = clk < T1 ? 0.6 + 0.4 * sin(clk * 7) : 1;
      tv = 0.22 + 0.17 * mark * (clk < T3 - 0.01 ? 1 : fade);
      if (u <= 0) {
        x = t.a.x;
        y = t.a.y;
        gl = glyphA(t);
      } else if (u >= 1) {
        x = t.b.x;
        y = t.b.y;
        gl = glyphB(t);
        tv += 0.35 * exp(-(clk - T1 - t.g * 0.14 * FLY - dur) / 0.22);
      } else {
        flyers.push({ t, u, cx0, cy0, cx1, cy1, appear });
        // The seats it left and will fill, faint.
        tile(cx0, cy0, 1, gl, t.hue, 0.09 * appear, 1, false);
        tile(cx1, cy1, 1, gl, t.hue, 0.09 * appear, 1, false);
        continue;
      }
    } else {
      x = t.a.x + (t.b.x - t.a.x) * es;
      y = t.a.y + (t.b.y - t.a.y) * es;
      if (t.kind === 2) gl = mix(glyphA(t), glyphB(t), sm((clk - T1 - FLY * 0.6) / 0.5));
    }
    // The reading light passes over a phrase when it has landed, and over the first one as it is shown.
    const lit = sweep(t.hue, IN) * (clk < T1 ? 1 : 0) + sweep(t.hue, T2 + 0.1) * (clk > T2 ? 1 : 0);
    tile(x + tw / 2, y + th / 2, 1, gl, t.hue, min(1, tv + 0.2 * lit), appear, true);
  }

  // The tiles in the air, the one that goes under first.
  flyers.sort((p, q) => q.t.g - p.t.g);
  for (const fl of flyers) {
    const { t, u, appear } = fl;
    const v = S.loft;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const dist = abs(fl.cy1 - fl.cy0);
    const room = (fl.cy0 + fl.cy1) / 2 - th * 0.8 - 2;
    const lift = min(room, ((0.3 + 0.55 * v) * max(dist, 30) + th * 0.5) * (t.g ? 0.3 : 1));
    const side = (fl.cx0 < 32 ? 1 : -1) * (t.g ? -0.8 : 1) * tw * (1 + 1.1 * v);
    const at = (ee) => {
      const arc = 4 * ee * (1 - ee);
      return {
        x: cl(fl.cx0 + (fl.cx1 - fl.cx0) * ee + side * arc, tw / 2, W - tw / 2),
        y: fl.cy0 + (fl.cy1 - fl.cy0) * ee - lift * arc,
        f: 1 + (0.3 + 0.9 * v) * arc * (t.g ? 0.6 : 1),
      };
    };
    // Four earlier places on the path, fainter each time, as in a flash photograph.
    for (let j = 4; j >= 1; j--) {
      const uj = u - j * 0.1;
      if (uj <= 0) continue;
      const pj = at(0.5 - 0.5 * Math.cos(Math.PI * uj));
      tile(pj.x, pj.y, pj.f, glyphA(t), t.hue, 0.22, 0.5 * (1 - j / 5) * appear, true);
    }
    const p = at(e);
    halo(p.x, p.y, p.f);
    tile(p.x, p.y, p.f, glyphA(t), t.hue, 0.52, appear, true);
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
