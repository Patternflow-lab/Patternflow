// ===== Patternflow pattern =====
// Title:   Fallstreak Hole
// Family:  fallstreak
// Idea:    A dusk deck of coral and ivory cloudlets, lit from below, is punched through by round holes and long canals of clear violet-blue sky that spread outward and eat the cloud cell by cell with a ragged rim, while soft white-pink fall streaks of ice hang and bend inside them, until each hole heals from its rim and its middle and others open elsewhere.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: fallstreak holes, also called hole-punch clouds, in decks of altocumulus whose droplets are supercooled water (Alfred Wegener, 1911; Tor Bergeron, 1935; Walter Findeisen, 1938, all from memory): ice crystals grow at the cost of the droplets round them because the vapour pressure over ice is lower than over water, fall out as fibrous streaks and seed the cloud next to them, so a hole spreads. Aircraft that climb or descend through such a deck make the ice that starts it, and a straight flight track leaves a canal (Andrew Heymsfield and co-workers, 2010 and 2011, from memory). Original code, pattern round 261: a drifting Worley deck, each hole an analytic front with a per-cell delay and a front that slows toward its limit, and the fall streaks drawn as sheared, curved strokes.
// Round:   261
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spread=0..4, Holes=-1..1, Shear=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel without changing how bright anything is. At 0 it is the dusk: cloud from ivory (255, 240, 212) through peach and coral to a mauve underside, sky from deep blue (14, 26, 104) through violet to a pale lilac and pink on the lower side, fall streaks white-pink. The first part of the knob is the working range, a quarter turn takes the cloud to rose and the sky to teal, and the rest of the wheel is for looking at.
// Knob 2: Spread. How fast the ice spreads and how big the holes get, 0 to 4, opening at 2. The front runs at 0.5 LED a second at 0, 0.95 at 2 and 1.4 at 4 across the wind, and the along-wind speed is that times the stretch. A hole stops at 6.3 LEDs from its seed across the wind at 0, 9.9 at 2 and 13.5 at 4, and everything else in the hole, the heal, the streaks, runs at the same clock, so at 4 a hole is born, spreads and mends in about half the time it takes at 0.
// Knob 3: Holes. How many holes are open at once, from one lone hole at -1 through three at the opening 0 to five or six at 1, where the deck is pocked all over and canals cross each other's range. The count follows within a few seconds: a new hole opens in the farthest gap as soon as there are too few, and when the knob is turned down the old ones are left to heal.
// Knob 4: Shear. How strongly the wind shears the layer, -1 to 1, opening at 0.06. Holes are stretched along the wind by 1.0 times at -1 (round), 2.2 at the opening and 3.2 at 1, a hole stops at the same area whichever, and more of the new ones are canals (one in five at -1, half at 1) along a straight track. The fall streaks lean 0.1 LED sideways for each LED they fall at -1 and 0.5 at 1, and bend more as they go down, so at the top of the panel they hang straight and at the bottom they run 35 degrees off at 1.

