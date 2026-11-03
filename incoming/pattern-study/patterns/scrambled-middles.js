// ===== Patternflow pattern =====
// Title:   Scrambled Middles
// Family:  type
// Idea:    A page of a well-known old text fills the tall panel in a small lowercase pixel face, and every few seconds the letters inside each word glide to new places while the first and last letter of the word hold still, each moved letter tinted by how far it now sits from home, so the Scramble knob takes the page from plain text through swaps of neighbouring letters and a full shuffle of every word's middle, which most readers still read, to its far end where the first and last letters go too and the page stops being English.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: words with their inner letters jumbled and the outer ones kept, after the 2003 email that credited the effect to a researcher at Cambridge; letter position in word recognition (Graham Rawlinson, PhD thesis, University of Nottingham, 1976); Keith Rayner, Sarah J. White, Rebecca L. Johnson and Simon P. Liversedge, Raeding wrods with jubmled lettres: there is a cost (Psychological Science, 2006); texts from Herman Melville, Moby-Dick (1851), William Shakespeare, Hamlet (about 1600) and the Declaration of Independence (1776); a lowercase pixel face 3 LEDs wide and 8 tall drawn for this pattern; pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..2, Scramble=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the letters at home are a cool white and the first and last letter of every word a pale gold; a moved letter is tinted by how far it stands from its place in the plain word, azure at 4 LEDs (about one letter), blue at 8, violet at 12 and magenta from 16. At 0.5 the ends are pale blue and the moved letters run from orange to green.
// Knob 2: Speed. At 2 the letters glide for 0.6 s and the page then holds 2.4 s before the next shuffle, 3 s a shuffle; 30 s at 0.2, where a glide takes 6 s, and 2 s at 3.
// Knob 3: Text. 0 the opening of Moby-Dick to "the watery part of the world" in 14 lines, 1 the first five lines of Hamlet's "To be, or not to be" in 13, 2 the Declaration of Independence from "We hold these truths" to "the pursuit of Happiness" in 13, where unalienable has nine inner letters to shuffle.
// Knob 4: Scramble. 0 is the plain page and nothing moves. Above 0 pairs of neighbouring inner letters swap, no letter in two pairs, each pair with a chance from 0.4 up to 1 at 0.35; at the opening 0.06 the chance is 0.5 and about three in four words of four letters or more come out changed. From 0.35 to 0.75 more and more inner letters are shuffled freely among themselves, every word's whole middle at 0.75, the jumble of the 2003 email; from 0.8 the first and last letters join in, and at 1 every letter of every word is shuffled.

// The face sits on an 8-row body: ascenders in rows 0-1, the x-height in
// rows 2-5, descenders in rows 6-7. Lines are 9 rows apart, 13 or 14 to a
// text, and the block is centred on the panel's height. A word keeps its own width whatever order its letters are in, so
// a shuffle never moves the words around it; each letter's place is the sum
// of the widths of the letters before it in the new order.
//
// A shuffle is drawn fresh at every beat from the plain word, so the letters
// glide from where they were to where the new draw puts them: those moving
// right arc up and those moving left arc down, and two neighbours swapping
// pass round each other. The tint is the distance from home as the letter
// stands, so it changes along the glide.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// Lowercase, the capitals the texts need and the marks, row 0 at the top.
const FACE = {
  a: "../../##./.##/#.#/.##", b: "#../#../##./#.#/#.#/##.", c: "../../.##/#../#../.##",
  d: "..#/..#/.##/#.#/#.#/.##", e: "../../.#./###/#../.##", f: ".##/.#./###/.#./.#./.#.",
  g: "../../.##/#.#/#.#/.##/..#/##.", h: "#../#../##./#.#/#.#/#.#", i: "#/./#/#/#/#",
  j: ".#/../.#/.#/.#/.#/.#/#.", k: "#../#../#.#/##./#.#/#.#", l: "#/#/#/#/#/#",
  m: "../../####./#.#.#/#.#.#/#.#.#", n: "../../##./#.#/#.#/#.#", o: "../../.#./#.#/#.#/.#.",
  p: "../../##./#.#/#.#/##./#../#..", q: "../../.##/#.#/#.#/.##/..#/..#", r: "../../#.#/##./#../#..",
  s: "../../.##/#../..#/##.", t: ".../.#./###/.#./.#./.##", u: "../../#.#/#.#/#.#/.##",
  v: "../../#.#/#.#/#.#/.#.", w: "../../#...#/#...#/#.#.#/.#.#.", x: "../../#.#/.#./.#./#.#",
  y: "../../#.#/#.#/#.#/.##/..#/##.", z: "../../###/..#/.#./###",
  A: ".#./#.#/#.#/###/#.#/#.#", C: ".##/#../#../#../#../.##", I: "###/.#./.#./.#./.#./###",
  O: ".#./#.#/#.#/#.#/#.#/.#.", S: ".##/#../.#./..#/..#/##.", T: "###/.#./.#./.#./.#./.#.",
  W: "#...#/#...#/#...#/#.#.#/#.#.#/.#.#.", R: "##./#.#/#.#/##./#.#/#.#", L: "#../#../#../#../#../###",
  H: "#.#/#.#/#.#/###/#.#/#.#",
  ",": "./././././#/#", ".": "./././././#", ":": "./././#/./#", ";": "./././#/./#/#",
  "-": "../../../##", "'": "#/#",
};
const GLYPH = {}, GW = {};
for (const ch in FACE) {
  const rows = FACE[ch].split("/"), px = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => c === "#" && px.push(x, y)));
  GLYPH[ch] = px;
  GW[ch] = max(...rows.map((r) => r.length));
}

