// ===== Patternflow pattern =====
// Title:   Fork Hologram
// Family:  wave
// Idea:    The tall panel is the fork grating you record when a beam with phase singularities meets a tilted plane wave, fine near-vertical fringes that split into l + 1 tines wherever a vortex of charge l sits, and some ten vortices of charge 1 to 7 and both signs drift over it, pull their opposites in, annihilate or leave the difference, and are born again in pairs, so forks open, merge and vanish, the crowded side of each fork tinted blue and the thinned side green.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: fork grating, the interferogram of a beam with a screw dislocation of charge l and a tilted plane wave (V. Yu. Bazhenov, M. V. Vasnetsov and M. S. Soskin, Laser beams with screw dislocations in their wavefronts, 1990), made as a binary computer-generated hologram (N. R. Heckenberg, R. McDuff, C. P. Smith and A. G. White, 1992); wave dislocations (John Nye and Michael Berry, 1974); pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Charge=3..7, Carrier=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the plain grating is pale aqua, the side of a fork where the extra fringes crowd in is blue and the side where they thin out is green; at 0.3 the grating is lilac with red and blue.
// Knob 2: Speed. At 2 the vortices drift 0.5 to 4 LEDs a second, faster as an opposite closes in, new pairs are born one every 0.6 to 1.8 s while fewer than ten vortices are left, and the fringes slide sideways 0.12 of a period a second; every time goes as 2 / Speed.
// Knob 3: Charge. The highest charge a new pair carries: half the pairs carry it and the rest 1 up to it, so at the opening 3 the forks have 2, 3 or 4 tines and at 7 up to 8. A vortex of charge 2 or more sheds a unit vortex of its own sign, a charge 2 about every 12 s and a charge 3 every 6 s.
// Knob 4: Carrier. The fringe period, 3.3 LEDs at the opening 0.06, 19 fringes across the panel, doubling by 0.68 and 9.4 LEDs at 1, where every tine of a fork stands apart. The fringes always lean 14 degrees.

// A beam whose phase winds by 2 pi l round a point, l times atan2 about it,
// meets a plane wave tilted by a carrier k. Where they add, the intensity
// follows the phase difference
//
//   phi = 2 pi (k . r) + sum over vortices of l_j atan2(y - y_j, x - x_j),
//
// and the fringes are its level lines. Round a vortex phi gains 2 pi l, so
// l more fringes cross a circle on one side of it than on the other: the
// fork. The phases are multiplied as unit complex numbers and one atan2
// per LED gives phi, so 10 vortices cost no more than one. The phase
// gradient comes alongside in closed form: where it is longer than the
// carrier the fringes crowd (blue at the opening), where shorter they thin
// (green). At each core the beam is dark, so the fringes fade to the mean
// within about sqrt(0.7 l) LEDs.
//
// Each fringe is drawn the way Heckenberg's binary holograms were cut, a
// hard step from dark to bright, with the grey interferogram left in at
// 35%: a triangle wave of phi runs 0 to 0.17 across a dark fringe and 0.83
// to 1 across a bright one. The step keeps the fringes sharp; the ramp
// keeps every LED a little different from the LED above it.
//
// The vortices move overdamped: opposite charges pull together and like
// charges push apart, as 1 / r, with a slow random heading each. Opposite
// charges that meet add up, equal ones annihilate and unequal ones leave
// the difference. Total charge stays 0, since pairs are born as +l and -l.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, atan2, exp, pow, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Pairs kept on the panel, the margin past every edge the vortices may
// wander into, the carrier's tilt as ky / k, the grey share of a fringe,
// the period in LEDs at Carrier 0, the dark core's size per unit of charge.
const PAIRS = 5, MARGIN = 6, SLANT = 0.25, RAMP = 0.35, P0 = 3.09, CORE = 0.7;

function vortex(x, y, l, vx, vy) {
  return { x, y, l, vx, vy, wx: 0, wy: 0, kick: 1, age: 0 };
}

function charge(top) {
  // Half the pairs carry the top charge, the rest anything from 1 up.
  return Math.random() < 0.5 ? top : 1 + floor(Math.random() * top);
}

function birth(S, x, y, top) {
  const l = charge(top), a = Math.random() * TAU, v = 7;
  S.v.push(vortex(x + cos(a) * 0.4, y + sin(a) * 0.4, l, cos(a) * v, sin(a) * v));
  S.v.push(vortex(x - cos(a) * 0.4, y - sin(a) * 0.4, -l, -cos(a) * v, -sin(a) * v));
}

function seed(S, top) {
  S.v = [];
  for (let i = 0; i < PAIRS; i++) {
    const l = charge(top);
    S.v.push(vortex(6 + Math.random() * 52, 6 + Math.random() * 116, l, 0, 0));
    S.v.push(vortex(6 + Math.random() * 52, 6 + Math.random() * 116, -l, 0, 0));
  }
  for (const p of S.v) p.kick = 0;
}

