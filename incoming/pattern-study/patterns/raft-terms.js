// ===== Patternflow pattern =====
// Title:   Raft Terms
// Family:  raftconsensus
// Idea:    Five servers run the Raft consensus protocol: randomised election timeouts, votes that pass or split, a leader whose heartbeats and log entries ripple outwards over lossy links, and a crash that sends them back to vote under a new term, each term its own colour.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Raft leader election and log replication (Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm", 2014, from memory), the golden-ratio hue step that keeps neighbouring terms apart (Vogel-style, from memory), original code, pattern round 276
// Round:   276
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Timeout=1.2..4, Loss=-1..1, Crashes=-1..1
//
// Knob 1: Hue. ...
// Knob 2: Timeout. ...
// Knob 3: Loss. ...
// Knob 4: Crashes. ...
//
// What the picture is. ...

const W = 64, H = 128, N = 5, NL = 10;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = (a, b) => a + (b - a) * Math.random();
const expo = (m) => -log(1 - Math.random()) * m;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---------------------------------------------------------------- layout
const CX = 32, CY = 42, RAD = 22;      // the pentagon of servers
const PX = [], PY = [];
for (let i = 0; i < N; i++) {
  PX.push(CX + RAD * sin((i * TAU) / N));
  PY.push(CY - RAD * cos((i * TAU) / N));
}
const LID = [[], [], [], [], []];      // link number of a pair
const LA = [], LB = [];
for (let i = 0; i < N; i++)
  for (let j = i + 1; j < N; j++) {
    LID[i][j] = LID[j][i] = LA.length;
    LA.push(i);
    LB.push(j);
  }
const ORD = [4, 3, 0, 2, 1];           // log columns, left to right, in the order the servers stand across the panel
const COLX = 2, COLW = 11, COLP = 12;  // log columns
const PITCH = 4, LBOT = 126, LTOP = 77; // one entry is 3 LEDs and a gap
const BATCH = 4;                       // entries in one AppendEntries
const HIST = 48;

const HUE0 = 0.58, HSTEP = 0.137;
const frac = (v) => v - floor(v);
// the colour of a term: the hue steps 0.137 a term and the lightness runs a triangle wave on 0.235 a term, so terms a whole lap of hues apart (7 of them) still differ
function tcol(t, k1, s, v, o) {
  hsv(t * HSTEP + k1 + HUE0, s, v * (0.65 + 0.35 * abs(2 * frac(t * 0.235 + 0.3) - 1)), o);
}

// ---------------------------------------------------------------- raft
function newSrv() {
  return {
    alive: true, role: 0, term: 0, voted: -1, tm: 0, tmFull: 1, lg: [], bn: [], commit: 0,
    nx: [1, 1, 1, 1, 1], mt: [0, 0, 0, 0, 0], hb: 0, vmask: 0, down: 0, gh: new Map(), pl: [],
    rc: 0, up: 1, born: 0,
  };
}

function par(k) {
  const T = cl(k[1], 0.6, 6);
  const s = cl((k[2] + 1) / 2, 0, 1);
  return {
    T, h: cl(0.3 * T, 0.4, 1.0),
    D: 0.1 + 0.5 * pow(s, 2.5),
    loss: 0.38 * pow(s, 2),
    crash: 30 * pow(2, -2.2 * cl(k[3], -1.2, 1.2)),
    pmean: 15 * (1 - 0.35 * s),
  };
}

const lastIdx = (S, s) => S.G + s.lg.length;
// An entry is stored as term + payload, the payload a fraction below 1 that only the picture reads.
function entAt(S, s, i) {
  if (i > S.G) return s.lg[i - S.G - 1];
  const q = S.hist.length - 1 - (S.G - i);
  return q >= 0 ? S.hist[q] : 0;
}
const termAt = (S, s, i) => floor(entAt(S, s, i));
const mint = (t) => t + 0.98 * Math.random();
function resetTimer(S, s, P) {
  s.tmFull = rnd(P.T, 2 * P.T);
  s.tm = s.tmFull;
}

