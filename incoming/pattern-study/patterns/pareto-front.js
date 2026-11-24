// ===== Patternflow pattern =====
// Title:   Pareto Front
// Family:  pareto
// Idea:    A real NSGA-II population of about 120 candidates is drawn in objective space as soft blobs coloured by non-domination rank, with the dominated region shaded by slow drifting clouds of light behind a bright staircase that advances as the points push it toward the good corner, while the two-objective problem keeps morphing from a convex to a concave to a broken front and moving its optimum so the population never stops chasing.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: NSGA-II (Kalyanmoy Deb, Amrit Pratap, Sameer Agarwal and T. Meyarivan, 2002: fast non-dominated sorting, crowding distance, binary tournament, simulated binary crossover and polynomial mutation) on a ZDT-like two-objective problem (Eckart Zitzler, Kalyanmoy Deb and Lothar Thiele, 2000) whose front shape and optimum are made to move, after the dynamic FDA test problems (Marco Farina, Kalyanmoy Deb and Paolo Amato, 2004, from memory); Pareto efficiency is Vilfredo Pareto, 1906; pattern round 231
// Round:   231
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..8, Front=-1..1, Mutation=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel; at 0 the front is white-gold and the later ranks run through rose and violet to blue.
// Knob 2: Pace. Generations a second, 1 to 8 and opening at 2: slow, the cloud lags the moving optimum and hangs far behind the staircase, fast it clings to it.
// Knob 3: Front. Which front the problem asks for: at -1 a convex curve bowed toward the good corner, at 1 a concave one with broken pieces, and at 0 it sits between and the waves that move the problem swing it either way.
// Knob 4: Mutation. How hard offspring are thrown from their parents, from copies at -1 to wild at 1: low and the cloud is a tight column under the front, high and it fans out into many ranks.

