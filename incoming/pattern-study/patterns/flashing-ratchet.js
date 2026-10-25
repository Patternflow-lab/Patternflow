// ===== Patternflow pattern =====
// Title:   Flashing Ratchet
// Family:  sim
// Idea:    Three thousand Brownian particles drift in a sawtooth potential of eight teeth stacked up the panel that switches on and off, bunching into glowing lines under each steep ridge while it is on and spreading into fog while it is off, and because each well's minimum sits 3.2 LEDs below its near ridge and 12.8 above its far one, more of every blob lands a well higher when the potential comes back, so a gold-marked cloud climbs against a downward load that would drag it down with the potential held on or held off.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Flashing ratchet (Armand Ajdari and Jacques Prost, 1992), Parrondo's paradox (Juan Parrondo, 1996), pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Period=0.8..3.2, Load=0.25..1.5
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a sky blue cloud, a gold marked cloud with gold marks on the edges, and violet ridges; at 0.25 violet, green and red; at 0.5 orange, blue and lime; at 0.75 green, pink and cyan.
// Knob 2: Speed. Model time runs at Speed / 2 of real time. At 2 the opening flash lasts 0.8 s and the marked cloud climbs 2 LEDs a second; at 0.2 everything is ten times slower and at 3 half as fast again.
// Knob 3: Period. One off-and-on cycle in seconds of model time, off for the first 40% and on for the rest. At 0.8 a blob spreads 5.7 LEDs (one standard deviation) before the wells come back and the marked cloud climbs 0.127 teeth a second at the opening load; at 1.6 it climbs 0.058, and at 3.2 the blobs spread 11.3 LEDs, most of a tooth, the climb falls to 0.0125 and from half the stall load up the load wins.
// Knob 4: Load. The steady downward force, as a share of the load that stalls the flashing at the 0.8 s period, 5.15 LEDs a second of free fall. At the opening 0.25 the flashing climbs 0.127 teeth a second while the potential held on loses 0.0022 and held off 0.081; at 0.75 it climbs 0.043, at 1 it stands still, and at 1.5 (7.7 LEDs a second) the flashing too goes down, 0.089 teeth a second.
// Buttons: K1 tap steps through the three games: flashing, the potential held on, the potential held off, and back to flashing. Held on, the marked cloud stays in its lines; held off, it sinks with the load.
//
// Checked with this file's own update() over 300 s of model time for each
// game and load, 3000 particles, the period at 0.8 s and the load clamp
// opened down to 0. Mean velocity in teeth a second, up positive, with one
// standard error in the last digit in brackets:
//   load    flashing          held on            held off
//   0       +0.1681 (5)       +0.0001 (1)        -0.0011 (7)
//   0.25    +0.1270 (5)       -0.0022 (1)        -0.0811 (7)
//   0.5     +0.0851 (5)       -0.0048 (1)        -0.1613 (6)
//   0.75    +0.0425 (5)       -0.0078 (1)        -0.2412 (7)
//   1       +0.0002 (5)       -0.0117 (1)        -0.3219 (7)
//   1.5     -0.0893 (5)       -0.0216 (2)        -0.4827 (7)
// So from load 0 to 1 both games lose and switching between them wins:
// Parrondo's paradox. Held off, the speed is the load's own F / 16 to
// within the error; held on, particles leave a well only by crossing a
// ridge 7.5 D high, which the load lowers on the down side. With no load
// the held potential makes no current, as it must in equilibrium.

