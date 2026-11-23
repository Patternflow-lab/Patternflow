// ===== Patternflow pattern =====
// Title:   Mammatus
// Family:  mammatus
// Idea:    The underside of an anvil cloud seen from the ground at sunset, a field of rounded pouches in perspective, big and near at the bottom of the panel and small and far toward the horizon at the top, each with a thin gold rim on the side that faces the low sun, a glowing coral body where the cloud is thin and cool indigo shadow on the far side, hanging in front of a clear sky from teal to apricot while pouches swell, sink, thin at the tip and dissolve and new bumps start between them.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: mammatus clouds, pouches that hang from the underside of an anvil (named by William Clayton in 1828 for the Latin mamma, from memory), made where ice-laden air sinks in lobes and sublimation and evaporation cool the lobe tips (from memory), drawn as tapered capsules shaded as height fields and sorted by depth under a plain pinhole view of a flat cloud base, pattern round 228
// Round:   228
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Light=0..4, Pouches=-1..1, Sag=-1..1
//
// Knob 1: Hue. The whole dusk, pouch and sky together, in five looks that blend into each other: 0 is a sunset with coral and apricot bodies, a pale gold rim, indigo shadow and a sky from deep blue-teal through lilac to apricot, 0.25 is rose, 0.5 is violet and mauve, 0.75 is periwinkle, and 1 is cool teal with pearl rims under a pale aqua horizon. No stop is brown, and none is a grey.
// Knob 2: Light. The height of the sun, 0 to 4, and where it opens at 2 the light rakes. At 0 the sun is on the horizon behind the cloud: the bodies are deep indigo, the shadow floor is 0.07 of the colour ramp, and a gold rim 1.3 to 1.7 LEDs wide runs at full strength down the sunward side of each pouch. At 2 the rims are at 0.65 and the floor at 0.20, and the thin edges glow coral. At 4 the sun is high and in front: the rims are at 0.12, the floor at 0.37, the face of each pouch is lit all over, and the sky is washed 24 percent toward cream.
// Knob 3: Pouches. How large and how many, from a few big ones to a field of small ones. The tip radius at the bottom row is 25 LEDs at -1, 18 where it opens at 0 and 10 at +1 (each pouch 0.82 to 1.26 of that), and at row 30 it is 9, 6.6 and 3.7. About 35 pouches are on the panel at -1, 55 at 0 and 100 at +1. The size follows in half a second, and the count follows over 10 to 40 seconds: crowded pouches draw up and dissolve in 3 seconds, and new bumps start in the gaps.
// Knob 4: Sag. How far the pouches hang and how long they last. A full-grown pouch is 1.14 times as tall as it is wide at -1, a shallow bump, 1.7 times at 0.06 where it opens, and 2.7 times at +1, a drooping sack (about, each pouch is 0.7 to 1.3 of that, and shorter toward the horizon). Pouches also live 0.85 of the usual 40 to 120 seconds at -1 and 1.15 of it at +1. The length follows the knob in under a second.

// Method. The panel is a flat cloud base seen from below with the horizon at the top, so a pouch's tip radius follows a
// perspective law, 14.6 LEDs at the bottom row and 2.6 at row 15, and the rows above 15 are the glowing horizon. A pouch is a
// tapering egg with lumps in its outline from value noise and a frayed edge, shaded as a height field against a light
// that points at a far-off sun beyond the top edge. The sun's azimuth wanders about 130 degrees on two clocks of its own, so
// the lit sides slide round. The light is cut into a lit tone and a shadow tone with a soft wandering line between, and a
// thin rim and a wider glow are added on the sunward edge. Pouches are sorted by tip row and composited far to near per
// pixel from 4 by 4 cells, with a soft shadow where a near one lies over a far one and a haze that lifts the far ones.
// Life. A pouch is placed where there is most room (the best of 22 random places, now and then beside a neighbour so that a few
// cluster), fades in over 5 seconds as a small bump, swells over 17 percent of its 40 to 120 seconds, sinks (its length grows)
// up to 70 percent, thins and glows at the tip from 40 percent, and from about 70 percent draws up and frays away from the tip.
// A void left by a dissolving pouch is where the next bump starts. The first update runs 180 seconds of life, so pouches of
// every age are there at once. Everything drifts sideways with the wind, near pouches faster than far ones.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, pow, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mix = (a, b, t) => a + (b - a) * t;

