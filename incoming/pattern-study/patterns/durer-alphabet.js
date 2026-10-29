// ===== Patternflow pattern =====
// Title:   Dürer's Alphabet
// Family:  type
// Idea:    Two ruled squares stand one above the other, and in each in turn a Roman capital is constructed by Dürer's method, its stems a tenth of the square, a travelling pen ruling the stem edges and sweeping compass arcs for the bowls and serif brackets, then ivory ink runs through the body, the paper lights up around it, and the plate holds while the next letter is drawn in the other square.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Roman capitals constructed with ruler and compass in a square, Underweysung der Messung (Albrecht Dürer, 1525), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Letter=0..12, Stem=0.1..0.2
//
// Knob 1: Hue. Turns the plate round the wheel: at 0 the ink is ivory, the construction lines pale teal and the paper deep blue; at 0.5 the ink is pale blue, the lines salmon and the paper dark amber.
// Knob 2: Speed. At 2 a letter takes 8 s: 4 s of ruler and compass, 1.6 s for the ink to run through the body, 1 s for the paper, so each finished plate stands about 9 s. At 0.2 it is ten times slower.
// Knob 3: Letter. Which of the thirteen capitals A C D E H I L M N O T V X comes first; the rest follow in that order and wrap round. At 0 the panel opens on a finished A with the C being ruled below it.
// Knob 4: Stem. The thick stroke as a share of the square's side. At 0.1 it is Dürer's tenth, 5.9 LEDs; at 0.2 the letters are twice as heavy, and the thin strokes, the serif brackets and the bowls' counters follow.

