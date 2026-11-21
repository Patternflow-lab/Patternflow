// ===== Patternflow pattern =====
// Title:   Knickpoint
// Family:  landform
// Idea:    A mountain range seen from above, one LED to a patch of ground, is cut down by its own rivers under a stream-power model that has already run for 83 seconds when the first frame is drawn, olive lowland and ochre slope and grey rock and a white crest under a low north-west sun with blue rivers through it, and every 24 to 46 seconds the sea drops or a fault lifts one side of the panel, so that a knickpoint, a step in the riverbed drawn as a bright flash, climbs the rivers from their mouths while the divides creep and a stream now and then takes the headwaters of its neighbour.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: stream power incision model (Howard and Kerby, 1983; Alan Howard, 1994), a landscape grown on a grid by channel growth and hillslope creep (Garry Willgoose, Rafael Bras and Ignacio Rodriguez-Iturbe, 1991), knickpoints as kinematic waves of the model with slope exponent 1 (Kelin Whipple and Gregory Tucker, 1999), the implicit O(n) solution of the stream power equation (Jean Braun and Sean Willett, 2013), depression filling by priority flood (Richard Barnes, Clarence Lehman and David Mulla, 2014), the second-order upwind scheme of Beam and Warming, hill shading (Berthold Horn, 1981); pattern round 211
// Round:   211
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..3, Uplift=-1..1, Sun=0..1
//
// Knob 1: Hue. Turns every colour of the map, ground and rivers together, round the wheel. At 0 the ground is olive, ochre, grey rock and white crest under blue rivers. At 0.5 it is a blue and violet ground with orange rivers, and at 1 it is back where it began.
// Knob 2: Rate. How fast the model runs, 4.2 model time units a second for each unit of Rate. At 0 the map stands still, sun and flashes included. At 2, where it opens, a knickpoint climbs the main river, about 110 LEDs long, at 6 LEDs a second near the mouth and takes 27 seconds to reach its head; at 1 it takes about 49 seconds and at 3 about 18. Events keep to the model's clock, so they come 24 to 46 seconds apart at Rate 2, 48 to 92 at Rate 1 and 16 to 31 at Rate 3.
// Knob 3: Uplift. How hard the range has been pushed up, as it reads on the map. The relief in the shading is 1.5 to the power of the knob times as steep (0.67 at -1, 1.5 at 1), and the colours move with it: 35 percent of the panel is above the grey-rock band at 0, 52 percent at 1 and 22 percent at -1.
// Knob 4: Sun. Where the sun stands, as a bearing clockwise from north: 300 degrees plus 360 times the knob, so 322 where it opens, and the same again at 0 and at 1. It stands 28 degrees up. It swings about its bearing by up to 46 degrees and rises and sinks by up to 11, over spans of 36 to 97 seconds at Rate 2, and the panel is held at one mean brightness at every bearing.

// What the map is. A height z for each of the 64 by 128 LEDs and one equation for it,
//   dz/dt = U - K A^m S + D del^2 z,
// where A is the area drained through an LED (in LEDs), S the slope down to the LED it drains to, m = 0.35, K = 0.043 and
// D = 0.04, a LED being 1 across. The slope exponent is 1, which is what lets a step in a riverbed travel upstream at
// K A^m LEDs per time unit without changing its height. U is 0.02 on average and lies 48 to 72 percent above that at one
// edge of the panel and as far below it at the other, the lean turning once in about ten minutes at Rate 2 and never at an even
// pace. A time unit is 1/8.4 s at Rate 2.
// The right edge from row 96 down and the bottom edge from column 14 on are the sea (81 LEDs, held at sea level). The rest of the
// edge is shut, and the LEDs along it are lifted up to 50 percent faster so that it stays a divide instead of becoming a river.
// Rivers are drawn where A reaches 24 LEDs, in 2 LEDs where it reaches 220, and the hue of a river goes from pale to deep blue
// with the log of A up to 3,000.
// Before the first frame the model runs 700 time units (83 s at Rate 2): 140 steps of 4 grow the network from a ramp and
// a grain of noise, 80 of 1 settle it and 150 of 0.4 follow the first sea drop, which falls at unit 640. Steps over 1 are implicit.
// A step of 1 or less is explicit and second-order upwind, which holds a knickpoint to a few LEDs instead of smearing it over twenty.
// The creep term leaves out river LEDs: with it on, the slopes beside a gorge shed into the river and smeared a knickpoint the same way.
// What lights a river LED is its height falling more than 1.2 times as fast as the rock rises under it, full at 4.6 times.
// The ground beside it takes 40 percent of that light. The glow fades to a third in 0.8 s.
// Colour is the rank of a height among all the heights, not the height, so that each of the four bands keeps a share of the
// panel while the range grows and wears.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, pow, exp, log, sin, cos, PI, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

