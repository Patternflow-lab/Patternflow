// ===== Patternflow pattern =====
// Title:   Fireline
// Family:  wildfire
// Idea:    Seen from orbit at night as a thermal image, a wildfire front driven by a slowly turning wind sweeps across a patchwork of dark olive grass and teal forest as a bright orange-to-yellow band bowed into an ellipse, waits at the dark ribbons of streams until thrown embers light new fires on their far side, and leaves red embers that cool to black char behind it while the camera rides the head fire.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the elliptical growth of a wind-driven fire as a Huygens wavelet that every burning point sends out (Gwynfor Richards, 1990, from memory), the length-to-breadth ratio of such a fire growing with the wind (Hal Anderson, 1983, from memory), the rate of spread set by wind and fuel (Richard Rothermel, 1972, from memory), the minimum travel time of the front over a fuel grid (Mark Finney, 2002, from memory) found by a Dijkstra search (Edsger Dijkstra, 1959) and the long spotting jumps of firebrands over a break (Albini, 1979, from memory); original code, pattern round 263: the arrival time of the fire is solved as a Dijkstra search that runs in real time over a ring of 1-LED cells which slides with the camera, with elliptical wavelets on a 48-direction stencil.
// Round:   263
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Wind=0..4, Veer=-1..1, Embers=-1..1
//
// Knob 1: Tint. Four looks of the same night image at 0, 0.25, 0.5 and 0.75, blended over the middle 40 percent of each quarter of the knob's travel, and 1 is 0 again. At 0 it is orbit fire: yellow and orange flame, red embers and black char over olive grass (66, 90, 26) and teal forest (14, 72, 58). At 0.25 a thermal camera, flame from white through orange and magenta to purple over indigo. At 0.5 night vision, lime flame over violet. At 0.75 a cold flame, white-cyan to blue over plum. In every look the ground is lighter than the char and the flame lighter than both, so a front reads.
// Knob 2: Wind. 0 to 4, opening at 2. How hard the wind blows. It stretches the burnt ellipse, length over width 1 at 0 (a round fire), 2.0 at 2 and 3.3 at 4, and speeds the head fire over middling fuel, 1.4 LEDs a second at 0, 2.3 at 2 and 3.3 at 4. A flank or a backing fire never goes under 0.35 LED a second. It throws embers farther as well, a mean of 5.6 LEDs at 0, 12 at 2 and 19 at 4.
// Knob 3: Veer. -1 to 1, opening at 0. The heading of the wind, and the head fire runs the way it blows: straight up the panel at 0, 54 degrees to the left at -1 and to the right at 1. A wind of its own swings on top of that, up to 27 degrees either way over a few minutes (periods of 190, 67 and 29.3 s), so no heading holds and a flank can turn into the head. The heading is held at 72 degrees.
// Knob 4: Embers. -1 to 1, opening at 0.06. How often the front throws a firebrand ahead, 0.03 a second at -1, 0.17 at the opening and 0.85 at 1 (four times that while the camera, which follows the head fire, is going slower than 0.8 LED a second), how far, 0.8 times the Wind throw at -1 and 1.3 times at 1, and how the coals glow behind the front: 0.55 times as bright and 0.6 times as long at -1, 1.45 and 1.4 times at 1, with the patches that last a minute 0.4 and 1.6 times as strong. Two embers that land within 20 LEDs of each other in 15 s count as one, which caps the spray. Over 400 s and three runs an ember or a strike lights a new fire 1.2 times a minute at -1, 5.5 at the opening and 15.5 at 1, and the head fire carries the camera at 2.6, 3.0 and 4.1 LEDs a second. At -1 the front crosses a stream now and then; at 1 small fires come up ahead of the line all the time. Lightning strikes come with it, one in 40 to 110 s at 0 and twice as often at 1.

