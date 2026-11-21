// ===== Patternflow pattern =====
// Title:   Resting Orders
// Family:  market
// Idea:    The limit order book of a market drawn as a liquidity heat map, time running left across the panel and price running up it: orders appear, thicken, get pulled or get eaten as horizontal streaks, a few huge ones stand as bright walls for tens of seconds, a pale price line wanders between them with soft trade discs in two tints, and now and then a market order sweeps through the walls, flashing them white, and the book refills behind it.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the liquidity heat maps that trading screens call a depth map, driven by a zero-intelligence order book in the manner of Gode and Sunder (1993) and Smith, Farmer, Gillemot and Krishnamurthy (2003), with a mean-reverting price (Ornstein and Uhlenbeck, 1930) that moves by eating resting size as market orders do in Kyle's 1985 model; pattern round 207
// Round:   207
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Scroll=0..3.5, Depth=-1..1, Volatility=-1..1
//
// Knob 1: Hue. Turns the whole heat palette round the wheel, opening on indigo, violet, magenta, orange and pale yellow; the price line stays cool white tinted by the palette, and buys and sells keep a cyan and a pink that turn with it.
// Knob 2: Scroll. How fast the time axis runs, 1 LED a second at 0, 3.5 at the opening 2 and 9 at 3.5; the history is stretched, so a wall that lasts 30 s is 30 LEDs long at 0 and 270 at 3.5.
// Knob 3: Depth. How much liquidity rests in the book: at -1 about 2 walls and a thin scatter of short streaks, at the opening 0 about 5 walls, at 1 about 8 walls and many streaks that live more than twice as long.
// Knob 4: Volatility. How hard the market trades: at -1 about one trade every 2 s and a sweep every 70 s, at the opening 0.06 two trades a second and a sweep every 22 s, at 1 seven trades a second, bigger ones, and a sweep every 8 s.