// ---- the model
const MEXP = 0.35; // area exponent m, with slope exponent n = 1
const KERO = 0.043; // erodibility K
const DIFF = 0.04; // hillslope diffusivity D
const U0 = 0.02; // rock uplift per model time unit
const TILT = 0.6; // how far the uplift leans across the panel
const WALL = 0.5; // extra uplift along the closed edges, so that they stay divides
const NOISE = 3; // cell-scale roughness of the starting ground, in elevation units
const BX0 = 14, RY0 = 96; // the bottom edge is open from this column on, the right edge from this row on
const SPS = 4.2; // model time units a second at Rate 1
const REF = SPS * 2; // model time units in a second at Rate 2
const NB = 4096; // buckets of the flood queue
const AC = 24, AW = 220, AMAX = 3000; // drainage areas, in LEDs, of a thin river, a wide one, and the top of the colour scale
const BLOOM = 0.4; // how much of a flash the ground beside it takes
const TAIL = 0.8; // seconds a flash takes to fade to a third
const GLOW0 = 1.2, GLOW1 = 3.4; // a river LED starts to light when it sinks this many times faster than the rock rises, and is full this much above
const VEXN = 28; // how steep the whole relief looks in the shading
const EXPOSURE = 0.84; // the mean light on the ground, as a share of full

// ---- neighbour tables
const NBR = new Int32Array(N * 8), OUTLET = new Uint8Array(N);
const INVD = [1, 1, 1, 1, 0.7071067811865476, 0.7071067811865476, 0.7071067811865476, 0.7071067811865476];
const DX = [1, -1, 0, 0, 1, -1, 1, -1], DY = [0, 0, 1, -1, 1, 1, -1, -1];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    OUTLET[i] = (y === H - 1 && x >= BX0) || (x === W - 1 && y >= RY0) ? 1 : 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      NBR[i * 8 + k] = nx < 0 || nx >= W || ny < 0 || ny >= H ? -1 : ny * W + nx;
    }
  }
const POWTAB = new Float64Array(N + 2);
for (let a = 0; a <= N + 1; a++) POWTAB[a] = KERO * pow(max(a, 1), MEXP);

function hsvOf(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, mx > 0 ? d / mx : 0, mx / 255];
}
function rgbOf(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [r * 255, g * 255, b * 255];
}

