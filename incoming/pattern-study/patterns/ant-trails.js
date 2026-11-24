// ===== Patternflow pattern =====
// Title:   Ant Trails
// Family:  stigmergy
// Idea:    Ants leave a glowing nest, find food patches and carry bits home, and the pheromone trails they lay and climb grow into bright roads that thicken with traffic, fade when a patch is eaten empty and bend round slowly drifting rocks.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: stigmergic foraging as in the double-bridge experiment (Jean-Louis Deneubourg, Serge Aron, Simon Goss and Jacques Pasteels, 1990) and the ant system (Marco Dorigo, 1992), pheromone-field agents with home and food trails, from memory, pattern round 229
// Round:   229
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ants=0.4..3, Memory=-1..1, Foods=-1..1
//
// Knob 1: Hue. Where the palette starts, once round: at 0 the home trail is blue, the food trail gold, the nest magenta and the rocks violet; at 0.25 magenta, teal, orange and rose; at 0.5 orange, violet, teal and lime; at 0.75 teal, magenta, blue and cyan. The whole palette also turns once round the wheel in 100 seconds, so no two minutes share colours.
// Knob 2: Ants. Colony size, 38 ants at 0.4, 128 at 2 where it opens and 184 at 3. More ants lay bolder roads and strip a patch faster, so the food moves on sooner.
// Knob 3: Memory. How long a trail lasts, 2.4 seconds at -1, 12 at 0 where it opens and 60 at +1. Short, the ants wander in a scatter of comet tails; long, the roads are hard-wired and slow to re-route when the food is gone or a rock settles on them.
// Knob 4: Foods. How many food patches lie on the ground at once, 1 at -1, 3 at 0.06 where it opens and 5 at +1. With one, the whole colony works a single trunk road until it is empty; with five it splits into a net of roads.

