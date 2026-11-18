// ===== Patternflow pattern =====
// Title:   Blackout Poem
// Family:  type
// Idea:    A page of old-fashioned prose fills the panel in a 3 by 5 pixel face, 15 letters to a line, and ink bars sweep line by line across it and black out nearly every word, leaving eight that glow gold as a short poem, and a thin white river of light winds from one surviving word to the next down the page through the ink before the ink draws back and the same page keeps another poem.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: blackout poetry (Tom Phillips, A Humument, 1966, painted over W. H. Mallock's A Human Document, 1892, with the rivers of white that join its words); a page of prose written for this pattern; the 3 by 5 capitals of Saccades (pattern round 106) by way of kasiski-examination.js; pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Poem=0..2, Spared=0..0.5
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the page is deep blue with pale blue words, the words that stay are gold and the river is pale gold.
// Knob 2: Speed. How fast the ink comes. At 2 the first bar starts at 0.12 s, a line is inked in under a second and the last one is done by 2.6 s, each word of the poem lights as its line is finished, the river winds through the page from about 2.9 s for 3 to 4 s, and the page holds for 3 s before the ink draws back, so a poem lasts 10.5 to 12 s. 0.5 is four times slower and 4 is twice as fast.
// Knob 3: Poem. Which of three poems the page keeps, 0, 1 or 2, each made of 8 of its 61 words. It catches at whole numbers, and when a poem has been held the ink draws back and the next one is picked, so the page runs on through all three. 0 reads LAMP LIT HOUSE STILL, NO ONE CAME. TIDE. and 1 reads SHE SAT OLD CLOCK COUNTED THE LAST LEAVES and 2 reads DARK SEA. HOURS, WIND DAWN, HIS NAME DUST.
// Knob 4: Spared. The share of the 53 other words that the ink leaves alone, from 0, where every word outside the poem goes under, to 0.5, where 27 of them are left to be read among the gold ones. It opens at 0.06, with 3 left.

const W = 64, H = 128, NP = W * H;
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

