// ===== Patternflow pattern =====
// Title:   Noborigama
// Family:  pottery
// Idea:    A climbing kiln cut open on a hillside at night: flame climbs from the firebox through vaulted chambers of pots, white-yellow below and red above, and each time the potter stokes, flame bursts from the spy holes and black smoke and sparks leave the chimney.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after the noborigama, the wood-fired climbing kiln of Japan and Korea
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Firing=-1..1, Speed=0.2..3, Chambers=3..6, Draft=-1..1
//
// Knob 1: Firing. The first day at -1: only the firebox burns hot, the chambers glow dull red. At 0 the lower chambers are white-yellow and the top one red; at 1, the last day, all are near white.
// Knob 2: Speed. At 2 the potter stokes every few seconds; 0.2 is ten times slower.
// Knob 3: Chambers. Three to six chambers between the firebox and the chimney; with more, each is lower, with fewer shelves.
// Knob 4: Draft. Wind from the left at -1 to the right at 1 leans smoke, sparks and flames. Up the hill it pulls the fire hotter; down it, it chokes the chimney and the spy holes lick flame.
// Buttons: K1 tap stokes every hole at once: flame from every spy hole, then a black cloud full of sparks from the chimney.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sin, sqrt, exp, abs, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y, p = 1e9) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi % p), b = hash(xi + 1, yi % p), c = hash(xi, (yi + 1) % p);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, (yi + 1) % p)) * su * sv;
}
// Fine noise that wraps every 256 rows, for the quick flicker of flame and smoke.
const FN = new Float32Array(64 * 256).map((_, i) => vn((i & 63) * 0.9, ((i >> 6) * 84) / 256, 84));
const fn = (x, y) => FN[(y & 255) * 64 + (x & 63)];

// Brick, gas and flame by temperature: dull red at 0.15, orange at 0.6, white
// heat at 1. Red stops at 232: pinned at 255 it hid the flicker of the hottest
// chambers, since an LED reads by its brightest channel.
const RAMP = [[0, 24, 4, 2], [0.15, 92, 13, 4], [0.3, 158, 30, 6], [0.45, 204, 68, 12], [0.6, 226, 114, 24], [0.75, 232, 160, 50], [0.88, 232, 194, 96], [1, 232, 216, 160], [1.25, 236, 230, 204]];
const LUT = new Float32Array(768);
for (let i = 0; i < 256; i++) {
  let k = 0;
  const T = i / 204;
  while (k < 7 && T > RAMP[k + 1][0]) k++;
  const u = cl((T - RAMP[k][0]) / (RAMP[k + 1][0] - RAMP[k][0]), 0, 1);
  for (let c = 0; c < 3; c++) LUT[i * 3 + c] = mix(RAMP[k][c + 1], RAMP[k + 1][c + 1], u);
}
const lut = (T) => cl(round(T * 204), 0, 255) * 3;
// One colour array for every put(), to spare the garbage collector.
const C3 = [0, 0, 0];
const lc = (T, b = 1) => ((T = lut(T)), C3[0] = LUT[T] * b, C3[1] = LUT[T + 1] * b, C3[2] = LUT[T + 2] * b, C3);

const SKY = 0, EARTH = 1, WALL = 3, GAS = 4, POT = 5, SHELF = 6, HOLE = 7, FLUE = 8;
// A vault on low walls: roof height across a chamber, 0.4 at the walls, 1 at the crown.
const arch = (u) => 0.4 + 0.6 * sqrt(max(0, 1 - (2 * u - 1) ** 2));
const TOP = 18; // the chimney's mouth row
const WOOD = [150, 118, 66], TOWEL = [214, 204, 184], FACE = [176, 116, 78], COAT = [46, 60, 128], LEGS = [74, 62, 54], RIM = [255, 150, 60];
// Jar, flared bowl, bottle and cup: half width up the pot, bottom to top.
const prof = (k, t) => (k === 0 ? (t > 0.84 ? 0.5 : 0.6 + 0.4 * sin(PI * t)) : k === 1 ? 0.5 + 0.5 * t : k === 2 ? (t < 0.55 ? 0.55 + 0.45 * sin((PI * t) / 0.55) : t > 0.88 ? 0.5 : 0.3) : 0.8);

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const S = (params.s = {
    t: 0, n: 0, kind: new Uint8Array(N), ch: new Uint8Array(N), V: F32(N), bg: F32(N * 3), gw: F32(N), f: F32(N * 3), A: F32(W * 64), K: F32(W * 64), Q: F32(W * 64),
    T: F32(8).fill(-1), Hc: F32(8).fill(-1), age: F32(8).fill(9), q: F32(8), open: F32(8), Te: F32(8), Br: F32(8),
    puffs: [], sparks: [], logs: [], slugs: [], ev: [], motes: [], pot: { A: 0, tgt: 0, mode: 1, tm: -1.6, thr: 0, k: 0, ph: 0 }, fb: { tm: 1, an: 0 }, flare: 0, np: 0, ns: 0,
  });
  for (let k = 0; k < 40; k++) S.motes.push({ x: rnd() * W, y: rnd() * H, e: rnd() < 0.45, ph: rnd() * 7 });
  for (let k = 0; k < 3; k++) S.logs.push({ c: 0, x: 8 + k * 6 + rnd() * 3, y: 120 + (k & 1), len: 5, life: 0.4 + 0.5 * rnd() });
}

