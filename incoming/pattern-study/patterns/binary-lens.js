// ===== Patternflow pattern =====
// Title:   Binary Lens
// Family:  space
// Idea:    Two point masses on a tilted circular orbit lens the sky behind them, and the panel is their magnification map in the source plane by inverse ray shooting, dim blue with contours of equal magnification and bright caustic folds that meet in cusps and change, as the pair swings from upright to lying across, from two astroids to one six-cusp loop to a small central caustic with two triangles, while a star drifts over the map and its light curve scrolls along the bottom with a spike at every fold it crosses.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: gravitational lensing by two point masses (Peter Schneider and Alfred Weiss, 1986), inverse ray shooting (Joachim Wambsganss, Peter Schneider and Bohdan Paczynski, 1986), the three caustic topologies of the binary lens (Hans Erdl and Peter Schneider, 1993), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mass ratio=0.2..1, Orbit=15..60
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the map is deep blue where nothing is magnified, violet inside the caustics and nearly white on the folds, with teal contours and a green star and light curve; at 0.25 the map is magenta with green folds, at 0.5 green, at 0.75 teal with blue folds. The wheel runs from green to magenta and skips red, orange and lime, which read maroon, brown and olive when dim.
// Knob 2: Speed. 2 is real time: the star crosses the map at 1.2 Einstein radii, 34 LEDs, a second, the light curve holds the last 6.4 s, and at the bottom of Orbit the pair goes round in 24 s; 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Mass ratio. q = m2 / m1 from 0.2 to 1, the masses adding to 1. At 0.2 the masses are 0.83 and 0.17 and the caustics are lopsided: the loop is a bent triangle, the lighter mass has the smaller astroid in the wide pair, and the topology changes at separations 0.74 and 1.82. At 1 the pair is equal, the caustics are symmetric and the changes come at 0.71 and 2, as Erdl and Schneider found.
// Knob 4: Orbit. How fast the pair goes round its circle, 15 to 60 degrees a second: once in 24 s at 15, once in 6 s at 60. The circle has radius 2.3 and is tilted 76 degrees, so the separation on the sky runs from 2.3 with the pair upright, two astroids one above the other, to 0.54 lying across, a small central caustic with two triangles above and below; with equal masses the pair spends 34% of its turn wide, 53% in the six-cusp loop and 13% close, swinging fast through the close part. At 15 the opening shows the loop, the close pair at about 2 s and the wide pair from 6 s.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The map: rows 0 to 99, 28 LEDs to the Einstein radius of the total mass,
// centred on the centre of mass. The light curve fills rows 102 to 127.
const MH = 100, PX = 28, MX = 32, MY = 50, CY0 = 102, CH = 26;
// Rays: an image-plane grid 2 to the LED each way, so a patch with no
// lensing gets 4 rays per LED. Each ray is split over the four LEDs round
// where it lands. With a whole number of rays to the LED that split sums
// to the same on every LED, so the grid leaves no moire where the lensing
// is weak: a first try that dropped each ray into one cell of a grid twice
// as fine, at 2.3 rays to the LED, drew dark arcs 5 LEDs apart all over
// the dim parts. The grid spreads past the map by a margin that holds the
// images of its edge: a source 1.1 Einstein radii out has its bright image
// 0.6 further out, and a mass 1.9 out holds images 0.4 beyond itself.
const SUB = 2, HX = 1.8, HY = 2.35, STEP = 1 / (PX * SUB);
const NX = Math.ceil((2 * HX) / STEP), NY = Math.ceil((2 * HY) / STEP);
// The counts carry a border one LED wide, so the edge LEDs get their whole
// share.
const PW = W + 2, PH = MH + 2;
// The orbit: a circle of radius A Einstein radii seen tilted, cos i = CI,
// with its long axis along the panel's long axis. The projected
// separation runs from A = 2.3 when the pair stands upright (two astroids
// one above the other) to A CI = 0.54 when it lies across (the two small
// triangles then sit above and below the central caustic). Both fit the
// tall map, 1.8 from the centre to its top: the wide pair's astroids reach
// 1.7 at q = 0.2 and the close pair's triangles 1.5 at q = 1.
const A = 2.3, CI = 0.235;
// The light curve: one column every 0.1 s, log magnification from 1 to 16.
const COL_DT = 0.1, MU_TOP = 16;
// Contours of the map, a factor 1.12 apart.
const CSTEP = log(1.12);
// The star crosses the map at 1.2 Einstein radii a second. Its
// magnification is the rays landing on a soft disk 2 LEDs in radius.
const VSRC = 1.2, RSRC = 2 / PX;
// The star's trail on the map: its last 10 places, 1 s.
const TRAIL = 10;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// The knob turns hues on a wheel from green through blue and violet to
// magenta, which skips red, orange and lime: dim, they read maroon, brown
// and olive.
const wheel = (h) => 0.3 + 0.56 * (h - floor(h));

