// ===== Patternflow pattern =====
// Title:   Eight Principles of Yong
// Family:  type
// Idea:    The character 永, eternity, stands the full height of the panel and a brush writes it in its five strokes in their standard order, and as it begins each of the eight basic strokes of regular script that the old teaching finds in it, the name of that method lights in red beside it: the dot, then the horizontal, the vertical and the hook in one stroke, the rising stroke turning into the long sweep, the short peck and the wave; the brush presses wider and lifts thinner, pauses and pools at its turns and runs dry in streaks toward the end of a long stroke, and when the character is done the eight light one after another before the ink fades and another is written.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Eight Principles of Yong (永字八法), the teaching of regular-script calligraphy that finds eight basic strokes in the one character 永, of traditional attribution (to Wang Xizhi in the 4th century, to the Sui monk Zhiyong and to others), with the eight under their old names 側 勒 努 趯 策 掠 啄 磔; the five strokes of 永 in their standard order; pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Brush=-1..1, Ink=-1..1
//
// Knob 1: Hue. Turns ink, paper and names round the wheel together: at 0 gold ink on indigo paper with the names in vermilion, at 0.25 green ink on a dark plum paper, at 0.5 blue ink on dark olive with cyan names.
// Knob 2: Speed. At 2 the character takes 6.7 s from the dot's first touch to the lift of the wave, the vertical alone about 1 s, then holds 2.3 s while the eight methods light in turn, 0.23 s each, and fades in 0.9 s, a round of 10.2 s; at 0.2 ten times slower, at 3 two thirds of that. A fresh start opens with the dot already down and the brush in the air.
// Knob 3: Brush. The brush's size: at 0 the vertical comes out about 6.5 LEDs wide and the dot 8.4 where it presses, at -1 0.55 of that (the vertical 3.6) and at 1 1.45 (the vertical 9.5, wide enough to touch the name 努 beside it).
// Knob 4: Ink. How much ink the brush carries and how fast it gives out across its 9 bristles. At the opening 0.06 a stroke starts full and the last third of the vertical, the tail of the sweep and the foot of the wave break into dry streaks; at -1 it starts with a fifth less and runs out 2.2 times faster, down to about a quarter of the bristles scratching; at 1 it hardly runs dry, the strokes swell by an eighth and the ink bleeds 3.2 LEDs into the paper over most of a second, nearly 5 where the brush rests.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// The five strokes of 永 in their order, each a run of knots the brush
// passes: x, y, brush radius in LEDs, the time to reach the knot from the
// one before and the time the brush rests there pressing down (in beats, of
// which Speed 2 plays 1.2 a second), and which of the eight methods the
// stretch belongs to: 0 側 the dot, 1 勒 the horizontal, 2 努 the vertical,
// 3 趯 the hook, 4 策 the rising stroke, 5 掠 the long sweep to the left, 6 啄
// the short peck, 7 磔 the wave to the right. The second stroke carries three
// methods and the third two, so five strokes hold all eight.
const STROKES = [
  [[25.5, 4.5, 0.6, 0, 0, 0], [27.5, 6.5, 1.8, 0.1, 0, 0], [30.5, 10, 3.0, 0.14, 0, 0], [33.5, 14, 3.9, 0.14, 0, 0], [35, 16.5, 4.2, 0.1, 0.18, 0], [33.8, 18.2, 3.4, 0.08, 0, 0], [32.5, 17.6, 2.2, 0.06, 0, 0]],
  [[14.5, 32.5, 0.7, 0, 0, 1], [16.5, 35, 2.6, 0.08, 0.1, 1], [20, 35, 2.4, 0.08, 0, 1], [26, 34, 2.3, 0.16, 0, 1], [32, 32.8, 2.3, 0.16, 0, 1], [35.5, 32.2, 2.2, 0.08, 0, 1], [37.5, 32, 2.0, 0.05, 0, 1],
    [39.5, 34.8, 3.5, 0.08, 0.22, 2], [38.6, 40, 3.4, 0.08, 0, 2], [38, 55, 3.2, 0.22, 0, 2], [37.8, 72, 3.2, 0.24, 0, 2], [38, 90, 3.3, 0.24, 0, 2], [38.3, 104, 3.4, 0.2, 0, 2],
    [38.4, 111, 3.8, 0.12, 0.25, 3], [35.5, 111.5, 3.0, 0.05, 0, 3], [31, 108, 2.0, 0.06, 0, 3], [27, 104.5, 1.0, 0.05, 0, 3], [24.5, 102.5, 0.25, 0.04, 0, 3]],
  [[4.5, 63, 0.7, 0, 0, 4], [6.5, 65.5, 2.6, 0.08, 0.1, 4], [11, 63.5, 2.2, 0.08, 0, 4], [17, 60.5, 1.9, 0.1, 0, 4], [21.5, 58.3, 1.8, 0.07, 0, 4],
    [24.5, 58.5, 2.6, 0.06, 0.18, 5], [24.6, 63, 2.9, 0.07, 0, 5], [23.6, 71, 3.0, 0.1, 0, 5], [21.5, 80, 2.8, 0.1, 0, 5], [18, 89, 2.4, 0.1, 0, 5], [13, 98, 1.9, 0.1, 0, 5], [7.5, 106, 1.2, 0.09, 0, 5], [3, 111, 0.5, 0.07, 0, 5], [1, 112.5, 0.15, 0.04, 0, 5]],
  [[57, 41, 0.8, 0, 0, 6], [56, 43.5, 2.8, 0.07, 0.08, 6], [52.5, 47, 2.6, 0.06, 0, 6], [48.5, 51, 2.0, 0.05, 0, 6], [45, 54.5, 1.2, 0.04, 0, 6], [42.5, 56.5, 0.3, 0.03, 0, 6]],
  [[42.5, 58.5, 0.6, 0, 0, 7], [44.2, 62.5, 1.3, 0.08, 0, 7], [46.6, 69, 1.9, 0.12, 0, 7], [49.2, 77, 2.6, 0.14, 0, 7], [51.6, 85, 3.3, 0.14, 0, 7], [53.8, 92, 4.0, 0.13, 0, 7], [55.6, 97, 4.5, 0.1, 0, 7], [57, 99.8, 4.7, 0.08, 0.25, 7], [59.6, 101.2, 3.4, 0.07, 0, 7], [61.6, 101.8, 2.0, 0.05, 0, 7], [63.2, 102, 0.6, 0.04, 0, 7]],
];

