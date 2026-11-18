// ===== Patternflow pattern =====
// Title:   Dayan Remainders
// Family:  type
// Idea:    Soldiers counted off by three coprime moduli, 3, 5 and 7 to begin with, leave remainders, and a counting board of rod numerals finds each modulus's inverse by Qin Jiushao's alternate division on four cells, weights each remainder with it, adds the three on a ruler of length M and cuts M off lap by lap until the count comes back.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: dayan qiuyi shu (Qin Jiushao, Shushu Jiuzhang, 1247) for the inverses, the remainder problem of the Sunzi suanjing (3rd to 5th century) for the 3, 5, 7 case, rod numerals as drawn in patterns/fangcheng.js with the flat 6 to 9 redrawn to fit a place of 9 by 9, pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Soldiers=23..104, Moduli=0..7
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the three moduli have a cyan, a green and a violet column, the count and the sum are ivory and turn gold when the sum has come back to the count, the cells being divided are gold with a pale blue frame on the divisor, and the signs are slate. At 0.5 the columns are red, magenta and green.
// Knob 2: Speed. How fast the board works. At 2 a division starts 1.1 s after the story begins and takes 0.8 s, the quotient written in 0.2 s and the two cells changing from 0.26 s to 0.58 s; a weight is written in 0.55 s and each further adding of it 0.28 s after the last; the sum is written in 0.65 s and cut in 0.8 s, and the count shines for 1.1 s and stands for 3 s. The opening story, 23 soldiers on 3, 5 and 7, takes 10.8 s and comes round again every 10.8 s, and the first frame is already 0.9 s into it; the longest of all the sets and counts takes 13.8 s. All times go as 2 / Speed: at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Soldiers. The count x, 23 to 104, rounded to a whole number. At 23 the remainders on 3, 5 and 7 are 2, 3 and 2, the weights 70, 21 and 15 make 140, 63 and 30, they add to 233 and 233 less 2 times 105 is 23. Turning it while a story runs keeps the solved boards and redoes the remainders and the sum, 8.3 s for 58 on 3, 5 and 7 against 10.4 to 10.8 s for the whole story; every count from 0 to 104 is checked to come back as itself in every set when the pattern starts.
// Knob 4: Moduli. Eight sets of three coprime moduli in eight equal parts of the range, and the product M they make: 0 is 3, 5, 7 (M 105, inverses 2, 1, 1, so only the 3 needs division, in 2 steps); 1 is 4, 5, 7 (M 140, inverses 3, 2, 6); 2 is 3, 7, 8 (M 168, inverses 2, 5, 5, the 8 taking 4 steps); 3 is 5, 6, 7 (M 210, inverses 3, 5, 4); 4 is 4, 5, 9 (M 180, inverses 1, 1, 5); 5 is 5, 7, 8 (M 280, inverses 1, 3, 3); 6 is 5, 7, 9 (M 315, inverses 2, 5, 8); 7 is 7, 8, 9 (M 504, inverses 4, 7, 5). A new set starts from an empty board.

// Soldiers counted off in threes leave 2, in fives 3, in sevens 2: how many
// are there? The Sunzi suanjing asks it and the answer is 23, or 23 plus any
// multiple of 105. Qin Jiushao's Shushu Jiuzhang (1247) solves it for any
// moduli with no common factor. Let M be their product. For each modulus m
// take M/m (35, 21, 15) and its remainder q on division by m (2, 1, 1), find
// the k with k * q = 1 modulo m (2, 1, 1), and the count is the sum of the
// remainder times M/m times k (2 * 70 + 3 * 21 + 2 * 15 = 233) less as many
// M as will go (233 - 2 * 105 = 23). The pattern works every step out, and
// when it starts it checks that every count from 0 to 104 comes back.
//
// The board holds the numbers as counting rods. Units stand upright, tens lie
// flat, hundreds stand again, and 1 to 5 are that many rods, 6 to 9 a rod for
// 5 beside or over 1 to 4 more. A place is 9 LEDs across, a rod 7 long, so a
// number of two places is 19 wide and one of four is 39. A zero is a small
// ring, so that an empty place is not taken for no number.
//
// Top to bottom: the count x with the product M beside it, and a ruler of
// length M that x fills; a column for each modulus with m and the remainder of
// x on it, M/m, and the board of four cells with the quotient of the step
// under it; a row for each weight times its remainder; the total; and a tape.
// The tape lays the three rows end to end on the ruler, and a row of it is
// full at M, so the sum wraps into laps. Then M is cut off the front lap by
// lap and what is left is as long as the bar at the top.

