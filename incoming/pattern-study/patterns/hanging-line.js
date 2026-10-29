// ===== Patternflow pattern =====
// Title:   Hanging Line
// Family:  type
// Idea:    Kim Sowol's poem Azaleas types itself jamo by jamo, initial, vowel, final, in a geometric out-of-the-square Hangul after Ahn Sang-soo's face, every jamo one fixed shape so the syllables hang from a common top line with ragged bottoms, until the Frame knob squeezes each syllable into the same square box the way a conventional face does.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: 안상수체, the out-of-the-square (탈네모꼴) three-set Hangul face of Ahn Sang-soo (1985), whose 19 initials, 21 vowels and 27 finals each keep one shape; the jamo here are drawn after it for this pattern, not copied; the text is Kim Sowol's 진달래꽃 (Azaleas, 1922); pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=1..2, Frame=0..1
//
// Knob 1: Hue. Turns the ink round the wheel: at 0 the text is a pale azalea pink and each new jamo lands in full azalea magenta, under dim teal hanging lines.
// Knob 2: Speed. Steps a second, a step being one jamo, a space or a line break: 4.4 at the opening 2, so the poem's 264 steps take a minute, 0.44 at 0.2 and 6.6 at 3.
// Knob 3: Size. The jamo cell: 7 LEDs at 1, where up to five syllables fit a line and five and a half lines the panel, 13 LEDs at 2, where two or three do and the lines wrap again.
// Knob 4: Frame. Out of the square at 0: each jamo one shape and size, every syllable hanging from its line's top. At 1 each syllable is stretched into the same 13 by 13 square, as a conventional (네모꼴) face resizes its jamo per syllable, and a syllable still being typed jumps in size as each jamo arrives. The opening 0.06 sits near the hanging line.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// 진달래꽃 in today's spelling: 94 syllables, 222 jamo.
const POEM = [
  "나 보기가 역겨워", "가실 때에는", "말없이 고이 보내 드리우리다", "",
  "영변에 약산", "진달래꽃", "아름 따다 가실 길에 뿌리우리다", "",
  "가시는 걸음걸음", "놓인 그 꽃을", "사뿐히 즈려밟고 가시옵소서", "",
  "나 보기가 역겨워", "가실 때에는", "죽어도 아니 눈물 흘리우리다", "",
];

// ---- The face. Drawn after 안상수체, not copied from it: straight strokes
// and circles on a grid one LED apart at Size 1. A consonant fills a 7 by 7
// cell (0..6), the same cell as an initial and as a final. Strokes are
// polylines [x0, y0, x1, y1, ...]; a circle is [cx, cy, r, 0, 0] tagged by
// length 5. Only the 16 consonant shapes and 11 vowels the poem uses are here.
const C = {
  g: [[0, 0, 6, 0, 6, 6]],
  n: [[0, 0, 0, 6, 6, 6]],
  d: [[6, 0, 0, 0, 0, 6, 6, 6]],
  r: [[0, 0, 6, 0, 6, 3, 0, 3, 0, 6, 6, 6]],
  m: [[0, 0, 6, 0, 6, 6, 0, 6, 0, 0]],
  b: [[0, 0, 0, 6, 6, 6, 6, 0], [0, 3, 6, 3]],
  s: [[3, 0, 0, 6], [3, 0, 6, 6]],
  o: [[3, 3, 3, 0, 0]],
  j: [[0, 0, 6, 0], [3, 0, 0, 6], [3, 0, 6, 6]],
  c: [[2, 0, 4, 0], [0, 2, 6, 2], [3, 2, 0, 6], [3, 2, 6, 6]],
  // ㅎ's circle is too small for a round ring one LED wide to stay open at
  // this size, so it is the eight-sided ring those LEDs make.
  h: [[2, 0, 4, 0], [0, 1, 6, 1], [2, 3, 4, 3, 5, 4, 5, 5, 4, 6, 2, 6, 1, 5, 1, 4, 2, 3]],
};
// A double or a cluster sets two consonants side by side, each squeezed to
// three LEDs.
function pair(a, b) {
  const sq = (st, dx) => (st.length === 5 ? [dx + st[0] / 3, st[1], st[2], 0, 0] : st.map((v, i) => (i % 2 ? v : dx + v / 3)));
  return [...C[a].map((s) => sq(s, 0)), ...C[b].map((s) => sq(s, 4))];
}
const INI = { 0: C.g, 1: pair("g", "g"), 2: C.n, 3: C.d, 4: pair("d", "d"), 5: C.r, 6: C.m, 7: C.b, 8: pair("b", "b"), 9: C.s, 11: C.o, 12: C.j, 18: C.h };
const FIN = { 1: C.g, 4: C.n, 8: C.r, 11: pair("r", "b"), 16: C.m, 17: C.b, 18: pair("b", "s"), 21: C.o, 23: C.c, 27: C.h };
// Vertical vowels stand right of the initial from x = 8; their stem runs
// from the top down to y = 11, the middle of a final set under the initial
// at y = 8..14, whether the syllable has a final or not: one shape.
const V = (list, x0, len) => list.map((s) => s.map((v, i) => (i % 2 ? (v === 99 ? len : v) : v + x0)));
const STEM = (x) => [x, 0, x, 99];
const VERT = {
  0: [STEM(0), [0, 3, 2, 3]], // ㅏ
  1: [STEM(0), [0, 3, 2, 3], STEM(4)], // ㅐ
  2: [STEM(0), [0, 2, 2, 2], [0, 4, 2, 4]], // ㅑ
  4: [[0, 3, 2, 3], STEM(2)], // ㅓ
  5: [[0, 3, 2, 3], STEM(2), STEM(4)], // ㅔ
  6: [[0, 2, 2, 2], [0, 4, 2, 4], STEM(2)], // ㅕ
  20: [STEM(0)], // ㅣ
};
// Horizontal vowels hang under the initial from y = 8; the final goes two
// rows under the vowel's lowest row.
const HORI = {
  8: [[[3, 8, 3, 9], [0, 10, 6, 10]], 10], // ㅗ
  13: [[[0, 8, 6, 8], [3, 8, 3, 10]], 10], // ㅜ
  18: [[[0, 8, 6, 8]], 8], // ㅡ
};
// Compounds: the horizontal part under the initial, the vertical part
// beside it with its stem down to the middle of where the final would sit.
const COMP = { 14: [13, 4] }; // ㅝ = ㅜ + ㅓ

