// ===== Patternflow pattern =====
// Title:   Setting Mist
// Family:  cosmetic
// Idea:    Puffs of setting spray burst in from a nozzle just past the left edge, each a cone of micro-droplets that blooms into a soft cloud, rolls and billows on the air, drifts across the deep panel and settles as it fades, with droplets catching the light as soft glints.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 31, after a setting spray misted across a face
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spray=0..1, Droplets=0..1
//
// Knob 1: Hue. Turns the mist and the deep ground behind it round the whole colour wheel together, opening on aqua; round orange and gold the ground turns navy, so the mist never sits on brown.
// Knob 2: Speed. How fast everything happens: at 2 a puff blooms in about a third of a second and its cloud drifts and fades over three or four; at 0.2 it all runs ten times slower.
// Knob 3: Spray. How often and how hard the nozzle fires: at 0 a puff about every second, now and then two at once; at 1 about three a second, bigger and more often doubled, until the mist fills the panel.
// Knob 4: Droplets. How fine the mist is, from a soft haze with small glints at 0 to a coarse spray at 1 where the single droplets show as dots and flash.
// Buttons: K1 tap fires a big double puff.

const W = 64, H = 128, N = W * H;
const MAXP = 6000;
const { min, max, floor, sin, cos, exp, abs, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The air: a stream function made of six travelling waves, 14 to 40 LEDs
// long. Its curl moves the mist without bunching it, so the clouds roll.
// [wavelength, direction, speed of travel, amplitude]
const WAVES = [
  [40, 0.3, 0.6, 1.0],
  [31, 1.9, -0.8, 0.9],
  [24, 3.6, 0.9, 0.8],
  [19, 4.9, -1.1, 0.7],
  [16, 0.9, 1.3, 0.6],
  [14, 2.7, -1.5, 0.5],
].map(([l, a, w, m], j) => {
  const k = (2 * PI) / l;
  return [k * cos(a), k * sin(a), w, (m * 4.2) / k, j * 2.4];
});
// The flow is worked out on a grid every 4 LEDs and read off between.
const GS = 4, GX = W / GS + 2, GY = H / GS + 2;
// The ground is lit a little from the upper right: its level, 0..1.
const BGL = new Float32Array(N);
for (let p = 0; p < N; p++) {
  const lx = (p % W) - 60, ly = floor(p / W) - 20;
  BGL[p] = (26 + 26 * exp(-(lx * lx + ly * ly) / 5000)) / 255;
}
// Round orange and yellow the ground turns to deep navy, given at full
// brightness like the hue colour it replaces.
const NAVY = [60, 95, 255];
// Puffs are kept in a ring of NP, long enough for every cloud in the air.
const NP = 48;

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
    x: F(MAXP), y: F(MAXP), vx: F(MAXP), vy: F(MAXP), age: F(MAXP), life: F(MAXP), w: F(MAXP), gp: F(MAXP), gr: F(MAXP), dr: new Uint8Array(MAXP), pid: new Uint8Array(MAXP), ex: F(MAXP), ey: F(MAXP),
    n: 0, T: 0, next: 0.3, nz: 0, puffs: [], slot: 0,
    P0: F(NP).fill(-99), PY: F(NP), AX: F(NP), AY: F(NP), PL: F(NP), PG: F(NP), PR: F(NP),
    U: F(GX * GY), V: F(GX * GY), D: F(N), Y: F(N), G: F(N), tmp: F(N), buf: F(N * 3), col: F(12),
    hue: 0, spray: 0, drop: 0.06, started: false,
  };
}