const W = 64, H = 128;
const GW = 40, GH = 80, PW = GW + 2, PN = PW * (GH + 2);
const SC = 1.6;                 // LEDs per grid cell
const MAXA = 220, NSL = 5, NRK = 4;
const NX = 19.5, NY = 66.5, NR = 3.1;   // the nest, in cells
const { floor, sqrt, exp, sin, cos, atan2, abs, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const gz = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
const rr = (a, b) => a + (b - a) * Math.random();

// ---- ant and trail constants -------------------------------------------------
const SDIST = 1.9;              // sensor reach, cells
const CSA = cos(0.6), SSA = sin(0.6);
const OMEGA = 7;                // fastest turn, rad/s
const TD = 11;                  // a trail laid this long after the last visit is e-fold weaker, seconds
const D0 = 1.0;                 // deposit per second at full strength
const PMAX = 40;
const WD2 = 0.8;                // road width squared, cells squared, held by D = WD2 / memory
const GSTEP = 1 / 30;

// ---- palette -----------------------------------------------------------------
const STOPS = [
  [0.0, 0, 214, 230], [0.15, 36, 130, 255], [0.3, 124, 80, 255], [0.44, 232, 60, 232],
  [0.57, 255, 66, 140], [0.65, 255, 118, 72], [0.72, 255, 200, 70], [0.8, 130, 236, 80], [0.9, 20, 222, 150], [1.0, 0, 214, 230],
];
const PL = new Float32Array(1024 * 3);
for (let i = 0; i < 1024; i++) {
  const f = i / 1024;
  let k = 0;
  while (STOPS[k + 1][0] < f) k++;
  const A = STOPS[k], B = STOPS[k + 1], u = (f - A[0]) / (B[0] - A[0]);
  for (let c = 0; c < 3; c++) PL[i * 3 + c] = (A[c + 1] + (B[c + 1] - A[c + 1]) * u) / 255;
}
function pal(p, out) {
  const i = (((p % 1) + 1) % 1 * 1024 | 0) * 3;
  out[0] = PL[i]; out[1] = PL[i + 1]; out[2] = PL[i + 2];
}

// ---- value noise for the ground ----------------------------------------------
function ihash(n) {
  let h = (n | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const ix = floor(x), iy = floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const h = (a, b) => ihash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(seed, 83492791));
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

// ---- state -------------------------------------------------------------------
export function setup(P) {
  P.ready = false;
  P.t = 0;
  const F32 = (n) => new Float32Array(n);
  P.F = F32(PN); P.F2 = F32(PN); P.Hh = F32(PN); P.H2 = F32(PN); P.M = F32(PN);
  P.SD = F32(GW * GH);
  P.ax = F32(MAXA); P.ay = F32(MAXA); P.ath = F32(MAXA); P.adep = F32(MAXA); P.asp = F32(MAXA);
  P.asc = F32(MAXA); P.aage = F32(MAXA); P.ahue = F32(MAXA); P.asg = F32(MAXA);
  P.amd = new Uint8Array(MAXA); P.aon = new Uint8Array(MAXA);
  P.ps = new Uint8Array(NSL); P.px = F32(NSL); P.py = F32(NSL); P.pr = F32(NSL); P.pam = F32(NSL);
  P.pcap = F32(NSL); P.prate = F32(NSL); P.pcool = F32(NSL); P.pq = F32(NSL); P.pfade = F32(NSL); P.pw = F32(NSL); P.phue = F32(NSL); P.pflash = F32(NSL);
  P.rk = [];
  P.recent = [];
  P.gacc = 0; P.rtimer = 0; P.hd = 0;
  P.nest = 0;
  P.refF = 1; P.refH = 1;
  P.nA = 100; P.nf = 3; P.tau = 14;
  // frame tables: where each LED sits in the pheromone grid
  P.tI = new Int32Array(W * H); P.tS = new Int32Array(W * H); P.tX = F32(W * H); P.tY = F32(W * H);
  P.T1 = F32(W * H); P.T2 = F32(W * H);
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const p = Y * W + X;
      const u = cl((X + 0.5) / SC - 0.5, 0, GW - 1.0001), v = cl((Y + 0.5) / SC - 0.5, 0, GH - 1.0001);
      const x0 = u | 0, y0 = v | 0;
      P.tI[p] = (y0 + 1) * PW + x0 + 1; P.tS[p] = y0 * GW + x0; P.tX[p] = u - x0; P.tY[p] = v - y0;
      for (const [T, s] of [[P.T1, 5], [P.T2, 9]]) {
        T[p] = 0.55 * vnoise(X / 11, Y / 11, s) + 0.45 * vnoise(X / 4.6, Y / 4.6, s + 1);
      }
    }
  P.ob = F32(W * H * 3);
  P.cF = [0, 0, 0]; P.cH = [0, 0, 0]; P.cN = [0, 0, 0]; P.cR = [0, 0, 0];
}

// ---- rocks -------------------------------------------------------------------
function newRock(P, r, first) {
  const a1 = rr(3.0, 4.8), b1 = rr(2.3, 3.6), a2 = rr(2.2, 3.6), b2 = rr(1.8, 3.0);
  r.a1 = a1; r.b1 = b1; r.p1 = rr(0, PI); r.a2 = a2; r.b2 = b2; r.p2 = rr(0, PI);
  const oa = rr(0, TAU), od = rr(1.6, 3.2);
  r.ox = cos(oa) * od; r.oy = sin(oa) * od;
  const rad = max(a1, od + a2) + 1;
  // out of the nest's yard, away from the food and the other rocks; two times in three across the line between the nest and a patch
  let bx = 20, by = 30, best = -1;
  for (let tries = 0; tries < 24; tries++) {
    let x, y;
    const live = [];
    for (let s = 0; s < NSL; s++) if (P.ps[s] === 1) live.push(s);
    if (live.length && Math.random() < 0.65) {
      const s = live[(Math.random() * live.length) | 0];
      const t = rr(0.3, 0.8), dx = P.px[s] - NX, dy = P.py[s] - NY, dl = sqrt(dx * dx + dy * dy) || 1;
      const lat = rr(-3.5, 3.5);
      x = NX + dx * t - dy / dl * lat; y = NY + dy * t + dx / dl * lat;
    } else { x = rr(rad + 1, GW - 1 - rad); y = rr(rad + 1, GH - 1 - rad); }
    if (x < rad || x > GW - 1 - rad || y < rad || y > GH - 1 - rad) continue;
    const dn = sqrt((x - NX) * (x - NX) + (y - NY) * (y - NY));
    if (dn < rad + 9) continue;
    let sc = 1e9;
    for (let s = 0; s < NSL; s++) if (P.ps[s] === 1) sc = min(sc, sqrt((x - P.px[s]) ** 2 + (y - P.py[s]) ** 2) - P.pr[s] - rad);
    if (sc < 3) continue;
    for (const o of P.rk) if (o !== r && o.s > 0.05) sc = min(sc, sqrt((x - o.x) ** 2 + (y - o.y) ** 2) - rad - 5);
    if (sc < 2) continue;
    const score = min(sc, 14) + Math.random() * 4;
    if (score > best) { best = score; bx = x; by = y; }
  }
  if (best < 0) { bx = rr(8, GW - 8); by = rr(8, GH - 28); }
  r.x = bx; r.y = by;
  const va = rr(0, TAU), vs = rr(0.02, 0.07);
  r.vx = cos(va) * vs; r.vy = sin(va) * vs;
  r.state = first ? 1 : 0; r.s = first ? 1 : 0;
  r.life = rr(28, 75);
}

function stepRocks(P, dt) {
  for (const r of P.rk) {
    r.life -= dt;
    if (r.state === 0) { r.s += dt / 9; if (r.s >= 1) { r.s = 1; r.state = 1; } }
    else if (r.state === 1) { if (r.life <= 0) r.state = 2; }
    else { r.s -= dt / 9; if (r.s <= 0) { r.s = 0; newRock(P, r, false); } }
    if (r.s <= 0) continue;
    // a slow drift that turns now and then, pushed off the nest and the food
    r.vx += gz() * 0.004 * sqrt(dt) * 6; r.vy += gz() * 0.004 * sqrt(dt) * 6;
    const sp = sqrt(r.vx * r.vx + r.vy * r.vy);
    if (sp > 0.08) { r.vx *= 0.08 / sp; r.vy *= 0.08 / sp; }
    let px = 0, py = 0;
    const rad = max(r.a1, sqrt(r.ox * r.ox + r.oy * r.oy) + r.a2);
    let dx = r.x - NX, dy = r.y - NY, d = sqrt(dx * dx + dy * dy) + 1e-6;
    if (d < rad + 11) { px += dx / d * (rad + 11 - d); py += dy / d * (rad + 11 - d); }
    for (let s = 0; s < NSL; s++) {
      if (!P.ps[s]) continue;
      dx = r.x - P.px[s]; dy = r.y - P.py[s]; d = sqrt(dx * dx + dy * dy) + 1e-6;
      const lim = rad + P.pr[s] + 3;
      if (d < lim) { px += dx / d * (lim - d); py += dy / d * (lim - d); }
    }
    r.x += (r.vx + px * 0.25) * dt; r.y += (r.vy + py * 0.25) * dt;
    if (r.x < rad + 1) { r.x = rad + 1; r.vx = abs(r.vx); }
    if (r.x > GW - 2 - rad) { r.x = GW - 2 - rad; r.vx = -abs(r.vx); }
    if (r.y < rad + 1) { r.y = rad + 1; r.vy = abs(r.vy); }
    if (r.y > GH - 2 - rad) { r.y = GH - 2 - rad; r.vy = -abs(r.vy); }
  }
}

// signed distance to the nearest rock in cells, negative inside, and the open mask for the trails
function buildSdf(P) {
  const { SD, M } = P;
  SD.fill(9);
  for (const r of P.rk) {
    const s = smooth(r.s);
    if (s < 0.02) continue;
    const c1 = cos(r.p1), s1 = sin(r.p1), c2 = cos(r.p2), s2 = sin(r.p2);
    const A1 = r.a1 * s, B1 = r.b1 * s, A2 = r.a2 * s, B2 = r.b2 * s;
    const ex = r.x + r.ox * s, ey = r.y + r.oy * s;
    const R = max(A1, sqrt(r.ox * r.ox + r.oy * r.oy) * s + A2) + 4;
    const x0 = max(0, floor(r.x - R)), x1 = min(GW - 1, floor(r.x + R) + 1);
    const y0 = max(0, floor(r.y - R)), y1 = min(GH - 1, floor(r.y + R) + 1);
    const m1 = min(A1, B1), m2 = min(A2, B2);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let dx = x - r.x, dy = y - r.y;
        let u = dx * c1 + dy * s1, v = -dx * s1 + dy * c1;
        const d1 = (sqrt((u * u) / (A1 * A1) + (v * v) / (B1 * B1)) - 1) * m1;
        dx = x - ex; dy = y - ey;
        u = dx * c2 + dy * s2; v = -dx * s2 + dy * c2;
        const d2 = (sqrt((u * u) / (A2 * A2) + (v * v) / (B2 * B2)) - 1) * m2;
        const h = max(1.4 - abs(d1 - d2), 0) / 1.4;
        const d = min(d1, d2) - h * h * 0.35;
        const k = y * GW + x;
        if (d < SD[k]) SD[k] = d;
      }
  }
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) M[(y + 1) * PW + x + 1] = SD[y * GW + x] > 0.2 ? 1 : 0;
}

