// ===== Patternflow pattern =====
// Title:   Textura Minims
// Family:  type
// Idea:    The minim sentence of the scribes is written in textura quadrata on eleven lines down the standing panel, every i, m, n, u and v built from one identical stroke, a stem with a lozenge head and a lozenge foot, so the page is a picket fence of 134 strokes on a 4-LED grid where no letter can be told from its neighbour, and a reading light passes word by word: under it the strokes inside each letter close up so the letters stand apart, they turn white and sky blue in turn, the hairline joins at the top of n and m and the foot of u come in and every i gets its stroke, the words already read keep their joins faintly until the page rests, and the morph knob turns the whole page from that fence into a roman lowercase where every word reads without the light.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: textura quadrata, the blackletter of the 13th to 15th centuries, its minim stroke with lozenge head and foot, and the hairline over i, later the dot, that scribes added to tell i among the minims; the sentence mimi numinum niveum minimi munium nimium vini muniminum imminui vivi minimum volunt, the traditional example of minims, told as a scribes' joke, its first writer and date unknown, public domain; textura and roman lowercase drawn for this pattern as boxes, lozenges and round-ended strokes; pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Weight=-1..1, Morph=0..1
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 the page is a pale azure, the word being read white and sky blue letter by letter, its joins and i strokes rose; at 0.25 the page is violet with gold joins, at 0.5 pink with green ones, at 0.75 green with violet ones. Between 0.537 and 0.538 it steps over red, orange and yellow, which read brown in an ink this dim.
// Knob 2: Speed. At 2 the light stays 0.3 s on a word and 0.05 s more for each of its minims, 1.05 s on minimum and 1.25 s on muniminum, and glides 0.25 s to the next, so the twelve words take 13.3 s; the page then rests 1.6 s while the read words lose their joins, and the light starts again from mimi, 15.3 s a reading. Everything goes as Speed / 2, ten times slower at 0.2.
// Knob 3: Weight. The stem width on the 4-LED grid: 2 LEDs at the opening 0, the textura ideal where the white inside a letter is as wide as the stroke; 1.2 at -1, a light open fence; 2.8 at 1, where the gaps close to 1.2 LEDs and the page goes nearly solid, a woven cloth.
// Knob 4: Morph. From textura at 0 to a roman lowercase at 1 on the same stems: the lozenges shrink to nothing as flat serifs grow from the same points, the hairline joins swell into the round arches of n and m and the bowl of u, the slanted stroke over i becomes a round dot, v opens into two diagonals and e and o round out. The joins and dots come in over the whole page by 0.5, so from there every word reads without the light.

