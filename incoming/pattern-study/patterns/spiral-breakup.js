// ===== Patternflow pattern =====
// Title:   Spiral Breakup
// Family:  chemistry
// Idea:    An excitable medium on the panel's own torus keeps shedding new spiral tips, so cream wave fronts with orange bodies curl, collide and vanish over a teal refractory wake, and the tangle never settles into a pattern that repeats.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The Barkley model of excitable media, Dwight Barkley (1991), in the spiral-turbulence form of Markus Bar and Markus Eiswirth (1993, with the piecewise source in the recovery variable), who found that spirals shed new tips from their arms; all names and years from memory. The S1-S2 stimulus is the protocol electrophysiologists use to start re-entry, from memory.
// Round:   117
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Threshold=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every colour, so one turn comes back. At 0 the leading edge of a wave is cream (255, 246, 209), its body orange (204, 114, 1), the wake behind it runs from ember through teal (6, 100, 94) to (0, 27, 39), and a medium at rest is black. At 0.25 the bodies are green (54, 165, 89) over a violet wake, at 0.5 azure (20, 149, 217) over brown-red, at 0.75 orchid (190, 103, 183) over olive.
// Knob 2: Flow. The model time that passes in a panel second, 1.5 time units per unit of Flow. The leading edges, measured as u_t / |grad u| on the cells at u = 0.5, run 2.2 LED per time unit at Scale 0 (quartiles 1.7 and 2.7), which is 1.7 LED a second at Flow 0.5, 6.7 at 2 and 10 at 3. An LED fires once every 5.9 time units on average (0.17 firings per LED per time unit), so every 2 s at Flow 2.
// Knob 3: Scale. How big the waves are, as dx, the model length of one LED: 1.016 at -1, 0.8 at 0, 0.63 at 1. Along the panel axes the fronts are 16 LED apart at -1, 21 at 0 and 26.5 at 1, which is 4, 3 and 2.4 of them across the 64 LEDs, and the band with u above 0.5 is 5.5, 7.2 and 9.3 LED thick. There are 62, 35 and 22 spiral tips on the panel (see Checks for how they are counted). The share of the panel above 0.5 stays at 0.34 to 0.35.
// Knob 4: Threshold. The offset b of the threshold, which is (v + b) / a, so at rest a cell fires when u passes b / a: 0.077 at -1, 0.119 at 0 and 0.161 at 1. At -1 the waves are broad (u above 0.5 on 42 percent of the panel, bands 8.6 LED) and at 1 thin (28 percent, 6.4 LED); the tips stay at 39, 35 and 34 and the firings per LED per time unit go 0.18, 0.17, 0.14. The range stops at b = 0.135: at b = 0.15 the medium still lives with fewer than 0.21 of the panel excited, and at 0.2 no wave starts at all.

