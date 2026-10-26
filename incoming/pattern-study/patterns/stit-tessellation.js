// ===== Patternflow pattern =====
// Title:   STIT Tessellation
// Family:  cells
// Idea:    The panel starts as one cell, and as in Nagel and Weiss's STIT process every cell waits an exponential time at a rate of its perimeter over pi before a random line among those that hit it cuts it in two, so each new segment flashes white and ends on older ones in T junctions, never crossing them; once the cells reach their density the view dives toward a slowly wandering point while the cutting runs on for just the time that restores the same law, since the tessellation at time t scaled by t is the one at time 1, and cells that leave the panel are dropped.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: STIT tessellations (Werner Nagel and Viola Weiss, 2005)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Axes=0..1, Cells=0..1
//
// Knob 1: Hue. Turns the palette round the wheel. A cut gives its two halves the parent's colour stepped 0.05 to 0.1 round the wheel in opposite directions, one lighter and one darker, kept within 0.34 of the centre, so the oldest lines part families of colour. At 0 the centre is blue and the cells run from lime through cyan and violet to rose; at 0.5 the centre is orange.
// Knob 2: Speed. At 2 the first cells reach their density in 1.5 s; then the view closes in by e^0.24 a second, twice as close every 2.9 s, and about 18 cuts land a second. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Axes. The share of the cutting lines that run along the two axes instead of in a uniform direction. At 0 the isotropic STIT; at 1 every line is horizontal or vertical and the cells are rectangles, the Mondrian process (Daniel Roy and Yee Whye Teh, 2008). Between the two a mix, still a STIT.
// Knob 4: Cells. The scale of the dive, which keeps the panel looking at the process at time 1/kappa in LED units, 1 + 384/(pi kappa) + 8192/(pi kappa^2) cells on average: 42 at 0, 46 at the opening, 89 at 0.5, 194 at 1.
// Buttons: K1 tap starts over from one cell: the dive pauses while the STIT grows again from time zero.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, exp, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Edge times: the panel's border is never drawn.
const BORDER = -1e9;

// A cell is a convex polygon in LED units: corners x, y and for each edge,
// from corner i to i + 1, the time it was cut. clk is the exponential mass
// left on its clock; hv and lv its colour.
function props(c) {
  const x = c.x, y = c.y, n = x.length;
  let a = 0, p = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    a += x[i] * y[j] - x[j] * y[i];
    p += sqrt((x[j] - x[i]) ** 2 + (y[j] - y[i]) ** 2);
    if (x[i] < x0) x0 = x[i];
    if (x[i] > x1) x1 = x[i];
    if (y[i] < y0) y0 = y[i];
    if (y[i] > y1) y1 = y[i];
  }
  c.area = abs(a) / 2;
  c.per = p;
  c.x0 = x0;
  c.x1 = x1;
  c.y0 = y0;
  c.y1 = y1;
  return c;
}

const windowCell = () => props({ x: [0, W, W, 0], y: [0, 0, H, H], t: [BORDER, BORDER, BORDER, BORDER], clk: 0, hv: 0, lv: 0 });

// The part of cell c where nx x + ny y <= p, or null. The cut edge carries
// time tc; edges cut short keep their own.
function half(c, nx, ny, p, tc) {
  const x = c.x, y = c.y, t = c.t, n = x.length, ox = [], oy = [], ot = [];
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    const si = nx * x[i] + ny * y[i] - p, sj = nx * x[j] + ny * y[j] - p;
    if (si <= 0) {
      ox.push(x[i]);
      oy.push(y[i]);
      ot.push(t[i]);
    }
    if ((si < 0 && sj > 0) || (si > 0 && sj < 0)) {
      const f = si / (si - sj);
      ox.push(x[i] + f * (x[j] - x[i]));
      oy.push(y[i] + f * (y[j] - y[i]));
      ot.push(si < 0 ? tc : t[i]);
    }
  }
  if (ox.length < 3) return null;
  const o = props({ x: ox, y: oy, t: ot, clk: c.clk, hv: c.hv, lv: c.lv });
  return o.area > 1e-6 ? o : null;
}

