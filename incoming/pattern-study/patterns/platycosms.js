// ===== Patternflow pattern =====
// Title:   Platycosms
// Family:  space
// Idea:    You fly through a closed flat universe holding one three-armed jack, and every cube of space you look through shows a copy of it, turned by the gluing that brought you there: a quarter turn a step in the tetracosm, a half turn in the dicosm, the Hantzsche-Wendt screws in the didicosm, none in the 3-torus.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: flat 3-manifolds (Werner Nowacki, 1934; Walter Hantzsche and Hilmar Wendt, 1935), names after John Conway and Juan Pablo Rossetti (2003), the inside view after Jeffrey Weeks (The Shape of Space, 1985), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Space=0..3, Heading=0..1
//
// Knob 1: Hue. Turns the three arm colours round the wheel together: at 0 the long arm is green, the middle one azure and the short one pink, on a white hub.
// Knob 2: Speed. How fast you fly: 0.44 cubes a second at 2, ten times slower at 0.2, half as fast again at 3.
// Knob 3: Space. 0 the tetracosm, whose cube is glued top to bottom with a quarter turn; 1 the dicosm, glued with a half turn; 2 the didicosm, the Hantzsche-Wendt manifold, two cubes big, so only every other cube holds a copy, and each copy is turned a half turn about x, y or z or not at all; 3 the torocosm, the 3-torus, where every copy faces the same way.
// Knob 4: Heading. The angle between your flight and the z axis, the axis of the turn, from 0 to 90 degrees. At the opening 0.06 you fly 5.4 degrees off it, so in the tetracosm each copy you pass is turned a quarter turn from the one before, one every 2.3 s; at 1 you fly along x, the copies in line ahead of you all face the same way, and each layer to your left and right is turned a quarter more.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const F = 60; // focal length in LEDs: 94 degrees of view top to bottom, 56 across
const FOG = 1.9; // brightness falls by e every 1.9 cubes
const TMAX = 5.5; // a ray gives up after 5.5 cubes, where the fog leaves 5%

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- The jack, in the fundamental cube [0,1]^3: a hub, three rods along
// +x, +y and +z of lengths 0.27, 0.18 and 0.32, and a ball on each end. It
// stays inside [0.265, 0.735]^3, and so does every copy in its own cube,
// since all the gluings below turn or reflect about the cube's centre lines.
// The slab |y| < 0.265 (mod 1) never meets a copy, and the camera flies in it.
const HUB = [0.356, 0.356, 0.34], HR = 0.075, ROD = 0.028;
const ARM = [0.272, 0.176, 0.32], BALL = [0.06, 0.053, 0.066];