// A syllable as three stroke lists (initial, vowel, final) in grid units.
function syllable(ch) {
  const k = ch.charCodeAt(0) - 0xac00, ci = floor(k / 588), vi = floor((k % 588) / 28), fi = k % 28;
  let vow, fy;
  if (VERT[vi]) {
    vow = V(VERT[vi], 8, 11);
    fy = 8;
  } else if (HORI[vi]) {
    vow = HORI[vi][0];
    fy = HORI[vi][1] + 2;
  } else {
    const [h, v] = COMP[vi];
    fy = HORI[h][1] + 2;
    vow = [...HORI[h][0], ...V(VERT[v], 8, fy + 3)];
  }
  const fin = fi ? FIN[fi].map((s) => (s.length === 5 ? [s[0], s[1] + fy, s[2], 0, 0] : s.map((v, i) => (i % 2 ? v + fy : v)))) : [];
  return [INI[ci], vow, fin];
}
// The box a list of strokes fills: right and bottom edges, in LEDs.
function extent(lists) {
  let w = 1, h = 1;
  for (const L of lists)
    for (const s of L) {
      if (s.length === 5) {
        w = max(w, s[0] + s[2] + 1);
        h = max(h, s[1] + s[2] + 1);
      } else
        for (let i = 0; i < s.length; i += 2) {
          w = max(w, s[i] + 1);
          h = max(h, s[i + 1] + 1);
        }
    }
  return [w, h];
}

// ---- The page. Each copy of the poem starts on a fresh line, so the
// layout repeats copy after copy and the cursor can wrap round unseen.
const COPIES = 3, SQ = 13, TRACK = 2, SPACE = 4, LEAD = 4, MARGIN = 2;

function tokens() {
  const out = [];
  let step = 0;
  for (let c = 0; c < COPIES; c++)
    for (const line of POEM) {
      if (line === "") {
        out.push({ t: "stanza", step });
        step += 2;
        continue;
      }
      line.split(" ").forEach((word, wi) => {
        if (wi) out.push({ t: "space", step: step++ });
        const syl = [...word].map((ch) => {
          const parts = syllable(ch);
          const n = parts[2].length ? 3 : 2;
          const tok = { t: "syl", step, n, parts, ext: [extent([parts[0]]), extent([parts[0], parts[1]]), extent(parts)] };
          step += n;
          return tok;
        });
        out.push({ t: "word", syl });
      });
      out.push({ t: "line", step: step++ });
    }
  return { list: out, steps: step };
}