// The rate at which a cell is cut, the measure of the lines that hit it:
// lines in a uniform direction with weight 1 - m give perimeter / pi by
// Cauchy's formula, lines along the two axes with weight m give half the
// width plus half the height.
const rate = (c, m) => ((1 - m) * c.per) / PI + (m * (c.x1 - c.x0 + c.y1 - c.y0)) / 2;

// A line from that measure among the lines that hit c, as nx x + ny y = p.
function cutLine(c, m, L) {
  const bw = c.x1 - c.x0, bh = c.y1 - c.y0;
  if (Math.random() * rate(c, m) < (m * (bw + bh)) / 2) {
    if (Math.random() * (bw + bh) < bw) (L[0] = 1), (L[1] = 0), (L[2] = c.x0 + Math.random() * bw);
    else (L[0] = 0), (L[1] = 1), (L[2] = c.y0 + Math.random() * bh);
    return;
  }
  // Uniform direction, uniform offset across the cell's bounding circle,
  // kept when the line meets the cell.
  const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, r = sqrt(bw * bw + bh * bh) / 2;
  for (;;) {
    const th = Math.random() * PI, nx = cos(th), ny = sin(th), p = nx * cx + ny * cy + (2 * Math.random() - 1) * r;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < c.x.length; i++) {
      const s = nx * c.x[i] + ny * c.y[i];
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
    if (p > lo && p < hi) {
      L[0] = nx;
      L[1] = ny;
      L[2] = p;
      return;
    }
  }
}

const clock = () => -log(1 - Math.random());
// Folds v back into -r..r.
const refl = (v, r) => (v > r ? 2 * r - v : v < -r ? -2 * r - v : v);

function split(S, k, tc) {
  const c = S.cells[k], L = S.L;
  cutLine(c, S.m, L);
  const a = half(c, L[0], L[1], L[2], tc), b = half(c, -L[0], -L[1], -L[2], tc);
  if (!a || !b) return;
  a.clk = clock();
  b.clk = clock();
  // The two halves take their parent's colour, one a step one way round
  // the wheel and lighter or darker, the other the opposite step.
  const dh = (Math.random() < 0.5 ? 1 : -1) * (0.05 + 0.05 * Math.random()), dl = Math.random() < 0.5 ? 0.1 : -0.1;
  a.hv = refl(c.hv + dh, 0.34);
  b.hv = refl(c.hv - dh, 0.34);
  a.lv = refl(c.lv + dl, 0.2);
  b.lv = refl(c.lv - dl, 0.2);
  S.cells[k] = a;
  S.cells.push(b);
  S.splits++;
}

