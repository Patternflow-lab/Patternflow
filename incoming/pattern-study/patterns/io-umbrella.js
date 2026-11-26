// ===== Patternflow pattern =====
// Title:   Umbrella Plume
// Family:  ioplume
// Idea:    On the limb of Io, where there is no air to slow them, grains thrown in bursts from a glowing vent fly pure ballistic arcs and open one thin bright shell after another over the vent like an umbrella, which swells, flattens and falls back as a curtain onto a yellow moon that turns slowly.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the volcanic plumes of Io, predicted from tidal heating by Stan Peale, Patrick Cassen and Ray Reynolds (1979, from memory) and first seen by Linda Morabito in a Voyager 1 picture (March 1979, from memory), two classes of them, a tall dusty umbrella over a red ring like Pele and a low plume over a white-yellow ring like Prometheus (Alfred McEwen and Laurence Soderblom, 1983, from memory), the eruption into vacuum worked out as free ballistic flight (Susan Kieffer, 1982, from memory), and the shell of equal-speed throws, whose envelope Evangelista Torricelli called the parabola of safety (1640s, from memory). Original code, pattern round 263: a few thousand grains thrown in three dimensions under a pull towards the moon's centre, summed into a density buffer and read through an exposure curve, over a sphere with a drifting surface and a deposit map that turns with it.
// Round:   263
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.8..3.2, Angle=-1..1, Flux=-1..1
//
// Knob 1: Hue. Turns every colour of the picture round the wheel once over the knob's travel, keeping its lightness. At 0 the plume is pale blue and white with an orange vent over a sulfur-yellow ground, at 0.25 it is pink over a green ground, at 0.5 amber over a blue ground, at 0.75 green over a pink ground.
// Knob 2: Speed. How fast the grains leave the vent, 0.8 to 3.2 and opening at 2: 0.65 times the nominal 11.7 LED a second at 0.8, 1.0 times at 2, 1.35 times at 3.2. A plume climbs as the square of it, so the top of the highest shell is 14 LEDs over the vent at 0.8, 34 at 2 and 62 at 3.2 (an event's own scale of 0.86 to 1.2 of the speed and a gust's of 0.9 to 1.1 come on top). Grains in the air keep the speed they left with, so a turn shows first at the vent and takes five to ten seconds to reach the top.
// Knob 3: Angle. How wide the cone the grains leave in, signed, opening at 0: the half angle is 12 degrees at -1, 40 at 0 and 68 at 1, and each big event keeps 0.8 to 1.2 of it and each gust 0.78 to 1.22 of that. Narrow, a shell is a tall onion on a long stem that falls back close to the vent; wide, it is a flat umbrella whose curtain comes down far out, past the edges of the panel.
// Knob 4: Flux. How much material the vent gives, signed, opening at 0.06: 0.55 times the grains at -1, 1.0 at 0 and 2.4 at 1. Thin, the shells are faint and the vent glows almost alone; heavy, the shells fill to a bright cap and the haze between them thickens.