function send(S, P, from, to, m) {
  m.from = from; m.to = to; m.a = 0;
  m.dur = P.D * rnd(0.6, 1.4);
  const l = LID[from][to];
  m.l = l;
  if (S.cutOn[l]) m.die = rnd(0.3, 0.6);
  else if (Math.random() < P.loss) m.die = rnd(0.3, 0.9);
  else m.die = 2;
  S.msgs.push(m);
  S.lgl[l] = min(0.6, S.lgl[l] + 0.2);
  S.lgt[l] = m.t;
  S.lgm[l] = m.term;
}

function sendAE(S, P, i, f) {
  const s = S.srv[i];
  const ni = max(S.G + 1, s.nx[f]), pi = ni - 1, last = lastIdx(S, s);
  const n = max(0, min(BATCH, last - pi));
  const ents = [];
  for (let k = 0; k < n; k++) ents.push(entAt(S, s, pi + 1 + k));
  send(S, P, i, f, { t: 2, term: s.term, pi, pt: termAt(S, s, pi), ents, lc: s.commit });
}

function beat(S, P, i) {
  const s = S.srv[i];
  for (let f = 0; f < N; f++) if (f !== i) sendAE(S, P, i, f);
  s.pl.push(S.now);
}

function stepDown(S, P, s, term) {
  if (term > s.term) { s.term = term; s.voted = -1; }
  if (s.role === 2) resetTimer(S, s, P);
  s.role = 0;
  s.vmask = 0;
}

function becomeLeader(S, P, i) {
  const s = S.srv[i], last = lastIdx(S, s);
  s.role = 2;
  for (let f = 0; f < N; f++) { s.nx[f] = last + 1; s.mt[f] = 0; }
  s.lg.push(mint(s.term)); // the no-op that lets the new leader commit
  s.bn.push(S.now);
  s.hb = P.h;
  s.pl.length = 0;
  beat(S, P, i);
}

function startElection(S, P, i) {
  const s = S.srv[i], last = lastIdx(S, s);
  s.term++;
  s.role = 1;
  s.voted = i;
  s.vmask = 1 << i;
  resetTimer(S, s, P);
  for (let f = 0; f < N; f++)
    if (f !== i) send(S, P, i, f, { t: 0, term: s.term, li: last, lt: termAt(S, s, last) });
}

function onRV(S, P, i, m) {
  const s = S.srv[i];
  if (m.term > s.term) stepDown(S, P, s, m.term);
  let grant = false;
  if (m.term === s.term && (s.voted === -1 || s.voted === m.from)) {
    const li = lastIdx(S, s), lt = termAt(S, s, li);
    if (m.lt > lt || (m.lt === lt && m.li >= li)) {
      grant = true;
      s.voted = m.from;
      resetTimer(S, s, P);
    }
  }
  send(S, P, i, m.from, { t: 1, term: s.term, gr: grant, rt: m.term });
}

function onRVR(S, P, i, m) {
  const s = S.srv[i];
  if (m.term > s.term) return stepDown(S, P, s, m.term);
  if (s.role !== 1 || m.rt !== s.term || !m.gr) return;
  s.vmask |= 1 << m.from;
  let c = 0;
  for (let j = 0; j < N; j++) if (s.vmask & (1 << j)) c++;
  if (c >= 3) becomeLeader(S, P, i);
}

function onAE(S, P, i, m) {
  const s = S.srv[i];
  if (m.term < s.term) {
    send(S, P, i, m.from, { t: 3, term: s.term, ok: false, hint: 1, rt: m.term, pi: m.pi });
    return;
  }
  if (m.term > s.term) { s.term = m.term; s.voted = -1; }
  s.role = 0;
  s.vmask = 0;
  resetTimer(S, s, P);
  let last = lastIdx(S, s);
  if (m.pi > last || (m.pi >= S.G && termAt(S, s, m.pi) !== m.pt)) {
    let hint;
    if (m.pi > last) hint = last + 1;
    else {
      const ct = termAt(S, s, m.pi);
      let j = m.pi;
      while (j - 1 > S.G && termAt(S, s, j - 1) === ct) j--;
      hint = j;
    }
    send(S, P, i, m.from, { t: 3, term: s.term, ok: false, hint, rt: m.term, pi: m.pi });
    return;
  }
  let idx = m.pi;
  for (let k = 0; k < m.ents.length; k++) {
    idx++;
    const et = m.ents[k];
    last = lastIdx(S, s);
    if (idx <= last) {
      if (termAt(S, s, idx) !== floor(et)) {
        for (let q = idx; q <= last; q++) s.gh.set(q, { t: entAt(S, s, q), at: S.now });
        s.lg.length = idx - S.G - 1;
        s.bn.length = idx - S.G - 1;
        s.lg.push(et);
        s.bn.push(S.now);
      }
    } else {
      s.lg.push(et);
      s.bn.push(S.now);
    }
  }
  const mi = m.pi + m.ents.length;
  if (m.lc > s.commit) s.commit = max(s.commit, min(m.lc, mi));
  send(S, P, i, m.from, { t: 3, term: s.term, ok: true, mi, rt: m.term, pi: m.pi });
}

