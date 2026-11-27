// ===== Patternflow pattern =====
// Title:   Sugarscape
// Family:  agentecon
// Idea:    Two hundred agents graze two terraced sugar mountains, one above the waist of the panel and one below, and as summer passes from the top half to the bottom and back they file across the middle in herds, wealth-coloured discs from dim violet to white-hot, while a few long-sighted, low-appetite agents grow rich.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sugarscape artificial society with its movement rule, growback rule and Seasons rule (Joshua Epstein and Robert Axtell, Growing Artificial Societies, 1996), recalled from memory, pattern round 271
// Round:   271
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Growback=-1..1, Season=-1..1
//
// Knob 1: Hue. Turns the terrain, the agents and their trails round the colour wheel together, luma held: at 0 gold mountains on a blue-black ground with violet-to-white agents, at 0.25 violet mountains and blue-white agents, at 0.5 teal and green-white, at 0.75 lime and yellow-white.
// Knob 2: Pace. Steps of the society a second, 3.5 for each unit of the knob: 1.75 at 0.5, 7 at the opening 2 and 14 at 4. Agents glide from cell to cell between steps. At 7 a second it takes a herd a median 32 steps (4.6 s) to get half its members across the waist after summer changes sides.
// Knob 3: Growback. How much sugar a cell regrows each step toward its capacity in summer, alpha = 1.1 x 5^K3: 0.22 at -1, 1.1 at the opening 0 and 5.5 at 1 (winter is an eighth of that). At -1 the land is stripped to a quarter of its capacity, 16 agents a second starve and are replaced, mean wealth is 45 and every disc is dim violet on blue-black. At 0 the herd eats the summer mountain to a bare ring and the stock stands at half. At 1 both mountains stay gold, the herds stay put on their peaks (north share 43 to 59 percent) and mean wealth is 515.
// Knob 4: Season. How long summer sits on one half, 70 x 3.5^K4 steps, a fresh length drawn between 0.3 and 1.7 times that each time: 20 steps at -1 (3 s at the opening pace), 74 at the opening 0.06 (10.5 s) and 245 at 1 (35 s). Fast tides flip before a herd has crossed, so the herds slosh and never settle; slow ones let a whole herd cross and strip the mountain, the north share swinging between 13 and 84 percent.
//
// What the picture is. A 32 by 64 lattice, a cell 2 by 2 LEDs. The ground is the sugar in each cell, drawn smoothly between cell centres: blue-black where it is bare, plum, then ember and gold at the peaks, over a faint trace of the capacity so a stripped mountain still shows its shape. Each agent is a soft disc 2.5 to 3.5 LEDs across with a dark rim so it reads on the gold, coloured by its sugar store from violet through magenta and pink to white-hot, larger the richer it is, and slides between cells with a short faint trail and a three-step fade where it dies or is born.
// The model. Each step the cells regrow, then the 200 agents act one at a time in random order: look up to its vision (1 to 6 cells) along the four lattice lines, take the unoccupied cell with the most sugar (the nearest if several tie), move there, eat everything on it, pay its metabolism (1 to 4) and die when the store is spent. A newborn takes its place on a random free cell with 5 to 25 sugar, so the population never changes; agents also retire after 500 to 1000 steps. Summer growback is the full rate in the north half and an eighth of it in the south, then the other way round, with a smooth hem 12 cells wide on the waist. The land has two mountains with capacity 4, 3, 2 and 1 in terraces. Over 900 s the wealth Gini wanders between 0.3 and 0.6, and the richest tenth are on average 4.4 cells sighted and spend 1.0 a step against the others' 3.7 and 1.4, holding 3.5 times their wealth.
// What is exact and what is not. The lattice rules, the terraces, the growback toward capacity, the movement and the summer and winter halves are the book's as far as I recall them; the lifespan, the always-move rule (an agent never stays on its cell), the 32 by 64 lattice with its peaks one above the other and the smooth hem are mine. Four things are added so the picture does not come round: the peaks drift a few cells on slow sines and each swells and sags by a third, patches of rain scale the growback between 0.2 and 1.8 times and drift, and every season has its own length. The colour of an agent is its store against 0.8 of the mean store, on a log scale, and the size of the disc follows it: drawing choices both.

