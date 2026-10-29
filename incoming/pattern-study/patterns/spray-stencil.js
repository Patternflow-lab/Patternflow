// ===== Patternflow pattern =====
// Title:   Spray Stencil
// Family:  type
// Idea:    A grey metal stencil plate cut with the four syllables of 취급주의 (handle with care) one above the other lies on the side of a kraft cardboard crate, a spray nozzle sweeps down it in a zigzag and builds the paint out of soft particles, and when the plate slides off the letters stand on the crate with their bridges left as gaps, the counters of ㅇ, ㅁ and ㅂ held on by them; then the crate moves on and a fresh one comes under the next plate, 화기엄금 or 파손주의.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 72, after the stencilled handling marks on shipping crates, the syllables drawn for this pattern as a stencil face
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Plate=0..3, Overspray=0..1
//
// Knob 1: Hue. The paint: azure at 0, then violet, magenta, red at 0.4, orange, yellow and green round the wheel.
// Knob 2: Speed. At 2 a crate takes 8.4 s: the plate slides on in 0.6 s, the nozzle sweeps it in 4 s, the plate slides off in 0.8 s, the letters hold 2.2 s and the crate moves on in 0.8 s. At 0.2 a crate takes 84 s, at 3 it takes 5.6 s.
// Knob 3: Plate. 0 the three plates take turns, 취급주의, 화기엄금 (no open flame), 파손주의 (fragile); 1, 2 and 3 keep one of them. A new choice brings a fresh crate and plate at once.
// Knob 4: Overspray. The nozzle's distance from the plate. At the opening 0.06 the droplets land with a standard deviation of 4 LEDs across the sweep and 3.2 down it, one in ten of them a finer mist spread 1.7 times wider, and the letters print crisp. At 1 the spread is 9.6 LEDs, nearly two in five are mist spread 3.2 times wider and dusting cuts the nozzle has not reached, and paint creeps under the plate's edges: of what lands on the plate 1 LED from a cut, 27 percent reaches the crate beneath, 3 LEDs out 13 percent, so the letters come up soft and haloed.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, exp, log, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The stencil face. Each syllable is drawn in a box 52 LEDs wide and
// 28 tall from cut-outs: [0, x0, y0, x1, y1] a rectangle, [1, xa, ya, xb, yb,
// w] a slanted stroke w LEDs thick with flat ends, [2, cx, cy, rx, ry, t] an
// elliptical ring t thick; and [3, x0, y0, x1, y1] a bridge, plate left
// standing across a cut. Horizontal strokes are 3 to 4 LEDs, upright ones 5.
// Every ring is bridged top and bottom, and the corners of ㄱ, ㄴ, ㅁ, ㅂ and
// ㅍ, the peaks of ㅅ, ㅈ and ㅊ and the arms of ㅏ and ㅓ are cut apart by
// 2 LEDs of plate, so no part of the plate is ringed by a cut and the inside
// of ㅇ, ㅎ, ㅁ, ㅂ and ㅍ stays held to the rest: filled from its corner, LED
// to LED across edges, each plate reaches all of its 5855 to 6056 LEDs. The
// joins of ㅜ and ㅗ ring nothing and stay whole.
const SYL = {
  취: [[0, 17, 0, 25, 3], [0, 5, 3, 37, 6.5], [1, 21, 8.5, 7, 16.5, 4.2], [1, 21, 8.5, 35, 16.5, 4.2], [3, 20, 8, 22, 17],
    [0, 1, 18.5, 40, 22], [0, 18, 22, 23, 28], [0, 44, 0, 49, 28]],
  급: [[0, 6, 0, 37, 3.5], [0, 39, 0, 44, 8.5], [0, 0, 10.5, 52, 13.5],
    [0, 9, 15.5, 14, 28], [0, 38, 15.5, 43, 28], [0, 16, 20, 36, 23], [0, 16, 25, 36, 28]],
  주: [[0, 7, 0, 45, 4], [1, 26, 6, 10, 15.5, 4.5], [1, 26, 6, 42, 15.5, 4.5], [3, 25, 5, 27, 16],
    [0, 0, 17.5, 52, 21], [0, 23.5, 21, 28.5, 28]],
  의: [[2, 20, 9, 14, 8.5, 4.5], [3, 19, 0, 21, 5.5], [3, 19, 12.5, 21, 18], [0, 1, 21, 40, 25], [0, 44, 0, 49, 28]],
  화: [[0, 14, 0, 22, 2.5], [0, 5, 2.5, 31, 5.5], [2, 18, 11.5, 10, 4.8, 3.3], [3, 17, 6, 19, 10.5], [3, 17, 12.5, 19, 17],
    [0, 15.5, 18, 20.5, 22.5], [0, 0, 22.5, 37, 26], [0, 41, 0, 46, 28], [0, 48, 11.5, 52, 15.5]],
  기: [[0, 4, 3, 25, 7], [0, 27, 3, 32, 24], [0, 41, 0, 46, 28]],
  엄: [[2, 15, 7.5, 12, 7.5, 4.5], [3, 14, 0, 16, 5], [3, 14, 10, 16, 15], [0, 29, 5.5, 35, 9.5], [0, 37, 0, 42, 15.5],
    [0, 8, 17.5, 13, 28], [0, 37, 17.5, 42, 28], [0, 15, 17.5, 35, 21], [0, 15, 24.5, 35, 28]],
  금: [[0, 6, 0, 37, 3.5], [0, 39, 0, 44, 8.5], [0, 0, 10.5, 52, 13.5],
    [0, 9, 15.5, 14, 28], [0, 38, 15.5, 43, 28], [0, 16, 15.5, 36, 19], [0, 16, 24.5, 36, 28]],
  파: [[0, 2, 1, 33, 5], [0, 2, 23, 33, 27], [1, 11, 7, 9, 21, 4.2], [1, 22, 7, 24, 21, 4.2], [0, 38, 0, 43, 28], [0, 45, 11.5, 51, 15.5]],
  손: [[1, 26, 0, 11, 9.5, 4.2], [1, 26, 0, 41, 9.5, 4.2], [3, 25, 0, 27, 10], [0, 23.5, 9.5, 28.5, 14], [0, 0, 13.5, 52, 17],
    [0, 8, 19, 13, 28], [0, 15, 24.5, 46, 28]],
};
const PLATES = [["취", "급", "주", "의"], ["화", "기", "엄", "금"], ["파", "손", "주", "의"]];
const SX = 6, SY = [3, 34, 65, 96];

