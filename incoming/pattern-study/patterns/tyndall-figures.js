// ===== Patternflow pattern =====
// Title:   Tyndall Figures
// Family:  tyndall
// Idea:    Looking straight down the c-axis through a clear slab of blue-teal ice that sunlight is melting from inside, a dozen or more liquid-filled discs lie in the basal planes at different depths, each a darker disc with a luminous cyan-white rim fringed blue inside and amber outside and a bright bubble at its middle, born as a tiny hexagon at an imperfection and growing for thirty to ninety seconds while its outline sprouts six petals and then a lace frill from the unstable modes of the melting front, until the rim reaches a drain, flares and goes out, leaving a ghost of a few tiny bubbles that dissolve while new discs open elsewhere.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: sunlight melting ice from within into flat liquid discs with a vapour bubble in each, which are now called Tyndall figures (John Tyndall, 1850s); Ukichiro Nakaya's studies of ice crystals and of these figures (1940s and 1950s, from memory); the instability of a moving solid-liquid front that gives the frill (William Mullins and Robert Sekerka, 1963); water taking 9 percent less room than ice, which is the bubble; pattern round 258
// Round:   258
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sun=0..4, Depth=-1..1, Frill=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the ice is blue and the rims are cyan-white; at 0.25 the ice is violet, at 0.5 it is lit amber and at 0.75 green, and at 1 it is back to blue.
// Knob 2: Sun. How hard the ice is heated. It sets the growth speed, 2 to the power 0.65 for each unit of the knob around the opening, so the discs grow 2.5 times faster at 4 than at 2 and 2.5 times slower at 0, and the number of discs growing at once, about 7 at 0, 14 at 2 and 20 at 4, with the ghosts of the ended ones on top. At 2 a disc grows for 30 to 90 s.
// Knob 3: Depth. How deep the ice is. At -1 it is one thin layer: every disc lies at the same depth, crisp and bright, and its final radius is 12 to 18 LED. At 1 the discs are spread through a deep stack: the far ones are pale and blurred 3 LED wide and 30 percent smaller, the near ones still crisp, and the final radii run from 5 to 24 LED.
// Knob 4: Frill. The reach of the melting front's instability and its six-fold anisotropy. At -1 the front is stable and every disc stays a smooth round pancake. Around 0 it is a clean six-petalled daisy, and towards 1 the band of unstable modes reaches 1.5 waves a radius, so the rim breaks into a lace of 12 to 24 scallops.

// What the picture is. Every disc has an outline r(psi) = R hex(psi) exp(sum a_m cos(m psi + phase_m)) for psi the angle from straight up the panel, so
// all the discs are the same way round, like the crystal axes seen along the c-axis. R grows from 0.12 of the disc's final radius to all of it as the 0.72 power of its age
// over its growth time, and the modes m = 2 to 30 are integrated for each disc, a complex amplitude each, by the growth rate of a Mullins-Sekerka front,
//   sigma(m) = 2.6 u (1 - u^2),   u = m / (kc R),
// which is positive for the modes under kc R and largest at kc R / 1.7, so a disc grows more unstable modes as R rises. Every sixth mode (6, 12, 18, ...) has its band edge
// pushed out and its growth boosted by the anisotropy, while its neighbours are held back, and it keeps its phase, so the six petals come first. Each mode saturates at a cap that falls with m,
// and a small noise keeps the stable ones trembling. A young disc has no room for petals, so it is drawn as a hexagon blended into the circle (the weight falls by half as R passes 8 to 24).
// A disc is a signed distance to the outline, divided by the slope of the polar curve to be a true distance, and shaded in four steps: the ground darkens inside, a rim about 2 LED wide
// glows cyan-white at the edge, a blue fringe lies just inside and an amber one just outside, and a halo falls away outward. Depth blurs the rim and takes the light, the amber and the size away.
// The bubble is a bright disc of 2 to 3 LED with a dark ring, wandering a little inside the outline. The discs are drawn from the far one to the near one with their light added on a screen, so they show through each other.
// The population holds itself: a new disc nucleates, at the best of twelve random places, at a rate set by how far the number growing is under the target. A disc that has grown for
// its time flares for 4.5 s, goes out in 5 s and leaves 3 to 6 bubbles that each dissolve in 6 to 26 s. The first frame is the population already running: discs of every age, dealt and then run on for 24 s.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, atan2, PI, min, max, pow } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gau = () => rnd() + rnd() + rnd() - 1.5; // standard deviation 0.5

