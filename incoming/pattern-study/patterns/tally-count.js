// ===== Patternflow pattern =====
// Title:   Tally Count
// Family:  type
// Idea:    Four candidates numbered 1 to 4 head four columns of a chalkboard, ballots drawn from a sealed box are read out one at a time and each adds one chalk stroke to its candidate's column, written in the order of the character 正 so that every five votes close one 正 and the stacks of them race down the tall panel like bars, a column flashes when its candidate takes the lead, a thin trace along the bottom follows the lead of the final winner over the runner-up through the count as in Bertrand's ballot problem, and at the end the winner's column glows, the trace says whether the winner led all the way, and the board is wiped for the next count.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: tally marks in the character 正, five strokes to a mark, as vote counters in Korea, China and Japan keep them; the ballot problem (William Allen Whitworth, 1878; Joseph Bertrand, 1887); 5 by 7 figures from Photon Disk (pattern round 70); pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Closeness=0..1, Size=7..15
//
// Knob 1: Hue. Turns the four chalk colours round the wheel together. At 0 candidate 1 writes in light cyan, 2 in lilac, 3 in salmon and 4 in light green, a quarter turn apart at 60% saturation; at 0.5 they are salmon, light green, light cyan and lilac.
// Knob 2: Speed. A full count takes 10 s at 2, 100 s at 0.2 and 6.7 s at 3, whatever the number of ballots, and a stroke is written in 0.18 s at 2. The winner then glows for 3 s and the eraser takes 1.2 s, both scaled by 2 / Speed within 1.5 to 6 s and 0.6 to 2.4 s.
// Knob 3: Closeness. How close the hidden shares are. Each count draws four shares from a Dirichlet(2, 2, 2, 2) and mixes them toward 25% each by this much. At 0 the winner takes 34 to 58% of the ballots (median 44%), the lead changes hands about 3 times and the winner leads all the way in 23% of counts; at 0.5 it takes 33% and leads all the way in 12%; at 1 all four shares are 25%, the columns finish within a few marks of each other, the lead changes about 12 times at Size 7 and the winner leads all the way in 2% of counts. A change of more than 0.08 starts a new count.
// Knob 4: Size. The height of a 正 in LEDs, 7 to 15 in odd steps. At 7 two marks share a row of the 16 LED column, 12 rows deep, so a column holds 120 votes and a count reads 265 ballots at Closeness 0 and 455 at 1; at 9 one mark a row, 9 rows, 45 votes and about 100 ballots; at 15 five rows of marks 13 wide with 2 LED strokes, 25 votes and about 55 ballots. The winner's column always ends within a few votes of full. A new size starts a new count.
// Buttons: K1 tap wipes the board and starts a new count.

// The ballot problem: if A gets p votes and B gets q < p, and every order of
// reading them is equally likely, the chance that A is strictly ahead of B
// after every ballot is (p - q) / (p + q). Whitworth stated it in 1878 and
// Bertrand published it in 1887 (Comptes Rendus 105). Here the four
// candidates' votes are all drawn before the count starts, a sealed box, and
// then read in a uniformly shuffled order, so for the two who finish first
// and second the theorem holds as stated: ballots for the other two only
// stretch the trace sideways. The trace is the lead of the final winner over
// the final runner-up after each ballot; the winner led all the way when it
// stays above the zero line from that pair's first ballot on.
//
// The five strokes of 正 in their written order: the top bar, the centre
// stem, the short bar right of the stem at half height, the short stem at
// the lower left, the long bottom bar. One vote is one stroke.

