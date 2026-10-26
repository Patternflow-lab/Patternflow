// ===== Patternflow pattern =====
// Title:   Rayleigh-Taylor
// Family:  sim
// Idea:    A heavy fluid rests on a light one across the middle of the panel, and the faint ripple on the line between them grows until heavy fingers fall to the bottom with mushroom caps that curl at their rims while light bubbles rise to the top, the two fluids churning into each other until a fresh layer settles in.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rayleigh-Taylor instability (Lord Rayleigh, 1883; G. I. Taylor, 1950), Boussinesq vorticity-streamfunction flow, pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Modes=3..9, Viscosity=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the heavy fluid is orchid violet, the light fluid dark teal, fluid mixed half and half azure, and the sharp line between them pale lilac; at 0.25 orange over indigo through purple, at 0.5 green over dark magenta through red, at 0.75 sky blue over dark green through green. The light fluid and the mixture skip the orange and yellow part of the wheel, which reads brown and olive when dim.
// Knob 2: Speed. At 2 the opening ripple grows by e every 0.54 s, the mushroom caps curl over about 3 s into a layer, the heavy fingers reach the floor and the light bubbles the lid between 5 and 6.5 s, and at 8.6 s the churned column fades over 1 s into a fresh layer. At 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Modes. How many half waves of the first ripple fit across the box, 3 to 9, rounded; each layer also carries the next wave up and the next down at under a third of the size, so the fingers come out unequal. At 3 two heavy fingers fall and two light bubbles rise, 43 LEDs apart, one of each against a wall; at 9 five thin ones of each, 14 LEDs apart. The shorter waves grow faster, by e in 0.54 s at 3, 0.41 s at 6 and 0.37 s at 9, where the square root of A g k alone would give 0.49, 0.35 and 0.28 s: the line between the fluids is 2 LEDs thick, which slows a short wave more than a long one. A new value starts a fresh layer.
// Knob 4: Viscosity. nu = 0.1 x 400^K4 LEDs squared a second, and the density diffuses at a quarter of that plus 0.05: nu is 0.14 at the opening 0.06, 2 at 0.5 and 40 at 1. At the opening the caps roll up into tight curls and the stems shed small ones; at 0.5 the fingers fall as smooth tongues with one curl each; at 1 a ripple of three half waves grows by e only every 1.3 s, one of six dies away, and soft blurred fingers sag into each other.
// Buttons: K1 tap starts a fresh layer.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, sin, cos, sqrt, round, abs, tanh, random, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Units: one LED and one second at Speed 2. G is the reduced gravity A g,
// in LEDs per second squared; the heavy fluid is rho = +1, the light -1.
const G = 28;
const Y0 = 63.5, DELTA = 1, A0 = 0.25;
const CYCLE = 8.6, FADE = 1;
const NU0 = 0.1, NUR = 400;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The box has free-slip walls on all four sides: the side walls at column
// 0 and at column 64, one past the panel's edge, the floor and the lid one
// row outside the panel, at rows -1 and 128. The streamfunction and the
// vorticity are zero on every wall, so across the panel both are sums of
// sin(pi k x / 64), k = 1..63, and a sine transform of each row turns the
// Poisson equation into one tridiagonal solve down the panel per k. The
// transform is a complex FFT of length 128 over the row and its mirror
// image turned upside down, two rows at a time.
const NF = 128, LOGF = 7, K = 63;
const REV = new Uint8Array(NF), CS = new Float64Array(NF / 2), SN = new Float64Array(NF / 2);
for (let i = 0; i < NF; i++) {
  let r = 0;
  for (let b = 0; b < LOGF; b++) r |= ((i >> b) & 1) << (LOGF - 1 - b);
  REV[i] = r;
}
for (let i = 0; i < NF / 2; i++) (CS[i] = cos((TAU * i) / NF)), (SN[i] = -sin((TAU * i) / NF));
function fft(re, im) {
  for (let i = 0; i < NF; i++) {
    const j = REV[i];
    if (j > i) {
      let t = re[i];
      (re[i] = re[j]), (re[j] = t);
      t = im[i];
      (im[i] = im[j]), (im[j] = t);
    }
  }
  for (let size = 2; size <= NF; size <<= 1) {
    const half = size >> 1, step = NF / size;
    for (let s = 0; s < NF; s += size)
      for (let k = 0; k < half; k++) {
        const wr = CS[k * step], wi = SN[k * step], a = s + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        (re[b] = re[a] - xr), (im[b] = im[a] - xi);
        (re[a] += xr), (im[a] += xi);
      }
  }
}