const NA = 240; // samples of the outline round a disc, 1.5 degrees apart
const MM = 30; // highest mode
const MAXF = 44; // slots for discs, growing, ending and ghost
const RMID = 15, RMIN = 5, RMAX = 24; // the middle, the least and the most of a final radius, LED
const LAM = 0.16; // growth rate of the front at 1, a second
const NOISE = 0.12; // noise on a mode, as a share of its cap, a root second
const GLOW_T = 4.5, FADE_T = 5; // flare and fade at the end, seconds
const PREROLL = 24; // seconds of panel time run before the first frame, after the population is dealt

const CT = new Float32Array(NA), ST = new Float32Array(NA), HEX = new Float32Array(NA);
for (let j = 0; j < NA; j++) {
  CT[j] = cos((TWO_PI * j) / NA);
  ST[j] = sin((TWO_PI * j) / NA);
}
// A hexagon with its corner up, as a radius over the angle, scaled to the same mean radius as the circle.
{
  let sum = 0;
  for (let j = 0; j < NA; j++) {
    const a = ((TWO_PI * j) / NA) % (PI / 3) - PI / 6;
    HEX[j] = 0.866025 / cos(a);
    sum += HEX[j];
  }
  for (let j = 0; j < NA; j++) HEX[j] /= sum / NA;
}
const GL = new Float32Array(520); // exp(-x) in steps of 1/64, for the gaussians of the shading
for (let i = 0; i < 520; i++) GL[i] = exp(-i / 64);
const g2 = (u2) => {
  const q = (u2 * 64) | 0;
  return q > 511 ? 0 : GL[q];
};

function hsv(h, s, v, out) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const k = i % 6;
  const r = k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v;
  const g = k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p;
  const b = k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q;
  out[0] = r * 255;
  out[1] = g * 255;
  out[2] = b * 255;
}

// ---- the colours, set from the Hue knob; 0.575 is the ice blue it opens on
function palette(S, hue) {
  if (S.palAt === hue) return;
  S.palAt = hue;
  const h0 = 0.575 + hue, P = S.pal;
  hsv(h0 + 0.005, 0.9, 0.26, P.dk); // ground, dark end
  hsv(h0 - 0.02, 0.78, 0.5, P.lt); // ground, lit end
  hsv(h0 - 0.035, 0.3, 1.0, P.rim); // cyan-white rim
  hsv(h0 + 0.075, 0.95, 1.0, P.fin); // fringe inside, blue
  hsv(h0 - 0.44, 0.92, 1.0, P.fout); // fringe outside, amber
  hsv(h0 - 0.045, 0.1, 1.0, P.bub); // bubble
}

function makeFlower() {
  return {
    ph: -1, x: 0, y: 0, u: 0, s: 0, Tg: 60, age: 0, t2: 0, R: 2, Rf: 12, z: 0, hw: 0, bx: 0, by: 0,
    re: new Float32Array(MM + 1), im: new Float32Array(MM + 1), om: new Float32Array(MM + 1),
    w: new Float32Array(6), gx: new Float32Array(6), gy: new Float32Array(6), gr: new Float32Array(6), gl: new Float32Array(6), gn: 0,
    rt: new Float32Array(NA), dr: new Float32Array(NA), sp: new Float32Array(NA), rmax: 0,
  };
}

