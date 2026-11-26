// ===== Patternflow pattern =====
// Title:   Melt Ponds
// Family:  meltpond
// Idea:    Arctic summer sea ice seen from straight above as it drifts slowly down the panel: white bumpy ice whose hollows fill with meltwater into ragged ponds, pale aqua at the shore through turquoise to deep blue where the water is deep, ponds that touch and join into one network as the melt rises past the percolation threshold, ponds that find a hole and empty into a pale bleached basin or freeze over with a pale lid, and now and then a dark navy lead with brash ice between two floes.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: melt ponds on Arctic sea ice, whose area jumps when separate ponds join into one network, modelled as the level set of a random ice topography (Christel Hohenegger and co-workers with Kenneth Golden, 2012, from memory), the feedback in which dark ponds melt their own floor deeper (Curry, Schramm and Ebert, 1995, from memory), and the drained, bleached basins and frozen lids of the late season (Eicken and co-workers, early 2000s, from memory). Original code, pattern round 264: a hummock and ridge height field on a one LED window that scrolls and turns with the floe, a water table found every 0.25 s as the quantile of the visible ice that gives the wandering pond cover, ponds found as 4-connected basins below it, drains and lids as events that act on a whole basin, and a floe polygon whose open edges are the leads.
// Round:   264
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Melt=0..4, Hummock=-1..1, Drain=-1..1
//
// Knob 1: Hue. Turns the colour of the water round the wheel, 0 to 360 degrees (0 and 1 are the same). At 0 the ponds run from pale aqua (176, 236, 236) at the shore through turquoise (46, 196, 214) and blue (14, 106, 196) to ultramarine (24, 40, 142) in the deepest water, the leads are navy (7, 22, 62) and the ice is white with blue-grey shadow (142, 172, 210). The leads turn with the water, the ice by a third of the angle so it stays pale. Opening at 0.
// Knob 2: Melt. How far the season has got, 0 to 4, opening at 2. The pond cover of the visible ice wanders round 8 percent at 0 (early-season pools), 38 percent at 2, where the ponds are near the percolation threshold and join and part again, and 68 percent at 4 (late-season sheets, the ice left as islands and ridges). The wander is two sines of 97 and 151 s, 4 to 8 points of cover each, and a random walk of 3.5 points, running 0.7 times as fast at 0 and 1.3 times at 4. The floor under a pond lowers 0.012 sigma a second at 0 and 0.024 at 4, so late-season ponds go dark faster.
// Knob 3: Hummock. The size of the ice relief, -1 to 1, opening at 0. The biggest hummocks are 11 LED across at -1, 21 at 0 and 48 at 1 (a factor 1.9 a step of the knob below 0 and 2.3 above), the ridges three times that, so the ponds run from 3 to 10 LED across at -1 to 15 to 50 at 1, and the shore keeps its detail down to about 4 LED. The knob eases over about a second and the ice swells or shrinks about the middle of the view.
// Knob 4: Drain. How often a pond finds a hole or freezes over, -1 to 1, opening at 0.06. Nothing happens below -0.94. The rate is 0.1 a second at 1 (one every 10 s) and 0.028 at the opening (one every 36 s, two or three running at once), 0.01 at -0.5. A pond that fills 9 percent of the panel or less drains six times in ten and otherwise freezes; a drain empties a pond at 0.05 sigma a second, holds the dry basin 20 to 55 s and refills it at 0.022 a second from the deepest point out; a lid grows over 20 s, holds 40 to 80 s and melts away over 32 s. The first frame holds one drained basin and one lid already at the opening and two of each at 1.

