// ===== Patternflow pattern =====
// Title:   Arithmetic Coding
// Family:  type
// Idea:    A tall bar is cut into eight lettered segments as tall as the letters' probabilities, the segment of the message's next letter lights and widens by a funnel into a new full-height bar, and the chain of nested bars slides sideways until the last one holds the whole message as one tiny interval, where the shortest binary fraction that lies inside it is marked and its bits are typed out beside the ideal length in bits.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Arithmetic coding (Jorma Rissanen and Richard Pasco, both 1976, years from memory; cutting the unit interval into parts goes back to Peter Elias, from memory), probabilities cut by rank after Zipf's law (George Zipf, 1949, year from memory); the 3 by 5 capitals of Saccades (pattern round 106) and the digits drawn for Kasiski Examination (pattern round 108), copied from edit-distance.js; pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Skew=0.6..2.5, Message=1..6
//
// Knob 1: Hue. Turns the eight letters' colours round the wheel together. At 0 A is lime green, E green, I teal, N cyan, O blue, R violet, S purple and T magenta; the wheel skips the stretch from orange to yellow, which goes brown when dim. The bits are pale gold and the running information count pale cyan.
// Knob 2: Speed. At 2 each letter takes 0.55 s to light and 0.95 s to zoom, so NOTE is built in 6 s after an opening of 0.6 s; then the marker takes 0.7 s, the 13 bits are typed at 8 a second, the finished code holds for 3.2 s and fades for 0.8 s, which makes 13 s for the word. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Skew. The letter of rank k (A is 0, T is 7) has probability proportional to (k + 1) to the power -Skew, cut into whole multiples of 1/65536 so that every cut and every bit is exact. At 0.6, where it opens, A has 25% of the bar and T 7.3%, and NOTE carries 12.9 bits and codes in 13; at 1 A has 37% and T 4.6%, NOTE 14.1 bits and 14; at 2.5 A has 76% and T 0.4%, half a row of the 120, and NOTE carries 22.4 bits and codes in 22. A letter shows only while its segment is 7.2 rows or taller, so at 1 the S (6.3 rows) and T (5.5) go without.
// Knob 4: Message. Which word is coded, caught on whole numbers: 1 NOTE (where it opens), 2 RAIN, 3 SEASON, 4 STONE, 5 ORIENT and 6 AREA. Turning it starts that word over, and when a word is done the next one in the list follows, round to 1 after 6. At Skew 1, AREA carries 9.4 bits and ORIENT 21.1. The code can come out shorter than the bits carried, when the interval happens to hold a short fraction: AREA at 0.6 carries 10.1 bits and codes in 8.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, exp, log2, pow, sqrt, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, f) => a + (b - a) * f;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel skips the stretch from orange through yellow to lime, which reads brown and olive when dim.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, both copied from edit-distance.js; the full stop is one LED.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));
GLYPH["."] = [0, 0, 0, 0, 1];

// The alphabet, in rank order, and the messages. A letter's rank is its index here.
const LETTERS = "AEINORST";
const MSGS = ["NOTE", "RAIN", "SEASON", "STONE", "ORIENT", "AREA"];
// Probabilities are whole multiples of 1/T, so every cut is an exact integer and the bits are exact.
const T = 65536;

// Layout: bars 5 LEDs wide with a funnel of 4 between them, bar rows Y0 to Y1, the text strip on the right.
const BW = 5, FW = 4, PITCH = BW + FW, X0 = 2, NEWEST = 44, Y0 = 4, Y1 = 124, DIV = 49, SX = 51;
// Seconds at Speed 2.
const INTRO = 0.6, CHOOSE = 0.55, ZOOM = 0.95, MARK = 0.7, BITRATE = 8, HOLD = 3.2, FADE = 0.8;

export function setup(params) {
  params.s = {
    rgb: new Float32Array(N * 3),
    hue: 0, speed: 2, skew: 0.6, knob: 1,
    idx: 0, letters: [], i: 0, phase: 0, pt: 0, bt: 0,
    f: new Int32Array(8), cumI: new Int32Array(9), cumF: new Float64Array(9), cost: new Float64Array(8),
    code: null, codeSkew: -1,
    cDim: [], cBr: [], cEdge: [], tmp: [0, 0, 0],
  };
  for (let k = 0; k < 8; k++) params.s.cDim.push([0, 0, 0]), params.s.cBr.push([0, 0, 0]), params.s.cEdge.push([0, 0, 0]);
  model(params.s, 0.6);
  start(params.s, 0);
}