const TEXTS = [
  // Herman Melville, Moby-Dick (1851), the opening sentences.
  "Call me Ishmael. Some years ago - never mind how long precisely - having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.",
  // William Shakespeare, Hamlet, Act 3 Scene 1, the first five lines.
  "To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer The slings and arrows of outrageous fortune, Or to take arms against a sea of troubles, And by opposing end them.",
  // The Declaration of Independence (1776), the second sentence's opening.
  "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.",
];

// Left margin, line pitch and word space.
const X0 = 1, LP = 9, SP = 2;
// Story seconds at Speed 1: the glide, and the beat from one shuffle to the next.
const GLIDE = 1.2, BEAT = 6;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const width = (s) => [...s].reduce((a, c) => a + (GW[c] || 3) + 1, 0) - 1;
const isLetter = (c) => /[A-Za-z]/.test(c);

// The words of a text, each split into the marks before it, the run of
// letters and the marks after (a hyphen inside, as in self-evident, splits it).
function words(text) {
  const out = [];
  for (const tok of text.split(" ")) {
    for (const part of tok.split(/(?<=-)(?=[a-z])/)) {
      let a = 0, b = part.length;
      while (a < b && !isLetter(part[a])) a++;
      while (b > a && !isLetter(part[b - 1])) b--;
      out.push({ pre: part.slice(0, a), core: part.slice(a, b), post: part.slice(b), join: part !== tok && part.endsWith("-") });
    }
  }
  return out;
}

// Lay the words out line by line, ragged right; the block is centred on
// the panel's height.
function page(ws) {
  const items = [];
  let x = X0, line = 0;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i], full = width(w.pre + w.core + w.post);
    if (x > X0 && x + full > W) {
      x = X0;
      line++;
    }
    const letters = [...w.core].map((ch, k) => ({ ch, home: k, x: 0, from: 0, to: 0 }));
    const it = { line, x, pre: w.pre, post: w.post, letters, perm: letters.map((_, k) => k), preW: w.pre ? width(w.pre) + 1 : 0 };
    place(it);
    for (const l of it.letters) l.from = l.to;
    items.push(it);
    x += full + (w.join ? 1 : SP + 1);
  }
  return { items, top: round((H - (line + 1) * LP + 1) / 2) };
}

// Where each letter of a word goes under its current order.
function place(it) {
  let x = it.preW;
  for (const k of it.perm) {
    const l = it.letters[k];
    l.to = x;
    x += (GW[l.ch] || 3) + 1;
  }
  it.postX = x;
}

// A random order for one word at the knob's level.
function shuffle(it, lv) {
  const n = it.letters.length, perm = it.letters.map((_, k) => k);
  if (lv > 0 && n >= 4) {
    // Neighbour swaps among the inner letters.
    const q = 0.4 + 0.6 * cl(lv / 0.35, 0, 1);
    for (let i = 1; i + 1 < n - 1; i++)
      if (Math.random() < q) {
        [perm[i], perm[i + 1]] = [perm[i + 1], perm[i]];
        i++;
      }
  }
  // Free letters: inner ones from 0.35, the ends from 0.8; they trade places
  // among themselves.
  const fi = cl((lv - 0.35) / 0.4, 0, 1), fe = cl((lv - 0.8) / 0.2, 0, 1);
  const free = [];
  for (let i = 0; i < n; i++) {
    const end = i === 0 || i === n - 1;
    if (Math.random() < (end ? fe : fi)) free.push(i);
  }
  if (free.length > 1) {
    const vals = free.map((i) => perm[i]);
    for (let tries = 0; tries < 4; tries++) {
      for (let i = vals.length - 1; i > 0; i--) {
        const j = floor(Math.random() * (i + 1));
        [vals[i], vals[j]] = [vals[j], vals[i]];
      }
      // Keep a draw that leaves some free letter away from home.
      if (vals.some((v, k) => v !== free[k])) break;
    }
    free.forEach((i, k) => (perm[i] = vals[k]));
  }
  it.perm = perm;
}

