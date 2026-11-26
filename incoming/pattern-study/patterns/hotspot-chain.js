// ===== Patternflow pattern =====
// Title:   Hotspot Chain
// Family:  hotspot
// Idea:    The ocean floor seen straight down as a shaded-relief chart, a dark indigo abyssal plain sliding past a fixed mantle plume near the top of the panel, where a new volcano glows red-orange and grows steep, is carried off down the panel, goes cold, sinks and wears flat, so that a chain of blue cones, turquoise atolls and flat-topped guyots trails away behind the plume and its heading bends as the plate's direction wanders.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hot spots, a plume of hot mantle that stays put while the plate slides over it and leaves a chain of volcanoes that grow older away from it (J. Tuzo Wilson, 1963; W. Jason Morgan, 1971, from memory), the Hawaiian-Emperor bend, a change in the plate's heading about 47 million years ago that bent the chain (from memory), the sinking of an old volcano with the square root of its age as the cooling plate thickens (Barry Parsons and John Sclater, 1977, from memory), atolls as reefs that keep up with a sinking island (Charles Darwin, 1842), guyots, seamounts planed flat at the sea surface and then drowned (Harry Hess, 1946, from memory), the flexural moat and arch round a volcano's load (Alan Watts and others, 1970s, from memory) and the shaded-relief bathymetric chart. Original code, pattern round 264: every volcano is a list entry (where the plume was when it was born, its size, its age on a clock of its own), the plate's path is rebuilt from a stored series of headings, and the height of the sea floor is summed per LED each frame and lit from the upper left.
// Round:   264
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Plate speed=0..4, Plume=-1..1, Bend=-1..1
//
// Knob 1: Hue. Turns the whole palette, water, sand, reef and lava together, round the grey axis by 360 degrees times the knob. At 0 and at 1 the sea is blue, from near-black indigo (16, 14, 74) on the plain through royal blue and azure to cyan (76, 216, 230) on the shallows, with sand and green summits, a pale turquoise reef (168, 250, 226) and red-orange lava. At 0.5 the sea is brown and gold and the lava is blue.
// Knob 2: Plate speed. How fast the plate slides under the plume, 0.3 LED a second at 0, 0.95 at the opening 2 and 3.0 at 4 (a tenth of a decade per knob unit, so 0.3 times 10^(K/4)). New volcanoes are made about 9 LEDs apart at 0, 15 at the opening and 28 at 4, so at 0 the chain is a ridge of overlapping cones and at 4 it is three or four mounts with plain between them. Volcanoes also age faster the faster the plate goes, with the square root of the speed, so an old one is as worn at the bottom of the panel at any speed.
// Knob 3: Plume. How strong the plume is, -1 to 1, opening at 0. Volcanoes are 0.8 times the opening size at -1 and 1.2 times at 1 (footprint radius about 8 LEDs at -1, 10 at the opening and 12 at 1, then moved by the plume's own pulses, 5.6 to 14), and they are born half as often at -1 (one in 32 seconds, small and standing alone) and 1.6 times as often at 1 (one in 10, a crowd of islands and atolls, since only the big ones get above the sea). The volcano over the plume grows or shrinks to the knob within a few seconds.
// Knob 4: Bend. How much the plate's heading wanders, -1 to 1, opening at 0.06. The heading swings round its mean (13 degrees right of straight down) by up to 2 degrees at -1, 25 degrees at the opening and 50 degrees at 1, and goes from a lazy curve to flat stretches joined by kinks (seven parts tanh, which squeezes the sines, 1 times at -1, 2.2 at the opening and 3.6 at 1, and three parts plain sines, so no two flat stretches lie at quite the same angle). The whole chain is rebuilt from the stored headings when it moves, so turning it flexes the old part and the young part at once.