function makeState() {
  const S = {
    ready: false, t: 0, kn: [0, 2, 0, 0.06], palAt: -1, pal: { dk: [0, 0, 0], lt: [0, 0, 0], rim: [0, 0, 0], fin: [0, 0, 0], fout: [0, 0, 0], bub: [0, 0, 0] },
    K: { v: 1, vs: 1, tgt: 13, kc: 0.65, A: 1, hex: 1, F: 0.5, D: 0.5 },
    fl: [], ord: [], BR: new Float32Array(NPX), BG: new Float32Array(NPX), BB: new Float32Array(NPX),
    Q0: new Float32Array(NPX), lat: new Float32Array(32 * 32), trains: [],
  };
  for (let i = 0; i < MAXF; i++) S.fl.push(makeFlower());
  for (let i = 0; i < 32 * 32; i++) S.lat[i] = rnd();
  // The backlight, a broad glow that sits a little above the middle of the slab.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - 30) / 34, dy = (y - 58) / 78;
      S.Q0[y * W + x] = 0.36 + 0.2 * exp(-(dx * dx + dy * dy) * 1.1);
    }
  // A few hairline cracks, planes seen edge on: soft, 3 LED across and broken along their length.
  for (let c = 0; c < 3; c++) {
    const x0 = rnd() * W, y0 = rnd() * H, a = (c === 0 ? 1.2 : c === 1 ? 2.1 : 0.5) + (rnd() - 0.5) * 0.4, len = 55 + rnd() * 50, ph = rnd() * 6.283;
    const ca = cos(a), sa = sin(a);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - x0, dy = y + 0.5 - y0, along = dx * ca + dy * sa + len / 2, perp = -dx * sa + dy * ca;
        if (along < 0 || along > len || perp > 4 || perp < -4) continue;
        const env = pow(sin((PI * along) / len), 0.6) * (0.62 + 0.38 * sin(0.13 * along + ph));
        S.Q0[y * W + x] += 0.1 * env * g2((perp / 1.2) * (perp / 1.2));
      }
  }
  // Bubble trains: a few parallel rows of small bubbles, leaning a few degrees from the vertical.
  for (let c = 0; c < 4; c++) {
    const x0 = 6 + c * 16 + rnd() * 8, lean = 0.1 + (rnd() - 0.5) * 0.06;
    let y = rnd() * 12;
    while (y < H + 6) {
      S.trains.push({ x: x0 + lean * y, y, r: 0.85 + rnd() * 0.5, a: 0.16 + rnd() * 0.16, ph: rnd() * 6.283, sp: 0.3 + rnd() * 0.5 });
      y += 5 + rnd() * 5;
    }
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// ---- the knobs
function derive(S, kn) {
  const k2 = cl(kn[1], 0, 4), g = (cl(kn[3], -1, 1) + 1) / 2, K = S.K;
  K.v = pow(2, 0.65 * (k2 - 2));
  K.vs = sqrt(K.v);
  K.tgt = (6.5 + 3.5 * k2) * (1 + 0.1 * sin(0.0173 * S.t + 1) + 0.07 * sin(0.0411 * S.t));
  K.kc = 0.05 + 1.45 * pow(g, 1.4);
  K.A = 0.25 + 0.75 * sin(PI * g);
  K.hex = 0.7 * cl(2 * g, 0, 1);
  K.F = 0.15 + 0.7 * sm(0.3, 1, g);
  const dTarget = 0.04 + 0.96 * ((cl(kn[2], -1, 1) + 1) / 2);
  K.D = S.ready ? K.D + (dTarget - K.D) * 0.05 : dTarget;
}

// ---- one disc
function place(S, f) {
  const K = S.K, z = K.D * f.u, sR = 0.2 + 0.55 * K.D;
  f.z = z;
  f.Rf = cl(RMID * (1 + (f.s - 0.5) * 2 * sR) * (1 - 0.3 * z), RMIN, RMAX);
  if (f.ph === 0) {
    const tau = min(1, f.age / f.Tg), r0 = max(0.1, 2.4 / f.Rf);
    f.R = f.Rf * (r0 + (1 - r0) * pow(tau, 0.72));
  } else f.R = f.Rf * (1 + 0.06 * sm(0, GLOW_T + FADE_T, f.t2));
  f.hw = K.hex * (1 - 0.5 * sm(8, 24, f.R));
}

// The most a mode reaches, in the log of the radius. The six-fold modes alternate in sign (+ at 6, - at 12, + at 18 ...) which rounds a petal and sharpens the notch
// between two. The others reach F LED, a frill that grows with the Frill knob and begins at m = 6 and fills in by 13, so the lace sits on the rim and the petals stay six.
const capOf = (m, R, F) => (m % 6 === 0 ? 0.14 * pow(6 / m, 1.4) : max(1e-3, (F / R) * sm(5.5, 13, m) * sqrt(8 / max(m, 8))));

// Modes whose wave is shorter than 4 LED round the rim are not integrated and not drawn.
const topMode = (R) => min(MM, floor(1.57 * R));

function stepModes(f, dt, K) {
  const mc = K.kc * f.R, L = LAM * K.v, nz = NOISE * sqrt(dt), top = topMode(f.R);
  for (let m = 2; m <= top; m++) {
    const six = m % 6 === 0;
    const u = m / (six ? mc * (1 + 0.55 * K.A) : mc);
    let s = 2.598 * u * (1 - u * u);
    const boost = six ? 1 + 0.7 * K.A : 1;
    if (six) { if (s > 0) s *= boost; } else s -= 0.3 * K.A; // the anisotropy favours the six-fold modes over their neighbours
    if (s < -3) s = -3;
    const am = capOf(m, f.R, K.F);
    let a = f.re[m], b = f.im[m];
    const g = L * (s - (boost * (a * a + b * b)) / (am * am)) * dt;
    a += g * a + nz * am * gau() * 2;
    if (six) {
      b *= exp(-3 * dt);
      if (a * ((m / 6) & 1 ? 1 : -1) < 0) a = 0;
    } else {
      b += g * b + nz * am * gau() * 2;
      const w = f.om[m] * K.vs * dt, c = cos(w), sn = sin(w), a2 = a * c - b * sn;
      b = a * sn + b * c;
      a = a2;
    }
    f.re[m] = a;
    f.im[m] = b;
  }
}

function spawn(S, ageFrac, lengthBiased) {
  let f = null;
  for (let i = 0; i < MAXF; i++) if (S.fl[i].ph < 0) { f = S.fl[i]; break; }
  if (!f) return null;
  f.ph = 0; f.u = rnd(); f.s = lengthBiased ? (sqrt(1 + 8 * rnd()) - 1) / 2 : rnd(); f.Tg = 30 + 60 * f.s; f.age = 0; f.t2 = 0; f.gn = 0;
  place(S, f);
  // the best of twelve places: the one farthest, edge to edge at their final sizes, from the discs still growing, so the panel fills evenly
  let bx = 30, by = 60, best = -1e9;
  for (let c = 0; c < 12; c++) {
    const x = -2 + 68 * rnd(), y = -4 + 136 * rnd();
    let m = 1e9;
    for (let i = 0; i < MAXF; i++) {
      const q = S.fl[i];
      if (q.ph < 0 || q.ph > 1 || q === f) continue;
      const d = sqrt((x - q.x) * (x - q.x) + (y - q.y) * (y - q.y)) - 0.6 * q.Rf - 0.5 * f.Rf;
      if (d < m) m = d;
    }
    if (m > best) { best = m; bx = x; by = y; }
  }
  f.x = bx; f.y = by;
  for (let m = 2; m <= MM; m++) {
    const six = m % 6 === 0, a = 0.3 * capOf(m, 10, S.K.F) * (0.5 + rnd()), p = rnd() * TWO_PI;
    f.re[m] = six ? ((m / 6) & 1 ? 1 : -1) * 0.015 : a * cos(p);
    f.im[m] = six ? 0 : a * sin(p);
    f.om[m] = six ? 0 : (rnd() - 0.5) * 0.16;
  }
  f.w[0] = 0.35 + rnd() * 0.35; f.w[1] = rnd() * TWO_PI; f.w[2] = 1.1 + rnd() * 0.8; f.w[3] = rnd() * TWO_PI;
  f.w[4] = 0.4 + rnd() * 0.3; f.w[5] = rnd() * TWO_PI;
  place(S, f);
  // a disc dealt in at an age is grown to it in steps of a quarter second
  const age0 = ageFrac * f.Tg;
  for (let a = 0; a < age0; a += 0.25) {
    f.age = min(age0, a + 0.25);
    place(S, f);
    stepModes(f, 0.25 / S.K.v, S.K);
  }
  return f;
}

// A ghost: the central bubble breaks into a few that drift apart and dissolve one at a time.
function startGhost(f) {
  f.gn = 3 + floor(rnd() * 4);
  for (let k = 0; k < f.gn; k++) {
    const a = rnd() * TWO_PI, d = f.Rf * (0.12 + 0.55 * pow(rnd(), 0.7));
    f.gx[k] = d * sin(a);
    f.gy[k] = -d * cos(a);
    f.gr[k] = 0.85 + rnd() * 0.5;
    f.gl[k] = 6 + rnd() * 20;
  }
}

function advance(S, dt) {
  const K = S.K;
  S.t += dt;
  let active = 0, ghosts = 0;
  for (let i = 0; i < MAXF; i++) {
    const f = S.fl[i];
    if (f.ph < 0) continue;
    if (f.ph === 0) {
      f.age += dt * K.v;
      if (f.age >= f.Tg) { f.ph = 1; f.t2 = 0; }
    } else {
      f.t2 += dt * K.vs;
      if (f.ph === 1 && f.t2 >= GLOW_T) { f.ph = 2; startGhost(f); }
      if (f.ph === 2 && f.t2 >= GLOW_T + FADE_T) f.ph = 3;
      if (f.ph === 3) {
        let alive = 0;
        for (let k = 0; k < f.gn; k++) if (f.gl[k] > 0) { f.gl[k] -= dt * K.vs * (S.ghosts > 12 ? 2.2 : 1); alive++; }
        if (!alive) { f.ph = -1; continue; }
      }
    }
    place(S, f);
    if (f.ph <= 2) stepModes(f, dt, K);
    if (f.ph === 0) active++;
    else ghosts++;
    f.bx = f.R * (0.15 * sin(f.w[0] * S.t + f.w[1]) + 0.07 * sin(f.w[2] * S.t + f.w[3]));
    f.by = f.R * (0.13 * sin(f.w[4] * S.t + f.w[5]) + 0.07 * cos(f.w[2] * 0.83 * S.t + f.w[1]));
  }
  S.ghosts = ghosts;
  // nucleation: the further the growing discs are under the target, the sooner another opens
  if (rnd() < max(0, K.tgt - active) * 0.2 * dt) spawn(S, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    derive(S, kn);
    S.ready = true;
    const n = floor(S.K.tgt);
    // the dealt population is weighted by growth time, as a snapshot of discs is: the long-lived ones are over-represented
    for (let i = 0; i < n; i++) spawn(S, rnd(), true);
    for (let i = 0; i < n * 0.55; i++) {
      const f = spawn(S, 0);
      if (!f) break;
      f.age = f.Tg; f.ph = 2; f.t2 = GLOW_T + FADE_T * 0.5; startGhost(f);
      f.ph = 3; f.t2 = GLOW_T + FADE_T + 1;
      for (let k = 0; k < f.gn; k++) f.gl[k] *= rnd();
    }
    for (let t = 0; t < PREROLL; t += 0.1) advance(S, 0.1);
  }
  derive(S, kn);
  advance(S, d);
}

// ---- the drawing
function noise(lat, u, v) {
  const iu = floor(u), iv = floor(v);
  let fu = u - iu, fv = v - iv;
  fu = fu * fu * (3 - 2 * fu);
  fv = fv * fv * (3 - 2 * fv);
  const i0 = iu & 31, i1 = (iu + 1) & 31, j0 = (iv & 31) * 32, j1 = ((iv + 1) & 31) * 32;
  const a = lat[j0 + i0] + (lat[j0 + i1] - lat[j0 + i0]) * fu, b = lat[j1 + i0] + (lat[j1 + i1] - lat[j1 + i0]) * fu;
  return a + (b - a) * fv;
}

function ground(S) {
  const P = S.pal, t = S.t, BR = S.BR, BG = S.BG, BB = S.BB, Q0 = S.Q0, lat = S.lat;
  const dr = P.lt[0] - P.dk[0], dg = P.lt[1] - P.dk[1], db = P.lt[2] - P.dk[2];
  for (let y = 0; y < H; y++) {
    const swell = 0.04 * sin(y * 0.035 - t * 0.11 + 1.3) + 0.03 * sin(y * 0.021 + t * 0.173 + 4.1);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // refraction streaks: two layers of stretched value noise that drift slowly and at different rates
      const n1 = noise(lat, x * 0.13 + y * 0.035 + 0.032 * t, y * 0.022 - 0.024 * t);
      const n2 = noise(lat, x * 0.29 - y * 0.05 + 9 - 0.05 * t, y * 0.047 + 0.018 * t + 3);
      const q = Q0[i] + swell * sin(x * 0.05 + t * 0.07) + 0.2 * ((n1 - 0.5) + 0.55 * (n2 - 0.5));
      BR[i] = P.dk[0] + dr * q;
      BG[i] = P.dk[1] + dg * q;
      BB[i] = P.dk[2] + db * q;
    }
  }
  const bub = P.bub;
  for (const b of S.trains) {
    const a = b.a * (0.7 + 0.3 * sin(b.sp * t + b.ph)), x0 = max(0, floor(b.x - 3)), x1 = min(W - 1, floor(b.x + 3));
    const y0 = max(0, floor(b.y - 3)), y1 = min(H - 1, floor(b.y + 3));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - b.x, dy = y + 0.5 - b.y, w = a * g2((dx * dx + dy * dy) / (b.r * b.r)), i = y * W + x;
        BR[i] += bub[0] * w;
        BG[i] += bub[1] * w;
        BB[i] += bub[2] * w;
      }
  }
}

