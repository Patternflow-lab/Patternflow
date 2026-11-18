// ===== Patternflow pattern =====
// Title:   Glass Tint
// Family:  cosmetic
// Idea:    Light falls through a sheet of tinted glass whose surface never stops rippling, and the pale floor beneath it holds a moving net of caustic lines, rose where the glass runs thick, pale where it runs thin and white where the lines focus and cross.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, collab reference for CLIO, after the Crystal Glam Tint, which retailers describe as a shiny transparent finish like a layer of tinted glass; caustics drawn by forward ray shooting through a refracting height field
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ripple=0.2..3, Scale=-1..1, Depth=-1..1
//
// Knob 1: Hue. The tint of the glass, all the way round the wheel; at 0 it is a cherry rose, and the floor and the focused light stay pale whatever the tint.
// Knob 2: Ripple. How fast the surface moves: at 2 the fastest ripple runs a full cycle in about 15 seconds and the slowest in about 45, so a knot in the net loosens and forms again over several seconds; at 0.2 it barely breathes, at 3 it moves half as fast again.
// Knob 3: Scale. The length of the ripples, about 12 LEDs at -1, 19 at the opening and 30 at 1; the cells of the net grow with them.
// Knob 4: Depth. How far below the glass the floor lies: at -1 the light only dapples, soft and wide; at the opening the lines have just begun to cross; at 1 the floor is a fine bright web of folded lines.

