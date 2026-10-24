// ===== Patternflow pattern =====
// Title:   Soap Film
// Family:  cosmetic
// Idea:    A soap film fills the panel and drains, thinner toward the top, so Newton's interference colours stack in bands that sink while slow eddies wind them into spirals, thin film pulled from the sides rises in plumes and the black film spreads down from the top, until the film bursts and a new one is drawn up from the bottom.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 39, after the film of a foaming cleanser stretched across a ring, coloured by thin-film interference in Newton's colour series (Isaac Newton, Opticks, 1704) and thinning from the top as it drains
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Light=0..1, Swirl=0..1
//
// Knob 1: Hue. Turns every colour of the film round the grey axis together; the black film stays grey. At 0 Newton's own colours: a gold and cream band of the first order under the black film, then indigo, blue, yellow, orange and magenta, then pastel greens and pinks lower down. At 0.25 the first-order band is green, at 0.5 sky blue, at 0.75 magenta, the rest following. Orange, yellow and lime that come out dark are lifted most of the way to full and paled a little, so they read amber, gold or lime and never brown or olive, and no colour of the film falls below a fifth.
// Knob 2: Speed. At 2 the film opens 2 s into its drainage; the black film appears at the top within a second and comes down 7.7 LEDs a second, past the middle by 9 s, while the bottom thins from 950 nm when drawn to 550 six seconds later. When the black film is 68% of the way down, 11.8 s in, the film bursts: a hole opens near the top and its rim runs across the panel in 0.9 s throwing spray, the panel stays dark 0.4 s and a new film is drawn up from the bottom in 1.2 s, 15 s round after the first. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Light. The wall behind the film, black at 0, so the black film reads black. Turned up, a white wall shows through wherever the film reflects little: the black film and the hole of a burst go grey and then white, and the colours pale toward pastel; at 1 a pearly white sheet with pastel bands.
// Knob 4: Swirl. How hard the eddies spin. One starts every 1.1 to 2.1 s somewhere in the film, 9 to 17 LEDs across its core, and spins up and down over 4 to 8 s; the film keeps the twist and drainage sorts it back into layers over about 8 s. At 0 an eddy winds the bands most of a turn at its core, at the start about one turn, at 1 two and a half, curling the gold edge of the black film into spirals.
// Buttons: K1 tap bursts the film now, and a new one is drawn up after it.

const W = 64, H = 128, N = W * H;
// Film index, and the thickness table in nm.
const NF = 1.33, HMAX = 1400;
// Thinner than this the film is black film, nm.
const BLACK = 30;
// Seconds of drainage at Speed 2 before the first frame.
const AGE0 = 2;
// Gain and gamma of the table.
const GAIN = 0.95, GAM = 0.8;
const { floor, min, max, abs, sqrt, exp, sin, cos, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// CIE 1931 colour matching, the piecewise Gaussian fit of Wyman, Sloan and
// Shirley (2013).
const g1 = (l, m, a, b) => {
  const t = (l - m) / (l < m ? a : b);
  return exp(-0.5 * t * t);
};
const cmf = (l) => [
  1.056 * g1(l, 599.8, 37.9, 31) + 0.362 * g1(l, 442, 16, 26.7) - 0.065 * g1(l, 501.1, 20.4, 26.2),
  0.821 * g1(l, 568.8, 46.9, 40.5) + 0.286 * g1(l, 530.9, 16.3, 31.1),
  1.217 * g1(l, 437, 11.8, 36) + 0.681 * g1(l, 459, 26, 13.8),
];
const toRGB = (X, Y, Z) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];

