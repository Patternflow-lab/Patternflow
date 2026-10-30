// ===== Patternflow pattern =====
// Title:   Chain Fountain
// Family:  physics
// Idea:    A bead chain drawn out of a pile in a pot by the weight of its own falling end rises in an arch above the pot before it falls to a growing heap on the floor, an inverted catenary half as high as the drop below it, its beads running round the path and the links between them coloured by their tension, until the pile runs out, the tail whips up and over, the pot fills again, and the end tips over the rim and the speed builds and the arch climbs off the rim to its height.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the chain fountain (Steve Mould, 2013), explained by John Biggins and Mark Warner (Understanding the chain fountain, Proceedings of the Royal Society A, 2014), pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drop=67..75, Push=0.26..0.29
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the beads are cyan, the links between them pink where the chain is most taut at the top of the arch, the glow round it blue and the pot and floor pale lavender lines; at 0.5 the beads are coral red with green links at the top and an amber glow.
// Knob 2: Speed. How fast the film runs. At 2 it is nine times slower than life at a centimetre to the LED: the chain runs at 3.8 m/s, 42 LEDs a second on the panel, and one run from the end tipping over to the tail landing takes 17 s, 19 s with the refill. Ten times slower at 0.2, half as fast again at 3.
// Knob 3: Drop. The bottom of the pot above the floor, 67 to 75 LEDs, which moves the rim from row 43 up to row 35. The fall from the pile to the floor goes from 70 to 78 LEDs, the speed from 3.8 to 4.0 m/s and the arch from 35 to 39 LEDs high, its top from row 16 to row 4.
// Knob 4: Push. Biggins and Warner's alpha, the share of lambda v^2 with which the pile pushes up on the chain, 0.26 to 0.29, the floor's beta kept equal to it. The arch stands at 0.50 of the drop at 0.26, 0.57 at 0.275 and 0.65 at 0.29, where its top reaches row 6; with Drop also at 75 it runs 7 rows off the top of the panel.
// Buttons: K1 tap pulls the end over the rim again and starts the chain from rest.

// A chain running along its own length at speed v on a fixed path carries
// a momentum flux lambda v^2 (lambda its mass per LED) besides its tension
// T, and T - lambda v^2 obeys the equations of a chain hanging still. So in
// steady flow the path is a catenary, and since T - lambda v^2 is negative
// here it stands up as an arch: x = XT + a asinh(s / a) and
// y = top + sqrt(a^2 + s^2) - a in arc length s from the top, with
// T - lambda v^2 = -lambda g (a + depth below the top).
//
// Biggins and Warner closed it at the two ends. A link lifted from the pile
// pivots, the pile pushes up on it, and the tension just above the pile is
// (1 - alpha) lambda v^2 rather than lambda v^2. At the floor the tension
// is beta lambda v^2. Down the fall h2 from the pickup to the floor that
// gives g h2 = (1 - alpha - beta) v^2, and up the rise h1 to the top
// h1 = alpha v^2 / g - a; as a goes to 0 this is their
// h1 / h2 = alpha / (1 - alpha - beta). This pattern takes a = 3 LEDs and
// beta = alpha, a landing link pivoting as a lifted one does, and keeps
// alpha between 0.26 and 0.29 because there the arch stands half to two
// thirds of the drop high and reaches the top third of the panel; with
// alpha at 0.15 it would stand 12 LEDs over a 70 LED drop.
//
// Out of steady flow one equation runs the speed, for the length l in
// flight: l dv/dt = g (drop from its upper end to its lower end), less
// (1 - alpha) v^2 while the pile feeds it, plus beta v^2 once the end is
// down. The arch stands at alpha v^2 / g - a for the speed of the moment,
// or lies on the rim while that is lower. When the pile runs out nothing is
// picked up and the free tail speeds up as it runs up, over and down. The
// heap on the floor rises as it grows and shortens the fall, so the arch
// sinks a few LEDs through a run.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, sqrt, asinh, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// One LED is a centimetre and g is 981 LEDs per second squared; the film
// runs TIME simulated seconds to the second at Speed 1.
const GRAV = 981, TIME = 1 / 18;
// The floor row, the pot (inner columns PL..PR, DEPTH rows deep, the pile
// at most PILE rows), the column where the chain turns over, the catenary
// parameter a at the top, the chain's length and the beads' spacing.
const FLOOR = 124, PL = 9, PR = 27, DEPTH = 14, PILE = 10, XT = 28, A = 3;
const LC = 500, BEAD = 7, SUB = 4;
// Seconds at Speed 2 the chain lies on the floor, and the pot refills.
const REST = 0.6, REFILL = 1;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, drop: 67, alpha: 0.26, ph: 0, pt: 0, M: 0, D: 0, v: 0, ytop: 0, fill: 1, btn: false,
    buf: new Float32Array(N * 3), line: new Float32Array(N), ten: new Float32Array(N), glow: new Float32Array(N),
    cc: [0, 0, 0], hc: [0, 0, 0], pc: [0, 0, 0], rc: [0, 0, 0], P: [0, 0], started: false,
  });
  return S;
}

