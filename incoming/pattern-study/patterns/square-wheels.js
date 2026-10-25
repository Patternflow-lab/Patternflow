// ===== Patternflow pattern =====
// Title:   Square Wheels
// Family:  physics
// Idea:    Three lanes of polygon wheels, squares to begin with, roll along roads of inverted catenary arcs cut to the length of one side, and each wheel is only ever set down on its road, yet its axle runs dead level along a faint line, until the road is flattened and the axles start to bob.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Roads and wheels, the square wheel on inverted catenaries (Leon Hall and Stan Wagon, 1992), pattern round 41
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sides=4..8, Road=0..1
//
// Knob 1: Hue. Turns the three lanes round the wheel together, a third of the wheel apart. At 0 azure, magenta and lime wheels on blue, wine and green roads; at 0.5 orange, green and violet. A road that comes round to orange, yellow or yellow-green is lifted and paled so it never reads brown or olive.
// Knob 2: Speed. At 2 the wheels travel 10 LEDs a second, so a square of side 22.6 turns a quarter in 2 seconds; at 0.2 they travel 1 LED a second, at 3 they travel 15. The top and bottom lanes roll right, the middle one left.
// Knob 3: Sides. The number of sides of every wheel, 4 to 8, each with its own road. Every wheel sweeps the same circle of radius 16, so a square has inradius 11.3 and humps 19.9 LEDs apart and 4.7 deep; an octagon has inradius 14.8 and humps 11.9 apart and 1.2 deep. Triangles are left out: on their road a corner cuts 0.095 of the inradius into the next hump.
// Knob 4: Road. Up to 0.06 the road is Hall and Wagon's: the arcs y = -r cosh(x / r), and the axles stay on the line. Above that the humps flatten toward a flat road at 1, and since each wheel is only set down on the road, its axle lifts off the line as it tips over a corner: by 4.7 LEDs for a square on the flat road, 1.2 for an octagon.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, round, sin, cos, tan, sinh, cosh, asinh, hypot, sign, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Three lanes down the panel. R is the circle every wheel in a lane sweeps,
// whatever its number of sides, so no wheel leaves its lane: 1 row above
// the wheel, the axle, 2R rows down to the bottom of a trough, and the rest
// of the lane is road. The middle lane is half a LED smaller, so its humps
// fall out of step with the others.
const LANES = [
  { y0: 0, h: 43, dir: 1, R: 16, hue: 0, start: 0 },
  { y0: 43, h: 42, dir: -1, R: 15.5, hue: 1 / 3, start: 13.7 },
  { y0: 85, h: 43, dir: 1, R: 16, hue: 2 / 3, start: 27.4 },
];
// Bands: 2 LEDs lit and 1 dark, inside the wheels and in the road.
const BW = 2, BP = 3;
// Opening hues: azure, magenta, lime.
const HUE0 = 0.55;
// Travel in LEDs a second per unit of Speed.
const PACE = 5;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, sides: 4, road: 0, t: 0,
    code: new Uint8Array(W * H), key: "", rgb: new Float32Array(W * H * 3),
    pal: LANES.map(() => [[0, 0, 0], [0, 0, 0], [0, 0, 0]]),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.sides = round(cl(k[2], 4, 8));
  // Up to 0.06, the opening, the road is exactly the catenary one.
  S.road = max(0, (cl(k[3], 0, 1) - 0.06) / 0.94);
  S.t += d * S.speed * PACE;
}

// A lane's road and wheels for n sides at road blend kr (0 catenary, 1
// flat). r is the inradius and a the half-span of one catenary arc, whose
// length r sinh(a / r) = r tan(pi / n) is half a side; c is half a side. The
// flat road needs a whole side per hump, so the hump spacing P blends the
// two. Wheels sit a whole number of humps apart, at least 2R + 5.
function laneGeom(L, n, kr) {
  const R = L.R, r = R * cos(PI / n), a = r * asinh(tan(PI / n)), c = r * tan(PI / n);
  const P = 2 * ((1 - kr) * a + kr * c);
  // Arc i is y = -A cosh(sc (x - iP)) - B, axle level at y = 0, y up.
  return { n, R, r, a, c, P, D: ceil((2 * R + 5) / P) * P, kr, A: r * (1 - kr), sc: (2 * a) / (P * r), B: r * kr };
}

