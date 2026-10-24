// ===== Patternflow pattern =====
// Title:   Eruption
// Family:  volcano
// Idea:    A stratovolcano cut in half at dusk: gas slugs leave the glowing magma chamber, climb the conduit through bent beds of ochre, ash and basalt and burst in the crater, throwing bombs on arcs while lava runs down the flanks and an ash column with lightning in it climbs to the top of the panel.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after the cutaway drawing of a stratovolcano in a geology textbook
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Style=0..1, Speed=0.2..3, Pressure=0..1, Wind=-1..1
//
// Knob 1: Style. Strombolian at 0: a slug of gas bursts in the crater every couple of seconds and throws glowing bombs on arcs. Hawaiian near 0.5: a steady lava fountain, a full lava lake and wide flows down both flanks. Plinian at 1: a conduit full of froth feeds a grey column that spreads under the top of the panel, lightning runs through it and glowing avalanches pour down the flanks.
// Knob 2: Speed. At 2 a slug takes about a second and a half to climb from the chamber to the crater; at 0.2 everything runs ten times slower.
// Knob 3: Pressure. How full the magma chamber is. It swells and brightens, bends the beds above it further up, and pushes a dike towards the right flank and a sill into the beds on the left; near 1 the dike breaks out and a flank vent pours lava of its own.
// Knob 4: Wind. Bends the ash column to either side, more the higher it rises; the ash falling out of it slants downwind, and the bombs drift a little with it.
// Buttons: K1 tap sets off a big explosion: a crater-wide flash, a shower of bombs, a burst of ash with lightning in it and a surge of lava down both flanks.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sin, cos, sqrt, exp, abs, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}

// The axis, the crater rim's half width and crest row, the crater floor, the
// old ground the cone was built on, the chamber's centre row, gravity in rows
// per second squared, and the cells of lava down each flank.
const [C, RIM, RIMY, FLOOR, BASE, CHY, G, NL] = [32, 6, 53, 58, 86, 113, 34, 26];
// The flank below the rim: steep at the summit, flattening to the panel's edge at row 84.
const flank = (dx) => RIMY + 31 * cl((dx - RIM) / 26, 0, 2) ** 0.8;
const SURF = new Float32Array(W + 1);
for (let x = 0; x <= W; x++) {
  const dx = abs(x - C);
  SURF[x] = dx < RIM ? FLOOR - (FLOOR - RIMY) * (dx / RIM) ** 2 : flank(dx) + 1.1 * (vn(x * 0.3, 7.5) - 0.5) * sm(RIM, RIM + 4, dx);
}
const sAt = (X) => ((X = cl(X, 0, W - 0.001)), mix(SURF[floor(X)], SURF[floor(X) + 1], X - floor(X)));
// The conduit's centre on each row, wandering a little on its way up.
const CXA = new Float32Array(H).map((_, y) => C + 1.3 * sin((y - FLOOR) * 0.11));
// The dike leaves the conduit at row 99 and reaches the right flank here.
const VX = CXA[99] + 20;
// How the older beds arch up over the chamber, column by column.
const BEND = new Float32Array(W).map((_, x) => exp(-(((x + 0.5 - C) / 15) ** 2)));

// The cone's beds (lava, ochre tephra, ash, red scoria, pale pumice) and the
// older rock under it (soil, sandstone, shale, red beds, limestone, dark
// shale), each as colour index and thickness from the top down.
const CC = [[56, 50, 68], [134, 92, 40], [100, 96, 94], [112, 48, 32], [150, 130, 94]];
const BC = [[72, 48, 32], [142, 104, 50], [74, 74, 88], [118, 54, 36], [140, 130, 108], [46, 46, 62]];
const beds = (seq) => {
  const out = [];
  while (out.length < 96) for (let i = 0; i < seq.length; i += 2) for (let j = 0; j < seq[i + 1]; j++) out.push(seq[i]);
  return out;
};
const CB = beds([0, 2, 1, 2, 2, 1, 0, 3, 3, 2, 1, 3, 4, 1, 0, 2, 2, 2, 3, 2, 0, 3, 1, 2, 2, 2, 4, 2, 0, 2, 3, 3, 1, 2]);
const BB = beds([0, 2, 1, 4, 2, 3, 3, 4, 4, 3, 5, 3, 1, 5, 3, 3, 2, 4, 4, 4, 5, 3, 1, 4, 3, 4, 2, 5]);

