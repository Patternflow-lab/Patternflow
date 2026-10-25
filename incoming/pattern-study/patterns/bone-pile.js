// ===== Patternflow pattern =====
// Title:   Bone Pile
// Family:  halloween
// Idea:    A skeleton dances in a violet spotlight in a stone crypt until, on a beat, every bone lets go and the whole frame crashes into a heap on the flagstones, lies still while the skull's eyes kindle, then the bones fly up one at a time on arcs from the feet upward and snap back into place, the skull last, landing with a nod before the dance goes on.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Dance=4..32, Fog=0..1
//
// Knob 1: Hue. The spotlight and all it tints: the wall in the beam, the pool on the flagstones, the dust, the bones' shadow side, the fog and the kindled eyes. Violet at 0, red at 0.24, lime at 0.5, cyan at 0.75; the bones stay ivory, the candles orange.
// Knob 2: Speed. The tempo, 50 beats a minute for each unit, and the rest keeps time with it. At the opening 2, 100: every bone is down 0.5 s after the beat that drops it, the eyes kindle at 1 s, the pieces fly back one every 0.18 s from 1.5 s and the skull lands at 4.7 s and nods. At 0.2 all ten times slower; 150 at 3.
// Knob 3: Dance. Beats danced between collapses: 4 at the start, so the first fall comes 2.4 s in and the next 2.8 s after the nod at 7.4 s; 11 at a quarter, 18 at half, 32 at the end, 19 s at 100 a minute. Each time it gets up it dances the next of three dances: a sway with both arms up, kicks to each side with hands on hips, a bounce with the arms pumping in turn.
// Knob 4: Fog. Ground fog drifting in two layers, thickening over its top 16 rows. None at 0; at the opening 0.06 a wisp from row 115; at 0.5 from row 93, burying half the heap; at 1 from row 68, up to the standing skeleton's hips.
// Buttons: K1 tap brings the skeleton down at once, mid-dance or half rebuilt.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// --- shapes, each in its own frame with y down, as a distance (negative
// inside). A hole function marks dark sockets and gaps inside a bone.
const seg = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = cl(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return sqrt((x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2);
};
const ell = (x, y, cx, cy, rx, ry) => (sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) - 1) * min(rx, ry);
const box = (x, y, cx, cy, hx, hy, r) => {
  const qx = abs(x - cx) - hx + r, qy = abs(y - cy) - hy + r;
  return sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2) + min(max(qx, qy), 0) - r;
};
// Kinds: 0 long bone, 1 paired long bones (forearm, shin), 2 rib cage with
// collarbones and neck, 3 lumbar spine, 4 pelvis, 5 skull, 6 jaw, 7 hand,
// 8 foot. A long bone is centred on its origin along y, L long.
function long(x, y, L, w, r) {
  const e = L / 2 - r, q = 0.6 * r, ry = r * 0.9;
  return min(seg(x, y, 0, -e, 0, e) - w, ell(x, y, -q, -e, r, ry), ell(x, y, q, -e, r, ry), ell(x, y, -q, e, r, ry), ell(x, y, q, e, r, ry));
}
const RIBS = [[7.6, 2.4], [9.4, 6.6], [10.4, 10.8], [10.4, 15], [9.2, 19]];
function shape(k, x, y, sg) {
  switch (k) {
    case 0:
      return long(x, y, sg, 0.85 + 0.015 * sg, 1.45);
    case 1: {
      const e = sg / 2 - 1.1;
      return min(seg(x, y, -1, -e, -1, e) - 0.75, seg(x, y, 1.1, -e, 1.1, e) - 0.55, box(x, y, 0, -e - 0.2, 2.3, 1.1, 1), box(x, y, 0, e + 0.2, 2.1, 1.1, 1));
    }
    case 2: {
      // Origin at the top of the breastbone; the neck rises above it.
      let d = min(box(x, y, 0, -3.4, 1.5, 0.75, 0.5), box(x, y, 0, -1.4, 1.6, 0.75, 0.5));
      d = min(d, seg(x, y, -1.4, 0.8, -11.4, -0.2) - 0.75, seg(x, y, 1.4, 0.8, 11.4, -0.2) - 0.75, seg(x, y, 0, 1, 0, 14) - 1.15);
      for (let v = 15.5; v < 24; v += 2.7) d = min(d, box(x, y, 0, v, 1.6, 0.9, 0.5));
      for (const [rx, ry] of RIBS) {
        const c = 3.6 / (rx * rx), ax = min(abs(x), rx), f = ry + c * ax * ax;
        d = min(d, abs(x) <= rx ? abs(y - f) / sqrt(1 + (2 * c * ax) ** 2) - 0.62 : sqrt((abs(x) - rx) ** 2 + (y - f) ** 2) - 0.62);
      }
      return d;
    }
    case 3: {
      let d = 9;
      for (let v = -4; v <= 4.1; v += 2.7) d = min(d, box(x, y, 0, v, 1.9, 0.95, 0.5), box(x, y, 0, v, 3.1, 0.35, 0.3));
      return d;
    }
    case 4: {
      // Origin between the hip sockets: two wings tipped outward, the sacrum
      // narrowing down between them, and two rings round the holes of the
      // lower pelvis.
      let d = max(abs(x) - (2.5 - 0.28 * (y + 5.5)), abs(y + 2.6) - 3);
      for (let s = -1; s <= 1; s += 2) {
        const dx = x - s * 5.3, dy = y + 3.6, c = 0.8, n = 0.6 * s;
        d = min(d, ell(dx * c + dy * n, -dx * n + dy * c, 0, 0, 4.1, 2.9), abs(ell(x, y, s * 3.4, 2.4, 2.4, 1.9)) - 0.75, ell(x, y, s * 6.5, 0, 1.5, 1.5));
      }
      return d;
    }
    case 5:
      // Origin at the top of the neck; the skull rises above it.
      return min(ell(x, y, 0, -10.6, 7, 7.3), ell(x, y, 0, -6.8, 6.4, 2.3), box(x, y, 0, -3.2, 4.4, 2.6, 1.4));
    case 6: {
      const hw = 4.3 - 0.4 * max(0, y);
      return min(box(x, y, 0, 1.5, 4.3, 1.6, 0.8), max(abs(x) - hw, abs(y - 1.6) - 1.8));
    }
    case 7: {
      let d = ell(x, y, 0, 1.4, 1.7, 1.3);
      for (let i = 0; i < 4; i++) d = min(d, seg(x, y, -1.2 + 0.8 * i, 2.2, -1.8 + 1.2 * i, 5.4) - 0.42);
      return d;
    }
    default:
      return min(ell(x, y, sg * 0.8, 1.6, 3.1, 1.4), ell(x, y, 0, 0.4, 1.4, 1));
  }
}
// 0 none, 1 dark, 2 an eye socket, 3 in shade.
function hole(k, x, y, P) {
  if (k === 5) {
    const p = P.pitch * 3;
    if (((abs(x) - 2.9) / 2.1) ** 2 + ((y + 7.9 - p) / 2.4) ** 2 < 1) return 2;
    const ny = y + 5.6 - p;
    if (ny >= 0 && ny < 1.7 && abs(x) < 0.3 + 0.5 * ny) return 1;
    if (y > -2 + p * 0.5 && y < -0.5 && abs(x) < 4) return (x + 4) / 1.45 - floor((x + 4) / 1.45) < 0.3 || y > -0.9 ? 1 : 0;
  } else if (k === 6 && y < 1.2 && y > -0.2 && abs(x) < 3.8) return (x + 4) / 1.45 - floor((x + 4) / 1.45) < 0.3 ? 1 : 0;
  // The hollow of each pelvic wing, in shade.
  else if (k === 4 && ((abs(x) - 4.6) / 2.3) ** 2 + ((y + 4.4 + 0.3 * abs(x)) / 1.3) ** 2 < 1) return 3;
  return 0;
}