// ---- The deck group. For a cube (i, j, k) of the lattice, deck() finds
// the map g^-1 that takes it back onto the fundamental cube, a signed
// permutation and a shift: p_ref[a] = SG[c][a] * q[SRC[c][a]] + TR[a], where
// c is the returned rotation class, or -1 for a cube of the didicosm that
// holds no copy. Classes: 0 none, 1..3 one to three quarter turns undone
// about z, 4..6 the half turns about x, y and z of the didicosm.
const SRC = [[0, 1, 2], [1, 0, 2], [0, 1, 2], [1, 0, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2]];
const SG = [[1, 1, 1], [-1, 1, 1], [-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
const TR = [0, 0, 0];
const md = (a, n) => ((a % n) + n) % n;
// Didicosm generators, scaled by 2 so they carry unit cubes to unit cubes:
// alpha (x+1, 1-y, -z), beta (-x, y+1, 1-z), gamma (1-x, -y, z+1). Their
// squares are the steps of 2 along x, y and z, and alpha beta gamma = 1.
// The cube parity i+j+k is kept, so the copies sit on the even cubes only:
// the manifold is two cubes big. Per parity class (i, j, k mod 2 as bits):
// the coset's class, its shift s, and where it sends the cube (0, 0, 0).
const HW = [[0, [0, 0, 0], [0, 0, 0]], null, null, [5, [0, 1, 1], [-1, 1, 0]], null, [4, [1, 1, 0], [1, 0, -1]], [6, [1, 0, 1], [0, -1, 1]], null];
function deck(m, i, j, k) {
  if (m === 2) {
    const e = HW[md(i, 2) | (md(j, 2) << 1) | (md(k, 2) << 2)];
    if (!e) return -1;
    const c = e[0], D = SG[c], s = e[1], h = e[2];
    // g = T(v) h with v = cell - h(cube 0), so g^-1(q) = D (q - v - s).
    TR[0] = -D[0] * (i - h[0] + s[0]); TR[1] = -D[1] * (j - h[1] + s[1]); TR[2] = -D[2] * (k - h[2] + s[2]);
    return c;
  }
  TR[2] = -k;
  // Tetracosm: a step up z turns a quarter about the cube's axis x = y = 1/2;
  // dicosm a half; torocosm none. Undo k of them.
  const r = m === 0 ? md(-k, 4) : m === 1 ? 2 * md(k, 2) : 0;
  if (r === 0) { TR[0] = -i; TR[1] = -j; }
  else if (r === 1) { TR[0] = j + 1; TR[1] = -i; }
  else if (r === 2) { TR[0] = i + 1; TR[1] = j + 1; }
  else { TR[0] = -j; TR[1] = i + 1; }
  return r;
}

// ---- Drawing. The panel is a depth buffer: every copy within 5.5 cubes of
// the camera is cut into four parts (the hub ball and the three arms, each
// in its own box), each part's box is projected to the screen, clipped at
// the camera plane, and only the LEDs inside that rectangle trace a ray
// against the part, in the copy's own frame, keeping the nearest hit. About
// 160 copies are in reach, and a frame takes about 1.2 ms in Node; tracing
// every cube along every ray instead took 5 to 7 ms.
const N = W * H;
const DIR = new Float64Array(N * 3), DEPTH = new Float64Array(N), LAM = new Float64Array(N), PART = new Int8Array(N);
// Part boxes in the fundamental cube: lo x y z, hi x y z.
const PB = [
  [HUB[0] - HR, HUB[1] - HR, HUB[2] - HR, HUB[0] + HR, HUB[1] + HR, HUB[2] + HR],
  [HUB[0], HUB[1] - BALL[0], HUB[2] - BALL[0], HUB[0] + ARM[0] + BALL[0], HUB[1] + BALL[0], HUB[2] + BALL[0]],
  [HUB[0] - BALL[1], HUB[1], HUB[2] - BALL[1], HUB[0] + BALL[1], HUB[1] + ARM[1] + BALL[1], HUB[2] + BALL[1]],
  [HUB[0] - BALL[2], HUB[1] - BALL[2], HUB[2], HUB[0] + BALL[2], HUB[1] + BALL[2], HUB[2] + ARM[2] + BALL[2]],
];
const CAMP = new Float64Array(24), RECT = new Float64Array(4);
const NEAR = 0.01;
function addPt(u, v, z) {
  const sx = W / 2 + (F * u) / z, sy = H / 2 - (F * v) / z;
  if (sx < RECT[0]) RECT[0] = sx;
  if (sx > RECT[1]) RECT[1] = sx;
  if (sy < RECT[2]) RECT[2] = sy;
  if (sy > RECT[3]) RECT[3] = sy;
}
// The screen rectangle of box b of the copy whose map is class c, shift TR.
function rect(S, b, c) {
  const { cam, fw, rt, up } = S, src = SRC[c], sg = SG[c], bx = PB[b];
  let front = 0;
  for (let q = 0; q < 8; q++) {
    // p_ref -> world: q[SRC[a]] = SG[a] (p[a] - TR[a])
    const p0 = sg[0] * (bx[q & 1 ? 3 : 0] - TR[0]), p1 = sg[1] * (bx[q & 2 ? 4 : 1] - TR[1]), p2 = sg[2] * (bx[q & 4 ? 5 : 2] - TR[2]);
    const X = (src[0] === 0 ? p0 : p1) - cam[0], Y = (src[1] === 1 ? p1 : p0) - cam[1], Z = p2 - cam[2];
    const z = X * fw[0] + Y * fw[1] + Z * fw[2];
    CAMP[q * 3] = X * rt[0] + Y * rt[1] + Z * rt[2];
    CAMP[q * 3 + 1] = X * up[0] + Y * up[1] + Z * up[2];
    CAMP[q * 3 + 2] = z;
    if (z >= NEAR) front++;
  }
  if (!front) return false;
  RECT[0] = RECT[2] = 1e9; RECT[1] = RECT[3] = -1e9;
  for (let q = 0; q < 8; q++) if (CAMP[q * 3 + 2] >= NEAR) addPt(CAMP[q * 3], CAMP[q * 3 + 1], CAMP[q * 3 + 2]);
  if (front < 8)
    for (let q = 0; q < 8; q++)
      for (let e = 1; e < 8; e <<= 1) {
        const r = q | e;
        if (r === q) continue;
        const za = CAMP[q * 3 + 2], zb = CAMP[r * 3 + 2];
        if (za < NEAR === zb < NEAR) continue;
        const f = (NEAR - za) / (zb - za);
        addPt(CAMP[q * 3] + f * (CAMP[r * 3] - CAMP[q * 3]), CAMP[q * 3 + 1] + f * (CAMP[r * 3 + 1] - CAMP[q * 3 + 1]), NEAR);
      }
  return RECT[0] < W && RECT[1] > 0 && RECT[2] < H && RECT[3] > 0;
}

// Ray o + t d against a ball at the centre (cx, cy, cz).
function ball(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const qx = ox - cx, qy = oy - cy, qz = oz - cz;
  const b = qx * dx + qy * dy + qz * dz, disc = b * b - (qx * qx + qy * qy + qz * qz - r * r);
  if (disc < 0) return 1e9;
  const t = -b - sqrt(disc);
  return t > 1e-4 ? t : 1e9;
}
// Trace part b for the LEDs in RECT, in the copy's frame (class c, shift TR).
function raster(S, b, c) {
  const { cam } = S, src = SRC[c], sg = SG[c];
  const s0 = src[0], s1 = src[1], g0 = sg[0], g1 = sg[1], g2 = sg[2];
  const ox = g0 * cam[s0] + TR[0] - HUB[0], oy = g1 * cam[s1] + TR[1] - HUB[1], oz = g2 * cam[2] + TR[2] - HUB[2];
  const x0 = max(0, floor(RECT[0])), x1 = min(W - 1, floor(RECT[1])), y0 = max(0, floor(RECT[2])), y1 = min(H - 1, floor(RECT[3]));
  const L = b ? ARM[b - 1] : 0, w = b ? BALL[b - 1] : HR, R2 = ROD * ROD;
  for (let py = y0; py <= y1; py++)
    for (let px = x0, p = py * W + x0; px <= x1; px++, p++) {
      const p3 = p * 3;
      const dx = g0 * DIR[p3 + s0], dy = g1 * DIR[p3 + s1], dz = g2 * DIR[p3 + 2];
      let best = DEPTH[p], nx = 0, ny = 0, nz = 0, hit = false;
      // the ball: the hub, or the end of arm b
      const ex = b === 1 ? L : 0, ey = b === 2 ? L : 0, ez = b === 3 ? L : 0;
      let t = ball(ox, oy, oz, dx, dy, dz, ex, ey, ez, w);
      if (t < best) {
        best = t; hit = true;
        nx = (ox + t * dx - ex) / w; ny = (oy + t * dy - ey) / w; nz = (oz + t * dz - ez) / w;
      }
      if (b) {
        // the rod round the arm's axis, from the hub to the ball
        const up = b === 1 ? oy : ox, uq = b === 3 ? oy : oz, ua = b === 1 ? ox : b === 2 ? oy : oz;
        const dp = b === 1 ? dy : dx, dq = b === 3 ? dy : dz, da = b === 1 ? dx : b === 2 ? dy : dz;
        const A = dp * dp + dq * dq, B = up * dp + uq * dq, D = B * B - A * (up * up + uq * uq - R2);
        if (D > 0) {
          t = (-B - sqrt(D)) / A;
          const s = ua + t * da;
          if (t > 1e-4 && t < best && s > 0 && s < L) {
            best = t; hit = true;
            const np = (up + t * dp) / ROD, nq = (uq + t * dq) / ROD;
            if (b === 1) { nx = 0; ny = np; nz = nq; } else if (b === 2) { nx = np; ny = 0; nz = nq; } else { nx = np; ny = nq; nz = 0; }
          }
        }
      }
      if (hit) {
        DEPTH[p] = best; PART[p] = b;
        LAM[p] = max(0, -(nx * dx + ny * dy + nz * dz));
      }
    }
}

// ---- The cube edges, faint lines of the lattice the copies sit in, as in
// Weeks's Curved Spaces. Each edge line within 5.5 of the camera is clipped
// at the camera plane and stepped one LED at a time on the screen, with the
// distance found by perspective-correct interpolation, so a jack in front
// hides it.
const EDGE = new Float32Array(N);
function edge(S, ax, ay, az, bx, by, bz) {
  const { cam, fw, rt, up } = S;
  let X = ax - cam[0], Y = ay - cam[1], Z = az - cam[2];
  let u0 = X * rt[0] + Y * rt[1] + Z * rt[2], v0 = X * up[0] + Y * up[1] + Z * up[2], z0 = X * fw[0] + Y * fw[1] + Z * fw[2];
  X = bx - cam[0]; Y = by - cam[1]; Z = bz - cam[2];
  let u1 = X * rt[0] + Y * rt[1] + Z * rt[2], v1 = X * up[0] + Y * up[1] + Z * up[2], z1 = X * fw[0] + Y * fw[1] + Z * fw[2];
  if (z0 < NEAR && z1 < NEAR) return;
  if (z0 < NEAR) { const f = (NEAR - z0) / (z1 - z0); u0 += f * (u1 - u0); v0 += f * (v1 - v0); z0 = NEAR; }
  else if (z1 < NEAR) { const f = (NEAR - z1) / (z0 - z1); u1 += f * (u0 - u1); v1 += f * (v0 - v1); z1 = NEAR; }
  const x0 = W / 2 + (F * u0) / z0, y0 = H / 2 - (F * v0) / z0, x1 = W / 2 + (F * u1) / z1, y1 = H / 2 - (F * v1) / z1;
  if ((x0 < 0 && x1 < 0) || (x0 >= W && x1 >= W) || (y0 < 0 && y1 < 0) || (y0 >= H && y1 >= H)) return;
  // walk only the part of the screen segment that lies on the panel
  let s0 = 0, s1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  if (dx) { const a = (0 - x0) / dx, b = (W - x0) / dx; s0 = max(s0, min(a, b)); s1 = min(s1, max(a, b)); }
  if (dy) { const a = (0 - y0) / dy, b = (H - y0) / dy; s0 = max(s0, min(a, b)); s1 = min(s1, max(a, b)); }
  if (s0 >= s1) return;
  const n = Math.ceil((s1 - s0) * sqrt(dx * dx + dy * dy) * 1.3) + 1;
  for (let i = 0; i <= n; i++) {
    const sg = s0 + ((s1 - s0) * i) / n, px = floor(x0 + sg * dx), py = floor(y0 + sg * dy);
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const w = (1 - sg) / z0 + sg / z1, lam = sg / z1 / w;
    const uu = u0 + lam * (u1 - u0), vv = v0 + lam * (v1 - v0), zz = 1 / w;
    const dist = sqrt(uu * uu + vv * vv + zz * zz), p = py * W + px;
    if (dist < DEPTH[p]) { const e = exp(-dist / FOG); if (e > EDGE[p]) EDGE[p] = e; }
  }
}
function edges(S) {
  const cam = S.cam, R = Math.ceil(TMAX);
  EDGE.fill(0);
  for (let ax = 0; ax < 3; ax++) {
    const a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
    for (let b = floor(cam[a1]) - R; b <= floor(cam[a1]) + R + 1; b++)
      for (let c = floor(cam[a2]) - R; c <= floor(cam[a2]) + R + 1; c++) {
        const db = b - cam[a1], dc = c - cam[a2], d2 = db * db + dc * dc;
        if (d2 >= TMAX * TMAX) continue;
        const L = sqrt(TMAX * TMAX - d2), A = [0, 0, 0], B = [0, 0, 0];
        A[ax] = cam[ax] - L; B[ax] = cam[ax] + L; A[a1] = B[a1] = b; A[a2] = B[a2] = c;
        edge(S, A[0], A[1], A[2], B[0], B[1], B[2]);
      }
  }
}

export function setup(params) {
  params.s = { t: 0, s: 0, hue: 0, m: 0, head: 0.06, cam: [0.1, 0.1, 0.1], fw: [0, 0, 1], rt: [1, 0, 0], up: [0, 1, 0], col: new Float32Array(12) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  const speed = cl(kv[1], 0.2, 3);
  S.m = cl(Math.round(kv[2]), 0, 3);
  S.head = cl(kv[3], 0, 1);
  S.t += d * speed / 2;
  S.s += d * speed * 0.22;
  // Flight in the plane y = 0.03, heading th off the z axis, looking 12.6
  // degrees right of the flight and 9 up, the gaze swaying 9 degrees left
  // and right and 6 up and down.
  const th = S.head * PI / 2;
  const cam = S.cam;
  cam[0] = 0.04 + 0.03 * sin(S.t * 0.7) + S.s * sin(th);
  cam[1] = 0.03 + 0.025 * sin(S.t * 0.53);
  cam[2] = 0.1 + S.s * cos(th);
  const yaw = th + 0.22 + 0.16 * sin(S.t * 0.41), pitch = 0.16 + 0.1 * sin(S.t * 0.29);
  const fw = S.fw, rt = S.rt, up = S.up;
  fw[0] = sin(yaw) * cos(pitch); fw[1] = sin(pitch); fw[2] = cos(yaw) * cos(pitch);
  rt[0] = cos(yaw); rt[1] = 0; rt[2] = -sin(yaw);
  up[0] = fw[1] * rt[2] - fw[2] * rt[1];
  up[1] = fw[2] * rt[0] - fw[0] * rt[2];
  up[2] = fw[0] * rt[1] - fw[1] * rt[0];
  // hub white, then the x, y and z arms
  const col = S.col;
  col[0] = 0.95; col[1] = 0.93; col[2] = 0.88;
  hsv(S.hue + 0.56, 0.8, 1, col, 3);
  hsv(S.hue + 0.9, 0.7, 1, col, 6);
  hsv(S.hue + 0.3, 0.85, 1, col, 9);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { cam, fw, rt, up, col, m } = S;
  for (let py = 0, p = 0; py < H; py++)
    for (let px = 0; px < W; px++, p++) {
      const sx = (px + 0.5 - W / 2) / F, sy = (H / 2 - py - 0.5) / F;
      const dx = fw[0] + rt[0] * sx + up[0] * sy, dy = fw[1] + rt[1] * sx + up[1] * sy, dz = fw[2] + rt[2] * sx + up[2] * sy;
      const l = 1 / sqrt(dx * dx + dy * dy + dz * dz);
      DIR[p * 3] = dx * l; DIR[p * 3 + 1] = dy * l; DIR[p * 3 + 2] = dz * l;
    }
  DEPTH.fill(TMAX);
  const ci = floor(cam[0]), cj = floor(cam[1]), ck = floor(cam[2]), R = Math.ceil(TMAX) + 1, RR = (TMAX + 0.87) * (TMAX + 0.87);
  for (let a = -R; a <= R; a++)
    for (let b = -R; b <= R; b++)
      for (let c = -R; c <= R; c++) {
        const i = ci + a, j = cj + b, k = ck + c;
        const vx = i + 0.5 - cam[0], vy = j + 0.5 - cam[1], vz = k + 0.5 - cam[2];
        if (vx * vx + vy * vy + vz * vz > RR || vx * fw[0] + vy * fw[1] + vz * fw[2] < -0.87) continue;
        const cls = deck(m, i, j, k);
        if (cls < 0) continue;
        for (let part = 0; part < 4; part++) if (rect(S, part, cls)) raster(S, part, cls);
      }
  edges(S);
  for (let p = 0; p < N; p++) {
    const e = EDGE[p] * 0.3;
    let r = e * 0.55, g = e * 0.7, b = e;
    const t = DEPTH[p];
    if (t < TMAX) {
      const lam = LAM[p], fog = exp(-t / FOG);
      const sh = (0.28 + 0.72 * lam) * fog, spec = lam > 0.9 ? (lam - 0.9) * 4 * fog : 0;
      const cc = PART[p] * 3;
      r = col[cc] * sh + spec; g = col[cc + 1] * sh + spec; b = col[cc + 2] * sh + spec;
    }
    display.setPixel(p % W, (p / W) | 0, (255 * cl(r, 0, 1)) | 0, (255 * cl(g, 0, 1)) | 0, (255 * cl(b, 0, 1)) | 0);
  }
}
