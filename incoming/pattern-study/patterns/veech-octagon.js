// ===== Patternflow pattern =====
// Title:   Veech Octagon
// Family:  topology
// Idea:    Four straight lines on each surface run in one shared direction across the regular octagon with opposite sides glued, above, and the double regular pentagon, below, leaving by a side and coming back by the side glued to it; in most directions they fill their surface evenly, and in the directions Veech's dichotomy picks out they close up and the surface falls apart into two cylinders of closed lines, each its own colour.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: straight-line flow on flat surfaces (Ralph Fox and Richard Kershner, 1936), unique ergodicity in almost every direction (Steven Kerckhoff, Howard Masur and John Smillie, 1986), translation surfaces from regular polygons and the Veech dichotomy (William Veech, 1989), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Direction=45..135, Trail=0..1
//
// Knob 1: Hue. Turns the two cylinders round the wheel together. At 0 the shorter cylinder is azure and the longer violet, the lines pale lavender with a white comet at each head, and a surface whose direction fills it dark slate; at 0.25 violet and red, at 0.5 red and green, at 0.75 green and teal. Orange and dark yellow are skipped, as they read brown.
// Knob 2: Speed. The lines run 0.8 x Speed sides a second, 1.6 at 2 (36 LEDs a second), so a line in the octagon's middle cylinder, 2.41 sides round, closes every 1.5 s. Each line keeps the stretch it ran in the last Trail seconds, so Speed sets its length too: at 0.2 a line is 0.9 sides long and no longer reaches round its cylinder, at 3 it is 13 sides.
// Knob 3: Direction. The direction of every line, in degrees from the horizontal. Within 1 degree of a periodic direction it snaps to it. The octagon's are 45, 90 and 135, along its sides, where it splits into its middle band, 1 + sqrt 2 = 2.414 sides round, and the two trapezoids either side of it glued into one cylinder 2 + sqrt 2 = 3.414 round, with inverse moduli 2.414 and 4.828, one exactly twice the other; and 67.5 and 112.5, along its diagonals, where the cylinders are 1.848 and 4.461 round and both have inverse modulus 2 cot(pi/8) = 4.828, the thin one showing as two corner triangles. The double pentagon's are 72 and 108, along its sides, cylinders phi = 1.618 and phi^2 = 2.618 round with inverse moduli both 2 cot(pi/5) = 2.753, and 54, 90 and 126, through its corners, 4.980 and 8.057 round with inverse moduli both 26.07, tan^2 72 = 9.47 times thinner. At 90 both surfaces close. Between the snaps the knob passes periodic directions too, densely, but they close only on long lines, 11.90 and 16.84 sides at 56.70 for the octagon, and a direction off them by any amount fills. It opens at 45: the octagon closed, the pentagon filling.
// Knob 4: Trail. How many seconds of line each head keeps, T = 4 + 56 K4^1.3: 5.5 s at the opening, 8.7 sides at Speed 2, so each closed line in the octagon has been round 2.5 to 3.6 times and glows, while in the pentagon the same length lies as fresh parallel strokes. Every part is as bright as it is recent, falling to nothing at T. At 1 the trail is 60 s, 96 sides, and a surface that fills is an even silver.
// Buttons: K1 tap starts all eight lines again from new random points. The first ones start from fixed points, two in each cylinder of the octagon at 45 degrees.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, sqrt, cos, sin, abs, round, ceil, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel without orange and dark yellow, 0.03 to 0.17, which read brown.
const wheel = (h) => 0.17 + 0.86 * (h - floor(h));

// A translation surface: convex polygons with side 1, y up, each side glued
// to a parallel side by a translation. For a polygon symmetric about its
// centre, or a polygon and its copy turned through a half turn, the side
// from a to b goes to the side from -b to -a, and the translation is
// -(a + b).
function build(polys, partner) {
  return polys.map((V, p) =>
    V.map((a, i) => {
      const b = V[(i + 1) % V.length], ex = b[0] - a[0], ey = b[1] - a[1], [to, j] = partner(p, i);
      return { ax: a[0], ay: a[1], ex, ey, nx: -ey, ny: ex, len2: ex * ex + ey * ey, to, j, tx: -(a[0] + b[0]), ty: -(a[1] + b[1]) };
    }),
  );
}
// The regular octagon, sides horizontal at the top and bottom, side i glued
// to side i + 4. Area 2 (1 + sqrt 2) = 4.83.
const RO = (1 + sqrt(2)) / 2;
const OCT_V = [[-0.5, -RO], [0.5, -RO], [RO, -0.5], [RO, 0.5], [0.5, RO], [-0.5, RO], [-RO, 0.5], [-RO, -0.5]];
// The double pentagon: a regular pentagon standing on a horizontal side and
// its copy turned through a half turn, glued along that side, every other
// side of one glued to the parallel side of the other. Area 3.44.
const C72 = cos((2 * PI) / 5), S72 = sin((2 * PI) / 5), HP = S72 + sin(PI / 5);
const PEN_A = [[-0.5, 0], [0.5, 0], [0.5 + C72, S72], [0, HP], [-0.5 - C72, S72]];
const PEN_B = PEN_A.map(([x, y]) => [-x, -y]);