const front = (S) => ((S.k1 + 1) / 2) * (S.n + 0.3);

function build(S, n) {
  S.n = n;
  const P = 77 / n, h = P - 3, Wc = 34 - 2 * n, s = (43 - Wc) / (n - 1);
  // The firebox, then the chambers, each P rows above the last and s LEDs to the right.
  const g = (S.g = [{ L: 6, W: 25, F: 123, h: 11 }]);
  for (let c = 1; c <= n; c++) g.push({ L: 14 + (c - 1) * s, W: Wc, F: 108 - (c - 1) * P, h });
  // The roof row over X inside a chamber; with e = 2, the top of its brick.
  const inT = (S.inT = (k, X, e = 0) => {
    const q = g[k], u = (X - q.L + e) / (q.W + 2 * e);
    return u > 0 && u < 1 ? q.F - (q.h + e) * arch(u) : 1e3;
  });
  const outT = (k, X) => inT(k, X, 2), tp = g[n], CX = (S.CX = tp.L + 0.62 * tp.W);
  const hill = (X) => (X < 4 ? 123 : X < tp.L - 2 ? mix(123, tp.F + 2, (X - 4) / (tp.L - 6)) : mix(tp.F + 2, tp.F - 5, (X - tp.L + 2) / (66 - tp.L)));
  // Flame passages through each chamber's floor, over the crown of the one below.
  const holes = [];
  for (let c = 1; c <= n; c++) for (let a = g[c - 1], x = round(a.L + 0.2 * a.W); x <= a.L + 0.8 * a.W; x += 4) if (x > g[c].L && x < g[c].L + Wc - 2) holes.push([x, c]);
  const { kind, ch, V, bg, gw } = S;
  S.stars = [];
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5, r = hash(x, y), nz = 0.8 + 0.4 * vn(x * 0.3, y * 0.3);
    let k = SKY, c = 0, v = 0, col = [0, 0, 0];
    for (let j = 0; j <= n && !k; j++) if (Y < g[j].F && Y > inT(j, X)) k = GAS, c = j, v = (g[j].F - Y) / g[j].h;
    if (!k && abs(X - CX) < 2 && Y > TOP && Y < inT(n, X) + 0.5) k = FLUE, c = n, v = (Y - TOP) / (inT(n, CX) - TOP);
    if (!k) for (const [hx, hc] of holes) if (x === hx && Y > g[hc].F && Y < inT(hc - 1, X)) k = HOLE, c = hc;
    for (let j = 0; j <= n && !k; j++) if (Y < g[j].F + 2 && Y > outT(j, X)) k = WALL, c = j;
    if (!k && Y > TOP && ((abs(X - CX) < 4 && Y < outT(n, X) + 1) || (Y < TOP + 2 && abs(X - CX) < 5))) k = WALL, c = n + 1;
    if (!k && Y > hill(X)) k = EARTH;
    // The fire mouth in the firebox's front wall.
    if (k === WALL && !c && x < 6 && y > 116) k = GAS, v = (123 - Y) / 11;
    kind[i] = k, ch[i] = c, V[i] = v;
    if (k === SKY) {
      const u = sm(0, 112, Y), dm = hypot(X - 11, Y - 11), e = 26 * exp(-dm / 3.5), st = r < 0.014 && y < 100 && dm > 12 ? 70 + 140 * hash(y, x) : 0;
      col = [5 + 15 * u + e + st, 9 + 17 * u + e + st, 32 + 30 * u + e + st];
      // A crescent moon.
      if (dm < 3.6 && hypot(X - 12.6, Y - 10) > 3.2) col = [226, 222, 196];
      if (st) S.stars.push(i);
    } else if (k === EARTH) {
      // Beds along the slope, stones, grass on top.
      const dd = Y - hill(X), bd = (0.7 + 0.5 * vn(dd * 0.3 + x * 0.04, 3.5 + x * 0.02)) * nz;
      col = dd < 1.5 ? [24, 38, 24] : r < 0.035 ? [58, 52, 46] : [30 * bd, 23 * bd, 19 * bd];
    }
    // Brick, coursed on the chimney.
    else if (k === WALL) col = [96, 66, 50].map((v2) => v2 * ((c > n ? y % 3 === 0 || (x + (floor(y / 3) & 1) * 2) % 4 === 0 : r < 0.25) ? 0.62 : 0.85 + 0.3 * r));
    bg.set(col, i * 3);
  }
  gw.fill(0);
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, k = kind[i];
    // The brick the fire touches.
    if (k === WALL) V[i] = [1, -1, W, -W].some((d) => kind[i + d] >= GAS && (abs(d) > 1 || (x + d) >> 6 === 0)) ? 1 : 0;
    // Earth and air by the kiln are warm: how near each LED is to a wall, and whose.
    if (k <= EARTH) {
      let best = 9;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const X = x + dx, Y = y + dy, d = abs(dx) + abs(dy);
          if (X >= 0 && X < W && Y >= 0 && Y < H && kind[Y * W + X] === WALL && d < best) best = d, ch[i] = ch[Y * W + X];
        }
      gw[i] = best < 9 ? exp(-best / 1.4) * (k ? 0.8 : 0.6) : 0;
    }
  }
  // Shelves and pots: two or three levels a chamber, under the vault.
  const nl = h >= 16 ? 3 : 2, lh = h / nl;
  for (let c = 1; c <= n; c++) {
    const q = g[c], x0 = round(q.L + max(6, 0.22 * Wc)), x1 = floor(q.L + Wc - 1);
    const set = (x, y, k2, v2) => kind[y * W + x] === GAS && ch[y * W + x] === c && ((kind[y * W + x] = k2), (V[y * W + x] = v2));
    for (let j = 0; j < nl; j++) {
      const ys = round(q.F - j * lh), base = ys - 1;
      if (j) {
        for (let x = x0; x <= x1; x++) if (inT(c, x + 0.5) < ys - 1) set(x, ys, SHELF, 0);
        for (let y = ys + 1; y < round(q.F - (j - 1) * lh); y++) set(x0, y, SHELF, 0), set(x1 - 1, y, SHELF, 0);
      }
      for (let x = x0 + 1; x < x1 - 1; ) {
        const ty = floor(hash(c * 7 + j, x) * 4), w = [5, 5, 4, 3][ty];
        const ph = min(floor(lh - 2), [5, 3, 6, 4][ty], floor(base - max(inT(c, x + 0.5), inT(c, x + w - 0.5)) - 1));
        if (ph < 2 || x + w > x1) break;
        for (let r = 0; r < ph; r++)
          for (let xx = x; xx < x + w; xx++) {
            const dx = xx + 0.5 - x - w / 2;
            if (abs(dx) <= (prof(ty, (r + 0.5) / ph) * w) / 2 + 0.15) set(xx, base - r, POT, 0.5 - dx / w + (r === ph - 1 ? 0.2 : 0));
          }
        x += w + 1;
      }
    }
  }
  // Ladders up each chamber's front, and the potter's way between the stoke holes.
  const xs = (c) => g[c].L - 4, px = [], py = [], at = [0], pl = [0];
  S.lad = [];
  S.spy = [0];
  for (let c = 1; c <= n; c++) {
    const yw = outT(c, g[c].L - 1.5);
    S.lad.push([round(xs(c)), yw, outT(c - 1, xs(c))]);
    S.spy.push(round(g[c].F - max(5, 0.35 * h)));
    at.push(px.length);
    px.push(xs(c)), py.push(g[c].F + 2);
    if (c < n) {
      px.push(xs(c)), py.push(yw);
      for (let x = g[c].L - 1.5; x < xs(c + 1); x += 1.5) px.push(x), py.push(outT(c, x));
      px.push(xs(c + 1)), py.push(outT(c, xs(c + 1)));
    }
  }
  for (let j = 1; j < px.length; j++) pl.push(pl[j - 1] + hypot(px[j] - px[j - 1], py[j] - py[j - 1]));
  Object.assign(S, { px, py, pl, Ac: at.map((j, c) => (c ? pl[j] : 0)) });
  // The first time, the potter stands by the chamber above the one being fired.
  const pt = S.pot;
  if (!S.built) S.built = 1, pt.tgt = min(n, cl(round(front(S)), 1, n) + 1);
  pt.tgt = min(pt.tgt, n);
  pt.A = S.Ac[pt.tgt];
  if (!pt.mode) pt.mode = 2;
  S.logs = S.logs.filter((l) => l.c <= n);
  S.slugs = [];
}