const W = 64;
const H = 128;
const { floor, ceil, exp, log, sqrt, sin, cos, abs, min, max, pow, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const gz = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
const expo = (m) => -m * log(1 - Math.random());

const SL = 1 / 30; // one history column per 1/30 s
const HC = 2048; // 68 s of history, enough for 64 LEDs at 1 LED a second
const HM = HC - 1;
const NB = 400; // price levels, one LED each
const OFF = 200; // level 0 sits at node OFF
const NO = 480; // order slots
const NT = 2048; // trade slots
const TM = NT - 1;
const KH = 0; // haze: small short orders
const KO = 1; // ordinary resting orders
const KW = 2; // walls

export function setup(params) {
  const S = {
    t: 0,
    acc: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    sk: [0, 2, 0, 0.06],
    spd: 3.5,
    q: {},
    p: 0,
    pd: 0,
    c: 0,
    vc: 0,
    dir: 1,
    refill: 1,
    boost: 0,
    since: 0,
    sw: { on: false, dir: 1, j: 0, end: 0 },
    wc: 0,
    wa: 0,
    wb: 0,
    slot: 0,
    prevR: 64,
    oOn: new Uint8Array(NO),
    oKind: new Uint8Array(NO),
    oDie: new Uint8Array(NO),
    oIce: new Uint8Array(NO),
    oLvl: new Float32Array(NO),
    oBase: new Float32Array(NO),
    oTgt: new Float32Array(NO),
    oCur: new Float32Array(NO),
    oAge: new Float32Array(NO),
    oLife: new Float32Array(NO),
    oNxt: new Float32Array(NO),
    oSig: new Float32Array(NO),
    oPh1: new Float32Array(NO),
    oPh2: new Float32Array(NO),
    oP1: new Float32Array(NO),
    oP2: new Float32Array(NO),
    oP3: new Float32Array(NO),
    oPh3: new Float32Array(NO),
    bh: new Int16Array(NB),
    bn: new Int16Array(NO),
    bk: new Float32Array(NB),
    fl: new Float32Array(NB),
    tmp: new Float32Array(NB),
    hs: new Float32Array(HC * H),
    hf: new Float32Array(HC * H),
    pl: new Float32Array(HC),
    ph: new Float32Array(HC),
    hd: 0,
    tT: new Float32Array(NT),
    tR: new Float32Array(NT),
    tRad: new Float32Array(NT),
    tD: new Int8Array(NT),
    tn: 0,
    pal: new Float32Array(512 * 3),
    xa: new Int32Array(W),
    xb: new Int32Array(W),
    xf: new Float32Array(W),
    lo: new Float32Array(W),
    hi: new Float32Array(W),
    li: new Float32Array(W),
    db: new Float32Array(W * H),
    ds: new Float32Array(W * H),
    cc: [0, 0, 0],
  };
  params.s = S;
}

// What the four knobs mean, as numbers the simulation reads.
function derive(S) {
  const q = S.q;
  const dN = (cl(S.sk[2], -1, 1) + 1) / 2;
  const vN = (cl(S.sk[3], -1, 1) + 1) / 2;
  q.dN = dN;
  q.vN = vN;
  q.ordRate = 3.5 * pow(4.8, dN);
  q.hazeRate = 6.6 * (0.8 + 0.4 * dN);
  q.wallT = 1.7 + 6.6 * dN;
  q.lifeF = 0.8 + 1.1 * dN;
  q.wsF = 0.85 + 0.3 * dN;
  q.gain = 0.86 + 0.28 * dN;
  q.tradeRate = 0.5 * pow(14, vN);
  q.sweepTs = 70 * pow(0.115, vN);
  q.sizeF = 0.75 + 0.95 * vN;
  q.cSig = 1.4 + 1.9 * vN;
}

const speedOf = (k) => pow(9, cl(k, 0, 3.5) / 3.5);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.sk = S.k.slice();
    S.first = false;
    derive(S);
    S.spd = speedOf(S.sk[1]);
    // let the book fill, then record 70 s of history before the first frame
    for (let n = 0; n < 540; n++) step(S, false);
    for (let n = 0; n < 2100; n++) step(S, true);
    return;
  }
  const e = 1 - exp(-dt / 1.2);
  S.sk[0] = S.k[0];
  S.sk[1] += (S.k[1] - S.sk[1]) * (1 - exp(-dt / 0.25));
  S.sk[2] += (S.k[2] - S.sk[2]) * e;
  S.sk[3] += (S.k[3] - S.sk[3]) * e;
  derive(S);
  S.spd = speedOf(S.sk[1]);
  S.acc += dt;
  let g = 0;
  while (S.acc >= SL && g++ < 4) {
    step(S, true);
    S.acc -= SL;
  }
  if (S.acc > SL) S.acc = SL;
}

// ---------------------------------------------------------------------------
// the book

function newOrder(S, kind, lvl, size, life, sig, ice) {
  for (let n = 0; n < NO; n++) {
    const i = (S.slot + n) % NO;
    if (S.oOn[i]) continue;
    S.slot = i + 1;
    S.oOn[i] = 1;
    S.oKind[i] = kind;
    S.oDie[i] = 0;
    S.oIce[i] = ice;
    S.oLvl[i] = lvl;
    S.oBase[i] = size;
    S.oTgt[i] = size;
    S.oCur[i] = 0;
    S.oAge[i] = 0;
    S.oLife[i] = life;
    S.oSig[i] = sig;
    S.oNxt[i] = expo(kind === KW ? 5 : kind === KO ? 1.8 : 2.6);
    S.oPh1[i] = Math.random() * TAU;
    S.oPh2[i] = Math.random() * TAU;
    S.oP1[i] = 6 + Math.random() * 13;
    S.oP2[i] = 9 + Math.random() * 17;
    S.oP3[i] = 0.8 + Math.random() * 1.6;
    S.oPh3[i] = Math.random() * TAU;
    return i;
  }
  return -1;
}