// The pieces, back to front. [kind, length or side, the bounds of the shape
// in its own frame].
const PIECES = [
  [8, -1, -3.9, 3.9, -1, 3.2], [8, 1, -3.9, 3.9, -1, 3.2],
  [1, 24, -2.4, 2.4, -12.4, 12.4], [1, 24, -2.4, 2.4, -12.4, 12.4],
  [0, 26, -2.5, 2.5, -13.3, 13.3], [0, 26, -2.5, 2.5, -13.3, 13.3],
  [4, 0, -11, 11, -9, 5.2], [3, 0, -3.5, 3.5, -5.3, 5.3], [2, 0, -12.2, 12.2, -4.5, 22.6],
  [0, 19, -2.2, 2.2, -9.8, 9.8], [0, 19, -2.2, 2.2, -9.8, 9.8],
  [1, 17, -2.4, 2.4, -8.9, 8.9], [1, 17, -2.4, 2.4, -8.9, 8.9],
  [7, 0, -2.6, 2.6, -0.2, 6], [7, 0, -2.6, 2.6, -0.2, 6],
  [6, 0, -4.4, 4.4, -0.3, 3.5], [5, 0, -7.2, 7.2, -18.1, 0.6],
];
const NB = PIECES.length, SKULL = 16, JAW = 15;
const FLOOR = 120, CX = 32, HIPY = 67, HIP = 7, FEMUR = 26, TIBIA = 24, ARM = 19, FORE = 17;