// A puff: the nozzle at height y, aimed at angle a (0 points straight right),
// size s. It sprays for a fifth of a second. Its front rolls up like a smoke
// ring: two eddies either side of the axis, carried out to reach PL and
// slowing, which curl the cloud back on itself into billows.
function puff(S, y, a, s, delay) {
  const q = (S.slot = (S.slot + 1) % NP);
  S.P0[q] = S.T + delay;
  S.PY[q] = y;
  S.AX[q] = cos(a);
  S.AY[q] = sin(a);
  S.PL[q] = (36 + 12 * s) * (0.85 + 0.3 * rnd());
  S.PR[q] = 5 + 4 * s;
  S.PG[q] = (220 + 100 * s) * (0.45 + 0.55 * rnd());
  S.puffs.push({ q, y, a, s, t: -delay, left: round(380 * s), spread: 0.3 + 0.1 * s });
}

// The hand moves the bottle up and down the face: each puff comes from a new
// height, aimed a little toward the middle of the panel.
function fire(S, big) {
  S.nz += 0.9 + rnd() * 0.8;
  const y = 64 + 44 * sin(S.nz * 1.3) + (rnd() - 0.5) * 14;
  const a = -0.45 * ((y - 64) / 64) + (rnd() - 0.5) * 0.3;
  const s = big ? 2.2 : (1 + 0.7 * S.spray) * (0.8 + 0.4 * rnd());
  puff(S, y, a, s, 0);
  if (big || rnd() < 0.22 + 0.3 * S.spray) {
    const y2 = cl(y + (y < 64 ? 1 : -1) * (14 + rnd() * 14), 8, H - 8);
    puff(S, y2, -0.45 * ((y2 - 64) / 64) + (rnd() - 0.5) * 0.3, big ? 2 : s * (0.7 + 0.3 * rnd()), 0.16 + rnd() * 0.12);
  }
}

function emit(S, p, k) {
  for (let j = 0; j < k && S.n < MAXP; j++) {
    const i = S.n++;
    // Droplets leave the nozzle in a cone, faster along its axis.
    const off = (rnd() + rnd() + rnd() - 1.5) * 2 * p.spread;
    const a = p.a + off, v = (80 + 160 * rnd() * rnd()) * (0.85 + 0.15 * p.s) * (1 - 0.5 * abs(off));
    // Each leaves at its own moment within the frame, so the burst does not
    // start as one bright knot.
    const lag = rnd() * 0.035;
    S.x[i] = -3 + v * cos(a) * lag;
    S.y[i] = p.y + (rnd() - 0.5) * 1.5 + v * sin(a) * lag;
    S.vx[i] = v * cos(a);
    S.vy[i] = v * sin(a);
    S.age[i] = 0;
    S.life[i] = 2.6 + 1.8 * rnd();
    S.w[i] = 0.5 + 0.4 * rnd();
    S.gp[i] = rnd() * 2 * PI;
    S.gr[i] = 2 + 4 * rnd();
    S.dr[i] = rnd() < 0.3 + 0.3 * S.drop ? 1 : 0;
    S.pid[i] = p.q;
    // Each droplet also wanders off on its own, so the cloud keeps opening.
    const e = rnd() * 2 * PI, es = 3 + 6 * rnd();
    S.ex[i] = es * cos(e);
    S.ey[i] = es * sin(e);
  }
}

function kill(S, i) {
  const j = --S.n;
  S.x[i] = S.x[j];
  S.y[i] = S.y[j];
  S.vx[i] = S.vx[j];
  S.vy[i] = S.vy[j];
  S.age[i] = S.age[j];
  S.life[i] = S.life[j];
  S.w[i] = S.w[j];
  S.gp[i] = S.gp[j];
  S.gr[i] = S.gr[j];
  S.dr[i] = S.dr[j];
  S.pid[i] = S.pid[j];
  S.ex[i] = S.ex[j];
  S.ey[i] = S.ey[j];
}

function flow(S) {
  const T = S.T, U = S.U, V = S.V;
  for (let gy = 0; gy < GY; gy++)
    for (let gx = 0; gx < GX; gx++) {
      const x = (gx - 1) * GS, y = (gy - 1) * GS;
      let u = 0, v = 0;
      for (const [kx, ky, w, m, ph] of WAVES) {
        const c = m * cos(kx * x + ky * y + w * T + ph);
        u += c * ky;
        v -= c * kx;
      }
      U[gy * GX + gx] = u;
      V[gy * GX + gx] = v;
    }
}

