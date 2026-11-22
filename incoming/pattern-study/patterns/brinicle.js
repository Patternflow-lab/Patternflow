// ===== Patternflow pattern =====
// Title:   Brinicle
// Family:  brinicle
// Idea:    Under a roof of pale sea ice, cold brine leaks out and sinks as a blue-white plume that freezes the seawater around it into a hollow white tube growing down toward the seabed, where the brine fans out and an ice web races along the floor, up to three tubes at once at different stages, each one dimming, loosening and breaking away a few minutes after it finishes.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Brinicles, the ice stalactites that grow down from sea ice around sinking brine, Martin and Kauffman (1974); filmed growing to the seabed by Miller and Wilson for the BBC (2011)
// Round:   216
// ===============================
// @matrix 64x128
// @knobs Hue=-0.12..0.33, Brine=0.8..4, Current=-1..1, Spawn=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of the water, the ice and the brine. At the opening 0 the water runs from navy (8, 41, 77) under the ice to near-black teal (1, 19, 26) above the seabed, the ice is white with a cold cast and the brine is a blue-white. The range stops short of red and orange, since a dark orange sea reads as mud on a panel: at -0.12 the water is teal, at 0.33 it is violet to magenta.
// Knob 2: Brine. The flux of brine, the knob over 2, so 0.4 to 2. A tube sinks 1.1 LEDs a second at the opening 2, 0.44 at 0.8 and 2.2 at 4, and each tube runs at 0.8 to 1.25 times that, so a tube takes 83 to 113 s to reach the seabed at the opening, 120 to 260 s at 0.8 and about 60 s at 4. The dye is 16 particles a second at 0.8, 40 at 2 and 80 at 4, each one brighter the higher the flux. A tube is 2.6 LEDs wide at the mouth and, near the roof after 100 s, 6.6 LEDs wide at 0.8, 7.6 at 2 and 9.2 at 4.
// Knob 3: Current. A sideways drift of the water, signed, 0 in the middle and still. The water moves 2.2 LEDs a second at either end of the knob and the plume leans with it. A tube turns toward that lean, 19 degrees from the vertical, so one that has reached the seabed has moved 20 to 35 LEDs toward the current. New tubes start upstream so they stay on the panel. The faint light in the water drifts at 0.3 LEDs a second at 0, 2.3 at 1 and -1.7 at -1.
// Knob 4: Spawn. How many tubes may be sinking at once and how soon the next one starts: one below -0.32, two up to 0.34 and three above it. The wait after the last start is at least 32 s at -1 and 8 s at 1, and about 10 s and 3 s more on average. A tube that has touched down no longer counts, so at -1 one tube sinks while up to two stand. Three tubes is the most the panel ever holds, a dying one included.

// The panel is a side view under polar sea ice. Rows 0 to about 10 are the underside of the ice, rows about
// 116 to 127 the silt of the seabed, and between them the water goes from navy to near black, with a faint
// soft light drifting through it.
// A brinicle begins as a point inside the ice. Its tip sinks at 1.1 LEDs a second times the flux times the
// tube's own pace, and the path lays a vertex every 2 LEDs. The heading turns toward the lean of the plume
// (the arctangent of the current over the 6.2 LEDs a second the dye falls at) with a time constant of 20 s,
// plus a small wander, so a change of the current bends the tube from there on and leaves the old part where
// it was. A vertex's radius grows with its age, from 1.3 LEDs toward 2.2 + 0.8 times the flux with a time
// constant of 45 s, then by 0.007 LEDs a second for 110 s more, so the tube is thick and white near the roof
// and thin and bright at the mouth. It is drawn row by row: a soft white wall, a bluer bore, a cool halo.
// Water pushes the middle of every tube sideways, held at the roof and at the seabed: up to 4 LEDs on
// two swings of 37 s and 56 s with no common period, so a standing tube still moves.
// The dye is particles that start at the mouth, 40 a second times the flux. Each is pulled toward a fall
// speed of 6.2 LEDs a second and toward the speed of the water, which sways with depth and time the same way
// for all the dye of one brinicle, so the plume sways as one stream. A random kick that grows with age widens
// it as it falls. Each particle is a soft gaussian that widens and dims over 3.4 to 6.2 s. One that reaches
// the floor turns sideways and slides along it, much dimmer.
// When the tip reaches the seabed the brine fans out. Two trunks run along the floor, one each way, at about
// 5.5 LEDs a second at first and slowing with a time constant of 5 s, so each side reaches 13 to 32 LEDs
// before the panel edge cuts it. Side twigs leave a trunk every 5 to 9 LEDs, lean forward 40 to 70 degrees
// and rise 5 to 8 LEDs at most, and a twig may fork once. Later in a stand a twig now and then grows from the
// trunk. Every segment is drawn at least 2 LEDs wide, with a faint frost on the floor between the two fronts.
// A brinicle stands 60 to 135 s after it touches down, its plume and its light weakening. Then it dies in 26
// to 36 s: a break opens somewhere between a third and three quarters of the way down and the lower piece
// falls and fades, the rest dissolves from the bottom up in runs a few LEDs long, and the web fades over 46 s,
// the far ends first. Nothing stays: from its start a tube, its plume and its web are gone in 3 to 5 minutes
// at the opening settings.
// At most three tubes exist at a time. A new one starts after a random wait once fewer than the Spawn knob's
// share are still sinking, at a random column at least 12 LEDs from the others. Starts are spaced by at
// least 8 to 32 s, so at any moment one tube is usually sinking and another is usually standing or dying.
// The first update runs the sea for as long as the first tube needs to be 38 to 63 percent of the way down,
// in steps of 0.2 s, at the knob values it opened with, so the picture is formed at second 0.
// The ice edge is four swells with no common period, the slowest about 2.5 minutes.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, exp, sqrt, abs, pow, atan, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const F = (n) => new Float32Array(n);

