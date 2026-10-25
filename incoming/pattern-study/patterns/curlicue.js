// ===== Patternflow pattern =====
// Title:   Curlicue
// Family:  number
// Idea:    The partial sums of the theta sum over -N <= n <= N, one unit step per n with step n turned by pi n^2 x, grow out from the middle of the panel in both directions into a lace of separate LEDs while the view zooms out for ever, and every level of the zoom brings the same curls back, because N steps of x trace the shape of N x steps of -1/x, turned 45 degrees and drawn 1/sqrt(x) times larger.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: curlicues and their renormalisation (Michael Berry and Jonathan Goldberg, 1988), approximate functional equation of the theta sum (G. H. Hardy and J. E. Littlewood, 1914), pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Number=0..1, Steps=0..1
//
// Knob 1: Hue. Turns the colours of the path round the wheel. At 0 the oldest steps, in the middle, are deep blue, turning to cyan toward the two ends, where the newest steps are white; at 0.5 the old steps are yellow and the new ones red.
// Knob 2: Speed. How fast the view zooms out. At 2 the picture shrinks to half its size every 4 seconds while the two ends add steps to keep the panel filled, and the first growth from one step to the full lace takes 1.2 seconds; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Number. Which x the sum is for, in five steps: at 0 the square root of 3, at 0.25 the golden ratio, at 0.5 the square root of 2, at 0.75 sqrt 26 - 5 = 1/(10 + 1/(10 + ...)), at 1 sqrt 101 - 10 = 1/(20 + 1/(20 + ...)). The first three grow a lace with hooked arms; the last two sit close to 1/10 and 1/20, so their paths run straight between curls and the curls read as Euler spirals. Each chain of renormalised numbers comes round after one or two levels, so the zoom never ends and never changes its kind.
// Knob 4: Steps. How many steps each half of the path holds when a level begins. At 0.06 about 2,000, so the path is a lace of single LEDs; at 1 about 120, each step a dotted stroke several LEDs long, so the curls read as lines.

const W = 64, H = 128;
const { floor, round, sqrt, sin, cos, log, exp, atan2, hypot, min, max, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The box the path is fitted into, and the most LEDs one step may span.
const BW = 62, BH = 126, SMAX = 9;
// Story seconds at Speed 2: the size halves every ZOOM seconds; the first
// growth from 1 step to the level's start takes INTRO seconds.
const ZOOM = 4, INTRO = 1.2;
// Most partial sums a level may hold.
const CAP = 100000;

// The five numbers on the knob, each a quadratic irrational, so its chain
// of renormalised numbers comes round again after one or two levels:
// the square root of 3 (2 - sqrt 3 = 0.268, which renormalises to itself),
// the golden ratio (0.382 and 0.618 in turn), the square root of 2 (0.586
// and 0.293), sqrt 26 - 5 = 1/(10 + 1/(10 + ...)) and sqrt 101 - 10 =
// 1/(20 + 1/(20 + ...)), each its own mirror image one level down. The last
// two sit close to 1/10 and 1/20, so their paths run straight for a while
// between curls.
const STOPS = [sqrt(3), (1 + sqrt(5)) / 2, sqrt(2), sqrt(26) - 5, sqrt(101) - 10];
const mod2 = (v) => v - 2 * floor(v / 2);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), u = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? u : p, i === 1 || i === 2 ? v : i === 0 ? u : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? u : i === 5 ? q : p];
}
// Colour bands by age, from the middle out; the last one is the white ends.
const BANDS = 10;

// Start the chain at the knob's number: x mod 2, folded into (0, 1]. A
// number above 1 is drawn as the mirror image of 2 - x, the same sum conjugated.
function begin(S, num) {
  let x = mod2(STOPS[round(num * 4)]);
  S.mirror = x > 1;
  if (S.mirror) x = 2 - x;
  S.xh = x;
  S.orbit = [x];
  S.filled = 0;
  S.num = num;
}

// The partial sums S_k = sum of e^(i pi n^2 x) over 0 <= n < k, added as the
// ends reach them. The path over -N..N is S_k - 1/2 and its negative.
function fill(S, n) {
  const re = S.re, im = S.im, x = S.xh;
  n = min(n, CAP);
  if (!S.filled) (re[0] = 0), (im[0] = 0);
  let a = re[S.filled], b = im[S.filled];
  for (let k = S.filled; k < n; k++) {
    const ph = PI * ((k * k * x) % 2);
    a += cos(ph);
    b += sin(ph);
    re[k + 1] = a;
    im[k + 1] = b;
  }
  S.filled = max(S.filled, n);
}

