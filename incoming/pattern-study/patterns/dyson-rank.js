// ===== Patternflow pattern =====
// Title:   Dyson's Rank
// Family:  number
// Idea:    Every partition of n in dictionary order stands in turn as a big Ferrers diagram at the top of the panel, its largest part lit dot by dot while a marker walks right along a number line and its parts lit dot by dot while the marker walks back, so the marker stops on the rank, largest part minus number of parts, in a colour that repeats every m values; the diagram shrinks and drops into the shelf of that colour among m shelves stacked down the panel, each with a floor p(n)/m diagrams long and a faint backdrop behind every slot filled, so for n = 9 the five shelves fill to six each and end at the same column, while for n = 6 and m = 11 two shelves stay empty and two overflow until the fourth knob switches to the Andrews-Garvan crank and every diagram flies to its new shelf, one on each.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ramanujan's congruences p(5n + 4), p(7n + 5), p(11n + 6) = 0 mod 5, 7, 11 (Srinivasa Ramanujan, 1919), the rank of a partition and the guess that it splits them (Freeman Dyson, Some guesses in the theory of partitions, Eureka, 1944), proved for 5 and 7 (A. O. L. Atkin and Peter Swinnerton-Dyer, 1954), and the crank that splits all three (George Andrews and Frank Garvan, 1988), pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Case=0..3, Crank=0..1
//
// Knob 1: Hue. Turns the residue colours round a wheel that steps over orange and yellow. At 0 shelf 0 is azure and, with five shelves, shelves 1 to 4 are violet, pink, red and green; with eleven they go from azure through blue, violet and pink to rose, then lime, green and teal. A value on the number line has the colour of its shelf, paler for each lap above 0 to m - 1 and deeper for each lap below, and a shelved diagram and its backdrop carry the same lap. At 0.25 shelf 0 is violet, at 0.5 red, at 0.75 green.
// Knob 2: Speed. At 2 a partition of 9 waits 0.15 s for the last one to leave, appears in 0.15 s, is counted at 0.025 s a dot, holds its sum 0.2 s and falls in 0.42 s, so the thirty are sorted in 21.7 s by rank (18.7 s by crank), the full shelves stand 2.4 s with their counts lit and clear in 0.5 s: 25.1 s a pass. The small cases count at 0.08 to 0.12 s a dot, a pass of 12.9 s for n = 4, 15.5 s for n = 5, 19.4 s for n = 6. Everything goes as Speed / 2, and the Lab opens as if the panel had run 12.35 s at that speed: at 2, nineteen of the thirty are shelved and (3, 3, 2, 1) stands with its sum 3 - 4 = -1 and residue 4 written beside it.
// Knob 3: Case. Which congruence, in four stops. 0: n = 9 at m = 5, thirty partitions, six to a shelf, one LED a dot on the shelves and 3 by 3 dots on the stage. 1: n = 4 at m = 5, five partitions, one to a shelf, 3 by 3 dots on the shelves and 8 by 8 on the stage. 2: n = 5 at m = 7, seven partitions on seven shelves of 12 rows, single LEDs two apart on the shelves and 6 by 6 dots on the stage. 3: n = 6 at m = 11, eleven partitions on eleven shelves of 8 rows, one LED a dot and 5 by 5 on the stage; by rank shelves 4 and 7 stay empty and shelves 1 and 10 take two, the second on a grey floor past the shelf's end.
// Knob 4: Crank. Below 0.5 the statistic is Dyson's rank: the bottom row is counted plus and the first column minus, the corner dot both. From 0.5 it is the Andrews-Garvan crank: with w ones and mu parts larger than w it is mu - w, the column w dots in counted plus (marked under the stage even when it is empty) and the w single dots on top of the first column minus; with no ones it is the largest part, the bottom row alone. Turning it across 0.5 sends every shelved diagram to its new shelf in 0.7 s at Speed 2 and starts the stage count again; at stop 3 the empty and doubled shelves even out.

