// ===== Patternflow pattern =====
// Title:   Pivot Walk
// Family:  sim
// Idea:    A self-avoiding walk of 80 to 160 steps on a 16 x 32 square lattice, drawn as a glowing chain coloured end to end, thrashes by the pivot algorithm: a random site is picked, one of the seven non-identity symmetries of the lattice is applied to the walk on one side of it, and when the result still avoids itself and fits on the panel the moved part swings round the pivot (a rotation) or folds over it (a reflection).
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: self-avoiding walk by the pivot algorithm (Moti Lal, 1969; Neal Madras and Alan Sokal, 1988), pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Length=80..160, Stiff=0..1
//
// Knob 1: Hue. Turns the chain's gradient round the wheel. At 0 it runs from aqua at the first site through blue and violet to pink at the last; at 0.5 from coral through gold to green. The two end sites carry a white bead.
// Knob 2: Speed. Pivot tries a second while the chain is at rest: 14 times the knob, so 28 at 2. An accepted try swings for 0.5 s at 2 when the moved arm is the whole chain and down to 0.25 s for an arm of one site; 0.33 s at 3 and 1.5 s at 0.2. A rejected try flashes its pivot site white for 0.15 s. At the opening knobs that comes to about 1.6 swings a second, the chain moving 66% of the time.
// Knob 3: Length. The number of steps, 80 to 160, on 512 lattice sites 4 LEDs apart. Turning it grows or trims the chain at its ends, 30 steps a second. At 80 one try in 5 is accepted, at 160 one in 21, and the longer chain swings about half as often.
// Knob 4: Stiff. A bending cost J from 0 to 3 per corner, taken by the Metropolis rule. A pivot changes only the corner at its own site, so a try that makes a new corner passes with chance exp(-J). Up to 0.06 there is no cost and the walk is the plain self-avoiding walk, with a corner at 66% of its sites; at 1 only 9% are corners, straight runs average 11 steps and the chain folds like a hairpin between the walls.
// Buttons: K1 tap shrinks the chain to one site in the middle and it grows back at both ends, 30 steps a second, swinging as it grows.

const W = 64, H = 128, GW = 16, GH = 32, STEP = 4, NMAX = 160;
const { floor, min, max, sqrt, abs, round, cos, sin, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The seven non-identity symmetries of the square lattice acting on a
// vector: rotations by +90, -90 and 180 degrees, then reflections in the
// horizontal axis, the vertical axis, the diagonal y = x and y = -x.
const SX = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const SY = [[1, 0], [-1, 0], [0, -1], [0, -1], [0, 1], [1, 0], [-1, 0]];
// For the drawing: the angle each rotation swings through, and the axis
// each reflection folds about.
const ANG = [PI / 2, -PI / 2, PI];
const R2 = Math.SQRT1_2;
const AXIS = [null, null, null, [1, 0], [0, 1], [R2, R2], [R2, -R2]];
// Gradient start hue at Hue 0 (aqua) and its span (to pink).
const HUE0 = 0.47, SPAN = 0.42;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = [v, q, p, p, t, v][i];
  out[o + 1] = [t, v, v, q, p, p][i];
  out[o + 2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, len: 80, J: 0, begun: false,
    n: 0, xs: new Int16Array(NMAX + 1), ys: new Int16Array(NMAX + 1), grid: new Int16Array(GW * GH),
    nx: new Int16Array(NMAX + 1), ny: new Int16Array(NMAX + 1),
    // The swing under way: pivot k, moved side lo..hi, symmetry g, how far
    // through (0..1) and how long it takes.
    swing: null, acc: 0, grow: 0, flashes: [], tries: 0, accepted: 0,
    // Drawing: positions in LEDs, the two layers (resting chain and the arm
    // in motion) and the gradient table.
    px: new Float32Array(NMAX + 1), py: new Float32Array(NMAX + 1),
    keyA: new Float32Array(W * H), rgbA: new Float32Array(W * H * 3),
    covB: new Float32Array(W * H), rgbB: new Float32Array(W * H * 3),
    lut: new Float32Array(256 * 3), lutHue: NaN,
  };
}