// The names of the eight methods, drawn for this pattern 13 LEDs square, and
// where each stands beside its stroke, as diagrams of 永 often set them.
const NAMES = [
  ["..#..........", "..#.#####...#", ".#..#...#.#.#", ".#..#####.#.#", "##..#...#.#.#", ".#..#####.#.#", ".#..#...#.#.#", ".#..#####.#.#", ".#...#.#..#.#", ".#..#...#...#", ".#.#.....#..#", ".#..........#", ".#.........##"],
  [".#.#...#.....", "#######.#....", ".#.#....#....", ".###.#######.", "...#....#...#", ".#####..#...#", ".#.#.#..#...#", ".#####..#...#", "...#...#....#", "#######.....#", "...#...#....#", "...#..#..#..#", "...#.#....##."],
  ["..#...######.", "..#...#....#.", "#######...#..", ".#..#..#.#...", ".#.#....#....", "..##...#.#...", "##..#.#...##.", ".....#.......", "############.", ".....#.....#.", "....#......#.", "..##.....#.#.", "##........#.."],
  ["..#...##.##..", "#####..#..#..", "..#...##.##..", ".###...#..#..", ".......#.##..", "#####.#.#....", "..#..#####...", ".##.#.#..#...", "..#...####...", "..##..#..#...", ".#..#.####...", ".#..#.#......", "#....########"],
  [".#.....#.....", "#####.#####..", "#....#..#....", ".............", "#############", "......#......", ".###########.", ".#....#....#.", ".#....#..###.", "......#......", "....#.#.#....", "..##..#..##..", "##....#....##"],
  [".#.....#.....", ".#..#######..", "####.........", ".#...#####...", ".#...#...#...", ".###.#...#...", "##...#####...", ".#.....#.....", ".#...#.#.#...", ".#..#..#..#..", ".#.#...#...#.", ".#.....#.....", "##....##....."],
  [".....########", ".........#...", "........#...#", "####...#...#.", "#..#..#..##..", "#..#....##...", "#..#...#.#...", "#..#..#..##..", "#..#.#..##.#.", "####...#.#..#", "......#..#..#", ".....#...#...", "........##..."],
  [".......#...#.", "#####.####.##", "..#...#..#.#.", "..#....##..##", ".#.....#...#.", ".####.#...##.", "##..#.#######", ".#..#...###..", ".#..#..#.#.#.", ".####.#..#..#", ".........#...", ".........#...", ".........#..."],
];
const SPOT = [[11, 3], [1, 17], [22, 88], [10, 114], [1, 46], [1, 72], [50, 24], [47, 110]];

