// ===== Patternflow pattern =====
// Title:   Burridge-Knopoff
// Family:  physics
// Idea:    Every LED is a block held on a fault by velocity-weakening friction, tied to its four neighbours by springs and dragged by a creeping plate, so the slip deficit builds across the panel until a patch lets go and its slip runs out as an elastic wave, a rupture front with a fading wake, not a counted avalanche.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the spring-block model of an earthquake fault, Robert Burridge and Leon Knopoff, "Model and theoretical seismicity" (1967), on a two-dimensional lattice with the velocity-weakening friction law of Jean Carlson and James Langer, "Mechanical model of an earthquake fault" (1989)
// Round:   129
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1.4..2.8, Scale=-1..1, Weakening=-1..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel. The ramp runs from blue where the fault is slack through magenta to orange where it is loaded, and the rupture wake is the pale tint of the same hue. A slow drift of up to 0.15 of the wheel is added on top, so no turn of the knob keeps one palette.
// Knob 2: Speed. How fast the plate creeps and the waves run, both together, so the panel is the same fault run faster or slower.
// Knob 3: Scale. How stiff the springs between blocks are against the plate's, Kc from 6 at -1 to 10 at the opening 0 to 16.5 at 1. Low Scale crumbles the fault into small patches and high Scale lets a rupture tear in arcs across a good part of the panel.
// Knob 4: Weakening. How far friction drops once a block starts to slip, 0.16 of its threshold at -1, 0.36 at 0 and 0.56 at 1. A small drop lets the whole fault load until it is nearly critical and tear in a few very large ruptures; a large drop spends each patch's stress in one go, so the panel lets go early in many small crumbling patches.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, max, min } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

// What the fault is. Each LED is a block of unit mass at y, its place against the plate, on the panel's own 64 by 128 torus. A stuck block has
// force  f = Kc (sum of its four neighbours - 4 y) - y,  the first term from the springs between blocks and the second from the plate's spring
// (Kp = 1), and y falls at the plate's speed V. It slips when f passes its threshold thr, and then
//   dv/dt = f - thr (1 - sg) / (1 + v / VC),
// a law of the form Carlson and Langer used: friction drops to thr (1 - sg) the moment a block moves and weakens further as it speeds up. The
// block stops, and sticks again, when v reaches 0. Blocks only slip forward. The picture is -y, the slip deficit, which grows at V in a stuck block and falls
// where a block has slipped; Kc ties the blocks together hard enough that the deficit is smooth across a patch, where f is grain-scale noise.
//
// Each frame is cut into steps of at most 1 / sqrt(1 + 8 Kc) model time units, 0.1 at the opening and 0.08 at Scale 1, so the stiffest spring mode,
// at frequency sqrt(1 + 8 Kc), turns less than a radian a step. The update is semi-implicit Euler, velocity first and then place. One panel
// second at Speed 1 is r0 = 10 (4 / sqrt(Kc)) model time units, which keeps the pace of a rupture front in LEDs a second about the same at every Scale.
//
// What was checked, with this file's own sub and update (a Node script that reads the file and calls them):
// - The front. A single block pushed over its threshold in a fault loaded evenly to 0.9 of the threshold, thresholds all 1, starts a circle of
//   slip. Its radius grows at 1.3 to 1.8 sqrt(Kc) LEDs a model time unit for Kc 6, 10 and 16.5 and friction drops 0.16 to 0.56, and at 1.75 to
//   2.9 sqrt(Kc) from a fault loaded to 0.97. At the opening (Kc 10, drop 0.37, Speed 2) 1 sqrt(Kc) is 80 LEDs a panel second, so a circle at
//   1.5 sqrt(Kc) reaches half the panel's width in about a quarter of a second. On the uneven fault the fronts seen are slower, since the
//   strong patches hold them back.
// - The step. A trajectory of this friction law does not converge as the step shrinks: from six developed states, the rms difference in y after
//   30 time units against a run at an eighth of the step is 0.03 to 0.06 at the full step and still 0.017 to 0.05 at a quarter, against a spread
//   of the deficit of about 0.1, since a block either slips in a step or does not. What holds is the statistics. Over 300 panel seconds at the
//   opening the mean share of blocks that slip in a half second is 0.063, 0.068 and 0.069 at the full step, a half and a quarter.
// - It does not die or blow up. Over 900 panel seconds at the opening, with all knobs at their minimum and with all at their maximum, some
//   block is slipping in every frame sampled at half-second spacing, the deficit stays between -0.1 and 0.4 at its 1% and 99% points, and the mean brightness of the first
//   and the last quarter of the run differs by less than 1%.
// - Cost. The first frame waits for the 500 time units run before it, about 0.4 s in Node. A frame after that costs 0.5 ms to step at the
//   opening and 0.9 ms at Scale 1 and Speed 2.8, and the study's ms column reads 2.9 with the drawing in.
const RATE = 10; // model time units a panel second at Speed 1 and Kc = 16
const LOAD = 0.04; // slip deficit the plate adds a panel second at Speed 1
const VC = 0.08; // slip speed that halves the dynamic friction
const PREROLL = 500; // model time units run before the first frame
const KC0 = 10; // Kc at Scale 0
const KSPAN = 0.5; // Kc = KC0 exp(KSPAN Scale)
const SG0 = 0.36; // friction drop at Weakening 0
const SGSPAN = 0.2; // and how far Weakening moves it
const TRAIL = 0.35; // seconds the slip wake takes to fall by e