const W = 64, H = 128, SH = 64, NL = 4096;
const { floor, round, min, max, sqrt, sin, cos, tan, acos, atan2, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The square. Each sheet is 64 rows; its square runs from LED centre
// 2.5 to 61.5, so the outline sits on whole LEDs and the side is 59. Letters
// are written in units of a tenth of the side (u right, v down, 0..10): one
// unit is 5.9 LEDs, and at Stem 0.1 one unit is the thick stroke, the
// proportion Dürer gives. The thin stroke is a third of the thick one, which
// is how Alan Hoenig's METAFONT reading of the rules has it (TUGboat 11:3).
// The centres of the bowls and the serif brackets are this pattern's own.
const S0 = 2.5, UN = 5.9;
const toX = (u) => S0 + u * UN;

// Clip the infinite line through a and b to the square: a ruler line.
function ruled(a, b) {
  const d = [b[0] - a[0], b[1] - a[1]];
  let t0 = -1e9, t1 = 1e9;
  for (let k = 0; k < 2; k++) {
    if (abs(d[k]) < 1e-9) continue;
    const p = (0 - a[k]) / d[k], q = (10 - a[k]) / d[k];
    t0 = max(t0, min(p, q));
    t1 = min(t1, max(p, q));
  }
  return { k: 0, a: [a[0] + d[0] * t0, a[1] + d[1] * t0], b: [a[0] + d[0] * t1, a[1] + d[1] * t1] };
}

// ---- The capitals. Each is a union of convex polygons (k 0), rings (k 1:
// inside one disk, outside its hole disks, on the right side of its clip
// lines) and serif brackets (k 2: the kite between the corner, the two
// tangent points and the compass centre, less the compass disk). Building a
// letter also lists its construction: ruler lines (k 0) and compass arcs
// (k 1), in the order they are drawn.
function build(ch, w) {
  const t = w / 3, r = 0.6 + 0.25 * w, P = [], G = [], ends = new Set();
  const poly = (pts) => P.push({ k: 0, pts });
  const edgeAt = (e, v) => e[0][0] + ((e[1][0] - e[0][0]) * (v - e[0][1])) / (e[1][1] - e[0][1]);
  const hwOf = (dx, th) => (th / 2) * sqrt(dx * dx + 100) / 10;
  // A straight stroke over the full height: centre ut on the cap line, ub on
  // the base line, th thick across. Thick ones are ruled along both edges,
  // thin ones along the middle.
  const stroke = (ut, ub, th, v0 = 0, v1 = 10) => {
    const hw = (th / 2) * sqrt((ub - ut) ** 2 + (v1 - v0) ** 2) / (v1 - v0);
    const s = { L: [[ut - hw, v0], [ub - hw, v1]], R: [[ut + hw, v0], [ub + hw, v1]], c: [[ut, v0], [ub, v1]] };
    poly([s.L[0], s.R[0], s.R[1], s.L[1]]);
    if (th > 0.6 * w) G.push(ruled(s.L[0], s.L[1]), ruled(s.R[0], s.R[1]));
    else G.push(ruled(s.c[0], s.c[1]));
    return s;
  };
  // A horizontal thin bar, ruled along its middle.
  const bar = (u0, u1, v0, v1) => {
    poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    G.push(ruled([0, (v0 + v1) / 2], [10, (v0 + v1) / 2]));
  };
  // A serif on stroke s: end 1 its foot on the base line, 0 its head on the
  // cap line; sides 1 left, 2 right, 3 both. A thin bar runs along the line
  // and a quarter-round bracket joins it to each edge. On a slanted stroke
  // the acute side's bracket comes out longer, tangent length r / tan(half
  // the angle).
  const serif = (s, end, sides) => {
    const vb = end ? s.L[1][1] : s.L[0][1], vq = end ? vb - t : vb + t;
    let bl = max(edgeAt(s.L, vb), edgeAt(s.L, vq)), br = min(edgeAt(s.R, vb), edgeAt(s.R, vq));
    for (let side = 0; side < 2; side++) {
      if (!(sides & (side + 1))) continue;
      const e = side ? s.R : s.L, p = [edgeAt(e, vq), vq], d1 = [side ? 1 : -1, 0];
      let d2 = end ? [e[0][0] - e[1][0], e[0][1] - e[1][1]] : [e[1][0] - e[0][0], e[1][1] - e[0][1]];
      const n = Math.hypot(d2[0], d2[1]);
      d2 = [d2[0] / n, d2[1] / n];
      // A very acute corner would throw the bracket far out, so its
      // tangent length stops at 1.9 units and the radius shrinks to match.
      const h = acos(cl(d1[0] * d2[0] + d1[1] * d2[1], -1, 1)) / 2, tl = min(r / tan(h), 1.9), rr = tl * tan(h), pc = tl / cos(h);
      const bx = d1[0] + d2[0], by = d1[1] + d2[1], bn = Math.hypot(bx, by);
      const c = [p[0] + (bx / bn) * pc, p[1] + (by / bn) * pc], T1 = [p[0] + d1[0] * tl, p[1]], T2 = [p[0] + d2[0] * tl, p[1] + d2[1] * tl];
      P.push({ k: 2, kite: [p, T1, c, T2], c, r: rr });
      const a1 = atan2(T1[1] - c[1], T1[0] - c[0]);
      let da = atan2(T2[1] - c[1], T2[0] - c[0]) - a1;
      da -= 2 * PI * round(da / (2 * PI));
      G.push({ k: 1, c, r: rr, a0: a1, a1: a1 + da });
      if (side) br = T1[0];
      else bl = T1[0];
    }
    poly([[bl, min(vb, vq)], [br, min(vb, vq)], [br, max(vb, vq)], [bl, max(vb, vq)]]);
    ends.add(end);
  };
  const circ = (c, R) => G.push({ k: 1, c, r: R, a0: -PI / 2, a1: 1.5 * PI });
  // The O and the C: a disk of radius 5 less two disks of radius 5 - w whose
  // centres sit w - t either side of the middle along an axis leaning 20
  // degrees to the left, so the ring is t thick at 11 and 5 o'clock and w
  // thick at 2 and 8.
  const ring = (clip) => {
    const e = w - t, ax = [-sin(0.35), -cos(0.35)], h1 = [5 + ax[0] * e, 5 + ax[1] * e, 5 - w], h2 = [5 - ax[0] * e, 5 - ax[1] * e, 5 - w];
    P.push({ k: 1, o: [5, 5, 5], h: [h1, h2], clip });
    G.push(ruled([5 - ax[0] * 5, 5 - ax[1] * 5], [5 + ax[0] * 5, 5 + ax[1] * 5]));
    circ([5, 5], 5), circ([h1[0], h1[1]], h1[2]), circ([h2[0], h2[1]], h2[2]);
  };
  let s, s2;
  switch (ch) {
    case "A": {
      const kt = 5.2, kh = hwOf(3.2, w), ut = kt - kh + hwOf(-3.4, t);
      s2 = stroke(ut, 1.6, t), s = stroke(kt, 8.4, w);
      const v0 = 6.3, v1 = 6.3 + t, at = (e, v) => edgeAt(e, v);
      poly([[at(s2.c, v0), v0], [at(s.c, v0), v0], [at(s.c, v1), v1], [at(s2.c, v1), v1]]);
      G.push(ruled([0, v0 + t / 2], [10, v0 + t / 2]));
      serif(s2, 1, 3), serif(s, 1, 3);
      break;
    }
    case "C":
      ring([[-1, 0, 8.6]]);
      break;
    case "D": {
      s = stroke(1.4 + w / 2, 1.4 + w / 2, w);
      const c = 4.4, hc = 9.4 - w - (5 - t);
      bar(1.4 + w, c, 0, t), bar(1.4 + w, c, 10 - t, 10);
      P.push({ k: 1, o: [c, 5, 5], h: [[hc, 5, 5 - t]], clip: [[1, 0, -c]] });
      circ([c, 5], 5), circ([hc, 5], 5 - t);
      serif(s, 0, 1), serif(s, 1, 1);
      break;
    }
    case "E": {
      const x = 1.6 + w;
      s = stroke(1.6 + w / 2, 1.6 + w / 2, w);
      bar(x, 8.2, 0, t), bar(x, 7.4, 4.85 - t / 2, 4.85 + t / 2), bar(x, 8.6, 10 - t, 10);
      poly([[8.2 - t, 0], [8.2, 0], [8.2, 1.8], [8.2 - t, 1.8]]);
      poly([[7.4 - t, 4.15], [7.4, 4.15], [7.4, 5.55], [7.4 - t, 5.55]]);
      poly([[8.6 - t, 8.2], [8.6, 8.2], [8.6, 10], [8.6 - t, 10]]);
      serif(s, 0, 1), serif(s, 1, 1);
      break;
    }
    case "H":
      s = stroke(1.5 + w / 2, 1.5 + w / 2, w), s2 = stroke(8.5 - w / 2, 8.5 - w / 2, w);
      bar(1.5 + w, 8.5 - w, 4.7, 4.7 + t);
      serif(s, 0, 3), serif(s, 1, 3), serif(s2, 0, 3), serif(s2, 1, 3);
      break;
    case "I":
      s = stroke(5, 5, w);
      serif(s, 0, 3), serif(s, 1, 3);
      break;
    case "L":
      s = stroke(1.8 + w / 2, 1.8 + w / 2, w);
      bar(1.8 + w, 8.6, 10 - t, 10);
      poly([[8.6 - t, 8.0], [8.6, 8.0], [8.6, 10], [8.6 - t, 10]]);
      serif(s, 0, 3), serif(s, 1, 1);
      break;
    case "M": {
      s = stroke(1.6, 1.2, t);
      stroke(2.0, 5.0, w), stroke(8.0, 5.0, t);
      s2 = stroke(8.4, 8.8, w);
      serif(s, 1, 3), serif(s2, 1, 3), serif(s, 0, 1), serif(s2, 0, 2);
      break;
    }
    case "N": {
      s = stroke(1.6, 1.6, t), s2 = stroke(8.4, 8.4, t);
      const hk = hwOf(6, w);
      stroke(1.6 - t / 2 + hk, 8.4 + t / 2 - hk, w);
      serif(s, 1, 3), serif(s, 0, 1), serif(s2, 0, 3);
      break;
    }
    case "O":
      ring([]);
      break;
    case "T":
      bar(0.9, 9.1, 0, t);
      poly([[0.9, 0], [0.9 + t, 0], [0.9 + t, 1.8], [0.9, 1.8]]);
      poly([[9.1 - t, 0], [9.1, 0], [9.1, 1.8], [9.1 - t, 1.8]]);
      s = stroke(5, 5, w, t, 10);
      serif(s, 1, 3);
      break;
    case "V": {
      const kb = 4.8, hk = hwOf(2.9, w);
      s = stroke(1.9, kb, w), s2 = stroke(8.1, kb + hk - hwOf(-3.3, t), t);
      serif(s, 0, 3), serif(s2, 0, 3);
      break;
    }
    case "X":
      s = stroke(2.0, 8.0, w), s2 = stroke(7.6, 2.4, t);
      serif(s, 0, 3), serif(s, 1, 3), serif(s2, 0, 3), serif(s2, 1, 3);
      break;
  }
  // The serif heights are ruled first, right across the square.
  const pre = [];
  if (ends.has(0)) pre.push(ruled([0, t], [10, t]));
  if (ends.has(1)) pre.push(ruled([0, 10 - t], [10, 10 - t]));
  return { P, G: pre.concat(G) };
}

// Each piece becomes a box, a list of half-planes a u + b v + c >= 0, a disk
// it must be in, and disks it must stay out of.
function compile(P) {
  const half = (pts) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const sg = area > 0 ? 1 : -1, hp = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], du = b[0] - a[0], dv = b[1] - a[1];
      hp.push(-dv * sg, du * sg, (dv * a[0] - du * a[1]) * sg);
    }
    return hp;
  };
  return P.map((q) => {
    let pts = q.pts || q.kite, o = null, out = [];
    if (q.k === 1) {
      pts = [[q.o[0] - q.o[2], q.o[1] - q.o[2]], [q.o[0] + q.o[2], q.o[1] + q.o[2]]];
      o = [q.o[0], q.o[1], q.o[2] ** 2];
      out = q.h.map((h) => [h[0], h[1], h[2] ** 2]);
    } else if (q.k === 2) out = [[q.c[0], q.c[1], q.r * q.r]];
    const us = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
    let hp = q.k === 1 ? [] : half(pts);
    if (q.k === 1) for (const c of q.clip) hp.push(c[0], c[1], c[2]);
    return { u0: min(...us), u1: max(...us), v0: min(...vs), v1: max(...vs), hp, o, out };
  });
}