// Reflectance of a film h nm thick, two beams: the front face reflects with
// r = (1 - n) / (1 + n) and the back with -r, a half wave apart, so
// R = 4 r^2 sin^2(2 pi n h / lambda), zero as h goes to zero. Summed over
// 400 to 700 nm in 10 nm steps against an equal-energy light and divided by
// the full white, so a film reflecting every wavelength fully is 1, 1, 1.
function baseTable() {
  const L = [], C = [];
  for (let l = 400; l <= 700; l += 10) L.push(l), C.push(cmf(l));
  let wx = 0, wy = 0, wz = 0;
  for (const c of C) (wx += c[0]), (wy += c[1]), (wz += c[2]);
  const wr = toRGB(wx, wy, wz);
  const T = new Float32Array(HMAX * 3);
  for (let h = 0; h < HMAX; h++) {
    let X = 0, Y = 0, Z = 0;
    for (let i = 0; i < L.length; i++) {
      const s = sin((2 * PI * NF * h) / L[i]), R = s * s;
      X += R * C[i][0];
      Y += R * C[i][1];
      Z += R * C[i][2];
    }
    const c = toRGB(X, Y, Z);
    for (let k = 0; k < 3; k++) T[h * 3 + k] = max(0, c[k] / wr[k]);
  }
  return T;
}

function hsvOf(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, mx > 0 ? d / mx : 0, mx];
}
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
}

// The table as the panel shows it: turned round the grey axis by the hue,
// a light gamma, and paled toward a white wall behind as Light turns up.
function displayTable(S) {
  const B = S.base, D = S.lut, a = 2 * PI * S.hue, ca = cos(a), sa = sin(a), k = (1 - ca) / 3, q = sa / sqrt(3);
  const m = [ca + k, k - q, k + q, k + q, ca + k, k - q, k - q, k + q, ca + k];
  const lw = S.light, tmp = [0, 0, 0];
  for (let h = 0; h < HMAX; h++) {
    const r = B[h * 3], g = B[h * 3 + 1], b = B[h * 3 + 2];
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let R, G, Bb;
    if (h < BLACK) {
      // Black film keeps its cool grey whatever the hue.
      const v = (GAIN * Y) ** GAM;
      (R = 0.85 * v), (G = 0.93 * v), (Bb = 1.1 * v);
    } else {
      R = min(1, max(0, m[0] * r + m[1] * g + m[2] * b) * GAIN) ** GAM;
      G = min(1, max(0, m[3] * r + m[4] * g + m[5] * b) * GAIN) ** GAM;
      Bb = min(1, max(0, m[6] * r + m[7] * g + m[8] * b) * GAIN) ** GAM;
      // No colour of the film itself falls below a fifth; and orange, yellow
      // and lime that come out dark, which read brown or olive, are lifted
      // most of the way to full and paled a little.
      const [hh, ss, vv] = hsvOf(R, G, Bb), warm = cl(1.4 - abs(hh - 0.15) / 0.12, 0, 1) * sm(0.97, 0.6, vv);
      const v2 = 0.2 + 0.8 * vv;
      hsv(hh, ss * (1 - 0.3 * warm), v2 + (0.95 - v2) * warm, tmp, 0);
      (R = tmp[0]), (G = tmp[1]), (Bb = tmp[2]);
    }
    // A white wall behind shows through where the film reflects little.
    const wl = lw * (0.35 + 0.65 * (1 - min(1, Y)));
    D[h * 3] = 250 * (R + (1 - R) * wl);
    D[h * 3 + 1] = 250 * (G + (1 - G) * wl);
    D[h * 3 + 2] = 250 * (Bb + (1 - Bb) * wl);
  }
}

const hash = (n) => {
  const s = sin(n * 12.9898) * 43758.5453;
  return s - floor(s);
};

// Smooth value noise on a 64 x 64 lattice that wraps.
function noise(L, x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 63, y0 = yi & 63, x1 = (x0 + 1) & 63, y1 = (y0 + 1) & 63;
  const a = L[y0 * 64 + x0], b = L[y0 * 64 + x1], c = L[y1 * 64 + x0], d = L[y1 * 64 + x1];
  return a + (b - a) * ux + (c - a + (d - c - b + a) * ux) * uy;
}

export function setup(params) {
  const L = new Float32Array(64 * 64);
  for (let i = 0; i < L.length; i++) L[i] = random() * 2 - 1;
  params.s = {
    hue: -1, light: -1, speed: 2, swirl: 0, begun: false, t: 0, age: 0,
    base: baseTable(), lut: new Float32Array(HMAX * 3), L,
    MX: new Float32Array(N), MY: new Float32Array(N), T: new Float32Array(N),
    NX: new Float32Array(N), NY: new Float32Array(N), NT: new Float32Array(N),
    eddies: [], nextEddy: 0, nextPlume: 0, side: false, hole: null, draw: 0,
  };
  reset(params.s);
}

