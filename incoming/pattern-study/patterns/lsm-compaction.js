// ===== Patternflow pattern =====
// Title:   LSM Compaction
// Family:  lsmtree
// Idea:    A log-structured merge tree drawn as lanes stacked down the panel, level 0 at the top and the biggest level at the bottom, where each sorted run is a bar whose length is its size and whose hue runs along it with the keys, small runs drop in at the top, and when a level overflows its bars are zipped together by a bright merge pointer into one longer bar that lands in the next lane and may overflow that one in turn.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the log-structured merge tree (Patrick O'Neil, Edward Cheng, Dieter Gawlick and Elizabeth O'Neil, 1996, from memory), with leveled compaction, tiered compaction and the lazy leveling between them (Dayan and Idreos, 2018, from memory); the model of key slices, duplicates and expiry, and the drawing, are original, pattern round 247
// Round:   247
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Write=0.5..4, Fanout=1.5..4, Policy=0..1
//
// Knob 1: Hue. Turns the key-to-colour map round the wheel: the smallest key is at one end of the gradient on a bar and the largest at the other. It opens with the low keys in teal and the high keys running through blue, violet and rose to amber. The map also creeps round the wheel by itself, once in about 3.6 minutes, so this knob sets where it is now.
// Knob 2: Write. 0.5 to 4, opening at 2: how fast small runs drop in at the top, about 0.4 flushes a second at 0.5, 1.3 at 2 and 2.3 at 4. At 0.5 a bar arrives every two or three seconds and most merges finish before the next begins. At 4 merges zip in several lanes at once and the top lane often has to wait for room.
// Knob 3: Fanout. 1.5 to 4, opening at 1.5: the size ratio between one level and the next. At 1.5 there are 7 lanes of 6 to 8 LED bars and the little merges at the top come often. At 4 there are 3 lanes, the bars are up to 17 LED thick and every overflow rewrites a run three times its size.
// Knob 4: Policy. 0 to 1, opening at 0.06. At 0 every lane is leveled: it keeps its bars sorted and an overflow pushes part of them into the lane below. Turned up, the top lanes become tiered, collecting 2 to 4 bars side by side that fuse all at once, one more lane for each sixth of the turn on 7 lanes, as far down as their bars still fit across the panel. The bottom lane stays leveled.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, pow, log, round, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const NB = 24;            // key bins: a run keeps how much of itself lies in each 1/24 of the key space
const BCAP = 56;          // LED the bottom lane may hold, so a full level fits the panel with a margin
const X0 = 4;             // where a lane starts
const C0 = 5.5;           // capacity of level 0 in LED: one flush is 62 to 100 percent of it
const GAP = 1.6;          // between two bars of one lane
const NMAX = 7;
const DUPF = 0.4;         // share of a key's overlapping entries a merge drops as overwritten
const HSPAN = 0.74;       // the key space covers three quarters of the hue wheel, so the ends do not meet
const HDRIFT = 1 / 217;   // the hue map creeps round the wheel by itself, once in 3.6 minutes
const PRE = 42;           // seconds of tree history run before the first frame

// ---- colour -------------------------------------------------------------------
// orange and yellow at low value read brown on the panel, so they are paled and kept bright
const warm = (h) => {
  const d = (h - floor(h) - 0.1) * 6;
  return exp(-d * d);
};
function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- runs ---------------------------------------------------------------------
// A run is the mass it keeps in each key bin, in LED, so its length is the sum and its colour at a point
// is read off the cumulative mass: where it holds more keys it shows more of the gradient.
function mkRun(st, m) {
  let s = 0;
  for (let b = 0; b < NB; b++) s += m[b];
  const cdf = new Float32Array(NB + 1);
  let a = 0;
  for (let b = 0; b < NB; b++) {
    cdf[b] = a / s;
    a += m[b];
  }
  cdf[NB] = 1;
  return { id: ++st.id, m, sz: s, ds: 1, heat: 1, cdf, x: 0, xt: 0, a: 1, fl: 0, busy: false, job: null, role: 0, cf: 0, age: 0, dy: 0 };
}
// the key at a fraction of the run's length, and the other way round
function keyAt(r, c) {
  const cd = r.cdf;
  c = cl(c, 0, 1);
  let b = 0;
  while (b < NB - 1 && cd[b + 1] < c) b++;
  const d = cd[b + 1] - cd[b];
  return (b + (d > 1e-6 ? (c - cd[b]) / d : 0.5)) / NB;
}
function fracAt(r, k) {
  const x = cl(k, 0, 1) * NB, b = min(NB - 1, floor(x));
  return r.cdf[b] + (x - b) * (r.cdf[b + 1] - r.cdf[b]);
}
// a slice of the key space with a soft-shouldered bump of mass in it
function slice(total, k0, kw, bumpy) {
  const m = new Float32Array(NB);
  let s = 0;
  for (let b = 0; b < NB; b++) {
    const u = ((b + 0.5) / NB - k0) / kw;
    if (u > 0 && u < 1) {
      m[b] = pow(sin(PI * u), 0.6) * (1 + bumpy * (rnd() - 0.5));
      s += m[b];
    }
  }
  if (s <= 0) m[min(NB - 1, floor((k0 + kw / 2) * NB))] = s = 1;
  for (let b = 0; b < NB; b++) m[b] *= total / s;
  return m;
}