// Ground colour by rank of height: olive lowland, ochre, grey rock, white crest.
const STOPS = [
  [0.0, 96, 122, 42],
  [0.28, 140, 146, 58],
  [0.45, 204, 164, 80],
  [0.65, 156, 150, 140],
  [0.85, 204, 202, 198],
  [1.0, 244, 242, 238],
];
function stopColour(t, out) {
  let k = 0;
  while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
  const a = STOPS[k], b = STOPS[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * u;
  out[1] = a[2] + (b[2] - a[2]) * u;
  out[2] = a[3] + (b[3] - a[3]) * u;
}

function makeState() {
  const F = () => new Float64Array(N);
  return {
    z: F(), zf: F(), tmp: F(), zp: F(),
    A: F(), wall: F(), cA: F(), rinv: F(), px: F(), py: F(),
    order: new Int32Array(N), rank: new Int32Array(N), recv: new Int32Array(N), par: new Int32Array(N),
    vis: new Uint8Array(N), chan: new Uint8Array(N), head: new Int32Array(NB), nxt: new Int32Array(N),
    fl: new Float32Array(N), rlist: new Int32Array(N), rstamp: new Int32Array(N), rn: 0,
    buf: new Uint8ClampedArray(N * 3), cnt: new Float64Array(128), sh: new Float32Array(N),
    tau: 0, sea: 0, since: 0, evK: 0, nextEv: 0, zref: 10, lo: 0, sc: 1,
    cdf: new Float32Array(129), hueDone: -1,
    landLut: new Float32Array(256 * 3), riverLut: new Float32Array(64 * 3), flashCol: [235, 250, 255],
    knobs: [0, 2, 0, 0.06],
  };
}

// ---- flow routing: a priority flood from the open edges. The pop order is a
// valid order from the sea up. Each LED drains to the steepest of the
// neighbours popped before it, and the drainage areas gather in the reverse
// order.
function route(S) {
  const { z, zf, order, rank, recv, par, vis, head, nxt, A, cA, rinv } = S;
  let zmax = -1e9;
  for (let i = 0; i < N; i++) {
    if (OUTLET[i]) z[i] = S.sea;
    if (z[i] > zmax) zmax = z[i];
  }
  const zmin = S.sea, scale = (NB - 1) / max(1e-6, zmax - zmin);
  head.fill(-1);
  vis.fill(0);
  for (let i = 0; i < N; i++)
    if (OUTLET[i]) {
      vis[i] = 1;
      zf[i] = S.sea;
      par[i] = -1;
      nxt[i] = head[0];
      head[0] = i;
    }
  let cur = 0, k = 0;
  while (k < N) {
    while (head[cur] < 0) cur++;
    const p = head[cur];
    head[cur] = nxt[p];
    order[k] = p;
    rank[p] = k++;
    const zp = zf[p], o = p * 8;
    for (let j = 0; j < 8; j++) {
      const n = NBR[o + j];
      if (n < 0 || vis[n]) continue;
      vis[n] = 1;
      const zn = z[n] > zp ? z[n] : zp + 1e-9;
      zf[n] = zn;
      par[n] = p;
      let b = ((zn - zmin) * scale) | 0;
      if (b > NB - 1) b = NB - 1;
      if (b < cur) b = cur;
      nxt[n] = head[b];
      head[b] = n;
    }
  }
  A.fill(1);
  for (let q = 0; q < N; q++) {
    const i = order[q];
    if (OUTLET[i]) {
      recv[i] = -1;
      continue;
    }
    let best = par[i], bd = 1, bs = -1e9;
    const zi = zf[i], o = i * 8;
    for (let j = 0; j < 8; j++) {
      const n = NBR[o + j];
      if (n < 0 || rank[n] >= q) continue;
      const s = (zi - zf[n]) * INVD[j];
      if (s > bs) {
        bs = s;
        best = n;
        bd = INVD[j];
      }
    }
    recv[i] = best;
    rinv[i] = bd;
  }
  for (let q = N - 1; q >= 0; q--) {
    const i = order[q], r = recv[i];
    if (r >= 0) A[r] += A[i];
  }
  let rn = 0;
  for (let i = 0; i < N; i++) {
    cA[i] = POWTAB[A[i] | 0];
    S.chan[i] = A[i] >= AC ? 1 : 0;
    if (A[i] < AC) continue;
    S.rlist[rn] = i;
    // A wide river takes a second LED beside it, to the east where it runs
    // up and down and to the south where it runs across.
    let st = -1;
    const r = recv[i];
    if (A[i] >= AW && r >= 0) {
      const x = i % W;
      st = r % W === x ? (x < W - 1 ? i + 1 : i - 1) : i + W < N ? i + W : i - W;
    }
    S.rstamp[rn++] = st;
  }
  S.rn = rn;
  S.since = 0;
}

function uplift(S, i, c, s, a) {
  return U0 * (1 + a * (S.px[i] * c + S.py[i] * s)) * S.wall[i];
}

// Hillslopes creep downhill. A river LED is left out of it: the creep would
// fill a knickpoint in as fast as the river cut it.
function diffuse(S, h) {
  const sub = Math.ceil((DIFF * h) / 0.2), dd = (DIFF * h) / sub;
  for (let it = 0; it < sub; it++) {
    const z = S.z, tmp = S.tmp;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x, zi = z[i];
        if (OUTLET[i] || S.chan[i]) {
          tmp[i] = OUTLET[i] ? S.sea : zi;
          continue;
        }
        const e = x < W - 1 ? z[i + 1] : zi, w = x > 0 ? z[i - 1] : zi;
        const s = y < H - 1 ? z[i + W] : zi, n = y > 0 ? z[i - W] : zi;
        tmp[i] = zi + dd * (e + w + s + n - 4 * zi);
      }
    S.z = tmp;
    S.tmp = z;
  }
}

