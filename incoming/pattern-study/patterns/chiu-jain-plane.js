// ===== Patternflow pattern =====
// Title:   Chiu-Jain Plane
// Family:  congestion
// Idea:    Two flows share one bottleneck link and the plane of their two sending rates shows how a rule of rate control moves them, the top square running additive increase and multiplicative decrease, whose sawtooth rolls up onto the fair point, and the square below running three other rules from the same start, none of which can.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dah-Ming Chiu and Raj Jain, "Analysis of the increase and decrease algorithms for congestion avoidance in computer networks" (1989), the plane of the two rates with an efficiency line and a fairness line, and the four rules AIMD, AIAD, MIMD and MIAD; Van Jacobson, "Congestion avoidance and control" (1988, from memory), the TCP window that made AIMD the rule of the internet; Raj Jain, Dah-Ming Chiu and William Hawe, the fairness index (1984, from memory); original code, pattern round 277
// Round:   277
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Backoff=0..4, Delay=0..6, Skew=-1..1
//
// Knob 1: Hue. Turns the four rules round the colour wheel together: AIMD is aqua (0.47), AIAD gold (0.12), MIMD blue-violet (0.69) and MIAD magenta (0.92) at 0, so nothing opens red, and 0.25 makes AIMD violet, 0.5 coral, 0.75 gold-green. The blue ground plate turns with them, by 0.11 sin(2 pi K) of a turn, teal at 0.75 and violet at 0.25, so K = 1 is K = 0 again. The lines and the glow at the fair point stay pale.
// Knob 2: Backoff. The multiplicative decrease factor beta = 0.4 + 0.5 (K / 4)^1.6: 0.40 at 0, 0.45 at 1, 0.565 at 2 where it opens, 0.715 at 3, 0.90 at 4. A cut takes (1 - beta) of the rate, so the sum falls from C to beta C and the dim line parallel to the efficiency line, drawn at beta C, is where the teeth bottom out. Over 600 s with the other knobs at the opening the pair cut every 1.70 s at 0 (1.7 teeth before one flow left, 2.7 s a trajectory), every 1.31 s at 2 (3.3 teeth, 4.2 s) and every 0.37 s at 4 (24.7 teeth, 9.5 s). A tooth is deep and rare at 0 and shallow and quick at 4, and the pair needs about fifteen times as many teeth to roll up at 4.
// Knob 3: Delay. How many round trips late a sender hears that the link was over capacity, 0 to 6, 0 where it opens, fractions allowed. The senders keep rising for that long past the efficiency line, and the cut comes when the news does. The median peak beyond the line, in LEDs across it, was 0.6 at 0 (one step), 3.5 at 3 and 6.1 at 6, and the teeth lengthen from 1.31 s to 1.44 and 1.47 s.
// Knob 4: Skew. The ratio of the two flows' increase speeds, a2 / a1 = 2^K, as if flow 2 had half the round-trip time at 1 and twice at -1. The attractor ray of AIMD turns from x1 / x2 = 1 to 2^-K, which is 63.4 degrees above the x1 axis at 1, 46.2 at the opening 0.06 and 26.6 at -1, and a lilac ray, faint where it still lies on the fairness line and clear from K = 0.14 out, shows it. The pair rolls up onto the ray, not the fair point: flow 2's share of the sum at a late cut had a median of 0.40 at -1, 0.53 at the opening (the ray says 0.51) and 0.60 at 1 (the ray says 0.67, and a trajectory ends before it has quite arrived).
//
// What the picture is. The plane of the sending rates of two flows on one link, one LED to a unit of rate, drawn twice. The panel is two squares of 64 x 64: x1 runs right and x2 up from the corner at column 3, row 60 of each square. The link has capacity C, 44 LEDs at the median (36 to 52 over the middle eighty percent of 600 s, 28 to 56 at the extremes). The efficiency line x1 + x2 = C is the bright warm line and nothing above it is carried. The fairness line x1 = x2 is the pale blue one, and where they cross, at (C / 2, C / 2), a soft glow marks the fair and efficient point. No numbers, no ticks, no arrowheads: only the plane.
// The rules. Each round trip every sender either gets news of an overload (the sum of the rates above C, d round trips ago) or does not. AIMD, the top square: x_i += a_i without news, x_i *= beta with it. Below, from the same start, AIAD (x_i += a_i, x_i -= delta_i, gold), MIMD (x_i *= 1.03, x_i *= beta, blue-violet) and MIAD (x_i *= 1.03, x_i -= delta_i, magenta). delta_i is (1 - beta) C / 2 scaled by a_i over the mean a, so that a cut of any rule takes (1 - beta) C from the sum. A rate never falls below 0.02. The increase a = C / 68 per round trip, times a factor from 0.76 to 1.32 drawn for each trajectory, so the tooth is as long in time at C = 30 as at C = 55.
// The geometry. AIMD's rise runs along the attractor ray's direction, so it does not change a pair's distance from that ray, and a cut multiplies every distance by beta, so one tooth shrinks the distance exactly beta times and the sawtooth rolls round the efficiency line down onto the ray. Measured on the running pair over 900 s at three knob settings (537 to 1151 cuts each) the ratio of the distance after a cut to the distance before was beta to five places (0.56494 at beta 0.5649, 0.45441 at 0.4544, 0.80382 at 0.8038) and a rise left it at 1.00000. AIAD goes up and down along the same direction, so it stays on a line parallel to the ray and never gets nearer. MIMD multiplies both flows by one factor, so it stays on the line through the start and the origin. MIAD raises the larger flow faster than the smaller one and cuts them equally, so the larger wins: it runs out along the efficiency line into the corner, where the smaller flow sits at its 0.02 floor. All of this is exact.
// The join. A new flow starts at 0.3 LED and doubles each round trip, the slow start, until it and the flow that stays fill the link. The flow that stays has been alone, so it sits anywhere in its own sawtooth, between beta C and C: its rate is C - (1 - beta) C (0.3 + 0.7 u), u drawn evenly. The pair is then on the efficiency line, a new trajectory begins from that point in all four rules at once, and a ring opens there. A trajectory ends when the AIMD pair is within 3.5 to 9.5 percent of C of the ray, after a wait of 0.3 to 1.8 s, or at 28 s: one flow leaves, a newcomer joins in the same flow's place or the other's by a coin toss, and the cycle starts again. A trajectory lasted 4.2 s at the opening, so about six were on the panel in any 25 s. The slow start is shared by the four rules and is drawn in the same pass, the bottom square's streak white where the three colours add, and it splits into three at the efficiency line.
// The feedback. The news at round trip n is about the state at n - d, with the two nearest states mixed for a fraction. A sender does not act on news of a state older than its own last cut (so one overload costs one cut, not d + 1). The link the senders meet is C times 1 + 0.035 xi, xi a shiver with a correlation time of 0.8 s, and once in 400 round trips, on average, it falls to 0.55 C for one or two round trips, a burst of other traffic. Neither is drawn: the peaks of the teeth miss the line by a LED or two. C itself walks in log C, an Ornstein-Uhlenbeck walk with sigma 0.17 and a time of 14 s pulling it back to 44, and every 14 to 44 s it steps by 22 to 42 percent in log, towards the middle more often than away. The efficiency line glides to a step in 0.22 s. Round trips run at 12 a second, wandering between 9.8 and 14.2 on a 9 s walk.
// How it is drawn. A stroke is a Gaussian of sigma 0.8 LED (1.9 LED at half height) stamped every half LED along the path, the same light per LED however the step is cut up, so the head's motion is continuous between round trips. Each stroke goes down twice, as fresh ink (a decay of 1.7 s) and as a ghost at 0.32 of its strength with a decay of 15 s, so the last two or three teeth are bright and the paths of the last 25 s stay as a faint web. Light adds and keeps its colour: the three channels are eased together by the brightest one, so a stack of strokes of one rule glows in its own colour and strokes of two rules mix. The bottom square's strokes are at 0.36 and the top's at 0.8 of full strength. The ground, a blue plate that is lighter inside the efficiency line and brighter again where 2 x1 x2 / (x1^2 + x2^2 + 4), raised to 2.6, is high (the fairness index of the pair, (x1 + x2)^2 / (2 (x1^2 + x2^2)) = (1 + that) / 2, near 1), is a drawing. The heads are soft white-tinted lumps with a halo. The ground, the line widths, the glows, the ghosts and the ring are drawn.
// What is exact and what is drawn. The rules, the feedback with its delay, the slow start, the ray and the distance to it are the model. The slow start's exit at the line (the real one waits for a loss), the lone flow's place in its sawtooth, the traffic shiver and bursts, the walk of C, the 0.02 floor, the 1.03 of MIMD and MIAD, the choice of delta, the a factor per trajectory, the time at which a pair leaves and every colour and width are drawn. Nothing is a function of time modulo a period: the trajectories begin when the pairs have rolled up, which is a random time.