// What the picture is. The panel looks at the limb of Io. The moon is a disc of 96 LEDs radius whose top arc crosses the lower third of the panel, with black sky above it, and the ground is a sphere seen from outside: sulfur yellow,
// cream where sulfur dioxide frost lies, orange and rust in the older flows and a few dark patches of cooled caldera floor, shaded by a sun that swings slowly from the right to the front and back (periods of 6 and 9 minutes) with limb darkening. The ground
// is 3D value noise read in the moon's own frame, which turns about the axis pointing at the viewer at 0.010 radian a second, so the patches slide along the limb, about a minute across the panel, and the vents ride with them. Time here runs about sixty times fast.
// Eruptions are a list of events, not a cycle. A big event runs 24 to 46 s at a vent drawn so that the turning moon carries it across the middle of the panel during its run, and hands over to the next big one 5 to 10 s before it ends. A small one (a low plume
// like Prometheus's, at 0.56 to 0.7 of the speed, in a narrower cone and with grains a third as bright) comes every 10 to 28 s while none is alive. Inside an event the vent works in gusts, each a Gaussian surge 0.3 to 0.8 s wide that lifts the rate for that instant, 1.8 to 5 s apart, with a speed
// and a cone of its own and a trickle of 5 percent between them, so the vent runs up, flares, drops and flares again, and the next gust is never the last one's twin. The vent's place on the moon is fixed, so the plume leans as the vent rides round the limb and the old shells stay where they were.
// The grains are the picture. A gust throws about a thousand of them from the vent along the local vertical, tilted by an angle that fills the cone evenly by solid angle on a Fibonacci lattice, round an azimuth that steps by the golden angle, so a gust is a spherical cap of grains at one speed (spread by 1.2
// percent, the fast axis 12 percent quicker than the edge of the cone). Under a flat gravity the grains of one gust would stay on a sphere that grows at the throwing speed while its centre falls; the pull here points at the moon's centre (GM / r squared, 2 LED/s^2 at the ground),
// so the flight is integrated in three dimensions, one step a frame, and the caps come down on a curved ground. A cap seen from the side is a thin bright arc and a V of grains down to the vent, which is why a gust opens like an umbrella: the canopy is the rim of the cap, where the line of sight runs along the shell, and it is brighter than
// the inside because the inside is empty. Gusts a few seconds apart nest, and the envelope of all the arcs is the parabola of safety that the shells touch. A grain that lands is gone; if it lands on the side that faces the viewer it adds a spot to the deposit map, kept in the moon's frame and fading over
// 70 s, which is the red-orange ring round a vent, and a grain behind the moon is hidden by it.
// Drawing sums the grains into a density buffer. A young grain is a soft round spot of 1.1 LED sigma with two fainter spots behind it along its velocity, so a falling grain draws a short streak; an old one has spread into a big thin shell and goes in as a point that a double blur
// turns into a soft cloud, and it dims to 0.15 of itself by 11 s. A grain also fades over its last three LEDs before the ground and over its first 2.5 s, so a gust opens from the vent and is not a white ball. An exposure curve, (1 - exp(-0.9 D)) to the 1.5, folds the sum into 0 to 1 and a table
// gives the colour, navy, lilac-blue and pale blue to cream, while a second buffer that weights each spot by exp(-age / 3.2 s) mixes orange in, so a shell is amber when it is born, cools through cream and goes blue as it spreads. A faster or a wider plume spreads the same grains over a bigger shell, so each grain counts for more.
// The vent is an orange hole on the limb with a white core and a glow that breathes with the surge of its event and flickers with two fast sines. Last, one 3 by 3 matrix turns the hue of every pixel by the first knob.
// The first update runs twelve seconds of the physics with a big event nine seconds old and a small one three seconds old, so the plume is up on the first frame; the knobs of the first update decide how it looks.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, acos, min, max, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();

// ---- the moon and the physics
const CX = 32, RP = 96, YH = 86, CYC = YH + RP;     // centre of the moon, radius, the limb's top row
const G0 = 2.0, GM = G0 * RP * RP;                   // LED/s^2 at the ground
const VNOM = sqrt(2 * G0 * 34);                      // a 34 LED dome at speed 1
const OMEGA = 0.010;                                 // turn of the moon, radian a second
const NP = 9000;                                     // grains kept
const DG = 100, DC = 2;                              // deposit grid, 2 LED cells over the moon's disc
const LAT = 900;                                     // points of the lattice a gust is thrown on
const MASS = 15;                                     // the mass of a fine spot, to match it with a point
const RATE = 1400;                                   // grains a second at a surge of 1 and a flux of 1
const PW = 0.026, EXPO = 0.9;                        // weight of a grain in the density, and the exposure
const SPREAD = 0.012;                                // spread of the speeds of one gust
const DEPT = 70;                                     // seconds the deposit takes to fade

// ---- noise in three dimensions, for the ground
function h3(i, j, k) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2246822519) + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn3(x, y, z) {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = h3(ix, iy, iz), b = h3(ix + 1, iy, iz), c = h3(ix, iy + 1, iz), d = h3(ix + 1, iy + 1, iz);
  const e = h3(ix, iy, iz + 1), f = h3(ix + 1, iy, iz + 1), g = h3(ix, iy + 1, iz + 1), h = h3(ix + 1, iy + 1, iz + 1);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return y0 + (y1 - y0) * fz;
}

