// ===== Patternflow pattern =====
// Title:   Huffman Tree
// Family:  type
// Idea:    The symbols of a short text stand along the foot of the panel on dotted stems as tall as the logarithm of their counts, the two lightest nodes merge again and again into a parent that rises above them until one root stands at the top, every merge writing a 0 into the codes of the leaves under its left branch and a 1 under its right so the codes grow up the columns over the labels, and then the text streams down the tree into a bit string that comes out shorter than the fixed-length code under it.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: minimum-redundancy codes (David A. Huffman, 1952); coding the opening words of Charles Dickens's A Tale of Two Cities (1859), the perfect pangram Mr Jock, TV quiz PhD, bags few lynx, the first 100 digits of pi, and the first two lines of Yun Dong-ju's Seosi (1941) split into jamo; the 3 by 5 capitals of the Typewriter pattern (round 18), pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..3, Tie=0..2
//
// Knob 1: Hue. Turns the colours round the wheel: at 0 a 0 bit is azure, a 1 bit amber and the fixed-length strip rose; at 0.5 a 0 is red-orange, a 1 blue and the fixed strip green. Stems and labels keep a pale tint of the 0 colour.
// Knob 2: Speed. At 2 the lightest merge takes 0.22 s and the root 0.48 s, so Dickens's 12 merges stand in 4.1 s, its 50 symbols stream in 7 s and the whole run with 3 s of totals and a 1 s fade lasts 15.7 s; at 0.2 it all takes ten times as long, at 3 two thirds as long.
// Knob 3: Text. 0 Dickens, 13 symbols over 50 places, 169 bits against 200 at 4 bits a symbol; 1 the pangram, 27 symbols over 33 places, 148 against 165 at 5 bits, its 26 letters a level comb of 5 and 6 bit codes beside the space's 00; 2 the first 100 digits of pi, 332 against 400 at the 4 bits of binary-coded decimal, six digits taking 3 bits and four taking 4; 3 Seosi in jamo, 16 symbols over 58 places, 223 against 232.
// Knob 4: Tie. Which of two equal weights merges first: 0 the older (leaves before merged nodes, earlier symbols first), 1 the newer, 2 a coin drawn anew each time the tree is rebuilt. The tree changes shape and the total never does: Dickens takes 169 bits under every rule while its longest code is 5 bits at 0 and 6 at 1, and the pangram's four 6-bit letters are M R J O at 0 and E W L Y at 1.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp, log2, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => {
  const t = cl(v, 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The 3 by 5 face, rows top to bottom, one bit per column: Typewriter's
// capitals, the figures, and a space drawn as an open box.
const G3 = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001011001111",
  4: "101101111001001", 5: "111100111001111", 6: "111100111101111", 7: "111001010010010",
  8: "111101111101111", 9: "111101111001111",
  " ": "000000000101111", "+": "000010111010000", "=": "000111000111000", "<": "001010100010001",
};
// Jamo drawn 5 by 5 for the Korean line, and its space.
const G5 = {
  "ㄱ": "1111100001000010000100001", "ㄲ": "1101101001010010100101001", "ㄴ": "1000010000100001000011111",
  "ㄹ": "1111100001111111000011111", "ㅁ": "1111110001100011000111111", "ㅂ": "1000110001111111000111111",
  "ㅅ": "0010000100010100101010001", "ㅇ": "0111010001100011000101110", "ㅈ": "1111100100001000101010001",
  "ㅎ": "0010011111011101000101110", "ㅏ": "0100001000011100100001000", "ㅓ": "0001000010011100001000010",
  "ㅜ": "0000011111001000010000100", "ㅡ": "0000000000111110000000000", "ㅣ": "0010000100001000010000100",
  " ": "0000000000000001000111111",
};

