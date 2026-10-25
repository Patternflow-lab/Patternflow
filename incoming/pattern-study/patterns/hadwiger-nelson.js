// ===== Patternflow pattern =====
// Title:   Hadwiger-Nelson
// Family:  cells
// Idea:    Isbell's seven-colouring of the plane, regular hexagons in seven glass colours with each cell's six neighbours the six other colours, drifts and turns slowly under rigid figures of unit length, a Moser spindle, an equilateral triangle and single sticks, that tumble over it with every unit edge drawn in light and the cells under its ends lit, so the two ends of every edge always sit on different colours until the hexagons are sized out of the window where the colouring works, and then the edges that land on one colour flash red and their cells pulse.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hadwiger-Nelson problem (Edward Nelson, 1950), with John Isbell's seven-colouring, pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=-1..1, Figures=0..1
//
// Knob 1: Hue. Turns the seven glass colours round the colour wheel together: at 0 they are amber, olive, green, teal, blue, violet and crimson; at 0.5 the amber cells have turned sky blue and the teal ones rose. The light of the edges stays white.
// Knob 2: Speed. How fast the figures glide and tumble and the mosaic drifts: at 2 a figure glides 5 to 13 LEDs a second and turns once in 5 to 9 seconds, and the mosaic slides 4 LEDs a second and turns once in 70; at 0.2 ten times slower, at 3 half as fast again. The red flashes beat three times a second at any Speed.
// Knob 3: Size. The hexagon's diameter in units, 0.87 times 1.6 to the power of the knob: 0.54 at -1, 0.87 at 0, 1.39 at 1. Isbell's colouring is proper from 0.756 to 1 (the knob from -0.30 to 0.30), and there nothing ever flashes; below it two cells of one colour lie closer than 1 and a unit edge can reach from one to the other, above it a whole unit edge fits inside one hexagon, and each such edge flashes red while its cells pulse.
// Knob 4: Figures. How many unit figures tumble over the plane: 3 at 0 and 0.06 (a Moser spindle, a unit triangle and a stick), one more at each eighth of the range, up to 10 at 1 (two spindles, three triangles and five sticks, 36 unit edges).

const W = 64, H = 128;
const { floor, min, max, abs, round, sin, cos, sqrt, hypot, PI } = Math;
const TAU = 2 * PI, SQ3 = sqrt(3);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The unit length on the panel, in LEDs.
const U = 22;

// The window. Hexagon centres sit on a triangular lattice with spacing s; a
// hexagon of diameter D (corner to corner) has s = D√3/2. Centre (a, b), at
// a·(s, 0) + b·(s/2, s√3/2), gets colour (a + 3b) mod 7: its six neighbours
// (±1, 0), (0, ±1), (1, -1), (-1, 1) get +1, -1, +3, -3, -2, +2, the six
// other colours. The cells of one colour sit on the sublattice of index 7,
// whose shortest vectors are √7 lattice steps long. The nearest two points of
// two hexagons whose centres differ by v are |v| less the hexagon's size in
// that direction, which is the distance from v to the hexagon doubled. That
// is computed here over the sublattice and comes out at √7/2 = 1.3229
// diameters, corner to corner, so the colouring needs D > 2/√7 = 0.7559 for
// two cells of one colour to be more than 1 apart, and D < 1 for no two
// points of one cell to be 1 apart.
function sameColourGap() {
  const D = 1, s = (D * SQ3) / 2, R = D / 2;
  // The doubled hexagon: corners at 30° + 60°k, circumradius 2R.
  const P = [];
  for (let k = 0; k < 6; k++) P.push([2 * R * cos(PI / 6 + (k * PI) / 3), 2 * R * sin(PI / 6 + (k * PI) / 3)]);
  let gap = Infinity;
  for (let a = -6; a <= 6; a++)
    for (let b = -6; b <= 6; b++) {
      if ((a === 0 && b === 0) || (((a + 3 * b) % 7) + 7) % 7 !== 0) continue;
      const vx = s * (a + b / 2), vy = (s * SQ3 * b) / 2;
      for (let k = 0; k < 6; k++) {
        const [x0, y0] = P[k], [x1, y1] = P[(k + 1) % 6];
        const ex = x1 - x0, ey = y1 - y0, t = cl(((vx - x0) * ex + (vy - y0) * ey) / (ex * ex + ey * ey), 0, 1);
        gap = min(gap, hypot(vx - x0 - t * ex, vy - y0 - t * ey));
      }
    }
  return gap;
}
const GAP = sameColourGap();
const D_LO = 1 / GAP, D_HI = 1;
// Size 0 is the geometric middle of the window: √(0.7559 · 1) = 0.87.
const D_MID = 0.87, D_STEP = 1.6;

