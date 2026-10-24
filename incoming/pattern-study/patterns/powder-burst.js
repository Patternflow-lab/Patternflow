// ===== Patternflow pattern =====
// Title:   Powder Burst
// Family:  cosmetic
// Idea:    In slow motion a cake of loose pigment powder at the foot of a dark studio is struck and bursts: the powder rises through the whole panel as a plume whose head rolls up into a ring, a mushroom of soft colour with fine dust curling off its rim and heavier specks arcing back down, mica glinting in it, until it drifts apart and settles and the next strike comes.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 37, after the slow-motion powder explosions of cosmetics advertising
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Force=0..1, Shimmer=0..1
//
// Knob 1: Hue. The pigment, once round the wheel: at 0 orchid pink, at 0.15 coral, at 0.21 apricot, at 0.3 lemon, at 0.45 green, at 0.6 aqua, at 0.75 cobalt, at 0.85 violet. From coral to lemon the powder is paler, its faint end is lifted, and as it fades it greys to a pale dust, so it never reads brown or olive.
// Knob 2: Speed. How slow the slow motion is: at 2 a strike comes every 6.3 seconds, the head's top reaches the top rows about 4 seconds after it and the last dust is gone about 8 seconds after it; at 0.2 ten times slower.
// Knob 3: Force. How hard the cake is struck: at 0 the head climbs about 80 rows and opens about 50 LEDs wide; at 1 it climbs 130 and leaves through the top, opens about 66 wide, wider than the panel, and throws twice the specks, 200 a strike against 90.
// Knob 4: Shimmer. Mica in the powder: at 0 about 60 flakes a strike, a glint here and there; at 1 about 1,460, so the cloud glitters, and its lit tops take a pearl tint a fifth of the way round the wheel from the pigment.
// Buttons: K1 tap strikes the cake now.

const W = 64, H = 128, N = W * H;
const MAXP = 9000;
const { min, max, floor, sin, cos, exp, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Kinds of particle: fine powder, heavy specks, mica flakes.
const FINE = 0, SPECK = 1, MICA = 2;
// Strikes alive at once, kept in a ring.
const NB = 4;
// How far below the head the eye is (see draw), the share of grains drawn
// round the axis rather than in the plane, how thick powder turns to light
// (1 - exp(-GAIN d)), and the dust's mean life in seconds.
const TILT = 0.12, GAIN = 2.6, FILL = 0.5, LIFE = 6.2;
// Small eddies: a stream function of four travelling waves, 19 to 44 LEDs
// long, whose curl wrinkles the cloud's edge without bunching the powder.
const WAVES = [
  [44, 0.4, 0.5],
  [33, 2.1, -0.7],
  [25, 3.9, 0.8],
  [19, 5.1, -1.0],
].map(([l, a, w], j) => {
  const k = (2 * PI) / l;
  return [k * cos(a), k * sin(a), w, 1 / k, j * 1.9];
});
// And a finer set, 8 to 13 LEDs, that only the young powder feels: it
// wrinkles the head's edge into billows.
const FINE_WAVES = [
  [13, 0.9, 2.2],
  [10.5, 2.8, -2.6],
  [8, 4.6, 3.0],
].map(([l, a, w], j) => {
  const k = (2 * PI) / l;
  return [k * cos(a), k * sin(a), w, 1 / k, j * 2.3];
});
const GS = 4, GX = W / GS + 3, GY = H / GS + 3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    x: F(MAXP), y: F(MAXP), vx: F(MAXP), vy: F(MAXP), age: F(MAXP), life: F(MAXP), kd: F(MAXP), g: F(MAXP), w: F(MAXP), ph: F(MAXP), ca: F(MAXP), sa: F(MAXP),
    kind: new Uint8Array(MAXP), bid: new Uint8Array(MAXP), n: 0,
    B0: F(NB).fill(-99), BX: F(NB), BY: F(NB), BD: F(NB), BR: F(NB), BP: F(NB), slot: 0, ring: new Float64Array(NB * 7), nr: 0, fl: [0, 0],
    U: F(GX * GY), V: F(GX * GY), U2: F(GX * GY), V2: F(GX * GY), D: F(N), O: F(N), S: F(N), G: F(N), tmp: F(N), col: F(12),
    T: 0, next: 0, side: rnd() < 0.5 ? -1 : 1, hue: 0, force: 0, shim: 0.06, started: false,
  };
}