const cell = (x, y) => y * GW + x;

// One site in the middle of the lattice, for the walk to grow from.
function seed(S) {
  S.grid.fill(0);
  S.n = 0;
  S.xs[0] = GW >> 1;
  S.ys[0] = GH >> 1;
  S.grid[cell(S.xs[0], S.ys[0])] = 1;
  S.swing = null;
  S.flashes.length = 0;
}

// One pivot try. Returns true if it was accepted (and the walk changed).
// The pivot site, the side that moves (a coin toss) and the symmetry are
// all picked evenly, and a symmetry's inverse is one of the seven too, so a
// move and its undoing are equally likely and the walks are sampled evenly.
function attempt(S, animate) {
  const n = S.n;
  if (n < 2) return false;
  const k = 1 + floor(Math.random() * (n - 1)), tail = Math.random() < 0.5, g = floor(Math.random() * 7);
  const xs = S.xs, ys = S.ys, grid = S.grid, sx = SX[g], sy = SY[g];
  const lo = tail ? k + 1 : 0, hi = tail ? n : k - 1, cx = xs[k], cy = ys[k];
  S.tries++;
  // The corner at k is the only one a pivot changes.
  if (S.J > 0) {
    let ax = xs[k] - xs[k - 1], ay = ys[k] - ys[k - 1], bx = xs[k + 1] - xs[k], by = ys[k + 1] - ys[k];
    const before = ax !== bx || ay !== by;
    if (tail) [bx, by] = [sx[0] * bx + sx[1] * by, sy[0] * bx + sy[1] * by];
    else [ax, ay] = [sx[0] * ax + sx[1] * ay, sy[0] * ax + sy[1] * ay];
    const after = ax !== bx || ay !== by;
    if (after && !before && Math.random() > exp(-S.J)) return reject(S, k, animate);
  }
  // New places for the moved side. A place off the lattice cannot meet the
  // resting side, which is all on it; the walk is slid back on afterwards
  // if its bounding box still fits in 16 by 32 sites.
  const nx = S.nx, ny = S.ny;
  let x0 = GW, x1 = -1, y0 = GH, y1 = -1;
  for (let i = 0; i <= n; i++) {
    if (i >= lo && i <= hi) {
      const dx = xs[i] - cx, dy = ys[i] - cy, x = cx + sx[0] * dx + sx[1] * dy, y = cy + sy[0] * dx + sy[1] * dy;
      if (x >= 0 && x < GW && y >= 0 && y < GH) {
        const o = grid[cell(x, y)] - 1;
        if (o >= 0 && (o < lo || o > hi)) return reject(S, k, animate);
      }
      nx[i] = x;
      ny[i] = y;
    } else {
      nx[i] = xs[i];
      ny[i] = ys[i];
    }
    if (nx[i] < x0) x0 = nx[i];
    if (nx[i] > x1) x1 = nx[i];
    if (ny[i] < y0) y0 = ny[i];
    if (ny[i] > y1) y1 = ny[i];
  }
  if (x1 - x0 >= GW || y1 - y0 >= GH) return reject(S, k, animate);
  // The slide also centres the walk's box on the lattice. Which shapes are
  // allowed depends only on the size of that box, never where it sits.
  const ox = floor((GW - 1 - x0 - x1) / 2), oy = floor((GH - 1 - y0 - y1) / 2);
  if (animate) {
    S.px.set(xs.subarray(0, n + 1));
    S.py.set(ys.subarray(0, n + 1));
  }
  grid.fill(0);
  for (let i = 0; i <= n; i++) {
    xs[i] = nx[i] + ox;
    ys[i] = ny[i] + oy;
    grid[cell(xs[i], ys[i])] = i + 1;
  }
  S.accepted++;
  if (animate) {
    // A short arm swings in as little as half the time of a long one.
    const size = hi - lo + 1, T = cl(1 / S.speed, 0.3, 1.5) * (0.5 + 0.5 * sqrt(size / n));
    S.swing = { k, lo, hi, g, t: 0, T, sx: ox, sy: oy, ox: S.px.slice(0, n + 1), oy: S.py.slice(0, n + 1) };
  }
  return true;
}

