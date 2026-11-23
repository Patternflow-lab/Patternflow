// ===== Patternflow pattern =====
// Title:   Layer Pass
// Family:  fdmprint
// Idea:    A nozzle seen from above and a little aslant draws a part one layer at a time, laying a two-LED bead that is white-yellow where it was just laid and cools over a few seconds to the filament's colour, which shifts in hue and brightness across each layer like a silk filament, tracing two perimeter loops of a slowly changing outline and then filling it with lines at plus and minus 45 degrees, a wavy gyroid, concentric loops, a honeycomb or a grid, with a run of tight solid layers now and then, while every finished layer steps one LED down and aslant and dims, so that the layers below stand behind it as a fading stack, until the part is done, fades, and a different one begins.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: fused deposition modelling, a bead of melted filament laid by a moving nozzle layer on layer (Scott Crump, patent of 1989, from memory), perimeters as offset curves of the outline and infill clipped to the inside as a slicer does it (from memory), the offset taken from a signed distance field and its contour traced by marching squares (William Lorensen and Harvey Cline, 1987, from memory), the gyroid, a triply periodic minimal surface whose sections are the wavy infill (Alan Schoen, 1970, from memory), the honeycomb of regular hexagons, pattern round 227
// Round:   227
// ===============================
// @matrix 64x128
// @knobs Filament=0..1, Speed=0..3, Infill=-1..1, Twist=0..1
//
// Knob 1: Filament. The colour of the plastic, once round the hue circle: the layers run from green to azure at 0 where it opens, cyan to blue at 0.1, blue to violet at 0.25, pink to red at 0.45, orange at 0.6, yellow-green at 0.75, and back at 1. Each layer's hue is a little off the last, within about 0.14 of the circle either way, and each layer has a sheen of its own: along a direction and wavelength it draws for itself, its hue swings 0.05 of the circle and its brightness 24 percent. The glow of a fresh bead is white, yellow and orange whatever the plastic is.
// Knob 2: Speed. The head speed in LEDs a second, 20 at 0, 61 at 0.5, 88 at 1, 142 where it opens at 2, and 200 at 3, with each layer drawing 0.8 to 1.25 of it. A layer of this part takes 10 seconds on average at 142 with a spacing of 7, 21 seconds at 61 and 7 seconds at 200. The bead cools in 1.3 seconds whatever the speed, so the white-to-yellow stretch behind the nozzle is about 16 LEDs long at 20 and 160 at 200.
// Knob 3: Infill. The distance between infill lines, centre to centre: 4 LEDs at -1, where the beads are 1.8 LEDs apart and the layer is nearly solid, 6.9 at 0 where it opens, and 12 at +1, a sparse lattice; each layer draws 0.88 to 1.12 of it, and never under 4. A turn re-slices the layer being printed from where the nozzle stands, and the next layers follow it.
// Knob 4: Twist. How much the part wanders from layer to layer. At 0 it is nearly a plain tower: the outline ripples by under 1 percent, the profile swells and narrows by about a tenth of the width, each layer stands 1.5 LEDs off the last and 5 percent wider or narrower, and the stack steps 1.0 LED a layer. At 1 the ripples are up to 10 percent and turn up to 0.26 radian a layer, lobes swing by up to 1.5 radian, the profile swells and narrows by a third, the whole part leans 5 LEDs to either side, a layer stands 4.5 LEDs off the last, and the stack steps 1.9 LEDs a layer.

const W = 64, H = 128, N = W * H, GW = W + 1, GH = H + 1, GN = GW * GH;
const { floor, ceil, sqrt, exp, log, sin, cos, pow, abs, min, max, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fract = (v) => v - floor(v);

const SEED = 227227;
const BEAD_R = 1.1;     // LEDs, so the bead is 2.2 wide
const DIM = 0.8;        // what a finished layer keeps of its brightness
const W1 = 1.2, W2 = 3.5; // the outer and inner perimeter, LEDs inside the outline (one bead and a bit apart)
const CLIP = 3.0;       // infill stops here, inside the inner perimeter's bead
const NP = 110;         // points on an outline
const TRAVEL = 480;     // LEDs a second for a move that lays nothing
const T_CHANGE = 0.6, T_GLIDE = 0.5; // the pause between layers, and the part of it the stack takes to step down
const T_FIN = 2.4, T_FADE = 0.7, T_IN = 1.6; // a finished part fades out (time constant T_FADE) while the next comes in over T_IN
const TAU_HEAT = 1.3;   // s, the time constant of the bead cooling
const PRE_LAYERS = 8;   // layers already laid when the panel opens
const MULT = [0.95, 1, 1, 1]; // speed of outer wall, inner wall, infill, solid layer
const PRINT = 0, MOVE = 1, CHANGE = 2, FINISH = 3;
const FAMS = 5;         // rectilinear, gyroid, concentric, honeycomb, grid
const SOLID_S = 3;      // line spacing of a solid layer

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsv(h, s, v, o, i) {
  h = fract(h) * 6;
  const k = floor(h), f = h - k, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][k % 6];
  o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2];
}

// The heat of a bead, 0 cold to 1 just laid, as a colour and how much of it replaces the filament's own.
const HEAT = [[0, 1, 0.22, 0.02], [0.3, 1, 0.45, 0.06], [0.55, 1, 0.72, 0.18], [0.8, 1, 0.92, 0.55], [1, 1, 0.99, 0.9]];

