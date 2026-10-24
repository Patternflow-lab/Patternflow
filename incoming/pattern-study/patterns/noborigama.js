// ===== Patternflow pattern =====
// Title:   Noborigama
// Family:  pottery
// Idea:    A climbing kiln cut open on a hillside at night: the flame climbs from the firebox through a chain of vaulted chambers stacked with pots, white-yellow below and orange above, while a potter with a lamp climbs the ladders to throw split wood into the stoke holes, and each stoke pushes flame out of the spy holes and black smoke and sparks out of the chimney into the stars.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after the noborigama, the wood-fired climbing kiln of Japan and Korea
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Firing=-1..1, Speed=0.2..3, Chambers=3..6, Draft=-1..1
//
// Knob 1: Firing. How far the firing has come. At -1 it is the first day: only the firebox burns hot and the chambers glow dull red. At 0 the lower chambers are at white-yellow heat and the top one is still orange; at 1, the last day, every chamber is close to white.
// Knob 2: Speed. At 2 the potter stokes every few seconds and climbs from one chamber to the next in about three; at 0.2 everything runs ten times slower.
// Knob 3: Chambers. How many chambers climb the slope between the firebox and the chimney, three to six. With more, each one is lower and narrower and carries fewer shelves of pots.
// Knob 4: Draft. Wind over the hill, from the left at -1 to the right at 1. It leans the smoke, the sparks, the flames inside the chambers and the tongues out of the spy holes.
// Buttons: K1 tap stokes every hole at once: wood goes into each chamber and the firebox, flame bursts from every spy hole and the chimney throws out a big black cloud full of sparks.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sin, sqrt, exp, abs, PI } = Math;
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

// A strip of fine noise 256 rows tall that wraps, for the quick flicker in
// flame and smoke: cheaper to look up than to work out for every LED.
const FN = new Float32Array(64 * 256);
for (let y = 0; y < 256; y++)
  for (let x = 0; x < 64; x++) {
    const X = x * 0.9, Y = (y * 84) / 256, xi = floor(X), yi = floor(Y), u = X - xi, v = Y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash(xi, yi % 84), b = hash(xi + 1, yi % 84), c = hash(xi, (yi + 1) % 84), e = hash(xi + 1, (yi + 1) % 84);
    FN[y * 64 + x] = a + (b - a) * su + (c - a) * sv + (a - b - c + e) * su * sv;
  }

// Brick, gas and flame by temperature: dull red at 0.15, orange at 0.6, white
// heat at 1. Red stops at 232: pinned at 255 it hid the flicker of the hottest
// chambers, since an LED reads by its brightest channel.
const RAMP = [[0, 24, 4, 2], [0.15, 92, 13, 4], [0.3, 158, 30, 6], [0.45, 204, 68, 12], [0.6, 226, 114, 24], [0.75, 232, 160, 50], [0.88, 232, 194, 96], [1, 232, 216, 160], [1.25, 236, 230, 204]];
const LUT = new Float32Array(768);
for (let i = 0; i < 256; i++) {
  const T = i / 204;
  let k = 0;
  while (k < RAMP.length - 2 && T > RAMP[k + 1][0]) k++;
  const u = cl((T - RAMP[k][0]) / (RAMP[k + 1][0] - RAMP[k][0]), 0, 1);
  for (let c = 0; c < 3; c++) LUT[i * 3 + c] = mix(RAMP[k][c + 1], RAMP[k + 1][c + 1], u);
}
const lut = (T) => cl(round(T * 204), 0, 255) * 3;

// What each LED is, decided again whenever the number of chambers changes.
const SKY = 0, EARTH = 1, FILL = 2, WALL = 3, GAS = 4, POT = 5, SHELF = 6, HOLE = 7, FLUE = 8;
// A vault on low walls: the height of the roof across a chamber, 0.4 at the walls, 1 at the crown.
const arch = (u) => 0.4 + 0.6 * sqrt(max(0, 1 - (2 * u - 1) ** 2));
// The chimney's mouth row.
const TOP = 18;
const WOOD = [150, 118, 66], TOWEL = [214, 204, 184], FACE = [176, 116, 78], COAT = [46, 60, 128], LEGS = [74, 62, 54];
// Jar, flared bowl, bottle and cup: half width up the pot, bottom to top.
const prof = (k, t) => (k === 0 ? (t > 0.84 ? 0.5 : 0.6 + 0.4 * sin(PI * t)) : k === 1 ? 0.5 + 0.5 * t : k === 2 ? (t < 0.55 ? 0.55 + 0.45 * sin((PI * t) / 0.55) : t > 0.88 ? 0.5 : 0.3) : 0.8);

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const S = (params.s = {
    t: 0, n: 0, k1: 0, wind: 0.06, cf: 2,
    kind: new Uint8Array(N), ch: new Uint8Array(N), V: F32(N), J: F32(N), bg: F32(N * 3), gw: F32(N), f: F32(N * 3), A: F32(W * 64), K: F32(W * 64), Q: F32(W * 64),
    T: F32(8).fill(-1), Hc: F32(8).fill(-1), age: F32(8).fill(9), q: F32(8), open: F32(8), Te: F32(8), Br: F32(8),
    puffs: [], sparks: [], wood: [], logs: [], slugs: [], ev: [], stars: [], motes: [],
    pot: { A: 0, tgt: 0, mode: 1, tm: -1.6, thr: 0, k: 0, ph: 0 }, fb: { tm: 1, an: 0 }, flare: 0, np: 0, ns: 0, hand: 0,
  });
  for (let k = 0; k < 40; k++) S.motes.push({ x: rnd() * W, y: rnd() * H, e: rnd() < 0.45 ? 1 : 0, ph: rnd() * 7 });
  // Logs already burning in the firebox.
  for (let k = 0; k < 3; k++) S.logs.push({ c: 0, x: 8 + k * 6 + rnd() * 3, y: 120 + (k & 1), len: 5, life: 0.4 + 0.5 * rnd() });
}