const W = 64, H = 128, NC = 4, CW = 16;
// The tally runs from row TOP to BOT; the trace of the lead sits on row
// ZERO and swings AMP rows either way.
const TOP = 16, BOT = 113, ZERO = 121, AMP = 5;
const { floor, round, min, max, abs, sqrt, exp, log, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const T_COUNT = 10, T_STROKE = 0.18, T_END = 3, T_WIPE = 1.2, HUE0 = 0.55;

const ZHENG = [
  [0.15, 0, 0.85, 0],
  [0.5, 0, 0.5, 1],
  [0.5, 0.5, 0.85, 0.5],
  [0.15, 0.5, 0.15, 1],
  [0, 1, 1, 1],
];

// The figures 1 to 4 of Photon Disk's 5 x 7 face (copied from autogram.js),
// rows from the top.
const FIG = [
  "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.",
  ".###. #...# ....# ...#. ..#.. .#... #####",
  "##### ...#. ..#.. ...#. ....# #...# .###.",
  "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
].map((f) => f.replace(/ /g, ""));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// A shares vector from a Dirichlet(2, 2, 2, 2): each a sum of two
// exponentials, normalised.
const expo = () => -log(1 - Math.random() * 0.999999);
function shares(close) {
  const d = [];
  let s = 0;
  for (let c = 0; c < NC; c++) s += d[c] = expo() + expo();
  for (let c = 0; c < NC; c++) d[c] = (1 - close) * (d[c] / s) + close / NC;
  return d;
}

// The layout of one size: marks per row, rows, and the cell pitch.
function layout(size) {
  const g = size <= 7 ? 1 : 2, per = size <= 7 ? 2 : 1, pitch = size + g;
  const rows = floor((BOT - TOP + g) / pitch);
  // A mark is as wide as it is tall up to 13 LEDs, which leaves at least
  // 3 LEDs between neighbouring columns.
  const mw = min(size, 13), wid = per * mw + (per - 1) * g;
  return { size, mw, g, per, pitch, rows, cap: rows * per * 5, ox: floor((CW - wid) / 2), sw: size <= 9 ? 1 : size <= 13 ? 1.5 : 2 };
}

// A new count: draw the shares, the votes, a uniformly shuffled order, and
// the lead path of the final first over the final second.
function newCount(S, prefill) {
  const L = (S.L = layout(S.size));
  let tally;
  for (let tries = 0; tries < 30; tries++) {
    S.share = shares(S.close);
    const top = max(...S.share), n = round((L.cap * 0.96) / top);
    tally = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      let u = Math.random(), c = 0;
      while (c < NC - 1 && u >= S.share[c]) u -= S.share[c++];
      tally[c]++;
    }
    for (let c = 0; c < NC; c++) tally[c] = min(tally[c], L.cap);
    const sorted = tally.slice().sort((a, b) => b - a);
    if (sorted[0] > sorted[1]) break;
  }
  const seq = [];
  for (let c = 0; c < NC; c++) for (let i = 0; i < tally[c]; i++) seq.push(c);
  for (let i = seq.length - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  let win = 0;
  for (let c = 1; c < NC; c++) if (tally[c] > tally[win]) win = c;
  let run = -1;
  for (let c = 0; c < NC; c++) if (c !== win && (run < 0 || tally[c] > tally[run])) run = c;
  const lead = new Int16Array(seq.length);
  let d = 0, ok = true, seen = false, peak = 1;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === win) (d++), (seen = true);
    else if (seq[i] === run) (d--), (seen = true);
    lead[i] = d;
    if (seen && d <= 0) ok = false;
    peak = max(peak, abs(d));
  }
  Object.assign(S, { seq, final: tally, win, run, lead, ok, peak, n: seq.length, read: 0, next: 0, phase: 0, pt: 0, leader: -1 });
  S.p = tally[win];
  S.q = tally[run];
  S.tally = [0, 0, 0, 0];
  S.active = [];
  S.flash.fill(0);
  S.lit.fill(0);
  S.chalk.fill(0);
  if (prefill) {
    const k = floor(S.n * prefill);
    for (let i = 0; i < k; i++) commit(S, true);
    S.read = k;
  }
}

// Where stroke j of candidate c goes, in LED coordinates of pixel centres.
function strokeAt(S, c, j, out) {
  const L = S.L, m = floor(j / 5), k = j % 5, r = floor(m / L.per), col = m % L.per;
  const x0 = c * CW + L.ox + col * (L.mw + L.g) + 0.5, y0 = TOP + r * L.pitch + 0.5, ex = L.mw - 1, ey = L.size - 1, z = ZHENG[k];
  out[0] = x0 + round(z[0] * ex);
  out[1] = y0 + round(z[1] * ey);
  out[2] = x0 + round(z[2] * ex);
  out[3] = y0 + round(z[3] * ey);
  return out;
}

