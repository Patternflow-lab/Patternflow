// ===== Patternflow pattern =====
// Title:   Pipe Organ
// Family:  music
// Idea:    The tin front pipes of a church organ stand in towers and flats while an unseen organist plays a chorale, and each pipe that speaks lights at its mouth with a standing wave shimmering up its body, the bass in the tall pipes and the tune in the small ones, as light from a rose window drifts across the case.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after the tower-and-flat fronts of North German Baroque organ cases and four-part chorale harmony
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Stops=0..1, Tempo=0.2..3, Voices=1..6, Tremulant=0..1
//
// Knob 1: Stops. The registration. Flutes at 0 glow soft blue in two broad bands; principals in the middle speak silver-white and add the octave above each note; the reeds at 1 burn gold at the mouth and red up the body in six bands, with the octave below, the twelfth and the fifteenth speaking too.
// Knob 2: Tempo. At 2 a chord takes a second, so a phrase of eight with its held last chord takes about nine; at 0.2 a chord holds for ten seconds and at 3 for two thirds of one.
// Knob 3: Voices. How many parts the hands play over the pedal: at 1 the tune alone over the bass, at 3 the four-part chorale, and 4 to 6 add parts that fill out the chord.
// Knob 4: Tremulant. The wind shakes. The shimmer in the speaking pipes throbs and wavers, and the two candles on the case flicker and gutter until the light on the whole lower case flickers with them.
// Buttons: K1 tap is full organ: every pipe in the front speaks at once for about three seconds.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, floor, round, sin, cos, abs, exp, sqrt, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Pipe d sounds the d-th note of a major scale up from the longest pipe, and
// an open pipe halves its length each octave.
const STEP = [0, 2, 4, 5, 7, 9, 11];
const len = (d) => 92 * 2 ** (-(12 * floor(d / 7) + STEP[d % 7]) / 12);
// The front: the lowest note in the middle of the centre tower, then pairs,
// the lower note left and the next one right, as the C and C sharp chests of
// a real case split a scale between the two sides.
const PIPES = [];
function pair(d, x, w, top, mouth, base) {
  const L = d ? (len(d) + len(d + 1)) / 2 : len(0);
  const t = round(top >= 0 ? top : mouth - L);
  const m = round(top >= 0 ? top + L : mouth);
  const mh = w >= 5 ? 2 : 1;
  PIPES[d] = { x, w, top: t, m, mh, f0: m + mh + 1, base };
  if (d) PIPES[d + 1] = { x: W - x - w, w, top: t, m, mh, f0: m + mh + 1, base };
}
// The centre tower and the side towers hang from their crowns, so their
// mouths step; the flats stand on equal feet, so their tops ramp.
pair(0, 29, 6, 9, 0, 110);
pair(1, 23, 5, 12, 0, 110);
pair(3, 1, 4, 30, 0, 110);
pair(5, 6, 4, 38, 0, 110);
pair(7, 19, 3, -1, 102, 110);
pair(9, 15, 3, -1, 102, 110);
pair(11, 11, 3, -1, 102, 110);
pair(13, 19, 3, -1, 44, 50);
pair(15, 15, 3, -1, 44, 50);
pair(17, 11, 3, -1, 44, 50);
const NP = 19;

// Eight-chord phrases on the scale's chords, I = 0 to vi = 5. The first one
// always opens the piece.
const PHRASES = [
  [0, 4, 5, 3, 0, 1, 4, 0],
  [0, 5, 1, 4, 0, 3, 4, 0],
  [5, 3, 0, 4, 5, 1, 4, 4],
  [0, 3, 0, 4, 5, 1, 4, 0],
  [3, 4, 0, 5, 1, 0, 4, 0],
  [0, 2, 5, 3, 1, 4, 4, 0],
];
// Voices in the order the knob adds them: soprano, bass, alto, tenor, then
// three that fill the chord.
const VORD = [0, 3, 1, 2, 4, 5, 6];

