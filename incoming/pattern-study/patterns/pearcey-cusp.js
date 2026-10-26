// ===== Patternflow pattern =====
// Title:   Pearcey Cusp
// Family:  wave
// Idea:    The Pearcey integral, the wave field at the tip of a cusp caustic, computed at every LED: from a bright focus near the top its intensity opens downward into a lattice of bright spots whose wavefronts flow down the panel, and each exact zero of the field, a phase vortex, carries a mark coloured by the way its phase turns.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pearcey integral (Trevor Pearcey, 1946), the cusp diffraction catastrophe (Michael Berry and Colin Upstill, 1980)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wavenumber=-1..1, Tilt=-1..1
//
// Knob 1: Hue. The colour of the light. At 0 it is green inside the ray caustic, where three rays cross, and teal outside it, where one ray passes; a zero is marked pink when the phase climbs clockwise round it and amber when it climbs anticlockwise. At 0.25 the light is violet and at 0.5 rose; 0.75 turns it gold.
// Knob 2: Speed. How fast the phase turns: 0.4 turns a second for each unit, 0.8 at the opening 2. The crests run down the panel and wheel anticlockwise round a pink zero, clockwise round an amber one.
// Knob 3: Wavenumber. The wavenumber k in octaves around the opening view, with the ray caustic held still: at 0 the panel spans x from -12 to 12 and y from 2 to -10 and holds 76 zeros; at -1 it is 0.59 of that across and 0.71 down, 18 zeros; at 1 it is 1.68 across and 1.41 down, about 285 zeros, packed as close as the LEDs can mark them.
// Knob 4: Tilt. Adds a t^3 term to the phase, up to 1.5 t^3 at either end. A shift of t removes it again, so the field is the same Pearcey field on sheared axes: the cusp's axis leans 21 LEDs left at 1 or right at -1 by the bottom row, and its tip rises 9 rows.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The opening view in Pearcey units: x across, y down the panel.
const XH = 12, YT = 2, YB = -10;

// Quadrature nodes. P(x, y) is the integral over real t of
// exp(i (t^4 + y t^2 + x t)). Cauchy lets the path leave the real axis, and
// on t(s) = s + i K s^3 / (s^2 + C^2) the integrand is real-axis-like near
// the stationary points and dies as exp(-s^4) far out. The integrand is
// analytic along the path, so the trapezoid rule converges geometrically:
// 169 nodes agree with an 80-digit sum on the path t = s e^(i pi/8) to
// 3e-10 of the field's size at 40 LEDs, tilted views among them.
const HS = 0.06, CC = 5, KK = 0.5, SM = 5, J = 2 * Math.ceil(SM / HS) + 1;
const SR = new Float64Array(J), SI = new Float64Array(J), WR = new Float64Array(J), WI = new Float64Array(J);
for (let j = 0; j < J; j++) {
  const s = (j - (J - 1) / 2) * HS, d = s * s + CC * CC;
  SR[j] = s;
  SI[j] = (KK * s * s * s) / d;
  // dt = t'(s) ds
  WR[j] = HS;
  WI[j] = (HS * KK * s * s * (s * s + 3 * CC * CC)) / (d * d);
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, kn: NaN, tl: NaN, ph: 0,
    re: new Float64Array(N), im: new Float64Array(N), amp: new Float32Array(N), ur: new Float32Array(N), ui: new Float32Array(N),
    zs: new Int8Array(N), nz: 0, rays: new Float32Array(N), xs: new Float64Array(W), ys: new Float64Array(H),
    Er: new Float64Array(W * J), Ei: new Float64Array(W * J), Br: new Float64Array(J), Bi: new Float64Array(J), c: [0, 0, 0],
  };
}