export function setup(params) {
  params.s = { v: null, t: 0, hue: 0, top: 3, f: 0.31, wait: 0, slide: 0 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.top = round(cl(k[2] == null ? 3 : k[2], 3, 7));
  S.f = 1 / (P0 * pow(2, 1.6 * cl(k[3] == null ? 0.06 : k[3], 0, 1)));
  if (!S.v) seed(S, S.top);
  const h = (d * speed) / 2;
  S.t += h;
  S.slide += h * 0.12;
  const V = S.v;
  // Overdamped motion: opposite charges pull together, like charges push
  // apart, both as 1/r, and every vortex wanders on a slow random heading.
  for (const p of V) {
    let fx = 0, fy = 0;
    for (const q of V) {
      if (q === p) continue;
      const dx = p.x - q.x, dy = p.y - q.y, r2 = dx * dx + dy * dy + 4;
      const s = Math.sign(p.l * q.l) * sqrt(abs(p.l * q.l));
      fx += (s * dx) / r2;
      fy += (s * dy) / r2;
    }
    p.wx += (Math.random() - 0.5) * 6 * h - p.wx * 0.4 * h;
    p.wy += (Math.random() - 0.5) * 6 * h - p.wy * 0.4 * h;
    p.kick *= exp(-h * 1.6);
    const ux = 9 * fx + p.wx + p.vx * p.kick, uy = 9 * fy + p.wy + p.vy * p.kick;
    const sp = sqrt(ux * ux + uy * uy), cap = 9 / max(9, sp);
    p.x += ux * cap * h;
    p.y += uy * cap * h;
    if (p.x < -MARGIN) { p.x = -MARGIN; p.wx = abs(p.wx); }
    if (p.x > W + MARGIN) { p.x = W + MARGIN; p.wx = -abs(p.wx); }
    if (p.y < -MARGIN) { p.y = -MARGIN; p.wy = abs(p.wy); }
    if (p.y > H + MARGIN) { p.y = H + MARGIN; p.wy = -abs(p.wy); }
    p.age += h;
  }
  // Opposite charges that meet add up: equal ones annihilate, unequal ones
  // leave one vortex with the difference.
  for (let i = 0; i < V.length; i++)
    for (let j = i + 1; j < V.length; j++) {
      const a = V[i], b = V[j];
      if (a.l * b.l >= 0) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy > 1.2) continue;
      const l = a.l + b.l;
      if (l === 0) {
        V.splice(j, 1);
        V.splice(i, 1);
      } else {
        const keep = abs(a.l) > abs(b.l) ? a : b;
        keep.l = l;
        V.splice(keep === a ? j : i, 1);
      }
      i = -1;
      break;
    }
  // A vortex of charge 2 or more is unstable and now and then sheds a unit one.
  for (let i = V.length - 1; i >= 0; i--) {
    const p = V[i];
    if (abs(p.l) > 1 && p.age > 2 && Math.random() < h * 0.08 * (abs(p.l) - 1)) {
      const s = Math.sign(p.l), a = Math.random() * TAU;
      p.l -= s;
      p.age = 0;
      const q = vortex(p.x, p.y, s, cos(a) * 6, sin(a) * 6);
      p.vx = -cos(a) * 6 / abs(p.l);
      p.vy = -sin(a) * 6 / abs(p.l);
      p.kick = 1;
      V.push(q);
    }
  }
  // New pairs are born out of nothing, a pair at a time.
  S.wait -= h;
  if (V.length < 2 * PAIRS && S.wait <= 0) {
    birth(S, 8 + Math.random() * 48, 10 + Math.random() * 108, S.top);
    S.wait = 0.6 + Math.random() * 1.2;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.v) return;
  const V = S.v, n = V.length, f = S.f;
  const ky = SLANT * f, kx = sqrt(f * f - ky * ky);
  const px = new Float64Array(n), py = new Float64Array(n), pl = new Int8Array(n);
  for (let j = 0; j < n; j++) {
    px[j] = V[j].x;
    py[j] = V[j].y;
    pl[j] = V[j].l;
  }
  const base = S.hue + 0.5, shift = S.slide;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The vortex phases multiplied as unit complex numbers, one atan2 at the end;
      // the phase gradient in cycles per LED alongside, for the colour.
      let re = 1, im = 0, gx = kx, gy = ky, c = 1;
      for (let j = 0; j < n; j++) {
        const l = pl[j], dx = x - px[j], dy = y - py[j], r2 = dx * dx + dy * dy + 1e-6, ir = 1 / sqrt(r2);
        const ux = dx * ir, uy = (l > 0 ? dy : -dy) * ir;
        for (let m = l > 0 ? l : -l; m > 0; m--) {
          const t = re * ux - im * uy;
          im = re * uy + im * ux;
          re = t;
        }
        const w = l / (TAU * r2);
        gx -= dy * w;
        gy += dx * w;
        c *= r2 / (r2 + CORE * (l > 0 ? l : -l));
      }
      let u = kx * x + ky * y + shift + atan2(im, re) / TAU;
      u -= floor(u);
      const tri = 1 - abs(2 * u - 1);
      const v = 0.5 + (RAMP * tri + (tri > 0.5 ? 1 - RAMP : 0) - 0.5) * c;
      // Hue and saturation from how crowded the fringes are against the carrier.
      const g = sqrt(gx * gx + gy * gy) / f - 1, ag = min(1, 4 * abs(g));
      let h = base + (g > 0 ? 0.17 : -0.13) * ag;
      const s = (0.3 + 0.5 * ag) * c;
      h = (h - floor(h)) * 6;
      const i = floor(h), q = h - i, lo = v * (1 - s), dn = v * (1 - s * q), up = v * (1 - s * (1 - q));
      let r, gg, b;
      if (i === 0) { r = v; gg = up; b = lo; }
      else if (i === 1) { r = dn; gg = v; b = lo; }
      else if (i === 2) { r = lo; gg = v; b = up; }
      else if (i === 3) { r = lo; gg = dn; b = v; }
      else if (i === 4) { r = up; gg = lo; b = v; }
      else { r = v; gg = lo; b = dn; }
      display.setPixel(x, y, round(r * 255), round(gg * 255), round(b * 255));
    }
  }
}