// What the picture is. The panel is the sky seen from the ground at dusk, a deck of altocumulus lit from below by a sun that has set below the lower edge, so the underside of the cloud is ivory
// and peach near the bottom of the panel, coral and rose higher up, and cool mauve in the lanes between the cloudlets. The deck is a Worley (cellular) texture of cells about 7 LEDs across. Each cell
// sits on a lattice point that is moved by two slow sines of its own (periods of 60 to 150 s and 37 to 107 s), so the deck never comes back to a picture it has shown, a weight swells and shrinks
// the cell, and the pixel is moved by a warp field of 3 LEDs on a 4-LED grid first, so the rims are not straight. The whole deck drifts at 0.2 LED a second along the wind, which itself swings a little.
// The nearest and second nearest point give a distance to the lane between cells; a cell is thick in its middle and thin in the lane, and it is shaded like a dome that a light from below
// and left falls on. Where the cloud is thin the sky shows through, so the lanes go cool and dark without a colour of their own.
// A hole is a list entry, not a field: where it is centred (a point, or a straight track, the canal), when it began, which way the wind blows through it, how far it will spread, and when it
// heals. Everything is worked out per pixel from that, and nothing is stepped. The distance from the seed is taken in a metric that is stretched along the wind by the shear, so a front that is a circle
// becomes an ellipse, and the distance to a track is the distance to the segment in the same metric, which makes a canal a stadium with round ends. The front is at r(age) = r0 + (R - r0)(1 - exp(-v age / (R - r0))),
// quick at first and slowing as the ice has used up the droplets within reach. A pixel is glaciated when the front has got to its distance, plus a delay: most of the distance is that of the middle of its own
// cell, with a random 0 to 4.5 LEDs of delay for each cell and a slow low-frequency wobble of 2.6 LEDs, so a cell goes as a whole, its lane first, then its body shrinking to a bright core before it
// is gone, and the rim of the hole is a scalloped edge and not a circle. The edge is 4 LEDs wide. A cell's cloud is its thickness less the glaciation, so thin cloud goes first.
// A hole heals after 60 to 105 s of its own clock: from its rim inward at 0.75 to 1.1 LEDs a second, and from its middle outward at 0.45 of that after 4 to 10 s, so the cloud comes back as thin
// cores that grow out to the cell's lane. The clear sky is a fixed gradient on the panel, deep blue at the top to violet in the middle and a paler band on the lower left. The edge of the cloud against
// it glows peach where the cloud is thin, as a cloud edge does with the light behind it.
// The fall streaks are drawn in a coordinate that is sheared and bent with the wind: u = x - lean (y - 64) - bend (y - 64)^2 / 128, so a streak is a curve that hangs straight near the top and
// leans more as it falls. The columns of u, 3.6 LEDs apart, each carry a streak with its own period of 24 to 50 LEDs, phase, brightness and width of 1.1 to 1.7 LEDs, that falls at 1 to 2.3 LEDs a
// second: it starts as a tuft, brightens over its first eighth and fades along its length like a cirrus uncinus, a comma with a long tail. A coarse map of the ice, two LEDs a cell, adds up the holes
// where they are glaciated and fresh, and is smeared down the streaks' own curves for 18 LEDs, so the streaks fill the hole and trail below its rim before they go out. Over cloud they are weaker.
// The first update does not step anything: it opens the sky with holes of different ages already in it, chosen by the knobs, the youngest a few seconds old and the oldest about to heal.

const W = 64, H = 128, NPX = W * H;
const EXPN = 1024, EXPK = EXPN / 7; // exp(-q) for q in 0..7, as a table
const EXPT = new Float32Array(EXPN + 1);
for (let i = 0; i <= EXPN; i++) EXPT[i] = Math.exp(-i / EXPK);
const { floor, sqrt, exp, sin, cos, min, max, abs, PI } = Math;
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

// ---- the deck
const G = 7.8; // LEDs between lattice points of the cloudlets, in the deck's own stretched units
const NI = 22, NJ = 27; // lattice points kept per frame
const WG = 2, NWX = W / WG + 1, NWY = H / WG + 1; // warp grid
const SIG = 0.5 * G, ISIG2 = 1 / (SIG * SIG); // width of a cloudlet's bump, LEDs
const LX = -0.34, LY = 0.94; // the light on the cloud comes from below and a little left
const RIM = 7.0, RIMH = 6.0; // LEDs over which the front and the heal front are soft
const GGW = W / 2, GGH = H / 2; // ice map, two LEDs a cell

// cloud colours by how lit the cell is, 0 dark underside to 1 ivory
const RAMP_T = [0, 0.18, 0.4, 0.62, 0.82, 1];
const RAMP_C = [
  [54, 46, 108], [120, 80, 136], [204, 118, 126], [244, 164, 140], [255, 208, 176], [255, 240, 222],
];
// sky colours by position, 0 at the top and the upper right to 1 at the lower left
const SKY_T = [0, 0.35, 0.62, 0.82, 1];
const SKY_C = [[32, 44, 116], [50, 60, 146], [90, 76, 166], [134, 120, 196], [174, 158, 218]];
const FIB = [255, 226, 238];
const GLOW = [255, 208, 170];

function ramp(T, C, v, out) {
  let k = 0;
  while (k < T.length - 2 && v > T[k + 1]) k++;
  const t = cl((v - T[k]) / (T[k + 1] - T[k]), 0, 1), s = t * t * (3 - 2 * t);
  for (let c = 0; c < 3; c++) out[c] = mix(C[k][c], C[k + 1][c], s);
}

