// ===== Patternflow pattern =====
// Title:   Peregrine Soliton
// Family:  wave
// Idea:    A regular train of sea waves runs under a dark sky with the modulus of a breather of the focusing nonlinear Schrödinger equation as its envelope, so one crest rises out of nowhere to three times the swell between two calm holes and sinks again, while the envelope's space-time record scrolls up above the sea.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Peregrine soliton (Howell Peregrine, 1983)
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Family=-1..1, Swell=0..1
//
// Knob 1: Hue. Turns the sea and the record from teal at 0 through blue (0.25), indigo (0.5) and purple (0.75) to rose at 1; the foam stays white.
// Knob 2: Speed. At 2 the equation's clock runs 0.77 units a second at the opening swell: the Peregrine crest stands above twice the swell for 1.7 s and the next breather comes 9 s later. The crests run 14 LEDs a second and the envelope 7, the group speed of deep water. At 0.2 all of it is ten times slower, at 3 half as fast again.
// Knob 3: Family. Which breather of the one-parameter family. At 0 the Peregrine soliton (a = 1/2): one crest three times the swell, once, one to three crests further on each time. Below 0 Akhmediev breathers, periodic along the sea, down to a = 0.2 at -1: a row of crests 30 LEDs apart rising together to 2.26 times the swell. Above 0 Kuznetsov-Ma breathers, periodic in time, up to a = 0.9 at 1: one crest that pulses to 3.68 times the swell every 2.6 units (3.4 s) for ever.
// Knob 4: Swell. The background amplitude A, 0.75 at 0 to 1.35 at 1, 0.79 at 0.06: a swell 12.6 LEDs high and a rogue of 38 standing 12.6 LEDs wide between its holes. The equation's scaling A psi(Ax, A^2 t) keeps the rogue three times the swell at every A, but makes it 1/A as wide and 1/A^2 as quick: at 1 the swell is 22 LEDs, the rogue 65 LEDs high and 7 wide, and a breather comes every 3 s.