function sdfAt(SD, x, y) {
  x = x < 0 ? 0 : x > GW - 1.001 ? GW - 1.001 : x; y = y < 0 ? 0 : y > GH - 1.001 ? GH - 1.001 : y;
  const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, k = iy * GW + ix;
  return (SD[k] * (1 - fx) + SD[k + 1] * fx) * (1 - fy) + (SD[k + GW] * (1 - fx) + SD[k + GW + 1] * fx) * fy;
}

// ---- food patches --------------------------------------------------------------
function spawnPatch(P, s) {
  const rate = rr(0.8, 1.35) * (0.55 + P.nA / 160);
  const cap = cl(rr(16, 55) * rate * 0.8, 16, 400);
  const pr = cl((2.6 + 2.2 * sqrt(cap / 90)) * rr(0.88, 1.12), 3.0, 5.4);
  let bx = 20, by = 30, best = -1;
  for (let tries = 0; tries < 30; tries++) {
    const m = 3.5 + pr;
    const x = rr(m, GW - 1 - m), y = rr(m, GH - 1 - m);
    if (sqrt((x - NX) ** 2 + (y - NY) ** 2) < 16 + pr) continue;
    if (sdfAt(P.SD, x, y) < pr + 3.5) continue;
    let gap = 40, near = 40;
    for (let o = 0; o < NSL; o++) if (o !== s && P.ps[o]) gap = min(gap, sqrt((x - P.px[o]) ** 2 + (y - P.py[o]) ** 2) - pr - P.pr[o]);
    if (gap < 9) continue;
    for (const q of P.recent) near = min(near, sqrt((x - q[0]) ** 2 + (y - q[1]) ** 2));
    const score = min(gap, 20) + min(near, 20) + Math.random() * 12;
    if (score > best) { best = score; bx = x; by = y; }
  }
  if (best < 0) { bx = rr(6, GW - 6); by = rr(6, 50); }
  P.px[s] = bx; P.py[s] = by; P.pr[s] = pr; P.pam[s] = cap; P.pcap[s] = cap; P.prate[s] = rate; P.pcool[s] = 0;
  P.pq[s] = rr(0.75, 1.3); P.pfade[s] = 0; P.ps[s] = 1; P.phue[s] = rr(-0.05, 0.05);
  P.recent.push([bx, by]);
  if (P.recent.length > 4) P.recent.shift();
}

