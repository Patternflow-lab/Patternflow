// ===== Patternflow pattern =====
// Title:   Hegselmann-Krause
// Family:  sim
// Idea:    Four hundred opinions spread over the panel's 64 columns each move, step after step, to the mean of all the opinions within epsilon of their own, and a pen writes the steps down the 128 rows on a clock that slows, so the even wash at the top, every opinion coloured by where it started, gathers into funnels that freeze in about nine steps into six or seven bright rivers some 2.6 epsilon apart, the odd straggler between them, before a fresh set of opinions is written over them from the top.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: bounded confidence model (Rainer Hegselmann and Ulrich Krause, 2002), pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tilt=0..1, Epsilon=0.03..0.3
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 an opinion that starts at 0 is cyan, one that starts at 0.5 blue violet and one at 1 rose, and a river wears the colour of the mean start of the opinions in it; at 0.5 the same run goes red, orange, lime and teal. Twenty faint stripes, every twentieth of the starting range, run down the wash and pinch together where it gathers.
// Knob 2: Speed. The pen writes 12 rows a second times the knob: at 2 a run fills the panel in 5.3 s and holds 1.2 s, at 0.2 it takes 53 s and holds 12 s, at 3 it takes 3.6 s.
// Knob 3: Tilt. Asymmetric confidence: an agent listens epsilon x (1 + Tilt) to its right and epsilon x (1 - Tilt) to its left, the window still 2 epsilon wide. At 0 the symmetric model, whose mean opinion stays at 0.50. At 0.5, with epsilon 0.06, the funnels lean right, a run moves for 16 steps instead of 9 and ends in 4.8 rivers instead of 6.6, and the mean opinion drifts to 0.65. At 1 an agent hears only the opinions at or right of its own, up to 2 epsilon away, and in 277 runs of 300 everyone streams into one river at the right edge.
// Knob 4: Epsilon. The confidence bound, 0.03 to 0.3, opening at 0.06. Over 300 runs of 400 agents a run ends in 13.0 clusters at 0.03 (1/(2 epsilon) is 16.7), 6.6 at 0.06 (8.3), 3.9 at 0.1 (5), 2.6 at 0.15 (3.3) and 1.9 at 0.2, where 9% of runs reach consensus; at 0.25 96% do, at 0.3 all. A change starts a new run.
// Buttons: K1 tap starts a new run from the top.

// Each step every agent moves to the mean of the opinions within epsilon of
// its own, its own included, all at once. Opinions freeze in finite time:
// once neighbouring clusters are more than epsilon apart nothing moves
// again. The rule of thumb says about 1/(2 epsilon) clusters. Random starts
// give fewer: over 300 runs of 400 agents they sat 2.56 epsilon apart at
// epsilon 0.06 and 2.65 at 0.03, where evenly spaced starts sit about 2.2
// apart, near the 2 epsilon that Vincent Blondel, Julien Hendrickx and John
// Tsitsiklis conjectured for them (2009).
//
// Step s is drawn on row A ln(1 + s / 6), interpolated between steps, so the
// first steps, where most of the gathering happens, get the most rows. A
// grey tick in both margin columns marks each step, and a white one the end
// of the last step that moves an opinion by more than a tenth of an LED.

const W = 64, H = 128, N = 400, MAXSTEP = 400;
const { floor, min, max, abs, exp, sqrt, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// One run: N opinions drawn uniformly from [0, 1], then the model's steps
// until no opinion moves. The order of the opinions never changes, so a
// sorted start stays sorted and each step is one sweep of a sliding window.
function simulate(epsL, epsR) {
  const x0 = new Float64Array(N);
  for (let i = 0; i < N; i++) x0[i] = Math.random();
  x0.sort();
  const traj = [Float32Array.from(x0)];
  let x = x0, last = 0;
  for (let s = 0; s < MAXSTEP; s++) {
    const y = new Float64Array(N);
    let lo = 0, hi = 0, sum = 0, move = 0;
    for (let i = 0; i < N; i++) {
      while (hi < N && x[hi] <= x[i] + epsR + 1e-12) sum += x[hi++];
      while (x[lo] < x[i] - epsL - 1e-12) sum -= x[lo++];
      y[i] = sum / (hi - lo);
      move = max(move, abs(y[i] - x[i]));
    }
    x = y;
    traj.push(Float32Array.from(y));
    if (move > 0.0015) last = s + 1;
    if (move < 1e-9) break;
  }
  return { x0: Float32Array.from(x0), traj, steps: last };
}

function newRun(S) {
  const r = simulate(S.eps * (1 - S.tilt), S.eps * (1 + S.tilt));
  S.run = r;
  // The clock slows down the panel: step s sits on row A ln(1 + s / 6), A
  // chosen so the last step that moves lands on row 96 at the latest and the
  // first step takes at most 16 rows.
  S.A = min(16 / Math.log(1 + 1 / 6), 96 / Math.log(1 + max(1, r.steps) / 6));
  S.pen = 0;
  S.hold = 0;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, tilt: -1, eps: -1, btn: false,
    img: new Float32Array(W * H * 2), old: new Float32Array(W * H * 2), rgb: new Float32Array(3),
    w: new Float32Array(W), wx: new Float32Array(W), wb: new Float32Array(W), drawn: 0, run: null,
  };
  return params.s;
}

