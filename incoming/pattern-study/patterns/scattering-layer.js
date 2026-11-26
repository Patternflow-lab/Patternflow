// ===== Patternflow pattern =====
// Title:   Scattering Layer
// Family:  echosounder
// Idea:    The record of a ship's echo sounder over open water scrolls in from the right one ping at a time, depth running down the panel from a band of surface bubbles to a thick warm seabed with a dark shadow under it, and in the navy water between them the deep scattering layer of plankton and lanternfish hangs as soft teal bands that rise towards the surface at dusk and sink at dawn, split in two and come together, while single fish pass under the ship as bright crescents and now and then a school shows as a glowing cloud.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the echo sounder (Langevin and Chilowsky, 1917, from memory) and its first records of fish (Sund, 1935, cod off Lofoten, from memory); the deep scattering layer found as a "phantom bottom" by Eyring, Christensen and Raitt (1942) and read as animals by Johnson (1945), both from memory; diel vertical migration; the target strength, volume backscatter and time-varied gain of fisheries acoustics (Simmonds and MacLennan, 2005, from memory). Original here: a synthetic sounder that sums every scatterer of a two-dimensional sea through a beam pattern for each ping, so the fish arches come out of the range geometry and the seabed out of its footprint, pattern round 260
// Round:   260
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..6, Gain=-12..9, Life=-1..1
//
// Knob 1: Hue. Turns the chart through four palettes and back: at 0 navy water, teal and cyan for weak echoes, amber and orange for strong ones, white for the strongest, and a rust-orange seabed; at 0.25 the green of an old phosphor screen with a gold seabed; at 0.5 violet water with rose and gold echoes over a sea-green seabed; at 0.75 indigo water with ice-blue and pink echoes over a crimson seabed.
// Knob 2: Speed. Pings a second, 1.6 for each unit, so 3.2 at the opening, where a fish crosses the panel in 20 s. At 0.3 the record creeps along at half a column a second; at 6 it races at 9.6 pings a second. The sea is the same at every speed, only the record runs faster.
// Knob 3: Gain. The receiver gain in dB, added to every level before the palette. At -12 the water goes black and only the fish cores, the schools and the seabed show; at 0 the water is navy and the layers teal; at 9 the plankton haze fills the water, the layers turn cyan with amber patches, and the noise that the time-varied gain lifts with depth shows as a faint haze down by the seabed.
// Knob 4: Life. How many fish and schools are in the sea, e to the power 1.9 times the knob times a base count: at -1 one or two fish under a panel's width of sea and a school every dozen panels, at 0.06 about a dozen fish and a school in most panels, at 1 some eighty fish, their arches packed like scales, and five schools.

