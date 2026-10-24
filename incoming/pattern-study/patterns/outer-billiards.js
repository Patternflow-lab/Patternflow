// ===== Patternflow pattern =====
// Title:   Outer Billiards
// Family:  geometry
// Idea:    A regular pentagon in the middle of the panel and the plane round it coloured by how many outer billiard jumps bring each point back, so Tabachnikov's necklaces of decagons and pentagons ring it to the top and bottom of the panel; one white point hops along its orbit, each jump a streak through the corner it reflects in.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: outer billiards (Bernhard Neumann, 1959) and Sergei Tabachnikov's regular pentagon (1995), pattern round 30
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sides=5..12, Zoom=-1..1
//
// Knob 1: Hue. Turns every period's colour round the wheel together. At 0 the five big decagons round the pentagon (period 5) are violet, the ring of pentagons outside them (period 20) pink and the big decagons above and below (period 15) orange; at 0.25 the same three are red, yellow and green.
// Knob 2: Speed. At 2 the point jumps 2.4 times a second and the plane turns once in 70 seconds; at 0.2 it jumps once in 4 seconds and the turn takes 12 minutes.
// Knob 3: Sides. The polygon, 5 to 12 sides, opening on the pentagon. The hexagon (6) has its corners on a lattice and its plane breaks into hexagons and triangles that repeat; every other count gives rings of polygons of many sizes with dark residue between. A new count fills in outward from the polygon in about half a second.
// Knob 4: Zoom. How many LEDs a corner of the polygon stands from its centre: 5.4 at the start, 2.3 at -1, where the panel's corners reach 31 times that out, and 12 at 1.
// Buttons: K1 tap drops the orbit and starts another, in the biggest domain of forty random tries whose period is not one of the last two.

