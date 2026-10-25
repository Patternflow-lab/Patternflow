// ===== Patternflow pattern =====
// Title:   Haunted Swing
// Family:  halloween
// Idea:    An empty swing set seen from the side on a purple night, a plank swing on 100 LEDs of chain swinging by itself as a lightly damped pendulum, a glowing hand of mist now and then shoving it on as it passes the bottom, and the smaller swing behind it on the same crossbar starting to move on its own as the shared bar hands the motion over and back.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 44
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Coupling=0.2..1, Haunt=0..1
//
// Knob 1: Hue. The ghost's light and the night with it. At 0 a toxic green hand in a purple night with lilac moonlight on the metal; at 0.25 cold white in deep blue; at 0.5 violet in dark teal with pale aqua moonlight; at 0.75 pumpkin orange in indigo.
// Knob 2: Speed. The clock of the scene. At 2 a swing takes 2.6 s to go out and back; at 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Coupling. How strongly the shared bar ties the two swings, as the time the near swing takes to hand all its motion to the one behind: 9 s at 0.2, 3.7 s at 0.5 and 1.6 s at 1 (at Speed 2). At 0.2 the swing behind starts still, and after the first push it swings 15 degrees by 8 s while the near one falls from 17 to 8.
// Knob 4: Haunt. How often and how hard the hand comes, and how much of the ghost stays. After a hand has faded the next comes in 8 to 11 s at 0, 7.6 to 10.5 s at 0.06 and 2 to 3 s at 1, pushing twice as hard there, and three times in ten for the swing behind. The seats' after-image lasts 0.9 s at 0.06 and 2 s at 1, where a cold glow also sits on each seat. The first hand comes at 2.2 to 3.5 s at Speed 2 whatever the knob.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The pendulum, in seconds at Speed 2: angular frequency for a 2.6 s swing,
// damping (a swing left alone loses half its energy in 15 s), and the
// half beat of the coupling through the bar at Coupling 1: the two swings
// trade their motion in 1.8 s there, and in 9 s at 0.2.
const OM = (2 * PI) / 2.6, GAM = 0.046, HALF = 1.8;
// The coupling constant that splits the two swings' frequencies by dw.
const kappa = (dw) => ((OM + dw) ** 2 - OM * OM) / 2;
// The largest swing a push may give, in radians.
const AMAX = 0.32;
// The near swing in LEDs: pivot and the distance from pivot to seat. Swings
// farther back are the near one scaled by DEPTH about the point VP, so each
// hangs a little higher and to the right, a fifth smaller.
const PX = 31, PY = 9, LEN = 100, DEPTH = 0.82, VPX = 64, VPY = 0;
// Seconds a push lasts, and its hand fades after.
const PUSH = 0.5, FADE = 1.6;
// Along Hue: the ghost's light (toxic green, cold white, violet, pumpkin,
// green), the night behind it at its glow over the ground (purple, deep
// blue, dark teal, indigo, purple) and the moonlight on the metal and the
// seats (lilac, ice, pale aqua, lavender, lilac).
const TINTS = [[0.45, 1, 0.2], [0.78, 0.92, 1], [0.72, 0.42, 1], [1, 0.5, 0.08], [0.45, 1, 0.2]];
const NIGHTS = [[0.2, 0.04, 0.25], [0.03, 0.07, 0.3], [0, 0.16, 0.2], [0.12, 0.03, 0.3], [0.2, 0.04, 0.25]];
const MOONS = [[0.84, 0.78, 1], [0.7, 0.86, 1], [0.66, 1, 0.9], [0.88, 0.74, 1], [0.84, 0.78, 1]];
// The moon, top left, and the stars.
const MX = 12, MY = 21, MR = 5;
const STARS = [];
for (let i = 0; STARS.length < 12; i++) {
  const x = floor(hash(i * 3 + 7) * W), y = floor(hash(i * 3 + 8) * 70);
  if ((x - MX) ** 2 + (y - MY) ** 2 > 140) STARS.push([x, y, hash(i * 3 + 9) * 6.28]);
}
// The sky by row, black at the top and the night's colour towards the
// ground, in five bands.
const SKY = new Float32Array(H);
for (let y = 0; y < H; y++) SKY[y] = round(cl((y - 30) / 90, 0, 1) ** 1.6 * 5) / 5;

