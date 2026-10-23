// ===== Patternflow pattern =====
// Title:   Metro Map
// Family:  city
// Idea:    A schematic subway map in the Harry Beck manner, drawn for the tall panel, with trains running its lines, stopping at every station and turning back at the ends.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Harry Beck's 1933 diagram of the London Underground, and the schematic maps drawn after it
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lines=4..7, Rush=0..1
//
// Knob 1: Hue. Turns the whole line palette round the colour wheel together; the river stays blue.
// Knob 2: Speed. How fast the trains run: at 2 they reach 14 LEDs a second between stations and stand 0.7 s at each, at the bottom they creep at 1.4 and stand 7 s, at the top they reach 21.
// Knob 3: Lines. How many lines are open: four at the bottom (two trunks, the line that shares both their corridors, and the circle), then the cross line through the middle, an upper and a lower one. A line that opens turns the crossings it makes into interchanges.
// Knob 4: Rush. The service: from three trains on each line, spread evenly round its timetable, to eight; a train that joins fades in at its place and the rest close up over a couple of seconds.
// Buttons: K1 tap sends an express down one line, three times the speed of the others, end to end without stopping and lighting the line behind it; each tap takes the next line.

const W = 64;
const H = 128;
const N = W * H;
const MAXL = 7;
const MAXT = 8;

// The network, as corners on the lattice. A line at (x, y) lights the LEDs
// x..x+1 and y..y+1, so every run is two LEDs wide and a 45 degree run three
// LEDs to a row. The last point equal to the first makes a loop.
const NET = [
  // West trunk.
  { hue: 0.0, side: -1, pts: [[8, 3], [8, 28], [20, 40], [20, 98], [10, 108], [10, 123]] },
  // East trunk.
  { hue: 0.6, side: 1, pts: [[52, 3], [52, 20], [42, 30], [42, 94], [52, 104], [52, 123]] },
  // Down the middle: it shares the east trunk's corridor at the top and the
  // west trunk's at the bottom.
  { hue: 0.14, side: 1, pts: [[49, 3], [49, 19], [31, 37], [31, 70], [23, 78], [23, 99], [13, 109], [13, 123]] },
  // The circle.
  { hue: 0.78, side: 1, pts: [[16, 46], [46, 46], [52, 52], [52, 80], [46, 86], [16, 86], [10, 80], [10, 52], [16, 46]] },
  // Across the middle.
  { hue: 0.33, side: 1, pts: [[2, 64], [60, 64]] },
  // Upper cross line.
  { hue: 0.5, side: 1, pts: [[2, 14], [24, 14], [30, 8], [60, 8]] },
  // Lower cross line.
  { hue: 0.07, side: 1, pts: [[2, 120], [22, 120], [30, 112], [60, 112]] },
];

// The river, five LEDs wide, under everything.
const RIVER = [[-4, 92], [26, 92], [32, 98], [46, 98], [52, 92], [70, 92]];

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[o + 1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[o + 2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// Corners to lattice points one step apart, with the distance run so far.
function expand(pts) {
  const xs = [];
  const ys = [];
  const ss = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const sx = Math.sign(x1 - x0);
    const sy = Math.sign(y1 - y0);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const step = sx && sy ? Math.SQRT2 : 1;
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      if (k > 0) s += step;
      xs.push(x0 + sx * k);
      ys.push(y0 + sy * k);
      ss.push(s);
    }
  }
  return { xs, ys, ss, loop: pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] };
}

function setLit(mask, x, y, v) {
  if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = v;
}