function pickLevel(S, near, scale) {
  if (Math.random() < near) {
    const d = 1.7 + expo(scale);
    return S.p + (Math.random() < 0.5 ? d : -d);
  }
  return S.vc + (Math.random() * 2 - 1) * 68;
}

function spawnWall(S, q) {
  for (let tries = 0; tries < 6; tries++) {
    const r = Math.random();
    const side = S.wa > S.wb ? (r < 0.72 ? -1 : 1) : S.wa < S.wb ? (r < 0.72 ? 1 : -1) : r < 0.5 ? 1 : -1;
    const d = 6 + expo(21);
    if (d > 62) continue;
    const L = Math.round(S.p + side * d);
    if (abs(L - S.vc) > 62) continue;
    let ok = true;
    for (let i = 0; i < NO; i++) if (S.oOn[i] && S.oKind[i] === KW && !S.oDie[i] && abs(S.oLvl[i] - L) < 5) ok = false;
    if (!ok) continue;
    const size = (3.5 + 22 * pow(Math.random(), 1.7)) * q.wsF;
    const life = 10 + 50 * pow(Math.random(), 1.15);
    newOrder(S, KW, L, size, life, 0.85 + 0.55 * Math.random(), Math.random() < 0.4 ? 1 : 0);
    return;
  }
}

// A trade at a level far from the line sits on its own row; an ordinary one
// sits just off the line, buys above and sells below.
function addTrade(S, level, size, dir, near) {
  const i = S.tn & TM;
  S.tn++;
  const r = 1.8 + 3.2 * sqrt(min(1, size / 10));
  S.tT[i] = S.t;
  S.tR[i] = near ? 64 - (S.pd - S.vc) - dir * (0.7 + 0.85 * r) : 64 - (level - S.vc);
  S.tRad[i] = r;
  S.tD[i] = dir;
}

// Deposit flash energy along the shape of the order that was hit.
function flashAt(S, lvl, amp, sig) {
  const x = lvl + OFF;
  const j0 = floor(x - 2 * sig);
  const j1 = ceil(x + 2 * sig);
  let sum = 0;
  for (let j = j0; j <= j1; j++) sum += exp(-0.5 * ((j - x) / sig) * ((j - x) / sig));
  for (let j = j0; j <= j1; j++) {
    S.fl[j] = min(1.6, S.fl[j] + (amp * exp(-0.5 * ((j - x) / sig) * ((j - x) / sig))) / sum * 2.2);
  }
}

// Take size from every order resting at one level. Returns what was taken.
function consumeLevel(S, j, vol, all, famp) {
  let tot = 0;
  for (let o = S.bh[j + OFF]; o >= 0; o = S.bn[o]) tot += S.oCur[o];
  if (tot <= 1e-4) return 0;
  const take = all ? tot : min(vol, tot);
  const fr = take / tot;
  for (let o = S.bh[j + OFF]; o >= 0; o = S.bn[o]) {
    const c0 = S.oCur[o];
    if (c0 <= 0) continue;
    const c = c0 * fr;
    S.oCur[o] = c0 - c;
    const wall = S.oKind[o] === KW;
    if (!S.oIce[o]) {
      S.oTgt[o] = min(S.oTgt[o], S.oCur[o]);
      S.oBase[o] = min(S.oBase[o], S.oCur[o]);
    }
    flashAt(S, S.oLvl[o], famp * fr * (wall ? 1.3 : 0.8) * min(1, 0.4 + c0), wall ? S.oSig[o] : 0.8);
    if (all || S.oCur[o] < 0.012) {
      S.oOn[o] = 0;
      S.oCur[o] = 0;
    }
  }
  return take;
}