export function setup(params) {
  params.s = {
    t: 0, ready: false, drawn: false, phi: 0, q: 0.2, om: 15, hue: 0, half: 0,
    // Two half-grids of ray counts, one shot each frame, and the star's
    // count from each.
    cnt: [new Float32Array(PW * PH), new Float32Array(PW * PH)], star: [1, 1],
    mu: new Float32Array(W * MH), lm: new Float32Array(W * MH), tmp: new Float32Array(W * MH), c3: [0, 0, 0],
    lut: new Float32Array(256 * 3),
    curve: new Float32Array(W), colSum: 0, colN: 0, colT: 0, tx: new Float32Array(TRAIL), ty: new Float32Array(TRAIL),
    sx: 0, sy: 0, vx: 0, vy: 0,
    rgb: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
}

// A new crossing: in at a random point of the map's edge, aimed at a
// point within 0.7 Einstein radii of the centre.
function newTrack(S) {
  const ex = MX / PX, ey = MY / PX, side = floor(Math.random() * 4);
  let x, y;
  if (side < 2) {
    x = (Math.random() * 2 - 1) * ex;
    y = side ? ey : -ey;
  } else {
    y = (Math.random() * 2 - 1) * ey;
    x = side === 2 ? ex : -ex;
  }
  const ax = (Math.random() * 2 - 1) * 0.7, ay = (Math.random() * 2 - 1) * 0.7;
  const dx = ax - x, dy = ay - y, l = sqrt(dx * dx + dy * dy);
  S.sx = x;
  S.sy = y;
  S.vx = (dx / l) * VSRC;
  S.vy = (dy / l) * VSRC;
}

// The masses: the centre of mass at the origin, m1 + m2 = 1.
function lenses(S) {
  const m1 = 1 / (1 + S.q), m2 = S.q / (1 + S.q), dx = A * CI * sin(S.phi), dy = A * cos(S.phi);
  return { m1, m2, x1: -dx * m2, y1: -dy * m2, x2: dx * m1, y2: dy * m1 };
}

// Shoot every stride-th row of the ray grid starting at row off, through
// the lens equation zeta = z - sum m_i / conj(z - z_i), which in real
// numbers is zeta = z - sum m_i (z - z_i) / |z - z_i|^2. Each ray is split
// over four LEDs of cnt (if given) and adds a weight (1 - r^2 / R^2)^2 to
// the star if it lands within R of it; the return value is the star's
// magnification.
function shoot(S, L, cnt, off, stride) {
  const { m1, m2, x1, y1, x2, y2 } = L, sx = S.sx, sy = S.sy, r2 = RSRC * RSRC, ir2 = 1 / r2;
  const ox = MX + 0.5, oy = MY + 0.5;
  let star = 0;
  for (let j = off; j < NY; j += stride) {
    const y = -HY + (j + 0.5) * STEP, dy1 = y - y1, dy2 = y - y2, e1 = dy1 * dy1, e2 = dy2 * dy2;
    let x = -HX + 0.5 * STEP;
    for (let i = 0; i < NX; i++, x += STEP) {
      const dx1 = x - x1, dx2 = x - x2;
      const k1 = m1 / (dx1 * dx1 + e1), k2 = m2 / (dx2 * dx2 + e2);
      const zx = x - k1 * dx1 - k2 * dx2, zy = y - k1 * dy1 - k2 * dy2;
      const ux = zx - sx, uy = zy - sy, u2 = ux * ux + uy * uy;
      if (u2 < r2) {
        const w = 1 - u2 * ir2;
        star += w * w;
      }
      if (!cnt) continue;
      const px = zx * PX + ox, py = zy * PX + oy;
      // Written this way round so a ray that hits a mass dead on (NaN) is
      // dropped too.
      if (!(px >= 0 && py >= 0 && px < PW - 1 && py < PH - 1)) continue;
      const ix = px | 0, iy = py | 0, fx = px - ix, fy = py - iy, o = iy * PW + ix, gx = 1 - fx;
      cnt[o] += gx * (1 - fy);
      cnt[o + 1] += fx * (1 - fy);
      cnt[o + PW] += gx * fy;
      cnt[o + PW + 1] += fx * fy;
    }
  }
  // Rays per unit area of the image plane, for the rows shot, against the
  // soft disk's area pi R^2 / 3.
  return star / ((PI * r2) / 3 / (STEP * STEP * stride));
}

// A box 5 LEDs wide, across and then down, in place.
function blur(a, t) {
  for (let y = 0; y < MH; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let k = max(0, x - 2); k <= min(W - 1, x + 2); k++, n++) s += a[r + k];
      t[r + x] = s / n;
    }
  }
  for (let x = 0; x < W; x++)
    for (let y = 0; y < MH; y++) {
      let s = 0, n = 0;
      for (let k = max(0, y - 2); k <= min(MH - 1, y + 2); k++, n++) s += t[k * W + x];
      a[y * W + x] = s / n;
    }
}

