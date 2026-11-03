// ===== Patternflow pattern =====
// Title:   Liang Hyphenation
// Family:  type
// Idea:    TeX's hyphenation worked as a machine down the tall panel: a word stands letter under letter on a card at the left, the patterns that match it slide in as slips beside the letters they match with their digits in the gaps between, a scan takes the largest digit in each gap into the word, the odd ones turn into hyphens and the even ones go out, and the word flies apart into short lines broken where the hyphens fell.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hyphenation by competing patterns (Franklin Liang, Word Hy-phen-a-tion by Com-put-er, Stanford PhD thesis, 1983), the hyphenation example of The TeXbook, Appendix H (Donald Knuth, 1984); the patterns for the other four words and the 3 by 5 letters drawn for this pattern; pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..5, Levels=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the letters are ice blue on slate-blue cards, odd digits (a break allowed) gold and even digits (a break forbidden) violet, and the hyphens gold; at 0.5 the letters are pink, odd digits blue and even digits green.
// Knob 2: Speed. At 2 a slip lands every 0.38 s, the scan reads a gap every 0.22 s, and the broken word is held 2.6 s: "hyphenation", nine slips and ten gaps, takes 12.3 s from first letter to fade, the shorter words 9.9 to 10.6 s. Every time goes as 2 / Speed.
// Knob 3: Word. At 0 the words come in turn: hyphenation, typography, algorithm, character, alphabet. 1 to 5 holds one of them and works it again and again.
// Knob 4: Levels. Peels Liang's levels off from the top. Below 0.2 all five count and hyphenation comes out hy-phen-ation. From 0.2 the level 5 slip (hen5at) goes dark and the word is hy-phenation; from 0.4 level 4 goes too, hy-phena-tion; from 0.6 level 3, hyphena-tion; from 0.8 only level 1 is left, hyphe-na-tion. The other words have levels up to 2 or 3, so only the top of the range changes them: typography goes to ty-po-gra-phy, alphabet to al-pha-be-t.

const W = 64, H = 128;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ramp = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
const ease = (u) => u * u * (3 - 2 * u);
const out3 = (u) => 1 - (1 - u) ** 3;

// Lowercase on a 3 by 5 grid: row 0 holds ascenders and x-height is rows 1
// to 4. With the letters stacked there is no baseline to keep, so g, p and y
// stand a row higher to fit their tails. Digits 0 to 5 and the hyphen.
const FONT = {
  a: ["...", ".##", "#.#", "#.#", ".##"], b: ["#..", "##.", "#.#", "#.#", "##."],
  c: ["...", ".##", "#..", "#..", ".##"], e: ["...", ".##", "###", "#..", ".##"],
  g: [".##", "#.#", ".##", "..#", "##."], h: ["#..", "##.", "#.#", "#.#", "#.#"],
  i: [".#.", "...", ".#.", ".#.", ".#."], l: ["##.", ".#.", ".#.", ".#.", ".##"],
  m: ["...", "#.#", "###", "#.#", "#.#"], n: ["...", "##.", "#.#", "#.#", "#.#"],
  o: ["...", ".#.", "#.#", "#.#", ".#."], p: ["##.", "#.#", "##.", "#..", "#.."],
  r: ["...", "#.#", "##.", "#..", "#.."], t: [".#.", "###", ".#.", ".#.", ".##"],
  y: ["#.#", "#.#", ".##", "..#", "##."],
  0: ["###", "#.#", "#.#", "#.#", "###"], 1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["##.", "..#", ".#.", "#..", "###"], 3: ["##.", "..#", ".#.", "..#", "##."],
  4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "##.", "..#", "##."],
  "-": ["...", "...", "###", "...", "..."],
};
const DESC = "gpy";
const GL = {};
for (const [k, rows] of Object.entries(FONT)) {
  const px = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === "#" && px.push(x, y)));
  GL[k] = px;
}