// What the picture is. The panel is the ground seen from straight above on a night pass, 64 LEDs across and 128 down, one LED to a cell. Unburnt land is a patchwork in world coordinates: grass, a lighter and quicker olive, and forest,
// a darker teal that burns at a third of the pace (a speed factor of 1.75 against 0.55), set by two layers of smooth noise (58 and 23 LEDs across) with soft edges, and here and there rock, a slate grey that slows the fire and at its heart will not burn at all.
// Dark ribbons of water, 1.7 to 3.2 LEDs wide, run along the half-height contour of another noise (170 and 64 LEDs across), so they wander like streams. They are breaks: no cell within 0.7 LED of one takes the fire. The map is a hash of the world
// and has no end. A ring of 128 x 256 cells holds the part near the camera, and the camera slides over it.
// The spread is a minimum travel time. Every cell has an arrival time, and a cell that has burned offers the fire to the 48 cells nearest it (every offset up to four cells with no common factor, so the directions are 14 degrees or less apart).
// The time it takes is the distance over a speed. The speed is that of the elliptical wavelet of a wind-driven fire seen from its rear focus, R(theta) = Vh (1 - e) / (1 - e cos theta), theta measured from the wind and e = sqrt(1 - 1/LB^2), never under 0.35 LED a second,
// over the fuel along the way (the harmonic mean over the cells the hop crosses), with 0.94 to 1.06 as a random factor for each cell. The least time over all routes is kept. One point of fire grows into an ellipse with its ignition at the tail, and many make bulges and bays
// where grass outruns forest. It runs as an event queue, a binary heap of tentative times popped as the clock reaches them, so a frame costs the cells that light in it. The wind is the knob plus three slow sines, and a cell uses the wind of the moment when it lights its neighbours.
// The picture is drawn from the arrival times alone. Per pixel the age of the fire, now minus arrival, is read from the four cells round it with the camera's fractions of a cell, so the front is where the age crosses zero and is smooth to a tenth of an LED.
// The gradient of the age is the slowness of the front, so one over it is the front's own speed: a head fire is bright, thick and goes to pale yellow, a flank at a quarter of that speed is thinner and orange, a backing fire is a dim red line. Behind the front the age gives the flame,
// 2.2 to 4.2 LEDs deep in grass and 3.5 to 6.8 in forest (deeper the faster the front), then embers that cool from red to nothing over 5 s in grass and 14 s in forest with a slow mottling, a few glowing patches that last a minute, and then charcoal. Ahead of the front the ground warms a little.
// Where the front meets a stream it stops, its flames die to embers, and the stream shows as a dark line through them.
// A firebrand is lifted from one of the cells that lit in the last 60 s and were not creeping (the furthest downwind of six picked at random), thrown downwind a distance Ds times (0.5 plus an exponential random) with a sideways spread of about 25 degrees, and, if it lands on fuel that the front
// will not reach for another 1.8 s, it lights a cell there after its flight: a small ellipse that opens with a 2 to 3 LED flash. That is how the fire crosses a stream. Now and then a lightning strike lights a place 30 to 80 LEDs ahead of the head fire,
// and one does at once if no cell has lit for 6 s, or if the camera has gone slower than 1 LED a second for 9 s, so a fire that has stalled at a stream does not leave the panel still.
// The camera rides a weighted mean of the cells that lit in the last few seconds, weighted by how far downwind they are (a factor of e every 7 LEDs), which is the head fire, and holds it low in the panel, the 78th row, so the front curves across the screen
// and the burn is behind it. It holds still while that weight is thin and moves at most 9 LEDs a second. The first update runs 100 s of fire from a line 120 LEDs long across the wind, below the panel, with the knobs as they are, and then on, up to 80 s more, until the camera is
// moving with the head fire. The opening runs over streams and rock, and embers fly in its first 35 s only and not again until 8 s after it, so the first picture is a long front across the panel and the knobs have had their say. An opening from a single spark, with embers flying
// to the end of it, grew round lobes from embers that landed ahead of its head, and the burn read as a bear's head with ears.

const W = 64, H = 128, NPX = W * H;
const NXB = 7, NYB = 8, NX = 1 << NXB, NY = 1 << NYB, NXM = NX - 1, NYM = NY - 1, NCELL = NX * NY;
const MARGX = 32, MARGY = 64; // cells kept left of the view and above it
const INF = 1e30, AMIN = 12;
const HCAP = 1 << 17, EVN = 512, EVM = EVN - 1;
const { floor, sqrt, exp, sin, cos, abs, min, max, pow, PI, round, log } = Math;
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

