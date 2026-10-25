// ===== Patternflow pattern =====
// Title:   Headless Rider
// Family:  halloween
// Idea:    A headless horseman gallops across a huge low moon in black silhouette, the horse gathering and reaching through a four-beat gallop that kicks dust and sparks off the road, cape streaming and a burning jack-o'-lantern held high, while trees, gravestones and a fence slide past, and now and then he hurls the pumpkin in a flaming arc that bursts on the road ahead.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Woods=0..1, Mist=0..1
//
// Knob 1: Hue. Tints the sky, the far hills and the mist; moon, pumpkin and fire keep their colours. At 0 a violet night, mauve at the horizon; at 0.25 blood red, at 0.5 a sickly olive, at 0.75 teal, at 0.9 deep blue.
// Knob 2: Speed. At 2 the horse takes 1.3 strides a second, the road runs past at 44 LEDs a second, the trees at 13 and the hills at 4, and he throws every 9 s, the first at 3.2 s, the pumpkin 3 s in the air; at 0.2 all ten times slower, at 3 half as fast again.
// Knob 3: Woods. How many of the 14-LED slots along the horizon hold a tree: one in five at 0, a tree about every 5 s at Speed 2 with gravestones between; more than half at 0.5; nearly all at 1, a wood the moon shows through in pieces.
// Knob 4: Mist. At 0 none, at 0.06 thin wisps on the horizon, at 0.5 a moonlit bank on the road round the hooves drifting back faster than the road, at 1 up to the horse's belly so the legs gallop half seen.
// Buttons: K1 tap throws the pumpkin at once, or lights a new one if his hand is empty.

