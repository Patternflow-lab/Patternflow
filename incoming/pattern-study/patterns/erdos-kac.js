// ===== Patternflow pattern =====
// Title:   Erdős-Kac
// Family:  data
// Idea:    The integers pour down as stacks of coloured blocks, one block to each distinct prime factor, into eight piles by how many distinct primes they have, while a bell curve with mean and variance ln ln N is laid over the piles and the mean of the integers counted so far is marked beside ln ln N.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Erdős-Kac theorem (Paul Erdős and Mark Kac, 1940, from memory) on the Hardy-Ramanujan result that a typical integer n has about ln ln n distinct prime factors (G. H. Hardy and Srinivasa Ramanujan, 1917, from memory); Mertens' constant 0.2615, the gap the mean keeps above ln ln N (Franz Mertens, 1874, from memory); omega counted with a smallest-prime-factor sieve to 2^20; the 3 by 5 digits of Kasiski Examination (pattern round 108), copied from edit-distance.js by way of clapping-music.js, and the capital N of Saccades (pattern round 106), copied from horspool.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, From=0..6, Log=0..1
//
// Knob 1: Hue. Turns every tint round the wheel together. At 0 the blocks of the prime 2 are red, 3 orange, 5 lime, 7 green, 11 azure, 13 violet and every larger prime slate blue; the bell and the ln ln N mark are azure and the mean is gold. At 0.5 the wheel is half round and 2 is cyan.
// Knob 2: Speed. How fast N climbs: at least 2 x Speed integers a second at the start, then 0.12 x Speed decades a second. At 2, the opening, N passes 10 at 2.8 s, 100 at 7.0 s, 1000 at 11.2 s, 10^4 at 15.4 s, 10^5 at 19.6 s and 10^6 at 23.8 s, and reaches the sieve's end, 2^20 = 1,048,576, at 23.9 s. That is held for 4.5 s, rewound along the same log scale in 2.2 s, and rested for 0.6 s at the start, so a round takes 30.6 s. 0.2 is about ten times slower and 3 gets to the end in 16.2 s.
// Knob 3: From. A hand on N, 0 to 6, added to the clock in decades: the run climbs from N = 10^From and a turn mid-run moves N the same way at once. It opens at 0, which is N = 1. At 3 the run goes from 1000 to 2^20 in 13.3 s and at 5 from 100000 in 4.9 s; at 6 the run is at the end 0.1 s after the rest, and N stays there.
// Knob 4: Log. Slides the height of every pile, and of the bell, from the count to ln(1 + count), the tallest pile still 96 rows. It opens at 0.06 and the slide is eased, so that is 1% of the way. At N = 10^6 the piles for omega 0 to 7 are 1.2, 19.9, 73.0, 96.0, 52.6, 10.7, 1.2 and 1.2 rows at 0 (a pile under a row is drawn 1.2 rows so it shows), and 5.2, 84.2, 94.0, 96.0, 91.5, 79.6, 57.8 and 16.4 at 1, where the bell stands 65.5 rows over omega 7, whose pile holds 8 integers.

const W = 64, H = 128, NPX = W * H;
const { floor, min, max, abs, exp, sqrt, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, f) => a + (b - a) * f;
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Digits 3 wide and 5 tall from clapping-music.js by way of edit-distance.js, the capital N from horspool.js, a point and a minus.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  N: "##.|#.#|#.#|#.#|#.#", "-": "...|...|###|...|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));
GLYPH["."] = [0, 0, 0, 0, 1];

// The sieve runs to 2^20. A checkpoint every STEP integers keeps the running counts, so the counts at any N cost at most STEP steps.
const LIM = 1 << 20, STEP = 512, NCP = LIM / STEP + 1, XMAX = log(LIM) / Math.LN10;
// The eight columns, omega 0 to 7, are 7 LEDs wide on a pitch of 8; the foot of the piles is row BASE.
const BASE = 117, HMAX = 96, RAIN = 13;
// The primes that get a tint of their own, and the class of every other prime.
const cls = (p) => (p === 2 ? 0 : p === 3 ? 1 : p === 5 ? 2 : p === 7 ? 3 : p === 11 ? 4 : p === 13 ? 5 : 6);
const TONE = [
  [0.0, 0.7, 1], [0.1, 0.72, 1], [0.2, 0.6, 1], [0.38, 0.62, 1], [0.54, 0.62, 1], [0.72, 0.58, 1], [0.62, 0.3, 0.7],
];
const HOLD = 4.5, REWIND = 2.2, REST = 0.6;