// Rivers wear down by stream power with a slope exponent of 1, which carries
// a step in a riverbed upstream at the speed K A^m without changing its
// shape. A long step uses the implicit scheme of Braun and Willett, every LED
// taking its receiver's new height. A short one uses the second-order upwind
// scheme of Beam and Warming along the flow path, which keeps a knickpoint
// sharp.
function incise(S, h, c, s, a) {
  const { z, zp, order, recv, cA, rinv } = S;
  if (h > 1) {
    for (let q = 0; q < N; q++) {
      const i = order[q], r = recv[i];
      if (r < 0) {
        z[i] = S.sea;
        continue;
      }
      const f = h * cA[i] * rinv[i];
      z[i] = (z[i] + h * uplift(S, i, c, s, a) + f * z[r]) / (1 + f);
    }
    return;
  }
  for (let q = 0; q < N; q++) {
    const i = order[q], r = recv[i];
    if (r < 0) {
      z[i] = S.sea;
      continue;
    }
    let f = h * cA[i] * rinv[i];
    if (f > 1) f = 1;
    const rr = recv[r], zi = zp[i], zr = zp[r], zrr = rr >= 0 ? zp[rr] : zr;
    z[i] = zi + h * uplift(S, i, c, s, a) - f * (zi - zr) - 0.5 * f * (1 - f) * (zi - 2 * zr + zrr);
  }
}

// The uplift leans across the panel, and the direction of the lean turns
// slowly, at an unsteady rate.
function tiltOf(S) {
  const th = 0.9 + 0.00125 * S.tau + 0.8 * sin(0.00071 * S.tau + 0.4);
  const a = TILT * (0.8 + 0.4 * sin(0.00053 * S.tau + 1.1));
  const c = cos(th), s = sin(th);
  return [c, s, a / (abs(c) + abs(s))];
}

// One event: the sea drops, or a fault lifts the side of the panel away from
// the sea. The next comes 24 to 46 seconds later at Rate 2, by a gap that
// never repeats.
function strike(S) {
  const k = S.evK++;
  if (fr(k * 0.7548777 + 0.2) < 0.5) {
    S.sea -= S.zref * (0.11 + 0.05 * fr(k * 0.318 + 0.5));
  } else {
    const x0 = 14 + 36 * Math.random(), y0 = 30 + 68 * Math.random(), psi = 0.3 + 0.95 * Math.random();
    const nx = -cos(psi), ny = -sin(psi), tx = -ny, ty = nx;
    const bow = (Math.random() - 0.5) * 0.012, reach = 40 + 40 * Math.random();
    const drop = S.zref * (0.1 + 0.06 * Math.random());
    const z = S.z;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = x - x0, dy = y - y0, along = dx * tx + dy * ty;
        const across = dx * nx + dy * ny - bow * along * along;
        z[y * W + x] += drop * exp(-(along * along) / (reach * reach)) * sm(0.5 + across / 3.5);
      }
  }
  S.nextEv = S.tau + REF * (24 + 22 * fr(0.6180339887 * (S.evK + 1) + 0.37));
  S.since = 1e9;
}

// Colour goes by the rank of a height among all the heights, so that olive
// lowland, ochre, grey rock and white crest each hold a share of the panel
// however tall the range has grown.
function rankHeights(S, snap) {
  const { z, cdf, cnt } = S;
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < N; i++) {
    if (z[i] < lo) lo = z[i];
    if (z[i] > hi) hi = z[i];
  }
  const sc = 127.999 / max(1e-9, hi - lo);
  cnt.fill(0);
  for (let i = 0; i < N; i++) cnt[((z[i] - lo) * sc) | 0]++;
  S.lo = lo;
  S.sc = sc;
  const k = snap ? 1 : 0.2;
  let run = 0;
  cdf[0] += (0 - cdf[0]) * k;
  for (let b = 0; b < 128; b++) {
    run += cnt[b];
    cdf[b + 1] += (run / N - cdf[b + 1]) * k;
  }
}

