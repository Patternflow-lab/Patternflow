// ===== Patternflow pattern =====
// Title:   Red Sprites
// Family:  upperlightning
// Idea:    A night view past the top of a big thunderstorm: a cloud deck lit from inside by orange-white lightning sheets at the bottom, and in the black above it red sprites (tall crimson columns with a diffuse halo and thin violet tendrils branching down toward the cloud) that flash a moment after each stroke, faint red elves spreading wide across the sky, and slow blue jets climbing out of the cloud top, over a drifting green airglow.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: red sprites first photographed by John Winckler's group at the University of Minnesota (1989) and named by Davis Sentman and colleagues at the University of Alaska (Sentman et al. 1995); blue jets (Wescott et al. 1995); elves, the flat red ring that lightning's pulse lights in the lower ionosphere, predicted by Umran Inan and colleagues; red from nitrogen first-positive emission, blue tendrils from the second positive system; streamer branching drawn as a stochastic tree, original, pattern round 204
// Round:   204
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Activity=0.3..5, Reach=-1..1, Glow=-1..1
//
// Knob 1: Hue. Turns the whole night round the colour wheel from the crimson sprites and orange-white deck it opens on; at 0.25 the deck is lime green under gold-green sprites, at 0.5 turquoise under cyan ones, at 0.75 violet, and 1 is the start again.
// Knob 2: Activity. How many cloud strokes the storm throws a minute, about 4 at 0.3 (a sprite group every 13 s or so, between them only the deck's flicker and the airglow moving), 28 at 2 where it opens (a group about every 3 s, with an elf or a jet between), and 70 at 5 (a group every 2 s or less, the sky never quite dark). The strokes come at random, with lulls and bursts.
// Knob 3: Reach. How tall the columns stand and where the deck sits: at -1 a sprite is about 40 LEDs from halo to tendril tips with the cloud top at row 95, where it opens about 50 LEDs with the top at row 101, and at 1 about 60 LEDs with the top at row 107 and the halos at the top edge. The airglow band moves with it, from row 20 down to row 5.
// Knob 4: Glow. How hard the storm lights itself from inside: at -1 the deck is a dim ember a third as bright as where it opens and each stroke is a faint pulse in it, at 0 a stroke fills a patch of the deck with orange-white sheets, at 1 the deck is more than twice as bright and nearly all of it burns white-orange.

const W = 64;
const H = 128;
const N = W * H;
const { floor, ceil, sin, cos, sqrt, exp, abs, min, max, pow, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());
function poisson(m) {
  const L = exp(-m);
  let k = 0;
  for (let p = Math.random(); p > L; p *= Math.random()) k++;
  return k;
}