// ---- colours, tables of 256
function lerpTable(stops, out) {
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let k = 0;
    while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
    const a = stops[k], b = stops[k + 1];
    const t = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
    out[i * 3] = mix(a[1], b[1], t); out[i * 3 + 1] = mix(a[2], b[2], t); out[i * 3 + 2] = mix(a[3], b[3], t);
  }
}
const PLUME = new Float32Array(768), WARM = new Float32Array(768), GROUND = new Float32Array(768);
lerpTable([[0, 0, 0, 0], [0.07, 28, 22, 72], [0.22, 66, 72, 184], [0.45, 132, 164, 240], [0.72, 214, 230, 252], [1, 255, 250, 238]], PLUME);
lerpTable([[0, 0, 0, 0], [0.15, 110, 34, 6], [0.45, 255, 104, 20], [0.8, 255, 160, 52], [1, 255, 206, 110]], WARM);
// ground colour by the patch field: rust, ochre, sulfur, pale sulfur, frost
lerpTable([[0, 178, 84, 34], [0.28, 222, 160, 56], [0.5, 232, 196, 78], [0.75, 240, 222, 138], [1, 246, 240, 214]], GROUND);

// exp(-q) for q in 0..8, as a table, and the one soft spot of a grain
const EXPN = 512, EXPK = EXPN / 8;
const EXPT = new Float32Array(EXPN + 1);
for (let i = 0; i <= EXPN; i++) EXPT[i] = exp(-i / EXPK);

function makeState() {
  return {
    t: 0, rot: 0, ready: false, n: 0,
    x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP),
    vx: new Float32Array(NP), vy: new Float32Array(NP), vz: new Float32Array(NP),
    w: new Float32Array(NP), age: new Float32Array(NP),
    ev: [], next: 0,
    D: new Float32Array(NPX), HW: new Float32Array(NPX), BL: new Float32Array(NPX), B: new Float32Array(NPX), TMP: new Float32Array(NPX),
    dep: new Float32Array(DG * DG),
    hue: -1, M: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    v0: VNOM, thmax: 0.6981, flux: 1, gain: 1, nextSmall: 6,
  };
}

export function setup(params) {
  params.s = makeState();
}

function readKnobs(S, kn) {
  const u2 = cl((kn[1] - 0.8) / 2.4, 0, 1);
  S.v0 = VNOM * (0.65 + 0.7 * u2);
  const a3 = cl(kn[2], -1, 1);
  S.thmax = (40 + 28 * a3) * PI / 180;
  S.flux = pow2(cl(kn[3], -1, 1));
  // a faster or a wider plume spreads the same grains over a bigger shell, so each counts for more
  S.gain = cl(Math.pow(S.v0 / VNOM, 1.4) * sqrt((1 - cos(S.thmax)) / (1 - cos(0.6981))), 0.4, 2.6);
  const hu = cl(kn[0], 0, 1);
  if (abs(hu - S.hue) > 0.0005) {
    S.hue = hu;
    const a = hu * TAU, c = cos(a), s = sin(a);
    S.M = [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    ];
  }
}
// 0.55 at -1, 1 at 0, 2.4 at 1
function pow2(u) {
  return u < 0 ? 1 + 0.45 * u : 1 + 1.4 * u;
}

// ---- eruptions
function alphaOf(S, e) { return e.beta + S.rot; }

// kind 0 is a big plume like Pele's, a tall dome on a long run of gusts; kind 1 is a small low one like Prometheus's
function newEvent(S, ts, kind) {
  const small = kind === 1;
  const dur = small ? 6 + 7 * rnd() : 24 + 22 * rnd();
  // the vent is drawn so that the turning moon carries it across the middle of the panel during its run
  let a = 0, best = -1;
  for (let c = 0; c < 6; c++) {
    const cand = -0.5 * OMEGA * dur + (rnd() - 0.5) * (small ? 0.6 : 0.24);
    let dist = 9;
    for (const e of S.ev) dist = min(dist, abs(cand - alphaOf(S, e)));
    if (dist > best) { best = dist; a = cand; }
  }
  // gusts, one after the other: each a puff of 0.3 to 0.8 s, 1.8 to 5 s from the one before, with a speed of its own
  const pulses = [];
  let c = 0.4 + 1.0 * rnd();
  while (c < dur - 0.5) {
    pulses.push({ c, w: 0.3 + 0.5 * rnd(), a: 0.75 + 0.55 * rnd(), sf: 0.9 + 0.2 * rnd(), cf: 0.78 + 0.44 * rnd() });
    c += 1.8 + 3.2 * rnd();
  }
  S.ev.push({
    ts, dur, small, beta: a - S.rot,
    vs: small ? 0.56 + 0.14 * rnd() : 0.86 + 0.34 * rnd(),
    str: small ? 0.45 + 0.3 * rnd() : 0.8 + 0.4 * rnd(), gw: small ? 0.3 : 1,
    cone: small ? 0.55 + 0.3 * rnd() : 0.8 + 0.4 * rnd(),
    pulses, acc: 0, k: 0, o2: rnd(), ph: rnd() * TAU, ph2: rnd() * TAU, lvl: 0, pm: 1, pc: 1,
  });
}