// The eight probabilities for a skew, cut into whole multiples of 1/T that add to T.
function model(S, skew) {
  S.skew = skew;
  let sum = 0;
  for (let k = 0; k < 8; k++) sum += pow(k + 1, -skew);
  let tot = 0;
  for (let k = 0; k < 8; k++) tot += S.f[k] = max(1, round((pow(k + 1, -skew) / sum) * T));
  S.f[0] += T - tot;
  for (let k = 0; k < 8; k++) {
    S.cumI[k + 1] = S.cumI[k] + S.f[k];
    S.cumF[k + 1] = S.cumI[k + 1] / T;
    S.cost[k] = -log2(S.f[k] / T);
  }
}

function start(S, idx) {
  S.idx = idx;
  S.letters = MSGS[idx].split("").map((ch) => LETTERS.indexOf(ch));
  S.i = 0;
  S.phase = 0;
  S.pt = 0;
  S.bt = 0;
  S.code = null;
}

// The whole message as one interval [N / T^n, (N + Wd) / T^n), found exactly with whole numbers, then the
// shortest binary fraction in it: the fewest bits kk for which some multiple of 2^-kk lies inside.
function encode(S) {
  const TT = BigInt(T);
  let lowN = BigInt(0), wd = BigInt(1), ideal = 0;
  for (const k of S.letters) {
    lowN = lowN * TT + wd * BigInt(S.cumI[k]);
    wd = wd * BigInt(S.f[k]);
    ideal += S.cost[k];
  }
  const D = 16 * S.letters.length, one = BigInt(1);
  for (let kk = 0; kk <= D; kk++) {
    const sh = BigInt(D - kk), m = (lowN + (one << sh) - one) >> sh, v = m << sh;
    if (v < lowN + wd) {
      const bits = kk ? m.toString(2).padStart(kk, "0") : "";
      return { bits, ideal, ustar: Number(v - lowN) / Number(wd), skew: S.skew };
    }
  }
  return { bits: "", ideal, ustar: 0, skew: S.skew };
}

// The camera: the x that the chain is slid left by when `cols` bars exist, so the newest stands at the right.
const camFor = (cols) => max(0, X0 + (cols - 1) * PITCH - NEWEST);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.6, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const skew = cl(kv[2], 0.6, 2.5), knob = cl(floor(kv[3] + 0.5), 1, 6);
  if (abs(skew - S.skew) > 1e-6) model(S, skew);
  // A turn of Skew after the end recuts the bar, so the code is found again.
  if (S.code && S.code.skew !== S.skew) S.code = encode(S);
  if (knob !== S.knob) (S.knob = knob), start(S, knob - 1);
  const g = (d * S.speed) / 2, L = S.letters.length;
  S.pt += g;
  if (S.phase === 0 && S.pt >= INTRO) (S.phase = 1), (S.pt = 0);
  else if (S.phase === 1 && S.pt >= CHOOSE) (S.phase = 2), (S.pt = 0);
  else if (S.phase === 2 && S.pt >= ZOOM) {
    S.i++;
    S.pt = 0;
    S.phase = S.i >= L ? 3 : 1;
    if (S.phase === 3) S.code = encode(S);
  } else if (S.phase === 3 && S.pt >= MARK) (S.phase = 4), (S.pt = 0), (S.bt = 0);
  else if (S.phase === 4) {
    S.bt += g * BITRATE;
    if (S.bt >= S.code.bits.length + 1) (S.phase = 5), (S.pt = 0);
  } else if (S.phase === 5 && S.pt >= HOLD) (S.phase = 6), (S.pt = 0);
  else if (S.phase === 6 && S.pt >= FADE) start(S, (S.idx + 1) % MSGS.length);
}

function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) rgb[p + k] += (c[k] - rgb[p + k]) * min(1, a);
}

function glyph(rgb, ch, x, y, c, a) {
  const G = GLYPH[ch];
  if (!G) return 0;
  const w = ch === "." ? 1 : 3;
  for (let j = 0; j < 5; j++) for (let i = 0; i < w; i++) if (G[j * w + i]) put(rgb, x + i, y + j, c, a);
  return w;
}

// A run of characters from x, a gap of one LED after each; the width it came to.
function text(rgb, str, x, y, c, a) {
  let w = 0;
  for (const ch of str) w += glyph(rgb, ch, x + w, y, c, a) + 1;
  return w - 1;
}

