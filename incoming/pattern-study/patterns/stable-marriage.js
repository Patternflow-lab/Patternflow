// ===== Patternflow pattern =====
// Title:   Stable Marriage
// Family:  algo
// Idea:    Gale and Shapley's deferred acceptance between 16 people along the top edge and 16 along the bottom, every proposal a line that runs the panel's full height; a proposal held stays lit and one turned away flashes and fades, and when a receiver trades up the line it held snaps in two. Once the top has its stable matching the bottom proposes on the same lists, and then the pairs where the two stable matchings differ swap back and forth.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: deferred acceptance (David Gale and Lloyd Shapley, 1962)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Agreement=0..1, Choosy=0..1
//
// Knob 1: Hue. Each end of a line, and the tile of each person, is coloured by the rank that person gives the partner: at 0 a first choice is green and the last pink, with blue at about the fifth. Turning it moves the whole scale round the colour wheel.
// Knob 2: Speed. Rounds a second: 2 at the opening 2. In a round every free proposer sends one proposal; a round of eight or more takes a whole round's time, a round of one, as in the chains of rejections that end a run, 0.35 of it. A proposal takes 0.6 of its round to cross.
// Knob 3: Agreement. How much everyone shares one ranking of the other side, left best. At 0 each list is an independent shuffle and the lines cross every which way: a run takes 47 proposals on average, close to n ln n = 44, and in 9 runs of 10 the two sides' matchings differ. At 1 everyone agrees: all 16 first proposals land on the bottom left, the run takes 136 proposals in 16 rounds, and it ends in 16 parallel lines, the one stable matching.
// Knob 4: Choosy. The share of the other side each person refuses outright, from none at 0 to three quarters at 1, where 7.5 of the 16 on each side stay single on average. A single person's tile is dim grey, and the same people are single in both stable matchings.

const W = 64, H = 128, n = 16, SP = W / n, Y0 = 4, Y1 = 123;
const { floor, min, max, abs, sqrt, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const XP = (i) => SP * i + (SP >> 1);
// Rank given to someone a person will not take.
const NO = 999;
// The phases of a cycle. The top proposes and its matching holds; the
// bottom proposes on the same lists and its matching holds; then the two are
// compared, and the panel fades to new lists.
const RUN_A = 0, HOLD_A = 1, RUN_B = 2, HOLD_B = 3, COMPARE = 4, FADE = 5;
// Lengths in rounds; FLY is when the proposals of a round arrive.
const T_HOLD_A = 3, T_HOLD_B = 2, T_CMP = 8, T_FADE = 1.5, FLY = 0.6, T_GONE = 0.8;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, agree: -1, choosy: -1, phase: RUN_A, pt: 0, rt: 0, decided: true,
    // Lists: lt[i * n + k] is the k-th choice of top person i, lb the same
    // for the bottom; rkt and rkb hold the rank each gives, NO if refused.
    lt: new Int8Array(n * n), lb: new Int8Array(n * n), nt: new Int8Array(n), nb: new Int8Array(n),
    rkt: new Int16Array(n * n), rkb: new Int16Array(n * n),
    nx: new Int8Array(n), hold: new Int8Array(n), hb: new Float64Array(n), rl: 1,
    ma: new Int8Array(n), mb: new Int8Array(n), props: 0, propsA: 0, propsB: 0, rounds: 0,
    fx: [],
    buf: new Float32Array(W * H * 3), c: [0, 0, 0], c2: [0, 0, 0],
  };
}

// Preferences: top person i values bottom person j at
// A (1 - j / (n - 1)) + (1 - A) u with u uniform, and the bottom the same way,
// so at A = 1 everyone ranks the other side left to right. Each pair is
// refused by each side with chance c.
function newPrefs(S) {
  const A = S.agree, c = 0.75 * S.choosy, u = new Float64Array(n), idx = [];
  for (let side = 0; side < 2; side++) {
    const L = side ? S.lb : S.lt, R = side ? S.rkb : S.rkt, len = side ? S.nb : S.nt;
    for (let i = 0; i < n; i++) {
      idx.length = 0;
      for (let j = 0; j < n; j++) {
        u[j] = A * (1 - j / (n - 1)) + (1 - A) * Math.random();
        R[i * n + j] = NO;
        if (Math.random() >= c) idx.push(j);
      }
      idx.sort((a, b) => u[b] - u[a]);
      len[i] = idx.length;
      for (let k = 0; k < idx.length; k++) {
        L[i * n + k] = idx[k];
        R[i * n + idx[k]] = k + 1;
      }
    }
  }
}