// ---- state --------------------------------------------------------------------
export function setup(params) {
  const st = {
    k: [0, 2, 1.5, 0.06], init: false, t: 0, id: 0,
    n: 0, nt: 0, fa: 2, tt: 2, caps: [], capw: [], rate: 2, hue: 0.46,
    lanes: [], jobs: [], dest: [], ghosts: [], sparks: [],
    yc: new Float32Array(NMAX + 1), bt: new Float32Array(NMAX + 1), ds: new Float32Array(NMAX + 1).fill(1), sc: new Float32Array(NMAX).fill(1),
    t0: 0, focus: rnd(), mood: [0.5, 0.5], ph: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], nextFlush: 0.2, buf: new Float32Array(W * H * 3), tmp: [0, 0, 0], tmp2: [0, 0, 0],
  };
  for (let l = 0; l <= NMAX; l++) {
    st.lanes.push([]);
    st.dest.push(null);
  }
  params.st = st;
}

// Lanes from the two knobs. The number of levels is what a size ratio of F needs to get from a flush
// to the bottom capacity; capacities then grow by the same ratio from lane to lane.
function geometry(st) {
  const F = cl(st.k[2], 1.5, 4), nraw = 1 + log(BCAP / C0) / log(F);
  let n = st.n;
  const first = !n;
  if (first || abs(nraw - n) > 0.65) n = cl(round(nraw), 3, NMAX);
  const fa = pow(BCAP / C0, 1 / (n - 1));
  st.fa = fa;
  for (let l = 0; l < n; l++) st.caps[l] = C0 * pow(fa, l);
  // runs a tiered lane waits for before it merges them: the lane's output must land as one run of the next lane
  st.tt = cl(round(fa * 1.15), 2, 4);
  // tiered lanes from the top: a lane takes tt runs of the size the lanes above feed it, which must fit the panel
  let nt = round(cl(st.k[3], 0, 1) * (n - 1)), a = C0 * 0.82;
  const grow = st.tt * (1 - DUPF * 0.3);
  for (let l = 0; l < n; l++) {
    st.capw[l] = capDisp(l, n);
    if (l < nt) {
      const w = ((st.tt * a) / st.caps[l]) * st.capw[l] + (st.tt - 1) * GAP;
      if (w > 56) nt = l;
      else st.capw[l] = w;
    }
    a *= grow;
  }
  st.nt = nt;
  if (n !== st.n) resize(st, n);
  st.rate = 0.4 * pow(cl(st.k[1], 0.5, 4) / 0.5, 0.85);
}

// How wide a lane is drawn when full. Every lane has its own scale, so the top lanes are not left as a few LED:
// the bottom lane fills the panel and the lane at the top a third of it. The mark at the end of each lane shows where it is full.
const capDisp = (l, n) => BCAP * (0.3 + 0.7 * pow(l / (n - 1), 0.8));

// Lane heights grow a little from top to bottom; bars are thick enough to read at the panel's pitch.
function laneTargets(st, l, o) {
  const n = st.n;
  let tw = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.84 + 0.32 * (i / (n - 1));
    if (i < l) acc += w;
    tw += w;
  }
  const w = 0.84 + 0.32 * (l / (n - 1)), h = (H * w) / tw;
  // each lane sways on its own slow beat
  o[0] = (H * acc) / tw + h / 2 + 0.14 * h * sin(st.t * (0.071 + 0.0173 * l) + 1.7 * l + st.ph[0]);
  o[1] = cl(h * (0.34 + 0.15 * (l / (n - 1))) * (1 + 0.12 * sin(st.t * (0.083 + 0.0097 * l) + 3.1 * l + st.ph[2])), 6.2, 17);
  o[2] = (capDisp(l, n) / st.caps[l]) * (1 + 0.12 * sin(st.t * (0.053 + 0.0131 * l) + 2.3 * l + st.ph[1]));
}

