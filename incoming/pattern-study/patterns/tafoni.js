// ===== Patternflow pattern =====
// Title:   Tafoni
// Family:  tafoni
// Idea:    A sandstone cliff face seen straight on while salt eats honeycomb hollows into it, the wall creeping down through the panel so pits are born at the top, deepen and merge in the middle and leave thin ridges at the bottom, lit by a low sun that swings across the sky.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: salt-weathering model of tafoni with a case-hardened rind (a hollow keeps moisture, the salt that dries there pries grains loose, a thin ridge drains and survives; after the honeycomb-weathering work of Huinink and others, 2004, from memory), a height field lit with Lambert shading, soft ambient occlusion and a short shadow march, pattern round 237
// Round:   237
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Salt=0..4, Rind=-1..1, Sun=-1..1
//
// Knob 1: Hue. Turns the rock palette round the wheel. At 0 the lit faces are coral, peach and pale gold and the shade is indigo; every other turn keeps the dark end cool or lifts it so it never goes brown.
// Knob 2: Salt. 0 to 4, opening at 2. How much salt the wall holds. At 0 only a few cavities open, slowly, and each grows 20 LEDs across; at 4 a new pit seeds on nearly every row, they grow fast and crowd into a fine honeycomb whose cells are about 6 LEDs wide with ridges 2 LEDs thick.
// Knob 3: Rind. -1 to 1, opening at 0. The hardened skin of the rock. At -1 the rock is soft: pits open everywhere, broad and shallow, the bedding hardly shows. At 1 the rind is hard and pale: few pits break through, they sink deep, the walls between them stay thick and the soft and hard layers of the bedding show as horizontal bands.
// Knob 4: Sun. -1 to 1, opening near 0. How high the sun stands. At -1 it grazes the wall at 14 degrees and every rim throws a long shadow; at 1 it is overhead at 78 degrees, shadows are gone and only the darkening of the hollows is left. Its direction swings back and forth by itself.

const W = 64, H = 128, N = W * H, WM = W - 1;
const { floor, ceil, min, max, exp, sqrt, sin, cos, tan, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// Integer hash to 0..1, and smooth value noise on it. The rock is named by its row number from the
// moment it entered at the top, so a layer of bedding keeps its place as the wall creeps down.
function hash(i, j) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x, s) {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, s), hash(i + 1, s), u);
}

// ---- colour ---------------------------------------------------------------
// The tone ramp from shade to sun, in HSV with the hue running on past 1. K1 turns it round.
const STOPS = [
  [0.0, 0.68, 0.8, 0.28],
  [0.2, 0.7, 0.62, 0.46],
  [0.38, 0.76, 0.46, 0.66],
  [0.55, 0.92, 0.48, 0.86],
  [0.72, 1.0, 0.5, 1.0],
  [0.88, 1.06, 0.42, 1.0],
  [1.0, 1.11, 0.28, 1.0],
];
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const NR = 128;
function buildRamp(ramp, shift) {
  for (let r = 0; r < NR; r++) {
    const t = r / (NR - 1);
    let k = 0;
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
    const a = STOPS[k], b = STOPS[k + 1], u = sstep(0, 1, (t - a[0]) / (b[0] - a[0]));
    const h = lerp(a[1], b[1], u) + shift;
    let s = lerp(a[2], b[2], u), v = lerp(a[3], b[3], u);
    // Dim warm colours read as brown on the panel: pale them and lift them.
    const c = h - floor(h), warm = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
    s *= 1 - 0.3 * warm * (1 - t);
    v = min(1, v * (1 + 0.5 * warm * (1 - t)));
    hsv(h, s, v, ramp, r * 3);
  }
}

