// ===== Patternflow pattern =====
// Title:   Baba Yaga's Hut
// Family:  halloween
// Idea:    In a moonlit birch forest a log hut on giant chicken legs paces behind a fence of skulls with glowing green eyes, knees bending backward at every step, swaying, crouching and turning round, while Baba Yaga crosses the moon in her mortar, steering with the pestle and sweeping her trail away with a broom.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 53, after Baba Yaga's hut on chicken legs in Slavic folklore
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Legs=0..1, Fog=0..1
//
// Knob 1: Hue. The night: violet at 0, then indigo, blue and teal to a sickly green at 1. The windows stay orange, the eyes green and the birches pale.
// Knob 2: Speed. At 2 the hut walks a step every 0.7 seconds and goes once round its round of pacing, turning and crouching in 14 seconds, and Baba Yaga crosses the moon every 12; at 0.2 all of it ten times slower.
// Knob 3: Legs. How long the legs are: at 0 they hold the floor of the hut 38 LEDs off the ground, at 1 they lift it 62, so the roof stands in front of the moon.
// Knob 4: Fog. Thin wisps over the ground at 0.06; turned up, a moonlit bank rises to the hut's knees, then hides the legs, the eyes of the skulls glowing green through it.
// Buttons: K1 tap: the hut turns its front to us, kneels and opens its door on the fire inside, then gets up and goes on.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const NT = new Float32Array(4096).map((_, i) => hash(i * 7 + 3));
function vn(x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const i0 = xi & 63, i1 = (xi + 1) & 63, j0 = (yi & 63) << 6, j1 = ((yi + 1) & 63) << 6, a = NT[j0 + i0], b = NT[j0 + i1], c = NT[j1 + i0];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + NT[j1 + i1]) * ux * uy;
}

// The row the feet stand on; the moon; the hut's half width across its
// front and half depth along its sides, the wall and roof heights, the
// eaves' overhang and the hips either side of its middle.
const GY = 106, MX = 21, MY = 24, MR = 17;
const A = 12, B = 15, WALL = 20, ROOF = 12, OVER = 1.5, HIP = 5.5;
// Birch trunks: middle, width, how near (1 near and bright), lean per row.
const BIRCH = [[3, 5, 0.9, 0.01], [13, 2.5, 0.5, -0.02], [36, 2, 0.4, 0.015], [42, 3, 0.62, -0.01], [51, 2.5, 0.45, 0.02], [60, 6, 1, -0.012], [27, 3.5, 0.7, 0.008]];
const SKULLS = [7, 24, 41, 58];
const groundAt = (x) => 103 + 1.2 * sin(x * 0.21) + 0.8 * sin(x * 0.53 + 1);
// The round the hut walks, in seconds at Speed 2: [length, facing from, to,
// middle from, to, how hard it steps, crouch]. Facing 0 is its door to us,
// 90 walking right.
const SEG = [
  [2.2, 90, 90, 24, 40, 1, 0],
  [1.4, 90, 0, 40, 40, 0.8, 0],
  [3.2, 0, 0, 40, 40, 0, 1],
  [1.4, 0, -90, 40, 40, 0.8, 0],
  [2.2, -90, -90, 40, 24, 1, 0],
  [2.4, -90, -270, 24, 24, 0.8, 0],
  [1.2, 90, 90, 24, 24, 0, 0],
];
const LOOP = SEG.reduce((s, g) => s + g[0], 0), STEP = 1.4;

export function setup(params) {
  params.s = {
    hue: -1, legs: 0, fog: 0.06, t: 0, ct: 0, call: 0,
    phi: 90, X: 24, c: 0, dr: 0, act: 1, v: 0, gp: 0,
    puffs: [], dust: [], fly: null, nf: 0.8, nfl: 0,
    bg: new Float32Array(N * 3), F: new Float32Array(N * 3), fogc: [0, 0, 0],
  };
}

