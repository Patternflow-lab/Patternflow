// ===== Patternflow pattern =====
// Title:   Chiu-Jain Plane
// Family:  congestion
// Idea:    Two flows share one bottleneck link and the plane of their two sending rates shows how a rule of rate control moves them, the top square running additive increase and multiplicative decrease, whose sawtooth rolls up onto a wandering target, and the square below running three other rules from the same start, none of which can.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dah-Ming Chiu and Raj Jain, "Analysis of the increase and decrease algorithms for congestion avoidance in computer networks" (1989), the plane of the two rates with an efficiency line and a fairness line, and the four rules AIMD, AIAD, MIMD and MIAD; Van Jacobson, "Congestion avoidance and control" (1988, from memory), the TCP window that made AIMD the rule of the internet; Raj Jain, Dah-Ming Chiu and William Hawe, the fairness index (1984, from memory); original code, pattern round 277
// Round:   277
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Backoff=0..4, Delay=0..6, Skew=-1..1
//
// Knob 1: Hue. Turns the four rules round the colour wheel together: at 0 AIMD is aqua with violet cuts, AIAD gold, MIMD blue and MIAD pink, so nothing opens red; 0.25 makes AIMD violet, 0.5 coral, 0.75 gold-green. The blue plate and the dark red-brown beyond the line turn by 0.11 sin(2 pi K) of a turn, so K = 1 is K = 0 again. The lines and the glow at the fair point stay pale.
// Knob 2: Backoff. The multiplicative decrease factor the pairs are drawn round, beta = 0.45 + 0.45 (K / 4)^1.6: 0.45 at 0, 0.50 at 1, 0.60 at 2 where it opens, 0.73 at 3, 0.90 at 4. Each pair has its own, 1 - (1 - beta) e^(0.4 u) with u drawn for the pair, kept between 0.3 and 0.95. A cut takes (1 - beta) of the rate and the dim line parallel to the efficiency line, at beta C, is where the teeth bottom out. Over 600 s with the other knobs at the opening the pair cut every 1.42 s at 0 (3.5 teeth a trajectory), 1.16 s at 2 (5.1 teeth) and 0.32 s at 4 (29.1 teeth).
// Knob 3: Delay. How many round trips late a sender hears that the link was over capacity, 0 to 6, 0 where it opens, fractions allowed. The senders keep rising for that long past the efficiency line and the cut comes when the news does. The median peak beyond the line, in LEDs across it, was 0.5 at 0 (one step), 3.1 at 3 and 5.7 at 6. A cut that is smaller than (d + 1) rises cannot bring the sum under C: at beta above about 0.8 and 6 round trips the pair stays above the line.
// Knob 4: Skew. The ratio of the two flows' increase speeds, a2 / a1 = 2^(K + w), as if flow 2 had half the round-trip time at 1 and twice at -1. w is not the knob: it drifts by up to 0.5 either side, on clocks of 43.7 s and 71.3 s and a slow walk of 18 s, so the attractor ray of AIMD, x1 / x2 = a1 / a2, which stands 45 degrees up at w + K = 0 and 63 degrees at 1, never rests. A lilac ray, with a small lilac glow where it meets the efficiency line, shows it, faint while it lies on the fairness line and clear from 0.2 out. The pair rolls up onto the ray, not the fair point.
//
// What the picture is. The plane of the sending rates of two flows on one link, one LED to a unit of rate, drawn twice. The panel is two squares of 64 x 64: x1 runs right and x2 up from the corner at column 3, row 60 of each square. The link has capacity C: 33 LEDs at the median over 600 s, 22 to 49 over the middle eighty percent and 19 to 57 at the extremes, so the efficiency line x1 + x2 = C, the bright warm line, swings from near the origin to near the far corner. Inside it is a blue plate, lighter where the fairness index (x1 + x2)^2 / (2 (x1^2 + x2^2)) is near 1; beyond it a thin dark red-brown where the link drops what is sent. The fairness line x1 = x2 is the pale blue line, and a soft glow sits at (C / 2, C / 2). No numbers, no ticks, no arrowheads.
// The rules. Each round trip every sender either gets news of an overload (the sum of the rates above C, d round trips ago) or does not. AIMD, the top square: x_i += a_i without news, x_i *= beta with it, a = C / 68 times a factor from 0.61 to 1.65 for each pair. Below, from the same start, AIAD (x_i += a_i, x_i -= delta_i), MIMD (x_i *= 1.03, x_i *= beta) and MIAD (x_i *= 1.03, x_i -= delta_i). delta_i is (1 - beta) C / 2 scaled by a_i over the mean a, so a cut of any rule takes (1 - beta) C from the sum. A rate never falls below 0.02. Each pair also has its own round-trip rate, 12 a second (9.8 to 14.2) times 0.78 to 1.28. A rise is light, a cut leans to violet.
// The geometry. AIMD's rise runs along the attractor ray's direction, so it leaves a pair's distance from the ray as it was, and a cut multiplies every distance by beta, so one tooth shrinks the distance exactly beta times and the sawtooth rolls round the efficiency line down onto the ray. Measured on the running pair, the ray wandering, over 900 s at two knob settings (573 and 750 cuts) the ratio of the distance after a cut to the distance before was the pair's beta to five places and a rise left it at 1.00000. AIAD goes up and down along the same direction, so it stays on a line parallel to the ray. MIMD multiplies both flows by one factor, so it stays on the line through the start and the origin. MIAD raises the larger flow faster and cuts them equally, so it runs out along the efficiency line into the corner. All of this is exact.
// The starts. Three ways, never the way the last pair began. A new flow starts at 0.3 LED and doubles each round trip (slow start) until it and the flow that stays fill the link; the one that stays has been alone, so it sits anywhere in its own sawtooth, between beta C and C, and the newcomer takes the room that is left. Flow 2 joins with flow 1 nearly alone (the bottom right of the plane), or flow 1 joins (the top left). Or the pair is already fair, on the fairness line, and the link steps by 0.38 to 0.63 in log C (1.5 to 1.9 times up, 0.53 to 0.68 times down), so the pair climbs the diagonal to the new line or is cut back along it. All four rules start from the same point and a ring opens there. A trajectory ends 1.5 to 5 s after the AIMD pair comes within 3.5 to 9.5 percent of C of the ray, or at 22 s: one flow leaves and the next pair begins. A trajectory lasted 6.2 s at the opening, so about four were on the panel in 25 s.
// The feedback. The news at round trip n is about the state at n - d, the two nearest states mixed for a fraction. A sender does not act on news of a state older than its own last cut, so one overload costs one cut, not d + 1. The link the senders meet is C times 1 + 0.035 xi, xi a shiver with a correlation time of 0.8 s, and once in 400 round trips it falls to 0.55 C for one or two (a burst of other traffic); neither is drawn. C walks in log C, an Ornstein-Uhlenbeck walk with sigma 0.3 and a time of 12 s, and every 12 to 36 s it steps by 0.3 to 0.55 in log C, more often towards the middle. The line glides to a step in 0.22 s.
// How it is drawn. A stroke is a Gaussian of sigma 0.8 LED stamped every half LED, the same light per LED however the step is cut up. Each goes down twice, as fresh ink that fades with a time of 4.5 s and as a ghost that stays 30 s, strong for a cut (0.9) and weak for a rise (0.3): the last few teeth are bright and the cuts of the last half minute stay as a fan of violet rays that all point at the origin. Light adds and keeps its colour, eased by the brightest channel to 205 of 255, so a stack of strokes glows in its colour and never goes white; white is for the lines and heads. The strokes are at 0.5 in the top square and 0.3 in the bottom.
// What is exact and what is drawn. The rules, the feedback with its delay, the slow start, the ray and the distance to it are the model. The slow start's exit at the line (the real one waits for a loss), the lone flow's place in its sawtooth, the traffic shiver and bursts, the walks of C and of the round-trip ratio, the per-pair beta, a and rate, the 0.02 floor, the 1.03, the choice of delta, when a pair leaves, and every colour, width and glow are drawn. Nothing is a function of time modulo a period.

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
const TNEW = 4.5;          // seconds for fresh ink to fall to 1/e
const TOLD = 30;           // and for the ghost of a stroke that stays
const GI = 1.03;           // the multiplicative increase of MIMD and MIAD, per round trip
const NH = 32;             // history of the link's overload, in round trips
const LIFEMAX = 22;        // longest a pair may run before one leaves anyway, seconds
const AREF = 68;           // additive increase a = C / AREF per round trip, so a tooth is as long in time whatever C is

