// ===== Patternflow pattern =====
// Title:   Figure-Eight Orbit
// Family:  physics
// Idea:    Three equal masses under Newton's gravity chase one another round one figure eight standing the height of the panel, each a third of a period behind the next, integrated step by step from Chenciner and Montgomery's starting values with a faint line of the exact eight under them, and a kick to their starting velocities leaves the eight wobbling or breaks it into a tight binary and a body flung off the panel.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: figure-eight solution of the three-body problem (Cris Moore, 1993; Alain Chenciner and Richard Montgomery, 2000), pattern round 38
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Trail=0.33..2, Kick=0..1
//
// Knob 1: Hue. Turns the three bodies round the wheel together, a third of the wheel apart. At 0 azure, rose and lime; at 0.25 magenta, butter yellow and cyan; at 0.5 peach, sea green and violet; at 0.75 green, blue and red. A body that comes round to orange or yellow is paled and its tail kept near full brightness, so it never reads brown or olive.
// Knob 2: Speed. At 2 one period of the eight, 6.33 units of the orbit's own time, takes 6.3 seconds, and a body runs up to 67 LEDs a second through the crossing and slows to 25 at the far ends; at 0.2 a period takes 63 seconds, at 3 it takes 4.2.
// Knob 3: Trail. How long each tail is, in periods; a tail is 8 LEDs wide at its body and narrows to nothing at its end. At 0.33 each tail ends just at the next body, so the eight is three comets in three colours; from 1 the whole eight is drawn, each stretch in the colour of the body that passed it last; with a kick the older passes show under the newest, a band of eights 2 periods deep at 2.
// Knob 4: Kick. Pushes bodies 1 and 2 apart along the line between them at the start, then scales every velocity back to the old kinetic energy, so energy, momentum and angular momentum stay those of the eight. Up to 0.06 no kick: the exact eight, its energy within 1e-8 of the start for 200 periods. At 0.25 a push of 0.07, 5% of the fastest speed, and the eight wobbles; at 0.5 (0.18) it swings wide but holds; from about 0.65 (0.25) it holds a few periods and then two bodies pair off and the third is slung away; at 1 (0.45) a body leaves the panel in the first tenth of a period. The push keeps the symmetry of the starting line-up, which is why the eight survives so much of it. The three start again after a body has been off the panel 3 seconds, and 0.4 seconds after the knob comes to rest.
// Buttons: K1 tap nudges the running orbit: two bodies pushed apart by 0.05, or by the Kick if that is more, a different pair on each tap. Away from the starting line-up the eight is far less forgiving: one tap leaves it wobbling for a minute or more before it breaks, three taps a second apart break it in about 20 seconds.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, hypot, round, cbrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Chenciner and Montgomery's starting values, G = m = 1: body 3 at the
// crossing, bodies 1 and 2 opposite each other, both moving at half body 3's
// velocity the other way. The period is 6.32591398.
const X1 = 0.97000436, Y1 = -0.24308753, VX3 = -0.93240737, VY3 = -0.86473146, PERIOD = 6.32591398;
// Orbit to panel: the eight's long axis down the panel, SC LEDs to the unit.
// It reaches 1.081 along that axis and 0.358 across, so 115 by 38 LEDs.
const SC = 53, CX = 31.5, CY = 63.5;
// Under RS the pull is that of a uniform ball, so a close pass of a binary
// stays finite. The eight never comes closer than 0.69, so it never feels it.
const RS = 0.05;
// Step in orbit time: Yoshida's fourth-order leapfrog at H0, shortened by
// (r / 0.5)^1.5 when two bodies are closer than 0.5.
const H0 = 1 / 128;
const YW1 = 1 / (2 - cbrt(2)), YW0 = -cbrt(2) * YW1;
const YC = [YW1 / 2, (YW0 + YW1) / 2, (YW0 + YW1) / 2, YW1 / 2], YD = [YW1, YW0, YW1];
// Tail half-width at the head, in LEDs, and how far a body glows.
const HW = 3.6, GLOW = 6;
// Opening hues: azure, rose, lime.
const HUE0 = 0.58;
// Longest tail, in periods, and so the history the pattern keeps.
const LMAX = 2;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, trail: 0.33, kick: 0, kickSet: -1, kickWait: 0, begun: false,
    p: new Float64Array(6), v: new Float64Array(6), a: new Float64Array(6),
    clock: 0, carry: 0, out: 0, fade: 1, phase: 0, nudges: 0,
    // Per body and LED: when the body last passed (orbit time) and how close.
    tv: new Float32Array(3 * N).fill(-1e9), td: new Float32Array(3 * N).fill(99),
    lx: new Float32Array(3), ly: new Float32Array(3), warm: [0, 0, 0],
    ref: new Float32Array(N), col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
  drawReference(params.s);
}