// What the picture is. The panel is the pack seen from a low flight at the height of summer. Ice and water are one height field h on a 152 by 152 window of one LED cells, anchored to the floe: the
// hummocks are three octaves of value noise at 1, 1/2.3 and 1/5.3 of the knob's size, each turned by a different angle and the lot warped by a slow noise, and the finest is faded out below 4 LED a wave, so a shore has ragged
// detail down to about 4 LED and no finer. Long ridges, where a noise of three times the size crosses its middle, stand up through it and dam the ponds. The floe is a Voronoi polygon, 100 LED a cell, and the edge it shares with the next floe
// is a closed ridge or an open lead: half of the edges are open, 2 to 9 LED wide, pinching and widening along their length. Ice lifts at the edge of a lead so a pond never reaches open water. The first update picks, from 60 places, the one that
// shows about a tenth of the panel as lead, so there is a lead in the first frame.
// The window moves with the ice. The view centre travels over the floe at 0.42 LED a second, slowly veering, and the view turns at up to 0.004 radian a second, so new ice enters at the top and old ice leaves at the bottom. When the centre has moved one cell,
// the arrays slide by one row or column and the strip that came in is made from the noise. A new strip starts with its floor already lowered where it lies under the water, so a pond comes in grown up. The noise coordinate is carried with the centre, so turning the
// Hummock knob scales the relief about the middle of the view and does not slide it.
// The water table is not a state that could run away. Every 0.25 s the level L is taken as the quantile of the visible ice (every other LED of the panel) that gives the wanted cover, and eased between the steps, so the cover is what the knob and the season
// say and the ponds are whatever the topography under the panel makes of it. The cover wanders round the Melt value, so the ponds keep passing the percolation threshold, where the ones that were apart join into a single network that spills together, and part again.
// A pond is a 4-connected basin of cells below L; a pixel is wet where L - dd - he is over zero, he the floor and dd the lowering of the pond's own level. The shore is anti-aliased by the slope, one LED wide, so a shore moves continuously.
// The floor lowers where it is wet, up to 0.38, and lifts back 0.0035 a second where dry, and the colour is read from the depth over it, so a pond that has been there for a minute is dark and a new one is pale and turquoise: the
// albedo feedback, held in bounds by that cap. A drain is an event on one basin: its deepest cell is the seed, the level of every cell of the basin follows the event's lowering, and the pond shrinks toward its deepest point, pales and goes, leaving a bleached basin with a white rim at the old shore
// that refills from the middle. When the basin joins another while the event runs, the lowering spreads to it at 0.15 sigma a second, so a network drains through one hole; an event whose basin has grown over 30 percent of the panel lets go in 10 s instead. A lid is the same kind of event that mixes the pond with pale blue-white by up to 0.85, patchy by a noise, so a frozen pond is
// pale and flat and keeps its outline. Events start only in basins with 40 pixels or more in view, never twice on one basin. The first update runs 100 s of this in 2.5 s steps before the first frame, so there are already networks, separate ponds, a drained basin and a lid.
// The dry ice is shaded by the slope of the smoother part of the relief against a light from the upper left, white on the lit side to blue-grey in shadow, with a mottle at 5 LED, a bluish bare-ice patch noise at 35 LED, and a damp tint about 1 LED wide above every shore.
// Leads are navy with a turquoise ledge where the submerged edge of the ice shows, and 3 to 5 LED chunks of brash ice that drift with the floe.

const W = 64, H = 128, NPX = W * H;
const M = 152, NC = M * M; // the window of one LED cells
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

// ---- colours. Each table is read by one number, 256 steps.
const POND_T = [0, 0.036, 0.107, 0.214, 0.34, 0.5, 0.714, 1]; // depth 0 to 4.2 sigma, to the 0.8 power
const POND_C = [[176, 236, 236], [128, 226, 228], [46, 196, 214], [18, 156, 208], [14, 106, 196], [14, 66, 172], [24, 40, 142], [26, 24, 112]];
const ICE_T = [0, 0.4, 0.7, 1];
const ICE_C = [[142, 172, 210], [184, 206, 232], [228, 240, 249], [250, 253, 255]];
const NAVY = [7, 22, 62], LEDGE = [22, 110, 150], BRASH = [186, 208, 226], LID = [198, 232, 242], BLEACH = [244, 250, 252], DAMP = [170, 214, 226], BARE = [176, 204, 226];

function ramp(T, C, v, out) {
  let k = 0;
  while (k < T.length - 2 && v > T[k + 1]) k++;
  const t = cl((v - T[k]) / (T[k + 1] - T[k]), 0, 1);
  for (let c = 0; c < 3; c++) out[c] = mix(C[k][c], C[k + 1][c], t);
}
// turn a colour round the wheel at constant luma
function rot(c, ang) {
  const cs = cos(ang), sn = sin(ang);
  const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], i = 0.596 * c[0] - 0.274 * c[1] - 0.322 * c[2], q = 0.211 * c[0] - 0.523 * c[1] + 0.312 * c[2];
  const i2 = i * cs - q * sn, q2 = i * sn + q * cs;
  return [cl(y + 0.956 * i2 + 0.621 * q2, 0, 255), cl(y - 0.272 * i2 - 0.647 * q2, 0, 255), cl(y - 1.106 * i2 + 1.703 * q2, 0, 255)];
}
function buildPalette(S, k1) {
  const ang = k1 * TAU, tmp = [0, 0, 0];
  const pc = POND_C.map((c) => rot(c, ang)), ic = ICE_C.map((c) => rot(c, ang * 0.33));
  for (let i = 0; i < 256; i++) {
    ramp(POND_T, pc, i / 255, tmp);
    S.pond[i * 3] = tmp[0]; S.pond[i * 3 + 1] = tmp[1]; S.pond[i * 3 + 2] = tmp[2];
    ramp(ICE_T, ic, i / 255, tmp);
    S.ice[i * 3] = tmp[0]; S.ice[i * 3 + 1] = tmp[1]; S.ice[i * 3 + 2] = tmp[2];
  }
  S.navy = rot(NAVY, ang); S.ledge = rot(LEDGE, ang); S.brash = rot(BRASH, ang * 0.33);
  S.lid = rot(LID, ang * 0.5); S.bleach = rot(BLEACH, ang * 0.2); S.damp = rot(DAMP, ang * 0.6); S.bare = rot(BARE, ang * 0.33);
}