// A fresh film: every point where it was drawn, nothing thin in it yet.
function reset(S) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      S.MX[y * W + x] = x;
      S.MY[y * W + x] = y;
    }
  S.T.fill(0);
  S.age = 0;
}

function spawnEddy(S) {
  S.eddies.push({
    x: 8 + random() * 48, y: 16 + random() * 104, R: 9 + random() * 8,
    w: (random() < 0.5 ? -1 : 1) * (0.7 + 0.6 * random()), age: 0, life: 4 + 4 * random(),
    vx: (random() - 0.5) * 3, vy: (random() - 0.3) * 3,
  });
}

// Thin film pulled out of the border at the sides, which then rises.
function spawnPlume(S, front) {
  S.side = !S.side;
  const x0 = S.side ? 0.5 + random() * 3 : W - 1.5 - random() * 3;
  const y0 = H * (front + (1 - front) * (0.25 + 0.75 * random())), r = 2 + random() * 1.5, a = 0.7 + 0.3 * random();
  for (let y = max(0, floor(y0 - 7 * r)); y <= min(H - 1, y0 + 7 * r); y++)
    for (let x = max(0, floor(x0 - 3 * r)); x <= min(W - 1, x0 + 3 * r); x++) {
      const d2 = ((x - x0) ** 2 + ((y - y0) * 0.4) ** 2) / (r * r), p = y * W + x;
      S.T[p] = min(1, S.T[p] + a * exp(-d2));
    }
}

function bilerp(A, x, y) {
  x = cl(x, 0, W - 1.001);
  y = cl(y, 0, H - 1.001);
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi, p = yi * W + xi;
  const a = A[p], b = A[p + 1], c = A[p + W], d = A[p + W + 1];
  return a + (b - a) * fx + (c - a + (d - c - b + a) * fx) * fy;
}

// Where the black film reaches, 0 at the top and 1 at the bottom, for a
// film of this age.
const frontAt = (age) => cl((age - 2.5) * 0.06, 0, 1);

