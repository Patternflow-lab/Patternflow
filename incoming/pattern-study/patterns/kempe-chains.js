// ===== Patternflow pattern =====
// Title:   Kempe Chains
// Family:  cells
// Idea:    A map of drifting countries is kept four-coloured as their borders change: when a new border puts two neighbours in one colour, the country takes a free colour if one is left, and if all four surround it a Kempe chain of two colours lights up, shows its links from capital to capital and swaps its colours to free one.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kempe chains (Alfred Kempe, 1879; the gap found by Percy Heawood, 1890), four colour theorem (Kenneth Appel and Wolfgang Haken, 1976), pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Countries=15..40, Sizes=0..1
//
// Knob 1: Hue. Turns the four colours round the wheel together, a quarter apart: at 0 orange, green, azure and pink. At 0.25 each has moved on to the next, so every country wears another of the same four; at 0.5 orange and azure trade places, and so do green and pink.
// Knob 2: Speed. How fast the stirring carries the countries. At 2 a capital moves at up to 14 LEDs a second, and with 15 countries a new border appears 2 to 3 times a second, a quarter to a third of them between two countries of one colour; at 0.2 everything drifts ten times slower, at 3 half as fast again. A repair shows in the same time at any Speed: 0.2 s of glow, 0.5 s of cross-fade, 0.3 s to cool.
// Knob 3: Countries. How many countries share the panel, from 15 (each about 23 LEDs across) to 40 (about 14). With 15 there is a repair every 1.2 to 2 seconds and half of them or more need a chain; with 40 five or six a second, three in four with a chain.
// Knob 4: Sizes. At 0 every capital has the same weight and the map is a Voronoi diagram, its largest country under twice the area of its smallest. Turning it up makes it a power diagram whose weights spread: at 1 the largest is 8 times the smallest with 15 countries and 18 times with 40, and a big country can border eight or nine others.