function makeState() {
  const S = {
    t: 0, ox: 0, oy: 0, ready: false, wind: -0.3, wcl: 0, cool: 3,
    PX: new Float32Array(NI * NJ), PY: new Float32Array(NI * NJ), PW: new Float32Array(NI * NJ),
    PD: new Float32Array(NI * NJ), PB: new Float32Array(NI * NJ),
    WX: new Float32Array(NWX * NWY), WY: new Float32Array(NWX * NWY), BT: new Float32Array(NWX * NWY),
    ice: new Float32Array(GGW * GGH), gate: new Float32Array(GGW * GGH),
    ramp: new Float32Array(3 * 256), sky: new Float32Array(NPX * 3),
    NC: 220, CP: new Float32Array(220), CW: new Float32Array(220), CPH: new Float32Array(220),
    CPR: new Float32Array(220), CB: new Float32Array(220), CV: new Float32Array(220),
    holes: [], i0: 0, j0: 0, k: [0, 2, 0, 0.06],
    u2: 0.5, u3: 0.5, u4: 0.53, sf: 1, sz: 1, E: 2.2, lean: 0.3, bend: 0.3, hue: 0,
    mat: new Float32Array(9),
  };
  const tmp = [0, 0, 0];
  for (let i = 0; i < 256; i++) {
    ramp(RAMP_T, RAMP_C, i / 255, tmp);
    S.ramp[i * 3] = tmp[0]; S.ramp[i * 3 + 1] = tmp[1]; S.ramp[i * 3 + 2] = tmp[2];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = cl(0.78 * (y / 127) + 0.22 * (1 - x / 63), 0, 1);
      ramp(SKY_T, SKY_C, q, tmp);
      const band = exp(-(((q - 0.78) / 0.16) * ((q - 0.78) / 0.16)));
      const p = (y * W + x) * 3;
      S.sky[p] = tmp[0] + 28 * band;
      S.sky[p + 1] = tmp[1] + 34 * band;
      S.sky[p + 2] = tmp[2] + 22 * band;
    }
  }
  for (let i = 0; i < S.NC; i++) {
    S.CP[i] = (hash(i, 0, 31) - 0.5) * 0.9;
    S.CW[i] = 0.75 + 0.45 * hash(i, 0, 32);
    S.CPH[i] = hash(i, 0, 33) * 60;
    S.CPR[i] = 24 + 26 * hash(i, 0, 34);
    S.CB[i] = hash(i, 0, 35) < 0.3 ? 0 : 0.5 + 0.5 * hash(i, 0, 37);
    S.CV[i] = 1 + 1.3 * hash(i, 0, 36);
  }
  return S;
}

// ---- holes
function newHole(S, age) {
  const u4 = S.u4;
  const canal = rnd() < 0.2 + 0.3 * u4;
  // the best of eight places: far from the other holes
  let bx = 32, by = 64, bs = -1;
  for (let c = 0; c < 8; c++) {
    const px = 3 + rnd() * 58, py = 6 + rnd() * 116;
    let s = 1e9;
    for (const h of S.holes) {
      const dx = (px - S.ox) - h.cx, dy = (py - S.oy) - h.cy;
      s = min(s, sqrt(dx * dx + dy * dy) - 0.6 * h.R * (1 + h.kE));
    }
    if (s > bs) { bs = s; bx = px; by = py; }
  }
  const ang = S.wind + (rnd() - 0.5) * 0.5;
  const h = {
    cx: bx - S.ox, cy: by - S.oy, wx: cos(ang), wy: sin(ang),
    kE: 0.8 + 0.45 * rnd(), R: 9.5 * (0.75 + 0.55 * rnd()), v: 0.9 * (0.8 + 0.4 * rnd()),
    tau: age, th: 60 + 45 * rnd(), vh: 0.75 + 0.35 * rnd(), tc: 4 + 6 * rnd(),
    s0x: 0, s0y: 0, s1x: 0, s1y: 0, n0: rnd() * 50, n1: rnd() * 50, canal,
  };
  if (canal) {
    const L = (12 + 22 * rnd());
    const a = (rnd() - 0.5) * 1.6; // track angle off the wind
    h.s1x = L * cos(a); h.s1y = L * sin(a);
    h.s0x = -h.s1x; h.s0y = -h.s1y;
    h.R *= 0.7;
    h.th += 10;
  }
  S.holes.push(h);
  return h;
}