export function setup(P) {
  P.ready = false;
  P.rand = rng(SEED);
  P.dep = new Float32Array(N);   // how much plastic is there, 1 for the layer being laid, then DIM per layer
  P.tone = new Float32Array(N);  // which hue the layer that laid it had
  P.lid = new Float32Array(N);   // which layer laid it, counted over all objects
  P.sid = 0;
  P.heat = new Float32Array(N);
  P.tmp = new Float32Array(N);
  P.sdf = new Float32Array(GN);  // distance to the outline, positive inside
  P.fld = new Float32Array(GN);  // the gyroid
  P.ux = new Float64Array(NP); P.uy = new Float64Array(NP);
  P.ox = new Float64Array(NP); P.oy = new Float64Array(NP);
  P.cs1 = new Int32Array(2 * GN); P.cs2 = new Int32Array(2 * GN);
  P.sl0 = new Int32Array(2 * GN); P.sl1 = new Int32Array(2 * GN);
  P.used = new Uint8Array(2 * GN);
  P.ramp = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const h = i / 255;
    let k = 0;
    while (k < HEAT.length - 2 && h > HEAT[k + 1][0]) k++;
    const a = HEAT[k], b = HEAT[k + 1], u = cl((h - a[0]) / (b[0] - a[0]), 0, 1);
    for (let c = 0; c < 3; c++) P.ramp[i * 4 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * u;
    P.ramp[i * 4 + 3] = smooth((h - 0.02) / 0.45);
  }
  P.fil = new Float32Array(64 * 3);
  P.out = new Float32Array(N * 3);
  P.k1 = 0; P.k2 = 2; P.k3 = 0; P.w = 0.06;
  P.hist = { shape: [], fam: [], prof: [] };
  P.objN = 0;
  P.strokes = [];
  P.mode = CHANGE; P.pend = false;
  P.gix = 0; P.giy = 0; P.gdim = 1;
  P.nx = 32; P.ny = 64; P.nozA = 0; P.flash = 0;
  P.rph = [0, 0, 0];
  P.accx = 0; P.accy = 0;
  P.gd = new Float32Array(N); P.gt = new Float32Array(N); P.gh = new Float32Array(N); // the finished part, while it fades
  P.ft = -1; P.v0 = 100;
  P.ct = 0; P.layerT = 0; P.lastLayerT = 10; P.planT = 0;
}

// ---------- the part: one object is a shape family, a profile, an infill and a seed for everything that wanders ----------

function newObject(P) {
  const r = P.rand, hist = P.hist;
  const pick = (n, h) => {
    let k = floor(r() * n);
    for (let t = 0; t < 12 && h.includes(k); t++) k = floor(r() * n);
    h.unshift(k);
    h.length = min(h.length, 2);
    return k;
  };
  const o = { n: P.objN++ };
  o.shape = pick(4, hist.shape);
  o.fam = pick(FAMS, hist.fam);
  o.prof = pick(5, hist.prof);
  if (o.n === 0) { o.shape = 0; o.fam = 0; o.prof = 0; hist.shape = [0]; hist.fam = [0]; hist.prof = [0]; }
  o.sn = 3 + 2 * r();                       // superellipse exponent
  o.k = o.shape === 1 ? 3 + floor(r() * 4) : 2 + floor(r() * 5);
  o.a0 = o.shape === 1 ? (r() < 0.5 ? 0 : PI / o.k) : r() < 0.5 ? 0 : PI; // symmetric about the long axis
  o.pe = 4 + 9 * r();                           // how round the polygon corners are
  o.amp = 0.06 + 0.09 * r();
  o.bn = 2 + 1.6 * r();
  o.hm = [0, 0, 0, 0, 0];
  o.hp = [0, 0, 0, 0, 0];
  for (let m = 0; m < 5; m++) { o.hm[m] = m + 2; o.hp[m] = TAU * r(); }
  o.ha = 0.035 + 0.05 * r();
  o.ra = [(0.7 + 0.6 * r()), 0.7 * (0.7 + 0.6 * r()), 0.5 * (0.7 + 0.6 * r())];
  o.rm = [5 + floor(r() * 3), 8 + floor(r() * 3), 11 + floor(r() * 3)];
  o.rp = [TAU * r(), TAU * r(), TAU * r()];
  o.rr = [0.06 + 0.1 * r(), 0.1 + 0.1 * r(), 0.13 + 0.1 * r()].map((v) => (r() < 0.5 ? -v : v));
  o.tw = (r() < 0.5 ? -1 : 1) * (0.6 + 0.8 * r());
  o.pf = 1.5 + 1.7 * r(); o.pp = TAU * r();
  o.f1 = 1.3 + 2.4 * r(); o.p1 = TAU * r();
  o.f2 = 4.1 + 3.2 * r(); o.p2 = TAU * r();
  o.W = 54 + 6 * r(); o.H = 115 + 8 * r();
  o.ox = (r() - 0.5) * 3; o.oy = (r() - 0.5) * 3;
  o.q1 = TAU * r(); o.q2 = TAU * r(); o.q3 = TAU * r();
  o.sa = (r() < 0.5 ? -1 : 1) * (0.35 + 0.55 * r());
  o.t1 = TAU * r(); o.t2 = TAU * r();
  o.ang = [PI / 4, PI / 4, PI / 4, PI / 6, PI / 3, 0][floor(r() * 6)];
  o.ga = TAU * r(); o.gx = TAU * r(); o.gy = TAU * r(); o.gz = 0.2 + 0.22 * r(); o.gp = TAU * r();
  o.hr = TAU * r(); o.c1 = r(); o.c2 = r(); o.c3 = r();
  o.nl = 40 + floor(r() * 31);
  o.solid = new Uint8Array(o.nl);
  o.solid[0] = 1;
  for (let i = o.nl - 3; i < o.nl; i++) o.solid[i] = 1;
  for (let k = 13 + floor(r() * 6); k < o.nl - 5; ) {
    const run = 1 + floor(r() * 2.5);
    for (let i = 0; i < run; i++) o.solid[k + i] = 1;
    k += run + 6 + floor(r() * 9);
  }
  P.obj = o;
  P.layer = 0;
  P.rph = [0, 0, 0];
  P.accx = 0; P.accy = 0;
  P.aoff = 0;
}

