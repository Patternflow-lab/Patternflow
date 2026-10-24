// ===== Patternflow pattern =====
// Title:   Funicular
// Family:  rail
// Idea:    Two stepped funicular cars on one cable run up and down a mountainside at dusk between a lakeside town and the engine house where the bullwheel turns, passing each other at the Abt loop halfway up.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after the two-car funicular with an Abt passing loop
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Dusk=0..1, Speed=0.2..3, Grade=0..1, Snow=0..1
//
// Knob 1: Dusk. Blue hour at 0, a peach glow behind the far peaks and rose on the snow; night at 1, stars and a crescent moon over a town with most windows lit.
// Knob 2: Speed. At 2 a run takes eight seconds and the cars wait three at the stations while the clouds drift east; at 0.2 it all runs ten times slower.
// Knob 3: Grade. How steep the line stands, about 63 degrees at 0 and 72 at 1: the stations draw together and the compartments step higher.
// Knob 4: Snow. A little on the summit rocks at the start; turning it up brings the snowline down through the forest to the roofs and sets snow falling over the whole panel.
// Buttons: K1 tap sends the cars out of the stations now, or flashes their headlamps while they run. K2 tap puts out the lamps along the line, or lights them one by one from the valley up.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, exp, atan2, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}
const ridge = (t, s) => 1 - abs(2 * vn(t, s) - 1);
// True draws only the line: track, cable, cars and stations.
const BARE = false;

// Rows of the valley end and the summit end of the track and of the quay. The bullwheel's radius.
const YA = 112, YB = 30, QY = 121, R = 5.5;
// Seconds a run and a stop take at Speed 1.
const RUN = 16, DWELL = 6;

// Each colour from blue hour, its first three numbers, to night, its last three.
const PAL = {
  s0:[12,26,82,5,11,42,1,3,12], s1:[44,70,150,14,28,80,3,8,26], s2:[134,118,180,46,52,112,8,16,40],
  s3:[240,164,124,116,76,100,20,26,52], far:[62,68,122,26,30,70,8,11,28], haze:[112,100,152,46,44,86,12,15,34],
  fsn:[240,184,198,120,112,160,40,46,76], fsd:[140,144,196,66,70,122,24,30,56], far2:[36,48,90,14,20,50,4,7,18],
  trL:[44,84,70,22,42,46,9,18,22], trD:[20,44,48,10,22,30,5,10,16], und:[9,22,26,5,11,16,2,5,9],
  rock:[100,96,126,48,50,80,17,19,30], rockD:[46,46,76,22,24,46,7,9,17], snow:[236,206,222,140,140,180,54,60,88],
  snowD:[146,156,206,76,84,136,28,34,60], bed:[56,52,54,30,28,32,12,12,15], rail:[190,188,200,120,120,140,70,70,84],
  slp:[38,32,32,20,17,19,8,7,9], roof:[70,62,66,34,30,36,14,12,16], conc:[120,116,120,60,58,64,26,26,30],
  stone:[130,122,116,64,60,62,26,24,28], lake:[26,38,92,10,14,40,2,4,12], cLo:[236,150,140,104,72,104,18,20,34],
  cHi:[98,90,146,34,36,74,8,10,22],
};
// Town walls: cream, ochre, pink, blue-grey, white.
const HOUSE = [[178, 152, 112], [192, 132, 62], [184, 106, 112], [84, 132, 140], [184, 180, 188]];
const WARM = [255, 196, 108], LAMP = [255, 226, 168], STEEL = [224, 220, 206];
const LIV = [[206, 34, 30], [34, 84, 196]], DK = [40, 40, 44], TILE = [128, 60, 46];
const lerp3 = (p, k, i = k < 0.5 ? 0 : 3, f = k * 2 - i / 3) => [0, 1, 2].map((c) => mix(p[i + c], p[i + 3 + c], f));