const front = (S) => ((S.k1 + 1) / 2) * (S.n + 0.3);

function build(S, n) {
  S.n = n;
  const P = 77 / n, h = P - 3, Wc = 34 - 2 * n, s = (43 - Wc) / (n - 1);
  // The firebox, then the chambers up the slope, each P rows above the last.
  const g = (S.g = [{ L: 6, W: 25, F: 123, h: 11 }]);
  for (let c = 1; c <= n; c++) g.push({ L: 14 + (c - 1) * s, W: Wc, F: 108 - (c - 1) * P, h });
  const inT = (S.inT = (k, X) => {
    const q = g[k], u = (X - q.L) / q.W;
    return u > 0 && u < 1 ? q.F - q.h * arch(u) : 1e3;
  });
  const outT = (k, X) => {
    const q = g[k], u = (X - q.L + 2) / (q.W + 4);
    return u > 0 && u < 1 ? q.F - (q.h + 2) * arch(u) : 1e3;
  };
  const tp = g[n], CX = (S.CX = tp.L + 0.62 * tp.W);
  const hill = (X) => (X < 4 ? 123 : X < tp.L - 2 ? mix(123, tp.F + 2, (X - 4) / (tp.L - 6)) : mix(tp.F + 2, tp.F - 5, (X - tp.L + 2) / (66 - tp.L)));
  // Flame passages through the floor of each chamber, over the crown of the one below.
  const holes = [];
  for (let c = 1; c <= n; c++) {
    const a = g[c - 1], b = g[c], xc = a.L + a.W / 2;
    for (let x = round(xc - 0.3 * a.W); x <= xc + 0.3 * a.W; x += 4) if (x > b.L && x < b.L + b.W - 2) holes.push([x, c]);
  }
  const { kind, ch, V, bg, gw } = S;
  S.stars = [];
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5, o = i * 3;
    let k = SKY, c = 0, v = 0;
    for (let j = 0; j <= n && !k; j++) if (Y < g[j].F && Y > inT(j, X)) (k = GAS), (c = j), (v = (g[j].F - Y) / g[j].h);
    if (!k && abs(X - CX) < 2 && Y > TOP && Y < inT(n, X) + 0.5) (k = FLUE), (c = n), (v = (Y - TOP) / (inT(n, CX) - TOP));
    if (!k) for (const [hx, hc] of holes) if (x === hx && Y > g[hc].F && Y < inT(hc - 1, X)) (k = HOLE), (c = hc);
    for (let j = 0; j <= n && !k; j++) if (Y < g[j].F + 2 && Y > outT(j, X)) (k = WALL), (c = j);
    if (!k && Y > TOP && ((abs(X - CX) < 4 && Y < outT(n, X) + 1) || (Y < TOP + 2 && abs(X - CX) < 5))) (k = WALL), (c = n + 1);
    for (let j = 1; j <= n && !k; j++) if (X > g[j].L - 2 && X < g[j].L + g[j].W + 2 && Y > g[j].F + 2) k = FILL;
    if (!k && Y > hill(X)) k = EARTH;
    // The fire mouth in the firebox's front wall.
    if (k === WALL && !c && x < 6 && y > 116) (k = GAS), (v = (123 - Y) / 11);
    kind[i] = k;
    ch[i] = c;
    V[i] = v;
    const r = hash(x, y), nz = 0.8 + 0.4 * vn(x * 0.3, y * 0.3);
    let col;
    if (k === SKY) {
      const u = sm(0, 112, Y), dm = Math.hypot(X - 11, Y - 11), cut = Math.hypot(X - 12.6, Y - 10);
      col = [mix(5, 20, u), mix(9, 26, u), mix(32, 62, u)];
      if (dm < 3.6 && cut > 3.2) col = [226, 222, 196];
      else if (dm < 12) for (let j = 0; j < 3; j++) col[j] += [24, 26, 30][j] * exp(-dm / 3.5);
      else if (r < 0.014 && y < 100) {
        const b = 70 + 140 * hash(y, x);
        col = col.map((v2, j) => v2 + b * [0.95, 0.95, 1][j]);
        S.stars.push(i);
      }
    } else if (k === EARTH) {
      // Beds of clay and gravel along the slope, stones, and grass on top.
      const dd = Y - hill(X), bd = 0.75 + 0.5 * vn(dd * 0.3 + x * 0.04, 3.5 + x * 0.02);
      col = dd < 1.5 ? [26, 40, 26] : r < 0.035 ? [62, 56, 50] : [34 * bd * nz, 26 * bd * nz, 21 * bd * nz];
    }
    else if (k === FILL) col = [52 * nz, 36 * nz, 28 * nz];
    else if (k === WALL) {
      const m = c > n ? y % 3 === 0 || (x + (floor(y / 3) & 1) * 2) % 4 === 0 : r < 0.25;
      col = [96, 66, 50].map((v2) => v2 * (m ? 0.62 : 0.85 + 0.3 * r));
    } else col = [0, 0, 0];
    bg[o] = col[0];
    bg[o + 1] = col[1];
    bg[o + 2] = col[2];
  }
  // Inner face of each wall, the brick the fire touches.
  for (let i = 0; i < N; i++)
    if (kind[i] === WALL) {
      const x = i & 63, y = i >> 6;
      let hot = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && X < W && Y >= 0 && Y < H && kind[Y * W + X] >= GAS) hot = 1;
      }
      V[i] = hot;
    }
  // The earth and the air round the kiln are warm: how near each LED is to a wall, and which chamber's.
  gw.fill(0);
  for (let i = 0; i < N; i++)
    if (kind[i] <= FILL) {
      const x = i & 63, y = i >> 6;
      let best = 9;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const X = x + dx, Y = y + dy, d = abs(dx) + abs(dy);
          if (X >= 0 && X < W && Y >= 0 && Y < H && kind[Y * W + X] === WALL && d < best) (best = d), (ch[i] = ch[Y * W + X]);
        }
      gw[i] = best < 9 ? exp(-best / 1.4) * (kind[i] ? 0.8 : 0.6) : 0;
    }
  // Flame jets over each passage in a chamber's floor, and the pull towards the way out at its crown.
  const J = S.J.fill(0);
  for (let i = 0; i < N; i++) {
    if (kind[i] !== GAS || !ch[i]) continue;
    const x = i & 63, c = ch[i], v = V[i], xo = c === n ? CX : g[c].L + g[c].W / 2;
    let e = 0.5 * exp(-abs(x + 0.5 - xo) / 3) * sm(0.55, 1, v);
    for (const [hx, hc] of holes) if (hc === c) e = max(e, exp(-abs(x - hx) / 1.3 - v * 2.2));
    J[i] = e;
  }
  // Shelves and pots: two or three levels a chamber, under the vault.
  for (let c = 1; c <= n; c++) {
    const q = g[c], nl = q.h >= 16 ? 3 : 2, lh = q.h / nl, x0 = round(q.L + max(6, 0.22 * q.W)), x1 = floor(q.L + q.W - 1);
    for (let j = 0; j < nl; j++) {
      const ys = round(q.F - j * lh), base = ys - 1;
      const set = (x, y, k2, v2) => {
        const i = y * W + x;
        if (x >= 0 && x < W && kind[i] === GAS && ch[i] === c) (kind[i] = k2), (V[i] = v2);
      };
      if (j) {
        for (let x = x0; x <= x1; x++) if (inT(c, x + 0.5) < ys - 1) set(x, ys, SHELF, 0);
        for (let y = ys + 1; y < round(q.F - (j - 1) * lh) - (j > 1 ? 0 : 0); y++) set(x0, y, SHELF, 0), set(x1 - 1, y, SHELF, 0);
      }
      for (let x = x0 + 1; x < x1 - 1; ) {
        const ty = floor(hash(c * 7 + j, x) * 4), w = [5, 5, 4, 3][ty];
        let ph = min(floor(lh - 2), [5, 3, 6, 4][ty]);
        const room = floor(base - max(inT(c, x + 0.5), inT(c, x + w - 0.5)) - 1);
        ph = min(ph, room);
        if (ph < 2 || x + w > x1) break;
        for (let r = 0; r < ph; r++) {
          const rad = (prof(ty, (r + 0.5) / ph) * w) / 2;
          for (let xx = x; xx < x + w; xx++) {
            const dx = xx + 0.5 - x - w / 2;
            if (abs(dx) <= rad + 0.15) set(xx, base - r, POT, 0.5 - dx / w + 0.2 * (r === ph - 1 ? 1 : 0));
          }
        }
        x += w + 1;
      }
    }
  }
  // Ladders up the front of each chamber, and the potter's way from one stoke hole to the next.
  const xs = (c) => g[c].L - 4;
  const px = [], py = [];
  S.lad = [];
  S.Ac = [0];
  S.spy = [0];
  for (let c = 1; c <= n; c++) {
    const yw = outT(c, g[c].L - 1.5);
    S.lad.push([round(xs(c)), yw, c === 1 ? outT(0, xs(1)) : outT(c - 1, xs(c))]);
    S.spy.push(round(g[c].F - max(5, 0.35 * h)));
    S.Ac.push(px.length);
    px.push(xs(c)), py.push(g[c].F + 2);
    if (c < n) {
      px.push(xs(c)), py.push(yw);
      for (let x = g[c].L - 1.5; x < xs(c + 1); x += 1.5) px.push(x), py.push(outT(c, x));
      px.push(xs(c + 1)), py.push(outT(c, xs(c + 1)));
    }
  }
  const pl = [0];
  for (let j = 1; j < px.length; j++) pl.push(pl[j - 1] + Math.hypot(px[j] - px[j - 1], py[j] - py[j - 1]));
  Object.assign(S, { px, py, pl });
  S.Ac = S.Ac.map((j, c) => (c ? pl[j] : 0));
  // Where the potter stands now: by the chamber above the one being fired, the first time.
  const pt = S.pot;
  if (!S.built) (S.built = 1), (pt.tgt = min(n, cl(round(front(S)), 1, n) + 1));
  pt.tgt = min(pt.tgt, n);
  pt.A = S.Ac[pt.tgt];
  if (pt.mode === 0) pt.mode = 2;
  S.logs = S.logs.filter((l) => l.c <= n);
  S.wood = [];
  S.slugs = [];
}