const W = 64, H = 128, N = W * H;
const { floor, round, ceil, min, max, abs, sqrt, exp, log, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The sawtooth: 8 teeth of L = 16 LEDs up the panel. Measured down the
// panel from a minimum, V rises gently for (1 - A) L = 12.8 LEDs to V0,
// then falls steeply over A L = 3.2 LEDs to the next minimum. So the
// steep side of every well faces up, and the near maximum is 3.2 LEDs
// above a particle sitting in it, the far one 12.8 below.
const L = 16, A = 0.2, NT = H / L;
// Diffusion D in LED^2 per second of model time, the well depth V0 = 7.5 D
// (in units where the mobility is 1, so a force is the speed it gives).
const D = 50, V0 = 7.5 * D;
const FG = V0 / ((1 - A) * L), FS = V0 / (A * L);
// Off for this share of each period, on for the rest.
const OFF = 0.4;
// The stall load at the shortest period, measured with this code (LED/s).
const FSTALL = 5.15;
// Steps while the potential is on: at most HMAX of model time, so the steep
// side's push in one step stays under a tenth of its width.
const HMAX = 1 / 480;
const NP = 3000;
// Pulse labelling: every particle in one well is marked and lit, and the
// marked cloud is followed until its spread passes 3 teeth, it has moved 5
// or 36 s have gone by; then it fades over FADE s and another well is
// marked, the bottom one if the last cloud went up and the top one if it
// fell. The marks on the edges are the cloud's start and its mean now.
const SPREAD = 3 * L, TRAVEL = 5 * L, TMAX = 36, FADE = 1.5;

// A table of normal deviates, each with its negative so the noise has no
// skew, scaled to variance 1 exactly. A table of 4096 plain draws had
// enough skew to make the held potential lift particles: 1890 teeth up
// against 1413 down in 200 s.
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (((h ^ (h >>> 16)) >>> 0) + 0.5) / 4294967296;
};
const NG = 4096, G = new Float32Array(NG);
{
  let v = 0;
  for (let i = 0; i < NG; i += 2) {
    G[i] = sqrt(-2 * log(hash(i))) * cos(2 * PI * hash(i + 77777));
    G[i + 1] = -G[i];
    v += 2 * G[i] * G[i];
  }
  v = sqrt(v / NG);
  for (let i = 0; i < NG; i++) G[i] /= v;
}
const gn = () => G[(Math.random() * NG) | 0];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const X = new Float32Array(NP), Y = new Float32Array(NP);
  // The start: bunched in the wells as if the potential had been on, each
  // line with its thermal tail on the gentle side below it.
  for (let i = 0; i < NP; i++) {
    X[i] = Math.random() * W;
    Y[i] = (floor(Math.random() * NT) * L - log(1 - Math.random()) * (D / FG) + H) % H;
  }
  params.s = {
    X, Y, M: new Uint8Array(NP), LAP: new Int16Array(NP), rng: (Math.random() * 4294967295) | 1, t: 0, ph: 0, hold: 0, on: true,
    hue: 0, speed: 2, per: 0.8, load: 0.25,
    age: 0, y0: 0, mean: 0, sd: 0, old: 0,
    da: new Float32Array(N), db: new Float32Array(N), tmp: new Float32Array(N),
    col: new Float32Array(9),
  };
  mark(params.s, NT - 1);
}

// Marks every particle in the basin of well k, the stretch from the
// maximum A L above its minimum to the one (1 - A) L below; the cloud
// marked before fades.
function mark(S, k) {
  const { Y, M, LAP } = S, lo = k * L - A * L, hi = k * L + (1 - A) * L;
  let m = 0, n = 0;
  for (let i = 0; i < NP; i++) {
    M[i] = M[i] === 1 ? 2 : M[i];
    LAP[i] = 0;
    let y = Y[i];
    if (y >= hi) y -= H;
    if (y >= lo && y < hi) {
      M[i] = 1;
      m += y;
      n++;
    }
  }
  S.old = M.some((v) => v === 2) ? 1 : 0;
  S.age = 0;
  S.y0 = n ? m / n : k * L;
  S.mean = S.sd = 0;
}

// Moves every particle through tau of model time with the potential off:
// free diffusion plus the load, one exact Gaussian step.
function stepOff(S, tau, F) {
  const { X, Y } = S, a = sqrt(2 * D * tau), dy = F * tau;
  for (let i = 0; i < NP; i++) {
    Y[i] += dy + a * gn();
    X[i] += a * gn();
  }
}

