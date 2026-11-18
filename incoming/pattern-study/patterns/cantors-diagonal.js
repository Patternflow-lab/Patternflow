// ===== Patternflow pattern =====
// Title:   Cantor's Diagonal
// Family:  cells
// Idea:    A table of the digits of real numbers, one number to a row, has its diagonal read off cell by cell, each diagonal digit falls to a fresh row and goes up by one, a beam runs from every new digit up to its own diagonal cell to show the two differ, and the new number then rises through the list and goes in at the top, so the next round runs the argument again on a list that holds the number the last round proved missing.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Cantor's diagonal argument (Georg Cantor, 1891, year from memory; his sequences were written with two signs, m and w, from memory), the digits taken in a base of 2 to 5, pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Base=2..5, Size=10..28
//
// Knob 1: Hue. Turns every digit colour round the wheel together. At 0 base 2 is cyan and pink, base 3 cyan with magenta and yellow, base 4 cyan with violet, red and green; at 0.25 base 2 is violet and gold, at 0.5 red and green, at 0.75 green and blue. The check is always green.
// Knob 2: Speed. At 2 a round takes 7.5 s: the diagonal is read in 1.3 s, the new digits fall in 1.5 s, the beams run for 2.25 s and the new number rises and goes in during the last 0.9 s. At 10 numbers the diagonal lights a cell every 0.13 s and at 28 every 46 ms. Every time goes as 2 / Speed, so a round is 75 s at 0.2 and 5 s at 3.
// Knob 3: Base. The number of digits, 2 to 5, so also of digit colours. Every row is expanded again in the new base: the first row, the root of 2 less 1, reads 0110101000 in base 2 and 1020112212 in base 3, and 1/7 reads 001001001 in base 2 and 010212010 in base 3, the digits repeating. Turning it clears the list and starts from the first numbers; at the opening (base 2, Size 10) the diagonal reads 0010110101 and the new number is 1101001010.
// Knob 4: Size. The table's side, 10 to 28 numbers and digits. Cells are 5 x 5 LEDs at 10, 4 x 4 at 11 and 12, 3 x 3 at 13 to 15, 2 x 2 from 16, with a dark line between them up to 20 and none from 21; the table is 60 LEDs across at 10, 12, 15 and 20, and 56 at 28. The list goes on below the table, 20 rows in all at 10 and 59 at 28.

// Cantor showed that no list of the real numbers between 0 and 1 is
// complete: take the n-th digit of the n-th number, change it, and the
// number made of the changed digits differs from the n-th number at its
// n-th place, whatever n is. The list is drawn from a pool of 61 numbers:
// the square roots of the primes to 131, pi, e, the golden ratio, ln 2,
// sin 1, cos 1 and 1/e, with a fraction over a prime from 7 to 97 after
// every third. The fractions repeat, which shows as stripes among rows
// that never do. The square table is the corner of an
// infinite one; a row's digits past the n-th are not shown, and the new
// number is only n digits long, so what is proved on the panel is that it
// differs from each of the n rows shown. The rows below the table are the
// list going on. When the new number goes in, the bottom row falls off the
// panel, and a bar at the left edge marks every row that is a new number,
// so after a few rounds the top of the list is a stack of them.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
const ND = 28; // digits kept for every number

