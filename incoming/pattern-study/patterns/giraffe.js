// ===== Patternflow pattern =====
// Title:   Giraffe
// Family:  mammal
// Idea:    Under the flat crown of an umbrella thorn a reticulated giraffe strips a twig with its long dark tongue, and every so often it splays its front legs and bends down to drink at the waterhole.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after the browse line giraffes cut under the umbrella thorn acacia (Vachellia tortilis)
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Sun=0..1, Speed=0.2..3, Coat=0..3, Wind=0..1
//
// Knob 1: Sun. The hour, from a high white sun at 0 to a red sun setting between the giraffe's legs at 1. Round each hour the sun sinks a little and climbs back once a minute.
// Knob 2: Speed. At 2 a lick takes about three seconds; the giraffe first goes down to drink after three, then every half minute or when its twig is bare.
// Knob 3: Coat. Reticulated with thin white lines, Masai with jagged leaf patches, Rothschild with broad buff lines and white stockings, or pale leucistic, each on its own ground: red earth, gold grass, green grass, pale sand.
// Knob 4: Wind. Grass and crown lean and shake with it, and dust blows over the plain until the far herd goes hazy.
// Buttons: K1 tap sends the giraffe down to drink now.

const [W, H] = [64, 128];
const N = W * H;
// Horizon and waterhole; the crown is kept wider than the panel to rock.
const [HOR, PCX, PCY, PRX, PRY] = [94, 50, 113.5, 14, 4.8];
const [CW, CH, CO] = [80, 26, 8];
const { min, max, floor, round, sin, cos, sqrt, exp, PI } = Math;
const hyp = (a, b) => sqrt(a * a + b * b);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const smin = (a, b, k, h = cl(0.5 + (0.5 * (b - a)) / k, 0, 1)) => b + (a - b) * h - k * h * (1 - h);
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

// The light from afternoon to dusk, one row per hour.
const SKY = [
  [74, 134, 216, 186, 210, 226, 255, 250, 228, 1, 0.98, 0.92, 1],
  [62, 114, 206, 236, 208, 164, 255, 238, 180, 1.04, 0.92, 0.78, 0.97],
  [56, 78, 170, 255, 170, 94, 255, 198, 100, 1.08, 0.8, 0.6, 0.88],
  [40, 38, 108, 248, 108, 72, 255, 132, 60, 1, 0.64, 0.52, 0.74],
];
// Each coat: patch, line, mane, and the ground it stands on.
const COATS = [
  { p: [150, 54, 22], l: [250, 240, 214], m: [92, 42, 22], land: [204, 142, 92] },
  { p: [108, 50, 26], l: [226, 184, 122], m: [80, 42, 24], land: [214, 182, 98] },
  { p: [180, 98, 44], l: [236, 212, 164], m: [112, 62, 32], land: [160, 176, 86] },
  { p: [224, 204, 172], l: [252, 248, 238], m: [200, 168, 132], land: [224, 210, 166] },
];
// The pale of the lower legs.
const STOCK = [244, 234, 212];
const [BODY, NECK, HEAD, LEGN, LEGF, MANE, OSS, TIP, EAR, TAIL, TUFT, HOOF, MUZ] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// The coat as a 128 x 128 wrapping texture: 1 inside a patch, 0 on a line.
function buildCoat(P, kind) {
  const S = 6.4, G = 20;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      let qx = x + 0.5, qy = y + 0.5, f1 = 99, f2 = 99, id = 0, ax = 0, ay = 0, v;
      if (kind === 1) (qx += 3 * (vn(x * 0.3, y * 0.3) - 0.5)), (qy += 3 * (vn(x * 0.3 + 9, y * 0.3) - 0.5));
      const cx = floor(qx / S), cy = floor(qy / S);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const gx = (cx + i + G) % G, gy = (cy + j + G) % G, fx = (cx + i + 0.15 + 0.7 * hash(gx, gy)) * S, fy = (cy + j + 0.15 + 0.7 * hash(gx + 50, gy)) * S;
          const d = hyp(qx - fx, qy - fy);
          if (d < f1) (f2 = f1), (f1 = d), (id = gx * 31 + gy), (ax = qx - fx), (ay = qy - fy);
          else if (d < f2) f2 = d;
        }
      const e = f2 - f1;
      if (kind === 0) v = sm(0.7, 1.4, e);
      else if (kind === 1) {
        // Masai patches are cut into leaves and stars.
        const thr = 1.9 + sin(Math.atan2(ay, ax) * 5 + id) + 0.6 * vn(x * 0.7, y * 0.7);
        v = sm(thr - 0.5, thr + 0.5, e);
      } else v = kind === 2 ? sm(1.3, 2.6, e) : sm(1, 2.2, e) * 0.9;
      P.tex[y * 128 + x] = v;
      P.tsh[y * 128 + x] = 0.84 + 0.3 * hash(id, 7);
    }
  P.coat = kind;
}