function advanceCommit(S, s, i) {
  for (let n = lastIdx(S, s); n > s.commit; n--) {
    if (termAt(S, s, n) !== s.term) break;
    let c = 1;
    for (let j = 0; j < N; j++) if (j !== i && s.mt[j] >= n) c++;
    if (c >= 3) { s.commit = n; break; }
  }
}

function onAER(S, P, i, m) {
  const s = S.srv[i], f = m.from;
  if (m.term > s.term) return stepDown(S, P, s, m.term);
  if (s.role !== 2 || m.rt !== s.term) return;
  if (m.ok) {
    if (m.mi > s.mt[f]) s.mt[f] = m.mi;
    s.nx[f] = max(s.nx[f], s.mt[f] + 1);
    advanceCommit(S, s, i);
    if (s.nx[f] <= lastIdx(S, s)) sendAE(S, P, i, f);
  } else if (m.pi === s.nx[f] - 1) {
    s.nx[f] = max(S.G + 1, min(m.hint, s.nx[f] - 1));
    sendAE(S, P, i, f);
  }
}

function deliver(S, P, m) {
  const d = S.srv[m.to];
  if (!d.alive) return;
  d.rc = 1;
  if (m.t === 0) onRV(S, P, m.to, m);
  else if (m.t === 1) onRVR(S, P, m.to, m);
  else if (m.t === 2) onAE(S, P, m.to, m);
  else onAER(S, P, m.to, m);
}

function leaders(S) {
  const o = [];
  for (let i = 0; i < N; i++) if (S.srv[i].alive && S.srv[i].role === 2) o.push(i);
  return o;
}

function startPartition(S) {
  S.pLeft = rnd(3.5, 10);
  const ld = leaders(S);
  const r = Math.random();
  const cut = (a, b) => { S.cutOn[LID[a][b]] = 1; };
  if (r < 0.3 || r < 0.5) {
    let v = floor(Math.random() * N);
    if (r < 0.3 && ld.length) v = ld[floor(Math.random() * ld.length)];
    for (let j = 0; j < N; j++) if (j !== v) cut(v, j);
  } else if (r < 0.72) {
    const a = floor(Math.random() * N);
    let b = (a + 1 + floor(Math.random() * (N - 1))) % N;
    for (let x = 0; x < N; x++)
      for (let y = x + 1; y < N; y++) {
        const ix = x === a || x === b, iy = y === a || y === b;
        if (ix !== iy) cut(x, y);
      }
    b = 0;
  } else {
    if (ld.length && Math.random() < 0.6) {
      const v = ld[0];
      let f = floor(Math.random() * N);
      if (f === v) f = (f + 1) % N;
      cut(v, f);
    } else S.cutOn[floor(Math.random() * NL)] = 1;
  }
}