export function setup(params) {
  params.s = {
    begun: false, hue: 0, speed: 2, couple: 0.2, haunt: 0.06,
    // Angle and angular speed of the near swing (0) and the one behind (1).
    t: 0, th: new Float64Array(2), om: new Float64Array(2),
    // Seconds to the next push, and the one under way.
    wait: 2.2, push: null,
    // Recent angles, for the after-image of the seats.
    trail: [], rgb: new Float32Array(W * H * 3), tint: [0.45, 1, 0.2], night: [0.2, 0.04, 0.25], moon: [0.84, 0.78, 1],
  };
}

const scaleOf = (j) => DEPTH ** j;
const pivot = (j) => [VPX + (PX - VPX) * scaleOf(j), VPY + (PY - VPY) * scaleOf(j)];

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.couple = cl(k[2], 0.2, 1);
  S.haunt = cl(k[3], 0, 1);
  if (!S.begun) {
    S.begun = true;
    // The near swing is already moving when the picture opens, more the
    // more haunted the night.
    S.th[0] = 0.21 + 0.09 * S.haunt;
  }
  const ds = (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  S.t += ds;
  // Pushes: when one is due, the hand comes for the near swing, or now and
  // then, with Haunt, for the one at the back.
  const P = S.push;
  if (!P) {
    S.wait -= ds;
    if (S.wait <= 0) {
      const j = Math.random() < 0.3 * S.haunt ? 1 : 0;
      S.push = { j, age: -1, dir: 0, last: S.th[j], at: null };
    }
  } else if (P.age < 0) {
    // The hand waits for the seat to pass the bottom of its arc, and shoves
    // it on from behind, the way it is going.
    const th = S.th[P.j];
    if ((th <= 0 && P.last > 0) || (th >= 0 && P.last < 0) || abs(th) + abs(S.om[P.j]) < 0.02) {
      P.age = 0;
      P.dir = S.om[P.j] >= 0 ? 1 : -1;
    }
    P.last = th;
  } else {
    P.age += ds;
    if (P.age > PUSH + FADE) {
      S.push = null;
      const h = S.haunt;
      S.wait = 8 - 6 * h + (3 - 2 * h) * Math.random();
    }
  }
  // The pendulums in small steps: the large-angle equation with light
  // damping, each swing pulled towards its neighbours through the bar.
  const steps = max(1, ceil(ds / 0.004)), h = ds / steps, KAP = kappa((PI / HALF) * S.couple);
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < 2; j++) {
      let a = -OM * OM * sin(S.th[j]) - GAM * S.om[j];
      a += KAP * (S.th[1 - j] - S.th[j]);
      const Q = S.push;
      if (Q && Q.j === j && Q.age >= 0 && Q.age < PUSH) {
        // The push gives out as the swing nears the largest swing allowed.
        const e = (S.om[j] / OM) ** 2 + 2 * (1 - cos(S.th[j]));
        a += Q.dir * (3 + 3 * S.haunt) * cl(1 - e / (AMAX * AMAX), 0, 1);
      }
      S.om[j] += a * h;
    }
    for (let j = 0; j < 2; j++) S.th[j] += S.om[j] * h;
  }
  S.trail.push([S.t, S.th[0], S.th[1]]);
  while (S.trail.length && S.t - S.trail[0][0] > 2) S.trail.shift();
}

// --- drawing -------------------------------------------------------------

