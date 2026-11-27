// ===== Patternflow pattern =====
// Title:   Layover
// Family:  sar
// Idea:    A side-looking radar flies up the panel over an invented plain and mountain range and paints it line by line in Pauli false colour, so the mountain faces that look toward it fold over onto the valley as glaring bands, the backs of the high ridges fall into black radar shadow, forest comes back green, fields blue, towns magenta and lakes and the river near black, all under a soft speckle that slides down with the ground.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: synthetic aperture radar imaging and its terrain distortions, layover, foreshortening and radar shadow, as set out in Curlander and McDonough, Synthetic Aperture Radar: Systems and Signal Processing (1991, from memory); the Pauli decomposition of the scattering matrix into odd-bounce, even-bounce and cross-polar parts (Cloude and Pottier, IEEE TGRS 1996, from memory); the red, green, blue Pauli colour order of quad-polarised radar images such as UAVSAR's (from memory); ridged multifractal terrain after Musgrave (from memory). The terrain, the ground cover, the scattering numbers and the colours are original, pattern round 269.
// Round:   269
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.25..3, Relief=-1..1, Incidence=-1..1
//
// Knob 1: Hue. Turns the three Pauli colours together round the colour wheel, a rotation about the grey axis. At 0 they are the usual ones, double bounce red, volume green and surface blue, so towns are magenta-red, forest green and fields blue; at a third of a turn the three trade places, and at a sixth they are yellow, cyan and magenta. Shadow, lakes and the river stay navy at every setting.
// Knob 2: Speed. How fast the platform flies, 4 x K2 LED of ground a second: 1 at the bottom, 8 where it opens, 12 at the top. New lines come in at the top edge and the image slides down. Nothing in the picture moves on its own, as in a real strip of radar image.
// Knob 3: Relief. The height scale, 13 x e^(0.75 K3) LED, so the highest peaks reach about 7 LED at -1, 15 where it opens and 32 at 1. At -1 one sample of ground in two hundred lays over and none is in shadow; where it opens 7 percent lays over and 2 percent is in shadow; at 1 it is 18 and 13 percent, and the far ridges fold right across the near ones.
// Knob 4: Incidence. The angle between the beam and the vertical, 39 + 15 x K4 degrees: 24 at -1, 40 where it opens, 54 at 1. A steep beam lays 17 percent of the ground over and casts no shadow; a shallow one lays 2 percent over and puts 9 percent of the ground in long black shadows behind the ridges. Turning K3 or K4 processes the lines already on the panel again, eight a frame, so the picture changes over in about half a second.
//
// What the picture is. A strip of radar image 64 x 128 LED standing up, as a side-looking radar on the left would make it while flying toward the top. Across is range, near on the left and far on the right, 1 LED of ground to a column on flat ground; down is the flight direction, 1 LED of ground to a row. On the near side a plain of field strips 5 LED wide and 8 to 24 long in blues and blue-cyans, patches of green forest and low wooded knolls, a river 4 to 5 LED wide and lakes up to about 25 LED across, all near black, and now and then a town of two clusters 8 to 13 LED across, bright magenta-red with a grain of 2 LED blocks. On the far side a mountain range whose ridges run mostly along the flight line and bend off it by up to about 40 degrees: green lower slopes, lavender rock on top, every face that looks toward the radar squeezed into a bright cyan-white band 2 to 4 LED wide, and behind the high crests black shadow. Where the range comes close, its front lays over onto the valley floor and hides the river. The ground never repeats: the foot of the range wanders between about 15 and 55 LED of ground range, and towns, lakes and the near-side hills come and go.
// The model. The ground is a function of range X and azimuth Y in LED with no stored map: a ridged multifractal of gradient noise in three octaves, stretched 2.6 times along the flight line, under a mountain front and near-side hills that wander with Y; field strips, forest, rock above a treeline, towns and lakes are set from height and further noise. Each new line is processed once. The ground across it is sampled every quarter LED out to where the highest peak could still fold back onto the panel. Every sample has a height h and goes to column X - h cot(theta), its slant range put on the ground. A sample is in shadow when an earlier one stands above the ray, which is the test h + X cot(theta) below the running maximum of the same. Each quarter-LED segment that is lit spreads its backscatter evenly over the columns it lands on, so a face that is compressed piles many segments into a few columns and a face that folds past the vertical of the beam lands in reverse among the valley floor's columns. Backscatter per unit of ground is a power of the cosine of the local incidence angle, from the surface normal with both slopes, in three Pauli channels per cover: fields surface 0.06 to 0.56 cos^3 and volume up to 0.21 cos, forest volume 0.26 cos, rock surface 0.4 cos^1.5 with some of the other two, towns double bounce up to 1.4 cos in 2 LED blocks, water 0.012 cos^8. A 1-2-1 range blur, a multiplicative speckle and a noise floor of 0.0015 follow, and the amplitude, the square root of the power, is shown on a straight scale with a soft shoulder. Lines live in a ring of 140; the scroll draws each row between two lines.
// What is exact and what is not. Within its invented ground the geometry is right: where each point lands in range, which points lie in shadow, how slopes facing the beam brighten and fold over, and the local incidence angle. The speckle is single-look exponential noise per LED smoothed by 1-2-1 both ways, so about 7 looks with a 2 LED grain; it is fixed to the image and travels with it. The rest is invented to make the picture read. The incidence angle is the same across all 64 columns, where a real swath changes by several degrees from near to far range. There is no azimuth processing, antenna pattern or curvature of the Earth. The cosine laws and the channel numbers are chosen, not measured, and the three Pauli channels share one speckle where real ones are only partly correlated. Water is a dark mirror with no wind on it. The size of an LED is not fixed by anything; taken as 50 m, the panel shows 3.2 by 6.4 km and the peaks where it opens stand about 750 m above the plain.

