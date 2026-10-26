// ===== Patternflow pattern =====
// Title:   Busy Beaver
// Family:  algo
// Idea:    The busy beaver Turing machines write their tapes as space-time diagrams, tape across and time down, the five-state champion's 47,176,870 steps folding into a stack of triangles that zooms out as it grows, one triangle for each pass of its Collatz-like loop.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: busy beaver game (Tibor Rado, 1962), S(3) = 21 (Shen Lin and Tibor Rado, 1965), S(4) = 107 (Allen Brady, 1983), five-state champion (Heiner Marxen and Juergen Buntrock, 1989), its Collatz-like loop (Pascal Michel, 1993), S(5) = 47,176,870 proved (bbchallenge, 2024), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Machine=0..3, Clock=0..1
//
// Knob 1: Hue. Turns the tape colour round the wheel, skipping orange and yellow. At 0 the tape is azure, pale where it holds solid 1s and deep blue where it holds the champion's stripes 100 100 100, averaged to a third; the head's left turns are gold and its right turns rose, the sides of every triangle.
// Knob 2: Speed. At 2 the champion opens 100 turns and 3592 steps in, and its turns grow 9.4 percent a second, a new triangle about every 6 s (0.6, 6.9, 13.0, 18.9, 24.8, 30.6, 36.3, 42.0 and 48.7 s). From 45.7 s, 9.9 million steps in, the panel spends no more than 2.4 million steps a second and the zoom waits for the machine; it halts at 62.2 s, holds 6 s and starts again. At 0.2 ten times slower, halting at 636 s; at 3 it halts at 41.5 s. The small machines take 3 s for their whole run at 2 and hold 3 s.
// Knob 3: Machine. 0 is the five-state champion of Heiner Marxen and Juergen Buntrock, 47,176,870 steps, 12,258 turns and 4098 ones over 12,289 cells; 1 is Allen Brady's four-state champion, 107 steps and 13 ones over 14 cells, 4 LEDs a cell and 1 row a step; 2 is the three-state machine of 21 steps and 5 ones, 12 LEDs a cell and 5 rows a step; 3 is the two-state one, 6 steps and 4 ones, 16 LEDs a cell and 15 rows a step. The counts sit at the top left for the champion and under the small diagrams, steps above and the 1s on the tape now below, and turn white at the halt.
// Knob 4: Clock. What a row of the champion counts. At 0 every sweep, turn to turn, gets the same height and the triangles have straight sides; at 1 every step does, and they swell into arches as the sweeps lengthen, until at the halt the last pass, 30.2 of the 47.2 million steps, takes the bottom 82 rows. At the opening 0.06 a row is nearly a sweep. The small machines always give each step its own band of rows.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The machines in the notation of bbchallenge: for each state A, B, ... the
// moves on reading 0 and on reading 1, each the symbol to write, the way to
// go and the next state, Z for halt.
const MACHINES = [
  "1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RZ0LA", // Marxen and Buntrock, 5 states
  "1RB1LB_1LA0LC_1RZ1LD_1RD0RA", // Brady, 4 states
  "1RB1RZ_1LB0RC_1LC1LA", // Lin and Rado, 3 states
  "1RB1LB_1LA1RZ", // 2 states
];
function parse(text) {
  const st = text.split("_"), n = st.length;
  const wr = new Int8Array(2 * n), dr = new Int8Array(2 * n), nx = new Int8Array(2 * n);
  for (let s = 0; s < n; s++)
    for (let r = 0; r < 2; r++) {
      const m = st[s].slice(3 * r, 3 * r + 3), o = 2 * s + r;
      wr[o] = m.charCodeAt(0) - 48;
      dr[o] = m[1] === "R" ? 1 : -1;
      nx[o] = m[2] === "Z" ? -1 : m.charCodeAt(2) - 65;
    }
  return { wr, dr, nx, n };
}
const TABLES = MACHINES.map(parse);

