// ===== Patternflow pattern =====
// Title:   Gerbert's Abacus
// Family:  type
// Idea:    Numbers are added on Gerbert's column abacus the way its counters work, one apex marked 1 to 9 in a column and an empty column for zero: each addend is written at the foot of a ledger that runs down the panel, its apices fly up to the board under the ones already there, and column by column from the units the two apices slide together and are replaced by the single apex of their sum, a sum of ten or more sending an apex 1 down its column and along to the next one on the left to join the work there, until the new total flies back down and is written in the ledger under a rule.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the column abacus with marked counters (apices) revived by Gerbert d'Aurillac, later Pope Sylvester II, at Reims about 980, described by his pupil Richer of Reims and in Bernelinus' Liber abaci; the apices' numeral forms related to the West Arabic ghubar numerals; apices and modern digits 5 x 8 LEDs drawn for this pattern; pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Columns=4..7, Glyph=0..1
//
// Knob 1: Hue. Turns the counters round the wheel together. At 0 the total's apices are aqua, the addend's pink and a carried apex gold, with a white flash where two apices become one; the ledger writes the addends in pink and the totals in aqua, each line dimmer the further back it is.
// Knob 2: Speed. At 2 an addend is written at 0.07 s a figure and flies up to the board in 0.8 s; a column is worked in 0.6 s, or 1.05 s when it carries and the 1 drops to the foot of the column and slides left; the total is back in the ledger 1.2 s after the last column, 1.6 s when the ledger has to scroll. The opening sum, 2975 + 1038, carries three times and takes 7.9 s, and a sum takes 6.7 s on average. Every time goes as 2 / Speed.
// Knob 3: Columns. How many columns the board has, 4 to 7, headed I, X, C, M and then X, C and M with a bar for the thousands, under arcs of three as Gerbert's board grouped them. With 4 or 5 the apices are 10 x 16 LEDs on the board and the ledger shows 5 lines; with 6 or 7 they are 5 x 8 and it shows 7. Addends have from 2 figures to one fewer than the board; when a total would not fit, the board is swept and a fresh number starts it under a double rule.
// Knob 4: Glyph. Below 1/3 board and ledger both use the apices, and an empty place is a blank column. From 1/3 the ledger writes the same numbers in modern digits, so the zeros the board leaves empty appear there. From 2/3 the board's figures are modern digits too, written without counters, with a 0 in each empty place and the column rules faded, since a written zero holds the place the column held.

// Gerbert's board, as Richer describes it, was ruled into columns headed by
// the powers of ten, grouped in threes under arcs. A number was set by laying
// in each column one counter, an apex, marked with the figure of that place,
// 1 to 9, and a place worth nothing was left empty. The nine figures had the
// names igin, andras, ormis, arbas, quimas, caltis, zenis, temenias and
// celentis. On a board of plain pebbles, 7 and 8 in one column are fifteen
// pebbles to be regrouped. The apex board asks the reckoner to know
// 7 + 8 = 15 by heart: the two counters are taken off, the 5 counter is laid
// in their place and a 1 counter is carried to the next column.
//
// The shapes below are drawn from memory and are approximations: a plain
// stroke for 1, a footless hook for 2, a flat-topped 3, a looped half-eight
// for 4, a 5 like a d with its stem bent over, a 6 like a b, an inverted V
// for 7, an 8 open at the top and a 9 with a curled tail. The modern digits
// beside them are an ordinary pixel face with a slashed 0.
//
// Each sum is laid out as soon as it starts. Every counter is a sprite with
// keyframes (time, position, scale, on the board or in the ledger) and times
// to show and to go, and the ledger is a list of lines with a time for each
// figure to be written, so a frame only evaluates them at the sum's clock.

const W = 64, H = 128;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ramp = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
const ease = (u) => u * u * (3 - 2 * u);