function startSweep(S) {
  const p = S.p;
  const up = [];
  const dn = [];
  for (let i = 0; i < NO; i++) {
    if (!S.oOn[i] || S.oKind[i] !== KW || S.oDie[i] || S.oCur[i] < 3) continue;
    const d = S.oLvl[i] - p;
    if (d > 3 && d < 38) up.push(d);
    else if (d < -3 && d > -38) dn.push(-d);
  }
  up.sort((a, b) => a - b);
  dn.sort((a, b) => a - b);
  let dir;
  if (up.length && dn.length) dir = Math.random() < 0.5 + 0.3 * tanh((S.c - S.p) / 15) ? 1 : -1;
  else if (up.length) dir = 1;
  else if (dn.length) dir = -1;
  else dir = Math.random() < 0.5 ? 1 : -1;
  const list = dir > 0 ? up : dn;
  let D;
  if (list.length) {
    const nw = min(list.length, 1 + (Math.random() < 0.35 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0));
    D = list[nw - 1] + 3 + Math.random() * 4;
  } else D = 9 + Math.random() * 14;
  const room = dir > 0 ? S.vc + 48 - p : p - (S.vc - 48);
  D = min(D, max(8, room));
  S.sw.on = true;
  S.sw.dir = dir;
  S.sw.j = dir > 0 ? floor(p) + 1 : ceil(p) - 1;
  S.sw.end = Math.round(p + dir * D);
  S.since = 0;
}

function trade(S, q) {
  const b = tanh((S.c - S.p) / 12);
  const pb = cl(0.5 + 0.36 * b + 0.08 * S.dir, 0.06, 0.94);
  const dir = Math.random() < pb ? 1 : -1;
  S.dir = dir;
  const vol = min(20, (0.2 * q.sizeF) / pow(1 - Math.random(), 1 / 1.6));
  let j = dir > 0 ? floor(S.p) + 1 : ceil(S.p) - 1;
  let rem = vol;
  let last = 0;
  let jl = j;
  let left = 0;
  let n = 0;
  for (; n < 3 && rem > 1e-4; n++, j += dir) {
    jl = j;
    const got = consumeLevel(S, j, rem, false, 0.4);
    if (got > 0) {
      rem -= got;
      last = j;
    }
    let rest = 0;
    for (let o = S.bh[j + OFF]; o >= 0; o = S.bn[o]) rest += S.oCur[o];
    left = rest;
  }
  const used = vol - rem;
  if (used > 0.1) addTrade(S, last, used, dir, true);
  const pn = jl - dir * (left > 1e-3 ? (left > 3 ? 1.5 : 1) : 0);
  if ((pn - S.p) * dir > 0) S.p = pn;
}

