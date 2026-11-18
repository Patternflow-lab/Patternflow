// ===== Patternflow pattern =====
// Title:   Blur Bloom
// Family:  cosmetic
// Idea:    Soft stains of tint pop up one after another on a milky ground, each a Korean gradient lip in miniature, a deep core blurring out through a second shade to nothing at a feathered edge; they drift and overlap, deepening where they cross like layered tint, and slowly melt back into the milk while new ones pop up somewhere else.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, collab reference for PERIPERA, after the Over Blur Tint and the gradient lip the Ink tints are worn as, in the milky fruit shades the brand names (우유머금은복숭아, 포도우유샷추가)
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Bloom=0.2..3, Size=0..1, Blur=0..1
//
// Knob 1: Hue. Turns the shade card round the colour wheel; at 0 the stains are the card they open on, plum into peach, sweet-potato pink into strawberry milk, grape into lilac, coral into peach, on a milky ground.
// Knob 2: Bloom. How fast the stains live: at 2 a stain pops up in about half a second, stays six or seven seconds while it drifts and melts away over three more; at 0.2 everything happens ten times slower.
// Knob 3: Size. How big the stains grow, from about sixteen LEDs across with twenty-six on the panel at 0 to about fifty-six across with seven at 1.
// Knob 4: Blur. The edge: at 0 each stain is a crisp dot with its gradient inside it, at 1 it is an airy haze whose edge frays into the milk.
// Buttons: K1 tap pops three new stains at once.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp, sin, cos, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const MAXS = 30;
// How often each pair turns up: pinks most, grape now and then.
const WEIGHT = [2, 3, 1, 2, 2];

// Core and rim of each stain, hue / saturation / value. Picked from the
// brand's shade names, not measured from product photos.
const PAIRS = [
  [[0.905, 0.85, 0.62], [0.03, 0.5, 1.0]], // plum into peach
  [[0.94, 0.78, 0.92], [0.97, 0.42, 1.0]], // sweet-potato pink into strawberry milk
  [[0.79, 0.5, 0.8], [0.8, 0.28, 1.0]], // grape into lilac
  [[0.008, 0.78, 1.0], [0.05, 0.45, 1.0]], // coral into peach
  [[0.955, 0.88, 0.78], [0.92, 0.46, 1.0]], // rose into pink milk
];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

// Smooth value noise on a lattice, for the frayed edges.
const NG = 32;
const LAT = new Float32Array(NG * NG);
function noise(x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  const a = LAT[(yi & (NG - 1)) * NG + (xi & (NG - 1))], b = LAT[(yi & (NG - 1)) * NG + ((xi + 1) & (NG - 1))];
  const c = LAT[((yi + 1) & (NG - 1)) * NG + (xi & (NG - 1))], d = LAT[((yi + 1) & (NG - 1)) * NG + ((xi + 1) & (NG - 1))];
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  for (let i = 0; i < NG * NG; i++) LAT[i] = rnd() * 2 - 1;
  params.s = {
    x: F(MAXS), y: F(MAXS), vx: F(MAXS), vy: F(MAXS), age: F(MAXS), life: F(MAXS), r: F(MAXS),
    pair: new Uint8Array(MAXS), wob: F(MAXS), n: 0,
    grain: F(W * H), col: F(MAXS * 6), clock: 0, owed: 0,
    hue: 0, bloom: 2, size: 0, blur: 0.06, buf: F(W * H * 3), milk: F(3),
  };
  const S = params.s;
  // A fine powder grain, fixed to the LEDs: the velvet of a blurring tint.
  for (let p = 0; p < W * H; p++) S.grain[p] = rnd() * 2 - 1;
}

function want(S) {
  return round(26 - 19 * S.size);
}

function spawn(S, x, y) {
  if (S.n >= MAXS) return;
  const i = S.n++;
  // Put a new stain where the milk shows most: the best of a few tries.
  if (x === undefined) {
    let best = -1;
    for (let t = 0; t < 6; t++) {
      const cx = rnd() * W, cy = rnd() * H;
      let near = 1e9;
      for (let j = 0; j < S.n - 1; j++) near = min(near, (S.x[j] - cx) ** 2 + (S.y[j] - cy) ** 2 - S.r[j] * S.r[j] * 0.3);
      if (near > best) (best = near), (x = cx), (y = cy);
    }
  }
  S.x[i] = x;
  S.y[i] = y;
  const a = rnd() * 2 * PI;
  S.vx[i] = cos(a) * (0.6 + rnd());
  S.vy[i] = sin(a) * (0.6 + rnd());
  S.age[i] = 0;
  S.life[i] = 8 + 4 * rnd();
  S.r[i] = (8 + 20 * S.size) * (0.7 + 0.6 * rnd());
  let w = rnd() * WEIGHT.reduce((a, b) => a + b, 0), pick = 0;
  while (w >= WEIGHT[pick]) w -= WEIGHT[pick++];
  S.pair[i] = pick;
  S.wob[i] = rnd() * 100;
}

function kill(S, i) {
  const j = --S.n;
  S.x[i] = S.x[j];
  S.y[i] = S.y[j];
  S.vx[i] = S.vx[j];
  S.vy[i] = S.vy[j];
  S.age[i] = S.age[j];
  S.life[i] = S.life[j];
  S.r[i] = S.r[j];
  S.pair[i] = S.pair[j];
  S.wob[i] = S.wob[j];
}

