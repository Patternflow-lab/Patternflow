// ===== Patternflow pattern =====
// Title:   Cream Swirl
// Family:  cosmetic
// Idea:    An unseen palette knife sweeps slow S-curves and spirals through a thick satin cream, leaving a smooth band, pushing a glossy ridge along its edge and drawing dollops of tinted cream out into ribbons, while a soft light glides to and fro so the sheen slides over the folds.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 29, after the swatch of face cream spread with a spatula in a macro product film
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tones=1..3, Gloss=0..1
//
// Knob 1: Hue. Turns the cream and its tints round the whole colour wheel together, opening on rose.
// Knob 2: Speed. How fast and how hard the knife works: at 2 it travels 20 LEDs a second, an S-sweep down the panel takes about eight seconds and the light swings across and back in seven; slow, the knife glides and leaves smooth bands, fast, it chatters and throws taller ridges.
// Knob 3: Tones. How many tints are folded into the pale cream, from one pastel at 1 to three at 3, a pale, a mid and a deep one; the ribbons split into their bands at once, and with more tints more dollops fall in each stroke's path.
// Knob 4: Gloss. At 0 the cream has a soft satin sheen spread over its slopes; at 1 it is wet, a little deeper in colour, and each ridge carries a thin white highlight.
// Buttons: K1 tap drops a fresh dollop of the deepest tint in the knife's path, and the knife sweeps it into a ribbon.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, abs, pow, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The knife's edge is cut into NB bins. Each bin carries the cream it has
// scraped up and that cream's tint, so a dollop picked up at one end of the
// blade is laid down as a ribbon behind that end, not across the whole band.
const NB = 16;
// Path points are half an LED apart.
const STEP = 0.5, PMAX = 1200;
// How fast a bin's tint turns to the cream it scrapes, per unit of height
// scraped; how much of the band's skin is the cream the blade carries; what
// share of each bin's load slides on to the next bin along the angled blade
// for each LED travelled.
const PICK = 0.3, FILM = 0.45, SLIP = 1.05;
// The share of the dragged skin left behind for each LED travelled.
const DRAG = 0.03;
// The ridge the spill builds stands at RS height per LED on its flanks, and
// is never taller than RMAX.
const RS = 0.4, RMAX = 3.6;
// How deep the roll of cream in front of the blade is, in LEDs.
const ROLL = 6;
// How deep the visible skin is: scraping this much off shows the bed.
const SKIN = 0.8;
// The opening hue: rose, not red.
const H0 = 0.93;

// A soft light low over the top left, its height LZ and where it sits round
// the panel, LA radians; it glides LS either way of that and back over SWING
// seconds at Speed 2, so the sheen slides along the ridges between strokes.
const LZ = 0.5, LA = -2.34, LS = 0.9, SWING = 7;
// How tall the height field looks: a slope of 1 tilts the surface 56 degrees.
const KZ = 1.8;
// The light is a big soft box: it wraps a little way round the cream, so a
// slope turned from it shades off gently instead of dropping into shadow.
const WRAP = 0.3;
// How much a fold darkens and a crest brightens, per unit of height.
const CAV = 0.5;
// Cream the knife has just laid down holds a wet film that lifts it by this
// much, fading as it dulls.
const GLINT = 26;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[o] = r * 255;
  out[o + 1] = g * 255;
  out[o + 2] = b * 255;
}

// The tint concentrations a dollop can come in, for one, two and three tints.
const DOSE = [[0.55], [0.4, 0.88], [0.3, 0.62, 1]];
// Where the colour ramp steps between tints, so folded cream shows distinct
// bands rather than one blurred pink: thresholds and the level each band shows.
const STEPS = [
  [[0.22], [0, 0.55]],
  [[0.18, 0.6], [0, 0.42, 0.88]],
  [[0.14, 0.44, 0.78], [0, 0.3, 0.62, 1]],
];
function band(c, n) {
  const [th, lv] = STEPS[n];
  let v = lv[0];
  for (let i = 0; i < th.length; i++) v += (lv[i + 1] - lv[i]) * sm((c - th[i]) / 0.1 + 0.5);
  return v;
}