export function setup(params) {
  params.s = { time: 0, hue: 0, m: 0, kap: 9, T: 0, cells: [windowCell()], splits: 0, L: [0, 0, 0], c: [0, 0, 0], zx: W / 2, zy: H / 2, ph: 0, seen: new Uint8Array(W * H) };
  params.s.cells[0].clk = clock();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.m = cl(k[2], 0, 1);
  S.kap = 9.6 * 0.4167 ** cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) {
    S.cells = [windowCell()];
    S.cells[0].clk = clock();
    S.T = 0;
  }
  const tau = d * cl(k[1], 0.2, 3);
  S.time += d;
  S.ph += tau;
  // In LED units the panel shows the process at time 1/kappa. From one
  // cell it first runs up to that time, in 1.5 s at Speed 2. Then the dive:
  // the view closes in by z on a point that wanders slowly, and the process
  // runs on for the time that brings it back to the same law, because Y(t)
  // scaled by t has the law of Y(1). STIT's restriction to a window is a
  // STIT in that window, so the cells can be clipped to the panel and the
  // ones that leave it dropped.
  let z = 1, dlt;
  if (S.T < 1 / S.kap) {
    dlt = min(1 / S.kap - S.T, tau / (3 * S.kap));
    S.T += dlt;
  } else {
    z = exp(0.12 * tau);
    dlt = (1 - 1 / z) / S.kap;
  }
  S.zx = W / 2 + 14 * sin(0.21 * S.ph);
  S.zy = H / 2 + 34 * sin(0.13 * S.ph + 1);
  const cells = S.cells, out = [];
  for (let i = 0; i < cells.length; i++) {
    let c = cells[i];
    if (z !== 1) {
      for (let v = 0; v < c.x.length; v++) {
        c.x[v] = S.zx + z * (c.x[v] - S.zx);
        c.y[v] = S.zy + z * (c.y[v] - S.zy);
      }
      props(c);
      if (c.x1 <= 0 || c.x0 >= W || c.y1 <= 0 || c.y0 >= H) continue;
      if (c.x0 < 0) c = half(c, -1, 0, 0, BORDER);
      if (c && c.x1 > W) c = half(c, 1, 0, W, BORDER);
      if (c && c.y0 < 0) c = half(c, 0, -1, 0, BORDER);
      if (c && c.y1 > H) c = half(c, 0, 1, H, BORDER);
    }
    if (c) out.push(c);
  }
  S.cells = out;
  // Each cell's clock runs at its rate; when it runs out the cell is cut.
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const c = out[i];
    c.clk -= rate(c, S.m) * dlt;
    if (c.clk <= 0) split(S, i, S.time);
  }
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const seen = S.seen, c = S.c, now = S.time, ex = [], ey = [], ed = [], et = [];
  seen.fill(0);
  for (const cell of S.cells) {
    hsv(S.hue + 0.62 + cell.hv, 0.7, 0.78 + cell.lv, c);
    const r = c[0], g = c[1], b = c[2];
    // The drawn edges: unit normal, offset and the time of the cut.
    const x = cell.x, y = cell.y, t = cell.t, n = x.length;
    ex.length = ey.length = ed.length = et.length = 0;
    for (let i = 0; i < n; i++) {
      if (t[i] === BORDER) continue;
      const j = i + 1 === n ? 0 : i + 1, dx = x[j] - x[i], dy = y[j] - y[i], l = sqrt(dx * dx + dy * dy) || 1;
      ex.push(-dy / l);
      ey.push(dx / l);
      ed.push((-dy * x[i] + dx * y[i]) / l);
      et.push(t[i]);
    }
    // Fill the LEDs whose centres the cell holds, row by row, with a dark
    // line where a centre lies within 0.62 LED of an edge, flashing white
    // for half a second after the cut.
    const j0 = max(0, Math.ceil(cell.y0 - 0.5)), j1 = min(H - 1, floor(cell.y1 - 0.5));
    for (let row = j0; row <= j1; row++) {
      const yc = row + 0.5;
      let xl = 1e9, xr = -1e9;
      for (let i = 0; i < n; i++) {
        const j = i + 1 === n ? 0 : i + 1;
        if ((y[i] - yc) * (y[j] - yc) > 0 || y[i] === y[j]) continue;
        const xx = x[i] + ((yc - y[i]) / (y[j] - y[i])) * (x[j] - x[i]);
        if (xx < xl) xl = xx;
        if (xx > xr) xr = xx;
      }
      const i0 = max(0, Math.ceil(xl - 0.5)), i1 = min(W - 1, Math.ceil(xr - 0.5) - 1);
      for (let col = i0; col <= i1; col++) {
        const p = row * W + col;
        if (seen[p]) continue;
        seen[p] = 1;
        const xc = col + 0.5;
        let dm = 9, tm = BORDER;
        for (let e = 0; e < ex.length; e++) {
          const dd = abs(ex[e] * xc + ey[e] * yc - ed[e]);
          if (dd < dm) (dm = dd), (tm = et[e]);
        }
        const w = cl((0.62 - dm) / 0.3, 0, 1), f = exp(-(now - tm) / 0.5) * 255;
        display.setPixel(col, row, (r + w * (f - r)) | 0, (g + w * (f - g)) | 0, (b + w * (f - b)) | 0);
      }
    }
  }
  for (let p = 0; p < W * H; p++) if (!seen[p]) display.setPixel(p % W, (p / W) | 0, 0, 0, 0);
}
