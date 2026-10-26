// ===== Patternflow pattern =====
// Title:   Rokurokubi
// Family:  halloween
// Idea:    Behind lit paper doors a woman sleeps by an andon lamp, and on the glowing paper her shadow's neck rises and snakes up the whole height of the room, the head wanders under the lintel and goes down to lick the lamp oil until its shadow swells over the doors and the flame flares green, then the neck draws back down to the pillow.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 53, after the rokurokubi of Japanese folklore
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Reach=-1..1, Flicker=0..1
//
// Knob 1: Hue. The lamp light on the paper: orange at 0, yellow at 0.1, green at 0.3, blue at 0.6, rose at 0.9. The night outside stays purple, the shadows black and the flare at the lick green.
// Knob 2: Speed. One clock for the story and the flame. At 2 a night takes 18 seconds: the neck rises from 0.6 s and reaches the lintel at 4.4, the head wanders under it until 8, is down at the lamp by 10 and licks the oil until 13, and is back on the pillow at 16; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Reach. How far the neck goes. At -1 the head climbs only halfway up the doors and at 0 to the lintel; turned up, the neck winds in more and wider coils on the way, 7 coils 5.5 LEDs out to each side at 0 and 10 coils 12.5 out at 1.
// Knob 4: Flicker. How much the flame gutters. At 0.06 it breathes, the paper dims by up to a seventh and the shadows tremble; at 1 a draught swings the flame up to 10 LEDs and the paper pulses down to 40%, so a shadow near the lamp leaps across the doors.
// Buttons: K1 tap: the head turns to us, comes up against the paper and tears a hole in it, and her white face peers through for three seconds while the story waits. The hole stays open until the next night.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, abs, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The paper: x 6..57, y 7..116, two doors meeting at x 31.5.
const PX0 = 6, PX1 = 57, PY0 = 7, PY1 = 116;
// The lamp's flame behind the paper, and the depth of the sleeper's plane
// as a share of the lamp's depth: a shadow is the shape blown up by
// 1 / (1 - depth) about the flame.
const LX = 13, LY = 99, DEP = 0.3;
// The story in seconds at Speed 2.
const T_RISE = 0.6, T_TOP = 4.4, T_WAND = 8, T_LAMP = 10, T_LICK = 13, T_BACK = 16, T_END = 18;
// The shoulders and the head on the pillow.
const SHX = 45, SHY = 108, HDX = 50, HDY = 106;
// The head's parts round the skull's middle, facing right: skull, nose,
// lips and chin, the knot, the front lock, the side lock, the tail of hair.
const HS = 1.6;
const HEAD = [[0, 0, 3.6, 4.2], [3.6, 0.4, 0.9, 0.8], [2.9, 2.6, 1.2, 1.1], [-0.8, -5.4, 4.4, 2.2], [2.2, -3.9, 1.9, 1.6], [-1.6, -0.8, 3, 3.3], [-4.6, 1, 2.2, 1.5]].map((a) => a.map((v) => v * HS));
const PINS = [[-2.5, -6.8, -7.5, -9], [0.5, -7.2, 3.6, -10.4]].map((a) => a.map((v) => v * HS));

export function setup(params) {
  params.s = {
    t: 0, rt: 0, hue: 0, sp: 2, reach: 0, fl: 0.06, pathFor: 99,
    px: new Float32Array(600), py: new Float32Array(600), np: 0, uTop: 0, uWand: 0, uLamp: 0,
    M: new Float32Array(N), BG: new Float32Array(N * 3), PAP: new Uint8Array(N),
    peep: -1, hole: null, holeLive: 0, fcs: -1, ph: [0, 1, 2, 3, 4].map(() => Math.random() * TAU),
  };
  scenery(params.s);
}