function beat(S) {
  const lv = S.level;
  for (const it of S.cur.items) {
    for (const l of it.letters) l.from = l.x;
    shuffle(it, lv);
    place(it);
  }
  S.bt = 0;
}

function load(S) {
  S.cur = page(S.words);
  for (const it of S.cur.items) for (const l of it.letters) l.x = l.to;
}

export function setup(params) {
  params.s = { text: -1, words: [], cur: null, bt: 0, level: 0.06, hue: 0, buf: new Float32Array(W * H * 3), c: new Float32Array(3), e: new Float32Array(3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.level = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const text = round(cl(k[2] || 0, 0, 2));
  const step = d * speed;
  if (text !== S.text) {
    S.text = text;
    S.words = words(TEXTS[text]);
    load(S);
    // The page opens already shuffled, its first glide under way.
    beat(S);
    S.bt = GLIDE * 0.25;
  }
  S.bt += step;
  // Glide every letter toward its place.
  const u = ease(cl(S.bt / GLIDE, 0, 1));
  for (const it of S.cur.items) for (const l of it.letters) l.x = l.from + (l.to - l.from) * u;
  if (S.bt >= BEAT) beat(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  const buf = S.buf, c = S.c, e = S.e;
  buf.fill(0);
  const plot = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] += r;
    buf[o + 1] += g;
    buf[o + 2] += b;
  };
  const glyph = (ch, x, y, r, g, b) => {
    const px = GLYPH[ch];
    if (!px) return;
    const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    for (let p = 0; p < px.length; p += 2) {
      const gx = ix + px[p], gy = iy + px[p + 1];
      plot(gx, gy, r * w00, g * w00, b * w00);
      if (w10 > 0.01) plot(gx + 1, gy, r * w10, g * w10, b * w10);
      if (w01 > 0.01) plot(gx, gy + 1, r * w01, g * w01, b * w01);
      if (w11 > 0.01) plot(gx + 1, gy + 1, r * w11, g * w11, b * w11);
    }
  };
  // Home white and the gold of the ends.
  const home = [0, 0, 0], ends = [0, 0, 0];
  hsv(S.hue + 0.58, 0.1, 0.86, home);
  hsv(S.hue + 0.13, 0.55, 1, ends);
  const u = cl(S.bt / GLIDE, 0, 1), arc = sin(PI * u);
  const drawPage = (pg) => {
    for (const it of pg.items) {
      const al = 1, by = pg.top + it.line * LP, n = it.letters.length;
      let mx = it.x;
      for (const ch of it.pre) {
        glyph(ch, mx, by, home[0] * 200 * al, home[1] * 200 * al, home[2] * 200 * al);
        mx += (GW[ch] || 3) + 1;
      }
      // Each letter's home is its place in the plain word.
      let hx = it.preW;
      for (const l of it.letters) {
        const dx = l.to - l.from, d = abs(l.x - hx) / 4;
        const isEnd = l.home === 0 || l.home === n - 1;
        const base = isEnd ? ends : home;
        const y = by - (dx > 0 ? 1 : -1) * arc * min(2.5, 0.6 + abs(dx) * 0.25) * (abs(dx) > 0.1 ? 1 : 0);
        if (d < 0.05) {
          c[0] = base[0];
          c[1] = base[1];
          c[2] = base[2];
        } else {
          hsv(S.hue + 0.48 + 0.09 * min(d, 4.2), 0.85, 1, e);
          const m = min(1, d / 0.8);
          c[0] = base[0] + (e[0] - base[0]) * m;
          c[1] = base[1] + (e[1] - base[1]) * m;
          c[2] = base[2] + (e[2] - base[2]) * m;
        }
        const v = 235 * al;
        glyph(l.ch, it.x + l.x, y, c[0] * v, c[1] * v, c[2] * v);
        hx += (GW[l.ch] || 3) + 1;
      }
      mx = it.x + it.postX;
      for (const ch of it.post) {
        glyph(ch, mx, by, home[0] * 200 * al, home[1] * 200 * al, home[2] * 200 * al);
        mx += (GW[ch] || 3) + 1;
      }
    }
  };
  drawPage(S.cur);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, round(buf[o])), min(255, round(buf[o + 1])), min(255, round(buf[o + 2])));
    }
}
