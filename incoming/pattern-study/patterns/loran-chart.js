// ===== Patternflow pattern =====
// Title:   Loran Chart
// Family:  loran
// Idea:    A hyperbolic navigation chart of three transmitters, one master and two secondaries, drawn as two families of lane lines, coral and teal on dark navy, crisp where the two families cross squarely and washed into pale blurred fans where they run nearly parallel, while the triangle of stations slowly turns, stretches and drifts across the panel.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hyperbolic radio navigation by the difference in arrival time of pulses from a master and a secondary station (Loran, developed at the MIT Radiation Laboratory under Alfred Loomis, 1940s, from memory), geometric dilution of precision as the measure of how well two lines of position cross (from memory), the first order distance |f| / |grad f| from a point to the curve f = 0 (Gabriel Taubin, 1991, from memory), original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lane=0..4, Span=-1..1, Dilution=-1..1
//
// Knob 1: Hue. Turns both families round the colour wheel together. 0 is coral (hue 0.015) and teal (0.49), 0.475 of a turn apart, so at 0.25 they are green and violet, at 0.5 coral and teal have swapped places and at 1 they are back. The navy ground does not move and the crossings stay white.
// Knob 2: Lane. The width of a lane, the step in range difference between neighbouring lines: L = 9 x 2^(K / 2.6) LEDs, 9 at 0, 15.2 at 2 where it opens, 26.1 at 4. On the panel a line is L / |grad f| from the next, between L / 2 where the two stations pull on opposite sides and far more in the open. At the opening, over 15 minutes, the median gap between lines was 18 LEDs, a quarter of the panel had gaps under 12 and a tenth under 9. At 0 the lanes between two stations crowd below 5 LEDs and melt into a soft glow, at 4 only a few curves cross the panel.
// Knob 3: Span. The size of the triangle of stations, x 2^(0.6 K): 0.66 at -1, 1 at 0 where it opens, 1.52 at 1. At 0 the sides run from 28 to 87 LEDs (median 48) and all three stations are on the panel 41 percent of the time, two of them 55. Small, the stations huddle and most of the panel is the far field, where lines fan out nearly parallel and go pale. Large, the stations are pushed off the panel and the hyperbolas sweep across it almost straight.
// Knob 4: Dilution. How hard the chart punishes a poor fix: s = (K + 1) / 2, strength s^0.7, 0 at -1, 0.64 at 0.06 where it opens, 1 at 1. At -1 every lane is as bright, sharp and coloured as the next whatever the geometry. At 1 every line that crosses its neighbours badly has lost all colour, half its brightness and has grown 1.9 times as wide, the ground behind it has lifted by up to 22, 26 and 35, and what is left is a few coral and teal crossings in a haze of pale rays.
//
// What the picture is. A flat chart, one LED to a unit of ground, of the lines of position of a hyperbolic navigation system. A master station M and two secondaries X and Y send pulses. A receiver at P hears X later than M by (|P - X| - |P - M|) / c, the same delay for every point on one branch of a hyperbola with M and X as its foci, and the chart prints one branch for every whole number of lanes. f_X = |P - X| - |P - M| and f_Y = |P - Y| - |P - M| make two families, and a receiver reads its place where a line of each crosses. Nothing else is drawn: no ship, no compass, no figures, no scale. The stations are soft lumps of light.
// The lines. At each LED both f are computed and the distance to the nearest line is estimated as |f - nL| / |grad f|, grad f being the difference of the two unit vectors that point from the stations to P, so its length runs from 0 to 2. A line is a band whose brightness is (1 - (d / w)^2)^2, 2.7 LEDs wide at half height for an ordinary lane and 3.2 for every third one, n = 0, +-3, +-6, which is also brighter by a factor of 1.43, so the lattice has a grain and does not read as a woven net. Two bands that cross add channel by channel and clip at 255, which makes the crossing of two bold lanes white. Where the lines would be closer than about 5 LEDs they cannot be told apart on 1 LED, so their contrast eases out between 10 and 5 LEDs of gap and the pixel takes the mean level of a family there, at most 0.2: the bundles between two stations melt into a glow and no fog of thin lines is left.
// The fans. Where P lies on the line through M and X beyond either station, the two unit vectors are equal and grad f_X is 0, so the lane widens without end into a fan. A floor under |grad f| (sqrt(|grad f|^2 + 0.14^2)) keeps the band finite, so the broad part of a fan is a wide soft wedge, and a branch whose value is close to the baseline length collapses onto the straight ray itself. Near the master both families have nearly the same gradient, since both are dominated by the distance to M, and they turn into parabolas, which is the true shape of a hyperbola very near a focus. Round a secondary the lines of its own family close into hairpins.
// The dilution. The two gradients make a 2 x 2 matrix J and the error of a fix follows from its singular values. The chart's own measure of how square a cell between four lines is, q = 2 |det J| / (|grad f_X|^2 + |grad f_Y|^2), is 1 where the two families cross at right angles with equal spacing and falls to 0 where they run parallel or one of them thins out. The picture reads q in four ways at once: lines lose colour, dim, blur and the ground takes a pale slate veil where q is small, each scaled by the Dilution knob and by 1 - smoothstep(0.05, 0.25 + 0.35 x strength, q). So the pale fans are the places on the chart where a fix is worst: the baseline extensions, the line through the two secondaries, the whole far field. At the opening, averaged over 15 minutes, 41 percent of the panel has q above 0.39 (with equal gradients, 23 degrees or more between them) and keeps its colour, and 45 percent has q below 0.26 and is more than half faded. The fans swing across the panel as the chart turns, since they stand on lines through the stations.
// The stations. The master M, the secondary X and the secondary Y sit at distances of 27, 31 and 29 LEDs from the centroid of the triangle, times the Span knob, at the angles rot, rot + 120 and rot + 240 degrees. A soft lump of light about 5 LEDs across at half height marks each (white for M, coral for X, teal for Y), with a halo of sigma 6. The corners wander in distance by up to 38, 36 and 37 percent, the angles of X and Y from M by 0.45 radian on 57 and 67 s, on clocks of 29 to 97 s, the triangle breathes by 20 percent on 48 s and 8 on 83 s, the turn runs at 0.065 rad/s with a wander of 0.4 and 0.2 radian on 71 and 44 s, and the centroid drifts by 14 + 6 LEDs across and 24 + 8 down on clocks of 53, 30, 62 and 37 s. The sixteen periods are between 29 and 97 s and none is a multiple of another, so the chart does not come round again, and nothing is stored: the picture is a function of time and the knobs, easing over 0.2 s. A station is now and then off the panel, and the chart is then a window onto a larger one.
// The pulse beads. If the master's wavefront is a circle of radius rho and the secondary's one of radius rho + k, they meet on the line of delay k, and as rho grows the two meeting points run out along the hyperbola from its vertex on the baseline, one each side. A pair of beads, 2.7 LEDs across and mixed 45 percent with white, runs along every lane that the baseline is long enough to hold, taking 15 to 20 s (a different time for each lane, drawn from the seed) over 120 LEDs of rho and fading in over the first 12 percent and out over the last 30. The beads are the one thing here that repeats, a lane's bead every 15 to 20 s, but they ride lines that are never in the same place twice.
// What is exact and what is drawn. The hyperbolas, the gradients, the first order distance and the squareness of the cell, and the circle intersections for the beads, are the real geometry of the system. The line width and brightness, the bold third lane, the floor under the gradient, the melting of crowded lanes, the colours, the four readings of q, the triangle's drift and the beads' speed are drawing choices. No mean of time modulo a period is used for the chart itself.

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
