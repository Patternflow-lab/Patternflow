// ===== Patternflow pattern =====
// Title:   Lidar Sweep
// Family:  lidar
// Idea:    The scan a multi-beam lidar leaves as its vehicle drives down a winding road through an invented landscape, every laser ray cast into the terrain and its pillars, boulders and trees, every return kept where it landed and coloured by its height above the road, seen from behind and above so that the rings of points stream down past the camera and new rings sweep out toward the horizon.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the spinning multi-beam laser scanner (David Hall, Velodyne HDL-64E, 2007) as the sensor of the DARPA Grand Challenge cars (2005), the point-cloud viewers of driving-data sets, the turbo colour map (Anton Mikhailov, Google, 2019) for height, value noise (Ken Perlin, 1985) for terrain, hashed world cells for the scenery; pattern round 208
// Round:   208
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..4, Beams=-1..1, Memory=-1..1
//
// Knob 1: Hue. Turns the height colours round the wheel. At 0 it is the turbo ramp: violet and blue on the road, cyan and green on the banks, yellow and orange on the pillars, red at the top of the tallest. It comes back to that at 1.
// Knob 2: Speed. How fast the vehicle drives, from standing still at 0 to about 10 metres a second at 4; it opens at 2, 5 metres a second. The sensor keeps turning when the car stops, at 1.6 turns a second, and a little faster as the car does, 2.75 at the opening and 3.9 at 4, so the rings stay close enough to read as rings. At 0 they stand where they are and are only redrawn.
// Knob 3: Beams. How many laser beams the sensor carries. At -1 there are 4: a ring of points at the horizon, one close to the vehicle and two beams looking up at the pillars. It opens at 0 with 10. At 1 there are 24, and the rings crowd into a bundle that fills the ground.
// Knob 4: Memory. How long a point stays lit before it has faded out: a second at -1, 3.3 at the opening 0 and 6 at 1. Short and the cloud is only the last rings and a bright fan of fresh returns; long and the road is drawn out behind the vehicle until the nearest points slide off the bottom.

const W = 64;
const H = 128;
const NPX = W * H;
const { floor, sin, cos, sqrt, abs, min, max, exp, pow, atan, imul, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const F = 44; // focal length, in LEDs
const CY = 42; // the horizon row, a third of the way down
const HC = 4.4; // camera height above the road
const BACK = 5; // how far behind the sensor the camera rides
const HS = 2.0; // sensor height above the road
const RANGE = 46; // longest return, metres
const NPT = 20000; // the ring buffer of points
const REV = 2.2; // sensor revolutions a second
const CS = 5; // scenery cell, metres
const HMAX = 16; // metres above the road that read as red

// ---------------------------------------------------------------- the world

function hash2(ix, iz) {
  let h = (imul(ix, 374761393) + imul(iz, 668265263)) | 0;
  h = imul(h ^ (h >>> 13), 1274126177);
  h = imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) * 2.3283064365386963e-10;
}