const W = 64, H = 128;
const NB = 140;                 // lines kept in the ring
const DX = 0.25;                // ground step along range, LED
const X0 = -3;                  // first ground sample
const NSMAX = 1100;
const { floor, sqrt, exp, log, sin, cos, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- noise
const hv = (a, b, sd) => {
  let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(sd, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, y, sd) => {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hv(ix, iy, sd), b = hv(ix + 1, iy, sd), c = hv(ix, iy + 1, sd), d = hv(ix + 1, iy + 1, sd);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const n1 = (y, sd) => vn(0.5, y, sd);
// gradient noise, about -0.7..0.7
const GX = new Float32Array(32), GY = new Float32Array(32);
for (let i = 0; i < 32; i++) {
  GX[i] = cos((i + 0.5) * PI / 16);
  GY[i] = sin((i + 0.5) * PI / 16);
}
const pg = (ix, iy, sd, fx, fy) => {
  const k = (hv(ix, iy, sd) * 32) | 0;
  return GX[k] * fx + GY[k] * fy;
};
const pn = (x, y, sd) => {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = pg(ix, iy, sd, fx, fy), b = pg(ix + 1, iy, sd, fx - 1, fy), c = pg(ix, iy + 1, sd, fx, fy - 1), d = pg(ix + 1, iy + 1, sd, fx - 1, fy - 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

// two octaves of it, spread about like a value noise (0.5 the median, 0.2 and 0.8 the tenth and ninetieth percentiles)
const pq = (x, y, sd) => 0.5 + pn(x, y, sd) + 0.45 * pn(1.9 * (x * 0.8 - y * 0.6) + 7.3, 1.9 * (x * 0.6 + y * 0.8) + 1.1, sd + 1);

// ridged multifractal, the first octaves stretched along azimuth
const RA = [0.0, 0.35, -0.3], RS = [2.6, 2.0, 1.5];
function ridged(x, y) {
  let sum = 0, amp = 1, w = 1, norm = 0, f = 1;
  for (let o = 0; o < 3; o++) {
    const c = cos(RA[o]), s = sin(RA[o]);
    const xx = (x * c - y * s) * f, yy = (x * s + y * c) * f / RS[o];
    const pz = pn(xx, yy, 31 + o * 17);
    let n = 1 - 2.2 * sqrt(pz * pz + 0.003);
    n = n < 0 ? 0 : n * n * w;
    w = cl(n * 2, 0, 1);
    sum += n * amp;
    norm += amp;
    amp *= 0.34;
    f *= 2.03;
  }
  return sum / norm * 1.6;
}

// ---- the ground: height (0..1) and cover, at ground range X and azimuth Y, both in LED
// what depends on Y alone is worked out once a line
const L = { Y: 0, xm: 0, A: 0, lft: 0, xl: 0, warp: 0, rx: 0, lm: 0, towns: [] };
function lineCtx(Y) {
  L.Y = Y;
  L.xm = 34 + 30 * (n1(Y / 250, 3) - 0.5) + 10 * (n1(Y / 80, 4) - 0.5);
  L.A = 0.6 + 0.4 * n1(Y / 210, 7);
  L.lft = 0.75 * sm(0.5, 0.85, n1(Y / 230, 6));
  L.xl = 4 + 10 * n1(Y / 120, 10);
  L.warp = 40 * (n1(Y / 170, 8) - 0.5) + 14 * (n1(Y / 55, 9) - 0.5);
  L.rx = L.xm - 11 - 13 * n1(Y / 45, 13) + 2 * (n1(Y / 9, 14) - 0.5);
  L.lm = sm(0.3, 0.7, n1(Y / 140, 15));
  L.towns.length = 0;
  const j = floor(Y / 50);
  for (let q = j - 1; q <= j + 1; q++) {
    if (hv(q, 1, 77) > 0.8) continue;
    const yc = (q + 0.2 + 0.6 * hv(q, 2, 77)) * 50, rr = 4 + 2.5 * hv(q, 5, 77);
    if (abs(Y - yc) > rr * 4 + 4) continue;
    const side = L.rx > 22 && hv(q, 3, 77) < 0.7 ? -1 : 1;
    const xc = L.rx + side * (rr + 3 + 5 * hv(q, 4, 77)), sy = hv(q, 6, 77) < 0.5 ? -1 : 1;
    L.towns.push(q, yc, xc, rr, q + 0.5, yc + sy * rr * 1.5, xc + 1.5 - 3 * hv(q, 7, 77), rr * 0.65);
  }
}
const G = { h: 0, wat: 0, fo: 0, rock: 0, town: 0, fs: 0, fv: 0 };
function ground(X) {
  const Y = L.Y;
  const env = sm(L.xm - 2, L.xm + 14, X), envL = L.lft * sm(L.xl + 2, L.xl - 12, X);
  const rg = ridged((X + L.warp) / 26, Y / 26);
  const kn = sm(0.6, 0.95, pq(X / 18, Y / 26, 30)) * 0.32 * (0.45 + 0.55 * rg);
  const flat = 1 - max(env, envL / 0.75);
  const h = (env * L.A + envL) * (0.1 + 0.9 * rg) + flat * (0.05 * vn(X / 9, Y / 14, 12) + kn);
  // towns on the plain, at most one in a stretch of 50 LED of azimuth
  let town = 0;
  const T = L.towns;
  for (let q = 0; q < T.length; q += 4) {
    const ex = X - T[q + 2], ey = (Y - T[q + 1]) * 0.75;
    const d = sqrt(ex * ex + ey * ey) * (0.75 + 0.6 * vn(X / 2.5, Y / 2.5, 78 + T[q] * 2));
    town = max(town, sm(T[q + 3], T[q + 3] - 1.2, d));
  }
  // the river, and the lakes of the plain, which keep clear of the towns
  const riv = sm(2.7, 1.9, abs(X - L.rx));
  let wat = riv;
  if (L.lm > 0) wat = max(wat, L.lm * flat * sm(0.1, 0.04, kn) * sm(0.64, 0.67, pq(X / 20, Y / 30, 16)) * sm(0.6, 0, town));
  town *= (1 - riv) * flat;
  const tl = 0.46 + 0.22 * vn(X / 20, Y / 30, 18);
  const fo = sm(0.04, 0.1, h) * sm(tl + 0.04, tl - 0.04, h) * sm(0.4, 0.46, pq(X / 10, Y / 14, 19)) + flat * (sm(0.04, 0.08, kn) + sm(0.68, 0.72, pq(X / 11, Y / 15, 20)));
  // field strips, 4 to 6 LED wide and 8 to 24 long
  const pu = floor(X / 5 + 0.3 * vn(0.5, Y / 40, 24)), pl = 8 + 16 * hv(pu, 0, 25);
  const pv = floor((Y + 31 * hv(pu, 1, 25)) / pl);
  const p1 = hv(pu, pv, 22), p2 = hv(pu, pv, 23);
  G.h = h;
  G.wat = wat;
  G.town = town;
  G.fo = cl(fo, 0, 1) * (1 - wat) * (1 - town);
  G.rock = sm(tl - 0.04, tl + 0.1, h) * (1 - wat);
  G.fs = 0.06 + 0.5 * p1;
  G.fv = 0.01 + 0.2 * p2 * p2 * p2;
}

// ---- one azimuth line of the image
function setup0() {
  return {
    k: [0, 2, 0, 0.06], init: false, P: 0, n0: 6860, top: 0, cur: 0,
    R: new Float32Array(NB * W), Gc: new Float32Array(NB * W), B: new Float32Array(NB * W),
    lk3: new Float64Array(NB), lk4: new Float64Array(NB), ln: new Int32Array(NB).fill(-1 << 30),
    hh: new Float32Array(NSMAX), hp: new Float32Array(NSMAX), cs: new Float32Array(NSMAX * 6),
    es: new Float32Array(W + 4), ev: new Float32Array(W + 4), ed: new Float32Array(W + 4),
    prevN: -1 << 30, prevK3: 9, prevK4: 9,
  };
}

export function setup(params) {
  params.s = setup0();
}

function geom(s) {
  const th = (39 + 15 * cl(s.k[3], -1, 1)) * PI / 180;
  const HS = 13 * exp(0.75 * cl(s.k[2], -1, 1));
  return { th, HS };
}

function heights(s, Y, arr, cover, NS) {
  lineCtx(Y);
  for (let i = 0; i < NS; i++) {
    ground(X0 + i * DX);
    arr[i] = G.h;
    if (cover) {
      const o = i * 6;
      cover[o] = G.wat; cover[o + 1] = G.town; cover[o + 2] = G.fo; cover[o + 3] = G.rock; cover[o + 4] = G.fs; cover[o + 5] = G.fv;
    }
  }
}

function deposit(e, a, b, v) {
  // spread v uniformly over columns a..b (any order)
  if (b < a) { const t = a; a = b; b = t; }
  a += 2; b += 2;
  const L = b - a;
  if (L < 1e-3) {
    const i = floor(a);
    if (i >= 0 && i < W + 4) e[i] += v;
    return;
  }
  const i0 = max(0, floor(a)), i1 = min(W + 3, floor(b));
  const d = v / L;
  for (let i = i0; i <= i1; i++) {
    const o = min(b, i + 1) - max(a, i);
    if (o > 0) e[i] += o * d;
  }
}

function makeLine(s, n) {
  const { th, HS } = geom(s);
  const st = sin(th), ct = cos(th), cot = ct / st;
  const NS = min(NSMAX, floor((W + 4 - X0 + HS * 1.1 * cot) / DX));
  const hh = s.hh, hp = s.hp, cs = s.cs;
  heights(s, n, hh, cs, NS);
  if (s.prevN === n - 1 && s.prevK3 === s.k[2] && s.prevK4 === s.k[3] && s.prevNS >= NS) { /* hp holds line n-1 */ }
  else heights(s, n - 1, hp, null, NS);
  const es = s.es, ev = s.ev, ed = s.ed;
  es.fill(0); ev.fill(0); ed.fill(0);
  let qmax = -1e9;
  for (let i = 0; i < NS - 1; i++) {
    const X = X0 + i * DX;
    const h0 = hh[i] * HS, h1 = hh[i + 1] * HS;
    const q = h0 + X * cot;
    if (q > qmax) qmax = q;
    const q1 = h1 + (X + DX) * cot;
    if (q1 < qmax - 0.05) continue;    // radar shadow
    const hx = (h1 - h0) / DX, hy = ((hh[i] + hh[i + 1]) - (hp[i] + hp[i + 1])) * 0.5 * HS;
    const cL = (hx * st + ct) / sqrt(1 + hx * hx + hy * hy);
    if (cL <= 0) continue;
    const c0 = X - h0 * cot, c1 = X + DX - h1 * cot;
    if ((c0 < -2 && c1 < -2) || (c0 > W + 1 && c1 > W + 1)) continue;
    const o = i * 6, wat = cs[o], town = cs[o + 1], fo = cs[o + 2], rock = cs[o + 3], fs = cs[o + 4], fv = cs[o + 5];
    const C1 = cL, C2 = cL * cL, C3 = C2 * cL, C8 = C3 * C3 * C2;
    const land = 1 - wat;
    const field = max(0, land - fo - rock - town);
    let S = field * fs * C3 + fo * 0.05 * C2 + rock * 0.4 * C1 * sqrt(C1) + town * 0.3 * C2 + wat * 0.012 * C8;
    let V = field * fv * C1 + fo * 0.26 * C1 + rock * 0.12 * C1 + town * 0.1 * C1;
    const hb = hv(floor(X / 2), floor(n / 2), 91), ho = hv(floor(X / 5), floor(n / 5), 92);
    let D = field * 0.015 * C1 + fo * 0.04 * C1 + rock * 0.15 * C2 + town * (hb < 0.22 ? 0.06 : 0.5 + 0.5 * hb) * (0.45 + 0.55 * ho) * 1.4 * C1;
    deposit(es, c0, c1, S * DX);
    deposit(ev, c0, c1, V * DX);
    deposit(ed, c0, c1, D * DX);
  }
  hp.set(hh.subarray(0, NS));
  s.prevN = n; s.prevK3 = s.k[2]; s.prevK4 = s.k[3]; s.prevNS = NS;
  // range blur, speckle, noise floor, then amplitude to display
  const slot = ((n % NB) + NB) % NB, base = slot * W;
  for (let c = 0; c < W; c++) {
    const i = c + 2;
    const bs = (es[i - 1] + 2 * es[i] + es[i + 1]) * 0.25;
    const bv = (ev[i - 1] + 2 * ev[i] + ev[i + 1]) * 0.25;
    const bd = (ed[i - 1] + 2 * ed[i] + ed[i + 1]) * 0.25;
    const sp = speckle(c, n);
    const N0 = 0.0015;
    s.R[base + c] = disp(1.3 * sqrt((bd + N0) * sp));
    s.Gc[base + c] = disp(1.2 * sqrt((bv + N0) * sp));
    s.B[base + c] = disp(1.25 * sqrt((bs + N0) * sp));
  }
  s.ln[slot] = n; s.lk3[slot] = s.k[2]; s.lk4[slot] = s.k[3];
}

const LOOKS = 1;
function gam(c, n) {
  let p = 1;
  for (let k = 0; k < LOOKS; k++) p *= 1e-6 + hv(c * 3 + k, n, 101);
  return -log(p) / LOOKS;
}
function speckle(c, n) {
  let t = 0;
  for (let j = -1; j <= 1; j++) {
    const wj = j === 0 ? 2 : 1;
    for (let i = -1; i <= 1; i++) t += wj * (i === 0 ? 2 : 1) * gam(c + i, n + j);
  }
  return t / 16;
}
const disp = (a) => {
  return a < 0.8 ? a : 0.8 + 0.2 * (1 - exp(-(a - 0.8) / 0.2));
};

function readKnobs(s, input) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
}

function ensure(s, maxRegen) {
  const top = floor(s.P) + 1;
  for (let n = s.top + 1; n <= top; n++) makeLine(s, n);
  if (top > s.top) s.top = top;
  // lines made at other knob settings are made again, a few a frame, from a cursor that goes round the panel
  const lo = top - H - 1, span = H + 2;
  let done = 0, k = 0;
  for (; k < span && done < maxRegen; k++) {
    const n = lo + ((s.cur + k) % span), slot = ((n % NB) + NB) % NB;
    if (s.ln[slot] !== n || s.lk3[slot] !== s.k[2] || s.lk4[slot] !== s.k[3]) { makeLine(s, n); done++; }
  }
  s.cur = (s.cur + k) % span;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  readKnobs(s, input);
  if (!s.init) {
    s.init = true;
    s.P = s.n0;
    s.top = floor(s.P) - H - 3;
    ensure(s, 1e9);
  }
  const v = 4 * cl(s.k[1], 0.25, 3);
  s.P += v * cl(dt || 0, 0, 0.1);
  ensure(s, 8);
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (!s.init) update(0, null, params);
  const a = s.k[0] * 2 * PI, ca = cos(a), sa = sin(a), k3 = (1 - ca) / 3, sq = sqrt(1 / 3) * sa;
  const m00 = ca + k3, m01 = k3 - sq, m02 = k3 + sq;
  const m10 = k3 + sq, m11 = ca + k3, m12 = k3 - sq;
  const m20 = k3 - sq, m21 = k3 + sq, m22 = ca + k3;
  for (let y = 0; y < H; y++) {
    const az = s.P - y, n = floor(az), f = az - n;
    const sa0 = (((n % NB) + NB) % NB) * W, sa1 = ((((n + 1) % NB) + NB) % NB) * W;
    for (let x = 0; x < W; x++) {
      const r = s.R[sa0 + x] * (1 - f) + s.R[sa1 + x] * f;
      const g = s.Gc[sa0 + x] * (1 - f) + s.Gc[sa1 + x] * f;
      const b = s.B[sa0 + x] * (1 - f) + s.B[sa1 + x] * f;
      const rr = max(0, m00 * r + m01 * g + m02 * b), gg = max(0, m10 * r + m11 * g + m12 * b), bb = max(0, m20 * r + m21 * g + m22 * b);
      display.setPixel(x, y, min(255, 5 + rr * 250) | 0, min(255, 8 + gg * 247) | 0, min(255, 28 + bb * 227) | 0);
    }
  }
}
