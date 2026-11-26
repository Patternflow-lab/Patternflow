// ===== Patternflow pattern =====
// Title:   Spinifex
// Family:  spinifex
// Idea:    A thin section of komatiite lava under a microscope with crossed polarizers and a first-order red plate, scrolling up as a cooling front descends through it, where olivine blades nucleate at the front in books of parallel plates and grow down until they meet another, blue or gold on magenta glass by their orientation, while the polarizers turn slowly and the books trade colours.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: spinifex texture in komatiite, the Archean ultramafic lava named by Viljoen and Viljoen (1969, from memory) after the Komati River, its skeletal olivine plates named after the spiky spinifex grass of Australia (Nesbitt, 1971, from memory) and grown fast down from the chilled top of a flow (Donaldson, 1982; Shore and Fowler, 1999, from memory); the first-order red or gypsum plate of the petrographic microscope and the Michel-Levy chart (Auguste Michel-Levy, 1888). Original here: a cooling front that scrolls the panel, olivine books grown against an occupancy grid, and their colours from the Jones product of polarizer, crystal, accessory and analyzer summed over the CIE colour-matching functions, pattern round 262
// Round:   262
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cooling=0.2..3, Plates=-1..1, Spread=-1..1
//
// Knob 1: Hue. The way the section is lit, four views each holding for half its stretch and blending into the next: the first-order red plate at 0 (blue and gold blades on magenta glass), crossed polarizers alone at 0.25 (grey and white blades on black), plane light at 0.5 (pale green blades on brown glass), a compensator set near the third-order pink at 0.75 (rose and green blades on peach), the red plate again at 1.
// Knob 2: Cooling. How fast the flow cools, which is how fast the front descends and the picture scrolls: 0.4 LED a second at 0.2, 1.5 at 2 where it opens, 2 at 3. Fast cooling grows a deeper zone of random spinifex under each flow top (23 LED at 0.2, 51 at 2, 72 at 3) and shorter blades in books that start more often; slow cooling grows long, sparse sheaves, 2.8 times as long at 0.2.
// Knob 3: Plates. The size of the plate books, doubling the blade length for each unit and adding blades to a book: two to four short blades at -1, three to five blades 16 to 100 LED long at 0, five to eight long ones at 1, a little wider and further apart.
// Knob 4: Spread. How far the orientations scatter round upright, between books and inside one: books within about 11 degrees of upright and nearly parallel blades at -1, so they trade colour together; 22 degrees and a fan of 1.5 degrees from blade to blade at 0; 43 degrees and 3.4 at 1, chaotic sheaves meeting at wide angles.