function step(S, st) {
  S.T += st;
  // Puffs on a clock: about one a second at Spray 0, three at Spray 1.
  S.next -= st;
  if (S.next <= 0) {
    fire(S, false);
    S.next = (1.15 - 0.8 * S.spray) * (0.75 + 0.5 * rnd());
  }
  for (let q = S.puffs.length - 1; q >= 0; q--) {
    const p = S.puffs[q];
    p.t += st;
    if (p.t < 0) continue;
    const k = p.t >= 0.2 ? p.left : min(p.left, round((p.left * st) / max(st, 0.2 - p.t + st)));
    emit(S, p, k);
    p.left -= k;
    if (p.left <= 0) S.puffs.splice(q, 1);
  }
  flow(S);
  const U = S.U, V = S.V, drag = 3.1 - 1.1 * S.drop, fall = 2.5 + 7 * S.drop;
  const kd = 1 - exp(-drag * st);
  for (let i = S.n - 1; i >= 0; i--) {
    const age = (S.age[i] += st);
    if (age > S.life[i] || S.x[i] > W + 8 || S.y[i] < -10 || S.y[i] > H + 10) {
      kill(S, i);
      continue;
    }
    const x = S.x[i], y = S.y[i];
    const fx = cl(x / GS + 1, 0, GX - 1.001), fy = cl(y / GS + 1, 0, GY - 1.001);
    const ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy, g = iy * GX + ix;
    const u = (U[g] * (1 - ax) + U[g + 1] * ax) * (1 - ay) + (U[g + GX] * (1 - ax) + U[g + GX + 1] * ax) * ay;
    const v = (V[g] * (1 - ax) + V[g + 1] * ax) * (1 - ay) + (V[g + GX] * (1 - ax) + V[g + GX + 1] * ax) * ay;
    // The young cloud churns hardest, then the air calms to a slow drift
    // away from the nozzle, and the droplets sink as they age.
    const churn = 1 + 1.6 * exp(-age * 1.6);
    let ux = u * churn + 4 + S.ex[i], uy = v * churn - 1.5 + S.ey[i];
    const q = S.pid[i], pa = S.T - S.P0[q];
    if (pa < 2.5) {
      // The puff's two eddies, in the frame of its axis.
      const ax = S.AX[q], ay = S.AY[q], f = S.PL[q] * (1 - exp(-pa / 0.22));
      const dx = x + 3 - ax * f, dy = y - S.PY[q] - ay * f;
      const sa = dx * ax + dy * ay, ta = dy * ax - dx * ay;
      const R = S.PR[q] * (1 + 0.8 * pa), rc = 9 + 6 * pa, G = S.PG[q] * exp(-pa / 0.8);
      const t1 = ta - R, t2 = ta + R;
      const g1 = G / (sa * sa + t1 * t1 + rc), g2 = -G / (sa * sa + t2 * t2 + rc);
      const vs = -(g1 * t1 + g2 * t2), vt = (g1 + g2) * sa;
      ux += vs * ax - vt * ay;
      uy += vs * ay + vt * ax;
    }
    S.vx[i] += (ux - S.vx[i]) * kd;
    S.vy[i] += (uy - S.vy[i]) * kd;
    S.x[i] = x + S.vx[i] * st;
    S.y[i] = y + (S.vy[i] + fall * min(1, age * 0.6)) * st;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1), rate = cl(k[1], 0.2, 3) / 2;
  S.hue = k[0] || 0;
  S.spray = cl(k[2], 0, 1);
  S.drop = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    // Open with the mist already in the air.
    for (let i = 0; i < 75; i++) step(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) fire(S, true);
  step(S, d * rate);
}