export function setup(params) {
  params.s = {
    // Height, the tint of the skin, the tint of the bed under it.
    hf: new Float32Array(N), tn: new Float32Array(N), ut: new Float32Array(N),
    dh: new Float32Array(N), dt: new Float32Array(N), bl: new Float32Array(N), av: new Float32Array(N),
    stamp: new Int32Array(N).fill(-999), sub: 0, fr: new Float32Array(N),
    path: new Float32Array(PMAX * 2), plen: 0, pos: 0, type: 0, done: 0,
    m: new Float32Array(NB), c: new Float32Array(NB), ft: new Float32Array(NB), fm: new Float32Array(NB), bm: 0, bc: 0,
    L: 24, ca: 1, sa: 0, B: 0, tilt: 0, gPh: 0, cc: 0, cA: 0, cP: 8, cB: 0, slip: 1, rh: 0,
    sp: new Float32Array(8), pause: 0, live: false, force: 1, lt: 0,
    dol: [], hue: 0, tones: 1, gloss: 0.06, ready: false,
    lut: new Float32Array(64 * 3), lus: new Float32Array(64 * 3),
    kx: 0, ky: 0, dx: 0, dy: 1, tx: 1, ty: 0,
  };
}

function blur(a, b) {
  for (let y = 0; y < H; y++)
    for (let x = 0, p = y * W; x < W; x++, p++) b[p] = (a[x > 0 ? p - 1 : p] + 2 * a[p] + a[x < W - 1 ? p + 1 : p]) * 0.25;
  for (let y = 0; y < H; y++)
    for (let x = 0, p = y * W; x < W; x++, p++) a[p] = (b[y > 0 ? p - W : p] + 2 * b[p] + b[y < H - 1 ? p + W : p]) * 0.25;
}

// A round dollop: a soft mound of tint c with a peak where it left the spoon. It is all skin, so a knife that
// scrapes it away finds the cream it was dropped on.
// Its colour goes on with the first of it, as deep as the whole dollop will
// be thick: its thin rim only half covers what it landed on, so a knife that
// scrapes it off leaves no ring.
function dollop(P, x0, y0, r, ht, c, f, first) {
  const x1 = max(0, floor(x0 - r)), x2 = min(W - 1, floor(x0 + r) + 1);
  const y1 = max(0, floor(y0 - r)), y2 = min(H - 1, floor(y0 + r) + 1);
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++) {
      const d = ((x - x0) ** 2 + (y - y0) ** 2) / (r * r);
      if (d >= 1) continue;
      const p = y * W + x, a = ht * (1 - sqrt(d)) * (1 - d * 0.5);
      P.hf[p] += a * f;
      if (first) P.tn[p] += (c - P.tn[p]) * min(1, a / 1.2);
    }
}

// The stroke's path as a function of u from 0 to 1, from the parameters
// startStroke puts in P.sp.
function pathAt(P, u, o) {
  const s = P.sp;
  if (P.type === 0) {
    // An S down (or up) the panel.
    o[0] = s[0] + s[1] * sin(2 * PI * s[2] * u + s[3]);
    o[1] = s[4] + (s[5] - s[4]) * u;
  } else if (P.type === 1) {
    // A spiral in to a point: the swirl on top of a jar.
    const a = s[3] + s[4] * u * 2 * PI, r = s[5] + (s[6] - s[5]) * (1 - (1 - u) * (1 - u));
    o[0] = s[0] + r * cos(a);
    o[1] = s[1] + r * sin(a) * 1.15;
  } else {
    // A bowed smear from off one side to the middle, or right across.
    const v = 1 - u, mx = (s[0] + s[2]) / 2 + s[4], my = (s[1] + s[3]) / 2 + s[5];
    o[0] = v * v * s[0] + 2 * v * u * mx + u * u * s[2];
    o[1] = v * v * s[1] + 2 * v * u * my + u * u * s[3];
  }
}