// ---- the 48-direction stencil: every offset up to 4 cells with no common factor
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const SDX = [], SDY = [], SLEN = [], SUX = [], SUY = [], SST = [], SSX = [], SSY = [];
for (let dy = -4; dy <= 4; dy++) {
  for (let dx = -4; dx <= 4; dx++) {
    if ((!dx && !dy) || gcd(abs(dx), abs(dy)) !== 1) continue;
    const len = sqrt(dx * dx + dy * dy), m = max(abs(dx), abs(dy));
    SDX.push(dx); SDY.push(dy); SLEN.push(len); SUX.push(dx / len); SUY.push(dy / len);
    SST.push(SSX.length);
    for (let j = 1; j <= m; j++) { SSX.push(round((dx * j) / m)); SSY.push(round((dy * j) / m)); }
  }
}
SST.push(SSX.length);
const NS = SDX.length;

// ---- the looks: flame by temperature, and the ground
const FT = [0, 0.1, 0.24, 0.42, 0.62, 0.82, 1];
const LOOKS = [
  { // orbit fire
    flame: [[0, 0, 0], [58, 6, 4], [170, 22, 8], [255, 76, 10], [255, 148, 18], [255, 214, 64], [255, 250, 190]],
    grass: [66, 90, 26], forest: [14, 72, 58], rock: [52, 56, 66], river: [6, 18, 40], char: [10, 6, 8],
  },
  { // thermal camera
    flame: [[0, 0, 0], [40, 8, 70], [124, 14, 122], [214, 36, 92], [255, 120, 40], [255, 208, 92], [255, 248, 220]],
    grass: [40, 62, 130], forest: [22, 34, 96], rock: [60, 58, 82], river: [6, 10, 30], char: [8, 6, 14],
  },
  { // night vision
    flame: [[0, 0, 0], [6, 44, 12], [22, 122, 22], [84, 204, 30], [164, 244, 52], [226, 255, 122], [250, 255, 226]],
    grass: [74, 42, 126], forest: [38, 26, 98], rock: [62, 60, 84], river: [4, 12, 34], char: [8, 6, 12],
  },
  { // cold flame
    flame: [[0, 0, 0], [6, 22, 78], [14, 72, 196], [30, 160, 255], [92, 222, 255], [190, 246, 255], [244, 252, 255]],
    grass: [120, 44, 92], forest: [68, 28, 78], rock: [68, 66, 84], river: [6, 14, 38], char: [10, 6, 12],
  },
];

function buildLook(S, u) {
  const p = u * LOOKS.length, i0 = floor(p) % LOOKS.length, i1 = (i0 + 1) % LOOKS.length;
  const f = sm(0.3, 0.7, p - floor(p));
  const A = LOOKS[i0], B = LOOKS[i1];
  const mc = (a, b) => [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
  const fl = A.flame.map((c, i) => mc(c, B.flame[i]));
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let k = 0;
    while (k < FT.length - 2 && v > FT[k + 1]) k++;
    const t = cl((v - FT[k]) / (FT[k + 1] - FT[k]), 0, 1);
    for (let c = 0; c < 3; c++) S.lut[i * 3 + c] = mix(fl[k][c], fl[k + 1][c], t);
  }
  S.grass = mc(A.grass, B.grass);
  S.forest = mc(A.forest, B.forest);
  S.rockc = mc(A.rock, B.rock);
  S.riverc = mc(A.river, B.river);
  S.charc = mc(A.char, B.char);
}

function makeState() {
  return {
    ready: false, t: 0, sd: floor(rnd() * 900) + 1,
    x0: 0, y0: 0, cx: 0, cy: 0,
    F: new Float32Array(NCELL), L: new Float32Array(NCELL), RK: new Float32Array(NCELL), DR: new Float32Array(NCELL),
    N: new Float32Array(NCELL), VIN: new Float32Array(NCELL), BR: new Uint8Array(NCELL),
    TM: new Float64Array(NCELL).fill(INF), DN: new Uint8Array(NCELL),
    hk: new Float64Array(HCAP), hv: new Int32Array(HCAP), hn: 0,
    EVX: new Float32Array(EVN), EVY: new Float32Array(EVN), EVV: new Float32Array(EVN), EVT: new Float32Array(EVN).fill(-1e9), evn: 0,
    hw: 0, hx: 0, hy: 0, lastEv: 0, csp: 0, quiet: 0, pre: false, tOpen: 0, ready0: false,
    kv: [0, 2, 0, 0.06], pal: -1,
    u: 0.5, LB: 2.8, ecc: 0.93, Vh: 2.3, beta: 0, wx: 0, wy: -1,
    spotAcc: 0, lt: 60, flash: [], land: [],
    lut: new Float32Array(256 * 3), grass: [0, 0, 0], forest: [0, 0, 0], rockc: [0, 0, 0], riverc: [0, 0, 0], charc: [0, 0, 0],
    PA: new Float32Array((W + 1) * (H + 1)), PB: new Uint8Array((W + 1) * (H + 1)), PL: new Float32Array((W + 1) * (H + 1)),
    PR: new Float32Array((W + 1) * (H + 1)), PD: new Float32Array((W + 1) * (H + 1)),
    FLS: new Float32Array(NPX),
  };
}

