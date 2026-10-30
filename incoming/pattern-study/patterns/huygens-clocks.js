// ===== Patternflow pattern =====
// Title:   Huygens' Clocks
// Family:  rhythm
// Idea:    Two long pendulum clocks hang from one beam that can sway a little, each flashing as its escapement kicks it through the bottom of the swing and dropping that tick as a bar into its own lane of a falling record, so the two lanes start out ticking almost together, the beam rocks, and over six or seven swings the right clock's ticks slide until they fall exactly halfway between the left one's and the beam goes still: Huygens's anti-phase sympathy, or, with the clocks detuned past the lock, a slow slip of beats.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Huygens's odd sympathy of pendulum clocks (Christiaan Huygens, 1665), modelled as pendulums with an escapement kick on a moving support after Bennett, Schatz, Rockwood and Wiesenfeld (Huygens's clocks, Proc. R. Soc. A, 2002), pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Detune=-1..1, Coupling=0..1
//
// Knob 1: Hue. Turns both clocks round the wheel together. At 0 the left clock and its lane are amber and the right one azure; at 0.5 the left is blue and the right orange-red.
// Knob 2: Speed. How fast the model runs: half the knob in model seconds a second, so a swing takes 1 s at the opening 2, 10 s at 0.2 and 0.67 s at 3. The record falls 9 rows a model second and holds the last 6.4 swings.
// Knob 3: Detune. The two clocks' own rates, 1 - 0.15 x knob and 1 + 0.15 x knob of the common rate, so at 1 the right clock runs 35% faster. At 0 they lock half a swing apart. At the opening coupling they still lock at 0.3 (rates 9% apart), the right clock's ticks a third of a swing after the left's (before them at -0.3), and the faster clock swings half as wide as the other; from about 0.33 the lock breaks and the two lanes' ticks slip round each other in beats, once in 13 s just past the edge and faster from there.
// Knob 4: Coupling. How much each bob weighs against the beam, 0.4 x the square root of the knob: 0.098 at the opening 0.06, where the clocks come from a tenth of a swing apart to half a swing in 7 s. At 0 the beam is too heavy to move and the clocks keep their first offset for good; at 1 (0.4) they are half a swing apart within 3 s.
// Buttons: Any tap holds the right pendulum at the end of its next swing to the right for 0.3 to 0.8 model seconds and lets it go, as the pattern does by itself every 24 model seconds, and the clocks find their way back.

// Huygens noticed in 1665 that two of his pendulum clocks hung from the
// same beam ended up swinging in opposite directions, and came back to it
// after he disturbed one. Bennett, Schatz, Rockwood and Wiesenfeld rebuilt
// the experiment in 2002 and explained it with a model of pendulums kept
// going by escapement kicks, mounted on a support that can move. This
// pattern runs a model of that kind; its numbers are mine, picked so the
// lock comes within a few swings.
//
// In units of the rod length, with x the beam's sideways place and mu the
// mass of one bob over the beam's:
//
//   theta_i'' = -w_i^2 sin(theta_i) - b theta_i' - x'' cos(theta_i)
//   (1 + 2 mu) x'' + mu sum_i (theta_i'' cos(theta_i) - theta_i'^2 sin(theta_i))
//       = -k x - c x'
//
// with b = 0.6 the pendulums' own damping, k = 4 and c = 5 the beam's
// spring and damping, and w = 2 pi so a swing takes one model second. Each
// time a pendulum passes the bottom going right its escapement kicks it,
// theta' += 0.32, and the beam takes the recoil. That is the tick, and it
// keeps the swing at about 0.17 radians, 9 or 10 LEDs either side.
//
// Swinging together, the two bobs push the beam back and forth and its
// damping takes energy out of that motion. Swinging against each other
// they push it equally both ways and it stays put, so that is the motion
// that costs the clocks nothing, and the escapements keep it going while
// the rest dies away. The beam's sway is drawn in the middle strip of the
// record: a wobble while the clocks tick near together, a straight line
// once they alternate.
//
// The clocks start from the same side, the right one let go 0.08 s after
// the left. Each tick flashes the bob and drops a bar into that clock's
// lane of the record below, where row y is the time (y - 70) / 9 model
// seconds ago. Ticking together, the bars of the two lanes lie side by
// side like the rungs of a ladder; at half a swing apart each bar of one
// lane falls exactly between two of the other's.