// What the picture is. The rock is a world 80 LED wide (8 beyond each edge of the panel) and endless downward. A cooling front, an
// isotherm, descends through it at the Cooling speed, and the panel follows it: the front sits near row 112, the finished rock leaves at
// the top and fresh melt comes in at the bottom. The front is wavy (value noise along x that changes as the front moves on).
// The rock is a pile of flows 400 to 680 LED thick. Under each flow top lies a dark glassy selvage and 9 LED of chilled glass, then random
// spinifex (short blades in ones, twos and threes at any orientation) to a depth that grows with Cooling, then plate spinifex down to the
// next flow's top. A new book's blades are 26 LED long under the random zone and 0.3 LED longer for every LED deeper, up to 85, times
// the Plates and Cooling factors, each blade 0.6 to 1.2 of that.
// Growth. An occupancy grid of 1 LED cells, a ring of 256 rows, holds which blade owns each cell. Every step, books are tried at random
// points from 1.5 LED behind the front to 2 ahead of it (0.06 tries per LED of new rock in the plate zone, 0.05 in the random zone), where
// a disc of free cells 2.5 LED across is open and nothing lies in the first 6 LED of a blade's way. A plate-spinifex book is three to five
// parallel blades 4.1 LED apart, square to a shared orientation drawn round upright (K4), each fanned outward a little. A blade is a
// segment growing from its root, one way, mostly downward, 2 to 2.6 LED wide. Its tip moves at 2.6 times the front speed plus 2 LED a
// second but never more than 2 LED ahead of the front, so tips crowd the isotherm and the blades lengthen as it descends. Every half LED the
// tip probes three cells ahead; a cell owned by another blade, the world's edge, its length or the base of the flow stops it for good.
// Light. Each blade's olivine (serpentinized, as in nearly all Archean komatiite, so of low birefringence: retardation 110 to 165 nm) has
// parallel extinction, its slow axis along or across the blade. Polarizer, crystal at angle a, accessory plate at 45 degrees, analyzer:
// the Jones product gives, at wavelength l, with d = 2 pi G / l and dp = 2 pi Gp / l,
//   I = 1/2 - 1/2 cos^2(2a) cos(dp) - 1/4 (sin^2 2a - sin 2a) cos(d - dp) - 1/4 (sin^2 2a + sin 2a) cos(d + dp).
// Each cosine summed against the CIE 1931 colour-matching functions (the multi-lobe fit of Wyman, Sloan and Shirley, 2013) gives a
// colour, so a table over sin 2a and G holds the whole chart. With the red plate (Gp = 525 nm) the glass is magenta, a blade whose slow
// axis lies on the plate's adds (second-order blue), one square to it subtracts (first-order gold), and one parallel to a polarizer goes
// back to magenta, a little darker for the magnetite dust. The polarizer pair turns at 2.3 degrees a second on average, its speed a slow
// random walk that now and then stops it or turns it back, and it lingers where upright blades are brightest; the rock stands still.
// The glass carries a little strain (0 to 14 nm), a slow mottle of tint, and sparse chromite grains drawn as soft dark dots 2 LED across.
// Drawing. The glass from the ring rows, interpolated between rows so the scroll is smooth; the melt under the front a smoother tone,
// darker with depth; then every blade as an anti-aliased capsule, its growing tip tapered, with a faint darker core where serpentine
// dusted the skeletal plate with magnetite.

const W = 64, H = 128;
const FR = 112; // panel row of the mean front
const XL = -8, WX = 80; // the world, LED
const NR = 256, RM = NR - 1; // rows in the ring buffers
const AHEAD = 40; // rows prepared ahead of the front
const LEAD = 2; // how far a tip may run ahead of the front
const PRE = 150; // LED of rock grown above the panel before the first frame
const DUST = 0.9; // the magnetite dust of serpentinization darkens every blade a little, so one at extinction still reads

const { floor, sqrt, exp, sin, cos, min, max, pow, abs, PI } = Math;
const imul = Math.imul;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
const D2R = PI / 180;

// ---- noise
function hv(i, j, k) {
  let h = imul(i, 0x27d4eb2d) ^ imul(j, 0x165667b1) ^ imul(k, 0x5bd1e995);
  h = imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = imul(h, 0xc2b2ae35);
  return ((h >>> 8) & 0xffff) / 32767.5 - 1;
}
function vn2(x, y, k) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hv(xi, yi, k), b = hv(xi + 1, yi, k), c = hv(xi, yi + 1, k), d = hv(xi + 1, yi + 1, k);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx;
  return x0 + (x1 - x0) * fy;
}

// ---- the interference chart: K(R) = sum over the spectrum of cos(2 pi R / l) times the colour-matching functions, in linear sRGB
const KN = 501, KS = 4; // R from 0 to 2000 nm in 4 nm steps
const KT = new Float32Array(KN * 3);
const K0 = [0, 0, 0];
(function chart() {
  const g = (l, m, s1, s2) => {
    const s = l < m ? s1 : s2;
    return exp(-0.5 * ((l - m) / s) ** 2);
  };
  const xb = (l) => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
  const yb = (l) => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
  const zb = (l) => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
  for (let n = 0; n < KN; n++) {
    const R = n * KS;
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 730; l += 5) {
      const c = cos((2 * PI * R) / l);
      X += c * xb(l);
      Y += c * yb(l);
      Z += c * zb(l);
    }
    KT[n * 3] = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    KT[n * 3 + 1] = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    KT[n * 3 + 2] = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  }
  for (let c = 0; c < 3; c++) K0[c] = KT[c];
  for (let n = KN - 1; n >= 0; n--) for (let c = 0; c < 3; c++) KT[n * 3 + c] /= K0[c]; // white balance: R = 0 is white
})();
function kAt(R, c) {
  const r = cl(abs(R) / KS, 0, KN - 1.001), i = r | 0, f = r - i;
  return KT[i * 3 + c] + (KT[i * 3 + 3 + c] - KT[i * 3 + c]) * f;
}
const enc = (v) => (v <= 0 ? 0 : v <= 0.0031308 ? 3294.6 * v : 255 * (1.055 * pow(v, 1 / 2.4) - 0.055));