// Magma from crust-dark red to white heat, as 256 steps over 0..1.25.
const LUT = new Float32Array(256 * 3);
{
  const K = [[0, 40, 6, 4], [0.2, 120, 14, 4], [0.4, 205, 46, 6], [0.6, 255, 110, 16], [0.78, 255, 182, 48], [0.95, 255, 236, 140], [1.15, 255, 255, 230]];
  for (let i = 0; i < 256; i++) {
    const T = (i / 255) * 1.25;
    let k = 0;
    while (k < K.length - 2 && T > K[k + 1][0]) k++;
    const u = cl((T - K[k][0]) / (K[k + 1][0] - K[k][0]), 0, 1);
    for (let c = 0; c < 3; c++) LUT[i * 3 + c] = mix(K[k][c + 1], K[k + 1][c + 1], u);
  }
}
const lut = (T) => cl(round(T * 204), 0, 255) * 3;

// Sky rows: navy overhead, violet, and the last of the dusk low behind the flanks.
const SKY = [[0, 6, 9, 38], [40, 18, 20, 64], [64, 48, 26, 80], [86, 150, 64, 70]];

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const S = (params.s = {
    f: F32(N * 3), st: new Uint8ClampedArray(N * 3), kind: new Uint8Array(N), off: F32(N), gr: F32(N), vg: F32(N), sd: F32(N), A: F32(N), hot: F32(N),
    t: 0, warm: 0, next: 0.5, slugs: [], parts: [], puffs: [], bolts: [], bub: [], glow: 0, fl: 0, flx: C, fly: 30, pr: 0.5, boost: 0, nf: 0, nv: 0, ndg: 0, npd: 1.5, lake: 0.5, pend: 0,
    lv: [0, 1].map(() => ({ v: F32(NL), T: F32(NL), ph: 0 })),
  });
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5, o = i * 3, dx = abs(X - C), s = sAt(X);
    S.vg[i] = exp(-hypot(X - C, (Y - FLOOR + 1) * 0.8) / 15);
    S.gr[i] = [0.86, 0.95, 1, 1.08][floor(hash(x, y + 77) * 4)];
    S.sd[i] = Y - s;
    if (Y < s) {
      // Sky, with a few stars high up.
      let k = 0;
      while (k < SKY.length - 2 && Y > SKY[k + 1][0]) k++;
      const u = sm(SKY[k][0], SKY[k + 1][0], Y), st = y < 48 && hash(x, y) < 0.014 ? 50 + 110 * hash(y, x) : 0;
      for (let c = 0; c < 3; c++) S.st[o + c] = mix(SKY[k][c + 1], SKY[k + 1][c + 1], u) + st * (c ? 1 : 0.9);
    } else if (Y < BASE - 3 * exp(-(((X - C) / 15) ** 2))) {
      // The cone: beds laid parallel to the flanks, peaked over the old summit the crater blew away.
      S.kind[i] = 1;
      const ls = dx >= RIM ? flank(dx) : RIMY - (RIM - sqrt(dx * dx + 0.6)) * 0.8;
      const d = cl(floor(Y - ls + 1.6 * (vn(x * 0.16, y * 0.09 + 30) - 0.5)), 0, 95), c0 = Y - s < 1.4 ? [52, 44, 50] : CC[CB[d]];
      for (let c = 0; c < 3; c++) S.st[o + c] = c0[c] * S.gr[i];
    } else {
      S.kind[i] = 2;
      S.off[i] = 1.6 * (vn(x * 0.11, y * 0.07 + 60) - 0.5);
    }
  }
  for (let k = 0; k < 14; k++) S.bub.push(bubble(0));
}

// A gas bubble somewhere low in the chamber.
function bubble(P) {
  return { x: C + (rnd() - 0.5) * (16 + 7 * P) * 1.4, y: CHY + rnd() * (7.5 + 2.5 * P) * 0.6 };
}