// What does not move: the night, the posts, the lintel and sill, the
// veranda, and which LEDs are paper.
function scenery(s) {
  const B = s.BG;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, n = hash(x, y);
    let c;
    if (x >= PX0 && x <= PX1 && y >= PY0 && y <= PY1) {
      s.PAP[i] = 1;
      continue;
    }
    if (y < 4) {
      // Sky under the eave, moonlit purple, brighter at the left.
      const g = 0.55 + 0.25 * (1 - x / 63) - 0.1 * y;
      c = [0.42 * g, 0.2 * g, 0.62 * g];
      if (y >= 2 && y - 2 > (x * 3) / 63) c = [0.05, 0.03, 0.07];
    } else if (y < PY0) c = y === 4 ? [0.3, 0.2, 0.36] : [0.17, 0.1, 0.16];
    else if (y <= PY1 + 3) {
      if (x < 3 || x > 60) {
        // Night beside the house: purple, with leaves of a garden shrub.
        const g = 0.32 + 0.22 * (1 - y / 127) + 0.05 * n;
        c = [0.36 * g, 0.16 * g, 0.55 * g];
        if (hash(floor(x / 2), floor(y / 3)) < 0.28) c = [0.07, 0.04, 0.1];
      } else if (y > PY1) c = y === PY1 + 1 ? [0.32, 0.21, 0.3] : [0.16, 0.09, 0.13];
      else c = x === 3 || x === 60 ? [0.34, 0.22, 0.4] : x === 4 || x === 59 ? [0.2, 0.12, 0.19] : [0.12, 0.07, 0.11];
    } else {
      // Veranda boards, the warm spill near the doors, moonlight at the edge.
      const v = (y - PY1 - 4) / 7, seam = (x + (y & 1) * 7) % 17 === 0 ? 0.6 : 1;
      c = [mix(0.5, 0.2, v) * seam, mix(0.26, 0.11, v) * seam, mix(0.2, 0.3, v) * seam];
    }
    (B[o] = c[0]), (B[o + 1] = c[1]), (B[o + 2] = c[2]);
  }
}

// The head's road for one night: up from the pillow in coils, along under
// the lintel, down the left side to the lamp. Sampled every 0.7 LED.
function road(s) {
  const r = s.reach, sc = r < 0 ? 1 + 0.5 * r : 1, rp = max(0, r);
  const Y = (y) => HDY - (HDY - y) * sc;
  // Up the right door in coils: more of them and wider as Reach turns up.
  const nz = 7 + Math.round(3 * rp), A = 5.5 + 7 * rp, wp = [[HDX, HDY]];
  for (let i = 1; i <= nz; i++) wp.push([45 + (i & 1 ? A : -A) * (i === 1 ? 0.6 : 1), Y(98 - (62 * (i - 1)) / nz)]);
  const top = wp.length;
  wp.push([43, Y(35)], [37, Y(30)], [31, Y(36)], [25, Y(30)], [18, Y(34)]);
  const wand = wp.length - 1;
  const dn = (x, y) => [16 + (x - 16) * (1 + 0.8 * rp), Y(y)];
  wp.push(dn(14, 44), dn(23, 55), dn(13, 65), dn(22, 74), dn(15, 80), [22, Y(86)]);
  const mark = [top, wand, wp.length - 1];
  const P = [];
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[max(0, i - 1)], b = wp[i], c = wp[i + 1], d = wp[min(wp.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      P.push([cl(f(a[0], b[0], c[0], d[0]), PX0 + 5, PX1 - 4), cl(f(a[1], b[1], c[1], d[1]), PY0 + 22, PY1), i]);
    }
  }
  P.push([...wp[wp.length - 1], wp.length - 1]);
  // Even steps along the road.
  let n = 0, acc = 0;
  s.px[0] = P[0][0];
  s.py[0] = P[0][1];
  n = 1;
  for (let i = 1; i < P.length && n < 599; i++) {
    const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], l = sqrt(dx * dx + dy * dy);
    acc += l;
    while (acc >= 0.7 && n < 599) {
      acc -= 0.7;
      const u = 1 - acc / max(l, 1e-6);
      s.px[n] = P[i - 1][0] + dx * u;
      s.py[n] = P[i - 1][1] + dy * u;
      n++;
    }
    for (let m = 0; m < 3; m++) if (P[i][2] === mark[m] && P[i - 1][2] !== mark[m]) s[["uTop", "uWand", "uLamp"][m]] = n - 1;
  }
  s.uLamp = n - 1;
  s.np = n;
  s.pathFor = r;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  s.sp = cl(k[1], 0.2, 3);
  s.reach = cl(k[2], -1, 1);
  s.fl = cl(k[3], 0, 1);
  if (abs(s.reach - s.pathFor) > 0.004) road(s);
  // One clock for everything, the flame included.
  s.rt += (d * s.sp) / 2;
  if (input.btnPressed && input.btnPressed[0] && s.peep < 0) s.peep = 0;
  if (s.peep >= 0) {
    s.peep += (d * s.sp) / 2;
    if (s.peep > 3.8) s.peep = -1;
  } else {
    s.t += (d * s.sp) / 2;
    if (s.t >= T_END) (s.t -= T_END), (s.hole = null);
  }
}

