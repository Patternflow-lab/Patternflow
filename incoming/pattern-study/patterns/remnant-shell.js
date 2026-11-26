// ===== Patternflow pattern =====
// Title:   Remnant Shell
// Family:  remnant
// Idea:    A young supernova remnant in false colour on a black sky, as the X-ray and optical composites of Tycho's and Cassiopeia A show it: a thin, rippled, blue-white forward shock nearly fills the panel, fingers of ejecta grow out from inside toward it, a ring of yellow-white flashes marks where the reverse shock is lighting the knots, green, red and blue knots cool and sink inward while new ones light up, and now and then a jet of fast knots breaks out through the shell.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the point-blast solution for a strong explosion, whose shock radius grows as time to the 2/5 (Leonid Sedov, 1946, and Geoffrey Taylor, 1950, from memory); the reverse shock that runs back into the ejecta of a young remnant (Christopher McKee, 1974, from memory); the contact discontinuity between shocked ejecta and shocked gas is Rayleigh-Taylor unstable and grows fingers toward the forward shock (Roger Chevalier, John Blondin and Robert Emmering, 1992, from memory); the thin synchrotron rim and the oxygen, silicon and iron knots of Tycho's remnant and of Cassiopeia A as the Chandra and Hubble composites show them, and the fast jets of Cassiopeia A (from memory). Original code, pattern round 262: everything is placed in similarity coordinates rho = r / R and an angle, with the camera riding the shell so that its size on the panel stays put; a list of fingers that grow by a logistic law; a list of knots that flash at the reverse-shock ring and then sink as (1 + age / 22 s) to the power -0.4, the way the shocked interior of a Sedov blast falls behind the shock; layers of filament noise that are zoomed out in turn, so old filaments shrink toward the middle and fade while new ones come in at the outside; and jets that start at random times.
// Round:   264
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Age=0..4, Clumpiness=-1..1, Asymmetry=-1..1
//
// Knob 1: Hue. Turns the false-colour assignment round the grey axis of RGB, 360 degrees from 0 to 1, so 1 is 0 again. At 0 the shell is blue-white (148, 189, 255) and pale cyan (102, 224, 250), oxygen is green-teal (15, 230, 153), silicon and sulphur red-magenta (255, 36, 102), iron deep blue (36, 61, 255), the shocked gas a faint warm haze (230, 97, 56) and the reverse-shock ring yellow-white (255, 230, 128). At 0.5 the shell is gold-peach (247, 206, 139), oxygen is pink and silicon teal-green; at 0.25 and 0.75 the shell is pink and lime.
// Knob 2: Age. How evolved the remnant is, 0 to 4, opening at 2. It sets the finger height (tips 1.5 to 4 LED above their base at 0, 5 to 13 LED at 2, up to 0.97 of the radius at 4), how many fingers and knots are alive (7 and 13 at 0, 19 and 22 at 2, 32 and 34 at 4, counting the ones that have faded to a glimmer), where the ring sits (0.74, 0.61 and 0.48 of the shell radius, which is 25, 21 and 16 LED) and how bright it is (0.18 of full at 0, full from 3.2 up), how ragged the shell is (ripples 0.4, 1.0 and 1.6 times those at the opening), and how strong the filament net and the haze are. At 0 the picture is a smooth thin shell with a faint ring and a few knots; at 4 it is a ragged shell with fingers all round and a small bright ring.
// Knob 3: Clumpiness. How many knots and filaments and how ragged the shell is, -1 to 1, opening at 0. The rate at which knots and fingers appear is 0.35 times that at the opening at -1 and 1.65 times at 1, so about 5 fingers and 9 knots are alive at -1, and 30 and 37 at 1. The ejecta lumps that set where knots light and how bright the ring is run from a contrast of 0.4 at -1, an even ring, to 2.6 at 1, three or four bright clumps with dark gaps; the shell ripples are 0.5 to 1.5 times the opening ones, the filament lines are 3.1 LED wide at -1 and 2.5 at 1 (full width at half height) and more of them, and the shell breaks into brighter and dimmer stretches.
// Knob 4: Asymmetry. The off-centre offset, the ellipticity and the jets, -1 to 1, opening at 0.06. The shell centre wanders on its own over a minute or so; the knob sets how far, from about 2 LED at -1 to about 7 LED across and 9 LED along the panel at 1 (and up to twice that at the swings). The shell is stretched along its axis, which hangs near vertical, 1.07 times its width at -1 and 1.22 times at 1; the ring is pushed off the shell's centre by 0 at -1 and up to 0.42 of its radius at 1. Jets leave at a mean rate of 0.085 a second times the knob's 0..1 position to the power 1.8: none at -1, one every 37 s at the opening and one every 12 s at 1, with a counter-jet half the time at the opening and four times in five at 1.

