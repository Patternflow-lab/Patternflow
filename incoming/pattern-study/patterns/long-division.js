// ===== Patternflow pattern =====
// Title:   Long Division
// Family:  type
// Idea:    Long division of 1/p is written down the panel in drawn digits: a zero falls from the dividend, a quotient digit goes up top, the product is written under and ruled off, the remainder goes below, until a remainder comes back, it and the numerator glow gold and a bar is drawn over the repeating quotient digits.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the period of 1/p as the order of 10 mod p (Carl Friedrich Gauss, 1801), Midy's theorem (Etienne Midy, 1836), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Divisor=7..97, Base=10..16
//
// Knob 1: Hue. Turns the sheet round the wheel: at 0 the working is cyan and the quotient violet, and the remainder that comes halfway through an even period is green. The two numbers that close the cycle, the bar over the repetend and Midy's sum are always gold.
// Knob 2: Speed. At 2 a step with a two-digit product takes 1.2 s and each later step 0.88 times the one before, down to 0.3 of it. 1/7 is worked out in 5.4 s, its bar is drawn by 7.0 s and Midy's sum by 8.6 s, and the next numerator comes at 11.1 s; 1/97 closes its cycle at 41.5 s. The first frame already has 2.4 s of the sheet written at the knob's speed. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Divisor. The prime p, snapped to the nearest prime from 7 to 97. In base 10 the quotient repeats after the order of 10 mod p: 6 digits for 7 and 13, 16 for 17, 18 for 19, 8 for 73, 96 for 97. When the sheet runs off the panel the view follows the staircase down and right, the quotient and dividend rows stay pinned at the top, and once the cycle closes the view runs back up the staircase while the bar is drawn. Each new sheet takes the next numerator, 1/p, 2/p, 3/p and on; for 7, 17, 19, 23, 29, 47, 59, 61 and 97 they all repeat the same digits from a different place.
// Knob 4: Base. Works the division in bases 10 to 16, with A to F past nine. 1/7 has period 6 in base 10 (142857) and 12 (186A35), 3 in base 11 (163) and 16 (249), 2 in base 13 (1B), 1 in base 15 (2) and stops after one digit in base 14 (2). When the period is even, the remainder p - n comes exactly halfway and the two halves of the repetend add to a row of the base's top digit: 142 + 857 = 999, 186 + A35 = BBB. The sum is written in the corner when the halves are four digits or less.
// Buttons: K1 tap goes on to the next numerator.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, exp, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// Digits 0-9, A-F and a plus sign, 6 x 7 with two-LED downstrokes, the way a
// soft pencil leaves them on squared paper: an open 4, a flagged 1 with no
// foot, a 9 with a tail.
const GLYPHS = [
  [".####.", "##..##", "##..##", "##..##", "##..##", "##..##", ".####."],
  ["..##..", ".###..", "..##..", "..##..", "..##..", "..##..", "..##.."],
  [".####.", "##..##", "....##", "...##.", "..##..", ".##...", "######"],
  [".####.", "##..##", "....##", "..###.", "....##", "##..##", ".####."],
  ["##..##", "##..##", "##..##", "######", "....##", "....##", "....##"],
  ["######", "##....", "#####.", "....##", "....##", "##..##", ".####."],
  ["..###.", ".##...", "##....", "#####.", "##..##", "##..##", ".####."],
  ["######", "....##", "...##.", "..##..", ".##...", ".##...", ".##..."],
  [".####.", "##..##", "##..##", ".####.", "##..##", "##..##", ".####."],
  [".####.", "##..##", "##..##", ".#####", "....##", "...##.", ".###.."],
  ["..##..", ".####.", "##..##", "##..##", "######", "##..##", "##..##"],
  ["#####.", "##..##", "##..##", "#####.", "##..##", "##..##", "#####."],
  [".####.", "##..##", "##....", "##....", "##....", "##..##", ".####."],
  ["####..", "##.##.", "##..##", "##..##", "##..##", "##.##.", "####.."],
  ["######", "##....", "##....", "#####.", "##....", "##....", "######"],
  ["######", "##....", "##....", "#####.", "##....", "##....", "##...."],
  ["......", "..##..", "..##..", "######", "..##..", "..##..", "......"],
];
const PLUS = 16;
const FONT = GLYPHS.map((rows) => {
  const m = new Uint8Array(42);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 6; x++) m[y * 6 + x] = rows[y][x] === "#" ? 1 : 0;
  return m;
});