// Read the next ballot: one stroke for its candidate, and a flash when the
// lead changes hands.
function commit(S, silent) {
  const c = S.seq[S.next], j = S.tally[c]++;
  const st = strokeAt(S, c, j, [0, 0, 0, 0]);
  if (silent) bake(S, st, c, 1);
  else S.active.push({ st, c, t: 0 });
  let best = 0, ties = 0;
  for (let k = 1; k < NC; k++) if (S.tally[k] > S.tally[best]) best = k;
  for (let k = 0; k < NC; k++) if (S.tally[k] === S.tally[best]) ties++;
  // A change of leader flashes the new leader's column once it has a
  // whole 正; the swaps among the first few ballots would only flicker.
  if (ties === 1 && best !== S.leader) {
    if (S.leader >= 0 && !silent && S.tally[best] >= 5) S.flash[best] = 1;
    S.leader = best;
  }
  if (!silent) S.lit[c] = min(1, S.lit[c] + 0.35);
  S.next++;
}

// Chalk: a line of width sw through pixel centres, its grain fixed per LED.
function chalkLine(buf, st, u, sw, col, grain, k0) {
  const x0 = st[0], y0 = st[1], x1 = x0 + (st[2] - x0) * u, y1 = y0 + (st[3] - y0) * u;
  const hw = sw / 2, dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  const ax = max(0, floor(min(x0, x1) - hw - 1)), bx = min(W - 1, floor(max(x0, x1) + hw + 1));
  const ay = max(0, floor(min(y0, y1) - hw - 1)), by = min(H - 1, floor(max(y0, y1) + hw + 1));
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = l2 > 0 ? cl((px * dx + py * dy) / l2, 0, 1) : 0;
      const d = sqrt((px - t * dx) ** 2 + (py - t * dy) ** 2), cov = cl(hw + 0.5 - d, 0, 1);
      if (cov <= 0) continue;
      const i = y * W + x, a = cov * grain[i] * k0, kk = i * 3;
      for (let q = 0; q < 3; q++) buf[kk + q] = max(buf[kk + q], col[q] * a);
    }
}
function bake(S, st, c, u) {
  chalkLine(S.chalk, st, u, S.L.sw, S.col[c], S.grain, 1);
}
// A finished stroke throws a little dust round itself, which settles in
// about a second: the front where a column is being written hazes over.
function puff(S, st, c) {
  const ax = max(0, floor(min(st[0], st[2]) - 4)), bx = min(W - 1, floor(max(st[0], st[2]) + 4));
  const ay = max(0, floor(min(st[1], st[3]) - 4)), by = min(H - 1, floor(max(st[1], st[3]) + 4));
  const dx = st[2] - st[0], dy = st[3] - st[1], l2 = dx * dx + dy * dy || 1;
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const px = x + 0.5 - st[0], py = y + 0.5 - st[1], t = cl((px * dx + py * dy) / l2, 0, 1);
      const d2 = (px - t * dx) ** 2 + (py - t * dy) ** 2, i = y * W + x;
      S.dust[i] = min(0.5, S.dust[i] + 0.09 * exp(-d2 / 5) * S.grain[i]);
      S.dustC[i] = c;
    }
}

export function setup(params) {
  const grain = new Float32Array(W * H);
  for (let i = 0; i < grain.length; i++) grain[i] = 0.74 + 0.26 * Math.random();
  params.s = {
    hue: 0, speed: 2, close: 0, size: 7, started: false, btn: false, grain,
    chalk: new Float32Array(W * H * 3), out: new Float32Array(W * H * 3), dust: new Float32Array(W * H), dustC: new Uint8Array(W * H),
    flash: new Float32Array(NC), lit: new Float32Array(NC), col: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    wipeY: -1, t: 0,
  };
  return params.s;
}

function paint(S) {
  for (let c = 0; c < NC; c++) hsv(S.hue + HUE0 + c * 0.25, 0.6, 1, S.col[c]);
}