// A stoke as the kiln feels it: reduction first, the flame starved and smoky, then the surge.
const red = (a) => (a < 0.2 ? a / 0.2 : exp(-(a - 0.2) / 1.1));
const surge = (a) => sm(0.9, 2.1, a) * exp(-max(0, a - 2.1) / 2.4);

function pulse(S, c, s) {
  S.age[c] = 0;
  S.q[c] = s;
  S.ev.push({ at: 0.25 + 0.12 * (S.n - c), fn: () => S.slugs.push({ y: S.inT(S.n, S.CX), a: 0.5 + 0.5 * s }) });
}

function stoke(S, c) {
  const q = S.g[c];
  pulse(S, c, 1);
  if (c) S.logs.push({ c, x: q.L + 0.5 + rnd() * 2, y: round(q.F) - 1, len: 3 + floor(rnd() * 3), life: 1 });
  else {
    S.logs.push({ c, x: q.L + 2 + rnd() * 9, y: 120 + floor(rnd() * 2), len: 4 + floor(rnd() * 3), life: 1 });
    // The firebox's flame goes on through the first chamber.
    S.ev.push({ at: 0.35, fn: () => pulse(S, 1, 0.6) });
  }
}

function throwTo(S, c, x0, y0, delay = 0) {
  const q = S.g[c];
  S.wood.push({ x0, y0, x1: q.L - 0.5, y1: round(q.F) - 2.5, a: -delay, c });
  S.open[c] = 1.3 + delay;
}