// Ramanujan (1919): the number of partitions p(n) is divisible by 5 when
// n = 4 mod 5, by 7 when n = 5 mod 7 and by 11 when n = 6 mod 11. p(4) = 5,
// p(9) = 30, p(5) = 7, p(6) = 11. Dyson (1944) looked for a reason one can
// see: a statistic that sorts the partitions of 5k + 4 into five classes of
// equal size. His rank, largest part minus number of parts, does it mod 5
// and mod 7 (Atkin and Swinnerton-Dyer, 1954), and fails mod 11: the ranks
// of the eleven partitions of 6 are 5, 3, 2, 1, 1, 0, -1, -1, -2, -3, -5,
// which leave residues 4 and 7 empty and give 1 and 10 two each. Dyson asked
// for a "crank" that would do 11 as well. Andrews and Garvan (1988) found
// it: with w the number of ones and mu the number of parts larger than w,
// the crank is the largest part when w = 0 and mu - w otherwise. The cranks
// of the partitions of 6 are 6, 0, 4, -1, 3, 1, -3, 2, -2, -4, -6, all
// different mod 11.
//
// setup() lists the partitions of each n, checks the count against Euler's
// pentagonal recurrence p(n) = sum of (-1)^(k+1) p(n - k(3k -+ 1)/2), and
// counts the classes: rank and crank both 1,1,1,1,1 for n = 4 mod 5, both
// 6 each for n = 9 mod 5, both 1 each for n = 5 mod 7, crank 1 each for n = 6
// mod 11 and rank 1,2,1,1,0,1,1,0,1,1,2 there. A shelf is drawn p(n)/m slots
// long only when those checks pass; the counts lit at the end of a pass are
// the diagrams that actually landed.
//
// The diagrams are drawn the French way, largest part along the bottom, so
// they stand on the shelf. In the rank the largest part is the bottom row
// and the number of parts the first column. In the crank the mu parts larger
// than w are exactly the rows that reach column w (counting from 0), so the
// crank compares that column with the w single dots on top of the first
// column. Either way the statistic is the dots lit bright minus the dots lit
// in the second colour, and the marker's walk on the number line is that
// subtraction, one step a dot. The partitions come in dictionary order,
// (9), (8, 1), (7, 2), (7, 1, 1), ..., which for n = 9 already spreads the
// first twelve 2, 2, 3, 3, 2 over the five rank shelves.

const W = 64, H = 128;
const { floor, round, min, max, abs, PI, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// The stage, the number line and the shelves.
const STAGE_X = 4, STAGE_B = 35, LINE_Y = 38, SHELF_Y = 41, SHELF_H = H - SHELF_Y;
// The four cases: n, the modulus, and seconds at Speed 2 for a diagram to
// appear, for each dot counted, for the result to stand and for the fall.
const CASES = [
  [9, 5, 0.15, 0.025, 0.2, 0.42],
  [4, 5, 0.45, 0.12, 0.6, 0.65],
  [5, 7, 0.4, 0.1, 0.5, 0.6],
  [6, 11, 0.3, 0.08, 0.45, 0.5],
];
// Seconds at Speed 2 to hold the full shelves, to clear them, to re-sort.
const HOLD = 2.4, CLEAR = 0.5, RESORT = 0.7;

// A 3 by 5 face for the digits, the signs and the two words.
const GL = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111",
  "-": "000000111000000", "=": "000111000111000", "#": "111000111000111",
  R: "110101110101101", A: "010101111101101", N: "101111111101101", K: "101101110101101", C: "011100100100011",
};

// A hue wheel with orange and yellow taken out: u runs 0..1 over 0.2..1.03.
const wheel = (u) => 0.2 + 0.83 * (u - floor(u));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function partitions(n) {
  const out = [];
  const rec = (left, cap, acc) => {
    if (left === 0) { out.push(acc.slice()); return; }
    for (let k = min(left, cap); k >= 1; k--) { acc.push(k); rec(left - k, k, acc); acc.pop(); }
  };
  rec(n, n, []);
  return out;
}