// Surfaces, as how much of each light they give back.
const TIN = [0.9, 0.95, 1];
const WOOD = [0.42, 0.25, 0.15];
const GILT = [1.3, 1, 0.42];
const DARK = [0.07, 0.05, 0.045];
const STONE = [0.9, 0.88, 0.84];
// Grey daylight from the nave, the candles, and the lamp on the music desk.
const DAY = [56, 56, 64];
const CAN = [200, 126, 58];
const LAMP = [255, 210, 140];
// The rose window's glass.
const RUBY = [230, 40, 60];
const SAPH = [50, 90, 255];
const AMBER = [255, 200, 80];
const GREEN = [60, 200, 110];
const ROSE = [RUBY, SAPH, GREEN, SAPH];
// Stop colours: flute, principal, reed at the mouth and up the body, full organ.
const FLUTE = [0.35, 0.62, 1];
const PRIN = [0.84, 0.9, 1];
const REED0 = [1, 0.77, 0.27];
const REED1 = [1, 0.2, 0.08];
const FULL = [1, 0.86, 0.58];

// Round tin: a highlight a third of the way across and a dark far edge.
function shade(p) {
  return (0.2 + 0.5 * sin(PI * p) ** 0.7 + 0.55 * exp(-(((p - 0.36) / 0.14) ** 2))) * (1.1 - 0.4 * p);
}

// Carved and gilt pipe shades: pierced scrolls.
function fret(x, y) {
  return sin(x * 1.25 + 2 * sin(y * 0.52)) * sin(y * 0.9 + 1.6 * sin(x * 0.61));
}