function vnoise(x, z) {
  const ix = floor(x);
  const iz = floor(z);
  let fx = x - ix;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

// The road is a curve x(z) of three sines whose wavelengths (416, 180 and 78
// metres) share no common period, and it rises and falls a little. Both are
// remembered every half metre, because the rays ask for them thousands of times.
const roadXf = (z) => 16 * sin(0.0151 * z + 0.6) + 7 * sin(0.0349 * z + 2.1) + 3 * sin(0.0803 * z + 4.0);
const roadDXf = (z) => 16 * 0.0151 * cos(0.0151 * z + 0.6) + 7 * 0.0349 * cos(0.0349 * z + 2.1) + 3 * 0.0803 * cos(0.0803 * z + 4.0);
const roadYf = (z) => 0.9 * sin(0.021 * z + 1.0) + 0.5 * sin(0.0553 * z + 2.2) + 0.25 * sin(0.131 * z + 0.4);
const RTAG = new Int32Array(4096).fill(1 << 30);
const RXT = new Float32Array(4096);
const RYT = new Float32Array(4096);
let HK = 0; // what the last ray hit: 0 the ground, 1 a thing
let ROADX = 0;
let ROADY = 0;
function roadAt(z) {
  const q = z * 2;
  const n = floor(q);
  const f = q - n;
  const i = n & 4095;
  const j = (n + 1) & 4095;
  if (RTAG[i] !== n) {
    RTAG[i] = n;
    RXT[i] = roadXf(n * 0.5);
    RYT[i] = roadYf(n * 0.5);
  }
  if (RTAG[j] !== n + 1) {
    RTAG[j] = n + 1;
    RXT[j] = roadXf((n + 1) * 0.5);
    RYT[j] = roadYf((n + 1) * 0.5);
  }
  ROADX = RXT[i] + (RXT[j] - RXT[i]) * f;
  ROADY = RYT[i] + (RYT[j] - RYT[i]) * f;
}

// Ground height at (x, z): a flat road 6.4 metres wide, banks beside it, and
// rolling hills farther out that rise to 4 or 5 metres.
function ground(x, z) {
  roadAt(z);
  const u = abs(x - ROADX);
  if (u < 3.2) return ROADY + 0.04 * (u * u) / 10;
  const b = sm(3.2, 10, u);
  const hs = sm(10, 40, u);
  const n1 = vnoise(x * 0.042 + 7.1, z * 0.042 + 3.3);
  const n2 = vnoise(x * 0.1 + 1.9, z * 0.1 + 8.4);
  const n3 = vnoise(x * 0.27 + 5.5, z * 0.27 + 2.2);
  return ROADY + b * (0.1 + 0.8 * n2 + 0.35 * (n3 - 0.5)) + hs * (n1 - 0.25) * 6;
}

// Scenery by hashed cell: at most one thing to a cell of CS metres, in groves
// and clearings, never on the road. Remembered in a direct-mapped table.
// A thing is: kind, x, z, base, radius, top, canopy radius, canopy centre, canopy half height.
const OS = 9;
const OBJ = new Float32Array(4096 * OS);
const OTX = new Int32Array(4096).fill(1 << 30);
const OTZ = new Int32Array(4096).fill(1 << 30);
function fillObj(o, ix, iz) {
  OBJ[o] = -1;
  let cx = 0;
  let cz = 0;
  let post = false;
  // Beside the road, in some rows of cells, stands a post: the cell the post
  // falls in holds it and nothing else. They are what the eye counts speed by.
  if (hash2(iz * 3 + 17, 91) < 0.42) {
    const pz = (iz + 0.2 + 0.6 * hash2(iz * 7 + 3, 57)) * CS;
    roadAt(pz);
    const px = ROADX + (hash2(iz * 5 + 1, 23) < 0.5 ? -1 : 1) * (5.4 + 1.8 * hash2(iz * 11 + 7, 5));
    if (floor(px / CS) === ix) {
      post = true;
      cx = px;
      cz = pz;
    }
  }
  if (!post) {
    const grove = sm(0.36, 0.7, vnoise(ix * 0.08 + 3.1, iz * 0.08 + 9.7));
    cx = (ix + 0.2 + 0.6 * hash2(ix * 3 + 1, iz * 5 + 2)) * CS;
    cz = (iz + 0.2 + 0.6 * hash2(ix * 5 + 7, iz * 3 + 4)) * CS;
    roadAt(cz);
    const u = abs(cx - ROADX);
    if (u < 4.3) return;
    // more of them close beside the road, where the camera sees them tall
    const near = 0.4 + 1.6 * exp(-(u - 4.3) / 10);
    if (hash2(ix * 7 + 3, iz * 13 + 5) > (0.16 + 0.6 * grove) * near) return;
  }
  const h3 = post ? (hash2(iz * 13 + 1, 7) < 0.3 ? 0.95 : 0.1) : hash2(ix * 11 + 2, iz * 7 + 9);
  const h4 = hash2(ix * 13 + 5, iz * 17 + 1);
  const h5 = hash2(ix * 19 + 3, iz * 23 + 8);
  const y0 = ground(cx, cz) - 0.15;
  OBJ[o + 1] = cx;
  OBJ[o + 2] = cz;
  OBJ[o + 3] = y0;
  if (h3 < 0.36) {
    OBJ[o] = 0; // a pillar
    OBJ[o + 4] = 0.24 + 0.26 * h4;
    OBJ[o + 5] = y0 + 6 + 17 * h5;
  } else if (h3 < 0.6) {
    OBJ[o] = 1; // a cypress, a slender rounded column
    OBJ[o + 4] = 0.1;
    OBJ[o + 5] = y0 + 0.5;
    const hc = 2.8 + 3 * h4;
    OBJ[o + 6] = 0.42 + 0.4 * h5;
    OBJ[o + 7] = y0 + 0.85 * hc;
    OBJ[o + 8] = hc;
  } else if (h3 < 0.8) {
    OBJ[o] = 2; // a boulder, half sunk
    const r = 0.5 + 0.7 * h4;
    OBJ[o + 4] = r;
    OBJ[o + 5] = y0 + 0.25 * r;
    OBJ[o + 6] = r * (0.55 + 0.3 * h5);
  } else {
    OBJ[o] = 0; // a mast, thin and very tall
    OBJ[o + 4] = 0.12;
    OBJ[o + 5] = y0 + 14 + 12 * h5;
  }
}

function tCyl(ox, oy, oz, dx, dy, dz, cx, cz, r, ya, yb) {
  const rx = ox - cx;
  const rz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-8) return Infinity;
  const b = rx * dx + rz * dz;
  const disc = b * b - a * (rx * rx + rz * rz - r * r);
  if (disc < 0) return Infinity;
  const t = (-b - sqrt(disc)) / a;
  if (t > 0.05) {
    const y = oy + dy * t;
    if (y >= ya && y <= yb) return t;
  }
  if (dy < 0) {
    const tc = (yb - oy) / dy;
    if (tc > 0.05) {
      const px = ox + dx * tc - cx;
      const pz = oz + dz * tc - cz;
      if (px * px + pz * pz <= r * r) return tc;
    }
  }
  return Infinity;
}

