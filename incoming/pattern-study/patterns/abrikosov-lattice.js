// ===== Patternflow pattern =====
// Title:   Abrikosov Lattice
// Family:  physics
// Idea:    A rotating Bose-Einstein condensate fills the tall panel in the lowest Landau level, its phase drawn as hue and its density as brightness, so each quantised vortex is a black core round which every hue turns once, the cores stand in Abrikosov's triangular lattice and turn with the fluid, and turning up the rotation packs them closer, Feynman's 2 m Omega / h to each unit of area, while new ones come in from the dark rim.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Abrikosov vortex lattice (Alexei Abrikosov, 1957), triangular vortex lattice (W. H. Kleiner, L. M. Roth and S. H. Autler, 1964), areal density of quantised vortices (Richard Feynman, 1955), vortex lattices in rotating Bose-Einstein condensates (K. W. Madison, F. Chevy, W. Wohlleben and J. Dalibard, 2000; J. R. Abo-Shaeer, C. Raman, J. M. Vogels and W. Ketterle, 2001), rapidly rotating condensate in the lowest Landau level (Tin-Lun Ho, 2001), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rotation=0.3..0.95, Round=0..1
//
// Knob 1: Hue. Turns the wheel the phase is drawn on. At 0 phase zero is azure, and the hues run azure, violet, magenta, red, gold, green and cyan anticlockwise round every core; at 0.5 phase zero is orange. Blue is paled toward periwinkle so that it does not read as a hole beside the cores, which are the only black.
// Knob 2: Speed. How fast the lattice turns, anticlockwise with the flow round the cores, at 0.25 Speed Omega / omega radians a second: at 2 and the opening Rotation 0.3 it turns 0.15 rad/s, a sixth of a turn, the lattice's own symmetry, in 7 s; at 0.2 in 70 s, at 3 in 4.7 s.
// Knob 3: Rotation. Omega / omega, from 0.3 to 0.95. Feynman's rule puts 2 m Omega / h vortices on each unit of area, so the spacing goes as 1 / sqrt(Omega): 25 LEDs at 0.3, where 9 to 13 cores sit in the bright cloud and 15 to 17 on the panel; 17.7 LEDs at 0.6, with 21 to 23 in the cloud; 14 LEDs at 0.95, with 31 to 37 in the cloud and 47 to 51 on the panel. The lattice closes in on the central core, so new vortices come in from the dark rim, and it turns faster in step with Omega.
// Knob 4: Round. The trap's aspect. The cloud's half axes are 33 LEDs across and 33 (2 - Round) down: 64 at the opening 0.06, so the cloud fills the tall panel; 49.5 at 0.5; 33 at 1, a round cloud with 7 cores in it at the opening Rotation and the top and bottom of the panel dark.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, exp, cos, sin, atan2, round, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Abrikosov's lattice function in the lowest Landau level, Landau gauge,
// lengths in the magnetic length l: Phi(x, y) = sum_n C_n e^(i q n y)
// e^(-(x - q n)^2 / 2), with C_n = 1 for even n and i for odd n and
// q^2 = pi sqrt 3, the triangular lattice of Kleiner, Roth and Autler. Its
// zeros sit at (q/2, Ly/4) + the lattice, Ly = 2 pi / q, one to each area
// 2 pi l^2, spacing D = sqrt(4 pi / sqrt 3) = 2.694 l.
const Q = sqrt(PI * sqrt(3)), LY = TAU / Q, D = sqrt((4 * PI) / sqrt(3)), X0 = Q / 2, Y0 = LY / 4;
const OUT = [0, 0];
function phi(x, y) {
  let re = 0, im = 0;
  const n0 = round(x / Q), c = cos(Q * y), s = sin(Q * y);
  // e^(i q n y) for n = n0 - 3 by one cos and sin, then by rotation.
  let er = cos(Q * (n0 - 3) * y), ei = sin(Q * (n0 - 3) * y);
  for (let n = n0 - 3; n <= n0 + 3; n++) {
    const u = x - Q * n, g = exp(-u * u / 2);
    if (n & 1) (re -= ei * g), (im += er * g);
    else (re += er * g), (im += ei * g);
    const t = er * c - ei * s;
    ei = er * s + ei * c;
    er = t;
  }
  OUT[0] = re;
  OUT[1] = im;
  return OUT;
}

// Phi over one magnetic cell, x in [0, 2q) and y in [0, Ly), tabled once:
// Phi(x + 2q j, y + Ly m) = e^(2 i q j y) Phi(x, y), so the table and one
// phase give Phi anywhere.
const TX = 168, TY = 96, TRe = new Float32Array((TX + 1) * (TY + 1)), TIm = new Float32Array((TX + 1) * (TY + 1));
for (let j = 0; j <= TY; j++)
  for (let i = 0; i <= TX; i++) {
    const f = phi((i / TX) * 2 * Q, (j / TY) * LY);
    TRe[j * (TX + 1) + i] = f[0];
    TIm[j * (TX + 1) + i] = f[1];
  }
