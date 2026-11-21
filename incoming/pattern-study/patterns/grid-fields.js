// ===== Patternflow pattern =====
// Title:   Grid Fields
// Family:  entorhinal
// Idea:    The panel is a rat's arena seen from above while three grid cells from different modules fill in their hexagonal rate maps along the path of a wandering animal, in coral, cyan and violet, with a spike flashing at its head whenever one of them fires.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Grid cells in the rat's entorhinal cortex, Hafting, Fyhn, Molden, Moser and Moser (2005); the three-cosine rate model, Solstad, Moser and Moser (2006); module spacings in a ratio near 1.4, Stensola et al. (2012); the lattice realigning when the environment changes, Fyhn et al. (2007)
// Round:   214
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spacing=1.4..3.2, Orientation=-30..30, Memory=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of all three cells, so one turn comes back to where it began. At 0 the cells are coral (hue 0.035), cyan (0.50) and violet (0.77). At 0.25 they are yellow-green, blue and magenta-red; at 0.5 teal, red-orange and green.
// Knob 2: Spacing. The module scale, which multiplies the three spacings together: the knob over 2, so 0.6 at the bottom, 1.0 at the opening 2 and 1.6 at the top. The spacings at the opening are 18, 25.2 and 35.3 LEDs (nearest field to nearest field), 10.8, 15.1 and 21.2 at the bottom and 28.8, 40.3 and 56.5 at the top. The lattices dilate about the middle of the panel, so the far fields stream outward as it turns up.
// Knob 3: Orientation. Rotates all three lattices together about the middle of the panel, from -30 to +30 degrees, opening at 0. A hexagonal lattice maps onto itself every 60 degrees, so the two ends carry the same lattices turned a whole period apart; between them the fields swing about 1 LED for every 1.5 degrees at the edge of the panel.
// Knob 4: Memory. How long the arena stays lit behind the animal, 8 s at -1.3, 60 s at the opening 0.06 and 240 s at 1, on a logarithmic scale. At 8 s only a comet about 100 LEDs long follows the animal; at 60 s about half the arena shows; at 240 s the whole arena is lit and the lattices are complete.

// What is drawn is what a neuroscientist plots. A grid cell fires on the
// vertices of a triangular lattice. The standard model sums three cosines
// whose wave vectors are 60 degrees apart,
//   g(x) = (1/3) sum over m of cos(k_m . (x - x0)),  |k_m| = q = 4 pi / (sqrt(3) lambda),
// and the peaks of g sit on a triangular lattice whose nearest neighbours are
// lambda apart (the shortest reciprocal vectors of such a lattice have length
// 4 pi / (sqrt(3) lambda)). The rate is max(0, g) to a power, which cuts the
// peaks into compact fields, each about 0.3 lambda across at half height.
// Three cells come from three modules: spacings in a ratio of 1.4, each turned
// a few degrees from the others, each with a phase of its own.
// The animal runs an Ornstein-Uhlenbeck velocity, a mean speed of 12 LEDs a
// second, softly pushed off the walls and bent by two slow currents whose
// periods have no common factor, so its path never closes. Each cell fires as
// a Poisson process at ten times its rate; the spike is a short flash where
// the animal was, and fades in under half a second.
// The map that is shown is not the one the animal measured. It is the cell's
// analytic rate field times a confidence, the animal's smoothed occupancy
// (each pass stamps a gaussian of about 4 LEDs radius that decays with the
// memory time), so the lattice comes up along the path and fades behind it.
// Because the field is analytic, Hue, Spacing and Orientation act on every
// LED at once. Memory acts at once too: the occupancy is kept at six memory
// times, 8 s up to 240 s on a logarithmic ladder, and the picture reads the
// two nearest the knob and blends them. Each map is stored as the sum of
// exp(t_i / tau) stamps with one scale factor per map, so no frame has to
// decay 8,192 numbers six times over.
// Every few minutes, at random times, one cell re-maps as grid cells do when
// the environment changes: over 20 s its lattice slides by a third to a half
// of a spacing in a random direction and turns a few degrees.
// Time is the clock the engine hands over and the picture is never indexed by
// it, so nothing repeats. The animal is run for 300 s before the first frame,
// which opens the arena already part revealed.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, cos, exp, sqrt, round, log, pow, PI, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = PI / 180;
const CX = 31.5, CY = 63.5; // the middle of the panel: the lattices dilate and turn about it