const W = 64;
const H = 128;
const N = W * H;
const { exp, sin, cos, pow, sqrt, min, max, tanh, ceil, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the problem: f1 = x0 and f2 = 1 - f1^p + d (1 - cos(2 pi k f1)) (1 - f1) + sum A (x_i - c_i)^2 over the other variables.
// The bumps on the curve break the true front into pieces, as the sine does in ZDT3; they die out toward f1 = 1 so the front always ends in the corner.
const NV = 10; // decision variables: x0 is f1, the other nine are pulled toward an optimum c that moves
const A_G = 8; // how steeply f2 grows away from that optimum
const JUMP0 = 10; // generations between jumps of the optimum: at least this many
const JUMP1 = 12; // and up to this many more
const JUMP_AMP = 0.2; // how far a variable's optimum is thrown by one jump
const DRIFT = 0.07; // how far the optimum sways in between
const MORPH = 2.5; // how much faster the front's shape moves than its base waves, 1 being a minute and a half to cross
const PACE = 0.6; // generations a second for each unit of the Pace knob
const NP = 60; // parents kept; the offspring beside them make 120 blobs
const ETA_C = 15; // simulated binary crossover index
const P_C = 0.9; // chance a pair is crossed
const P_X0 = 0.45; // chance a child's f1 is mutated at all, higher than the rest or the cloud loses its spread along the front

// ---- the plot: f1 across, f2 down, the good corner at the top left
const XM = 5;
const YM = 5;
const F2_ROOM = 1.8; // f2 = 1 sits at 1/1.8 of the height; below it is room for the cloud that lags

// ---- the drawing
const R1 = 2.5; // radius of a rank-1 blob, LED
const R2 = 2.3; // of the others

export function setup(params) {
  const S = {
    t: 0,
    tw: 0, // problem time at the first frame: the clouds in the field count from there
    tc: 0, // the optimum's own clock: it sways faster when the generations come faster, though not in step with them
    credit: 0,
    phase: 0,
    pop: [], // every sprite: st 1 a parent kept, st 2 an offspring on trial, st 0 culled and fading out
    cnt: new Int32Array(256),
    dl: new Int32Array(256 * 256),
    ph: [],
    pr: { p: 1, d: 0, k: 3, c: new Float64Array(NV) },
    cE: new Float64Array(NV).fill(0.5), // where the optimum is settling
    cT: new Float64Array(NV).fill(0.5), // where the last jump sent it
    gen: 0,
    sj: 0,
    nextJump: 30,
    k: [0, 2, 0, 0.06],
    ymin: new Float32Array(W),
    xmin: new Float32Array(H),
    ln: new Float32Array(N),
    gd: new Float32Array(N),
    sv: new Float32Array(N), // the dominated field as drawn: it follows the sort a little late so a cull does not make it pop
    dt: 1 / 30,
    seen: false,
    buf: new Float32Array(N * 3),
    warm: false,
  };
  for (let i = 0; i < 24; i++) S.ph.push(Math.random() * 6.2832);
  params.s = S;
}

// The problem at problem-time t. The front runs from convex through straight to concave, its broken pieces open and close, and every
// one of these is a sum of sines whose rates share no factor, so the problem never returns to one it has had. The Front knob leans on all of them.
function problemAt(S, t, kFront) {
  const pr = S.pr, ph = S.ph;
  const m = MORPH * t;
  const z = 0.75 * kFront + 0.85 * (0.55 * sin(0.0415 * m + ph[0]) + 0.45 * sin(0.0673 * m + ph[1]));
  pr.p = 0.38 * exp(0.9 * (z + 1));
  const w = 0.5 + 0.4 * sin(0.0571 * m + ph[2]) + 0.14 * sin(0.0293 * m + ph[3]);
  pr.d = 0.3 * sm(0.45, 0.95, w + 0.35 * max(0, kFront));
  pr.k = 3.2 + 0.7 * sin(0.0317 * m + ph[4]);
  for (let i = 1; i < NV; i++) {
    const a = 0.131 + 0.0413 * i, b = 0.223 + 0.0287 * i;
    pr.c[i] = S.cE[i] + DRIFT * (0.6 * sin(a * S.tc + ph[4 + i]) + 0.4 * sin(b * S.tc + ph[9 + i]));
  }
}

const frontAt = (f1, pr) => 1 - pow(f1, pr.p) + pr.d * (1 - cos(2 * PI * pr.k * f1)) * (1 - f1);

function evaluate(s, pr) {
  const x = s.x;
  let q = 0;
  for (let i = 1; i < NV; i++) {
    const e = x[i] - pr.c[i];
    q += A_G * e * e;
  }
  s.f1 = x[0];
  s.f2 = frontAt(x[0], pr) + q;
  s.q = q;
}

// where an objective pair sits on the panel; what lags far behind the front is squeezed against the bottom edge, not cut off
const toX = (f1) => XM + f1 * (W - 2 * XM);
const toY = (f2) => {
  const y = YM + (f2 / F2_ROOM) * (H - 2 * YM);
  return y > 96 ? 96 + 27 * tanh((y - 96) / 27) : y;
};

// ---- NSGA-II
const dominates = (a, b) => a.f1 <= b.f1 && a.f2 <= b.f2 && (a.f1 < b.f1 || a.f2 < b.f2);

// Fast non-dominated sorting: every member gets its rank, and the fronts come back as lists.
function sortFronts(S, A) {
  const n = A.length, cnt = S.cnt, dl = S.dl;
  const dn = new Int32Array(n);
  for (let i = 0; i < n; i++) cnt[i] = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (dominates(A[i], A[j])) {
        dl[i * n + dn[i]++] = j;
        cnt[j]++;
      } else if (dominates(A[j], A[i])) {
        dl[j * n + dn[j]++] = i;
        cnt[i]++;
      }
    }
  const fronts = [];
  let cur = [];
  for (let i = 0; i < n; i++)
    if (cnt[i] === 0) {
      A[i].rank = 1;
      cur.push(i);
    }
  for (let r = 1; cur.length; r++) {
    fronts.push(cur.map((i) => A[i]));
    const nx = [];
    for (const i of cur)
      for (let m = 0; m < dn[i]; m++) {
        const j = dl[i * n + m];
        if (--cnt[j] === 0) {
          A[j].rank = r + 1;
          nx.push(j);
        }
      }
    cur = nx;
  }
  return fronts;
}