const W = 64, H = 128, PW = 64;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function gauss() {
  const u = Math.random() + 1e-12, v = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * v);
}

const OX = 3, OY = 60;     // the origin of a plane: rate x1 is column OX + x1, rate x2 is row OY - x2 of the square
const TNEW = 1.7;          // seconds for fresh ink to fall to 1/e
const TOLD = 15;           // and for the ghost of a stroke that stays
const GI = 1.03;           // the multiplicative increase of MIMD and MIAD, per round trip
const NH = 32;             // history of the link's overload, in round trips
const LIFEMAX = 28;        // longest a pair may run before one leaves anyway, seconds
const AREF = 68;           // additive increase a = C / AREF per round trip, so a tooth is as long in time whatever C is

// the four rules: how a flow's rate goes up, and how it comes down
const AIMD = 0, AIAD = 1, MIMD = 2, MIAD = 3;
const HUE = [0.47, 0.12, 0.69, 0.92], SAT = [0.72, 0.8, 0.62, 0.68];

export function setup(params) {
  const mk = (kind, pl) => ({ kind, pl, ss: false, x: [0, 0], c: [0, 0], u: 0, n: 0, last: -99, hist: new Float64Array(NH), dec: false, ndec: 0 });
  params.s = {
    t: 0, k: null, ready: false,
    lc0: log(44), lc: log(44), lcs: log(44), jt: 12 + 20 * Math.random(),
    rr: 0, xi: 0, dip: 0, ak: 1, nf: 0,
    E: [new Float32Array(PW * PW * 3), new Float32Array(PW * PW * 3)],
    G: [new Float32Array(PW * PW * 3), new Float32Array(PW * PW * 3)],
    wd: [mk(AIMD, 0), mk(AIAD, 1), mk(MIMD, 1), mk(MIAD, 1)],
    hold: -1, life: 0, theta: 0.08, ring: 9, rx: 0, ry: 0,
    C: 44, beta: 0.7, dly: 0, a1: 0.6, a2: 0.6, d1: 6, d2: 6, r1: 0.7, r2: 0.7,
  };
}

