// ===== Patternflow pattern =====
// Title:   Population Pyramid
// Family:  data
// Idea:    The population pyramid of an imagined country runs through 240 years one row per year of age, men left and women right, each ten years of births one colour band climbing as it ages, from the sharp triangle of many births and many deaths through the baby boom to a top-heavy urn, and then starts again.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after the animated age pyramids of national statistics offices and the cohort-component model demographers project with
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Palette=0..1, Speed=0.25..6, Births=-1..1, Migration=-1..1
//
// Knob 1: Palette. Turns the colours of the birth decades round the wheel; the decades step bright, middle and dark in threes so neighbouring bands part.
// Knob 2: Speed. At 2 three years go by each second and the 240 years from 1820 to 2060 take 80 seconds; at 6 the bands race up the pyramid.
// Knob 3: Births. Scales the fertility the story runs on, from 0.63 times at the left to 1.6 times at the right. In the middle the country starts near six children a woman and ends near one; turned down the base pinches in, turned up it spreads.
// Knob 4: Migration. Within a tenth of the middle nobody moves. Turned up, young adults arrive each year around age 26 and their part of each bar is drawn paler at its outer end as they grow old in the country; turned down, they leave, and a dotted ghost past the bar's end shows where it would reach had they stayed.
// Buttons: K1 tap makes this year a war or an epidemic, in turn: births fall by about half, and either young men or the very young and the old die, so a notch forms and climbs.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, floor, exp, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();

// Ages 0 to 105 have a row each; the top row holds everyone older.
const NA = 107;
// Row of age 0, first bar column for men (going left) and for women (going right), the widest bar.
const [Y0, MX, FX, BAR] = [121, 30, 33, 23];
const [START, END] = [1820, 2060];

// Mortality level: 0 where a quarter of babies die in their first year and life lasts 30 to 33 years on average, 1 where it lasts 79 to 83.
const LK = [[1820, 0], [1850, 0.02], [1880, 0.14], [1910, 0.34], [1950, 0.66], [1975, 0.84], [2000, 0.94], [2060, 1]];
// Children a woman, before Births scales them.
const TK = [[1820, 6], [1865, 6], [1885, 5.5], [1905, 4.3], [1926, 2.9], [1933, 2.2], [1940, 2.3], [1947, 3.1], [1955, 3.5], [1962, 3.3], [1968, 2.5], [1977, 1.8], [1992, 1.55], [2008, 1.25], [2035, 1.05], [2060, 1]];
// Two wars, the influenza after the first, and a cholera year in the opening decade.
const EV = [[1914, 1918, 0], [1940, 1945, 0], [1919, 1919, 1], [1823, 1823, 1]];