function step(S, P, dt) {
  S.now += dt;
  const now = S.now;
  // partitions
  if (S.pLeft > 0) {
    S.pLeft -= dt;
    if (S.pLeft <= 0) { S.cutOn.fill(0); S.pNext = rnd(0.6, 1.4) * P.pmean; }
  } else {
    S.pNext -= dt;
    if (S.pNext <= 0) startPartition(S);
  }
  // crashes, mostly of the leader
  S.cNext -= dt;
  if (S.cNext <= 0) {
    const ld = leaders(S);
    let downs = 0;
    for (let i = 0; i < N; i++) if (!S.srv[i].alive) downs++;
    if (downs < 2 && (ld.length || Math.random() < 0.5)) {
      let v = ld.length ? ld[0] : -1;
      for (const j of ld) if (S.srv[j].term > S.srv[v].term) v = j;
      if (v < 0 || Math.random() < 0.3) {
        // now and then it is a follower that goes down, and has to catch up when it returns
        const f = [];
        for (let j = 0; j < N; j++) if (S.srv[j].alive && S.srv[j].role !== 2) f.push(j);
        if (f.length) v = f[floor(Math.random() * f.length)];
      }
      const s = S.srv[v];
      s.alive = false; s.role = 0; s.vmask = 0; s.down = rnd(3.5, 9);
      S.cNext = expo(P.crash) + 1.5;
    } else S.cNext = 0.8;
  }
  for (let i = 0; i < N; i++) {
    const s = S.srv[i];
    if (!s.alive) {
      s.down -= dt;
      if (s.down <= 0) { s.alive = true; s.role = 0; resetTimer(S, s, P); }
    }
  }
  // client entries
  S.eNext -= dt;
  if (S.eNext <= 0) {
    S.eNext = expo(1.1) + 0.5;
    const ld = leaders(S);
    if (ld.length) {
      const i = ld[floor(Math.random() * ld.length)], s = S.srv[i];
      s.lg.push(mint(s.term));
      s.bn.push(now);
      beat(S, P, i);
      s.hb = P.h;
    }
  }
  // timers
  for (let i = 0; i < N; i++) {
    const s = S.srv[i];
    if (!s.alive) continue;
    if (s.role === 2) {
      s.hb -= dt;
      if (s.hb <= 0) { s.hb = P.h; beat(S, P, i); }
    } else {
      s.tm -= dt;
      if (s.tm <= 0) startElection(S, P, i);
    }
  }
  // messages
  for (let q = S.msgs.length - 1; q >= 0; q--) {
    const m = S.msgs[q];
    m.a += dt;
    const f = m.a / m.dur;
    if (m.die > 1 && S.cutOn[m.l]) m.die = f + 0.03;
    if (f >= m.die) {
      S.puffs.push({ x: PX[m.from] + (PX[m.to] - PX[m.from]) * f, y: PY[m.from] + (PY[m.to] - PY[m.from]) * f, a: 0, t: m.t, term: m.term });
      S.msgs.splice(q, 1);
    } else if (f >= 1) {
      S.msgs.splice(q, 1);
      deliver(S, P, m);
    }
  }
  // the log's agreed prefix is dropped once every server holds it as committed
  let mc = 1e9;
  for (let i = 0; i < N; i++) mc = min(mc, S.srv[i].commit);
  while (S.G < mc) {
    const t = S.srv[0].lg[0];
    for (let i = 0; i < N; i++) { S.srv[i].lg.shift(); S.srv[i].bn.shift(); }
    S.hist.push(t);
    if (S.hist.length > HIST) S.hist.shift();
    S.G++;
  }
}

// ---------------------------------------------------------------- state
export function setup(params) {
  const srv = [];
  for (let i = 0; i < N; i++) srv.push(newSrv());
  params.s = {
    now: 0, k: null, ready: false, srv, msgs: [], puffs: [], G: 0, hist: [],
    cutOn: new Uint8Array(NL), cv: new Float32Array(NL),
    lgl: new Float32Array(NL), lgt: new Uint8Array(NL), lgm: new Float32Array(NL),
    pLeft: 0, pNext: rnd(8, 18), cNext: rnd(10, 22), eNext: 1,
    scroll: 0, amb: [0, 0, 0],
  };
}

