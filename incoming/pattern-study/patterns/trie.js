// ===== Patternflow pattern =====
// Title:   Trie
// Family:  type
// Idea:    A prefix tree of 32 common English words grows down the whole tall panel, one 3 by 5 capital to a node and a gold underline where a word ends, and a typist types the words in turn, lighting the path of the letters typed from the root, letting the completions still possible glow below the cursor while the rest of the tree dims, and deleting back only as far as the next word branches off, while two numbers at the top compare the letters the words would need on their own with the nodes the tree needs for all of them.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: trie, retrieval tree (René de la Briandais, 1959; named by Edward Fredkin, 1960); tidy tree drawing by contour packing in the manner of Edward Reingold and John Tilford (1981); the 3 by 5 capitals of Saccades (pattern round 106), copied from scytale.js; pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Words=-8..12, Reach=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the four families of first letters are blue for B, violet for C, magenta for S and red for T, the end marks are pale gold and the letter just typed flashes white. The wheel skips the oranges and yellows, which go brown when dim.
// Knob 2: Speed. How fast the typist goes. At 2 the first letter is typed at 0.45 s and each next one 0.27 s later, a finished word is held 0.75 s, a letter is deleted every 0.09 s on the way back to where the next word branches off, and back at the root the typist waits 0.6 s with the whole tree glowing. 0.2 is ten times slower and 3 is half as fast again. The tree draws itself in over the first second whatever the speed.
// Knob 3: Words. How many of the 32 words are in the tree, from 12 to 32, caught on whole numbers, and it opens at 20. A word adds only the nodes its prefixes do not already have: 12 words need 39 nodes, 20 need 48 and 32 need 66, against 64, 104 and 176 letters, the two numbers at the top. The nodes slide aside to make room, and the widest level goes from 7 nodes to 11.
// Knob 4: Reach. How far below the typed letters the glow of the completions reaches, caught on whole numbers: 0 the whole subtree, 1 three levels, 2 two levels, 3 only the letters that can come next. It opens at 0, where typing the first letter of a word narrows the glow from the whole tree to that letter's side of it.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals 3 wide and 5 tall from saccades.js by way of scytale.js, and the ten digits from kasiski-examination.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// The 32 words, in the order the Words knob lets them in and the typist types
// them. A word often follows one it shares a prefix with (STAR, START) and
// often one it shares nothing with. Every level of the tree holds at most 11
// nodes and the whole tree is 59 LEDs across. B, C, S and T are the four
// families of first letters.
const WORDS = (
  "CAT STAR START TRAIN TRAINING CAREFULLY STONE STORM BAT BATH TREE STARLIGHT " +
  "CARD TRAVEL CAR CARE TRAVELER STORMY CART STORY " +
  "CAREFUL TRAINS CAN STARTED STONES TREES COLOR BATHE STARTING BATHES TRAINED TRAVELS"
).split(" ");
const NW_MIN = 12, NW_MAX = 32, NW_OPEN = 20;
const SEP = 4; // LEDs between the centres of two neighbours on a level
const PITCH = 11, ROW0 = 11; // a level's letters start at row 11 * level
const FAMILY = { B: 0, C: 1, S: 2, T: 3 };

// The whole trie of the 32 words: a node for every prefix. `first` is the
// position in the list of the first word that goes through the node, so the
// tree of the first n words is the nodes with first < n; `endAt` is the
// position of the word that ends there.
const NODES = [{ pre: "", depth: 0, par: -1, kids: [], first: -1, endAt: 1e9, fam: 0 }];
const PATH = [];
{
  const byPre = new Map([["", 0]]);
  WORDS.forEach((w, wi) => {
    const path = [0];
    for (let i = 1; i <= w.length; i++) {
      const pre = w.slice(0, i);
      let k = byPre.get(pre);
      if (k === undefined) {
        k = NODES.length;
        byPre.set(pre, k);
        NODES.push({ pre, depth: i, par: path[i - 1], kids: [], first: wi, endAt: 1e9, fam: FAMILY[w[0]] });
        NODES[path[i - 1]].kids.push(k);
      }
      path.push(k);
    }
    NODES[path[w.length]].endAt = min(NODES[path[w.length]].endAt, wi);
    PATH.push(path);
  });
  for (const nd of NODES) nd.kids.sort((a, b) => (NODES[a].pre < NODES[b].pre ? -1 : 1));
}
const NN = NODES.length;

