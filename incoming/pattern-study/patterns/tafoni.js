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
const { floor, ceil, round, min, max, abs, exp, sqrt, sin, cos, tan, pow, PI } = Math;
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
    let h = lerp(a[1], b[1], u) + shift, s = lerp(a[2], b[2], u), v = lerp(a[3], b[3], u);
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
    const yp = min(H - 1, y + n + 1) * W, ym = max(0, y - n) * W, yq = min(H - 1, y + n + 1) * W, yr = max(0, y - n - 1) * W;
    const o = y * W;
    for (let x = 0; x < W; x++) {
      dst[o + x] = (ACC[x] + f * (TMP[yq + x] + TMP[yr + x])) * inv;
      ACC[x] += TMP[yp + x] - TMP[ym + x];
    }
  }
}

// ---- the wall -------------------------------------------------------------
const SIM = 20;   // weathering steps per second
const SLIDE = 1.1; // rows per second the wall creeps down

export function setup(params) {
  params.t = 0;
  params.acc = 0;
  params.slide = 0;
  params.rows = 0;
  params.init = false;
  params.bedSeed = floor(Math.random() * 1e6);
  params.d = new Float32Array(N);   // depth of rock removed, 0 at the rind, 1 at the deepest floor
  params.R = new Float32Array(N).fill(1); // the rind: 1 is whole, 0 is breached
  params.g = new Float32Array(N);   // grain of the rock
  params.b1 = new Float32Array(N);
  params.c = new Float32Array(N);
  params.bm = new Float32Array(N);
  params.hI = new Float32Array(N);
  params.hb = new Float32Array(N);
  params.rI = new Float32Array(N);
  params.gI = new Float32Array(N);
  params.lit = new Float32Array(N);
  params.lb = new Float32Array(N);
  params.hb2 = new Float32Array(N);
  params.bedS = new Float32Array(H);
  params.stain = new Float32Array(H * 5);
  params.ramp = new Float32Array(NR * 3);
  params.rampShift = -9;
  params.k = { u2: 0.5, u3: 0.5 };
}

function bedding(P, rr, c3) {
  const s = P.bedSeed;
  const b = 0.5 * vn(rr / 13, s + 1) + 0.3 * vn(rr / 5.1, s + 2) + 0.2 * vn(rr / 2.4, s + 3);
  return 1 + c3 * (2 * b - 1) * 1.6;
}

// A new pit: the rind is breached in an ellipse and the rock under it is dented.
function sow(P, cx, cy, r, depth, ex) {
  const { d, R } = P;
  const rx = r * ex, x0 = floor(cx - rx - 1), x1 = ceil(cx + rx + 1), y0 = max(0, floor(cy - r - 1)), y1 = min(H - 1, ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / r;
      const q = sqrt(dx * dx + dy * dy);
      const f = 1 - sstep(0.55, 1.1, q);
      if (f <= 0) continue;
      const o = y * W + (x & WM);
      if (depth * f > d[o]) d[o] = depth * f;
      if (1 - f < R[o]) R[o] = 1 - f;
    }
  }
}

const seedRadius = (k) => (1.3 + 1.4 * (1 - k.u2)) * exp(0.45 * gauss()) * k.seedR;
function newSeed(P, k, cy) {
  sow(P, Math.random() * W, cy, cl(seedRadius(k), 1.1, 8), 0.45 + 0.4 * Math.random(), 1 + 0.7 * Math.random());
}

// Move the wall down by one row: everything shifts, and a fresh rind comes in at the top.
function shiftDown(P, k) {
  const { d, R, g } = P;
  d.copyWithin(W, 0, N - W);
  R.copyWithin(W, 0, N - W);
  g.copyWithin(W, 0, N - W);
  P.rows++;
  const row = new Float32Array(W);
  for (let x = 0; x < W; x++) row[x] = gauss();
  for (let x = 0; x < W; x++) {
    d[x] = 0;
    R[x] = 1;
    g[x] = 0.55 * g[W + x] + 0.45 * (row[x] + 0.5 * (row[(x + 1) & WM] + row[(x - 1) & WM])) * 0.6;
  }
  // The rock comes in already dented in places.
  const n = k.seedsRow;
  const cnt = floor(n) + (Math.random() < n - floor(n) ? 1 : 0);
  for (let i = 0; i < cnt; i++) newSeed(P, k, Math.random() * 1.5);
}

