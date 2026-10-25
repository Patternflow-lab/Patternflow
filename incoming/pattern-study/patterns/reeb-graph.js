// ===== Patternflow pattern =====
// Title:   Reeb Graph
// Family:  topology
// Idea:    A closed surface of genus two to six, that many rings fused in one upright chain, turns slowly about the vertical while a level plane rises through it from the bottom, the surface below the plane lit solid and the surface above it a faint ghost, the cut drawn as bright rings on the plane, each ring shrinking to one point whose path down the inside of the chain draws the Reeb graph, a stem from the bottom that splits at the bottom of every hole and joins again at its top, so that each critical point flashes in its own colour as the plane passes it and the count of minima, saddles and maxima always comes to two minus twice the genus.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Morse theory (Marston Morse, 1934) and the Reeb graph (Georges Reeb, 1946), pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Holes=2..6, Tilt=0..1
//
// Knob 1: Hue. The surface's colour, with the cut, the graph and the three kinds of critical point turned with it. At 0 an azure surface cut in amber, minima green, saddles white, maxima magenta; at 0.25 magenta cut in lime, at 0.5 orange cut in azure, at 0.75 green cut in purple.
// Knob 2: Speed. At 2 the plane climbs the whole chain in 5 seconds, waits a second at the top and starts again, and the chain turns once in 16 seconds; at 0.2 both are ten times slower, at 3 half as fast again.
// Knob 3: Holes. The genus, the knob rounded: 2 at the start, 3 at a quarter, 4 at half, 5 at three quarters, 6 at the end. Genus g has one minimum, one maximum and 2g saddles, 1 - 2g + 1 = 2 - 2g, and its Reeb graph is a chain of g loops; the chain is scaled to fill the 128 rows each time.
// Knob 4: Tilt. Leans the chain off the vertical in the plane of its rings, 0.06 rad at the start and 1.05 rad (60 degrees) at 1, and the chain shrinks to keep fitting the panel as it turns. Up to about 0.8 the loops of the graph only slide into a staircase and the count stays 1, 2g, 1. Past that each ring overhangs the next: the joints grow short spurs, a new minimum with its saddle on the low side and a new maximum with its saddle on the high side, and from about 0.85 two holes share a level and the cut has three pieces at once; genus 2 at 1 counts 2, 6, 2 and genus 6 counts 6, 20, 4, and every count still comes to 2 - 2g.
// Buttons: K1 tap turns the height upside down: the plane sweeps down from the top, the top point is now the minimum and the bottom the maximum, and the count does not change. K2 tap starts the sweep again.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// An orthographic camera looking down at the chain from 0.36 rad above the
// level, so the cut shows as flat rings, a third as tall as they are wide.
const EL = 0.36, CA = cos(EL), SA = sin(EL);
// The surface, in units of the ring's radius: tube radius, distance between
// ring centres along the chain, and how wide the smooth union blends. The
// rings overlap by 0.15, so neighbours share one bar between their holes.
const TR = 0.32, GAP = 2.15, KS = 0.2;
// Tilt at knob 1, in radians.
const TILT = 1.05;
// Surface hue at Hue 0: azure.
const HUE0 = 0.58;
// Sphere tracing: closest approach that counts as a hit, and most steps.
const EPS = 0.004, STEPS = 48;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The chain being drawn. draw() and build() copy it here from the state
// before they touch the distance function, so two panels never mix.
let NG = 2, ST = 0, CT = 1, HALF = 0.5, CX = new Float64Array(8), CY = new Float64Array(8);
function use(S) {
  NG = S.g;
  ST = sin(S.tilt);
  CT = cos(S.tilt);
  HALF = (NG - 1) / 2;
  CX = S.cx;
  CY = S.cy;
}