// Why the fault does not settle. The thresholds are 1 plus a smooth map (spread SPREAD, correlation about 4 LEDs) and a little noise block to
// block (FINE), so some patches hold and some give. The map is two independent maps weighted by the cosine and sine of a slow angle, which keeps
// its spread and turns the barriers into weak spots and back: they wear and heal. A rupture reaches further where the springs are stiffer or the
// friction drop is smaller, and the same barriers stop it less often, so the spread grows with sqrt(Kc / KC0) and by up to 60% as Weakening
// falls below 0. The plate's speed swings round 1 by sines of three periods that are not multiples of each other.
const SPREAD = 0.28;
const WEAKEN = 0.6; // extra spread at Weakening -1
const FINE = 0.04;
const CORR = 4; // box radius that smooths the threshold map, LEDs
const DRIFT = 0.0123; // radians a panel second at Speed 1 that the threshold map turns
const MOD = 1.5; // how far the plate's speed swings
const HB = 0.15; // how far the colour ramp breathes, in turns of the wheel

function setup(params) {
  const f = () => new Float64Array(N);
  const S = { y: f(), v: f(), f: f(), thr: f(), ga: f(), gb: f(), wn: f(), mx: f(), tr: f(), tm: f(), dd: f(), warm: false, nf: 0, lo: 0, hi: 0.4, kc: KC0, sg: SG0, t: 0, hue: 0 };
  params.s = S;
  return S;
}

// A smooth random map of unit spread: white noise through three box blurs of radius r on the torus.
function smoothMap(out, r, tm) {
  for (let p = 0; p < N; p++) out[p] = Math.random() - 0.5;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += out[y * W + ((x + d + W) % W)];
        tm[y * W + x] = s / (2 * r + 1);
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += tm[((y + d + H) % H) * W + x];
        out[y * W + x] = s / (2 * r + 1);
      }
  }
  let m = 0, q = 0;
  for (let p = 0; p < N; p++) m += out[p];
  m /= N;
  for (let p = 0; p < N; p++) q += (out[p] - m) * (out[p] - m);
  q = sqrt(q / N);
  for (let p = 0; p < N; p++) out[p] = (out[p] - m) / q;
}

