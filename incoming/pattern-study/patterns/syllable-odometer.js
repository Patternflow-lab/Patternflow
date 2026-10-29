// ===== Patternflow pattern =====
// Title:   Syllable Odometer
// Family:  type
// Idea:    Three reels of Hangul jamo roll like the wheels of an odometer through all 11,172 modern syllables in Unicode order, the final fastest, then the vowel, then the initial, while a big syllable above them shows what they spell, solid when it is one of the 2,350 that KS C 5601-1987 encoded and hollow when it is not, two rolling counters count every syllable and the encoded ones, and a map of the current initial's 21 vowels by 28 finals lights up as the odometer passes.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Hangul Syllables block, U+AC00 + (initial x 21 + vowel) x 28 + final (Unicode 2.0, 1996), against the 2,350 precomposed syllables (wansung) of KS C 5601-1987, now KS X 1001; the 9 by 11 combining Hangul face of Wongoji (pattern round 64); pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Initial=0..18, Skip=0..1
//
// Knob 1: Hue. Turns the palette round the wheel: at 0 the encoded syllables are amber and the missing ones blue-violet, at 0.25 green and rose, at 0.5 azure and lime; the reels and the first counter stay a pale tint of the encoded colour.
// Knob 2: Speed. Steps a second: 0.5 at 0.2, 6 at the opening 2 (the first vowel row in 4.6 seconds, the 588 syllables of ㄱ in 94, all 11,172 in 30 minutes), 48 at 3.
// Knob 3: Initial. Sets the slowest wheel by hand, 0 for ㄱ (가) up to 18 for ㅎ (하): the panel opens on the first syllable of that initial, and turned later the odometer spins on to it, starts a new map and counts on from there.
// Knob 4: Skip. How long the odometer stays on a syllable KS C 5601 left out, as a share of a step: all of it at 0, 0.94 at the opening 0.06, none at 1, where it counts like a wansung machine that has only the 2,350 and spins over the other 8,822 between them (all 11,172 in 6.5 minutes at Speed 2).

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, asin, cos, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The 2,350. Bit i is syllable U+AC00 + i, six bits a character, low
// bit first. Built offline by decoding the EUC-KR bytes B0A1..C8FE (rows
// B0..C8, cells A1..FE: 25 rows of 94) and marking each syllable they give.
// The decoded set has 2,350 syllables in Unicode order, misses 똠 (U+B620),
// and per initial ㄱ..ㅎ holds 171 120 141 128 86 127 129 129 73 163 86 208
// 135 82 112 107 106 105 142.
const A64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const KS =
  "Tew/+EBsDMRAoAREAAwkFsnHRA7AXGwOSEBoAMZlrBTUwKQEBIDMRArAREgCwkHuGMRAwABAACwEBsAERAAATOwKQAAAAMZBrR" +
  "XUwOyEBsDMQAAAAAAAwFBsDMBApAREAGSAAAAMVArDDEAMwAAACERAjABAAAwEBuGEQAwATEwEQEBMAEAAAATV4KCAAAAMRArA" +
  "Xew+6EBsDMRAhAAAAAwGNsDORA7ATEwMREAAAMRBrwREAEAAAAAERALATEgKwkBsCEAAQABAAAQEBMAMQAjATcwaUEBAAMRBrQ" +
  "X+4+4EBsDEAAAAAAAAwlNsKNRA7AREAMQEAAAMZFrKREAAQAAABERALABAAAwEBsCEAAQABAAIQEBoCERAhATWwKQAAAAMZA7B" +
  "TEwO4EBsDAAAAAAAAAwENsDORA7ABAAEAAAAAMRAgABEAAQAAAAEBAAAAAAAwEBGCAAAAABAAAQEBMCAAAAATGwCQEBMAERArA" +
  "TEwe8EBsDMBAoAAAAAwEBsDORArATEwOQEAoAMRArARAAIAAAABERArAREgKwEBsCEAAQABAAAwEBkCMRArATEwaGAAAAMRArA" +
  "Tfwa6EBsHMQAgAAAAAwEFsGORA7ATEAuQAAAAsRBrARAAMAAAAAERAqAREgCwlHsiGRAKABAAAQEBAAERAJAREQCAAAAAMZB7K" +
  "f+wKyEBsjMBACAAAAAwkFsGMZA7ATEgOSEAAAcRArARAAEQAAABMRADARAAAwkHsiFQAQABAAAwEBACERApATEwCAAAAAMRBrD" +
  "TUwO4EBsDMAABAAAAAwkBkDEAAgADAwOAAAAAMRAjAAAAAAAAAAEAAAABAAIwEBkCAAAAAAAAAAAAAAEAAgAREwAAAAAAMRArA" +
  "bewOyEBsDMRArAREQIwnNsDNRA7ATEwOQEBACcRBrITEAIQEBkBERALATEwKwkBsqFAAQATEQIwEBsCMQApATMwKAAAAAMZgrQ" +
  "bEwM4EBMDAAAgAAAAAwEFMDERAAAAAAAAEAAAMZBjATAAEQAAABERADABAAAwEBMCEAAQABAAAQEAAAAAAgATU4AQEBEAMRArA" +
  "zd4O2EBsDMRCroREgAwsH8XNRArAX0wPeEBsBMxlrCTEwOwEAkCMRArATEwKwEHsCMRAzATEwIwEBsCMRArCTE06fEBkAMxh7R" +
  "TXwewEBsDMVAhAREAAwEFsGMRArAREwMQAAAAMRBrjDEgKQAAADERArATAAIwEHsCEAAQABAAAwEBsAERABATEwKAAAAAMZBrZ" +
  "TlwOwEBsDEBAgAAAAAwEBsDEAAgABAAEAAAAAMRArCDEAEQAAABERADAAAAIwEBMCEAAwAAAAAQAAAAEAAAABAQKAAAAAMRAjh" +
  "TFwewEBsDEVAhAAAAAwEBsDMRArARAAEQEAACMRArAREAIAAAAAERArABAQAwEBsCEAAQARAAAQEBsCERAhATEwKAAAAAM5ArA" +
  "TEwKwEBsDMAAgAAAAAwkBsDMRArAREwOQAAAAMRArATEQIQAAACEQAAABAAAwEBsCERAgABAAIwEBsCERABATEwIAAAAAMRArA" +
  "TMwOwEBsDEAAgAAAAAwEFsDMRArARAAEQEAAAMRArQRAAAQAAAAEBAoABAAAwEBsCEAAQABAAAwEBMCERAhATWwCQEBMAMRArA" +
  "XUwOyEBsDMAAAAAAAAwEBsDMRArAREwMQABoAMRArABAAIAAAAAEBAAAREgCwkFsCEAAgAAAAAQEBkAERApAREwCAAAAAMRArA" +
  "TEyKwEBsDEAAgAAAAAwEFsCMRArATEwOQEBIAMRIrITEAKwEAgCMRAqAREgCwEhkCERAhATEAIwEBsCMRApATPwKSEBMCMRArA";
