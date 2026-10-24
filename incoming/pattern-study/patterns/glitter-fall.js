// ===== Patternflow pattern =====
// Title:   Glitter Fall
// Family:  cosmetic
// Idea:    Glitter pours from the top of a dark panel in a swaying stream, every tiny hexagonal flake tumbling and flashing as its face turns to the lamp, and piles into dunes at the bottom that glint as the lamp moves until the floor opens and the heap drains away like an hourglass.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 29, after loose cosmetic glitter poured under a display lamp
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Amount=1..3, Size=0..1
//
// Knob 1: Hue. The colour of the glitter, all the way round the wheel from rose pink at 0; the silver flakes in the mix stay silver while they fall.
// Knob 2: Speed. How fast everything happens: at 2 a flake takes about eight seconds to fall the 128 rows and turns over every two seconds or so; at 0.2 it drifts down ten times slower.
// Knob 3: Amount. How much glitter pours, from a steady shower at 1 to a heavy pour at 3 that fills the panel with flakes and builds the heap three times as fast.
// Knob 4: Size. The flakes, from fine glitter one LED across near 0 to chunky hexagons three LEDs across at 1 that visibly thin to an edge as they tumble.
// Buttons: K1 tap throws the top of the heap up into the air, and it flashes all the way back down.

const W = 64, H = 128, N = W * H;
const MAXP = 2600;
const { min, max, floor, sin, cos, exp, abs, sqrt, log, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Every flake carries one of NS seeds, which fix its colour class, how it lies
// once it has landed and how bright it is. A grain in the heap keeps its seed,
// so the heap's texture and glints stay put while the lamp moves.
const NS = 1024;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const TX = new Float32Array(NS), TY = new Float32Array(NS), JIT = new Float32Array(NS), CLS = new Uint8Array(NS);
for (let i = 0; i < NS; i++) {
  // A landed flake lies roughly flat: its tilt is a small Gaussian.
  const r = sqrt(-2 * log(hash(i * 4) + 1e-6)) * 0.3, a = 2 * PI * hash(i * 4 + 1);
  TX[i] = r * cos(a);
  TY[i] = r * sin(a);
  JIT[i] = hash(i * 4 + 2);
  const c = hash(i * 4 + 3);
  // Main colour, a lighter tint, a deeper shade, and silver.
  CLS[i] = c < 0.5 ? 0 : c < 0.7 ? 1 : c < 0.85 ? 2 : 3;
}
// Hue offset, saturation and value of each class, and how much of the hue a
// flash keeps. Silver keeps a breath of the hue so it sits in the same mix.
const PAL = [
  [0, 0.85, 0.8, 0.45],
  [-0.03, 0.55, 0.95, 0.35],
  [0.03, 1, 0.65, 0.55],
  [0, 0.1, 0.5, 0.08],
];

// The heap's grains sit one to an LED, stacked in columns from the floor up.
// HEAP is how many grains make the floor open, LOW how many it keeps.
const HEAP = 2600, LOW = 1150;

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5);
  out[o + 1] = f(3);
  out[o + 2] = f(1);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    x: F(MAXP), y: F(MAXP), vx: F(MAXP), vy: F(MAXP), ph: F(MAXP), om: F(MAXP), al: F(MAXP), sw: F(MAXP), vt: F(MAXP), sd: new Uint16Array(MAXP),
    n: 0, G: new Int16Array(N).fill(-1), h: new Int16Array(W), grains: 0, T: 0, acc: 0, ca: 0, dir: 1,
    drain: 0, dx0: 0, dx1: 0, dtime: 0, started: false,
    buf: F(N * 3), base: F(12), fl: F(12), hue: 0, amount: 1, size: 0.06, lx: 32, ly: 80,
  };
}