// Crowding distance within one front: how much room a member has round it, the two ends counting as endless.
function crowding(F) {
  const n = F.length;
  for (const s of F) s.cr = 0;
  if (n < 3) {
    for (const s of F) s.cr = 1e9;
    return;
  }
  for (const key of ["f1", "f2"]) {
    F.sort((a, b) => a[key] - b[key]);
    const span = F[n - 1][key] - F[0][key];
    F[0].cr = F[n - 1].cr = 1e9;
    if (span < 1e-9) continue;
    for (let i = 1; i < n - 1; i++) F[i].cr += (F[i + 1][key] - F[i - 1][key]) / span;
  }
}

const better = (a, b) => (a.rank !== b.rank ? a.rank < b.rank : a.cr > b.cr);

// Binary tournament: two at random, the lower rank wins, and the roomier one if the ranks tie.
function tournament(P) {
  const a = P[(Math.random() * P.length) | 0], b = P[(Math.random() * P.length) | 0];
  return better(a, b) ? a : b;
}

const newSprite = (x) => ({ x, f1: 0, f2: 0, q: 0, rank: 1, cr: 0, st: 2, px: 0, py: 0, al: 0, rk: 1, rkT: 1 });

// The Mutation knob: the chance a variable is moved at all, and the distribution index that says how far.
function mutParams(k4) {
  const m = exp(0.7 * cl(k4, -1, 1));
  return { pm: min(0.9, (1.7 / NV) * m), eta: cl(18 / m, 5, 40) };
}

// Make NP offspring: binary tournament, simulated binary crossover, polynomial mutation. Each starts where its first parent is drawn.
function spawn(S) {
  const P = S.pop.filter((s) => s.st === 1);
  for (const F of sortFronts(S, P)) crowding(F);
  const mp = mutParams(S.k[3]);
  const out = [];
  while (out.length < NP) {
    const a = tournament(P), b = tournament(P);
    const c1 = a.x.slice(), c2 = b.x.slice();
    if (Math.random() < P_C) {
      for (let i = 0; i < NV; i++) {
        if (Math.random() > 0.5) continue;
        const u = Math.random();
        const beta = u <= 0.5 ? pow(2 * u, 1 / (ETA_C + 1)) : pow(1 / (2 * (1 - u)), 1 / (ETA_C + 1));
        const x1 = a.x[i], x2 = b.x[i];
        c1[i] = cl(0.5 * ((1 + beta) * x1 + (1 - beta) * x2), 0, 1);
        c2[i] = cl(0.5 * ((1 - beta) * x1 + (1 + beta) * x2), 0, 1);
      }
    }
    for (const [c, par] of [[c1, a], [c2, b]]) {
      if (out.length >= NP) break;
      for (let i = 0; i < NV; i++) {
        if (Math.random() >= (i === 0 ? max(mp.pm, P_X0) : mp.pm)) continue;
        const eta = i === 0 ? min(mp.eta, 15) : mp.eta;
        const u = Math.random();
        const dl = u < 0.5 ? pow(2 * u, 1 / (eta + 1)) - 1 : 1 - pow(2 * (1 - u), 1 / (eta + 1));
        c[i] = cl(c[i] + dl, 0, 1);
      }
      const s = newSprite(c);
      evaluate(s, S.pr);
      s.px = par.px;
      s.py = par.py;
      out.push(s);
    }
  }
  for (const s of out) S.pop.push(s);
}

// Parents and offspring are sorted together; the best NP by rank, then by crowding, stay and the rest are culled.
function select(S) {
  const R = S.pop.filter((s) => s.st > 0);
  let left = NP;
  for (const F of sortFronts(S, R)) {
    crowding(F);
    if (F.length <= left) {
      for (const s of F) s.st = 1;
      left -= F.length;
    } else {
      F.sort((a, b) => b.cr - a.cr);
      for (let i = 0; i < F.length; i++) F[i].st = i < left ? 1 : 0;
      left = 0;
    }
  }
}