const hash = (n) => {
  const x = sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - floor(x);
};
// Smooth random numbers: a new random value at each whole step of t, joined by a Catmull-Rom curve, about -1..1.
// Each channel has its own sequence.
function wander(t, ch) {
  const i = floor(t), f = t - i, o = ch * 101.7;
  const a = hash(i - 1 + o) * 2 - 1, b = hash(i + o) * 2 - 1, c = hash(i + 1 + o) * 2 - 1, d = hash(i + 2 + o) * 2 - 1;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

// The cloud base is a flat deck seen from below with its far edge at the top of the panel. A pouch is placed by where
// its tip is: x along a torus XW LEDs wide, y down the panel. Its tip radius follows the perspective, SZ(y), which
// reaches 14.6 LEDs at the bottom row and 2.6 at row 15, a little gentler than a straight 1 over distance.
const NT = 300;            // slots for pouches
const XW = 112, XL = 32 - XW / 2;
const YMIN = 15, YMAX = 165;
const SZT = new Float64Array(173);
for (let i = 0; i < 173; i++) SZT[i] = 14.6 * pow((i < 6 ? 6 : i) / 127, 0.72);
const SZ = (y) => {
  const v = y < 6 ? 6 : y > 170 ? 170 : y, i = v | 0;
  return SZT[i] + (SZT[i + 1] - SZT[i]) * (v - i);
};
const KY = (y) => 0.72 + 0.28 * (y > 127 ? 1 : y) / 127; // pouches pile up a little more vertically near the horizon

// Where tips may be: more of them at the far end, the density of a plane in perspective.
const NYC = YMAX - YMIN + 1;
const YCDF = new Float64Array(NYC + 1);
{
  let s = 0;
  for (let k = 0; k < NYC; k++) {
    const y = YMIN + k + 0.5;
    s += 1 / (SZ(y) * SZ(y) * KY(y));
    YCDF[k + 1] = s;
  }
  for (let k = 0; k <= NYC; k++) YCDF[k] /= s;
}
function sampleY(u) {
  let lo = 0, hi = NYC;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (YCDF[mid] <= u) lo = mid; else hi = mid;
  }
  return YMIN + lo + (u - YCDF[lo]) / (YCDF[lo + 1] - YCDF[lo] + 1e-9);
}

// Five looks. Each has the pouch ramp from deep shadow to the rim (shadow, shade, mid, lit, rim) and the sky from
// the horizon down to the zenith (horizon, low, mid, high, zenith). They are light enough at every stop that the
// panel's gamma does not turn them brown, and no stop is a dark orange.
const LOOKS = [
  { p: [[52, 44, 124], [140, 74, 146], [230, 112, 112], [255, 150, 98], [255, 226, 150]],
    s: [[255, 170, 106], [255, 198, 152], [172, 160, 198], [36, 112, 160], [12, 52, 110]] },
  { p: [[62, 44, 122], [132, 70, 148], [226, 98, 146], [255, 152, 154], [255, 216, 180]],
    s: [[255, 190, 152], [250, 170, 170], [160, 120, 186], [72, 72, 152], [34, 40, 112]] },
  { p: [[46, 42, 124], [98, 70, 168], [172, 110, 204], [228, 152, 222], [255, 218, 242]],
    s: [[255, 196, 206], [236, 150, 204], [150, 112, 196], [60, 64, 156], [22, 32, 104]] },
  { p: [[36, 50, 120], [72, 92, 174], [132, 152, 218], [184, 208, 240], [236, 242, 255]],
    s: [[236, 226, 246], [170, 184, 230], [74, 108, 186], [28, 56, 134], [12, 30, 92]] },
  { p: [[24, 62, 112], [46, 112, 154], [112, 192, 198], [190, 238, 224], [246, 252, 242]],
    s: [[206, 238, 222], [112, 196, 196], [38, 128, 160], [16, 78, 130], [8, 36, 96]] },
];
const PSTOP = [0, 0.25, 0.5, 0.75, 1];
const SSTOP = [0, 0.24, 0.5, 0.76, 1];