// On the panel: 22.8 LEDs a side. The octagon, 55 LEDs across, at the top;
// the double pentagon, 37 across and 70 tall, below it.
const SC = 22.8;
const SURF = [
  { polys: [OCT_V], E: build([OCT_V], (p, i) => [0, (i + 4) % 8]), cx: 32, cy: 28.1, dirs: [45, 67.5, 90, 112.5, 135] },
  { polys: [PEN_A, PEN_B], E: build([PEN_A, PEN_B], (p, i) => [1 - p, i]), cx: 32, cy: 92.6, dirs: [54, 72, 90, 108, 126] },
];
const SNAP = 1; // degrees either side of a periodic direction that snap to it
const RAYS = 4; // lines on each surface
const VEL = 0.8; // sides a second at Speed 1
const COMET = 0.5; // sides of white behind each head

// From (x, y) in polygon p along (ux, uy): the distance to the side the line
// leaves by, that side, and where along it, 0 to 1.
const EX = [0, 0, 0];
function exit(E, p, x, y, ux, uy, skip) {
  const es = E[p];
  let bt = Infinity, bi = -1;
  for (let i = 0; i < es.length; i++) {
    if (i === skip) continue;
    const e = es[i], un = ux * e.nx + uy * e.ny;
    if (un >= -1e-15) continue;
    const t = ((e.ax - x) * e.nx + (e.ay - y) * e.ny) / un;
    if (t < bt) (bt = t), (bi = i);
  }
  if (bi < 0) return null;
  const e = es[bi];
  EX[0] = bt < 0 ? 0 : bt;
  EX[1] = bi;
  EX[2] = ((x + bt * ux - e.ax) * e.ex + (y + bt * uy - e.ay) * e.ey) / e.len2;
  return EX;
}
// The length of the closed line through (x0, y0) in polygon p0, or -1 when
// it runs into the corner, the one cone point of angle 6 pi, first.
function period(E, p0, x0, y0, ux, uy) {
  let p = p0, x = x0, y = y0, skip = -1, L = 0;
  for (let k = 0; k < 120; k++) {
    const r = exit(E, p, x, y, ux, uy, skip);
    if (!r) return -1;
    const t = r[0], i = r[1], s = r[2];
    if (k > 0 && p === p0) {
      const dx = x0 - x, dy = y0 - y, along = dx * ux + dy * uy;
      if (abs(dx * uy - dy * ux) < 1e-9 && along > -1e-12 && along <= t + 1e-12) return L + along;
    }
    if (s < 1e-9 || s > 1 - 1e-9) return -1;
    const e = E[p][i];
    x += t * ux + e.tx;
    y += t * uy + e.ty;
    L += t;
    p = e.to;
    skip = e.j;
  }
  return -1;
}
function inside(E, p, x, y) {
  for (const e of E[p]) if ((x - e.ax) * e.nx + (y - e.ay) * e.ny < 0) return false;
  return true;
}

export function setup(params) {
  // Every LED whose centre falls inside a polygon, with its point there.
  const who = new Int8Array(NP).fill(-1), poly = new Int8Array(NP), px = new Float64Array(NP), py = new Float64Array(NP);
  for (let s = 0; s < 2; s++) {
    const S = SURF[s];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const mx = (x + 0.5 - S.cx) / SC, my = (S.cy - y - 0.5) / SC;
        for (let p = 0; p < S.E.length; p++)
          if (inside(S.E, p, mx, my)) {
            const o = y * W + x;
            (who[o] = s), (poly[o] = p), (px[o] = mx), (py[o] = my);
          }
      }
  }
  params.s = {
    who, poly, px, py, maps: {}, heads: [null, null], dir: 45, started: false, prev: false,
    k: [0, 2, 45, 0.06], rgb: new Float32Array(NP * 3), tb: new Float32Array(NP), c: new Float32Array(24), clock: 0,
  };
}