const W = 64, H = 128, N = W * H, M = 40;
const { floor, min, max, abs, sqrt, sin, cos, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A repair as the panel shows it, in seconds whatever the Speed: the
// countries it touches glow, cross-fade to their new colours and cool.
const RISE = 0.2, CROSS = 0.5, FALL = 0.3, LIFE = RISE + CROSS + FALL;
// Where four countries nearly meet at a point, the LED grid lets the border
// between one pair and the border between the other flicker for a few
// frames. A border counts for this long (in drift seconds) after it was last
// seen, so the colouring is kept proper for both and a repair is not undone
// by the next frame.
const HOLD = 0.4;
// A capital's own wandering speed and the stirring's strength, in LEDs per
// drift second.
const V0 = 2, FLOW = 10;

export function setup(params) {
  const f = () => new Float32Array(M);
  params.s = {
    t: 0, clock: 0, n: 0, hue: 0, speed: 2, sizes: 0.06, started: false, plan: 0,
    x: f(), y: f(), vx: f(), vy: f(), th: f(), om: f(), u: f(), w: f(), r: f(),
    own: new Uint8Array(N), col: new Uint8Array(M).fill(255),
    // seen: drift time each pair last shared a border; cur: sharing one this frame; act: counts for the colouring.
    seen: new Float32Array(M * M).fill(-1e9), cur: new Uint8Array(M * M), act: new Uint8Array(M * M),
    area: f(), cx: f(), cy: f(), dy2: f(),
    // The colour each country fades from, how far into its repair it is, and how hard it glows.
    from: new Float32Array(M * 3), age: new Float32Array(M).fill(LIFE), gl: f(),
    pal: new Float32Array(12), fl: [0, 0], disp: new Float32Array(M * 3), ov: new Float32Array(N),
    mark: new Uint8Array(M), queue: new Int16Array(M),
    // Events still showing: chain links between capitals and the new border that started it.
    ev: [],
    stats: { frames: 0, proper: 0, repairs: 0, free: 0, swap1: 0, swap2: 0, local: 0, failed: 0, forget: 0, firstSwap: -1, chainSizes: 0 },
  };
}

function addSeed(S, i) {
  S.x[i] = 2 + Math.random() * (W - 4);
  S.y[i] = 2 + Math.random() * (H - 4);
  S.vx[i] = S.vy[i] = 0;
  S.th[i] = Math.random() * TAU;
  S.om[i] = 0.6 + 0.8 * Math.random();
  S.u[i] = Math.random() * 2 - 1;
  S.col[i] = 255;
  S.age[i] = 0;
  S.gl[i] = 0.3;
  S.from.fill(0.08, 3 * i, 3 * i + 3);
  for (let j = 0; j < M; j++) S.seen[i * M + j] = S.seen[j * M + i] = -1e9;
}

// The stirring: a stream function of four box modes whose strengths rise
// and fall out of step, so the map is sheared one way and then another and
// neighbours keep changing. A box mode never flows through the frame.
const MODES = [[1, 2, 0.21, 0], [2, 3, 0.17, 2.1], [1, 3, 0.13, 4.2], [2, 1, 0.11, 1.3]];
function flow(t, x, y, out) {
  let u = 0, v = 0;
  for (const [a, b, f, ph] of MODES) {
    const A = FLOW * cos(TAU * f * t + ph), ka = (PI * a) / W, kb = (PI * b) / H, k = 1 / max(ka, kb);
    u += A * k * kb * sin(ka * x) * cos(kb * y);
    v -= A * k * ka * cos(ka * x) * sin(kb * y);
  }
  out[0] = u;
  out[1] = v;
}

// Each capital wanders on a turning heading and is pushed off the others and
// the frame by its size. A capital's size r is half the distance it keeps to
// a neighbour; its power weight is r squared, so the border between two
// touching countries falls where their two sizes meet.
function move(S, ds, wander) {
  const n = S.n, A = N / n, { x, y, vx, vy, th, om, u, w, r } = S;
  for (let i = 0; i < n; i++) {
    const g = 1 + 0.82 * u[i] * S.sizes;
    r[i] = 0.58 * sqrt(A * g);
    w[i] = 0.3364 * A * (g - 1);
  }
  if (ds <= 0) return;
  for (let i = 0; i < n; i++) {
    let fx = 0, fy = 0;
    if (wander) {
      // The heading turns on two slow waves of the capital's own, so the
      // whole drift follows from where things are: the opening can look ahead.
      const a = th[i] + 1.6 * sin(0.53 * S.t * om[i] + 5 * th[i]) + 0.9 * sin(1.31 * S.t + 3 * om[i]);
      fx = V0 * cos(a);
      fy = V0 * sin(a);
      flow(S.t, x[i], y[i], S.fl);
      fx += S.fl[0];
      fy += S.fl[1];
    }
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = x[i] - x[j], dy = y[i] - y[j], d = sqrt(dx * dx + dy * dy) + 1e-6, rr = r[i] + r[j];
      if (d < rr) {
        const k = (3.5 * (rr - d)) / d;
        fx += dx * k;
        fy += dy * k;
      }
    }
    const m = 0.7 * r[i];
    if (x[i] < m) fx += 3.5 * (m - x[i]);
    if (x[i] > W - m) fx -= 3.5 * (x[i] - W + m);
    if (y[i] < m) fy += 3.5 * (m - y[i]);
    if (y[i] > H - m) fy -= 3.5 * (y[i] - H + m);
    const e = min(1, ds * 2.5);
    vx[i] += (fx - vx[i]) * e;
    vy[i] += (fy - vy[i]) * e;
  }
  for (let i = 0; i < n; i++) {
    x[i] = cl(x[i] + vx[i] * ds, 0.5, W - 0.5);
    y[i] = cl(y[i] + vy[i] * ds, 0.5, H - 0.5);
  }
}

// The map: every LED belongs to the capital of least power distance
// |p - c|^2 - w. Two countries share a border when two LEDs side by side
// (not only corner to corner) belong to them.
function map(S) {
  const n = S.n, { x, y, w, own, cur, seen, act, area, cx, cy, dy2 } = S;
  for (let y0 = 0, p = 0; y0 < H; y0++) {
    const py = y0 + 0.5;
    for (let i = 0; i < n; i++) dy2[i] = (py - y[i]) * (py - y[i]) - w[i];
    for (let x0 = 0; x0 < W; x0++, p++) {
      const px = x0 + 0.5;
      let best = 1e9, bi = 0;
      for (let i = 0; i < n; i++) {
        const dx = px - x[i], v = dx * dx + dy2[i];
        if (v < best) (best = v), (bi = i);
      }
      own[p] = bi;
    }
  }
  cur.fill(0);
  area.fill(0);
  cx.fill(0);
  cy.fill(0);
  for (let y0 = 0, p = 0; y0 < H; y0++)
    for (let x0 = 0; x0 < W; x0++, p++) {
      const o = own[p];
      area[o]++;
      cx[o] += x0 + 0.5;
      cy[o] += y0 + 0.5;
      if (x0 < W - 1 && own[p + 1] !== o) cur[o * M + own[p + 1]] = cur[own[p + 1] * M + o] = 1;
      if (y0 < H - 1 && own[p + W] !== o) cur[o * M + own[p + W]] = cur[own[p + W] * M + o] = 1;
    }
  for (let i = 0; i < n; i++) {
    if (area[i]) (cx[i] /= area[i]), (cy[i] /= area[i]);
    else (cx[i] = x[i]), (cy[i] = y[i]);
  }
  act.fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const k = i * M + j;
      if (cur[k]) seen[k] = S.t;
      if (i !== j && S.t - seen[k] < HOLD) act[k] = 1;
    }
}