// Box blur of radius r along rows then columns, from a into a (b is scratch).
function blur(a, b, r) {
  if (r < 1) return;
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
  const D = S.D, Y = S.Y, G = S.G, tmp = S.tmp, buf = S.buf, col = S.col, T = S.T, dp = S.drop;
  D.fill(0);
  Y.fill(0);
  G.fill(0);
  for (let i = 0; i < S.n; i++) {
    const age = S.age[i], u = age / S.life[i];
    const env = min(1, age * 18) * (1 - u) * (1 - u);
    const x = S.x[i], y = S.y[i];
    // For the first quarter second the droplets still fly in a thin cone;
    // then they open into the soft cloud.
    const yo = age < 0.2 ? 1 : age > 0.6 ? 0 : (0.6 - age) / 0.4;
    if (yo > 0) {
      // Flying droplets smear into short streaks along their path.
      const wy = S.w[i] * env * yo * 0.06, sx = S.vx[i] * 0.007, sy = S.vy[i] * 0.007;
      for (let j = 0; j < 4; j++) splat(Y, x - sx * j, y - sy * j, wy);
    }
    splat(D, x, y, S.w[i] * env * (1 - yo));
    if (!S.dr[i]) continue;
    // A droplet glints when it turns the light to the eye: a smooth swell
    // a few times a second, so nothing strobes.
    const tw = 0.5 + 0.5 * sin(S.gp[i] + S.gr[i] * T);
    const t3 = tw * tw * tw, g = env * (1 - 0.8 * yo) * (0.04 + 0.3 * dp + (0.9 + dp) * t3 * t3 * t3);
    splat(G, x, y, g);
  }
  // Haze is soft and wide; droplets keep their shape.
  const r = 3 - round(2 * dp);
  blur(D, tmp, r);
  blur(D, tmp, r > 1 ? r - 1 : r);
  blur(Y, tmp, 1);
  blur(Y, tmp, 1);
  for (let p = 0; p < N; p++) D[p] += Y[p];
  if (dp > 0.3) {
    // Coarse spray: the droplets themselves as small soft dots in the cloud.
    for (let i = 0; i < S.n; i++) {
      if (!S.dr[i]) continue;
      const age = S.age[i], u = age / S.life[i];
      splat(D, S.x[i], S.y[i], (dp - 0.3) * 1.1 * min(1, age * 18) * (1 - u) * (1 - u));
    }
  }
  blur(G, tmp, dp > 0.6 ? 1 : 0);
  // Deep ground, mist tint and glint colour from the hue. Dark orange reads
  // brown and dark yellow olive, so round those hues the ground turns to
  // navy and the mist is lifted to a brighter gold.
  const h = S.hue + 0.48, hf = h - floor(h), wm = sm(hf / 0.06) * (1 - sm((hf - 0.17) / 0.1));
  hsv(h, 0.9, 255, col, 0);
  for (let c = 0; c < 3; c++) col[c] += (NAVY[c] - col[c]) * wm;
  hsv(h, 0.45 + 0.12 * wm, 255, col, 3);
  hsv(h, 0.12 + 0.25 * wm, 255, col, 6);
  const gain = (4.5 - 1.5 * dp) * (1 + 0.6 * wm);
  for (let y = 0, q = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++, q += 3) {
      const bg = BGL[p];
      const a = 1 - exp(-D[p] * gain), g = G[p];
      // Thin mist glows in the tint, thick mist goes to white.
      const wt = a * a;
      for (let c = 0; c < 3; c++) {
        const mist = col[3 + c] * (1 - wt) + 255 * wt;
        buf[q + c] = col[c] * bg * (1 - a) + mist * a * 0.92 + col[6 + c] * g;
      }
    }
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, knee(buf[p]), knee(buf[p + 1]), knee(buf[p + 2]));
}

function knee(v) {
  return v < 200 ? v : 255 - 55 * exp(-(v - 200) / 55);
}