// ---------------------------------------------------------------- the link
// One bottleneck of capacity C, in LEDs of rate. Other traffic shares it, so C wanders (an Ornstein-Uhlenbeck walk in
// log C) and now and then steps, and the efficiency line x1 + x2 = C follows.
function link(S, d) {
  S.lc += (S.lc0 - S.lc) * (d / 14) + 0.17 * sqrt((2 * d) / 14) * gauss();
  S.jt -= d;
  if (S.jt <= 0) {
    const up = Math.random() < 0.5 + 0.5 * cl((S.lc0 - S.lc) / 0.3, -0.7, 0.7);
    S.lc += (up ? 1 : -1) * (0.22 + 0.2 * Math.random());
    S.jt = 14 + 30 * Math.random();
  }
  S.lc = cl(S.lc, log(28), log(56));
  S.lcs += (S.lc - S.lcs) * (1 - exp(-d / 0.22));
  S.C = exp(S.lcs);
  S.rr += (-S.rr / 9) * d + 0.9 * sqrt((2 * d) / 9) * gauss();
  S.rr = cl(S.rr, -2.2, 2.2);
  // other traffic: the capacity the flows meet shivers a little round trip to round trip, and now and then a short
  // burst of it takes more than half the link for a moment
  S.xi += (-S.xi / 0.8) * d + sqrt((2 * d) / 0.8) * gauss();
  S.xi = cl(S.xi, -2.5, 2.5);
}