// What the picture is. The panel is the sea floor seen from straight above as a shaded-relief chart, lit from the upper left, 64 by 128 LEDs. The plate is the map and it slides down the panel at 0.3 to 3 LEDs a second. The mantle plume stays at (24, 22),
// a little left of centre and high up, so the map above it is plain that nothing has touched yet, and the volcanoes are made at the plume and carried away down the panel. The heading is a sum of five sines of 151.7, 93, 57.3, 37.1 and 23.3 seconds, which have no common
// period, squeezed by a tanh, so it never repeats and the older part of the chain points somewhere else than the young part. The headings are stored 0.25 s apart, and a volcano is where the plate has carried the plume's place since the volcano was born,
// so a bend made at the plume travels down the panel at the plate's speed. Volcanoes that have left the panel are forgotten and the old headings are trimmed.
// A volcano is a list entry: where the plume was when it was born (with up to 2.5 LEDs of side-to-side jitter), a size, an age on a clock that runs with the square root of the plate's speed, an outline made lopsided by two lobes that smooth away with age,
// and a stretch of 1.05 to 1.25 along the chain. Its size is the plume's strength when it was born: 1 plus three pulses of 71, 44 and 28 seconds, times the knob; while it is young it follows the plume's strength as it changes. It rises as 1 - exp(-(age / 3.4)^1.5) of its
// full height of 4.55 km of sea plus 0.4 + 1.9 times its size, with a profile 1 - (u / 1.4)^q where u is the distance in footprint radii (q is 1.3 for a small cone and 2.3 for a large one, so a big volcano is a broad dome with steep flanks and a small one a cone), and
// it sinks by 0.4 km times the square root of its age, which is partly a lowering and partly a spreading, so that it gets lower and its foot creeps in. One of size 0.8 or more gets above the sea. Between 7 and 14 age seconds the waves plane the top down to 0.1 km under the surface, and
// after that the flat top sinks with the rest: it is an island with a green top for a while, then a flat shallow platform, then a guyot that goes through every blue as it deepens. Round it the plate bends under the load, a dark moat at 1.55 footprint radii, up to
// 0.36 km deep, filling slowly with age, and a faint arch at 2.5. Where two volcanoes overlap their heights are joined by the cube root of the sum of cubes, so a saddle between them is a ridge. A twin comes 0.36 times the usual gap after the last one, one time in six, and
// a small cone is born beside the main one three times in ten. Gullies run down the flanks, radial ridges 0.2 km high that the light picks out.
// The plain is 4.55 km down and deeper toward the bottom of the panel, with a swell of 0.3 km, abyssal hills 26 LEDs long and 5.5 across (and a finer set at half that) that slide with the plate and are smoothed away toward the bottom of the panel as sediment piles up, fracture zones every 57 LEDs,
// narrow troughs with a step in depth across them, 8 degrees off the plate's own line, and the 0.45 km swell the plume lifts round its place. The colour is a hypsometric tint by height, stepped in layers 0.7 km thick over the flanks as on a printed chart. The light is from the upper left at 42
// degrees up, taken from the slope of the height field (stretched 1.8 times), so each cone has a bright upper-left flank and a dark lower-right one, shadows going bluer and lights whiter.
// A volcano erupts for its first 11 or so age seconds: a vent about 3 LEDs across at the summit, white-yellow in the middle, and a lobed field of lava round it that runs farther on some flanks than on others, bright orange near the vent and dark red at its edge, with surges that run out along it. Then it
// goes out over 3.5 s and the lava cools to dark rock over 14. When the flat top is no deeper than 0.8 to 1.3 km and the volcano is in the warm band (a band of the panel from y 34 down to somewhere between y 70 and 110, the lower edge drifting 10 LEDs over 211 seconds) a pale ring of reef grows round the edge of the top and the middle is a turquoise lagoon,
// and it goes as the volcano sinks or leaves the band.
// The first update runs 110 to 480 seconds of the plate's motion in one go (130 / speed + 30 s, 0.5 s at a time), then waits for the next volcano to be born and for it to be 3 to 6 age seconds old, so the first frame has a glowing, growing cone over the plume and a chain of older ones behind it. The
// knobs given to that first update decide how that history looks.

