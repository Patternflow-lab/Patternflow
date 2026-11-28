// ===== Patternflow pattern =====
// Title:   Raft Terms
// Family:  raftconsensus
// Idea:    Five servers run the Raft consensus protocol: randomised election timeouts, votes that pass or split, a leader whose heartbeats and log entries ripple outwards over lossy links, and a crash that sends them back to vote under a new term, each term its own colour.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Raft leader election and log replication (Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm", 2014, from memory), the vote rule, the prevLogIndex check, truncation of a conflicting suffix and the commit rule as that paper gives them, original code, pattern round 276
// Round:   276
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Timeout=1.2..4, Loss=-1..1, Crashes=-1..1
//
// Knob 1: Hue. The hue of term t is 0.58 + 0.137 t + K1 turns, so at 0 the terms run blue, violet, magenta, red, orange, and K1 turns the whole run once round over the range. Lightness follows a triangle wave on 0.235 a term, 0.65 to 1.
// Knob 2: Timeout. The base election timeout T in seconds, 1.2 to 4, opening at 2. Every election timer is drawn from [T, 2T] and the leader beats every 0.3 T, clamped to 0.4 to 1 s. In 600 s runs with the other knobs at the opening, T = 1.2 gave 129 terms and 12 percent of the time without a leader, T = 4 gave 70 terms and 26 percent.
// Knob 3: Loss. With s = (K3 + 1) / 2 a message takes (0.1 + 0.5 s^2.5) x 0.6 to 1.4 seconds and is dropped with chance 0.38 s^2: 0.1 s and 0 at -1, 0.19 s and 9.5 percent at the opening, 0.6 s and 38 percent at 1. In 600 s: 76 terms and 10 percent leaderless at -1, 214 and 65 percent at 1, where votes split, leaders flap and the logs fall behind.
// Knob 4: Crashes. The mean wait between crashes is 30 x 2^(-2.2 K4) seconds plus 1.5: 138 at -1, 27 at the opening, 6.5 at 1. A crash takes down the leader (a follower three times in ten) for 3.5 to 9 s, never more than two at once. In 600 s: 95 terms and 11 percent leaderless at -1 (the partitions alone), 141 and 38 percent at 1.
//
// What the picture is. Five servers of a Raft cluster, simulated for real in steps of 1/60 s. Each has a term, a vote, a role, an election timer that a valid AppendEntries or a granted vote resets, a log of entries tagged with their term, and a commit index. Exact: RequestVote with the up-to-date check and a majority of three, AppendEntries with the prevLogIndex and prevLogTerm check, truncation of a conflicting suffix, four entries a message, nextIndex backing up on the follower's hint, a no-op from every new leader, commit once a majority holds an entry of the leader's own term, step down on any higher term. Added: links with delay and loss, crashes (log and commit index survive, and the prefix every server holds as committed is dropped from the arrays), and a partition every 10 to 15 s that cuts one server off (three times in five the leader), splits two from three or cuts one link, for 3.5 to 10 s.
// The network. Servers on a pentagon of radius 22 round (32, 42), a disc 9 LEDs, its ring 2. The ring is the election timer, an arc from the top that fills as the timeout nears (a heartbeat resets it, so a quiet cluster only ticks). A candidate flashes at 2.3 Hz, the leader has a steady full ring, a halo and a ring that leaves it at every heartbeat, a crashed server is a dark disc. The ten links are faint 2 LED lines that open in the middle when cut. Comets run along them: RequestVote warm white, AppendEntries in the leader's term colour (bigger with entries), replies fainter, a dropped message fades out partway.
// The logs. Five columns in the order the servers stand across the panel, one bar 3 LEDs tall per entry, rows lined up by log index, scrolling up with the median log length. Committed entries are bright, the rest 0.45, an overwritten entry flashes white for 1.1 s, a tab above each column shows its role. A bar's width and shade are the entry's payload, drawn when the leader takes the request. Not Raft, but it makes one entry look the same in every column and keeps a long quiet term from standing still.
// The ribbon. The top 6 rows are the terms through time, 2 s to the LED, newest at the right: the leader's term in its colour while there is a leader, the highest term dimmed while there is none.

const W = 64, H = 128, N = 5, NL = 10;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = (a, b) => a + (b - a) * Math.random();
const expo = (m) => -log(1 - Math.random()) * m;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  for (let c = 0; c < 3; c++) {
    const k = (5 - 2 * c + h) % 6;
    o[c] = v * (1 - s * max(0, min(k, 4 - k, 1)));
  }
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

const HUE0 = 0.58, HSTEP = 0.137;
const frac = (v) => v - floor(v);
// the colour of a term: hue steps 0.137 a term, lightness runs a triangle wave on 0.235 a term
function tcol(t, k1, s, v, o) {
  hsv(t * HSTEP + k1 + HUE0, s, v * (0.65 + 0.35 * abs(2 * frac(t * 0.235 + 0.3) - 1)), o);
}

