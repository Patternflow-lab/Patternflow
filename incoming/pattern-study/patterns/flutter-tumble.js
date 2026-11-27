// ===== Patternflow pattern =====
// Title:   Flutter and Tumble
// Family:  fallingplate
// Idea:    Thin plates fall through a deep navy fluid under a quasi-steady model of a card in water, and one number, the plate's dimensionless moment of inertia, decides how each one comes down: light plates sway from side to side in a flutter, heavy ones roll end over end and slide sideways in a tumble, and in between they do both by turns, each leaving a ribbon of its own colour that draws the zigzag or the running arc.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: James Clerk Maxwell on a falling slip of paper that turns as it goes (1854, from memory); fluttering and tumbling of falling plates and the phase map in Reynolds number and dimensionless moment of inertia (Willmarth, Hawk and Harvey, 1964; Field, Klaus, Moore and Nori, 1997; Belmonte, Eisenberg and Moses, 1998, from memory); a quasi-steady two-dimensional model with added mass, a circulation lift and a drag that turn with the plate's angle of attack, lift 1.2 sin 2a and drag 1.4 - cos 2a (Pesavento and Wang, 2004; Andersen, Pesavento and Wang, 2005, from memory). Original here: the constants are tuned by eye on the panel and not fitted to any experiment, and each plate's time is scaled so that heavy and light ones cross the 128 rows in about the same time, pattern round 265
// Round:   265
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Fall=0.4..3, Inertia=-0.5..1, Plates=-1..1
//
// Knob 1: Hue. Turns the plates and their ribbons round the wheel together, each plate keeping its place in the run. At 0 the plates are azure, aqua, green, lime and gold, one colour each, and at 0.5 they are blue, violet, magenta, red and orange. The water stays a dark navy and tips toward teal or indigo by up to 0.12 of the wheel.
// Knob 2: Fall. How fast the world runs, plates and ribbons together. At 2, where it opens, a plate crosses the 128 rows in about 9 s, 15 s when the plates are the lightest; 0.4 is five times slower and 3 is half as fast again.
// Knob 3: Inertia. The plates' dimensionless moment of inertia, 0.17 at -0.5, 0.5 at 0 where it opens, and 4.1 at 1, each new plate spread 40 percent either way of that. Light plates flutter, swaying 10 LEDs from side to side at -0.5 and 20 at 0 while they zigzag down at about 10 LEDs a second; heavy ones tumble, turning end over end about every 3 s and sliding 23 LEDs a second across the panel. Counted over 4 s stretches, no plate tumbles at -0.5, 14 percent at 0, half at 0.5, 88 percent at 0.75 and all at 1; between them plates swoop in arcs 30 LEDs wide and change from one way of falling to the other.
// Knob 4: Plates. How many plates fall at once: 4 at -1, 7 at 0.06 where it opens, 11 at 1. A plate the knob takes away fades out over about a second, and one it adds fades in somewhere over the panel. The ribbons are 400 divided by the number of plates in LEDs long, 100 at 4, 57 at 7 and 36 at 11, so the panel holds about the same length of line however many plates there are and the ribbons stay apart.