// The outline of a disc as 240 radii, their slopes and the shimmer that runs round the rim.
function outline(S, f) {
  const rt = f.rt, dr = f.dr, sp = f.sp, R = f.R, hw = f.hw, t = S.t;
  for (let j = 0; j < NA; j++) sp[j] = 0;
  const top = topMode(R);
  for (let m = 2; m <= top; m++) {
    const a = f.re[m], b = f.im[m];
    if (a * a + b * b < 1e-6) continue;
    let k = 0;
    for (let j = 0; j < NA; j++) {
      sp[j] += a * CT[k] - b * ST[k];
      k += m;
      if (k >= NA) k -= NA;
    }
  }
  let rmax = 0;
  const lo = 0.32 * R;
  for (let j = 0; j < NA; j++) {
    const r = max(lo, R * (1 + hw * (HEX[j] - 1)) * exp(cl(sp[j], -0.9, 0.7)));
    rt[j] = r;
    if (r > rmax) rmax = r;
  }
  f.rmax = rmax;
  const inv = NA / (2 * TWO_PI);
  for (let j = 0; j < NA; j++) {
    const j0 = j === 0 ? NA - 1 : j - 1, j1 = j === NA - 1 ? 0 : j + 1, psi = (TWO_PI * j) / NA;
    dr[j] = (rt[j1] - rt[j0]) * inv;
    sp[j] = 1 + 0.22 * sin(3 * psi + 0.9 * t + f.w[1]) + 0.12 * sin(5 * psi - 0.55 * t + f.w[3]);
  }
}

