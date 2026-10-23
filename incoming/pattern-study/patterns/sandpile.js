// ===== Patternflow pattern =====
// Title:   Sandpile
// Family:  automata
// Idea:    Handfuls of sand fall on a tray where any cell holding four grains topples one to each neighbour, each avalanche runs out from the drop point as a bright ring and leaves the four-colour lace of the pile rewritten behind it, and when the pile has filled the tall tray it tips and pours off.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after the Bak-Tang-Wiesenfeld abelian sandpile (1987)
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Palette=0..4, Speed=0.2..3, Sources=1..5, Scatter=0..1
//
// Knob 1: Palette. The four colours of 0, 1, 2 and 3 grains: dune sand on indigo, glacier, moss, embers, neon.
// Knob 2: Speed. Grains per second, 250 at 0.2 up to 3750 at 3; at 2 a handful of 1500 lands every 0.6 s.
// Knob 3: Sources. How many drop points the sand falls on: one in the middle, two stacked, a triangle, a square, a square with a centre.
// Knob 4: Scatter. How wide each handful spreads as it lands: near 0 every grain hits the drop point and the pile keeps its mirror symmetry, towards 1 the grains land in a wide ring and the lace grows ragged.
// Buttons: K1 tap tips the tray now.

const W = 64;
const H = 128;
const N = W * H;
// The sandpile lives on a grid one cell wider all round. The border cells
// are the sinks: they start so far below zero that no number of grains
// makes them topple, so grains pushed over the edge are simply gone.
const WP = W + 2;
const NP = WP * (H + 2);
const SINK = -(1 << 30);
const { min, max, floor, round, sqrt, log2, exp, sin, cos, PI } = Math;
const rnd = () => Math.random();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const at = (x, y) => (y + 1) * WP + x + 1;

// Drop points for each Sources setting, as the centre of a 2x2 block of
// cells, so every plan is mirror symmetric about the middle of the panel.
const POINTS = [
  [[31.5, 63.5]],
  [[31.5, 40.5], [31.5, 86.5]],
  [[31.5, 33.5], [16.5, 91.5], [46.5, 91.5]],
  [[17.5, 38.5], [45.5, 38.5], [17.5, 88.5], [45.5, 88.5]],
  [[15.5, 33.5], [47.5, 33.5], [31.5, 63.5], [15.5, 93.5], [47.5, 93.5]],
];

// Each palette: 0, 1, 2 and 3 grains, the bare tray, the glow of toppling.
// The study reads a cell by its brightest channel, and most neighbours in a
// pile are a 3 beside a 2, so 3 is the bright one and 2 the dark one.
const PALS = [
  [[10, 8, 20], [26, 118, 124], [16, 22, 54], [255, 214, 146], [4, 5, 10], [255, 246, 220]],
  [[4, 8, 16], [30, 110, 150], [34, 20, 70], [206, 246, 255], [2, 5, 9], [200, 255, 255]],
  [[6, 10, 4], [130, 112, 20], [14, 46, 26], [196, 255, 110], [3, 5, 2], [240, 255, 200]],
  [[12, 3, 4], [176, 42, 26], [62, 12, 44], [255, 182, 64], [6, 2, 2], [255, 230, 170]],
  [[6, 0, 12], [0, 148, 170], [54, 0, 92], [255, 120, 222], [3, 0, 6], [255, 220, 255]],
];

const [GROW, HOLD, TILT] = [0, 1, 2];
// A ripple runs out at this many cells a second; the glow trails it by about
// RING cells.
const RIP = 150;
const RING = 5;

export function setup(params) {
  const P = params;
  P.z = new Int32Array(NP);
  P.heat = new Int32Array(NP);
  // Cells waiting to topple. A cell goes on when it reaches four grains and
  // comes off when it topples, so it is never on twice.
  P.st = new Int32Array(NP);
  P.sp = 0;
  // Mirror lines: bit 1 sends a cell's right-hand grain back to itself, bit
  // 2 its downward one.
  P.mir = new Uint8Array(NP);
  P.mode = 0;
  // What the panel shows: the pile before the running ripple and after it,
  // each cell as its grains plus 4 once sand has reached it.
  P.reach = new Uint8Array(N);
  P.cur = new Uint8Array(N);
  P.tgt = new Uint8Array(N);
  P.amp = new Float32Array(N);
  P.dist = new Float32Array(N);
  P.col = new Float32Array(W);
  for (let x = 0; x < W; x++) P.col[x] = rnd();
  P.started = false;
  P.phase = GROW;
  P.pt = 0;
  P.wait = 0;
  P.full = 0;
  P.shift = 0;
  clear(P);
}

