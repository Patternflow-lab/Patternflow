// ===== Patternflow pattern =====
// Title:   Hairy Ball
// Family:  topology
// Idea:    A hairy sphere above a hairy doughnut, both turning in the light: however the sphere is combed, one or two cowlicks glow where its hair has nowhere to point, while the doughnut's hair lies smooth all the way round, and the small 2 and 0 are their Euler characteristics.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the hairy ball theorem (Henri Poincaré 1885, L. E. J. Brouwer 1912) and the Poincaré–Hopf index theorem (Heinz Hopf, 1926), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Length=8..13, Comb=-1..1
//
// Knob 1: Hue. Turns the blue sphere, the teal doughnut and the gold cowlicks round the colour wheel together.
// Knob 2: Speed. At 2 the sphere turns once in about 10 seconds and is combed again every 7, with two cowlicks far apart, then close together, then merged into one of index 2; at 0.2 everything runs ten times slower.
// Knob 3: Length. The hair length in LEDs, 8 to 13, each hair a little longer or shorter; long hair lies flatter.
// Knob 4: Comb. How the sphere's hair runs round its cowlicks: at -1 straight out of one and into the other, at 0 in a whorl, at 1 round and round them.
// Buttons: K1 tap combs the sphere and the doughnut again now; the hair sweeps to a new direction and the cowlicks jump somewhere else.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, sqrt, exp, cos, sin, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The sphere sits in the top half, the doughnut in the bottom half.
const SX = 32, SY = 31, RS = 24.5;
const TX = 32, TY = 97, TR = 18, TQ = 8.2;
// Roots spread evenly at the same density on both: the doughnut's area
// 4 pi^2 R r against the sphere's 4 pi R^2.
const NS = 1100, NT = round((NS * PI * TR * TQ) / (RS * RS));

// Fixed grain: a seeded generator used once, so the roots never move on the skin.
let seed = 0x9e3779b9;
function rnd() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Sphere roots on a jittered Fibonacci spiral, unit vectors.
const SP = new Float32Array(NS * 3), SJ = new Float32Array(NS * 2);
for (let i = 0; i < NS; i++) {
  const y = 1 - (2 * (i + 0.2 + 0.6 * rnd())) / NS, r = sqrt(max(0, 1 - y * y)), a = i * 2.39996323 + (rnd() - 0.5) * 0.9 * (2 / sqrt(NS)) / max(r, 0.05);
  SP[i * 3] = r * cos(a);
  SP[i * 3 + 1] = y;
  SP[i * 3 + 2] = r * sin(a);
  SJ[i * 2] = 0.8 + 0.35 * rnd();
  SJ[i * 2 + 1] = 0.75 + 0.4 * rnd();
}

// Doughnut roots: u round the ring, v round the tube, v drawn with density
// R + r cos v so the hair is as thick inside the hole as outside.
const TP = new Float32Array(NT * 3), TN = new Float32Array(NT * 3), TU = new Float32Array(NT * 3), TV = new Float32Array(NT * 3), TJ = new Float32Array(NT * 2);
for (let i = 0; i < NT; i++) {
  const u = 2 * PI * ((i * 0.7548776662 + 0.3 * rnd() / NT * 40) % 1), F = (i * 0.5698402910 + 0.5 + (rnd() - 0.5) * 0.02) % 1;
  let v = 2 * PI * F;
  for (let k = 0; k < 8; k++) v -= (TR * v + TQ * sin(v) - 2 * PI * TR * F) / (TR + TQ * cos(v));
  const cu = cos(u), su = sin(u), cv = cos(v), sv = sin(v), rr = TR + TQ * cv, o = i * 3;
  TP[o] = rr * cu, TP[o + 1] = rr * su, TP[o + 2] = TQ * sv;
  TN[o] = cv * cu, TN[o + 1] = cv * su, TN[o + 2] = sv;
  TU[o] = -su, TU[o + 1] = cu, TU[o + 2] = 0;
  TV[o] = -sv * cu, TV[o + 1] = -sv * su, TV[o + 2] = cv;
  TJ[i * 2] = 0.8 + 0.35 * rnd();
  TJ[i * 2 + 1] = 0.75 + 0.4 * rnd();
}

