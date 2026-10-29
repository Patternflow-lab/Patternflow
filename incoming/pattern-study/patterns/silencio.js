// ===== Patternflow pattern =====
// Title:   Silencio
// Family:  type
// Idea:    Eugen Gomringer's constellation of fourteen words round one empty place is set on the panel, the Latin words turned a quarter like book spines and the Hangul ones upright, and the empty place drifts from slot to slot, the word it enters trailing off letter by letter while the word it leaves is spoken back in from its first letter, as a slow reading light passes along every line and goes dark over the gap.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: silencio (Eugen Gomringer, 1953), the best-known constellation of concrete poetry, with schweigen and silence, its German and English versions; the Latin letters and the Hangul 침묵 and 고요 drawn for this pattern, pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..4, Hush=0..1
//
// Knob 1: Hue. Turns the words round the wheel from a pale azure at 0; the words nearest the silence lean a little towards violet.
// Knob 2: Speed. How fast the reading light runs and the silence moves: at 2 the light takes a second over each word and pauses 0.6 between words, and the silence moves on every 3.6 seconds (5.4 when it is home); at 0.2 all of it ten times slower. The glow behind the light dies in 1.1 seconds at any speed, so a fast reading leaves whole words lit.
// Knob 3: Word. 0 silencio, 1 schweigen, 2 silence, 3 침묵, 4 고요. The Latin words stand turned in five columns of three, the Hangul in Gomringer's own three columns of five; a new word empties the field and speaks back in.
// Knob 4: Hush. Up to 0.1 one place is silent, as in the poem. Above that the silence spreads from it to its neighbours, trailing their words off, until at 1 nine of the fifteen places are silent and only the outer words still speak.
// Buttons: any button moves the silence on at once.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Latin. A lowercase face 9 rows tall: rows 0 and 1 hold ascenders,
// 2 to 6 the x-height, 7 and 8 the one descender (g). Only the ten letters
// the three words use. Most are 3 wide; i is 1, l 2, w 5.
const LATIN = {
  s: ["...", "...", ".##", "#..", ".#.", "..#", "##.", "...", "..."],
  i: ["#", ".", "#", "#", "#", "#", "#", ".", "."],
  l: ["#.", "#.", "#.", "#.", "#.", "#.", ".#", "..", ".."],
  e: ["...", "...", ".#.", "#.#", "###", "#..", ".##", "...", "..."],
  n: ["...", "...", "##.", "#.#", "#.#", "#.#", "#.#", "...", "..."],
  c: ["...", "...", ".##", "#..", "#..", "#..", ".##", "...", "..."],
  o: ["...", "...", ".#.", "#.#", "#.#", "#.#", ".#.", "...", "..."],
  h: ["#..", "#..", "##.", "#.#", "#.#", "#.#", "#.#", "...", "..."],
  w: [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#.", ".....", "....."],
  g: ["...", "...", ".##", "#.#", "#.#", "#.#", ".##", "..#", "##."],
};

// A Latin word turned a quarter clockwise, the way a spine reads in English:
// the tops of the letters face right and the word runs down. Turned so, a
// page of lines becomes columns read top to bottom and right to left, the
// order of Korean set in vertical columns. A word is a list of letters, each
// a flat list of LED offsets x, y from the word's top left.
function latinWord(text) {
  const rows = text.split("").some((ch) => LATIN[ch].slice(7).some((r) => r.includes("#"))) ? 9 : 7;
  const letters = [];
  let y = 0;
  for (const ch of text) {
    const g = LATIN[ch], px = [];
    for (let gy = 0; gy < rows; gy++)
      for (let gx = 0; gx < g[gy].length; gx++) if (g[gy][gx] === "#") px.push(rows - 1 - gy, y + gx);
    letters.push(px);
    y += g[0].length + 1;
  }
  return { w: rows, h: y - 1, letters };
}

// ---- Hangul. Each syllable is 7 by 11 and each digit marks the jamo a dot
// belongs to, in writing order, so a Hangul word goes quiet and comes back
// jamo by jamo: 침묵 has six letters (ㅊ ㅣ ㅁ, ㅁ ㅜ ㄱ), 고요 four (ㄱ ㅗ, ㅇ ㅛ).
const HANGUL = {
  침: ["..1...2", "11111.2", "..1...2", ".1.1..2", "1...1.2", "......2", ".......", ".33333.", ".3...3.", ".3...3.", ".33333."],
  묵: [".11111.", ".1...1.", ".1...1.", ".11111.", ".......", "2222222", "...2...", ".......", ".33333.", ".....3.", ".....3."],
  고: [".......", ".11111.", ".....1.", ".....1.", ".....1.", ".....1.", ".......", "...2...", "...2...", "2222222", "......."],
  요: [".......", "..111..", ".1...1.", ".1...1.", ".1...1.", "..111..", ".......", "..2.2..", "..2.2..", "2222222", "......."],
};

function hangulWord(text) {
  const letters = [];
  [...text].forEach((syl, k) => {
    const g = HANGUL[syl], parts = [];
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < 7; x++) {
        const d = +g[y][x];
        if (!d) continue;
        (parts[d - 1] = parts[d - 1] || []).push(k * 8 + x, y);
      }
    letters.push(...parts);
  });
  return { w: 15, h: 11, letters };
}