// the surge of an event at a time into it: 0 to about 1.6
function level(e, tau) {
  if (tau < 0 || tau > e.dur + 1) return [0, 1, 1];
  const up = sm(0, 1.4, tau), down = 1 - sm(e.dur - 3, e.dur, tau);
  let p = 0.05, best = 0, sf = 1, cf = 1;
  for (const q of e.pulses) {
    const z = (tau - q.c) / q.w, v = q.a * exp(-z * z);
    p += v;
    if (v > best) { best = v; sf = q.sf; cf = q.cf; }
  }
  return [up * down * p * e.str, sf, cf];
}

function spawn(S, e) {
  if (S.n >= NP) return;
  const i = S.n++;
  const al = alphaOf(S, e), sa = sin(al), ca = cos(al);
  const k = e.k++;
  const thm = S.thmax * e.cone * e.pc;
  const th = acos(1 - ((k % LAT) + 0.5) / LAT * (1 - cos(thm)));
  const ph = k * 2.399963229728653 + e.o2 * TAU;
  const edge = (1 - cos(th)) / (1 - cos(thm));
  const prof = 1 - 0.12 * edge;
  const gs = (rnd() + rnd() + rnd() - 1.5) * 2;
  const v = S.v0 * e.vs * e.pm * prof * (1 + SPREAD * gs);
  const ct = cos(th), st = sin(th), cp = cos(ph), sp = sin(ph);
  // local frame: n up the normal, t along the limb, z at the viewer
  const dn = ct, dt = st * cp, dz = st * sp;
  S.x[i] = CX + (RP + 0.3) * sa; S.y[i] = CYC - (RP + 0.3) * ca; S.z[i] = 0;
  S.vx[i] = v * (dn * sa + dt * ca); S.vy[i] = v * (-dn * ca + dt * sa); S.vz[i] = v * dz;
  S.w[i] = (0.7 + 0.6 * rnd()) * e.gw;
  S.age[i] = 0;
}

// a grain lands: the near side keeps a spot of it in the moon's frame
function land(S, i, cs, sn) {
  if (S.z[i] <= 0) return;
  const dx = S.x[i] - CX, dy = S.y[i] - CYC;
  const bx = dx * cs + dy * sn, by = dy * cs - dx * sn;
  const gx = (bx + RP) / DC, gy = (by + RP) / DC;
  const x0 = floor(gx), y0 = floor(gy);
  for (let j = -1; j <= 2; j++) {
    for (let l = -1; l <= 2; l++) {
      const xx = x0 + l, yy = y0 + j;
      if (xx < 0 || xx >= DG || yy < 0 || yy >= DG) continue;
      const ddx = xx + 0.5 - gx, ddy = yy + 0.5 - gy;
      const q = (ddx * ddx + ddy * ddy) * 0.9;
      if (q > 4) continue;
      S.dep[yy * DG + xx] += S.w[i] * exp(-q) * 0.009;
    }
  }
}

