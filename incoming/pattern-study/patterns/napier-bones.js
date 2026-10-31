// ===== Patternflow pattern =====
// Title:   Napier's Bones
// Family:  type
// Idea:    Napier's multiplying rods fall down the tall panel one after another, the index rod and four rods headed by the digits of a number such as 1617, every square split by its diagonal into the tens and units of a product, and for each digit of the multiplier the row it names lights across the rods while the rest dim, the diagonals are added from right to left with each carry stepping over to the next, and the partial products and then their sum are written underneath before the rods fall away for the next problem.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Napier's bones (John Napier, Rabdologiæ, 1617), digits drawn for this pattern on a 3 by 5 grid, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Problem=0..5, Bands=0..1
//
// Knob 1: Hue. The colour of the rods. At 0 they are slate blue with pale digits, and the heads, the digits being added and the answer are gold; at 0.5 the rods are brown like boxwood and the gold turns blue, at 0.75 they are green and it turns pink.
// Knob 2: Speed. At 2 each rod takes 0.45 s to fall, 0.12 s after the one before; each digit of the multiplier takes 2.1 s, 0.3 s to light its row, 0.32 s for each of the five diagonals and 0.2 s to rest; the rule takes 0.3 s and each column of the sum 0.26 s, and the answer stands 1.8 s before the rods fall out in 0.6 s. 1617 x 67 takes 9.5 s, 1089 x 9 takes 5.5 s and 1550 x 128 takes 11.6 s. Every time goes as 2 / Speed.
// Knob 3: Problem. 0 is 1617 x 67, the year of Rabdologiæ by the 67 years since Napier's birth in 1550; 1 is 1550 x 128, that year by the panel's height; 2 is 1089 x 9 = 9801 and 3 is 2178 x 4 = 8712, the only four-digit numbers that a multiple turns back to front; 4 is 3367 x 33 = 111111 and 5 is 2439 x 41 = 99999. Each problem is followed by the next, and turning the knob starts the one it points at from the top.
// Knob 4: Bands. Gives each diagonal of the lattice a hue of its own, on the wood and on the digits: the units half of a rod and the tens half of the rod to its right, the two that are added together, share one. Nothing at 0, too faint to see at the opening 0.06, and at 1 five hues a tenth of the wheel apart, so the diagonals read as stripes down all nine rows.

// Each rod is headed by a digit d, and its k-th square holds k times d, the
// tens above the diagonal and the units below it. Lay the index rod and the
// rods for 1617 side by side and row 7 reads 0/7 4/2 0/7 4/9: 7 x 1, 7 x 6,
// 7 x 1, 7 x 7. The units of one rod and the tens of the rod to its right
// lie between the same two diagonals and count the same power of ten, so
// adding along the diagonals from the right, carrying as you go, gives
// 9, 7 + 4 = 11, 2 + 0 + 1 = 3, 7 + 4 = 11 and 0 + 1 = 1: 1617 x 7 = 11319,
// with no multiplying done. A multiplier of more digits reads one row for
// each digit, from its last, and the partial products are added each one
// place to the left of the one before.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// 3 by 5 digits, five rows of three bits, the left LED the high bit.
const DIGIT = ["75557", "26227", "71747", "71717", "55711", "74717", "74757", "71122", "75757", "75717"].map((s) => s.split("").map(Number));
const TIMES = [5, 2, 5];

// Multiplicand and multiplier.
const PROBLEMS = [
  ["1617", "67"],
  ["1550", "128"],
  ["1089", "9"],
  ["2178", "4"],
  ["3367", "33"],
  ["2439", "41"],
];

// Rods: the index rod 8 LEDs wide, then four rods 13 wide, one dark LED
// between. Each is 101 rows: a head, nine squares of 10 rows, edges.
const X0 = [0, 9, 23, 37, 51], RW = [8, 13, 13, 13, 13];
// The diagonal of a square, from its lower left corner to its upper right:
// the row it crosses in each column 1..11.
const DIAG = [0, 9, 8, 7, 7, 6, 5, 4, 3, 3, 2, 1];
const ROWS = 101, WORK = 102;