// ---- the sea
const ICE_Y = 8; // mean row of the underside of the ice
const BED_Y = 117; // mean row of the seabed
const ROOT_Y = 2; // row where a tube starts, inside the ice, so its top is hidden
const V_GROW = 1.1; // how fast a tube tip sinks at flux 1, LEDs a second
const V_FALL = 6.2; // how fast the dye falls once it is out of the tube, LEDs a second
const V_LEAN = 2.2; // sideways speed of the water at Current 1, LEDs a second
const BOW = 4; // how far the middle of a tube is pushed to either side by the water, LEDs
const VERT = 2; // path length between tube vertices, LEDs
const NV = 120; // most vertices a tube has
const NS = 520; // most web segments a brinicle has
const NPART = 1500; // most dye particles
const R_MOUTH = 1.3; // half width of a new tube, LEDs
const TAU_R = 45; // seconds for a vertex to reach most of its full radius
const STAND = [60, 135]; // seconds a brinicle stands after it touches down
const DIE = [26, 36]; // seconds it takes to die
const WEB_FADE = 46; // seconds the web takes to fade once its tube starts to die
const REACH = 34; // LEDs of floor a web is measured against when it fades from the far end in

const EXPT = F(512); // exp(-q) at a step of 1/64
for (let i = 0; i < 512; i++) EXPT[i] = exp(-i / 64);
const TONE = F(1024); // soft shoulder: linear to 0.6, then rolls toward 1
for (let i = 0; i < 1024; i++) {
  const v = i / 256;
  TONE[i] = v < 0.6 ? v : 0.6 + 0.4 * (1 - exp(-(v - 0.6) / 0.4));
}

function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

export function setup(params) {
  const S = {
    t: 0, cur: 0, hue: 0, f: 1, u: 0, cap: 2, gap: 8, sep: 30, last: 0, pending: false, nextSpawn: 0, ready: false, key: "",
    bs: [], np: 0,
    R: F(N), G: F(N), B: F(N), wb: F(N), // light, and the web's own coverage
    bed: F(W), ice: F(W), thick: F(W),
    px: F(NPART), py: F(NPART), pvx: F(NPART), pvy: F(NPART), pa: F(NPART), pl: F(NPART), pph: F(NPART), pam: F(NPART), pfl: new Uint8Array(NPART),
    vx: F(NV + 2), vy: F(NV + 2), vr: F(NV + 2), va: F(NV + 2), vw: F(NV + 2),
    pal: { top: [0, 0, 0], bot: [0, 0, 0], silt: [0, 0, 0], ice: [0, 0, 0], thin: [0, 0, 0], brine: [0, 0, 0], glow: [0, 0, 0] },
    ph: [0, 0, 0, 0, 0, 0, 0, 0, 0].map(() => Math.random() * 6.283),
  };
  // The seabed: a gentle, fixed profile, 114 to 120 at the extremes.
  for (let x = 0; x < W; x++) {
    const xx = x + 0.5;
    S.bed[x] = BED_Y + 0.95 * sin(xx * 0.17 + S.ph[0]) + 0.6 * sin(xx * 0.41 + S.ph[1]) + 0.35 * sin(xx * 0.93 + S.ph[2]);
  }
  params.s = S;
}

// How far a tube is bowed sideways at row y and time t: it is held at the roof and, once down, at the seabed,
// and the water pushes the middle to and fro with two slow swings that have no common period.
function bowAt(b, y, t) {
  const u = cl((y - ROOT_Y) / (BED_Y - ROOT_Y), 0, 1);
  return BOW * sin(3.1416 * u) * (sin(t * 0.17 + b.ph) + 0.65 * sin(t * 0.113 + 2.1 * b.ph)) * 0.62;
}

function bedAt(S, x) {
  const c = cl(x - 0.5, 0, W - 1.001), i = floor(c), f = c - i;
  return mix(S.bed[i], S.bed[i + 1], f);
}

// The row of the underside of the ice at column x and time t: four slow swells with no common period, the
// slowest one about 3 minutes.
function iceAt(S, x, t) {
  const ph = S.ph;
  return ICE_Y + 2.3 * sin(x * 0.19 + ph[3] + t * 0.042) + 1.7 * sin(x * 0.43 + ph[4] - t * 0.064) + 1 * sin(x * 0.87 + ph[5] + t * 0.087) + 0.5 * sin(x * 1.7 + ph[6] - t * 0.115);
}