function puff(S, x, y, vy, r, a, k, hot) {
  if (S.puffs.length > 110) S.puffs.shift();
  S.puffs.push({ x, y, vy, r, a, k, hot, ph: rnd() * 7 });
}

function spark(S, x, y, s) {
  if (S.sparks.length > 160) S.sparks.shift();
  const life = 0.8 + 1.4 * rnd();
  S.sparks.push({ x, y, vx: (rnd() - 0.5) * 6 * s, vy: -(10 + 14 * rnd()) * s, life, L: life });
}

// Black smoke reaching the top of the chimney: a cloud, a flare and a fountain of sparks.
function belch(S, a) {
  for (let j = 0; j < 3; j++) puff(S, S.CX + (rnd() - 0.5) * 3, TOP - 1 - j * 2, -11 - 6 * rnd(), 2.6 + rnd(), 0.6 + 0.6 * a, 1, 1);
  for (let j = 0; j < 14 * a; j++) spark(S, S.CX + (rnd() - 0.5) * 3, TOP - 1, 1.3);
  S.flare = min(1.4, S.flare + a);
}

function stokeAll(S) {
  for (let c = 1; c <= S.n; c++) throwTo(S, c, S.g[c].L - 7, S.g[c].F - 6, 0.05 * c);
  throwTo(S, 0, 1, 115);
  S.hand = 0.6;
}

const posAt = (S, A) => {
  const { px, py, pl } = S;
  let j = 1;
  while (j < pl.length - 1 && pl[j] < A) j++;
  const u = cl((A - pl[j - 1]) / max(1e-6, pl[j] - pl[j - 1]), 0, 1);
  return [mix(px[j - 1], px[j], u), mix(py[j - 1], py[j], u), abs(px[j] - px[j - 1]) < 0.01];
};