const ALL = 11172;

// ---- The face: Wongoji's 9 by 11 combining Hangul (pattern round 64).
// Jamo are strokes, lists of points in a box w by h; a syllable puts them in
// boxes that depend on its vowel and on whether it has a final.
const INI = "g gg n d dd r m b bb s ss o j jj c k t p h".split(" ");
const FIN = ". g gg gs n nj nh d r rg rm rb rs rt rp rh m b bs s ss o j c k t p h".split(" ");

function ring(w, h, ox, oy) {
  const rw = min(w, h + 2), rh = min(h, w + 1);
  ox += (w - rw) >> 1;
  oy += (h - rh) >> 1;
  const R = rw - 1, B = rh - 1, c = R >> 1;
  const pts = rh <= 2 ? [[1, 0], [R - 1, 0], [R - 1, B], [1, B]] : [[c, 0], [1, 0], [0, 1], [0, B - 1], [1, B], [R - 1, B], [R, B - 1], [R, 1], [R - 1, 0], [c + 1, 0]];
  return pts.map(([x, y]) => [x + ox, y + oy]);
}
function legs(w, h, y0) {
  const c = (w - 1) >> 1, d = h - 1 - y0;
  const xl = max(0, round(c - 1.3 * d)), xr = min(w - 1, round(c + (w % 2 ? 0 : 1) + 1.3 * d));
  return [[[c, y0], [xl, h - 1]], [[c, y0 + max(1, round(d / 3))], [xr, h - 1]]];
}
function cons(k, w, h, tail) {
  const c = (w - 1) >> 1, m = (h - 1) >> 1, S = [];
  switch (k) {
    case "g":
      S.push(tail && h >= 6 ? [[0, 0], [w - 1, 0], [w - 1, h - 3], [w - 3, h - 1]] : [[0, 0], [w - 1, 0], [w - 1, h - 1]]);
      break;
    case "n":
      S.push([[0, 0], [0, h - 1], [w - 1, h - 1]]);
      break;
    case "d":
      S.push([[0, 0], [w - 1, 0]], [[0, 1], [0, h - 1], [w - 1, h - 1]]);
      break;
    case "r":
      if (h >= 5) S.push([[0, 0], [w - 1, 0], [w - 1, m]], [[0, m], [w - 2, m]], [[0, m + 1], [0, h - 1], [w - 1, h - 1]]);
      else {
        const z = w >> 1;
        S.push([[0, 0], [w - 1, 0], [w - 1, 1], [z, 1]], [[z, 2], [0, 2], [0, h - 1], [w - 1, h - 1]]);
      }
      break;
    case "m":
      S.push([[0, 0], [0, h - 1]], [[0, 0], [w - 1, 0], [w - 1, h - 1]], [[1, h - 1], [w - 2, h - 1]]);
      break;
    case "b":
      S.push([[0, 0], [0, h - 1]], [[w - 1, 0], [w - 1, h - 1]], [[1, m], [w - 2, m]], [[1, h - 1], [w - 2, h - 1]]);
      break;
    case "s":
      S.push(...legs(w, h, 0));
      break;
    case "o":
      S.push(ring(w, h, 0, 0));
      break;
    case "j":
      S.push([[0, 0], [w - 1, 0]], ...legs(w, h, 1));
      break;
    case "c":
      S.push([[c, 0], [c, 0]], [[0, 1], [w - 1, 1]], ...legs(w, h, 2));
      break;
    case "k":
      S.push([[0, 0], [w - 1, 0], [w - 1, h - 1]], [[0, h >> 1], [w - 2, h >> 1]]);
      break;
    case "t":
      S.push([[0, 0], [w - 1, 0]], [[1, m], [w - 1, m]], [[0, 1], [0, h - 1], [w - 1, h - 1]]);
      break;
    case "p": {
      const a = w >= 5 ? 1 : 0;
      S.push([[0, 0], [w - 1, 0]], [[a, 1], [a, h - 2]], [[w - 1 - a, 1], [w - 1 - a, h - 2]], [[0, h - 1], [w - 1, h - 1]]);
      break;
    }
    case "h":
      S.push(w >= 7 ? [[c - 1, 0], [c + 1, 0]] : [[c, 0], [c, 0]], [[0, 1], [w - 1, 1]], ring(w, h - 2, 0, 2));
      break;
  }
  return S;
}
// One consonant, or a double or cluster side by side, in a box at (x, y).
function group(key, x, y, w, h, tail) {
  const parts = [...key], out = [];
  const put = (list, dx) => list.forEach((s) => out.push(s.map(([a, b]) => [a + x + dx, b + y])));
  if (parts.length === 1) put(cons(parts[0], w, h, tail), 0);
  else {
    const w1 = (w - 1) >> 1;
    put(cons(parts[0], w1, h, false), 0);
    put(cons(parts[1], w - 1 - w1, h, false), w1 + 1);
  }
  return out;
}
// Vowels, as in Wongoji: vertical ones are the initial's width, then lines
// [0, x] and ticks [1, x0, x1, slot]; horizontal ones ticks above [2, x],
// bars [3, x0, x1] and stems below [4, x]; compounds have both.
const VV = {
  0: [5, [0, 6], [1, 7, 8, 0]],
  1: [5, [0, 6], [1, 7, 7, 0], [0, 8]],
  2: [5, [0, 6], [1, 7, 8, 1], [1, 7, 8, 2]],
  3: [5, [0, 6], [1, 7, 7, 1], [1, 7, 7, 2], [0, 8]],
  4: [5, [1, 6, 7, 0], [0, 8]],
  5: [4, [1, 5, 5, 0], [0, 6], [0, 8]],
  6: [5, [1, 6, 7, 1], [1, 6, 7, 2], [0, 8]],
  7: [4, [1, 5, 5, 1], [1, 5, 5, 2], [0, 6], [0, 8]],
  20: [6, [0, 7]],
};
const HV = { 8: [[2, 4], [3, 0, 8]], 12: [[2, 2], [2, 6], [3, 0, 8]], 13: [[3, 0, 8], [4, 4]], 17: [[3, 0, 8], [4, 2], [4, 6]], 18: [[3, 0, 8]] };
const MV = {
  9: [5, [[2, 2], [3, 0, 4]], [[0, 6], [1, 7, 8, 0]]],
  10: [5, [[2, 2], [3, 0, 4]], [[0, 6], [1, 7, 7, 0], [0, 8]]],
  11: [6, [[2, 2], [3, 0, 5]], [[0, 7]]],
  14: [5, [[3, 0, 4], [4, 2]], [[1, 5, 6, 3], [0, 8]]],
  15: [4, [[3, 0, 3], [4, 2]], [[1, 5, 5, 3], [0, 6], [0, 8]]],
  16: [6, [[3, 0, 5], [4, 3]], [[0, 7]]],
  19: [6, [[3, 0, 5]], [[0, 7]]],
};
const FREE = new Set(["g", "gg", "s", "ss", "j", "jj", "c", "k"]);
const NEED4 = new Set(["r", "b", "bb", "c", "k", "t", "h"]);