// A stoke: reduction first, the flame starved and smoky, then the surge.
const red = (a) => (a < 0.2 ? a / 0.2 : exp(-(a - 0.2) / 1.1));
const surge = (a) => sm(0.9, 2.1, a) * exp(-max(0, a - 2.1) / 2.4);

function pulse(S, c, s) {
  S.age[c] = 0, S.q[c] = s;
  // Its black smoke reaches the chimney later the lower the chamber.
  S.ev.push({ at: 0.25 + 0.12 * (S.n - c), fn: () => S.slugs.push({ y: S.inT(S.n, S.CX), a: 0.5 + 0.5 * s }) });
}

function stoke(S, c) {
  const q = S.g[c];
  pulse(S, c, 1);
  S.logs.push({ c, x: q.L + (c ? 0.5 + rnd() * 2 : 2 + rnd() * 9), y: c ? round(q.F) - 1 : 120 + (rnd() < 0.5), len: (c ? 3 : 4) + floor(rnd() * 3), life: 1 });
  // The firebox's flame goes on through the first chamber.
  if (!c) S.ev.push({ at: 0.35, fn: () => pulse(S, 1, 0.6) });
}

function throwTo(S, c, delay = 0) {
  S.ev.push({ at: 0.3 + delay, fn: () => stoke(S, c) });
  S.open[c] = 1.3 + delay;
}