// The pot and the pile for the current drop and what is left in the pile.
function pot(S) {
  S.ybot = FLOOR - S.drop;
  S.yrim = S.ybot - DEPTH;
  const left = S.ph === 3 ? LC * S.fill : S.ph >= 1 ? 0 : cl(LC - S.M, 0, LC);
  S.ypile = S.ybot - PILE * (left / LC);
}
// The heap on the floor: a mound of height sqrt(3 x area / 8) and twice
// that half width, its area 0.45 LED^2 for each LED of chain.
const heapH = (d) => sqrt((3 * 0.45 * d) / 8);

// The path from the pickup in the pile, up over the top and down to the
// floor: one inverted catenary, x = XT + a asinh(sig / a) and
// y = ytop + sqrt(a^2 + sig^2) - a, sig the arc length from the top.
function path(S) {
  pot(S);
  S.yland = FLOOR - heapH(S.D);
  S.s1 = sqrt((S.ypile - S.ytop + A) ** 2 - A * A);
  S.s2 = sqrt((S.yland - S.ytop + A) ** 2 - A * A);
  S.len = S.s1 + S.s2;
}
function at(S, s, o) {
  const sg = s - S.s1;
  o[0] = XT + A * asinh(sg / A);
  o[1] = S.ytop + sqrt(A * A + sg * sg) - A;
  return o;
}
// Where the arch stands: alpha v^2 / g - a above the pickup, or on the rim.
const top = (S) => min(S.yrim - 1, S.ypile - max(0, (S.alpha * S.v * S.v) / GRAV - A));

// Steady flow with a share u of the chain already on the floor.
function steady(S, u) {
  S.ph = 0;
  S.landed = true;
  S.D = u * LC;
  S.M = S.D + 100;
  for (let i = 0; i < 6; i++) {
    path(S);
    S.v = sqrt((GRAV * (S.yland - S.ypile)) / (1 - 2 * S.alpha));
    S.ytop = top(S);
    path(S);
    S.M = S.D + S.len;
  }
}

// From rest: the end pulled over the rim, hanging 30 LEDs below it.
function start(S) {
  S.ph = 0;
  S.pt = 0;
  S.v = 0;
  S.D = 0;
  S.landed = false;
  S.M = 0;
  pot(S);
  S.ytop = S.yrim - 1;
  path(S);
  S.M = S.s1 + sqrt((S.yrim + 30 - S.ytop + A) ** 2 - A * A);
}