function tEll(ox, oy, oz, dx, dy, dz, cx, cy, cz, rh, rv) {
  const qx = (ox - cx) / rh;
  const qy = (oy - cy) / rv;
  const qz = (oz - cz) / rh;
  const ex = dx / rh;
  const ey = dy / rv;
  const ez = dz / rh;
  const a = ex * ex + ey * ey + ez * ez;
  const b = qx * ex + qy * ey + qz * ez;
  const disc = b * b - a * (qx * qx + qy * qy + qz * qz - 1);
  if (disc < 0) return Infinity;
  const t = (-b - sqrt(disc)) / a;
  return t > 0.05 ? t : Infinity;
}

function tObj(o, ox, oy, oz, dx, dy, dz) {
  const k = OBJ[o];
  const cx = OBJ[o + 1];
  const cz = OBJ[o + 2];
  const y0 = OBJ[o + 3];
  if (k === 0) return tCyl(ox, oy, oz, dx, dy, dz, cx, cz, OBJ[o + 4], y0, OBJ[o + 5]);
  if (k === 1) {
    const t1 = tCyl(ox, oy, oz, dx, dy, dz, cx, cz, OBJ[o + 4], y0, OBJ[o + 5]);
    const t2 = tEll(ox, oy, oz, dx, dy, dz, cx, OBJ[o + 7], cz, OBJ[o + 6], OBJ[o + 8]);
    return t1 < t2 ? t1 : t2;
  }
  return tEll(ox, oy, oz, dx, dy, dz, cx, OBJ[o + 5], cz, OBJ[o + 4], OBJ[o + 6]);
}