function reject(S, k, animate) {
  if (animate && S.flashes.length < 24) S.flashes.push({ k, life: 1 });
  return false;
}

// Grow one step at an end: a free neighbour of the last (or first) site.
function growOne(S) {
  const n = S.n, xs = S.xs, ys = S.ys, grid = S.grid;
  for (const atEnd of Math.random() < 0.5 ? [true, false] : [false, true]) {
    const e = atEnd ? n : 0, free = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = xs[e] + dx, y = ys[e] + dy;
      if (x >= 0 && x < GW && y >= 0 && y < GH && !grid[cell(x, y)]) free.push([x, y]);
    }
    if (!free.length) continue;
    const [x, y] = free[floor(Math.random() * free.length)];
    if (!atEnd) {
      for (let i = n; i >= 0; i--) {
        xs[i + 1] = xs[i];
        ys[i + 1] = ys[i];
        grid[cell(xs[i + 1], ys[i + 1])] = i + 2;
      }
      xs[0] = x;
      ys[0] = y;
      grid[cell(x, y)] = 1;
    } else {
      xs[n + 1] = x;
      ys[n + 1] = y;
      grid[cell(x, y)] = n + 2;
    }
    S.n = n + 1;
    return true;
  }
  return false;
}

// Trim one step, from the end the coin picks.
function trimOne(S) {
  const n = S.n, xs = S.xs, ys = S.ys, grid = S.grid;
  if (Math.random() < 0.5) grid[cell(xs[n], ys[n])] = 0;
  else {
    grid[cell(xs[0], ys[0])] = 0;
    for (let i = 0; i < n; i++) {
      xs[i] = xs[i + 1];
      ys[i] = ys[i + 1];
      grid[cell(xs[i], ys[i])] = i + 1;
    }
  }
  S.n = n - 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 80, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.len = round(cl(kv[2], 80, NMAX));
  const st = cl(kv[3], 0, 1);
  S.J = st <= 0.06 ? 0 : (3 * (st - 0.06)) / 0.94;
  if (!S.begun) {
    // Open on a walk already crumpled: grown from one site a step at a
    // time with 30 tries after each step, then 30 tries a step more.
    seed(S);
    for (let guard = 0; S.n < S.len && guard < 20 * S.len; guard++) {
      growOne(S);
      for (let i = 0; i < 30; i++) attempt(S, false);
    }
    for (let i = 0; i < 30 * S.len; i++) attempt(S, false);
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0]) seed(S);
  for (const f of S.flashes) f.life -= d / 0.15;
  S.flashes = S.flashes.filter((f) => f.life > 0 && f.k < S.n);
  if (S.swing) {
    S.swing.t += d / S.swing.T;
    if (S.swing.t >= 1) S.swing = null;
    return;
  }
  // Length: 30 steps a second toward the knob, with no tries meanwhile
  // unless both ends are boxed in and only a pivot can free them.
  if (S.n !== S.len) {
    S.grow += d * 30;
    let stuck = false;
    while (S.grow >= 1 && S.n !== S.len) {
      S.grow -= 1;
      if (S.n > S.len) trimOne(S);
      else if (!growOne(S)) {
        stuck = true;
        break;
      }
    }
    if (!stuck) {
      S.acc = 0;
      return;
    }
  } else S.grow = 0;
  S.acc += d * 14 * S.speed;
  while (S.acc >= 1 && !S.swing) {
    S.acc -= 1;
    attempt(S, true);
  }
  if (S.swing) S.acc = 0;
}