function inPrim(p, x, y) {
  if (p[0] === 0 || p[0] === 3) return x >= p[1] && x < p[3] && y >= p[2] && y < p[4];
  if (p[0] === 1) {
    if (y < p[2] || y >= p[4]) return false;
    const dx = p[3] - p[1], dy = p[4] - p[2], c = p[1] + (dx * (y - p[2])) / dy;
    return abs(x - c) < (p[5] / 2) * (sqrt(dx * dx + dy * dy) / dy);
  }
  const qx = (x - p[1]) / p[3], qy = (y - p[2]) / p[4], qi = (x - p[1]) / (p[3] - p[5]), qj = (y - p[2]) / (p[4] - p[5]);
  return qx * qx + qy * qy < 1 && qi * qi + qj * qj >= 1;
}

// The plate: how much of each LED is cut away (0 to 1, from 4 by 4 samples),
// and for the plate around the cuts, how far it is to the nearest cut.
function makePlate(k) {
  const hole = new Float32Array(N), far = new Float32Array(N).fill(99);
  PLATES[k].forEach((ch, r) => {
    const prims = SYL[ch], cuts = prims.filter((p) => p[0] !== 3), bridges = prims.filter((p) => p[0] === 3);
    for (let y = 0; y < 28; y++)
      for (let x = -1; x < 53; x++) {
        let c = 0;
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++) {
            const u = x + (i + 0.5) / 4, v = y + (j + 0.5) / 4;
            if (cuts.some((p) => inPrim(p, u, v)) && !bridges.some((p) => inPrim(p, u, v))) c++;
          }
        const px = x + SX, py = y + SY[r];
        if (c && px >= 0 && px < W) hole[py * W + px] = c / 16;
      }
  });
  for (let i = 0; i < N; i++) if (hole[i] >= 0.5) far[i] = 0;
  // Two chamfer passes give the distance to the nearest cut.
  const step = (i, j, d) => { if (far[j] + d < far[i]) far[i] = far[j] + d; };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x > 0) step(i, i - 1, 1);
      if (y > 0) step(i, i - W, 1), x > 0 && step(i, i - W - 1, 1.41), x < W - 1 && step(i, i - W + 1, 1.41);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (x < W - 1) step(i, i + 1, 1);
      if (y < H - 1) step(i, i + W, 1), x > 0 && step(i, i + W - 1, 1.41), x < W - 1 && step(i, i + W + 1, 1.41);
    }
  return { hole, far, paint: new Float32Array(N) };
}

