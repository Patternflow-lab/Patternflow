// ===== Patternflow pattern =====
// Title:   Lunation
// Family:  celestial
// Idea:    One synodic month sped up through a long lens: a Moon as wide as the panel grows from a crescent in earthshine to full, the terminator uncovering maria and craters as the sky over a far ridge brightens with it.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: lunar phase time-lapses, one lunation of 29.53 days photographed night after night through a telephoto lens
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Latitude=-90..90, Days=0.5..4, Zoom=0..1, Exposure=-2..2
//
// Knob 1: Latitude. Where the camera stands, which turns the Moon's face against the horizon: at the equator, where it opens, the crescent lies on its back like a boat; at the North Pole north is up and it is lit from the right; at the South Pole the face hangs upside down.
// Knob 2: Days. Days of the month a second: at 2 the crescent of day 2.6 is full six seconds later and a lunation takes 15 seconds; 0.5 to 4.
// Knob 3: Zoom. The lens: at 0 the disc is 60 LEDs across, the panel's width; turned up it magnifies 2.5 times until maria, craters and the terminator fill the frame.
// Knob 4: Exposure. Stops either side of a full-Moon exposure: two down, earthshine and faint stars go black; two up, the dark side shows its maria and the lit Moon burns out white.
// Buttons: K1 tap books a total lunar eclipse for the next full Moon: the month holds still while the Earth's shadow crosses, its umbra edged in turquoise, the Moon copper red, the stars back.

const W = 64;
const H = 128;
const N = W * H;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
// The Moon's centre and radius at the widest field: 58 km a LED.
const CX = 32;
const CY = 56;
const R0 = 30;
// The face: a 128x128 orthographic map of the near side, north up, 27 km a
// texel, about a texel a LED at the closest zoom.
const TEX = 128;
const SYNODIC = 29.530589;
// The Lab opens 1.43 days before new moon, so at 2 days a second the window
// the study measures, 2 to 8 s, is day 2.57 to 14.57 and ends 0.1 s short of
// full, while every LED is still only brightening.
const DAY0 = -1.43;
// Sun elevation over which ground past the terminator goes from black to
// fully lit: 12.6 degrees, six LEDs at the disc's centre.
const W0 = 0.22;
// Earthshine at a seventh of full sunlight, as an exposure made for it shows
// it, blue from the Earth's oceans; then sunlight on highland and on mare.
const ES = 0.15;
const ES_COL = [0.66, 0.78, 1.0];
const HI_COL = [1.0, 0.965, 0.885];
const MA_COL = [0.93, 0.95, 1.0];
// Samples round the limb that light the aureole, and the Gaussian, 3 samples
// wide, that spreads each over its neighbours.
const LIMB = 64;
const SPREAD = [];
for (let k = -6; k <= 6; k++) SPREAD.push(Math.exp(-(k * k) / 18));
const SPREAD_SUM = SPREAD.reduce((a, b) => a + b, 0);
// Eclipse: umbra and penumbra in Moon radii, the path's offset from the
// shadow's axis, the seconds it takes.
const UMBRA = 2.65;
const PENUMBRA = 4.6;
const GAMMA = -0.42;
const ECL_T = 12;