function seedHoles(S) {
  const n = Math.round(1 + 6 * Math.pow(S.u3, 1.4));
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  for (let i = n - 1; i > 0; i--) { const j = floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  const fr = [0.14, 0.5, 0.86, 0.3, 0.68, 0.22, 0.4];
  for (let i = 0; i < n; i++) {
    const age = fr[i % fr.length] * (88 + 4 * rnd());
    newHole(S, age);
    if (holeArea(S) > 0.32 * NPX && i > 0) break;
  }
}

// the area the holes that are still growing clear, LED squared
function holeArea(S) {
  let area = 0;
  for (const h of S.holes) {
    if (h.tau > h.th) continue;
    const r = hfront(h, S), e = S.E * h.kE;
    area += PI * r * r * e + (h.canal ? 4 * r * sqrt(h.s1x * h.s1x + h.s1y * h.s1y) : 0);
  }
  return area;
}

function stepHoles(S, d) {
  for (const h of S.holes) h.tau += d * S.sf;
  for (let i = S.holes.length - 1; i >= 0; i--) {
    const h = S.holes[i];
    if (h.tau > h.th + (hreach(h, S) + 8 + 0.45 * h.vh * h.tc) / (1.45 * h.vh) + h.tc + 8) S.holes.splice(i, 1);
  }
  S.cool -= d;
  let alive = 0;
  for (const h of S.holes) alive += h.tau > h.th ? 0 : 1;
  const n = 1 + 6 * Math.pow(S.u3, 1.4);
  const area = holeArea(S);
  if (S.cool <= 0 && alive < n - 0.1 && area < 0.32 * NPX) {
    newHole(S, 0);
    S.cool = (3 + 8 * rnd()) / S.sf;
  }
  // too many holes: let the oldest start to heal now
  if (alive > n + 1.2) {
    let o = null;
    for (const h of S.holes) if (h.tau < h.th && (!o || h.tau > o.tau)) o = h;
    if (o && o.tau > 20) o.th = o.tau;
  }
}

// distance from (X, Y) to a hole's seed in the stretched metric
function hdist(h, X, Y, E) {
  const dx = X - h.cx, dy = Y - h.cy;
  const a = (dx * h.wx + dy * h.wy) / E, b = dy * h.wx - dx * h.wy;
  const px = a - h.s0x / E, py = b - h.s0y;
  const sx = (h.s1x - h.s0x) / E, sy = h.s1y - h.s0y;
  const l2 = sx * sx + sy * sy;
  let t = 0;
  if (l2 > 1e-6) t = cl((px * sx + py * sy) / l2, 0, 1);
  const qx = px - sx * t, qy = py - sy * t;
  return sqrt(qx * qx + qy * qy);
}
// how far a hole's front will get across the wind: the clear radius plus the 10 LEDs of delay and rim that the cloud keeps
function hreach(h, S) {
  return h.R * S.sz * Math.pow(2.2 / (S.E * h.kE), 0.35) + 10;
}
// front radius of a hole across the wind
function hfront(h, S) {
  if (h.tau <= 0) return 0;
  const R = hreach(h, S);
  return R * (1 - exp((-h.v * h.tau) / R));
}
function hglac(h, S, r, dd) {
  const g = sm(0, RIM, r - dd);
  if (g <= 0 || h.tau <= h.th) return g;
  const dt = h.tau - h.th;
  const rimH = sm(0, RIMH, h.vh * dt - (r - dd));
  const ctrH = sm(0, RIMH, 0.45 * h.vh * (dt - h.tc) - dd);
  return g * (1 - (rimH > ctrH ? rimH : ctrH));
}

export function setup(params) {
  params.s = makeState();
}

function readKnobs(S, kn) {
  S.k = kn;
  const u1 = cl(kn[0], 0, 1);
  S.u2 = cl(kn[1], 0, 4) / 4;
  S.u3 = (cl(kn[2], -1, 1) + 1) / 2;
  S.u4 = (cl(kn[3], -1, 1) + 1) / 2;
  S.sf = 0.55 + 0.9 * S.u2;
  S.sz = 0.35 + 1.45 * Math.pow(S.u2, 1.3);
  const u4 = S.u4;
  S.E = 1 + 2.2 * Math.pow(u4, 1.1);
  S.lean = 0.05 + 0.32 * u4;
  S.bend = 0.06 + 0.4 * u4;
  S.hue = TAU * u1 * 0.75;
  S.ani = 0.95 + 0.7 * u4;
  S.lc = 0.3 * (u4 - 0.3);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  readKnobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.ready) {
    S.ready = true;
    S.wind = -0.35 + 0.3 * (rnd() - 0.5);
    S.ox = 0; S.oy = 0;
    seedHoles(S);
  }
  S.t += d;
  S.wind = -0.32 + 0.22 * sin(S.t * 0.021 + 1) + 0.12 * sin(S.t * 0.0077 + 2);
  S.ox += d * 0.2 * cos(S.wind);
  S.oy += d * 0.2 * sin(S.wind);
  stepHoles(S, d);
}