// Where the head is on its road (in steps) at story time t.
function headStep(s, t) {
  if (t < T_RISE || t >= T_BACK) return 0;
  if (t < T_TOP) return s.uTop * (1 - (1 - (t - T_RISE) / (T_TOP - T_RISE)) ** 2);
  if (t < T_WAND) return mix(s.uTop, s.uWand, sm(T_TOP, T_WAND, t) * 0.7 + 0.3 * (t - T_TOP) / (T_WAND - T_TOP));
  if (t < T_LAMP) return mix(s.uWand, s.uLamp, sm(T_WAND, T_LAMP, t));
  if (t < T_LICK) return s.uLamp;
  return s.uLamp * (1 - sm(T_LICK, T_BACK, t));
}

// Shadow coverage: a capsule from (ax, ay) to (bx, by) of radius r and soft edge e.
function capsule(M, ax, ay, bx, by, r, e) {
  const x0 = max(PX0, floor(min(ax, bx) - r - e)), x1 = min(PX1, floor(max(ax, bx) + r + e) + 1);
  const y0 = max(PY0, floor(min(ay, by) - r - e)), y1 = min(PY1, floor(max(ay, by) + r + e) + 1);
  const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy + 1e-9;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - ax, qy = y + 0.5 - ay, u = cl((qx * dx + qy * dy) / ll, 0, 1);
      const ex = qx - dx * u, ey = qy - dy * u, dd = sqrt(ex * ex + ey * ey) - r;
      const c = cl(0.5 - dd / e, 0, 1), q = y * W + x;
      if (c > M[q]) M[q] = c;
    }
}
// An ellipse at (cx, cy), radii rx, ry, turned by angle a.
function blob(M, cx, cy, rx, ry, a, e) {
  const R = max(rx, ry) + e, ca = cos(a), sa = sin(a), mr = min(rx, ry);
  for (let y = max(PY0, floor(cy - R)); y <= min(PY1, floor(cy + R) + 1); y++)
    for (let x = max(PX0, floor(cx - R)); x <= min(PX1, floor(cx + R) + 1); x++) {
      const qx = x + 0.5 - cx, qy = y + 0.5 - cy, u = (qx * ca + qy * sa) / rx, v = (-qx * sa + qy * ca) / ry;
      const dd = (sqrt(u * u + v * v) - 1) * mr, c = cl(0.5 - dd / e, 0, 1), q = y * W + x;
      if (c > M[q]) M[q] = c;
    }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const { M, BG, PAP, px, py } = s;
  const t = s.t, rt = s.rt, ph = s.ph, f = s.fl;
  // The flame: a breath, now and then a gutter, and at the lick a flare.
  const lick = sm(T_LAMP - 0.4, T_LAMP + 0.6, t) * (1 - sm(T_LICK - 0.5, T_LICK + 0.3, t));
  const jit = 0.6 + 4.5 * f + 2.5 * lick;
  const n1 = sin(9.1 * rt + ph[0]) * 0.6 + sin(15.7 * rt + ph[1]) * 0.4, n2 = sin(7.3 * rt + ph[2]) * 0.5 + sin(21.1 * rt + ph[3]) * 0.5;
  const gust = max(0, sin(1.3 * rt + ph[4]) + sin(2.9 * rt) * 0.6) ** 3 * 0.3;
  const fx = LX + n1 * jit * 0.5 + gust * 6 * f, fy = LY - 1.2 * abs(n2) * jit * 0.4;
  const glow = max(0.4, 1 - (0.12 + 0.4 * f) * (0.5 + 0.5 * n2) - 1.4 * gust * f - 0.15 * lick * (0.5 + 0.5 * sin(rt * 23)));
  const green = lick * (0.6 + 0.4 * sin(rt * 7));
  // The light's colour on the paper, near the lamp and far from it.
  let near = hsv(0.105 + s.hue, 0.42, 1);
  const far = hsv(0.07 + s.hue, 0.74, 1);
  const tox = [0.45, 1, 0.12];
  near = near.map((v, i) => mix(v, tox[i], green));
  M.fill(0);
  // Shadows. Shapes are laid out where their shadows fall with the flame at
  // rest and at the sleeper's depth; proj finds the shadow for the flame as
  // it is and the depth given, blown up about the flame by 1 / (1 - depth),
  // and how much bigger that is than the layout.
  const proj = (x, y, dep) => {
    const k = (1 - DEP) / (1 - dep), k0 = 1 / (1 - dep);
    const wx = LX + (x - LX) * (1 - DEP), wy = LY + (y - LY) * (1 - DEP);
    return [fx + (wx - fx) * k0, fy + (wy - fy) * k0, k];
  };
  const pen = (k) => 0.75 + 0.8 * (k - 1) + 0.5 * f;
  // The sleeper under the quilt, breathing.
  const br = 0.5 + 0.5 * sin(rt * 1.6);
  const P1 = proj(31, 111.5 - 0.5 * br, DEP), P2 = proj(41, 109, DEP), P3 = proj(22, 112, DEP), P4 = proj(32, 115.2, DEP);
  blob(M, P1[0], P1[1], 14 * P1[2], 4.2 * P1[2], 0.04, pen(P1[2]));
  blob(M, P2[0], P2[1], 6 * P2[2], 3.6 * P2[2], -0.2, pen(P2[2]));
  blob(M, P3[0], P3[1], 6 * P3[2], 3 * P3[2], 0, pen(P3[2]));
  capsule(M, P4[0] - 21, P4[1], P4[0] + 23, P4[1], 1.6, pen(P4[2]));
  const pl = proj(HDX + 1, HDY + 3.2, DEP);
  blob(M, pl[0], pl[1], 4 * pl[2], 1.6 * pl[2], 0, pen(pl[2]));
  // The neck: the road from the shoulders to the head, with a slow wave
  // running along it, deeper toward the head while it licks the lamp.
  const peep = s.peep, pp = peep < 0 ? 0 : sm(0, 0.5, peep) * (1 - sm(3.3, 3.8, peep));
  const u = headStep(s, t), nu = floor(u), deepH = DEP + 0.35 * lick;
  const amp = 1.5 * min(1, u / 40) * (1 - 0.3 * abs(s.reach));
  const sh0 = proj(SHX, SHY, DEP);
  let hx = HDX, hy = HDY, ox = sh0[0], oy = sh0[1];
  for (let i = 0; i <= nu + 1 && i < s.np; i++) {
    const j = min(i, u);
    const i0 = floor(j), i1 = min(i0 + 1, s.np - 1), fr = j - i0;
    let x = mix(px[i0], px[i1], fr), y = mix(py[i0], py[i1], fr);
    const a = max(0, i0 - 2), b = min(s.np - 1, i0 + 2), tx = px[b] - px[a], ty = py[b] - py[a], tl = sqrt(tx * tx + ty * ty) + 1e-6;
    const wv = amp * sin(j * 0.26 - rt * 3.4) * sin((PI * j) / max(u, 1));
    x += (-ty / tl) * wv;
    y += (tx / tl) * wv;
    const dep = mix(DEP, deepH, sm(u - 9, u, j));
    const p = proj(x, y, dep);
    capsule(M, ox, oy, p[0], p[1], 1.8 * p[2], pen(p[2]));
    (ox = p[0]), (oy = p[1]);
    (hx = x), (hy = y);
    if (j >= u) break;
  }
  // The head: a profile with the big shimada knot of hair on top, the side
  // locks, the tail of hair behind and two pins. It lies face up on the
  // pillow, turns (narrowing as it turns) to face the way it goes, bows to
  // the lamp, and turns to us before it comes to the paper.
  const lying = 1 - sm(0, 8, u);
  // She faces into the room, looks back once along the lintel, and looks
  // the way she goes while the neck draws back.
  const back = (t > 5.9 && t < 6.8) || (t > T_LICK + 0.3 && t < T_BACK - 0.6);
  const want = lying > 0.5 ? -1 : (back ? 1 : -1) * (1 - 0.65 * pp);
  s.fcs += (want - s.fcs) * 0.12;
  const fs = s.fcs < 0 ? min(-0.3, s.fcs) : max(0.3, s.fcs), sg = fs < 0 ? -1 : 1;
  const tilt = lying * 1.57 + sg * (0.85 * lick + 0.1 * sin(rt * 1.3) * (1 - lying));
  const hk = proj(hx, hy, deepH), K = hk[2] * (1 - 0.15 * pp), e = pen(K) * (1 - 0.5 * pp), ct = cos(tilt), st = sin(tilt);
  const at = (dx, dy) => ((dx = (dx + 0.8 * HS) * fs), (dy -= 4.6 * HS), [hk[0] + (dx * ct - dy * st) * K, hk[1] + (dx * st + dy * ct) * K]);
  const faceOn = peep >= 0 ? sm(0.75, 1.0, peep) * (1 - sm(3.2, 3.6, peep)) : 0;
  if (faceOn < 0.5) {
    for (const [dx, dy, rx, ry] of HEAD) {
      const c = at(dx, dy);
      blob(M, c[0], c[1], rx * K * abs(fs), ry * K, tilt, e);
    }
    for (const [a1, b1, a2, b2] of PINS) {
      const c1 = at(a1, b1), c2 = at(a2, b2);
      capsule(M, c1[0], c1[1], c2[0], c2[1], 0.5 * K, e);
    }
  }
  // The tongue, lapping at the oil.
  if (lick > 0.05) {
    const tl = lick * (3.5 + 2.5 * abs(sin(rt * 9))), c1 = at(3.2 * HS, 2.6 * HS), c2 = at(3.6 * HS + tl * 0.5, 2.6 * HS + tl);
    capsule(M, c1[0], c1[1], c2[0], c2[1], 0.5 * K, e);
  }
  // The torn hole and her face in it.
  const hc = at(0, 0);
  if (peep >= 0.5 && !s.holeLive) (s.hole = [cl(hc[0], PX0 + 9, PX1 - 9), cl(hc[1], PY0 + 9, PY1 - 9), (Math.random() * 1000) | 0]), (s.holeLive = 1);
  if (peep < 0) s.holeLive = 0;
  const tear = s.hole ? (s.holeLive ? sm(0.5, 0.8, peep) : 1) : 0;
  // Light the paper, lay the shadow and the grid of the doors over it.
  const lw = 1 / (52 * 52);
  for (let q = 0; q < N; q++) {
    const x = q & 63, y = q >> 6;
    if (!PAP[q]) {
      const o = q * 3, sp = y > PY1 + 3 && x > 2 && x < 61 ? 0.25 * (1 - (y - PY1 - 4) / 8) * glow : 0;
      display.setPixel(x, y, 255 * (BG[o] + sp * far[0]), 255 * (BG[o + 1] + sp * far[1]), 255 * (BG[o + 2] + sp * far[2]));
      continue;
    }
    const dx = x + 0.5 - fx, dy = y + 0.5 - fy, r2 = (dx * dx + dy * dy) * lw;
    // The andon's own paper glows through, a soft bright box round the flame.
    const box = sm(7.5, 5, abs(x + 0.5 - LX)) * sm(14, 10, abs(y + 0.5 - LY + 2));
    const fall = 1 / (1 + r2) ** 1.5, w = cl(fall * 1.3 - 0.3, 0, 1);
    let lv = (0.86 + 0.2 * fall) * glow + 0.3 * box * glow;
    const fib = 0.97 + 0.03 * hash(x, y >> 1);
    let r = mix(far[0], near[0], w) * lv * fib, g = mix(far[1], near[1], w) * lv * fib, b = mix(far[2], near[2], w) * lv * fib;
    // The andon's frame and legs, close behind the paper, in soft shadow.
    const ax = abs(x + 0.5 - LX), ay = y + 0.5 - LY;
    if ((abs(ax - 6) < 0.6 && ay > -13 && ay < 16) || (ax < 6.5 && (abs(ay + 13) < 0.6 || abs(ay - 9) < 0.6))) (r *= 0.45), (g *= 0.4), (b *= 0.45);
    const m = M[q];
    r = mix(r, 0.04, m * 0.94);
    g = mix(g, 0.015, m * 0.94);
    b = mix(b, 0.05, m * 0.94);
    // The hole: the dim room behind, her face when she is at it.
    if (tear > 0) {
      const hx2 = x + 0.5 - s.hole[0], hy2 = y + 0.5 - s.hole[1], hr = sqrt(hx2 * hx2 + hy2 * hy2);
      const ang = atan2(hy2, hx2), bin = ((ang / TAU + 1) * 13) % 13, bi = floor(bin);
      const rag = mix(hash(bi, s.hole[2]), hash((bi + 1) % 13, s.hole[2]), bin - bi);
      const R = tear * (6.5 + 3 * rag);
      if (hr < R) {
        // The room behind, lit by the lamp, nearer the lamp the brighter.
        const room = (0.3 + 0.45 * w) * glow, fcol = faceAt(hx2, hy2, rt, glow);
        r = mix(far[0] * room, fcol[0], faceOn);
        g = mix(far[1] * room * 0.8, fcol[1], faceOn);
        b = mix(far[2] * room, fcol[2], faceOn);
      } else if (hr < R + 1.2) (r = min(1, r * 0.4 + 0.62)), (g = min(1, g * 0.4 + 0.57)), (b = min(1, b * 0.4 + 0.48));
    }
    // The lattice of the doors: a frame round each door, bars across and up.
    const xl = x - PX0, yl = y - PY0;
    const frame = x <= PX0 + 1 || x >= PX1 - 1 || x === 31 || x === 32 || y <= PY0 + 1 || y >= PY1 - 1;
    const bar = frame || (x < 31 ? (xl - 1) % 8 === 0 : (x - 33) % 8 === 7) || yl % 14 === 13;
    if (bar) {
      const k = frame ? 0.5 : 0.3;
      r = mix(r, 0.2, 0.8) * k + 0.05;
      g = mix(g, 0.11, 0.8) * k + 0.02;
      b = mix(b, 0.17, 0.8) * k + 0.06;
    }
    display.setPixel(x, y, r * 255, g * 255, b * 255);
  }
}