// the knobs, as quantities
function derive(S) {
  const k = S.k;
  const C = S.C, beta = 0.4 + 0.5 * pow(cl(k[1], 0, 4) / 4, 1.6), sk = cl(k[3], -1, 1);
  S.beta = beta;
  S.Ce = C * (1 + 0.035 * S.xi) * (S.dip > 0 ? 0.55 : 1);
  S.dly = cl(k[2], 0, 6);
  const a = (C * S.ak) / AREF;
  S.a1 = a * pow(2, -sk / 2);
  S.a2 = a * pow(2, sk / 2);
  const dl = ((1 - beta) * C) / 2, am = (S.a1 + S.a2) / 2;
  S.d1 = (dl * S.a1) / am;
  S.d2 = (dl * S.a2) / am;
  const an = sqrt(S.a1 * S.a1 + S.a2 * S.a2);
  S.r1 = S.a1 / an;
  S.r2 = S.a2 / an;
}

// ---------------------------------------------------------------- a pair of flows under one rule
// The state of round trip n is x. A sender learns of an overload d round trips late, so at step n it acts on
// the link's state at n - d, and it does not act on news of a state older than its own last cut.
function step(S, w) {
  if (w.ss) {
    w.dec = false;
    // a new flow doubles each round trip until the two of them fill the link, and the pair is then where AIMD begins
    const nf = S.nf, lim = max(S.C - w.x[1 - nf] + 0.3, 0.07 * S.C);
    if (w.x[nf] * 2 >= lim) {
      w.x[nf] = lim;
      w.ss = false;
      w.n = 0;
    } else w.x[nf] *= 2;
    return;
  }
  const n = w.n, x = w.x, C = S.Ce;
  w.hist[n % NH] = x[0] + x[1] - C;
  const tau = n - S.dly;
  let sig = false;
  if (tau >= 0 && tau >= w.last + 1 - 1e-9) {
    const i0 = floor(tau), f = tau - i0;
    const m0 = w.hist[i0 % NH], m1 = f > 1e-9 ? w.hist[min(n, i0 + 1) % NH] : m0;
    sig = m0 * (1 - f) + m1 * f > 0;
  }
  w.dec = sig;
  const kind = w.kind;
  if (sig) {
    w.last = n;
    if (kind === AIMD || kind === MIMD) {
      x[0] *= S.beta;
      x[1] *= S.beta;
    } else {
      x[0] = max(0.02, x[0] - S.d1);
      x[1] = max(0.02, x[1] - S.d2);
    }
    w.ndec++;
  } else if (kind === AIMD || kind === AIAD) {
    x[0] += S.a1;
    x[1] += S.a2;
  } else {
    x[0] *= GI;
    x[1] *= GI;
  }
  x[0] = cl(x[0], 0.02, 61);
  x[1] = cl(x[1], 0.02, 61);
  w.n = n + 1;
}

