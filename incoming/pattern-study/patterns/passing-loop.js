// ===== Patternflow pattern =====
// Title:   Passing Loop
// Family:  timetable
// Idea:    A graphic timetable of a single-track railway with six passing loops, distance across and time down, where every train leaves a line that runs down the panel, and the trains that must wait for one another in the loops leave hot red-orange stubs that spread as delays along the line.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The graphic timetable (time-distance diagram) of railways, as E.-J. Marey published it in La Methode graphique (1885) from the Paris to Lyon table drawn by the engineer Ibry; single-track working by token
// Round:   214
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.6..6, Traffic=-1..1, Delay=-0.3..1
//
// Knob 1: Hue. Adds the knob to the hue of the three train colours and the waiting colour together. At 0 the express is amber, the stopping train cyan-white, the freight violet and a train that waits red-orange, on navy.
// Knob 2: Speed. How fast the history scrolls down the panel, k/2 times 6 rows a second: 0.3 times (1.8 rows a second) at 0.6, 1 time (6 rows) at the opening 2 and 3 times (18 rows) at 6. The whole railway runs in panel time, so the slopes of the lines and the lengths of the stubs do not change.
// Knob 3: Traffic. Trains entering at the two ends, 2.4 per screen of 128 rows at -1 (one train every 53 rows at each end, a few lone diagonals), 5.4 at the opening 0 and 12 at 1 (the line holds 13 trains and the panel is woven). At the opening speed a screen is 21 seconds.
// Knob 4: Delay. The chance and length of extra dwell and how ragged the arrivals are. At -0.3 the chance is 0 and the arrivals are 30 percent ragged: every wait is a crossing wait and the lines run parallel. At the opening 0.06 a visit to a station is held 15 percent of the time, for 6 rows on average. At 1 it is held 55 percent of the time for 12 rows, the arrivals are Poisson, and the delays ripple.

// The railway is one line of six stations at columns 5, 16, 28, 39, 51 and 59,
// so five sections of 11, 12, 11, 12 and 8 columns. Between the stations the
// track is single. At each station a loop lets a train stand aside, and the
// diagram is that history: x is the position on the line, and the row is how
// long ago, the newest moment in the top row, so a train that runs leaves a
// slanting line, a train that stands leaves a vertical stub and a train that
// is hotter has waited longer than its timetable said.
//
// Three kinds of train run, at 1.6, 0.8 and 0.4 columns a row. The express
// (amber) stops at the ends and at the fourth station only, the stopping
// train (cyan-white) at every station, the freight (violet) at the ends only.
// Trains enter at both ends by a seeded random process whose rate is the
// Traffic knob. A train may leave a station into a section only under the
// rules a single line works by:
//   1. Token. The section has no train in it that runs the other way.
//   2. Headway. The nearest train ahead in the section is at least 4.2 times
//      the square root of 1 plus its speed squared columns away, so that two
//      lines keep four LEDs between them, measured square across the lines.
//      A train that catches a slower one in a section cannot pass it and is
//      held to its speed.
//   3. Overtaking only in a loop. A train that is ready to go while a faster
//      one of the same way is at its station, or is coming to it within 30
//      rows, stands aside, hot, until the faster one has gone.
//   4. The oldest wins. If a train going the other way has been ready longer
//      (an express counts as 14 rows older, a stopping train as 6), it goes
//      first, so that a platoon of trains cannot keep the token for ever.
// A station has room for any number of trains, so a train in a section can
// always arrive, and every wait is for a train that is moving; the oldest
// ready train is only ever held back by a section that is draining. That is
// why the line cannot lock. The line holds at most 13 trains, and a train
// that would enter beyond that, or into a terminus that is still occupied,
// waits outside, where the panel does not show it.
//
// The pre-run is 440 rows of railway at the knobs the pattern opens with, so
// the first frame already has the line full and the 128 rows of history.
// Delay: with the chance the knob gives, a visit to a station adds an extra
// dwell drawn from an exponential law. The extra is hot like any other wait.
//
// The line of each train is a polyline of (time, x) vertices kept as long as
// it is on the panel. It is drawn as a capsule 2 LEDs wide, with the
// distance from each LED centre to the segment setting its coverage, so a
// shallow line has no gaps and a scrolling one moves smoothly between rows.
// A train's pixels are the highest coverage of its own segments, then the
// trains add and clip. The head of a live train is whitened over its first
// few rows. Trains going up the line (towards column 5) are drawn one column
// to the left of the station and the others one to the right, so that two
// stubs of a crossing stand side by side: 4 LEDs for the platform, which is
// the faint band at each station.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, log, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const NS = 6;
const XS = [5, 16, 28, 39, 51, 59]; // station columns
const SPD = [1.6, 0.8, 0.4]; // columns a row: express, stopping, freight
const BONUS = [14, 6, 0]; // rows older a class counts when two trains want one section
const MIX = [0.28, 0.5, 0.22]; // share of the trains that enter
const GAP = SPD.map((v) => 4.2 * sqrt(1 + v * v)); // columns of headway behind a train of each class
const STEP = 0.2; // rows of panel time in one step of the railway
const ROWS_PER_S = 6; // scroll at Speed 2 (the opening), rows a second
const PRE = 440; // rows of railway run before the first frame
const KEEP = 136; // rows of history that stay on the polylines
const HOLDH = 30; // rows within which a faster train coming makes a slow one stand aside
const NMAX = 13; // trains on the line
const TERM = 7; // rows a train stands at the end where it starts and where it stops
const GRID = 16; // rows between the faint time rules
const HOTMIN = 0.6; // rows a train has to be late for its stub to go hot