// ---- the floe: Voronoi polygons whose edges are open leads or closed ridges. Returns through LF.
const GL = 100;
const LF = { lsd: 99, bump: 0 };
function leadField(X, Y) {
  const wx = X + 18 * (vnoise(X * 0.04 + 1.3, Y * 0.04, 51) - 0.5) + 6 * (vnoise(X * 0.11, Y * 0.11 + 5, 52) - 0.5);
  const wy = Y + 18 * (vnoise(X * 0.04, Y * 0.04 + 8.1, 53) - 0.5) + 6 * (vnoise(X * 0.11 + 9, Y * 0.11, 54) - 0.5);
  const gi = floor(wx / GL), gj = floor(wy / GL);
  let d1 = 1e18, d2 = 1e18, ax = 0, ay = 0, bx = 0, by = 0, ai = 0, aj = 0, bi = 0, bj = 0;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const i = gi + di, j = gj + dj;
      const sx = (i + 0.2 + 0.6 * hash(i, j, 61)) * GL, sy = (j + 0.2 + 0.6 * hash(i, j, 62)) * GL;
      const d = (wx - sx) * (wx - sx) + (wy - sy) * (wy - sy);
      if (d < d1) { d2 = d1; bx = ax; by = ay; bi = ai; bj = aj; d1 = d; ax = sx; ay = sy; ai = i; aj = j; }
      else if (d < d2) { d2 = d; bx = sx; by = sy; bi = i; bj = j; }
    }
  }
  const sep = sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
  const bis = (d2 - d1) / (2 * sep);
  const ka = Math.imul(ai, 73856093) ^ Math.imul(aj, 19349663), kb = Math.imul(bi, 73856093) ^ Math.imul(bj, 19349663);
  const key = hash((ka ^ kb) | 0, (ka + kb) | 0, 63);
  if (key > 0.5) {
    // open: half width 1 to 4.5 LED, pinching and swelling along the edge
    const along = ((wx - ax) * (by - ay) - (wy - ay) * (bx - ax)) / sep;
    const hw = (1 + 3.5 * (key - 0.5) * 2) * (0.35 + 1.15 * vnoise(along * 0.045 + key * 40, key * 9, 64));
    LF.lsd = bis - hw;
    LF.bump = 1.6 * exp(-max(LF.lsd, 0) / 4.5);
  } else {
    LF.lsd = bis + 3;
    LF.bump = 0.45 * exp(-bis / 2.2);
  }
}

// ---- the cells
const ARRS = ["H", "FL", "HE", "DD", "LID", "LSD", "BR", "TEX", "ALB", "BMP", "HS"];
const SCALE0 = 21;
const hummock = (k) => { k = cl(k, -1, 1); return SCALE0 * Math.pow(k < 0 ? 1.9 : 2.3, k); };

function makeState() {
  const S = {
    ready: false, t: 0, acc: 0, k: [0, 2, 0, 0.06], pal: -1,
    cx: 0, cy: 0, th: 0, ph: [0, 0, 0, 0, 0, 0], ou: 0, wob: 0,
    oi: 0, oj: 0, Sm: SCALE0, St: SCALE0, xa: 0, ya: 0, nax: 0, nay: 0,
    L: 0, Lt: 0, cover: 0.4, events: [], u2: 0.5, u4: 0.5,
    lab: new Int32Array(NC), stk: new Int32Array(NC),
    carea: new Int32Array(NC), cview: new Int32Array(NC), cseed: new Int32Array(NC), cdeep: new Float32Array(NC), evDD: new Float32Array(NC), evLid: new Float32Array(NC),
    hist: new Float32Array(480),
    pond: new Float32Array(768), ice: new Float32Array(768),
    navy: NAVY, ledge: LEDGE, brash: BRASH, lid: LID, bleach: BLEACH, damp: DAMP, bare: BARE,
  };
  for (const n of ARRS) S[n] = new Float32Array(NC);
  return S;
}