function step(S, rec) {
  const q = S.q;
  const dt = SL;
  S.t += dt;
  const t = S.t;
  S.c += (-S.c / 90) * dt + q.cSig * sqrt(dt) * gz() * 0.7;
  S.c = cl(S.c, -60, 60);
  S.refill = min(1, S.refill + 0.7 * dt);
  S.boost = max(0, S.boost - dt);
  S.since += dt;
  for (let i = 0; i < NB; i++) S.fl[i] *= 0.94;

  // orders live, resize, get pulled
  const eUp = [1 - exp(-dt / 1.0), 1 - exp(-dt / 0.7), 1 - exp(-dt / 1.4)];
  const eDn = [1 - exp(-dt / 0.5), 1 - exp(-dt / 0.4), 1 - exp(-dt / 0.9)];
  let wc = 0;
  let wa = 0;
  let wb = 0;
  for (let i = 0; i < NO; i++) {
    if (!S.oOn[i]) continue;
    const kd = S.oKind[i];
    S.oAge[i] += dt;
    if (!S.oDie[i]) {
      if (S.oAge[i] > S.oLife[i] || (kd === KW && abs(S.oLvl[i] - S.vc) > 100)) {
        S.oDie[i] = 1;
        S.oTgt[i] = 0;
      } else {
        S.oNxt[i] -= dt;
        if (S.oNxt[i] <= 0) {
          S.oNxt[i] = expo(kd === KW ? 5 : kd === KO ? 1.8 : 2.6);
          const b = S.oBase[i];
          S.oTgt[i] = cl(b * exp((kd === KW ? 0.18 : 0.34) * gz()), b * 0.45, b * 1.6);
        }
      }
    }
    const cur = S.oCur[i];
    const tg = S.oTgt[i];
    S.oCur[i] = cur + (tg - cur) * (cur < tg ? eUp[kd] : eDn[kd]);
    if (S.oDie[i] && S.oCur[i] < 0.01) {
      S.oOn[i] = 0;
      continue;
    }
    if (kd === KW && !S.oDie[i] && abs(S.oLvl[i] - S.vc) <= 66) {
      wc++;
      if (S.oLvl[i] > S.p) wa++;
      else wb++;
    }
  }
  S.wc = wc;
  S.wa = wa;
  S.wb = wb;

  // arrivals
  const lcO = min(1, (3.3 * q.lifeF * S.spd) / 8);
  let x = q.ordRate * dt * lcO;
  while (x > 0) {
    if (Math.random() < x) {
      const L = pickLevel(S, 0.5, 22);
      const dist = abs(L - S.p);
      if (dist >= 1.7 && (dist > 30 || Math.random() < S.refill)) {
        const size = exp(0.3 * gz()) * (0.5 + 0.4 * exp(-dist / 22));
        newOrder(S, KO, Math.round(L), size, cl(expo(3.3 * q.lifeF), max(0.8, 8 / S.spd), 24), 0.75, 0);
      }
    }
    x -= 1;
  }
  x = q.hazeRate * dt * min(1, (8.5 * S.spd) / 7);
  while (x > 0) {
    if (Math.random() < x) {
      const L = pickLevel(S, 0.3, 30);
      const dist = abs(L - S.p);
      if (dist >= 1.7 && (dist > 30 || Math.random() < S.refill)) newOrder(S, KH, Math.round(L), 0.1 + 0.1 * Math.random(), max(3, 7 / S.spd) + 11 * Math.random(), 0.75, 0);
    }
    x -= 1;
  }
  const wt = floor(q.wallT + 0.5);
  if (S.wc < wt && Math.random() < dt / (S.boost > 0 ? 0.9 : 2.2)) spawnWall(S, q);
  else if (S.wc > wt + 1 && Math.random() < dt / 2.5) {
    for (let n = 0; n < 6; n++) {
      const i = floor(Math.random() * NO);
      if (S.oOn[i] && S.oKind[i] === KW && !S.oDie[i]) {
        S.oDie[i] = 1;
        S.oTgt[i] = 0;
        break;
      }
    }
  }

  // who rests where
  S.bh.fill(-1);
  for (let i = 0; i < NO; i++) {
    if (!S.oOn[i] || S.oCur[i] < 0.003) continue;
    const j = Math.round(S.oLvl[i]) + OFF;
    S.bn[i] = S.bh[j];
    S.bh[j] = i;
  }

  // market orders
  const sw = S.sw;
  if (sw.on) {
    for (let n = 0; n < 3 && sw.on; n++) {
      const j = sw.j;
      const got = consumeLevel(S, j, 1e9, true, 1.0);
      if (got > 0.25) addTrade(S, j, got, sw.dir, false);
      S.p = j;
      sw.j += sw.dir;
      if ((sw.j - sw.end) * sw.dir > 0) {
        sw.on = false;
        S.refill = -0.6;
        S.boost = 8;
      }
    }
  } else {
    let r = q.tradeRate * dt;
    while (r > 0) {
      if (Math.random() < r) trade(S, q);
      r -= 1;
    }
    if (S.since > 2.5 && Math.random() < dt / q.sweepTs) startSweep(S);
  }
  S.p = cl(S.p, -118, 118);

  // the line and the view
  S.pd += (S.p - S.pd) * (1 - exp(-dt / (sw.on ? 0.14 : 0.65)));
  const vT = cl(S.vc, S.p - 11, S.p + 11);
  // the view pans slowly, so streaks tilt by 17 degrees at most, unless the line nears an edge
  const cap = 0.3 * S.spd * (1 + max(0, abs(S.p - S.vc) - 36) * 0.35) * dt;
  S.vc += cl((vT - S.vc) * (1 - exp(-dt / 5.5)), -cap, cap);
  S.vc = cl(S.vc, -110, 110);

  if (!rec) return;
  snapshot(S, t);
}