const MS = 0.5;
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  const P = par(S.k);
  if (!S.ready) {
    S.ready = true;
    for (let i = 0; i < N; i++) resetTimer(S, S.srv[i], P);
    let tt = 0;
    while (tt < 45 || (tt < 120 && !leaders(S).length)) { step(S, P, 1 / 30); tt += 1 / 30; }
    S.msgs.length = 0;
    S.puffs.length = 0;
    S.scroll = medianLast(S) + MS;
    S.cv.set(S.cutOn);
  }
  const n = max(1, ceil(d / (1 / 60)));
  for (let q = 0; q < n; q++) step(S, P, d / n);
  // eased things for the picture
  const now = S.now;
  const a8 = 1 - exp(-d / 0.12), a3 = 1 - exp(-d / 0.3);
  for (let l = 0; l < NL; l++) {
    S.cv[l] += (S.cutOn[l] - S.cv[l]) * a3;
    S.lgl[l] *= exp(-d / 0.5);
  }
  for (let i = 0; i < N; i++) {
    const s = S.srv[i];
    s.up += ((s.alive ? 1 : 0) - s.up) * a3;
    s.rc *= exp(-d / 0.25);
    while (s.pl.length && now - s.pl[0] > 0.9) s.pl.shift();
    for (const [k, g] of s.gh) if (now - g.at > 1.2) s.gh.delete(k);
  }
  for (let q = S.puffs.length - 1; q >= 0; q--) {
    S.puffs[q].a += d;
    if (S.puffs[q].a > 0.4) S.puffs.splice(q, 1);
  }
  S.scroll += (medianLast(S) + MS - S.scroll) * (1 - exp(-d / 0.25));
  // ground glow follows the newest term
  let tm = 0, ld = -1;
  for (let i = 0; i < N; i++) {
    if (S.srv[i].alive && S.srv[i].term > tm) tm = S.srv[i].term;
    if (S.srv[i].role === 2 && S.srv[i].alive) ld = i;
  }
  tcol(tm, S.k[0], 0.5, 1, AMB);
  const amp = ld >= 0 ? 0.17 : 0.09;
  for (let c = 0; c < 3; c++) S.amb[c] += (AMB[c] * amp - S.amb[c]) * a3;
  void a8;
}

function medianLast(S) {
  const a = [];
  for (let i = 0; i < N; i++) a.push(lastIdx(S, S.srv[i]));
  a.sort((x, y) => x - y);
  return a[2];
}

// ---------------------------------------------------------------- draw
const AMB = [0, 0, 0];
const BUF = new Float32Array(W * H * 3);
const C1 = [0, 0, 0], C2 = [0, 0, 0], C3 = [0, 0, 0];

function lump(cx, cy, sig, amp, c) {
  const R = floor(sig * 3) + 1, is2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R);
  const y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = 255 * amp * exp(-(dx * dx + dy * dy) * is2);
      const o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

function add(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  BUF[o] += r; BUF[o + 1] += g; BUF[o + 2] += b;
}

function ground(S) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, g = exp(-(dx * dx + dy * dy) / (2 * 30 * 30));
      const o = (y * W + x) * 3;
      BUF[o] = 13 + 255 * S.amb[0] * g;
      BUF[o + 1] = 17 + 255 * S.amb[1] * g;
      BUF[o + 2] = 28 + 255 * S.amb[2] * g;
    }
}

function drawLinks(S, k1) {
  for (let l = 0; l < NL; l++) {
    const a = LA[l], b = LB[l];
    const ax = PX[a], ay = PY[a], bx = PX[b], by = PY[b];
    const len = sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const cv = S.cv[l], gl = S.lgl[l];
    tcol(S.lgm[l], k1, 0.4, 1, C1);
    if (S.lgt[l] < 2) { C1[0] = 0.95; C1[1] = 0.88; C1[2] = 0.7; }
    const x0 = max(0, floor(min(ax, bx)) - 2), x1 = min(W - 1, ceil(max(ax, bx)) + 2);
    const y0 = max(0, floor(min(ay, by)) - 2), y1 = min(H - 1, ceil(max(ay, by)) + 2);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        const t = px * ux + py * uy;
        if (t < 8 || t > len - 8) continue;
        const dd = abs(px * uy - py * ux);
        let c = cl((1.4 - dd) / 0.7, 0, 1);
        if (c <= 0) continue;
        const gap = cv * sm(0.5, 3.5, 5.5 - abs(t - len / 2));
        c *= 1 - gap;
        const v = c * (0.11 * (1 - 0.8 * cv) + 0.2 * gl);
        const o = (y * W + x) * 3;
        BUF[o] += 255 * v * (0.55 + 0.45 * C1[0] * gl);
        BUF[o + 1] += 255 * v * (0.68 + 0.32 * C1[1] * gl);
        BUF[o + 2] += 255 * v * (0.95);
      }
  }
}