// Maria as caps on the sphere: latitude, longitude (east, toward Crisium, is
// right), angular radius in degrees, how much darker than highland.
const MARIA = [
  // Imbrium; Serenitatis, paler than its neighbours; Tranquillitatis
  [33, -16, 17, 0.4], [40, -28, 9, 0.38], [24, -3, 7.5, 0.36], [28, 17.5, 10.5, 0.31],
  [8, 26, 10, 0.46], [12, 35, 7, 0.46], [1, 38, 7, 0.45], [-1, 44, 5, 0.42],
  // Crisium, Fecunditatis, Nectaris, Nubium, Humorum, Cognitum
  [17, 59.1, 8.5, 0.47], [-4, 51, 8.5, 0.39], [-13, 49, 7, 0.37], [-15.2, 35.5, 5.5, 0.38],
  [-20, -16, 10, 0.35], [-15, -8, 5, 0.3], [-24.4, -38.6, 6.6, 0.42], [-10, -22, 7, 0.35],
  // Insularum round Copernicus, Vaporum, Sinus Aestuum, Sinus Medii
  [8, -28, 9, 0.38], [14, 4, 5, 0.35], [11, -8, 6, 0.32], [2, 2, 4.5, 0.24],
  // Oceanus Procellarum, north to south
  [42, -50, 10, 0.38], [30, -55, 13, 0.42], [17, -58, 13, 0.44], [24, -42, 8, 0.41],
  [12, -45, 10, 0.41], [4, -56, 12, 0.42], [-5, -50, 10, 0.38], [-12, -42, 7, 0.34],
  // Frigoris, a ragged band across the north
  [58, -45, 4.5, 0.3], [55, -35, 5.2, 0.33], [57.5, -24, 4, 0.32], [55.5, -13, 4.4, 0.33],
  [57, -2, 3.8, 0.3], [55, 9, 4.6, 0.32], [56.5, 20, 4, 0.3], [54, 31, 4.4, 0.29], [52, 40, 3.2, 0.26],
  // Lacus Somniorum; Smythii, Marginis and Australe on the east limb
  [37, 31, 5, 0.24], [-2, 86, 4.5, 0.34], [13, 86, 3.8, 0.3], [-40, 86, 6, 0.24],
];
// Mountain rings of the big basins: centre, radius in degrees, height. Where
// a ring stands on highland it is the Apennines, the Caucasus, the Alps.
const RINGS = [[32.8, -15.6, 19.5, 0.022], [28, 17.5, 11.8, 0.014], [17, 59.1, 9.6, 0.012], [-15.2, 35.5, 8, 0.01], [-24.4, -38.6, 7.6, 0.008]];
// Named craters: latitude, longitude, km across, kind (0 plain, 1 young and
// rayed, 2 dark floor, 3 flooded flat floor).
const CRATERS = [
  // Tycho, Copernicus, Kepler, Aristarchus, Proclus, Menelaus
  [-43.3, -11.2, 85, 1], [9.6, -20.1, 93, 1], [8.1, -38, 32, 1], [23.7, -47.4, 40, 1], [16.2, 46.8, 28, 1], [16.3, 16, 27, 1],
  // Plato, Grimaldi, Endymion, Clavius, Ptolemaeus, Alphonsus, Arzachel, Theophilus
  [51.6, -9.4, 101, 2], [-5.2, -68.6, 173, 2], [53.9, 57, 123, 2], [-58.4, -14.4, 231, 0], [-9.3, -1.9, 153, 3], [-13.4, -2.8, 119, 0], [-18.2, -1.9, 97, 0], [-11.4, 26.4, 100, 0],
  // Langrenus, Petavius, Vendelinus, Archimedes, Eratosthenes, Maginus, Longomontanus, Schickard
  [-8.9, 61.1, 132, 0], [-25.1, 60.4, 177, 0], [-16.3, 61.6, 147, 3], [29.7, -4, 83, 3], [14.5, -11.3, 58, 0], [-50, -6.2, 194, 0], [-49.6, -21.7, 145, 0], [-44.3, -54.6, 206, 2],
  // Gassendi, Posidonius, Atlas, Albategnius, Hipparchus, Stofler, Janssen, Deslandres, Aristoteles, Bailly
  [-17.6, -40.1, 110, 3], [31.8, 29.9, 95, 3], [46.7, 44.4, 87, 0], [-11.2, 4.1, 129, 0], [-5.1, 5.2, 138, 3], [-41.1, 6, 126, 0], [-44.9, 41.5, 199, 0], [-32.5, -5.2, 234, 3], [50.2, 17.4, 87, 0], [-66.5, -69.1, 303, 0],
];
// Ray systems of the first six: rays, e-folding length in radians, strength.
const RAYS = [[18, 0.34, 0.15], [12, 0.14, 0.14], [9, 0.08, 0.12], [7, 0.06, 0.14], [6, 0.09, 0.1], [5, 0.05, 0.08]];

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise on a 64x64 lattice; a seed shifts it so uses do not line up.
const LATTICE = new Float32Array(4096);
for (let i = 0; i < 4096; i++) LATTICE[i] = hash(i, 977);