const W = 64, H = 128;
const GW = 32, GH = 64, N = GW * GH;
const NA = 200;
const { floor, sqrt, log, sin, cos, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// ---------------------------------------------------------------- the land
// Peak centres wander: each is a sum of slow sines of its own period, so the mountains
// drift a few cells and the waist between them moves, and no two minutes see the same land.
function peaks(T, ph, out) {
  out[0] = 11 + 4.5 * sin(T * TAU / 97 + ph[0]) + 2 * sin(T * TAU / 41 + ph[1]);
  out[1] = 15.5 + 3 * sin(T * TAU / 113 + ph[2]) + 1.5 * sin(T * TAU / 53 + ph[3]);
  out[2] = 21 + 4.5 * sin(T * TAU / 103 + ph[4]) + 2 * sin(T * TAU / 47 + ph[5]);
  out[3] = 48.5 + 3 * sin(T * TAU / 127 + ph[6]) + 1.5 * sin(T * TAU / 59 + ph[7]);
  out[4] = 1 + 0.08 * sin(T * TAU / 131 + ph[8]);
  out[5] = 1 + 0.08 * sin(T * TAU / 151 + ph[9]);
  // how high each mountain stands: its sugar capacity swells and sags by a third
  out[6] = 0.85 + 0.3 * sin(T * TAU / 139 + ph[10]);
  out[7] = 0.85 + 0.3 * sin(T * TAU / 163 + ph[11]);
}
const PK = new Float32Array(8);
function buildCap(cap, T, ph) {
  peaks(T, ph, PK);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      let best = 0;
      for (let p = 0; p < 2; p++) {
        const dx = (x - PK[p * 2]) * 0.8 + 1.4 * sin(y * 0.37 + p * 2),
          dy = y - PK[p * 2 + 1] + 1.4 * sin(x * 0.41 + p * 3),
          d = sqrt(dx * dx + dy * dy) / PK[4 + p];
        const l = d < 6.5 ? 4 : d < 11 ? 3 : d < 16 ? 2 : d < 23 ? 1 : 0;
        if (l * PK[6 + p] > best) best = l * PK[6 + p];
      }
      cap[y * GW + x] = best;
    }
}

// ---------------------------------------------------------------- the society
const WINTER = 0.125;        // winter growback as a share of summer
const PACE = 3.5;            // steps a second per unit of the Pace knob

export function setup(P) {
  const S = {
    cap: new Float32Array(N), sug: new Float32Array(N), occ: new Int16Array(N).fill(-1),
    ag: [], order: [], ghosts: [], k: [0, 2, 0, 0.06],
    north: Math.random() < 0.5, mix: 0, sLeft: 0, tick: 0, acc: 0, pre: false,
    alpha: 0.7, slen: 70, sps: 7, rowW: new Float32Array(GH),
    meanW: 60,
  };
  S.ph = [];
  for (let i = 0; i < 12; i++) S.ph.push(Math.random() * TAU);
  S.clock = 400 * Math.random();
  S.bcap = new Float32Array(N);
  S.rain = new Float32Array(N);
  S.lastCap = -99;
  landUpdate(S);
  for (let c = 0; c < N; c++) S.sug[c] = S.cap[c];
  S.mix = S.north ? 1 : 0;
  S.sLeft = 30 + 40 * Math.random();
  for (let i = 0; i < NA; i++) {
    const a = { id: i, cx: 0, cy: 0, tx: [0, 0, 0], ty: [0, 0, 0], ox: 0, oy: 0, vis: 1, met: 1, w: 0, age: 0, maxAge: 1, born: 99 };
    spawn(S, a, true);
    S.ag.push(a);
    S.order.push(i);
  }
  P.s = S;
}

