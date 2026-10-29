// ===== Patternflow pattern =====
// Title:   Ink Traps
// Family:  type
// Idea:    Each sheet of newsprint is printed with one capital or figure twice, the upper one with ink traps cut into its joints and the lower one as drawn, and the ink then soaks out from the strokes into the paper, furthest where two strokes meet at a sharp angle, so the plain letter's crotches fill and its counters close while the trapped letter's notches fill back to the joints as they were drawn; then the sheet feeds up and the next letter is printed.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ink traps as Matthew Carter cut them into Bell Centennial, drawn for AT&T's telephone directories at 6 point on newsprint and released by Mergenthaler Linotype in 1978; the wicking front that advances as the square root of time (Edward W. Washburn, 1921); pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Letters=0..2, Spread=-1..1
//
// Knob 1: Hue. The colour of the paper, the ink staying black: telephone-directory yellow (182, 164, 69) at 0, green at 0.25, blue at 0.5, pink at 0.75.
// Knob 2: Speed. At 2 a sheet takes 6.4 s: the ink soaks for 3 s, its edge moving out as the square root of the time, the sheet holds 2.6 s and feeds up in 0.8 s. At 0.2 a sheet takes 64 s, at 3 it takes 4.3 s.
// Knob 3: Letters. Which letters come round: 0 M, W, N and V (3, 3, 2 and 1 traps), 1 K, A, X, Y and Z, 2 the figures 4, 7 and 1. A new set feeds a fresh sheet at once.
// Knob 4: Spread. How far the ink soaks. At the opening 0.06 the edge of a stroke moves out 1.5 LEDs, the spread the traps are cut for: every trapped joint prints within a LED of where it was drawn and the plain M's joints fill 6 to 12 LEDs out. At -1 the edge moves 0.5 LED, the plain M's joints fill 3 to 6 LEDs and the traps stay open as notches 4 to 8 LEDs deep. From 0.5 (2.1 LEDs) the traps fill shut and both letters clog alike, and at 1 (2.7 to 3 LEDs) the M's sharpest joints fill 20 LEDs out. Turning it down feeds a fresh sheet.

