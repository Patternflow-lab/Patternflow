// ===== Patternflow pattern =====
// Title:   Flag Hoist
// Family:  type
// Idea:    Words are spelled in the letter flags of the International Code of Signals, bent on one under another to a halyard that runs down the tall panel by its left edge, and each hoist is hauled up hand over hand into a night sky, flies there with every flag fluttering in a wave that grows towards its fly and turns its folds light and dark, shows the plain letter beside each flag while it is close up, and is hauled down for the next word.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the letter flags of the International Code of Signals, which began as the British Board of Trade's Commercial Code of Signals (1857), its 26 letter flags as revised in 1931 and 1965; before it Frederick Marryat's Code of Signals for the Merchant Service (1817); 5 by 7 capitals from Photon Disk (pattern round 70); pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Wind=3..8, Speed=0.2..3, Letters=3..6, Sky=0..1
//
// Knob 1: Wind. The wind in Beaufort force. At the opening 3, the gentle breeze in which light flags stand out, a fold runs down each flag about once a second, its steepest side turned 29 degrees, and the fly lifts and falls about 2 LEDs; at 8, a gale, the folds come 2.7 times a second at half the length, turned up to 45 degrees, the fly whips about 6 LEDs and the cloth bunches 7 percent shorter.
// Knob 2: Speed. At 2 a hoist takes 2.6 s to go up in six hauls, flies close up for 4.5 s, takes 2.2 s to come down, and the next follows 0.4 s later, 9.7 s a word. Every time scales as 2 / Speed: 97 s a word at 0.2, 6.5 s at 3.
// Knob 3: Letters. How many flags a hoist carries, one word of that length. At 3 (KEG, RIG, DRY, BAY, OAR, SKY) the flags are 31 LEDs deep and 40 long and the hoist reaches row 100; at 4 (QUAY, GOLD, DECK, BUOY and four more) 25 by 34; at 5 (OCEAN, YACHT, RIDGE and three more) 20 by 28; at 6 (ANCHOR, BRIDGE, VOYAGE and three more) 16 by 23, the hoist reaching row 110 to 113.
// Knob 4: Sky. 0 is a moonless night, near black with a few faint stars; 1 is the blue hour, a deep blue sky going violet and then amber towards the foot of the panel. The opening 0.06 is night.
// Buttons: K1 tap hauls the hoist down at once and sends up the next word.

// A ship carries one flag for each letter, so a word that needs one letter
// twice would take a substitute pennant in the second place. The words here
// never repeat a letter. A hoist is read from the top down once it is
// close up, hauled right up to the block, and that is when the plain
// letters show.
//
// A flag in the wind is a sheet on which waves run from the hoist, where it
// is held, to the fly, where it is free, growing as they go. The sheet's
// folds stand out of the panel: each column of the flag tilts by the slope
// of the fold there, which shortens it on the panel and turns it towards or
// away from a light on the left. The folds also lift the fly a
// little, so the top and bottom edges ripple.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, atan, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const TAU = 2 * PI;

// The halyard's column and where the flags' hoist edges start.
const HX = 3, X0 = 4, TOP = 2, GAP = 3;
// Cloth colours, chosen to read on LEDs: white, red, blue, yellow, black.
// Black cloth stays just above dark so the flag keeps its shape at night.
const CLOTH = [
  [228, 226, 214],
  [255, 8, 22],
  [0, 40, 255],
  [255, 196, 0],
  [36, 34, 42],
];
const Wt = 0, R = 1, B = 2, Y = 3, K = 4;
// Swallowtailed flags, A and B: the notch reaches this far into the fly.
const NOTCH = 0.24;