// Colours used round country v, as four bits (uncoloured neighbours ignored).
function used(S, v) {
  let m = 0;
  for (let j = 0; j < S.n; j++) if (S.act[v * M + j] && S.col[j] < 4) m |= 1 << S.col[j];
  return m;
}

// The Kempe chain(s): every country reachable from the starts through
// countries coloured a or b, never through v. Marks them in S.mark and
// returns their indices.
function chain(S, v, starts, a, b) {
  const { mark, queue, col, act, n } = S;
  mark.fill(0);
  let h = 0, t = 0;
  for (const s of starts) if (!mark[s]) (mark[s] = 1), (queue[t++] = s);
  while (h < t) {
    const i = queue[h++];
    for (let j = 0; j < n; j++)
      if (j !== v && !mark[j] && act[i * M + j] && (col[j] === a || col[j] === b)) (mark[j] = 1), (queue[t++] = j);
  }
  return Array.from(queue.subarray(0, t));
}

const nbOf = (S, v, c) => {
  const out = [];
  for (let j = 0; j < S.n; j++) if (S.act[v * M + j] && S.col[j] === c) out.push(j);
  return out;
};

// One swap: for some pair of colours (a, b), the a/b chains through v's
// a-coloured neighbours reach none of its b-coloured ones, so swapping a and b
// on them leaves no a round v. Of the swaps that work, the one shown is the
// longest chain of up to five countries, then the shortest longer one; a
// chain of one country only when nothing else works.
function single(S, xs) {
  let best = null, score = 1e9;
  for (const v of xs)
    for (let a = 0; a < 4; a++) {
      const starts = nbOf(S, v, a);
      if (!starts.length) continue;
      for (let b = 0; b < 4; b++) {
        if (b === a) continue;
        const comp = chain(S, v, starts, a, b);
        let ok = true;
        for (let j = 0; j < S.n && ok; j++) if (S.mark[j] && S.col[j] === b && S.act[v * M + j]) ok = false;
        if (!ok) continue;
        const L = comp.length, sc = L === 1 ? 100 : L <= 5 ? 10 - L : 10 + L;
        if (sc < score) (score = sc), (best = { v, a, b, comp });
      }
    }
  return best;
}

function swap(S, comp, a, b) {
  for (const i of comp) S.col[i] = S.col[i] === a ? b : a;
}

// The colour a country shows now, part way through its repair.
function shown(S, i, out, o) {
  const e = ease((S.age[i] - RISE) / CROSS), c = S.col[i] < 4 ? S.col[i] : 0, p = S.pal;
  for (let k = 0; k < 3; k++) out[o + k] = S.from[3 * i + k] + (p[3 * c + k] - S.from[3 * i + k]) * e;
}

// Give i the colour c; on screen it glows by g and fades over from what it shows now.
function paint(S, i, c, show, g) {
  if (show) {
    shown(S, i, S.from, 3 * i);
    S.gl[i] = max(g, S.age[i] < LIFE ? S.gl[i] * 0.5 : 0);
    S.age[i] = 0;
  }
  S.col[i] = c;
  if (!show) {
    S.age[i] = LIFE;
    S.gl[i] = 0;
  }
}

function event(S, comp, v, a, b, show) {
  if (!show) return;
  // Links between capitals along the chain, and from v to the chain.
  const links = [];
  const inC = new Uint8Array(M);
  for (const i of comp) inC[i] = 1;
  for (const i of comp) for (const j of comp) if (i < j && S.act[i * M + j]) links.push(i, j);
  for (const j of comp) if (S.act[v * M + j]) links.push(v, j);
  S.ev.push({ links, age: 0, a, b });
}