// ---- knobs and the clock
function readKnobs(S, k) {
  S.hue = k[0];
  S.f = cl(k[1], 0.8, 4) / 2;
  S.u = V_LEAN * cl(k[2], -1, 1);
  const u4 = (cl(k[3], -1, 1) + 1) / 2;
  S.cap = u4 < 0.34 ? 1 : u4 < 0.67 ? 2 : 3;
  S.gap = mix(10, 3, u4);
  S.sep = mix(32, 8, u4);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  readKnobs(S, k);
  if (!S.ready) {
    prerun(S);
    S.ready = true;
  }
  step(S, d);
}

function prerun(S) {
  const lead = spawn(S, true), target = 0.38 + 0.25 * Math.random();
  for (let i = 0; i < 1500 && progress(lead) < target; i++) step(S, 0.2);
}

const progress = (b) => cl((b.tipy - ICE_Y) / (BED_Y - ICE_Y), 0, 1);

function step(S, dt) {
  S.t += dt;
  S.cur += (0.3 + 0.9 * S.u) * dt;
  manage(S);
  for (let i = S.bs.length - 1; i >= 0; i--) {
    const b = S.bs[i];
    advance(S, b, dt);
    if (b.tubeGone && (!b.web || b.wd >= 1)) S.bs.splice(i, 1);
  }
  moveDye(S, dt);
}

// A new brinicle starts after a random wait whenever fewer than the cap are still sinking and fewer than
// three tubes are on the panel. A tube that is dying still counts as a tube, and one that has touched down
// stands without counting against the cap, so something is nearly always growing.
function manage(S) {
  let live = 0, tubes = 0;
  for (const b of S.bs) {
    if (!b.tubeGone) tubes++;
    if (b.phase === 0) live++;
  }
  if (live < S.cap && tubes < 3) {
    if (!S.pending) {
      S.pending = true;
      S.nextSpawn = max(S.t + 2, live === 0 ? 0 : S.last + S.sep) + -log(1 - Math.random()) * S.gap;
    } else if (S.t >= S.nextSpawn && spawn(S, false)) S.pending = false;
  } else S.pending = false;
}

function spawn(S, force) {
  const lean = cl(S.u / V_LEAN, -1, 1);
  const lo = 8 + 20 * max(0, -lean), hi = 56 - 20 * max(0, lean);
  let best = -1, bd = -1;
  for (let i = 0; i < 14 && bd < 15; i++) {
    const x = mix(lo, hi, Math.random());
    let dm = 99;
    for (const b of S.bs) if (!b.tubeGone) dm = min(dm, abs(x - b.x0));
    if (dm > bd) {
      bd = dm;
      best = x;
    }
  }
  if (!force && bd < 12) return null;
  const b = {
    x0: best, n: 1, tipx: best, tipy: ROOT_Y, head: 0, phase: 0, tp: 0, age: 0,
    pace: 0.8 + 0.45 * Math.random(), stand: mix(STAND[0], STAND[1], Math.random()), dieLen: mix(DIE[0], DIE[1], Math.random()),
    ph: Math.random() * 6.283, acc: 0, ff: 1, dim: 1, dp: 0, tubeGone: false, brk: -1, fallT: 0, fvy: 0,
    px: F(NV), py: F(NV), pt: F(NV), th: F(NV),
    web: false, wd: 0, wdT: 0, webT: 0, ns: 0, wl: best, wr: best, tips: [], lateT: 0, nLate: 0,
    sx0: F(NS), sy0: F(NS), sx1: F(NS), sy1: F(NS), sw: F(NS), sq: F(NS), sb: F(NS),
  };
  b.px[0] = best;
  b.py[0] = ROOT_Y;
  b.pt[0] = S.t;
  S.bs.push(b);
  S.last = S.t;
  return b;
}

function advance(S, b, dt) {
  b.tp += dt;
  b.age += dt;
  if (b.phase === 0) grow(S, b, dt);
  else if (b.phase === 1) {
    const sf = b.tp / b.stand;
    b.ff = 1 - 0.65 * sm(0.1, 1, sf);
    b.dim = 1 - 0.34 * sm(0.05, 1, sf);
    if (b.tp >= b.stand) {
      b.phase = 2;
      b.tp = 0;
      startDeath(b);
    }
  } else {
    b.dp = min(1, b.tp / b.dieLen);
    b.ff = 0.35 * (1 - sm(0, 0.5, b.dp));
    b.dim = 0.66;
    if (b.brk < 0 && b.dp > 0.1) {
      b.brk = max(2, floor(b.n * mix(0.33, 0.75, Math.random())));
      b.fallT = 0;
      b.fvy = 0.5;
      // The tube thins out on both sides of the break first, so the gap is ragged and not a clean cut.
      for (let i = max(0, b.brk - 4); i < min(b.n, b.brk + 3); i++) b.th[i] = min(b.th[i], 0.14 + 0.07 * abs(i - b.brk + 0.5));
    }
    if (b.brk >= 0) {
      b.fallT += dt;
      b.fvy += 3.5 * dt;
      for (let i = b.brk; i < b.n; i++) {
        b.py[i] = min(b.py[i] + b.fvy * dt, bedAt(S, b.px[i]) + 1);
        b.px[i] += 0.25 * S.u * dt;
      }
    }
    if (b.dp >= 1) b.tubeGone = true;
  }
  if (b.web) {
    b.webT += dt;
    if (b.phase === 2) {
      b.wdT += dt;
      b.wd = min(1, b.wdT / WEB_FADE);
    }
    growWeb(S, b, dt);
  }
  // Dye leaves the mouth while the flux lasts.
  if (b.ff > 0.02 && !b.tubeGone) {
    b.acc += 40 * S.f * b.ff * dt;
    while (b.acc >= 1 && S.np < NPART) {
      b.acc -= 1;
      emit(S, b);
    }
    b.acc = min(b.acc, 3);
  }
}

