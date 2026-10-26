// ===== Patternflow pattern =====
// Title:   Lost Head
// Family:  halloween
// Idea:    A headless skeleton scuttles along moonlit tombstones trying on the skulls that sit on them and puts each wrong one back with a shrug, until the right one clicks on and its sockets light toxic green; it dances a jig, then the head falls off and rolls away.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 52, built on Skull Swap, pattern round 50
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tries=1..5, Size=0..1
//
// Knob 1: Hue. The night sky and the shaded side of the bones, round the cold side of the wheel from violet at 0 to teal at 1. The moon and the halo stay.
// Knob 2: Speed. One beat a second for each unit. At the opening 2 the big skull is on the neck at 0.9 s and the right one clicks on at 7 s, after a 2 s walk; it rolls away at 10.8 s. Ten times slower at 0.2.
// Knob 3: Tries. Wrong skulls before the right one, 1 to 5, in turn from too small, witch's hat, biter, pumpkin, too big. The first round ends on the big one, so at 1 it opens on the big one and at 5 on the small one.
// Knob 4: Size. How wrong the wrong sizes are: the big skull is 1.1 times the right one at 0 and twice it at 1, sliding down over the hips; the small one goes from 0.8 to 0.4.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, atan2, acos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ease = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
// Up from a over ra beats, down from c over rc.
const win = (b, a, ra, c, rc) => ease((b - a) / ra) * (1 - ease((b - c) / rc));
const blend = (D, o, w) => Object.keys(o).forEach((key) => (D[key] = mix(D[key], o[key], w)));
const hsv = (h, s, o) => [5, 3, 1].forEach((n, c) => {
  const k = (n + h * 6) % 6;
  o[c] = 255 * (1 - s * max(0, min(k, 4 - k, 1)));
});

