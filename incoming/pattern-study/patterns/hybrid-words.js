// ===== Patternflow pattern =====
// Title:   Hybrid Words
// Family:  type
// Idea:    Three rows each carry the same hybrid image of two four-letter words, one drawn as fat letters and blurred soft and the other as one-LED strokes that keep only their edges, and each row is seen through a different simulated viewing distance that a walker sweeps from touching the panel to far across the room, so near the strokes read as the one word, far away the blur reads as the other, and the three rows flip at different moments.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hybrid images (Aude Oliva, Antonio Torralba and Philippe G. Schyns, "Hybrid images", ACM Transactions on Graphics 25(3), SIGGRAPH 2006), the low spatial frequencies of one picture added to the high spatial frequencies of another; the perception under it is Philippe G. Schyns and Aude Oliva's "From blobs to boundary edges" (1994), coarse scale read before fine at a distance; Gaussian low-pass filter; pixel letters drawn for this pattern; pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cutoff=-1..1, Pair=0..5
//
// Knob 1: Hue. Turns the ramp from the dim ground to the white-hot strokes round the wheel. At 0 it runs navy, azure, white; at 0.25 violet, at 0.5 red, at 0.58 amber, at 0.66 yellow, at 0.75 green. Between red and yellow the dim end is paled so the ground does not read as brown.
// Knob 2: Speed. One round trip of the walker takes 28 / Speed seconds: 14 s at 2, 140 s at 0.2, 9.3 s at 3. At 2 the walker stands at the panel for 2.1 s, walks away for 4.9 s while the eye's blur grows from 0 to 2.1 LEDs, stands far for 2.1 s and walks back for 4.9 s. The three rows are a third of a trip apart, 4.7 s at 2, so one row is always near, one far and one on the way.
// Knob 3: Cutoff. The radius of the Gaussian that splits the hybrid into its two halves: 1.3 LEDs at 0, 0.90 at -1, 1.89 at 1. A small cutoff leaves the fat word nearly crisp and hands the reading to it early; a large one softens it and holds the thin word longer. The tick on each gauge marks where the row looks as much like the one word as the other: 16, 22 and 31 columns from the left edge at -1, 0 and 1.
// Knob 4: Pair. From 0 to 0.5 the five pairs follow one another, one per round trip (14 s at Speed 2), and dissolve over 0.7 s. From 0.5 up the knob holds one, the word seen far away first and the word seen near second: 1 COLD / WARM, 2 LOUD / SOFT, 3 LOST / FIND, 4 FAST / SLOW, 5 DUSK / DAWN.

// A hybrid image is lowpass(A) + (B - lowpass(B)), with the same Gaussian for
// both. Here A is a four-letter word drawn with 3.5 LED strokes in letters 12
// LEDs wide and 30 high, and B another four-letter word in one-LED strokes
// that sit on pixel centres in letters 13 by 29. Blurred, A is a set of soft
// blobs, and B minus its own blur is B's strokes with a dark halo either side
// that sums to nothing, so the blobs carry A and the strokes carry B and
// neither takes much from the other. The pairs were picked by looking at the
// blurred picture: the letters of A need counters wider than the blur, which
// rules out M, W and a crowded E in the fat word, and the thin word has no
// such limit.
//
// The panel cannot know how far away the viewer stands, so it shows the
// distance. The eye is a low-pass filter whose radius grows with distance,
// so each row is the hybrid blurred once more by a Gaussian of radius
// s = 2.1 d LEDs, d the walker's distance from 0 to 1. At d = 0 a row is the
// hybrid as it is. Measured as the correlation of the lit row with each
// word's mask, at the opening cutoff the row is B at 0.84 and A at 0.41 at
// d = 0, level at about d = 0.34 (s = 0.7), and A at 0.74 against B at 0.09
// at d = 1. Far off the eye's contrast gain stretches the picture between
// the darkest and the brightest place inside the letters, fully from s = 1.6,
// because a blurred word is faint and a squinting viewer still reads it.
// The ground sits at a dim 0.12, not black, so the dark halos of B can show.
//
// The blur is a zero-padded separable Gaussian on a 64 by 50 canvas per
// row, 10 rows of margin above and below the letters.