function resize(st, nn) {
  const no = st.n;
  if (nn < no) {
    // lanes that vanish are folded into the new bottom lane; their bars fade out where they stood
    for (const jb of st.jobs.slice()) if (jb.d >= nn - 1 || jb.l >= nn - 1) finishJob(st, jb);
    const tot = new Float32Array(NB), mx = new Float32Array(NB), olds = [];
    for (let l = nn - 1; l < no; l++) {
      for (const r of st.lanes[l]) {
        for (let b = 0; b < NB; b++) {
          tot[b] += r.m[b];
          mx[b] = max(mx[b], r.m[b]);
        }
        olds.push({ r, l });
      }
      st.lanes[l] = [];
    }
    if (olds.length) {
      let s = 0;
      for (let b = 0; b < NB; b++) {
        tot[b] -= DUPF * (tot[b] - mx[b]);
        s += tot[b];
      }
      if (s > BCAP) for (let b = 0; b < NB; b++) tot[b] *= BCAP / s;
      const nr = mkRun(st, tot);
      nr.a = 0;
      nr.age = 1;
      st.lanes[nn - 1] = [nr];
      for (const { r, l } of olds) st.ghosts.push({ r, x: r.x, y: st.yc[l], bt: st.bt[l], a: r.a, ds: r.ds });
    }
  }
  for (let l = nn; l <= NMAX; l++) st.dest[l] = null;
  st.n = nn;
}

// ---- compaction ---------------------------------------------------------------
// A compaction merges the key window [ba, bb) (in bins) of its input runs. What lies outside the window stays
// behind as a remainder, so a lane that is partly rewritten keeps its bars, as a leveled tree does with its files.
function startJob(st, l, src, d, destIn, ba, bb) {
  const all = src.concat(destIn), ns = src.length;
  const tot = new Float32Array(NB), mx = new Float32Array(NB), out = new Float32Array(NB);
  const rem = { sl: new Float32Array(NB), sh: new Float32Array(NB), dl: new Float32Array(NB), dh: new Float32Array(NB) };
  let rd = 0;
  for (let i = 0; i < all.length; i++) {
    const r = all[i];
    let a = ba, b = bb;
    // a sliver left behind is taken along instead
    if (r.cdf[a] * r.sz < 1.8) a = 0;
    if ((1 - r.cdf[b]) * r.sz < 1.8) b = NB;
    r.ba = a;
    r.bb = b;
    r.fa = r.cdf[a];
    r.fb = r.cdf[b];
    for (let k = a; k < b; k++) {
      tot[k] += r.m[k];
      mx[k] = max(mx[k], r.m[k]);
    }
    const lo = i < ns ? rem.sl : rem.dl, hi = i < ns ? rem.sh : rem.dh;
    for (let k = 0; k < a; k++) lo[k] += r.m[k];
    for (let k = b; k < NB; k++) hi[k] += r.m[k];
    if (i >= ns) rd += r.sz * (r.fa + 1 - r.fb);
  }
  let sum = 0, sumIn = 0;
  for (let b = 0; b < NB; b++) {
    out[b] = tot[b] - DUPF * (tot[b] - mx[b]);
    sum += out[b];
    sumIn += tot[b];
  }
  let drop = sumIn - sum;
  // the bottom level cannot grow: what does not fit expires, more of it in one slice of the keys than in the rest
  const room = max(10, BCAP - rd);
  if (d === st.n - 1 && sum > room) {
    const kc = rnd(), ex = sum - room, wt = new Float32Array(NB);
    for (let pass = 0; pass < 3; pass++) {
      let ws = 0, cur = 0;
      for (let b = 0; b < NB; b++) {
        const u = ((b + 0.5) / NB - kc) / 0.22;
        wt[b] = out[b] * (0.12 + 3 * exp(-u * u));
        ws += wt[b];
        cur += out[b];
      }
      const need = cur - room;
      if (need <= 0.01) break;
      for (let b = 0; b < NB; b++) out[b] = max(out[b] * 0.1, out[b] - (need * wt[b]) / ws);
    }
    drop += ex;
  }
  const o = mkRun(st, out);
  o.age = 1;
  const dur = (0.25 + o.sz / 34) / (0.85 + 0.15 * st.rate);
  o.ds = st.ds[d];
  const job = { l, d, src, destIn, all, out: o, rem, t: 0, q: 0, dur, tier: destIn.length === 0 && d < st.nt, sb: [], ss: [], sq: [], ox: X0 };
  // the stripes of the zipper: 2.2 to 3.1 LED wide, each taken from one of the runs that hold the key there
  let u = 0;
  const ow = o.sz * o.ds;
  while (u < ow + 3) {
    const w = 2.2 + 0.9 * rnd(), kb = min(NB - 1, floor(keyAt(o, cl((u + w / 2) / ow, 0, 1)) * NB));
    // where several runs hold the key their stripes take turns; the run that held the last stripe is passed over most of the time
    let mxm = 0;
    for (const r of all) mxm = max(mxm, r.m[kb]);
    const cand = [];
    for (let i = 0; i < all.length; i++) if (all[i].m[kb] > 0.12 * mxm) cand.push(i);
    let who = cand[floor(rnd() * cand.length)];
    if (cand.length > 1 && who === job.ss[job.ss.length - 1] && rnd() < 0.8) who = cand[(cand.indexOf(who) + 1 + floor(rnd() * (cand.length - 1))) % cand.length];
    job.sb.push(u);
    job.ss.push(who);
    u += w;
  }
  job.sb.push(u);
  // dropped entries leave as a few soft sparks, at the moments the pointer passes
  const nsp = cl(round(drop / 1.6), 0, 10);
  for (let i = 0; i < nsp; i++) job.sq.push(rnd());
  job.sq.sort();
  for (let i = 0; i < all.length; i++) {
    all[i].busy = true;
    all[i].job = job;
    all[i].role = i < ns ? 0 : 1;
    all[i].cf = all[i].fa;
  }
  st.jobs.push(job);
  st.dest[d] = job;
}