export function setup(params) {
  params.s = makeState();
}

// ---- the ground
const cid = (i, j) => (i & NXM) | ((j & NYM) << NXB);

function cellInit(S, i, j) {
  const id = cid(i, j), x = i + 0.5, y = j + 0.5, sd = S.sd;
  const n = 0.64 * vnoise(x / 58, y / 58, sd + 1) + 0.36 * vnoise(x / 23 + 7.7, y / 23, sd + 2);
  const L = sm(0.34, 0.68, n);
  const rk = 0.62 * vnoise(x / 44, y / 44, sd + 3) + 0.38 * vnoise(x / 17, y / 17, sd + 4);
  const R = sm(0.66, 0.8, rk);
  const ev = 1.5;
  const nr = (px, py) => 0.7 * vnoise(px / 170, py / 170, sd + 5) + 0.3 * vnoise(px / 64, py / 64, sd + 6);
  const r0 = nr(x, y);
  const gx = (nr(x + ev, y) - nr(x - ev, y)) / (2 * ev), gy = (nr(x, y + ev) - nr(x, y - ev)) / (2 * ev);
  const d = abs(r0 - 0.5) / max(sqrt(gx * gx + gy * gy), 0.004);
  const wd = 0.85 + 0.75 * vnoise(x / 37, y / 37, sd + 7);
  const dr = min(d, 9) - wd;
  let F = (1.75 - 1.2 * L) * pow(1 - R, 1.5);
  if (dr < 0.7) F = 0;
  S.F[id] = F; S.L[id] = L; S.RK[id] = R; S.DR[id] = dr;
  S.N[id] = 0.94 + 0.12 * hash(i, j, sd + 8);
  S.TM[id] = INF; S.DN[id] = 0; S.VIN[id] = 0; S.BR[id] = 0;
}

function moveWindow(S, nx0, ny0) {
  if (abs(nx0 - S.x0) >= NX || abs(ny0 - S.y0) >= NY || !S.ready0) {
    S.x0 = nx0; S.y0 = ny0; S.ready0 = true;
    for (let j = ny0; j < ny0 + NY; j++) for (let i = nx0; i < nx0 + NX; i++) cellInit(S, i, j);
    return;
  }
  while (S.x0 < nx0) { const i = S.x0 + NX; for (let j = S.y0; j < S.y0 + NY; j++) cellInit(S, i, j); S.x0++; }
  while (S.x0 > nx0) { S.x0--; for (let j = S.y0; j < S.y0 + NY; j++) cellInit(S, S.x0, j); }
  while (S.y0 < ny0) { const j = S.y0 + NY; for (let i = S.x0; i < S.x0 + NX; i++) cellInit(S, i, j); S.y0++; }
  while (S.y0 > ny0) { S.y0--; for (let i = S.x0; i < S.x0 + NX; i++) cellInit(S, i, S.y0); }
}

// ---- the event queue
function hpush(S, t, id) {
  if (S.hn >= HCAP) return;
  const K = S.hk, V = S.hv;
  let i = S.hn++;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (K[p] <= t) break;
    K[i] = K[p]; V[i] = V[p]; i = p;
  }
  K[i] = t; V[i] = id;
}
function hpop(S) {
  const K = S.hk, V = S.hv;
  const n = --S.hn;
  if (n <= 0) return;
  const t = K[n], id = V[n];
  let i = 0;
  for (;;) {
    let c = 2 * i + 1;
    if (c >= n) break;
    if (c + 1 < n && K[c + 1] < K[c]) c++;
    if (K[c] >= t) break;
    K[i] = K[c]; V[i] = V[c]; i = c;
  }
  K[i] = t; V[i] = id;
}

