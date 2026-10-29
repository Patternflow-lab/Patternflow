// ===== Patternflow pattern =====
// Title:   Letter Melt
// Family:  type
// Idea:    A word of liquid stands in an invisible mould at the top of the panel, the mould lets go from the feet of the letters up so the strokes sag, drip and run down the full height into a pool on the floor, and then threads drawn up out of the pool fill the mould of the next word, MELT, 물, FLOW, 녹다, DRIP, from the top of each letter down until it sets.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 69, after Letter Sand (pattern round 64), particle fluid by double density relaxation (Simon Clavet, Philippe Beaudoin and Pierre Poulin, 2005)
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..5, Heat=0..1
//
// Knob 1: Hue. Turns the liquid round the wheel. At 0 it is a teal body with a pale aqua rim, at 0.25 blue violet, at 0.5 rose, at 0.65 gold.
// Knob 2: Speed. At 2 the fluid takes 60 steps a second and a word holds 1.8 s, melts in about 2.4 s and pours back in 2.9 s, so the five words come round in 36 s; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Word. 0 pours the five words in turn, MELT, 물, FLOW, 녹다 and DRIP. 1 to 5 hold one of them, and every pour goes back into that same mould.
// Knob 4: Heat. Cold liquid is thick: at 0.06 the mould holds the word 1.8 s, the lower strokes sag for about a second before they drip, and the strokes hang in long threads on the way down. Hot liquid is thin and shivers in the mould: at 1 the mould lets go after 0.5 s and the letters fall apart in loose blobs that splash.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, round, PI, cos, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The fluid, in LEDs and simulation steps. One step is 1/60 s at Speed 2.
const SP = 1.4; // rest spacing of the particles
const HR = 3.0; // interaction radius
const GRAV = 0.025; // LEDs a step, a step
const RISE = 1.3; // how fast a poured thread climbs, LEDs a step
const POUR = 1.6; // seconds a pour draws particles for
const KS = 0.06; // stiffness against the rest density
const KN = 0.15; // near stiffness, which keeps particles apart and gives the surface its tension
const STROKE = 2.2; // stroke radius of the mould letters
const GX = Math.ceil(W / HR), GY = Math.ceil(H / HR);

// Stroke centre lines in a unit box, y down. "O" is a stadium ring.
const LATIN = {
  M: [[0, 1, 0, 0, 0.5, 0.55, 1, 0, 1, 1]],
  E: [[1, 0, 0, 0, 0, 1, 1, 1], [0, 0.5, 0.8, 0.5]],
  L: [[0, 0, 0, 1, 1, 1]],
  T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  F: [[1, 0, 0, 0, 0, 1], [0, 0.47, 0.8, 0.47]],
  O: "ring",
  W: [[0, 0, 0.2, 1, 0.5, 0.45, 0.8, 1, 1, 0]],
  D: [[0, 0, 0, 1, 0.45, 1, 1, 0.78, 1, 0.22, 0.45, 0, 0, 0]],
  R: [[0, 1, 0, 0, 0.65, 0, 1, 0.14, 1, 0.34, 0.65, 0.48, 0, 0.48], [0.45, 0.48, 1, 1]],
  I: [[0.5, 0, 0.5, 1], [0.1, 0, 0.9, 0], [0.1, 1, 0.9, 1]],
  P: [[0, 1, 0, 0, 0.65, 0, 1, 0.15, 1, 0.37, 0.65, 0.52, 0, 0.52]],
};
// Hangul syllables drawn jamo by jamo in the same way.
const HANGUL = {
  물: [
    [0.18, 0, 0.82, 0, 0.82, 0.25, 0.18, 0.25, 0.18, 0],
    [0, 0.42, 1, 0.42],
    [0.5, 0.42, 0.5, 0.55],
    [0.18, 0.66, 0.82, 0.66, 0.82, 0.83, 0.18, 0.83, 0.18, 1, 0.82, 1],
  ],
  녹: [[0.12, 0, 0.12, 0.25, 0.88, 0.25], [0.5, 0.34, 0.5, 0.5], [0, 0.5, 1, 0.5], [0.1, 0.67, 0.9, 0.67, 0.9, 1]],
  다: [[0.5, 0.16, 0, 0.16, 0, 0.84, 0.5, 0.84], [0.8, 0, 0.8, 1], [0.8, 0.5, 1, 0.5]],
};
const WORDS = ["MELT", "물", "FLOW", "녹다", "DRIP"];