// Paper: a fixed scatter of short fibres, and a grain per LED that roughens
// the edge of every stroke.
const FIB = new Float32Array(N), GRAIN = new Float32Array(N);
{
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let p = 0; p < N; p++) GRAIN[p] = rnd() * 2 - 1;
  for (let f = 0; f < 170; f++) {
    let x = rnd() * W, y = rnd() * H, a = rnd() * PI;
    const len = 3 + rnd() * 6, v = 0.3 + rnd() * 0.7;
    for (let k = 0; k < len; k++, a += (rnd() - 0.5) * 0.5) {
      x += cos(a);
      y += sin(a);
      const xi = floor(x), yi = floor(y);
      if (xi >= 0 && xi < W && yi >= 0 && yi < H) FIB[yi * W + xi] = max(FIB[yi * W + xi], v);
    }
  }
}

// Bristles across the brush, and the beats a finished character holds and
// takes to fade.
const NB = 9, HOLD = 2.8, FADE = 1.1;

// Lays the strokes out as a timeline of brush samples a third of an LED
// apart, with a little of a hand's wobble that differs from one writing to
// the next.
function build(S) {
  const xs = [], ys = [], rs = [], ts = [], ds = [], ms = [], ss = [], ks = [], txs = [], tys = [];
  const air = [];
  let t = 0, px = 46, py = -6;
  STROKES.forEach((knots, k) => {
    const P = knots.map((q) => [q[0] + (Math.random() - 0.5) * 1.0, q[1] + (Math.random() - 0.5) * 1.0, q[2] * (0.94 + Math.random() * 0.12), q[3], q[4], q[5]]);
    const dist = sqrt((P[0][0] - px) ** 2 + (P[0][1] - py) ** 2), at = 0.18 + dist / 150;
    air.push([t, t + at, px, py, P[0][0], P[0][1], P[0][2]]);
    t += at;
    let s = 0, lx = P[0][0], ly = P[0][1];
    const push = (x, y, r, tt, dw, m) => {
      s += sqrt((x - lx) ** 2 + (y - ly) ** 2);
      const dx = x - lx, dy = y - ly, L = sqrt(dx * dx + dy * dy);
      if (L > 1e-3) txs.push(dx / L), tys.push(dy / L);
      else txs.push(txs.length ? txs[txs.length - 1] : 1), tys.push(tys.length ? tys[tys.length - 1] : 0);
      xs.push(x), ys.push(y), rs.push(r), ts.push(tt), ds.push(dw), ms.push(m), ss.push(s), ks.push(k);
      lx = x;
      ly = y;
    };
    push(P[0][0], P[0][1], P[0][2], t, P[0][4], P[0][5]);
    t += P[0][4];
    for (let i = 1; i < P.length; i++) {
      const a = P[max(0, i - 2)], b = P[i - 1], c = P[i], d = P[min(P.length - 1, i + 1)];
      const L = sqrt((c[0] - b[0]) ** 2 + (c[1] - b[1]) ** 2), n = max(1, ceil(L / 0.33));
      for (let j = 1; j <= n; j++) {
        const u = j / n, u2 = u * u, u3 = u2 * u;
        const cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3);
        push(cr(a[0], b[0], c[0], d[0]), cr(a[1], b[1], c[1], d[1]), b[2] + (c[2] - b[2]) * u, t + c[3] * u, j === n ? c[4] : 0, c[5]);
      }
      t += c[3] + c[4];
    }
    px = P[P.length - 1][0];
    py = P[P.length - 1][1];
  });
  S.n = xs.length;
  S.x = Float32Array.from(xs), S.y = Float32Array.from(ys), S.r = Float32Array.from(rs), S.t = Float32Array.from(ts), S.d = Float32Array.from(ds);
  S.m = Int8Array.from(ms), S.s = Float32Array.from(ss), S.k = Int8Array.from(ks), S.tx = Float32Array.from(txs), S.ty = Float32Array.from(tys);
  S.air = air;
  S.end = t;
  // Each stroke's bristles: the ink level at which each one gives out, and
  // a slow wobble along the stroke so the dry streaks break and rejoin.
  S.theta = [];
  S.wf = [];
  S.wp = [];
  for (let k = 0; k < 5; k++) {
    const th = [];
    for (let b = 0; b < NB; b++) th.push(0.08 + (0.84 * (b + Math.random())) / NB);
    for (let b = NB - 1; b > 0; b--) {
      const j = floor(Math.random() * (b + 1));
      [th[b], th[j]] = [th[j], th[b]];
    }
    S.theta.push(th);
    S.wf.push(Array.from({ length: NB }, () => 0.15 + Math.random() * 0.25));
    S.wp.push(Array.from({ length: NB }, () => Math.random() * 6.3));
  }
  // The time each method starts, for its name.
  S.mt = new Float32Array(8).fill(1e9);
  for (let i = 0; i < S.n; i++) if (S.t[i] < S.mt[S.m[i]]) S.mt[S.m[i]] = S.t[i];
}