// A strike at x0: the cake sits on the floor at row 116.
function strike(S, x0) {
  const q = (S.slot = (S.slot + 1) % NB), f = S.force;
  S.B0[q] = S.T;
  S.BP[q] = 0;
  S.BX[q] = x0;
  S.BY[q] = 116;
  // How far the head climbs, and how wide its ring opens.
  S.BD[q] = (80 + 50 * f) * (0.92 + 0.16 * rnd());
  S.BR[q] = (14.5 + 4.5 * f) * (0.9 + 0.2 * rnd());
  const nf = 2600, ns = round((90 + 110 * f) * (0.8 + 0.4 * rnd())), nm = 60 + round(1400 * S.shim);
  for (let j = 0; j < nf + ns + nm && S.n < MAXP; j++) {
    const i = S.n++, kind = j < nf ? FINE : j < nf + ns ? SPECK : MICA;
    S.x[i] = x0 + (rnd() - 0.5) * 5;
    S.y[i] = 115 + (rnd() - 0.5) * 2;
    S.age[i] = -rnd() * 0.06;
    S.kind[i] = kind;
    S.bid[i] = q;
    S.ph[i] = rnd() * 2 * PI;
    const az = rnd() * 2 * PI, fill = rnd() < FILL;
    S.ca[i] = fill ? cos(az) : 1;
    S.sa[i] = fill ? sin(az) : 0;
    if (kind === SPECK) {
      // Specks are thrown out of the cake on steep arcs and fall back.
      const a = (rnd() + rnd() + rnd() - 1.5) * 1.1, sp = (60 + 50 * rnd()) * (1 + 0.5 * f);
      S.vx[i] = sp * sin(a);
      S.vy[i] = -sp * cos(a);
      S.kd[i] = 0.5 + 0.4 * rnd();
      S.g[i] = 55 + 25 * rnd();
      S.life[i] = 2.4 + rnd();
      S.w[i] = 0.5 + 0.5 * rnd();
      continue;
    }
    // Fine powder is thrown from the cake to a place round the head's
    // start and comes to rest there in about 0.2 s, its throw halving every
    // 0.04 to 0.06 s, so the head forms full: 16% round its two eddies, 40%
    // in a dome over them. Another 22% is lofted over the next 0.6 s and
    // drawn up behind as the stem, 10% is a skirt flung low along the floor
    // and 12% a spray that fans out high.
    const kd = (S.kd[i] = 12 + 6 * rnd()), u = rnd(), R = S.BR[q];
    let tx, ty;
    if (u < 0.16) {
      // Round the two eddies of the head, the hubs it rolls up on.
      const g = gauss2();
      tx = x0 + (rnd() < 0.5 ? -R : R) + g[0] * 0.28 * R;
      ty = 104 + g[1] * 0.28 * R;
    } else if (u < 0.56 || kind === MICA) {
      // A thick dome over the head: as the head climbs its outside runs
      // down round the eddies and curls in under the cap.
      const t = PI * (1.05 + 0.9 * rnd()), r = 1 - 0.4 * rnd() * rnd();
      tx = x0 + r * cos(t) * 1.75 * R;
      ty = 104 + r * sin(t) * 1.45 * R;
    } else if (u < 0.78) {
      tx = x0 + (rnd() - 0.5) * 10;
      ty = 112 - 6 * rnd();
      S.age[i] = -0.1 - 0.6 * rnd();
    } else if (u < 0.88) {
      tx = x0 + (rnd() < 0.5 ? -1 : 1) * (8 + 18 * rnd()) * (1 + 0.4 * f);
      ty = 114 - 4 * rnd();
    } else {
      const a = (rnd() - 0.5) * 2.4, r = (24 + 30 * rnd()) * (1 + 0.4 * f);
      tx = x0 + r * sin(a);
      ty = 108 - r * cos(a);
    }
    S.vx[i] = (tx - S.x[i]) * kd;
    S.vy[i] = (ty - S.y[i]) * kd;
    S.g[i] = 0.4 + 1.2 * rnd();
    S.life[i] = LIFE * (0.8 + 0.4 * rnd());
    S.w[i] = 0.6 + 0.6 * rnd();
  }
}