// Smooth lattice noise from a table of random values, tiled every 64 cells.
const NT = 64;
function n2(T, x, y) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 63, x1 = (xi + 1) & 63, y0 = (yi & 63) * NT, y1 = ((yi + 1) & 63) * NT;
  const a = T[y0 + x0], b = T[y0 + x1], c = T[y1 + x0], d = T[y1 + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// The same in three dimensions, 32 cells each way, for textures that reshape
// themselves with time and do not only slide.
const N3 = 32;
function n3(T, x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const x0 = xi & 31, x1 = (xi + 1) & 31, y0 = (yi & 31) * N3, y1 = ((yi + 1) & 31) * N3;
  const z0 = (zi & 31) * N3 * N3, z1 = ((zi + 1) & 31) * N3 * N3;
  const a = T[z0 + y0 + x0], b = T[z0 + y0 + x1], c = T[z0 + y1 + x0], d = T[z0 + y1 + x1];
  const e = T[z1 + y0 + x0], f = T[z1 + y0 + x1], g = T[z1 + y1 + x0], h = T[z1 + y1 + x1];
  const l0 = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  const l1 = e + (f - e) * fx + (g - e) * fy + (e - f - g + h) * fx * fy;
  return l0 + (l1 - l0) * fz;
}

// Altitude to row. The cloud top is at 12 km; one km is `sc` rows, 1.1 where it
// opens, so a halo at 88 km stands about 84 rows above the deck's lit edge.
const ALT0 = 12;

// The deck's colours from dark maroon through orange to white-hot: level, r, g, b.
const DECK = [
  [0, 0.06, 0.008, 0.012],
  [0.22, 0.45, 0.1, 0.03],
  [0.48, 0.92, 0.4, 0.08],
  [0.74, 1.0, 0.7, 0.26],
  [1, 1.0, 0.93, 0.74],
];
function ramp(v, o) {
  v = cl(v, 0, 1);
  let k = 0;
  while (k < DECK.length - 2 && v > DECK[k + 1][0]) k++;
  const a = DECK[k], b = DECK[k + 1], u = (v - a[0]) / (b[0] - a[0]);
  o[0] = mix(a[1], b[1], u);
  o[1] = mix(a[2], b[2], u);
  o[2] = mix(a[3], b[3], u);
}

const TAU_RED = 0.17;
const TAU_BLUE = 0.07;
const PREROLL = 30;

export function setup(params) {
  const tab = () => Float32Array.from({ length: NT * NT }, () => Math.random());
  params.s = {
    t: 0, first: true, k: [0, 2, 0, 0.06],
    storm: 0, cell: 0,
    sr: new Float32Array(N), sb: new Float32Array(N),
    ex: new Float32Array(N), jx: new Float32Array(N),
    topY: new Float32Array(W),
    T1: tab(), T2: tab(), T3: Float32Array.from({ length: N3 * N3 * N3 }, () => Math.random()),
    lights: [], jets: [], elves: [], pend: [], stack: [],
    hue: 0, act: 2, reach: 0, glow: 1, sc: 1.1, deck: 101,
    c: [0, 0, 0], moodNow: 1,
  };
}

function derive(S, k) {
  S.hue = k[0];
  S.act = cl(k[1], 0.3, 5);
  S.reach = cl(k[2], -1, 1);
  S.glow = pow(2, 1.5 * cl(k[3], -1, 1) - 0.1);
  S.sc = 1.1 + 0.22 * S.reach;
  S.deck = 101 + 6 * S.reach;
}
const Y = (S, alt) => S.deck - (alt - ALT0) * S.sc;

// ---------------------------------------------------------------------------
// Sprites. A column is a stochastic branching tree drawn into two float planes
// that decay on their own: the red plane (nitrogen first positive) lasts about
// 0.17 s, the blue-violet plane (second positive, the tendrils) about 0.07 s,
// so the tendrils vanish first and the crimson body is what lingers.
// ---------------------------------------------------------------------------

// A line's profile: a flat-topped core that falls to half at about 0.9 w from the
// centre line (so 2 to 4 LEDs across for w 1.1 to 1.7) and a soft shoulder round
// it. It goes in with a max, so steps along a line do not stack into beads of their own.
function splat(P, cx, cy, w, amp, shoulder) {
  const r = ceil(3.4 * w) + 1, iw = 1 / (w * w);
  const x0 = max(0, floor(cx - r)), x1 = min(W - 1, floor(cx + r));
  const y0 = max(0, floor(cy - r)), y1 = min(H - 1, floor(cy + r));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, u = (dx * dx + dy * dy) * iw;
      const v = amp * ((1 - shoulder) * exp(-u * sqrt(u)) + shoulder * exp(-u * 0.11));
      const i = y * W + x;
      if (v > P[i]) P[i] = v;
    }
  }
}

// A soft additive blob: the halo and the faint glow round a group.
function blob(P, cx, cy, sx, sy, amp) {
  const x0 = max(0, floor(cx - 3 * sx)), x1 = min(W - 1, ceil(cx + 3 * sx));
  const y0 = max(0, floor(cy - 3 * sy)), y1 = min(H - 1, ceil(cy + 3 * sy));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / sy;
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / sx;
      P[y * W + x] += amp * exp(-0.5 * (dx * dx + dy * dy));
    }
  }
}