// ---------------------------------------------------------------------------
// one history column: the book as the panel's 128 rows

function snapshot(S, t) {
  const { bk, fl, tmp } = S;
  bk.fill(0);
  for (let i = 0; i < NO; i++) {
    if (!S.oOn[i]) continue;
    let size = S.oCur[i];
    if (size < 0.003) continue;
    let lv = S.oLvl[i];
    const x0 = lv + OFF;
    // size breathes along the streak, so a long one is never a flat bar
    const kd = S.oKind[i];
    size *= 1 + (kd === KW ? 0.14 : kd === KO ? 0.32 : 0.42) * sin((TAU * t) / S.oP3[i] + S.oPh3[i]);
    if (S.oKind[i] === KW) {
      lv += 0.3 * sin((TAU * t) / S.oP2[i] + S.oPh2[i]);
      size *= 1 + 0.1 * sin((TAU * t) / S.oP1[i] + S.oPh1[i]);
      const x = lv + OFF;
      const sig = S.oSig[i];
      const j0 = floor(x - 2.2 * sig);
      const j1 = ceil(x + 2.2 * sig);
      let sum = 0;
      for (let j = j0; j <= j1; j++) sum += exp(-0.5 * ((j - x) / sig) * ((j - x) / sig));
      const m = size / sum;
      for (let j = j0; j <= j1; j++) bk[j] += m * exp(-0.5 * ((j - x) / sig) * ((j - x) / sig));
    } else {
      const j = Math.round(x0);
      bk[j - 1] += 0.2 * size;
      bk[j] += 0.6 * size;
      bk[j + 1] += 0.2 * size;
    }
  }
  S.hd = (S.hd + 1) & HM;
  const base = S.hd * H;
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? bk : fl;
    const dst = pass === 0 ? S.hs : S.hf;
    for (let k = 1; k < NB - 1; k++) tmp[k] = 0.25 * src[k - 1] + 0.5 * src[k] + 0.25 * src[k + 1];
    for (let y = 0; y < H; y++) {
      const u = S.vc + 64 - (y + 0.5) + OFF;
      const j = floor(u);
      const f = u - j;
      dst[base + y] = tmp[j] * (1 - f) + tmp[j + 1] * f;
    }
  }
  const rn = 64 - (S.pd - S.vc);
  S.pl[S.hd] = min(rn, S.prevR);
  S.ph[S.hd] = max(rn, S.prevR);
  S.prevR = rn;
}

// ---------------------------------------------------------------------------
// colour

// Heat by tone t: hue (turns, counted up from indigo), saturation, value.
const STOPS = [
  [0.0, 0.72, 0.95, 0.0],
  [0.07, 0.71, 0.95, 0.14],
  [0.18, 0.72, 0.93, 0.3],
  [0.32, 0.77, 0.9, 0.52],
  [0.48, 0.86, 0.86, 0.78],
  [0.63, 0.96, 0.86, 0.95],
  [0.77, 1.02, 0.86, 1.0],
  [0.89, 1.07, 0.62, 1.0],
  [1.0, 1.1, 0.2, 1.0],
];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const r = v * (1 - s * (1 - f));
  if (i === 0) { o[0] = v; o[1] = r; o[2] = p; }
  else if (i === 1) { o[0] = q; o[1] = v; o[2] = p; }
  else if (i === 2) { o[0] = p; o[1] = v; o[2] = r; }
  else if (i === 3) { o[0] = p; o[1] = q; o[2] = v; }
  else if (i === 4) { o[0] = r; o[1] = p; o[2] = v; }
  else { o[0] = v; o[1] = p; o[2] = q; }
}