// Repair the conflict on the border u-v (u -1: v is a new, uncoloured country).
function repair(S, u, v, show, last) {
  const st = S.stats, xs = u < 0 ? [v] : [v, u];
  if (show) st.repairs++;
  // A free colour.
  for (const x of xs) {
    const m = used(S, x);
    if (m !== 15) {
      const free = [];
      for (let c = 0; c < 4; c++) if (!(m & (1 << c))) free.push(c);
      paint(S, x, free[floor(Math.random() * free.length)], show, 0.28);
      if (show) st.free++, S.ev.push({ links: [], age: 0, a: u, b: v });
      return true;
    }
  }
  // One Kempe swap.
  let k = single(S, xs);
  if (k) {
    for (const i of k.comp) paint(S, i, S.col[i] === k.a ? k.b : k.a, show, 0.6);
    paint(S, k.v, k.a, show, 0.6);
    if (show) {
      st.swap1++;
      st.chainSizes += k.comp.length;
      if (st.firstSwap < 0) st.firstSwap = S.clock;
      event(S, k.comp, k.v, u, v, true);
    }
    return true;
  }
  // Two swaps, as Kempe argued for a country of five neighbours: the first
  // swap on any a/b chain through a neighbour, then one swap that works.
  for (const x of xs)
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        if (a === b) continue;
        for (const w of nbOf(S, x, a)) {
          const c1 = chain(S, x, [w], a, b);
          swap(S, c1, a, b);
          k = single(S, [x]);
          if (k) {
            swap(S, c1, a, b);
            for (const i of c1) paint(S, i, S.col[i] === a ? b : a, show, 0.6);
            for (const i of k.comp) paint(S, i, S.col[i] === k.a ? k.b : k.a, show, 0.6);
            paint(S, x, k.a, show, 0.6);
            if (show) {
              st.swap2++;
              if (st.firstSwap < 0) st.firstSwap = S.clock;
              event(S, c1.concat(k.comp), x, u, v, true);
            }
            return true;
          }
          swap(S, c1, a, b);
        }
      }
  // Neither worked (Heawood's case or worse). While remembered borders are in
  // the graph, the caller forgets them and asks again; on the map as it is, a
  // short local search: each step takes a country in conflict and gives it
  // the colour fewest of its neighbours have.
  if (!last) {
    if (show) st.repairs--;
    return false;
  }
  if (show) st.local++;
  const n = S.n, col = S.col.slice(0, n);
  for (let step = 0; step < 4000; step++) {
    const bad = [];
    for (let i = 0; i < n; i++) {
      if (S.area[i] === 0 && col[i] < 4) continue;
      if (col[i] > 3) {
        bad.push(i);
        continue;
      }
      for (let j = 0; j < n; j++) if (S.act[i * M + j] && col[j] === col[i]) {
        bad.push(i);
        break;
      }
    }
    if (!bad.length) {
      for (let i = 0; i < n; i++) if (col[i] !== S.col[i]) paint(S, i, col[i], show, 0.6);
      return true;
    }
    const i = bad[floor(Math.random() * bad.length)], cnt = [0, 0, 0, 0];
    for (let j = 0; j < n; j++) if (S.act[i * M + j] && col[j] < 4) cnt[col[j]]++;
    let bc = 0;
    if (Math.random() < 0.15) bc = floor(Math.random() * 4);
    else for (let c = 1; c < 4; c++) if (cnt[c] < cnt[bc] || (cnt[c] === cnt[bc] && Math.random() < 0.5)) bc = c;
    col[i] = bc;
  }
  if (show) st.failed++;
  return false;
}

function repairAll(S, show) {
  const n = S.n, col = S.col, act = S.act;
  for (let guard = 0, forgot = false; guard < 120; guard++) {
    let u = -1, v = -1;
    for (let i = 0; i < n && v < 0; i++) if (col[i] > 3 && S.area[i] > 0) v = i;
    for (let i = 0; i < n && v < 0; i++)
      for (let j = i + 1; j < n; j++)
        if (act[i * M + j] && col[i] === col[j]) {
          // Recolour the smaller of the two first.
          [u, v] = S.area[i] < S.area[j] ? [j, i] : [i, j];
          break;
        }
    if (v < 0) return;
    let mem = false;
    for (let k = 0; k < M * M && !mem; k++) if (act[k] && !S.cur[k]) mem = true;
    if (repair(S, u, v, show, forgot || !mem)) continue;
    // Kempe's moves found nothing on the graph with the remembered borders in
    // it, which need not be planar: two countries touched a moment ago that
    // no longer do, and the map has closed round them. Forget every border
    // not on the map now and repair again on the map as it is.
    if (forgot) return;
    forgot = true;
    if (show) S.stats.forget++;
    for (let k = 0; k < M * M; k++) if (!S.cur[k]) (S.seen[k] = -1e9), (act[k] = 0);
  }
}