const ease = (t) => t * t * (3 - 2 * t);

// Where every site is drawn this frame, in LEDs.
function positions(S) {
  const { xs, ys, px, py, n, swing } = S;
  if (!swing) {
    for (let i = 0; i <= n; i++) {
      px[i] = xs[i] * STEP + 2;
      py[i] = ys[i] * STEP + 2;
    }
    return 1;
  }
  // Every site from where it was: the resting side only slides with the
  // shift that keeps the walk on the panel, the moved side turns about the
  // pivot as well.
  const e = ease(cl(swing.t, 0, 1)), ox = swing.ox, oy = swing.oy, cx = ox[swing.k], cy = oy[swing.k];
  const tx = swing.sx * e * STEP, ty = swing.sy * e * STEP;
  for (let i = 0; i <= n; i++) {
    px[i] = ox[i] * STEP + 2 + tx;
    py[i] = oy[i] * STEP + 2 + ty;
  }
  let fold = 1;
  if (swing.g < 3) {
    const a = ANG[swing.g] * e, c = cos(a), s = sin(a);
    for (let i = swing.lo; i <= swing.hi; i++) {
      const dx = (ox[i] - cx) * STEP, dy = (oy[i] - cy) * STEP;
      px[i] = cx * STEP + 2 + tx + c * dx - s * dy;
      py[i] = cy * STEP + 2 + ty + s * dx + c * dy;
    }
  } else {
    // A fold: the part across the axis shrinks through zero and opens on
    // the other side, as if the arm turned over out of the panel.
    const [ax, ay] = AXIS[swing.g], f = cos(PI * e);
    fold = 0.55 + 0.45 * abs(f);
    for (let i = swing.lo; i <= swing.hi; i++) {
      const dx = (ox[i] - cx) * STEP, dy = (oy[i] - cy) * STEP;
      const along = dx * ax + dy * ay, across = (dx * -ay + dy * ax) * f;
      px[i] = cx * STEP + 2 + tx + along * ax - across * ay;
      py[i] = cy * STEP + 2 + ty + along * ay + across * ax;
    }
  }
  return fold;
}

// One bond as a 2-LED line with a dim glow 2 LEDs out, its colour taken
// from the gradient at each LED's place along the chain.
function bond(S, i, moving, bright) {
  const { px, py, lut, n } = S, x0 = px[i], y0 = py[i], x1 = px[i + 1], y1 = py[i + 1];
  const ex = x1 - x0, ey = y1 - y0, L2 = ex * ex + ey * ey || 1, R = 3.2;
  const xa = max(0, floor(min(x0, x1) - R)), xb = min(W - 1, floor(max(x0, x1) + R));
  const ya = max(0, floor(min(y0, y1) - R)), yb = min(H - 1, floor(max(y0, y1) + R));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5 - x0, qy = y + 0.5 - y0, u = cl((qx * ex + qy * ey) / L2, 0, 1);
      const dx = qx - u * ex, dy = qy - u * ey, dd = sqrt(dx * dx + dy * dy);
      if (dd >= R) continue;
      const cov = cl(1.5 - dd, 0, 1), glow = 0.18 * cl(1 - (dd - 1.2) / 1.8, 0, 1);
      const c = 3 * min(255, floor(((i + u) / n) * 255.99)), p = y * W + x;
      if (moving) {
        if (cov <= S.covB[p]) continue;
        S.covB[p] = cov;
        S.rgbB[3 * p] = lut[c] * bright;
        S.rgbB[3 * p + 1] = lut[c + 1] * bright;
        S.rgbB[3 * p + 2] = lut[c + 2] * bright;
      } else {
        const key = cov > 0 ? 1 + cov : glow;
        if (key <= S.keyA[p]) continue;
        S.keyA[p] = key;
        const v = cov > 0 ? cov : glow;
        S.rgbA[3 * p] = lut[c] * v;
        S.rgbA[3 * p + 1] = lut[c + 1] * v;
        S.rgbA[3 * p + 2] = lut[c + 2] * v;
      }
    }
}