// What the picture is. The panel is the sky round a supernova remnant in the colours of a false-colour composite: black, with eight faint stars outside the shell. The shell is a thin bright line (2.5 LED across at half height), blue-white and paler where it is brightest, 68 LED across at the opening, so it nearly fills the panel's 64 and is cut by the edge when its centre wanders. It is brighter on two opposite rims, which swing slowly round,
// rippled by eight modes of 5 to 26 lobes whose phases drift round at their own speeds and whose strengths swell and die in turn, so no ripple pattern comes back, and broken in patches where it dims to between 0.37 and 0.72 of its brightness, deeper with Age and Clumpiness. Just inside it lie a soft blue-white limb and a faint warm haze of shocked gas. The camera rides the shell: its radius is 34 LED with a wander of a couple of LED, so everything else is read against it as rho = r / R.
// Inside the shell the contact discontinuity grows fingers. Each is a list entry: an angle, a birth time, a final length, and a logistic growth h = 1 / (1 + (1 / 0.03 - 1) exp(-a / tau)) with tau of 3.5 to 7 s, so it starts exponentially, as the instability does, and then saturates. It is drawn as a wedge 2.6 to 3.8 LED wide at the base and 1.4 times wider at the tip (the cap of a Rayleigh-Taylor mushroom), with a wobbling edge and a slight bend, brighter and whiter at the tip, in the colour of its element. After 26 to 48 s it lets go, sinks as (1 + a / 20)^-0.4 and fades over 11 s. A new one starts at the angle farthest from the others of eight tried.
// The ring of the reverse shock is a yellow-white line at rho 0.48 to 0.74, broken into beads by a noise of about 7 LED and brightest where the ejecta lumps are (four random angular modes that swell and die). A knot is lit where the reverse shock is: it appears at the ring or just outside it (0.02 to 0.13 of the radius), flashes yellow-white for a couple of seconds, cools into the colour of its element (oxygen, silicon or iron), and sinks as (1 + a / 22)^-0.4 while it fades over 14 to 26 s. It is a main blob of 3 to 7 LED with two lesser ones beside it, so it reads as a knot and not a dot.
// Between the shell and the middle lies a net of thin filaments, the isolines of domain-warped value noise at three levels, drawn in three layers. Each layer is zoomed out by a factor of e^0.45 over 28 to 44 s about the middle of the shell, so its filaments move inward and shrink in proportion to their radius, and it is faded in and out by sin squared of its phase. When one ends a new one starts with a fresh seed, so old filaments fade and new ones come in. The colour of the net follows a slow patch noise between the three elements, and the net is a third as bright inside the ring.
// Jets: at random times a chain of five to eight knots is sent along the axis from inside the shell to beyond it, at 2.4 to 4.2 LED a second for the head, which is white-teal and the biggest; the rest are smaller and cool into silicon red, each slowing as r = r0 + v tau (1 - exp(-a / tau)) with tau of 7 to 11 s, with a thin beam between them. A jet lasts 20 to 26 s, and as its head crosses the shell it pushes a bulge into it that heals over a few seconds.
// The first update pre-rolls 140 s of the whole model in 0.25 s steps, so the panel opens on a remnant with fingers of all ages, a lit ring and knots on their way inward.