const W = 64, H = 128;
const { floor, round, min, max, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map((c) => c * 255);
}

// The moduli. Each is coprime to the other two.
const SETS = [[3, 5, 7], [4, 5, 7], [3, 7, 8], [5, 6, 7], [4, 5, 9], [5, 7, 8], [5, 7, 9], [7, 8, 9]];

// The four cells are [L1 R1 / L2 R2], and they start as [1 q / 0 m]. The
// remainder q of M/m by m goes upper right and m lower right. The lower
// right is divided by the upper right, the quotient times L1 is added to L2
// and the remainder replaces R2; then the upper right is divided by the lower
// right and L1 gets the quotient times L2, and so on until R1 is 1. L1 is the
// inverse of q. A divisor of 1 is taken one time fewer, so that a 1 is left.
function steps(q, m) {
  let L1 = 1, R1 = q, L2 = 0, R2 = m, low = true;
  const out = [];
  while (R1 !== 1 && out.length < 40) {
    let a, r;
    if (low) (a = floor(R2 / R1)), (r = R2 - a * R1);
    else if (R2 === 1) (a = R1 - 1), (r = 1);
    else (a = floor(R1 / R2)), (r = R1 - a * R2);
    const s = { low, a, r, from: [L1, R1, L2, R2] };
    if (low) (L2 += a * L1), (R2 = r);
    else (L1 += a * L2), (R1 = r);
    s.to = [L1, R1, L2, R2];
    out.push(s);
    low = !low;
  }
  return { out, k: L1, end: [L1, R1, L2, R2] };
}

// One set as the board works it: for each modulus the number M/m, its
// remainder q and the steps, with the weight M/m * k.
function build(ms) {
  const M = ms[0] * ms[1] * ms[2];
  return { ms, M, cols: ms.map((m) => { const Mi = M / m, q = Mi % m, b = steps(q, m); return { m, Mi, q, b, k: b.k, U: Mi * b.k }; }) };
}

// ---- Rod numerals, a place 9 by 9 and places 10 apart, units upright.
// A place is a list of rods {x, y, len, v}; a zero is a ring.
const ROD = [[], []];
for (let f = 0; f < 2; f++)
  for (let d = 0; d <= 9; d++) {
    const r = [], n = d <= 5 ? d : d - 5;
    if (d === 0) r.push({ ring: 1, x: 0, y: 0 });
    else if (f === 0) {
      for (let i = 0; i < n; i++) r.push({ x: 4 + 2 * i - (n - 1), y: d <= 5 ? 1 : 2, len: 7, v: 1 });
      if (d > 5) r.push({ x: 1, y: 0, len: 7, v: 0 });
    } else {
      for (let i = 0; i < n; i++) r.push({ x: d <= 5 ? 1 : 2, y: 4 - (n - 1) + 2 * i, len: 7, v: 0 });
      if (d > 5) r.push({ x: 0, y: 1, len: 7, v: 1 });
    }
    ROD[f][d] = r;
  }
const key = (r) => r.x + "," + r.y + "," + r.v;
const digs = (n) => {
  const o = [];
  if (n < 0) return o;
  do (o.push(n % 10)), (n = floor(n / 10));
  while (n > 0);
  return o;
};

// ---- The story: every number on the board is a slot with a list of
// changes {t0, t1, a, b}, and the lit cells are fx. Times are story seconds
// at Speed 2.
const ST = 0.8, HOLD = 3.0, FADE = 0.7, OFF = 0.9;