function drawNodes(S, k1, now) {
  for (let i = 0; i < N; i++) {
    const s = S.srv[i], cx = PX[i], cy = PY[i], up = s.up;
    const cand = s.role === 1, lead = s.role === 2;
    const fl = 0.5 + 0.5 * sin(now * TAU * 2.3 + i * 1.7);
    tcol(s.term, k1, 0.42, 1, C1);
    // halo and heartbeat pulses of a leader
    if (lead && s.alive) {
      lump(cx, cy, 6.5, 0.12 * up, C1);
      for (const t0 of s.pl) {
        const age = (now - t0) / 0.9, r0 = 7.5 + 13 * pow(age, 0.75), amp = 0.55 * pow(1 - age, 1.6);
        const R = ceil(r0 + 3);
        for (let y = max(0, floor(cy) - R); y <= min(H - 1, floor(cy) + R); y++)
          for (let x = max(0, floor(cx) - R); x <= min(W - 1, floor(cx) + R); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
            const c = cl((1.8 - abs(d - r0)) / 1.2, 0, 1) * amp;
            if (c > 0) add(x, y, 255 * c * C1[0], 255 * c * C1[1], 255 * c * C1[2]);
          }
      }
    }
    // disc and timer ring
    const fill = lead ? 1 : 1 - s.tm / s.tmFull;
    const dv = lead ? 1 : cand ? 0.35 + 0.65 * fl : 0.55;
    const wh = lead ? 0.12 : cand ? 0.25 * fl : 0;
    const rd = 3.2 + 1.4 * up;
    const R = 10;
    for (let y = max(0, floor(cy) - R); y <= min(H - 1, floor(cy) + R); y++)
      for (let x = max(0, floor(cx) - R); x <= min(W - 1, floor(cx) + R); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
        let r = 0, g = 0, b = 0;
        const cd = cl((rd + 0.7 - d) / 1.2, 0, 1);
        if (cd > 0) {
          const v = (up * (dv + 0.35 * s.rc) + (1 - up) * 0.18) * cd;
          r += 255 * v * (C1[0] * (1 - wh) + wh) * up + 255 * 0.12 * (1 - up) * cd;
          g += 255 * v * (C1[1] * (1 - wh) + wh) * up + 255 * 0.14 * (1 - up) * cd;
          b += 255 * v * (C1[2] * (1 - wh) + wh) * up + 255 * 0.2 * (1 - up) * cd;
        }
        const cr = cl((1.25 - abs(d - 7.4)) / 0.5, 0, 1);
        if (cr > 0 && up > 0.02) {
          let ph = atan2(dx, -dy) / TAU;
          ph -= floor(ph);
          const on = lead ? 1 : sm(fill + 0.01, fill - 0.01, ph);
          const rv = (lead ? 0.85 : cand ? 0.55 + 0.4 * fl : 0.7) * on + 0.22 * (1 - on);
          const w2 = lead ? 0.2 : 0;
          r += 255 * cr * rv * up * (on * (C1[0] * (1 - w2) + w2) + (1 - on) * 0.55);
          g += 255 * cr * rv * up * (on * (C1[1] * (1 - w2) + w2) + (1 - on) * 0.65);
          b += 255 * cr * rv * up * (on * (C1[2] * (1 - w2) + w2) + (1 - on) * 0.9);
        }
        if (r + g + b > 0) add(x, y, r, g, b);
      }
  }
}