const TEXTS = [
  // A Tale of Two Cities (1859), its first words, letters and spaces only.
  "IT WAS THE BEST OF TIMES IT WAS THE WORST OF TIMES",
  // A perfect pangram: every letter once, so 26 weights of 1 and the spaces.
  "MR JOCK TV QUIZ PHD BAGS FEW LYNX",
  // The first 100 digits of pi, 3 and 99 decimals.
  "3141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067",
  // Yun Dong-ju, Seosi (1941): 죽는 날까지 하늘을 우러러 / 한 점 부끄럼이 없기를,
  // split into the keys of the two-set keyboard (없 is ㅇ ㅓ ㅂ ㅅ, ㄲ one key).
  "ㅈㅜㄱㄴㅡㄴ ㄴㅏㄹㄲㅏㅈㅣ ㅎㅏㄴㅡㄹㅇㅡㄹ ㅇㅜㄹㅓㄹㅓ ㅎㅏㄴ ㅈㅓㅁ ㅂㅜㄲㅡㄹㅓㅁㅇㅣ ㅇㅓㅂㅅㄱㅣㄹㅡㄹ",
];

// Rows. The text line, the Huffman strip and the fixed strip at the top, the
// root under them; labels at the foot with the code band above them.
const LINE_Y = 1, HS_Y = 8, FS_Y = 16, STRIP_R = 7, ROOT_Y = 28;
// Times in seconds at Speed 2.
const T0 = 0.3, TM = 0.32, PAUSE = 0.6, STREAM = 7, HOLD = 3, FADE = 1;

// Huffman's construction. Symbols are counted in order of first appearance
// and become leaves 0..k-1; each merge takes the two lightest nodes, the
// first taken goes left (bit 0), and the parent joins the pool. Ties go by
// the rule: 0 the older node first, 1 the newer, 2 a random key.
function huffman(text, rule) {
  const idx = new Map(), sym = [], seq = [];
  for (const ch of text) {
    if (!idx.has(ch)) idx.set(ch, sym.length), sym.push({ ch, w: 0 });
    const i = idx.get(ch);
    sym[i].w++;
    seq.push(i);
  }
  const nodes = sym.map((s, i) => ({ w: s.w, leaf: i, a: -1, b: -1, up: -1, bit: 0, r: Math.random(), m: -1 }));
  const pool = nodes.map((_, i) => i), merges = [];
  const first = (i, j) => {
    const p = nodes[i], q = nodes[j];
    if (p.w !== q.w) return p.w < q.w;
    return rule === 0 ? i < j : rule === 1 ? i > j : p.r < q.r;
  };
  const take = () => {
    let bi = 0;
    for (let i = 1; i < pool.length; i++) if (first(pool[i], pool[bi])) bi = i;
    return pool.splice(bi, 1)[0];
  };
  while (pool.length > 1) {
    const a = take(), b = take(), id = nodes.length;
    nodes.push({ w: nodes[a].w + nodes[b].w, leaf: -1, a, b, up: -1, bit: 0, r: Math.random(), m: merges.length });
    nodes[a].up = id, nodes[b].up = id, nodes[b].bit = 1;
    merges.push(id);
    pool.push(id);
  }
  const root = pool[0];
  // Codes, read from the root: 0 for the left branch, 1 for the right.
  const codes = sym.map((_, i) => {
    let s = "";
    for (let n = i; nodes[n].up >= 0; n = nodes[n].up) s = nodes[n].bit + s;
    return s;
  });
  let total = 0, sigma = 0;
  for (const i of seq) total += codes[i].length;
  for (const id of merges) sigma += nodes[id].w;
  return { sym, seq, nodes, merges, root, codes, total, sigma, maxLen: max(...codes.map((c) => c.length)) };
}