// The layout of the tree of the first n words, one x in whole LEDs for every
// node in it. Children go in alphabetical order. Each next child is pushed
// right until it clears what stands to its left on every level the two have
// in common (the contour), and a parent stands over the middle of its first
// and last child. It reads the tree and nothing else, so the order the words
// were listed in does not matter.
function layout(n, X) {
  const lc = [], rc = [], off = [];
  for (let k = NN - 1; k >= 0; k--) {
    if (k && NODES[k].first >= n) continue;
    const kids = NODES[k].kids.filter((c) => NODES[c].first < n);
    if (!kids.length) {
      lc[k] = [0];
      rc[k] = [0];
      continue;
    }
    const offs = [0], aL = lc[kids[0]].slice(), aR = rc[kids[0]].slice();
    for (let j = 1; j < kids.length; j++) {
      const L = lc[kids[j]], R = rc[kids[j]];
      let need = -1e9;
      for (let l = 0; l < min(aR.length, L.length); l++) need = max(need, aR[l] + SEP - L[l]);
      offs.push(need);
      for (let l = 0; l < R.length; l++) {
        if (l < aR.length) aR[l] = R[l] + need;
        else {
          aR.push(R[l] + need);
          aL.push(L[l] + need);
        }
      }
    }
    const mid = floor((offs[0] + offs[offs.length - 1]) / 2);
    lc[k] = [0, ...aL.map((v) => v - mid)];
    rc[k] = [0, ...aR.map((v) => v - mid)];
    kids.forEach((c, j) => (off[c] = offs[j] - mid));
  }
  X[0] = 0;
  let lo = 0, hi = 0;
  for (let k = 1; k < NN; k++) {
    if (NODES[k].first >= n) continue;
    X[k] = X[NODES[k].par] + off[k];
    lo = min(lo, X[k]);
    hi = max(hi, X[k]);
  }
  const sh = 32 - floor((lo + hi) / 2);
  for (let k = 0; k < NN; k++) if (!k || NODES[k].first < n) X[k] += sh;
}

const T_FIRST = 0.45, T_KEY = 0.27, T_HOLD = 0.75, T_BACK = 0.09, T_GAP = 0.6;
const REACH = [99, 3, 2, 1];

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, n: 0, reach: 0, real: 0, t: 0,
    X: new Float32Array(NN), cur: new Float32Array(NN), app: new Float32Array(NN), lum: new Float32Array(NN), hit: new Float32Array(NN),
    order: [], wpos: 0, cw: 0, np: 0, m: 0, mode: 0, due: T_FIRST, tgt: 0, doneAt: -9, keyAt: -9,
    buf: new Float32Array(W * H * 3), letters: 0, nodes: 0,
  });
  setWords(S, NW_OPEN);
}