function profile(o, zf) {
  let p;
  switch (o.prof) {
    case 0: p = 0.78 + 0.22 * sin(PI * (0.12 + 0.76 * zf)); break;      // a vase with its belly in the middle
    case 1: p = 0.66 + 0.34 * smooth(zf * 1.15); break;                  // it flares
    case 2: p = 1 - 0.3 * pow(zf, 1.3); break;                           // it tapers
    case 3: p = 1 - 0.3 * pow(sin(PI * zf), 1.6); break;                 // it has a waist
    default: p = 0.86 + 0.14 * sin(TAU * o.pf * zf + o.pp);              // a rippled column
  }
  return p + 0.045 * sin(TAU * o.f1 * zf + o.p1) + 0.03 * sin(TAU * o.f2 * zf + o.p2);
}

const superR = (th, n) => pow(pow(abs(cos(th)), n) + pow(abs(sin(th)), n), -1 / n);

// The radius of the unit shape at angle th.
function baseR(o, th) {
  switch (o.shape) {
    case 0: return superR(th, o.sn);
    case 1: {
      let s = 0;
      for (let j = 0; j < o.k; j++) {
        const c = cos(th - o.a0 - (TAU * j) / o.k);
        if (c > 0) s += pow(c, o.pe);
      }
      return pow(s, -1 / o.pe);
    }
    case 2: return superR(th, o.bn) * (1 + o.amp * cos(o.k * th + o.a0));
    default: {
      let r = 1;
      for (let m = 0; m < 5; m++) r += (o.ha / pow(m + 1, 0.7)) * cos(o.hm[m] * th + o.hp[m]);
      return r;
    }
  }
}

// The outline of this layer in LEDs: the unit shape with its ripples and twist, fitted to a box that follows the profile and the lean.
function makeOutline(P) {
  const o = P.obj, w = P.w, zl = P.layer, zf = zl / max(1, o.nl - 1);
  const { ux, uy, ox, oy } = P;
  // The twist of the lobes is a swing, not a turn that runs away: a rotated shape in a tall box would shear.
  const tw = o.shape === 0 ? 0 : o.tw * 1.1 * pow(w, 1.2) * sin(0.083 * zl + o.q1);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < NP; i++) {
    const th = (TAU * i) / NP;
    let rip = 0;
    for (let q = 0; q < 3; q++) rip += o.ra[q] * cos(o.rm[q] * th + o.rp[q] + P.rph[q]);
    let r = baseR(o, th - tw) * (1 + (0.003 + 0.065 * w) * rip);
    if (r < 0.15) r = 0.15;
    const x = r * cos(th), y = r * sin(th);
    ux[i] = x; uy[i] = y;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const mag = 1 + 0.9 * w, sx = mag * sin(o.sa), sy = mag * cos(o.sa);
  const lean = 5.5 * w;
  const wx = (lean * (sin(0.113 * zl + o.q1) + 0.6 * sin(0.0517 * zl + o.q2))) / 1.6;
  const wy = (0.45 * lean * (sin(0.071 * zl + o.q3) + 0.5 * sin(0.0373 * zl + 1.7 * o.q1))) / 1.5;
  // The stack lies down and aslant of the layer, so the layer stands up and aslant of the middle.
  const cx = 32 + o.ox - 1.5 * sx + wx + (0.8 + 2.4 * w) * P.jx, cy = 64 + o.oy - 2.5 * sy + wy + (0.5 + 1.5 * w) * P.jy;
  const pr = cl(1 + (0.45 + 0.55 * w) * (profile(o, zf) - 1), 0.5, 1.06);
  const Wt = min(o.W * pr * (1 + (0.025 + 0.04 * w) * P.jw), 2 * (min(cx - 2.2, 61.8 - cx) - BEAD_R));
  const Ht = min(o.H * (0.85 + 0.15 * pr) * (1 + (0.01 + 0.02 * w) * P.jh), 2 * (min(cy - 2.2, 125.8 - cy) - BEAD_R));
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2;
  for (let i = 0; i < NP; i++) {
    ox[i] = cx + ((ux[i] - mx) / hx) * (Wt / 2);
    oy[i] = cy + ((uy[i] - my) / hy) * (Ht / 2);
  }
  P.cx = cx; P.cy = cy;
  P.tn = cl(0.5 + 0.22 * sin(0.53 * zl + o.t1) + 0.2 * sin(0.213 * zl + o.t2) + 0.2 * sin(0.0617 * zl + o.q2), 0, 1);
}

// The signed distance to the outline on the LED lattice, positive inside, kept to a box round the part.
function buildSdf(P) {
  const { ox, oy, sdf } = P;
  sdf.fill(-8);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const dx = new Float64Array(NP), dy = new Float64Array(NP), il = new Float64Array(NP);
  for (let k = 0; k < NP; k++) {
    const b = (k + 1) % NP;
    dx[k] = ox[b] - ox[k]; dy[k] = oy[b] - oy[k];
    il[k] = 1 / (dx[k] * dx[k] + dy[k] * dy[k] + 1e-12);
    if (ox[k] < x0) x0 = ox[k];
    if (ox[k] > x1) x1 = ox[k];
    if (oy[k] < y0) y0 = oy[k];
    if (oy[k] > y1) y1 = oy[k];
  }
  const i0 = max(0, floor(x0) - 6), i1 = min(W, ceil(x1) + 6), j0 = max(0, floor(y0) - 6), j1 = min(H, ceil(y1) + 6);
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      let best = 1e18, inside = false;
      for (let k = 0; k < NP; k++) {
        const ax = ox[k], ay = oy[k], b = k + 1 === NP ? 0 : k + 1, by = oy[b];
        if (ay > j !== by > j && i < ax + ((j - ay) * dx[k]) / dy[k]) inside = !inside;
        let t = ((i - ax) * dx[k] + (j - ay) * dy[k]) * il[k];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + t * dx[k] - i, ey = ay + t * dy[k] - j, d2 = ex * ex + ey * ey;
        if (d2 < best) best = d2;
      }
      sdf[j * GW + i] = inside ? sqrt(best) : -sqrt(best);
    }
}