const W = 64, H = 128;
const { floor, min, max, round, sqrt, sin, cos, PI, tanh } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// The model's constants: the common rate, the pendulums' damping, the
// escapement's kick, the beam's spring and damping, and the time step.
const W0 = TAU, B = 0.6, EPS = 0.32, KB = 4, CB = 5, H_STEP = 1 / 600;
// Drawing: pivots, rod length in LEDs, the record's top row and its pace.
const PX = [16, 48], PY = 3, LEN = 56, R0 = 70, VS = 9, BOB = 3.6;
const HUES = [0.11, 0.55];

function hsv(h, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const v = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  o[0] = v[0];
  o[1] = v[1];
  o[2] = v[2];
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, det: 0, mu: 0.1,
    th: [0.19, 0.19], om: [0, 0], X: 0, V: 0, t: 0,
    hold: 0.08, pending: 0, next: 24,
    ticks: [[], []], flash: [0, 0],
    hist: new Float32Array(256), hn: 0, ht: 0,
    buf: new Float32Array(W * H * 3), c: [[0, 0, 0], [0, 0, 0]],
  };
}

function step(S, h) {
  const w0 = W0 * (1 - S.det / 2), w1 = W0 * (1 + S.det / 2), w = [w0, w1], mu = S.mu, th = S.th, om = S.om;
  const held = S.hold > 0;
  // The pendulums' forces apart from the beam, then the beam's acceleration
  // with the pendulums' reaction solved in, then the pendulums'.
  const f0 = -w[0] * w[0] * sin(th[0]) - B * om[0], f1 = -w[1] * w[1] * sin(th[1]) - B * om[1];
  let num = -KB * S.X - CB * S.V, den = 1 + 2 * mu;
  num -= mu * (f0 * cos(th[0]) - om[0] * om[0] * sin(th[0]));
  den -= mu * cos(th[0]) * cos(th[0]);
  if (!held) {
    num -= mu * (f1 * cos(th[1]) - om[1] * om[1] * sin(th[1]));
    den -= mu * cos(th[1]) * cos(th[1]);
  }
  const a = num / den;
  S.V += a * h;
  S.X += S.V * h;
  const p0 = th[0], p1 = th[1], q1 = om[1];
  om[0] += (f0 - a * cos(th[0])) * h;
  th[0] += om[0] * h;
  if (held) {
    om[1] = 0;
    S.hold -= h;
  } else {
    om[1] += (f1 - a * cos(th[1])) * h;
    th[1] += om[1] * h;
    // A hold waits for the end of a swing to the right.
    if (S.pending > 0 && q1 > 0 && om[1] <= 0) {
      S.hold = S.pending;
      S.pending = 0;
    }
  }
  S.t += h;
  const pr = [p0, p1];
  for (let i = 0; i < 2; i++) {
    if (pr[i] < 0 && th[i] >= 0 && om[i] > 0) {
      om[i] += EPS;
      S.V -= (mu / (1 + 2 * mu)) * EPS;
      S.ticks[i].push(S.t);
      if (S.ticks[i].length > 24) S.ticks[i].shift();
      S.flash[i] = 1;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.det = 0.3 * cl(k[2] || 0, -1, 1);
  S.mu = 0.4 * sqrt(cl(k[3] == null ? 0.06 : k[3], 0, 1));
  const b = input.btnPressed;
  if (b && (b[0] || b[1] || b[2] || b[3])) S.pending = 0.3 + 0.5 * Math.random();
  if (S.t >= S.next) {
    S.next = S.t + 24;
    S.pending = 0.45 + 0.3 * Math.random();
  }
  const sim = d * S.speed * 0.5;
  let n = Math.ceil(sim / H_STEP);
  const h = n > 0 ? sim / n : 0;
  while (n-- > 0) {
    step(S, h);
    // The beam's place, one sample per half row of the record.
    if (S.t >= S.ht) {
      S.ht = S.t + 0.5 / VS;
      S.hist[S.hn] = S.X;
      S.hn = (S.hn + 1) % S.hist.length;
    }
  }
  for (let i = 0; i < 2; i++) S.flash[i] = max(0, S.flash[i] - sim * 5);
}

function add(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  buf[p] += c[0] * a;
  buf[p + 1] += c[1] * a;
  buf[p + 2] += c[2] * a;
}

// A line one LED wide, each LED lit by its distance to the segment.
function line(buf, x0, y0, x1, y1, c, a) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  for (let y = max(0, floor(min(y0, y1)) - 1); y <= min(H - 1, Math.ceil(max(y0, y1)) + 1); y++)
    for (let x = max(0, floor(min(x0, x1)) - 1); x <= min(W - 1, Math.ceil(max(x0, x1)) + 1); x++) {
      const t = cl(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1), ex = x0 + t * dx - x, ey = y0 + t * dy - y;
      add(buf, x, y, c, a * cl(1.1 - sqrt(ex * ex + ey * ey), 0, 1));
    }
}

function disc(buf, cx, cy, r, c, a) {
  for (let y = floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = floor(cx - r - 1); x <= cx + r + 1; x++) {
      const e = sqrt((x - cx) ** 2 + (y - cy) ** 2);
      add(buf, x, y, c, a * cl(r + 0.5 - e, 0, 1));
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, C = S.c, white = [1, 1, 1], warm = [1, 0.85, 0.65];
  buf.fill(0);
  hsv(S.hue + HUES[0], C[0]);
  hsv(S.hue + HUES[1], C[1]);
  const off = S.X * LEN;
  // The beam, with a stud every 4 LEDs so its sway shows.
  for (let x = 1; x < W - 1; x++) {
    const u = x - off, stud = u - 4 * floor(u / 4) < 1 ? 0.3 : 0;
    add(buf, x, 0, warm, 0.3);
    add(buf, x, 1, warm, 0.5 + stud);
    add(buf, x, 2, warm, 0.3);
  }
  // The record: two lanes, the ticks falling down them from the clocks, and
  // between them the beam's swing over the same time.
  for (let i = 0; i < 2; i++) {
    const x0 = PX[i] - 11, x1 = PX[i] + 11, c = C[i];
    for (let y = R0; y < H; y++) for (let x = x0; x <= x1; x++) add(buf, x, y, c, 0.08);
    // Each tick a bar two rows deep with a short glow above it, on the
    // side of the present, falling at VS rows a second of model time.
    for (const tk of S.ticks[i]) {
      const yy = R0 + (S.t - tk) * VS;
      if (yy > H + 1) continue;
      const fade = 1 - (0.4 * (yy - R0)) / (H - R0);
      for (let y = floor(yy) - 5; y <= floor(yy) + 2; y++) {
        if (y < R0 || y >= H) continue;
        const core = cl(min(y + 1, yy + 2) - max(y, yy), 0, 1), glow = y < yy ? 0.45 * Math.exp((y + 1 - yy) / 1.6) : 0;
        const a = (0.88 * core + glow * (1 - core)) * fade;
        for (let x = x0; x <= x1; x++) add(buf, x, y, c, a);
      }
    }
  }
  // The beam's sway down the middle strip, squashed so the largest sway at
  // the start just fills it.
  const nh = S.hist.length;
  for (let y = R0; y < H; y++) {
    const back = round((y - R0) * 2);
    if (back >= nh) break;
    const xv = S.hist[(S.hn - 1 - back + nh * 4) % nh];
    const px = 31.5 + 2.6 * tanh(xv * 90);
    const ix = floor(px), fr = px - ix;
    add(buf, ix, y, warm, 0.6 * (1 - fr));
    add(buf, ix + 1, y, warm, 0.6 * fr);
  }
  // The two clocks.
  for (let i = 0; i < 2; i++) {
    const px = PX[i] + off, th = S.th[i], bx = px + LEN * sin(th), by = PY + LEN * cos(th), f = S.flash[i];
    line(buf, px, PY, bx, by, C[i], 0.6 + 0.4 * f);
    disc(buf, bx, by, BOB, C[i], 1);
    disc(buf, bx, by, BOB + 1.5 * f, white, 0.8 * f);
  }
  for (let p = 0; p < W * H; p++)
    display.setPixel(p % W, floor(p / W), round(cl(buf[p * 3], 0, 1) * 255), round(cl(buf[p * 3 + 1], 0, 1) * 255), round(cl(buf[p * 3 + 2], 0, 1) * 255));
}