// The cylinders of surface s in direction d: every LED inside it gets the
// rank of its closed line's length, shortest first, so each cylinder is one
// number.
function cylinders(S, s, d) {
  const key = s + ":" + d;
  if (S.maps[key]) return S.maps[key];
  const E = SURF[s].E, ux = cos((d * PI) / 180), uy = sin((d * PI) / 180);
  const len = new Float64Array(NP).fill(-1), lens = [];
  for (let o = 0; o < NP; o++) {
    if (S.who[o] !== s) continue;
    const c = period(E, S.poly[o], S.px[o], S.py[o], ux, uy);
    len[o] = c;
    if (c > 0 && !lens.some((v) => abs(v - c) < 1e-6)) lens.push(c);
  }
  lens.sort((a, b) => a - b);
  const rank = new Int8Array(NP).fill(-1);
  for (let o = 0; o < NP; o++) if (len[o] > 0) rank[o] = lens.findIndex((v) => abs(v - len[o]) < 1e-6);
  return (S.maps[key] = { rank, lens });
}

// The first lines start at fixed points, two in each cylinder of the
// octagon at 45 degrees; a tap of K1 draws new ones at random.
const FIRST = [
  [[0, 0.15, 0.1], [0, -0.75, 0.55], [0, 0.55, -0.85], [0, 0.95, 0.35]],
  [[0, 0.05, 0.6], [0, -0.3, 1.0], [1, 0.2, -0.5], [1, -0.35, -1.0]],
];
function launch(s) {
  const E = SURF[s].E;
  for (;;) {
    const p = floor(random() * E.length), x = (random() - 0.5) * 3.2, y = (random() - 0.5) * 3.2;
    if (inside(E, p, x, y)) return { p, x, y, skip: -1 };
  }
}
// Move a point a distance L along (ux, uy), through the glued sides.
function flow(E, h, L, ux, uy) {
  for (let k = 0; k < 400 && L > 0; k++) {
    const r = exit(E, h.p, h.x, h.y, ux, uy, h.skip);
    if (!r) return;
    const t = r[0], i = r[1];
    if (t > L) {
      h.x += L * ux;
      h.y += L * uy;
      h.skip = -1;
      return;
    }
    const e = E[h.p][i];
    h.x += t * ux + e.tx;
    h.y += t * uy + e.ty;
    h.p = e.to;
    h.skip = e.j;
    L -= t;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 45, 0.06], d = cl(dt || 0, 0, 0.1);
  S.k[0] = k[0];
  S.k[1] = cl(k[1], 0.2, 3);
  S.k[2] = cl(k[2], 45, 135);
  S.k[3] = cl(k[3], 0, 1);
  const press = !!(input.btnPressed && input.btnPressed[0]);
  if (!S.started || (press && !S.prev)) {
    S.heads = S.started
      ? [0, 1].map((s) => Array.from({ length: RAYS }, () => launch(s)))
      : FIRST.map((f) => f.map(([p, x, y]) => ({ p, x, y, skip: -1 })));
    S.started = true;
  }
  S.prev = press;
  // Snap to the nearest direction in which either surface is periodic.
  let dir = S.k[2];
  for (const sf of SURF) for (const p of sf.dirs) if (abs(dir - p) <= SNAP) dir = p;
  S.dir = dir;
  const ux = cos((dir * PI) / 180), uy = sin((dir * PI) / 180);
  for (let s = 0; s < 2; s++) for (const hd of S.heads[s]) flow(SURF[s].E, hd, VEL * S.k[1] * d, ux, uy);
  S.clock += d;
}