function samp(F, x, y) {
  x = x < 0 ? 0 : x > W - 1e-3 ? W - 1e-3 : x;
  y = y < 0 ? 0 : y > H - 1e-3 ? H - 1e-3 : y;
  const i = x | 0, j = y | 0, fx = x - i, fy = y - j, p = j * GW + i;
  return (F[p] * (1 - fx) + F[p + 1] * fx) * (1 - fy) + (F[p + GW] * (1 - fx) + F[p + GW + 1] * fx) * fy;
}

// ---------- contours by marching squares: the level set of F, as polylines [x, y, x, y, ...] ----------

// Edge ids: a horizontal edge is the lattice index of its left end, a vertical one GN more than that of its top end.
function contours(P, F, level) {
  const { cs1, cs2, sl0, sl1, used } = P;
  sl0.fill(-1); sl1.fill(-1);
  let ns = 0;
  const seg = (e1, e2) => {
    cs1[ns] = e1; cs2[ns] = e2;
    if (sl0[e1] < 0) sl0[e1] = ns; else sl1[e1] = ns;
    if (sl0[e2] < 0) sl0[e2] = ns; else sl1[e2] = ns;
    ns++;
  };
  for (let j = 0; j < GH - 1; j++)
    for (let i = 0; i < GW - 1; i++) {
      const p = j * GW + i;
      const a = F[p] - level, b = F[p + 1] - level, c = F[p + GW + 1] - level, d = F[p + GW] - level;
      const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const T = p, R = GN + p + 1, B = p + GW, L = GN + p;
      switch (code) {
        case 1: case 14: seg(L, T); break;
        case 2: case 13: seg(T, R); break;
        case 3: case 12: seg(L, R); break;
        case 4: case 11: seg(R, B); break;
        case 6: case 9: seg(T, B); break;
        case 7: case 8: seg(L, B); break;
        case 5:
          if (a + b + c + d > 0) { seg(T, R); seg(L, B); } else { seg(L, T); seg(R, B); }
          break;
        default:
          if (a + b + c + d > 0) { seg(L, T); seg(R, B); } else { seg(T, R); seg(L, B); }
      }
    }
  used.fill(0, 0, ns);
  const out = [];
  const other = (e, s) => (sl0[e] === s ? sl1[e] : sl0[e]);
  const point = (e, o) => {
    if (e < GN) {
      const i = e % GW, j = (e / GW) | 0, va = F[e] - level, vb = F[e + 1] - level;
      o.push(i + va / (va - vb), j);
    } else {
      const q = e - GN, i = q % GW, j = (q / GW) | 0, va = F[q] - level, vb = F[q + GW] - level;
      o.push(i, j + va / (va - vb));
    }
  };
  for (let s = 0; s < ns; s++) {
    if (used[s]) continue;
    used[s] = 1;
    let chain = [cs1[s], cs2[s]];
    let e = cs2[s], cur = s, closed = false;
    for (;;) {
      const nx = other(e, cur);
      if (nx < 0) break;
      if (used[nx]) { closed = nx === s; break; }
      used[nx] = 1;
      e = cs1[nx] === e ? cs2[nx] : cs1[nx];
      chain.push(e);
      cur = nx;
    }
    if (!closed) {
      const back = [];
      e = cs1[s]; cur = s;
      for (;;) {
        const nx = other(e, cur);
        if (nx < 0 || used[nx]) break;
        used[nx] = 1;
        e = cs1[nx] === e ? cs2[nx] : cs1[nx];
        back.push(e);
        cur = nx;
      }
      chain = back.reverse().concat(chain);
    }
    const p = [];
    for (let q = 0; q < chain.length; q++) point(chain[q], p);
    out.push({ p: smoothPoly(p, closed), closed });
  }
  return out;
}

// Two passes of a 1-2-1 average take the lattice's steps out of a contour. A closed one keeps its closing point.
function smoothPoly(p, closed) {
  const n = p.length / 2;
  if (n < 4) return p;
  let a = p;
  for (let it = 0; it < 2; it++) {
    const b = a.slice(), m = closed ? n - 1 : n;
    for (let k = closed ? 0 : 1; k < (closed ? m : n - 1); k++) {
      const pk = k === 0 ? m - 1 : k - 1, nk = k + 1 >= m && closed ? 0 : k + 1;
      b[2 * k] = 0.25 * a[2 * pk] + 0.5 * a[2 * k] + 0.25 * a[2 * nk];
      b[2 * k + 1] = 0.25 * a[2 * pk + 1] + 0.5 * a[2 * k + 1] + 0.25 * a[2 * nk + 1];
    }
    if (closed) { b[2 * m] = b[0]; b[2 * m + 1] = b[1]; }
    a = b;
  }
  return a;
}

// ---------- infill: lines of every family, clipped to the inside of the inner perimeter ----------

// The parts of the polyline p that lie where the distance field is at least thr, with the cut made where it crosses.
function clipRuns(P, p, closed, thr, out) {
  const n = p.length / 2;
  let px = p[0], py = p[1], ps = samp(P.sdf, px, py);
  let cur = ps >= thr ? [px, py] : null;
  let all = cur !== null;
  for (let k = 1; k < n; k++) {
    const x = p[2 * k], y = p[2 * k + 1], s = samp(P.sdf, x, y), inn = s >= thr;
    if (inn !== ps >= thr) {
      const t = (thr - ps) / (s - ps), cx = px + (x - px) * t, cy = py + (y - py) * t;
      if (inn) cur = [cx, cy, x, y];
      else { cur.push(cx, cy); out.push({ p: cur, closed: false }); cur = null; }
      all = false;
    } else if (inn) cur.push(x, y);
    else all = false;
    px = x; py = y; ps = s;
  }
  if (cur) out.push({ p: cur, closed: closed && all });
}