// --- the body: a pose to where each piece sits, [x, y, angle] with the
// angle turning the piece's own y onto the bone.
const at = (P, i, x, y, a) => {
  P.x[i] = x;
  P.y[i] = y;
  P.a[i] = a;
};
const ang = (dx, dy) => atan2(-dx, dy);
function bone(P, i, ax, ay, bx, by) {
  at(P, i, (ax + bx) / 2, (ay + by) / 2, ang(bx - ax, by - ay));
}
// Two-bone reach with the knee bent outward.
function leg(P, s, hx, hy, fx, fy) {
  const dx = fx - hx, dy = fy - hy, d = cl(sqrt(dx * dx + dy * dy), 3, FEMUR + TIBIA - 0.01);
  const al = Math.acos(cl((FEMUR * FEMUR + d * d - TIBIA * TIBIA) / (2 * FEMUR * d), -1, 1)), b = atan2(dy, dx) - s * al;
  const kx = hx + FEMUR * cos(b), ky = hy + FEMUR * sin(b), u = (fx - kx) / sqrt((fx - kx) ** 2 + (fy - ky) ** 2), v = (fy - ky) / sqrt((fx - kx) ** 2 + (fy - ky) ** 2);
  bone(P, 4 + (s > 0), hx, hy, kx, ky);
  const ex = kx + TIBIA * u, ey = ky + TIBIA * v;
  bone(P, 2 + (s > 0), kx, ky, ex, ey);
  at(P, s > 0 ? 1 : 0, ex, ey, 0);
}
const rot = (a, x, y) => [x * cos(a) - y * sin(a), x * sin(a) + y * cos(a)];
// Pose numbers: sway, bob, pelvis tilt, torso lean, head roll, nod, jaw,
// each arm's lift from hanging and elbow bend, each foot's lift and step.
function rig(D, P) {
  const rx = CX + D.sway, ry = HIPY + D.bob, t = D.tilt, l = D.lean;
  at(P, 6, rx, ry, t);
  for (const s of [-1, 1]) {
    const [hx, hy] = rot(t, s * HIP, 0), f = s < 0 ? D.fl : D.fr;
    leg(P, s, rx + hx, ry + hy, CX + s * (HIP + f[1]), FLOOR - 3 - f[0]);
  }
  const [b0, b1] = rot(t, 0, -5), sx = rx + b0, sy = ry + b1, [c0, c1] = rot(l, 0, -10);
  bone(P, 7, sx + c0, sy + c1, sx, sy);
  const [d0, d1] = rot(l, 0, -24), tx = sx + c0 + d0, ty = sy + c1 + d1;
  at(P, 8, tx, ty, l);
  for (const s of [-1, 1]) {
    const [o0, o1] = rot(l, s * 12, 0.4), ax = tx + o0, ay = ty + o1, a1 = s < 0 ? D.al : D.ar, a2 = s < 0 ? D.bl : D.br;
    const [u0, u1] = rot(l, s * sin(a1), cos(a1)), ex = ax + ARM * u0, ey = ay + ARM * u1;
    const [v0, v1] = rot(l, s * sin(a1 + a2), cos(a1 + a2)), wx = ex + FORE * v0, wy = ey + FORE * v1;
    bone(P, 9 + (s > 0), ax, ay, ex, ey);
    bone(P, 11 + (s > 0), ex, ey, wx, wy);
    at(P, 13 + (s > 0), wx, wy, ang(v0, v1));
  }
  const [n0, n1] = rot(l, 0, -4.4), hd = l + D.head, nx = tx + n0, ny = ty + n1;
  at(P, SKULL, nx, ny, hd);
  const [j0, j1] = rot(hd, 0, -0.7 + 2.2 * D.jaw + D.pitch * 0.6);
  at(P, JAW, nx + j0, ny + j1, hd);
  P.pitch = D.pitch;
}