// One column: halo, then the stem going down with forks at random angles.
// The trunk loses 1.3% a row, so it reaches the tip at about half its light;
// each fork takes about 0.65 of what its parent had and loses 3% a row after
// that, so brightness falls toward the tips. Above `yBody` the light is red,
// below it violet-blue.
function column(S, xc, yTop, yBody, yEnd, gain) {
  const { sr, sb, stack } = S;
  blob(sr, xc, yTop, 3.4 + 1.2 * Math.random(), 2.8 + 1.2 * Math.random(), 0.38 * gain);
  blob(sr, xc, yTop + 1, 7, 4.6, 0.1 * gain);
  stack.length = 0;
  stack.push({ x: xc, y: yTop + 2, a: (Math.random() - 0.5) * 0.1, e: 1, w: 1.4, type: 0, ph: Math.random() * 6.28, end: yEnd });
  let guard = 0, branches = 0;
  while (stack.length && guard++ < 40) {
    const b = stack.pop();
    for (let n = 0; n < 240; n++) {
      const zone = sstep(yBody - 4, yBody + 9, b.y);
      b.a += (Math.random() - 0.5) * (0.22 + 0.3 * zone) - b.a * (b.type === 0 ? 0.1 : 0.05);
      b.a = cl(b.a, -1.15, 1.15);
      b.x += sin(b.a);
      b.y += cos(b.a);
      b.e *= b.type === 0 ? 0.987 : 0.97;
      if (b.e < 0.2 || b.y > b.end || b.x < 1 || b.x > W - 1) break;
      // Beads: brighter knots every five rows or so, different for each branch.
      const bead = (0.68 + 0.32 * (0.5 + 0.325 * sin(b.y * 1.25 + b.ph) + 0.175 * sin(b.y * 0.47 + b.ph * 2.3))) * (0.9 + 0.2 * Math.random());
      const a = b.e * bead * gain;
      const red = a * (1 - 0.72 * zone);
      splat(sr, b.x, b.y, b.w * (1 + 0.3 * (1 - zone)), red, 0.2);
      if (b.type === 0 && zone < 0.8) {
        // Fine parallel strands round the red body, each with its own beads.
        const o = 2.9 + 0.9 * sin(b.y * 0.17 + b.ph), f = 0.3 * (0.5 + 0.5 * sin(b.y * 0.9 + b.ph * 3));
        splat(sr, b.x - o, b.y, 1.05, red * f, 0.1);
        splat(sr, b.x + o * 0.9, b.y, 1.05, red * (0.3 - f + 0.08), 0.1);
      }
      if (zone > 0.05) splat(sb, b.x, b.y, max(1.1, b.w * 0.8), a * zone * 1.1, 0.22);
      if (branches < 16 && b.type < 3 && Math.random() < (0.012 + 0.085 * zone) * (b.type ? 0.8 : 1)) {
        branches++;
        const sgn = Math.random() < 0.5 ? -1 : 1;
        stack.push({
          x: b.x, y: b.y, a: b.a + sgn * (0.3 + 0.5 * Math.random()), e: b.e * (0.55 + 0.2 * Math.random()),
          w: max(1.15, b.w * 0.82), type: b.type + 1, ph: Math.random() * 6.28, end: b.end - 2 - 10 * Math.random(),
        });
        b.e *= 0.9;
      }
    }
  }
}

// A group of one to five columns side by side, 6.5 to 10.5 LEDs apart.
function sprites(S, x, gain) {
  const r = Math.random();
  const n = r < 0.18 ? 1 : r < 0.48 ? 2 : r < 0.75 ? 3 : r < 0.92 ? 4 : 5;
  const gap = 6.5 + 4 * Math.random();
  x = cl(x, 6 + (n - 1) * gap * 0.5, W - 7 - (n - 1) * gap * 0.5);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const mid = 1 - abs(i - (n - 1) / 2) / (n * 0.9);
    const cx = x + (i - (n - 1) / 2) * gap + 1.6 * gauss();
    sum += cx;
    const alt = 74 + 14 * Math.random();
    const g = gain * (0.6 + 0.4 * mid) * (0.75 + 0.25 * Math.random());
    column(S, cx, max(3, Y(S, alt)), Y(S, 58 + 12 * Math.random()), Y(S, 26 + 20 * Math.random()), g);
  }
  // The whole group sits in one faint crimson wash.
  blob(S.sr, sum / n, Y(S, 74), 4 + gap * n * 0.5, 7, 0.09 * gain);
}