// The line for a grade: its ends, its direction u, the normal n to its lower
// right, the passing loop, and the shape of a car column by column.
function geom(g) {
  const xA = mix(8, 17, g), xB = mix(50, 43, g), L = hypot(xB - xA, YB - YA);
  const ux = (xB - xA) / L, uy = (YB - YA) / L, tp = -uy / ux, hb = round(3 * tp + 3.2);
  const Lca = 10 / ux, aLo = Lca / 2 + 1.5, aHi = L - Lca / 2 - 1.5;
  const G = { xA, L, ux, uy, nx: -uy, ny: ux, tp, hb, Lca, aLo, aHi, aM: (aLo + aHi) / 2, hs: Lca / 2 + 2, lt: 13, WL: 4.6 };
  // Columns 0..9: three compartments of three and the end wall, each floor level, so the car climbs in steps.
  for (const k of ["ct", "cf", "cr"]) G[k] = new Int8Array(10);
  let vr = 0;
  for (let c = 0; c < 10; c++) {
    const fl = floor(-((c > 8 ? 2 : floor(c / 3)) * 3 - 2) * tp) - 2;
    G.cf[c] = fl; G.ct[c] = fl - hb + 1; G.cr[c] = round(-(c - 4.5) * tp - 0.5);
    vr = max(vr, -(c - 4.5) * tp - G.ct[c]);
  }
  G.VR = vr + 2;
  // The bullwheel: the cable runs off the top of the track onto its left side.
  G.wx = xB + 3 * ux + R * G.nx; G.wy = YB + 3 * uy + R * G.ny; G.px = xB - 5;
  return G;
}
const bump = (G, a) => sm(G.aM - G.hs - G.lt, G.aM - G.hs, a) * (1 - sm(G.aM + G.hs, G.aM + G.hs + G.lt, a));

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const S = (params.s = {
    f: F(N * 3), bg: F(N * 3), A: F(N), D: F(N), SK: new Uint8Array(N), tk: new Int32Array(N), ntk: 0,
    win: new Int32Array(900), wth: F(900), nw: 0, lamp: [], k1: -1, g: -1, k4: -1, G: null, c: {},
    run: 0, tm: 1, dir: 1, pa: 0, wh: 0, flash: 0, lampsOn: 1, lampF: 300, t: 0, stars: [], fl: [], cx: 40, cl: F(128 * 64), houses: [],
  });
  // Clouds: streaks of soft noise in a strip that wraps every 128 columns.
  const n = (X, y) => 0.6 * vn(X * 0.045, y * 0.22) + 0.4 * vn(X * 0.12 + 5, y * 0.45);
  for (let i = 0; i < 8192; i++) S.cl[i] = mix(n(i & 127, i >> 7), n((i & 127) + 128, i >> 7), (i & 127) / 128);
  for (let i = 0; i < 110; i++) S.stars.push({ x: floor(rnd() * W), y: floor(rnd() * 100), b: 0.25 + 0.75 * rnd() ** 2, ph: rnd() * TAU });
  for (let i = 0; i < 260; i++) S.fl.push({ x: rnd() * W, y: rnd() * H, v: 0.6 + 0.8 * rnd(), ph: rnd() * TAU, z: rnd() });
  // The town: a row of taller houses up the bank with a church, and a lower row on the quay.
  for (const [b, i0, h0, hr] of [[QY - 6, 0, 7, 7], [QY - 1, 50, 4, 4]])
    for (let x = i0 ? -2 : 0, i = i0; x < W; i++) {
      const ch = !i0 && x > 38 && !S.ch, w = ch ? 5 : 4 + floor(hash(i, 1) * 4);
      if (ch) S.ch = 1;
      S.houses.push({ x, b, w, h: ch ? 16 : h0 + floor(hash(i, 2) * hr), c: floor(hash(i, 3) * 5), ch, gab: hash(i, 4) < 0.75 });
      x += w + (i0 ? 1 + floor(hash(i, 5) * 3) : hash(i, 5) < 0.2 ? 1 : 0);
    }
}