function vparts(parts, y0, y1, bar, out) {
  const mid = (y0 + y1) >> 1;
  for (const p of parts) {
    if (p[0] === 0) out.push([[p[1], y0], [p[1], y1]]);
    else {
      const y = p[3] === 0 ? mid : p[3] === 1 ? mid - 1 : p[3] === 2 ? mid + 1 : bar + 1;
      out.push([[p[1], y], [p[2], y]]);
    }
  }
}
function hparts(parts, bar, stem, out) {
  for (const p of parts) {
    if (p[0] === 2) out.push([[p[1], bar - 1], [p[1], bar - 1]]);
    else if (p[0] === 3) out.push([[p[1], bar], [p[2], bar]]);
    else out.push([[p[1], bar + 1], [p[1], bar + stem]]);
  }
}

// Syllable s (0..11171) as three stroke lists: initial, vowel, final.
function jamo(s) {
  const ci = floor(s / 588), vi = floor((s % 588) / 28), fi = s % 28;
  const ini = INI[ci], has = fi > 0, vow = [];
  let box;
  const fbox = FIN[fi].length > 1 ? [0, 7, 9, 4] : [1, 7, 7, 4];
  if (VV[vi]) {
    const [iw, ...parts] = VV[vi];
    box = has ? [0, 0, iw, 5] : [0, 2, iw, 7];
    vparts(parts, has ? 0 : 1, has ? 5 : 9, 0, vow);
  } else if (HV[vi]) {
    const up = vi === 8 || vi === 12, down = vi === 13 || vi === 17;
    let bar = 7;
    if (!has) {
      box = [1, 1, 7, 5];
      if (up) bar = 8;
    } else if (up) {
      box = FREE.has(ini) ? [1, 0, 7, 4] : [1, 0, 7, 3];
      bar = 5;
    } else if (down) {
      box = NEED4.has(ini) ? [1, 0, 7, 4] : [1, 0, 7, 3];
      bar = box[3] + 1;
    } else {
      box = [1, 0, 7, 4];
      bar = 5;
    }
    hparts(HV[vi], bar, has ? 1 : 2, vow);
  } else {
    const [iw, hp, vp] = MV[vi];
    const up = hp[0][0] === 2, flat = hp.length === 1;
    let bar;
    if (!has) {
      box = [0, 1, iw, flat ? 5 : 4];
      bar = up || flat ? 7 : 6;
    } else {
      box = [0, 0, iw, flat ? 4 : 3];
      bar = up || flat ? 5 : 4;
    }
    hparts(hp, bar, has ? 1 : 2, vow);
    vparts(vp, has ? 0 : 1, has ? 5 : 9, bar, vow);
  }
  const tail = !has && VV[vi] && (ini === "g" || ini === "k");
  return [group(ini, box[0], box[1], box[2], box[3], tail), vow, has ? group(FIN[fi], fbox[0], fbox[1], fbox[2], fbox[3], false) : []];
}