function inside(Q, u, v) {
  next: for (const q of Q) {
    if (u < q.u0 || u > q.u1 || v < q.v0 || v > q.v1) continue;
    const hp = q.hp;
    for (let i = 0; i < hp.length; i += 3) if (hp[i] * u + hp[i + 1] * v + hp[i + 2] < -1e-12) continue next;
    if (q.o && (u - q.o[0]) ** 2 + (v - q.o[1]) ** 2 > q.o[2]) continue;
    for (const h of q.out) if ((u - h[0]) ** 2 + (v - h[1]) ** 2 < h[2]) continue next;
    return true;
  }
  return false;
}

// Distance in 1 and 1.414 steps over the 64 x 64 sheet, from every LED
// already at 0. With a mask it only walks inside the mask, a geodesic:
// Dijkstra with a binary heap.
const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
function distance(d, mask) {
  const heap = [], key = (i) => d[heap[i]];
  const push = (p) => {
    heap.push(p);
    for (let i = heap.length - 1; i > 0; ) {
      const j = (i - 1) >> 1;
      if (key(j) <= key(i)) break;
      const tmp = heap[i];
      heap[i] = heap[j], heap[j] = tmp, i = j;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const a = 2 * i + 1, b = a + 1;
        let m = i;
        if (a < heap.length && key(a) < key(m)) m = a;
        if (b < heap.length && key(b) < key(m)) m = b;
        if (m === i) break;
        const tmp = heap[i];
        heap[i] = heap[m], heap[m] = tmp, i = m;
      }
    }
    return top;
  };
  const done = new Uint8Array(NL);
  for (let p = 0; p < NL; p++) if (d[p] === 0) push(p);
  while (heap.length) {
    const p = pop();
    if (done[p]) continue;
    done[p] = 1;
    const x = p & 63, y = p >> 6;
    for (let k = 0; k < 8; k++) {
      const xx = x + STEPS[k][0], yy = y + STEPS[k][1], c = STEPS[k][2];
      if (xx < 0 || yy < 0 || xx > 63 || yy > 63) continue;
      const q = yy * 64 + xx;
      if ((mask && !mask[q]) || d[p] + c >= d[q]) continue;
      d[q] = d[p] + c;
      push(q);
    }
  }
}