// Bell Centennial (Matthew Carter for AT&T, 1978) was cut for 6 point type
// printed fast on newsprint. Ink spreads into newsprint, and where two
// strokes meet at a sharp angle the paper between them is near ink on both
// sides, so the joint fills first and the letter clogs. Carter cut notches
// into those joints, ink traps, so that the spreading ink fills the notch
// and the joint comes out the way it was drawn. At display size the traps
// show; at 6 point they fill.
//
// Here the panel is a magnifier, and the letters are plain straight-sided
// capitals drawn for it, not Bell Centennial's own. The ink is a
// concentration that diffuses into the paper, faster along the fibres,
// which lie along the rows, and the paper turns dark wherever the
// concentration passes 0.12. The variance of
// the spread grows in proportion to the time, so the edge of a stroke moves
// out as the square root of the time, the way a liquid wicks into a porous
// sheet (Washburn, 1921). A straight edge moves out about 1.18 standard
// deviations; a sharp corner fills further, since both strokes feed it.
//
// Each trap is the joint's own wedge pushed back into the ink by
// D = 1.6 * (edge advance) / sin(half the angle), its sides then running
// back to the drawn edges over the same length D. If every edge moved out
// by the same distance, a factor of 1 would print the joint exactly where
// it was drawn. Diffusion fills a sharp corner further than that, and 1.6
// was found by printing the eleven joints of M, W, N and A at the opening
// spread: at 1 every trap fills shut and the joint prints like the plain
// one, 12 LEDs out on the M; at 1.4 some print within 1.5 LEDs and some
// fill shut; at 1.6 all eleven print within a LED of the drawn vertex,
// against 3.4 to 13.3 LEDs out for the plain letter; at 1.8 the notches
// stay open 1 to 4 LEDs deep.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sin, cos, tan, exp, round, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The letters, drawn as convex pieces in a box 50 LEDs wide and 58
// tall, x to the right and y down: R is a rectangle, P any convex polygon.
const GW = 50, GH = 58, GX = 7, GY = [2, 68];
const P = (...c) => {
  const p = [];
  for (let i = 0; i < c.length; i += 2) p.push([c[i], c[i + 1]]);
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length];
    a += x0 * y1 - x1 * y0;
  }
  return { p, o: a > 0 ? 1 : -1 };
};
const R = (x0, y0, x1, y1) => P(x0, y0, x1, y0, x1, y1, x0, y1);
const GLYPHS = {
  M: [R(0, 0, 10, 58), R(40, 0, 50, 58), P(0, 0, 11, 0, 30.5, 50, 19.5, 50), P(39, 0, 50, 0, 30.5, 50, 19.5, 50)],
  W: [P(0, 0, 9, 0, 17.5, 58, 8.5, 58), P(20.5, 0, 29.5, 0, 17.5, 58, 8.5, 58), P(20.5, 0, 29.5, 0, 41.5, 58, 32.5, 58), P(41, 0, 50, 0, 41.5, 58, 32.5, 58)],
  N: [R(0, 0, 10, 58), R(40, 0, 50, 58), P(0, 0, 12, 0, 50, 58, 38, 58)],
  V: [P(0, 0, 11, 0, 30.5, 58, 19.5, 58), P(39, 0, 50, 0, 30.5, 58, 19.5, 58)],
  K: [R(0, 0, 10, 58), P(36, 0, 50, 0, 6, 41, 6, 28.5), P(13, 24, 24, 24, 50, 58, 37, 58)],
  A: [P(19.5, 0, 30.5, 0, 11, 58, 0, 58), P(19.5, 0, 30.5, 0, 50, 58, 39, 58), R(9, 36, 41, 44)],
  X: [P(0, 0, 11, 0, 50, 58, 39, 58), P(39, 0, 50, 0, 11, 58, 0, 58)],
  Y: [P(0, 0, 11, 0, 30, 32, 20, 32), P(39, 0, 50, 0, 30, 32, 20, 32), R(20, 30, 30, 58)],
  Z: [R(0, 0, 50, 10), R(0, 48, 50, 58), P(36, 10, 50, 10, 14, 48, 0, 48)],
  4: [R(31, 0, 41, 58), P(28, 0, 41, 0, 13, 37, 0, 37), R(0, 35, 50, 44)],
  7: [R(0, 0, 50, 10), P(43, 0, 55, 0, 26, 58, 14, 58)],
  1: [R(26, 0, 37, 58), P(31, 0, 31, 11, 13, 22, 9, 15)],
};
const SETS = [["M", "W", "N", "V"], ["K", "A", "X", "Y", "Z"], ["4", "7", "1"]];

function inPoly(q, x, y) {
  const p = q.p, n = p.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % n];
    if (q.o * ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)) < -1e-9) return false;
  }
  return true;
}
function ink(g, x, y) {
  if (x < 0 || x > GW || y < 0 || y > GH) return false;
  for (const q of g) if (inPoly(q, x, y)) return true;
  return false;
}