// A river LED lights when its height falls much faster than the rock rises
// under it, which is what a knickpoint passing does.
function glow(S, h) {
  const { z, zp, fl, rlist, rn } = S;
  const inv = 1 / (h * U0);
  for (let k = 0; k < rn; k++) {
    const i = rlist[k];
    const f = sm(((zp[i] - z[i]) * inv - GLOW0) / GLOW1);
    if (f > fl[i]) fl[i] = f;
  }
}

function advance(S, h, mark) {
  S.tau += h;
  if (S.tau >= S.nextEv) strike(S);
  S.sea -= S.sea * (1 - exp(-h / (REF * 40)));
  S.since += h;
  if (S.since >= 0.6) {
    route(S);
    rankHeights(S, false);
  }
  const [c, s, a] = tiltOf(S);
  S.zp.set(S.z);
  incise(S, h, c, s, a);
  diffuse(S, h);
  if (mark) glow(S, h);
}

// ---- the starting ground: a slope down to the open edges under two scales of
// smooth noise and a grain of single-LED noise for the first rills to grow from.
function initial(S) {
  const z = S.z;
  const lattice = (cell) => {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = new Float64Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
    return (x, y) => {
      const u = x / cell, v = y / cell, iu = floor(u), iv = floor(v), fu = sm(u - iu), fv = sm(v - iv);
      const a = g[iv * gw + iu], b = g[iv * gw + iu + 1], c = g[(iv + 1) * gw + iu], d = g[(iv + 1) * gw + iu + 1];
      return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
    };
  };
  const n1 = lattice(9), n2 = lattice(20);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, dd = min((H - 1 - y) / (H - 1), ((W - 1 - x) * 2) / (H - 1));
      z[i] = 10 * (0.6 * dd + 0.35 * n1(x, y) + 0.3 * n2(x, y)) + NOISE * Math.random();
      S.px[i] = (x - (W - 1) / 2) / (W / 2);
      S.py[i] = (y - (H - 1) / 2) / (H / 2);
      const east = OUTLET[y * W + W - 1] ? 99 : W - 1 - x, south = OUTLET[(H - 1) * W + x] ? 99 : H - 1 - y;
      S.wall[i] = 1 + WALL * exp(-min(x, y, east, south) / 3);
    }
}