function buildPalette(S, k1) {
  const pal = S.pal;
  const c = S.cc;
  let si = 0;
  for (let n = 0; n < 512; n++) {
    const b = n / 511;
    while (si < STOPS.length - 2 && b > STOPS[si + 1][0]) si++;
    const a = STOPS[si];
    const d = STOPS[si + 1];
    const u = (b - a[0]) / (d[0] - a[0]);
    // where K1 turns the dark end orange it would read as brown, so the darkest
    // steps lean towards crimson there
    let hh = lerp(a[1], d[1], u) + k1;
    const hf = hh - floor(hh);
    const warm = exp(-(((hf - 0.1) / 0.1) * ((hf - 0.1) / 0.1))) * (1 - sm(0.05, 0.3, b));
    hh = hh - warm * (hf - 0.97) * 0.8;
    // pure greens and cyans look cheap on the panel: lower their value and saturation
    let gw = (hh - floor(hh) - 0.36) / 0.15;
    gw = exp(-gw * gw);
    let mw = (b - 0.5) / 0.24;
    mw = exp(-mw * mw);
    hsv(hh, lerp(a[2], d[2], u) * (1 - 0.2 * gw * mw), lerp(a[3], d[3], u) * (1 - 0.34 * gw * mw), c);
    pal[n * 3] = c[0] * 255;
    pal[n * 3 + 1] = c[1] * 255;
    pal[n * 3 + 2] = c[2] * 255;
  }
}

