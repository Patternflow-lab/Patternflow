// ===== Patternflow pattern =====
// Title:   Cayley Tables
// Family:  data
// Idea:    The multiplication tables of two groups of the same order are dealt onto the panel one above the other, each element its own hue and the identity cream, so every table is a Latin square, and a cycle then flashes the diagonal g*g, splits every cell where g*h differs from h*g, lights one element at a time, and slides rows and columns into the cosets of a subgroup until the table breaks into blocks.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the group multiplication table (Arthur Cayley, 1854, who gave the first abstract definition of a group) and Lagrange's theorem on subgroup order (Joseph-Louis Lagrange, 1771), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..3, Pair=0..9, Subgroup=0..4
//
// Knob 1: Hue. Turns the wheel the elements are coloured from: element 1 starts at hue 0.03 + K1 and the others follow round nine tenths of the wheel in the order the table lists them, placed by eye so that orange, yellow, green, cyan, blue, violet and magenta come in turn (equal steps give one green a third of the wheel). The identity is always cream, and the hues step on by 0.173 each cycle.
// Knob 2: Speed. How fast the cycle runs. At 2 the first cell is dealt at 0.15 s and the deal ends at 4.1 s, the diagonal takes 2.6 s for D4 and Q8, the split of g*h against h*g 3.8 s, the solo 0.34 s an element, and each subgroup stage 3.6 s, so D4 and Q8 go round in 24.6 s, Z9 and Z3xZ3 in 20.5 s and A4 and D6 in 32.2 s. 0.5 is four times slower, 3 half as fast again.
// Knob 3: Pair. Snaps to a pair of groups of one order, stacked in the panel: 0 D4 and Q8, 1 Z8 and Z2^3, 2 Z6 and S3, 3 Z9 and Z3xZ3, 4 Z10 and D5, 5 A4 and D6, 6 Z12 and Dic3, 7 Z4xZ2 and D4, 8 Z6xZ2 and A4, 9 Z8 and Q8. A cell is 9 LEDs wide at order 6, 6 at order 8, 5 at orders 9 and 10 and 4 at order 12, with a 1 LED gap.
// Knob 4: Subgroup. At 0 the rows and columns stay in table order through the deal, the diagonal, the split and the solo, then slide into the cosets of a subgroup of each order d that divides n between 2 and n - 1 (2 and 4 at order 8, 2, 3, 4 and 6 at order 12), one stage after another, and slide back. At 1 to 4 the table is held sorted by the 1st to 4th of those subgroups, or the last when a group has fewer, from the deal on, and turning the knob slides rows and columns across to the next. A4 has no subgroup of order 6 and shakes where the others sort.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, exp, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const bump = (x, w) => (x <= 0 || x >= w ? 0 : sin((PI * x) / w));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// ---- the groups, built from their definitions --------------------------
// A group is a list of elements, identity first, and a product on them. The
// table is mul[a * n + b], the index of a * b, and build() throws if a
// product falls outside the list.
function build(elems, op, key) {
  const n = elems.length, at = new Map(elems.map((e, i) => [key(e), i])), mul = new Uint8Array(n * n);
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      const c = at.get(key(op(elems[a], elems[b])));
      if (c === undefined) throw new Error("not closed");
      mul[a * n + b] = c;
    }
  return { n, mul };
}
const range = (m) => Array.from({ length: m }, (_, i) => i);
const cyc = (m) => build(range(m), (a, b) => (a + b) % m, String);
// Direct product of cyclic groups: vectors in table order, added by digit.
const prod = (...r) => {
  let v = [[]];
  for (const m of r) v = v.flatMap((p) => range(m).map((x) => [...p, x]));
  return build(v, (a, b) => a.map((x, i) => (x + b[i]) % r[i]), String);
};
// Permutations compose as (a * b)[i] = a[b[i]].
const compose = (a, b) => b.map((i) => a[i]);
const dihedral = (m) => {
  const r = range(m).map((i) => (i + 1) % m), s = range(m).map((i) => (m - i) % m), rot = [range(m)];
  for (let k = 1; k < m; k++) rot.push(compose(r, rot[k - 1]));
  return build([...rot, ...rot.map((p) => compose(s, p))], compose, String);
};
// The even permutations of four points, in dictionary order.
const alt4 = () => {
  const all = [];
  const go = (p, left) => {
    if (!left.length) all.push(p);
    left.forEach((x) => go([...p, x], left.filter((y) => y !== x)));
  };
  go([], [0, 1, 2, 3]);
  const even = (p) => p.reduce((s, x, i) => s + p.slice(i + 1).filter((y) => y < x).length, 0) % 2 === 0;
  return build(all.filter(even), compose, String);
};
// The unit quaternions 1, i, j, k, -1, -i, -j, -k as integer 4-vectors.
const quat = () => {
  const u = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const mulq = ([a, b, c, d], [e, f, g, h]) => [a * e - b * f - c * g - d * h, a * f + b * e + c * h - d * g, a * g - b * h + c * e + d * f, a * h + b * g - c * f + d * e];
  return build([...u, ...u.map((v) => v.map((x) => -x))], mulq, (v) => v.map((x) => x + 0).join());
};
// Dic3 = <a, x | a^6 = 1, x^2 = a^3, x a x^-1 = a^-1>, elements a^k x^s.
const dic3 = () => {
  const e = [];
  for (let s = 0; s < 2; s++) for (let k = 0; k < 6; k++) e.push([k, s]);
  const op = ([k, s], [l, t]) => [(((k + (s ? -l : l) + (s + t === 2 ? 3 : 0)) % 6) + 6) % 6, (s + t) % 2];
  return build(e, op, String);
};
const MAKE = {
  Z6: () => cyc(6), S3: () => dihedral(3), Z8: () => cyc(8), "Z4xZ2": () => prod(4, 2), "Z2^3": () => prod(2, 2, 2), D4: () => dihedral(4), Q8: quat,
  Z9: () => cyc(9), "Z3xZ3": () => prod(3, 3), Z10: () => cyc(10), D5: () => dihedral(5),
  Z12: () => cyc(12), "Z6xZ2": () => prod(6, 2), A4: alt4, D6: () => dihedral(6), Dic3: dic3,
};
const PAIRS = [["D4", "Q8"], ["Z8", "Z2^3"], ["Z6", "S3"], ["Z9", "Z3xZ3"], ["Z10", "D5"], ["A4", "D6"], ["Z12", "Dic3"], ["Z4xZ2", "D4"], ["Z6xZ2", "A4"], ["Z8", "Q8"]];
// LEDs from one cell to the next, and a cell's side, by order.
const LAYOUT = { 6: [10, 9], 8: [7, 6], 9: [6, 5], 10: [6, 5], 12: [5, 4] };