// The tape: the start cell sits at ORG, with room for the champion's 12,243
// cells to the left and 45 to the right.
const TL = 16384, ORG = 13600;
// Snapshots of the tape, as running counts of 1s over blocks of 2^bs cells,
// never more than NB blocks, taken at every step for the first 256 and
// after that at a turn of the head once the steps or the turns have grown
// by a 200th since the last one: 1894 over the champion's run.
const SMAX = 4096, NB = 256, BLK = NB + 2;
const RATE = 0.09, TAU0 = 100, CAP = 40000, RUN = 3, HOLD = 3, HOLD5 = 6;
const SMALL_H = 110, SH = [0.55, 0.2, 0.75, 0.37, 0.9];
const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

export function setup(params) {
  params.s = {
    tape: new Uint8Array(TL), blk: new Int32Array(TL), pool: new Uint16Array(SMAX * BLK),
    sStep: new Float64Array(SMAX), sTurn: new Int32Array(SMAX), sHead: new Int32Array(SMAX), sState: new Int8Array(SMAX),
    sP0: new Int32Array(SMAX), sBs: new Int8Array(SMAX), sNb: new Int16Array(SMAX), sLo: new Int32Array(SMAX), sHi: new Int32Array(SMAX),
    tStep: new Float64Array(16384), tPos: new Int32Array(16384), tState: new Int8Array(16384),
    rgb: new Float32Array(W * H * 3), c: new Float32Array(3), cs: new Float32Array(SMAX),
    tw: new Float32Array(W * H), trgb: new Float32Array(W * H * 3), tx: new Int16Array(16384), ty: new Int16Array(16384),
    pal: new Float32Array(9), sc: [0, 1, 2, 3, 4].map(() => new Float32Array(3)), white: [255, 255, 255],
    m: -1, hue: 0, speed: 2, q: 0.06, fins: [],
  };
}

function fresh(S, m) {
  S.m = m;
  S.T = TABLES[m];
  S.tape.fill(0);
  S.blk.fill(0);
  S.h = ORG;
  S.st = 0;
  S.steps = 0;
  S.lo = S.hi = ORG;
  S.bs = 0;
  S.lastD = 0;
  S.nt = 0;
  S.ns = 0;
  S.lastSnapStep = 0;
  S.lastSnapTurn = 0;
  S.halted = false;
  S.r = 0;
  S.hold = 0;
  S.tmp = false;
  snap(S, false);
  if (m === 0) advance(S, TAU0, 1e9);
  else S.fin = S.fins[m] || (S.fins[m] = measure(S.T));
}

// A small machine's whole run on a scratch tape: its steps and the cells it
// visits, so its diagram can be laid out before it starts.
function measure(T) {
  const tape = new Uint8Array(64);
  let h = 32, st = 0, steps = 0, lo = 32, hi = 32;
  while (st >= 0 && steps < 1000) {
    const o = 2 * st + tape[h];
    tape[h] = T.wr[o];
    h += T.dr[o];
    st = T.nx[o];
    steps++;
    lo = min(lo, h);
    hi = max(hi, h);
  }
  return { steps, lo: lo - 32 + ORG, hi: hi - 32 + ORG };
}

function snap(S, tmp) {
  if (S.ns >= SMAX) return;
  S.tmp = tmp;
  const j = S.ns++, bs = S.bs, p0 = S.lo >> bs, nb = (S.hi >> bs) - p0 + 1, o = j * BLK;
  const { pool, blk } = S;
  pool[o] = 0;
  for (let b = 0; b < nb; b++) pool[o + b + 1] = pool[o + b] + blk[p0 + b];
  S.sStep[j] = S.steps;
  S.sTurn[j] = S.nt;
  S.sHead[j] = S.h;
  S.sState[j] = S.st;
  S.sP0[j] = p0;
  S.sBs[j] = bs;
  S.sNb[j] = nb;
  S.sLo[j] = S.lo;
  S.sHi[j] = S.hi;
  if (!tmp) {
    S.lastSnapStep = S.steps;
    S.lastSnapTurn = S.nt;
  }
}

// Doubles the block size of the running counts when the tape outgrows NB.
function coarsen(S) {
  const { blk } = S, n = TL >> S.bs;
  for (let i = 0; i < n / 2; i++) blk[i] = blk[2 * i] + blk[2 * i + 1];
  for (let i = n / 2; i < n; i++) blk[i] = 0;
  S.bs++;
}