// ---- blur -----------------------------------------------------------------
// A box blur of radius r (any float) that wraps across the panel and clamps down it.
const TMP = new Float32Array(N), ACC = new Float32Array(W);
function blur(src, dst, r) {
  const n = floor(r), f = r - n, inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let k = -n; k <= n; k++) s += src[o + (k & WM)];
    for (let x = 0; x < W; x++) {
      const a = src[o + ((x + n + 1) & WM)];
      TMP[o + x] = (s + f * (a + src[o + ((x - n - 1) & WM)])) * inv;
      s += a - src[o + ((x - n) & WM)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -n; k <= n; k++) s += TMP[cl(k, 0, H - 1) * W + x];
    ACC[x] = s;
  }
  for (let y = 0; y < H; y++) {
    const yp = min(H - 1, y + n + 1) * W, ym = max(0, y - n) * W, yr = max(0, y - n - 1) * W;
    const o = y * W;
    for (let x = 0; x < W; x++) {
      dst[o + x] = (ACC[x] + f * (TMP[yp + x] + TMP[yr + x])) * inv;
      ACC[x] += TMP[yp + x] - TMP[ym + x];
    }
  }
}

// ---- the wall -------------------------------------------------------------
// Pits are nuclei that grow in the rock. Each has a place on the wall (x, and Y down the rock),
// a radius that follows the logistic law dr/dt = kappa (r + r0)(1 - r / rcap) (a hollow holds more
// moisture the bigger it is, so it widens faster, until the rock around it runs out), and an age.
// Where the pits meet they leave a wall; the wall thins and sinks with the age of the pits beside it.
const SLIDE = 1.1;  // rows per second the wall creeps down
const CAPN = 260;   // most pits at once

export function setup(params) {
  const f = (n) => new Float32Array(n);
  params.t = 0;
  params.off = 0;       // how far the wall has crept: a pit at rock row Y stands at Y + off
  params.rowAcc = 0;
  params.cnt = 0;
  params.init = false;
  params.bedSeed = floor(Math.random() * 1e6);
  params.nx = f(CAPN); params.nY = f(CAPN); params.nr = f(CAPN); params.na = f(CAPN);
  params.ns1 = f(CAPN); params.ns2 = f(CAPN); params.nax = f(CAPN); params.nD = f(CAPN); params.nt = f(CAPN);
  params.m1 = f(N); params.m2 = f(N);
  params.i1 = new Int16Array(N); params.i2 = new Int16Array(N);
  params.d = f(N); params.R = f(N);
  params.hb = f(N); params.lit = f(N); params.lb = f(N); params.hb2 = f(N);
  params.stain = f(H);
  params.ramp = f(NR * 3);
  params.rampShift = -9;
  params.sunK = 0.06;
  params.k = {};
}

// Bedding: layers of harder and softer rock, a multiplier near 1 that swings by c3 either way.
function bedding(P, Y, c3) {
  const s = P.bedSeed;
  const b = 0.5 * vn(Y / 13, s + 1) + 0.3 * vn(Y / 5.1, s + 2) + 0.2 * vn(Y / 2.4, s + 3);
  return 1 + c3 * (2 * b - 1) * 1.6;
}

function knobsToK(P, kv) {
  const u2 = cl(kv[1] / 4, 0, 1), u3 = cl((kv[2] + 1) / 2, 0, 1);
  const k = P.k;
  k.u2 = u2;
  k.u3 = u3;
  // The most a lone pit grows to, as a radius in LEDs.
  k.rc = lerp(12.5, 4.2, pow(u2, 0.85)) * lerp(1.25, 0.95, u3);
  k.kappa = lerp(0.05, 0.12, u2);
  k.clear = lerp(3.8, 2.6, u2);
  k.seedsRow = lerp(0.06, 1.0, pow(u2, 1.2)) * lerp(1.5, 0.65, u3);
  k.seedsSec = 1.4 * k.seedsRow * SLIDE;
  k.topAge = 55;
  k.depth = lerp(0.6, 1, u3);
  k.bevel = lerp(3.2, 1.9, u3);
  k.w0 = lerp(4.2, 6, u3);
  k.w1 = lerp(2.3, 3.4, u3);
  k.wear = lerp(1.2, 0.5, u3);
  k.c3 = lerp(0.05, 0.4, u3);
  k.relief = lerp(4.5, 7, u3);
  return k;
}

// One step of a pit's growth: its radius after dt seconds.
function grow(P, k, Y, s1, s2, r, dt) {
  const bf = bedding(P, Y, k.c3);
  const rcap = k.rc * s2 * pow(bf, 0.7);
  const dr = r < rcap ? k.kappa * s1 * bf * (r + 1.2) * (1 - r / rcap) : -0.05 * (r - rcap);
  return r + dr * dt;
}

