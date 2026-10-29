// ===== Patternflow pattern =====
// Title:   Ammann-Beenker
// Family:  geometry
// Idea:    An eightfold aperiodic tiling of squares and 45 degree rhombi, made from four families of parallel lines, slides in its hidden perpendicular space, and every so often a row of hexagons across the panel flips at once, the square and two rhombi in each sliding round to swap places and flaring white before they settle.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ammann-Beenker tiling (Robert Ammann, 1977; Frans Beenker, 1982), built as the dual of a tetragrid after Nicolaas de Bruijn's pentagrids (1981), with its phason flips, pattern round 64
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Phason=0.2..3, Size=8..16, Glow=0..1
//
// Knob 1: Hue. Turns the squares and the rhombi round the colour wheel together; at 0 the squares are deep blue and the rhombi gold.
// Knob 2: Phason. How fast the grids slide in perpendicular space: at 2 a row of hexagons flips about twice a second, at 0.2 once in six seconds, at 3 three times a second.
// Knob 3: Size. The tile edge in LEDs, 8 to 16: at 8 a star of eight rhombi is 30 LEDs across, at 16 one star fills the width of the panel.
// Knob 4: Glow. How much of the light belongs to the flips: at 0 the tiles burn at full strength and a flip glows for a second, at 1 the tiles stand dim and each flipped row stays lit for four seconds, a trace of where the phason has passed.

const W = 64, H = 128, N = W * H, CX = 31.5, CY = 63.5;
const { floor, ceil, cos, sin, exp, min, max, abs, hypot, SQRT1_2: R } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The four grid directions, 45 degrees apart, which are also the tile edges,
// and the same four turned three times as far: shifting the grids along
// those moves the tiling in perpendicular space only. It carries the picture
// nowhere; it only flips tiles.
const E = [[1, 0], [R, R], [0, 1], [-R, R]];
const EP = [[1, 0], [-R, R], [0, -1], [R, R]];
// Each pair of families crosses in tiles: 0-2 and 1-3 make the squares, the
// other four pairs the 45 degree rhombi in their four turns.
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const OTHER = [[2, 3], [1, 3], [1, 2], [0, 3], [0, 2], [0, 1]];
// Where the grids start, a generic shift so that no three lines meet, and
// the way the shift drifts in perpendicular space. Each family runs along a
// diagonal of the square grid the two others make (e1 lies along e0 + e2),
// so a line that reaches one crossing of that grid reaches every crossing on
// the same diagonal in the same instant: the flips come in rows across the
// panel, a hexagon of one square and two rhombi turning over at each.
const G0 = [0.137, 0.291, 0.443, 0.619];
const DIR = [cos(1.17), sin(1.17)];
// The middle of the panel: where the tiling's corners sit on average.
const OX = -(G0[0] + G0[1] * R - G0[3] * R) + 0.5, OY = -(G0[1] * R + G0[2] + G0[3] * R) + 0.5 + R;
// A flip slides its three tiles for SLIDE seconds.
const SLIDE = 0.45;
const LIGHT = [255, 238, 200];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = c[0] * 255;
  out[o + 1] = c[1] * 255;
  out[o + 2] = c[2] * 255;
}

export function setup(params) {
  params.ab = { t: 0, u: 0, frame: 0, size: 8, tiles: new Map(), list: [], buf: new Float32Array(N * 3), col: new Float32Array(6 * 3) };
}

// Every crossing of two grid lines near the panel is a tile, named by its
// two families and two line numbers, a name it keeps while the grids slide.
// Its corner is the sum of the strip numbers it lies in, one per family
// (Nicolaas de Bruijn's construction). When the grids have slid so that a
// line of the third family has passed the crossing, the corner jumps by one
// edge: the tile has flipped.
function tile(A) {
  const g = [0, 0, 0, 0], s = A.size;
  for (let i = 0; i < 4; i++) g[i] = G0[i] + A.u * (DIR[0] * EP[i][0] + DIR[1] * EP[i][1]);
  // Corners lie near twice their crossing, so the crossings needed lie
  // within half the panel, counted in edges, plus a margin.
  const hx = (W / 2 / s + 2.5) / 2, hy = (H / 2 / s + 2.5) / 2;
  const frame = ++A.frame, T = A.tiles, list = (A.list = []);
  for (let q = 0; q < 6; q++) {
    const [j, k] = PAIRS[q], ej = E[j], ek = E[k], det = ej[0] * ek[1] - ej[1] * ek[0];
    const rj = hx * abs(ej[0]) + hy * abs(ej[1]), rk = hx * abs(ek[0]) + hy * abs(ek[1]);
    for (let mj = floor(-rj - g[j]); mj <= ceil(rj - g[j]); mj++)
      for (let mk = floor(-rk - g[k]); mk <= ceil(rk - g[k]); mk++) {
        const bj = mj + g[j], bk = mk + g[k];
        const px = (bj * ek[1] - bk * ej[1]) / det, py = (ej[0] * bk - ek[0] * bj) / det;
        if (abs(px) > hx || abs(py) > hy) continue;
        let vx = mj * ej[0] + mk * ek[0] - OX, vy = mj * ej[1] + mk * ek[1] - OY;
        for (const i of OTHER[q]) {
          const K = ceil(px * E[i][0] + py * E[i][1] - g[i]);
          vx += K * E[i][0];
          vy += K * E[i][1];
        }
        const id = (q * 4096 + (mj & 4095)) * 4096 + (mk & 4095);
        let t = T.get(id);
        if (!t) T.set(id, (t = { q, vx, vy, fx: vx, fy: vy, ft: -99, seen: 0 }));
        else if (t.seen === frame - 1 && (abs(t.vx - vx) > 1e-6 || abs(t.vy - vy) > 1e-6)) {
          // Slide from wherever it was drawn last.
          const [dx, dy] = drawn(t, A.t);
          t.fx = dx;
          t.fy = dy;
          t.ft = A.t;
        }
        t.vx = vx;
        t.vy = vy;
        t.seen = frame;
        list.push(t);
      }
  }
  if (frame % 60 === 0) for (const [id, t] of T) if (t.seen < frame - 30) T.delete(id);
}