// A new flow joins at almost no rate and doubles each round trip (slow start) until it and the flow that stays fill
// the link. The one that stays has been alone on the link, and a lone flow sits anywhere in its own sawtooth between
// beta C and C, so the newcomer ends with the room that is left. All four rules start from this one point.
function launch(S) {
  const C = S.C, nf = Math.random() < 0.5 ? 0 : 1;
  S.nf = nf;
  S.ak = exp(0.28 * (2 * Math.random() - 1));
  derive(S);
  const xo = C - (1 - S.beta) * C * (0.3 + 0.7 * Math.random());
  for (const w of S.wd) {
    w.x[nf] = 0.3;
    w.x[1 - nf] = xo;
    w.c[0] = w.x[0]; w.c[1] = w.x[1];
    w.n = 0; w.last = -99; w.ndec = 0; w.u = 0; w.ss = true;
    w.hist.fill(-1e3);
    step(S, w);
  }
  S.hold = -1;
  S.life = 0;
  S.theta = 0.035 + 0.06 * Math.random();
  S.ring = 0;
  S.rx = w0(S, 0);
  S.ry = w0(S, 1);
}
const w0 = (S, i) => S.wd[0].c[i];

// ---------------------------------------------------------------- drawing into the trails
const SIG = 0.8, SPACE = 0.5;
const FRESH = 1, GHOST = 0.32;   // a stroke goes down as fresh ink and as a ghost that stays

// energy: a soft stroke of width sigma between two rate points, the same energy per LED of path however it is cut up
function stroke(S, w, ax, ay, bx, by, col, amp) {
  const E = S.E[w.pl], G = S.G[w.pl];
  const pax = OX + ax, pay = OY - ay, pbx = OX + bx, pby = OY - by;
  const L = sqrt((pbx - pax) * (pbx - pax) + (pby - pay) * (pby - pay));
  const n = max(1, ceil(L / SPACE)), A = (amp * (L > 0 ? L / n : SPACE)) / (SIG * 2.5066);
  const is2 = 1 / (2 * SIG * SIG), R = 2;
  for (let i = 1; i <= n; i++) {
    const f = i / n, cx = pax + (pbx - pax) * f, cy = pay + (pby - pay) * f;
    const x0 = max(0, floor(cx) - R), x1 = min(PW - 1, floor(cx) + R);
    const y0 = max(0, floor(cy) - R), y1 = min(PW - 1, floor(cy) + R);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, a = A * exp(-(dx * dx + dy * dy) * is2);
        const o = (y * PW + x) * 3;
        E[o] += col[0] * a * FRESH;
        E[o + 1] += col[1] * a * FRESH;
        E[o + 2] += col[2] * a * FRESH;
        G[o] += col[0] * a * GHOST;
        G[o + 1] += col[1] * a * GHOST;
        G[o + 2] += col[2] * a * GHOST;
      }
  }
}

const COL = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];

// the clock of one frame: the link, the knobs, the trails fading, the pairs moving along their round trips
function advance(S, d) {
  link(S, d);
  derive(S);
  const f1 = exp(-d / TNEW), f2 = exp(-d / TOLD);
  for (let p = 0; p < 2; p++) {
    const E = S.E[p], G = S.G[p];
    for (let i = 0; i < E.length; i++) {
      E[i] *= f1;
      G[i] *= f2;
    }
  }
  const rate = 12 + S.rr;
  let du = d * rate;
  S.life += d;
  const top = S.wd[0];
  while (du > 1e-9) {
    const take = min(du, 1 - top.u);
    for (const w of S.wd) {
      const f0 = w.u, f1 = w.u + take;
      stroke(S, w, w.c[0] + (w.x[0] - w.c[0]) * f0, w.c[1] + (w.x[1] - w.c[1]) * f0, w.c[0] + (w.x[0] - w.c[0]) * f1, w.c[1] + (w.x[1] - w.c[1]) * f1, COL[w.kind], w.pl ? 0.36 : 0.8);
      w.u = f1;
    }
    du -= take;
    if (top.u >= 1 - 1e-9) {
      S.dip = S.dip > 0 ? S.dip - 1 : Math.random() < 1 / 400 ? 1 + floor(1.8 * Math.random()) : 0;
      derive(S);
      for (const w of S.wd) {
        w.c[0] = w.x[0]; w.c[1] = w.x[1]; w.u = 0;
        step(S, w);
      }
      if (top.dec) {
        // the distance of the pair from the attractor ray: each cut shrinks it by beta, a rise leaves it alone
        const e = abs(top.x[0] * S.r2 - top.x[1] * S.r1);
        if (e < S.theta * S.C && S.hold < 0) S.hold = 0.3 + 1.5 * Math.random();
      }
    }
  }
  if (S.hold >= 0) {
    S.hold -= d;
    if (S.hold < 0.0001) launch(S);
  } else if (S.life > LIFEMAX) launch(S);
  S.ring += d;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  for (let i = 0; i < 4; i++) hsv(HUE[i] + S.k[0], SAT[i], 1, COL[i]);
  if (!S.ready) {
    S.ready = true;
    S.C = exp(S.lcs);
    S.Ce = S.C;
    derive(S);
    launch(S);
    for (let i = 0; i < 120; i++) advance(S, 0.2);
  }
  S.t += d;
  advance(S, d);
}