// Runs the machine until it has made `turns` turns or `steps` steps more.
function advance(S, turns, budget) {
  if (S.halted) return 0;
  // A snapshot left at the end of the last frame only stood for the bottom
  // row; the run goes on from the one before it.
  if (S.tmp) {
    S.ns--;
    S.tmp = false;
  }
  const { tape, blk, tStep, tPos, tState } = S, { wr, dr, nx } = S.T;
  let h = S.h, st = S.st, steps = S.steps, lo = S.lo, hi = S.hi, lastD = S.lastD, bs = S.bs, nt = S.nt;
  const end = steps + budget;
  while (steps < end && nt < turns) {
    const sym = tape[h], o = 2 * st + sym, w = wr[o], d = dr[o];
    let turned = false;
    if (w !== sym) {
      tape[h] = w;
      blk[h >> bs] += w - sym;
    }
    if (d !== lastD) {
      if (lastD !== 0) {
        tStep[nt] = steps;
        tPos[nt] = h;
        tState[nt] = st;
        nt++;
        turned = true;
      }
      lastD = d;
    }
    h += d;
    st = nx[o];
    steps++;
    if (h < lo || h > hi) {
      if (h < lo) lo = h;
      else hi = h;
      if ((hi >> bs) - (lo >> bs) >= NB) {
        S.bs = bs;
        coarsen(S);
        bs = S.bs;
      }
    }
    if (st < 0) {
      S.halted = true;
      break;
    }
    if (steps < 256 || (turned && ((steps - S.lastSnapStep) * 200 >= steps || (nt - S.lastSnapTurn) * 200 >= nt))) {
      S.h = h; S.st = st; S.steps = steps; S.lo = lo; S.hi = hi; S.nt = nt;
      snap(S, false);
    }
  }
  const did = budget - (end - steps);
  S.h = h; S.st = st; S.steps = steps; S.lo = lo; S.hi = hi; S.lastD = lastD; S.nt = nt;
  if (S.halted) {
    S.st = -1;
    snap(S, false);
  } else if (S.lastSnapStep !== steps) snap(S, true);
  return did;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.q = cl(k[3], 0, 1);
  const m = cl(floor(k[2] + 0.5), 0, 3);
  if (m !== S.m) fresh(S, m);
  const g = d * (S.speed / 2);
  if (S.halted) {
    S.hold += g;
    if (S.hold > (m === 0 ? HOLD5 : HOLD)) fresh(S, m);
    return;
  }
  if (m === 0) {
    // The turns grow by RATE a second at Speed 2, unless that would take
    // more than CAP steps a frame; then the zoom waits for the machine.
    const r = S.r + g, target = floor(TAU0 * exp(RATE * r)), budget = floor(CAP * S.speed * 30 * d);
    const did = target > S.nt ? advance(S, target, max(1, budget)) : 0;
    S.r = did >= budget ? log(max(S.nt, TAU0) / TAU0) / RATE : r;
  } else {
    S.r += g;
    const want = floor((S.fin.steps * S.r) / RUN);
    if (want > S.steps) advance(S, 1e9, want - S.steps);
  }
}

// Where a snapshot sits down the panel, 0 to 1: the share of sweeps (each
// sweep, turn to turn, one unit, its steps spread evenly through it) mixed
// with the share of steps by the Clock knob.
function clocks(S) {
  const { tStep, sStep, sTurn, cs } = S, nt = S.nt, now = S.steps, q = S.q;
  const tk = nt > 0 ? tStep[nt - 1] : 0, prev = nt > 1 ? tStep[nt - 1] - tStep[nt - 2] : 1;
  const curLen = max(1, now - tk, prev), sigNow = max(1e-9, nt + (now - tk) / curLen);
  for (let j = 0; j < S.ns; j++) {
    const s = sStep[j], kk = sTurn[j];
    const a = kk > 0 ? tStep[kk - 1] : 0, b = kk < nt ? tStep[kk] : a + curLen;
    cs[j] = (1 - q) * ((kk + (s - a) / max(1, b - a)) / sigNow) + q * (s / max(1, now));
  }
  return sigNow;
}