function splat(S, x, y, v, c, o) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  add(S, ix, iy, (1 - fx) * (1 - fy) * v, c, o);
  add(S, ix + 1, iy, fx * (1 - fy) * v, c, o);
  add(S, ix, iy + 1, (1 - fx) * fy * v, c, o);
  add(S, ix + 1, iy + 1, fx * fy * v, c, o);
}
function splatT(S, x, y, v) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, T = S.tb;
  if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) return;
  const p = iy * W + ix;
  T[p] += (1 - fx) * (1 - fy) * v;
  T[p + 1] += fx * (1 - fy) * v;
  T[p + W] += (1 - fx) * fy * v;
  T[p + W + 1] += fx * fy * v;
}
function add(S, x, y, v, c, o) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  S.rgb[p] += v * c[o];
  S.rgb[p + 1] += v * c[o + 1];
  S.rgb[p + 2] += v * c[o + 2];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, c, who } = S, h = S.k[0], dir = S.dir;
  rgb.fill(0);
  S.tb.fill(0);
  // Colours: 0 and 3 the two cylinders, 6 a surface in a direction that
  // fills it, 9 the sides, 12 the line, 15 its head.
  hsv(wheel(0.48 + h), 0.85, 0.42, c, 0);
  hsv(wheel(0.7 + h), 0.7, 0.42, c, 3);
  hsv(wheel(0.6 + h), 0.35, 0.11, c, 6);
  hsv(wheel(0.6 + h), 0.25, 0.42, c, 9);
  hsv(wheel(0.62 + h), 0.15, 1, c, 12);
  c[15] = c[16] = c[17] = 1;

  for (let s = 0; s < 2; s++) {
    const sf = SURF[s], periodic = sf.dirs.includes(dir), m = periodic ? cylinders(S, s, dir) : null;
    for (let o = 0; o < NP; o++) {
      if (who[o] !== s) continue;
      const r = m ? m.rank[o] : -1, q = r === 0 ? 0 : r === 1 ? 3 : 6, p = o * 3;
      rgb[p] = c[q];
      rgb[p + 1] = c[q + 1];
      rgb[p + 2] = c[q + 2];
    }
    // The sides, the double pentagon's inner side dotted.
    for (let pi = 0; pi < sf.E.length; pi++)
      for (let i = 0; i < sf.E[pi].length; i++) {
        const e = sf.E[pi][i], inner = s === 1 && i === 0;
        if (inner && pi === 1) continue;
        const x0 = sf.cx + SC * e.ax, y0 = sf.cy - SC * e.ay, n = ceil(SC * 3);
        for (let j = 0; j <= n; j++) {
          if (inner && j % 6 > 2) continue;
          splat(S, x0 + (SC * e.ex * j) / n, y0 - (SC * e.ey * j) / n, inner ? 0.18 : 0.36, c, 9);
        }
      }
    // The lines: back from each head as far as it came in the last Trail
    // seconds, each part as bright as it is recent, so where a line closes
    // on itself it adds up.
    const Ltr = VEL * S.k[1] * (4 + 56 * S.k[3] ** 1.3), E = sf.E, wpass = 0.7 * min(1, sqrt(10 / Ltr));
    const ux = cos((dir * PI) / 180), uy = sin((dir * PI) / 180);
    for (const hd of S.heads[s]) {
      const b = { p: hd.p, x: hd.x, y: hd.y, skip: -1 };
      let done = 0;
      for (let kk = 0; kk < 600 && done < Ltr; kk++) {
        const r = exit(E, b.p, b.x, b.y, -ux, -uy, b.skip);
        if (!r) break;
        const t = min(r[0], Ltr - done), i = r[1];
        const n = max(1, ceil(t * SC * 3));
        for (let j = 0; j <= n; j++) {
          const u = (t * j) / n, w = 1 - (done + u) / Ltr;
          const ww = (t * SC) / n;
          splatT(S, sf.cx + SC * (b.x - u * ux), sf.cy - SC * (b.y - u * uy), wpass * w * ww);
          if (done + u < COMET) splat(S, sf.cx + SC * (b.x - u * ux), sf.cy - SC * (b.y - u * uy), 0.7 * (1 - (done + u) / COMET) * ww, c, 15);
        }
        done += t;
        if (t < r[0]) break;
        if (r[2] < 1e-9 || r[2] > 1 - 1e-9) break;
        const e = E[b.p][i];
        b.x -= t * ux - e.tx;
        b.y -= t * uy - e.ty;
        b.p = e.to;
        b.skip = e.j;
      }
      splat(S, sf.cx + SC * hd.x, sf.cy - SC * hd.y, 1.2, c, 15);
    }
  }
  // The lines over the surfaces, through 1 - e^(-x), so a line that closes
  // and runs over itself many times stays below the white of the heads.
  for (let o = 0, p = 0; o < NP; o++, p += 3) {
    const v = S.tb[o];
    if (v <= 0) continue;
    const g = 0.86 * (1 - Math.exp(-1.6 * v));
    rgb[p] += g * c[12];
    rgb[p + 1] += g * c[13];
    rgb[p + 2] += g * c[14];
  }

  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, round(min(1, rgb[p]) * 255), round(min(1, rgb[p + 1]) * 255), round(min(1, rgb[p + 2]) * 255));
}