const W = 64, H = 128, N = W * H;
const { floor, round, ceil, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + (b - a) * Math.random();
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// The stage, top to bottom: sky and moon, the horizon the trees stand on,
// the road the hooves strike at GY, the verge with the near fence.
const HZ = 99, RD0 = 100, RD1 = 108, GY = 104;
const MX = 26, MY = 70, MR = 24;
// The moon's tone (1 limb, 2 sea, 3 bright) and its glow in stepped rings.
const MOONT = new Uint8Array(N), GLOW = new Float32Array(N);
const SEAS = [[-7, -6, 6, 5], [5, -9, 5, 4], [-3, 6, 8, 4], [9, 5, 4, 5]];
for (let p = 0; p < N; p++) {
  const dx = (p % W) + 0.5 - MX, dy = floor(p / W) + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
  if (r < MR) MOONT[p] = r > MR - 1.2 ? 1 : SEAS.some(([cx, cy, rx, ry]) => ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2 < 1) ? 2 : 3;
  else GLOW[p] = r < MR + 3 ? 0.3 : r < MR + 8 ? 0.17 : r < MR + 15 ? 0.08 : r < MR + 26 ? 0.035 : 0;
}
const MOONC = [0, [232, 216, 180], [228, 216, 188], [252, 240, 204]];
const STARS = [];
for (let i = 0; i < 400 && STARS.length < 26; i++) {
  const x = floor(hash(i * 3 + 1) * W), y = floor(hash(i * 3 + 2) * 62);
  if (GLOW[y * W + x] === 0 && !MOONT[y * W + x]) STARS.push([x, y, hash(i * 3 + 3) * TAU]);
}

// A seeded sequence for the scenery, so it is the same every time.
let sd = 48;
const rng = () => hash(sd++ * 31);
// Fills a capsule, radius r0 at one end and r1 at the other, into a mask.
function stamp(m, mw, mh, x0, y0, r0, x1, y1, r1, code) {
  const xa = max(0, floor(min(x0 - r0, x1 - r1))), xb = min(mw - 1, ceil(max(x0 + r0, x1 + r1)));
  const ya = max(0, floor(min(y0 - r0, y1 - r1))), yb = min(mh - 1, ceil(max(y0 + r0, y1 + r1)));
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = cl((px * dx + py * dy) / l2, 0, 1);
      const ex = px - dx * t, ey = py - dy * t, r = r0 + (r1 - r0) * t;
      if (ex * ex + ey * ey <= r * r && m[y * mw + x] < code) m[y * mw + x] = code;
    }
}
// Bare trees: a crooked trunk forking four times into twigs.
const TW = 44, TH = 96, NT = 6, TREES = [];
function limb(m, x, y, a, len, w, depth) {
  for (let i = 0, n = max(2, ceil(len / 2)); i < n; i++) {
    a += (rng() - 0.5) * 0.4;
    const nx = x + 2 * sin(a), ny = y - 2 * cos(a), r = max(0.45, w * (1 - (0.35 * i) / n));
    stamp(m, TW, TH, x, y, r, nx, ny, r, 1);
    (x = nx), (y = ny);
  }
  if (depth <= 0) return;
  const k = depth > 2 ? 2 : 2 + (rng() < 0.5 ? 1 : 0);
  for (let j = 0; j < k; j++) limb(m, x, y, a + (j - (k - 1) / 2) * (0.55 + rng() * 0.5) + (rng() - 0.5) * 0.3, len * (0.55 + rng() * 0.25), w * 0.62, depth - 1);
}
// Each kept as the list of its lit LEDs, column then row.
for (let i = 0; i < NT; i++) {
  const m = new Uint8Array(TW * TH), l = [];
  limb(m, TW / 2, TH - 1, (rng() - 0.5) * 0.25, (54 + rng() * 34) * 0.36, 2.2 + rng() * 0.6, 4);
  m.forEach((v, p) => v && l.push(p % TW, floor(p / TW)));
  TREES.push(Int16Array.from(l));
}
const TREEC = [26, 10, 36], FARLEG = [30, 12, 40];
// The road's crown, ruts and dust; the verge's tufts and soil.
const GROUND = [92, 78, 108, 44, 34, 58, 66, 54, 82, 46, 30, 60, 24, 12, 34, 16, 8, 24];
const STONES = [[".xxx.", "xxxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxx"], ["..x..", "xxxxx", "..x..", "..x..", "..x..", "..x.."], [".xx.", "xxxx", "xxxx", "xxxx", "xxxx"]];
// Mist: a sheet of value noise, long bands across short ones.
const FW = 256, FH = 32, FN = new Float32Array(FW * FH);
for (let p = 0; p < FW * FH; p++) FN[p] = 0.5 + 0.32 * vn((p % FW) / 14 + (p >> 10) * 0.3, p >> 10) + 0.18 * vn((p % FW) / 5, (p >> 8) + 99);

// The gallop. A hoof is down for DUTY of a stride, landing REACH LEDs ahead
// of its leg's top joint and leaving BACK behind, so the road runs back
// (REACH + BACK) / DUTY = 34 LEDs a stride and a planted hoof never slides.
// A transverse gallop's four beats: near hind, far hind, near fore, far
// fore, then all four off the ground, gathered under the belly.
// [joint x, joint y in the body, landing phase, far, fore]
const DUTY = 0.38, REACH = 7, BACK = 6, STRIDE = (REACH + BACK) / DUTY, L1 = 11, L2 = 14, RATE = 1.3;
const LEGS = [[-10, 2.5, 0, 0, 0], [-10, 2.5, 0.11, 1, 0], [10, 3, 0.38, 0, 1], [10, 3, 0.49, 1, 1]];
const BX = 29, BY = 76, PK = 4.6;
// The throwing arm [shoulder, elbow], radians from straight up, forward
// positive: held high, cocked back, the release, hanging empty.
const HOLD = [0.35, 0.1], COCK = [-0.85, -0.5], LET = [1.05, 0.15], REST = [2.3, -0.5];
// Times in seconds at Speed 2.
const THROW_EVERY = 9, FIRST = 3.2, T_COCK = 0.35, T_SWING = 0.15, T_RELIGHT = 1.5, T_GROW = 0.55;
// Particles, six numbers each (x, y, vx, vy, life left, life) and a kind:
// 0 flame, 1 spark, 2 dust.
const MAXP = 600;