// Glyph boxes for a word: [char, x, y, w, h].
function boxes(word) {
  const n = [...word].length;
  if (HANGUL[word[0]]) {
    const w = n === 1 ? 56 : 29;
    return [...word].map((c, i) => [c, n === 1 ? 4 : 2 + i * 31, 5, w, 44]);
  }
  return [...word].map((c, i) => [c, 1.5 + i * 16, 6, 13, 36]);
}

// The stroke segments of one glyph in its box, in LEDs.
function segments(c, bx, by, bw, bh) {
  const out = [], x0 = bx + STROKE, y0 = by + STROKE, sw = bw - 2 * STROKE, sh = bh - 2 * STROKE;
  const g = LATIN[c] || HANGUL[c];
  if (g === "ring") {
    const r = sw / 2, cx = x0 + r, ya = y0 + r, yb = y0 + sh - r, pts = [];
    for (let k = 0; k <= 12; k++) pts.push(cx + r * cos(PI + (k * PI) / 12), ya + r * sin(PI + (k * PI) / 12));
    for (let k = 0; k <= 12; k++) pts.push(cx + r * cos((k * PI) / 12), yb + r * sin((k * PI) / 12));
    pts.push(pts[0], pts[1]);
    for (let i = 0; i + 3 < pts.length; i += 2) out.push(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
    return out;
  }
  for (const pl of g)
    for (let i = 0; i + 3 < pl.length; i += 2) out.push(x0 + pl[i] * sw, y0 + pl[i + 1] * sh, x0 + pl[i + 2] * sw, y0 + pl[i + 3] * sh);
  return out;
}

function segDist(px, py, s) {
  let best = 1e9;
  for (let i = 0; i < s.length; i += 4) {
    const ax = s[i], ay = s[i + 1], vx = s[i + 2] - ax, vy = s[i + 3] - ay;
    const t = cl(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    const dx = px - ax - t * vx, dy = py - ay - t * vy;
    best = min(best, dx * dx + dy * dy);
  }
  return sqrt(best);
}

// The mould of a word: its sites, a hexagonal lattice at the rest spacing
// inside the strokes, read from the top row down, and the spouts under each
// glyph that a pour draws its threads up through, one for every 16 LEDs of
// width. Each spout keeps its sites top row first, so a pour fills each
// letter from its top down.
function mould(word) {
  const xy = [], spouts = [], lists = [];
  for (const [c, gx, gy, gw, gh] of boxes(word)) {
    const m = max(1, round(gw / 16)), first = lists.length, segs = segments(c, gx, gy, gw, gh);
    for (let k = 0; k < m; k++) {
      spouts.push(gx + (gw * (k + 0.5)) / m, gy + gh + 2);
      lists.push([]);
    }
    for (let j = 0; ; j++) {
      const y = 3 + j * SP * 0.866;
      if (y > gy + gh) break;
      if (y < gy) continue;
      for (let x = 0.5 + (j % 2) * SP * 0.5; x < gx + gw; x += SP) {
        if (x < gx || segDist(x, y, segs) >= STROKE - 0.3) continue;
        // The nearest spout of the glyph.
        const k = first + min(m - 1, floor(((x - gx) / gw) * m));
        lists[k].push(xy.length / 2);
        xy.push(x, y);
      }
    }
  }
  const of = new Int32Array(xy.length / 2);
  lists.forEach((l, k) => l.forEach((i) => (of[i] = k)));
  return { xy: new Float64Array(xy), spouts: new Float64Array(spouts), lists: lists.map((l) => new Int32Array(l)), of, n: xy.length / 2 };
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

export function setup(params) {
  const MOULDS = WORDS.map(mould);
  let most = 0;
  for (const m of MOULDS) most = max(most, m.n);
  const N = min(1500, most + 460), MP = N * 16;
  // Rest density: what a particle in the middle of the lattice counts.
  let rho0 = 0;
  for (let j = -4; j <= 4; j++)
    for (let i = -4; i <= 4; i++) {
      const x = (i + (j % 2) * 0.5) * SP, y = j * SP * 0.866, r = sqrt(x * x + y * y);
      if (r > 0 && r < HR) rho0 += (1 - r / HR) ** 2;
    }
  params.s = {
    N, MOULDS, rho0, word: -1, phase: 0, started: false,
    // Doubles from the start, so the object keeps one shape.
    pt: 0.5, acc: 0.5, hue: 0.5,
    x: new Float64Array(N), y: new Float64Array(N), px: new Float64Array(N), py: new Float64Array(N),
    vx: new Float64Array(N), vy: new Float64Array(N), st: new Uint8Array(N), site: new Int32Array(N),
    rel: new Float64Array(N), kap: new Float64Array(N), tx: new Float64Array(N), ty: new Float64Array(N), rho: new Float64Array(N), rhn: new Float64Array(N),
    pa: new Int32Array(MP), pb: new Int32Array(MP), pn: 0, qx: new Float64Array(MP), qy: new Float64Array(MP), qq: new Float64Array(MP),
    cnt: new Int32Array(GX * GY + 1), fillc: new Int32Array(GX * GY), loose: new Int32Array(GX * GY), hd: new Uint8Array(N), idx: new Int32Array(N), cell: new Int32Array(N),
    F: new Float32Array(W * H), V: new Float32Array(W * H), pal: new Float32Array(64 * 3), rim: new Float32Array(3),
    nk: new Int32Array(8), arrived: 0, target: -1,
  };
  return params.s;
}

// Particle i takes site j of mould M in a given state, on a spring.
function fix(S, i, M, j, state) {
  S.st[i] = state;
  S.site[i] = j;
  S.kap[i] = 0.25;
  S.tx[i] = M.xy[2 * j];
  S.ty[i] = M.xy[2 * j + 1];
}

// Put word w in its mould and the rest of the particles in a pool on the
// floor.
function place(S, w) {
  const M = S.MOULDS[w], per = floor((W - 1) / SP);
  S.word = w;
  for (let i = 0; i < S.N; i++) {
    if (i < M.n) {
      fix(S, i, M, i, 1);
      S.x[i] = S.tx[i];
      S.y[i] = S.ty[i];
    } else {
      const k = i - M.n, j = floor(k / per);
      S.x[i] = 0.7 + (k % per) * SP + (j % 2) * SP * 0.5;
      S.y[i] = H - 0.7 - j * SP * 0.866;
      S.st[i] = 0;
      S.kap[i] = 0;
    }
    S.vx[i] = S.vy[i] = 0;
  }
  S.phase = 0;
  S.pt = 0;
}

// Counting sort of the particles into cells one interaction radius wide,
// then every pair closer than the radius, each once, with its unit vector
// and 1 - r/h, adding up both densities on the way. Returns the count.
function neighbours(S) {
  const { N, x, y, cnt, idx, cell, pa, pb, qx, qy, qq, rho, rhn, st, hd } = S;
  cnt.fill(0);
  // Particles the mould holds still skip each other: their springs keep
  // them apart. While the mould lets go every pair counts.
  for (let i = 0; i < N; i++) hd[i] = (st[i] === 1 && S.phase !== 1) || st[i] === 3 ? 1 : 0;
  rho.fill(0);
  rhn.fill(0);
  const loose = S.loose;
  loose.fill(0);
  for (let i = 0; i < N; i++) {
    const c = cl(floor(y[i] / HR), 0, GY - 1) * GX + cl(floor(x[i] / HR), 0, GX - 1);
    cell[i] = c;
    cnt[c + 1]++;
    if (!hd[i]) loose[c]++;
  }
  for (let c = 0; c < GX * GY; c++) cnt[c + 1] += cnt[c];
  const fill = S.fillc;
  fill.set(cnt.subarray(0, GX * GY));
  for (let i = 0; i < N; i++) idx[fill[cell[i]]++] = i;
  let n = 0;
  const h2 = HR * HR, MP = pa.length;
  for (let i = 0; i < N; i++) {
    const c = cell[i], cx = c % GX, cy = (c - cx) / GX, xi = x[i], yi = y[i], hi = hd[i];
    let ri = 0, ni = 0;
    for (let oy = 0; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        if (oy === 0 && ox < 0) continue;
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || nx >= GX || ny >= GY) continue;
        const cc = ny * GX + nx, own = cc === c;
        if (hi && !loose[cc]) continue;
        for (let k = cnt[cc], e = cnt[cc + 1]; k < e; k++) {
          const j = idx[k];
          if (own && j <= i) continue;
          const dx = x[j] - xi, dy = y[j] - yi, r2 = dx * dx + dy * dy;
          if (r2 >= h2 || n >= MP || (hi && hd[j])) continue;
          const r = sqrt(r2) || 1e-4, q = 1 - r / HR, q2 = q * q, q3 = q2 * q;
          pa[n] = i;
          pb[n] = j;
          qx[n] = dx / r;
          qy[n] = dy / r;
          qq[n++] = q;
          ri += q2;
          ni += q3;
          rho[j] += q2;
          rhn[j] += q3;
        }
      }
    rho[i] += ri;
    rhn[i] += ni;
  }
  return n;
}

// One step of the double density relaxation scheme: gravity, the pour's
// steering, viscous impulses, a free step, the two densities and their
// pressure displacements, the mould's springs, the walls, and velocity from
// the change in position. Each part is a loop of its own with as few rare
// branches as it can have.
function step(S, visc, jit) {
  const { N, st, vy } = S;
  for (let i = 0; i < N; i++) vy[i] += st[i] === 0 ? GRAV : 0;
  if (S.phase === 2) steer(S);
  viscosity(S, visc);
  advance(S);
  S.pn = neighbours(S);
  relax(S);
  if (S.phase === 1) melt(S);
  springs(S, jit);
  if (S.phase === 2) arrive(S);
}

// Drawn up: a thread rises at RISE LEDs a step to the spout under the
// glyph, and from there each particle heads for its own site.
function steer(S) {
  const { N, st, x, y, vx, vy, site } = S, M = S.MOULDS[S.target];
  for (let i = 0; i < N; i++) {
    if (st[i] !== 2) continue;
    const k = M.of[site[i]], spx = M.spouts[2 * k], spy = M.spouts[2 * k + 1];
    let dvx, dvy;
    if (y[i] > spy) {
      dvx = cl((spx - x[i]) * 0.15, -0.8, 0.8);
      dvy = -RISE;
    } else {
      const dx = M.xy[2 * site[i]] - x[i], dy = M.xy[2 * site[i] + 1] - y[i], d = sqrt(dx * dx + dy * dy) + 1e-6;
      const sc = min(RISE, d * 0.25) / d;
      dvx = dx * sc;
      dvy = dy * sc;
    }
    vx[i] += (dvx - vx[i]) * 0.35;
    vy[i] += (dvy - vy[i]) * 0.35;
  }
}

// Viscous impulses between approaching neighbours, over last step's pairs.
function viscosity(S, visc) {
  const { pa, pb, qx, qy, qq, vx, vy } = S, n = S.pn;
  for (let p = 0; p < n; p++) {
    const i = pa[p], j = pb[p], ux = qx[p], uy = qy[p];
    const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
    if (u <= 0) continue;
    const I = qq[p] * (visc * u + 0.25 * u * u) * 0.5, ix = I * ux, iy = I * uy;
    vx[i] -= ix;
    vy[i] -= iy;
    vx[j] += ix;
    vy[j] += iy;
  }
}

function advance(S) {
  const { N, x, y, px, py, vx, vy } = S;
  for (let i = 0; i < N; i++) {
    const f = min(1, 2.5 / sqrt(vx[i] * vx[i] + vy[i] * vy[i] + 1e-12));
    vx[i] *= f;
    vy[i] *= f;
    px[i] = x[i];
    py[i] = y[i];
    x[i] += vx[i];
    y[i] += vy[i];
  }
}

// Double density relaxation: a pressure from each density, and every pair
// pushed apart (or pulled together, near the surface) along its line.
function relax(S) {
  const { N, x, y, pa, pb, qx, qy, qq, rho, rhn, hd } = S, n = S.pn, rho0 = S.rho0;
  for (let i = 0; i < N; i++) {
    const free = 1 - hd[i];
    rho[i] = free * KS * (rho[i] - rho0);
    rhn[i] = free * KN * rhn[i];
  }
  for (let p = 0; p < n; p++) {
    const i = pa[p], j = pb[p], q = qq[p];
    const d = ((rho[i] + rho[j]) * q + (rhn[i] + rhn[j]) * q * q) * 0.5;
    const dx = d * qx[p], dy = d * qy[p];
    x[i] -= dx;
    y[i] -= dy;
    x[j] += dx;
    y[j] += dy;
  }
}

// The mould lets go: each held particle's spring weakens to nothing by its
// release time, so the lower strokes sag before they drip.
function melt(S) {
  const { N, st, kap, rel } = S, t = S.pt;
  for (let i = 0; i < N; i++) {
    if (st[i] !== 1) continue;
    const u = cl((rel[i] - t) / 0.9, 0, 1);
    kap[i] = 0.25 * u * u;
    if (u <= 0) st[i] = 0;
  }
}

// The springs, a shiver as hot as the liquid, the walls, and velocity.
function springs(S, jit) {
  const { N, x, y, px, py, vx, vy, kap, tx, ty } = S, j4 = jit * 4;
  for (let i = 0; i < N; i++) {
    const k = kap[i];
    const xi = x[i] + (tx[i] - x[i]) * k + (Math.random() - 0.5) * j4 * k;
    const yi = y[i] + (ty[i] - y[i]) * k + (Math.random() - 0.5) * j4 * k;
    x[i] = min(W - 0.5, max(0.5, xi));
    y[i] = min(H - 0.5, max(0.5, yi));
    vx[i] = x[i] - px[i];
    vy[i] = y[i] - py[i];
  }
}

// A drawn particle that reaches its site is held by the new mould.
function arrive(S) {
  const { N, st, x, y, site } = S, M = S.MOULDS[S.target];
  for (let i = 0; i < N; i++) {
    if (st[i] !== 2) continue;
    const dx = M.xy[2 * site[i]] - x[i], dy = M.xy[2 * site[i] + 1] - y[i];
    if (dx * dx + dy * dy < 0.8) {
      fix(S, i, M, site[i], 3);
      S.arrived++;
    }
  }
}

// The free particle nearest the top of the pool under a spout.
function pick(S, spx) {
  const { N, st, x, y } = S;
  let best = -1, bs = 1e9;
  for (let i = 0; i < N; i++) {
    if (st[i] !== 0) continue;
    const sc = abs(x[i] - spx) * 2 + y[i];
    if (sc < bs) {
      bs = sc;
      best = i;
    }
  }
  return best;
}

// The cycle, one step at a time: the mould holds, lets go, and a pour fills
// the next mould.
function tick(S, sel, heat) {
  const { N, st, y } = S;
  S.pt += 1 / 60;
  if (S.phase === 0 && S.pt > 1.9 - 1.4 * heat) {
    // The mould lets go from the feet of the letters up.
    S.phase = 1;
    S.pt = 0;
    const spread = 1.1 - 0.6 * heat;
    for (let i = 0; i < N; i++) if (st[i] === 1) S.rel[i] = 0.1 + spread * cl((52 - y[i]) / 47, 0, 1) + Math.random() * 0.3;
  } else if (S.phase === 1 && S.pt > 1.6) {
    let held = 0, high = 0;
    for (let i = 0; i < N; i++) {
      if (st[i] === 1) held++;
      else if (y[i] < 80) high++;
    }
    if (!held && (high < N * 0.03 || S.pt > 5)) {
      // Pour: each spout of the next word draws its sites, top row first,
      // from the particles near the top of the pool under it.
      S.phase = 2;
      S.pt = 0;
      S.target = sel ? sel - 1 : (S.word + 1) % WORDS.length;
      S.nk.fill(0);
      S.arrived = 0;
    }
  } else if (S.phase === 2) {
    const M = S.MOULDS[S.target], f = min(1, S.pt / POUR);
    let done = true;
    for (let k = 0; k < M.lists.length; k++) {
      const l = M.lists[k];
      while (S.nk[k] < f * l.length) {
        const i = pick(S, M.spouts[2 * k]);
        if (i < 0) break;
        st[i] = 2;
        S.kap[i] = 0;
        S.site[i] = l[S.nk[k]++];
      }
      if (S.nk[k] < l.length) done = false;
    }
    if (done && (S.arrived >= M.n || S.pt > POUR + 4)) {
      // Set: the new word stands in its mould.
      for (let i = 0; i < N; i++) if (st[i] >= 2) fix(S, i, M, S.site[i], 1);
      S.word = S.target;
      S.target = -1;
      S.phase = 0;
      S.pt = 0;
    }
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const rate = cl(kv[1], 0.2, 3) / 2, sel = cl(round(kv[2]), 0, 5), heat = cl(kv[3], 0, 1);
  S.hue = kv[0] || 0;
  if (!S.started) {
    S.started = true;
    S.acc = 0;
    place(S, sel ? sel - 1 : 0);
    S.pt = 0.4;
  }
  const visc = 0.5 * (1 - heat) ** 2 + 0.08, jit = 0.02 + 0.12 * heat;
  S.acc += cl(dt || 0, 0, 0.1) * rate * 60;
  while (S.acc >= 1) {
    S.acc -= 1;
    tick(S, sel, heat);
    step(S, visc, jit);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { F, V, x, y, vx, vy, N, pal, rim } = S;
  F.fill(0);
  V.fill(0);
  // Splat every particle into a density field and a speed field.
  const R = 2.1, R2 = R * R;
  for (let i = 0; i < N; i++) {
    const cx = x[i], cy = y[i], sp = sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
    const x0 = max(0, floor(cx - R + 0.5)), x1 = min(W - 1, floor(cx + R - 0.5));
    const y0 = max(0, floor(cy - R + 0.5)), y1 = min(H - 1, floor(cy + R - 0.5));
    for (let Y = y0; Y <= y1; Y++) {
      const dy = Y + 0.5 - cy;
      for (let X = x0; X <= x1; X++) {
        const dx = X + 0.5 - cx, d2 = dx * dx + dy * dy;
        if (d2 >= R2) continue;
        const w = (1 - d2 / R2) ** 2, o = Y * W + X;
        F[o] += w;
        V[o] += w * sp;
      }
    }
  }
  // The body runs from a deep shade inside to the lit colour near the
  // surface; the rim is pale.
  const h0 = 0.47 + S.hue;
  for (let k = 0; k < 64; k++) {
    const u = k / 63;
    hsv(h0 + 0.07 * u, 0.82 + 0.1 * u, 0.78 - 0.4 * u, pal, k * 3);
  }
  hsv(h0 - 0.03, 0.35, 1, rim, 0);
  const LX = -0.45, LY = -0.89;
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const o = Y * W + X, f = F[o];
      if (f < 0.35) continue;
      const a = cl((f - 0.35) / 0.55, 0, 1);
      const gx = (X < W - 1 ? F[o + 1] : f) - (X > 0 ? F[o - 1] : f);
      const gy = (Y < H - 1 ? F[o + W] : f) - (Y > 0 ? F[o - W] : f);
      const gl = sqrt(gx * gx + gy * gy) + 1e-6;
      // Outward normal and its light.
      const lit = (-gx * LX - gy * LY) / gl, edge = cl(1 - (f - 0.9) / 1.3, 0, 1);
      const spec = edge * cl(lit, 0, 1) ** 3 * cl(gl, 0, 1);
      const deep = cl((f - 0.9) / 2.2, 0, 1), k = floor(deep * 63) * 3;
      const foam = cl((V[o] / f - 0.6) * 0.6, 0, 0.5);
      const sh = 0.75 + 0.25 * cl(lit, -1, 1) * edge;
      // The lit side of the surface and fast liquid take the pale rim colour.
      const m = max(spec, foam);
      const r = (pal[k] * sh * (1 - m) + rim[0] * m) * a;
      const g = (pal[k + 1] * sh * (1 - m) + rim[1] * m) * a;
      const b = (pal[k + 2] * sh * (1 - m) + rim[2] * m) * a;
      display.setPixel(X, Y, min(255, r) | 0, min(255, g) | 0, min(255, b) | 0);
    }
}