// What the field is. Two fields on the torus: u, which fires, and v, which follows u and holds the medium back for a while
// (it is refractory). The equations are
//   u_t = lap u + u (1 - u) (u - (v + b) / a) / eps,
//   v_t = g(u) - v,    g = 0 for u < 1/3,  1 - 6.75 u (u - 1)^2 for 1/3 <= u <= 1,  1 above,
// with a = 0.84 and eps = 0.085 fixed, and b and the length of one LED on the knobs. A cell at rest (u = v = 0) fires if u is
// pushed past b / a. A fired cell makes its neighbours fire, so a front runs. Behind it v rises, and u falls back through 1/2
// after 1.75 time units, when v has reached 0.55: a pulse about 3.5 model units wide, followed by a wake that has to
// decay before another pulse can pass. Two fronts that meet stop each other. A front with a free end curls around it, and that is a
// spiral. In this regime the arm of a spiral is unstable: a long front sheds a new tip, tips are born faster than they
// annihilate in pairs, and the panel holds a churning tangle of curved fronts. Nothing is added to the equations. Apart from the
// ectopic beat below, which never fires in an ordinary run, nothing keeps the tangle going but its own breakup. The tip counts
// are plaquettes of the panel grid where the phase atan2(v - 0.25, u - 0.5) winds by 2 pi; a tip can cover one or two.
//
// Why this form of v. With Barkley's own v_t = u - v, a = 0.84, b = 0.07 and eps = 0.07 a pulse does not propagate: on a ring of
// 120 units it was gone within 8 time units. That form needs eps near 0.02 and a near 0.75 (a ring at a = 0.75, b = 0.06,
// eps = 0.02, dx 0.4 carries a 3.6 unit pulse at 3.4 units per time unit). With the piecewise g of Bar and Eiswirth the
// first set of parameters carries a pulse at 2.05 units per time unit and 3.5 wide, so the source of v is theirs.
//
// Finding the regime. Scans of a, b, eps and dx on the 64 by 128 torus, from ten random broken waves, 1500 to 3000 time units
// each, 4 to 6 seeds each. At a = 0.84 and b = 0.07, eps from 0.04 to 0.06 gives rigid spirals that stay (tips 4, 8, 16, all
// turning at one period, so the picture would repeat), eps = 0.07 is on the edge (one seed in five ends as a single pair) and
// eps = 0.085 and above gives tangle in every seed. The tips per square model unit are 0.0068 to 0.0075 at eps = 0.085 and
// b = 0.095 for dx from 0.5 to 1.1, so the breakup belongs to the equation and not to the lattice. a from 0.7 to 0.88 and b
// from 0.03 to 0.15 stay alive at eps = 0.085, and at a = 0.92 (eps 0.07) only 8 tips are left, rigid again. The front rises from
// 10 to 90 percent over 4.4 sqrt(2 eps) = 1.8 units, which is 2.3 LED at Scale 0 and 1.8 at Scale -1. At dx 1.16 with b = 0.14
// the picture broke into speckle, so Scale stops at 1.016.
//
// Time step. Explicit Euler. The bound for the laplacian is h < 0.25 dx^2, which is 0.1 at the smallest dx here, and the
// reaction slope is at most 0.9 / eps = 10.6 per time unit, so h = 0.03 is far from both. A frame is 2 to 6 steps depending on Flow.
// The stiff term is evaluated everywhere. A step on 8192 cells is 0.12 ms in Node and a frame 0.1 to 0.3 ms; no threshold
// shortcut was used, so none was compared with the exact term.
//
// Checks, run on this file with its internals exported (Node, a seeded Math.random). The step is bit for bit the step of the
// scan harness (difference 0 after 80 time units), so the scans above are scans of this code.
// 1. A planar front against theory. For v held fixed the cubic is the Nagumo equation and a front runs at
//    c = sqrt(1 / (2 eps)) (1 - 2 theta), theta = (v + b) / a: 1.848 at v = 0 (theta 0.119). The grid gives, as a share of that,
//    0.938 at dx 0.63, 0.916 at 0.8 and 0.882 at 1.016 with h = 0.03, and 0.977 at dx 0.4 with h = 0.01. At dx 0.8 the step moves
//    it from 0.903 to 0.924 to 0.931 for h = 0.04, 0.02, 0.01. At v = 0.2 (theta 0.357, c = 0.693) the shares are 0.927, 0.865 and
//    0.705, so a front into a half recovered medium slows down more where the grid is coarse. At v = 0.4, theta = 0.595 is past
//    1/2 and the excited strip shrinks, as the sign of c says. Along x and along y the speed is the same. The deficit is the
//    lattice and not the step: at Scale 0 the panel's fronts run 8 percent slower than the continuous equation's.
// 2. The rotation period of a rigid spiral against dx and dt (a = 0.84, b = 0.1, eps = 0.05, a pair in a box of 48 by 48 units,
//    six probes on a circle of radius 14): 4.425 at dx 0.25 (h = 0.004 and 0.0025), 4.427 at 0.35, 4.437 to 4.442 at 0.5 (h =
//    0.0125 to 0.04), 4.469 at 0.63, 4.55 at 0.8 and 5.14 at 1.0, where the probes disagree by 0.24. The step moves the period by
//    0.1 percent at most, the grid by 3 percent at Scale 0 and 16 percent at 1.0. eps = 0.05 has thinner fronts than the
//    pattern's 0.085, and I did not run the period at 0.085, where the spiral is not rigid.
// 3. The resting state. A uniform u of 0.1185 decays and one of 0.1195 fires, and b / a is 0.1190. A small u decays at 1.406 per
//    time unit against b / (a eps) = 1.4006 from the linearisation. The smallest disc that fires at dx 0.8 has a radius of 1.0
//    unit (1.3 LED), and 0.8 does not.
// 4. The statistics against the step (dx 0.8, 4 seeds, 3000 units): tips 35.4, 35.0, 34.7 and the excited share 0.344, 0.352,
//    0.354 for h = 0.04, 0.02, 0.01.
// 5. Bounded. In 15 runs of 900 s (the opening, every knob at its minimum, every knob at its maximum, and the four corners of
//    Scale and Threshold at Flow 3 with three seeds each) u stayed in [0, 0.9978] and v in [0, 0.932], and the ectopic beat never
//    fired.
// 6. No die-out inside the knob ranges. 4 seeds of 10000 time units (a 900 s run reaches 4000 at most) at each of nine corners,
//    dx 0.63, 0.8 and 1.0 times b 0.065, 0.1 and 0.135: all alive. The thinnest corner is dx 0.63 with b 0.135: 7 tips at the
//    fewest, and 0.145 of the panel excited at the lowest, sampled every 5 units. Outside the ranges seeds did die: three at
//    b 0.03 to 0.05 in the first 35 time units, and one at eps 0.1 and dx 0.4 (a box of 26 by 51 units) after 215.
//
// The ectopic beat, the one thing that is not the equation. Nothing died inside the ranges, so it is a net and not a source.
// If under 5 percent of the panel has u above 0.5 (the lowest share at fixed knobs in the runs above is 0.117, with knobs
// gliding 0.091), a beat fires: eight discs of u = 1, 2 units in radius, at random places (S1), and 3.5 time units later eight
// more where the wake of the first rings has recovered half way (S2: u at rest, v between 0.3 and 0.55). The second wave runs back
// into recovered medium and not forward into the wake, so it is open at one end and curls into a spiral pair, which is how re-entry
// is started in tissue. With the field set to zero by hand (8 seeds) the panel came back to a stable tangle after 5 to 39 s, with
// 1 to 8 beats, and its excited share has stayed over 0.24 since. A single pair of discs does it as well, but slowly: 6 seeds of
// 160 s took 23 to 139 s and 4 to 30 beats; two pairs took 13 to 47 s. In 15 runs of 900 s at fixed knobs it never fired. When the
// knobs are thrown about (every 2.5 s to a random value or an end, 900 s), it fired 4, 12, 9 and 2 times in four runs, because
// a sudden jump of b can kill a thick wave, and 0 times in four runs where the knobs glide. A start whose run-up left under
// 0.1 of the panel excited is drawn again, up to four times. None of 175 fresh starts (seven knob settings, 25 each, 60 s each) began
// under 0.1 or dipped under 0.05. A field that goes non-finite starts over, and none did.
//
// Not checked. Values of a and eps other than the scanned ones, boxes other than the panel's (a bigger one gives more tips, a
// smaller one risks die-out, which is why Scale stops where it does), the lattice's anisotropy on diagonal fronts, a finer grid
// than the panel's other than in checks 1 and 2, and any statistic of the tips beyond their count. The numbers in the knob lines are
// from one to three seeds. What the real panel shows is the look.ts picture and no more.
//
// What the picture adds. All of it is the picture's choice and none of it is in the equations. A cell's colour is a function
// of (u, v) from a 33 by 33 table in Oklab, read bilinearly. The wake follows v: black at 0, deep teal at 0.03, teal by 0.3, a
// pale ember by 0.5 and orange above 0.65. The front follows u (a smoothstep from 0.4 to 0.9) and is cream where v is low, which
// is the leading edge, and orange where v is high, which is the body of the pulse. Every row of the table above v = 0 has a brightest
// channel of 39 or more, so only the last step before black is dim. The ramp is built by hand with no step of the HSV wheel in it.