export function setup(params) {
  params.s = {
    hue: -1, hue0: -2, speed: 2, woods: 0, mist: 0.06, t: 0, ph: 0, g: 0, bob: 0, pitch: 0, neck: 0, eye: [0, 0],
    state: 0, st: 0, next: FIRST, pk: 1, arm: HOLD.slice(), arm0: HOLD.slice(), fly: null, fires: [],
    A: new Float32Array(MAXP * 6), K: new Uint8Array(MAXP), np: 0,
    buf: new Float32Array(N * 3), mask: new Uint8Array(N), bg: new Float32Array(N * 3), far: [0, 0, 0], fog: [0, 0, 0], c: [0, 0, 0],
  };
}

function spawn(S, x, y, vx, vy, life, kind) {
  if (S.np >= MAXP) return;
  S.A.set([x, y, vx, vy, life, life], S.np * 6);
  S.K[S.np++] = kind;
}

// A point of the horse's body on the panel, bobbing and pitching about
// the middle of the barrel.
function bodyPt(S, x, y, out, o) {
  const c = cos(S.pitch), s = sin(S.pitch);
  out[o] = BX + x * c - y * s;
  out[o + 1] = BY + S.bob + x * s + y * c;
}
const P = new Float32Array(4), HAND = new Float32Array(6), F = new Float32Array(2);

// Shoulder, elbow and hand of the throwing arm.
function hand(S) {
  bodyPt(S, 4, -20, HAND, 0);
  const a = S.arm[0] + S.pitch * 0.5, b = a + S.arm[1];
  HAND[2] = HAND[0] + 7.5 * sin(a);
  HAND[3] = HAND[1] - 7.5 * cos(a);
  HAND[4] = HAND[2] + 7.5 * sin(b);
  HAND[5] = HAND[3] - 7.5 * cos(b);
}

// A hoof at phase u after it landed, from its leg's top joint (jx, jy).
function foot(u, fore, jx) {
  if (u < DUTY) (F[0] = jx + REACH - (REACH + BACK) * (u / DUTY)), (F[1] = GY);
  else {
    const s = (u - DUTY) / (1 - DUTY);
    F[0] = jx - BACK + (REACH + BACK) * (0.5 - 0.5 * cos(PI * s));
    // A foreleg folds its hoof up towards the elbow, a hind leg less.
    F[1] = GY - (fore ? 13 : 9) * sin(PI * s) ** 0.8;
  }
}

