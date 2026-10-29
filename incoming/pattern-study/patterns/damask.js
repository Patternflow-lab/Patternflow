// ===== Patternflow pattern =====
// Title:   Damask
// Family:  type
// Idea:    A cloth of one ivory thread woven at one LED per crossing carries a big word in warp-faced satin on a weft-faced satin ground, so only the light tells letter from ground, and as a low lamp walks round the table the word flips from brighter than the cloth to darker than it and back.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: damask weave (figure in warp-faced satin on a weft-faced satin ground of the same thread), five-end satin, anisotropic thread sheen (James Kajiya and Timothy Kay, 1989), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..3, Lamp=0..1
//
// Knob 1: Hue. The colour of the one thread, always pale: linen ivory at 0, mint at 0.25, a cold blue at 0.5 and rose at 0.75.
// Knob 2: Speed. How fast the lamp walks round the table: once in 64 s at 2, so the word turns from light to dark every 16 s; 43 s at 3 and over ten minutes at 0.2. The low swells under the cloth keep the same clock.
// Knob 3: Word. What the cloth says: LUX, the Hangul syllable 빛 (light), NOX, or 밤 (night). Each word is woven with the stem width that makes it 10 to 11% of the cloth: 4.0 LEDs for LUX, 3.3 to 3.5 for the others.
// Knob 4: Lamp. How high the lamp stands: at 0.06 it rakes the cloth from 8 degrees up, the word is sharp and every swell in the cloth shows; towards 1 it climbs to 68 degrees, both threads catch the light alike, the swells flatten out and the word sinks into the cloth.

const W = 64, H = 128, NP = W * H;
const { floor, round, sqrt, cos, sin, tan, min, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The weave. The warp runs down the panel (one end per column), the weft
// across (one pick per row), and each LED is one crossing: lit by whichever
// thread lies on top there. The ground is a five-end weft-faced satin with
// move number 2: the warp comes up where (y + 2x) mod 5 = 0, once in every
// five crossings of each row and each column, and never next to another
// binding point across or down (the four neighbours give 1, 2, 3, 4 mod 5).
// The figure is the back of the same cloth: at every crossing the other
// thread is on top, so the word is warp-faced satin whose weft binding points
// sit exactly where the ground's warp binding points would be.
const groundWarp = (x, y) => (y + 2 * x) % 5 === 0;

// ---- Letters, as strokes in a box one cap height tall: [x0, y0, x1, y1, w],
// w the weight (1 a stem, 0.72 a hairline, 0.62 a serif). The capitals are
// a plain roman with thick and thin strokes and bar serifs; the Hangul is one
// weight.
function arc(cx, cy, rx, ry, a0, a1, n, w0, w1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, b = a0 + ((a1 - a0) * (i + 1)) / n, m = (a + b) / 2;
    out.push([cx + rx * cos(a), cy + ry * sin(a), cx + rx * cos(b), cy + ry * sin(b), w0 + (w1 - w0) * abs(cos(m))]);
  }
  return out;
}
const SERIF = 0.62, HAIR = 0.72;
const GLYPH = {
  L: { w: 0.78, s: [[0.17, 0, 0.17, 1, 1], [0.17, 0.985, 0.9, 0.985, HAIR], [0, 0.015, 0.36, 0.015, SERIF], [0, 0.985, 0.2, 0.985, SERIF], [0.9, 1, 0.92, 0.8, SERIF]] },
  U: {
    w: 0.96,
    s: [[0.17, 0, 0.17, 0.64, 1], [0.83, 0, 0.83, 0.64, HAIR], [0, 0.015, 0.36, 0.015, SERIF], [0.68, 0.015, 1, 0.015, SERIF], ...arc(0.5, 0.64, 0.33, 0.345, 0, PI, 8, HAIR, 1)],
  },
  X: { w: 0.98, s: [[0.1, 0, 0.9, 1, 1], [0.88, 0, 0.12, 1, HAIR], [-0.04, 0.015, 0.3, 0.015, SERIF], [0.72, 0.015, 1.04, 0.015, SERIF], [-0.04, 0.985, 0.28, 0.985, SERIF], [0.7, 0.985, 1.04, 0.985, SERIF]] },
  N: { w: 0.96, s: [[0.13, 0, 0.13, 1, HAIR], [0.13, 0, 0.87, 1, 1], [0.87, 0, 0.87, 1, HAIR], [-0.02, 0.015, 0.16, 0.015, SERIF], [0.7, 0.015, 1.02, 0.015, SERIF], [-0.02, 0.985, 0.3, 0.985, SERIF]] },
  O: { w: 1, s: arc(0.5, 0.5, 0.4, 0.49, 0, 2 * PI, 20, HAIR, 1) },
};
// Hangul syllables in a box 1 wide and 1.75 tall: the initial ㅂ top left,
// the vowel on the right, the final consonant under both.
const B = [[0.1, 0.04, 0.1, 0.86, 1], [0.58, 0.04, 0.58, 0.86, 1], [0.1, 0.45, 0.58, 0.45, 1], [0.08, 0.86, 0.6, 0.86, 1]];
const HANGUL = {
  빛: [...B, [0.86, 0, 0.86, 1.02, 1], [0.5, 1.04, 0.5, 1.2, 1], [0.14, 1.24, 0.86, 1.24, 1], [0.5, 1.28, 0.12, 1.71, 1], [0.38, 1.45, 0.88, 1.71, 1]],
  밤: [...B, [0.8, 0, 0.8, 1.02, 1], [0.8, 0.46, 0.98, 0.46, 1], [0.16, 1.16, 0.84, 1.16, 1], [0.84, 1.16, 0.84, 1.7, 1], [0.84, 1.7, 0.16, 1.7, 1], [0.16, 1.7, 0.16, 1.16, 1]],
};