function stepPatches(P, dt) {
  for (let s = 0; s < NSL; s++) {
    const on = s < P.nf;
    const st = P.ps[s];
    P.pflash[s] *= exp(-dt * 4);
    if (P.pcool[s] > 0) P.pcool[s] -= dt;
    if (st === 0) {
      if (on) { P.pw[s] -= dt; if (P.pw[s] <= 0) spawnPatch(P, s); }
    } else if (st === 1) {
      P.pfade[s] = min(1, P.pfade[s] + dt / 4);
      if (P.pam[s] <= 0.5 || !on) { P.ps[s] = 2; P.pam[s] = 0; }
    } else {
      P.pfade[s] -= dt / 4;
      // the food trail that led here is wiped round the emptied patch, so the ants that climb it do not stay
      const cx = P.px[s], cy = P.py[s], R = P.pr[s] + 4;
      const x0 = max(0, floor(cx - R)), x1 = min(GW - 1, floor(cx + R) + 1), y0 = max(0, floor(cy - R)), y1 = min(GH - 1, floor(cy + R) + 1);
      const k = exp(-dt * 1.3);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < R * R) P.F[(y + 1) * PW + x + 1] *= k;
      if (P.pfade[s] <= 0) { P.ps[s] = 0; P.pw[s] = rr(1.5, 6); }
    }
  }
}

// ---- ants --------------------------------------------------------------------
function spawnAnt(P, i) {
  const a = rr(0, TAU), d = rr(0, 2);
  P.ax[i] = NX + cos(a) * d; P.ay[i] = NY + sin(a) * d;
  P.ath[i] = a + gz() * 0.4; P.amd[i] = 0; P.aon[i] = 1; P.adep[i] = 1; P.aage[i] = 0;
  P.asp[i] = 4.2 * rr(0.86, 1.14); P.asc[i] = Math.random() < 0.16 ? 1 : 0; P.ahue[i] = 0;
}