const ease = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
const toward = (S, to, t) => (S.arm = [ease(S.arm0[0], to[0], t), ease(S.arm0[1], to[1], t)]);
const go = (S, st) => ((S.state = st), (S.st = 0), (S.arm0 = S.arm.slice()));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  [S.hue, S.speed, S.woods, S.mist] = [cl(k[0], 0, 1), cl(k[1], 0.2, 3), cl(k[2], 0, 1), cl(k[3], 0, 1)];
  const ds = (d * S.speed) / 2, V = STRIDE * RATE, ph0 = S.ph;
  S.t += ds;
  S.ph += ds * RATE;
  S.g = S.ph * STRIDE;
  // The body: lowest mid-stance, highest in the gathered moment, nose up as
  // the hind legs land and down as the fore legs take the weight.
  const a = TAU * S.ph;
  S.bob = 1.2 * cos(a - TAU * 0.45);
  S.pitch = -0.055 * cos(a - TAU * 0.1);
  S.neck = 0.13 * cos(a - TAU * 0.62);
  // A hoof landing kicks up dust, and now and then sparks off a stone.
  for (const [jx, jy, off] of LEGS) {
    if (floor(ph0 - off) === floor(S.ph - off)) continue;
    bodyPt(S, jx, jy, P, 0);
    foot(0, 0, P[0]);
    for (let i = 0; i < 3; i++) spawn(S, F[0] + rnd(-1, 1), GY + rnd(-1, 1), -V * rnd(0.8, 1), -rnd(4, 14), rnd(0.5, 0.9), 2);
    if (Math.random() < 0.4) for (let i = 0; i < 3; i++) spawn(S, F[0], GY - 1, -V + rnd(-20, 25), -rnd(20, 48), rnd(0.25, 0.5), 1);
  }
  // The pumpkin: held, cocked back, swung, let go; the hand hangs empty,
  // rises, and a new one catches light in it.
  const tap = input.btnPressed && input.btnPressed[0];
  S.st += ds;
  if (S.state === 0) {
    if ((S.next -= ds) <= 0 || tap) go(S, 1);
  } else if (S.state === 1) {
    toward(S, COCK, min(1, S.st / T_COCK));
    if (S.st >= T_COCK) go(S, 2);
  } else if (S.state === 2) {
    toward(S, LET, min(1, S.st / T_SWING));
    if (S.st >= T_SWING) {
      hand(S);
      // Up and a little ahead: the top of the arc near the top of the panel,
      // down on the road just ahead of the horse 3 s later.
      S.fly = { x: HAND[4] + 0.5, y: HAND[5] - PK, vx: 6.5, vy: -58, spin: 0 };
      S.pk = 0;
      go(S, 3);
    }
  } else if (S.state === 3) {
    toward(S, REST, min(1, S.st / 0.45));
    if (S.st > T_RELIGHT || tap) go(S, 4);
  } else {
    toward(S, HOLD, min(1, S.st / 0.4));
    S.pk = cl((S.st - 0.3) / T_GROW, 0, 1);
    if (S.st > 0.3 + T_GROW) (S.state = 0), (S.next = THROW_EVERY);
  }
  // Flames stream back off the pumpkin in the rush of air.
  const drift = -0.45 * V - 12;
  if (S.pk > 0 || S.state === 4) {
    hand(S);
    const r = PK * S.pk;
    for (let i = 0; i < 1 + S.pk * 3; i++) spawn(S, HAND[4] + rnd(-r, r) * 0.6, HAND[5] - 2 * r + rnd(-1, 1), drift * rnd(0.6, 1.1), -rnd(11, 23), rnd(0.15, 0.32), 0);
  }
  if (S.fly) {
    const f = S.fly;
    f.vy += 52 * ds;
    f.x += f.vx * ds;
    f.y += f.vy * ds;
    f.spin += ds * 5;
    for (let i = 0; i < 4; i++) spawn(S, f.x + rnd(-2, 2), f.y + rnd(-2, 2), drift * rnd(0.7, 1.2) - V * 0.3, rnd(-14, 4), rnd(0.25, 0.55), 0);
    if (f.y >= GY - 3) {
      // It bursts on the road, which carries the fire back past the horse.
      S.fires.push({ x: f.x, t: 0 });
      for (let i = 0; i < 18; i++) spawn(S, f.x, GY - 2, -V + rnd(-40, 40), -rnd(15, 60), rnd(0.4, 0.9), 1);
      S.fly = null;
    }
  }
  S.fires = S.fires.filter((fi) => {
    fi.x -= V * ds;
    fi.t += ds;
    if (fi.t < 1.6) for (let i = 0; i < 3; i++) spawn(S, fi.x + rnd(-3, 3), GY - 1, -V + drift * 0.3, -rnd(15, 35), rnd(0.2, 0.45), 0);
    return fi.x > -10;
  });
  // Particles: flames rise and thin, sparks fall and bounce, dust settles.
  const A = S.A;
  let j = 0;
  for (let i = 0; i < S.np; i++) {
    const o = i * 6, kind = S.K[i];
    if ((A[o + 4] -= ds) <= 0) continue;
    if (kind === 1) A[o + 3] += 140 * ds;
    else if (kind === 2) A[o + 3] *= 1 - ds * 2;
    A[o] += A[o + 2] * ds;
    A[o + 1] += A[o + 3] * ds;
    if (kind === 1 && A[o + 1] > GY + 1) (A[o + 1] = GY + 1), (A[o + 3] *= -0.3), (A[o + 2] = -V);
    if (A[o] < -4 || A[o] > W + 6 || A[o + 1] < -4) continue;
    if (j !== i) A.copyWithin(j * 6, o, o + 6), (S.K[j] = kind);
    j++;
  }
  S.np = j;
}