const screen = (a, b) => 255 - ((255 - a) * (255 - b)) / 255;

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const q = S.q;
  const k1 = S.sk[0];
  buildPalette(S, k1);
  const { pal, xa, xb, xf, lo, hi, li, db, ds, hs, hf, cc } = S;
  const spd = S.spd;
  const acc = S.acc;
  const hd = S.hd;

  // pale cool line, buy and sell tints, the flash colour
  const LC = [0, 0, 0];
  hsv(0.58 + k1, 0.09, 1.0, cc);
  LC[0] = cc[0] * 255; LC[1] = cc[1] * 255; LC[2] = cc[2] * 255;
  const TB = [0, 0, 0];
  hsv(0.5 + k1, 0.92, 1.0, cc);
  TB[0] = cc[0] * 255; TB[1] = cc[1] * 255; TB[2] = cc[2] * 255;
  const TS = [0, 0, 0];
  hsv(0.9 + k1, 0.85, 1.0, cc);
  TS[0] = cc[0] * 255; TS[1] = cc[1] * 255; TS[2] = cc[2] * 255;
  const FW = [pal[511 * 3] * 0.5 + 127, pal[511 * 3 + 1] * 0.5 + 127, pal[511 * 3 + 2] * 0.5 + 127];

  // where each column reads the history
  for (let x = 0; x < W; x++) {
    const a = max(0, 63.5 - (x + 0.5)) / spd + acc;
    const pos = a / SL;
    const i0 = floor(pos);
    xf[x] = pos - i0;
    xa[x] = ((hd - i0) & HM) * H;
    xb[x] = ((hd - i0 - 1) & HM) * H;
    // the line's extent over the LED's width
    const p0 = max(0, (a - 0.5 / spd) / SL);
    const p1 = (a + 0.5 / spd) / SL;
    let l = 1e9;
    let h = -1e9;
    for (let k = floor(p0); k <= ceil(p1); k++) {
      const s = (hd - k) & HM;
      if (S.pl[s] < l) l = S.pl[s];
      if (S.ph[s] > h) h = S.ph[s];
    }
    lo[x] = l;
    hi[x] = h;
    li[x] = 0.72 + 0.28 * exp(-(63.5 - (x + 0.5)) / 22);
  }

  // trade discs
  db.fill(0);
  ds.fill(0);
  const nT = min(S.tn, NT);
  for (let k = 1; k <= nT; k++) {
    const i = (S.tn - k) & TM;
    const age = S.t - S.tT[i] + acc;
    const xc = 63.5 - age * spd;
    if (xc < -6) {
      if (age * spd > 90) break;
      continue;
    }
    const r = S.tRad[i];
    const dxh = 63.5 - xc;
    const amp = (0.55 + 0.45 * exp(-dxh / 3)) * exp(-dxh / 12);
    if (amp < 0.02) continue;
    const yc = S.tR[i];
    const arr = S.tD[i] > 0 ? db : ds;
    const rr = 1.15 * r;
    const x0 = max(0, floor(xc - rr));
    const x1 = min(W - 1, ceil(xc + rr));
    const y0 = max(0, floor(yc - rr));
    const y1 = min(H - 1, ceil(yc + rr));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - yc;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - xc;
        const d = sqrt(dx * dx + dy * dy);
        if (d >= rr) continue;
        arr[y * W + x] += amp * (1 - sm(0.35 * r, rr, d));
      }
    }
  }

  const rowNow = 64 - (S.pd - S.vc);
  const gain = q.gain;
  const TMA = 1 / 4;
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const fr = xf[x];
      const A = xa[x] + y;
      const B = xb[x] + y;
      const s = (hs[A] * (1 - fr) + hs[B] * fr) * gain;
      const f = hf[A] * (1 - fr) + hf[B] * fr;
      let b = s > 0 ? pow(s * TMA, 0.5) : 0;
      b = min(1, b + 0.42 * f);
      const pi = ((b * 511) | 0) * 3;
      let r = pal[pi];
      let g = pal[pi + 1];
      let bl = pal[pi + 2];
      if (f > 0.03) {
        const w = pow(min(1, f * 1.1), 1.3) * 0.85;
        r = lerp(r, FW[0], w);
        g = lerp(g, FW[1], w);
        bl = lerp(bl, FW[2], w);
      }
      // the line sits in a slightly darker lane
      const d = max(0, lo[x] - yc, yc - hi[x]);
      const sh = 1 - 0.55 * (1 - sm(1.4, 4.8, d));
      r *= sh; g *= sh; bl *= sh;
      // the price line and its glow
      const la = (1 - sm(0.7, 1.55, d)) * li[x];
      const gl = 0.3 * exp(-(d * d) / 5) * li[x];
      const dxn = x + 0.5 - 63.5;
      const dyn = yc - rowNow;
      const hg = 0.5 * exp(-(dxn * dxn + dyn * dyn) / 11);
      r = screen(r, LC[0] * min(1, gl + hg));
      g = screen(g, LC[1] * min(1, gl + hg));
      bl = screen(bl, LC[2] * min(1, gl + hg));
      r = lerp(r, LC[0], la);
      g = lerp(g, LC[1], la);
      bl = lerp(bl, LC[2], la);
      // trades sit on the line as beads
      const ib = db[o] > 0 ? min(0.92, 1 - exp(-db[o] * 2.6)) : 0;
      const is = ds[o] > 0 ? min(0.92, 1 - exp(-ds[o] * 2.6)) : 0;
      if (ib > 0.004) {
        const wt = ib * ib * 0.5;
        r *= 1 - 0.6 * ib; g *= 1 - 0.6 * ib; bl *= 1 - 0.6 * ib;
        r = lerp(r, lerp(TB[0], 255, wt), ib);
        g = lerp(g, lerp(TB[1], 255, wt), ib);
        bl = lerp(bl, lerp(TB[2], 255, wt), ib);
      }
      if (is > 0.004) {
        const wt = is * is * 0.5;
        r *= 1 - 0.6 * is; g *= 1 - 0.6 * is; bl *= 1 - 0.6 * is;
        r = lerp(r, lerp(TS[0], 255, wt), is);
        g = lerp(g, lerp(TS[1], 255, wt), is);
        bl = lerp(bl, lerp(TS[2], 255, wt), is);
      }
      display.setPixel(x, y, min(255, r), min(255, g), min(255, bl));
    }
  }
}