function noise(x, y, s) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const ux = (x - ix) * (x - ix) * (3 - 2 * (x - ix));
  const uy = (y - iy) * (y - iy) * (3 - 2 * (y - iy));
  const i0 = (ix + s * 17) & 63;
  const i1 = (i0 + 1) & 63;
  const j0 = ((iy + s * 29) & 63) << 6;
  const j1 = (j0 + 64) & 4095;
  const a = LATTICE[j0 + i0];
  const b = LATTICE[j0 + i1];
  const c = LATTICE[j1 + i0];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + LATTICE[j1 + i1]) * ux * uy;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// A unit vector on the near side: x right (east), y north, z toward Earth.
function dir(lat, lon) {
  const cb = Math.cos(lat * DEG);
  return [cb * Math.sin(lon * DEG), Math.sin(lat * DEG), cb * Math.cos(lon * DEG)];
}

// Calls fn for each texel within angle `reach` of c.
function box(c, reach, fn) {
  const span = Math.ceil((Math.min(2, reach) * TEX) / 2) + 1;
  const ci = Math.floor(((c[0] + 1) / 2) * TEX);
  const cj = Math.floor(((1 - c[1]) / 2) * TEX);
  for (let j = Math.max(0, cj - span); j <= Math.min(TEX - 1, cj + span); j++)
    for (let i = Math.max(0, ci - span); i <= Math.min(TEX - 1, ci + span); i++) fn(j * TEX + i);
}

function angle(F, t, c) {
  return Math.acos(Math.min(1, F.px[t] * c[0] + F.py[t] * c[1] + F.pz[t] * c[2]));
}

// A texel's place on the sphere, its highland albedo and roughness, and a
// noise-pushed place to look the maria up from, so every shore wobbles 100
// to 200 km. Texels outside the disc copy the limb.
function texelInit(F, t, u, v) {
  const rr = u * u + v * v;
  const k = rr > 0.9995 ? Math.sqrt(0.9995 / rr) : 1;
  const x = (u *= k);
  const y = -(v *= k);
  const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  F.px[t] = x;
  F.py[t] = y;
  F.pz[t] = z;
  // Albedo wanders a tenth over a few hundred km, the south, sprayed by
  // Tycho, is brighter, and a texel-sized grain keeps the zoom from smoothing.
  F.alb[t] = 0.88 + 0.1 * noise(u * 5 + 3, v * 5 + 5, 1) + 0.08 * noise(u * 14, v * 14, 2) + 0.05 * v + 0.06 * noise(u * 47, v * 47, 12);
  F.hgt[t] = 0.004 * (noise(u * 40, v * 40, 3) - 0.5);
  const wx = x + 0.07 * (noise(x * 5 + 1, y * 5, 7) - 0.5) + 0.025 * (noise(x * 19, y * 19, 4) - 0.5);
  const wy = y + 0.07 * (noise(x * 5, y * 5 + 4, 10) - 0.5) + 0.025 * (noise(x * 19 + 7, y * 19, 11) - 0.5);
  const l = Math.sqrt(wx * wx + wy * wy + z * z);
  F.wx[t] = wx / l;
  F.wy[t] = wy / l;
  F.wz[t] = z / l;
}

// Lava is flat and low, and darker by the mare's depth, unevenly.
function lava(F, t, m) {
  F.mare[t] = m;
  F.alb[t] *= 1 - m * (0.8 + 0.3 * noise(F.px[t] * 9, F.py[t] * 9, 5) + 0.12 * noise(F.px[t] * 30, F.py[t] * 30, 8));
  F.hgt[t] -= 0.03 * m;
}