// The squared paper: cells 7 LEDs wide and 9 high. Row 0 holds the quotient,
// row 1 the divisor, the bracket and the dividend; after that odd rows hold
// a number brought down and even rows the product under it, nudged up one LED
// so the rule under a product has a clear LED on both sides.
const CW = 7, CH = 9, X0 = 1, Y0 = 2, BR = 3, DP = 2, CLIP = 19;
const PRIMES = [7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

const K_DIV = 0, K_NUM = 1, K_Q0 = 2, K_QUOT = 3, K_PROD = 4, K_REM = 5, K_DOWN = 6, K_MIDY = 7, K_SUM = 8;

const digits = (v, b) => {
  const d = [];
  do {
    d.unshift(v % b);
    v = floor(v / b);
  } while (v > 0);
  return d;
};
const rowY = (r) => Y0 + r * CH - (r >= 2 && r % 2 === 0 ? 1 : 0);

export function setup(params) {
  params.s = {
    p: 0, b: 0, n: 1, sheet: null, t: 0, camX: 0, camY: 0, fresh: true,
    hue: 0, speed: 2, buf: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
}

// Lays the whole sheet out as a timeline: every glyph and rule gets its cell
// and the sheet-second it is written, at Speed 2.
function newSheet(S) {
  const p = S.p, b = S.b, n = S.n;
  const pd = digits(p, b), nd = digits(n, b), lenP = pd.length, c1 = lenP + nd.length - 1;
  const items = [], rules = [], steps = [];
  const add = (k, g, row, col, t0, d) => {
    items.push({ k, g, row, col, t0, d, glow: 0, half: 0 });
    return items.length - 1;
  };
  pd.forEach((g, i) => add(K_DIV, g, 1, i, 0.06 * i, 0.12));
  const numItems = nd.map((g, i) => add(K_NUM, g, 1, lenP + i, 0.18 + 0.06 * i, 0.12));
  add(K_Q0, 0, 0, c1, 0.4, 0.12);
  let t = 0.6, r = n, rowN = 1, k = 0, end = null;
  let remItems = numItems.slice();
  const seen = new Map([[n, { step: 0, items: numItems.slice() }]]);
  while (!end && k < 200) {
    k++;
    const f = max(0.3, pow(0.88, k - 1));
    const N = r * b, q = floor(N / p), P = q * p, r2 = N - P, cu = c1 + k;
    const st = { k, q, cu, rowN, t0: t };
    // The zero for step 1 is the dividend's own first zero; after that each
    // one falls from the dividend row to sit beside the remainder.
    if (k > 1) {
      remItems.push(add(K_DOWN, 0, rowN, cu, t, 0.3 * f));
      t += 0.36 * f;
    } else remItems.push(-1);
    st.tq = t;
    add(K_QUOT, q, 0, cu, t, 0.2 * f);
    t += 0.24 * f;
    if (q > 0) {
      const dp = digits(P, b);
      for (let i = dp.length - 1; i >= 0; i--) {
        add(K_PROD, dp[i], rowN + 1, cu - (dp.length - 1 - i), t, 0.1 * f);
        t += 0.12 * f;
      }
      rules.push({ row: rowN + 1, a: cu - dp.length + 1, b: cu, t0: t, d: 0.12 * f });
      t += 0.14 * f;
      const dr = digits(r2, b);
      remItems = [];
      for (let i = dr.length - 1; i >= 0; i--) {
        remItems.unshift(add(K_REM, dr[i], rowN + 2, cu - (dr.length - 1 - i), t, 0.1 * f));
        t += 0.12 * f;
      }
      rowN += 2;
    }
    st.rowR = rowN;
    steps.push(st);
    if (r2 === 0) {
      end = { term: true };
      for (const i of remItems) if (i >= 0) items[i].glow = 1;
    }
    else if (seen.has(r2)) end = { from: seen.get(r2), mine: remItems.filter((i) => i >= 0) };
    else seen.set(r2, { step: k, items: remItems.filter((i) => i >= 0) });
    r = r2;
    t += 0.08 * f;
  }
  const S2 = { p, b, n, lenP, c1, items, rules, steps, tEnd: t, end, L: 0, vin: null, midy: false };
  let tail = t + 2.4;
  if (end.from) {
    const j = end.from.step, L = k - j;
    S2.L = L;
    for (const i of end.mine) items[i].glow = 1;
    for (const i of end.from.items) items[i].glow = 1;
    // Midy: with an even period the remainder halfway is p - n, and each
    // quotient digit there on is the base's top digit minus the one half a
    // period back.
    if (L % 2 === 0) {
      const half = steps[j + L / 2 - 1];
      for (const it of items) if (it.k === K_REM && it.row === half.rowR && half.q > 0) it.half = 1;
    }
    const dV = 0.5 + 0.035 * L;
    S2.vin = { a: c1 + j + 1, b: c1 + k, j, t0: t + 0.9, d: dV };
    tail = t + 0.9 + dV + 0.3;
    if (L % 2 === 0 && L / 2 <= 4) {
      // The sum is written in the corner the staircase leaves empty.
      const qs = steps.slice(j, k).map((s) => s.q), h = L / 2;
      let tm = tail;
      const put = (k2, g, row, col) => {
        add(k2, g, row, col, tm, 0.1);
        tm += 0.11;
      };
      for (let i = 0; i < h; i++) put(K_MIDY, qs[i], 11, 1 + i);
      put(K_MIDY, PLUS, 12, 0);
      for (let i = 0; i < h; i++) put(K_MIDY, qs[h + i], 12, 1 + i);
      S2.midyRule = { t0: tm, d: 0.15, a: 0, b: h };
      tm += 0.2;
      for (let i = h - 1; i >= 0; i--) put(K_SUM, b - 1, 13, 1 + i);
      S2.midy = true;
      tail = tm;
    }
    tail += 1.6;
  }
  // The sheet slides up by its own height, so a short one is not followed by
  // an empty panel.
  S2.lift = min(H + 12, rowY(max(S2.midy ? 13 : 0, rowN)) + 12);
  S2.tOut = tail;
  S2.tNext = tail + 0.9;
  S.sheet = S2;
  S.t = 0;
  S.cur = 0;
}

// The x of a column before the view scrolls: the bracket takes three LEDs
// between the divisor and the dividend, and the decimal point two.
const colX = (Sh, c) => X0 + c * CW + (c >= Sh.lenP ? BR : 0) + (c > Sh.c1 ? DP : 0);

function camTarget(S) {
  const Sh = S.sheet, t = S.t;
  let row = 1, col = Sh.c1 + 1;
  if (Sh.vin && t >= Sh.vin.t0) {
    // Back up the staircase as the bar is drawn from the last digit to the first.
    const u = ease((t - Sh.vin.t0) / Sh.vin.d), L = Sh.L;
    const s = Sh.steps[Sh.vin.j + max(0, L - 1 - floor(u * L))];
    row = s.rowR;
    col = s.cu;
    if (u >= 1) row = col = 0;
  } else if (S.t >= 0.6) {
    // Each step is framed when it starts: down to its remainder and across
    // to the cell where the next zero will land.
    const st = Sh.steps;
    while (S.cur + 1 < st.length && st[S.cur + 1].t0 <= t) S.cur++;
    const s = st[S.cur];
    row = s.rowR;
    col = s.cu + (S.cur + 1 < st.length ? 1 : 0);
  }
  const tx = max(0, colX(Sh, col) + CW + 1 - W), ty = max(0, rowY(row) + 7 - (H - 1));
  return [tx, ty];
}

function advance(S, d) {
  S.t += d;
  const Sh = S.sheet;
  if (S.t >= Sh.tNext) {
    S.n = (S.n % (S.p - 1)) + 1;
    newSheet(S);
    S.camX = S.camY = 0;
    return;
  }
  const [tx, ty] = camTarget(S), k = 1 - exp(-d * (Sh.vin && S.t >= Sh.vin.t0 ? 9 : 6));
  S.camX += (tx - S.camX) * k;
  S.camY += (ty - S.camY) * k;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 7, 10];
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1], 0.2, 3);
  const want = cl(kv[2], 7, 97);
  let p = 7;
  for (const q of PRIMES) if (abs(q - want) < abs(p - want)) p = q;
  const b = cl(round(kv[3]), 10, 16);
  if (p !== S.p || b !== S.b) {
    S.p = p;
    S.b = b;
    S.n = 1;
    newSheet(S);
    S.camX = S.camY = 0;
  }
  if (input.btnPressed && input.btnPressed[0]) S.sheet.tNext = S.t;
  const step = 1 / 30;
  if (S.fresh) {
    // The first frame comes with 2.4 s of the sheet already written.
    S.fresh = false;
    for (let i = 0; i < 72; i++) advance(S, (step * S.speed) / 2);
  }
  let rem = (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  while (rem > 1e-9) {
    const d = min(step, rem);
    advance(S, d);
    rem -= d;
  }
}