const W = 64, H = 128, NPX = W * H;
const NA = 720; // angular tables, 0.5 degree a step
const { floor, sqrt, exp, sin, cos, min, max, abs, PI, atan2, pow, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const gauss = () => sqrt(-2 * log(1 - rnd())) * cos(TAU * rnd());

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

// ---- colours: the opening false-colour assignment, rotated round the grey axis by the Hue knob
const BASE = {
  shA: [0.58, 0.74, 1.0],   // synchrotron, blue-white
  shB: [0.40, 0.88, 0.98],  // synchrotron, pale cyan
  ox: [0.06, 0.90, 0.60],   // oxygen, green-teal
  si: [1.0, 0.14, 0.40],    // silicon and sulphur, red-magenta
  fe: [0.14, 0.24, 1.0],    // iron, deep blue
  hz: [0.90, 0.38, 0.22],   // shocked gas, faint warm
  rg: [1.0, 0.90, 0.50],    // reverse-shock ring, yellow-white
  wh: [0.92, 0.96, 1.0],    // hot white, tips and heads
};
function rotHue(c, a) {
  const ca = cos(a), sa = sin(a), k = (1 - ca) / 3, s3 = sa / sqrt(3);
  const r = c[0], g = c[1], b = c[2], d = k * (r + g + b);
  return [
    cl(r * ca + d + s3 * (b - g), 0, 1),
    cl(g * ca + d + s3 * (r - b), 0, 1),
    cl(b * ca + d + s3 * (g - r), 0, 1),
  ];
}
function buildPal(S) {
  const a = S.hue * TAU;
  S.pal = {};
  for (const k in BASE) S.pal[k] = rotHue(BASE[k], a);
  S.palHue = S.hue;
}

// ---- random modes: a lobe count, a phase that drifts, a strength that swells and dies by sin squared of its own life, then is replaced
function mkSet(n, kmin, kmax, amp, life, wmax) {
  const set = { items: [], kmin, kmax, amp, life, wmax };
  for (let i = 0; i < n; i++) set.items.push(mkMode(set, -rnd() * life));
  return set;
}
function mkMode(set, born) {
  const k = set.kmin + floor(rnd() * (set.kmax - set.kmin + 1));
  return {
    k,
    ph: rnd() * TAU,
    w: (rnd() < 0.5 ? -1 : 1) * (0.012 + set.wmax * rnd()),
    a: set.amp * (0.6 + 0.8 * rnd()) * (set.kmax > 8 ? pow(6 / k, 0.5) : 1),
    born,
    life: set.life * (0.7 + 0.6 * rnd()),
  };
}
function stepSet(set, t) {
  for (let i = 0; i < set.items.length; i++) if (t > set.items[i].born + set.items[i].life) set.items[i] = mkMode(set, t);
}
function envOf(m, t) {
  const x = (t - m.born) / m.life;
  if (x <= 0 || x >= 1) return 0;
  const s = sin(PI * x);
  return s * s;
}
function setAt(set, th, t) {
  let v = 0;
  for (const m of set.items) v += m.a * envOf(m, t) * cos(m.k * th + m.ph + m.w * t);
  return v;
}

function ouStep(S, key, d, tau) {
  const e = exp(-d / tau);
  S[key] = S[key] * e + sqrt(1 - e * e) * gauss();
}

function makeState() {
  const S = {
    t: 0, ready: false,
    A: 0.5, C: 0.5, Y: 0.53, hue: 0, palHue: -1, pal: {},
    ouX: gauss(), ouY: gauss(), ouP: gauss(), ouE: gauss(), ouR: gauss(), ouS: gauss(), ouQ: gauss(),
    fingers: [], knots: [], jets: [], layers: [],
    rip: mkSet(8, 5, 26, 0.7, 60, 0.10),
    lump: mkSet(3, 2, 4, 1.0, 70, 0.07),
    ejm: mkSet(4, 1, 5, 1.0, 60, 0.05),
    stars: [],
    acc: new Float32Array(NPX * 3),
    Rt: new Float32Array(NA + 2), Bt: new Float32Array(NA + 2), Qt: new Float32Array(NA + 2),
    Ct: new Float32Array(NA + 2), Mt: new Float32Array(NA + 2),
    geo: { cx: 32, cy: 64, ca: 0, sa: 1, Ea: 1, Eb: 1, R0: 32 },
  };
  for (let i = 0; i < 3; i++) S.layers.push(newLayer(-i * 11 - rnd() * 6, 28 + 16 * rnd()));
  for (let i = 0; i < 8; i++) {
    S.stars.push({ x: floor(rnd() * 64), y: floor(rnd() * 128), b: 0.14 + 0.2 * rnd(), ph: rnd() * TAU, w: 0.2 + 0.4 * rnd() });
  }
  return S;
}

function newLayer(t0, T) {
  return { t0, T, seed: 100 + floor(rnd() * 9000), ox: rnd() * 200, oy: rnd() * 200, rot0: rnd() * TAU, rotw: (rnd() - 0.5) * 0.03, lam: 9 + 4 * rnd() };
}

function pickElem() {
  const r = rnd();
  return r < 0.4 ? 0 : r < 0.82 ? 1 : 2; // oxygen, silicon, iron
}
function elemCol(S, e) {
  return e === 0 ? S.pal.ox : e === 1 ? S.pal.si : S.pal.fe;
}

// ---- the three lists
function ringRho(S) {
  return 0.74 - 0.26 * S.A + 0.05 * cl(S.ouQ, -2, 2);
}
function spawnFinger(S, age) {
  let best = 0, bs = -1;
  for (let c = 0; c < 8; c++) {
    const th = (rnd() - 0.5) * TAU;
    let s = 9;
    for (const f of S.fingers) {
      let d = abs(th - f.th);
      if (d > PI) d = TAU - d;
      if (d < s) s = d;
    }
    if (s > bs) { bs = s; best = th; }
  }
  S.fingers.push({
    th: best, born: S.t - age, hw: 1.1 + 0.5 * rnd(), cv: (rnd() - 0.5) * 0.3, hm: 0.55 + 0.85 * rnd(), tg: 3.5 + 3.5 * rnd(),
    td: 26 + 22 * rnd(), el: pickElem(), off: (rnd() - 0.5) * 0.05, wob: rnd() * TAU,
  });
}
function ejectaD(S, th) {
  // angular density of the ejecta, from the lumps, sharper with Clumpiness
  const c = 0.4 + 2.2 * S.C;
  return exp(c * setAt(S.ejm, th, S.t));
}
function spawnKnot(S, age) {
  let th = 0;
  const c = 0.4 + 2.2 * S.C, dmax = exp(c * 3.2);
  for (let i = 0; i < 14; i++) {
    th = (rnd() - 0.5) * TAU;
    if (rnd() * dmax < ejectaD(S, th)) break;
  }
  const sz = 3 + 4 * pow(rnd(), 1.7);
  S.knots.push({
    th, rho: ringRho(S) + 0.02 + 0.11 * rnd(), born: S.t - age, sz: sz * (0.85 + 0.3 * S.C),
    tc: 14 + 12 * rnd(), amp: 0.75 + 0.5 * rnd(), el: pickElem(),
    s1x: (rnd() - 0.5) * 1.5 * sz, s1y: (rnd() - 0.5) * 1.5 * sz, s2x: (rnd() - 0.5) * 1.5 * sz, s2y: (rnd() - 0.5) * 1.5 * sz,
  });
}
function spawnJet(S, side, delay) {
  const n = 5 + floor(rnd() * 4);
  const kn = [];
  const v0 = 2.4 + 1.8 * rnd();
  for (let i = 0; i < n; i++) {
    kn.push({
      v: v0 * (i === 0 ? 1.0 : 0.82 + 0.16 * rnd()), d: i === 0 ? 0 : 0.6 + i * (0.35 + 0.5 * rnd()),
      sz: i === 0 ? 3.6 + 0.8 * rnd() : 2.6 + 2.0 * rnd(), b: i === 0 ? 1 : 0.55 + 0.3 * rnd(),
    });
  }
  S.jets.push({
    th: (side > 0 ? 0 : PI) + (rnd() - 0.5) * 0.26, born: S.t + delay, kn, wa: 0.7 + 1.5 * rnd(), wp: rnd() * TAU, wl: 0.25 + 0.2 * rnd(),
    tau: 7 + 4 * rnd(), life: 20 + 6 * rnd(),
  });
}

function step(S, d) {
  S.t += d;
  const t = S.t;
  ouStep(S, "ouX", d, 45); ouStep(S, "ouY", d, 52); ouStep(S, "ouP", d, 70);
  ouStep(S, "ouE", d, 60); ouStep(S, "ouR", d, 32); ouStep(S, "ouS", d, 90); ouStep(S, "ouQ", d, 26);
  stepSet(S.rip, t); stepSet(S.lump, t); stepSet(S.ejm, t);
  const A = S.A, C = S.C, Y = S.Y;
  // fingers
  const lamF = (0.09 + 0.34 * pow(A, 1.2)) * (0.35 + 1.3 * C);
  if (S.fingers.length < 40 && rnd() < 1 - exp(-lamF * d)) spawnFinger(S, 0);
  for (let i = S.fingers.length - 1; i >= 0; i--) {
    const f = S.fingers[i], a = t - f.born;
    if (a > f.td && exp(-(a - f.td) / 11) < 0.03) S.fingers.splice(i, 1);
  }
  // knots
  const lamK = (0.2 + 0.32 * pow(A, 1.1)) * (0.35 + 1.3 * C);
  if (S.knots.length < 90 && rnd() < 1 - exp(-lamK * d)) spawnKnot(S, 0);
  for (let i = S.knots.length - 1; i >= 0; i--) if (t - S.knots[i].born > 3.2 * S.knots[i].tc) S.knots.splice(i, 1);
  // jets
  const lamJ = 0.085 * pow(Y, 1.8);
  if (S.jets.length < 3 && rnd() < 1 - exp(-lamJ * d)) {
    const side = rnd() < 0.5 ? 1 : -1;
    spawnJet(S, side, 0);
    if (rnd() < 0.2 + 0.6 * Y) spawnJet(S, -side, 0.3 + rnd());
  }
  for (let i = S.jets.length - 1; i >= 0; i--) if (t - S.jets[i].born > S.jets[i].life) S.jets.splice(i, 1);
  // texture layers: when one has run its course it is born again with a new seed
  for (let i = 0; i < S.layers.length; i++) {
    const L = S.layers[i];
    if (t >= L.t0 + L.T) S.layers[i] = newLayer(L.t0 + L.T, 28 + 16 * rnd());
  }
}

function readKnobs(S, kn, d, first) {
  const hue = cl(kn[0], 0, 1);
  const A = cl(kn[1], 0, 4) / 4, C = (cl(kn[2], -1, 1) + 1) / 2, Y = (cl(kn[3], -1, 1) + 1) / 2;
  const f = first ? 1 : 1 - exp(-d / 0.5);
  S.A += (A - S.A) * f; S.C += (C - S.C) * f; S.Y += (Y - S.Y) * f;
  S.hue = hue;
  if (abs(S.hue - S.palHue) > 0.0005) buildPal(S);
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const kn = (input && input.knobValues) || [0, 2, 0, 0.06];
  if (!S.ready) {
    S.ready = true;
    readKnobs(S, kn, 0, true);
    const h = 0.25;
    for (let i = 0; i < 560; i++) step(S, h);
    return;
  }
  readKnobs(S, kn, d, false);
  step(S, d);
}

// ---- geometry of the frame: centre, axis, stretch
function geometry(S) {
  const G = S.geo, Y = S.Y;
  const yy = 0.3 + 0.7 * Y;
  G.cx = 31.5 + cl(S.ouX, -2.2, 2.2) * 7.5 * yy;
  G.cy = 63.5 + cl(S.ouY, -2.2, 2.2) * 9 * yy;
  const phi = PI / 2 + cl(S.ouP, -2, 2) * 0.17;
  G.ca = cos(phi); G.sa = sin(phi);
  const e = 1 + yy * 0.28 * (0.8 + 0.1 * cl(S.ouE, -2, 2));
  G.Ea = sqrt(e); G.Eb = 1 / sqrt(e);
  G.R0 = 34 + 2.0 * cl(S.ouR, -2, 2);
}

function buildTables(S) {
  const t = S.t, A = S.A, C = S.C, Y = S.Y, G = S.geo;
  const rScale = (0.4 + 1.3 * A) * (0.5 + 0.9 * C);
  const lScale = 0.6 + 0.8 * Y;
  const gap = 0.28 + 0.35 * cl(A * (0.4 + C), 0, 1);
  const psi = 0.8 + 1.0 * sin(0.0413 * t + 2.0) + 0.7 * sin(0.0197 * t) + 0.5 * sin(0.067 * t + 1);
  const psiOff = 1.2 * sin(0.0131 * t + 0.5) + 0.9 * sin(0.0052 * t + 4.0) + S.ouS * 0.4;
  const rr0 = ringRho(S), cc = 0.4 + 2.2 * C;
  let dmax = 0;
  for (let i = 0; i < NA + 2; i++) {
    const th = -PI + (TAU * i) / NA;
    let R = G.R0 + setAt(S.lump, th, t) * lScale * 1.4 + setAt(S.rip, th, t) * rScale;
    for (const J of S.jets) {
      const a = t - J.born;
      if (a < 0 || !J.kn.length) continue;
      let dth = th - J.th;
      if (dth > PI) dth -= TAU; else if (dth < -PI) dth += TAU;
      const hd = J.kn[0];
      const rh = 0.5 * G.R0 + hd.v * J.tau * (1 - exp(-a / J.tau));
      const cross = sm(G.R0 - 6, G.R0 + 6, rh);
      const heal = exp(-max(0, a - 6) / 4);
      R += 3.2 * cross * heal * exp(-(dth * dth) / 0.045) * (0.5 + Y);
    }
    S.Rt[i] = R;
    const rim = 0.5 + 0.5 * cos(2 * (th - psi));
    const bb = 0.55 + 0.45 * pow(rim, 1.3);
    const n = vnoise(2.4 * cos(th) + 11 + 0.05 * t, 2.4 * sin(th) + 5 - 0.04 * t, 51);
    S.Bt[i] = bb * (1 - gap * sm(0.5, 0.8, n));
    S.Mt[i] = vnoise(1.5 * cos(th) + 3 - 0.02 * t, 1.5 * sin(th) + 8, 52);
    const bead = sm(0.28, 0.72, vnoise(5.5 * cos(th) + 20 + 0.02 * t, 5.5 * sin(th) + 30, 54));
    const dv = exp(cc * setAt(S.ejm, th, t)) * (0.2 + 0.8 * bead);
    S.Ct[i] = dv;
    if (dv > dmax) dmax = dv;
    const off = 0.42 * Y * cos(th - psiOff);
    S.Qt[i] = R * (rr0 * (1 + off) + 0.03 * sin(3 * th + 0.05 * t + 1) + 0.022 * sin(5 * th + 0.07 * t) + 0.012 * sin(9 * th - 0.05 * t));
  }
  for (let i = 0; i < NA + 2; i++) S.Ct[i] = 0.12 + 0.88 * S.Ct[i] / dmax;
}

function tab(T, th) {
  const u = (th + PI) * (NA / TAU);
  const i = floor(u), f = u - i;
  return T[i] + (T[i + 1] - T[i]) * f;
}

// ---- splat a soft blob into the float buffer
function splat(acc, x, y, sig, r, g, b, amp) {
  const R = 3 * sig;
  const x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R));
  const y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
  const k = -0.5 / (sig * sig);
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy + 0.5 - y;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x;
      const v = exp(k * (dx * dx + dy * dy)) * amp;
      const p = (yy * W + xx) * 3;
      acc[p] += v * r; acc[p + 1] += v * g; acc[p + 2] += v * b;
    }
  }
}
function toPx(G, r, th, ox, oy) {
  // a point at radius r and angle th in the stretched frame, moved by (ox, oy) there, to panel LEDs
  const a = (r * cos(th) + ox) * G.Ea, b = (r * sin(th) + oy) * G.Eb;
  return [G.cx + a * G.ca - b * G.sa, G.cy + a * G.sa + b * G.ca];
}