// Each flag as a function of u along the fly (0 at the hoist), v down the
// hoist (0 at the top), and the flag's length and depth in LEDs for the
// shapes that are square or round on the cloth.
function distLine(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return abs((px - ax) * dy - (py - ay) * dx) / sqrt(dx * dx + dy * dy);
}
const FLAGS = {
  A: (u) => (u < 0.5 ? Wt : B),
  B: () => R,
  C: (u, v) => [B, Wt, R, Wt, B][min(4, floor(v * 5))],
  D: (u, v) => (v < 0.25 || v >= 0.75 ? Y : B),
  E: (u, v) => (v < 0.5 ? B : R),
  F: (u, v) => (abs(u - 0.5) + abs(v - 0.5) < 0.5 ? R : Wt),
  G: (u) => (floor(u * 6) % 2 ? B : Y),
  H: (u) => (u < 0.5 ? Wt : R),
  I: (u, v, l, d) => (((u - 0.5) * l) ** 2 + ((v - 0.5) * d) ** 2 < (0.26 * d) ** 2 ? K : Y),
  J: (u, v) => (v < 0.25 || v >= 0.75 ? B : Wt),
  K: (u) => (u < 0.5 ? Y : B),
  L: (u, v) => ((u < 0.5) === (v < 0.5) ? Y : K),
  M: (u, v, l, d) => (min(distLine(u * l, v * d, 0, 0, l, d), distLine(u * l, v * d, 0, d, l, 0)) < 0.1 * d ? Wt : B),
  N: (u, v) => ((floor(u * 4) + floor(v * 4)) % 2 ? Wt : B),
  O: (u, v) => (v < u ? R : Y),
  P: (u, v, l, d) => (abs(u - 0.5) * l < d / 6 && abs(v - 0.5) * d < d / 6 ? Wt : B),
  Q: () => Y,
  R: (u, v, l, d) => (abs(u - 0.5) * l < 0.1 * d || abs(v - 0.5) < 0.1 ? Y : R),
  S: (u, v, l, d) => (abs(u - 0.5) * l < d / 6 && abs(v - 0.5) * d < d / 6 ? B : Wt),
  T: (u) => [R, Wt, B][min(2, floor(u * 3))],
  U: (u, v) => ((u < 0.5) === (v < 0.5) ? R : Wt),
  V: (u, v, l, d) => (min(distLine(u * l, v * d, 0, 0, l, d), distLine(u * l, v * d, 0, d, l, 0)) < 0.1 * d ? R : Wt),
  W: (u, v, l, d) => {
    const e = min(u * l, (1 - u) * l, v * d, (1 - v) * d);
    return e < d / 6 ? B : e < d / 3 ? Wt : R;
  },
  X: (u, v, l, d) => (abs(u - 0.5) * l < 0.1 * d || abs(v - 0.5) < 0.1 ? B : Wt),
  Y: (u, v, l, d) => (floor(((u * l + v * d) / (l + d)) * 10) % 2 ? R : Y),
  Z: (u, v) => (u < v && u < 1 - v ? K : v < u && v < 1 - u ? Y : u > v && u > 1 - v ? B : R),
};

// Words of three to six letters with no letter twice.
const WORDS = {
  3: ["KEG", "RIG", "DRY", "BAY", "OAR", "SKY"],
  4: ["QUAY", "GOLD", "DECK", "BUOY", "YARD", "BRIG", "TIDE", "WIND"],
  5: ["OCEAN", "YACHT", "RIDGE", "BADGE", "BOARD", "DRIFT"],
  6: ["ANCHOR", "BRIDGE", "VOYAGE", "YONDER", "GOLDEN", "BYGONE"],
};
// Flag depth and length for each word length: the hoist runs from row 2 to
// row 100 (three flags) or 110 to 113 (more), with 3 LEDs of halyard
// between flags.
const SIZE = { 3: [31, 40], 4: [25, 34], 5: [20, 28], 6: [16, 23] };

