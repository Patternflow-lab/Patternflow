// ===== Patternflow pattern =====
// Title:   Sedimenting Cloud
// Family:  particle
// Idea:    A ball of heavy particles sinks through syrup as one body, each particle moved by its own weight and the Stokeslet flow of all the others, so the cloud falls seven times faster than one particle alone, turns over inside like a drop, sheds a thin tail upward, opens a hole on its axis and comes apart, drawn as an elevation over a plan with the camera riding along.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Stokes' law (George Gabriel Stokes, 1851), the viscous drop (Jacques Hadamard and Witold Rybczynski, 1911), regularized Stokeslets (Ricardo Cortez, 2001), falling clouds of particles (Johannes Nitsche and George Batchelor, 1997; Bloen Metzger, Maxime Nicolas and Elisabeth Guazzelli, 2007), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Particles=300..600, View=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 a particle sinking through the cloud faster than the cloud is cyan and one rising through it is violet, so the elevation shows the column going down the middle and the shell coming up the outside; the tail is pale gold.
// Knob 2: Speed. At 2 the story runs at 8 T a second, T being the time the cloud's collective speed takes to cover one starting radius, with one Adams-Bashforth step a frame (a step is never longer than 0.3 T). With 300 particles the hole on the axis shows in the plan at about 20 s and the cloud comes apart at about 31 s. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Particles. 300 to 600, in tens. The particles keep their spacing, so the cloud is drawn 13 LEDs across its radius at 300 and 16.4 at 600. Fewer particles come apart sooner: of 8 clouds of 300, six split between 176 and 310 T and two thinned into the tail instead; four clouds of 450 split between 349 and 435 T; of four clouds of 600, two split at about 455 T. A new cloud starts 40 T after a split, when the tail holds 65% of the particles, or at 300 + 0.4 N T.
// Knob 4: View. Turns the cloud about the vertical by up to half a turn, in both views at once. The plan, below the folding line, is the cloud seen from above with its far side up, laid out under the elevation as a first-angle drawing has it.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, log, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Units: the cloud's starting radius is 1 and a lone particle settles at 1,
// z pointing down. N a / R = 5, so a particle's Stokeslet carries
// F / (8 pi mu) = 3a/4 = 3.75 / N, and the cloud should fall at about
// 1 + 1.2 N a / R = 7, the speed of a drop as viscous as the fluid around it
// (Hadamard and Rybczynski). T, the time for that collective speed of 6 to
// cover one radius, is the clock the story is told in.
const NAR = 5, T = 1 / (1.2 * NAR), EPS = 0.05, E2 = EPS * EPS;
// The drawing: a radius is 13 LEDs for 300 particles, and grows as the cube
// root of the count, so the particles keep their spacing on the panel. The
// elevation has the cloud's centre at row YS and squeezes heights above U0
// radii logarithmically with scale LS; the plan has its centre at row YP.
const YS = 38, YP = 97, U0 = 1.5, LS = 0.8, XY = 68;

export function setup(params) {
  params.s = { n: 0, buf: new Float32Array(W * H * 3), c: [0, 0, 0], frame: 0 };
}

function newCloud(S, n) {
  S.n = n;
  S.k = 0.75 * (NAR / n);
  for (const key of ["x", "y", "z", "vx", "vy", "vz", "wx", "wy", "wz"]) S[key] = new Float64Array(n);
  S.tail = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let x, y, z;
    do {
      x = 2 * Math.random() - 1;
      y = 2 * Math.random() - 1;
      z = 2 * Math.random() - 1;
    } while (x * x + y * y + z * z > 1);
    S.x[i] = x;
    S.y[i] = y;
    S.z[i] = z;
  }
  S.t = 0;
  S.hp = 0;
  S.seen = 0;
  S.cx = S.cy = S.cz = 0;
  S.camX = S.camY = S.camZ = 0;
  S.split = -1;
  S.fade = 0;
}