function build(P) {
  const A = P.A;
  const put = (x, y, c, k = 1, a = 1) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    for (let n = 0; n < 3; n++) A[o + n] = mix(A[o + n], c[n] * k, a);
  };
  // Left half and its mirror.
  const two = (x, y, c, k, a) => (put(x, y, c, k, a), put(W - 1 - x, y, c, k, a));
  const row = (x0, x1, y, c, k) => {
    for (let x = x0; x <= x1; x++) two(x, y, c, k);
  };
  // The church wall: courses of ashlar.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cs = floor(y / 5), off = (cs & 1) * 4, mortar = y % 5 === 4 || (x + off) % 8 === 7;
      put(x, y, STONE, mortar ? 0.14 : 0.27 + 0.1 * hash(floor((x + off) / 8), cs));
    }
  // The case, dark inside.
  for (let y = 0; y < 114; y++) for (let x = 0; x < 32; x++) if (x > 21 || (x > 9 ? y >= 11 : y >= 22)) two(x, y, DARK, 1);
  // Stiles between the towers and the flats.
  for (const [x, y0] of [[0, 30], [10, 16], [22, 9]]) for (let y = y0; y < 110; y++) two(x, y, WOOD, 1.05 + 0.15 * sin(y * 0.8) * (y % 12 < 2 ? 1 : 0));
  // The side towers' crowns, each with a gilt urn and a flame on top.
  row(0, 10, 29, GILT, 0.9);
  for (let y = 26; y <= 28; y++) row(0, 10, y, WOOD, 0.9);
  for (const x of [2, 5, 8]) two(x, 27, GILT, 1.05);
  row(0, 10, 25, GILT, 1.05);
  row(0, 10, 24, WOOD, 0.7);
  row(0, 10, 23, WOOD, 1);
  row(0, 10, 22, GILT, 1.15);
  const URN = [[21, 2], [20, 1], [19, 2], [18, 2], [17, 1], [16, 0], [15, 1], [14, 0]];
  for (const [y, r] of URN) for (let x = 5 - r; x <= 5 + r; x++) two(x, y, GILT, 1.15 - 0.18 * (x - 5 + r));
  // The upper flats' cornice and a scroll pediment.
  row(10, 22, 15, GILT, 0.9);
  for (let y = 12; y <= 14; y++) for (let x = 10; x <= 22; x++) two(x, y, WOOD, y === 13 && x % 2 ? 1.25 : 0.9);
  row(10, 22, 11, GILT, 1.1);
  row(12, 20, 10, GILT, 0.75);
  for (const [x, y] of [[12, 9], [13, 9], [19, 9], [20, 9], [14, 8], [15, 8], [17, 8], [18, 8], [16, 7], [16, 6]]) two(x, y, GILT, 1.05);
  // The centre tower's crown, with a carved crest over it.
  row(22, 31, 8, GILT, 0.95);
  for (let y = 5; y <= 7; y++) for (let x = 22; x <= 31; x++) two(x, y, x % 4 === 1 && y === 6 ? GILT : WOOD, x % 4 === 1 && y === 6 ? 1.1 : 0.9);
  row(22, 31, 4, GILT, 1.1);
  for (let x = 23; x <= 31; x++) {
    const h = 4 * (1 - ((x - 31.5) / 9) ** 2);
    for (let y = floor(4 - h); y < 4; y++) if (fret(x, y + 3) > -0.2 || x === 31) two(x, y, GILT, x === 31 ? 1.25 : 0.8 + 0.3 * fret(x, y));
  }
  // Pipe shades over every pipe that stops short of the carving above it.
  const GAP = [5, 14, 18, 28, 35, 45, 49, 58];
  for (const q of PIPES) {
    const y0 = q.base === 50 ? 16 : q.x === 1 || q.x === 6 || q.x > 53 ? 30 : q.x > 22 && q.x < 41 ? 9 : 54;
    for (let x = q.x - 1; x <= q.x + q.w; x++) {
      const own = x >= q.x && x < q.x + q.w;
      if (own || GAP.indexOf(x) >= 0)
        for (let y = y0; y < q.top; y++) {
          const v = fret(x, y);
          if (own && y === q.top - 1) put(x, y, GILT, 1.05);
          else if (v > -0.1) put(x, y, GILT, 0.55 + 0.5 * v);
        }
    }
  }
  // Under the lower flats the pipe shades of the upper ones, and the shelf they stand on.
  row(10, 22, 50, GILT, 0.95);
  row(10, 22, 51, WOOD, 1);
  row(10, 22, 52, WOOD, 0.9);
  row(10, 22, 53, WOOD, 0.55);
  // The pipes: body, mouth with its lips, and the conical foot.
  for (const q of PIPES) {
    const { x, w, top, m, mh, f0, base } = q;
    for (let y = top; y < m; y++) for (let j = 0; j < w; j++) put(x + j, y, TIN, shade((j + 0.5) / w) * (y === top ? 0.7 : 1));
    for (let j = 0; j < w; j++) {
      const inner = j > 0 && j < w - 1, s = shade((j + 0.5) / w);
      if (inner) put(x + j, m - 1, TIN, s * 1.3);
      for (let y = m; y < m + mh; y++) put(x + j, y, inner ? DARK : TIN, inner ? 0.8 : s);
      put(x + j, m + mh, TIN, s * (inner ? 1.15 : 0.9));
    }
    if (w >= 5) for (let j = floor((w - 1) / 2); j <= floor(w / 2); j++) put(x + j, m - 2, TIN, 1.25);
    const cx = x + w / 2;
    for (let y = f0; y < base; y++) {
      const hw = mix(w / 2, 0.7, (y - f0) / max(1, base - 1 - f0));
      for (let xx = floor(cx - hw); xx <= cx + hw; xx++) {
        const cov = cl(hw - abs(xx + 0.5 - cx) + 0.5, 0, 1);
        put(xx, y, TIN, 0.9 * shade(cl((xx + 0.5 - cx + hw) / (2 * hw), 0, 1)), cov);
      }
    }
  }
  // The impost the pipes stand on.
  for (let x = 0; x < W; x++) {
    put(x, 110, GILT, 1);
    put(x, 111, WOOD, x % 16 === 0 ? 0.6 : 1);
    put(x, 112, WOOD, x % 16 === 0 ? 0.6 : 0.95);
    put(x, 113, WOOD, 0.5);
  }
  // Candles on the stiles between the side towers and the flats.
  for (let y = 98; y <= 101; y++) two(10, y, [0.95, 0.9, 0.8], 0.5);
  for (let x = 9; x <= 11; x++) two(x, 102, GILT, 0.6);
  // The console: the music desk with its lamp, and one manual.
  for (let y = 114; y < H; y++) for (let x = 0; x < W; x++) put(x, y, WOOD, 0.7);
  for (let y = 114; y <= 119; y++) for (let x = 16; x <= 47; x++) put(x, y, WOOD, 0.85);
  for (let y = 115; y <= 119; y++)
    for (let x = 21; x <= 42; x++) put(x, y, [0.95, 0.9, 0.76], y === 116 || y === 118 ? 0.62 : hash(x, y) < 0.13 ? 0.3 : 1);
  for (let x = 27; x <= 36; x++) put(x, 114, GILT, 1.15);
  for (let k = 0; k < 21; k++) {
    for (let y = 121; y <= 125; y++) for (let x = 3 * k; x < 3 * k + 2; x++) put(x, y, [0.92, 0.88, 0.78], y === 125 ? 0.7 : 1);
    const n = (k + 6) % 7;
    if (k < 20 && n !== 2 && n !== 6) for (let y = 121; y <= 123; y++) put(3 * k + 2, y, DARK, 1), put(3 * k + 3, y, DARK, 1);
  }
  // Light: grey daylight from above, warm candlelight, the desk lamp.
  for (let i = 0; i < N; i++) {
    const x = (i & 63) + 0.5, y = (i >> 6) + 0.5;
    P.day[i] = 0.45 + 0.55 * (1 - y / H) ** 1.3;
    P.cL[i] = 0.85 / (1 + ((x - 10.5) ** 2 + (y - 96) ** 2) / 450);
    P.cR[i] = 0.85 / (1 + ((x - 53.5) ** 2 + (y - 96) ** 2) / 450);
    P.lamp[i] = y > 115 ? 1.1 / (1 + (x - 32) ** 2 / 90 + (y - 115) ** 2 / 40) : 0.45 / (1 + ((x - 32) ** 2 + (y - 114) ** 2) / 140);
  }
}