// light a cell: now or later, as a source with a speed to be counted by
function ignite(S, ix, iy, t, brand) {
  if (ix < S.x0 || ix >= S.x0 + NX || iy < S.y0 || iy >= S.y0 + NY) return false;
  const id = cid(ix, iy);
  if (S.DN[id] || S.F[id] < 0.05 || S.TM[id] <= t) return false;
  S.TM[id] = t; S.VIN[id] = 0.9 * S.Vh + 0.3; S.BR[id] = brand ? 1 : 0;
  hpush(S, t, id);
  return true;
}

// a cell has burned: send the fire to the cells round it
function relax(S, ix, iy, Ts) {
  const wx = S.wx, wy = S.wy, e = S.ecc, kk = S.Vh * (1 - e);
  const x0 = S.x0, y0 = S.y0, F = S.F, TM = S.TM, DN = S.DN;
  for (let q = 0; q < NS; q++) {
    const jx = ix + SDX[q], jy = iy + SDY[q];
    if (jx < x0 || jx >= x0 + NX || jy < y0 || jy >= y0 + NY) continue;
    const jd = cid(jx, jy);
    if (DN[jd]) continue;
    let inv = 0, ok = true;
    const a = SST[q], b = SST[q + 1];
    for (let s = a; s < b; s++) {
      let f = F[cid(ix + SSX[s], iy + SSY[s])];
      if (f < 0.05) {
        if (!S.pre) { ok = false; break; }
        f = 0.5; // the opening runs over streams and rock, so that no stream stops it
      }
      inv += 1 / f;
    }
    if (!ok) continue;
    const R = max(kk / (1 - e * (SUX[q] * wx + SUY[q] * wy)), 0.35);
    const cost = (SLEN[q] * inv * S.N[jd]) / ((b - a) * R);
    const Tc = Ts + cost;
    if (Tc < TM[jd] - 1e-7) {
      TM[jd] = Tc; S.VIN[jd] = SLEN[q] / cost; S.BR[jd] = 0;
      hpush(S, Tc, jd);
    }
  }
}

// ---- the wind and the knobs
function readKnobs(S, kn, d, first) {
  const a = first ? 1 : 1 - exp(-d / 0.25);
  for (let i = 1; i < 4; i++) S.kv[i] += (cl(kn[i], i === 1 ? 0 : -1, i === 1 ? 4 : 1) - S.kv[i]) * a;
  S.kv[0] = cl(kn[0], 0, 1);
  if (abs(S.kv[0] - S.pal) > 0.0005) { S.pal = S.kv[0]; buildLook(S, S.kv[0]); }
}
function setWind(S) {
  const u = cl(S.kv[1] / 4, 0, 1), t = S.t;
  S.u = u;
  S.LB = 1 + 2.3 * pow(u, 1.2);
  S.ecc = sqrt(1 - 1 / (S.LB * S.LB));
  S.Vh = 1.4 + 1.9 * pow(u, 1.1);
  const w = 0.26 * sin((TAU * t) / 190 + 1.3) + 0.15 * sin((TAU * t) / 67 + 4.1) + 0.06 * sin((TAU * t) / 29.3 + 0.7);
  S.beta = cl(0.95 * S.kv[2] + w, -1.25, 1.25);
  S.wx = sin(S.beta); S.wy = -cos(S.beta);
}