// ---- One letter on a 64 x 64 sheet: ink coverage from 4 x 4 samples an
// LED, when the ink reaches each LED (geodesic from the top left of the
// body, 0..1), when the paper lights (by distance from the letter, 0..1),
// and the construction lines with the moment the pen passes each LED.
// A letter is worked out the first time it is needed, 5 to 10 ms in Node
// once warm, and kept until Stem moves; the first frame works out two.
const SEQ = "ACDEHILMNOTVX";
function letter(ch, w) {
  const { P, G } = build(ch, w), Q = compile(P);
  const cov = new Float32Array(NL), mask = new Uint8Array(NL);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      let n = 0;
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) if (inside(Q, (x + (i + 0.5) / 4 - S0) / UN, (y + (j + 0.5) / 4 - S0) / UN)) n++;
      cov[y * 64 + x] = n / 16;
      mask[y * 64 + x] = n >= 6 ? 1 : 0;
    }
  // Ink: from the masked LED nearest the top left.
  const fill = new Float32Array(NL).fill(1e9);
  let seed = -1, best = 1e9;
  for (let p = 0; p < NL; p++) if (mask[p] && (p >> 6) + 0.5 * (p & 63) < best) (best = (p >> 6) + 0.5 * (p & 63)), (seed = p);
  fill[seed] = 0;
  distance(fill, mask);
  let fm = 0;
  for (let p = 0; p < NL; p++) if (mask[p] && fill[p] > fm) fm = fill[p];
  for (let p = 0; p < NL; p++) {
    if (!cov[p] || mask[p]) continue;
    const x = p & 63, y = p >> 6;
    let b = 1e9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (x + i >= 0 && x + i < 64 && y + j >= 0 && y + j < 64 && mask[(y + j) * 64 + x + i]) b = min(b, fill[(y + j) * 64 + x + i] + 1);
    fill[p] = b;
  }
  for (let p = 0; p < NL; p++) fill[p] = cov[p] ? min(1, fill[p] / (fm + 1)) : 1;
  // Paper: distance from the body.
  const gd = new Float32Array(NL);
  for (let p = 0; p < NL; p++) gd[p] = mask[p] ? 0 : 1e9;
  distance(gd, null);
  let gm = 0;
  for (let p = 0; p < NL; p++) if (inPaper(p) && gd[p] > gm) gm = gd[p];
  for (let p = 0; p < NL; p++) gd[p] = min(1, gd[p] / gm);
  // Construction: each element gets a share of the 4 s of 0.6 plus its
  // length over 2.5 units, so the O's outer circle takes 1.35 s at Speed 2.
  let tot = 0;
  const len = G.map((g) => (g.k ? g.r * abs(g.a1 - g.a0) : Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1])));
  len.forEach((l) => (tot += 0.6 + l / 2.5));
  const gw = new Float32Array(NL), gt = new Float32Array(NL).fill(2);
  let acc = 0;
  G.forEach((g, i) => {
    g.t0 = acc / tot;
    acc += 0.6 + len[i] / 2.5;
    g.t1 = acc / tot;
    const n = max(2, round((len[i] * UN) / 0.3));
    for (let k = 0; k <= n; k++) {
      const tt = g.t0 + ((g.t1 - g.t0) * k) / n;
      splat(at(g, k / n), (q, wt) => {
        if (wt < 0.05) return;
        if (wt > gw[q]) gw[q] = wt;
        if (tt < gt[q]) gt[q] = tt;
      });
    }
  });
  return { cov, fill, gd, gw, gt, G };
}