const key = (K, y) => {
  if (y <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++)
    if (y <= K[i][0]) {
      const t = (y - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
      return mix(K[i - 1][1], K[i][1], t * t * (3 - 2 * t));
    }
  return K[K.length - 1][1];
};

// Where in a woman's life the children come: a hump peaking at 28.
const PHI = new Float64Array(NA);
{
  let s = 0;
  for (let a = 15; a < 50; a++) s += PHI[a] = (a - 14) ** 2.5 * exp(-(a - 14) / 5.5);
  for (let a = 15; a < 50; a++) PHI[a] /= s;
}
// Where migrants are in life: around 26.
const MIG = new Float64Array(NA).map((_, a) => exp(-(((a - 26) / 8) ** 2)));

// Yearly hazard of dying at age a. kind: -1 a plain year, 0 war, 1 epidemic, 2 famine.
function hazard(a, L, male, kind) {
  let h = a === 0 ? mix(0.27, 0.0035, L) : a < 15 ? mix(0.04, 0.0003, L) * exp(-(a - 1) / 2.2) : 0;
  h += mix(0.008, 0.0003, L) * (male && a > 14 && a < 40 ? 1.9 : 1);
  h += 0.1 * exp(0.1 * (a - mix(64, 86, L) - (male ? 0 : mix(2, 4, L))));
  if (kind === 0 && male && a > 17 && a < 43) h += 0.09;
  if (kind === 1) h += 0.015 + (a > 17 && a < 41 ? 0.025 : 0) + (a < 5 ? 0.08 : 0) + (a > 64 ? 0.06 : 0);
  if (kind === 2) h += 0.02 + (a < 5 ? 0.07 : 0) + (a > 59 ? 0.04 : 0);
  return h;
}

// A state is six rows of ages: men and women living here, the part of them who came as migrants, and those who left.
const SV = new Float64Array(NA);
// One year of the cohort-component model: the dead leave, everyone is a year older, the year's births come in, migrants come or go.
function step(src, dst, y, fk, mig, kind, push) {
  const L = key(LK, y);
  let b = 0;
  for (let a = 15; a < 50; a++) b += src[1][a] * PHI[a];
  b *= key(TK, y) * fk * [1, 0.62, 0.75, 0.85][kind + 1] * (push ? 0.7 : 1);
  for (let s = 0; s < 2; s++) {
    for (let a = 0; a < NA; a++) SV[a] = exp(-hazard(a, L, !s, kind) * (a ? 1 : 0.5));
    for (let k = s; k < 6; k += 2) {
      const S = src[k], D = dst[k];
      D[NA - 1] = S[NA - 1] * SV[NA - 1] + S[NA - 2] * SV[NA - 2];
      for (let a = NA - 2; a > 0; a--) D[a] = S[a - 1] * SV[a - 1];
      D[0] = k < 2 ? b * (s ? 0.488 : 0.512) * SV[0] : 0;
    }
    const [D, I, E] = [dst[s], dst[s + 2], dst[s + 4]];
    for (let a = 12; a < 60; a++)
      if (mig > 0) {
        const n = mig * 0.0006 * MIG[a] * (s ? 0.9 : 1.1);
        (D[a] += n), (I[a] += n);
      } else if (mig < 0) {
        const f = 1 - exp(mig * 0.065 * MIG[a]);
        (E[a] += D[a] * f), (D[a] *= 1 - f), (I[a] *= 1 - f);
      }
  }
  // Keep the people living here at one: the bars are shares of them.
  let t = 0;
  for (let a = 0; a < NA; a++) t += dst[0][a] + dst[1][a];
  for (const A of dst) for (let a = 0; a < NA; a++) A[a] /= t;
}

// A crisis by the script, or by chance in the hungry decades.
const kindOf = (y) => {
  for (const [a, b, k] of EV) if (y >= a && y <= b) return k;
  return y < 1880 && rnd() < 0.07 ? 2 : -1;
};

// 3x5 digits, then M and F.
const GL = [0x7b6f, 0x2c97, 0x73e7, 0x73cf, 0x5bc9, 0x79cf, 0x79ef, 0x7249, 0x7bef, 0x7bcf, 0x5fed, 0x79a4];

export function setup(params) {
  const S = () => Array.from({ length: 6 }, () => new Float64Array(NA));
  params.s = { cur: S(), nxt: S(), tmp: S(), y: START, u: 0, scl: 0, f: new Float32Array(N * 3), ready: 0, war: 0, fade: 0, kinds: new Int8Array(END - START + 2) };
}

// Run the opening regime for 150 years so it reaches its own shape and the knobs show from the first frame.
function warm(P, fk, mig) {
  for (let s = 0; s < 6; s++) for (let a = 0; a < NA; a++) P.cur[s][a] = s < 2 ? exp(-0.04 * a) : 0;
  for (let i = 0; i < 150; i++) {
    step(P.cur, P.tmp, START - 150 + i, fk, mig, rnd() < 0.07 ? 2 : -1, 0);
    [P.cur, P.tmp] = [P.tmp, P.cur];
  }
  P.y = START;
  P.u = 0;
  P.kinds.fill(-1);
  next(P, fk, mig, 0);
  P.scl = 0;
}

// Work out the year being lived now, from the state at its first day.
function next(P, fk, mig, push) {
  const k = push ? push - 1 : kindOf(P.y);
  P.kinds[P.y - START] = k;
  step(P.cur, P.nxt, P.y, fk, mig, k, push);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const fk = exp(0.47 * cl(k[2], -1, 1)), k4 = cl(k[3], -1, 1), mig = Math.sign(k4) * max(0, abs(k4) - 0.1) / 0.9, spd = 1.5 * cl(k[1], 0.25, 6);
  P.hue = k[0];
  if (!P.ready) (P.ready = 1), warm(P, fk, mig);
  // K1 tap: this year is a war, then an epidemic, by turns.
  if (input.btnPressed && input.btnPressed[0] && P.y < END) next(P, fk, mig, (P.war ^= 1) ? 1 : 2);
  if (P.fade > 0) {
    // The story is over: hold the urn a moment, dim, start again from the old triangle, light up.
    P.fade += d;
    if (P.fade > 2 && P.y >= END) warm(P, fk, mig);
    if (P.fade > 2.8) P.fade = 0;
  } else {
    P.u += d * spd;
    for (let i = 0; i < 6 && P.u >= 1; i++) {
      P.u -= 1;
      [P.cur, P.nxt] = [P.nxt, P.cur];
      if (++P.y >= END) {
        (P.u = 0), (P.fade = 0.001);
        break;
      }
      next(P, fk, mig, 0);
    }
  }
  // The widest bar sets the scale, followed gently so a single year does not jolt it.
  let m = 1e-9;
  for (let a = 0; a < NA; a++) m = max(m, P.cur[0][a], P.cur[1][a], P.nxt[0][a], P.nxt[1][a]);
  const want = BAR / m;
  P.scl = P.scl ? P.scl * exp(cl(Math.log(want / P.scl), -1, 1) * min(1, d * 1.5)) : want;
  P.scl = min(P.scl, (BAR + 0.5) / m);
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6].map((c) => c * 255);
}