function clear(P) {
  const z = P.z;
  z.fill(SINK);
  for (let y = 0; y < H; y++) z.fill(0, at(0, y), at(0, y) + W);
  P.heat.fill(0);
  P.sp = 0;
  P.reach.fill(0);
  P.cur.fill(0);
  P.tgt.fill(0);
  P.rip = -1;
  P.next = null;
  P.symX = true;
  P.symY = true;
}

// Where the drop points sit this cycle: the first cycle uses the plan as it
// stands, later ones slide it up or down the tray.
function points(P, n) {
  return POINTS[n - 1].map(([x, y]) => [x, clamp(y + P.shift, 9.5, H - 10.5)]);
}

// While the pile is mirror symmetric, only the top left quarter (or the left
// half) is worked out and then unfolded: a cell on a mirror line topples one
// grain back onto itself. It is the same pile for a quarter of the work.
function setMode(P, m) {
  if (m === P.mode) return;
  P.mode = m;
  P.mir.fill(0);
  if (m & 1) for (let y = 0; y < H; y++) P.mir[at(W / 2 - 1, y)] |= 1;
  if (m & 2) for (let x = 0; x < W; x++) P.mir[at(x, H / 2 - 1)] |= 2;
}

function unfold(P) {
  const { z, heat, mode } = P;
  if (mode & 1)
    for (let y = 0; y < H; y++)
      for (let x = W / 2; x < W; x++) (z[at(x, y)] = z[at(W - 1 - x, y)]), (heat[at(x, y)] = heat[at(W - 1 - x, y)]);
  if (mode & 2) {
    z.copyWithin(at(-1, H / 2), at(-1, 0), at(-1, H / 2));
    for (let y = H / 2; y < H; y++) {
      z.copyWithin(at(-1, y), at(-1, H - 1 - y), at(-1, H - y));
      heat.copyWithin(at(-1, y), at(-1, H - 1 - y), at(-1, H - y));
    }
  }
}

function add(P, p, g) {
  const o = P.z[p];
  P.z[p] = o + g;
  if (o < 4 && o + g > 3) P.st[P.sp++] = p;
}

// One handful shared by every drop point: on each point's 2x2 block, or
// strewn round it with Scatter.
function pour(P, pts, g, spread) {
  if (spread <= 0) {
    const share = max(1, floor(g / 4 / pts.length));
    for (const [cx, cy] of pts)
      for (let i = 0; i < 4; i++) {
        const x = floor(cx) + (i & 1);
        const y = floor(cy) + (i >> 1);
        if (!((P.mode & 1 && x >= W / 2) || (P.mode & 2 && y >= H / 2))) add(P, at(x, y), share);
      }
    return;
  }
  for (let i = 0; i < g; i++) {
    const [cx, cy] = pts[i % pts.length];
    const a = rnd() * 2 * PI;
    const d = spread * sqrt(-2 * Math.log(1 - rnd() * 0.999));
    const x = round(cx + cos(a) * d);
    const y = round(cy + sin(a) * d);
    if (x >= 0 && x < W && y >= 0 && y < H) add(P, at(x, y), 1);
  }
}

// Topple until stable or out of budget. A cell with 4k grains or more
// topples k times at once. Working from the top of the stack keeps the
// avalanche local, which is the fastest order on this grid.
function settle(P, cap) {
  const { z, st, heat, mir } = P;
  let sp = P.sp;
  let ops = 0;
  while (sp > 0 && ops < cap) {
    const p = st[--sp];
    const v = z[p];
    const k = v >> 2;
    const m = mir[p];
    z[p] = v & 3;
    heat[p] += k;
    ops++;
    let n, o;
    o = z[(n = p - 1)];
    z[n] = o + k;
    if (o < 4 && o + k > 3) st[sp++] = n;
    o = z[(n = m & 1 ? p : p + 1)];
    z[n] = o + k;
    if (o < 4 && o + k > 3) st[sp++] = n;
    o = z[(n = p - WP)];
    z[n] = o + k;
    if (o < 4 && o + k > 3) st[sp++] = n;
    o = z[(n = m & 2 ? p : p + WP)];
    z[n] = o + k;
    if (o < 4 && o + k > 3) st[sp++] = n;
  }
  P.sp = sp;
  if (sp) return false;
  unfold(P);
  return true;
}

// The settled pile as the panel shows it, and how much of the tray it covers.
function snapshot(P, out) {
  const { z, heat, reach } = P;
  let n = 0;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0, s = at(0, y); x < W; x++, p++, s++) {
      if (z[s] || heat[s]) reach[p] = 1;
      out[p] = reach[p] ? 4 + z[s] : 0;
      n += reach[p];
    }
  return n / N;
}