// A crater: bowl, rim, a central peak if big, and albedo: fresh ones bright,
// Plato's kind dark-floored.
function crater(F, la, lo, km, kind, seed) {
  const c = dir(la, lo);
  const rho = km / 2 / 1737;
  const depth = rho * (kind === 3 ? 0.06 : kind === 1 ? 0.24 : 0.16 + 0.06 * hash(seed, 1));
  const peak = km > 70 && kind !== 3 ? depth * 0.5 : 0;
  const flat = kind === 3 || km > 150 ? 6 : 2;
  const rimA = 0.04 * hash(seed, 3) - 0.01;
  box(c, rho * 1.8, (t) => {
    const r = angle(F, t, c) / rho;
    if (r > 1.8) return;
    let h = depth * 0.35 * Math.exp(-(((r - 1) / 0.22) ** 2));
    if (r < 1) h -= depth * (1 - r ** flat);
    if (peak) h += peak * Math.exp(-((r / 0.16) ** 2));
    F.hgt[t] += h;
    if (kind === 1 && r < 1.5) F.alb[t] += 0.3 * (1 - smooth(0.9, 1.5, r));
    else if (kind === 0) F.alb[t] += rimA * Math.exp(-(((r - 1) / 0.25) ** 2)) - (r < 0.8 ? 0.03 : 0);
    if (kind === 2 && r < 1) F.alb[t] *= 0.62 + 0.38 * smooth(0.75, 1, r);
  });
}

// A rayed crater's light at a texel. Rays start past the dark collar of
// fresh ejecta, broad and faint, not spokes; only the two either side of
// the texel's bearing can reach it.
function rayLight(F, t, ci, c, rho, count, len) {
  const d = angle(F, t, c);
  if (d > Math.min(Math.PI, len * 4) || d < 1.2 * rho) return 0;
  const x = F.px[t] - c[0];
  const y = F.py[t] - c[1];
  const z = F.pz[t] - c[2];
  const e = Math.hypot(c[0], c[2]);
  const th = Math.atan2(y * e - (c[1] * (x * c[0] + z * c[2])) / e, (x * c[2] - z * c[0]) / e);
  const k0 = Math.floor(((th < 0 ? th + TAU : th) / TAU) * count);
  const across = Math.sin(d) / (0.012 + 0.03 * d);
  let sum = 0;
  for (let kk = k0 - 1; kk <= k0 + 1; kk++) {
    const k = (kk + count) % count;
    const id = ci * 31 + k;
    let dt = th - ((k + 0.8 * hash(id, 21)) / count) * TAU;
    dt -= Math.round(dt / TAU) * TAU;
    const lateral = Math.abs(dt) * across;
    if (lateral < 3) sum += (0.4 + 0.8 * hash(id, 23)) * Math.exp(-lateral * lateral - d / (len * (0.45 + 1.1 * hash(id, 22))));
  }
  return Math.min(1, sum) * smooth(1.6 * rho, 4 * rho, d);
}

