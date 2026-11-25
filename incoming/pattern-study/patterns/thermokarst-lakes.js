// ===== Patternflow pattern =====
// Title:   Thermokarst Lakes
// Family:  thermokarst
// Idea:    Looking straight down on Arctic tundra, thaw lakes that all point the same way swell along their long axis, touch and join into peanuts, break into a creek and drain in a few seconds, and each drained basin dries to cream, greens in from its rim, keeps a pale ghost of its old shore and lets small new lakes start inside it.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the oriented thaw lakes of the Arctic coastal plain of Alaska (Black and Barksdale 1949; Carson and Hussey 1962, the wind-driven current model of why they all point one way), and the thaw-lake cycle of growth, drainage, revegetation and new lakes in old basins (Hopkins 1949; Billings and Peterson 1980), all from memory; the growth law, the drains, the basins and the palette are original, pattern round 247
// Round:   247
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1.6..8, Wind=-90..90, Density=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 it is tundra seen from orbit: khaki ground, dark teal lakes with a pale turquoise rim, cream basins that green in from the edge. At 0.25 the ground goes green and the lakes violet. At 0.5 a rust lake in a blue-grey plain, and at 1 the first picture again.
// Knob 2: Speed. 1.6 to 8, opening at 2: how many thousand years pass in a second. At 2 a new lake swells from a 3 LED dot to 8 LED across in about four seconds, then creeps on, and a lake drains every three or four seconds, collapsing over three to six. At 1.6 a drain comes every five seconds and the shores creep. At 8 the landscape runs as time-lapse, a drain a second.
// Knob 3: Wind. -90 to 90 degrees, opening at 0, with every long axis tilted 65 degrees below the horizontal and pointing down to the right. Turns the direction all lakes point. Each lake follows at its own pace, the small ones first, and a quarter turn is mostly done in five seconds. At -90 and 90 the lakes lie the same way, rising to the right at 25 degrees.
// Knob 4: Density. -1 to 1, opening at about 0.06: how many lakes the tundra carries, 15 at -1, 27 at the opening, 45 at 1. Sparse, a lake grows alone and drains before anything touches it. Crowded, lakes meet all the time and the picture is chains of peanuts and merging pairs.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// Model time is in thousand years. A second of panel time is Speed times TS of them.
const TS = 1.4;          // below 1.4 the all-minimum picture comes back too near itself within 20 s
const DM = 0.5;          // longest step the model takes at once
const PRE = 520;         // run before the first frame, about three lake lifetimes, so no lake remembers how the run began
const A0 = 1.5;          // radius of a new lake, 3 LED across
const WIND0 = (65 * PI) / 180;  // the long axes at Wind 0, down to the right on a panel that stands tall
const AMAXCAP = 20;      // 40 LED long, the longest a lake gets
const BASIN_LIFE = 200;  // a basin keeps its ghost this long, then is forgotten
const MAXB = 44;

// Two creeks, the drains. Each is a line down the panel whose two bends slide at their own slow rates, so the creek meanders
// for ever and never comes back. Each covers part of the height, so one end is a headwater and the tundra is not cut into strips.
const CRK = [
  { x0: 13, sl: 0.16, y0: -12, y1: 96, a1: 5.5, k1: (2 * PI) / 57, p1: 0.6, w1: 0.0042, a2: 2.4, k2: (2 * PI) / 23, p2: 2.1, w2: -0.0067 },
  { x0: 52, sl: -0.12, y0: 34, y1: 142, a1: 4.5, k1: (2 * PI) / 66, p1: 3.3, w1: -0.0035, a2: 2.2, k2: (2 * PI) / 27, p2: 0.4, w2: 0.0061 },
];
const CA8 = [], SA8 = [];
for (let k = 0; k < 8; k++) (CA8.push(cos((k * PI) / 4)), SA8.push(sin((k * PI) / 4)));