// Euler's pentagonal recurrence, independent of the listing.
function pCount(n) {
  const p = [1];
  for (let j = 1; j <= n; j++) {
    let s = 0;
    for (let k = 1; ; k++) {
      const a = (k * (3 * k - 1)) / 2, b = (k * (3 * k + 1)) / 2;
      if (a > j) break;
      const sg = k % 2 ? 1 : -1;
      s += sg * p[j - a];
      if (b <= j) s += sg * p[j - b];
    }
    p.push(s);
  }
  return p[n];
}

// The dots a statistic lights, as [row from the bottom, column]: plus first,
// then minus.
function marks(q, crank) {
  const L = q[0], N = q.length, plus = [], minus = [];
  if (!crank) {
    for (let j = 0; j < L; j++) plus.push([0, j]);
    for (let i = 0; i < N; i++) minus.push([i, 0]);
    return { plus, minus, value: L - N };
  }
  const w = q.filter((x) => x === 1).length;
  if (w === 0) {
    for (let j = 0; j < L; j++) plus.push([0, j]);
    return { plus, minus, value: L, w };
  }
  const mu = q.filter((x) => x > w).length;
  for (let i = 0; i < mu; i++) plus.push([i, w]);
  for (let i = N - w; i < N; i++) minus.push([i, 0]);
  return { plus, minus, value: mu - w, w };
}

const mod = (a, m) => ((a % m) + m) % m;
// A value's lap round the number line, (v - residue) / m, as saturation
// and brightness: lap 0 the plain residue colour, laps above paler, laps
// below deeper.
const LAP = { "-3": [1, 0.42], "-2": [0.95, 0.58], "-1": [0.82, 0.78], 0: [0.55, 1], 1: [0.28, 1], 2: [0.12, 1] };
const lapOf = (v, m) => LAP[(v - mod(v, m)) / m] || LAP[0];
// The same for the backdrop behind a shelved diagram, much darker.
const LAPB = { "-3": [1, 0.09], "-2": [1, 0.1], "-1": [0.9, 0.12], 0: [0.75, 0.15], 1: [0.5, 0.19], 2: [0.35, 0.21] };
const lapB = (v, m) => LAPB[(v - mod(v, m)) / m] || LAPB[0];

function buildCase(c) {
  const [n, m, appear, dotT, result, fall] = CASES[c];
  const parts = partitions(n).map((q) => {
    const st = [marks(q, false), marks(q, true)];
    // Per statistic, which dots it lights: 1 plus, 2 minus, 3 both.
    const mk = st.map((s) => {
      const o = {};
      for (const [i, j] of s.plus) o[i * 64 + j] = 1;
      for (const [i, j] of s.minus) o[i * 64 + j] = (o[i * 64 + j] || 0) + 2;
      return o;
    });
    return { q, st, mk };
  });
  const counts = [0, 1].map((s) => {
    const k = new Array(m).fill(0);
    for (const p of parts) k[mod(p.st[s].value, m)]++;
    return k;
  });
  const P = parts.length;
  const even = (k) => k.every((x) => x === P / m);
  const ok = pCount(n) === P && P % m === 0 && even(counts[1]) && (m === 11 ? counts[0].join() === "1,2,1,1,0,1,1,0,1,1,2" : even(counts[0]));
  // Pitches: the stage diagram fills 35 rows; a shelf holds an n-dot column
  // with a floor under it and a row over it.
  const hs = SHELF_H / m;
  const ps = floor(36 / n), sp = max(1, floor((hs - 1) / n));
  const sb = sp > 1 ? sp - 1 : 1;
  const sx = m > 9 ? 9 : 5;
  const slotW = sp > 1 ? n * sp + 1 : n + 1;
  return { n, m, parts, P, ok, cap: P / m, hs, ps, sp, sb, sx, slotW, counts, appear, dotT, result, fall };
}