export function setup(params) {
  // The smallest prime factor of every n up to LIM, then omega, the count of distinct primes, from it.
  const spf = new Int32Array(LIM + 1), om = new Uint8Array(LIM + 1);
  for (let p = 2; p * p <= LIM; p++) if (!spf[p]) for (let j = p * p; j <= LIM; j += p) if (!spf[j]) spf[j] = p;
  for (let n = 2; n <= LIM; n++) if (!spf[n]) spf[n] = n;
  const cc = new Int32Array(NCP * 8), cb = new Int32Array(NCP * 56), col = new Int32Array(8), bnd = new Int32Array(56);
  for (let n = 1; n <= LIM; n++) {
    let k = 0;
    if (n > 1) {
      const p = spf[n], m = n / p;
      k = om[m] + (spf[m] === p ? 0 : 1);
      om[n] = k;
    }
    col[k]++;
    for (let r = n; r > 1; ) {
      const p = spf[r];
      bnd[k * 7 + cls(p)]++;
      do r /= p;
      while (r > 1 && spf[r] === p);
    }
    if (n % STEP === 0) {
      const i = n / STEP;
      cc.set(col, i * 8);
      cb.set(bnd, i * 56);
    }
  }
  params.s = {
    rgb: new Float32Array(NPX * 3), spf, om, cc, cb,
    C: new Float64Array(8), B: new Float64Array(56), top: new Float64Array(8), flash: new Float64Array(8),
    tint: [0, 1, 2, 3, 4, 5, 6].map(() => [0, 0, 0]), ink: [0, 0, 0],
    hue: 0, speed: 2, from: 0, log: 0.06,
    c: 0, N: 1, phase: 3, pt: 0, c0: 0, lastM: 0, acc: 1, hacc: 0,
    fmax: 1, p: 1, mu: 0, emean: 1,
    stacks: [], shown: 1, rd: 0,
  };
}

// The integer m added to the counts with weight w: its column, and one block of its tint for each distinct prime.
function addInt(S, m, w) {
  const k = S.om[m];
  S.C[k] += w;
  for (let r = m; r > 1; ) {
    const p = S.spf[r];
    S.B[k * 7 + cls(p)] += w;
    do r /= p;
    while (r > 1 && S.spf[r] === p);
  }
}

// The counts of omega over 1..N, for a fractional N: the integers up to its floor and the next one in part.
function countsAt(S, N) {
  const n0 = min(floor(N), LIM), f = N - n0, i = min(NCP - 1, floor(n0 / STEP));
  for (let k = 0; k < 8; k++) S.C[k] = S.cc[i * 8 + k];
  for (let j = 0; j < 56; j++) S.B[j] = S.cb[i * 56 + j];
  for (let m = i * STEP + 1; m <= n0; m++) addInt(S, m, 1);
  if (f > 0 && n0 < LIM) addInt(S, n0 + 1, f);
}

// The height of a count on the slide between linear and logarithmic: (1 + c)^p less 1, over p.
const tr = (S, c) => (Math.pow(1 + c, S.p) - 1) / S.p;