// ---------------------------------------------------------------------------
// The storm below: lights inside the deck. A light is a stroke or a few strokes
// 0.05 to 0.2 s apart, each a sudden brightening that dies in `tau` seconds.
// ---------------------------------------------------------------------------
function addLight(S, x, y, sx, sy, amp, strokes, tau, rise) {
  if (S.lights.length > 44) return;
  const offs = [0], fac = [1];
  for (let i = 1; i < strokes; i++) {
    offs.push(offs[i - 1] + 0.05 + 0.13 * Math.random());
    fac.push(0.35 + 0.5 * Math.random());
  }
  S.lights.push({ x, y, sx, sy, amp, t0: S.t, offs, fac, tau, rise: rise || 0, I: rise ? 0 : amp, ix: 0.5 / (sx * sx), ys: 1 / sy });
}

function bigFlash(S) {
  const x = cl(S.cell + 13 * gauss(), 4, W - 5);
  const amp = 0.8 + 0.5 * Math.random();
  const y = S.deck + 6 + 14 * Math.random();
  addLight(S, x, y, 10 + 11 * Math.random(), 4.5 + 4 * Math.random(), amp, 1 + floor(Math.random() * 3.4), 0.055 + 0.06 * Math.random());
  const r = Math.random();
  if (r < 0.64) {
    S.pend.push({ at: S.t + 0.04 + 0.05 * Math.random(), kind: 0, x: x + 4 * gauss(), g: 0.8 + 0.4 * Math.random() });
    // A second group follows now and then, from the same stroke's continuing current.
    if (Math.random() < 0.26) S.pend.push({ at: S.t + 0.18 + 0.3 * Math.random(), kind: 0, x: x + 7 * gauss(), g: 0.6 + 0.3 * Math.random() });
  }
  if (Math.random() < (r < 0.64 ? 0.14 : 0.3)) S.pend.push({ at: S.t + 0.015, kind: 1, x: x + 3 * gauss(), g: 0.8 + 0.4 * Math.random() });
}

function miniFlash(S) {
  const x = cl(S.cell + 18 * gauss(), 2, W - 3);
  const big = Math.random() < 0.16;
  addLight(S, x, S.deck + 4 + 20 * Math.random(), big ? 8 + 6 * Math.random() : 3 + 3 * Math.random(), big ? 4 + 3 * Math.random() : 2 + 2 * Math.random(), big ? 0.3 + 0.2 * Math.random() : 0.2 + 0.25 * Math.random(), 1 + floor(Math.random() * 2.5), 0.09 + 0.1 * Math.random());
}

function newJet(S) {
  if (S.jets.length >= (S.act > 3 ? 2 : 1)) return;
  const x = cl(S.cell + 12 * gauss(), 6, W - 7);
  const tall = (22 + 12 * Math.random()) * S.sc / 1.1;
  S.jets.push({
    x, y0: S.deck - 3 + Math.random() * 3, t0: S.t, H: tall, W: 3.6 + 1.8 * Math.random(),
    climb: 0.5 + 0.3 * Math.random(), amp: 0.8 + 0.3 * Math.random(), ph: Math.random() * 6.28, wob: 0.8 + 1.4 * Math.random(),
  });
}

function newElf(S, x, g) {
  if (S.elves.length >= 3) return;
  S.elves.push({ x, y: Y(S, 88), t0: S.t, amp: 0.7 * g });
}