function buildLooks(P, hue, pale) {
  P.hueK = hue; P.paleK = pale;
  const x = cl(hue, 0, 1) * 4, k = x >= 4 ? 3 : floor(x), f = x - k;
  const A = LOOKS[k], B = LOOKS[k + 1];
  const ps = [], ss = [];
  for (let i = 0; i < 5; i++) {
    const pc = [], sc = [];
    for (let c = 0; c < 3; c++) {
      pc.push(mix(A.p[i][c], B.p[i][c], f));
      sc.push(mix(A.s[i][c], B.s[i][c], f));
    }
    ps.push(pc); ss.push(sc);
  }
  const pale3 = [250, 240, 232];
  // pouch ramp, 256 steps
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let j = 3;
    while (j > 0 && t < PSTOP[j]) j--;
    const u = (t - PSTOP[j]) / (PSTOP[j + 1] - PSTOP[j]);
    for (let c = 0; c < 3; c++) P.ramp[i * 3 + c] = mix(ps[j][c], ps[j + 1][c], u);
  }
  // sky rows
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    let j = 3;
    while (j > 0 && t < SSTOP[j]) j--;
    const u = (t - SSTOP[j]) / (SSTOP[j + 1] - SSTOP[j]);
    for (let c = 0; c < 3; c++) {
      const v = mix(ss[j][c], ss[j + 1][c], smooth(u) * 0.35 + u * 0.65);
      P.sky[y * 3 + c] = mix(v, pale3[c], pale);
    }
  }
  for (let c = 0; c < 3; c++) P.glowc[c] = mix(ps[3][c], ps[4][c], 0.6);
}

export function setup(P) {
  P.ready = false;
  P.t = 0; P.sim = 0;
  P.hueK = -1; P.paleK = -1;
  P.m = 1; P.lfm = 1.35;
  P.ramp = new Float32Array(256 * 3);
  P.sky = new Float32Array(H * 3);
  P.glowc = new Float32Array(3);
  const tab = () => {
    const a = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) a[i] = Math.random() * 2 - 1;
    return a;
  };
  P.tA = tab(); P.tB = tab();
  const f = () => new Float64Array(NT);
  P.sx = f(); P.sy = f(); P.sf = f(); P.lv = f(); P.lean = f(); P.bend = f(); P.wp = f(); P.wa = f();
  P.swp = f(); P.swr = f(); P.nox = f(); P.noy = f(); P.age = f(); P.life = f(); P.ud = f(); P.rt = f().fill(-1);
  P.alive = new Uint8Array(NT);
  P.birthT = 0; P.crowdT = 1;
  P.wd = 0.3;
  // instances for the frame, sorted far to near
  const MI = NT * 2;
  const g = () => new Float32Array(MI);
  P.IX = g(); P.IA = g(); P.IB = g(); P.ICY = g(); P.ITOP = g(); P.IL2 = g(); P.ILE = g(); P.IBE = g(); P.IWA = g(); P.IWP = g();
  P.IDX = g(); P.IDY = g(); P.ISG = g(); P.ITH = g(); P.IAL = g(); P.IHZ = g(); P.INX = g(); P.INY = g(); P.IDS = g();
  P.IX0 = g(); P.IX1 = g(); P.IY0 = g(); P.IY1 = g();
  P.ord = new Int16Array(NT);
  P.cellN = new Int16Array(512);
  P.cellL = new Int16Array(512 * 40);
  P.gx = new Float32Array(W); P.gy = new Float32Array(H);
  P.out = new Float32Array(NPX * 3);
  P.wobT = new Float32Array(256);
  for (let i = 0; i < 256; i++) P.wobT[i] = sin((i / 256) * TAU);
}

// ---- the sky of pouches --------------------------------------------------------------------------------------
function dn2(m, x1, y1, x2, y2) {
  let dx = x2 - x1;
  if (dx > XW / 2) dx -= XW; else if (dx < -XW / 2) dx += XW;
  const ym = 0.5 * (y1 + y2);
  const s = m * SZ(ym);
  const dy = (y2 - y1) / (s * KY(ym));
  const ddx = dx / s;
  return ddx * ddx + dy * dy;
}