const W = 64, H = 128;
const { floor, round, min, max, exp, ceil, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const u = cl((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// Letter boxes are 14 wide and 30 high, four to a word at a pitch of 16. The
// three rows of letters start at y 11, 51 and 91, each with its gauge above.
const LW = 14, LH = 30, PITCH = 16, X0 = 1, BY = [11, 51, 91], M = 10, CH = LH + 2 * M;
// The fat word's stroke width and letter width, and the eye's blur at d = 1.
const TA = 3.5, AW = 12;
const SMAX = 2.1;
// The walker's cycle in units of Speed: 28, so 14 s at the opening Speed 2.
const T = 28;

// Letters as strokes on a unit square, x right and y down. A corner is cut
// at 0.3 across and 0.13 down.
const cx = 0.3, cy = 0.13;
const GLYPH = {
  A: [[[0, 1], [0, cy], [cx, 0], [1 - cx, 0], [1, cy], [1, 1]], [[0, 0.52], [1, 0.52]]],
  C: [[[1, 0.25], [1, cy], [1 - cx, 0], [cx, 0], [0, cy], [0, 1 - cy], [cx, 1], [1 - cx, 1], [1, 1 - cy], [1, 0.75]]],
  D: [[[0, 0], [1 - cx, 0], [1, cy], [1, 1 - cy], [1 - cx, 1], [0, 1], [0, 0]]],
  E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.85, 0.5]]],
  F: [[[1, 0], [0, 0], [0, 1]], [[0, 0.5], [0.85, 0.5]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]],
  I: [[[0.12, 0], [0.88, 0]], [[0.5, 0], [0.5, 1]], [[0.12, 1], [0.88, 1]]],
  K: [[[0, 0], [0, 1]], [[1, 0], [0, 0.58]], [[0.28, 0.4], [1, 1]]],
  L: [[[0, 0], [0, 1], [1, 1]]],
  M: [[[0, 1], [0, 0], [0.5, 0.58], [1, 0], [1, 1]]],
  N: [[[0, 1], [0, 0], [1, 1], [1, 0]]],
  O: [[[cx, 0], [1 - cx, 0], [1, cy], [1, 1 - cy], [1 - cx, 1], [cx, 1], [0, 1 - cy], [0, cy], [cx, 0]]],
  R: [[[0, 1], [0, 0], [1 - cx, 0], [1, cy], [1, 0.5 - cy], [1 - cx, 0.5], [0, 0.5]], [[0.45, 0.5], [1, 1]]],
  S: [[[1, cy], [1 - cx, 0], [cx, 0], [0, cy], [0, 0.4], [cx, 0.5], [1 - cx, 0.5], [1, 0.6], [1, 1 - cy], [1 - cx, 1], [cx, 1], [0, 1 - cy]]],
  T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
  U: [[[0, 0], [0, 1 - cy], [cx, 1], [1 - cx, 1], [1, 1 - cy], [1, 0]]],
  W: [[[0, 0], [0.22, 1], [0.5, 0.35], [0.78, 1], [1, 0]]],
};
// Each pair: the word that shows from far (fat, blurred) and the one that
// shows up close (thin strokes).
const PAIRS = [["COLD", "WARM"], ["LOUD", "SOFT"], ["LOST", "FIND"], ["FAST", "SLOW"], ["DUSK", "DAWN"]];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Coverage of a word on a canvas: 1 inside a stroke, anti-aliased at its
// edge. thick is the stroke width in LEDs; the skeleton is inset by half of
// it, so the letter fills its box.
function rasterWord(word, thick) {
  const out = new Float32Array(W * CH);
  const half = thick / 2;
  for (let li = 0; li < 4; li++) {
    const g = GLYPH[word[li]];
    const bx = X0 + li * PITCH, by = M;
    // Thin strokes sit on pixel centres: 13 by 29 of the 14 by 30 box.
    const ix = thick < 2 ? 0.5 : half, iy = thick < 2 ? 0.5 : half;
    const bw = thick < 2 ? LW - 1 : AW, sw = bw - 2 * ix, sh = (thick < 2 ? LH - 1 : LH) - 2 * iy;
    const ox = thick < 2 ? 0 : (LW - AW) / 2;
    const segs = [];
    for (const stroke of g)
      for (let k = 0; k + 1 < stroke.length; k++)
        segs.push([bx + ox + ix + stroke[k][0] * sw, by + iy + stroke[k][1] * sh, bx + ox + ix + stroke[k + 1][0] * sw, by + iy + stroke[k + 1][1] * sh]);
    const x0 = max(0, bx - 2), x1 = min(W - 1, bx + LW + 1), y0 = max(0, by - 2), y1 = min(CH - 1, by + LH + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let best = 0;
        for (const s of segs) {
          const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
          const u = l2 > 0 ? cl(((px - s[0]) * dx + (py - s[1]) * dy) / l2, 0, 1) : 0;
          const d = hypot(px - s[0] - u * dx, py - s[1] - u * dy);
          const c = cl(half + 0.5 - d, 0, 1);
          if (c > best) best = c;
        }
        out[y * W + x] = best;
      }
  }
  return out;
}