function stepAnts(P, dt) {
  const { ax, ay, ath, adep, asp, asc, aage, ahue, amd, aon, F, Hh, SD } = P;
  const sq = sqrt(dt), ddec = exp(-dt / TD), nF = 1 / P.refF, nH = 1 / P.refH;
  const dtD = D0 * dt;
  for (let i = 0; i < MAXA; i++) {
    if (!aon[i]) { if (i < P.nA) spawnAnt(P, i); else continue; }
    else if (i >= P.nA && amd[i] !== 2) { amd[i] = 2; adep[i] = 0; }
    let x = ax[i], y = ay[i], th = ath[i];
    const md = amd[i], sc = asc[i];
    const c = cos(th), s = sin(th);
    let vx = c, vy = s;
    let sg = 0, hx, hy, dn, dxn, dyn;
    // sense the trail this ant needs: the food trail while searching, the home trail while carrying
    if (md < 2) {
      const fld = md === 1 ? Hh : F, nrm = md === 1 ? nH : nF;
      const k0 = ((y + 0.5) | 0) * PW + ((x + 0.5) | 0) + PW + 1;
      const v0 = fld[k0];
      let gx = 0, gy = 0, lv = v0;
      for (let q = -1; q <= 1; q++) {
        const cq = q === 0 ? c : c * CSA - q * s * SSA, sq2 = q === 0 ? s : s * CSA + q * c * SSA;
        let sx = x + cq * SDIST, sy = y + sq2 * SDIST;
        sx = sx < 0 ? 0 : sx > GW - 1 ? GW - 1 : sx; sy = sy < 0 ? 0 : sy > GH - 1 ? GH - 1 : sy;
        const val = fld[((sy + 0.5) | 0) * PW + ((sx + 0.5) | 0) + PW + 1];
        gx += (val - v0) * cq; gy += (val - v0) * sq2; lv += val;
      }
      const level = lv * 0.25 * nrm, gm = sqrt(gx * gx + gy * gy) * nrm;
      sg = (level / (level + 0.1)) * (gm / (gm + 0.04)) * (sc ? 0.35 : 1);
      if (gm > 1e-9) { const w = 3.6 * sg / (gm / nrm); vx += gx * w; vy += gy * w; }
    }
    P.asg[i] += (sg - P.asg[i]) * (dt * 3 > 1 ? 1 : dt * 3);
    // home: the pull of the nest a carrying ant remembers, and the push away from it of one that has just left
    dxn = NX - x; dyn = NY - y; dn = sqrt(dxn * dxn + dyn * dyn) + 1e-6;
    if (md >= 1) {
      const hb = 0.3 + 1.0 * smooth(1 - dn / 15);
      vx += dxn / dn * hb; vy += dyn / dn * hb;
    } else if (aage[i] < 6) {
      const w = 0.7 * (1 - aage[i] / 6);
      vx -= dxn / dn * w; vy -= dyn / dn * w;
    }
    // rocks: look ahead and turn away along the edge
    const lx = x + c * 2.7, ly = y + s * 2.7, sa = sdfAt(SD, lx, ly);
    if (sa < 1.5) {
      let nx = sdfAt(SD, lx + 0.6, ly) - sdfAt(SD, lx - 0.6, ly), ny = sdfAt(SD, lx, ly + 0.6) - sdfAt(SD, lx, ly - 0.6);
      const nl = sqrt(nx * nx + ny * ny) + 1e-9;
      nx /= nl; ny /= nl;
      const push = (1.5 - sa) / 1.5, sgn = (-ny * c + nx * s) >= 0 ? 1 : -1;
      vx += (nx * 1.4 - ny * sgn * 1.4) * push; vy += (ny * 1.4 + nx * sgn * 1.4) * push;
    }
    // heading: a persistent random walk, quieter on a trail
    const sig = (md === 0 ? 1.3 : 0.75) * (sc ? 1.45 : 1) * (1 - 0.65 * sg);
    th += gz() * sig * sq;
    // the steering vector with the noisy heading in place of the old one
    const want = atan2(vy + (sin(th) - s), vx + (cos(th) - c));
    let dth = want - ath[i];
    dth -= TAU * floor((dth + PI) / TAU);
    const lim = OMEGA * dt;
    th = ath[i] + cl(dth, -lim, lim);
    // move
    const sp = asp[i] * (md === 1 ? 0.92 : 1);
    x += cos(th) * sp * dt; y += sin(th) * sp * dt;
    if (x < 0.3) { x = 0.3; th = PI - th; } else if (x > GW - 1.3) { x = GW - 1.3; th = PI - th; }
    if (y < 0.3) { y = 0.3; th = -th; } else if (y > GH - 1.3) { y = GH - 1.3; th = -th; }
    // out of any rock the ants are pushed, and turned along its edge
    const sd = sdfAt(SD, x, y);
    if (sd < 0.5) {
      let nx = sdfAt(SD, x + 0.5, y) - sdfAt(SD, x - 0.5, y), ny = sdfAt(SD, x, y + 0.5) - sdfAt(SD, x, y - 0.5);
      const nl = sqrt(nx * nx + ny * ny) + 1e-9;
      nx /= nl; ny /= nl;
      x += nx * (0.55 - sd); y += ny * (0.55 - sd);
      const hxn = cos(th), hyn = sin(th), sgn = (-ny * hxn + nx * hyn) >= 0 ? 1 : -1;
      th = atan2(ny * 0.25 + nx * sgn, nx * 0.25 - ny * sgn);
    }
    // the nest and the food
    aage[i] += dt;
    if (md === 0) {
      for (let p = 0; p < NSL; p++) {
        if (P.ps[p] !== 1) continue;
        const rv = P.pr[p] * (0.55 + 0.45 * sqrt(P.pam[p] / P.pcap[p])) * min(1, P.pfade[p] * 2) + 0.7;
        const dx = x - P.px[p], dy = y - P.py[p];
        if (dx * dx + dy * dy < rv * rv && P.pam[p] > 0.5 && P.pcool[p] <= 0) {
          P.pam[p] -= 1; P.pflash[p] = 1; P.pcool[p] = 1 / P.prate[p];
          amd[i] = 1; adep[i] = P.pq[p]; ahue[i] = P.phue[p]; aage[i] = 0;
          th += PI + gz() * 0.4;
          break;
        }
      }
    } else {
      dxn = NX - x; dyn = NY - y;
      if (dxn * dxn + dyn * dyn < NR * NR) {
        if (amd[i] === 1) P.nest = min(1.5, P.nest + 0.1);
        if (i >= P.nA) { aon[i] = 0; continue; }
        amd[i] = 0; adep[i] = 1; aage[i] = 0;
        th = atan2(y - NY, x - NX) + gz() * 0.7;
      }
    }
    adep[i] *= ddec;
    // lay the trail: bilinear, soft-saturated
    if (adep[i] > 0.01) {
      const fld = amd[i] === 1 ? F : Hh;
      const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, k = (iy + 1) * PW + ix + 1, a = adep[i] * dtD;
      const w0 = (1 - fx) * (1 - fy) * a, w1 = fx * (1 - fy) * a, w2 = (1 - fx) * fy * a, w3 = fx * fy * a;
      fld[k] += w0 * (1 - fld[k] / PMAX); fld[k + 1] += w1 * (1 - fld[k + 1] / PMAX);
      fld[k + PW] += w2 * (1 - fld[k + PW] / PMAX); fld[k + PW + 1] += w3 * (1 - fld[k + PW + 1] / PMAX);
    }
    ax[i] = x; ay[i] = y; ath[i] = th;
  }
}

