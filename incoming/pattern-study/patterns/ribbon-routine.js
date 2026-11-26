// ===== Patternflow pattern =====
// Title:   Ribbon Routine
// Family:  ribbongym
// Idea:    One satin ribbon, rose on one face and gold on the other, flies alone through a dark hall under a soft follow spot while an unseen hand works through a random routine of spirals, snakes, figure eights, circles, tosses and flicks, and the ribbon draws each figure in the air and leaves faint echoes of itself that the air then erases.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ribbon of rhythmic gymnastics and its vocabulary of spirals, snakes, figure eights, throws and catches (from memory); position based dynamics with distance constraints and the Verlet step (Thomas Jakobsen, Advanced Character Physics, 2001, from memory) closed by a follow-the-leader pass from the root (Matthias Muller, Tae-Yong Kim and Nuttapong Chentanez, Fast Simulation of Inextensible Hair and Fur, 2012, from memory); quadratic air drag split over the face normal, the width and the tangent of a flat band, so that a ribbon follows the path of its tip; a twist angle for each mass on a parallel transported frame (Richard Bishop, There Is More Than One Way to Frame a Curve, 1975, from memory), carried along the chain as the twist wave of a Cosserat rod (Bergou, Wardetzky, Robinson, Audoly and Grinspun, Discrete Elastic Rods, 2008, from memory), driven by the roll of the hand and turned toward the flow by a feathering torque; the Blinn highlight (1977, from memory) and a grazing sheen for the satin; a 4 by 4 supersampled depth buffer; value noise for the haze (Ken Perlin's lattice idea, 1985, from memory). Original here: the routine generator that blends randomly drawn elements with random size, speed, handedness and plane, the hand with a mass and walls, and the stroboscopic echoes that keep the colour a ribbon had, pattern round 262
// Round:   262
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.4..4, Length=-1..1, Trace=-1..1
//
// Knob 1: Hue. The pair of satin faces goes round the colour wheel with the knob, the second face always 65 degrees on and a little lighter: rose and gold at 0, lime and green at 0.25, teal and blue at 0.5, indigo and magenta at 0.75, rose and gold again at 1. The haze of the hall takes the colour opposite the pair.
// Knob 2: Pace. How fast the hand's clock runs, as a factor on every speed of the routine: 0.2 at 0.4, where a spiral turns once in five to seven seconds and the ribbon hangs and sways, 0.8 at 2 where it opens, 1.4 at 4, where the hand gets through a figure in two or three seconds and the ribbon streams out.
// Knob 3: Length. How long the ribbon is: 89 LED at -1, 125 at 0, 175 at 1. A long ribbon wraps a big circle into a ring and leaves the panel by an edge to come back; a short one whips and shows a single twist along its length.
// Knob 4: Trace. How long the air keeps the echoes of the ribbon: none at -1, 1.4 s at 0 where a ribbon leaves four or five dimmer copies of itself behind, 3.5 s at 1, a long exposure where the routine piles up round the live ribbon.

// What the picture is. A ribbon of N = 80 point masses hangs from the tip of a stick that nobody draws (the tip is a bright point), and the
// routine of a hand that nobody draws moves that tip. The world is in LED: x across, y down, z toward the viewer, with a mild perspective (a
// point 20 LED nearer is 8 percent larger); the panel shows the x and y. The ribbon is longer than the panel is wide, so it often leaves an
// edge and comes back.
// The routine. The hand is a carrier point that a critically damped spring (2.3 a second) pulls to a new centre for each element, plus an
// offset that the element gives it. An element is drawn from a vocabulary with random size, speed, handedness, plane and travel: a spiral
// (circles of 7 to 12 LED square to the direction the hand travels, 60 to 105 LED in 2 to 3 s, so the ribbon makes a helix whose pitch is the travel
// in one turn), a whirl (small fast circles of 4.5 to 6.5 LED, 0.5 to 0.75 s a turn), a snake (the hand swings 7 to 15 LED across its own travel),
// a figure eight (a Gerono lemniscate 13 to 24 LED long in a plane tilted up to 29 degrees, turned any way in it), a big circle (13 to 24 LED,
// an ellipse by tilt, breathing 18 percent, drifting 35 to 80 LED), a toss (the hand throws for 0.28 s, the stick flies on a parabola for 1.4 to
// 2 s with the tip circling the stick's middle, and the catch stops it; the ribbon streams out and then folds on itself), a boomerang sweep (an
// arc pendulum 22 to 40 LED across with a leaf in it) and a hold and flick (a hold of a second or less, then a pulse of 8 to 13 LED in 0.3 s and a
// smaller one, which send a wave down the ribbon). An element lasts 2 to 4 s of the hand's clock. The next starts to blend in 0.35 s before the last
// ends: both offsets keep running through the blend and are mixed by a smoothstep, so the hand's speed never jumps. A new element's centre is
// drawn so its whole path lies in the hand's box, 64 by 94 LED at the top of the panel since the ribbon hangs below, and of eight tries the one
// that starts nearest where the last ended and farthest from the last three centres wins, so the hand walks the panel. The hand has a mass: a
// lag of 0.04 s, a top speed of 190 LED/s, and walls that squeeze its position by tanh over the last 9 LED of the box. The elements and every
// number in them are drawn at random, so the picture does not come back. Before the first frame the routine runs 11 s with the ribbon.
// The ribbon. Position based dynamics, up to 120 steps a second. The tip is moved to the hand; every other mass gets gravity (30 LED/s per s)
// and drag v / (1 + c |v| h) on the three directions of the band: c = 0.05 on the face normal (a mass loses most of its speed in about 20 LED),
// 0.02 across the width (a band slides along its face) and 0.003 along its length. So the ribbon follows the path of its tip: a spiral of the
// hand is a helix of the ribbon, a snake is a sine that stands in the air while the hand moves along it. Four rounds of distance constraints
// that move both masses, a pull of each mass toward the middle of its neighbours by 0.02 a round (the bending stiffness, so the ribbon bends in
// smooth arcs and does not curl into a ball), and one pass from the tip down that fixes the length exactly. Soft walls 6 LED
// outside the sides and 10 above and below turn back a mass that leaves; a speed above 300 LED/s is cut; and if a mass is ever lost, or a
// position is not a number, the ribbon is hung again from the hand.
// The twist. Each mass has a twist angle on a reference frame moved along the chain by projecting its normal onto each tangent, and in time at
// the tip. The angle at the tip is the hand's roll (0.05 to 1.2 turns a second in an element). Along the chain the angles obey a damped wave
// equation (26 masses a second, damping 2 a second, a viscous term of 25 that takes out short twists), free at the far end, and never differ by
// more than 0.3 rad between two masses, so the ribbon never turns to a chain of beads. A feathering torque, 50 sin 2(twist - flow angle) rad/s
// per s, scaled by the square of the speed across the ribbon over 45 LED/s, turns the face to lie along the air that goes by. That makes the ribbon
// of a helix lie on the cylinder of the helix, full face on at the front of a turn and edge on at its sides, and its colour flips there.
// The face normal is n = cos(a) u + sin(a) (t x u); the width direction is t x n.
// Light. A soft follow spot (26 by 34 LED sigma), trailing the middle of the ribbon by 1.5 s, lights it fully and leaves 62 percent out
// at its edge. Each mass carries the colour of the face the viewer sees: the first colour where its normal points toward the viewer and the
// second where it points away, mixed over 0.14 of the normal's z so a flip is a glint. A wrap diffuse of a lamp up and to the left (60 percent
// ambient), a Blinn highlight (power 12) and a grazing sheen that peaks when the band turns edge on shade it. The band is drawn as quads
// between neighbouring masses, 5.4 LED wide face on and never under 2 LED across, into a 4 by 4 supersampled depth buffer, so a ribbon passing
// behind itself is hidden by it; the panel shows the mean of the 16 samples of each LED.
// Echoes. Every 0.36 s the ribbon's colour is stamped at 0.42 of its strength into a buffer that fades by exp(-t / tau), with the larger of
// the old and new value, not the sum, so two passes over one place do not pile up to white and the live ribbon is always the brightest.
// A stamp also holds back the haze under it while it lasts, so an echo keeps its own colour.
// The hall. Two octaves of value noise (14 by 17 and 8.5 by 9.5 LED, changing over about eight seconds) in the colour opposite the pair, up to
// a fifth of full at its peaks and brighter near the spot, fill the dark with a faint haze. It is the one part of the picture that has many
// small independent features, so it keeps two frames of the routine far apart in the colour of every block of the panel.