function finishJob(st, jb) {
  const mk = (a) => {
    let s = 0;
    for (let b = 0; b < NB; b++) s += a[b];
    return s > 1.0 ? mkRun(st, a) : null;
  };
  const place = (r, x, from) => {
    if (r) {
      r.age = 1;
      r.x = x;
      r.heat = from ? from.heat : 1;
    }
    return r;
  };
  const f0 = jb.src[0], g0 = jb.destIn[0];
  const x0 = f0 ? f0.x : X0, len0 = f0 ? f0.sz * f0.ds : 0;
  const sl = place(mk(jb.rem.sl), x0, f0), sh = place(mk(jb.rem.sh), x0 + (f0 ? f0.fb * len0 : 0), f0);
  const dl = place(mk(jb.rem.dl), g0 ? g0.p1 : X0, g0), dh = place(mk(jb.rem.dh), g0 ? g0.p2 : X0, g0);
  const keep = (l, set) => st.lanes[l].filter((r) => !set.includes(r));
  st.lanes[jb.l] = [sl, sh].filter(Boolean).concat(keep(jb.l, jb.src));
  const dlane = keep(jb.d, jb.destIn);
  jb.out.fl = 1;
  jb.out.x = jb.tier ? jb.out.x : jb.ox;
  st.lanes[jb.d] = jb.tier ? dlane.concat([jb.out]) : [dl, jb.out, dh].filter(Boolean);
  st.dest[jb.d] = null;
  st.jobs.splice(st.jobs.indexOf(jb), 1);
}

// Writes are not uniform: they cluster round a focus in the key space that wanders, so for a minute or two the new
// runs are mostly teal and then mostly rose, and the size of a flush swells and shrinks on its own slow beat.
function flush(st) {
  const f = C0 * (0.62 + 0.38 * rnd()) * (0.82 + 0.36 * st.mood[1]), kw = 0.17 + 0.25 * rnd();
  const kc = rnd() < 0.85 ? st.focus + 0.14 * gauss() : rnd();
  const k0 = cl(kc - kw / 2, 0, 1 - kw);
  const r = mkRun(st, slice(f, k0, kw, 0.5));
  r.dy = -22;
  st.lanes[0].push(r);
}