function minDist(P, m, x, y, skip) {
  let best = 1e9;
  const { sx, sy, alive, age, life, ud, rt } = P;
  for (let j = 0; j < NT; j++) {
    if (!alive[j] || j === skip) continue;
    let d = dn2(m, x, y, sx[j], sy[j]);
    // A pouch that is dissolving counts for less, so a bump can start beside it.
    const u = age[j] / life[j];
    let dis = smooth((u - ud[j]) / (1 - ud[j]));
    if (rt[j] >= 0) dis = max(dis, rt[j] / 3.2);
    if (dis > 0) d *= 1 + 2.2 * dis;
    if (d < best) best = d;
  }
  return best;
}

function born(P, i, x, y, age0, sagN) {
  P.alive[i] = 1;
  P.sx[i] = x; P.sy[i] = y;
  P.sf[i] = 0.82 + 0.44 * Math.random();
  P.lv[i] = 0.7 + 0.6 * Math.random();
  P.lean[i] = (Math.random() - 0.5) * 0.3;
  P.bend[i] = (Math.random() - 0.5) * 0.36;
  P.wp[i] = Math.random() * 6.28; P.wa[i] = 0.03 + 0.06 * Math.random();
  P.swp[i] = Math.random() * TAU; P.swr[i] = 0.1 + 0.2 * Math.random();
  P.nox[i] = Math.random() * 60; P.noy[i] = Math.random() * 60;
  const ls = 0.85 + 0.3 * (sagN + 1) / 2;
  P.life[i] = cl((40 + 80 * pow(Math.random(), 1.1)) * ls, 38, 125);
  P.ud[i] = 0.66 + 0.12 * Math.random();
  P.age[i] = age0 * P.life[i];
  P.rt[i] = -1;
}

// Try to start one pouch where there is most room. Returns true when it did.
function tryBirth(P, m, sagN, age0) {
  let slot = -1;
  for (let i = 0; i < NT; i++) if (!P.alive[i]) { slot = i; break; }
  if (slot < 0) return false;
  let bx = 0, by = 0, bd = -1;
  const cluster = Math.random() < 0.14;
  let nal = 0;
  for (let j = 0; j < NT; j++) if (P.alive[j]) nal++;
  if (cluster && nal > 6) {
    let j = -1;
    for (let k = 0; k < 12; k++) {
      const c = (Math.random() * NT) | 0;
      if (P.alive[c] && P.rt[c] < 0 && P.age[c] / P.life[c] > 0.1 && P.age[c] / P.life[c] < 0.7) { j = c; break; }
    }
    if (j >= 0) {
      for (let k = 0; k < 8; k++) {
        const ang = Math.random() * TAU, dd = 1.05 + 0.45 * Math.random();
        const s = m * SZ(P.sy[j]);
        const x = P.sx[j] + cos(ang) * dd * s;
        const y = P.sy[j] + sin(ang) * dd * s * KY(P.sy[j]);
        if (y < YMIN || y > YMAX) continue;
        const d = minDist(P, m, x, y, -1);
        if (d > bd) { bd = d; bx = x; by = y; }
      }
      if (bd >= 0.95 * 0.95) {
        let xx = bx; xx = XL + (((xx - XL) % XW) + XW) % XW;
        born(P, slot, xx, by, age0, sagN);
        return true;
      }
    }
    bd = -1;
  }
  for (let k = 0; k < 22; k++) {
    const x = XL + Math.random() * XW, y = sampleY(Math.random());
    const d = minDist(P, m, x, y, -1);
    if (d > bd) { bd = d; bx = x; by = y; }
  }
  const need = 2.1 + 0.5 * Math.random();
  if (bd < need * need) return false;
  born(P, slot, bx, by, age0, sagN);
  return true;
}