const TMP = [0, 0];
function startStroke(P, k3) {
  const s = P.sp, r = rnd(), hf = P.hf;
  // Heights only matter against each other: keep the cream's mean level at
  // 0, and cut every band below it, so each stroke has cream to push.
  let mean = 0;
  for (let p = 0; p < N; p++) mean += hf[p];
  mean /= N;
  for (let p = 0; p < N; p++) hf[p] -= mean;
  P.type = r < 0.5 ? 0 : r < 0.8 ? 1 : 2;
  if (P.type === 0) {
    const down = rnd() < 0.5;
    s[0] = 22 + rnd() * 20;
    s[1] = 10 + rnd() * 10;
    s[2] = 0.6 + rnd() * 0.5;
    s[3] = rnd() * 2 * PI;
    s[4] = down ? -14 : H + 14;
    s[5] = down ? H + 14 : -14;
    P.L = 34 + rnd() * 10;
    P.B = -0.9 + rnd() * 0.5;
  } else if (P.type === 1) {
    s[0] = 26 + rnd() * 12;
    s[1] = 36 + rnd() * 56;
    s[3] = rnd() * 2 * PI;
    s[4] = (rnd() < 0.5 ? -1 : 1) * (1.3 + rnd() * 0.5);
    s[5] = 25 + rnd() * 6;
    s[6] = 3;
    P.L = 18 + rnd() * 5;
    P.B = -0.6 + rnd() * 0.4;
  } else {
    const across = rnd() < 0.4, side = rnd() < 0.5 ? -1 : 1;
    if (across) {
      s[0] = side < 0 ? -14 : W + 14;
      s[2] = side < 0 ? W + 14 : -14;
      s[1] = 14 + rnd() * 100;
      s[3] = cl(s[1] + (rnd() - 0.5) * 40, 10, H - 10);
    } else {
      s[0] = 32 + side * (34 + rnd() * 6);
      s[1] = 10 + rnd() * 108;
      s[2] = 32 - side * (rnd() * 10);
      s[3] = cl(s[1] + (rnd() - 0.5) * 70, 18, H - 18);
    }
    s[4] = 0;
    s[5] = (rnd() - 0.5) * 36;
    P.L = 28 + rnd() * 8;
    P.B = -0.8 + rnd() * 0.5;
  }
  // Lay the path down half an LED a point.
  const path = P.path;
  pathAt(P, 0, TMP);
  let px = TMP[0], py = TMP[1], n = 1;
  path[0] = px;
  path[1] = py;
  for (let i = 1; i <= 4000 && n < PMAX; i++) {
    pathAt(P, i / 4000, TMP);
    const d = sqrt((TMP[0] - px) ** 2 + (TMP[1] - py) ** 2);
    if (d >= STEP) {
      px += ((TMP[0] - px) * STEP) / d;
      py += ((TMP[1] - py) * STEP) / d;
      path[n * 2] = px;
      path[n * 2 + 1] = py;
      n++;
    }
  }
  P.plen = (n - 1) * STEP;
  P.pos = 0;
  // The blade sits at an angle to its track, tilted a little and bowed, so
  // the band is a shallow trough, and it chatters as it goes, leaving soft
  // folds across the band. A slow knife glides and cuts shallow; a fast one
  // chatters harder and digs deeper, so it throws a taller ridge.
  const al = (rnd() - 0.5) * 0.6;
  P.ca = cos(al);
  P.sa = sin(al);
  P.tilt = (rnd() - 0.5) * 0.6;
  P.cc = 0.2 + rnd() * 0.4;
  P.cA = (0.13 + rnd() * 0.1) * (0.35 + 0.65 * P.force);
  P.B -= 0.35 * (P.force - 1);
  P.cP = 11 + rnd() * 5;
  P.cB = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 4);
  P.gPh = rnd() * 2 * PI;
  P.slip = rnd() < 0.5 ? -1 : 1;
  if (P.type === 1) {
    // A swirl throws its cream outwards.
    locate(P, 6);
    P.slip = P.tx * (P.kx - s[0]) + P.ty * (P.ky - s[1]) > 0 ? 1 : -1;
  }
  P.m.fill(0);
  P.c.fill(0);
  P.ft.fill(0);
  P.fm.fill(0);
  P.rh = 0;
  P.live = true;
  // Every stroke goes through fresh dollops dropped a little way along: one
  // for one tint, two or three when three tints are folded in.
  const nd = k3 === 1 ? 1 : k3 === 2 ? (rnd() < 0.5 ? 2 : 1) : rnd() < 0.4 ? 3 : 2;
  for (let i = 0; i < nd; i++) plan(P, 0.1 + rnd() * 0.45, rnd() < 0.4 ? 0 : DOSE[k3 - 1][floor(rnd() * k3)], (10 + rnd() * 3) / sqrt(nd));
}