// The face map: albedo, how much mare, and the slope the Sun sees.
function buildFace(P) {
  const T = TEX * TEX;
  const F = {};
  for (const key of ["px", "py", "pz", "alb", "hgt", "wx", "wy", "wz", "mare", "field", "dark"]) F[key] = new Float32Array(T);
  for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) texelInit(F, j * TEX + i, ((i + 0.5) / TEX) * 2 - 1, ((j + 0.5) / TEX) * 2 - 1);
  // Maria: caps add up as a steep field, so only neighbours that touch join,
  // with a rounded neck, as Serenitatis runs into Tranquillitatis.
  for (const [la, lo, rad, dark] of MARIA) {
    const c = dir(la, lo);
    const rho = rad * DEG;
    const near = Math.cos(1.6 * rho);
    box(c, 1.6 * rho + 0.06, (t) => {
      const cd = F.wx[t] * c[0] + F.wy[t] * c[1] + F.wz[t] * c[2];
      if (cd < near) return;
      const d = Math.acos(Math.min(1, cd)) / rho;
      const w = Math.exp(-3 * d * d);
      F.field[t] += w;
      F.dark[t] += w * dark;
    });
  }
  for (let t = 0; t < T; t++) if (F.field[t] > 0.02) lava(F, t, smooth(0.035, 0.12, F.field[t]) * (F.dark[t] / F.field[t]));
  // Basin rings: a band of peaks a tenth of the radius wide, only on highland.
  for (const [la, lo, rad, tall] of RINGS) {
    const c = dir(la, lo);
    const rho = rad * DEG;
    box(c, 1.35 * rho, (t) => {
      const d = angle(F, t, c) / rho;
      if (d < 0.75 || d > 1.35) return;
      const peaks = 0.4 + noise(F.px[t] * 70, F.py[t] * 70, 6) * 1.2;
      F.hgt[t] += tall * Math.exp(-(((d - 1.04) / 0.12) ** 2)) * peaks * (1 - clamp01(F.mare[t] / 0.3));
    });
  }
  CRATERS.forEach(([la, lo, km, kind], n) => crater(F, la, lo, km, kind, n));
  // 420 random craters, 40 to 180 km, saturate the highlands, not the maria.
  for (let n = 0; n < 420; n++) {
    const z = hash(n, 11);
    const a = hash(n, 12) * TAU;
    const x = Math.sqrt(1 - z * z) * Math.cos(a);
    const y = Math.sqrt(1 - z * z) * Math.sin(a);
    const t = Math.min(TEX - 1, Math.floor(((1 - y) / 2) * TEX)) * TEX + Math.min(TEX - 1, Math.floor(((x + 1) / 2) * TEX));
    if (F.mare[t] > 0.15 && hash(n, 13) > 0.2) continue;
    crater(F, Math.asin(y) / DEG, Math.atan2(x, z) / DEG, 40 * Math.pow(4.5, Math.pow(hash(n, 14), 1.7)), 0, 1000 + n);
  }
  RAYS.forEach(([count, len, power], ci) => {
    const c = dir(CRATERS[ci][0], CRATERS[ci][1]);
    const rho = CRATERS[ci][2] / 2 / 1737;
    box(c, len * 4, (t) => {
      const d = angle(F, t, c);
      F.alb[t] += power * rayLight(F, t, ci, c, rho, count, len) + (d > 1.2 * rho ? 0.1 * Math.exp(-(((d - 1.6 * rho) / (1.6 * rho)) ** 2)) : 0);
    });
  });
  // Slope along the Sun's path, positive toward a Sun rising on the right.
  const slope = new Float32Array(T);
  for (let t = 1; t < T - 1; t++) {
    if (t % TEX === 0 || t % TEX === TEX - 1) continue;
    const cosl = F.pz[t] / Math.sqrt(F.px[t] * F.px[t] + F.pz[t] * F.pz[t] + 1e-9);
    const s = (-(F.hgt[t + 1] - F.hgt[t - 1]) / (4 / TEX)) * cosl;
    slope[t] = s > 0.28 ? 0.28 : s < -0.28 ? -0.28 : s;
  }
  for (let t = 0; t < T; t++) F.alb[t] = Math.min(1.15, Math.max(0.3, F.alb[t]));
  P.alb = F.alb;
  P.slope = slope;
  P.mare = F.mare;
}

function sample(arr, u, v) {
  const fx = Math.min(TEX - 1.0001, Math.max(0, ((u + 1) / 2) * TEX - 0.5));
  const fy = Math.min(TEX - 1.0001, Math.max(0, ((v + 1) / 2) * TEX - 0.5));
  const t = (fy | 0) * TEX + (fx | 0);
  const tx = fx - (fx | 0);
  const a = arr[t] + (arr[t + 1] - arr[t]) * tx;
  const b = arr[t + TEX] + (arr[t + TEX + 1] - arr[t + TEX]) * tx;
  return a + (b - a) * (fy - (fy | 0));
}

// The far ridge's top, in scene rows, with spruce on it, each a one-LED
// spire over a body three LEDs wide.
function ridge(x, trees) {
  let y = 113 + 2.6 * Math.sin(x * 0.08 - 0.9) + 1.2 * Math.sin(x * 0.23 + 1.7);
  const cell = Math.floor(x / 4.3);
  for (let k = cell - 2; trees && k <= cell + 2; k++) {
    const tx = (k + 0.2 + 0.6 * hash(k, 32)) * 4.3;
    const dx = Math.abs(x - tx);
    if (hash(k, 31) < 0.5 && dx < 1.9) y = Math.min(y, ridge(tx, false) - (4 + 6 * hash(k, 33)) * (1 - dx / 1.9) ** 1.4);
  }
  return y;
}

