// ===== Patternflow pattern =====
// Title:   Beachballs
// Family:  focalsphere
// Idea:    A dark fault map on which earthquakes keep going off, each one drawn as its focal mechanism: a disc of the lower focal sphere in equal-area projection, split by the two nodal planes into warm compressional lobes and cool dilational ones, popping in with a flash and a ring, crowding aftershocks around the big ones, and turning slowly as the regional stress turns.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the seismologist's beach ball, the lower-hemisphere equal-area (Schmidt) projection of the P-wave first-motion sign (u.n)(u.s) of a double-couple source (Aki and Richards, Quantitative Seismology, 1980, from memory), Anderson's three faulting regimes (1905, from memory), the ETAS aftershock process with Gutenberg-Richter magnitudes and the Omori-Utsu decay (Ogata 1988, from memory), pattern round 237
// Round:   237
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.3..3, Regime=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns both lobe colours round the wheel together, so the compressional lobes and the dilational ones stay opposite each other. At 0 the compressional lobes are amber and the dilational ones teal. The ground, the fault traces and the nodal lines stay cool or cream and do not turn.
// Knob 2: Rate. 0.3 to 3, opening at 2. How busy the fault is: the background rate, the share of shocks that are aftershocks, and the smallest magnitude that shows. At 0.3 a few big balls (up to 16 LEDs radius) stand on an almost empty map and a new one comes every three seconds or so. At 3 the map holds 40 balls, most of them small ones of 4 to 6 LEDs radius, crowded and overlapping.
// Knob 3: Regime. -1 to 1, opening at 0. The stress regime of the whole map and of every ball already on it, which turn toward it over a few seconds. At -1 it is thrust faulting: each ball has a warm centre and bands across it. At 0 it is strike-slip faulting: a cross of four lobes, warm and cool in turn. At 1 it is normal faulting: a cool centre with warm bands either side. In between the lobes slide from one to the other.
// Knob 4: Spread. -1 to 1, opening near 0. How long balls live and how far aftershocks fall from the shock that set them off, which are Omori decay and dispersion together. At -1 a ball fades in a few seconds and its aftershocks come within a few LEDs and finish early: tight, short-lived clusters. At 1 a ball lasts about twice as long as at 0 and its aftershocks fall across half the map and keep coming for minutes: slow, wide clusters.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, round, exp, log, pow, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
const frac = (v) => v - floor(v);
// An odd step: -1 below -1, 1 above 1, flat at both ends, so a nodal edge is soft but has no kink.
const softSign = (x) => {
  x = cl(x, -1, 1);
  return x * (1.5 - 0.5 * x * x);
};
function poisson(l) {
  if (l <= 0) return 0;
  if (l > 30) return max(0, round(l + sqrt(l) * gauss()));
  const L = exp(-l);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function warmLift(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.3 * b), min(1, v * (1 + 0.55 * b)), out, o);
}

// ---- the seismicity ------------------------------------------------------
// Magnitudes M run from 0 up to MMAX with a Gutenberg-Richter slope B_VAL. B_VAL is a little under
// the usual 1 so that big balls show up often enough to be seen.
const B_VAL = 0.8, BETA = B_VAL * log(10), MMAX = 3.2;
const ALPHA = 0.5;    // productivity: an event of magnitude M sets off about 10^(ALPHA M) offspring
const CAP = 40;       // live balls; past that the faintest is faded out early
const QMAX = 320;     // events waiting in the queue of aftershocks
const GR_STEPS = 24;