function hash(a, b, c) {
  let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 255) / 255;
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  if (r > buf[o]) buf[o] = r;
  if (g > buf[o + 1]) buf[o + 1] = g;
  if (b > buf[o + 2]) buf[o + 2] = b;
}

// One glyph, written top to bottom as u goes from 0 to 1, with the grain of
// a pencil: each LED of each written glyph keeps its own pressure.
function glyph(S, g, x0, y0, u, rgb, seed, yMin, xMin) {
  const m = FONT[g], rows = u >= 1 ? 7 : floor(u * 7.99), buf = S.buf;
  for (let y = 0; y < rows; y++) {
    const yy = y0 + y;
    if (yy < yMin || yy >= H) continue;
    for (let x = 0; x < 6; x++) {
      if (!m[y * 6 + x] || x0 + x < xMin) continue;
      const v = 0.8 + 0.2 * hash(seed, x, y);
      put(buf, x0 + x, yy, rgb[0] * v, rgb[1] * v, rgb[2] * v);
    }
  }
}

function hline(S, x0, x1, y, rgb, yMin) {
  if (y < yMin || y >= H) return;
  for (let x = max(0, x0); x <= min(W - 1, x1); x++) put(S.buf, x, y, rgb[0], rgb[1], rgb[2]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.sheet) return;
  const Sh = S.sheet, buf = S.buf, t = S.t, c = S.c, h0 = S.hue + 0.5;
  buf.fill(0);
  const out = t > Sh.tOut ? round(ease((t - Sh.tOut) / 0.9) * Sh.lift) : 0;
  const camX = round(S.camX), camY = round(S.camY), fx = colX(Sh, Sh.c1 + 1);
  // Once the view has scrolled, the pinned rows keep one empty cell after the
  // decimal point with an ellipsis in it, so 0.0103 never reads as 0.03.
  const xCut = S.camX >= 1 ? fx + CW : -99;
  const pulse = 0.82 + 0.18 * sin((t - Sh.tEnd) * 6);
  const gold = [0, 0, 0], work = [0, 0, 0], quot = [0, 0, 0], ink = [0, 0, 0];
  hsv(0.13, 0.55, pulse, gold);
  hsv(h0 + 0.25, 0.7, 1, quot);
  const yMinWork = CLIP - out;
  // Where a cell lands on the panel: rows 0 and 1 stay pinned at the top,
  // and the columns at and left of the numerator's last digit stay put.
  const at = (row, col) => {
    const pinnedRow = row <= 1, frozen = pinnedRow && col <= Sh.c1;
    const x = colX(Sh, col) - (frozen ? 0 : camX) + 1;
    const y = rowY(row) - (pinnedRow ? 0 : camY) - out;
    return [x, y, pinnedRow && !frozen];
  };
  // The dividend's zeros, as far as the paper goes.
  hsv(h0, 0.5, 0.5, work);
  const cur = Sh.steps.length ? Sh.c1 + Sh.steps.length + 2 : 0;
  for (let col = Sh.c1 + 1; col < Sh.c1 + 199; col++) {
    const [x, y] = at(1, col);
    if (x >= W || col > cur) break;
    if (x < xCut - 6 || t < 0.3 + 0.03 * (col - Sh.c1)) continue;
    glyph(S, 0, x, y, 1, work, col * 7 + 3, -99, xCut);
  }
  // The bracket and the bar over the dividend, then the decimal points.
  hsv(h0, 0.35, 0.8, ink);
  const bx = colX(Sh, Sh.lenP) - 2, by = rowY(1) - out, y0 = rowY(0) - out;
  const ub = cl((t - 0.1) / 0.4, 0, 1);
  if (ub > 0) {
    put(buf, bx, by - 1, ink[0], ink[1], ink[2]);
    put(buf, bx, by, ink[0], ink[1], ink[2]);
    for (let y = by + 1; y < by + 7; y++) put(buf, bx + 1, y, ink[0], ink[1], ink[2]);
    put(buf, bx, by + 7, ink[0], ink[1], ink[2]);
    hline(S, bx + 1, bx + 1 + round((W - bx) * ub), by - 1, ink, -99);
    put(buf, fx - 1, by + 6, ink[0], ink[1], ink[2]);
    if (t > 0.45) put(buf, fx - 1, y0 + 6, quot[0], quot[1], quot[2]);
    if (xCut > 0)
      for (let i = 1; i < 6; i += 2) {
        put(buf, fx + i, by + 6, work[0], work[1], work[2]);
        if (t > 0.6) put(buf, fx + i, y0 + 6, quot[0] * 0.6, quot[1] * 0.6, quot[2] * 0.6);
      }
  }
  // The rules under the products.
  hsv(h0, 0.5, 0.62, ink);
  for (const r of Sh.rules) {
    if (t < r.t0) break;
    const [xa, y] = at(r.row, r.a), [xb] = at(r.row, r.b);
    if (y + 8 < yMinWork || y >= H || xb + 6 < 0 || xa - 1 >= W) continue;
    const u = cl((t - r.t0) / r.d, 0, 1);
    hline(S, xb + 6 - round((xb + 7 - xa) * u), xb + 6, y + 8, ink, yMinWork);
  }
  if (Sh.midyRule && t >= Sh.midyRule.t0) {
    const u = cl((t - Sh.midyRule.t0) / Sh.midyRule.d, 0, 1), y = rowY(12) + 8 - out;
    hline(S, X0, X0 + round((Sh.midyRule.b * CW + 7) * u), y, ink, -99);
  }
  // Every glyph written so far.
  const glowOn = t >= Sh.tEnd;
  for (let i = 0; i < Sh.items.length; i++) {
    const it = Sh.items[i];
    if (t < it.t0) break;
    let x, y, pinned;
    if (it.k === K_MIDY || it.k === K_SUM) {
      x = X0 + it.col * CW + 1;
      y = rowY(it.row) - out;
      pinned = false;
    } else [x, y, pinned] = at(it.row, it.col);
    let u = (t - it.t0) / it.d;
    if (it.k === K_DOWN && u < 1) {
      // The zero falls from the dividend row to its place.
      const y1 = rowY(1) - out, e = ease(u);
      y = round(y1 + (y - y1) * e);
      u = 1;
    }
    if (x <= -6 || x >= W || y <= -8 || y >= H) continue;
    const yMin = it.row >= 2 ? yMinWork : -99;
    let rgb;
    if (it.glow && glowOn) rgb = gold;
    else {
      const k = it.k;
      if (k === K_DIV) hsv(h0, 0.3, 0.95, c);
      else if (k === K_QUOT || k === K_Q0 || k === K_MIDY) hsv(h0 + 0.25, 0.7, 1, c);
      else if (k === K_SUM) hsv(0.13, 0.55, 1, c);
      else if (it.half) hsv(h0 - 0.17, 0.6, 1, c);
      else hsv(h0, 0.7, k === K_PROD ? 0.78 : k === K_DOWN ? 0.88 : 1, c);
      // Fresh graphite: white as it is written, settling into its colour.
      const w = 1 - cl((t - it.t0 - it.d) / 0.35, 0, 1);
      c[0] += (255 - c[0]) * w * 0.85;
      c[1] += (255 - c[1]) * w * 0.85;
      c[2] += (255 - c[2]) * w * 0.85;
      rgb = c;
    }
    glyph(S, it.g, x, y, cl(u, 0, 1), rgb, i * 13 + 5, yMin, pinned ? xCut : -99);
  }
  // The bar over the repetend, drawn from its last digit back to its first.
  if (Sh.vin && t >= Sh.vin.t0) {
    const v = Sh.vin, u = ease((t - v.t0) / v.d);
    const [xa] = at(0, v.a), [xb] = at(0, v.b), y = y0 - 2;
    const xl = round(xb + 6 - (xb + 6 - xa) * u);
    hline(S, max(xl, xCut, fx - 1), xb + 6, y, gold, -99);
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
