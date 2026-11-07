// ===== Patternflow pattern =====
// Title:   Vicsek Bands
// Family:  particle
// Idea:    Twenty-eight hundred particles move at one speed through a periodic 64 by 128 box, each turning at every step to the mean heading of the particles within 1.6 LEDs of it plus a random kick and shining in the colour of its heading, and at the noise where a flock tips over into a gas the panel is neither: one dense band of a single colour runs up the standing panel through a speckled gas of every hue, its front sharp and its rear trailing streaks.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Vicsek model of self-driven particles and its order parameter (Tamas Vicsek, Andras Czirok, Eshel Ben-Jacob, Inon Cohen and Ofer Shochet, Novel type of phase transition in a system of self-driven particles, Phys. Rev. Lett. 75, 1226, 1995); the transition shown to be first order, with dense bands travelling through a gas (Guillaume Gregoire and Hugues Chate, Onset of collective and cohesive motion, Phys. Rev. Lett. 92, 025702, 2004; Hugues Chate, Francesco Ginelli, Guillaume Gregoire and F. Raynaud, Collective motion of self-propelled particles interacting without cohesion, Phys. Rev. E 77, 046113, 2008); pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Noise=-1..1, Density=-1..1
//
// Knob 1: Hue. Turns the colour of every heading round the wheel together. At 0 a particle heading up the panel is cyan, one heading right violet, one heading down red and one heading left yellow-green, and the colour runs once round the wheel as the heading turns once round. At 0.25 up is violet, at 0.5 up is red, at 0.75 up is yellow-green. The band moves up, so at 0 it is cyan, and the particles that have drifted left of its heading are green and the ones right of it blue.
// Knob 2: Speed. The steps a second, 12 times the knob, with a particle moving 0.8 LED a step. At 2 that is 24 steps a second and 19 LEDs a second, so the band runs the 128 rows in 6.7 s. At 0.2 it is 2.4 steps and 1.9 LEDs a second, a band that takes 67 s to go round, and at 3 it is 36 steps and 29 LEDs a second. Positions are drawn a fraction of the way through the step, so the slow end still glides.
// Knob 3: Noise. The width of the random kick as a share f of a full turn, eta = 2 pi f, 0.10 at -1, 0.33 at 0 and 0.50 at 1. At -1 the order parameter sits at 0.95 and the whole flock is one cyan block that has swept the gas up. At -0.6 it is 0.84, a block with a green stream behind it. At 0 it is 0.57 and the band holds against a gas of every hue. At 0.4 the band is dissolving and the order is 0.2 to 0.4, and at 1 it is 0.02: a speckle of every hue with no band at all, every kick up to 90 degrees either way.
// Knob 4: Density. The number of particles, 2,860 at the opening (rho R^2 = 0.89). Below 0 it is 2,800 times 1.8 to the knob, down to 1,560 at -1, where the gas is thin, the order sits at 0.1 to 0.4 and the band is ragged and thins out. Above 0 it is 2,800 times 1.43 to the knob, up to 4,000 at 1, where the band is thicker and takes in more of the gas, order 0.65. New particles split off an old one with its heading and fade in over a quarter of a second; removed ones fade out.

// The rule is the one from the 1995 paper. N particles of one speed v0 sit in
// a periodic box. At each step every particle takes the mean heading of all
// the particles within R of it, itself included, adds an angle uniform in
// (-eta/2, eta/2), and moves v0 along the result. All headings change at
// once. The order parameter is the length of the summed headings divided by
// N: near 1 when everyone goes one way, near 1/sqrt(N) when nobody does.
// Raising eta pulls it down from 1 to 0.
//
// Gregoire and Chate (2004) showed that this fall is a jump, a first-order
// transition, and not the continuous one the first paper took it for.
// At the noise in between, flock and gas coexist: the box holds a dense,
// ordered band that moves, across a disordered gas, with a sharp front and a
// tail where particles leak out of the rear. Chate, Ginelli, Gregoire and
// Raynaud (2008) went on to study the bands. This box is small, 40 by 80 R,
// and holds one.
//
// The numbers. R = 1.6 LEDs, v0 = 0.8 LED a step (half of R). At the opening
// 2,860 particles in 8,192 LEDs give rho R^2 = 0.89 and eta = 0.33 of a turn.
// The band measure used while building was the standard deviation of the
// particle count in 4-row slices over its mean: a uniform gas of this size
// gives 0.11 from chance alone and measures 0.2, the band 1.1.
//
// Starting. From a uniform gas of these numbers the band measure reaches 0.8
// after 600 to 1,500 steps, 25 to 60 s at Speed 2, and clusters come first.
// So half the particles start as a block 24 rows tall heading up and the
// other half as a gas of every heading, and 150 steps run before the first
// frame (about 110 ms). The band is there at the first frame and held a band
// measure between 0.7 and 1.3 over the 1,440 steps (60 s) tried on six seeds.
// Noise at 1 melts it in 4 s. Turned back down from the gas it brings no band
// within 20 s: the order climbs to 0.4 and clusters form, which is the
// hysteresis of a first-order transition.
//
// Drawing. A particle is one LED, at its position a fraction of the way
// through its last step, in the colour of its heading eased over 0.12 s so
// the gas does not strobe. The hue is 0.5 + Hue + the heading's angle from
// straight up over a full turn. Overlapping particles add, so the band
// saturates, and a short trail dies away with a time constant of 0.1 s.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp, pow, abs, cos, sin, atan2, random, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Interaction radius and speed in LEDs, steps a second at Speed 1, the most
// particles, the steps run before the first frame.
const R = 1.6, V0 = 0.8, SPS = 12, NMAX = 4000, NBASE = 2800, DLO = 1.8, DHI = 1.43, PRE = 150;
// The neighbour grid: cells at least R wide, wrapping.
const GX = floor(W / R), GY = floor(H / R), CW = W / GX, CH = H / GY, NC = GX * GY;
// The trail time, the light a particle gives its LED, the fade of a new or removed one.
const TRAIL = 0.1, LUM = 0.8, FADE = 0.25, SMOOTH = 0.12, FLOOR = 0.05;