// Sky, moon, birches and ground: fixed until the Hue knob moves.
function background(S) {
  const h = 0.76 - 0.4 * S.hue, top = [0, 0, 0], low = [0, 0, 0], moon = [0.96, 0.93, 0.82], bark = [0, 0, 0], bg = S.bg;
  hsv(h, 0.8, 0.13, top, 0);
  hsv(h + 0.03, 0.45, 0.52, low, 0);
  hsv(h, 0.12, 1, bark, 0);
  hsv(h + 0.02, 0.35, 0.62, S.fogc, 0);
  for (let y = 0; y < H; y++) {
    const t = sm(0, 102, y) ** 1.2;
    for (let x = 0; x < W; x++) {
      const o = 3 * (y * W + x), xx = x + 0.5, yy = y + 0.5;
      let r = mix(top[0], low[0], t), g = mix(top[1], low[1], t), b = mix(top[2], low[2], t);
      const d = Math.hypot(xx - MX, yy - MY);
      if (d < MR) {
        // The moon's seas, and a little darkening at the limb.
        const sea = sm(0.52, 0.62, vn(xx * 0.32 + 5, yy * 0.32 + 9)) * 0.16 + sm(MR - 3, MR, d) * 0.1;
        (r = moon[0] * (1 - sea)), (g = moon[1] * (1 - sea)), (b = moon[2] * (1 - sea * 0.7));
      } else {
        const k = floor(9 * max(0, 1 - (d - MR) / 11) ** 2) / 9 * 0.22;
        (r += moon[0] * k), (g += moon[1] * k), (b += moon[2] * k);
        if (y < 80 && hash(y * W + x + 999) < 0.006) (r += 0.5), (g += 0.48), (b += 0.55);
      }
      const gl = groundAt(xx);
      for (let k = 0; k < BIRCH.length; k++) {
        const [cx, w, near, lean] = BIRCH[k], u = (xx - cx - lean * (GY - yy)) / (w / 2);
        if (abs(u) > 1 || yy > gl + 1) continue;
        // Bark: pale and round, dark lenticels, black patches near the foot.
        const L = (0.78 - 0.28 * u - 0.22 * u * u) * near, hk = hash(k * 977 + y), mk = hk < 0.12 + 0.3 * sm(60, 100, yy) && abs(u - (hash(k * 31 + y) - 0.5)) < 0.3 + hk * 2;
        const v = mk ? 0.1 + 0.05 * near : L;
        (r = bark[0] * v), (g = bark[1] * v), (b = bark[2] * v);
      }
      if (yy > gl) {
        // The forest floor, its edge catching the moon, and dead leaves.
        const e = sm(gl + 2.5, gl, yy), q = hash(y * 131 + x);
        (r = 0.06 + 0.12 * e + (q < 0.1 ? 0.1 : 0)), (g = 0.04 + 0.08 * e + (q < 0.1 ? 0.04 : 0)), (b = 0.07 + 0.12 * e);
        const f = 1 - 0.4 * sm(105, 128, yy);
        (r *= f), (g *= f), (b *= f);
      }
      (bg[o] = r), (bg[o + 1] = g), (bg[o + 2] = b);
    }
  }
  S.hb = S.hue;
}