// A round dot: white core of radius r, edge of the given colour.
function bead(S, x0, y0, r, wr, wg, wb, a) {
  for (let y = max(0, floor(y0 - r - 1)); y <= min(H - 1, floor(y0 + r + 1)); y++)
    for (let x = max(0, floor(x0 - r - 1)); x <= min(W - 1, floor(x0 + r + 1)); x++) {
      const dd = sqrt((x + 0.5 - x0) ** 2 + (y + 0.5 - y0) ** 2), c = cl(r + 0.5 - dd, 0, 1) * a, p = y * W + x;
      if (c <= 0) continue;
      const o = 3 * p, bA = S.covB[p];
      // Beads sit on top of both layers: write the moving layer.
      S.rgbB[o] = S.rgbB[o] * bA * (1 - c) + wr * c;
      S.rgbB[o + 1] = S.rgbB[o + 1] * bA * (1 - c) + wg * c;
      S.rgbB[o + 2] = S.rgbB[o + 2] * bA * (1 - c) + wb * c;
      const nb = 1 - (1 - bA) * (1 - c);
      if (nb > 0) {
        S.rgbB[o] /= nb;
        S.rgbB[o + 1] /= nb;
        S.rgbB[o + 2] /= nb;
      }
      S.covB[p] = nb;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  if (S.lutHue !== S.hue) {
    for (let i = 0; i < 256; i++) {
      const t = i / 255, h = S.hue + HUE0 + SPAN * t, hf = h - floor(h);
      // Pure blue reads dim beside the rest: a little white in it.
      const blue = max(0, 1 - abs(hf - 0.66) / 0.08);
      hsv(h, 0.92 - 0.25 * blue, 1, S.lut, 3 * i);
    }
    S.lutHue = S.hue;
  }
  const fold = positions(S), sw = S.swing, n = S.n;
  S.keyA.fill(0);
  S.rgbA.fill(0);
  S.covB.fill(0);
  S.rgbB.fill(0);
  // The bond from the pivot into the moved side turns with it.
  for (let i = 0; i < n; i++) {
    const moving = sw && ((sw.lo > sw.k && i >= sw.k) || (sw.lo < sw.k && i < sw.k));
    if (!moving) bond(S, i, false, 1);
  }
  if (sw) {
    const lift = 1 + 0.25 * sin(PI * cl(sw.t, 0, 1));
    for (let i = 0; i < n; i++)
      if ((sw.lo > sw.k && i >= sw.k) || (sw.lo < sw.k && i < sw.k)) bond(S, i, true, fold * lift);
  }
  const { px, py } = S;
  bead(S, px[0], py[0], 1.9, 1, 1, 1, 1);
  bead(S, px[n], py[n], 1.9, 1, 1, 1, 1);
  if (sw) bead(S, px[sw.k], py[sw.k], 1.2, 1, 1, 1, 0.9 * sin(PI * cl(sw.t, 0, 1)));
  for (const f of S.flashes) bead(S, px[f.k], py[f.k], 1.1, 1, 1, 1, 0.85 * f.life);
  const { rgbA, rgbB, covB } = S;
  for (let p = 0, o = 0; p < W * H; p++, o += 3) {
    const a = covB[p];
    let r = rgbA[o], g = rgbA[o + 1], b = rgbA[o + 2];
    if (a > 0) {
      r = r * (1 - a) + min(1, rgbB[o]) * a;
      g = g * (1 - a) + min(1, rgbB[o + 1]) * a;
      b = b * (1 - a) + min(1, rgbB[o + 2]) * a;
    }
    display.setPixel(p % W, (p / W) | 0, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
  }
}