export function setup(params) {
  const { list, steps } = tokens();
  const S = (params.s = { list, steps, copySteps: steps / COPIES, cur: 0, scroll: 0, key: "", blink: 0 });
  S.maxH = 0;
  for (const tk of list) if (tk.t === "word") for (const s of tk.syl) S.maxH = max(S.maxH, s.ext[2][1]);
  // Open in the second copy, on 「아름 따다 가실 길에」, with the first
  // copy's lines filling the page above.
  let n = 0;
  for (const tk of list)
    if (tk.t === "word")
      for (const s of tk.syl)
        if (++n === 94 + 38) S.cur = s.step;
  S.R = new Float32Array(W * H);
  S.G = new Float32Array(W * H);
  S.B = new Float32Array(W * H);
}

// Where every syllable goes for this Size and Frame: slot x, line top y,
// slot width, in LEDs.
function layout(S) {
  const sc = S.size, f = S.frame;
  const pitch = ((1 - f) * S.maxH + f * SQ + LEAD) * sc;
  const adv = (w) => ((1 - f) * w + f * SQ + TRACK) * sc;
  let x = MARGIN, y = 0, lineIx = 0;
  S.lines = [];
  const newLine = (gap) => {
    x = MARGIN;
    y += pitch * gap;
    lineIx++;
  };
  for (const tk of S.list) {
    if (tk.t === "stanza") newLine(0.45);
    else if (tk.t === "line") newLine(1);
    else if (tk.t === "space") {
      if (x > MARGIN) x += SPACE * sc;
    } else if (tk.t === "word") {
      const wW = tk.syl.reduce((a, s) => a + adv(s.ext[2][0]), 0) - TRACK * sc;
      if (x > MARGIN && x + wW > W - MARGIN) newLine(1);
      for (const s of tk.syl) {
        const aw = adv(s.ext[2][0]);
        if (x > MARGIN && x + aw - TRACK * sc > W - MARGIN) newLine(1);
        s.x = x;
        s.y = y;
        s.line = lineIx;
        s.w = aw - TRACK * sc;
        x += aw;
      }
    }
  }
  S.pitch = pitch;
  // The height of one copy: where the first syllable of each copy sits.
  const firsts = [];
  let k = 0;
  for (const tk of S.list) if (tk.t === "word") for (const s of tk.syl) if (k++ % 94 === 0) firsts.push(s.y);
  S.period = firsts[1] - firsts[0];
}

// The syllable the cursor is on, or the last one before it.
function caretSyl(S) {
  let last = null;
  for (const tk of S.list) {
    if (tk.t !== "word") {
      if (tk.step !== undefined && tk.step > S.cur) break;
      continue;
    }
    for (const s of tk.syl) {
      if (s.step > S.cur) return last;
      last = s;
    }
  }
  return last;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1], 0.2, 3);
  S.size = cl(k[2], 1, 2);
  S.frame = cl(k[3], 0, 1);
  S.blink += dt;
  S.cur += dt * speed * 2.2;
  // Past the second copy, step back a copy: the page looks the same.
  let jumped = false;
  if (S.cur >= 2 * S.copySteps) {
    S.cur -= S.copySteps;
    jumped = true;
  }
  const key = S.size.toFixed(3) + "," + S.frame.toFixed(3);
  const relaid = key !== S.key;
  if (relaid) {
    S.key = key;
    layout(S);
  }
  if (jumped && !relaid) S.scroll -= S.period;
  // Keep the cursor's line on the panel: its tallest possible syllable
  // ends two rows above the bottom edge.
  const cs = caretSyl(S);
  S.caret = cs;
  const lineH = ((1 - S.frame) * S.maxH + S.frame * SQ) * S.size;
  const target = cs ? cs.y + lineH - (H - 3) : 0;
  if (relaid || S.first === undefined) S.scroll = target;
  else S.scroll += (target - S.scroll) * (1 - exp(-dt * 5));
  S.first = 1;
}