const W = 64, H = 128, GW = W + 2, GH = H + 2, NG = GW * GH;
const { floor, sqrt, exp, sin, cos, tanh, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();

function hash(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = floor(x), iy = floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ---- the world's constants
const R0 = 9; // footprint radius of a volcano of size 1, LEDs
const QX = 24, QY = 22; // where the plume is on the panel
const DT = 0.25; // seconds between stored headings
const BASE = -4.55; // depth of the abyssal plain, km
const SUBK = 0.4; // km of sinking per square root of age second
const LOOK_Z0 = -5.5, LOOK_Z1 = 1.5, NZ = 896; // the height ramp, as a table
const SHEAR = 1.8; // vertical stretch of the relief for the light
const LX = -0.5, LY = -0.55, LZ = 0.6708; // the light, towards the sun
const PERIODS = [151.7, 93.0, 57.3, 37.1, 23.3];
const PWEIGHT = [0.5, 0.9, 0.75, 0.55, 0.45];

// height ramp, km above the sea: [z, r, g, b]
const RAMP = [
  [-5.5, 4, 4, 26],
  [-4.9, 8, 7, 44],
  [-4.5, 16, 14, 74],
  [-4.0, 24, 32, 130],
  [-3.3, 28, 62, 178],
  [-2.5, 30, 98, 208],
  [-1.7, 36, 140, 226],
  [-1.0, 50, 184, 234],
  [-0.5, 76, 216, 230],
  [-0.15, 142, 238, 228],
  [-0.02, 214, 246, 226],
  [0.04, 240, 226, 164],
  [0.14, 214, 212, 128],
  [0.3, 92, 178, 74],
  [0.9, 40, 124, 56],
  [1.5, 112, 98, 80],
];
const HEAT = [
  [0.0, 70, 12, 10],
  [0.3, 170, 36, 12],
  [0.55, 240, 84, 12],
  [0.8, 255, 150, 30],
  [1.0, 255, 228, 150],
];
const EXTRA = { reef: [168, 250, 226], lagoon: [58, 214, 206], rock: [44, 22, 26] };

function makeState() {
  return {
    ready: false, t: 0, ac: 0, ox: 0, oy: 0,
    k: [0, 2, 0, 0.06], speed: 0.95, szK: 1, rateK: 1, amp: 0.3, gain: 2, hue: -1,
    ph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], pph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    tBase: 0, sh: [], spd: [], cx: [], cy: [], vx: [], vy: [], th: [],
    ed: [], tNext: 0, nb: 0, lastBirthAc: 0, wphase: rnd() * TAU,
    Z: new Float32Array(NG), P3: new Float32Array(NG), HT: new Float32Array(NG),
    RF: new Float32Array(NG), LG: new Float32Array(NG), DK: new Float32Array(NG),
    lut: new Float32Array(NZ * 3), hlut: new Float32Array(256 * 4), extra: { reef: [0, 0, 0], lagoon: [0, 0, 0], rock: [0, 0, 0] },
  };
}

export function setup(params) {
  params.s = makeState();
}

// ---- palette: hue turned by rotating every colour round the grey axis
function hueMatrix(a) {
  const c = cos(a), s = sin(a), k = 1 / 3, q = sqrt(k);
  const m = new Array(9);
  m[0] = c + (1 - c) * k; m[1] = k * (1 - c) - q * s; m[2] = k * (1 - c) + q * s;
  m[3] = k * (1 - c) + q * s; m[4] = c + k * (1 - c); m[5] = k * (1 - c) - q * s;
  m[6] = k * (1 - c) - q * s; m[7] = k * (1 - c) + q * s; m[8] = c + k * (1 - c);
  return m;
}
function turn(M, r, g, b, out, o) {
  out[o] = cl(M[0] * r + M[1] * g + M[2] * b, 0, 255);
  out[o + 1] = cl(M[3] * r + M[4] * g + M[5] * b, 0, 255);
  out[o + 2] = cl(M[6] * r + M[7] * g + M[8] * b, 0, 255);
}
function stopsAt(T, v) {
  let k = 0;
  while (k < T.length - 2 && v > T[k + 1][0]) k++;
  const a = T[k], b = T[k + 1];
  const t = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
  return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
}
function buildPalette(S, u) {
  const M = hueMatrix(TAU * u);
  for (let i = 0; i < NZ; i++) {
    const c = stopsAt(RAMP, LOOK_Z0 + ((LOOK_Z1 - LOOK_Z0) * i) / (NZ - 1));
    turn(M, c[0], c[1], c[2], S.lut, i * 3);
  }
  for (let i = 0; i < 256; i++) {
    const c = stopsAt(HEAT, i / 255);
    turn(M, c[0], c[1], c[2], S.hlut, i * 4);
    S.hlut[i * 4 + 3] = sm(0.04, 0.4, i / 255);
  }
  for (const key of ["reef", "lagoon", "rock"]) {
    const o = [0, 0, 0];
    turn(M, EXTRA[key][0], EXTRA[key][1], EXTRA[key][2], o, 0);
    S.extra[key] = o;
  }
}

// ---- the plate's heading, kept as a series so that the bend can be rebuilt
function shapeAt(S, t) {
  let v = 0;
  for (let i = 0; i < 5; i++) v += PWEIGHT[i] * sin((TAU * t) / PERIODS[i] + S.ph[i]);
  return v / 1.9;
}
function headingOf(S, sh) {
  return 0.22 + S.amp * (0.7 * tanh(S.gain * sh) + 0.3 * cl(sh * 1.1, -1, 1));
}
function pushSample(S) {
  const n = S.sh.length;
  const tj = S.tBase + n * DT;
  const sh = shapeAt(S, tj + DT / 2);
  const th = headingOf(S, sh);
  const v = S.speed;
  S.sh.push(sh); S.spd.push(v); S.th.push(th);
  S.vx.push(v * sin(th)); S.vy.push(v * cos(th));
  if (n === 0) { S.cx.push(0); S.cy.push(0); }
  else { S.cx.push(S.cx[n - 1] + S.vx[n - 1] * DT); S.cy.push(S.cy[n - 1] + S.vy[n - 1] * DT); }
}
function rebuildPath(S) {
  const n = S.sh.length;
  let x = 0, y = 0;
  if (n) { x = S.cx[0]; y = S.cy[0]; }
  for (let j = 0; j < n; j++) {
    const th = headingOf(S, S.sh[j]);
    S.th[j] = th;
    S.vx[j] = S.spd[j] * sin(th); S.vy[j] = S.spd[j] * cos(th);
    S.cx[j] = x; S.cy[j] = y;
    x += S.vx[j] * DT; y += S.vy[j] * DT;
  }
}
// where the plate has got to at time t (LEDs, from the start of the stored series)
function pathAt(S, t, out) {
  const n = S.sh.length;
  let j = floor((t - S.tBase) / DT);
  if (j < 0) j = 0;
  if (j > n - 1) j = n - 1;
  const f = t - (S.tBase + j * DT);
  out[0] = S.cx[j] + f * S.vx[j];
  out[1] = S.cy[j] + f * S.vy[j];
}
function headingAtTime(S, t) {
  const n = S.sh.length;
  let j = floor((t - S.tBase) / DT);
  if (j < 0) j = 0;
  if (j > n - 1) j = n - 1;
  return S.th[j];
}

// ---- volcanoes
function plumePulse(S, t) {
  return 1 + 0.26 * sin((TAU * t) / 71.3 + S.pph[0]) + 0.18 * sin((TAU * t) / 43.7 + S.pph[1]) + 0.1 * sin((TAU * t) / 27.9 + S.pph[2]);
}
function newVolcano(S, ox, oy, size, sat) {
  const e = {
    bt: S.t, a0: S.ac, ox, oy, rn: 0.78 + 0.44 * rnd(), sz: size, sat,
    el: 1.05 + 0.2 * rnd(), da: (rnd() - 0.5) * 0.6, wa: 0.04 + 0.04 * rnd(), wb: 0.03 + 0.03 * rnd(),
    f1: rnd() * TAU, f2: rnd() * TAU, g2: rnd() * TAU, g3: rnd() * TAU, h1: rnd() * TAU, h2: rnd() * TAU, h3: rnd() * TAU,
  };
  S.ed.push(e);
  return e;
}
function birth(S) {
  S.nb++;
  S.lastBirthAc = S.ac;
  const size = S.szK * plumePulse(S, S.t);
  const lat = (rnd() - 0.5) * 5;
  const main = newVolcano(S, lat, 0, size * (0.85 + 0.3 * rnd()), false);
  if (rnd() < 0.3) {
    // a small cone beside the big one
    const side = rnd() < 0.5 ? -1 : 1;
    const Rm = R0 * clampSize(main.sz);
    const along = (rnd() - 0.3) * 0.8 * Rm;
    const sz = main.sz * (0.34 + 0.12 * rnd());
    newVolcano(S, lat + side * Rm * (1.0 + 0.35 * rnd()) * 0.95, along, sz, true);
  }
}
const clampSize = (s) => cl(s, 0.62, 1.6);
function schedule(S) {
  let gap = (16 / (S.rateK * sqrt(S.speed / 0.95))) * (0.75 + 0.5 * rnd());
  if (rnd() < 0.16) gap *= 0.36;
  S.tNext = S.t + gap;
}

function step(S, d) {
  S.t += d;
  while (S.t >= S.tBase + S.sh.length * DT) pushSample(S);
  const n = S.sh.length;
  S.ox += S.vx[n - 1] * d; S.oy += S.vy[n - 1] * d;
  S.ac += d * sqrt(S.speed);
  if (S.t >= S.tNext) { birth(S); schedule(S); }
  // the volcano over the plume grows to what the plume is now
  for (const e of S.ed) {
    const a = S.ac - e.a0;
    if (a < 8) {
      const tgt = S.szK * plumePulse(S, S.t) * e.rn * (e.sat ? 0.4 : 1);
      e.sz += (tgt - e.sz) * (1 - exp(-d / 2.5));
    }
  }
  // forget what has left
  const out = [0, 0];
  pathAt(S, S.t, out);
  for (let i = S.ed.length - 1; i >= 0; i--) {
    const e = S.ed[i], b = [0, 0];
    pathAt(S, e.bt, b);
    const y = QY + e.oy + out[1] - b[1];
    if (y > H + 60 || S.t - e.bt > 560) S.ed.splice(i, 1);
  }
  if (S.sh.length > 3400) {
    const cut = 1000;
    for (const key of ["sh", "spd", "cx", "cy", "vx", "vy", "th"]) S[key].splice(0, cut);
    S.tBase += cut * DT;
  }
}

function readKnobs(S, kn) {
  S.k = kn;
  const u1 = cl(kn[0], 0, 1);
  const u2 = cl(kn[1], 0, 4) / 4;
  const u3 = (cl(kn[2], -1, 1) + 1) / 2;
  const u4 = (cl(kn[3], -1, 1) + 1) / 2;
  S.speed = 0.3 * pow(10, u2);
  S.szK = 0.9 + 0.45 * u3;
  S.rateK = 0.5 + 1.1 * pow(u3, 1.2);
  const amp = 0.03 + 0.85 * pow(u4, 1.2), gain = 1 + 2.6 * pow(u4, 1.2);
  if (abs(amp - S.amp) > 1e-4 || abs(gain - S.gain) > 1e-4) {
    S.amp = amp; S.gain = gain;
    if (S.ready) rebuildPath(S);
  }
  if (abs(u1 - S.hue) > 0.0005) { S.hue = u1; buildPalette(S, u1); }
}

function preRoll(S) {
  const T0 = cl(130 / S.speed + 30, 110, 480);
  // phases that give the chain a visible bend: the heading has to swing across the stretch of the past the panel shows
  const seen = min(T0, 112 / S.speed);
  for (let tries = 0; tries < 24; tries++) {
    let lo = 9, hi = -9;
    for (let t = -seen; t <= 0; t += 2.5) { const v = shapeAt(S, t); if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi - lo > 1.05) break;
    S.ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU];
  }
  S.t = -T0; S.tBase = -T0 - 1;
  S.sh.length = 0; S.spd.length = 0; S.cx.length = 0; S.cy.length = 0; S.vx.length = 0; S.vy.length = 0; S.th.length = 0;
  pushSample(S);
  S.ed.length = 0;
  S.ac = 0; S.ox = 0; S.oy = 0;
  S.tNext = S.t + 0.5;
  S.ready = true;
  const d = 0.5;
  while (S.t < 0) step(S, d);
  // until the volcano over the plume is 3 to 6 seconds old
  const nb0 = S.nb;
  let guard = 0;
  while (S.nb === nb0 && guard++ < 400) step(S, d);
  const want = 3 + 3 * rnd();
  while (guard++ < 800 && S.ac - S.lastBirthAc < want) step(S, d);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  readKnobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.ready) preRoll(S);
  else step(S, d);
}