function drawComets(S, k1) {
  for (const m of S.msgs) {
    const f = m.a / m.dur;
    if (f > m.die) continue;
    const ax = PX[m.from], ay = PY[m.from], bx = PX[m.to], by = PY[m.to];
    const len = sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const s0 = 4.5, run = len - 2 * s0;
    let amp, sig, tl;
    if (m.t === 0) { C2[0] = 1; C2[1] = 0.92; C2[2] = 0.72; amp = 1; sig = 1.5; tl = 1.6; }
    else if (m.t === 1) { C2[0] = 1; C2[1] = 0.92; C2[2] = 0.72; amp = m.gr ? 0.7 : 0.3; sig = 1.1; tl = 1.2; }
    else {
      tcol(m.term, k1, 0.38, 1, C2);
      if (m.t === 2) { const e = m.ents.length > 0; amp = e ? 1 : 0.75; sig = e ? 1.5 : 1.25; tl = e ? 1.7 : 1.4; }
      else { amp = 0.4; sig = 1.0; tl = 1.2; }
    }
    const fade = sm(0, 0.08, f) * (m.die <= 1 ? 1 - sm(m.die - 0.12, m.die, f) : sm(1.0, 0.9, f));
    for (let q = 0; q < 4; q++) {
      const p = s0 + run * f - q * tl;
      if (p < s0 - 1 || p > len - s0 + 1) continue;
      lump(ax + ux * p, ay + uy * p, sig * (1 - 0.1 * q), amp * fade * pow(0.58, q), C2);
    }
  }
  for (const p of S.puffs) {
    const a = p.a / 0.4;
    if (p.t < 2) { C3[0] = 1; C3[1] = 0.92; C3[2] = 0.72; } else tcol(p.term, k1, 0.38, 1, C3);
    lump(p.x, p.y, 1.2 + 2.2 * a, 0.45 * (1 - a), C3);
  }
}

function drawLogs(S, k1, now) {
  const sc = S.scroll;
  for (let c = 0; c < N; c++) {
    const si = ORD[c], s = S.srv[si], x0 = COLX + c * COLP;
    const dim = 0.3 + 0.7 * s.up;
    const last = lastIdx(S, s);
    // header tab
    const lead = s.role === 2 && s.alive, cand = s.role === 1 && s.alive;
    tcol(s.term, k1, 0.42, 1, C1);
    const tv = (lead ? 1 : cand ? 0.35 + 0.65 * (0.5 + 0.5 * sin(now * TAU * 2.3 + si * 1.7)) : 0.5) * (0.15 + 0.85 * s.up);
    for (let y = 71; y <= 72; y++)
      for (let x = x0; x < x0 + COLW; x++) add(x, y, 255 * tv * C1[0], 255 * tv * C1[1], 255 * tv * C1[2]);
    for (let y = LTOP; y < H; y++) for (let x = x0; x < x0 + COLW; x++) add(x, y, 3, 4, 7);
    for (let i = max(1, floor(sc - 14)); i <= ceil(sc) + 2; i++) {
      const bot = LBOT - (sc - i) * PITCH + 1, top = bot - 3, gh = s.gh.get(i);
      const ga = gh ? max(0, 1 - (now - gh.at) / 1.1) : 0;
      let raw = -1, tv = 0, wh = ga * 0.8, al = 1;
      if (i <= last) {
        raw = entAt(S, s, i);
        tv = (i <= s.commit ? 0.95 : 0.4) * dim;
        if (i > S.G) wh = max(wh, 0.5 * exp(-(now - s.bn[i - S.G - 1]) / 0.35));
      } else if (ga > 0) {
        raw = gh.t; tv = 0.55 * dim; al = ga; wh = ga * 0.7;
      }
      const pay = raw < 0 ? 0 : raw - floor(raw), bw = raw < 0 ? 0 : 4 + floor(pay * 8);
      tv *= 0.45 + 0.55 * frac(pay * 13.7);
      if (raw >= 0) tcol(floor(raw), k1, 0.4, 1, C2);
      for (let y = max(LTOP - 6, floor(top)); y <= min(H - 1, ceil(bot) - 1); y++) {
        const cov = max(0, min(y + 1, bot) - max(y, top)) * sm(LTOP - 1, LTOP + 8, y + 0.5);
        if (cov <= 0) continue;
        for (let x = 0; x < COLW; x++) {
          if (x >= bw) add(x0 + x, y, 7 * cov, 9 * cov, 15 * cov);
          else {
            const v = 255 * tv * cov * al;
            add(x0 + x, y, v * (C2[0] * (1 - wh) + wh), v * (C2[1] * (1 - wh) + wh), v * (C2[2] * (1 - wh) + wh));
          }
        }
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const k1 = S.k[0], now = S.now;
  ground(S);
  drawLinks(S, k1);
  drawNodes(S, k1, now);
  drawComets(S, k1);
  drawLogs(S, k1, now);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