// What the picture is. Seven plates, 9 to 11 LED long and 2 wide, fall down the 64 x 128 panel over a navy that is a little brighter toward the bottom. Each is a pale bar with a dim end and a white-hot
// end, so the turning shows, and each draws a ribbon 2 LED wide in its own colour from the middle of the bar, bright at the plate and fading out along its length, which is the path the plate took. A plate
// that leaves at the bottom is replaced at the top, at a random place and with a random weight, and its old ribbon runs on down and out. Plates that cross a side come in at the other side.
// The model. Each plate is a flat plate in two dimensions in the Kirchhoff equations: position, angle, velocity along and across its chord, and turning rate, with the fluid's added mass across the
// plate (pi/4 of the plate's chord squared) and almost none along it, the added moment of inertia pi/128, gravity, a lift 1.2 sin 2a and a drag that is 0.6 edge-on and 2.4 broadside for angle of attack a,
// a circulation from the plate's own turning (2.2 where the model this is taken from has pi), a torque from turning against the fluid, and the Munk torque, which turns a plate broadside to its fall. All
// in units of the chord, so one number, the plate's mass per chord squared, which is also its dimensionless moment of inertia, sets the whole of how it falls. That is the Inertia knob, and the transition from
// flutter to tumble is in it (see Knob 3 for where): below it a plate swings back and forth, above it the plate has too much inertia to turn back and goes
// round, and the circulation from its turning then pushes it sideways, which is the drift. The drag edge-on was 0.4 at first, and then a plate of weight 0.7 fell edge-on at four times the speed of the others and
// would not flutter; 0.6 took that away.
// What is not exact. The constants are tuned by eye and not fitted to any experiment, and the time of each plate is scaled by its weight to the power of -0.6 so that a heavy plate, which would fall and slide two or
// three times as fast as a light one, crosses the panel in about the same time. A small random torque, correlated over about a unit of plate time, keeps a flutter from repeating itself. RK4 steps of at most 0.02
// of plate time, four to eight to a frame, and the speed and the turning rate are held at 3.2 and 6.
// Opening. A new plate is let fall for 40 units of plate time without moving before anyone sees it: a heavy one dropped from rest falls flat and straight down for 10 to 30 units before it begins to roll, and the
// first version let that show, as a long vertical ribbon with a bar across its end. The first update lets the plates fall for 6.5 s so that their ribbons are drawn, and then sets each on a row and a column of its own,
// with its ribbon, so that the opening has plates over the whole panel.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, atan2, min, max, abs, PI, round, ceil, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

// ---- the plate, in units of its own chord and of the time a chord takes to fall at unit weight
const NMAX = 11;
const CD0 = 0.6, CD90 = 2.4; // drag coefficient edge-on and broadside; 1.4 - cos 2a would be 0.4 and 2.4
const CLIFT = 1.2; // lift coefficient is this times sin 2a
const CROT = 2.2; // circulation from the plate's own turning, pi in the model this is taken from
const C1 = 0.045; // torque from the plate turning against the fluid, per omega squared
const MV = PI / 4, JA = PI / 128; // added mass across a flat plate, and added moment of inertia
const H0 = 0.02; // the largest step the integrator takes, in plate time
const TAU0 = 0.3; // seconds of the world to a unit of plate time at Fall 2
const TRACE = 0; // where along the chord the ribbon is drawn from: -1 the dim end, 0 the middle, 1 the bright end
const VMAX = 3.2, WMAX = 6; // what a plate may not exceed, which only a start from nothing could reach

// the six numbers of a plate, as a vector: position x, y, angle, velocity along the chord u, across it v, turning rate w
function deriv(s, m, mu, J, out, noise) {
  const th = s[2], u = s[3], v = s[4], w = s[5];
  const sp = sqrt(u * u + v * v) + 1e-9, b = atan2(v, u), c2 = cos(2 * b);
  const cd = 0.5 * (CD0 + CD90) - 0.5 * (CD90 - CD0) * c2, cll = CLIFT * sin(2 * b);
  const gam = 0.5 * CROT * w;
  const fu = -m * sin(th) - 0.5 * cd * sp * u + 0.5 * cll * sp * v - gam * v;
  const fv = -m * cos(th) - 0.5 * cd * sp * v - 0.5 * cll * sp * u + gam * u;
  const tq = (mu - m - MV) * u * v - C1 * w * abs(w) + noise;
  out[0] = u * cos(th) - v * sin(th);
  out[1] = u * sin(th) + v * cos(th);
  out[2] = w;
  out[3] = (( m + MV) * v * w + fu) / mu;
  out[4] = (-mu * u * w + fv) / (m + MV);
  out[5] = tq / J;
}

