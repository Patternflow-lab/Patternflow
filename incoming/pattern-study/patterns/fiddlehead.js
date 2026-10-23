// ===== Patternflow pattern =====
// Title:   Fiddlehead
// Family:  growth
// Idea:    A spring time-lapse on a woodland floor: furred fern croziers push up through last year's leaves and unroll from the bottom up into tall arching fronds, each side leaflet uncurling from its own little spiral, while old fronds brown and fall back and light through the canopy slides over them.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after time-lapse films of ostrich fern croziers unrolling in spring
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Fern=0..3, Speed=0.2..3, Fronds=6..18, Breeze=-1..1
//
// Knob 1: Fern. Ostrich fern at 0, a shuttlecock of bright green round last year's brown fertile fronds; cinnamon fern at 1 with white-woolly croziers; bracken at 2, broad blades tipped flat on tall stalks; autumn fern at 3, whose new fronds come up copper-red and green as they age.
// Knob 2: Speed. How fast the time-lapse runs: at 2 a crozier takes about thirteen seconds to unroll and a frond lives about half a minute; at 0.2 it creeps.
// Knob 3: Fronds. How many fronds there are, six in one crown at 6, then a crown either side, then two more crowns further back in the shade at 18.
// Knob 4: Breeze. Near still at 0.06; turned either way the fronds lean and sway that way and the sunflecks from the canopy slide across faster.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, sqrt, hypot, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
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

// Each fern: young leaf, grown leaf, rachis, crozier, fur, fertile frond (rgb), then the
// share of stalk below the blade, pinna length, where the blade is widest, lean, arch,
// coil tightness, fur, how far a crown spreads, fertile frond height, pinna angle, and
// how slowly the young colour greens.
const FERNS = [
  [160, 226, 70, 44, 150, 48, 104, 164, 60, 104, 178, 58, 196, 140, 84, 92, 58, 36, 0.2, 0.13, 0.62, 0.3, 1.5, 0.15, 0.5, 4, 30, 1.05, 0.5],
  [184, 220, 100, 92, 178, 58, 150, 176, 96, 140, 150, 110, 236, 226, 210, 200, 106, 40, 0.3, 0.12, 0.45, 0.17, 0.9, 0.17, 1, 2.5, 40, 1.15, 0.5],
  [130, 184, 80, 44, 124, 70, 128, 156, 84, 90, 122, 60, 190, 178, 156, 0, 0, 0, 0.46, 0.2, 0.04, 0.08, 1.6, 0.11, 0.7, 9, 0, 1.2, 0.5],
  [238, 108, 50, 66, 140, 54, 164, 96, 54, 130, 62, 34, 64, 40, 28, 0, 0, 0, 0.26, 0.15, 0.3, 0.28, 1.15, 0.15, 0.8, 2, 0, 1.0, 1.4],
];
// A frond's life in world seconds at Speed 2: coming up, unrolling, standing, falling, gone.
const [EM, UN, HO, FA, GP] = [2, 13, 7, 4, 1];
const CYC = EM + UN + HO + FA + GP;
// Crowns as x and depth, and which crown each slot belongs to in the order Fronds adds them.
const CROWN = [[32, 1], [10, 0.93], [54, 0.93], [21, 0.72], [43, 0.72]];
const SLOT = [0, 0, 0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 3, 4, 3, 4, 3, 4];
// Which way each slot leans: the side crowns lean in over the middle, mostly.
const LEAN = [-1, 1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1];
// Where in its life each frond is at 2 s: the front crown has one of each, the others are
// mostly up, so turning Fronds at the start shows.
const OPEN = [0.02, 0.146, 0.267, 0.41, 0.59, 0.7, 0.62, 0.45, 0.7, 0.3, 0.76, 0.52, 0.65, 0.4, 0.58, 0.3, 0.72, 0.5];
const SEN = [[204, 176, 64], [132, 74, 36]];
const HAZE = [34, 52, 44];
const MAXS = 340;
// A snail on the litter, facing right: shell light and dark, body, eye stalks.
const SNAIL = ["..sss.....", ".sSSSs.t.t", ".sSsSs..bB", ".sSssBBBBB", "bBBBBBBBBb"];
const SNC = { S: [176, 128, 70], s: [96, 62, 34], B: [150, 140, 118], b: [110, 100, 86], t: [70, 62, 54] };
const RX = new Float32Array(MAXS), RY = new Float32Array(MAXS), RT = new Float32Array(MAXS), RW = new Float32Array(MAXS);