function puff(S, x, y, vy, r, a, tv, ny, fade, hot = 0.6, g = 0) {
  // The oldest puff gives way when there are too many.
  if (S.puffs.length > 110) S.puffs.shift();
  S.puffs.push({ x, y, vx: 0, vy, rx: r, ry: r, a, tv, ny, fade, hot, g, u: 22 });
}

function bolt(S) {
  const c = S.puffs.filter((p) => !p.g && p.y < 50 && p.rx > 3.5 && p.a > 0.25);
  if (!c.length) return;
  const p = c[floor(rnd() * c.length)], pts = [];
  let x = p.x + (rnd() - 0.5) * p.rx, y = p.y - p.ry * 0.4;
  const n = 5 + floor(rnd() * 8);
  for (let j = 0; j < n; j++) pts.push([x, y]), (x += (rnd() - 0.5) * 4), (y += 1.5 + rnd() * 1.5);
  const m = pts[floor(n / 2)], br = [m];
  for (let j = 0, bx = m[0], by = m[1], s = rnd() < 0.5 ? -1 : 1; j < 3; j++) br.push([(bx += s * (1 + rnd() * 2)), (by += 1 + rnd())]);
  S.bolts.push({ pts, br, life: 0.24 });
  [S.flx, S.fly] = pts[floor(n / 2)];
}

// A burst in the crater, its bombs, its ash and its light.
function burst(S, str, haw) {
  S.glow = min(2.2, S.glow + 0.9 * str);
  S.boost += haw * 1.5;
  // Bombs fly wide; a fan of finer spatter goes up steeper and falls back round the crater.
  const nb = round((14 + 20 * str) * (1 - 0.6 * haw));
  for (let n = 0; n < nb; n++) {
    const b = n % 3 ? 0 : 1, v = (b ? 24 + 22 * rnd() : 20 + 20 * rnd()) * sqrt(str) * (1 + 0.25 * S.P), a = (rnd() - 0.5) * (b ? 1.15 : 0.6);
    fling(S, C + (rnd() - 0.5) * 3, FLOOR - 1, v, a, b);
  }
  for (let n = 0; n < 2 + (str > 0.8 ? 1 : 0); n++) puff(S, C + (rnd() - 0.5) * 3, FLOOR - 3 - n * 3, -(14 + 10 * str), 3.5 + rnd(), 1 + 0.3 * str, -8, 2 + rnd() * 12, 0.04);
  // Most bursts charge the fresh ash enough for a bolt a moment later.
  if (rnd() < 0.25 + 0.5 * str) S.pend = 0.5 + 0.4 * rnd();
}

// One bomb (b 1) or blob of spatter thrown from x, y at speed v, a radians off vertical.
const fling = (S, x, y, v, a, b = 0, vx = 0) => S.parts.push({ x, y, vx: v * sin(a) + vx, vy: -v * cos(a), T: 1, m: 0, b });

// Lava poured into one flank's cell k: volume v at temperature T.
function pour(L, k, v, T = 1) {
  k = cl(k, 0, NL - 1);
  L.T[k] = (L.T[k] * L.v[k] + T * v) / (L.v[k] + v + 1e-6);
  L.v[k] += v;
}