// 3x3 rotations, row major.
const mul = (A, B) => {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return C;
};
const rx = (a) => [1, 0, 0, 0, cos(a), -sin(a), 0, sin(a), cos(a)];
const ry = (a) => [cos(a), 0, sin(a), 0, 1, 0, -sin(a), 0, cos(a)];
const rz = (a) => [cos(a), -sin(a), 0, sin(a), cos(a), 0, 0, 0, 1];

// Light from the upper left, in front; H halfway to the eye.
const LX = -0.45 / 0.996, LY = -0.55 / 0.996, LZ = 0.7 / 0.996;
const HN = Math.hypot(LX, LY, LZ + 1), HX = LX / HN, HY = LY / HN, HZ = (LZ + 1) / HN;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c];
}

// The combs the sphere goes through: how far apart its two cowlicks stand
// (1 opposite each other, 0 merged into one zero of index 2) and the angle
// of the doughnut's hair (0 along the ring, pi/2 along the tube).
const PROG = [[0.55, 0.12], [0, 0.85], [1, -0.55], [0.3, 0.4], [0, -0.9], [1, 0.25]];

// The sphere's body turns about its own vertical axis, tipped toward the
// eye; the field turns inside it on its own, from the angles a.
const bodyM = (T) => mul(rx(-0.42 + 0.12 * sin(T * 0.21)), ry(T * 0.6));
const fieldM = (a, T) => mul(rz(a[0] + T * 0.09), mul(rx(a[1] + 0.5 * sin(T * 0.05 + 1)), rz(a[2])));
// The two zeros in field coordinates sit at w = +-t on the stereographic
// plane, symmetric about the south pole; t = 1 puts them opposite. Out
// come both as unit vectors in M's frame.
function zeros(M, t) {
  const t2 = t * t, Z = [];
  for (const sg of [1, -1]) {
    const fx = (2 * sg * t) / (1 + t2), fz = (t2 - 1) / (1 + t2);
    Z.push(M[0] * fx + M[2] * fz, M[3] * fx + M[5] * fz, M[6] * fx + M[8] * fz);
  }
  return Z;
}
// A new comb is turned so that a cowlick faces the eye for most of the
// seven units it lasts, both of them when they stand close enough.
function aim(T, sep, from) {
  let best = -9, pick = from;
  for (let c = 0; c < 40; c++) {
    const a = from.map((v) => v + (Math.random() < 0.5 ? -1 : 1) * (0.9 + 1.3 * Math.random()));
    let lo = 9, sum = 0;
    for (let j = 0; j < 5; j++) {
      const Tj = T + 0.8 + j * 1.5, Z = zeros(mul(bodyM(Tj), fieldM(a, Tj)), sep), v = max(Z[2], Z[5]) + 0.5 * min(Z[2], Z[5]);
      (lo = min(lo, v)), (sum += v);
    }
    const score = lo + sum / 5;
    if (score > best) (best = score), (pick = a);
  }
  return pick;
}

// 3x5 digits, one row of three bits per line, top first.
const DIG2 = [7, 1, 7, 4, 7], DIG0 = [7, 5, 5, 5, 7];
function digit(buf, rows, x0, y0, c) {
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 3; i++)
      if ((rows[j] >> (2 - i)) & 1) {
        const q = ((y0 + j) * W + x0 + i) * 3;
        for (let k = 0; k < 3; k++) buf[q + k] = 40 + 120 * c[k];
      }
}

export function setup(params) {
  const a = aim(-0.8, PROG[0][0], [0, 0, 0]);
  params.s = {
    T: 0, clock: 0, step: 0, a: a.slice(), ta: a,
    sep: PROG[0][0], al: PROG[0][1],
    hue: 0, len: 8, th: PI / 4,
    buf: new Float32Array(N * 3), zb: new Float32Array(N), zh: new Float32Array(N),
    cs: new Float32Array(3), ct: new Float32Array(3), cg: new Float32Array(3),
  };
}