function build(P) {
  const { bg, gnd } = P;
  for (let x = 0; x < W; x++) gnd[x] = 110 + 3 * vn(x * 0.11, 5.5) + 1.6 * vn(x * 0.37, 2.2);
  // The wood behind: dark under the canopy, hazier and warmer near the floor.
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, v = cl(y / 112, 0, 1) ** 1.6, f = vn(x * 0.09, y * 0.06) * 0.6 + vn(x * 0.27, y * 0.19) * 0.4;
    const k = 0.72 + 0.55 * f;
    bg.set([mix(20, 44, v) * k, mix(40, 54, v) * k, mix(38, 38, v) * k], p * 3);
  }
  // Beech trunks, smooth and grey, lit from the right; the far ones go into the haze.
  for (const [tx, tw, z] of [[3, 8, 1], [47, 4.5, 0.62], [60, 3, 0.45]])
    for (let y = 0; y < 116; y++)
      for (let x = floor(tx - tw / 2); x <= tx + tw / 2; x++) {
        if (x < 0 || x >= W || y > gnd[x] + 1) continue;
        const n = (x - tx) / (tw / 2), l = (0.55 + 0.4 * n) * (0.85 + 0.25 * vn(x * 0.8, y * 0.05)) * (y > gnd[x] - 8 ? 0.8 : 1);
        const moss = y > gnd[x] - 6 - 4 * vn(x, 9) ? 1 : 0, o = (y * W + x) * 3;
        const c = moss ? [52, 92, 34] : [84, 86, 78];
        for (let i = 0; i < 3; i++) bg[o + i] = mix(bg[o + i], mix(c[i] * l, HAZE[i], 1 - z), 0.9);
      }
  // The canopy overhead, with holes the shafts come through.
  for (let p = 0; p < 18 * W; p++) {
    const x = p & 63, y = p >> 6, h = sm((vn(x / 4, y / 3 + 50) * 0.7 + vn(x / 1.7, y / 1.4 + 70) * 0.3 - 0.52) * 5), a = (1 - h) * sm((17 - y - 7 * vn(x / 5, 3.3)) / 4), k = 0.6 + 0.7 * vn(x / 1.6, y / 1.3);
    P.hole[p] = h * (1 - y / 18);
    for (let i = 0; i < 3; i++) bg[p * 3 + i] = mix(bg[p * 3 + i], [16, 34, 20][i] * k, a);
  }
  // Last year's leaves: beech copper, oak brown, pale skeletons and dark wet ones.
  const LC = [[124, 76, 40], [98, 62, 34], [140, 110, 74], [66, 44, 30], [96, 84, 70], [130, 90, 48]];
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, d = y - gnd[x];
    if (d >= 0) bg.set([44 - d * 0.6, 28 - d * 0.4, 18 - d * 0.2], p * 3);
  }
  const leaf = (cx, cy, a, rx, ry, c, put) => {
    const ca = cos(a), sa = sin(a), t = 0.8 + rnd() * 0.35;
    for (let y = floor(cy - rx); y <= cy + rx; y++)
      for (let x = floor(cx - rx); x <= cx + rx; x++) {
        const dx = x - cx, dy = y - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry, r = u * u + v * v * (1 + 0.6 * u);
        if (r > 1 || x < 0 || x >= W || y >= H) continue;
        const k = t * (abs(v) < 0.22 && abs(u) < 0.85 ? 0.7 : r > 0.65 ? 0.78 : 1) * (1 + 0.15 * u);
        put(x, y, c[0] * k, c[1] * k, c[2] * k);
      }
  };
  const putBg = (x, y, r, g, b) => y >= gnd[x] - 1 && bg.set([r, g, b], (y * W + x) * 3);
  for (let n = 0; n < 170; n++) {
    const cx = rnd() * 68 - 2, top = gnd[cl(round(cx), 0, W - 1)];
    leaf(cx, top + rnd() * (H - top + 2) - 0.5, rnd() * PI, 2 + rnd() * 1.8, 1.1 + rnd() * 0.8, LC[floor(rnd() * 6)], putBg);
  }
  // Moss cushions and twigs.
  for (let n = 0; n < 7; n++) {
    const cx = rnd() * 64, cy = gnd[floor(cx)] + 2 + rnd() * 12, r = 1.5 + rnd() * 2.5;
    for (let y = floor(cy - r); y <= cy + r; y++)
      for (let x = floor(cx - r); x <= cx + r; x++)
        if (x >= 0 && x < W && y < H && hypot(x - cx, (y - cy) * 1.4) < r && hash(x, y) < 0.85) {
          const k = 0.7 + 0.5 * hash(y, x);
          bg.set([50 * k, 104 * k, 36 * k], (y * W + x) * 3);
        }
  }
  for (let n = 0; n < 7; n++) {
    let x = rnd() * 64, y = gnd[floor(x)] + 1 + rnd() * 14;
    const a = (rnd() - 0.5) * 0.8, dir = rnd() < 0.5 ? -1 : 1;
    for (let i = 0, len = 6 + rnd() * 12; i < len; i++, x += dir * cos(a), y += sin(a)) {
      const xi = round(x), yi = round(y);
      if (xi >= 0 && xi < W && yi < H) bg.set([62, 46, 36], (yi * W + xi) * 3);
    }
  }
  // Last year's fronds, flattened and rusty on top of the leaves.
  for (const [sx, dir, len] of [[6, 1, 24], [58, -1, 20], [36, -1, 16]]) {
    for (let i = 0; i < len; i++) {
      const x = sx + dir * i, y = round(gnd[cl(x, 0, W - 1)] + 2 + i * 0.12);
      if (x < 0 || x >= W) continue;
      bg.set([96, 58, 32], (y * W + x) * 3);
      if (i % 2 && i < len - 2) for (const s of [-1, 1]) for (let j = 1; j < 4 - i / len * 2; j++) {
        const px = x + dir * j * 0.6, py = y + s * j;
        if (px >= 0 && px < W && py < H) bg.set([124, 72, 36], (round(py) * W + round(px)) * 3);
      }
    }
  }
  // Leaves in front of the crowns, laid over the stalks where they come out.
  const fa = P.fa, fc = P.fc;
  for (let n = 0; n < 26; n++) {
    const cx = CROWN[n % 5][0] + (rnd() - 0.5) * 16, top = gnd[cl(round(cx), 0, W - 1)];
    leaf(cx, top + 1 + rnd() * 2.5, (rnd() - 0.5) * 0.9, 2 + rnd() * 1.5, 1 + rnd() * 0.6, LC[floor(rnd() * 6)], (x, y, r, g, b) => {
      fa[y * W + x] = 1;
      fc.set([r, g, b], (y * W + x) * 3);
    });
  }
  // Canopy gaps: the shafts one way, the dapple in them the other.
  for (let n = 0; n < 12; n++) {
    const c = n * 21.3 + rnd() * 12, w = 2.5 + rnd() * 5, a = 0.5 + rnd() * 0.5;
    for (let i = 0; i < 256; i++) P.gap[i] = min(1, P.gap[i] + a * Math.exp(-(((((i - c + 384) % 256) - 128) / w) ** 2)));
  }
  for (let i = 0; i < 128 * 64; i++) P.dap[i] = sm((vn((i & 127) / 7, (i >> 7) / 5) * 0.7 + vn((i & 127) / 3, (i >> 7) / 2.5 + 30) * 0.3 - 0.3) * 2.2);
  P.anem = [[15, 6], [18, 8], [21, 5], [45, 5], [48, 7], [58, 6]].map(([x, h]) => [x, h, rnd() * 7]);
  P.mote = Array.from({ length: 16 }, () => [rnd() * 64, rnd() * 110, rnd() * 7]);
}