// A hue table so a particle's colour is one lookup.
const NH = 256;
const HUE = new Float32Array(NH * 3);
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const S = {
    acc: 0, pre: false, n: 0, frac: 0, ran: 0, hue: 0, hueSet: NaN,
    x: new Float64Array(NMAX), y: new Float64Array(NMAX), ax: new Float32Array(NMAX), ay: new Float32Array(NMAX),
    c: new Float32Array(NMAX), s: new Float32Array(NMAX), al: new Float32Array(NMAX),
    ec: new Float32Array(NMAX), es: new Float32Array(NMAX), hx: new Uint8Array(NMAX),
    head: new Int32Array(NC), next: new Int32Array(NMAX),
    cur: new Float32Array(W * H * 3), trail: new Float32Array(W * H * 3),
  };
  // Half the particles start as a block 24 rows tall moving up the panel,
  // the rest as a gas with every heading; the first frame is after the pre-run.
  for (let i = 0; i < NMAX; i++) {
    const inBand = i % 2 === 0;
    S.x[i] = random() * W;
    S.y[i] = inBand ? 30 + random() * 24 : random() * H;
    const th = inBand ? -PI / 2 + 0.3 * (random() - 0.5) : random() * TAU;
    S.c[i] = S.ec[i] = cos(th);
    S.s[i] = S.es[i] = sin(th);
  }
  params.s = S;
}

// One Vicsek step: every particle takes the mean heading of the particles
// within R of it, itself included, adds a kick uniform in (-eta/2, eta/2),
// and moves V0 along the new heading. All headings change together.
function step(S, eta) {
  const { x, y, ax, ay, c, s, head, next, n } = S;
  head.fill(-1);
  for (let i = 0; i < n; i++) {
    const k = min(GX - 1, floor(x[i] / CW)) + GX * min(GY - 1, floor(y[i] / CH));
    next[i] = head[k];
    head[k] = i;
    ax[i] = c[i];
    ay[i] = s[i];
  }
  // Each pair is visited once: the rest of a cell, then four of its eight
  // neighbours, and both particles take the other's heading.
  const R2 = R * R, hw = W / 2, hh = H / 2, half = eta / 2;
  for (let cy = 0; cy < GY; cy++)
    for (let cx = 0; cx < GX; cx++)
      for (let i = head[cx + GX * cy]; i >= 0; i = next[i]) {
        const xi = x[i], yi = y[i], ci = c[i], si = s[i];
        for (let k = 0; k < 5; k++) {
          const ox = k === 0 ? 0 : k === 1 ? 1 : k - 3, oy = k < 2 ? 0 : 1;
          for (let j = k === 0 ? next[i] : head[((cx + ox + GX) % GX) + GX * ((cy + oy) % GY)]; j >= 0; j = next[j]) {
            let dx = x[j] - xi, dy = y[j] - yi;
            dx = dx > hw ? dx - W : dx < -hw ? dx + W : dx;
            dy = dy > hh ? dy - H : dy < -hh ? dy + H : dy;
            if (dx * dx + dy * dy < R2) {
              ax[i] += c[j];
              ay[i] += s[j];
              ax[j] += ci;
              ay[j] += si;
            }
          }
        }
      }
  for (let i = 0; i < n; i++) {
    const a = atan2(ay[i], ax[i]) + half * (2 * random() - 1), ca = cos(a), sa = sin(a);
    c[i] = ca;
    s[i] = sa;
    let xi = x[i] + V0 * ca, yi = y[i] + V0 * sa;
    xi = xi < 0 ? xi + W : xi >= W ? xi - W : xi;
    yi = yi < 0 ? yi + H : yi >= H ? yi - H : yi;
    x[i] = xi;
    y[i] = yi;
  }
}