const shelfTop = (C, c) => round(SHELF_Y + c * C.hs);
const floorRow = (C, c) => round(SHELF_Y + (c + 1) * C.hs) - 1;
const stagePlace = (C) => ({ x: STAGE_X, y: STAGE_B + 1, p: C.ps, b: C.ps - 1 });
const slotPlace = (C, cls, slot) => ({ x: C.sx + slot * C.slotW, y: floorRow(C, cls), p: C.sp, b: C.sb });

export function setup(params) {
  params.s = {
    cs: -1, stat: -1, hue: 0, t: 0, C: null, order: [], items: [], k: 0, ph: 0, mode: 0, mt: 0,
    buf: new Float32Array(W * H * 3),
  };
}

function newPass(S) {
  const C = S.C;
  // Dictionary order, largest parts first: (9), (8, 1), (7, 2), ...
  S.order = C.parts.map((p, i) => i);
  S.items = [];
  S.k = 0;
  S.ph = 0;
  S.mode = 0;
  S.mt = 0;
  S.fill = new Array(C.m).fill(0);
}

// Hands each shelved diagram, in the order it arrived, its class and slot
// under the statistic now chosen, and sends it there from where it is.
function resort(S) {
  const C = S.C;
  S.fill = new Array(C.m).fill(0);
  for (const it of S.items) {
    const cls = mod(C.parts[it.i].st[S.stat].value, C.m);
    const from = placeOf(it);
    it.cls = cls;
    it.slot = S.fill[cls]++;
    it.from = from;
    it.to = slotPlace(C, cls, it.slot);
    it.u = 0;
    it.dur = RESORT;
    it.fall = false;
  }
}

function placeOf(it) {
  const u = it.u >= it.dur ? 1 : it.u / it.dur;
  const a = it.from, b = it.to;
  // Falling, it shrinks quickly off the stage and drops under gravity.
  const e = ease(u), g = it.fall ? 0.3 * u + 0.7 * u * u : e, f = it.fall ? 1 - (1 - u) ** 3 : e;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * g, p: a.p + (b.p - a.p) * f, b: a.b + (b.b - a.b) * f };
}

// How long the partition on the stage stays there.
// The partition waits while the last one leaves the stage, then appears.
const waitOf = (C) => 0.35 * C.fall;
const stageTime = (C, st) => waitOf(C) + C.appear + C.dotT * (st.plus.length + st.minus.length) + C.result;

function step(S, d) {
  const C = S.C;
  for (const it of S.items) it.u += d;
  if (S.mode === 0) {
    S.ph += d;
    const it = S.order[S.k], st = C.parts[it].st[S.stat];
    if (S.ph >= stageTime(C, st)) {
      const cls = mod(st.value, C.m), slot = S.fill[cls]++;
      S.items.push({ i: it, cls, slot, from: stagePlace(C), to: slotPlace(C, cls, slot), u: 0, dur: C.fall, fall: true });
      S.k++;
      S.ph = 0;
      if (S.k >= C.P) { S.mode = 1; S.mt = 0; }
    }
  } else {
    S.mt += d;
    if (S.mode === 1 && S.mt >= C.fall + HOLD) { S.mode = 2; S.mt = 0; }
    else if (S.mode === 2 && S.mt >= CLEAR) newPass(S);
  }
}

// The first pass opens already under way: as if the pattern had been
// running for OPEN seconds at the speed it opens with.
const OPEN = 12.35;
function preroll(S, speed) {
  const h = 1 / 30;
  for (let t = 0; t < (OPEN * speed) / 2; t += h) step(S, h);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const cs = round(cl(k[2] || 0, 0, 3)), stat = cl(k[3] == null ? 0.06 : k[3], 0, 1) >= 0.5 ? 1 : 0;
  if (cs !== S.cs) {
    const first = S.cs < 0;
    S.cs = cs;
    S.stat = stat;
    S.C = buildCase(cs);
    newPass(S);
    if (first) preroll(S, speed);
  }
  if (stat !== S.stat) {
    S.stat = stat;
    resort(S);
    if (S.mode === 0) S.ph = min(S.ph, waitOf(S.C) + S.C.appear);
  }
  step(S, (d * speed) / 2);
}