let BUF;
function px(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  BUF[o] += (r - BUF[o]) * a;
  BUF[o + 1] += (g - BUF[o + 1]) * a;
  BUF[o + 2] += (b - BUF[o + 2]) * a;
}
// A soft dot over four LEDs, so a curve moving a fraction of an LED still moves.
function dot(x, y, r, g, b, a) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  if (xi < 0 || xi > W - 2 || yi < 0 || yi > H - 2) {
    px(xi, yi, r, g, b, a * (1 - fx) * (1 - fy));
    px(xi + 1, yi, r, g, b, a * fx * (1 - fy));
    px(xi, yi + 1, r, g, b, a * (1 - fx) * fy);
    return px(xi + 1, yi + 1, r, g, b, a * fx * fy);
  }
  const B = BUF;
  for (let k = 0, o = (yi * W + xi) * 3; k < 4; k++) {
    const w = a * (k & 1 ? fx : 1 - fx) * (k & 2 ? fy : 1 - fy), q = o + (k & 1 ? 3 : 0) + (k & 2 ? W * 3 : 0);
    if (w > 0.02) (B[q] += (r - B[q]) * w), (B[q + 1] += (g - B[q + 1]) * w), (B[q + 2] += (b - B[q + 2]) * w);
  }
}
function disc(x, y, rad, r, g, b, a) {
  if (rad < 0.75) return dot(x, y, r, g, b, a);
  for (let yy = floor(y - rad); yy <= y + rad + 1; yy++)
    for (let xx = floor(x - rad); xx <= x + rad + 1; xx++) {
      const d2 = (xx - x) ** 2 + (yy - y) ** 2;
      if (d2 < (rad + 0.5) ** 2) px(xx, yy, r, g, b, a * min(1, rad + 0.5 - sqrt(d2)));
    }
}