const W = 64, H = 128, NP = W * H;
const { min, max, floor, ceil, sqrt, sin, cos, atan2, log, exp, PI, round, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// The map has the polygon's symmetry, turns by 2pi/n and mirrors in its
// axes (a mirror turns the map into its inverse, which has the same periods),
// so one wedge of angle pi/n holds it all. The wedge is gridded log-polar:
// radius RA to RMAX in CR cells per e-fold, angle in steps of 1/CR.
const RA = 0.7, RMAX = 33, CR = 110, NI = ceil(CR * log(RMAX / RA));
const MAXIT = 4000, INSIDE = 65535, BUDGET = 500000;

// Four sample points in each LED: radius in LEDs, CR times its log, angle in turns.
const SR = new Float32Array(NP * 4), SL = new Float32Array(NP * 4), SA = new Float32Array(NP * 4);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    for (let s = 0; s < 4; s++) {
      const q = (y * W + x) * 4 + s, dx = x + (s & 1 ? 0.75 : 0.25) - 32, dy = 64 - y - (s & 2 ? 0.75 : 0.25);
      SR[q] = sqrt(dx * dx + dy * dy);
      SL[q] = CR * log(SR[q]);
      SA[q] = atan2(dy, dx) / TAU;
    }

// A regular n-gon on the unit circle, vertex 0 on the x axis; edge k runs
// from vertex k to k + 1 and its outward normal is NX, NY.
function makePoly(n) {
  const G = { n, r: cos(PI / n), NJ: ceil((PI / n) * CR), next: 0, VX: [], VY: [], NX: [], NY: [] };
  for (let k = 0; k < n; k++) {
    G.VX.push(cos((TAU * k) / n));
    G.VY.push(sin((TAU * k) / n));
    G.NX.push(cos((TAU * (k + 0.5)) / n));
    G.NY.push(sin((TAU * (k + 0.5)) / n));
  }
  G.M = new Uint16Array(NI * G.NJ);
  return G;
}

// The vertex x reflects in: the first, counterclockwise, of the run of edges
// x can see, so the polygon lies right of the ray from x through it. -1 inside.
function vtx(G, x, y) {
  const { n, NX, NY, r } = G;
  let prev = x * NX[n - 1] + y * NY[n - 1] > r;
  for (let k = 0; k < n; k++) {
    const vis = x * NX[k] + y * NY[k] > r;
    if (vis && !prev) return k;
    prev = vis;
  }
  return -1;
}

// Two jumps make a translation, so after an even number of jumps a periodic
// point is back exactly, up to rounding. A domain whose centre has odd period p
// is turned half round by p jumps, and its points come back after 2p; every
// point of a domain gets the same number that way.
let spent = 0;
function period(G, x0, y0) {
  let x = x0, y = y0;
  for (let it = 1; it <= MAXIT; it++) {
    const k = vtx(G, x, y);
    if (k < 0) return (spent += it), INSIDE;
    x = 2 * G.VX[k] - x;
    y = 2 * G.VY[k] - y;
    if (!(it & 1) && (x - x0) ** 2 + (y - y0) ** 2 < 1e-14) return (spent += it), it;
  }
  spent += MAXIT;
  return 0;
}

// Fill the wedge outward from the polygon, BUDGET jumps a frame.
function grow(G) {
  spent = 0;
  const total = NI * G.NJ;
  while (G.next < total && spent < BUDGET) {
    const c = G.next++, i = (c / G.NJ) | 0, a = (c - i * G.NJ + 0.5) / CR, rho = RA * exp((i + 0.5) / CR);
    G.M[c] = period(G, rho * cos(a), rho * sin(a));
  }
}

// The domain of a periodic point: the points that see the same vertices for p
// jumps. After j jumps a point X is at s X + c; each jump adds two half
// planes, and a square clipped by them all is the domain. Its centroid.
function domain(G, x0, y0, p) {
  let poly = [[x0 - 30, y0 - 30], [x0 + 30, y0 - 30], [x0 + 30, y0 + 30], [x0 - 30, y0 + 30]];
  const clip = (ax, ay, b) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], d1 = ax * A[0] + ay * A[1] - b, d2 = ax * B[0] + ay * B[1] - b;
      if (d1 <= 0) out.push(A);
      if (d1 < 0 !== d2 < 0) out.push([A[0] + (d1 / (d1 - d2)) * (B[0] - A[0]), A[1] + (d1 / (d1 - d2)) * (B[1] - A[1])]);
    }
    poly = out;
  };
  let s = 1, cx = 0, cy = 0, x = x0, y = y0;
  for (let j = 0; j < p && poly.length; j++) {
    const k = vtx(G, x, y), m = (k + G.n - 1) % G.n;
    clip(-s * G.NX[k], -s * G.NY[k], G.NX[k] * cx + G.NY[k] * cy - G.r);
    clip(s * G.NX[m], s * G.NY[m], G.r - G.NX[m] * cx - G.NY[m] * cy);
    x = 2 * G.VX[k] - x;
    y = 2 * G.VY[k] - y;
    cx = 2 * G.VX[k] - cx;
    cy = 2 * G.VY[k] - cy;
    s = -s;
  }
  let A = 0, X = 0, Y = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], c = x1 * y2 - x2 * y1;
    A += c;
    X += (x1 + x2) * c;
    Y += (y1 + y2) * c;
  }
  return A > 1e-9 ? [X / (3 * A), Y / (3 * A), A / 2] : [x0, y0, 0];
}

const POLYS = {};
export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 5, zoom: 5.2, rot: PI / 2, t: 0,
    orb: null, k: 0, ph: 0, hops: 0, seen: [], marks: [],
    lut: new Float32Array((MAXIT + 1) * 3), lutKey: "",
    buf: new Float32Array(NP * 3),
  };
}