function step(S, d) {
  const s1 = S.k1, P = S.P, w = S.wind;
  const strom = 1 - sm(0.2, 0.5, s1), haw = sm(0.15, 0.45, s1) * (1 - sm(0.6, 0.85, s1)), plin = sm(0.55, 0.9, s1);
  Object.assign(S, { strom, haw, plin });
  S.t += d;
  const ax = 16 + 7 * P, ay = 7.5 + 2.5 * P, top = CHY - ay;
  // Pressure builds in the chamber, and a slug of gas leaves for the conduit when it is ready.
  S.pr = min(1, S.pr + d * (0.3 + 0.4 * P));
  // A Plinian column draws on the chamber in long surges instead.
  if (plin > 0) S.pr = mix(S.pr, 0.5 + 0.5 * sin(S.t * 1.6), min(1, plin * d * 3));
  if ((S.next -= d) <= 0 && plin < 0.8) {
    S.slugs.push({ y: top + 1, str: 0.6 + 0.4 * rnd() + 0.3 * P });
    S.pr = max(0, S.pr - 0.6);
    S.next = mix((1.3 + 1.7 * rnd()) / (1 + 0.7 * P), 0.5 + 0.5 * rnd(), max(haw, plin));
  }
  for (const g of S.slugs) {
    // It speeds up as it expands near the top.
    const u = cl((g.y - FLOOR) / (top - FLOOR), 0, 1);
    g.y -= (16 + 30 * (1 - u)) * (1 + 0.5 * P) * d;
    if (g.y <= FLOOR + 1) (g.done = 1), burst(S, g.str * (strom + 0.35 * haw + 0.25 * plin), haw);
  }
  S.slugs = S.slugs.filter((g) => !g.done);
  // Bubbles rise through the chamber and gather under its roof by the conduit's mouth.
  for (const b of S.bub) {
    const ex = C - b.x, v = (3 + 4 * P + 3 * S.pr) * d;
    b.x += cl(ex, -1, 1) * v * 0.5 + sin(S.t * 2.3 + b.y) * 0.3 * v;
    b.y -= v;
    if (((b.x - C) / ax) ** 2 + ((b.y - CHY) / ay) ** 2 > 0.8) Object.assign(b, bubble(P));
  }
  // The fountain: a steady jet of spatter in Hawaiian style, surging after each slug,
  // and a smaller one from the flank vent once the dike has broken out.
  S.nf += d * haw * (60 + 50 * min(1, S.boost)) * (1 + 0.5 * P);
  for (; S.nf >= 1; S.nf--) fling(S, C + (rnd() - 0.5) * 3, FLOOR - 1, (24 + 16 * rnd()) * (0.85 + 0.3 * P) * (1 + 0.3 * min(1, S.boost)), (rnd() - 0.5) * 0.45);
  S.nv += d * 14 * sm(0.88, 1, P);
  for (; S.nv >= 1; S.nv--) fling(S, VX + (rnd() - 0.5) * 2, sAt(VX) - 1, 10 + 8 * rnd(), (rnd() - 0.5) * 0.6, 0, 3);
  S.boost = max(0, S.boost - d * 1.2);
  // Gas and ash: a thin plume always, a roaring column in Plinian style.
  S.ndg += d * (2.2 + 1.5 * haw + 11 * plin * (0.4 + S.pr));
  for (; S.ndg >= 1; S.ndg--)
    if (rnd() < plin) puff(S, C + (rnd() - 0.5) * 5, FLOOR - 3, -(30 + 14 * rnd()), 5.5, 1, -20, 3 + 7 * rnd(), 0.04, 0.4);
    else puff(S, C + (rnd() - 0.5) * 3, FLOOR - 2, -7, 3, 0.45 + 0.2 * haw, -6, 4 + 14 * rnd(), 0.045, 0.3);
  // Plinian: part of the column collapses and pours down a flank.
  if (plin > 0.3 && (S.npd -= d * plin) <= 0) {
    S.npd = 2 + 2 * rnd();
    const g = rnd() < 0.5 ? -1 : 1;
    for (let n = 0; n < 4; n++) puff(S, C + g * (RIM + 2 * n), RIMY + 2 * n, 0, 4, 1, 0, 0, 0.05, 1.2, g), (S.puffs[S.puffs.length - 1].u = 24 - 3 * n);
  }
  for (const p of S.puffs) {
    if (p.g) {
      // An avalanche of hot ash hugging the flank, slowing as it spreads, then lifting off.
      p.x += p.g * p.u * d;
      p.u = max(3, p.u - 3 * d);
      p.rx += d * 2.5;
      p.ry = min(8, p.ry + d * 1.5);
      p.y = sAt(p.x) - p.ry * 0.35;
      if (p.u < 5 || p.x < 1 || p.x > W - 1) Object.assign(p, { g: 0, vy: -3, tv: -5, ny: 14 + 10 * rnd(), fade: 0.06 });
    } else {
      const rise = sm(p.ny - 2, p.ny + 14, p.y);
      p.vy += (p.tv * rise - p.vy) * 1.6 * d;
      p.y += p.vy * d;
      p.rx = min(30, p.rx + d * (0.8 + 0.12 * abs(p.vy) + 3.5 * (1 - rise) * p.a));
      p.ry = min(12, p.ry + d * (0.6 + 0.05 * abs(p.vy)));
    }
    p.x += (p.vx + w * (4 + 18 * cl(1 - p.y / 60, 0, 1))) * d;
    p.a -= d * p.fade;
    p.hot = max(0, p.hot - d * 0.7);
  }
  S.puffs = S.puffs.filter((p) => p.a > 0.04 && p.x + p.rx > -4 && p.x - p.rx < W + 4 && p.y + p.ry > -8);
  // Bombs and spatter fly, land, roll and cool.
  for (const q of S.parts) {
    if (!q.m) {
      q.vy += G * d;
      q.vx += w * 7 * d;
      q.x += q.vx * d;
      q.y += q.vy * d;
      q.T -= d * (q.b ? 0.16 : 0.35);
      if (q.vy > 0 && q.y >= sAt(q.x)) {
        const dx = abs(q.x - C);
        if (dx < RIM - 0.5) q.dead = 1;
        else if (!q.b) (q.dead = 1), pour(S.lv[q.x > C ? 1 : 0], floor(dx - RIM), 0.05, max(0.5, q.T));
        else Object.assign(q, { m: 1, u: 5 + abs(q.vx) * 0.3, s: q.x > C ? 1 : -1 });
      }
    } else {
      q.x += q.s * q.u * d;
      q.u = max(0, q.u - 6 * d);
      q.y = sAt(q.x) - 0.5;
      q.T -= d * 0.3;
    }
    if (q.T <= 0 || q.x < -2 || q.x > W + 2) q.dead = 1;
  }
  S.parts = S.parts.filter((q) => !q.dead);
  if (S.parts.length > 400) S.parts.splice(0, S.parts.length - 400);
  // Lava over the rim and down the flanks, slower as it cools and crusts.
  const eff = (0.45 + 0.6 * P + 1.2 * haw) * (1 - 0.6 * plin);
  for (let s = 0; s < 2; s++) {
    const L = S.lv[s], v = L.v, T = L.T;
    pour(L, 0, eff * (s ? 0.55 : 1) * d);
    if (s && P > 0.88) pour(L, floor(VX - C - RIM), 1.4 * sm(0.88, 1, P) * d);
    L.ph += d * (1 + 2 * T[2]);
    for (let k = NL - 1; k >= 0; k--) {
      const f = min(v[k], v[k] * (0.2 + 2.2 * T[k] * T[k]) * (k < 6 ? 1.6 : 0.9) * d);
      v[k] -= f;
      if (k < NL - 1) pour(L, k + 1, f, T[k]);
      T[k] = max(0, T[k] - d * (0.03 + 0.015 / (v[k] + 0.2)));
      if (T[k] < 0.1) v[k] = max(0, v[k] - d * 0.03);
    }
  }
  S.lake = mix(S.lake, (1.2 + 1.2 * P + 4 * haw) * (1 - plin), min(1, d * 2));
  // Lightning in the ash.
  if (rnd() < d * (0.2 + 1.3 * plin + 0.4 * S.glow)) bolt(S);
  if (S.pend > 0 && (S.pend -= d) <= 0) bolt(S);
  for (const b of S.bolts) b.life -= d;
  S.bolts = S.bolts.filter((b) => b.life > 0);
  S.fl = S.bolts.reduce((m, b) => max(m, floor(b.life * 40) % 3 === 1 ? 0.35 : 1), 0);
  S.glow *= exp(-d * 2.5);
}