// A new pit. Rock that comes in at the top has been weathering above the panel, so it can arrive with age.
function addNucleus(P, k, x, Y, age, y) {
  const s1 = exp(0.25 * gauss()), s2 = exp(0.25 * gauss());
  let r = 1 + 0.8 * Math.random();
  for (let a = 0; a < age; a += 0.5) r = grow(P, k, Y, s1, s2, r, 0.5);
  if (age > 0 && !freeAt(P, k, x, y, r)) return;
  const i = P.cnt;
  if (i >= CAPN) return;
  P.cnt++;
  P.nx[i] = x;
  P.nY[i] = Y;
  P.nr[i] = r;
  P.na[i] = age;
  P.ns1[i] = s1;
  P.ns2[i] = s2;
  P.nax[i] = 1 + 0.6 * Math.random();
  P.nD[i] = 0.78 + 0.22 * Math.random();
  P.nt[i] = gauss() * 0.5;
}

// A place for a new pit is free when it clears every pit already there.
function freeAt(P, k, cx, cy, rNew) {
  const off = P.off;
  for (let j = 0; j < P.cnt; j++) {
    let dx = cx - P.nx[j];
    dx -= W * Math.round(dx / W);
    const dy = cy - (P.nY[j] + off), ax = P.nax[j];
    const e = sqrt((dx / ax) * (dx / ax) + dy * dy) - P.nr[j];
    if (e < k.clear + rNew) return false;
  }
  return true;
}

function evolve(P, k, dt) {
  const off0 = P.off;
  P.off += SLIDE * dt;
  P.rowAcc += SLIDE * dt;
  // Rock comes in at the top already dented in places.
  while (P.rowAcc >= 1) {
    P.rowAcc -= 1;
    const n = k.seedsRow, cnt = floor(n) + (Math.random() < n - floor(n) ? 1 : 0);
    for (let i = 0; i < cnt; i++) {
      const cx = Math.random() * W, cy = -3 + Math.random() * 2, a0 = k.topAge * Math.random() * Math.random();
      addNucleus(P, k, cx, cy - P.off, a0, cy);
    }
  }
  // And salt finds new places on whole rind anywhere on the wall.
  const ns = k.seedsSec * dt, cnt = floor(ns) + (Math.random() < ns - floor(ns) ? 1 : 0);
  for (let i = 0; i < cnt; i++) {
    const cx = Math.random() * W, cy = Math.random() * H;
    if (freeAt(P, k, cx, cy, 1.8)) addNucleus(P, k, cx, cy - P.off, 0, cy);
  }
  for (let j = 0; j < P.cnt; j++) {
    const Y = P.nY[j], bf = bedding(P, Y, k.c3);
    P.nr[j] = grow(P, k, Y, P.ns1[j], P.ns2[j], P.nr[j], dt);
    P.na[j] += dt;
    P.nax[j] += (min(1.9, 1 + 0.55 * (bf - 0.6)) - P.nax[j]) * min(1, 0.2 * dt);
  }
  // Pits that have crept off the bottom are forgotten.
  for (let j = P.cnt - 1; j >= 0; j--) {
    if (P.nY[j] + P.off - P.nr[j] * P.nax[j] > H + 8) {
      const last = --P.cnt;
      for (const key of ["nx", "nY", "nr", "na", "ns1", "ns2", "nax", "nD", "nt"]) P[key][j] = P[key][last];
    }
  }
  return off0;
}

export function update(dt, input, params) {
  const P = params;
  const kv = input.knobValues || [0, 2, 0, 0.06];
  dt = min(dt, 0.1);
  const k = knobsToK(P, kv);
  P.sunK = kv[3];
  if (!P.init) {
    P.init = true;
    // Let the wall weather for a while before the first frame.
    for (let i = 0; i < 360; i++) evolve(P, k, 0.5);
    P.off += 0;
  }
  P.t += dt;
  evolve(P, k, dt);
  const shift = kv[0] + 0.02;
  if (P.rampShift !== shift) {
    P.rampShift = shift;
    buildRamp(P.ramp, shift);
  }
}