// A thick line into the wood layer.
function stroke(A, pts, r0, r1, val) {
  for (let j = 0; j + 2 < pts.length; j += 2) {
    const [ax, ay, bx, by] = pts.slice(j, j + 4), n = 2 * hyp(bx - ax, by - ay);
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = mix(ax, bx, t), y = mix(ay, by, t), r = mix(r0, r1, (j + 2 * t) / (pts.length - 2));
      for (let yy = floor(y - r); yy <= y + r; yy++)
        for (let xx = floor(x - r); xx <= x + r; xx++)
          if (hyp(xx + 0.5 - x, yy + 0.5 - y) <= r && xx >= 0 && xx < W) A[yy * W + xx] = max(A[yy * W + xx], val * (1.1 - (0.35 * (xx + 0.5 - x)) / r));
    }
  }
}

function build(P) {
  // The crown: flat layers of leaves over a flat browse line, with a hollow
  // eaten up into it where the giraffe reaches.
  for (let x = 0; x < CW; x++) {
    const X = x - CO, top = 3 + 0.0028 * (X - 28) ** 2 + 2.2 * vn(X * 0.18, 1.5);
    const bot = 19.5 + 1.6 * vn(X * 0.3, 4.5) + 0.0016 * (X - 28) ** 2 - 6.5 * exp(-(((X - 53.5) / 4.2) ** 2));
    for (let y = 0; y < CH; y++) {
      const i = y * CW + x, f = (y - top) / (bot - top), n = vn(X * 0.16, y * 0.42) * 0.6 + vn(X * 0.5, y * 0.6) * 0.4;
      if (f < 0 || f > 1) continue;
      const k = n + 0.125 + 0.125 * sin(y * 0.9 + 2.4 * vn(X * 0.08, 2)) - 0.3 * sm(0.75, 1, f) - 0.35 * sm(0.18, 0, f);
      if (k > 0.34) (P.cA[i] = 1), (P.cL[i] = (1.15 - 0.6 * f) * (0.75 + 0.5 * n) * (0.85 + 0.3 * hash(X + 300, y)));
      else if (k > 0.2 && f > 0.12) P.cA[i] = 1;
    }
  }
  // The trunk, and crooked branches fanning up to the crown.
  stroke(P.wood, [58.5, 104, 57.5, 86, 59, 66, 57.5, 50], 2.2, 1.7, 1);
  for (const b of [[57.5, 50, 53, 41, 48, 37, 41, 29, 31, 22, 24, 19], [57.5, 52, 55, 42, 51, 33, 50, 25, 46, 19], [58, 50, 61, 40, 61, 31, 65, 21], [58, 60, 54, 55, 46, 50]]) stroke(P.wood, b, 1.5, 0.8, 0.85);
  // The ground, and dust that wraps every 128 columns.
  for (let i = HOR * W; i < N; i++) {
    const x = i & 63, y = i >> 6;
    P.gnd[i] = mix(vn(x * 0.12, y * 0.9), vn(x * 0.6, y * 0.18), (y - HOR) / (H - HOR)) * 0.7 + 0.3 * hash(x, y + 700);
  }
  for (let i = 0; i < 128 * 58; i++) {
    const x = i & 127, y = i >> 7, f = (X) => vn(X * 0.07, y * 0.16) * 0.7 + vn(X * 0.19, y * 0.3 + 5) * 0.3;
    P.haze[i] = mix(f(x), f(x + 128), x / 128);
  }
  P.hill = Array.from({ length: W }, (_, x) => HOR - 2 - 2.5 * vn(x * 0.07, 3) - 1.5 * vn(x * 0.2, 7));
  // Dry grass, none standing in the water.
  P.blades = [];
  while (P.blades.length < 230) {
    const y = HOR + 5 + (H - HOR - 4) * sqrt(rnd()), x = rnd() * 66 - 1;
    if (((x - PCX) / (PRX + 1.5)) ** 2 + ((y - PCY) / (PRY + 2)) ** 2 > 1) P.blades.push([x, y, 1.5 + (y - HOR) * 0.2 * (0.6 + 0.8 * rnd()), rnd() * 7, 0.7 + 0.6 * rnd()]);
  }
  P.herd = Array.from({ length: 7 }, (_, i) => [i * 9.5 + rnd() * 5, HOR + 0.5 + rnd() * 2.2, 0.35 + rnd() * 0.3, rnd() * 7]);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.g = {
    f: F(N * 3), z: new Int8Array(N), p: new Uint8Array(N), u: F(N), v: F(N), tex: F(16384), tsh: F(16384), gnd: F(N), wood: F(N), cA: F(CW * CH), cL: F(CW * CH),
    haze: F(128 * 58), row: F(HOR * 3), bg: F(N * 3), coat: -1, t: 0, dk: 0, dt: 0, next: 3.4, legN: 0, legF: 0, nk: 0, tc: 0.6, tp: 2.8, tw: 0, twv: 0, tl: 9,
    ear: 1, flick: 0, swish: 0, sw: 3, ox: 0.55, oxT: 1, hop: 1, fall: [], rip: [], ripT: 0,
  };
  build(params.g);
}

