// ===== Patternflow pattern =====
// Title:   Poisson Spot
// Family:  wave
// Idea:    A plane wave runs down the standing panel past an opaque disc seen in section, drawn as its intensity for every LED against the distance from the axis across and the distance behind the disc down, so a thin line as bright as the open beam, Poisson's spot, runs down the middle of the dark shadow while Fresnel fringes fan out from the rim; every 12.6 s the lamp goes off, the dark runs down the panel, and the wave front comes back down it with the shadow filling from its rim.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Poisson's spot (Simeon Denis Poisson, 1818), observed by Francois Arago (1819), Fresnel diffraction by an opaque disc (Augustin-Jean Fresnel), pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Wavelength=0..1, Reach=0.5..3, Edge=0..1, Disc=-1..1
//
// Knob 1: Wavelength. The colour and the length of the light together: blue at 0, then cyan, green, amber at 0.75 and red at 1, each going to a pale tint where the light is brightest. The field depends on the wavelength times the distance, so a longer wave stretches every fringe down the panel and out from the rim, and at 1 the shadow has filled to 0.8 of the open beam by the bottom row where at 0 it holds 0.5.
// Knob 2: Reach. How far behind the disc the panel looks: the bottom row is 3 times as far as the top row at 0.5, 9 times at the opening 2 and 13 times at 3, with the top row held 30 LEDs behind the disc, so a short reach is the near field of crisp fringes and a long one lets the shadow fill in round the spot.
// Knob 3: Edge. How rough the disc's rim is, from a true circle at 0 to a saw-tooth rim whose radius is spread 28 percent either way at 1. The rim's parts are out of step with each other, so the spot is as bright as the open beam only where they still agree: at 1 it stays under a fifth of the beam down the top 40 rows and reaches 0.8 only at the bottom, and the fringes wash out.
// Knob 4: Disc. The radius of the disc: 6.5 LEDs at -1, 10 at 0 and 13.5 at 1. A bigger disc casts a wider shadow, holds more Fresnel zones at the same depth and so a finer fan of fringes, and a narrower spot.

