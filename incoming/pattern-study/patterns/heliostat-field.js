// ===== Patternflow pattern =====
// Title:   Heliostat Field
// Family:  heliostat
// Idea:    The ray diagram of a solar tower plant drawn as living light in side section: eighteen small mirrors on a dark plain turn, every one, so that its gold beam lands on the glowing receiver at the top of a slim central tower, the sun of a high-latitude summer swings across the sky and the whole fan swings with it, a mirror in the way of a neighbour's beam cuts it with a spark, a mirror in a neighbour's shadow goes dark, clouds slide through the shafts and blink the fan out section by section, and the receiver flares and cools slowly with the power it gets.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the solar power tower (Aden and Marjorie Meinel, 1970s; Solar One, 1982; PS10 and Ivanpah), the heliostat (Willem 's Gravesande, 1742), the law of reflection (Hero of Alexandria), cosine, blocking and shading losses of a heliostat field (Lipps and Vant-Hull, 1978), pattern round 213
// Round:   213
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Time=0..4, Tower=-1..1, Canting=0..1
//
// Knob 1: Hue. The colour of the light, which tints the sky, the shafts, the beams and the sun together. It opens on gold, goes through amber to pink at a third of the way, to cool blue-white at a half, to pale mint at two thirds and pale yellow at five sixths, and is back on gold at 1.
// Knob 2: Time. How fast the sun goes round, and the clouds with it, on a log scale. It opens at 2, which is one day in 38 seconds; at 0 a day takes 120 seconds, at 4 it takes 12. The year of the declination, 9.7 days long, speeds up with it.
// Knob 3: Tower. How high the receiver stands over the foot of the tower, 80 LEDs where it opens at 0, 92 at 1 and 16 at -1. The foot is on a mound 8 LEDs high, so the receiver is 88 over the edge of the panel at the opening. At 24 and below the beams of the outer mirrors graze their neighbours and are cut with a spark; at 16 five to seven of the eighteen are cut and the field gives about two thirds of its power.
// Knob 4: Canting. The aiming error of the mirrors. Each is turned off by its own fixed angle times this, and the angle wanders a little. At 0 every beam meets in one point, where it opens at 0.06 they miss by about an LED, at 1 the worst miss by up to 18 LEDs and spill past the receiver, which cools, with the rays that miss running on up the sky as a fuzzy bright spot.

// The picture is a section through a field along the plane of the meridian. One LED is a length of the field, the
// ground is row 114 at the panel's edges and rises 8 LEDs to the foot of the tower at column 32. Mirror i has its
// pivot at (x_i, 3) over the ground under it. With s the unit vector from the pivot toward the sun and r the unit
// vector toward the receiver, the normal that sends the light along r is n = normalize(s + r), so that the
// reflection of -s about n is r exactly. The mirror is the segment of length 3 across n, and the cosine loss is
// n.s. Canting turns r by e_i first, so the mirror turns by half of e_i.
// The sun is the one of latitude 70. Its unit vector in the plane is (south, up), taken from the declination d
// and the hour angle h: up = sin(lat) sin(d) + cos(lat) cos(d) cos(h) and south = sin(lat) cos(d) cos(h) -
// cos(lat) sin(d). The projected angle alpha is atan2(up, south), so the sun is on the right at noon, goes over
// the top and comes down on the left through the night, never more than 5 degrees under the horizon. In the
// east-west plane the same sun stays under 25 degrees of projected angle for three days in five, with every mirror
// shaded; in the meridian plane it is two in five, so the section is the meridian one. The declination wanders
// between 15.4 and 23.4 degrees over a year of 38 x 9.7 s, which does not divide the day of 38 s. The hour angle
// carries an equation of time of up to 16 degrees. How much light the sun gives is exp(-0.1 / (sin el + 0.06)),
// the loss of a longer path through the air, times a clearness that drifts over 2.6 and 4.3 days. On about 8
// percent of the time the sun is down, and the horizon keeps its glow.
// Blocking and shading are tests of segments. From five points on a mirror a ray goes toward the sun, and the
// mirror's lit share is the fraction that meets no other mirror; from the same five points a ray goes along the
// beam, and the share that meets no other mirror before the receiver is what gets through. The drawn beam is the
// middle ray, cut with a spark at the first mirror it meets and dim beyond. A cloud is five to seven soft
// ellipses that drift across the sky; the optical depth along a shaft is the integral of their density, and the
// shaft is drawn with the light that is left, so the fan goes out section by section under one.
// A beam passes the receiver at some perpendicular distance. Inside 3.5 LEDs all of it is absorbed, outside 5
// none is, and what is not absorbed runs on up the sky. The receiver's glow follows the absorbed power through a
// 1.5 s lag, and so does the spill's glow.
// What the model keeps is the sun's clock, the clouds and the receiver's heat. The sun is a formula of the clock,
// the geometry is solved again each frame, and the heat starts at its steady value, so the first frame is already
// an afternoon and there is no run-up to do. The first cloud enters at 0.6 s.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, exp, pow, abs, min, max, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