function infillRect(P, ang, s, out) {
  const ca = cos(ang), sa = sin(ang), ph = P.lph * s, L = 78, step = 1.5, ns = ceil((2 * L) / step);
  const nk = ceil(L / s);
  for (let k = -nk; k <= nk; k++) {
    const off = k * s + ph - s / 2, bx = 32 - sa * off - ca * L, by = 64 + ca * off - sa * L;
    const p = new Array(2 * (ns + 1));
    for (let q = 0; q <= ns; q++) { p[2 * q] = bx + ca * q * step; p[2 * q + 1] = by + sa * q * step; }
    clipRuns(P, p, false, CLIP, out);
  }
}

function infillHoney(P, s, out) {
  const o = P.obj, wd = 1.6 * s, a = wd / sqrt(3), rowH = 1.5 * a, rot = o.hr + 0.6 * P.aoff;
  const cr = cos(rot), sr = sin(rot);
  const tx = (x, y, q) => { q.push(32 + x * cr - y * sr, 64 + x * sr + y * cr); };
  const nj = ceil(80 / rowH), ni = ceil(80 / wd) + 1;
  const phx = P.lph * wd, phy = fract(P.lph * 7.3) * rowH * 2;
  for (let j = -nj; j <= nj; j++) {
    const yc = j * rowH + phy - rowH, xo = (((j % 2) + 2) % 2) * (wd / 2) + phx - wd * ni;
    const z = [];
    for (let i = 0; i <= 2 * ni; i++) {
      const xc = xo + i * wd;
      tx(xc, yc - a, z);
      tx(xc + wd / 2, yc - a / 2, z);
    }
    clipRuns(P, z, false, CLIP, out);
    for (let i = 0; i <= 2 * ni; i++) {
      const xv = xo + i * wd + wd / 2, v = [];
      tx(xv, yc - a / 2, v);
      tx(xv, yc + a / 2, v);
      clipRuns(P, v, false, CLIP, out);
    }
  }
}

function infillGyroid(P, s, out) {
  const o = P.obj, k = TAU / (2.6 * s), ca = cos(o.ga), sa = sin(o.ga), Z = o.gp + o.gz * P.layer;
  const cz = cos(Z), sz = sin(Z), F = P.fld;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const x = i - 32, y = j - 64;
      const X = k * (x * ca + y * sa) + o.gx + 2 * P.aoff, Y = k * (-x * sa + y * ca) + o.gy;
      F[j * GW + i] = sin(X) * cos(Y) + sin(Y) * cz + sz * cos(X);
    }
  for (const c of contours(P, F, 0)) clipRuns(P, c.p, c.closed, CLIP, out);
}

function infillConcentric(P, s, out) {
  for (let lv = W2 + s; lv < 70; lv += s) {
    const cs = contours(P, P.sdf, lv);
    if (!cs.length) break;
    for (const c of cs) out.push(c);
  }
}

// ---------- strokes: what the nozzle follows ----------

function mkStroke(p, closed, kind) {
  const n = p.length / 2, cum = new Float64Array(n);
  for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + sqrt((p[2 * k] - p[2 * k - 2]) ** 2 + (p[2 * k + 1] - p[2 * k - 1]) ** 2);
  return { p, closed, kind, n, cum, len: cum[n - 1] };
}

function rotateLoop(p, k) {
  const n = p.length / 2 - 1;
  if (k <= 0 || k >= n) return p;
  const o = [];
  for (let q = 0; q < n; q++) { const i = (k + q) % n; o.push(p[2 * i], p[2 * i + 1]); }
  o.push(o[0], o[1]);
  return o;
}

function nearestVertex(p, x, y, dx, dy) {
  let bk = 0, bd = -1e18;
  const n = p.length / 2;
  for (let k = 0; k < n; k++) {
    const d = dx === undefined ? -((p[2 * k] - x) ** 2 + (p[2 * k + 1] - y) ** 2) : (p[2 * k] - x) * dx + (p[2 * k + 1] - y) * dy;
    if (d > bd) { bd = d; bk = k; }
  }
  return bk;
}

// A tour of the lines, each time to the nearest end that is left. A closed loop is entered at its nearest point.
function orderStrokes(list, kind, x, y) {
  const res = [], used = new Uint8Array(list.length);
  for (let left = list.length; left > 0; left--) {
    let bi = -1, bd = 1e18, bs = 0, rev = false;
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      const c = list[i], p = c.p, n = p.length / 2;
      if (c.closed) {
        for (let k = 0; k < n - 1; k += 2) {
          const d = (p[2 * k] - x) ** 2 + (p[2 * k + 1] - y) ** 2;
          if (d < bd) { bd = d; bi = i; bs = k; rev = false; }
        }
      } else {
        const d0 = (p[0] - x) ** 2 + (p[1] - y) ** 2, d1 = (p[2 * n - 2] - x) ** 2 + (p[2 * n - 1] - y) ** 2;
        if (d0 < bd) { bd = d0; bi = i; rev = false; }
        if (d1 < bd) { bd = d1; bi = i; rev = true; }
      }
    }
    used[bi] = 1;
    const c = list[bi];
    let p = c.p;
    if (c.closed) p = rotateLoop(p, bs);
    else if (rev) {
      const q = [];
      for (let k = p.length / 2 - 1; k >= 0; k--) q.push(p[2 * k], p[2 * k + 1]);
      p = q;
    }
    res.push(mkStroke(p, c.closed, kind));
    x = p[p.length - 2]; y = p[p.length - 1];
  }
  return res;
}

const spacing = (k3) => 4 * pow(3, (k3 + 1) / 2);