// The nearest scale degree in lo..hi under cap whose note is in pcs, moving
// from prev, sitting still costing `same`.
function near(lo, hi, pcs, prev, same, cap) {
  let best = -1;
  let bs = 1e9;
  for (let d = lo; d <= hi; d++) {
    if (d >= cap || pcs.indexOf(d % 7) < 0) continue;
    const j = abs(d - prev), s = j + (j === 0 ? same : 0) + (j > 4 ? 2 : 0) + rnd() * 0.9;
    if (s < bs) (bs = s), (best = d);
  }
  return best < 0 ? (cap < 99 ? near(lo, hi, pcs, prev, same, 99) : prev) : best;
}

// The next chord of the chorale, voiced from the last one.
function chord(P) {
  if (P.pi >= P.ph.length) (P.ph = PHRASES[floor(rnd() * PHRASES.length)]), (P.pi = 0);
  const r = P.ph[P.pi++], last = P.pi === P.ph.length, pen = P.pi === P.ph.length - 1;
  const T = [r, (r + 2) % 7, (r + 4) % 7];
  if (pen && r === 4 && rnd() < 0.6) T.push(3);
  const [s0, a0, t0, b0] = P.prev;
  const B = near(0, 7, [!last && !pen && rnd() < 0.3 ? T[1] : r], b0, 0, 99);
  const S = near(11, 18, last && r === 0 ? [0] : T, s0, 1.6, 99);
  const A = near(8, 14, T, a0, 0.4, S);
  const miss = T.filter((c) => c !== S % 7 && c !== A % 7 && c !== B % 7);
  const Tn = near(4, 11, miss.length ? miss : T, t0, 0.4, A);
  const v = [S, A, Tn, B];
  // Three more parts fill the chord: the bass an octave up, one in the middle, one high.
  for (const goal of [B + 7, 10, 16]) {
    let best = -1;
    let bs = 1e9;
    for (let d = 0; d < NP; d++) {
      const s = abs(d - goal) + rnd() * 0.5;
      if (T.indexOf(d % 7) >= 0 && v.indexOf(d) < 0 && s < bs) (bs = s), (best = d);
    }
    v.push(best);
  }
  P.prev = v;
  return { v, dur: last ? 2 : 1, last, pass: [-1, -1, -1, -1], at: 0 };
}