// Zero-padded separable Gaussian, in place through tmp.
function blur(a, tmp, sigma) {
  if (sigma < 0.15) return;
  const r = ceil(3 * sigma), k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += k[i + r] = exp((-i * i) / (2 * sigma * sigma));
  for (let i = 0; i <= 2 * r; i++) k[i] /= sum;
  for (let y = 0; y < CH; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let s = 0;
      const lo = max(-r, -x), hi = min(r, W - 1 - x);
      for (let i = lo; i <= hi; i++) s += a[o + x + i] * k[i + r];
      tmp[o + x] = s;
    }
  }
  for (let y = 0; y < CH; y++) {
    const lo = max(-r, -y), hi = min(r, CH - 1 - y);
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let i = lo; i <= hi; i++) s += tmp[(y + i) * W + x] * k[i + r];
      a[y * W + x] = s;
    }
  }
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, sigC: 2.4, pairKnob: 0.06,
    cov: PAIRS.map(() => null), hyb: new Map(),
    cur: 0, prev: 0, fade: 1,
    work: new Float32Array(W * CH), tmp: new Float32Array(W * CH),
    d: [0, 0, 0], lut: null, lutHue: -1,
    V: new Float32Array(W * H),
  };
}

function coverage(S, p) {
  if (!S.cov[p]) S.cov[p] = [rasterWord(PAIRS[p][0], TA), rasterWord(PAIRS[p][1], 1)];
  return S.cov[p];
}

// hybrid = blur(A) + (B - blur(B)), around zero.
function hybrid(S, p) {
  const key = p + ":" + round(S.sigC * 50);
  let h = S.hyb.get(key);
  if (h) return h;
  const [A, B] = coverage(S, p);
  const a = Float32Array.from(A), b = Float32Array.from(B);
  blur(a, S.tmp, S.sigC);
  blur(b, S.tmp, S.sigC);
  h = new Float32Array(W * CH);
  for (let i = 0; i < h.length; i++) h[i] = 0.5 * a[i] + (B[i] - b[i]);
  if (S.hyb.size > 6) S.hyb.clear();
  S.hyb.set(key, h);
  return h;
}