export function update(dt, input, params) {
  if (!params.g) setup(params);
  const P = params.g, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1) * (cl(k[1], 0.2, 3) / 2), coat = cl(round(k[2]), 0, 3), w = (P.wind = cl(k[3], 0, 1));
  if (coat !== P.coat) buildCoat(P, coat);
  const t = (P.t += d), sunK = cl(k[0], 0, 1);
  // The sun sinks and climbs back a little round the hour the knob sets.
  P.h = sunK + (1 - sunK) * 0.3 * (0.5 - 0.5 * cos((2 * PI * t) / 60));

  // Down to drink: the front legs go out one by one, then the neck comes down.
  if (input.btnPressed && input.btnPressed[0] && P.dk === 0) P.next = 0;
  const T = (P.dt += d);
  if (P.dk === 0) {
    if ((P.next -= d) <= 0 || (P.tl <= 0 && P.tc > 1.6)) (P.dk = 1), (P.dt = 0);
  } else if (P.dk === 1) {
    [P.legN, P.legF, P.nk] = [sm(0, 0.7, T), sm(0.45, 1.15, T), sm(0.8, 2.6, T)];
    if (T >= 2.6) (P.dk = 2), (P.dt = 0);
  } else if (P.dk === 2) {
    // Sips: the head dips and lifts, and rings spread on the water.
    P.nk = 1 - 0.035 * (0.5 - 0.5 * cos(T * 4.4));
    if ((P.ripT -= d) <= 0) (P.ripT = 0.7 + rnd() * 0.4), P.rip.push([P.mx, P.my + 1, 0, 1]);
    if (T >= 3.4) (P.dk = 3), (P.dt = 0);
  } else {
    // Up again fast, the head first, then the legs gathered in.
    [P.nk, P.legN, P.legF] = [1 - sm(0, 1, T), 1 - sm(0.9, 1.6, T), 1 - sm(0.6, 1.3, T)];
    if (T >= 1.8) (P.dk = 0), (P.next = 26 + rnd() * 12), (P.tl = 9), (P.tc = 1.3);
  }

  // The tongue curls round the twig to strip it. Then the jaw chews.
  const browsing = P.dk === 0 && P.nk < 0.01;
  if ((P.tc += d) > P.tp) (P.tc = 0), (P.tp = 2.4 + rnd() * 1.3), (P.pulled = false);
  const c = P.tc, live = browsing && P.tl > 0;
  P.ext = live ? (c < 0.45 ? sm(0, 0.45, c) : c < 1 ? 1 : 1 - sm(1, 1.3, c)) : 0;
  P.twv += (60 * ((live && c > 0.5 && c < 1 ? 3 * sm(0.5, 0.85, c) : 0) - P.tw) - 5 * P.twv) * d;
  P.tw += P.twv * d;
  if (live && c > 0.85 && !P.pulled) {
    P.pulled = true;
    P.tl--;
    for (let n = 0; n < 2; n++) P.fall.push([53.5 + rnd() * 2, 18, (rnd() - 0.5) * 4, 2 + rnd() * 3, rnd() * 7]);
  }
  P.chew = browsing && c > 1.3 ? 0.5 + 0.5 * sin(c * 19) : 0;

  // Ear and tail keep the flies off, and the oxpecker hops along the neck.
  if ((P.ear -= d) <= 0) (P.ear = 1.5 + rnd() * 3), (P.flick = 1);
  P.flick = max(0, P.flick - d * 3.5);
  if ((P.sw -= d) <= 0) (P.sw = 2.5 + rnd() * 4), (P.swish = 1);
  P.swish = max(0, P.swish - d * 0.9);
  P.tail = 0.12 * sin(t * 1.1) + 0.5 * P.swish * sin(t * 9);
  if ((P.oxT -= d) <= 0) (P.oxT = 0.7 + rnd() * 1.8), (P.ox0 = P.ox), (P.ox1 = cl(P.ox + (rnd() < 0.5 ? -1 : 1) * (0.05 + rnd() * 0.1), 0.3, 0.78)), (P.hop = 0);
  if (P.hop < 1) (P.hop = min(1, P.hop + d * 4)), (P.ox = mix(P.ox0, P.ox1, P.hop));

  // Falling leaves and rings on the pool.
  P.fall = P.fall.filter((q) => ((q[4] += d), (q[0] += (q[2] + 3 * sin(q[4] * 3) + 8 * w) * d), (q[1] += q[3] * d), q[1] < 124));
  P.rip = P.rip.filter((q) => ((q[2] += d * 5), (q[3] -= d * 0.45), q[3] > 0));
  // The far herd walks on.
  for (const a of P.herd) if ((a[0] -= a[2] * d) < -4) a[0] += 72;
}