const REST = { sway: 0, bob: 0, tilt: 0, lean: 0, head: 0, pitch: 0, jaw: 0, al: 0.12, bl: 0.08, ar: 0.12, br: 0.08, fl: [0, 0], fr: [0, 0] };
const clack = (b) => max(0, sin(TAU * b)) ** 2;
// Three dances, each a function of the beat.
function dance(m, b, D) {
  Object.assign(D, REST, { fl: [0, 0], fr: [0, 0], jaw: clack(b) });
  if (m === 0) {
    // Sway: hips side to side over four beats, both arms up waving.
    const s = sin((PI * b) / 2), w = sin(PI * b);
    Object.assign(D, { sway: 3 * s, tilt: 0.1 * s, lean: -0.08 * s, head: -0.16 * s, al: 2.5 + 0.18 * w, ar: 2.5 - 0.18 * w, bl: 0.3 + 0.25 * w, br: 0.3 + 0.25 * w });
  } else if (m === 1) {
    // Kicks: a foot out to the side each beat, hands on the hips.
    const k = sin(PI * (b - floor(b))) ** 2, s = floor(b) & 1 ? 1 : -1;
    D[s < 0 ? "fl" : "fr"] = [7 * k, 5 * k];
    Object.assign(D, { sway: -s * 1.2 * k, head: s * 0.12 * k, al: 0.75, ar: 0.75, bl: -1.45, br: -1.45 });
  } else {
    // Bounce: a dip at the knees on every beat, the arms pumping up in turn
    // over two beats.
    const e = 0.5 - 0.5 * cos(PI * b), w = sin(PI * b);
    Object.assign(D, { bob: 0.6 - 0.6 * cos(TAU * b), sway: 1.5 * w, head: 0.14 * w, al: 0.5 + 1.2 * e, bl: 0.3 + 0.6 * e, ar: 1.7 - 1.2 * e, br: 0.9 - 0.6 * e });
  }
}