// Where element g is at s (0..1), in sheet LEDs.
function at(g, s) {
  if (g.k === 0) return [toX(g.a[0] + (g.b[0] - g.a[0]) * s), toX(g.a[1] + (g.b[1] - g.a[1]) * s)];
  const a = g.a0 + (g.a1 - g.a0) * s;
  return [toX(g.c[0] + g.r * cos(a)), toX(g.c[1] + g.r * sin(a))];
}

// A point split over its four nearest LEDs of the sheet, by area.
function splat([px, py], f) {
  const fx = px - 0.5, fy = py - 0.5, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const xx = ix + i, yy = iy + j;
      if (xx >= 0 && yy >= 0 && xx < 64 && yy < 64) f(yy * 64 + xx, (i ? ax : 1 - ax) * (j ? ay : 1 - ay));
    }
}

// The paper: LEDs 2..61 of the sheet, the square and its outline.
const inPaper = (p) => (p & 63) >= 2 && (p & 63) <= 61 && p >> 6 >= 2 && p >> 6 <= 61;

// Paper grain: value noise on a 5 LED lattice, 0.75..1.25, the same under
// every letter.
const GRAIN = new Float32Array(NL);
{
  const hs = (x, y) => {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  for (let p = 0; p < NL; p++) {
    const fx = (p & 63) / 5, fy = (p >> 6) / 5, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
    const a = hs(ix, iy), b = hs(ix + 1, iy), c = hs(ix, iy + 1), d = hs(ix + 1, iy + 1);
    GRAIN[p] = 0.75 + 0.5 * ((a + (b - a) * ax) * (1 - ay) + (c + (d - c) * ax) * ay);
  }
}

// The frame every sheet keeps: the square and its two diagonals.
const FRAME = new Float32Array(NL);
for (const g of [ruled([0, 0], [10, 0]), ruled([0, 0], [0, 10]), ruled([10, 0], [10, 10]), ruled([0, 10], [10, 10]), ruled([0, 0], [10, 10]), ruled([10, 0], [0, 10])]) {
  const n = round((Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) * UN) / 0.3);
  for (let k = 0; k <= n; k++) splat(at(g, k / n), (q, wt) => (FRAME[q] = max(FRAME[q], wt)));
}

