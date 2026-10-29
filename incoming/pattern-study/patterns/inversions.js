// ===== Patternflow pattern =====
// Title:   Inversions
// Family:  type
// Idea:    A two-syllable word stands on the panel, one 64 x 64 syllable above the other, and the whole panel turns slowly about its centre, so that at half a turn the same strokes read as another word, 곰국 (bone broth) as 논문 (a thesis), rests there, and turns on back to the first.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rotational lettering, Inversions (Scott Kim, 1981), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..8, Weight=-1..1
//
// Knob 1: Hue. The colour belongs to the panel, not to the word: a gradient runs from the top row to the bottom one, at 0 from sea green through cyan to blue, and the letters pass through it as they turn, so the syllable on top is always the top colour. The light a stroke leaves behind as it swings is a deeper shade of the same row.
// Knob 2: Speed. At 2 a half turn takes 1.6 s and the word rests 2 s at each end, so it reads the second word from 1.95 s to 3.95 s and the first again from 5.55 s. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Word. Nine words, each checked LED by LED against its turned reading: 곰국 turns into 논문, 공공 into 운운, 눅눅 into 녹녹, 용융 into itself, MOM into WOW, and NOON, SWIMS, pod and suns into themselves.
// Knob 4: Weight. The pen, from 2.1 LEDs at -1 through 5.9 at the start to 9.1 at 1, for Hangul and three letters; NOON and suns take 0.85 of it and SWIMS 0.7. The strokes are round-capped lines and rings sampled 16 times an LED, and the turned bitmap equals the other word's at every weight.
// Buttons: K1 tap starts the next half turn at once.

const W = 64, H = 128, N = W * H, SS = 4;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The word list. Each turns half round into the word in the comment; the
// knob line above says how the pairs were checked.
const WORDS = ["곰국", "공공", "눅눅", "용융", "MOM", "NOON", "SWIMS", "pod", "suns"];
// 논문, 운운, 녹녹, 용융, WOW, NOON, SWIMS, pod, suns

// Primitives, all in panel coordinates with integer or half-integer ends so
// that turning about (32, 64) maps every one exactly onto another:
// [1, x0, x1, y] a horizontal stroke, [2, y0, y1, x] a vertical one,
// [0, x0, y0, x1, y1] a slanted one, [3, cx, cy, rx, ry, cut, flip] an
// elliptic ring, cut 0 whole, 1 its upper half, 2 the bowl of an S; flip
// reads the cut turned half round.
function line(out, x0, y0, x1, y1) {
  if (y0 === y1) out.push([1, min(x0, x1), max(x0, x1), y0]);
  else if (x0 === x1) out.push([2, min(y0, y1), max(y0, y1), x0]);
  else out.push([0, x0, y0, x1, y1]);
}
const ring = (out, cx, cy, rx, ry, cut, flip) => out.push([3, cx, cy, rx, ry, cut || 0, flip || 0]);

// ---- Hangul ----
// A syllable with a horizontal vowel is three rows in its 64 x 64 cell: the
// initial consonant in a box at the top, the vowel's bar across the middle,
// the final in a box at the bottom. The bottom box is the top box turned half
// round the cell's centre (32, 32), and the bars of ㅗ and ㅜ sit two rows
// either side of row 32, so a turned syllable swaps its initial and final,
// turns each over, and is a syllable again when the turned shapes are jamo:
// ㄱ turns into ㄴ, ㅁ ㅇ ㄹ ㅍ into themselves, ㅗ into ㅜ, ㅛ into ㅠ, ㅡ stays.
const CHO = { 0: "g", 2: "n", 5: "r", 6: "m", 11: "o", 17: "p" };
const JONG = { 1: "g", 4: "n", 8: "r", 16: "m", 21: "o", 26: "p" };
const BOX_T = 6, BOX_B = 18, BOX_L = 11, BOX_R = 53;