// Per-LED geometry for a latitude and zoom: where on the face it looks, its
// sky, its star.
function buildView(P, lat, zoom) {
  const m = 1 + 1.5 * zoom;
  const R = R0 * m;
  const th = (90 - lat) * DEG;
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const top = [];
  for (let x = 0; x < W; x++) top.push(ridge(CX + (x + 0.5 - CX) / m, true));
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const o = p * 3;
    const dx = x + 0.5 - CX;
    const dy = ((p / W) | 0) + 0.5 - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const sy = CY + dy / m;
    // The sky without a Moon and what a full one adds, and the glow: a tight
    // aureole lit by the limb beside it, so a crescent wears a crescent of
    // glow, and a wide one lit by the whole.
    const ty = clamp01(sy / 112);
    const dd = Math.max(0, dist - R) / m;
    const wide = 27 * Math.exp(-dd / 13);
    P.night[o] = 1 + 3 * ty * ty;
    P.night[o + 1] = 2 + 6 * ty * ty;
    P.night[o + 2] = 7 + 14 * ty;
    P.lift[o] = 5 + 7.5 * ty + wide * 0.78;
    P.lift[o + 1] = 11.5 + 13 * ty + wide * 0.85;
    P.lift[o + 2] = 28 + 20 * ty + wide;
    P.near[p] = 62 * Math.exp(-dd / 3.5);
    const turn = Math.atan2(dy, dx) / TAU;
    P.bin[p] = (turn - Math.floor(turn)) * LIMB;
    P.ground[p] = sy > top[x] ? 1 : 0;
    const a = clamp01(R - dist + 0.5);
    P.alpha[p] = a;
    if (a <= 0) continue;
    const shrink = Math.min(1, Math.sqrt(0.996 / ((dist * dist) / (R * R))));
    const qx = (dx / R) * shrink;
    const qy = (dy / R) * shrink;
    const u = qx * ct + qy * st;
    const v = -qx * st + qy * ct;
    P.fu[p] = u;
    P.fv[p] = v;
    P.alb[p] = sample(P.face.alb, u, v);
    P.slp[p] = sample(P.face.slope, u, v);
    P.mar[p] = sample(P.face.mare, u, v);
    P.lam[p] = Math.atan2(u, Math.sqrt(Math.max(0, 1 - u * u - v * v)));
    P.cb[p] = Math.sqrt(Math.max(0, 1 - v * v));
  }
  for (let j = 0; j < LIMB; j++) {
    const qx = 0.94 * Math.cos((j / LIMB) * TAU);
    const qy = 0.94 * Math.sin((j / LIMB) * TAU);
    const u = qx * ct + qy * st;
    const v = -qx * st + qy * ct;
    P.limbU[j] = u;
    P.limbV[j] = v;
    P.limbLam[j] = Math.atan2(u, Math.sqrt(Math.max(0, 1 - u * u - v * v)));
    P.limbCb[j] = Math.sqrt(1 - v * v);
  }
  // Stars turn with the face and stay one LED at any zoom.
  P.star.fill(0);
  const cs = Math.cos(th - Math.PI / 2);
  const ss = Math.sin(th - Math.PI / 2);
  for (const s of P.stars) {
    const x = Math.floor(CX + (s[0] * cs - s[1] * ss) * m);
    const y = Math.floor(CY + (s[0] * ss + s[1] * cs) * m);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const p = y * W + x;
    if (P.alpha[p] > 0 || P.ground[p]) continue;
    for (let c = 0; c < 3; c++) P.star[p * 3 + c] = Math.max(P.star[p * 3 + c], s[2] * s[3 + c]);
  }
  P.viewLat = lat;
  P.viewZoom = zoom;
}