// Textura quadrata is written with a broad pen held at about 45 degrees.
// Its i, m, n and u are made of one stroke, the minim: the pen sets down a
// short diagonal, a lozenge, goes straight down, and ends in a second
// lozenge at the foot. i is one minim, n two, m three, u two. u and v were
// one letter in Latin; here v is a u whose second stroke is thinner and
// stops short of the line, and it counts as two minims. Between the
// minims of n and m runs a hairline from one stem's top to the next one's
// head, and the u's hairline runs from the first foot up to the second
// stem; on the page those hairlines are a fraction of the stem, so the eye
// meets a row of identical posts. In a regular hand the white inside a
// letter is as wide as the white between letters, and both about as wide
// as the stem: that evenness is the weave the name means. Scribes began to
// put a hairline over i, the later dot, to tell it among the posts.
//
// The sentence is the usual example. It has 134 minims among its 72
// letters; minimum alone is fifteen identical strokes, muniminum nineteen.
// setup() counts them from the letters (i 1, n 2, u 2, v 2, m 3) and checks
// those two words, the total and that the page takes eleven lines.
//
// The page is laid out on a grid of 4 LEDs a stroke: a letter is 1, 2 or 3
// strokes wide (t 1.5), a word space is one stroke, and a word that will
// not fit on its line is broken at a syllable with a double hairline
// hyphen. Each letter is a list of shapes with two sets of numbers, one for
// its textura form and one for its roman form, and the morph knob moves
// every number between the two, so a lozenge shrinks to nothing as a serif
// grows out of the same point, and a hairline's points slide out along a
// half circle into an arch. Shapes are boxes, lozenges and round-ended
// strokes, sampled 9 times a LED. The page is drawn once for the knobs, and
// only the words under the light are drawn again each frame.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// The sentence with its syllables marked where a line may break.
const TEXT = "mi-mi nu-mi-num ni-ve-um mi-ni-mi mu-ni-um ni-mi-um vi-ni mu-ni-mi-num im-mi-nu-i vi-vi mi-ni-mum vo-lunt";
const MINIMS = { i: 1, n: 2, u: 2, v: 2, m: 3 };
const ADV = { i: 1, n: 2, u: 2, v: 2, m: 3, e: 2, o: 2, l: 1, t: 1.5, "=": 0.5 };
// The grid: a stroke every 4 LEDs, 16 to a line, eleven lines 11.35 rows
// apart with an x-height of 8 rows; a word space is one stroke, a hyphen
// needs half of one.
const P = 4, COLS = 16, LINES = 11, TOP = 3.3, LEAD = 11.35, XH = 8, HY = 0.5;
// Story seconds at Speed 2: on a word, per minim, the glide, the rest.
const DWELL = 0.3, PER = 0.05, GLIDE = 0.25, REST = 1.6;
// How far a word once read keeps its joins and dots, until the page rests.
const MEMORY = 0.5;
const SS = [1 / 6, 1 / 2, 5 / 6];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Shapes: "b" box [x0, y0, x1, y1], "d" lozenge [cx, cy, rx, ry], "c" a
// round-ended stroke [r, x, y, x, y, ...]; each with its textura numbers a,
// its roman numbers b, and h for the hairlines and dots the light brings in.
const box = (a, b) => ({ k: "b", a, b });
const loz = (a, b) => ({ k: "d", a, b });
const stroke = (ra, pa, rb, pb, h) => ({ k: "c", a: [ra, ...pa.flat()], b: [rb, ...pb.flat()], h: !!h });
const line = (p0, p1, n) => Array.from({ length: n }, (_, i) => [p0[0] + ((p1[0] - p0[0]) * i) / (n - 1), p0[1] + ((p1[1] - p0[1]) * i) / (n - 1)]);
const arc = (cx, cy, rx, ry, t0, t1, n) => Array.from({ length: n }, (_, i) => { const t = t0 + ((t1 - t0) * i) / (n - 1); return [cx + rx * cos(t), cy - ry * sin(t)]; });

// One minim at x: textura from its head tt to the line B, roman from top to
// bot, with roman serifs where asked (st at the top, sf at the foot).
function minim(out, x, T, B, s, o) {
  const a = 0.6 * s, dx = 0.3 * s, rx = 0.9 * s, top = o.top ?? T, bot = o.bot ?? B, tt = o.tt ?? T;
  out.push(box([x, tt + a, x + s, B - a], [x, top, x + s, bot]));
  out.push(loz([x + s / 2 - dx, tt + a, rx, a], [x + s / 2, top + 0.3, 0, 0]));
  out.push(loz([x + s / 2 + dx, B - a, rx, a], [x + s / 2, bot - 0.3, 0, 0]));
  const hx = x + s / 2 - dx, fx = x + s / 2 + dx;
  if (o.st) out.push(box([hx, tt + a, hx, tt + a], [x - 0.5 * s, top, x + s, top + 0.7]));
  if (o.sf) out.push(box([fx, B - a, fx, B - a], [x - 0.4 * s, bot - 0.7, x + s * 1.4, bot]));
}