// the hummocks, in noise coordinates that follow the view centre
let HSV = 0;
function heightAt(S, X, Y) {
  const iS = 1 / S.Sm;
  let u = (X - S.xa) * iS + S.nax, v = (Y - S.ya) * iS + S.nay;
  const w1 = vnoise(u * 0.6 + 11.3, v * 0.6 + 4.7, 41) - 0.5, w2 = vnoise(u * 0.6 + 2.9, v * 0.6 + 17.1, 42) - 0.5;
  u += 0.8 * w1; v += 0.8 * w2;
  const f1 = sm(2.4, 3.8, S.Sm / 2.3), f2 = sm(3.0, 4.8, S.Sm / 5.3);
  let h = (vnoise(u, v, 1) - 0.5) * 1.0;
  const rr = 1 - abs(2 * vnoise((0.9553 * u - 0.2955 * v) * 0.33 + 3.3, (0.2955 * u + 0.9553 * v) * 0.33 + 1.7, 4) - 1);
  const r2 = rr * rr;
  h += 0.55 * r2 * r2;
  h += (vnoise((0.8525 * u - 0.5227 * v) * 2.3 + 5.5, (0.5227 * u + 0.8525 * v) * 2.3 + 9.1, 2) - 0.5) * 0.95 * f1;
  const o2 = (vnoise((0.4536 * u - 0.8912 * v) * 5.3 + 1.7, (0.8912 * u + 0.4536 * v) * 5.3 + 3.9, 3) - 0.5) * f2;
  HSV = (h + 0.3 * o2) * 3.6; // the slope the light reads comes from these, with the finest octave at 0.3
  h += 0.7 * o2;
  return h * 3.6; // about one sigma
}

function genStatic(S, k, X, Y) {
  leadField(X, Y);
  S.LSD[k] = LF.lsd;
  S.BMP[k] = LF.bump;
  let br = 0;
  if (LF.lsd < 0.5) {
    const dens = vnoise(X * 0.045 + 3, Y * 0.045, 66);
    const th = 0.66 - 0.16 * dens;
    br = sm(th, th + 0.1, vnoise(X * 0.31, Y * 0.31, 65));
  }
  S.BR[k] = br;
  S.TEX[k] = cl(0.15 + 1.1 * (vnoise(X * 0.2, Y * 0.2, 68) - 0.2) + 0.4 * (vnoise(X * 0.45, Y * 0.45, 69) - 0.5), 0, 1);
  S.ALB[k] = 1 - sm(0.36, 0.52, vnoise(X * 0.028 + 9, Y * 0.028, 67)); // 1 where the ice is bare
}

function genCell(S, i, j) {
  const k = j * M + i, X = S.oi + i + 0.5, Y = S.oj + j + 0.5;
  genStatic(S, k, X, Y);
  const h = heightAt(S, X, Y) + S.BMP[k];
  S.HS[k] = HSV + S.BMP[k];
  S.H[k] = S.LSD[k] < 0 ? 5 : h;
  const wet = h < S.L - 0.05 && S.LSD[k] > 0.6;
  S.FL[k] = wet ? 0.65 * FMAX : 0;
  S.DD[k] = 0; S.LID[k] = 0;
  S.HE[k] = S.H[k] - S.FL[k];
}
function genHeights(S) {
  for (let j = 0; j < M; j++)
    for (let i = 0; i < M; i++) {
      const k = j * M + i;
      const h = heightAt(S, S.oi + i + 0.5, S.oj + j + 0.5) + S.BMP[k];
      S.HS[k] = HSV + S.BMP[k];
      S.H[k] = S.LSD[k] < 0 ? 5 : h;
      S.HE[k] = S.H[k] - S.FL[k];
    }
}
function shiftX(S, dx) {
  for (const n of ARRS) {
    const A = S[n];
    for (let j = 0; j < M; j++) {
      const r = j * M;
      if (dx > 0) A.copyWithin(r, r + 1, r + M); else A.copyWithin(r + 1, r, r + M - 1);
    }
  }
  S.oi += dx;
  const i = dx > 0 ? M - 1 : 0;
  for (let j = 0; j < M; j++) genCell(S, i, j);
}
function shiftY(S, dy) {
  for (const n of ARRS) {
    const A = S[n];
    if (dy > 0) A.copyWithin(0, M, NC); else A.copyWithin(M, 0, NC - M);
  }
  S.oj += dy;
  const j = dy > 0 ? M - 1 : 0;
  for (let i = 0; i < M; i++) genCell(S, i, j);
}

const FMAX = 0.38;