// One LED of the giraffe, unless something nearer is there.
function put(P, x, y, z, part, u, v) {
  const i = y * W + x;
  if (x >= 0 && x < W && y >= 0 && y < H && z >= P.z[i]) (P.z[i] = z), (P.p[i] = part), (P.u[i] = u), (P.v[i] = v);
}

// A limb through joints, each a point and a radius. Each LED keeps how far
// along it lies (u) and across (v, plus on the mane side); the tip LEDs take
// another part.
function limb(P, J, z, part, mane = 0, tipPart = 0, tipLen = 0) {
  let total = 0, s0 = 0;
  for (let j = 3; j < J.length; j += 3) total += hyp(J[j] - J[j - 3], J[j + 1] - J[j - 2]);
  for (let j = 0; j + 3 < J.length; j += 3) {
    const [ax, ay, ra, bx, by, rb] = J.slice(j, j + 6), len = hyp(bx - ax, by - ay) || 1e-6, dx = (bx - ax) / len, dy = (by - ay) / len, pad = max(ra, rb) + mane + 1;
    for (let y = floor(min(ay, by) - pad); y <= max(ay, by) + pad; y++)
      for (let x = floor(min(ax, bx) - pad); x <= max(ax, bx) + pad; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay, tt = cl(px * dx + py * dy, 0, len), dist = hyp(px - dx * tt, py - dy * tt);
        const side = px * dy - py * dx, r = ra + ((rb - ra) * tt) / len, s = s0 + tt;
        if (dist <= r) put(P, x, y, z, tipLen && s > total - tipLen ? tipPart : part, s, side >= 0 ? dist / r : -dist / r);
        else if (mane && side > 0 && dist <= r + mane && s > 3 && s < total - 1) put(P, x, y, z, MANE, s, 1);
      }
    s0 += len;
  }
}

// Two bones from hip to hoof, bending the way dir says.
function ik(ax, ay, bx, by, a, b, dir) {
  const dx = bx - ax, dy = by - ay, d0 = hyp(dx, dy), d = min(d0, a + b - 0.01), x = (a * a - b * b + d * d) / (2 * d), h = sqrt(max(0, a * a - x * x));
  return [ax + (dx / d0) * x - (dy / d0) * h * dir, ay + (dy / d0) * x + (dx / d0) * h * dir];
}