// Where a slot is in its life now, and the frond's shape from that.
function frondAt(P, S) {
  const sp = P.sp, T = P.t + S.off, c = floor(T / S.cyc), a = ((T - c * S.cyc) / S.cyc) * CYC;
  if (a >= EM + UN + HO + FA) return null;
  const h = (m) => hash(S.j * 13 + m, c + 977), cx = CROWN[S.c][0], dep = S.z;
  const Lf = (dep > 0.86 ? 104 : 86) * (0.84 + 0.26 * h(1)), x = cx + (h(2) - 0.5) * 2 * sp[25];
  const stipe = 5 + Lf * 0.05, C0 = Lf * 0.5;
  let U, C, g = 1, fall = 0, sen = 0, fade = 1;
  if (a < EM) {
    const e = a / EM;
    [g, U, C] = [0, stipe * e, C0 * (0.4 + 0.6 * e)];
  } else if (a < EM + UN) {
    g = (a - EM) / UN;
    [U, C] = [stipe + (Lf - stipe) * g ** 1.25, C0 * (1 - g) ** 0.8];
  } else {
    [U, C] = [Lf, 0];
    const ph = (a - EM - UN - HO) / FA;
    // It yellows and browns where it stands, then folds down onto the litter and fades into it.
    if (ph > 0) [fall, sen, fade] = [sm((ph - 0.3) / 0.55), sm(ph * 2), 1 - sm((ph - 0.7) / 0.3)];
  }
  const lean = sp[21] * (0.55 + 0.8 * h(3)) * (S.c ? 1.2 : 1);
  const wind = P.wind * 1.1 + (0.16 + 0.3 * abs(P.wind)) * sin(P.t * 1.3 + S.ph) + 0.1 * sin(P.t * 0.37 + S.c);
  return {
    x, y: P.gnd[cl(round(x), 0, W - 1)] + 0.5, o: S.o, th0: S.o * (lean + 1.5 * fall), L: U + C, f: U, Lf, dep, g, fall, sen, fade, wind,
    k: sp[23] * (0.9 + 0.2 * h(4)), arch: sp[22] * (0.7 + 0.5 * h(5)) * sm(g * 1.3 - 0.1) * (1 + 0.6 * fall),
    hp: a < EM + UN ? 0 : min(1, (a - EM - UN) / HO), seed: S.j * 31 + c, hv: h(6) * 2 - 1,
  };
}

// A frond's colours are c * ta + tb: browning as it dies, darker and hazier further back.
function tint(F) {
  const s = F.sen, k = 0.48 + 0.52 * F.dep, z = (1 - F.dep) * 0.5;
  F.ta = (s < 0.5 ? 1 - s * 2 : 0) * k * (1 - z);
  F.tb = HAZE.map((hz, i) => (s < 0.5 ? s * 2 * SEN[0][i] : mix(SEN[0][i], SEN[1][i], s * 2 - 1)) * k * (1 - z) + hz * z);
}

