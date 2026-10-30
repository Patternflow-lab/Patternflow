// ===== Patternflow pattern =====
// Title:   Coded Aperture
// Family:  type
// Idea:    A glowing word shines through a card punched with a modified uniformly redundant array onto a detector where photons land one by one as an unreadable jumble of overlapping shadows, and correlating that jumble with the array's decoding pattern brings the word up out of the noise as the counts pile up, until the 6 s exposure ends and the detector is cleared.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: coded aperture imaging with random arrays of pinholes (Robert H. Dicke, 1968; J. G. Ables, 1968), uniformly redundant arrays (E. E. Fenimore and T. M. Cannon, 1978), modified uniformly redundant arrays from quadratic residues (S. R. Gottesman and E. E. Fenimore, 1989), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.2..3, Mask=0..2, Word=0..3
//
// Knob 1: Hue. Turns the light round the wheel: at 0 the word, the light in the holes and the decoded word are pale gold and the photons on the detector cyan.
// Knob 2: Rate. Photons a second through the coded card, 1500 per unit: 3000 at 2, 300 at 0.2, 4500 at 3, on top of a detector background of 1 count per element a second. Every exposure lasts 6 s and holds its result 1.2 s, so the rate sets how clear the word comes up: at the end it stands 3.8 noise widths above the empty sky at 2, 0.9 at 0.2 and 4.7 at 3.
// Knob 3: Mask. 0 is the MURA for p = 17, 144 holes of 289. 1 is a random card about half open, the kind Dicke and Ables proposed, decoded by balanced correlation; even without noise its shadows do not cancel, so 15 of STAR's 34 elements come out under half bright and a ghost in the sky reaches 38%. 2 is one pinhole in the middle. Every hole passes the same light, so in the same 6 s the pinhole gathers 123 photons among 1740 background counts, and the word ends 1.5 noise widths clear against 2.6 for the random card and 3.8 for the MURA.
// Knob 4: Word. What shines above the card: STAR, CRAB, VELA or LUX, in 3 by 5 letters on the 17 by 17 sky. The fewer the lit elements, the clearer the decoded word: LUX, 27 elements, ends at 4.7 where STAR, 34, ends at 3.8.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, exp, log, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Geometry. The sky, the card and the detector are all 17 by 17
// elements, one element 3 LEDs wide and 2 tall, so each band is 51 by 34.
// From the top: the word (sky rows 5 to 11 only), the card, the detector,
// and the decoded sky.
const P = 17, C = 8, NE = P * P;
const CW = 3, CH = 2, X0 = 6, BW = P * CW, BH = P * CH;
const Y_OBJ = 0, OBJ_R0 = 5, OBJ_R1 = 11, Y_MASK = 18, Y_DET = 56, Y_DEC = 94;
const EXPO = 6, HOLD = 1.2, CYCLE = EXPO + HOLD;
// Detector background, counts per element per second, the same for every
// mask: the cosmic-ray and radioactive counts an X-ray detector sees.
const BKG = 1;
// The pattern opens 0.6 s into an exposure, so that 2 s in the word
// already stands about 2.5 noise widths clear.
const T0 = 0.6;

