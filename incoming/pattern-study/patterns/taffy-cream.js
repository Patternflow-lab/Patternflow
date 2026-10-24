// ===== Patternflow pattern =====
// Title:   Taffy Cream
// Family:  cosmetic
// Idea:    A tinted cream and a pale ivory one fill a tall vat and three unseen pins pull them like taffy, two pins at a time turning once round each other, clockwise and then anticlockwise, so the line between the creams is drawn out into glossy folds that multiply and thin, growing about 13 times a period where the braid alone demands 5.8, until they blur into a pastel, when a fresh dollop of tinted cream in an ivory rim is laid in on the pins' path and pulled out in its turn.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 37, after two-tone cream being pulled in a cosmetics mixing vat, with the pins moving as a taffy puller, a rod-stirring protocol in the sense of Philip Boyland, Hassan Aref and Mark Stremler (2000)
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pins=3..5, Gloss=0..1
//
// Knob 1: Hue. The tinted cream, once round the wheel against the ivory. At 0 lilac, at 0.15 orchid pink, at 0.25 coral, at 0.33 apricot, at 0.42 butter, at 0.5 lime, at 0.6 mint green, at 0.7 aqua, at 0.85 cornflower. From coral to lime the tint stays at full brightness with shallower shading, as a darker one reads brown or khaki, and beside butter and lime the ivory turns to a cooler white.
// Knob 2: Speed. At 2 a pair of pins turns once round each other in 3 s, so a period of three pins takes 6 s, and a dollop is laid in every 5 turns, 15 s; at 0.2 all of it runs ten times slower.
// Knob 3: Pins. How many pins stand on the vat's long axis, 3 to 5, the pairs taking their turns from the top down, then again. Three pins 36 LEDs apart turn in circles 36 across and a line grows 13 to 14 times a period of two turns; four pins 29 apart, 13 times a period of three; five pins 23 apart turn in circles 23 across, whose pins come 10 LEDs nearer the top and bottom and stay 20 from the sides, and a line grows about 20 times a period of four turns.
// Knob 4: Gloss. At 0 a soft satin cream lit broadly; at 1 a wet gloss with a tight white highlight that runs along each fold's crest as the light drifts over it. It opens at 0.06, a satin sheen.
// Buttons: K1 tap lays a fresh dollop in now, on the path of the pins that turn next.

// The pins move as the taffy puller: pins on a line, neighbours turning
// once round each other, the turns alternately clockwise and anticlockwise.
// The braid of three pins is s1^2 s2^-2, and its Burau matrix at t = -1 is
// [[5, 2], [2, 1]], whose larger eigenvalue is 3 + 2 sqrt 2 = 5.83, the
// silver ratio squared: the least a line caught round the pins must be
// stretched by in one period, whatever the cream between them does.
// Boyland, Aref and Stremler's half turns, s1 s2^-1, give the golden ratio
// squared, 2.62. For four and five pins the same matrices give at least 9.9
// and 12.4 a period of three and four turns. Followed in a scratch script
// through this pattern's own flow, a line across the middle of the vat grew
// 17, 13 and 14 times in three periods with three pins, 13 a period with
// four and 19 to 23 with five: above the floor, as the cream round each
// pin is sheared besides.
//
// The flow: each moving pin carries the cream round it with a stream
// function psi = (V x (p - r)) g(|p - r|), g = exp(-d^2 / 2 s^2), so cream
// at the pin goes with the pin and cream a few s away stays put. Each pin
// has a mirror image behind each of the four walls, moving as its
// reflection, which takes psi to zero along the walls, so no cream crosses
// them and it slides along them freely. The velocity is the curl of psi,
// so the cream keeps its volume. It is worked out on the LED corners, once
// a step, and read between them.
//
// The first try tapered psi to zero over the last 5 LEDs instead. A pin
// passing 14 LEDs from a side wall left psi near 350 there, and the cream
// a pin carries comes back round it in a ring two to three s out, so even
// the top wall, 28 LEDs above the highest pin, saw psi near 75. Squeezed
// to zero in 5 LEDs, either drove a jet of 40 to 50 LEDs a second along
// the wall that combed the cream there into stair steps. With the images
// every corner stays 3.5 s or more from any pin, where g is 0.002, and no
// taper is needed.

