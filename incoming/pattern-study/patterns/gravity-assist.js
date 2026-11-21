// ===== Patternflow pattern =====
// Title:   Gravity Assist
// Family:  swingby
// Idea:    A planet crosses the panel on a slow arc while a curtain of probes pours down past it, half of them aimed at its path, test particles that only the planet pulls on, so the probes that cross behind the planet are swung into its wake and leave faster, as long pale lemon streaks, and the probes that cross in front of it are swung back and leave slower, as short plum ones, with a small second planet passing now and then.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: gravity assist (Michael Minovitch, 1961, JPL), the outer-planet alignment of the Grand Tour (Gary Flandro, mid-1960s), the Mariner 10 swingby of Venus (Giuseppe Colombo's suggestion, launched 1973), Voyager 1 and 2 (launched 1977), a softened point mass (Henry Plummer, 1911), velocity Verlet steps (Loup Verlet, 1967); pattern round 211
// Round:   211
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Mass=0.3..3, Speed=-1..1, Curtain=0..1
//
// Knob 1: Hue. Turns the speed ramp once round the colour wheel from 0 to 1, so 1 looks like 0. At 0 a probe at its launch speed is orange, a slower one runs through crimson to plum, and a faster one runs through amber to pale lemon. The planets stay sky white at every setting.
// Knob 2: Mass. How hard the big planet pulls and how big it is. GM is 1800 times the knob, in LEDs cubed per second squared: 540 at 0.3, 3600 at the opening 2 and 5400 at 3. Its radius is 3.2 LEDs plus half the knob, 3.35, 4.2 and 4.7, and its glow grows with it. At 0.3 nine probes in ten stay within 10 percent of their launch speed and the picture is a bundle that only leans; at 3 one probe in four falls into the planet.
// Knob 3: Speed. How fast the big planet crosses, 14 LEDs a second times 2 to the power of the knob: 7 at -1, 14 at 0 and 28 at 1, and the small planet goes at 0.8 of that. The curtain falls at 22 LEDs a second. A faster planet takes more speed from the probes it crosses in front of: the slowest probe in a hundred runs at 0.76 of launch speed at -1, 0.54 at 0 and 0.37 at 1. The big planet is off the panel for at most 2 s between passes at any setting.
// Knob 4: Curtain. How wide the curtain is, 76 LEDs at 0, wider than the panel, down to 32 LEDs at 1. Half the probes are aimed: each starts where the big planet will be when it gets down to the planet's height, 5 to 21.7 LEDs to one side or the other at 0 and 5 to 13.8 at 1, so the planet always has a bundle to bend. The rest fall across the whole width and show 72 percent of their light until a planet has changed their speed by a fifth. About 57 probes are in flight at the opening 0.06 and 26 at 1, swelling and thinning by almost half over several seconds, and the unaimed half sways 12 LEDs either way.

// How the picture is made. A probe is a test particle: it feels the planets and
// nothing else, not the other probes. Each planet is a softened point mass,
// a = GM d / (|d|^2 + e^2)^1.5 with e = 0.62 of its radius, so a probe that
// grazes the disk is turned and not flung. Steps are 1/60 s of velocity
// Verlet. In the planet's own frame every flyby is elastic and the probe keeps
// its speed. The planet moves, though, so in the picture's frame a probe that
// is pulled along the planet's motion gains speed and one pulled against it
// loses speed. That puts the winners behind the planet and the losers in front
// of it, which is what the colours show. Checked on a straight pass at the
// opening settings (GM 3600, planet at 14 LEDs a second), a probe that passes
// 6.6 LEDs behind the planet leaves at 1.45 times its launch speed and one
// that passes 6.6 in front leaves at 0.52 times.
// Left to fall evenly the probes read as rain with a few bent strands, so the
// planet gets a bundle of its own. The big planet's arc is followed forward
// to the time a probe launched now reaches its height, and half the probes
// start there, spread on both sides of its path but not within 5 LEDs of it.
// The planet is on the panel from the first frame: the pre-run puts it 12 LEDs
// in and moving right when the Lab opens, so it stands in the middle 2 s later.
// A probe that reaches the disk is taken in: it rides on the planet while its
// tail runs out. A probe nearly stopped fades out where it is.