// Every subgroup, found as the closure of two elements (every group above
// needs no more for its proper subgroups), and for each divisor d of n
// between 2 and n - 1 the one the table sorts by: a normal subgroup when
// there is one, else the first. Rows go in left cosets aH and columns in
// right cosets Ha, each coset in table order, so that the block of the
// cosets aH and Hb holds only the |H| products a H b, and the first block
// is the table of H itself.
function analyse(G) {
  const { n, mul } = G;
  const inv = range(n).map((a) => range(n).find((b) => mul[a * n + b] === 0));
  const close = (gens) => {
    const s = new Set([0, ...gens]);
    for (let grow = true; grow; ) {
      grow = false;
      for (const a of [...s]) for (const b of [...s]) if (!s.has(mul[a * n + b])) (s.add(mul[a * n + b]), (grow = true));
    }
    return [...s].sort((x, y) => x - y);
  };
  const seen = new Map();
  for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
    const h = close([a, b]);
    seen.set(h.join(), h);
  }
  const subs = [...seen.values()];
  const normal = (h) => range(n).every((g) => h.every((u) => h.includes(mul[mul[g * n + u] * n + inv[g]])));
  const order = (left, h) => {
    const done = new Uint8Array(n), o = [];
    for (let a = 0; a < n; a++) {
      if (done[a]) continue;
      for (const x of h.map((u) => (left ? mul[a * n + u] : mul[u * n + a])).sort((p, q) => p - q)) (done[x] = 1), o.push(x);
    }
    const slot = new Array(n);
    o.forEach((x, i) => (slot[x] = i));
    return slot;
  };
  const stages = [];
  for (let d = 2; d < n; d++) {
    if (n % d) continue;
    const c = subs.filter((h) => h.length === d), h = c.find(normal) || c[0];
    stages.push(h ? { d, h, normal: normal(h), rows: order(true, h), cols: order(false, h) } : { d, h: null });
  }
  // The squares g * g, their distinct colours most common first.
  const sq = range(n).map((g) => mul[g * n + g]), cnt = new Map();
  sq.forEach((c) => cnt.set(c, (cnt.get(c) || 0) + 1));
  const cls = [...cnt.keys()].sort((a, b) => cnt.get(b) - cnt.get(a) || a - b);
  return { stages, sqClass: sq.map((c) => cls.indexOf(c)), nClass: cls.length };
}