function consonant(out, k, l, t, r, b) {
  const m = (t + b) / 2;
  if (k === "g") line(out, l, t, r, t), line(out, r, t, r, b);
  else if (k === "n") line(out, l, t, l, b), line(out, l, b, r, b);
  else if (k === "m") line(out, l, t, r, t), line(out, r, t, r, b), line(out, l, b, r, b), line(out, l, t, l, b);
  else if (k === "o") ring(out, (l + r) / 2, m, 13, (b - t) / 2);
  else if (k === "r") line(out, l, t, r, t), line(out, r, t, r, m), line(out, l, m, r, m), line(out, l, m, l, b), line(out, l, b, r, b);
  else if (k === "p") line(out, l, t, r, t), line(out, l, b, r, b), line(out, l + 10, t, l + 10, b), line(out, r - 10, t, r - 10, b);
}

function vowel(out, v, oy) {
  // 8 ㅗ, 12 ㅛ, 13 ㅜ, 17 ㅠ, 18 ㅡ.
  if (v === 18) return line(out, 6, oy + 32, 58, oy + 32);
  const up = v === 8 || v === 12, bar = oy + (up ? 35.5 : 28.5), tip = oy + (up ? 28.5 : 35.5);
  line(out, 6, bar, 58, bar);
  for (const x of v === 8 || v === 13 ? [32] : [24, 40]) line(out, x, tip, x, bar);
}

function syllable(out, ch, oy) {
  const c = ch.charCodeAt(0) - 0xac00, cho = floor(c / 588), jung = floor((c % 588) / 28), jong = c % 28;
  consonant(out, CHO[cho], BOX_L, oy + BOX_T, BOX_R, oy + BOX_B);
  vowel(out, jung, oy);
  consonant(out, JONG[jong], BOX_L, oy + 64 - BOX_B, BOX_R, oy + 64 - BOX_T);
}

// ---- Latin ----
// Letters stand one above another at a whole-number pitch centred on row 64,
// so the turn sends slot i to slot n - 1 - i. M is drawn with upright sides
// so that W is the same strokes turned, n is an arch on two stems and u the
// arch turned, p and d share one bowl and a stem the length of the other's.
function letter(out, ch, l, t, r, b, a) {
  const c = (l + r) / 2, m = (t + b) / 2, hx = (r - l) / 2, q = (b - t) / 4, v = round(0.62 * (b - t));
  if (ch === "N") line(out, l, b, l, t), line(out, l, t, r, b), line(out, r, b, r, t);
  else if (ch === "O" || ch === "o") ring(out, c, m, hx, (b - t) / 2);
  else if (ch === "I") line(out, c, t, c, b), line(out, c - 7, t, c + 7, t), line(out, c - 7, b, c + 7, b);
  else if (ch === "M") line(out, l, b, l, t), line(out, l, t, c, t + v), line(out, c, t + v, r, t), line(out, r, t, r, b);
  else if (ch === "W") line(out, l, t, l, b), line(out, l, b, c, b - v), line(out, c, b - v, r, b), line(out, r, b, r, t);
  else if (ch === "S" || ch === "s") ring(out, c, t + q, hx, q, 2, 0), ring(out, c, b - q, hx, q, 2, 1);
  else if (ch === "n") line(out, l, b, l, t + hx), line(out, r, b, r, t + hx), ring(out, c, t + hx, hx, hx, 1, 0);
  else if (ch === "u") line(out, l, t, l, b - hx), line(out, r, t, r, b - hx), ring(out, c, b - hx, hx, hx, 1, 1);
  else if (ch === "p") ring(out, c, m, hx, (b - t) / 2), line(out, l, t, l, b + a);
  else if (ch === "d") ring(out, c, m, hx, (b - t) / 2), line(out, r, t - a, r, b);
}

const LATIN = {
  3: { pitch: 42, pen: 1, caps: [12, 52, 34], low: [17, 47, 18, 9] },
  4: { pitch: 32, pen: 0.85, caps: [12, 52, 24], low: [15, 49, 22, 0] },
  5: { pitch: 25, pen: 0.7, caps: [13, 51, 16], low: [16, 48, 14, 0] },
};

