// ===== Patternflow pattern =====
// Title:   Tissot's Indicatrix
// Family:  space
// Idea:    A lattice of equal small circles on a turning sphere, each drawn as the ellipse a map projection makes of it: on Mercator they stay circles but swell towards the top and bottom edges, the row at 80 degrees nearly six times as wide as the equator's, and as the projection blends into an equal-area one the same circles flatten into ellipses that all cover the same area and turn one colour.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Tissot's indicatrix (Nicolas Auguste Tissot, 1859) on the Mercator projection (Gerardus Mercator, 1569) and Lambert's cylindrical equal-area projection (Johann Heinrich Lambert, 1772), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tilt=0..90, Blend=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a circle is cyan at its smallest (the Mercator equator), azure where it covers three times that, violet at 14 times (latitude 75 on Mercator) and pink-magenta from 42 times (latitude 81); its outline is a paler tint of the same colour and the graticule is a dim mauve. The wheel leaves out orange and yellow, which read brown and olive in the dim fills.
// Knob 2: Speed. How fast the sphere turns about its own axis: at 2 ten degrees a second, a whole turn in 36 s and a circle across the 180 degrees of the panel in 18 s. At 0.2 one degree a second, at 3 fifteen.
// Knob 3: Tilt. How far the projection's axis leans from the sphere's, in degrees. At 0 the normal aspect: the graticule is square, the circles glide sideways in nine rows, and the row at 80 degrees is 14 LEDs in radius against 2.5 at the equator. Turned up, the sphere's pole comes down into the panel with the meridians meeting at it, and each circle swells as its path carries it towards the top or bottom edge and shrinks back. At 90 the transverse aspect: the pole sits at the centre and the circles wheel round it.
// Knob 4: Blend. The projection's height, blended from Mercator at 0 to the equal-area cylindrical projection that fits the same box at 1, whose standard parallels are at 55.7 degrees. At 1 a circle on the equator is three times as tall as wide and one at 80 degrees ten times as wide as tall, and every one covers 61 square LEDs; on Mercator they run from 19 to 650. It opens at 0.06, nearly all Mercator.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, asin, atan2, log, tan, PI } = Math;
const TAU = 2 * PI, DEG = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// 180 degrees of longitude across, so 64 / pi LEDs to the radian, and
// Mercator's y = ln tan(pi/4 + phi/2) from -pi to pi down the 128 rows:
// y reaches pi at 85.0511 degrees, the cut Web Mercator makes for its
// square world, and the box is exactly 1:2.
const SC = W / PI, PHIMAX = 2 * Math.atan(Math.exp(PI)) - PI / 2, SMAX = sin(PHIMAX);
// The circles' geodesic radius, and h * k of the equal-area map, in LEDs
// squared per steradian.
const RAD = 7 * DEG, HKEA = (SC * W) / SMAX;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel from lime round through blue and magenta to red, without the
// orange and yellow that turn brown and olive when dim.
const wheel = (f) => 0.22 + 0.8 * (f - floor(f));

// Circle centres: rows every 20 degrees of latitude, each with as many
// circles as fit 20 degrees apart round it, odd rows shifted half a step.
// No two centres are closer than 19.7 degrees, so the 7-degree circles
// never touch. The poles are left out: they are 10 degrees from the 80 row.
const CL = [];
for (let r = -4; r <= 4; r++) {
  const lat = r * 20 * DEG, n = Math.round(18 * cos(lat));
  for (let k = 0; k < n; k++) CL.push([lat, ((k + (r & 1 ? 0.5 : 0)) / n) * TAU]);
}
const NC = CL.length;

export function setup(params) {
  params.s = { spin: 0, hue: 0, speed: 2, tilt: 0, blend: 0.06, rgb: new Float32Array(W * H * 3), col: new Float64Array(3), o: [0, 0] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.tilt = cl(kv[2], 0, 90) * DEG;
  S.blend = cl(kv[3], 0, 1);
  S.spin = (S.spin + d * S.speed * 5 * DEG) % TAU;
}

// A point of the sphere, turned about the sphere's axis, then seen in the
// projection's frame, whose axis leans from the sphere's by the tilt
// towards the middle of the panel: o gets latitude and longitude there.
function rot(S, lat, lon, o) {
  const cp = cos(lat), x0 = cp * cos(lon + S.spin), y0 = cp * sin(lon + S.spin), z0 = sin(lat);
  const ct = cos(S.tilt), st = sin(S.tilt);
  o[0] = asin(cl(-x0 * st + z0 * ct, -1, 1));
  o[1] = atan2(y0, x0 * ct + z0 * st);
}
// Height above the middle row, in LEDs: Mercator blended into the
// equal-area map scaled to the same box.
const yOf = (b, phi) => (1 - b) * SC * log(tan(PI / 4 + phi / 2)) + (b * W * sin(phi)) / SMAX;

// Lines are laid as points, each lighting its four nearest LEDs by how
// close it falls; an LED keeps the brightest.
function plot(S, x, y, c, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy, rgb = S.rgb;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = min(1, (dx ? tx : 1 - tx) * wy * 1.7) * a, p = (yy * W + xx) * 3;
      if (rgb[p] < c[0] * w) rgb[p] = c[0] * w;
      if (rgb[p + 1] < c[1] * w) rgb[p + 1] = c[1] * w;
      if (rgb[p + 2] < c[2] * w) rgb[p + 2] = c[2] * w;
    }
  }
}