// What the picture is. A sea of along-track position x and depth z, both in rows of the panel (128 rows of depth), with the ship moving 2.8
// rows of x for each ping. Each ping fills one column of 128 range bins and adds it to a ring of 72 columns; the panel shows the last 64,
// sliding left between pings by the fraction of the next one so the scroll is smooth.
// A ping sums, in linear intensity, for every range bin r:
//   point scatterers: a fish at (x, cross-track y, z) answers at range sqrt(z^2 + dx^2 + y^2), dx its offset from the ship, weighted by the
//     two-way beam exp(-42 phi^2), phi = sqrt(dx^2 + y^2) / z, and spread over the pulse as exp(-((r - range) / 0.8)^2), so 2 to 3 bins carry it.
//     As the ship passes over a fish its range falls to the depth and rises again, and that is the arch; a fish off to the side gives a fainter,
//     deeper one. Target strengths are in dB after 40 log R gain, so a fish is as bright at any depth, but a deep one stays in the beam longer
//     and draws a wider arch.
//   volume layers: a profile exp(-((z - centre) / w)^4) for each, a band with a soft edge, roughened by value noise in (x, z) at 16 by 2.6 rows
//     so a layer is cloudy and never grainy, with lanternfish in it as weak point scatterers that make small arches.
//   the seabed: 45 points of the bottom profile across the beam, each answering at its own range with the beam weight and a backscatter that
//     is strong at normal incidence and falls off with the angle; a smooth minimum of their ranges is where the seabed starts, so a rock in the
//     beam throws a hyperbola above the line. Under it a sediment echo decays over 2.6 rows, faintly bedded, and then there is only noise.
//   the surface: the transmit ring-down and a band of bubbles that decays from the surface, with plumes a few pings wide when the sea is up.
//   the background: weak scattering everywhere in the water above the seabed, and noise that the 20 log R gain lifts with range.
// The column is stored in dB and the gain and palette are applied when the panel is drawn, so the gain knob acts on the whole record at once.
// Water and seabed have two ramps of each palette over the same levels, the seabed's taking over two rows above where the seabed starts.
// Diel migration: a migrating layer in two parts and a resident layer. Day, dusk, night and dawn follow each other with random lengths,
// 360 to 900, 140 to 300, 300 to 800 and 120 to 260 pings, and with new depths each time: the migrators sit at 60 to 78 by day and 14 to 30
// by night. On most transits one part lags the other and on about half of the nights it stays 6 to 15 rows deeper, so the layer splits and joins
// again. The resident layer wanders between 70 and 94 and fades in and out. All layers ride internal waves of about 22 and 37 pings with a
// wandering height and phase, and thicken while they move. The seabed is four sines of incommensurate wavelengths squeezed between rows 100
// and 120 with rocks on it. Fish are spawned 80 rows ahead of the ship at random: singles in the water, singles around the layers,
// demersal fish a few rows over the seabed, schools of 50 to 110 fish in two lobes, and the lanternfish. The first update spawns the sea and
// runs 70 pings at the knobs from early in a dusk, so the opening frame is a full record with the layer rising across it.