const W = 64, H = 128, N = W * H;
// The cream is followed on a grid twice as fine as the LEDs.
const GW = 128, GH = 256, GN = GW * GH;
const { min, max, floor, sqrt, sin, cos, abs, pow, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
// One turn takes this many seconds at Speed 1.
const TURN = 6;
// A dollop every this many turns.
const EVERY = 5;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The pins stand on x = 32, sp apart and centred in the vat.
function layout(n) {
  const sp = min(36, 116 / n), ys = [];
  for (let j = 0; j < n; j++) ys.push(64 + (j - (n - 1) / 2) * sp);
  return { n, sp, ys, sg: 0.3 * sp };
}

// The turning pair and the two pins' places and velocities at phase f of
// turn k: pair j = k mod (n - 1), clockwise for even j. The angle eases in
// and out, so a turn starts and ends at rest and the next pair takes over.
function pins(S, out) {
  const L = S.lay, j = S.turn % (L.n - 1), dir = j % 2 === 0 ? 1 : -1, f = S.phase;
  const cy = (L.ys[j] + L.ys[j + 1]) / 2, R = L.sp / 2;
  const th = 2 * PI * (f - sin(2 * PI * f) / (2 * PI)), om = (2 * PI * (1 - cos(2 * PI * f))) / (S.turnLen || 1);
  for (let k = 0; k < 2; k++) {
    const al = (k === 0 ? -PI / 2 : PI / 2) + dir * th;
    out[k * 4] = 32 + R * cos(al);
    out[k * 4 + 1] = cy + R * sin(al);
    out[k * 4 + 2] = -R * sin(al) * dir * om;
    out[k * 4 + 3] = R * cos(al) * dir * om;
  }
  return out;
}

// Velocity at (x, y) in LED units, written to S.vx, S.vy.
function vel(S, x, y, P) {
  const is2 = 1 / (S.lay.sg * S.lay.sg);
  let px = 0, py = 0;
  for (let k = 0; k < 8; k += 4)
    for (let m = 0; m < 5; m++) {
      // The pin, then its images behind the left, right, top and bottom walls.
      const rx = m === 1 ? -P[k] : m === 2 ? 2 * W - P[k] : P[k], ry = m === 3 ? -P[k + 1] : m === 4 ? 2 * H - P[k + 1] : P[k + 1];
      const vx = m === 1 || m === 2 ? -P[k + 2] : P[k + 2], vy = m === 3 || m === 4 ? -P[k + 3] : P[k + 3];
      const dx = x - rx, dy = y - ry, d2 = (dx * dx + dy * dy) * is2;
      if (d2 > 30) continue;
      const g = Math.exp(-0.5 * d2), c = vx * dy - vy * dx;
      px += -vy * g - c * g * dx * is2;
      py += vx * g - c * g * dy * is2;
    }
  S.vx = py;
  S.vy = -px;
}

// Catmull-Rom sample of the fine grid at grid coordinates (gx, gy), held
// between the four nearest values so a stripe edge never rings.
function sample(c, gx, gy) {
  gx = cl(gx, 0, GW - 1.001);
  gy = cl(gy, 0, GH - 1.001);
  const ix = floor(gx), iy = floor(gy), fx = gx - ix, fy = gy - iy;
  const wx0 = ((-0.5 * fx + 1) * fx - 0.5) * fx, wx1 = (1.5 * fx - 2.5) * fx * fx + 1, wx2 = ((-1.5 * fx + 2) * fx + 0.5) * fx, wx3 = (0.5 * fx - 0.5) * fx * fx;
  const wy0 = ((-0.5 * fy + 1) * fy - 0.5) * fy, wy1 = (1.5 * fy - 2.5) * fy * fy + 1, wy2 = ((-1.5 * fy + 2) * fy + 0.5) * fy, wy3 = (0.5 * fy - 0.5) * fy * fy;
  const x0 = max(ix - 1, 0), x2 = ix + 1, x3 = min(ix + 2, GW - 1);
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const row = min(max(iy - 1 + k, 0), GH - 1) * GW, wy = k === 0 ? wy0 : k === 1 ? wy1 : k === 2 ? wy2 : wy3;
    s += wy * (c[row + x0] * wx0 + c[row + ix] * wx1 + c[row + x2] * wx2 + c[row + x3] * wx3);
  }
  const a = c[iy * GW + ix], b = c[iy * GW + x2], d = c[(iy + 1) * GW + ix], e = c[(iy + 1) * GW + x2];
  return cl(s, min(min(a, b), min(d, e)), max(max(a, b), max(d, e)));
}