const GY = 114; // the ground at the edges of the panel, row
const TX = 32; // the tower column
const HILL = 8; // how far the ground rises toward the tower, LEDs
const mound = (x) => HILL * pow(cos(cl(abs(x - TX) / 36, 0, 1) * 1.5708), 1.4); // the ground's height over row 114
const NM = 18; // mirrors
const PED = 3.0; // pivot height above the ground, 2.7 to 3.3 from mirror to mirror
const ML = 3.0; // mirror length
const NS = 5; // sample points on a mirror
const SPAN = 1.1; // the samples go from -SPAN to SPAN along the mirror
const LAT = (70 * PI) / 180;
const DAY = 38; // seconds of a day at Time 2
const YEAR = 38 * 9.7;
const T_OPEN = (DAY * 50) / 360; // the clock at the opening, hour angle 50 degrees
const RAD_IN = 3.5, RAD_OUT = 5.0; // the receiver takes a beam inside this perpendicular distance, none outside that
const KAPPA = 0.34; // optical depth of a cloud per unit of density per LED
const NN = 18; // nodes along a shaft
const BEAM = 0.75, SHAFT = 0.17; // how bright a full beam and a full shaft are, before the tone curve
const GAIN = 2.0; // the tone curve

// colour keys round the knob: beam, shaft, sky top, sky horizon, sun
const KEYS = [
  [[1.0, 0.8, 0.44], [1.0, 0.63, 0.24], [0.07, 0.05, 0.26], [0.7, 0.32, 0.1], [1.0, 0.93, 0.72]],
  [[1.0, 0.64, 0.26], [1.0, 0.46, 0.14], [0.1, 0.04, 0.22], [0.78, 0.24, 0.06], [1.0, 0.8, 0.5]],
  [[1.0, 0.56, 0.72], [1.0, 0.36, 0.55], [0.14, 0.04, 0.26], [0.76, 0.17, 0.4], [1.0, 0.8, 0.84]],
  [[0.8, 0.88, 1.0], [0.52, 0.66, 1.0], [0.03, 0.06, 0.28], [0.22, 0.38, 0.72], [0.92, 0.96, 1.0]],
  [[0.72, 1.0, 0.9], [0.42, 0.9, 0.72], [0.02, 0.1, 0.22], [0.12, 0.55, 0.52], [0.95, 1.0, 0.92]],
  [[0.95, 0.93, 0.55], [0.9, 0.78, 0.3], [0.06, 0.08, 0.2], [0.55, 0.45, 0.12], [1.0, 1.0, 0.78]],
];

function palette(h, out) {
  const f = (h - floor(h)) * KEYS.length;
  const i = floor(f) % KEYS.length, j = (i + 1) % KEYS.length;
  const t = sm(0, 1, f - floor(f));
  for (let k = 0; k < 5; k++) for (let c = 0; c < 3; c++) out[k][c] = mix(KEYS[i][k][c], KEYS[j][k][c], t);
}

// x of the mirrors: nine each side of the tower, 3.25 apart, a little off the grid
const XS = [];
for (let i = 0; i < 9; i++) XS.push(29.1 - 3.25 * (8 - i) + 0.12 * sin(i * 2.3));
for (let i = 9; i < 18; i++) XS.push(34.9 + 3.25 * (i - 9) + 0.12 * sin(i * 1.9 + 1));

function towerHeight(v) {
  v = cl(v, -1, 1);
  return v < 0 ? 16 + 64 * pow(1 + v, 1.7) : 80 + 12 * v;
}

const eqt = (yr) => 0.28 * sin(yr * 1.73 + 0.6) + 0.1 * sin(yr * 4.1 + 1.9);
const EQT0 = eqt((TAU * T_OPEN) / YEAR); // so that the opening hour angle is the 50 degrees