// ---- colours (hue, saturation, value) of the three classes and of a wait
const COL = [
  [0.11, 0.88, 1.0], // express: amber
  [0.5, 0.42, 1.0], // stopping train: cyan-white
  [0.79, 0.8, 1.0], // freight: violet
  [0.02, 0.96, 1.0], // waiting: red-orange
];
const BG = [4, 6, 18];
const BAND = [9, 15, 38];
const RULE = [8, 12, 30];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = 255 * rgb[0];
  out[1] = 255 * rgb[1];
  out[2] = 255 * rgb[2];
}

export function setup(params) {
  const S = {
    t: 0, warm: false, hue: 0, mult: 1, d: 0.28, rate: 5.4 / 2 / 128,
    pExtra: 0.15, mExtra: 6,
    trains: [], q: [[], []], prog: [Math.random(), Math.random()], tgt: [1, 1],
    buf: new Float32Array(N * 3), cov: new Float32Array(N), tc: new Float32Array(N * 3), touch: new Int32Array(N), nt: 0,
    col: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], colKey: "",
    sc: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], wk: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    stat: { spawned: 0, finished: 0, maxOn: 0, maxWait: 0 },
  };
  S.tgt = [target(S), target(S)];
  params.s = S;
}

// How the knobs set the railway.
function knobs(S, k) {
  S.hue = k[0];
  S.mult = cl(k[1] / 2, 0.3, 3);
  S.rate = (2.4 * 5 ** ((cl(k[2], -1, 1) + 1) / 2)) / 2 / 128; // trains a row at one end
  S.d = cl((k[3] + 0.3) / 1.3, 0, 1);
  S.pExtra = 0.62 * S.d ** 0.9;
  S.mExtra = 4 + 9 * S.d;
}

// The next arrival at an end comes when the rate, summed over rows, has added
// this much: regular at Delay 0 (0.7 to a bit over 1.3 of the mean gap) and
// Poisson at Delay 1.
function target(S) {
  const j = 0.3 + 0.7 * S.d;
  return 1 - j + j * -log(1 - Math.random());
}

function pick() {
  const u = Math.random();
  return u < MIX[0] ? 0 : u < MIX[0] + MIX[1] ? 1 : 2;
}

// ---- the polyline of a train

function addV(tr, t, x, kind) {
  const n = tr.pt.length;
  if (t <= tr.pt[n - 1] + 1e-9) return;
  if (n >= 2 && tr.pk[n - 1] === kind) {
    const a = (tr.px[n - 1] - tr.px[n - 2]) / (tr.pt[n - 1] - tr.pt[n - 2]);
    const b = (x - tr.px[n - 1]) / (t - tr.pt[n - 1]);
    if (abs(a - b) < 1e-7) {
      tr.pt[n - 1] = t;
      tr.px[n - 1] = x;
      return;
    }
  }
  tr.pt.push(t);
  tr.px.push(x);
  tr.pk.push(kind);
}