// the four rules: how a flow's rate goes up, and how it comes down
const AIMD = 0, AIAD = 1, MIMD = 2, MIAD = 3;
// a stroke is a rise or a cut, and each rule has a colour for each: the rises are the light ones, the cuts lean to violet
const HUE = [0.5, 0.13, 0.62, 0.88], SAT = [0.55, 0.7, 0.6, 0.6];
const CUT = [0.74, 0.04, 0.8, 0.96], CSAT = [0.72, 0.82, 0.72, 0.7];

export function setup(params) {
  const mk = (kind, pl) => ({ kind, pl, ss: false, x: [0, 0], c: [0, 0], u: 0, n: 0, last: -99, hist: new Float64Array(NH), dec: false, ndec: 0 });
  params.s = {
    t: 0, k: null, ready: false,
    lc0: log(38), lc: log(38), lcs: log(38), jt: 10 + 16 * Math.random(),
    rr: 0, xi: 0, dip: 0, ak: 1, nf: 0, ty: -1, rk: 1, bm: 1, bp: 0.565, bv: 0.565, wo: 0, skw: 0, skE: 0,
    ph: [TAU * Math.random(), TAU * Math.random()],
    E: [new Float32Array(PW * PW * 3), new Float32Array(PW * PW * 3)],
    G: [new Float32Array(PW * PW * 3), new Float32Array(PW * PW * 3)],
    wd: [mk(AIMD, 0), mk(AIAD, 1), mk(MIMD, 1), mk(MIAD, 1)],
    hold: -1, life: 0, theta: 0.08, ring: 9, rx: 0, ry: 0,
    C: 38, beta: 0.7, dly: 0, a1: 0.6, a2: 0.6, d1: 6, d2: 6, r1: 0.7, r2: 0.7,
  };
}