function grow(S, b, dt) {
  const v = V_GROW * S.f * b.pace * (0.9 + 0.2 * sin(S.t * 0.31 + b.ph));
  let target = atan(S.u / V_FALL) + 0.07 * sin(b.age * 0.21 + b.ph) + 0.04 * sin(b.age * 0.53 + 2 * b.ph);
  // Near a side of the panel the tube turns back toward the middle.
  const l = sm(15, 6, b.tipx), r = sm(49, 58, b.tipx);
  target = target * (1 - l - r) + 0.45 * l - 0.45 * r;
  b.head += (target - b.head) * (1 - exp(-dt / 20));
  b.tipx += v * dt * Math.sin(b.head);
  b.tipy += v * dt * Math.cos(b.head);
  const i = b.n - 1, dx = b.tipx - b.px[i], dy = b.tipy - b.py[i];
  if (dx * dx + dy * dy >= VERT * VERT && b.n < NV) {
    b.px[b.n] = b.tipx;
    b.py[b.n] = b.tipy;
    b.pt[b.n] = S.t;
    b.n++;
  }
  const bed = bedAt(S, b.tipx);
  if (b.tipy >= bed - 1) {
    b.tipy = bed - 1;
    b.px[b.n - 1] = b.tipx;
    b.py[b.n - 1] = b.tipy;
    b.phase = 1;
    b.tp = 0;
    startWeb(S, b);
  }
}

function startDeath(b) {
  const n = b.n;
  for (let i = 0; i < n; i++) {
    const u = i / max(1, n - 1);
    b.th[i] = max(0.12, 0.12 + 0.62 * (1 - u) + 0.1 * sin(i * 0.55 + b.ph) + 0.07 * sin(i * 1.3 + 2 * b.ph));
  }
}

// ---- the dye
function emit(S, b) {
  const i = S.np++;
  S.px[i] = b.tipx + bowAt(b, b.tipy, S.t) + (Math.random() - 0.5) * R_MOUTH * 1.2;
  S.py[i] = b.tipy - 0.4;
  S.pvx[i] = 0.5 * S.u + (Math.random() - 0.5) * 0.8;
  S.pvy[i] = 7 + 4 * Math.random();
  S.pa[i] = 0;
  S.pl[i] = 3.4 + 2.8 * Math.random();
  S.pph[i] = b.ph + (Math.random() - 0.5) * 0.5; // the phase of its brinicle's sway, so the plume sways as one
  S.pam[i] = (0.5 + 0.4 * S.f) * (0.5 + 0.5 * b.ff);
  S.pfl[i] = 0;
}

function moveDye(S, dt) {
  const { px, py, pvx, pvy, pa, pl, pph, pfl } = S, t = S.t;
  const kx = 1 - exp(-1.4 * dt), ky = 1 - exp(-0.8 * dt), kf = exp(-0.55 * dt), sq = sqrt(dt);
  for (let i = 0; i < S.np; i++) {
    pa[i] += dt;
    if (pa[i] > pl[i] || px[i] < -8 || px[i] > 72) {
      const j = --S.np;
      px[i] = px[j]; py[i] = py[j]; pvx[i] = pvx[j]; pvy[i] = pvy[j]; pa[i] = pa[j]; pl[i] = pl[j]; pph[i] = pph[j]; S.pam[i] = S.pam[j]; pfl[i] = pfl[j];
      i--;
      continue;
    }
    if (pfl[i]) {
      pvx[i] *= kf;
      px[i] += pvx[i] * dt;
      py[i] = bedAt(S, px[i]) - 1.6;
      continue;
    }
    const uw = 0.9 * S.u + min(1, pa[i] / 1.6) * (3.4 * sin(py[i] * 0.16 + t * 0.9 + pph[i]) + 1.7 * sin(py[i] * 0.33 - t * 1.7 + 2 * pph[i]));
    pvx[i] += (uw - pvx[i]) * kx + (Math.random() - 0.5) * 2.4 * sq * (0.4 + 0.5 * pa[i]);
    pvy[i] += (V_FALL - pvy[i]) * ky;
    px[i] += pvx[i] * dt;
    py[i] += pvy[i] * dt;
    const yb = bedAt(S, px[i]) - 1.6;
    if (py[i] > yb) {
      py[i] = yb;
      pfl[i] = 1;
      S.pam[i] *= 0.15;
      pvx[i] = (pvx[i] >= 0 ? 1 : -1) * (1.6 + 2.6 * Math.random());
      pl[i] = min(pl[i], pa[i] + 2.4 + 2 * Math.random());
    }
  }
}