// ---- Letters, 3 by 5, on sky rows 6 to 10.
const FONT = {
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
  A: [".#.", "#.#", "###", "#.#", "#.#"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  C: [".##", "#..", "#..", "#..", ".##"], B: ["##.", "#.#", "##.", "#.#", "##."],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."], E: ["###", "#..", "##.", "#..", "###"],
  L: ["#..", "#..", "#..", "#..", "###"], U: ["#.#", "#.#", "#.#", "#.#", "###"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
};
const WORDS = ["STAR", "CRAB", "VELA", "LUX"];

function sky(word) {
  const O = new Uint8Array(NE), n = word.length, c0 = floor((P - (4 * n - 1)) / 2);
  for (let k = 0; k < n; k++)
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (FONT[word[k]][r][c] === "#") O[(6 + r) * P + c0 + 4 * k + c] = 1;
  const lit = [];
  for (let e = 0; e < NE; e++) if (O[e]) lit.push(e);
  return { O, lit };
}

// ---- The cards, in display coordinates with the centre at (C, C). A photon
// from sky element s through hole h lands on detector element d = h - s + C
// (mod 17, each axis): the shadow of the whole card, shifted, as when the
// card is the 2 by 2 mosaic of one period. Decoding is the periodic
// correlation dec(o) = sum over d of D(d) Q(d + o - C), and for the MURA
// sum over x of M(x) Q(x + t) is 144 at t = 0 and exactly 0 everywhere else,
// so a noiseless detector decodes to 144 times the sky. Q sums to 1, so a
// flat background adds a flat offset.
function cards() {
  const q = new Int8Array(P).fill(-1);
  for (let x = 1; x < P; x++) q[(x * x) % P] = 1;
  const mura = { M: new Uint8Array(NE), Q: new Int8Array(NE) };
  for (let i = 0; i < P; i++)
    for (let j = 0; j < P; j++) {
      // Gottesman and Fenimore: row 0 closed, column 0 open, else open where
      // both indices are residues or both are not.
      const a = i === 0 ? 0 : j === 0 ? 1 : q[i] * q[j] === 1 ? 1 : 0;
      const e = ((i + C) % P) * P + ((j + C) % P);
      mura.M[e] = a;
      mura.Q[e] = i === 0 && j === 0 ? 1 : a ? 1 : -1;
    }
  // Dicke's and Ables's random card: each element open with chance 1/2, from
  // a fixed hash so the card is the same every time. Decoded with 2M - 1.
  const rand = { M: new Uint8Array(NE), Q: new Int8Array(NE) };
  for (let e = 0; e < NE; e++) {
    let h = (e * 2654435761 + 12345) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
    rand.M[e] = (h >>> 0) % 1000 < 498 ? 1 : 0;
    rand.Q[e] = rand.M[e] ? 1 : -1;
  }
  const pin = { M: new Uint8Array(NE), Q: new Int8Array(NE) };
  pin.M[C * P + C] = 1;
  pin.Q[C * P + C] = 1;
  return [mura, rand, pin].map((m) => {
    const holes = [];
    let sq = 0;
    for (let e = 0; e < NE; e++) {
      if (m.M[e]) holes.push(e);
      sq += m.Q[e];
    }
    return { ...m, holes, sq };
  });
}
const KMURA = 144;

function gauss() {
  const u = Math.random() || 1e-9, v = Math.random();
  return sqrt(-2 * log(u)) * cos(2 * PI * v);
}
function poisson(l) {
  if (l <= 0) return 0;
  if (l > 30) return max(0, round(l + sqrt(l) * gauss()));
  const L = exp(-l);
  let k = 0, p = Math.random();
  while (p > L) {
    k++;
    p *= Math.random();
  }
  return k;
}

function clear(S) {
  // What the last exposure decoded fades out in about a quarter second.
  if (S.view) {
    S.oldDec.set(S.view);
    S.oldA = 1;
  }
  S.D.fill(0);
  S.dD.fill(0);
  S.dec.fill(0);
  S.cnt.fill(0);
  S.nWord = 0;
  S.nBkg = 0;
}

export function setup(params) {
  const S = (params.s = {
    cards: cards(), mode: -1, word: -1, hue: 0, rate: 3000, t: 0, sky: null,
    D: new Float32Array(NE), dD: new Float32Array(NE), dec: new Float32Array(NE),
    cnt: new Float32Array(BW * BH), flash: new Float32Array(BW * BH), hole: new Float32Array(NE), spark: new Float32Array(NP),
    nWord: 0, nBkg: 0, rgb: new Float32Array(NP * 3), wrap: new Int32Array(3 * P),
    view: new Float32Array(NE), oldDec: new Float32Array(NE), oldA: 0,
  });
  for (let x = 0; x < 3 * P; x++) S.wrap[x] = x % P;
}

function land(S, d, flash) {
  S.D[d]++;
  S.dD[d]++;
  const di = floor(d / P), dj = d - di * P;
  const led = (di * CH + floor(Math.random() * CH)) * BW + dj * CW + floor(Math.random() * CW);
  S.cnt[led]++;
  S.flash[led] = min(1.6, S.flash[led] + flash);
}

function spark(S, x, y) {
  const i = y * W + x;
  S.spark[i] = min(1.2, S.spark[i] + 0.7);
}

function expose(S, dt) {
  const card = S.cards[S.mode], lit = S.sky.lit, holes = card.holes;
  // Equal exposure: every hole passes the same flux, so the photon count
  // scales with the number of holes.
  const n = poisson((S.rate * dt * holes.length) / KMURA);
  for (let k = 0; k < n; k++) {
    const s = lit[floor(Math.random() * lit.length)], h = holes[floor(Math.random() * holes.length)];
    const si = floor(s / P), sj = s - si * P, hi = floor(h / P), hj = h - hi * P;
    land(S, ((hi - si + C + P) % P) * P + ((hj - sj + C + P) % P), 1);
    S.hole[h] = min(1, S.hole[h] + 0.5);
    // One photon in three is drawn in flight, in the gaps above and below
    // the card, over the element it left and the hole it went through.
    if (Math.random() < 0.33) {
      spark(S, X0 + sj * CW + floor(Math.random() * CW), Y_MASK - 4 + floor(Math.random() * 4));
      spark(S, X0 + hj * CW + floor(Math.random() * CW), Y_DET - 4 + floor(Math.random() * 4));
    }
  }
  S.nWord += n;
  const b = poisson(BKG * NE * dt);
  for (let k = 0; k < b; k++) land(S, floor(Math.random() * NE), 0.8);
  S.nBkg += b;
  // Fold this frame's counts into the decoded sky.
  const Q = card.Q, wrap = S.wrap, dec = S.dec;
  for (let d = 0; d < NE; d++) {
    const c = S.dD[d];
    if (!c) continue;
    S.dD[d] = 0;
    const di = floor(d / P), dj = d - di * P;
    for (let oi = 0; oi < P; oi++) {
      const row = wrap[di + oi - C + P] * P, base = oi * P;
      for (let oj = 0; oj < P; oj++) dec[base + oj] += c * Q[row + wrap[dj + oj - C + P]];
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.rate = 1500 * cl(k[1], 0.2, 3);
  const mode = cl(round(k[2]), 0, 2), word = cl(round(k[3]), 0, 3);
  if (mode !== S.mode || word !== S.word) {
    if (S.mode < 0) S.t = T0;
    S.mode = mode;
    S.word = word;
    S.sky = sky(WORDS[word]);
    clear(S);
    if (S.t > 0) {
      // Open on an exposure already under way: replay the time since it began.
      const was = S.t;
      S.t = 0;
      while (S.t < was) {
        expose(S, min(0.1, was - S.t));
        S.t += 0.1;
      }
      S.t = was;
      S.flash.fill(0);
    }
  }
  const fade = exp(-d / 0.12), hf = exp(-d / 0.08);
  for (let i = 0; i < S.flash.length; i++) S.flash[i] *= fade;
  for (let i = 0; i < NE; i++) S.hole[i] *= hf;
  for (let i = 0; i < NP; i++) S.spark[i] *= hf;
  S.t += d;
  if (S.t >= CYCLE) {
    S.t -= CYCLE;
    clear(S);
  }
  S.oldA *= exp(-d / 0.12);
  if (S.t < EXPO) expose(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.sky) return;
  const rgb = S.rgb, card = S.cards[S.mode], O = S.sky.O;
  const gold = hsv(0.12 + S.hue, 0.38, 1), cyan = hsv(0.52 + S.hue, 0.55, 1), night = hsv(0.62 + S.hue, 0.5, 0.035);
  rgb.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] += c[0] * a;
    rgb[o + 1] += c[1] * a;
    rgb[o + 2] += c[2] * a;
  };
  // The word, with a soft glow round it.
  for (let r = OBJ_R0; r <= OBJ_R1; r++)
    for (let j = 0; j < P; j++)
      for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
          const px = X0 + j * CW + x, py = Y_OBJ + (r - OBJ_R0) * CH + y;
          let g = 0;
          for (let dr = -1; dr <= 1; dr++)
            for (let dj = -1; dj <= 1; dj++) {
              const rr = r + dr, jj = j + dj;
              if (rr >= 0 && rr < P && jj >= 0 && jj < P && O[rr * P + jj]) g += dr || dj ? 0.05 : 0;
            }
          put(px, py, O[r * P + j] ? gold : night, O[r * P + j] ? 0.95 : 1);
          put(px, py, gold, g);
        }
  // The card: dark, the holes lit from above, flickering as photons pass.
  const plate = hsv(0.6 + S.hue, 0.25, 0.05), lightC = hsv(0.12 + S.hue, 0.3, 1);
  for (let e = 0; e < NE; e++) {
    const i = floor(e / P), j = e - i * P;
    for (let y = 0; y < CH; y++)
      for (let x = 0; x < CW; x++) {
        const px = X0 + j * CW + x, py = Y_MASK + i * CH + y;
        if (card.M[e]) put(px, py, lightC, (y === 0 ? 0.42 : 0.3) + 0.35 * S.hole[e]);
        else put(px, py, plate, 1);
      }
  }
  // The detector: counts per LED, and each new photon a flash.
  // Linear in counts, so the overlapping shadows show through the grain:
  // the mean LED reaches 0.4 at the end of an exposure through the MURA.
  const ref = (S.rate * EXPO + BKG * NE * EXPO) / (BW * BH);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const i = y * BW + x, v = (S.cnt[i] / ref) * 0.4, f = S.flash[i];
      put(X0 + x, Y_DET + y, cyan, v);
      put(X0 + x, Y_DET + y, [1, 1, 1], 0.5 * f);
    }
  // The decoded sky: counts per sky element, the background's flat offset
  // taken off, stretched so the word reaches 1 at the end of an exposure.
  const full = (S.rate * EXPO * card.holes.length) / KMURA / S.sky.lit.length;
  const off = (S.nBkg / NE) * card.sq;
  for (let e = 0; e < NE; e++) {
    const i = floor(e / P), j = e - i * P;
    const v = (S.view[e] = cl((S.dec[e] - off) / full, 0, 1.3));
    const u = max(v, S.oldDec[e] * S.oldA);
    for (let y = 0; y < CH; y++)
      for (let x = 0; x < CW; x++) {
        put(X0 + j * CW + x, Y_DEC + i * CH + y, night, 1);
        put(X0 + j * CW + x, Y_DEC + i * CH + y, gold, 0.85 * u);
      }
  }
  // The exposure clock: a thread under the detector that runs out over the
  // 6 s and stays full while the decoded word holds.
  const run = min(1, S.t / EXPO) * BW;
  for (let x = 0; x < run; x++) put(X0 + x, Y_DET + BH + 1, cyan, 0.3);
  for (let p = 0; p < NP; p++) if (S.spark[p] > 0.01) put(p % W, floor(p / W), p < Y_MASK * W ? gold : lightC, 0.6 * S.spark[p]);
  for (let p = 0; p < NP; p++) {
    const o = p * 3;
    display.setPixel(p % W, floor(p / W), min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
  }
}