// ---- Surfaces: value noise from a hash.
const hash = (a, b, c) => {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
function vn(x, y, k) {
  const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, k), b = hash(x0 + 1, y0, k), c = hash(x0, y0 + 1, k), d = hash(x0 + 1, y0 + 1, k);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// Kraft board: the flutes of the corrugation run up the side 4 LEDs apart,
// with fibre speckle and a tint that differs a little from crate to crate.
function makeCrate(seed) {
  const t = 0.93 + 0.14 * hash(seed, 7, 1), warm = 0.04 * (hash(seed, 9, 2) - 0.5);
  const lum = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      lum[y * W + x] = t * (0.92 + 0.07 * vn(x / 9, y / 13, seed) + 0.05 * (hash(x, y, seed) - 0.5) + 0.035 * cos((2 * PI * x) / 4));
  return { lum, warm, paint: new Float32Array(N) };
}

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());
}

// Phases of a crate, in seconds at Speed 2.
const T_ON = 0.6, T_SPRAY = 4.0, T_OFF = 0.8, T_HOLD = 2.2, T_MOVE = 0.8;
const P_SPRAY = T_ON, P_OFF = P_SPRAY + T_SPRAY, P_HOLD = P_OFF + T_OFF, P_MOVE = P_HOLD + T_HOLD, P_END = P_MOVE + T_MOVE;
const DROPS = 26000; // droplets in one pass of the nozzle
const PRE = 0.35;

export function setup(params) {
  const s = (params.s = {});
  s.plates = [0, 1, 2].map(makePlate);
  s.seed = 1;
  s.crate = makeCrate(s.seed);
  s.next = makeCrate(s.seed + 1);
  s.mode = -1;
  s.which = 0;
  // The panel opens on a plate the nozzle is already a third of the way down.
  s.t = P_SPRAY + PRE * T_SPRAY;
  s.nx = -9;
  s.ny = -9;
  s.fresh = [];
  s.hue = 0;
  s.ov = 0.06;
  s.buf = new Float32Array(N * 3);
}

function freshCrate(s) {
  s.seed++;
  s.crate = s.next;
  s.next = makeCrate(s.seed + 1);
}