// Strokes to LEDs: a bitmap bw by bh, and the diagonal steps inside each
// stroke, which the big glyph joins (the legs of ㅅ, ㅈ, ㅊ).
function bitmap(strokes, bw, bh) {
  const bits = new Uint8Array(bw * bh), diag = [];
  for (const st of strokes) {
    let lx = null, ly = null;
    for (let i = 0; i < st.length; i++) {
      const [x0, y0] = st[i], [x1, y1] = st[min(i + 1, st.length - 1)];
      const n = max(abs(x1 - x0), abs(y1 - y0));
      for (let j = 0; j <= n; j++) {
        const x = round(x0 + ((x1 - x0) * j) / (n || 1)), y = round(y0 + ((y1 - y0) * j) / (n || 1));
        if (x === lx && y === ly) continue;
        if (x >= 0 && y >= 0 && x < bw && y < bh) bits[y * bw + x] = 1;
        if (lx !== null && x !== lx && y !== ly) diag.push([lx, ly, x, y]);
        lx = x;
        ly = y;
      }
    }
  }
  return { bits, diag };
}

// ---- Layout.
// The big glyph: the 9 by 11 face drawn 5 LEDs a column and 4 a row, each
// lit LED of the face a round dot joined to its lit neighbours.
const GX = 9.5, GY = 2, SX = 5, SY = 4, GR = 2.0, GH = 46;
// The counters, the reels and the map.
const CY = 49;
const RY = 70, RH = 14, RT = 15, RW = 20, RXS = [1, 22, 43], P = 21;
const MX = 4, MY = 86;