// one level looks at its bars and may start a compaction into the next
function triggers(st) {
  for (let l = st.n - 2; l >= 0; l--) {
    const free = st.lanes[l].filter((r) => !r.busy && r.age > 0.6);
    if (!free.length) continue;
    let tot = 0;
    for (const r of free) tot += r.sz;
    const tier = l < st.nt;
    const go = tier ? free.length >= st.tt || tot * st.ds[l] + GAP * (free.length - 1) > 58 : tot > st.caps[l];
    if (!go) continue;
    const d = l + 1;
    if (st.dest[d]) continue;
    let destIn = [];
    // a tiered lane that already holds its full set waits to be merged before it takes another
    if (d < st.nt && st.lanes[d].filter((r) => !r.busy).length >= st.tt) continue;
    if (d >= st.nt) {
      const dl = st.lanes[d];
      if (dl.some((r) => r.busy || r.age < 0.6)) continue;
      // a level that is itself over capacity empties first, so a lane is never fed while it waits to be emptied
      let dt = 0;
      for (const r of dl) dt += r.sz;
      if (d < st.n - 1 && dt > st.caps[d]) continue;
      destIn = dl.slice();
    }
    // the window: the span of the keys the sources hold; a leveled lane below the top pushes down only a part of itself
    const comb = new Float32Array(NB);
    for (const r of free) for (let b = 0; b < NB; b++) comb[b] += r.m[b];
    let ba = 0, bb = NB;
    while (ba < NB - 1 && comb[ba] < 0.02) ba++;
    while (bb > ba + 1 && comb[bb - 1] < 0.02) bb--;
    const M = max(tot - 0.55 * st.caps[l], 0.28 * tot);
    if (!tier && l > 0 && M < 0.8 * tot && M > 2.5) {
      let acc = 0;
      if (rnd() < 0.5) {
        ba = 0;
        bb = 0;
        while (bb < NB && acc < M) acc += comb[bb++];
      } else {
        ba = NB;
        while (ba > 0 && acc < M) acc += comb[--ba];
        bb = NB;
      }
      if (bb - ba < 1) continue;
    }
    startJob(st, l, free, d, destIn, ba, bb);
  }
}

// ---- time ---------------------------------------------------------------------
function step(st, dt) {
  st.t += dt;
  geometry(st);
  const n = st.n, tg = [0, 0, 0];
  // flushes arrive at a steady random pace; a level 0 that has not been emptied yet holds the writer back
  st.focus += 0.1 * gauss() * sqrt(dt);
  if (st.focus < 0 || st.focus > 1) st.focus = cl(st.focus < 0 ? -st.focus : 2 - st.focus, 0, 1);
  st.mood[0] = 0.5 + 0.25 * sin(st.t * 0.152 + st.ph[0]) + 0.25 * sin(st.t * 0.0699 + st.ph[1]);
  st.mood[1] = 0.5 + 0.5 * sin(st.t * 0.117 + st.ph[2]);
  st.nextFlush -= dt;
  if (st.nextFlush <= 0) {
    if (st.lanes[0].length >= 4) st.nextFlush = 0.2;
    else {
      flush(st);
      st.nextFlush = (0.55 + 0.9 * rnd()) / (st.rate * (0.7 + 0.6 * st.mood[0]));
    }
  }
  triggers(st);
  for (const jb of st.jobs.slice()) {
    jb.t += dt;
    const tt = cl((jb.t - 0.2) / jb.dur, 0, 1);
    jb.q = 0.55 * tt + 0.45 * tt * tt * (3 - 2 * tt);
    const key = keyAt(jb.out, jb.q);
    for (const r of jb.all) r.cf = fracAt(r, key);
    while (jb.sq.length && jb.sq[0] <= jb.q) {
      jb.sq.shift();
      if (st.sparks.length < 36) {
        const up = rnd() < 0.5 ? -1 : 1;
        st.sparks.push({ l: jb.d, x: (jb.tier ? jb.out.x : jb.ox) + jb.q * jb.out.sz * jb.out.ds, up, v: 4 + 5 * rnd(), life: 0, max: 0.9 + 0.6 * rnd(), key, dx: (rnd() - 0.5) * 4 });
      }
    }
    if (tt >= 1) finishJob(st, jb);
  }
  // layout: where each bar wants to be, and the eased lanes
  for (let l = 0; l < n; l++) {
    laneTargets(st, l, tg);
    if (!st.init) {
      st.yc[l] = tg[0];
      st.bt[l] = tg[1];
    } else {
      const e = 1 - exp(-dt * 3);
      st.yc[l] += (tg[0] - st.yc[l]) * e;
      st.bt[l] += (tg[1] - st.bt[l]) * e;
    }
    if (!st.init) st.ds[l] = tg[2];
    else st.ds[l] += (tg[2] - st.ds[l]) * (1 - exp(-dt * 3));
    const jd = st.dest[l], lane = st.lanes[l], D = st.ds[l];
    let cur = X0;
    if (jd) jd.out.ds = D;
    for (const r of lane) {
      r.ds = D;
      r.age += dt;
      r.fl *= exp(-dt * 3.2);
      r.heat *= exp(-dt / 28);
      r.dy *= exp(-dt * 5);
      r.a = min(1, r.a + dt * 2.5);
    }
    if (jd && !jd.tier) {
      // a lane being rewritten: what lies below the window, the new run growing, what lies above it
      const g = GAP * sst(0, 0.1, jd.q), ins = jd.destIn;
      let n1 = 0;
      for (const r of ins) {
        if (r.fa > 0.002) {
          r.p1 = cur;
          cur += r.fa * r.sz * D + GAP;
          n1++;
        }
      }
      if (n1) cur -= GAP;
      jd.ox = cur + (n1 ? g : 0);
      cur = jd.ox + jd.q * jd.out.sz * D + g;
      for (const r of ins) {
        r.p2 = cur;
        if (1 - r.cf > 0.002) cur += (1 - r.cf) * r.sz * D + GAP;
      }
    } else {
      for (const r of lane) {
        r.xt = cur;
        if (!st.init || r.age < dt * 1.5) r.x = cur;
        else r.x += (r.xt - r.x) * (1 - exp(-dt * 7));
        cur += r.sz * D + GAP;
      }
      if (jd) {
        jd.out.x = cur;
        cur += jd.q * jd.out.sz * D + GAP;
      }
    }
    const tgt = min(1, (62 - X0) / max(1, cur - GAP - X0));
    st.sc[l] = tgt < st.sc[l] || !st.init ? tgt : st.sc[l] + (tgt - st.sc[l]) * (1 - exp(-dt * 4));
  }
  for (const g of st.ghosts) g.a -= dt * 2;
  st.ghosts = st.ghosts.filter((g) => g.a > 0);
  for (const s of st.sparks) s.life += dt;
  st.sparks = st.sparks.filter((s) => s.life < s.max);
}