// 5 x 7 capitals from Photon Disk (pattern round 70), rows from the top.
const GLYPHS = {
  A: ".###. #...# #...# ##### #...# #...# #...#", B: "####. #...# #...# ####. #...# #...# ####.", C: ".###. #...# #.... #.... #.... #...# .###.",
  D: "####. #...# #...# #...# #...# #...# ####.", E: "##### #.... #.... ####. #.... #.... #####", F: "##### #.... #.... ####. #.... #.... #....",
  G: ".###. #...# #.... #.### #...# #...# .####", H: "#...# #...# #...# ##### #...# #...# #...#", I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  J: "..### ...#. ...#. ...#. ...#. #..#. .##..", K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#", L: "#.... #.... #.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #.#.# #...# #...# #...#", N: "#...# #...# ##..# #.#.# #..## #...# #...#", O: ".###. #...# #...# #...# #...# #...# .###.",
  P: "####. #...# #...# ####. #.... #.... #....", Q: ".###. #...# #...# #...# #.#.# #..#. .##.#", R: "####. #...# #...# ####. #.#.. #..#. #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.", T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..", U: "#...# #...# #...# #...# #...# #...# .###.",
  V: "#...# #...# #...# #...# #...# .#.#. ..#..", W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.", X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..", Z: "##### ....# ...#. ..#.. .#... #.... #####",
};
const FONT = {};
for (const k in GLYPHS) FONT[k] = GLYPHS[k].replace(/ /g, "");

// Steps along the cloth when a flag's folds are worked out.
const STEPS = 96;
// The light comes from the left and the front.
const LX = -0.6, LZ = 0.8;

// A few faint stars, fixed for the run.
const STARS = [];
for (let i = 0; i < 26; i++) STARS.push([floor(Math.random() * W), floor(Math.random() * H), Math.random() * TAU, 0.5 + Math.random() * 0.5]);

export function setup(params) {
  params.s = {
    t: 0, phase: -1, pt: 0, word: "", n: 3, next: { 3: 0, 4: 0, 5: 0, 6: 0 }, wind: 3, speed: 2, sky: 0.06, btn: false,
    y: H, show: 0, flut: 0, acc: new Float32Array(W * H * 3),
    cu: new Float32Array(W), cdy: new Float32Array(W), csh: new Float32Array(W), cdu: new Float32Array(W),
    xs: new Float32Array(STEPS + 1), ys: new Float32Array(STEPS + 1), ss: new Float32Array(STEPS + 1),
  };
  return params.s;
}

// Phase 0 up, 1 close up, 2 down, 3 the pause before the next word.
const DUR = [2.6, 4.5, 2.2, 0.4];
const HAULS = 6;