// ---- the four views. The table runs over s = sin 2a (33 steps) and G (0 to 320 nm, 33 steps), for glass and for olivine
const NS = 33, NG = 33, GMAX = 320;
const VIEWS = [
  { kind: 0, gp: 525, gain: 1.3 }, // first-order red plate
  { kind: 1, gain: 1.9, floor: 0.012 }, // crossed polarizers
  { kind: 2, glass: [0.2, 0.075, 0.026], oliv: [0.42, 0.6, 0.3] }, // plane light, linear
  { kind: 0, gp: 1450, gain: 0.82 }, // compensator near the third-order pink
];
function viewTable(v, crystal) {
  const T = new Float32Array(NS * NG * 3);
  for (let i = 0; i < NS; i++) {
    const s = -1 + (2 * i) / (NS - 1), s2 = s * s, c2 = 1 - s2;
    for (let j = 0; j < NG; j++) {
      const G = (GMAX * j) / (NG - 1), o = (i * NG + j) * 3;
      for (let c = 0; c < 3; c++) {
        let L;
        if (v.kind === 0) L = v.gain * (0.5 - 0.5 * c2 * kAt(v.gp, c) - 0.25 * (s2 - s) * kAt(G - v.gp, c) - 0.25 * (s2 + s) * kAt(G + v.gp, c));
        else if (v.kind === 1) L = v.floor + v.gain * 0.5 * s2 * (1 - kAt(G, c));
        else L = crystal ? v.oliv[c] : v.glass[c] * (1 - 0.004 * G);
        T[o + c] = enc(L);
      }
    }
  }
  return T;
}
const TABLES = VIEWS.map((v) => [viewTable(v, false), viewTable(v, true)]);

// ---- flows: tops and thickness
const CHILL = 9; // selvage and chilled glass under each flow top, LED
function newFlow(top, first) {
  const thick = first ? 470 + 200 * rnd() : 400 + 280 * rnd();
  return { top, end: top + thick, sd: (rnd() * 1e5) | 0 };
}

function makeState() {
  const S = {
    ready: false, t: 0, ks: [0, 2, 0, 0.06], F: 0, phi: 0, pw: 0, seed: (rnd() * 1e6) | 0,
    rowsTo: 0, occ: new Int32Array(WX * NR), mG: new Float32Array(W * NR), mS: new Float32Array(W * NR), mC: new Float32Array(W * NR), mB: new Float32Array(W * NR),
    plates: [], nextId: 1, oxides: [], flows: [],
    lutG: new Float32Array(NS * NG * 3), lutC: new Float32Array(NS * NG * 3), lutAt: -1, view: null,
    buf: new Float32Array(W * H * 3), fcol: new Float32Array(W),
  };
  return S;
}

export function setup(params) {
  params.s = makeState();
}