// A row of the 3 by 5 digits, each row a 3-bit number, left bit high.
const DIG = ["75557", "26227", "71747", "71317", "55711", "74717", "74757", "71122", "75757", "75717"].map((s) => [...s].map(Number));

// One reel's tape: each symbol drawn two LEDs a dot, centred in its own
// stretch of P rows.
function tape(symbols) {
  const T = new Float32Array(RW * symbols.length * P);
  symbols.forEach((strokes, k) => {
    if (!strokes) {
      // The empty final: a dotted slot.
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 7; j++) {
          if ((i > 0 && i < 6 && j > 0 && j < 6) || (i + j) % 2) continue;
          for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) T[(k * P + 3 + 2 * j + b) * RW + 3 + 2 * i + a] = 0.55;
        }
      return;
    }
    const { bits } = bitmap(strokes, 9, 11);
    let x0 = 9, x1 = -1, y0 = 11, y1 = -1;
    for (let y = 0; y < 11; y++)
      for (let x = 0; x < 9; x++)
        if (bits[y * 9 + x]) {
          x0 = min(x0, x);
          x1 = max(x1, x);
          y0 = min(y0, y);
          y1 = max(y1, y);
        }
    const ox = (RW >> 1) - (x1 + x0 + 1), oy = k * P + (P >> 1) - (y1 + y0 + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (!bits[y * 9 + x]) continue;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) T[(oy + 2 * y + b) * RW + ox + 2 * x + a] = 1;
      }
  });
  return T;
}