function initModel(st) {
  geometry(st);
  const n = st.n;
  // a tree that already has some history: one or two runs in every lane
  for (let l = 0; l < n; l++) {
    const cnt = l < st.nt ? st.tt - 1 : 1;
    for (let i = 0; i < cnt; i++) {
      const kw = min(1, 0.18 + 0.82 * pow(l / (n - 1), 0.8) * (0.7 + 0.3 * rnd())), k0 = rnd() * (1 - kw);
      const sz = l < st.nt ? 0.82 * st.caps[l] : st.caps[l] * (0.5 + 0.4 * rnd());
      const r = mkRun(st, slice(sz, k0, kw, 0.6));
      r.age = 2;
      st.lanes[l].push(r);
    }
  }
  const tg = [0, 0, 0];
  for (let l = 0; l < n; l++) {
    laneTargets(st, l, tg);
    st.yc[l] = tg[0];
    st.bt[l] = tg[1];
    st.ds[l] = tg[2];
  }
  for (let i = 0; i < PRE * 30; i++) step(st, 1 / 30);
  st.init = true;
  st.t0 = st.t;
  for (let l = 0; l < st.n; l++) for (const r of st.lanes[l]) (r.x = r.xt), (r.a = 1), (r.dy = 0);
  st.nextFlush = 0.3;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  st.hue = 0.46 + cl(kv[0], 0, 1) + (st.t - st.t0) * HDRIFT;
  if (!st.init) {
    initModel(st);
    return;
  }
  let left = cl(dt || 0, 0, 0.25);
  while (left > 1e-6) {
    const h = min(left, 1 / 30);
    step(st, h);
    left -= h;
  }
}