// Now and then the optimum jumps: some variables get a new target and it slides there over a couple of seconds.
function maybeJump(S) {
  S.gen++;
  S.sj++;
  if (S.gen < S.nextJump) return;
  const m = 2 + ((Math.random() * 3.99) | 0);
  for (let n = 0; n < m; n++) {
    const i = 1 + ((Math.random() * (NV - 1)) | 0);
    S.cT[i] = cl(S.cT[i] + (Math.random() < 0.5 ? -1 : 1) * JUMP_AMP * (0.5 + 0.5 * Math.random()), 0.2, 0.8);
  }
  S.nextJump = S.gen + JUMP0 + Math.random() * JUMP1;
  S.sj = 0;
}

function warmUp(S, kF) {
  S.warm = true;
  problemAt(S, 0, kF);
  S.pop = [];
  for (let n = 0; n < NP; n++) {
    const x = new Float64Array(NV);
    for (let i = 0; i < NV; i++) x[i] = Math.random();
    const s = newSprite(x);
    s.st = 1;
    evaluate(s, S.pr);
    S.pop.push(s);
  }
  // Eighty generations over forty seconds of the problem's time, then on to the fifth generation after a jump, so the first frame
  // is a population that has a front and is in the middle of chasing it.
  for (let g = 0; g < 140 && (g < 80 || S.sj !== 5); g++) {
    S.t += 0.5;
    S.tc += 0.5;
    for (let i = 1; i < NV; i++) S.cE[i] += (S.cT[i] - S.cE[i]) * 0.4;
    problemAt(S, S.t, kF);
    for (const s of S.pop) evaluate(s, S.pr);
    spawn(S);
    select(S);
    maybeJump(S);
    S.pop = S.pop.filter((s) => s.st > 0);
  }
  S.tw = S.t;
  for (const s of S.pop) evaluate(s, S.pr);
  sortFronts(S, S.pop);
  for (const s of S.pop) {
    s.px = toX(s.f1);
    s.py = toY(s.f2);
    s.al = 1;
    s.rk = s.rkT = s.rank;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = (S.k = input.knobValues || S.k);
  dt = cl(dt || 0, 0, 0.1);
  S.dt = dt;
  const kF = cl(k[2], -1, 1);
  if (!S.warm) warmUp(S, kF);
  S.t += dt;
  S.tc += dt * sqrt((PACE * cl(k[1], 1, 8)) / 1.2);
  const ce = 1 - exp(-dt / 0.9);
  for (let i = 1; i < NV; i++) S.cE[i] += (S.cT[i] - S.cE[i]) * ce;
  problemAt(S, S.t, kF);
  for (const s of S.pop) evaluate(s, S.pr);

  // two half-steps a generation: the offspring appear, and half a period later the sort culls
  S.credit += dt * 2 * PACE * cl(k[1], 1, 8);
  for (let guard = 0; S.credit >= 1 && guard < 6; guard++) {
    S.credit -= 1;
    if (S.phase === 0) spawn(S);
    else {
      select(S);
      maybeJump(S);
    }
    S.phase ^= 1;
  }
  if (S.credit > 3) S.credit = 0;

  // ranks for the colours, among everything not culled
  const live = S.pop.filter((s) => s.st > 0);
  sortFronts(S, live);
  for (const s of live) s.rkT = s.rank;

  const pe = 1 - exp(-dt * 6), ae = 1 - exp(-dt * 4.5), re = 1 - exp(-dt * 5);
  for (const s of S.pop) {
    s.px += (toX(s.f1) - s.px) * pe;
    s.py += (toY(s.f2) - s.py) * pe;
    s.rk += (s.rkT - s.rk) * re;
    if (s.st > 0) s.al += (1 - s.al) * ae;
    else s.al -= dt * 2.4;
  }
  S.pop = S.pop.filter((s) => s.st > 0 || s.al > 0.02);
}

// ---- drawing
function hsv(h, s, v, o) {
  h -= Math.floor(h);
  const i = (h * 6) | 0, f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: o[0] = v; o[1] = t; o[2] = p; break;
    case 1: o[0] = q; o[1] = v; o[2] = p; break;
    case 2: o[0] = p; o[1] = v; o[2] = t; break;
    case 3: o[0] = p; o[1] = q; o[2] = v; break;
    case 4: o[0] = t; o[1] = p; o[2] = v; break;
    default: o[0] = v; o[1] = p; o[2] = q;
  }
}