// Seven glass colours, one per colour class, a seventh of the wheel apart
// with saturation and value varied so neighbours never blur together.
const SAT = [0.95, 0.8, 1, 0.85, 1, 0.75, 0.9];
const VAL = [0.62, 0.5, 0.46, 0.52, 0.6, 0.52, 0.56];
// Hue 0 opens on amber, not red.
const HUE0 = 0.09;
const LIGHT = [1, 0.96, 0.86], RED = [1, 0.08, 0.04];

// The figures, in units. Every listed edge is exactly 1 long.
function spindle() {
  // Two rhombi of two unit triangles each share the corner A; the second is
  // turned about A until its far tip is 1 from the first one's (2√3 sin(β/2)
  // = 1). Seven points, eleven unit edges, and no proper 3-colouring.
  const beta = 2 * Math.asin(1 / (2 * SQ3)), pts = [[0, 0]];
  for (const r of [-beta / 2, beta / 2]) {
    const at = (d, a) => [d * cos(a + r), d * sin(a + r)];
    pts.push(at(1, -PI / 6), at(1, PI / 6), at(SQ3, 0));
  }
  const edges = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [0, 4], [0, 5], [4, 5], [4, 6], [5, 6], [3, 6]];
  return centre({ pts, edges });
}
const triangle = () => centre({ pts: [[0, 0], [1, 0], [0.5, SQ3 / 2]], edges: [[0, 1], [1, 2], [2, 0]] });
const stick = () => centre({ pts: [[0, 0], [1, 0]], edges: [[0, 1]] });
function centre(f) {
  let cx = 0, cy = 0;
  for (const p of f.pts) (cx += p[0]), (cy += p[1]);
  cx /= f.pts.length;
  cy /= f.pts.length;
  f.pts = f.pts.map((p) => [p[0] - cx, p[1] - cy]);
  f.reach = max(...f.pts.map((p) => hypot(p[0], p[1])));
  return f;
}
const KINDS = [spindle, triangle, stick, stick, triangle, stick, spindle, stick, triangle, stick];

function makeFigure(i) {
  const f = KINDS[i]();
  const a = TAU * hash(i * 7 + 1), v = 5 + 3 * hash(i * 7 + 2);
  f.x = 14 + 36 * hash(i * 7 + 3);
  f.y = 14 + 100 * ((i * 0.38 + 0.2 * hash(i * 7 + 4)) % 1);
  f.vx = v * cos(a);
  f.vy = v * sin(a) * 1.6;
  f.ang = TAU * hash(i * 7 + 5);
  f.spin = (hash(i * 7 + 6) < 0.5 ? -1 : 1) * (0.35 + 0.35 * hash(i * 7 + 7));
  f.ph = TAU * hash(i * 7 + 8);
  // Per edge: how hot its flash is; per point: where it is on the panel.
  f.hot = new Float32Array(f.edges.length);
  f.at = f.pts.map(() => [0, 0]);
  return f;
}

export function setup(params) {
  params.s = {
    t: 0, rt: 0, hue: 0, speed: 2, size: 0, D: D_MID, n: 3,
    // The plane under the panel: its turn and where the panel's centre is.
    rot: 0.3, ox: 0.37, oy: 0.21,
    figs: KINDS.map((_, i) => makeFigure(i)),
    lit: new Map(), pulse: new Map(),
    rgb: new Float32Array(W * H * 3),
    pal: null, palHue: NaN, flash: 0,
  };
}