// ---- the water table: the level that gives the wanted cover of the ice in view
function viewToCell(S, x, y, out) {
  const c = cos(S.th), s = sin(S.th), px = x + 0.5 - 32, py = y + 0.5 - 64;
  out[0] = S.cx + c * px - s * py - S.oi;
  out[1] = S.cy + s * px + c * py - S.oj;
}
const PT = [0, 0];
const HLO = -4.5, HW = 12 / 480;
function levelFor(S, cover) {
  const hist = S.hist;
  hist.fill(0);
  let n = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      viewToCell(S, x, y, PT);
      const i = cl(floor(PT[0]), 0, M - 1), j = cl(floor(PT[1]), 0, M - 1), k = j * M + i;
      if (S.LSD[k] < 0.8) continue;
      const b = cl(floor((S.HE[k] - HLO) / HW), 0, 479);
      hist[b]++; n++;
    }
  }
  const want = cover * n;
  let acc = 0;
  for (let b = 0; b < 480; b++) {
    if (acc + hist[b] >= want) return HLO + (b + (hist[b] > 0 ? (want - acc) / hist[b] : 0)) * HW;
    acc += hist[b];
  }
  return HLO + 12;
}

// start an event on a basin that has between lo and hi pixels in view; kind -1 picks one
function spawn(S, nc, used, lo, hi, kind) {
  const cview = S.cview;
  let tot = 0;
  const cand = [], wts = [];
  for (let c = 0; c < nc; c++) {
    const a = cview[c];
    if (used[c] || a < lo || a > hi || S.carea[c] < 50) continue;
    const w = a < 500 ? a : 500;
    cand.push(c); wts.push(w); tot += w;
  }
  if (!cand.length) return;
  let r = rnd() * tot, q = 0;
  while (q < cand.length - 1 && r > wts[q]) { r -= wts[q]; q++; }
  const c = cand[q], sd = S.cseed[c];
  used[c] = 1;
  const e = { x: sd % M + S.oi, y: floor(sd / M) + S.oj, kind: kind >= 0 ? kind : rnd() < 0.6 && cview[c] <= 700 ? 0 : 1, ph: 0, d: 0, t: 0, hold: 0, dmax: 0, fast: false };
  if (e.kind === 0) {
    const depth = S.L - S.cdeep[c];
    e.dmax = rnd() < 0.7 ? depth + 0.1 : depth * (0.45 + 0.35 * rnd());
    e.hold = 20 + 35 * rnd();
  } else e.hold = 40 + 40 * rnd();
  S.events.push(e);
}