function gauss2() {
  const r = sqrt(-2 * Math.log(1 - rnd())), t = 2 * PI * rnd();
  return [r * cos(t), r * sin(t)];
}

function round(v) {
  return floor(v + 0.5);
}

function kill(S, i) {
  const j = --S.n;
  S.x[i] = S.x[j];
  S.y[i] = S.y[j];
  S.vx[i] = S.vx[j];
  S.vy[i] = S.vy[j];
  S.age[i] = S.age[j];
  S.life[i] = S.life[j];
  S.kd[i] = S.kd[j];
  S.g[i] = S.g[j];
  S.w[i] = S.w[j];
  S.ph[i] = S.ph[j];
  S.ca[i] = S.ca[j];
  S.sa[i] = S.sa[j];
  S.kind[i] = S.kind[j];
  S.bid[i] = S.bid[j];
}

// The eddies on a grid every 4 LEDs, read off between.
function eddies(S) {
  const T = S.T;
  for (let gy = 0; gy < GY; gy++)
    for (let gx = 0; gx < GX; gx++) {
      const x = (gx - 1) * GS, y = (gy - 1) * GS;
      let u = 0, v = 0;
      for (const [kx, ky, w, m, ph] of WAVES) {
        const c = m * cos(kx * x + ky * y + w * T + ph);
        u += c * ky;
        v -= c * kx;
      }
      S.U[gy * GX + gx] = u;
      S.V[gy * GX + gx] = v;
      u = 0;
      v = 0;
      for (const [kx, ky, w, m, ph] of FINE_WAVES) {
        const c = m * cos(kx * x + ky * y + w * T + ph);
        u += c * ky;
        v -= c * kx;
      }
      S.U2[gy * GX + gx] = u;
      S.V2[gy * GX + gx] = v;
    }
}