// The largest |Phi| in the table, the brightest point of every cell.
let MX = 0;
for (let o = 0; o < TRe.length; o++) MX = max(MX, sqrt(TRe[o] * TRe[o] + TIm[o] * TIm[o]));
// Phi at (x, y) from the table: modulus and argument.
const LOOK = [0, 0];
function look(x, y) {
  const jx = floor(x / (2 * Q)), my = floor(y / LY), u = ((x - jx * 2 * Q) / (2 * Q)) * TX, v = ((y - my * LY) / LY) * TY;
  let i = floor(u), j = floor(v);
  if (i >= TX) i = TX - 1;
  if (j >= TY) j = TY - 1;
  const fu = u - i, fv = v - j, o = j * (TX + 1) + i;
  const re = (TRe[o] * (1 - fu) + TRe[o + 1] * fu) * (1 - fv) + (TRe[o + TX + 1] * (1 - fu) + TRe[o + TX + 2] * fu) * fv;
  const im = (TIm[o] * (1 - fu) + TIm[o + 1] * fu) * (1 - fv) + (TIm[o + TX + 1] * (1 - fu) + TIm[o + TX + 2] * fu) * fv;
  LOOK[0] = sqrt(re * re + im * im);
  LOOK[1] = atan2(im, re) + 2 * Q * jx * y;
  return LOOK;
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, rot: 0.3, round: 0.06, angle: 0, ek: -1, E: new Float32Array(N), A: new Float32Array(N), P: new Float32Array(N) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.rot = cl(k[2], 0.3, 0.95);
  S.round = cl(k[3], 0, 1);
  S.angle += d * 0.25 * S.speed * S.rot;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  // Feynman's rule: vortices per area 2 m Omega / h, so the spacing goes as
  // 1 / sqrt(Omega): 25 LEDs at Omega = 0.3 omega.
  const dl = 25 * sqrt(0.3 / S.rot), sc = D / dl; // l per LED
  const { A, P, E } = S, ca = cos(S.angle), sa = sin(S.angle), tmp = [0, 0, 0];
  if (S.ek !== S.round) {
    // The cloud: half axes 33 LEDs across and 33 (2 - Round) down, its
    // envelope exp(-r^6), flat inside and falling over about 8 LEDs.
    S.ek = S.round;
    const a = 33, b = 33 * (2 - S.round);
    for (let Y = 0, p = 0; Y < H; Y++)
      for (let X = 0; X < W; X++, p++) {
        const r2 = ((X - 31.5) / a) ** 2 + ((Y - 63.5) / b) ** 2;
        E[p] = exp(-(r2 * r2 * r2));
      }
  }
  // In the lab frame the condensate is this function in the symmetric gauge,
  // f(z) e^(-|z|^2 / 4) with f holomorphic: Phi times e^(-i x y / 2), moved
  // by a magnetic translation so a zero sits on the cloud's centre, and
  // turned with the lattice, which keeps that form. So every zero winds
  // the phase once anticlockwise. The cloud's envelope multiplies it, the
  // slowly varying density times the lattice that many vortices make.
  for (let Y = 0, p = 0; Y < H; Y++)
    for (let X = 0; X < W; X++, p++) {
      const px = (X - 31.5) * sc, py = (63.5 - Y) * sc;
      // Into the lattice's turning frame, then onto Abrikosov's function
      // with a zero on the cloud's centre.
      const x = ca * px + sa * py, y = -sa * px + ca * py;
      const f = look(x + X0, y + Y0), m = f[0];
      // Symmetric gauge about the centre: arg Phi - x y / 2 - x0 y.
      P[p] = f[1] - (x * y) / 2 - X0 * y;
      A[p] = m * E[p];
    }
  // Brightness |psi|^1.25: a core is dark, below half brightness, over a
  // disc 0.4 of the spacing across, 10 LEDs at the opening, where the
  // steepest step between neighbours is 28 / 255.
  for (let p = 0; p < N; p++) {
    const u = min(1, A[p] / MX), v = u * sqrt(sqrt(u)), h = S.hue + 0.6 + P[p] / TAU, e = max(0, 1 - abs(h - floor(h) - 0.667) * 7);
    hsv(h, 1 - 0.35 * e * e, v, tmp);
    display.setPixel(p & 63, p >> 6, round(tmp[0] * 255), round(tmp[1] * 255), round(tmp[2] * 255));
  }
}