// The cell of the colouring that holds plane point (x, y), in units:
// lattice coordinates a, b of its centre and its colour.
function cellAt(S, x, y) {
  const s = S.s, b = (2 * y) / (s * SQ3), a = x / s - b / 2, c = -a - b;
  let ra = round(a), rb = round(b);
  const rc = round(c), da = abs(ra - a), db = abs(rb - b), dc = abs(rc - c);
  if (da > db && da > dc) ra = -rb - rc;
  else if (db > dc) rb = -ra - rc;
  return [ra, rb, (((ra + 3 * rb) % 7) + 7) % 7];
}
const key = (a, b) => (a + 2048) * 4096 + b + 2048;

// A panel point (LEDs) to the plane (units).
function toPlane(S, px, py) {
  const u = (px - W / 2) / U, v = (py - H / 2) / U, c = cos(S.rot), s = sin(S.rot);
  return [c * u - s * v + S.ox, s * u + c * v + S.oy];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.size = cl(k[2], -1, 1);
  S.D = D_MID * D_STEP ** S.size;
  S.s = (S.D * SQ3) / 2;
  S.n = min(KINDS.length, 3 + floor(cl(k[3], 0, 1) * 7.99));
  const g = d * S.speed;
  S.t += g;
  S.rt += d;
  // The mosaic drifts a tenth of a unit a second and turns once in 140 s at
  // Speed 1, so its cells slide under the figures as well.
  S.rot += g * 0.045;
  S.ox += g * 0.06 * cos(S.t * 0.13);
  S.oy += g * 0.1;
  S.lit.clear();
  S.pulse.clear();
  // Flashes beat three times a second whatever the Speed.
  S.flash = 0.5 + 0.5 * sin(S.rt * TAU * 3);
  for (let i = 0; i < S.n; i++) {
    const f = S.figs[i];
    // Glide, bounce off the panel's sides so the figure stays mostly on it,
    // and tumble with a spin that swells and slackens.
    f.x += f.vx * g * 0.5;
    f.y += f.vy * g * 0.5;
    const mx = 4 + f.reach * U * 0.5, my = 6 + f.reach * U * 0.5;
    if (f.x < mx) f.vx = abs(f.vx);
    if (f.x > W - mx) f.vx = -abs(f.vx);
    if (f.y < my) f.vy = abs(f.vy);
    if (f.y > H - my) f.vy = -abs(f.vy);
    f.ang += g * f.spin * (0.75 + 0.5 * sin(S.t * 0.7 + f.ph));
    const c = cos(f.ang), s = sin(f.ang);
    const cells = f.pts.map((p, j) => {
      const px = f.x + U * (c * p[0] - s * p[1]), py = f.y + U * (s * p[0] + c * p[1]);
      f.at[j][0] = px;
      f.at[j][1] = py;
      const [x, y] = toPlane(S, px, py);
      const cell = cellAt(S, x, y);
      S.lit.set(key(cell[0], cell[1]), 1);
      return cell;
    });
    // A unit edge whose two ends land on one colour breaks the colouring.
    // Inside the window it cannot happen; outside it the edge heats up and
    // cools over a third of a second after it lands on two colours again.
    f.edges.forEach(([p, q], e) => {
      const bad = cells[p][2] === cells[q][2];
      f.hot[e] = bad ? 1 : max(0, f.hot[e] - d * 3);
      if (f.hot[e] > 0) {
        for (const cc of [cells[p], cells[q]]) {
          const kk = key(cc[0], cc[1]);
          S.pulse.set(kk, max(S.pulse.get(kk) || 0, f.hot[e]));
        }
      }
    });
  }
}

function palette(S) {
  S.pal = [];
  for (let c = 0; c < 7; c++) {
    const h = HUE0 + S.hue + c / 7, f = h - floor(h);
    // Dim amber and orange read brown on LEDs: lift them.
    const band = max(0, 1 - abs(f - 0.08) / 0.07);
    S.pal.push(hsv(h, SAT[c], VAL[c] + 0.2 * band), hsv(h, SAT[c] * 0.8, 1));
  }
  S.palHue = S.hue;
}

