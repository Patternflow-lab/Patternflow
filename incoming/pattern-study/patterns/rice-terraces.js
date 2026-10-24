// ===== Patternflow pattern =====
// Title:   Rice Terraces
// Family:  farm
// Idea:    Rice terraces climb in curved steps from the foot of the panel to a forested ridge, every flooded paddy a mirror of the sunrise between dark earth walls with a thin lit rim, while clouds slide across the mirrors and the mist lifts behind the ridge.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after the Hani rice terraces of Yuanyang and the terraces of Banaue
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Season=0..1, Speed=0.2..3, Terraces=12..24, Hour=0..1
//
// Knob 1: Season. At 0 the paddies are flooded in spring and each one holds the sky; then rows of seedlings stand in the water, the rice closes over it green, and at 1 it is gold with four terraces in ten already cut to stubble.
// Knob 2: Speed. At 2 a cloud crosses the sky in about seventeen seconds, its reflection slides faster over the near paddies, and the valley mist rises and settles every quarter minute; at 0.2 it all runs ten times slower.
// Knob 3: Terraces. How many steps climb from the foot of the panel to the ridge, twelve to twenty-four. The near ones are deep behind walls two or three LEDs high, and the far ones thin to a line over the water.
// Knob 4: Hour. Sunrise just after 0, the sun's path glinting in the paddies under it and mist behind the ridge; then morning, noon, a gold afternoon and sunset, and at 1 night, with stars and a lamp in each village door.
// Buttons: K1 tap opens the sluice at the top: water spills over each bund in turn down to the foot, and ripples run across every paddy it fills.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, exp, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const F32 = (n) => new Float32Array(n);
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

// Terrace 0 sits just under the panel, the last one at the ridge. The sky's
// horizon row, and the classes a LED can belong to.
const [YB, YT, YH] = [134, 38, 34];
const [SKY, FAR, NEAR, WOOD, WATER, WALL, RIM] = [0, 1, 2, 3, 4, 5, 6];
// The row of the sky (0 the zenith, 31 the horizon) that the water on each
// panel row holds: low sky in the far paddies, the sky overhead in the near ones.
const RR = F32(H).map((v, y) => 26 - 20 * cl((y - 36) / 92, 0, 1) ** 0.9);
const FOAM = [220, 236, 250], LAG = 0.22, AT = [0.82, 0.88, 1], MUD = [7, 5.6, 4.4], STUB = [150, 120, 70];