function step(S, dt) {
  S.t += dt;
  // A circular orbit keeps an even pace in its own plane; seen tilted, the
  // pair swings fast across the panel when close and slowly when upright.
  S.phi += ((S.om * PI) / 180) * dt;
  S.sx += S.vx * dt;
  S.sy += S.vy * dt;
  if (abs(S.sx) > MX / PX + 0.1 || abs(S.sy) > MY / PX + 0.1) newTrack(S);
}

function pushColumn(S, mu) {
  S.curve.copyWithin(0, 1);
  S.curve[W - 1] = mu;
  S.tx.copyWithin(0, 1);
  S.ty.copyWithin(0, 1);
  S.tx[TRAIL - 1] = S.sx;
  S.ty[TRAIL - 1] = S.sy;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.2, 15], dd = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3);
  S.q = cl(kv[2], 0.2, 1);
  S.om = cl(kv[3], 15, 60);
  if (!S.ready) {
    // The first frame runs the 6.4 s the light curve holds, with every
    // fourth row of the grid and only the star's count.
    S.ready = true;
    S.t = -W * COL_DT;
    // At t = 0 the orbit is 60 degrees on from upright, so the opening
    // seconds go from the six-cusp loop to the close pair lying across, at
    // 2 s with the Orbit knob at the bottom, and back out.
    S.phi = ((60 - S.om * W * COL_DT) * PI) / 180;
    newTrack(S);
    for (let k = 0; k < W; k++) {
      step(S, COL_DT);
      pushColumn(S, shoot(S, lenses(S), null, k % 4, 4));
    }
  }
  const h = (dd * speed) / 2;
  step(S, h);
  S.colT += h;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const L = lenses(S), rgb = S.rgb, hue = S.hue;
  // This frame's half of the grid; the other half is the last frame's.
  for (let k = 0; k < (S.drawn ? 1 : 2); k++) {
    const f = S.cnt[S.half];
    f.fill(0);
    S.star[S.half] = shoot(S, L, f, S.half, 2);
    S.half ^= 1;
  }
  S.drawn = true;
  const muStar = (S.star[0] + S.star[1]) / 2;
  S.colSum += muStar;
  S.colN++;
  while (S.colT >= COL_DT) {
    pushColumn(S, S.colSum / S.colN);
    S.colT -= COL_DT;
    S.colSum = muStar;
    S.colN = 1;
  }
  // Magnification: rays per LED over the rays per LED with no lens.
  const c0 = S.cnt[0], c1 = S.cnt[1], mu = S.mu, norm = 1 / (SUB * SUB);
  for (let y = 0; y < MH; y++)
    for (let x = 0, o = (y + 1) * PW + 1; x < W; x++, o++) mu[y * W + x] = (c0[o] + c1[o]) * norm;
  // Colours by log magnification: deep blue at 1, violet inside the
  // caustics where there are five images and the magnification is 3 or
  // more, nearly white on the folds.
  const lut = S.lut;
  for (let i = 0; i < 256; i++) {
    const l = i / 255;
    hsv(wheel(0.56 + hue + 0.3 * l), 0.9 - 0.7 * l * l, 0.13 + 0.87 * l ** 0.8, lut, i * 3);
  }
  const kl = 255 / log(MU_TOP), lm = S.lm;
  for (let p = 0; p < W * MH; p++) {
    const m = mu[p], i = m > 1 ? min(255, (log(m) * kl) | 0) : 0, o = p * 3, q = i * 3;
    lm[p] = log(max(m, 0.05)) / CSTEP;
    rgb[o] = lut[q];
    rgb[o + 1] = lut[q + 1];
    rgb[o + 2] = lut[q + 2];
  }
  // Contours of equal magnification outside the caustics, every 12%, so the
  // dim part of the map shows its slope: wide loops round the pair far out,
  // closing in and bending where the caustics pull them.
  // The contours are read from the map smoothed twice by a box 5 LEDs
  // wide: raw, the few rays to an LED make them speckle.
  blur(lm, S.tmp);
  blur(lm, S.tmp);
  const cc = hsv(wheel(0.4 + hue), 0.6, 1, S.c3, 0), top = log(2.6) / CSTEP;
  for (let y = 1; y < MH - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, f = lm[p];
      if (f > top || f < 0.7) continue;
      const gx = (lm[p + 1] - lm[p - 1]) / 2, gy = (lm[p + W] - lm[p - W]) / 2, g = sqrt(gx * gx + gy * gy);
      if (g < 1e-3) continue;
      const e = abs(f - Math.round(f)) / g, v = 1 - e / 0.7;
      if (v <= 0) continue;
      const k = v * 0.2 * min(1, (top - f) / 1.5), o = p * 3;
      rgb[o] += cc[0] * k;
      rgb[o + 1] += cc[1] * k;
      rgb[o + 2] += cc[2] * k;
    }
  rgb.fill(0, W * MH * 3);
  const add = (x, y, c, v) => {
    if (x < 0 || x >= W || y < 0 || y >= H || v <= 0) return;
    const o = (y * W + x) * 3;
    rgb[o] += c[0] * v;
    rgb[o + 1] += c[1] * v;
    rgb[o + 2] += c[2] * v;
  };
  const dot = (cx, cy, rad, c, pk) => {
    for (let y = floor(cy - rad); y <= cy + rad; y++)
      for (let x = floor(cx - rad); x <= cx + rad; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, q = (dx * dx + dy * dy) / (rad * rad);
        if (q < 1 && y < MH) add(x, y, c, pk * (1 - q) * (1 - q));
      }
  };
  // The two masses, small and grey, the heavier one larger.
  const g = [0.7, 0.7, 0.7];
  dot(L.x1 * PX + MX, L.y1 * PX + MY, 1.2 + 0.8 * L.m1, g, 0.45);
  dot(L.x2 * PX + MX, L.y2 * PX + MY, 1.2 + 0.8 * L.m2, g, 0.45);
  // The star and its trail.
  const sc = hsv(wheel(0.18 + hue), 0.55, 1, S.c, 0);
  for (let k = 1; k < TRAIL; k++) {
    const ax = S.tx[k - 1], ay = S.ty[k - 1], bx = k < TRAIL - 1 ? S.tx[k] : S.sx, by = k < TRAIL - 1 ? S.ty[k] : S.sy;
    if ((bx - ax) ** 2 + (by - ay) ** 2 > 0.09) continue;
    for (let s = 0; s < 4; s++) {
      const f = s / 4, x = (ax + (bx - ax) * f) * PX + MX, y = (ay + (by - ay) * f) * PX + MY;
      dot(x, y, 1.2, sc, 0.22 * (k / TRAIL) ** 2);
    }
  }
  dot(S.sx * PX + MX, S.sy * PX + MY, 2.4, sc, 1.6);
  // The light curve: log magnification, a filled column per 0.1 s, the
  // newest on the right.
  const lt = log(MU_TOP);
  for (let x = 0; x < W; x++) {
    const v = cl(log(max(1, S.curve[x])) / lt, 0, 1) * (CH - 1) + 1;
    for (let r = 0; r < CH; r++) {
      const cover = cl(v - r, 0, 1);
      if (cover <= 0) break;
      const top = v - r < 1.5;
      add(x, CY0 + CH - 1 - r, sc, cover * (top ? 0.95 : 0.16 + 0.22 * (r / CH)));
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3) {
    const pk = max(1, rgb[o], rgb[o + 1], rgb[o + 2]), k = 255 / pk;
    display.setPixel(p % W, (p / W) | 0, (rgb[o] * k) | 0, (rgb[o + 1] * k) | 0, (rgb[o + 2] * k) | 0);
  }
}