function stepSim(P, d, m, sagN, crowd) {
  P.sim += d;
  const wd = 0.3 + 0.38 * wander(P.sim / 71, 51);
  P.wd = wd;
  const { sx, sy, alive, age, life, ud, rt } = P;
  for (let i = 0; i < NT; i++) {
    if (!alive[i]) continue;
    age[i] += d;
    if (rt[i] >= 0) rt[i] += d;
    const u = age[i] / life[i];
    let dis = smooth((u - ud[i]) / (1 - ud[i]));
    if (rt[i] >= 0) dis = max(dis, rt[i] / 3.2);
    if (u >= 1 || dis >= 1) { alive[i] = 0; continue; }
    const y = sy[i];
    let x = sx[i] + wd * (0.12 + 0.88 * pow(min(y, 150) / 127, 1.3)) * d;
    if (x >= XL + XW) x -= XW; else if (x < XL) x += XW;
    sx[i] = x;
  }
  // Births: when there is room. A void left by a dissolving pouch is the most room there is.
  P.birthT -= d;
  let guard = 0;
  while (P.birthT <= 0 && guard++ < 8) {
    if (tryBirth(P, m, sagN, 0)) P.birthT += 0.03 + 0.2 * Math.random();
    else P.birthT += 0.15;
  }
  // Crowding after the size knob grows: the older of two pouches too close starts to dissolve fast.
  if (crowd) {
    P.crowdT -= d;
    if (P.crowdT <= 0) {
      P.crowdT = 1.2;
      for (let i = 0; i < NT; i++) {
        if (!alive[i] || rt[i] >= 0) continue;
        for (let j = i + 1; j < NT; j++) {
          if (!alive[j] || rt[j] >= 0) continue;
          if (dn2(m, sx[i], sy[i], sx[j], sy[j]) < 0.8 * 0.8) {
            const k = age[i] / life[i] > age[j] / life[j] ? i : j;
            rt[k] = 0;
            break;
          }
        }
      }
    }
  }
}

// Value noise from one lattice, 64 by 64, wrapped.
function tex1(A, x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const i0 = xi & 63, i1 = (xi + 1) & 63, j0 = (yi & 63) << 6, j1 = ((yi + 1) & 63) << 6;
  const a0 = A[j0 + i0] + (A[j0 + i1] - A[j0 + i0]) * ux, a1 = A[j1 + i0] + (A[j1 + i1] - A[j1 + i0]) * ux;
  return a0 + (a1 - a0) * uy;
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const hue = cl(kv[0], 0, 1), Ln = cl(kv[1], 0, 4) / 4;
  const kp = cl(kv[2], -1, 1), sagN = cl(kv[3], -1, 1);
  const mT = kp < 0 ? 1.25 * pow(1.4, -kp) : 1.25 * pow(0.56, kp);
  const lfT = sagN <= 0.06 ? mix(0.28, 1.35, (sagN + 1) / 1.06) : mix(1.35, 3.4, (sagN - 0.06) / 0.94);
  if (!P.ready) {
    P.ready = true;
    P.m = mT; P.lfm = lfT;
    // Fill the sky, then let it live for a while so that the pouches are of every age.
    for (let k = 0, miss = 0; k < 600 && miss < 30; k++) { if (tryBirth(P, mT, sagN, Math.random())) miss = 0; else miss++; }
    for (let k = 0; k < 360; k++) stepSim(P, 0.5, mT, sagN, false);
    for (let k = 0; k < 20; k++) stepSim(P, 0.5, mT, sagN, true);
  }
  P.t += d;
  P.m += (mT - P.m) * (1 - exp(-d / 0.5));
  P.lfm += (lfT - P.lfm) * (1 - exp(-d / 0.45));
  const pale = 0.24 * pow(Ln, 1.5);
  if (abs(hue - P.hueK) > 1e-4 || abs(pale - P.paleK) > 1e-4) buildLooks(P, hue, pale);
  stepSim(P, d, mT, sagN, true);
  render(P, Ln);
}

