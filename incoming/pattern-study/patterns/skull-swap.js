// ===== Patternflow pattern =====
// Title:   Skull Swap
// Family:  halloween
// Idea:    Two skeletons dance side by side in a moonlit graveyard, then each lifts off its own skull and they toss them across on crossing arcs past the moon, catch them on the wrong necks, wobble, turn their glowing sockets on each other, shrug, and toss them back.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 50, built on Bone Pile, pattern round 48
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Toss=0..1, Dance=2..8
//
// Knob 1: Hue. The night sky and the shade side of the bones, through the cold half of the wheel only: violet at 0, blue at 0.25, cyan at 0.5, sea green at 0.75, toxic green at 1. The moon stays cream, the pumpkin orange, one skull's eyes green and the other's orange.
// Knob 2: Speed. The tempo, 50 beats a minute for each unit. At the opening 100 the skulls leave the hands at 1.6 s, land on the wrong necks at 2.2 s, the two look at each other at 2.9 s, shrug at 3.7 s and throw back at 4.6 s. At 0.2 ten times slower; 150 at 3.
// Knob 3: Toss. How high the skulls fly and how often they spin. At 0 the taller arc tops out over the moon's lower half and each skull turns once; at 0.5 it clears the moon and they turn twice; at 1 they leave the top of the panel, turn three times and the throwers hop.
// Knob 4: Dance. Beats danced between swaps, 2 to 8. Each round they dance the next of three dances: a sway with both arms up, kicks to the side with hands on hips, a bounce at the knees pumping the forearms in turn.
// Buttons: K1 tap ends the dance and starts the throw at once.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, atan2, acos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ease = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hsv = (h, s, o) => [5, 3, 1].forEach((n, c) => {
  const k = (n + h * 6) % 6;
  o[c] = 255 * (1 - s * max(0, min(k, 4 - k, 1)));
});

// --- shapes in their own frames, y down, as distances (negative inside).
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
// Kinds: 0 long bone, 1 paired bones, 2 cage and neck, 3 lumbar, 4 pelvis,
// 5 skull, 6 jaw, 7 hand, 8 foot, 9 hat. The cage is narrower than Bone Pile's.
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
      // A witch's hat: brim, tapering cone, bent tip.
      const t = cl((-17.4 - y) / 10, 0, 1);
      return min(ell(x, y, 0.4, -17, 8.4, 1.4), seg(x, y, 0, -17.4, 2.6, -27.4) - mix(4.6, 0.7, t), seg(x, y, 2.6, -27.4, 6, -28.6) - 0.7);
    }
  }
}
// 0 none, 1 dark, 2 socket, 3 shade, 4 pupil, 5 hat band; the face slides
// sideways as the head turns, the pupils further.
function hole(k, x, y, Hd) {
  if (k === 5) {
    const p = Hd.pitch * 3, xs = x - Hd.yaw * 1.7;
    if (((abs(xs) - 2.9) / 2.2) ** 2 + ((y + 7.9 - p) / 2.5) ** 2 < 1) return ((abs(xs) - 2.9 - Hd.yaw * Math.sign(xs) * 0.9) / 1.15) ** 2 + ((y + 7.7 - p) / 1.3) ** 2 < 1 ? 4 : 2;
    const ny = y + 5.4 - p;
    if (ny >= 0 && ny < 1.7 && abs(xs) < 0.3 + 0.5 * ny) return 1;
    if (y > -2 + p * 0.5 && y < -0.5 && abs(xs * 0.8) < 3.4) return (xs + 4) / 1.45 - floor((xs + 4) / 1.45) < 0.3 || y > -0.9 ? 1 : 0;
  } else if (k === 6 && y < 1.2 && y > -0.2 && abs(x) < 3.8) return (x + 4) / 1.45 - floor((x + 4) / 1.45) < 0.3 ? 1 : 0;
  else if (k === 4 && ((abs(x) - 4.6) / 2.3) ** 2 + ((y + 4.4 + 0.3 * abs(x)) / 1.3) ** 2 < 1) return 3;
  else if (k === 9 && y > -19.4 && y < -17.6 && abs(x) < 5.2) return 5;
  return 0;
}

