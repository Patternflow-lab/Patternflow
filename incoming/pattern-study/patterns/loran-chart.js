// ===== Patternflow pattern =====
// Title:   Loran Chart
// Family:  loran
// Idea:    A hyperbolic navigation chart of three transmitters, one master and two secondaries, drawn as two families of lane lines, each the points where the arrival times from the master and a secondary differ by a whole number of lanes, glowing coral and teal on dark navy, where the two families cross at right angles the lattice is crisp and where they run parallel along the baseline extensions it fades to pale fans, while the triangle of stations slowly turns, stretches and drifts across the panel.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hyperbolic radio navigation by the difference in arrival time of pulses from a master and a secondary station (Loran, United States, 1940s, from memory), the dilution of precision of a position fix as a measure of how square the crossing of two lines of position is (from memory), original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lane=0..4, Span=-1..1, Dilution=-1..1
//
// Knob 1: Hue. Turns both families round the colour wheel together. 0 is coral and teal, 0.5 is each family half way round, 1 is back. The navy ground stays where it is.
// Knob 2: Lane. The width of a lane, the step in range difference between neighbouring lines. L = 7 x 2^(K / 2.3) LEDs of range difference: 7 at 0, 12.8 at 2 where it opens, 23.5 at 4. A line is L / |grad f| LEDs from the next on the screen, so 3.5 to 7 LEDs apart between two stations at 0 and 12 to 23 LEDs apart in the open parts of the chart at 4. Where the lines would be closer than about 6 LEDs they fade into a soft glow instead of a fog of thin lines.
// Knob 3: Span. How big the triangle of stations is, x 2^(0.6 K): 0.66 at -1, 1 at 0 where it opens, 1.52 at 1. Small, all three stations stand close together and most of the panel is the far field, where the lines fan out nearly parallel and the picture goes pale; large, the stations leave the panel and the curved lanes sweep across it.
// Knob 4: Dilution. How much the fan around a baseline extension is washed out. 0 at -1, half at 0 where it opens (0.53), full at 1. At 0 every lane is as bright as the next whatever the geometry; at full strength the poorly fixed parts lose their colour, dim and take a pale veil, and only the square crossings stay coral and teal.
//
// What the picture is. A flat chart, one LED to a unit of ground, of the lines of position of a hyperbolic navigation system. A master station M and two secondaries X and Y send pulses; a receiver at P sees the secondary X arrive later than the master by (|P - X| - |P - M|) / c. All the points with the same delay lie on one branch of a hyperbola with M and X as its foci, and the chart prints one branch for every multiple of a lane width L. Two families, f_X = |P - X| - |P - M| and f_Y = |P - Y| - |P - M|, cross, and a receiver reads its place off the crossing. Nothing else is drawn: no ship, no compass, no figures. The stations are soft lumps of light where the lines gather.
// The lines. At each LED both f are computed and the distance to the nearest line is estimated as |f - nL| / |grad f|, grad f being the difference of the two unit vectors from the stations to P, between 0 and 2 long. The line is a soft band about 2.8 LEDs wide at half height. Two bright bands that cross add, and the sum is eased into white so the crossings stand out as knots of light and no knot is clipped flat. At the knob's 2 the lines are 6 to 18 LEDs apart, 10 on average.
// The fans. Where P lies on the line through M and X beyond either station, the two unit vectors are the same and grad f_X is 0, and the lane widens without end into a fan. A floor under |grad f| (0.14) keeps the band finite there, so the broad part of every fan is a wide soft wedge, and a branch whose value is close to the baseline length collapses onto the straight line itself. Near the master both families have nearly the same gradient and both turn into parabolas, which is the true shape of a hyperbola very close to a focus.
// The dilution. The two gradients make a 2 x 2 matrix J. The position error follows from its singular values, and the chart's own measure of how square the cell between four lines is, q = 2 |det J| / (|grad f_X|^2 + |grad f_Y|^2), is 1 where the lines cross at right angles and with equal spacing and falls to 0 where they run parallel or one of them thins out to nothing. q is read in the picture three ways: saturation and brightness of both bands fall where q is small, and a pale slate veil lifts the dark ground there. The pale fans are therefore the places on the chart where a fix is worst, and they stand along the baseline extensions and on the line through the two secondaries, and they swing across the panel as the chart turns.
// The stations. The triangle turns at about 0.05 rad/s plus a wander of a third of a radian on 71 and 44 s, its three corners wander in distance and in angle on clocks of 29 to 97 s, the whole triangle breathes by 20 percent on 48 s and 8 on 83 s, and its centre drifts by 25 LEDs across and 32 down on clocks of 30 to 62 s. The 17 periods are between 29 and 97 s and no one is a multiple of another, so the chart does not come round again, and nothing is stored: the picture is a function of time and the knobs, easing over 0.2 s. A station is often off the panel, and the chart is then a window onto a larger one.
// What is exact and what is drawn. The hyperbolas, the gradients, the first order distance to a line and the squareness of the cell are the real geometry of the system. The line width, the floor under the gradient, the soft glow where lines would crowd, the colours and the three readings of q are drawing choices.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const BW = 2.5;        // support of a line, LEDs from its middle to where it ends
const GMIN = 0.14;     // floor under |grad f|
const SOFT = 0.25;     // keeps a unit vector finite on a station

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(TAU * Math.random());
  params.s = { t: 0, k: null, ph };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d;
}