function knobs(k) {
  const cool = cl(k[1], 0.2, 3), size = cl(k[2], -1, 1), spr = cl(k[3], -1, 1);
  const vF = 0.3 + 0.58 * cool; // LED a second
  const sf = pow(2, spr * 1.2);
  return {
    vF,
    vg: 2.6 * vF + 2,
    rz: CHILL + 12 + 30 * pow(cool / 2, 1.3), // depth of the random zone under a flow top
    lenF: pow(2, size) * pow(2 / cool, 0.45),
    nB: 4.2 * pow(2, 0.55 * size),
    sp: 4.1 + 0.4 * size,
    hw: 1.12 + 0.14 * size,
    sigB: min(70, 22 * pow(sf, 0.8)) * D2R,
    fan: 1.5 * sf * D2R,
    jit: 1.0 * sf * D2R,
    crowd: pow(cool / 2, 0.6),
  };
}

// ---- the world
function frontAt(S, x) {
  const u = S.F / 34;
  return S.F + 2.6 * vn2(x / 15, u, S.seed + 1) + 1.1 * vn2(x / 6, u * 1.7, S.seed + 2);
}
function flowAt(S, y) {
  const f = S.flows;
  for (let i = f.length - 1; i >= 0; i--) if (y >= f[i].top) return f[i];
  return f[0];
}
function initRows(S, upTo) {
  while (S.rowsTo <= upTo) {
    const y = S.rowsTo, r = y & RM;
    S.occ.fill(0, r * WX, r * WX + WX);
    for (let x = 0; x < W; x++) {
      const i = r * W + x, sd = S.seed;
      const a = PI * vn2(x / 11, y / 11, sd + 5) + 0.8 * vn2(x / 4.5, y / 4.5, sd + 6);
      S.mS[i] = sin(2 * a);
      S.mC[i] = cos(2 * a);
      S.mG[i] = 14 * ss(-0.3, 0.9, vn2(x / 8, y / 8, sd + 7));
      S.mB[i] = 1 + 0.05 * vn2(x / 6, y / 6, sd + 8);
    }
    // chromite: sparse soft dots
    if (rnd() < 0.2) S.oxides.push({ x: floor(rnd() * W) + 1, y: y + 1 });
    S.rowsTo++;
  }
  // flows ahead
  let last = S.flows[S.flows.length - 1];
  while (last.end < upTo + 20) {
    last = newFlow(last.end, false);
    S.flows.push(last);
  }
}

function cellOwner(S, x, y) {
  const cx = floor(x - XL), ry = floor(y);
  if (cx < 0 || cx >= WX) return -1;
  if (ry >= S.rowsTo || ry < S.rowsTo - NR) return 0;
  return S.occ[(ry & RM) * WX + cx];
}
function freeDisc(S, x, y, r) {
  const r2 = r * r;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++)
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      if (dx * dx + dy * dy > r2) continue;
      if (cellOwner(S, x + dx, y + dy) !== 0) return false;
    }
  return true;
}
function mark(S, x, y, r, id) {
  const x0 = floor(x - r - XL), x1 = floor(x + r - XL), y0 = floor(y - r), y1 = floor(y + r), r2 = r * r;
  for (let ry = y0; ry <= y1; ry++) {
    if (ry >= S.rowsTo || ry < S.rowsTo - NR) continue;
    const o = (ry & RM) * WX;
    for (let cx = max(0, x0); cx <= min(WX - 1, x1); cx++) {
      const dx = cx + XL + 0.5 - x, dy = ry + 0.5 - y;
      if (dx * dx + dy * dy <= r2 && S.occ[o + cx] === 0) S.occ[o + cx] = id;
    }
  }
}

function addPlate(S, x, y, a, opt, len, hw, g, stopY, kind) {
  if (!freeDisc(S, x, y, hw + 0.4)) return null;
  // a blade that would run into another within a few LED is not started, so gaps do not fill with stubs
  const ux = sin(a), uy = cos(a), run = min(len, 6);
  for (let l = 1.5; l <= run; l += 1.5) if (cellOwner(S, x + ux * l, y + uy * l) !== 0) return null;
  const p = {
    id: S.nextId++, x0: x, y0: y, ux: sin(a), uy: cos(a), len: 0, mk: 0, max: len, hw, a: opt, g, alive: true, stopY, kind,
  };
  mark(S, x, y, hw, p.id);
  S.plates.push(p);
  return p;
}