// Body pieces back to front, [kind, length, bounds]; the hands are drawn
// after the heads, to hold one from in front.
const FEMUR = 22, TIBIA = 21, ARM = 15, FORE = 13, HIP = 6.5, FLOOR = 120, HIPY = FLOOR - 3 - FEMUR - TIBIA;
const two = (p) => [p, p];
const PIECES = [[8, -1, -3.9, 3.9, -1, 3.2], [8, 1, -3.9, 3.9, -1, 3.2], ...two([1, TIBIA, -2.4, 2.4, -11, 11]), ...two([0, FEMUR, -2.6, 2.6, -11.4, 11.4]), [4, 0, -11, 11, -9, 5.2], [3, 0, -3.6, 3.6, -5.3, 5.3], [2, 0, -10.6, 10.6, -4.5, 22.6], ...two([0, ARM, -2.6, 2.6, -7.9, 7.9]), ...two([1, FORE, -2.4, 2.4, -7, 7]), ...two([7, 0, -2.7, 2.7, -0.3, 6.1])];
const SKULL = [5, 0, -7.2, 7.2, -18.1, 0.6], JAW = [6, 0, -4.4, 4.4, -0.3, 3.5], HAT = [9, 0, -8.6, 7, -29.6, -15.4];

// --- the body, posed in Bone Pile's frame (floor 120, x = 0, full size)
// and placed on the panel at its own scale.
const at = (K, i, x, y, a) => {
  K.x[i] = K.cx + K.sc * x;
  K.y[i] = FLOOR + K.sc * (y - FLOOR);
  K.a[i] = a;
};
const ang = (dx, dy) => atan2(-dx, dy);
const bone = (K, i, ax, ay, bx, by) => at(K, i, (ax + bx) / 2, (ay + by) / 2, ang(bx - ax, by - ay));
const rot = (a, x, y) => [x * cos(a) - y * sin(a), x * sin(a) + y * cos(a)];
// Two-bone reach; of the two joints that work, the one nearer (px, py).
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
// Legs, spine and cage; leaves the neck on the panel in K.nx, K.ny, K.na.
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
// Arms from the dance angles, each hand pulled toward its K.hold target.
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

const REST = { sway: 0, bob: 0, tilt: 0, lean: 0, head: 0, pitch: 0, jaw: 0, shr: 0, al: 0.1, bl: 0.06, ar: 0.1, br: 0.06, fl: [0, 0], fr: [0, 0] };
const clack = (b) => max(0, sin(TAU * b)) ** 2;
function dance(m, b, D) {
  Object.assign(D, REST, { fl: [0, 0], fr: [0, 0], jaw: clack(b) });
  const w = sin(PI * b), s2 = sin((PI * b) / 2);
  if (m === 0) {
    // Sway: hips side to side over four beats, both arms up waving.
    Object.assign(D, { sway: 3 * s2, tilt: 0.1 * s2, lean: -0.08 * s2, head: -0.18 * s2, al: 2.75 + 0.18 * w, ar: 2.75 - 0.18 * w, bl: 0.25 + 0.25 * w, br: 0.25 - 0.25 * w });
  } else if (m === 1) {
    // Kicks: a foot out to the side each beat, hands on the hips.
    const k = sin(PI * (b - floor(b))) ** 2, s = floor(b) & 1 ? 1 : -1;
    D[s < 0 ? "fl" : "fr"] = [8 * k, 4 * k];
    Object.assign(D, { sway: -s * 1.2 * k, head: s * 0.16 * k, al: 0.5, ar: 0.5, bl: -1.6, br: -1.6 });
  } else {
    // Bounce: a dip at the knees on every beat, elbows at the sides and the
    // forearms pumping up in turn.
    const e = 0.5 - 0.5 * cos(PI * b);
    Object.assign(D, { bob: 1.4 - 1.4 * cos(TAU * b), sway: 1.5 * w, head: 0.16 * w, al: 0.3, bl: 0.2 + 2.3 * e, ar: 0.3, br: 2.5 - 2.3 * e });
  }
}
// The right-hand skeleton dances the mirror image.
function mirror(D) {
  [D.al, D.ar, D.bl, D.br, D.fl, D.fr] = [D.ar, D.al, D.br, D.bl, D.fr, D.fl];
  for (const key of ["sway", "tilt", "lean", "head"]) D[key] = -D[key];
}