// K1 tap: the big one.
function blast(S) {
  S.slugs.length = 0;
  S.pr = 0;
  burst(S, 2.4, 0);
  S.glow = 2.2;
  for (let n = 0; n < 5; n++) puff(S, C + (rnd() - 0.5) * 6, FLOOR - 4, -(26 + 12 * rnd()), 4 + rnd() * 2, 1, -10, 2 + 8 * rnd(), 0.04, 1);
  for (let s = 0; s < 2; s++) pour(S.lv[s], 0, 1.6);
  S.pend = 0.15;
  S.next = 1.5;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], sp = cl(k[1], 0.2, 3) / 2;
  S.k1 = cl(k[0], 0, 1);
  S.P = cl(k[2], 0, 1);
  S.wind = cl(k[3], -1, 1);
  // The volcano has been going for a while before you look.
  if (!S.warm) {
    S.warm = 1;
    for (let n = round(60 + 120 * sp); n-- > 0; ) step(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) blast(S);
  step(S, cl(dt || 0, 0, 0.1) * sp);
}

let F;
function put(x, y, c, a = 1) {
  (x = floor(x)), (y = floor(y));
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) F[o + i] = mix(F[o + i], c[i], a);
}
const lc = (T) => ((T = lut(T)), [LUT[T], LUT[T + 1], LUT[T + 2]]);