const W = 64, H = 128, NC = 72;
const { floor, sqrt, abs, exp, log, sin, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const lin = (d) => exp(0.2302585 * d);   // dB to intensity
const TODB = 4.3429448;                  // intensity to dB, times ln

const V = 2.8;          // rows of along-track travel for each ping
const PPS = 1.6;        // pings a second for each unit of Speed
const BC = 42;          // two-way beam, exp(-BC phi^2)
const PHI = 0.48;       // widest angle summed, -40 dB of the beam
const SIG = 0.8;        // pulse half-length in rows
const SPAN = 40;        // dB from the navy floor of the palette to its white top
const AHEAD = 80;       // fish are spawned this far ahead of the ship and dropped this far behind

function hsh(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x, y, s) {
  const x0 = floor(x), y0 = floor(y);
  let fx = x - x0, fy = y - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hsh(x0, y0, s), b = hsh(x0 + 1, y0, s), c = hsh(x0, y0 + 1, s), d = hsh(x0 + 1, y0 + 1, s);
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
const vn1 = (x, s) => vn(x, 0.5, s);
function poisson(m) {
  if (m <= 0) return 0;
  const L = exp(-m);
  let k = 0, p = rnd();
  while (p > L && k < 30) {
    k++;
    p *= rnd();
  }
  return k;
}

// ---- the sea floor
function zbAt(S, x) {
  const B = S.bot;
  let z = 4.5 * sin(x * B[0] + B[4]) + 3.2 * sin(x * B[1] + B[5]) + 2.2 * sin(x * B[2] + B[6]) + 1.0 * sin(x * B[3] + B[7]);
  z += 18 * (vn1(x / 280, S.salt + 40) - 0.5);
  z = 110 + 10.5 * Math.tanh(z / 10.5);
  const c = floor(x / 60);
  for (let i = c - 1; i <= c + 1; i++) {
    if (hsh(i, 3, S.salt) > 0.32) continue;
    const xc = (i + 0.2 + 0.6 * hsh(i, 4, S.salt)) * 60, sx = 5 + 7 * hsh(i, 5, S.salt), h = 1.5 + 4 * hsh(i, 6, S.salt);
    const d = (x - xc) / sx;
    if (d * d < 9) z -= h * exp(-d * d);
  }
  return z;
}

// ---- the diel clock and the layers
const DUR = [[300, 720], [140, 300], [260, 640], [120, 260]];
const ease = (u) => {
  const t = cl(u, 0, 1);
  return t * t * (3 - 2 * t);
};
function nextPhase(S) {
  S.ph = (S.ph + 1) % 4;
  S.pt = 0;
  const d = DUR[S.ph];
  S.pd = d[0] + (d[1] - d[0]) * rnd();
  if (S.ph === 1 || S.ph === 3) S.lag = rnd() < 0.4 ? 0 : 0.15 + 0.22 * rnd();
  if (S.ph === 1) {
    S.shA = 14 + 16 * rnd();
    S.dn = rnd() < 0.45 ? 0 : 6 + 9 * rnd();
  }
  if (S.ph === 3) S.deepA = 60 + 18 * rnd();
}
function layers(S, k) {
  const u = S.pt / S.pd, lg = S.lag, a = 1 - lg;
  let l1, l2;
  if (S.ph === 0) l1 = l2 = 0;
  else if (S.ph === 2) l1 = l2 = 1;
  else {
    l1 = ease(u / a);
    l2 = ease((u - lg) / a);
    if (S.ph === 3) {
      l1 = 1 - l1;
      l2 = 1 - l2;
    }
  }
  const s = S.salt;
  const env = 0.8 + 2.6 * vn1(k / 260, s + 31) ** 2;
  const iw = env * (0.75 * sin(0.29 * k + S.iw1 + 2.4 * vn1(k / 140, s + 39)) + 0.6 * sin(0.171 * k + S.iw2) + 0.45 * sin(0.083 * k + S.iw3));
  const wan = 18 * (vn1(k / 110, s + 32) - 0.5);
  const zb = S.zb0;
  const L = S.L;
  // the migrating layer, in two parts
  const dA = S.deepA + wan, sA = S.shA + 0.4 * wan;
  L[0] = min(zb - 12, dA + (sA - dA) * l1 + iw);
  L[1] = 2.5 + 1.5 * vn1(k / 150, s + 33) + 1.3 * 4 * l1 * (1 - l1);
  L[2] = lin(16.5 + 5 * (vn1(k / 90, s + 34) - 0.5) + 3 * (vn1(k / 300, s + 41) - 0.5)) * S.q;
  L[3] = min(zb - 10, dA + 3 + (sA + S.dn - dA - 3) * l2 + 0.9 * iw);
  L[4] = 2.7 + 1.5 * vn1(k / 170, s + 35) + 1.3 * 4 * l2 * (1 - l2);
  L[5] = lin(16.5 + 5 * (vn1(k / 100, s + 36) - 0.5) + 3 * (vn1(k / 300, s + 41) - 0.5)) * (1 - S.q);
  // the resident layer
  S.zB += (S.zBt - S.zB) * 0.006;
  if (rnd() < 0.006) S.zBt = 70 + 24 * rnd();
  L[6] = min(zb - 8, S.zB + 0.8 * iw);
  L[7] = 2.6 + 1.6 * vn1(k / 170, s + 37);
  L[8] = lin(13.5 + 16 * (vn1(k / 200, s + 38) - 0.55));
}

// ---- the sea's animals
// kinds: 0 a free fish at its own depth, 1 a fish riding a layer part at an offset in rows, 2 a lanternfish at an offset in layer widths
function addFish(S, x, kind) {
  const f = { x, yf: (rnd() - 0.5) * 0.5, z: 0, li: 0, off: 0, a: 0, kind };
  const zb = zbAt(S, x);
  if (kind === 0) {
    const r = rnd();
    if (r < 0.26) {
      f.z = zb - 2.5 - 7 * rnd();
      f.yf *= 0.4;
    } else f.z = 20 + (zb - 34) * sqrt(rnd());
    f.a = lin(20 + 13 * rnd());
  } else if (kind === 1) {
    f.li = rnd() < 0.6 ? 0 : rnd() < 0.5 ? 3 : 6;
    f.off = (rnd() < 0.5 ? -1 : 1) * (4 + 9 * rnd());
    f.a = lin(19 + 11 * rnd());
  } else {
    const r = rnd();
    f.li = r < 0.4 ? 0 : r < 0.75 ? 3 : 6;
    f.off = (rnd() + rnd() + rnd() - 1.5) * 1.1;
    f.a = lin(5 + 7 * rnd());
  }
  S.fish.push(f);
}
function addSchool(S, x) {
  const zb = zbAt(S, x), r = rnd();
  const z = r < 0.45 ? 16 + 30 * rnd() : r < 0.8 ? 46 + 34 * rnd() : zb - 6 - 6 * rnd();
  const n = 50 + floor(60 * rnd()), sx = 8 + 12 * rnd(), sz = 2.4 + 3.4 * rnd();
  const m = new Float32Array(n * 3);
  const lx = (rnd() - 0.5) * 2.2 * sx, lz = (rnd() - 0.5) * 2.4 * sz;
  for (let i = 0; i < n; i++) {
    const g = rnd() < 0.62 ? 0 : 1, gx = g ? lx : 0, gz = g ? lz : 0, sh = g ? 0.7 : 1;
    m[i * 3] = gx + (rnd() + rnd() + rnd() - 1.5) * sx * sh;
    m[i * 3 + 1] = gz + (rnd() + rnd() + rnd() - 1.5) * sz * sh;
    m[i * 3 + 2] = lin(10 + 7 * rnd());
  }
  S.schools.push({ x, z: min(z, zb - 4 - sz * 1.5), yf: (rnd() - 0.5) * 0.2, m });
}
function spawnAt(S, x, len) {
  const m = S.lifeM;
  for (let i = poisson(0.04 * m * len); i > 0; i--) addFish(S, x + rnd() * len, 0);
  for (let i = poisson(0.024 * m * len); i > 0; i--) addFish(S, x + rnd() * len, 1);
  for (let i = poisson(0.2 * (0.5 + 0.5 * Math.pow(m, 0.4)) * len); i > 0; i--) addFish(S, x + rnd() * len, 2);
  for (let i = poisson(0.0034 * Math.pow(m, 1.15) * len); i > 0; i--) addSchool(S, x + rnd() * len);
}

// one point echo into the column
function echo(col, z, dx, dy, a) {
  const z2 = z * z, o2 = dx * dx + dy * dy;
  if (z <= 1 || o2 > PHI * PHI * z2) return;
  const amp = a * exp((-BC * o2) / z2);
  if (amp < 0.04) return;
  const r0 = sqrt(z2 + o2);
  const i0 = max(0, floor(r0 - 2.6)), i1 = min(H - 1, floor(r0 + 2.6));
  for (let i = i0; i <= i1; i++) {
    const d = (i + 0.5 - r0) / SIG;
    col[i] += amp * exp(-d * d);
  }
}

function ping(S, k) {
  const X = k * V, col = S.col, s = S.salt;
  S.pt++;
  if (S.pt >= S.pd) nextPhase(S);
  // the sea ahead and behind
  while (S.spawnX < X + AHEAD) {
    spawnAt(S, S.spawnX, V);
    S.spawnX += V;
  }
  if (k % 8 === 0) {
    S.fish = S.fish.filter((f) => f.x > X - AHEAD);
    S.schools = S.schools.filter((q) => q.x > X - AHEAD - 30);
  }
  const zb0 = zbAt(S, X);
  S.zb0 = zb0;
  layers(S, k);
  const L = S.L;

  // the seabed through the beam; hard ground and soft mud alternate along the track
  col.fill(0);
  const hard = lin(7 * (vn1(X / 170, s + 42) - 0.5));
  const M = 22;
  let rmin = 1e9;
  for (let j = -M; j <= M; j++) {
    const dx = (j / M) * PHI * zb0, xj = X + dx;
    const zj = zbAt(S, xj), sl = (zbAt(S, xj + 0.7) - zbAt(S, xj - 0.7)) / 1.4;
    const r = sqrt(zj * zj + dx * dx), ang = dx / zj;
    const bw = exp(-BC * ang * ang);
    const cosI = cl((zj - dx * sl) / (r * sqrt(1 + sl * sl)), -1, 1);
    const inc = Math.acos(cosI);
    const amp = bw * (lin(44) * exp(-(inc * inc) / 0.03) + lin(25) * hard * cosI * cosI) * (PHI / M) * 1.05;
    const rs = r + 1.4 * log(1 + 80 / (amp + 1e-9));
    if (rs < rmin) rmin = rs;
    const i0 = max(0, floor(r - 3)), i1 = min(H - 1, floor(r + 3));
    for (let i = i0; i <= i1; i++) {
      const d = (i + 0.5 - r) / 0.95;
      col[i] += amp * exp(-d * d);
    }
  }
  if (rmin > H + 10) rmin = zb0;
  S.rb[k % NC] = rmin;
  // sediment under the first return, faintly bedded, then nothing
  const sub = lin(23) * hard;
  for (let i = max(0, floor(rmin)); i < H; i++) {
    const d = i + 0.5 - rmin;
    if (d < 0) continue;
    const bed = 0.55 + 0.9 * vn(X / 34, d / 1.7, s + 7);
    col[i] += sub * sm(0, 1.2, d) * exp(-d / 2.6) * bed;
  }

  // background: weak scattering in the water and noise that the gain lifts with range
  const env = 0.6 + 0.8 * vn1(k / 5.5, s + 8);
  for (let i = 0; i < H; i++) {
    const r = i + 0.5, rr = r / H;
    const water = sm(rmin + 0.5, rmin - 2, r);
    const pv = vn(X / 9, r / 3, s + 9);
    col[i] += lin(-4) * water * (0.75 + 0.5 * pv) + lin(-6) * rr * rr * env;
  }

  // the surface: transmit ring-down and bubbles, with plumes when the sea is up
  const sea = vn1(k / 190, s + 10);
  const plume = vn1(k / 4.6, s + 11), pl = plume * plume * plume * plume;
  const depth = 2 + (1.5 + 6 * sea) * pl;
  const top = lin(15 + 5 * sea);
  for (let i = 0; i < 30; i++) {
    const r = i + 0.5, b = 0.55 + 0.9 * vn(X / 5, r / 2.2, s + 12);
    col[i] += top * exp(-r / depth) * b + lin(19) * exp(-r * r / 1.2);
  }

  // the volume layers, patchy
  for (let p = 0; p < 9; p += 3) {
    const zc = L[p], w = L[p + 1], st = L[p + 2];
    const i0 = max(0, floor(zc - 2 * w)), i1 = min(H - 1, floor(zc + 2 * w));
    for (let i = i0; i <= i1; i++) {
      let d = (i + 0.5 - zc) / w;
      d *= d;
      const pv = vn(X / 16, (i + 0.5) / 2.6, s + 13 + p) * 0.75 + vn(X / 5, (i + 0.5) / 1.6, s + 14 + p) * 0.25;
      const big = vn(X / 46, (i + 0.5) / 9, s + 15 + p);
      col[i] += st * exp(-d * d) * (0.4 + 1.2 * pv * pv) * (0.25 + 1.5 * big);
    }
  }

  // fish
  for (const f of S.fish) {
    const dx = f.x - X;
    let z;
    if (f.kind === 0) z = f.z;
    else if (f.kind === 1) z = L[f.li] + f.off;
    else z = L[f.li] + f.off * L[f.li + 1];
    if (z > rmin - 2 || z < 15) continue;
    echo(col, z, dx, f.yf * z, f.a);
  }
  for (const q of S.schools) {
    const dq = q.x - X;
    if (abs(dq) > PHI * q.z + 40) continue;
    const m = q.m;
    for (let i = 0; i < m.length; i += 3) {
      const z = q.z + m[i + 1];
      echo(col, z, dq + m[i], q.yf * z, m[i + 2]);
    }
  }

  const base = (k % NC) * H, rec = S.rec;
  for (let i = 0; i < H; i++) rec[base + i] = TODB * log(col[i] + 1e-6);
}

function makeState() {
  const b = [1 / 260, 1 / 151, 1 / 67, 1 / 29];
  const bot = new Float32Array(8);
  for (let i = 0; i < 4; i++) {
    bot[i] = b[i] * (0.9 + 0.2 * rnd());
    bot[i + 4] = rnd() * 2 * PI;
  }
  return {
    ready: false, salt: floor(rnd() * 1e9), bot,
    rec: new Float32Array(NC * H), rb: new Float32Array(NC), col: new Float64Array(H),
    n: 0, f: 0, fish: [], schools: [], spawnX: 0, zb0: 111,
    ph: 1, pt: 0, pd: 220, lag: 0.25, shA: 24, dn: 9, deepA: 68, q: 0.58,
    zB: 82, zBt: 82, iw1: rnd() * 6.28, iw2: rnd() * 6.28, iw3: rnd() * 6.28, L: new Float64Array(9),
    kn: [0, 2, 0, 0.06], hue: 0, spd: 2, gain: 0, life: 0.06, lifeM: 1,
    lut: new Uint8Array(256 * 6), lutAt: -1,
  };
}

export function setup(params) {
  params.s = makeState();
}

const knobsOf = (input) => {
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  return [cl(kn[0], 0, 1), cl(kn[1], 0.3, 6), cl(kn[2], -12, 9), cl(kn[3], -1, 1)];
};

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = knobsOf(input), d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    S.hue = kn[0];
    S.spd = kn[1];
    S.gain = kn[2];
    S.life = kn[3];
    S.lifeM = exp(1.9 * S.life);
    // the sea around the ship, then 70 pings from the middle of a dusk
    S.zb0 = zbAt(S, 0);
    layers(S, 0);
    for (let x = -AHEAD; x < AHEAD; x += V) spawnAt(S, x, V);
    S.spawnX = AHEAD;
    S.pt = 0.2 * S.pd;
    for (let k = 1; k <= 70; k++) ping(S, k);
    S.n = 70;
    S.f = 0;
  }
  const kf = 1 - exp(-d / 0.3);
  S.hue += (kn[0] - S.hue) * kf;
  S.spd += (kn[1] - S.spd) * kf;
  S.gain += (kn[2] - S.gain) * kf;
  S.life += (kn[3] - S.life) * kf;
  S.lifeM = exp(1.9 * S.life);
  S.f += d * PPS * S.spd;
  let guard = 0;
  while (S.f >= 1 && guard++ < 8) {
    S.f -= 1;
    S.n++;
    ping(S, S.n);
  }
  if (S.f >= 1) S.f = 0.999;
}