function fresh(S) {
  S.T = 0;
  S.i = 0;
  S.dw = -1;
  S.cov.fill(0);
  S.bleed.fill(0);
  S.mid.fill(-1);
  S.t0.fill(-1);
  build(S);
}

export function setup(params) {
  const S = (params.yong = {
    cov: new Float32Array(N), bleed: new Float32Array(N), mid: new Int8Array(N), t0: new Float32Array(N),
    hue: 0, speed: 2, brush: 0, ink: 0.06, started: false,
  });
  fresh(S);
}

// One brush sample pressed into the paper. grow is how far into its rest the
// brush is, 0 to 1: a resting brush spreads and pools its ink.
function stamp(S, i, grow) {
  const k = S.k[i], s = S.s[i], q = S.ink, wet = max(0, q);
  const rr = S.r[i] * (1 + 0.45 * S.brush) * (1 + 0.12 * wet) * (1 + 0.14 * grow);
  if (rr < 0.12) return;
  const rate = 0.0055 * (1 - 0.6 * q) * (q < 0 ? 1 - 0.3 * q : 1);
  let L = 1.05 + 0.2 * q - s * rate;
  if (grow > 0) L = max(L, 0.75 + 0.3 * grow);
  const dens = cl(0.5 + 0.5 * L, 0.45, 1);
  const hw = 3.2 * wet + 1.4 * grow * (0.25 + wet);
  const cx = S.x[i], cy = S.y[i], nx = -S.ty[i], ny = S.tx[i];
  const th = S.theta[k], wf = S.wf[k], wp = S.wp[k];
  const R = rr + hw + 1;
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, ceil(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, ceil(cy + R));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, dist = sqrt(dx * dx + dy * dy), p = y * W + x, d = dist - rr;
      if (S.t0[p] < 0 && d < hw + 0.5) S.t0[p] = S.T;
      const c = cl(0.6 - d + 0.35 * GRAIN[p], 0, 1);
      if (c > 0) {
        const u = (dx * nx + dy * ny) / rr;
        const b = cl(floor((u + 1) * 0.5 * NB), 0, NB - 1);
        const dep = cl((max(L, 0.3) + 0.28 * sin(s * wf[b] + wp[b]) - th[b]) * 5, 0, 1);
        const v = c * dep * dens;
        if (v > S.cov[p]) {
          S.cov[p] = v;
          S.mid[p] = S.m[i];
        }
      }
      if (hw > 0.05 && d > -0.5 && d < hw) {
        const bv = (0.2 + 0.25 * wet) * cl(1 - (d + 0.6 * GRAIN[p] + 0.5 * FIB[p]) / hw, 0, 1);
        if (bv > S.bleed[p]) S.bleed[p] = bv;
      }
    }
}

function advance(S, dt) {
  S.T += dt * S.speed * 0.6;
  const T = S.T;
  if (S.dw >= 0) {
    const g = min(1, (T - S.t[S.dw]) / S.d[S.dw]);
    stamp(S, S.dw, g);
    if (g >= 1) S.dw = -1;
  }
  while (S.i < S.n && S.t[S.i] <= T) {
    const i = S.i++;
    if (S.d[i] > 0) {
      const g = min(1, (T - S.t[i]) / S.d[i]);
      stamp(S, i, g);
      if (g < 1) {
        S.dw = i;
        break;
      }
    } else stamp(S, i, 0);
  }
  if (T > S.end + HOLD + FADE) fresh(S);
}