function prepare(S) {
  const text = TEXTS[S.text], T = huffman(text, S.rule), k = T.sym.length, N = T.seq.length;
  const big = S.text === 3, gw = big ? 5 : 3, m = (gw - 1) / 2;
  // In-order leaves: the tree draws without crossings.
  const order = [];
  const walk = (n) => {
    const q = T.nodes[n];
    if (q.leaf >= 0) order.push(n);
    else walk(q.a), walk(q.b);
  };
  walk(T.root);
  const pitch = (W - 2 * m) / k, stagger = pitch < gw + 1;
  const band = max(T.maxLen, huffman(text, 0).maxLen, huffman(text, 1).maxLen);
  const labelY = stagger ? 116 : 122, codeBottom = labelY - 2, Y0 = codeBottom - 2 * band + 1 - 3;
  order.forEach((n, pos) => {
    const q = T.nodes[n];
    q.x = round(m + (pos + 0.5) * pitch - 0.5);
    q.ly = stagger && pos % 2 === 0 ? 122 : labelY;
  });
  // Heights: a node of weight w stands log2(w) levels above the baseline,
  // so the drop from the root to a leaf is log2(N / w), the leaf's ideal
  // length in bits. Parents keep 2 rows above their children and never
  // below an earlier merge, so the tree grows upwards in merge order.
  let L = (Y0 - ROOT_Y) / log2(N);
  for (let tries = 0; tries < 40; tries++) {
    for (const q of T.nodes) if (q.leaf >= 0) q.y = Y0 - round(log2(q.w) * L);
    let prev = Y0;
    for (const id of T.merges) {
      const q = T.nodes[id], A = T.nodes[q.a], B = T.nodes[q.b];
      q.x = (A.x + B.x) >> 1;
      q.y = min(Y0 - round(log2(q.w) * L), A.y - 2, B.y - 2, prev);
      prev = q.y;
    }
    if (T.nodes[T.root].y >= ROOT_Y) break;
    L *= 0.97;
  }
  // Each leaf's ancestors from the leaf up, and where its bits go in the
  // Huffman strip for every place in the text.
  T.path = order.map(() => null);
  for (let i = 0; i < k; i++) {
    const up = [];
    for (let n = i; T.nodes[n].up >= 0; n = T.nodes[n].up) up.push(n);
    T.path[i] = up;
  }
  T.pos = new Int32Array(N + 1);
  for (let j = 0; j < N; j++) T.pos[j + 1] = T.pos[j] + T.codes[T.seq[j]].length;
  T.fb = ceil(log2(k));
  T.fixed = T.fb * N;
  T.cw = T.fixed <= STRIP_R * 32 ? 2 : 1;
  T.chars = [...text];
  T.N = N, T.k = k, T.big = big, T.gw = gw, T.Y0 = Y0, T.codeBottom = codeBottom, T.L = L;
  // A merge takes longer the heavier it is: the twigs go quickly, the
  // trunk slowly, 0.6 to 1.5 times TM.
  T.mS = [], T.mD = [], T.mT = [];
  let at = T0;
  for (const id of T.merges) {
    const dur = TM * (0.5 + sqrt(T.nodes[id].w / N));
    T.mS.push(at), T.mD.push(dur), T.mT.push(at + 0.8 * dur);
    at += dur;
  }
  T.buildEnd = at;
  T.ts = min(0.25, STREAM / N);
  T.streamAt = T.buildEnd + PAUSE;
  T.holdAt = T.streamAt + N * T.ts;
  T.end = T.holdAt + HOLD + FADE;
  S.T = T;
  S.c = 0;
}