// The heap, as [x, y, angle] for each piece with the floor at 120: shins
// and feet flat, thighs crossed, arms on top, the cage on its side, the
// pelvis tipped up against it and the skull on the crown, jaw beside it.
const HEAP = [
  [-25, 117.5, 0.2], [24, 117.5, -0.3], [-14, 116.4, 1.62], [13, 116.4, 1.5], [-4, 115.6, 1.32], [6, 115.6, 1.86],
  [-9, 108.5, 0.55], [12, 111.5, 1.9], [4, 104.5, -1.32], [-15, 112, 1.1], [17, 112.8, 2.1], [-20, 113.5, 1.9], [21, 114.8, 1.3],
  [-27, 116.2, 2.4], [28, 116.4, -2.2], [15, 106.5, 0.45], [-2, 99.5, 0.3],
];
const BEAM = (x, y) => {
  // The spotlight's cone from above the panel, 18 LEDs across at the top
  // and 56 at the floor.
  const hw = 9 + y * 0.16, d = abs(x + 0.5 - CX) / hw;
  return d < 0.8 ? 1 : d < 1 ? 0.78 : d < 1.12 ? 0.4 : 0;
};

const pose = () => ({ x: new Float64Array(NB), y: new Float64Array(NB), a: new Float64Array(NB), pitch: 0 });

export function setup(params) {
  params.s = {
    hue: -1, bpm: 100, every: 4, fog: 0.06, beat: 0, t: 0,
    phase: 0, start: 0, base: 0, moves: 0,
    D: Object.assign({}, REST), Q: pose(), R: pose(),
    fall: [], heap: [], eye: 0, snap: [], light: [0, 0, 0],
    bg: new Float32Array(N * 3), buf: new Float32Array(N * 3), low: new Int16Array(W),
    dust: Array.from({ length: 30 }, () => [CX + (Math.random() - 0.5) * 36, Math.random() * 120, Math.random() * TAU, 2 + Math.random() * 3]),
  };
  rig(REST, params.s.R);
}