// ---- embers and strikes
function spot(S) {
  let best = -1, bp = -1e9;
  for (let k = 0; k < 6; k++) {
    const e = (rnd() * EVN) | 0;
    if (S.t - S.EVT[e] > 60 || S.EVV[e] < 0.15 * S.Vh) continue;
    const p = S.EVX[e] * S.wx + S.EVY[e] * S.wy;
    if (p > bp) { bp = p; best = e; }
  }
  if (best < 0) return;
  const k4 = S.kv[3];
  const Ds = (3.5 + 8.5 * S.u) * (0.8 + 0.25 * (k4 + 1));
  const D = Ds * (0.5 - log(1 - rnd()));
  const ang = S.beta + (rnd() + rnd() + rnd() - 1.5) * 0.9;
  const lx = floor(S.EVX[best] + sin(ang) * D), ly = floor(S.EVY[best] - cos(ang) * D);
  if (lx < S.x0 + 2 || lx >= S.x0 + NX - 2 || ly < S.y0 + 2 || ly >= S.y0 + NY - 2) return;
  const t1 = S.t + 0.3 + D / 9;
  const id = cid(lx, ly);
  if (S.DN[id] || S.TM[id] < t1 + 1.8) return;
  // two embers that land within 20 LEDs of each other in 15 s would grow side by side into a pair of lobes
  const L = S.land;
  for (let i = L.length - 1; i >= 0; i--) {
    if (t1 - L[i].t > 15) L.splice(i, 1);
    else if ((L[i].x - lx) * (L[i].x - lx) + (L[i].y - ly) * (L[i].y - ly) < 400) return;
  }
  if (ignite(S, lx, ly, t1, true)) L.push({ x: lx, y: ly, t: t1 });
}
function strike(S) {
  const hx = S.hw > 1e-6 ? S.hx / S.hw : S.cx + 32, hy = S.hw > 1e-6 ? S.hy / S.hw : S.cy + 56;
  for (let k = 0; k < 12; k++) {
    const D = 30 + 50 * rnd(), sd = (rnd() - 0.5) * 70;
    const lx = floor(hx + sin(S.beta) * D + cos(S.beta) * sd), ly = floor(hy - cos(S.beta) * D + sin(S.beta) * sd);
    if (lx < S.x0 + 4 || lx >= S.x0 + NX - 4 || ly < S.y0 + 4 || ly >= S.y0 + NY - 4) continue;
    if (S.DN[cid(lx, ly)] || S.TM[cid(lx, ly)] < INF) continue;
    if (ignite(S, lx, ly, S.t + 0.3, true)) return;
  }
}

// ---- one step of the fire
function step(S, d) {
  S.t += d;
  setWind(S);
  const T = S.t;
  const dec = exp(-d / 4);
  S.hw *= dec; S.hx *= dec; S.hy *= dec;
  while (S.hn > 0 && S.hk[0] <= T) {
    const t0 = S.hk[0], id = S.hv[0];
    hpop(S);
    if (S.DN[id] || S.TM[id] !== t0) continue;
    S.DN[id] = 1;
    const ix = S.x0 + (((id & NXM) - S.x0) & NXM), iy = S.y0 + (((id >> NXB) - S.y0) & NYM);
    const v = S.VIN[id];
    const rel = (ix + 0.5 - S.cx - 32) * S.wx + (iy + 0.5 - S.cy - 78) * S.wy;
    const w = exp(cl(rel, -60, 20) / 7);
    S.hw += w; S.hx += w * (ix + 0.5); S.hy += w * (iy + 0.5);
    const e = S.evn++ & EVM;
    S.EVX[e] = ix + 0.5; S.EVY[e] = iy + 0.5; S.EVV[e] = v; S.EVT[e] = t0;
    S.lastEv = t0;
    if (S.BR[id]) { S.flash.push({ x: ix + 0.5, y: iy + 0.5, t0 }); S.BR[id] = 0; }
    relax(S, ix, iy, t0);
  }
  for (let i = S.flash.length - 1; i >= 0; i--) if (T - S.flash[i].t0 > 0.9) S.flash.splice(i, 1);
  // firebrands
  // while the opening runs embers fly for its first 35 s only, and for 8 s after it they do not, so that the first picture is the front and not lobes that embers have just added
  const live = S.pre ? T < 35 : T > S.tOpen + 8;
  if (live) {
    S.spotAcc += (S.csp < 0.8 ? 4 : 1) * 0.15 * pow(2, 2.5 * S.kv[3]) * d;
    while (S.spotAcc >= 1) { S.spotAcc -= 1; spot(S); }
    S.lt -= d * pow(2, S.kv[3]);
    S.quiet = S.csp < 1 ? S.quiet + d : 0;
  }
  if ((live && (S.lt <= 0 || S.quiet > 9)) || T - S.lastEv > 6) {
    S.quiet = 0;
    strike(S);
    if (S.lt <= 0) S.lt = 40 + 70 * rnd();
    S.lastEv = T - 3;
  }
  // the camera rides the head fire
  if (S.hw > 8) {
    const tx = S.hx / S.hw - 32, ty = S.hy / S.hw - 78;
    const k = 1 - exp(-d / 1.5);
    let dx = (tx - S.cx) * k, dy = (ty - S.cy) * k;
    const m = sqrt(dx * dx + dy * dy), cap = 9 * d;
    if (m > cap) { dx *= cap / m; dy *= cap / m; }
    S.cx += dx; S.cy += dy;
    if (d > 1e-6) S.csp += (sqrt(dx * dx + dy * dy) / d - S.csp) * (1 - exp(-d / 4));
  } else S.csp -= S.csp * (1 - exp(-d / 4));
  moveWindow(S, floor(S.cx) - MARGX, floor(S.cy) - MARGY);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    readKnobs(S, kn, 0, true);
    // a line of fire 120 LEDs long across the wind, below the panel, and 100 s of fire from it
    S.cx = -32; S.cy = 150 - 78;
    moveWindow(S, floor(S.cx) - MARGX, floor(S.cy) - MARGY);
    setWind(S);
    S.hw = 20; S.hx = 10; S.hy = 3010;
    S.pre = true;
    for (let k = -60; k <= 60; k++) ignite(S, round(-k * S.wy), round(150 + k * S.wx), 0.05, false);
    for (let i = 0; i < 1000; i++) step(S, 0.1);
    // go on, up to 80 s more, until the camera is moving with the head fire
    for (let i = 0; i < 800 && S.csp < 1.2; i++) step(S, 0.1);
    S.pre = false;
    S.tOpen = S.t;
  }
  readKnobs(S, kn, d, false);
  step(S, d);
}