function puff(S, x, y, vy, r, a, k) {
  if (S.puffs.length > 110) S.puffs.shift();
  S.puffs.push({ x, y, vy, r, a, k, hot: 0.7 + 0.3 * k, ph: rnd() * 7 });
}

function spark(S, s) {
  if (S.sparks.length > 160) S.sparks.shift();
  const life = 0.8 + 1.4 * rnd();
  S.sparks.push({ x: S.CX + (rnd() - 0.5) * 3, y: TOP - 1, vx: (rnd() - 0.5) * 6 * s, vy: -(10 + 14 * rnd()) * s, life, L: life });
}

function posAt(S, A) {
  const { px, py, pl } = S;
  let j = 1;
  while (j < pl.length - 1 && pl[j] < A) j++;
  const u = cl((A - pl[j - 1]) / max(1e-6, pl[j] - pl[j - 1]), 0, 1);
  return [mix(px[j - 1], px[j], u), mix(py[j - 1], py[j], u), abs(px[j] - px[j - 1]) < 0.01];
}

function step(S, d) {
  S.t += d;
  const { n, T, age, q, Hc, Te, Br, wind, pot: pt, fb } = S, fr = front(S), peak = 0.5 + 0.45 * sm(0, 0.5, (S.k1 + 1) / 2);
  S.cf = cl(round(fr), 1, n);
  for (let c = 0; c <= n; c++) {
    // Fired chambers hold white heat; above the one being fired each is cooler.
    const tg = max(0.2, peak - (1.1 / n) * max(0, c - fr));
    T[c] = T[c] < 0 ? tg : T[c] + (tg - T[c]) * min(1, d * 0.8);
    age[c] += d;
    // Wind up the hill pulls on the chimney; wind down it chokes the draft.
    Te[c] = T[c] + q[c] * (0.1 * surge(age[c]) - 0.15 * red(age[c])) + 0.02 * sin(S.t * 1.3 + c * 2.1) + 0.06 * wind;
    Br[c] = 1 - 0.36 * q[c] * red(age[c]);
    // Heat work for the cones creeps up and hardly comes back.
    if (Hc[c] < 0) Hc[c] = T[c] - 0.1;
    Hc[c] += (Te[c] - Hc[c]) * d * (Te[c] > Hc[c] ? 0.07 : 0.02);
    S.open[c] = max(0, S.open[c] - d);
  }
  Te[n + 1] = Te[n] - 0.22, Br[n + 1] = Br[n];
  for (const e of S.ev) if ((e.at -= d) <= 0) e.fn();
  S.ev = S.ev.filter((e) => e.at > 0);
  // The potter stokes twice, watches the spy hole, then goes where wood is needed.
  pt.ph += d;
  if (!pt.mode) {
    pt.A += cl(S.Ac[pt.tgt] - pt.A, -11 * d, 11 * d);
    if (abs(S.Ac[pt.tgt] - pt.A) < 1e-3) pt.mode = 1, pt.tm = 0, pt.thr = 0;
  } else if (pt.mode === 1) {
    pt.tm += d;
    if (pt.thr < 2 && pt.tm > 0.3 + 0.7 * pt.thr) {
      throwTo(S, pt.tgt);
      pt.thr++;
    }
    if (pt.tm > 1.8) pt.mode = 2, pt.tm = 0.8 + rnd();
  } else if ((pt.tm -= d) <= 0) pt.tgt = ++pt.k % 3 ? S.cf : min(n, S.cf + 1), pt.mode = 0;
  // The stoker feeds the fire mouth.
  fb.an = max(0, fb.an - d);
  if ((fb.tm -= d) <= 0) fb.tm = 3 + rnd(), fb.an = 0.5, throwTo(S, 0);
  for (const l of S.logs) l.life -= d * (0.12 + 0.2 * T[l.c]);
  S.logs = S.logs.filter((l) => l.life > 0);
  // Black smoke up the chimney: at the top, a billow, a flare and sparks.
  for (const s of S.slugs)
    if ((s.y -= d * 30) < TOP) {
      s.done = 1;
      for (let j = 0; j < 3; j++) puff(S, S.CX + (rnd() - 0.5) * 3, TOP - 1 - j * 2, -6 - 4 * rnd(), 3 + rnd(), 0.6 + 0.6 * s.a, 1);
      for (let j = 0; j < 14 * s.a; j++) spark(S, 1.3);
      S.flare = min(1.4, S.flare + s.a);
    }
  S.slugs = S.slugs.filter((s) => !s.done);
  S.flare = max(0.15 + 0.35 * sm(0.6, 1, T[n]), S.flare * exp(-d * 1.6));
  air(S, d);
  // Ash and embers.
  for (const m of S.motes) m.x = (m.x + (wind * 9 + 1 + 1.5 * sin(S.t * 0.7 + m.ph)) * d + 65) % 65, m.y = (m.y + (m.e ? -3.5 : 2.2) * d + 129) % 129;
}