let NX = 0, NY = 0;
// Distance to a capsule a-b of radius r0 at a and r1 at b; (NX, NY) the outward normal.
function cap(px, py, ax, ay, bx, by, r0, r1) {
  const ex = bx - ax, ey = by - ay, qx = px - ax, qy = py - ay, u = cl((qx * ex + qy * ey) / (ex * ex + ey * ey + 1e-9), 0, 1), dx = qx - u * ex, dy = qy - u * ey, d = sqrt(dx * dx + dy * dy) + 1e-9;
  (NX = dx / d), (NY = dy / d);
  return d - mix(r0, r1, u);
}
function poly(px, py, v) {
  let dd = 1e9, s = 1;
  for (let i = 0, j = v.length - 2; i < v.length; j = i, i += 2) {
    const ex = v[j] - v[i], ey = v[j + 1] - v[i + 1], wx = px - v[i], wy = py - v[i + 1], u = cl((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * u, by = wy - ey * u;
    dd = min(dd, bx * bx + by * by);
    const c1 = py >= v[i + 1], c2 = py < v[j + 1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * sqrt(dd);
}
function put(F, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = 3 * (y * W + x);
  a = min(1, a);
  (F[o] += (r - F[o]) * a), (F[o + 1] += (g - F[o + 1]) * a), (F[o + 2] += (b - F[o + 2]) * a);
}

function choreo(ct) {
  let t = ct % LOOP, k = 0;
  while (t > SEG[k][0]) (t -= SEG[k][0]), k++;
  const [d, p0, p1, x0, x1, act, cr] = SEG[k], f = t / d;
  return { phi: mix(p0, p1, sm(0, 1, f)), X: mix(x0, x1, f), act, cr: cr * sin(PI * f) ** 2, v: (x1 - x0) / d };
}
const toward = (v, t, r) => (v < t ? min(t, v + r) : max(t, v - r));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.legs = cl(k[2], 0, 1);
  S.fog = cl(k[3], 0, 1);
  const ds = (d * cl(k[1], 0.2, 3)) / 2, first = S.t === 0;
  S.t += ds;
  if ((input.btnPressed || [])[0] && S.call <= 0) S.call = 7;
  let T;
  if (S.call > 0) {
    // Turn the front to us, kneel, open the door; then get up and go on.
    S.call -= ds;
    const face = 360 * round(S.phi / 360), there = abs(S.phi - face) < 8;
    T = { phi: face, X: S.X, act: there ? 0 : 0.8, cr: there && S.call > 1.6 ? 1 : 0, v: 0 };
    S.dr = toward(S.dr, S.c > 0.85 && S.call > 2.2 ? 1 : 0, ds / 0.7);
  } else {
    S.ct += ds;
    T = choreo(S.ct);
    S.dr = toward(S.dr, 0, ds / 0.7);
  }
  const tp = T.phi + 360 * round((S.phi - T.phi) / 360);
  if (first) (S.phi = tp), (S.X = T.X);
  S.phi = toward(S.phi, tp, 160 * ds);
  S.X = toward(S.X, T.X, 12 * ds);
  S.c = toward(S.c, T.cr, 1.6 * ds);
  S.act = toward(S.act, T.act, 2.5 * ds);
  S.v = toward(S.v, T.v, 20 * ds);
  S.gp += ds / STEP;
  // Smoke from the chimney, swelling and drifting downwind.
  if (S.cx !== undefined && Math.random() < ds * 9) S.puffs.push({ x: S.cx + Math.random() - 0.5, y: S.cy, a: 0, s: Math.random() });
  for (const p of S.puffs) (p.a += ds), (p.y -= (5 + 2 * p.s) * ds), (p.x += (2.4 + 1.5 * sin(S.t * 0.4 + p.s * 3)) * ds);
  S.puffs = S.puffs.filter((p) => p.a < 4.5 && p.y > -8);
  // Baba Yaga's flights across the moon, one way and then the other.
  if (!S.fly && (S.nf -= ds) <= 0) (S.fly = { dir: S.nfl % 2 ? -1 : 1, a: 0 }), S.nfl++;
  const f = S.fly;
  if (f) {
    f.a += ds;
    const x = f.dir > 0 ? -22 + 16 * f.a : W + 22 - 16 * f.a, y = MY + 1 + 2.5 * sin(f.a * 1.7) - 0.08 * f.dir * (x - MX);
    (f.x = x), (f.y = y);
    // The broom sweeps her track away in a little dust.
    for (let e = ds * 30; e > 0; e--) if (e >= 1 || Math.random() < e) S.dust.push({ x: x - f.dir * 20 + 2 * Math.random(), y: y + 2 + 4 * Math.random(), vx: -f.dir * (2 + 4 * Math.random()), vy: 1 + 3 * Math.random(), a: 0 });
    if (f.a * 16 > W + 46) (S.fly = null), (S.nf = 12 - f.a);
  }
  for (const p of S.dust) (p.a += ds), (p.x += p.vx * ds), (p.y += p.vy * ds), (p.vx *= 1 - ds);
  S.dust = S.dust.filter((p) => p.a < 1.6);
}

// Leg i of the hut: joints in the panel, from the hip to the toes.
function leg(S, i, yHip, Hh, Lmax, cp, sp, out) {
  const p = (S.gp + 0.5 * i) % 1, act = S.act, stride = abs(S.v) * 0.6 * STEP;
  let f, lift;
  if (p < 0.6) (f = stride * (0.5 - p / 0.6)), (lift = 0);
  else {
    const q = (p - 0.6) / 0.4;
    (f = stride * (sm(0, 1, q) - 0.5)), (lift = (3 + 5 * S.legs) * act * sin(PI * q));
  }
  const lat = i ? HIP : -HIP, L1 = 0.6 * Lmax, L2 = 0.68 * Lmax, dv = Hh - lift;
  const D = Math.hypot(f, dv) + 1e-6, dd = cl(D, abs(L1 - L2) + 0.5, L1 + L2 - 0.3);
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = sqrt(max(0, L1 * L1 - a * a)), uf = f / D, uv = dv / D;
  // The joint bends backward: it sits behind the line from hip to foot.
  const jf = a * uf - h * uv, jv = a * uv + h * uf, X = (l, fw) => S.X + l * cp + fw * sp;
  (out[0] = X(lat, 0)), (out[1] = yHip), (out[2] = X(lat, jf)), (out[3] = yHip + jv), (out[4] = X(lat, f)), (out[5] = yHip + dv);
  out[6] = sm(0, 3, lift);
  out[7] = lat * sp - f * cp;
}

const TOES = [[-0.5, 0.87, 9], [0, 1, 10], [0.5, 0.87, 9], [0, -1, 4.5]];
function drawLeg(S, F, P, cp, sp) {
  const [hx, hy, jx, jy, fx, fy, curl] = P, tx = [], ty = [], jl = Math.hypot(jx - hx, jy - hy) + 1e-6;
  for (const [l, fw, len] of TOES) {
    const k = len * (1 - 0.45 * curl), dz = l * sp - fw * cp;
    tx.push(fx + k * (l * cp + fw * sp)), ty.push(fy + (0.35 * -dz * k) / len + 3 * curl);
  }
  const x0 = floor(min(hx, jx, fx) - 11), x1 = floor(max(hx, jx, fx) + 11), y0 = floor(hy - 2), y1 = floor(max(fy, ...ty) + 2);
  for (let y = max(0, y0); y <= min(H - 1, y1); y++)
    for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
      const px = x + 0.5, py = y + 0.5;
      // The thigh: a big feathered drumstick, scalloped down its edge.
      const u = cl(((px - hx) * (jx - hx) + (py - hy) * (jy - hy)) / (jl * jl), 0, 1);
      let best = cap(px, py, hx, hy, jx, jy, 5.2, 2.6) - 0.9 * max(0, sin(u * 16 + 1)), nx = NX, ny = NY, r, g, b;
      const tip = best > -1.2 || hash(y * 64 + x) < 0.22;
      (r = tip ? 0.29 : 0.14), (g = tip ? 0.21 : 0.095), (b = tip ? 0.17 : 0.085);
      // The shank: scaly and yellowish, with a spur, and knobbly joints.
      const e = min(cap(px, py, jx, jy, fx, fy, 2.2, 1.7), cap(px, py, mix(jx, fx, 0.55), mix(jy, fy, 0.55), mix(jx, fx, 0.55) + (jx - hx) * 0.12, mix(jy, fy, 0.55) + 1, 0.9, 0.4));
      if (e < best) {
        const sc = (Math.hypot(px - jx, py - jy) * 0.7 + (px - fx) * 0.2) % 1 < 0.35 ? 0.75 : 1;
        (best = e), (nx = NX), (ny = NY), (r = 0.4 * sc), (g = 0.28 * sc), (b = 0.07 * sc);
      }
      const kn = min(cap(px, py, jx, jy, jx, jy, 3, 3), cap(px, py, fx, fy, fx, fy, 2.1, 2.1));
      if (kn < best) (best = kn), (nx = NX), (ny = NY), (r = 0.3), (g = 0.2), (b = 0.08);
      for (let t = 0; t < 4; t++) {
        const c = cap(px, py, fx, fy, tx[t], ty[t], 1.4, 0.7);
        if (c < best) {
          (best = c), (nx = NX), (ny = NY);
          const claw = Math.hypot(px - tx[t], py - ty[t]) < 2;
          (r = claw ? 0.66 : 0.36), (g = claw ? 0.62 : 0.25), (b = claw ? 0.52 : 0.07);
        }
      }
      if (best > 0.7) continue;
      // Moonlight from the upper left catches the edges facing it.
      const rim = max(0, -0.6 * nx - 0.8 * ny) * sm(-1.8, 0, best) * 0.4;
      put(F, x, y, r + rim * 0.7, g + rim * 0.65, b + rim * 0.8, sm(0.7, -0.3, best));
    }
}

// The hut: walls of logs, windows and door on the faces turned to us, the
// gable roof, its gable ends and the chimney.
function hut(S, F, ySill, cp, sp, sway, flick) {
  const yE = ySill - WALL, yR = yE - ROOF, P = (l, z) => l * cp + z * sp;
  const faces = [];
  if (cp > 0.02) faces.push([-A, B, A, B, sp, 0]);
  if (cp < -0.02) faces.push([A, -B, -A, -B, -sp, 1]);
  if (sp < -0.02) faces.push([A, B, A, -B, cp, 2]);
  if (sp > 0.02) faces.push([-A, -B, -A, B, -cp, 2]);
  for (const fc of faces) (fc[6] = P(fc[0], fc[1])), (fc[7] = P(fc[2], fc[3]));
  const eav = [P(-A - OVER, -B - OVER), P(A + OVER, -B - OVER), P(A + OVER, B + OVER), P(-A - OVER, B + OVER)], rid = [P(0, -B - OVER), P(0, B + OVER)];
  const eL = min(...eav), eR = max(...eav), rL = min(...rid), rR = max(...rid), cx = P(0, -6);
  const gb = cp > 0.02 ? [P(-A, B), P(A, B), P(0, B)] : cp < -0.02 ? [P(A, -B), P(-A, -B), P(0, -B)] : null;
  (S.cx = S.X + cx + sway * (ySill - yR + 6)), (S.cy = yR - 6);
  for (let y = max(0, floor(yR - 7)); y <= min(H - 1, floor(ySill)); y++) {
    const yy = y + 0.5, sh = S.X + sway * (ySill - yy);
    for (let x = 0; x < W; x++) {
      const xr = x + 0.5 - sh;
      let col = 0, cr = 0, cg = 0, cb = 0;
      if (yy > yE && yy <= ySill + 0.5) {
        for (const [, , , , nx, kind, x0, x1] of faces) {
          if (xr < x0 || xr >= x1) continue;
          const u = (xr - x0) / (x1 - x0), wpx = x1 - x0, lv = 0.8 - 0.3 * nx, hv = ySill - yy, lg = hv % 3, row = floor(hv / 3);
          // Logs: a lit top, a dark gap, and round log ends at the corners.
          let r = 0.15, g = 0.095, b = 0.08;
          if (lg > 2.2) (r = 0.3), (g = 0.21), (b = 0.17);
          if (lg < 0.7) (r = 0.05), (g = 0.03), (b = 0.035);
          const end = (u * wpx < 1.5 || (1 - u) * wpx < 1.5) && (row + (kind >> 1)) % 2 === 0;
          if (end) (r = 0.36), (g = 0.26), (b = 0.19);
          (r *= lv), (g *= lv), (b *= lv);
          // Windows: carved frames round orange light and a dark cross; the door.
          const w0 = kind ? 0.37 : 0.58, ww = (kind ? 0.26 : 0.28) * wpx, wu = (u - w0) / (ww / wpx), wy = (yy - yE - 5) / 6;
          if (wu >= 0 && wu < 1 && wy >= 0 && wy < 1 && ww > 1.2) {
            const fr = wu * ww < 1 || (1 - wu) * ww < 1 || wy < 0.17 || wy > 0.83;
            const cross = abs(wu - 0.5) * ww < 0.5 || abs(wy - 0.5) < 0.09, gl = flick * (1 - 0.5 * ((wu - 0.5) ** 2 + (wy - 0.5) ** 2));
            if (fr) (r = 0.45), (g = 0.35), (b = 0.27);
            else if (cross) (r = 0.16), (g = 0.07), (b = 0.03);
            else (r = gl), (g = 0.6 * gl * gl), (b = 0.14 * gl * gl);
          }
          if (kind === 0 && u >= 0.12 && u < 0.46 && hv < 15) {
            const du = (u - 0.14) / 0.3, open = du > 1 - S.dr && du < 1 && hv < 14;
            if (open) {
              // Firelight from the stove: yellow low in the doorway, deep orange above.
              const gl = flick * (1 - 0.35 * (hv / 14)), k = gl * gl;
              (r = gl), (g = 0.28 + 0.4 * k - 0.1 * (hv / 14)), (b = 0.04 + 0.16 * k * k);
            } else if (du < 0 || du >= 1 || hv >= 14) (r = 0.46), (g = 0.36), (b = 0.27);
            else {
              const plank = ((du / max(0.05, 1 - S.dr)) * 4) % 1 < 0.2;
              (r = plank ? 0.1 : 0.3), (g = plank ? 0.06 : 0.19), (b = plank ? 0.04 : 0.12);
              if (abs(du - 0.8 * (1 - S.dr)) * 0.3 * wpx < 0.6 && abs(hv - 7) < 0.6) (r = 0.7), (g = 0.6), (b = 0.35);
            }
          }
          (col = 1), (cr = r), (cg = g), (cb = b);
        }
      }
      if (yy > yR && yy <= yE + 1.2) {
        // The roof: hull of the eaves and the ridge; thatch in rows.
        const f = (yy - yR) / (yE - yR), xl = mix(rL, eL, f), xrr = mix(rR, eR, f);
        if (xr >= xl && xr < xrr) {
          const q = hash(y * 71 + floor(xr * 2) + 5000), lv = 0.85 - 0.3 * ((xr - xl) / max(1, xrr - xl));
          // Straw in rows, combed down the slope, the ridge and eaves catching light.
          let v = ((xr * 0.8 + (yy - yR) * 0.5) % 1.6 < 0.5 ? 0.12 : 0.24 + 0.08 * q) * ((yy - yR) % 4 < 0.9 ? 0.6 : 1);
          if (yy > yE || yy < yR + 1) v = 0.36;
          (col = 1), (cr = v * 1.0 * lv), (cg = v * 0.92 * lv), (cb = v * 0.78 * lv);
          // A gable end turned to us: boards, and a round attic window.
          if (gb) {
            const gl = mix(gb[2], gb[0], f), gr = mix(gb[2], gb[1], f);
            if (xr >= gl && xr < gr) {
              const bd = ((xr - gb[0]) * 0.7) % 1 < 0.25 ? 0.33 : 1;
              (cr = 0.21 * bd), (cg = 0.14 * bd), (cb = 0.1 * bd);
              if (Math.hypot((xr - gb[2]) / max(0.2, abs(cp)), yy - yE + ROOF * 0.38) < 1.7) (cr = flick), (cg = 0.55 * flick), (cb = 0.12);
            }
          }
        }
      }
      if (yy > yR - 6 && yy < yR + 1.5 && abs(xr - cx) < 1.6) (col = yy < yR - 5 ? 1.6 : 1), (cr = 0.2 * col), (cg = 0.12 * col), (cb = 0.1 * col);
      if (col) put(F, x, y, cr, cg, cb, 1);
    }
  }
}

// Baba Yaga in her mortar, facing +x with y down: mortar, hunched body,
// head in a kerchief, long nose, the pestle she steers with and the broom.
function yaga(S, F) {
  const f = S.fly, sc = 1.3, w = sin(f.a * 7) * 1.2, pw = 0.55 + 0.35 * sin(f.a * 3.4), pc = cos(pw), ps = sin(pw);
  const sh = [
    ["p", [-4.2, 0.6, 4.2, 0.6, 3, 6, 1.8, 6.6, -1.8, 6.6, -3, 6]],
    ["c", -4.8, -0.2, 4.8, -0.2, 0.7, 0.7],
    ["p", [-2.2, -0.5, -3.2, -3.5, -2.6, -6.5, -0.8, -8.6, 1.6, -9.4, 3, -8, 2.4, -5, 2.2, -0.5]],
    ["c", 3, -10.6, 3, -10.6, 1.9, 1.9],
    ["p", [1.6, -12.2, -2.2, -11.6 + w, 1.2, -9.8]],
    ["p", [4.6, -11.2, 7.2, -9.2, 4.6, -9.7]],
    ["c", 1.6, -7.2, 5.4, -6.6, 0.75, 0.75],
    ["c", 5.4 - 2 * ps, -6.6 + 2 * pc, 5.4 + 8 * ps, -6.6 - 8 * pc, 0.6, 1.4],
    ["c", -1.5, -6, -3.5, -3.5, 0.7, 0.7],
    ["c", -3.5, -3.5, -12, 0, 0.5, 0.5],
    ["p", [-11.5, -0.6, -18, -1.6 + w, -18.5, 3 + w, -12, 1.6]],
  ];
  for (let y = max(0, floor(f.y - 21)); y < min(H, f.y + 11); y++)
    for (let x = max(0, floor(f.x - 26)); x < min(W, f.x + 26); x++) {
      const lx = ((x + 0.5 - f.x) / sc) * f.dir, ly = (y + 0.5 - f.y) / sc;
      let d = 1e9;
      for (const s of sh) d = min(d, s[0] === "c" ? cap(lx, ly, s[1], s[2], s[3], s[4], s[5], s[6]) : poly(lx, ly, s[1]));
      d *= sc;
      // The mortar's rim catches a thread of moonlight between it and her.
      const rim = abs(ly + 0.45) < 0.32 && abs(lx) < 4.5 ? 0.22 : 0;
      if (d < 0.6) put(F, x, y, 0.035 + rim, 0.02 + rim * 0.9, 0.05 + rim, sm(0.6, -0.4, d));
    }
}

function skulls(S, F) {
  const eg = [0.5, 1, 0.2];
  // The rail between the posts: bones lashed end to end.
  for (let x = 0; x < W; x++) for (const y of [120, 121]) put(F, x, y, 0.36, 0.33, 0.28, y === 120 ? 0.9 : 0.6);
  SKULLS.forEach((sx, k) => {
    // Each pair of eyes flickers on its own, and now and then goes dim.
    const fl = 0.6 + 0.4 * vn(S.t * 5 + k * 13, k * 7) - 0.45 * sm(0.72, 0.84, vn(S.t * 0.7 + k * 5, 30));
    for (let y = 106; y < H; y++)
      for (let x = max(0, sx - 6); x < min(W, sx + 6); x++) {
        const px = x + 0.5, py = y + 0.5, dx = abs(px - sx);
        // A bone post with knobs, the skull's dome, cheekbones and jaw.
        const post = min(cap(px, py, sx, 117, sx, 128, 1.5, 1.5), cap(px, py, sx, 124, sx, 124, 2.1, 2.1));
        const sk = min(cap(px, py, sx, 111.5, sx, 111.5, 4.4, 4.4), cap(px, py, sx - 2.3, 115.2, sx + 2.3, 115.2, 1.6, 1.6), cap(px, py, sx - 3.1, 113.4, sx + 3.1, 113.4, 1.2, 1.2));
        const d = min(post, sk), lv = 0.66 + (0.28 * (sx - px)) / 4;
        const so = Math.hypot((dx - 1.85) / 1.25, (py - 112.2) / 1.15), eye = Math.hypot(dx - 1.85, py - 112.3);
        if (d < 0.5) {
          let r = 0.84 * lv, g = 0.8 * lv, b = 0.68 * lv;
          if (sk < 0.5) {
            // Dark sockets with a green coal in each, the nose and the teeth.
            if (so < 1) (r *= 0.08), (g *= 0.08), (b *= 0.1);
            if (eye < 0.85) (r = eg[0] * fl), (g = eg[1] * fl), (b = eg[2] * fl);
            if (Math.hypot(px - sx, py - 114.3) < 0.8 || (abs(py - 116.1) < 0.5 && x % 2 === 0 && dx < 2.4)) (r *= 0.2), (g *= 0.2), (b *= 0.25);
          }
          put(F, x, y, r, g, b, sm(0.5, -0.5, d));
        }
        const gl = 0.4 * fl * exp(-(eye * eye) / 3.5);
        if (gl > 0.01) {
          const o = 3 * (y * W + x);
          (F[o] += eg[0] * gl), (F[o + 1] += eg[1] * gl), (F[o + 2] += eg[2] * gl);
        }
      }
  });
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.t === 0) return;
  if (S.hb !== S.hue) background(S);
  const F = S.F, t = S.t;
  F.set(S.bg);
  const Lmax = 38 + 24 * S.legs, Hh = Lmax * (1 - 0.62 * S.c), bob = 1.1 * S.act * cos(4 * PI * S.gp), ySill = GY - Hh + bob;
  const cp = cos((S.phi * PI) / 180), sp = sin((S.phi * PI) / 180), sway = 0.035 * S.act * sin(2 * PI * S.gp) + 0.02 * sin(t * 0.9) * (1 - S.act);
  const flick = 0.88 + 0.12 * vn(t * 6, 3);
  // Smoke, lit by the moon.
  for (const p of S.puffs) {
    const R = 1.6 + 1.6 * p.a, al = 0.65 * sm(0, 0.3, p.a) * (1 - p.a / 4.5);
    for (let y = max(0, floor(p.y - R)); y < min(H, p.y + R); y++)
      for (let x = max(0, floor(p.x - R)); x < min(W, p.x + R); x++) {
        const q = 1 - ((x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2) / (R * R);
        if (q > 0) put(F, x, y, 0.62, 0.6, 0.7, al * q);
      }
  }
  if (S.fly) yaga(S, F);
  for (const p of S.dust) put(F, floor(p.x), floor(p.y), 0.75, 0.72, 0.85, 0.8 * (1 - p.a / 1.6));
  // The hut's shadow on the ground, cast away from the moon.
  for (let y = GY - 2; y < GY + 4; y++)
    for (let x = 0; x < W; x++) {
      const q = ((x + 0.5 - S.X - 7) / 17) ** 2 + ((y + 0.5 - GY - 0.5) / 2.6) ** 2;
      if (q < 1 && y + 0.5 > groundAt(x + 0.5)) put(F, x, y, 0, 0, 0, 0.45 * (1 - q) * (1 - 0.5 * S.c));
    }
  hut(S, F, ySill, cp, sp, sway, flick);
  const L0 = [], L1 = [];
  leg(S, 0, ySill, Hh, Lmax, cp, sp, L0);
  leg(S, 1, ySill, Hh, Lmax, cp, sp, L1);
  for (const P of L0[7] > L1[7] ? [L0, L1] : [L1, L0]) drawLeg(S, F, P, cp, sp);
  // The open door throws firelight down onto the ground.
  const dx = S.X - 5 * cp;
  if (S.dr > 0.02)
    for (let y = floor(ySill); y < min(H, GY + 6); y++) {
      const hw = 4 + (9 * (y - ySill)) / max(4, GY - ySill);
      for (let x = max(0, floor(dx - hw)); x < min(W, dx + hw); x++) {
        const o = 3 * (y * W + x), a = 0.22 * S.dr * flick * (1 - abs(x + 0.5 - dx) / hw) * (y > groundAt(x) ? 1.6 : 0.6);
        (F[o] += a), (F[o + 1] += 0.55 * a), (F[o + 2] += 0.15 * a);
      }
    }
  skulls(S, F);
  // Ground fog: wisps at 0.06, a bank up to the hut's knees and higher as Fog turns.
  const fz = S.fog, top = GY - 72 * fz, fc = S.fogc;
  for (let y = max(0, floor(top)); y < H; y++) {
    const yy = y + 0.5, base = sm(top, top + 10 + 20 * fz, yy);
    for (let x = 0; x < W; x++) {
      const n = vn(x * 0.09 + t * 0.35, yy * 0.22 + t * 0.05) * 0.7 + vn(x * 0.21 - t * 0.6, yy * 0.4) * 0.3;
      const a = base * sm(0.42 - 0.2 * fz, 0.8, n) * (0.35 + 0.5 * fz);
      if (a > 0.01) put(F, x, y, fc[0], fc[1], fc[2], a);
    }
  }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, cl(F[o] * 255, 0, 255) | 0, cl(F[o + 1] * 255, 0, 255) | 0, cl(F[o + 2] * 255, 0, 255) | 0);
}