// Adds colour over a box by how much of each LED it covers.
function box(buf, x0, y0, x1, y1, r, g, b) {
  const xa = max(0, floor(x0)), xb = min(W - 1, floor(x1 - 1e-6)), ya = max(0, floor(y0)), yb = min(H - 1, floor(y1 - 1e-6));
  for (let y = ya; y <= yb; y++) {
    const cy = min(y1, y + 1) - max(y0, y);
    if (cy <= 0) continue;
    for (let x = xa; x <= xb; x++) {
      const c = (min(x1, x + 1) - max(x0, x)) * cy;
      if (c <= 0) continue;
      const o = (y * W + x) * 3;
      buf[o] = buf[o] * (1 - c) + r * c;
      buf[o + 1] = buf[o + 1] * (1 - c) + g * c;
      buf[o + 2] = buf[o + 2] * (1 - c) + b * c;
    }
  }
}

const dot = (buf, x, y, c, a) => box(buf, x, y, x + 1, y + 1, c[0] * a, c[1] * a, c[2] * a);

function text(buf, s, x, y, c, a) {
  for (const ch of s) {
    const g = GL[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === "1") dot(buf, x + (i % 3), y + floor(i / 3), c, a);
    x += 4;
  }
}
const textW = (s) => s.length * 4 - 1;

