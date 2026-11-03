// ===== Patternflow pattern =====
// Title:   Gilbert Tessellation
// Family:  cells
// Idea:    Seeds scattered over the panel all start at once, each growing a needle in both directions at one speed along its own heading, and every growing tip stops for good the moment it meets a needle already laid, with a spark at the T junction it leaves; each cell floods with glaze colour from the junction that closed it, so the panel ends cut into convex cells, holds, fades and is seeded again.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gilbert tessellation, the model of needle-shaped crystals growing from random seeds until they meet (E. N. Gilbert, Random plane networks and needle-shaped crystals, 1967), and its rectangular form with every needle horizontal or vertical; pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Seeds=40..240, Axes=0..1
//
// Knob 1: Hue. Turns the glaze round the wheel. At 0 the cells that close first are teal and the last ones blue-violet, a quarter of the wheel later, on cream cracks; at 0.5 the first are coral and the last gold-green, and the cracks turn pale blue.
// Knob 2: Speed. At 2 a tip runs 9 LEDs a second and colour floods a closed cell at 26 LEDs a second; with 40 seeds the last tip stops after about 5 s and the last cell is full at 6.5 s (8.3 s with every needle on an axis), then the panel holds 3 s and fades in 1.2 s. Everything goes as Speed / 2.
// Knob 3: Seeds. How many needles a round grows, 40 at the opening to 240. A needle whose two tips have stopped splits one cell in two, so n needles cut the panel into exactly n + 1 cells: 41 averaging about 200 LEDs at 40, 241 of about 34 at 240.
// Knob 4: Axes. Pulls every needle's heading towards the nearer axis. At 0 the headings are uniform, Gilbert's isotropic model, and the cells are convex polygons at every slant; at 0.5 every needle lies within 22.5 degrees of horizontal or vertical; at 1 they all do exactly and every cell is a rectangle, the rectangular Gilbert tessellation. Turning it re-lays the same seeds at once.
// Buttons: K1 tap scatters new seeds now.

// Every needle starts at time 0 from its seed P and grows both tips at speed
// V, so a tip is at P +- V t u until it stops. Two needles i and j whose
// lines cross at X reach it at distances a and b from their seeds. If the
// tip of i gets there later (a > b) it stops at X, but only if j's tip did
// pass X, that is, j's tip had not stopped short of b, and i's tip had not
// already stopped before a. Both of those were decided earlier in time, so
// the crossings are taken in order of their later arrival a / V and each
// is settled once: the whole round is worked out when it starts, exactly.
// The panel's edges are walls at time 0.
//
// A tip that stops on another needle leaves a T junction: the blocking
// needle runs straight on through it, and the two angles on the other side
// add up to 180 degrees. No tip is left free and no corner is wider than a
// straight angle, so every cell is convex.
//
// The needles are drawn as 8-connected lines, one LED for each step along
// their major axis, and each LED remembers when a tip first passed it. The
// LEDs no needle touches fall into 4-connected regions, which a needle
// line cannot leak through: those are the cells. A cell is closed when the
// last LED of its border is drawn, and its colour floods from there.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Seeds drawn for a round (Seeds takes the first n), tip speed and flood
// speed in LEDs a growth second, and the hold and fade in growth seconds.
const POOL = 240, V = 9, FILL = 26, HOLD = 3, FADE = 1.2;
// The walls: LED centres sit on integers.
const X0 = -0.5, X1 = W - 0.5, Y0 = -0.5, Y1 = H - 0.5;

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function seed(S) {
  S.tau = 0;
  S.px = new Float32Array(POOL);
  S.py = new Float32Array(POOL);
  S.th = new Float32Array(POOL);
  S.jit = new Float32Array(POOL * 2);
  for (let i = 0; i < POOL; i++) {
    S.px[i] = X0 + 0.5 + Math.random() * (W - 1);
    S.py[i] = Y0 + 0.5 + Math.random() * (H - 1);
    S.th[i] = Math.random() * PI;
  }
  for (let i = 0; i < POOL * 2; i++) S.jit[i] = Math.random();
  S.plan = null;
}