// Seconds at Speed 2.
const DROP = 0.45, STAG = 0.12, T1 = 1.0, LIGHT = 0.3, BAND = 0.32, REST = 0.2, ROW = LIGHT + 5 * BAND + REST;
const RULE = 0.3, COL = 0.26, HOLD = 1.8, FALL = 0.6;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

// The reading of one problem: for each multiplier digit, right to left,
// the five diagonals of its row with the carry each takes in and the digit
// it leaves; then the columns of the partial products added the same way.
function plan(a, b) {
  const A = a.split("").map(Number), M = b.split("").map(Number).reverse();
  const parts = M.map((k) => {
    const bands = [];
    let carry = 0;
    for (let j = 0; j < 5; j++) {
      // Diagonal j: the units of the rod for 10^j and the tens of the rod for 10^(j-1).
      const u = j <= 3 ? (k * A[3 - j]) % 10 : 0, t = j >= 1 ? floor((k * A[4 - j]) / 10) : 0, s = u + t + carry;
      bands.push({ cin: carry, d: s % 10 });
      carry = floor(s / 10);
    }
    let len = 5;
    while (len > 1 && bands[len - 1].d === 0) len--;
    return { k, bands, len };
  });
  const total = String(Number(a) * Number(b)), cols = [];
  let carry = 0;
  for (let e = 0; e < total.length; e++) {
    let s = carry;
    parts.forEach((p, i) => {
      const j = e - i;
      if (j >= 0 && j < p.len) s += p.bands[j].d;
    });
    cols.push({ cin: carry, d: s % 10 });
    carry = floor(s / 10);
  }
  const n = parts.length, sum = n > 1 ? T1 + n * ROW : 0, end = n > 1 ? sum + RULE + cols.length * COL : T1 + ROW;
  return { A, parts, cols, n, sum, end, length: end + HOLD + FALL };
}

export function setup(params) {
  params.s = { buf: new Float32Array(N * 3), tau: 0, pi: 0, P: plan(...PROBLEMS[0]), knob: -1, hue: 0, bands: 0.06 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.bands = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3), kp = round(cl(k[2] || 0, 0, PROBLEMS.length - 1));
  if (kp !== S.knob) {
    S.knob = kp;
    S.pi = kp;
    S.P = plan(...PROBLEMS[kp]);
    S.tau = 0;
  }
  S.tau += (d * speed) / 2;
  if (S.tau >= S.P.length) {
    S.tau -= S.P.length;
    S.pi = (S.pi + 1) % PROBLEMS.length;
    S.P = plan(...PROBLEMS[S.pi]);
  }
}

function put(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  if (a >= 1) {
    buf[p] = c[0];
    buf[p + 1] = c[1];
    buf[p + 2] = c[2];
  } else {
    buf[p] += (c[0] - buf[p]) * a;
    buf[p + 1] += (c[1] - buf[p + 1]) * a;
    buf[p + 2] += (c[2] - buf[p + 2]) * a;
  }
}

function glyph(buf, g, x, y, c, a) {
  for (let r = 0; r < g.length; r++) for (let i = 0; i < 3; i++) if ((g[r] >> (2 - i)) & 1) put(buf, x + i, y + r, c, a);
}