// ---- the trail field ------------------------------------------------------------
function stepGrid(P, h) {
  const { M } = P;
  const tau = P.tau, dec = exp(-h / tau), dk = min(0.2, (WD2 / tau) * h);
  let mxF = 0, mxH = 0;
  for (let f = 0; f < 2; f++) {
    const A = f === 0 ? P.F : P.Hh, B = f === 0 ? P.F2 : P.H2;
    let mx = 0;
    for (let y = 0; y < GH; y++) {
      let k = (y + 1) * PW + 1;
      for (let x = 0; x < GW; x++, k++) {
        const a = A[k];
        const s = M[k - 1] * (A[k - 1] - a) + M[k + 1] * (A[k + 1] - a) + M[k - PW] * (A[k - PW] - a) + M[k + PW] * (A[k + PW] - a);
        const v = M[k] * (a + dk * s) * dec;
        B[k] = v;
        if (v > mx) mx = v;
      }
    }
    if (f === 0) { P.F = B; P.F2 = A; mxF = mx; } else { P.Hh = B; P.H2 = A; mxH = mx; }
  }
  // the picture's gain follows the busiest road, slowly, so a thin colony and a fat one both read
  const kk = 1 - exp(-h / 5);
  P.refF += (max(0.25 * tauGain(tau), mxF * 0.6) - P.refF) * kk;
  P.refH += (max(0.25 * tauGain(tau), mxH * 0.6) - P.refH) * kk;
}
const tauGain = (tau) => pow(tau / 14, 0.7) * 1.2;

// ---- advance -----------------------------------------------------------------
function advance(P, dt) {
  P.t += dt;
  P.hd += dt / 100;
  P.nest *= exp(-dt * 2.2);
  P.rtimer -= dt;
  stepPatches(P, dt);
  stepRocks(P, dt);
  if (P.rtimer <= 0) { buildSdf(P); P.rtimer = 0.2; }
  stepAnts(P, dt);
  P.gacc += dt;
  if (P.gacc >= GSTEP) { stepGrid(P, P.gacc); P.gacc = 0; }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  P.hue = cl(kv[0], 0, 1);
  const ants = cl(kv[1], 0.4, 3), mem = cl(kv[2], -1, 1), foods = cl(kv[3], -1, 1);
  P.nA = floor(16 + 56 * ants);
  P.tau = 12 * pow(5, mem);
  P.nf = cl(Math.round(3 + 2 * foods), 1, 5);
  if (!P.ready) {
    P.ready = true;
    for (let i = 0; i < NRK; i++) { const r = {}; P.rk.push(r); newRock(P, r, true); }
    buildSdf(P);
    for (let s = 0; s < NSL; s++) P.pw[s] = rr(0, 0.5);
    for (let k = 0; k < 40; k++) stepPatches(P, 0.5);
    for (let s = 0; s < NSL; s++) if (P.ps[s]) P.pfade[s] = 1;
    // a rock may have been placed before the food, so settle them against each other
    buildSdf(P);
    for (let k = 0; k < 1200; k++) advance(P, 0.07);
    P.hd = 0;
  }
  advance(P, d);
}