function weather(P, k, f) {
  const { d, R, b1, c, bm, bedS } = P;
  blur(d, b1, k.rho);
  for (let i = 0; i < N; i++) {
    const v = d[i] - b1[i];
    c[i] = v > 0 ? v : 0;
  }
  blur(c, bm, k.rhoM);
  const q = k.wallQ, q2 = round(q * 0.72), da = k.deepA, db = k.deepB - k.deepA;
  for (let y = 0; y < H; y++) {
    const bs = bedS[y], o = y * W;
    const yu = y >= q ? (y - q) * W : -1, yd = y + q < H ? (y + q) * W : -1;
    const yu2 = y >= q2 ? (y - q2) * W : -1, yd2 = y + q2 < H ? (y + q2) * W : -1;
    for (let x = 0; x < W; x++) {
      const i = o + x;
      // A thin wall has deep rock on both sides of it along one line and is left alone. A pillar,
      // deep on both lines, is not: it wears away.
      const th = min(d[o + ((x - q) & WM)], d[o + ((x + q) & WM)]);
      let tv = 0, thin = th, pillar = 0;
      if (yu >= 0 && yd >= 0) {
        tv = min(d[yu + x], d[yd + x]);
        if (tv > thin) thin = tv;
        pillar = min(th, tv);
      }
      if (yu2 >= 0 && yd2 >= 0) {
        const t1 = min(d[yu2 + ((x - q2) & WM)], d[yd2 + ((x + q2) & WM)]);
        const t2 = min(d[yu2 + ((x + q2) & WM)], d[yd2 + ((x - q2) & WM)]);
        if (t1 > thin) thin = t1;
        if (t2 > thin) thin = t2;
      }
      const prot = sstep(da, da + db, thin) * (1 - sstep(da, da + db, pillar));
      const cv = d[i] - b1[i];
      // A hollow keeps its moisture: once a cell is well under the rind it stays wet.
      const mo = max(min(1, bm[i] * k.gm), sstep(0.15, 0.45, d[i])) * (1 - prot);
      const rv = R[i];
      // Rock without moisture does not sink beyond a skin; with it, as deep as the cap of the place allows.
      const capT = lerp(k.capWall, k.capPit, sstep(-0.06, 0.04, cv)) + (k.capPit - k.capWall) * (1 - rv) * (1 - rv);
      const cap = k.capFlat + (capT - k.capFlat) * min(1, mo * 3);
      const head = (cap > 1 ? 1 : cap) - d[i];
      if (head > 0) d[i] += (k.ks * f * bs * (k.eps + mo) * head * (1 - prot)) / (1 + k.hardK * rv);
      const nr = rv - f * (k.kr * mo + 0.0001);
      R[i] = nr > 0 ? nr : 0;
    }
  }
  // Seeds on the wall itself, mostly where the rind is still whole.
  const ns = k.seedsSec * f / SIM;
  const cnt = floor(ns) + (Math.random() < ns - floor(ns) ? 1 : 0);
  for (let i = 0; i < cnt; i++) {
    const cx = Math.random() * W, cy = Math.random() * H, o = floor(cy) * W + (floor(cx) & WM);
    // A pit opens only on whole rind and not close to another pit, so the walls between them stay thick.
    if (R[o] > 0.7 && b1[o] < 0.1) sow(P, cx, cy, cl(seedRadius(k), 1.1, 8), 0.45 + 0.4 * Math.random(), 1 + 0.7 * Math.random());
  }
}

function knobsToK(P, kv) {
  const u2 = cl(kv[1] / 4, 0, 1), u3 = cl((kv[2] + 1) / 2, 0, 1);
  const k = P.k;
  k.u2 = u2;
  k.u3 = u3;
  k.rho = lerp(5.2, 2.0, u2) * lerp(1.3, 0.85, u3);
  k.rhoM = 0.55 * k.rho + 0.8;
  k.gm = 2.6;
  k.ks = lerp(0.03, 0.07, u2);
  k.kr = lerp(0.006, 0.014, u2);
  k.eps = 0.02;
  k.hardK = lerp(0.5, 7, u3);
  k.capPit = lerp(0.5, 1.0, u3);
  k.capWall = lerp(0.18, 0.28, u3);
  k.capFlat = 0.05;
  k.wallQ = lerp(3, 4, u3);
  k.deepA = 0.3 * k.capPit;
  k.deepB = 0.65 * k.capPit;
  k.c3 = lerp(0.05, 0.4, u3);
  k.seedsRow = lerp(0.08, 1.1, pow(u2, 1.3)) * lerp(1.7, 0.7, u3);
  k.seedsSec = 0.5 * k.seedsRow * SLIDE;
  k.seedR = lerp(1.3, 0.9, u3);
  k.relief = lerp(4.5, 7, u3);
  return k;
}

function advance(P, k, rows) {
  P.slide += rows;
  while (P.slide >= 1) {
    P.slide -= 1;
    shiftDown(P, k);
  }
}

function beds(P, k) {
  for (let y = 0; y < H; y++) P.bedS[y] = bedding(P, P.rows - y, k.c3);
}