// A letter's shapes with its first stem's left edge at x and its strokes p
// apart.
function glyph(ch, x, T, B, s, p) {
  const out = [], a = 0.6 * s, R = p / 2, mid = (T + B) / 2, hr = 0.5, ar = 0.42 * s;
  const archJoin = (x0) => out.push(stroke(hr, line([x0 + s, T + a + 1.1], [x0 + p + 0.2, T + a - 0.1], 7), ar, arc(x0 + R + s / 2, T + R, R, R, PI, 0, 7), true));
  const bowlJoin = (x0) => out.push(stroke(hr, line([x0 + 1.6 * s, B - a], [x0 + p + 0.1, B - a - 1.5], 7), ar, arc(x0 + R + s / 2, B - R, R, R, PI, 2 * PI, 7), true));
  if (ch === "i") {
    minim(out, x, T, B, s, { st: 1, sf: 1 });
    out.push(stroke(hr, [[x + s / 2 - 0.5, T - 0.8], [x + s / 2 + 0.8, T - 2.3]], 0.5 * s, [[x + s / 2, T - 2.1], [x + s / 2, T - 2.1]], true));
  } else if (ch === "n" || ch === "m") {
    const k = ch === "n" ? 2 : 3;
    for (let j = 0; j < k; j++) minim(out, x + j * p, T, B, s, { st: j === 0, sf: 1, top: j ? T + R : T });
    for (let j = 0; j < k - 1; j++) archJoin(x + j * p);
  } else if (ch === "u") {
    minim(out, x, T, B, s, { st: 1, bot: B - R });
    minim(out, x + p, T, B, s, { st: 1, sf: 1 });
    bowlJoin(x);
  } else if (ch === "v") {
    const c0 = x + s / 2, c1 = x + p + s / 2, bx = x + R + s / 2;
    out.push(stroke(s / 2, line([c0, T + a], [c0, B - a], 5), 0.5 * s, line([c0 - 0.5, T + 0.6], [bx, B - 0.8], 5)));
    out.push(stroke(0.32 * s, line([c1, T + a], [c1, B - a - 1.2], 5), 0.3 * s, line([c1 + 0.5, T + 0.6], [bx, B - 0.8], 5)));
    out.push(loz([c0 - 0.3 * s, T + a, 0.9 * s, a], [c0 - 0.5, T + 0.6, 0, 0]));
    out.push(loz([c1 - 0.3 * s, T + a, 0.7 * s, a], [c1 + 0.5, T + 0.6, 0, 0]));
    out.push(loz([c0 + 0.3 * s, B - a, 0.9 * s, a], [bx, B - 0.8, 0, 0]));
    out.push(stroke(hr, line([c0 + 0.8 * s, B - a], [c1, B - a - 1.2], 5), 0.3 * s, line([bx, B - 0.8], [bx, B - 0.8], 5), true));
  } else if (ch === "e") {
    const c0 = x + s / 2, E = [x + p + 0.7 * s, T + a + 1.4], cx = x + (p + s) / 2, rx = (p + s) / 2 - 0.6, ry = (B - T) / 2 - 0.6;
    out.push(stroke(s / 2, [E, [x + p / 2 + 0.6 * s, T + 0.9 * a], [c0, T + a], [c0, mid], [c0, B - a], [x + p / 2 + s / 2, B - 0.8 * a], [x + p + 0.6 * s, B - a - 0.9]],
      ar, [0, PI / 3, (2 * PI) / 3, PI, (4 * PI) / 3, (5 * PI) / 3, 1.85 * PI].map((t) => [cx + rx * cos(t), mid - ry * sin(t)])));
    out.push(loz([c0 - 0.3 * s, T + a, 0.9 * s, a], [cx - rx * 0.5, mid - ry * 0.87, 0, 0]));
    out.push(stroke(hr, [E, [x + s, T + a + 2.6]], ar, [[cx + rx, mid], [cx - rx, mid]], true));
  } else if (ch === "o") {
    const c0 = x + s / 2, c1 = x + p + s / 2, cx = x + (p + s) / 2, rx = (p + s) / 2 - 0.7, ry = (B - T) / 2 - 0.7;
    const ta = [[c0, T + a], [c0, mid], [c0, B - a], [cx, B - 0.5 * a], [c1, B - a - 0.6], [c1, mid], [c1, T + a + 0.6], [cx, T + 0.5 * a], [c0, T + a]];
    const tb = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75].map((q) => [cx + rx * cos(q * PI), mid - ry * sin(q * PI)]);
    out.push(stroke(s / 2, ta, ar, tb));
    out.push(loz([c0 - 0.3 * s, T + a, 0.9 * s, a], [tb[0][0], tb[0][1], 0, 0]));
    out.push(loz([c0 + 0.3 * s, B - a, 0.9 * s, a], [tb[2][0], tb[2][1], 0, 0]));
  } else if (ch === "l") {
    minim(out, x, T, B, s, { st: 1, sf: 1, tt: T - 3, top: T - 3.3 });
  } else if (ch === "t") {
    out.push(box([x, T - 1.5, x + s, B - a], [x, T - 2, x + s, B - 1.4]));
    out.push(loz([x + s / 2 + 0.3 * s, B - a, 0.9 * s, a], [x + s / 2, B - 1.4, 0, 0]));
    out.push(stroke(0.1, line([x + s / 2 + 0.3 * s, B - a], [x + s / 2 + 0.3 * s, B - a], 4), 0.4 * s, [[x + s / 2, B - 1.4], [x + s / 2 + 0.6, B - 0.6], [x + s + 1, B - 0.5], [x + s + 2, B - 1.1]]));
    out.push(box([x - 0.7, T + 0.1, x + s + 2.2, T + 1.1], [x - 1, T, x + s + 2.2, T + 0.9]));
  } else if (ch === "=") {
    // The hyphen of a word broken at the margin: two short slanted hairlines.
    for (const y of [T + 3.1, T + 5]) out.push(stroke(hr, [[x - 1.3, y], [x + 0.1, y - 0.9]], hr, [[x - 1.4, y - 0.4], [x + 0.2, y - 0.4]], true));
  }
  return out;
}