const k1 = new Float64Array(6), k2 = new Float64Array(6), k3 = new Float64Array(6), k4 = new Float64Array(6), tmp = new Float64Array(6);
// one RK4 step of a plate of mass m, h in plate time
function rk4(p, h) {
  const s = p.s, m = p.m, mu = m + 0.01, J = m / 12 + JA, nz = p.nz;
  deriv(s, m, mu, J, k1, nz);
  for (let i = 0; i < 6; i++) tmp[i] = s[i] + 0.5 * h * k1[i];
  deriv(tmp, m, mu, J, k2, nz);
  for (let i = 0; i < 6; i++) tmp[i] = s[i] + 0.5 * h * k2[i];
  deriv(tmp, m, mu, J, k3, nz);
  for (let i = 0; i < 6; i++) tmp[i] = s[i] + h * k3[i];
  deriv(tmp, m, mu, J, k4, nz);
  for (let i = 0; i < 6; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  const sp = sqrt(s[3] * s[3] + s[4] * s[4]);
  if (sp > VMAX) { s[3] *= VMAX / sp; s[4] *= VMAX / sp; }
  s[5] = cl(s[5], -WMAX, WMAX);
  if (!(sp >= 0)) { s[3] = s[4] = s[5] = 0; }
}

// ---- the plates
function makePlate(i) {
  return {
    i, on: false, al: 0, live: false,
    s: new Float64Array(6), m: 1, len: 10, kap: 1, nz: 0, nzt: 0,
    X: 32, Y: -20, tx: [], ty: [], arc: 0, lx: 0, ly: 0, vx: 0, vy: 0,
    u: ((0.5 + i * 0.6180339887) % 1), hj: 0, hue: 0,
  };
}

// the time scale of a plate: the heavy ones would fall and slide several times faster than the light ones, so
// each plate's own clock is slowed by about the square root of its weight, which keeps the crossing times close
function clockOf(m) {
  return cl(pow(m, -0.6), 0.35, 2);
}

function release(S, p, atTop, y) {
  p.live = true;
  p.m = S.m0 * exp(0.4 * gauss());
  p.m = cl(p.m, 0.12, 8);
  p.kap = clockOf(p.m);
  p.len = 9 + 2 * rnd();
  p.s[0] = 0;
  p.s[1] = 0;
  p.s[2] = (rnd() - 0.5) * 1.7;
  p.s[3] = p.s[4] = p.s[5] = 0;
  p.X = 7 + 50 * rnd();
  p.Y = atTop ? -0.5 * p.len - 6 * rnd() - 1 : y;
  p.hj = 0.02 * gauss();
  p.nz = 0;
  p.nzt = 0;
  // let it come to its own way of falling before anyone sees it: a heavy plate dropped from rest falls flat and
  // straight down for 10 to 30 units of plate time before it starts to roll, and a new plate should enter already
  // doing what it does
  const kept = p.s[0], keptY = p.s[1];
  for (let k = 0; k < 1800; k++) rk4(p, H0);
  p.s[0] = kept;
  p.s[1] = keptY;
  p.tx.length = 0;
  p.ty.length = 0;
  p.arc = 0;
  p.vx = p.vy = 0;
}

// the end of the plate that carries the highlight, and the point the ribbon is drawn from
function head(p) {
  const th = p.s[2], hl = TRACE * 0.5 * p.len;
  return [p.X + hl * cos(th), p.Y - hl * sin(th)];
}

function addPoint(S, p) {
  const h = head(p), n = p.tx.length;
  if (n === 0) {
    p.tx.push(h[0]);
    p.ty.push(h[1]);
    p.lx = h[0];
    p.ly = h[1];
    return;
  }
  const dx = h[0] - p.lx, dy = h[1] - p.ly, d = sqrt(dx * dx + dy * dy);
  if (d < 1.1) return;
  p.tx.push(h[0]);
  p.ty.push(h[1]);
  p.arc += d;
  p.lx = h[0];
  p.ly = h[1];
  // the ribbon is as long as the knob says; the oldest end goes
  while (p.arc > S.tail && p.tx.length > 2) {
    const a = p.tx[1] - p.tx[0], b = p.ty[1] - p.ty[0];
    p.arc -= sqrt(a * a + b * b);
    p.tx.shift();
    p.ty.shift();
  }
}

function stepPlate(S, p, dt) {
  const sp = S.speed;
  let tau = (dt * sp * p.kap) / TAU0;
  const n = max(1, ceil(tau / H0));
  const h = tau / n;
  for (let k = 0; k < n; k++) {
    // a gentle random torque, correlated over about a unit of plate time, so no flutter repeats itself exactly
    p.nzt += (-p.nzt + 0.5 * gauss()) * min(1, h * 1.2);
    p.nz = p.nzt * 0.05 * (0.4 + 0.2 * p.m);
    rk4(p, h);
    const s = p.s;
    // plate time to LED: the chord is p.len LED, and y is up in the plate and down on the panel
    const vx = s[3] * cos(s[2]) - s[4] * sin(s[2]), vy = s[3] * sin(s[2]) + s[4] * cos(s[2]);
    p.X += vx * h * p.len;
    p.Y -= vy * h * p.len;
    p.vx = (vx * p.len * sp * p.kap) / TAU0;
    p.vy = (-vy * p.len * sp * p.kap) / TAU0;
    addPoint(S, p);
  }
}

// a plate's colour: its own place in a run of neighbouring hues, the golden ratio keeping any seven or eight of them well apart
const plateHue = (S, p) => 0.57 - 0.45 * p.u + p.hj + S.hue;

function retire(S, p) {
  if (p.tx.length > 2) S.ghosts.push({ tx: p.tx.slice(), ty: p.ty.slice(), hue: plateHue(S, p), vx: p.vx, vy: p.vy, t: 0, wrapK: floor(p.X / W) });
  p.tx.length = 0;
  p.ty.length = 0;
  p.arc = 0;
  p.live = false;
}

function advance(S, dt) {
  S.m0 = 0.5 * exp(2.1 * S.ks[2]);
  S.nsm += (S.n - S.nsm) * min(1, dt * 1.5);
  S.tail = 400 / S.nsm;
  for (const p of S.plates) {
    p.on = p.i < S.n;
    if (p.on && !p.live && p.al <= 0.001) {
      // a plate that the knob adds comes in somewhere over the panel, from nothing
      release(S, p, false, 8 + (H - 30) * rnd());
      p.al = 0;
    }
    p.al += ((p.on ? 1 : 0) - p.al) * min(1, dt * 2.2);
    if (!p.on && p.al < 0.02) {
      if (p.live) retire(S, p);
      p.al = 0;
      continue;
    }
    if (!p.live) {
      release(S, p, true, 0);
    }
    stepPlate(S, p, dt);
    if (p.Y - 0.5 * p.len > H + 3) {
      retire(S, p);
      if (p.on) release(S, p, true, 0);
    }
  }
  for (let g = S.ghosts.length - 1; g >= 0; g--) {
    const G = S.ghosts[g];
    G.t += dt;
    for (let i = 0; i < G.tx.length; i++) {
      G.tx[i] += G.vx * dt;
      G.ty[i] += G.vy * dt;
    }
    if (G.t > 1.3) S.ghosts.splice(g, 1);
  }
}

export function setup(params) {
  const plates = [];
  for (let i = 0; i < NMAX; i++) plates.push(makePlate(i));
  params.s = {
    ready: false, t: 0, speed: 1, n: 7, nsm: 7, m0: 0.5, tail: 57, ks: [0, 2, 0, 0.06],
    plates, ghosts: [], buf: new Float32Array(W * H * 3), hue: 0,
  };
}

function knobsOf(kn) {
  return { hue: cl(kn[0], 0, 1), fall: cl(kn[1], 0.4, 3), inert: cl(kn[2], -0.5, 1), pl: cl(kn[3], -1, 1) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    const K = knobsOf(S.ks);
    S.n = cl(round(7.2 + 3.4 * K.pl), 4, NMAX);
    S.nsm = S.n;
    S.speed = K.fall / 2;
    S.m0 = 0.5 * exp(2.1 * K.inert);
    S.tail = 400 / S.n;
    // the plates come down for a few seconds before the first frame, so their ribbons are drawn, and are then
    // set on rows spread over the panel, each with its ribbon, so that the opening has plates everywhere
    const order = [];
    for (let i = 0; i < S.n; i++) order.push(i);
    for (let i = S.n - 1; i > 0; i--) {
      const j = floor(rnd() * (i + 1)), t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    const colX = order.slice();
    for (let i = S.n - 1; i > 0; i--) {
      const j = floor(rnd() * (i + 1)), t = colX[i];
      colX[i] = colX[j];
      colX[j] = t;
    }
    for (const p of S.plates) {
      p.hue = 0;
      if (p.i < S.n) {
        release(S, p, false, -45);
        p.al = 1;
      }
    }
    for (let k = 0; k < 130; k++) advance(S, 1 / 20);
    for (const p of S.plates) {
      if (!p.live || p.i >= S.n) continue;
      const dx = 6 + (52 * (colX[p.i] + 0.15 + 0.7 * rnd())) / S.n - p.X, dy = (H * (order[p.i] + 0.12 + 0.76 * rnd())) / S.n - p.Y;
      p.X += dx;
      p.Y += dy;
      p.lx += dx;
      p.ly += dy;
      for (let k = 0; k < p.tx.length; k++) {
        p.tx[k] += dx;
        p.ty[k] += dy;
      }
    }
    S.ghosts.length = 0;
  }
  const e = 1 - exp(-d / 0.25);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  const K = knobsOf(S.ks);
  S.hue = K.hue;
  S.speed = K.fall / 2;
  S.n = cl(round(7.2 + 3.4 * cl(kn[3], -1, 1)), 4, NMAX);
  advance(S, d);
  S.t += d;
}

// ---- drawing
function hsv(h, s, v, out) {
  h = (((h % 1) + 1) % 1) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  out[0] = [v, q, p, p, t, v][i % 6];
  out[1] = [t, v, v, q, p, p][i % 6];
  out[2] = [p, p, t, v, v, q][i % 6];
}

const ca = [0, 0, 0], cb = [0, 0, 0], cw = [0, 0, 0];

// 1 where a hue is orange to yellow-green, which a dim ribbon turns to brown and olive; there it is laid paler and stronger
function warmth(h) {
  const t = h - floor(h);
  return ss(0.0, 0.05, t) * (1 - ss(0.2, 0.27, t));
}

// a segment with its own colour and alpha at each end, composited over what is there
function seg(buf, ax, ay, bx, by, c0, a0, c1, a1, rad) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy + 1e-9;
  const xa = max(0, floor(min(ax, bx) - rad - 1)), xb = min(W - 1, ceil(max(ax, bx) + rad + 1));
  const ya = max(0, floor(min(ay, by) - rad - 1)), yb = min(H - 1, ceil(max(ay, by) + rad + 1));
  if (xa > xb || ya > yb) return;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      const t = cl((px * dx + py * dy) / l2, 0, 1), ex = px - t * dx, ey = py - t * dy;
      const cov = cl(rad + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (cov <= 0) continue;
      const a = (a0 + (a1 - a0) * t) * cov, o = (y * W + x) * 3;
      buf[o] += ((c0[0] + (c1[0] - c0[0]) * t) - buf[o]) * a;
      buf[o + 1] += ((c0[1] + (c1[1] - c0[1]) * t) - buf[o + 1]) * a;
      buf[o + 2] += ((c0[2] + (c1[2] - c0[2]) * t) - buf[o + 2]) * a;
    }
}

function disc(buf, cx, cy, r, c, al) {
  const xa = max(0, floor(cx - r - 1)), xb = min(W - 1, ceil(cx + r + 1)), ya = max(0, floor(cy - r - 1)), yb = min(H - 1, ceil(cy + r + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const a = al * cl(r + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
      if (a <= 0) continue;
      const o = (y * W + x) * 3;
      buf[o] += (c[0] - buf[o]) * a;
      buf[o + 1] += (c[1] - buf[o + 1]) * a;
      buf[o + 2] += (c[2] - buf[o + 2]) * a;
    }
}

// the ribbon: along its points, from old and dim to new and bright; it is drawn at the three wraps of the panel's width
function ribbon(buf, tx, ty, hx, hy, shift, col, fade, rad, k) {
  const n = tx.length;
  if (n < 1) return;
  for (let w = -1; w <= 1; w++) {
    const off = shift + w * W;
    for (let i = 0; i < n; i++) {
      const x0 = tx[i] + off, y0 = ty[i];
      const x1 = i + 1 < n ? tx[i + 1] + off : hx + off, y1 = i + 1 < n ? ty[i + 1] : hy;
      const u0 = i / n, u1 = (i + 1) / n;
      const a0 = fade * k * (0.02 + 0.45 * pow(u0, 1.3)), a1 = fade * k * (0.02 + 0.45 * pow(u1, 1.3));
      seg(buf, x0, y0, x1, y1, col, a0, col, a1, rad);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf;
  // the water: deep navy, darker at the top, leaning a little to teal or to indigo as the hue turns
  const bh = 0.66 + 0.12 * sin(2 * PI * S.hue);
  hsv(bh, 1, 1, cw);
  for (let y = 0; y < H; y++) {
    const v = 0.035 + 0.17 * (y / (H - 1));
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      buf[o] = cw[0] * v;
      buf[o + 1] = cw[1] * v;
      buf[o + 2] = cw[2] * v;
    }
  }
  const wrapOf = (x) => -W * floor(x / W);
  for (const G of S.ghosts) {
    if (G.tx.length < 2) continue;
    const c = [0, 0, 0];
    hsv(G.hue, 0.95 - 0.3 * warmth(G.hue), 0.9, c);
    const n = G.tx.length;
    ribbon(buf, G.tx.slice(0, n - 1), G.ty.slice(0, n - 1), G.tx[n - 1], G.ty[n - 1], wrapOf(G.tx[n - 1]), c, 1 - ss(0, 1.3, G.t), 1, 1 + 0.7 * warmth(G.hue));
  }
  for (const p of S.plates) {
    if (!p.live || p.al <= 0.01) continue;
    p.hue = plateHue(S, p);
    const wm = warmth(p.hue);
    hsv(p.hue, 0.95 - 0.3 * wm, 0.9, ca);
    const hd = head(p), shift = wrapOf(p.X);
    ribbon(buf, p.tx, p.ty, hd[0], hd[1], shift, ca, p.al, 1, 1 + 0.7 * wm);
  }
  for (const p of S.plates) {
    if (!p.live || p.al <= 0.01) continue;
    hsv(plateHue(S, p), 0.3, 1, ca);
    hsv(plateHue(S, p), 0.85, 0.8, cb);
    const th = p.s[2], hl = 0.5 * p.len, shift = wrapOf(p.X);
    for (let w = -1; w <= 1; w++) {
      const cx = p.X + shift + w * W, cy = p.Y;
      if (cx + hl < -3 || cx - hl > W + 3) continue;
      const ex = hl * cos(th), ey = -hl * sin(th);
      // the tail end is dim and the head end is bright and ends in a white-hot spot, so the turning shows
      seg(buf, cx - ex, cy - ey, cx + ex, cy + ey, cb, 0.2 * p.al, ca, 0.3 * p.al, 2.6);
      seg(buf, cx - ex, cy - ey, cx + ex, cy + ey, cb, p.al, ca, p.al, 1);
      cw[0] = 1; cw[1] = 0.95 + 0.05 * ca[1]; cw[2] = 0.9 + 0.1 * ca[2];
      disc(buf, cx + ex, cy + ey, 1.5, cw, 0.9 * p.al);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[o] * 255, 0, 255) | 0, cl(buf[o + 1] * 255, 0, 255) | 0, cl(buf[o + 2] * 255, 0, 255) | 0);
    }
}