// One bar of eight segments over rows top to bot. `pick` is the segment that was chosen in it (or -1), lit by `hl`.
function bar(S, xv, top, bot, pick, hl, alpha) {
  const rgb = S.rgb, cum = S.cumF, hgt = bot - top;
  if (hgt < 0.5) return;
  for (let y = max(0, floor(top)); y < min(H, bot); y++) {
    const yc = y + 0.5, cov = cl(min(y + 1, bot) - max(y, top), 0, 1);
    if (cov <= 0) continue;
    let j = 0;
    while (j < 7 && yc >= top + cum[j + 1] * hgt) j++;
    // A dark seam where two segments meet.
    const seam = min(j > 0 ? yc - (top + cum[j] * hgt) : 9, j < 7 ? top + cum[j + 1] * hgt - yc : 9);
    const lit = j === pick ? hl : 0, k = cl((seam - 0.1) / 0.6, 0, 1) * cov * alpha;
    const c = S.tmp;
    for (let e = 0; e < 3; e++) c[e] = mix(S.cDim[j][e], S.cBr[j][e], lit);
    for (let x = xv; x < xv + BW; x++) if (x < DIV) put(rgb, x, y, c, k);
  }
  // The letters, wherever a segment is tall enough.
  for (let j = 0; j < 8; j++) {
    const ya = top + cum[j] * hgt, hh = (cum[j + 1] - cum[j]) * hgt, a = cl((hh - 6.2) / 1, 0, 1) * alpha;
    if (a <= 0) continue;
    const lit = j === pick ? hl : 0, c = [mix(0.92, 0.03, lit), mix(0.92, 0.03, lit), mix(0.97, 0.06, lit)];
    glyph(rgb, LETTERS[j], xv + 1, round(ya + (hh - 5) / 2), c, a);
  }
}