const W = 64, H = 128;
const { floor, sqrt, exp, pow, abs, sin, cos, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);

const V0 = 22; // the speed every probe is born with, LEDs a second, straight down
const STEP = 1 / 60; // physics step, s
const MAXP = 130; // probe slots
const NT = 20; // tail samples a probe keeps
const HS = 2 * STEP; // seconds between tail samples
const TAILT = NT * HS; // seconds of tail
const GM0 = 1800; // GM per unit of the Mass knob
const PRE = 7; // seconds run before the first frame
const SLOW = 0.28 * V0; // below this speed a probe fades out
const FADE = 0.7; // seconds that takes
const PHI = 0.6180339887498949;
const FOCUS = 0.5; // share of the probes that are aimed at the big planet
const BGDIM = 0.72; // light of an unaimed probe the planet has not touched
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// ---- the colour ramp: speed ratio -> LUT index, rebuilt when Hue moves
const LN = 128;
const RAMP = [
  // t, hue in turns, saturation, value
  [0.0, 0.8, 0.9, 0.5],
  [0.2, 0.93, 0.92, 0.7],
  [0.4, 1.08, 0.97, 0.9], // orange, a probe at its launch speed
  [0.7, 1.14, 0.78, 1.0],
  [1.0, 1.16, 0.2, 1.0], // pale lemon
];
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function buildLut(S, hue) {
  const o = [0, 0, 0];
  for (let i = 0; i < LN; i++) {
    const t = i / (LN - 1);
    let k = 0;
    while (k < RAMP.length - 2 && t > RAMP[k + 1][0]) k++;
    const a = RAMP[k], b = RAMP[k + 1], u = (t - a[0]) / (b[0] - a[0]);
    hsv(a[1] + (b[1] - a[1]) * u + hue, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u, o, 0);
    S.lut[i * 3] = o[0] * 255;
    S.lut[i * 3 + 1] = o[1] * 255;
    S.lut[i * 3 + 2] = o[2] * 255;
  }
  S.lutHue = hue;
}
// A speed, as LEDs a second, to a place in the LUT: slower than launch runs
// plum to orange over 0.75..1 of the launch speed, faster runs orange to lemon
// over 1..1.4.
const lutAt = (sp) => {
  const r = sp / V0;
  const t = r <= 1 ? 0.4 * cl((r - 0.75) / 0.25, 0, 1) : 0.4 + 0.6 * cl((r - 1) / 0.4, 0, 1);
  return (t * (LN - 1) + 0.5) | 0;
};