// One pinna: straight for the share that has opened, then its own little spiral.
function pinna(x, y, th, len, q, sd, r, g, b, a, lobe) {
  const st = 0.75, open = len * q, n = ceil(len / st);
  for (let j = 1; j <= n; j++) {
    const s = j * st, w = s > open ? sm((s - open) / 1.5) : 0;
    th -= sd * (w / (0.2 * (len - s) + 0.5) + 0.03) * st;
    x += sin(th) * st;
    y -= cos(th) * st;
    px(round(x), round(y), r, g, b, a);
    // Pinnules: a lobe either side in turn, gone towards the tip.
    if (j & 1 && w < 0.5 && s < len * lobe) {
      const e = j & 2 ? sd : -sd;
      px(round(x - e * cos(th)), round(y - e * sin(th)), r * 0.8, g * 0.85, b * 0.8, a * 0.55);
    }
  }
}

function frond(P, F, vis) {
  const sp = P.sp, ds = 0.5, n = min(MAXS - 1, ceil(F.L / ds)), sig = -F.o, a0 = F.fade * vis;
  tint(F);
  const { ta, tb } = F, fr = sp[12] * ta + tb[0], fg = sp[13] * ta + tb[1], fb = sp[14] * ta + tb[2];
  let x = F.x, y = F.y, th = F.th0;
  // The rachis: a log spiral above the unrolling front, whose curl relaxes to an arch below it.
  for (let i = 0; i <= n; i++) {
    const s = i * ds, u = s / F.L, w = s > F.f ? sm((s - F.f) / 5) : 0;
    (RX[i] = x), (RY[i] = y), (RT[i] = th), (RW[i] = w);
    th += ((w * sig) / (F.k * (F.L - s) + 0.7) + (1 - w) * ((F.o * F.arch * 5 * u * u * u * u) / F.L + (F.wind * 2 * u * cos(th)) / F.L)) * ds;
    x += sin(th) * ds;
    y -= cos(th) * ds;
    const gy = P.gnd[cl(round(x), 0, W - 1)] + 1;
    if (y > gy) y = gy;
  }
  // Pinnae, the ones nearest the coil still curled.
  const sb = F.L * sp[18], np = max(4, round((F.Lf * (1 - sp[18])) / 3.8)), Pm = sp[19] * F.Lf, D = 0.24 * F.Lf, al = sp[27], lobe = 0.75;
  for (let i = 0; i < np; i++) {
    const u = (i + 0.5) / np, s = sb + (F.L - sb) * u;
    if (s > F.f - 0.5) break;
    const q = cl((F.f - s) / D, 0, 1), ii = round(s / ds), bu = sp[20];
    const shape = u < bu ? 0.1 + 0.9 * sin(((PI / 2) * u) / bu) : 0.06 + 0.94 * cos(((PI / 2) * (u - bu)) / (1 - bu)) ** 0.7;
    const len = Pm * shape * (0.55 + 0.45 * q) * (1 - 0.3 * F.fall), m = cl(((F.f - s) / F.Lf) * 0.8 + (F.hp * 1.2) / sp[28], 0, 1);
    // No two fronds quite the same green: some yellower, some bluer.
    const r = mix(sp[0], sp[3], m) * ta * (1 + 0.22 * F.hv) + tb[0], g = mix(sp[1], sp[4], m) * ta + tb[1], b = mix(sp[2], sp[5], m) * ta * (1 - 0.3 * F.hv) + tb[2];
    for (let sd = -1; sd < 2; sd += 2) pinna(RX[ii], RY[ii], RT[ii] + sd * al * (0.45 + 0.55 * q), len, q, sd, r, g, b, a0, lobe);
  }
  // Rachis over them, swelling into the furred coil.
  const rw = 0.45 + 0.35 * F.dep;
  for (let i = 0; i <= n; i++) {
    const s = i * ds, u = s / F.L, w = RW[i], base = sm(1 - s / 10);
    // The stalk is thin enough to draw every other step; the coil needs them all.
    if (i & 1 && w === 0 && s < F.f - 6) continue;
    const rad = mix(rw * (1 - 0.6 * u), cl(0.17 * (F.k * (F.L - s) + 0.7), 0.5, 1.25), w);
    const r = mix(mix(sp[6], sp[9], w), 96, base) * ta + tb[0], g = mix(mix(sp[7], sp[10], w), 70, base) * ta + tb[1], b = mix(mix(sp[8], sp[11], w), 40, base) * ta + tb[2];
    disc(RX[i], RY[i], rad, r, g, b, a0);
    // The scroll catches the light on its upper side.
    if (w > 0.5 && i & 1) dot(RX[i] - rad * 0.35, RY[i] - rad * 0.5, r * 1.35 + 20, g * 1.3 + 16, b * 1.2 + 6, a0 * 0.45);
    const ti = round((F.L - s) / ds);
    if ((w > 0.1 || s > F.f - 6) && F.g < 1 && hash(ti, F.seed) < sp[24] * 0.9) {
      const fo = -sig * (rad + 0.5 + hash(ti + 7, F.seed) * 0.9);
      dot(RX[i] + cos(RT[i]) * fo, RY[i] + sin(RT[i]) * fo, fr, fg, fb, a0 * 0.85);
    }
  }
}