const W = 64, H = 128;
const { floor, sin, cos, exp, sqrt, max, min, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The grid the surface is worked out on: one node per LED, with a margin of
// M LEDs all round so light bent in from outside the panel reaches its edges.
const M = 12, GW = W + 2 * M + 1, GH = H + 2 * M + 1, GN = GW * GH;
// Rays leave from a grid of 0.5 LED, four to an LED, over the panel and the margin.
const RS = 0.5;
// Eight ripples, each a plane wave with an angular rate of its own; no two
// rates share a ratio, so the surface never comes back to where it was.
const NWAVE = 8;
const RATE = [0.61, 0.83, 1.07, 1.29, 0.47, 0.97, 1.41, 0.71];
const SPREAD = [0.62, 0.81, 1.0, 1.18, 0.7, 1.33, 0.9, 1.52];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

export function setup(params) {
  const dir = new Float32Array(NWAVE), phase = new Float32Array(NWAVE), wob = new Float32Array(NWAVE), breathe = new Float32Array(NWAVE);
  for (let j = 0; j < NWAVE; j++) {
    // Directions spread round the half circle with a little scatter, so the
    // net has no grain that runs one way. (Round the whole circle, wave j and
    // wave j + 4 lay along one axis and the cells all leaned the same way.)
    dir[j] = ((j + 0.6 * Math.random()) / NWAVE) * PI;
    phase[j] = Math.random() * 2 * PI;
    wob[j] = 0.013 + 0.02 * Math.random();
    breathe[j] = 0.021 + 0.05 * Math.random();
  }
  params.s = {
    t: 0, dir, phase, wob, breathe,
    dx: new Float32Array(GN), dy: new Float32Array(GN), th: new Float32Array(GN),
    light: new Float32Array(W * H), tmp: new Float32Array(W * H), thick: new Float32Array(W * H),
    hue: 0, speed: 2, scale: 0, depth: 0.06, c: new Float32Array(9),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.scale = cl(k[2], -1, 1);
  S.depth = cl(k[3], -1, 1);
  // Model time runs at 0.15 of Ripple: glass, not water, at the opening 2.
  S.t += cl(dt || 0, 0, 0.1) * S.speed * 0.15;
}

// The surface at time t: for each node, how far the light through it is
// bent (dx, dy, in LEDs) and how thick the glass is there (th, -1..1).
function surface(S) {
  const t = S.t, lambda = 19 * Math.pow(1.6, S.scale), k0 = (2 * PI) / lambda;
  // Depth sets how far the floor lies below the glass, so how far the light
  // is carried sideways for a given slope. Lines first cross near 1.
  const D = 1.55 * Math.pow(2.0, S.depth);
  const kx = [], ky = [], om = [], am = [], ph = [];
  let sum = 0;
  for (let j = 0; j < NWAVE; j++) {
    const a = S.dir[j] + 0.35 * sin(S.wob[j] * t * 6.1 + j);
    const kk = k0 * SPREAD[j];
    kx.push(kk * cos(a));
    ky.push(kk * sin(a));
    om.push(RATE[j]);
    const amp = 0.62 + 0.38 * sin(S.breathe[j] * t * 5.3 + 2 * j);
    am.push(amp);
    ph.push(S.phase[j]);
    sum += amp;
  }
  // Slope amplitude per wave, scaled so the bend has a fixed size relative to
  // the ripple length whatever Scale is.
  const bend = (D * lambda) / (2 * PI) / sum * 1.9;
  const { dx, dy, th } = S;
  for (let gy = 0; gy < GH; gy++) {
    const y = gy - M;
    for (let gx = 0; gx < GW; gx++) {
      const x = gx - M, n = gy * GW + gx;
      let sx = 0, sy = 0, h = 0;
      for (let j = 0; j < NWAVE; j++) {
        const p = kx[j] * x + ky[j] * y - om[j] * t + ph[j];
        const s = sin(p), c = cos(p), kl = sqrt(kx[j] * kx[j] + ky[j] * ky[j]);
        // The gradient of a cos(k.x) is -a k sin; normalised by |k| so every
        // wave bends by the same amount.
        sx -= am[j] * (kx[j] / kl) * s;
        sy -= am[j] * (ky[j] / kl) * s;
        h += am[j] * c;
      }
      dx[n] = sx * bend;
      dy[n] = sy * bend;
      th[n] = h / sum;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  surface(S);
  const { dx, dy, th, light, tmp, thick } = S;
  light.fill(0);
  // Shoot: every ray lands where its node's bend carries it and leaves a
  // quarter of an LED's worth of light, split over the four LEDs round it.
  const span = (W + 2 * M) / RS, spanY = (H + 2 * M) / RS;
  for (let j = 0; j <= spanY; j++) {
    const ry = -M + j * RS, gy = ry + M, y0 = floor(gy), fy = gy - y0;
    if (y0 >= GH - 1) continue;
    for (let i = 0; i <= span; i++) {
      const rx = -M + i * RS, gx = rx + M, x0 = floor(gx), fx = gx - x0;
      if (x0 >= GW - 1) continue;
      const n = y0 * GW + x0;
      const ax = dx[n] + (dx[n + 1] - dx[n]) * fx, bx = dx[n + GW] + (dx[n + GW + 1] - dx[n + GW]) * fx;
      const ay = dy[n] + (dy[n + 1] - dy[n]) * fx, by = dy[n + GW] + (dy[n + GW + 1] - dy[n + GW]) * fx;
      const X = rx + ax + (bx - ax) * fy - 0.5, Y = ry + ay + (by - ay) * fy - 0.5;
      const xi = floor(X), yi = floor(Y);
      if (xi < -1 || yi < -1 || xi >= W || yi >= H) continue;
      const u = X - xi, v = Y - yi, wgt = RS * RS;
      if (yi >= 0) {
        if (xi >= 0) light[yi * W + xi] += wgt * (1 - u) * (1 - v);
        if (xi + 1 < W) light[yi * W + xi + 1] += wgt * u * (1 - v);
      }
      if (yi + 1 < H) {
        if (xi >= 0) light[(yi + 1) * W + xi] += wgt * (1 - u) * v;
        if (xi + 1 < W) light[(yi + 1) * W + xi + 1] += wgt * u * v;
      }
    }
  }
  // A light 1-2-1 blur each way: the four rays to an LED leave a grain the
  // eye reads as noise rather than glass.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, l = x > 0 ? light[p - 1] : light[p], r = x < W - 1 ? light[p + 1] : light[p];
      tmp[p] = 0.25 * l + 0.5 * light[p] + 0.25 * r;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, u = y > 0 ? tmp[p - W] : tmp[p], d = y < H - 1 ? tmp[p + W] : tmp[p];
      light[p] = 0.25 * u + 0.5 * tmp[p] + 0.25 * d;
      thick[p] = th[(y + M) * GW + x + M];
    }

  // Colour. The glass transmits a pale tint where thin and a deep one where
  // thick; the floor takes that colour in proportion to the light it gets,
  // and focused light runs to white. The firmware raises saturation by 1.62,
  // so the tints go in softer than they come out.
  const c = S.c, hue = 0.965 + S.hue;
  hsv(hue, 0.3, 1, c, 0);
  hsv(hue + 0.012, 0.58, 1, c, 3);
  hsv(hue - 0.03, 0.22, 1, c, 6);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, L = light[p], tk = sm(-0.9, 0.9, thick[p]);
      const tr = c[0] + (c[3] - c[0]) * tk, tg = c[1] + (c[4] - c[1]) * tk, tb = c[2] + (c[5] - c[2]) * tk;
      const lit = 0.58 + 0.42 * min(L, 1.5);
      const hot = sm(1.2, 3.0, L);
      const r = tr * lit * (1 - hot) + c[6] * hot, g = tg * lit * (1 - hot) + c[7] * hot, b = tb * lit * (1 - hot) + c[8] * hot;
      display.setPixel(x, y, min(255, r * 250), min(255, g * 250), min(255, b * 250));
    }
}