// ---- planets
// Each planet makes passes: it comes in at a side edge, bends gently along a
// far-off circle, and leaves by whichever edge it reaches, then waits. Every
// pass takes its height, tilt, bend and wait from golden-ratio fractions of
// its own count, so no two passes are alike and none repeats.
function makeBody(big, o) {
  return { big, o, k: 0, run: false, seen: true, wait: 0, x: -99, y: 0, hd: 0, kap: 0, side: 1, R: 4, gm: 0 };
}
function startPass(B, first) {
  const k = B.k++, o = B.o, big = B.big;
  B.side = first ? 1 : fr(k * 0.7548776662 + o) < 0.5 ? 1 : -1;
  B.y = first ? 58 : big ? 48 + 32 * fr(k * PHI + o * 3) : 30 + 68 * fr(k * PHI + o * 3);
  const tilt = first ? -0.05 : (fr(k * 0.5698402909 + o * 5) - 0.5) * (big ? 0.4 : 0.6);
  const bend = (fr(k * 0.4142135624 + o * 7) < 0.5 ? -1 : 1) / ((big ? 400 : 180) + (big ? 300 : 200) * fr(k * 0.3247179572 + o * 2));
  B.hd = B.side > 0 ? tilt : PI - tilt;
  B.kap = first ? 1 / 450 : bend * B.side;
  B.x = B.side > 0 ? -B.R - 2 : W + B.R + 2;
  B.seen = true;
  B.run = true;
}
function moveBody(S, B, h) {
  if (!B.run) {
    B.wait -= h;
    if (B.wait <= 0) startPass(B, false);
    return;
  }
  const v = S.vp * (B.big ? 1 : 0.8);
  B.x += cos(B.hd) * v * h;
  B.y += sin(B.hd) * v * h;
  B.hd += B.kap * v * h;
  const m = B.R + 3;
  if (B.x > -m && B.x < W + m) B.seen = true;
  if (B.seen && (B.x < -m - 1 || B.x > W + m + 1 || B.y < -m || B.y > H + m)) {
    B.run = false;
    B.wait = B.big ? 0.1 + 0.9 * fr(B.k * 0.3247179572 + 0.4) : 10 + 16 * fr(B.k * 0.7548776662 + 0.2);
  }
}

// ---- probes
// Where along the top a probe has to start to come down on the big planet:
// its arc is followed forward to the moment a probe launched now would reach
// the planet's height, 22 LEDs a second and a little under 3 s away.
function aim(S) {
  const B = S.bodies[0];
  if (!B.run) return S.cx;
  let x = B.x, y = B.y;
  for (let n = 0; n < 2; n++) {
    const d = (S.vp * (y + 5)) / V0;
    x = B.x + (sin(B.hd + B.kap * d) - sin(B.hd)) / B.kap;
    y = B.y - (cos(B.hd + B.kap * d) - cos(B.hd)) / B.kap;
  }
  return cl(x, 10, 54);
}

function spawn(S, focus) {
  let i = 0;
  while (i < MAXP && S.st[i]) i++;
  if (i === MAXP) return;
  const k = S.births++;
  const u = fr(k * PHI + 0.31);
  const jit = 3 * (fr(k * 0.4142135624) - 0.5);
  if (focus) {
    // impact parameters b spread evenly on both sides of the planet's path,
    // none inside 5 LEDs of it, where a probe would only fall in
    const side = fr(k * 0.7548776662 + 0.2) < 0.5 ? -1 : 1;
    S.x[i] = aim(S) + side * (5 + u * (0.18 * S.width + 3)) + 0.5 * jit;
  } else S.x[i] = S.cx + (u - 0.5) * S.width + jit;
  S.bg[i] = focus ? 0 : 1;
  S.y[i] = -5;
  S.vx[i] = 0;
  S.vy[i] = V0;
  S.ax[i] = 0;
  S.ay[i] = 0;
  S.st[i] = 1;
  S.inn[i] = 0;
  S.age[i] = 0;
  S.hn[i] = 0;
  S.hh[i] = 0;
  S.hacc[i] = 0;
  S.tm[i] = 0;
  S.att[i] = -1;
}

function accel(S, x, y, out) {
  let ax = 0, ay = 0;
  for (const B of S.bodies) {
    if (!B.run) continue;
    const dx = B.x - x, dy = B.y - y;
    const e = 0.62 * B.R, r2 = dx * dx + dy * dy + e * e;
    const g = B.gm / (r2 * sqrt(r2));
    ax += dx * g;
    ay += dy * g;
  }
  out[0] = ax;
  out[1] = ay;
}

