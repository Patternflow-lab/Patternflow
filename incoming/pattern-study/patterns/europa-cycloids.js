// ===== Patternflow pattern =====
// Title:   Cycloidal Ridges
// Family:  cycloidlineae
// Idea:    Seen from straight above, cracks creep across a milky blue-white plain of Europa's ice, each tip lurching forward only while the tide pulls hard enough and turning with the tide's direction, so every crack is a chain of arcs joined at sharp cusps, a dark furrow between two bright ridges that is white and slate blue at its tip and goes rust-brown and then fades behind it.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the cycloidal ridges and lineae of Europa, which Hoppa, Greenberg and co-workers (1999, from memory) read as cracks that grow only while the daily tide in the ice shell is above the ice's tensile strength and run perpendicular to the strongest pull, which turns as the moon goes round its 3.55 day orbit, so that the crack curves, stops, and starts again at a cusp; Hurford and co-workers (2007, from memory) added the shell's slow spin to the model and Lee, Pappalardo and Makris (2005, from memory) the mechanics of such tide-driven fractures. Original code, pattern round 263: each tip is integrated from a tension that rises and falls once a cycle, and the double ridge is drawn from the distance to the crack's path.
// Round:   263
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tide=0..4, Arc=-1..1, Cracks=-1..1
//
// Knob 1: Hue. Turns every colour once round the wheel over the knob's travel, so 1 is 0 again. At 0 the plain is milky blue-white (152, 170, 190), the fresh ridges white, the fresh furrows slate blue (58, 84, 140), and the old furrows rust (134, 56, 34) with tan ridges (204, 146, 114); at 0.25 the plain is pink with green cracks, at 0.5 sand with teal ones, at 0.75 mint with violet ones.
// Knob 2: Tide. How fast the tide goes round, 0 to 4, opening at 2. The period is 13 s at 2, 28 s at 0 and 6.1 s at 4. A tip moves for 34 to 46 percent of each period and rests the rest, and at the middle of its window it moves 8 LEDs a second at 2, 3.8 at 0 and 17 at 4, so an arc is the same length at every setting and only the pace changes. The bands of light that cross the plain keep the same clock.
// Knob 3: Arc. How far a tip gets in one tide, signed, opening at 0. The arc's chord is 26 LEDs at 0, 15 at -1 and 44 at +1, so at -1 the cracks are tight scallops and at +1 a few wide sweeps with loops. Each crack carries its own 0.75 to 1.3 times that and each tide adds 0.6 to 1.4 times more, so large and small arcs mix in one chain, and the double ridge is 0.9 times as wide at -1 and 1.1 times at +1.
// Knob 4: Cracks. How many cracks are growing at once, signed, opening at 0.06: 3 at -1, 4 at 0.06 and 6 at +1. The length a crack keeps goes as 1000 over one more than that number, 250 LEDs at 3, 200 at 4 and 143 at 6, so with more cracks each is shorter and its tail fades and goes sooner.

