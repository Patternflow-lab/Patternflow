// ===== Patternflow pattern =====
// Title:   Lévy Dust
// Family:  fractal
// Idea:    A Lévy flight jumps from landing to landing, each jump in a uniform random direction with a length whose chance of passing l falls as l to the power -alpha, three thousand landings a second that fade over half a minute, and the panel shows the dust they leave three times over, the whole flight in the top third, a window a quarter as wide round a typical landing in the middle third and a quarter as wide again in the bottom third, each window framed in the tier above, so the clusters within clusters and the long empty jumps between them look alike at 1x, 4x and 16x while each long jump flashes as a white streak.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lévy flights and the stable laws (Paul Lévy, 1937); Lévy dust, the landing points of a Rayleigh-Lévy flight, of dimension alpha (Benoit Mandelbrot, 1977; The Fractal Geometry of Nature, 1982); the truncated Lévy flight (Rosario Mantegna and H. Eugene Stanley, 1994); pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tail=-1..1, Cut=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a landing is cyan, blue or violet by when it landed, the hue swinging from cyan to violet and back every 66,000 landings (22 s at Speed 2), and the newest few hundred are near white; the frame in the top tier and the dotted line under it are pale gold, the frame in the middle tier and its line pale green. At 0.5 the dust runs from red through orange and yellow to green inside blue and violet frames.
// Knob 2: Speed. Landings a second, 1500 times the knob: 3000 at 2, 300 at 0.2, 4500 at 3. A landing dims by a factor e every 30,000 landings after it, 10 s at 2, and goes dark after 105,000, 35 s at 2 and 350 s at 0.2. At every speed the middle tier picks a new window every 3.2 s and the bottom tier every 1.6 s.
// Knob 3: Tail. Sets alpha = 1.5 - 0.5 x Tail, the exponent of the jump law and the dimension of the dust. At the opening 0 alpha is 1.5: the top tier spans about 75 shortest jumps an LED (38 to 181 over 20 s) and the bottom tier about 4.7, and about 2 jumps a second leave a streak. At 1 alpha is 1 and the long jumps rule: the top tier spans about 360 an LED, the clusters sit far apart and 7 streaks flash a second. At -1 alpha is 2, where the flight falls back towards Brownian motion: the top tier spans 18 an LED, the dust closes into a smudge, and the bottom tier at about 1.1 an LED shows single jumps, where the self-similarity stops.
// Knob 4: Cut. The longest jump, cut off sharply as in Mantegna and Stanley's truncated flight: 3000 x 60^-Cut shortest jumps, 2350 at the opening 0.06, 390 at 0.5 and 50 at 1. Above the cut the flight adds up like a Brownian walk, so a tier much wider than the cut stops looking like the tiers below it: at 1 the top tier spans about 2,000 (32 an LED) and shows a cloud of small clusters, the middle tier about 500 and the bottom tier 130, near the cut, where the grain of single jumps shows. A new Tail or Cut acts on new landings, so the old dust takes about 35 s to turn over at Speed 2.

const W = 64, TH = 42, RING = 131072, ZOOM = 4, DWELL = 1.6, LIFE = 30000;
const WW = 16, WH = 10.5; // a deeper tier's window in the tier above, in LEDs: 64 / 4 by 42 / 4
const TOP = [0, 43, 86]; // tiers on rows 0..41, 43..84, 86..127; dotted lines on 42 and 85
const HUES = 32, AGES = 16;
const { floor, round, min, max, abs, exp, log, cos, sin, hypot, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = c[0];
  out[o + 1] = c[1];
  out[o + 2] = c[2];
}

export function setup(params) {
  params.s = {
    px: new Float64Array(RING), py: new Float64Array(RING), n: 0, hx: 0, hy: 0,
    alpha: 1.5, speed: 2, hue: 0, cut: 3000, acc: 0, t: 0, dt: 0, lutHue: NaN,
    // view[T] = [cx, cy, world units per LED]; tiers 1 and 2 glide to aim[T].
    view: [[0, 0, 1], [0, 0, 1], [0, 0, 1]], aim: [[0, 0], [0, 0], [0, 0]], clock: 0,
    fit: [0, 0, 1], fitTimer: 0, fresh: true, gain: [0, 0, 0],
    acc4: new Float32Array(W * 128 * 4), lut: new Float32Array(HUES * AGES * 3), streaks: [],
  };
  return params.s;
}