// ---------------------------------------------------------------- raft
const newSrv = () => ({
  alive: true, role: 0, term: 0, voted: -1, tm: 0, tmFull: 1, lg: [], bn: [], commit: 0,
  nx: [1, 1, 1, 1, 1], mt: [0, 0, 0, 0, 0], hb: 0, vmask: 0, down: 0, gh: new Map(), pl: [], rc: 0, up: 1,
});

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
    let hint = last + 1;
    if (m.pi <= last) {
      const ct = termAt(S, s, m.pi);
      for (hint = m.pi; hint - 1 > S.G && termAt(S, s, hint - 1) === ct; ) hint--;
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

const leaders = (S) => [0, 1, 2, 3, 4].filter((i) => S.srv[i].alive && S.srv[i].role === 2);

function startPartition(S) {
  S.pLeft = rnd(3.5, 10);
  const ld = leaders(S), r = Math.random(), cut = (a, b) => (S.cutOn[LID[a][b]] = 1);
  const pick = () => floor(Math.random() * N);
  if (r < 0.5) {
    // one server cut off, in three cases of five the leader
    const v = r < 0.3 && ld.length ? ld[0] : pick();
    for (let j = 0; j < N; j++) if (j !== v) cut(v, j);
  } else if (r < 0.72) {
    // two against three
    const a = pick(), b = (a + 1 + floor(Math.random() * (N - 1))) % N;
    for (let x = 0; x < N; x++)
      for (let y = x + 1; y < N; y++) if ((x === a || x === b) !== (y === a || y === b)) cut(x, y);
  } else if (ld.length && Math.random() < 0.6) cut(ld[0], (ld[0] + 1 + floor(Math.random() * (N - 1))) % N);
  else S.cutOn[floor(Math.random() * NL)] = 1;
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
    for (const s of S.srv) if (!s.alive) downs++;
    S.cNext = 0.8;
    if (downs < 2 && (ld.length || Math.random() < 0.5)) {
      let v = ld[0];
      for (const j of ld) if (S.srv[j].term > S.srv[v].term) v = j;
      if (v === undefined || Math.random() < 0.3) {
        // now and then a follower goes down, and has to catch up when it returns
        const f = [];
        for (let j = 0; j < N; j++) if (S.srv[j].alive && S.srv[j].role !== 2) f.push(j);
        if (f.length) v = f[floor(Math.random() * f.length)];
      }
      if (v !== undefined) {
        const s = S.srv[v];
        s.alive = false; s.role = 0; s.vmask = 0; s.down = rnd(3.5, 9);
        S.cNext = expo(P.crash) + 1.5;
      }
    }
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
    if (f >= m.die || f >= 1) {
      S.msgs.splice(q, 1);
      if (f < m.die) deliver(S, P, m);
    }
  }
  // the ribbon of terms: the leader's term while there is a leader, minus the top term while there is none
  let lt = 0, tm = 0;
  for (const s of S.srv) if (s.alive) { tm = max(tm, s.term); if (s.role === 2) lt = max(lt, s.term); }
  if (S.rib[S.rib.length - 1].v !== (lt || -tm)) S.rib.push({ t: S.now, v: lt || -tm });
  while (S.rib.length > 2 && S.rib[1].t < S.now - 130) S.rib.shift();
  // the log's agreed prefix is dropped once every server holds it as committed
  let mc = 1e9;
  for (let i = 0; i < N; i++) mc = min(mc, S.srv[i].commit);
  while (S.G < mc) {
    const t = S.srv[0].lg[0];
    for (let i = 0; i < N; i++) { S.srv[i].lg.shift(); S.srv[i].bn.shift(); }
    S.hist.push(t);
    if (S.hist.length > 48) S.hist.shift();
    S.G++;
  }
}