// A bubble: a bright disc 2 to 3 LED wide with a dark ring round it.
function bubble(S, bx, by, br, wb, ab) {
  const BR = S.BR, BG = S.BG, BB = S.BB, bub = S.pal.bub, wq = max(0.55, 0.8 * wb), R2 = br + 4;
  const y0 = max(0, floor(by - R2)), y1 = min(H - 1, floor(by + R2)), x0 = max(0, floor(bx - R2)), x1 = min(W - 1, floor(bx + R2));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - bx, dy = y + 0.5 - by, pr = sqrt(dx * dx + dy * dy);
      const tc = cl(0.5 - (pr - br) / (2 * wq), 0, 1), core = tc * tc * (3 - 2 * tc);
      const e = (pr - br - 1.0) / (0.75 + 0.3 * wb), ring = g2(e * e);
      const i = y * W + x, k = 1 - 0.6 * ring * ab;
      BR[i] = BR[i] * k + bub[0] * core * ab;
      BG[i] = BG[i] * k + bub[1] * core * ab;
      BB[i] = BB[i] * k + bub[2] * core * ab;
    }
}

function drawFlower(S, f) {
  const P = S.pal, K = S.K, BR = S.BR, BG = S.BG, BB = S.BB, rt = f.rt, dr = f.dr, sp = f.sp;
  const z = f.z, wb = 0.5 + 2.3 * pow(z, 1.25), Z = 1 - 0.65 * z, wr = max(1.1, 0.9 * wb + 0.4);
  // how much of the disc, the rim and the bubble is there: it opens in the first seconds, flares at the end and goes out
  const ge = f.ph >= 2 ? sm(0, FADE_T, f.t2 - GLOW_T) : 0;
  const aD = (f.ph === 0 ? min(1, f.age / 2.5) : 1) * (1 - ge), aR = aD;
  const gain = f.ph === 1 ? 1 + 0.8 * sin((PI * min(1, f.t2 / GLOW_T)) * 0.9) : f.ph === 2 ? 1 + 0.4 * (1 - ge) : 1;
  const cx = f.x, cy = f.y, rb = f.rmax + 3 * wr + 5, fz = (1 - z) * (1 - z); // the amber fringe dies with depth
  const rimC = P.rim, finC = P.fin, foutC = P.fout;
  if (aD > 0.003) {
    const y0 = max(0, floor(cy - rb)), y1 = min(H - 1, floor(cy + rb)), x0 = max(0, floor(cx - rb)), x1 = min(W - 1, floor(cx + rb));
    const rb2 = rb * rb, wFin = 0.9 + 0.5 * wb, wOut = 0.75 + 0.5 * wb, dark = 0.3 * Z * aD;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, p2 = dx * dx + dy * dy;
        if (p2 > rb2) continue;
        const rho = sqrt(p2);
        let jf = ((atan2(dy, dx) + PI / 2) / TWO_PI) * NA;
        if (jf < 0) jf += NA;
        const j0 = jf | 0, fr = jf - j0, j1 = j0 === NA - 1 ? 0 : j0 + 1;
        const r = rt[j0] + (rt[j1] - rt[j0]) * fr, sl = (dr[j0] + (dr[j1] - dr[j0]) * fr) / r;
        const d = (rho - r) / sqrt(1 + min(sl * sl, 3)); // distance to the outline, negative inside; the slope is taken where the ray meets the outline
        const sh = sp[j0] + (sp[j1] - sp[j0]) * fr;
        const tt = cl(0.5 - d / (2 * wb), 0, 1), cov = tt * tt * (3 - 2 * tt);
        const wRim = 1.15 * Z * aR * gain * sh * g2(((d + 0.3) / wr) * ((d + 0.3) / wr));
        const e1 = (d + 1.6 + 0.5 * wb) / wFin, e2 = (d - 2.0) / wOut;
        const wIn = 0.34 * Z * aR * g2(e1 * e1);
        const gOu = Z * aR * fz * g2(e2 * e2), wOu = 0.34 * gOu;
        const halo = d > 0 ? 0.1 * Z * aR * gain * g2((d / 3) * (d / 3)) : 0.16 * Z * aD * g2(((d + 2.6) / 2.2) * ((d + 2.6) / 2.2));
        const i = y * W + x, k = (1 - dark * cov) * (1 - 0.4 * gOu), wl = wRim + halo; // the amber band dims the ground under it, so it stays amber on blue
        // the light is added on a screen, so overlapping rims climb towards white without clipping
        BR[i] = BR[i] * k + (rimC[0] * wl + finC[0] * wIn + foutC[0] * wOu) * (1 - BR[i] * 0.00392);
        BG[i] = BG[i] * k + (rimC[1] * wl + finC[1] * wIn + foutC[1] * wOu) * (1 - BG[i] * 0.00392);
        BB[i] = BB[i] * k + (rimC[2] * wl + finC[2] * wIn + foutC[2] * wOu) * (1 - BB[i] * 0.00392);
      }
    }
    // the bubble, at the middle
    const br = (0.95 + 0.026 * f.R) * (1 - 0.2 * z) * (1 + 0.05 * sin(1.7 * S.t + f.w[5]));
    bubble(S, cx + f.bx, cy + f.by, br, wb, Z * aD * (f.ph === 0 ? min(1, f.age / 4) : 1));
  }
  // the ghost bubbles of an ended disc: the bubble has split, and each piece shrinks and goes out in its own time
  if (f.ph >= 2) {
    const e = f.ph === 2 ? ge : 1;
    for (let k = 0; k < f.gn; k++) {
      const life = f.ph === 2 ? 99 : f.gl[k];
      if (life <= 0) continue;
      const fade = min(1, life / 3), r = f.gr[k] * (0.6 + 0.4 * fade) * (1 - 0.2 * z);
      bubble(S, cx + f.bx * (1 - e) + f.gx[k] * e, cy + f.by * (1 - e) + f.gy[k] * e, r, wb, Z * e * fade);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  palette(S, cl(S.kn[0], 0, 1));
  ground(S);
  // far to near
  const ord = S.ord;
  ord.length = 0;
  for (let i = 0; i < MAXF; i++) if (S.fl[i].ph >= 0) ord.push(S.fl[i]);
  ord.sort((a, b) => b.z - a.z);
  for (const f of ord) {
    outline(S, f);
    drawFlower(S, f);
  }
  const BR = S.BR, BG = S.BG, BB = S.BB;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      display.setPixel(x, y, cl(BR[i], 0, 255) | 0, cl(BG[i], 0, 255) | 0, cl(BB[i], 0, 255) | 0);
    }
}