// Draw row y of the run into img.
function drawRow(S, y) {
  const { traj, x0 } = S.run, t = 6 * (exp(y / S.A) - 1), s = floor(t), f0 = t - s, f = f0 * f0 * (3 - 2 * f0);
  const a = traj[min(s, traj.length - 1)], b = traj[min(s + 1, traj.length - 1)];
  const { w, wx, wb } = S;
  w.fill(0);
  wx.fill(0);
  wb.fill(0);
  for (let i = 0; i < N; i++) {
    const p = a[i] + (b[i] - a[i]) * f, u = 1 + p * 61, c = floor(u), g = u - c;
    const br = 0.4 + 0.6 * (0.5 + 0.5 * cos(x0[i] * PI * 40));
    w[c] += 1 - g;
    wx[c] += (1 - g) * x0[i];
    wb[c] += (1 - g) * br;
    w[c + 1] += g;
    wx[c + 1] += g * x0[i];
    wb[c + 1] += g * br;
  }
  const o = S.img, rho = W / N;
  for (let c = 0; c < W; c++) {
    let best = 0, bh = 0, bb = 0;
    for (let d = -4; d <= 4; d++) {
      const cc = c + d;
      if (cc < 0 || cc >= W || w[cc] < 0.03) continue;
      const r = w[cc] * rho, hw = max(0, 0.45 * sqrt(r) - 0.35);
      const cov = cl(hw + 0.5 - abs(d), 0, 1) * cl(w[cc] / 0.25, 0, 1);
      const v = cov * (0.3 + 0.7 * (1 - exp(-r / 1.5)));
      if (v > best) (best = v), (bh = wx[cc] / w[cc]), (bb = wb[cc] / w[cc]);
    }
    const k = (y * W + c) * 2;
    o[k] = best * bb;
    o[k + 1] = bh;
  }
  // A tick in both margins on each row where a step falls, a bright one on
  // the row where the run freezes.
  const t1 = 6 * (exp((y + 1) / S.A) - 1);
  if (floor(t1) > s) {
    const v = s < S.run.steps && floor(t1) >= S.run.steps ? 0.9 : s < S.run.steps ? 0.3 : 0;
    for (const c of [0, W - 1]) if (v > 0) (o[(y * W + c) * 2] = v), (o[(y * W + c) * 2 + 1] = -1);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const tilt = cl(k[2] || 0, 0, 1), eps = cl(k[3] == null ? 0.06 : k[3], 0.03, 0.3);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (!S.run) {
    S.tilt = tilt;
    S.eps = eps;
    newRun(S);
    for (let y = 0; y < H; y++) drawRow(S, y);
    S.old.set(S.img);
    newRun(S);
    S.pen = 48;
    for (let y = 0; y < 48; y++) drawRow(S, y);
    S.drawn = 48;
  }
  if (abs(tilt - S.tilt) > 0.02 || abs(eps - S.eps) > 0.004 || (btn && !S.btn)) {
    S.tilt = tilt;
    S.eps = eps;
    S.old.set(S.img);
    newRun(S);
    S.drawn = 0;
  }
  S.btn = btn;
  const rate = 12 * S.speed;
  if (S.pen < H) S.pen = min(H, S.pen + d * rate);
  else {
    S.hold += d;
    if (S.hold > 2.4 / S.speed) {
      S.old.set(S.img);
      newRun(S);
      S.drawn = 0;
    }
  }
  while (S.drawn < floor(S.pen)) drawRow(S, S.drawn++);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.run) return;
  const o = S.img, ol = S.old, pen = floor(S.pen), c = S.rgb;
  for (let y = 0; y < H; y++) {
    // The newest rows come in brighter and settle in about 10 rows; below
    // the pen the last run stays, dimmed.
    const now = y < pen, buf = now ? o : ol, lift = now ? 1 + 0.6 * exp(-(pen - 1 - y) / 4) : 0.38;
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 2, v = buf[k] * lift;
      if (v <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      hsv(S.hue + 0.5 + 0.48 * buf[k + 1], buf[k + 1] < 0 ? 0 : 0.78, cl(v, 0, 1), c, 0);
      display.setPixel(x, y, floor(c[0] * 255), floor(c[1] * 255), floor(c[2] * 255));
    }
  }
}