function step(S, h) {
  S.clock += h;
  for (const B of S.bodies) moveBody(S, B, h);
  // The curtain sways and thickens and thins on periods that share no factor.
  const t = S.clock;
  S.cx = 32 + 12 * sin(0.37 * t + 1.1 * sin(0.113 * t));
  const rate = (0.13 * S.width + 1.5) * (1 + 0.45 * sin(0.71 * t) * sin(0.263 * t + 0.8));
  S.sp -= h;
  if (S.sp <= 0) {
    spawn(S, false);
    S.sp += (1 / (rate * (1 - FOCUS))) * (0.7 + 0.6 * fr(S.births * 0.7548776662));
  }
  S.sf -= h;
  if (S.sf <= 0) {
    spawn(S, true);
    S.sf += (1 / (rate * FOCUS)) * (0.7 + 0.6 * fr(S.births * 0.5698402909));
  }
  const a = S.acc;
  for (let i = 0; i < MAXP; i++) {
    const st = S.st[i];
    if (!st) continue;
    if (st === 2 && S.att[i] >= 0) {
      // absorbed: rides on the planet while its tail runs out
      const B = S.bodies[S.att[i]];
      S.x[i] = B.x + S.ox[i];
      S.y[i] = B.y + S.oy[i];
    } else {
      const x = S.x[i] + S.vx[i] * h + 0.5 * S.ax[i] * h * h;
      const y = S.y[i] + S.vy[i] * h + 0.5 * S.ay[i] * h * h;
      accel(S, x, y, a);
      S.vx[i] += 0.5 * (S.ax[i] + a[0]) * h;
      S.vy[i] += 0.5 * (S.ay[i] + a[1]) * h;
      S.ax[i] = a[0];
      S.ay[i] = a[1];
      S.x[i] = x;
      S.y[i] = y;
    }
    S.age[i] += h;
    if (st === 1) {
      const x = S.x[i], y = S.y[i];
      if (S.vx[i] * S.vx[i] + S.vy[i] * S.vy[i] < SLOW * SLOW) {
        // nearly stopped by a planet: let it fade out where it is
        S.st[i] = 3;
        S.tm[i] = FADE;
      }
      let hit = -1;
      for (let j = 0; j < S.bodies.length; j++) {
        const B = S.bodies[j];
        if (!B.run) continue;
        const dx = x - B.x, dy = y - B.y, r = 0.85 * B.R;
        if (dx * dx + dy * dy < r * r) hit = j;
      }
      const inside = x > -2 && x < W + 2 && y > -2 && y < H + 2;
      if (S.st[i] === 3) {
        // already fading
      } else if (hit >= 0) {
        S.st[i] = 2;
        S.att[i] = hit;
        S.ox[i] = x - S.bodies[hit].x;
        S.oy[i] = y - S.bodies[hit].y;
        S.tm[i] = TAILT + 0.1;
      } else if (inside) S.inn[i] = 1;
      else if (S.inn[i] || S.age[i] > 30) {
        S.st[i] = 2;
        S.tm[i] = TAILT + 0.1;
      }
    } else {
      S.tm[i] -= h;
      if (S.tm[i] <= 0) {
        S.st[i] = 0;
        continue;
      }
    }
    S.hacc[i] += h;
    if (S.hacc[i] >= HS - 1e-9) {
      S.hacc[i] -= HS;
      const c = i * NT + (S.hh[i] % NT);
      S.hx[c] = S.x[i];
      S.hy[c] = S.y[i];
      S.hs[c] = sqrt(S.vx[i] * S.vx[i] + S.vy[i] * S.vy[i]);
      S.hh[i]++;
      if (S.hn[i] < NT) S.hn[i]++;
    }
  }
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  params.s = {
    x: f(MAXP), y: f(MAXP), vx: f(MAXP), vy: f(MAXP), ax: f(MAXP), ay: f(MAXP), ox: f(MAXP), oy: f(MAXP),
    age: f(MAXP), tm: f(MAXP), hacc: f(MAXP),
    st: new Uint8Array(MAXP), bg: new Uint8Array(MAXP), inn: new Uint8Array(MAXP), hn: new Uint8Array(MAXP), hh: new Uint32Array(MAXP),
    att: new Int8Array(MAXP),
    hx: f(MAXP * NT), hy: f(MAXP * NT), hs: f(MAXP * NT),
    lut: f(LN * 3), lutHue: -1,
    bodies: [makeBody(true, 0.13), makeBody(false, 0.57)],
    acc: [0, 0], births: 0, sp: 0, sf: 0, rem: 0, clock: 0, cx: 32,
    width: 76, vp: 14, hue: 0, mass: 2, ready: false,
    buf: new Float32Array(W * H * 3),
  };
  buildLut(params.s, 0);
}