// One step of the speed for the chain in flight, its upper end the pickup
// or, once the pile is empty, the tail; beta is alpha.
function step(S, h) {
  const al = S.alpha, P = S.P;
  path(S);
  const tail = S.ph === 1 ? S.M - LC : 0;
  // Once the end is down, the chain in flight spans the whole path, taking
  // from the heap or adding to it as the path changes length.
  if (!S.landed && S.M - S.D >= S.len) S.landed = true;
  if (S.landed) S.D = max(0, S.M - S.len);
  const landed = S.landed, lo = S.M - S.D;
  const yEnd = at(S, lo, P)[1], yUp = tail > 0 ? at(S, tail, P)[1] : S.ypile;
  const acc = (GRAV * (yEnd - yUp) - (S.ph === 0 ? (1 - al) : 0) * S.v * S.v + (landed ? al * S.v * S.v : 0)) / max(4, lo - tail);
  S.v = max(0, S.v + acc * h);
  if (S.ph === 1) S.v = min(S.v, 2.5 * S.vss);
  S.M += S.v * h;
  if (S.ph === 0) {
    S.ytop = top(S);
    if (S.M >= LC) S.ph = 1;
  } else if (S.M - LC >= S.len - 0.5) {
    S.ph = 2;
    S.pt = 0;
    S.D = LC;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.drop = cl(k[2] || 67, 67, 75);
  S.alpha = cl(k[3] == null ? 0.26 : k[3], 0.26, 0.29);
  S.vss = sqrt((GRAV * (S.drop + PILE)) / (1 - 2 * S.alpha));
  // The film opens on a fountain already running, 10% of its chain on the
  // floor; every one after starts from rest.
  if (!S.started) {
    S.started = true;
    steady(S, 0.1);
  }
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !S.btn) start(S);
  S.btn = btn;
  S.dts = d * S.speed * TIME;
  if (S.ph <= 1) {
    for (let i = 0; i < SUB; i++) step(S, S.dts / SUB);
  } else {
    S.pt += d * S.speed * 0.5;
    if (S.ph === 2 && S.pt > REST) (S.ph = 3), (S.pt = 0);
    if (S.ph === 3) {
      S.fill = min(1, S.pt / REFILL);
      S.D = LC * (1 - S.fill);
      if (S.pt > REFILL) start(S);
    }
  }
  path(S);
}

// Adds v to an LED buffer at a point between LEDs, shared by the four round it.
function splat(L, x, y, v) {
  const i = floor(x - 0.5), j = floor(y - 0.5), fx = x - 0.5 - i, fy = y - 0.5 - j;
  for (let q = 0; q < 4; q++) {
    const a = i + (q & 1), b = j + (q >> 1);
    if (a < 0 || a >= W || b < 0 || b >= H) continue;
    const w = (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy), p = b * W + a;
    if (v * w > L[p]) L[p] = v * w;
  }
}
// A bead: a disc 4.4 LEDs across with a soft edge out to 6.4.
function bead(L, x, y, v) {
  const x0 = floor(x - 3.5), y0 = floor(y - 3.5);
  for (let j = y0; j <= y0 + 7; j++)
    for (let i = x0; i <= x0 + 7; i++) {
      if (i < 0 || i >= W || j < 0 || j >= H) continue;
      const dx = i + 0.5 - x, dy = j + 0.5 - y, r = sqrt(dx * dx + dy * dy), w = v * cl(3.2 - r, 0, 1), p = j * W + i;
      if (w > L[p]) L[p] = w;
    }
}
// A halo of radius 4 round a point of the chain.
function halo(G, x, y) {
  const cx = round(x - 0.5), cy = round(y - 0.5);
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const a = cx + dx, b = cy + dy, r2 = dx * dx + dy * dy;
      if (a < 0 || a >= W || b < 0 || b >= H || r2 > 16) continue;
      const g = 0.24 * (1 - r2 / 25), p = b * W + a;
      if (g > G[p]) G[p] = g;
    }
}

