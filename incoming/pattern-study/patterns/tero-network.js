// ===== Patternflow pattern =====
// Title:   Tero Network
// Family:  sim
// Idea:    About 450 knots joined by about 1,100 tubes lie over the standing panel, each tube a glowing vein whose width and light follow its conductivity, and food knots from the top row to the bottom take turns as source and sink, so the tubes that carry the flow thicken and the rest fade until the lit mesh has condensed into a few bright veins that join the foods, with pulses of light running down the strongest veins from source to sink and the Loops knob choosing between a bare tree and the whole mesh.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the adaptive transport network of the slime mould Physarum polycephalum (Atsushi Tero, Ryo Kobayashi and Toshiyuki Nakagaki, A mathematical model for adaptive transport network in path finding by true slime mold, J. Theor. Biol. 244, 2007; Tero, Takagi, Saigusa, Ito, Bebber, Fricker, Yumiki, Kobayashi and Nakagaki, Rules for biologically inspired adaptive network design, Science 327, 2010), after the maze-solving experiment (Nakagaki, Yamada and Toth, Nature 407, 2000), pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Loops=-1..1, Foods=4..9
//
// Knob 1: Hue. Turns the veins round the wheel. At 0 the strong veins are cyan and the ones fading are azure, at 0.25 magenta, at 0.5 orange and at 0.75 green. The foods stay gold and the pulses white at every setting.
// Knob 2: Speed. At 2 one pair of foods holds the flow for 1.4 s, a tube's conductivity relaxes with a time constant of 1.7 s, so a vein the flow has left falls to a third of its conductivity in 1.8 s and a new path is half grown in 1.2 s, and a pulse runs about 20 LEDs a second down a vein. At 0.2 all of it is ten times slower, at 3 one and a half times faster.
// Knob 3: Loops. The exponent g of f(Q) = Q^g / (1 + Q^g) is 1.7 - 0.75 K3. At -1 (g 2.45) the foods are joined by a bare tree and the few loops the pairs of foods make, about 9 percent of the tubes lit with 5 independent loops in about 460 LEDs of vein. At 0 (g 1.7) 16 percent are lit, 11 loops, 770 LEDs. At 0.5 (g 1.3) a fine mesh stays round the veins, 28 percent lit, 48 loops, 1,380 LEDs, and at 1 (g 0.95) 60 percent of the tubes keep a little flow and the panel is a lit web, 280 loops in 3,000 LEDs. Turned from 1 to -1 while it runs, the lit tubes fall from 61 to 29 percent in 2 s and to 8 percent in 14 s; turned back they regrow to 50 percent in 8 s.
// Knob 4: Foods. 4 to 9 food knots, 6, 10, 21, 28 or 36 pairs for the stops 4, 5, 7, 8 and 9 (a knob stop between rounds to the nearest). The foods sit on a fixed spread whose every prefix reaches from the top row to the bottom, the first two at about row 2 and row 126. The sink of one turn is the source of the next and the next sink is the food that has waited longest, so every food is joined within one round of the pairs; with 9 the net is a ring with chords and the veins of an older pair are still faintly lit when a new one starts.