// A dollop waiting to fall at a point on the path ahead of the knife.
function plan(P, u, c, r) {
  if (P.dol.length > 3) return;
  const i = floor((P.pos + (P.plen - P.pos) * u) / STEP);
  const x = P.path[i * 2], y = P.path[i * 2 + 1];
  P.dol.push({ x: cl(x + (rnd() - 0.5) * 6, 6, W - 7), y: cl(y + (rnd() - 0.5) * 6, 8, H - 9), r, h: 2.6 + rnd() * 0.6, c, f: 0 });
}

// The knife's point, its direction of travel and the blade's direction.
function locate(P, pos) {
  const path = P.path, last = floor(P.plen / STEP);
  const i = cl(floor(pos / STEP), 0, last - 1), f = cl(pos / STEP - i, 0, 1);
  P.kx = path[i * 2] + (path[i * 2 + 2] - path[i * 2]) * f;
  P.ky = path[i * 2 + 1] + (path[i * 2 + 3] - path[i * 2 + 1]) * f;
  const a = max(0, i - 3), b = min(last, i + 4);
  let dx = path[b * 2] - path[a * 2], dy = path[b * 2 + 1] - path[a * 2 + 1];
  const d = sqrt(dx * dx + dy * dy) || 1;
  dx /= d;
  dy /= d;
  P.dx = dx;
  P.dy = dy;
  P.tx = -dy * P.ca - dx * P.sa;
  P.ty = dx * P.ca - dy * P.sa;
}

// The load of the blade at a point a along it and the tint it drags there,
// read between the bins so what it lays down has no seams.
function load(P, a) {
  const fb = cl(((a + P.L / 2) / P.L) * NB - 0.5, 0, NB - 1), j = min(NB - 2, floor(fb)), f = fb - j;
  P.bm = P.m[j] + (P.m[j + 1] - P.m[j]) * f;
  P.bc = P.ft[j] + (P.ft[j + 1] - P.ft[j]) * f;
}

// The ridge across its width r (0 at the band's edge, 1 at its foot): a
// steep inner face where the blade cut it, a long outer slope.
const ridge = (r) => (r < 0.3 ? sm(r / 0.3) : 1 - sm((r - 0.3) / 0.7));