// rank 1 is white-gold, then rose, violet and deep blue, each dimmer
function rankColour(rk, hue0, o) {
  const t = cl((rk - 1) / 4.5, 0, 1);
  hsv(hue0 - 0.46 * pow(t, 0.8), 0.3 + 0.6 * min(1, t * 1.6), 1 - 0.35 * pow(t, 0.9), o);
}

// A soft stroke along one segment into cov, w0 wide where it is full and w1 where it ends.
function segment(cov, ax, ay, bx, by, w0, w1) {
  const pad = w1 + 0.5;
  const x0 = max(0, (min(ax, bx) - pad) | 0), x1 = min(W - 1, ceil(max(ax, bx) + pad));
  const y0 = max(0, (min(ay, by) - pad) | 0), y1 = min(H - 1, ceil(max(ay, by) + pad));
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = cl(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / l2, 0, 1);
      const ex = x + 0.5 - (ax + t * dx), ey = y + 0.5 - (ay + t * dy);
      const d = sqrt(ex * ex + ey * ey);
      const p = y * W + x;
      const c = sm(w1, w0, d);
      if (c > cov[p]) cov[p] = c;
    }
}

const lut = new Float32Array(256 * 3);
const col = [0, 0, 0], gold = [0, 0, 0], guide = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const hue0 = 0.095 + cl(S.k[0], 0, 1);
  const { ymin, xmin, ln, gd, buf } = S;
  const sp = S.pop;
  const tau = S.t - S.tw, ph = S.ph;
  for (let i = 0; i < 256; i++) hsv(hue0 - 0.4 + i / 256, 0.58, 1, lut.subarray(i * 3, i * 3 + 3));
  rankColour(1, hue0, gold);
  hsv(hue0 + 0.43, 0.5, 1, guide);

  // the rank-1 members: the staircase is the edge of the region they dominate, ymin down each column and xmin along each row
  const f = [];
  for (const s of sp) if (s.st > 0 && s.rkT === 1 && s.al > 0.3) f.push(s);
  f.sort((a, b) => a.px - b.px);
  let cur = 1e9, j = 0;
  for (let x = 0; x < W; x++) {
    while (j < f.length && f[j].px <= x + 0.5) {
      if (f[j].py < cur) cur = f[j].py;
      j++;
    }
    ymin[x] = cur;
  }
  const fy = f.slice().sort((a, b) => a.py - b.py);
  cur = 1e9;
  j = 0;
  for (let y = 0; y < H; y++) {
    while (j < fy.length && fy[j].py <= y + 0.5) {
      if (fy[j].px < cur) cur = fy[j].px;
      j++;
    }
    xmin[y] = cur;
  }

  // the stair as strokes: up from the bottom edge at the first point, along, up a riser at each new best, out to the right edge
  ln.fill(0);
  gd.fill(0);
  if (f.length) {
    let px = f[0].px, py = f[0].py;
    segment(ln, px, H + 3, px, py, 0.75, 1.75);
    for (let i = 1; i < f.length; i++) {
      if (f[i].py >= py) continue;
      segment(ln, px, py, f[i].px, py, 0.75, 1.75);
      segment(ln, f[i].px, py, f[i].px, f[i].py, 0.75, 1.75);
      px = f[i].px;
      py = f[i].py;
    }
    segment(ln, px, py, W + 3, py, 0.75, 1.75);
  }

  // the true front, only where it is not dominated by a stretch of itself further left, as a faint guide; pieces under six samples are left out
  {
    const pr = S.pr;
    let best = 9, run = [];
    const flush = () => {
      if (run.length >= 6) for (let i = 1; i < run.length; i++) segment(gd, run[i - 1][0], run[i - 1][1], run[i][0], run[i][1], 0.6, 1.6);
      run = [];
    };
    for (let i = 0; i <= 96; i++) {
      const f1 = i / 96, f2 = frontAt(f1, pr);
      if (f2 <= best + 1e-9) {
        best = f2;
        run.push([toX(f1), toY(f2)]);
      } else flush();
    }
    flush();
  }

  // the field behind: the dominated region, brightest where it meets the staircase, and a warm glow on the other side of it
  const kb = S.seen ? 1 - exp(-S.dt * 9) : 1;
  S.seen = true;
  const { sv } = S;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const d = min(y + 0.5 - ymin[x], x + 0.5 - xmin[y]);
      const e = sm(-0.6, 0.6, d);
      sv[p] += (e * (0.26 + 0.16 * exp(-max(d, 0) / 10)) - sv[p]) * kb;
      // slow clouds of light drifting across the field, in waves that no common period joins; the hue only leans a little
      const hz = 0.1 * sin(0.083 * x + 0.047 * y + 0.26 * tau + ph[16]) + 0.06 * sin(-0.051 * x + 0.092 * y + 0.18 * tau + ph[17]) + 0.05 * sin(0.019 * x - 0.127 * y + 0.33 * tau + ph[21]);
      const cloud = 1 + 0.65 * sin(0.121 * x - 0.067 * y + 0.37 * tau + ph[18]) + 0.4 * sin(0.057 * x + 0.109 * y - 0.29 * tau + ph[19]) + 0.24 * sin(-0.173 * x - 0.031 * y + 0.21 * tau + ph[20]) + 0.26 * sin(0.039 * x + 0.151 * y + 0.43 * tau + ph[22]) + 0.2 * sin(0.147 * x - 0.101 * y - 0.16 * tau + ph[23]);
      const v = max(sv[p] * cloud, min(sv[p], 0.13)), gv = gd[p] * 0.2;
      const li = (((hz + 1) * 256) | 0) % 256 * 3;
      buf[p * 3] = 255 * (lut[li] * v + guide[0] * gv);
      buf[p * 3 + 1] = 255 * (lut[li + 1] * v + guide[1] * gv);
      buf[p * 3 + 2] = 255 * (lut[li + 2] * v + guide[2] * gv);
    }

  // blobs, the later ranks first so the front lies on top of them
  const order = sp.slice().sort((a, b) => b.rk - a.rk);
  const blob = (s) => {
    const lead = sm(2, 1, s.rk);
    const r = (R2 + (R1 - R2) * lead) * (0.5 + 0.5 * min(1, s.al * 1.3));
    const a0 = min(1, s.al * 1.4);
    rankColour(s.rk, hue0, col);
    const x0 = max(0, (s.px - r - 2) | 0), x1 = min(W - 1, ceil(s.px + r + 2));
    const y0 = max(0, (s.py - r - 2) | 0), y1 = min(H - 1, ceil(s.py + r + 2));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - s.px, dy = y + 0.5 - s.py;
        const d = sqrt(dx * dx + dy * dy);
        const a = sm(r + 0.9, r - 0.9, d) * a0;
        if (a <= 0) continue;
        const hot = exp(-(d * d) / (0.55 * r * r));
        const w = 0.82 + 0.28 * hot, add = (14 + 22 * lead) * hot;
        const o = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) buf[o + c] += (min(255, col[c] * 255 * w + add) - buf[o + c]) * a;
      }
  };
  for (const s of order) if (s.rk >= 1.5) blob(s);
  for (let p = 0; p < N; p++) {
    const c = ln[p];
    if (c <= 0) continue;
    for (let k = 0; k < 3; k++) buf[p * 3 + k] += (gold[k] * 255 * 0.95 - buf[p * 3 + k]) * c;
  }
  for (const s of order) if (s.rk < 1.5) blob(s);

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let r = buf[p * 3], g = buf[p * 3 + 1], b = buf[p * 3 + 2];
      const m = max(r, g, b);
      // nothing under 20 of 255 shows on the panel: faint edges are dropped and the rest lifted to 22
      if (m < 12) {
        r = g = b = 0;
      } else if (m < 22) {
        const s2 = 22 / m;
        r *= s2;
        g *= s2;
        b *= s2;
      }
      display.setPixel(x, y, r | 0, g | 0, b | 0);
    }
}
