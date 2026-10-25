// ===== Patternflow pattern =====
// Title:   Swarmalators
// Family:  particle
// Idea:    Two swarms of 150 swarmalators stacked down the panel, each a hard dot coloured by its phase that is pulled towards dots of a like colour and kept off by all of them, settle into rainbow rings whose colour runs once round, and as the phase coupling swings slowly up and down the rings squeeze into ovals, splinter and churn, the lower swarm always a step further along the coupling, where its dots circulate round the ring.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Swarmalators (Kevin O'Keeffe, Hyunsuk Hong and Steven Strogatz, 2017), pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Coupling=-1..0.5, Tour=0..1
//
// Knob 1: Hue. Turns every dot's colour round the wheel together. Each ring always carries the whole wheel, so the knob turns which colour sits where: at 0 the top ring starts red on its right, cyan on its left, blue and magenta on top and yellow and green below; at 0.5 the two halves swap. A swarm that has synchronised is one solid disc: with Coupling at 0.5 the top one goes red at Hue 0 and cyan at 0.5.
// Knob 2: Speed. At 2 the equations run 4 of their time units a second, so a dot circulating in the bottom ring moves about 11 LEDs a second, and the coupling swing takes 24 seconds. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Coupling. The phase coupling K of the top swarm; the bottom swarm's is always 0.75 lower. At 0 the top is the static phase wave, a still rainbow ring, and the bottom the active phase wave, its dots circulating and jostling round a looser ring. At 0.5 the top synchronises within 8 seconds, folding its ring into one solid disc of a single colour 23 LEDs across, while the bottom stiffens into a clean still ring. At -1 the top churns at the edge of disorder and the bottom is static async, a disc of confetti.
// Knob 4: Tour. How far K swings, slowly, about where Coupling puts it: plus and minus the square root of Tour, once every 24 seconds at Speed 2. At 0 there is no swing and only a faint spread of natural frequencies keeps the still ring creeping; at 0.06 K swings by 0.25, so the top ring squeezes into an oval towards sync for 12 seconds and splinters for 12; at 1 K swings by 1: every lap the top ring folds into a one-colour disc, breaks into confetti and opens back into a ring, and the bottom runs from a still ring through its circulating one to confetti and back.

const W = 64, H = 128;
const { floor, sqrt, sin, cos, PI, round, ceil, max } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The swarm is round and the panel is twice as tall as it is wide, so it
// carries two swarms, one in each 64 by 64 half, each the model untouched.
// 150 dots a swarm, one unit of the equations is 18.5 LEDs (the widest
// state, the static phase wave, reaches 1.53 units, 28 LEDs, from its
// centre), and a dot is a hard disc of radius 1.76 LEDs, about 10 LEDs.
// At 120 dots of radius 1.6 the panel lit 22% and its colourfulness was
// 0.49; this size lights 29% and reaches 0.57.
const N = 150, SC = 18.5, R2 = 3.1;
// The bottom swarm's coupling sits this far below the top's, so the two show
// neighbouring states; the slow swing of K has this period in story seconds;
// and the natural frequencies are spread evenly over plus and minus this.
const GAP = 0.75, PERIOD = 24, SIG = 0.02;

// The hue scale lingers on the six pure colours and hurries through the
// in-between ones, so a ring reads as six bands of red, yellow, green, cyan,
// blue and magenta, each dot at 255 in its strongest channel. Applied twice:
// once still showed orange and azure arcs that the panel draws dull.
const ux = (h) => h - sin(6 * TAU * h) / (6 * TAU);

// A swarm: positions, phases, natural frequencies. The top one starts as the
// static phase wave it is about to be, phase equal to angle round a ring; the
// bottom starts as the paper does, phases at random in a disc.
function swarm(cy, ring) {
  const x = new Float32Array(N), y = new Float32Array(N), th = new Float32Array(N), om = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = (TAU * (i + Math.random())) / N, r = ring ? 0.65 + 0.85 * Math.random() : 1.2 * sqrt(Math.random());
    const b = ring ? a : TAU * Math.random();
    x[i] = r * cos(b);
    y[i] = r * sin(b);
    th[i] = a;
    om[i] = SIG * ((2 * (i + 0.5)) / N - 1);
  }
  for (let i = N - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = om[i];
    om[i] = om[j];
    om[j] = t;
  }
  return { cy, x, y, th, om, vx: new Float32Array(N), vy: new Float32Array(N), w: new Float32Array(N), c: new Float32Array(N), s: new Float32Array(N), K: 0 };
}