function build(S, k1, g, k4) {
  S.k1 = k1; S.g = g; S.k4 = k4; S.nw = 0; S.lamp.length = 0;
  const G = (S.G = geom(g)), C = S.c, bg = S.bg, o = [0, 0, 0];
  for (const key in PAL) C[key] = lerp3(PAL[key], k1);
  const amb = mix(1, 0.3, k1), snl = 30 + 112 * k4 ** 0.75;
  let ntk = 0;
  const setc = (c, m = 1) => ((o[0] = c[0] * m), (o[1] = c[1] * m), (o[2] = c[2] * m));
  const blend = (c, t) => ((o[0] = mix(o[0], c[0], t)), (o[1] = mix(o[1], c[1], t)), (o[2] = mix(o[2], c[2], t)));
  const ad = (px, py) => [(px - G.xA) * G.ux + (py - YA) * G.uy, (px - G.xA) * G.nx + (py - YA) * G.ny];
  const dg = (a) => 7 + 6 * bump(G, a) + 1.6 * vn(a * 0.2, 4);
  const inBed = (a, d, of = G.WL * bump(G, a)) => a >= -1.5 && a <= G.L + 1 && (abs(d + of) < 2.7 || abs(d - of) < 2.7);
  const f1 = (x) => 46 + 22 * (1 - ridge(x * 0.07 + 3.3, 1.7)) + 3 * vn(x * 0.4, 5);
  const f2 = (x) => 74 + 12 * (1 - ridge(x * 0.1 + 11, 2.3)) + 2 * vn(x * 0.5, 8);
  const pk = (x) => 2 + (x < G.px ? (G.px - x) * 2.6 : (x - G.px) * 1.7) + 4 * (vn(x * 0.3, 9) - 0.5);
  const tl = (x) => 50 + 8 * (vn(x * 0.12, 2) - 0.5);
  const face = (a, d) => d > -dg(a);
  // Rock with strata and snow lying in the gullies.
  const rock = (px, py, side) => {
    const fa = vn(px * 0.16 + 3, py * 0.07), lit = side > 0 ? fa > 0.32 : fa > 0.72;
    setc(lit ? C.rock : C.rockD, 0.82 + 0.3 * vn(px * 0.4, py * 0.2));
    const st = ((py * 0.8 - px * 0.5 + 4 * vn(px * 0.08, py * 0.08)) / 5) % 1;
    if (st < 0.16) blend(C.rockD, 0.7);
    const sn = sm(0.56, 0.66, 0.6 * vn(px * 0.3 + 5, py * 0.12) + 0.4 * vn(px * 0.8, py * 0.35) + (snl - py) / 160 + k4 * 0.5 - (st < 0.3 ? 0.1 : 0));
    if (sn > 0) blend(lit ? C.snow : C.snowD, sn);
  };
  // Firs on a jittered grid of cells three wide and four tall, the nearest in front.
  const tree = (px, py) => {
    const cx = floor(px / 3), cy = floor(py / 4);
    let best = -1, tx = 0, ty = 0, th = 0;
    for (let j = 0; j < 3; j++)
      for (let i = -1; i <= 1; i++) {
        const X = cx + i, Y = cy - j, ax = (X + 0.2 + 0.6 * hash(X, Y)) * 3, ay = (Y + hash(Y, X + 7)) * 4, hh = 4 + 3 * hash(X + 3, Y);
        if (py < ay || py > ay + hh || abs(px - ax) > (py - ay) * 0.45 + 0.35 || ay + hh <= best) continue;
        const [ra, rd] = ad(ax, ay + hh);
        if (!face(ra, rd) || inBed(ra, rd) || ay + hh < tl(ax) || ay + hh > QY - 6) continue;
        (best = ay + hh), (tx = ax), (ty = ay), (th = hh);
      }
    if (best < 0) return 0;
    setc(px < tx ? C.trL : C.trD, 0.85 + 0.3 * hash(floor(tx), floor(ty)));
    if (ty + th < snl + 6 * (hash(floor(tx), 3) - 0.5) && py - ty < th * 0.55) blend(C.snow, 0.75);
    return 1;
  };

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = y * W + x, px = x + 0.5, py = y + 0.5, [a, d] = ad(px, py);
      S.A[k] = a; S.D[k] = d; S.SK[k] = 0;
      // Sky: blue overhead going lavender lower down, with a peach glow behind the far peaks in the west.
      const t = py / 104, s = t < 0.4 ? 0 : t < 0.76 ? 1 : 2, ft = s ? (t - [0, 0.4, 0.76][s]) / (s > 1 ? 0.24 : 0.36) : t / 0.4;
      const sa = [C.s0, C.s1, C.s2][s], sb = [C.s1, C.s2, C.s3][s];
      for (let c = 0; c < 3; c++) o[c] = mix(sa[c], sb[c], sm(0, 1, ft));
      blend(C.s3, 0.35 * exp(-max(0, 100 - py) / 18) * (1 - px / 90));
      let sky = 1;
      if (py >= f1(px)) {
        // The far range in haze, snow on the peaks that stand highest.
        const top = f1(px), lit = f1(px + 1) >= f1(px - 1);
        setc(C.far); blend(C.haze, cl((py - top) / 28, 0, 0.8));
        const sd = sm(0.5, 0.62, 0.55 * vn(px * 0.7, py * 0.3) + 0.45 * vn(px * 1.6, py * 0.8) + (54 - py) / 14 + k4 * 0.5);
        if (sd > 0) blend(lit ? C.fsn : C.fsd, sd);
        sky = 0;
      }
      if (py >= f2(px)) {
        setc(C.far2, 0.85 + 0.25 * vn(px * 0.6, py * 0.6));
        blend(C.haze, cl((py - f2(px)) / 30, 0, 0.35));
        if (k4 > 0.3 && py < f2(px) + 3 * k4 + 1) blend(C.snowD, 0.6 * k4);
        sky = 0;
      }
      if (py >= pk(px)) (sky = 0), rock(px, py, px < G.px ? 1 : -1);
      if (face(a, d) && py < QY) {
        sky = 0;
        if (py < tl(px)) rock(px, py, d < 2 || vn(px * 0.2, py * 0.2) > 0.5 ? 1 : -1);
        else if (!tree(px, py)) setc(C.und, 0.8 + 0.4 * hash(x, y)), blend(C.snowD, 0.75 * sm(4, -4, py - snl + 6 * vn(px * 0.3, py * 0.1)));
      } else if (py < QY && py > 30 && d > -dg(a) - 8 && tree(px, py)) sky = 0;
      S.SK[k] = sky;
      if (BARE) setc(o, 0);
      // The track bed: gravel, sleepers, two rails a track, rollers between them.
      if (inBed(a, d)) {
        const of = G.WL * bump(G, a), best = min(abs(d - of), abs(d + of));
        setc(C.bed, 0.94 + 0.12 * hash(x * 7, y * 3));
        if (best < 2.2 && (a / 2.4) % 1 < 0.4) blend(C.slp, 0.4);
        if (best < 0.6 && (a / 6) % 1 < 0.2) setc(C.rail, 0.35);
        if (abs(abs(d - of) - 1.8) < 0.56 || abs(abs(d + of) - 1.8) < 0.56) setc(C.rail, 0.9 + 0.1 * hash(x, y));
        S.tk[ntk++] = k;
      }
      bg[k * 3] = o[0]; bg[k * 3 + 1] = o[1]; bg[k * 3 + 2] = o[2];
    }
  S.ntk = ntk;
  const put = (x, y, c, t = 1, m = 1) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    for (let i = 0, k = (y * W + x) * 3; i < 3; i++) bg[k + i] = mix(bg[k + i], c[i] * m, t);
  };
  const glow = (x, y, s) => {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) put(x + i, y + j, LAMP, s * exp(-(i * i + j * j) / 1.44));
    put(x, y, LAMP);
  };
  // A crescent moon once it is dark.
  const mo = sm(0.45, 0.85, k1);
  if (mo > 0 && !BARE)
    for (let y = 6; y < 22; y++)
      for (let x = 6; x < 22; x++) {
        const r1 = hypot(x + 0.5 - 14, y + 0.5 - 13), m = cl(4.3 - r1, 0, 1) * cl(hypot(x + 0.5 - 16.2, y + 0.5 - 11.8) - 3.6, 0, 1);
        if (!S.SK[y * W + x]) continue;
        if (m > 0) put(x, y, [236, 230, 196], m * mo);
        else if (r1 < 10) put(x, y, [70, 76, 110], 0.5 * mo * exp(-(r1 - 4) / 2.5));
      }

  // The town, the back row stopping short of the valley station.
  const town = (front) => {
    if (BARE) return;
    for (const h of S.houses) {
      if ((h.b === QY - 1) !== front || (h.x + h.w > G.xA - 9 && h.x < (front ? G.xA - 1 : G.xA + (G.Lca + 6) * G.ux))) continue;
      const base = h.b, top = base - h.h, m = amb * (front ? 0.88 : 0.7), sn = snl > base - 3;
      for (let x = h.x; x < min(W, h.x + h.w); x++) {
        for (let y = top; y <= base; y++) put(x, y, HOUSE[h.c], 1, m * (x === h.x + h.w - 1 ? 0.72 : 1));
        const rr = h.gab ? h.w / 2 + 0.5 - abs(x + 0.5 - (h.x + h.w / 2)) : 1;
        for (let y = floor(top - rr); y < top; y++) put(x, y, sn ? C.snow : h.c & 1 ? TILE : [64, 68, 88], 1, sn ? 1 : m);
      }
      if (h.ch) {
        for (let y = top - 9; y < top - 2; y++) for (let i = -1; i < 2; i++) (!i || y > top - 6) && put(h.x + 2 + i, y, C.roof, 1, 1.4);
        put(h.x + 2, top + 2, [250, 236, 190], 1, 0.9);
      }
      for (let wy = base - 2; wy > top + 1 + (h.ch ? 3 : 0); wy -= 3)
        for (let wx = h.x + 1; wx < h.x + h.w - 1; wx += 2) if (S.nw < 900) (S.win[S.nw] = wy * W + wx), (S.wth[S.nw++] = hash(wx, wy)), put(wx, wy, [30, 24, 30], 1, amb + 0.3);
    }
  };
  town(false);
  // Stations: a tiled roof on pillars over the platform where a car stands, lit underneath.
  const yT = (px) => YA - (px - G.xA) * G.tp;
  const shed = (a0, a1) => {
    const x0 = floor(G.xA + a0 * G.ux), x1 = ceil(G.xA + a1 * G.ux);
    for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
      const px = x + 0.5, ac = (px - G.xA) / G.ux, ty = yT(px), end = x === x0 || x === x1 || x === round((x0 + x1) / 2);
      if (ac < a0 || ac > a1) continue;
      for (let y = floor(ty - G.VR - 4); y <= ceil(ty + 6); y++) {
        const v = ty - (y + 0.5);
        if (v > G.VR && v <= G.VR + 3.4) v > G.VR + 2.3 ? put(x, y, y < snl ? C.snow : [150, 76, 58], 1, y < snl ? 1.1 : amb) : put(x, y, [118, 54, 42], 1, amb * (v > G.VR + 1.2 ? 1 : 0.55));
        else if (v > 0.6 && v <= G.VR) end ? put(x, y, [46, 42, 46]) : put(x, y, LAMP, 0.06 + 0.3 * exp(-(G.VR - v) / 4));
        else if (v <= 0.6 && v > -5.5 && !inBed(...ad(px, y + 0.5))) put(x, y, y % 3 ? C.conc : C.roof), put(x, y, LAMP, 0.18 + 0.12 * k1);
      }
    }
    for (const f of [0.3, 0.72]) {
      const px = G.xA + mix(a0, a1, f) * G.ux;
      glow(floor(px), floor(yT(px) - G.VR + 1), 0.3 + 0.3 * k1);
    }
  };
  shed(-2.5, G.Lca + 4.5);
  shed(G.L - G.Lca - 4.5, G.L + 1.5);
  // The valley station hall left of the track, an arched window over a lit door on the quay.
  const vx0 = max(0, floor(G.xA - 9)), vx1 = floor(G.xA) - 1, vy0 = YA - 12, vc = (vx1 + 1 + max(vx0, G.xA - 9)) / 2;
  for (let x = vx0; x <= vx1; x++) {
    for (let y = vy0; y < QY; y++) put(x, y, HOUSE[0], 1, amb * (x === vx1 ? 0.7 : 0.95));
    for (let y = floor(vy0 - 5.5 + abs(x + 0.5 - vc) * 1.2); y < vy0; y++) put(x, y, y < snl ? C.snow : TILE, 1, y < snl ? 1 : amb);
  }
  for (let y = vy0 + 2; y < QY; y++)
    for (let x = floor(vc - 1.5); x < vc + 1.5; x++)
      if (y < vy0 + 9 ? y > vy0 + 2 || abs(x + 0.5 - vc) < 1 : y >= QY - 4 && abs(x + 0.5 - vc) < 1) put(x, y, WARM, 0.92, mix(0.85, 1, k1));
  town(true);

  // The engine house on the summit, with the bullwheel behind its lit round window.
  const ex0 = floor(G.wx - 8), ey0 = floor(G.wy - 8);
  for (let y = ey0 - 6; y <= G.wy + 8; y++)
    for (let x = ex0; x < W; x++) {
      const rh = y - (ey0 - 6 + abs(x + 0.5 - G.wx) * 0.62), r = hypot(x + 0.5 - G.wx, y + 0.5 - G.wy);
      if (r < R + 1.2) put(x, y, [255, 200, 120], 1, mix(0.9, 1, k1) * (1 - 0.15 * r / R));
      else if (y < ey0) rh >= 0 && put(x, y, k4 > 0.05 && rh < 1.2 ? C.snow : C.roof, 1, 1.2);
      else put(x, y, C.stone, 1, (0.85 + 0.15 * (((y >> 1) + (x >> 2)) & 1)) * (x === ex0 ? 0.6 : 1));
    }
  // Lamps on posts beside the line, every nine steps.
  for (let a = 7; a < G.L - 6; a += 9) {
    const of = G.WL * bump(G, a) + 5.6, lx = floor(G.xA + a * G.ux + of * G.nx), ly = floor(YA + a * G.uy + of * G.ny);
    put(lx, ly + 1, DK), put(lx, ly + 2, DK), S.lamp.push(lx, ly, a);
  }
  if (!BARE)
    for (let x = 0; x < W; x++) {
      put(x, QY, C.stone, 1, 0.8);
      if (x % 8 === 4) put(x, QY - 1, DK), put(x, QY - 2, DK), glow(x, QY - 3, 0.12 + 0.25 * k1);
    }
}