// Last year's fertile fronds stand stiff in the middle of a crown.
function fertile(P, cx, dep) {
  const sp = P.sp, hh = sp[26] * dep;
  if (hh < 3) return;
  for (let m = 0; m < 2; m++) {
    let x = cx + (m ? 1.2 : -1), y = P.gnd[round(cx)] + 1, th = (m ? 0.1 : -0.12) + P.wind * 0.04;
    const k = 0.5 + 0.5 * dep, hm = hh * (m ? 1 : 0.82);
    for (let s = 0; s < hm; s += 0.6) {
      x += sin(th) * 0.6;
      y -= cos(th) * 0.6;
      dot(x, y, sp[15] * k * 0.7, sp[16] * k * 0.7, sp[17] * k * 0.7, 0.9);
      if (s > hm * 0.3 && floor(s / 1.2) & 1) {
        const lw = 0.7 + 1.4 * (1 - s / hm);
        for (const sd of [-1, 1]) dot(x + sd * lw, y + 0.4, sp[15] * k, sp[16] * k, sp[17] * k, 0.85);
      }
    }
  }
}

export function setup(params) {
  const P = params;
  Object.assign(P, { bg: new Float32Array(N * 3), buf: new Float32Array(N * 3), fa: new Uint8Array(N), fc: new Float32Array(N * 3), gnd: new Float32Array(W), gap: new Float32Array(256), dap: new Float32Array(128 * 64), hole: new Float32Array(18 * W), vis: new Float32Array(18), t: 0, off: 0, doff: 0, kf: -1, sn: 40, sp: FERNS[0] });
  build(P);
  P.slots = SLOT.map((c, j) => {
    const cyc = CYC * (0.92 + 0.16 * rnd());
    return { j, c, o: LEAN[j], cyc, off: OPEN[j] * cyc - 8, ph: rnd() * 7, z: CROWN[c][1] - rnd() * 0.14 };
  });
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 6, 0.06], d0 = cl(dt, 0, 0.1);
  const kf = cl(k[0], 0, 3), rate = cl(k[1], 0.2, 3) / 2, n = round(cl(k[2], 6, 18)), wind = cl(k[3], -1, 1);
  if (kf !== P.kf) {
    // Each fern holds over most of its stretch of the knob and turns into the next near the middle.
    const i = min(2, floor(kf)), f = sm((kf - i) * 2.5 - 0.75);
    P.sp = FERNS[i].map((v, c) => mix(v, FERNS[i + 1][c], f));
    P.kf = kf;
  }
  // The world clock starts further in the faster the time-lapse runs.
  if (!P.t) {
    P.t = 6 * rate;
    for (let j = 0; j < n; j++) P.vis[j] = 1;
  }
  const d = d0 * rate;
  P.t += d;
  P.wind = wind;
  // The sun crosses and the canopy sways: the shafts slide, the dapple shivers.
  P.off += d * (2.2 + 9 * abs(wind)) * (wind < -0.05 ? -1 : 1);
  P.doff = P.t * (1 + 6 * abs(wind)) * (wind < -0.05 ? 1 : -1) + 2 * sin(P.t * 1.7);
  for (let j = 0; j < 18; j++) P.vis[j] = cl(P.vis[j] + (j < n ? 2 : -2) * d0, 0, 1);
  P.sn += d * 1.4 * (wind < -0.05 ? -1 : 1);
  if (P.sn > 70) P.sn = -12;
  if (P.sn < -12) P.sn = 70;
}