function sunAt(T) {
  const yr = (TAU * T) / YEAR;
  const d = ((19.4 + 3.6 * sin(yr + 1.0) + 0.4 * sin(yr * 2.37 + 2.2)) * PI) / 180;
  // the hour angle, with the equation of time blown up to 16 degrees so that a day does not come back at the hour of the last
  const h = (TAU * T) / DAY + eqt(yr) - EQT0;
  const sd = sin(d), cd = cos(d), ch = cos(h);
  const up = sin(LAT) * sd + cos(LAT) * cd * ch;
  const south = sin(LAT) * cd * ch - cos(LAT) * sd;
  const el = Math.asin(cl(up, -1, 1));
  const n = sqrt(south * south + up * up) || 1;
  return { sx: south / n, sy: up / n, el, sinEl: up };
}

// a ray from o along d, meeting the segment a-b: its distance, or -1
function hitSeg(ox, oy, dx, dy, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay;
  const den = dx * ey - dy * ex;
  if (den > -1e-9 && den < 1e-9) return -1;
  const qx = ax - ox, qy = ay - oy;
  const u = (qx * ey - qy * ex) / den;
  if (u < 0.02) return -1;
  const v = (qx * dy - qy * dx) / den;
  if (v < 0 || v > 1) return -1;
  return u;
}

export function setup(params) {
  const rnd = Math.random;
  const mirrors = [];
  for (let i = 0; i < NM; i++) {
    mirrors.push({
      x: XS[i],
      gy: mound(XS[i]),
      py: mound(XS[i]) + PED + 0.3 * sin(i * 2.1 + 0.5),
      ca: rnd() + rnd() - 1, // the aiming error, triangular in -1..1
      cw: rnd() * TAU,
      cf: 0.11 + 0.14 * rnd(),
      cb: 0.5 * (rnd() * 2 - 1),
      cg: 0.06 + 0.07 * rnd(),
      cp: rnd() * TAU,
      // the geometry of the frame
      tx: 0, ty: 1, ax: 0, ay: 0, bx: 0, by: 0, rx: 0, ry: 1, cosE: 0,
      lit: 0, pw: 0, sh: 0, uEnd: 0, uCut: -1, absorb: 1, uShCut: -1, uMax: 0,
      shI: new Float32Array(NN),
    });
  }
  params.s = {
    t: 0, T: T_OPEN, init: false,
    hue: 0, speed: 1, tower: 80, cant: 0.06,
    hueT: 0, speedT: 1, towerT: 80, cantT: 0.06,
    pal: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    mirrors,
    clouds: [], cloudClock: 0, nextCloud: 0.6,
    sun: sunAt(T_OPEN), dni: 0.7, alpha: 0.9, sunX: 60, sunY: 36, sunTrue: [60, 36],
    pth: 0.9, pnow: 0.9, spill: 0, spillT: 0,
    base: new Float32Array(W * H * 3),
    acc: new Float32Array(W * H * 3),
    sideW: new Float32Array(W),
    gTop: new Float32Array(W),
  };
  palette(0, params.s.pal);
}

function spawnCloud(S) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const sz = 0.8 + 0.5 * Math.random();
  const lobes = [];
  const nl = 5 + floor(Math.random() * 3);
  const dens = 0.4 + 0.8 * Math.random(); // thin ones only dim a shaft, thick ones put it out
  let ext = 0;
  for (let k = 0; k < nl; k++) {
    const mid = 1 - abs(k - (nl - 1) / 2) / (nl / 2); // the lobes in the middle are the big ones
    const ax = (5 + 4 * mid + 3 * Math.random()) * sz, ay = (2.4 + 2.4 * mid + 1.2 * Math.random()) * sz;
    const dx = (k - (nl - 1) / 2) * 8.5 * sz + (Math.random() - 0.5) * 5;
    const dy = 0.8 * mid * sz + (Math.random() - 0.5) * 3;
    lobes.push({ dx, dy, ax, ay, w: (0.65 + 0.5 * Math.random()) * dens });
    ext = max(ext, abs(dx) + 3.3 * ax);
  }
  S.clouds.push({
    x: dir > 0 ? -ext : W + ext,
    h: 34 + 30 * Math.random(),
    vx: dir * (5.5 + 4 * Math.random()),
    ext,
    lobes,
  });
}

// cloud density at a point (x, h over the ground)
function cloudDensity(S, x, h) {
  let d = 0;
  const cs = S.clouds;
  for (let c = 0; c < cs.length; c++) {
    const C = cs[c];
    if (abs(x - C.x) > C.ext + 2) continue;
    for (let k = 0; k < C.lobes.length; k++) {
      const L = C.lobes[k];
      const ux = (x - C.x - L.dx) / L.ax, uy = (h - C.h - L.dy) / L.ay;
      const q = ux * ux + uy * uy;
      if (q < 11) d += L.w * exp(-0.5 * q);
    }
  }
  return d;
}