// The running count of 1s left of cell p in snapshot j, blocks interpolated.
function cum(S, j, p) {
  const bs = S.sBs[j], u = p / (1 << bs) - S.sP0[j], nb = S.sNb[j], o = j * BLK, pool = S.pool;
  if (u <= 0) return 0;
  if (u >= nb) return pool[o + nb];
  const i = floor(u);
  return pool[o + i] + (pool[o + i + 1] - pool[o + i]) * (u - i);
}

function shade(S, dn, out) {
  const P = S.pal;
  if (dn <= 1 / 3) {
    const u = dn * 3;
    for (let i = 0; i < 3; i++) out[i] = P[3 + i] + (P[i] - P[3 + i]) * u;
  } else {
    const u = (dn - 1 / 3) * 1.5;
    for (let i = 0; i < 3; i++) out[i] = P[i] + (P[6 + i] - P[i]) * u;
  }
}

// The champion: every row the tape at one moment, the window the whole tape
// so far, each LED the share of 1s in its 1/64 of it.
function drawChampion(S) {
  const { rgb, c, tw, trgb } = S, col = [0, 0, 0];
  const sigNow = clocks(S), cs = S.cs, lo = S.lo, ext = S.hi - S.lo + 1, C = ext / W;
  let j = 0;
  for (let y = 0; y < H; y++) {
    const want = (y + 1) / H - 1e-9;
    while (j + 1 < S.ns && cs[j + 1] <= want) j++;
    const sl = S.sLo[j], sh = S.sHi[j] + 1;
    // Each LED averages a whole number of the stripes' 3 cells and of the
    // snapshot's blocks, so 100 100 100 comes out a third everywhere
    // instead of beating against the LEDs.
    const u = 3 << S.sBs[j], wf = u * Math.ceil(C / u - 1e-9);
    for (let x = 0; x < W; x++) {
      const a = lo + x * C, b = a + C;
      if (b <= sl || a >= sh) continue;
      const m = (a + b) / 2;
      const dn = (cum(S, j, m + wf / 2) - cum(S, j, m - wf / 2)) / wf;
      shade(S, cl(dn, 0, 1), col);
      const o = (y * W + x) * 3;
      rgb[o] = col[0];
      rgb[o + 1] = col[1];
      rgb[o + 2] = col[2];
    }
  }
  // Every turn of the head in the colour of the state it turned in. The
  // champion turns left in A and right in D, so the head draws the sides
  // of its own triangles.
  tw.fill(0);
  trgb.fill(0);
  const { tStep, tPos, tState, nt } = S, q = S.q;
  const TX = S.tx, TY = S.ty;
  for (let i = 0; i < nt; i++) {
    const cc = (1 - q) * ((i + 1) / sigNow) + q * (tStep[i] / max(1, S.steps));
    const y = min(H - 1, floor(cc * H)), x = min(W - 1, floor((tPos[i] - lo) / C)), P = S.sc[tState[i]];
    TX[i] = x;
    TY[i] = y;
    // Joined to the turn two before it, on the same side, so the sides
    // stay whole lines while a sweep is taller than a row.
    let x1 = x, y1 = y;
    if (i >= 2 && tState[i - 2] === tState[i] && abs(TX[i - 2] - x) <= 3 && y - TY[i - 2] <= 8) (x1 = TX[i - 2]), (y1 = TY[i - 2]);
    const n = max(1, abs(x - x1), y - y1);
    for (let k = n === 1 && x1 === x && y1 === y ? 0 : 1; k <= n; k++) {
      const px = round(x1 + ((x - x1) * k) / n), py = round(y1 + ((y - y1) * k) / n), p = py * W + px;
      tw[p]++;
      trgb[p * 3] += P[0];
      trgb[p * 3 + 1] += P[1];
      trgb[p * 3 + 2] += P[2];
    }
  }
  for (let p = 0; p < W * H; p++) {
    if (!tw[p]) continue;
    const w = min(1, 0.6 + tw[p] * 0.2), o = p * 3, n = tw[p];
    for (let i = 0; i < 3; i++) rgb[o + i] = rgb[o + i] * (1 - w) + (trgb[o + i] / n) * w;
  }
  // The head now, at the foot of the diagram.
  if (!S.halted) {
    const x = min(W - 1, floor((S.h - lo) / C)), P = S.sc[S.st];
    for (let y = H - 4; y < H; y++) {
      const o = (y * W + x) * 3;
      rgb[o] = y === H - 1 ? 255 : P[0];
      rgb[o + 1] = y === H - 1 ? 255 : P[1];
      rgb[o + 2] = y === H - 1 ? 255 : P[2];
    }
  }
}