// The sky with the moon and its glow, the far hills and the mist for a
// hue, once each time it changes.
function palette(S) {
  const h = 0.75 + S.hue, c = S.c;
  for (let p = 0; p < (HZ + 1) * W; p++) {
    const y = floor(p / W), t = min(1, floor((y / HZ) * 10) / 9), gl = GLOW[p];
    if (MOONT[p]) S.bg.set(MOONC[MOONT[p]], p * 3);
    else hsv(h - 0.04 * t, 0.8 - 0.25 * t, 0.12 + 0.3 * t, c), S.bg.set([c[0] + 240 * gl, c[1] + 220 * gl, c[2] + 190 * gl], p * 3);
  }
  hsv(h - 0.02, 0.55, 0.26, S.far);
  hsv(h - 0.05, 0.3, 0.8, S.fog);
}

function put(buf, x, y, r, g, b, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += (r - buf[o]) * a;
  buf[o + 1] += (g - buf[o + 1]) * a;
  buf[o + 2] += (b - buf[o + 2]) * a;
}

// Horse and rider into the mask: 2 black, 1 the far legs, a shade lighter.
function figure(S, m) {
  m.fill(0);
  const cap = (x0, y0, r0, x1, y1, r1, code = 2) => stamp(m, W, H, x0, y0, r0, x1, y1, r1, code);
  const bc = (x0, y0, r0, x1, y1, r1) => {
    bodyPt(S, x0, y0, P, 0);
    bodyPt(S, x1, y1, P, 2);
    cap(P[0], P[1], r0, P[2], P[3], r1);
  };
  // Legs, far ones first, two bones each: forearm and cannon in front, the
  // knee bending forward; gaskin and cannon behind, the hock bending back.
  for (const [jx, jy, off, far, fore] of LEGS) {
    bodyPt(S, jx, jy, P, 0);
    const x0 = P[0], y0 = P[1];
    foot(S.ph - off - floor(S.ph - off), fore, x0);
    let dx = F[0] - x0, dy = F[1] - y0;
    const dd = sqrt(dx * dx + dy * dy), dm = min(L1 + L2 - 0.05, max(abs(L1 - L2) + 0.5, dd));
    (dx /= dd), (dy /= dd);
    const fx = x0 + dx * dm, fy = y0 + dy * dm, ca = (L1 * L1 + dm * dm - L2 * L2) / (2 * L1 * dm), sa = sqrt(max(0, 1 - ca * ca)), sg = fore ? -1 : 1;
    const kx = x0 + L1 * (dx * ca - sg * dy * sa), ky = y0 + L1 * (dy * ca + sg * dx * sa), code = far ? 1 : 2;
    cap(x0, y0, fore ? 2.6 : 3.2, kx, ky, 1.4, code);
    cap(kx, ky, 1.2, fx, fy, 0.9, code);
    cap(fx, fy - 0.5, 1.3, fx + 0.8, fy, 1.2, code);
  }
  // The tail streaming back.
  let tx = -14, ty = -4;
  for (let i = 1; i <= 6; i++) {
    const nx = -14 - 2.3 * i, ny = -4 + 0.75 * i + sin(S.t * 9 - i * 0.9) * i * 0.2;
    bc(tx, ty, 2.4 - 0.25 * i, nx, ny, 2.2 - 0.25 * i);
    (tx = nx), (ty = ny);
  }
  // Barrel, chest, quarters and withers.
  bc(-9, -0.5, 6, 8, 0, 6);
  bc(10, -1, 6.2, 10, -1, 6.2);
  bc(-10, -2, 6.6, -10, -2, 6.6);
  bc(6, -6, 2.6, 8, -6, 2.6);
  // Neck and head nod with the stride; the mane flies back.
  const nc = cos(S.neck), ns = sin(S.neck), nk = (x, y) => [11 + (x - 11) * nc - (y + 2) * ns, -2 + (x - 11) * ns + (y + 2) * nc];
  const [n1x, n1y] = nk(18, -12), [h1x, h1y] = nk(25, -5), [e1x, e1y] = nk(17, -16);
  S.eye = nk(20, -10.5);
  bc(11, -2, 5, n1x, n1y, 3);
  bc(n1x, n1y, 2.9, h1x, h1y, 1.7);
  bc(n1x - 0.5, n1y - 1, 0.8, e1x, e1y, 0.5);
  for (let i = 0; i < 5; i++) {
    const [mx, my] = nk(11.5 + i * 1.4, -6.5 - i * 1.4);
    bc(mx, my, 0.7, mx - 3.5, my + 0.5 + sin(S.t * 11 + i) * 0.8, 0.4);
  }
  // The rider: seat, a torso leaning into the gallop, broad shoulders, no head.
  bc(-1, -8, 3.3, 3, -20, 3.8);
  bc(0, -20.5, 2.5, 5.5, -20, 2.3);
  bc(2, -22.8, 1.1, 3.6, -22.6, 1.1);
  bc(-1, -7, 2.2, 5, -3, 1.8);
  bc(5, -3, 1.4, 4.2, 4, 1.2);
  bc(4.2, 4, 1.4, 6, 4.4, 1.1);
  // The rein arm, and the reins to the bit.
  bc(4, -19, 1.5, 7.5, -13, 1.3);
  bc(7.5, -13, 1.3, 11.5, -10.5, 1.1);
  bodyPt(S, 11.5, -10.5, P, 0);
  bodyPt(S, h1x - 1, h1y + 0.5, P, 2);
  cap(P[0], P[1], 0.45, P[2], P[3], 0.45);
  hand(S);
  cap(HAND[0], HAND[1], 1.6, HAND[2], HAND[3], 1.3);
  cap(HAND[2], HAND[3], 1.3, HAND[4], HAND[5], 1.1);
  // The cape, from the shoulders back on the wind, rippling, ragged at the hem.
  bodyPt(S, 2, -20, P, 0);
  const ax = P[0], ay = P[1], len = 27;
  for (let x = floor(ax); x >= max(0, ax - len); x--) {
    const t = (ax - x) / len, cy = ay + 4.5 * t * t + 1.5 * t + sin(TAU * (t * 1.2 - S.t * 1.7)) * 2.1 * t;
    let hw = 1.3 + 5 * t;
    if (t > 0.8) hw -= hash(x * 7 + floor(S.t * 6)) * 15 * (t - 0.8);
    for (let y = max(0, round(cy - hw)); y <= min(H - 1, round(cy + hw * 0.9)); y++) m[y * W + x] = 2;
  }
}