function wordPrims(word) {
  const out = [];
  if (word.charCodeAt(0) >= 0xac00) {
    syllable(out, word[0], 0);
    syllable(out, word[1], 64);
    return out;
  }
  const n = word.length, L = LATIN[n];
  for (let i = 0; i < n; i++) {
    const ch = word[i], yc = 64 + (i - (n - 1) / 2) * L.pitch;
    const caps = ch < "a", [l, r, h, a] = caps ? [L.caps[0], L.caps[1], L.caps[2], 0] : L.low;
    const narrow = ch === "S" ? (n === 5 ? 7 : 4) : ch === "s" ? 4 : 0;
    letter(out, ch, l + narrow, yc - h / 2, r - narrow, yc + h / 2, a);
  }
  return out;
}

// The pen for a weight, thinner for four and five letters, in eighths of an
// LED with an odd numerator: samples sit on odd eighths, so no sample is ever
// exactly half a pen from a straight stroke and none can tip either way.
function penOf(word, weight) {
  const scale = word.charCodeAt(0) >= 0xac00 ? 1 : LATIN[word.length].pen;
  return (2 * round((5.6 + 3.5 * weight) * scale * 4) + 1) / 8;
}

// One sample against one primitive: within half the pen of the stroke.
function inside(p, px, py, hw, hw2) {
  const k = p[0];
  if (k === 1) {
    const dx = px < p[1] ? p[1] - px : px > p[2] ? px - p[2] : 0, dy = py - p[3];
    return dx * dx + dy * dy <= hw2;
  }
  if (k === 2) {
    const dy = py < p[1] ? p[1] - py : py > p[2] ? py - p[2] : 0, dx = px - p[3];
    return dx * dx + dy * dy <= hw2;
  }
  if (k === 0) {
    const ax = p[1], ay = p[2], ux = p[3] - ax, uy = p[4] - ay, l2 = ux * ux + uy * uy;
    const t = cl(((px - ax) * ux + (py - ay) * uy) / l2, 0, 1), ex = ax + t * ux - px, ey = ay + t * uy - py;
    return ex * ex + ey * ey <= hw2;
  }
  let dx = px - p[1], dy = py - p[2];
  if (p[6]) (dx = -dx), (dy = -dy);
  const rx = p[3], ry = p[4], nx = dx / rx, ny = dy / ry;
  if (p[5] === 1 && dy > 0) return false;
  // The S bowl leaves out its lower right quarter and the upper right up to
  // about 35 degrees, where the stroke ends.
  if (p[5] === 2 && dx > 0 && (dy > 0 || -ny < 0.7 * nx)) return false;
  const q = sqrt(nx * nx + ny * ny), g = sqrt((nx / rx) * (nx / rx) + (ny / ry) * (ny / ry));
  if (q === 0) return min(rx, ry) <= hw;
  return (abs(q - 1) * q) / g <= hw;
}

// The word's bitmap: 16 samples an LED, the count of those inside a stroke.
function render(prims, pen, out) {
  const hw = pen / 2, hw2 = hw * hw, bits = new Uint16Array(N);
  for (const p of prims) {
    let x0, x1, y0, y1;
    if (p[0] === 1) (x0 = p[1]), (x1 = p[2]), (y0 = y1 = p[3]);
    else if (p[0] === 2) (y0 = p[1]), (y1 = p[2]), (x0 = x1 = p[3]);
    else if (p[0] === 0) (x0 = min(p[1], p[3])), (x1 = max(p[1], p[3])), (y0 = min(p[2], p[4])), (y1 = max(p[2], p[4]));
    else (x0 = p[1] - p[3]), (x1 = p[1] + p[3]), (y0 = p[2] - p[4]), (y1 = p[2] + p[4]);
    const X0 = max(0, floor(x0 - hw - 1)), X1 = min(W - 1, floor(x1 + hw + 1));
    const Y0 = max(0, floor(y0 - hw - 1)), Y1 = min(H - 1, floor(y1 + hw + 1));
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x <= X1; x++) {
        const o = y * W + x;
        let b = bits[o];
        if (b === 0xffff) continue;
        for (let j = 0; j < SS; j++)
          for (let i = 0; i < SS; i++) {
            const bit = 1 << (j * SS + i);
            if (!(b & bit) && inside(p, x + (i + 0.5) / SS, y + (j + 0.5) / SS, hw, hw2)) b |= bit;
          }
        bits[o] = b;
      }
  }
  for (let o = 0; o < N; o++) {
    let b = bits[o], c = 0;
    while (b) (b &= b - 1), c++;
    out[o] = c;
  }
  return out;
}