// ---- the height of the sea floor, summed for the panel
function plainHeight(S, x, y, fade) {
  const gx = x - S.ox, gy = y - S.oy;
  let z = BASE - 0.25 * (y / 127);
  z += 0.6 * (vnoise(gx / 70, gy / 70, 5) - 0.5);
  const hills = 0.5 * (vnoise(gx / 26, gy / 5.5, 3) - 0.5) + 0.3 * (vnoise(gx / 13 + 7.3, gy / 2.8 + 3.1, 4) - 0.5);
  z += hills * fade;
  // fracture zones, 8 degrees off the plate's own line
  const xq = gx + 0.14 * gy, P = 57;
  const cell = floor(xq / P), p = xq - cell * P, p0 = P * (0.3 + 0.4 * hash(cell, 0, 9)), dd = p - p0;
  const along = 0.45 + 0.55 * vnoise(gy / 35, cell * 3.1, 12);
  z += along * (-0.34 * exp(-(dd / 1.6) * (dd / 1.6)) + 0.2 * (hash(cell, 0, 11) - 0.5) * 2 * tanh(dd / 1.6) * exp(-(dd / 7) * (dd / 7)));
  // the swell the plume lifts
  const sx = (x - QX) / 20, sy = (y - QY) / 26;
  z += 0.45 * exp(-(sx * sx + sy * sy));
  return z;
}