const radiusOf = (M) => 3.8 + 12.2 * pow(cl(M / MMAX, 0, 1), 0.8);
const lifeOf = (M) => 8 * exp(log(7.5) * cl(M / MMAX, 0, 1)); // 8 s for the smallest, 60 s for the largest
// A magnitude from the truncated Gutenberg-Richter law between mc and mhi.
function drawMag(mc, mhi) {
  if (mhi < mc + 0.05) mhi = mc + 0.05;
  const top = 1 - exp(-BETA * (mhi - mc));
  return mc - log(1 - Math.random() * top) / BETA;
}
// The mean of 10^(ALPHA M) over the magnitudes that show, to turn the branching ratio into a count.
function meanProd(mc) {
  let a = 0, b = 0;
  for (let i = 0; i < GR_STEPS; i++) {
    const m = mc + ((MMAX - mc) * (i + 0.5)) / GR_STEPS, w = exp(-BETA * (m - mc));
    a += w * pow(10, ALPHA * m);
    b += w;
  }
  return a / b;
}
// A delay after the shock, drawn from the Omori-Utsu law 1 / (t + c)^p cut at the horizon T.
function omori(c, p, T) {
  const a = pow(c, 1 - p), b = pow(T + c, 1 - p);
  return pow(a - Math.random() * (a - b), 1 / (1 - p)) - c;
}

// ---- rotations -----------------------------------------------------------
// A 3x3 matrix is nine numbers, row by row. The axes are x north, y east, z down.
function rod(ax, ay, az, ang, o) {
  const c = cos(ang), s = sin(ang), t = 1 - c;
  o[0] = t * ax * ax + c; o[1] = t * ax * ay - s * az; o[2] = t * ax * az + s * ay;
  o[3] = t * ax * ay + s * az; o[4] = t * ay * ay + c; o[5] = t * ay * az - s * ax;
  o[6] = t * ax * az - s * ay; o[7] = t * ay * az + s * ax; o[8] = t * az * az + c;
}
function mul(a, b, o) {
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
}
function randomAxis(v) {
  const z = 2 * Math.random() - 1, f = TAU * Math.random(), r = sqrt(1 - z * z);
  v[0] = r * cos(f); v[1] = r * sin(f); v[2] = z;
}
const SCR = new Float64Array(9), SCR2 = new Float64Array(9), AX = new Float64Array(3);
// m := a small rotation of angle ang about a random axis, times m.
function jolt(m, ang) {
  randomAxis(AX);
  rod(AX[0], AX[1], AX[2], ang, SCR);
  mul(SCR, m, SCR2);
  for (let i = 0; i < 9; i++) m[i] = SCR2[i];
}

// The mechanism of a ball from the regional stress. The P axis is the direction of greatest
// compression, the T axis the greatest tension, and the fault normal n and the slip vector s are
// (T + P) / sqrt 2 and (T - P) / sqrt 2, so (u.n)(u.s) = ((u.T)^2 - (u.P)^2) / 2.
// Start from strike-slip: P and T lie flat, P pointing along azimuth beta (clockwise from north).
// Anderson's other two regimes tip that frame: thrust (reg = -1) turns T up to vertical about P,
// normal (reg = 1) turns P up to vertical about T. E, the ball's own small tilt, is applied last.
// Centre check: u = (0, 0, 1) gives (T_z^2 - P_z^2) / 2, positive for thrust (compression at the
// centre), negative for normal, zero for strike-slip (a cross).
function mechanism(b) {
  const beta = b.beta + b.dBeta, reg = cl(b.reg + b.dReg, -1, 1);
  const cb = cos(beta), sb = sin(beta);
  let px = cb, py = sb, pz = 0, tx = -sb, ty = cb, tz = 0;
  if (reg < 0) {
    const f = (-reg * PI) / 2, c = cos(f), s = sin(f);
    tx *= c; ty *= c; tz = s; // T turns toward the vertical B0 = (0, 0, 1)
  } else if (reg > 0) {
    const f = (reg * PI) / 2, c = cos(f), s = sin(f);
    px *= c; py *= c; pz = -s;
  }
  const E = b.E, k = sqrt(0.5);
  const nx = (tx + px) * k, ny = (ty + py) * k, nz = (tz + pz) * k;
  const sx = (tx - px) * k, sy = (ty - py) * k, sz = (tz - pz) * k;
  const n = b.n, s = b.s;
  n[0] = E[0] * nx + E[1] * ny + E[2] * nz; n[1] = E[3] * nx + E[4] * ny + E[5] * nz; n[2] = E[6] * nx + E[7] * ny + E[8] * nz;
  s[0] = E[0] * sx + E[1] * sy + E[2] * sz; s[1] = E[3] * sx + E[4] * sy + E[5] * sz; s[2] = E[6] * sx + E[7] * sy + E[8] * sz;
}