// ---- The numbers. Every digit comes from exact arithmetic, never from a
// double's last bits, so a 28 digit row is right in base 2 and in base 5.
//
// Rationals p/q and the convergents of continued fractions (square roots
// of the primes, the golden ratio) are expanded by long division on
// integers kept under 2^53. The convergent is cut once q passes 1e15, so
// its error is about 1e-28, more than base 5 needs for 28 digits (2e-20).
// Pi, e, 1/e, ln 2, sin 1 and cos 1 are summed from their series on a
// fixed point number of six 24 bit limbs after the point, 144 bits, which
// needs only division by small integers: pi = 16 atan(1/5) - 4 atan(1/239).
const LB = 16777216, NL = 6;
const fx = () => new Float64Array(NL + 1);
const alive = (t) => t.some((v) => v !== 0);
function fdiv(a, d) {
  let r = 0;
  for (let i = 0; i <= NL; i++) {
    const c = r * LB + a[i];
    a[i] = floor(c / d);
    r = c - a[i] * d;
  }
}
function fmul(a, m) {
  let c = 0;
  for (let i = NL; i >= 0; i--) {
    const v = a[i] * m + c;
    a[i] = i ? v % LB : v;
    c = floor(v / LB);
  }
}
function fadd(a, b, s) {
  let c = 0;
  for (let i = NL; i >= 0; i--) {
    let v = a[i] + s * b[i] + c;
    c = 0;
    if (v < 0) (v += LB), (c = -1);
    else if (v >= LB) (v -= LB), (c = 1);
    a[i] = v;
  }
}
// Sum of t_0 + t_1 + ..., where next(t, j) turns t_j into t_(j+1); the
// sign of term j is sg(j).
function series(next, sg) {
  const t = fx(), s = fx();
  t[0] = 1;
  for (let j = 0; alive(t); j++) {
    fadd(s, t, sg(j));
    next(t, j);
  }
  return s;
}
const plus = () => 1, alt = (j) => (j & 1 ? -1 : 1);
function atanInv(m) {
  const t = fx(), s = fx(), u = fx();
  t[0] = 1;
  fdiv(t, m);
  for (let j = 0; alive(t); j++) {
    u.set(t);
    fdiv(u, 2 * j + 1);
    fadd(s, u, alt(j));
    fdiv(t, m * m);
  }
  return s;
}
function makePi() {
  const a = atanInv(5), b = atanInv(239);
  fmul(a, 16);
  fmul(b, 4);
  fadd(a, b, -1);
  return a;
}
function makeLn2() {
  const t = fx(), s = fx(), u = fx();
  t[0] = 1;
  fdiv(t, 2);
  for (let k = 1; alive(t); k++) {
    u.set(t);
    fdiv(u, k);
    fadd(s, u, 1);
    fdiv(t, 2);
  }
  return s;
}
// Partial quotients of sqrt(n), by the standard recurrence.
function sqrtCF(n) {
  const a0 = floor(sqrt(n)), cf = [a0];
  let m = 0, d = 1, a = a0;
  for (let i = 0; i < 100; i++) {
    m = d * a - m;
    d = (n - m * m) / d;
    a = floor((a0 + m) / d);
    cf.push(a);
  }
  return cf;
}
// The last convergent p/q of a continued fraction that stays exact.
function convergent(cf) {
  let p1 = 1, q1 = 0, p = cf[0], q = 1;
  for (let i = 1; i < cf.length; i++) {
    const p2 = cf[i] * p + p1, q2 = cf[i] * q + q1;
    if (q2 > 1e15 || p2 > 8.5e15) break;
    (p1 = p), (q1 = q), (p = p2), (q = q2);
  }
  return { p, q };
}
const root = (n) => convergent(sqrtCF(n));
const ratio = (p, q) => ({ p, q });

// Fractional digits of a source in base b, written into out.
function digitsOf(src, b, out) {
  if (src.fix) {
    const t = Float64Array.from(src.fix);
    for (let i = 0; i < ND; i++) {
      let c = 0;
      for (let k = NL; k >= 1; k--) {
        const v = t[k] * b + c;
        t[k] = v % LB;
        c = floor(v / LB);
      }
      out[i] = c;
    }
  } else {
    let r = src.p % src.q;
    for (let i = 0; i < ND; i++) {
      r *= b;
      out[i] = floor(r / src.q);
      r -= out[i] * src.q;
    }
  }
}