function plan(D, x, fast, snap) {
  const slots = {}, base = {}, cur = {}, fx = [];
  const was = (k) => (snap && snap[k] !== undefined ? snap[k] : -1);
  const set = (k, t0, t1, to) => {
    if (!(k in cur)) (cur[k] = was(k)), (base[k] = cur[k]);
    (slots[k] = slots[k] || []).push({ t0, t1, a: cur[k], b: to });
    cur[k] = to;
  };
  const fix = (k, v) => (cur[k] = base[k] = v);
  const C = D.cols, M = D.M;
  const rem = C.map((c) => x % c.m);
  // When each board is done: the time its inverse stands.
  const TS = 1.1, tk = [];
  if (fast) {
    set("x", 0, 0.35, x);
    C.forEach((c, i) => {
      set("r" + i, 0.05 + 0.06 * i, 0.4 + 0.06 * i, rem[i]);
      fix("M" + i, c.Mi);
      fix("m" + i, c.m);
      ["L1", "R1", "L2", "R2"].forEach((n, j) => fix(n + i, c.b.end[j]));
      fix("a" + i, -1);
      tk[i] = 0.3;
    });
    fix("MM", M);
  } else {
    set("x", 0, 0.4, x);
    set("MM", 0, 0.4, M);
    C.forEach((c, i) => {
      set("M" + i, 0.05 + 0.07 * i, 0.5 + 0.07 * i, c.Mi);
      set("m" + i, 0.15 + 0.07 * i, 0.5 + 0.07 * i, c.m);
      set("r" + i, 0.3 + 0.07 * i, 0.8 + 0.07 * i, rem[i]);
      set("R2" + i, 0.5 + 0.05 * i, 0.95 + 0.05 * i, c.m);
      set("R1" + i, 0.65 + 0.05 * i, 1.1 + 0.05 * i, c.q);
      set("L1" + i, 0.75 + 0.05 * i, 1.15 + 0.05 * i, 1);
      set("L2" + i, 0.8 + 0.05 * i, 1.2 + 0.05 * i, 0);
      c.b.out.forEach((s, j) => {
        const t0 = TS + ST * j, dv = s.low ? "R2" : "R1", dr = s.low ? "R1" : "R2", lt = s.low ? "L2" : "L1", ls = s.low ? "L1" : "L2";
        set("a" + i, t0, t0 + 0.2, s.a);
        set(dv + i, t0 + 0.26, t0 + 0.58, s.r);
        set(lt + i, t0 + 0.26, t0 + 0.58, s.low ? s.to[2] : s.to[0]);
        fx.push({ k: "cell", i, c: dv, t0, t1: t0 + 0.65, role: "div" }, { k: "cell", i, c: dr, t0, t1: t0 + 0.65, role: "by" }, { k: "cell", i, c: ls, t0: t0 + 0.18, t1: t0 + 0.65, role: "src" });
      });
      const te = TS + ST * c.b.out.length;
      if (c.b.out.length) set("a" + i, te, te + 0.22, -1);
      tk[i] = te + 0.4;
      fx.push({ k: "cell", i, c: "L1", t0: te, t1: tk[i] + 0.6, role: "k" }, { k: "cell", i, c: "R1", t0: te, t1: tk[i] + 0.6, role: "k" });
    });
  }
  // Each weight M/m * k goes down a row as its board is done, and the
  // remainder times it is built by adding the weight again, turn by turn.
  let tAdd = 0;
  const tT = [];
  C.forEach((c, i) => {
    const t = tk[i] + 0.1;
    tT[i] = t;
    set("T" + i, t, t + 0.55, rem[i] === 0 ? 0 : c.U);
    set("c" + i, t, t + 0.45, rem[i]);
    for (let j = 2; j <= rem[i]; j++) set("T" + i, t + 0.75 + 0.28 * (j - 2), t + 0.99 + 0.28 * (j - 2), j * c.U);
    tAdd = max(tAdd, rem[i] >= 2 ? t + 0.99 + 0.28 * (rem[i] - 2) : t + 0.55);
  });
  const order = [0, 1, 2].sort((p, q) => tT[p] - tT[q] || p - q);
  const sum = C.reduce((s, c, i) => s + rem[i] * c.U, 0), a = floor(sum / M), back = sum - a * M;
  const tS = tAdd + 0.15, tCut = tS + 0.9, tA = tCut + 0.8;
  set("S", tS, tS + 0.65, sum);
  set("S", tCut, tA, back);
  fx.push({ k: "ans", t0: tA, t1: tA + 1.1 });
  return { slots, base, final: { ...cur }, fx, order, tS, tCut, tA, total: tA + 1.1 + HOLD + FADE, sum, a, x: back };
}