function nucleate(S, P, x) {
  const y = frontAt(S, x) - 1.5 + rnd() * (LEAD + 1.5);
  const f = flowAt(S, y), d = y - f.top;
  if (d < CHILL || y >= f.end - 3) return;
  const optSide = rnd() < 0.5 ? 0 : PI / 2;
  if (d < P.rz) {
    // random spinifex: ones, twos and threes at any orientation
    if (!freeDisc(S, x, y, 2.2)) return;
    const a = PI * (rnd() - 0.5), n = 1 + floor(rnd() * 2.6), g = 110 + 55 * rnd();
    const L = (6 + 9 * rnd()) * min(2.2, pow(P.lenF, 0.6));
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * P.sp, ak = a + (k - (n - 1) / 2) * P.fan + P.jit * gauss();
      addPlate(S, x + off * cos(a), y - off * sin(a), ak, ak + optSide, L * (0.75 + 0.5 * rnd()), P.hw - 0.08 + 0.1 * rnd(), g + 12 * gauss(), f.end - 3, 0);
    }
    return;
  }
  // plate spinifex: a book of parallel blades
  if (!freeDisc(S, x, y, 2.5)) return;
  const dz = d - P.rz;
  const Lz = min(85, 26 + 0.3 * dz) * P.lenF;
  const a = cl(P.sigB * gauss(), -62 * D2R, 62 * D2R);
  const n = max(2, Math.round(P.nB * (0.75 + 0.5 * rnd()))), g = 110 + 55 * rnd();
  for (let k = 0; k < n; k++) {
    const m = k - (n - 1) / 2, off = m * P.sp;
    const ak = cl(a + m * P.fan + P.jit * gauss(), -70 * D2R, 70 * D2R);
    const st = 1.2 * gauss();
    addPlate(S, x + off * cos(a) + st * sin(a), y - off * sin(a) + st * cos(a), ak, ak + optSide, Lz * (0.6 + 0.6 * rnd()), P.hw + 0.12 * (rnd() - 0.5), g + 10 * gauss(), f.end - 3, 1);
  }
}

function grow(S, p, dl) {
  let target = min(p.max, p.len + dl);
  if (p.uy > 0.05) target = min(target, (frontAt(S, p.x0 + p.ux * p.len) + LEAD - p.y0) / p.uy);
  if (target <= p.len) return;
  // the grid is claimed half a LED at a time, ahead of the drawn tip
  while (p.mk < target) {
    const l = p.mk + 0.5, tx = p.x0 + p.ux * l, ty = p.y0 + p.uy * l;
    const ah = p.hw * 0.5 + 0.8, sx = -p.uy * p.hw * 0.85, sy = p.ux * p.hw * 0.85;
    const o1 = cellOwner(S, tx + p.ux * ah, ty + p.uy * ah), o2 = cellOwner(S, tx + p.ux * 0.4 + sx, ty + p.uy * 0.4 + sy), o3 = cellOwner(S, tx + p.ux * 0.4 - sx, ty + p.uy * 0.4 - sy);
    if (ty > p.stopY || (o1 !== 0 && o1 !== p.id) || (o2 !== 0 && o2 !== p.id) || (o3 !== 0 && o3 !== p.id)) {
      p.alive = false;
      p.len = max(p.len, min(target, p.mk));
      return;
    }
    mark(S, tx, ty, p.hw, p.id);
    p.mk = l;
  }
  p.len = target;
  if (p.len >= p.max - 1e-6) p.alive = false;
}