// ---- colour -----------------------------------------------------------------
// 0..255. The firmware raises saturation by 1.62 on the panel, so the ground is kept near grey to land on khaki. The hue knob
// turns the finished picture about the grey axis at the end, so these are the colours at Hue 0.
const C_MOSS = [104, 114, 92], C_OLIVE = [118, 117, 98], C_TAN = [136, 128, 106];
const C_DAMP = [88, 104, 84];                 // wet sedge along a shore
const C_MUD = [72, 90, 82], C_CREAM = [186, 174, 134], C_GREEN = [90, 118, 70], C_GHOST = [172, 170, 128];
const C_CREEK = [14, 74, 90];
const C_RING = [104, 188, 176], C_MID = [26, 108, 122], C_DEEP = [6, 38, 58];

// ---- noise ------------------------------------------------------------------
let SEED = 0;
function hash2(ix, iy) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  SEED = (rnd() * 2147483647) | 0;
  const nz = new Float32Array(W * H), nzb = new Float32Array(W * H), ground = new Float32Array(W * H * 3);
  const CELL = 12;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5, p = y * W + x;
      // the shore noise: coarse swells and a small ripple, -1 to 1
      nz[p] = (vnoise(px / 11 + 40, py / 11) * 2 - 1) * 0.75 + (vnoise(px / 5.5 + 9, py / 5.5 + 71) * 2 - 1) * 0.25;
      nzb[p] = (vnoise(px / 11 + 140, py / 11 + 60) * 2 - 1) * 0.75 + (vnoise(px / 5.5 + 29, py / 5.5 + 17) * 2 - 1) * 0.25;
      // the ground: broad patches of moss, olive and tan, kept close in tone so the lakes carry the picture
      const gt = vnoise(px / 26 + 5, py / 26 + 11) * 0.62 + vnoise(px / 10 + 33, py / 10 + 2) * 0.38;
      const t = cl((gt - 0.25) / 0.5, 0, 1);
      const w = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const A = t < 0.5 ? C_MOSS : C_OLIVE, B = t < 0.5 ? C_OLIVE : C_TAN;
      // ice-wedge polygons: a faint net of 12 LED cells, the trough a little darker
      const cx = floor(px / CELL), cy = floor(py / CELL);
      let f1 = 1e9, f2 = 1e9;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i, gy = cy + j;
          const dx = (gx + 0.15 + 0.7 * hash2(gx + 500, gy)) * CELL - px, dy = (gy + 0.15 + 0.7 * hash2(gx, gy + 900)) * CELL - py;
          const d = sqrt(dx * dx + dy * dy);
          if (d < f1) ((f2 = f1), (f1 = d));
          else if (d < f2) f2 = d;
        }
      }
      const tr = 1 - sstep(0.3, 2.6, f2 - f1);
      const k = 1 - 0.085 * tr;
      for (let c = 0; c < 3; c++) ground[p * 3 + c] = (A[c] + (B[c] - A[c]) * w) * k;
    }
  }
  params.st = {
    k: [0, 2, 0, 0.06], init: false,
    m: 0, cm: -99, wind: WIND0,
    lakes: [], basins: [],
    nz, nzb, ground,
    crx: [new Float32Array(H), new Float32Array(H)], cri: [new Float32Array(H), new Float32Array(H)],
    cci: 0,
    mult: new Float32Array(80),
    lk: new Float64Array(80 * 12), ba: new Float64Array(MAXB * 8),
  };
}

// Where each creek runs on each row, and how much a horizontal step overstates the distance to it.
function creekRows(st) {
  const m = st.m;
  for (let c = 0; c < 2; c++) {
    const q = CRK[c], X = st.crx[c], I = st.cri[c];
    for (let y = 0; y < H; y++) {
      const yy = y + 0.5;
      const p1 = q.k1 * yy + q.p1 + q.w1 * m, p2 = q.k2 * yy + q.p2 + q.w2 * m;
      X[y] = q.x0 + q.sl * (yy - 64) + q.a1 * sin(p1) + q.a2 * sin(p2);
      const s = q.sl + q.a1 * q.k1 * cos(p1) + q.a2 * q.k2 * cos(p2);
      I[y] = 1 / sqrt(1 + s * s);
    }
  }
  st.cm = m;
}
// Distance to a creek, which ends in a round cap where its range of rows ends.
function creekDist(st, x, y) {
  const yi = cl(floor(y), 0, H - 1);
  let best = 1e9;
  for (let c = 0; c < 2; c++) {
    const q = CRK[c], gy = max(q.y0 - y, 0, y - q.y1), dx = (x - st.crx[c][yi]) * st.cri[c][yi], d = sqrt(dx * dx + gy * gy);
    if (d < best) ((best = d), (st.cci = c));
  }
  return best;
}