function solve(S) {
  const M = S.mirrors;
  const sun = S.sun;
  const sx = sun.sx, sy = sun.sy;
  const up = sin(sun.el);
  const clar = 0.88 + 0.08 * sin((TAU * S.T) / (DAY * 2.63) + 1.1) + 0.06 * sin((TAU * S.T) / (DAY * 4.31) + 2.4);
  const dni = exp(-0.1 / (max(up, 0) + 0.06)) * sm(-0.025, 0.03, up) * clar;
  S.dni = dni;
  const Cy = S.tower + mound(TX);
  const A = 0.19 * S.cant;
  let ptot = 0, spill = 0;
  // 1: every mirror's frame
  for (let i = 0; i < NM; i++) {
    const m = M[i];
    const px = m.x, py = m.py;
    let rx = TX - px, ry = Cy - py;
    const rl = sqrt(rx * rx + ry * ry);
    rx /= rl;
    ry /= rl;
    const e = A * cl(m.ca * (0.82 + 0.18 * sin(S.t * m.cf + m.cw)) + m.cb * 0.35 * sin(S.t * m.cg + m.cp), -1.3, 1.3);
    const ce = cos(e), se = sin(e);
    const bx = rx * ce - ry * se, by = rx * se + ry * ce; // the beam, r turned by e
    let nx = sx + bx, ny = sy + by;
    const nl = sqrt(nx * nx + ny * ny) || 1;
    nx /= nl;
    ny /= nl;
    m.rx = bx;
    m.ry = by;
    m.tx = -ny;
    m.ty = nx;
    m.ax = px - m.tx * ML * 0.5;
    m.ay = py - m.ty * ML * 0.5;
    m.bx = px + m.tx * ML * 0.5;
    m.by = py + m.ty * ML * 0.5;
    m.cosE = max(0, nx * sx + ny * sy);
  }
  // 2: shading, blocking, clouds, power
  for (let i = 0; i < NM; i++) {
    const m = M[i];
    const px = m.x, py = m.py;
    // the distance along the beam to the nearest point to the receiver
    const qx = TX - px, qy = Cy - py;
    const uC = qx * m.rx + qy * m.ry;
    const dperp = abs(qx * m.ry - qy * m.rx);
    m.absorb = 1 - sm(RAD_IN, RAD_OUT, dperp);
    m.uEnd = max(uC, 1);
    let free = 0, openIn = 0;
    m.uCut = -1;
    m.uShCut = -1;
    for (let k = 0; k < NS; k++) {
      const o = ((k / (NS - 1)) * 2 - 1) * SPAN;
      const ox = px + m.tx * o, oy = py + m.ty * o;
      let blockedIn = false, uIn = 1e9, uBl = 1e9;
      for (let j = 0; j < NM; j++) {
        if (j === i) continue;
        const n = M[j];
        if (abs(n.x - px) > 9) continue;
        let u = hitSeg(ox, oy, sx, sy, n.ax, n.ay, n.bx, n.by);
        if (u > 0) {
          blockedIn = true;
          if (u < uIn) uIn = u;
        }
        u = hitSeg(ox, oy, m.rx, m.ry, n.ax, n.ay, n.bx, n.by);
        if (u > 0 && u < uC && u < uBl) uBl = u;
      }
      if (!blockedIn) openIn++;
      if (uBl > 1e8) free++;
      if (k === (NS >> 1)) {
        if (blockedIn) m.uShCut = uIn;
        if (uBl < 1e8) m.uCut = uBl;
      }
    }
    const fIn = openIn / NS, fRef = free / NS;
    // the shaft to this mirror through the clouds
    let trans = 1;
    let uMax = 0;
    if (sy > 0.02) {
      const utop = (GY - 1 - py) / sy;
      const uside = sx > 1e-4 ? (W + 3 - px) / sx : sx < -1e-4 ? (-3 - px) / sx : 1e9;
      uMax = min(utop, uside, 170);
    }
    m.uMax = uMax;
    if (uMax > 0 && S.clouds.length) {
      const sub = 4;
      const du = uMax / ((NN - 1) * sub);
      let tau = 0;
      m.shI[NN - 1] = 1;
      for (let nI = NN - 1; nI > 0; nI--) {
        for (let q = 0; q < sub; q++) {
          const u = (nI - (q + 0.5) / sub) * (uMax / (NN - 1));
          tau += KAPPA * cloudDensity(S, px + sx * u, py + sy * u) * du;
        }
        m.shI[nI - 1] = exp(-tau);
      }
      trans = m.shI[0];
    } else {
      for (let nI = 0; nI < NN; nI++) m.shI[nI] = 1;
    }
    m.sh = fIn;
    m.lit = fIn * trans;
    const full = dni * m.cosE * m.lit;
    m.pw = full * fRef * m.absorb;
    ptot += m.pw;
    spill += full * fRef * (1 - m.absorb);
  }
  S.spill = spill / NM;
  S.pnow = min(1.15, ptot / (NM * 0.72));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hueT = cl(kn[0], 0, 1);
  S.speedT = 0.316 * pow(10, cl(kn[1], 0, 4) / 4);
  S.towerT = towerHeight(kn[2]);
  S.cantT = cl(kn[3], 0, 1);
  if (!S.init) {
    S.init = true;
    S.hue = S.hueT; S.speed = S.speedT; S.tower = S.towerT; S.cant = S.cantT;
    palette(S.hue, S.pal);
    S.sun = sunAt(S.T);
    solve(S);
    S.pth = S.pnow;
    S.spillT = S.spill;
  } else {
    const k = 1 - exp(-d / 0.3);
    S.hue += (S.hueT - S.hue) * k;
    S.speed += (S.speedT - S.speed) * k;
    S.tower += (S.towerT - S.tower) * (1 - exp(-d / 0.35));
    S.cant += (S.cantT - S.cant) * (1 - exp(-d / 0.4));
    palette(S.hue, S.pal);
  }
  S.t += d;
  S.T += d * S.speed;
  // clouds ride the sun's clock
  const dc = d * S.speed;
  S.cloudClock += dc;
  for (let c = S.clouds.length - 1; c >= 0; c--) {
    const C = S.clouds[c];
    C.x += C.vx * dc;
    if ((C.vx > 0 && C.x - C.ext > W + 4) || (C.vx < 0 && C.x + C.ext < -4)) S.clouds.splice(c, 1);
  }
  if (S.cloudClock >= S.nextCloud && S.clouds.length < 3) {
    spawnCloud(S);
    S.nextCloud = S.cloudClock + 10 + 20 * Math.random();
  }
  S.sun = sunAt(S.T);
  solve(S);
  S.pth += (S.pnow - S.pth) * (1 - exp(-d / 1.5));
  S.spillT += (S.spill - S.spillT) * (1 - exp(-d / 1.5));
  // where the sun is on the panel, and where its glow sits when it is off it
  const el = S.sun.el;
  const al = atan2(S.sun.sy, S.sun.sx);
  S.alpha = al;
  const px = TX + 46 * cos(al), py = GY - 100 * sin(al);
  S.sunTrue[0] = px;
  S.sunTrue[1] = py;
  S.sunX = cl(px, -4, W + 3);
  S.sunY = cl(py, -4, GY + 1);
  S.elv = el;
}