function landUpdate(S) {
  const T = S.clock, ph = S.ph;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const w = sin(0.33 * x + 0.21 * y + T * TAU / 53 + ph[0]) + sin(0.19 * x - 0.31 * y + T * TAU / 71 + ph[1]) + sin(0.13 * x + 0.41 * y - T * TAU / 37 + ph[2]);
      S.rain[y * GW + x] = cl(1 + 0.4 * w, 0.2, 1.8);
    }
  buildCap(S.cap, S.clock, S.ph);
  blur3(S.cap, S.bcap);
  blur3(S.bcap, S.bcap);
  S.lastCap = S.clock;
}

function spawn(S, a, first) {
  let c;
  do c = (Math.random() * N) | 0; while (S.occ[c] >= 0 || S.cap[c] < 0.5);
  a.cx = a.ox = c % GW;
  a.cy = a.oy = (c / GW) | 0;
  for (let k = 0; k < 3; k++) {
    a.tx[k] = a.cx;
    a.ty[k] = a.cy;
  }
  S.occ[c] = a.id;
  a.vis = 1 + ((Math.random() * 6) | 0);
  a.met = 1 + ((Math.random() * 4) | 0);
  a.w = 5 + Math.random() * 20;
  a.age = first ? (Math.random() * 300) | 0 : 0;
  a.maxAge = 500 + ((Math.random() * 500) | 0);
  a.born = first ? 99 : 0;
}

function applyKnobs(S) {
  S.alpha = 1.1 * pow(5, cl(S.k[2], -1, 1));
  S.slen = 70 * pow(3.5, cl(S.k[3], -1, 1));
  S.sps = PACE * cl(S.k[1], 0.2, 5);
}

const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

function step(S) {
  S.tick++;
  let tw = 0;
  for (let i = 0; i < NA; i++) tw += S.ag[i].w;
  S.meanW += (tw / NA - S.meanW) * 0.05;
  S.sLeft--;
  if (S.sLeft <= 0) {
    S.north = !S.north;
    S.sLeft = S.slen * (0.3 + 1.4 * Math.random());
  }
  S.mix += ((S.north ? 1 : 0) - S.mix) * 0.2;
  // growback, summer in the north half or the south, a smooth hem across the waist
  for (let y = 0; y < GH; y++) {
    const nth = sm((38 - y) / 12);
    S.rowW[y] = S.alpha * (WINTER + (1 - WINTER) * (S.mix * nth + (1 - S.mix) * (1 - nth)));
  }
  const cap = S.cap, sug = S.sug;
  for (let y = 0; y < GH; y++) {
    const g = S.rowW[y];
    for (let x = 0; x < GW; x++) {
      const c = y * GW + x, s = sug[c] + g * S.rain[c];
      sug[c] = s > cap[c] ? cap[c] : s;
    }
  }
  // random order
  const ord = S.order;
  for (let i = NA - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0, t = ord[i];
    ord[i] = ord[j];
    ord[j] = t;
  }
  for (let q = 0; q < NA; q++) {
    const a = S.ag[ord[q]];
    const x = a.cx, y = a.cy, v = a.vis;
    let best = -1, bq = -1, bd = 99, nt = 0;
    for (let d4 = 0; d4 < 4; d4++) {
      for (let d = 1; d <= v; d++) {
        const nx = x + DX[d4] * d, ny = y + DY[d4] * d;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) break;
        const c = ny * GW + nx;
        if (S.occ[c] >= 0) continue;
        const sq = floor(sug[c] * 8 + 0.5);
        if (sq > bq || (sq === bq && d < bd)) {
          bq = sq;
          bd = d;
          best = c;
          nt = 1;
        } else if (sq === bq && d === bd) {
          nt++;
          if (Math.random() * nt < 1) best = c;
        }
      }
    }
    a.ox = x;
    a.oy = y;
    for (let k = 2; k > 0; k--) {
      a.tx[k] = a.tx[k - 1];
      a.ty[k] = a.ty[k - 1];
    }
    a.tx[0] = x;
    a.ty[0] = y;
    if (best >= 0) {
      S.occ[y * GW + x] = -1;
      a.cx = best % GW;
      a.cy = (best / GW) | 0;
      S.occ[best] = a.id;
      a.w += sug[best];
      sug[best] = 0;
    }
    a.w -= a.met;
    a.age++;
    a.born++;
    if (a.w <= 0 || a.age >= a.maxAge) {
      if (S.ghosts.length < 40) S.ghosts.push({ x: a.cx, y: a.cy, w: max(a.w, 0), t: S.tick });
      S.occ[a.cy * GW + a.cx] = -1;
      spawn(S, a, false);
    }
  }
}