// Light by the hour: sky at the zenith, sky at the horizon, sunlit cloud,
// then ambient and direct light and how much mist lies in the valley.
const HOURS = [
  [0, 14, 22, 70, 150, 100, 150, 255, 150, 140, 0.3, 0.12, 1],
  [0.07, 34, 64, 150, 255, 176, 110, 255, 200, 150, 0.5, 0.55, 0.95],
  [0.25, 40, 100, 200, 190, 215, 235, 255, 245, 225, 0.7, 0.6, 0.4],
  [0.5, 36, 96, 206, 170, 205, 240, 255, 255, 250, 0.74, 0.66, 0.15],
  [0.72, 40, 80, 180, 250, 200, 130, 255, 215, 150, 0.64, 0.56, 0.2],
  [0.86, 40, 36, 100, 255, 120, 70, 255, 140, 90, 0.42, 0.36, 0.4],
  [1, 6, 8, 28, 40, 36, 70, 60, 60, 90, 0.16, 0, 0.6],
];
// The season: earth wall, bund rim, rice. Flooded, planted, green, ripening, cut.
const SEASONS = [
  [0, 66, 48, 36, 206, 184, 150, 120, 200, 70],
  [0.35, 60, 74, 40, 150, 196, 96, 110, 204, 60],
  [0.65, 42, 84, 34, 110, 176, 64, 46, 156, 40],
  [0.85, 80, 84, 40, 186, 176, 84, 184, 184, 50],
  [1, 96, 76, 44, 224, 184, 96, 244, 178, 40],
];
function key(T, u) {
  let i = 0;
  while (i < T.length - 2 && u > T[i + 1][0]) i++;
  const a = T[i], b = T[i + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  return a.map((v, c) => mix(v, b[c], f));
}

export function setup(params) {
  const P = (params.s = {
    t: 0, ox: 0, mt: 0, n: 0, surge: 99, sk: F32(32 * 3), cl: F32(128 * 32), f: F32(N * 3),
    cls: new Uint8Array(N), kk: new Int8Array(N), e: F32(N), dep: F32(N), tx: F32(N), walk: [[10 + rnd() * 44, 1], [10 + rnd() * 44, -1]],
  });
  P.ox = rnd() * 128;
  // Egrets: where each stands (column, how far up the steps), and how long it waits.
  P.birds = [0, 1, 2].map(() => ({ x: 6 + rnd() * 52, kf: 0.05 + rnd() * 0.6, w: 1 + rnd() * 8, p: -1 }));
  // Cloud noise, 128 columns that wrap and 32 rows from the zenith down.
  for (let i = 0; i < 128 * 32; i++) {
    const x = i & 127, y = i >> 7, f = (X) => 0.55 * vn(X * 0.06, y * 0.22) + 0.3 * vn(X * 0.15, y * 0.5 + 9) + 0.15 * vn(X * 0.4, y + 3);
    P.cl[i] = mix(f(x), f(x - 128), x / 128);
  }
  for (let i = 0; i < N; i++) P.tx[i] = vn((i & 63) * 0.5, (i >> 6) * 0.6);
}

// The terraces for n steps. A level u climbs the panel in steps that shrink
// with distance, bent by slow noise into spurs and gullies; each whole value
// of u is a bund. For each LED: which terrace, and whether it is water, the
// earth wall under a bund, or the bund's lit rim.
function build(P, n) {
  const q = 0.28 ** (1 / n), L = -log(q), b0 = ((YB - YT) * L) / (1 - q ** n);
  const V = (y) => ((y = 1 - ((YB - y) * L) / b0), y > 1e-4 ? log(y) / -L : 99);
  const { cls, kk, e, dep } = P, u = F32(H + 20), yc = F32(n + 6);
  const put = (x, y, k, i = y * W + x) => y >= 0 && y < H && cls[i] >= WATER && ((cls[i] = RIM), (kk[i] = k));
  P.lip = F32((n + 2) * W);
  P.ridge = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    // A spur comes down left of centre and a gully cuts in on the right.
    const sp = 1.3 * exp(-(((x - 24) / 13) ** 2)) - 1 * exp(-(((x - 55) / 9) ** 2));
    for (let y = H + 19, m = -9; y >= 0; y--) {
      const v0 = V(y), xs = (x - 32) / (q ** v0) ** 0.4 + 40;
      const v = v0 + sp + 1.2 * (vn(xs * 0.035, v0 * 0.07) * 2 - 1 + 0.4 * (vn(xs * 0.085 + 7, v0 * 0.15 + 5) * 2 - 1));
      u[y] = m = max(m, v);
    }
    // Where each bund crosses this column, to a fraction of a LED.
    yc.fill(H + 40);
    for (let y = H + 18; y >= 0; y--) for (let k = max(-3, floor(u[y + 1]) + 1); k <= min(n, u[y]); k++) yc[k + 3] = y + (u[y] - k) / max(1e-3, u[y] - u[y + 1]);
    for (let k = 0; k <= n; k++) P.lip[k * W + x] = yc[k + 3];
    let y = H - 1;
    for (; y >= 0 && u[y] < n; y--) {
      const k = max(-3, floor(u[y])), lip = yc[k + 4], bp = yc[k + 3] < H + 40 ? yc[k + 3] - lip : b0, d = y - lip, rh = cl(0.22 * bp - 0.6, 0, 3.5), i = y * W + x;
      if (d < 1) (cls[i] = RIM), (kk[i] = k + 1);
      else if (d < 1 + rh) (cls[i] = WALL), (kk[i] = k + 1), (e[i] = (d - 1) / rh);
      else (cls[i] = WATER), (kk[i] = k), (e[i] = d - 1 - rh), (dep[i] = bp - 1 - rh);
    }
    P.ridge[x] = y;
    const top = y - 5 - 3 * vn(x * 0.35, 4) - abs(sin(x * 0.9)) * 1.5;
    for (; y >= 0; y--) {
      const i = y * W + x;
      cls[i] = y > top ? WOOD : y >= 22 + 4 * sin(0.06 * x + 0.5) + 2.5 * sin(0.17 * x + 2) ? NEAR : y >= 15 + 5 * sin(0.045 * x + 2.4) + 2 * sin(0.13 * x + 1) ? FAR : SKY;
    }
  }
  // Close the rim where a bund steps a row or more from one column to the next.
  for (let k = 1; k <= n; k++)
    for (let x = 0; x < W - 1; x++) {
      let a = ceil(P.lip[k * W + x]), b = ceil(P.lip[k * W + x + 1]), xa = x, xb = x + 1;
      if (a > b) [a, b, xa, xb] = [b, a, xb, xa];
      const m = floor((a + b) / 2);
      for (let y = a + 1; y < b; y++) put(y <= m ? xa : xb, y, k);
      if (b > a) put(xb, m, k);
    }
  // How bright each rim is: faint where the steps are thin and far, and
  // brighter where the bund turns to face the light.
  const lp = (k, x) => P.lip[k * W + cl(x, 0, W - 1)];
  for (let i = 0; i < N; i++)
    if (cls[i] === RIM) {
      const k = kk[i], x = i & 63;
      e[i] = k > 0 ? cl((lp(k - 1, x) - lp(k, x) - 2) / 7, 0.2, 1) : 1;
      dep[i] = k >= 0 ? lp(k, x + 1) - lp(k, x - 1) : 0;
    }
  for (P.kw = 1; P.lip[P.kw * W + 32] > 117; P.kw++);
  P.n = n;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 12, 0.06], rd = cl(dt || 0, 0, 0.1), d = rd * (cl(k[1], 0.2, 3) / 2);
  const n = round(cl(k[2], 12, 24));
  if (n !== P.n) build(P, n);
  P.s = cl(k[0], 0, 1);
  P.h = cl(k[3], 0, 1);
  P.t += d;
  P.ox += 5 * d;
  P.mt += d;
  P.surge += d;
  if (input.btnPressed && input.btnPressed[0]) P.surge = 0;
  // The ploughing team and the farmer up on the high bund walk to the end and turn.
  for (const w of P.walk) {
    w[0] += w[1] * 2.2 * d;
    if (w[0] > 56 || w[0] < 6) w[1] = -w[1];
  }
  // An egret waits, then flies to another paddy in a low arc.
  for (const b of P.birds)
    if (b.p >= 0) {
      if ((b.p += d / 1.8) >= 1) Object.assign(b, { p: -1, x: b.tx, kf: b.tk, w: 4 + rnd() * 9 });
    } else if ((b.w -= d) <= 0) Object.assign(b, { p: 0, tx: 6 + rnd() * 52, tk: 0.05 + rnd() * 0.6, y0: egY(P, b.x, b.kf) });
}