// Each word as strokes in panel LEDs. LUX and NOX stand one letter above
// another, caps 28 tall from rows 8, 50 and 92; a Hangul syllable is 48 wide
// and 84 tall, centred.
function wordStrokes(word) {
  const out = [];
  if (HANGUL[word]) {
    const s = 48, x0 = 32 - s / 2, y0 = 64 - (1.75 * s) / 2;
    for (const [a, b, c, d, w] of HANGUL[word]) out.push([x0 + a * s, y0 + b * s, x0 + c * s, y0 + d * s, w]);
    return out;
  }
  const cap = 28;
  [...word].forEach((ch, i) => {
    const g = GLYPH[ch], x0 = 32 - (g.w * cap) / 2, y0 = 8 + 42 * i;
    for (const [a, b, c, d, w] of g.s) out.push([x0 + a * cap, y0 + b * cap, x0 + c * cap, y0 + d * cap, w]);
  });
  return out;
}

function segDist(px, py, s) {
  const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? cl(((px - s[0]) * dx + (py - s[1]) * dy) / l2, 0, 1) : 0;
  const ex = px - s[0] - t * dx, ey = py - s[1] - t * dy;
  return sqrt(ex * ex + ey * ey);
}

// A crossing is figure when its centre lies within half a stroke's width of
// the stroke. The stem width is found by halving until the word covers its
// share of the 8192 crossings (SHARE), so each word keeps about the same
// balance of figure and ground whatever its stroke length. Done once per word,
// the first time the Word knob lands on it: 2 to 15 ms in Node.
const WORDS = ["LUX", "빛", "NOX", "밤"];
const SHARE = [0.104, 0.115, 0.104, 0.115];
function figureMask(word, share) {
  const st = wordStrokes(word), near = new Float32Array(NP).fill(1e9);
  // For each crossing, the stem width at which it would just fall inside.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 1e9;
      for (const s of st) r = min(r, segDist(x + 0.5, y + 0.5, s) / s[4]);
      near[y * W + x] = r;
    }
  let lo = 0.5, hi = 12;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    let n = 0;
    for (let p = 0; p < NP; p++) if (near[p] < mid / 2) n++;
    if (n / NP > share) hi = mid;
    else lo = mid;
  }
  const m = new Uint8Array(NP);
  for (let p = 0; p < NP; p++) m[p] = near[p] < lo / 2 ? 1 : 0;
  return m;
}
const MASKS = [];

// Which thread is on top at each crossing: 1 warp, 0 weft.
function topThreads(mask) {
  const t = new Uint8Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) t[y * W + x] = groundWarp(x, y) ? 1 - mask[y * W + x] : mask[y * W + x];
  return t;
}