// ---- the web on the floor
function mkTip(x, y, dir, ang, sp, gen, life, w) {
  return { x, y, dir, ang, sp, gen, life, dn: 3 + 3 * Math.random(), lx: x, ly: y, w, forks: 0, hmax: 4.6 + 3 * Math.random() };
}

function startWeb(S, b) {
  b.web = true;
  b.webT = 0;
  const x = b.tipx, y = bedAt(S, x) - 0.8;
  for (const dir of [-1, 1]) {
    const t = mkTip(x, y, dir, 0, 5.5 * (0.75 + 0.45 * Math.random()), 0, 99, 1.3);
    t.rf = 0.8 + 0.3 * S.f;
    b.tips.push(t);
  }
  // A few twigs at once, so the fan has a shape the moment it starts.
  for (let i = 0; i < 2; i++)
    b.tips.push(mkTip(x, y, i % 2 ? 1 : -1, 0.9 + 0.5 * Math.random(), 2.4 + Math.random(), 1, 1.6 + 1 * Math.random(), 1));
}

function addSeg(S, b, t, x, y) {
  if (b.ns >= NS) return;
  const i = b.ns++;
  b.sx0[i] = t.lx;
  b.sy0[i] = t.ly;
  b.sx1[i] = x;
  b.sy1[i] = y;
  b.sw[i] = t.w;
  b.sq[i] = min(1, abs(x - b.tipx) / REACH);
  b.sb[i] = S.t;
  t.lx = x;
  t.ly = y;
  b.wl = min(b.wl, x);
  b.wr = max(b.wr, x);
}

function growWeb(S, b, dt) {
  const tips = b.tips;
  for (let k = tips.length - 1; k >= 0; k--) {
    const t = tips[k];
    let moved;
    if (t.gen === 0) {
      t.sp = 5.5 * t.rf * exp(-b.webT / 5) * (0.8 + 0.4 * sin(b.webT * 1.7 + k));
      if (t.sp < 0.45 || t.x < -6 || t.x > 70) {
        tips.splice(k, 1);
        continue;
      }
      moved = t.sp * dt;
      t.x += t.dir * moved;
      t.y = bedAt(S, t.x) - 0.8;
    } else {
      t.life -= dt;
      const h = bedAt(S, t.x) - t.y;
      if (t.life <= 0 || h > t.hmax || t.x < -6 || t.x > 70) {
        tips.splice(k, 1);
        continue;
      }
      t.ang += (Math.random() - 0.5) * 2.2 * dt;
      t.ang = cl(t.ang, 0.25, 1.5);
      moved = t.sp * dt;
      t.x += t.dir * Math.cos(t.ang) * moved;
      t.y -= Math.sin(t.ang) * moved;
      const yb = bedAt(S, t.x) - 0.5;
      if (t.y > yb) t.y = yb;
    }
    const dx = t.x - t.lx, dy = t.y - t.ly;
    if (dx * dx + dy * dy >= 2.6) addSeg(S, b, t, t.x, t.y);
    t.dn -= moved;
    if (t.dn <= 0 && b.ns < NS - 20) {
      t.dn = 5 + 4 * Math.random();
      if (t.gen === 0) {
        const fwd = Math.random() < 0.72;
        const w = mkTip(t.x, t.y, fwd ? t.dir : -t.dir, 0.75 + 0.5 * Math.random(), 3 + 1.5 * Math.random(), 1, 1.5 + 1.2 * Math.random(), 1);
        tips.push(w);
      } else if (t.gen === 1 && t.forks < 1 && t.life > 1 && Math.random() < 0.35) {
        t.forks++;
        const w = mkTip(t.x, t.y, Math.random() < 0.5 ? t.dir : -t.dir, cl(t.ang + (Math.random() < 0.5 ? 0.6 : -0.6), 0.3, 1.5), t.sp * 0.8, 2, min(1.5, t.life), 0.9);
        tips.push(w);
      }
    }
  }
  // Later in a stand a twig now and then grows from the trunk, so the web is not finished in 20 s.
  if (b.phase === 1 && b.nLate < 20) {
    b.lateT += dt;
    if (b.lateT > 4 && b.ns > 12) {
      b.lateT = 0;
      b.nLate++;
      const i = floor(Math.random() * min(b.ns, 120));
      if (b.sw[i] > 1.2 && b.sq[i] < 0.9) {
        const dir = b.sx1[i] >= b.tipx ? 1 : -1;
        const w = mkTip(b.sx1[i], b.sy1[i], Math.random() < 0.7 ? dir : -dir, 0.5 + 0.7 * Math.random(), 1.8, 1, 2.6, 1);
        tips.push(w);
      }
    }
  }
}