export function setup(params) {
  const P = params;
  P.face = {};
  buildFace(P.face);
  for (const key of ["night", "lift", "star"]) P[key] = new Float32Array(N * 3);
  for (const key of ["alpha", "fu", "fv", "alb", "slp", "mar", "lam", "cb", "near", "bin"]) P[key] = new Float32Array(N);
  for (const key of ["limbU", "limbV", "limbLam", "limbCb", "limbRaw", "limb"]) P[key] = new Float32Array(LIMB);
  P.ground = new Uint8Array(N);
  // Stars, most at the limit of the eye, a few bright, some warm.
  P.stars = [];
  for (let n = 0; n < 420; n++) {
    const r = 112 * Math.sqrt(hash(n, 41));
    const a = hash(n, 42) * TAU;
    const mag = hash(n, 43);
    const warm = hash(n, 44);
    const col = warm < 0.2 ? [1, 0.82, 0.62] : warm > 0.8 ? [0.78, 0.88, 1] : [0.95, 0.95, 1];
    P.stars.push([r * Math.cos(a), r * Math.sin(a), 30 + 46 * mag * mag + (mag > 0.93 ? (120 * (mag - 0.93)) / 0.07 : 0), ...col]);
  }
  P.day = DAY0;
  P.pending = false;
  P.eclipse = -1;
  P.viewLat = 1e9;
  P.E = 0;
  P.shadowU = 0;
  P.gain = 1;
}

export function update(dt, input, params) {
  const P = params;
  if (!P.face) setup(P);
  dt = Math.min(dt, 0.1);
  const k = input.knobValues || [0, 2, 0, 0.06];
  const lat = Math.max(-90, Math.min(90, k[0]));
  const zoom = clamp01(k[2]);
  if (input.btnPressed && input.btnPressed[0] && P.eclipse < 0) P.pending = true;
  if (Math.abs(lat - P.viewLat) > 0.05 || Math.abs(zoom - P.viewZoom) > 0.0005) buildView(P, lat, zoom);
  P.gain = Math.pow(2, Math.max(-2, Math.min(2, k[3])));
  if (P.eclipse >= 0) {
    P.eclipse += dt;
    if (P.eclipse >= ECL_T) {
      P.eclipse = -1;
      P.pending = false;
    }
  } else {
    const before = Math.floor(P.day / SYNODIC + 0.5);
    P.day += Math.max(0.5, Math.min(4, k[1])) * dt;
    const after = Math.floor(P.day / SYNODIC + 0.5);
    // A booked eclipse stops the clock at full Moon, half a month in.
    if (P.pending && after > before) {
      P.day = (after - 0.5) * SYNODIC;
      P.eclipse = 0;
    }
  }
  const f = P.day / SYNODIC;
  P.E = (f - Math.floor(f)) * TAU;
  // The shadow crosses east to west, slowest over totality.
  const q = (2 * Math.max(0, P.eclipse)) / ECL_T - 1;
  P.shadowU = 5.7 * (0.6 * q + 0.4 * q * q * q);
}

// Sunlight reaching a point in the Earth's shadow, per channel: penumbra
// greys it, the umbra leaves the copper of every sunset on Earth, and the
// ozone layer edges the umbra in turquoise.
function shadowInto(out, r) {
  if (r > UMBRA + 0.06) {
    const p = r >= PENUMBRA ? 0 : Math.pow((PENUMBRA - r) / (PENUMBRA - UMBRA), 1.6);
    out[0] = 1 - 0.8 * p;
    out[1] = 1 - 0.83 * p;
    out[2] = 1 - 0.86 * p;
    return;
  }
  const deep = 0.16 + 0.2 * (r / UMBRA) ** 2;
  const edge = smooth(UMBRA - 0.12, UMBRA + 0.06, r);
  const fringe = Math.exp(-(((r - UMBRA + 0.1) / 0.09) ** 2));
  out[0] = deep + edge * 0.2;
  out[1] = deep * 0.3 + edge * 0.17 + fringe * 0.06;
  out[2] = deep * 0.1 + edge * 0.14 + fringe * 0.07;
}