// A part moving a third walks through the note between on the half beat.
function passing(c, nx) {
  if (c.last) return;
  for (let k = 0; k < 4; k++) if (abs(nx.v[k] - c.v[k]) === 2 && rnd() < (k ? 0.4 : 0.6)) c.pass[k] = (c.v[k] + nx.v[k]) / 2;
}

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const P = (params.s = {
    A: F32(N * 3), F: F32(N * 3), day: F32(N), cL: F32(N), cR: F32(N), lamp: F32(N),
    amp: F32(NP), tgt: F32(NP), on: F32(NP), chiff: F32(NP), keys: F32(NP),
    t: 0, beat: 0, fullT: 99, full: 0, fl: 1, fr: 1, s: 0, tr: 0,
    ph1: rnd() * 6.28, ph2: rnd() * 6.28, ph: PHRASES[0], pi: 0, prev: [14, 11, 7, 0, 7, 9, 16],
  });
  build(P);
  P.cur = chord(P);
  P.nx = chord(P);
  passing(P.cur, P.nx);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const s = (P.s = cl(k[0], 0, 1));
  const tempo = cl(k[1], 0.2, 3);
  const nv = cl(round(k[2]), 1, 6);
  const tr = (P.tr = cl(k[3], 0, 1));
  const t = (P.t += d);
  P.beat += (d * tempo) / 2;
  while (P.beat >= P.cur.at + P.cur.dur) {
    const at = P.cur.at + P.cur.dur;
    P.cur = P.nx;
    P.cur.at = at;
    P.nx = chord(P);
    passing(P.cur, P.nx);
  }
  if (input.btnPressed && input.btnPressed[0]) P.fullT = 0;
  P.fullT += d;
  P.full = P.fullT < 2.8 ? sm(0, 0.06, P.fullT) : 1 - sm(2.8, 3.6, P.fullT);

  // Which pipes speak: each part's note, the octave above from the
  // principals on, and with the reeds the octave below, the twelfth and the
  // fifteenth.
  const c = P.cur, pos = P.beat - c.at, r4 = 0.8 * sm(0.3, 0.55, s), r2 = 0.75 * sm(0.7, 0.92, s);
  P.tgt.fill(0);
  P.keys.fill(0);
  if (!(c.last && pos > c.dur - 0.22))
    for (let n = 0; n <= nv; n++) {
      const v = VORD[n], g = v < 4 && c.pass[v] >= 0 && pos >= c.dur / 2 ? c.pass[v] : c.v[v];
      if (g < 0) continue;
      P.tgt[g] = 1;
      if (v !== 3) P.keys[g] = 1;
      if (g + 7 < NP) P.tgt[g + 7] = max(P.tgt[g + 7], r4);
      if (g >= 7) P.tgt[g - 7] = max(P.tgt[g - 7], r2);
      if (g + 11 < NP) P.tgt[g + 11] = max(P.tgt[g + 11], r2);
      if (g + 14 < NP) P.tgt[g + 14] = max(P.tgt[g + 14], r2);
    }
  for (let i = 0; i < NP; i++) {
    const g = max(P.tgt[i], 0.9 * P.full);
    if (g > 0.5 && P.on[i] < 0.5) P.chiff[i] = 1;
    P.on[i] = g;
    P.amp[i] += (g - P.amp[i]) * (1 - exp(-d / (g > P.amp[i] ? 0.035 : 0.14)));
    P.chiff[i] *= exp(-d / 0.18);
  }
  // Candles in the draught: as the tremulant shakes the wind they flicker
  // harder and burn lower.
  const fa = 0.05 + tr;
  const fl = (ph) => 1 - 0.4 * fa + fa * (0.6 * sin(t * 7.1 + ph) + 0.45 * sin(t * 11.9 + 2 * ph) + 0.35 * sin(t * 4.3 + 3 * ph) * sin(t * 17.3));
  P.fl = cl(fl(0), 0.1, 2);
  P.fr = cl(fl(2.1), 0.1, 2);
}