function put(rgb, x, y, c, f) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = 3 * (y * W + x);
  rgb[o] = c[0] * f;
  rgb[o + 1] = c[1] * f;
  rgb[o + 2] = c[2] * f;
}
function glow(rgb, x, y, c, f) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = 3 * (y * W + x);
  rgb[o] = max(rgb[o], c[0] * f);
  rgb[o + 1] = max(rgb[o + 1], c[1] * f);
  rgb[o + 2] = max(rgb[o + 2], c[2] * f);
}
// A capsule of radius r round a-b with a hard edge. fn(x, y, u) paints a
// covered LED, u the share of the way from a to b.
function capsule(ax, ay, bx, by, r, fn) {
  const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey || 1;
  for (let y = max(0, floor(min(ay, by) - r)); y <= min(H - 1, ceil(max(ay, by) + r)); y++)
    for (let x = max(0, floor(min(ax, bx) - r)); x <= min(W - 1, ceil(max(ax, bx) + r)); x++) {
      const qx = x + 0.5 - ax, qy = y + 0.5 - ay, u = cl((qx * ex + qy * ey) / L2, 0, 1);
      if ((qx - u * ex) ** 2 + (qy - u * ey) ** 2 <= r * r) fn(x, y, u);
    }
}
const fill = (rgb, c, f) => (x, y) => put(rgb, x, y, c, f);

const PIPE = [0.17, 0.13, 0.27];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

// Where swing j's seat is at angle th, and the way along it.
function seatOf(j, th) {
  const s = scaleOf(j), [px, py] = pivot(j);
  return [px + sin(th) * LEN * s, py + cos(th) * LEN * s, cos(th), -sin(th)];
}