// Light along a segment, a line about 1.6 LEDs wide in three steps of
// brightness, blended over what is there.
function line(S, x0, y0, x1, y1, col, a) {
  const rgb = S.rgb, ex = x1 - x0, ey = y1 - y0, L2 = ex * ex + ey * ey || 1;
  const xa = max(0, floor(min(x0, x1) - 1)), xb = min(W - 1, floor(max(x0, x1) + 1));
  const ya = max(0, floor(min(y0, y1) - 1)), yb = min(H - 1, floor(max(y0, y1) + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = cl((px * ex + py * ey) / L2, 0, 1);
      const dd = hypot(px - t * ex, py - t * ey);
      if (dd >= 1.2) continue;
      const w = a * (dd < 0.45 ? 1 : dd < 0.85 ? 0.6 : 0.25), i = (y * W + x) * 3;
      rgb[i] += (col[0] - rgb[i]) * w;
      rgb[i + 1] += (col[1] - rgb[i + 1]) * w;
      rgb[i + 2] += (col[2] - rgb[i + 2]) * w;
    }
}

function dot(S, px, py, col) {
  const rgb = S.rgb, cx = round(px - 0.5), cy = round(py - 0.5);
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy, r2 = dx * dx + dy * dy;
      if (x < 0 || x >= W || y < 0 || y >= H || r2 > 5 || r2 === 4) continue;
      const i = (y * W + x) * 3;
      // A round white core with a dark ring, so the point reads on any glass.
      const c = r2 <= 1 ? col : r2 === 2 ? [col[0] * 0.75, col[1] * 0.75, col[2] * 0.75] : [0.03, 0.02, 0.05];
      rgb[i] = c[0];
      rgb[i + 1] = c[1];
      rgb[i + 2] = c[2];
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.s) return;
  if (S.palHue !== S.hue) palette(S);
  const rgb = S.rgb, s = S.s, half = s / 2, pal = S.pal;
  const c = cos(S.rot), sn = sin(S.rot);
  // Grout: a dark line about 1.4 LEDs wide on every cell boundary.
  const g1 = 0.45 / U, g2 = 0.9 / U;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5 - H / 2) / U;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - W / 2) / U;
      const px = c * u - sn * v + S.ox, py = sn * u + c * v + S.oy;
      const [a, b, col] = cellAt(S, px, py);
      // Distance to the cell's edge: its inradius less the largest
      // projection on the three face normals.
      const lx = px - s * (a + b / 2), ly = py - (s * SQ3 * b) / 2;
      const hd = max(abs(lx), abs(0.5 * lx + 0.866 * ly), abs(-0.5 * lx + 0.866 * ly));
      const edge = half - hd, kk = key(a, b);
      let r, gg, bb;
      const lit = S.lit.has(kk), p = S.pulse.get(kk) || 0;
      const base = pal[col * 2 + (lit ? 1 : 0)];
      // A bevel: the glass a little darker near the lead.
      const bev = edge < half * 0.28 ? 0.8 : 1;
      r = base[0] * bev;
      gg = base[1] * bev;
      bb = base[2] * bev;
      if (p > 0) {
        // An offending cell pulses towards white and red with its edge.
        const w = p * 0.85 * S.flash;
        r += (1 - r) * w;
        gg += (0.75 - gg) * w;
        bb += (0.7 - bb) * w;
      }
      if (edge < g2) {
        const f = edge < g1 ? 0.06 : 0.4;
        r *= f;
        gg *= f;
        bb *= f;
      }
      const i = (y * W + x) * 3;
      rgb[i] = r;
      rgb[i + 1] = gg;
      rgb[i + 2] = bb;
    }
  }
  for (let n = 0; n < S.n; n++) {
    const f = S.figs[n];
    f.edges.forEach(([p, q], e) => {
      const h = f.hot[e];
      const col = h > 0 ? (S.flash > 0.5 ? RED : LIGHT) : LIGHT;
      line(S, f.at[p][0], f.at[p][1], f.at[q][0], f.at[q][1], col, h > 0 ? 1 : 0.85);
    });
    for (const pt of f.at) dot(S, pt[0], pt[1], [1, 1, 1]);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, round(255 * cl(rgb[i], 0, 1)), round(255 * cl(rgb[i + 1], 0, 1)), round(255 * cl(rgb[i + 2], 0, 1)));
    }
}