const CA = [0, 0, 0], CB = [0, 0, 0], CM = [0, 0, 0], PA = [0, 0, 0], PB = [0, 0, 0];
const BUF = new Float32Array(W * H * 3);

// a soft lump of light, sigma in LEDs, added in colour c times amp
function lump(cx, cy, sig, amp, c) {
  const R = floor(sig * 3.2) + 1, is2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R);
  const y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, a = 255 * amp * exp(-(dx * dx + dy * dy) * is2);
      const o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

// The pulse beads: the master's wavefront is a circle of radius rho and the secondary's one of radius rho + k, they meet
// on the line of delay k, and as rho grows the two meeting points run out along the hyperbola.
function beads(mx, my, sx, sy, fam, L, T, p, c, lead) {
  const dx = sx - mx, dy = sy - my, D = sqrt(dx * dx + dy * dy);
  if (D < 8) return;
  const beta = Math.atan2(dy, dx), nmax = floor((D - 4) / L);
  for (let n = -nmax; n <= nmax; n++) {
    const id = fam * 16 + n + 8, kk = n * L;
    let u = T / (15 + 5 * (p[(id + 7) % 40] / TAU)) + p[id % 40] / TAU;
    u -= floor(u);
    const rho = (D - kk) / 2 + u * 120;
    const ca = (D * D - 2 * rho * kk - kk * kk) / (2 * rho * D);
    if (ca >= 1 || ca <= -1) continue;
    const al = Math.acos(ca);
    const env = sm(0, 0.12, u) * (1 - sm(0.7, 1, u)) * sm(0, 6, D - 4 - abs(kk)) * (n % 3 === 0 ? 1 : 0.8);
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const an = beta + sgn * al;
      lump(mx + rho * cos(an), my + rho * sin(an), 1.15, 0.9 * env * lead, c);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t, k = S.k, p = S.ph;
  const sn = (per, i) => sin((TAU * T) / per + p[i]);

  const hue = k[0];
  const L = 9 * pow(2, cl(k[1], 0, 4) / 2.6);
  const span = pow(2, 0.6 * cl(k[2], -1, 1));
  const dil = pow((cl(k[3], -1, 1) + 1) / 2, 0.7);

  // the triangle of stations: a centre, a turn, and three corners each on its own radius and angle
  const gx = 31.5 + 14 * sn(53, 0) + 6 * sn(30, 1);
  const gy = 63.5 + 24 * sn(62, 2) + 8 * sn(37, 3);
  const rot = 0.065 * T + 0.4 * sn(71, 4) + 0.2 * sn(44, 5) + p[6];
  const sc = span * (1 + 0.2 * sn(48, 7) + 0.08 * sn(83, 8));
  const rM = 27 * sc * (1 + 0.28 * sn(29, 9) + 0.1 * sn(61, 10));
  const rX = 31 * sc * (1 + 0.26 * sn(41, 11) + 0.1 * sn(97, 12));
  const rY = 29 * sc * (1 + 0.27 * sn(34, 13) + 0.1 * sn(79, 14));
  const aX = rot + TAU / 3 + 0.45 * sn(57, 15);
  const aY = rot + (2 * TAU) / 3 + 0.45 * sn(67, 16);
  const mx = gx + rM * cos(rot), my = gy + rM * sin(rot);
  const xx = gx + rX * cos(aX), xy = gy + rX * sin(aX);
  const yx = gx + rY * cos(aY), yy = gy + rY * sin(aY);

  hsv(0.015 + hue, 0.62, 1, CA);
  hsv(0.49 + hue, 0.74, 0.92, CB);
  for (let i = 0; i < 3; i++) {
    CM[i] = 0.25 * (CA[i] + CB[i]) + 0.5;
    PA[i] = 0.55 * CA[i] + 0.45;
    PB[i] = 0.55 * CB[i] + 0.45;
  }
  const iL = 1 / L;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let ax = x - mx, ay = y - my;
      const dM = sqrt(ax * ax + ay * ay + SOFT);
      const umx = ax / dM, umy = ay / dM;
      ax = x - xx; ay = y - xy;
      const dX = sqrt(ax * ax + ay * ay + SOFT);
      const gxx = ax / dX - umx, gxy = ay / dX - umy;
      ax = x - yx; ay = y - yy;
      const dY = sqrt(ax * ax + ay * ay + SOFT);
      const gyx = ax / dY - umx, gyy = ay / dY - umy;
      const gX2 = gxx * gxx + gxy * gxy, gY2 = gyx * gyx + gyy * gyy;

      // squareness of the cell
      const q = (2 * abs(gxx * gyy - gxy * gyx)) / (gX2 + gY2 + 1e-4);
      const bad = 1 - sm(0.05, 0.25 + 0.35 * dil, q);

      // the dilution: where the fix is poor the lines blur, lose colour, dim, and a veil lifts the ground
      const fade = dil * bad;
      const blur = 1 + 0.9 * fade;

      // family X
      const tX = (dX - dM) * iL;
      const nX = floor(tX + 0.5);
      const gmX = sqrt(gX2 + GMIN * GMIN);
      let dd = abs(tX - nX) * L / gmX;
      let sp = L / gmX;
      let bw = (nX % 3 === 0 ? BW * 1.2 : BW) * blur;
      let v = 1 - (dd * dd) / (bw * bw);
      let lineX = v > 0 ? v * v : 0;
      const meanX = min(0.2, (0.9 * 1.067 * BW) / sp);
      lineX = meanX + sm(5, 10, sp) * (lineX * (nX % 3 === 0 ? 1 : 0.7) - meanX);

      // family Y
      const tY = (dY - dM) * iL;
      const nY = floor(tY + 0.5);
      const gmY = sqrt(gY2 + GMIN * GMIN);
      dd = abs(tY - nY) * L / gmY;
      sp = L / gmY;
      bw = (nY % 3 === 0 ? BW * 1.2 : BW) * blur;
      v = 1 - (dd * dd) / (bw * bw);
      let lineY = v > 0 ? v * v : 0;
      const meanY = min(0.2, (0.9 * 1.067 * BW) / sp);
      lineY = meanY + sm(5, 10, sp) * (lineY * (nY % 3 === 0 ? 1 : 0.7) - meanY);

      const keep = 1 - fade;
      const dim = 1 - 0.5 * fade;
      const lum = 0.55 * dim;
      const wa = lineX * dim, wb = lineY * dim;
      const veil = 0.8 * fade * bad;
      const o = (y * W + x) * 3;
      BUF[o] = 8 + 28 * veil + 255 * (wa * (CA[0] * keep + lum * 0.85 * (1 - keep)) + wb * (CB[0] * keep + lum * 0.85 * (1 - keep)));
      BUF[o + 1] = 14 + 32 * veil + 255 * (wa * (CA[1] * keep + lum * 0.9 * (1 - keep)) + wb * (CB[1] * keep + lum * 0.9 * (1 - keep)));
      BUF[o + 2] = 40 + 44 * veil + 255 * (wa * (CA[2] * keep + lum * (1 - keep)) + wb * (CB[2] * keep + lum * (1 - keep)));
    }
  }

  // the stations, soft lumps where the lines gather
  lump(mx, my, 2.3, 0.85, CM);
  lump(mx, my, 6, 0.18, CM);
  lump(xx, xy, 2.1, 0.7, CA);
  lump(xx, xy, 5.5, 0.15, CA);
  lump(yx, yy, 2.1, 0.7, CB);
  lump(yx, yy, 5.5, 0.15, CB);

  beads(mx, my, xx, xy, 0, L, T, p, PA, 1);
  beads(mx, my, yx, yy, 1, L, T, p, PB, 1);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