// Pull on each body; under RS the force grows linearly from the centre.
function accel(p, a) {
  a.fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) {
      const dx = p[2 * j] - p[2 * i], dy = p[2 * j + 1] - p[2 * i + 1], r = sqrt(dx * dx + dy * dy), q = max(r, RS);
      const f = 1 / (q * q * q);
      a[2 * i] += dx * f;
      a[2 * i + 1] += dy * f;
      a[2 * j] -= dx * f;
      a[2 * j + 1] -= dy * f;
    }
}

function closest(p) {
  let m = 1e9;
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) m = min(m, hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]));
  return m;
}

// One step of Yoshida's fourth-order symplectic integrator: three leapfrogs
// of h w1, h w0, h w1, with w0 negative.
function step(p, v, a, h) {
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 6; i++) p[i] += YC[s] * h * v[i];
    accel(p, a);
    for (let i = 0; i < 6; i++) v[i] += YD[s] * h * a[i];
  }
  for (let i = 0; i < 6; i++) p[i] += YC[3] * h * v[i];
}

const stepLength = (p) => H0 * min(1, (max(closest(p), RS) / 0.5) ** 1.5);

// The kick: bodies i and j pushed apart along the line between them, each
// by eps, and then every velocity scaled back to the kinetic energy before
// the push. Positions do not move, so the energy stays what it was; the
// momentum stays zero and the angular momentum stays zero too, as for the
// eight itself, so only the shape of the motion changes.
function push(S, i, j, eps) {
  const { p, v } = S, dx = p[2 * i] - p[2 * j], dy = p[2 * i + 1] - p[2 * j + 1], r = hypot(dx, dy) || 1;
  let k0 = 0, k1 = 0;
  for (let n = 0; n < 6; n++) k0 += v[n] * v[n];
  v[2 * i] += (eps * dx) / r;
  v[2 * i + 1] += (eps * dy) / r;
  v[2 * j] -= (eps * dx) / r;
  v[2 * j + 1] -= (eps * dy) / r;
  for (let n = 0; n < 6; n++) k1 += v[n] * v[n];
  const f = sqrt(k0 / k1);
  for (let n = 0; n < 6; n++) v[n] *= f;
}

// Kick 0..1 to eps: nothing up to 0.06, then up to 0.45.
const epsOf = (k) => 0.45 * (max(0, k - 0.06) / 0.94) ** 1.2;

function initial(S) {
  const { p, v } = S;
  p.set([X1, Y1, -X1, -Y1, 0, 0]);
  v.set([-VX3 / 2, -VY3 / 2, -VX3 / 2, -VY3 / 2, VX3, VY3]);
  push(S, 0, 1, epsOf(S.kick));
  S.kickSet = S.kick;
}

const toCol = (y) => CX + y * SC, toRow = (x) => CY - x * SC;

// A tail at an LED: age a in orbit time, distance d in LEDs, tail length L.
// It narrows from HW at the head to nothing at its end, and dims from full
// at the head to 0.6 a third of a period behind it and 0.55 after that.
function tailCover(a, d, L) {
  if (a < 0 || a >= L) return 0;
  return cl((HW + 0.5) * (1 - a / L) ** 1.5 - d + 0.5, 0, 1);
}
const tailBright = (a) => 0.55 + 0.45 * exp(-a / (0.15 * PERIOD));
const tailValue = (a, d, L) => tailCover(a, d, L) * tailBright(a);