// One diagram at a place {x, y (the row under its bottom dots), p (pitch),
// b (dot size)}, each dot in the colour colOf(row, column) gives.
function diagram(buf, q, pl, colOf) {
  for (let i = 0; i < q.length; i++)
    for (let j = 0; j < q[i]; j++) {
      const c = colOf(i, j);
      if (!c) continue;
      const x = pl.x + j * pl.p, y = pl.y - i * pl.p - pl.b;
      box(buf, x, y, x + pl.b, y + pl.b, c[0], c[1], c[2]);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.C) return;
  const C = S.C, buf = S.buf, m = C.m;
  buf.fill(0);
  const u0 = 0.458 + S.hue;
  const res = [];
  for (let r = 0; r < m; r++) res.push(wheel(u0 + (0.86 * r) / m));
  const rgb = (h, s, v) => hsv(h, s, v).map((x) => x * 255);
  // The stage's own colours: the diagram waiting, the dots counted plus
  // (near white) and minus, all turning with the hue.
  const plusC = rgb(wheel(u0 + 0.47), 0.22, 1), minusC = rgb(wheel(u0 + 0.62), 0.9, 1);
  const baseC = rgb(wheel(u0 + 0.3), 0.5, 0.62);
  const full = S.mode >= 1 && S.items.every((it) => it.u >= it.dur);
  const clearA = S.mode === 2 ? 1 - ease(S.mt / CLEAR) : 1;
  const capEnd = C.sx + (C.ok ? C.cap : 1) * C.slotW - (C.sp > 1 ? 2 : 1);

  // Behind each slot a diagram has landed in, a faint backdrop in the
  // shelf colour, so the shelves are also a bar chart of the class sizes.
  for (const it of S.items) {
    const f = it.fall ? cl((it.u - it.dur) / 0.3, 0, 1) : 1;
    if (f <= 0) continue;
    const c = it.cls, top = shelfTop(C, c) + 1, fr = floorRow(C, c);
    const x0 = C.sx - 1 + it.slot * C.slotW, x1 = min(W, x0 + C.slotW);
    // Newly landed, it glows and settles over about two seconds, so the
    // last few landings stay marked.
    const age = it.u - it.dur, glowL = age > 0 ? 0.3 * Math.exp(-age / 1.1) : 0;
    const lb = lapB(C.parts[it.i].st[S.stat].value, C.m);
    const bc = rgb(res[c], max(0, lb[0] - glowL), (lb[1] + glowL) * f * clearA);
    box(buf, x0, top, x1, fr, bc[0], bc[1], bc[2]);
  }

  // The shelves: floors p(n)/m slots long, a grey floor past the end
  // where a class overflows, and the residue at the left.
  const landed = new Array(m).fill(0);
  for (const it of S.items) if (it.u >= it.dur) landed[it.cls]++;
  const held = full ? ease(S.mt / 0.4) * clearA : 0, blink = 0.5 + 0.5 * sin(S.mt * PI * 3);
  for (let c = 0; c < m; c++) {
    const fr = floorRow(C, c), h = res[c];
    const floorC = rgb(h, 0.7, 0.55), lab = rgb(h, 0.55, 0.95);
    // A landing lights the floor white and the light runs out from the slot.
    for (let x = C.sx; x < capEnd; x++) {
      let f = 0;
      for (const it of S.items)
        if (it.cls === c && it.u >= it.dur && it.u < it.dur + 0.5) {
          const sx = C.sx + it.slot * C.slotW + C.n * C.sp * 0.5, age = it.u - it.dur;
          f = max(f, (1 - age / 0.5) * cl(1 - abs(x - sx) / (8 + 90 * age), 0, 1));
        }
      dot(buf, x, fr, [0, 1, 2].map((j) => floorC[j] * (1 - f) + 255 * f), 1);
    }
    // Past the end of the shelf, a grey floor for a class that overflows.
    const over = C.sx + S.fill[c] * C.slotW - (C.sp > 1 ? 2 : 1);
    for (let x = capEnd; x < over && x < W; x++) dot(buf, x, fr, [150, 150, 150], held > 0 ? 0.45 + 0.55 * blink : 0.6);
    const ls = String(c);
    text(buf, ls, (m > 9 ? 7 : 3) - textW(ls), fr - 5, lab, 1);
  }

  // The shelved and falling diagrams in their class colour, white as they
  // leave the stage.
  for (const it of S.items) {
    const P = C.parts[it.i], q = P.q, sv = lapOf(P.st[S.stat].value, m);
    const cc = rgb(res[it.cls], sv[0], sv[1]);
    // Falling, it leaves six fainter copies of itself behind.
    if (it.fall && it.u < it.dur)
      for (let k = 6; k >= 1; k--) {
        const ghost = { from: it.from, to: it.to, dur: it.dur, fall: true, u: max(0, it.u - k * 0.04) };
        const a = 0.3 * (1 - k / 7);
        diagram(buf, q, placeOf(ghost), () => [cc[0] * a, cc[1] * a, cc[2] * a]);
      }
    // On the shelf a diagram keeps its count: the plus dots paler, the
    // minus dots deeper.
    const hot = it.fall ? 1 - ease(it.u / it.dur) : 0, mk = P.mk[S.stat];
    const tone = (k) => [0, 1, 2].map((j) => ((k === 1 ? cc[j] * 0.55 + 115 : k === 2 ? cc[j] * 0.5 : k === 3 ? cc[j] * 0.8 + 50 : cc[j]) * (1 - hot) + 255 * hot) * clearA);
    const cols = [tone(0), tone(1), tone(2), tone(3)];
    diagram(buf, q, placeOf(it), (i, j) => cols[mk[i * 64 + j] || 0]);
  }

  // At the end of a pass each shelf says how many it holds, white where
  // that is not p(n)/m, and an empty slot's floor blinks.
  if (held > 0)
    for (let c = 0; c < m; c++) {
      const n = landed[c], off = n !== C.cap, fr = floorRow(C, c);
      text(buf, String(n), W - 4, shelfTop(C, c) + 1, off ? [255, 255, 255] : rgb(res[c], 0.4, 1), held * (off ? 0.6 + 0.4 * blink : 1));
      if (n < C.cap)
        for (let x = C.sx + n * C.slotW; x < capEnd; x++) dot(buf, x, fr, [255, 255, 255], held * (0.3 + 0.7 * blink));
    }

  // The number line from -n to n, three LEDs a step, each value in the
  // colour of its residue, zero taller.
  const n = C.n, z = 32;
  for (let v = -n; v <= n; v++) {
    const sv = lapOf(v, m), x = z + 3 * v, c = rgb(res[mod(v, m)], sv[0], sv[1] * 0.9);
    dot(buf, x, LINE_Y, c, 1);
    if (v === 0) { dot(buf, x, LINE_Y - 1, c, 1); dot(buf, x, LINE_Y + 1, c, 1); }
  }

  // The word for the statistic.
  const word = S.stat ? "CRANK" : "RANK";
  text(buf, word, W - 1 - textW(word), 1, rgb(wheel(u0 + 0.3), 0.45, 0.85), 1);

  if (S.mode === 0) {
    // The partition on the stage: it fades in once the last one has left,
    // its dots are counted, plus first, and the marker walks.
    const it = S.order[S.k], P = C.parts[it], st = P.st[S.stat], q = P.q;
    const t = S.ph - waitOf(C), np = st.plus.length, nm = st.minus.length, A = C.appear;
    const counted = floor((t - A) / C.dotT) + 1;
    const nPlus = cl(counted, 0, np), nMinus = cl(counted - np, 0, nm);
    const tRes = A + C.dotT * (np + nm);
    const done = t >= tRes, tint = done ? ease((t - tRes) / (C.result * 0.5)) : 0;
    const appear = ease(t / A);
    const cls = mod(st.value, m), sv = lapOf(st.value, m), clsC = rgb(res[cls], sv[0], sv[1]);
    const key = (i, j) => i * 64 + j;
    const pl = new Set(st.plus.slice(0, nPlus).map(([i, j]) => key(i, j)));
    const mi = new Set(st.minus.slice(0, nMinus).map(([i, j]) => key(i, j)));
    diagram(buf, q, stagePlace(C), (i, j) => {
      let c = baseC;
      const a = pl.has(key(i, j)), b = mi.has(key(i, j));
      if (a && b) c = [0, 1, 2].map((x) => (plusC[x] + minusC[x]) / 2);
      else if (a) c = plusC;
      else if (b) c = minusC;
      return [0, 1, 2].map((x) => (c[x] * (1 - tint * 0.6) + clsC[x] * tint * 0.6) * appear);
    });
    // A mark under the column the crank reads, even when it is empty.
    if (S.stat && st.w > 0 && t >= A) {
      const gx = STAGE_X + st.w * C.ps;
      box(buf, gx, STAGE_B + 1, gx + C.ps - 1, STAGE_B + 2, plusC[0] * 0.6, plusC[1] * 0.6, plusC[2] * 0.6);
    }
    // The walk: right a step per plus dot, left a step per minus dot.
    const v = nPlus - nMinus, mx = z + 3 * v;
    const mc = done ? clsC : [255, 255, 255];
    for (let y = LINE_Y - 1; y <= LINE_Y + 2; y++) dot(buf, mx, y, mc, appear);
    dot(buf, mx - 1, LINE_Y + 2, mc, 0.6 * appear);
    dot(buf, mx + 1, LINE_Y + 2, mc, 0.6 * appear);
    // The sum written out: plus count, minus count, the statistic, its residue.
    if (t >= A) {
      let x = 40;
      const y = 10, a = String(np);
      text(buf, a, x, y, plusC, nPlus === np ? 1 : 0.45);
      x += a.length * 4;
      if (nm > 0 || !S.stat) {
        text(buf, "-", x, y, [200, 200, 200], 0.7);
        x += 4;
        if (nPlus === np) text(buf, String(nm), x, y, minusC, nMinus === nm ? 1 : 0.45);
        x += String(nm).length * 4;
      }
      if (done) {
        // With no ones the crank is the largest part itself: no sum to write.
        if (!(S.stat && st.w === 0)) text(buf, "=" + st.value, x, y, [235, 235, 235], 1);
        text(buf, "#" + cls, 40, 18, clsC, tint);
        const ls = String(cls);
        text(buf, ls, (m > 9 ? 7 : 3) - textW(ls), floorRow(C, cls) - 5, [255, 255, 255], tint * 0.8);
      }
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(buf[o], 0, 255)), round(cl(buf[o + 1], 0, 255)), round(cl(buf[o + 2], 0, 255)));
    }
}