const W = 64, H = 128, N = W * H;
const { floor, min, max, exp, pow, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const OPEN = [0, 2, 0, 0.06];

// ---- the tunables ---------------------------------------------------------------------------
const CFG = {
  a: 0.84, // the threshold of the cubic is (v + b) / a
  eps: 0.085, // the time scale of u; the front is about sqrt(2 eps) model units wide
  b0: 0.1, // b at Threshold 0
  bK: 0.035, // b is b0 + bK * Threshold: 0.065 at -1, 0.135 at 1
  dx0: 0.8, // model units per LED at Scale 0
  dxK: 1.27, // dx = dx0 * dxK^-Scale: 1.016 at -1, 0.63 at 1
  c0: 1.5, // model time units per panel second per unit of Flow
  hmax: 0.03, // Euler step in model time; the bound is 0.25 dx^2, which is 0.1 at the smallest dx
  hpre: 0.06, // the coarser step used for the run-up before the first frame
  pre: 24, // model time of that run-up
  follow: 0.35, // seconds dx and b take to follow the knobs
  actMin: 0.05, // an ectopic beat may fire when under this share of the panel has u > 0.5
  hold: 1, // seconds between ectopic beats
  foci: 8, // discs in one ectopic beat
  stimR: 2, // radius of a disc in model units
  s2delay: 3.5, // model time between the first discs and the second ones
  v0: 0.3, // the second discs go where the wake has v between this
  v1: 0.55, // and this
};

// ---- the medium -----------------------------------------------------------------------------
function newState(k) {
  return {
    u: new Float64Array(N), un: new Float64Array(N), v: new Float64Array(N), cand: new Int32Array(N),
    dx: dxOf(k[2]), b: bOf(k[3]), acc: 0, act: 0.3, quiet: 0, pending: -1, beats: 0, hue: k[0], lutHue: -1,
    lut: new Float32Array(33 * 33 * 3),
  };
}
const dxOf = (k) => CFG.dx0 * pow(CFG.dxK, -cl(k, -1, 1));
const bOf = (k) => CFG.b0 + CFG.bK * cl(k, -1, 1);

// One explicit Euler step of
//   u_t = lap u / dx^2 + u (1 - u) (u - (v + b) / a) / eps,    v_t = g(u) - v,
//   g = 0 for u < 1/3, 1 - 6.75 u (u - 1)^2 up to u = 1, 1 above,
// on the 64 by 128 torus with the five-point laplacian. v is updated in place from the old u.
function step(S, h) {
  const u = S.u, un = S.un, v = S.v, b = S.b, ia = 1 / CFG.a, Dd = h / (S.dx * S.dx), dte = h / CFG.eps;
  for (let y = 0; y < H; y++) {
    const y0 = y * W, ym = (y === 0 ? H - 1 : y - 1) * W, yp = (y === H - 1 ? 0 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const i = y0 + x;
      const xm = x === 0 ? y0 + W - 1 : i - 1, xp = x === W - 1 ? y0 : i + 1;
      const c = u[i], vv = v[i];
      un[i] = c + Dd * (u[xm] + u[xp] + u[ym + x] + u[yp + x] - 4 * c) + dte * c * (1 - c) * (c - (vv + b) * ia);
      const g = c < 0.3333333333 ? 0 : c > 1 ? 1 : 1 - 6.75 * c * (c - 1) * (c - 1);
      v[i] = vv + h * (g - vv);
    }
  }
  S.u = un;
  S.un = u;
}

// Share of the panel with u > 0.5, and the sum of u, which is not finite if the run ever went bad.
function activity(S) {
  const u = S.u;
  let c = 0, sum = 0;
  for (let i = 0; i < N; i++) {
    const x = u[i];
    sum += x;
    if (x > 0.5) c++;
  }
  S.act = c / N;
  return sum;
}

function disc(S, cx, cy, r) {
  const rl = (r / S.dx) * (r / S.dx);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let dx = x - cx, dy = y - cy;
      dx -= W * Math.round(dx / W);
      dy -= H * Math.round(dy / H);
      if (dx * dx + dy * dy < rl) S.u[y * W + x] = 1;
    }
}