// The story of one round in beats from its start: dance, lift, fly, land on
// the wrong neck, look, shrug, lift, fly back, land home and nod.
const LIFT = 0.6;
function times(S) {
  const t0 = S.d, t1 = t0 + LIFT, t2 = t1 + S.T, t3 = t2 + 1.2, t4 = t3 + 1.3, t5 = t4 + 1.6;
  return [t0, t1, t2, t3, t4, t5, t5 + LIFT, t5 + LIFT + S.T, t5 + LIFT + S.T + 1.6];
}

export function setup(params) {
  const body = (cx, sc) => ({ cx, sc, x: new Float64Array(15), y: new Float64Array(15), a: new Float64Array(15), D: { ...REST } });
  params.s = {
    hue: -1, beat: 0, t: 0, start: 0, moves: 0, d: 2, T: 1,
    light: [0, 0, 0], bg: new Float32Array(N * 3), buf: new Float32Array(N * 3),
    // The green-eyed skull belongs to the tall skeleton on the left, the
    // orange-eyed one in the hat to the short one on the right.
    K: [body(16, 0.8), body(48, 0.68)],
    hd: [{ sc: 1, eye: [96, 255, 64], hat: 0 }, { sc: 0.86, eye: [255, 132, 8], hat: 1 }],
  };
}