// Choose the mirror work for the next handful. Every plan is symmetric left
// to right; Scatter breaks both mirrors until the tray is emptied, and a plan
// off the middle row breaks the top-bottom one.
function plan(P, spread) {
  if (spread > 0) P.symX = P.symY = false;
  if (P.shift || P.n === 3) P.symY = false;
  setMode(P, (P.symX ? 1 : 0) | (P.symY ? 2 : 0));
  return points(P, P.n);
}

// Pour on every drop point together until the pile covers this much of the
// tray, so the picture opens mid-growth whatever the knobs say.
function prerun(P, cover) {
  const pts = plan(P, 0);
  for (let i = 0; i < 200; i++) {
    pour(P, pts, 1600, 0);
    settle(P, 1e9);
    if (snapshot(P, P.cur) >= cover) break;
  }
  P.heat.fill(0);
  P.tgt.set(P.cur);
}

// A ripple shows the handful that has settled: from the drop points outward,
// cells take their new value and glow by how often they toppled.
function startRipple(P, pts) {
  const cov = snapshot(P, P.tgt);
  const { heat, amp, dist, cur, tgt } = P;
  let far = 0;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0, s = at(0, y); x < W; x++, p++, s++) {
      const h = heat[s];
      const born = tgt[p] && !cur[p];
      amp[p] = h > 0 || born ? min(1, 0.25 + log2(1 + h) / 7 + (born ? 0.4 : 0)) : 0;
      let d = 1e9;
      for (const [cx, cy] of pts) d = min(d, (x - cx) ** 2 + (y - cy) ** 2);
      dist[p] = d = sqrt(d);
      if (h > 0 && d > far) far = d;
    }
  heat.fill(0);
  P.rip = 0;
  P.ripMax = far + RING * 3;
  return cov;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.pal = clamp(round(k[0]), 0, 4);
  const speed = clamp(k[1], 0.2, 3);
  P.n = clamp(round(k[2]), 1, 5);
  const spread = max(0, clamp(k[3], 0, 1) - 0.08) * 14;
  if (!P.started) {
    P.started = true;
    prerun(P, 0.74);
  }
  if (input.btnPressed && input.btnPressed[0] && P.phase !== TILT) [P.phase, P.pt] = [TILT, 0];

  if (P.phase === TILT) {
    P.pt += dt;
    if (P.pt > 1.6) {
      clear(P);
      P.shift = round((rnd() - 0.5) * 50);
      P.phase = GROW;
      P.wait = 0.3;
    }
    return;
  }

  // Work on the next handful while the last one's ripple runs.
  settle(P, 60000);
  if (P.rip >= 0) {
    P.rip += RIP * dt;
    if (P.rip > P.ripMax) {
      P.cur.set(P.tgt);
      P.rip = -1;
    }
  }
  P.wait -= dt;
  if (P.phase === HOLD) {
    P.full += dt;
    if (P.full > 2) [P.phase, P.pt] = [TILT, 0];
    return;
  }
  const every = 0.6 * sqrt(2 / speed);
  if (P.wait <= 0 && P.sp === 0 && P.rip < 0) {
    if (P.next && startRipple(P, P.next) > 0.985) [P.phase, P.full] = [HOLD, 0];
    const pts = plan(P, spread);
    pour(P, pts, round(1250 * speed * every), spread);
    P.next = pts;
    P.wait = every;
  }
}

export function draw(display, params) {
  const P = params;
  const pal = PALS[P.pal ?? 0];
  const bg = pal[4];
  const glow = pal[5];
  const { cur, tgt, amp, dist } = P;
  const r = P.rip;
  const tilt = P.phase === TILT ? 0.5 * 150 * P.pt * P.pt : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sy = y;
      if (tilt) {
        sy = y - round(tilt * (1 + 0.22 * P.col[x]) - 2 * P.col[(x * 7) & 63]);
        if (sy < 0) {
          display.setPixel(x, y, bg[0], bg[1], bg[2]);
          continue;
        }
      }
      const p = sy * W + x;
      let c = cur[p];
      let a = 0;
      if (r >= 0) {
        const d = dist[p];
        if (d < r) {
          c = tgt[p];
          if (amp[p] > 0) a = amp[p] * exp(-(r - d) / RING) * 0.6;
        }
      }
      const base = c ? pal[c - 4] : bg;
      display.setPixel(x, y, base[0] + (glow[0] - base[0]) * a, base[1] + (glow[1] - base[1]) * a, base[2] + (glow[2] - base[2]) * a);
    }
}