function stepWorld(S, d) {
  S.t += d;
  S.rot += d * OMEGA;
  const cs = cos(S.rot), sn = sin(S.rot);
  // events: a big plume hands over to the next one while its last gusts are still in the air, and a small one comes now and then
  for (let i = S.ev.length - 1; i >= 0; i--) {
    const e = S.ev[i], tau = S.t - e.ts;
    if (tau > e.dur + 1) { S.ev.splice(i, 1); continue; }
    const lp = level(e, tau);
    e.lvl = lp[0]; e.pm = lp[1]; e.pc = lp[2];
  }
  if (S.t >= S.next) {
    newEvent(S, S.t, 0);
    const e = S.ev[S.ev.length - 1];
    S.next = S.t + e.dur - 5 - 5 * rnd();
  }
  let live = 0;
  for (const e of S.ev) if (!e.small && S.t - e.ts < e.dur - 2) live = 1;
  if (!live && S.next - S.t > 1.5) S.next = S.t + 1;
  if (S.t >= S.nextSmall) {
    let ns = 0;
    for (const e of S.ev) ns += e.small ? 1 : 0;
    if (ns < 1) newEvent(S, S.t, 1);
    S.nextSmall = S.t + 10 + 18 * rnd();
  }
  for (const e of S.ev) {
    e.acc += RATE * e.lvl * S.flux * d;
    while (e.acc >= 1) { e.acc -= 1; spawn(S, e); }
  }
  // grains
  const SUBS = d > 0.06 ? 2 : 1, h = d / SUBS;
  let n = S.n;
  for (let i = 0; i < n; i++) {
    let x = S.x[i], y = S.y[i], z = S.z[i], vx = S.vx[i], vy = S.vy[i], vz = S.vz[i];
    let landed = false;
    for (let s = 0; s < SUBS; s++) {
      const rx = x - CX, ry = y - CYC;
      const r2 = rx * rx + ry * ry + z * z, r = sqrt(r2);
      const f = -GM / (r2 * r);
      vx += rx * f * h; vy += ry * f * h; vz += z * f * h;
      x += vx * h; y += vy * h; z += vz * h;
      const rx2 = x - CX, ry2 = y - CYC;
      if (rx2 * rx2 + ry2 * ry2 + z * z < RP * RP) { landed = true; break; }
    }
    S.age[i] += d;
    if (landed) {
      S.x[i] = x; S.y[i] = y; S.z[i] = z;
      land(S, i, cs, sn);
    }
    if (landed || x < -80 || x > 144 || y < -40 || S.age[i] > 40) {
      n--;
      S.x[i] = S.x[n]; S.y[i] = S.y[n]; S.z[i] = S.z[n];
      S.vx[i] = S.vx[n]; S.vy[i] = S.vy[n]; S.vz[i] = S.vz[n];
      S.w[i] = S.w[n]; S.age[i] = S.age[n];
      i--;
      continue;
    }
    S.x[i] = x; S.y[i] = y; S.z[i] = z; S.vx[i] = vx; S.vy[i] = vy; S.vz[i] = vz;
  }
  S.n = n;
  // the deposit fades
  const dec = exp(-d / DEPT);
  const dep = S.dep;
  for (let i = 0; i < dep.length; i++) dep[i] *= dec;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  readKnobs(S, (input && input.knobValues) || [0, 2, 0, 0.06]);
  if (!S.ready) {
    S.ready = true;
    S.rot = 0;
    S.nextSmall = 8;
    newEvent(S, -9, 0); S.ev[0].beta = -0.25 - S.rot;
    newEvent(S, -3, 1); S.ev[1].beta = 0.02 - S.rot;
    S.next = -9 + S.ev[0].dur - 6;
    S.t = -12;
    for (let i = 0; i < 96; i++) stepWorld(S, 1 / 8);
  } else {
    stepWorld(S, d);
  }
}

// ---- drawing
// the mean of a box of side 2R + 1, zero outside the panel
function blur(src, dst, tmp, R) {
  const K = 1 / ((2 * R + 1) * (2 * R + 1));
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let acc = 0;
    for (let x = 0; x <= R; x++) acc += src[o + x];
    for (let x = 0; x < W; x++) {
      tmp[o + x] = acc;
      if (x - R >= 0) acc -= src[o + x - R];
      if (x + R + 1 < W) acc += src[o + x + R + 1];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = 0; y <= R; y++) acc += tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc * K;
      if (y - R >= 0) acc -= tmp[(y - R) * W + x];
      if (y + R + 1 < H) acc += tmp[(y + R + 1) * W + x];
    }
  }
}