// Liang's patterns: letters with a digit in some gaps. Where a pattern
// matches a word its digits go into the word's gaps, each gap keeps the
// largest digit any pattern gives it, and an odd digit is a hyphen. Odd
// digits allow a break, even ones forbid it, and a higher level overrides
// a lower one, so later levels mend the errors of earlier ones.
// The nine for "hyphenation" are the TeXbook's example (Appendix H), which
// gives h0y3p0h0e2n5a4t2i0o2n, hy-phen-ation. The rest were written for this
// pattern in the same form, not taken from TeX's hyph.tex: each makes its
// word come out as a dictionary breaks it, and none matches another word.
const PATTERNS = [
  "hy3ph", "he2n", "hena4", "hen5at", "1na", "n2at", "1tio", "2io", "o2n",
  "ty1p", "o1g", "po2g", "g3r", "1phy",
  "l1g", "o1r", "i1t", "2th",
  "a1r", "ar1a", "ha2r", "1ter",
  "l1p", "1pha", "1be", "e1t", "be2t",
].map((p) => {
  const L = [], D = [0];
  for (const ch of p) {
    if (ch >= "0" && ch <= "9") D[D.length - 1] = +ch;
    else { L.push(ch); D.push(0); }
  }
  return { L: L.join(""), D, lev: max(...D) };
});
const WORDS = ["hyphenation", "typography", "algorithm", "character", "alphabet"];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// One word's machine: its matches, where everything sits, and when.
function build(wi) {
  const w = WORDS[wi], L = w.length;
  const ms = [];
  for (const p of PATTERNS)
    for (let o = 0; o + p.L.length <= L; o++) if (w.substr(o, p.L.length) === p.L) ms.push({ p, o });
  ms.sort((a, b) => a.o - b.o || a.p.L.length - b.p.L.length);
  const n = ms.length;
  // Letter pitch down the panel, the top of the word and the digit row in a gap.
  const V = cl(floor(123 / (L - 1)), 12, 15), y0 = floor((H - (V * (L - 1) + 5)) / 2), dy = 5 + floor((V - 10) / 2);
  // Slip pitch across, and the left edge of the first slip.
  const pp = min(8, floor(55 / n)), sx0 = 10 + floor((54 - (pp * n - 1)) / 2);
  ms.forEach((m, i) => {
    m.x = sx0 + pp * i + 1;
    m.a = 0.7 + 0.38 * i;
    m.gaps = [];
    m.p.D.forEach((d, j) => d && m.gaps.push({ g: m.o + j - 1, d }));
    const top = min(y0 + V * m.o, ...m.gaps.map((q) => y0 + V * q.g + dy));
    const bot = max(y0 + V * (m.o + m.p.L.length - 1) + 4, ...m.gaps.map((q) => y0 + V * q.g + dy + 4));
    m.top = top - 2;
    m.bot = bot + 2;
  });
  const tScan = ms[n - 1].a + 0.95, gs = 0.22;
  const tPar = tScan + gs * (L - 1) + 0.3, tRes = tPar + 0.9, tFade = tRes + 3.5;
  return { wi, w, L, ms, n, V, y0, dy, tScan, gs, tPar, tRes, tFade, tEnd: tFade + 0.7 };
}

// The largest digit each gap gets from the patterns at or below the level
// cap, and which slip gave it.
function maxima(M, cap) {
  const v = new Array(M.L - 1).fill(0), who = new Array(M.L - 1).fill(-1);
  M.ms.forEach((m, i) => {
    if (m.p.lev > cap) return;
    for (const q of m.gaps) if (q.g >= 0 && q.g < M.L - 1 && q.d > v[q.g]) { v[q.g] = q.d; who[q.g] = i; }
  });
  return { v, who };
}