function recomb(P) {
  P.step = (P.step + 1) % PROG.length;
  P.clock = 0;
  P.ta = aim(P.T, PROG[P.step][0], P.ta);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.len = cl(k[2], 8, 13);
  P.th = (PI / 4) * (1 + cl(k[3], -1, 1));
  const dT = d * cl(k[1], 0.2, 3) * 0.5;
  P.T += dT;
  P.clock += dT;
  if (input.btnPressed && input.btnPressed[0]) recomb(P);
  else if (P.clock > 7) recomb(P);
  const e = 1 - exp(-max(dT, d * 0.5) * 2.4), g = PROG[P.step];
  for (let i = 0; i < 3; i++) P.a[i] += (P.ta[i] - P.a[i]) * e;
  P.sep += (g[0] - P.sep) * e;
  P.al += (g[1] - P.al) * e;
}

// One hair: root (x, y, z) on screen, direction (hx, hy, hz) times its
// length, colour (r, g, b) at the tip; the root end is darker.
function hair(P, x, y, z, hx, hy, hz, r, g, b) {
  const n = max(2, ceil(Math.hypot(hx, hy) * 1.4) + 1), buf = P.buf, zb = P.zb, zh = P.zh;
  for (let j = 0; j < n; j++) {
    const s = j / (n - 1), X = floor(x + hx * s), Y = floor(y + hy * s);
    if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
    const p = Y * W + X, Z = z + hz * s;
    if (Z < zb[p] - 1.2 || Z <= zh[p]) continue;
    zh[p] = Z;
    const m = 0.22 + 0.78 * s * s, q = p * 3;
    buf[q] = r * m, buf[q + 1] = g * m, buf[q + 2] = b * m;
  }
}