// ---- the map -------------------------------------------------------------
// Five fault traces, each a cubic curve through four points on the panel, drawn once. Shocks
// fall near them, and the traces glow a little where shocks have lately fallen.
const TRACES = [
  [[-8, 14], [22, 30], [44, 2], [72, 26]],
  [[72, 56], [42, 70], [18, 44], [-8, 74]],
  [[-8, 100], [22, 86], [46, 112], [72, 92]],
  [[12, -8], [34, 36], [6, 84], [30, 136]],
  [[64, 66], [48, 98], [60, 112], [44, 136]],
];
const NS = 96; // samples along a trace for placing shocks
function bez(c, s, o) {
  const u = 1 - s, a = u * u * u, b = 3 * u * u * s, d = 3 * u * s * s, e = s * s * s;
  o[0] = a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0];
  o[1] = a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1];
}

const GX = 16, GY = 32; // the glow of recent shocks, one cell to 4 LEDs

// ---- setup ---------------------------------------------------------------
export function setup(params) {
  params.t = 0;
  params.ready = false;
  params.balls = [];
  params.queue = [];
  params.dens = new Float32Array(GX * GY);
  params.buf = new Float32Array(NPX * 3);
  params.trace = new Float32Array(NPX);   // trace coverage 0..1
  params.traceOf = new Int8Array(NPX);    // which trace owns the pixel, for the glow
  params.pts = [];
  params.tw = [];
  params.ph = [];
  for (let i = 0; i < 10; i++) params.ph.push(Math.random() * TAU);
  params.hue = 0;
  params.live = 10;
  params.mass = 0.2;
  params.reg = 0;
  params.beta = Math.random() * TAU;
  params.regNow = 0;
  const o = [0, 0];
  for (let k = 0; k < TRACES.length; k++) {
    // A little jitter so no two runs draw the same map.
    const c = TRACES[k].map((p) => [p[0] + gauss() * 3, p[1] + gauss() * 3]);
    const pts = [];
    for (let i = 0; i < NS; i++) {
      bez(c, i / (NS - 1), o);
      pts.push([o[0], o[1]]);
    }
    params.pts.push(pts);
    // Splat a soft disc of 1.1 LEDs radius at 400 points along the curve: a line 2 LEDs thick.
    for (let i = 0; i < 400; i++) {
      bez(c, i / 399, o);
      const x0 = floor(o[0] - 2), y0 = floor(o[1] - 2);
      for (let y = max(0, y0); y <= min(H - 1, y0 + 4); y++)
        for (let x = max(0, x0); x <= min(W - 1, x0 + 4); x++) {
          const d = sqrt((x + 0.5 - o[0]) ** 2 + (y + 0.5 - o[1]) ** 2);
          const v = cl(1.35 - d, 0, 1);
          if (v > params.trace[y * W + x]) {
            params.trace[y * W + x] = v;
            params.traceOf[y * W + x] = k;
          }
        }
    }
  }
}