// One flake into the air at x, y.
function spawn(S, x, y, vx, vy, seed) {
  if (S.n >= MAXP) return;
  const i = S.n++;
  S.x[i] = x;
  S.y[i] = y;
  S.vx[i] = vx;
  S.vy[i] = vy;
  // Its own spin: phase and rate, so each flash is a smooth function of time.
  S.ph[i] = Math.random() * 2 * PI;
  S.om[i] = (1.6 + 3 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
  S.al[i] = Math.random() * PI;
  S.sw[i] = Math.random() * 2 * PI;
  S.vt[i] = 12 + 6 * Math.random();
  S.sd[i] = seed;
}

function kill(S, i) {
  const j = --S.n;
  S.x[i] = S.x[j];
  S.y[i] = S.y[j];
  S.vx[i] = S.vx[j];
  S.vy[i] = S.vy[j];
  S.ph[i] = S.ph[j];
  S.om[i] = S.om[j];
  S.al[i] = S.al[j];
  S.sw[i] = S.sw[j];
  S.vt[i] = S.vt[j];
  S.sd[i] = S.sd[j];
}

// Where the stream comes down: a centre that wanders the width of the panel.
const pour = (T) => 32 + 20 * sin(T * 0.19) + 7 * sin(T * 0.47 + 1.3);

// Moves the top grain of column a onto the top of column b.
function slide(S, a, b) {
  const h = S.h, G = S.G, from = (H - h[a]) * W + a;
  h[b]++;
  G[(H - h[b]) * W + b] = G[from];
  G[from] = -1;
  h[a]--;
}

// The heap settles like sand: wherever a column stands two or more grains
// above its neighbour, grains slip from its top down onto the neighbour's, at
// most three a step, so a wall slumps to the angle of repose within a few
// frames and the slope can be seen running.
function settle(S) {
  const h = S.h, G = S.G;
  S.dir = -S.dir;
  for (let k = 0; k < W - 1; k++) {
    const x = S.dir > 0 ? k : W - 2 - k;
    let d = h[x] - h[x + 1];
    // Some steps hold at 45 degrees and some do not, which roughens the slopes.
    const lim = Math.random() < 0.5 ? 2 : 3;
    if (d >= lim) for (let n = min(3, d >> 1); n > 0; n--) slide(S, x, x + 1);
    else if (-d >= lim) for (let n = min(3, -d >> 1); n > 0; n--) slide(S, x + 1, x);
  }
  // An open floor lets the grains over the slot fall out of the bottom: the
  // whole column sinks by one, so its glitter is seen running down.
  if (S.drain)
    for (let x = S.dx0; x <= S.dx1; x++) {
      if (h[x] <= 0 || Math.random() > 0.8) continue;
      for (let y = H - 1; y > H - h[x]; y--) G[y * W + x] = G[(y - 1) * W + x];
      G[(H - h[x]) * W + x] = -1;
      h[x]--;
      S.grains--;
    }
}

// Lands a falling flake on top of column cx.
function land(S, cx, seed) {
  if (S.h[cx] >= H - 1) return;
  S.h[cx]++;
  S.G[(H - S.h[cx]) * W + cx] = seed;
  S.grains++;
}

function step(S, st) {
  S.T += st;
  const T = S.T;
  // The lamp drifts round the lower two thirds of the panel.
  S.lx = 32 + 34 * sin(T * 0.29);
  S.ly = 84 + 34 * sin(T * 0.21 + 0.7);
  // Pouring: a little over half the glitter comes down in the stream, the
  // rest is sprinkled across the whole width.
  S.acc += st * 80 * S.amount;
  const c = pour(T);
  while (S.acc >= 1) {
    S.acc -= 1;
    const x = Math.random() < 0.55 ? c + (Math.random() + Math.random() - 1) * 9 : Math.random() * W;
    spawn(S, cl(x, 0, W - 0.01), -2 * Math.random(), 0, 12, floor(Math.random() * NS));
  }
  // Glitter falls slowly, rocking from side to side on its way down.
  const k = min(1, 1.5 * st), air = 3 * sin(T * 0.37);
  for (let i = S.n - 1; i >= 0; i--) {
    S.sw[i] += st * 2;
    S.vy[i] += (S.vt[i] - S.vy[i]) * k;
    S.vx[i] += (air + 5 * sin(S.sw[i]) - S.vx[i]) * k;
    S.ph[i] += S.om[i] * st;
    const oy = S.y[i];
    let x = S.x[i] + S.vx[i] * st;
    const y = oy + S.vy[i] * st;
    if (x < 0) (x = -x), (S.vx[i] = abs(S.vx[i]));
    if (x >= W) (x = 2 * W - 0.01 - x), (S.vx[i] = -abs(S.vx[i]));
    S.x[i] = x;
    S.y[i] = y;
    if (S.vy[i] <= 0 || y < 0) continue;
    // It lands once it reaches the top of the heap in its column.
    const cx = floor(x);
    if (y >= H - S.h[cx] - 0.5) {
      land(S, cx, S.sd[i]);
      kill(S, i);
    }
  }
  S.ca += st * 30;
  while (S.ca >= 1) {
    S.ca -= 1;
    settle(S);
  }
  // A deep heap opens the floor under where the stream has been piling it;
  // the floor closes once about half of it has run out or after twelve seconds.
  // The slot widens with the pour so it always drains faster than it fills.
  if (!S.drain && S.grains > HEAP) {
    const m = round(cl(c, 12, W - 13)), w = round(4 + 2 * S.amount);
    S.drain = 1;
    S.dx0 = m - w;
    S.dx1 = m + w;
    S.dtime = 0;
  } else if (S.drain) {
    S.dtime += st;
    if (S.grains < LOW || S.dtime > 12) S.drain = 0;
  }
}

// K1: the top layer of the heap leaps into the air.
function burst(S) {
  const G = S.G, h = S.h;
  for (let x = 0; x < W; x++)
    for (let got = 0; got < 6 && h[x] > 2; got++) {
      const i = (H - h[x]) * W + x;
      spawn(S, x + Math.random(), H - h[x] + Math.random(), (x - 32) * 0.4 + (Math.random() - 0.5) * 30, -75 - 95 * Math.random(), G[i]);
      G[i] = -1;
      h[x]--;
      S.grains--;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06];
  const d = cl(dt || 0, 0, 0.1), rate = cl(k[1], 0.2, 3) / 2;
  S.hue = k[0];
  S.amount = cl(k[2], 1, 3);
  S.size = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    // Open on a heap already lying in dunes and the stream already falling.
    for (let x = 0; x < W; x++) {
      const h = round(17 + 6 * sin(x * 0.09 + 1) + 4 * sin(x * 0.23));
      for (let y = H - h; y < H; y++) S.G[y * W + x] = floor(Math.random() * NS);
      S.h[x] = h;
      S.grains += h;
    }
    for (let i = 0; i < 300; i++) step(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) burst(S);
  step(S, d * rate);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const buf = S.buf, base = S.base, fl = S.fl, G = S.G, lx = S.lx, ly = S.ly;
  const hue = S.hue + 0.92;
  for (let c = 0; c < 4; c++) {
    const p = PAL[c];
    hsv(hue + p[0], p[1], p[2] * 255, base, c * 3);
    hsv(hue + p[0], p[3], 255, fl, c * 3);
  }
  // A deep field, warmed a little round the lamp but kept under what an LED
  // shows as lit, so every flake reads against black.
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) {
      const g = 9 * exp(-((x - lx) ** 2 + (y - ly) ** 2) / 1800);
      buf[q] = (4 + g) * (0.4 + base[0] / 425);
      buf[q + 1] = (3 + g) * (0.4 + base[1] / 425);
      buf[q + 2] = (6 + g) * (0.4 + base[2] / 425);
    }
  // The heap: each grain its seed's colour, lit by the lamp and shaded with
  // depth. A grain glints when its tilt sends the lamp to the eye: the tilt
  // needed changes across the heap and the lamp moves, so the glints travel.
  for (let x = 0; x < W; x++)
    for (let y = H - S.h[x]; y < H; y++) {
      const i = y * W + x, g = G[i];
      if (g < 0) continue;
      // Silver grains in the heap take the light tint: grey ones read as grit.
      const dep = y - H + S.h[x], ex = x - lx, ey = y - ly, c = CLS[g] * 3, cb = c === 9 ? 3 : c;
      const lamp = 0.6 + 0.5 * exp(-(ex * ex + ey * ey) / 900);
      const v = (0.6 + 0.25 * JIT[g]) * lamp * (dep < 1 ? 1.25 : max(0.6, 1 - 0.01 * dep));
      const hx = TX[g] - ex * 0.0105, hy = TY[g] - ey * 0.0105;
      const gl = exp(-(hx * hx + hy * hy) / 0.016) * (dep < 6 ? 1 : 0.6);
      const q = i * 3;
      buf[q] += base[cb] * v + fl[c] * gl * 1.4;
      buf[q + 1] += base[cb + 1] * v + fl[c + 1] * gl * 1.4;
      buf[q + 2] += base[cb + 2] * v + fl[c + 2] * gl * 1.4;
      if (gl > 0.35) star(buf, x + 0.5, y + 0.5, fl, c, gl * 0.8, 1 + S.size * 2);
    }
  // The falling flakes: a hexagon turned in the plane and thinned as it
  // tumbles, flashing when its face swings through the angle that sends the
  // lamp's light to the eye: once a turn, the back being matt.
  const r0 = 0.55 + 1.05 * S.size;
  for (let i = 0; i < S.n; i++) {
    const x = S.x[i], y = S.y[i];
    if (y < -3 || y > H + 3) continue;
    const g = S.sd[i], c = CLS[g] * 3, a = S.ph[i];
    const sq = max(0.22, abs(cos(a))), f = exp((cos(a - (x - lx) * 0.006 - (y - ly) * 0.003) - 1) / 0.035);
    // A big flake is dimmer per LED, so a heavy stream of them does not burn white.
    const r = r0 * (0.8 + 0.4 * JIT[g]), v = ((0.5 + 0.35 * JIT[g]) * (0.55 + 0.45 * sq)) / (0.7 + 0.3 * r0);
    const ca = cos(S.al[i]), sa = sin(S.al[i]), e = r + 1.2;
    // Small flakes keep their light when they land between LEDs.
    const norm = r < 1 ? 1.15 / (0.35 + r) : 1;
    for (let Y = max(0, floor(y - e)); Y <= min(H - 1, floor(y + e)); Y++)
      for (let X = max(0, floor(x - e)); X <= min(W - 1, floor(x + e)); X++) {
        const px = X + 0.5 - x, py = Y + 0.5 - y;
        const u = abs(px * ca + py * sa) / sq, w = abs(py * ca - px * sa);
        const dh = max(w, w * 0.5 + u * 0.866) - r;
        const cov = cl(0.5 - dh, 0, 1) * norm;
        if (cov <= 0) continue;
        const q = (Y * W + X) * 3, b = cov * v, h = (cov * f * 1.5) / (0.6 + 0.4 * r0);
        buf[q] += base[c] * b + fl[c] * h;
        buf[q + 1] += base[c + 1] * b + fl[c + 1] * h;
        buf[q + 2] += base[c + 2] * b + fl[c + 2] * h;
      }
    if (f > 0.3) star(buf, x, y, fl, c, f, 1.5 + r0 * 1.5);
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, knee(buf[p]), knee(buf[p + 1]), knee(buf[p + 2]));
}