// Where an egret stands: a little behind the bund of its terrace.
const egY = (P, x, kf) => P.lip[max(1, round(kf * P.n)) * W + round(cl(x, 0, 63))] - 2;
function egrets(P, L, wet) {
  const c = lit([250, 248, 240], L);
  for (const b of P.birds) {
    if (b.p < 0) {
      const x = b.x, y = egY(P, x, b.kf);
      put(x, y, c), put(x, y - 1, c), put(x + 1, y - 2, c), put(x, y + 1, c, 0.35 * wet), put(x, y + 2, c, 0.25 * wet);
    } else {
      const y1 = egY(P, b.tx, b.tk), x = mix(b.x, b.tx, b.p), y = mix(b.y0, y1, b.p) - 14 * sin(PI * b.p), up = floor(P.t * 7) & 1;
      put(x, y, c), put(x - 1, y - up, c), put(x + 1, y - up, c), put(x - 2, y - 2 * up, c, 0.7), put(x + 2, y - 2 * up, c, 0.7);
    }
  }
}

// The sky at table x and row r (0 the zenith, 31 the horizon), with its clouds.
function skyAt(P, K, xx, r, out) {
  const s = P.sk, c = P.cl, xi = floor(xx), fx = xx - xi, i = r * 128;
  const v = mix(c[i + (xi & 127)], c[i + ((xi + 1) & 127)], fx), cd = cl((v - 0.46) * 8, 0, 1) * (0.4 + 0.6 * sm(0, 6, 31 - r));
  const lit = 0.3 + 0.7 * cd;
  for (let j = 0; j < 3; j++) out[j] = mix(s[r * 3 + j], mix(mix(K[1 + j], K[4 + j], 0.5) * 0.75, K[7 + j], lit), cd * 0.94);
  return cd;
}