// The model is Tero, Kobayashi and Nakagaki's. Every tube between knots i and
// j has a length L, here 3.3 to 6.6 LEDs, and a conductivity D. The flux along
// it is Q = D (p_i - p_j) / L. Kirchhoff's law holds at every knot but two:
// the current I0 flows in at the source and out at the sink. That is a linear
// system for the pressures p, the graph Laplacian with weights D / L, solved
// every frame by conjugate gradients with a Jacobi preconditioner, warm
// started from the last frame's p, in 20 iterations or so; knot 0 is held at
// zero so the system has one answer. Then every conductivity moves toward
// what its flux asks for,
//
//   dD/dt = LAM (|Q|^g / (1 + |Q|^g) - D),
//
// so a tube that carries flow grows and one that carries none decays, and
// the tubes that carry the flow of the next pair have only what is left.
//
// Two numbers set the scale and neither is in the paper. I0 is 6. At 1.2 the
// pre-run left the median tube at a conductivity of 0.03 and the strongest at
// 0.2, because the flux through any one of 1,100 tubes is small and f of a
// small flux is small, so no vein ever parted from the mesh. LAM is 0.6 per
// model second, so the memory of a pair is about a pair long: the veins of
// the last three pairs show at once, the newest brightest.
//
// The brief this was built from said that g above 1 keeps redundant loops
// and g at 1 gives the shortest path. On this mesh with a new pair of foods
// every 1.4 s the loops come from the pairs, a different path for each, and a
// larger g only prunes harder (K3 = -1); a g under 1 keeps every tube a
// little lit. The picture is what the model did, not what it was expected to.
//
// The change of pair is blended over 0.45 s, the inflow moving from the old
// source and sink to the new, so the pressures move smoothly and the warm
// start stays a good one. The pulses are bands of constant phase in the
// pressure, six across the whole span from source to sink, and the phase
// runs down the pressure, so a bright band travels along every vein from
// the source to the sink with the flow and the bands on parallel veins
// arrive together.
//
// Drawing: a vein is an anti-aliased segment between its two knots, 0.8 to
// 2.7 LEDs wide, its light D / (D + 0.16) so that a tube at D = 0.1 shows at a
// third and one at 0.6 at four fifths; a tube below D = 0.02 is not drawn,
// and each knot is a dim dot, brighter where a vein runs in. The tubes the
// flow runs through at this moment are lit a little brighter and whiter than
// the ones that only remember it.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, sin, cos, exp, pow, abs, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// ---- The mesh. Poisson-disc points at least R LEDs apart, about 450 on the
// panel, joined by their Delaunay triangulation, so no tube lies along a
// lattice direction and no two have the same length. Tubes longer than 2 R
// at the rim are cut and a tenth of the rest left out, but a knot keeps at
// least three where it can.
const R = 3.3, DROP = 0.1;

function poisson() {
  const cs = R / sqrt(2), gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), grid = new Int32Array(gw * gh).fill(-1);
  const pts = [], act = [];
  const add = (x, y) => {
    grid[floor(y / cs) * gw + floor(x / cs)] = pts.length;
    act.push(pts.length);
    pts.push([x, y]);
  };
  add(W / 2, H / 2);
  while (act.length) {
    const ai = floor(Math.random() * act.length), [px, py] = pts[act[ai]];
    let ok = false;
    for (let k = 0; k < 24 && !ok; k++) {
      const a = Math.random() * TAU, r = R * (1 + Math.random()), x = px + r * cos(a), y = py + r * sin(a);
      if (x < 1.5 || x > W - 1.5 || y < 1.5 || y > H - 1.5) continue;
      const gx = floor(x / cs), gy = floor(y / cs);
      let near = false;
      for (let yy = max(0, gy - 2); yy <= min(gh - 1, gy + 2) && !near; yy++)
        for (let xx = max(0, gx - 2); xx <= min(gw - 1, gx + 2); xx++) {
          const q = grid[yy * gw + xx];
          if (q >= 0 && (pts[q][0] - x) ** 2 + (pts[q][1] - y) ** 2 < R * R) { near = true; break; }
        }
      if (!near) { add(x, y); ok = true; }
    }
    if (!ok) act.splice(ai, 1);
  }
  return pts;
}