// What the picture is. The panel is a patch of Europa's ice shell seen from straight above with the sun low at the upper left. The plain is a pale blue-white albedo mottled by two soft noises of 24 and 10 LEDs and a faint grain stretched along
// one direction, with tan patches where the ice is dirtier, and it does not move. Two bands of light cross it, the first on the tidal clock along a line 28 degrees off the long axis, 84 LEDs from crest to crest, from 3.5 percent darker to 6.5
// percent lighter, the second at 1.618 times the rate across the first and 58 LEDs apart, plus or minus 2.5 percent. They are the shell flexing, and the second keeps the plain from being the same twice in one tide.
// A crack is a tip and the points it has left, about one a LED. Each tip has a tidal clock of its own, u in cycles, and the tension is a bump once a cycle: the tip grows only in a window of 34 to 46 percent of the cycle. Over the window the
// speed is (pi / 2) sin(pi nu) for nu from 0 to 1, scaled so that the window adds exactly one arc length. The heading is the arc's chord direction plus the turning angle times (s - 0.5), where s is the share of the arc done, so the arc
// is circular, with a turning angle of 103 to 138 degrees that varies 16 percent from arc to arc, a radius of about 15 LEDs at the opening, and a speed that goes to nothing at its two ends. At the next window the heading jumps back by the
// turning angle: that is the cusp, about 40 to 75 degrees across, and every cusp points the same side. The chord direction wanders 0.2 rad an arc and bends 0.05 rad, so a chain is not a straight line.
// A crack starts off the edge of the panel and grows in (45 percent of them), or on the ice with the longest free run of seven tries, at the best of 14 starts for room along a straight path 100 LEDs long, with its window just opening so the first
// thing seen is a tip lurching out. A new one starts 0.12 to 0.42 tide after the last when fewer are growing than the knob says. A crack stops when its tip is 6 LEDs past an edge, at 320 LEDs, or when more are growing than the knob says (the
// longest runner stops), and after that it goes by time alone. Its tip carries a pale cyan glow about 4 LEDs across at half height that follows the speed, 0.2 at rest.
// The picture is drawn per pixel from the distance d to the nearest part of the crack and how far behind the tip that part is, and the crack is its own layer: a newer crack paints over an older one where they cross. The furrow is
// exp(-(d / 0.75)^2) and each ridge exp(-((d - 1.8) / 1.0)^2), a ridge 1.7 LEDs wide at half height and the whole double ridge about 6 across, which narrows to 0.3 of that and fades to 0.55 over the last 7 LEDs before the tip. The age of a point is its distance behind the tip over the
// length the Cracks knob lets it keep, plus the seconds since it was laid over 280, plus the tides since the crack stopped over 2.2. From 0.06 the stain (ridge white to tan, furrow slate to rust) comes in and is full at 0.55, relief and colour are
// whole to 0.5 and fall to 0.35 at 0.95, a ghost of an old scar, and are gone at 1.4. At the opening that is 9 LEDs behind the tip for the first stain, 82 for the full rust and 208 for the end. The relief, ridge minus 0.85 of the furrow, is lit
// from the upper left by its slope, so one flank of every ridge is brighter and the colour is multiplied by 0.62 to 1.38.
// The first update runs 9.5 tides of the cracks, and up to 30 more until five of the panel's eight 32 x 32 cells hold 10 LEDs of plainly visible crack, so that cracks of every age are there on the first frame.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, min, max, PI, atan2, round, ceil } = Math;
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

// ---- profiles and colours
const RMAX = 4.6, NL = 200, LK = (NL - 1) / RMAX;
const LUT_T = new Float32Array(NL), LUT_R = new Float32Array(NL);
for (let i = 0; i < NL; i++) {
  const d = i / LK;
  LUT_T[i] = exp(-((d / 0.75) * (d / 0.75)));
  LUT_R[i] = exp(-(((d - 1.8) / 1.0) * ((d - 1.8) / 1.0)));
}
const PLAIN = [152, 170, 190], TAN = [190, 168, 146];
const TR_F = [58, 84, 140], TR_A = [134, 56, 34]; // furrow, fresh and rusted
const RG_F = [246, 250, 255], RG_A = [204, 146, 114]; // ridge, fresh and rusted
const GLOW = [176, 232, 255];
const LIGHT = [-0.55, -0.83];
const TIDES_PRE = 9.5, TDIE = 2.2, HAND = 1, SHEEN = 0.1, AEND = 1.4, TW = 280;