// A seed: of forty random cells of the wedge, the one whose domain is biggest
// on the panel, give or take, and not one of the last two periods, moved to its
// domain's centroid. The orbit is kept as a list, so it closes exactly however
// long it runs, and must stay within 44 LEDs of the centre: the 128 rows hold
// all of it and the 64 columns most.
function pick(P, G) {
  const Z = P.zoom, lo = 1.1, hi = 40 / Z;
  let best = 0;
  for (let t = 0; t < 40; t++) {
    const i = floor(CR * log((lo + (hi - lo) * random()) / RA)), j = floor((random() * PI * CR) / G.n), c = i * G.NJ + j;
    if (c >= G.next) continue;
    const p = G.M[c], rho = RA * exp((i + 0.5) / CR), a = (j + 0.5) / CR;
    if (!p || p === INSIDE || p > 12 * G.n) continue;
    const [cx, cy, area] = domain(G, rho * cos(a), rho * sin(a), p);
    const score = sqrt(min(area * Z * Z, 300)) * (0.5 + random()) * (P.seen.includes(p) ? 0.25 : 1);
    if (area * Z * Z < 8 || score <= best) continue;
    const ox = [cx], oy = [cy];
    let far = 0;
    for (let h = 0; h < p; h++) {
      const k = vtx(G, ox[h], oy[h]);
      if (k < 0) break;
      ox.push(2 * G.VX[k] - ox[h]);
      oy.push(2 * G.VY[k] - oy[h]);
      far = max(far, sqrt(ox[h] ** 2 + oy[h] ** 2));
    }
    if (ox.length <= p || far * Z > 44) continue;
    best = score;
    P.orb = { ox, oy, p, far };
  }
  if (best) {
    P.seen = [P.orb.p, P.seen[0]];
    P.k = P.ph = P.hops = 0;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = kv[0];
  P.speed = cl(kv[1], 0.2, 3);
  const n = cl(round(kv[2]), 5, 12);
  P.zoom = 5.2 * 2 ** (1.2 * cl(kv[3], -1, 1));
  if (n !== P.n || !P.G) {
    P.n = n;
    P.G = POLYS[n] || (POLYS[n] = makePoly(n));
    P.orb = null;
  }
  const G = P.G;
  grow(G);
  P.t += d;
  P.rot += d * P.speed * 0.045;
  // K1, or a zoom that has pushed the orbit off the panel: a new orbit.
  if ((input.btnPressed && input.btnPressed[0]) || (P.orb && P.orb.far * P.zoom > 52)) P.orb = null;
  if (!P.orb) {
    if (G.next > CR * log(30 / P.zoom / RA) * G.NJ) pick(P, G);
  } else {
    P.ph += d * P.speed * 1.2;
    while (P.ph >= 1) {
      P.ph -= 1;
      const o = P.orb;
      P.k = (P.k + 1) % o.p;
      P.marks.push([o.ox[P.k], o.oy[P.k], P.t, cl(o.p / (P.speed * 1.2), 4, 12)]);
      if (P.marks.length > 120) P.marks.shift();
      if (++P.hops >= max(o.p, 2 * o.p * (o.p < 16))) P.orb = null;
    }
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c];
}

// The colour of a period.
function makeLut(P) {
  const L = P.lut;
  for (let p = 1; p <= MAXIT; p++) {
    const v = cl(1.1 - 0.12 * log(p / (2 * P.n)) / log(2), 0.5, 1);
    hsv(P.hue + 0.55 + 0.618034 * p, 0.85, v * 255, L, p * 3);
  }
  P.lutKey = P.hue + "," + P.n;
}

// Additive splat with bilinear weights, in LEDs.
function splat(buf, x, y, a, r, g, b) {
  const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const X = x0 + i, Y = y0 + j;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const w = a * (i ? fx : 1 - fx) * (j ? fy : 1 - fy), q = (Y * W + X) * 3;
      buf[q] += w * r;
      buf[q + 1] += w * g;
      buf[q + 2] += w * b;
    }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.G) return;
  const G = P.G, { n, M, NJ, r } = G, Z = P.zoom, buf = P.buf, L = P.lut;
  if (P.lutKey !== P.hue + "," + n) makeLut(P);
  const off = CR * (log(Z) + log(RA)), turn = (P.rot / TAU) * n, K = (TAU / n) * CR, pin = PI / n;
  const w = 0.55 / Z;
  for (let p = 0; p < NP; p++) {
    let R = 0, Gc = 0, B = 0, first = -1, mixed = 0, tab = 0, rim = 0;
    for (let s = 0; s < 4; s++) {
      const q = p * 4 + s, rho = SR[q] / Z;
      let a = SA[q] * n - turn;
      a -= floor(a);
      if (a > 0.5) a = 1 - a;
      let per = 0;
      // In the polygon, or on its rim.
      if (rho < 1 + w) {
        const dd = rho * cos(pin - (a * TAU) / n) - r;
        if (dd < w) {
          dd > -w ? rim++ : tab++;
          continue;
        }
      }
      const i = floor(SL[q] - off), c = i * NJ + floor(a * K);
      if (i >= 0 && i < NI && c < G.next) per = M[c];
      if (per === INSIDE) per = 0;
      if (first < 0) first = per;
      else if (per !== first) mixed = 1;
      if (per) (R += L[per * 3]), (Gc += L[per * 3 + 1]), (B += L[per * 3 + 2]);
    }
    // Where the period changes inside a LED, a dark seam.
    const f = mixed || (tab && R + Gc + B) ? 0.15 : 0.25;
    buf[p * 3] = R * f + rim * 64 + tab * 9;
    buf[p * 3 + 1] = Gc * f + rim * 63 + tab * 9;
    buf[p * 3 + 2] = B * f + rim * 61 + tab * 12;
  }
  // The orbit: the points it has landed on, each fading over the time one
  // round takes (4 to 12 seconds), and the jump under way, a streak from the
  // point through the vertex to its image.
  const ca = cos(P.rot), sa = sin(P.rot);
  const sx = (x, y) => 32 + Z * (x * ca - y * sa), sy = (x, y) => 64 - Z * (x * sa + y * ca);
  for (const [x, y, t, life] of P.marks) {
    const a = 1 - (P.t - t) / life;
    if (a > 0) splat(buf, sx(x, y), sy(x, y), a * 255, 1, 1, 1);
  }
  const o = P.orb;
  if (o) {
    const k = P.k, k1 = (k + 1) % o.p, x0 = o.ox[k], y0 = o.oy[k], x1 = o.ox[k1], y1 = o.oy[k1];
    const u = cl(P.ph / 0.4, 0, 1), e = u * u * (3 - 2 * u), fade = P.ph < 0.4 ? 1 : 1 - (P.ph - 0.4) / 0.6;
    const ax = sx(x0, y0), ay = sy(x0, y0), bx = sx(x1, y1), by = sy(x1, y1);
    const len = sqrt((bx - ax) ** 2 + (by - ay) ** 2), steps = ceil((len * e) / 0.4);
    for (let j = 0; j <= steps; j++) {
      const v = steps ? (j / steps) * e : 0;
      splat(buf, ax + (bx - ax) * v, ay + (by - ay) * v, 170 * fade * (0.3 + 0.7 * (v / (e || 1))), 1, 0.97, 0.9);
    }
    const hx = ax + (bx - ax) * e, hy = ay + (by - ay) * e;
    splat(buf, hx, hy, 400, 1, 1, 1);
    const vx = (ax + bx) / 2, vy = (ay + by) / 2, fl = exp(-(((e - 0.5) * 5) ** 2)) * fade;
    splat(buf, vx, vy, 500 * fl, 1, 1, 1);
    for (let j = 0; j < 8; j++) splat(buf, vx + 1.5 * cos((j * PI) / 4), vy + 1.5 * sin((j * PI) / 4), 140 * fl, 1, 1, 1);
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, buf[p]), min(255, buf[p + 1]), min(255, buf[p + 2]));
}