// One Euler step of the swarmalator equations with A = B = J = 1:
//   dx_i/dt = 1/N sum_j [ (x_j - x_i)/|x_j - x_i| (1 + cos(th_j - th_i)) - (x_j - x_i)/|x_j - x_i|^2 ]
//   dth_i/dt = om_i + K/N sum_j sin(th_j - th_i)/|x_j - x_i|
// Each pair is visited once and its pull handed to both dots with opposite
// signs, so the swarm's centre never moves. cos and sin of the phase
// difference come from each dot's own cos and sin, with no trigonometry in
// the pair loop. A frame at Speed 2 is two steps of each swarm, 11175 pairs
// a step, and with the drawing it takes under 2 ms.
function step(sw, K, dt) {
  const { x, y, th, om, vx, vy, w, c, s } = sw;
  for (let i = 0; i < N; i++) {
    c[i] = cos(th[i]);
    s[i] = sin(th[i]);
    vx[i] = vy[i] = w[i] = 0;
  }
  for (let i = 0; i < N; i++) {
    const xi = x[i], yi = y[i], ci = c[i], si = s[i];
    let ax = 0, ay = 0, aw = 0;
    for (let j = i + 1; j < N; j++) {
      const dx = x[j] - xi, dy = y[j] - yi, d2 = dx * dx + dy * dy + 1e-6, inv = 1 / sqrt(d2);
      const cd = c[j] * ci + s[j] * si, sd = s[j] * ci - c[j] * si;
      // Attraction of constant strength 1 + cos, stronger between like
      // phases and gone between opposite ones; repulsion falling as 1/r.
      const f = (1 + cd) * inv - 1 / d2;
      const fx = f * dx, fy = f * dy;
      ax += fx;
      ay += fy;
      vx[j] -= fx;
      vy[j] -= fy;
      const pw = sd * inv;
      aw += pw;
      w[j] -= pw;
    }
    vx[i] += ax;
    vy[i] += ay;
    w[i] += aw;
  }
  for (let i = 0; i < N; i++) {
    x[i] += (dt * vx[i]) / N;
    y[i] += (dt * vy[i]) / N;
    const t = th[i] + dt * (om[i] + (K * w[i]) / N);
    th[i] = t - TAU * floor(t / TAU);
  }
}

export function setup(params) {
  const top = swarm(32, true), bot = swarm(96, false);
  // Thirty time units at K = -0.75 before the first frame: from its random
  // disc the bottom swarm has found the active phase wave by then.
  for (let q = 0; q < 300; q++) step(bot, -GAP, 0.1);
  params.s = { hue: 0, speed: 2, K: 0, tour: 0.06, t: 0, sw: [top, bot], buf: new Uint8Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.K = cl(k[2], -1, 0.5);
  S.tour = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.t += g;
  // The tour: both couplings swing together, a sine about the knob's K.
  const swing = sqrt(S.tour) * sin((TAU * S.t) / PERIOD);
  S.sw[0].K = S.K + swing;
  S.sw[1].K = S.K - GAP + swing;
  // Four time units a story second, in steps of at most 0.07.
  const T = g * 4;
  const n = max(1, ceil(T / 0.07));
  for (let q = 0; q < n; q++) for (const sw of S.sw) step(sw, sw.K, T / n);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  buf.fill(0);
  for (const sw of S.sw) {
    // Each swarm keeps to its own half: a dot flung out (one in antiphase
    // with the rest feels no pull, only the push) leaves the panel rather
    // than wander into the other swarm.
    const y0h = sw.cy - 32, y1h = sw.cy + 32;
    let mx = 0, my = 0;
    for (let i = 0; i < N; i++) (mx += sw.x[i]), (my += sw.y[i]);
    mx /= N;
    my /= N;
    for (let i = 0; i < N; i++) {
      const c = hsv(ux(ux(sw.th[i] / TAU + S.hue)), 1, 1);
      const r = round(c[0] * 255), g = round(c[1] * 255), b = round(c[2] * 255);
      const px = 32 + (sw.x[i] - mx) * SC, py = sw.cy + (sw.y[i] - my) * SC;
      const x0 = floor(px), y0 = floor(py);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const ex = x0 + dx + 0.5 - px, ey = y0 + dy + 0.5 - py;
          if (ex * ex + ey * ey > R2) continue;
          const xx = x0 + dx, yy = y0 + dy;
          if (xx < 0 || xx >= W || yy < y0h || yy >= y1h) continue;
          const o = (yy * W + xx) * 3;
          buf[o] = r;
          buf[o + 1] = g;
          buf[o + 2] = b;
        }
    }
  }
  for (let i = 0; i < W * H; i++) display.setPixel(i % W, floor(i / W), buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]);
}