// A stop's colour, u from the mouth (0) to the top (1).
function stopCol(out, s, u, full) {
  for (let n = 0; n < 3; n++) {
    const v = s < 0.5 ? mix(FLUTE[n], PRIN[n], s * 2) : mix(PRIN[n], mix(REED0[n], REED1[n], min(1, u * 1.6)), s * 2 - 1);
    out[n] = mix(v, FULL[n], full);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { A, F, day, cL, cR, lamp, t } = P;
  // The case in daylight, candlelight and lamplight.
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const dl = day[i], cn = cL[i] * P.fl + cR[i] * P.fr, lp = lamp[i];
    for (let n = 0; n < 3; n++) F[o + n] = A[o + n] * (DAY[n] * dl + CAN[n] * cn + LAMP[n] * lp);
  }
  // The rose window's light, cast long and slow across the case.
  const px = 32 + 17 * sin(t * 0.05 + P.ph1), py = 60 + 34 * sin(t * 0.031 + P.ph2), RX = 15, RY = 24;
  const I0 = 0.65 * (0.8 + 0.2 * sin(t * 0.23 + P.ph1));
  for (let y = max(0, floor(py - RY)); y <= min(H - 1, py + RY); y++)
    for (let x = max(0, floor(px - RX)); x <= min(W - 1, px + RX); x++) {
      const dx = (x + 0.5 - px) / RX, dy = (y + 0.5 - py) / RY, r = sqrt(dx * dx + dy * dy);
      if (r >= 1) continue;
      const a = atan2(dy, dx) / (2 * PI) + 0.5;
      let c, lead;
      if (r < 0.2) (c = AMBER), (lead = r > 0.15);
      else if (r < 0.5) {
        const q = a * 8;
        (c = floor(q) & 1 ? RUBY : SAPH), (lead = q - floor(q) < 0.1 || r < 0.24);
      } else {
        const q = a * 16;
        (c = ROSE[floor(q) & 3]), (lead = q - floor(q) < 0.08 || r < 0.54);
      }
      const kk = I0 * (lead ? 0.45 : 1) * sm(1, 0.82, r), o = (y * W + x) * 3;
      for (let n = 0; n < 3; n++) F[o + n] += A[o + n] * c[n] * kk;
    }
  // The pipes that speak: the mouth lights and a standing wave shimmers up
  // the body, its bands creeping upward and wavering with the tremulant.
  const s = P.s, tr = P.tr, gain = 240 * (0.8 + 0.4 * s), bands = 2 + 4 * s, floor0 = 0.45 - 0.25 * s;
  // Many pipes at once light the case less each, or the chord drowns in its own light.
  let ns = 0;
  for (let i = 0; i < NP; i++) ns += P.amp[i];
  const spread = (1 - 0.6 * P.full) / (1 + 0.12 * max(0, ns - 2));
  const trem = sin(2 * PI * 5.4 * t), tm = 1 - 0.9 * tr * (0.5 + 0.5 * trem), wob = 0.3 * tr * trem;
  const col = [0, 0, 0];
  for (let i = 0; i < NP; i++) {
    const am = P.amp[i];
    if (am < 0.004) continue;
    const { x, w, top, m, mh, base } = PIPES[i];
    const a = am * gain * tm, span = m - top, osc = 0.7 + 0.3 * cos(t * (5 + 0.6 * i) + i * 1.7);
    const bm = max(bands, 5 * P.full), creep = 0.3 * t + i * 0.37;
    // Its light on the polished tin and the gilt round it.
    stopCol(col, s, 0.4, P.full);
    const kb = am * tm * (0.22 + 0.5 * s) * spread * 255;
    for (let y = max(0, top - 10); y < min(H, base + 6); y++) {
      const ly = kb * (y < top ? exp((y - top) / 4) : y > m ? exp((m - y) / 7) : 1);
      for (let xx = max(0, x - 16); xx < min(W, x + w + 16); xx++) {
        const dd = xx < x ? x - xx : xx >= x + w ? xx - x - w + 1 : 0, lb = ly / (1 + dd * dd * 0.05), o = (y * W + xx) * 3;
        for (let n = 0; n < 3; n++) F[o + n] += A[o + n] * col[n] * lb;
      }
    }
    for (let y = top; y < m; y++) {
      const u = (m - 0.5 - y) / span;
      const bv = abs(cos(PI * (bm * u - creep + wob))) ** 2.5 * osc;
      const g = a * (0.75 + 0.25 * exp(-3 * u)) * (floor0 + (1 - floor0) * bv);
      stopCol(col, s, u, P.full);
      for (let j = -2; j < w + 2; j++) {
        const xx = x + j;
        if (xx < 0 || xx >= W) continue;
        const cr = j < 0 || j >= w ? (j === -1 || j === w ? 0.2 : 0.07) : 0.6 + 0.4 * sin((PI * (j + 0.5)) / w);
        const o = (y * W + xx) * 3;
        for (let n = 0; n < 3; n++) F[o + n] += col[n] * g * cr;
      }
    }
    // The mouth: hot in the slot, flaring as the pipe speaks, and a glow round it.
    stopCol(col, s, 0, P.full);
    const cx = x + w / 2, cy = m + mh / 2, hot = a * (0.8 + 1.1 * P.chiff[i]);
    for (let y = m - 4; y <= m + mh + 4; y++)
      for (let xx = x - 3; xx < x + w + 3; xx++) {
        if (xx < 0 || xx >= W) continue;
        const e = ((xx + 0.5 - cx) / (w / 2 + 1.2)) ** 2 + ((y + 0.5 - cy) / 2.6) ** 2;
        if (e > 3) continue;
        const slot = y >= m && y < m + mh && xx > x && xx < x + w - 1;
        const o = (y * W + xx) * 3, k = slot ? hot * 2 : hot * 0.5 * exp(-e * 1.3);
        for (let n = 0; n < 3; n++) F[o + n] += mix(col[n], 1, slot ? 0.7 : 0.2) * k;
      }
  }
  // The candle flames, each with a halo in the air round it.
  for (const [x, f] of [[10, P.fl], [53, P.fr]]) {
    for (let y = 92; y <= 100; y++)
      for (let xx = x - 3; xx <= x + 3; xx++) {
        const e = (xx - x) ** 2 + ((y - 96.5) * 0.8) ** 2, o = (y * W + xx) * 3;
        for (let n = 0; n < 3; n++) F[o + n] += CAN[n] * 0.45 * f * exp(-e / 3);
      }
    for (const [y, c, k] of [[97, [255, 250, 225], 1], [96, [255, 236, 160], min(1, f)], [95, [255, 190, 80], cl(f, 0, 1)], [94, [255, 120, 30], cl(f - 0.8, 0, 1)]]) {
      const o = (y * W + x) * 3;
      for (let n = 0; n < 3; n++) F[o + n] = max(F[o + n], c[n] * k);
    }
  }
  // Keys held down on the manual.
  for (let i = 0; i < NP; i++)
    if (P.keys[i] > 0)
      for (let y = 121; y <= 125; y++)
        for (let x = 3 * (i + 1); x < 3 * (i + 1) + 2; x++) {
          const o = (y * W + x) * 3;
          for (let n = 0; n < 3; n++) F[o + n] *= y === 125 ? 0.35 : 0.6;
        }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, knee(F[o]), knee(F[o + 1]), knee(F[o + 2]));
}

// Light past 180 rolls off towards 255, so a speaking pipe keeps its colour.
function knee(v) {
  return (v < 180 ? v : 255 - 75 * exp(-(v - 180) / 75)) | 0;
}