function buildPlain(S) {
  const P = S.plain;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n1 = vnoise(x / 24 + 3.7, y / 24 + 1.3, 1), n2 = vnoise(x / 10 + 9.1, y / 10 + 4.4, 2);
      const u = x * 0.46 + y * 0.89, v = -x * 0.89 + y * 0.46;
      const n3 = vnoise(u / 3.4 + 2, v / 22 + 5, 3), n4 = vnoise(x / 28 + 11, y / 34 + 2, 4);
      const lum = 1.06 + 0.3 * (n1 - 0.5) + 0.16 * (n2 - 0.5) + 0.1 * (n3 - 0.5);
      const rose = sm(0.5, 0.78, n4) * 0.3;
      const k = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) P[k + c] = mix(PLAIN[c], TAN[c], rose) * lum;
      S.PH2[y * W + x] = (-x * 0.8 + y * 0.6) / 58 + 0.5 * (n2 - 0.5);
      S.PH[y * W + x] = (x * 0.47 + y * 0.88) / 84 + 0.55 * (n1 - 0.5) + 0.25 * (n2 - 0.5);
    }
  }
}

function makeState() {
  const S = {
    t: 0, cyc: 0, ready: false, cool: 0, cracks: [], nid: 1,
    P: 16, L: 24, N: 4, V: 112, Vt: 112, hue: 0,
    plain: new Float32Array(NPX * 3), PH: new Float32Array(NPX), PH2: new Float32Array(NPX),
    T: new Float32Array(NPX), R: new Float32Array(NPX), ST: new Float32Array(NPX), HH: new Float32Array(NPX), GL: new Float32Array(NPX),
    DM: new Float32Array(NPX).fill(1e9), SM: new Float32Array(NPX), TM: new Float32Array(NPX), touched: [],
  };
  buildPlain(S);
  return S;
}

export function setup(params) {
  params.s = makeState();
}

function readKnobs(S, kn) {
  S.hue = cl(kn[0], 0, 1);
  S.P = 13 * Math.pow(2, (2 - cl(kn[1], 0, 4)) * 0.55);
  S.L = 26 * Math.pow(1.7, cl(kn[2], -1, 1));
  S.N = cl(round(4.3 + 1.8 * cl(kn[3], -1, 1)), 3, 6);
  S.ws = cl(0.75 + 0.25 * S.L / 26, 0.82, 1.12);
  S.Vt = cl(1000 / (S.N + 1), 100, 280);
}

// ---- the cracks
function inRun(x, y, th) {
  const dx = cos(th), dy = sin(th);
  let tm = 400;
  if (dx > 1e-6) tm = min(tm, (W - x) / dx); else if (dx < -1e-6) tm = min(tm, -x / dx);
  if (dy > 1e-6) tm = min(tm, (H - y) / dy); else if (dy < -1e-6) tm = min(tm, -y / dy);
  return tm;
}

function spawn(S) {
  let bx = 0, by = 0, bz = 0, bs = -1;
  for (let tr = 0; tr < 14; tr++) {
    let x, y, z;
    if (rnd() < 0.45) {
      const e = rnd();
      if (e < 0.34) { x = rnd() * W; y = -7; }
      else if (e < 0.68) { x = rnd() * W; y = H + 7; }
      else if (e < 0.84) { x = -7; y = rnd() * H; }
      else { x = W + 7; y = rnd() * H; }
      z = atan2(20 + 88 * rnd() - y, 10 + 44 * rnd() - x) + (rnd() - 0.5) * 0.5;
    } else {
      x = 8 + 48 * rnd(); y = 10 + 108 * rnd();
      let br = -1;
      for (let k = 0; k < 7; k++) {
        const zz = rnd() * TAU, r = inRun(x, y, zz);
        if (r > br) { br = r; z = zz; }
      }
    }
    let dm = 40;
    for (let k = 0; k <= 8; k++) {
      const qx = x + cos(z) * k * 12, qy = y + sin(z) * k * 12;
      if (qx < -4 || qx > W + 4 || qy < -4 || qy > H + 4) continue;
      for (const c of S.cracks) {
        for (let i = c.i0; i < c.px.length; i += 2) {
          const dx = c.px[i] - qx, dy = c.py[i] - qy, d = sqrt(dx * dx + dy * dy);
          if (d < dm) dm = d;
        }
      }
    }
    if (dm > bs) { bs = dm; bx = x; by = y; bz = z; }
  }
  const w = 0.34 + 0.12 * rnd();
  const c = {
    id: S.nid++, born: S.t, x: bx, y: by, s: 0, px: [bx], py: [by], ps: [0], pt: [S.t], i0: 0,
    zeta: bz, bend: (rnd() - 0.5) * 0.1, dth0: 1.8 + 0.6 * rnd(), cs: 0.75 + 0.55 * rnd(),
    w, fw0: rnd() * (1 - w), u: 0, k: 0, open: false, nu: -1, fL: 1, dth: 1.8, stop: -1, entered: false,
    p1: rnd() * TAU, p2: rnd() * TAU, p3: rnd() * TAU,
  };
  c.u = c.fw0 + 1e-4;
  S.cracks.push(c);
}