// Keys for the neck and head as they swing from the leaves to the water.
const NK = [
  [39.5, 44, 42, 28, -0.52],
  [50, 40, 58, 58, 1.2],
  [49, 80, 55, 99.5, 1.66],
];

function giraffe(P) {
  P.z.fill(-1);
  const lean = max(P.legN, P.legF), ca = cos(0.22 * lean), sa = sin(0.22 * lean), drop = 3 * lean;
  // Body space to the panel, tilted on the hip.
  const T = (x, y) => [12 + (x - 12) * ca - (y - 72) * sa, 72 + (x - 12) * sa + (y - 72) * ca + drop];
  // The legs go behind the body, the far pair darker. To drink the near
  // front leg goes back and the far one forward.
  for (const [sx, sy, hx, hy, dir, part, z] of [
    [31, 78, 33 + 12 * P.legF, 119.5, -1, LEGF, 1],
    [16, 75, 16, 119.5, 1, LEGF, 1],
    [35, 78, 37 - 14 * P.legN, 121.5, -1, LEGN, 2],
    [12, 75, 11, 121.5, 1, LEGN, 2],
  ]) {
    const [ax, ay] = T(sx, sy), [kx, ky] = ik(ax, ay, hx, hy, 22, 22.5, dir);
    limb(P, [ax, ay, dir < 0 ? 3.2 : 4, kx, ky, dir < 0 ? 1.6 : 1.8, hx, hy, 1.3], z, part, 0, HOOF, 2.2);
  }
  // The body, low at the rump and high at the shoulder.
  for (let y = 48; y < 96; y++)
    for (let x = 0; x < 50; x++) {
      const qx = x + 0.5 - 12, qy = y + 0.5 - 72 - drop, bx = 12 + qx * ca + qy * sa, by = 72 - qx * sa + qy * ca;
      const a = (hyp((bx - 13) / 8.5, (by - 72) / 8.5) - 1) * 8.5, b = (hyp((bx - 24) / 12.5, (by - 73.5) / 9.5) - 1) * 9.5, c = (hyp((bx - 34) / 8.5, (by - 67.5) / 13.5) - 1) * 8.5;
      if (smin(smin(a, b, 5), c, 5) <= 0) put(P, x, y, 3, BODY, bx, by);
    }
  // The tail hangs from the rump and swishes.
  const tj = T(5.5, 65);
  tj.push(0.6);
  for (let j = 1, x = tj[0], y = tj[1], a; j <= 4; j++) (a = PI / 2 + 0.1 + P.tail * j * 0.45), tj.push((x += 6.5 * cos(a)), (y += 6.5 * sin(a)), j === 4 ? 1.7 : 0.6);
  limb(P, tj, 4, TAIL, 0, TUFT, 4.5);

  // The neck, a curve from the withers to the poll, and its mane.
  const e = sm(0, 1, P.nk) * 2, i = min(1, floor(e)), K = NK[i].map((v, c) => mix(v, NK[i + 1][c], e - i));
  const bob = P.dk === 0 ? 1 - P.nk : 0, pull = P.tw * 0.25, [sx, sy] = T(36, 61), qx = K[2] + bob * 0.5 * sin(P.t * 0.9), qy = K[3] + bob * (0.4 * sin(P.t * 1.3) - pull);
  const J = (P.neck = []);
  for (let n = 0, t; n <= 12; n++) (t = n / 12), J.push((1 - t) ** 2 * sx + 2 * t * (1 - t) * K[0] + t * t * qx, (1 - t) ** 2 * sy + 2 * t * (1 - t) * K[1] + t * t * qy, mix(5.4, 2.8, t));
  limb(P, J, 2, NECK, 1.2);
  // The head, its cheek working as it chews.
  const ph = K[4] - pull * 0.05, fx = cos(ph), fy = sin(ph), nx = fy, ny = -fx, ch = P.chew;
  const mx = (P.mx = qx + 10.5 * fx), my = (P.my = qy + 10.5 * fy);
  limb(P, [qx - fx, qy - fy, 2.4, qx + 3 * fx - 0.4 * nx, qy + 3 * fy - 0.4 * ny, 3.1 + 0.35 * ch, mx, my, 1.6 + 0.3 * ch], 7, HEAD, 0, MUZ, 2.6);
  // Ossicones, and the ear flicking at a fly.
  for (const [o, z] of [[0.3, 7], [2.1, 6]]) {
    const bx = qx + o * fx + 2 * nx, by = qy + o * fy + 2 * ny;
    limb(P, [bx, by, 1, bx + 3.2 * (nx - 0.25 * fx), by + 3.2 * (ny - 0.25 * fy), 0.9], z, OSS, 0, TIP, 1.3);
  }
  const fa = 0.35 - 0.9 * P.flick * sin(P.flick * 9), bx = qx - 0.6 * fx + 1.3 * nx, by = qy - 0.6 * fy + 1.3 * ny;
  limb(P, [bx, by, 1, bx + 3.6 * (-fx * cos(fa) + nx * sin(fa)), by + 3.6 * (-fy * cos(fa) + ny * sin(fa)), 0.5], 8, EAR);
  P.eye = [qx + 2.8 * fx + 0.9 * nx - 0.5, qy + 2.8 * fy + 0.9 * ny - 0.5];
}