// One laser ray from (ox, oy, oz) along the unit vector (dx, dy, dz). Returns
// the distance to the first thing it meets, or -1 for nothing within RANGE.
function cast(ox, oy, oz, dx, dy, dz) {
  let tg = RANGE + 1;
  let t = 0.4;
  let tp = 0;
  while (t < RANGE) {
    const y = oy + dy * t;
    if (dy >= 0 && y > 10) break;
    const x = ox + dx * t;
    const z = oz + dz * t;
    if (y < ground(x, z)) {
      let a = tp;
      let b = t;
      for (let k = 0; k < 5; k++) {
        const m = 0.5 * (a + b);
        if (oy + dy * m < ground(ox + dx * m, oz + dz * m)) b = m;
        else a = m;
      }
      tg = 0.5 * (a + b);
      break;
    }
    tp = t;
    t += 0.45 + 0.065 * t;
  }
  const hl = sqrt(dx * dx + dz * dz);
  let to = Infinity;
  const tlim = tg < RANGE ? tg : RANGE;
  if (hl > 1e-4) {
    const hx = dx / hl;
    const hz = dz / hl;
    let ix = floor(ox / CS);
    let iz = floor(oz / CS);
    const sx = hx > 0 ? 1 : -1;
    const sz = hz > 0 ? 1 : -1;
    const tdx = hx !== 0 ? CS / abs(hx) : 1e9;
    const tdz = hz !== 0 ? CS / abs(hz) : 1e9;
    let tmx = hx !== 0 ? (hx > 0 ? (ix + 1) * CS - ox : ox - ix * CS) / abs(hx) : 1e9;
    let tmz = hz !== 0 ? (hz > 0 ? (iz + 1) * CS - oz : oz - iz * CS) / abs(hz) : 1e9;
    const slim = tlim * hl + 1;
    for (let n = 0; n < 40; n++) {
      const k = (ix & 63) | ((iz & 63) << 6);
      const o = k * OS;
      if (OTX[k] !== ix || OTZ[k] !== iz) {
        OTX[k] = ix;
        OTZ[k] = iz;
        fillObj(o, ix, iz);
      }
      if (OBJ[o] >= 0) {
        const tt = tObj(o, ox, oy, oz, dx, dy, dz);
        if (tt < to) to = tt;
      }
      const nx = tmx < tmz ? tmx : tmz;
      if (to * hl <= nx || nx > slim) break;
      if (tmx < tmz) {
        ix += sx;
        tmx += tdx;
      } else {
        iz += sz;
        tmz += tdz;
      }
    }
  }
  HK = to < tg ? 1 : 0;
  const r = to < tg ? to : tg;
  return r <= tlim ? r : -1;
}

// ---------------------------------------------------------------- colour