// ---- drawing
function palette(S) {
  const key = S.hue.toFixed(3);
  if (key === S.key) return;
  S.key = key;
  const h = 0.585 + S.hue, p = S.pal;
  hsv(h, 0.9, 0.3, p.top);
  hsv(h - 0.04, 0.95, 0.1, p.bot);
  hsv(h - 0.03, 0.4, 0.3, p.silt);
  hsv(h - 0.04, 0.2, 1, p.ice);
  hsv(h - 0.01, 0.55, 0.85, p.thin);
  hsv(h - 0.06, 0.62, 1, p.brine);
  hsv(h - 0.04, 0.5, 1, p.glow);
}

// The water, a faint drifting light in it, and the silt.
function water(S) {
  const { R, G, B, bed, pal } = S, t = S.t, c = S.cur;
  const { top, bot, silt } = pal;
  for (let y = 0, p = 0; y < H; y++) {
    const yy = y + 0.5, d = pow(sm(ICE_Y, BED_Y, yy), 0.85);
    const wr = mix(top[0], bot[0], d), wg = mix(top[1], bot[1], d), wbl = mix(top[2], bot[2], d);
    const env = 0.5 + 0.5 * (1 - d);
    const sw = sin(yy * 0.05 + t * 0.07);
    for (let x = 0; x < W; x++, p++) {
      const xx = x + 0.5 - c;
      const a = sin(xx * 0.071 + yy * 0.019 + t * 0.052), b = sin(xx * 0.043 - yy * 0.027 - t * 0.067 + 1.7), e = sin((xx + 3 * sw) * 0.113 + t * 0.041);
      const veil = max(0, 0.45 + 0.4 * a * b + 0.25 * e * a);
      const lit = 0.22 * veil * veil * env;
      let r = wr + lit * 0.35, g = wg + lit * 0.9, bl = wbl + lit * 1.1;
      const cov = cl((yy - bed[x]) / 1.4 + 0.5, 0, 1);
      if (cov > 0) {
        const lump = 0.85 + 0.3 * sin(xx * 0.35 + yy * 0.2) * sin(xx * 0.17 - yy * 0.31 + 1), dk = lump * (1 - 0.3 * sm(BED_Y, 128, yy));
        r = mix(r, silt[0] * dk, cov);
        g = mix(g, silt[1] * dk, cov);
        bl = mix(bl, silt[2] * dk, cov);
      }
      R[p] = r;
      G[p] = g;
      B[p] = bl;
    }
  }
}

function addGauss(S, cx, cy, sg, a, col) {
  const { R, G, B } = S, rad = ceil(2.5 * sg), inv = 1 / (2 * sg * sg);
  const x0 = max(0, floor(cx - rad)), x1 = min(W - 1, ceil(cx + rad)), y0 = max(0, floor(cy - rad)), y1 = min(H - 1, ceil(cy + rad));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, q = (dx * dx + dy * dy) * inv;
      if (q >= 7.9) continue;
      const v = a * EXPT[(q * 64) | 0], p = y * W + x;
      R[p] += col[0] * v;
      G[p] += col[1] * v;
      B[p] += col[2] * v;
    }
  }
}

function dye(S) {
  const { px, py, pa, pl, pam } = S, br = S.pal.brine;
  for (let i = 0; i < S.np; i++) {
    const age = pa[i], u = age / pl[i], sg = min(3.3, 1 + 0.3 * age);
    const a = pam[i] * pow(1 - u, 1.7) * pow(1 / sg, 1.4) * 0.42 * sm(0, 0.25, age + 0.1);
    addGauss(S, px[i], py[i], sg, a, br);
  }
}