// Where a skull's hands go: either side of its cranium.
const sides = (Hd, s) => {
  const [p, q] = rot(Hd.a, s * 8.6 * Hd.sc, -6 * Hd.sc);
  return [Hd.x + p, Hd.y + q];
};
const onNeck = (Hd, K, lift) => {
  const [p, q] = rot(K.na, 0, -7 * lift);
  Object.assign(Hd, { x: K.nx + p, y: K.ny + q, a: K.na + K.wob, yaw: K.yaw, jaw: K.D.jaw, pitch: K.D.pitch, fly: 0 });
};

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 2], d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1);
  if (hue !== S.hue) {
    S.hue = hue;
    hsv(0.78 - 0.47 * hue, 0.62, S.light);
    background(S);
  }
  const toss = cl(k[2], 0, 1), every = round(cl(k[3], 2, 8));
  S.beat += (d * 50 * cl(k[1], 0.2, 3)) / 60;
  S.t += d;
  let u = S.beat - S.start;
  if (u < S.d) S.d = every;
  if (input.btnPressed && input.btnPressed[0] && u < S.d) (S.start = S.beat - S.d), (u = S.d);
  let T = times(S);
  if (u >= T[8]) {
    S.start += T[8];
    u -= T[8];
    S.moves++;
    S.d = every;
  }
  T = times(S);
  // The arc is settled while no skull is in the air.
  if (!((u >= T[1] && u < T[2]) || (u >= T[6] && u < T[7]))) {
    S.h = 13 + 32 * toss;
    S.T = 0.26 * sqrt(S.h);
    S.turns = 1 + floor(toss * 2.99);
    S.hop = toss;
    T = times(S);
  }
  const [t0, t1, t2, t3, t4, t5, t6, t7] = T, m = S.moves % 3;
  // Bodies: the dance, eased in and out, then the story.
  S.K.forEach((K, i) => {
    const D = K.D, dir = i ? -1 : 1;
    dance(m, S.beat, D);
    if (i) mirror(D);
    const w = ease(u / 0.5) * (1 - ease((u - t0) / 0.4));
    for (const key in REST) if (typeof REST[key] === "number") D[key] = mix(REST[key], D[key], w);
    for (const f of ["fl", "fr"]) D[f] = D[f].map((v) => v * w);
    K.wob = K.lift = 0;
    for (const [ts, back] of [[t0, 0], [t5, 1]]) {
      const q = u - ts;
      if (q < 0 || q > LIFT + S.T + 1.6) continue;
      if (q < LIFT) {
        // Crouch with the skull lifted off the neck.
        K.lift = ease((q / LIFT - 0.35) / 0.65);
        D.bob += K.lift * (4 + 4 * S.hop);
      } else if (q < LIFT + S.T) {
        // A hop on the throw, more for a high one.
        const f = (q - LIFT) / S.T;
        D.bob -= (2 + 7 * S.hop) * sin(PI * cl(f * 2.5, 0, 1));
      } else {
        // Landed: the knees give, more under the big skull; the head wobbles.
        const v = q - LIFT - S.T, big = (i === 1) !== !!back ? 1.5 : 1;
        D.bob += 5 * big * exp(-4 * v) * sin(min(PI, v * 9));
        K.wob = (back ? 0.22 : 0.5) * big * exp(-2.4 * v) * sin(TAU * 2.2 * v) * dir;
      }
    }
    // Look: the sockets turn on the other one; the jaw drops.
    const lk = ease((u - t3) / 0.25) * (1 - ease((u - t4 + 0.1) / 0.3));
    K.yaw = dir * lk;
    D.lean += 0.07 * lk * dir;
    D.jaw = max(D.jaw, 0.9 * lk * ease((u - t3 - 0.45) / 0.15));
    // Shrug: shoulders up, elbows out, hands up and open, head on one side.
    const sh = ease((u - t4) / 0.3) * (1 - ease((u - t5 + 0.45) / 0.35));
    if (sh > 0) Object.assign(D, { shr: 3.5 * sh, al: mix(D.al, 0.3, sh), ar: mix(D.ar, 0.3, sh), bl: mix(D.bl, 2.5, sh), br: mix(D.br, 2.5, sh), head: D.head + 0.32 * sh * dir, jaw: max(D.jaw, 0.5 * sh) });
    // Home again: a nod.
    const n = (u - t7 - 0.8) / 0.6;
    D.pitch = n > 0 && n < 1 ? sin(PI * n) : 0;
    torso(D, K);
  });
  // Skulls: on a neck, lifted, or flying neck to neck, the left one higher.
  const A = S.K[0];
  S.hd.forEach((Hd, i) => {
    const own = S.K[i], other = S.K[1 - i];
    let from = null, to = null, f = 0;
    if (u < t1) onNeck(Hd, own, own.lift);
    else if (u < t2) (from = own), (to = other), (f = (u - t1) / S.T);
    else if (u < t6) onNeck(Hd, other, other.lift);
    else if (u < t7) (from = other), (to = own), (f = (u - t6) / S.T);
    else onNeck(Hd, own, 0);
    if (from) {
      // The arc is the cranium's middle, and the skull spins about it.
      const pv = -9.5 * Hd.sc, h = S.h + (from === A ? 12 : 0), a = mix(from.na, to.na, f) + (from === A ? 1 : -1) * S.turns * TAU * f;
      const [p, q] = rot(from.na, 0, pv - 7), [r, s] = rot(to.na, 0, pv), [e, g] = rot(a, 0, pv);
      Object.assign(Hd, { x: mix(from.nx + p, to.nx + r, f) - e, y: mix(from.ny + q, to.ny + s, f) - 4 * h * f * (1 - f) - g, a, yaw: 0, jaw: 0.8, pitch: 0, fly: 1 });
    }
  });
  // Hands: onto the skull, after it on the throw, up to catch, then down.
  S.K.forEach((K, i) => {
    K.hold = [[0], [0]];
    const dir = i ? -1 : 1;
    for (const [ts, back] of [[t0, 0], [t5, 1]]) {
      const q = u - ts, f = (q - LIFT) / S.T, mine = S.hd[back ? 1 - i : i], theirs = S.hd[back ? i : 1 - i];
      if (q < 0 || f > 1 + 0.8 / S.T) continue;
      for (const s of [0, 1]) {
        const sd = 2 * s - 1;
        if (f < 0) K.hold[s] = [ease(q / LIFT / 0.45), ...sides(mine, sd)];
        else if (f < 1) {
          const c = ease((f - 0.3) / 0.45), [x, y] = sides({ x: K.nx, y: K.ny, a: K.na, sc: theirs.sc }, sd);
          K.hold[s] = [1, mix(K.nx + dir * 9 + sd * 3, x, c), mix(K.ny - 18, y, c)];
        } else K.hold[s] = [1 - ease((q - LIFT - S.T - 0.2) / 0.5), ...sides(theirs, sd)];
      }
    }
    arms(K.D, K);
  });
}