// Beats at Speed 2, in seconds: the rest at each end and the half turn.
const REST = 2, TURN = 1.6;

export function setup(params) {
  params.s = {
    word: -1, pen: -1, hits: new Uint8Array(N), cov: new Float32Array(N), trail: new Float32Array(N),
    ph: REST - 0.35, ang: 0, hue: -1, row: new Float32Array(H * 3), ghost: new Float32Array(H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const word = cl(round(kv[2]), 0, WORDS.length - 1), pen = penOf(WORDS[word], cl(kv[3], -1, 1));
  if (word !== S.word || pen !== S.pen) {
    S.word = word;
    S.pen = pen;
    render(wordPrims(WORDS[word]), pen, S.hits);
  }
  if (input.btnPressed && input.btnPressed[0] && S.rest) S.ph = S.half * (REST + TURN) + REST;
  S.ph += (d * cl(kv[1], 0.2, 3)) / 2;
  const k = floor(S.ph / (REST + TURN)), u = S.ph - k * (REST + TURN);
  S.rest = u < REST;
  S.half = k;
  S.ang = (k + (S.rest ? 0 : ease((u - REST) / TURN))) * PI;
  S.dt = d;
  if (kv[0] !== S.hue) {
    S.hue = kv[0];
    for (let y = 0; y < H; y++) {
      const h = S.hue + 0.42 + 0.2 * (y / (H - 1));
      hsv(h, 0.72, 1, S.row, y * 3);
      hsv(h + 0.07, 1, 0.5, S.ghost, y * 3);
    }
  }
}

// Bilinear read of the word's bitmap at word-space (x, y), LED centres on
// whole numbers.
function sample(hits, x, y) {
  const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
  let v = 0;
  if (y0 >= 0 && y0 < H) {
    const o = y0 * W;
    if (x0 >= 0 && x0 < W) v += hits[o + x0] * (1 - fx) * (1 - fy);
    if (x0 + 1 >= 0 && x0 + 1 < W) v += hits[o + x0 + 1] * fx * (1 - fy);
  }
  if (y0 + 1 >= 0 && y0 + 1 < H) {
    const o = (y0 + 1) * W;
    if (x0 >= 0 && x0 < W) v += hits[o + x0] * (1 - fx) * fy;
    if (x0 + 1 >= 0 && x0 + 1 < W) v += hits[o + x0 + 1] * fx * fy;
  }
  return v;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.word < 0) return;
  const { hits, cov, trail, row, ghost } = S;
  if (S.rest) {
    // At rest the panel shows the bitmap itself, or the bitmap read from the
    // far corner: LED (x, y) shows LED (63 - x, 127 - y).
    const flip = S.half % 2 === 1;
    for (let o = 0; o < N; o++) cov[o] = hits[flip ? N - 1 - o : o] / 16;
  } else {
    // Turning, the word shrinks so its 128 rows lie down across 64 columns
    // at a quarter turn, losing a row or two of each end against the sides.
    const a = S.ang, sn = sin(a), s = 1 - 0.47 * sn * sn, c = cos(a) / s, si = sn / s;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let v = 0;
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            const u = x + 0.25 + 0.5 * i - 32, w = y + 0.25 + 0.5 * j - 64;
            v += sample(hits, 31.5 + c * u + si * w, 63.5 - si * u + c * w);
          }
        cov[y * W + x] = v / 64;
      }
  }
  const fade = exp(-S.dt / 0.09);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x, c = cov[o], t = max(c, trail[o] * fade);
      trail[o] = t;
      const g = t - c;
      display.setPixel(x, y, row[y * 3] * c + ghost[y * 3] * g, row[y * 3 + 1] * c + ghost[y * 3 + 1] * g, row[y * 3 + 2] * c + ghost[y * 3 + 2] * g);
    }
}