export function draw(display, params) {
  const S = params.s;
  if (!S || S.k1 === undefined) return;
  F = S.f;
  const { P, t, haw, plin, kind, st, A, hot, vg, wind } = S;
  const ax = 16 + 7 * P + 0.8 * S.pr, ay = 7.5 + 2.5 * P + 0.5 * S.pr, top = CHY - ay, bamp = 3 + 6 * P + 1.4 * S.pr, bend = BEND.map((v) => v * bamp);
  const L = 0.3 + 0.7 * S.glow + 0.6 * haw + 0.5 * plin, fl = S.fl;

  // Sky, cone and the older beds bent up over the chamber.
  for (let i = 0; i < N; i++) {
    const o = i * 3, kd = kind[i];
    if (kd === 0) {
      const g = L * vg[i];
      (F[o] = st[o] + 150 * g + 7 * fl), (F[o + 1] = st[o + 1] + 48 * g + 8 * fl), (F[o + 2] = st[o + 2] + 16 * g + 18 * fl);
    } else if (kd === 1) {
      const g = L * vg[i] * (S.sd[i] < 2.5 ? 1 : 0.2);
      (F[o] = st[o] + 120 * g), (F[o + 1] = st[o + 1] + 40 * g), (F[o + 2] = st[o + 2] + 10 * g);
    } else {
      const d = cl((i >> 6) + 0.5 - BASE + bend[i & 63] + S.off[i], 0, 94), d0 = floor(d), u = d - d0;
      const a = BC[BB[d0]], b = BC[BB[d0 + 1]], gr = S.gr[i];
      for (let c = 0; c < 3; c++) F[o + c] = mix(a[c], b[c], u) * gr;
    }
  }

  // The magma: chamber, the feeder below it, the conduit, the dike and the sill, with the rock round them glowing.
  const glowRock = (o, g) => {
    for (let c = 0; c < 3; c++) F[o + c] = mix(F[o + c], [210, 50, 16][c], min(0.85, g));
  };
  const melt = (o, T) => {
    const k = lut(T);
    (F[o] = LUT[k]), (F[o + 1] = LUT[k + 1]), (F[o + 2] = LUT[k + 2]);
  };
  for (let y = max(BASE, floor(top - 6)); y < H; y++)
    for (let x = max(0, floor(C - ax - 7)); x < min(W, C + ax + 7); x++) {
      const X = x + 0.5, Y = y + 0.5, e = hypot((X - C) / ax, (Y - CHY) / ay), o = (y * W + x) * 3;
      if (e < 1) {
        const T = 0.28 + 0.38 * vn(X * 0.17 + 0.7 * sin(Y * 0.17 + t * 0.5), Y * 0.3 + t * 1.2) + 0.2 * (1 - e * e) - 0.25 * sm(0.72, 1, e) + 0.16 * S.pr + 0.1 * P + 0.35 * exp(-((X - C) ** 2) / 9 - ((Y - top) ** 2) / 6) * S.pr;
        melt(o, T);
      } else if (Y > CHY && abs(X - C - 1.5 * sin(y * 0.2)) < 1.3) melt(o, 0.38 + 0.08 * sin(y * 0.5 - t * 3));
      else glowRock(o, exp(-((e - 1) * ay) / 2.4) * (0.5 + 0.4 * S.pr + 0.2 * P));
    }
  for (const b of S.bub) put(b.x, b.y, lc(1.05));
  const slug = (y) => S.slugs.reduce((m, g) => max(m, exp(-(((y - g.y) / 2.6) ** 2))), 0);
  for (let y = FLOOR; y <= top + 1; y++) {
    const cx = CXA[y], sg = slug(y), hw = 1.35 + 1.3 * sg + 0.6 * plin;
    for (let x = max(0, floor(cx - hw - 5)); x < min(W, cx + hw + 5); x++) {
      const o = (y * W + x) * 3, q = abs(x + 0.5 - cx);
      if (q < hw) {
        const ves = hash(x, floor(y + t * 14)) < 0.12 ? 0.25 : 0;
        melt(o, mix(0.58 + 0.12 * sin(y * 0.45 + t * 7) + ves + 0.5 * sg, 0.5 + 0.6 * vn(x * 0.6, (y + t * 45) * 0.25), plin));
      } else if (kind[y * W + x]) glowRock(o, exp(-(q - hw) / 1.5) * (0.4 + 0.5 * sg + 0.3 * plin));
    }
  }
  // The dike towards the right flank, and the sill along the beds on the left.
  const dk = sm(0.2, 0.9, P), sl = sm(0.45, 1, P);
  for (let j = 0; j < 46 * dk; j++) {
    const u = j / 46, x = CXA[99] + (VX - CXA[99]) * u, y = 99 - (99 - sAt(VX)) * u;
    put(x, y, lc(0.55 + 0.1 * sin(j * 0.6 - t * 5)));
    put(x + 1, y, [210, 50, 16], 0.45);
  }
  for (let j = 0; j < 20 * sl; j++) {
    const x = CXA[93] - 2 - j, y = 93 + 0.006 * j * j + 2 * sin(j * 0.15);
    put(x, y, lc(0.5 + 0.08 * sin(j * 0.7 + t * 4)));
    if (j < 14 * sl) put(x, y + 1, lc(0.42));
  }

  // The ash: every puff summed, then shaded over the sky.
  A.fill(0);
  hot.fill(0);
  for (const p of S.puffs) {
    const x0 = max(0, floor(p.x - p.rx)), x1 = min(W - 1, floor(p.x + p.rx)), y0 = max(0, floor(p.y - p.ry)), y1 = min(H - 1, floor(p.y + p.ry));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - p.y) / p.ry;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - p.x) / p.rx, q = 1 - dx * dx - dy * dy;
        if (q > 0) (A[y * W + x] += p.a * q * q), (hot[y * W + x] += p.hot * q * q);
      }
    }
  }
  // Ash falling out of the plume aloft, slanting downwind as it falls.
  const col = new Float32Array(W);
  for (const p of S.puffs)
    if (!p.g && p.y < 45 && p.rx > 4) for (let x = max(0, floor(p.x - p.rx)); x < min(W, p.x + p.rx); x++) col[x] += p.a * max(0, 1 - ((x + 0.5 - p.x) / p.rx) ** 2);
  for (let y = 14; y < 84; y++) {
    const f = 0.11 * sm(12, 30, y) * (1 - sm(56, 84, y)), sh = wind * (y - 14) * 0.55;
    for (let x = 0; x < W; x++) {
      const c = col[cl(round(x - sh), 0, W - 1)];
      if (c > 0.05) A[y * W + x] += f * min(1.5, c) * (0.3 + vn(x * 0.9, y * 0.12 - t * 3));
    }
  }
  const { flx, fly } = S;
  for (let i = 0; i < N; i++) {
    if (A[i] < 0.01 || kind[i]) continue;
    const x = i & 63, y = i >> 6, o = i * 3, tex = vn(x * 0.22 - t * wind * 0.5, y * 0.2 + t * 0.7);
    const al = min(0.94, 1 - exp(-A[i] * (1.3 + 1.7 * tex))), sh = 0.55 + 0.6 * tex, vl = 0.8 * L * vg[i] + 0.6 * hot[i], fy = fl * exp(-hypot(x - flx, (y - fly) * 0.7) / 16);
    F[o] = mix(F[o], 104 * sh + 255 * vl + 130 * fy, al);
    F[o + 1] = mix(F[o + 1], 98 * sh + 100 * vl + 140 * fy, al);
    F[o + 2] = mix(F[o + 2], 100 * sh + 34 * vl + 210 * fy, al);
  }

  // The crater: the vent, the lava lake, and the flash of a burst.
  const ll = FLOOR + 0.6 - S.lake;
  for (let y = RIMY - 1; y <= FLOOR + 1; y++)
    for (let x = C - RIM; x < C + RIM; x++) {
      const i = y * W + x;
      if (!kind[i] && y + 0.5 > ll) melt(i * 3, 0.55 + 0.3 * vn(x * 0.6 + t, y * 0.8) + 0.2 * S.glow - 0.12 * (y + 0.5 - ll < 1 ? 1 : 0));
    }
  if (S.glow > 0.02)
    for (let y = FLOOR - 14; y <= FLOOR + 3; y++)
      for (let x = C - 12; x < C + 12; x++) {
        const o = (y * W + x) * 3, g = S.glow * exp(-hypot(x + 0.5 - C, y + 0.5 - FLOOR + 1) / 3.2);
        (F[o] += 255 * g), (F[o + 1] += 190 * g), (F[o + 2] += 90 * g);
      }

  // Lava down the flanks: hot and bright near the rim, crusting dark as it cools.
  for (let s = 0; s < 2; s++) {
    const { v, T, ph } = S.lv[s];
    for (let k = 0; k < NL; k++) {
      if (v[k] < 0.01) continue;
      const x = s ? C + RIM + k : C - RIM - 1 - k, y0 = min(SURF[x], SURF[x + 1]), y1 = max(SURF[x], SURF[x + 1]), th = min(4, v[k] * 3.2), al = min(1, v[k] * 8);
      // Its glow on the air just above it.
      for (let j = 1; j <= 3; j++) put(x, y0 - th - j, [255, 90, 20], (0.35 * al * T[k]) / j);
      for (let y = floor(y0 - th); y <= floor(y1); y++) {
        const n = vn(k * 0.7 - ph * 2, y * 0.6), tt = T[k], c = lc(0.22 + 0.62 * tt + 0.18 * n);
        const cr = max(sm(0.75, 0.25, tt) * sm(0.3, 0.6, vn(k * 1.3 - ph * 2, y * 1.1 + 9)), sm(0.12, 0.02, tt)), g = S.gr[(y * W + x) & 8191];
        put(x, y, [mix(c[0], 64 * g, cr), mix(c[1], 52 * g, cr), mix(c[2], 54 * g, cr)], al);
      }
    }
  }

  // Bombs and spatter, with a short trail while they fly.
  for (const q of S.parts) {
    const c = lc(0.25 + 0.85 * q.T);
    if (!q.m) for (let j = 1; j <= 3; j++) put(q.x - q.vx * 0.022 * j, q.y - q.vy * 0.022 * j, c, 0.5 / j);
    put(q.x, q.y, c);
    if (q.b && q.T > 0.3) put(q.x + 1, q.y, c, 0.6);
  }

  // Lightning.
  for (const b of S.bolts) {
    if (floor(b.life * 40) % 3 === 1) continue;
    for (const pts of [b.pts, b.br])
      for (let j = 1; j < pts.length; j++) {
        const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], m = max(abs(x1 - x0), abs(y1 - y0)) * 1.5 + 1;
        for (let u = 0; u <= m; u++) {
          const x = mix(x0, x1, u / m), y = mix(y0, y1, u / m);
          put(x - 1, y, [120, 110, 255], 0.35), put(x + 1, y, [120, 110, 255], 0.35), put(x, y, [240, 240, 255]);
        }
      }
  }

  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