// ---------------------------------------------------------------- state
export function setup(params) {
  const srv = [];
  for (let i = 0; i < N; i++) srv.push(newSrv());
  params.s = {
    now: 0, k: null, ready: false, srv, msgs: [], G: 0, hist: [],
    cutOn: new Uint8Array(NL), cv: new Float32Array(NL),
    lgl: new Float32Array(NL),
    pLeft: 0, pNext: rnd(8, 18), cNext: rnd(10, 22), eNext: 1,
    scroll: 0, amb: [0, 0, 0], rib: [{ t: 0, v: 0 }],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const al = S.k ? 1 - exp(-d / 0.2) : 1;
  if (!S.k) S.k = [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  const P = par(S.k);
  if (!S.ready) {
    S.ready = true;
    for (let i = 0; i < N; i++) resetTimer(S, S.srv[i], P);
    let tt = 0;
    while (tt < 70 || (tt < 140 && !leaders(S).length)) { step(S, P, 1 / 30); tt += 1 / 30; }
    S.msgs.length = 0;
    S.scroll = medianLast(S) + 0.5;
    S.cv.set(S.cutOn);
  }
  const n = max(1, ceil(d / (1 / 60)));
  for (let q = 0; q < n; q++) step(S, P, d / n);
  // eased things for the picture
  const now = S.now, a3 = 1 - exp(-d / 0.3);
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
  S.scroll += (medianLast(S) + 0.5 - S.scroll) * (1 - exp(-d / 0.25));
  // ground glow follows the newest term
  const v = S.rib[S.rib.length - 1].v;
  tcol(abs(v), S.k[0], 0.5, 1, AMB);
  const amp = v > 0 ? 0.17 : 0.16;
  for (let c = 0; c < 3; c++) S.amb[c] += (AMB[c] * amp - S.amb[c]) * a3;
}

const medianLast = (S) => S.srv.map((s) => lastIdx(S, s)).sort((x, y) => x - y)[2];

// ---------------------------------------------------------------- draw
const AMB = [0, 0, 0];
const BUF = new Float32Array(W * H * 3);
const C1 = [0, 0, 0], C2 = [0, 0, 0];

function lump(cx, cy, sig, amp, c) {
  const R = floor(sig * 3) + 1, is2 = 1 / (2 * sig * sig);
  for (let y = max(0, floor(cy) - R); y <= min(H - 1, floor(cy) + R); y++)
    for (let x = max(0, floor(cx) - R); x <= min(W - 1, floor(cx) + R); x++) {
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
      BUF[o] = 15 + 255 * S.amb[0] * g;
      BUF[o + 1] = 19 + 255 * S.amb[1] * g;
      BUF[o + 2] = 31 + 255 * S.amb[2] * g;
    }
}

function drawLinks(S) {
  for (let l = 0; l < NL; l++) {
    const ax = PX[LA[l]], ay = PY[LA[l]], dx = PX[LB[l]] - ax, dy = PY[LB[l]] - ay, len = sqrt(dx * dx + dy * dy);
    const ux = dx / len, uy = dy / len, cv = S.cv[l], gl = S.lgl[l];
    for (let y = max(0, floor(min(ay, ay + dy)) - 2); y <= min(H - 1, ceil(max(ay, ay + dy)) + 2); y++)
      for (let x = max(0, floor(min(ax, ax + dx)) - 2); x <= min(W - 1, ceil(max(ax, ax + dx)) + 2); x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay, t = px * ux + py * uy;
        if (t < 8 || t > len - 8) continue;
              const c = cl((1.4 - abs(px * uy - py * ux)) / 0.7, 0, 1) * (1 - cv * sm(0.5, 3.5, 5.5 - abs(t - len / 2)));
        const v = 255 * c * (0.11 * (1 - 0.8 * cv) + 0.2 * gl), o = (y * W + x) * 3;
        BUF[o] += v * (0.55 + 0.4 * gl);
        BUF[o + 1] += v * (0.68 + 0.3 * gl);
        BUF[o + 2] += v;
      }
  }
}

const DEAD = [30, 36, 51], TRK = [0.55, 0.65, 0.9];
function drawNodes(S, k1, now) {
  for (let i = 0; i < N; i++) {
    const s = S.srv[i], cx = PX[i], cy = PY[i], up = s.up, lead = s.role === 2, cand = s.role === 1;
    const fl = 0.5 + 0.5 * sin(now * TAU * 2.3 + i * 1.7), fill = lead ? 1 : 1 - s.tm / s.tmFull;
    tcol(s.term, k1, 0.42, 1, C1);
    if (lead && s.alive) {
      // the halo, and a ring that leaves it with every heartbeat
      lump(cx, cy, 6.5, 0.12 * up, C1);
      for (const t0 of s.pl) {
        const age = (now - t0) / 0.9, r0 = 7.5 + 13 * pow(age, 0.75), amp = 0.55 * pow(1 - age, 1.6), R = ceil(r0 + 3);
        for (let y = max(0, floor(cy) - R); y <= min(H - 1, floor(cy) + R); y++)
          for (let x = max(0, floor(cx) - R); x <= min(W - 1, floor(cx) + R); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, c = cl((1.8 - abs(sqrt(dx * dx + dy * dy) - r0)) / 1.2, 0, 1) * amp * 255;
            if (c > 0) add(x, y, c * C1[0], c * C1[1], c * C1[2]);
          }
      }
    }
    // the disc, and the ring that is the election timer
    const wh = lead ? 0.12 : cand ? 0.25 * fl : 0, rd = 3.2 + 1.4 * up;
    const dv = up * ((lead ? 1 : cand ? 0.35 + 0.65 * fl : 0.62) + 0.35 * s.rc);
    const rv = up * (lead ? 0.85 : cand ? 0.55 + 0.4 * fl : 0.7);
    for (let y = max(0, floor(cy) - 10); y <= min(H - 1, floor(cy) + 10); y++)
      for (let x = max(0, floor(cx) - 10); x <= min(W - 1, floor(cx) + 10); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
        const cd = cl((rd + 0.7 - d) / 1.2, 0, 1), cr = up > 0.02 ? cl((1.25 - abs(d - 7.4)) / 0.5, 0, 1) : 0;
        if (cd <= 0 && cr <= 0) continue;
        let on = 0;
        if (cr > 0) {
          const ph = atan2(dx, -dy) / TAU;
          on = lead ? 1 : sm(fill + 0.01, fill - 0.01, ph - floor(ph));
        }
        const ra = cr * 255 * (rv * on + 0.22 * up * (1 - on));
        const o = (y * W + x) * 3;
        for (let c = 0; c < 3; c++)
          BUF[o + c] += cd * 255 * (dv * (C1[c] * (1 - wh) + wh) + (1 - up) * DEAD[c] / 255) + ra * (on * C1[c] + (1 - on) * TRK[c]);
      }
  }
}

const CP = [[1, 1.5, 1.6], [0.7, 1.1, 1.2], [1, 1.5, 1.7], [0.4, 1, 1.2]]; // amplitude, width and tail of a comet by kind
function drawComets(S, k1) {
  for (const m of S.msgs) {
    const f = m.a / m.dur;
    if (f > m.die) continue;
    const ax = PX[m.from], ay = PY[m.from], dx = PX[m.to] - ax, dy = PY[m.to] - ay, len = sqrt(dx * dx + dy * dy);
    const s0 = 4.5, run = len - 2 * s0;
    let [amp, sig, tl] = CP[m.t];
    if (m.t === 1 && !m.gr) amp = 0.3;
    if (m.t === 2 && !m.ents.length) [amp, sig, tl] = [0.75, 1.25, 1.4];
    if (m.t < 2) [C2[0], C2[1], C2[2]] = [1, 0.92, 0.72];
    else tcol(m.term, k1, 0.38, 1, C2);
    const fade = sm(0, 0.08, f) * (m.die <= 1 ? 1 - sm(m.die - 0.12, m.die, f) : sm(1.0, 0.9, f));
    for (let q = 0; q < 4; q++) {
      const p = s0 + run * f - q * tl;
      if (p > s0 - 1 && p < len - s0 + 1) lump(ax + (dx * p) / len, ay + (dy * p) / len, sig * (1 - 0.1 * q), amp * fade * pow(0.58, q), C2);
    }
  }
}

function drawRibbon(S, k1, now) {
  for (let x = 0; x < W; x++) {
    const t1 = now - (W - 1 - x) * 2, t0 = t1 - 2;
    let r = 0, g = 0, b = 0;
    for (let q = 0; q < S.rib.length; q++) {
      const a = max(t0, S.rib[q].t), e = min(t1, q + 1 < S.rib.length ? S.rib[q + 1].t : 1e9);
      if (e <= a) continue;
      const v = S.rib[q].v, w = v ? (e - a) / 2 : 0;
      tcol(abs(v), k1, 0.42, v > 0 ? 0.75 : 0.34, C2);
      r += C2[0] * w; g += C2[1] * w; b += C2[2] * w;
    }
    for (let y = 0; y < 8; y++) add(x, y, 255 * r, 255 * g, 255 * b);
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
    tcol(s.term, k1, 0.42, 255 * (lead ? 1 : cand ? 0.35 + 0.65 * (0.5 + 0.5 * sin(now * TAU * 2.3 + si * 1.7)) : 0.5) * (0.15 + 0.85 * s.up), C1);
    for (let y = 71; y <= 72; y++) for (let x = x0; x < x0 + COLW; x++) add(x, y, C1[0], C1[1], C1[2]);
    for (let y = LTOP; y < H; y++) for (let x = x0; x < x0 + COLW; x++) add(x, y, 3, 4, 7);
    for (let i = max(1, floor(sc - 14)); i <= ceil(sc) + 2; i++) {
      const bot = LBOT - (sc - i) * PITCH + 1, top = bot - 3, gh = s.gh.get(i);
      const ga = gh ? max(0, 1 - (now - gh.at) / 1.1) : 0;
      let raw = -1, tv = 0, wh = ga * 0.8, al = 1;
      if (i <= last) {
        raw = entAt(S, s, i);
        tv = (i <= s.commit ? 0.95 : 0.45) * dim;
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
  drawLinks(S);
  drawNodes(S, k1, now);
  drawComets(S, k1);
  drawRibbon(S, k1, now);
  drawLogs(S, k1, now);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