function startArc(S, c) {
  c.k++;
  const k = c.k;
  c.fL = c.cs * (1 + 0.25 * sin(1.3 * k + c.p1) + 0.12 * sin(2.9 * k + c.p2));
  c.dth = c.dth0 * (1 + 0.16 * sin(0.85 * k + c.p3));
  if (k > 1) c.zeta += (rnd() - 0.5) * 0.4 + c.bend;
}

function grow(S, c, h) {
  c.u += h / S.P;
  const f = c.u - floor(c.u);
  if (f < c.fw0 || f >= c.fw0 + c.w) { c.open = false; c.nu = -1; return; }
  const nu = (f - c.fw0) / c.w;
  if (!c.open) { c.open = true; startArc(S, c); }
  const g = 1.5708 * sin(PI * nu);
  const ds = S.L * c.fL * g * (h / S.P / c.w);
  const th = c.zeta + HAND * c.dth * (0.5 - 0.5 * cos(PI * nu) - 0.5);
  c.x += ds * cos(th); c.y += ds * sin(th); c.s += ds;
  c.nu = nu;
  const n = c.px.length, dx = c.x - c.px[n - 1], dy = c.y - c.py[n - 1];
  if (dx * dx + dy * dy >= 0.81) { c.px.push(c.x); c.py.push(c.y); c.ps.push(c.s); c.pt.push(S.t); }
  const inside = c.x > -3 && c.x < W + 3 && c.y > -3 && c.y < H + 3;
  if (inside) c.entered = true;
  if ((c.entered && (c.x < -6 || c.x > W + 6 || c.y < -6 || c.y > H + 6)) || c.s > 320 || (!c.entered && c.k > 7)) c.stop = S.cyc;
}

function step(S, h) {
  S.t += h;
  S.cyc += h / S.P;
  S.cool -= h / S.P;
  let act = 0, long = null;
  for (const c of S.cracks) {
    if (c.stop < 0) { act++; if (!long || c.s > long.s) long = c; }
  }
  if (act > S.N && long) { long.stop = S.cyc; act--; }
  else if (act < S.N && S.cool <= 0) { spawn(S); S.cool = 0.12 + 0.3 * rnd(); }
  for (const c of S.cracks) if (c.stop < 0) grow(S, c, h);
  for (let i = S.cracks.length - 1; i >= 0; i--) {
    const c = S.cracks[i];
    const tAdd = c.stop >= 0 ? (S.cyc - c.stop) / TDIE : 0;
    const n = c.px.length;
    while (c.i0 < n && (c.s - c.ps[c.i0]) / S.V + (S.t - c.pt[c.i0]) / TW + tAdd >= AEND + 0.02) c.i0++;
    if (c.i0 > 80) { c.px.splice(0, c.i0); c.py.splice(0, c.i0); c.ps.splice(0, c.i0); c.pt.splice(0, c.i0); c.i0 = 0; }
    if (c.stop >= 0 && c.i0 >= c.px.length) S.cracks.splice(i, 1);
  }
}