// The long axis against the short: a new lake is round and stretches as it grows, the long axis faster.
const ratioOf = (a, r) => 1 - (1 - r) * sstep(2.2, 9, a);
const nzAmp = (b) => 2.2 * min(1, b / 6);

function newLake(st, x, y, cap) {
  const dev = gauss() * 0.07;
  const amax = min(cap, 3 + 16 * pow(rnd(), 1.6));
  st.lakes.push({
    x, y, a: A0, b: A0, amax, r: 0.4 + 0.22 * rnd(), ang: st.wind + dev, dev, c: (rnd() - 0.5) * 0.34,
    state: 0, t: 0, T: 0, hz: 0.6 + 0.9 * rnd(), gr: 0.8 + 0.45 * rnd(), cas: 0,
    a0: A0, b0: A0, x0: x, y0: y, ox: 0, oy: 0, has: 0, ca: 1, sa: 0,
  });
}

// A lake lets go. The basin takes the shape it had, and the lake shrinks inside it.
function startDrain(st, l, ex, ey) {
  l.state = 1;
  l.t = 0;
  l.T = 8 + 8 * rnd();
  l.a0 = l.a; l.b0 = l.b; l.x0 = l.x; l.y0 = l.y;
  const outlet = ex !== undefined;
  l.has = outlet ? 1 : 0;
  if (outlet) ((l.ox = ex), (l.oy = ey));
  if (st.basins.length >= MAXB) st.basins.shift();
  st.basins.push({ x: l.x, y: l.y, a: l.a, b: l.b, ang: l.ang, c: l.c, amp: nzAmp(l.b), age: 0, has: outlet ? 1 : 0, sx: outlet ? l.sx : 0, sy: outlet ? l.sy : 0, ci: outlet ? st.cci : 0, ey: outlet ? ey : 0 });
}

