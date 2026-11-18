// ===== Patternflow pattern =====
// Title:   Horspool
// Family:  type
// Idea:    A line of text runs down the panel as a column of capitals and the word being looked for slides down beside it, compares from its last letter upward, then jumps by what a skip table says for the text letter under its foot, so most of the text is never read, the letters that were read stay bright and a counter at the foot sets the comparisons made against the naive total.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Horspool's string search (Nigel Horspool, 1980), which simplifies the bad-character rule of the Boyer-Moore search (Robert Boyer and J Strother Moore, 1977), both years from memory; the 3 by 5 capitals of Saccades (pattern round 106) and the digits drawn for Kasiski Examination (pattern round 108), copied from edit-distance.js, pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pair=1..5, Lean=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together, skipping the stretch from orange to lime that reads brown on the dim letters. At 0 the text is pale azure and dim azure where it was never read, the word and the table's letters are violet, a letter that matches is green, a mismatch red, and a found word, the jumps and the table row in use are gold; at 0.25 the text is violet and at 0.75 green.
// Knob 2: Speed. At 2 one comparison takes 0.42 s, a lookup 0.7 s and a jump 0.45 to 0.95 s for a skip of 1 to 6. SAT in THE CAT SAT ON A MAT is searched in 18.6 s after 1 s of typing the text in, then 3 s hold and 0.5 s fade make a cycle of 22.1 s, and the five pairs together take 87 s. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Pair. Which text and word to start from, snapping at whole numbers: 1 THE CAT SAT ON A MAT for SAT (where it opens), 2 A LONG WALK HOME NOW for HOME, 3 WE ATE LUNCH AT NOON for LUNCH, 4 SNOW FALLS IN WINTER for WINTER and 5 SHE SELLS SEA SHELLS for SEAL, which is not in it; the search goes on to the next pair when one is done. It compares 14 letters for SAT where the naive scan compares 54, then 9 of 68, 9 of 80, 9 of 90 and 7 of 68, and reads 12, 8, 8, 8 and 7 of the 20 letters. The table has 3, 4, 5, 6 and 4 rows and the jumps run from 1 to 6.
// Knob 4: Lean. Shears the text, the word, its band and bracket and the jump arrow, 0.8 LED a letter at -1 and at 1, so the top and the foot of the column sit 15 LEDs apart: the column leans like a slash at -1, upright at 0 and like a backslash at 1. At the opening 0.06 it is upright. The skip table, the lookup and the counters stay where they are, and the letters keep their own shape.