// One step of the cream: each fine cell looks back along the flow, a
// midpoint step, and takes what was there. Cells under LEDs whose corners
// all move less than a ten-thousandth of an LED a step are copied as they
// are; at that rate a still cell and a moving neighbour part by 0.2 LED in
// a minute, and the turning pair changes long before.
const VW = W + 1, VH = H + 1;
function advect(S, dt) {
  const P = pins(S, S.P), c = S.c, o = S.c2, U = S.U, V = S.V, still = S.still;
  for (let y = 0; y < VH; y++)
    for (let x = 0; x < VW; x++) {
      vel(S, x, y, P);
      U[y * VW + x] = S.vx;
      V[y * VW + x] = S.vy;
    }
  const lim = (1e-4 / dt) * (1e-4 / dt);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * VW + x, r = q + VW;
      const m = max(max(U[q] * U[q] + V[q] * V[q], U[q + 1] * U[q + 1] + V[q + 1] * V[q + 1]), max(U[r] * U[r] + V[r] * V[r], U[r + 1] * U[r + 1] + V[r + 1] * V[r + 1]));
      still[y * W + x] = m < lim ? 1 : 0;
    }
  for (let gy = 0; gy < GH; gy++) {
    const y = (gy + 0.5) / 2, ly = gy >> 1;
    for (let gx = 0; gx < GW; gx++) {
      const p = gy * GW + gx;
      if (still[ly * W + (gx >> 1)]) {
        o[p] = c[p];
        continue;
      }
      const x = (gx + 0.5) / 2;
      // Bilinear velocity at (x, y), then at the midpoint back along it.
      let ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, q = iy * VW + ix;
      let vx = (U[q] * (1 - fx) + U[q + 1] * fx) * (1 - fy) + (U[q + VW] * (1 - fx) + U[q + VW + 1] * fx) * fy;
      let vy = (V[q] * (1 - fx) + V[q + 1] * fx) * (1 - fy) + (V[q + VW] * (1 - fx) + V[q + VW + 1] * fx) * fy;
      const mx = cl(x - 0.5 * dt * vx, 0, W - 0.001), my = cl(y - 0.5 * dt * vy, 0, H - 0.001);
      (ix = floor(mx)), (iy = floor(my)), (fx = mx - ix), (fy = my - iy), (q = iy * VW + ix);
      vx = (U[q] * (1 - fx) + U[q + 1] * fx) * (1 - fy) + (U[q + VW] * (1 - fx) + U[q + VW + 1] * fx) * fy;
      vy = (V[q] * (1 - fx) + V[q + 1] * fx) * (1 - fy) + (V[q + VW] * (1 - fx) + V[q + VW + 1] * fx) * fy;
      o[p] = sample(c, (x - dt * vx) * 2 - 0.5, (y - dt * vy) * 2 - 0.5);
    }
  }
  S.c = o;
  S.c2 = c;
}

// A dollop: a tinted core with an ivory rim, its edge wobbling on two
// harmonics, laid where the next turn's pins will pass.
function dollop(S) {
  const L = S.lay, j = S.turn % (L.n - 1), cy = (L.ys[j] + L.ys[j + 1]) / 2, R = L.sp / 2;
  const al = random() * 2 * PI, x0 = 32 + R * cos(al) * 0.8, y0 = cy + R * sin(al) * 0.8;
  const r1 = 0.36 * L.sp + 4, r2 = r1 + 4 + 0.08 * L.sp, p1 = random() * 6.3, p2 = random() * 6.3, c = S.c;
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      const dx = (gx + 0.5) / 2 - x0, dy = (gy + 0.5) / 2 - y0, d = sqrt(dx * dx + dy * dy);
      if (d > r2 * 1.3 + 1) continue;
      const an = Math.atan2(dy, dx), wob = 1 + 0.12 * sin(2 * an + p1) + 0.07 * sin(3 * an + p2);
      const e = d / wob;
      if (e > r2 + 0.5) continue;
      const core = sm(r1 + 0.5 - e), rim = sm(r2 + 0.5 - e), p = gy * GW + gx;
      c[p] = c[p] * (1 - rim) + core;
    }
}

function fresh(S) {
  // The vat opens with the tinted cream on the left and the ivory on the
  // right, the line between them wavering across the pins.
  const c = S.c, ph = random() * 6.3;
  for (let gy = 0; gy < GH; gy++) {
    const y = (gy + 0.5) / 2, edge = 32 + 6 * sin((y / H) * 2 * PI * 1.5 + ph);
    for (let gx = 0; gx < GW; gx++) c[gy * GW + gx] = sm(edge + 0.5 - (gx + 0.5) / 2);
  }
}

function step(S, d, lim = 3) {
  S.turnLen = TURN / S.speed;
  S.clock += d * S.speed;
  // Substeps keep the pins under 3 LEDs a step: one at Speed 2, two at 3.
  const vmax = (S.lay.sp / 2) * 4 * PI / S.turnLen, ns = max(1, Math.ceil((vmax * d) / lim));
  for (let i = 0; i < ns; i++) {
    advect(S, d / ns);
    S.phase += d / ns / S.turnLen;
    if (S.phase >= 1) {
      S.phase -= 1;
      S.turn++;
      if (++S.since >= EVERY) (S.since = 0), dollop(S);
    }
  }
}