// The sine transform S_k = sum_x f_x sin(pi k x / 64), k = 1..63, of each
// row of f into column k of R (R[k H + y]). An odd sequence's FFT is -2i
// times its sine transform, so of two rows packed into one FFT, row y
// comes out in the imaginary part and row y + 1 in the real part.
function toModes(S, f, R) {
  const { zr, zi } = S;
  for (let y = 0; y < H; y += 2) {
    zr[0] = zi[0] = zr[64] = zi[64] = 0;
    for (let x = 1, o = y * W + 1; x <= K; x++, o++) {
      const a = f[o], b = f[o + W];
      (zr[x] = a), (zi[x] = b), (zr[NF - x] = -a), (zi[NF - x] = -b);
    }
    fft(zr, zi);
    for (let k = 1; k <= K; k++) (R[k * H + y] = -0.5 * zi[k]), (R[k * H + y + 1] = 0.5 * zr[k]);
  }
}
// The transform is its own inverse but for a factor 2 / 64. Column 0 is
// the side wall.
function fromModes(S, R, f) {
  const { zr, zi } = S;
  for (let y = 0; y < H; y += 2) {
    zr[0] = zi[0] = zr[64] = zi[64] = 0;
    for (let k = 1; k <= K; k++) {
      const a = R[k * H + y], b = R[k * H + y + 1];
      (zr[k] = a), (zi[k] = b), (zr[NF - k] = -a), (zi[NF - k] = -b);
    }
    fft(zr, zi);
    f[y * W] = f[(y + 1) * W] = 0;
    for (let x = 1, o = y * W + 1; x <= K; x++, o++) (f[o] = -zi[x] / 64), (f[o + W] = zr[x] / 64);
  }
}

// Solves (b - D2) out = rhs * scale down column o of the modes, D2 the
// second difference in y, with out = 0 on the walls at rows -1 and 128.
function tri(S, R, o, b, scale) {
  const { cp, dp } = S, diag = b + 2;
  for (let y = 0; y < H; y++) {
    const den = diag + (y ? cp[y - 1] : 0);
    cp[y] = -1 / den;
    dp[y] = (R[o + y] * scale + (y ? dp[y - 1] : 0)) / den;
  }
  R[o + H - 1] = dp[H - 1];
  for (let y = H - 2; y >= 0; y--) R[o + y] = dp[y] - cp[y] * R[o + y + 1];
}

export function setup(params) {
  const f = () => new Float64Array(NP);
  params.s = {
    w: f(), r: f(), psi: f(), u: f(), v: f(), wa: f(), ra: f(), wb: f(), rb: f(), tmp: f(),
    DX: new Float32Array(NP), DY: new Float32Array(NP), WR: f(), PR: f(),
    zr: new Float64Array(NF), zi: new Float64Array(NF), cp: new Float64Array(H), dp: new Float64Array(H),
    t: 0, total: 0, fade: 0, old: new Float32Array(NP * 3), rgb: new Float32Array(NP * 3), started: false,
    hue: 0, speed: 2, modes: 3, layer: 3, nu: 0.2, kappa: 0.1, col: new Float32Array(12),
  };
}

// A fresh layer: heavy over light across row Y0, the line between them a
// smooth step DELTA LEDs thick, rippled by cos(pi m x / 64), the wave that
// meets both side walls square, for the chosen m, and fainter by m - 1
// and m + 1 so the fingers come out unequal.
function fresh(S) {
  const { w, r, psi, u, v } = S, m0 = (S.layer = S.modes);
  const waves = [[m0, A0 * (random() < 0.5 ? -1 : 1)]];
  for (const m of [m0 - 1, m0 + 1]) waves.push([m, A0 * 0.3 * (2 * random() - 1)]);
  for (let x = 0; x < W; x++) {
    let yi = Y0;
    for (const [m, a] of waves) yi += a * cos((PI * m * x) / 64);
    for (let y = 0; y < H; y++) r[y * W + x] = tanh((yi - y) / DELTA);
  }
  w.fill(0);
  psi.fill(0);
  u.fill(0);
  v.fill(0);
  S.total = r.reduce((a, b) => a + b, 0);
  S.t = 0;
}