function readKnobs(S, input) {
  const kv = (input && input.knobValues) || S.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) S.k[i] = kv[i];
  applyKnobs(S);
}

export function update(dt, input, P) {
  if (!P.s) setup(P);
  const S = P.s;
  readKnobs(S, input);
  if (!S.pre) {
    S.pre = true;
    for (let k = 0; k < 600; k++) step(S);
  }
  S.clock += cl(dt || 0, 0, 0.1);
  if (S.clock - S.lastCap > 0.4) landUpdate(S);
  S.acc += cl(dt || 0, 0, 0.1) * S.sps;
  let c = 0;
  while (S.acc >= 1 && c < 4) {
    S.acc -= 1;
    c++;
    step(S);
  }
  if (S.acc > 1) S.acc = 1;
  while (S.ghosts.length && S.tick - S.ghosts[0].t > 3) S.ghosts.shift();
}

// ------------------------------------------------------------------ drawing
const BS = new Float32Array(N), BT = new Float32Array(N);
// a [1 2 1] blur across and down, edges held
function blur3(src, dst) {
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      BT[i] = 0.25 * src[x > 0 ? i - 1 : i] + 0.5 * src[i] + 0.25 * src[x < GW - 1 ? i + 1 : i];
    }
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      dst[i] = 0.25 * BT[y > 0 ? i - GW : i] + 0.5 * BT[i] + 0.25 * BT[y < GH - 1 ? i + GW : i];
    }
  return dst;
}
const FR = new Float32Array(W * H), FG = new Float32Array(W * H), FB = new Float32Array(W * H);
const SH = new Float32Array(W * H);
const C = [0, 0, 0];
const TL = new Float32Array(256 * 3);
let lutHue = -1;
// rotate the colour round the wheel by turning its chroma in YIQ space, luma held
function rot(r, g, b, hue, out) {
  const cs = cos(hue * TAU), sn = sin(hue * TAU);
  const y = 0.299 * r + 0.587 * g + 0.114 * b, i = 0.596 * r - 0.274 * g - 0.322 * b, q = 0.211 * r - 0.523 * g + 0.312 * b;
  const i2 = i * cs - q * sn, q2 = i * sn + q * cs;
  out[0] = cl(y + 0.956 * i2 + 0.621 * q2, 0, 1);
  out[1] = cl(y - 0.272 * i2 - 0.647 * q2, 0, 1);
  out[2] = cl(y - 1.106 * i2 + 1.703 * q2, 0, 1);
}
// Colours are written as they should look on the panel. The panel raises saturation by 1.62
// around luma, so each is pulled part of the way back toward its luma before it is stored.
const TS = [
  [0, 0.02, 0.04, 0.2], [0.1, 0.05, 0.06, 0.3], [0.24, 0.26, 0.09, 0.38], [0.38, 0.5, 0.12, 0.34],
  [0.55, 1, 0.5, 0.18], [0.78, 1, 0.82, 0.14], [1, 1, 0.97, 0.62],
];
function ramp(T, t, hue, out) {
  let i = 0;
  while (i < T.length - 2 && t > T[i + 1][0]) i++;
  const a = T[i], b = T[i + 1], f = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  const r = a[1] + (b[1] - a[1]) * f, g = a[2] + (b[2] - a[2]) * f, bl = a[3] + (b[3] - a[3]) * f;
  const y = 0.299 * r + 0.587 * g + 0.114 * bl, k = 1 / 1.4;
  rot(cl(y + (r - y) * k, 0, 1), cl(y + (g - y) * k, 0, 1), cl(y + (bl - y) * k, 0, 1), hue, out);
}
function buildLut(hue) {
  lutHue = hue;
  for (let k = 0; k < 256; k++) {
    ramp(TS, k / 255, hue, C);
    TL[k * 3] = C[0];
    TL[k * 3 + 1] = C[1];
    TL[k * 3 + 2] = C[2];
  }
}