export function setup(params) {
  const S = (params.s = { n: 0, p: 0, acc: 0, k3: -1, shown: -1, mapC: -1, fade: 0, rk: -1 });
  // The set, and for each syllable how many of the 2,350 come at or before it.
  S.ks = new Uint8Array(ALL);
  S.rank = new Uint16Array(ALL);
  let i = 0;
  for (let c = 0; c < KS.length; c++) {
    const v = A64.indexOf(KS[c]);
    for (let b = 0; b < 6 && i < ALL; b++) S.ks[i++] = (v >> b) & 1;
  }
  for (let s = 0, r = 0; s < ALL; s++) S.rank[s] = r += S.ks[s];
  // The three tapes: 19 initials, 21 vowels (as they stand beside or under
  // ㅇ), 28 finals with the empty one first.
  const box = (key) => group(key, key.length > 1 ? 0 : 1, 2, key.length > 1 ? 9 : 7, 7, false);
  S.tapes = [
    tape(INI.map(box)),
    tape(Array.from({ length: 21 }, (_, v) => jamo(11 * 588 + v * 28)[1])),
    tape(FIN.map((f, k) => (k ? box(f) : null))),
  ];
  S.row = new Float32Array(RW);
  S.G = new Float32Array(W * GH);
  S.E = new Float32Array(W * GH);
  S.B = new Float32Array(W * GH);
  S.Hl = new Float32Array(W * GH);
  S.F = new Float32Array(W * H * 3);
}