const WORDS = ["silencio", "schweigen", "silence", "침묵", "고요"];

// Fifteen places. Gomringer set three words to a line in five lines with
// the middle of the third line empty. The Latin words, turned, fill five
// columns of three (the first line is the right column); the Hangul ones
// stand in his three columns of five. Either way the empty place is the
// middle one.
function layout(k) {
  const latin = k < 3;
  const word = latin ? latinWord(WORDS[k]) : hangulWord(WORDS[k]);
  const cols = latin ? 5 : 3, rows = latin ? 3 : 5, slots = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      slots.push(
        latin
          ? { c, r, x: round((c + 0.5) * 12.8 - word.w / 2), y: round(((r + 0.5) * H) / 3 - word.h / 2), line: cols - 1 - c, at: r }
          : { c, r, x: [3, 24, 46][c], y: 8 + 25 * r, line: r, at: c },
      );
  const n = word.letters.length;
  // A reading light runs along each of the five lines word by word, a pause
  // the length of 0.6 of a word between words.
  const step = n * 1.6;
  return { word, n, cols, rows, slots, home: (rows >> 1) * cols + (cols >> 1), step, line: step * 3 };
}

const HOP = 3.6, TRANS = 1.5, RATE = 1 / 1.6;

export function setup(params) {
  params.s = { T: 0, k: -1, L: null, q: null, qt: null, at: 0, prev: -1, next: 0, cx: 0, cy: 0, fx: 0, fy: 0, glide: 9, hush: 0, Lv: new Float32Array(N), Hu: new Float32Array(N), Bo: new Float32Array(N) };
}

// The places sorted into rings by distance from the silence; the hush
// budget (1 place at Hush 0.1 or less, up to 9) fills them ring by ring and
// shares out a ring it cannot fill, so neighbours trail off together.
function targets(S) {
  const { slots, n } = S.L, a = slots[S.at];
  const budget = 1 + (max(0, S.hush - 0.1) / 0.9) * 8;
  const d = slots.map((s) => round(sqrt((s.c - a.c) ** 2 + (s.r - a.r) ** 2) * 1000));
  const rings = [...new Set(d)].sort((x, y) => x - y);
  let left = budget;
  S.reach = 0;
  for (const ring of rings) {
    const idx = [];
    d.forEach((v, j) => v === ring && idx.push(j));
    const f = cl(left / idx.length, 0, 1);
    for (const j of idx) S.qt[j] = f * n;
    if (f > 0) S.reach = ring / 1000;
    left -= idx.length;
  }
}

function useWord(S, k, first) {
  S.k = k;
  S.L = layout(k);
  const m = S.L.slots.length;
  S.q = new Float32Array(m);
  S.qt = new Float32Array(m);
  S.at = S.L.home;
  S.prev = -1;
  const h = S.L.slots[S.at];
  S.cx = S.fx = h.c;
  S.cy = S.fy = h.r;
  S.glide = 9;
  targets(S);
  // The first word is there at once. A new word empties the field and comes
  // back place by place in reading order, each spoken from its first letter.
  S.L.slots.forEach((s, j) => (S.q[j] = first ? S.qt[j] : S.L.n + 1 + (s.line * 3 + s.at) * 0.2 * S.L.n));
  S.next = S.T + (first ? HOP * 0.3 : HOP * 1.6);
}