// Everything comes down: each piece from where it is now, flung up a little,
// falls onto its place in the heap and bounces once.
function collapse(S) {
  if (S.phase === 0 || !S.heap.length) {
    const m = Math.random() < 0.5 ? -1 : 1;
    S.heap = HEAP.map(([x, y, a]) => [CX + m * x + (Math.random() - 0.5) * 2, y, m * a + (Math.random() - 0.5) * 0.3]);
  }
  S.fall = S.heap.map(([hx, hy, ha], i) => {
    const x0 = S.Q.x[i], y0 = S.Q.y[i], a0 = S.Q.a[i], v = 4 + Math.random() * 10, g = 520;
    const T = (v + sqrt(v * v + 2 * g * max(0, hy - y0))) / g;
    let da = ha - a0;
    da -= TAU * round(da / TAU);
    return { x0, y0, a0, hx, hy, da, v, g, T };
  });
  S.Q.pitch = 0;
  S.phase = 1;
  S.start = S.beat;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.bpm = 50 * cl(k[1], 0.2, 3);
  S.every = round(cl(k[2], 4, 32));
  S.fog = cl(k[3], 0, 1);
  const hue = cl(k[0], 0, 1);
  if (hue !== S.hue) {
    S.hue = hue;
    hsv(0.76 + hue, 0.62, 1, S.light);
    background(S);
  }
  const db = (d * S.bpm) / 60;
  S.beat += db;
  S.t += d;
  const B = S.beat, Q = S.Q, D = S.D;
  if (input.btnPressed && input.btnPressed[0] && S.phase !== 1) collapse(S);
  S.snap = S.snap.filter((s) => (s[2] -= d) > 0);
  if (S.phase === 0) {
    // Dancing, eased in from standing after the skeleton gets up.
    if (B >= S.base + S.every) {
      collapse(S);
    } else {
      dance(S.moves % 3, B, D);
      const w = cl((B - S.start) / 0.6, 0, 1), s = w * w * (3 - 2 * w);
      for (const key in REST) if (typeof REST[key] === "number") D[key] = mix(REST[key], D[key], s);
      for (const f of ["fl", "fr"]) D[f] = [D[f][0] * s, D[f][1] * s];
      rig(D, Q);
      S.eye = max(0, S.eye - db * 0.8);
    }
  }
  if (S.phase === 1) {
    const u = B - S.start;
    S.fall.forEach((f, i) => {
      const t = min(u, f.T), r = t / f.T, b = u - f.T;
      Q.x[i] = mix(f.x0, f.hx, r);
      Q.y[i] = min(f.hy, f.y0 - f.v * t + 0.5 * f.g * t * t);
      Q.a[i] = f.a0 + f.da * r;
      if (b > 0 && b < 0.3) Q.y[i] -= 2 * sin((PI * b) / 0.3) * (1 - b / 0.3);
    });
    // The heap lies still, then the skull's eyes kindle.
    S.eye = cl((u - 1.6) / 0.8, 0, 1);
    if (u > 2.5) {
      S.phase = 2;
      S.start = B;
    }
  }
  if (S.phase === 2) {
    // One piece every 0.3 beats from the feet up, each on an arc 0.45 beats
    // long; the jaw and the skull go together, last, in 0.8 beats.
    const u = B - S.start, R = S.R;
    for (let i = 0; i < NB; i++) {
      const slot = min(i, JAW), t0 = slot * 0.3, len = slot === JAW ? 0.8 : 0.45, r = (u - t0) / len, [hx, hy, ha] = S.heap[i];
      if (r <= 0) at(Q, i, hx, hy, ha);
      else if (r >= 1) {
        at(Q, i, R.x[i], R.y[i], R.a[i]);
        if (r - db / len < 1) S.snap.push([R.x[i], R.y[i] - (i === SKULL ? 2 : 0), 0.12]);
      } else {
        let da = R.a[i] - ha;
        da -= TAU * round(da / TAU);
        const lift = 10 + 0.15 * (hy - R.y[i]), e = 1 - (1 - r) * (1 - r);
        at(Q, i, mix(hx, R.x[i], r), mix(hy, R.y[i], e) - lift * sin(PI * r) * (1 - r * 0.3), ha + da * e);
      }
    }
    // The nod: the skull dips its face and the jaw shuts, 0.6 beats.
    const n = (u - JAW * 0.3 - 0.8) / 0.6;
    Q.pitch = n > 0 && n < 1 ? sin(PI * n) : 0;
    if (n > 0) {
      Q.y[SKULL] += 2.5 * Q.pitch;
      Q.y[JAW] += 3.2 * Q.pitch;
    }
    if (n >= 1) {
      S.phase = 0;
      S.start = B;
      S.base = ceil(B);
      S.moves++;
    }
  }
  for (const m of S.dust) {
    m[1] += d * m[3];
    m[0] += d * 1.5 * sin(S.t * 0.7 + m[2]);
    if (m[1] > FLOOR) (m[1] = 0), (m[0] = CX + (Math.random() - 0.5) * 34);
  }
}

// The crypt, laid out once for each light colour: stone blocks with dark
// mortar, the beam on the wall, a pool on the flagstones, two candle niches.
const NICHES = [8, 56], NY = 78;
function background(S) {
  const bg = S.bg, L = S.light;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r, g, b, lit;
      if (y < FLOOR) {
        const row = floor(y / 7), off = row & 1 ? 6 : 0, col = floor((x + off) / 12);
        const mortar = y % 7 === 6 || (x + off) % 12 === 11, v = hash(row * 31 + col * 7) * 10;
        (r = mortar ? 10 : 26 + v), (g = mortar ? 6 : 19 + v * 0.7), (b = mortar ? 16 : 36 + v);
        lit = BEAM(x, y) * (mortar ? 0.12 : 0.24);
        for (const nx of NICHES)
          if (abs(x + 0.5 - nx) < 3.5 && y > NY - 8 && y < NY + 4 && (y > NY - 5 || (x + 0.5 - nx) ** 2 + (y - NY + 5) ** 2 < 12)) (r = 8), (g = 4), (b = 12), (lit = 0);
      } else {
        // Flagstones, and the pool where the beam lands.
        const seam = y === FLOOR + 3 || (x + (y > FLOOR + 3 ? 5 : 0)) % 14 === 0;
        (r = seam ? 12 : 30), (g = seam ? 8 : 22), (b = seam ? 18 : 36);
        if (y === FLOOR) (r = 60), (g = 48), (b = 70);
        const q = ((x + 0.5 - CX) / 30) ** 2 + ((y - FLOOR - 3) / 6) ** 2;
        lit = (q < 0.45 ? 0.62 : q < 1 ? 0.42 : q < 1.5 ? 0.18 : 0) * (seam ? 0.5 : 1);
      }
      bg[o] = r + L[0] * lit;
      bg[o + 1] = g + L[1] * lit;
      bg[o + 2] = b + L[2] * lit;
    }
}