// ---- one model step of dtr seconds: cover, basins, events, the cells' water
function modelStep(S, dtr, pre) {
  const u2 = S.u2;
  const rate = 0.7 + 0.6 * u2;
  S.ph[0] += TAU * dtr * rate / 97; S.ph[1] += TAU * dtr * rate / 151;
  S.ou += (-S.ou * dtr) / 45 + 0.0074 * sqrt(dtr) * (rnd() + rnd() + rnd() - 1.5) * 2;
  const c0 = 0.08 + 0.6 * u2;
  S.cover = cl(c0 + (0.045 + 0.03 * (1 - u2)) * sin(S.ph[0]) + 0.04 * sin(S.ph[1]) + S.ou, 0.05, 0.86);
  S.Lt = levelFor(S, S.cover);
  if (pre) S.L = S.Lt;
  const L = S.L;
  const he = S.HE, lab = S.lab, stk = S.stk, LSD = S.LSD;

  // basins below the level, 4-connected
  lab.fill(-1);
  let nc = 0;
  for (let p0 = 0; p0 < NC; p0++) {
    if (lab[p0] >= 0 || he[p0] >= L || LSD[p0] < 0.6) continue;
    let sp = 0, area = 0, deep = 1e9, seed = p0;
    stk[sp++] = p0; lab[p0] = nc;
    while (sp > 0) {
      const p = stk[--sp];
      area++;
      if (he[p] < deep) { deep = he[p]; seed = p; }
      const x = p % M;
      let q = p - 1;
      if (x > 0 && lab[q] < 0 && he[q] < L && LSD[q] > 0.6) { lab[q] = nc; stk[sp++] = q; }
      q = p + 1;
      if (x < M - 1 && lab[q] < 0 && he[q] < L && LSD[q] > 0.6) { lab[q] = nc; stk[sp++] = q; }
      q = p - M;
      if (q >= 0 && lab[q] < 0 && he[q] < L && LSD[q] > 0.6) { lab[q] = nc; stk[sp++] = q; }
      q = p + M;
      if (q < NC && lab[q] < 0 && he[q] < L && LSD[q] > 0.6) { lab[q] = nc; stk[sp++] = q; }
    }
    S.carea[nc] = area; S.cseed[nc] = seed; S.cdeep[nc] = deep;
    nc++;
  }
  S.ncomp = nc;

  // how much of the panel each basin has
  const cview = S.cview;
  cview.fill(0, 0, nc + 1);
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      viewToCell(S, x, y, PT);
      const c = lab[cl(floor(PT[1]), 0, M - 1) * M + cl(floor(PT[0]), 0, M - 1)];
      if (c >= 0) cview[c] += 4;
    }
  }

  // events
  const evDD = S.evDD, evLid = S.evLid;
  evDD.fill(0, 0, nc + 1); evLid.fill(0, 0, nc + 1);
  const used = new Uint8Array(nc + 1);
  const ev = S.events;
  for (let n = ev.length - 1; n >= 0; n--) {
    const e = ev[n];
    const ei = e.x - S.oi, ej = e.y - S.oj;
    if (ei < 2 || ej < 2 || ei > M - 3 || ej > M - 3) { ev.splice(n, 1); continue; }
    const c = lab[ej * M + ei];
    // an event whose basin has joined a network that fills over 30 percent of the panel lets go quickly
    if (c >= 0 && e.ph < 2 && cview[c] > 1500) { e.ph = 2; e.fast = true; }
    if (e.kind === 0) {
      if (e.ph === 0) { e.d += 0.05 * dtr; if (e.d >= e.dmax) { e.d = e.dmax; e.ph = 1; e.t = 0; } }
      else if (e.ph === 1) { e.t += dtr; if (e.t >= e.hold) e.ph = 2; }
      else { e.d -= (e.fast ? 0.09 : 0.022) * dtr; if (e.d <= 0) { ev.splice(n, 1); continue; } }
    } else if (e.ph === 0) { e.d += dtr / 20; if (e.d >= 1) { e.d = 1; e.ph = 1; e.t = 0; } }
    else if (e.ph === 1) { e.t += dtr; if (e.t >= e.hold) e.ph = 2; }
    else { e.d -= dtr / (e.fast ? 10 : 32); if (e.d <= 0) { ev.splice(n, 1); continue; } }
    if (c >= 0) {
      used[c] = 1;
      if (e.kind === 0) { if (e.d > evDD[c]) evDD[c] = e.d; } else if (e.d > evLid[c]) evLid[c] = e.d;
    }
  }
  // a new one now and then
  const lam = S.u4 < 0.03 ? 0 : 0.1 * S.u4 * S.u4;
  if (lam > 0 && rnd() < 1 - exp(-lam * dtr)) spawn(S, nc, used, 40, 1200, -1);

  // the water in every cell
  const DD = S.DD, LIDA = S.LID, FL = S.FL, H0 = S.H;
  const rf = 0.012 + 0.012 * u2, up = 0.15 * dtr, dn = 0.06 * dtr, lu = 0.2 * dtr, ld = 0.12 * dtr;
  for (let k = 0; k < NC; k++) {
    const c = lab[k];
    const td = c >= 0 ? evDD[c] : 0, tl = c >= 0 ? evLid[c] : 0;
    let d = DD[k];
    if (d < td) d = min(td, d + up); else if (d > td) d = max(td, d - dn);
    DD[k] = d;
    let l = LIDA[k];
    if (l < tl) l = min(tl, l + lu); else if (l > tl) l = max(tl, l - ld);
    LIDA[k] = l;
    const s = L - d - he[k];
    let f = FL[k];
    if (s > 0.02) { f += rf * dtr * sm(0, 0.35, s); if (f > FMAX) f = FMAX; } else { f -= 0.0035 * dtr; if (f < 0) f = 0; }
    FL[k] = f;
    he[k] = H0[k] - f;
  }
}

// ---- the first update
function pickStart(S) {
  let best = 0, bx = 0, by = 0, bs = 1e9;
  S.cx = 0; S.cy = 0;
  for (let n = 0; n < 60; n++) {
    const x0 = (rnd() - 0.5) * 3000, y0 = (rnd() - 0.5) * 3000;
    let cnt = 0, tot = 0;
    for (let y = 2; y < H; y += 6) for (let x = 2; x < W; x += 4) {
      leadField(x0 + x - 32, y0 + y - 64);
      if (LF.lsd < 0) cnt++;
      tot++;
    }
    const sc = abs(cnt / tot - 0.1);
    if (sc < bs) { bs = sc; bx = x0; by = y0; best = n; }
  }
  void best;
  S.cx = bx; S.cy = by;
}