// A stack of coloured blocks for the integer m, smallest prime at the foot.
function spawn(S, m) {
  const blocks = [];
  for (let r = m; r > 1; ) {
    const p = S.spf[r];
    blocks.push(cls(p));
    do r /= p;
    while (r > 1 && S.spf[r] === p);
  }
  S.stacks.push({ k: blocks.length, blocks, y: RAIN, vy: 28, age: -1 });
  if (S.stacks.length > 40) S.stacks.shift();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.from = cl(kv[2], 0, 6);
  S.log = cl(kv[3], 0, 1);

  // The clock c is decades climbed; N stands at 10^(From + c). The first integers come at least two a second a unit of Speed.
  if (S.phase === 0) {
    let N = 10 ** min(S.c + S.from, XMAX);
    N += max(2 * S.speed, N * Math.LN10 * 0.12 * S.speed) * d;
    S.c = max(0, log(N) / Math.LN10 - S.from);
    if (S.c + S.from >= XMAX) (S.phase = 1), (S.pt = 0);
  } else if (S.phase === 1) {
    S.pt += d;
    if (S.pt >= HOLD) (S.phase = 2), (S.pt = 0), (S.c0 = S.c);
  } else if (S.phase === 2) {
    S.pt += d;
    S.c = S.c0 * (1 - sm(S.pt / REWIND));
    if (S.pt >= REWIND) (S.phase = 3), (S.pt = 0), (S.c = 0);
  } else {
    S.pt += d;
    if (S.pt >= REST) (S.phase = 0), (S.pt = 0);
  }
  S.N = S.c + S.from >= XMAX ? LIM : max(1, 10 ** (S.c + S.from));
  const N = S.N;
  // The count in the corner is read at 12 a second, so its digits can be read while they run.
  S.rd -= d;
  if (S.rd <= 0) (S.rd = 0.08), (S.shown = floor(N));

  // Stacks fall for the integers N passes, at most seven a second; at the top of the run, for integers drawn from all of 1..N.
  S.acc = min(S.acc + d * 7, 2);
  const nInt = floor(N);
  if (nInt < S.lastM) S.lastM = nInt;
  if (S.phase === 0 && nInt > S.lastM && S.acc >= 1) {
    spawn(S, nInt);
    S.lastM = nInt;
    S.acc -= 1;
  } else if (S.phase === 1) {
    S.hacc += d * 3.5;
    if (S.hacc >= 1) (S.hacc -= 1), spawn(S, 1 + floor(Math.random() * nInt));
  }

  countsAt(S, N);
  let tot = 0, mx = 0, s1 = 0;
  for (let k = 0; k < 8; k++) {
    const c = S.C[k];
    tot += c;
    mx = max(mx, c);
    s1 += k * c;
  }
  // Log slides the height of a pile from the count to its logarithm, along (1 + c)^p, p from 1 to 0.
  S.p = max(1e-4, 1 - sm(S.log));
  S.fmax = tr(S, mx);
  for (let k = 0; k < 8; k++) S.top[k] = S.C[k] > 0 ? BASE + 1 - max(1.2, (HMAX * tr(S, S.C[k])) / S.fmax) : BASE + 1;
  S.emean = s1 / tot;
  S.mu = N > 2.8 ? log(log(N)) : 0;

  // Stacks fall and land on the top of their column.
  for (let k = 0; k < 8; k++) S.flash[k] = max(0, S.flash[k] - d * 5);
  for (const st of S.stacks) {
    if (st.age >= 0) {
      st.age += d;
      continue;
    }
    st.vy += 300 * d;
    st.y += st.vy * d;
    const land = S.top[st.k];
    if (st.y >= land - 0.5) {
      st.y = land - 0.5;
      st.age = 0;
      S.flash[st.k] = 1;
    }
  }
  S.stacks = S.stacks.filter((st) => st.age < 0.16);
}

function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  const q = a > 1 ? 1 : a;
  rgb[p] += (c[0] - rgb[p]) * q;
  rgb[p + 1] += (c[1] - rgb[p + 1]) * q;
  rgb[p + 2] += (c[2] - rgb[p + 2]) * q;
}

function glyph(rgb, ch, x, y, c, a) {
  const G = GLYPH[ch];
  if (!G) return;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (G[j * 3 + i]) put(rgb, x + i, y + j, c, a);
}

// A string of digits from x; a point takes 2 LEDs, a digit 4.
function text(rgb, str, x, y, c, a) {
  for (const ch of str) {
    glyph(rgb, ch, x, y, c, a);
    x += ch === "." ? 2 : 4;
  }
}

// A rectangle with whole LED columns x0..x1 and fractional rows t..b.
function rect(rgb, x0, x1, t, b, c, a) {
  for (let y = floor(t); y < b; y++) {
    const cov = min(y + 1, b) - max(y, t);
    if (cov > 0) for (let x = x0; x <= x1; x++) put(rgb, x, y, c, a * cov);
  }
}