export function setup(params) {
  params.s = { t: 0, c: 0, text: 0, rule: 0, hue: 0, speed: 2, T: null, buf: new Float32Array(W * H * 3) };
  prepare(params.s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const text = cl(round(k[2]), 0, 3), rule = cl(round(k[3]), 0, 2);
  if (text !== S.text || rule !== S.rule) {
    S.text = text, S.rule = rule;
    prepare(S);
    return;
  }
  S.c += (d * S.speed) / 2;
  if (S.c >= S.T.end) prepare(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  const T = S.T, c = S.c, buf = S.buf, nodes = T.nodes;
  buf.fill(0);
  const h0 = 0.55 + S.hue;
  const BIT = [hsv(h0, 0.8, 1), hsv(h0 + 0.58, 0.85, 1)];
  const PALE = hsv(h0, 0.55, 1), FIX = hsv(h0 + 0.3, 0.55, 1);
  const fade = c > T.end - FADE ? 1 - sm((c - (T.end - FADE)) / FADE) : 1;
  const put = (x, y, col, v) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    buf[i] = max(buf[i], col[0] * v), buf[i + 1] = max(buf[i + 1], col[1] * v), buf[i + 2] = max(buf[i + 2], col[2] * v);
  };
  const vline = (x, y0, y1, col, v) => {
    for (let y = min(y0, y1); y <= max(y0, y1); y++) put(x, y, col, v);
  };
  const hline = (x0, x1, y, col, v) => {
    for (let x = min(x0, x1); x <= max(x0, x1); x++) put(x, y, col, v);
  };
  const glyph = (ch, x0, y0, col, v) => {
    const g5 = T.big && G5[ch], g = g5 || G3[ch];
    if (!g) return;
    const gw = g5 ? 5 : 3;
    if (x0 + gw > W) return;
    for (let r = 0; r < 5; r++) for (let q = 0; q < gw; q++) if (g[r * gw + q] === "1") put(x0 + q, y0 + r, col, v);
  };
  const WHITE = [1, 1, 1];
  const N = T.N, M = T.merges.length, wN = nodes[T.root].w;
  const br = (w) => 0.42 + 0.58 * sqrt(w / wN);

  // Merge clock: how many merges are done, which one runs and how far.
  let done = 0;
  while (done < M && c >= T.mT[done]) done++;
  let running = -1, u = 0;
  if (c >= T0 && c < T.buildEnd) {
    running = done < M && c >= T.mS[done] ? done : done - 1;
    u = (c - T.mS[running]) / T.mD[running];
  }
  let front = T.Y0;
  if (c >= T0) {
    if (running >= 0) {
      const prev = running > 0 ? nodes[T.merges[running - 1]].y : T.Y0;
      front = round(prev + (nodes[T.merges[running]].y - prev) * sm(u / 0.45));
    } else front = nodes[T.root].y;
  }
  const isDone = (id) => nodes[id].leaf >= 0 || nodes[id].m < done;

  // Leaves' dotted stems: the count on a log scale.
  for (let i = 0; i < T.k; i++) {
    const q = nodes[i];
    for (let y = T.Y0; y > q.y; y -= 2) put(q.x, y, PALE, 0.4);
  }
  // Faint lines a bit apart, counted down from where the root would stand:
  // a leaf whose node sits between lines j and j + 1 has an ideal length
  // log2(N / w) between j and j + 1 bits.
  for (let j = 1; ; j++) {
    const y = round(T.Y0 - (log2(N) - j) * T.L);
    if (y > T.Y0) break;
    for (let x = (j & 1) * 2; x < W; x += 4) put(x, y, PALE, 0.14);
  }
  // Under each bar a faint light down to the higher child: the 0 side left
  // of the parent, the 1 side right of it.
  for (let j = 0; j < done; j++) {
    const q = nodes[T.merges[j]], A = nodes[q.a], B = nodes[q.b], low = min(A.y, B.y), hh = low - q.y;
    const e = 1 - exp(-(c - T.mT[j]) / 0.3);
    for (let y = q.y + 1; y < low; y++) {
      const v = e * 0.21 * (1 - (0.75 * (y - q.y)) / hh);
      for (let x = A.x + 1; x < B.x; x++) if (x !== q.x) put(x, y, BIT[x < q.x ? 0 : 1], v);
    }
  }
  // Edges. A merged node's stem and half bar take its bit's colour, brighter
  // for heavier nodes; an unmerged node's stem grows white up to the front.
  for (let n = 0; n < nodes.length; n++) {
    const q = nodes[n];
    if (!isDone(n)) continue;
    const p = q.up >= 0 ? nodes[q.up] : null;
    if (p && p.m < done) {
      vline(q.x, q.y, p.y, BIT[q.bit], br(q.w));
      hline(q.x, p.x, p.y, BIT[q.bit], br(q.w));
      // Heavy branches run two LEDs wide, inwards and upwards.
      if (q.leaf < 0 && q.w * 5 >= wN) {
        vline(q.x + (q.bit ? -1 : 1), q.y - 1, p.y, BIT[q.bit], 0.8 * br(q.w));
        hline(q.x, p.x, p.y - 1, BIT[q.bit], 0.8 * br(q.w));
      }
    } else if (p && p.m === running) {
      const top = min(q.y, front);
      vline(q.x, q.y, top, WHITE, 0.95);
      if (u > 0.45) {
        const f = sm((u - 0.45) / 0.35), xe = round(q.x + (p.x - q.x) * f);
        if (f > 0) hline(q.x, xe, p.y, BIT[q.bit], 1);
      }
    } else if (n !== T.root) {
      if (front < q.y) vline(q.x, q.y, front, PALE, 0.55);
    }
    // The node itself.
    if (n === T.root && done === M) vline(q.x, q.y, q.y - 2, WHITE, 1);
    put(q.x, q.y, WHITE, q.leaf >= 0 ? 0.9 : 0.7);
  }
  // A merge just done flashes its bar.
  if (done > 0) {
    const id = T.merges[done - 1], q = nodes[id], e = exp(-(c - T.mT[done - 1]) / 0.25);
    if (e > 0.05) hline(nodes[q.a].x, nodes[q.b].x, q.y, WHITE, e);
  }

  // Codes over the labels, growing upwards a bit per merge above the leaf.
  for (let i = 0; i < T.k; i++) {
    const q = nodes[i], up = T.path[i], len = up.length;
    let vis = 0;
    while (vis < len && nodes[nodes[up[vis]].up].m < done) vis++;
    for (let j = 0; j < vis; j++) {
      // j counts from the leaf: the bit of up[j]; it sits j rows above the bottom.
      const n = up[j], y = T.codeBottom - 2 * j;
      const fresh = exp(-(c - T.mT[nodes[nodes[n].up].m]) / 0.3);
      put(q.x, y, BIT[nodes[n].bit], 0.85);
      if (fresh > 0.05) put(q.x, y, WHITE, fresh);
    }
    // The leaf's column down to its label.
    vline(q.x, T.codeBottom + 1, q.ly - 1, PALE, 0.3);
  }

  // Streaming: the current symbol's path lights from the root down, and its
  // bits go into the Huffman strip while its fixed code goes in below.
  let cur = -1, cu = 0, wrote = 0, wroteF = 0;
  if (c >= T.streamAt) {
    const s = (c - T.streamAt) / T.ts;
    cur = min(N - 1, floor(s));
    cu = s >= N ? 1 : s - cur;
    const leaf = T.seq[cur], len = T.codes[leaf].length;
    const shown = min(len, 1 + floor(cu * 1.6 * len));
    wrote = T.pos[cur] + shown;
    wroteF = cur * T.fb + min(T.fb, 1 + floor(cu * 1.6 * T.fb));
    // Path: up[len-1] is the root's child; edges from the root down.
    const up = T.path[leaf], e = s >= N ? 0 : 1 - 0.5 * cu;
    for (let j = len - 1; j >= len - shown; j--) {
      const q = nodes[up[j]], p = nodes[q.up];
      vline(q.x, q.y, p.y, WHITE, e);
      hline(q.x, p.x, p.y, WHITE, e);
    }
    const lf = nodes[leaf];
    if (shown === len) for (let j = 0; j < len; j++) put(lf.x, T.codeBottom - 2 * j, WHITE, e);
  }

  // Labels.
  for (let i = 0; i < T.k; i++) {
    const q = nodes[i], lit = cur >= 0 && T.seq[cur] === i && c < T.holdAt;
    glyph(T.sym[i].ch, q.x - (T.gw >> 1), q.ly, lit ? WHITE : PALE, lit ? 1 : 0.85);
  }

  // Strips: the Huffman strip fills with placeholders a merge at a time,
  // w cells for a merge of weight w, and they come to the code's length;
  // the fixed strip waits at N times the fixed length from the start.
  const cw = T.cw, per = W / cw;
  const cell = (y0, i, col, v) => {
    const x = (i % per) * cw, y = y0 + floor(i / per);
    for (let q = 0; q < cw; q++) put(x + q, y, col, v);
  };
  let held = 0;
  for (let j = 0; j < done; j++) held += nodes[T.merges[j]].w;
  const GREY = FIX;
  let bit = 0;
  for (let i = 0; i < T.total; i++) {
    if (i < wrote) {
      // Which bit of which symbol: walk the text alongside.
      while (T.pos[bit + 1] <= i) bit++;
      const b = T.codes[T.seq[bit]][i - T.pos[bit]];
      cell(HS_Y, i, BIT[b === "1" ? 1 : 0], i >= T.pos[cur] && c < T.holdAt ? 1 : 0.8);
    } else if (i < held) cell(HS_Y, i, PALE, 0.25);
  }
  for (let i = 0; i < T.fixed; i++) {
    if (i < wroteF) {
      const j = floor(i / T.fb), b = (T.seq[j] >> (T.fb - 1 - (i % T.fb))) & 1;
      cell(FS_Y, i, GREY, b ? 0.7 : 0.32);
    } else cell(FS_Y, i, GREY, 0.22);
  }

  // The line: the text before the first merge, each merge's sum while the
  // tree grows, the text running through while it streams, then the totals.
  const P = T.big ? 6 : 4;
  if (done === 0 && running < 1) {
    for (let j = 0; j * P < W && j < N; j++) glyph(T.chars[j], j * P + 1, LINE_Y, PALE, 0.6);
  } else if (c < T.streamAt) {
    const id = T.merges[running >= 0 ? running : M - 1], q = nodes[id];
    const parts = [[String(nodes[q.a].w), BIT[0]], ["+", PALE], [String(nodes[q.b].w), BIT[1]]];
    if (running < 0 || u >= 0.8) parts.push(["=", PALE], [String(q.w), WHITE]);
    let len = 0;
    for (const [s] of parts) len += s.length;
    let x = (W - len * 4 + 1) >> 1;
    for (const [s, col] of parts) for (const ch of s) glyph(ch, x, LINE_Y, col, 1), (x += 4);
  } else if (c < T.holdAt) {
    const chars = T.chars;
    for (let j = 0; j < 16; j++) {
      const at = cur - 3 + j;
      if (at < 0 || at >= N || j * P >= W) continue;
      glyph(chars[at], j * P + 1, LINE_Y, at === cur ? WHITE : PALE, at === cur ? 1 : at < cur ? 0.35 : 0.65);
    }
  } else {
    const a = String(T.total), b = String(T.fixed), len = a.length + 1 + b.length;
    let x = (W - len * 4 + 1) >> 1;
    for (const ch of a) glyph(ch, x, LINE_Y, BIT[1], 1), (x += 4);
    glyph("<", x, LINE_Y, WHITE, 1), (x += 4);
    for (const ch of b) glyph(ch, x, LINE_Y, GREY, 0.8), (x += 4);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, (255 * min(1, buf[i] * fade)) | 0, (255 * min(1, buf[i + 1] * fade)) | 0, (255 * min(1, buf[i + 2] * fade)) | 0);
    }
}