// Lay out a layer: outline, distance field, the two perimeters. The infill is planned when the perimeters are done.
function beginLayer(P) {
  const o = P.obj;
  // What changes from layer to layer by a seeded walk, so that no two layers are laid alike: the lines turn 5 to 25
  // degrees more each time, the first line stands somewhere new, the spacing and the head speed vary, the seam moves,
  // and the outline is a little off where the last one stood.
  const rr = P.rand;
  P.sid++;
  P.aoff = 0.14 * (rr() - 0.5);
  P.lph = rr(); P.lv = 0.8 + 0.45 * rr(); P.lseam = TAU * rr();
  // A sheen across the layer: its brightness swings between 0.4 and 1 along a direction and with a wavelength of its own.
  const sa = TAU * rr(), sk = TAU / (40 + 80 * rr());
  P.skx = sk * cos(sa); P.sky = sk * sin(sa); P.sp = TAU * rr();
  P.jx = rr() * 2 - 1; P.jy = rr() * 2 - 1; P.jw = rr() * 2 - 1; P.jh = rr() * 2 - 1;
  makeOutline(P);
  buildSdf(P);
  P.solid = o.solid[P.layer] === 1;
  // Hue, brightness and line spacing of a layer come off a sequence that fills three dimensions evenly (Martin Roberts,
  // 2018, from memory), so that no two layers of a part are near one another in all three.
  const zl = P.layer, u1 = fract(zl * 0.8191725 + o.c1), u2 = fract(zl * 0.6710436 + o.c2), u3 = fract(zl * 0.5497005 + o.c3);
  P.curTone = 0.25 * u1 + 0.75 * P.tn; P.lvl = 0.88 + 0.12 * u2; P.lsj = 0.88 + 0.24 * u3;
  const sdx = cos(P.lseam), sdy = sin(P.lseam);
  const walls = [];
  const loops = (lv) => contours(P, P.sdf, lv).filter((c) => c.closed && c.p.length > 40);
  let ex = P.cx, ey = P.cy;
  for (const c of loops(W1).sort((a, b) => b.p.length - a.p.length)) {
    const st = mkStroke(rotateLoop(c.p, nearestVertex(c.p, P.cx, P.cy, sdx, sdy)), true, 0);
    walls.push(st);
    ex = st.p[st.p.length - 2]; ey = st.p[st.p.length - 1];
  }
  for (const c of loops(W2).sort((a, b) => b.p.length - a.p.length)) {
    const st = mkStroke(rotateLoop(c.p, nearestVertex(c.p, ex, ey)), true, 1);
    walls.push(st);
    ex = st.p[st.p.length - 2]; ey = st.p[st.p.length - 1];
  }
  P.strokes = walls;
  P.wallN = walls.length;
  P.infillDone = false;
  P.si = 0; P.sd = 0; P.seg = 0;
  P.layerT = 0;
}

// Drop the stretches of a run that the nozzle has already laid this layer (a re-slice from the middle of a layer).
// A stretch counts only if it is 5 points long, so a crossing of a laid line does not cut a run.
function dropLaid(P, list) {
  const res = [], dep = P.dep;
  for (const c of list) {
    const p = c.p, n = p.length / 2, cut = new Uint8Array(n);
    for (let k = 0; k < n; ) {
      const laidAt = (q) => { const x = p[2 * q], y = p[2 * q + 1]; return x >= 0 && y >= 0 && x < W && y < H && dep[(y | 0) * W + (x | 0)] > 0.96; };
      if (!laidAt(k)) { k++; continue; }
      let e = k;
      while (e < n && laidAt(e)) e++;
      if (e - k >= 5) for (let q = k; q < e; q++) cut[q] = 1;
      k = e;
    }
    let cur = [];
    for (let k = 0; k <= n; k++) {
      if (k < n && !cut[k]) cur.push(p[2 * k], p[2 * k + 1]);
      else { if (cur.length >= 8) res.push({ p: cur, closed: false }); cur = []; }
    }
  }
  return res;
}

function planInfill(P, again) {
  const o = P.obj, solid = P.solid, s = solid ? SOLID_S * (0.9 + 0.2 * P.lsj) : max(4, spacing(P.k3) * P.lsj);
  P.sPlanned = solid ? 0 : s;
  P.planT = P.layerT;
  const raw = [];
  const fam = solid && o.fam !== 2 ? 0 : o.fam;
  const ang = (solid ? PI / 4 : o.ang) + (P.layer & 1) * (PI / 2) + P.aoff;
  switch (fam) {
    case 0: infillRect(P, ang, s, raw); break;
    case 1: infillGyroid(P, s, raw); break;
    case 2: infillConcentric(P, s, raw); break;
    case 3: infillHoney(P, s, raw); break;
    default: infillRect(P, ang, 1.75 * s, raw); infillRect(P, ang + PI / 2, 1.75 * s, raw);
  }
  let list = raw.filter((c) => c.p.length >= 4);
  if (again) list = dropLaid(P, list);
  const st = orderStrokes(list, solid ? 3 : 2, P.nx, P.ny).filter((c) => c.len >= 3);
  P.strokes.length = P.wallN;
  for (const c of st) P.strokes.push(c);
}

// ---------- the nozzle ----------

function stamp(P, x, y) {
  const { dep, tone, heat, lid } = P, ext = BEAD_R + 0.5;
  const wv = P.skx * x + P.sky * y + P.sp + 0.09 * P.layerT, lvl = P.lvl * (0.76 + 0.24 * sin(wv));
  const tn = cl(P.curTone + 0.3 * sin(wv + 1.6), 0, 1);
  const i0 = max(0, floor(x - ext - 0.5)), i1 = min(W - 1, ceil(x + ext - 0.5));
  const j0 = max(0, floor(y - ext - 0.5)), j1 = min(H - 1, ceil(y + ext - 0.5));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const dx = i + 0.5 - x, dy = j + 0.5 - y;
      let c = BEAD_R + 0.5 - sqrt(dx * dx + dy * dy);
      if (c <= 0) continue;
      if (c > 1) c = 1;
      const p = j * W + i;
      // The newest layer is on top whatever its brightness, but its edge never rises above what lies under it.
      if (lid[p] === P.sid ? c * lvl > dep[p] : c > 0.5 || c * lvl > dep[p]) { dep[p] = c * lvl; tone[p] = tn; lid[p] = P.sid; }
      if (c > heat[p]) heat[p] = c;
    }
}