// Height above the road to colour, OKLCH stops (position, lightness, chroma, hue in degrees).
const STOPS = [
  [0.0, 0.4, 0.15, 303],
  [0.1, 0.53, 0.2, 268],
  [0.22, 0.67, 0.17, 247],
  [0.35, 0.8, 0.13, 205],
  [0.47, 0.86, 0.2, 155],
  [0.58, 0.9, 0.21, 128],
  [0.7, 0.89, 0.17, 100],
  [0.82, 0.76, 0.18, 62],
  [0.92, 0.65, 0.2, 38],
  [1.0, 0.6, 0.21, 28],
];
const SA = STOPS.map((s) => [s[0], s[1], s[2] * cos((s[3] * PI) / 180), s[2] * sin((s[3] * PI) / 180)]);
const gam = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
const LIN = [0, 0, 0];
function oklabLin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  LIN[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  LIN[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  LIN[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const inGamut = () => LIN[0] >= -0.001 && LIN[0] <= 1.001 && LIN[1] >= -0.001 && LIN[1] <= 1.001 && LIN[2] >= -0.001 && LIN[2] <= 1.001;

function buildLut(lut, rot) {
  const cr = cos(rot);
  const sr = sin(rot);
  for (let i = 0; i < 256; i++) {
    const u = i / 255;
    let j = 0;
    while (j < SA.length - 2 && SA[j + 1][0] <= u) j++;
    const p = SA[j];
    const q = SA[j + 1];
    const t = (u - p[0]) / (q[0] - p[0]);
    const L = p[1] + (q[1] - p[1]) * t;
    const a = p[2] + (q[2] - p[2]) * t;
    const b = p[3] + (q[3] - p[3]) * t;
    const a0 = a * cr - b * sr;
    const b0 = a * sr + b * cr;
    let f = 1;
    oklabLin(L, a0, b0);
    if (!inGamut()) {
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 9; k++) {
        const mid = (lo + hi) / 2;
        oklabLin(L, a0 * mid, b0 * mid);
        if (inGamut()) lo = mid;
        else hi = mid;
      }
      f = lo;
      oklabLin(L, a0 * f, b0 * f);
    }
    lut[i * 3] = gam(cl(LIN[0], 0, 1));
    lut[i * 3 + 1] = gam(cl(LIN[1], 0, 1));
    lut[i * 3 + 2] = gam(cl(LIN[2], 0, 1));
  }
}

// ---------------------------------------------------------------- the sensor

// n beams. The lower half look down, in rings whose radii on flat ground are
// spaced geometrically from 44 metres to 2. The rest look up, from the horizon
// to 42 degrees, and meet only the things that stand on the land. Each of
// those nods a little of its own, so that over a second the dots on a pillar
// run together into a column instead of one dot a beam.
function setBeams(S, n) {
  const nUp = Math.round(n * 0.45);
  const nDn = n - nUp;
  S.nb = n;
  S.nd = nDn;
  const T0 = Math.tan((2.6 * PI) / 180);
  const T1 = Math.tan((44 * PI) / 180);
  for (let i = 0; i < n; i++) {
    let r;
    if (i < nDn) {
      const u = nDn > 1 ? i / (nDn - 1) : 0.5;
      const te = T0 * pow(T1 / T0, u);
      S.eB[i] = -atan(te);
      S.eA[i] = 0;
      r = HS / te;
      S.rf[i] = r;
    } else {
      const j = i - nDn;
      const u = nUp > 1 ? j / (nUp - 1) : 0.5;
      S.eB[i] = ((0.8 + 41 * u) * PI) / 180;
      S.eA[i] = ((0.7 * 41) / Math.max(nUp - 1, 1) / 180) * PI;
      S.eF[i] = TAU * (0.31 + 0.137 * j + 0.019 * j * j);
      S.eP[i] = 1.7 * i;
      r = 40;
      S.rf[i] = 9;
    }
    S.eS[i] = sin(S.eB[i]);
    S.eC[i] = cos(S.eB[i]);
    // the azimuth step puts the points about 1.5 LEDs apart on the screen; the beams
    // that look up step finer, to put several dots across a pillar
    S.dz[i] = i < nDn ? cl((1.5 * (BACK + r)) / (F * r), 0.009, 0.05) : 0.036;
  }
}

export function setup(params) {
  params.s = {
    t: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    px: new Float32Array(NPT),
    py: new Float32Array(NPT),
    pz: new Float32Array(NPT),
    pt: new Float32Array(NPT).fill(-1e9),
    pc: new Uint8Array(NPT),
    pk: new Uint8Array(NPT),
    head: 0,
    lut: new Float32Array(768),
    lutRot: 99,
    ar: new Float32Array(NPX),
    ag: new Float32Array(NPX),
    ab: new Float32Array(NPX),
    nb: 0,
    nd: 0,
    eB: new Float32Array(32),
    eA: new Float32Array(32),
    eF: new Float32Array(32),
    eP: new Float32Array(32),
    eS: new Float32Array(32),
    eC: new Float32Array(32),
    rf: new Float32Array(32),
    dz: new Float32Array(32),
    acc: new Float32Array(32),
    phi: 0,
    zv: 0,
    xv: 0,
    yv: 0,
    xp: 0,
    yp: 0,
    zp: 0,
    psiV: 0,
    psiC: 0,
    sp: 2,
    mem: 3.2,
    cam: [0, 0, 0],
  };
  for (let i = 0; i < 32; i++) params.s.acc[i] = (i * 0.6180339887) % 1;
}

const speedOf = (k) => 2.6 * k;
const beamsOf = (k) => Math.round(cl(10 * pow(2.4, k), 4, 24));
const memOf = (k) => 3.2 * pow(k < 0 ? 3.2 : 1.9, k);

// Move the vehicle on by dt and let the sensor fire for that long.
function step(S, dt) {
  const t0 = S.t;
  S.t += dt;
  const t = S.t;
  S.sp += (speedOf(cl(S.k[1], 0, 4)) - S.sp) * (1 - exp(-dt / 0.35));
  const v = S.sp * (1 + 0.3 * sin(0.047 * t + 0.3) + 0.18 * sin(0.113 * t + 2.1) + 0.08 * sin(0.31 * t + 0.7));
  const zp = S.zv;
  S.xp = S.xv;
  S.yp = S.yv;
  S.zp = S.zv;
  S.zv += (v * dt) / sqrt(1 + roadDXf(zp) * roadDXf(zp));
  const zv = S.zv;
  // the car sways in its lane and yaws a little only while it is moving
  const mv = min(1, S.sp / 1.5);
  S.xv = roadXf(zv) + mv * (1.1 * sin(0.29 * t + 1.7) + 0.7 * sin(0.71 * t + 0.4));
  S.yv = roadYf(zv) + HS + 0.025 * sin(1.7 * t) + 0.015 * sin(4.3 * t + 1);
  S.psiV = atan(roadDXf(zv)) + mv * (0.06 * sin(0.37 * t + 0.6) + 0.04 * sin(0.93 * t + 2.8));
  S.psiC += (S.psiV - S.psiC) * (1 - exp(-dt / 0.7));
  if (S.first) {
    S.psiC = S.psiV;
    S.xp = S.xv;
    S.yp = S.yv;
    S.zp = S.zv;
  }

  const nb = S.nb;
  for (let k = S.nd; k < nb; k++) {
    const el = S.eB[k] + S.eA[k] * sin(S.eF[k] * t + S.eP[k]);
    S.eS[k] = sin(el);
    S.eC[k] = cos(el);
  }
  // the sensor turns a little faster as the car does, so the rings stay close enough to read as rings
  const dphi = TAU * REV * (0.75 + 0.5 * min(2, S.sp / 5.2)) * dt;
  const phi0 = S.phi;
  S.phi += dphi;
  const psiC = S.psiC;
  const px = S.px;
  const py = S.py;
  const pz = S.pz;
  const pt = S.pt;
  const pc = S.pc;
  const pk = S.pk;
  for (let k = 0; k < nb; k++) {
    const daz = S.dz[k];
    const total = S.acc[k] + dphi;
    const m = floor(total / daz);
    const el = S.eS[k];
    const ec = S.eC[k];
    const rf = S.rf[k];
    for (let j = 1; j <= m; j++) {
      const off = j * daz - S.acc[k];
      const az = phi0 + off + (Math.random() - 0.5) * 0.5 * daz;
      // Only the rays the camera can see are worth the cost: an LED wedge
      // ahead, and beside the vehicle the near rings only.
      let dl = az - psiC;
      dl -= TAU * floor((dl + PI) / TAU);
      const ad = abs(dl);
      if (ad > 0.4) {
        const a2 = ad - 0.15;
        const den = sin(a2) - 0.78 * cos(a2);
        if (den > 0.02 && rf > (4.9 / den) * 1.1) continue;
      }
      const f = off / dphi;
      const ox = S.xp + (S.xv - S.xp) * f;
      const oy = S.yp + (S.yv - S.yp) * f;
      const oz = S.zp + (S.zv - S.zp) * f;
      const dx = ec * sin(az);
      const dz = ec * cos(az);
      const r = cast(ox, oy, oz, dx, el, dz);
      if (r < 0) continue;
      const hx = ox + dx * r;
      const hy = oy + el * r;
      const hz = oz + dz * r;
      roadAt(hz);
      const hr = hy - ROADY;
      const i = S.head;
      S.head = i + 1 === NPT ? 0 : i + 1;
      px[i] = hx;
      py[i] = hy;
      pz[i] = hz;
      pt[i] = t0 + dt * f;
      pc[i] = cl(floor(255 * pow(max(hr, 0) / HMAX, 0.8)), 0, 255);
      pk[i] = HK;
    }
    S.acc[k] = total - m * daz;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.k = [cl(kn[0], 0, 1), cl(kn[1], 0, 4), cl(kn[2], -1, 1), cl(kn[3], -1, 1)];
  dt = cl(dt || 0, 0, 0.1);
  const n = beamsOf(S.k[2]);
  if (n !== S.nb) setBeams(S, n);
  const mem = memOf(S.k[3]);
  S.mem += (mem - S.mem) * (1 - exp(-dt / 0.25));
  if (S.first) {
    // Start with the cloud already drawn: the vehicle has been driving for as long as a point lives.
    S.sp = speedOf(S.k[1]);
    S.mem = mem;
    step(S, 1 / 30);
    S.first = false;
    const pre = min(mem + 0.3, 6.3);
    const steps = Math.round(pre * 30);
    for (let i = 0; i < steps; i++) step(S, 1 / 30);
    return;
  }
  step(S, dt);
}

// ---------------------------------------------------------------- the picture

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  if (abs(S.lutRot - TAU * S.k[0]) > 1e-4) {
    buildLut(S.lut, TAU * S.k[0]);
    S.lutRot = TAU * S.k[0];
  }
  const { ar, ag, ab, lut, px, py, pz, pt, pc, pk } = S;
  ar.fill(0);
  ag.fill(0);
  ab.fill(0);
  const t = S.t;
  const life = S.mem;
  const psi = S.psiC;
  const fx = sin(psi);
  const fz = cos(psi);
  const rx = cos(psi);
  const rz = -sin(psi);
  // the camera drifts a little nearer and farther, higher and lower, and the horizon with it
  const back = BACK + 0.9 * sin(0.173 * t + 0.4) + 0.5 * sin(0.067 * t + 2);
  const cy = S.yv - HS + HC + 0.45 * sin(0.131 * t + 1.1) + 0.3 * sin(0.047 * t + 3);
  const cyh = CY + 1.8 * sin(0.089 * t + 0.2) + 1.0 * sin(0.031 * t + 4);
  const cx = S.xv - back * fx;
  const cz = S.zv - back * fz;

  for (let i = 0; i < NPT; i++) {
    const age = t - pt[i];
    if (age >= life) continue;
    const ex = px[i] - cx;
    const ez = pz[i] - cz;
    const d = ex * fx + ez * fz;
    if (d < 0.9) continue;
    const inv = F / d;
    const sx = 32 + (ex * rx + ez * rz) * inv;
    if (sx < -3 || sx > 67) continue;
    const sy = cyh + (cy - py[i]) * inv;
    if (sy < -3 || sy > 131) continue;
    const a = age / life;
    const fade = 1 - sm(0.5, 1, a);
    const near = pk[i] ? cl(1.3 - d * 0.012, 0.6, 1.15) : cl(1.2 - d * 0.03, 0.18, 1.15);
    let flash = 0;
    if (age < 0.14) {
      flash = 1 - age / 0.14;
      flash *= flash;
    }
    const inten = near * fade * (0.8 + 1.1 * flash) * (pk[i] ? 1.2 : 1);
    const wo = cl(0.75 + 4 / d, 1.15, 1.5);
    const s = pk[i] ? wo * 1.7 : cl(0.6 + 12 / d, 0.85, 2.0);
    // far ring dots are drawn wider than tall so they run together into a line; things stay round
    const wx = pk[i] ? wo : s * (1 + 0.9 * cl((d - 14) / 30, 0, 1));
    const ci = pc[i] * 3;
    const cr = lut[ci] * (1 - 0.5 * flash) + 0.5 * flash;
    const cg = lut[ci + 1] * (1 - 0.5 * flash) + 0.5 * flash;
    const cb = lut[ci + 2] * (1 - 0.5 * flash) + 0.5 * flash;
    const x0 = max(0, floor(sx - wx));
    const x1 = min(W - 1, floor(sx + wx));
    const y0 = max(0, floor(sy - s));
    const y1 = min(H - 1, floor(sy + s));
    const iw = 1 / (wx * wx);
    const is = 1 / (s * s);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - sy;
      const wy = 1 - dy * dy * is;
      if (wy <= 0) continue;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - sx;
        let w = wy - dx * dx * iw;
        if (w <= 0) continue;
        w = w * w * inten;
        const p = y * W + x;
        ar[p] += cr * w;
        ag[p] += cg * w;
        ab[p] += cb * w;
      }
    }
  }

  // the sensor head itself, a small white-blue blob where the rings start
  {
    const ex = S.xv - cx;
    const ez = S.zv - cz;
    const d = ex * fx + ez * fz;
    const inv = F / d;
    const sx = 32 + (ex * rx + ez * rz) * inv;
    const sy = cyh + (cy - S.yv) * inv;
    for (let y = floor(sy - 2); y <= floor(sy + 2); y++) {
      for (let x = floor(sx - 2); x <= floor(sx + 2); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const q = 1 - ((x + 0.5 - sx) * (x + 0.5 - sx) + (y + 0.5 - sy) * (y + 0.5 - sy)) / 4.4;
        if (q <= 0) continue;
        const w = q * q * 0.9;
        const p = y * W + x;
        ar[p] += 0.75 * w;
        ag[p] += 0.9 * w;
        ab[p] += 1.0 * w;
      }
    }
  }

  for (let p = 0; p < NPX; p++) {
    let r = ar[p];
    let g = ag[p];
    let b = ab[p];
    const m = max(r, g, b);
    if (m > 0.8) {
      const sc = (0.8 + 0.2 * (1 - exp(-(m - 0.8) * 4))) / m;
      r *= sc;
      g *= sc;
      b *= sc;
    }
    display.setPixel(p % W, (p / W) | 0, r * 255, g * 255, b * 255);
  }
}