// One move of the knife by ds LEDs. Each LED is worked once a pass, as the
// back of the blade leaves it: what stood above the blade goes into the
// bin over it, and the band, the ridge beside it and their tints are laid
// down.
function knife(P, ds) {
  P.pos += ds;
  P.sub++;
  if (P.pos >= P.plen) return lift(P);
  locate(P, P.pos);
  const { hf, tn, ut, m, c, ft, fm, stamp, L } = P, hl = L / 2, sl = P.slip;
  for (let j = 0; j < NB; j++) fm[j] *= 1 - DRAG * ds;
  const kx = P.kx, ky = P.ky, dx = P.dx, dy = P.dy, tx = P.tx, ty = P.ty, det = tx * dy - ty * dx;
  // Pressure comes on over the first 8 LEDs and goes off over the last 6.
  const pr = sm(P.pos / 8) * sm((P.plen - P.pos) / 6);
  const rw = max(3, (2 * P.rh) / RS), end = sl > 0 ? NB - 1 : 0, lvEnd = P.B + P.tilt * sl + P.cc;
  const rx = abs(tx) * (hl + rw) + 3, ry = abs(ty) * (hl + rw) + 3;
  const x1 = max(0, floor(kx - rx)), x2 = min(W - 1, floor(kx + rx) + 1);
  const y1 = max(0, floor(ky - ry)), y2 = min(H - 1, floor(ky + ry) + 1);
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++) {
      const ox = x - kx, oy = y - ky, s = (tx * oy - ty * ox) / det;
      // On a curve the LEDs on the outside move further than ds, so the
      // strip is wider than a step and the stamp keeps it to once a pass.
      if (s < -3 - ds || s >= -0.3) continue;
      const a = (ox * dy - oy * dx) / det, as = a * sl, p = y * W + x;
      if (as <= -hl - 1.5 || as >= hl + rw || P.sub - stamp[p] < 40) continue;
      stamp[p] = P.sub;
      const ho = hf[p], to = tn[p];
      if (as < hl && as > -hl) {
        // The chatter marks bow back towards the blade's ends, as a flexible
        // blade leaves them, and come and go along it.
        const u = a / hl, w = (2 * PI * (P.pos + P.cB * u * u)) / P.cP;
        const lv = P.B + P.tilt * u + P.cc * u * u + P.cA * (0.65 + 0.35 * sin(a * 0.31 + P.gPh)) * (sin(w) + 0.5 * sin(w * 1.63 + 1.3)), e = ho - lv;
        const j = cl(floor(((a + hl) / L) * NB), 0, NB - 1);
        if (e > 0) {
          m[j] += e * pr;
          c[j] += (to - c[j]) * min(1, e * PICK * pr);
          // The skin of tint the blade drags stays in its own lane and is
          // mixed by how much of each colour it gathered, so a dollop
          // becomes a long ribbon that pales as white cream dilutes it.
          fm[j] += e * pr;
          ft[j] += ((to - ft[j]) * e * pr) / fm[j];
        }
        // Under what was scraped off lies the bed; over it the blade leaves a
        // film of the cream it carries.
        const ex = e > 0 ? to + (ut[p] - to) * min(1, e / SKIN) : to;
        load(P, a);
        const tw = ex + (P.bc - ex) * FILM * min(1, P.bm);
        hf[p] = ho + (lv - ho) * pr;
        P.fr[p] = max(P.fr[p], pr);
        tn[p] = to + (tw - to) * pr;
        ut[p] += (tw - ut[p]) * pr * 0.4;
      } else {
        // Beside the band: the ridge on the spill side, a thin lip of
        // squeezed cream on the other.
        const hr = as > 0 ? lvEnd + P.rh * ridge((as - hl) / rw) : P.B - P.tilt * sl + 0.2 * P.rh * ridge((-as - hl) / 1.5);
        if (hr <= ho) continue;
        const k = pr * min(1, (hr - ho) / SKIN), ce = as > 0 ? c[end] : to;
        hf[p] = ho + (hr - ho) * pr;
        P.fr[p] = max(P.fr[p], pr);
        tn[p] = to + (ce - to) * k;
        ut[p] += (ce - ut[p]) * k;
      }
    }
  // The load slides along the angled blade and spills off its end, and the
  // ridge stands as tall as the cream spilling into it.
  const f = min(0.9, SLIP * ds);
  for (let k = 1; k < NB; k++) {
    const j = sl > 0 ? NB - 1 - k : k, to = j + sl, a = m[j] * f;
    if (a <= 0) continue;
    c[to] = (c[to] * m[to] + c[j] * a) / (m[to] + a);
    m[to] += a;
    m[j] -= a;
  }
  const spill = m[end] * f;
  m[end] -= spill;
  const target = min(RMAX, sqrt(0.75 * (spill / ds) * RS));
  P.rh += (target - P.rh) * min(1, ds * 0.25);
}

// The knife lifts: what it still carries stays where it stopped, a raised
// lip across the end of the band.
function lift(P) {
  locate(P, P.plen);
  roll(P, P.hf, P.tn, P.ut);
  P.live = false;
  P.done++;
  P.pause = 0.15 + rnd() * 0.2;
}