// The height field and the rind at every LED, from the pits as they stand.
function carve(P, k) {
  const { m1, m2, i1, i2, d, R, nx, nY, nr, na, nax, nD } = P;
  const off = P.off, REACH = 7.5;
  m1.fill(99);
  m2.fill(99);
  i1.fill(-1);
  i2.fill(-1);
  for (let j = 0; j < P.cnt; j++) {
    const cx = nx[j], cy = nY[j] + off, r = nr[j], ax = nax[j];
    const ry = r + REACH, rx = min(30, ry * ax);
    if (cy + ry < 0 || cy - ry > H) continue;
    const y0 = max(0, floor(cy - ry)), y1 = min(H - 1, ceil(cy + ry)), x0 = floor(cx - rx), x1 = ceil(cx + rx);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, o = y * W;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / ax;
        const e = sqrt(dx * dx + dy * dy) - r;
        if (e > REACH) continue;
        const q = o + (x & WM);
        if (e < m1[q]) {
          m2[q] = m1[q];
          i2[q] = i1[q];
          m1[q] = e;
          i1[q] = j;
        } else if (e < m2[q]) {
          m2[q] = e;
          i2[q] = j;
        }
      }
    }
  }
  const bev = k.bevel, dep = k.depth, sd = P.bedSeed + 11;
  for (let q = 0; q < N; q++) {
    const j = i1[q], s1 = m1[q];
    if (j < 0 || s1 > bev) {
      d[q] = 0;
      R[q] = 1;
      continue;
    }
    const rr = nr[j];
    const Dd = nD[j] * dep * sstep(1.2, 4.6, rr);
    let pd = Dd * sstep(0, bev, -s1) * (0.86 + 0.14 * sstep(bev, bev + 6, -s1));
    let rind = sstep(-1.2, 1.5, s1);
    const jj = i2[q];
    if (jj >= 0) {
      const g = (m2[q] - s1) * 0.5;
      const ageMin = min(na[j], na[jj]);
      const wh = 0.5 * lerp(k.w1, k.w0, exp(-ageMin / 55));
      if (g < wh + 1.5) {
        const crest = (0.04 + 0.22 * (1 - exp(-ageMin / 90))) * k.wear;
        const cap = crest + 1.4 * sstep(wh - 0.7, wh + 1.5, g);
        if (pd > cap) pd = cap;
        const rc = (1 - sstep(wh - 0.7, wh + 1.5, g)) * (0.95 - 0.5 * (1 - exp(-ageMin / 80)));
        if (rc > rind) rind = rc;
      }
    }
    d[q] = pd;
    R[q] = rind;
  }
  // The grain of the sandstone: a soft mottling 3 LEDs across that sits in the rock and creeps with it.
  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5 - off) / 3, iy = floor(gy), fy = gy - iy, uy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5) / 3.048, ix = floor(gx), fx = gx - ix, ux = fx * fx * (3 - 2 * fx);
      const a = hash(ix % 21, iy + sd), b = hash((ix + 1) % 21, iy + sd), c = hash(ix % 21, iy + 1 + sd), e = hash((ix + 1) % 21, iy + 1 + sd);
      const q = y * W + x;
      d[q] += 0.05 * (lerp(lerp(a, b, ux), lerp(c, e, ux), uy) - 0.5) * (1 - 0.6 * sstep(0.4, 0.9, d[q]));
    }
  }
}