// Works a round out: where every tip stops, when every LED is drawn, the
// cells, when each closes and when the flood reaches each of its LEDs.
function plan(S, n, axes) {
  const ux = new Float32Array(n), uy = new Float32Array(n), px = S.px, py = S.py;
  for (let i = 0; i < n; i++) {
    const t0 = S.th[i], ax = t0 < PI / 4 ? 0 : t0 < (3 * PI) / 4 ? PI / 2 : PI;
    const th = ax + (t0 - ax) * (1 - axes);
    ux[i] = cos(th);
    uy[i] = sin(th);
  }
  // Tip 2i runs along +u, tip 2i + 1 along -u; each starts stopped at its wall.
  const stop = new Float32Array(2 * n), by = new Int32Array(2 * n).fill(-1);
  for (let k = 0; k < 2 * n; k++) {
    const i = k >> 1, s = k & 1 ? -1 : 1, dx = s * ux[i], dy = s * uy[i];
    const tx = dx > 1e-9 ? (X1 - px[i]) / dx : dx < -1e-9 ? (X0 - px[i]) / dx : 1e9;
    const ty = dy > 1e-9 ? (Y1 - py[i]) / dy : dy < -1e-9 ? (Y0 - py[i]) / dy : 1e9;
    stop[k] = min(tx, ty);
  }
  // One crossing for every pair of needles whose lines meet on the panel.
  const ev = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const cr = ux[i] * uy[j] - uy[i] * ux[j];
      if (abs(cr) < 1e-6) continue;
      const dx = px[j] - px[i], dy = py[j] - py[i];
      const al = (dx * uy[j] - dy * ux[j]) / cr, be = (dx * uy[i] - dy * ux[i]) / cr;
      const xx = px[i] + al * ux[i], yy = py[i] + al * uy[i];
      if (xx < X0 || xx > X1 || yy < Y0 || yy > Y1) continue;
      const a = abs(al), b = abs(be), ti = 2 * i + (al < 0 ? 1 : 0), tj = 2 * j + (be < 0 ? 1 : 0);
      if (a > b) ev.push(a, ti, tj, b);
      else ev.push(b, tj, ti, a);
    }
  }
  const m = ev.length / 4, order = new Int32Array(m);
  for (let e = 0; e < m; e++) order[e] = e;
  order.sort((p, q) => ev[p * 4] - ev[q * 4]);
  for (let o = 0; o < m; o++) {
    const e = order[o] * 4, a = ev[e], late = ev[e + 1], early = ev[e + 2], b = ev[e + 3];
    if (stop[late] <= a || stop[early] < b) continue;
    stop[late] = a;
    by[late] = early >> 1;
  }
  // The LEDs each tip passes, and when.
  const wt = new Float32Array(N).fill(Infinity);
  for (let k = 0; k < 2 * n; k++) {
    const i = k >> 1, s = k & 1 ? -1 : 1, dx = s * ux[i], dy = s * uy[i];
    const mj = max(abs(dx), abs(dy)), steps = round(stop[k] * mj);
    for (let st = 0; st <= steps; st++) {
      const d = st / mj, x = round(px[i] + d * dx), y = round(py[i] + d * dy);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const p = y * W + x, t = d / V;
      if (t < wt[p]) wt[p] = t;
    }
  }
  // Cells: 4-connected regions of untouched LEDs.
  const cell = new Int32Array(N).fill(-1), queue = new Int32Array(N);
  const close = [], size = [];
  const ft = new Float32Array(N).fill(Infinity);
  let nc = 0;
  for (let p0 = 0; p0 < N; p0++) {
    if (wt[p0] !== Infinity || cell[p0] >= 0) continue;
    let head = 0, tail = 0, last = 0, lastQ = -1;
    queue[tail++] = p0;
    cell[p0] = nc;
    while (head < tail) {
      const p = queue[head++], x = p % W, y = (p / W) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const q = ny * W + nx;
        if (wt[q] !== Infinity) {
          if (wt[q] > last) (last = wt[q]), (lastQ = q);
        } else if (cell[q] < 0) {
          cell[q] = nc;
          queue[tail++] = q;
        }
      }
    }
    // The flood runs out from the last border LED drawn; a cell is convex,
    // so the straight distance is the distance inside it.
    const sx = lastQ < 0 ? p0 % W : lastQ % W, sy = lastQ < 0 ? (p0 / W) | 0 : (lastQ / W) | 0;
    for (let i = 0; i < tail; i++) {
      const p = queue[i], dx = (p % W) - sx, dy = ((p / W) | 0) - sy;
      ft[p] = last + sqrt(dx * dx + dy * dy) / FILL;
    }
    close.push(last);
    size.push(tail);
    nc++;
  }
  // Each cell's place in the order of closing, 0 to 1.
  const idx = close.map((_, i) => i).sort((a, b) => close[a] - close[b]), rank = new Float32Array(nc);
  idx.forEach((c, r) => (rank[c] = nc > 1 ? r / (nc - 1) : 0));
  let end = 0;
  for (let p = 0; p < N; p++) if (ft[p] !== Infinity && ft[p] > end) end = ft[p];
  for (let k = 0; k < 2 * n; k++) end = max(end, stop[k] / V);
  return { n, axes, ux, uy, stop, by, wt, cell, ft, rank, nc, end, col: new Float32Array(nc * 3) };
}