// Mark the LEDs round body k at orbit time t. Within one pass the closest
// approach is kept; a later pass takes the LED when it would light it more.
function deposit(S, k, t) {
  const bx = toCol(S.p[2 * k + 1]), by = toRow(S.p[2 * k]), R = HW + 1.5, L = LMAX * PERIOD;
  if (bx < -R || bx > W + R || by < -R || by > H + R) return;
  const o = k * N, tv = S.tv, td = S.td;
  for (let y = max(0, floor(by - R)); y <= min(H - 1, floor(by + R)); y++)
    for (let x = max(0, floor(bx - R)); x <= min(W - 1, floor(bx + R)); x++) {
      const d = hypot(x + 0.5 - bx, y + 0.5 - by);
      if (d > R) continue;
      const q = o + y * W + x, t0 = tv[q];
      if (abs(t - t0) < 0.3) {
        if (d < td[q]) {
          tv[q] = t;
          td[q] = d;
        }
        continue;
      }
      const ref = max(t, t0), vNew = tailValue(ref - t, d, L), vOld = tailValue(ref - t0, td[q], L);
      if (vNew > vOld || (vNew === vOld && t > t0)) {
        tv[q] = t;
        td[q] = d;
      }
    }
}

// Deposit body k if it has moved half an LED since it last did.
function trace(S, t) {
  for (let k = 0; k < 3; k++) {
    const bx = toCol(S.p[2 * k + 1]), by = toRow(S.p[2 * k]);
    if (hypot(bx - S.lx[k], by - S.ly[k]) < 0.5) continue;
    S.lx[k] = bx;
    S.ly[k] = by;
    deposit(S, k, t);
  }
}

const farthest = (p) => max(hypot(p[0], p[1]), hypot(p[2], p[3]), hypot(p[4], p[5]));

// Start (or start again): the starting line-up with the current kick, and
// its own past drawn behind it by running the orbit backward for up to LMAX
// periods, or until a body would come in from off the panel.
function restart(S) {
  S.tv.fill(-1e9);
  S.td.fill(99);
  S.clock = 0;
  S.carry = 0;
  S.out = 0;
  initial(S);
  const { p, v, a } = S;
  const p0 = Float64Array.from(p), v0 = Float64Array.from(v);
  S.lx.fill(-99);
  S.ly.fill(-99);
  let t = 0;
  while (t > -LMAX * PERIOD && farthest(p) < 1.4) {
    trace(S, t);
    const h = stepLength(p);
    step(p, v, a, -h);
    t -= h;
  }
  p.set(p0);
  v.set(v0);
  S.lx.fill(-99);
  S.ly.fill(-99);
  trace(S, 0);
}

// Whole steps only, the remainder carried to the next frame, so at the
// opening the step never changes and the integrator stays symplectic.
function advance(S, dt) {
  const { p, v, a } = S;
  S.carry += dt;
  for (let h = stepLength(p); S.carry >= h; h = stepLength(p)) {
    step(p, v, a, h);
    S.carry -= h;
    S.clock += h;
    trace(S, S.clock);
  }
}