function advance(S, dt) {
  S.t += dt;
  const t = S.t;
  // The storm's own mood: a slow random walk of the rate, pulled back to 1, so
  // quiet gaps and bursts come and go, and the active cell drifts across the deck.
  S.storm += -0.07 * S.storm * dt + 0.2 * sqrt(dt) * gauss();
  S.storm = cl(S.storm, -1.1, 1.0);
  S.cell = 32 + 13 * sin(0.031 * t + 0.6) + 7 * sin(0.0127 * t + 2.1) + 3 * sin(0.0713 * t);
  const mood = exp(S.storm - 0.07);
  S.moodNow = pow(mood, 0.9);
  const big = S.act * (14 / 60) * mood;
  // Decay the two sprite planes.
  const dr = exp(-dt / TAU_RED), db = exp(-dt / TAU_BLUE);
  const { sr, sb } = S;
  for (let i = 0; i < N; i++) {
    const a = sr[i] * dr, b = sb[i] * db;
    sr[i] = a < 0.003 ? 0 : a;
    sb[i] = b < 0.003 ? 0 : b;
  }
  // Events arrive as Poisson processes: strokes, flickers in the cloud, jets.
  for (let n = poisson(big * dt); n > 0; n--) bigFlash(S);
  for (let n = poisson((1.2 + 1.5 * S.act) * dt * (0.7 + 0.3 * mood)); n > 0; n--) miniFlash(S);
  for (let n = poisson(0.045 * S.act * mood * dt); n > 0; n--) newJet(S);
  // Slow glows: a patch of cloud that warms over a second or two and cools over several.
  for (let n = poisson(0.3 * dt * mood); n > 0; n--) {
    addLight(S, cl(S.cell + 20 * gauss(), 2, W - 3), S.deck + 3 + 20 * Math.random(), 6 + 7 * Math.random(), 3 + 4 * Math.random(), 0.3 + 0.3 * Math.random(), 1, 1.3 + 3 * Math.random(), 0.9);
  }
  // Scheduled events: a sprite group a few hundredths of a second after its stroke.
  for (let i = S.pend.length - 1; i >= 0; i--) {
    const p = S.pend[i];
    if (p.at > t) continue;
    S.pend.splice(i, 1);
    if (p.kind === 0) sprites(S, p.x, p.g);
    else newElf(S, p.x, p.g);
  }
  // Light intensities now; the finished ones go.
  for (let i = S.lights.length - 1; i >= 0; i--) {
    const L = S.lights[i];
    let v = 0;
    for (let j = 0; j < L.offs.length; j++) {
      const d = t - L.t0 - L.offs[j];
      if (d >= 0) v += L.amp * L.fac[j] * exp(-d / L.tau) * (L.rise ? 1 - exp(-d / L.rise) : 1);
    }
    L.I = v;
    if (t - L.t0 > L.offs[L.offs.length - 1] + 7 * L.tau) S.lights.splice(i, 1);
  }
  for (let i = S.jets.length - 1; i >= 0; i--) if (t - S.jets[i].t0 > S.jets[i].climb + 1.6) S.jets.splice(i, 1);
  for (let i = S.elves.length - 1; i >= 0; i--) if (t - S.elves[i].t0 > 0.7) S.elves.splice(i, 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.k = k;
  derive(S, k);
  if (S.first) {
    // Open as if the storm had been going for half a minute, and with a stroke
    // just thrown so the first frames have a sprite fading in them.
    for (let t = 0; t < PREROLL; t += 0.05) advance(S, 0.05);
    bigFlash(S);
    S.pend.push({ at: S.t, kind: 0, x: S.cell, g: 1.1 });
    S.pend.push({ at: S.t + 1.9, kind: 0, x: S.cell + 10 * gauss(), g: 1.1 });
    S.first = false;
  }
  advance(S, dt);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// The elf: a thin ellipse about 90 km up, seen almost edge-on, that spreads
// from a few LEDs to wider than the panel in a quarter second and fades.
function drawElves(S) {
  const E = S.ex;
  E.fill(0);
  for (const e of S.elves) {
    const age = S.t - e.t0;
    const a = 3 + 180 * age, b = 0.9 + 0.13 * a, th = 1.6 + 0.02 * a;
    const amp = e.amp * exp(-age / 0.17) * min(1, 0.6 + age * 14);
    if (amp < 0.01) continue;
    const x0 = max(0, floor(e.x - a - 6)), x1 = min(W - 1, ceil(e.x + a + 6));
    const y0 = max(0, floor(e.y - b - 6)), y1 = min(H - 1, ceil(e.y + b + 6));
    const ia = 1 / (a * a), ib = 1 / (b * b);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - e.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - e.x;
        const f = dx * dx * ia + dy * dy * ib - 1;
        const gl = 2 * sqrt(dx * dx * ia * ia + dy * dy * ib * ib) + 1e-6;
        const d = f / gl;
        const limb = 0.5 + 0.5 * min(1, abs(dx) / a);
        const v = exp(-(d * d) / (th * th)) * limb + (f < 0 ? 0.2 * (1 + f) : 0);
        E[y * W + x] += amp * v;
      }
    }
  }
}