// One swing seen from the side: a chain from the bar, two hangers spread to
// the ends of the seat, and the seat, a plank seen edge on, top lit.
function drawSwing(rgb, C, j, th, f) {
  const s = scaleOf(j), [px, py] = pivot(j), [cx, cy, vx, vy] = seatOf(j, th);
  const ux = sin(th), uy = cos(th), half = 9 * s;
  const kx = px + ux * (LEN - 17) * s, ky = py + uy * (LEN - 17) * s;
  const len = (LEN - 17) * s, r = j ? 0.6 : 0.9;
  // Links: every other two LEDs of chain catch the moon, and one glint
  // runs up and down the chain as its angle to the moon changes.
  const g = (0.45 + 2.4 * th) * len;
  capsule(px, py, kx, ky, r, (x, y, u) => put(rgb, x, y, abs(u * len - g) < 2 ? C.glint : floor((u * len) / 2) % 2 ? C.linkDim : C.link, f));
  for (const e of [-1, 1]) capsule(kx, ky, cx + e * vx * half, cy + e * vy * half, 0.6, (x, y, u) => put(rgb, x, y, floor(u * 8) % 2 ? C.linkDim : C.link, f));
  const t = max(1, 2.1 * s);
  capsule(cx - vx * half, cy - vy * half, cx + vx * half, cy + vy * half, t, fill(rgb, C.seat, f));
  capsule(cx - vx * half - ux * t * 0.6, cy - vy * half - uy * t * 0.6, cx + vx * half - ux * t * 0.6, cy + vy * half - uy * t * 0.6, 0.6, fill(rgb, C.seatLit, f));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, T = S.tint, N = S.night, M = S.moon, hn = S.haunt;
  const hk = S.hue * (TINTS.length - 1), i0 = min(TINTS.length - 2, floor(hk)), ht = hk - i0;
  for (let c = 0; c < 3; c++) {
    T[c] = TINTS[i0][c] + (TINTS[i0 + 1][c] - TINTS[i0][c]) * ht;
    N[c] = NIGHTS[i0][c] + (NIGHTS[i0 + 1][c] - NIGHTS[i0][c]) * ht;
    M[c] = MOONS[i0][c] + (MOONS[i0 + 1][c] - MOONS[i0][c]) * ht;
  }
  const C = { pipe: PIPE, pipeLit: mul(M, 0.6), link: mul(M, 0.78), linkDim: mul(M, 0.4), seat: mul(M, 0.16), seatLit: mul(M, 1), glint: [1, 1, 1] };
  // Sky, moon and its rings.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = 3 * (y * W + x), d = sqrt((x + 0.5 - MX) ** 2 + (y + 0.5 - MY) ** 2);
      let R = 0.012 + N[0] * SKY[y], G = 0.004 + N[1] * SKY[y], B = 0.035 + N[2] * SKY[y];
      if (d < MR) {
        R = 0.95 * M[0];
        G = 0.95 * M[1];
        B = 0.95 * M[2];
      }
      else {
        const g = d < MR + 2 ? 0.16 : d < MR + 5 ? 0.08 : 0;
        R += g;
        G += g;
        B += g * 1.2;
      }
      rgb[o] = R;
      rgb[o + 1] = G;
      rgb[o + 2] = B;
    }
  for (const [x, y, ph] of STARS) glow(rgb, x, y, [0.8, 0.8, 1], 0.3 + 0.2 * sin(S.t * 2 + ph));
  // Fog over the ground: three layers of streaks drifting, the nearer ones
  // faster and lower, tinted by the ghost's light, with gaps where the
  // night shows through.
  const fc = [0.3 + 0.4 * T[0], 0.24 + 0.4 * T[1], 0.4 + 0.4 * T[2]];
  for (let l = 0; l < 3; l++) {
    const v = [-1.6, 2.4, -3.4][l], y0 = [104, 111, 117][l], thick = 3 + 2 * l, a = [0.3, 0.38, 0.46][l];
    for (let x = 0; x < W; x++) {
      const u = x + S.t * v;
      const d = sin(u * 0.08 + l * 1.7) + 0.7 * sin(u * 0.21 + l * 2.9);
      if (d < -0.3) continue;
      const top = y0 + round(1.5 * sin(u * 0.05 + l)), hgt = round(thick * min(1, (d + 0.3) * 1.5));
      for (let y = top; y < top + hgt && y < H; y++) {
        const o = 3 * (y * W + x);
        for (let q = 0; q < 3; q++) rgb[o + q] = rgb[o + q] * (1 - a) + fc[q] * a;
      }
    }
  }
  // The ground: black with a ragged edge of grass.
  for (let x = 0; x < W; x++) {
    const g = 124 - (hash(x + 99) < 0.3 ? 1 : 0) - (hash(x + 5) < 0.12 ? 2 : 0);
    for (let y = g; y < H; y++) put(rgb, x, y, [0.02, 0.01, 0.03], 1);
  }
  // The swings at the back, then the bar, the frame and the near swing.
  const afterimage = (j) => {
    const s = scaleOf(j), len = 0.8 + 1.2 * hn;
    let prev = null;
    for (const p of S.trail) {
      const a = 1 - (S.t - p[0]) / len;
      if (a <= 0) continue;
      const [cx, cy] = seatOf(j, p[1 + j]);
      const bx = cx - sin(p[1 + j]) * -2.5 * s, by = cy + cos(p[1 + j]) * 2.5 * s;
      if (prev) capsule(prev[0], prev[1], bx, by, 0.8 * s + 0.3, (x, y) => glow(rgb, x, y, T, (ceil(a * 3) / 3) * (0.4 + 0.3 * hn) * DEPTH ** j));
      prev = [bx, by];
    }
  };
  // With Haunt, a cold glow sits on each seat, as if something invisible
  // were riding it.
  const halo = (j) => {
    const s = scaleOf(j), [cx, cy] = seatOf(j, S.th[j]), R = 13 * s;
    for (let y = max(0, floor(cy - R)); y <= min(H - 1, ceil(cy + R)); y++)
      for (let x = max(0, floor(cx - R)); x <= min(W - 1, ceil(cx + R)); x++) {
        const d = sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy + 3 * s) ** 2) / s;
        const g = d < 7 ? 0.24 : d < 13 ? 0.12 : 0;
        if (g) glow(rgb, x, y, T, round(g * hn * 16) / 16);
      }
  };
  halo(1);
  afterimage(1);
  drawSwing(rgb, C, 1, S.th[1], 0.75 * DEPTH ** 2);
  const [bx0, by0] = pivot(0), [bx1, by1] = pivot(1.6);
  capsule(bx0, by0, bx1, by1, 1.7, fill(rgb, PIPE, 1));
  capsule(bx0, by0 - 1.2, bx1, by1 - 1.2, 0.55, fill(rgb, C.pipeLit, 1));
  for (const side of [-1, 1]) {
    const fx = PX + side * 38;
    capsule(PX, PY, fx, 132, 1.7, fill(rgb, PIPE, 1));
    capsule(PX - 1.1, PY, fx - 1.1, 132, 0.55, fill(rgb, C.pipeLit, 1));
  }
  capsule(PX, PY, PX, PY, 3, fill(rgb, PIPE, 1));
  capsule(PX - 1, PY - 1, PX - 1, PY - 1, 1.2, fill(rgb, C.pipeLit, 1));
  halo(0);
  afterimage(0);
  drawSwing(rgb, C, 0, S.th[0], 1);
  if (S.push && S.push.age >= 0) drawHand(S);
  // Out in steps of 4, which keeps the frame small for its colours.
  for (let p = 0, o = 0; p < W * H; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, 4 * round(63.75 * min(1, rgb[o])), 4 * round(63.75 * min(1, rgb[o + 1])), 4 * round(63.75 * min(1, rgb[o + 2])));
}