// Two fields sampled bilinearly at one point, both ways held inside the
// panel, into PAIR.
const PAIR = new Float64Array(2);
function pair(f, g, x, y) {
  x = x < 0 ? 0 : x > W - 1 ? W - 1 : x;
  y = y < 0 ? 0 : y > H - 1 ? H - 1 : y;
  const xf = min(floor(x), W - 2), yf = min(floor(y), H - 2), fx = x - xf, fy = y - yf, o = yf * W + xf;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  PAIR[0] = w00 * f[o] + w10 * f[o + 1] + w01 * f[o + W] + w11 * f[o + W + 1];
  PAIR[1] = w00 * g[o] + w10 * g[o + 1] + w01 * g[o + W] + w11 * g[o + W + 1];
}

// MacCormack advection of vorticity and density: a semi-Lagrangian step
// back along the flow (midpoint rule), one forward again to see what it
// lost, half that put back, and the result held inside the four values
// it came from.
function advect(S, dt) {
  const { w, r, u, v, wa, ra, wb, rb, DX, DY } = S, hd = 0.5 * dt;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      pair(u, v, x - hd * u[p], y - hd * v[p]);
      const dx = cl(x - dt * PAIR[0], 0, W - 1), dy = cl(y - dt * PAIR[1], 0, H - 1);
      (DX[p] = dx), (DY[p] = dy);
      pair(w, r, dx, dy);
      (wa[p] = PAIR[0]), (ra[p] = PAIR[1]);
    }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      pair(u, v, x + hd * u[p], y + hd * v[p]);
      pair(wa, ra, x + dt * PAIR[0], y + dt * PAIR[1]);
      (wb[p] = PAIR[0]), (rb[p] = PAIR[1]);
    }
  for (let p = 0; p < NP; p++) {
    const o = min(floor(DY[p]), H - 2) * W + min(floor(DX[p]), W - 2);
    let lo = min(w[o], w[o + 1], w[o + W], w[o + W + 1]), hi = max(w[o], w[o + 1], w[o + W], w[o + W + 1]);
    wb[p] = cl(wa[p] + 0.5 * (w[p] - wb[p]), lo, hi);
    lo = min(r[o], r[o + 1], r[o + W], r[o + W + 1]);
    hi = max(r[o], r[o + 1], r[o + W], r[o + W + 1]);
    rb[p] = cl(ra[p] + 0.5 * (r[p] - rb[p]), lo, hi);
  }
  w.set(wb);
  r.set(rb);
}