// Along a run the cars speed up for the first seventh and slow down for the last.
function prof(t) {
  const ta = 0.14, v = 1 / (1 - ta);
  return t < ta ? (v * t * t) / (2 * ta) : t < 1 - ta ? v * (t - ta / 2) : 1 - (v * (1 - t) * (1 - t)) / (2 * ta);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues, h = min(dt, 0.1), sp = cl(kv[1], 0.2, 3) / 2, bp = input.btnPressed;
  const k1 = cl(kv[0], 0, 1), g = cl(kv[2], 0, 1), k4 = cl(kv[3], 0, 1);
  if (abs(k1 - S.k1) > 0.003 || abs(g - S.g) > 0.003 || abs(k4 - S.k4) > 0.003) build(S, k1, g, k4);
  if (bp[0]) S.run ? (S.flash = 1) : (S.tm = min(S.tm, 0.8));
  if (bp[1]) (S.lampsOn = 1 - S.lampsOn), (S.lampF = -10);
  S.lampF += h * 40;
  S.cx += h * sp * 3.6;
  S.flash = max(0, S.flash - h);
  S.t += h * sp;
  const was = S.pa;
  if (!S.run) {
    S.tm -= h * sp * 2;
    if (S.tm <= 0) (S.run = 1), (S.tm = 0);
  } else {
    S.tm = min(1, S.tm + (h * sp * 2) / RUN);
    S.pa = S.dir > 0 ? prof(S.tm) : 1 - prof(S.tm);
    if (S.tm >= 1) (S.run = 0), (S.tm = DWELL), (S.dir = -S.dir);
  }
  S.wh += ((S.pa - was) * (S.G.aHi - S.G.aLo)) / R;
  for (const q of S.fl) {
    q.y += h * (6 + 12 * q.z) * q.v;
    q.x = (q.x + h * (2.5 * sin(S.t * 0.7 + q.ph) - 1.5) + W) % W;
    if (q.y > H) (q.y -= H + 2), (q.x = rnd() * W);
  }
}