// The opening. The drift is worked out 1.9 drift seconds ahead, and the first
// colouring is chosen so that one of the first six borders to appear after
// 0.6 s joins two countries of one colour, each already ringed by the other
// three colours: no free colour is left for either, so the first repair needs
// a chain. Borders that appear before it get proper colours from the start.
// If no such colouring turns up, the first new border at least joins one
// colour, and if there is none the map is coloured plainly.
function opening(S, ds) {
  const n = S.n, keep = [S.x, S.y, S.vx, S.vy].map((a) => a.slice()), t0 = S.t, G0 = S.cur.slice();
  const pre = S.cur.slice(), first = new Float32Array(M * M).fill(-1), acts = [];
  for (let k = 1; S.t < t0 + 1.9; k++) {
    move(S, ds, true);
    S.t += ds;
    map(S);
    acts.push(S.act.slice());
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) if (S.cur[i * M + j] && !G0[i * M + j] && first[i * M + j] < 0) first[i * M + j] = S.t - t0;
  }
  [S.x, S.y, S.vx, S.vy].forEach((a, i) => a.set(keep[i]));
  S.t = t0;
  S.seen.fill(-1e9);
  map(S);
  const cands = [];
  for (let k = 0; k < M * M; k++) if (first[k] >= 0.6) cands.push(k);
  cands.sort((a, b) => first[a] - first[b]);
  for (const k of cands.slice(0, 6)) {
    const c = floor(k / M), d = k % M, step = round(first[k] / ds) - 1, Gt = acts[min(acts.length - 1, step)];
    // Every border seen before this one must be proper from the start.
    pre.set(G0);
    for (let q = 0; q < M * M; q++) if (first[q] >= 0 && first[q] < first[k]) pre[q] = pre[(q % M) * M + floor(q / M)] = 1;
    for (let tries = 0; tries < 40; tries++) {
      if (!colourWith(S, pre, c, d)) break;
      let ok = true;
      for (const x of [c, d]) {
        let m = 0;
        for (let j = 0; j < n; j++) if (j !== c && j !== d && Gt[x * M + j]) m |= 1 << S.col[j];
        if ((m | (1 << S.col[c])) !== 15) ok = false;
      }
      if (ok) return first[k];
    }
  }
  // No such pair: at least let the first new border join one colour.
  if (cands.length && colourWith(S, G0, floor(cands[0] / M), cands[0] % M)) return -first[cands[0]];
  S.col.fill(255);
  return 0;
}