// A grey plume that slows and spreads under the top of the panel, and sparks.
function air(S, d) {
  const { n, T, wind } = S;
  for (S.np += d * 6; S.np >= 1; S.np--) puff(S, S.CX + (rnd() - 0.5) * 2, TOP - 1, -7 - 3 * rnd(), 3, 0.55 + 0.2 * T[n], 0);
  for (const p of S.puffs) {
    // A strong wind bends the plume over and draws it out downwind.
    p.vy += (-3.5 * (1 - 0.55 * abs(wind)) * cl(p.y / 12, 0.3, 1) - p.vy) * d * 1.2;
    p.y += p.vy * d;
    p.x += (wind * 18 * (0.5 + 0.5 * cl((TOP - p.y) / TOP, 0, 1)) + 1.2 * sin(S.t * 0.9 + p.ph)) * d;
    p.r = min(10 + p.k, p.r + d * (1.5 + 1.2 * p.k + 2 * cl((8 - p.y) / 8, 0, 1)));
    p.a -= d * (0.05 + 0.04 * (1 - p.k));
    p.hot = max(0, p.hot - d * (1.4 - 0.9 * p.k));
  }
  S.puffs = S.puffs.filter((p) => p.a > 0.03 && p.y + p.r > -3 && p.x > -14 && p.x < W + 14);
  for (S.ns += d * (2 + 5 * T[n]) * (1 + 0.6 * wind); S.ns >= 1; S.ns--) spark(S, 1);
  for (const p of S.sparks) {
    p.vy += (-6 - p.vy) * d * 1.5;
    p.vx += ((rnd() - 0.5) * 40 + (wind * 16 - p.vx) * 2) * d;
    p.x += p.vx * d, p.y += p.vy * d, p.life -= d;
  }
  S.sparks = S.sparks.filter((p) => p.life > 0 && p.y > -1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], n = cl(round(k[2]), 3, 6);
  S.k1 = cl(k[0], -1, 1);
  S.wind = cl(k[3], -1, 1);
  if (n !== S.n) build(S, n);
  // The kiln has been smoking for hours before you look.
  if (!S.warm) {
    S.warm = 1;
    step(S, 0);
    for (let j = 0; j < 75; j++) air(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) for (let c = 0; c <= n; c++) throwTo(S, c, 0.05 * c);
  step(S, cl(dt || 0, 0, 0.1) * (cl(k[1], 0.2, 3) / 2));
}

let F;
function put(x, y, c, a = 1, add = 0) {
  x = floor(x), y = floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  for (let i = 0, o = (y * W + x) * 3; i < 3; i++) F[o + i] = add ? F[o + i] + c[i] * a : mix(F[o + i], c[i], a);
}
function glow(x, y, r, c, a) {
  for (let Y = floor(y - r); Y <= y + r; Y++) for (let X = floor(x - r); X <= x + r; X++) put(X, Y, c, a * max(0, 1 - hypot(X + 0.5 - x, Y + 0.5 - y) / r) ** 2, 1);
}

// A figure nine LEDs tall, feet on row y, facing the kiln: white towel, indigo
// jacket lit orange on the kiln side, paper lantern.
function figure(x, y, pose, ph, rim, lamp) {
  x = round(x), y = round(y);
  const a = floor(ph * 6) & 1 ? -1 : 1, pts = [[-1, -8, TOWEL], [0, -8, TOWEL], [0, -7, FACE, 1]];
  for (let dy = -6; dy <= -4; dy++) pts.push([-1, dy, COAT], [0, dy, COAT], [1, dy, COAT, 1]);
  const L = (l, b) => pts.push([l, -3, LEGS], [b, -2, LEGS], [b, -1, LEGS], [b, 0, LEGS]);
  if (pose === 1 && a < 0) L(0, 0);
  else if (pose === 2) L(a, a), L(-a, -a), pts.push([a, -7, COAT, 1], [-a, -3, LEGS]);
  else L(-1, -1), L(1, 1);
  if (pose === 3) pts.push(...(ph < 0.5 ? [[-1, -7, COAT], [-2, -8, COAT]] : [[2, -5, COAT, 1], [3, -5, FACE, 1]]));
  for (const [dx, dy, c, k] of pts) put(x + dx, y + dy, k ? c.map((v, i) => mix(v, RIM[i], rim)) : c);
  if (lamp) put(x - 2, y - 4, [120, 70, 40]), put(x - 2, y - 3, [255, 222, 150]), put(x - 2, y - 2, [240, 160, 80]), glow(x - 1.5, y - 2, 7, [70, 44, 16], 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  F = S.f;
  const { n, t, kind, ch, V, bg, gw, Te, Br, g, wind, A, K, Q, q, age } = S, lean = wind * 2.2 + 0.8, fs = 1 + 0.45 * wind, fo = floor(t * fs * 17);
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const k = kind[i], c = ch[i], x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5, T = Te[c], B = Br[c], v = V[i];
    // Each LED: backdrop times m plus a ramp colour times b.
    let j = lut(T * 0.7), b = 0, m = 0;
    if (k <= EARTH) m = 1, b = gw[i] * 0.28 * B;
    else if (k === WALL) m = v ? 0.45 : 0.95, j = lut(T * 0.85 - 0.05), b = B * (v ? 0.5 : 0.1);
    else if (k === GAS) {
      let I = sm(0.25, 0.85, 0.65 * vn(X * 0.45 - lean * (0.3 + v) * 3 + c * 19, (Y + t * fs * 10) * 0.16) + 0.35 * fn(x, y + fo) + 0.25 * (1 - v) - 0.07);
      // The firebox floor: a bed of embers under the logs.
      if (!c && v < 0.3) I = sm(0.35, 0.85, 0.7 * vn(X * 0.7, Y * 0.9 + t * 0.4) + 0.3 * vn(X * 1.7 + t, Y * 1.5) + 0.1);
      // Darker flame is cooler, orange rather than grey. The firebox burns rougher.
      const r = c ? 0.14 : 0.26;
      j = lut(T - r + 2 * r * I), b = B * (1 - 2 * r + 2 * r * I);
    } else if (k === POT) j = lut(T - 0.18), b = B * (0.32 + 0.22 * v + 0.14 * fn(x >> 1, y + (fo >> 1)));
    else if (k === SHELF) j = lut(T - 0.2), b = B * 0.4;
    else if (k === HOLE) j = lut(mix(Te[c - 1], T, 0.5) + 0.04), b = 0.85 + 0.15 * sin(t * 9 + x);
    else {
      // The flue: hot gas rising in bands, and each stoke's black smoke going up.
      let dk = 0;
      for (const s of S.slugs) dk = max(dk, s.a * exp(-(((Y - s.y) / 3) ** 2)));
      j = lut(T - 0.12 - 0.2 * v + 0.1 * vn(X * 0.6, (Y + t * 22) * 0.3)), b = B * (0.6 + 0.3 * vn(X * 0.5 + 9, (Y + t * 26) * 0.2)) * (1 - 0.85 * dk);
    }
    for (let e = 0; e < 3; e++) F[o + e] = bg[o + e] * m + LUT[j + e] * b;
  }
  for (const i of S.stars) for (let e = 0; e < 3; e++) F[i * 3 + e] *= 0.75 + 0.25 * sin(t * 2.3 + i);

  // Burning wood on the floors; in the firebox, thicker logs with their tops alight.
  for (const l of S.logs)
    for (let k = 0, T = Te[l.c], len = max(1, round(l.len * min(1, l.life * 1.6))); k < len; k++) {
      put(l.x + k, l.y, (k + floor(t * 4 + l.x)) % 3 ? lc(T - 0.45, 0.45) : lc(T + 0.1));
      if (!l.c) put(l.x + k, l.y - 1, lc(T - 0.1 + 0.15 * sin(t * 7 + k + l.x)), 0.85);
    }
  for (const [lx, y0, y1] of S.lad) for (let y = floor(y0); y <= y1; y++) put(lx - 1, y, WOOD, 0.7), put(lx + 1, y, WOOD, 0.7), y % 3 || put(lx, y, WOOD, 0.6);
  for (let c = 1; c <= n; c++) {
    // The stoke hole, open while wood goes in, and the spy hole.
    const T = Te[c], wx = floor(g[c].L - 1.5), sy = S.spy[c], fy = round(g[c].F), op = sm(0, 0.3, S.open[c]);
    for (let y = fy - 3; y <= fy - 2; y++) for (let x = wx; x <= wx + 1; x++) put(x, y, op > 0.05 ? lc(T + 0.05, op) : lc(T - 0.3, 0.35));
    if (op > 0.05) glow(wx - 1, fy - 2.5, 6, lc(T - 0.1), 0.35 * op);
    put(wx, sy, lc(T, 0.9)), put(wx + 1, sy, lc(T));
    for (let x = wx + 2; x <= wx + 6; x++) put(x, sy + 2, lc(T - 0.2, 0.4));
    // Three cones on a pad, each bending once the heat work passes its number.
    for (let m = 0; m < 3; m++) {
      const b = sm(0.57 + 0.12 * m, 0.68 + 0.12 * m, S.Hc[c]), cx = wx + 2 + 2 * m + (b > 0.4), cc = lc(T - 0.15, 0.5);
      put(cx - (b > 0.4), sy + 1, cc), put(cx, sy, cc, b < 0.75 ? 1 : 0.5), put(cx, b < 0.75 ? sy - 1 : sy + 1, cc);
    }
    // Flame out of the spy hole after a stoke, or whenever the wind chokes the chimney.
    const s = max(q[c] * red(age[c]) * sm(0.15, 0.35, age[c]), 0.55 * q[c - 1] * red(age[c - 1] - 0.3) * sm(0.4, 0.6, age[c - 1])) + 0.3 * max(0, -wind) * (0.7 + 0.3 * sin(t * 3 + c));
    if (s < 0.05) continue;
    const x0 = wx - 0.5, y0 = sy + 0.5, len = 2 + 9 * s * (0.8 + 0.2 * sin(t * 13 + c));
    glow(x0, y0, 5, [120, 50, 10], s);
    for (let j = 0; j < len; j++) {
      const u = j / len, x = x0 - j * (1 - 0.6 * max(0, wind)) + wind * j * 0.4, y = y0 - j * j * 0.06 - j * 0.15 + sin(t * 17 + j) * 0.4 * u;
      put(x, y, lc(T + 0.3 - 0.6 * u), 1 - u * 0.3);
      if (u < 0.7) put(x, y - 1, lc(T + 0.1 - 0.6 * u), 0.8 - u), put(x, y + 1, lc(T - 0.6 * u), 0.5 - 0.5 * u);
    }
  }
  const pt = S.pot, [px, py, climb] = posAt(S, pt.A), pose = pt.mode === 1 ? 3 : pt.mode ? 0 : climb ? 2 : 1;
  figure(px, py, pose, pose === 3 ? (pt.tm % 0.7) / 0.7 : pt.ph, 0.25 + 0.6 * sm(0, 0.3, S.open[pt.tgt]) * (pose === 3), 1);
  figure(1, 122, S.fb.an > 0 ? 3 : 0, 1 - S.fb.an / 0.5, 0.5 + 0.3 * sin(t * 7), 0);
  glow(5, 120, 6, lc(Te[0] - 0.1), 0.35);

  // Smoke: puffs summed, then shaded grey, lit from below, or black after a stoke.
  A.fill(0), K.fill(0), Q.fill(0);
  for (const p of S.puffs)
    for (let y = max(0, floor(p.y - p.r)); y <= min(63, p.y + p.r); y++)
      for (let x = max(0, floor(p.x - p.r)); x <= min(W - 1, p.x + p.r); x++) {
        const dx = (x + 0.5 - p.x) / p.r, dy = (y + 0.5 - p.y) / p.r, w = p.a * (1 - dx * dx - dy * dy) ** 2, i = y * W + x;
        if (dx * dx + dy * dy < 1) A[i] += w, K[i] += w * p.k, Q[i] += w * p.hot;
      }
  for (let i = 0; i < W * 64; i++) {
    if (A[i] < 0.01) continue;
    const y = i >> 6, tx = 0.6 * vn((i & 63) * 0.25 - t * wind, y * 0.25 + t * 0.8) + 0.4 * fn(i, y + (fo >> 2)), gr = 0.7 + 0.5 * tx;
    const al = min(0.95, (1 - exp(-A[i] * 2.2)) * (0.6 + 0.6 * tx)), dk = K[i] / A[i], hq = min(1, Q[i] / A[i]) * (0.4 + 0.6 * sm(30, 10, y));
    const o = i * 3;
    F[o] = mix(F[o], mix(118 * gr, 16, dk) + 160 * hq, al), F[o + 1] = mix(F[o + 1], mix(106 * gr, 11, dk) + 60 * hq, al), F[o + 2] = mix(F[o + 2], mix(104 * gr, 10, dk) + 14 * hq, al);
  }
  // Flame licking out of the chimney's mouth.
  const fh = 2 + 7 * S.flare;
  glow(S.CX, TOP, 6, [110, 40, 8], S.flare * 0.8);
  for (let j = 0, u = 0; j < fh; u = ++j / fh)
    for (let e = -1; e < 2; e++) (u < 0.5 || !e) && put(S.CX + e + wind * j * 0.6 + sin(t * 11 + j) * 0.6 * u, TOP - 1 - j, lc(Te[n] - 0.05 - 0.45 * u - 0.2 * abs(e)), e ? 0.6 : 1 - 0.5 * u);
  for (const p of S.sparks) put(p.x, p.y, lc(0.35 + 0.75 * (p.life / p.L)), min(1, p.life * 2));
  for (const m of S.motes) put(m.x, m.y, m.e ? [230, 110, 30] : [80, 78, 84], m.e ? 0.5 + 0.4 * sin(t * 5 + m.ph) : 0.6);

  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