// An ectopic beat, started the way a physiologist starts a spiral (S1 then S2). In a medium at rest a disc of u fires and a ring
// wave leaves it. A little later a second disc goes where the ring's wake has recovered half way (u at rest, v between v0 and v1):
// its wave runs back into recovered tissue and not forward into the wake, so it is open at one end and curls into a spiral pair.
// If a wake is still there the second discs go at once. One pair of discs was not enough (the pair annihilated itself, see the
// header), so a beat is CFG.foci of them.
function ectopic(S) {
  const u = S.u, v = S.v, cand = S.cand;
  let m = 0;
  for (let i = 0; i < N; i++) if (u[i] < 0.05 && v[i] > CFG.v0 && v[i] < CFG.v1) cand[m++] = i;
  if (m > 0) {
    for (let k = 0; k < CFG.foci; k++) {
      const i = cand[(Math.random() * m) | 0];
      disc(S, i % W, (i / W) | 0, CFG.stimR);
    }
    S.pending = -1;
  } else if (S.pending < 0) {
    for (let k = 0; k < CFG.foci; k++) disc(S, Math.random() * W, Math.random() * H, CFG.stimR);
    S.pending = CFG.s2delay;
  }
}

// The start: ten half discs, u = 1 on one half and v = 0.6 (refractory) on the other, at random places and turns. Each is a broken
// wave and curls into a spiral pair. A short run-up in coarse steps turns them into the tangle.
function seed(S) {
  const { u, v } = S;
  u.fill(0);
  v.fill(0);
  for (let k = 0; k < 10; k++) {
    const cx = Math.random() * W, cy = Math.random() * H, ang = Math.random() * TAU;
    const rr = (6 * (0.6 + 0.8 * Math.random())) / S.dx;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let dx = x - cx, dy = y - cy;
        dx -= W * Math.round(dx / W);
        dy -= H * Math.round(dy / H);
        if (dx * dx + dy * dy < rr * rr) {
          if (dx * cos(ang) + dy * sin(ang) > 0) u[y * W + x] = 1;
          else v[y * W + x] = 0.6;
        }
      }
  }
  for (let n = 0; n < CFG.pre / CFG.hpre; n++) step(S, min(CFG.hpre, 0.2 * S.dx * S.dx));
  S.acc = 0;
  S.pending = -1;
  return activity(S);
}