function step(S, h) {
  S.T += h;
  S.next -= h;
  if (S.next <= 0) {
    // Strikes alternate sides of the middle, 9 to 15 LEDs out.
    S.side = -S.side;
    strike(S, 32 + S.side * (9 + 6 * rnd()));
    S.next = 6.3 * (0.95 + 0.1 * rnd());
  }
  eddies(S);
  // Each strike's head: the plume's ring, seen edge on as two eddies of
  // opposite spin R apart either side of its axis, climbing D rows on a
  // curve that slows as it goes.
  const ring = S.ring;
  let nr = 0;
  for (let q = 0; q < NB; q++) {
    // The head forms once the thrown powder has come to rest round it,
    // 0.3 s after the strike, and gathers speed over a quarter second.
    const a = S.T - S.B0[q] - 0.3;
    if (a < 0 || a > 7) continue;
    const tau = 2.6, D = S.BD[q], V = ((D / tau) * exp(-a / tau) + 3) * sm(0, 0.25, a);
    S.BP[q] += V * h;
    // A third of the climb is the eddies' own: their strength is what moves
    // a pair of cores 0.65 R wide at V / 3, 4.42 pi R V / 3. The rest is the
    // warm air the head rides on, a broad rising blob that carries the
    // cores at the same 2V / 3 as the powder round them; full-strength
    // eddies rolled the dome into the cores within a second and the head
    // read as two lobes.
    const R = S.BR[q], rc = 0.65 * R, o = nr * 7;
    ring[o] = S.BX[q];
    ring[o + 1] = S.BY[q] - 12 - S.BP[q];
    ring[o + 2] = R;
    ring[o + 3] = rc * rc;
    ring[o + 4] = (R * (4 + 0.4225) * V) / 6;
    ring[o + 5] = ((2 * V) / 3) * exp(1 / (1.9 * 1.9));
    ring[o + 6] = 30 * exp(-a / 2);
    nr++;
  }
  S.nr = nr;
  const fl = S.fl;
  for (let i = S.n - 1; i >= 0; i--) {
    let age = S.age[i];
    if (age < 0) {
      S.age[i] = age + h;
      continue;
    }
    age = S.age[i] += h;
    const x = S.x[i], y = S.y[i];
    if (age > S.life[i] || y > H + 6 || y < -30 || x < -20 || x > W + 20) {
      kill(S, i);
      continue;
    }
    if (S.kind[i] === SPECK) {
      flow(S, x, y, -1);
      const kd = 1 - exp(-S.kd[i] * h);
      S.vx[i] += (fl[0] - S.vx[i]) * kd;
      S.vy[i] += (fl[1] - S.vy[i]) * kd + S.g[i] * h;
      S.x[i] = x + S.vx[i] * h;
      S.y[i] = y + S.vy[i] * h;
    } else {
      // Fine powder rides the air exactly, plus what is left of the throw
      // from the strike and a slow settling. Given inertia instead, as the
      // specks have, it was flung out of the head's two eddies and the head
      // read as a hollow arch. It is moved by the midpoint rule: a plain
      // step turned each eddy's core, 19 radians a second, into an outward
      // spiral, and the head showed two dark holes like eye sockets.
      const kd = exp(-S.kd[i] * 0.5 * h), tx = S.vx[i] * kd, ty = S.vy[i] * kd + S.g[i] * min(1, age * 0.3);
      flow(S, x, y, age);
      flow(S, x + 0.5 * h * (fl[0] + tx), y + 0.5 * h * (fl[1] + ty), age);
      S.x[i] = x + h * (fl[0] + tx) + (rnd() - 0.5) * 0.5;
      S.y[i] = y + h * (fl[1] + ty) + (rnd() - 0.5) * 0.5;
      S.vx[i] *= kd * kd;
      S.vy[i] *= kd * kd;
    }
    // The floor: powder that comes down stays down.
    if (S.y[i] > 118) {
      S.y[i] = 118;
      S.vy[i] *= -0.2;
      S.vx[i] *= 0.6;
    }
  }
}