// ---- the railway

function dwellAt(cls, s) {
  if (cls === 1) return 8;
  if (cls === 0 && s === 3) return 5;
  return 0;
}

function addExtra(S, tr) {
  tr.extraLeft = Math.random() < S.pExtra ? -log(1 - Math.random()) * S.mExtra : 0;
}

function spawn(S, e) {
  const dir = e === 0 ? 1 : -1, s = e === 0 ? 0 : NS - 1, cls = S.q[e].shift();
  const dw = TERM * (1 + (Math.random() - 0.5) * 0.5 * S.d);
  const tr = {
    cls, dir, mode: 1, st: s, sec: -1, x: XS[s], v: SPD[cls] * (1 + (Math.random() - 0.5) * 0.1 * S.d),
    dwellLeft: dw, extraLeft: 0, waited: 0, term: false, readyAt: 0, key: 0, held: false, end: 0,
    pt: [S.t], px: [XS[s]], pk: [1],
  };
  addExtra(S, tr);
  tr.readyAt = S.t + dw + tr.extraLeft;
  S.trains.push(tr);
  S.stat.spawned++;
}

function arrive(S, tr, s, tc) {
  tr.mode = 1;
  tr.st = s;
  tr.x = XS[s];
  tr.waited = 0;
  addV(tr, tc, tr.x, 0);
  tr.term = (tr.dir > 0 && s === NS - 1) || (tr.dir < 0 && s === 0);
  const dw = (tr.term ? TERM : dwellAt(tr.cls, s)) * (1 + (Math.random() - 0.5) * 0.5 * S.d);
  tr.dwellLeft = dw;
  if (tr.term) tr.extraLeft = 0;
  else addExtra(S, tr);
  tr.readyAt = tc + dw + tr.extraLeft;
}

// A train at a station spends the time from t0 to t1: its dwell, its extra, then waiting.
function stand(tr, t0, t1) {
  let c = t0;
  if (tr.dwellLeft > 0) {
    const u = min(tr.dwellLeft, t1 - c);
    tr.dwellLeft -= u;
    c += u;
    addV(tr, c, tr.x, 1);
  }
  if (c < t1 && tr.extraLeft > 0) {
    const u = min(tr.extraLeft, t1 - c);
    tr.extraLeft -= u;
    c += u;
    addV(tr, c, tr.x, 2);
  }
  if (c < t1) {
    tr.waited += t1 - c;
    addV(tr, t1, tr.x, tr.waited > HOTMIN ? 2 : 1);
  }
}

function move(S, t0, h) {
  const mv = S.trains.filter((tr) => tr.mode === 0);
  mv.sort((a, b) => b.x * b.dir - a.x * a.dir);
  const last = new Array(10).fill(null);
  for (const tr of mv) {
    const d = tr.dir, g = tr.sec * 2 + (d > 0 ? 0 : 1);
    let nx = tr.x + d * tr.v * h;
    const lead = last[g];
    if (lead) {
      const lim = lead.x - d * GAP[lead.cls];
      nx = d > 0 ? min(nx, max(tr.x, lim)) : max(nx, min(tr.x, lim));
    }
    const target = XS[tr.st];
    if ((nx - target) * d >= 0) {
      const tc = t0 + ((target - tr.x) * d) / tr.v;
      arrive(S, tr, tr.st, tc);
      stand(tr, tc, t0 + h);
    } else {
      tr.x = nx;
      addV(tr, t0 + h, nx, 0);
      last[g] = tr;
    }
  }
}

// Is a train at a station kept back by a faster one of its own way?
function held(S, U) {
  const s = U.st, d = U.dir, vu = SPD[U.cls];
  for (const T of S.trains) {
    if (T === U || T.dir !== d || T.mode === 2 || T.st !== s || SPD[T.cls] <= vu) continue;
    if (T.mode === 1) return !T.term;
    if (abs(XS[s] - T.x) / SPD[T.cls] <= HOLDH) return true;
  }
  return false;
}