function step(S, st) {
  S.clock += st;
  for (let i = S.n - 1; i >= 0; i--) {
    S.age[i] += st;
    if (S.age[i] > S.life[i]) {
      kill(S, i);
      continue;
    }
    // A slow wander: the heading turns on rates of its own.
    const turn = 0.5 * sin(S.clock * 0.43 + S.wob[i]) + 0.3 * sin(S.clock * 0.17 + S.wob[i] * 1.7);
    const vx = S.vx[i], vy = S.vy[i], c = cos(turn * st), s = sin(turn * st);
    S.vx[i] = vx * c - vy * s;
    S.vy[i] = vx * s + vy * c;
    S.x[i] += S.vx[i] * st * 2.4;
    S.y[i] += S.vy[i] * st * 2.4;
    // Off one edge, back in from the other side's direction.
    if (S.x[i] < -4 || S.x[i] > W + 4) S.vx[i] = -S.vx[i];
    if (S.y[i] < -4 || S.y[i] > H + 4) S.vy[i] = -S.vy[i];
  }
  // Keep the panel at the stain count Size asks for; one is born as soon as
  // there is room, and an old one makes room when it melts.
  const target = want(S);
  S.owed += st * 1.2;
  while (S.n < target && S.owed > 0) {
    spawn(S);
    S.owed -= 0.35 + 0.5 * rnd();
  }
  if (S.owed > 1) S.owed = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.bloom = cl(k[1], 0.2, 3);
  S.size = cl(k[2], 0, 1);
  S.blur = cl(k[3], 0, 1);
  if (!S.warm) {
    // Open on a panel already full of stains at every age.
    for (let i = 0; i < want(S); i++) {
      spawn(S);
      S.age[i] = rnd() * S.life[i] * 0.8;
    }
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) for (let i = 0; i < 3; i++) spawn(S);
  // Too many after Size went down: the oldest melt faster.
  const target = want(S);
  if (S.n > target + 2) for (let i = 0; i < S.n; i++) S.age[i] += d * 2;
  step(S, d * 0.5 * S.bloom);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, col = S.col, milk = S.milk, T = S.clock;
  // The milky ground leans from peach milk to lilac milk across the panel,
  // the lean turning slowly on two rates so bare milk is never quite still.
  const ga = T * 0.061 + 0.6 * sin(T * 0.023);
  const gx = cos(ga), gy = sin(ga);
  for (let i = 0; i < S.n; i++) {
    const P = PAIRS[S.pair[i]];
    hsv(P[0][0] + S.hue, P[0][1], P[0][2], col, i * 6);
    hsv(P[1][0] + S.hue, P[1][1], P[1][2], col, i * 6 + 3);
  }
  const blur = 0.12 + 0.88 * S.blur;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = 0.5 + 0.5 * (((x - 32) * gx + (y - 64) * gy * 0.5) / 48);
      // A slow cloud drifts through the milk itself, so a bare patch still breathes.
      const cloud = noise(x * 0.07 + T * 0.23, y * 0.07 - T * 0.17);
      hsv(0.03 + S.hue - 0.27 * t + 0.05 * cloud, 0.1 + 0.05 * t + 0.06 * cloud, 0.93 + 0.05 * cloud, milk, 0);
      const p = (y * W + x) * 3;
      buf[p] = milk[0];
      buf[p + 1] = milk[1];
      buf[p + 2] = milk[2];
    }
  for (let i = 0; i < S.n; i++) {
    const age = S.age[i], life = S.life[i];
    // Pops up in about a second with a little overshoot, melts away over
    // the last third of its life, spreading as it goes.
    const g = sm(0, 1, age);
    const pop = g + 0.18 * sin(g * PI) * (1 - g * 0.5);
    const melt = 1 - sm(life * 0.62, life, age);
    const R = S.r[i] * (0.25 + 0.75 * pop) * (1 + 0.35 * (1 - melt));
    const alpha = melt * (0.25 + 0.75 * g);
    if (alpha < 0.01) continue;
    const ext = R * (1.3 + 1.0 * blur);
    const x0 = max(0, floor(S.x[i] - ext)), x1 = min(W - 1, floor(S.x[i] + ext));
    const y0 = max(0, floor(S.y[i] - ext)), y1 = min(H - 1, floor(S.y[i] + ext));
    const o = i * 6, sx = S.wob[i];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - S.x[i], dy = y + 0.5 - S.y[i];
        let u = sqrt(dx * dx + dy * dy) / R;
        if (u > 2.3) continue;
        // The edge frays: the distance is pushed in and out by noise that
        // drifts with the stain's own clock.
        const n = noise(x * 0.19 + sx, y * 0.19 - sx + T * 0.21) + 0.5 * noise(x * 0.43 - sx, y * 0.43 + T * 0.33);
        u *= 1 + blur * 0.4 * n;
        const edge = 1 - sm(1 - 0.9 * blur, 1 + 0.9 * blur, u);
        if (edge <= 0) continue;
        // The gradient lip: the core shade in the middle, giving way to the
        // rim shade, then to the milk.
        const k = sm(0.05, 0.75, u);
        const a = alpha * edge * (0.97 - 0.15 * k);
        const p = (y * W + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const shade = col[o + ch] * (1 - k) + col[o + 3 + ch] * k;
          // Layered like tint: each coat multiplies what is under it.
          buf[p + ch] *= 1 - a + a * shade;
        }
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, gr = 1 + 0.07 * S.grain[p];
      display.setPixel(x, y, round(cl(buf[p * 3] * gr, 0, 1) * 255), round(cl(buf[p * 3 + 1] * gr, 0, 1) * 255), round(cl(buf[p * 3 + 2] * gr, 0, 1) * 255));
    }
}