function init(S, kn) {
  pickStart(S);
  S.th = (rnd() - 0.5) * 1.2;
  for (let i = 0; i < 6; i++) S.ph[i] = rnd() * TAU;
  S.oi = floor(S.cx) - M / 2; S.oj = floor(S.cy) - M / 2;
  S.xa = S.cx; S.ya = S.cy; S.nax = rnd() * 500; S.nay = rnd() * 500;
  S.Sm = S.St = hummock(kn[2]);
  S.t = 0;
  // static fields first, then the heights, then a level, then the rest
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) genStatic(S, j * M + i, S.oi + i + 0.5, S.oj + j + 0.5);
  S.L = -9;
  genHeights(S);
  S.Lt = S.L = levelFor(S, 0.4);
  S.events.length = 0;
  S.ready = true;
  for (let n = 0; n < 40; n++) {
    modelStep(S, 2.5, true);
    // the first frame should already hold a drained basin and a lid, as many as the Drain knob allows
    if (n === 24 && S.u4 > 0.05) {
      const used = new Uint8Array(NC);
      for (const e of S.events) { const c = S.lab[(e.y - S.oj) * M + (e.x - S.oi)]; if (c >= 0) used[c] = 1; }
      const extra = 1 + floor(1.8 * S.u4);
      for (let i = 0; i < extra; i++) { spawn(S, S.ncomp, used, 100, 600, 0); spawn(S, S.ncomp, used, 100, 900, 1); }
    }
  }
  // leave the cover on a mid value, going up a little
  S.ph[0] = 0.5; S.ph[1] = 4.2; S.ou = 0;
  S.L = S.Lt;
  S.acc = 0;
}

export function setup(params) {
  params.s = makeState();
}