// The walker's distance, 0 touching the panel to 1 across the room: it
// stands, walks off, stands and walks back.
function walk(p) {
  p -= floor(p);
  if (p < 0.15) return 0;
  if (p < 0.5) return smooth(0.15, 0.5, p);
  if (p < 0.65) return 1;
  return 1 - smooth(0.65, 1, p);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.sigC = 1.3 * Math.pow(1.45, cl(k[2] || 0, -1, 1));
  S.pairKnob = cl(k[3] == null ? 0.06 : k[3], 0, 5);
  S.t += d * S.speed;
  const target = S.pairKnob >= 0.5 ? round(S.pairKnob) - 1 : floor(S.t / T + 0.425) % PAIRS.length;
  if (target !== S.cur) {
    S.prev = S.cur;
    S.cur = target;
    S.fade = 0;
  }
  S.fade = min(1, S.fade + d / 0.7);
  for (let b = 0; b < 3; b++) S.d[b] = walk(S.t / T + b / 3);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const V = S.V;
  const G0 = 0.12;
  V.fill(G0);
  // The two hybrids, blended during a change of pair.
  const hc = hybrid(S, S.cur), f = smooth(0, 1, S.fade);
  let hp = hc;
  if (f < 1) hp = hybrid(S, S.prev);
  const work = S.work, tmp = S.tmp;
  for (let b = 0; b < 3; b++) {
    for (let i = 0; i < work.length; i++) work[i] = f < 1 ? hp[i] * (1 - f) + hc[i] * f : hc[i];
    const se = SMAX * S.d[b];
    blur(work, tmp, se);
    // The eye's contrast gain: far away, the picture is stretched between its
    // darkest and brightest places inside the letters.
    let lo = 1e9, hi = -1e9;
    for (let i = M * W; i < (M + LH) * W; i++) {
      if (work[i] < lo) lo = work[i];
      if (work[i] > hi) hi = work[i];
    }
    const st = smooth(0, 1.6, se);
    const y0 = b === 0 ? 0 : BY[b] - 5, y1 = b === 2 ? H : BY[b + 1] - 5, off = BY[b] - M;
    for (let y = y0; y < y1; y++) {
      const cyy = y - off;
      if (cyy < 0 || cyy >= CH) continue;
      for (let x = 0; x < W; x++) {
        const g = work[cyy * W + x];
        V[y * W + x] = cl(G0 + (1 - G0) * ((1 - st) * g + st * ((g - lo) / (hi - lo))), 0, 1);
      }
    }
  }
  // The gauge above each row: the walker's distance from touching the panel
  // on the left to across the room on the right, the line lit up to the
  // walker, and a tick where the row turns from the thin word to the fat.
  const xc = 2 + round(cl((0.54 * S.sigC) / SMAX, 0, 1) * 59);
  for (let b = 0; b < 3; b++) {
    const gy = BY[b] - 4, xm = 2 + round(S.d[b] * 59);
    for (let x = 2; x <= 61; x++) V[gy * W + x] = x <= xm ? 0.45 : 0.24;
    for (let y = gy - 1; y <= gy + 1; y++) V[y * W + xc] = 0.8;
    for (let y = gy - 1; y <= gy + 1; y++) for (let x = xm - 1; x <= xm + 1; x++) V[y * W + x] = 1;
  }
  const hue = S.hue + 0.52;
  const ramp = (v) => {
    const u = cl(v, 0, 1), h = hue + 0.05 * (1 - u) - 0.03 * u, f = h - floor(h);
    // Dark orange reads as brown on the panel, so between red and yellow the dim end goes pale.
    const pale = smooth(0.02, 0.07, f) * (1 - smooth(0.17, 0.23, f)) * (1 - u);
    return hsv(h, (1 - 0.75 * smooth(0.55, 1, u)) * (1 - 0.75 * pale), 0.06 + 0.94 * u);
  };
  if (S.lutHue !== hue) {
    S.lut = [];
    for (let i = 0; i <= 255; i++) S.lut.push(ramp(i / 255));
    S.lutHue = hue;
  }
  const lut = S.lut;
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const c = lut[round(V[i] * 255)];
      display.setPixel(x, y, round(c[0] * 255), round(c[1] * 255), round(c[2] * 255));
    }
}