// --- the graveyard, laid out per sky colour: a stepped sky, the moon and two
// halo rings, black stones rimmed by the moon, the ground.
const MX = 32, MY = 21, MR = 13, GROUND = 117;
const CRATERS = [[-4, -4, 3.2], [4, 1, 2.6], [-2, 6, 2.2], [6, -6, 1.6], [-7, 2, 1.4]];
const STONES = [[5, 101, 5.5], [24, 108, 3.6], [41, 107, 3.8], [59, 99, 5.5]];
function grave(x, y) {
  let d = abs(x - 32) < 1.6 && y > 86 && y < GROUND ? 0 : abs(x - 32) < 6 && y > 92 && y < 95.5 ? 0 : 1;
  for (const [sx, top, hw] of STONES) if (abs(x - sx) < hw && y < GROUND && (y > top + hw || (x - sx) ** 2 + (y - top - hw) ** 2 < hw * hw)) d = 0;
  return d === 0;
}
function background(S) {
  const bg = S.bg, L = S.light;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, q = sqrt((x + 0.5 - MX) ** 2 + (y + 0.5 - MY) ** 2);
      let r, g, b;
      if (y < GROUND) {
        const v = floor((0.14 + 0.52 * (y / GROUND) ** 1.6) * 20) / 20;
        (r = L[0] * v), (g = L[1] * v), (b = L[2] * v);
        if (q < MR) {
          const sp = CRATERS.some(([a, b, c]) => (x + 0.5 - MX - a) ** 2 + (y + 0.5 - MY - b) ** 2 < c * c) ? 26 : 0;
          (r = 255 - sp), (g = 240 - sp), (b = 204 - sp);
        } else if (q < MR + 4) (r += 60), (g += 56), (b += 50);
        else if (q < MR + 9) (r += 26), (g += 24), (b += 22);
        if (grave(x, y)) {
          // Black stone, rimmed on top where the moon catches it.
          const rim = !grave(x, y - 1);
          (r = rim ? 120 : 14), (g = rim ? 110 : 8), (b = rim ? 132 : 22);
        }
      } else {
        const e = y === GROUND ? 1 : 0, sp = (x * 7 + y * y * 3) % 11 ? 0 : 10;
        (r = 40 + 30 * e + sp), (g = 26 + 22 * e + sp), (b = 48 + 30 * e + sp);
      }
      bg[o] = r;
      bg[o + 1] = g;
      bg[o + 2] = b;
    }
}