// ---- events --------------------------------------------------------------
// Where a background shock falls: on a trace most of the time, anywhere on the map the rest.
function backgroundPos(P, d, o) {
  let x, y;
  if (Math.random() < 0.7) {
    let tot = 0;
    for (let k = 0; k < TRACES.length; k++) tot += d.tw[k];
    let r = Math.random() * tot, k = 0;
    while (k < TRACES.length - 1 && r > d.tw[k]) r -= d.tw[k++];
    const p = P.pts[k][floor(Math.random() * NS)];
    x = p[0] + gauss() * 5;
    y = p[1] + gauss() * 5;
  } else {
    x = -4 + (W + 8) * Math.random();
    y = -4 + (H + 8) * Math.random();
  }
  o[0] = cl(x, -6, W + 6);
  o[1] = cl(y, -6, H + 6);
}
// Where an aftershock falls: a ring-ish cloud round its parent with a long power-law tail
// (density ~ 1 / (r^2 + dist^2)^1.6), pushed out a little so it does not sit on the parent.
function aftershockPos(ev, o) {
  const rr = min(ev.pr * 0.4 + ev.pd * sqrt(pow(Math.random() + 1e-4, -1 / 0.6) - 1), 3.4 * ev.pr + 5), a = TAU * Math.random();
  let x = ev.px + rr * cos(a), y = ev.py + rr * sin(a);
  // A shock far off the map is reflected back into it, so the cloud cannot drift away.
  if (x < -6) x = -12 - x;
  if (x > W + 6) x = 2 * (W + 6) - x;
  if (y < -6) y = -12 - y;
  if (y > H + 6) y = 2 * (H + 6) - y;
  o[0] = cl(x, -6, W + 6);
  o[1] = cl(y, -6, H + 6);
}

const POS = [0, 0];
function spawn(P, ev, d) {
  const R = radiusOf(ev.M);
  // Three tries at a place for an aftershock, five for a background shock; the one that overlaps the live balls least wins. The clusters stay
  // clusters but the balls in them stay readable.
  let bx = 0, by = 0, bs = -1e9;
  for (let c = 0; c < (ev.pd !== undefined ? 3 : 5); c++) {
    if (ev.pd !== undefined) aftershockPos(ev, POS);
    else backgroundPos(P, d, POS);
    let sc = 1e9;
    for (let i = 0; i < P.balls.length; i++) {
      const o = P.balls[i];
      if (o.dying) continue;
      const v = sqrt((POS[0] - o.x) ** 2 + (POS[1] - o.y) ** 2) - 0.55 * (R + o.R);
      if (v < sc) sc = v;
    }
    if (sc > bs) {
      bs = sc;
      bx = POS[0];
      by = POS[1];
    }
  }
  const life = lifeOf(ev.M) * d.lifeMul * (0.85 + 0.3 * Math.random());
  const b = {
    x: bx, y: by, M: ev.M, R, t0: ev.t, age: P.t - ev.t, life,
    fadeAt: 0.1 * life, dying: false,
    E: new Float64Array(ev.E), spin: new Float64Array(3), spinW: (0.03 + 0.06 * Math.random()) * (Math.random() < 0.5 ? -1 : 1),
    beta: ev.beta, reg: ev.reg, dBeta: ev.dBeta, dReg: ev.dReg,
    hj: gauss() * 0.02, vj: 0.9 + 0.2 * Math.random(),
    n: new Float64Array(3), s: new Float64Array(3),
  };
  randomAxis(b.spin);
  mechanism(b);
  P.balls.push(b);
  // The glow of recent shocks.
  const gx = cl(b.x / 4 - 0.5, 0, GX - 1.001), gy = cl(b.y / 4 - 0.5, 0, GY - 1.001);
  const ix = floor(gx), iy = floor(gy), fx = gx - ix, fy = gy - iy, w = 0.3 + 0.3 * ev.M;
  const D = P.dens;
  D[iy * GX + ix] += w * (1 - fx) * (1 - fy);
  D[iy * GX + ix + 1] += w * fx * (1 - fy);
  D[(iy + 1) * GX + ix] += w * (1 - fx) * fy;
  D[(iy + 1) * GX + ix + 1] += w * fx * fy;
  // Its offspring, each waiting in the queue for its Omori delay. They take the parent's mechanism
  // turned by a few degrees.
  const nKids = min(18, poisson((d.nBr * pow(10, ALPHA * ev.M)) / d.mProd));
  const dist = (0.8 + 0.3 * R) * d.reach;
  for (let i = 0; i < nKids; i++) {
    const kid = {
      t: ev.t + omori(d.omoriC, d.omoriP, d.horizon), M: drawMag(d.mc, MMAX),
      px: b.x, py: b.y, pr: R, pd: dist,
      E: new Float64Array(b.E), beta: b.beta, reg: b.reg,
      dBeta: b.dBeta + 0.08 * gauss(), dReg: b.dReg + 0.05 * gauss(),
    };
    jolt(kid.E, 0.09 * abs(gauss()));
    P.queue.push(kid);
  }
  while (P.queue.length > QMAX) {
    let w = 0;
    for (let i = 1; i < P.queue.length; i++) if (P.queue[i].t > P.queue[w].t) w = i;
    P.queue.splice(w, 1);
  }
}