// One level deeper. Hardy and Littlewood: for 0 < x <= 1,
//   S_n(x) = e^(i pi/4) x^(-1/2) S_(floor(n x) + 1)(-1/x) + O(x^(-1/2)),
// and -1/x mod 2 folds into (0, 1] as y or as the mirror of 2 - y. So the n
// steps on the panel are swapped for floor(n x) + 1 steps of the new number,
// and the view is carried through the same turn and scale, so nothing moves.
function deeper(S) {
  const x = S.xh, N = S.N;
  let y = mod2(-1 / x), flip = false;
  if (y > 1) (y = 2 - y), (flip = true);
  // A number that has come round before is set back to its first value, so
  // rounding does not build up level after level and the chain repeats exactly.
  for (const o of S.orbit) if (abs(y - o) < 1e-9) y = o;
  if (!S.orbit.includes(y)) S.orbit.push(y);
  const oldRe = S.re, oldIm = S.im, n0 = min(floor(N), S.filled);
  S.re = S.re2;
  S.im = S.im2;
  S.re2 = oldRe;
  S.im2 = oldIm;
  S.xh = y;
  S.filled = 0;
  fill(S, floor(N * x) + 2);
  // The check: how far the old half path lies from the new one carried
  // through the similarity, after the mean offset, against the path's size.
  const ar = cos(PI / 4) / sqrt(x), ai = sin(PI / 4) / sqrt(x), sg = flip ? -1 : 1, stride = max(1, floor(n0 / 1500));
  let dr = 0, di = 0, c = 0, gap = 0, size = 1;
  for (let pass = 0; pass < 2; pass++)
    for (let n = 1; n <= n0; n += stride) {
      const m = floor(n * x) + 1, qr = S.re[m] - 0.5, qi = sg * S.im[m];
      const u = oldRe[n] - 0.5 - (ar * qr - ai * qi), v = oldIm[n] - (ai * qr + ar * qi);
      if (pass === 0) (dr += u), (di += v), c++;
      else (gap = max(gap, hypot(u - dr, v - di))), (size = max(size, hypot(oldRe[n] - 0.5, oldIm[n])));
      if (pass === 0 && n + stride > n0) (dr /= c), (di /= c);
    }
  S.gap = max(S.gap, gap / size);
  S.offset = max(S.offset, hypot(dr, di));
  S.levels++;
  // Carry the view: screen = alpha w + centre, w the half path or its mirror.
  const Ai = S.mirror ? -ai : ai;
  for (const v of [S.view, S.goal]) [v.ar, v.ai] = [v.ar * ar - v.ai * Ai, v.ar * Ai + v.ai * ar];
  S.mirror = S.mirror !== flip;
  S.N = N * x;
  S.L = log(S.N);
}

// Where the view wants to be: the long axis upright, the whole path in the
// box. The path is symmetric about the middle of step 0, so that point is
// always the middle of the panel and a half turn changes nothing.
function aim(S) {
  const n = min(floor(S.N), S.filled), re = S.re, im = S.im, sg = S.mirror ? -1 : 1, G = S.goal;
  const stride = max(1, floor(n / 3000));
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 1; i <= n; i += stride) {
    const u = re[i] - 0.5, v = sg * im[i];
    sxx += u * u;
    syy += v * v;
    sxy += u * v;
  }
  let ang = atan2(G.ai, G.ar);
  const spread = sxx + syy, aniso = spread > 0 ? hypot(sxx - syy, 2 * sxy) / spread : 0;
  if (aniso > 0.12 || n < 40) {
    const a = PI / 2 - 0.5 * atan2(2 * sxy, sxx - syy), da = a - ang;
    ang += da - PI * round(da / PI);
  }
  const ca = cos(ang), sa = sin(ang);
  let mu = 1e-6, mv = 1e-6;
  for (let i = 1; i <= n; i++) {
    const u = re[i] - 0.5, v = sg * im[i];
    mu = max(mu, abs(ca * u - sa * v));
    mv = max(mv, abs(sa * u + ca * v));
  }
  const s = min(BW / (2 * mu), BH / (2 * mv), SMAX);
  G.ar = s * ca;
  G.ai = s * sa;
}