// --- Skull Swap's bones, as distances in their own frames, y down.
const seg = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = cl(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return sqrt((x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2);
};
const ell = (x, y, cx, cy, rx, ry) => (sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) - 1) * min(rx, ry);
const box = (x, y, cx, cy, hx, hy, r) => {
  const qx = abs(x - cx) - hx + r, qy = abs(y - cy) - hy + r;
  return sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2) + min(max(qx, qy), 0) - r;
};
function long(x, y, L, w, r) {
  const e = L / 2 - r, q = 0.6 * r, ry = r * 0.9;
  return min(seg(x, y, 0, -e, 0, e) - w, ell(x, y, -q, -e, r, ry), ell(x, y, q, -e, r, ry), ell(x, y, -q, e, r, ry), ell(x, y, q, e, r, ry));
}
// 0 long bone, 1 paired bones, 2 cage, 3 lumbar, 4 pelvis, 5 skull, 6 jaw,
// 7 hand, 8 foot, 9 hat.
const RIBS = [[6.4, 2.4], [7.9, 6.6], [8.8, 10.8], [8.8, 15], [7.8, 19]];
function shape(k, x, y, sg) {
  switch (k) {
    case 0:
      return long(x, y, sg, 0.95 + 0.015 * sg, 1.5);
    case 1: {
      const e = sg / 2 - 1.1;
      return min(seg(x, y, -1, -e, -1, e) - 0.8, seg(x, y, 1.1, -e, 1.1, e) - 0.6, box(x, y, 0, -e - 0.2, 2.3, 1.1, 1), box(x, y, 0, e + 0.2, 2.1, 1.1, 1));
    }
    case 2: {
      let d = min(box(x, y, 0, -3.4, 1.5, 0.75, 0.5), box(x, y, 0, -1.4, 1.6, 0.75, 0.5));
      d = min(d, seg(x, y, -1.4, 0.8, -9.6, -0.2) - 0.8, seg(x, y, 1.4, 0.8, 9.6, -0.2) - 0.8, seg(x, y, 0, 1, 0, 14) - 1.2);
      for (let v = 15.5; v < 24; v += 2.7) d = min(d, box(x, y, 0, v, 1.6, 0.9, 0.5));
      for (const [rx, ry] of RIBS) {
        const c = 3.6 / (rx * rx), ax = min(abs(x), rx), f = ry + c * ax * ax;
        d = min(d, abs(x) <= rx ? abs(y - f) / sqrt(1 + (2 * c * ax) ** 2) - 0.7 : sqrt((abs(x) - rx) ** 2 + (y - f) ** 2) - 0.7);
      }
      return d;
    }
    case 3: {
      let d = 9;
      for (let v = -4; v <= 4.1; v += 2.7) d = min(d, box(x, y, 0, v, 1.9, 0.95, 0.5), box(x, y, 0, v, 3.1, 0.4, 0.3));
      return d;
    }
    case 4: {
      let d = max(abs(x) - (2.5 - 0.28 * (y + 5.5)), abs(y + 2.6) - 3);
      for (let s = -1; s <= 1; s += 2) {
        const dx = x - s * 5.3, dy = y + 3.6, c = 0.8, n = 0.6 * s;
        d = min(d, ell(dx * c + dy * n, -dx * n + dy * c, 0, 0, 4.1, 2.9), abs(ell(x, y, s * 3.4, 2.4, 2.4, 1.9)) - 0.75, ell(x, y, s * 6.5, 0, 1.5, 1.5));
      }
      return d;
    }
    case 5:
      return min(ell(x, y, 0, -10.6, 7, 7.3), ell(x, y, 0, -6.8, 6.4, 2.3), box(x, y, 0, -3.2, 4.4, 2.6, 1.4));
    case 6: {
      const hw = 4.3 - 0.4 * max(0, y);
      return min(box(x, y, 0, 1.5, 4.3, 1.6, 0.8), max(abs(x) - hw, abs(y - 1.6) - 1.8));
    }
    case 7: {
      let d = ell(x, y, 0, 1.4, 1.8, 1.4);
      for (let i = 0; i < 4; i++) d = min(d, seg(x, y, -1.2 + 0.8 * i, 2.2, -1.8 + 1.2 * i, 5.4) - 0.5);
      return d;
    }
    case 8:
      return min(ell(x, y, sg * 0.8, 1.6, 3.1, 1.4), ell(x, y, 0, 0.4, 1.4, 1));
    default: {
      const t = cl((-17.4 - y) / 10, 0, 1);
      return min(ell(x, y, 0.4, -17, 8.4, 1.4), seg(x, y, 0, -17.4, 2.6, -27.4) - mix(4.6, 0.7, t), seg(x, y, 2.6, -27.4, 6, -28.6) - 0.7);
    }
  }
}
// 0 none, 1 dark, 2 socket, 3 shade, 4 pupil, 5 hat band.
function hole(k, x, y) {
  if (k === 5) {
    if (((abs(x) - 2.9) / 2.2) ** 2 + ((y + 7.9) / 2.5) ** 2 < 1) return ((abs(x) - 2.9) / 1.15) ** 2 + ((y + 7.7) / 1.3) ** 2 < 1 ? 4 : 2;
    const ny = y + 5.4;
    if (ny >= 0 && ny < 1.7 && abs(x) < 0.3 + 0.5 * ny) return 1;
    if (y > -2 && y < -0.5 && abs(x * 0.8) < 3.4) return (x + 4) / 1.45 - floor((x + 4) / 1.45) < 0.3 || y > -0.9 ? 1 : 0;
  } else if (k === 6 && y < 1.2 && y > -0.2 && abs(x) < 3.8) return (x + 4) / 1.45 - floor((x + 4) / 1.45) < 0.3 ? 1 : 0;
  else if (k === 4 && ((abs(x) - 4.6) / 2.3) ** 2 + ((y + 4.4 + 0.3 * abs(x)) / 1.3) ** 2 < 1) return 3;
  else if (k === 9 && y > -19.4 && y < -17.6 && abs(x) < 5.2) return 5;
  return 0;
}

const FEMUR = 22, TIBIA = 21, ARM = 15, FORE = 13, HIP = 6.5, FLOOR = 120, HIPY = FLOOR - 3 - FEMUR - TIBIA;
const two = (p) => [p, p];
const PIECES = [[8, -1, -3.9, 3.9, -1, 3.2], [8, 1, -3.9, 3.9, -1, 3.2], ...two([1, TIBIA, -2.4, 2.4, -11, 11]), ...two([0, FEMUR, -2.6, 2.6, -11.4, 11.4]), [4, 0, -11, 11, -9, 5.2], [3, 0, -3.6, 3.6, -5.3, 5.3], [2, 0, -10.6, 10.6, -4.5, 22.6], ...two([0, ARM, -2.6, 2.6, -7.9, 7.9]), ...two([1, FORE, -2.4, 2.4, -7, 7]), ...two([7, 0, -2.7, 2.7, -0.3, 6.1])];
const SKULL = [5, 0, -7.2, 7.2, -18.1, 0.6], JAW = [6, 0, -4.4, 4.4, -0.3, 3.5], CAP = [9, 0, -8.6, 7, -29.6, -15.4];