function prepare(S) {
  const list = [];
  const now = [0, 0], bp = [0, 0];
  pathAt(S, S.t, now);
  const yc = 66 + 10 * sin((TAU * S.t) / 211 + S.wphase);
  const AP = 17, sAP = sqrt(AP);
  for (const e of S.ed) {
    const a = S.ac - e.a0;
    if (a < 0) continue;
    pathAt(S, e.bt, bp);
    const px = QX + e.ox + now[0] - bp[0], py = QY + e.oy + now[1] - bp[1];
    const size = clampSize(e.sz);
    const G = 1 - exp(-pow(a / 3.4, 1.5));
    const R = R0 * size * (0.72 + 0.28 * G);
    const Rb = R * 3.0 * e.el;
    if (px + Rb < -2 || px - Rb > W + 2 || py + Rb < -2 || py - Rb > H + 2) continue;
    const Hs0 = 0.4 + 1.9 * size;
    const relTot = -BASE + Hs0; // km of cone over the plain when full grown and not sunk
    const sub = SUBK * sqrt(a);
    const q = 1.3 + 1.0 * sm(0.5, 1.2, size) + 0.25 * sm(10, 100, a);
    // the top is planed to the sea surface between 7 and 17 age seconds, if it got above it
    const apexP = (1 - exp(-pow(AP / 3.4, 1.5))) * relTot + BASE - SUBK * sAP;
    const surf = sm(0.02, 0.2, apexP);
    const apex = G * relTot + BASE - sub;
    let zcut = 9;
    if (a >= 7) zcut = a < AP ? mix(apex + 0.3, -0.1, sm(7, AP - 3, a)) : -0.1 - SUBK * (sqrt(a) - sAP);
    zcut = mix(9, zcut, surf);
    const capRel = zcut - BASE;
    const Af = max(G * relTot - 0.45 * sub, 1e-3), Bf = 0.55 * sub; // sinking is part lowering, part spreading
    const fcap = (capRel + Bf) / Af;
    const uf = fcap < 1 ? 1.4 * pow(cl(1 - fcap, 0, 1), 1 / q) : 1.4;
    const warm = sm(34, 52, py) * (1 - sm(yc + 14, yc + 36, py));
    const reefAmt = sm(-1.3, -0.8, zcut) * surf * warm * sm(AP, AP + 4, a);
    const wear = 1 - 0.7 * sm(10, 100, a);
    const tE = 9 + 2 * size;
    const heat = a < tE ? sm(0.6, 3, a) : exp(-(a - tE) / 3.5);
    const ang = PI / 2 - headingAtTime(S, e.bt) + e.da; // the long axis lies along the chain
    const mA = 0.28 * cl(G * relTot / 5, 0, 1.3) * (0.45 + 0.55 * exp(-a / 70));
    list.push({
      e, a, px, py, R, Rb, G, Af, Bf, q, capRel, uf, reefAmt, wear, heat, tE, mA, size,
      ca: cos(ang), sa: sin(ang), cf1: cos(e.f1), sf1: sin(e.f1), cf2: cos(e.f2), sf2: sin(e.f2),
      cg2: cos(e.g2), sg2: sin(e.g2), cg3: cos(e.g3), sg3: sin(e.g3), ch1: cos(e.h1), sh1: sin(e.h1), ch2: cos(e.h2), sh2: sin(e.h2), ch3: cos(e.h3), sh3: sin(e.h3),
      lava: a < tE + 45 ? 1 : 0,
    });
  }
  return list;
}