// ---- drawing ---------------------------------------------------------------------
function splat(ob, lx, ly, rad, soft, r, g, b, k) {
  const x0 = max(0, floor(lx - rad)), x1 = min(W - 1, floor(lx + rad)), y0 = max(0, floor(ly - rad)), y1 = min(H - 1, floor(ly + rad));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - lx, dy = y + 0.5 - ly, d = sqrt(dx * dx + dy * dy);
      const w = cl((rad - d) / soft, 0, 1) * k;
      if (w <= 0) continue;
      const o = (y * W + x) * 3;
      ob[o] += r * w; ob[o + 1] += g * w; ob[o + 2] += b * w;
    }
}

export function draw(display, P) {
  const { F, Hh, SD, ob, tI, tS, tX, tY, T1, T2, cF, cH, cN, cR } = P;
  const h0 = 0.02 + P.hue + P.hd;
  pal(h0 + 0.14, cH); pal(h0 + 0.70, cF); pal(h0 + 0.40, cN); pal(h0 + 0.30, cR);
  ob.fill(0);
  const tw = 0.5 + 0.5 * sin(P.t * 0.071);
  const thF = 0.03 * P.refF, thH = 0.03 * P.refH, nrF = 1 / P.refF, nrH = 1 / P.refH;
  // the nest, a ring and a soft disc
  {
    const lx = (NX + 0.5) * SC, ly = (NY + 0.5) * SC, Rr = NR * SC, R = Rr + 9;
    const k = 1 + P.nest * 0.9;
    const x0 = max(0, floor(lx - R)), x1 = min(W - 1, floor(lx + R)), y0 = max(0, floor(ly - R)), y1 = min(H - 1, floor(ly + R));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - lx, dy = y + 0.5 - ly, d = sqrt(dx * dx + dy * dy);
        const ring = exp(-((d - Rr) * (d - Rr)) / 1.5);
        const fill = d < Rr ? 0.3 + 0.2 * (1 - d / Rr) : 0;
        const halo = d >= Rr ? 0.3 * exp(-(d - Rr) / 3.2) : 0;
        const v = (0.8 * ring + fill + halo) * k;
        const o = (y * W + x) * 3;
        ob[o] += cN[0] * v + 0.25 * ring * k; ob[o + 1] += cN[1] * v + 0.22 * ring * k; ob[o + 2] += cN[2] * v + 0.3 * ring * k;
      }
  }
  // the food patches, discs of different glow
  for (let s = 0; s < NSL; s++) {
    if (!P.ps[s] || P.pfade[s] <= 0) continue;
    const fade = smooth(P.pfade[s]);
    const rv = P.pr[s] * (0.55 + 0.45 * sqrt(P.pam[s] / P.pcap[s])) * (0.3 + 0.7 * fade) * SC;
    const live = 0.65 + 0.35 * fade;
    const lx = (P.px[s] + 0.5) * SC, ly = (P.py[s] + 0.5) * SC, R = rv * 2.4 + 2;
    const col = [0, 0, 0];
    pal(h0 + 0.70 + P.phue[s], col);
    const q = (0.7 + 0.4 * P.pq[s]) * live * (1 + 0.5 * P.pflash[s]);
    const x0 = max(0, floor(lx - R)), x1 = min(W - 1, floor(lx + R)), y0 = max(0, floor(ly - R)), y1 = min(H - 1, floor(ly + R));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - lx, dy = y + 0.5 - ly, d = sqrt(dx * dx + dy * dy);
        const core = 1 - smooth((d - rv * 0.55) / (rv * 0.5 + 0.5));
        const halo = 0.22 * exp(-(d * d) / (rv * rv * 1.6));
        const v = (core * 0.85 + halo) * q, hot = core * core * 0.3 * q;
        const o = (y * W + x) * 3;
        ob[o] += col[0] * v + hot; ob[o + 1] += col[1] * v + hot; ob[o + 2] += col[2] * v + hot * 0.8;
      }
  }
  // the ants, 2 by 2 LED heads with a short fade tail
  {
    const pc = [0, 0, 0];
    for (let i = 0; i < MAXA; i++) {
      if (!P.aon[i]) continue;
      const md = P.amd[i];
      let r, g, b;
      const kb = md === 1 ? 1 : 0.55 + 0.45 * cl(P.asg[i] * 2.5, 0, 1);
      if (md === 1) { pal(h0 + 0.70 + P.ahue[i], pc); r = 0.55 + 0.45 * pc[0]; g = 0.55 + 0.45 * pc[1]; b = 0.4 + 0.3 * pc[2]; }
      else { r = 0.4 + 0.3 * cH[0]; g = 0.58 + 0.27 * cH[1]; b = 0.72 + 0.2 * cH[2]; }
      const lx = (P.ax[i] + 0.5) * SC, ly = (P.ay[i] + 0.5) * SC;
      const dxl = cos(P.ath[i]) * P.asp[i] * SC, dyl = sin(P.ath[i]) * P.asp[i] * SC;
      splat(ob, lx - dxl * 0.34, ly - dyl * 0.34, 1.3, 0.6, r, g, b, 0.2 * kb);
      splat(ob, lx - dxl * 0.16, ly - dyl * 0.16, 1.5, 0.7, r, g, b, 0.42 * kb);
      splat(ob, lx, ly, 1.45, 0.75, r, g, b, kb);
    }
  }
  // compose, every pixel
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const p = Y * W + X, k = tI[p], fx = tX[p], fy = tY[p];
      const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
      let f = F[k] * w00 + F[k + 1] * w01 + F[k + PW] * w10 + F[k + PW + 1] * w11;
      let h = Hh[k] * w00 + Hh[k + 1] * w01 + Hh[k + PW] * w10 + Hh[k + PW + 1] * w11;
      const ks = tS[p];
      const sd = SD[ks] * w00 + SD[ks + 1] * w01 + SD[ks + GW] * w10 + SD[ks + GW + 1] * w11;
      const g0 = T1[p] + (T2[p] - T1[p]) * tw;
      const gl = 0.055 + 0.075 * g0;
      const fn = f > thF ? (f - thF) * nrF : 0, hn = h > thH ? (h - thH) * nrH : 0, tot = fn + hn;
      const ratio = tot > 0 ? fn / tot : 0;
      const I = tot > 0 ? 0.82 * (1 - exp(-1.5 * tot)) * smooth(tot / (0.1 + 0.3 * ratio)) : 0;
      const hp = (((h0 + 0.14 + 0.56 * ratio) % 1) * 1024 | 0) & 1023, pi = hp * 3;
      const wv = 0;
      let r = (0.42 - 0.3 * g0) * gl + PL[pi] * I + wv;
      let g = (0.3 + 0.5 * g0) * gl + PL[pi + 1] * I + wv;
      let b = (1.0 - 0.1 * g0) * gl + PL[pi + 2] * I + wv + 0.035 * g0;
      if (sd < 3) {
        const cover = cl(0.5 - sd * 1.2, 0, 1);
        if (sd < 2) {
          // rim light on the side that faces the upper left
          const gx = (SD[ks + 1] - SD[ks]) * (1 - tY[p]) + (SD[ks + GW + 1] - SD[ks + GW]) * tY[p];
          const gy = (SD[ks + GW] - SD[ks]) * (1 - tX[p]) + (SD[ks + GW + 1] - SD[ks + 1]) * tX[p];
          const gl2 = sqrt(gx * gx + gy * gy) + 1e-6;
          const face = cl((-0.6 * gx - 0.8 * gy) / gl2, -1, 1);
          const rim = exp(-((sd + 0.2) * (sd + 0.2)) / 0.5) * (0.4 + 0.6 * max(face, 0));
          const inner = cover * (0.05 + 0.07 * exp(sd / 2));
          r = r * (1 - cover) + (cR[0] * 0.8 + 0.2) * rim + cR[0] * inner;
          g = g * (1 - cover) + (cR[1] * 0.8 + 0.2) * rim + cR[1] * inner;
          b = b * (1 - cover) + (cR[2] * 0.8 + 0.2) * rim + cR[2] * inner + 0.02 * cover;
        } else {
          const sh = 1 - 0.35 * (3 - sd);
          r *= sh; g *= sh; b *= sh;
        }
      }
      const o = p * 3;
      r = 1 - exp(-2.1 * r); g = 1 - exp(-2.1 * g); b = 1 - exp(-2.1 * b);
      const orr = ob[o], og = ob[o + 1], obb = ob[o + 2];
      r = 1 - (1 - r) * (1 - (orr > 1 ? 1 : orr)); g = 1 - (1 - g) * (1 - (og > 1 ? 1 : og)); b = 1 - (1 - b) * (1 - (obb > 1 ? 1 : obb));
      display.setPixel(X, Y, r * 255, g * 255, b * 255);
    }
}