// ---- the cells
// lam: nearest-neighbour spacing at the opening, LEDs. th: orientation, degrees. hue: at Hue 0.
// gain: how bright its fields are drawn, set so no colour outshines the others on the panel.
const CELLS = [
  { lam: 18.0, th: -4, hue: 0.035, sat: 0.78, gain: 0.88 },
  { lam: 25.2, th: 2, hue: 0.5, sat: 0.85, gain: 0.8 },
  { lam: 35.3, th: 7, hue: 0.77, sat: 0.8, gain: 0.8 },
];
const Q1 = (4 * PI) / sqrt(3); // wave number of a lattice of spacing 1
const POW = 2.2; // the rate is max(0, g) to this power
const RMAX = 10; // spikes a second at the peak of a field

// ---- the animal
const SPEED = 16; // mean speed, LEDs a second
const SU = SPEED / sqrt(PI / 2); // standard deviation of one velocity component: a Rayleigh speed has this mean
const TAUV = 1.1; // velocity correlation time, seconds
const MARGIN = 7; // the walls start pushing this far in
const PUSH = 70; // acceleration at the wall, LEDs a second squared
const SIGMA_OCC = 2.7; // radius of a stamp, LEDs (a gaussian; 4 LEDs is two sigma)
const A_OCC = 9; // occupancy a second at the stamp's centre
const LADDER = 6; // memory times kept: 8 s up to 240 s
const PRE = 300; // seconds the animal runs before the first frame
const STEP = 1 / 30; // longest step of the walk

// ---- the picture
const BG = [3, 5, 13]; // the arena floor, out of 255
const SEEN = [2, 4, 11]; // added where the animal has been
const FLOOR = 0.045; // rate below this is not drawn: a field ends in a clean edge
const LIFE = 0.42; // seconds a spike takes to fade
const TRAIL = 3; // seconds of path kept as the grey trail