// Ivory in the light, a warmer grey across, the shade tinted by the beam.
const BONE = [[255, 244, 220], [212, 202, 180], [96, 88, 80]];
const put = (buf, o, r, g, b) => {
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
};
// One piece onto the buffer: its distance field over its bounds, lit from
// above by the field's slope, outlined dark where it passes over anything.
const FIELD = new Float32Array(48 * 48);
function piece(S, i, P) {
  const [k, sg, x0, x1, y0, y1] = PIECES[i], cx = P.x[i], cy = P.y[i], a = P.a[i], c = cos(a), s = sin(a);
  let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9;
  for (const [u, v] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    const wx = cx + u * c - v * s, wy = cy + u * s + v * c;
    (xa = min(xa, wx)), (xb = max(xb, wx)), (ya = min(ya, wy)), (yb = max(yb, wy));
  }
  xa = max(0, floor(xa) - 1);
  xb = min(W - 1, ceil(xb) + 1);
  ya = max(0, floor(ya) - 1);
  yb = min(H - 1, ceil(yb) + 1);
  const buf = S.buf, L = S.light;
  if (xb < xa || yb < ya || xb - xa >= 48 || yb - ya >= 48) return;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      FIELD[(y - ya) * 48 + x - xa] = shape(k, dx * c + dy * s, -dx * s + dy * c, sg);
    }
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const f = (y - ya) * 48 + x - xa, d = FIELD[f], o = (y * W + x) * 3;
      if (d > 0.1) {
        if (d < 1.1) for (let ch = 0; ch < 3; ch++) buf[o + ch] *= 0.3;
        continue;
      }
      if (y > 60 && y > S.low[x]) S.low[x] = y;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, hl = hole(k, dx * c + dy * s, -dx * s + dy * c, P);
      if (hl === 1 || hl === 2) {
        const e = hl === 2 ? S.eye * (0.75 + 0.25 * sin(S.t * 9 + i)) : 0;
        put(buf, o, 12 + L[0] * e, 6 + L[1] * e, 18 + L[2] * e);
        continue;
      }
      // The slope of the field: where it climbs upward the bone faces the light.
      const up = y > ya ? FIELD[f - 48] : d + 1, dn = y < yb ? FIELD[f + 48] : d + 1, n = (up - dn) / (abs(up - dn) + abs((x > xa ? FIELD[f - 1] : d) - (x < xb ? FIELD[f + 1] : d)) + 0.01);
      const t = hl === 3 || n <= -0.3 ? 2 : n > 0.4 || (d > -0.6 && up > 0.1) ? 0 : 1, beam = 0.72 + 0.28 * BEAM(x, y), w = t === 2 ? 0.36 : 0;
      for (let ch = 0; ch < 3; ch++) buf[o + ch] = (BONE[t][ch] + L[ch] * w) * beam;
    }
}

