// ===== Patternflow pattern =====
// Title:   Loose Powder
// Family:  cosmetic
// Idea:    A pressed powder embossed with a flower medallion fills the panel under a low light; an unseen puff, shown only by its shadow, comes down and presses a soft dent into it, and as it lifts a pale cloud of powder rises with mica glinting in it, drifts up the panel on slow air and settles back as a dusting, over a white band edged with one gold line.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 29, after the embossed relief of pressed face powder and the puff lifted from it
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shimmer=1..5, Air=0..1
//
// Knob 1: Hue. The colour of the powder, all the way round the wheel from rose at 0; the cloud stays a pale tint of it, and the white band and the gold line stay as they are.
// Knob 2: Speed. How fast the puff and the air move: at 2 the puff comes down every seven seconds and its cloud hangs for about ten; at 0.2 everything runs ten times slower.
// Knob 3: Shimmer. How much mica is in the powder: at 1 it is matte with a few glints in the cloud; turned up, a satin sheen runs along the slopes of the relief that face the light, the surface glints here and there and the cloud carries up to five times the mica.
// Knob 4: Air. How far the cloud drifts: at 0 it creeps a few rows up the panel and settles near the dent; at 1 a draught carries it off the top in a few seconds and lifts wisps of loose powder off the surface by itself.
// Buttons: K1 tap brings the puff down now, once the last one has lifted.

const W = 64, H = 128, N = W * H;
const MAXP = 2600;
const { min, max, floor, sin, cos, exp, sqrt, hypot, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The powder ends at row FLOOR, where a gold line edges a white band: the
// packaging, the only part of it on show. The medallion sits centred above.
const FLOOR = 115, MY = 57;

// The emboss, as a height: an eight-petalled flower with a raised rim round
// each petal, a ring at its heart, a wide ring cut off by the panel's sides
// and fine rays beyond it. GRAIN is each LED's fixed bit of powder texture and
// TW the seed of the mica that may sit there.
const E = new Float32Array(N), GRAIN = new Float32Array(N), TW = new Float32Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - 32, dy = y + 0.5 - MY, r = hypot(dx, dy), a = atan2(dy, dx);
    const pet = 21 + 6 * cos(a * 8);
    let h = cl((pet - r) / 3, 0, 1) * 0.6;
    h += 0.4 * exp(-(((r - pet) / 1.2) ** 2));
    h += 0.5 * exp(-(((r - 8.5) / 1.2) ** 2));
    h += 0.5 * exp(-(((r - 42) / 1.3) ** 2));
    if (r > 44) h += 0.25 * (0.5 + 0.5 * cos(a * 48));
    const i = y * W + x;
    E[i] = h;
    GRAIN[i] = (hash(i) - 0.5) * 0.07;
    TW[i] = hash(i + 77777);
  }

// The LEDs that could hold mica, in the order Shimmer turns them on.
const MICA = Int32Array.from({ length: FLOOR * W }, (_, i) => i)
  .filter((i) => TW[i] < 0.02)
  .sort((a, b) => TW[a] - TW[b]);

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5);
  out[o + 1] = f(3);
  out[o + 2] = f(1);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    x: F(MAXP), y: F(MAXP), z: F(MAXP), vx: F(MAXP), vy: F(MAXP), vz: F(MAXP), ph: F(MAXP), om: F(MAXP), mica: new Uint8Array(MAXP),
    n: 0, dent: F(N), wear: F(N).fill(1), dust: F(N), prof: F(N), hm: F(N), den: F(N), sh: F(N), tmp: F(N), buf: F(N * 3),
    T: 0, u: 99, wisp: 0, px: 32, py: 64, pz: 40, started: false, hue: 0, shim: 1, air: 0.06, az: 0, col: F(6),
  };
}