export function setup(params) {
  params.s = { hue: 0, sp: 1, n: 40, axes: 0.06, glow: new Float32Array(N) };
  seed(params.s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 40, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.sp = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  const n = round(cl(k[2] == null ? 40 : k[2], 40, 240));
  const axes = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) seed(S);
  const P = S.plan;
  if (!P || P.n !== n || abs(P.axes - axes) > 0.004) S.plan = plan(S, n, axes);
  S.tau += d * S.sp;
  if (S.tau > S.plan.end + HOLD + FADE) {
    seed(S);
    S.plan = plan(S, n, axes);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.plan) return;
  const P = S.plan, tau = S.tau, wt = P.wt, ft = P.ft, cell = P.cell, col = P.col, glow = S.glow;
  const fade = 1 - cl((tau - P.end - HOLD) / FADE, 0, 1);
  // Cell colours: hue by the order of closing, a little light and colour of their own.
  for (let c = 0; c < P.nc; c++) {
    const j = S.jit[c % (POOL * 2)];
    hsv(S.hue + 0.47 + 0.25 * P.rank[c] + 0.04 * (j - 0.5), 0.72 - 0.12 * j, 0.5 + 0.22 * S.jit[(c * 7 + 3) % (POOL * 2)], col, c * 3);
  }
  const lc = [0, 0, 0];
  hsv(S.hue + 0.11, 0.22, 0.9, lc, 0);
  // Tip heads and junction sparks, into a glow buffer.
  glow.fill(0);
  const blob = (x, y, a, r) => {
    const x0 = max(0, floor(x - r)), x1 = min(W - 1, floor(x + r) + 1), y0 = max(0, floor(y - r)), y1 = min(H - 1, floor(y + r) + 1);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - x, dy = yy - y, w = 1 - (dx * dx + dy * dy) / (r * r);
        if (w > 0) glow[yy * W + xx] += a * w * w;
      }
  };
  const reach = tau * V;
  const head = 0.9 + 0.8 * exp(-tau * 3);
  for (let k = 0; k < 2 * P.n; k++) {
    const i = k >> 1, s = k & 1 ? -1 : 1, L = P.stop[k];
    if (reach < L) blob(S.px[i] + s * reach * P.ux[i], S.py[i] + s * reach * P.uy[i], head, 1.7);
    else if (P.by[k] >= 0 && reach - L < 0.5 * V) blob(S.px[i] + s * L * P.ux[i], S.py[i] + s * L * P.uy[i], 1.6 * (1 - (reach - L) / (0.5 * V)) ** 2, 2.6);
  }
  for (let p = 0; p < N; p++) {
    let r = 0, g = 0, b = 0;
    const w = wt[p];
    if (w <= tau) {
      // A crack: white where a tip has just passed, cooling to cream.
      const a = exp(-(tau - w) * 2.2);
      r = lc[0] + (1 - lc[0]) * a;
      g = lc[1] + (1 - lc[1]) * a;
      b = lc[2] + (1 - lc[2]) * a;
    } else if (ft[p] <= tau) {
      const c = cell[p] * 3, a = cl((tau - ft[p]) / 0.2, 0, 1), sh = 0.32 * exp(-(tau - ft[p]) / 0.12);
      r = col[c] * a + sh;
      g = col[c + 1] * a + sh;
      b = col[c + 2] * a + sh;
    }
    const gl = glow[p];
    r = (r + gl) * fade;
    g = (g + gl) * fade;
    b = (b + gl * 0.9) * fade;
    display.setPixel(p % W, (p / W) | 0, round(cl(r, 0, 1) * 255), round(cl(g, 0, 1) * 255), round(cl(b, 0, 1) * 255));
  }
}