// The page: every letter with its line, grid place u, word and place in
// the word; a word that will not fit is broken at a syllable with a hyphen.
function layout() {
  const letters = [], words = TEXT.replace(/-/g, "").split(" ");
  let ln = 0, u = 0;
  TEXT.split(" ").forEach((wd, w) => {
    let i = 0;
    wd.split("-").forEach((sy, j, all) => {
      const adv = [...sy].reduce((n, c) => n + ADV[c], 0), lead = j === 0 && u > 0 ? 1 : 0;
      if (u + lead + adv + (j < all.length - 1 ? HY : 0) > COLS + 1e-9) {
        if (j > 0) letters.push({ ch: "=", u, line: ln, w, i: -1 });
        ln++;
        u = 0;
      } else u += lead;
      for (const ch of sy) {
        letters.push({ ch, u, line: ln, w, i: i++ });
        u += ADV[ch];
      }
    });
  });
  return { letters, words };
}

export function setup(params) {
  const { letters, words } = layout();
  // Minim counts: minimum is fifteen strokes, muniminum nineteen, and the
  // sentence 134 among its 72 letters, counting v as the u it is in
  // textura; the page takes eleven lines and no stroke passes the margin.
  const count = (wd) => [...wd].reduce((n, c) => n + (MINIMS[c] || 0), 0);
  const total = words.reduce((n, wd) => n + count(wd), 0);
  const text = letters.filter((L) => L.ch !== "=");
  const fits = letters.every((L) => (L.ch === "=" ? L.u + HY : L.u + ADV[L.ch]) <= COLS);
  const ok = count("minimum") === 15 && count("muniminum") === 19 && total === 134 && text.length === 72 && letters[letters.length - 1].line === LINES - 1 && fits;
  const wm = words.map(count);
  // Each word's centre on the page, where the lamp stands while it is read.
  const ctr = words.map((_, w) => {
    const ls = letters.filter((L) => L.w === w && L.ch !== "=");
    let cx = 0, cy = 0;
    for (const L of ls) { cx += (W - (COLS - 1) * P - 2) / 2 + (L.u + ADV[L.ch] / 2) * P - 1; cy += TOP + L.line * LEAD + XH / 2; }
    return [cx / ls.length, cy / ls.length];
  });
  // When each word is read, in story seconds at Speed 2.
  const at = [];
  let t = 0.4;
  for (let w = 0; w < words.length; w++) {
    at.push(t);
    t += DWELL + PER * wm[w] + GLIDE;
  }
  params.s = {
    letters, words, ok, total, wm, at, ctr, cycle: t + REST, t: 0, hue: 0, speed: 2, sw: 2, mo: 0.06, s: -1, m: -1,
    ink: new Float32Array(N), hair: new Float32Array(N), wid: new Int16Array(N), buf: new Float32Array(N * 3),
    li: new Float32Array(N), lh: new Float32Array(N),
  };
}

// The light on word w, 0..1, and what the reader keeps of it after.
function lightOf(S, w) {
  const t = S.t, a = S.at[w], d = DWELL + PER * S.wm[w];
  return ease((t - a + 0.12) / 0.24) * (1 - ease((t - a - d + 0.12) / 0.24));
}
function memoryOf(S, w) {
  const t = S.t, a = S.at[w], d = DWELL + PER * S.wm[w];
  return MEMORY * ease((t - a - d) / 0.3) * (1 - ease((t - S.cycle + 0.9) / 0.6));
}