// One grain of powder into the air at height z. When the air is full, it
// takes the place of a grain already there.
function emit(S, x, y, z, vx, vy, vz) {
  let i = S.n;
  if (i >= MAXP) i = floor(Math.random() * MAXP);
  else S.n++;
  S.x[i] = x;
  S.y[i] = y;
  S.z[i] = z;
  S.vx[i] = vx;
  S.vy[i] = vy;
  S.vz[i] = vz;
  // A mica flake turns at its own rate and flashes once a turn.
  S.mica[i] = Math.random() < 0.04 * S.shim ? 1 : 0;
  S.ph[i] = Math.random() * 2 * PI;
  S.om[i] = (1.5 + 3.5 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
}
function kill(S, i) {
  const j = --S.n;
  S.x[i] = S.x[j];
  S.y[i] = S.y[j];
  S.z[i] = S.z[j];
  S.vx[i] = S.vx[j];
  S.vy[i] = S.vy[j];
  S.vz[i] = S.vz[j];
  S.ph[i] = S.ph[j];
  S.om[i] = S.om[j];
  S.mica[i] = S.mica[j];
}

// The puff's round, in seconds at Speed 2: it comes down, presses, lifts, and
// the cloud has the rest. R is its radius in LEDs, ZTOP how high it waits.
const DOWN = 1.2, PRESS = 0.8, LIFT = 0.7, ROUND = 7, R = 16, ZTOP = 34;

// A new round: the puff picks a spot, and the dent it will press is drawn up.
function start(S) {
  S.u = 0;
  S.px = 18 + Math.random() * 28;
  S.py = 22 + Math.random() * (FLOOR - 46);
  const p = S.prof;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = hypot(x + 0.5 - S.px, y + 0.5 - S.py);
      p[y * W + x] = 1 - sstep(R * 0.3, R, r);
    }
}

function step(S, st) {
  S.T += st;
  S.az = 0.32 * sin(S.T * 0.21) + 0.12 * sin(S.T * 0.53 + 1);
  if (S.u > ROUND) start(S);
  const u0 = S.u;
  S.u += st;
  const u = S.u;
  // Height of the puff above the powder, and how deep it is pressed.
  if (u < DOWN) S.pz = ZTOP * (1 - sstep(0, DOWN, u));
  else if (u < DOWN + PRESS) S.pz = 0;
  else S.pz = ZTOP * sstep(DOWN + PRESS, DOWN + PRESS + LIFT * 1.6, u);
  const press = u < DOWN ? 0 : u < DOWN + PRESS ? sstep(DOWN, DOWN + PRESS * 0.6, u) : 1;
  // Pressing dents the powder and flattens the emboss under the puff. Both
  // come back slowly as the cloud dusts the surface, so the round can repeat.
  const dent = S.dent, wear = S.wear, dust = S.dust, prof = S.prof;
  const fd = exp(-st / 7), fw = st / 9, fu = exp(-st / 5);
  for (let i = 0; i < N; i++) {
    dent[i] *= fd;
    wear[i] += (1 - wear[i]) * fw;
    dust[i] *= fu;
    if (press > 0 && u < DOWN + PRESS + 0.05) {
      const p = prof[i] * press;
      if (p > dent[i]) dent[i] = p;
      const w = 1 - 0.6 * p;
      if (w < wear[i]) wear[i] = w;
    }
  }
  // Squeezed out at the rim as it presses in, lifted out of the dent as it rises.
  if (u0 < DOWN + 0.1 && u >= DOWN + 0.1)
    for (let k = 0; k < 420; k++) {
      const a = Math.random() * 2 * PI, s = 10 + 22 * Math.random();
      emit(S, S.px + cos(a) * R * 0.9, S.py + sin(a) * R * 0.9, 0.5 + Math.random() * 2, cos(a) * s, sin(a) * s, 4 + 8 * Math.random());
    }
  if (u > DOWN + PRESS && u < DOWN + PRESS + LIFT) {
    const n = floor((850 * st) / LIFT + Math.random());
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 2 * PI, r = R * sqrt(Math.random()) * 0.9, s = 3 + 9 * Math.random();
      emit(S, S.px + cos(a) * r, S.py + sin(a) * r, Math.random() * 3, cos(a) * s, sin(a) * s, 8 + 12 * Math.random());
    }
  }
  // The air: slow eddies and a drift up the panel, both stronger with Air.
  // A strong draught lifts wisps of loose powder off the surface by itself.
  const A = S.air, T = S.T, kd = min(1, 1.2 * st), kz = min(1, 0.9 * st);
  S.wisp += st * 160 * A * A;
  while (S.wisp >= 1) {
    S.wisp -= 1;
    emit(S, Math.random() * W, 10 + Math.random() * (FLOOR - 10), 0.2, 0, 0, 2 + 4 * Math.random());
  }
  for (let i = S.n - 1; i >= 0; i--) {
    const x = S.x[i], y = S.y[i];
    const ex = (1.5 + 6 * A) * sin(y * 0.06 + T * 0.4) + (1 + 3 * A) * sin(y * 0.13 - T * 0.3 + x * 0.05);
    const ey = -(2 + 16 * A) + (1.5 + 4 * A) * sin(x * 0.09 - T * 0.33);
    S.vx[i] += (ex - S.vx[i]) * kd;
    S.vy[i] += (ey - S.vy[i]) * kd;
    S.vz[i] += (-1.3 - S.vz[i]) * kz;
    S.x[i] = x + S.vx[i] * st;
    S.y[i] = y + S.vy[i] * st;
    S.z[i] += S.vz[i] * st;
    S.ph[i] += S.om[i] * st;
    const nx = S.x[i], ny = S.y[i];
    if (nx < -4 || nx > W + 4 || ny < -6 || ny > FLOOR + 4) {
      kill(S, i);
      continue;
    }
    if (S.z[i] <= 0) {
      // Settling: it dusts the powder where it lands.
      const p = floor(ny) * W + floor(nx);
      if (nx >= 0 && nx < W && ny >= 0 && ny < FLOOR) dust[p] = min(1.5, dust[p] + 0.05);
      kill(S, i);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06];
  const d = cl(dt || 0, 0, 0.1), rate = cl(k[1], 0.2, 3) / 2;
  S.hue = k[0];
  S.shim = cl(k[2], 1, 5);
  S.air = cl(k[3], 0, 1);
  // Open with the last round's cloud still in the air and the next puff a
  // second and a half away.
  if (!S.started) {
    S.started = true;
    start(S);
    for (let i = 0; i < 162; i++) step(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0] && S.u > DOWN + PRESS + LIFT) start(S);
  step(S, d * rate);
}