// The list: famous constants and roots of the primes, with a rational
// (whose digits repeat) after every third, so the stripes of a repeating
// expansion show among the numbers that never repeat.
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131];
const POOL = (() => {
  const phi = convergent(Array(80).fill(1));
  const irr = [
    root(2),
    { fix: makePi() },
    { fix: series((t, j) => fdiv(t, j + 1), plus) },
    root(3),
    phi,
    { fix: makeLn2() },
    root(5),
    { fix: series((t, j) => (fdiv(t, 2 * j + 2), fdiv(t, 2 * j + 3)), alt) },
    root(7),
    { fix: series((t, j) => (fdiv(t, 2 * j + 1), fdiv(t, 2 * j + 2)), alt) },
    root(11),
    { fix: series((t, j) => fdiv(t, j + 1), alt) },
  ];
  for (const p of PRIMES.slice(5)) irr.push(root(p));
  const rat = [ratio(1, 7), ratio(3, 11), ratio(5, 13), ratio(2, 17), ratio(1, 19), ratio(7, 23)];
  for (const q of [29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]) rat.push(ratio((3 * q + 7) % (q - 1) + 1, q));
  const out = [];
  for (let i = 0, j = 0; i < irr.length || j < rat.length; ) {
    for (let k = 0; k < 3 && i < irr.length; k++) out.push(irr[i++]);
    if (j < rat.length) out.push(rat[j++]);
  }
  return out;
})();

// ---- Time, in board seconds at Speed 2. One round of the argument:
// the list rests, the diagonal is read off cell by cell, each digit drops
// to a fresh row and goes up by one, a beam runs from every new digit to
// its diagonal cell, then the new number rises through the list and is
// inserted at the top.
const T_HOLD = 0.45, T_SWEEP = 1.3, T_PAUSE = 0.3;
const T_DROP = T_HOLD + T_SWEEP + T_PAUSE, SPREAD = 1.0, FLIGHT = 0.5;
const T_CHK = T_DROP + SPREAD + FLIGHT + 0.3, CHK = 1.8, STEP = 0.45;
const T_FLASH = T_CHK + CHK + STEP, FLASH = 0.5;
const T_RISE = T_FLASH + FLASH, RISE = 0.5;
const T_SHIFT = T_RISE + RISE, SHIFT = 0.4;
const T_END = T_SHIFT + SHIFT;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
// One colour per digit, evenly round the wheel. Blues carry less light than
// the other hues at the same value, so they are washed a little to match.
function digitColour(h) {
  const x = h - floor(h);
  return hsv(h, 0.85 - 0.3 * exp(-(((x - 0.62) / 0.1) ** 2)), 1);
}
const GREEN = [0.3, 1, 0.45], WHITE = [1, 1, 1], MARK = [1, 0.85, 0.6], CONT = 0.72;
const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

export function setup(params) {
  params.s = { n: 0, base: 0, hue: 0, speed: 2, t: 0, clock: 0, cache: {}, rgb: new Float32Array(N * 3), rows: [], D: null, pal: [] };
}

function digitsFor(S, m) {
  const c = S.cache[S.base] || (S.cache[S.base] = []);
  if (!c[m]) digitsOf(POOL[m % POOL.length], S.base, (c[m] = new Uint8Array(ND)));
  return c[m];
}

// A new list: the first numbers of the pool in the chosen base, as many
// rows as the panel holds below the table's own n.
function reset(S, n, base) {
  S.n = n;
  S.base = base;
  const cw = cl(floor(60 / n), 2, 6);
  S.cw = cw;
  S.ch = cw;
  S.ox = floor((W - n * cw) / 2);
  S.y0 = 1;
  S.yD = S.y0 + n * cw + 3;
  S.yS = S.yD + cw + 1;
  S.yC = S.yS + 5;
  S.LR = n + ceil((H - S.yC) / cw) + 1;
  S.rows = [];
  for (let i = 0; i < S.LR; i++) S.rows.push({ d: digitsFor(S, i), isD: false });
  S.t = 0;
  nextD(S);
}