function add(buf, x, y, r, g, b) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += r;
  buf[o + 1] += g;
  buf[o + 2] += b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.hue < 0) return;
  const buf = S.buf, L = S.light, low = S.low;
  buf.set(S.bg);
  // Candles in the niches: a flame that flickers in three steps and a glow.
  NICHES.forEach((nx, j) => {
    const v = 0.55 + 0.3 * vn(S.t * 3, j * 9) + 0.15 * vn(S.t * 11, j * 9 + 4), f = v > 0.72 ? 1 : v > 0.55 ? 0.82 : 0.66;
    for (let y = NY - 12; y < NY + 8; y++)
      for (let x = nx - 8; x < nx + 8; x++) {
        const q = sqrt((x + 0.5 - nx) ** 2 + (y + 0.5 - NY + 2) ** 2), gl = (q < 3.5 ? 0.24 : q < 5.5 ? 0.14 : q < 8 ? 0.06 : 0) * f;
        if (gl) add(buf, x, y, 255 * gl, 140 * gl, 40 * gl);
      }
    for (let y = NY; y < NY + 4; y++) put(buf, (y * W + nx - 1) * 3, 196, 184, 160), put(buf, (y * W + nx) * 3, 196, 184, 160);
    const sw = round(vn(S.t * 5, j) * 2 - 1);
    for (let i = 0; i < (f > 0.9 ? 4 : 3); i++) {
      const o = ((NY - 1 - i) * W + nx - 1 + (i > 1 ? sw : 0)) * 3, g = i ? 150 + 30 * f : 236, b = i ? 30 : 140;
      put(buf, o, 255, g, b);
      if (i < 2) put(buf, o + 3, 255, g * 0.92, b);
    }
  });
  // Dust drifting down the beam.
  for (const [x, y, p] of S.dust) {
    const tw = 0.45 + 0.35 * sin(S.t * 2.3 + p * 5);
    if (BEAM(x, y) > 0.5) add(buf, x, y, (L[0] * 0.5 + 60) * tw, (L[1] * 0.5 + 60) * tw, (L[2] * 0.5 + 60) * tw);
  }
  // Bones; a shadow on the floor under whatever stands or lies over it.
  low.fill(0);
  // Pieces in the air go in front of the rest.
  const u = S.beat - S.start, air = (i) => S.phase === 2 && u > min(i, JAW) * 0.3 && u < min(i, JAW) * 0.3 + 0.9;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < NB; i++) if (air(i) === !!pass) piece(S, i, S.Q);
  for (let x = 0; x < W; x++)
    if (low[x] > 0) {
      const sh = low[x] > FLOOR - 8 ? 0.45 : 0.65;
      for (let y = low[x] + 1; y < min(H, FLOOR + 5); y++) if (y >= FLOOR) for (let ch = 0; ch < 3; ch++) buf[(y * W + x) * 3 + ch] *= sh;
    }
  for (const [x, y, t] of S.snap) for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) add(buf, x + i, y + j, 200 * t * 8, 190 * t * 8, 170 * t * 8);
  // Ground fog: two drifting noises, deeper toward the floor, in steps of an eighth.
  const fog = S.fog, top = 118 - 50 * fog;
  for (let y = max(0, floor(top)); y < H && fog > 0; y++) {
    const depth = cl((y - top) / 16, 0, 1) * (0.25 + 0.5 * fog);
    for (let x = 0; x < W; x++) {
      const n = 0.6 * vn(x * 0.09 + S.t * 0.35 + y * 0.03, 3 + (y >> 3)) + 0.4 * vn(x * 0.21 - S.t * 0.5, 17 + (y >> 2));
      const al = floor(depth * (0.35 + 0.9 * n) * 8) / 8;
      if (al <= 0) continue;
      const o = (y * W + x) * 3, a = min(0.85, al);
      for (let ch = 0; ch < 3; ch++) buf[o + ch] = mix(buf[o + ch], 70 + L[ch] * 0.32, a);
    }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) & 252, min(255, buf[o + 1]) & 252, min(255, buf[o + 2]) & 252);
}