// A flash spills its light into a four-pointed star round the flake, the arms
// fading out over len LEDs, with a breath on the diagonals.
function star(buf, x, y, fl, c, f, len) {
  const cx = floor(x), cy = floor(y), n = Math.ceil(len);
  for (let k = 1; k <= n; k++) {
    const w = f * 0.75 * (1 - (k - 1) / (len + 0.5)) ** 2;
    if (w <= 0.01) break;
    add(buf, cx + k, cy, fl, c, w);
    add(buf, cx - k, cy, fl, c, w);
    add(buf, cx, cy + k, fl, c, w);
    add(buf, cx, cy - k, fl, c, w);
  }
  const dw = f * 0.22;
  add(buf, cx + 1, cy + 1, fl, c, dw);
  add(buf, cx - 1, cy + 1, fl, c, dw);
  add(buf, cx + 1, cy - 1, fl, c, dw);
  add(buf, cx - 1, cy - 1, fl, c, dw);
}
function add(buf, x, y, fl, c, w) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const q = (y * W + x) * 3;
  buf[q] += fl[c] * w;
  buf[q + 1] += fl[c + 1] * w;
  buf[q + 2] += fl[c + 2] * w;
}

// Bright pile-ups roll off toward white instead of clipping flat.
function knee(v) {
  return v < 190 ? v : 255 - 65 * exp(-(v - 190) / 65);
}