// ---- drawing

// A soft line from (x0, y0) to (x1, y1), pixel coordinates, y down. The intensity goes from i0 to i1, the
// cross-section is Gaussian with sigma sg, and the ends are round.
function stroke(acc, x0, y0, x1, y1, i0, i1, sg, cr, cg, cb) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = sqrt(dx * dx + dy * dy);
  if (len < 1e-6 || (i0 < 0.002 && i1 < 0.002)) return;
  const ux = dx / len, uy = dy / len;
  const R = 3 * sg, R2 = R * R, k = 1 / (2 * sg * sg);
  if (abs(dy) >= abs(dx)) {
    const ya = max(0, floor(min(y0, y1) - R)), yb = min(H - 1, ceil(max(y0, y1) + R));
    const half = (R * len) / abs(dy);
    for (let y = ya; y <= yb; y++) {
      const py = y + 0.5;
      const xc = x0 + ((py - y0) * dx) / dy;
      const xa = max(0, floor(xc - half - 0.5)), xb = min(W - 1, ceil(xc + half));
      for (let x = xa; x <= xb; x++) {
        const qx = x + 0.5 - x0, qy = py - y0;
        const tc = cl(qx * ux + qy * uy, 0, len);
        const ex = qx - ux * tc, ey = qy - uy * tc;
        const d2 = ex * ex + ey * ey;
        if (d2 > R2) continue;
        const v = exp(-d2 * k) * (i0 + ((i1 - i0) * tc) / len);
        const i = (y * W + x) * 3;
        acc[i] += v * cr;
        acc[i + 1] += v * cg;
        acc[i + 2] += v * cb;
      }
    }
  } else {
    const xa0 = max(0, floor(min(x0, x1) - R)), xb0 = min(W - 1, ceil(max(x0, x1) + R));
    const half = (R * len) / abs(dx);
    for (let x = xa0; x <= xb0; x++) {
      const px = x + 0.5;
      const yc = y0 + ((px - x0) * dy) / dx;
      const ya = max(0, floor(yc - half - 0.5)), yb = min(H - 1, ceil(yc + half));
      for (let y = ya; y <= yb; y++) {
        const qx = px - x0, qy = y + 0.5 - y0;
        const tc = cl(qx * ux + qy * uy, 0, len);
        const ex = qx - ux * tc, ey = qy - uy * tc;
        const d2 = ex * ex + ey * ey;
        if (d2 > R2) continue;
        const v = exp(-d2 * k) * (i0 + ((i1 - i0) * tc) / len);
        const i = (y * W + x) * 3;
        acc[i] += v * cr;
        acc[i + 1] += v * cg;
        acc[i + 2] += v * cb;
      }
    }
  }
}