function drawCar(S, f, ac, side, liv, up, k1) {
  const G = S.G, o = side * G.WL * bump(G, ac), Px = G.xA + ac * G.ux + o * G.nx, Py = YA + ac * G.uy + o * G.ny;
  const x0 = round(Px - 5), ay = round(Py - (x0 + 5 - Px) * G.tp), hb = G.hb, lm = mix(1, 0.5, k1), fl = S.flash > 0 && (S.flash * 6) % 1 < 0.5;
  for (let c = 0; c < 10; c++) {
    const x = x0 + c, glass = c % 3 && c < 9, b = c > 8 ? 2 : floor(c / 3);
    if (x < 0 || x >= W) continue;
    for (let r = G.ct[c]; r <= G.cr[c]; r++) {
      const y = ay + r, rr = r - G.ct[c], q = (y * W + x) * 3;
      if (y < 0 || y >= H) continue;
      let [cr, cg, cb] = liv, m = lm;
      if (r === G.cr[c]) (cr = cg = cb = c === 1 || c === 8 ? 20 : 68);
      else if (r > G.cf[c]) m *= 0.62;
      else if (rr === 0) (cr = 210), (cg = 206), (cb = 196);
      else if (rr === hb - 3) {
        (cr = 228), (cg = 214), (cb = 180);
        if (c === (up ? 9 : 0)) (cr = 255), (cg = 250), (cb = fl ? 120 : 220), (m = 1);
        if (c === (up ? 0 : 9)) (cr = 255), (cg = 30), (cb = 20), (m = 1);
      } else if (glass && rr >= 2 && rr <= hb - 4) {
        // Lit windows, a passenger's head and shoulders in some.
        const head = rr >= hb - 5 && c % 3 === 1 + (hash(b, liv[2]) < 0.5) && hash(b * 3, liv[2]) < 0.7;
        (cr = head ? 60 : 255), (cg = head ? 40 : 214), (cb = head ? 36 : 150), (m = 1);
      }
      f[q] = cr * m; f[q + 1] = cg * m; f[q + 2] = cb * m;
    }
  }
  // The headlamp's beam on the track ahead.
  const dr = up ? 1 : -1, ae = ac + (dr * G.Lca) / 2, bs = mix(0.16, 0.36, k1) * (fl ? 2.5 : 1);
  for (let i = 0; i < S.ntk; i++) {
    const k = S.tk[i], s = (S.A[k] - ae) * dr, w = abs(S.D[k] - side * G.WL * bump(G, S.A[k])) - 0.8 - s * 0.08, e = bs * (1 - s / 15) ** 2 * cl(1 - w, 0, 1);
    if (s >= 0 && s < 15) (f[k * 3] += 255 * e), (f[k * 3 + 1] += 236 * e), (f[k * 3 + 2] += 190 * e);
  }
}