const APEX = [
  null,
  [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..##."],
  [".##..", "#..#.", "...#.", "...#.", "..#..", ".#...", "#....", "#...."],
  ["#####", "...#.", "..#..", ".###.", "....#", "....#", "#...#", ".###."],
  [".###.", "#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "##.##"],
  ["....#", "...#.", ".###.", "#...#", "#...#", "#...#", "#...#", ".###."],
  ["##...", "#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  ["..#..", "..#..", ".#.#.", ".#.#.", ".#.#.", "#...#", "#...#", "#...#"],
  ["#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#", "#...#", ".###."],
  [".###.", "#...#", "#...#", ".####", "....#", "....#", "..#.#", "...#."],
];
const MODERN = [
  [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  [".###.", "#...#", "....#", "..##.", "....#", "....#", "#...#", ".###."],
  ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#.", "...#."],
  ["#####", "#....", "#....", "####.", "....#", "....#", "#...#", ".###."],
  ["..##.", ".#...", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
  ["#####", "....#", "...#.", "...#.", "..#..", "..#..", ".#...", ".#..."],
  [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", "#...#", ".###."],
  [".###.", "#...#", "#...#", ".####", "....#", "....#", "...#.", ".##.."],
];
// Column heads: I, X, C, M, 3 wide but M, 5 tall.
const HEAD = [
  [".#.", ".#.", ".#.", ".#.", ".#."],
  ["#.#", "#.#", ".#.", "#.#", "#.#"],
  [".##", "#..", "#..", "#..", ".##"],
  ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
];
const bits = (rows) => {
  const px = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === "#" && px.push(x, y)));
  return px;
};
const GA = APEX.map((r) => (r ? bits(r) : [])), GM = MODERN.map(bits), GH = HEAD.map(bits);

// Ledger line pitch, and the three kinds of counter.
const LP = 11, TOTAL = 0, ADDEND = 1, CARRY = 2;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function layout(C) {
  const cw = C <= 4 ? 16 : C === 5 ? 12 : C === 6 ? 10 : 9;
  const sc = cw >= 12 ? 2 : 1;
  const x0 = floor((W - C * cw) / 2);
  const slot = sc === 2 ? [12, 33, 54] : [12, 23, 34];
  const bottom = sc === 2 ? 73 : 44;
  const ty0 = bottom + 3;
  return { C, cw, sc, x0, slot, bottom, ty0, lines: floor((H - ty0 + 3) / LP), cx: (p) => x0 + (C - 1 - p) * cw + cw / 2 };
}

const digitsOf = (n, C) => {
  const d = [];
  for (let p = 0; p < C; p++, n = floor(n / 10)) d.push(n % 10);
  return d;
};

// One sum on the board: total a, addend b; clear sweeps the board first.
function build(S, a, b, clear) {
  const Ly = S.lay, C = Ly.C, sc = Ly.sc, [UY, AY, CY] = Ly.slot;
  const sp = [], scroll = [], lines = [], empty = [];
  const add = (o) => {
    const s = Object.assign({ a0: -1, a1: -1, d0: 1e9, d1: 1e9, f: -1 }, o);
    sp.push(s);
    return s;
  };
  const board = (p, y) => [Ly.cx(p), y, sc, 1];
  let base = S.scrollBase;
  const yLine = (j) => Ly.ty0 + (j - base) * LP;
  // A new line at the foot of the ledger, scrolling it up first if it is full.
  let t = 0;
  const newLine = (o) => {
    const j = S.next++;
    if (j - base >= Ly.lines) {
      scroll.push(t);
      base++;
      t += 0.35;
    }
    const line = Object.assign({ j, ap: [] }, o);
    lines.push(line);
    return line;
  };
  const dA = digitsOf(a, C), dB = digitsOf(b, C);
  // A 0 inside a number is a counter too, drawn only in the modern face.
  const hiOf = (d) => d.reduce((m, v, p) => (v ? p : m), 0);
  const U = [];
  for (let p = 0; p <= hiOf(dA); p++) if (a) U[p] = add({ g: dA[p], kind: TOTAL, keys: [[0, ...board(p, UY)]] });
  if (clear) {
    for (const s of U) if (s) { s.d0 = 0; s.d1 = 0.6; }
    U.length = 0;
    dA.fill(0);
    a = 0;
    t = 0.7;
  }
  // The addend is written on the ledger, units first.
  const la = newLine({ n: b, kind: ADDEND, rule: clear ? 2 : 0 });
  const top = hiOf(dB);
  for (let p = 0; p <= top; p++) la.ap[p] = t + 0.07 * p;
  t += 0.07 * top + 0.3;
  // It flies up to the board, a copy from each figure.
  const A = [];
  let k = 0;
  for (let p = 0; p <= top; p++) {
    const m0 = t + 0.06 * k++;
    A[p] = add({ g: dB[p], kind: ADDEND, keys: [[m0, Ly.cx(p), yLine(la.j), 1, 0], [m0 + 0.8, ...board(p, AY)]], a0: m0, a1: m0 });
  }
  t += 0.8 + 0.06 * (k - 1) + 0.2;
  // The columns, from the units: the addend's apex and any carried apex
  // slide into the total's slot and one apex of the sum replaces them.
  let carry = 0, cs = null;
  for (let p = 0; p < C; p++) {
    if (p > top && !carry) break;
    if (!dB[p] && !carry) {
      const z = A[p];
      if (z) {
        z.keys.push([t, ...z.keys[z.keys.length - 1].slice(1)], [t + 0.25, ...board(p, UY)]);
        z.d0 = t + 0.2;
        z.d1 = t + 0.3;
      }
      t += z ? 0.3 : 0.1;
      continue;
    }
    const r = dA[p] + dB[p] + carry, tm = t + 0.35;
    for (const s of [A[p], cs]) {
      if (!s) continue;
      s.keys.push([t, ...s.keys[s.keys.length - 1].slice(1)], [tm, ...board(p, UY)]);
      s.d0 = tm - 0.05;
      s.d1 = tm + 0.05;
    }
    if (U[p]) { U[p].d0 = tm - 0.05; U[p].d1 = tm + 0.05; }
    U[p] = add({ g: r % 10, kind: TOTAL, keys: [[tm, ...board(p, UY)]], a0: tm - 0.05, a1: tm + 0.05, f: tm });
    if (!(r % 10)) empty.push([p, tm]);
    carry = r >= 10 ? 1 : 0;
    if (carry && p + 1 < C) {
      // The carried 1 drops to the foot of its column, clear of the
      // addend's apices, and slides left under the next one.
      cs = add({ g: 1, kind: CARRY, keys: [[tm + 0.05, ...board(p, UY)], [tm + 0.32, ...board(p, CY)], [tm + 0.6, ...board(p + 1, CY)]], a0: tm, a1: tm + 0.08, f: tm });
      t = tm + 0.7;
    } else {
      cs = null;
      t = tm + 0.25;
    }
  }
  const total = a + b;
  // The total flies back down and is written under a rule.
  t += 0.25;
  const ls = newLine({ n: total, kind: TOTAL, rule: 1 });
  k = 0;
  for (let p = C - 1; p >= 0; p--) {
    if (!U[p]) continue;
    const m0 = t + 0.04 * k++;
    add({ g: U[p].g, kind: TOTAL, keys: [[m0, ...board(p, UY)], [m0 + 0.8, Ly.cx(p), yLine(ls.j), 1, 0]], a0: m0, a1: m0, d0: m0 + 0.8, d1: m0 + 0.8 });
    ls.ap[p] = m0 + 0.8;
  }
  const done = t + 0.8 + 0.04 * k;
  for (let p = 0; p < C; p++) if (ls.ap[p] == null) ls.ap[p] = done;
  return { sp, scroll, lines, empty, total, end: done + 0.9 };
}

function nextAddend(S) {
  const C = S.lay.C, nd = 2 + floor(Math.random() * (C - 2));
  return floor(10 ** (nd - 1) + Math.random() * 9 * 10 ** (nd - 1));
}

function begin(S, a, b) {
  let clear = false;
  if (a + b >= 10 ** S.lay.C) {
    clear = true;
    b = floor(10 ** (S.lay.C - 2) * (1 + Math.random() * 4));
  }
  S.sum = build(S, a, b, clear);
  S.ledger.push(...S.sum.lines);
  S.t = 0;
}

function restart(S, C) {
  S.lay = layout(C);
  S.ledger = [];
  S.next = 0;
  S.scrollBase = 0;
  // The ledger as if the sums before had been done: 980 under a double rule,
  // then + 1995 = 2975, and the board opens on 2975 + 1038.
  const old = [[980, ADDEND, 2], [980, TOTAL, 1], [1995, ADDEND, 0], [2975, TOTAL, 1]];
  for (const [n, kind, rule] of old) S.ledger.push({ j: S.next++, n, kind, rule, ap: [] });
  begin(S, 2975, 1038);
  S.t = 0.35;
}

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, glyph: 0.06, C: 0, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.glyph = k[3] == null ? 0.06 : k[3];
  const C = round(cl(k[2] == null ? 4 : k[2], 4, 7));
  if (C !== S.C) {
    S.C = C;
    restart(S, C);
  }
  S.t += (d * S.speed) / 2;
  if (S.t >= S.sum.end) {
    const over = S.t - S.sum.end;
    S.scrollBase += S.sum.scroll.length;
    for (const l of S.ledger) l.ap = [];
    const keep = S.lay.lines + 1;
    S.ledger = S.ledger.filter((l) => l.j >= S.next - keep);
    begin(S, S.sum.total, nextAddend(S));
    S.t = over;
  }
}

// Keyframes, eased between neighbours. The last entry is 1 on the board and
// 0 in the ledger, and the face switches where it passes 0.5.
function at(keys, t) {
  if (t <= keys[0][0]) return [t, keys[0][1], keys[0][2], keys[0][3], keys[0][4]];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t < b[0]) {
      const a = keys[i - 1], u = ease(ramp(t, a[0], b[0]));
      return [t, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u, a[4] + (b[4] - a[4]) * u];
    }
  }
  const l = keys[keys.length - 1];
  return [t, l[1], l[2], l[3], l[4]];
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.sum) return;
  const buf = S.buf, Ly = S.lay, C = Ly.C, t = S.t, sum = S.sum;
  buf.fill(0);
  const plot = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    buf[i] += r; buf[i + 1] += g; buf[i + 2] += b;
  };
  // A rectangle with fractional edges, each LED lit by how much it covers.
  const rect = (x, y, w, h, r, g, b, y0) => {
    for (let py = floor(y); py < y + h; py++) {
      if (py < y0) continue;
      const cy = min(y + h, py + 1) - max(y, py);
      if (cy <= 0) continue;
      for (let px = floor(x); px < x + w; px++) {
        const c = (min(x + w, px + 1) - max(x, px)) * cy;
        if (c > 0) plot(px, py, r * c, g * c, b * c);
      }
    }
  };
  const cols = [hsv(S.hue + 0.5, 0.75, 1), hsv(S.hue + 0.9, 0.58, 1), hsv(S.hue + 0.14, 0.72, 1)];
  const grey = hsv(S.hue + 0.55, 0.15, 1);
  const ledgerFace = S.glyph >= 1 / 3 ? 1 : 0, boardFace = S.glyph >= 2 / 3 ? 1 : 0;
  const glyphOf = (g, face) => (face ? GM[g] : GA[g]);

  // The heads: arcs over each three columns from the units, then I X C M,
  // with a bar over the thousands.
  for (let gI = 0; gI * 3 < C; gI++) {
    const pr = gI * 3, pl = min(C - 1, pr + 2);
    const xl = Ly.x0 + (C - 1 - pl) * Ly.cw + 1, xr = Ly.x0 + (C - pr) * Ly.cw - 2;
    const mid = (xl + xr) / 2, half = (xr - xl) / 2;
    for (let x = xl; x <= xr; x++) {
      const u = (x - mid) / half, y = 1.5 * u * u;
      const iy = floor(y), fy = y - iy, v = 95;
      plot(x, iy, grey[0] * v * (1 - fy), grey[1] * v * (1 - fy), grey[2] * v * (1 - fy));
      plot(x, iy + 1, grey[0] * v * fy, grey[1] * v * fy, grey[2] * v * fy);
    }
  }
  for (let p = 0; p < C; p++) {
    const px = GH[p === 3 || p === 6 ? 3 : p % 3];
    const wd = p === 3 || p === 6 ? 5 : 3, xl = round(Ly.cx(p) - wd / 2), v = 120;
    for (let i = 0; i < px.length; i += 2) plot(xl + px[i], 4 + px[i + 1], grey[0] * v, grey[1] * v, grey[2] * v);
    if (p >= 4) for (let x = -1; x <= wd; x++) plot(xl + x, 3, grey[0] * v, grey[1] * v, grey[2] * v);
  }
  // Column rules down the board and on down the ledger, and the board's foot.
  for (let i = 1; i < C; i++) {
    const x = Ly.x0 + i * Ly.cw;
    for (let y = 10; y < H; y++) {
      const v = (y <= Ly.bottom ? 30 : 20) * (boardFace ? 0.4 : 1);
      plot(x, y, grey[0] * v, grey[1] * v, grey[2] * v);
    }
  }
  for (let x = Ly.x0; x < Ly.x0 + C * Ly.cw; x++) plot(x, Ly.bottom, grey[0] * 45, grey[1] * 45, grey[2] * 45);

  // The ledger.
  let scroll = S.scrollBase;
  for (const e of sum.scroll) scroll += ease(ramp(t, e, e + 0.35));
  const newest = S.next - 1;
  for (const line of S.ledger) {
    const y = Ly.ty0 + (line.j - scroll) * LP;
    if (y > H || y < Ly.ty0 - LP) continue;
    const fadeTop = cl((y - Ly.ty0 + 6) / 6, 0, 1);
    const age = max(0, newest - line.j - (line.kind === TOTAL ? 0 : 1));
    const lv = max(0.42, 1 - 0.1 * age) * fadeTop * (line.kind === TOTAL ? 1 : 0.8);
    const c = cols[line.kind];
    const ds = digitsOf(line.n, C);
    let hiP = 0;
    ds.forEach((dd, p) => dd && (hiP = p));
    const shown = line.ap.length ? line.ap.reduce((m, a) => (a <= t ? m + 1 : m), 0) : C;
    if (line.rule && shown > 0) {
      const ra = line.ap.length ? cl((t - min(...line.ap.filter((v) => v != null))) / 0.3, 0, 1) : 1;
      const rv = 55 * ra * fadeTop;
      for (const ry of line.rule === 2 ? [y - 3, y - 1] : [y - 2])
        if (ry > Ly.bottom) for (let x = Ly.x0 + 1; x < Ly.x0 + C * Ly.cw - 1; x++) plot(x, ry, grey[0] * rv, grey[1] * rv, grey[2] * rv);
    }
    for (let p = 0; p <= hiP; p++) {
      const ap = line.ap.length ? line.ap[p] : -1;
      if (ap == null || ap > t) continue;
      const dd = ds[p];
      if (!dd && !ledgerFace) continue;
      const fresh = ap >= 0 ? exp(-(t - ap) / 0.25) : 0;
      const px = glyphOf(dd, ledgerFace), xl = Ly.cx(p) - 2.5;
      const r = 255 * (c[0] * lv + fresh * 0.6), g = 255 * (c[1] * lv + fresh * 0.6), b = 255 * (c[2] * lv + fresh * 0.6);
      for (let i = 0; i < px.length; i += 2) rect(xl + px[i], y + px[i + 1], 1, 1, r, g, b, Ly.bottom + 1);
    }
  }

  // The counters.
  for (const s of sum.sp) {
    const al = (s.a0 < 0 ? 1 : ramp(t, s.a0, s.a1 + 1e-6)) * (1 - ramp(t, s.d0, s.d1 + 1e-6));
    if (al <= 0) continue;
    const [, x, y, sc, onBoard] = at(s.keys, t);
    const face = onBoard >= 0.5 ? boardFace : ledgerFace;
    if (!s.g && !face) continue;
    const c = cols[s.kind];
    const fl = s.f >= 0 && t >= s.f ? 1.1 * exp(-(t - s.f) / 0.18) : 0;
    // The counter itself, a dim plate behind its figure.
    if (onBoard > 0 && !boardFace) {
      const pw = min(Ly.cw - 1, 7 * sc), ph = 10 * sc, pv = 0.13 * onBoard * al * 255;
      const xl = x - pw / 2, yt = y - sc;
      rect(xl + 1, yt, pw - 2, ph, c[0] * pv, c[1] * pv, c[2] * pv, 0);
      rect(xl, yt + 1, 1, ph - 2, c[0] * pv, c[1] * pv, c[2] * pv, 0);
      rect(xl + pw - 1, yt + 1, 1, ph - 2, c[0] * pv, c[1] * pv, c[2] * pv, 0);
    }
    const px = glyphOf(s.g, face);
    const r = 255 * (c[0] + fl) * al, g = 255 * (c[1] + fl) * al, b = 255 * (c[2] + fl) * al;
    const xl = x - 2.5 * sc;
    for (let i = 0; i < px.length; i += 2) rect(xl + px[i] * sc, y + px[i + 1] * sc, sc, sc, r, g, b, 0);
  }
  // A column whose sum is exactly ten is left empty: the outline of its
  // counter shows for a moment where the apex went.
  for (const [p, te] of sum.empty) {
    if (t < te || boardFace) continue;
    const v = 150 * exp(-(t - te) / 0.3);
    if (v < 3) continue;
    const sc = Ly.sc, pw = min(Ly.cw - 1, 7 * sc), ph = 10 * sc, xl = round(Ly.cx(p) - pw / 2), yt = Ly.slot[0] - sc;
    for (let x = xl + 1; x < xl + pw - 1; x++) { plot(x, yt, grey[0] * v, grey[1] * v, grey[2] * v); plot(x, yt + ph - 1, grey[0] * v, grey[1] * v, grey[2] * v); }
    for (let y = yt + 1; y < yt + ph - 1; y++) { plot(xl, y, grey[0] * v, grey[1] * v, grey[2] * v); plot(xl + pw - 1, y, grey[0] * v, grey[1] * v, grey[2] * v); }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, min(255, round(buf[i])), min(255, round(buf[i + 1])), min(255, round(buf[i + 2])));
    }
}