// The model is run on before the first frame: coarse steps to grow the
// network, then short ones, with the sea dropping 70 units in, so that the
// first picture already has a knickpoint on its way up.
export function setup(params) {
  const S = (params.s = makeState());
  initial(S);
  route(S);
  S.nextEv = 640;
  for (let i = 0; i < 140; i++) advance(S, 4, false);
  S.zref = Float64Array.from(S.z).sort()[floor(N * 0.985)];
  for (let i = 0; i < 80; i++) advance(S, 1, false);
  for (let i = 0; i < 150; i++) advance(S, 0.4, false);
  S.zref = Float64Array.from(S.z).sort()[floor(N * 0.985)];
  rankHeights(S, true);
  route(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.knobs = kn;
  const decay = exp(-d / TAIL), fl = S.fl;
  for (let k = 0; k < N; k++) fl[k] *= decay;
  let rest = cl(kn[1], 0, 3) * SPS * d;
  while (rest > 1e-9) {
    const h = min(rest, 0.45);
    advance(S, h, true);
    rest -= h;
  }
}

// Palette tables, rebuilt when Hue moves: the hue is added to every colour.
function buildLuts(S, hue) {
  const t = [0, 0, 0];
  for (let k = 0; k < 256; k++) {
    stopColour(k / 255, t);
    const [h, s, v] = hsvOf(t[0], t[1], t[2]);
    const c = rgbOf(h + hue, s, v);
    S.landLut.set(c, k * 3);
  }
  const thin = [96, 172, 240], wide = [18, 78, 214];
  for (let k = 0; k < 64; k++) {
    const u = k / 63;
    const [h, s, v] = hsvOf(thin[0] + (wide[0] - thin[0]) * u, thin[1] + (wide[1] - thin[1]) * u, thin[2] + (wide[2] - thin[2]) * u);
    S.riverLut.set(rgbOf(h + hue, s, v), k * 3);
  }
  const [h, s, v] = hsvOf(235, 250, 255);
  S.flashCol = rgbOf(h + hue, s, v);
  S.hueDone = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const kn = S.knobs, hue = cl(kn[0], 0, 1), k3 = cl(kn[2], -1, 1);
  if (S.hueDone !== hue) buildLuts(S, hue);
  const { z, buf, sh, landLut, cdf, lo, sc } = S;
  // The sun swings about the bearing Sun sets, and rises and sinks a little, as a day does in a time-lapse.
  const swing = 0.4 * sin((2 * PI * S.tau) / (REF * 36)) + 0.24 * sin((2 * PI * S.tau) / (REF * 59) + 1.3) + 0.16 * sin((2 * PI * S.tau) / (REF * 97) + 3.1);
  const alt = 0.49 + 0.13 * sin((2 * PI * S.tau) / (REF * 43) + 0.7) + 0.07 * sin((2 * PI * S.tau) / (REF * 71) + 2.2);
  const az = ((300 + 360 * cl(kn[3], 0, 1)) * PI) / 180 + swing;
  const lx = sin(az) * cos(alt), ly = -cos(az) * cos(alt), lz = sin(alt);
  const vex = (VEXN * pow(1.5, k3)) / S.zref, gam = pow(1.7, -k3);
  let total = 0;
  for (let y = 0; y < H; y++) {
    const ym = y > 0 ? y - 1 : 0, yp = y < H - 1 ? y + 1 : y;
    for (let x = 0; x < W; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < W - 1 ? x + 1 : x;
      const a = z[ym * W + xm], b = z[ym * W + x], c = z[ym * W + xp];
      const d = z[y * W + xm], f = z[y * W + xp];
      const g = z[yp * W + xm], hh = z[yp * W + x], ii = z[yp * W + xp];
      // Horn's gradient, then the light on the slope against the light on level ground.
      const gx = (c + 2 * f + ii - (a + 2 * d + g)) * 0.125 * vex;
      const gy = (g + 2 * hh + ii - (a + 2 * b + c)) * 0.125 * vex;
      const v = 0.5 + (0.5 * (-gx * lx - gy * ly + lz)) / sqrt(1 + gx * gx + gy * gy) / lz;
      sh[y * W + x] = v;
      total += v;
    }
  }
  // Whichever way the sun stands, the panel as a whole is held at the same brightness.
  const expo = EXPOSURE / (total / N);
  for (let i = 0; i < N; i++) {
    const v = cl(sh[i] * expo, 0.42, 1.0);
    const bf = cl((z[i] - lo) * sc, 0, 127.99), bi = bf | 0;
    const rank = cdf[bi] + (cdf[bi + 1] - cdf[bi]) * (bf - bi);
    const li = ((pow(rank, gam) * 255) | 0) * 3, o = i * 3;
    buf[o] = landLut[li] * v;
    buf[o + 1] = landLut[li + 1] * v;
    buf[o + 2] = landLut[li + 2] * v;
  }
  const { A, fl, rlist, rstamp, rn, riverLut, flashCol } = S;
  const lmin = log(AC), lspan = log(AMAX) - lmin;
  for (let k = 0; k < rn; k++) {
    const i = rlist[k];
    const u = cl((log(A[i]) - lmin) / lspan, 0, 1), li = ((u * 63) | 0) * 3, f = fl[i];
    const r = riverLut[li] + (flashCol[0] - riverLut[li]) * f;
    const g = riverLut[li + 1] + (flashCol[1] - riverLut[li + 1]) * f;
    const b = riverLut[li + 2] + (flashCol[2] - riverLut[li + 2]) * f;
    let o = i * 3;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
    const j = rstamp[k];
    if (j >= 0) {
      o = j * 3;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  // The ground beside a flashing river takes some of its light.
  for (let k = 0; k < rn; k++) {
    const i = rlist[k], f = fl[i] * BLOOM;
    if (f < 0.04) continue;
    for (let j = 0; j < 4; j++) {
      const n = NBR[i * 8 + j];
      if (n < 0 || S.chan[n]) continue;
      const o = n * 3;
      buf[o] += (flashCol[0] - buf[o]) * f;
      buf[o + 1] += (flashCol[1] - buf[o + 1]) * f;
      buf[o + 2] += (flashCol[2] - buf[o + 2]) * f;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o], buf[o + 1], buf[o + 2]);
    }
}
