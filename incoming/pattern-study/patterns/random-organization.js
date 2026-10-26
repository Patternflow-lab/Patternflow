// ===== Patternflow pattern =====
// Title:   Random Organization
// Family:  sim
// Idea:    Disks in a periodic box are sheared, one side sliding up and the other down and back once a cycle, every disk that touched another during the cycle is kicked a short random step, and the share kicked, traced along the bottom, falls cycle by cycle until below a critical strain the box finds places where nobody touches and freezes for good, while above it the flashing never stops.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: random organization under periodic shear (Laurent Corté, Paul Chaikin, Jerry Gollub and David Pine, 2008), an absorbing-state phase transition, pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Strain=1..4, Density=0.2..0.35
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 calm disks are teal, disks that have touched another this cycle gold, disks touching right now pale gold, a kick flashes white, and the material grid is slate; at 0.25 calm disks are violet and touched ones green, at 0.5 pink and blue, at 0.75 green and magenta. The calm colour skips orange and yellow, which read brown and olive at its level.
// Knob 2: Speed. Shear cycles a second, 0.75 x Speed: 1.5 at 2, 0.15 at 0.2, 2.25 at 3. At the opening Strain and Density the box froze after a median of 89 cycles over 30 runs, a minute at Speed 2; it then shears on calm for 10 cycles and a fresh box is dropped.
// Knob 3: Strain. The strain amplitude gamma0, 1 to 4: the panel's side columns travel 32 x gamma0 rows each way and back every cycle, and the grid's squares lean into parallelograms that steep. At the opening Density (83 disks) the median run froze after 89 cycles at 1, 219 at 2 and 504 at 2.5; at 3 half of 8 runs were still going after 6,000 cycles, and at 3.5 and 4 none stopped, with 52% and 63% of the disks kicked every cycle.
// Knob 4: Density. The disks' area fraction, 0.2 to 0.35: 83 to 146 disks of radius 2.5 LEDs in the 64 x 128 box, added at random or taken away at the end of a cycle. At the opening Strain the median run froze after 89 cycles at 0.2, 216 at 0.24 and 839 at 0.27; at 0.3 none of 8 runs stopped in 6,000 cycles, 44% of the disks kicked every cycle, and 65% at 0.35.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, cos, sin, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Disk radius in LEDs, the kick (a random step up to KICK diameters), the
// most disks the arrays hold, and the calm cycles held before a fresh box.
const R = 2.5, D = 2 * R, KICK = 0.75, NMAX = 260, HOLD = 10;
// Shear cycles a second at Speed 1.
const RATE = 0.75;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The knob's wheel skips orange through yellow, which reads brown and olive
// on dim disks.
const wheel = (h) => 0.18 + 0.85 * (h - floor(h));

export function setup(params) {
  params.s = {
    n: 0, X: new Float64Array(NMAX), Y: new Float64Array(NMAX),
    first: new Float32Array(NMAX), age: new Float32Array(NMAX), flash: new Float32Array(NMAX),
    pa: new Int16Array(2048), pb: new Int16Array(2048), lo: new Float32Array(2048), hi: new Float32Array(2048), np: 0,
    phase: 0, g0: 1, gNext: 1, phi: 0.2, cps: 2, hue: 0, born: false,
    hist: new Float32Array(W).fill(-1), quiet: 0, cycles: 0, f: 1,
    rgb: new Float32Array(NP * 3), pal: new Float32Array(18), palHue: -1,
  };
}

const count = (phi) => cl(round((phi * W * H) / (PI * R * R)), 4, NMAX);

function scatter(S, i) {
  S.X[i] = Math.random() * W;
  S.Y[i] = Math.random() * H;
  S.age[i] = 0;
  S.flash[i] = 1;
}

// A fresh box: disks dropped anywhere, overlaps and all.
function stir(S) {
  S.n = count(S.phi);
  for (let i = 0; i < S.n; i++) scatter(S, i);
  S.hist.fill(-1);
  S.quiet = 0;
  S.cycles = 0;
}