// how many of the panel's eight 32 x 32 cells hold at least 10 LEDs of crack that is still plainly there
function spread(S) {
  const cell = new Array(8).fill(0);
  for (const c of S.cracks) {
    for (let i = c.i0; i < c.px.length; i++) {
      const x = c.px[i], y = c.py[i];
      if (x >= 0 && x < W && y >= 0 && y < H && (c.s - c.ps[i]) / S.V + (S.t - c.pt[i]) / TW < 0.6) cell[floor(x / 32) + 2 * floor(y / 32)]++;
    }
  }
  let n = 0;
  for (let i = 0; i < 8; i++) if (cell[i] >= 10) n++;
  return n;
}

function advance(S, dt) {
  const n = max(1, ceil(dt / (S.P / 170)));
  const h = dt / n;
  for (let i = 0; i < n; i++) step(S, h);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  readKnobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.ready) {
    S.ready = true;
    S.V = S.Vt;
    const h = S.P / 160;
    for (let i = 0; i < TIDES_PRE * 160; i++) step(S, h);
    // if the cracks of that moment crowd into a corner, let a few more tides go by
    for (let k = 0; k < 60 && spread(S) < 5; k++) for (let i = 0; i < 80; i++) step(S, h);
  }
  S.V += (S.Vt - S.V) * (1 - exp(-d / 2));
  advance(S, d);
}

// ---- drawing
function rasterCrack(S, c) {
  const { DM, SM, TM, touched, T, R, ST } = S;
  const n = c.px.length, V = S.V;
  touched.length = 0;
  for (let i = c.i0; i < n; i++) {
    const ax = c.px[i], ay = c.py[i], as = c.ps[i], at = c.pt[i];
    const last = i === n - 1;
    const bx = last ? c.x : c.px[i + 1], by = last ? c.y : c.py[i + 1], bs = last ? c.s : c.ps[i + 1], bt = last ? S.t : c.pt[i + 1];
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    const x0 = max(0, floor(min(ax, bx) - RMAX)), x1 = min(W - 1, floor(max(ax, bx) + RMAX));
    const y0 = max(0, floor(min(ay, by) - RMAX)), y1 = min(H - 1, floor(max(ay, by) + RMAX));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        const t = l2 > 1e-9 ? cl((px * ex + py * ey) / l2, 0, 1) : 0;
        const qx = px - t * ex, qy = py - t * ey, d2 = qx * qx + qy * qy;
        if (d2 > RMAX * RMAX) continue;
        const p = y * W + x, dm = DM[p];
        if (dm > 1e8) { touched.push(p); DM[p] = d2; SM[p] = as + t * (bs - as); TM[p] = at + t * (bt - at); }
        else if (d2 < dm) { DM[p] = d2; SM[p] = as + t * (bs - as); TM[p] = at + t * (bt - at); }
      }
    }
  }
  const tAdd = c.stop >= 0 ? (S.cyc - c.stop) / TDIE : 0;
  for (let q = 0; q < touched.length; q++) {
    const p = touched[q];
    const d = sqrt(DM[p]), dT = c.s - SM[p];
    DM[p] = 1e9;
    const a = dT / V + (S.t - TM[p]) / TW + tAdd;
    if (a >= AEND) continue;
    const tp = dT < 7 ? sm(0, 7, dT) : 1;
    const li = d / (S.ws * (0.3 + 0.7 * tp)) * LK;
    if (li >= NL - 1) continue;
    const i0 = li | 0, fr = li - i0;
    const str = (1 - 0.65 * sm(0.5, 0.95, a) - 0.35 * sm(0.95, AEND, a)) * (0.55 + 0.45 * tp);
    const pt = (LUT_T[i0] + (LUT_T[i0 + 1] - LUT_T[i0]) * fr) * str;
    const pr = (LUT_R[i0] + (LUT_R[i0 + 1] - LUT_R[i0]) * fr) * str;
    const b = min(1, max(pt, pr) * 1.8);
    T[p] += (pt - T[p]) * b;
    R[p] += (pr - R[p]) * b;
    ST[p] += (sm(0.06, 0.55, a) - ST[p]) * b;
  }
}