// The joints: where an edge of one piece crosses an edge of another on the
// outline of the letter and the paper between them is a wedge narrower than
// 84 degrees.
function crotches(g) {
  const out = [];
  for (let i = 0; i < g.length; i++)
    for (let j = i + 1; j < g.length; j++)
      for (let a = 0; a < g[i].p.length; a++)
        for (let b = 0; b < g[j].p.length; b++) {
          const [ax, ay] = g[i].p[a], [ax1, ay1] = g[i].p[(a + 1) % g[i].p.length];
          const [bx, by] = g[j].p[b], [bx1, by1] = g[j].p[(b + 1) % g[j].p.length];
          const dax = ax1 - ax, day = ay1 - ay, dbx = bx1 - bx, dby = by1 - by;
          const den = dax * dby - day * dbx;
          if (abs(den) < 1e-9) continue;
          const t = ((bx - ax) * dby - (by - ay) * dbx) / den, s = ((bx - ax) * day - (by - ay) * dax) / den;
          if (t < -1e-6 || t > 1 + 1e-6 || s < -1e-6 || s > 1 + 1e-6) continue;
          const vx = ax + t * dax, vy = ay + t * day;
          if (vx < 0.5 || vx > GW - 0.5 || vy < 0.5 || vy > GH - 0.5) continue;
          let paper = 0, sx = 0, sy = 0;
          for (let k = 0; k < 96; k++) {
            const th = ((k + 0.5) / 96) * 2 * PI, cx = cos(th), cy = sin(th);
            if (!ink(g, vx + 1.5 * cx, vy + 1.5 * cy)) paper++, (sx += cx), (sy += cy);
          }
          const deg = (paper / 96) * 360;
          if (deg < 8 || deg > 84) continue;
          if (out.some((c) => abs(c.x - vx) + abs(c.y - vy) < 1.5)) continue;
          const l = hypot(sx, sy);
          out.push({ x: vx, y: vy, bx: sx / l, by: sy / l, a: (deg * PI) / 180 });
        }
  return out;
}

// ---- Paper: hash value noise, stretched along the rows the way newsprint
// fibres lie along the web.
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
const K0 = 0.16;
function makeSheet(seed) {
  const F = new Float32Array(N), kh = new Float32Array(N), kv = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) F[y * W + x] = cl(0.5 + 0.7 * (vn(x / 6, y / 1.4, seed) - 0.5) + 0.5 * (vn(x / 2.2, y / 0.9, seed + 7) - 0.5), 0, 1);
  let mh = 0, mv = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      kh[i] = x < W - 1 ? K0 * 1.15 * (0.55 + 0.45 * (F[i] + F[i + 1])) : 0;
      kv[i] = y < H - 1 ? K0 * 0.85 * (0.55 + 0.45 * (F[i] + F[i + W])) : 0;
      mh += kh[i];
      mv += kv[i];
    }
  return { F, kh, kv, step: (mh + mv) / N };
}

// ---- Timing at Speed 2, in seconds. The ink: the standard deviation of
// the spread the traps are cut for (1.28 LEDs, an edge advance of 1.5), the
// concentration at which paper turns dark, and how many standard
// deviations a straight edge moves out at that concentration.
const T_SOAK = 3, T_HOLD = 2.6, T_FEED = 0.8;
const TRAPK = 1.6, SIGN = 1.28, TAU = 0.12, ZT = 1.175;

export function setup(params) {
  const s = (params.s = {});
  s.sheets = [makeSheet(11), makeSheet(23)];
  s.u = new Float32Array(N);
  s.du = new Float32Array(N);
  s.cr = {};
  s.set = -1;
  s.li = 0;
  s.p = 0;
  s.phase = 0;
  s.age = 0;
  s.done = 0;
  s.struck = false;
}

function strike(s, ch) {
  const g = GLYPHS[ch];
  if (!s.cr[ch])
    s.cr[ch] = crotches(g).map((c) => {
      const D = (TRAPK * ZT * SIGN) / sin(c.a / 2);
      return { ...c, t: tan(c.a / 2), D, Lr: D };
    });
  const cr = s.cr[ch], u = s.u;
  u.fill(0);
  for (let half = 0; half < 2; half++) {
    const oy = GY[half];
    for (let y = 0; y < GH + 1; y++)
      for (let x = 0; x < GW + 1; x++) {
        let c = 0;
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++) {
            const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4;
            if (!ink(g, px, py)) continue;
            let trap = false;
            if (half === 0)
              for (const t of cr) {
                const dx = px - t.x, dy = py - t.y, A = dx * t.bx + dy * t.by + t.D, w = abs(dx * t.by - dy * t.bx);
                if (A > 0 && A < t.D + t.Lr && w < A * t.t - t.D * t.t * max(0, (A - t.D) / t.Lr)) {
                  trap = true;
                  break;
                }
              }
            if (!trap) c++;
          }
        const X = GX + x, Y = oy + y;
        if (X < W && Y < H) u[Y * W + X] = c / 16;
      }
  }
  s.done = 0;
  s.age = 0;
  s.struck = true;
}