function background(P, d) {
  const E = new Float64Array(9);
  rod(1, 0, 0, 0, E);
  jolt(E, 0.2 * abs(gauss()) + 0.03);
  spawn(P, {
    t: P.t, M: drawMag(d.mc, MMAX), E,
    beta: P.beta, reg: P.regNow, dBeta: 0.8 * gauss(), dReg: 0.15 * gauss(),
  }, d);
}

// ---- one step of the world -------------------------------------------------
function step(P, dt, k) {
  P.t += dt;
  const t = P.t, ph = P.ph;
  // The regional stress: a maximum-compression azimuth that turns over minutes, and a regime that
  // wanders a little either side of the Regime knob.
  P.beta = ph[0] + 0.7 * sin((TAU * t) / 311 + ph[1]) + 0.45 * sin((TAU * t) / 177 + ph[2]) + 0.0025 * t;
  P.regNow = cl(cl(k[2], -1, 1) + 0.2 * sin((TAU * t) / 241 + ph[3]) + 0.12 * sin((TAU * t) / 127 + ph[4]), -1, 1);
  // Derived values from the knobs.
  const rate = cl(k[1], 0.3, 3), s = (rate - 0.3) / 2.7, sp = cl(k[3], -1, 1);
  const mc = 1.05 * pow(1 - s, 1.4);
  // Episodes: the busy-ness swells and ebbs, and some traces are livelier than others in turn.
  const act = 0.95 + 0.25 * sin((TAU * t) / 97 + ph[5]) + 0.14 * sin((TAU * t) / 53 + ph[6]);
  const lam = (0.1 + 0.95 * pow(rate, 0.9)) * act;
  const nBr = 0.45 + 0.25 * s;
  // A fault zone is not a pure Poisson process on a screen: when the map thins out, the background
  // picks up toward the share of the panel this Rate wants covered, and when it crowds, it lets go.
  const target = 0.14 + 0.14 * pow(s, 0.85);
  const d = {
    mc, nBr, mProd: meanProd(mc),
    mu: lam * (1 - nBr) * cl(exp((4 * (target - P.mass)) / target), 0.2, 10),
    lifeMul: exp(0.65 * sp),
    reach: exp(0.95 * sp),
    omoriC: 0.7 * exp(0.6 * sp),
    omoriP: max(1.03, 1.14 - 0.1 * sp),
    horizon: 140 * exp(0.6 * sp),
    tw: [],
  };
  for (let i = 0; i < TRACES.length; i++) d.tw.push(0.55 + 0.45 * sin((TAU * t) / (83 + 29 * i) + ph[(i + 3) % 10] * 1.7));
  // Quiet-ground decay of the glow.
  const dk = exp(-dt / 110);
  for (let i = 0; i < GX * GY; i++) P.dens[i] *= dk;
  // Background shocks, then the aftershocks whose time has come.
  const nb = poisson(d.mu * dt);
  for (let i = 0; i < nb; i++) background(P, d);
  const q = P.queue;
  for (let i = q.length - 1; i >= 0; i--) {
    if (q[i].t <= t) {
      const ev = q[i];
      q[i] = q[q.length - 1];
      q.pop();
      if (ev.M >= mc - 1e-6) spawn(P, ev, d);
    }
  }
  // The balls: age, follow the stress, tumble a little.
  const balls = P.balls;
  const af = 1 - exp(-dt / 28), rf = 1 - exp(-dt / 4);
  let w = 0, mass = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    b.age = t - b.t0;
    if (b.age >= b.life) continue;
    balls[w++] = b;
    if (!b.dying) {
      const ff = cl((b.age - b.fadeAt) / (b.life - b.fadeAt), 0, 1), br = 1 - (ff * 0.55 + 0.45 * ff * ff * (3 - 2 * ff));
      mass += PI * b.R * b.R * br * br;
    }
    b.beta += (P.beta - b.beta) * af;
    b.reg += (P.regNow - b.reg) * rf;
    rod(b.spin[0], b.spin[1], b.spin[2], b.spinW * dt, SCR);
    mul(SCR, b.E, SCR2);
    for (let j = 0; j < 9; j++) b.E[j] = SCR2[j];
    mechanism(b);
  }
  balls.length = w;
  // Too many: the faintest goes early, over a second.
  let live = 0;
  for (let i = 0; i < balls.length; i++) if (!balls[i].dying) live++;
  P.live = live;
  P.mass = mass / NPX;
  while (live > CAP) {
    let lo = 1e9, at = -1;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.dying) continue;
      const sc = (1 - b.age / b.life) * (0.5 + b.R / 16);
      if (sc < lo) { lo = sc; at = i; }
    }
    const b = balls[at];
    b.dying = true;
    b.fadeAt = b.age;
    b.life = b.age + 1.2;
    live--;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.hue = k[0];
  if (!params.ready) {
    params.ready = true;
    // The panel opens already populated: about two minutes of seismicity at coarse steps.
    for (let i = 0; i < 440; i++) step(params, 0.25, k);
  }
  step(params, min(dt, 0.1), k);
}