function spray(s, a, b) {
  // The nozzle runs 13 sweeps across while it moves steadily down, from
  // 6 LEDs above the panel to 6 below, so its path is a zigzag.
  const ov = s.ov, sig = 3.6 + 6 * ov, plate = s.plates[s.which], hole = plate.hole, far = plate.far;
  const pos = (p) => {
    const q = p * 13, k = floor(q), f = q - k;
    return [k % 2 ? 72 - 80 * f : -8 + 80 * f, -6 + 140 * p];
  };
  const n = round(DROPS * (b - a));
  const ss = 0.5 + 0.6 * ov, reach = ss > 0.8 ? 2 : 1, bleed = 0.4 * ov * ov, bl = 0.4 + 2.2 * ov;
  s.fresh.length = 0;
  for (let i = 0; i < n; i++) {
    const [px, py] = pos(a + ((b - a) * (i + Math.random())) / n);
    const mist = Math.random() < 0.08 + 0.3 * ov, r = mist ? sig * (1.6 + 1.6 * ov) : sig, m = mist ? 0.5 : 1;
    const x = px + gauss() * r, y = py + gauss() * r * 0.8;
    if (x < -2 || x > W + 1 || y < -2 || y > H + 1) continue;
    if (i % 2 === 0 && s.fresh.length < 240) s.fresh.push(x, y);
    const x0 = floor(x), y0 = floor(y);
    for (let yy = y0 - reach; yy <= y0 + reach; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = x0 - reach; xx <= x0 + reach; xx++) {
        if (xx < 0 || xx >= W) continue;
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y, w = (m * exp(-(dx * dx + dy * dy) / (2 * ss * ss))) / (2 * PI * ss * ss);
        const j = yy * W + xx, c = hole[j];
        s.crate.paint[j] += w * (c + (1 - c) * bleed * exp(-far[j] / bl));
        plate.paint[j] += w * (1 - c);
      }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.hue = k[0] || 0;
  const rate = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  s.ov = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const mode = round(cl(k[2] || 0, 0, 3));
  if (mode !== s.mode) {
    // A new choice: fresh crate, and the plate slides on.
    const first = s.mode < 0;
    s.mode = mode;
    s.which = mode ? mode - 1 : 0;
    if (first) spray(s, 0, PRE);
    else {
      freshCrate(s);
      s.t = 0;
    }
  }
  const t0 = s.t;
  s.t += dt * rate;
  s.fresh.length = 0;
  if (s.t > P_SPRAY && t0 < P_OFF) {
    const a = cl((t0 - P_SPRAY) / T_SPRAY, 0, 1), b = cl((s.t - P_SPRAY) / T_SPRAY, 0, 1);
    if (b > a) spray(s, a, b);
    const q = b * 13, kk = floor(q), f = q - kk;
    s.nx = kk % 2 ? 72 - 80 * f : -8 + 80 * f;
    s.ny = -6 + 140 * b;
  }
  if (s.t >= P_END) {
    s.t -= P_END;
    freshCrate(s);
    if (!s.mode) s.which = (s.which + 1) % 3;
    // The plate is wiped between crates, but not clean.
    const pp = s.plates[s.which].paint;
    for (let i = 0; i < N; i++) pp[i] *= 0.35;
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const t = s.t, plate = s.plates[s.which], hole = plate.hole, pp = plate.paint, buf = s.buf;
  const paint = hsv(0.6 + s.hue, 0.88, 1);
  // Plate offset: slides on from the right, off to the right.
  const off = t < P_SPRAY ? round(68 * (1 - ease(t / T_ON))) : t < P_OFF ? 0 : round(68 * ease((t - P_OFF) / T_OFF));
  const lift = t >= P_OFF && t < P_HOLD ? 1 : 0;
  // Crate move: the painted crate slides down and out, the fresh one follows.
  const drop = t >= P_MOVE ? round(H * ease((t - P_MOVE) / T_MOVE)) : 0;
  const kraft = [176, 121, 66];
  for (let y = 0; y < H; y++) {
    const sy = y - drop, old = sy >= 0, cr = old ? s.crate : s.next, row = old ? sy : sy + H;
    const seam = drop && (sy === 0 || sy === -1) ? 0.45 : 1;
    for (let x = 0; x < W; x++) {
      const i = row * W + x, l = cr.lum[i] * seam;
      let r = kraft[0] * l * (1 + cr.warm), g = kraft[1] * l, b = kraft[2] * l * (1 - cr.warm);
      const a = 1 - exp(-1.4 * cr.paint[i]);
      r += (paint[0] * 250 - r) * a;
      g += (paint[1] * 250 - g) * a;
      b += (paint[2] * 250 - b) * a;
      // The plate over the crate, shifted right by off.
      const px = x - off;
      if (px >= 0 && px < W && !drop) {
        const j = y * W + px, c = hole[j];
        // The cut's upper left edge throws a one-LED shadow into the hole.
        const sh = c > 0 && ((px > 0 && hole[j - 1] < 0.5) || (y > 0 && hole[j - W] < 0.5)) ? 0.55 : 1;
        const brush = 0.94 + 0.08 * hash(0, y, 5) + 0.03 * (hash(px, y, 3) - 0.5);
        let mr = 100 * brush, mg = 100 * brush, mb = 98 * brush;
        const pa = (1 - exp(-0.6 * pp[j])) * 0.45;
        mr += (paint[0] * 150 - mr) * pa;
        mg += (paint[1] * 150 - mg) * pa;
        mb += (paint[2] * 150 - mb) * pa;
        r = r * sh * c + mr * (1 - c);
        g = g * sh * c + mg * (1 - c);
        b = b * sh * c + mb * (1 - c);
      } else if (lift && px >= -3 && px < 0) {
        // The lifted plate's shadow just left of its edge.
        const d = 0.55 + 0.15 * (3 + px);
        r *= d;
        g *= d;
        b *= d;
      }
      const o = (y * W + x) * 3;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  // The nozzle: a cloud of paint in the air over the sweep, and the droplets
  // landing this frame.
  if (t > P_SPRAY && t < P_OFF) {
    const rad = (3.6 + 6 * s.ov) * 1.3, amp = 0.26 + 0.34 * s.ov;
    for (let y = max(0, floor(s.ny - 2 * rad)); y < min(H, s.ny + 2 * rad); y++)
      for (let x = max(0, floor(s.nx - 2 * rad)); x < min(W, s.nx + 2 * rad); x++) {
        const dx = x + 0.5 - s.nx, dy = y + 0.5 - s.ny, d2 = dx * dx + dy * dy;
        const e = min(0.85, amp * exp(-d2 / (rad * rad)) + 0.8 * exp(-d2 / 1.6));
        const o = (y * W + x) * 3;
        for (let q = 0; q < 3; q++) buf[o + q] += (min(255, paint[q] * 255 + 140 * e) - buf[o + q]) * e;
      }
    const f = s.fresh;
    for (let i = 0; i < f.length; i += 2) {
      const x = floor(f[i]), y = floor(f[i + 1]);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) buf[o + q] += (min(255, paint[q] * 255 + 110) - buf[o + q]) * 0.8;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(buf[o], 0, 255)), round(cl(buf[o + 1], 0, 255)), round(cl(buf[o + 2], 0, 255)));
    }
}