// The cream on the blade's face as a rounded roll in front of it, laid into
// (h, t): for the picture while the knife moves, for good when it lifts.
function roll(P, h, t, u) {
  const hl = P.L / 2, kx = P.kx, ky = P.ky, dx = P.dx, dy = P.dy, tx = P.tx, ty = P.ty, det = tx * dy - ty * dx;
  const rx = abs(tx) * hl + ROLL + 2, ry = abs(ty) * hl + ROLL + 2;
  const x1 = max(0, floor(kx - rx)), x2 = min(W - 1, floor(kx + rx) + 1);
  const y1 = max(0, floor(ky - ry)), y2 = min(H - 1, floor(ky + ry) + 1);
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++) {
      const ox = x - kx, oy = y - ky, a = (ox * dy - oy * dx) / det, s = (tx * oy - ty * ox) / det;
      if (s <= -0.3 || s >= ROLL || a <= -hl || a >= hl) continue;
      load(P, a);
      // A bin's load spread as a mound ROLL deep, rounded off at the blade's
      // ends: as tall as that much cream stands, and never a wall.
      const ht = min(2.4, sqrt((P.bm * NB) / P.L) * 0.7) * sin((PI * (s + 0.3)) / (ROLL + 0.3)) * sqrt(sin((PI * (a + hl)) / P.L));
      const p = y * W + x;
      if (P.B + ht <= h[p]) continue;
      const k = min(1, (P.B + ht - h[p]) / SKIN);
      h[p] = P.B + ht;
      t[p] += (P.bc - t[p]) * k;
      if (u) u[p] += (P.bc - u[p]) * k;
    }
}

// One frame of the studio: the pause between strokes, dollops falling, the knife.
function tick(P, dt, speed, k3) {
  for (const d of P.dol) {
    if (d.f >= 1) continue;
    const g = min(1 - d.f, dt * 2.5 * max(0.6, speed / 2));
    dollop(P, d.x, d.y, d.r, d.h, d.c, g, d.f === 0);
    d.f += g;
  }
  // Freshly worked cream glistens; left alone it dulls to a satin over
  // about ten seconds at Speed 2.
  P.lt += dt * speed * 0.5;
  const fr = P.fr, k = 1 - dt * 0.07 * max(0.5, speed);
  for (let p = 0; p < N; p++) fr[p] *= k;
  if (!P.live) {
    P.pause -= dt * max(0.5, speed / 2);
    if (P.pause <= 0) startStroke(P, k3);
  } else {
    let ds = dt * speed * 10;
    while (ds > 1e-6) {
      const st = min(ds, 0.5);
      knife(P, st);
      ds -= st;
      if (!P.live) break;
    }
  }
  // A dollop is forgotten once it has fallen and the knife has gone on.
  if (P.dol.length && P.dol[0].f >= 1 && (!P.live || P.dol.length > 2)) P.dol.shift();
}