// One landing: a Pareto length, P(L > l) = l^-alpha for 1 <= l, cut off at
// S.cut and drawn by inverting that law, in a uniform direction. This is
// Mandelbrot's Rayleigh-Lévy flight, and for alpha below 2 its landings make
// a dust of dimension alpha. Measured on 40,000 landings at the opening cut,
// the share of pairs closer than r grows as r^1.22 to r^1.25 at alpha 1.25,
// r^1.39 to r^1.44 at 1.5 and r^1.55 to r^1.62 at 1.75 for r from 8 to 64:
// the correlation dimension sits at alpha or a little under it.
function jump(S) {
  const L = (1 - random() * (1 - S.cut ** -S.alpha)) ** (-1 / S.alpha);
  const a = random() * 2 * PI;
  S.hx += L * cos(a);
  S.hy += L * sin(a);
  const i = S.n % RING;
  S.px[i] = S.hx;
  S.py[i] = S.hy;
  S.n++;
  return L;
}

// A landing's weight by how many landings came after it. It is dropped below
// 0.03, 105,000 landings on, well inside the ring of 131,072.
const weight = (S, age) => exp(-age / LIFE);

// Tier 0 holds the whole dust: centred on the weighted median, and wide
// enough that 85% of the weight lies inside. Every fourth landing is enough.
function fitTop(S) {
  const n = min(S.n, RING), xs = [], ys = [], rs = [];
  let tot = 0;
  for (let a = 0; a < n; a += 4) {
    const w = weight(S, a);
    if (w < 0.03) break;
    const i = (S.n - 1 - a) % RING;
    xs.push([S.px[i], w, S.py[i]]);
    ys.push([S.py[i], w]);
    tot += w;
  }
  const quant = (arr, q) => {
    arr.sort((p, r) => p[0] - r[0]);
    let c = 0;
    for (const e of arr) if ((c += e[1]) >= tot * q) return e[0];
    return arr[arr.length - 1][0];
  };
  const cy = quant(ys, 0.5), cx = quant(xs, 0.5);
  for (const [x, w, y] of xs) rs.push([max(abs(x - cx) / 31, abs(y - cy) / 20), w]);
  S.fit = [cx, cy, max(0.05, quant(rs, 0.85) * 1.05)];
}

// A landing picked at random by weight from those that put a window of a
// deeper tier wholly inside tier T: a typical point of the dust there, so
// the window shows what a typical cluster holds rather than the densest.
function pick(S, T) {
  const v = S.view[T], mx = (W / 2 - WW / 2) * v[2], my = (TH / 2 - WH / 2) * v[2];
  const n = min(S.n, RING);
  let tot = 0, got = -1;
  for (let a = 0; a < n; a++) {
    const w = weight(S, a);
    if (w < 0.03) break;
    const i = (S.n - 1 - a) % RING;
    if (abs(S.px[i] - v[0]) > mx || abs(S.py[i] - v[1]) > my) continue;
    tot += w;
    if (random() * tot < w) got = i;
  }
  return got < 0 ? [v[0], v[1]] : [S.px[got], S.py[got]];
}