// A hash of an integer to 0..1.
function hash(n) {
  let h = (n | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The face: capitals 3 wide and 5 tall from saccades.js by way of kasiski-examination.js, and the two stops.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  ".": "...|...|...|...|.#.", ",": "...|...|...|.#.|#..",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// The page, 61 words. A word marked ~0, ~1 or ~2 stays when that poem is the one
// kept; the poems read down the page in the order the words stand in it:
//   0  LAMP LIT HOUSE STILL, NO ONE CAME. TIDE.
//   1  SHE SAT OLD CLOCK COUNTED THE LAST LEAVES
//   2  DARK SEA. HOURS, WIND DAWN, HIS NAME DUST
const PAGE =
  "WHEN THE LAMP~0 WAS LIT~0 AND THE HOUSE~0 WAS STILL,~0 SHE~1 SAT~1 BY THE WINDOW AND WATCHED THE DARK~2 SEA.~2 NO~0 ONE~0 CAME.~0 " +
  "THE OLD~1 CLOCK~1 IN THE HALL COUNTED~1 THE HOURS,~2 AND THE WIND~2 TOOK THE~1 LAST~1 LEAVES~1 FROM THE ELM. " +
  "AT DAWN,~2 SHE WROTE HIS~2 NAME~2 IN THE DUST~2 OF THE GLASS, AND WENT OUT TO MEET THE TIDE.~0";
const NPOEM = 3, COLS = 15, X0 = 2, Y0 = 2, PITCH = 6;

// Lay the page out: greedy lines of 15 letters, 4 LEDs a letter, 6 rows a line.
function layout() {
  const tok = [];
  let line = 0, col = 0;
  for (const raw of PAGE.trim().split(/\s+/)) {
    const m = raw.match(/^([A-Z.,]+)(?:~(\d+))?$/), s = m[1];
    let mask = 0;
    if (m[2]) for (const d of m[2]) mask |= 1 << +d;
    if (col > 0 && col + 1 + s.length > COLS) {
      line++;
      col = 0;
    }
    if (col > 0) col++;
    tok.push({ s, mask, line, x: X0 + col * 4, y: Y0 + line * PITCH, w: s.length * 4 - 1, idx: tok.length });
    col += s.length;
  }
  return { tok, lines: line + 1 };
}

// The ink for one poem: for every line the runs of words that are neither in the
// poem nor spared, each a rectangle from two LEDs beyond the word before it to two
// LEDs short of the word after it, or to the edge of the panel at either end of
// the line. A pen goes along each line, left to right on the even ones and right
// to left on the odd, at 75 LEDs a second, skipping what it does not ink.
const PEN = 75;
function plan(S) {
  const { tok, lines } = S.page, poem = S.poem, bars = [], surv = [];
  // The words that are not in the poem, in an order of their own for each poem; the first
  // Spared share of them are left alone and the rest are inked.
  const state = tok.map((t) => (t.mask & (1 << poem) ? 1 : 0));
  const rest = tok.filter((t) => state[t.idx] === 0).map((t) => [hash(t.idx * 7 + poem * 131 + 5), t.idx]).sort((a, b) => a[0] - b[0]);
  for (let k = 0; k < round(S.spared * rest.length); k++) state[rest[k][1]] = 2;
  let tEnd = 1.2;
  const lineEnd = new Float64Array(lines).fill(-1);
  for (let j = 0; j < lines; j++) {
    const ts = tok.filter((t) => t.line === j), runs = [];
    for (let i = 0; i < ts.length; i++) {
      if (state[ts[i].idx] !== 0) continue;
      let k = i;
      while (k + 1 < ts.length && state[ts[k + 1].idx] === 0) k++;
      const left = i === 0 ? 1 : ts[i - 1].x + ts[i - 1].w + 2, right = k === ts.length - 1 ? W - 2 : ts[k + 1].x - 3;
      runs.push({ x0: left, x1: right, y: ts[0].y, line: j });
      i = k;
    }
    // a word that stands at the end of its line leaves blank paper after it, and the ink goes there too
    const lt = ts[ts.length - 1];
    if (state[lt.idx] !== 0 && lt.x + lt.w + 2 < W - 2) runs.push({ x0: lt.x + lt.w + 2, x1: W - 2, y: ts[0].y, line: j });
    const dir = j % 2 ? -1 : 1;
    if (dir < 0) runs.reverse();
    let t = 0.12 + 0.085 * j;
    const speed = PEN * (0.9 + 0.2 * hash(j * 31 + poem));
    for (const r of runs) {
      r.dir = dir;
      r.t0 = t;
      r.dur = (r.x1 - r.x0 + 1) / speed;
      t += r.dur;
      bars.push(r);
    }
    lineEnd[j] = runs.length ? t : 0.12 + 0.085 * j + 0.3;
    tEnd = max(tEnd, lineEnd[j]);
  }
  for (const t of tok) if (state[t.idx] === 1) surv.push({ t, ign: lineEnd[t.line] + 0.06 });
  // The river: from each surviving word down to the next. On one line it is a straight run
  // between them. Between lines it drops from just after the word to the first row under its
  // line, wanders down the free rows between the two lines to the row above the next word, at
  // the column just before it, and drops to the word's row. No other word of the poem stands in
  // any of those rows, so the river never touches one.
  const path = [];
  const step = (x, y) => {
    x = round(x);
    y = round(y);
    const n = path.length;
    if (n && path[n - 1][0] === x && path[n - 1][1] === y) return;
    path.push([x, y]);
  };
  const line = (x0, y0, x1, y1) => {
    const n = max(abs(x1 - x0), abs(y1 - y0));
    for (let i = 0; i <= n; i++) step(x0 + (n ? ((x1 - x0) * i) / n : 0), y0 + (n ? ((y1 - y0) * i) / n : 0));
  };
  const meander = (x0, y0, x1, y1, seed) => {
    const n = (y1 - y0) * 3, amp = 1.5 + 2.5 * hash(seed), waves = 1 + floor((y1 - y0) / 24);
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = cl(x0 + (x1 - x0) * sm(t) + amp * sin(PI * t) * sin(2 * PI * waves * t), 1, W - 2), y = y0 + (y1 - y0) * t;
      line(px, py, x, y);
      px = round(x);
      py = round(y);
    }
  };
  let first = true;
  for (let i = 0; i < surv.length; i++) {
    const t = surv[i].t, yc = t.y + 2, xin = t.x - 2;
    if (first) {
      line(max(0, xin - 6), yc, xin, yc);
      first = false;
    } else {
      const p = surv[i - 1].t, xo = p.x + p.w + 1;
      if (p.line === t.line) line(xo, yc, xin, yc);
      else {
        const ga = p.y + 5, gb = t.y - 1;
        line(xo, p.y + 2, xo, ga);
        if (gb - ga >= 4) meander(xo, ga, xin, gb, i * 17 + poem);
        else line(xo, ga, xin, gb);
        line(xin, gb, xin, yc);
      }
    }
    // the river stops at the in port, one LED short of the word, and starts again at the out port
    surv[i].rin = path.length - 1;
  }
  const last = surv[surv.length - 1].t;
  line(last.x + last.w + 1, last.y + 2, min(W - 1, last.x + last.w + 7), last.y + 2);
  S.bars = bars;
  S.surv = surv;
  S.path = path;
  S.state = state;
  S.tInk = tEnd;
  S.tR0 = tEnd + 0.25;
  S.tRiv = path.length / 70;
  S.tHold = S.tR0 + S.tRiv;
  S.tRet = S.tHold + 3.0;
  S.tCycle = S.tRet + 0.55 + 0.04 * lines + 0.6;
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, poem: 0, spared: 0.06, adv: 0, base: -1, sig: "", tau: 0, clock: 0, page: layout(), bars: [], surv: [], path: [], state: [], buf: new Uint8Array(NP * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  const base = cl(round(k[2]), 0, NPOEM - 1);
  S.spared = round(cl(k[3], 0, 0.5) * 50) / 50;
  if (base !== S.base) {
    S.base = base;
    S.adv = 0;
    S.tau = 0;
  }
  S.poem = (S.base + S.adv) % NPOEM;
  const sig = S.poem + "," + S.spared;
  if (sig !== S.sig) {
    S.sig = sig;
    plan(S);
  }
  S.tau += (d * S.speed) / 2;
  S.clock += d;
  if (S.tau > S.tCycle) {
    S.tau = 0;
    S.adv++;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.bars) return;
  const buf = S.buf, tau = S.tau, h = S.hue + 0.5, hs = S.hue + 0.11;
  const PAPER = [0, 0, 0], TEXT = [0, 0, 0], GOLD = [0, 0, 0], RIVER = [0, 0, 0];
  hsv(h + 0.08, 0.85, 0.42, PAPER);
  hsv(h + 0.04, 0.4, 0.68, TEXT);
  hsv(hs, 0.62, 1, GOLD);
  hsv(hs, 0.16, 1, RIVER);
  const frame = floor(S.clock * 8);
  for (let p = 0; p < NP; p++) {
    const g = 0.8 + 0.4 * hash(p + frame * 8192);
    buf[p * 3] = PAPER[0] * g * 255;
    buf[p * 3 + 1] = PAPER[1] * g * 255;
    buf[p * 3 + 2] = PAPER[2] * g * 255;
  }
  const put = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = r * 255;
    buf[o + 1] = g * 255;
    buf[o + 2] = b * 255;
  };
  const glyph = (t, ch, i, r, g, b) => {
    const gl = GLYPH[ch];
    for (let k = 0; k < 15; k++) if (gl[k]) put(t.x + i * 4 + (k % 3), t.y + floor(k / 3), r, g, b);
  };
  // The page, every word dim.
  for (const t of S.page.tok) for (let i = 0; i < t.s.length; i++) glyph(t, t.s[i], i, TEXT[0], TEXT[1], TEXT[2]);
  // The ink. A bar grows along its pen's direction while the pen is on it and draws back at the end.
  const tr = tau - S.tRet;
  for (const b of S.bars) {
    const grow = cl((tau - b.t0) / b.dur, 0, 1), back = tr > 0 ? cl((tr - 0.04 * b.line) / 0.55, 0, 1) : 0, f = grow * (1 - back);
    if (f <= 0) continue;
    const len = b.x1 - b.x0 + 1, n = round(len * f);
    const xa = b.dir > 0 ? b.x0 : b.x1 - n + 1, xb = b.dir > 0 ? b.x0 + n - 1 : b.x1;
    for (let x = xa; x <= xb; x++) {
      const top = b.y - (hash(x * 7 + b.line * 977) < 0.14 ? 1 : 0), bot = b.y + 4 + (hash(x * 13 + b.line * 571 + 3) < 0.14 ? 1 : 0);
      for (let y = top; y <= bot; y++) {
        const wet = (b.dir > 0 ? x === xb : x === xa) && f < 1;
        const gl = hash(x + y * 64 + frame * 8192 + 77) < 0.035 ? 0.11 : 0;
        put(x, y, wet ? PAPER[0] * 1.6 : PAPER[0] * gl * 3, wet ? PAPER[1] * 1.6 : PAPER[1] * gl * 3, wet ? PAPER[2] * 1.6 : PAPER[2] * gl * 3);
      }
    }
  }
  // The poem: each word lights as its line is inked and fades back when the ink draws back.
  const path = S.path, rv = (tau - S.tR0) * 70, fadeOut = 1 - sm(tr / 0.5);
  for (const s of S.surv) {
    const a = sm((tau - s.ign) / 0.35) * fadeOut;
    if (a <= 0) continue;
    const pass = tau >= S.tR0 ? tau - S.tR0 - s.rin / 70 : -1, fl = pass >= 0 ? exp(-pass / 0.45) * 0.55 : 0;
    const k = a, r = min(1, TEXT[0] + (GOLD[0] - TEXT[0]) * k + fl), g = min(1, TEXT[1] + (GOLD[1] - TEXT[1]) * k + fl), bl = min(1, TEXT[2] + (GOLD[2] - TEXT[2]) * k + fl);
    const t = s.t;
    for (let i = 0; i < t.s.length; i++) {
      const gl = GLYPH[t.s[i]];
      for (let q = 0; q < 15; q++) {
        const x = t.x + i * 4 + (q % 3), y = t.y + floor(q / 3);
        if (gl[q]) put(x, y, r, g, bl);
        else if (a > 0.3) {
          // a halo one LED wide round the lit strokes
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
            const qx = q % 3 + dx, qy = floor(q / 3) + dy;
            if (qx >= 0 && qx < 3 && qy >= 0 && qy < 5 && gl[qy * 3 + qx]) near = true;
          }
          if (near) {
            const o = (y * W + x) * 3, w = 0.2 * a;
            buf[o] = max(buf[o], GOLD[0] * w * 255);
            buf[o + 1] = max(buf[o + 1], GOLD[1] * w * 255);
            buf[o + 2] = max(buf[o + 2], GOLD[2] * w * 255);
          }
        }
      }
    }
  }
  // The river: it threads the path from the first word to the last, then a bead of light runs along it.
  if (rv > 0 && fadeOut > 0) {
    const n = path.length, head = min(n - 1, rv), bead = tau > S.tHold ? ((tau - S.tHold) * 60) % (n + 40) : -99;
    for (let i = 0; i <= head; i++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = path[i][0] + dx, y = path[i][1] + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const o = (y * W + x) * 3, w = 0.16 * fadeOut * 255;
        buf[o] = max(buf[o], RIVER[0] * w);
        buf[o + 1] = max(buf[o + 1], RIVER[1] * w);
        buf[o + 2] = max(buf[o + 2], RIVER[2] * w);
      }
    }
    for (let i = 0; i <= head; i++) {
      const lead = exp(-(head - i) / 6) * (head < n - 1 ? 1 : 0), bd = bead >= i ? exp(-(bead - i) / 10) : 0;
      const k = (0.92 + 0.08 * max(lead, bd)) * fadeOut, w = 0.5 * max(lead, bd) * fadeOut;
      put(path[i][0], path[i][1], min(1, RIVER[0] * k + w), min(1, RIVER[1] * k + w), min(1, RIVER[2] * k + w));
    }
  }
  for (let p = 0; p < NP; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