// A colour into the frame, mixed over what is there by a.
let F;
function set(x, y, col, a = 1, k = 1) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  for (let c = 0, o = (y * W + x) * 3; c < 3; c++) F[o + c] = mix(F[o + c], col[c] * k, a);
}

// Everything behind the tree.
function back(P, L, tint, land) {
  const h = P.h, t = P.t, row = P.row, key = round(h * 900) * 4 + P.coat;
  // Sky and plain are kept until the hour moves.
  if (key !== P.bgKey) {
    const B = P.bg, hill = [104, 104, 136].map((v) => v * (0.55 + 0.45 * L[12])), sx = 21 + 6 * h, sy = 30 + 66 * h, sr = 3.2 + 2 * h, g1 = 10 + 30 * h, g2 = 8 + 12 * h;
    P.bgKey = key;
    for (let y = 0; y < HOR; y++) for (let c = 0; c < 3; c++) row[y * 3 + c] = mix(L[c], L[3 + c], (y / HOR) ** 1.5);
    for (let i = 0; i < N; i++) {
      const x = i & 63, y = i >> 6, o = i * 3;
      if (y < HOR) {
        const d = hyp(x + 0.5 - sx, (y + 0.5 - sy) * 1.05), gl = d < sr ? 1 : d > 48 ? 0 : 0.4 * exp(-((d - sr) * (d - sr)) / g1) + 0.16 * exp(-d / g2), hm = y >= P.hill[x] ? 0.5 : 0;
        for (let c = 0, v; c < 3; c++) (v = row[y * 3 + c]), (B[o + c] = mix(v + (L[6 + c] - v * 0.4) * gl, hill[c], hm));
      } else {
        const q = 1 - (y - HOR) / (H - HOR), n = 0.78 + 0.34 * P.gnd[i];
        for (let c = 0; c < 3; c++) B[o + c] = mix(land[c] * n, L[3 + c], 0.5 * q * q);
      }
    }
  }
  F.set(P.bg);
  // The far herd walking along the horizon.
  const hc = [74, 58, 50].map((v, c) => v * tint[c]);
  for (const [x, y, , p] of P.herd) {
    const s = (t * 4 + p) % 2 < 1 ? 0 : 1;
    set(x, y, hc), set(x + 1, y, hc), set(x + 2, y - 1, hc), set(x + s, y + 1, hc, 0.7), set(x + 2 - s, y + 1, hc, 0.7);
  }
  // The giraffe's shadow stretches away from the sun.
  const shx = 24 + 22 * h, shr = 17 + 12 * h;
  for (let y = 118; y < 126; y++)
    for (let x = 0, e; x < W; x++) if ((e = ((x - shx) / shr) ** 2 + ((y - 122) / 2.6) ** 2) < 1) for (let c = 0; c < 3; c++) F[(y * W + x) * 3 + c] *= 0.58 + 0.3 * e;
  // The waterhole holds the sky, and sipping sends rings across it.
  for (let y = floor(PCY - PRY); y <= PCY + PRY; y++)
    for (let x = floor(PCX - PRX); x < W; x++) {
      const e = ((x + 0.5 - PCX) / PRX) ** 2 + ((y + 0.5 - PCY) / PRY) ** 2, o = (y * W + x) * 3, ry = cl(round(HOR - 6 - (y - PCY + PRY) * 4), 0, HOR - 1);
      if (e >= 1) continue;
      let k = 0.1 * sin(x * 0.8 + t * 2.6 + y * 1.7) * (0.4 + P.wind);
      for (const [cx, cy, rr, a] of P.rip) k += 0.5 * a * exp(-((hyp(x + 0.5 - cx, (y + 0.5 - cy) * 2.6) - rr) ** 2) / 0.7);
      for (let c = 0; c < 3; c++) F[o + c] = e > 0.72 ? F[o + c] * 0.5 : row[ry * 3 + c] * (0.76 + k) + 6 * c;
    }
}