export function update(dt, input, params) {
  if (!params.yong) setup(params);
  const S = params.yong, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.brush = cl(k[2], -1, 1);
  S.ink = cl(k[3], -1, 1);
  if (!S.started) {
    // A fresh start opens with the dot written and the brush on its way to
    // the horizontal.
    S.started = true;
    for (let j = 0; j < 36; j++) advance(S, 1 / 30 / (S.speed * 0.6));
  }
  advance(S, dt);
}

export function draw(display, params) {
  const S = params.yong;
  if (!S) return;
  const T = S.T, h0 = 0.115 + S.hue;
  const ink = hsv(h0, 0.72, 1, [0, 0, 0]), paper = hsv(h0 + 0.52, 0.78, 0.16, [0, 0, 0]), lab = hsv(h0 - 0.105, 0.78, 0.95, [0, 0, 0]);
  const fade = T > S.end + HOLD ? cl(1 - (T - S.end - HOLD) / FADE, 0, 1) : 1;
  // While the finished character holds, each method lights in turn.
  const hiT = T - S.end - 0.3, hiM = hiT >= 0 && hiT < 8 * 0.28 ? floor(hiT / 0.28) : -1, hiA = hiM >= 0 ? sin((PI * (hiT - hiM * 0.28)) / 0.28) : 0;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const f = 0.82 + 0.45 * FIB[p] + 0.06 * GRAIN[p];
      let r = paper[0] * f, g = paper[1] * f, b = paper[2] * f;
      const t0 = S.t0[p];
      if (t0 >= 0) {
        const age = T - t0, cv = S.cov[p], bl = S.bleed[p] * min(1, age / 0.9);
        const a = max(cv, bl) * fade;
        if (a > 0) {
          r += (ink[0] - r) * a;
          g += (ink[1] - g) * a;
          b += (ink[2] - b) * a;
          let wh = 0.5 * exp(-age / 0.35) * cv;
          if (hiM >= 0 && S.mid[p] === hiM) wh += 0.55 * hiA * cv;
          wh *= fade;
          r += (255 - r) * wh;
          g += (255 - g) * wh;
          b += (255 - b) * wh;
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  // The names, each lighting as its method begins.
  for (let m = 0; m < 8; m++) {
    const st = S.mt[m];
    if (T < st) continue;
    const age = T - st;
    let v = (0.62 + 0.38 * exp(-age / 0.6)) * min(1, age / 0.15) * fade;
    if (m === hiM) v = min(1, v + 0.5 * hiA);
    const G = NAMES[m], [ox, oy] = SPOT[m];
    for (let gy = -1; gy <= 13; gy++)
      for (let gx = -1; gx <= 13; gx++) {
        const x = ox + gx, y = oy + gy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const on = gy >= 0 && gy < 13 && gx >= 0 && gx < 13 && G[gy][gx] === "#";
        if (on) display.setPixel(x, y, lab[0] * v + 40 * v * v, lab[1] * v + 40 * v * v, lab[2] * v + 40 * v * v);
      }
  }
  // The brush between strokes, a faint ring where it will come down.
  for (const a of S.air)
    if (T >= a[0] && T < a[1]) {
      const u = (T - a[0]) / (a[1] - a[0]), e = u * u * (3 - 2 * u);
      const bx = a[2] + (a[4] - a[2]) * e, by = a[3] + (a[5] - a[3]) * e, rr = 2.2 + 2 * (1 - e) + S.brush;
      for (let y = max(0, floor(by - rr - 1)); y <= min(H - 1, ceil(by + rr + 1)); y++)
        for (let x = max(0, floor(bx - rr - 1)); x <= min(W - 1, ceil(bx + rr + 1)); x++) {
          const d = abs(sqrt((x - bx) ** 2 + (y - by) ** 2) - rr);
          if (d < 0.7) display.setPixel(x, y, 60 + ink[0] * 0.25, 60 + ink[1] * 0.25, 60 + ink[2] * 0.25);
        }
    }
}