// Velocities: each particle's own settling plus the regularized Stokeslet of
// every other, G = [I (r^2 + 2 e^2) + r r^T] / (r^2 + e^2)^(3/2) applied to
// the weight z. G is even in r, so one pair gives both particles the same
// vector.
function velocity(S, X, Y, Z, VX, VY, VZ) {
  const n = S.n;
  VX.fill(0);
  VY.fill(0);
  VZ.fill(0);
  for (let i = 0; i < n; i++) {
    const xi = X[i], yi = Y[i], zi = Z[i];
    let ax = 0, ay = 0, az = 0;
    for (let j = i + 1; j < n; j++) {
      const dx = X[j] - xi, dy = Y[j] - yi, dz = Z[j] - zi;
      const s = dx * dx + dy * dy + dz * dz + E2, inv = 1 / (s * sqrt(s));
      const vx = dx * dz * inv, vy = dy * dz * inv, vz = (s + E2 + dz * dz) * inv;
      ax += vx;
      ay += vy;
      az += vz;
      VX[j] += vx;
      VY[j] += vy;
      VZ[j] += vz;
    }
    VX[i] += ax;
    VY[i] += ay;
    VZ[i] += az;
  }
  const k = S.k;
  for (let i = 0; i < n; i++) {
    VX[i] *= k;
    VY[i] *= k;
    VZ[i] = VZ[i] * k + 1;
  }
}

// One step of the two-step Adams-Bashforth rule, one velocity sum a step,
// with the weight of the last velocity scaled for a step that changed size.
function step(S, h) {
  const n = S.n, { x, y, z, vx, vy, vz, wx, wy, wz } = S;
  velocity(S, x, y, z, vx, vy, vz);
  const c = S.hp > 0 ? h / (2 * S.hp) : 0;
  for (let i = 0; i < n; i++) {
    x[i] += h * (vx[i] + c * (vx[i] - wx[i]));
    y[i] += h * (vy[i] + c * (vy[i] - wy[i]));
    z[i] += h * (vz[i] + c * (vz[i] - wz[i]));
    wx[i] = vx[i];
    wy[i] = vy[i];
    wz[i] = vz[i];
  }
  S.hp = h;
  S.t += h / T;
}

// The cloud's centre: the mean of the particles that are not in the tail.
function centre(S) {
  const n = S.n, { x, y, z, tail } = S;
  let sx = 0, sy = 0, sz = 0, m = 0;
  for (let i = 0; i < n; i++) {
    if (tail[i]) continue;
    sx += x[i];
    sy += y[i];
    sz += z[i];
    m++;
  }
  if (m > 0) {
    S.cx = sx / m;
    S.cy = sy / m;
    S.cz = sz / m;
  }
}