function put(buf, x, y, c, k) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  buf[p] = max(buf[p], c[0] * k);
  buf[p + 1] = max(buf[p + 1], c[1] * k);
  buf[p + 2] = max(buf[p + 2], c[2] * k);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { buf, line: L, ten: T, glow: G, cc, hc, pc, rc, P } = S;
  buf.fill(0);
  L.fill(0);
  T.fill(0);
  G.fill(0);
  hsv(S.hue + 0.5, 0.7, 1, cc);
  hsv(S.hue + 0.62, 0.8, 1, hc);
  hsv(S.hue + 0.75, 0.25, 1, pc);
  hsv(S.hue + 0.85, 0.55, 1, rc);
  // The floor, and the pot as two walls and a bottom.
  for (let x = 0; x < W; x++) put(buf, x, FLOOR + 1, pc, 0.3);
  const yb = round(S.ybot), yr = round(S.yrim);
  for (let y = yr; y <= yb; y++) put(buf, PL - 1, y, pc, 0.45), put(buf, PR + 1, y, pc, 0.45);
  for (let x = PL - 1; x <= PR + 1; x++) put(buf, x, yb + 1, pc, 0.45);
  // The pile and the heap on the floor: beads lying in rows.
  const lie = (x, y) => bead(L, x, y, 0.42 + 0.12 * (((x * 7 + y * 3) | 0) % 3));
  for (let y = S.ybot - 1.5, r = 0; y > S.ypile - 1; y -= 3, r++) for (let x = PL + 1.5 + 2 * (r & 1); x < PR; x += 4) lie(x, y);
  const hh = heapH(S.D);
  if (hh > 0.8) {
    const xl = XT + A * asinh(S.s2 / A);
    for (let y = FLOOR - 1.5, r = 0; y > FLOOR - hh; y -= 3, r++) {
      const half = 2 * hh * sqrt(max(0, 1 - (FLOOR - y) / hh));
      for (let x = xl - half + 2 * (r & 1); x <= xl + half; x += 4) lie(x, y);
    }
  }
  // The chain in flight: its line in a colour that runs with its tension,
  // T = v^2 - g (a + depth below the top), highest at the top and down to
  // beta v^2 at the floor, and a halo round it.
  const t0 = S.ph === 1 ? S.M - LC : 0, t1 = S.ph <= 1 ? min(S.M - S.D, S.len) : 0;
  const tmax = max(1, S.v * S.v - GRAV * A);
  for (let s = max(0, t0), i = 0; s < t1; s += 0.5, i++) {
    at(S, s, P);
    const t = cl((S.v * S.v - GRAV * (A + P[1] - S.ytop)) / tmax, 0, 1);
    splat(L, P[0], P[1], 0.35);
    splat(T, P[0], P[1], t);
    if (!(i & 1)) halo(G, P[0], P[1]);
  }
  // Beads every BEAD LEDs of chain, each smeared back over the way it moved
  // this frame.
  const smear = min(BEAD, S.v * S.dts);
  for (let m = BEAD * ceil(S.D / BEAD); m <= min(S.M, LC); m += BEAD) {
    const s = S.M - m;
    if (s < 0 || s > S.len) continue;
    for (let q = 2; q >= 0; q--) {
      const sq = s - (smear * q) / 3;
      if (sq < 0) continue;
      at(S, sq, P);
      bead(L, P[0], P[1], 1 - 0.3 * q);
    }
  }
  for (let p = 0; p < N; p++) {
    const v = L[p], g = G[p];
    if (v <= 0 && g <= 0) continue;
    const t = T[p], o = p * 3, wh = 0.6 * max(0, v - 0.75);
    // Slack in the chain's colour, taut toward the second colour.
    for (let q = 0; q < 3; q++) buf[o + q] = max(buf[o + q], (cc[q] * (1 - t) + rc[q] * t) * v + wh, hc[q] * g);
  }
  // At the left edge, h1 above the pickup and h2 below it while the chain
  // runs, and a tick at the steady height alpha v^2 / g - a.
  if (S.ph <= 1) {
    const yp = round(S.ypile), ya = round(S.ytop), yl = round(S.yland);
    for (let y = ya; y < yp; y++) put(buf, 1, y, rc, 0.8), put(buf, 2, y, rc, 0.45);
    for (let y = yp; y <= yl; y++) put(buf, 1, y, cc, 0.55), put(buf, 2, y, cc, 0.3);
    const ys = round(S.ypile - max(0, (S.alpha * (S.yland - S.ypile)) / (1 - 2 * S.alpha) - A));
    put(buf, 3, ys, rc, 1);
    put(buf, 4, ys, rc, 0.6);
  }
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p - x) / W;
    display.setPixel(x, y, round(cl(buf[p * 3], 0, 1) * 255), round(cl(buf[p * 3 + 1], 0, 1) * 255), round(cl(buf[p * 3 + 2], 0, 1) * 255));
  }
}