function hoistLength(S) {
  const [d] = SIZE[S.n];
  return S.n * d + (S.n - 1) * GAP;
}
function nextWord(S, n) {
  S.n = n;
  const list = WORDS[n];
  S.word = list[S.next[n] % list.length];
  S.next[n]++;
  S.phase = 0;
  S.pt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [3, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.wind = cl(k[0], 3, 8);
  S.speed = cl(k[1], 0.2, 3);
  const n = round(cl(k[2], 3, 6));
  S.sky = cl(k[3], 0, 1);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (S.phase < 0) nextWord(S, n);
  if (btn && !S.btn && S.phase < 2) (S.phase = 2), (S.pt = 0), (S.from = S.y);
  S.btn = btn;
  S.t += d;
  // The flutter runs on its own clock so a change of wind never jumps it.
  S.flut += d * (0.95 + 0.35 * (S.wind - 3));
  const sc = 2 / S.speed;
  S.pt += d;
  const len = hoistLength(S);
  if (S.phase === 0) {
    // Hand over hand: the haul surges and slackens six times on the way.
    const p = cl(S.pt / (DUR[0] * sc), 0, 1), q = p - (0.55 * sin(TAU * HAULS * p)) / (TAU * HAULS);
    S.y = H + 2 + (TOP - H - 2) * smooth(q);
    if (p >= 1) (S.phase = 1), (S.pt = 0);
  } else if (S.phase === 1) {
    S.y = TOP;
    if (S.pt >= DUR[1] * sc) (S.phase = 2), (S.pt = 0), (S.from = TOP);
  } else if (S.phase === 2) {
    const p = cl(S.pt / (DUR[2] * sc), 0, 1), from = S.from ?? TOP;
    S.y = from + (H + 2 - from) * (p * p * (1.6 - 0.6 * p));
    if (p >= 1) (S.phase = 3), (S.pt = 0);
  } else {
    S.y = H + len + 2;
    if (S.pt >= DUR[3] * sc) nextWord(S, n);
  }
  // The letters fade in once the hoist is close up and out as it starts down.
  const want = S.phase === 1 ? 1 : 0;
  S.show += (want - S.show) * min(1, d * (want ? 3 : 6));
}

// One flag: its columns first (where each u lands, how far its fold lifts
// it, how it is lit), then every LED in its box, four samples each.
function flag(S, acc, ch, top, d, l, ph) {
  const wind = S.wind - 3, t = S.flut * TAU;
  // The steepest fold, as dz/dx: 0.55 (29 degrees) in a gentle breeze, 1
  // (45 degrees) in a gale, the folds getting shorter as the wind rises.
  const lam = 0.95 - 0.09 * wind, amp = ((0.55 + 0.09 * wind) * lam) / TAU, lift = 1.5 + 0.6 * wind;
  const cu = S.cu, cdy = S.cdy, csh = S.csh, cdu = S.cdu, xs = S.xs, ys = S.ys, ss = S.ss, N = STEPS;
  // March along the cloth in small steps, adding up how far along the panel
  // each step goes (its length times the cosine of its tilt).
  let x = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N, g = u ** 0.9, th = (TAU * u) / lam - t + ph;
    // The slope of the fold, dz/dx, which tilts the column.
    const slope = amp * g * (TAU / lam) * cos(th) + amp * 0.9 * max(u, 0.01) ** -0.1 * sin(th);
    const tilt = atan(slope);
    if (i > 0) x += (l / N) * cos(tilt);
    xs[i] = x;
    ys[i] = lift * g * sin(th - 0.9) + 0.4 * lift * u * u * sin(2 * th + 0.5);
    // Lambert light on the tilted column, never black.
    ss[i] = 0.3 + 0.78 * max(0, -sin(tilt) * LX + cos(tilt) * LZ);
  }
  const end = xs[N];
  // Each LED column the flag reaches: the u at its centre by walking the
  // table, and how much u one LED spans there.
  let j = 0;
  const cols = min(W - X0, floor(end) + 1);
  for (let col = 0; col < cols; col++) {
    const xc = col + 0.5;
    while (j < N - 1 && xs[j + 1] < xc) j++;
    const f = cl((xc - xs[j]) / max(1e-6, xs[j + 1] - xs[j]), 0, 1);
    cu[col] = (j + f) / N;
    cdy[col] = ys[j] + (ys[j + 1] - ys[j]) * f;
    csh[col] = ss[j] + (ss[j + 1] - ss[j]) * f;
    cdu[col] = 1 / (N * max(1e-6, xs[j + 1] - xs[j]));
  }
  const fn = FLAGS[ch], notch = ch === "A" || ch === "B";
  const y0 = max(0, floor(top - 8)), y1 = min(H - 1, floor(top + d + 8));
  for (let c = 0; c < cols; c++) {
    const px = X0 + c, u = cu[c], du = cdu[c], dy = cdy[c], sh = csh[c];
    // The fly edge, soft.
    const aFly = cl(end - c, 0, 1);
    for (let py = y0; py <= y1; py++) {
      const yy = py + 0.5 - top - dy;
      const aEdge = cl(min(yy, d - yy) + 0.5, 0, 1);
      if (aEdge <= 0) continue;
      // Four samples a quarter LED from the centre. A sample in the
      // swallowtail's notch is sky, so it only thins the LED.
      let r = 0, g = 0, b = 0, hits = 0;
      for (let s = 0; s < 4; s++) {
        const su = cl(u + ((s & 1) - 0.5) * 0.5 * du, 0, 0.9999), sv = cl((yy + ((s >> 1) - 0.5) * 0.5) / d, 0, 0.9999);
        if (notch && su > 1 - NOTCH * (1 - abs(2 * sv - 1))) continue;
        const cc = CLOTH[fn(su, sv, l, d)];
        r += cc[0];
        g += cc[1];
        b += cc[2];
        hits++;
      }
      if (!hits) continue;
      const a = (aEdge * aFly * hits) / 4, kk = (py * W + px) * 3, m = sh / 255 / hits;
      acc[kk] += (r * m - acc[kk]) * a;
      acc[kk + 1] += (g * m - acc[kk + 1]) * a;
      acc[kk + 2] += (b * m - acc[kk + 2]) * a;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc, sky = S.sky, sk = sky ** 1.5, t = S.t;
  // The sky: night is near black with a blue breath at the top; the blue
  // hour runs deep blue to violet to amber at the foot.
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const nr = 0, ng = 2 + 4 * (1 - v), nb = 5 + 12 * (1 - v);
    const hr = v < 0.6 ? 20 + 60 * (v / 0.6) : 80 + 120 * ((v - 0.6) / 0.4);
    const hg = v < 0.6 ? 34 + 6 * (v / 0.6) : 40 + 50 * ((v - 0.6) / 0.4);
    const hb = v < 0.6 ? 120 - 20 * (v / 0.6) : 100 - 70 * ((v - 0.6) / 0.4);
    const r = (nr + (hr - nr) * sk) / 255, g = (ng + (hg - ng) * sk) / 255, b = (nb + (hb - nb) * sk) / 255;
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      acc[k] = r;
      acc[k + 1] = g;
      acc[k + 2] = b;
    }
  }
  const starA = 1 - smooth(sky * 1.6);
  for (const [x, y, p, m] of STARS) {
    const k = (y * W + x) * 3, v = starA * m * (0.13 + 0.07 * sin(t * 1.7 + p));
    acc[k] = max(acc[k], v);
    acc[k + 1] = max(acc[k + 1], v);
    acc[k + 2] = max(acc[k + 2], v * 1.1);
  }
  // The halyard: a laid rope whose lay marks travel with the hoist.
  const off = S.y;
  for (let y = 0; y < H; y++) {
    const lay = (((floor(y - off) % 3) + 3) % 3) === 0 ? 0.62 : 0.42;
    const k = (y * W + HX) * 3;
    acc[k] = 0.92 * lay;
    acc[k + 1] = 0.84 * lay;
    acc[k + 2] = 0.68 * lay;
  }
  const [d, l] = SIZE[S.n];
  const word = S.word;
  for (let i = 0; i < word.length; i++) {
    const top = S.y + i * (d + GAP);
    if (top > H + 8 || top + d < -8) continue;
    flag(S, acc, word[i], top, d, l, i * 1.7);
    // The toggle and the snap that join each flag to the halyard.
    for (const yy of [top, top + d - 1]) {
      const iy = round(yy);
      if (iy >= 0 && iy < H) for (let x = HX; x <= X0; x++) {
        const k = (iy * W + x) * 3;
        acc[k] = 0.75;
        acc[k + 1] = 0.72;
        acc[k + 2] = 0.66;
      }
    }
  }
  // The plain letters, two LEDs a dot, 9 LEDs clear of the fly.
  if (S.show > 0.01) {
    const a = smooth(S.show), lx = X0 + l + 9;
    for (let i = 0; i < word.length; i++) {
      const g = FONT[word[i]], top = round(S.y + i * (d + GAP) + d / 2 - 7);
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++) {
          if (g[gy * 5 + gx] !== "#") continue;
          for (let q = 0; q < 4; q++) {
            const x = lx + gx * 2 + (q & 1), y = top + gy * 2 + (q >> 1);
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const k = (y * W + x) * 3;
            acc[k] += (0.94 - acc[k]) * a;
            acc[k + 1] += (0.92 - acc[k + 1]) * a;
            acc[k + 2] += (0.86 - acc[k + 2]) * a;
          }
        }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, (255 * min(1, acc[k])) | 0, (255 * min(1, acc[k + 1])) | 0, (255 * min(1, acc[k + 2])) | 0);
    }
}