// Phases: 0 counting, 1 the winner glows, 2 the eraser comes down.
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 7], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const close = cl(k[2] || 0, 0, 1), size = 7 + 2 * round((cl(k[3] == null ? 7 : k[3], 7, 15) - 7) / 2);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  paint(S);
  if (!S.started || size !== S.size || abs(close - S.close) > 0.08) {
    // The Lab opens on a count 40% of the way through.
    S.close = close;
    S.size = size;
    newCount(S, S.started ? 0.12 : 0.4);
    S.started = true;
  } else if (btn && !S.btn) (S.phase = 2), (S.pt = 0), (S.wipeY = 0);
  S.btn = btn;
  const sc = 2 / S.speed;
  S.t += d;
  S.pt += d;
  for (let c = 0; c < NC; c++) (S.flash[c] *= exp(-d / 0.45)), (S.lit[c] *= exp(-d / 0.25));
  const settle = exp(-d / 0.9);
  for (let i = 0; i < W * H; i++) S.dust[i] *= settle;
  if (S.phase === 0) {
    const rate = S.n / (T_COUNT * sc);
    S.read = min(S.n, S.read + d * rate);
    while (S.next < S.n && S.next < S.read) commit(S, false);
    const ds = T_STROKE * sc;
    for (const a of S.active) a.t += d / ds;
    S.active = S.active.filter((a) => (a.t >= 1 ? (bake(S, a.st, a.c, 1), puff(S, a.st, a.c), false) : true));
    if (S.next >= S.n && !S.active.length) (S.phase = 1), (S.pt = 0);
  } else if (S.phase === 1) {
    if (S.pt >= cl(T_END * sc, 1.5, 6)) (S.phase = 2), (S.pt = 0), (S.wipeY = 0);
  } else {
    // The eraser: what it passes keeps a smear of dust that fades.
    const dur = cl(T_WIPE * sc, 0.6, 2.4), y1 = min(H, (S.pt / dur) * (H + 12));
    const ch = S.chalk;
    for (let y = 0; y < min(H, floor(y1)); y++) {
      const f = y >= S.wipeY ? 0.16 : exp(-d / 0.5);
      for (let x = 0; x < W; x++) {
        const kk = (y * W + x) * 3;
        ch[kk] *= f;
        ch[kk + 1] *= f;
        ch[kk + 2] *= f;
      }
    }
    S.wipeY = max(S.wipeY, floor(y1));
    if (S.pt >= dur + 0.5) newCount(S, 0);
  }
}