export function update(dt, input, params) {
  const P = params;
  const kv = input.knobValues || [0, 2, 0, 0.06];
  dt = min(dt, 0.1);
  const k = knobsToK(P, kv);
  P.sunK = kv[3];
  if (!P.init) {
    P.init = true;
    const f = 4;
    for (let i = 0; i < 640; i++) {
      beds(P, k);
      advance(P, k, (SLIDE * f) / SIM);
      weather(P, k, f);
    }
  }
  P.t += dt;
  P.acc += dt * SIM;
  advance(P, k, SLIDE * dt);
  const n = floor(P.acc);
  P.acc -= n;
  for (let i = 0; i < n; i++) {
    beds(P, k);
    weather(P, k, 1);
  }
  const shift = kv[0] + 0.02;
  if (P.rampShift !== shift) {
    P.rampShift = shift;
    buildRamp(P.ramp, shift);
  }
}

export function draw(display, params, time) {
  const P = params;
  const { d, R, g, hI, hb, rI, lit, lb, hb2, ramp } = P;
  const k = P.k;
  const s = P.slide;
  // The wall as it stands between two rows.
  for (let y = 0; y < H; y++) {
    const o = y * W, p = y > 0 ? o - W : o;
    for (let x = 0; x < W; x++) {
      const i = o + x, j = p + x;
      hI[i] = d[i] * (1 - s) + d[j] * s + 0.035 * (g[i] * (1 - s) + g[j] * s);
      rI[i] = R[i] * (1 - s) + R[j] * s;
    }
  }
  blur(hI, hb, 6);

  // The sun: a direction that swings by itself, and a height from K4.
  const sunK = cl(P.sunK, -1, 1);
  const elev = ((14 + 64 * pow((sunK + 1) / 2, 1.2)) * PI) / 180;
  const t = P.t;
  const az = -2.36 + 0.9 * sin(0.058 * t + 0.7) + 0.55 * sin(0.0371 * t + 2.1) + 0.3 * sin(0.0173 * t + 4.0);
  const lz = sin(elev), lh = cos(elev), lx = lh * cos(az), ly = lh * sin(az);
  const hx = cos(az), hy = sin(az), tanE = tan(elev);
  const rel = k.relief;
  // Shadow taps along the sun's direction: LEDs away.
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
      const gx = (hI[o + ((x + 1) & WM)] - hI[o + ((x - 1) & WM)]) * 0.5 * rel;
      const gy = (hI[yd + x] - hI[yu + x]) * 0.5 * rel;
      const inv = 1 / sqrt(gx * gx + gy * gy + 1);
      let diff = ((gx * lx + gy * ly + lz) * inv) / lz;
      diff = diff < 0 ? 0 : diff > 1.7 ? 1.7 : diff;
      let sh = 1;
      const hp = hI[i] * rel;
      for (let a = 0; a < 6; a++) {
        const qy = y + tdy[a];
        if (qy < 0 || qy >= H) continue;
        const m = hp - hI[qy * W + ((x + tdx[a]) & WM)] * rel - TAPS[a] * tanE;
        const v = 1 - cl(m / 0.7, 0, 1);
        if (v < sh) sh = v;
      }
      lit[i] = diff * sh;
    }
  }
  for (let i = 0; i < N; i++) hb2[i] = lit[i] * (1 - sstep(0.3, 0.8, hI[i]));
  blur(hb2, lb, 3.5);

  const rampArr = ramp;
  for (let y = 0; y < H; y++) {
    const o = y * W, rr = P.rows - y + s;
    // Stains: slow patches of lighter and darker rock, laid out in rock coordinates.
    const sj = rr / 17, j0 = floor(sj), sf = sj - j0, su = sf * sf * (3 - 2 * sf);
    for (let x = 0; x < W; x++) {
      const i = o + x;
      const hh = hI[i];
      const cav = hh - hb[i];
      const ao = 1 - 0.75 * sstep(0, 0.25, cav);
      const dep = sstep(0.25, 0.95, hh);
      let v = 0.1 + 0.12 * ao + 0.46 * lit[i] * (0.45 + 0.55 * ao);
      v *= 1 - 0.55 * dep;
      const fx = x / 16, x0 = floor(fx), xf = fx - x0, xu = xf * xf * (3 - 2 * xf);
      const sa = lerp(hash(x0 & 3, j0 + P.bedSeed), hash(x0 & 3, j0 + 1 + P.bedSeed), su);
      const sb = lerp(hash((x0 + 1) & 3, j0 + P.bedSeed), hash((x0 + 1) & 3, j0 + 1 + P.bedSeed), su);
      const stain = lerp(sa, sb, xu) - 0.5;
      v += 0.09 * stain + 0.04 * rI[i];
      const bounce = dep * lb[i] * 0.6;
      let idx = floor(cl(v, 0, 1) * (NR - 1) + 0.5) * 3;
      let r = rampArr[idx], gg = rampArr[idx + 1], b = rampArr[idx + 2];
      const ri = rI[i];
      r *= 1 - 0.05 * ri;
      b *= 1 + 0.07 * ri;
      r += bounce * 0.9;
      gg += bounce * 0.38;
      b += bounce * 0.3;
      display.setPixel(x, y, cl(r, 0, 1) * 255, cl(gg, 0, 1) * 255, cl(b, 0, 1) * 255);
    }
  }
}