function step(S, d) {
  S.t += d;
  const { n, T, age, q, Hc, Te, Br, wind } = S, fr = front(S), peak = 0.5 + 0.45 * sm(0, 0.5, (S.k1 + 1) / 2);
  S.cf = cl(round(fr), 1, n);
  for (let c = 0; c <= n; c++) {
    const tg = max(0.2, peak - (1.1 / n) * max(0, c - fr));
    T[c] = T[c] < 0 ? tg : T[c] + (tg - T[c]) * min(1, d * 0.8);
    age[c] += d;
    // Wind up the hill pulls on the chimney and the fire burns hotter; wind down it chokes the draft.
    Te[c] = T[c] + q[c] * (0.1 * surge(age[c]) - 0.15 * red(age[c])) + 0.02 * sin(S.t * 1.3 + c * 2.1) + 0.06 * wind;
    Br[c] = 1 - 0.36 * q[c] * red(age[c]);
    if (Hc[c] < 0) Hc[c] = T[c] - 0.1;
    // Heat work for the cones: it creeps up with the temperature and hardly comes back.
    Hc[c] += (Te[c] - Hc[c]) * d * (Te[c] > Hc[c] ? 0.07 : 0.02);
    S.open[c] = max(0, S.open[c] - d);
  }
  Te[n + 1] = Te[n] - 0.22;
  Br[n + 1] = Br[n];
  for (const e of S.ev) if ((e.at -= d) <= 0) e.fn();
  S.ev = S.ev.filter((e) => e.at > 0);

  // The potter: stoke twice, watch the spy hole, then go where the fire needs wood.
  const pt = S.pot;
  pt.ph += d;
  if (pt.mode === 0) {
    const goal = S.Ac[pt.tgt];
    pt.A += cl(goal - pt.A, -11 * d, 11 * d);
    if (abs(goal - pt.A) < 1e-3) (pt.mode = 1), (pt.tm = 0), (pt.thr = 0);
  } else if (pt.mode === 1) {
    pt.tm += d;
    if (pt.thr < 2 && pt.tm > 0.3 + 0.7 * pt.thr) {
      const [x, y] = posAt(S, pt.A);
      throwTo(S, pt.tgt, x - 1, y - 8);
      pt.thr++;
    }
    if (pt.tm > 1.8) (pt.mode = 2), (pt.tm = 0.8 + rnd());
  } else if ((pt.tm -= d) <= 0) {
    pt.k++;
    pt.tgt = pt.k % 3 === 0 ? min(n, S.cf + 1) : S.cf;
    pt.mode = 0;
  }
  // The firebox stoker feeds the mouth.
  const fb = S.fb;
  fb.an = max(0, fb.an - d);
  if ((fb.tm -= d) <= 0) (fb.tm = 3 + rnd()), (fb.an = 0.5), throwTo(S, 0, 2.5, 116);
  S.hand = max(0, S.hand - d);
  for (const w of S.wood) if ((w.a += d / 0.3) >= 1) (w.done = 1), stoke(S, w.c);
  S.wood = S.wood.filter((w) => !w.done);
  for (const l of S.logs) l.life -= d * (0.12 + 0.2 * T[l.c]);
  S.logs = S.logs.filter((l) => l.life > 0);
  // Black smoke climbing the chimney.
  for (const s of S.slugs) if ((s.y -= d * 30) < TOP) (s.done = 1), belch(S, s.a);
  S.slugs = S.slugs.filter((s) => !s.done);
  S.flare = max(0.15 + 0.35 * sm(0.6, 1, T[n]), S.flare * exp(-d * 1.6));
  air(S, d);
  // Ash falls and embers float, across the whole hillside.
  for (const m of S.motes) {
    m.x += (wind * 9 + 1 + 1.5 * sin(S.t * 0.7 + m.ph)) * d * (m.e ? 1.3 : 1);
    m.y += ((m.e ? -3.5 : 2.2) + 0.8 * sin(S.t * 1.3 + m.ph * 2)) * d;
    m.x = ((m.x % 65) + 65) % 65;
    m.y = ((m.y % 129) + 129) % 129;
  }
}

// Smoke: a steady grey plume, slowing and spreading under the top of the panel, and sparks.
function air(S, d) {
  const { n, T, wind } = S;
  for (S.np += d * 6; S.np >= 1; S.np--) puff(S, S.CX + (rnd() - 0.5) * 2, TOP - 1, -7 - 3 * rnd(), 3, 0.55 + 0.2 * T[n], 0, 0.7);
  for (const p of S.puffs) {
    // A strong wind bends the plume over and draws it out downwind.
    p.vy += (-3.5 * (1 - 0.55 * abs(wind)) * cl(p.y / 12, 0.3, 1) - p.vy) * d * 1.2;
    p.y += p.vy * d;
    p.x += (wind * 18 * (0.5 + 0.5 * cl((TOP - p.y) / TOP, 0, 1)) + 1.2 * sin(S.t * 0.9 + p.ph)) * d;
    p.r = min(10, p.r + d * (1.5 + 1 * p.k + 2 * cl((8 - p.y) / 8, 0, 1)));
    p.a -= d * (0.05 + 0.04 * (1 - p.k));
    p.hot = max(0, p.hot - d * (1.4 - 0.9 * p.k));
  }
  S.puffs = S.puffs.filter((p) => p.a > 0.03 && p.y + p.r > -3 && p.x > -14 && p.x < W + 14);
  for (S.ns += d * (2 + 5 * T[n]) * (1 + 0.6 * wind); S.ns >= 1; S.ns--) spark(S, S.CX + (rnd() - 0.5) * 3, TOP - 1, 1);
  for (const p of S.sparks) {
    p.vy += (-6 - p.vy) * d * 1.5;
    p.vx += ((rnd() - 0.5) * 40 + (wind * 16 - p.vx) * 2) * d;
    p.x += p.vx * d;
    p.y += p.vy * d;
    p.life -= d;
  }
  S.sparks = S.sparks.filter((p) => p.life > 0 && p.y > -1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06];
  S.k1 = cl(k[0], -1, 1);
  S.wind = cl(k[3], -1, 1);
  const n = cl(round(k[2]), 3, 6);
  if (n !== S.n) build(S, n);
  // The kiln has been smoking for hours before you look.
  if (!S.warm) {
    S.warm = 1;
    step(S, 0);
    for (let j = 0; j < 75; j++) air(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) stokeAll(S);
  step(S, cl(dt || 0, 0, 0.1) * (cl(k[1], 0.2, 3) / 2));
}

let F;
function put(x, y, c, a = 1) {
  (x = floor(x)), (y = floor(y));
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) F[o + i] = mix(F[o + i], c[i], a);
}
function add(x, y, c, a) {
  (x = floor(x)), (y = floor(y));
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) F[o + i] += c[i] * a;
}
function glow(x, y, r, c, a) {
  for (let Y = floor(y - r); Y <= y + r; Y++) for (let X = floor(x - r); X <= x + r; X++) add(X, Y, c, a * max(0, 1 - Math.hypot(X + 0.5 - x, Y + 0.5 - y) / r) ** 2);
}
// Colours handed to put() come from a ring of four arrays, to spare the garbage collector.
const RING = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
let ri = 0;
const lc = (T, b = 1) => {
  const r = RING[(ri = (ri + 1) & 3)];
  T = lut(T);
  (r[0] = LUT[T] * b), (r[1] = LUT[T + 1] * b), (r[2] = LUT[T + 2] * b);
  return r;
};