// The first frame already shows cream that has been worked: a level layer
// and three strokes through dollops of tint.
function prime(P, k3) {
  const { hf } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) hf[y * W + x] = 0.3 * sin(x * 0.11 + y * 0.05) * sin(y * 0.07 - x * 0.04);
  P.pause = 0;
  while (P.done < 3) tick(P, 1 / 30, 2, k3);
  while (!P.live) tick(P, 1 / 30, 2, k3);
  // Start the live stroke a fifth of the way along, its dollops down.
  for (const d of P.dol) if (d.f < 1) (dollop(P, d.x, d.y, d.r, d.h, d.c, 1 - d.f, d.f === 0), (d.f = 1));
  while (P.live && P.pos < P.plen * 0.2) tick(P, 1 / 30, 2, k3);
  P.ready = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.tones = cl(k[2], 1, 3);
  P.gloss = cl(k[3], 0, 1);
  const k3 = cl(Math.round(P.tones), 1, 3);
  P.force = cl(k[1], 0.2, 3) / 2;
  if (!P.ready) prime(P, k3);
  if (input.btnPressed && input.btnPressed[0]) {
    // A fresh dollop in the deepest tint, where the knife will reach it.
    if (P.live && P.plen - P.pos > 40) plan(P, 0.25 + rnd() * 0.2, DOSE[k3 - 1][k3 - 1], 9);
    else P.dol.push({ x: 14 + rnd() * 36, y: 20 + rnd() * 88, r: 12, h: 3.2, c: DOSE[k3 - 1][k3 - 1], f: 0 });
  }
  tick(P, d, cl(k[1], 0.2, 3), k3);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.ready) return;
  const { dh, dt, lut, lus } = P;
  dh.set(P.hf);
  dt.set(P.tn);
  // The cream riding on the blade's face shows where the unseen knife is.
  if (P.live) roll(P, dh, dt, null);
  // The light reads the surface and its colour through a small blur, so the
  // LED steps of the height field do not show as grain.
  blur(dh, P.bl);
  // A wide blur of the surface: cream that stands above it is a crest and
  // catches more light, cream below it lies in a fold and gets less.
  const av = P.av;
  av.set(dh);
  for (let i = 0; i < 4; i++) blur(av, P.bl);
  blur(dt, P.bl);
  // The colour of each tint concentration: white cream at 0, the deepest
  // tint at 1, stepped into the bands Tones asks for. Light goes a little
  // way into cream, so its shadows are a deeper tint rather than grey.
  // Wet cream (Gloss up) is a little deeper in colour, as anything wet is.
  // The deeper tints also darken, so three of them stay apart, except round
  // orange and yellow, where darker reads as brown and olive on LEDs.
  const t = P.tones, n0 = floor(t) - 1, ft = t - floor(t), n1 = min(2, n0 + 1), hue = H0 + P.hue, g = P.gloss;
  const hw = (hue - floor(hue) + 0.38) % 1, dk = 0.3 * min(1, abs(hw - 0.5) / 0.11);
  for (let i = 0; i < 64; i++) {
    const c = i / 63, v = band(c, n0) + (band(c, n1) - band(c, n0)) * ft;
    hsv(hue, 0.22 + 0.72 * v + 0.06 * g, (1 - 0.06 * v - dk * v * v) * (1 - 0.1 * g), lut, i * 3);
    hsv(hue, min(1, 0.4 + 0.6 * v + 0.1 * g), 0.58 - 0.08 * v - 0.14 * g, lus, i * 3);
  }
  // The sheen is measured from what a level surface would show, so level
  // cream stays its colour and only the slopes turned to the light shine.
  const la = LA + LS * sin((2 * PI * P.lt) / SWING), lr = sqrt(1 - LZ * LZ), LX = lr * cos(la), LY = lr * sin(la);
  const HL = sqrt(LX * LX + LY * LY + (LZ + 1) * (LZ + 1)), HX = LX / HL, HY = LY / HL, HZ = (LZ + 1) / HL;
  // A broad satin sheen is always there; Gloss adds a narrow wet one on top.
  const shin = 10 + 70 * g * g, ks = 0.95 * g * 255, s0 = pow(HZ, shin), sk = ks / (1 - s0), fr = P.fr;
  const b0 = pow(HZ, 6), bk = (0.4 * 255) / (1 - b0);
  for (let y = 0; y < H; y++) {
    const yu = y > 0 ? -W : 0, yd = y < H - 1 ? W : 0;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const gx = (dh[x < W - 1 ? p + 1 : p] - dh[x > 0 ? p - 1 : p]) * 0.5 * KZ;
      const gy = (dh[p + yd] - dh[p + yu]) * 0.5 * KZ;
      const il = 1 / sqrt(gx * gx + gy * gy + 1), nx = -gx * il, ny = -gy * il, nz = il;
      const df = nx * LX + ny * LY + nz * LZ, nh = nx * HX + ny * HY + nz * HZ;
      const f = (df > -WRAP ? (0.85 * (df + WRAP)) / (LZ + WRAP) : 0) * (1 + cl((dh[p] - av[p]) * CAV, -0.45, 0.25)), n2 = nh * nh, sp = (nh > HZ ? ((g > 0.01 ? (pow(nh, shin) - s0) * sk : 0) + (n2 * n2 * n2 - b0) * bk) * (0.5 + 0.5 * fr[p]) : 0) + fr[p] * GLINT;
      const o = cl(floor(dt[p] * 63 + 0.5), 0, 63) * 3, r = lus[o], gg = lus[o + 1], b = lus[o + 2];
      display.setPixel(x, y, min(255, r + (lut[o] - r) * f + sp), min(255, gg + (lut[o + 1] - gg) * f + sp * 0.97), min(255, b + (lut[o + 2] - b) * f + sp * 0.92));
    }
  }
}