// The same with the potential on, in steps of at most HMAX along the height.
// Each step is an Euler-Maruyama proposal; one that stays on the same
// straight piece of V is exact and taken, one that crosses a corner is put
// to the Metropolis test with the Boltzmann weight of V - F y. So while the
// potential is held, the steps keep that weight exactly and cannot make a
// current of their own. Plain Euler steps of this size pushed particles over
// the steep side more often than back: with the potential held on and no
// load, 3148 teeth climbed against 2151 fallen in 400 s; with the test,
// 2430 against 2359.
function stepOn(S, tau, F) {
  const { X, Y } = S, n = ceil(tau / HMAX - 1e-9), h = tau / n, a = sqrt(2 * D * h), ax = sqrt(2 * D * tau);
  const up = (F - FG) * h, dn = (F + FS) * h, edge = 1 - A, i4 = 1 / (4 * D * h);
  let r = S.rng;
  for (let i = 0; i < NP; i++) {
    let y = Y[i], k = floor(y / L), g = y / L - k < edge, f = g ? up : dn;
    for (let j = 0; j < n; j++) {
      r ^= r << 13;
      r ^= r >>> 17;
      r ^= r << 5;
      const yp = y + f + a * G[r & 4095], up2 = yp / L, k2 = floor(up2), s2 = up2 - k2, g2 = s2 < edge;
      if (k2 === k && g2 === g) {
        y = yp;
        continue;
      }
      // Across a corner: V at both ends, in units of V0, and the test.
      const s1 = y / L - k, v1 = g ? s1 / edge : (1 - s1) / A, v2 = g2 ? s2 / edge : (1 - s2) / A, f2 = g2 ? up : dn;
      const d = yp - y, la = (-(v2 - v1) * V0 + F * d) / D + ((d - f) ** 2 - (d + f2) ** 2) * i4;
      r ^= r << 13;
      r ^= r >>> 17;
      r ^= r << 5;
      if (la >= 0 || (r >>> 0) / 4294967296 < exp(la)) {
        y = yp;
        k = k2;
        g = g2;
        f = f2;
      }
    }
    Y[i] = y;
    X[i] += ax * gn();
  }
  S.rng = r;
}