export function setup(params) {
  params.s = {
    c: new Float32Array(GN), c2: new Float32Array(GN), led: new Float32Array(N), hgt: new Float32Array(N),
    P: new Float64Array(8), vx: 0, vy: 0, U: new Float32Array(VW * VH), V: new Float32Array(VW * VH), still: new Uint8Array(N), lay: layout(3), n: 3, hue: 0, speed: 2, gloss: 0.06,
    turn: 0, phase: 0, since: 0, turnLen: 3, clock: 0, warm: false, tint: [0, 0, 0], ivory: [1, 0.95, 0.86],
  };
  fresh(params.s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.gloss = cl(k[3], 0, 1);
  const n = Math.round(cl(k[2], 3, 5));
  if (n !== S.n) {
    // The pins are unseen, so they simply take their new places; the turn
    // under way goes on with the new pair.
    S.n = n;
    S.lay = layout(n);
  }
  if (!S.warm) {
    // Open a turn and a half in, the first folds already drawn. The 4.5 s
    // run in steps of up to 6 LEDs, 60 of them, about 0.3 s of work.
    const sp = S.speed;
    S.speed = 2;
    for (let i = 0; i < 30; i++) step(S, 0.15, 6);
    S.speed = sp;
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) dollop(S);
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.c, led = S.led, hgt = S.hgt, tint = S.tint, iv = S.ivory;
  // The tint: lilac at 0. From coral to lime it is brought up to full
  // brightness and its shading made shallower, as a darker peach reads brown
  // and a darker butter khaki. Next to butter and lime the ivory turns to a
  // cooler white, or the two creams would be one.
  const h = S.hue + 0.76, hh = h - floor(h);
  const warm = sm(hh / 0.05) * sm((0.3 - hh) / 0.06) + sm((hh - 0.96) / 0.04), yel = sm((hh - 0.08) / 0.05) * sm((0.32 - hh) / 0.05);
  hsv(h, 0.46 + 0.08 * warm, 0.9 + 0.1 * warm, tint);
  iv[0] = 1 - 0.03 * yel;
  iv[1] = 0.95 + 0.02 * yel;
  iv[2] = 0.86 + 0.13 * yel;
  const deep = 1 - 0.45 * warm;
  // Each LED averages its 2 x 2 fine cells, so stripes under an LED wide
  // blend into the pastel between the two creams.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const g = 2 * y * GW + 2 * x;
      led[y * W + x] = 0.25 * (c[g] + c[g + 1] + c[g + GW] + c[g + GW + 1]);
    }
  // The surface: the tinted cream stands a little proud of the ivory, so
  // every fold has two slopes, and a slow swell runs under both.
  const t = S.clock;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0, wsum = 0;
      for (let v = -1; v <= 1; v++)
        for (let u = -1; u <= 1; u++) {
          const xx = cl(x + u, 0, W - 1), yy = cl(y + v, 0, H - 1), w = u === 0 && v === 0 ? 4 : u === 0 || v === 0 ? 2 : 1;
          s += led[yy * W + xx] * w;
          wsum += w;
        }
      hgt[y * W + x] = (2.4 * s) / wsum + 0.5 * sin(x * 0.11 + y * 0.05 + t * 0.4) * sin(y * 0.07 - t * 0.3);
    }
  // The light comes from the upper left and drifts across and back every
  // 20 s of turning; Gloss tightens the highlight and brightens it.
  const gl = S.gloss, la = -2.3 + 0.6 * sin((2 * PI * t) / 20), le = 0.75;
  const lx = cos(la) * cos(le), ly = sin(la) * cos(le), lz = sin(le);
  const hx = lx, hy = ly, hz = lz + 1, hn = sqrt(hx * hx + hy * hy + hz * hz);
  const ex = pow(2, 2.5 + 4 * gl), ks = 0.2 + 0.7 * gl, slope = 0.7 + 1.2 * gl;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const gx = (hgt[y * W + min(x + 1, W - 1)] - hgt[y * W + max(x - 1, 0)]) * 0.5 * slope;
      const gy = (hgt[min(y + 1, H - 1) * W + x] - hgt[max(y - 1, 0) * W + x]) * 0.5 * slope;
      const nl = 1 / sqrt(gx * gx + gy * gy + 1), nx = -gx * nl, ny = -gy * nl, nz = nl;
      // A broad satin sheen lifts flat cream by about 0.12; a tight gloss
      // does not, so the lift is put back by hand and the ivory keeps its
      // level at any Gloss instead of going beige.
      const diff = 1 - (0.09 - 0.1 * gl + 0.28 * (lz - (nx * lx + ny * ly + nz * lz))) * deep;
      const spec = ks * pow(max(0, (nx * hx + ny * hy + nz * hz) / hn), ex);
      const m = led[p];
      const r = (iv[0] + (tint[0] - iv[0]) * m) * diff + spec;
      const g = (iv[1] + (tint[1] - iv[1]) * m) * diff + spec;
      const b = (iv[2] + (tint[2] - iv[2]) * m) * diff + spec;
      display.setPixel(x, y, 255 * min(1, r), 255 * min(1, g), 255 * min(1, b));
    }
}