// ---- drawing
export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) update(0, { knobValues: [0, 2, 0, 0.06] }, params);
  const T = S.t, lut = S.lut;
  const bx = floor(S.cx), by = floor(S.cy), fx = S.cx - bx, fy = S.cy - by;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  const PW = W + 1;
  const { PA, PB, PL, PR, PD, FLS } = S;
  // the patch of cells under the panel
  for (let j = 0; j <= H; j++) {
    for (let i = 0; i <= W; i++) {
      const id = cid(bx + i, by + j), k = j * PW + i;
      const burn = S.F[id] >= 0.05;
      PB[k] = burn ? 1 : 0;
      const tm = S.TM[id];
      PA[k] = tm >= INF ? -AMIN : max(T - tm, -AMIN);
      PL[k] = S.L[id]; PR[k] = S.RK[id]; PD[k] = S.DR[id];
    }
  }
  // flashes of firebrands
  FLS.fill(0);
  for (const f of S.flash) {
    const age = T - f.t0, br = (1 - age / 0.9) * (1 - age / 0.9);
    const px = f.x - S.cx, py = f.y - S.cy;
    for (let y = max(0, floor(py - 3)); y <= min(H - 1, floor(py + 3)); y++) {
      for (let x = max(0, floor(px - 3)); x <= min(W - 1, floor(px + 3)); x++) {
        const dx = x + 0.5 - px, dy = y + 0.5 - py;
        FLS[y * W + x] += br * exp(-(dx * dx + dy * dy) / 1.8);
      }
    }
  }
  // Embers also sets how the coals glow: brightness, how long they last and how strong the patches that last a minute are
  const u4 = (cl(S.kv[3], -1, 1) + 1) / 2, ge = 0.55 + 0.9 * u4, gt = 0.6 + 0.8 * u4, gh = 0.4 + 1.2 * u4;
  const gr = S.grass, fo = S.forest, rc = S.rockc, rv = S.riverc, ch = S.charc;
  for (let y = 0; y < H; y++) {
    const wy = by + y + fy;
    for (let x = 0; x < W; x++) {
      const wx = bx + x + fx;
      const k = y * PW + x, k1 = k + 1, k2 = k + PW, k3 = k2 + 1;
      const b0 = PB[k], b1 = PB[k1], b2 = PB[k2], b3 = PB[k3];
      const nb = b0 + b1 + b2 + b3;
      let a = -AMIN, gg = 0.1;
      if (nb > 0) {
        let mean = 0;
        if (nb < 4) mean = ((b0 ? PA[k] : 0) + (b1 ? PA[k1] : 0) + (b2 ? PA[k2] : 0) + (b3 ? PA[k3] : 0)) / nb;
        const a0 = b0 ? PA[k] : mean, a1 = b1 ? PA[k1] : mean, a2 = b2 ? PA[k2] : mean, a3 = b3 ? PA[k3] : mean;
        a = a0 * w00 + a1 * w10 + a2 * w01 + a3 * w11;
        if (min(a0, a1, a2, a3) < 0.01 - AMIN) a = -AMIN; // a corner that no fire has reached: no front here
        else {
          const ax = (1 - fy) * (a1 - a0) + fy * (a3 - a2), ay = (1 - fx) * (a2 - a0) + fx * (a3 - a1);
          gg = max(sqrt(ax * ax + ay * ay), 0.1);
        }
      }
      const L = PL[k] * w00 + PL[k1] * w10 + PL[k2] * w01 + PL[k3] * w11;
      const R = PR[k] * w00 + PR[k1] * w10 + PR[k2] * w01 + PR[k3] * w11;
      const dr = PD[k] * w00 + PD[k1] * w10 + PD[k2] * w01 + PD[k3] * w11;
      // unburnt ground
      const tex = 0.8 + 0.4 * (0.6 * vnoise(wx / 6.5, wy / 6.5, S.sd + 11) + 0.4 * vnoise(wx / 2.7, wy / 2.7, S.sd + 12));
      let vr = mix(gr[0], fo[0], L), vg = mix(gr[1], fo[1], L), vb = mix(gr[2], fo[2], L);
      vr = mix(vr, rc[0], R); vg = mix(vg, rc[1], R); vb = mix(vb, rc[2], R);
      vr *= tex; vg *= tex; vb *= tex;
      // the fire
      const s = nb > 0 ? a / gg : -99;
      const v = min(1 / gg, 9);
      let th = 0;
      let r, g, bl;
      if (nb > 0 && s > -4) {
        const burnt = sm(-0.5, 0.9, s);
        r = mix(vr, ch[0], burnt); g = mix(vg, ch[1], burnt); bl = mix(vb, ch[2], burnt);
        const I = 0.45 + 0.55 * min(1, pow(v / 2, 0.7));
        const ds = (2.6 + 0.6 * min(v, 4)) * (0.85 + 0.5 * L);
        const lead = sm(-0.9, 0.5, s);
        const ap = max(a, 0), sp = max(s, 0) / ds;
        const flame = lead * max(exp(-0.7 * sp * sp), exp(-ap / (0.9 + 1.0 * L)));
        const em = 0.21 * ge * exp(-ap / ((5 + 9 * L) * gt)) * (0.7 + 0.6 * vnoise(wx * 0.45, wy * 0.45, S.sd + 13)) * lead;
        const hot = sm(0.68, 0.9, vnoise(wx / 4.6, wy / 4.6, S.sd + 14)) * (0.6 + 0.8 * L);
        const em2 = hot > 0 ? 0.14 * gh * hot * exp(-ap / 40) * (0.75 + 0.25 * sin(T * 0.9 + wx * 0.7 + wy * 0.3)) * lead : 0;
        th = 1 - (1 - I * flame) * (1 - em) * (1 - em2);
        if (s < 0) {
          const pre = 0.16 * sm(-3, -0.2, s) * sm(4, 1.5, gg);
          r += 255 * pre * 0.9; g += 110 * pre * 0.9; bl += 20 * pre * 0.9;
        }
      } else {
        r = vr; g = vg; bl = vb;
      }
      const fl = FLS[y * W + x];
      if (fl > 0.001) th = 1 - (1 - th) * (1 - min(fl, 1) * 0.95);
      if (th > 0.004) {
        const li = cl(th, 0, 1) * 255, i0 = li | 0, f0 = li - i0, o = i0 * 3, o1 = i0 < 255 ? o + 3 : o;
        const al = sm(0.02, 0.16, th);
        const fr = lut[o] + (lut[o1] - lut[o]) * f0, fg = lut[o + 1] + (lut[o1 + 1] - lut[o + 1]) * f0, fb = lut[o + 2] + (lut[o1 + 2] - lut[o + 2]) * f0;
        r = r * (1 - al) + fr * al; g = g * (1 - al) + fg * al; bl = bl * (1 - al) + fb * al;
      }
      // water
      const wm = sm(0.55, -0.3, dr);
      if (wm > 0) { r = mix(r, rv[0], wm); g = mix(g, rv[1], wm); bl = mix(bl, rv[2], wm); }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(bl, 0, 255) | 0);
    }
  }
}