const at = (K, i, x, y, a) => {
  K.x[i] = K.cx + K.sc * x;
  K.y[i] = FLOOR + K.sc * (y - FLOOR);
  K.a[i] = a;
};
const ang = (dx, dy) => atan2(-dx, dy);
const bone = (K, i, ax, ay, bx, by) => at(K, i, (ax + bx) / 2, (ay + by) / 2, ang(bx - ax, by - ay));
const rot = (a, x, y) => [x * cos(a) - y * sin(a), x * sin(a) + y * cos(a)];
function limb(K, ax, ay, tx, ty, L1, L2, i1, i2, px, py) {
  const dx = tx - ax, dy = ty - ay, d = cl(sqrt(dx * dx + dy * dy), 2, L1 + L2 - 0.01), b = atan2(dy, dx);
  const al = acos(cl((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  let kx = ax + L1 * cos(b + al), ky = ay + L1 * sin(b + al);
  const mx = ax + L1 * cos(b - al), my = ay + L1 * sin(b - al);
  if ((mx - px) ** 2 + (my - py) ** 2 < (kx - px) ** 2 + (ky - py) ** 2) (kx = mx), (ky = my);
  const n = sqrt((tx - kx) ** 2 + (ty - ky) ** 2) || 1, u = (tx - kx) / n, v = (ty - ky) / n;
  bone(K, i1, ax, ay, kx, ky);
  bone(K, i2, kx, ky, kx + L2 * u, ky + L2 * v);
  return [kx + L2 * u, ky + L2 * v, u, v];
}
function torso(D, K) {
  const rx = D.sway, ry = HIPY + D.bob, t = D.tilt, l = D.lean;
  at(K, 6, rx, ry, t);
  for (const s of [-1, 1]) {
    const [hx, hy] = rot(t, s * HIP, 0), f = s < 0 ? D.fl : D.fr, ax = rx + hx, ay = ry + hy;
    const [ex, ey] = limb(K, ax, ay, s * (HIP + f[1]), FLOOR - 3 - f[0], FEMUR, TIBIA, 4 + (s > 0), 2 + (s > 0), ax + s * 60, ay + 20);
    at(K, s > 0 ? 1 : 0, ex, ey, 0);
  }
  const [b0, b1] = rot(t, 0, -5), sx = rx + b0, sy = ry + b1, [c0, c1] = rot(l, 0, -10);
  bone(K, 7, sx + c0, sy + c1, sx, sy);
  const [d0, d1] = rot(l, 0, -24), tx = sx + c0 + d0, ty = sy + c1 + d1 - D.shr * 0.4;
  at(K, 8, tx, ty, l);
  const [n0, n1] = rot(l, 0, -4.4);
  Object.assign(K, { tx, ty, nx: K.cx + K.sc * (tx + n0), ny: FLOOR + K.sc * (ty + n1 - FLOOR), na: l + D.head });
}
function arms(D, K) {
  const l = D.lean;
  for (const s of [-1, 1]) {
    const [o0, o1] = rot(l, s * 10, 0.6 - D.shr), ax = K.tx + o0, ay = K.ty + o1, a1 = s < 0 ? D.al : D.ar, a2 = s < 0 ? D.bl : D.br;
    const [u0, u1] = rot(l, s * sin(a1), cos(a1)), ex = ax + ARM * u0, ey = ay + ARM * u1;
    const [v0, v1] = rot(l, s * sin(a1 + a2), cos(a1 + a2));
    let wx = ex + FORE * v0, wy = ey + FORE * v1;
    const h = K.hold[s > 0 ? 1 : 0];
    if (h[0] > 0) (wx = mix(wx, (h[1] - K.cx) / K.sc, h[0])), (wy = mix(wy, FLOOR + (h[2] - FLOOR) / K.sc, h[0]));
    const [hx, hy, u, v] = limb(K, ax, ay, wx, wy, ARM, FORE, 9 + (s > 0), 11 + (s > 0), ex, ey);
    at(K, 13 + (s > 0), hx, hy, ang(u, v));
  }
}
const REST = { sway: 0, bob: 0, tilt: 0, lean: 0, head: 0, jaw: 0, shr: 0, al: 0.1, bl: 0.06, ar: 0.1, br: 0.06, fl: [0, 0], fr: [0, 0] };

// --- the story. The camera follows the body at BX; the stone tried stands
// at SX, its top at ST, the next GAP further on.
const SC = 0.85, BX = 20, SX = 40, ST = 82, SHW = 8, GAP = 48, WALK = 4, GROUND = 117, HS = GAP / SC / 8;
const BIG = 0, SMALL = 1, HAT = 2, BITER = 3, PUMPKIN = 4, RIGHT = 5;
const ORDER = [SMALL, HAT, BITER, PUMPKIN, BIG];
const DARK = [34, 20, 50], TOXIC = [96, 255, 64];
const EYE = [DARK, DARK, [255, 132, 8], [200, 70, 255], DARK, DARK];
// Beats a wrong one stays on the neck, and when the shrug starts.
const GAG = [3.6, 3.6, 3.8, 0, 3.2, 0];
const shrugAt = (k) => (k === RIGHT ? 10.6 : k === BITER ? 4.4 : 3.4 + GAG[k]);

export function setup(params) {
  params.s = {
    hue: -1, t: 0, b: 0, ph: 0, cam: 0, c0: 0, stones: [], queue: [],
    light: [0, 0, 0], bg: new Float32Array(N * 3), buf: new Float32Array(N * 3),
    K: { cx: BX, sc: SC, x: new Float64Array(15), y: new Float64Array(15), a: new Float64Array(15), D: { ...REST }, hold: [] },
  };
}
function stone(S, j) {
  if (j < 0) return { j };
  if (!S.queue.length) {
    for (let i = 0; i < S.tries; i++) S.queue.push(ORDER[(S.g + i) % 5]);
    S.g += S.tries;
    S.queue.push(RIGHT);
  }
  const kind = S.queue.shift(), sc = kind === BIG ? 1.1 + 0.9 * S.size : kind === SMALL ? 0.8 - 0.4 * S.size : kind === HAT ? 0.95 : 1;
  return { j, kind, Hd: { kind, sc, eye: EYE[kind].slice(), hd: 0, jaw: 0, glow: 0 } };
}
// A skull on its stone; where a hand takes it, on top (s 0) or at a side.
const sit = (S, st, Hd) => Object.assign(Hd, { x: SX + st.j * GAP - S.cam, y: ST - (Hd.kind === PUMPKIN ? 1 : 3.5 * Hd.sc), a: 0, z: 0 });
const grip = (Hd, s) => {
  const [p, q] = Hd.kind === PUMPKIN ? [0, -18] : rot(Hd.a, s * 8.6 * Hd.sc, (s ? -6 : -23) * Hd.sc);
  return [Hd.x + p, Hd.y + q];
};
const arc = (Hd, ax, ay, a0, bx, by, a1, f, h, z = 1) => Object.assign(Hd, { x: mix(ax, bx, f), y: mix(ay, by, f) - 4 * h * f * (1 - f), a: mix(a0, a1, f), z });
// A sideways scuttle: one foot stays put as the other swings on ahead.
function gait(D, u) {
  const p = u / (2 * HS) - floor(u / (2 * HS)), q = (p % 0.5) * 2, w = q * HS, lift = 6 * sin(PI * q), o = sin(TAU * p);
  D.fl = [p < 0.5 ? 0 : lift, p < 0.5 ? w : HS - w];
  D.fr = [p < 0.5 ? lift : 0, p < 0.5 ? w : HS - w];
  Object.assign(D, { bob: 2 - 1.6 * sin(PI * q), sway: (p < 0.5 ? -1.2 : 1.2) * sin(PI * q), al: 0.45 + 0.25 * o, ar: 0.45 - 0.25 * o, bl: 0.5, br: 0.5 });
}

// The body for beat b of a try: crouch, rise with the skull, the gag, crouch
// to put it back, shrug.
function pose(D, k, b) {
  const E = 1.8 + GAG[k], q = b - 1.8, big = k === BIG, w = sin(PI * b), o = sin(TAU * b);
  let c = b < 0.8 ? ease(b / 0.8) : 1 - ease(k === BITER ? (b - 0.95) / 0.3 : b - 0.8);
  if (k < BITER || k === PUMPKIN) c = max(c, b < E + 1.2 ? ease((b - E - 0.4) / 0.6) : 1 - ease((b - E - 1.2) / 0.5));
  D.bob += (big ? 7 : 3) * c;
  D.lean += (big ? 0.2 : 0.12) * c;
  // A hand on the hip while the other carries.
  if (k > SMALL && k !== BITER) blend(D, { al: 0.5, bl: -1.6 }, 1 - ease((b - (k === RIGHT ? 2 : E + 1.8)) / 0.4));
  if (big) {
    // Blind: groping, staggering.
    const g = win(q, 0.3, 0.4, GAG[k] - 0.5, 0.4);
    blend(D, { al: 1.3 + 0.3 * o, ar: 1.3 - 0.3 * o, bl: 0.4, br: 0.4, sway: 3 * w, lean: D.lean + 0.1 * w }, g);
    D[w > 0 ? "fr" : "fl"] = [5 * abs(w) * g, 2 * abs(w) * g];
  }
  // The hips work against the small one's wobble.
  if (k === SMALL && b < E) D.sway = -3 * sin(TAU * 1.25 * q) * cl(q / 1.5, 0, 1);
  if (k === BITER) {
    // Bitten: jump back, the free arm flapping.
    const g = win(b, 1, 0.2, 3.4, 0.4);
    D.lean -= 0.12 * g;
    D.bob -= 3 * g * abs(sin(TAU * 1.25 * b));
    blend(D, { al: 1.3 + 0.5 * sin(TAU * 2 * b), bl: 0.6 }, g);
  }
  if (k === RIGHT) {
    // The jig: kicks to each side, hands on the hips.
    const g = win(q, 0.5, 0.4, 6.4, 0.3), j = sin(PI * (b - floor(b))) ** 2 * g, s = floor(b) & 1 ? 1 : -1;
    blend(D, { sway: -2 * s * j, bob: -2 * j, head: 0.2 * s * j, al: 0.5, ar: 0.5, bl: -1.6, br: -1.6 }, g);
    D[s < 0 ? "fl" : "fr"] = [12 * j, 7 * j];
    blend(D, { al: 2.6, ar: 2.6, bl: 0.3, br: 0.3 }, win(b, 8.4, 0.15, 9, 0.4));
  }
  const s0 = shrugAt(k);
  blend(D, { shr: 3.5, al: 0.3, ar: 0.3, bl: 2.5, br: 2.5 }, win(b, s0, 0.3, s0 + 0.9, 0.3));
}

// The skull being tried and the hands on it.
function skull(S, K, st, b) {
  const Hd = st.Hd, k = st.kind, E = 1.8 + GAG[k], q = b - 1.8, R = (s, w, x, y) => (K.hold[s] = [w, x, y]);
  // Patting the neck where it was.
  const pat = k === RIGHT ? win(b, 9.2, 0.3, 10.4, 0.3) : 0;
  if (pat > 0) for (const s of [0, 1]) R(s, pat, K.nx + (2 * s - 1) * 5, K.ny - 3 + 3 * sin(TAU * 2 * b + s * PI));
  if (!Hd) return;
  // A hand on top; both at the sides of the big one.
  const take = (w, two = k === BIG) => (two ? [0, 1].forEach((s) => R(s, w, ...grip(Hd, 2 * s - 1))) : R(1, w, ...grip(Hd, 0)));
  sit(S, st, Hd);
  const sx = Hd.x, sy = Hd.y;
  if (k === BITER) {
    Hd.jaw = b > 0.8 && b < 1.05 ? 1.3 : 0.5 * max(0, sin(TAU * 3 * b));
    if (b < 1.05) take(ease(b / 0.6));
    else if (b < 3.3) {
      // Clamped on the hand, shaken high.
      Object.assign(Hd, { x: K.x[14], y: K.y[14] + 2, a: 0.35 * sin(TAU * 2.5 * b), jaw: 0, z: 2, fx: K.x[14] });
      R(1, 1, BX + 13 + 5 * sin(TAU * 2.2 * b), 34 + 4 * sin(TAU * 4.4 * b));
    } else if (b < 4.1) {
      // Flung back, turning once.
      arc(Hd, Hd.fx ?? sx, 36, 0, sx, sy, -TAU, ease((b - 3.3) / 0.8), 8, 2);
      R(1, 1 - ease((b - 3.3) / 0.5), SX - 6, 60);
    }
    return;
  }
  if (b < 0.8) return take(ease(b / 0.6));
  if (b < 1.8) return arc(Hd, sx, sy, 0, K.nx, K.ny, K.na, ease(b - 0.8), 7), take(1);
  const gag = (t) => {
    Object.assign(Hd, { x: K.nx, y: K.ny, a: K.na, z: 1 });
    if (k === BIG) {
      // It drops down over the ribs.
      const [p, r] = rot(K.na, 0, (6 + 18 * Hd.sc) * ease(t / 0.4) - 3 * sin(PI * cl((t - 0.4) / 0.3, 0, 1)));
      (Hd.x += p), (Hd.y += r);
    } else if (k === SMALL) {
      // Wobbling ever wider, then tipping off.
      const tip = ease((t - GAG[k] + 0.7) / 0.5);
      Hd.a += 0.5 * sin(TAU * 1.25 * t) * cl(t / 1.5, 0, 1) * (1 - tip) + 1.4 * tip;
      (Hd.x += 5 * tip), (Hd.y += 3 * tip);
    } else if (k === HAT) Hd.hd = win(t, 0.3, 0.2, 1, 0.3) + (t > 2.1 && t < GAG[k] ? ease((t - 2.1) / 0.2) : 0);
  };
  if (k === RIGHT) {
    gag(min(q, 6.6));
    Hd.glow = ease(q / 0.4);
    Hd.flash = q < 0.5 ? 1 - q / 0.5 : 0;
    for (let c = 0; c < 3; c++) Hd.eye[c] = mix(DARK[c], TOXIC[c], Hd.glow);
    Hd.jaw = K.D.jaw;
    if (q < 0.3) take(1 - ease(q / 0.3));
    if (b > 8.4) {
      // Off it goes.
      const f = min(1, b - 8.4);
      arc(Hd, K.nx, K.ny, K.na, 3, GROUND - 3.5, -TAU, f, 14, 2);
      if (f >= 1) (S.lost = { Hd, wx: 3 + S.cam, t: 0 }), (st.Hd = null);
    }
    return;
  }
  if (b < E) {
    gag(q);
    if (k === PUMPKIN) R(1, win(q, 0.6, 0.3, 2.4, 0.3), Hd.x + 10 + 2.5 * abs(sin(TAU * 1.5 * q)), Hd.y - 7);
    else if (k === HAT) R(1, win(q, 0.8, 0.2, 1.6, 0.3), Hd.x + 6.5 * Hd.sc, Hd.y + (10 * Hd.hd - 17) * Hd.sc);
    else if (k === SMALL) {
      // Hands up ready; the right one catches it.
      for (const s of [0, 1]) R(s, ease((q - 0.3) / 0.4), K.nx + (2 * s - 1) * 11, K.ny - 8);
      if (b > E - 0.5) R(1, 1, ...grip(Hd, 1));
    } else if (q < 0.3) take(1 - ease(q / 0.3));
    return;
  }
  gag(E - 1.801);
  if (b < E + 0.4) return take(ease((b - E) / 0.4));
  if (b < E + 1.4) return arc(Hd, Hd.x, Hd.y, Hd.a, sx, sy, 0, ease(b - E - 0.4), 6), (Hd.hd = 0), take(1);
  sit(S, st, Hd);
  take(1 - ease((b - E - 1.4) / 0.4));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1), hue = cl(kn[0], 0, 1);
  if (hue !== S.hue) {
    hsv(0.78 - 0.3 * (S.hue = hue), 0.62, S.light);
    background(S);
  }
  (S.size = cl(kn[3], 0, 1)), (S.tries = round(cl(kn[2], 1, 5)));
  if (!S.stones.length) (S.g = 5 - S.tries), (S.stones = [-1, 0, 1].map((j) => stone(S, j)));
  const db = d * cl(kn[1], 0.2, 3);
  (S.b += db), (S.t += d);
  let st = S.stones[1];
  if (!S.ph && S.b >= shrugAt(st.kind) + 1.2) (S.b -= shrugAt(st.kind) + 1.2), (S.ph = 1), (S.c0 = S.cam);
  if (S.ph && S.b >= WALK) {
    S.b -= WALK;
    S.ph = 0;
    S.cam = S.c0 + GAP;
    S.stones = [S.stones[1], S.stones[2], stone(S, S.stones[2].j + 1)];
    st = S.stones[1];
  }
  const K = S.K, D = Object.assign(K.D, REST, { fl: [0, 0], fr: [0, 0] });
  K.hold = [[0], [0]];
  if (S.ph) {
    // Walking on: the camera glides one stone further.
    S.cam = S.c0 + GAP * ease(S.b / WALK);
    gait(D, (S.cam - S.c0) / SC);
  } else pose(D, st.kind, S.b);
  torso(D, K);
  for (const x of S.stones) if (x.Hd && (x !== st || S.ph)) sit(S, x, x.Hd);
  if (!S.ph) skull(S, K, st, S.b);
  arms(D, K);
  if (S.lost) {
    // Rolling away about the middle of the cranium.
    const L = S.lost, x = L.wx - S.cam - 9 * (L.t += db), a = -L.t, [p, r] = rot(a, 0, 10.6);
    Object.assign(L.Hd, { x: x + p, y: GROUND - 14.1 + r, a, z: 2 });
    if (x < -24) S.lost = null;
  }
}

// --- the graveyard, laid out per sky colour: the stepped sky and the moon
// over a dark hill.
const MX = 46, MY = 20, MR = 12;
const put = (buf, o, r, g, b) => ((buf[o] = r), (buf[o + 1] = g), (buf[o + 2] = b));
function background(S) {
  const L = S.light;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = sqrt((x + 0.5 - MX) ** 2 + (y + 0.5 - MY) ** 2), v = floor((0.14 + 0.5 * (y / GROUND) ** 1.6) * 20) / 20, e = q < MR + 4 ? 60 : q < MR + 9 ? 26 : 0;
      const sp = q > MR - 1.5 || (x - MX + 3) ** 2 + (y - MY + 2) ** 2 < 10 ? 24 : 0;
      if (q < MR) put(S.bg, (y * W + x) * 3, 255 - sp, 240 - sp, 204 - sp);
      else if (y > 100 + 4 * sin(x * 0.09) + 2.5 * sin(x * 0.23 + 1.3)) put(S.bg, (y * W + x) * 3, L[0] * 0.16 + 8, L[1] * 0.16 + 6, L[2] * 0.16 + 12);
      else put(S.bg, (y * W + x) * 3, L[0] * v + e, L[1] * v + e * 0.93, L[2] * v + e * 0.83);
    }
}
// A tall headstone with a cut cross, rimmed by the moon.
const inStone = (dx, y) => abs(dx) < SHW && y < GROUND && (y >= ST + SHW || dx * dx + (y - ST - SHW) ** 2 < SHW * SHW);
function headstone(buf, cx) {
  for (let y = ST - 1; y < GROUND; y++)
    for (let x = max(0, floor(cx - SHW)); x < min(W, ceil(cx + SHW)); x++) {
      const dx = x + 0.5 - cx, yy = y + 0.5;
      if (!inStone(dx, yy)) continue;
      const cut = (abs(dx) < 1.1 && y > ST + 5 && y < ST + 19) || (abs(dx) < 4.2 && y >= ST + 9 && y < ST + 11);
      const v = !inStone(dx, yy - 1) || !inStone(dx + 1, yy) ? 1.6 : cut ? 0.45 : dx < 3 - SHW ? 0.75 : 1;
      put(buf, (y * W + x) * 3, 92 * v, 94 * v, 112 * v);
    }
}
// Bone in three tones, the darkest tinted by the sky; the hat violet.
const BONE = [[255, 244, 220], [212, 202, 180], [96, 88, 84]];
const HATC = [[196, 120, 255], [140, 64, 210], [70, 26, 112]];
const FIELD = new Float32Array(48 * 48);
function piece(S, pc, cx, cy, a, sc, Hd) {
  const [k, sg, x0, x1, y0, y1] = pc, c = cos(a), s = sin(a);
  let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9;
  for (const [u, v] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    const wx = cx + (u * c - v * s) * sc, wy = cy + (u * s + v * c) * sc;
    (xa = min(xa, wx)), (xb = max(xb, wx)), (ya = min(ya, wy)), (yb = max(yb, wy));
  }
  xa = max(0, floor(xa) - 1);
  xb = min(W - 1, ceil(xb) + 1);
  ya = max(0, floor(ya) - 1);
  yb = min(H - 1, ceil(yb) + 1);
  if (xb < xa || yb < ya || xb - xa >= 48 || yb - ya >= 48) return;
  const buf = S.buf, L = S.light, z = 1 / sc;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      FIELD[(y - ya) * 48 + x - xa] = shape(k, (dx * c + dy * s) * z, (-dx * s + dy * c) * z, sg) * sc;
    }
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const f = (y - ya) * 48 + x - xa, d = FIELD[f], o = (y * W + x) * 3;
      if (d > 0.1) {
        if (d < 1.1) for (let ch = 0; ch < 3; ch++) buf[o + ch] *= 0.3;
        continue;
      }
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, hl = hole(k, (dx * c + dy * s) * z, (-dx * s + dy * c) * z);
      if (hl && hl !== 3) {
        const e = hl === 1 ? [2, 0, 4] : hl === 5 ? [245, 134, 2] : Hd.eye, g = hl === 2 ? 0.34 : 1;
        put(buf, o, e[0] * g + 10, e[1] * g + 6, e[2] * g + 14);
        continue;
      }
      const up = y > ya ? FIELD[f - 48] : d + 1, dn = y < yb ? FIELD[f + 48] : d + 1, n = (up - dn) / (abs(up - dn) + abs((x > xa ? FIELD[f - 1] : d) - (x < xb ? FIELD[f + 1] : d)) + 0.01);
      const t = hl === 3 || n <= -0.3 ? 2 : n > 0.4 || (d > -0.6 && up > 0.1) ? 0 : 1, C = k === 9 ? HATC : BONE, w = t === 2 && k !== 9 ? 0.4 : 0;
      for (let ch = 0; ch < 3; ch++) buf[o + ch] = C[t][ch] + L[ch] * w;
    }
}
// A jack-o'-lantern, the face flickering in three steps.
function pumpkin(S, Hd) {
  const buf = S.buf, cx = Hd.x, cy = Hd.y - 6, v = 0.6 + 0.2 * sin(S.t * 9) + 0.2 * sin(S.t * 23.7), fl = v > 0.82 ? 1 : v > 0.66 ? 0.84 : 0.7;
  for (let y = max(0, floor(cy - 11)); y < min(H, cy + 9); y++)
    for (let x = max(0, floor(cx - 11)); x < min(W, cx + 11); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, o = (y * W + x) * 3, e = (dx / 9) ** 2 + (dy / 7) ** 2;
      if (e < 1) {
        const rib = abs(abs(dx) - 4.2) < 0.6 && e > 0.25, eye = dy > -4.2 && dy < -0.8 && abs(abs(dx) - 3.6) < 1.9 + (dy + 4.2) * 0.5, grin = dy > 1.1 && dy < 3.9 - abs(dx) * 0.15 && abs(dx) < 6 && !(abs(dx) % 3 < 0.8 && dy < 2.2);
        if (eye || grin) put(buf, o, 255, 196 * fl + 30, 50 * fl);
        else put(buf, o, rib ? 220 : 255, rib ? 84 : 118, rib ? 0 : 10);
      } else if (e < 1.35 && dy > -8) put(buf, o, buf[o] * 0.3, buf[o + 1] * 0.3, buf[o + 2] * 0.3);
      if (abs(dx + 0.3) < 1.2 && dy > -9.6 && dy < -6.2) put(buf, o, 72, 150, 40);
    }
}
function head(S, Hd) {
  if (Hd.kind === PUMPKIN) return pumpkin(S, Hd);
  // The right one's toxic halo, white on the click.
  const [p, q] = rot(Hd.a, 0, -8), cx = Hd.x + p, cy = Hd.y + q, f = Hd.flash || 0;
  for (let y = max(0, floor(cy - 15)); y < min(H, cy + 15) && Hd.glow > 0; y++)
    for (let x = max(0, floor(cx - 15)); x < min(W, cx + 15); x++) {
      const v = floor(max(0, 1 - sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / 15) * 4) / 4;
      for (let ch = 0, o = (y * W + x) * 3; ch < 3; ch++) S.buf[o + ch] += (TOXIC[ch] * Hd.glow * 0.8 + 255 * f) * v;
    }
  piece(S, SKULL, Hd.x, Hd.y, Hd.a, Hd.sc, Hd);
  const [j0, j1] = rot(Hd.a, 0, (2.4 * Hd.jaw - 0.7) * Hd.sc), [h0, h1] = rot(Hd.a, 0, 10 * Hd.hd * Hd.sc);
  piece(S, JAW, Hd.x + j0, Hd.y + j1, Hd.a, Hd.sc, Hd);
  if (Hd.kind === HAT) piece(S, CAP, Hd.x + h0, Hd.y + h1, Hd.a, Hd.sc, Hd);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.hue < 0 || !S.stones.length) return;
  const buf = S.buf, K = S.K, cam = S.cam;
  buf.set(S.bg);
  // The ground, a lit edge and specks sliding with the camera.
  for (let p = GROUND * W; p < N; p++) {
    const y = (p / W) | 0, e = y === GROUND ? 30 : (floor((p % W) + cam) * 7 + y * y * 3) % 11 ? 0 : 12;
    put(buf, p * 3, 40 + e, 26 + e * 0.8, 48 + e);
  }
  const heads = (z) => [...S.stones.map((st) => st.Hd), S.lost?.Hd].forEach((Hd) => Hd && Hd.z === z && head(S, Hd));
  // The stones stand in front of the path; the hands in front of what they hold.
  for (let i = 0; i < 13; i++) piece(S, PIECES[i], K.x[i], K.y[i], K.a[i], K.sc, null);
  for (const st of S.stones) headstone(buf, SX + st.j * GAP - cam);
  heads(0);
  heads(1);
  for (let i = 13; i < 15; i++) piece(S, PIECES[i], K.x[i], K.y[i], K.a[i], K.sc, null);
  heads(2);
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) & 252, min(255, buf[o + 1]) & 252, min(255, buf[o + 2]) & 252);
}