// Ivory, grey, and shade tinted by the sky; the hat violet.
const PG = [255, 120, 20], BONE = [[255, 244, 220], [212, 202, 180], [96, 88, 84]];
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
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, hl = hole(k, (dx * c + dy * s) * z, (-dx * s + dy * c) * z, Hd);
      if (hl && hl !== 3) {
        // Dark holes, the glowing sockets and pupils, the hat's band.
        const e = hl === 1 ? [2, 0, 4] : hl === 5 ? [245, 134, 2] : Hd.eye, g = hl === 2 ? 0.34 : 1;
        put(buf, o, e[0] * g + 10, e[1] * g + 6, e[2] * g + 14);
        continue;
      }
      // The slope of the field: where it climbs upward the piece faces the moon.
      const up = y > ya ? FIELD[f - 48] : d + 1, dn = y < yb ? FIELD[f + 48] : d + 1, n = (up - dn) / (abs(up - dn) + abs((x > xa ? FIELD[f - 1] : d) - (x < xb ? FIELD[f + 1] : d)) + 0.01);
      const t = hl === 3 || n <= -0.3 ? 2 : n > 0.4 || (d > -0.6 && up > 0.1) ? 0 : 1, C = k === 9 ? HATC : BONE, w = t === 2 && k !== 9 ? 0.4 : 0;
      for (let ch = 0; ch < 3; ch++) buf[o + ch] = C[t][ch] + L[ch] * w;
    }
}
const put = (buf, o, r, g, b) => {
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
};
function head(S, Hd) {
  piece(S, SKULL, Hd.x, Hd.y, Hd.a, Hd.sc, Hd);
  const [j0, j1] = rot(Hd.a, 0, (-0.7 + 2.4 * Hd.jaw + Hd.pitch * 0.6) * Hd.sc);
  piece(S, JAW, Hd.x + j0, Hd.y + j1 + Hd.pitch * 2.5 * Hd.sc, Hd.a, Hd.sc, Hd);
  if (Hd.hat) piece(S, HAT, Hd.x, Hd.y + Hd.pitch * 2 * Hd.sc, Hd.a, Hd.sc, Hd);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.hue < 0) return;
  const buf = S.buf;
  buf.set(S.bg);
  // The jack-o'-lantern: glow rings on the ground, a face in three steps.
  const v = 0.6 + 0.2 * sin(S.t * 9) + 0.2 * sin(S.t * 23.7), fl = v > 0.82 ? 1 : v > 0.66 ? 0.84 : 0.7;
  for (let y = 104; y < H; y++)
    for (let x = 14; x < 50; x++) {
      const q = sqrt(((x + 0.5 - 32) / 1.6) ** 2 + (y + 0.5 - 121) ** 2), gl = (q < 9 ? 0.3 : q < 13 ? 0.18 : q < 17 ? 0.08 : 0) * fl;
      for (let ch = 0, o = (y * W + x) * 3; ch < 3; ch++) buf[o + ch] += PG[ch] * gl;
    }
  // Shadows of the two skeletons cast forward onto the ground.
  for (const K of S.K)
    for (let y = GROUND + 1; y < GROUND + 6; y++)
      for (let x = 0; x < W; x++) if (abs(x + 0.5 - K.x[6]) < (12 - (y - GROUND) * 1.2) * K.sc) for (let ch = 0; ch < 3; ch++) buf[(y * W + x) * 3 + ch] *= 0.5;
  for (let y = 114; y < 127; y++)
    for (let x = 24; x < 41; x++) {
      const dx = x + 0.5 - 32, dy = y + 0.5 - 121.2, o = (y * W + x) * 3;
      const e = (dx / 7.4) ** 2 + (dy / 5) ** 2;
      if (e < 1) {
        const rib = abs(abs(dx) - 3.4) < 0.6 && e > 0.25, eye = dy > -3 && dy < -0.6 && abs(abs(dx) - 3) < 1.6 + (dy + 3) * 0.5, grin = dy > 0.8 && dy < 2.8 - abs(dx) * 0.15 && abs(dx) < 5 && !(abs(dx) % 2.5 < 0.7 && dy < 1.6);
        if (eye || grin) put(buf, o, 255, 196 * fl + 30, 50 * fl);
        else put(buf, o, rib ? 220 : 255, rib ? 84 : 118, rib ? 0 : 10);
      } else if (e < 1.35 && dy > -6) put(buf, o, buf[o] * 0.3, buf[o + 1] * 0.3, buf[o + 2] * 0.3);
      if (abs(dx + 0.3) < 1 && dy > -7.4 && dy < -4.6) put(buf, o, 72, 150, 40);
    }
  // Bodies, skulls on necks, hands, skulls in the air.
  for (const K of S.K) for (let i = 0; i < 13; i++) piece(S, PIECES[i], K.x[i], K.y[i], K.a[i], K.sc, null);
  for (const Hd of S.hd) if (!Hd.fly) head(S, Hd);
  for (const K of S.K) for (let i = 13; i < 15; i++) piece(S, PIECES[i], K.x[i], K.y[i], K.a[i], K.sc, null);
  for (const Hd of S.hd) if (Hd.fly) head(S, Hd);
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) & 252, min(255, buf[o + 1]) & 252, min(255, buf[o + 2]) & 252);
}