// What a slot shows at t: [from, to, u, since the last change, changed].
function val(P, k, t) {
  const L = P.slots[k];
  if (!L) return [P.base[k] === undefined ? -1 : P.base[k], P.base[k] === undefined ? -1 : P.base[k], 1, 9, false];
  let v = L[0].a, since = 9, ch = false;
  for (const e of L) {
    if (t < e.t0) break;
    if (t < e.t1) return [e.a, e.b, (t - e.t0) / (e.t1 - e.t0), 0, true];
    (v = e.b), (since = t - e.t1), (ch = e.a !== e.b);
  }
  return [v, v, 1, since, ch];
}

export function setup(params) {
  // Every set is worked through at the start the way the board works it: each
  // inverse must multiply M/m's remainder to 1, and the weighted sum of the
  // remainders of every x under 105 must come back to x. A set that fails
  // any of it is left out.
  const sets = [];
  for (const ms of SETS) {
    const D = build(ms);
    let ok = true;
    for (const c of D.cols) if (c.k < 1 || c.k >= c.m || (c.k * c.q) % c.m !== 1) ok = false;
    for (let x = 0; x < 105; x++) if (D.cols.reduce((s, c) => s + (x % c.m) * c.U, 0) % D.M !== x) ok = false;
    if (ok) sets.push(D);
  }
  params.s = { hue: 0, speed: 2, sets, si: -1, x: -1, t: 0, P: null, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 23, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const x = cl(round(k[2] == null ? 23 : k[2]), 23, 104), si = cl(floor(((k[3] || 0) * S.sets.length) / 7.0001), 0, S.sets.length - 1);
  S.t += (d * S.speed) / 2;
  if (si !== S.si) {
    // A new set starts from an empty board.
    (S.t = S.si < 0 ? OFF : 0), (S.si = si), (S.x = x);
    S.P = plan(S.sets[si], x, false, null);
  } else if (x !== S.x) {
    // A new count keeps the solved boards and works the sum again from what is on the board.
    const snap = {}, P = S.P;
    for (const key2 of Object.keys(P.slots)) snap[key2] = val(P, key2, S.t)[1];
    for (const key2 of Object.keys(P.base)) if (snap[key2] === undefined) snap[key2] = P.base[key2];
    (S.x = x), (S.t = 0);
    S.P = plan(S.sets[si], x, true, snap);
  } else if (S.t >= S.P.total) {
    S.t = 0;
    S.P = plan(S.sets[si], x, false, null);
  }
}

// ---- Drawing.
function put(buf, x, y, c, a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  buf[o] = max(buf[o], c[0] * a);
  buf[o + 1] = max(buf[o + 1], c[1] * a);
  buf[o + 2] = max(buf[o + 2], c[2] * a);
}

// A rod from (x, y), len LEDs long, drawn from its middle outward so that
// scale 0 to 1 withdraws or pushes it out.
function rod(buf, x, y, len, v, scale, c, a) {
  if (scale <= 0.02) return;
  const mid = len / 2, half = (len * scale) / 2;
  for (let i = 0; i < len; i++) {
    const cov = cl(min(i + 1, mid + half) - max(i, mid - half), 0, 1);
    if (cov > 0) put(buf, v ? x : x + i, v ? y + i : y, c, cov * a);
  }
}

// A number from a to b (-1 is none), u 0 to 1: rods that are not in the next
// digit withdraw first, the rods that are in it push out after, and rods in
// both stay. xr is the right edge of the units place, y0 the top.
function numeral(buf, xr, y0, a, b, u, c, al) {
  const A = digs(a), B = digs(b), n = max(A.length, B.length);
  for (let p = 0; p < n; p++) {
    const x0 = xr - 8 - 10 * p, f = p & 1;
    const ra = p < A.length ? ROD[f][A[p]] : [], rb = p < B.length ? ROD[f][B[p]] : [];
    const ka = new Set(ra.map(key)), kb = new Set(rb.map(key));
    const split = ra.some((r) => !kb.has(key(r))) ? 0.45 : 0;
    const one = (r, s) => {
      if (r.ring) {
        if (s > 0.02) for (let q = 0; q < 9; q++) if (q !== 4) put(buf, x0 + 3 + (q % 3), y0 + 3 + floor(q / 3), c, s * al * 0.7);
      } else rod(buf, x0 + r.x, y0 + r.y, r.len, r.v, s, c, al);
    };
    for (const r of ra) one(r, kb.has(key(r)) ? 1 : 1 - sm(u / split));
    for (const r of rb) if (!ka.has(key(r))) one(r, sm((u - split) / (1 - split)));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const P = S.P, t = S.t, buf = S.buf, h = S.hue, D = S.sets[S.si], M = D.M;
  buf.fill(0);
  const fade = cl((P.total - t) / FADE, 0, 1);
  const WHITE = [255, 255, 255];
  const HU = [0.5, 0.33, 0.8];
  const col = HU.map((u) => hsv(u + h, 0.6, 1)), pale = HU.map((u) => hsv(u + h, 0.2, 1));
  const line = HU.map((u) => hsv(u + h, 0.55, 0.3));
  const ivory = hsv(0.12 + h, 0.2, 1), gold = hsv(0.13 + h, 0.85, 1), cold = hsv(0.55 + h, 0.25, 1);
  const dim = hsv(0.6 + h, 0.2, 0.42), faint = hsv(0.6 + h, 0.25, 0.22);

  // Where each cell stands: lanes 16 to 66, a table with rows 10 apart.
  const X0 = (i) => 1 + 21 * i, LY = 16;
  const CELL = { L1: [1, LY + 21], R1: [11, LY + 21], L2: [1, LY + 31], R2: [11, LY + 31] };
  const cellXY = (i, n) => [X0(i) + CELL[n][0], CELL[n][1]];
  // The number a slot is showing, as it moves from a to b.
  const now = (k) => {
    const [a, b, u] = val(P, k, t);
    return max(a, 0) + (max(b, 0) - max(a, 0)) * sm(u);
  };
  const num = (k, xr, y0, c, a2) => {
    const [a, b, u, since, ch] = val(P, k, t);
    if (a < 0 && b < 0) return;
    const fl = u < 1 ? 0.7 * sm(u) : ch ? cl(1 - since / 0.45, 0, 1) * 0.7 : 0;
    numeral(buf, xr, y0, a, b, u, mix(c, WHITE, fl), a2 * fade);
  };

  // The count goes gold where the sum has come back to it, flashing and then
  // breathing slowly while the story stands.
  let ansA = 0;
  for (const f of P.fx) {
    if (f.k !== "ans" || t < f.t0) continue;
    const u = (t - f.t0) / (f.t1 - f.t0);
    ansA = u < 1 ? sin(PI * u) : 0.45 * (0.5 - 0.5 * cos(PI * (t - f.t1)));
  }
  const back = mix(ivory, gold, ansA);

  // The count and the product of the moduli, and a ruler of that length
  // with the count marked on it.
  num("x", 29, 1, back, 1);
  num("MM", 62, 1, dim.map((v) => v * 1.6), 1);
  const bar = (row, from, to, c, hgt, a2) => {
    // From and to in units of M, drawn between x 1 and 62.
    const u0 = 1 + (from / M) * 61, u1 = 1 + (to / M) * 61;
    for (let px = floor(u0); px < u1; px++) {
      const cov = cl(min(px + 1, u1) - max(px, u0), 0, 1);
      for (let q = 0; q < hgt; q++) put(buf, px, row + q, c, cov * a2 * fade);
    }
  };
  bar(11, 0, M, faint, 4, 1);
  bar(11, 0, now("x"), back, 4, 0.9);

  // The lanes: a table with a column for each modulus.
  for (let i = 0; i < 3; i++) {
    const x0 = X0(i);
    for (let y = LY; y <= LY + 50; y++) for (const x of [x0, x0 + 20]) put(buf, x, y, line[i], fade);
    for (let k = 0; k <= 5; k++) for (let x = x0; x <= x0 + 20; x++) put(buf, x, LY + 10 * k, line[i], (k >= 2 && k <= 4 ? 1 : 0.7) * fade);
    for (let y = LY + 1; y < LY + 40; y++) if (y !== LY + 10 && y !== LY + 20 && y !== LY + 30) put(buf, x0 + 10, y, line[i], fade);
  }

  // The cells in play.
  const roleCol = { div: gold, by: cold, src: ivory, k: gold };
  const roleA = { div: 0.9, by: 0.7, src: 0.6, k: 0.7 };
  for (const f of P.fx) {
    if (f.k !== "cell" || t < f.t0 || t > f.t1) continue;
    const a = min(1, (t - f.t0) / 0.1, (f.t1 - t) / 0.15) * fade * roleA[f.role], [cx, cy] = cellXY(f.i, f.c), c = roleCol[f.role];
    for (let q = -1; q <= 9; q++) {
      put(buf, cx + q, cy - 1, c, a);
      put(buf, cx + q, cy + 9, c, a);
      put(buf, cx - 1, cy + q, c, a);
      put(buf, cx + 9, cy + q, c, a);
    }
  }
  for (let i = 0; i < 3; i++) {
    const x0 = X0(i);
    num("m" + i, x0 + 9, LY + 1, line[i].map((v) => v * 2.2), 1);
    num("r" + i, x0 + 19, LY + 1, col[i], 1);
    num("M" + i, x0 + 19, LY + 11, pale[i], 0.8);
    for (const n of ["L1", "R1", "L2", "R2"]) {
      const [cx, cy] = cellXY(i, n);
      num(n + i, cx + 8, cy, n[0] === "L" ? pale[i] : col[i], 1);
    }
    num("a" + i, x0 + 16, LY + 41, ivory, 1);
    if (val(P, "a" + i, t)[1] >= 0) {
      for (let q = 0; q < 5; q++) put(buf, x0 + 2 + q, LY + 45, dim, fade);
      put(buf, x0 + 4, LY + 43, dim, fade);
      put(buf, x0 + 4, LY + 47, dim, fade);
    }
  }

  // The sum: a row for each weight, each times its remainder, and the total.
  for (let i = 0; i < 3; i++) {
    const y = 70 + 10 * i;
    num("T" + i, 46, y, col[i], 1);
    num("c" + i, 63, y, col[i].map((v) => v * 0.55), 1);
    // The signs and the colour of the row stand from the start and brighten
    // when the row is written.
    const on = val(P, "T" + i, t)[1] >= 0 ? 1 : 0.4;
    for (let q = 0; q < 5; q++) put(buf, 48 + q, y + 2 + q, col[i], 0.5 * on * fade), put(buf, 52 - q, y + 2 + q, col[i], 0.5 * on * fade);
    for (let q = 0; q < 7; q++) put(buf, 0, y + 1 + q, col[i], 0.6 * on * fade), put(buf, 1, y + 1 + q, col[i], 0.6 * on * fade);
    if (i > 0) for (let q = 0; q < 3; q++) put(buf, 2 + q, y + 4, dim, on * fade), put(buf, 3, y + 3 + q, dim, on * fade);
  }
  for (let x = 2; x <= 46; x++) put(buf, x, 100, dim, fade * (val(P, "S", t)[1] >= 0 ? 1 : 0.5));
  num("S", 46, 102, back, 1);

  // The tape: the three weighted remainders end to end on a ruler of length M,
  // wrapping into a new row each time the ruler is full, and then M cut off
  // the front, lap by lap, until only the count is left.
  const laps = P.a + 1, pitch = cl(floor(14 / laps), 1, 4), hb = max(1, pitch - 1);
  const shift = (P.sum - P.x) * sm((t - P.tCut) / (P.tA - P.tCut));
  const vs = P.order.map((i) => now("T" + i)), rows = max(1, min(laps, Math.ceil((vs[0] + vs[1] + vs[2] - shift) / M - 1e-6)));
  for (let l = 0; l < rows; l++) bar(113 + l * pitch, 0, M, faint, hb, 1);
  let at = 0;
  for (const [n, i] of P.order.entries()) {
    const v = vs[n], p0 = at - shift, p1 = at + v - shift;
    at += v;
    if (p1 <= 0 || v <= 0) continue;
    for (let l = floor(max(p0, 0) / M); l * M < p1 && l < laps; l++) bar(113 + l * pitch, max(p0, l * M) - l * M, min(p1, (l + 1) * M) - l * M, col[i], hb, 1);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(buf[o], 0, 255)), round(cl(buf[o + 1], 0, 255)), round(cl(buf[o + 2], 0, 255)));
    }
}