// One step of dt model time units at plate speed V. mx keeps each block's fastest slip over the frame, for the wake.
function sub(S, dt, V) {
  const { y, v, thr, f, mx } = S, kc = S.kc, sg = S.sg;
  for (let r = 0; r < H; r++) {
    const o = r * W, up = ((r + H - 1) % H) * W, dn = ((r + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, l = o + (x === 0 ? W - 1 : x - 1), rt = o + (x === W - 1 ? 0 : x + 1);
      f[p] = kc * (y[l] + y[rt] + y[up + x] + y[dn + x] - 4 * y[p]) - y[p];
    }
  }
  for (let p = 0; p < N; p++) {
    let vi = v[p];
    const fi = f[p], th = thr[p];
    if (vi > 0) {
      vi += (fi - (th * (1 - sg)) / (1 + vi / VC)) * dt;
      if (vi < 0) vi = 0;
    } else if (fi > th) vi = (fi - th * (1 - sg)) * dt;
    v[p] = vi;
    y[p] += (vi - V) * dt;
    if (vi > mx[p]) mx[p] = vi;
  }
}

const modulation = (t) => max(0.2, 1 + MOD * (0.35 * sin(0.113 * t + 1.3) + 0.25 * sin(0.0711 * t + 4.1) + 0.15 * sin(0.2917 * t)));

// The thresholds at panel time t, for the stiffness kc and the Weakening knob k4.
function thresholds(S, kc, k4) {
  const ca = cos(DRIFT * S.t), sa = sin(DRIFT * S.t), sp = SPREAD * sqrt(kc / KC0) * (1 + WEAKEN * max(0, -cl(k4, -1, 1)));
  for (let p = 0; p < N; p++) S.thr[p] = 1 + sp * (ca * S.ga[p] + sa * S.gb[p]) + FINE * S.wn[p];
}

function advance(S, ft, k) {
  const speed = cl(k[1], 1.4, 2.8), kc = KC0 * exp(KSPAN * cl(k[2], -1, 1));
  S.kc = kc;
  S.sg = SG0 + SGSPAN * cl(k[3], -1, 1);
  thresholds(S, kc, k[3]);
  const r0 = (RATE * 4) / sqrt(kc), units = ft * speed * r0, V = (LOAD / r0) * modulation(S.t);
  S.t += ft * speed;
  const dtmax = min(0.1, 1 / sqrt(1 + 8 * kc)), n = max(1, Math.ceil(units / dtmax - 1e-9));
  S.mx.fill(0);
  for (let i = 0; i < n; i++) sub(S, units / n, V);
  const dec = exp(-ft / TRAIL);
  for (let p = 0; p < N; p++) S.tr[p] = max(S.tr[p] * dec, cl(S.mx[p] / (3 * VC), 0, 1));
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  S.hue = k[0];
  if (!S.warm) {
    S.warm = true;
    for (let p = 0; p < N; p++) S.wn[p] = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
    smoothMap(S.ga, CORR, S.tm);
    smoothMap(S.gb, CORR, S.tm);
    const sm = new Float64Array(N);
    smoothMap(sm, 4, S.tm);
    S.kc = KC0 * exp(KSPAN * cl(k[2], -1, 1));
    S.sg = SG0 + SGSPAN * cl(k[3], -1, 1);
    thresholds(S, S.kc, k[3]);
    // start loaded to 0.3 to 0.8 of the threshold in smooth patches, then run the fault 500 time units so the first frame is a developed one
    for (let p = 0; p < N; p++) S.y[p] = -(0.55 + 0.25 * sm[p]) * S.thr[p];
    const dtp = min(0.1, 1 / sqrt(1 + 8 * S.kc)), n = Math.ceil(PREROLL / dtp), V = LOAD / ((RATE * 4) / sqrt(S.kc));
    for (let i = 0; i < n; i++) sub(S, dtp, V);
    S.mx.fill(0);
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

// ---- colour ---------------------------------------------------------------------------------
// The ramp goes from the slack end to the loaded end through 0.4 of the wheel: at Hue 0 and no breathing blue (0.68), magenta, red, orange.
// It is dark at the slack end and bright at the loaded one. The deficit is blurred 1-2-1 so the grain of the stuck blocks does not speckle it,
// and the ramp's two ends follow the 2% and 98% points of the deficit with a lag of about 2 seconds, so the picture keeps its range at every
// knob. Over that goes the wake, white at a slipping block and fading to the ramp's own colour: pale cyan and lilac on a warm field.
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function blur(a, tm) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) tm[o + x] = 0.25 * a[o + (x === 0 ? W - 1 : x - 1)] + 0.5 * a[o + x] + 0.25 * a[o + (x === W - 1 ? 0 : x + 1)];
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) a[o + x] = 0.25 * tm[om + x] + 0.5 * tm[o + x] + 0.25 * tm[op + x];
  }
}
const TMP = new Float32Array(3), GL = new Float32Array(256 * 3), SORT = new Float64Array(512);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { tr, dd } = S, h0 = S.hue + 0.68 + HB * (0.6 * sin(0.103 * S.t + 0.7) + 0.4 * sin(0.0617 * S.t + 2.9));
  for (let p = 0; p < N; p++) dd[p] = -S.y[p];
  blur(dd, S.tm);
  for (let i = 0; i < 512; i++) SORT[i] = dd[(i * 16 + ((S.nf * 7) % 16)) % N];
  SORT.sort();
  const a = S.nf === 0 ? 1 : 0.02;
  S.lo += (SORT[10] - S.lo) * a;
  S.hi += (SORT[501] - S.hi) * a;
  S.nf++;
  for (let i = 0; i < 256; i++) {
    const s = i / 255;
    hsv(h0 - 0.1 + 0.05 * s, 0.6 - 0.58 * s * s, 1, GL, i * 3);
  }
  const sc = 1 / max(0.15, S.hi - S.lo);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const s = cl((dd[p] - S.lo) * sc, 0, 1), g = tr[p], go = ((g * 255) | 0) * 3, m = Math.pow(g, 0.8) * 0.95;
      hsv(h0 + 0.4 * s, 0.9 - 0.15 * s, 0.22 + 0.7 * Math.pow(s, 0.9), TMP, 0);
      const r = 255 * TMP[0], gg = 255 * TMP[1], b = 255 * TMP[2];
      display.setPixel(x, y, r + (255 * GL[go] - r) * m, gg + (255 * GL[go + 1] - gg) * m, b + (255 * GL[go + 2] - b) * m);
    }
}