function step(S, d) {
  S.t += d;
  S.age += d;
  const front = frontAt(S.age);
  // Eddies: each spins up and down over its life; the film keeps the twist.
  if (S.t > S.nextEddy) {
    spawnEddy(S);
    S.nextEddy = S.t + 1.1 + random();
  }
  for (const e of S.eddies) {
    e.age += d;
    e.x += e.vx * d;
    e.y += e.vy * d;
  }
  S.eddies = S.eddies.filter((e) => e.age < e.life);
  if (S.t > S.nextPlume && !S.draw && !S.hole) {
    spawnPlume(S, front);
    S.nextPlume = S.t + 0.12 + 0.12 * random();
  }
  const { MX, MY, T, NX, NY, NT, L } = S, sw = 1.4 + 2.6 * S.swirl, t = S.t;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // Fine turbulence everywhere, two noise fields as the flow.
      const n1 = noise(L, x * 0.21 + t * 0.4, y * 0.21 - t * 0.3), n2 = noise(L, x * 0.21 + 17.3 - t * 0.35, y * 0.21 + 9.1 + t * 0.25);
      let vx = 2.2 * n1, vy = 2.2 * n2;
      for (const e of S.eddies) {
        const dx = x - e.x, dy = y - e.y, r2 = dx * dx + dy * dy, R2 = e.R * e.R;
        if (r2 > 6 * R2) continue;
        const env = sin((PI * e.age) / e.life), om = sw * e.w * env * exp(-r2 / R2);
        vx -= om * dy;
        vy += om * dx;
      }
      const qx = x - vx * d, qy = y - vy * d;
      NX[p] = bilerp(MX, qx, qy);
      NY[p] = bilerp(MY, qx, qy);
      // Thin film from the border is lighter and rises through the rest.
      NT[p] = bilerp(T, qx, qy + 15 * T[p] * d) * (1 - 0.1 * d);
    }
  // Drainage sorts the film back into layers: every point eases toward where
  // it is, over about 8 s.
  const rx = 1 - exp(-d / 8);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      MX[p] = NX[p] + (x - NX[p]) * rx;
      MY[p] = NY[p] + (y - NY[p]) * rx;
      T[p] = NT[p];
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.speed = cl(k[1], 0.2, 3);
  S.swirl = cl(k[3], 0, 1);
  const hue = k[0] - floor(k[0]), light = cl(k[2], 0, 1);
  if (abs(hue - S.hue) > 1e-3 || abs(light - S.light) > 1e-3) {
    S.hue = hue;
    S.light = light;
    displayTable(S);
  }
  if (!S.begun) {
    S.begun = true;
    for (let i = 0; i < AGE0 * 10; i++) step(S, 0.1);
  }
  if (input.btnPressed && input.btnPressed[0] && !S.hole) S.hole = { x: 10 + random() * 44, y: 4 + random() * 10, r: 0, gap: 0 };
  const sd = (d * S.speed) / 2;
  if (!S.hole && frontAt(S.age) > 0.68) S.hole = { x: 10 + random() * 44, y: 4 + random() * 10, r: 0, gap: 0 };
  if (S.hole) {
    const o = S.hole;
    if (o.r < 160) o.r += 180 * sd;
    else {
      o.gap += sd;
      if (o.gap > 0.4) {
        reset(S);
        S.hole = null;
        S.draw = 1;
      }
    }
  }
  if (S.draw > 0) S.draw = max(0, S.draw - sd / 1.2);
  step(S, sd);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { MX, MY, T, L, lut } = S, age = S.age, t = S.t;
  const front = frontAt(age);
  // Thickness at the bottom and just under the black film, nm.
  const hb = 950 / sqrt(1 + age / 3), ht = 90 + 260 * exp(-age / 1.2);
  const o = S.hole, dy = S.draw > 0 ? H * S.draw : -1, bgv = 255 * S.light;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (o && (x - o.x) ** 2 + (y - o.y) ** 2 < o.r * o.r) {
        display.setPixel(x, y, round(bgv * 0.95 + 4), round(bgv * 0.95 + 4), round(bgv * 0.97 + 7));
        continue;
      }
      if (y < dy) {
        display.setPixel(x, y, round(bgv * 0.95 + 4), round(bgv * 0.95 + 4), round(bgv * 0.97 + 7));
        continue;
      }
      // Where this bit of film sat when the film was layered, and how much
      // thin film from the border it carries.
      const mx = MX[p], my = MY[p];
      let u = my / (H - 1) - 0.2 * T[p];
      if (dy >= 0) u = (u - S.draw) / (1 - S.draw);
      const edge = front - 0.02 + 0.025 * noise(L, mx * 0.09 + 31, t * 0.15), e0 = max(0, edge);
      let h;
      if (u < edge) {
        // Black film, 1 to 21 nm, reflecting next to nothing.
        h = 11 + 6 * noise(L, mx * 0.45 + 5, my * 0.45) + 4 * noise(L, mx * 1.2 + 23, my * 1.2 - t * 0.3);
      } else {
        const s = cl((u - e0) / (1 - e0), 0, 1);
        h = ht + (hb - ht) * s ** 0.8;
        h += 16 * noise(L, mx * 0.75 + 40, my * 0.75) + 6 * noise(L, x * 0.55 + t * 0.6, y * 0.55);
      }
      h = cl(h, 0, HMAX - 2);
      const hi = floor(h), f = h - hi, a = hi * 3;
      let r = lut[a] + (lut[a + 3] - lut[a]) * f, g = lut[a + 1] + (lut[a + 4] - lut[a + 1]) * f, b = lut[a + 2] + (lut[a + 5] - lut[a + 2]) * f;
      if (o) {
        // The rim the burst gathers, running out ahead of the hole, and the
        // spray it throws.
        const dr = Math.hypot(x - o.x, y - o.y) - o.r;
        let rim = dr < 4 ? exp(-dr * 0.7) : 0;
        if (dr < 9 && hash(x * 7 + y * 131 + floor(o.r) * 17) > 0.9) rim = max(rim, 1 - dr / 9);
        r += (250 - r) * rim;
        g += (250 - g) * rim;
        b += (255 - b) * rim;
      }
      display.setPixel(x, y, round(cl(r, 0, 255)), round(cl(g, 0, 255)), round(cl(b, 0, 255)));
    }
}
