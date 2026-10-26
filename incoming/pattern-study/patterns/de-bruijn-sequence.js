// ===== Patternflow pattern =====
// Title:   de Bruijn Sequence
// Family:  rhythm
// Idea:    A binary de Bruijn sequence plays as a rhythm, a hit for each 1 and a rest for each 0, and each beat its window of the last k bits lights the one tile of a board of all 2^k words that it spells, so the board fills exactly once a cycle while the jumps from tile to tile trace a Hamiltonian cycle and the same words light one by one as the threads of the order k-1 de Bruijn graph below the tape.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: de Bruijn sequence (Nicolaas Govert de Bruijn, 1946)
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rule=0..2, Zoom=0..3
//
// Knob 1: Hue. Each word takes its colour from when it comes in the cycle, a sweep of three tenths of the wheel from the first word to the last: cyan through blue to violet at 0, violet to magenta and red at 0.25, red through yellow to green at 0.5, lime to cyan at 0.75.
// Knob 2: Speed. Three bits a second for each unit: 6 at the opening 2, so the 64 words of order 6 take 10.7 s; 0.6 a second at 0.2 and 9 at 3.
// Knob 3: Rule. Which sequence plays. At 0 a new one every cycle, drawn uniformly from all 67,108,864 of order 6 (2,048 of order 5, 16 of order 4, 2 of order 3): a random spanning tree of the order k-1 graph by Wilson's loop-erased walks, then the Eulerian circuit that leaves each vertex by its tree edge last (the BEST theorem). At 1 Martin's prefer-one rule (1934), the same every cycle, which runs down the right column and along the bottom row early on. At 2 a maximal shift register, x^k + x + 1 (x^5 + x^2 + 1 at order 5), which never makes the all-zero word: its 2^k - 1 beats, 63 at order 6, leave the top left tile dark and the first slot of the tape empty.
// Knob 4: Zoom. The order k, 6 minus the knob rounded: 6 at 0 is 64 words on 8 by 8 tiles 8 LEDs apart, with 1 LED a bit on the tape; 5 at 1 gives 32 tiles 8 by 16; 4 at 2 gives 16 tiles of 16 by 16; 3 at 3 gives 8 tall tiles, and there Martin's rule plays 01110100, the light and heavy syllables of ya mā tā rā ja bhā na sa, the Sanskrit prosody mnemonic yamātārājabhānasalagāḥ.
// Buttons: K1 tap ends the cycle now: the board flashes and fades and a new sequence starts from the all-zero word.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hsv = (h, s, v, o) => [5, 3, 1].forEach((n, c) => {
  const k = (n + (h - floor(h)) * 6) % 6;
  o[c] = 255 * v * (1 - s * max(0, min(k, 4 - k, 1)));
});

// The board fills the top 64 rows; the tape and the loom share the rest.
const BY = 0, BH = 64, TY = 68, TH = 6, LY0 = 82, LY1 = 125;

// A uniformly random binary de Bruijn sequence of order k, by the BEST
// theorem: a random spanning arborescence of the order k-1 graph into the
// all-zero vertex (Wilson's loop-erased walks), then the Eulerian circuit
// that leaves every other vertex by its tree edge last.
function randomSeq(k) {
  const M = 1 << (k - 1), m = M - 1, inT = new Uint8Array(M), nb = new Uint8Array(M);
  inT[0] = 1;
  for (let v = 1; v < M; v++) {
    let u = v;
    while (!inT[u]) (nb[u] = Math.random() < 0.5 ? 0 : 1), (u = ((u << 1) | nb[u]) & m);
    for (u = v; !inT[u]; u = ((u << 1) | nb[u]) & m) inT[u] = 1;
  }
  const used = new Uint8Array(M), s = new Uint8Array(2 * M);
  for (let i = 0, v = 0; i < 2 * M; i++) {
    const b = v === 0 ? used[v] : used[v] ? nb[v] : 1 - nb[v];
    used[v]++;
    s[i] = b;
    v = ((v << 1) | b) & m;
  }
  return s;
}
// Martin's rule (1934): from k zeros, append a 1 whenever the new word is
// new, else a 0.
function martin(k) {
  const L = 1 << k, mask = L - 1, seen = new Uint8Array(L), s = new Uint8Array(L);
  seen[0] = 1;
  for (let i = 1, w = 0; i < L; i++) {
    const b = seen[((w << 1) | 1) & mask] ? 0 : 1;
    w = ((w << 1) | b) & mask;
    seen[w] = 1;
    s[i] = b;
  }
  return s;
}
// A maximal-length shift register, x^k + x^a + 1: every word but the
// all-zero one, so slot 0 of the tape stays empty.
const TAP = [0, 0, 0, 1, 1, 2, 1];
function lfsr(k) {
  const L = 1 << k, s = new Uint8Array(L), r = new Uint8Array(L + k);
  r[k - 1] = 1;
  for (let i = k; i < L + k; i++) r[i] = r[i - k] ^ r[i - k + TAP[k]];
  // Turn it so the run of k-1 zeros comes last; the missing zero is slot 0.
  let z = 0;
  for (let i = 0; i < L - 1; i++) {
    let ok = r[i] === 1;
    for (let j = 1; j < k && ok; j++) ok = r[(i - j + L - 1) % (L - 1)] === 0;
    if (ok) z = i;
  }
  for (let i = 1; i < L; i++) s[i] = r[(z + i - 1) % (L - 1)];
  return s;
}