// Hair light after Kajiya and Kay: a fibre is lit by how square it lies to
// the light and shines where it lies square to the half vector.
function shade(tx, ty, tz, nx, ny, nz) {
  const tl = tx * LX + ty * LY + tz * LZ, th = tx * HX + ty * HY + tz * HZ, nl = nx * LX + ny * LY + nz * LZ;
  const lam = 0.22 + 0.78 * max(0, nl), dif = sqrt(max(0, 1 - tl * tl)), sp = (1 - th * th) ** 12;
  return [lam * (0.35 + 0.65 * dif), 0.75 * sp * max(0, nl + 0.2)];
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const buf = P.buf, zb = P.zb, zh = P.zh, cs = P.cs, ct = P.ct, cg = P.cg, T = P.T;
  buf.fill(0);
  zb.fill(-1e9);
  zh.fill(-1e9);
  hsv(P.hue + 0.6, 0.75, 1, cs, 0);
  hsv(P.hue + 0.47, 0.8, 1, ct, 0);
  hsv(P.hue + 0.12, 0.6, 1, cg, 0);
  const pulse = 0.85 + 0.15 * sin(T * 3.1);

  // The sphere.
  const Mb = bodyM(T), Rf = fieldM(P.a, T), M = mul(Mb, Rf), t = P.sep, t2 = t * t, Z = zeros(M, t);
  // Skin: dark, with the cowlicks glowing through.
  const R2 = RS * RS;
  for (let y = max(0, floor(SY - RS)); y <= min(H - 1, ceil(SY + RS)); y++)
    for (let x = max(0, floor(SX - RS)); x <= min(W - 1, ceil(SX + RS)); x++) {
      const dx = x + 0.5 - SX, dy = y + 0.5 - SY, rr = dx * dx + dy * dy;
      if (rr >= R2) continue;
      const dz = sqrt(R2 - rr), nx = dx / RS, ny = dy / RS, nz = dz / RS, p = y * W + x, q = p * 3;
      zb[p] = dz;
      const lam = 0.08 + 0.22 * max(0, nx * LX + ny * LY + nz * LZ);
      const gl = exp(-(1 - (nx * Z[0] + ny * Z[1] + nz * Z[2])) / 0.05) + exp(-(1 - (nx * Z[3] + ny * Z[4] + nz * Z[5])) / 0.05);
      for (let c = 0; c < 3; c++) buf[q + c] = 255 * (cs[c] * lam + cg[c] * min(1, gl) * 0.9 * pulse);
    }
  // The field: v(w) = e^{i theta} (w^2 - t^2) on the plane, carried back to
  // the sphere. Its only zeros are w = t and w = -t, each of index 1; at
  // t = 0 they merge into one zero of index 2. There is always one.
  const kc = cos(P.th), ks = sin(P.th), L = P.len, lb = 0.35 - 0.02 * (L - 8);
  for (let i = 0; i < NS; i++) {
    const o = i * 3, bx = SP[o], by = SP[o + 1], bz = SP[o + 2];
    const nx = Mb[0] * bx + Mb[1] * by + Mb[2] * bz, ny = Mb[3] * bx + Mb[4] * by + Mb[5] * bz, nz = Mb[6] * bx + Mb[7] * by + Mb[8] * bz;
    if (nz < -0.3) continue;
    // Into field coordinates: f = Rf^T b.
    const fx = Rf[0] * bx + Rf[3] * by + Rf[6] * bz, fy = Rf[1] * bx + Rf[4] * by + Rf[7] * bz, fz = Rf[2] * bx + Rf[5] * by + Rf[8] * bz;
    const den = max(1e-7, 1 - fz), a = fx / den, b = fy / den, re = a * a - b * b - t2, im = 2 * a * b;
    const va = kc * re - ks * im, vb = ks * re + kc * im, s = 1 + a * a + b * b, qq = (a * va + b * vb) / s;
    let gx = va - 2 * a * qq, gy = vb - 2 * b * qq, gz = 2 * qq;
    const gn = Math.hypot(gx, gy, gz) || 1;
    gx /= gn, gy /= gn, gz /= gn;
    // Field direction on screen.
    const dx = M[0] * gx + M[1] * gy + M[2] * gz, dy = M[3] * gx + M[4] * gy + M[5] * gz, dz = M[6] * gx + M[7] * gy + M[8] * gz;
    // Near a zero the hair stands up and glows.
    const gl = min(1, exp(-(1 - (nx * Z[0] + ny * Z[1] + nz * Z[2])) / 0.07) + exp(-(1 - (nx * Z[3] + ny * Z[4] + nz * Z[5])) / 0.07));
    const lift = lb + 0.8 * gl, cL = cos(lift), sL = sin(lift);
    const hx = dx * cL + nx * sL, hy = dy * cL + ny * sL, hz = dz * cL + nz * sL, len = L * SJ[i * 2 + 1];
    const [li, sp] = shade(hx, hy, hz, nx, ny, nz), br = 255 * SJ[i * 2] * li, w = 255 * sp, gg = 255 * gl * pulse;
    hair(P, SX + RS * nx, SY + RS * ny, RS * nz, hx * len, hy * len, hz * len,
      cs[0] * br + w + cg[0] * gg, cs[1] * br + w + cg[1] * gg, cs[2] * br + w + cg[2] * gg);
  }

  // The doughnut, seen from about 40 degrees above, spinning on its
  // own axis and swaying. Its hair lies along cos(al) e_u + sin(al) e_v: no
  // zero anywhere, which the torus allows because its Euler characteristic is 0.
  const Mt = mul(ry(0.3 * sin(T * 0.13)), mul(rx(0.84 + 0.08 * sin(T * 0.17)), rz(T * 0.5)));
  const RO = TR + TQ, ox = Mt[6], oy = Mt[7], oz = Mt[8];
  for (let y = max(0, floor(TY - RO)); y <= min(H - 1, ceil(TY + RO)); y++)
    for (let x = max(0, floor(TX - RO)); x <= min(W - 1, ceil(TX + RO)); x++) {
      const dx = x + 0.5 - TX, dy = y + 0.5 - TY;
      if (dx * dx + dy * dy >= RO * RO) continue;
      // March a ray into the doughnut's own coordinates.
      const z0 = RO + 1;
      const px0 = Mt[0] * dx + Mt[3] * dy + Mt[6] * z0, py0 = Mt[1] * dx + Mt[4] * dy + Mt[7] * z0, pz0 = Mt[2] * dx + Mt[5] * dy + Mt[8] * z0;
      let tt = 0, hit = false, px = 0, py = 0, pz = 0;
      for (let it = 0; it < 40 && tt < 2 * z0; it++) {
        px = px0 - ox * tt, py = py0 - oy * tt, pz = pz0 - oz * tt;
        const qd = sqrt(px * px + py * py) - TR, dd = sqrt(qd * qd + pz * pz) - TQ;
        if (dd < 0.03) {
          hit = true;
          break;
        }
        tt += dd;
      }
      if (!hit) continue;
      const rl = sqrt(px * px + py * py) || 1, bx = (px - (TR * px) / rl) / TQ, by = (py - (TR * py) / rl) / TQ, bz = pz / TQ;
      const nx = Mt[0] * bx + Mt[1] * by + Mt[2] * bz, ny = Mt[3] * bx + Mt[4] * by + Mt[5] * bz, nz = Mt[6] * bx + Mt[7] * by + Mt[8] * bz;
      const p = y * W + x, q = p * 3, lam = 0.08 + 0.22 * max(0, nx * LX + ny * LY + nz * LZ);
      zb[p] = z0 - tt;
      for (let c = 0; c < 3; c++) buf[q + c] = 255 * ct[c] * lam;
    }
  const ca = cos(P.al), sa = sin(P.al), cL = cos(lb), sL = sin(lb);
  for (let i = 0; i < NT; i++) {
    const o = i * 3, bnx = TN[o], bny = TN[o + 1], bnz = TN[o + 2];
    const nx = Mt[0] * bnx + Mt[1] * bny + Mt[2] * bnz, ny = Mt[3] * bnx + Mt[4] * bny + Mt[5] * bnz, nz = Mt[6] * bnx + Mt[7] * bny + Mt[8] * bnz;
    const gx = ca * TU[o] + sa * TV[o], gy = ca * TU[o + 1] + sa * TV[o + 1], gz = ca * TU[o + 2] + sa * TV[o + 2];
    const dx = Mt[0] * gx + Mt[1] * gy + Mt[2] * gz, dy = Mt[3] * gx + Mt[4] * gy + Mt[5] * gz, dz = Mt[6] * gx + Mt[7] * gy + Mt[8] * gz;
    const bx = TP[o], by = TP[o + 1], bz = TP[o + 2];
    const X = Mt[0] * bx + Mt[1] * by + Mt[2] * bz, Y = Mt[3] * bx + Mt[4] * by + Mt[5] * bz, Zz = Mt[6] * bx + Mt[7] * by + Mt[8] * bz;
    const hx = dx * cL + nx * sL, hy = dy * cL + ny * sL, hz = dz * cL + nz * sL, len = L * TJ[i * 2 + 1];
    const [li, sp] = shade(hx, hy, hz, nx, ny, nz), br = 255 * TJ[i * 2] * li, w = 255 * sp;
    hair(P, TX + X, TY + Y, Zz, hx * len, hy * len, hz * len, ct[0] * br + w, ct[1] * br + w, ct[2] * br + w);
  }

  // The Euler characteristic beside each: 2 for the sphere, 0 for the torus.
  digit(buf, DIG2, 59, 2, cs);
  digit(buf, DIG0, 59, 121, ct);
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, buf[p]), min(255, buf[p + 1]), min(255, buf[p + 2]));
}