// The whole cycle's contacts, worked out before it starts. Under the shear
// y -> y + g (x - 32) a pair with reference separation (dx, dy) sits at
// (dx, dy + g dx), so it touches at strain g when |dy + g dx| < sqrt(D^2 - dx^2).
// That is an interval of g; where it meets [0, g0] the pair collides this
// cycle, and its lower end is the strain of first contact. The box is
// periodic in x and y, and its x images ride the shear with it
// (Lees-Edwards), so dx is the nearest image and dy is tried a box up and down.
function contacts(S) {
  const { n, X, Y, first } = S, g0 = S.g0;
  first.fill(1e9, 0, n);
  S.np = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      let dx = X[j] - X[i];
      dx -= W * round(dx / W);
      if (dx >= D || dx <= -D) continue;
      const h = sqrt(D * D - dx * dx);
      for (let m = -1; m <= 1; m++) {
        const dy = Y[j] - Y[i] + m * H;
        let a, b;
        if (abs(dx) < 1e-9) {
          if (abs(dy) >= h) continue;
          (a = 0), (b = g0);
        } else {
          const u = (-h - dy) / dx, v = (h - dy) / dx;
          (a = max(0, min(u, v))), (b = min(g0, max(u, v)));
          if (a >= b) continue;
        }
        if (a < first[i]) first[i] = a;
        if (a < first[j]) first[j] = a;
        if (S.np < 2048) {
          S.pa[S.np] = i;
          S.pb[S.np] = j;
          S.lo[S.np] = a;
          S.hi[S.np] = b;
          S.np++;
        }
      }
    }
}

// End of a cycle, back at zero strain: every disk that touched anyone is
// moved a random step up to KICK diameters, the rest stay exactly put.
function endCycle(S) {
  let k = 0;
  for (let i = 0; i < S.n; i++) {
    if (S.first[i] > 1e8) {
      S.age[i] += 1;
      continue;
    }
    k++;
    const a = Math.random() * TAU, m = Math.random() * KICK * D;
    S.X[i] = (S.X[i] + m * cos(a) + W) % W;
    S.Y[i] = (S.Y[i] + m * sin(a) + H) % H;
    S.age[i] = 0;
    S.flash[i] = 1;
  }
  S.f = S.n ? k / S.n : 0;
  S.hist.copyWithin(0, 1);
  S.hist[W - 1] = S.f;
  S.cycles++;
  S.quiet = k ? 0 : S.quiet + 1;
}

// Density turned: disks are added at random or the last ones taken away.
function resize(S) {
  const want = count(S.phi);
  while (S.n < want) scatter(S, S.n++);
  if (S.n > want) S.n = want;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.2], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.cps = cl(kv[1], 0.2, 3);
  S.gNext = cl(kv[2], 1, 4);
  S.phi = cl(kv[3], 0.2, 0.35);
  if (!S.born) {
    stir(S);
    S.g0 = S.gNext;
    contacts(S);
    S.born = true;
  }
  for (let i = 0; i < S.n; i++) S.flash[i] = max(0, S.flash[i] - d * 4);
  S.phase += d * S.cps * RATE;
  while (S.phase >= 1) {
    S.phase -= 1;
    endCycle(S);
    if (S.quiet >= HOLD) stir(S);
    resize(S);
    S.g0 = S.gNext;
    contacts(S);
  }
}

function palette(S) {
  const P = S.pal, h = S.hue;
  hsv(wheel(h + 0.376), 0.65, 1, P, 0); // calm disks, teal at Hue 0
  hsv(h + 0.13, 0.85, 0.9, P, 3); // disks that touched this cycle, gold
  hsv(wheel(h + 0.5), 0.45, 0.3, P, 6); // the sheared material grid
  hsv(h + 0.13, 0.4, 1, P, 9); // touching right now, pale gold
  hsv(h + 0.13, 0.55, 0.85, P, 12); // activity trace
  S.palHue = S.hue;
}