export function setup(params) {
  params.s = {
    pos: 0, k: 0, rule: -1, hue: 0, start: 0, seq: null, word: null, old: null, oldAge: 9,
    buf: new Float32Array(N * 3), c: [0, 0, 0],
  };
}

function newCycle(S) {
  const k = S.k;
  S.seq = S.rule === 0 ? randomSeq(k) : S.rule === 1 ? martin(k) : lfsr(k);
  const L = 1 << k, w = new Int16Array(L);
  for (let i = 0; i < L; i++) {
    let v = 0;
    for (let j = k - 1; j >= 0; j--) v = (v << 1) | S.seq[(i - j + L) % L];
    w[i] = v;
  }
  S.word = w;
  S.start = S.rule === 2 ? 1 : 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kn[0], 0, 1);
  const rule = round(cl(kn[2], 0, 2)), k = 6 - round(cl(kn[3], 0, 3));
  if (k !== S.k || rule !== S.rule) {
    S.k = k;
    S.rule = rule;
    newCycle(S);
    S.pos = S.start;
    S.old = null;
  }
  // Bits a second: three for each unit of Speed.
  const L = 1 << S.k, rate = 3 * cl(kn[1], 0.2, 3);
  S.pos += d * rate;
  if (input.btnPressed && input.btnPressed[0]) S.pos = L;
  if (S.pos >= L) {
    // The cycle is complete: keep the full board to fade, draw the next.
    S.old = { word: S.word, start: S.start };
    S.oldAge = 0;
    newCycle(S);
    S.pos = S.start + (S.pos - floor(S.pos));
  }
  if (S.old) S.oldAge += d * rate;
}