function hueMatrix(h) {
  const a = cos(TAU * h), b = sin(TAU * h);
  return [
    0.213 + a * 0.787 - b * 0.213, 0.715 - a * 0.715 - b * 0.715, 0.072 - a * 0.072 + b * 0.928,
    0.213 - a * 0.213 + b * 0.143, 0.715 + a * 0.285 + b * 0.14, 0.072 - a * 0.072 - b * 0.283,
    0.213 - a * 0.213 - b * 0.787, 0.715 - a * 0.715 + b * 0.715, 0.072 + a * 0.928 + b * 0.072,
  ];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (!S.ready) update(0, { knobValues: [0, 2, 0, 0.06] }, params);
  const { T, R, ST, HH, GL, plain, PH, PH2 } = S;
  T.fill(0); R.fill(0); ST.fill(0); GL.fill(0);
  const order = S.cracks.slice().sort((a, b) => a.born - b.born);
  for (const c of order) rasterCrack(S, c);
  // the tips glow while the tide pulls
  for (const c of order) {
    if (c.stop >= 0) continue;
    const act = c.nu >= 0 ? 0.25 + 0.75 * sin(PI * c.nu) : 0.2;
    const x0 = max(0, floor(c.x - 6)), x1 = min(W - 1, floor(c.x + 6)), y0 = max(0, floor(c.y - 6)), y1 = min(H - 1, floor(c.y + 6));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - c.x, dy = y + 0.5 - c.y;
        GL[y * W + x] += act * 0.75 * exp(-(dx * dx + dy * dy) / 7);
      }
    }
  }
  for (let p = 0; p < NPX; p++) HH[p] = R[p] - 0.85 * T[p];
  const M = hueMatrix(S.hue);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, k = p * 3;
      const bd = 0.5 + 0.5 * cos(TAU * (S.cyc - PH[p])), b2 = 0.5 + 0.5 * cos(TAU * (S.cyc * 1.618 - PH2[p])), sv = SHEEN * (bd * bd - 0.35) + 0.05 * (b2 - 0.5);
      let r = plain[k] * (1 + sv * 0.8), g = plain[k + 1] * (1 + sv), b = plain[k + 2] * (1 + sv * 1.25);
      const t = T[p], rr = R[p];
      if (t > 0.002 || rr > 0.002) {
        const s = ST[p], sum = t + rr, nk = sum > 1 ? 1 / sum : 1, wt = t * nk, wr = rr * nk;
        const tr = mix(TR_F[0], TR_A[0], s), tg = mix(TR_F[1], TR_A[1], s), tb = mix(TR_F[2], TR_A[2], s);
        const gr = mix(RG_F[0], RG_A[0], s), gg = mix(RG_F[1], RG_A[1], s), gb = mix(RG_F[2], RG_A[2], s);
        r += wt * (tr - r) + wr * (gr - r);
        g += wt * (tg - g) + wr * (gg - g);
        b += wt * (tb - b) + wr * (gb - b);
        const hx = HH[y * W + min(W - 1, x + 1)] - HH[y * W + max(0, x - 1)];
        const hy = HH[min(H - 1, y + 1) * W + x] - HH[max(0, y - 1) * W + x];
        const sh = cl(1 - 0.34 * (hx * LIGHT[0] + hy * LIGHT[1]), 0.62, 1.38);
        r *= sh; g *= sh; b *= sh;
      }
      const gl = GL[p];
      if (gl > 0.003) {
        const q = min(1, gl);
        r += (GLOW[0] - r) * q; g += (GLOW[1] - g) * q; b += (GLOW[2] - b) * q;
      }
      const R2 = M[0] * r + M[1] * g + M[2] * b, G2 = M[3] * r + M[4] * g + M[5] * b, B2 = M[6] * r + M[7] * g + M[8] * b;
      display.setPixel(x, y, cl(R2, 0, 255) | 0, cl(G2, 0, 255) | 0, cl(B2, 0, 255) | 0);
    }
  }
}