function drawn(t, now) {
  const a = cl((now - t.ft) / SLIDE, 0, 1), e = 1 - a * a * (3 - 2 * a);
  return [t.vx + (t.fx - t.vx) * e, t.vy + (t.fy - t.vy) * e];
}

export function update(dt, input, params) {
  if (!params.ab) setup(params);
  const A = params.ab, k = input.knobValues || [0, 2, 8, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  A.hue = k[0];
  A.size = cl(k[2], 8, 16);
  A.glow = cl(k[3], 0, 1);
  A.t += dt;
  A.u += dt * cl(k[1], 0.2, 3) * 0.016;
  tile(A);
}

// One tile onto the LEDs: a parallelogram at (ax, ay) on edges u and w in
// colour (r, g, b). LEDs within half an LED of its edges stay dark, so the
// tiles sit apart by a dark joint one LED wide.
function para(buf, ax, ay, ux, uy, wx, wy, r, g, b) {
  const det = ux * wy - uy * wx, hu = abs(det) / hypot(wx, wy), hw = abs(det) / hypot(ux, uy);
  const x0 = max(0, floor(min(ax, ax + ux, ax + wx, ax + ux + wx))), x1 = min(W - 1, ceil(max(ax, ax + ux, ax + wx, ax + ux + wx)));
  const y0 = max(0, floor(min(ay, ay + uy, ay + wy, ay + uy + wy))), y1 = min(H - 1, ceil(max(ay, ay + uy, ay + wy, ay + uy + wy)));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - ax, dy = y - ay;
      const a = (dx * wy - dy * wx) / det, c = (ux * dy - uy * dx) / det;
      if (a < 0 || a > 1 || c < 0 || c > 1) continue;
      const m = cl((min(min(a, 1 - a) * hu, min(c, 1 - c) * hw) - 0.35) * 2, 0, 1), p = (y * W + x) * 3;
      buf[p] = r * m;
      buf[p + 1] = g * m;
      buf[p + 2] = b * m;
    }
}

export function draw(display, params) {
  const A = params.ab;
  if (!A || !A.list.length) return;
  const buf = A.buf, col = A.col, s = A.size, now = A.t;
  buf.fill(0);
  // Squares deep blue and rhombi gold at Hue 0, each turn of a tile a little
  // lighter or darker. Glow dims the tiles at rest and lengthens the light
  // a flip leaves.
  const rest = 1 - 0.62 * A.glow, fade = 0.7 + 3.3 * A.glow;
  for (let q = 0; q < 6; q++) {
    const c = q === 1 ? [0.6, 0.85, 0.62] : q === 4 ? [0.6, 0.8, 0.9] : [0.11, 0.9, [1, 0, 0.86, 0.93, 0, 0.8][q]];
    hsv(A.hue + c[0], c[1], c[2], col, q * 3);
  }
  // Tiles at rest first, then the sliding ones over the dark hexagon they
  // leave, so they never hide behind a neighbour.
  const moving = [];
  for (const t of A.list) {
    if (now - t.ft < SLIDE) moving.push(t);
    else put(buf, col, t, t.vx, t.vy, s, rest, 0.75 * exp(-(now - t.ft - SLIDE) / fade));
  }
  for (const t of moving) {
    const [vx, vy] = drawn(t, now);
    put(buf, col, t, vx, vy, s, 1, 0.75);
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}

// A tile in its colour at brightness v, whitened by lift: the light of a flip.
function put(buf, col, t, vx, vy, s, v, lift) {
  const [j, k] = PAIRS[t.q], c = t.q * 3;
  const r = col[c] * v, g = col[c + 1] * v, b = col[c + 2] * v;
  para(buf, CX + vx * s, CY + vy * s, E[j][0] * s, E[j][1] * s, E[k][0] * s, E[k][1] * s, r + (LIGHT[0] - r) * lift, g + (LIGHT[1] - g) * lift, b + (LIGHT[2] - b) * lift);
}