// The tree, its crown rocking on the wind.
function tree(P, tint) {
  const t = P.t, w = P.wind, wood = [92, 72, 58].map((v, c) => v * tint[c]), lit = (P.leaf = [116, 152, 58].map((v, c) => v * tint[c])), dark = [14, 23, 10];
  for (let i = 0; i < N; i++) if (P.wood[i] > 0) for (let c = 0; c < 3; c++) F[i * 3 + c] = wood[c] * P.wood[i];
  const rock = (0.35 + 2.4 * w) * sin(t * (0.9 + w)) + 0.9 * w * sin(t * 2.3 + 1), fa = 0.08 + 0.3 * w, fw = 3 + 5 * w;
  for (let y = 0; y < CH; y++)
    for (let x = 0, sh = rock * (0.6 + (0.4 * (CH - y)) / CH); x < W; x++) {
      const X = round(x + CO - sh), j = y * CW + X;
      if (X < 0 || X >= CW || !P.cA[j]) continue;
      const v = cl(P.cL[j] * (1 + fa * sin(t * fw + hash(X, y) * 40)) - 0.12, 0, 1.3);
      for (let c = 0; c < 3; c++) F[(y * W + x) * 3 + c] = dark[c] + (lit[c] - dark[c]) * v;
    }
  const tx = (P.tx = 54 - 0.5 * P.tw), ty = (P.ty = 18.5 + 0.9 * P.tw);
  for (let s = 0; s <= 8; s++) {
    const u = s / 8, x = mix(57.5, tx, u) + 0.6 * sin(u * 3), y = mix(12, ty, u);
    set(x, y, wood);
    if (s >= 2 && (s - 2) * 1.5 < P.tl) set(x + (s & 1 ? 1 : -1), y, lit, 1, 1.35);
  }
}

// The giraffe's colours, the coat looked up by where on the body each LED lies.
function coat(P, C, tint) {
  const col = [0, 0, 0], { tex, tsh } = P;
  for (let i = 0; i < N; i++) {
    if (P.z[i] < 0) continue;
    const part = P.p[i], u = P.u[i], v = P.v[i];
    let k = 1 - 0.22 * v * v;
    if (part === MANE) for (let c = 0; c < 3; c++) col[c] = C.m[c] * (0.8 + 0.25 * (round(u) & 1));
    else if (part === TIP || part === TUFT || part === HOOF) col.splice(0, 3, ...(part === HOOF ? [70, 54, 44] : [52, 36, 28]));
    else if (part === TAIL) for (let c = 0; c < 3; c++) col[c] = C.m[c] * 1.3;
    else if (part === MUZ || part === OSS || part === EAR) for (let c = 0; c < 3; c++) col[c] = mix(C.l[c], C.p[c], part === MUZ ? 0.5 : 0.35) * (part === MUZ ? 0.78 : 1);
    else {
      let tx, ty, pale = 0;
      if (part === BODY) (tx = u * 1.05 + 3), (ty = v * 1.05), (k = 1.08 - 0.3 * sm(64, 84, v));
      else if (part === NECK) (tx = v * 6.2 + 77), (ty = u * 1.05 + 5);
      else if (part === HEAD) (tx = u * 1.6 + 40), (ty = v * 4 + 100), (pale = 0.15);
      else (tx = v * 3 + 100), (ty = u * (1 + u * 0.02) + 60), (pale = sm(18, 34, u) * (P.coat === 2 ? 1 : 0.55));
      const ti = ((floor(ty) & 127) << 7) | (floor(tx) & 127), pv = tex[ti] * (1 - pale), s = tsh[ti];
      for (let c = 0; c < 3; c++) col[c] = mix(mix(C.l[c], STOCK[c], pale), C.p[c] * s, pv);
    }
    if (part === LEGF) k *= 0.66;
    for (let c = 0; c < 3; c++) F[i * 3 + c] = col[c] * k * tint[c];
  }
  set(P.eye[0], P.eye[1], [24, 18, 14]);
}