function knobs(S, kn) {
  S.hue = cl(kn[0], 0, 1);
  S.mass = cl(kn[1], 0.3, 3);
  S.vp = 14 * pow(2, cl(kn[2], -1, 1));
  S.width = 76 - 44 * cl(kn[3], 0, 1);
  const a = S.bodies[0], b = S.bodies[1];
  a.R = 3.2 + 0.5 * S.mass;
  a.gm = GM0 * S.mass;
  b.R = 2.4 + 0.1 * S.mass;
  b.gm = 0.3 * GM0 * S.mass;
  if (S.hue !== S.lutHue) buildLut(S, S.hue);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  knobs(S, kn);
  if (!S.ready) {
    // The first pass is already under way: the planet starts far enough
    // left to be 12 LEDs in when the pre-run ends, so it stands in the middle
    // two seconds later, with the probes aimed at it bending on their way down.
    S.ready = true;
    const a = S.bodies[0], b = S.bodies[1];
    b.wait = 16;
    startPass(a, true);
    // run the arc backward from where it should be at the end of the pre-run
    const d = S.vp * PRE, he = -0.05, h0 = he - a.kap * d;
    a.hd = h0;
    a.x = 12 - (sin(he) - sin(h0)) / a.kap;
    a.y = 60 + (cos(he) - cos(h0)) / a.kap;
    a.seen = false;
    for (let t = 0; t < PRE; t += STEP) step(S, STEP);
    return;
  }
  S.rem += cl(dt || 0, 0, 0.1);
  while (S.rem >= STEP) {
    step(S, STEP);
    S.rem -= STEP;
  }
}

// How much of its light an unaimed probe shows: little while it keeps its
// launch speed, all of it once a planet has changed that by a fifth.
const bgw = (sp) => BGDIM + (1 - BGDIM) * cl(abs(sp / V0 - 1) / 0.2, 0, 1);