// One step of the flow:
//   w_t + u . grad w = A g d(rho)/dx + nu lap w,   lap psi = -w,
//   rho_t + u . grad rho = kappa lap rho,
// with y pointing down the panel, the way gravity pulls, u = d psi / dy
// and v = -d psi / dx. Advection first, then the kick the moved density
// gives the vorticity, which makes the step a symplectic Euler step of the
// growing wave, then the density's diffusion, then viscosity and the
// Poisson solve, both in the sine modes across the panel.
function step(S, dt) {
  const { w, r, psi, u, v, tmp, WR, PR } = S;
  advect(S, dt);
  // Buoyancy.
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) w[p] += dt * G * 0.5 * (r[x < W - 1 ? p + 1 : p] - r[x > 0 ? p - 1 : p + 1]);
  // The density's diffusion, with no flux through the walls, in as many
  // explicit steps as keep it stable.
  const kd = S.kappa * dt, n = Math.ceil(kd / 0.2), kap = kd / n;
  for (let i = 0; i < n; i++) {
    for (let y = 0, p = 0; y < H; y++)
      for (let x = 0; x < W; x++, p++) {
        const sum = r[x > 0 ? p - 1 : p + 1] + r[x < W - 1 ? p + 1 : p] + r[y > 0 ? p - W : p] + r[y < H - 1 ? p + W : p];
        tmp[p] = r[p] + kap * (sum - 4 * r[p]);
      }
    r.set(tmp);
  }
  // The MacCormack step does not keep the total of the density: over a
  // cycle the heavy fluid would drift by 1 to 2%. What it gained or lost
  // is handed back where the fluids meet, in proportion to 1 - rho^2, as
  // Priestley's fixer does for semi-Lagrangian weather models.
  let sum = 0, wt = 0;
  for (let p = 0; p < NP; p++) (sum += r[p]), (wt += 1 - r[p] * r[p]);
  const fix = wt > 0 ? (S.total - sum) / wt : 0;
  for (let p = 0; p < NP; p++) r[p] += fix * (1 - r[p] * r[p]);
  toModes(S, w, WR);
  const nd = S.nu * dt;
  for (let k = 1; k <= K; k++) {
    const k2 = 4 * sin((PI * k) / NF) ** 2, o = k * H;
    // (1 - nu dt lap) w' = w, as (1 / (nu dt) + k2 - D2) w' = w / (nu dt).
    tri(S, WR, o, k2 + 1 / nd, 1 / nd);
    // -lap psi = w', as (k2 - D2) psi = w'.
    for (let y = 0; y < H; y++) PR[o + y] = WR[o + y];
    tri(S, PR, o, k2, 1);
  }
  fromModes(S, WR, w);
  fromModes(S, PR, psi);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const up = y > 0 ? psi[p - W] : 0, dn = y < H - 1 ? psi[p + W] : 0;
      const lf = x > 0 ? psi[p - 1] : -psi[p + 1], rt = x < W - 1 ? psi[p + 1] : 0;
      u[p] = 0.5 * (dn - up);
      v[p] = -0.5 * (rt - lf);
    }
  S.t += dt;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.modes = cl(round(k[2]), 3, 9);
  S.nu = NU0 * NUR ** cl(k[3], 0, 1);
  S.kappa = 0.05 + S.nu / 4;
  if (!S.started) {
    fresh(S);
    S.started = true;
  }
  const h = (d * S.speed) / 2;
  if (S.t > CYCLE || S.modes !== S.layer || (input.btnPressed && input.btnPressed[0])) {
    S.old.set(S.rgb);
    S.fade = 1;
    fresh(S);
  }
  S.fade = max(0, S.fade - h / FADE);
  if (h > 0) step(S, h);
}

// Dim orange and yellow read brown and olive, so the light fluid's wheel
// skips them.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.col, h = S.hue, { r, w, rgb, old } = S, f = S.fade;
  hsv(h + 0.8, 0.65, 0.82, c, 0); // heavy
  hsv(wheel(h + 0.53), 0.8, 0.24, c, 3); // light
  hsv(wheel(h + 0.66), 0.7, 0.5, c, 6); // half and half
  hsv(h + 0.7, 0.12, 1, c, 9); // the sharp line between them
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      // The two fluids and their mixture on a ramp through a third hue,
      // and where the density changes sharply, a pale line as a
      // shadowgraph shows it; spinning fluid a little brighter.
      const q = 0.5 * (1 + r[p]), a = q < 0.5 ? 3 : 6, b = q < 0.5 ? 6 : 0, t = q < 0.5 ? 2 * q : 2 * q - 1;
      const gx = r[x < W - 1 ? p + 1 : p] - r[x > 0 ? p - 1 : p], gy = r[y < H - 1 ? p + W : p] - r[y > 0 ? p - W : p];
      const e = min(1, 0.6 * sqrt(gx * gx + gy * gy)), hl = e * e, vb = 1 + 0.03 * min(10, abs(w[p]));
      for (let ch = 0; ch < 3; ch++) {
        const base = c[a + ch] + t * (c[b + ch] - c[a + ch]);
        const val = min(1, (base * (1 - 0.6 * hl) + 0.75 * c[9 + ch] * hl) * vb) * 255;
        rgb[p * 3 + ch] = f > 0 ? val * (1 - f) + old[p * 3 + ch] * f : val;
      }
      display.setPixel(x, y, round(rgb[p * 3]), round(rgb[p * 3 + 1]), round(rgb[p * 3 + 2]));
    }
}