// ---- drawing -------------------------------------------------------------
const GP = new Float32Array(45 * 45), GQ = new Float32Array(45 * 45);
const CREAM = [1, 0.93, 0.78];
const C = new Float32Array(12), GH = new Float32Array(6);

function drawBall(buf, b, hue) {
  const age = b.age;
  // The pop: the ball overshoots its size and settles, the flash dies away over 0.6 s.
  let sc = 1, flash = 0;
  if (age < 0.5) {
    const f = age / 0.5, c1 = 1.70158, c3 = c1 + 1;
    sc = 1 + c3 * (f - 1) ** 3 + c1 * (f - 1) ** 2;
  }
  if (age < 0.6) flash = (1 - age / 0.6) ** 2;
  const Re = max(0.8, b.R * sc);
  // How faded the ball is, 1 when new and 0 when gone.
  const ff = cl((age - b.fadeAt) / max(0.01, b.life - b.fadeAt), 0, 1);
  const bright = 1 - (ff * 0.55 + 0.45 * ff * ff * (3 - 2 * ff));
  const aFade = cl(bright * 2.4, 0, 1), lum = (0.62 + 0.38 * bright) * b.vj;
  if (aFade <= 0.003) return;
  // Colours: compressional lobes warm, dilational ones cool, each from a dark to a bright end.
  // An old ball drifts toward a dim mauve and a dim steel blue and not toward a dark orange, which
  // would read as brown.
  const hc = hue + 0.062 + b.hj, hd = hue + 0.53 + b.hj, gh0 = 0.9 * sstep(0.15, 0.95, 1 - bright);
  warmLift(hc, 0.88, 0.66, C, 0);
  warmLift(hc, 0.62, 1.0, C, 3);
  warmLift(hd, 0.94, 0.5, C, 6);
  warmLift(hd, 0.72, 0.95, C, 9);
  hsv(hc - 0.14, 0.45, 0.44, GH, 0);
  hsv(hd, 0.55, 0.36, GH, 3);
  for (let i = 0; i < 12; i++) {
    const gh = GH[i < 6 ? i % 3 : 3 + (i % 3)];
    C[i] = (C[i] + (gh - C[i]) * gh0) * lum;
  }
  const cm = 0.45 + 0.55 * bright;
  const nn = b.n, ss = b.s;
  const cx = b.x, cy = b.y;
  const rad = Re + 2.1;
  const x0 = max(0, floor(cx - rad)), x1 = min(W - 1, ceil(cx + rad));
  const y0 = max(0, floor(cy - rad)), y1 = min(H - 1, ceil(cy + rad));
  if (x1 < x0 || y1 < y0) return;
  const gw = x1 - x0 + 3, gh = y1 - y0 + 3;
  const inv = 1 / Re;
  // P-wave sign terms p = u.n and q = u.s on a grid one LED wider on every side.
  for (let j = 0; j < gh; j++) {
    const ny = -((y0 - 1 + j + 0.5 - cy) * inv);
    for (let i = 0; i < gw; i++) {
      let ex = (x0 - 1 + i + 0.5 - cx) * inv, yy = ny;
      let r2 = ex * ex + yy * yy;
      if (r2 > 1) {
        const kk = 1 / sqrt(r2);
        ex *= kk; yy *= kk; r2 = 1;
      }
      // Equal-area projection: the take-off direction u = (yy c, ex c, 1 - r2) with c = sqrt(2 - r2).
      const c = sqrt(2 - r2), z = 1 - r2, a = yy * c, e = ex * c;
      GP[j * gw + i] = nn[0] * a + nn[1] * e + nn[2] * z;
      GQ[j * gw + i] = ss[0] * a + ss[1] * e + ss[2] * z;
    }
  }
  const rimK = 0.18 + 0.4 * cl((b.R - 4) / 12, 0, 1);
  const lineK = 0.5 + 0.4 * cl((b.R - 4) / 12, 0, 1);
  const hw = 0.5 + 0.045 * b.R;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dist = sqrt(dx * dx + dy * dy);
      const cover = cl(Re + 0.5 - dist, 0, 1);
      const rimW = dist < Re + 0.5 ? (1 - sstep(0.15, 1.35, max(0, Re - dist))) * rimK : 0;
      if (cover <= 0 && rimW <= 0.01) {
        // A dark halo a LED wide round the ball, so a ball over another one reads as its own disc.
        const hd = dist - Re - 0.5;
        if (hd < 1.4) {
          const k = 0.6 * (1 - sstep(0, 1.4, hd)) * aFade, o = (y * W + x) * 3;
          buf[o] *= 1 - k;
          buf[o + 1] *= 1 - k;
          buf[o + 2] *= 1 - k;
        }
        continue;
      }
      const g = (y - y0 + 1) * gw + (x - x0 + 1);
      const p = GP[g], q = GQ[g];
      const gpx = (GP[g + 1] - GP[g - 1]) * 0.5, gpy = (GP[g + gw] - GP[g - gw]) * 0.5;
      const gqx = (GQ[g + 1] - GQ[g - 1]) * 0.5, gqy = (GQ[g + gw] - GQ[g - gw]) * 0.5;
      const gp = sqrt(gpx * gpx + gpy * gpy) + 1e-4, gq = sqrt(gqx * gqx + gqy * gqy) + 1e-4;
      // Sign of (u.n)(u.s), softened by the gradient so the edge is about 2 LEDs wide.
      const wc = 0.5 + 0.5 * softSign(p / (0.9 * gp)) * softSign(q / (0.9 * gq));
      const amp = sqrt(cl(2 * abs(p * q), 0, 1));
      const rho = min(1, dist * inv);
      const core = 1 + 0.4 * (1 - rho) * (1 - rho);
      const cr = C[6] + (C[9] - C[6]) * amp, cg = C[7] + (C[10] - C[7]) * amp, cb = C[8] + (C[11] - C[8]) * amp;
      const wr = C[0] + (C[3] - C[0]) * amp, wg = C[1] + (C[4] - C[1]) * amp, wb = C[2] + (C[5] - C[2]) * amp;
      let r = (cr + (wr - cr) * wc) * core, gr = (cg + (wg - cg) * wc) * core, bl = (cb + (wb - cb) * wc) * core;
      // The nodal planes, pale arcs.
      const dn = min(abs(p) / gp, abs(q) / gq);
      const line = (1 - sstep(hw - 0.5, hw + 0.5, dn)) * lineK;
      r += (CREAM[0] * cm - r) * line; gr += (CREAM[1] * cm - gr) * line; bl += (CREAM[2] * cm - bl) * line;
      // The rim.
      r += (CREAM[0] * cm - r) * rimW; gr += (CREAM[1] * cm - gr) * rimW; bl += (CREAM[2] * cm - bl) * rimW;
      // The flash of a new shock.
      const fl = 0.85 * flash;
      r += (1 - r) * fl; gr += (0.97 - gr) * fl; bl += (0.9 - bl) * fl;
      const al = cover * aFade;
      const o = (y * W + x) * 3;
      buf[o] += (min(1, r) - buf[o]) * al;
      buf[o + 1] += (min(1, gr) - buf[o + 1]) * al;
      buf[o + 2] += (min(1, bl) - buf[o + 2]) * al;
    }
  }
  // The P ring and a slower, fainter S ring, each 2 LEDs thick, fading as they grow.
  if (age < 4.5) {
    const rmax = b.R * 1.8 + 7, dur = 1.6 + 0.045 * b.R * 4;
    ring(buf, cx, cy, rmax * (1 - (1 - cl(age / dur, 0, 1)) ** 2), (1 - cl(age / dur, 0, 1)) ** 1.5 * 0.38, CREAM[0], CREAM[1], CREAM[2]);
    const dur2 = dur * 1.9, f2 = cl(age / dur2, 0, 1);
    ring(buf, cx, cy, rmax * 0.62 * (1 - (1 - f2) ** 2), (1 - f2) ** 1.5 * 0.26, C[9], C[10], C[11]);
  }
}