function birth(st, cap) {
  if (st.lakes.length > 66) return false;
  for (let tries = 0; tries < 16; tries++) {
    let x, y, lim = cap;
    const bs = st.basins;
    if (bs.length && rnd() < 0.55) {
      const B = bs[(rnd() * bs.length) | 0];
      if (B.age < 20 || B.age > 130) continue;
      const u = (rnd() * 2 - 1) * 0.55 * B.a, v = (rnd() * 2 - 1) * 0.55 * B.b, ca = cos(B.ang), sa = sin(B.ang);
      x = B.x + u * ca - v * sa;
      y = B.y + u * sa + v * ca;
      lim = max(5, 0.8 * B.a);
    } else {
      x = 5 + rnd() * 54;
      y = -2 + rnd() * 132;
    }
    if (creekDist(st, x, y) < 9) continue;
    let ok = true;
    for (const l of st.lakes) {
      const dx = x - l.x, dy = y - l.y, ca = cos(l.ang), sa = sin(l.ang);
      const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const A = max(l.a, 1) + 4, B2 = max(l.b, 1) + 4;
      if ((u * u) / (A * A) + (v * v) / (B2 * B2) < 1) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    newLake(st, x, y, lim);
    return true;
  }
  return false;
}

function stepModel(st, dm, nstar) {
  const L = st.lakes, n = L.length;
  st.m += dm;
  if (st.m - st.cm > 2) creekRows(st);
  const wt = st.wind;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    // each lake turns to the wind on its own schedule, the big ones slowest
    let d = wt + l.dev - l.ang;
    d = ((((d + PI / 2) % PI) + PI) % PI) - PI / 2;
    l.ang += d * (1 - exp(-dm / (2.5 + 0.45 * l.a)));
    l.ca = cos(l.ang); l.sa = sin(l.ang);
    st.mult[i] = 1;
  }
  // pairs: the gap along the line of centres, between the two ellipses
  for (let i = 0; i < n; i++) {
    const A = L[i];
    for (let j = i + 1; j < n; j++) {
      const B = L[j];
      const dx = B.x - A.x, dy = B.y - A.y, D2 = dx * dx + dy * dy, rr = (A.a + B.a) * 1.1 + 8;
      if (D2 > rr * rr) continue;
      const D = sqrt(D2) + 1e-6, ux = dx / D, uy = dy / D;
      const aa = max(A.a, 0.3), ab = max(A.b, 0.3), ba = max(B.a, 0.3), bb = max(B.b, 0.3);
      const p = ux * A.ca + uy * A.sa, q = -ux * A.sa + uy * A.ca;
      const p2 = ux * B.ca + uy * B.sa, q2 = -ux * B.sa + uy * B.ca;
      const ra = (aa * ab) / sqrt(ab * ab * p * p + aa * aa * q * q), rb = (ba * bb) / sqrt(bb * bb * p2 * p2 + ba * ba * q2 * q2);
      const gap = D - ra - rb;
      if (A.state === 0 && B.state === 0) {
        const f = cl((gap + 6) / 6, 0.25, 1);
        if (f < st.mult[i]) st.mult[i] = f;
        if (f < st.mult[j]) st.mult[j] = f;
        // a lake whose centre sits deep inside another is taken into it
        const big = ra >= rb ? A : B, small = ra >= rb ? B : A;
        if (D < 0.6 * max(ra, rb)) {
          big.amax = min(AMAXCAP, sqrt(big.amax * big.amax + 0.5 * small.amax * small.amax));
          small.state = 2; small.t = 0; small.T = 5; small.a0 = small.a; small.b0 = small.b;
        }
      } else if (gap < 1.2) {
        // a lake that is joined to one draining may go down with it
        const w = A.state === 1 ? B : A;
        if (w.state === 0 && w.cas === 0) w.cas = rnd() < 0.15 ? 1 + 4 * rnd() : -1;
      }
    }
  }
  // the more water there is, the more likely a drain: area against what nstar lakes of 7 by 4 LED would cover
  let n0 = 0, area = 0;
  for (let i = 0; i < n; i++) if (L[i].state === 0) (n0++, (area += L[i].a * L[i].b));
  const crowd = cl(area / (28 * nstar), 0.5, 2.5);
  for (let i = 0; i < n; i++) {
    const l = L[i];
    if (l.state === 0) {
      // growth slows as a lake nears its own limit, and when it touches a neighbour
      const g = 0.3 * l.gr * (0.08 + 0.92 * max(0, 1 - l.a / l.amax)) * (1 + 1.2 * exp(-(l.a - A0) / 1.5)) * st.mult[i];
      l.a = min(AMAXCAP, l.a + g * dm);
      l.b = l.a * ratioOf(l.a, l.r);
      if (l.cas > 0) {
        l.cas -= dm;
        if (l.cas <= 0) startDrain(st, l);
        continue;
      }
      // a chance of a drain that grows with size
      const lam = l.a > 4.5 ? 0.0005 * l.hz * pow(l.a / 7, 3) * crowd * crowd * crowd : 0;
      if (rnd() < lam * dm) {
        startDrain(st, l);
        continue;
      }
      // the rim comes within a few LED of a creek: it breaks into it
      if (l.a > 3.5) {
        let best = 1e9, bx = 0, by = 0, bc = 0;
        for (let k = 0; k < 8; k++) {
          const u = l.a * CA8[k], v = l.b * SA8[k];
          const x = l.x + u * l.ca - v * l.sa, y = l.y + u * l.sa + v * l.ca;
          const d = creekDist(st, x, y);
          if (d < best) ((best = d), (bx = x), (by = y), (bc = st.cci));
        }
        if (best - 1 < 2.6 && rnd() < 0.02 * dm) {
          st.cci = bc;
          l.sx = bx; l.sy = by;
          startDrain(st, l, st.crx[bc][cl(floor(by), 0, H - 1)], by);
        }
      }
    } else if (l.state === 1) {
      l.t += dm;
      const p = l.t / l.T, s = pow(max(0, 1 - p), 1.25);
      l.a = l.a0 * s; l.b = l.b0 * s;
      if (l.has) {
        l.x = l.x0 + (l.ox - l.x0) * 0.45 * (1 - s);
        l.y = l.y0 + (l.oy - l.y0) * 0.45 * (1 - s);
      }
    } else {
      l.t += dm;
      const s = max(0, 1 - l.t / l.T);
      l.a = l.a0 * s; l.b = l.b0 * s;
    }
  }
  // remove what is gone, in place
  let w = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    if (l.state !== 0 && l.t >= l.T) continue;
    L[w++] = l;
  }
  L.length = w;
  const B = st.basins;
  let wb = 0;
  for (let i = 0; i < B.length; i++) {
    B[i].age += dm;
    if (B[i].age < BASIN_LIFE) B[wb++] = B[i];
  }
  B.length = wb;
  // new lakes at a rate that holds the count: what the drains take, and more when short
  const lam = max(0, nstar / 400 + 0.03 * (nstar - n0));
  if (rnd() < lam * dm) birth(st, 18);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st;
  const kv = input && Array.isArray(input.knobValues) ? input.knobValues : st.k;
  st.k = [+kv[0] || 0, cl(+kv[1] || 2, 1.6, 8), +kv[2] || 0, +kv[3] || 0];
  st.wind = WIND0 + (cl(st.k[2], -90, 90) * PI) / 180;
  const nstar = 26 * exp(0.55 * cl(st.k[3], -1, 1));
  if (!st.init) {
    st.init = true;
    creekRows(st);
    for (let i = 0; i < nstar * 0.6; i++) birth(st, 18);
    while (st.m < PRE) stepModel(st, DM, nstar);
  }
  const dm = cl(dt || 0, 0, 0.1) * st.k[1] * TS;
  if (dm > 0) {
    const ns = max(1, Math.ceil(dm / DM));
    for (let i = 0; i < ns; i++) stepModel(st, dm / ns, nstar);
  }
}