// The whole field for wavenumber knob kn and tilt knob tl. Scaling the
// wavenumber k by 2^kn scales x by k^(3/4) and y by k^(1/2), which keeps the
// ray caustic 8 y^3 + 27 x^2 = 0 at the same LEDs. The cubic coefficient
// scales by k^(1/4), which keeps the lean the same.
function field(S, kn, tl) {
  const s = 2 ** (kn / 2), sx = s ** 1.5, a = 1.5 * tl * sqrt(s), q = a / 4;
  const { re, im, xs, ys, Er, Ei, Br, Bi } = S;
  for (let m = 0; m < W; m++) xs[m] = sx * XH * ((2 * m + 1) / W - 1);
  for (let r = 0; r < H; r++) ys[r] = s * (YT + ((YB - YT) * (r + 0.5)) / H);
  // The path shifted left by a/4 is the one that suits the t^3 term, since
  // t = u - a/4 turns t^4 + a t^3 into u^4 plus lower powers.
  for (let m = 0; m < W; m++)
    for (let j = 0; j < J; j++) {
      const x = xs[m], e = exp(-x * SI[j]), ang = x * (SR[j] - q);
      Er[m * J + j] = e * cos(ang);
      Ei[m * J + j] = e * sin(ang);
    }
  for (let r = 0; r < H; r++) {
    const y = ys[r];
    for (let j = 0; j < J; j++) {
      const tr = SR[j] - q, ti = SI[j];
      const t2r = tr * tr - ti * ti, t2i = 2 * tr * ti, t3r = t2r * tr - t2i * ti, t3i = t2r * ti + t2i * tr;
      const pr = t2r * t2r - t2i * t2i + a * t3r + y * t2r, pi = 2 * t2r * t2i + a * t3i + y * t2i, g = exp(-pi);
      const fr = g * cos(pr), fi = g * sin(pr);
      Br[j] = fr * WR[j] - fi * WI[j];
      Bi[j] = fr * WI[j] + fi * WR[j];
    }
    for (let m = 0; m < W; m++) {
      let ar = 0, ai = 0;
      for (let j = 0, o = m * J; j < J; j++, o++) {
        const er = Er[o], ei = Ei[o], br = Br[j], bi = Bi[j];
        ar += br * er - bi * ei;
        ai += br * ei + bi * er;
      }
      re[r * W + m] = ar;
      im[r * W + m] = ai;
    }
  }
  // Brightness: the amplitude |P| over 2.2, nearly linear, which is the
  // square root of the intensity: the dim fan outside the cusp still reads
  // while the focus, |P|^2 = 6.9 at most, does not swamp the lattice.
  const { amp, ur, ui, zs, rays } = S;
  for (let p = 0; p < N; p++) {
    const A = sqrt(re[p] * re[p] + im[p] * im[p]);
    amp[p] = min(1, (A / 2.2) ** 0.95);
    ur[p] = A > 0 ? re[p] / A : 0;
    ui[p] = A > 0 ? im[p] / A : 0;
  }
  // The ray picture, for the tint: on the sheared axes u = x - a y / 2 +
  // a^3 / 8, v = y - 3 a^2 / 8 the caustic is 8 v^3 + 27 u^2 = 0. Inside it
  // three rays cross each point, outside one. rays runs from 0 outside to 1
  // inside across about two LEDs, by the caustic's value over its gradient.
  const ex = (2 * sx * XH) / W, ey = (s * (YT - YB)) / H;
  for (let r = 0; r < H; r++)
    for (let m = 0; m < W; m++) {
      const y = ys[r], u = xs[m] - (a * y) / 2 + (a * a * a) / 8, v = y - (3 * a * a) / 8;
      const f = 8 * v * v * v + 27 * u * u, gx = 54 * u * ex, gy = 24 * v * v * ey;
      rays[r * W + m] = cl(0.5 - f / sqrt(gx * gx + gy * gy + 1e-9) / 2, 0, 1);
    }
  // Zeros: the phase winds by a whole turn round a square of four LEDs.
  // The sign of the turn is the vortex's charge; the LED of the four with
  // the least amplitude carries the mark.
  zs.fill(0);
  let nz = 0;
  const wrap = (d) => d - 2 * PI * round(d / (2 * PI));
  for (let r = 0; r < H - 1; r++)
    for (let m = 0; m < W - 1; m++) {
      const p = r * W + m, c4 = [p, p + 1, p + W + 1, p + W];
      let w = 0;
      for (let k = 0; k < 4; k++) {
        const u = c4[k], v = c4[(k + 1) & 3];
        w += wrap(atan2(im[v], re[v]) - atan2(im[u], re[u]));
      }
      const n = round(w / (2 * PI));
      if (n) {
        let b = c4[0];
        for (let k = 1; k < 4; k++) if (amp[c4[k]] < amp[b]) b = c4[k];
        zs[b] = n > 0 ? 1 : -1;
        nz++;
      }
    }
  S.nz = nz;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const kn = cl(k[2], -1, 1), tl = cl(k[3], -1, 1);
  if (abs(kn - S.kn) > 1e-4 || abs(tl - S.tl) > 1e-4 || S.kn !== S.kn) {
    S.kn = kn;
    S.tl = tl;
    field(S, kn, tl);
  }
  // A monochromatic wave keeps its intensity and turns its phase. P obeys
  // dP/dy = -i d2P/dx2, the paraxial wave equation with y as minus the
  // distance travelled, so the light runs down the panel; drawing the real
  // part of P exp(i w t) moves each crest toward lower phase, down with it.
  S.ph += d * S.speed * 0.4 * 2 * PI;
  if (S.ph > 2 * PI) S.ph -= 2 * PI;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { amp, ur, ui, zs, rays, c } = S, cr = cos(S.ph), ci = sin(S.ph), h0 = 0.47 + S.hue;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, a = amp[p];
      if (zs[p]) {
        // A vortex: pink when the phase climbs going clockwise round the
        // square on the panel (right, down, left, up), amber the other way.
        hsv(zs[p] > 0 ? h0 + 0.48 : h0 + 0.67, 0.75, 0.95, c);
      } else {
        // The real part of the turning field over its amplitude: 1 on a
        // crest. Crests brighten and whiten, troughs dim.
        const w = 0.5 + 0.5 * (ur[p] * cr - ui[p] * ci), w2 = w * w;
        hsv(h0 + 0.12 * (1 - rays[p]) - 0.1 * w, 0.85 - 0.5 * a * w2, a * (0.4 + 0.6 * w2), c);
      }
      display.setPixel(x, y, c[0] | 0, c[1] | 0, c[2] | 0);
    }
}