// Ranks seen from each end of the pair (top a, bottom b).
const rankTop = (S, a, b) => S.rkt[a * n + b];
const rankBot = (S, a, b) => S.rkb[b * n + a];

function startRun(S, side) {
  S.side = side;
  S.nx.fill(0);
  S.hold.fill(-1);
  S.props = 0;
  S.rounds = 0;
  S.rt = S.t - 1;
  S.rl = 1;
  S.decided = true;
  S.fx = S.fx.filter((e) => e.k >= 2);
}

// The proposals of one round leave together: every free proposer with
// someone left on the list sends one. Returns how many left.
function sendRound(S) {
  const side = S.side, L = side ? S.lb : S.lt, len = side ? S.nb : S.nt, held = new Uint8Array(n);
  for (let r = 0; r < n; r++) if (S.hold[r] >= 0) held[S.hold[r]] = 1;
  let sent = 0;
  for (let p = 0; p < n; p++) {
    if (held[p] || S.nx[p] >= len[p]) continue;
    const r = L[p * n + S.nx[p]++];
    S.fx.push({ k: side, a: side ? r : p, b: side ? p : r, t0: S.t });
    sent++;
  }
  S.props += sent;
  if (sent) S.rounds++;
  return sent;
}

// The receivers answer: each keeps the best of what it holds and what just
// arrived, among those it will take, and turns the rest away.
function decide(S) {
  const side = S.side, fly = [], keep = [];
  for (const e of S.fx) (e.k === side ? fly : keep).push(e);
  const best = new Int8Array(n).fill(-1), bestRank = new Int16Array(n).fill(NO);
  for (let r = 0; r < n; r++) {
    const h = S.hold[r];
    if (h >= 0) {
      best[r] = h;
      bestRank[r] = side ? rankTop(S, r, h) : rankBot(S, h, r);
    }
  }
  for (const e of fly) {
    const p = side ? e.b : e.a, r = side ? e.a : e.b, rk = side ? rankTop(S, r, p) : rankBot(S, p, r);
    if (rk < bestRank[r]) (best[r] = p), (bestRank[r] = rk);
  }
  for (const e of fly) {
    const p = side ? e.b : e.a, r = side ? e.a : e.b;
    if (best[r] === p && S.hold[r] !== p) continue;
    keep.push({ k: 2, a: e.a, b: e.b, t0: S.t });
  }
  for (let r = 0; r < n; r++)
    if (best[r] !== S.hold[r]) {
      const o = S.hold[r];
      if (o >= 0) keep.push({ k: 3, a: side ? r : o, b: side ? o : r, t0: S.t });
      S.hold[r] = best[r];
      S.hb[r] = S.t;
    }
  S.fx = keep;
}