// Signed distance to the surface in the chain's own frame: the rings lie in
// the x-y plane, y is height. Only the two rings either side of the point
// along the chain can be near it, so only those two are measured.
function sdf(x, y, z) {
  let k = floor((x * ST + y * CT) / GAP + HALF);
  if (k < 0) k = 0;
  else if (k > NG - 2) k = NG - 2;
  let ax = x - CX[k], ay = y - CY[k], q = sqrt(ax * ax + ay * ay) - 1;
  const a = sqrt(q * q + z * z) - TR;
  ax = x - CX[k + 1];
  ay = y - CY[k + 1];
  q = sqrt(ax * ax + ay * ay) - 1;
  const b = sqrt(q * q + z * z) - TR;
  const h = 0.5 + (0.5 * (b - a)) / KS;
  if (h <= 0) return b;
  if (h >= 1) return a;
  return b + (a - b) * h - KS * h * (1 - h);
}

// The same, with its gradient in GR: the polynomial smooth minimum's
// gradient is exactly the blend of the two rings' gradients.
const GR = new Float64Array(3);
function torusG(x, y, z, k, o) {
  const ax = x - CX[k], ay = y - CY[k], rh = sqrt(ax * ax + ay * ay) || 1e-9, q = rh - 1, d = sqrt(q * q + z * z) || 1e-9;
  TG[o] = ((q / d) * ax) / rh;
  TG[o + 1] = ((q / d) * ay) / rh;
  TG[o + 2] = z / d;
  return d - TR;
}
const TG = new Float64Array(6);
function sdfG(x, y, z) {
  let k = floor((x * ST + y * CT) / GAP + HALF);
  if (k < 0) k = 0;
  else if (k > NG - 2) k = NG - 2;
  const a = torusG(x, y, z, k, 0), b = torusG(x, y, z, k + 1, 3);
  const h = cl(0.5 + (0.5 * (b - a)) / KS, 0, 1);
  for (let i = 0; i < 3; i++) GR[i] = TG[i] * h + TG[i + 3] * (1 - h);
  return b + (a - b) * h - KS * h * (1 - h);
}

// Lay the chain out for genus g and tilt, fit it to the panel and find its
// Reeb graph.
function layout(S) {
  const g = S.g;
  for (let k = 0; k < g; k++) {
    const u = (k - (g - 1) / 2) * GAP;
    S.cx[k] = u * sin(S.tilt);
    S.cy[k] = u * cos(S.tilt);
  }
  // The panel must hold the chain at every turn: a point at height y and
  // distance r from the axis reaches screen heights y*CA +- r*SA.
  let rho = 0, bLo = 1e9, bHi = -1e9;
  for (let k = 0; k < g; k++)
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * 2 * PI;
      for (let j = 0; j < 12; j++) {
        const u = (j / 12) * 2 * PI, rr = 1 + TR * cos(u);
        const x = S.cx[k] + rr * cos(t), y = S.cy[k] + rr * sin(t), z = TR * sin(u), r = sqrt(x * x + z * z);
        rho = max(rho, r);
        bLo = min(bLo, y * CA - r * SA);
        bHi = max(bHi, y * CA + r * SA);
      }
    }
  S.rho = rho;
  S.yLo = S.cy[0] - 1 - TR;
  S.yHi = S.cy[g - 1] + 1 + TR;
  S.sc = min(62 / (2 * rho), 125 / (bHi - bLo));
  S.bc = (bHi + bLo) / 2;
  build(S);
}