// Where the lamp stands: on a word while it is read, gliding to the next
// between, and how bright it is, out while the page rests.
function lampOf(S) {
  const t = S.t, n = S.words.length;
  let w = 0;
  while (w < n - 1 && t >= S.at[w + 1]) w++;
  const d = DWELL + PER * S.wm[w], a = S.at[w], q = w < n - 1 ? ease((t - a - d) / GLIDE) : 0;
  const p0 = S.ctr[w], p1 = S.ctr[min(n - 1, w + 1)];
  const on = ease((t - 0.1) / 0.3) * (1 - ease((t - a - d) / 0.4) * (w === n - 1 ? 1 : 0));
  return [p0[0] + (p1[0] - p0[0]) * q, p0[1] + (p1[1] - p0[1]) * q, on];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.sw = 2 + 0.8 * cl(k[2] || 0, -1, 1);
  S.mo = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.t += (d * S.speed) / 2;
  if (S.t >= S.cycle) S.t -= S.cycle;
}

const lerp = (a, b, m) => a + (b - a) * m;

// A letter's box on the panel: its first stem's left edge and its rows.
function place(L, s) {
  const T = TOP + L.line * LEAD;
  return { x: (W - (COLS - 1) * P - s) / 2 + L.u * P, T, B: T + XH };
}

// Draws a letter's shapes at morph m with its strokes c LEDs closer than
// the grid's 4 (an m keeps its middle stem in place, the others keep their
// first), into coverage arrays for ink and hairline, tagging its pixels
// with its word.
function render(L, s, m, c, ink, hair, tag) {
  const { x, T, B } = place(L, s);
  const shapes = glyph(L.ch, x + (L.ch === "m" ? c : 0), T, B, s, P - c);
  // Each shape's numbers at this morph, and its bounds, so a LED tests only
  // the shapes that reach it.
  const sh = shapes.map((g) => {
    const v = g.a.map((av, i) => lerp(av, g.b[i], m));
    let bx0, by0, bx1, by1;
    if (g.k === "b") [bx0, by0, bx1, by1] = v;
    else if (g.k === "d") [bx0, by0, bx1, by1] = [v[0] - v[2], v[1] - v[3], v[0] + v[2], v[1] + v[3]];
    else {
      bx0 = by0 = 1e9;
      bx1 = by1 = -1e9;
      for (let i = 1; i < v.length; i += 2) {
        bx0 = min(bx0, v[i] - v[0]); bx1 = max(bx1, v[i] + v[0]);
        by0 = min(by0, v[i + 1] - v[0]); by1 = max(by1, v[i + 1] + v[0]);
      }
    }
    return { k: g.k, v, h: g.h, bx0, by0, bx1, by1 };
  });
  const near = [];
  const x0 = max(0, floor(x - 2)), x1 = min(W - 1, floor(x + ADV[L.ch] * P + 1)), y0 = max(0, floor(T - 4)), y1 = min(H - 1, floor(B + 1));
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      let ci = 0, ch = 0;
      near.length = 0;
      for (const g of sh) if (g.bx1 >= px && g.bx0 <= px + 1 && g.by1 >= py && g.by0 <= py + 1) near.push(g);
      if (!near.length) continue;
      for (const oy of SS)
        for (const ox of SS) {
          const X = px + ox, Y = py + oy;
          let inI = false, inH = false;
          for (const g of near) {
            const v = g.v;
            let hit = false;
            if (g.k === "b") hit = X >= v[0] && X <= v[2] && Y >= v[1] && Y <= v[3];
            else if (g.k === "d") hit = v[2] > 0 && v[3] > 0 && abs(X - v[0]) / v[2] + abs(Y - v[1]) / v[3] <= 1;
            else {
              const r2 = v[0] * v[0];
              for (let i = 1; i + 3 < v.length && !hit; i += 2) {
                const ax = v[i], ay = v[i + 1], ex = v[i + 2] - ax, ey = v[i + 3] - ay, ll = ex * ex + ey * ey;
                const q = ll > 0 ? cl(((X - ax) * ex + (Y - ay) * ey) / ll, 0, 1) : 0, qx = ax + q * ex - X, qy = ay + q * ey - Y;
                hit = qx * qx + qy * qy <= r2;
              }
            }
            if (hit) {
              if (g.h) inH = true;
              else { inI = true; break; }
            }
          }
          if (inI) ci++;
          else if (inH) ch++;
        }
      if (!ci && !ch) continue;
      const o = py * W + px;
      ink[o] = max(ink[o], ci / 9);
      hair[o] = max(hair[o], ch / 9);
      if (tag) tag[o] = L.w;
    }
}