// Her face pressed to the hole: white skin, black hair parted in the middle,
// two dark eyes with a glint that look at us and now and then aside, red
// lips. Returns the colour.
function faceAt(x, y, rt, glow) {
  const lk = sin(rt * 0.9) > 0.6 ? 1 : 0;
  if (y < -4.2 + 0.25 * abs(x) * (y < -1 ? 1 : 0) || abs(x) > 6.8 - max(0, y - 3) * 0.6) {
    const part = abs(x) < 0.6 && y < -4 ? 0.25 : 0;
    return [0.04 + part, 0.03 + part, 0.05 + part];
  }
  const l = (0.82 + 0.12 * cl(-x / 6, -1, 1)) * (0.8 + 0.2 * glow);
  let c = [l, l * 0.93, l * 0.86];
  for (const ex of [-2.8, 2.8]) {
    const u = (x - ex) / 1.9, v = (y + 0.6) / 0.85;
    if (u * u + v * v < 1) c = x - ex - lk * 0.8 > -0.5 && x - ex - lk * 0.8 < 0.5 && y < -0.6 ? [0.95, 1, 0.9] : [0.05, 0.02, 0.04];
  }
  if (abs(x) < 1.4 && abs(y - 3.6) < 0.7) c = [0.75, 0.06, 0.1];
  return c;
}