// One disk at lab centre (cx, cy), soft at the rim, kept brightest per LED.
function disk(S, cx, cy, r, g, b) {
  const rgb = S.rgb, x0 = floor(cx - R - 1), y0 = floor(cy - R - 1);
  for (let yy = y0; yy <= y0 + 2 * R + 2; yy++) {
    const py = ((yy % H) + H) % H, ey = yy + 0.5 - cy;
    for (let xx = x0; xx <= x0 + 2 * R + 2; xx++) {
      if (xx < 0 || xx >= W) continue;
      const ex = xx + 0.5 - cx, k = cl(R + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (k <= 0) continue;
      const p = (py * W + xx) * 3;
      if (rgb[p] < r * k) rgb[p] = r * k;
      if (rgb[p + 1] < g * k) rgb[p + 1] = g * k;
      if (rgb[p + 2] < b * k) rgb[p + 2] = b * k;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  if (S.palHue !== S.hue) palette(S);
  const P = S.pal, rgb = S.rgb, g = (S.g0 * (1 - cos(TAU * S.phase))) / 2;
  // How far the strain has reached this cycle: contacts up to here have happened.
  const reach = S.phase < 0.5 ? g : S.g0;
  rgb.fill(0);
  // The material grid: squares 16 LEDs on a side in the unsheared box. The
  // shear tilts their rows into parallelograms and slides the columns
  // along themselves.
  for (let x = 0; x < W; x++) {
    const off = g * (x + 0.5 - 32);
    for (let y = 0; y < H; y++) {
      const v = (((y + 0.5 - off) % 16) + 16) % 16, k = max(cl(1.2 - abs(v - 8), 0, 1), x % 16 === 8 ? 0.6 : 0);
      if (k <= 0) continue;
      const p = (y * W + x) * 3;
      rgb[p] = P[6] * k;
      rgb[p + 1] = P[7] * k;
      rgb[p + 2] = P[8] * k;
    }
  }
  // Which disks touch right now.
  const now = new Uint8Array(S.n);
  for (let q = 0; q < S.np; q++) if (g > S.lo[q] && g < S.hi[q]) now[S.pa[q]] = now[S.pb[q]] = 1;
  for (let i = 0; i < S.n; i++) {
    let o = S.first[i] <= reach ? 3 : 0;
    if (now[i]) o = 9;
    // A calm disk kicked lately is brighter, settling over a few cycles to
    // the steady level of disks that have stopped moving.
    const f = S.flash[i], v = o ? 1 : 0.5 + 0.35 * Math.exp(-S.age[i] / 4);
    let r = P[o] * v, gg = P[o + 1] * v, b = P[o + 2] * v;
    (r += f * (1 - r)), (gg += f * (1 - gg)), (b += f * (1 - b));
    const cx = S.X[i], cy = S.Y[i] + g * (S.X[i] - 32);
    disk(S, cx, cy, r, gg, b);
    // Images across the side edges ride the shear 64 * g further.
    if (cx < R + 1) disk(S, cx + W, cy + g * W, r, gg, b);
    if (cx > W - R - 1) disk(S, cx - W, cy - g * W, r, gg, b);
  }
  // Activity: the share of disks kicked in each of the last 64 cycles, one
  // column a cycle, newest on the right, full height 16 rows.
  for (let x = 0; x < W; x++) {
    const f = S.hist[x];
    if (f < 0) continue;
    const top = round(f * 16);
    for (let k = 0; k <= top; k++) {
      const p = ((H - 1 - k) * W + x) * 3, a = k === top ? 1 : 0.35;
      rgb[p] = max(rgb[p], P[12] * a);
      rgb[p + 1] = max(rgb[p + 1], P[13] * a);
      rgb[p + 2] = max(rgb[p + 2], P[14] * a);
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3)
      display.setPixel(x, y, (255 * min(1, rgb[p])) | 0, (255 * min(1, rgb[p + 1])) | 0, (255 * min(1, rgb[p + 2])) | 0);
}