const gauss = (v, m, s) => exp(-((v - m) * (v - m)) / (2 * s * s)) / (s * sqrt(2 * PI));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.rgb) return;
  const rgb = S.rgb, N = S.N, tmp = [0, 0, 0];
  rgb.fill(0);
  const T = S.tint;
  for (let i = 0; i < 7; i++) hsv(TONE[i][0] + S.hue, TONE[i][1], TONE[i][2], T[i]);
  const azure = hsv(0.54 + S.hue, 0.5, 1, [0, 0, 0]), gold = hsv(0.13 + S.hue, 0.55, 1, [0, 0, 0]);
  const bell = azure;
  const show = sm((log(N) - 1.4) / 1.1);

  // The bell's height at every LED column, in rows above the foot, on the same scale as the piles.
  const bellY = new Float64Array(W + 1);
  for (let x = 0; x <= W; x++) bellY[x] = BASE + 1 - (HMAX * tr(S, N * gauss((x - 3.5) / 8, S.mu, sqrt(max(0.09, S.mu))))) / S.fmax;

  // The piles. Each column is cut into bands, one per prime class, as tall as that class's share of the blocks in the column.
  for (let k = 0; k < 8; k++) {
    const c = S.C[k];
    if (c <= 0) continue;
    const h = BASE + 1 - S.top[k], x0 = k * 8;
    let blocks = 0;
    for (let b = 0; b < 7; b++) blocks += S.B[k * 7 + b];
    for (let y = BASE; y >= floor(S.top[k]); y--) {
      const lo = BASE - y, hi = min(BASE + 1 - y, h);
      if (hi <= lo) continue;
      tmp[0] = tmp[1] = tmp[2] = 0;
      if (blocks <= 0) {
        // Omega 0 is the integer 1 alone: no primes, so no tint.
        tmp[0] = 0.5; tmp[1] = 0.52; tmp[2] = 0.58;
      } else {
        let cum = 0;
        for (let b = 0; b < 7; b++) {
          const a = cum * h, z = (cum + S.B[k * 7 + b] / blocks) * h;
          cum += S.B[k * 7 + b] / blocks;
          const ov = min(hi, z) - max(lo, a);
          if (ov > 0) for (let e = 0; e < 3; e++) tmp[e] += T[b][e] * ov;
        }
        for (let e = 0; e < 3; e++) tmp[e] /= hi - lo;
      }
      // A landing lifts the top of the pile.
      const up = S.flash[k] * 0.6 * cl(1 - (h - lo) / 4, 0, 1);
      for (let e = 0; e < 3; e++) tmp[e] = mix(tmp[e] * 0.78, 1, up);
      for (let x = x0; x < x0 + 7; x++) put(rgb, x, y, tmp, (hi - lo) * (x === x0 || x === x0 + 6 ? 0.82 : 1));
    }
  }

  // The bell as a veil from its outline down to the foot, over the piles: what sticks out above it is a surplus of integers.
  if (show > 0)
    for (let x = 0; x < W; x++) {
      const yc = max(RAIN, 0.5 * (bellY[x] + bellY[x + 1]));
      for (let y = floor(yc); y <= BASE; y++) put(rgb, x, y, bell, 0.2 * show * min(1, y + 1 - yc));
    }

  // The bell's outline.
  if (show > 0)
    for (let x = 0; x < W; x++) {
      const a = bellY[x], b = bellY[x + 1], t = min(a, b) - 0.5, bt = max(a, b) + 0.5;
      for (let y = floor(max(t, RAIN)); y < min(bt, BASE + 1); y++) put(rgb, x, y, bell, 0.95 * show * cl(min(y + 1, bt) - max(y, t), 0, 1));
    }

  // The falling stacks.
  for (const st of S.stacks) {
    const fade = st.age < 0 ? 1 : 1 - st.age / 0.16, x0 = st.k * 8;
    if (st.blocks.length === 0) rect(rgb, x0 + 1, x0 + 5, st.y - 2, st.y, [0.5, 0.55, 0.65], 0.7 * fade);
    st.blocks.forEach((cl2, i) => {
      const b = st.y - 3 * i;
      const top = max(b - 2, RAIN);
      if (top < b) rect(rgb, x0, x0 + 6, top, b, [mix(T[cl2][0], 1, 0.3), mix(T[cl2][1], 1, 0.3), mix(T[cl2][2], 1, 0.3)], fade);
    });
  }
  // This is drawn after the stacks so a stack does not hide the readout.

  // The axis, the omega labels and the two marks: the empirical mean and ln ln N.
  for (let x = 0; x < W; x++) put(rgb, x, BASE + 1, [0.6, 0.65, 0.8], 0.28);
  for (let k = 0; k < 8; k++) glyph(rgb, String(k), k * 8 + 2, 123, [0.55, 0.6, 0.78], 0.8);
  const mark = (v, row, c) => {
    const cx = v * 8 + 3.5;
    for (let x = floor(cx - 1); x <= floor(cx + 1); x++) {
      const a = cl(min(x + 1, cx + 1) - max(x, cx - 1), 0, 1);
      put(rgb, x, row, c, a);
      put(rgb, x, row + 1, c, a);
    }
  };
  if (S.mu > 0) mark(S.mu, 119, azure);
  mark(S.emean, 121, gold);

  // The readout: N, then the empirical mean in gold beside ln ln N in azure.
  glyph(rgb, "N", 1, 1, [0.7, 0.75, 0.9], 0.9);
  text(rgb, String(S.shown), 5, 1, [1, 1, 1], 0.92);
  rect(rgb, 1, 2, 7, 12, gold, 0.95);
  text(rgb, S.emean.toFixed(2), 4, 7, gold, 0.95);
  rect(rgb, 33, 34, 7, 12, azure, 0.95);
  if (S.mu > 0) text(rgb, S.mu.toFixed(2), 36, 7, azure, 0.95);
  else text(rgb, "-", 36, 7, azure, 0.95);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