const W = 64, H = 128;
const N = 80; // point masses
const SS = 4, SW = W * SS, SH = H * SS; // samples a LED, each way
const { floor, ceil, sqrt, exp, sin, cos, atan2, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
const sgn = () => (rnd() < 0.5 ? -1 : 1);
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

// ---- the ribbon
const WIDTH = 5.4, PMIN = 1.0; // face-on width, LED, and the least half width the band shows across itself
const GRAV = 30; // LED/s per s
const CN = 0.05, CB = 0.02, CT = 0.003; // drag on the face normal, the width and the tangent
const VMAX = 300, HAND_V = 190; // LED/s: the fastest a node or the hand goes
const WALL_X = 6, WALL_Y = 10, WALL_K = 150; // the soft walls: margin outside the panel, LED, and stiffness a second
const KB = 0.02; // bending stiffness: how far a mass is drawn toward the middle of its neighbours in each round
const ITER = 4; // symmetric rounds of constraints
const KAPPA = 700, GAMMA = 2, MU = 25, TWIST_MAX = 0.3; // twist wave: (nodes/s)^2 and damping a second
const FEATHER = 50, FEATHER_V = 45; // feathering torque, rad/s per s, and the speed across the ribbon at which it is whole
const HSTEP = 1 / 120; // the longest step
const PERSP = 260;
// ---- the light
const LAMP = (() => {
  const x = -0.35, y = -0.55, z = 0.75, l = sqrt(x * x + y * y + z * z);
  return [x / l, y / l, z / l];
})();
const HALF = (() => {
  const x = LAMP[0], y = LAMP[1], z = LAMP[2] + 1, l = sqrt(x * x + y * y + z * z);
  return [x / l, y / l, z / l];
})();
const SPOT_X = 26, SPOT_Y = 34, SPOT_MIN = 0.62;
const TRACE_W = 0.46, STROBE = 0.36, HAZE = 0.27;

// ---- haze: value noise in x, y and time, on a grid of 4 LED
const imul = Math.imul;
function hv(i, j, k) {
  let h = imul(i, 0x27d4eb2d) ^ imul(j, 0x165667b1) ^ imul(k, 0x5bd1e995);
  h = imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = imul(h, 0xc2b2ae35);
  return ((h >>> 8) & 0xffff) / 65535;
}
function vn3(x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = hv(xi, yi, zi), b = hv(xi + 1, yi, zi), c = hv(xi, yi + 1, zi), d = hv(xi + 1, yi + 1, zi);
  const e = hv(xi, yi, zi + 1), f = hv(xi + 1, yi, zi + 1), g = hv(xi, yi + 1, zi + 1), h = hv(xi + 1, yi + 1, zi + 1);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return y0 + (y1 - y0) * fz;
}
const HZ = 4, HW = W / HZ + 2, HH = H / HZ + 2; // grid points

function hsv(h, s, v, out) {
  const f6 = (((h % 1) + 1) % 1) * 6, i = floor(f6), f = f6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  let r, g, b;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  out[0] = r * 255; out[1] = g * 255; out[2] = b * 255;
}

// ---- the routine's elements
const SPIRAL = 0, WHIRL = 1, SNAKE = 2, EIGHT = 3, CIRCLE = 4, TOSS = 5, SWEEP = 6, FLICK = 7;
const WEIGHTS = [1.3, 0.7, 1.0, 1.0, 1.0, 0.8, 0.9, 0.8];
const BLEND = 0.7; // s of the hand's clock over which one element is handed to the next

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => {
  const l = sqrt(dot(v, v)) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// two unit vectors square to n, turned by g round it
function plane(n, g) {
  const ref = abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const d = dot(ref, n);
  const e1 = unit([ref[0] - d * n[0], ref[1] - d * n[1], ref[2] - d * n[2]]);
  const e2 = cross(n, e1);
  const c = cos(g), s = sin(g);
  return [
    [c * e1[0] + s * e2[0], c * e1[1] + s * e2[1], c * e1[2] + s * e2[2]],
    [c * e2[0] - s * e1[0], c * e2[1] - s * e1[1], c * e2[2] - s * e1[2]],
  ];
}
// a normal that leans away from the viewer by up to `lean`
function normal(lean) {
  const a = lean * sqrt(rnd()), b = rnd() * TAU;
  return [sin(a) * cos(b), sin(a) * sin(b), cos(a)];
}
// a direction in the panel's plane with a little depth
function heading(a) {
  return unit([cos(a), sin(a), 0.14 * gauss()]);
}
// the panel is tall, so most travel runs up or down it
function bias() {
  return rnd() < 0.65 ? (rnd() < 0.5 ? 1 : -1) * (PI / 2) + rr(-0.65, 0.65) : rnd() * TAU;
}

function makeElem(S, ts, prev) {
  let k;
  for (let tries = 0; tries < 12; tries++) {
    let x = rnd() * 7.9;
    k = 0;
    for (let i = 0; i < 8; i++) {
      x -= WEIGHTS[i];
      if (x <= 0) { k = i; break; }
    }
    if (!prev || k !== prev.k) break;
  }
  const e = { k, ts, dur: 3, roll: 0, ph: rnd() * TAU, ph2: rnd() * TAU, dir: sgn(), R: 0, T: 1, A: 0, B: 0, L: 0, d: [0, 1, 0], e1: [1, 0, 0], e2: [0, 1, 0], armed: false, C: [32, 64, 0], ext: [0, 0, 0, 0] };
  const a = bias();
  switch (k) {
    case SPIRAL: {
      e.d = heading(a);
      [e.e1, e.e2] = plane(e.d, rnd() * TAU);
      e.R = rr(7, 12); e.T = rr(0.9, 1.4); e.L = rr(60, 105) * sgn(); e.dur = rr(2.0, 3.0);
      e.roll = e.dir * rr(0.2, 0.6) * TAU;
      break;
    }
    case WHIRL: {
      e.d = heading(a);
      [e.e1, e.e2] = plane(e.d, rnd() * TAU);
      e.R = rr(4.5, 6.5); e.T = rr(0.5, 0.75); e.L = rr(55, 95) * sgn(); e.dur = rr(1.8, 2.6);
      e.roll = e.dir * rr(0.4, 1.0) * TAU;
      break;
    }
    case SNAKE: {
      e.d = heading(a);
      const p = unit(cross(e.d, rnd() < 0.8 ? [0, 0, 1] : heading(rnd() * TAU)));
      e.e1 = e.d; e.e2 = p;
      e.A = rr(7, 15); e.T = rr(0.56, 1.1); e.L = rr(0, 95) * sgn(); e.dur = rr(2.2, 3.4);
      e.roll = e.dir * rr(0.05, 0.4) * TAU;
      break;
    }
    case EIGHT: {
      [e.e1, e.e2] = plane(normal(0.5), rnd() * TAU);
      e.d = heading(a);
      e.A = rr(13, 24); e.B = e.A * rr(0.5, 0.75); e.T = rr(1.7, 2.8); e.L = rr(0, 24); e.dur = e.T * rr(1.5, 2.1);
      e.roll = e.dir * rr(0.1, 0.5) * TAU;
      break;
    }
    case CIRCLE: {
      [e.e1, e.e2] = plane(normal(0.6), rnd() * TAU);
      e.d = heading(a);
      e.R = rr(13, 24); e.B = rr(0.72, 1); e.T = rr(1.3, 2.4); e.L = rr(35, 80); e.dur = e.T * rr(1.4, 2.2);
      e.roll = e.dir * rr(0.1, 0.5) * TAU;
      break;
    }
    case TOSS: {
      const lean = rr(-0.6, 0.6);
      e.up = unit([sin(lean), -cos(lean), 0.18 * gauss()]);
      e.Tth = 0.28; e.Dth = rr(9, 14); e.Tf = rr(1.4, 2.0);
      e.qL = [e.up[0] * e.Dth, e.up[1] * e.Dth, e.up[2] * e.Dth];
      const vr = (2 * e.Dth) / e.Tth;
      e.vrel = [e.up[0] * vr, e.up[1] * vr, e.up[2] * vr];
      const qC = [rr(-8, 8), rr(-4, 5), rr(-4, 4)];
      e.g = [0, 1, 2].map((i) => (2 * (qC[i] - e.qL[i] - e.vrel[i] * e.Tf)) / (e.Tf * e.Tf));
      [e.e1, e.e2] = plane(normal(0.4), rnd() * TAU);
      e.R = rr(4, 6.5); e.A = rr(1.0, 2.4); // the tip's circle round the stick's middle, and turns in flight
      e.dur = e.Tth + e.Tf + 0.3;
      e.roll = e.dir * rr(0.4, 1.2) * TAU;
      break;
    }
    case SWEEP: {
      [e.e1, e.e2] = plane(normal(0.45), a);
      e.A = rr(22, 40); e.B = e.A * rr(0.12, 0.4) * sgn(); e.R = e.A * 0.25 * sgn(); e.T = rr(1.2, 2.0); e.dur = e.T * rr(1.3, 1.9);
      e.roll = e.dir * rr(0.1, 0.6) * TAU;
      break;
    }
    default: {
      // FLICK
      e.d = heading(a);
      e.e1 = heading(rnd() * TAU); e.e2 = heading(rnd() * TAU);
      e.A = rr(0.7, 1.0); // a small stir while the hand holds
      e.L = rr(0.5, 1.0); // hold, s
      e.R = rr(8, 13); e.B = rr(0.24, 0.32); // first flick: size and width
      e.T = rr(0.4, 0.8); // gap to the second
      e.up = heading(rnd() * TAU);
      e.dur = e.L + e.B + e.T + rr(0.9, 1.5);
      e.roll = e.dir * rr(0.1, 0.6) * TAU;
    }
  }
  e.dur = max(e.dur, BLEND + 1.2);
  // the path's box, so the centre can be drawn to keep it on the panel
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const o = [0, 0, 0];
  for (let i = 0; i <= 24; i++) {
    offset(e, (e.dur * i) / 24, o);
    x0 = min(x0, o[0]); x1 = max(x1, o[0]); y0 = min(y0, o[1]); y1 = max(y1, o[1]);
  }
  e.ext = [x0, x1, y0, y1];
  // a centre inside the margins; of eight tries the one whose start lies near where the last element ended and away from the last three centres
  const lo = [0 - x0, 8 - y0], hi = [W - x1, 110 - y1];
  offset(e, 0, o);
  const so = [o[0], o[1]];
  let end = [32, 64];
  if (prev) {
    offset(prev, prev.dur, o);
    end = [prev.C[0] + o[0], prev.C[1] + o[1]];
  }
  let bx = 32, by = 64, bs = -1e9;
  for (let c = 0; c < 8; c++) {
    const cx = lo[0] < hi[0] ? rr(lo[0], hi[0]) : (lo[0] + hi[0]) / 2;
    const cy = lo[1] < hi[1] ? rr(lo[1], hi[1]) : (lo[1] + hi[1]) / 2;
    let far = 1e9;
    for (const q of S.recent) far = min(far, sqrt((cx - q[0]) * (cx - q[0]) + (cy - q[1]) * (cy - q[1])));
    const gap = sqrt((cx + so[0] - end[0]) * (cx + so[0] - end[0]) + (cy + so[1] - end[1]) * (cy + so[1] - end[1]));
    const s2 = min(far, 55) - 2.5 * max(0, gap - 30);
    if (s2 > bs) { bs = s2; bx = cx; by = cy; }
  }
  e.C = [bx, by, rr(-7, 7)];
  S.recent.push([bx, by]);
  if (S.recent.length > 3) S.recent.shift();
  return e;
}

// the hand's offset from the carrier at a time into the element; one-shots hold their ends
function offset(e, tau, o) {
  let x = 0, y = 0, z = 0;
  const e1 = e.e1, e2 = e.e2, d = e.d;
  const tr = tau / e.dur - 0.5; // travel runs once through the element, centred
  switch (e.k) {
    case SPIRAL:
    case WHIRL: {
      const f = e.ph + (e.dir * TAU * tau) / e.T, c = e.R * cos(f), s = e.R * sin(f), t = e.L * tr;
      x = c * e1[0] + s * e2[0] + t * d[0]; y = c * e1[1] + s * e2[1] + t * d[1]; z = c * e1[2] + s * e2[2] + t * d[2];
      break;
    }
    case SNAKE: {
      const t = e.L * tr, a = e.A * (1 + 0.18 * sin(0.8 * tau + e.ph2)) * sin((TAU * tau) / e.T + e.ph);
      x = t * d[0] + a * e2[0]; y = t * d[1] + a * e2[1]; z = t * d[2] + a * e2[2];
      break;
    }
    case EIGHT: {
      const f = e.ph + (e.dir * TAU * tau) / e.T, a = e.A * sin(f), b = e.B * sin(2 * f), t = e.L * tr;
      x = a * e1[0] + b * e2[0] + t * d[0]; y = a * e1[1] + b * e2[1] + t * d[1]; z = a * e1[2] + b * e2[2] + t * d[2];
      break;
    }
    case CIRCLE: {
      const f = e.ph + (e.dir * TAU * tau) / e.T, r = e.R * (1 + 0.18 * sin((TAU * tau) / (1.7 * e.T) + e.ph2));
      const a = r * cos(f), b = r * e.B * sin(f), t = e.L * tr;
      x = a * e1[0] + b * e2[0] + t * d[0]; y = a * e1[1] + b * e2[1] + t * d[1]; z = a * e1[2] + b * e2[2] + t * d[2];
      break;
    }
    case TOSS: {
      if (tau <= 0) break;
      if (tau < e.Tth) {
        const s = (tau / e.Tth) * (tau / e.Tth);
        x = e.up[0] * e.Dth * s; y = e.up[1] * e.Dth * s; z = e.up[2] * e.Dth * s;
      } else {
        const s = min(tau - e.Tth, e.Tf), u = s / e.Tf, env = sin(PI * u), f = e.ph + TAU * e.A * u;
        const c = e.R * env * cos(f), sn = e.R * env * sin(f);
        x = e.qL[0] + e.vrel[0] * s + 0.5 * e.g[0] * s * s + c * e1[0] + sn * e2[0];
        y = e.qL[1] + e.vrel[1] * s + 0.5 * e.g[1] * s * s + c * e1[1] + sn * e2[1];
        z = e.qL[2] + e.vrel[2] * s + 0.5 * e.g[2] * s * s + c * e1[2] + sn * e2[2];
      }
      break;
    }
    case SWEEP: {
      const w = (TAU * tau) / e.T, a = e.A * sin(w), b = e.B * sin(w) * sin(w) + e.R * (cos(w) - 1);
      x = a * e1[0] + b * e2[0]; y = a * e1[1] + b * e2[1]; z = a * e1[2] + b * e2[2];
      break;
    }
    default: {
      // FLICK: a stir, then one pulse and a smaller one in another direction
      const sa = e.A * sin(5.1 * tau + e.ph), sb = e.A * sin(4.3 * tau + e.ph2);
      x = sa * e1[0] + sb * e2[0]; y = sa * e1[1] + sb * e2[1]; z = sa * e1[2] + sb * e2[2];
      const s1 = tau - e.L;
      if (s1 > 0 && s1 < e.B) {
        const p = sin((PI * s1) / e.B), f = e.R * p * p;
        x += f * d[0]; y += f * d[1]; z += f * d[2];
      }
      const s2 = tau - e.L - e.B - e.T;
      if (s2 > 0 && s2 < e.B) {
        const p = sin((PI * s2) / e.B), f = 0.6 * e.R * p * p;
        x += f * e.up[0]; y += f * e.up[1]; z += f * e.up[2];
      }
    }
  }
  o[0] = x; o[1] = y; o[2] = z;
}

// ---- the state
function makeState() {
  const sz = SW * SH;
  return {
    ready: false, t: 0, ks: [0, 2, 0, 0.06],
    P: new Float64Array(N * 3), V: new Float64Array(N * 3), TH: new Float64Array(N), TV: new Float64Array(N),
    Tg: new Float64Array(N * 3), Ub: new Float64Array(N * 3), Vb: new Float64Array(N * 3),
    u0: [0, 0, 1], roll: 0, ds: 1.25,
    rt: 0, cur: null, nxt: null, recent: [],
    C: [32, 50, 0], Cv: [0, 0, 0], Ct: [32, 50, 0], hand: [32, 50, 0], hs: [32, 50, 0], handVel: [0, 0, 0], rollRate: 0,
    spot: [32, 64], strobe: 0, tra: new Float32Array(W * H), haze: new Float32Array(HW * HH), hseed: floor(rnd() * 1e5),
    zb: new Float32Array(sz), sb: new Float32Array(sz * 3), tr: new Float32Array(W * H * 3), out: new Float32Array(W * H * 3),
    vtx: new Float64Array(4 * 7), pa: [0, 0, 0], pb: [0, 0, 0],
    colA: [0, 0, 0], colB: [0, 0, 0], colH: [0, 0, 0], facesAt: -1,
    gx: new Float32Array(W), gy: new Float32Array(H), tip: [0, 0],
    sx: new Float64Array(N), sy: new Float64Array(N), Q: new Float64Array(N * 3), aero: new Float64Array(N), nodeBuf: new Float64Array(N * 9),
  };
}

export function setup(params) {
  params.s = makeState();
}

const paceOf = (k) => 0.8 * pow(cl(k, 0.4, 4) / 2, 0.85);
const lengthOf = (k) => 125 * pow(1.4, cl(k, -1, 1));
const traceOf = (k) => (k <= -1 ? 0 : k < 0 ? 1.4 * pow(k + 1, 1.3) : 1.4 * pow(2.5, cl(k, 0, 1)));

// the hand slides along the walls of a box a little smaller than the panel, so it is never wholly off it: past the margin the position is squeezed by tanh
function wall(v, lo, hi) {
  const m = 9;
  if (v > hi - m) return hi - m + m * Math.tanh((v - hi + m) / m);
  if (v < lo + m) return lo + m - m * Math.tanh((lo + m - v) / m);
  return v;
}

// ---- the routine, one step of the hand's clock
function routineStep(S, dtr, h) {
  S.rt += dtr;
  const n = S.nxt;
  if (!n.armed && S.rt >= n.ts - BLEND / 2) {
    n.armed = true;
    S.Ct = n.C;
  }
  if (S.rt >= n.ts + BLEND / 2) {
    S.cur = n;
    S.nxt = makeElem(S, n.ts + n.dur, n);
  }
  // the carrier: a critically damped spring
  const w0 = 2.3, C = S.C, Cv = S.Cv, Ct = S.Ct;
  for (let i = 0; i < 3; i++) {
    const a = w0 * w0 * (Ct[i] - C[i]) - 2 * w0 * Cv[i];
    Cv[i] += a * dtr;
    C[i] += Cv[i] * dtr;
  }
  const cu = S.cur, nx = S.nxt;
  const w = ss(nx.ts - BLEND / 2, nx.ts + BLEND / 2, S.rt);
  offset(cu, S.rt - cu.ts, S.pa);
  offset(nx, S.rt - nx.ts, S.pb);
  for (let i = 0; i < 3; i++) S.hand[i] = C[i] + S.pa[i] * (1 - w) + S.pb[i] * w;
  S.hand[0] = wall(S.hand[0], 5, 59);
  S.hand[1] = wall(S.hand[1], 8, 108);
  // the real hand has mass: a short lag, and a speed it does not pass
  const hs = S.hs, lag = 1 - exp(-h / 0.04), vmax = HAND_V * h;
  let dx = (S.hand[0] - hs[0]) * lag, dy = (S.hand[1] - hs[1]) * lag, dz = (S.hand[2] - hs[2]) * lag;
  const dl = sqrt(dx * dx + dy * dy + dz * dz);
  if (dl > vmax) { const k = vmax / dl; dx *= k; dy *= k; dz *= k; }
  hs[0] += dx; hs[1] += dy; hs[2] += dz;
  S.hand[0] = hs[0]; S.hand[1] = hs[1]; S.hand[2] = hs[2];
  S.rollRate = cu.roll * (1 - w) + nx.roll * w;
  S.roll += S.rollRate * dtr;
}

// ---- the frames along the ribbon
function frames(S) {
  const P = S.P, T = S.Tg, U = S.Ub, Vv = S.Vb, u0 = S.u0;
  for (let i = 0; i < N; i++) {
    const a = i === 0 ? 0 : i - 1, b = i === N - 1 ? N - 1 : i + 1;
    let x = P[b * 3] - P[a * 3], y = P[b * 3 + 1] - P[a * 3 + 1], z = P[b * 3 + 2] - P[a * 3 + 2];
    const l = 1 / (sqrt(x * x + y * y + z * z) + 1e-9);
    T[i * 3] = x * l; T[i * 3 + 1] = y * l; T[i * 3 + 2] = z * l;
  }
  // the reference normal is carried through time at the tip, then along the chain
  let ux = u0[0], uy = u0[1], uz = u0[2];
  for (let i = 0; i < N; i++) {
    const tx = T[i * 3], ty = T[i * 3 + 1], tz = T[i * 3 + 2];
    const d = ux * tx + uy * ty + uz * tz;
    ux -= d * tx; uy -= d * ty; uz -= d * tz;
    let l = sqrt(ux * ux + uy * uy + uz * uz);
    if (l < 1e-4) {
      // the tangent has swung through the reference: take any normal to it
      const ax = abs(tx) < 0.8 ? 1 : 0, ay = 1 - ax;
      ux = ay * tz; uy = -ax * tz; uz = ax * ty - ay * tx;
      l = sqrt(ux * ux + uy * uy + uz * uz) || 1;
    }
    ux /= l; uy /= l; uz /= l;
    U[i * 3] = ux; U[i * 3 + 1] = uy; U[i * 3 + 2] = uz;
    Vv[i * 3] = ty * uz - tz * uy; Vv[i * 3 + 1] = tz * ux - tx * uz; Vv[i * 3 + 2] = tx * uy - ty * ux;
    if (i === 0) { u0[0] = ux; u0[1] = uy; u0[2] = uz; }
  }
}

// ---- one step of the ribbon
function step(S, h, ds) {
  const P = S.P, V = S.V, TH = S.TH, TV = S.TV, T = S.Tg, U = S.Ub, Vv = S.Vb;
  const hand = S.hand;
  // the tip goes to the hand
  for (let c = 0; c < 3; c++) {
    S.handVel[c] = (hand[c] - P[c]) / h;
    P[c] = hand[c];
    V[c] = S.handVel[c];
  }
  frames(S);
  TH[0] = S.roll; TV[0] = S.rollRate;
  // forces: gravity, drag on the band's three directions, the feathering torque
  const aero = S.aero;
  for (let i = 1; i < N; i++) {
    const o = i * 3;
    const ct = cos(TH[i]), st = sin(TH[i]);
    const nx = ct * U[o] + st * Vv[o], ny = ct * U[o + 1] + st * Vv[o + 1], nz = ct * U[o + 2] + st * Vv[o + 2];
    const bx = ct * Vv[o] - st * U[o], by = ct * Vv[o + 1] - st * U[o + 1], bz = ct * Vv[o + 2] - st * U[o + 2];
    const tx = T[o], ty = T[o + 1], tz = T[o + 2];
    let vx = V[o], vy = V[o + 1] + GRAV * h, vz = V[o + 2];
    // the hall's soft walls, a few LED outside the panel
    const px = P[o], py = P[o + 1];
    if (px < -WALL_X) { vx += (-WALL_X - px) * WALL_K * h; vx *= 1 - 5 * h; }
    else if (px > W + WALL_X) { vx += (W + WALL_X - px) * WALL_K * h; vx *= 1 - 5 * h; }
    if (py < -WALL_Y) { vy += (-WALL_Y - py) * WALL_K * h; vy *= 1 - 5 * h; }
    else if (py > H + WALL_Y) { vy += (H + WALL_Y - py) * WALL_K * h; vy *= 1 - 5 * h; }
    const vn = vx * nx + vy * ny + vz * nz, vb = vx * bx + vy * by + vz * bz, vt = vx * tx + vy * ty + vz * tz;
    const dn = vn / (1 + CN * abs(vn) * h) - vn, db = vb / (1 + CB * abs(vb) * h) - vb, dt = vt / (1 + CT * abs(vt) * h) - vt;
    V[o] = vx + dn * nx + db * bx + dt * tx;
    V[o + 1] = vy + dn * ny + db * by + dt * ty;
    V[o + 2] = vz + dn * nz + db * bz + dt * tz;
    // the flow past the ribbon, in the frame
    const fu = V[o] * U[o] + V[o + 1] * U[o + 1] + V[o + 2] * U[o + 2];
    const fv = V[o] * Vv[o] + V[o + 1] * Vv[o + 1] + V[o + 2] * Vv[o + 2];
    const sp = sqrt(fu * fu + fv * fv), psi = atan2(fv, fu), k = min(1, sp / FEATHER_V);
    aero[i] = FEATHER * k * k * sin(2 * (TH[i] - psi));
  }
  // the twist wave along the chain
  for (let i = 1; i < N; i++) {
    const nxt = i === N - 1 ? TH[i] : TH[i + 1], tvn = i === N - 1 ? TV[i] : TV[i + 1];
    TV[i] += h * (KAPPA * (TH[i - 1] - 2 * TH[i] + nxt) + MU * (TV[i - 1] - 2 * TV[i] + tvn) - GAMMA * TV[i] + aero[i]);
  }
  for (let i = 1; i < N; i++) {
    TH[i] += h * TV[i];
    // a ribbon does not take more than TWIST_MAX of twist between two masses, so it never turns to a chain of beads
    const d = TH[i] - TH[i - 1];
    if (d > TWIST_MAX) { TH[i] = TH[i - 1] + TWIST_MAX; TV[i] *= 0.6; }
    else if (d < -TWIST_MAX) { TH[i] = TH[i - 1] - TWIST_MAX; TV[i] *= 0.6; }
  }
  // predict
  const Q = S.Q;
  for (let i = 0; i < N * 3; i++) Q[i] = P[i] + V[i] * h;
  for (let c = 0; c < 3; c++) Q[c] = hand[c];
  // constraints
  for (let it = 0; it < ITER; it++) {
    const fwd = (it & 1) === 0;
    for (let n = 0; n < N - 1; n++) {
      const i = fwd ? n : N - 2 - n, a = i * 3, b = a + 3;
      const dx = Q[b] - Q[a], dy = Q[b + 1] - Q[a + 1], dz = Q[b + 2] - Q[a + 2];
      const l = sqrt(dx * dx + dy * dy + dz * dz) + 1e-9, f = (l - ds) / l;
      const wa = i === 0 ? 0 : 0.5, wb = i === 0 ? 1 : 0.5;
      Q[a] += dx * f * wa; Q[a + 1] += dy * f * wa; Q[a + 2] += dz * f * wa;
      Q[b] -= dx * f * wb; Q[b + 1] -= dy * f * wb; Q[b + 2] -= dz * f * wb;
    }
    // bending: each mass is drawn toward the middle of its neighbours, which takes curvature out of the chain
    for (let i = 1; i < N - 1; i++) {
      const o = i * 3, a = o - 3, c = o + 3;
      Q[o] += (0.5 * (Q[a] + Q[c]) - Q[o]) * KB;
      Q[o + 1] += (0.5 * (Q[a + 1] + Q[c + 1]) - Q[o + 1]) * KB;
      Q[o + 2] += (0.5 * (Q[a + 2] + Q[c + 2]) - Q[o + 2]) * KB;
    }
  }
  // the last pass runs one way from the tip, so the length is exact
  for (let i = 0; i < N - 1; i++) {
    const a = i * 3, b = a + 3;
    const dx = Q[b] - Q[a], dy = Q[b + 1] - Q[a + 1], dz = Q[b + 2] - Q[a + 2];
    const f = ds / (sqrt(dx * dx + dy * dy + dz * dz) + 1e-9);
    Q[b] = Q[a] + dx * f; Q[b + 1] = Q[a + 1] + dy * f; Q[b + 2] = Q[a + 2] + dz * f;
  }
  // velocities from the move, cut at VMAX
  const ih = 1 / h;
  for (let i = 1; i < N; i++) {
    const o = i * 3;
    let vx = (Q[o] - P[o]) * ih, vy = (Q[o + 1] - P[o + 1]) * ih, vz = (Q[o + 2] - P[o + 2]) * ih;
    const sp = sqrt(vx * vx + vy * vy + vz * vz);
    if (sp > VMAX) { const k = VMAX / sp; vx *= k; vy *= k; vz *= k; }
    V[o] = vx; V[o + 1] = vy; V[o + 2] = vz;
    P[o] = Q[o]; P[o + 1] = Q[o + 1]; P[o + 2] = Q[o + 2];
  }
}

// the ribbon hangs from the hand, a little off the vertical, untwisted
function hang(S) {
  const P = S.P, V = S.V, h = S.hand;
  const lean = rr(-0.25, 0.25), lz = rr(-0.15, 0.15);
  for (let i = 0; i < N; i++) {
    P[i * 3] = h[0] + sin(lean) * S.ds * i; P[i * 3 + 1] = h[1] + cos(lean) * S.ds * i; P[i * 3 + 2] = h[2] + lz * S.ds * i;
    V[i * 3] = 0; V[i * 3 + 1] = 0; V[i * 3 + 2] = 0;
    S.TH[i] = S.roll; S.TV[i] = 0;
  }
  S.u0 = [0, 0, 1];
  S.tr.fill(0);
  S.tra.fill(0);
}

function guard(S) {
  const P = S.P;
  let bad = false;
  for (let i = 0; i < N * 3; i++) if (!(abs(P[i]) < 900)) { bad = true; break; }
  if (!bad && abs(S.roll) > 4000) {
    // keep the angles small; only their differences matter
    const m = S.roll - (S.roll % TAU);
    S.roll -= m;
    for (let i = 0; i < N; i++) S.TH[i] -= m;
  }
  if (bad) hang(S);
}

function advance(S, dt, draw) {
  const rho = paceOf(S.ks[1]);
  S.ds = lengthOf(S.ks[2]) / (N - 1);
  const ns = max(1, ceil(dt / (HSTEP * 1.02)));
  const h = dt / ns;
  for (let s = 0; s < ns; s++) {
    routineStep(S, h * rho, h);
    step(S, h, S.ds);
  }
  guard(S);
  // the spot trails the middle of the ribbon
  let mx = 0, my = 0;
  for (let i = 0; i < N; i += 4) { mx += S.P[i * 3]; my += S.P[i * 3 + 1]; }
  mx /= N / 4; my /= N / 4;
  const e = 1 - exp(-dt / 1.5);
  S.spot[0] += (0.6 * mx + 0.4 * S.hand[0] - S.spot[0]) * e;
  S.spot[1] += (0.6 * my + 0.4 * S.hand[1] - 6 - S.spot[1]) * e;
  if (draw) raster(S, dt);
  S.t += dt;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    S.ds = lengthOf(S.ks[2]) / (N - 1);
    S.cur = makeElem(S, 0, null);
    S.cur.C = [32, 60, 0];
    S.rt = rr(0.6, 1.4);
    S.nxt = makeElem(S, S.cur.dur, S.cur);
    S.C = S.cur.C.slice(); S.Ct = S.C.slice();
    routineStep(S, 0, 0.01);
    S.hs = S.hand.slice();
    hang(S);
    // the pre-run: nine seconds of the hand's clock, the last two and a half drawn so the trace has something in it
    const dtp = 1 / 60;
    for (let n = 0; n < 540; n++) advance(S, dtp, false);
    for (let n = 0; n < 150; n++) {
      advance(S, dtp, false);
      if (n % 3 === 2) raster(S, dtp * 3);
    }
    S.t = 0;
  }
  const e = 1 - exp(-d / 0.3);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  if (d > 0) advance(S, d, true);
}

// ---- drawing
function faces(S) {
  const k = S.ks[0];
  if (abs(S.facesAt - k) < 1e-4) return;
  S.facesAt = k;
  const hA = 0.945 + k;
  hsv(hA, 0.66, 1.0, S.colA);
  hsv(hA + 0.18, 0.78, 1.0, S.colB);
  for (let c = 0; c < 3; c++) S.colB[c] += (255 - S.colB[c]) * 0.1;
  hsv(hA + 0.59, 0.85, 1.0, S.colH); // the hall, lit in the colour opposite the pair
}

function fillTri(S, a, b, c) {
  const v = S.vtx, zb = S.zb, sb = S.sb;
  const x0 = v[a * 7] * SS, y0 = v[a * 7 + 1] * SS, x1 = v[b * 7] * SS, y1 = v[b * 7 + 1] * SS, x2 = v[c * 7] * SS, y2 = v[c * 7 + 1] * SS;
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (abs(area) < 1e-5) return;
  const inv = 1 / area;
  const mx = max(0, floor(min(x0, x1, x2) - 0.5)), Mx = min(SW - 1, ceil(max(x0, x1, x2) - 0.5));
  const my = max(0, floor(min(y0, y1, y2) - 0.5)), My = min(SH - 1, ceil(max(y0, y1, y2) - 0.5));
  const za = v[a * 7 + 2], zbv = v[b * 7 + 2], zc = v[c * 7 + 2];
  const ra = v[a * 7 + 3], ga = v[a * 7 + 4], ba = v[a * 7 + 5], qa = v[a * 7 + 6];
  const rb = v[b * 7 + 3], gb = v[b * 7 + 4], bb = v[b * 7 + 5], qb = v[b * 7 + 6];
  const rc = v[c * 7 + 3], gc = v[c * 7 + 4], bc = v[c * 7 + 5], qc = v[c * 7 + 6];
  for (let sy = my; sy <= My; sy++) {
    const py = sy + 0.5;
    for (let sx = mx; sx <= Mx; sx++) {
      const px = sx + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv;
      if (w0 < 0) continue;
      const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
      if (w1 < 0) continue;
      const w2 = 1 - w0 - w1;
      if (w2 < 0) continue;
      const z = w0 * za + w1 * zbv + w2 * zc, idx = sy * SW + sx;
      if (z <= zb[idx]) continue;
      zb[idx] = z;
      const q = w0 * qa + w1 * qb + w2 * qc, edge = 1 - 0.2 * q * q, o = idx * 3;
      sb[o] = (w0 * ra + w1 * rb + w2 * rc) * edge;
      sb[o + 1] = (w0 * ga + w1 * gb + w2 * gc) * edge;
      sb[o + 2] = (w0 * ba + w1 * bb + w2 * bc) * edge;
    }
  }
}

function raster(S, dt) {
  faces(S);
  const P = S.P, T = S.Tg, U = S.Ub, Vv = S.Vb, TH = S.TH, v = S.vtx, sx = S.sx, sy = S.sy;
  const cA = S.colA, cB = S.colB;
  frames(S);
  S.zb.fill(-1e9);
  // spot lightness along x and y
  const gx = S.gx, gy = S.gy;
  for (let x = 0; x < W; x++) {
    const d = (x + 0.5 - S.spot[0]) / SPOT_X;
    gx[x] = exp(-0.5 * d * d);
  }
  for (let y = 0; y < H; y++) {
    const d = (y + 0.5 - S.spot[1]) / SPOT_Y;
    gy[y] = exp(-0.5 * d * d);
  }
  // the haze the spot lights: two octaves of noise that drift and change over about ten seconds
  const hz = S.haze, tt = S.t * 0.1 + S.hseed * 0.01;
  for (let j = 0; j < HH; j++) {
    for (let i = 0; i < HW; i++) {
      const X = i * HZ, Y = j * HZ;
      hz[j * HW + i] = 0.55 * vn3(X / 14 + tt * 1.3, Y / 17 - tt * 0.9, tt * 1.3) + 0.45 * vn3(X / 8.5 - tt * 0.8, Y / 9.5 + tt * 1.1, tt * 2.1 + 7.3);
    }
  }
  // the nodes: screen position, scale, colour
  const nodes = S.nodeBuf;
  for (let i = 0; i < N; i++) {
    const o = i * 3, z = P[o + 2], f = PERSP / (PERSP - cl(z, -150, 150));
    const px = 32 + (P[o] - 32) * f, py = 64 + (P[o + 1] - 64) * f;
    sx[i] = px; sy[i] = py;
    const ct = cos(TH[i]), st = sin(TH[i]);
    const nx = ct * U[o] + st * Vv[o], ny = ct * U[o + 1] + st * Vv[o + 1], nz = ct * U[o + 2] + st * Vv[o + 2];
    const bx = ct * Vv[o] - st * U[o], by = ct * Vv[o + 1] - st * U[o + 1];
    const m = nz >= 0 ? 1 : -1;
    const mnx = m * nx, mny = m * ny, mnz = m * nz;
    const diff = max(0, mnx * LAMP[0] + mny * LAMP[1] + mnz * LAMP[2]);
    const hl = max(0, mnx * HALF[0] + mny * HALF[1] + mnz * HALF[2]);
    const spec = 0.85 * pow(hl, 12), sheen = 0.5 * pow(1 - mnz, 3);
    const light = 0.6 + 0.4 * diff;
    const fa = ss(-0.14, 0.14, nz);
    const spl = SPOT_MIN + (1 - SPOT_MIN) * exp(-0.5 * (((px - S.spot[0]) / SPOT_X) ** 2 + ((py - S.spot[1]) / SPOT_Y) ** 2));
    const dep = 0.84 + 0.16 * cl((z + 30) / 60, 0, 1);
    const g = spl * dep;
    const hlk = (spec + sheen) * spl;
    for (let c = 0; c < 3; c++) {
      const base = cB[c] + (cA[c] - cB[c]) * fa;
      nodes[i * 9 + c] = base * light * g + (0.88 * 255 * 0.75 + base * 0.25) * hlk;
    }
    nodes[i * 9 + 3] = bx * WIDTH * 0.5 * f; nodes[i * 9 + 4] = by * WIDTH * 0.5 * f; nodes[i * 9 + 5] = f;
    nodes[i * 9 + 6] = z;
  }
  // edge offsets: across the band, never under PMIN across it on the screen
  for (let i = 0; i < N; i++) {
    const a = i === 0 ? 0 : i - 1, b = i === N - 1 ? N - 1 : i + 1;
    let tx = sx[b] - sx[a], ty = sy[b] - sy[a];
    const l = sqrt(tx * tx + ty * ty);
    if (l < 1e-6) { tx = 0; ty = 1; } else { tx /= l; ty /= l; }
    const qx = -ty, qy = tx;
    let ox = nodes[i * 9 + 3], oy = nodes[i * 9 + 4];
    let c = ox * qx + oy * qy;
    if (c < 0) { ox = -ox; oy = -oy; c = -c; }
    if (c < PMIN) { ox += qx * (PMIN - c); oy += qy * (PMIN - c); }
    nodes[i * 9 + 3] = ox; nodes[i * 9 + 4] = oy;
  }
  // the quads between neighbouring nodes
  for (let i = 0; i < N - 1; i++) {
    const a = i * 9, b = a + 9;
    for (let s = 0; s < 4; s++) {
      const n = s < 2 ? a : b, sg = s & 1 ? 1 : -1, o = s * 7;
      v[o] = sx[s < 2 ? i : i + 1] + sg * nodes[n + 3];
      v[o + 1] = sy[s < 2 ? i : i + 1] + sg * nodes[n + 4];
      v[o + 2] = nodes[n + 6];
      v[o + 3] = nodes[n]; v[o + 4] = nodes[n + 1]; v[o + 5] = nodes[n + 2];
      v[o + 6] = sg;
    }
    fillTri(S, 0, 1, 3);
    fillTri(S, 0, 3, 2);
  }
  // the hall, the trace and the ribbon, resolved to LEDs
  const dec = traceOf(S.ks[3]) > 0 ? exp(-dt / traceOf(S.ks[3])) : 0;
  const tr = S.tr, out = S.out, zb = S.zb, sb = S.sb;
  const hr = (cA[0] + cB[0]) * 0.5, hg = (cA[1] + cB[1]) * 0.5, hb = (cA[2] + cB[2]) * 0.5, cH = S.colH;
  const inv = 1 / (SS * SS);
  const tra = S.tra, tau = traceOf(S.ks[3]);
  const haze = HAZE * (1 + 0.5 * (1 - min(1, tau / 1.4))); // with no trace the hall is a little more present
  S.strobe += dt;
  const stamp = S.strobe >= STROBE;
  if (stamp) S.strobe -= STROBE;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3, sp = gx[x] * gy[y];
      const hx = x / HZ, hy = y / HZ, i0 = hx | 0, j0 = hy | 0, fx = hx - i0, fy = hy - j0, q = j0 * HW + i0;
      const hn = hz[q] * (1 - fx) * (1 - fy) + hz[q + 1] * fx * (1 - fy) + hz[q + HW] * (1 - fx) * fy + hz[q + HW + 1] * fx * fy;
      const k = 0.012 + haze * ss(0.3, 0.8, hn) * (0.5 + 0.5 * sp);
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = 0; j < SS; j++) {
        const row = (y * SS + j) * SW + x * SS;
        for (let i = 0; i < SS; i++) {
          if (zb[row + i] > -1e8) {
            const q = (row + i) * 3;
            r += sb[q]; g += sb[q + 1]; b += sb[q + 2]; n++;
          }
        }
      }
      let t0 = tr[o] * dec, t1 = tr[o + 1] * dec, t2 = tr[o + 2] * dec, ta = tra[p] * dec;
      if (n > 0 && stamp) {
        const f = TRACE_W * inv;
        t0 = max(t0, r * f); t1 = max(t1, g * f); t2 = max(t2, b * f); ta = max(ta, n * inv);
      }
      tr[o] = t0; tr[o + 1] = t1; tr[o + 2] = t2; tra[p] = ta;
      // under a ghost the haze gives way, so a ghost keeps its own colour
      const hz2 = k * (1 - min(1, 2 * ta)), back = (SS * SS - n) * inv;
      out[o] = r * inv + back * (t0 + cH[0] * hz2);
      out[o + 1] = g * inv + back * (t1 + cH[1] * hz2);
      out[o + 2] = b * inv + back * (t2 + cH[2] * hz2);
    }
  }
  // the bright point where the stick tip is
  const tx = sx[0], ty = sy[0];
  const x0 = max(0, floor(tx - 5)), x1 = min(W - 1, floor(tx + 5)), y0 = max(0, floor(ty - 5)), y1 = min(H - 1, floor(ty + 5));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - tx, dy = y + 0.5 - ty, d2 = dx * dx + dy * dy, o = (y * W + x) * 3;
      const core = exp(-d2 / 1.3), halo = 0.32 * exp(-d2 / 7);
      out[o] += 255 * core + hr * halo; out[o + 1] += 248 * core + hg * halo; out[o + 2] += 236 * core + hb * halo;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const out = S.out;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(out[o], 0, 255) | 0, cl(out[o + 1], 0, 255) | 0, cl(out[o + 2], 0, 255) | 0);
    }
  }
}