// One tube, row by row: a soft white wall, a bluer bore, and a cool halo.
function tube(S, b) {
  const { vx, vy, vr, va, vw } = S, n = b.n, t = S.t, pal = S.pal;
  const rMax = 2.2 + 0.8 * S.f, loose = sm(0.7, 1, b.tp / b.stand) * (b.phase === 1 ? 1 : 0) + (b.phase === 2 ? 1 : 0);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const age = t - b.pt[i], u = i / max(1, n - 1);
    const r = (R_MOUTH + (rMax - R_MOUTH) * (1 - exp(-age / TAU_R)) + 0.007 * min(age, 110)) * (1 + 0.1 * sin(b.py[i] * 0.31 + b.ph) + 0.07 * sin(b.py[i] * 0.77 + 2 * b.ph) + 0.17 * sin(b.py[i] * 0.11 - t * 0.35 + 3 * b.ph));
    let a = 1;
    if (b.phase === 2) {
      a = 1 - sm(b.th[i] - 0.1, b.th[i] + 0.1, b.dp);
      if (b.brk >= 0 && i >= b.brk) a *= exp(-b.fallT / 3.2);
    }
    vx[m] = b.px[i] + bowAt(b, b.py[i], t) + loose * 1.3 * sin(i * 0.9 + t * 1.9 + b.ph) * (0.3 + 0.7 * u);
    vy[m] = b.py[i];
    vr[m] = r + 1.6 * exp(-(b.py[i] - ICE_Y) / 6);
    va[m] = a * b.dim;
    vw[m] = clamp01(1 - (b.py[i] - 10) / 100);
    m++;
  }
  if (b.phase === 0) {
    vx[m] = b.tipx + bowAt(b, b.tipy, t);
    vy[m] = b.tipy;
    vr[m] = R_MOUTH;
    va[m] = 1;
    vw[m] = clamp01(1 - (b.tipy - 10) / 100);
    m++;
  }
  const { R, G, B } = S, ice = pal.ice, br = pal.brine, gl = pal.glow;
  // The brine does not flow evenly: the whole tube brightens and dims by a fifth over 30 s or so, and swells a little.
  const breath = 1 + 0.2 * sin(t * 0.2 + 1.7 * b.ph) + 0.08 * sin(t * 0.31 + b.ph), swell = 1 + 0.1 * sin(t * 0.12 + 2 * b.ph);
  const bore = (0.42 + 0.3 * min(1, S.f)) * (0.35 + 0.65 * b.ff) * breath;
  for (let i = 0; i < m - 1; i++) {
    if (b.phase === 2 && b.brk >= 0 && i + 1 === b.brk) continue;
    const y0 = vy[i], y1 = vy[i + 1];
    if (y1 <= y0 + 1e-3 || (va[i] < 0.01 && va[i + 1] < 0.01)) continue;
    const sl = (vx[i + 1] - vx[i]) / (y1 - y0);
    for (let yy = max(0, ceil(y0 - 0.5)); yy < min(H, ceil(y1 - 0.5)); yy++) {
      const u = (yy + 0.5 - y0) / (y1 - y0);
      const xc = mix(vx[i], vx[i + 1], u), r = mix(vr[i], vr[i + 1], u), a = mix(va[i], va[i + 1], u), w = mix(vw[i], vw[i + 1], u);
      const eh = r * swell * sqrt(1 + sl * sl), sb = 0.38 * eh + 0.5, ib = 1 / (2 * sb * sb);
      const pulse = 0.88 + 0.12 * sin(yy * 0.3 - t * 2.4 + b.ph), band = 1 + 0.1 * sin(yy * 0.85 + b.ph * 1.7) + 0.06 * sin(yy * 0.37 + b.ph);
      const wallK = (0.42 + 0.3 * w) * a * band * breath, boreK = bore * pulse * a, haloK = 0.15 * a * breath;
      const xa = max(0, floor(xc - eh - 7)), xb = min(W - 1, ceil(xc + eh + 7));
      for (let xx = xa; xx <= xb; xx++) {
        const d = abs(xx + 0.5 - xc), p = yy * W + xx;
        const cov = cl((eh + 0.55 - d) * 0.9, 0, 1);
        const o = d > eh ? d - eh : 0, hq = o * o * 0.11;
        const halo = hq < 7.9 ? EXPT[(hq * 64) | 0] : 0;
        const bq = d * d * ib, bo = bq < 7.9 ? EXPT[(bq * 64) | 0] : 0;
        const wl = wallK * cov, bl = boreK * bo * cov, hl = haloK * halo * (1 - 0.6 * cov);
        R[p] += ice[0] * wl + br[0] * bl + gl[0] * hl;
        G[p] += ice[1] * wl + br[1] * bl + gl[1] * hl;
        B[p] += ice[2] * wl + br[2] * bl + gl[2] * hl;
      }
    }
  }
  // The mouth: where the tube is thinnest, the brightest place.
  if (b.phase < 2 && !b.tubeGone) {
    addGauss(S, b.tipx + bowAt(b, b.tipy, t), b.tipy + 0.5, 1.5 + 0.4 * S.f, (0.32 + 0.16 * S.f) * (0.4 + 0.6 * b.ff) * (b.phase === 0 ? 1 : 0.45), br);
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Soft frost under the floor between the two fronts.
function frost(S, b) {
  if (!b.web || b.wd >= 1) return;
  const { R, G, B } = S, gl = S.pal.glow;
  const alive = 1 - sm(0, 0.6, b.wd), grow = sm(0, 3, b.webT);
  const xl = b.wl, xr = b.wr, mid = b.tipx;
  for (let x = max(0, floor(xl - 4)); x <= min(W - 1, ceil(xr + 4)); x++) {
    const xx = x + 0.5, e = sm(xl - 4, xl + 3, xx) * (1 - sm(xr - 3, xr + 4, xx));
    if (e <= 0) continue;
    const c = 1 - 0.45 * abs(xx - mid) / (max(xr - mid, mid - xl) + 1), yb = S.bed[x];
    for (let y = max(0, floor(yb - 7)); y < min(H, ceil(yb + 6)); y++) {
      const dy = y + 0.5 - yb, v = 0.08 * alive * grow * e * c * (dy < 0 ? exp(dy / 2.4) : 0.5 * exp(-dy / 3)), p = y * W + x;
      R[p] += gl[0] * v;
      G[p] += gl[1] * v;
      B[p] += gl[2] * v;
    }
  }
}

function web(S, b) {
  if (!b.web || b.wd >= 1) return;
  const wb = S.wb, t = S.t;
  for (let i = 0; i < b.ns; i++) {
    const q = b.sq[i], alive = 1 - sm(0.55 * (1 - q), 0.55 * (1 - q) + 0.45, b.wd);
    if (alive < 0.02) continue;
    const a = alive * (0.8 + 0.5 * exp(-(t - b.sb[i]) / 1.1)), sg = 0.5 + 0.4 * b.sw[i], is = 1 / (2 * sg * sg), it = is / 5.8;
    const x0 = b.sx0[i], y0 = b.sy0[i], x1 = b.sx1[i], y1 = b.sy1[i], vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1e-6;
    const rad = ceil(3.2 * sg * 2.4) | 0;
    const xa = max(0, floor(min(x0, x1) - rad)), xb = min(W - 1, ceil(max(x0, x1) + rad)), ya = max(0, floor(min(y0, y1) - rad)), yb = min(H - 1, ceil(max(y0, y1) + rad));
    for (let y = ya; y <= yb; y++) {
      const py = y + 0.5;
      for (let x = xa; x <= xb; x++) {
        const px = x + 0.5;
        let u = ((px - x0) * vx + (py - y0) * vy) / l2;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const dx = px - x0 - u * vx, dy = py - y0 - u * vy, d2 = dx * dx + dy * dy, q = d2 * is, q2 = d2 * it;
        if (q2 >= 7.9) continue;
        const v = a * (0.9 * (q < 7.9 ? EXPT[(q * 64) | 0] : 0) + 0.1 * EXPT[(q2 * 64) | 0]), p = y * W + x;
        if (v > wb[p]) wb[p] = v;
      }
    }
  }
  // The leading tips of the trunks glow while they run.
  for (const tp of b.tips) if (tp.gen === 0) addGauss(S, tp.x, tp.y - 0.5, 2, 0.28 * (1 - b.wd), S.pal.glow);
}

function webOut(S) {
  const { R, G, B, wb, pal } = S, ice = pal.ice, br = pal.brine;
  for (let p = W * 98; p < N; p++) {
    const v = wb[p];
    if (v <= 0) continue;
    wb[p] = 0;
    R[p] += (ice[0] * 0.75 + br[0] * 0.25) * v;
    G[p] += (ice[1] * 0.75 + br[1] * 0.25) * v;
    B[p] += (ice[2] * 0.75 + br[2] * 0.25) * v;
  }
}

// The roof: ice with a rough, thinning underside, and a collar where a tube hangs from it.
function roof(S) {
  const { R, G, B, ice, thick, pal } = S, t = S.t;
  for (let x = 0; x < W; x++) {
    let e = iceAt(S, x + 0.5, t);
    for (const b of S.bs) if (!b.tubeGone) e += 2.6 * min(1, (b.tipy - ROOT_Y) / 10) * (b.phase === 2 ? 1 - b.dp : 1) * exp(-((x + 0.5 - b.x0) ** 2) / 22);
    ice[x] = e;
    thick[x] = sm(4, 9, e);
  }
  const ic = pal.ice, th = pal.thin, gl = pal.glow;
  for (let x = 0; x < W; x++) {
    const e = ice[x], k = thick[x], ymax = min(H - 1, ceil(e + 10));
    for (let y = 0; y <= ymax; y++) {
      const yy = y + 0.5, p = y * W + x, cov = cl((e - yy) / 1.2 + 0.5, 0, 1);
      if (cov > 0) {
        const q = cl(yy / max(e, 1), 0, 1), tex = 1 + 0.07 * sin(x * 0.55 + yy * 0.13 + e * 0.5) + 0.12 * sin(x * 0.21 - t * 0.043 + S.ph[7]);
        const br = (1.18 - 0.48 * pow(q, 1.5)) * (0.72 + 0.28 * k) * tex;
        const m = k * 0.7 + 0.3 * (1 - q);
        R[p] = mix(R[p], mix(th[0], ic[0], m) * br, cov);
        G[p] = mix(G[p], mix(th[1], ic[1], m) * br, cov);
        B[p] = mix(B[p], mix(th[2], ic[2], m) * br, cov);
      }
      if (yy > e) {
        const g = 0.2 * (0.4 + 0.6 * k) * exp(-(yy - e) / 4.5);
        R[p] += gl[0] * g;
        G[p] += gl[1] * g;
        B[p] += gl[2] * g;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  water(S);
  for (const b of S.bs) frost(S, b);
  dye(S);
  for (const b of S.bs) {
    tube(S, b);
    web(S, b);
  }
  webOut(S);
  roof(S);
  const { R, G, B } = S;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const r = TONE[(cl(R[p], 0, 3.99) * 256) | 0], g = TONE[(cl(G[p], 0, 3.99) * 256) | 0], bl = TONE[(cl(B[p], 0, 3.99) * 256) | 0];
      display.setPixel(x, y, r * 255, g * 255, bl * 255);
    }
}