// A graticule line, sampled along the sphere and joined on the panel. A
// join is skipped where the line leaves the visible half or the cut.
function gratLine(S, c, lat0, lon0, lat1, lon1, steps) {
  const o = S.o, b = S.blend;
  let px = 0, py = 0, ok = false;
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    rot(S, lat0 + (lat1 - lat0) * u, lon0 + (lon1 - lon0) * u, o);
    const inside = abs(o[0]) < PHIMAX + 0.02 && abs(o[1]) < PI / 2 + 0.05;
    const x = W / 2 + SC * o[1], y = H / 2 - yOf(b, cl(o[0], -1.55, 1.55));
    if (inside && ok && abs(x - px) + abs(y - py) < 20) {
      const m = Math.ceil(Math.hypot(x - px, y - py) * 2.5) || 1;
      for (let e = 1; e <= m; e++) plot(S, px + ((x - px) * e) / m, py + ((y - py) * e) / m, c, 1);
    }
    (px = x), (py = y), (ok = inside);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, col = S.col, b = S.blend, o = S.o;
  rgb.fill(0);
  // The sphere's graticule every 30 degrees, and its poles.
  const gc = [0, 0, 0];
  hsv(wheel(0.85 + S.hue), 0.3, 0.32, gc);
  for (let k = 0; k < 12; k++) gratLine(S, gc, -PI / 2, k * 30 * DEG, PI / 2, k * 30 * DEG, 360);
  for (let k = -2; k <= 2; k++) gratLine(S, gc, k * 30 * DEG, 0, k * 30 * DEG, TAU, 720);
  for (const lat of [PI / 2, -PI / 2]) {
    rot(S, lat, 0, o);
    if (abs(o[0]) < PHIMAX && abs(o[1]) < PI / 2) plot(S, W / 2 + SC * o[1], H / 2 - yOf(b, o[0]), [0.85, 0.85, 0.85], 1);
  }
  // Each circle as its indicatrix: a cylindrical map keeps meridians and
  // parallels square, so the ellipse lies along the panel's axes with
  // semi-axes r k across and r h up, k = SC / cos phi along the parallel
  // and h = dy/dphi along the meridian. On Mercator h = k.
  for (let i = 0; i < NC; i++) {
    rot(S, CL[i][0], CL[i][1], o);
    const ph = o[0], la = o[1];
    if (abs(ph) > PHIMAX || abs(la) > PI / 2 + 0.3) continue;
    const cp = cos(ph), k = SC / cp, h = ((1 - b) * SC) / cp + (b * W * cp) / SMAX;
    const A = RAD * k, B = RAD * h, cx = W / 2 + SC * la, cy = H / 2 - yOf(b, ph);
    // The colour is h k against the equal-area map's, on a log scale from
    // the Mercator equator's 0.32 up to 13.5.
    const tn = cl((log((h * k) / HKEA) + 1.15) / 3.75, 0, 1);
    hsv(wheel(0.35 + 0.44 * tn + S.hue), 0.7, 1, col);
    // A circle fades over the last 4 degrees before the cut, where it is
    // about 20 LEDs across on Mercator, so it does not drop out whole.
    const fade = cl((PHIMAX - abs(ph)) / (4 * DEG), 0, 1);
    const lr = 0.55 + 0.45 * col[0], lg = 0.55 + 0.45 * col[1], lb = 0.55 + 0.45 * col[2];
    const x0 = max(0, floor(cx - A - 1)), x1 = min(W - 1, floor(cx + A + 1)), y0 = max(0, floor(cy - B - 1)), y1 = min(H - 1, floor(cy + B + 1));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        // Distance to the outline in LEDs, to first order: (rho - 1) / |grad rho|.
        const qx = (xx + 0.5 - cx) / A, qy = (yy + 0.5 - cy) / B, r2 = qx * qx + qy * qy, r = sqrt(r2) || 1e-9;
        const dist = (r - 1) / (sqrt((qx / A) ** 2 + (qy / B) ** 2) / r || 1);
        const line = cl(1 - abs(dist) / 0.8, 0, 1), fill = dist < 0 ? cl(-dist, 0, 1) * (0.16 + 0.14 * (1 - r2)) : 0;
        const v = max(line, fill) * fade;
        if (v <= 0) continue;
        const p = (yy * W + xx) * 3, pale = line > fill;
        const cr = (pale ? lr : col[0]) * v, cg = (pale ? lg : col[1]) * v, cb = (pale ? lb : col[2]) * v;
        if (rgb[p] < cr) rgb[p] = cr;
        if (rgb[p + 1] < cg) rgb[p + 1] = cg;
        if (rgb[p + 2] < cb) rgb[p + 2] = cb;
      }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, (255 * cl(rgb[p], 0, 1)) | 0, (255 * cl(rgb[p + 1], 0, 1)) | 0, (255 * cl(rgb[p + 2], 0, 1)) | 0);
}