// ---- Time, in seconds at Speed 2. A letter's turn is 8 s in one sheet:
// the old plate there goes dark in 0.8 s, from the paper's edge in to the
// letter; 4 s of construction; the ink runs 1.6 s; the paper lights in 1 s.
// Turns alternate between the sheets, so a finished plate stands through
// the other sheet's whole turn. A fresh start is 2.2 s into turn 1, the
// lower sheet, with turn 0's letter standing finished in the upper one, so
// at Speed 2 the ink and paper of the lower plate (2.6..5.2 s) and the
// darkening of the upper (5.8..6.6 s) both fall in the study's 2..8 s, and
// almost every LED that changes there changes once: the study measures
// drift 0.247 at motion 0.048, and motion over those 6 s adds up to only
// 1.17 times the drift.
const TURN = 8, ER = 0.8, CN = 4, F0 = 4.8, FN = 1.6, G0 = 6.4, GN = 1, START = TURN + 2.2;
const L_FRAME = 0.2, L_GUIDE = 0.42, L_PAPER = 0.17;

export function setup(params) {
  params.s = { tau: START, hue: 0, first: 0, w: 1, cache: {}, rgb: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.tau += (d * cl(k[1], 0.2, 3)) / 2;
  S.first = cl(round(k[2]), 0, 12);
  const w = round(cl(k[3], 0.1, 0.2) * 400) / 40;
  if (w !== S.w) (S.w = w), (S.cache = {});
}

function get(S, n) {
  if (n < 0) return null;
  const ch = SEQ[(S.first + n) % SEQ.length];
  return S.cache[ch] || (S.cache[ch] = letter(ch, S.w));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, h = S.hue;
  const ink = hsv(0.11 + h, 0.3, 1), line = hsv(0.5 + h, 0.55, 1), paper = hsv(0.62 + h, 0.75, 1), frame = hsv(0.56 + h, 0.35, 1), pen = hsv(0.13 + h, 0.15, 1);
  rgb.fill(0);
  const n = floor(S.tau / TURN);
  for (let sh = 0; sh < 2; sh++) {
    const oy = sh * SH * W;
    // Which letter this sheet shows and how far along it is.
    let L, ph, erase = 0;
    if (n % 2 === sh) {
      ph = S.tau - n * TURN;
      if (ph < ER) (L = get(S, n - 2)), (erase = ph / ER), (ph = TURN);
      else L = get(S, n);
    } else (L = get(S, n - 1)), (ph = TURN);
    const cp = (ph - ER) / CN, fp = (ph - F0) / FN, gp = (ph - G0) / GN;
    for (let p = 0; p < NL; p++) {
      const o = (oy + p) * 3;
      let r = FRAME[p] * L_FRAME * frame[0], g = FRAME[p] * L_FRAME * frame[1], b = FRAME[p] * L_FRAME * frame[2];
      if (L) {
        // Erasing goes from the paper's edge in: far paper first, the letter last.
        const keep = erase ? 1 - cl((erase - (1 - L.gd[p]) * 0.6) / 0.4, 0, 1) : 1;
        if (keep > 0) {
          const gl = L.gw[p] ? L.gw[p] * cl((cp - L.gt[p]) * CN * 20, 0, 1) * L_GUIDE : 0;
          const pa = inPaper(p) ? cl((gp - L.gd[p] * 0.75) / 0.25, 0, 1) * L_PAPER * GRAIN[p] : 0;
          const a = L.cov[p] ? L.cov[p] * cl((fp - L.fill[p] * 0.85) / 0.15, 0, 1) : 0;
          r = ((1 - a) * (r + gl * line[0] + pa * paper[0]) + a * ink[0]) * keep + r * (1 - keep);
          g = ((1 - a) * (g + gl * line[1] + pa * paper[1]) + a * ink[1]) * keep + g * (1 - keep);
          b = ((1 - a) * (b + gl * line[2] + pa * paper[2]) + a * ink[2]) * keep + b * (1 - keep);
        }
      }
      rgb[o] = r, rgb[o + 1] = g, rgb[o + 2] = b;
    }
    // The pen, while the construction is being drawn: a bright point at the
    // tip and, for an arc, the compass needle in its centre.
    if (L && !erase && cp > 0 && cp < 1) {
      const e = L.G.find((q) => cp >= q.t0 && cp < q.t1);
      if (e) {
        const s = (cp - e.t0) / (e.t1 - e.t0), [px, py] = at(e, s);
        dot(rgb, px, py + sh * SH, 1, pen);
        if (e.k === 1 && e.r > 1.5) dot(rgb, toX(e.c[0]), toX(e.c[1]) + sh * SH, 0.55, pen);
      }
    }
  }
  for (let p = 0; p < W * H; p++)
    display.setPixel(p & 63, p >> 6, min(255, rgb[p * 3] * 255) | 0, min(255, rgb[p * 3 + 1] * 255) | 0, min(255, rgb[p * 3 + 2] * 255) | 0);
}

// A point of light split over the four nearest LEDs, with a faint ring.
function dot(rgb, x, y, a, c) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
  for (let j = -1; j <= 2; j++)
    for (let i = -1; i <= 2; i++) {
      const xx = ix + i, yy = iy + j;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const wx = i === 0 ? 1 - ax : i === 1 ? ax : 0, wy = j === 0 ? 1 - ay : j === 1 ? ay : 0;
      const v = a * (wx * wy + 0.12);
      const o = (yy * W + xx) * 3;
      rgb[o] += c[0] * v, rgb[o + 1] += c[1] * v, rgb[o + 2] += c[2] * v;
    }
}