// ---- drawing ----------------------------------------------------------------
const mix = (a, b, t) => a + (b - a) * t;

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  creekRows(st);
  const { nz, nzb, ground, crx, cri } = st;
  // the shores drift through two fixed fields, so that they erode and fill in as slowly as the lakes grow
  const nc = cos(0.028 * st.m), ns = sin(0.028 * st.m);
  const lakes = st.lakes, basins = st.basins;
  // flatten what the pixel loop needs
  const NL = lakes.length, lk = st.lk;
  for (let i = 0; i < NL; i++) {
    const l = lakes[i], o = i * 12;
    const a = max(l.a, 0.3), b = max(l.b, 0.3), ca = cos(l.ang), sa = sin(l.ang);
    lk[o] = l.x; lk[o + 1] = l.y; lk[o + 2] = ca; lk[o + 3] = sa;
    lk[o + 4] = 1 / (a * a); lk[o + 5] = 1 / (b * b); lk[o + 6] = 1 / (a * a * a * a); lk[o + 7] = 1 / (b * b * b * b);
    lk[o + 8] = l.c / a;
    const R = a * (1 + abs(l.c)) + 7;
    lk[o + 9] = R * R;
    lk[o + 10] = nzAmp(b);
    lk[o + 11] = b;
  }
  const NB = basins.length, ba = st.ba;
  for (let i = 0; i < NB; i++) {
    const B = basins[i], o = i * 8, a = B.a, b = B.b;
    ba[o] = B.x; ba[o + 1] = B.y; ba[o + 2] = cos(B.ang); ba[o + 3] = sin(B.ang);
    ba[o + 4] = 1 / (a * a); ba[o + 5] = 1 / (b * b);
    const R = a * (1 + abs(B.c)) + 6;
    ba[o + 6] = R * R;
    ba[o + 7] = B.amp;
  }
  // the channels from the lakes that broke into a creek, from the rim to the creek
  const chans = [];
  for (let i = 0; i < NB; i++) {
    const B = basins[i];
    if (!B.has || B.age > 150) continue;
    const ex = crx[B.ci][cl(floor(B.ey), 0, H - 1)];
    const al = sstep(0, 3, B.age) * (1 - sstep(60, 150, B.age));
    chans.push({ x1: B.sx, y1: B.sy, x2: ex, y2: B.ey, al });
  }
  // the hue turn, as the usual luma-keeping matrix about the grey axis
  const th = 2 * PI * cl(st.k[0], 0, 1), cs = cos(th), sn = sin(th);
  const M0 = 0.213 + cs * 0.787 - sn * 0.213, M1 = 0.715 - cs * 0.715 - sn * 0.715, M2 = 0.072 - cs * 0.072 + sn * 0.928;
  const M3 = 0.213 - cs * 0.213 + sn * 0.143, M4 = 0.715 + cs * 0.285 + sn * 0.14, M5 = 0.072 - cs * 0.072 - sn * 0.283;
  const M6 = 0.213 - cs * 0.213 - sn * 0.787, M7 = 0.715 - cs * 0.715 + sn * 0.715, M8 = 0.072 + cs * 0.928 + sn * 0.072;

  const K = 2.4; // how far two shores pull together into a neck
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    const cx0 = crx[0][y], cx1 = crx[1][y], ci0 = cri[0][y], ci1 = cri[1][y];
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, p = y * W + x, nzv = nz[p] * nc + nzb[p] * ns;
      // the lakes: one field, the smooth minimum of every lake's distance to its shore
      let F = 1e3;
      for (let i = 0; i < NL; i++) {
        const o = i * 12, dx = px - lk[o], dy = py - lk[o + 1];
        if (dx * dx + dy * dy > lk[o + 9]) continue;
        const ca = lk[o + 2], sa = lk[o + 3];
        const u = dx * ca + dy * sa, v = -dx * sa + dy * ca - lk[o + 8] * u * u;
        const e2 = u * u * lk[o + 4] + v * v * lk[o + 5];
        let d;
        if (e2 < 1e-6) d = -lk[o + 11];
        else {
          const e = sqrt(e2);
          d = (e2 - e) / sqrt(u * u * lk[o + 6] + v * v * lk[o + 7] + 1e-9);
        }
        d += nzv * lk[o + 10];
        const h = max(K - abs(F - d), 0) / K;
        F = (d < F ? d : F) - h * h * K * 0.25;
      }
      // the ground, then what a drained lake left on it
      let r = ground[p * 3], g = ground[p * 3 + 1], b = ground[p * 3 + 2];
      let bAge = 1e9, bBd = 0, bBb = 0, ghost = 0;
      for (let i = 0; i < NB; i++) {
        const o = i * 8, dx = px - ba[o], dy = py - ba[o + 1];
        if (dx * dx + dy * dy > ba[o + 6]) continue;
        const B = basins[i], ca = ba[o + 2], sa = ba[o + 3];
        const u = dx * ca + dy * sa, v = -dx * sa + dy * ca - (B.c / B.a) * u * u;
        const e2 = u * u * ba[o + 4] + v * v * ba[o + 5];
        let d;
        if (e2 < 1e-6) d = -B.b;
        else {
          const e = sqrt(e2);
          d = (e2 - e) / sqrt(u * u / (B.a * B.a * B.a * B.a) + v * v / (B.b * B.b * B.b * B.b) + 1e-9);
        }
        d += nzv * ba[o + 7];
        if (d < 0.9 && B.age < bAge) ((bAge = B.age), (bBd = d), (bBb = B.b));
        if (d > -3 && d < 3) {
          const gh = exp(-(d * d) / 1.3) * (1 - sstep(70, BASIN_LIFE, B.age)) * sstep(10, 40, B.age);
          if (gh > ghost) ghost = gh;
        }
      }
      if (bAge < 1e8) {
        const cov = cl(0.5 - bBd / 1.2, 0, 1);
        const dry = sstep(2, 38, bAge);
        let pr = mix(C_MUD[0], C_CREAM[0], dry), pg = mix(C_MUD[1], C_CREAM[1], dry), pb = mix(C_MUD[2], C_CREAM[2], dry);
        // the green comes in from the rim: the front is how deep it has got
        const front = cl((bAge - 14) / 120, 0, 1.15) * (bBb + 3.5) - 0.6;
        const gw = sstep(-1, 1.6, front + bBd);
        pr = mix(pr, C_GREEN[0], gw); pg = mix(pg, C_GREEN[1], gw); pb = mix(pb, C_GREEN[2], gw);
        const wf = cov * (1 - sstep(90, 190, bAge));
        r = mix(r, pr, wf); g = mix(g, pg, wf); b = mix(b, pb, wf);
      }
      if (ghost > 0.01) {
        const t = ghost * 0.42;
        r = mix(r, C_GHOST[0], t); g = mix(g, C_GHOST[1], t); b = mix(b, C_GHOST[2], t);
      }
      // damp ground along the shore
      if (F < 3.2) {
        const t = sstep(3.2, 0.2, F) * 0.42;
        r = mix(r, C_DAMP[0], t); g = mix(g, C_DAMP[1], t); b = mix(b, C_DAMP[2], t);
      }
      // creeks, and the channels cut by lakes that drained into them
      let cc = 0;
      {
        const g0 = max(CRK[0].y0 - py, 0, py - CRK[0].y1), g1 = max(CRK[1].y0 - py, 0, py - CRK[1].y1);
        const d0 = (px - cx0) * ci0, d1 = (px - cx1) * ci1;
        const e0 = sqrt(d0 * d0 + g0 * g0), e1 = sqrt(d1 * d1 + g1 * g1);
        // the headwater end is thinner
        const h0 = 0.45 + 0.55 * sstep(CRK[0].y1 + 4, CRK[0].y1 - 18, py), h1 = 0.45 + 0.55 * sstep(CRK[1].y0 - 4, CRK[1].y0 + 18, py);
        cc = max(cl(0.5 - (e0 - h0) / 1.1, 0, 1), cl(0.5 - (e1 - h1) / 1.1, 0, 1));
      }
      for (let i = 0; i < chans.length; i++) {
        const c = chans[i];
        const sx = c.x2 - c.x1, sy = c.y2 - c.y1, l2 = sx * sx + sy * sy + 1e-6;
        const t = cl(((px - c.x1) * sx + (py - c.y1) * sy) / l2, 0, 1);
        const ex = px - (c.x1 + sx * t), ey = py - (c.y1 + sy * t);
        const v = cl(0.5 - (sqrt(ex * ex + ey * ey) - 0.8) / 1.1, 0, 1) * c.al;
        if (v > cc) cc = v;
      }
      if (cc > 0) {
        const t = cc * 0.95;
        r = mix(r, C_CREEK[0], t); g = mix(g, C_CREEK[1], t); b = mix(b, C_CREEK[2], t);
      }
      // the water: a pale rim over the shallows, mid teal, a dark core
      const cw = cl(0.5 - F / 1.2, 0, 1);
      if (cw > 0) {
        const d = -F, m1 = sstep(0.8, 2.4, d), m2 = sstep(2.4, 6.5, d);
        const wr = mix(mix(C_RING[0], C_MID[0], m1), C_DEEP[0], m2);
        const wg = mix(mix(C_RING[1], C_MID[1], m1), C_DEEP[1], m2);
        const wb = mix(mix(C_RING[2], C_MID[2], m1), C_DEEP[2], m2);
        r = mix(r, wr, cw); g = mix(g, wg, cw); b = mix(b, wb, cw);
      }
      const R = r * M0 + g * M1 + b * M2, G = r * M3 + g * M4 + b * M5, B2 = r * M6 + g * M7 + b * M8;
      display.setPixel(x, y, cl(R + 0.5, 0, 255) | 0, cl(G + 0.5, 0, 255) | 0, cl(B2 + 0.5, 0, 255) | 0);
    }
  }
}