// The air at (x, y), into S.fl: the heads' eddies, the column of air still
// rising under each head, and for powder (age 0 and up) the small eddies,
// which grow as it ages and spreads.
function flow(S, x, y, age) {
  const ring = S.ring;
  let ux = 0, uy = 0;
  for (let r = 0; r < S.nr; r++) {
    const o = r * 7, xc = ring[o], yc = ring[o + 1], R = ring[o + 2], rc2 = ring[o + 3], G = ring[o + 4];
    // Left eddy spins so its inside runs up, the right one the other way.
    let dx = x - xc + R, dy = y - yc, q = -G / (dx * dx + dy * dy + rc2);
    ux -= q * dy;
    uy += q * dx;
    dx = x - xc - R;
    q = G / (dx * dx + dy * dy + rc2);
    ux -= q * dy;
    uy += q * dx;
    // The warm air the head rides on.
    const ex = (x - xc) / (1.9 * R), ey = (y - yc + 0.2 * R) / (1.7 * R);
    uy -= ring[o + 5] * exp(-ex * ex - ey * ey);
    // Under the head a column of air keeps rising after it, lifting the
    // late powder into a stem.
    if (y > yc) {
      const sx = (x - xc) / 7;
      uy -= ring[o + 6] * exp(-sx * sx);
    }
  }
  if (age >= 0) {
    const U = S.U, V = S.V;
    const fx = cl(x / GS + 1, 0, GX - 1.001), fy = cl(y / GS + 1, 0, GY - 1.001);
    const ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy, g = iy * GX + ix;
    const eu = (U[g] * (1 - ax) + U[g + 1] * ax) * (1 - ay) + (U[g + GX] * (1 - ax) + U[g + GX + 1] * ax) * ay;
    const ev = (V[g] * (1 - ax) + V[g + 1] * ax) * (1 - ay) + (V[g + GX] * (1 - ax) + V[g + GX + 1] * ax) * ay;
    const amp = 0.8 + 1.6 * min(1, age * 0.4), a2 = 9 * exp(-age * 0.7);
    const U2 = S.U2, V2 = S.V2;
    const fu = (U2[g] * (1 - ax) + U2[g + 1] * ax) * (1 - ay) + (U2[g + GX] * (1 - ax) + U2[g + GX + 1] * ax) * ay;
    const fv = (V2[g] * (1 - ax) + V2[g + 1] * ax) * (1 - ay) + (V2[g + GX] * (1 - ax) + V2[g + GX + 1] * ax) * ay;
    ux += eu * amp + fu * a2;
    uy += ev * amp + fv * a2;
  }
  S.fl[0] = ux;
  S.fl[1] = uy;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const rate = cl(k[1], 0.2, 3) / 2;
  S.force = cl(k[2], 0, 1);
  S.shim = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    // Open 1.5 s after the first strike, the head already rising.
    for (let i = 0; i < 45; i++) step(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) S.next = 0;
  const h = d * rate;
  const sub = h > 0.025 ? 2 : 1;
  for (let i = 0; i < sub; i++) step(S, h / sub);
}