// every grain into the density: the young ones as soft round spots with a short tail, the old ones, which have spread
// into a big thin shell, as points that a double box blur turns into a wide soft cloud
function paint(S) {
  const D = S.D, HW = S.HW, B = S.B;
  D.fill(0); HW.fill(0); B.fill(0);
  const n = S.n;
  const X = S.x, Y = S.y, Z = S.z, VX = S.vx, VY = S.vy, WT = S.w, AG = S.age;
  const IS2 = 1 / (2 * 1.1 * 1.1);
  for (let i = 0; i < n; i++) {
    const px = X[i], py = Y[i];
    if (px < -6 || px > W + 6 || py < -6 || py > H + 6) continue;
    const dxm = px - CX, dym = py - CYC, rr2 = dxm * dxm + dym * dym;
    if (Z[i] < 0 && rr2 < RP * RP) continue;
    const alt = sqrt(rr2 + Z[i] * Z[i]) - RP;
    const wt = WT[i] * sm(0, 3, alt) * PW * S.gain * (0.12 + 0.88 * sm(0, 2.5, AG[i])) * (1 - 0.85 * sm(4, 11, AG[i]));
    const yo = sm(1.0, 7, AG[i]);
    const wy = wt * (1 - yo), wo = wt * yo * MASS;
    if (wo > 0.0004) {
      const fx = px - 0.5, fy = py - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
      if (ix >= 0 && iy >= 0 && ix < W - 1 && iy < H - 1) {
        const k = iy * W + ix;
        B[k] += wo * (1 - tx) * (1 - ty); B[k + 1] += wo * tx * (1 - ty);
        B[k + W] += wo * (1 - tx) * ty; B[k + W + 1] += wo * tx * ty;
      }
    }
    if (wy > 0.0004) {
      const hot = exp(-AG[i] / 3.2);
      // a grain and two fainter spots behind it along its velocity
      for (let s = 0; s < 3; s++) {
        const qx = px - VX[i] * 0.045 * s, qy = py - VY[i] * 0.045 * s;
        const ww = wy * (s === 0 ? 1 : 0.5);
        const ix = floor(qx - 0.5), iy = floor(qy - 0.5);
        for (let j = -1; j <= 3; j++) {
          const yy = iy + j;
          if (yy < 0 || yy >= H) continue;
          const ddy = yy + 0.5 - qy;
          for (let l = -1; l <= 3; l++) {
            const xx = ix + l;
            if (xx < 0 || xx >= W) continue;
            const ddx = xx + 0.5 - qx;
            const q = (ddx * ddx + ddy * ddy) * IS2;
            if (q > 7.5) continue;
            const v = ww * EXPT[(q * EXPK) | 0];
            D[yy * W + xx] += v;
            HW[yy * W + xx] += v * hot;
          }
        }
      }
    }
  }
  blur(B, S.BL, S.TMP, 2);
  blur(S.BL, B, S.TMP, 2);
  for (let p = 0; p < NPX; p++) D[p] += B[p];
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) update(0, { knobValues: [0, 2, 0, 0.06] }, params);
  paint(S);
  const D = S.D, HW = S.HW;
  // glows of the vents
  const gl = [];
  for (const e of S.ev) {
    const al = alphaOf(S, e);
    const fl = 0.85 + 0.1 * sin(S.t * 13.1 + e.ph) + 0.06 * sin(S.t * 23.7 + e.ph2);
    const I = cl(0.1 + 0.95 * e.lvl, 0, 1.2) * fl;
    gl.push([CX + RP * sin(al), CYC - RP * cos(al), I]);
  }
  const cs = cos(S.rot), sn = sin(S.rot);
  const M = S.M;
  // the sun swings slowly: from the right at some hours of the moon's day, from the front at others
  const SXL = 0.42 + 0.34 * sin(S.t * 0.0173 + 0.8), SYL = -0.4 + 0.12 * sin(S.t * 0.0113 + 2.1), SZL = 0.8;
  const dep = S.dep;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - CYC;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      const rr = sqrt(dx * dx + dy * dy);
      let r = 0, g = 0, b = 0;
      const cov = cl(RP + 0.5 - rr, 0, 1);
      if (cov > 0) {
        const nx = dx / RP, ny = dy / RP, nz = sqrt(max(0, 1 - nx * nx - ny * ny));
        const bx = dx * cs + dy * sn, by = dy * cs - dx * sn;
        const px = bx / RP, py = by / RP;
        const f1 = 0.55 * vn3(px * 2.1 + 3, py * 2.1, nz * 2.1) + 0.3 * vn3(px * 4.6, py * 4.6 + 5, nz * 4.6) + 0.15 * vn3(px * 10, py * 10, nz * 10 + 9);
        const f2 = 0.65 * vn3(px * 1.5 + 11, py * 1.5 + 2, nz * 1.5 + 7) + 0.35 * vn3(px * 4.2, py * 4.2 + 6, nz * 4.2);
        const f3 = vn3(px * 2.4 + 21, py * 2.4 + 8, nz * 2.4 + 13);
        const dkn = 0.62 * vn3(px * 8.5 + 17, py * 8.5 + 4, nz * 8.5 + 1) + 0.38 * vn3(px * 17 + 3, py * 17, nz * 17 + 6);
        const dk = sm(0.69, 0.75, dkn);
        const gi = (cl((f1 - 0.25) * 1.9, 0, 1) * 255) | 0;
        r = GROUND[gi * 3]; g = GROUND[gi * 3 + 1]; b = GROUND[gi * 3 + 2];
        const rust = sm(0.5, 0.72, f2) * 0.7;
        r = mix(r, 168, rust); g = mix(g, 70, rust); b = mix(b, 36, rust);
        const fr = sm(0.66, 0.8, f3) * 0.8;
        r = mix(r, 250, fr); g = mix(g, 246, fr); b = mix(b, 232, fr);
        r = mix(r, 44, dk * 0.9); g = mix(g, 26, dk * 0.9); b = mix(b, 20, dk * 0.9);
        const lam = cl(nx * SXL + ny * SYL + nz * SZL, 0, 1);
        const shade = 0.14 + 0.78 * Math.pow(lam, 0.85);
        // the red ring: what landed, read in the moon's own frame
        const gx = (bx + RP) / DC - 0.5, gy = (by + RP) / DC - 0.5;
        const x0 = floor(gx), y0 = floor(gy);
        if (x0 >= 0 && y0 >= 0 && x0 < DG - 1 && y0 < DG - 1) {
          const fx = gx - x0, fy = gy - y0, k = y0 * DG + x0;
          const dv = dep[k] * (1 - fx) * (1 - fy) + dep[k + 1] * fx * (1 - fy) + dep[k + DG] * (1 - fx) * fy + dep[k + DG + 1] * fx * fy;
          const a = (1 - exp(-dv * 0.9)) * 0.85;
          r = mix(r, 205, a); g = mix(g, 52, a); b = mix(b, 26, a);
        }
        r *= shade * cov; g *= shade * cov; b *= shade * cov;
      }
      // the plume
      const p = y * W + x;
      const dsum = D[p];
      if (dsum > 0.002) {
        const m0 = 1 - exp(-EXPO * dsum), m = m0 * sqrt(m0);
        const mi = ((m * 255) | 0) * 3;
        let hf = HW[p] / (dsum + 0.02);
        hf = cl(hf * 1.2, 0, 1);
        hf = hf * sqrt(hf);
        const pr = PLUME[mi] * (1 - hf) + WARM[mi] * hf, pg = PLUME[mi + 1] * (1 - hf) + WARM[mi + 1] * hf, pb = PLUME[mi + 2] * (1 - hf) + WARM[mi + 2] * hf;
        r += pr * (1 - r / 400); g += pg * (1 - g / 400); b += pb * (1 - b / 400);
      }
      // the vents
      for (let k = 0; k < gl.length; k++) {
        const ddx = x + 0.5 - gl[k][0], ddy = y + 0.5 - gl[k][1];
        if (ddx > 12 || ddx < -12 || ddy > 12 || ddy < -12) continue;
        const d2 = ddx * ddx + ddy * ddy;
        const gv = gl[k][2] * (exp(-d2 / 3.2) + 0.45 * exp(-d2 / 14) + 0.18 * exp(-d2 / 50));
        const wr = 255 * gv, wg = 120 * gv + 90 * exp(-d2 / 3.2) * gl[k][2], wb = 28 * gv + 80 * exp(-d2 / 2.2) * gl[k][2];
        r += wr; g += wg; b += wb;
      }
      r = cl(r, 0, 255); g = cl(g, 0, 255); b = cl(b, 0, 255);
      const R = M[0] * r + M[1] * g + M[2] * b, G = M[3] * r + M[4] * g + M[5] * b, B = M[6] * r + M[7] * g + M[8] * b;
      display.setPixel(x, y, cl(R, 0, 255) | 0, cl(G, 0, 255) | 0, cl(B, 0, 255) | 0);
    }
  }
}