// Where the stroke is d LEDs along it. P.seg only moves forward, so a stroke is walked in one pass.
function place(P, st, d) {
  const cum = st.cum, p = st.p;
  let k = P.seg;
  while (k < st.n - 2 && cum[k + 1] < d) k++;
  P.seg = k;
  const l = cum[k + 1] - cum[k], t = l > 1e-9 ? cl((d - cum[k]) / l, 0, 1) : 0;
  P.nx = p[2 * k] + (p[2 * k + 2] - p[2 * k]) * t;
  P.ny = p[2 * k + 1] + (p[2 * k + 3] - p[2 * k + 1]) * t;
}

function lay(P, st, d0, d1) {
  let d = d0;
  for (;;) {
    place(P, st, d);
    stamp(P, P.nx, P.ny);
    if (d >= d1) break;
    d = min(d + 0.4, d1);
  }
}

// The next stroke, or the end of the layer.
function nextStroke(P, first) {
  if (P.si >= P.strokes.length && !P.infillDone) {
    P.infillDone = true;
    planInfill(P, false);
  }
  if (P.si >= P.strokes.length) { endLayer(P); return; }
  const st = P.strokes[P.si];
  if (first) {
    P.nx = st.p[0]; P.ny = st.p[1];
    P.mode = PRINT; P.sd = 0; P.seg = 0; P.flash = 1;
    return;
  }
  P.mx0 = P.nx; P.my0 = P.ny; P.mx1 = st.p[0]; P.my1 = st.p[1];
  P.mt = 0;
  P.mdur = max(0.05, sqrt((P.mx1 - P.mx0) ** 2 + (P.my1 - P.my0) ** 2) / TRAVEL);
  P.mode = MOVE;
}

function shiftBuf(P, a, dx, dy) {
  const t = P.tmp;
  t.set(a);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = x - dx, sy = y - dy;
      a[y * W + x] = sx >= 0 && sy >= 0 && sx < W && sy < H ? t[sy * W + sx] : 0;
    }
}

function endLayer(P) {
  const o = P.obj;
  P.lastLayerT = P.layerT; P.layerT = 0;
  const mag = 1 + 0.9 * P.w;
  P.accx += mag * sin(o.sa); P.accy += mag * cos(o.sa);
  const ix = round(P.accx), iy = round(P.accy);
  P.accx -= ix; P.accy -= iy;
  shiftBuf(P, P.dep, ix, iy); shiftBuf(P, P.tone, ix, iy); shiftBuf(P, P.heat, ix, iy); shiftBuf(P, P.lid, ix, iy);
  const dep = P.dep;
  for (let i = 0; i < N; i++) { const v = dep[i] * DIM; dep[i] = v < 0.025 ? 0 : v; }
  P.gix = ix; P.giy = iy; P.gdim = 1 / DIM;
  // The ripples turn a little with each layer, as fast as the knob says.
  for (let q = 0; q < 3; q++) P.rph[q] += o.rr[q] * (0.12 + P.w);
  P.layer++;
  if (P.layer >= o.nl) { P.mode = FINISH; P.gix = 0; P.giy = 0; P.gdim = 1; return; }
  P.pend = true; P.strokes = [];
  P.mode = CHANGE; P.ct = 0;
}

function advance(P, dt, v0) {
  let t = dt;
  P.layerT += dt;
  for (let guard = 0; t > 1e-6 && guard < 600; guard++) {
    const m = P.mode;
    if (m === PRINT) {
      const st = P.strokes[P.si];
      const v = v0 * P.lv * MULT[st.kind], rem = st.len - P.sd, can = v * t;
      if (can < rem) { lay(P, st, P.sd, P.sd + can); P.sd += can; t = 0; }
      else {
        lay(P, st, P.sd, st.len);
        t -= rem / v;
        P.si++; P.sd = 0; P.seg = 0;
        nextStroke(P, false);
      }
    } else if (m === MOVE) {
      const left = P.mdur - P.mt;
      if (t < left) { P.mt += t; t = 0; const u = P.mt / P.mdur; P.nx = P.mx0 + (P.mx1 - P.mx0) * u; P.ny = P.my0 + (P.my1 - P.my0) * u; }
      else {
        t -= left;
        const st = P.strokes[P.si];
        P.nx = st.p[0]; P.ny = st.p[1];
        P.mode = PRINT; P.sd = 0; P.seg = 0; P.flash = 1;
      }
    } else if (m === CHANGE) {
      // The next layer is laid out a moment into the pause, not in the frame the last one ends in.
      const left = (P.pend ? 0.12 : T_CHANGE) - P.ct;
      if (t < left) { P.ct += t; t = 0; }
      else if (P.pend) { t -= left; P.ct += left; P.pend = false; beginLayer(P); }
      else {
        t -= left;
        P.ct = T_CHANGE;
        P.gix = 0; P.giy = 0; P.gdim = 1;
        P.nozA = 0;
        P.si = 0; P.sd = 0; P.seg = 0;
        nextStroke(P, true);
      }
    } else t = 0;
  }
}

function frameStep(P, dt, v0) {
  advance(P, dt, v0);
  const heat = P.heat;
  const kh = exp(-dt / TAU_HEAT);
  for (let i = 0; i < N; i++) { const v = heat[i] * kh; heat[i] = v < 0.004 ? 0 : v; }
  if (P.ft >= 0) {
    const gh = P.gh;
    for (let i = 0; i < N; i++) { const v = gh[i] * kh; gh[i] = v < 0.004 ? 0 : v; }
    P.ft += dt;
    if (P.ft >= T_FIN) P.ft = -1;
  }
  P.flash = max(0, P.flash - dt / 0.18);
  const target = P.mode === PRINT ? 1 : P.mode === MOVE ? 0.45 : 0;
  P.nozA = target > P.nozA ? min(target, P.nozA + dt * 5) : max(target, P.nozA - dt * 6);
}