const W = 64, H = 128, REC = 40, MEAN = 96, VS = 16, LAM = 16;
const { floor, round, min, max, abs, sqrt, cos, sin, cosh, sinh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => v * v * (3 - 2 * v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [round(r * 63) * 4, round(g * 63) * 4, round(b * 63) * 4];
}

// The breather family of i psi_t + psi_xx / 2 + |psi|^2 psi = 0 on the
// background e^{it}, written as psi = phi(x, t) e^{it}. For a < 1/2 the
// Akhmediev breather, for a > 1/2 the Kuznetsov-Ma breather (b and w turn
// imaginary, cos and cosh trade places), at a = 1/2 the Peregrine soliton.
// out gets [Re phi, Im phi].
export function breather(a, x, t, out) {
  if (abs(a - 0.5) < 1e-9) {
    const D = 1 + 4 * x * x + 4 * t * t;
    out[0] = 1 - 4 / D;
    out[1] = (-8 * t) / D;
    return out;
  }
  const s = sqrt(2 * a);
  if (a < 0.5) {
    const b = sqrt(8 * a * (1 - 2 * a)), w = 2 * sqrt(1 - 2 * a);
    const ch = cosh(b * t), c = cos(w * x), den = s * c - ch;
    out[0] = ((1 - 4 * a) * ch + s * c) / den;
    out[1] = (b * sinh(b * t)) / den;
    return out;
  }
  const b = sqrt(8 * a * (2 * a - 1)), w = 2 * sqrt(2 * a - 1);
  const ch = cosh(min(30, w * abs(x))), c = cos(b * t), den = s * ch - c;
  out[0] = ((1 - 4 * a) * c + s * ch) / den;
  out[1] = (-b * sin(b * t)) / den;
  return out;
}
const tmp = [0, 0];
const amp = (a, x, t) => {
  breather(a, x, t, tmp);
  return sqrt(tmp[0] * tmp[0] + tmp[1] * tmp[1]);
};

// Half a cycle of the equation's clock. Peregrine and Akhmediev breathers
// rise once out of the background, so the clock runs -3.5..3.5 and starts
// again with the next one; a Kuznetsov-Ma breather is periodic, and the
// clock runs one whole period when that is not too long. |psi| is even in t,
// so the end of a cycle and the start of the next one agree.
function halfCycle(a) {
  if (a <= 0.5) return 3.5;
  const T = PI / sqrt(8 * a * (2 * a - 1));
  return T <= 6 ? T : 3.5;
}
const knobA = (k) => (abs(k) < 0.02 ? 0.5 : 0.5 + (k < 0 ? 0.3 : 0.4) * k);

export function setup(params) {
  params.s = {
    hue: 0, a: 0.5, A: 0.8, t: -3.4, xu: 14 + 10 * Math.random(), started: false, kap: 1.8,
    rec: new Uint8Array(REC * W), head: 0, acc: 0, env: new Float32Array(W), spray: [],
  };
}

// The envelope |psi| along the sea, unscaled (the background is 1), with
// the breather's middle at column xu. A localised breather wraps round the
// 64 columns; an Akhmediev breather is periodic in x and needs no wrap.
function envelope(P, xu, t) {
  const k = P.A * 0.175;
  for (let x = 0; x < W; x++) {
    let dx = x + 0.5 - xu;
    if (P.a >= 0.5) dx -= 64 * floor(dx / 64 + 0.5);
    P.env[x] = amp(P.a, k * dx, t);
  }
}

// One row of the record: the envelope in nine levels, black where it
// falls under half the swell, the background 0.9..1.1.
const LEVELS = [0.5, 0.7, 0.9, 1.1, 1.35, 1.7, 2.1, 2.5];
function pushRow(P) {
  P.head = (P.head + 1) % REC;
  const o = P.head * W;
  for (let x = 0; x < W; x++) {
    const e = P.env[x];
    let l = 0;
    while (l < 8 && e >= LEVELS[l]) l++;
    P.rec[o + x] = l;
  }
}

// The carrier: crests at theta = 0 (mod 2 pi), sharp crests and flat
// troughs, 1 at a crest and -0.5 in a trough.
const theta = (P, x) => (2 * PI * (x + 0.5 - P.xu)) / LAM - P.kap * P.t;
const shape = (th) => 1.5 * ((1 + cos(th)) / 2) ** 1.2 - 0.5;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const speed = cl(k[1], 0.2, 3);
  P.hue = k[0];
  P.a = knobA(cl(k[2], -1, 1));
  P.A = 0.75 + 0.6 * cl(k[3], 0, 1);
  const d = cl(dt || 0, 0, 0.1);
  // The equation's clock runs A^2 as fast at swell A: the scaling at work.
  // The envelope travels at the group speed, half the crests' speed in deep
  // water; the crests run through it once every 2 pi / kap units of the
  // clock, and one stands on the breather's middle at t = 0.
  const step = 0.625 * speed * P.A * P.A;
  let T = halfCycle(P.a);
  P.kap = (2 * PI * max(1, round((3.6 * T) / PI))) / (2 * T);
  const cg = (LAM * P.kap * step) / (2 * PI);
  if (!P.started) {
    // Fill the record with the 4 units before the opening.
    P.started = true;
    for (let i = REC - 1; i >= 0; i--) {
      envelope(P, P.xu - (cg * i * 0.1) / step, P.t - i * 0.1);
      pushRow(P);
    }
  }
  P.t += step * d;
  P.xu += cg * d;
  while (P.t > T) {
    P.t -= 2 * T;
    // Once a breather has risen and gone, the next one rises one to three
    // crests further on; a whole number of crests, so the sea does not jump.
    if (P.a <= 0.5 || T === 3.5) P.xu += LAM * floor(1 + 3 * Math.random());
  }
  envelope(P, P.xu, P.t);
  P.acc += step * d;
  for (; P.acc >= 0.1; P.acc -= 0.1) pushRow(P);

  // Spray off a crest higher than 2.3 times the swell.
  const sp = speed / 2;
  for (let x = 0; x < W; x++) {
    const hgt = P.env[x] * shape(theta(P, x));
    if (hgt > 2.3 && Math.random() < 6 * sp * (hgt - 2.2) * d * 30 * 0.1) {
      P.spray.push({ x: x + Math.random(), y: MEAN - VS * P.A * hgt - 1, vx: (Math.random() - 0.3) * 16, vy: -(10 + 16 * Math.random()) * P.A, life: 1 + 0.5 * Math.random() });
    }
  }
  for (const p of P.spray) {
    p.x += p.vx * d * sp;
    p.y += p.vy * d * sp;
    p.vy += 40 * d * sp;
    p.life -= d * sp;
  }
  P.spray = P.spray.filter((p) => p.life > 0 && p.y < MEAN + 6 && p.x >= 0 && p.x < W);
  if (P.spray.length > 160) P.spray.splice(0, P.spray.length - 160);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.started) return;
  const h0 = 0.52 + 0.4 * P.hue;
  const REC_COL = [null, hsv(h0 + 0.1, 0.8, 0.08), hsv(h0 + 0.06, 0.8, 0.12), hsv(h0, 0.85, 0.17), hsv(h0, 0.85, 0.26),
    hsv(h0, 0.85, 0.38), hsv(h0, 0.8, 0.54), hsv(h0 - 0.03, 0.55, 0.78), [228, 248, 252]];
  const FOAM = [236, 248, 252], SURF = hsv(h0, 0.7, 0.86), BODY = hsv(h0 + 0.02, 0.9, 0.52), DEEP = hsv(h0 + 0.05, 0.95, 0.3);

  // The record: newest row at the bottom, scrolling up.
  for (let r = 0; r < REC; r++) {
    const o = ((P.head + 1 + r) % REC) * W;
    for (let x = 0; x < W; x++) {
      const c = REC_COL[P.rec[o + x]];
      if (c) display.setPixel(x, r, c[0], c[1], c[2]);
    }
  }
  // The sea under the envelope, foam on the crests, a lit band under the
  // surface and a darker deep.
  for (let x = 0; x < W; x++) {
    const th = theta(P, x), c = (1 + cos(th)) / 2;
    const e = P.env[x], hgt = VS * P.A * e * shape(th);
    const ys = round(MEAN - hgt);
    const foam = c > 0.85 - 0.06 * e ? cl(round((e - 0.6) * 2.5), 1, 6) : 0;
    const deep = MEAN + 18 + round(3 * shape(th));
    for (let y = max(0, ys); y < H; y++) {
      const col = y < ys + foam ? FOAM : y < ys + foam + 3 ? SURF : y < deep ? BODY : DEEP;
      display.setPixel(x, y, col[0], col[1], col[2]);
    }
  }
  for (const p of P.spray) {
    const x = floor(p.x), y = floor(p.y);
    if (y >= 0 && y < H) display.setPixel(x, y, FOAM[0], FOAM[1], FOAM[2]);
  }
}