// a round soft spot
function spot(acc, cx, cy, sg, amp, cr, cg, cb) {
  const R = 3.2 * sg, k = 1 / (2 * sg * sg);
  for (let y = max(0, floor(cy - R)); y <= min(H - 1, ceil(cy + R)); y++)
    for (let x = max(0, floor(cx - R)); x <= min(W - 1, ceil(cx + R)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const v = amp * exp(-(dx * dx + dy * dy) * k);
      if (v < 0.002) continue;
      const i = (y * W + x) * 3;
      acc[i] += v * cr;
      acc[i + 1] += v * cg;
      acc[i + 2] += v * cb;
    }
}

const wy = (h) => GY - h; // world height to pixel row

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const base = S.base, acc = S.acc;
  const P = S.pal;
  const beam0 = P[0], shaft = P[1], skyT = P[2], skyH = P[3], sunC = P[4];
  const beam = [mix(beam0[0], 1, 0.1), mix(beam0[1], 1, 0.1), mix(beam0[2], 1, 0.1)];
  const sinEl = S.sun.sinEl;
  const warmF = 0.4 + 0.6 * (1 - cl(sinEl * 2.2, 0, 1));
  const dni = S.dni;
  const sxp = S.sunX;

  // ---- the sky, the ground
  const sideW = S.sideW, gt = S.gTop;
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - sxp) / 36;
    sideW[x] = 0.28 + 0.72 * exp(-0.5 * u * u);
    gt[x] = GY - mound(x + 0.5);
  }
  const edgeL = 0.5 * (0.3 + 0.7 * dni);
  for (let y = 0; y < H; y++) {
    const h = max(GY - y - 0.5, 0);
    const tt = sm(0.02, 0.9, pow(h / 112, 0.8));
    const mr = mix(skyT[0] * 2.2 + 0.04, skyT[0], tt);
    const mg = mix(skyT[1] * 2.2 + 0.03, skyT[1], tt);
    const mb = mix(skyT[2] * 1.2 + 0.07, skyT[2], tt);
    const hg = exp(-h / 19) * warmF * 0.8;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const cov = cl(y + 1 - gt[x], 0, 1); // the share of this LED that is ground
      const w = hg * sideW[x];
      let r = mr + skyH[0] * w, g = mg + skyH[1] * w, b = mb + skyH[2] * w;
      if (cov > 0) {
        const d = max(y + 0.5 - gt[x], 0);
        const fall = 1 - 0.22 * (d / 14);
        const und = 1 + 0.12 * sin(x * 0.37 + y * 0.9) * sin(x * 0.11 - y * 0.4 + 1.3);
        const e = edgeL * exp(-d / 1.3) * sideW[x];
        const gr = (0.17 + 0.03 * skyH[0]) * fall * und + skyH[0] * e;
        const gg = (0.115 + 0.02 * skyH[1]) * fall * und + skyH[1] * e * 0.8;
        const gb = (0.105 + 0.02 * skyH[2]) * fall * und + skyH[2] * e * 0.5;
        r = mix(r, gr, cov);
        g = mix(g, gg, cov);
        b = mix(b, gb, cov);
      }
      base[i] = r;
      base[i + 1] = g;
      base[i + 2] = b;
    }
  }
  // the ground takes a warm pool under every lit mirror
  for (let i = 0; i < NM; i++) {
    const m = S.mirrors[i];
    const a = 0.1 * m.lit * dni * m.cosE;
    if (a < 0.004) continue;
    for (let x = max(0, floor(m.x - 6)); x <= min(W - 1, ceil(m.x + 6)); x++)
      for (let y = max(0, floor(gt[x])); y < min(H, floor(gt[x]) + 6); y++) {
        const dx = x + 0.5 - m.x, dy = max(y + 0.5 - gt[x], 0);
        const v = a * exp(-(dx * dx) / 14 - dy / 2.2);
        const j = (y * W + x) * 3;
        base[j] += v * beam[0];
        base[j + 1] += v * beam[1] * 0.85;
        base[j + 2] += v * beam[2] * 0.6;
      }
  }

  // ---- the clouds, pale grey with the colour of the light on them
  if (S.clouds.length) {
    const cr = mix(0.46, beam[0], 0.3), cg = mix(0.48, beam[1], 0.3), cb = mix(0.58, beam[2], 0.3);
    const lightC = 0.55 + 0.45 * dni;
    for (let y = 0; y < GY; y++) {
      const h = GY - y - 0.5;
      for (let x = 0; x < W; x++) {
        const d = cloudDensity(S, x + 0.5, h);
        if (d < 0.01) continue;
        const a = 0.82 * (1 - exp(-1.25 * d));
        const i = (y * W + x) * 3;
        const topLit = 0.85 + 0.25 * sm(0, 1, (h - 40) / 40);
        base[i] = mix(base[i], cr * lightC * topLit, a);
        base[i + 1] = mix(base[i + 1], cg * lightC * topLit, a);
        base[i + 2] = mix(base[i + 2], cb * lightC * topLit, a);
      }
    }
  }

  // ---- the light
  acc.fill(0);
  // the sun: a disc when it is on the panel, a glow at the edge in its direction otherwise
  const sb = (0.35 + 0.65 * cl(sinEl * 2.6, 0, 1)) * sm(-0.03, 0.02, sinEl);
  if (sb > 0.01) {
    spot(acc, S.sunX, S.sunY, 12, 0.5 * sb * warmF + 0.18 * sb, sunC[0], sunC[1] * 0.9, sunC[2] * 0.75);
    spot(acc, S.sunX, S.sunY, 5, 0.6 * sb, sunC[0], sunC[1], sunC[2] * 0.9);
    const tx = S.sunTrue[0], ty = S.sunTrue[1];
    if (tx > -5 && tx < W + 5 && ty > -5 && ty < GY) {
      for (let y = max(0, floor(ty - 6)); y <= min(GY - 1, ceil(ty + 6)); y++)
        for (let x = max(0, floor(tx - 6)); x <= min(W - 1, ceil(tx + 6)); x++) {
          const dd = sqrt((x + 0.5 - tx) ** 2 + (y + 0.5 - ty) ** 2);
          const v = 1.5 * sb * (1 - sm(2.0, 3.6, dd));
          if (v < 0.003) continue;
          const i = (y * W + x) * 3;
          acc[i] += v * sunC[0];
          acc[i + 1] += v * sunC[1];
          acc[i + 2] += v * sunC[2] * 0.95;
        }
    }
  }
  const sx = S.sun.sx, sy = S.sun.sy;
  const Cy = S.tower + mound(TX);
  const cxp = TX + 0.0, cyp = wy(Cy);
  // the tower
  stroke(acc, cxp, cyp + 1, cxp, wy(mound(TX)) + 1, 0.32, 0.32, 0.62, 0.55, 0.6, 0.8);
  // the incident shafts, dim amber, up to the cut or the mirror
  const sh = SHAFT * dni;
  if (sy > 0.02 && sh > 0.002) {
    for (let i = 0; i < NM; i++) {
      const m = S.mirrors[i];
      if (m.uMax <= 0) continue;
      const stepU = m.uMax / (NN - 1);
      const uStop = m.uShCut > 0 ? m.uShCut : 0;
      for (let nI = NN - 1; nI > 0; nI--) {
        const uA = nI * stepU, uB = (nI - 1) * stepU;
        if (uB >= uStop) {
          stroke(acc, m.x + sx * uA, wy(m.py + sy * uA), m.x + sx * uB, wy(m.py + sy * uB), sh * m.shI[nI], sh * m.shI[nI - 1], 0.62, shaft[0], shaft[1], shaft[2]);
        } else if (uA > uStop) {
          const f = (uA - uStop) / (uA - uB);
          const iB = m.shI[nI] + (m.shI[nI - 1] - m.shI[nI]) * f;
          stroke(acc, m.x + sx * uA, wy(m.py + sy * uA), m.x + sx * uStop, wy(m.py + sy * uStop), sh * m.shI[nI], sh * iB, 0.62, shaft[0], shaft[1], shaft[2]);
        }
      }
    }
  }
  // the beams, with a slow ripple of light running up each one to the receiver
  for (let i = 0; i < NM; i++) {
    const m = S.mirrors[i];
    const full = BEAM * dni * m.cosE * m.lit;
    if (full < 0.01) continue;
    const x0 = m.x, y0 = wy(m.py);
    const uEnd = m.uEnd;
    const cut = m.uCut > 0 && m.uCut < uEnd - 0.5 ? m.uCut : -1;
    const uStop = cut > 0 ? cut : uEnd;
    const nP = max(1, ceil(uStop / 7));
    const ph = i * 1.9;
    let uPrev = 0, iPrev = full * (0.84 + 0.16 * sin(-S.t * 4.6 + ph));
    for (let k = 1; k <= nP; k++) {
      const u = (uStop * k) / nP;
      const iv = full * (0.84 + 0.16 * sin(u * 0.43 - S.t * 4.6 + ph));
      stroke(acc, x0 + m.rx * uPrev, y0 - m.ry * uPrev, x0 + m.rx * u, y0 - m.ry * u, iPrev, iv, 0.55, beam[0], beam[1], beam[2]);
      uPrev = u;
      iPrev = iv;
    }
    if (cut > 0) {
      stroke(acc, x0 + m.rx * cut, y0 - m.ry * cut, x0 + m.rx * uEnd, y0 - m.ry * uEnd, full * 0.1, full * 0.1, 0.5, beam[0], beam[1], beam[2]);
      spot(acc, x0 + m.rx * cut, y0 - m.ry * cut, 1.3, 1.1 * full * (0.6 + 0.4 * sin(S.t * 23 + i * 1.7)), 1, 0.95, 0.85);
    } else {
      const rest = 1 - m.absorb;
      if (rest > 0.03) {
        const ie = full * rest;
        stroke(acc, x0 + m.rx * uEnd, y0 - m.ry * uEnd, x0 + m.rx * (uEnd + 90), y0 - m.ry * (uEnd + 90), ie * 0.7, ie * 0.12, 0.6, beam[0], beam[1], beam[2]);
      }
    }
  }
  // the mirrors and their pedestals
  const sunMix = [mix(0.8, sunC[0], 0.45), mix(0.88, sunC[1], 0.45), mix(1.0, sunC[2], 0.45)];
  for (let i = 0; i < NM; i++) {
    const m = S.mirrors[i];
    stroke(acc, m.x, wy(m.gy) + 0.3, m.x, wy(m.py), 0.3, 0.3, 0.6, 0.45, 0.5, 0.7);
    const lit = cl(m.lit * dni * 1.5, 0, 1);
    const b = 0.26 + 0.7 * lit;
    stroke(acc, m.ax, wy(m.ay), m.bx, wy(m.by), b, b, 0.6, sunMix[0], sunMix[1], sunMix[2]);
  }
  // the receiver
  const flick = 0.78 + 0.22 * sin(S.t * 21);
  const g = cl(S.pth, 0, 1.15);
  const gs = sqrt(g);
  const core = 0.18 + 2.9 * pow(g, 0.85);
  spot(acc, cxp, cyp, 5 + 12 * S.spillT, 0.7 * S.spillT, beam[0], beam[1], beam[2] * 0.8);
  spot(acc, cxp, cyp, 6.5 + 7 * g, 0.35 * g + 0.04, beam[0], beam[1] * 0.9, beam[2] * 0.7);
  spot(acc, cxp, cyp, 2.6 + 2.4 * gs, 0.9 * g + 0.1, beam[0], beam[1], beam[2] * 0.85);
  spot(acc, cxp, cyp, 1.2 + 1.5 * gs, core * (0.94 + 0.06 * flick), 1, 0.95, 0.85);

  // ---- to the panel
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const br = base[i], bg = base[i + 1], bb = base[i + 2];
      const r = br + (1 - min(br, 1)) * (1 - exp(-GAIN * acc[i]));
      const gg = bg + (1 - min(bg, 1)) * (1 - exp(-GAIN * acc[i + 1]));
      const b = bb + (1 - min(bb, 1)) * (1 - exp(-GAIN * acc[i + 2]));
      display.setPixel(x, y, cl(r * 255 + 0.5, 0, 255) | 0, cl(gg * 255 + 0.5, 0, 255) | 0, cl(b * 255 + 0.5, 0, 255) | 0);
    }
  }
}