// the colour of an agent by its wealth: violet, magenta, coral, peach, white-hot
const AS = [[0, 0.5, 0.35, 1], [0.35, 1, 0.3, 0.85], [0.7, 1, 0.62, 0.85], [1, 1, 1, 1]];
function agentColor(w, hue, ref, out) {
  const u = cl(log(1 + w / ref) / log(6), 0, 1);
  ramp(AS, u, hue, out);
  return u;
}

// a soft disc composited over the frame; rim = the soft edge in LEDs, core lifts the middle
function disc(cx, cy, r, rim, col, alpha) {
  const x0 = max(0, floor(cx - r - rim)), x1 = min(W - 1, Math.ceil(cx + r + rim));
  const y0 = max(0, floor(cy - r - rim)), y1 = min(H - 1, Math.ceil(cy + r + rim));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
      const cv = cl((r + rim * 0.5 - d) / rim, 0, 1) * alpha;
      if (cv <= 0) continue;
      const i = y * W + x, core = cl(1 - d / (r + 0.01), 0, 1);
      const k = 1 + 0.3 * core * core;
      FR[i] += (min(1, col[0] * k) - FR[i]) * cv;
      FG[i] += (min(1, col[1] * k) - FG[i]) * cv;
      FB[i] += (min(1, col[2] * k) - FB[i]) * cv;
    }
}
// darken the ground round a disc, so it reads against bright sugar
function shade(cx, cy, r, amt) {
  const R = r + 1.6;
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, Math.ceil(cx + R));
  const y0 = max(0, floor(cy - R)), y1 = min(H - 1, Math.ceil(cy + R));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
      const v = cl((R - d) / 1.6, 0, 1) * amt, i = y * W + x;
      if (v > SH[i]) SH[i] = v;
    }
}
// a soft line, composited
function seg(x0, y0, x1, y1, hw, col, alpha) {
  const xa = max(0, floor(min(x0, x1) - hw - 1)), xb = min(W - 1, Math.ceil(max(x0, x1) + hw + 1));
  const ya = max(0, floor(min(y0, y1) - hw - 1)), yb = min(H - 1, Math.ceil(max(y0, y1) + hw + 1));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy + 1e-9;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const t = cl(((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2, 0, 1);
      const ex = x + 0.5 - (x0 + t * dx), ey = y + 0.5 - (y0 + t * dy);
      const cv = cl(hw + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * alpha;
      if (cv <= 0) continue;
      const i = y * W + x;
      FR[i] += (col[0] - FR[i]) * cv;
      FG[i] += (col[1] - FG[i]) * cv;
      FB[i] += (col[2] - FB[i]) * cv;
    }
}

export function draw(display, P) {
  const S = P.s;
  if (!S) return;
  const hue = S.k[0];
  if (hue !== lutHue) buildLut(hue);
  const sug = blur3(S.sug, BS), cap = S.bcap;
  // terrain: the sugar, bilinear between cell centres, over a faint trace of the capacity
  for (let py = 0; py < H; py++) {
    const gy = (py + 0.5) / 2 - 0.5, y0 = cl(floor(gy), 0, GH - 2), fy = sm(gy - y0);
    for (let px = 0; px < W; px++) {
      const gx = (px + 0.5) / 2 - 0.5, x0 = cl(floor(gx), 0, GW - 2), fx = sm(gx - x0);
      const i00 = y0 * GW + x0, i01 = i00 + 1, i10 = i00 + GW, i11 = i10 + 1;
      const s = (sug[i00] * (1 - fx) + sug[i01] * fx) * (1 - fy) + (sug[i10] * (1 - fx) + sug[i11] * fx) * fy;
      const c = (cap[i00] * (1 - fx) + cap[i01] * fx) * (1 - fy) + (cap[i10] * (1 - fx) + cap[i11] * fx) * fy;
      const t = cl(0.13 * c / 4 + 0.87 * s / 4, 0, 1), k = ((t * 255 + 0.5) | 0) * 3, o = py * W + px;
      FR[o] = TL[k];
      FG[o] = TL[k + 1];
      FB[o] = TL[k + 2];
    }
  }
  // agents, poorest first so the rich lie on top
  const f = S.acc, e = f * f * (3 - 2 * f);
  const ag = S.ag, n = ag.length;
  const idx = S.idx || (S.idx = ag.map((_, i) => i));
  idx.sort((a, b) => ag[a].w - ag[b].w);
  const col = [0, 0, 0], tc = [0, 0, 0], ref = max(25, 0.8 * S.meanW);
  const px = S.px || (S.px = new Float32Array(n)), py = S.py || (S.py = new Float32Array(n)), pr = S.pr || (S.pr = new Float32Array(n)), pa = S.pa || (S.pa = new Float32Array(n));
  SH.fill(0);
  for (let j = 0; j < n; j++) {
    const a = ag[idx[j]];
    px[j] = (a.ox + (a.cx - a.ox) * e) * 2 + 1;
    py[j] = (a.oy + (a.cy - a.oy) * e) * 2 + 1;
    const u = agentColor(a.w, hue, ref, col);
    pr[j] = 1.25 + 0.5 * u;
    pa[j] = cl((a.born + f) / 4, 0, 1);
    shade(px[j], py[j], pr[j], 0.5 * pa[j]);
  }
  for (let i = 0; i < W * H; i++) {
    const k = 1 - SH[i];
    FR[i] *= k;
    FG[i] *= k;
    FB[i] *= k;
  }
  for (let j = 0; j < n; j++) {
    const a = ag[idx[j]];
    const u = agentColor(a.w, hue, ref, col);
    // trail: back from the disc through the cells it left, fainter each hop
    if (pa[j] > 0.5) {
      tc[0] = col[0] * 0.8;
      tc[1] = col[1] * 0.8;
      tc[2] = col[2] * 0.8;
      let qx = px[j], qy = py[j], ox = a.ox * 2 + 1, oy = a.oy * 2 + 1;
      seg(qx, qy, ox, oy, 0.7, tc, 0.55 * (1 - e));
      qx = ox;
      qy = oy;
      for (let k = 0; k < 2; k++) {
        const nx = a.tx[k] * 2 + 1, ny = a.ty[k] * 2 + 1;
        seg(qx, qy, nx, ny, 0.7, tc, k ? 0.2 : 0.42);
        qx = nx;
        qy = ny;
      }
    }
    disc(px[j], py[j], pr[j], 1.1, col, pa[j]);
  }
  // an agent that has just died fades out where it stood, over three steps
  for (const g of S.ghosts) {
    const k = 1 - (S.tick - g.t + f) / 3;
    if (k <= 0) continue;
    const u = agentColor(g.w, hue, ref, col);
    disc(g.x * 2 + 1, g.y * 2 + 1, 1.25 + 0.5 * u, 1.1, col, 0.8 * k);
  }
  for (let i = 0; i < W * H; i++)
    display.setPixel(i % W, (i / W) | 0, min(255, (FR[i] * 255) | 0), min(255, (FG[i] * 255) | 0), min(255, (FB[i] * 255) | 0));
}