export function draw(display, params, time) {
  const S = params.s;
  if (!S.G) build(S, 0, 0, 0.06);
  const G = S.G, f = S.f, k1 = S.k1, k4 = S.k4, t = S.t, C = S.c;
  f.set(S.bg);
  if (!BARE) {
    // Stars come out as it gets dark; the evening star is there from the start.
    const sv = sm(0.1, 0.7, k1);
    for (const s of S.stars) {
      const k = s.y * W + s.x, e = sv * s.b * (0.7 + 0.3 * sin(time * (2 + s.ph / 3) + s.ph)) * (1 - s.y / 130);
      if (S.SK[k]) (f[k * 3] += 220 * e), (f[k * 3 + 1] += 224 * e), (f[k * 3 + 2] += 240 * e);
    }
    // Two bands of cloud drifting east, lit underneath while the glow lasts.
    const ox = floor(S.cx), fx = S.cx - ox;
    for (let y = 2; y < 62; y++) {
      const band = exp(-(((y - 12) / 7) ** 2)) + 0.9 * exp(-(((y - 38) / 8) ** 2)), i0 = y * 128;
      for (let x = 0; x < W; x++) {
        if (!S.SK[y * W + x] || band < 0.05) continue;
        const d0 = mix(S.cl[i0 + ((x - ox) & 127)], S.cl[i0 + ((x - ox - 1) & 127)], fx), d1 = S.cl[min(63, y + 2) * 128 + ((x - ox) & 127)];
        const e = sm(0.44, 0.68, d0 * 0.8 + band * 0.44 - 0.1) * 0.9, lit = cl(0.45 + (d0 - d1) * 3 + (y - 30) / 60, 0, 1), q = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) f[q + c] = mix(f[q + c], mix(C.cHi[c], C.cLo[c], lit), e);
      }
    }
    const vk = (52 * W + 11) * 3;
    if (S.SK[vk / 3]) (f[vk] += 255), (f[vk + 1] += 246), (f[vk + 2] += 220);
    // Windows in town: more lit as night comes, now and then one going on or off.
    const pl = mix(0.42, 0.86, k1);
    for (let i = 0; i < S.nw; i++) {
      const th = S.wth[i], k = S.win[i] * 3, m = 0.8 + 0.2 * hash(i, 9);
      if (th < pl + 0.05 * sin(t * 0.4 + th * 60)) (f[k] = WARM[0] * m), (f[k + 1] = WARM[1] * m), (f[k + 2] = WARM[2] * m);
    }
  }
  // Lamps along the line.
  for (let i = 0; i < S.lamp.length; i += 3) {
    const [x, y, a] = S.lamp.slice(i, i + 3), e = mix(0.55, 1, k1) * (S.lampsOn ? cl((S.lampF - a) / 4, 0, 1) : 1 - cl((S.lampF - G.L + a) / 4, 0, 1));
    for (let j = -2; j <= 2; j++)
      for (let ii = -2, q = ((y + j) * W + x - 2) * 3; ii <= 2; ii++, q += 3) {
        const g = j || ii ? e * 0.35 * mix(0.3, 1, k1) * exp(-(ii * ii + j * j) / 2) : e;
        if (x + ii >= 0 && x + ii < W) for (let c = 0; c < 3; c++) f[q + c] += LAMP[c] * g;
      }
  }
  // The cable: a strand from each car up to the bullwheel, its lay sliding with it.
  const aA = mix(G.aLo, G.aHi, S.pa), aB = G.aLo + G.aHi - aA, lm = mix(1, 0.55, k1);
  for (let i = 0; i < S.ntk; i++) {
    const k = S.tk[i], a = S.A[k], d = S.D[k], of = G.WL * bump(G, a);
    for (let s = -1; s <= 1; s += 2) {
      const ac = s < 0 ? aA : aB;
      if (a < ac + G.Lca / 2 - 0.5 || a > G.L + 2 || abs(d - s * of - s * 0.25) >= 0.55) continue;
      const tx = (0.5 + 0.5 * cos((TAU * (a - ac)) / 3)) ** 2;
      for (let c = 0; c < 3; c++) f[k * 3 + c] = mix([78, 72, 70][c], STEEL[c], tx) * lm;
      break;
    }
  }
  // The cars: red on the upper track of the loop, blue on the lower.
  const upA = S.run ? S.dir > 0 : S.dir < 0;
  drawCar(S, f, aA, -1, LIV[0], upA, k1);
  drawCar(S, f, aB, 1, LIV[1], !upA, k1);
  // The bullwheel turning behind the round window, six spokes on a hub.
  for (let y = floor(G.wy - R - 1); y <= G.wy + R + 1; y++)
    for (let x = floor(G.wx - R - 1); x <= min(W - 1, G.wx + R + 1); x++) {
      const dx = x + 0.5 - G.wx, dy = y + 0.5 - G.wy, r = hypot(dx, dy), an = atan2(dy, dx) - S.wh;
      const m = ((an % (PI / 3)) + PI / 3) % (PI / 3), sd = r * sin(min(m, PI / 3 - m));
      if (r <= R + 0.6 && (abs(r - R + 0.7) < 0.75 || (r < R - 1 && sd < 0.5) || r < 1.4)) f.set([34, 28, 30], (y * W + x) * 3);
    }
  // The lake: the quay and the town upside down, rippling.
  if (!BARE)
    for (let y = QY + 1; y < H; y++) {
      const dy = y - QY, sh = round(0.8 * sin(t * 0.9 + y * 1.3)), m = (0.95 - dy * 0.08) / 255;
      for (let x = 0; x < W; x++) for (let c = 0, q = (y * W + x) * 3, p = ((QY - dy) * W + cl(x + sh, 0, W - 1)) * 3; c < 3; c++) f[q + c] = C.lake[c] * (1 + (y & 1) * 0.2) + f[p + c] ** 2 * m;
    }
  // Falling snow.
  const nf = floor(cl((k4 - 0.1) / 0.9, 0, 1) * 260), sc = mix(235, 120, k1);
  for (let i = 0; i < nf; i++) {
    const q0 = S.fl[i], q = (floor(q0.y) * W + floor(q0.x)) * 3, e = 0.45 + 0.55 * q0.z;
    if (q0.y >= 0 && q0.y < H) (f[q] = mix(f[q], sc, e)), (f[q + 1] = mix(f[q + 1], sc, e)), (f[q + 2] = mix(f[q + 2], sc * 1.06, e));
  }
  for (let k = 0, j = 0; k < N; k++, j += 3) display.setPixel(k & 63, k >> 6, cl(f[j], 0, 255) | 0, cl(f[j + 1], 0, 255) | 0, cl(f[j + 2], 0, 255) | 0);
}