// The broken word: lines of letters, a hyphen ending all but the last,
// centred on the panel.
function lines(M, v) {
  const rows = [[]];
  for (let i = 0; i < M.L; i++) {
    rows[rows.length - 1].push({ ch: M.w[i], i });
    if (i < M.L - 1 && v[i] % 2) { rows[rows.length - 1].push({ ch: "-", g: i }); rows.push([]); }
  }
  // The largest of 3, 2 and 1 times that fits the panel.
  const long = max(...rows.map((r) => r.length));
  let s = 3;
  while (s > 1 && (long * 4 * s - s > W - 4 || rows.length * 7 * s > H - 8)) s--;
  const cp = 4 * s, lp = 7 * s;
  const wmax = max(...rows.map((r) => r.length * cp - s));
  const x0 = floor((W - wmax) / 2), yT = floor((H - (rows.length * lp - 2 * s)) / 2);
  const at = [];
  rows.forEach((r, k) => r.forEach((c, j) => at.push({ ...c, x: x0 + j * cp, y: yT + k * lp, s })));
  return at;
}

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, word: 0, cap: 5, M: null, buf: new Float32Array(W * H * 3), next: 0 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.word = round(cl(k[2] || 0, 0, 5));
  S.cap = 5 - min(4, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 5));
  const want = S.word > 0 ? S.word - 1 : -1;
  if (!S.M) {
    // The first word opens with every slip in place, just before the scan.
    S.M = build(want >= 0 ? want : 0);
    S.next = S.M.wi + 1;
    S.t = S.M.tScan - 0.6;
  }
  S.t += (d * S.speed) / 2;
  if (S.t >= S.M.tEnd) {
    const wi = want >= 0 ? want : S.next % WORDS.length;
    S.next = wi + 1;
    S.M = build(wi);
    S.t = 0;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.M) return;
  const M = S.M, t = S.t, buf = S.buf, { L, V, y0, dy, ms, gs } = M;
  buf.fill(0);
  const add = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const i = (y * W + x) * 3;
    buf[i] += c[0] * a; buf[i + 1] += c[1] * a; buf[i + 2] += c[2] * a;
  };
  // A glyph at any position and scale: each of its pixels is a square of
  // side s, spread over the LEDs it covers by area.
  const glyph = (ch, x, y, s, c, a) => {
    const px = GL[ch];
    if (!px || a <= 0.003) return;
    for (let p = 0; p < px.length; p += 2) {
      const ax = x + px[p] * s, ay = y + px[p + 1] * s, bx = ax + s, by = ay + s;
      for (let yy = floor(ay); yy < by; yy++) {
        const oy = min(by, yy + 1) - max(ay, yy);
        if (oy <= 0) continue;
        for (let xx = floor(ax); xx < bx; xx++) {
          const ox = min(bx, xx + 1) - max(ax, xx);
          if (ox > 0) add(xx, yy, c, a * ox * oy);
        }
      }
    }
  };
  const rect = (x0, y0r, x1, y1, c, a) => {
    for (let y = y0r; y <= y1; y++) for (let x = x0; x <= x1; x++) add(x, y, c, a);
  };
  const h = S.hue;
  const ice = hsv(h + 0.52, 0.35, 1), odd = hsv(h + 0.13, 0.8, 1), even = hsv(h + 0.75, 0.6, 1);
  const slip = hsv(h + 0.58, 0.45, 1), grey = [0.55, 0.55, 0.55], white = [1, 1, 1];
  const dcol = (d) => (d % 2 ? odd : even);
  const { v, who } = maxima(M, S.cap);
  const WX = 3;
  const fadeAll = 1 - ramp(t, M.tFade, M.tFade + 0.5);
  const gy = (g) => y0 + V * g + dy;
  const res = t >= M.tRes ? lines(M, v) : null;
  const fly = res ? ease(ramp(t, M.tRes, M.tRes + 0.9)) : 0;

  // The word's card, gone once the word flies.
  const cardA = 1 - ramp(t, M.tRes, M.tRes + 0.4);
  rect(WX - 2, y0 - 2, WX + 4, y0 + V * (L - 1) + 6, slip, 0.26 * cardA);

  // The slips: slide in from the right, dimmed when their level is peeled,
  // and drift off and fade once the hyphens are set.
  ms.forEach((m, i) => {
    const u = out3(ramp(t, m.a, m.a + 0.45));
    if (u <= 0) return;
    const leave = ramp(t, M.tPar + 0.4 + 0.04 * i, M.tPar + 0.9 + 0.04 * i);
    if (leave >= 1) return;
    const x = round(m.x + (1 - u) * (W + 2 - m.x) + 8 * leave * leave);
    const live = m.p.lev <= S.cap, la = (1 - 0.75 * ramp(t, M.tPar, M.tPar + 0.4)) * (1 - leave);
    rect(x - 1, m.top, x + 3, m.bot, slip, (live ? 0.2 : 0.03) * la);
    const land = t - (m.a + 0.45);
    const flash = land > 0 ? exp(-land / 0.18) : 0;
    for (let j = 0; j < m.p.L.length; j++) glyph(m.p.L[j], x, y0 + V * (m.o + j), 1, live ? ice : grey, (live ? 0.75 : 0.25) * la + 0.6 * flash);
    for (const q of m.gaps) {
      // In the scan, the digit that wins its gap flashes white and the
      // others in that row dim.
      const tg = M.tScan + gs * q.g;
      let a = live ? 1 : 0.3;
      if (t > tg) a *= who[q.g] === i ? 1 : 0.45;
      const win = who[q.g] === i ? ramp(t, tg, tg + 0.05) * (1 - ramp(t, tg + 0.18, tg + 0.4)) : 0;
      glyph(String(q.d), x, gy(q.g), 1, live ? dcol(q.d) : grey, a * la + 0.8 * flash);
      if (win > 0) glyph(String(q.d), x, gy(q.g), 1, white, 0.7 * win);
    }
    // A slip that lands lights the letters it matched.
    if (flash > 0.02)
      for (let j = 0; j < m.p.L.length; j++) glyph(M.w[m.o + j], WX, y0 + V * (m.o + j), 1, live ? odd : grey, 0.5 * flash * cardA);
  });

  // The scan: a faint bar along the gap row, and the winning digit's copy
  // flying left into the word's gap.
  for (let g = 0; g < L - 1; g++) {
    const tg = M.tScan + gs * g, bar = ramp(t, tg - 0.05, tg + 0.05) * (1 - ramp(t, tg + 0.15, tg + 0.35));
    if (bar > 0) {
      rect(WX - 2, gy(g) - 1, W - 1, gy(g) + 5, white, 0.07 * bar);
      for (let x = WX + 5; x < W; x++) add(x, gy(g) + 2, white, 0.12 * bar);
    }
    if (t < tg) continue;
    const d = v[g], c = d ? dcol(d) : grey;
    const src = who[g] >= 0 ? ms[who[g]].x : WX + 6;
    const u = ease(ramp(t, tg + 0.04, tg + 0.24));
    const parity = ramp(t, M.tPar + 0.05 * g, M.tPar + 0.05 * g + 0.35);
    if (u < 1) { glyph(String(d), src + (WX - src) * u, gy(g), 1, c, d ? 1 : 0.4); continue; }
    if (d % 2 === 0) {
      glyph(String(d), WX, gy(g), 1, c, (d ? 1 : 0.4) * (1 - parity) * cardA);
      continue;
    }
    // Odd: the digit turns into a hyphen with a flash, and the hyphen flies
    // with the letters.
    if (parity < 1) glyph(String(d), WX, gy(g), 1, c, 1 - parity);
    const fl = t > M.tPar ? exp(-((t - (M.tPar + 0.05 * g + 0.2)) ** 2) / 0.02) : 0;
    let hx = WX, hy = gy(g), hs = 1;
    if (res) {
      const r = res.find((q) => q.g === g);
      if (r) { hx += (r.x - hx) * fly; hy += (r.y - hy) * fly; hs += (r.s - 1) * fly; }
    }
    glyph("-", hx, hy, hs, odd, parity * fadeAll);
    if (fl > 0.02) glyph("-", hx, hy, hs, white, 0.8 * fl);
  }

  // The word's letters: written top to bottom, then flown into the lines.
  for (let i = 0; i < L; i++) {
    const ap = ramp(t, 0.06 * i, 0.06 * i + 0.12);
    let x = WX, y = y0 + V * i, s = 1;
    if (res) {
      // In a line there is a baseline again, and g, p and y drop below it.
      const r = res.find((q) => q.i === i), ry = r.y + (DESC.includes(M.w[i]) ? r.s : 0);
      x += (r.x - x) * fly; y += (ry - y) * fly; s += (r.s - 1) * fly;
    }
    glyph(M.w[i], x, y, s, ice, ap * fadeAll);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, min(255, round(buf[i] * 255)), min(255, round(buf[i + 1] * 255)), min(255, round(buf[i + 2] * 255)));
    }
}