const RIBS = [[255, 168, 40], [255, 128, 16], [226, 92, 8]];
function pumpkin(S, buf, cx, cy, k, sp) {
  const r = PK * k;
  if (r < 0.6) return;
  const fl = 0.78 + 0.22 * (0.5 + 0.5 * vn(S.t * 11, 3)) * (0.7 + 0.3 * vn(S.t * 3, 9));
  // A glow round it, in steps.
  for (let y = floor(cy - r - 9); y <= cy + r + 9; y++)
    for (let x = floor(cx - r - 9); x <= cx + r + 9; x++) {
      const e = sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) - r;
      if (e > 0 && e < 9) put(buf, x, y, 255, 120, 20, (e < 2 ? 0.34 : e < 5 ? 0.18 : 0.07) * fl);
    }
  for (let y = floor(cy - r - 1); y <= cy + r; y++)
    for (let x = floor(cx - r * 1.15 - 1); x <= cx + r * 1.15; x++) {
      const u = (x + 0.5 - cx) / (r * 1.15), v = (y + 0.5 - cy) / r;
      if (u * u + v * v > 1) continue;
      // Ribs in three bright tones, and the carved face lit from inside.
      const rib = abs(sin((u + sp) * 4.2)), fu = u / 0.9;
      const eye = v > -0.5 && v < -0.05 && abs(abs(fu) - 0.42) < (0.3 * (v + 0.55)) / 0.5;
      const mouth = v > 0.2 && v < 0.62 && abs(fu) < 0.62 - (v - 0.2) * 0.5 && !(v < 0.4 && abs(fu) > 0.1 && abs(fu) < 0.3);
      if (k > 0.7 && (eye || mouth)) put(buf, x, y, 255 * fl, 236 * fl, 120 * fl, 1);
      else {
        const c = RIBS[rib > 0.75 ? 0 : rib > 0.3 ? 1 : 2];
        put(buf, x, y, c[0], c[1], c[2], 1);
      }
    }
  put(buf, cx - 0.5, cy - r - 1, 60, 170, 40, 1);
}