function dispatch(S, now) {
  const sc = S.sc, wk = S.wk;
  for (let j = 0; j < NS - 1; j++) {
    sc[j][0] = sc[j][1] = 0;
    wk[j][0] = wk[j][1] = Infinity;
  }
  const elig = [];
  for (const tr of S.trains) {
    if (tr.mode === 0) sc[tr.sec][tr.dir > 0 ? 0 : 1]++;
    else if (tr.mode === 1 && tr.dwellLeft <= 1e-9 && tr.extraLeft <= 1e-9) {
      if (tr.term) {
        tr.mode = 2;
        tr.end = now;
        S.stat.finished++;
      } else elig.push(tr);
    }
  }
  for (const U of elig) {
    U.key = U.readyAt - BONUS[U.cls];
    U.held = held(S, U);
    if (!U.held) {
      const j = U.dir > 0 ? U.st : U.st - 1, i = U.dir > 0 ? 0 : 1;
      if (U.key < wk[j][i]) wk[j][i] = U.key;
    }
  }
  elig.sort((a, b) => a.key - b.key);
  for (const U of elig) {
    if (U.held) continue;
    const s = U.st, d = U.dir, j = d > 0 ? s : s - 1, i = d > 0 ? 0 : 1;
    if (sc[j][1 - i] > 0 || wk[j][1 - i] < U.key) continue;
    let ok = true;
    for (const tr of S.trains) {
      if (tr.mode === 0 && tr.sec === j && tr.dir === d && (tr.x - XS[s]) * d < GAP[tr.cls]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    U.mode = 0;
    U.sec = j;
    U.st = s + d;
    sc[j][i]++;
  }
}

function step(S, h) {
  const t0 = S.t, t1 = t0 + h, st = S.stat;
  for (let e = 0; e < 2; e++) {
    S.prog[e] += h * S.rate;
    if (S.prog[e] >= S.tgt[e]) {
      S.prog[e] -= S.tgt[e];
      S.tgt[e] = target(S);
      if (S.q[e].length < 3) S.q[e].push(pick());
    }
  }
  move(S, t0, h);
  S.t = t1;
  dispatch(S, t1);
  let on = 0;
  for (const tr of S.trains) if (tr.mode !== 2) on++;
  for (let e = 0; e < 2; e++) {
    if (!S.q[e].length || on >= NMAX) continue;
    const dir = e === 0 ? 1 : -1;
    let busy = false;
    for (const tr of S.trains) if (tr.mode === 1 && tr.dir === dir && tr.st === (e === 0 ? 0 : NS - 1)) busy = true;
    if (!busy) {
      spawn(S, e);
      on++;
    }
  }
  if (on > st.maxOn) st.maxOn = on;
  // The panel keeps 128 rows; drop what is older, and the vertices behind them.
  const old = t1 - KEEP;
  let w = 0;
  for (const tr of S.trains) {
    if (tr.mode === 2 && tr.end < old) continue;
    while (tr.pt.length > 2 && tr.pt[1] < old) {
      tr.pt.shift();
      tr.px.shift();
      tr.pk.shift();
    }
    if (tr.mode === 1 && tr.waited > st.maxWait) st.maxWait = tr.waited;
    S.trains[w++] = tr;
  }
  S.trains.length = w;
}

function advance(S, rows) {
  while (rows > 1e-9) {
    const h = min(STEP, rows);
    step(S, h);
    rows -= h;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  knobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.warm) {
    S.warm = true;
    advance(S, PRE);
  }
  advance(S, cl(dt || 0, 0, 0.1) * ROWS_PER_S * S.mult);
}

// ---- drawing

// One segment as a capsule 2 LEDs wide. Y0 is the older end and so the lower one on the panel.
function stroke(S, X0, Y0, X1, Y1, c, live) {
  const dX = X1 - X0, dY = Y1 - Y0, len2 = dX * dX + dY * dY;
  const r0 = max(0, floor(min(Y0, Y1) - 1.5)), r1 = min(H - 1, ceil(max(Y0, Y1) + 1.5));
  const { cov, tc, touch } = S;
  for (let r = r0; r <= r1; r++) {
    const yc = r + 0.5;
    let sa = 0, sb = 1;
    if (dY !== 0) {
      const s1 = (yc - 1.5 - Y0) / dY, s2 = (yc + 1.5 - Y0) / dY;
      sa = max(0, min(s1, s2));
      sb = min(1, max(s1, s2));
      if (sa > sb) continue;
    }
    const xa = X0 + dX * sa, xb = X0 + dX * sb;
    const c0 = max(0, floor(min(xa, xb) - 1.5)), c1 = min(W - 1, ceil(max(xa, xb) + 1.5));
    const f = 1 - (0.42 * yc) / H, hw = live ? 0.62 * exp(-yc / 2.6) : 0;
    for (let x = c0; x <= c1; x++) {
      const px = x + 0.5;
      let u = len2 > 0 ? ((px - X0) * dX + (yc - Y0) * dY) / len2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = px - (X0 + u * dX), ey = yc - (Y0 + u * dY);
      let a = (1.45 - sqrt(ex * ex + ey * ey)) / 0.9;
      if (a <= 0.12) continue;
      if (a > 1) a = 1;
      const p = r * W + x;
      if (a > cov[p]) {
        if (cov[p] === 0) touch[S.nt++] = p;
        cov[p] = a;
        const m = a * f;
        tc[p * 3] = (c[0] + (255 - c[0]) * hw) * m;
        tc[p * 3 + 1] = (c[1] + (255 - c[1]) * hw) * m;
        tc[p * 3 + 2] = (c[2] + (255 - c[2]) * hw) * m;
      }
    }
  }
}

function lay(S) {
  const key = S.hue.toFixed(3);
  if (key === S.colKey) return;
  S.colKey = key;
  for (let i = 0; i < 4; i++) hsv(COL[i][0] + S.hue, COL[i][1], COL[i][2], S.col[i]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  lay(S);
  const { buf, cov, tc, touch } = S, Tn = S.t;
  // The night, the platforms and the time rules. Each rule is a line of one row
  // that slides between two rows as it scrolls.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      buf[p] = BG[0];
      buf[p + 1] = BG[1];
      buf[p + 2] = BG[2];
    }
  for (let s = 0; s < NS; s++)
    for (let x = XS[s] - 2; x < XS[s] + 2; x++)
      for (let y = 0; y < H; y++) {
        const p = (y * W + x) * 3;
        buf[p] = BAND[0];
        buf[p + 1] = BAND[1];
        buf[p + 2] = BAND[2];
      }
  for (let g = ceil((Tn - H - 2) / GRID); g * GRID <= Tn + 1; g++) {
    const Y = Tn - g * GRID + 0.5;
    for (let r = max(0, floor(Y - 1.5)); r <= min(H - 1, ceil(Y + 0.5)); r++) {
      const w = 1 - abs(r + 0.5 - Y);
      if (w <= 0) continue;
      for (let x = 0; x < W; x++) {
        const p = (r * W + x) * 3;
        buf[p] += (RULE[0] - BG[0]) * w * 0.5;
        buf[p + 1] += (RULE[1] - BG[1]) * w * 0.5;
        buf[p + 2] += (RULE[2] - BG[2]) * w * 0.5;
      }
    }
  }
  // The trains, oldest first, each as its own best coverage, then added.
  for (const tr of S.trains) {
    const n = tr.pt.length, live = tr.mode !== 2, off = tr.dir;
    S.nt = 0;
    for (let i = 1; i < n; i++) {
      const Y0 = Tn - tr.pt[i - 1] + 0.5, Y1 = Tn - tr.pt[i] + 0.5;
      if (Y1 > H + 2 || Y0 < -2) continue;
      stroke(S, tr.px[i - 1] + off, Y0, tr.px[i] + off, Y1, S.col[tr.pk[i] === 2 ? 3 : tr.cls], live);
    }
    for (let i = 0; i < S.nt; i++) {
      const p = touch[i];
      buf[p * 3] += tc[p * 3];
      buf[p * 3 + 1] += tc[p * 3 + 1];
      buf[p * 3 + 2] += tc[p * 3 + 2];
      cov[p] = 0;
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, round(min(255, buf[p])), round(min(255, buf[p + 1])), round(min(255, buf[p + 2])));
}