const W = 64, H = 128, HW = 33;
const { min, max, floor, ceil, sqrt, sin, cos, abs, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The map. A plane wave of unit amplitude meets an opaque disc of radius a
// in the plane z = 0. In the paraxial approximation (Fresnel) the field
// behind it at distance rho from the axis and z behind the disc is
//   U = 1 + i K exp(i K rho^2 / 2) * integral_0^a exp(i K s^2 / 2) J0(K rho s) s ds,  K = 2 pi / (lambda z),
// the open beam minus the field of a round hole (Babinet). On the axis the
// integral is exp(i K a^2 / 2) - 1 over iK, so U = exp(i K a^2 / 2) and
// |U|^2 = 1 at every depth and for every disc: the spot is as bright as the
// beam that was never blocked. Far from the axis U tends to 1.
// Lengths are in LEDs. The top row is 30 LEDs behind the disc and each row
// down is 1.94 LEDs further, so the bottom row is nine times as far as the
// top. Only lambda z enters U, so breathing the wavelength is the same as
// stretching the map down from the disc, and draw() does that.
const ZS = 30;
const ZROW = (y, zg) => ZS * (1 + (zg * y) / (H - 1));

// J0 by the Abramowitz and Stegun polynomials 9.4.1 and 9.4.3, error under 1e-7.
function J0(x) {
  x = abs(x);
  if (x <= 3) {
    const t = (x / 3) * (x / 3);
    return 1 + t * (-2.2499997 + t * (1.2656208 + t * (-0.3163866 + t * (0.0444479 + t * (-0.0039444 + t * 0.00021)))));
  }
  const t = 3 / x;
  const f = 0.79788456 + t * (-0.00000077 + t * (-0.0055274 + t * (-0.00009512 + t * (0.00137237 + t * (-0.00072805 + t * 0.00014476)))));
  const th = x - 0.78539816 + t * (-0.04166397 + t * (-0.00003954 + t * (0.00262573 + t * (-0.00054125 + t * (-0.00029333 + t * 0.00013558)))));
  return (f * cos(th)) / sqrt(x);
}

// |U|^2 at distance rho for the wave number per depth K. A rough rim is
// the field averaged over NR discs whose radii are spread evenly over
// a (1 - eps) .. a (1 + eps), which is what the rim does on the axis (the
// rim's parts are phasors of different phase) and a fair picture off it.
// One pass of Simpson's rule from the centre out lays the integral down at
// every radius, 10 steps to the longest period.
const NR = 6;
function field(rho, K, a, eps, out) {
  const nr = eps > 0 ? NR : 1, w = K * (a * (1 + eps) + rho) / TAU;
  const c0 = cos((K * rho * rho) / 2), s0 = sin((K * rho * rho) / 2);
  let ur = 0, ui = 0, lo = 0, ir = 0, ii = 0;
  for (let j = 0; j < nr; j++) {
    const hi = nr === 1 ? a : a * (1 + eps * ((2 * (j + 0.5)) / nr - 1));
    const n = max(4, 2 * ceil(4.5 * w * (hi - lo))), h = (hi - lo) / n;
    let sr = 0, si = 0;
    for (let i = 0; i <= n; i++) {
      const s = lo + i * h, g = J0(K * rho * s) * s * (i === 0 || i === n ? 1 : i & 1 ? 4 : 2), ph = (K * s * s) / 2;
      sr += g * cos(ph);
      si += g * sin(ph);
    }
    ir += (sr * h) / 3;
    ii += (si * h) / 3;
    lo = hi;
    ur += 1 - K * (c0 * ii + s0 * ir);
    ui += K * (c0 * ir - s0 * ii);
  }
  ur /= nr;
  ui /= nr;
  out[0] = ur;
  out[1] = ui;
  return ur * ur + ui * ui;
}

// The whole map, one value for each LED of the right half and the axis
// column: column m is rho = m, so the panel's column 32 is the axis and its
// column 31 is the same distance out as 33. An LED covers one LED of rho, so
// where the fringes are finer than that several points under it are averaged.
function build(S) {
  const { a, lam, eps, zg, I } = S, o = [0, 0];
  for (let y = 0; y < H; y++) {
    const K = TAU / (lam * ZROW(y, zg)), F = (K * a * a) / 2;
    const ns = F > 14 ? 6 : F > 7 ? 4 : F > 3.5 ? 2 : 1;
    for (let m = 0; m < HW; m++) {
      let acc = 0;
      for (let q = 0; q < ns; q++) acc += field(abs(m - 0.5 + (q + 0.5) / ns), K, a, eps, o);
      I[y * HW + m] = acc / ns;
    }
  }
  S.ba = a;
  S.bl = lam;
  S.be = eps;
  S.bz = zg;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The lamp's round, in seconds: the front enters at the top at 0 and leaves
// the bottom at 2.5, the lamp goes off at 9.6 and the dark does the same trip,
// and the panel is black from 12.1 to 12.6. The front runs at 56 rows a
// second. The panel opens at 5.1, with the front long gone and the lamp
// about to go off 4.5 s on.
const ROUND = 12.6, ON = 9.6, FRONT = 56, C0 = 5.1;

export function setup(params) {
  const S = {
    I: new Float32Array(HW * H), a: 10.21, lam: 0.85, eps: 0, zg: 8, ba: -1, bl: -1, be: -1, bz: -1,
    c: C0, b: 0, wl: 0, col: [0, 0, 0], pale: [0, 0, 0],
  };
  params.s = S;
  build(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const wl = cl(k[0], 0, 1);
  S.wl = wl;
  S.a = 10 * (1 + 0.35 * cl(k[3], -1, 1));
  S.lam = 0.85 + 0.85 * wl;
  S.eps = 0.28 * cl(k[2], 0, 1);
  S.zg = 4 * cl(k[1], 0.5, 3);
  if (abs(S.a - S.ba) > 0.02 || abs(S.lam - S.bl) > 0.002 || abs(S.eps - S.be) > 0.002 || abs(S.zg - S.bz) > 0.02) build(S);
  S.c += d;
  if (S.c >= ROUND) S.c -= ROUND;
  S.b += d;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { I, a, c } = S;
  // Blue to red along the spectrum, pale where the light is brightest. A dim
  // orange or yellow reads as brown, so the middle levels of the warm colours
  // go to red, like a hot coal that whitens.
  const h = 0.62 - 0.62 * S.wl, col = S.col;
  hsv(h * sm(h / 0.34), 0.85, 1, col);
  hsv(h, 0.12, 1, S.pale);
  const dr = col[0], dg = col[1], db = col[2], pr = S.pale[0], pg = S.pale[1], pb = S.pale[2];
  // The wavelength breathes 6 percent either way once in 14 s, which stretches
  // the map down from the disc, which is g0 rows above the top row.
  const br = 1 + 0.06 * sin((S.b / 14) * TAU), g0 = (H - 1) / S.zg;
  const yf = -6 + FRONT * c, yt = -6 + FRONT * (c - ON);
  for (let y = 0; y < H; y++) {
    const yy = cl(g0 * ((1 + y / g0) * br - 1), 0, H - 1.001), r0 = floor(yy), fy = yy - r0, o0 = r0 * HW, o1 = o0 + HW;
    for (let x = 0; x < W; x++) {
      const m = x < 32 ? 32 - x : x - 32;
      const v = I[o0 + m] * (1 - fy) + I[o1 + m] * fy;
      // The wave front is flat outside the shadow; the shadow fills from the
      // rim, so the axis is lit 5 rows after the front has passed (far more
      // than the paraxial delay, so that it can be seen).
      const lag = 0.5 * max(0, a - m);
      const fa = yf - lag - y, ta = y - (yt - lag);
      const lit = sm(fa / 2.5) * sm(ta / 2.5);
      let L = min(1, 0.85 * v ** 1.3);
      L = L * lit + 0.45 * exp(-((fa / 1.6) ** 2)) * (m > a - 2 ? 1 : 0.4) * sm(ta / 2.5);
      L = cl(L, 0, 1);
      const w = sm((L - 0.5) / 0.45) * 0.95;
      display.setPixel(x, y, (L * (dr + (pr - dr) * w) * 255) | 0, (L * (dg + (pg - dg) * w) * 255) | 0, (L * (db + (pb - db) * w) * 255) | 0);
    }
  }
}