// A random proper colouring of the graph g with c and d given one colour, by
// backtracking over the countries in random order, most neighbours first.
function colourWith(S, g, c, d) {
  const n = S.n, col = S.col, order = [];
  for (let i = 0; i < n; i++) if (i !== d) order.push(i);
  const dg = new Float32Array(M);
  for (const i of order) {
    for (let j = 0; j < n; j++) dg[i] += g[i * M + j] + (i === c ? g[d * M + j] : 0);
    dg[i] += Math.random();
  }
  order.sort((a, b) => dg[b] - dg[a]);
  col.fill(255);
  let budget = 5000;
  const fits = (i, k) => {
    for (let j = 0; j < n; j++) if (col[j] === k && (g[i * M + j] || (i === c && g[d * M + j]))) return false;
    return true;
  };
  const go = (q) => {
    if (q === order.length) return true;
    if (--budget < 0) return false;
    const i = order[q], o = floor(Math.random() * 4);
    for (let e = 0; e < 4; e++) {
      const k = (o + e) % 4;
      if (!fits(i, k)) continue;
      col[i] = k;
      if (i === c) col[d] = k;
      if (go(q + 1)) return true;
    }
    col[i] = 255;
    if (i === c) col[d] = 255;
    return false;
  };
  return go(0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 15, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.sizes = cl(k[3], 0, 1);
  const n = round(cl(k[2], 15, 40)), ds = (d * S.speed) / 2;
  S.clock += d;
  for (let c = 0; c < 4; c++) hsv(S.hue + 0.075 + c / 4, 0.72, 0.92, S.pal, 3 * c);
  if (!S.started) {
    S.started = true;
    S.n = n;
    for (let i = 0; i < n; i++) addSeed(S, i);
    // Spread the capitals out before the first frame.
    for (let i = 0; i < 25; i++) move(S, 0.05, false);
    move(S, 0, true);
    map(S);
    S.plan = opening(S, (S.speed / 2) / 30);
    repairAll(S, false);
  } else {
    if (n > S.n) for (let i = S.n; i < n; i++) addSeed(S, i);
    S.n = n;
    move(S, ds, true);
    S.t += ds;
    map(S);
    repairAll(S, true);
  }
  // Count the frames whose map, as it is drawn, is properly four-coloured.
  const st = S.stats;
  let ok = true;
  for (let i = 0; i < S.n && ok; i++) {
    if (S.area[i] > 0 && S.col[i] > 3) ok = false;
    for (let j = i + 1; j < S.n; j++) if (S.cur[i * M + j] && S.col[i] === S.col[j]) ok = false;
  }
  st.frames++;
  if (ok) st.proper++;
  for (let i = 0; i < M; i++) S.age[i] = min(LIFE, S.age[i] + d);
  for (const e of S.ev) e.age += d;
  S.ev = S.ev.filter((e) => e.age < LIFE);
}

// A glow envelope over a repair's life: up in RISE, held, down in FALL.
const env = (a) => (a < RISE ? a / RISE : a > LIFE - FALL ? max(0, (LIFE - a) / FALL) : 1);
// Channels in steps of 4 of 255, so flat countries stay flat.
const q = (v) => (v <= 0 ? 0 : v >= 1 ? 252 : round(v * 63) * 4);

function line(ov, x0, y0, x1, y1, a) {
  const steps = max(1, round(max(abs(x1 - x0), abs(y1 - y0))));
  for (let s = 0; s <= steps; s++) {
    const px = floor(x0 + ((x1 - x0) * s) / steps), py = floor(y0 + ((y1 - y0) * s) / steps);
    if (px >= 0 && px < W && py >= 0 && py < H) ov[py * W + px] = max(ov[py * W + px], a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { own, disp, ov, cx, cy, gl, age } = S;
  for (let i = 0; i < S.n; i++) shown(S, i, disp, 3 * i);
  ov.fill(0);
  // The new border that started each repair flashes white; the chain's links run capital to capital.
  const flash = new Float32Array(M * M);
  for (const e of S.ev) {
    const a = env(e.age);
    if (e.a >= 0 && e.b >= 0) flash[e.a * M + e.b] = flash[e.b * M + e.a] = max(flash[e.a * M + e.b], a);
    const L = e.links;
    for (let i = 0; i < L.length; i += 2) {
      line(ov, cx[L[i]], cy[L[i]], cx[L[i + 1]], cy[L[i + 1]], a * 0.85);
      for (const j of [L[i], L[i + 1]])
        for (let dy = -1; dy <= 0; dy++)
          for (let dx = -1; dx <= 0; dx++) {
            const px = floor(cx[j]) + dx, py = floor(cy[j]) + dy;
            if (px >= 0 && px < W && py >= 0 && py < H) ov[py * W + px] = max(ov[py * W + px], a);
          }
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = own[p], r = x < W - 1 ? own[p + 1] : o, b = y < H - 1 ? own[p + W] : o;
      let R, G, B;
      if (r !== o || b !== o) {
        // A dark border LED, white while its border is the new one.
        const f = max(r !== o ? flash[o * M + r] : 0, b !== o ? flash[o * M + b] : 0);
        R = G = B = f;
        R += 0.07 * (1 - f);
        G += 0.05 * (1 - f);
        B += 0.09 * (1 - f);
      } else {
        const g = gl[o] * env(age[o]);
        R = disp[3 * o] + (1 - disp[3 * o]) * g;
        G = disp[3 * o + 1] + (1 - disp[3 * o + 1]) * g;
        B = disp[3 * o + 2] + (1 - disp[3 * o + 2]) * g;
      }
      const v = ov[p];
      if (v > 0) {
        R += (1 - R) * v;
        G += (1 - G) * v;
        B += (1 - B) * v;
      }
      display.setPixel(x, y, q(R), q(G), q(B));
    }
}