const tauOf = (i) => 8 * pow(30, i / (LADDER - 1));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(S) {
  return sqrt(-2 * log(1 - S.rng())) * cos(2 * PI * S.rng());
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

export function setup(params) {
  const rng = mulberry32(floor(Math.random() * 4294967296));
  const S = {
    rng,
    t: 0, tw: 0,
    x: 12 + rng() * 40, y: 20 + rng() * 88, vx: 0, vy: 0,
    ph: [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28],
    occ: [], tref: new Float64Array(LADDER),
    w: new Float64Array(121),
    trail: [], trailT: 0,
    sp: [],
    cell: [],
    next: 0,
    hue: 0, scale: 1, rot: 0, mem: 60,
    buf: new Float32Array(N * 3),
    col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
  for (let i = 0; i < LADDER; i++) S.occ.push(new Float64Array(N));
  for (const c of CELLS)
    S.cell.push({
      dx: rng(), dy: rng(), // phase, in lattice units of the cell's own spacing
      th: c.th * DEG, // current orientation
      mv: null, // a re-map in progress: { t0, dx, dy, th }, the values it started from and by how much it moves
      ax: [0, 0, 0], ay: [0, 0, 0], ps: [0, 0, 0],
    });
  S.vx = SU * gauss(S);
  S.vy = SU * gauss(S);
  S.next = Infinity;
  params.s = S;
  // The animal has been in the arena for a while already. The last second runs with spikes.
  const steps = round(PRE / STEP);
  for (let i = 0; i < steps; i++) advance(S, STEP, i >= steps - 30);
  S.next = S.t + remapWait(S);
}

function remapWait(S) {
  return 70 + 110 * -log(1 - S.rng());
}

function smooth(u) {
  u = cl(u, 0, 1);
  return u * u * (3 - 2 * u);
}

// The state of cell i's lattice now, with any re-map folded in: orientation
// (radians) and phase in lattice units.
function cellNow(S, i, out) {
  const C = S.cell[i], m = C.mv;
  if (!m) {
    out[0] = C.th;
    out[1] = C.dx;
    out[2] = C.dy;
    return;
  }
  const s = smooth((S.t - m.t0) / 20);
  out[0] = C.th + m.dth * s;
  out[1] = C.dx + m.ddx * s;
  out[2] = C.dy + m.ddy * s;
}

// Start and finish re-maps.
function remap(S) {
  for (let i = 0; i < 3; i++) {
    const C = S.cell[i], m = C.mv;
    if (m && S.t - m.t0 >= 20) {
      C.th += m.dth;
      C.dx += m.ddx;
      C.dy += m.ddy;
      C.mv = null;
    }
  }
  if (S.t < S.next) return;
  const i = floor(S.rng() * 3), C = S.cell[i];
  if (!C.mv) {
    const a = S.rng() * 2 * PI, r = 0.3 + 0.2 * S.rng();
    let d = (2 + 4 * S.rng()) * DEG * (S.rng() < 0.5 ? -1 : 1);
    // Keep the cell near the orientation it was born with.
    const base = CELLS[i].th * DEG;
    if (abs(C.th + d - base) > 9 * DEG) d = -d;
    C.mv = { t0: S.t, ddx: r * cos(a), ddy: r * sin(a), dth: d };
  }
  S.next = S.t + remapWait(S);
}

// Sets up each cell's three wave vectors and phases for the knobs and the
// re-map under way: g = (1/3) sum cos(ax x + ay y - ps), x and y from the middle of the panel.
function aim(S) {
  const st = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const C = S.cell[i];
    cellNow(S, i, st);
    const th = st[0] + S.rot * DEG, sl = CELLS[i].lam * S.scale, dx = st[1], dy = st[2];
    for (let m = 0; m < 3; m++) {
      const f = m * PI / 3;
      C.ax[m] = (Q1 / sl) * cos(f + th);
      C.ay[m] = (Q1 / sl) * sin(f + th);
      C.ps[m] = Q1 * (cos(f) * dx + sin(f) * dy);
    }
  }
}

function rateAt(C, x, y) {
  x -= CX;
  y -= CY;
  const g = (cos(C.ax[0] * x + C.ay[0] * y - C.ps[0]) + cos(C.ax[1] * x + C.ay[1] * y - C.ps[1]) + cos(C.ax[2] * x + C.ay[2] * y - C.ps[2])) / 3;
  return g > 0 ? pow(g, POW) : 0;
}

// One step of the world: the walk, the occupancy stamps, the spikes, the trail.
function advance(S, h, spikes) {
  S.t += h;
  S.tw += h;
  const t = S.tw;
  // The walk: an Ornstein-Uhlenbeck velocity about a slowly turning drift.
  const mx = 0.45 * SU * sin(0.0713 * t + S.ph[0]) + 0.25 * SU * sin(0.0291 * t + S.ph[2]);
  const my = 0.45 * SU * sin(0.0531 * t + S.ph[1]) + 0.25 * SU * sin(0.0197 * t + S.ph[3]);
  const e = exp(-h / TAUV), n = SU * sqrt(1 - e * e);
  S.vx = mx + (S.vx - mx) * e + n * gauss(S);
  S.vy = my + (S.vy - my) * e + n * gauss(S);
  let ax = 0, ay = 0;
  if (S.x < MARGIN) ax = PUSH * ((MARGIN - S.x) / MARGIN) ** 2;
  else if (S.x > W - 1 - MARGIN) ax = -PUSH * ((S.x - (W - 1 - MARGIN)) / MARGIN) ** 2;
  if (S.y < MARGIN) ay = PUSH * ((MARGIN - S.y) / MARGIN) ** 2;
  else if (S.y > H - 1 - MARGIN) ay = -PUSH * ((S.y - (H - 1 - MARGIN)) / MARGIN) ** 2;
  S.vx += ax * h;
  S.vy += ay * h;
  S.x += S.vx * h;
  S.y += S.vy * h;
  if (S.x < 0.5) (S.x = 1 - S.x), (S.vx = abs(S.vx));
  if (S.x > W - 1.5) (S.x = 2 * (W - 1.5) - S.x), (S.vx = -abs(S.vx));
  if (S.y < 0.5) (S.y = 1 - S.y), (S.vy = abs(S.vy));
  if (S.y > H - 1.5) (S.y = 2 * (H - 1.5) - S.y), (S.vy = -abs(S.vy));

  remap(S);

  // Occupancy: one gaussian stamp into every memory map, grown by exp(age / tau)
  // so that reading it back only needs one scale per map.
  const R = 5, x0 = round(S.x) - R, y0 = round(S.y) - R, w = S.w, inv = 1 / (2 * SIGMA_OCC * SIGMA_OCC);
  for (let j = 0, q = 0; j <= 2 * R; j++)
    for (let i = 0; i <= 2 * R; i++, q++) {
      const dx = x0 + i - S.x, dy = y0 + j - S.y;
      w[q] = exp(-(dx * dx + dy * dy) * inv);
    }
  for (let m = 0; m < LADDER; m++) {
    const tau = tauOf(m);
    if (S.t - S.tref[m] > 6 * tau) {
      // Bring the scale back to 1 before the numbers grow too large.
      const f = exp(-(S.t - S.tref[m]) / tau), o = S.occ[m];
      for (let p = 0; p < N; p++) o[p] *= f;
      S.tref[m] = S.t;
    }
    const a = A_OCC * h * exp((S.t - S.tref[m]) / tau), o = S.occ[m];
    for (let j = 0, q = 0; j <= 2 * R; j++) {
      const yy = y0 + j;
      for (let i = 0; i <= 2 * R; i++, q++) {
        const xx = x0 + i;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) o[yy * W + xx] += a * w[q];
      }
    }
  }

  // The trail: a point of the path every 1/15 s.
  S.trailT += h;
  if (S.trailT >= 1 / 15) {
    S.trailT -= 1 / 15;
    S.trail.push({ x: S.x, y: S.y, t: S.t });
  }
  while (S.trail.length && S.t - S.trail[0].t > TRAIL) S.trail.shift();

  // Spikes: each cell fires as a Poisson process at the rate of its field where the animal is.
  for (let k = S.sp.length - 1; k >= 0; k--) if (S.t - S.sp[k].t > LIFE) S.sp.splice(k, 1);
  if (spikes) {
    aim(S);
    for (let i = 0; i < 3; i++) {
      const r = RMAX * rateAt(S.cell[i], S.x, S.y);
      if (S.rng() < 1 - exp(-r * h) && S.sp.length < 300) S.sp.push({ x: S.x + 0.5 * gauss(S), y: S.y + 0.5 * gauss(S), c: i, t: S.t });
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.scale = cl(k[1], 1.4, 3.2) / 2;
  S.rot = cl(k[2], -30, 30);
  S.mem = 8 * pow(30, cl((k[3] + 1) / 2, 0, 1));
  let span = cl(dt || 0, 0, 0.1);
  while (span > 1e-9) {
    const h = min(span, STEP);
    advance(S, h, true);
    span -= h;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  aim(S);
  const buf = S.buf;
  const { x: ax, y: ay } = S;

  // The memory the knob asks for sits between two rungs of the ladder.
  const pos = (LADDER - 1) * log(S.mem / 8) / log(30);
  const r0 = min(LADDER - 2, max(0, floor(pos))), fr = cl(pos - r0, 0, 1);
  const o0 = S.occ[r0], o1 = S.occ[r0 + 1];
  const s0 = (1 - fr) * exp(-(S.t - S.tref[r0]) / tauOf(r0)), s1 = fr * exp(-(S.t - S.tref[r0 + 1]) / tauOf(r0 + 1));

  for (let i = 0; i < 3; i++) {
    hsv(CELLS[i].hue + S.hue, CELLS[i].sat, CELLS[i].gain, S.col[i]);
  }
  const A = S.cell;

  for (let y = 0; y < H; y++) {
    const yy = y - CY;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, b = p * 3;
      const O = s0 * o0[p] + s1 * o1[p];
      const C = smooth((1 - exp(-O) - 0.04) / 0.8);
      let r = BG[0] / 255, g = BG[1] / 255, bl = BG[2] / 255;
      if (C > 0.004) {
        r += (SEEN[0] / 255) * C;
        g += (SEEN[1] / 255) * C;
        bl += (SEEN[2] / 255) * C;
        const xx = x - CX;
        for (let i = 0; i < 3; i++) {
          const D = A[i];
          const gg = (cos(D.ax[0] * xx + D.ay[0] * yy - D.ps[0]) + cos(D.ax[1] * xx + D.ay[1] * yy - D.ps[1]) + cos(D.ax[2] * xx + D.ay[2] * yy - D.ps[2])) / 3;
          if (gg <= 0) continue;
          const rate = pow(gg, POW);
          if (rate < FLOOR) continue;
          const v = C * pow((rate - FLOOR) / (1 - FLOOR), 0.9);
          const c = S.col[i];
          r += c[0] * v;
          g += c[1] * v;
          bl += c[2] * v;
        }
      }
      buf[b] = r;
      buf[b + 1] = g;
      buf[b + 2] = bl;
    }
  }

  // The head sits in a dark halo so it still reads on top of a bright field.
  {
    const R = 5, inv = 1 / (2 * 1.9 * 1.9);
    for (let y = max(0, round(ay) - R); y <= min(H - 1, round(ay) + R); y++)
      for (let x = max(0, round(ax) - R); x <= min(W - 1, round(ax) + R); x++) {
        const k = 1 - 0.65 * exp(-((x - ax) ** 2 + (y - ay) ** 2) * inv), b = (y * W + x) * 3;
        buf[b] *= k;
        buf[b + 1] *= k;
        buf[b + 2] *= k;
      }
  }
  // The trail, then the spikes, then the head: soft round dots added to the map.
  const dot = (cx, cy, sg, cr, cg, cb) => {
    const R = ceil(2.5 * sg), inv = 1 / (2 * sg * sg);
    for (let y = max(0, round(cy) - R); y <= min(H - 1, round(cy) + R); y++)
      for (let x = max(0, round(cx) - R); x <= min(W - 1, round(cx) + R); x++) {
        const w = exp(-((x - cx) ** 2 + (y - cy) ** 2) * inv), b = (y * W + x) * 3;
        buf[b] += cr * w;
        buf[b + 1] += cg * w;
        buf[b + 2] += cb * w;
      }
  };
  for (const q of S.trail) {
    const a = 0.3 * (1 - (S.t - q.t) / TRAIL);
    if (a > 0) dot(q.x, q.y, 0.9, 0.7 * a, 0.78 * a, 0.95 * a);
  }
  for (const s of S.sp) {
    const a = (1 - (S.t - s.t) / LIFE) ** 1.5, c = S.col[s.c], g = CELLS[s.c].gain;
    // The spike is the cell's own colour at full strength, lifted toward white.
    dot(s.x, s.y, 0.85, (0.5 * c[0] / g + 0.5) * a * 1.2, (0.5 * c[1] / g + 0.5) * a * 1.2, (0.5 * c[2] / g + 0.5) * a * 1.2);
  }
  dot(ax, ay, 0.95, 1.0, 1.0, 1.0);

  // Tone: keep each LED's colour and let only its brightness give way near full.
  for (let p = 0; p < N; p++) {
    const b = p * 3;
    let r = buf[b], g = buf[b + 1], bl = buf[b + 2];
    const m = max(r, g, bl);
    if (m > 0.75) {
      const k = (0.75 + 0.25 * (1 - exp(-(m - 0.75) / 0.25))) / m;
      r *= k;
      g *= k;
      bl *= k;
    }
    display.setPixel(p % W, (p / W) | 0, round(255 * r), round(255 * g), round(255 * bl));
  }
}