function buildLattice(S) {
  const t = S.t;
  const xa = (-S.ox - S.lc * (0 - 64)) / S.ani, xb = (-S.ox - S.lc * (127 - 64)) / S.ani;
  S.i0 = floor((min(xa, xb) - 8) / G) - 1;
  S.j0 = floor((-S.oy - 6) / G) - 1;
  for (let jj = 0; jj < NJ; jj++) {
    for (let ii = 0; ii < NI; ii++) {
      const i = S.i0 + ii, j = S.j0 + jj, k = jj * NI + ii;
      const r1 = hash(i, j, 1), r2 = hash(i, j, 2), r3 = hash(i, j, 3), r4 = hash(i, j, 4), r5 = hash(i, j, 5), r6 = hash(i, j, 6);
      const om1 = TAU / (60 + 90 * r4), om2 = TAU / (37 + 70 * r5);
      S.PX[k] = (i + 0.5 + 0.5 * (j & 1) + (r1 - 0.5) * 0.52 + 0.09 * sin(t * om1 + r3 * TAU)) * G;
      S.PY[k] = (j + 0.5 + (r2 - 0.5) * 0.52 + 0.09 * cos(t * om2 + r3 * 10.7)) * G;
      S.PW[k] = 0.95 + 0.2 * sin(t * om2 * 0.8 + r6 * TAU) + 0.24 * (r5 - 0.5);
      S.PD[k] = hash(i, j, 7);
      S.PB[k] = (0.66 + 0.6 * hash(i, j, 8)) * (1 + 0.1 * sin(t * om1 * 1.3 + r2 * TAU));
    }
  }
  // warp and tone fields, in deck coordinates, on a 2-LED grid
  for (let gy = 0; gy < NWY; gy++) {
    for (let gx = 0; gx < NWX; gx++) {
      const X = gx * WG - S.ox, Y = gy * WG - S.oy;
      const k = gy * NWX + gx;
      S.WX[k] = 5.6 * (vnoise(X * 0.052 + t * 0.010, Y * 0.052, 11) - 0.5) + 2.6 * (vnoise(X * 0.13, Y * 0.13 + t * 0.02, 13) - 0.5);
      S.WY[k] = 5.6 * (vnoise(X * 0.052, Y * 0.052 - t * 0.008, 12) - 0.5) + 2.6 * (vnoise(X * 0.13 - t * 0.017, Y * 0.13, 14) - 0.5);
      S.BT[k] = vnoise(X * 0.03 + 7 + t * 0.004, Y * 0.026 - t * 0.003, 15) - 0.5;
    }
  }
}

function fx(S, y) {
  const v = y - 64;
  return S.lean * v + (S.bend * v * v) / 128;
}