// Mist from row y0 to y1, drifting by sp: at most `a` of it, thickest at
// row yc and thinning over wd rows either side.
function mist(S, buf, y0, y1, yc, wd, a, sp, row) {
  const fog = S.fog;
  for (let y = max(0, y0); y < min(H, y1); y++) {
    const band = exp(-(((y - yc) / wd) ** 2)), fj = (y + row) % FH;
    for (let x = 0; x < W; x++) {
      const n = FN[fj * FW + (((floor((x + sp) * 0.5) % FW) + FW) % FW)], v = band * cl((n - 0.2) * 1.8, 0, 1) * a;
      if (v > 0.03) put(buf, x, y, fog[0], fog[1], fog[2], round(v * 12) / 12);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.hue !== S.hue0) (S.hue0 = S.hue), palette(S);
  const buf = S.buf, far = S.far, g = S.g, A = S.A;
  buf.set(S.bg);
  for (const [x, y, ph] of STARS) {
    const v = sin(S.t * 2.3 + ph) > 0.2 ? 200 : 110;
    put(buf, x, y, v, v, v + 30, 1);
  }
  // Far hills, slow, with a ragged line of tiny trees.
  for (let x = 0; x < W; x++) {
    const wx = x + g * 0.1, top = HZ - 5 - 3 * vn(wx / 17, 11) - 1.5 * vn(wx / 6, 12) - (hash(floor(wx / 3) * 5 + 1) < 0.25 ? 3 : 0);
    for (let y = round(top); y <= HZ; y++) put(buf, x, y, far[0], far[1], far[2], 1);
  }
  // Trees and gravestones on the horizon, in slots of 14 LEDs.
  const mo = g * 0.3, pT = 0.2 + 0.72 * S.woods;
  for (let sl = floor((mo - TW) / 14); sl <= floor((mo + W + TW) / 14); sl++) {
    const sx = sl * 14 - mo + hash(sl * 3 + 3) * 6;
    if (hash(sl * 3 + 1) < pT) {
      const l = TREES[floor(hash(sl * 3 + 2) * NT)], flip = hash(sl * 3 + 4) < 0.5, x0 = round(sx - TW / 2);
      for (let i = 0; i < l.length; i += 2) {
        const x = x0 + (flip ? TW - 1 - l[i] : l[i]), y = HZ + 1 - TH + l[i + 1];
        if (x >= 0 && x < W && y >= 0) buf.set(TREEC, (y * W + x) * 3);
      }
    } else if (hash(sl * 5 + 7) < 0.55) {
      const st = STONES[floor(hash(sl * 5 + 8) * 3)];
      for (let j = 0; j < st.length; j++)
        for (let i = 0; i < st[j].length; i++) if (st[j][i] === "x") put(buf, sx + i, HZ - st.length + 1 + j, j ? 52 : 104, j ? 42 : 92, j ? 68 : 124, 1);
    }
  }
  // The road, its ruts running back, and the dark verge with grass tufts.
  for (let y = RD0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = floor(x + g * 1.15), o = (y * W + x) * 3;
      const k = 3 * (y < RD1 ? (y === RD0 ? 0 : (y === 102 || y === 105) && hash(floor(x + g) * 3 + y) < 0.35 ? 1 : 2) : hash(gx * 13) < 0.3 && y - RD1 < 1 + floor(hash(gx * 7) * 4) ? 3 : y < 116 ? 4 : 5);
      (buf[o] = GROUND[k]), (buf[o + 1] = GROUND[k + 1]), (buf[o + 2] = GROUND[k + 2]);
    }
  // Wisps along the horizon, a little thicker with the mist.
  mist(S, buf, 84, RD1, 99, 7, 0.25 + 0.45 * S.mist, g * 0.6, 0);
  // Dust behind the figure.
  for (let i = 0; i < S.np; i++) if (S.K[i] === 2) put(buf, A[i * 6], A[i * 6 + 1], 140, 124, 160, (A[i * 6 + 4] / A[i * 6 + 5]) * 0.75);
  // Horse and rider: black, rimmed with moonlight where they meet the moon.
  const m = S.mask;
  figure(S, m);
  for (let p = 0; p < N; p++) {
    const c = m[p], o = p * 3;
    if (!c) continue;
    if (c === 1) {
      buf.set(FARLEG, o);
      continue;
    }
    // The brightest open neighbour lights the rim, if it is moonlight.
    let q = -1, best = 300;
    for (let s = 0; s < 4; s++) {
      const n = s === 0 ? p - 1 : s === 1 ? p + 1 : s === 2 ? p - W : p + W;
      if (n >= 0 && n < N && !m[n] && buf[n * 3] + buf[n * 3 + 1] > best) (best = buf[n * 3] + buf[n * 3 + 1]), (q = n * 3);
    }
    if (q < 0) (buf[o] = 3), (buf[o + 1] = 1), (buf[o + 2] = 6);
    else (buf[o] = buf[q] * 0.42), (buf[o + 1] = buf[q + 1] * 0.42), (buf[o + 2] = buf[q + 2] * 0.42);
  }
  // The horse's eye, a coal.
  bodyPt(S, S.eye[0], S.eye[1], P, 0);
  put(buf, P[0] - 0.5, P[1] - 0.5, 255, 110, 30, 1);
  // The pumpkin in his hand, or in flight.
  if (S.pk > 0) {
    hand(S);
    pumpkin(S, buf, HAND[4] + 0.5, HAND[5] - PK * S.pk + 0.5, S.pk, 0);
  }
  if (S.fly) pumpkin(S, buf, S.fly.x, S.fly.y, 1, S.fly.spin);
  // Flames yellow to orange to red, sparks white-gold.
  for (let i = 0; i < S.np; i++) {
    const o = i * 6, a = 1 - A[o + 4] / A[o + 5], kind = S.K[i];
    if (kind === 0) {
      if (a < 0.3) put(buf, A[o], A[o + 1], 255, 236, 130, 1);
      else if (a < 0.65) put(buf, A[o], A[o + 1], 255, 146, 24, 1);
      else put(buf, A[o], A[o + 1], 236, 64, 18, 1.4 - a);
    } else if (kind === 1) put(buf, A[o], A[o + 1], 255, 226, 150, 1);
  }
  // Mist in front: up to the knees at half, the belly at 1, drifting back
  // faster than the road.
  if (S.mist > 0.1) mist(S, buf, 70, H, GY + 12 - 18 * S.mist, 5 + 12 * S.mist, 0.35 + 0.65 * S.mist, g * 1.3 + S.t * 8, 11);
  // The near fence, fastest of all, moonlit on its left.
  for (let x = 0; x < W; x++) {
    const px = (((x + g * 1.15) % 40) + 40) % 40;
    if (px < 3) for (let y = 109; y < H; y++) put(buf, x, y, px < 1 ? 92 : 54, px < 1 ? 84 : 46, px < 1 ? 110 : 68, 1);
    else for (const y of [112, 119]) put(buf, x, y, 84, 74, 100, 1);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, round(buf[o] / 4) * 4), min(255, round(buf[o + 1] / 4) * 4), min(255, round(buf[o + 2] / 4) * 4));
}