// ---- drawing ------------------------------------------------------------------
// One rounded bar. colf gives the colour of the column at x in o and a column alpha.
function bar(st, xs, xe, yc, bt, a, colf) {
  const hb = bt * 0.5, hx = (xe - xs) * 0.5, xm = (xs + xe) * 0.5;
  if (hx < 0.3 || a <= 0.003) return;
  const rr = min(hb, hx, 3.2), buf = st.buf, o = st.tmp;
  const px0 = max(0, floor(xs - 1.5)), px1 = min(W - 1, ceil(xe + 1.5));
  const py0 = max(0, floor(yc - hb - 1.5)), py1 = min(H - 1, ceil(yc + hb + 1.5));
  for (let px = px0; px <= px1; px++) {
    const cx = px + 0.5, ca = colf(cx, o);
    if (ca <= 0.003) continue;
    const qx = abs(cx - xm) - (hx - rr);
    for (let py = py0; py <= py1; py++) {
      const cy = py + 0.5, ry = (cy - yc) / hb, qy = abs(cy - yc) - (hb - rr);
      const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0;
      const d = (ox > 0 || oy > 0 ? sqrt(ox * ox + oy * oy) : 0) + min(max(qx, qy), 0) - rr;
      if (d >= 1) continue;
      let cov = d <= -1 ? 1 : (1 - d) * 0.5;
      cov = cov * cov * (3 - 2 * cov);
      const sh = (1 - 0.2 * ry * ry) * cov * a * ca, i = (py * W + px) * 3;
      buf[i] += o[0] * sh;
      buf[i + 1] += o[1] * sh;
      buf[i + 2] += o[2] * sh;
    }
  }
}

// a soft blob, for sparks and the seam
function blob(st, x, y, sx, sy, amp, c) {
  const buf = st.buf, rx = ceil(3 * sx), ry = ceil(3 * sy);
  for (let py = max(0, floor(y - ry)); py <= min(H - 1, ceil(y + ry)); py++) {
    const dy = (py + 0.5 - y) / sy;
    for (let px = max(0, floor(x - rx)); px <= min(W - 1, ceil(x + rx)); px++) {
      const dx = (px + 0.5 - x) / sx, w = amp * exp(-0.5 * (dx * dx + dy * dy)), i = (py * W + px) * 3;
      buf[i] += w * c[0];
      buf[i + 1] += w * c[1];
      buf[i + 2] += w * c[2];
    }
  }
}