function fill(o, x0, y0, x1, y1, c, a) {
  for (let y = max(0, y0); y <= min(H - 1, y1); y++)
    for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
      const kk = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) o[kk + q] = max(o[kk + q], c[q] * a);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const o = S.out, ch = S.chalk, col = S.col;
  const wipe = S.phase === 2, glow = S.phase === 1 ? 0.5 + 0.5 * sin(S.pt * 5) : 0;
  // The board, with a faint tint behind a column that just took the lead or won.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const kk = (y * W + x) * 3, c = floor(x / CW);
      const inside = y >= TOP - 2 && y <= BOT;
      let tint = inside ? 0.2 * S.flash[c] : 0;
      if (S.phase === 1 && c === S.win && inside) tint = max(tint, 0.1 + 0.1 * glow);
      const du = S.dust[y * W + x], dc = col[S.dustC[y * W + x]];
      o[kk] = 0.02 + col[c][0] * tint + dc[0] * du;
      o[kk + 1] = 0.055 + col[c][1] * tint + dc[1] * du;
      o[kk + 2] = 0.045 + col[c][2] * tint + dc[2] * du;
    }
  // Chalk on the board; the winner's marks brighten while it glows.
  const boost = S.phase === 1 ? 1 + 0.25 * glow : 1;
  for (let i = 0; i < W * H; i++) {
    const kk = i * 3, b = S.phase === 1 && floor((i % W) / CW) === S.win ? boost : 1;
    o[kk] = max(o[kk], ch[kk] * b);
    o[kk + 1] = max(o[kk + 1], ch[kk + 1] * b);
    o[kk + 2] = max(o[kk + 2], ch[kk + 2] * b);
  }
  // Strokes being written: the line so far, its tip a little brighter.
  const tip = [0, 0, 0];
  for (const a of S.active) {
    const u = cl(a.t, 0, 1);
    chalkLine(o, a.st, u, S.L.sw, col[a.c], S.grain, 1);
    for (let q = 0; q < 3; q++) tip[q] = 0.5 + 0.5 * col[a.c][q];
    const st = a.st, tx = st[0] + (st[2] - st[0]) * u, ty = st[1] + (st[3] - st[1]) * u;
    chalkLine(o, [tx, ty, tx, ty], 1, S.L.sw + 0.4, tip, S.grain, 1);
  }
  // The candidates' numbers, 기호 1 to 4, in boxes that light as a ballot is read.
  for (let c = 0; c < NC; c++) {
    const x0 = c * CW + 2, x1 = c * CW + 13, cc = col[c];
    const lit = S.lit[c], won = S.phase >= 1 && c === S.win ? 1 : 0;
    fill(o, x0, 1, x1, 13, cc, 0.14 + 0.5 * lit + 0.25 * won * (S.phase === 1 ? glow : 1));
    for (let x = x0; x <= x1; x++) fill(o, x, 1, x, 1, cc, 0.7), fill(o, x, 13, x, 13, cc, 0.7);
    fill(o, x0, 1, x0, 13, cc, 0.7);
    fill(o, x1, 1, x1, 13, cc, 0.7);
    const f = FIG[c];
    for (let r = 0; r < 7; r++)
      for (let q = 0; q < 5; q++) if (f[r * 5 + q] === "#") fill(o, c * CW + 5 + q, 4 + r, c * CW + 5 + q, 4 + r, [1, 1, 1], 0.9 + 0.1 * lit);
    // Led all the way: a second frame round the winner's box.
    if (S.phase === 1 && c === S.win && S.ok && glow > 0.3) {
      for (let x = x0 - 1; x <= x1 + 1; x++) fill(o, x, 0, x, 0, [1, 1, 1], 0.9), fill(o, x, 14, x, 14, [1, 1, 1], 0.9);
      fill(o, x0 - 1, 0, x0 - 1, 14, [1, 1, 1], 0.9);
      fill(o, x1 + 1, 0, x1 + 1, 14, [1, 1, 1], 0.9);
    }
  }
  // The ballot path: zero line dotted, the winner's lead above, the
  // runner-up's below, one column per ballot read.
  if (!wipe || S.pt < 0.3) {
    for (let x = 0; x < W; x += 2) fill(o, x, ZERO, x, ZERO, [0.5, 0.5, 0.5], 0.42);
    const n = min(S.next, S.n), cw = col[S.win], cr = col[S.run], sy = AMP / S.peak;
    let py = ZERO;
    for (let i = 0; i < n; i++) {
      const x = floor((i * W) / S.n), y = round(ZERO - S.lead[i] * sy);
      const c = S.lead[i] > 0 ? cw : S.lead[i] < 0 ? cr : [1, 1, 1];
      const a = S.phase === 1 ? (S.ok ? 0.75 + 0.25 * glow : 0.75) : 0.75;
      for (let yy = min(py, y); yy <= max(py, y); yy++) fill(o, x, yy, x, yy, c, a);
      py = y;
    }
    // Not led all the way: where the runner-up drew level or went ahead.
    if (S.phase === 1 && !S.ok) {
      let seen = false, was = false;
      for (let i = 0; i < n; i++) {
        if (S.seq[i] === S.win || S.seq[i] === S.run) seen = true;
        const down = seen && S.lead[i] <= 0;
        if (down && was === false) {
          const x = floor((i * W) / S.n);
          fill(o, x, ZERO - 2, x, ZERO + 2, [1, 1, 1], 0.4 + 0.6 * glow);
        }
        if (seen) was = down;
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const kk = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(o[kk], 0, 1) * 255), round(cl(o[kk + 1], 0, 1) * 255), round(cl(o[kk + 2], 0, 1) * 255));
    }
}