function step(S, dt) {
  const P = knobs(S.ks);
  const dF = P.vF * dt;
  S.F += dF;
  initRows(S, floor(S.F + AHEAD));
  // grow
  const dl = P.vg * dt;
  const pl = S.plates;
  for (let i = 0; i < pl.length; i++) if (pl[i].alive) grow(S, pl[i], dl);
  // nucleate: tries per LED of front width
  const f = flowAt(S, S.F), d = S.F - f.top;
  const rate = d < P.rz ? 0.05 * P.crowd : 0.06 * P.crowd;
  let tries = rate * WX * dF + rnd() * 0.999;
  // the plate zone also fills gaps where the front runs ahead of every tip
  for (; tries >= 1; tries--) nucleate(S, P, XL + rnd() * WX);
  // forget what has left the panel
  const top = S.F - FR - 4;
  if (pl.length > 600 || (S.t * 10) % 1 < dt * 10) {
    S.plates = pl.filter((p) => p.alive || p.y0 + max(0, p.uy * p.len) + p.hw > top);
    S.oxides = S.oxides.filter((o) => o.y > top - 2);
    while (S.flows.length > 2 && S.flows[1].end < top - 10) S.flows.shift();
  }
  // the polarizers turn, with a wandering speed
  S.pw += (-S.pw / 25) * dt + sqrt((2 / 25) * dt) * gauss();
  S.phi += dt * 2.3 * D2R * (1 + 0.7 * S.pw);
  S.t += dt;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    // pre-roll: the first flow's top lies above the pre-run, and the front grows PRE LED of rock above the panel and the panel itself
    const F0 = -FR - PRE;
    S.F = F0;
    S.flows.push(newFlow(F0 - 16, true));
    S.rowsTo = floor(F0 - 30);
    initRows(S, floor(F0 + AHEAD));
    const P = knobs(S.ks), h = 0.5 / P.vF;
    while (S.F < 0) step(S, min(h, -S.F / P.vF + 1e-6));
    S.t = 0;
    S.phi = (45 + 8 * gauss()) * D2R;
  }
  const e = 1 - exp(-d / 0.3);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  step(S, d);
}

// ---- drawing
function tables(S, hue) {
  if (S.lutAt === hue) return;
  S.lutAt = hue;
  const p = (((hue % 1) + 1) % 1) * 4, i0 = floor(p) % 4, i1 = (i0 + 1) % 4, t = ss(0.25, 0.75, p - floor(p));
  const A = TABLES[i0], B = TABLES[i1];
  for (let i = 0; i < S.lutG.length; i++) {
    S.lutG[i] = A[0][i] + (B[0][i] - A[0][i]) * t;
    S.lutC[i] = A[1][i] + (B[1][i] - A[1][i]) * t;
  }
  // the plane-light share, for the melt and the selvage
  S.view = { pl: (i0 === 2 ? 1 - t : 0) + (i1 === 2 ? t : 0) };
}
function look(T, s, G, out) {
  const fi = (cl(s, -1, 1) + 1) * 0.5 * (NS - 1), fj = cl(G / GMAX, 0, 1) * (NG - 1);
  const i = min(NS - 2, fi | 0), j = min(NG - 2, fj | 0), u = fi - i, v = fj - j;
  const a = (i * NG + j) * 3, b = a + NG * 3;
  for (let c = 0; c < 3; c++) {
    const x0 = T[a + c] + (T[a + 3 + c] - T[a + c]) * v, x1 = T[b + c] + (T[b + 3 + c] - T[b + c]) * v;
    out[c] = x0 + (x1 - x0) * u;
  }
}