let FB;
function put(x, y, c, a = 1) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  FB[o] = c[0] * a;
  FB[o + 1] = c[1] * a;
  FB[o + 2] = c[2] * a;
}
function glyph(g, x, y, c, s = 1) {
  for (let r = 0; r < 5; r++)
    for (let q = 0; q < 3; q++)
      if ((GL[g] >> (14 - r * 3 - q)) & 1) for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) put(x + q * s + j, y + r * s + i, c);
}
function num(n, x, y, c, w, s = 1) {
  const t = String(n).padStart(w, "0");
  for (let i = 0; i < t.length; i++) glyph(+t[i], x + i * 4 * s, y, c, s);
}

// A birth decade's colours: the band, its migrants, its leavers and its label. Decades step bright, middle, dark;
// the darker two keep off orange and yellow, which go brown and olive when dim.
const LV = [1, 0.66, 0.4];
function decade(hue, c) {
  const l = ((c % 3) + 3) % 3, h0 = hue + c * 0.137, h = l ? 0.2 + (h0 - floor(h0)) * 0.82 : h0;
  return [hsv(h, 0.8, LV[l]), hsv(h, 0.3, max(0.8, LV[l])), hsv(h, 0.6, 0.55), hsv(h, 0.55, 1)];
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.ready) return;
  FB = P.f;
  FB.fill(0);
  const u = P.u, hue = 0.55 + (P.hue || 0), vis = P.fade > 1.2 ? min(1, abs(P.fade - 2) / 0.8) : 1;
  // The age-0 row holds last year's births; the bands move up a row half way through the year.
  const yb = P.y - 1 + (u >= 0.5 ? 1 : 0);
  const grid = [38, 38, 38], lab = [110, 110, 120];
  // Faint lines every ten years of age, and the ages up the left side.
  for (let a = 0; a <= 100; a += 10) {
    const y = Y0 - a;
    for (let x = 1; x < W; x += 2) put(x, y, grid);
    if (a % 20 === 0) num(a, 0, y - 2, lab, 1);
  }
  // The bars, one row per year of age, mid-year between the two states.
  const C = P.cur, X = P.nxt, at = (s, a) => mix(C[s][a], X[s][a], u) * P.scl, memo = {}, dec = (c) => memo[c] || (memo[c] = decade(hue, c));
  for (let a = 0; a < NA; a++) {
    const y = Y0 - a, [c, pale, ghost] = dec(floor((yb - a) / 10));
    for (let s = 0; s < 2; s++) {
      const len = min(BAR, at(s, a)), imm = min(len, at(s + 2, a)), out = min(BAR + 1 - len, at(s + 4, a));
      const px = (i, q, f = 1) => put(s ? FX + i : MX - i, y, q, f);
      const n = floor(len), fr = len - n;
      for (let i = 0; i < n; i++) px(i, i + 0.5 < len - imm ? c : pale);
      if (fr > 0.05) px(n, imm > 0.5 ? pale : c, fr);
      // Those who left, dotted past the end of the bar.
      for (let i = n + 1; i < len + out; i++) if ((i + a) & 1) px(i, ghost);
    }
  }
  // The birth decade of each band, written beside it on the right in its own colour.
  for (let c = floor((yb - 106) / 10); c <= floor(yb / 10); c++) {
    const top = min(NA - 1, yb - c * 10), bot = max(0, yb - c * 10 - 9);
    if (top - bot < 4) continue;
    // A decade with hardly anyone left keeps a dim label.
    let w = 0;
    for (let a = bot; a <= top; a++) w = max(w, at(0, a), at(1, a));
    num((c * 10) % 100, 57, Math.round(Y0 - cl(yb - c * 10 - 4.5, bot + 2, top - 2)) - 2, dec(c)[3].map((q) => q * cl(w / 3, 0.3, 1)), 2);
  }
  // The year being lived, in the colour of the decade being born, red in a year of war or epidemic.
  const kind = P.kinds[P.y - START] ?? -1, ycol = kind === 0 || kind === 1 ? [255, 60, 40] : decade(hue, floor(P.y / 10))[3];
  num(P.y, 17, 2, ycol, 4, 2);
  glyph(10, 18, 123, lab), glyph(11, 43, 123, lab);
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, FB[o] * vis) | 0, min(255, FB[o + 1] * vis) | 0, min(255, FB[o + 2] * vis) | 0);
}