// colour of a run at a fraction of its length, k is its key there
function keyColour(st, k, o, tint, con, heat = 1) {
  const h = st.hue + HSPAN * k, wm = warm(h);
  let s = 0.74 * (1 - 0.45 * wm), v = 0.88;
  if (tint) {
    s *= 1 - 0.6 * max(tint, 0) * con + 0.18 * max(-tint, 0) * con;
    v *= 1 - 0.3 * max(-tint, 0) * con + 0.1 * max(tint, 0) * con;
  }
  hsv(h + 0.03 * tint * con, cl(s, 0, 1), cl(v, 0, 1), o);
  // data that has not been rewritten for a while cools: paler, a little bluer and a little dimmer
  const m = 0.45 * (1 - heat), dim = 0.55 + 0.45 * heat;
  o[0] = (o[0] * (1 - m) + 0.55 * m) * dim;
  o[1] = (o[1] * (1 - m) + 0.62 * m) * dim;
  o[2] = (o[2] * (1 - m) + 0.85 * m) * dim;
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const buf = st.buf, n = st.n;
  buf.fill(0);
  const o2 = st.tmp2, white = [1, 1, 1];
  // lane guides: a faint foot at each edge, and a mark where a lane is full
  for (let l = 0; l < n; l++) {
    const yc = st.yc[l], bt = st.bt[l];
    blob(st, 1.3, yc, 1.1, bt * 0.42, 0.18, [0.55, 0.65, 0.9]);
    blob(st, 62.7, yc, 1.1, bt * 0.42, 0.18, [0.55, 0.65, 0.9]);
    const xc = min(60.5, X0 + st.capw[l] * st.sc[l] + 1.6);
    blob(st, xc, yc, 0.9, bt * 0.5 + 1, 0.22, [0.5, 0.62, 0.95]);
  }
  for (const g of st.ghosts) {
    const r = g.r;
    const gl = r.sz * g.ds;
    bar(st, g.x, g.x + gl, g.y, g.bt, g.a, (cx, o) => (keyColour(st, keyAt(r, (cx - g.x) / gl), o, 0, 0), 1));
  }
  for (let l = 0; l < n; l++) {
    const yc = st.yc[l], bt = st.bt[l], sc = st.sc[l];
    const X = (x) => X0 + (x - X0) * sc;
    // the part [c0, c1] of a run, starting at x; the front of a part that is being eaten leaves a short fading trail
    const piece = (r, c0, c1, xs, y, front, pre) => {
      if (c1 - c0 < 0.003) return;
      const len = r.sz * r.ds * sc, xv = xs - c0 * len, xe = xs + (c1 - c0) * len, fl = r.fl;
      bar(st, xs - (front ? 4 : 0), xe, y, bt, r.a, (cx, o) => {
        keyColour(st, keyAt(r, (cx - xv) / len), o, 0, 0, r.heat);
        let lift = fl * 0.35 + pre, ca = 1;
        if (front) {
          if (cx < xs) ca = exp(-(xs - cx) / 2);
          else lift += 0.45 * exp(-(cx - xs) / 2.2);
        }
        lift = min(lift, 0.6);
        for (let i = 0; i < 3; i++) o[i] = (o[i] + (1 - o[i]) * lift) * (1 + 0.2 * fl);
        return ca;
      });
    };
    for (const r of st.lanes[l]) {
      const y = yc + r.dy, jb = r.job, len = r.sz * r.ds * sc;
      if (!r.busy) {
        piece(r, 0, 1, X(r.x), y, false, 0);
        continue;
      }
      const pre = 0.3 * sst(0, 0.2, jb.t), started = r.cf - r.fa > 0.002;
      if (r.role === 0) {
        const x = X(r.x);
        piece(r, 0, r.fa, x, y, false, pre);
        piece(r, r.cf, 1, x + r.cf * len, y, started, pre);
      } else {
        piece(r, 0, r.fa, X(r.p1), y, false, pre);
        piece(r, r.cf, 1, X(r.p2), y, started, pre);
      }
    }
    // the run being written, zipped from the stripes of the runs that make it
    const jb = st.dest[l];
    if (jb && jb.q > 0.004) {
      const o = jb.out, xo = X(jb.tier ? o.x : jb.ox), ow = o.sz * o.ds, len = ow * sc, pu = jb.q * len;
      bar(st, xo, xo + pu, yc, bt, 1, (cx, out) => {
        const u = (cx - xo) / sc, c = u / ow;
        // which run's stripe is here, blended over a LED at each edge of a stripe
        let j = 0;
        while (j < jb.ss.length - 1 && jb.sb[j + 1] <= u) j++;
        const f = u - jb.sb[j], w = jb.sb[j + 1] - jb.sb[j];
        const tn = (i) => [-1, 1, 0, -0.6, 0.6][jb.ss[cl(i, 0, jb.ss.length - 1)] % 5];
        let tint = tn(j);
        if (f < 0.6) tint = tn(j - 1) + (tint - tn(j - 1)) * sst(0, 0.6, f + 0.3);
        else if (f > w - 0.6) tint = tint + (tn(j + 1) - tint) * sst(w - 0.9, w - 0.3, f);
        const con = exp(-(jb.q * ow - u) / 14);
        keyColour(st, keyAt(o, c), out, tint, con);
        // rewritten bytes flare, the seam most
        const lift = min(0.45, 0.4 * exp(-(jb.q * ow - u) / 2.5) + o.fl * 0.3);
        for (let i = 0; i < 3; i++) out[i] += (1 - out[i]) * lift;
        return 1;
      });
      keyColour(st, keyAt(o, jb.q), o2, 0, 0);
      for (let i = 0; i < 3; i++) o2[i] = 0.5 + 0.5 * o2[i];
      blob(st, xo + pu, yc, 1.2, bt * 0.3, 0.4 * (1 - sst(0.9, 1, jb.q)), o2);
    }
  }
  // sparks: duplicates and expired entries leaving the bar
  for (const s of st.sparks) {
    const l = min(s.l, n - 1), lf = s.life / s.max, x = s.x * st.sc[l] + (X0 - X0 * st.sc[l]) + s.dx * lf;
    const y = st.yc[l] + s.up * (st.bt[l] * 0.5 + s.v * s.life);
    keyColour(st, s.key, o2, 0, 0);
    for (let i = 0; i < 3; i++) o2[i] = 0.45 + 0.55 * o2[i];
    blob(st, cl(x, 2, 61), y, 1.15, 1.15, 0.85 * (1 - lf) * (1 - lf), o2);
  }
  // compose over a deep slate ground
  for (let y = 0; y < H; y++) {
    const g = 0.012 + 0.016 * (y / H);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = min(1, g * 0.6 + buf[i]), gg = min(1, g * 0.9 + buf[i + 1]), b = min(1, g * 1.6 + buf[i + 2]);
      display.setPixel(x, y, (r * 255 + 0.5) | 0, (gg * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
    }
  }
}