// The Reeb graph, found the way it is defined: cut the surface at a level,
// count the pieces of the cut, and join each piece to the pieces it touches
// one level down. The surface is mirror symmetric in z and grows in |z| from
// the rings' plane, so every piece of a cut crosses the plane z = 0 in one
// run of x, and the runs along that line are the pieces. A level every half
// LED, a sample every 0.4 LED along it.
function build(S) {
  use(S);
  const s = S.sc, dy = 0.5 / s, dx = 0.4 / s, nl = ceil((S.yHi - S.yLo) / dy), nx = ceil((2 * S.rho) / dx) + 2;
  const NX = [], NY = [], NA = [], NB = [], L0 = [0];
  for (let i = 0; i < nl; i++) {
    const y = S.yLo + (i + 0.5) * dy;
    let prev = 1, xa = 0, sw = 0, swx = 0;
    for (let j = 0; j <= nx; j++) {
      const x = -S.rho - dx + j * dx, v = j === nx ? 1 : sdf(x, y, 0);
      if (v < 0) {
        if (prev >= 0) {
          xa = x - (dx * -v) / (prev - v);
          sw = swx = 0;
        }
        // Weighted by how far the piece reaches out of the plane, so the
        // point sits at the middle of the piece, not of the run.
        const u = v + TR, w = u <= 0 ? TR : sqrt(max(0, TR * TR - u * u));
        sw += w;
        swx += w * x;
      } else if (prev < 0) {
        NX.push(sw > 0 ? swx / sw : xa);
        NY.push(y);
        NA.push(xa);
        NB.push(x - (dx * v) / (v - prev));
      }
      prev = v;
    }
    L0.push(NX.length);
  }
  // Join the runs of neighbouring levels that overlap.
  const n = NX.length, up = new Int16Array(n), dn = new Int16Array(n), EA = [], EB = [];
  for (let i = 0; i + 1 < nl; i++)
    for (let a = L0[i]; a < L0[i + 1]; a++)
      for (let b = L0[i + 1]; b < L0[i + 2]; b++)
        if (NA[a] < NB[b] && NA[b] < NB[a]) {
          EA.push(a);
          EB.push(b);
          up[a]++;
          dn[b]++;
        }
  // Critical points: a run with nothing below is born at a minimum, one with
  // nothing above dies at a maximum, and every extra branch up or down is a
  // saddle, placed in the gap between the two branches.
  const C = [];
  for (let a = 0; a < n; a++) {
    if (!dn[a]) C.push(NX[a], NY[a] - dy / 2, 0);
    if (!up[a]) C.push(NX[a], NY[a] + dy / 2, 2);
  }
  // Edges are listed by lower run and then left to right, so the branches
  // of a split sit side by side in the list.
  for (let i = 0; i + 1 < EA.length; i++)
    if (EA[i + 1] === EA[i]) C.push((NB[EB[i]] + NA[EB[i + 1]]) / 2, NY[EA[i]] + dy / 2, 1);
  for (let b = 0; b < n; b++) {
    if (dn[b] < 2) continue;
    const lev = NY[b], row = [];
    for (let i = 0; i < EA.length; i++) if (EB[i] === b) row.push(EA[i]);
    row.sort((p, q) => NA[p] - NA[q]);
    for (let j = 0; j + 1 < row.length; j++) C.push((NB[row[j]] + NA[row[j + 1]]) / 2, lev - dy / 2, 1);
  }
  let nmin = 0, nsad = 0, nmax = 0;
  for (let i = 2; i < C.length; i += 3) C[i] === 0 ? nmin++ : C[i] === 1 ? nsad++ : nmax++;
  S.graph = { NX, NY, EA, EB, C, L0, dy, age: new Float32Array(C.length / 3).fill(-1), was: new Uint8Array(C.length / 3) };
  S.nMin = nmin;
  S.nSad = nsad;
  S.nMax = nmax;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, g: 0, tilt: -1, ph: 0, spin: 0.6, dir: 1,
    cx: new Float64Array(8), cy: new Float64Array(8), rho: 1, yLo: -1, yHi: 1, sc: 1, bc: 0, h: -1,
    graph: null, nMin: 0, nSad: 0, nMax: 0,
    buf: new Float32Array(W * H * 3), ov: new Float32Array(W * H), col: new Float32Array(24),
  };
}