// ---------------------------------------------------------------- the link
// One bottleneck of capacity C, in LEDs of rate. Other traffic shares it, so C wanders (an Ornstein-Uhlenbeck walk in
// log C) and now and then steps, and the efficiency line x1 + x2 = C follows.
function link(S, d) {
  S.lc += (S.lc0 - S.lc) * (d / 12) + 0.3 * sqrt((2 * d) / 12) * gauss();
  S.jt -= d;
  if (S.jt <= 0) {
    const up = Math.random() < 0.5 + 0.5 * cl((S.lc0 - S.lc) / 0.4, -0.7, 0.7);
    S.lc += (up ? 1 : -1) * (0.3 + 0.25 * Math.random());
    S.jt = 12 + 24 * Math.random();
  }
  S.lc = cl(S.lc, log(19), log(58));
  S.lcs += (S.lc - S.lcs) * (1 - exp(-d / 0.22));
  S.C = exp(S.lcs);
  S.rr += (-S.rr / 9) * d + 0.9 * sqrt((2 * d) / 9) * gauss();
  S.rr = cl(S.rr, -2.2, 2.2);
  // other traffic: the capacity the flows meet shivers a little round trip to round trip, and now and then a short
  // burst of it takes more than half the link for a moment
  S.xi += (-S.xi / 0.8) * d + sqrt((2 * d) / 0.8) * gauss();
  S.xi = cl(S.xi, -2.5, 2.5);
  // the round-trip ratio of the two flows drifts round the Skew knob on two clocks that share no period and a slow walk
  S.wo += (-S.wo / 18) * d + sqrt((2 * d) / 18) * gauss();
  S.wo = cl(S.wo, -2, 2);
  S.skw = cl(0.27 * sin((TAU * S.t) / 43.7 + S.ph[0]) + 0.2 * sin((TAU * S.t) / 71.3 + S.ph[1]) + 0.12 * S.wo, -0.5, 0.5);
  S.bv += (S.bp - S.bv) * (1 - exp(-d / 0.5));
}