function diffuse(s, f) {
  const { u, du } = s, sh = s.sheets[s.p], kh = sh.kh, kv = sh.kv;
  du.fill(0);
  for (let i = 0; i < N; i++) {
    const a = u[i];
    if (kh[i]) {
      const q = kh[i] * (u[i + 1] - a) * f;
      du[i] += q;
      du[i + 1] -= q;
    }
    if (kv[i]) {
      const q = kv[i] * (u[i + W] - a) * f;
      du[i] += q;
      du[i + W] -= q;
    }
  }
  for (let i = 0; i < N; i++) u[i] += du[i];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.hue = k[0] || 0;
  const rate = cl(k[1], 0.2, 3) / 2;
  const set = round(cl(k[2] || 0, 0, 2));
  const k4 = cl(k[3] || 0, -1, 1) - 0.06, sig = SIGN * exp(k4 * (k4 < 0 ? 1 : 0.56));
  if (!s.struck) {
    s.set = set;
    strike(s, SETS[set][0]);
  }
  if (set !== s.set && s.phase === 0) {
    s.set = set;
    s.li = -1;
    s.phase = 1;
    s.feed = 0;
  }
  if (s.phase === 0) {
    s.age += dt * rate;
    const want = sig * sig * min(1, s.age / T_SOAK), st = s.sheets[s.p].step;
    let need = want - s.done, n = 0;
    while (need > 1e-4 && n < 16) {
      const f = min(1, need / st);
      diffuse(s, f);
      s.done += f * st;
      need -= f * st;
      n++;
    }
    // A sheet soaked past what the knob now asks for cannot unsoak: feed
    // a fresh one.
    if (s.age > T_SOAK + T_HOLD || (s.age > 0.3 && sig * sig < 0.7 * s.done)) (s.phase = 1), (s.feed = 0);
  } else {
    s.feed += (dt * rate) / T_FEED;
    if (s.feed >= 1) {
      s.phase = 0;
      s.p ^= 1;
      const L = SETS[s.set];
      s.li = (s.li + 1) % L.length;
      strike(s, L[s.li]);
    }
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.struck) return;
  const paper = hsv(0.14 + s.hue, 0.62, 182), INK = [4, 4, 8];
  const e = s.phase === 1 ? s.feed * s.feed * (3 - 2 * s.feed) : 0, off = round(e * H);
  const A = s.sheets[s.p], B = s.sheets[s.p ^ 1], u = s.u;
  for (let y = 0; y < H; y++) {
    const sy = y + off, old = sy < H, row = old ? sy : sy - H, F = old ? A.F : B.F;
    const seam = s.phase === 1 && (sy === H - 1 || sy === H) ? 0.6 : 1;
    for (let x = 0; x < W; x++) {
      const i = row * W + x, f = F[i];
      const pb = (0.93 + 0.12 * (f - 0.5)) * seam;
      let d = 0;
      if (old) {
        const v = u[i] + 0.04 * (f - 0.5);
        d = cl((v - (TAU - 0.05)) / 0.1, 0, 1);
        d = d * d * (3 - 2 * d);
      }
      display.setPixel(x, y, round(paper[0] * pb * (1 - d) + INK[0] * d), round(paper[1] * pb * (1 - d) + INK[1] * d), round(paper[2] * pb * (1 - d) + INK[2] * d));
    }
  }
}