function start(params, k) {
  const S = (params.s = newState(k));
  // A start that died in the run-up is drawn again.
  for (let tries = 0; tries < 4; tries++) if (seed(S) > 0.1) break;
  buildLut(S, k[0]);
}

export function setup(params) {
  start(params, OPEN);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.5, 3), Ht = ft * flow * CFG.c0;
  S.hue = k[0];
  const f = 1 - exp(-ft / CFG.follow);
  S.dx += (dxOf(k[2]) - S.dx) * f;
  S.b += (bOf(k[3]) - S.b) * f;
  // Steps of CFG.hmax in model time; the remainder waits for the next frame, so the pace does not depend on the frame rate.
  S.acc += Ht;
  const hh = min(CFG.hmax, 0.2 * S.dx * S.dx);
  let n = floor(S.acc / hh);
  S.acc -= n * hh;
  while (n-- > 0) step(S, hh);
  // Never reached in the runs in the header. If the field ever went bad, start over.
  if (!isFinite(activity(S))) return start(params, k);
  // Ectopic beats: only while the medium is nearly quiet, and not twice within CFG.hold seconds.
  S.quiet = max(0, S.quiet - ft);
  if (S.pending >= 0) {
    S.pending -= Ht;
    if (S.pending < 0) {
      S.pending = -1;
      ectopic(S);
    }
  } else if (S.act < CFG.actMin && S.quiet <= 0) {
    ectopic(S);
    S.beats++;
    S.quiet = CFG.hold;
  }
}