let F;
function put(x, y, c, a = 1) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let j = 0; j < 3; j++) F[o + j] = mix(F[o + j], c[j], a);
}
const lit = (c, L) => c.map((v, j) => v * L[j]);

// Hani houses: earth walls under tall thatch, lamps in the doors at night,
// smoke from the hearth of the middle one.
const HOUSE = ["..TTT..", ".TTTTT.", "TTTTTTT", ".WWDWW.", ".WWDWW."];
function village(P, L, night, amb) {
  const th = lit([176, 128, 70], L), wa = lit([186, 150, 112], L), dr = night > 0.3 ? [255 * night, 170 * night, 80 * night] : [40, 30, 26];
  for (const [hx, dy] of [[5, 3], [13, 5], [21, 2]]) {
    const by = P.ridge[hx] + dy;
    for (let i = -4; i <= 4; i++) put(hx + i, by + 1, lit([70, 56, 40], L));
    HOUSE.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && put(hx + i - 3, by - 4 + j, ch === "T" ? th.map((v) => v * (j === 2 ? 0.8 : 1)) : ch === "W" ? wa : dr)));
  }
  const by = P.ridge[13] + 1;
  for (let j = 0; j < 14; j++) put(14 + j * 0.3 + sin(P.t * 1.3 - j * 0.6) * 0.7, by - 3 - j, [220, 216, 220].map((v) => v * (0.4 + 0.6 * amb)), 0.6 * (1 - j / 14));
}

// Each bund lets a thread of water down its wall through a gap; when the
// sluice is open the thread runs wide and white.
function streams(P, fo, I) {
  for (let k = 1; k < P.n; k++) {
    const x = 5 + floor(hash(k, 11) * 54), y0 = ceil(P.lip[k * W + x]), f = I[k + 3], w = f > 0.3 ? 1 : 0;
    for (let y = y0; y < y0 + 5 && y < H; y++) {
      const C = P.cls[y * W + x];
      if (y > y0 && C === WATER) {
        put(x, y, fo, 0.35);
        break;
      }
      const st = (y - floor(P.t * 9)) % 3 === 0 ? 1 : 0.7;
      for (let i = -w; i <= w; i++) put(x + i, y, fo.map((v) => v * st), 0.85);
    }
  }
}