// The exact eight, sampled over one period, as a faint line under the tails.
function drawReference(S) {
  const p = Float64Array.from([X1, Y1, -X1, -Y1, 0, 0]);
  const v = Float64Array.from([-VX3 / 2, -VY3 / 2, -VX3 / 2, -VY3 / 2, VX3, VY3]), a = new Float64Array(6);
  const n = 1600, h = PERIOD / n, ref = S.ref;
  for (let s = 0; s < n; s++) {
    const bx = toCol(p[1]), by = toRow(p[0]);
    for (let y = max(0, floor(by - 1)); y <= min(H - 1, floor(by + 1)); y++)
      for (let x = max(0, floor(bx - 1)); x <= min(W - 1, floor(bx + 1)); x++) {
        const c = cl(1.1 - hypot(x + 0.5 - bx, y + 0.5 - by), 0, 1);
        if (c > ref[y * W + x]) ref[y * W + x] = c;
      }
    step(p, v, a, h);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.33, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.trail = cl(k[2], 0.33, 2);
  S.kick = cl(k[3], 0, 1);
  if (!S.begun) {
    restart(S);
    S.begun = true;
  }
  // A turned Kick starts the three again once the knob has rested 0.4 s,
  // fading the old orbit out over 0.5 s and the new one in.
  if (abs(S.kick - S.kickSet) > 0.004) {
    S.kickWait += d;
    if (S.kickWait > 0.4 && S.phase === 0) S.phase = -1;
  } else S.kickWait = 0;
  if (input.btnPressed && input.btnPressed[0] && S.phase === 0) {
    const pair = S.nudges++ % 3;
    push(S, pair, (pair + 1) % 3, max(0.05, epsOf(S.kick)));
  }
  // At Speed 2 the orbit's clock runs 1 unit a second.
  advance(S, d * S.speed * 0.5);
  // Off the panel: a body more than 1.35 from the centre.
  if (farthest(S.p) > 1.35) S.out += d;
  else S.out = max(0, S.out - d);
  if ((S.out > 3 || farthest(S.p) > 8) && S.phase === 0) S.phase = -1;
  if (S.phase < 0) {
    S.fade -= d / 0.5;
    if (S.fade <= 0) {
      S.fade = 0;
      restart(S);
      S.kickWait = 0;
      S.phase = 1;
    }
  } else if (S.phase > 0) {
    S.fade += d / 0.5;
    if (S.fade >= 1) {
      S.fade = 1;
      S.phase = 0;
    }
  }
}

function palette(S) {
  for (let k = 0; k < 3; k++) {
    const h = S.hue + HUE0 + k / 3, hh = h - floor(h);
    // Orange to yellow-green: paler and kept at full value, so a tail never
    // reads brown or olive.
    const warm = sm(0.02, 0.08, hh) * (1 - sm(0.2, 0.27, hh));
    hsv(h, 0.85 - 0.3 * warm, 1, S.col[k]);
    S.warm[k] = warm;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const { tv, td, ref, col, clock, fade } = S, L = S.trail * PERIOD;
  const bx = [0, 0, 0], by = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    bx[k] = toCol(S.p[2 * k + 1]);
    by[k] = toRow(S.p[2 * k]);
  }
  const ord = [0, 1, 2], ag = [0, 0, 0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // The faint reference eight, then the tails painted oldest first, so
      // the newest pass lies on top.
      let r = 0.13 * ref[p], g = 0.13 * ref[p], b = 0.16 * ref[p];
      for (let k = 0; k < 3; k++) ag[k] = clock - tv[k * N + p];
      ord[0] = 0;
      ord[1] = 1;
      ord[2] = 2;
      if (ag[ord[0]] < ag[ord[1]]) [ord[0], ord[1]] = [ord[1], ord[0]];
      if (ag[ord[1]] < ag[ord[2]]) [ord[1], ord[2]] = [ord[2], ord[1]];
      if (ag[ord[0]] < ag[ord[1]]) [ord[0], ord[1]] = [ord[1], ord[0]];
      for (let n = 0; n < 3; n++) {
        const k = ord[n], age = ag[k], d = td[k * N + p], al = tailCover(age, d, L) * fade;
        if (al <= 0) continue;
        const c = col[k], lv = 1 - (1 - tailBright(age)) * (1 - 0.8 * S.warm[k]), wh = 0.5 * (1 - age / L) ** 8 * cl(1 - d / HW, 0, 1);
        r += ((c[0] + (1 - c[0]) * wh) * lv - r) * al;
        g += ((c[1] + (1 - c[1]) * wh) * lv - g) * al;
        b += ((c[2] + (1 - c[2]) * wh) * lv - b) * al;
      }
      // The bodies: a white core in a glow of the body's colour.
      for (let k = 0; k < 3; k++) {
        const dx = x + 0.5 - bx[k], dy = y + 0.5 - by[k], d2 = dx * dx + dy * dy;
        if (d2 >= GLOW * GLOW) continue;
        const dd = sqrt(d2), halo = 0.7 * fade * (1 - dd / GLOW) ** 1.5, core = sm(2.8, 1.4, dd) * fade, c = col[k];
        r = 1 - (1 - r) * (1 - c[0] * halo);
        g = 1 - (1 - g) * (1 - c[1] * halo);
        b = 1 - (1 - b) * (1 - c[2] * halo);
        r += (1 - r) * core;
        g += (1 - g) * core;
        b += (1 - b) * core;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
}