// Dry grass rooted between rows y0 and y1, leaning and shaking on the wind.
function grass(P, tint, y0, y1) {
  const w = P.wind, gc = [226, 196, 116].map((v, c) => v * tint[c]), lw = 0.3 + 6 * w, gf = 1.6 + 2.5 * w;
  for (const [bx, by, bh, ph, kk] of P.blades) {
    if (by < y0 || by >= y1) continue;
    const lean = (lw * (0.7 + 0.3 * sin(P.t * gf + bx * 0.22 + ph * 0.3)) * bh) / 8, n = Math.ceil(bh);
    for (let s = 0, u; s <= n; s++) (u = s / n), set(bx + lean * u * u, by - u * bh, gc, 0.85, kk * (0.65 + 0.4 * u));
  }
}

// What is in front of the giraffe.
function front(P, tint, land) {
  const t = P.t, w = P.wind;
  if (P.ext > 0) {
    // Dark and long, out to the twig and curled round it.
    const n = 14 * P.ext, tg = [70, 44, 116], tx = P.tx - 0.4, ty = P.ty - 1.2;
    for (let s = 0; s <= n; s++) {
      const u = s / 14, a = u / 0.75;
      if (u < 0.75) set(mix(P.mx, tx, a), mix(P.my, ty, a) - sin(a * PI) * 1.2, tg);
      else set(tx + 1.4 * sin((u - 0.75) * 12), ty + 0.84 * (1 - cos((u - 0.75) * 12)), tg);
    }
  }
  // The oxpecker on the back of the neck.
  const J = P.neck, s = P.ox * 12, n = min(11, floor(s)), f = s - n, j = n * 3, lift = 1.8 + mix(J[j + 2], J[j + 5], f) + sin(P.hop * PI) * 1.5;
  const dx = J[j + 3] - J[j], dy = J[j + 4] - J[j + 1], dl = hyp(dx, dy) || 1, ax = dx / dl, ay = dy / dl;
  const bx = mix(J[j], J[j + 3], f) + ay * lift, by = mix(J[j + 1], J[j + 4], f) - ax * lift, br = [80, 62, 48].map((v, c) => v * tint[c]);
  set(bx, by, br), set(bx - ax, by - ay, br), set(bx - 2 * ax, by - 2 * ay, br, 1, 0.8);
  set(bx - ax - ay * 0.9, by - ay + ax * 0.9, [196, 170, 120]), set(bx + ax, by + ay, [240, 40, 28]);
  grass(P, tint, 117, H);
  // Dust on the wind: a veil low in the sky and drifts over the plain.
  const dc = land.map((v) => v * 1.15), sh = floor(t * (6 + 30 * w));
  for (let y = 36; y < H; y++) {
    const ka = (0.1 + w) * 0.7 * sm(70, 112, y), kv = w * 0.3 * sm(36, 96, y);
    for (let x = 0, a; x < W; x++) if ((a = kv + (y < 70 ? 0 : ka * cl(P.haze[(y - 70) * 128 + ((x - sh) & 127)] * 1.5 - 0.4, 0, 1))) > 0.01) set(x, y, dc, a);
  }
  for (const [x, y] of P.fall) set(x, y, P.leaf);
}

export function draw(display, params) {
  const P = params.g;
  if (!P || P.coat < 0) return;
  F = P.f;
  const C = COATS[P.coat], hh = cl(P.h, 0, 1) * 3, i0 = min(2, floor(hh)), L = SKY[i0].map((v, c) => mix(v, SKY[i0 + 1][c], hh - i0));
  const tint = [9, 10, 11].map((c) => L[c] * L[12]), land = C.land.map((v, c) => v * tint[c]);
  back(P, L, tint, land);
  tree(P, tint);
  grass(P, tint, 0, 117);
  giraffe(P);
  coat(P, C, tint);
  front(P, tint, land);
  // Whole numbers out, which the engine passes without boxing.
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