// Draw one capsule of a tail into the float buffer, keeping the brighter of
// what is there and what the capsule adds, so joints between segments do not
// show as beads.
function capsule(buf, ax, ay, bx, by, c0, c1, w0, w1, lut) {
  const R = 1.0;
  const x0 = max(0, floor(min(ax, bx) - R - 0.5)), x1 = min(W - 1, floor(max(ax, bx) + R + 0.5));
  const y0 = max(0, floor(min(ay, by) - R - 0.5)), y1 = min(H - 1, floor(max(ay, by) + R + 0.5));
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      const u = cl((px * dx + py * dy) / l2, 0, 1);
      const ex = px - u * dx, ey = py - u * dy;
      const cov = R + 0.5 - sqrt(ex * ex + ey * ey);
      if (cov <= 0) continue;
      const wt = w0 + (w1 - w0) * u, k = (cov > 1 ? 1 : cov) * wt;
      const ci = (c0 + (c1 - c0) * u + 0.5) | 0, o = (y * W + x) * 3;
      // the tail cools toward amber as it fades
      const r = lut[ci * 3] * k, g = lut[ci * 3 + 1] * k * (0.92 + 0.08 * wt), b = lut[ci * 3 + 2] * k * (0.72 + 0.28 * wt);
      if (r > buf[o]) buf[o] = r;
      if (g > buf[o + 1]) buf[o + 1] = g;
      if (b > buf[o + 2]) buf[o + 2] = b;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, lut = S.lut;
  // ink: the darkest plum of the ramp turned down to a violet black, a little
  // lighter at the top, so it turns round the wheel with Hue
  for (let y = 0; y < H; y++) {
    const k = 1 - 0.4 * (y / H);
    const r = 0.09 * lut[0] * k, g = (0.09 * lut[1] + 2) * k, b = (0.09 * lut[2] + 3) * k;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  // the well: a cold glow and a few faint contour rings around each planet
  for (const B of S.bodies) {
    if (!B.run) continue;
    const R = B.R, RG = R + 22;
    const x0 = max(0, floor(B.x - RG)), x1 = min(W - 1, floor(B.x + RG));
    const y0 = max(0, floor(B.y - RG)), y1 = min(H - 1, floor(B.y + RG));
    // the glow comes up as the planet comes in over an edge
    const pres = sm((min(B.x, W - B.x, B.y, H - B.y) + R + 2) / (R + 12));
    const big = (B.big ? 1 : 0.6) * (0.4 + 0.6 * (S.mass / 3)) * pres;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - B.x, dy = y + 0.5 - B.y, d = sqrt(dx * dx + dy * dy);
        if (d > RG) continue;
        let g = d < R ? 1 : exp(-(d - R) / 5);
        // rings at R + 5, 10 and 16
        const rr = min(abs(d - R - 5), abs(d - R - 10.5), abs(d - R - 17));
        g = g * 0.5 + 0.5 * exp(-(rr * rr) / 0.7) * (1 - (d - R) / 22) * (d > R ? 1 : 0);
        const o = (y * W + x) * 3;
        buf[o] += 40 * big * g;
        buf[o + 1] += 40 * big * g;
        buf[o + 2] += 96 * big * g;
      }
    }
  }
  // probes, oldest and dimmest first does not matter: the brighter wins
  for (let i = 0; i < MAXP; i++) {
    if (!S.st[i]) continue;
    const n = S.hn[i];
    let px = S.x[i], py = S.y[i];
    const sp0 = sqrt(S.vx[i] * S.vx[i] + S.vy[i] * S.vy[i]), dim = S.bg[i];
    let pc = lutAt(sp0);
    const fd = S.st[i] === 3 ? S.tm[i] / FADE : 1;
    let pw = fd * (dim ? bgw(sp0) : 1);
    for (let j = 0; j < n; j++) {
      const c = i * NT + ((S.hh[i] - 1 - j + NT * 4) % NT);
      const cx = S.hx[c], cy = S.hy[c], cc = lutAt(S.hs[c]);
      const cw = pow(1 - (j + 1) / (NT + 1), 1.1) * fd * (dim ? bgw(S.hs[c]) : 1);
      capsule(buf, px, py, cx, cy, pc, cc, pw, cw, lut);
      px = cx;
      py = cy;
      pc = cc;
      pw = cw;
    }
  }
  // the planets
  for (const B of S.bodies) {
    if (!B.run) continue;
    const R = B.R;
    const x0 = max(0, floor(B.x - R - 2)), x1 = min(W - 1, floor(B.x + R + 2));
    const y0 = max(0, floor(B.y - R - 2)), y1 = min(H - 1, floor(B.y + R + 2));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - B.x, dy = y + 0.5 - B.y, d = sqrt(dx * dx + dy * dy);
        const cov = cl(R + 0.5 - d, 0, 1);
        if (cov <= 0) continue;
        const nx = dx / R, ny = dy / R, nz = sqrt(max(0, 1 - nx * nx - ny * ny));
        const lit = cl(-0.5 * nx - 0.55 * ny + 0.67 * nz, 0, 1);
        const k = 0.72 + 0.28 * lit;
        const o = (y * W + x) * 3;
        buf[o] += (222 * k - buf[o]) * cov;
        buf[o + 1] += (238 * k - buf[o + 1]) * cov;
        buf[o + 2] += (255 * k - buf[o + 2]) * cov;
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o], buf[o + 1], buf[o + 2]);
    }
}