// Friends of friends with a link of 0.32 radii. A particle in a group of
// fewer than ten, more than 1.2 radii above the centre, is in the tail; the
// groups of 15% or more are returned with their centres.
function groups(S) {
  const n = S.n, { x, y, z } = S, lab = new Int32Array(n).fill(-1), out = [], sizes = [], stack = [];
  const L2 = 0.32 * 0.32;
  for (let i = 0; i < n; i++) {
    if (lab[i] >= 0) continue;
    const g = sizes.length;
    lab[i] = g;
    stack.push(i);
    let size = 0, sx = 0, sy = 0;
    while (stack.length) {
      const p = stack.pop();
      size++;
      sx += x[p];
      sy += y[p];
      for (let j = 0; j < n; j++) {
        if (lab[j] >= 0) continue;
        const dx = x[j] - x[p], dy = y[j] - y[p], dz = z[j] - z[p];
        if (dx * dx + dy * dy + dz * dz < L2) {
          lab[j] = g;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
    if (size >= 0.15 * n) out.push({ size, x: sx / size, y: sy / size });
  }
  for (let i = 0; i < n; i++) S.tail[i] = sizes[lab[i]] < 10 && z[i] - S.cz < -1.2 ? 1 : 0;
  return out.sort((a, b) => b.size - a.size);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 300, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1], 0.2, 3);
  S.view = cl(kv[3], 0, 1);
  const n = Math.round(cl(kv[2], 300, 600) / 10) * 10;
  if (n !== S.n || (input.btnPressed && input.btnPressed[0])) newCloud(S, n);
  // Speed 2 tells the story at 8 T a second, one step a frame.
  const h = d * S.speed * 4 * T, parts = Math.ceil(h / (0.3 * T));
  for (let p = 0; p < parts; p++) step(S, h / parts);
  S.frame++;
  if (S.frame % 12 === 0) {
    const big = groups(S);
    // Split: the two biggest groups lie more than a radius apart across, three
    // looks running (the ring's groups flicker before it really parts).
    const apart = big.length >= 2 && Math.hypot(big[0].x - big[1].x, big[0].y - big[1].y) > 1;
    S.seen = apart ? S.seen + 1 : 0;
    if (S.split < 0 && S.seen >= 3) S.split = S.t;
  }
  centre(S);
  // After a split the daughters fall apart for 40 T; then a new cloud. So
  // too when the tail has taken 65% of the particles, or at 300 + 0.4 N T.
  let left = 0;
  for (let i = 0; i < n; i++) left += 1 - S.tail[i];
  if ((S.split >= 0 && S.t > S.split + 40) || left < 0.35 * n || S.t > 300 + 0.4 * n) S.fade += (d * S.speed) / 2;
  if (S.fade > 1) newCloud(S, n);
  const a = 1 - exp(-d * 6);
  S.camX += (S.cx - S.camX) * a;
  S.camY += (S.cy - S.camY) * a;
  S.camZ += (S.cz - S.camZ) * min(1, a * 2);
}

// The side view's row for a height u above the centre, in radii.
function rowOf(u, RP) {
  if (u <= U0) return YS - RP * u;
  return YS - RP * (U0 + LS * log(1 + (u - U0) / LS));
}

function splat(buf, px, py, r, g, b, I) {
  if (px < -1 || px >= W || py < -1 || py >= H) return;
  // Bilinear, so a particle moving a fraction of an LED still moves.
  const x0 = floor(px), y0 = floor(py), fx = px - x0, fy = py - y0;
  for (let q = 0; q < 4; q++) {
    const xx = x0 + (q & 1), yy = y0 + (q >> 1);
    if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
    const wgt = (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy) * I;
    const o = (yy * W + xx) * 3;
    buf[o] += r * wgt;
    buf[o + 1] += g * wgt;
    buf[o + 2] += b * wgt;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const { buf, c } = S, n = S.n;
  for (let p = 0; p < buf.length; p++) buf[p] *= 0.86;
  const ph = S.view * PI, cp = cos(ph), sp = sin(ph), RP = 13 * Math.cbrt(n / 300);
  const fade = (1 - cl(S.fade, 0, 1)) * cl(S.t / 3, 0, 1);
  const tailC = [0, 0, 0];
  hsv(S.hue + 0.14, 0.5, 1, tailC);
  // The cloud's own sinking speed, to colour each particle by how fast it
  // sinks or rises through the cloud.
  let vm = 0, m = 0;
  for (let i = 0; i < n; i++)
    if (!S.tail[i]) {
      vm += S.wz[i];
      m++;
    }
  vm /= max(1, m);
  for (let i = 0; i < n; i++) {
    const ax = S.x[i] - S.camX, ay = S.y[i] - S.camY, dz = S.z[i] - S.camZ;
    // Turned about the vertical by the View knob: across the panel and depth.
    const sx = ax * cp + ay * sp, w = ay * cp - ax * sp;
    const px = 32 + sx * RP;
    if (S.tail[i]) {
      splat(buf, px, rowOf(-dz, RP), tailC[0], tailC[1], tailC[2], 0.55 * fade);
      continue;
    }
    // Sky blue for a particle sinking through the cloud, violet for one
    // rising through it.
    const rise = cl(vm - S.wz[i], -1, 1);
    hsv(S.hue + 0.6 + 0.16 * rise, 0.5 + 0.3 * abs(rise), 1, c);
    // Elevation, lit by nearness to the viewer.
    let near = cl(0.5 - w / 2.4, 0, 1);
    splat(buf, px, rowOf(-dz, RP), c[0], c[1], c[2], (0.14 + 0.34 * near) * fade);
    // Plan, seen from above and laid out below the elevation as in a
    // first-angle drawing: the far side at the top, lit by height.
    near = cl(0.5 - dz / 2, 0, 1);
    splat(buf, px, YP - w * RP, c[0], c[1], c[2], (0.14 + 0.34 * near) * fade);
  }
  // The folding line between the two views, dotted and dim.
  for (let x = 1; x < W; x += 3) {
    const o = (XY * W + x) * 3;
    buf[o] = max(buf[o], 0.1);
    buf[o + 1] = max(buf[o + 1], 0.1);
    buf[o + 2] = max(buf[o + 2], 0.12);
  }
  // Light adds up where particles crowd; the brightest channel is eased into
  // range and the other two keep their ratio to it, so crowds stay coloured.
  for (let p = 0; p < W * H; p++) {
    const o = p * 3, L = max(buf[o], buf[o + 1], buf[o + 2]);
    const k = L > 1e-4 ? (255 * (1 - exp(-1.6 * L))) / L : 0;
    display.setPixel(p & 63, p >> 6, buf[o] * k, buf[o + 1] * k, buf[o + 2] * k);
  }
}