export function draw(display, params) {
  const P = params, { buf, gnd, fa, fc } = P;
  BUF = buf;
  buf.set(P.bg);
  const on = [0, 0, 0, 0, 0];
  for (const S of P.slots) if (P.vis[S.j] > 0) on[S.c] = 1;
  for (let c = 4; c >= 0; c--) if (on[c]) fertile(P, CROWN[c][0], CROWN[c][1]);
  // Open fronds first, so the croziers coming up in the middle of a crown stay in sight.
  const fr = [];
  for (const S of P.slots) {
    const F = P.vis[S.j] > 0 && frondAt(P, S);
    if (F) (F.vis = P.vis[S.j]), (F.key = S.z + (F.g < 1) * 0.3 - F.fall * 0.2), fr.push(F);
  }
  for (const F of fr.sort((a, b) => a.key - b.key)) frond(P, F, F.vis);
  for (let p = 100 * W, o = p * 3; p < N; p++, o += 3) if (fa[p]) (buf[o] = fc[o]), (buf[o + 1] = fc[o + 1]), (buf[o + 2] = fc[o + 2]);
  // Wood anemones nodding in the breeze.
  for (const [ax, ah, ph] of P.anem) {
    const sw = P.wind * 1.6 + 0.5 * sin(P.t * 1.6 + ph);
    let x = ax, y = round(gnd[ax]) + 1;
    for (let j = 0; j < ah; j++) {
      (x += (sw * j) / ah / ah), y--, px(round(x), y, 70, 110, 44, 1);
      // The ruff of three cut leaves halfway up the stalk.
      if (j === 2) for (const dx of [-2, -1, 1, 2]) px(round(x) + dx, y + (abs(dx) > 1), 58, 112, 40, 0.9);
    }
    const fx = round(x + sw * 0.4), fy = y - 1;
    for (const [dx, dy, l] of [[0, 0, 1], [-1, 0, 0.9], [1, 0, 0.9], [0, -1, 0.85], [-1, -1, 0.5], [1, -1, 0.5], [0, 1, 0.6]]) px(fx + dx, fy + dy, 236 * l, 236 * l, 226 * l, 1);
    px(fx, fy, 240, 210, 70, 1);
  }
  // The snail, quick in the time-lapse.
  const sx = round(P.sn), sy = round(gnd[cl(sx + 4, 0, W - 1)]) - 4, f = P.wind < -0.05 ? -1 : 1;
  SNAIL.forEach((row, r) => {
    for (let c = 0; c < 10; c++) {
      const col = SNC[row[c]];
      if (col) px(f > 0 ? sx + c : sx + 9 - c, sy + r, col[0], col[1], col[2], 1);
    }
  });
  // Motes in the shafts.
  for (const [mx, my, ph] of P.mote) {
    const x = (((mx + P.t * 0.7 + 3 * sin(P.t * 0.3 + ph)) % 64) + 64) % 64, y = (my + 110 - ((P.t * 1.1 + ph * 9) % 110)) % 110;
    const l = P.gap[floor(x + y * 0.42 - P.off) & 255];
    if (l > 0.3) dot(x, y, 255, 236, 180, l * 0.6);
  }
  show(display, P);
}

// To the panel, under the light that gets through the canopy.
function show(display, { buf, gap, dap, off, doff, hole }) {
  const o0 = floor(doff);
  for (let y = 0, p = 0; y < H; y++) {
    const hz = 0.5 * (1 - y / 150), dr = ((y >> 1) & 63) * 128;
    for (let x = 0; x < W; x++, p++) {
      const u = x + y * 0.42 - off, ui = floor(u), f = u - ui, s = gap[ui & 255] * (1 - f) + gap[(ui + 1) & 255] * f;
      const l = s * (0.4 + 0.6 * dap[dr + ((x + o0) & 127)]), m = 0.78 + 0.75 * l, o = p * 3, sky = y < 18 ? hole[p] * (0.25 + s) * 150 : 0;
      const r = buf[o] * m * (1 + 0.08 * l) + 34 * s * hz + sky, g = buf[o + 1] * m + 30 * s * hz + sky * 1.08, b = buf[o + 2] * m * (1 - 0.1 * l) + 16 * s * hz + sky * 0.9;
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