const W = 64, H = 128;
const { floor, min, max, round, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// The knob's wheel runs from azure at 0 round violet, rose and red, then from lime round to azure, so the dim letters never sit on orange.
const wheel = (k) => (0.22 + ((0.33 + 0.81 * k) % 0.81)) % 1;

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, copied from edit-distance.js. A space is a tick on the bottom row.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  " ": "...|...|...|...|###", "*": "#.#|.#.|###|.#.|#.#",
  // The two marks between a pair of letters: equal and not equal.
  "=": "...|###|...|###|...", "!": "...|#.#|.#.|#.#|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => c === "#");

// The five pairs: a text of 18 to 20 characters and the word to find.
const PAIRS = [
  ["THE CAT SAT ON A MAT", "SAT"], ["A LONG WALK HOME NOW", "HOME"], ["WE ATE LUNCH AT NOON", "LUNCH"],
  ["SNOW FALLS IN WINTER", "WINTER"], ["SHE SELLS SEA SHELLS", "SEAL"],
];

// Seconds at Speed 2.
const INTRO = 1, TC = 0.42, CEL = 1.3, LOOK = 0.7, END = 3, FADE = 0.5;
// Layout: letter k of the text has its top row at TY + 6 k. The columns, left to right, before the lean.
const TY = 4, XG = 9, XT = 12, XL = 16, XP = 20, XB = 24, XK = 26, XA = 28, XD = 30;

// Horspool's search, run for real. The table gives, for each letter of the word but the last, its distance from the word's last
// position; every other letter, the last one included unless it comes earlier too, shifts the word by its whole length. The word
// is laid at the start of the text and compared from its last letter backwards; on a mismatch or a full match the text letter
// under the word's last position is looked up and the word jumps by that many.
function build(pi) {
  const [text, pat] = PAIRS[pi], n = text.length, m = pat.length, table = new Map();
  for (let k = 0; k < m - 1; k++) table.set(pat[k], m - 1 - k);
  const entries = [];
  for (let k = 0; k < m - 1; k++) if (!entries.some((e) => e.ch === pat[k])) entries.push({ ch: pat[k], sh: table.get(pat[k]) });
  entries.push({ ch: "*", sh: m });
  const wins = [];
  let t = INTRO, p = 0, comps = 0;
  while (p <= n - m) {
    const w = { p, t0: t, cmp: [], found: false, cel: 0, k0: comps };
    for (let j = m - 1; j >= 0; j--) {
      const ok = text[p + j] === pat[j];
      w.cmp.push({ j, i: p + j, ok, t });
      t += TC;
      comps++;
      if (!ok) break;
      if (j === 0) w.found = true;
    }
    if (w.found) (w.cel = t), (t += CEL);
    w.c = text[p + m - 1];
    w.sh = table.has(w.c) ? table.get(w.c) : m;
    w.row = entries.findIndex((e) => e.ch === w.c);
    if (w.row < 0) w.row = entries.length - 1;
    w.look = t;
    t += LOOK;
    w.slide = t;
    w.sdur = 0.35 + 0.1 * w.sh;
    t += w.sdur;
    w.t1 = t;
    wins.push(w);
    p += w.sh;
  }
  return { text, pat, n, m, entries, wins, comps, naive: m * (n - m + 1), end: t, total: t + END + FADE, found: wins.filter((w) => w.found).map((w) => w.p) };
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, pair: -1, pk: -1, lean: 0, T: 0, G: null, rgb: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.lean = cl(kv[3], -1, 1);
  // The knob picks the pair to start from, and the search goes on to the next pair when one is done.
  const pk = cl(round(kv[2]), 1, PAIRS.length) - 1;
  if (pk !== S.pk) {
    S.pk = pk;
    S.pair = pk;
    S.G = build(pk);
    S.T = 0;
  }
  S.T += (d * S.speed) / 2;
  if (S.T >= S.G.total) {
    S.pair = (S.pair + 1) % PAIRS.length;
    S.G = build(S.pair);
    S.T = 0;
  }
}

// Blend colour c over the frame at weight a.
function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3, k = min(1, a);
  rgb[o] += (c[0] - rgb[o]) * k;
  rgb[o + 1] += (c[1] - rgb[o + 1]) * k;
  rgb[o + 2] += (c[2] - rgb[o + 2]) * k;
}
function glyph(rgb, ch, x, y, c, a, sc) {
  const g = GLYPH[ch];
  if (!g) return;
  for (let i = 0; i < 15; i++)
    if (g[i]) for (let v = 0; v < sc; v++) for (let u = 0; u < sc; u++) put(rgb, x + (i % 3) * sc + u, y + floor(i / 3) * sc + v, c, a);
}
function number(rgb, v, x, y, c, a, sc) {
  for (const ch of String(v)) {
    glyph(rgb, ch, x, y, c, a, sc);
    x += 3 * sc + sc;
  }
}
const mix = (a, b, t, out) => ((out[0] = a[0] + (b[0] - a[0]) * t), (out[1] = a[1] + (b[1] - a[1]) * t), (out[2] = a[2] + (b[2] - a[2]) * t), out);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const G = S.G, T = S.T, rgb = S.rgb, { n, m, wins, entries } = G;
  rgb.fill(0);
  const hb = wheel(S.hue);
  const pale = hsv(hb, 0.25, 1, [0, 0, 0]), dim = hsv(hb, 0.55, 0.5, [0, 0, 0]), cPat = hsv(hb + 0.14, 0.62, 1, [0, 0, 0]);
  const green = hsv(hb - 0.2, 0.78, 1, [0, 0, 0]), red = hsv(hb - 0.56, 0.88, 1, [0, 0, 0]), gold = hsv(hb - 0.44, 0.78, 1, [0, 0, 0]);
  const barC = hsv(hb, 0.7, 0.52, [0, 0, 0]), tickDim = hsv(hb, 0.5, 0.3, [0, 0, 0]), white = [1, 1, 1], black = [0, 0, 0], tmp = [0, 0, 0];
  const fade = T > G.total - FADE ? sm((G.total - T) / FADE) : 1;
  // The lean: a whole number of LEDs for each row of letters, about the middle of the column.
  const k = S.lean * 0.8, off = (i) => round(k * (i - 9.5)), rowY = (i) => TY + 6 * i;
  const offY = (y) => off((y - TY) / 6);

  // Which window the search is in, and the state of every comparison made so far.
  let wi = 0;
  for (let q = 0; q < wins.length; q++) if (wins[q].t0 <= T) wi = q;
  const W0 = wins[wi], done = T >= G.end, intro = T < INTRO;
  const last = new Array(n).fill(null);
  let comps = 0;
  const seenWin = new Set();
  for (const w of wins) {
    if (w.t0 > T) break;
    seenWin.add(w.p);
    for (const c of w.cmp)
      if (c.t <= T) {
        last[c.i] = { ok: c.ok, t: c.t, w };
        comps++;
      }
  }

  // The word's window: its position slides between jumps, and it fades out when the search is over.
  const sl = !done && T >= W0.slide ? sm((T - W0.slide) / W0.sdur) : 0;
  let pa = W0.p + W0.sh * sl, wa = 1;
  if (done) {
    const lw = wins[wins.length - 1];
    pa = lw.p + lw.sh;
    wa = max(0, 1 - (T - G.end) / 0.5);
  }
  const cel = W0.found && T >= W0.cel && !done;
  // A band behind the window, text and word together.
  if (wa > 0) {
    const bandC = cel ? gold : cPat;
    for (let y = round(rowY(pa)) - 1; y <= round(rowY(pa + m)) - 3; y++) {
      const o = offY(y);
      for (let x = XT - 1; x < XB; x++) put(rgb, x + o, y, bandC, 0.14 * wa * fade * (intro ? sm((T - 0.6) / 0.4) : 1));
    }
  }

  // The text.
  for (let i = 0; i < n; i++) {
    const a = intro ? sm((T - i * 0.03) / 0.25) : 1;
    if (a <= 0) continue;
    const l = last[i];
    mix(dim, dim, 0, tmp);
    if (!l && done) mix(dim, black, 0.3 * sm((T - G.end) / 0.8), tmp);
    if (l) {
      // A letter that was read stays bright; its result colours it while the word stays there and for half a second after.
      const e = T < l.w.slide ? 1 : max(0, 1 - (T - l.w.slide) / 0.5), res = l.ok ? green : red, age = T - l.t;
      if (age < 0.14) mix(pale, white, 1, tmp);
      else mix(pale, res, e, tmp);
    }
    for (const w of wins) if (w.found && T >= w.cel && i >= w.p && i < w.p + m) mix(tmp, gold, 0.85, tmp);
    glyph(rgb, G.text[i], XT + off(i), rowY(i), tmp, a * fade, 1);
  }

  // Alignments the naive scan would try, one tick each: gold where the search came, dim where it never did.
  for (let p = 0; p <= n - m; p++) {
    const seen = seenWin.has(p), cur = !done && !intro && W0.p === p && T < W0.slide;
    const c = cur ? white : seen ? gold : tickDim;
    for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) put(rgb, XK + off(p) + u, rowY(p) + 1 + v, c, (seen || cur ? 0.95 : 0.9) * fade * (intro ? sm((T - 0.4) / 0.4) : 1));
  }

  // The word's window.
  if (wa > 0) {
    const pulse = 0.65 + 0.35 * sin((T - W0.cel) * 9);
    for (let j = 0; j < m; j++) {
      const r = pa + j, y = rowY(r), ri = round(r);
      let c = cPat, f = 1;
      if (cel) c = mix(gold, white, 0.35 * (1 - pulse), tmp);
      else {
        const cm = W0.cmp.find((q) => q.j === j && q.t <= T);
        if (cm && !done) {
          c = cm.ok ? green : red;
          if (T - cm.t < 0.14) c = white;
        }
      }
      const x = XP + off(ri);
      glyph(rgb, G.pat[j], x, round(y), c, f * wa * fade * (intro ? sm((T - 0.6) / 0.4) : 1), 1);
      // The mark between the word's letter and the text's: equal or not equal, for each comparison made at this window.
      const cm = W0.cmp.find((q) => q.j === j && q.t <= T);
      if (cm && !done && T < W0.slide + 0.2) {
        const lk = 1 - cl((T - W0.slide) / 0.2, 0, 1);
        glyph(rgb, cm.ok ? "=" : "!", XL + off(cm.i), rowY(cm.i), cm.ok ? green : red, lk * fade, 1);
      }
    }
    // The bracket round the window, on the right of the word.
    const y0 = round(rowY(pa)) - 1, y1 = round(rowY(pa + m)) - 3;
    for (let y = y0; y <= y1; y++) {
      const o = offY(y), bc = cel ? gold : cPat;
      put(rgb, XB + o, y, bc, 0.9 * wa * fade);
      if (y === y0 || y === y1) put(rgb, XB + o - 1, y, bc, 0.9 * wa * fade);
    }
  }

  // A found word keeps a gold bracket on the left of the text.
  for (const w of wins)
    if (w.found && T >= w.cel) {
      const y0 = rowY(w.p) - 1, y1 = rowY(w.p + m) - 3, a = sm((T - w.cel) / 0.3) * (done ? 0.82 + 0.18 * sin(T * 4) : 1);
      for (let y = y0; y <= y1; y++) {
        put(rgb, XG + offY(y), y, gold, a * fade);
        if (y === y0 || y === y1) put(rgb, XG + offY(y) + 1, y, gold, a * fade);
      }
    }

  // The last jump: a line from where the word was to where it stands, an arrowhead and the skip as a digit.
  let A = null;
  for (const w of wins) if (w.slide <= T) A = w;
  if (A) {
    const s = sm((T - A.slide) / A.sdur), aa = T < A.t1 + 0.7 ? 1 : max(0, 1 - (T - A.t1 - 0.7) / 0.5);
    const ya = rowY(A.p) + 2, yb = round(rowY(A.p + A.sh * s)) + 2;
    for (let y = ya; y <= yb; y++) put(rgb, XA + offY(y), y, gold, aa * fade);
    if (yb > ya + 1) {
      const o = offY(yb);
      for (const [dx, dy] of [[-2, -2], [2, -2], [-1, -1], [1, -1], [0, 0]]) put(rgb, XA + o + dx, yb + dy, gold, aa * fade);
    }
    const ym = cl(round((ya + yb) / 2) - 2, 4, 119);
    glyph(rgb, String(A.sh), XD + offY(ym), ym, gold, aa * fade * cl((T - A.slide) / 0.15 + 0.3, 0, 1), 1);
  }

  // The skip table, top right: a row for each letter of the word but the last, and one for every other letter. The row the
  // lookup used lights while the word jumps. A bar is a skip's length, as wide as the longest fits.
  const NE = entries.length, pitch = min(16, floor(60 / NE)), bh = min(10, pitch - 4), unit = floor(13 / m), ty = 4 + floor((64 - NE * pitch) / 2);
  const fire = !intro && !done && T >= W0.look ? sm((T - W0.look) / 0.2) : 0;
  for (let e = 0; e < NE; e++) {
    const y = ty + e * pitch, hot = fire * (e === W0.row ? 1 : 0), E = entries[e], gy = y + floor((bh - 5) / 2);
    const a = fade * (intro ? sm((T - 0.5 - e * 0.1) / 0.3) : 1);
    const lc = mix(cPat, gold, hot, [0, 0, 0]), bc = mix(barC, gold, hot, [0, 0, 0]);
    glyph(rgb, E.ch, 40, gy, lc, a, 1);
    glyph(rgb, String(E.sh), 45, gy, hot ? white : pale, a * (0.6 + 0.4 * hot), 1);
    for (let u = 0; u < E.sh * unit; u++) for (let v = 0; v < bh; v++) put(rgb, 50 + u, y + v, bc, a * (0.75 + 0.25 * hot));
    if (hot > 0.5) for (let v = 0; v < bh; v += 2) put(rgb, 38, y + v, gold, hot * fade);
  }

  // The lookup, in large type: the text letter under the word's foot, and the skip it finds.
  const by = 74;
  if (!done) {
    const ch = G.text[W0.p + m - 1], a = (intro ? 0 : 1) * fade, hot = fire;
    glyph(rgb, ch, 40, by, mix(dim, gold, hot, [0, 0, 0]), a * (0.75 + 0.25 * hot), 3);
    if (fire > 0) {
      for (let u = 0; u < 4; u++) put(rgb, 50 + u, by + 7, gold, fire * fade);
      for (const [dx, dy] of [[0, -2], [1, -1], [1, 1], [0, 2]]) put(rgb, 53 + dx, by + 7 + dy, gold, fire * fade);
      glyph(rgb, String(W0.sh), 55, by, white, fire * fade, 3);
    }
  } else {
    const a = sm((T - G.end) / 0.4) * fade;
    number(rgb, G.comps, 40, by, gold, a, 3);
  }

  // The foot: comparisons made against the naive total, as numbers and as bars of one scale.
  const ca = fade * (intro ? sm((T - 0.4) / 0.5) : 1), shown = done ? G.comps : comps;
  glyph(rgb, "N", 40, 96, dim, ca, 2);
  number(rgb, G.naive, 48, 96, pale, ca * 0.9, 2);
  for (let v = 0; v < 3; v++) for (let u = 0; u < 23; u++) put(rgb, 40 + u, 108 + v, barC, ca * 0.85);
  glyph(rgb, "H", 40, 114, gold, ca, 2);
  number(rgb, shown, 48, 114, white, ca * (done ? 1 : 0.9), 2);
  const bw = max(shown > 0 ? 1 : 0, round((23 * shown) / G.naive));
  for (let v = 0; v < 3; v++) for (let u = 0; u < bw; u++) put(rgb, 40 + u, 125 + v, gold, ca);
  if (done) for (let u = 0; u < 23; u++) put(rgb, 40 + u, 107, gold, 0.5 * ca * (0.6 + 0.4 * sin(T * 6)));
  // A rule between the page and the table.
  for (let y = 0; y < H; y += 2) put(rgb, 36, y, tickDim, 0.7 * fade);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