function render(P, Ln) {
  const t = P.t, m = P.m, lfm = P.lfm;
  const { sx, sy, alive, age, life, ud, rt, out, ramp: RAMP, sky: SKY } = P;
  // The sun: an azimuth that wanders over about 130 degrees about straight up the panel, which is the horizon, on
  // clocks of its own. It is far off, beyond the top edge, and each pouch turns a little toward it.
  const phi = -PI / 2 + cl(1.05 * wander(t / 88, 41) + 0.42 * wander(t / 29.3, 42), -1.4, 1.4);
  const xs = 32 + 95 * cos(phi), ys = 16 + 95 * sin(phi);
  const Lz = cl(-0.4 + 1.5 * pow(Ln, 1.8), -0.4, 1);
  const Lxy = sqrt(1 - Lz * Lz);
  const amb = 0.07 + 0.3 * pow(Ln, 1.2);
  const rimGain = cl(1.2 - 1.1 * Ln, 0.12, 1.2);
  const glowGain = 0.5 + 0.6 * (1 - Ln);
  // glow in the sky around the sun, as two separable gaussians
  const sg = 52;
  for (let x = 0; x < W; x++) { const q = (x + 0.5 - xs) / sg; P.gx[x] = exp(-0.5 * q * q); }
  for (let y = 0; y < H; y++) { const q = (y + 0.5 - ys) / sg; P.gy[y] = exp(-0.5 * q * q); }
  const gAmt = 0.6 * (1 - 0.55 * Ln);
  const gc0 = P.glowc[0], gc1 = P.glowc[1], gc2 = P.glowc[2];
  // instances, far to near by tip row
  let n = 0;
  const ord = P.ord;
  for (let i = 0; i < NT; i++) if (alive[i]) ord[n++] = i;
  for (let a = 1; a < n; a++) {
    const v = ord[a], key = sy[v];
    let b = a - 1;
    while (b >= 0 && sy[ord[b]] > key) { ord[b + 1] = ord[b]; b--; }
    ord[b + 1] = v;
  }
  const { IX, IA, IB, ICY, ITOP, ILE, IBE, IWA, IWP, IDX, IDY, ISG, ITH, IAL, IHZ, INX, INY, IDS, IL2, IX0, IX1, IY0, IY1 } = P;
  const cellN = P.cellN, cellL = P.cellL;
  cellN.fill(0);
  let M = 0;
  for (let q = 0; q < n; q++) {
    const i = ord[q];
    const u = age[i] / life[i];
    let dis = smooth((u - ud[i]) / (1 - ud[i]));
    if (rt[i] >= 0) dis = max(dis, rt[i] / 3.2);
    if (dis >= 0.999) continue;
    const y = sy[i];
    const grow = 0.38 + 0.62 * smooth(u / 0.17);
    const a = m * SZ(y) * P.sf[i] * grow;
    const far = smooth((a - 1.1) / 1.5);
    const alIn = smooth(age[i] / 5);
    const al = alIn * far;
    if (al < 0.01) continue;
    const ln = pow(smooth(u / 0.7), 1.25);
    // length in widths: grows as the pouch sinks; foreshortened toward the horizon
    const Lr = lfm * P.lv[i] * ln * (0.6 + 0.4 * (y > 127 ? 1 : y / 127));
    const b = a * (1 + 0.5 * Lr);
    const th = smooth((u - 0.4) / 0.3);
    const sw = a * 0.1 * sin(P.swp[i] + P.swr[i] * t) * (Lr / (1 + Lr));
    const xt0 = sx[i] + sw;
    const yb0 = y + a, top = yb0 - 2 * b;
    // a dissolving pouch draws up and narrows, tip first, and frays
    const bE = b * (1 - 0.78 * dis), aE = a * (1 - 0.25 * dis);
    const yb = top + 2 * bE;
    for (let im = 0; im < 2; im++) {
      const xt = xt0 - im * XW;
      const lx = P.lean[i] * 2 * b;
      const bd = P.bend[i] * 2 * b;
      const ext = a * 1.35 + max(abs(lx), abs(lx + bd * 0.25)) + 3;
      const x0 = xt - ext + min(0, lx), x1 = xt + ext + max(0, lx);
      const y0 = top - 3, y1 = yb + 3;
      if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
      const k = M++;
      IX[k] = xt; IA[k] = aE; IB[k] = bE; ICY[k] = yb - bE; ITOP[k] = top; ILE[k] = lx; IBE[k] = bd;
      IWA[k] = P.wa[i]; IWP[k] = P.wp[i];
      const ddx = xs - xt, ddy = ys - y;
      const dl = sqrt(ddx * ddx + ddy * ddy) + 1e-6;
      IDX[k] = ddx / dl; IDY[k] = ddy / dl;
      ITH[k] = th; IDS[k] = dis;
      ISG[k] = smooth((Lr - 0.15) / 0.6);
      IAL[k] = al;
      IHZ[k] = 0.55 * (1 - smooth((y - 14) / 90));
      INX[k] = P.nox[i]; INY[k] = P.noy[i];
      const lim = (1 + 2.9 / aE) * 1.12;
      IL2[k] = lim * lim;
      IX0[k] = x0; IX1[k] = x1; IY0[k] = y0; IY1[k] = y1;
      const cx0 = max(0, floor(x0 / 4)), cx1 = min(15, floor(x1 / 4));
      const cy0 = max(0, floor(y0 / 4)), cy1 = min(31, floor(y1 / 4));
      for (let cy = cy0; cy <= cy1; cy++)
        for (let cx = cx0; cx <= cx1; cx++) {
          const c = cy * 16 + cx;
          if (cellN[c] < 40) cellL[c * 40 + cellN[c]++] = k;
        }
    }
  }
  P.nInst = M;
  const tA = P.tA, tB = P.tB, wobT = P.wobT;
  const tq = 0.045 * t;
  for (let cy = 0; cy < 32; cy++)
    for (let cx = 0; cx < 16; cx++) {
      const c = cy * 16 + cx, cn = cellN[c], base = c * 40;
      for (let yy = 0; yy < 4; yy++) {
        const py = cy * 4 + yy + 0.5, row = (cy * 4 + yy) * 3;
        const gyv = P.gy[cy * 4 + yy];
        for (let xx = 0; xx < 4; xx++) {
          const px = cx * 4 + xx + 0.5;
          const gl = P.gx[cx * 4 + xx] * gyv * gAmt;
          const sr = SKY[row], sgc = SKY[row + 1], sb = SKY[row + 2];
          let R = sr + (gc0 - sr) * gl, G = sgc + (gc1 - sgc) * gl, B = sb + (gc2 - sb) * gl;
          const skyR = R, skyG = G, skyB = B;
          let cvg = 0;
          for (let e = 0; e < cn; e++) {
            const k = cellL[base + e];
            if (px < IX0[k] || px > IX1[k] || py < IY0[k] || py > IY1[k]) continue;
            const a = IA[k], b = IB[k], top = ITOP[k];
            const hy = py - ICY[k];
            let uy = hy / b;
            const f = cl((py - top) / (2 * b), 0, 1);
            const xa = IX[k] + ILE[k] * (1 - f) + IBE[k] * (1 - f) * f;
            const dx = px - xa;
            const wob = 1 + IWA[k] * wobT[((f * 2 * b / a * 0.95 + IWP[k]) * 40.74) & 255];
            const ax = a * (1 + 0.07 * (uy < -1 ? -1 : uy > 1 ? 1 : uy)) * wob;
            const ux = dx / ax;
            const rho2u = ux * ux + uy * uy;
            if (rho2u > IL2[k]) continue;
            // lumps: the outline of a pouch is not an ellipse
            const nzv = tex1(tA, ux * 1.6 + INX[k], (hy / a) * 0.7 + INY[k] + tq);
            const rho2 = rho2u * (1 + 0.2 * nzv);
            const gx = ux / ax, gy = uy / b;
            const gm = sqrt(gx * gx + gy * gy) + 1e-6;
            let sd = (rho2 - 1) / (2 * gm);
            if (sd > -2.5 && sd < 3) sd += (0.42 + 0.025 * a) * tex1(tB, dx * 0.28 + INY[k], hy * 0.28 + INX[k] + tq);
            const ldx = IDX[k], ldy = IDY[k];
            const nl = (gx * ldx + gy * ldy) / gm;
            if (sd > 0.7) {
              // outside the pouch: a soft shadow on whatever is behind it, mostly on the side away from the sun
              if (cvg > 0.15 && sd < 2.8) {
                const q = 1 - (sd - 0.7) / 2.1;
                const side = cl(0.5 - 0.6 * nl, 0.1, 1);
                const sh = 0.28 * cvg * q * q * side * IAL[k] * (1 - IDS[k]) * (1 - IDS[k]);
                R += (RAMP[0] - R) * sh; G += (RAMP[1] - G) * sh; B += (RAMP[2] - B) * sh;
              }
              continue;
            }
            let alpha = sd < -0.7 ? 1 : smooth(0.5 - sd / 1.4);
            alpha *= IAL[k];
            const dis = IDS[k];
            if (dis > 0.001) {
              const sc = 0.5 * a + 2.6;
              const val = 0.5 + 0.55 * tex1(tB, dx / sc + INX[k] * 0.7, hy / sc + INY[k] * 0.7);
              const fe = cl((py - top) / (2 * b), 0, 1);
              const thr = dis * 1.25 * (0.4 + 0.6 * fe) - 0.05;
              const keep = cl((val - thr) / 0.3 + 0.5, 0, 1);
              alpha *= keep * (1 - smooth((dis - 0.8) / 0.2));
            }
            const th = ITH[k];
            const sg0 = ISG[k];
            const tipw = smooth((f - 0.45) / 0.55);
            alpha *= 1 - 0.2 * th * tipw;
            if (alpha < 0.004) continue;
            const uz = rho2 >= 1 ? 0 : sqrt(1 - rho2) / a;
            const nrm = sqrt(gx * gx + gy * gy + uz * uz) + 1e-9;
            const lit = ((gx * ldx + gy * ldy) * Lxy + uz * Lz) / nrm;
            let li = (lit + 0.45) / 1.45 + 0.12 * nzv;
            li = li < 0 ? 0 : li > 1 ? 1 : li;
            // a painted terminator: the lit part and the shadow part are two tones with a soft wandering line between
            li = 0.25 * li + 0.75 * smooth((li - 0.3) / 0.4);
            const edge = sd < 0 ? -sd : 0;
            const sunf = nl > 0 ? nl : 0;
            const rw = 1.0 + 0.025 * a;
            const re = (edge - 0.25) / rw;
            const rim = re <= 0 ? 1 : re >= 1 ? 0 : 1 - re * re * (3 - 2 * re);
            const rimI = rim * sunf * (1.4 - 0.4 * sunf) * rimGain;
            const gq = edge / (1.4 + 0.2 * a);
            const gl2 = sunf * sunf * glowGain / (1 + gq * (1 + 0.5 * gq));
            const vf = 1 - 0.4 * sg0 * (1 - smooth(f / 0.7));
            let tl = amb + (0.72 - amb) * li * vf + 0.26 * gl2 + 0.4 * th * tipw + 0.16 * sg0 * smooth((f - 0.6) / 0.4);
            const nz3 = tex1(tB, dx * 0.3 + INX[k] * 3, hy * 0.06 + INY[k] + tq * 0.5);
            tl += 0.09 * nz3 * (0.3 + 0.7 * li);
            tl = tl + (1 - tl) * rimI;
            const hz = IHZ[k];
            if (hz > 0) tl = tl * (1 - 1.1 * hz) + 0.68 * hz;
            tl = tl < 0 ? 0 : tl > 1 ? 1 : tl;
            const ri = ((tl * 255) | 0) * 3;
            let cr = RAMP[ri], cg = RAMP[ri + 1], cb = RAMP[ri + 2];
            // the shadow side lets a little of the sky through at the very edge
            const bq = edge * 0.9;
            const bounce = (1 - sunf) * 0.3 * (1 - li) / (1 + bq * (1 + 0.5 * bq));
            cr += (skyR - cr) * bounce; cg += (skyG - cg) * bounce; cb += (skyB - cb) * bounce;
            R += (cr - R) * alpha; G += (cg - G) * alpha; B += (cb - B) * alpha;
            cvg += (1 - cvg) * alpha;
          }
          const o = (row / 3 * W + (cx * 4 + xx)) * 3;
          out[o] = R; out[o + 1] = G; out[o + 2] = B;
        }
      }
    }
}

export function draw(display, P) {
  const { out } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const r = out[o], g = out[o + 1], b = out[o + 2];
      display.setPixel(x, y, r < 0 ? 0 : r > 255 ? 255 : r + 0.5, g < 0 ? 0 : g > 255 ? 255 : g + 0.5, b < 0 ? 0 : b > 255 ? 255 : b + 0.5);
    }
}