// Box blur of radius r along rows then columns, from a into a (b is scratch).
function blur(a, b, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[o + cl(x, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      b[o + x] = s * inv;
      s += a[o + min(W - 1, x + r + 1)] - a[o + max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += b[cl(y, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      a[y * W + x] = s * inv;
      s += b[min(H - 1, y + r + 1) * W + x] - b[max(0, y - r) * W + x];
    }
  }
}

function splat(A, x, y, w) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
  if (ix < -1 || ix >= W || iy < -1 || iy >= H) return;
  const p = iy * W + ix;
  if (iy >= 0) {
    if (ix >= 0) A[p] += w * (1 - ax) * (1 - ay);
    if (ix + 1 < W) A[p + 1] += w * ax * (1 - ay);
  }
  if (iy + 1 < H) {
    if (ix >= 0) A[p + W] += w * (1 - ax) * ay;
    if (ix + 1 < W) A[p + W + 1] += w * ax * ay;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const D = S.D, O = S.O, SP = S.S, G = S.G, tmp = S.tmp, col = S.col, T = S.T, sh = S.shim;
  D.fill(0);
  O.fill(0);
  SP.fill(0);
  G.fill(0);
  // The flow is worked out in one plane through the head's axis, and the
  // cloud is round that axis, so half the grains are drawn at an angle of
  // their own round it, seen from a little below, and half in the plane,
  // which keeps the curls at the head's rim. All in the plane, the head
  // showed two lobes with dark between them where the jet up the middle
  // swept it clean; all round the axis, a smooth ball.
  for (let i = 0; i < S.n; i++) {
    const age = S.age[i];
    if (age < 0) continue;
    const u = age / S.life[i], u2 = u * u, env = min(1, age * 12) * (1 - u2 * u2);
    const kind = S.kind[i], ax = S.BX[S.bid[i]], r = S.x[i] - ax;
    const x = ax + r * S.ca[i], y = S.y[i] + r * S.sa[i] * TILT;
    if (kind === SPECK) splat(SP, x, y, S.w[i] * env);
    else if (kind === MICA) {
      // A flake only shows when it turns to the light: a swell a few times
      // a second, sharpened so most of the time it is dark. Flakes add no
      // body to the cloud, so Shimmer leaves its size alone.
      const tw = 0.5 + 0.5 * sin(S.ph[i] + (3 + 2 * sin(S.ph[i] * 3)) * T);
      const t4 = tw * tw * tw * tw;
      splat(G, x, y, env * t4 * t4 * (0.8 + 1.2 * sh));
    } else {
      // Powder older than a second and a half goes into a softer layer,
      // so the trails behind the head spread into haze.
      const old = sm(1, 2.5, age);
      if (old < 1) splat(D, x, y, S.w[i] * env * (1 - old));
      if (old > 0) splat(O, x, y, S.w[i] * env * old);
    }
  }
  blur(D, tmp, 2);
  blur(D, tmp, 1);
  blur(O, tmp, 3);
  blur(O, tmp, 2);
  for (let p = 0; p < N; p++) D[p] += O[p];
  // Pigment, its pale lit side, the pearl tint mica gives the lit side, and
  // the glint colour. Coral to lemon read brown and olive when dim, so there
  // the pigment is paler.
  const h = S.hue + 0.86, hf = h - floor(h), warm = sm(0.0, 0.05, hf) * (1 - sm(0.17, 0.24, hf));
  hsv(h, 0.82 - 0.32 * warm, 1, col, 0);
  hsv(h - 0.02, 0.32 - 0.12 * warm, 1, col, 3);
  hsv(h + 0.08, 0.15, 1, col, 6);
  hsv(h + 0.2, 0.4, 1, col, 9);
  // Warm powder's faint end is lifted too: a fading peach cloud read as
  // milky coffee.
  const gain = GAIN + 0.3 * warm, ga = 1 - 0.4 * warm;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const d = D[p], a = (1 - exp(-d * gain)) ** ga, s = min(1.4, SP[p]), g = G[p];
      // The studio light is above and to the left: where the cloud thickens
      // downward or rightward its surface faces the light. Without it the
      // head was a flat blob of colour.
      const dn = y < H - 1 ? D[p + W] : d, up = y > 0 ? D[p - W] : d, rt = x < W - 1 ? D[p + 1] : d, lf = x > 0 ? D[p - 1] : d;
      const nrm = cl(((dn - up) * 0.8 + (rt - lf) * 0.4) / (d + 0.5), -1, 1), lit = 0.98 + 0.4 * nrm;
      // Thin powder glows in the pigment, thick powder goes pale and bright,
      // and with mica its lit side turns pearl.
      const wt = a * a * cl(0.6 + 0.6 * nrm, 0, 1), pm = sh * 0.9 * cl(0.55 + nrm, 0, 1);
      let r = 0, gg = 0, b = 0;
      for (let c = 0; c < 3; c++) {
        const lc = col[3 + c] * (1 - pm) + col[9 + c] * pm, v = (col[c] * (1 - wt) + lc * wt) * a * lit;
        // Specks are pigment, glints are light.
        const o = v + col[c] * s * 0.8 + col[6 + c] * g;
        if (c === 0) r = o;
        else if (c === 1) gg = o;
        else b = o;
      }
      if (warm > 0) {
        // Dim peach and lemon read brown and olive, so as warm powder dims
        // it greys toward a pale dust of the same level instead.
        const m = max(r, gg, b), k = 0.9 * warm * sqrt(1 - min(1, m / 0.85));
        r += (m - r) * k;
        gg += (m - gg) * k;
        b += (m - b) * k;
      }
      display.setPixel(x, y, knee(r * 255), knee(gg * 255), knee(b * 255));
    }
}

function knee(v) {
  return v < 200 ? v : 255 - 55 * exp(-(v - 200) / 55);
}