// A figure nine LEDs tall, feet on row y, facing the kiln on the right: a
// white towel, an indigo jacket lit orange on the kiln side, and a paper lantern.
function figure(x, y, pose, ph, rim, lamp) {
  (x = round(x)), (y = round(y));
  const st = floor(ph * 6) & 1, rc = [255, 150, 60];
  const pts = [[-1, -8, TOWEL], [0, -8, TOWEL], [0, -7, FACE, 1]];
  for (let dy = -6; dy <= -4; dy++) pts.push([-1, dy, COAT], [0, dy, COAT], [1, dy, COAT, 1]);
  const L = (a, b2) => pts.push([a, -3, LEGS], [b2, -2, LEGS], [b2, -1, LEGS], [b2, 0, LEGS]);
  if (pose === 1 && st) L(0, 0);
  else if (pose === 2) L(st ? -1 : 1, st ? -1 : 1), L(st ? 1 : -1, st ? 1 : -1), pts.push([st ? -1 : 1, -7, COAT, 1], [st ? 1 : -1, -3, LEGS]);
  else L(-1, -1), L(1, 1);
  // Throwing: the arm swings the wood from behind the head into the hole.
  if (pose === 3) pts.push(...(ph < 0.5 ? [[-1, -7, COAT], [-2, -8, COAT]] : [[2, -5, COAT, 1], [3, -5, FACE, 1]]));
  for (const [dx, dy, c, k] of pts) put(x + dx, y + dy, k ? c.map((v, i) => mix(v, rc[i], rim)) : c);
  if (lamp) {
    put(x - 2, y - 4, [120, 70, 40]);
    put(x - 2, y - 3, [255, 222, 150]), put(x - 2, y - 2, [240, 160, 80]);
    glow(x - 1.5, y - 2, 7, [70, 44, 16], 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  F = S.f;
  const { n, t, kind, ch, V, J, bg, gw, Te, Br, g, wind, A, K, Q } = S, lean = wind * 2.2 + 0.8, fs = 1 + 0.45 * wind, fo = floor(t * fs * 17);
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const k = kind[i], c = ch[i];
    if (k <= FILL) {
      (F[o] = bg[o]), (F[o + 1] = bg[o + 1]), (F[o + 2] = bg[o + 2]);
      if (gw[i] > 0.02) {
        const j = lut(Te[c] * 0.7), w = gw[i] * 0.28 * Br[c];
        (F[o] += LUT[j] * w), (F[o + 1] += LUT[j + 1] * w), (F[o + 2] += LUT[j + 2] * w);
      }
      continue;
    }
    const x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5, T = Te[c], B = Br[c];
    let j = 0, b = 1;
    if (k === WALL) {
      const hot = V[i];
      j = lut(T * 0.85 - 0.05);
      b = B * (hot ? 0.5 : 0.1);
      (F[o] = bg[o] * (hot ? 0.45 : 0.95) + LUT[j] * b), (F[o + 1] = bg[o + 1] * (hot ? 0.45 : 0.95) + LUT[j + 1] * b), (F[o + 2] = bg[o + 2] * (hot ? 0.45 : 0.95) + LUT[j + 2] * b);
      continue;
    }
    if (k === GAS) {
      const v = V[i];
      const n1 = vn(X * 0.45 - lean * (0.3 + v) * 3 + c * 19, (Y + t * fs * 10) * 0.16), n2 = FN[((y + fo) & 255) * 64 + x];
      let I = sm(0.25, 0.85, 0.65 * n1 + 0.35 * n2 + 0.22 * (1 - v) - 0.12 + 0.45 * J[i]);
      // The firebox floor: a bed of embers under the logs.
      if (!c && v < 0.3) I = sm(0.35, 0.85, 0.7 * vn(X * 0.7, Y * 0.9 + t * 0.4) + 0.3 * vn(X * 1.7 + t, Y * 1.5) + 0.1);
      // Darker flame is cooler, so it goes orange rather than grey. The firebox burns rougher.
      const r = c ? 0.14 : 0.26;
      j = lut(T - r + 2 * r * I);
      b = B * (1 - 2 * r + 2 * r * I);
    } else if (k === POT) (j = lut(T - 0.18)), (b = B * (0.32 + 0.22 * V[i] + 0.14 * FN[((y + (fo >> 1)) & 255) * 64 + (x >> 1)]));
    else if (k === SHELF) (j = lut(T - 0.2)), (b = B * 0.4);
    else if (k === HOLE) (j = lut(mix(Te[c - 1], T, 0.5) + 0.04)), (b = 0.85 + 0.15 * sin(t * 9 + x));
    else {
      // The flue: hot gas rising in bands, and the black smoke of each stoke going up through it.
      let dk = 0;
      for (const s of S.slugs) dk = max(dk, s.a * exp(-(((Y - s.y) / 3) ** 2)));
      j = lut(T - 0.12 - 0.2 * V[i] + 0.1 * vn(X * 0.6, (Y + t * 22) * 0.3));
      b = B * (0.6 + 0.3 * vn(X * 0.5 + 9, (Y + t * 26) * 0.2)) * (1 - 0.85 * dk);
    }
    (F[o] = LUT[j] * b), (F[o + 1] = LUT[j + 1] * b), (F[o + 2] = LUT[j + 2] * b);
  }
  // Stars twinkle.
  for (const i of S.stars) if (kind[i] === SKY) for (let c = 0; c < 3; c++) F[i * 3 + c] *= 0.75 + 0.25 * sin(t * 2.3 + i);

  // Burning wood on the chamber floors and in the firebox.
  for (const l of S.logs) {
    const T = Te[l.c], len = max(1, round(l.len * min(1, l.life * 1.6)));
    for (let k = 0; k < len; k++) {
      put(l.x + k, l.y, (k + floor(t * 4 + l.x)) % 3 ? lc(T - 0.45, 0.45) : lc(T + 0.1));
      // A log in the firebox is thicker, its top edge burning.
      if (!l.c) put(l.x + k, l.y - 1, lc(T - 0.1 + 0.15 * sin(t * 7 + k + l.x)), 0.85);
    }
  }
  // Holes in the front walls: the stoke hole, open while wood goes in, and the spy hole with its cones.
  for (let c = 1; c <= n; c++) {
    const q = g[c], T = Te[c], wx = floor(q.L - 1.5), sy = S.spy[c], fy = round(q.F), op = sm(0, 0.3, S.open[c]);
    for (let y = fy - 3; y <= fy - 2; y++) for (let x = wx; x <= wx + 1; x++) put(x, y, op > 0.05 ? lc(T + 0.05, op) : lc(T - 0.3, 0.35));
    if (op > 0.05) glow(wx - 1, fy - 2.5, 6, lc(T - 0.1), 0.35 * op);
    put(wx, sy, lc(T, 0.9)), put(wx + 1, sy, lc(T));
    // Three cones on a pad: each bends over once the heat work passes its number.
    for (let x = wx + 2; x <= wx + 6; x++) put(x, sy + 2, lc(T - 0.2, 0.4));
    for (let m = 0; m < 3; m++) {
      const b2 = sm(0.62 + 0.12 * m - 0.05, 0.62 + 0.12 * m + 0.06, S.Hc[c]), cx = wx + 2 + 2 * m, cc = lc(T - 0.15, 0.5);
      put(cx, sy + 1, cc);
      if (b2 < 0.75) put(cx + (b2 > 0.4 ? 1 : 0), sy, cc);
      put(cx + (b2 > 0.4 ? 1 : 0), b2 < 0.75 ? sy - 1 : sy + 1, cc);
      if (b2 >= 0.75) put(cx + 1, sy, cc, 0.5);
    }
  }
  // Ladders.
  for (const [lx, y0, y1] of S.lad)
    for (let y = floor(y0); y <= y1; y++) {
      put(lx - 1, y, WOOD, 0.7), put(lx + 1, y, WOOD, 0.7);
      if (!(y % 3)) put(lx, y, WOOD, 0.6);
    }
  // Tongues of flame out of the spy holes after a stoke, leaning with the draft.
  for (let c = 1; c <= n; c++) {
    const s = max(S.q[c] * red(S.age[c]) * sm(0.15, 0.35, S.age[c]), 0.55 * S.q[c - 1] * red(S.age[c - 1] - 0.3) * sm(0.4, 0.6, S.age[c - 1])) + 0.3 * max(0, -wind) * (0.7 + 0.3 * sin(t * 3 + c));
    if (s < 0.05) continue;
    const x0 = floor(g[c].L - 1.5) - 0.5, y0 = S.spy[c] + 0.5, len = 2 + 9 * s * (0.8 + 0.2 * sin(t * 13 + c)), T = Te[c];
    glow(x0, y0, 5, [120, 50, 10], s);
    for (let j = 0; j < len; j++) {
      const u = j / len, x = x0 - j * (1 - 0.6 * max(0, wind)) + wind * j * 0.4, y = y0 - j * j * 0.06 - j * 0.15 + sin(t * 17 + j) * 0.4 * u, cc = lc(T + 0.3 - 0.6 * u);
      put(x, y, cc, 1 - u * 0.3);
      if (u < 0.7) put(x, y - 1, lc(T + 0.1 - 0.6 * u), 0.8 - u), put(x, y + 1, lc(T - 0.6 * u), 0.5 - 0.5 * u);
    }
  }
  // The flying wood.
  for (const w of S.wood) {
    if (w.a < 0) continue;
    const x = mix(w.x0, w.x1, w.a), y = mix(w.y0, w.y1, w.a) - 2 * sin(PI * w.a);
    put(x, y, [196, 150, 96]), put(x - 1, y + (w.a < 0.5 ? 1 : 0), [130, 86, 50]);
  }
  // The potter and the firebox stoker.
  const pt = S.pot, [px, py, climb] = posAt(S, pt.A), cc = S.cf;
  const pose = S.hand > 0 || pt.mode === 1 ? 3 : pt.mode === 0 ? (climb ? 2 : 1) : 0;
  const ph = pose === 3 ? (S.hand > 0 ? 1 - S.hand / 0.6 : (pt.tm % 0.7) / 0.7) : pt.ph;
  figure(px, py, pose, ph, 0.25 + 0.6 * sm(0, 0.3, S.open[pt.tgt]) * (pt.mode === 1 ? 1 : 0), 1);
  const fbo = S.fb.an > 0 ? 3 : 0;
  figure(1, 122, fbo, 1 - S.fb.an / 0.5, 0.5 + 0.3 * sin(t * 7), 0);
  glow(5, 120, 6, lc(Te[0] - 0.1), 0.35);
  void cc;

  // Smoke: every puff summed over the top half, then shaded: grey lit by the fire, black after a stoke.
  A.fill(0), K.fill(0), Q.fill(0);
  for (const p of S.puffs) {
    const r = p.r;
    for (let y = max(0, floor(p.y - r)); y <= min(63, p.y + r); y++)
      for (let x = max(0, floor(p.x - r)); x <= min(W - 1, p.x + r); x++) {
        const dx = (x + 0.5 - p.x) / r, dy = (y + 0.5 - p.y) / r, w = 1 - dx * dx - dy * dy;
        if (w > 0) {
          const a = p.a * w * w, i = y * W + x;
          (A[i] += a), (K[i] += a * p.k), (Q[i] += a * p.hot);
        }
      }
  }
  for (let i = 0; i < W * 64; i++) {
    if (A[i] < 0.01) continue;
    const x = i & 63, y = i >> 6, o = i * 3, tx = 0.6 * vn(x * 0.25 - t * wind, y * 0.25 + t * 0.8) + 0.4 * FN[((y + (fo >> 2)) & 255) * 64 + x], al = min(0.95, (1 - exp(-A[i] * 2.2)) * (0.6 + 0.6 * tx));
    const dk = K[i] / A[i], hq = min(1, Q[i] / A[i]) * (0.4 + 0.6 * sm(30, 10, y)), gr = 0.7 + 0.5 * tx;
    F[o] = mix(F[o], mix(118 * gr, 16, dk) + 160 * hq, al);
    F[o + 1] = mix(F[o + 1], mix(106 * gr, 11, dk) + 60 * hq, al);
    F[o + 2] = mix(F[o + 2], mix(104 * gr, 10, dk) + 14 * hq, al);
  }
  // Flame licking out of the chimney's mouth.
  const fl = S.flare, CX = S.CX;
  glow(CX, TOP, 6, [110, 40, 8], fl * 0.8);
  for (let j = 0; j < 2 + 7 * fl; j++) {
    const u = j / (2 + 7 * fl), x = CX + wind * j * 0.6 + sin(t * 11 + j) * 0.6 * u;
    put(x, TOP - 1 - j, lc(Te[n] - 0.05 - 0.45 * u), 1 - 0.5 * u);
    if (u < 0.5) put(x - 1, TOP - 1 - j, lc(Te[n] - 0.25 - 0.4 * u), 0.6), put(x + 1, TOP - 1 - j, lc(Te[n] - 0.25 - 0.4 * u), 0.6);
  }
  // Sparks, ash and embers.
  for (const p of S.sparks) put(p.x, p.y, lc(0.35 + 0.75 * (p.life / p.L)), min(1, p.life * 2));
  for (const m of S.motes) m.e ? put(m.x, m.y, [230, 110, 30], 0.5 + 0.4 * sin(t * 5 + m.ph)) : put(m.x, m.y, [80, 78, 84], 0.6);

  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