// A small machine: one row band for every step, the cells as blocks over
// the tape its whole run will use, a dark line between bands and cells
// once they are 4 LEDs or more.
function drawSmall(S) {
  const { rgb } = S, col = [0, 0, 0], F = S.fin, ext = F.hi - F.lo + 1;
  const cw = floor(W / ext), x0 = floor((W - cw * ext) / 2), rh = floor(SMALL_H / (F.steps + 1));
  for (let j = 0; j < S.ns; j++) {
    const sl = S.sLo[j], sh = S.sHi[j], hd = S.sHead[j], st = S.sState[j];
    for (let p = sl; p <= sh; p++) {
      const one = cum(S, j, p + 1) - cum(S, j, p) > 0.5;
      shade(S, one ? 1 : 0, col);
      if (p === hd) {
        const P = st >= 0 ? S.sc[st] : S.white;
        for (let i = 0; i < 3; i++) col[i] = one ? P[i] * 0.75 + col[i] * 0.25 : P[i] * 0.8;
      }
      const xa = x0 + (p - F.lo) * cw, xb = xa + cw - (cw >= 4 && rh >= 4 ? 1 : 0);
      const ya = j * rh, yb = ya + rh - (rh >= 4 ? 1 : 0);
      for (let y = ya; y < yb; y++)
        for (let x = xa; x < xb; x++) {
          const o = (y * W + x) * 3;
          rgb[o] = col[0];
          rgb[o + 1] = col[1];
          rgb[o + 2] = col[2];
        }
    }
  }
}

function number(rgb, n, x, y, P) {
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    const g = DIG[s.charCodeAt(i) - 48];
    for (let k = 0; k < 15; k++)
      if (g[k] === "1") {
        const o = ((y + floor(k / 3)) * W + x + 4 * i + (k % 3)) * 3;
        rgb[o] = P[0];
        rgb[o + 1] = P[1];
        rgb[o + 2] = P[2];
      }
  }
}

// Orange and yellow read brown on an LED when dim, so the tape takes its
// hue from a wheel without 0.03 to 0.17.
const wheel = (h) => 0.17 + 0.86 * (h - floor(h));

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, c } = S;
  rgb.fill(0);
  const h0 = wheel(0.477 + S.hue), P = S.pal;
  hsv(h0, 0.9, 0.5, c);
  P[0] = c[0]; P[1] = c[1]; P[2] = c[2];
  P[3] = 7; P[4] = 9; P[5] = 16;
  hsv(h0 - 0.03, 0.28, 1, c);
  P[6] = c[0]; P[7] = c[1]; P[8] = c[2];
  for (let i = 0; i < 5; i++) {
    hsv(h0 + SH[i], 0.75, 1, c);
    S.sc[i][0] = c[0]; S.sc[i][1] = c[1]; S.sc[i][2] = c[2];
  }
  if (S.m === 0) drawChampion(S);
  else drawSmall(S);
  // The counts: steps, then the 1s on the tape now.
  let ones = 0;
  for (let b = S.lo >> S.bs; b <= S.hi >> S.bs; b++) ones += S.blk[b];
  hsv(h0 + 0.5, 0.12, S.halted ? 0.95 : 0.55, c);
  const y = S.m === 0 ? 1 : 114;
  number(rgb, S.steps, 1, y, c);
  hsv(h0 - 0.03, 0.35, S.halted ? 1 : 0.7, c);
  number(rgb, ones, 1, y + 7, c);
  for (let p = 0, yy = 0; yy < H; yy++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, yy, min(255, rgb[p]), min(255, rgb[p + 1]), min(255, rgb[p + 2]));
}