export function draw(display, params) {
  const P = params;
  if (!P.face) return;
  const E = P.E;
  // Sunrise terminator at longitude 90 - E, sunset at 270 - E, held at the
  // right limb until full, so on the way to full nothing ever darkens.
  const lt = Math.PI / 2 - E;
  const ls = Math.PI * 1.5 - Math.max(E, Math.PI);
  // Lit fraction, and surface brightness, steep in the last day before full:
  // the opposition surge.
  const kf = (1 - Math.cos(E)) / 2;
  const g = 0.6 + 0.3 * Math.pow(kf, 0.9) + 0.1 * Math.exp(-Math.abs(E - Math.PI) / 0.12);
  let moonlight = kf * g;
  const ecl = P.eclipse >= 0;
  const sh = [1, 1, 1];
  const shade = (u, v) => {
    shadowInto(sh, Math.hypot(u - P.shadowU, v - GAMMA));
    return sh[0] * 0.3 + sh[1] * 0.6 + sh[2] * 0.1;
  };
  // The aureole's light by limb sample, spread 17 degrees either way; each
  // only brightens on the way to full, so the glow does too. In an eclipse
  // the sky dims with the shadow's mean round the limb.
  let dim = 0;
  for (let j = 0; j < LIMB; j++) {
    const cb = P.limbCb[j];
    const lam = P.limbLam[j];
    const t = clamp01((Math.min((lam - lt) * cb, (ls - lam) * cb + 0.05) + 0.01) / W0);
    const f = ecl ? shade(P.limbU[j], P.limbV[j]) : 1;
    dim += f / LIMB;
    P.limbRaw[j] = (ES + (g - ES) * t * (2 - t)) * f;
  }
  moonlight *= dim;
  for (let j = 0; j < LIMB; j++) {
    let sum = 0;
    for (let k = -6; k <= 6; k++) sum += SPREAD[k + 6] * P.limbRaw[(j + k + LIMB) % LIMB];
    P.limb[j] = sum / SPREAD_SUM;
  }
  const gain = P.gain;
  const esR = ES * ES_COL[0];
  const esG = ES * ES_COL[1];
  const esB = ES * ES_COL[2];
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    let r = P.night[o] + moonlight * P.lift[o];
    let gg = P.night[o + 1] + moonlight * P.lift[o + 1];
    let b = P.night[o + 2] + moonlight * P.lift[o + 2];
    const near = P.near[p];
    if (near > 0.3) {
      const j = P.bin[p] | 0;
      const glow = near * (P.limb[j] + (P.limb[(j + 1) % LIMB] - P.limb[j]) * (P.bin[p] - j));
      r += glow * 0.78;
      gg += glow * 0.85;
      b += glow;
    }
    if (P.star[o + 2] > 0) {
      r = Math.max(r, P.star[o]);
      gg = Math.max(gg, P.star[o + 1]);
      b = Math.max(b, P.star[o + 2]);
    }
    if (P.ground[p]) {
      r = 1;
      gg = 1.5;
      b = 3;
    } else if (P.alpha[p] > 0) {
      // Earthshine, and sunlight by the Sun's height over the ground, slope
      // included, so walls facing dawn light first and peaks shine past it.
      const a = P.alpha[p];
      const cb = P.cb[p];
      const lam = P.lam[p];
      const s = P.slp[p];
      const t = clamp01((Math.min((lam - lt) * cb + s, (ls - lam) * cb - s + 0.05) + 0.01) / W0);
      const F = t * (2 - t);
      const al = P.alb[p] * 255;
      const ma = P.mar[p] > 0.4 ? g : g * 2.5 * P.mar[p];
      let sr = g * HI_COL[0] + (MA_COL[0] - HI_COL[0]) * ma;
      let sg = g * HI_COL[1] + (MA_COL[1] - HI_COL[1]) * ma;
      let sb = g * HI_COL[2] + (MA_COL[2] - HI_COL[2]) * ma;
      if (ecl) {
        shadowInto(sh, Math.hypot(P.fu[p] - P.shadowU, P.fv[p] - GAMMA));
        sr *= sh[0];
        sg *= sh[1];
        sb *= sh[2];
      }
      r += (al * (esR + (sr - esR) * F) - r) * a;
      gg += (al * (esG + (sg - esG) * F) - gg) * a;
      b += (al * (esB + (sb - esB) * F) - b) * a;
    }
    r *= gain;
    gg *= gain;
    b *= gain;
    display.setPixel(p % W, (p / W) | 0, r > 255 ? 255 : r, gg > 255 ? 255 : gg, b > 255 ? 255 : b);
  }
}