function field(S) {
  const Z = S.Z, P3 = S.P3, HT = S.HT, RF = S.RF, LG = S.LG, DK = S.DK;
  P3.fill(0); HT.fill(0); RF.fill(0); LG.fill(0); DK.fill(0);
  for (let gy = 0; gy < GH; gy++) {
    const y = gy - 1 + 0.5;
    const fade = 1 - 0.85 * sm(80, 125, y);
    for (let gx = 0; gx < GW; gx++) Z[gy * GW + gx] = plainHeight(S, gx - 1 + 0.5, y, fade);
  }
  const list = prepare(S);
  for (const v of list) {
    const e = v.e;
    const x0 = max(-1, floor(v.px - v.Rb)), x1 = min(W, floor(v.px + v.Rb) + 1);
    const y0 = max(-1, floor(v.py - v.Rb)), y1 = min(H, floor(v.py + v.Rb) + 1);
    const wa = e.wa * v.wear, wb = e.wb * v.wear;
    const Rl = v.R * 3.0, Rl2 = Rl * Rl;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - v.px, dy = y + 0.5 - v.py;
        const xa = (dx * v.ca + dy * v.sa) / e.el, ya = -dx * v.sa + dy * v.ca;
        const r2 = xa * xa + ya * ya;
        if (r2 > Rl2 * 1.3) continue;
        const r = sqrt(r2) + 1e-6, ir = 1 / r;
        const cx = xa * ir, sx = ya * ir; // cos and sin of the angle
        const c2 = cx * cx - sx * sx, s2 = 2 * cx * sx;
        const c3 = c2 * cx - s2 * sx, s3 = s2 * cx + c2 * sx;
        const c5 = c2 * c3 - s2 * s3;
        const w = wa * (c2 * v.cf1 - s2 * v.sf1) + wb * (c3 * v.cf2 - s3 * v.sf2);
        const u = r / (v.R * (1 + w));
        const idx = (y + 1) * GW + (x + 1);
        // the plate bends under the load
        if (v.mA > 0.003 && u > 0.9 && u < 3.2) {
          const m1 = (u - 1.55) / 0.32, m2 = (u - 2.5) / 0.5;
          Z[idx] += 0.28 * v.mA * exp(-m2 * m2) - v.mA * exp(-m1 * m1);
        }
        if (u >= 1.4) continue;
        let rel = v.Af * (1 - pow(u / 1.4, v.q)) - v.Bf;
        if (rel < -0.3) continue;
        if (rel < 0.3) rel = ((rel + 0.3) * (rel + 0.3)) / 1.2;
        if (rel > v.capRel) {
          const kk = 0.08, hh = max(kk - (rel - v.capRel), 0) / kk;
          rel = v.capRel - hh * hh * kk * 0.25;
          if (rel > v.capRel) rel = v.capRel;
        }
        // gullies and rift ridges running down the flank
        if (u > 0.25 && u < 1.2) {
          const s5 = s2 * c3 + c2 * s3, c7 = c5 * c2 - s5 * s2, s7 = s5 * c2 + c5 * s2, c9 = c7 * c2 - s7 * s2;
          const gl = 0.5 * (c5 * v.cg2 - s5 * v.sg2) + 0.4 * (c7 * v.cg3 - s7 * v.sg3) + 0.3 * c9;
          rel += 0.2 * gl * sm(0.25, 0.5, u) * (1 - sm(0.95, 1.2, u)) * cl(rel / 2, 0, 1) * (1 - sm(v.capRel - 0.5, v.capRel - 0.05, rel));
        }
        // a reef ring round the flat top, a dimple for the lagoon
        if (v.reefAmt > 0.01) {
          const rr = (r - v.uf * v.R * (1 + w)) / 1.15;
          const ring = exp(-rr * rr);
          const lag = sm(0.3, -0.8, rr);
          rel += v.reefAmt * (0.14 * ring - 0.1 * lag);
          const rf = v.reefAmt * ring, lg = v.reefAmt * lag;
          if (rf > RF[idx]) RF[idx] = rf;
          if (lg > LG[idx]) LG[idx] = lg;
        }
        if (rel > 0) P3[idx] += rel * rel * rel;
        // lava: a vent at the summit, tongues down the flanks
        if (v.lava && u < 1.15) {
          let ht = e.sat ? 0 : exp(-r2 / 4.2) * v.heat * 1.2 + exp(-r2 / 60) * v.heat * 0.34;
          if (!e.sat) {
            const reach = v.a < v.tE ? sm(0, 6, v.a) : 1;
            const cool = v.a < v.tE ? 1 : exp(-(v.a - v.tE) / 14);
            const s5 = s2 * c3 + c2 * s3;
            // the lava field: a lobed outline round the vent, so that flows run farther in some directions than in others
            const lobe = 0.5 + 0.5 * (0.55 * (c2 * v.ch1 - s2 * v.sh1) + 0.5 * (c3 * v.ch2 - s3 * v.sh2) + 0.4 * (c5 * v.ch3 - s5 * v.sh3)) / 1.45;
            const tip = (0.42 + 0.6 * lobe) * reach;
            const fld = sm(tip, tip - 0.35, u);
            if (fld > 0.01) {
              const surge = 0.85 + 0.15 * sin(u * 9 - v.a * 1.7 + e.f1);
              const h = fld * v.heat * surge * (0.3 + 0.7 * pow(cl(1 - u / max(tip, 0.1), 0, 1), 0.8));
              if (h > ht) ht = h;
              const dkv = fld * cool;
              if (dkv > DK[idx]) DK[idx] = dkv;
            }
          }
          if (ht > HT[idx]) HT[idx] = ht;
        }
      }
    }
  }
  for (let i = 0; i < NG; i++) if (P3[i] > 0) Z[i] += pow(P3[i], 1 / 3);
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) update(0, { knobValues: [0, 2, 0, 0.06] }, params);
  field(S);
  const Z = S.Z, lut = S.lut, hl = S.hlut, HT = S.HT, RF = S.RF, LG = S.LG, DK = S.DK;
  const reef = S.extra.reef, lag = S.extra.lagoon, rock = S.extra.rock;
  const zs = (NZ - 1) / (LOOK_Z1 - LOOK_Z0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y + 1) * GW + (x + 1);
      let z = Z[i];
      // layer tint: the colour steps by 0.7 km up the flanks, as on a printed chart (the light still reads the true height)
      if (z > -4.0) {
        const q = (z - 0.15) / 0.7, fl = floor(q), fr = q - fl;
        z += ((fl + sm(0.3, 0.7, fr)) * 0.7 + 0.15 - z) * 0.8 * sm(-4.0, -3.6, z);
      }
      let zi = (z - LOOK_Z0) * zs;
      zi = zi < 0 ? 0 : zi > NZ - 1.001 ? NZ - 1.001 : zi;
      const k = floor(zi), f = zi - k;
      let r = lut[k * 3] + (lut[k * 3 + 3] - lut[k * 3]) * f;
      let g = lut[k * 3 + 1] + (lut[k * 3 + 4] - lut[k * 3 + 1]) * f;
      let b = lut[k * 3 + 2] + (lut[k * 3 + 5] - lut[k * 3 + 2]) * f;
      const lg = LG[i];
      if (lg > 0.01) { const t = lg * 0.8; r = mix(r, lag[0], t); g = mix(g, lag[1], t); b = mix(b, lag[2], t); }
      const rf = RF[i];
      if (rf > 0.01) { const t = rf * 0.85; r = mix(r, reef[0], t); g = mix(g, reef[1], t); b = mix(b, reef[2], t); }
      const dk = DK[i];
      if (dk > 0.01) { const t = dk * 0.7; r = mix(r, rock[0], t); g = mix(g, rock[1], t); b = mix(b, rock[2], t); }
      // light
      const sx = (Z[i + 1] - Z[i - 1]) * 0.5 * SHEAR, sy = (Z[i + GW] - Z[i - GW]) * 0.5 * SHEAR;
      const il = 1 / sqrt(sx * sx + sy * sy + 1);
      const lit = (-sx * LX - sy * LY + LZ) * il;
      let m = 1 + 1.7 * (lit - LZ);
      m = m < 0.38 ? 0.38 : m > 1.9 ? 1.9 : m;
      if (m > 1) { r *= pow(m, 1.25); g *= m; b *= pow(m, 0.8); } else { r *= pow(m, 1.3); g *= pow(m, 1.1); b *= pow(m, 0.85); }
      const h = HT[i];
      if (h > 0.02) {
        const hi = floor(cl(h, 0, 1) * 255) * 4;
        const a = hl[hi + 3];
        r = mix(r, hl[hi], a); g = mix(g, hl[hi + 1], a); b = mix(b, hl[hi + 2], a);
      }
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
  }
}