const col = [0, 0, 0], mcol = [0, 0, 0];
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  tables(S, S.ks[0]);
  // the turn lingers where upright blades are brightest (45 degrees) and hurries through their extinction
  const ph = S.phi + 0.15 * sin(4 * S.phi);
  const buf = S.buf, c2p = cos(2 * ph), s2p = sin(2 * ph), y0w = S.F - FR;
  for (let x = 0; x < W; x++) S.fcol[x] = frontAt(S, x + 0.5);
  look(S.lutG, 0, 0, mcol); // the melt: no strain
  const pl = S.view.pl;
  for (let c = 0; c < 3; c++) mcol[c] *= 0.9 - 0.15 * pl;
  // glass and melt
  for (let py = 0; py < H; py++) {
    const yw = y0w + py + 0.5, yr = yw - 0.5, r0 = floor(yr), fy = yr - r0;
    const o0 = (r0 & RM) * W, o1 = ((r0 + 1) & RM) * W;
    for (let x = 0; x < W; x++) {
      const i0 = o0 + x, i1 = o1 + x;
      const Sm = S.mS[i0] + (S.mS[i1] - S.mS[i0]) * fy, Cm = S.mC[i0] + (S.mC[i1] - S.mC[i0]) * fy;
      const G = S.mG[i0] + (S.mG[i1] - S.mG[i0]) * fy, B = S.mB[i0] + (S.mB[i1] - S.mB[i0]) * fy;
      look(S.lutG, Sm * c2p - Cm * s2p, G, col);
      const dm = yw - S.fcol[x], m = ss(-1.5, 2.5, dm), md = m * (1 - 0.22 * ss(2, 16, dm)), o = (py * W + x) * 3;
      for (let c = 0; c < 3; c++) buf[o + c] = col[c] * B * (1 - m) + mcol[c] * md;
    }
  }
  // flow tops: a dark selvage
  for (const f of S.flows) {
    const yp = f.top - y0w;
    if (yp < -6 || yp > H + 2) continue;
    for (let py = max(0, floor(yp - 3)); py < min(H, yp + 6); py++)
      for (let x = 0; x < W; x++) {
        const e = yp + 0.9 * vn2(x / 9, f.sd, 3), dy = py + 0.5 - e;
        const k = ss(-1.2, 0.2, dy) * ss(4.2, 2.4, dy) * 0.72, o = (py * W + x) * 3;
        for (let c = 0; c < 3; c++) buf[o + c] *= 1 - k;
      }
  }
  // chromite
  for (const ox of S.oxides) {
    const cx = ox.x, cy = ox.y - y0w;
    if (cy < -2 || cy > H + 2) continue;
    for (let py = max(0, floor(cy - 1.6)); py <= min(H - 1, floor(cy + 1.6)); py++)
      for (let px = max(0, floor(cx - 1.6)); px <= min(W - 1, floor(cx + 1.6)); px++) {
        const dx = px + 0.5 - cx, dy = py + 0.5 - cy, k = 0.5 * cl(1.6 - sqrt(dx * dx + dy * dy), 0, 1), o = (py * W + px) * 3;
        for (let c = 0; c < 3; c++) buf[o + c] *= 1 - k;
      }
  }
  // the blades
  const pc = [0, 0, 0];
  for (const p of S.plates) {
    if (p.len < 0.4) continue;
    const ax = p.x0, ay = p.y0 - y0w, bx = ax + p.ux * p.len, by = ay + p.uy * p.len, hw = p.hw;
    const xa = max(0, floor(min(ax, bx) - hw - 1)), xb = min(W - 1, floor(max(ax, bx) + hw + 1));
    const ya = max(0, floor(min(ay, by) - hw - 1)), yb = min(H - 1, floor(max(ay, by) + hw + 1));
    if (xa > xb || ya > yb) continue;
    look(S.lutC, sin(2 * (p.a - ph)), p.g, pc);
    const sk = p.kind === 1 ? 0.2 : 0;
    for (let py = ya; py <= yb; py++)
      for (let px = xa; px <= xb; px++) {
        const qx = px + 0.5 - ax, qy = py + 0.5 - ay;
        const t = cl(qx * p.ux + qy * p.uy, 0, p.len), dx = qx - p.ux * t, dy = qy - p.uy * t;
        const dd = sqrt(dx * dx + dy * dy);
        const he = p.alive ? hw * min(1, 0.45 + 0.22 * (p.len - t)) : hw;
        const cv = cl(he + 0.5 - dd, 0, 1);
        if (cv <= 0) continue;
        const core = 1 - sk * exp(-dd * dd * 3);
        const o = (py * W + px) * 3;
        for (let c = 0; c < 3; c++) buf[o + c] += (pc[c] * core * DUST - buf[o + c]) * cv;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[o], 0, 255) | 0, cl(buf[o + 1], 0, 255) | 0, cl(buf[o + 2], 0, 255) | 0);
    }
}