// ice map for the streaks: where the holes are glaciated and fresh, smeared down the streaks' curves
function buildGate(S) {
  const ice = S.ice, gate = S.gate, E = S.E;
  for (let gy = 0; gy < GGH; gy++) {
    const Y = gy * 2 + 1 - S.oy;
    for (let gx = 0; gx < GGW; gx++) {
      const X = gx * 2 + 1 - S.ox;
      let a = 0;
      for (const h of S.holes) {
        const r = hfront(h, S) ;
        const dd = hdist(h, X, Y, E * h.kE);
        if (dd > r + 4) continue;
        const gl = hglac(h, S, r, dd);
        if (gl <= 0) continue;
        const fresh = 0.45 + 0.55 * exp(-max(0, r - dd) / 9);
        const env = h.tau < 70 ? 1 : exp(-(h.tau - 70) / 45);
        const v = gl * fresh * env;
        if (v > a) a = v;
      }
      ice[gy * GGW + gx] = a;
    }
  }
  for (let gy = 0; gy < GGH; gy++) {
    const y = gy * 2 + 1;
    const fy = fx(S, y);
    for (let gx = 0; gx < GGW; gx++) {
      const x = gx * 2 + 1;
      let m = 0;
      for (let k = 0; k < 9; k++) {
        const ys = y - 2 * k;
        if (ys < 0) break;
        const xs = x - fy + fx(S, ys);
        const sx = floor(xs / 2), sy = floor(ys / 2);
        if (sx < 0 || sx >= GGW) continue;
        const v = ice[sy * GGW + sx] * exp(-k * 0.16);
        if (v > m) m = v;
      }
      gate[gy * GGW + gx] = m;
    }
  }
}