// The big glyph of syllable s into S.G (coverage) and S.E (its outline).
function bigGlyph(S, s) {
  const { bits, diag } = bitmap(jamo(s).flat(), 9, 11);
  const segs = diag.slice();
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 9; x++) {
      if (!bits[y * 9 + x]) continue;
      segs.push([x, y, x, y]);
      if (x < 8 && bits[y * 9 + x + 1]) segs.push([x, y, x + 1, y]);
      if (y < 10 && bits[(y + 1) * 9 + x]) segs.push([x, y, x, y + 1]);
    }
  const G = S.G;
  G.fill(0);
  for (const [a, b, c, d] of segs) {
    const ax = GX + (a + 0.5) * SX, ay = GY + (b + 0.5) * SY, bx = GX + (c + 0.5) * SX, by = GY + (d + 0.5) * SY;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    for (let y = max(0, floor(min(ay, by) - GR - 1)); y <= min(GH - 1, floor(max(ay, by) + GR + 1)); y++)
      for (let x = max(0, floor(min(ax, bx) - GR - 1)); x <= min(W - 1, floor(max(ax, bx) + GR + 1)); x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        const u = L ? cl((px * dx + py * dy) / L, 0, 1) : 0;
        const ex = px - u * dx, ey = py - u * dy;
        const v = cl(GR + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
        if (v > G[y * W + x]) G[y * W + x] = v;
      }
  }
  // The outline: lit LEDs with an unlit neighbour.
  const E = S.E;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < W; x++) {
      const g = G[y * W + x];
      let lo = 1;
      if (g > 0.3) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) lo = min(lo, x + ox < 0 || x + ox >= W || y + oy < 0 || y + oy >= GH ? 0 : G[(y + oy) * W + x + ox]);
      E[y * W + x] = g > 0.3 && lo < 0.5 ? g : 0;
    }
  // A soft halo round the strokes, for the encoded syllables: a box blur
  // five LEDs wide, across and then down.
  const B = S.B, Hl = S.Hl;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += x + i >= 0 && x + i < W ? G[y * W + x + i] : 0;
      B[y * W + x] = s / 5;
    }
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += y + i >= 0 && y + i < GH ? B[(y + i) * W + x] : 0;
      Hl[y * W + x] = max(0, s / 5 - G[y * W + x]);
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1], 0.2, 3);
  const d = speed - 2;
  S.rate = 6 * exp(1.83 * d + 0.25 * d * d);
  S.skip = cl(k[3], 0, 1);
  // The Initial knob sets the slowest wheel when it is turned; the first
  // frame starts there without spinning.
  const c = round(cl(k[2], 0, 18));
  if (c !== S.k3) {
    const base = floor(S.n / ALL) * ALL;
    let to = base + c * 588;
    if (S.k3 >= 0 && to <= S.n) to += ALL;
    if (S.k3 < 0) S.p = to;
    S.n = to;
    S.acc = 0;
    S.k3 = c;
  }
  // Count: the odometer stays a whole step on each syllable, on a missing
  // one 1 - Skip of a step.
  const stay = (s) => (S.ks[s % ALL] ? 1 : 1 - S.skip);
  S.acc += dt * S.rate;
  for (let i = 0; i < 4000 && S.acc >= stay(S.n); i++) {
    S.acc -= stay(S.n);
    S.n++;
  }
  // The wheels rest on the count and turn to the next syllable in the last
  // 0.08 seconds of the stay (the whole stay when stays are shorter),
  // then a quick spring smooths them, so a jump spins through what lies
  // between.
  const g = S.n % ALL, next = (g + 1) % ALL, cost = stay(g);
  const w = cost > 0 ? min(1, (0.08 * S.rate) / cost) : 1, phi = cost > 0 ? cl(S.acc / cost, 0, 1) : 1;
  const e = cl((phi - 1 + w) / w, 0, 1), turn = w >= 1 ? e : e * e * (3 - 2 * e);
  const spring = 1 - exp(-dt * 30);
  S.p += (S.n + turn - S.p) * spring;
  if (abs(S.n + turn - S.p) < 0.002) S.p = S.n + turn;
  // The glyph and the map read the count.
  if (g !== S.shown) {
    S.shown = g;
    bigGlyph(S, g);
  }
  // A new initial starts a new map; the last one fades out over it.
  const ci = floor(g / 588);
  if (ci !== S.mapC) {
    S.mapOld = S.mapC;
    S.oldAt = S.mapC === (ci + 18) % 19 ? 587 : S.at;
    S.mapC = ci;
    S.fade = S.mapOld < 0 ? 0 : 1;
  }
  S.at = g % 588;
  // The count of the 2,350 turns with the wheels when the next syllable is
  // one of them, and starts again after 힣.
  const rk = S.rank[g] + (S.ks[next] ? turn : 0);
  S.rk = rk < S.rk - 50 || S.rk < 0 ? rk : S.rk + (rk - S.rk) * spring;
  if (abs(rk - S.rk) < 0.002) S.rk = rk;
  S.fade = max(0, S.fade - dt / 0.6);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.shown < 0) return;
  const F = S.F;
  F.fill(0);
  const hue = 0.1 + S.hue;
  const lit = hsv(hue, 0.85, 255), miss = hsv(hue + 0.6, 0.6, 255), pale = hsv(hue + 0.02, 0.3, 255);
  const add = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    F[o] += c[0] * a;
    F[o + 1] += c[1] * a;
    F[o + 2] += c[2] * a;
  };
  const g = S.shown, inSet = S.ks[g] === 1;

  // The big glyph: solid when encoded, a hollow outline when not.
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < W; x++) {
      if (inSet) {
        const v = S.G[y * W + x] + 0.3 * S.Hl[y * W + x];
        if (v > 0) add(x, y, lit, v);
      } else {
        const v = S.E[y * W + x];
        if (v > 0) add(x, y, miss, 0.75 * v);
      }
    }

  // The counters, rolling like the reels: the syllable's place among all
  // 11,172, and among the 2,350. A digit turns while every digit to its
  // right turns from 9 to 0.
  const roll = (val, digits, x0, c, a) => {
    const fl = floor(val), fr = val - fl;
    for (let d = 0, m = 1; d < digits; d++, m *= 10) {
      const base = floor(fl / m) % 10, sh = round((fl % m === m - 1 ? fr : 0) * 7), x = x0 + (digits - 1 - d) * 4;
      for (const [dig, oy] of [[base, -sh], [(base + 1) % 10, 7 - sh]])
        for (let r = 0; r < 5; r++) {
          if (r + oy < 0 || r + oy > 4) continue;
          for (let b = 0; b < 3; b++) if (DIG[dig][r] & (4 >> b)) add(x + b, CY + r + oy, c, a);
        }
    }
  };
  roll(min(ALL, (S.p % ALL) + 1), 5, 1, pale, 0.8);
  roll(S.rk, 4, 48, inSet ? lit : miss, inSet ? 1 : 0.5);

  // The reels: each a wheel of radius RT seen through a window 2 RH tall,
  // its symbols squeezed and dimmed towards the window's edges.
  const p = S.p, fr = p - floor(p), q = floor(p);
  const pos = [
    (floor(q / 588) % 19) + (q % 588 === 587 ? fr : 0),
    (floor(q / 28) % 21) + (q % 28 === 27 ? fr : 0),
    (q % 28) + fr,
  ];
  const len = [19, 21, 28];
  for (let r = 0; r < 3; r++) {
    const T = S.tapes[r], span = len[r] * P, uc = pos[r] * P + (P >> 1);
    for (let y = RY - RH; y < RY + RH; y++) {
      let shade = 0;
      const row = S.row.fill(0);
      for (let s = 0; s < 4; s++) {
        const dy = y + (s + 0.5) / 4 - RY, th = asin(cl(dy / RT, -1, 1));
        let u = floor(uc + RT * th) % span;
        if (u < 0) u += span;
        const w = cos(th);
        shade += w / 4;
        for (let x = 0; x < RW; x++) row[x] += (T[u * RW + x] * w) / 4;
      }
      for (let x = 0; x < RW; x++) {
        add(RXS[r] + x, y, pale, 0.11 * shade + 0.89 * row[x]);
      }
    }
  }

  // The map: the current initial's 21 vowels down and 28 finals across.
  // Ahead of the odometer the encoded cells wait faintly; behind it they
  // burn, fresh ones brighter for a moment.
  const ci = S.mapC, at = g % 588;
  const cell = (x, y, c, a) => {
    add(x, y, c, a);
    add(x + 1, y, c, a);
    add(x, y + 1, c, a * 0.45);
    add(x + 1, y + 1, c, a * 0.45);
  };
  for (let v = 0; v < 21; v++)
    for (let f = 0; f < 28; f++) {
      const k = v * 28 + f, x = MX + 2 * f, y = MY + 2 * v, on = S.ks[ci * 588 + k];
      let c, a;
      if (k === at) (c = [255, 255, 255]), (a = 1);
      else if (k > at) (c = pale), (a = on ? 0.24 : 0.06);
      else {
        const age = (at - k) / S.rate, glow = exp(-age / 0.7);
        c = on ? lit : miss;
        a = on ? 0.75 + 0.25 * glow : 0.2 + 0.3 * glow;
      }
      if (S.fade > 0 && k <= S.oldAt) {
        const o = S.ks[S.mapOld * 588 + k];
        cell(x, y, o ? lit : miss, (o ? 0.9 : 0.2) * S.fade * S.fade);
      }
      cell(x, y, c, a);
    }
  // The current vowel row, marked at both sides.
  for (const x of [1, 2, 61, 62]) add(x, MY + 2 * floor(at / 28), pale, 0.7);

  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(min(255, F[o])), round(min(255, F[o + 1])), round(min(255, F[o + 2])));
}