// Where a deeper tier's window sits in the tier above, in that tier's LEDs.
const inParent = (S, T) => [(S.view[T][0] - S.view[T - 1][0]) / S.view[T - 1][2] + W / 2, (S.view[T][1] - S.view[T - 1][1]) / S.view[T - 1][2] + TH / 2];
// Whether the window a deeper tier is gliding to has left the window the
// tier above is gliding to, which tier 0's own drift can do.
const outside = (S, T) => {
  const p = T === 1 ? S.view[0] : S.aim[1], s = S.view[T - 1][2];
  const x = (S.aim[T][0] - p[0]) / s, y = (S.aim[T][1] - p[1]) / s;
  return abs(x) > W / 2 - WW / 2 + 1.5 || abs(y) > TH / 2 - WH / 2 + 1.5;
};

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.dt = d;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.alpha = 1.5 - 0.5 * cl(k[2], -1, 1);
  S.cut = 3000 * 60 ** -cl(k[3], 0, 1);
  S.t += d;
  // The first frame opens on a dust already 3.5 lifetimes deep.
  if (S.n === 0) {
    for (let i = 0; i < min(RING - 1, 3.5 * LIFE); i++) jump(S);
    fitTop(S);
    S.view[0] = S.fit.slice();
  }
  S.acc += d * 1500 * S.speed;
  while (S.acc >= 1) {
    S.acc--;
    const x0 = S.hx, y0 = S.hy, L = jump(S);
    if (L > 1.5 * S.view[0][2]) S.streaks.push([x0, y0, S.hx, S.hy, S.t]);
  }
  while (S.streaks.length && (S.streaks.length > 32 || S.t - S.streaks[0][4] > 0.6)) S.streaks.shift();
  // The flight never ends, so now and then everything shifts back near 0.
  if (abs(S.hx) + abs(S.hy) > 1e9) {
    const ox = S.hx, oy = S.hy;
    for (let i = 0; i < RING; i++) (S.px[i] -= ox), (S.py[i] -= oy);
    for (const v of S.view) (v[0] -= ox), (v[1] -= oy);
    for (const a of S.aim) (a[0] -= ox), (a[1] -= oy);
    for (const s of S.streaks) (s[0] -= ox), (s[1] -= oy), (s[2] -= ox), (s[3] -= oy);
    S.fit[0] -= ox;
    S.fit[1] -= oy;
    S.hx = S.hy = 0;
  }
  S.fitTimer -= d;
  if (S.fitTimer <= 0) (S.fitTimer = 0.25), fitTop(S);
  const v0 = S.view[0];
  if (S.fresh) (v0[0] = S.fit[0]), (v0[1] = S.fit[1]), (v0[2] = S.fit[2]);
  else {
    const a = 1 - exp(-d / 0.7), b = 1 - exp(-d / 1.2);
    v0[0] += (S.fit[0] - v0[0]) * a;
    v0[1] += (S.fit[1] - v0[1]) * a;
    v0[2] = exp(log(v0[2]) + (log(S.fit[2]) - log(v0[2])) * b);
  }
  // Tier 1 picks a new window every 2 x DWELL seconds and tier 2 picks one
  // inside it at once; halfway between, tier 2 alone picks again. Either
  // picks at once when tier 0's drift has pushed its window out.
  S.clock += d;
  const both = S.fresh || S.clock >= 2 * DWELL || outside(S, 1);
  const deep = both || (S.clock >= DWELL && S.clock - d < DWELL) || outside(S, 2);
  if (both) {
    S.clock = 0;
    S.aim[1] = pick(S, 0);
  }
  if (deep) {
    // Picked inside the window tier 1 is gliding to.
    const v1 = S.view[1], keep = [v1[0], v1[1], v1[2]];
    v1[0] = S.aim[1][0];
    v1[1] = S.aim[1][1];
    v1[2] = v0[2] / ZOOM;
    S.aim[2] = pick(S, 1);
    if (!S.fresh) (v1[0] = keep[0]), (v1[1] = keep[1]), (v1[2] = keep[2]);
  }
  const g = S.fresh ? 1 : 1 - exp(-d / 0.25);
  for (let T = 1; T < 3; T++) {
    const v = S.view[T], a = S.aim[T];
    v[0] += (a[0] - v[0]) * g;
    v[1] += (a[1] - v[1]) * g;
    v[2] = S.view[T - 1][2] / ZOOM;
  }
  S.fresh = false;
}

// Every landing still lit, added into each tier it falls in: colour times
// weight in the first three slots of an LED, weight in the fourth.
function bin(S, A) {
  const lut = S.lut;
  A.fill(0);
  const n = min(S.n, RING), P = 2.2 * LIFE;
  for (let a = 0; a < n; a++) {
    const w = weight(S, a);
    if (w < 0.03) break;
    const nb = S.n - 1 - a, i = nb % RING;
    const hq = floor((0.5 - 0.5 * cos((2 * PI * nb) / P)) * (HUES - 1) + 0.5);
    const q = (hq * AGES + min(AGES - 1, floor(Math.sqrt(a / (4 * LIFE)) * AGES))) * 3;
    for (let T = 0; T < 3; T++) {
      const v = S.view[T];
      const x = floor((S.px[i] - v[0]) / v[2] + W / 2), y = floor((S.py[i] - v[1]) / v[2] + TH / 2);
      if (x < 0 || x >= W || y < 0 || y >= TH) continue;
      const o = ((TOP[T] + y) * W + x) * 4;
      A[o] += lut[q] * w;
      A[o + 1] += lut[q + 1] * w;
      A[o + 2] += lut[q + 2] * w;
      A[o + 3] += w;
    }
  }
}