function hueMatrix(S) {
  const a = S.hue, c = cos(a), s = sin(a), m = S.mat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) { update(0, { knobValues: [0, 2, 0, 0.06] }, params); }
  buildLattice(S);
  buildGate(S);
  hueMatrix(S);
  const M = S.mat, t = S.t, E0 = S.E, ANI = S.ani;
  const nh = S.holes.length;
  // per-hole constants
  const hr = new Array(nh), hE = new Array(nh);
  for (let i = 0; i < nh; i++) { hr[i] = hfront(S.holes[i], S); hE[i] = E0 * S.holes[i].kE; }
  // streak column constants
  const lean = S.lean, bend = S.bend;
  void lean; void bend;
  for (let y = 0; y < H; y++) {
    const gy = y / WG, gj = floor(gy), fyw = gy - gj;
    const fy = fx(S, y);
    for (let x = 0; x < W; x++) {
      const gx = x / WG, gi = floor(gx), fxw = gx - gi;
      const wi = gj * NWX + gi;
      const w00 = (1 - fxw) * (1 - fyw), w10 = fxw * (1 - fyw), w01 = (1 - fxw) * fyw, w11 = fxw * fyw;
      const wxv = S.WX[wi] * w00 + S.WX[wi + 1] * w10 + S.WX[wi + NWX] * w01 + S.WX[wi + NWX + 1] * w11;
      const wyv = S.WY[wi] * w00 + S.WY[wi + 1] * w10 + S.WY[wi + NWX] * w01 + S.WY[wi + NWX + 1] * w11;
      const btv = S.BT[wi] * w00 + S.BT[wi + 1] * w10 + S.BT[wi + NWX] * w01 + S.BT[wi + NWX + 1] * w11;
      const X = x - S.ox + wxv, Y = y - S.oy + wyv;
      // the cloudlets: a sum of soft bumps, one per lattice point
      const Xs = (X - S.lc * (Y - 64)) / ANI;
      const ci = floor(Xs / G) - S.i0, cj = floor(Y / G) - S.j0;
      let D = 0, hx = 0, hy = 0, sw = 1e-9, scx = 0, scy = 0, spd = 0, spb = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const k = (cj + dj) * NI + (ci + di);
          const dx = Xs - S.PX[k], dy = Y - S.PY[k];
          const q = (dx * dx + dy * dy) * ISIG2;
          if (q > 7) continue;
          const g = S.PW[k] * EXPT[(q * EXPK) | 0];
          D += g; hx += g * dx; hy += g * dy;
          const g3 = g * g * g;
          sw += g3; scx += g3 * S.PX[k]; scy += g3 * S.PY[k]; spd += g3 * S.PD[k]; spb += g3 * S.PB[k];
        }
      }
      D *= 1 + 0.5 * btv;
      hx *= -SIG * ISIG2; hy *= -SIG * ISIG2; // slope of the bump field, per SIG
      const cy = scy / sw, cx = (scx / sw) * ANI + S.lc * (cy - 64), pdel = spd / sw, pbri = spb / sw;
      const thick = sm(0.36, 0.8, D);
      // glaciation
      let glo = 0;
      for (let i = 0; i < nh; i++) {
        const h = S.holes[i], r = hr[i];
        const dp = hdist(h, X, Y, hE[i]);
        if (dp > r + 9) continue;
        const dc = hdist(h, cx, cy, hE[i]);
        const wob = vnoise((X - h.cx) * 0.07 + h.n0, (Y - h.cy) * 0.07 + h.n1, 21) - 0.5;
        const wob2 = vnoise((X - h.cx) * 0.16 + h.n1, (Y - h.cy) * 0.16 + h.n0, 22) - 0.5;
        const dd = 0.6 * dc + 0.4 * dp + 8 * pdel + 5.2 * wob * (0.5 + r * 0.05) + 5 * wob2;
        const g = hglac(h, S, r, dd);
        if (g > glo) glo = g;
      }
      // the cloud
      const m = 0.24 + 0.76 * thick;
      const A = sm(0, 0.32, m - 1.08 * glo);
      const shade = cl(0.48 + 0.95 * -(hx * LX + hy * LY), 0, 1.2);
      const under = 0.62 + 0.38 * (y / 127);
      let tv = under * (0.3 + 0.7 * shade) * pbri * (0.54 + 0.46 * thick) * (1 + 0.3 * btv) * 1.1;
      tv = cl(tv, 0, 1);
      const ri = floor(tv * 255) * 3;
      const p = (y * W + x) * 3;
      let r = S.sky[p] * (1 - A) + S.ramp[ri] * A;
      let g = S.sky[p + 1] * (1 - A) + S.ramp[ri + 1] * A;
      let b = S.sky[p + 2] * (1 - A) + S.ramp[ri + 2] * A;
      if (glo > 0.01) {
        const eg = 4 * A * (1 - A) * 0.32 * sm(0.01, 0.2, glo);
        r += (GLOW[0] - r) * eg; g += (GLOW[1] - g) * eg; b += (GLOW[2] - b) * eg;
      }
      // fall streaks
      const gx2 = (x - 1) * 0.5, gy2 = (y - 1) * 0.5;
      const sx0 = cl(floor(gx2), 0, GGW - 2), sy0 = cl(floor(gy2), 0, GGH - 2);
      const sfx = cl(gx2 - sx0, 0, 1), sfy = cl(gy2 - sy0, 0, 1);
      const gi0 = sy0 * GGW + sx0;
      const gate = S.gate[gi0] * (1 - sfx) * (1 - sfy) + S.gate[gi0 + 1] * sfx * (1 - sfy) + S.gate[gi0 + GGW] * (1 - sfx) * sfy + S.gate[gi0 + GGW + 1] * sfx * sfy;
      if (gate > 0.03) {
        const u = x - fy;
        const iu0 = floor(u / 4.4);
        let acc = 0;
        for (let dI = -1; dI <= 1; dI++) {
          const ii = iu0 + dI;
          const ci2 = cl(ii + 50, 0, S.NC - 1);
          const cc = (ii + 0.5 + S.CP[ci2]) * 4.4 + 0.9 * sin(y * 0.11 + ii * 2.3);
          const dxu = u - cc;
          const wv = S.CW[ci2];
          if (dxu > 3 * wv || dxu < -3 * wv) continue;
          let s = (y - S.CPH[ci2] - S.CV[ci2] * t) / S.CPR[ci2];
          s -= floor(s);
          const env = sm(0, 0.12, s) * (1 - s) * (1 - s) * (1 - 0.3 * s);
          const gau = exp((-dxu * dxu) / (2 * wv * wv));
          const v = (gau + 0.3 * exp((-dxu * dxu) / (10 * wv * wv))) * env * S.CB[ci2];
          if (v > acc) acc = v;
        }
        const clu = sm(0.3, 0.72, vnoise(u * 0.11 + 5, y * 0.03 + t * 0.012, 41));
        const f = cl(acc * 2.6 * gate * (0.2 + 0.8 * clu) * (1 - 0.5 * A), 0, 0.82);
        r += (FIB[0] - r) * f; g += (FIB[1] - g) * f; b += (FIB[2] - b) * f;
      }
      // palette turn
      const R = M[0] * r + M[1] * g + M[2] * b, Gc = M[3] * r + M[4] * g + M[5] * b, B = M[6] * r + M[7] * g + M[8] * b;
      display.setPixel(x, y, cl(R, 0, 255) | 0, cl(Gc, 0, 255) | 0, cl(B, 0, 255) | 0);
    }
  }
}