// The run's matching as top person to bottom person, -1 for single.
function matching(S, m) {
  m.fill(-1);
  for (let r = 0; r < n; r++) {
    const p = S.hold[r];
    if (p >= 0) S.side ? (m[r] = p) : (m[p] = r);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const ag = cl(k[2], 0, 1), ch = cl(k[3], 0, 1);
  if (abs(ag - S.agree) > 0.02 || abs(ch - S.choosy) > 0.02) {
    // New lists from the start whenever Agreement or Choosy moves.
    S.agree = ag;
    S.choosy = ch;
    newPrefs(S);
    S.fx = [];
    S.phase = RUN_A;
    S.pt = S.t;
    startRun(S, 0);
  }
  S.t += d * S.speed;
  const T = S.t, el = T - S.pt;
  if (S.phase === RUN_A || S.phase === RUN_B) {
    if (!S.decided && T - S.rt >= FLY * S.rl) {
      decide(S);
      S.decided = true;
    }
    if (S.decided && T - S.rt >= S.rl - 1e-9) {
      S.rt = T;
      const sent = sendRound(S);
      // A round of one proposal, the chains of rejections that end a run,
      // takes 0.35 of the time of a round of eight or more.
      S.rl = 0.35 + 0.65 * min(1, (sent - 1) / 7);
      for (const e of S.fx) if (e.k < 2 && e.t0 === T) e.fl = FLY * S.rl;
      if (sent) S.decided = false;
      else {
        // Nobody free has anyone left to ask: the matching is stable.
        if (S.phase === RUN_A) matching(S, S.ma), (S.propsA = S.props), (S.phase = HOLD_A);
        else matching(S, S.mb), (S.propsB = S.props), (S.phase = HOLD_B);
        S.pt = T;
      }
    }
  } else if (S.phase === HOLD_A && el >= T_HOLD_A) {
    S.phase = RUN_B;
    S.pt = T;
    startRun(S, 1);
  } else if (S.phase === HOLD_B && el >= T_HOLD_B) {
    S.phase = COMPARE;
    S.pt = T;
  } else if (S.phase === COMPARE && el >= T_CMP) {
    S.phase = FADE;
    S.pt = T;
  } else if (S.phase === FADE && el >= T_FADE) {
    newPrefs(S);
    S.fx = [];
    S.phase = RUN_A;
    S.pt = T;
    startRun(S, 0);
  }
  S.fx = S.fx.filter((e) => e.k < 2 || T - e.t0 < T_GONE);
}

// Rank to colour: green for a first choice through blue to pink for a last.
function rankCol(S, rank, o) {
  const q = rank >= NO ? 1 : (rank - 1) / (n - 1);
  return hsv(0.3 + S.hue + 0.6 * sqrt(q), 0.85, 1, o);
}

// Where lines cross, each channel keeps the brighter of the two.
function add(buf, x, y, r, g, b) {
  if (x < 0 || x >= W) return;
  const o = (y * W + x) * 3;
  buf[o] = max(buf[o], r);
  buf[o + 1] = max(buf[o + 1], g);
  buf[o + 2] = max(buf[o + 2], b);
}

// The line from top person a to bottom person b over rows ya..yb, its
// colour running from ca at the top end to cb at the bottom, times v. Each
// row lights the LEDs within LW / 2 of the line, the edge ones in part.
const LW = 1.5;
function line(buf, a, b, ya, yb, ca, cb, v, white) {
  const xa = XP(a), xb = XP(b), y0 = max(Y0, Math.ceil(ya)), y1 = min(Y1, floor(yb));
  for (let y = y0; y <= y1; y++) {
    const f = (y - Y0) / (Y1 - Y0), x = xa + (xb - xa) * f;
    const r = ((ca[0] + (cb[0] - ca[0]) * f) * (1 - white) + 255 * white) * v, g = ((ca[1] + (cb[1] - ca[1]) * f) * (1 - white) + 255 * white) * v, bl = ((ca[2] + (cb[2] - ca[2]) * f) * (1 - white) + 255 * white) * v;
    for (let xi = floor(x - LW / 2); xi <= x + LW / 2; xi++) {
      const k = cl(LW / 2 + 0.5 - abs(xi - x), 0, 1);
      if (k > 0) add(buf, xi, y, r * k, g * k, bl * k);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, c = S.c, c2 = S.c2, T = S.t, el = T - S.pt, ph = S.phase;
  buf.fill(0);
  const fade = ph === FADE ? max(0, 1 - el / T_FADE) : 1;
  const pair = (a, b, v, white) => {
    rankCol(S, rankTop(S, a, b), c);
    rankCol(S, rankBot(S, a, b), c2);
    line(buf, a, b, Y0, Y1, c, c2, v, white);
  };
  // The first stable matching stays as dim ghosts while the bottom proposes.
  if (ph === RUN_B || ph === HOLD_B) for (let a = 0; a < n; a++) if (S.ma[a] >= 0) pair(a, S.ma[a], 0.25, 0.3);
  if (ph <= HOLD_B) {
    // Held proposals; one just taken glows white for half a round.
    for (let r = 0; r < n; r++) {
      const p = S.hold[r];
      if (p < 0) continue;
      const a = S.side ? r : p, b = S.side ? p : r, g = max(0, 1 - (T - S.hb[r]) * 2);
      pair(a, b, 0.85 + 0.15 * g, 0.5 * g);
    }
  } else {
    // Compare: pairs in both matchings stay; the others swap between the
    // top's best matching and the bottom's best, a full swing in 4 rounds.
    const w = 0.5 + 0.5 * cos((PI * el) / 2);
    for (let a = 0; a < n; a++) {
      const x = S.ma[a], y = S.mb[a];
      if (x >= 0 && x === y) pair(a, x, 0.45 * fade, 0);
      else {
        if (x >= 0) pair(a, x, w * fade, 0.25 * w);
        if (y >= 0) pair(a, y, (1 - w) * fade, 0.25 * (1 - w));
      }
    }
  }
  for (const e of S.fx) {
    const age = T - e.t0;
    if (e.k < 2) {
      // In flight: the proposer's end coloured by the rank it gives, a white
      // head running across the panel.
      const fr = min(1, age / e.fl), down = e.k === 0;
      rankCol(S, down ? rankTop(S, e.a, e.b) : rankBot(S, e.a, e.b), c);
      const yh = down ? Y0 + (Y1 - Y0) * fr : Y1 - (Y1 - Y0) * fr;
      line(buf, e.a, e.b, down ? Y0 : yh, down ? yh : Y1, c, c, 0.55, 0.15);
      line(buf, e.a, e.b, yh - 3, yh + 3, c, c, 0.9, 0.8);
    } else if (e.k === 2) {
      // Turned away: a flash that fades.
      const q = 1 - age / T_GONE;
      rankCol(S, rankTop(S, e.a, e.b), c);
      rankCol(S, rankBot(S, e.a, e.b), c2);
      line(buf, e.a, e.b, Y0, Y1, c, c2, 0.8 * q * q, 0.6 * q);
    } else {
      // Snapped: the line breaks at its middle and each half pulls back to
      // its own person.
      const q = age / T_GONE, mid = (Y0 + Y1) / 2, l = (mid - Y0) * (1 - q);
      rankCol(S, rankTop(S, e.a, e.b), c);
      rankCol(S, rankBot(S, e.a, e.b), c2);
      line(buf, e.a, e.b, Y0, Y0 + l - 1, c, c2, 0.9 * (1 - q), 0.3);
      line(buf, e.a, e.b, Y1 - l + 1, Y1, c, c2, 0.9 * (1 - q), 0.3);
    }
  }
  // People: a tile of three by three LEDs at each end, in the colour of the
  // rank of what they hold now, dim grey while single.
  const mt = new Int8Array(n).fill(-1), mbm = new Int8Array(n).fill(-1);
  if (ph <= HOLD_B) {
    for (let r = 0; r < n; r++) {
      const p = S.hold[r];
      if (p < 0) continue;
      S.side ? ((mt[r] = p), (mbm[p] = r)) : ((mt[p] = r), (mbm[r] = p));
    }
  } else {
    const m = ph === COMPARE && cos((PI * el) / 2) < 0 ? S.mb : S.ma;
    for (let a = 0; a < n; a++) if (m[a] >= 0) (mt[a] = m[a]), (mbm[m[a]] = a);
  }
  for (let i = 0; i < n; i++) {
    for (const top of [1, 0]) {
      const o = top ? mt[i] : mbm[i];
      if (o >= 0) rankCol(S, top ? rankTop(S, i, o) : rankBot(S, o, i), c);
      else c[0] = c[1] = c[2] = 60;
      const y0 = top ? 0 : H - 3;
      for (let y = y0; y < y0 + 3; y++) for (let x = XP(i) - 1; x <= XP(i) + 1; x++) add(buf, x, y, c[0] * fade, c[1] * fade, c[2] * fade);
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) | 0, min(255, buf[o + 1]) | 0, min(255, buf[o + 2]) | 0);
}