// The silence moves to a neighbouring place, never straight back, and
// leans home: a place's weight falls with the square of its distance from
// the middle, so the poem's own form comes round often.
function hop(S) {
  const { slots, cols, rows, home } = S.L, a = slots[S.at];
  const h = slots[home], opts = [], wts = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = a.c + dc, r = a.r + dr;
    if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
    const j = r * cols + c;
    if (j === S.prev) continue;
    opts.push(j);
    wts.push(1 / (1 + (c - h.c) ** 2 + (r - h.r) ** 2));
  }
  let u = Math.random() * wts.reduce((x, y) => x + y, 0), j = opts[0];
  for (let i = 0; i < opts.length; i++) if ((u -= wts[i]) <= 0) {
    j = opts[i];
    break;
  }
  S.fx = S.cx;
  S.fy = S.cy;
  S.prev = S.at;
  S.at = j;
  S.glide = 0;
  targets(S);
  S.next = S.T + (j === home ? HOP * 1.5 : HOP);
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const want = cl(round(k[2]), 0, 4);
  if (S.k < 0) {
    S.hush = cl(k[3], 0, 1);
    useWord(S, want, true);
  } else if (want !== S.k) useWord(S, want, false);
  if (abs(k[3] - S.hush) > 1e-4) {
    S.hush = cl(k[3], 0, 1);
    targets(S);
  }
  S.speed = cl(k[1], 0.05, 3);
  const step = (dt * S.speed) / 2;
  S.T += step;
  if ((input.btnPressed || []).some(Boolean)) S.next = S.T;
  if (S.T >= S.next) hop(S);
  // Letters go and come at n letters in TRANS.
  const rate = (S.L.n / TRANS) * step;
  for (let j = 0; j < S.q.length; j++) {
    const d = S.qt[j] - S.q[j];
    S.q[j] += abs(d) <= rate ? d : Math.sign(d) * rate;
  }
  S.glide = min(9, S.glide + step / TRANS);
  const e = smooth(S.glide), a = S.L.slots[S.at];
  S.cx = S.fx + (a.c - S.fx) * e;
  S.cy = S.fy + (a.r - S.fy) * e;
}

export function draw(display, params) {
  const S = params.s;
  if (!S.L) return;
  const { Lv, Hu, Bo } = S, { word, n, slots, step, line } = S.L;
  Lv.fill(0);
  const H0 = 0.56 + S.hue;
  const pos = S.T * RATE * step;
  // The sound dies away in 1.1 seconds whatever the speed, so a fast
  // reader leaves a longer glow behind and a slow one barely any.
  const tail = max(0.25, RATE * step * (S.speed / 2) * 1.1);
  slots.forEach((s, j) => {
    const quiet = S.q[j];
    if (quiet >= n) return;
    // Words near the silence speak more softly: full voice two places
    // beyond the edge of the silence.
    const dist = sqrt((s.c - S.cx) ** 2 + (s.r - S.cy) ** 2);
    const near = 1 - smooth((dist - S.reach) / 2);
    const voice = 1 - 0.34 * near;
    // Where this line's reading light is, in letters; lines are staggered
    // by the golden ratio so the five lights never march together.
    const r = (((pos + s.line * line * 0.618) % line) + line) % line;
    const hue = H0 + 0.07 * near;
    word.letters.forEach((px, i) => {
      const a = cl(n - quiet - i, 0, 1);
      if (a <= 0) return;
      // A sound: quick to come, slow to die away behind the light.
      let u = r - (s.at * step + i);
      if (u < -line / 2) u += line;
      else if (u > line / 2) u -= line;
      const boost = u >= 0 ? exp(-u / tail) : exp(-u * u * 0.8);
      const v = a * voice * (0.48 + 0.52 * boost);
      for (let p = 0; p < px.length; p += 2) {
        const o = (s.y + px[p + 1]) * W + s.x + px[p];
        Lv[o] = v;
        Hu[o] = hue;
        Bo[o] = boost;
      }
    });
  });
  // A faint glow one LED round each letter; the silent places hold no
  // letters, and the places sit at least 3 LEDs apart, so it never reaches
  // into the silence.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const v = Lv[o];
      if (v > 0) {
        const sat = 0.58 * (1 - 0.55 * Bo[o]);
        const [r, g, b] = hsv(Hu[o], sat, v);
        display.setPixel(x, y, r * 255, g * 255, b * 255);
        continue;
      }
      let best = 0, hb = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const w = Lv[yy * W + xx] * (dx && dy ? 0.14 : 0.24);
          if (w > best) (best = w), (hb = Hu[yy * W + xx]);
        }
      }
      if (best <= 0) continue;
      const [r, g, b] = hsv(hb, 0.75, best);
      display.setPixel(x, y, r * 255, g * 255, b * 255);
    }
}