// Bowyer-Watson. The returned edges are index pairs, each once.
function delaunay(P) {
  const n = P.length, big = 1e4;
  const X = P.map((q) => q[0]).concat([-big, big, 0]), Y = P.map((q) => q[1]).concat([-big, -big, big]);
  const mk = (a, b, c) => {
    const ax = X[a], ay = Y[a], bx = X[b], by = Y[b], cx = X[c], cy = Y[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { a, b, c, ux, uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let tris = [mk(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const bad = [], keep = [];
    for (const t of tris) ((X[i] - t.ux) ** 2 + (Y[i] - t.uy) ** 2 < t.r2 ? bad : keep).push(t);
    const cnt = new Map();
    for (const t of bad)
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
        const key = u < v ? u * 100000 + v : v * 100000 + u;
        cnt.set(key, (cnt.get(key) || 0) + 1);
      }
    for (const [key, c] of cnt) if (c === 1) keep.push(mk(floor(key / 100000), key % 100000, i));
    tris = keep;
  }
  const seen = new Set(), out = [];
  for (const t of tris)
    for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      if (u >= n || v >= n) continue;
      const key = u < v ? u * 100000 + v : v * 100000 + u;
      if (!seen.has(key)) { seen.add(key); out.push(u < v ? [u, v] : [v, u]); }
    }
  return out;
}

// ---- The model. Flux Q = D (p_i - p_j) / L along a tube of length L and
// conductivity D; the fluxes at every knot sum to zero but at the source
// (+I0) and the sink (-I0); dD/dt = LAM (|Q|^g / (1 + |Q|^g) - D).
const I0 = 6, LAM = 0.6, DMIN = 0.002, T_PAIR = 1.4, BLEND = 0.45;

export function setup(params) {
  const pts = poisson(), N = pts.length;
  const px = pts.map((q) => q[0]), py = pts.map((q) => q[1]);
  let ed = delaunay(pts).filter(([u, v]) => hypot(px[u] - px[v], py[u] - py[v]) < 2 * R);
  const deg = new Int32Array(N);
  for (const [u, v] of ed) { deg[u]++; deg[v]++; }
  ed = ed.filter(([u, v]) => {
    if (Math.random() < DROP && deg[u] > 3 && deg[v] > 3) { deg[u]--; deg[v]--; return false; }
    return true;
  });
  const ea = ed.map((e) => e[0]), eb = ed.map((e) => e[1]), E = ea.length;
  const L = new Float64Array(E);
  for (let e = 0; e < E; e++) L[e] = hypot(px[ea[e]] - px[eb[e]], py[ea[e]] - py[eb[e]]);

  // Food layout: fractions of the width and height; any prefix spans top to bottom.
  const lay = [[0.3, 0.02], [0.7, 0.98], [0.9, 0.42], [0.1, 0.6], [0.62, 0.2], [0.14, 0.3], [0.86, 0.78], [0.5, 0.52], [0.36, 0.86]];
  const seen = new Uint8Array(N), adj = Array.from({ length: N }, () => []);
  for (let e = 0; e < E; e++) { adj[ea[e]].push(eb[e]); adj[eb[e]].push(ea[e]); }
  const queue = [0];
  seen[0] = 1;
  for (let q = 0; q < queue.length; q++) for (const m of adj[queue[q]]) if (!seen[m]) { seen[m] = 1; queue.push(m); }
  const food = lay.map(([fx, fy]) => {
    const x = (fx + (Math.random() - 0.5) * 0.06) * W, y = (fy + (Math.random() - 0.5) * 0.04) * H;
    let best = 0, bd = 1e9;
    for (let k = 0; k < N; k++) {
      const d = (px[k] - x) ** 2 + (py[k] - y) ** 2;
      if (seen[k] && d < bd) { bd = d; best = k; }
    }
    return best;
  });

  params.s = {
    N, E, px: Float64Array.from(px), py: Float64Array.from(py), ea: Int32Array.from(ea), eb: Int32Array.from(eb), L,
    D: new Float64Array(E).fill(0.6), Q: new Float64Array(E), c: new Float64Array(E),
    p: new Float64Array(N), r: new Float64Array(N), z: new Float64Array(N), d: new Float64Array(N), Ad: new Float64Array(N),
    diag: new Float64Array(N), bv: new Float64Array(N),
    food, nf: 0, last: new Float64Array(9), turn: 0, cur: [food[0], food[1]], old: [food[0], food[1]], tp: 0,
    phase: 0, hue: 0, init: false, buf: new Float32Array(NP * 3), nbr: new Float32Array(N), pmin: 0, pmax: 1,
  };
}

// The sink of one turn is the source of the next, and the next sink is the
// food that has waited longest, so every food joins the net within a round.
function nextPair(S) {
  const nf = S.nf;
  let src = S.food.indexOf(S.cur[1]);
  if (src < 0 || src >= nf) src = floor(Math.random() * nf);
  let sink = -1, best = 1e9;
  for (let f = 0; f < nf; f++) {
    if (f === src) continue;
    const v = S.last[f] + Math.random() * 1.5;
    if (v < best) { best = v; sink = f; }
  }
  S.last[sink] = ++S.turn;
  S.old = S.cur;
  S.cur = [S.food[src], S.food[sink]];
  S.tp = 0;
}

// Jacobi-preconditioned conjugate gradients on the Laplacian with
// conductance D / L, knot 0 held at pressure 0. Warm start from the last p.
function solve(S, maxIt, tol) {
  const { N, E, ea, eb, c, p, r, z, d, Ad, diag, bv } = S;
  diag.fill(0);
  for (let e = 0; e < E; e++) { diag[ea[e]] += c[e]; diag[eb[e]] += c[e]; }
  Ad.fill(0);
  for (let e = 0; e < E; e++) {
    const f = c[e] * (p[ea[e]] - p[eb[e]]);
    Ad[ea[e]] += f;
    Ad[eb[e]] -= f;
  }
  let rz = 0, bb = 0;
  p[0] = 0;
  for (let i = 0; i < N; i++) {
    r[i] = i === 0 ? 0 : bv[i] - Ad[i];
    z[i] = i === 0 || diag[i] === 0 ? 0 : r[i] / diag[i];
    d[i] = z[i];
    rz += r[i] * z[i];
    bb += bv[i] * bv[i];
  }
  const stop = tol * tol * bb;
  for (let it = 0; it < maxIt; it++) {
    let rr = 0;
    for (let i = 0; i < N; i++) rr += r[i] * r[i];
    if (rr < stop) break;
    Ad.fill(0);
    for (let e = 0; e < E; e++) {
      const f = c[e] * (d[ea[e]] - d[eb[e]]);
      Ad[ea[e]] += f;
      Ad[eb[e]] -= f;
    }
    Ad[0] = 0;
    let dAd = 0;
    for (let i = 0; i < N; i++) dAd += d[i] * Ad[i];
    if (dAd <= 1e-30) break;
    const al = rz / dAd;
    let rzn = 0;
    for (let i = 0; i < N; i++) {
      p[i] += al * d[i];
      r[i] -= al * Ad[i];
      z[i] = i === 0 || diag[i] === 0 ? 0 : r[i] / diag[i];
      rzn += r[i] * z[i];
    }
    const be = rzn / rz;
    rz = rzn;
    for (let i = 0; i < N; i++) d[i] = z[i] + be * d[i];
  }
}

// One frame of the model: set the inflow for the pair (blended from the
// last pair to this one), solve for the pressures, read the fluxes, and move
// every conductivity toward f(|Q|) by dt model seconds.
function model(S, dt, g, maxIt) {
  const { N, E, ea, eb, L, D, Q, c, p, bv } = S;
  S.tp += dt;
  if (S.tp >= T_PAIR) nextPair(S);
  const w = ease(S.tp / BLEND);
  bv.fill(0);
  bv[S.cur[0]] += w * I0;
  bv[S.cur[1]] -= w * I0;
  bv[S.old[0]] += (1 - w) * I0;
  bv[S.old[1]] -= (1 - w) * I0;
  for (let e = 0; e < E; e++) c[e] = D[e] / L[e];
  solve(S, maxIt, 1e-3);
  let pmin = 1e9, pmax = -1e9;
  for (let i = 0; i < N; i++) { if (p[i] < pmin) pmin = p[i]; if (p[i] > pmax) pmax = p[i]; }
  S.pmin = pmin;
  S.pmax = max(pmax, pmin + 1e-9);
  const k = 1 - exp(-LAM * dt);
  for (let e = 0; e < E; e++) {
    const q = abs(c[e] * (p[ea[e]] - p[eb[e]]));
    Q[e] = q;
    const qg = pow(q, g);
    D[e] += (qg / (1 + qg) - D[e]) * k;
    if (D[e] < DMIN) D[e] = DMIN;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 4];
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const g = 1.7 - 0.75 * cl(k[2] || 0, -1, 1);
  const nf = cl(round(k[3] == null ? 4 : k[3]), 4, 9);
  if (nf !== S.nf) {
    S.nf = nf;
    nextPair(S);
  }
  const ds = cl(dt || 0, 0, 0.1) * speed * 0.5;
  if (!S.init) {
    S.init = true;
    for (let i = 0; i < 160; i++) model(S, 0.05, g, 80);
  }
  S.phase += ds;
  model(S, ds, g, 60);
}

// Screen-blend a colour at weight v onto the frame buffer.
function put(buf, o, r, g, b, v) {
  const rr = r * v, gg = g * v, bb = b * v;
  buf[o] += rr - buf[o] * rr;
  buf[o + 1] += gg - buf[o + 1] * gg;
  buf[o + 2] += bb - buf[o + 2] * bb;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { N, E, ea, eb, px, py, D, Q, p, buf, nbr } = S;
  buf.fill(0);
  let qmax = 1e-9;
  for (let e = 0; e < E; e++) if (Q[e] > qmax) qmax = Q[e];
  const h0 = 0.5 + S.hue, rng = S.pmax - S.pmin;
  nbr.fill(0);
  for (let e = 0; e < E; e++) {
    const i = ea[e], j = eb[e], x0 = px[i], y0 = py[i], x1 = px[j], y1 = py[j];
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    const dd = D[e];
    const qw = cl((Q[e] / qmax) * 1.5 - 0.15, 0, 1);
    const u = dd / (dd + 0.16);
    const lum = 0.82 * pow(u, 0.85) * (0.72 + 0.28 * qw);
    if (lum > nbr[i]) nbr[i] = lum;
    if (lum > nbr[j]) nbr[j] = lum;
    if (lum < 0.04) continue;
    const wd = 0.8 + 1.5 * sqrt(cl(dd / 0.6, 0, 1)) + 0.4 * qw;
    const m = cl((dd - 0.03) / 0.4, 0, 1) * (0.6 + 0.4 * qw);
    const [cr, cg, cb] = hsv(h0 + 0.12 * (1 - m), 0.95 - 0.3 * m, 1);
    const R = wd / 2 + 1;
    const xa = max(0, floor(min(x0, x1) - R)), xb = min(W - 1, floor(max(x0, x1) + R));
    const ya = max(0, floor(min(y0, y1) - R)), yb = min(H - 1, floor(max(y0, y1) + R));
    for (let yy = ya; yy <= yb; yy++)
      for (let xx = xa; xx <= xb; xx++) {
        const qx = xx + 0.5, qy = yy + 0.5;
        const t = cl(((qx - x0) * dx + (qy - y0) * dy) / l2, 0, 1);
        const ex = qx - (x0 + t * dx), ey = qy - (y0 + t * dy);
        const cov = cl(wd / 2 + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
        if (cov <= 0) continue;
        let v = cov * lum, pulse = 0;
        if (qw > 0.04) {
          const pp = (p[i] + (p[j] - p[i]) * t - S.pmin) / rng;
          pulse = pow(0.5 + 0.5 * cos(TAU * (6 * pp + S.phase * 1.1)), 2) * qw;
          v *= 1 - 0.45 * qw + 0.45 * qw * pulse;
        }
        const o = (yy * W + xx) * 3;
        put(buf, o, cr, cg, cb, v);
        if (pulse > 0.02) put(buf, o, 1, 1, 1, pulse * cov * 0.55);
      }
  }
  // The knots: a dim dot each, brighter where a vein runs in.
  const [kr, kg, kb] = hsv(h0 + 0.12, 0.9, 1);
  for (let k = 0; k < N; k++) {
    const x0 = px[k], y0 = py[k], v0 = 0.22 + 0.3 * nbr[k];
    const ix = floor(x0), iy = floor(y0);
    for (let yy = iy; yy <= iy + 1; yy++)
      for (let xx = ix; xx <= ix + 1; xx++) {
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const w = (1 - abs(xx + 0.5 - x0)) * (1 - abs(yy + 0.5 - y0));
        if (w > 0) put(buf, (yy * W + xx) * 3, kr, kg, kb, w * v0);
      }
  }
  // Foods: a gold dot, larger and brighter while it is the source or the sink.
  const gold = hsv(0.12, 0.55, 1);
  for (let f = 0; f < S.nf; f++) {
    const k = S.food[f], x0 = px[k], y0 = py[k];
    const act = (k === S.cur[0] || k === S.cur[1] ? 1 : 0);
    const rad = 1.4 + 0.9 * act;
    for (let yy = max(0, floor(y0 - 3)); yy <= min(H - 1, floor(y0 + 3)); yy++)
      for (let xx = max(0, floor(x0 - 3)); xx <= min(W - 1, floor(x0 + 3)); xx++) {
        const cov = cl(rad + 0.5 - hypot(xx + 0.5 - x0, yy + 0.5 - y0), 0, 1) * (0.55 + 0.45 * act);
        if (cov > 0) put(buf, (yy * W + xx) * 3, gold[0], gold[1], gold[2], cov);
      }
  }
  for (let q = 0, yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++, q += 3) display.setPixel(xx, yy, round(min(1, buf[q]) * 255), round(min(1, buf[q + 1]) * 255), round(min(1, buf[q + 2]) * 255));
}