// ---- Drawing: strokes as distances, one LED wide at Size 1.
function plot(S, p, a, col) {
  if (a <= 0) return;
  if (col[0] * a > S.R[p]) S.R[p] = col[0] * a;
  if (col[1] * a > S.G[p]) S.G[p] = col[1] * a;
  if (col[2] * a > S.B[p]) S.B[p] = col[2] * a;
}
function seg(S, x0, y0, x1, y1, hw, col) {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
  const xa = max(0, floor(min(x0, x1) - hw - 1)), xb = min(W - 1, floor(max(x0, x1) + hw + 1));
  const ya = max(0, floor(min(y0, y1) - hw - 1)), yb = min(H - 1, floor(max(y0, y1) + hw + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x - x0, py = y - y0, t = L ? cl((px * dx + py * dy) / L, 0, 1) : 0;
      const ex = px - t * dx, ey = py - t * dy;
      plot(S, y * W + x, cl(hw + 0.5 - sqrt(ex * ex + ey * ey), 0, 1), col);
    }
}
// An ellipse ring; the distance to it is taken to first order.
function ring(S, cx, cy, rx, ry, hw, col) {
  for (let y = max(0, floor(cy - ry - hw - 1)); y <= min(H - 1, cy + ry + hw + 1); y++)
    for (let x = max(0, floor(cx - rx - hw - 1)); x <= min(W - 1, cx + rx + hw + 1); x++) {
      const u = (x - cx) / rx, v = (y - cy) / ry, k = sqrt(u * u + v * v);
      const g = sqrt((u / rx) ** 2 + (v / ry) ** 2);
      const d = g > 1e-6 ? (k * k - k) / g : min(rx, ry);
      plot(S, y * W + x, cl(hw + 0.5 - abs(d), 0, 1), col);
    }
}

export function draw(display, params) {
  if (!params.s || !params.s.lines) return;
  const S = params.s, sc = S.size, f = S.frame, hw = 0.5 + 0.35 * (sc - 1);
  S.R.fill(0);
  S.G.fill(0);
  S.B.fill(0);
  const ink = hsv(S.hue + 0.93, 0.42, 0.9).map((v) => v * 255);
  const hot = hsv(S.hue + 0.88, 0.85, 1).map((v) => v * 255);
  const guide = hsv(S.hue + 0.5, 0.7, 0.2).map((v) => v * 255);
  const lineH = ((1 - f) * S.maxH + f * SQ) * sc;
  const top = S.scroll;
  // The hanging lines: where each line's typed text ends.
  const ends = new Map();
  for (const tk of S.list) {
    if (tk.t !== "word") continue;
    for (const s of tk.syl) {
      if (s.step > S.cur) break;
      const y = s.y - top;
      if (y + lineH < 0 || y > H) continue;
      ends.set(s.line, [y, max(ends.get(s.line)?.[1] ?? 0, s.x + s.w)]);
      const typed = min(s.n, floor(S.cur - s.step) + 1);
      // The box this much of the syllable fills, and the stretch that puts
      // it in the square: none at Frame 0, all of it at 1.
      const [bw, bh] = s.ext[typed - 1];
      const fx = (1 - f + (f * SQ) / bw) * sc, fy = (1 - f + (f * SQ) / bh) * sc;
      const ox = round(s.x), oy = round(y);
      for (let j = 0; j < typed; j++) {
        const age = S.cur - s.step - j;
        const glow = exp(-age / 4);
        const col = ink.map((v, i) => v + (hot[i] - v) * glow);
        for (const st of s.parts[j]) {
          if (st.length === 5) ring(S, ox + round(st[0] * fx * 2) / 2, oy + round(st[1] * fy * 2) / 2, st[2] * fx, st[2] * fy, hw, col);
          else
            for (let i = 0; i + 3 < st.length; i += 2)
              seg(S, ox + round(st[i] * fx), oy + round(st[i + 1] * fy), ox + round(st[i + 2] * fx), oy + round(st[i + 3] * fy), hw, col);
        }
      }
    }
  }
  // The guide: the top line every syllable hangs from, fading out toward
  // the square, where a bottom line fades in.
  for (const [, [y, xe]] of ends) {
    const yt = round(y) - 2, yb = round(y + SQ * sc) + 1;
    for (let x = MARGIN; x < min(W, xe); x++) {
      if (yt >= 0 && yt < H) plot(S, yt * W + x, 1 - 0.6 * f, guide);
      if (f > 0 && yb >= 0 && yb < H) plot(S, yb * W + x, f, guide);
    }
  }
  // The caret: the slot being typed, lit on its hanging line.
  const c = S.caret;
  if (c) {
    const on = 0.55 + 0.45 * Math.cos(S.blink * 7);
    const y = round(c.y - top) - 2;
    if (y >= 0 && y < H) for (let x = round(c.x); x < min(W, c.x + c.w); x++) plot(S, y * W + x, on, hot);
  }
  for (let p = 0; p < W * H; p++) {
    if (S.R[p] + S.G[p] + S.B[p] < 1) continue;
    display.setPixel(p % W, floor(p / W), min(255, S.R[p]) | 0, min(255, S.G[p]) | 0, min(255, S.B[p]) | 0);
  }
}