export function draw(display, params, time) {
  const P = params;
  const { d, R, hb, lit, lb, hb2, i1, ramp, nt } = P;
  const k = P.k;
  carve(P, k);
  blur(d, hb, 8);

  // The sun: a direction that swings by itself, and a height from K4.
  const sunK = cl(P.sunK, -1, 1);
  const elev = ((14 + 64 * pow((sunK + 1) / 2, 1.2)) * PI) / 180;
  const t = P.t;
  const az = -2.36 + 0.9 * sin(0.058 * t + 0.7) + 0.55 * sin(0.0371 * t + 2.1) + 0.3 * sin(0.0173 * t + 4.0);
  const lz = sin(elev), lh = cos(elev), lx = lh * cos(az), ly = lh * sin(az);
  const hx = cos(az), hy = sin(az), tanE = tan(elev);
  const rel = k.relief;
  // Shadow taps along the sun's direction, in LEDs away.
  const TAPS = [1.6, 2.8, 4.4, 6.6, 9.5, 13.5];
  const tdx = new Int32Array(6), tdy = new Int32Array(6);
  for (let a = 0; a < 6; a++) {
    tdx[a] = Math.round(hx * TAPS[a]);
    tdy[a] = Math.round(hy * TAPS[a]);
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, yu = (y > 0 ? y - 1 : 0) * W, yd = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < W; x++) {
      const i = o + x;
      const gx = (d[o + ((x + 1) & WM)] - d[o + ((x - 1) & WM)]) * 0.5 * rel;
      const gy = (d[yd + x] - d[yu + x]) * 0.5 * rel;
      let diff = ((gx * lx + gy * ly + lz) / sqrt(gx * gx + gy * gy + 1)) / lz;
      diff = diff < 0 ? 0 : diff > 1.7 ? 1.7 : diff;
      let sh = 1;
      const hp = d[i] * rel;
      for (let a = 0; a < 6; a++) {
        const qy = y + tdy[a];
        if (qy < 0 || qy >= H) continue;
        const m = hp - d[qy * W + ((x + tdx[a]) & WM)] * rel - TAPS[a] * tanE;
        const v = 1 - cl(m / 0.7, 0, 1);
        if (v < sh) sh = v;
      }
      lit[i] = diff * sh;
    }
  }
  for (let i = 0; i < N; i++) hb2[i] = lit[i] * (1 - sstep(0.3, 0.8, d[i]));
  blur(hb2, lb, 3.5);

  const rowY0 = -P.off;
  for (let y = 0; y < H; y++) {
    const o = y * W, Y = y + rowY0 + 0.5;
    const bed = 0.5 * vn(Y / 13, P.bedSeed + 1) + 0.3 * vn(Y / 5.1, P.bedSeed + 2) + 0.2 * vn(Y / 2.4, P.bedSeed + 3) - 0.5;
    // Stains: slow patches of lighter and darker rock, laid out in rock coordinates.
    const sj = Y / 17, j0 = floor(sj), sf = sj - j0, su = sf * sf * (3 - 2 * sf);
    const sd = P.bedSeed + 7;
    const bandAmp = 0.07 + 0.14 * k.u3;
    for (let x = 0; x < W; x++) {
      const i = o + x;
      const hh = d[i];
      const cav = hh - hb[i];
      const ao = 1 - 0.75 * sstep(0, 0.25, cav);
      const dp = sstep(0.25, 0.95, hh);
      let v = 0.1 + 0.12 * ao + 0.46 * lit[i] * (0.45 + 0.55 * ao);
      v *= 1 - 0.62 * dp;
      const fx = x / 16, x0 = floor(fx), xf = fx - x0, xu = xf * xf * (3 - 2 * xf);
      const sa = lerp(hash(x0 & 3, j0 + sd), hash(x0 & 3, j0 + 1 + sd), su);
      const sb = lerp(hash((x0 + 1) & 3, j0 + sd), hash((x0 + 1) & 3, j0 + 1 + sd), su);
      const ri = R[i];
      v += 0.14 * (lerp(sa, sb, xu) - 0.5) + bandAmp * bed + 0.04 * ri;
      const jn = i1[i];
      if (jn >= 0) v += 0.05 * nt[jn] * (1 - ri);
      const bounce = dp * lb[i] * 0.6;
      const idx = floor(cl(v, 0, 1) * (NR - 1) + 0.5) * 3;
      let r = ramp[idx], g = ramp[idx + 1], b = ramp[idx + 2];
      r *= 1 - 0.05 * ri;
      b *= 1 + 0.07 * ri;
      r += bounce * 0.9;
      g += bounce * 0.38;
      b += bounce * 0.3;
      display.setPixel(x, y, cl(r, 0, 1) * 255, cl(g, 0, 1) * 255, cl(b, 0, 1) * 255);
    }
  }
}