function drawKnots(S) {
  const t = S.t, G = S.geo, acc = S.acc, P = S.pal;
  for (const k of S.knots) {
    const a = t - k.born;
    if (a < 0) continue;
    const fall = pow(1 + a / 22, -0.4);
    const heat = exp(-a / 2.6);
    const br = k.amp * (1 - exp(-a / 0.5)) * exp(-a / k.tc) * (0.9 + 0.7 * heat);
    if (br < 0.02) continue;
    const Rs = tab(S.Rt, k.th);
    const r = k.rho * fall * Rs;
    const sz = k.sz * (0.6 + 0.4 * fall) / 2.355;
    const ec = elemCol(S, k.el);
    const cr = mix(ec[0], P.rg[0], heat * 0.9), cg = mix(ec[1], P.rg[1], heat * 0.9), cb = mix(ec[2], P.rg[2], heat * 0.9);
    const p0 = toPx(G, r, k.th, 0, 0);
    splat(acc, p0[0], p0[1], sz, cr, cg, cb, br);
    const p1 = toPx(G, r, k.th, k.s1x * fall, k.s1y * fall);
    splat(acc, p1[0], p1[1], sz * 0.5, cr, cg, cb, br * 0.6);
    const p2 = toPx(G, r, k.th, k.s2x * fall, k.s2y * fall);
    splat(acc, p2[0], p2[1], sz * 0.45, cr, cg, cb, br * 0.5);
  }
  // jets
  for (const J of S.jets) {
    const a = t - J.born;
    if (a < 0) continue;
    const fadeAll = sm(0, 1.0, a) * (1 - sm(J.life - 9, J.life, a));
    let rPrev = -1;
    for (let i = 0; i < J.kn.length; i++) {
      const K = J.kn[i], ak = a - K.d;
      if (ak < 0) continue;
      const r = 0.5 * G.R0 + K.v * J.tau * (1 - exp(-ak / J.tau));
      const lat = J.wa * sin(r * J.wl + J.wp) * sm(0, 14, r - 0.5 * G.R0);
      const beyond = exp(-max(0, r - G.R0) / 26);
      const br = K.b * fadeAll * beyond * sm(0, 0.8, ak);
      if (br < 0.02) continue;
      const cool = i === 0 ? 0.12 : sm(4, 16, ak);
      const hotc = i === 0 ? P.wh : P.ox;
      const col = [mix(hotc[0], P.si[0], cool * 0.8), mix(hotc[1], P.si[1], cool * 0.8), mix(hotc[2], P.si[2], cool * 0.8)];
      const p = toPx(G, r, J.th, -lat * sin(J.th), lat * cos(J.th));
      const sg = K.sz / 2.355;
      splat(acc, p[0], p[1], sg, col[0], col[1], col[2], 1.15 * br);
      if (i === 0) splat(acc, p[0], p[1], sg * 1.9, P.shB[0], P.shB[1], P.shB[2], 0.10 * br);
      // a thin beam between this knot and the one ahead
      if (rPrev > 0) {
        const n = floor((rPrev - r) / 2.2);
        for (let q = 1; q < n; q++) {
          const rq = r + (q * (rPrev - r)) / n;
          const lq = J.wa * sin(rq * J.wl + J.wp) * sm(0, 14, rq - 0.5 * G.R0);
          const pq = toPx(G, rq, J.th, -lq * sin(J.th), lq * cos(J.th));
          splat(acc, pq[0], pq[1], 1.0, P.ox[0], P.ox[1], P.ox[2], 0.30 * br);
        }
      }
      rPrev = r;
    }
  }
}