// ---- colour: four palettes, each a water ramp and a seabed ramp over the same levels
const POS = [-0.45, -0.2, 0, 0.14, 0.28, 0.42, 0.54, 0.64, 0.76, 0.88, 1];
const FAM = [
  [
    [[0, 0, 0], [2, 6, 20], [5, 17, 50], [6, 42, 88], [10, 92, 126], [30, 154, 162], [120, 202, 186], [236, 188, 96], [255, 134, 36], [255, 200, 128], [255, 250, 240]],
    [[0, 0, 0], [5, 2, 1], [22, 8, 3], [50, 17, 5], [92, 33, 8], [142, 56, 12], [192, 86, 20], [232, 120, 34], [255, 160, 60], [255, 212, 142], [255, 248, 236]],
  ],
  [
    [[0, 0, 0], [1, 6, 4], [2, 19, 13], [3, 40, 24], [8, 78, 40], [28, 128, 52], [92, 176, 60], [186, 204, 70], [250, 186, 48], [255, 228, 150], [255, 250, 230]],
    [[0, 0, 0], [5, 3, 0], [20, 12, 2], [44, 26, 4], [86, 52, 8], [132, 82, 12], [182, 118, 20], [222, 152, 30], [250, 192, 62], [255, 226, 142], [255, 250, 232]],
  ],
  [
    [[0, 0, 0], [6, 2, 14], [18, 8, 42], [40, 14, 76], [78, 26, 120], [142, 44, 152], [212, 80, 150], [255, 130, 118], [255, 182, 80], [255, 222, 150], [255, 250, 236]],
    [[0, 0, 0], [1, 4, 5], [5, 16, 18], [10, 34, 38], [16, 64, 68], [26, 100, 98], [50, 140, 128], [100, 190, 158], [170, 230, 190], [222, 250, 226], [250, 255, 250]],
  ],
  [
    [[0, 0, 0], [3, 4, 14], [10, 14, 42], [16, 30, 78], [30, 64, 132], [60, 110, 192], [120, 160, 236], [190, 200, 255], [255, 186, 220], [255, 224, 240], [255, 255, 255]],
    [[0, 0, 0], [5, 2, 3], [22, 6, 12], [46, 10, 24], [82, 18, 42], [132, 30, 62], [182, 50, 82], [226, 80, 98], [255, 130, 120], [255, 200, 182], [255, 250, 246]],
  ],
];
function buildLut(S, hue) {
  const p = (((hue % 1) + 1) % 1) * 4, i = floor(p) % 4, u = sm(0.15, 0.85, p - floor(p));
  const A = FAM[i], B = FAM[(i + 1) % 4], lut = S.lut;
  for (let e = 0; e < 256; e++) {
    const v = -0.45 + (1.45 * e) / 255;
    let j = 0;
    while (j < POS.length - 2 && v > POS[j + 1]) j++;
    const t = cl((v - POS[j]) / (POS[j + 1] - POS[j]), 0, 1);
    for (let w = 0; w < 2; w++)
      for (let c = 0; c < 3; c++) {
        const a = A[w][j][c] + (A[w][j + 1][c] - A[w][j][c]) * t;
        const b = B[w][j][c] + (B[w][j + 1][c] - B[w][j][c]) * t;
        lut[e * 6 + w * 3 + c] = cl(a + (b - a) * u + 0.5, 0, 255) | 0;
      }
  }
  S.lutAt = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (abs(S.hue - S.lutAt) > 0.002) buildLut(S, S.hue);
  const lut = S.lut, rec = S.rec, f = S.f, g = 1 - f;
  const sc = 255 / (1.45 * SPAN), off = (S.gain + 0.45 * SPAN) * sc;
  for (let x = 0; x < W; x++) {
    const k0 = S.n - 1 - (W - 1 - x);
    const i0 = ((k0 % NC) + NC) % NC, i1 = (i0 + 1) % NC;
    const b0 = i0 * H, b1 = i1 * H;
    const rb = S.rb[i0] * g + S.rb[i1] * f;
    for (let y = 0; y < H; y++) {
      const D = rec[b0 + y] * g + rec[b1 + y] * f;
      let e = D * sc + off;
      e = e < 0 ? 0 : e > 255 ? 255 : e | 0;
      const o = e * 6, wb = sm(rb - 2.4, rb - 0.6, y + 0.5);
      let r = lut[o], gg = lut[o + 1], b = lut[o + 2];
      if (wb > 0) {
        r += (lut[o + 3] - r) * wb;
        gg += (lut[o + 4] - gg) * wb;
        b += (lut[o + 5] - b) * wb;
      }
      display.setPixel(x, y, r | 0, gg | 0, b | 0);
    }
  }
}