// ---- colour ---------------------------------------------------------------------------------
function okRgb(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r;
      out[1] = g;
      out[2] = bb;
      return;
    }
  }
}
const enc = (v) => {
  v = cl(v, 0, 1);
  return ((v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0;
};
const RGB = [0, 0, 0];
// tail colour by v: [v, L, C, h]
const TAIL = [
  [0, 0.0, 0.0, 220],
  [0.03, 0.22, 0.05, 225],
  [0.12, 0.33, 0.075, 205],
  [0.3, 0.45, 0.09, 190],
  [0.5, 0.55, 0.12, 130],
  [0.65, 0.6, 0.14, 70],
  [1, 0.6, 0.14, 55],
];
const CREAM = [0.97, 0.06, 95], AMBER = [0.64, 0.15, 60];

function buildLut(S, hue) {
  S.lutHue = hue;
  const lut = S.lut;
  for (let iv = 0; iv <= 32; iv++) {
    const v = (iv / 32) * 0.9;
    let j = 1;
    while (j < TAIL.length - 1 && v > TAIL[j][0]) j++;
    const A = TAIL[j - 1], B = TAIL[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
    const tl = A[1] + (B[1] - A[1]) * t, tc = A[2] + (B[2] - A[2]) * t, th = A[3] + (B[3] - A[3]) * t;
    const q = 1 - sm(0.3, 0.8, v);
    for (let iu = 0; iu <= 32; iu++) {
      const s = sm(0.4, 0.9, iu / 32);
      // mix in Oklab (a, b) so the middle does not pass through green
      const ta = tc * cos((th * PI) / 180), tb = tc * sin((th * PI) / 180);
      const fL = AMBER[0] + (CREAM[0] - AMBER[0]) * q, fC = AMBER[1] + (CREAM[1] - AMBER[1]) * q, fH = AMBER[2] + (CREAM[2] - AMBER[2]) * q;
      const fa = fC * cos((fH * PI) / 180), fb = fC * sin((fH * PI) / 180);
      const L = tl + (fL - tl) * s, aa = ta + (fa - ta) * s, bb = tb + (fb - tb) * s;
      const C = sqrt(aa * aa + bb * bb), h = (Math.atan2(bb, aa) * 180) / PI + hue * 360;
      okRgb(L, C, h, RGB);
      const o = (iv * 33 + iu) * 3;
      lut[o] = enc(RGB[0]);
      lut[o + 1] = enc(RGB[1]);
      lut[o + 2] = enc(RGB[2]);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.hue, 0, 1);
  if (S.lutHue !== hue) buildLut(S, hue);
  const { u, v, lut } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const fu = cl(u[i], 0, 1) * 32, fv = cl(v[i] / 0.9, 0, 1) * 32;
      const iu = min(31, fu | 0), iv = min(31, fv | 0), tu = fu - iu, tv = fv - iv;
      const o00 = (iv * 33 + iu) * 3, o10 = o00 + 3, o01 = o00 + 99, o11 = o01 + 3;
      const w00 = (1 - tu) * (1 - tv), w10 = tu * (1 - tv), w01 = (1 - tu) * tv, w11 = tu * tv;
      display.setPixel(
        x, y,
        (lut[o00] * w00 + lut[o10] * w10 + lut[o01] * w01 + lut[o11] * w11 + 0.5) | 0,
        (lut[o00 + 1] * w00 + lut[o10 + 1] * w10 + lut[o01 + 1] * w01 + lut[o11 + 1] * w11 + 0.5) | 0,
        (lut[o00 + 2] * w00 + lut[o10 + 2] * w10 + lut[o01 + 2] * w01 + lut[o11 + 2] * w11 + 0.5) | 0,
      );
    }
}