const scale = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, P = S.P, tau = S.tau, h = S.hue + 0.58, acc = h + 0.55;
  buf.fill(0);
  const C = {
    body: hsv(h, 0.5, 0.17), edge: hsv(h, 0.4, 0.38), line: hsv(h, 0.35, 0.3), dig: hsv(h, 0.12, 0.78),
    head: hsv(acc, 0.55, 1), lit: hsv(h, 0.45, 0.45), white: [1, 1, 1], fill: hsv(acc, 0.65, 0.3), gold: hsv(acc, 0.5, 1),
    done: hsv(acc, 0.25, 0.9), pale: hsv(h, 0.15, 0.92), rule: hsv(h, 0.3, 0.55), sum: hsv(acc, 0.6, 1),
  };
  // Bands: each diagonal of the lattice in a hue of its own, on the wood
  // and on its digits.
  const tint = [0, 1, 2, 3, 4].map((b) => mix(C.body, hsv(acc + 0.1 * b, 0.75, 0.5), S.bands));
  const ink = [0, 1, 2, 3, 4].map((b) => mix(C.dig, hsv(acc + 0.1 * b, 0.6, 0.95), S.bands));

  // Which row is lit and which diagonal is being added. While
  // a row is read the others dim, and so do all of them while the partial
  // products are added.
  let row = -1, light = 0, part = -1, band = -1;
  for (let i = 0; i < P.n; i++) {
    const r0 = T1 + i * ROW;
    if (tau >= r0 && tau < r0 + ROW + 0.15) {
      row = P.parts[i].k;
      part = i;
      light = smooth((tau - r0) / LIGHT) * (1 - smooth((tau - r0 - ROW + REST) / (REST + 0.15)));
      band = tau - r0 < LIGHT ? -1 : floor((tau - r0 - LIGHT) / BAND);
    }
  }
  const out = P.length - FALL;
  const adding = P.n > 1 ? smooth((tau - P.sum) / RULE) * (1 - smooth((tau - P.end) / 0.4)) : 0;
  const dim = 1 - 0.45 * max(light, adding);

  for (let r = 0; r < 5; r++) {
    // Each rod falls in from above, one after another, and falls out below.
    const uin = cl((tau - STAG * r) / DROP, 0, 1), uout = cl((tau - out - STAG * r * 0.25) / (FALL * 0.8), 0, 1);
    if (uin <= 0 || uout >= 1) continue;
    const oy = round(-(ROWS + 2) * (1 - uin * uin) + (H + 2) * uout * uout);
    const x0 = X0[r], w = RW[r], dgt = r ? P.A[r - 1] : 0, place = 4 - r;
    for (let sq = 0; sq <= 10; sq++) {
      const lit = sq === row ? light : 0, f = sq === row ? 1 : dim;
      // The two halves of a square: units at this rod's place, tens one up.
      let cu = r && sq ? tint[place] : C.body, ct = r && sq ? tint[min(4, place + 1)] : C.body;
      cu = mix(scale(cu, f), C.lit, lit);
      ct = mix(scale(ct, f), C.lit, lit);
      if (lit && band === place) cu = mix(cu, C.fill, lit);
      if (lit && band === place + 1) ct = mix(ct, C.fill, lit);
      const ln = mix(scale(C.line, f), C.edge, lit), ed = scale(C.edge, sq ? f : 1);
      for (let ly = 0; ly < 10; ly++) {
        const ry = sq * 10 + ly, y = ry + oy;
        if (ry >= ROWS) break;
        if (y < 0 || y >= H) continue;
        for (let lx = 0, p = (y * W + x0) * 3; lx < w; lx++, p += 3) {
          let c;
          if (lx === 0 || lx === w - 1 || ry === 0 || ry === 100) c = ed;
          else if (ly === 0 || (r && sq && ly === DIAG[lx])) c = ln;
          else c = r && sq && ly < DIAG[lx] ? ct : cu;
          buf[p] = c[0];
          buf[p + 1] = c[1];
          buf[p + 2] = c[2];
        }
      }
    }
    // The digits: the head's at row 3, the squares' from their row 1. A
    // tens digit of 0 is drawn half as bright.
    if (r) glyph(buf, DIGIT[dgt], x0 + 5, oy + 3, C.head, 1);
    else glyph(buf, TIMES, x0 + 2, oy + 4, C.head, 1);
    for (let sq = 1; sq <= 9; sq++) {
      const y = sq * 10 + oy + 1, lit = sq === row ? light : 0, f = sq === row ? 1 : dim;
      if (!r) {
        glyph(buf, DIGIT[sq], x0 + 2, y + 2, mix(scale(C.dig, f), C.gold, lit), 1);
        continue;
      }
      const v = sq * dgt, t = floor(v / 10), u = v % 10;
      const tc = band === place + 1 ? C.gold : band > place + 1 ? C.done : C.white;
      const uc = band === place ? C.gold : band > place ? C.done : C.white;
      glyph(buf, DIGIT[t], x0 + 2, y, mix(scale(ink[min(4, place + 1)], t ? f : f * 0.5), tc, lit), 1);
      glyph(buf, DIGIT[u], x0 + 8, y + 4, mix(scale(ink[place], f), uc, lit), 1);
    }
    // A carry steps from the units of this rod to its tens, the next diagonal.
    if (row > 0 && r && band === place + 1 && band <= 4 && P.parts[part].bands[band].cin) {
      const f = smooth((tau - T1 - part * ROW - LIGHT - band * BAND) / (BAND * 0.45));
      const cx = round(x0 + 9 - 6 * f), cy = row * 10 + 10 + oy;
      put(buf, cx, cy, C.gold, light);
      put(buf, cx + 1, cy, C.gold, light);
    }
  }

  // Underneath: the multiplier at the left, the digit being read in gold,
  // then the partial products as they are read, then their sum.
  const fade = 1 - smooth((tau - out) / (FALL * 0.7));
  const xOf = (e) => 60 - 4 * e, mul = PROBLEMS[S.pi][1];
  const shown = fade * smooth((tau - 0.6) / 0.3);
  glyph(buf, TIMES, 1, WORK + 1, C.rule, shown);
  for (let j = 0; j < mul.length; j++) glyph(buf, DIGIT[+mul[j]], 5 + 4 * j, WORK, mix(C.pale, C.gold, part === mul.length - 1 - j ? light : 0), shown);
  for (let i = 0; i < P.n; i++) {
    const p = P.parts[i], r0 = T1 + i * ROW, y = WORK + 6 * i, single = P.n === 1;
    for (let j = 0; j < p.len; j++) {
      const at = r0 + LIGHT + (j + 0.5) * BAND;
      if (tau < at) break;
      const flash = 1 - smooth((tau - at) / 0.35);
      let c = mix(single ? C.sum : C.pale, C.white, flash);
      if (P.n > 1 && tau >= P.sum + RULE) {
        const e = i + j, ce = floor((tau - P.sum - RULE) / COL);
        if (ce === e) c = C.gold;
      }
      glyph(buf, DIGIT[p.bands[j].d], xOf(i + j), y, c, fade);
    }
  }
  if (P.n > 1 && tau >= P.sum) {
    const yr = WORK + 6 * P.n, len = round(26 * smooth((tau - P.sum) / RULE));
    for (let x = 0; x < len; x++) put(buf, 62 - x, yr, C.rule, fade);
    for (let e = 0; e < P.cols.length; e++) {
      const at = P.sum + RULE + (e + 0.5) * COL;
      if (tau < at) break;
      const flash = 1 - smooth((tau - at) / 0.35);
      glyph(buf, DIGIT[P.cols[e].d], xOf(e), yr + 2, mix(C.sum, C.white, flash), fade);
      // The carry into the next column, on the rule.
      const nx = P.cols[e + 1];
      if (nx && nx.cin && tau < at + COL) {
        const f = smooth((tau - at) / (COL * 0.5)), cx = round(xOf(e) + 1 - 4 * f);
        put(buf, cx, yr, C.gold, fade);
        put(buf, cx + 1, yr, C.gold, fade);
      }
    }
  }

  for (let i = 0; i < N; i++)
    display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