function line(A, T, x0, y0, x1, y1, f) {
  const n = max(1, Math.ceil(max(abs(x1 - x0), abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const x = round(x0 + ((x1 - x0) * i) / n), y = round(y0 + ((y1 - y0) * i) / n);
    if (x < 0 || x >= W || y < 0 || y >= TH) continue;
    const o = ((TOP[T] + y) * W + x) * 4;
    A[o] += f;
    A[o + 1] += f;
    A[o + 2] += f;
    A[o + 3] += f;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const A = S.acc4;
  if (S.lutHue !== S.hue) {
    // A landing's hue follows when it landed, swinging 0.3 round the wheel
    // and back, cyan through blue to violet at Hue 0; fresh landings are
    // whitened.
    for (let h = 0; h < HUES; h++)
      for (let a = 0; a < AGES; a++) {
        const fresh = 1 - a / (AGES - 1);
        hsv(S.hue + 0.5 + (0.3 * h) / (HUES - 1), 0.8 - 0.6 * fresh ** 8, 1, S.lut, (h * AGES + a) * 3);
      }
    S.lutHue = S.hue;
  }
  bin(S, A);
  // A long jump leaves a white streak for 0.6 s.
  for (const [x0, y0, x1, y1, t] of S.streaks) {
    const f = 0.6 * (1 - (S.t - t) / 0.6);
    if (f <= 0) continue;
    for (let T = 0; T < 3; T++) {
      const v = S.view[T];
      if (hypot(x1 - x0, y1 - y0) / v[2] < 6) continue;
      line(A, T, (x0 - v[0]) / v[2] + W / 2, (y0 - v[1]) / v[2] + TH / 2, (x1 - v[0]) / v[2] + W / 2, (y1 - v[1]) / v[2] + TH / 2, f);
    }
  }
  // Each tier's gain follows the mean weight of its lit LEDs, so an LED of
  // average weight shows at 70% in every tier: a window a quarter as wide
  // holds about 4^-alpha of the weight, 1/8 at alpha 1.5.
  for (let T = 0; T < 3; T++) {
    let sum = 0, cnt = 0;
    for (let p = TOP[T] * W; p < (TOP[T] + TH) * W; p++) if (A[p * 4 + 3] > 0) (sum += A[p * 4 + 3]), cnt++;
    const g = 1.2 / max(0.05, sum / max(1, cnt));
    S.gain[T] = S.gain[T] > 0 ? exp(log(S.gain[T]) + (log(g) - log(S.gain[T])) * (1 - exp(-S.dt / 0.4))) : g;
  }
  for (let T = 0; T < 3; T++)
    for (let y = 0; y < TH; y++)
      for (let x = 0; x < W; x++) {
        const o = ((TOP[T] + y) * W + x) * 4, wt = A[o + 3];
        if (wt <= 0) {
          display.setPixel(x, TOP[T] + y, 0, 0, 0);
          continue;
        }
        const f = (255 * (1 - exp(-S.gain[T] * wt))) / wt;
        display.setPixel(x, TOP[T] + y, A[o] * f, A[o + 1] * f, A[o + 2] * f);
      }
  // The newest landing, white, in every tier it falls in.
  for (let T = 0; T < 3; T++) {
    const v = S.view[T], x = floor((S.hx - v[0]) / v[2] + W / 2), y = floor((S.hy - v[1]) / v[2] + TH / 2);
    if (x >= 0 && x < W && y >= 0 && y < TH) display.setPixel(x, TOP[T] + y, 255, 255, 255);
  }
  // The frames: in tier 0 where tier 1 looks, in tier 1 where tier 2 looks,
  // each in the colour of the dotted line above the tier it shows.
  const fc = [[], []];
  hsv(S.hue + 0.13, 0.55, 0.85, fc[0], 0);
  hsv(S.hue + 0.33, 0.55, 0.85, fc[1], 0);
  for (let T = 0; T < 2; T++) {
    const col = fc[T], [ux, uy] = inParent(S, T + 1);
    const x0 = round(ux - WW / 2) - 1, x1 = round(ux + WW / 2), y0 = round(uy - WH / 2) - 1, y1 = round(uy + WH / 2);
    const put = (x, y) => {
      if (x >= 0 && x < W && y >= 0 && y < TH) display.setPixel(x, TOP[T] + y, col[0] * 255, col[1] * 255, col[2] * 255);
    };
    for (let x = x0; x <= x1; x++) put(x, y0), put(x, y1);
    for (let y = y0 + 1; y < y1; y++) put(x0, y), put(x1, y);
    for (let x = 0; x < W; x++) {
      const on = (x & 1) === 0;
      display.setPixel(x, TOP[T + 1] - 1, on ? col[0] * 150 : 0, on ? col[1] * 150 : 0, on ? col[2] * 150 : 0);
    }
  }
}