function page(S) {
  S.ink.fill(0);
  S.hair.fill(0);
  S.wid.fill(-1);
  for (const L of S.letters) render(L, S.sw, S.mo, 0, S.ink, S.hair, S.wid);
  S.s = S.sw;
  S.m = S.mo;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (abs(S.s - S.sw) > 1e-3 || abs(S.m - S.mo) > 1e-3) page(S);
  // The ink's hue: azure at 0, turning with the knob but stepping over red,
  // orange and yellow, which read brown in a pale ink this dim.
  const hq = 0.55 + 0.8 * S.hue, h0 = hq > 0.98 ? hq + 0.2 : hq;
  const buf = S.buf;
  const lights = S.words.map((_, w) => lightOf(S, w));
  // From a morph of 0.5 the joins and dots are on all over the page.
  const hm = ease(S.mo / 0.5);
  const keep = S.words.map((_, w) => max(hm, memoryOf(S, w)));
  const page0 = hsv(h0, 0.42, 150), lit0 = hsv(h0 - 0.02, 0.1, 255), lit1 = hsv(h0 + 0.03, 0.62, 250), acc = hsv(h0 + 0.38, 0.6, 255);
  // The page in its ink, hairlines as far as the morph and the reader's
  // memory bring them in. Round the word being read the lamp makes a pool
  // 29 LEDs wide and 16 tall at half strength, where the ink is up to 75 percent
  // brighter and the page itself glows faintly, up to 52 out of 255; words
  // under the light are drawn after.
  const [lx, ly, lon] = lampOf(S), glow = hsv(h0 + 0.08, 0.25, 52);
  for (let o = 0; o < N; o++) {
    const dx = (o % W) - lx, dy = floor(o / W) - ly, lamp = lon * Math.exp(-(dx * dx) / 300 - (dy * dy) / 90);
    for (let c = 0; c < 3; c++) buf[o * 3 + c] = glow[c] * lamp;
    const w = S.wid[o];
    if (w < 0 || lights[w] > 0.001) continue;
    const hv = min(1, S.hair[o] * 1.6) * keep[w], ai = S.ink[o] * (1 + 0.75 * lamp);
    for (let c = 0; c < 3; c++) buf[o * 3 + c] = max(buf[o * 3 + c], page0[c] * max(ai, hv));
  }
  // Words under the light: inside each letter the strokes close up by a
  // LED, so the white inside is 1 LED and the white between letters opens
  // to 3 or 4, less as the morph goes roman and the shapes tell the
  // letters apart by themselves; the letters turn white and sky blue in
  // turn, and the joins and dots come in.
  const { li, lh } = S;
  for (const L of S.letters) {
    const g = lights[L.w];
    if (g <= 0.001) continue;
    const { x, T, B } = place(L, S.sw);
    const x0 = max(0, floor(x - 2)), x1 = min(W - 1, floor(x + ADV[L.ch] * P + 1)), y0 = max(0, floor(T - 4)), y1 = min(H - 1, floor(B + 1));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) li[py * W + px] = lh[py * W + px] = 0;
    render(L, S.sw, S.mo, g * (1 - S.mo), li, lh, null);
    const ic = L.i & 1 ? lit1 : lit0, hv = max(keep[L.w], g);
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const o = py * W + px, ai = li[o], ah = min(1, lh[o] * 1.6) * hv;
        if (!ai && !ah) continue;
        for (let c = 0; c < 3; c++) {
          const ink = page0[c] + (ic[c] - page0[c]) * g, hc = page0[c] + (acc[c] - page0[c]) * g;
          buf[o * 3 + c] = max(buf[o * 3 + c], ink * ai, hc * ah);
        }
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(buf[o], 0, 255)), round(cl(buf[o + 1], 0, 255)), round(cl(buf[o + 2], 0, 255)));
    }
}