// A hand of mist behind the seat's back end, palm to it, fingers up and the
// thumb towards the seat, in the ghost's colour with a lit outline, and a
// cold glow round it. It rides with the seat while it pushes, then lets go
// and drifts back and up as it fades.
const HAND = [
  [0, -0.5, 0, 1.5, 4],
  [-3.6, -3, -5, -10, 1.05],
  [-1.3, -4, -1.8, -12, 1.05],
  [1.3, -4, 1.8, -11.5, 1.05],
  [3.5, -3, 4.8, -9, 1],
  [3.5, 1.5, 8, -2.5, 1],
];
function drawHand(S) {
  const P = S.push, j = P.j, rgb = S.rgb, T = S.tint, s = scaleOf(j), hn = S.haunt;
  const a = P.age < 0.12 ? P.age / 0.12 : P.age < PUSH ? 1 : 1 - (P.age - PUSH) / FADE;
  const f = round(a * 4) / 4, big = (1.4 + 0.3 * hn) * s, back = -P.dir;
  if (P.age < PUSH || !P.at) {
    const [cx, cy, vx, vy] = seatOf(j, S.th[j]);
    P.at = [cx - P.dir * vx * 9 * s + back * 5.5 * big, cy - P.dir * vy * 9 * s - 3 * big];
  }
  const drift = P.age > PUSH ? (P.age - PUSH) * 7 : 0;
  const hx = P.at[0] + back * drift * big, hy = P.at[1] - drift * 0.6 * big;
  for (let y = max(0, floor(hy - 30)); y <= min(H - 1, floor(hy + 30)); y++)
    for (let x = max(0, floor(hx - 30)); x <= min(W - 1, floor(hx + 30)); x++) {
      const d = sqrt((x + 0.5 - hx) ** 2 + (y + 0.5 - hy + 3 * big) ** 2) / big;
      const g = d < 10 ? 0.3 : d < 15 ? 0.18 : d < 20 ? 0.09 : 0;
      if (g) glow(rgb, x, y, T, g * f);
    }
  const mask = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1, r] of HAND)
    capsule(hx - x0 * big * back, hy + y0 * big, hx - x1 * big * back, hy + y1 * big, r * big, (x, y) => (mask[y * W + x] = 1));
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (!mask[p]) continue;
      const edge = !mask[p - 1] || !mask[p + 1] || !mask[p - W] || !mask[p + W];
      glow(rgb, x, y, T, (edge ? 1 : 0.5) * f);
    }
}