// The cycle, in cycle seconds: the deal, the diagonal, the split, the solo of
// each element, the subgroup stages (tour only), the way back, the wipe.
const SD = 3.6;
const DEAL0 = 0.7, DEALD = 2.8;
function planFor(T, hold) {
  const n = T[0].G.n, p = {};
  p.diag = DEAL0 + DEALD + 0.5;
  // The squares are flashed a colour at a time only when there are few colours.
  const nc = max(T[0].A.nClass, T[1].A.nClass);
  const dd = 0.12 * n + 0.15 + (nc <= 5 ? 0.5 * nc : 0) + 0.3;
  p.comm = p.diag + dd + 0.2;
  p.solo = p.comm + 3.8;
  p.dk = n > 9 ? 0.3 : 0.34;
  p.sort = p.solo + 0.9 + n * p.dk + 0.3;
  p.nS = hold ? 0 : T[0].A.stages.length;
  p.back = p.sort + p.nS * SD;
  p.wipe = p.back + (hold ? 0.2 : 1.6);
  p.end = p.wipe + 1.5;
  return p;
}

function newTable(name, slotY) {
  const G = MAKE[name](), A = analyse(G), n = G.n;
  const [pitch, cell] = LAYOUT[n];
  return {
    name, G, A, n, pitch, cell, slotY,
    rp: new Float32Array(n), cp: new Float32Array(n), rt: new Float32Array(n), ct: new Float32Array(n), rd: new Float32Array(n), cd: new Float32Array(n),
    st: [], arr: -2,
  };
}

// Points the rows and columns at the cosets of stage s (-1 for table order),
// each row setting off a little after the one before, and starts that
// stage's block lines fading in while the last one's fade out.
function arrange(T, s, instant) {
  const stage = s >= 0 ? T.A.stages[s] : null, st = stage && stage.h ? stage : null, n = T.n;
  const key = st ? s : -1;
  if (key === T.arr) return;
  T.arr = key;
  for (let g = 0; g < n; g++) {
    T.rt[g] = st ? st.rows[g] : g;
    T.ct[g] = st ? st.cols[g] : g;
    T.rd[g] = T.cd[g] = instant ? 0 : 0.045 * g;
    if (instant) (T.rp[g] = T.rt[g]), (T.cp[g] = T.ct[g]);
  }
  for (const q of T.st) q.on = false;
  if (st) {
    const nb = n / st.d, ex = cl(floor((62 - (n * T.pitch - 1)) / (nb - 1)), 0, 2);
    T.st.push({ dH: st.d, ex, f: instant ? 1 : 0, on: true });
  }
}

function setPair(S, idx) {
  const [a, b] = PAIRS[idx];
  S.pair = idx;
  S.T = [newTable(a, 0), newTable(b, 64)];
  S.hold = S.m > 0;
  S.tau = 0;
  S.cycle = 0;
  S.plan = planFor(S.T, S.hold);
  S.palN = -1;
  for (const T of S.T) arrange(T, targetStage(S, T), true);
}

// The stage a table sorts by at this moment of the cycle, or -1.
function targetStage(S, T) {
  const nS = T.A.stages.length;
  if (S.m > 0) return min(S.m, nS) - 1;
  const p = S.plan, t = S.tau;
  if (t < p.sort || t >= p.back) return -1;
  return min(nS - 1, floor((t - p.sort) / SD));
}