// Lay the first layers of the object at once, so that a part under construction is there at the start.
function prerun(P) {
  beginLayer(P);
  P.mode = CHANGE; P.pend = false; P.ct = T_CHANGE;
  for (let g = 0; g < 40000 && (P.layer < PRE_LAYERS || P.layerT < 0.72 * P.lastLayerT); g++) frameStep(P, 0.1, P.v0);
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  P.k1 = cl(kv[0], 0, 1); P.k2 = cl(kv[1], 0, 3); P.k3 = cl(kv[2], -1, 1); P.w = cl(kv[3], 0, 1);
  const v0 = 20 * pow(10, pow(P.k2 / 3, 0.4));
  P.v0 = v0;
  if (!P.ready) {
    P.ready = true;
    newObject(P);
    prerun(P);
    P.nozA = 1;
  } else if (P.mode === FINISH) {
    // The part is done: keep its picture to fade out, and lay the next one's first layers behind it.
    P.gd.set(P.dep); P.gt.set(P.tone); P.gh.set(P.heat);
    P.dep.fill(0); P.tone.fill(0); P.heat.fill(0); P.lid.fill(0);
    newObject(P);
    prerun(P);
    P.ft = 0;
  }
  // A turn of the infill knob re-slices what is left of the layer being laid.
  if (P.mode === PRINT && P.infillDone && !P.solid && P.si >= P.wallN && abs(log(max(4, spacing(P.k3) * P.lsj) / P.sPlanned)) > 0.15 && P.layerT - P.planT > 1) {
    P.strokes.length = P.wallN;
    planInfill(P, true);
    P.si = P.wallN; P.sd = 0; P.seg = 0;
    nextStroke(P, false);
  }
  let left = min(dt, 0.5);
  while (left > 1e-6) {
    const d = min(left, 0.05);
    frameStep(P, d, v0);
    left -= d;
  }
}

// ---------- the picture ----------

// One LED of plastic: its hue by tone, brightness a, and the white-yellow-orange of its heat h laid over the hue.
function shade(P, a, h, tn, out, o) {
  const fil = P.fil, ramp = P.ramp, ti = ((tn * 63 + 0.5) | 0) * 3;
  let r = fil[ti], g = fil[ti + 1], b = fil[ti + 2];
  if (h > 0.01) {
    const ri = ((h > 1 ? 1 : h) * 255) | 0, wq = ramp[ri * 4 + 3];
    r += (ramp[ri * 4] - r) * wq; g += (ramp[ri * 4 + 1] - g) * wq; b += (ramp[ri * 4 + 2] - b) * wq;
  }
  out[o] += r * a; out[o + 1] += g * a; out[o + 2] += b * a;
}

export function draw(display, P) {
  if (!P.ready) return;
  const { dep, tone, heat, fil, out } = P;
  // The filament's colour for each of 64 tones, a layer's hue being a little off the last.
  const base = 0.46 + P.k1;
  for (let i = 0; i < 64; i++) hsv(base + (i / 63 - 0.5) * 0.36, 0.9, 1, fil, i * 3);
  // While the layers step, the picture glides one LED aslant and dims, so that nothing jumps.
  let gx = 0, gy = 0, gain = 1, glide = false;
  if (P.mode === CHANGE && (P.gix || P.giy)) {
    const e = smooth(P.ct / T_GLIDE);
    gx = -P.gix * (1 - e); gy = -P.giy * (1 - e); gain = P.gdim + (1 - P.gdim) * e;
    glide = true;
  }
  const fade = P.ft >= 0, lg = fade ? smooth(P.ft / T_IN) : 1, gg = fade ? exp(-P.ft / T_FADE) : 0;
  out.fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3;
      let a, h, tn;
      if (!glide) { a = dep[p]; h = heat[p]; tn = tone[p]; }
      else {
        const sx = x - gx, sy = y - gy, i0 = floor(sx), j0 = floor(sy), fx = sx - i0, fy = sy - j0;
        a = 0; h = 0; tn = 0;
        let ws = 0;
        for (let q = 0; q < 4; q++) {
          const i = i0 + (q & 1), j = j0 + (q >> 1);
          if (i < 0 || j < 0 || i >= W || j >= H) continue;
          const wq = ((q & 1) ? fx : 1 - fx) * ((q >> 1) ? fy : 1 - fy), k = j * W + i;
          a += wq * dep[k]; h += wq * heat[k]; tn += wq * tone[k] * dep[k]; ws += wq * dep[k];
        }
        tn = ws > 1e-6 ? tn / ws : 0;
        a *= gain;
        if (a > 1) a = 1;
      }
      a *= lg;
      if (a > 0.004) shade(P, a, h, tn, out, o);
      if (fade && P.gd[p] * gg > 0.004) shade(P, P.gd[p] * gg, P.gh[p], P.gt[p], out, o);
    }
  // The nozzle: a small white spot and a short soft glow, and a brighter one where it has just landed.
  if (P.nozA > 0.01) {
    const nx = P.nx, ny = P.ny, A = P.nozA * lg, f = 1 + 0.8 * P.flash;
    for (let y = max(0, floor(ny - 5)); y <= min(H - 1, ceil(ny + 5)); y++)
      for (let x = max(0, floor(nx - 5)); x <= min(W - 1, ceil(nx + 5)); x++) {
        const dx = x + 0.5 - nx, dy = y + 0.5 - ny, d2 = dx * dx + dy * dy, o = (y * W + x) * 3;
        const spot = exp(-d2 / 1.1) * A * f, glow = 0.4 * exp(-d2 / 7) * A * f;
        out[o] += spot + glow; out[o + 1] += spot * 0.97 + glow * 0.8; out[o + 2] += spot * 0.86 + glow * 0.45;
      }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const r = out[o] * 255, g = out[o + 1] * 255, b = out[o + 2] * 255;
    display.setPixel(p % W, (p / W) | 0, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
  }
}