// The plane takes 10 / Speed seconds to climb and waits 2 / Speed at the top.
const CLIMB = 10, WAIT = 2;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const g = cl(Math.round(kv[2]), 2, 6), tilt = cl(kv[3], 0, 1) * TILT;
  if (g !== S.g || abs(tilt - S.tilt) > 1e-4) {
    S.g = g;
    S.tilt = tilt;
    layout(S);
  }
  const bp = input.btnPressed || [];
  if (bp[0]) {
    S.dir = -S.dir;
    S.ph = 0;
  }
  if (bp[1]) S.ph = 0;
  S.spin += d * 0.2 * S.speed;
  S.ph += (d * S.speed) / CLIMB;
  if (S.ph > 1 + WAIT / CLIMB) S.ph = 0;
  const u = min(1, S.ph), lo = S.yLo - 0.04, hi = S.yHi + 0.04;
  S.h = S.dir > 0 ? lo + (hi - lo) * u : hi - (hi - lo) * u;
  // A critical point lights as the plane passes it and flashes for 0.8 s.
  const G = S.graph, C = G.C;
  for (let i = 0; i < G.age.length; i++) {
    const swept = S.dir > 0 ? C[3 * i + 1] <= S.h : C[3 * i + 1] >= S.h;
    if (swept && !G.was[i]) G.age[i] = 0;
    else if (G.age[i] >= 0) G.age[i] += d;
    G.was[i] = swept ? 1 : 0;
  }
}

// One ray through the panel's LED, in the chain's frame: origin at t = 0 and
// direction, filled by draw().
let OX = 0, OY = 0, OZ = 0, DX = 0, DY = 0, DZ = 0;
function march(t, end) {
  let v = 1;
  for (let n = 0; n < STEPS; n++) {
    v = sdf(OX + DX * t, OY + DY * t, OZ + DZ * t);
    if (v < EPS) return t;
    t += v;
    if (t > end) return -1e9;
  }
  // A ray that grazes the surface along a hole's edge runs out of steps
  // still close to it; that counts as a hit, or it would leave a black dot.
  return v < 0.03 ? t : -1e9;
}