export function setup(params) {
  params.s = { T: null, m: 0, pair: -1, tau: 0, cycle: 0, hue: 0, speed: 2, pal: new Float32Array(36), palKey: -1, buf: new Uint8Array(W * H * 3), plan: null, hold: false };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 3);
  const pair = round(cl(k[2], 0, PAIRS.length - 1)), m = round(cl(k[3], 0, 4));
  S.m = m;
  if (pair !== S.pair) setPair(S, pair);
  const hold = m > 0;
  if (hold !== S.hold) {
    S.hold = hold;
    S.plan = planFor(S.T, hold);
    // The cycle without the subgroup stages is shorter: a cycle seconds
    // past its wipe start would jump, so join it at the wipe.
    if (S.tau > S.plan.wipe) S.tau = S.plan.wipe;
    if (!hold && S.tau > S.plan.sort && S.tau < S.plan.back) S.tau = S.plan.sort;
  }
  const dc = (d * S.speed) / 2;
  S.tau += dc;
  if (S.tau >= S.plan.end) {
    S.tau -= S.plan.end;
    S.cycle++;
  }
  for (const T of S.T) {
    arrange(T, targetStage(S, T), false);
    const n = T.n, a = 1 - exp(-dc * 7);
    for (let g = 0; g < n; g++) {
      if (T.rd[g] > 0) T.rd[g] -= dc;
      else T.rp[g] += (T.rt[g] - T.rp[g]) * a;
      if (T.cd[g] > 0) T.cd[g] -= dc;
      else T.cp[g] += (T.ct[g] - T.cp[g]) * a;
    }
    for (const q of T.st) q.f += ((q.on ? 1 : 0) - q.f) * (1 - exp(-dc * 4));
    T.st = T.st.filter((q) => q.on || q.f > 0.01);
  }
}

// Where slot s starts, in LEDs from the table's own origin: a cell pitch
// each, and the stretch of every block line the table is showing.
function off(T, s) {
  let o = 0;
  for (const q of T.st) {
    let a = 0;
    for (let b = 1; b * q.dH < T.n; b++) a += sm(s - (b * q.dH - 1));
    o += q.ex * q.f * a;
  }
  return o;
}

// Equal steps round the wheel look unequal on the panel, where one green
// takes a third of it. These ten hues sit where red, orange, yellow, green,
// cyan, azure, blue, violet, magenta and red again read as evenly spaced, and
// the elements are spread over them.
const WARP = [0, 0.075, 0.15, 0.32, 0.5, 0.58, 0.66, 0.76, 0.87, 1];
const warp = (u) => {
  const x = cl(u, 0, 1) * 9, i = min(8, floor(x));
  return WARP[i] + (WARP[i + 1] - WARP[i]) * (x - i);
};

function palette(S) {
  const n = S.T[0].n, base = 0.03 + S.hue + S.cycle * 0.173, pal = S.pal;
  pal[0] = 255;
  pal[1] = 244;
  pal[2] = 214;
  for (let i = 1; i < n; i++) hsv(base + warp((0.9 * (i - 1)) / (n - 2)), 1, 1, pal, i * 3);
  S.palKey = S.hue + S.cycle * 7;
}