// A farmer ploughs behind his buffalo in a near paddy, both mirrored in the
// water, and another farmer walks a high bund.
const BUFF = ["......hh", ".BBBBBBH", "BBBBBBBHH", ".BBBBBB.."];
function walkers(P, L, s, sk) {
  const near = P.walk[0], far = P.walk[1], dir = near[1], k = P.kw, wet = 1 - sm(0.3, 0.6, s);
  const feet = (x) => P.lip[k * W + round(cl(x, 0, 63))] - 1 - 3 * wet;
  const fig = (x, y, c) => (put(x, y, c), wet > 0 && put(x, 2 * feet(near[0]) - y + 1, c.map((v, j) => v * 0.6 + sk[60 + j] * 0.2), 0.6 * wet));
  const bx = near[0], by = feet(bx), fx = bx - 5 * dir;
  // The furrow of churned water behind them.
  for (let i = 4; i < 20; i++) put(fx - i * dir, feet(fx - i * dir), [120, 100, 80].map((v, j) => v * L[j]), 0.5 * wet * (1 - i / 20));
  BUFF.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && fig(bx + (dir > 0 ? i - 4 : 4 - i), by - 3 + j, ch === "h" ? lit([230, 220, 200], L) : lit(j > 1 ? [30, 27, 30] : [70, 62, 62], L))));
  const hat = lit([240, 210, 136], L), body = lit([30, 34, 70], L);
  for (const [i, j, c] of [[0, -4, hat], [-1, -3, hat], [0, -3, hat], [1, -3, hat], [0, -2, body], [0, -1, body], [-dir, -1, body], [0, 0, body]]) fig(fx + i, by + j, c);
  // The plough's handle between them.
  fig(fx + dir, by - 1, [70, 56, 44]), fig(fx + 2 * dir, by, [70, 56, 44]);
  const k2 = k + round((P.n - k) * 0.55), gx = far[0], gy = P.lip[k2 * W + round(gx)] - 1;
  put(gx, gy - 1, hat), put(gx, gy, body);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.n) return;
  const K = key(HOURS, P.h), S = key(SEASONS, P.s), f = (F = P.f), sk = P.sk, n = P.n, t = P.t, s = P.s, cls = P.cls, tx = P.tx;
  const [amb, dir, mist] = [K[10], K[11], K[12]], night = sm(0.86, 1, P.h);
  for (let r = 0; r < 32; r++) {
    const e = sm(0, 0.65, 1 - r / 31) ** 0.8;
    for (let j = 0; j < 3; j++) sk[r * 3 + j] = mix(K[4 + j], K[1 + j], e);
  }
  // The sun along its day from right to left.
  const a = cl(P.h / 0.86, 0, 1) * PI, sx = 32 + 26 * cos(a), sy = 16 - 80 * sin(a) ** 1.5, side = sx > 32 ? 1 : -1, rs = 31 - 13 * (1 - sy / YH), sunUp = (1 - sm(11, 15, sy)) * (1 - night);
  const rice1 = sm(0.1, 0.3, s), rice2 = sm(0.3, 0.6, s), cut = sm(0.88, 1, s);
  const c = P.cl, ox = P.ox, col = [0, 0, 0], L = [0, 0, 0], L0 = AT.map((v, j) => amb * v + (dir * K[7 + j]) / 255);
  const sh0 = (0.5 + 0.5 * sm(0, 0.2, P.h)) * (1 - night) * 0.8 * dir;
  const far = AT.map((v, j) => K[1 + j] * 0.9 + 16), near = [30, 44, 70].map((v) => v * (amb + 0.3)), wood = [28, 66, 32].map((v) => v * 1.3);
  // How hard water is spilling over each bund: the sluice opens at the top and
  // the overflow runs down one terrace every LAG seconds.
  const I = F32(n + 8), HZ = F32(n + 8), fo = FOAM.map((v, j) => mix(v, K[7 + j], 0.3) * (0.4 + 0.6 * sm(0.1, 0.5, amb)));
  for (let k = -3; k <= n + 1; k++) {
    const tk = P.surge - (n - k) * LAG;
    HZ[k + 3] = 0.35 * cl(k / n, 0, 1) ** 1.6;
    I[k + 3] = tk > 0 ? exp(-tk * 0.9) * sm(0, 0.15, tk) : 0;
  }
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, C = cls[i];
    // Cloud shadow on the hillside, sliding across.
    const shade = cl((c[((floor(y * 0.22) + 3) & 31) * 128 + (floor(x * 0.75 + ox * 1.2 + 40) & 127)] - 0.48) * 4, 0, 1) * sh0;
    for (let j = 0; j < 3; j++) L[j] = L0[j] - (shade * K[7 + j]) / 255;
    if (C < WOOD) {
      const r = cl(round(31 - 13 * (1 - y / YH)), 0, 31), cd = skyAt(P, K, x * 1.3 + ox, r, col);
      if (C === SKY) {
        const ds = Math.hypot(x - sx, (y - sy) * 1.1), g = (1 - night) * (0.5 * exp(-ds / 9) * (1 - cd * 0.6) + (ds < 2.6 ? 1 : 0)), st = night > 0.2 && hash(x, y) > 0.985 ? 200 * night : 0;
        for (let j = 0; j < 3; j++) col[j] += K[7 + j] * g + st;
      } else for (let j = 0; j < 3; j++) col[j] = (C === FAR ? mix(sk[84 + j], far[j], 0.45) : mix(sk[84 + j], near[j], 0.75)) * (0.9 + 0.1 * tx[i]);
    } else if (C === WOOD) for (let j = 0; j < 3; j++) col[j] = wood[j] * (0.6 + 0.6 * tx[i]) * L[j];
    else {
      const k = P.kk[i], ee = P.e[i], fl = I[k + 3];
      if (C === WALL) {
        // Water sheets down the wall when the terrace above overflows.
        const st = fl > 0.01 ? 0.85 * fl : 0, sv = st ? 0.5 + 0.5 * sin(y * 1.9 - P.surge * 14 + x * 1.3) ** 2 : 0;
        for (let j = 0; j < 3; j++) col[j] = mix(S[1 + j] * L[j] * (1.05 - 0.4 * ee), fo[j] * sv, st);
      } else if (C === RIM) {
        const ra = ee * (0.55 + 0.45 * cl(0.5 + 0.3 * P.dep[i] * side, 0, 1));
        for (let j = 0; j < 3; j++) col[j] = mix(mix(S[1 + j] * L[j], S[4 + j] * (L[j] + 0.3) + sk[84 + j] * 0.25, ra), fo[j], fl);
      } else {
        // The mirror: the far paddies hold the low sky, the near ones the sky
        // overhead, and each holds its own wall dark along the back.
        const dp = max(2, P.dep[i]), u = cl(ee / dp, 0, 1), rr = RR[y] - 3 * u, r = round(rr);
        skyAt(P, K, (x - 32) * (0.4 + r / 40) + 32 + ox + k * 1.5, r, col);
        const gust = cl((c[((floor(y * 0.3) + 17) & 31) * 128 + (floor(x * 0.5 + ox * 1.6) & 127)] - 0.55) * 5, 0, 1), back = dp > 4 ? 0.5 * exp(-ee / 0.9) : 0;
        // Ripples run out from the wall when water spills in from above.
        const fi = I[k + 4], rip = fi > 0.01 ? fi * (0.5 + 0.5 * sin(ee * 1.7 - (P.surge - (n - k - 1) * LAG) * 9)) * 0.5 : 0;
        // The sun's own path down the paddies that hold its height of sky.
        const gl = sunUp && abs(x - sx) < 7 ? sunUp * exp(-(((x - sx) / 2.2) ** 2) - ((rr - rs) / 1.3) ** 2) * (1 - 0.6 * gust) * (0.75 + 0.25 * sin(x * 2.3 + y * 1.7 + t * 6)) : 0;
        for (let j = 0; j < 3; j++) col[j] = mix(mix(col[j] * 0.88, sk[45 + j] * 0.55, 0.5 * gust), S[1 + j] * L[j], back * (1 - fi)) + MUD[j] * L[j] + fo[j] * rip + K[7 + j] * gl;
        // Rice: seedlings in rows along the contour, then a closed crop.
        const ra = max((x + k) % 2 === 0 && floor(ee) % 2 === 0 ? rice1 : 0, rice2);
        if (ra > 0) {
          const v = (floor(ee) & 1 ? 1 : 0.84) * (0.9 + 0.2 * hash(x, y * 7 + k)) * (1 + 0.3 * cl((gust - 0.1) * 2, 0, 1)), isCut = (k * 7 + 23) % 10 < cut * 3.5;
          for (let j = 0; j < 3; j++) col[j] = mix(col[j], (isCut ? STUB[j] * (x % 3 ? 1 : 0.7) : S[7 + j]) * L[j] * v, ra);
        }
      }
      // The far steps fade into the haze.
      const hz = HZ[k + 3];
      for (let j = 0; j < 3; j++) col[j] = mix(col[j], sk[72 + j] * 0.9, hz);
    }
    f[o] = col[0];
    f[o + 1] = col[1];
    f[o + 2] = col[2];
  }
  // The village under the forest, the bunds' outlets, the farmers.
  village(P, L0, night, amb);
  streams(P, fo, I);
  walkers(P, L0, s, sk);
  egrets(P, L0, 1 - sm(0.3, 0.6, s));
  // Mist: a bank in the valley behind the ridge and a thinner one over the steps.
  const mt = P.mt, y1 = 28 + 4 * sin(mt * 0.4), y2 = 66 + 22 * sin(mt * 0.2 + 1), mc = [0, 1, 2].map((j) => mix(sk[93 + j], 250, 0.55) * (0.7 + 0.3 * amb));
  for (let y = 0; y < H; y++) {
    const w1 = mist * 0.9 * exp(-(((y - y1) / 6) ** 2)), w2 = mist * 0.45 * exp(-(((y - y2) / 7) ** 2));
    if (w1 + w2 < 0.01) continue;
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const dm = min(0.9, ((cls[i] < WOOD ? w1 : 0) + w2) * (0.4 + 0.6 * vn(x * 0.08 + mt * 0.3, y * 0.2)));
      for (let j = 0; j < 3; j++) f[i * 3 + j] = mix(f[i * 3 + j], mc[j], dm);
    }
  }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, f[o]) | 0, min(255, f[o + 1]) | 0, min(255, f[o + 2]) | 0);
}