function readKnobs(S, kn) {
  S.k = kn;
  const k1 = cl(kn[0], 0, 1);
  S.u2 = cl(kn[1], 0, 4) / 4;
  S.St = hummock(kn[2]);
  S.u4 = (cl(kn[3], -1, 1) + 1) / 2;
  if (abs(k1 - S.pal) > 0.0005) { S.pal = k1; buildPalette(S, k1); }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  readKnobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.ready) init(S, S.k);
  S.t += d;
  // the floe drifts down the panel at 0.42 LED/s, veering, and the view turns a little
  const t = S.t;
  const veer = 0.18 * sin(TAU * t / 231 + S.ph[2]) + 0.1 * sin(TAU * t / 97 + S.ph[3]);
  const speed = 0.42 * (0.88 + 0.12 * sin(TAU * t / 173 + S.ph[4]));
  const ux = speed * sin(veer), uy = speed * cos(veer);
  const om = 0.0022 * sin(TAU * t / 311 + S.ph[5]) + 0.0014 * sin(TAU * t / 127 + S.ph[0]) + 0.0008 * sin(TAU * t / 53 + S.ph[1]);
  S.th += om * d;
  const c = cos(S.th), s = sin(S.th);
  S.cx -= (c * ux - s * uy) * d;
  S.cy -= (s * ux + c * uy) * d;
  while (S.cx - (S.oi + M / 2) > 1) shiftX(S, 1);
  while (S.cx - (S.oi + M / 2) < -1) shiftX(S, -1);
  while (S.cy - (S.oj + M / 2) > 1) shiftY(S, 1);
  while (S.cy - (S.oj + M / 2) < -1) shiftY(S, -1);
  // the hummock scale eases, and the heights are made again when it has moved 2 percent
  S.Sm += (S.St - S.Sm) * (1 - exp(-d / 1.1));
  if (abs(S.Sm - S.sgen) / S.Sm > 0.02 || S.sgen === undefined) {
    if (S.sgen !== undefined) {
      S.nax += (S.cx - S.xa) / S.sgen; S.nay += (S.cy - S.ya) / S.sgen;
      S.xa = S.cx; S.ya = S.cy;
      genHeights(S);
    }
    S.sgen = S.Sm;
  }
  S.L += (S.Lt - S.L) * (1 - exp(-d / 0.7));
  S.acc += d;
  if (S.acc >= 0.25) { modelStep(S, S.acc, false); S.acc = 0; }
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) update(0, { knobValues: [0, 2, 0, 0.06] }, params);
  const HE = S.HE, HS = S.HS, DD = S.DD, LIDA = S.LID, LSD = S.LSD, BR = S.BR, TEX = S.TEX, ALB = S.ALB;
  const c = cos(S.th), sn = sin(S.th), L = S.L;
  const lx = -0.55, ly = -0.83, lwx = c * lx - sn * ly, lwy = sn * lx + c * ly;
  const kS = 1.25 * Math.pow(S.Sm / 22, 0.8);
  const pond = S.pond, ice = S.ice, navy = S.navy, ledge = S.ledge, brashC = S.brash, lidC = S.lid, bleachC = S.bleach, dampC = S.damp, bareC = S.bare;
  const X0 = S.cx - S.oi - 0.5, Y0 = S.cy - S.oj - 0.5;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5 - 64;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - 32;
      let fx = X0 + c * px - sn * py, fy = Y0 + sn * px + c * py;
      let i0 = floor(fx), j0 = floor(fy);
      if (i0 < 1) i0 = 1; else if (i0 > M - 3) i0 = M - 3;
      if (j0 < 1) j0 = 1; else if (j0 > M - 3) j0 = M - 3;
      const tx = fx - i0, ty = fy - j0, k = j0 * M + i0;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const a00 = HE[k], a10 = HE[k + 1], a01 = HE[k + M], a11 = HE[k + M + 1];
      const he = a00 * w00 + a10 * w10 + a01 * w01 + a11 * w11;
      const gx = (a10 - a00) * (1 - ty) + (a11 - a01) * ty, gy = (a01 - a00) * (1 - tx) + (a11 - a10) * tx;
      const g = sqrt(gx * gx + gy * gy) + 0.06;
      const dd = DD[k] * w00 + DD[k + 1] * w10 + DD[k + M] * w01 + DD[k + M + 1] * w11;
      const s0 = L - he, s = s0 - dd;
      // dry ice
      const sx = (HS[k + 1] - HS[k] + HS[k + M + 1] - HS[k + M]) * 0.5, sy = (HS[k + M] - HS[k] + HS[k + M + 1] - HS[k + 1]) * 0.5;
      const tex = TEX[k] * w00 + TEX[k + 1] * w10 + TEX[k + M] * w01 + TEX[k + M + 1] * w11;
      const shade = cl(0.86 - kS * (sx * lwx + sy * lwy) * 1.3 + 0.3 * (tex - 0.45), 0, 1);
      const si = floor(shade * 255) * 3;
      let r = ice[si], gg = ice[si + 1], b = ice[si + 2];
      const bare = ALB[k] * w00 + ALB[k + 1] * w10 + ALB[k + M] * w01 + ALB[k + M + 1] * w11;
      if (bare > 0.01) { const f = 0.22 * bare; r += (bareC[0] - r) * f; gg += (bareC[1] - gg) * f; b += (bareC[2] - b) * f; }
      if (s0 < 0 && s0 > -3.2 * g) {
        const f = 0.4 * exp(s0 / (1.1 * g));
        r += (dampC[0] - r) * f; gg += (dampC[1] - gg) * f; b += (dampC[2] - b) * f;
      }
      const aw = cl(0.5 + s / g, 0, 1);
      if (dd > 0.01) {
        const fp = cl(0.5 + s0 / g, 0, 1), bl = cl(fp - aw, 0, 1) * 0.92;
        if (bl > 0) { r += (bleachC[0] - r) * bl; gg += (bleachC[1] - gg) * bl; b += (bleachC[2] - b) * bl; }
        const rim = cl(dd / 0.25, 0, 1) * exp(-((s0 / (1.5 * g)) * (s0 / (1.5 * g))));
        if (rim > 0.01) { const f = 0.7 * rim; r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
      }
      // pond
      if (aw > 0) {
        const pi = floor(255 * Math.pow(cl(s / 4.2, 0, 1), 0.8)) * 3;
        let pr = pond[pi], pg = pond[pi + 1], pb = pond[pi + 2];
        const lid = LIDA[k] * w00 + LIDA[k + 1] * w10 + LIDA[k + M] * w01 + LIDA[k + M + 1] * w11;
        if (lid > 0.01) {
          const a = cl(lid * (0.45 + 0.5 * tex), 0, 0.85), lf = 0.9 + 0.1 * shade;
          pr += (lidC[0] * lf - pr) * a; pg += (lidC[1] * lf - pg) * a; pb += (lidC[2] * lf - pb) * a;
        }
        r += (pr - r) * aw; gg += (pg - gg) * aw; b += (pb - b) * aw;
      }
      // lead
      const ld = LSD[k] * w00 + LSD[k + 1] * w10 + LSD[k + M] * w01 + LSD[k + M + 1] * w11;
      if (ld < 0.9) {
        const al = cl(0.5 - ld / 1.1, 0, 1);
        let lr = navy[0], lg = navy[1], lb = navy[2];
        if (ld > -2.6) {
          const f = 0.85 * Math.pow(cl(1 + ld / 2.6, 0, 1), 1.4);
          lr += (ledge[0] - lr) * f; lg += (ledge[1] - lg) * f; lb += (ledge[2] - lb) * f;
        }
        const br = (BR[k] * w00 + BR[k + 1] * w10 + BR[k + M] * w01 + BR[k + M + 1] * w11) * sm(0.2, -0.8, ld);
        if (br > 0.01) { const f = 0.85 * br; lr += (brashC[0] - lr) * f; lg += (brashC[1] - lg) * f; lb += (brashC[2] - lb) * f; }
        r += (lr - r) * al; gg += (lg - gg) * al; b += (lb - b) * al;
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