function hash(a, b) {
  let h = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 255) / 255;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  if (S.palKey !== S.hue + S.cycle * 7) palette(S);
  const { buf, pal, plan: P } = S, t = S.tau;
  buf.fill(0);
  const put = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  };
  S.T.forEach((T, ti) => {
    const { n, G, A, cell, pitch } = T, mul = G.mul;
    const total = (n - 1) * pitch + cell + off(T, n - 1), left = floor((W - total) / 2), top = T.slotY + floor((64 - total) / 2);
    const px = (s) => left + s * pitch + off(T, s), py = (s) => top + s * pitch + off(T, s);
    // A table with no subgroup of the stage's order shakes instead of sorting.
    let jig = 0;
    if (S.m === 0 && t >= P.sort && t < P.back) {
      const st = floor((t - P.sort) / SD), stage = T.A.stages[min(st, T.A.stages.length - 1)];
      if (!stage.h) {
        const u = (t - P.sort - st * SD - 1.4) / 1.2;
        if (u > 0 && u < 1) jig = 0.25 * (1 - u) * sin(u * 18);
      }
    }
    const rows = [], cols = [];
    for (let g = 0; g < n; g++) {
      rows.push(round(top + (T.rp[g] + (g & 1 ? jig : -jig)) * pitch + off(T, T.rp[g] + (g & 1 ? jig : -jig)) - 0));
      cols.push(round(left + (T.cp[g] + (g & 1 ? -jig : jig)) * pitch + off(T, T.cp[g] + (g & 1 ? -jig : jig))));
    }
    const moving = (g, h) => abs(T.rt[g] - T.rp[g]) > 0.06 || abs(T.ct[h] - T.cp[h]) > 0.06;
    for (let pass = 0; pass < 2; pass++)
      for (let g = 0; g < n; g++)
        for (let h = 0; h < n; h++) {
          if (moving(g, h) !== (pass === 1)) continue;
          const e = mul[g * n + h], f = mul[h * n + g];
          const kp = (T.rp[g] + T.cp[h]) / (2 * n - 2);
          // The deal runs down the anti-diagonals, slow at first and then
          // faster, and the wipe takes the cells off in the same order.
          const td = kp < 0.001 ? 0.15 : DEAL0 + DEALD * pow(kp, 0.42) + 0.1 * hash(g, h) + 0.08 * ti;
          const a = cl((t - td) / 0.4, 0, 1);
          if (a <= 0) continue;
          let bright = 1, white = (1 - a) * 0.9, size = cell * sm(a * 1.4);
          const wp = cl((t - P.wipe - 0.8 * kp) / 0.3, 0, 1);
          if (wp >= 1) continue;
          bright *= 1 - wp;
          size *= 1 - wp * 0.5;
          // The diagonal: each g * g flashes in turn, then the cells that
          // share a square flash together, the commonest square first.
          if (g === h && t > P.diag - 0.2 && t < P.comm) {
            const u = t - P.diag;
            white = max(white, 0.85 * bump(u - 0.12 * g, 0.45), A.nClass <= 5 && T.G.n ? 0.85 * bump(u - 0.12 * n - 0.15 - 0.5 * A.sqClass[g], 0.55) : 0);
          }
          // The split: the lower triangle of a cell takes the colour of the
          // mirror cell, h * g, so a cell where the two differ shows two.
          let lower = e, ff = 0;
          if (t > P.comm - 0.2 && t < P.solo) {
            const u = t - P.comm, fl = 0.8 * kp * 2;
            const q = cl((u - fl) / 0.3, 0, 1) - cl((u - 2.9 - 0.7 * kp) / 0.3, 0, 1);
            if (e !== f) {
              if (q > 0.5) lower = f;
              white = max(white, 0.6 * bump(q, 1));
              ff = q;
            } else white = max(white, 0.25 * bump(u - fl, 0.35));
          }
          // The solo: one element at a time shines and the rest sink.
          if (t > P.solo - 0.1 && t < P.sort) {
            const u = t - P.solo, env = cl(u / 0.3, 0, 1) - cl((u - 0.3 - n * P.dk) / 0.3, 0, 1), ka = floor((u - 0.3) / P.dk);
            const act = e === ka ? 1 : 0;
            bright *= 1 - 0.78 * env * (1 - act);
            white = max(white, 0.3 * env * act);
          }
          const x0 = cols[h], y0 = rows[g], sz = max(1, round(size)), o = floor((cell - sz) / 2);
          const c1 = e * 3, c2 = lower * 3;
          for (let v = 0; v < sz; v++)
            for (let u = 0; u < sz; u++) {
              const c = ff > 0 && u < v ? c2 : c1;
              const wh = ff > 0 && u === v ? 0.25 : white;
              put(x0 + o + u, y0 + o + v, ((pal[c] * (1 - wh) + 255 * wh) * bright) | 0, ((pal[c + 1] * (1 - wh) + 255 * wh) * bright) | 0, ((pal[c + 2] * (1 - wh) + 255 * wh) * bright) | 0);
            }
        }
    // Block lines run in the gap between two cosets, the first in gold: the
    // first block is the table of the subgroup.
    // The lines come in once the deal is done and go with the wipe.
    const la = sm((t - DEAL0 - DEALD) / 0.6) * (1 - sm((t - P.wipe) / 0.6));
    if (la > 0)
      for (const q of T.st) {
        if (q.f < 0.03) continue;
        const nb = n / q.dH, y1 = round(py(0)), y2 = round(py(n - 1)) + cell - 1, x1 = round(px(0)), x2 = round(px(n - 1)) + cell - 1;
        for (let b = 1; b < nb; b++) {
          const s = b * q.dH, ca = px(s - 1) + cell - 1, cb = px(s), ra = py(s - 1) + cell - 1, rb = py(s);
          const lx = round((ca + cb) / 2), ly = round((ra + rb) / 2), gold = b === 1;
          const w = q.f * la * (gold ? 0.9 : 0.55), r = (gold ? 255 : 190) * w, g = 190 * w, bl = (gold ? 40 : 205) * w;
          for (let y = y1; y <= y2; y++) put(lx, y, r, g, bl);
          for (let x = x1; x <= x2; x++) put(x, ly, r, g, bl);
        }
      }
  });
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