// Spreads a splat buffer over its neighbours, for a soft cloud.
function blur(a, t, passes) {
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        t[i] = (a[i] * 2 + (x > 0 ? a[i - 1] : a[i]) + (x < W - 1 ? a[i + 1] : a[i])) * 0.25;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        a[i] = (t[i] * 2 + (y > 0 ? t[i - W] : t[i]) + (y < H - 1 ? t[i + W] : t[i])) * 0.25;
      }
  }
}
function splat(a, x, y, w) {
  const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const px = x0 + i, py = y0 + j;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      a[py * W + px] += w * (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
    }
}

// The four LEDs beside one, as offsets into the colour buffer.
const NB = [-3, 3, -W * 3, W * 3];

// The light comes low from the upper left, so the relief stands out, and sways
// a little: the sheen and the glints move with it.
const LA = atan2(-0.65, -0.55), LZ = 0.5;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const buf = S.buf, hm = S.hm, den = S.den, sh = S.sh, col = S.col;
  hsv(S.hue + 0.95, 0.5, 205, col, 0);
  hsv(S.hue + 0.95, 0.07, 255, col, 3);
  const la = LA + S.az, lx = cos(la), ly = sin(la);
  const hl = hypot(lx * 0.894, ly * 0.894, 1.447), hx = (lx * 0.894) / hl, hy = (ly * 0.894) / hl, hz = 1.447 / hl;
  const sheen = 0.1 + 0.45 * (S.shim - 1);
  // The height of the surface, then the cloud's density and its shadow,
  // thrown away from the light by each grain's height.
  for (let i = 0; i < N; i++) hm[i] = E[i] * S.wear[i] - 0.9 * S.dent[i] + 0.25 * S.dust[i];
  den.fill(0);
  sh.fill(0);
  for (let i = 0; i < S.n; i++) {
    const z = S.z[i];
    splat(den, S.x[i], S.y[i], 0.55);
    splat(sh, S.x[i] - lx * z * 0.8, S.y[i] - ly * z * 0.8, 0.35);
  }
  blur(den, S.tmp, 2);
  blur(sh, S.tmp, 1);
  // The puff's shadow, cast away from the light, softer the higher it is.
  const sx = S.px - lx * S.pz * 0.8, sy = S.py - ly * S.pz * 0.8, soft = 1.5 + S.pz * 0.3, dark = 0.36 - 0.2 * (S.pz / ZTOP);
  const sr = R * (1 + S.pz * 0.01);
  for (let y = 0; y < FLOOR; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, q = i * 3;
      const gx = (hm[y * W + min(W - 1, x + 1)] - hm[y * W + max(0, x - 1)]) * 1.6;
      const gy = (hm[min(FLOOR - 1, y + 1) * W + x] - hm[max(0, y - 1) * W + x]) * 1.6;
      const inv = 1 / sqrt(gx * gx + gy * gy + 1), lam = max(0, (-gx * lx - gy * ly + LZ) * inv) / LZ;
      // Shimmer: a satin sheen on the slopes that face halfway between the
      // light and the eye.
      let sp = max(0, (-gx * hx - gy * hy + hz) * inv);
      sp *= sp;
      sp *= sp;
      sp *= sp;
      sp = sp * sp * sp * sheen;
      let v = (0.42 + 0.5 * lam) * (1 + GRAIN[i]);
      // Fresh loose powder on top is paler; the pressed patch a touch deeper.
      const du = min(1, S.dust[i]) * 0.3, pr = S.dent[i] * 0.1;
      v *= 1 - pr;
      const c = sh[i] * 1.4;
      v *= 1 - (0.16 * c) / (1 + c);
      const ddx = x + 0.5 - sx, ddy = y + 0.5 - sy, dd = ddx * ddx + ddy * ddy;
      if (S.pz < ZTOP * 0.99 && dd < (sr + soft) ** 2) v *= 1 - dark * (1 - sstep(sr - soft, sr + soft, sqrt(dd)));
      let r = col[0] * v + 250 * sp, g = col[1] * v + 240 * sp, b = col[2] * v + 225 * sp;
      r += (col[3] * v - r) * du;
      g += (col[4] * v - g) * du;
      b += (col[5] * v - b) * du;
      // The cloud in the air, lit and pale.
      const e = den[i] * 1.8, a = min(0.9, e / (1 + e));
      buf[q] = r + (col[3] - r) * a;
      buf[q + 1] = g + (col[4] - g) * a;
      buf[q + 2] = b + (col[5] - b) * a;
    }
  // The white band, and the gold line along its top with a highlight that
  // slides along it as the light sways.
  {
    const gx = 32 + 110 * S.az;
    for (let y = FLOOR; y < H; y++)
      for (let x = 0; x < W; x++) {
        const q = (y * W + x) * 3, gold = y === FLOOR ? 1 : y === FLOOR + 1 ? 0.35 : 0;
        const hl = 0.8 + 0.45 * exp(-((x - gx) ** 2) / 50);
        buf[q] = 222 + (240 * hl - 222) * gold;
        buf[q + 1] = 216 + (178 * hl - 216) * gold;
        buf[q + 2] = 208 + (70 * hl - 208) * gold;
      }
  }
  // Mica pressed into the powder: a few LEDs, more with Shimmer, each glinting
  // when the swaying light passes the angle of its face.
  const lim = 0.004 * S.shim;
  for (let k = 0; k < MICA.length && TW[MICA[k]] < lim; k++) {
    const i = MICA[k];
    const g = exp((cos(TW[i] * 1500 + S.az * 7) - 1) / 0.03) * (1 - min(1, S.dent[i]));
    if (g < 0.02) continue;
    const q = i * 3, v = 230 * g;
    buf[q] += v;
    buf[q + 1] += v * 0.92;
    buf[q + 2] += v * 0.8;
  }
  // Mica in the cloud: each flake turns and flashes as its face meets the light.
  for (let i = 0; i < S.n; i++) {
    if (!S.mica[i]) continue;
    const f = exp((cos(S.ph[i]) - 1) / 0.05), v = 40 + 260 * f;
    const x = floor(S.x[i]), y = floor(S.y[i]);
    if (x < 1 || x >= W - 1 || y < 1 || y >= FLOOR - 1) continue;
    const q = (y * W + x) * 3;
    buf[q] += v;
    buf[q + 1] += v * 0.95;
    buf[q + 2] += v * 0.85;
    // A flash spills a little onto the LEDs beside it, or it looks pinpricked.
    if (f > 0.3)
      for (const o of NB) {
        buf[q + o] += v * 0.25;
        buf[q + o + 1] += v * 0.24;
        buf[q + o + 2] += v * 0.21;
      }
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, buf[p]), min(255, buf[p + 1]), min(255, buf[p + 2]));
}