// Splat one point of a line into the overlay, a tent one LED wide.
function dot(ov, fx, fy, w) {
  const x0 = floor(fx), y0 = floor(fy), ax = fx - x0, ay = fy - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const x = x0 + i, y = y0 + j;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const v = w * (i ? ax : 1 - ax) * (j ? ay : 1 - ay) * 1.6;
      if (v > ov[y * W + x]) ov[y * W + x] = min(1, v);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.graph) return;
  use(S);
  const s = S.sc, cp = cos(S.spin), sp = sin(S.spin), h = S.h, dir = S.dir, buf = S.buf, ov = S.ov, C = S.col;
  // Colours: surface lit and ghost, the cut's fill and its edge, the graph,
  // and the three kinds of critical point.
  const hb = HUE0 + S.hue, hc = hb + 0.5;
  hsv(hb, 0.72, 1, C, 0);
  hsv(hb, 0.45, 1, C, 3);
  hsv(hc, 0.9, 0.42, C, 6);
  hsv(hc, 0.75, 1, C, 9);
  hsv(hc + 0.03, 0.5, 1, C, 12);
  hsv(hb - 0.25, 0.8, 1, C, 15);
  C[18] = C[19] = C[20] = 1;
  hsv(hb + 0.3, 0.75, 1, C, 21);
  // Light from the upper left, in front, turned into the chain's frame.
  const lx0 = -0.5, ly = 0.72, lz0 = -0.48, ll = sqrt(lx0 * lx0 + ly * ly + lz0 * lz0);
  const lx = (lx0 * cp - lz0 * sp) / ll, lz = (lx0 * sp + lz0 * cp) / ll, lyn = ly / ll;
  // The ray direction in the chain's frame, the same for every LED.
  DX = -CA * sp;
  DY = -SA;
  DZ = CA * cp;
  // The chain's box: across the chain in its plane, along it, and out of it.
  const hw = 1 + TR + 0.07, hl = HALF * GAP + 1 + TR + 0.07, hz = TR + 0.07;
  const q1 = DX * CT - DY * ST, q2 = DX * ST + DY * CT;
  const pr = 31 / s;
  for (let py = 0; py < H; py++) {
    const b = S.bc + (63.5 - py) / s;
    for (let px = 0; px < W; px++) {
      const a = (px + 0.5 - 32) / s, o = (py * W + px) * 3;
      OX = a * cp - b * SA * sp;
      OY = b * CA;
      OZ = a * sp + b * SA * cp;
      let tA = -1e9, tB = 1e9;
      // Slab by slab, the stretch of the ray inside the box.
      const p1 = OX * CT - OY * ST, p2 = OX * ST + OY * CT;
      if (abs(q1) > 1e-9) {
        const u = (-hw - p1) / q1, v = (hw - p1) / q1;
        tA = max(tA, min(u, v));
        tB = min(tB, max(u, v));
      } else if (abs(p1) > hw) tB = -1e9;
      if (abs(q2) > 1e-9) {
        const u = (-hl - p2) / q2, v = (hl - p2) / q2;
        tA = max(tA, min(u, v));
        tB = min(tB, max(u, v));
      } else if (abs(p2) > hl) tB = -1e9;
      if (abs(DZ) > 1e-9) {
        const u = (-hz - OZ) / DZ, v = (hz - OZ) / DZ;
        tA = max(tA, min(u, v));
        tB = min(tB, max(u, v));
      } else if (abs(OZ) > hz) tB = -1e9;
      // Where the ray meets the level plane.
      const tp = (OY - h) / SA;
      let R = 0, G = 0, B = 0, ghost = -1e9, solid = -1e9, cap = false, ls = 0;
      if (tA < tB) {
        const above = dir > 0 ? -1 : 1;
        // Before the plane the ray is above it. Sweeping up, that is ghost.
        if (tA < tp) {
          const t = march(tA, min(tB, tp));
          if (above < 0) ghost = t;
          else solid = t;
        }
        if (tp >= tA && tp <= tB) {
          const x = OX + DX * tp, z = OZ + DZ * tp, v = sdfG(x, h, z);
          if (v < 0 && dir > 0) cap = true;
          // The cut's edge, a line one LED wide whatever its slope on the panel.
          const gX = GR[0] * cp + GR[2] * sp, gZ = -GR[0] * sp + GR[2] * cp, gs = sqrt(gX * gX + (gZ * gZ) / (SA * SA)) / s;
          ls = gs > 1e-6 ? cl(1.3 - abs(v) / gs, 0, 1) : 0;
        }
        if (!cap && solid < -1e8 && ((dir > 0) || ghost < -1e8)) {
          const t = march(max(tA, tp), tB);
          if (dir > 0) solid = t;
          else ghost = t;
        }
      }
      if (solid > -1e8) {
        sdfG(OX + DX * solid, OY + DY * solid, OZ + DZ * solid);
        const nl = GR[0] * lx + GR[1] * lyn + GR[2] * lz, nv = -(GR[0] * DX + GR[1] * DY + GR[2] * DZ);
        // Five flat bands of light, and a brighter band where the surface
        // turns away along the outline.
        let v = 0.16 + 0.84 * max(0, nl);
        v = (floor(v * 5) + 1) / 5;
        if (nv < 0.3) v = max(v, 0.6);
        R = C[0] * v;
        G = C[1] * v;
        B = C[2] * v;
      } else if (cap) {
        R = C[6];
        G = C[7];
        B = C[8];
      }
      if (ghost > -1e8) {
        sdfG(OX + DX * ghost, OY + DY * ghost, OZ + DZ * ghost);
        const nl = GR[0] * lx + GR[1] * lyn + GR[2] * lz;
        const v = nl > 0.35 ? 0.24 : 0.16;
        R = R * 0.6 + C[3] * v;
        G = G * 0.6 + C[4] * v;
        B = B * 0.6 + C[5] * v;
      }
      // The plane: a faint pane, its near and far edges a little brighter.
      const Zw = b * SA + tp * CA;
      if (abs(Zw) < pr && (dir > 0 || solid < -1e8)) {
        const e = (pr - abs(Zw)) * s * SA, f = e < 1 ? 0.2 : 0.05;
        R += f * 0.6;
        G += f * 0.65;
        B += f * 0.8;
      }
      if (ls > 0) {
        R += (C[9] - R) * ls;
        G += (C[10] - G) * ls;
        B += (C[11] - B) * ls;
      }
      buf[o] = R;
      buf[o + 1] = G;
      buf[o + 2] = B;
    }
  }
  // The Reeb graph: every edge between two levels the plane has passed,
  // through the middle of the chain.
  ov.fill(0);
  const P = S.graph, NX = P.NX, NY = P.NY, sx = (x, z) => 32 + (x * cp + z * sp) * s - 0.5;
  const sy = (x, y, z) => 63.5 - ((y * CA + (-x * sp + z * cp) * SA) - S.bc) * s;
  for (let i = 0; i < P.EA.length; i++) {
    const a = P.EA[i], c = P.EB[i];
    const ya = NY[a], yb = NY[c];
    if (dir > 0 ? yb > h : ya < h) continue;
    const x0 = sx(NX[a], 0), y0 = sy(NX[a], ya, 0), x1 = sx(NX[c], 0), y1 = sy(NX[c], yb, 0);
    const len = max(abs(x1 - x0), abs(y1 - y0)), n = ceil(len / 0.4) + 1;
    for (let j = 0; j <= n; j++) dot(ov, x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n, 1);
  }
  // Where each piece of the cut shrinks to now: the graph's growing tips.
  for (let p = 0; p < W * H; p++) {
    const w = ov[p];
    if (w <= 0) continue;
    const o = p * 3;
    buf[o] += (C[12] - buf[o]) * w;
    buf[o + 1] += (C[13] - buf[o + 1]) * w;
    buf[o + 2] += (C[14] - buf[o + 2]) * w;
  }
  // Each piece of the cut at the plane, shrunk to its point: the tips the
  // graph grows from.
  const lv = floor((h - S.yLo) / P.dy - 0.5) + (dir > 0 ? 0 : 1);
  if (lv >= 0 && lv < P.L0.length - 1)
    for (let a = P.L0[lv]; a < P.L0[lv + 1]; a++) {
      const fx = sx(NX[a], 0), fy = sy(NX[a], NY[a], 0);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const x = Math.round(fx) + i, y = Math.round(fy) + j;
          if (x < 0 || x >= W || y < 0 || y >= H || (i && j)) continue;
          const o = (y * W + x) * 3;
          buf[o] = buf[o + 1] = buf[o + 2] = 1;
        }
    }
  // Critical points the plane has passed: a dot in the colour of their
  // index, a ring that opens and fades as the plane crosses them, and a tick
  // at their height on the ruler down the left edge.
  const K = P.C;
  for (let i = 0; i < P.age.length; i++) {
    if (!P.was[i]) continue;
    let idx = K[3 * i + 2];
    if (dir < 0) idx = 2 - idx;
    const co = idx === 0 ? 15 : idx === 1 ? 18 : 21;
    const fx = sx(K[3 * i], 0), fy = sy(K[3 * i], K[3 * i + 1], 0), cx = Math.round(fx), cy = Math.round(fy);
    const put = (x, y, w) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const o = (y * W + x) * 3;
      buf[o] += (C[co] - buf[o]) * w;
      buf[o + 1] += (C[co + 1] - buf[o + 1]) * w;
      buf[o + 2] += (C[co + 2] - buf[o + 2]) * w;
    };
    put(cx, cy, 1);
    put(cx - 1, cy, 1);
    put(cx + 1, cy, 1);
    put(cx, cy - 1, 1);
    put(cx, cy + 1, 1);
    const ag = P.age[i];
    if (ag >= 0 && ag < 0.8) {
      const r = 1.5 + 9 * ag, w = 1 - ag / 0.8;
      for (let k = 0; k < 40; k++) put(Math.round(fx + r * cos((k / 40) * 2 * PI)), Math.round(fy + r * sin((k / 40) * 2 * PI) * 0.8), w);
    }
    const ty = Math.round(63.5 - (K[3 * i + 1] * CA - S.bc) * s);
    put(0, ty, 1);
    put(1, ty, 1);
  }
  const hy = Math.round(63.5 - (h * CA - S.bc) * s);
  for (let x = 0; x < 3; x++) {
    const o = (cl(hy, 0, H - 1) * W + x) * 3;
    buf[o] = buf[o + 1] = buf[o + 2] = 1;
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o] * 255) | 0, min(255, buf[o + 1] * 255) | 0, min(255, buf[o + 2] * 255) | 0);
}