function buildFingers(S) {
  const t = S.t, A = S.A;
  const gh = 0.08 + 0.38 * A;
  const rr0 = ringRho(S) + 0.07;
  const FL = [];
  for (const f of S.fingers) {
    const a = t - f.born;
    if (a < 0) continue;
    const g = 1 / (1 + (1 / 0.03 - 1) * exp(-a / f.tg));
    let fade = 1, fall = 1;
    if (a > f.td) {
      fade = exp(-(a - f.td) / 11);
      fall = pow(1 + (a - f.td) / 20, -0.4);
    }
    const Rs = tab(S.Rt, f.th);
    const wob = 0.012 * sin(f.wob + t * 0.15);
    const rb = (rr0 + f.off + wob) * fall;
    const rt = min(0.97, rb + gh * f.hm * g) * (a > f.td ? fall : 1);
    const env = sm(0, 2.5, a) * fade * (0.45 + 0.55 * g);
    const el = elemCol(S, f.el);
    FL.push({ th: f.th, cv: f.cv, ph: f.wob, rb: rb * Rs, rt: max(rt, rb + 0.02) * Rs, hw: f.hw, r: el[0], g: el[1], b: el[2], amp: env * 1.3 });
  }
  return FL;
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) update(0, { knobValues: [0, 2, 0, 0.06] }, params);
  geometry(S);
  buildTables(S);
  const G = S.geo, P = S.pal, t = S.t, A = S.A, C = S.C;
  const acc = S.acc;
  acc.fill(0);
  drawKnots(S);
  const FL = buildFingers(S);
  const nf = FL.length;

  // texture layers
  const lw = [], lz = [];
  let wsum = 0.15;
  for (let i = 0; i < S.layers.length; i++) {
    const L = S.layers[i];
    const ph = cl((t - L.t0) / L.T, 0, 1);
    const w = sin(PI * ph) * sin(PI * ph);
    lw.push(w); lz.push(exp(0.45 * ph));
    wsum += w;
  }
  const txAmp = (0.15 + 0.85 * pow(A, 0.9)) * 1.4;
  const lineW = 1.05 + 0.25 * (1 - C); // sigma of a filament, LEDs: FWHM 2.2 to 2.8
  const ringW = 1.1;
  const cosA = G.ca, sinA = G.sa, iEa = 1 / G.Ea, iEb = 1 / G.Eb;
  const hazeK = 0.03 + 0.06 * A;
  const R0 = G.R0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - G.cx, dy = y + 0.5 - G.cy;
      const a = (dx * cosA + dy * sinA) * iEa, b = (-dx * sinA + dy * cosA) * iEb;
      const rr = sqrt(a * a + b * b);
      const th = atan2(b, a);
      const Rs = tab(S.Rt, th);
      const p = (y * W + x) * 3;
      if (rr > Rs + 10) continue;
      const rho = rr / Rs;
      const s = rr - Rs;
      let cr = 0, cg = 0, cb = 0;
      // shell: a thin bright line, with a soft glow either side
      const bt = tab(S.Bt, th);
      const mt = tab(S.Mt, th);
      const core = exp(-0.5 * (s / 1.05) * (s / 1.05));
      const glow = s > 0 ? 0.10 * exp(-s / 2.6) : 0.22 * exp(s / 4.2);
      const shv = bt * core + bt * glow;
      const white = sm(0.5, 1.0, bt) * core * 0.45;
      cr += shv * mix(P.shA[0], P.shB[0], mt) + white * P.wh[0];
      cg += shv * mix(P.shA[1], P.shB[1], mt) + white * P.wh[1];
      cb += shv * mix(P.shA[2], P.shB[2], mt) + white * P.wh[2];
      if (s < 0) {
        // shocked gas: a faint warm haze between the ring and the shell, brighter toward the shell
        const hz = hazeK * sm(0.45, 0.97, rho) * (1 - sm(0.985, 1.0, rho)) * (0.6 + 0.4 * vnoise(a * 0.09 + 4, b * 0.09 - t * 0.01, 53));
        cr += hz * P.hz[0]; cg += hz * P.hz[1]; cb += hz * P.hz[2];
        // reverse-shock ring
        const Q = tab(S.Qt, th), cv = tab(S.Ct, th);
        const dq = (rr - Q) / ringW;
        if (dq < 4 && dq > -4) {
          const rv = (exp(-0.5 * dq * dq) + 0.22 * exp(-0.5 * dq * dq / 9)) * cv * (0.18 + 0.82 * sm(0, 0.8, A)) * 2.0;
          const rw = sm(0.6, 1.0, rv) * 0.3;
          cr += rv * (P.rg[0] + rw * (1 - P.rg[0])); cg += rv * (P.rg[1] + rw * (1 - P.rg[1])); cb += rv * (P.rg[2] + rw * (1 - P.rg[2]));
        }
        // filament net
        if (rho > 0.1 && rho < 1.0) {
          let tex = 0;
          for (let i = 0; i < lw.length; i++) {
            if (lw[i] < 0.02) continue;
            const L = S.layers[i];
            const z = lz[i];
            const ca = cos(L.rot0 + L.rotw * t), sa = sin(L.rot0 + L.rotw * t);
            const px = (a * ca - b * sa) * z, py = (a * sa + b * ca) * z;
            const wx = (vnoise(px / 13 + L.ox, py / 13 + L.oy, L.seed + 1) - 0.5) * 9;
            const wy = (vnoise(px / 13 + L.oy, py / 13 + L.ox, L.seed + 2) - 0.5) * 9;
            const sx = (px + wx) / L.lam + L.ox * 0.5, sy = (py + wy) / L.lam + L.oy * 0.5;
            const n0 = vnoise(sx, sy, L.seed);
            const gx = (vnoise(sx + 0.08, sy, L.seed) - n0) * 12.5, gy = (vnoise(sx, sy + 0.08, L.seed) - n0) * 12.5;
            // distance to the n = 0.5 isoline in LEDs, so that every line has the same width
            const gm = sqrt(gx * gx + gy * gy);
            const dn = min(abs(n0 - 0.5), abs(n0 - 0.34), abs(n0 - 0.66));
            const dist = (dn / (gm + 0.3)) * L.lam;
            const kn = 0.3 + 0.7 * sm(0.3, 0.7, vnoise(sx * 2.3 + 7, sy * 2.3, L.seed + 3));
            const line = exp(-0.5 * (dist * dist) / (lineW * lineW)) * kn * sm(0.4, 0.9, gm);
            const rz = rr * z / R0 / (Rs / R0);
            const mask = (0.3 + 0.7 * sm(0.3, 0.6, rz)) * sm(0.12, 0.3, rz) * (1 - sm(0.84, 0.97, rz));
            tex += lw[i] * line * mask;
          }
          tex = (tex / wsum) * txAmp * (0.3 + 0.7 * sm(-4, 1.5, rr - tab(S.Qt, th)));
          if (tex > 0.004) {
            const e = vnoise(a / 15 + 3 + 0.02 * t, b / 15 + 9, 61);
            const wO = 1 - sm(0.36, 0.48, e), wF = sm(0.76, 0.88, e), wS = 1 - wO - wF;
            cr += tex * (wO * P.ox[0] + wS * P.si[0] + wF * P.fe[0] * 1.5);
            cg += tex * (wO * P.ox[1] + wS * P.si[1] + wF * P.fe[1] * 1.5);
            cb += tex * (wO * P.ox[2] + wS * P.si[2] + wF * P.fe[2] * 1.5);
          }
        }
        // fingers of the contact discontinuity
        for (let i = 0; i < nf; i++) {
          const F = FL[i];
          const hwm = F.hw * 1.5;
          if (rr < F.rb - 3 * hwm || rr > F.rt + 3 * hwm) continue;
          const q = rr < F.rb ? F.rb : rr > F.rt ? F.rt : rr;
          const xq = (q - F.rb) / (F.rt - F.rb + 1e-3);
          let dth = th - F.th - F.cv * xq;
          if (dth > PI) dth -= TAU; else if (dth < -PI) dth += TAU;
          const lat = dth * rr;
          if (lat > 3.2 * hwm || lat < -3.2 * hwm) continue;
          const hw = F.hw * (0.85 + 0.55 * sm(0.55, 1, xq)) * (1 + 0.2 * sin(xq * 8 + F.ph * 3));
          const dr = rr - q;
          const d2 = (dr * dr + lat * lat) / (hw * hw);
          if (d2 > 9) continue;
          const v = exp(-0.5 * d2) * F.amp * (0.55 + 0.45 * xq);
          const tip = sm(0.75, 1, xq) * 0.4;
          cr += v * (F.r + tip * (P.wh[0] - F.r)); cg += v * (F.g + tip * (P.wh[1] - F.g)); cb += v * (F.b + tip * (P.wh[2] - F.b));
        }
      }
      acc[p] += cr; acc[p + 1] += cg; acc[p + 2] += cb;
    }
  }

  // stars, only outside the shell
  for (const st of S.stars) {
    const dx = st.x + 0.5 - G.cx, dy = st.y + 0.5 - G.cy;
    const a = (dx * cosA + dy * sinA) * iEa, b = (-dx * sinA + dy * cosA) * iEb;
    const rr = sqrt(a * a + b * b), Rs = tab(S.Rt, atan2(b, a));
    const m = sm(Rs + 3, Rs + 7, rr);
    const v = st.b * (0.8 + 0.2 * sin(st.ph + t * st.w)) * m;
    const p = (st.y * W + st.x) * 3;
    acc[p] += v * 0.8; acc[p + 1] += v * 0.88; acc[p + 2] += v;
  }

  const K = 1.5;
  for (let i = 0; i < NPX; i++) {
    const p = i * 3;
    const x = i % W, y = (i / W) | 0;
    display.setPixel(
      x, y,
      (255 * (1 - exp(-K * acc[p]))) | 0,
      (255 * (1 - exp(-K * acc[p + 1]))) | 0,
      (255 * (1 - exp(-K * acc[p + 2]))) | 0
    );
  }
}