// The funnel from a chosen segment (rows a0 to a1 at the right edge of its bar) out to the next bar's rows b0 to b1.
function funnel(S, xa, a0, a1, b0, b1, k, alpha) {
  const rgb = S.rgb, st = (b0 - a0) / FW, sb = (b1 - a1) / FW, nt = sqrt(1 + st * st), nb = sqrt(1 + sb * sb);
  for (let xi = 0; xi < FW; xi++) {
    const x = xa + xi, s = (xi + 0.5) / FW, yt = mix(a0, b0, s), yb = mix(a1, b1, s);
    if (x < 0 || x >= DIV) continue;
    for (let y = max(0, floor(min(yt, yb)) - 2); y < min(H, floor(max(yt, yb)) + 3); y++) {
      const yc = y + 0.5, dT = (yc - yt) / nt, dB = (yb - yc) / nb;
      const inside = cl(dT + 0.5, 0, 1) * cl(dB + 0.5, 0, 1);
      const edge = max(cl(1 - abs(dT) / 0.9, 0, 1), cl(1 - abs(dB) / 0.9, 0, 1));
      put(rgb, x, y, S.cEdge[k], (0.62 - 0.3 * s) * inside * alpha);
      put(rgb, x, y, S.cBr[k], edge * 0.95 * alpha);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.rgb) return;
  const rgb = S.rgb, L = S.letters.length, ph = S.phase, i = S.i;
  rgb.fill(0);
  for (let k = 0; k < 8; k++) {
    const h = wheel(S.hue + k * 0.115);
    hsv(h, 0.8, 0.5, S.cDim[k]);
    hsv(h, 0.5, 1, S.cBr[k]);
    hsv(h, 0.7, 1, S.cEdge[k]);
  }
  // How many bars stand, how far the zoom has gone, and so the slide.
  const z = ph === 2 ? sm(S.pt / ZOOM) : ph >= 3 ? 1 : 0;
  const cols = ph >= 3 ? L + 1 : ph === 2 ? i + 2 : i + 1;
  const cam = ph === 2 ? mix(camFor(i + 1), camFor(i + 2), z) : camFor(ph >= 3 ? L + 1 : i + 1);
  const fade = ph === 6 ? 1 - sm(S.pt / FADE) : 1, intro = ph === 0 ? sm(S.pt / INTRO) : 1;
  const hl = ph === 1 ? sm(S.pt / (CHOOSE * 0.45)) : 1;
  const span = Y1 - Y0;
  for (let c = 0; c < cols; c++) {
    const xv = round(X0 + c * PITCH - cam);
    if (xv + BW < 0 || xv >= SX) continue;
    // The bar being zoomed into starts as the chosen segment of the bar before it and ends full height.
    let top = Y0, bot = Y1;
    const pk = c < L ? S.letters[c] : -1;
    if (c > 0) {
      const pp = S.letters[c - 1], a0 = Y0 + S.cumF[pp] * span, a1 = Y0 + S.cumF[pp + 1] * span;
      if (ph === 2 && c === i + 1) (top = mix(a0, Y0, z)), (bot = mix(a1, Y1, z));
      funnel(S, xv - FW, a0, a1, top, bot, pp, intro);
    }
    // The newest bar's pick is lit by the flash; the older picks stay lit.
    const lit = c < i ? 1 : c === i && ph >= 1 ? (ph === 1 ? hl : 1) : 0;
    // Once the message is whole, its last bar steps back so the marker in it shows.
    const back = c === L && ph >= 3 ? 1 - 0.45 * (ph === 3 ? sm(S.pt / MARK) : 1) : 1;
    bar(S, xv, top, bot, c <= i || ph >= 3 ? pk : -1, lit, intro * back);
  }

  // The final bar's marker: the shortest binary fraction inside the interval, as a line out to the code.
  if (ph >= 3 && S.code) {
    const m = ph === 3 ? sm(S.pt / MARK) : 1, y = Y0 + S.code.ustar * span, xv = round(X0 + L * PITCH - cam);
    const yy = cl(floor(y), Y0, Y1 - 1);
    for (let x = max(0, xv - 2); x < DIV; x++) {
      const ext = (x - xv + 2) / (DIV - xv + 2);
      if (ext <= m) put(rgb, x, yy, [1, 0.97, 0.85], x < xv + BW + 2 ? 0.95 : 0.6);
    }
  }

  // The strip on the right, cleared first so the bar sliding in does not show through.
  for (let y = 0; y < H; y++) for (let x = DIV; x < W; x++) rgb[(y * W + x) * 3] = rgb[(y * W + x) * 3 + 1] = rgb[(y * W + x) * 3 + 2] = 0;
  for (let y = 0; y < H; y++) put(rgb, DIV, y, [0.55, 0.6, 0.8], 0.16);
  const gold = [0, 0, 0], cyan = [0, 0, 0];
  hsv(0.12 + S.hue, 0.5, 1, gold);
  hsv(0.5 + S.hue, 0.28, 1, cyan);
  // The message so far, three letters to a line, a dash for each letter still to come.
  const shown = ph === 0 ? 0 : ph >= 3 ? L : i + 1;
  for (let n = 0; n < L; n++) {
    const x = SX + (n % 3) * 4, y = Y0 + floor(n / 3) * 6;
    if (n < shown) {
      const a = n === i && ph === 1 ? hl : 1;
      glyph(rgb, LETTERS[S.letters[n]], x, y, S.cEdge[S.letters[n]], a);
    } else for (let e = 0; e < 3; e++) put(rgb, x + e, y + 4, [0.6, 0.65, 0.85], 0.28);
  }
  // The information so far: the ideal length of the part of the message that is chosen, in bits.
  let info = 0;
  for (let n = 0; n < shown; n++) info += S.cost[S.letters[n]] * (n === i && ph === 1 ? hl : 1);
  for (let x = SX; x < W; x++) put(rgb, x, 23, [0.55, 0.6, 0.8], 0.2);
  if (ph > 0) text(rgb, info.toFixed(1), SX, 26, cyan, 0.95);
  // The code: its length as the bits are typed, then the bits, three to a line after "0.".
  if (ph >= 4 && S.code) {
    const typed = ph === 4 ? min(floor(S.bt), S.code.bits.length) : S.code.bits.length;
    for (let x = SX; x < W; x++) put(rgb, x, 33, [0.55, 0.6, 0.8], 0.2);
    text(rgb, String(typed), SX, 36, gold, 0.95);
    const bits = S.code.bits, y0 = 44;
    text(rgb, "0.", SX, y0, gold, 0.95);
    for (let n = 0; n < typed; n++) {
      const yy = y0 + (1 + floor(n / 3)) * 6;
      if (yy + 5 > H) break;
      glyph(rgb, bits[n], SX + (n % 3) * 4, yy, gold, bits[n] === "1" ? 1 : 0.55);
    }
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 1] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 2] * fade, 0, 1)) | 0);
}