// Cell of word w on the board: columns and rows of a 64x64 square.
function cell(k, w) {
  const cols = 1 << ((k + 1) >> 1), rows = 1 << (k >> 1), cw = W / cols, ch = BH / rows;
  return [(w % cols) * cw, BY + floor(w / cols) * ch, cw, ch];
}
function add(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += r;
  buf[o + 1] += g;
  buf[o + 2] += b;
}
function line(buf, x0, y0, x1, y1, c, a) {
  const n = max(abs(x1 - x0), abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) add(buf, round(x0 + ((x1 - x0) * i) / n), round(y0 + ((y1 - y0) * i) / n), c[0] * a, c[1] * a, c[2] * a);
}
function rect(buf, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) add(buf, x, y, r, g, b);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.seq) return;
  const buf = S.buf, k = S.k, L = 1 << k, M = L >> 1, i = floor(S.pos), f = S.pos - i, c = S.c;
  buf.fill(0);
  // Colour of the n-th word of the cycle: a sweep along the wheel.
  const col = (n, out) => hsv(S.hue + 0.5 + (0.3 * n) / L, 0.7, 1, out);
  const hit = S.seq[i], beat = exp(-f * 5);
  const ctr = (w) => {
    const [x, y, cw, ch] = cell(k, w);
    return [round(x + cw / 2 - 0.5), round(y + ch / 2 - 0.5)];
  };
  // The path so far, under the tiles: it shows only in the gaps.
  for (let j = S.start + 1; j <= i - 6; j++) {
    col(j, c);
    line(buf, ...ctr(S.word[j - 1]), ...ctr(S.word[j]), c, 0.22);
  }
  // The board: every word a tile, dim until its turn.
  const step = new Int16Array(L).fill(-1), ostep = new Int16Array(L).fill(-1), O = S.old, fade = O ? max(0, 1 - S.oldAge / 4) : 0;
  for (let j = S.start; j <= i; j++) step[S.word[j]] = j;
  if (fade > 0) for (let j = O.start; j < L; j++) ostep[O.word[j]] = j;
  for (let w = 0; w < L; w++) {
    const [x, y, cw, ch] = cell(k, w), j = step[w];
    if (j < 0) {
      // Not yet this cycle: the last cycle's full board fading out, after a
      // flash on the downbeat that completed it.
      let r = 14, g = 16, b = 22;
      if (fade > 0 && ostep[w] >= 0) {
        col(ostep[w], c);
        const a = 0.5 * fade, e = 160 * max(0, 1 - S.oldAge * 1.5);
        (r = max(r, c[0] * a + e)), (g = max(g, c[1] * a + e)), (b = max(b, c[2] * a + e));
      }
      fill(buf, x + 1, y + 1, cw - 2, ch - 2, r, g, b);
      continue;
    }
    col(j, c);
    const now = j === i, a = now ? (hit ? 1 : 0.75) : 0.5, g = now ? (hit ? 220 : 70) * beat : 0;
    fill(buf, x + 1, y + 1, cw - 2, ch - 2, c[0] * a + g, c[1] * a + g, c[2] * a + g);
    // A hit rings the tile's edge.
    if (now && hit) {
      const r = (c[0] * 0.6 + 40) * beat, gg = (c[1] * 0.6 + 40) * beat, bb = (c[2] * 0.6 + 40) * beat;
      rect(buf, x + 1, y, cw - 2, 1, r, gg, bb);
      rect(buf, x + 1, y + ch - 1, cw - 2, 1, r, gg, bb);
      rect(buf, x, y + 1, 1, ch - 2, r, gg, bb);
      rect(buf, x + cw - 1, y + 1, 1, ch - 2, r, gg, bb);
    }
  }
  // The last jumps on top, fading with age.
  for (let j = max(S.start + 1, i - 6); j <= i; j++) {
    col(j, c);
    line(buf, ...ctr(S.word[j - 1]), ...ctr(S.word[j]), c, 0.22 + 0.7 * exp(-(i - j + f) / 2));
  }
  // The tape: the whole cycle, one slot per bit, the window bracketed.
  const sw = W / L, bw = max(1, floor(sw));
  for (let j = S.start; j < L; j++) {
    const played = j <= i, x = floor(j * sw);
    col(j, c);
    const a = S.seq[j] ? (played ? 0.95 : 0.3) : played ? 0.1 : 0.04;
    rect(buf, x, TY, bw, TH, c[0] * a, c[1] * a, c[2] * a);
  }
  for (let q = 0; q < k; q++) {
    const j = (i - q + L) % L, x = floor(j * sw), g = 150 + 100 * beat * hit;
    rect(buf, x, TY - 2, bw, 1, g, g, g);
    rect(buf, x, TY + TH + 1, bw, 1, g, g, g);
    if (q === 0 && hit) rect(buf, x, TY, bw, TH, 160 * beat, 160 * beat, 160 * beat);
  }
  // The loom: each word is a thread from its first k-1 bits, along the top,
  // to its last k-1 bits along the bottom: the order k-1 de Bruijn graph.
  const nx = (v) => (v + 0.5) * (W / M) - 0.5, th = max(1, round(12 / M));
  if (fade > 0)
    for (let j = O.start; j < L; j++) {
      col(j, c);
      thread(buf, nx(O.word[j] >> 1), nx(O.word[j] & (M - 1)), c, 0.12 * fade, th);
    }
  for (let j = S.start; j <= i; j++) {
    const w = S.word[j], age = i - j + f;
    col(j, c);
    thread(buf, nx(w >> 1), nx(w & (M - 1)), c, j === i ? (hit ? 1 : 0.6) : 0.12 + 0.5 * exp(-age / 2.5), th);
  }
  for (let v = 0; v < M; v++) {
    rect(buf, round(nx(v)), LY0 - 2, 1, 1, 90, 90, 100);
    rect(buf, round(nx(v)), LY1 + 2, 1, 1, 90, 90, 100);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) & 252, min(255, buf[o + 1]) & 252, min(255, buf[o + 2]) & 252);
}
function fill(buf, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0, o = (y * W + x) * 3; x < x0 + w; x++, o += 3) (buf[o] = r), (buf[o + 1] = g), (buf[o + 2] = b);
}
// A thread of the loom: an S from top to bottom, eased at both ends, wider
// when there are fewer of them.
function thread(buf, x0, x1, c, a, th) {
  const n = max(LY1 - LY0, abs(x1 - x0) * 2);
  let px = -1, py = -1;
  for (let s = 0; s <= n; s++) {
    const t = s / n, e = t * t * (3 - 2 * t), x = round(x0 + (x1 - x0) * e - (th - 1) / 2), y = round(LY0 + (LY1 - LY0) * t);
    if (x === px && y === py) continue;
    for (let q = 0; q < th; q++) add(buf, x + q, y, c[0] * a, c[1] * a, c[2] * a);
    (px = x), (py = y);
  }
}