export function setup(params) {
  const S = {
    re: new Float64Array(CAP + 2), im: new Float64Array(CAP + 2), re2: new Float64Array(CAP + 2), im2: new Float64Array(CAP + 2),
    view: { ar: SMAX - 0.5, ai: 0.5 }, goal: { ar: SMAX - 0.5, ai: 0.5 },
    hue: 0.5, speed: 1.5, n1: 2000.5, N: 1, L: 0, levels: 0, gap: 0, offset: 0, xh: 0.5, num: 0.5, mirror: false, filled: 0, orbit: [],
    pal: new Uint8Array((BANDS + 2) * 3), idx: new Uint8Array(W * H), palHue: -1,
  };
  begin(S, 0);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  // 2,400 steps a half at 0, about 2,000 at 0.06, 120 at 1.
  S.n1 = 2400 * 0.05 ** cl(k[3], 0, 1);
  const num = cl(k[2], 0, 1);
  // A new number: the same number of steps of it, from its first level.
  if (abs(num - S.num) > 1e-9) begin(S, num);
  // Below the level's start the path grows fast, from 1 step to n1 in
  // INTRO seconds; from there the zoom runs at its steady pace.
  const g = (d * S.speed) / 2, ln1 = log(S.n1);
  S.L = S.L < ln1 ? min(ln1, S.L + (g * ln1) / INTRO) : S.L + (g * 2 * Math.LN2) / ZOOM;
  S.N = exp(S.L);
  // A chain that has not come round in 16 levels starts over.
  if (S.orbit.length > 16) begin(S, S.num);
  for (let guard = 0; guard < 8 && S.N >= min(S.n1 / S.xh, CAP); guard++) deeper(S);
  fill(S, floor(S.N) + 1);
  aim(S);
  // Ease the view toward its aim in angle and size; shrink fast, so the
  // ends never leave the box, and grow slowly.
  const V = S.view, G = S.goal;
  const la = log(hypot(V.ar, V.ai)), lg = log(hypot(G.ar, G.ai)), es = 1 - exp(-d / (lg < la ? 0.05 : 0.5));
  const aa = atan2(V.ai, V.ar), ag = atan2(G.ai, G.ar), da = ag - aa, ea = 1 - exp(-d / 0.6);
  const a = aa + (da - PI * round(da / PI)) * ea, ca = cos(a), sa = sin(a);
  // While the angle is still turning, the size the aim chose may not fit
  // the angle the view stands at: shrink to fit that too.
  const n = min(floor(S.N), S.filled), sg = S.mirror ? -1 : 1;
  let mu = 1e-6, mv = 1e-6;
  for (let i = 1; i <= n; i++) {
    const u = S.re[i] - 0.5, v = sg * S.im[i];
    mu = max(mu, abs(ca * u - sa * v));
    mv = max(mv, abs(sa * u + ca * v));
  }
  const r = min(exp(la + (lg - la) * es), BW / (2 * mu), BH / (2 * mv));
  V.ar = r * ca;
  V.ai = r * sa;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const pal = S.pal, idx = S.idx;
  if (S.palHue !== S.hue) {
    S.palHue = S.hue;
    // Deep blue for the oldest steps, turning to cyan for the newest. Every
    // colour has a channel at 255, so the old blue reads dim on the panel
    // while each LED of the lace stands at full level.
    for (let b = 0; b < BANDS; b++) {
      const q = b / (BANDS - 1), c = hsv(0.66 - 0.18 * q + S.hue, 1 - 0.25 * q, 1);
      for (let j = 0; j < 3; j++) pal[(b + 1) * 3 + j] = round(255 * c[j]);
    }
    for (let j = 0; j < 3; j++) pal[(BANDS + 1) * 3 + j] = 255;
  }
  idx.fill(0);
  const n = min(floor(S.N), S.filled), re = S.re, im = S.im, sg = S.mirror ? -1 : 1;
  const ar = S.view.ar, ai = S.view.ai, step = hypot(ar, ai), head = n - max(2, floor(n * 0.012));
  const put = (X, Y, c) => {
    // The nearest LED of one checkerboard colour, so lit LEDs never touch
    // side to side and each step stands as its own point.
    const a = round((X + Y - 1) / 2), b = round((X - Y) / 2), u = a + b, v = a - b;
    if (u >= 0 && u < W && v >= 0 && v < H) idx[v * W + u] = c;
    // The newer half of the path is drawn with a nib two LEDs long on the
    // diagonal, so the young curls stand bolder than the old lace inside.
    if (c > BANDS / 2 && u + 1 < W && v + 1 < H && u >= -1 && v >= -1) idx[(v + 1) * W + u + 1] = c;
  };
  let px = -ar * 0.5, py = -ai * 0.5;
  for (let i = 1; i <= n; i++) {
    const u = re[i] - 0.5, v = sg * im[i], X = ar * u - ai * v, Y = ai * u + ar * v;
    const c = i > head ? BANDS + 1 : 1 + floor((i / (n + 1)) * BANDS);
    // Long steps, while the path is young or the Steps knob is high, are
    // drawn as dotted strokes.
    if (step > 1.6) {
      const k = Math.ceil(step / 0.8);
      for (let j = 1; j < k; j++) {
        const sx = px + ((X - px) * j) / k, sy = py + ((Y - py) * j) / k;
        put(32 + sx, 64 + sy, c);
        put(32 - sx, 64 - sy, c);
      }
    }
    put(32 + X, 64 + Y, c);
    put(32 - X, 64 - Y, c);
    px = X;
    py = Y;
  }
  for (let i = 0; i < W * H; i++) {
    const o = idx[i] * 3;
    display.setPixel(i % W, floor(i / W), pal[o], pal[o + 1], pal[o + 2]);
  }
}