// The new number: the n-th digit of the n-th row, one higher, wrapping.
function nextD(S) {
  const D = new Uint8Array(ND);
  for (let k = 0; k < S.n; k++) D[k] = (S.rows[k].d[k] + 1) % S.base;
  S.D = D;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 2, 10];
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const base = cl(round(kv[2]), 2, 5), n = cl(round(kv[3]), 10, 28);
  if (n !== S.n || base !== S.base) reset(S, n, base);
  S.pal = [];
  for (let d = 0; d < base; d++) S.pal.push(digitColour(S.hue + 0.52 + d * (base === 2 ? 0.38 : 1 / base)));
  const g = (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  S.t += g;
  S.clock += g;
  while (S.t >= T_END) {
    // The new number goes in at the top; the bottom row falls off.
    S.rows.unshift({ d: S.D, isD: true });
    S.rows.pop();
    S.t -= T_END;
    nextD(S);
  }
}

// ---- Drawing. Everything is laid into a float buffer, then written out.
function put(S, x, y, w, h, c, a, add) {
  const rgb = S.rgb;
  for (let yy = max(0, y); yy < min(H, y + h); yy++)
    for (let xx = max(0, x); xx < min(W, x + w); xx++) {
      const o = (yy * W + xx) * 3;
      if (add) {
        rgb[o] += c[0] * a;
        rgb[o + 1] += c[1] * a;
        rgb[o + 2] += c[2] * a;
      } else {
        rgb[o] = c[0] * a;
        rgb[o + 1] = c[1] * a;
        rgb[o + 2] = c[2] * a;
      }
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.rows.length) return;
  const { n, cw, ch, ox, y0, yD, yS, yC, LR, rows, D, pal, t } = S;
  // Cells from 3 LEDs up leave a dark line between them; 2 LED cells touch.
  const fw = cw > 2 ? cw - 1 : cw, fh = fw;
  S.rgb.fill(0);
  const e = sm((t - T_SHIFT) / SHIFT);
  const dimA = sm((t - T_HOLD) / 0.3) * (1 - e);
  const yOf = (f) => (f <= n - 1 ? y0 + f * ch : f >= n ? yC + (f - n) * ch : lerp(y0 + (n - 1) * ch, yC, f - (n - 1)));
  // Below the table the list goes on, dimmer and dimmer, a slow ripple running down it.
  const bri = (f) => (f <= n - 1 ? 1 : f < n ? lerp(1, CONT, f - (n - 1)) : CONT * (1 - 0.4 * ((f - n) / (LR - n))) * (0.9 + 0.1 * Math.sin(f * 0.9 - S.clock * 3)));
  const tDiag = (k) => T_HOLD + (T_SWEEP * k) / n;
  const tDrop = (k) => T_DROP + (SPREAD * k) / n;
  const tChk = (k) => T_CHK + (CHK * k) / n;
  const colX = (k) => ox + k * cw;
  const gone = 1 - sm((t - T_RISE) / 0.08);

  // Per column: the diagonal cell's light, the check's progress and the
  // new digit's weight, with the flash of each.
  const lit = [], chk = [], dk = [], hit = [];
  for (let k = 0; k < n; k++) {
    lit[k] = sm((t - tDiag(k)) / 0.15) * (1 - e);
    const w = t - tChk(k), arrive = tDrop(k) + FLIGHT;
    chk[k] = sm((w - 0.18) / 0.1) * (1 - e);
    dk[k] = sm((t - arrive) / 0.1) * gone;
    hit[k] = (t > arrive ? exp(-(t - arrive) / 0.15) : 0) + (w > 0.18 ? exp(-(w - 0.18) / 0.1) : 0);
  }

  // The rows. A new row slides in from above while the list shifts down.
  const draws = rows.map((r, i) => [r, i + e, i]);
  if (e > 0) draws.push([{ d: D, isD: true }, -1 + e, -1]);
  for (const [r, f, i] of draws) {
    const y = round(yOf(f));
    if (y >= H || y + ch < 0) continue;
    const b = bri(f), top = i >= 0 && i < n;
    // The list dims a little round the diagonal while it is read.
    const a = top ? b * (1 - 0.25 * dimA) : b;
    for (let k = 0; k < n; k++) {
      let c = pal[r.d[k]], ak = a;
      if (top) {
        const w = t - tChk(i);
        // The check lights the row it is on.
        if (w > 0 && w < 0.3) c = mix(c, WHITE, 0.25 * Math.sin((w / 0.3) * Math.PI));
        if (i === k) {
          ak = b;
          c = mix(c, WHITE, 0.35 * lit[k] + 0.6 * (t > tDiag(k) ? exp(-(t - tDiag(k)) / 0.14) : 0));
          if (w > 0.18) c = mix(c, GREEN, 0.85 * exp(-(w - 0.18) / 0.1));
        }
      }
      put(S, colX(k), y, fw, fh, c, ak, false);
    }
    if (r.isD) put(S, max(0, ox - 2), y, 1, fh, MARK, 0.9 * b, false);
  }

  // The glow of the diagonal: a ring a LED wide round each cell, tinted
  // green once the check has passed it.
  for (let i = 0; i < n; i++) {
    if (lit[i] <= 0) continue;
    const c = mix(mix(pal[rows[i].d[i]], WHITE, 0.4), GREEN, chk[i]);
    const x = colX(i), y = round(yOf(i + e)), a = 0.5 * lit[i];
    put(S, x - 1, y - 1, fw + 2, 1, c, a, true);
    put(S, x - 1, y + fh, fw + 2, 1, c, a, true);
    put(S, x - 1, y, 1, fh, c, a, true);
    put(S, x + fw, y, 1, fh, c, a, true);
  }

  // The fresh row below the table and the strip of verdicts under it.
  const pulse = t > T_FLASH && t < T_RISE ? sm(1 - abs((t - T_FLASH) / (FLASH / 2) - 1)) : 0;
  for (let k = 0; k < n; k++) {
    const x = colX(k);
    if (dk[k] < 1) put(S, x, yD, fw, fh, [0.2, 0.26, 0.42], 0.9 * (1 - dk[k]), false);
    if (dk[k] > 0) put(S, x, yD, fw, fh, mix(pal[D[k]], WHITE, min(1, 0.8 * hit[k] + 0.5 * pulse)), dk[k], false);
    if (chk[k] > 0) put(S, x, yS, fw, 2, mix(GREEN, WHITE, 0.6 * pulse), chk[k] * (1 - sm((t - T_RISE) / 0.2)), false);
  }
  if (dk[n - 1] > 0) put(S, max(0, ox - 2), yD, 1, fh, MARK, 0.9 * dk[n - 1], false);

  // Sparks: each diagonal digit falls down its column to the fresh row and
  // changes colour on the way, one digit up.
  for (let k = 0; k < n; k++) {
    const u = (t - tDrop(k)) / FLIGHT;
    if (u <= 0 || u >= 1) continue;
    const head = lerp(y0 + k * ch + fh, yD + fh, u * u), c = mix(pal[rows[k].d[k]], pal[D[k]], u);
    for (let y = floor(head - 8); y <= head; y++) {
      const a = 1 - (head - y) / 8;
      put(S, colX(k), y, fw, 1, mix(c, WHITE, 0.5 * a), 0.9 * a * a, true);
    }
  }

  // Check beams: from each new digit up to its diagonal cell.
  for (let k = 0; k < n; k++) {
    const w = t - tChk(k);
    if (w <= 0 || w > 0.7) continue;
    const top = round(lerp(yD, y0 + k * ch, sm(w / 0.18)));
    put(S, colX(k), top, fw, yD - top, WHITE, w < 0.18 ? 0.55 : 0.55 * exp(-(w - 0.18) / 0.15), true);
    if (w < 0.25) put(S, colX(k), top, fw, 2, WHITE, 0.9, true);
  }

  // The new number rises through the list as a line of its own colours.
  if (t >= T_RISE && t < T_SHIFT) {
    const u = (t - T_RISE) / RISE, y = round(lerp(yD + fh / 2, -12, u * u));
    for (let k = 0; k < n; k++) {
      const c = mix(pal[D[k]], WHITE, 0.4);
      for (let q = 0; q < 12; q++) put(S, colX(k), y + q, fw, 1, c, (q === 0 ? 1 : 0.6) * (1 - q / 12), true);
    }
  }

  const rgb = S.rgb;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