const roadAt = (g, x) => {
  const xl = x - g.P * round(x / g.P);
  return -g.A * cosh(g.sc * xl) - g.B;
};

// How far the axle sits from the middle of its hump when the wheel has
// tipped by th: on the catenary road x = r asinh(tan th), so the axle stays
// straight above the point of contact; on the flat road the wheel pivots on
// a corner. The road blend blends the two.
function xOfTheta(g, th) {
  const cat = g.r * asinh(tan(th));
  const piv = sign(th) * (g.c - g.R * sin(PI / g.n - abs(th)));
  return (1 - g.kr) * cat + g.kr * piv;
}

function thetaOfX(g, xl) {
  let lo = -PI / g.n, hi = PI / g.n;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (xOfTheta(g, mid) < xl) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// The wheels of a lane at axle position X: their turn psi (y up,
// anticlockwise) from rolling, and their height Y found by setting the wheel
// down on the road, the lowest height at which no side dips below it. The
// road minus a side's line is concave along each arc, so its highest point
// on a stretch is where the arc's slope equals the side's, or an end.
function pose(g, X) {
  const q = round(X / g.P), th = thetaOfX(g, X - q * g.P);
  const psi = -(q * TAU) / g.n - th;
  let Y = -1e9;
  for (let i = 0; i < g.n; i++) {
    const a0 = psi - PI / 2 + ((i - 0.5) * TAU) / g.n, a1 = a0 + TAU / g.n;
    let x0 = X + g.R * cos(a0), y0 = g.R * sin(a0), x1 = X + g.R * cos(a1), y1 = g.R * sin(a1);
    if (x1 < x0) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    if (x1 - x0 < 1e-9) {
      Y = max(Y, roadAt(g, x0) - min(y0, y1));
      continue;
    }
    const m = (y1 - y0) / (x1 - x0);
    for (let k = round(x0 / g.P); k <= round(x1 / g.P); k++) {
      const c = k * g.P, lo = max(x0, c - g.P / 2), hi = min(x1, c + g.P / 2);
      if (hi < lo) continue;
      const t = cl(g.A > 1e-9 ? c + asinh(-m / (g.A * g.sc)) / g.sc : lo, lo, hi);
      const need = (x) => -g.A * cosh(g.sc * (x - c)) - g.B - (y0 + m * (x - x0));
      Y = max(Y, need(t), need(lo), need(hi));
    }
  }
  return { psi, Y };
}

// Distance from (px, py) to arc k, by Newton's method on the squared
// distance with the foot kept on the arc.
function arcDist(g, k, px, py) {
  const c = k * g.P, hw = g.P / 2, { A, B, sc } = g;
  let t = cl(px, c - hw, c + hw);
  for (let i = 0; i < 4; i++) {
    const u = sc * (t - c), ch = cosh(u), sh = sinh(u);
    const gy = -A * ch - B, g1 = -A * sc * sh, g2 = -A * sc * sc * ch;
    const f1 = t - px + (gy - py) * g1, f2 = 1 + g1 * g1 + (gy - py) * g2;
    t = cl(t - f1 / max(0.2, f2), c - hw, c + hw);
  }
  return hypot(t - px, -A * cosh(sc * (t - c)) - B - py);
}

const axleRow = (L) => floor(L.y0 + 1 + L.R) + 0.5;

// The road layer, kept until Sides or Road moves: 1 for the surface band,
// 2 for a lit band below it, the bands following the road's shape by true
// distance, so under each trough they meet in a crease; 3 for the axle line.
function buildRoads(S) {
  const code = S.code;
  code.fill(0);
  for (const L of LANES) {
    const g = laneGeom(L, S.sides, S.road), yA = axleRow(L);
    for (let x = 0; x < W; x++) {
      const lx = x + 0.5, ry = roadAt(g, lx), k0 = round(lx / g.P), k1 = lx > k0 * g.P ? k0 + 1 : k0 - 1;
      for (let y = L.y0; y < L.y0 + L.h; y++) {
        const ly = yA - (y + 0.5), p = y * W + x;
        if (abs(ly) < 0.5) code[p] = 3;
        if (ly >= ry) continue;
        const d = min(arcDist(g, k0, lx, ly), arcDist(g, k1, lx, ly));
        if (d < BW) code[p] = 1;
        else if (d >= BP && (d - BP) % BP < BW) code[p] = 2;
      }
    }
  }
}

function palette(S) {
  LANES.forEach((L, i) => {
    const [wheel, road, top] = S.pal[i], h = S.hue + HUE0 + L.hue, hr = h + 0.06, f = hr - floor(hr);
    // A deep road from orange round to yellow-green reads brown or olive:
    // lift and pale it.
    const warm = sm(0, 0.05, f) * (1 - sm(0.2, 0.26, f));
    hsv(h, 0.8, 1, wheel);
    hsv(hr, 0.75 - 0.25 * warm, 0.6 + 0.3 * warm, road);
    hsv(hr, 0.4, 1, top);
  });
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const key = S.sides + "/" + S.road;
  if (key !== S.key) {
    buildRoads(S);
    S.key = key;
  }
  palette(S);
  const { rgb, code, pal } = S;
  rgb.fill(0);
  for (let li = 0; li < LANES.length; li++) {
    const L = LANES[li], [, road, top] = pal[li];
    for (let p = L.y0 * W; p < (L.y0 + L.h) * W; p++) {
      const c = code[p], o = p * 3;
      if (c === 1) (rgb[o] = top[0]), (rgb[o + 1] = top[1]), (rgb[o + 2] = top[2]);
      else if (c === 2) (rgb[o] = road[0]), (rgb[o + 1] = road[1]), (rgb[o + 2] = road[2]);
      else if (c === 3) (rgb[o] = 0.11), (rgb[o + 1] = 0.11), (rgb[o + 2] = 0.15);
    }
  }
  // The wheels: nested polygons 2 LEDs wide with 1-LED grooves, round a
  // white hub on the axle.
  for (let li = 0; li < LANES.length; li++) {
    const L = LANES[li], g = laneGeom(L, S.sides, S.road), wheel = pal[li][0], yA = axleRow(L);
    const X0 = L.dir * S.t + L.start, { psi, Y } = pose(g, X0 - g.D * floor(X0 / g.D));
    const ux = [], uy = [];
    for (let i = 0; i < g.n; i++) {
      const an = -PI / 2 + (i * TAU) / g.n - psi;
      ux.push(cos(an));
      uy.push(sin(an));
    }
    for (let j = ceil((-g.R - 1 - X0) / g.D); X0 + j * g.D < W + g.R + 1; j++) {
      const cx = X0 + j * g.D, cy = yA - Y;
      for (let y = max(L.y0, floor(cy - g.R)); y <= min(L.y0 + L.h - 1, ceil(cy + g.R)); y++)
        for (let x = max(0, floor(cx - g.R)); x <= min(W - 1, ceil(cx + g.R)); x++) {
          const dx = x + 0.5 - cx, dy = cy - (y + 0.5);
          let gauge = -1e9;
          for (let i = 0; i < g.n; i++) gauge = max(gauge, dx * ux[i] + dy * uy[i]);
          const e = g.r - gauge;
          if (e < 0) continue;
          const rr = hypot(dx, dy), o = (y * W + x) * 3;
          if (rr < 2.2) (rgb[o] = 1), (rgb[o + 1] = 1), (rgb[o + 2] = 1);
          else if (rr > 3.2 && e % BP < BW) (rgb[o] = wheel[0]), (rgb[o + 1] = wheel[1]), (rgb[o + 2] = wheel[2]);
          else rgb[o] = rgb[o + 1] = rgb[o + 2] = 0;
        }
    }
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