// Eta in radians from the Noise knob: 0.33 of a full turn at the middle,
// where this box holds a band, 0.10 at -1 and 0.50 at 1.
const etaOf = (k) => TAU * (0.33 + (k < 0 ? 0.23 : 0.17) * k);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3), eta = etaOf(cl(k[2] || 0, -1, 1));
  const kd = cl(k[3] == null ? 0.06 : k[3], -1, 1), n = cl(round(NBASE * pow(kd < 0 ? DLO : DHI, kd)), 1000, NMAX);
  if (n > S.n) {
    // New particles split off a random old one, with its heading, and fade in.
    for (let i = S.n; i < n; i++) {
      const j = S.n > 0 ? floor(random() * S.n) : i;
      S.x[i] = (S.x[j] + (random() - 0.5) * 2 + W) % W;
      S.y[i] = (S.y[j] + (random() - 0.5) * 2 + H) % H;
      S.c[i] = S.ec[i] = S.c[j];
      S.s[i] = S.es[i] = S.s[j];
      S.al[i] = S.pre ? 0 : 1;
    }
  }
  S.n = n;
  let steps = 0;
  const first = !S.pre;
  if (first) {
    S.pre = true;
    steps = PRE;
    for (let i = 0; i < n; i++) S.al[i] = 1;
  }
  S.acc += d * speed * SPS;
  const live = floor(S.acc);
  S.acc -= live;
  steps += live;
  for (let q = 0; q < steps; q++) step(S, eta);
  S.frac = S.acc;
  S.ran = d;
  // Particles beyond n fade out, the ones inside fade in. The colour follows
  // the heading eased over SMOOTH seconds, so a gas particle's kicks do not strobe.
  const e = 1 - exp(-d / FADE), eh = first ? 1 : 1 - exp(-d / SMOOTH), { ec, es, c, s, hx, al } = S;
  for (let i = 0; i < NMAX; i++) {
    al[i] += ((i < n ? 1 : 0) - al[i]) * e;
    ec[i] += (c[i] - ec[i]) * eh;
    es[i] += (s[i] - es[i]) * eh;
    hx[i] = floor((atan2(es[i], ec[i]) + PI / 2) * (NH / TAU)) & (NH - 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { x, y, c, s, al, hx, cur, trail, frac } = S;
  if (S.hueSet !== S.hue) {
    S.hueSet = S.hue;
    for (let h = 0; h < NH; h++) hsv(0.5 + S.hue + h / NH, 0.9, 1, HUE, h * 3);
  }
  cur.fill(0);
  const fade = exp(-S.ran / TRAIL);
  for (let p = 0; p < W * H * 3; p++) trail[p] = trail[p] * fade < FLOOR ? 0 : trail[p] * fade;
  for (let i = 0; i < NMAX; i++) {
    const a = al[i];
    if (a < 0.02) continue;
    // Where the particle is a fraction of the way through the step it has just taken.
    let px = x[i] - V0 * c[i] * (1 - frac), py = y[i] - V0 * s[i] * (1 - frac);
    px = px < 0 ? px + W : px >= W ? px - W : px;
    py = py < 0 ? py + H : py >= H ? py - H : py;
    const o = (min(H - 1, floor(py)) * W + min(W - 1, floor(px))) * 3;
    const hi = hx[i] * 3, v = LUM * a;
    cur[o] += HUE[hi] * v;
    cur[o + 1] += HUE[hi + 1] * v;
    cur[o + 2] += HUE[hi + 2] * v;
  }
  for (let p = 0, yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++, p += 3) {
      const r = min(1, cur[p]), g = min(1, cur[p + 1]), b = min(1, cur[p + 2]);
      if (r * 0.5 > trail[p]) trail[p] = r * 0.5;
      if (g * 0.5 > trail[p + 1]) trail[p + 1] = g * 0.5;
      if (b * 0.5 > trail[p + 2]) trail[p + 2] = b * 0.5;
      display.setPixel(xx, yy, round(max(r, trail[p]) * 255), round(max(g, trail[p + 1]) * 255), round(max(b, trail[p + 2]) * 255));
    }
}