// the knobs, as quantities
function derive(S) {
  const k = S.k;
  const C = S.C, kb = 0.45 + 0.45 * pow(cl(k[1], 0, 4) / 4, 1.6), sk = cl(k[3], -1, 1) + S.skw;
  S.kb = kb;
  S.skE = sk;
  // each pair has a beta of its own, round the knob's: 1 - (1 - kb) e^(0.28 u), u fixed for the pair
  const beta = cl(1 - (1 - kb) * S.bm, 0.3, 0.95);
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

// Three ways for a pair to begin, never the way the last one began. A new flow joins at almost no rate and doubles each
// round trip (slow start) until it and the flow that stays fill the link; the flow that stays has been alone, so it sits
// anywhere in its own sawtooth between beta C and C and the newcomer takes the room that is left. It can be flow 2 that
// joins, with flow 1 nearly alone (the bottom right of the plane), or flow 1, with flow 2 nearly alone (the top left). Or
// the pair is already fair, sitting on the fairness line, and the link steps to a new capacity, so the pair is swept
// along the diagonal to the new line. All four rules start from the same point.
function launch(S) {
  let ty;
  do {
    const r = Math.random();
    ty = r < 0.36 ? 0 : r < 0.72 ? 1 : 2;
  } while (ty === S.ty);
  S.ty = ty;
  S.ak = exp(0.5 * (2 * Math.random() - 1));
  S.rk = exp(0.25 * (2 * Math.random() - 1));
  S.bm = exp(0.4 * (2 * Math.random() - 1));
  derive(S);
  S.bp = S.beta;
  const C = S.C, p = [0, 0];
  let ss = false;
  if (ty < 2) {
    const nf = ty === 0 ? 0 : 1, xo = C - (1 - S.beta) * C * (0.2 + 0.8 * Math.random());
    S.nf = nf;
    p[nf] = 0.3;
    p[1 - nf] = xo;
    ss = true;
  } else {
    const s0 = C * (0.35 + 0.5 * Math.random()), e = (0.05 + 0.1 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    p[0] = (s0 / 2) * (1 + e);
    p[1] = (s0 / 2) * (1 - e);
    // the step: the link goes up (a long climb along the diagonal) or down to below the pair (a run of cuts)
    const up = Math.random() < 0.5;
    S.lc = cl(S.lc + (up ? 1 : -1) * (0.38 + 0.25 * Math.random()), log(19), log(58));
    S.jt = 12 + 24 * Math.random();
  }
  for (const w of S.wd) {
    w.x[0] = p[0]; w.x[1] = p[1];
    w.c[0] = p[0]; w.c[1] = p[1];
    w.n = 0; w.last = -99; w.ndec = 0; w.u = 0; w.ss = ss;
    w.hist.fill(-1e3);
    step(S, w);
  }
  S.hold = -1;
  S.life = 0;
  S.theta = 0.035 + 0.06 * Math.random();
  S.ring = 0;
  S.rx = p[0];
  S.ry = p[1];
}

// ---------------------------------------------------------------- drawing into the trails
const SIG = 0.8, SPACE = 0.5;
const FRESH = 1, GHOSTR = 0.3, GHOSTC = 0.9;   // a stroke goes down as fresh ink and as a ghost that stays, a cut far longer than a rise

// energy: a soft stroke of width sigma between two rate points, the same energy per LED of path however it is cut up
function stroke(S, w, ax, ay, bx, by, col, amp) {
  const E = S.E[w.pl], G = S.G[w.pl], GHOST = w.dec ? GHOSTC : GHOSTR;
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

const COL = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], CCUT = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];

// the clock of one frame: the link, the knobs, the trails fading, the pairs moving along their round trips
function advance(S, d) {
  S.t += d;
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
  const rate = (12 + S.rr) * S.rk;
  let du = d * rate;
  S.life += d;
  const top = S.wd[0];
  while (du > 1e-9) {
    const take = min(du, 1 - top.u);
    for (const w of S.wd) {
      const f0 = w.u, f1 = w.u + take;
      stroke(S, w, w.c[0] + (w.x[0] - w.c[0]) * f0, w.c[1] + (w.x[1] - w.c[1]) * f0, w.c[0] + (w.x[0] - w.c[0]) * f1, w.c[1] + (w.x[1] - w.c[1]) * f1, w.dec ? CCUT[w.kind] : COL[w.kind], w.pl ? 0.3 : 0.5);
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
        if (e < S.theta * S.C && S.hold < 0) S.hold = 1.5 + 3.5 * Math.random();
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
  for (let i = 0; i < 4; i++) {
    hsv(HUE[i] + S.k[0], SAT[i], 1, COL[i]);
    hsv(CUT[i] + S.k[0], CSAT[i], 0.92, CCUT[i]);
  }
  if (!S.ready) {
    S.ready = true;
    S.C = exp(S.lcs);
    S.Ce = S.C;
    derive(S);
    launch(S);
    for (let i = 0; i < 120; i++) advance(S, 0.25);
  }
  advance(S, d);
}

// ---------------------------------------------------------------- the picture
const BUF = new Float32Array(W * H * 3);
const WH = [1, 1, 1];
const GB = [0, 0, 0], GL = [0, 0, 0], GW = [0, 0, 0], GO = [0, 0, 0];

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
  const C = S.C, sk = S.skE;
  const an = sqrt(S.a1 * S.a1 + S.a2 * S.a2), q1 = S.a1 / an, q2 = S.a2 / an;
  const rayK = sm(0.03, 0.2, abs(sk));
  const gh = 0.11 * sin(TAU * S.k[0]), ca = cos(TAU * gh), sa = sin(TAU * gh);
  rot(GB, 16, 22, 60, ca, sa);
  rot(GL, 10, 28, 46, ca, sa);
  rot(GW, 8, 14, 22, ca, sa);
  rot(GO, 30, 20, 27, ca, sa);
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
          const ins = 1 - sm(-4, 2, s - C);
          const bm = pow((2 * max(x1, 0) * max(x2, 0)) / (x1 * x1 + x2 * x2 + 4), 2.6);
          const F = ins * (0.55 + 0.45 * sm(0, 0.35 * C, s) * bm * 2), Fw = ins * bm;
          r += GL[0] * F + GW[0] * Fw; g += GL[1] * F + GW[1] * Fw; b += GL[2] * F + GW[2] * Fw;
          // past the efficiency line the plate gives way to a thin dark red-brown, where the link drops what is sent
          const ov = 1 - ins;
          r += (GO[0] - GB[0]) * ov; g += (GO[1] - GB[1]) * ov; b += (GO[2] - GB[2]) * ov;
        }
        // efficiency line, the fairness line, the attractor ray and the two axes, 2 LEDs thick
        let de = (s - C) * 0.7071;
        if (de < 3.6 && de > -3.6 && x1 > -2 && x2 > -2) {
          const v = exp(-de * de * iS) * sm(-2, 0, x1) * sm(-2, 0, x2);
          r += 232 * 0.6 * v; g += 226 * 0.6 * v; b += 205 * 0.6 * v;
        }
        de = (s - S.bv * C) * 0.7071;
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
        const tn = v > 1e-4 ? (205 * (1 - exp(-v))) / v : 0;
        BUF[o] = min(255, r + ea * tn);
        BUF[o + 1] = min(255, g + eb * tn);
        BUF[o + 2] = min(255, b + ec * tn);
      }
    }
    // the fair point, a soft glow where both lines meet
    lump(OX + C / 2, oy + OY - C / 2, 3.8, 0.16, WH);
    lump(OX + C / 2, oy + OY - C / 2, 1.5, 0.12, WH);
    // and a lilac one where the attractor ray meets the line, which is where AIMD really goes
    lump(OX + (C * S.a1) / (S.a1 + S.a2), oy + OY - (C * S.a2) / (S.a1 + S.a2), 2.2, 0.16 * rayK, [0.75, 0.6, 1]);
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