function setWords(S, n) {
  const had = S.n > 0;
  S.n = n;
  S.X.fill(0);
  layout(n, S.X);
  if (!had) S.cur.set(S.X);
  S.order = [];
  for (let i = 0; i < n; i++) S.order.push(i);
  S.letters = 0;
  for (let i = 0; i < n; i++) S.letters += WORDS[i].length;
  S.nodes = 0;
  for (let k = 1; k < NN; k++) if (NODES[k].first < n) S.nodes++;
  if (!had) {
    S.cw = S.order[0];
    return;
  }
  const at = S.order.indexOf(S.cw);
  if (at >= 0) S.wpos = at;
  else {
    // The word on the screen is gone: delete it and start from the top of the order.
    S.wpos = S.order.length - 1;
    S.np = 0;
    S.tgt = 0;
    S.mode = S.m > 0 ? 2 : 1;
    S.due = S.t + T_BACK;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const n = cl(NW_OPEN + round(cl(k[2], -8, 12)), NW_MIN, NW_MAX);
  S.reach = REACH[cl(round(k[3]), 0, 3)];
  S.real += d;
  const c = d * (S.speed / 2);
  S.t += c;
  if (n !== S.n) setWords(S, n);
  typist(S);
  // Every node eases toward where the layout puts it, toward its light for
  // the cursor, and in or out of the tree.
  const pth = PATH[S.cw], cur = pth[S.m], cd = NODES[cur].depth;
  const onPath = (kk) => NODES[kk].depth <= S.m && pth[NODES[kk].depth] === kk;
  for (let kk = 0; kk < NN; kk++) {
    const nd = NODES[kk], inTree = !kk || nd.first < S.n;
    const grown = S.real > 0.07 * nd.depth + 0.05;
    S.app[kk] += ((inTree && grown ? 1 : 0) - S.app[kk]) * (1 - exp(-d * 7));
    if (!inTree) continue;
    S.cur[kk] += (S.X[kk] - S.cur[kk]) * (1 - exp(-d * 9));
    let tgt = 0;
    if (onPath(kk)) tgt = 1;
    else if (nd.depth > cd && nd.depth - cd <= S.reach) {
      let a = kk;
      while (NODES[a].depth > cd) a = NODES[a].par;
      if (a === cur) tgt = 0.88 - 0.03 * (nd.depth - cd);
    }
    S.lum[kk] += (tgt - S.lum[kk]) * (1 - exp(-d * (tgt > S.lum[kk] ? 16 : 6)));
    S.hit[kk] = max(0, S.hit[kk] - d * 3);
  }
}

// The typist: type to the end of the word, hold, then delete back to the
// longest prefix the next word shares and type from there.
function typist(S) {
  for (let g = 0; g < 40 && S.t >= S.due; g++) {
    const w = WORDS[S.cw];
    if (S.mode === 0) {
      if (S.m < w.length) {
        S.m++;
        S.keyAt = S.due;
        S.hit[PATH[S.cw][S.m]] = 1;
      }
      if (S.m >= w.length) {
        S.mode = 1;
        S.doneAt = S.due;
        S.due += T_HOLD;
      } else S.due += T_KEY;
    } else if (S.mode === 1) {
      const np = (S.wpos + 1) % S.order.length, nx = WORDS[S.order[np]];
      let l = 0;
      while (l < w.length && l < nx.length && w[l] === nx[l]) l++;
      S.tgt = l;
      S.np = np;
      if (S.m > l) {
        S.mode = 2;
        S.due += T_BACK;
      } else {
        S.wpos = np;
        S.cw = S.order[np];
        S.mode = 0;
        S.due += T_KEY;
      }
    } else {
      S.m--;
      if (S.m <= S.tgt) {
        S.wpos = S.np;
        S.cw = S.order[S.np];
        S.mode = 0;
        S.due += S.tgt === 0 ? T_GAP : T_KEY;
      } else S.due += T_BACK;
    }
  }
}

const COL = [0, 0, 0];
// A colour from a position on the wheel, with the wheel squeezed so it skips
// the oranges and yellows, which go brown when dim: 0 is yellow-green, 0.5 is
// blue, 0.8 is magenta and 1 is a red a shade toward orange.
function tone(h, s, v) {
  h -= floor(h);
  hsv(0.19 + h * 0.84, s, v, COL);
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  if (r > buf[o]) buf[o] = r;
  if (g > buf[o + 1]) buf[o + 1] = g;
  if (b > buf[o + 2]) buf[o + 2] = b;
}

function glyph(buf, ch, x0, y0, sc, r, g, b) {
  const gl = GLYPH[ch];
  if (!gl) return;
  for (let i = 0; i < 15; i++)
    if (gl[i]) for (let a = 0; a < sc; a++) for (let c = 0; c < sc; c++) put(buf, x0 + (i % 3) * sc + c, y0 + floor(i / 3) * sc + a, r, g, b);
}

function famHue(S, f) {
  return S.hue + 0.5 + 0.14 * f;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, t = S.t;
  buf.fill(0);
  const path = PATH[S.cw], word = WORDS[S.cw];
  const cx = (k) => round(S.cur[k]);
  const Y = (depth) => ROW0 * depth;

  // The edges, each one drawn as an elbow from its parent: a drop, a run
  // along the bus row and a stem into the child.
  for (let k = 1; k < NN; k++) {
    const nd = NODES[k], a = S.app[k];
    if (a < 0.02) continue;
    const e = (0.32 + 0.68 * S.lum[k]) * a;
    tone(famHue(S, nd.fam), 0.8, 0.9);
    const r = COL[0] * 255 * e, g = COL[1] * 255 * e, b = COL[2] * 255 * e;
    const px = cx(nd.par), pcx = cx(k), top = nd.par ? Y(NODES[nd.par].depth) + 5 : 4, bus = nd.par ? Y(NODES[nd.par].depth) + 8 : 8, ch = Y(nd.depth);
    for (let y = top; y <= bus; y++) put(buf, px, y, r, g, b);
    for (let x = min(px, pcx); x <= max(px, pcx); x++) put(buf, x, bus, r, g, b);
    for (let y = bus; y < ch; y++) put(buf, pcx, y, r, g, b);
  }

  // The root and the nodes.
  const wr = 0.55 * S.app[0] * (0.4 + 0.6 * S.lum[0]);
  for (let i = 0; i < 9; i++) if (i !== 4) put(buf, 31 + (i % 3), 1 + floor(i / 3), 255 * wr, 255 * wr, 255 * wr);
  const pulse = S.doneAt > -9 ? exp(-(t - S.doneAt) * 4) : 0;
  for (let k = 1; k < NN; k++) {
    const nd = NODES[k], a = S.app[k];
    if (a < 0.02) continue;
    const e = S.lum[k] * a, x = cx(k) - 1, y = Y(nd.depth);
    // A soft card behind the letters that are lit.
    tone(famHue(S, nd.fam), 0.85, 0.9);
    const cardv = 0.45 * S.lum[k] * a * 255;
    for (let yy = y - 1; yy <= y + 6; yy++) for (let xx = x - 1; xx <= x + 3; xx++) put(buf, xx, yy, COL[0] * cardv, COL[1] * cardv, COL[2] * cardv);
    const flash = S.hit[k], white = max(flash, S.mode === 1 && path[nd.depth] === k && nd.depth <= word.length ? pulse * 0.6 : 0);
    tone(famHue(S, nd.fam), 0.78 - 0.5 * white, 0.9);
    const f = (0.3 + 0.7 * e) * 255 * a;
    const lr = COL[0] * f + white * 200 * a, lg = COL[1] * f + white * 200 * a, lb = COL[2] * f + white * 200 * a;
    glyph(buf, nd.pre[nd.depth - 1], x, y, 1, min(255, lr), min(255, lg), min(255, lb));
    if (nd.endAt < S.n) {
      // The end of a word: a pale gold underline, white on the word being typed.
      const mine = S.mode === 1 && path[nd.depth] === k && nd.depth === word.length;
      const u = mine ? 1 : 0.62 + 0.38 * e;
      hsv(0.13, mine ? 0.12 : 0.42, 1, COL);
      for (let c = 0; c < 3; c++) put(buf, x + c, y + 6, COL[0] * 255 * u * a, COL[1] * 255 * u * a, COL[2] * 255 * u * a);
    }
  }

  // The counts at the top: the letters the words would need on their own and
  // the nodes the tree needs for all of them.
  const num = (v, x0, hh, ss) => {
    const s = String(v);
    hsv(hh, ss, 0.7, COL);
    for (let i = 0; i < s.length; i++) glyph(buf, s[i], x0 + i * 4, 1, 1, COL[0] * 255 * S.app[0], COL[1] * 255 * S.app[0], COL[2] * 255 * S.app[0]);
  };
  num(S.letters, 2, 0.13, 0.35);
  num(S.nodes, 62 - String(S.nodes).length * 4, 0.19 + (famHue(S, 1) - floor(famHue(S, 1))) * 0.84, 0.7);

  // The foot: what the typist has typed, twice as large, with a caret.
  const fa = S.app[0], typed = word.slice(0, S.m), fw = word.length * 7 - 1, fx = floor((W - fw) / 2), fy = 114;
  for (let x = 1; x < 63; x++) put(buf, x, 109, 40 * fa, 40 * fa, 52 * fa);
  const fam = NODES[path[max(1, S.m)]].fam;
  for (let i = 0; i < typed.length; i++) {
    const fresh = i === typed.length - 1 && S.mode === 0 ? exp(-(t - S.keyAt) * 6) : 0;
    const wh = S.mode === 1 ? pulse : fresh;
    tone(famHue(S, fam), 0.7 - 0.6 * wh, 1);
    glyph(buf, typed[i], fx + i * 7, fy, 2, min(255, COL[0] * 255 + wh * 120), min(255, COL[1] * 255 + wh * 120), min(255, COL[2] * 255 + wh * 120));
  }
  if (S.mode !== 1) {
    const on = sin(t * 11) > -0.35 || S.mode === 2 ? 1 : 0;
    if (on) for (let c = 0; c < 6; c++) for (let a = 0; a < 2; a++) put(buf, fx + typed.length * 7 + c, fy + 11 + a, 200 * fa, 200 * fa, 220 * fa);
  } else {
    hsv(0.13, 0.15, 1, COL);
    for (let x = fx; x < fx + fw; x++) for (let a = 0; a < 2; a++) put(buf, x, fy + 11 + a, COL[0] * 255, COL[1] * 255, COL[2] * 255);
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3]), min(255, buf[p * 3 + 1]), min(255, buf[p * 3 + 2]));
}