// Wraps the height, counting laps so the marked cloud can be followed
// unwrapped, reflects the sides, and measures the marked cloud: its mean
// displacement and its spread, in LEDs, down positive.
function edges(S) {
  const { X, Y, M, LAP } = S;
  let n = 0, m = 0, m2 = 0;
  for (let i = 0; i < NP; i++) {
    let y = Y[i];
    if (y < 0 || y >= H) {
      const q = floor(y / H);
      y -= q * H;
      LAP[i] += q;
    }
    Y[i] = y;
    let x = X[i];
    if (x < 0) x = -x;
    if (x >= W) x = 2 * W - x - 1e-3;
    X[i] = cl(x, 0, W - 1e-3);
    if (M[i] === 1) {
      const u = y + LAP[i] * H;
      n++;
      m += u;
      m2 += u * u;
    }
  }
  if (n) {
    m /= n;
    S.mean = m - S.y0;
    S.sd = sqrt(max(0, m2 / n - m * m));
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.8, 0.25];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.per = cl(k[2], 0.8, 3.2);
  S.load = cl(k[3], 0.25, 1.5);
  // K1 tap: flashing, then held on, then held off, then flashing again.
  if (input.btnPressed && input.btnPressed[0]) S.hold = (S.hold + 1) % 3;
  const F = S.load * FSTALL;
  let rem = (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  S.t += rem;
  S.age += rem;
  if (S.old) {
    S.old -= rem / FADE;
    if (S.old <= 0) {
      S.old = 0;
      for (let i = 0; i < NP; i++) if (S.M[i] === 2) S.M[i] = 0;
    }
  }
  while (rem > 1e-9) {
    let on, piece;
    if (S.hold) {
      on = S.hold === 1;
      piece = rem;
    } else {
      // The period starts with the potential off.
      const cut = OFF * S.per;
      on = S.ph >= cut;
      piece = min(rem, (on ? S.per : cut) - S.ph);
      S.ph += piece;
      if (S.ph >= S.per - 1e-9) S.ph = 0;
    }
    if (on) stepOn(S, piece, F);
    else stepOff(S, piece, F);
    rem -= piece;
  }
  S.on = S.hold ? S.hold === 1 : S.ph >= OFF * S.per;
  edges(S);
  if (S.sd > SPREAD || abs(S.mean) > TRAVEL || S.age > TMAX) mark(S, S.mean > 0 ? 1 : NT - 1);
}

// 1 - exp(-n) in steps of 1/128 of n, the light of n particles' worth.
const NTONE = 1280, TONE = new Float32Array(NTONE);
for (let i = 0; i < NTONE; i++) TONE[i] = 1 - exp(-i / 128);

// Separable blur [1 4 6 4 1] / 16, wrapping in height, clamped at the sides.
function blur(src, tmp) {
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const a = src[r + max(0, x - 2)], b = src[r + max(0, x - 1)], c = src[r + x], d = src[r + min(W - 1, x + 1)], e = src[r + min(W - 1, x + 2)];
      tmp[r + x] = (a + e + 4 * (b + d) + 6 * c) / 16;
    }
  }
  for (let y = 0; y < H; y++) {
    const r0 = ((y + H - 2) % H) * W, r1 = ((y + H - 1) % H) * W, r2 = y * W, r3 = ((y + 1) % H) * W, r4 = ((y + 2) % H) * W;
    for (let x = 0; x < W; x++) src[r2 + x] = (tmp[r0 + x] + tmp[r4 + x] + 4 * (tmp[r1 + x] + tmp[r3 + x]) + 6 * tmp[r2 + x]) / 16;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { X, Y, M, da, db, tmp, col } = S;
  da.fill(0);
  db.fill(0);
  // Each particle shared out over the four LEDs round it: the marked cloud
  // into its own grid, a fading one into both.
  for (let i = 0; i < NP; i++) {
    const x = X[i] - 0.5, y = Y[i] - 0.5, x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
    const xa = max(0, x0), xb = min(W - 1, x0 + 1), ya = ((y0 % H) + H) % H, yb = (ya + 1) % H;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const m = M[i], wb = m === 1 ? 1 : m === 2 ? S.old : 0, wa = 1 - wb;
    if (wa > 0) {
      da[ya * W + xa] += w00 * wa;
      da[ya * W + xb] += w10 * wa;
      da[yb * W + xa] += w01 * wa;
      da[yb * W + xb] += w11 * wa;
    }
    if (wb > 0) {
      db[ya * W + xa] += w00 * wb;
      db[ya * W + xb] += w10 * wb;
      db[yb * W + xa] += w01 * wb;
      db[yb * W + xb] += w11 * wb;
    }
  }
  blur(da, tmp);
  blur(db, tmp);
  // Colours: the cloud, the marked cloud and the field.
  hsv(0.55 + S.hue, 0.7, 0.78, col, 0);
  hsv(0.11 + S.hue, 0.75, 1, col, 3);
  hsv(0.76 + S.hue, 0.7, 1, col, 6);
  const GA = 1, GB = 2, FIELD = 0.3;
  for (let y = 0; y < H; y++) {
    // V at this row, 0 at a minimum and 1 at a maximum.
    let f = 0;
    if (S.on) {
      const u = (y + 0.5) / L, s = u - floor(u);
      const v = s < 1 - A ? s / (1 - A) : (1 - s) / A;
      f = FIELD * v * v;
    }
    for (let x = 0; x < W; x++) {
      const p = y * W + x, a = TONE[min(NTONE - 1, (da[p] * GA * 128) | 0)], b = TONE[min(NTONE - 1, (db[p] * GB * 128) | 0)], o = 1 - b;
      const r = col[6] * f * o + a * col[0] * o + b * col[3];
      const g = col[7] * f * o + a * col[1] * o + b * col[4];
      const bl = col[8] * f * o + a * col[2] * o + b * col[5];
      if (r + g + bl < 0.01) continue;
      // Each channel in steps of 4 of 255.
      display.setPixel(x, y, min(255, round(r * 63.75) * 4), min(255, round(g * 63.75) * 4), min(255, round(bl * 63.75) * 4));
    }
  }
  // Marks on both edges: where the marked cloud started, dim, and the
  // height of its mean now, which climbs while the flashing wins.
  tick(display, S.y0, 3, 0.4, col);
  tick(display, S.y0 + S.mean, 4, 1, col);
}

// A short bar on each edge at height y, shared between two rows.
function tick(display, y, len, v, col) {
  y = y - 0.5 - floor((y - 0.5) / H) * H;
  const y0 = floor(y), fy = y - y0;
  for (const [row, w] of [[y0, 1 - fy], [(y0 + 1) % H, fy]]) {
    const c = v * min(1, w * 1.6);
    if (c < 0.08) continue;
    for (let i = 0; i < len; i++)
      for (const x of [i, W - 1 - i]) display.setPixel(x, row, round(col[3] * c * 63.75) * 4, round(col[4] * c * 63.75) * 4, round(col[5] * c * 63.75) * 4);
  }
}