// A blue jet: a narrow cone that widens upward from a point in the cloud top,
// its head climbing at a steady pace for about 0.6 s, then fading.
function drawJets(S) {
  const J = S.jx;
  J.fill(0);
  for (const j of S.jets) {
    const age = S.t - j.t0;
    const head = j.H * min(1, age / j.climb);
    const fade = age < j.climb ? 1 : exp(-(age - j.climb) / 0.3);
    const amp = j.amp * fade * min(1, 0.25 + age * 6);
    if (amp < 0.01) continue;
    const yTop = floor(j.y0 - head - 3);
    for (let y = max(0, yTop); y <= min(H - 1, floor(j.y0 + 3)); y++) {
      const hh = j.y0 - (y + 0.5);
      if (hh > head + 2) continue;
      const frac = clamp01(hh / j.H);
      const w = 1.25 + (j.W - 1.25) * frac;
      const xc = j.x + j.wob * sin(hh * 0.2 + j.ph);
      const front = hh > head - 5 ? 1 + 0.5 * (1 - clamp01((head - hh) / 5)) : 1;
      const along = (0.62 + 0.38 * (1 - frac)) * front * (0.82 + 0.18 * sin(hh * 0.75 + j.ph * 2)) * (hh > head ? exp(-(hh - head) * 0.9) : 1);
      const x0 = max(0, floor(xc - 3 * w)), x1 = min(W - 1, ceil(xc + 3 * w));
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - xc, dx = px / w;
        let v = 0.5 * exp(-0.8 * dx * dx);
        // Three fine strands inside the cone, each swaying a little on its own.
        for (let f = 0; f < 3; f++) {
          const d = px - w * (f - 1) * 0.7 - 0.5 * sin(hh * 0.31 + f * 2.1 + j.ph);
          v += 0.55 * exp(-d * d / 1.1) * (0.7 + 0.3 * sin(hh * 0.8 + f * 1.7));
        }
        J[y * W + x] += amp * along * v;
      }
    }
  }
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const t = S.t, deck = S.deck, glow = S.glow;
  drawElves(S);
  drawJets(S);
  const { sr, sb, ex, jx, T1, T2, T3, topY } = S;
  // The hue wheel as a rotation about grey.
  const ang = 2 * PI * S.hue, ca = cos(ang), sa = sin(ang) / sqrt(3), q = (1 - ca) / 3;
  const m00 = ca + q, m01 = q - sa, m02 = q + sa;
  // The cloud top: a few big swells with smaller bulges on them, drifting and
  // boiling slowly, a different pace for each size.
  for (let x = 0; x < W; x++) {
    const big = n2(T1, x * 0.075 + t * 0.012, 3.3 + t * 0.006);
    const mid = n2(T1, x * 0.17 - t * 0.02 + 9, 7.1 + t * 0.01);
    const bump = sqrt(n2(T2, x * 0.33 + t * 0.03, 1.9 - t * 0.014));
    topY[x] = deck + 5 - 11 * big - 3.5 * mid - 2.2 * bump;
  }
  // Active lights, with the vertical reach above their centre larger than below it.
  const act = [];
  for (const L of S.lights) if (L.I > 0.01) act.push(L);
  const lowest = deck - 36;
  const o = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    // The airglow: a faint green band near the top that ripples and drifts.
    const ay0 = max(5, Y(S, 97)) + 2 * sin(0.047 * t + 1) + 1.5 * sin(0.0173 * t + 4);
    const ags = 0.5 + 0.9 * n2(T1, t * 0.035 + 7, 1.5);
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      const i = y * W + x;
      if (y < 46) {
        const wave = n3(T3, x * 0.09 - t * 0.12 + 20, y * 0.27 + 3, t * 0.05);
        const ay = ay0 + 2.4 * (n2(T1, x * 0.06 + t * 0.02 + 40, 5.5) - 0.5) + 1.1 * sin(0.21 * x - 0.43 * t);
        const dyy = (y + 0.5 - ay) / 3;
        const ag = exp(-dyy * dyy) * (0.5 + 0.8 * wave);
        const ag2 = exp(-((y + 0.5 - ay - 9) * (y + 0.5 - ay - 9)) / 12) * 0.2 * (0.4 + 0.8 * n2(T1, x * 0.1 + t * 0.05, y * 0.3 + 30));
        const A = 0.15 * (ag + ag2) * ags;
        r += 0.06 * A; g += A; b += 0.3 * A;
      }
      // Sprites: red and violet-blue, with a hot centre where the red is brightest.
      const sv = sr[i], bv = sb[i];
      const over = sv > 0.85 ? sv - 0.85 : 0;
      r += sv + 0.46 * bv;
      g += 0.055 * sv + 0.33 * bv + 0.5 * over;
      b += 0.1 * sv + 1.0 * bv + 0.22 * over;
      const e = ex[i];
      r += 1.0 * e; g += 0.12 * e; b += 0.16 * e;
      const jv = jx[i];
      r += 0.05 * jv; g += 0.26 * jv; b += 1.0 * jv;
      // The storm: haze above the deck and the deck itself.
      if (y > lowest) {
        let Lsum = 0;
        for (let n = 0; n < act.length; n++) {
          const L = act[n];
          const dx = x + 0.5 - L.x, dy = y + 0.5 - L.y;
          const sy = dy < 0 ? 2.0 : 1;
          const gg = dx * dx * L.ix + 0.5 * dy * dy * L.ys * L.ys / (sy * sy);
          if (gg < 9) Lsum += L.I * exp(-gg);
        }
        Lsum *= glow;
        const depth = y + 0.5 - topY[x];
        const alpha = sstep(-0.7, 3.4, depth);
        // Billows in the deck: stretched sideways, the fine ones moving faster. The
        // same field, a few LEDs up, is the glow the deck throws on the air over it.
        let tex = 0.55 * n3(T3, x * 0.09 + t * 0.1 + 3, y * 0.18, t * 0.07) + 0.33 * n3(T3, x * 0.2 - t * 0.2 + 7, y * 0.34 + 5, t * 0.13 + 11) + 0.12 * n3(T3, x * 0.41 + t * 0.3 + 11, y * 0.6 + 2, t * 0.22 + 20);
        tex = cl((tex - 0.3) * 2.1, 0, 1);
        const amb = (0.07 + 0.3 * pow(tex, 1.4)) * pow(glow, 0.75) * (0.85 + 0.25 * sin(0.9 * t + x * 0.21 + y * 0.13));
        // Haze above the cloud, from the strokes under it and from the deck's own glow.
        if (alpha < 1) {
          const up = max(0, -depth);
          const h = ((1 - exp(-0.3 * Lsum)) * 0.8 + 0.2 * amb * exp(-up / 7)) * (1 - alpha);
          r += h; g += h * 0.4; b += h * 0.12;
        }
        if (alpha > 0) {
          const dd = max(0, depth);
          // Thin cloud at the top lets more of the light through.
          const thin = 1 + 0.9 * exp(-dd / 3.2);
          const v = amb + Lsum * (0.32 + 1.3 * tex) * thin;
          ramp(1 - exp(-1.5 * v), o);
          const k = alpha;
          r = r * (1 - k) + o[0] * k; g = g * (1 - k) + o[1] * k; b = b * (1 - k) + o[2] * k;
        }
      }
      const rr = m00 * r + m01 * g + m02 * b, gg2 = m02 * r + m00 * g + m01 * b, bb = m01 * r + m02 * g + m00 * b;
      display.setPixel(x, y, cl(rr, 0, 1) * 255, cl(gg2, 0, 1) * 255, cl(bb, 0, 1) * 255);
    }
  }
}