// Everything that depends on how many lines are open: which LEDs each line
// lights, where the interchanges are, where each line stops.
function build(P, count) {
  P.count = count;
  const owner = P.owner;
  owner.fill(0);
  const lines = P.lines;
  for (let l = 0; l < count; l++) {
    const L = lines[l];
    for (let k = 0; k < L.xs.length; k++) {
      const x = L.xs[k];
      const y = L.ys[k];
      setLit(owner, x, y, l + 1);
      setLit(owner, x + 1, y, l + 1);
      setLit(owner, x, y + 1, l + 1);
      setLit(owner, x + 1, y + 1, l + 1);
    }
  }
  // Crossings: lattice points two open lines share.
  const at = new Map();
  const hits = [];
  for (let l = 0; l < count; l++) {
    const L = lines[l];
    for (let k = 0; k < L.xs.length; k++) {
      const key = L.ys[k] * 100 + L.xs[k];
      const other = at.get(key);
      if (other !== undefined && other !== l) hits.push([L.xs[k] + 1, L.ys[k] + 1]);
      else at.set(key, l);
    }
  }
  // Crossings closer than six LEDs share one interchange, drawn round both.
  const inter = [];
  for (const [x, y] of hits) {
    let joined = false;
    for (const I of inter) {
      if (Math.max(Math.abs(I.ax - x), Math.abs(I.ay - y), Math.abs(I.bx - x), Math.abs(I.by - y)) <= 6) {
        if (x < I.ax || (x === I.ax && y < I.ay)) {
          I.ax = x;
          I.ay = y;
        } else if (x > I.bx || (x === I.bx && y > I.by)) {
          I.bx = x;
          I.by = y;
        }
        joined = true;
        break;
      }
    }
    if (!joined) inter.push({ ax: x, ay: y, bx: x, by: y });
  }
  P.inter = inter;
  // Stops: the interchanges a line passes through, its ends, and ordinary
  // stations between them about every 13 LEDs, kept off the corners.
  for (let l = 0; l < count; l++) {
    const L = lines[l];
    const n = L.xs.length;
    const anchors = [];
    for (let i = 0; i < inter.length; i++) {
      const I = inter[i];
      let best = -1;
      let bd = 3;
      for (let k = 0; k < n; k++) {
        const d = Math.max(Math.abs(L.xs[k] + 1 - (I.ax + I.bx) / 2), Math.abs(L.ys[k] + 1 - (I.ay + I.by) / 2));
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (best >= 0) anchors.push({ k: best, inter: true, at: i });
    }
    if (!L.loop) {
      anchors.push({ k: 0, inter: false, end: true });
      anchors.push({ k: n - 1, inter: false, end: true });
    }
    anchors.sort((a, b) => a.k - b.k);
    const stops = [];
    for (let i = 0; i < anchors.length; i++) {
      stops.push(anchors[i]);
      const a = anchors[i];
      const b = i + 1 < anchors.length ? anchors[i + 1] : L.loop ? { k: anchors[0].k + n - 1 } : null;
      if (!b) break;
      const sa = L.ss[a.k];
      const sb = b.k < n ? L.ss[b.k] : L.ss[n - 1] + L.ss[b.k - (n - 1)];
      const gap = sb - sa;
      const m = Math.round(gap / 13) - 1;
      for (let j = 1; j <= m; j++) {
        let target = sa + (gap * j) / (m + 1);
        if (target > L.ss[n - 1]) target -= L.ss[n - 1];
        let kk = 0;
        while (kk < n - 1 && L.ss[kk] < target) kk++;
        // A station sits on a straight run, off the corners: a tick on a
        // 45 degree run touches its line only at a corner and reads as a
        // stray LED. Failing that within seven steps, there is no station.
        let found = -1;
        for (let d = 0; d <= 7 && found < 0; d++)
          for (const c of [kk + d, kk - d])
            if (found < 0 && c > 0 && c < n - 1 && plain(L, c) && Math.abs(L.ss[c] - L.ss[a.k]) > 5 && Math.abs(L.ss[c] - sb) > 5) found = c;
        if (found >= 0) stops.push({ k: found, inter: false });
      }
    }
    stops.sort((a, b) => a.k - b.k);
    L.stops = stops.filter((s, i) => i === 0 || s.k !== stops[i - 1].k);
    timetable(L);
  }
  // Station ticks and the bars at the ends, in LEDs, once every line is laid.
  for (let l = 0; l < count; l++) {
    const L = lines[l];
    for (const st of L.stops) {
      st.px = [];
      if (st.inter) continue;
      if (st.end) {
        endBar(L, st, owner);
        continue;
      }
      let px = tick(L, st.k, L.side, owner);
      if (!px) px = tick(L, st.k, -L.side, owner);
      if (px) st.px = px;
    }
  }
}

// The step a line takes at lattice point k.
function heading(L, k) {
  const n = L.xs.length;
  const a = k < n - 1 ? k : k - 1;
  return [L.xs[a + 1] - L.xs[a], L.ys[a + 1] - L.ys[a]];
}

function free(owner, list) {
  for (const [x, y] of list) if (x < 0 || x >= W || y < 0 || y >= H || owner[y * W + x]) return false;
  return true;
}

// A station tick: two LEDs standing out from the line square to it, on the
// given side, or null when something else is already there.
function tick(L, k, side, owner) {
  const [dx, dy] = heading(L, k);
  const x = L.xs[k];
  const y = L.ys[k];
  const nx = -dy * side;
  const ny = dx * side;
  let list;
  if (dx === 0) list = nx > 0 ? [[x + 2, y], [x + 3, y]] : [[x - 1, y], [x - 2, y]];
  else if (dy === 0) list = ny > 0 ? [[x, y + 2], [x, y + 3]] : [[x, y - 1], [x, y - 2]];
  else if (dx === dy) list = nx > 0 ? [[x + 2, y - 1], [x + 3, y - 2]] : [[x - 1, y + 2], [x - 2, y + 3]];
  else list = nx < 0 ? [[x - 1, y - 1], [x - 2, y - 2]] : [[x + 2, y + 2], [x + 3, y + 3]];
  // Keep a dark LED between the tick and any other line.
  const halo = list.concat(list.map(([a, b]) => [a + Math.sign(nx), b + Math.sign(ny)]));
  if (!free(owner, list) || !halo.every(([a, b]) => a < 0 || a >= W || b < 0 || b >= H || !owner[b * W + a] || owner[b * W + a] === owner[L.ys[k] * W + L.xs[k]])) return null;
  return list.map(([a, b]) => b * W + a);
}

// The bar across a line's end, six LEDs wide.
function endBar(L, st, owner) {
  const [dx, dy] = heading(L, st.k);
  const x = L.xs[st.k];
  const y = L.ys[st.k];
  const list = [];
  for (let i = -2; i <= 3; i++) {
    if (dx === 0) list.push([x + i, st.k === 0 ? y : y + 1]);
    else list.push([st.k === 0 ? x : x + 1, y + i]);
  }
  st.px = list.filter(([a, b]) => a >= 0 && a < W && b >= 0 && b < H && !owner[b * W + a]).map(([a, b]) => b * W + a);
}

// A point on a straight up-and-down or level run, two steps from any corner.
function plain(L, k) {
  const [dx, dy] = heading(L, k);
  return (dx === 0 || dy === 0) && !isCorner(L, k);
}

function isCorner(L, k) {
  const n = L.xs.length;
  if (k <= 0 || k >= n - 1) return false;
  const ax = L.xs[k] - L.xs[k - 1];
  const ay = L.ys[k] - L.ys[k - 1];
  const bx = L.xs[k + 1] - L.xs[k];
  const by = L.ys[k + 1] - L.ys[k];
  if (ax !== bx || ay !== by) return true;
  if (k >= 2 && (L.xs[k - 1] - L.xs[k - 2] !== ax || L.ys[k - 1] - L.ys[k - 2] !== ay)) return true;
  if (k <= n - 3 && (L.xs[k + 2] - L.xs[k + 1] !== bx || L.ys[k + 2] - L.ys[k + 1] !== by)) return true;
  return false;
}

// Trains between two stops a distance d apart: they pull away at ACC LEDs a
// second squared up to TOP LEDs a second and brake the same way, all in the
// line's own clock, which Speed winds.
const ACC = 5;
const TOP = 7;
const DWELL = 1.4;
const TURN = 3;

function runTime(d) {
  const ramp = TOP / ACC;
  if (d >= TOP * ramp) return d / TOP + ramp;
  return 2 * Math.sqrt(d / ACC);
}

function runPos(d, t) {
  const ramp = TOP / ACC;
  if (d >= TOP * ramp) {
    const T = d / TOP + ramp;
    if (t < ramp) return 0.5 * ACC * t * t;
    if (t > T - ramp) {
      const u = T - t;
      return d - 0.5 * ACC * u * u;
    }
    return 0.5 * ACC * ramp * ramp + TOP * (t - ramp);
  }
  const T = 2 * Math.sqrt(d / ACC);
  if (t < T / 2) return 0.5 * ACC * t * t;
  const u = T - t;
  return d - 0.5 * ACC * u * u;
}

// A line's timetable: a list of legs, each a dwell at a stop or a run to the
// next, covering one round trip (or one lap of a loop).
function timetable(L) {
  const legs = [];
  const total = L.ss[L.xs.length - 1];
  const s = L.stops.map((st) => L.ss[st.k]);
  let t = 0;
  const push = (kind, from, to, dur, stop) => {
    legs.push({ kind, from, to, t0: t, dur, stop });
    t += dur;
  };
  if (L.loop) {
    for (let i = 0; i < s.length; i++) {
      const a = s[i];
      const b = i + 1 < s.length ? s[i + 1] : s[0] + total;
      push("dwell", a, a, DWELL, i);
      push("run", a, b, runTime(b - a));
    }
  } else {
    for (let i = 0; i < s.length - 1; i++) {
      push("dwell", s[i], s[i], i === 0 ? TURN : DWELL, i);
      push("run", s[i], s[i + 1], runTime(s[i + 1] - s[i]));
    }
    for (let i = s.length - 1; i > 0; i--) {
      push("dwell", s[i], s[i], i === s.length - 1 ? TURN : DWELL, i);
      push("run", s[i], s[i - 1], runTime(s[i] - s[i - 1]));
    }
  }
  L.legs = legs;
  L.period = t;
  L.total = total;
}

// Where a train is at time t into its line's cycle: distance along the line,
// and whether it stands at a stop.
function trainAt(L, t, out) {
  t = ((t % L.period) + L.period) % L.period;
  const legs = L.legs;
  let lo = 0;
  let hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  const g = legs[lo];
  if (g.kind === "dwell") {
    out.s = g.from;
    out.dir = 0;
    out.stop = g.stop;
  } else {
    const d = Math.abs(g.to - g.from);
    const p = runPos(d, t - g.t0);
    out.s = g.to > g.from ? g.from + p : g.from - p;
    out.dir = g.to > g.from ? 1 : -1;
    out.stop = -1;
  }
  if (L.loop && out.s >= L.total) out.s -= L.total;
}

export function setup(params) {
  const P = params;
  P.lines = NET.map((L) => {
    const e = expand(L.pts);
    return { hue: L.hue, side: L.side, xs: e.xs, ys: e.ys, ss: e.ss, loop: e.loop };
  });
  P.owner = new Uint8Array(N);
  P.river = new Uint8Array(N);
  const r = expand(RIVER);
  for (let k = 0; k < r.xs.length; k++)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setLit(P.river, r.xs[k] + dx, r.ys[k] + dy, 1);
  P.train = new Float32Array(N);
  P.mark = new Uint8Array(N);
  P.glow = new Float32Array(N);
  P.col = new Float32Array(MAXL * 3);
  P.clock = 0;
  P.count = 0;
  // Each line's trains: where each stands in the timetable, as a share of
  // the line's cycle, and how far it has faded in.
  P.off = new Float32Array(MAXL * MAXT);
  P.vis = new Float32Array(MAXL * MAXT);
  for (let l = 0; l < MAXL; l++)
    for (let i = 0; i < 3; i++) {
      P.off[l * MAXT + i] = i / 3;
      P.vis[l * MAXT + i] = 1;
    }
  P.hue = 0;
  P.express = null;
  P.pick = 0;
  P.where = { s: 0, dir: 0, stop: -1 };
  build(P, 4);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 4, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  const count = Math.max(4, Math.min(MAXL, Math.round(k[2])));
  if (count !== P.count) build(P, count);
  // Rush: three to eight trains a line. A train that joins fades in at its
  // place in the timetable, one that leaves fades out, and the others close
  // up over a couple of seconds instead of jumping.
  const n = Math.round(3 + Math.max(0, Math.min(1, k[3])) * 5);
  for (let l = 0; l < MAXL; l++)
    for (let i = 0; i < MAXT; i++) {
      const j = l * MAXT + i;
      const target = i < n ? i / n : P.off[j];
      if (P.vis[j] <= 0) P.off[j] = target;
      else P.off[j] += (target - P.off[j]) * Math.min(1, dt * 1.2);
      P.vis[j] = Math.max(0, Math.min(1, P.vis[j] + (i < n ? dt : -dt) * 3));
    }
  P.clock += dt * Math.max(0.05, k[1]);
  if (input.btnPressed && input.btnPressed[0]) {
    let l = P.pick++ % P.count;
    if (P.lines[l].loop) l = (l + 1) % P.count;
    P.express = { line: l, s: 0, dir: P.pick % 2 ? 1 : -1 };
    if (P.express.dir < 0) P.express.s = P.lines[l].total;
  }
  if (P.express) {
    const E = P.express;
    E.s += E.dir * dt * Math.max(0.05, k[1]) * TOP * 3.2;
    if (E.s < -40 || E.s > P.lines[E.line].total + 40) P.express = null;
  }
}

// Light a train from distance a to b along a line: each lattice point takes
// how much of it lies inside, so a train glides from LED to LED.
function paintTrain(P, L, a, b, w) {
  const tr = P.train;
  const n = L.xs.length;
  for (let k = 0; k < n; k++) {
    const s = L.ss[k];
    if (s < a - 1 || s > b + 1) continue;
    const c = Math.max(0, Math.min(1, s - a + 0.5)) * Math.max(0, Math.min(1, b - s + 0.5)) * w;
    if (c <= 0) continue;
    const x = L.xs[k];
    const y = L.ys[k];
    // A train is four LEDs wide, a lit carriage standing proud of its
    // two-LED line, a little dimmer at its sides.
    for (let j = 0; j < 16; j++) {
      const ox = (j & 3) - 1;
      const oy = (j >> 2) - 1;
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const v = ox < 0 || ox > 1 || oy < 0 || oy > 1 ? c * 0.7 : c;
      const p = yy * W + xx;
      if (tr[p] < v) tr[p] = v;
    }
  }
}

export function draw(display, params) {
  const P = params;
  const col = P.col;
  for (let l = 0; l < MAXL; l++) hsvInto(col, l * 3, P.lines[l].hue + P.hue + 0.02, 0.92, 1);
  const tr = P.train;
  tr.fill(0);
  const where = P.where;
  const TL = 6;
  for (let l = 0; l < P.count; l++) {
    const L = P.lines[l];
    for (const st of L.stops) st.lit = 0;
    if (l === 0) for (const I of P.inter) I.lit = 0;
    for (let i = 0; i < MAXT; i++) {
      const vis = P.vis[l * MAXT + i];
      if (vis <= 0) continue;
      trainAt(L, P.clock + (P.off[l * MAXT + i] + l * 0.41) * L.period, where);
      if (where.stop >= 0 && vis > 0.5) {
        const st = L.stops[where.stop];
        st.lit = 1;
        if (st.inter) P.inter[st.at].lit = 1;
      }
      paintTrain(P, L, where.s - TL / 2, where.s + TL / 2, vis);
      if (L.loop && where.s + TL / 2 > L.total) paintTrain(P, L, where.s - TL / 2 - L.total, where.s + TL / 2 - L.total, vis);
    }
  }
  if (P.express) {
    const E = P.express;
    const L = P.lines[E.line];
    paintTrain(P, L, E.s - 9 * (E.dir > 0 ? 1 : 0), E.s + 9 * (E.dir > 0 ? 0 : 1), 1);
    // Behind it the line stays lit for 30 LEDs, fading as it goes.
    for (let k = 0; k < L.xs.length; k++) {
      const back = (E.s - L.ss[k]) * E.dir - 9;
      if (back < 0 || back > 30) continue;
      const v = 0.8 * (1 - back / 30) ** 2;
      for (let j = 0; j < 4; j++) {
        const xx = L.xs[k] + (j & 1);
        const yy = L.ys[k] + (j >> 1);
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const p = yy * W + xx;
        if (tr[p] < v) tr[p] = v;
      }
    }
  }

  // Ticks and end bars take their line's colour, and light up while a train
  // stands at their station.
  const mark = P.mark;
  const glow = P.glow;
  mark.fill(0);
  for (let l = 0; l < P.count; l++)
    for (const st of P.lines[l].stops)
      for (const p of st.px) {
        mark[p] = l + 1;
        glow[p] = st.lit || 0;
      }
  const owner = P.owner;
  const river = P.river;
  const LINE = 0.75;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = owner[p];
      let r = 0;
      let g = 0;
      let b = 0;
      if (o) {
        const c = (o - 1) * 3;
        r = col[c] * LINE;
        g = col[c + 1] * LINE;
        b = col[c + 2] * LINE;
      } else if (mark[p]) {
        const c = (mark[p] - 1) * 3;
        const t = glow[p];
        r = col[c] * LINE * (1 - t) + t;
        g = col[c + 1] * LINE * (1 - t) + t;
        b = col[c + 2] * LINE * (1 - t) + t;
      } else if (river[p]) {
        r = 0.03;
        g = 0.11;
        b = 0.3;
      }
      const t = tr[p];
      if (t > 0) {
        r += (1 - r) * t;
        g += (1 - g) * t;
        b += (1 - b) * t;
      }
      display.setPixel(x, y, r * 255, g * 255, b * 255);
    }
  }

  // Interchanges: a white ring round each crossing, or round a pair of
  // crossings close together, dark inside until a train stands there.
  for (const I of P.inter) {
    const inside = I.lit ? 255 : 0;
    const x0 = Math.floor(Math.min(I.ax, I.bx) - 4);
    const x1 = Math.ceil(Math.max(I.ax, I.bx) + 4);
    const y0 = Math.floor(Math.min(I.ay, I.by) - 4);
    const y1 = Math.ceil(Math.max(I.ay, I.by) + 4);
    const dx = I.bx - I.ax;
    const dy = I.by - I.ay;
    const len2 = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const px = x + 0.5 - I.ax;
        const py = y + 0.5 - I.ay;
        const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
        const d = Math.hypot(px - t * dx, py - t * dy);
        if (d < 1.9) display.setPixel(x, y, inside, inside, inside);
        else if (d < 3.0) display.setPixel(x, y, 235, 235, 235);
      }
    }
  }
}