// ---------------------------------------------------------------- the picture
const BUF = new Float32Array(W * H * 3);
const WH = [1, 1, 1];
const GB = [0, 0, 0], GL = [0, 0, 0], GW = [0, 0, 0];

// a turn of a colour round the grey axis
function rot(o, r, g, b, c, s) {
  o[0] = r * (0.213 + c * 0.787 - s * 0.213) + g * (0.715 - c * 0.715 - s * 0.715) + b * (0.072 - c * 0.072 + s * 0.928);
  o[1] = r * (0.213 - c * 0.213 + s * 0.143) + g * (0.715 + c * 0.285 + s * 0.14) + b * (0.072 - c * 0.072 - s * 0.283);
  o[2] = r * (0.213 - c * 0.213 - s * 0.787) + g * (0.715 - c * 0.715 + s * 0.715) + b * (0.072 + c * 0.928 + s * 0.072);
}

function lump(cx, cy, sig, amp, c) {
  const R = floor(sig * 3.2) + 1, is2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R);
  const y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, a = 255 * amp * exp(-(dx * dx + dy * dy) * is2);
      const o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

function ringAt(cx, cy, rad, amp, c) {
  const R = ceil(rad + 4);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R);
  const y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, q = sqrt(dx * dx + dy * dy) - rad, a = 255 * amp * exp(-(q * q) / 1.6);
      const o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const C = S.C, sk = cl(S.k[3], -1, 1);
  const an = sqrt(S.a1 * S.a1 + S.a2 * S.a2), q1 = S.a1 / an, q2 = S.a2 / an;
  const rayK = sm(0.01, 0.14, abs(sk));
  const gh = 0.11 * sin(TAU * S.k[0]), ca = cos(TAU * gh), sa = sin(TAU * gh);
  rot(GB, 16, 22, 60, ca, sa);
  rot(GL, 10, 28, 46, ca, sa);
  rot(GW, 8, 14, 22, ca, sa);
  const iS = 1 / (2 * 0.9 * 0.9), ix = 1 / (2 * 0.9 * 0.9);

  for (let pl = 0; pl < 2; pl++) {
    const E = S.E[pl], G = S.G[pl], oy = pl * PW;
    for (let py = 0; py < PW; py++) {
      const x2 = OY - py;
      for (let px = 0; px < PW; px++) {
        const x1 = px - OX, s = x1 + x2;
        // the ground: a deep blue plate, lighter inside the efficiency line where the pair may run, and a soft glow
        // where fairness and efficiency are both met
        let r = GB[0], g = GB[1], b = GB[2];
        if (x1 > -0.5 && x2 > -0.5) {
          const ins = 1 - sm(-5, 2, s - C);
          const bm = pow((2 * max(x1, 0) * max(x2, 0)) / (x1 * x1 + x2 * x2 + 4), 2.6);
          const F = ins * (0.55 + 0.45 * sm(0, 0.35 * C, s) * bm * 2), Fw = ins * bm;
          r += GL[0] * F + GW[0] * Fw; g += GL[1] * F + GW[1] * Fw; b += GL[2] * F + GW[2] * Fw;
        }
        // efficiency line, the fairness line, the attractor ray and the two axes, 2 LEDs thick
        let de = (s - C) * 0.7071;
        if (de < 3.6 && de > -3.6 && x1 > -2 && x2 > -2) {
          const v = exp(-de * de * iS) * sm(-2, 0, x1) * sm(-2, 0, x2);
          r += 232 * 0.72 * v; g += 226 * 0.72 * v; b += 205 * 0.72 * v;
        }
        de = (s - S.beta * C) * 0.7071;
        if (de < 3.6 && de > -3.6 && x1 > -2 && x2 > -2) {
          const v = exp(-de * de * iS) * sm(-2, 0, x1) * sm(-2, 0, x2) * 0.2;
          r += 150 * v; g += 170 * v; b += 215 * v;
        }
        de = (x1 - x2) * 0.7071;
        if (de < 3.6 && de > -3.6 && s > -1) {
          const v = exp(-de * de * iS) * sm(-1, 2, s) * 0.24;
          r += 120 * v; g += 160 * v; b += 225 * v;
        }
        de = x1 * q2 - x2 * q1;
        if (rayK > 0 && de < 3.6 && de > -3.6 && s > -1) {
          const v = exp(-de * de * iS) * sm(-1, 2, s) * 0.55 * rayK;
          r += 190 * v; g += 150 * v; b += 245 * v;
        }
        if (x2 > -3.5 && x2 < 3.5 && x1 > -1) {
          const v = exp(-x2 * x2 * ix) * 0.2;
          r += 90 * v; g += 115 * v; b += 170 * v;
        }
        if (x1 > -3.5 && x1 < 3.5 && x2 > -1) {
          const v = exp(-x1 * x1 * ix) * 0.2;
          r += 90 * v; g += 115 * v; b += 170 * v;
        }
        const e = (py * PW + px) * 3, o = ((oy + py) * W + px) * 3;
        // trails add in light and keep their colour: the brightest channel is eased, the three together
        const ea = E[e] + G[e], eb = E[e + 1] + G[e + 1], ec = E[e + 2] + G[e + 2], v = max(ea, eb, ec);
        const tn = v > 1e-4 ? (255 * (1 - exp(-v))) / v : 0;
        BUF[o] = min(255, r + ea * tn);
        BUF[o + 1] = min(255, g + eb * tn);
        BUF[o + 2] = min(255, b + ec * tn);
      }
    }
    // the fair point, a soft glow where both lines meet
    lump(OX + C / 2, oy + OY - C / 2, 3.8, 0.28, WH);
    lump(OX + C / 2, oy + OY - C / 2, 1.5, 0.3, WH);
  }

  for (const w of S.wd) {
    const hx = w.c[0] + (w.x[0] - w.c[0]) * w.u, hy = w.c[1] + (w.x[1] - w.c[1]) * w.u;
    const c = COL[w.kind], m = [0.5 + 0.5 * c[0], 0.5 + 0.5 * c[1], 0.5 + 0.5 * c[2]];
    lump(OX + hx, w.pl * PW + OY - hy, 3.2, 0.2, c);
    lump(OX + hx, w.pl * PW + OY - hy, 1.35, 0.9, m);
  }
  if (S.ring < 1.4) {
    const f = S.ring / 1.4, a = 0.75 * (1 - f) * (1 - f), rad = 1 + 7 * f;
    ringAt(OX + S.rx, OY - S.ry, rad, a, COL[0]);
    ringAt(OX + S.rx, PW + OY - S.ry, rad, a, WH);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r < 0 ? 0 : r > 255 ? 255 : r | 0, g < 0 ? 0 : g > 255 ? 255 : g | 0, b < 0 ? 0 : b > 255 ? 255 : b | 0);
    }
}