// Linen is not even: each warp end and each weft pick has its own lustre,
// between 0.95 and 1, so the floats show faint streaks along their threads.
function hash(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const WARP = Float32Array.from({ length: W }, (_, x) => 0.95 + 0.05 * hash(x + 11));
const WEFT = Float32Array.from({ length: H }, (_, y) => 0.95 + 0.05 * hash(y + 977));

// ---- The lamp. It stands 300 LEDs from the middle of the cloth and walks
// round it; its elevation at the middle is set by the Lamp knob. A float
// lying along T, seen from straight above and lit from the unit direction L,
// shines as (1 - (T.L)^2)^(P/2) (Kajiya and Kay's fibre highlight with the
// eye overhead, where T.V = 0), times a peak level of 232. P is 4 here, so
// the sheen is the square of 1 - (T.L)^2. A warp float (T down the
// panel) is brightest with the lamp to its side, a weft float with the lamp
// above or below the panel, so the two systems trade places every quarter
// turn of the lamp.
const R = 300, PEAK = 232;
// The lamp starts 28.1 degrees short of due right of the cloth and walks
// 5.625 degrees a second at Speed 2, so at 5 s it stands square to the
// warp. Checked over every crossing and frame from 2 s to 8 s: the lamp is
// never more than 30.5 degrees off square, and with the swell below a weft
// float never rises above 17.6 of 255 (under the 24 that counts as lit), a
// warp float never falls below 92, and the word stays bright on a dark
// ground. The two sheens are equal where dx^2 = dy^2: a straight line at 45
// degrees through the foot of the lamp, which crosses the cloth from the
// bottom right corner at 10.7 s to the top left at 15.3 s and passes the
// middle at 13 s. The word vanishes along that line and comes back dark.
const A0 = (-28.125 * PI) / 180, RATE = (5.625 * PI) / 180;

// ---- The swell. The cloth is not quite flat: two low swells run under it,
// like a tablecloth lifting in a draught. Each is [direction in radians from
// the x axis, wavelength in LEDs, speed in LEDs a second at Speed 2, the
// steepest slope it gives]. A tilt changes how much light the cloth takes
// from the lamp: with the surface normal (-gx, -gy, 1) and D the way to the
// lamp, the light goes as N.D / D.z = 1 - (gx dx + gy dy) / hz. With the
// lamp 8 degrees up, D runs about 7.3 LEDs across for each one up, so a
// slope of 0.03 toward it dims or brightens the threads by 22%; with the
// lamp 68 degrees up, by 1%, so the swell shows only in raking light, as
// folds do. At Speed 2 the swells pass each crossing every 6 and 5.6 s,
// and from 2 s to 8 s they scale the light by 0.62 to 1.39.
const SWELL = [[0.15, 36, 6, 0.03], [0.9, 28, 5, 0.02]].map(([a, l, v, g]) => ({ ux: cos(a), uy: sin(a), k: (2 * PI) / l, w: (2 * PI * v) / l, g }));

export function setup(params) {
  params.s = { a: A0, t: 0, hue: 0, word: 0, lamp: 0.06, top: null, wordShown: -1 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const clock = (d * cl(k[1], 0.2, 3)) / 2;
  S.a += RATE * clock;
  S.t += clock;
  S.word = cl(round(k[2]), 0, 3);
  S.lamp = cl(k[3], 0, 1);
  if (S.wordShown !== S.word) {
    if (!MASKS[S.word]) MASKS[S.word] = figureMask(WORDS[S.word], SHARE[S.word]);
    S.top = topThreads(MASKS[S.word]);
    S.wordShown = S.word;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.top) return;
  const top = S.top;
  // Elevation 8 degrees at Lamp 0.06, 68 at 1.
  const elev = ((4 + 64 * S.lamp) * PI) / 180, hz = R * tan(elev);
  const lx = 32 + R * cos(S.a), ly = 64 - R * sin(S.a);
  const c = hsv(0.115 + S.hue, 0.36, 1);
  for (let y = 0; y < H; y++) {
    const dy = ly - (y + 0.5);
    for (let x = 0; x < W; x++) {
      const dx = lx - (x + 0.5), inv = 1 / (dx * dx + dy * dy + hz * hz);
      let gx = 0, gy = 0;
      for (const w of SWELL) {
        const q = w.g * cos(w.k * (w.ux * x + w.uy * y) - w.w * S.t);
        gx += q * w.ux;
        gy += q * w.uy;
      }
      const lit = 1 - (gx * dx + gy * dy) / hz;
      const p = y * W + x;
      // T.L squared: dy^2 / |D|^2 for a warp float, dx^2 / |D|^2 for a weft.
      let s, f;
      if (top[p]) (s = 1 - dy * dy * inv), (f = WARP[x]);
      else (s = 1 - dx * dx * inv), (f = WEFT[y]);
      const v = PEAK * f * s * s * (lit > 0 ? lit : 0);
      display.setPixel(x, y, round(v * c[0]), round(v * c[1]), round(v * c[2]));
    }
  }
}