function ring(buf, cx, cy, r, a, cr, cg, cb) {
  if (a <= 0.01 || r < 1) return;
  const ro = r + 1.6, y0 = max(0, floor(cy - ro)), y1 = min(H - 1, ceil(cy + ro));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    if (abs(dy) > ro) continue;
    const half = sqrt(ro * ro - dy * dy);
    const x0 = max(0, floor(cx - half)), x1 = min(W - 1, ceil(cx + half));
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const d = abs(sqrt(dx * dx + dy * dy) - r);
      if (d >= 1.6) continue;
      const w = (1 - sstep(0.6, 1.6, d)) * a, o = (y * W + x) * 3;
      buf[o] += (cr - buf[o]) * w;
      buf[o + 1] += (cg - buf[o + 1]) * w;
      buf[o + 2] += (cb - buf[o + 2]) * w;
    }
  }
}

export function draw(display, params, time) {
  const buf = params.buf, D = params.dens;
  // Ground: dark blue-black, a faint haze where shocks have lately fallen, the fault traces on top.
  for (let y = 0; y < H; y++) {
    const gy = cl(y / 4 - 0.5, 0, GY - 1.001), iy = floor(gy), fy = gy - iy;
    for (let x = 0; x < W; x++) {
      const gx = cl(x / 4 - 0.5, 0, GX - 1.001), ix = floor(gx), fx = gx - ix;
      const a = iy * GX + ix;
      const dn = (D[a] * (1 - fx) + D[a + 1] * fx) * (1 - fy) + (D[a + GX] * (1 - fx) + D[a + GX + 1] * fx) * fy;
      const hz = dn / (dn + 0.9);
      const o = (y * W + x) * 3, tr = params.trace[y * W + x] * (0.32 + 0.68 * hz);
      buf[o] = 0.012 + 0.015 * hz + 0.05 * tr;
      buf[o + 1] = 0.026 + 0.05 * hz + 0.13 * tr;
      buf[o + 2] = 0.06 + 0.1 * hz + 0.25 * tr;
    }
  }
  const balls = params.balls;
  for (let i = 0; i < balls.length; i++) drawBall(buf, balls[i], params.hue);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o] * 255, buf[o + 1] * 255, buf[o + 2] * 255);
    }
}
