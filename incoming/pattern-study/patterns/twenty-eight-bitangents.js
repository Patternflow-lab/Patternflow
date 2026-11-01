// ===== Patternflow pattern =====
// Title:   Twenty-Eight Bitangents
// Family:  line
// Idea:    The Trott quartic's four crescent ovals, bent slowly by a few low terms, glow in the middle of the tall panel, and every line that touches the curve at two points is found afresh each frame and drawn faint across the whole panel with both points of contact marked, 28 of them while the ovals stay apart, and as the crossings between crescents open and join them the number in the corner falls to 16, 8 or 4.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the 28 bitangents of a plane quartic (Julius Plücker, 1834); real bitangents of real quartics, 28, 16, 8 or 4 (Hieronymus Georg Zeuthen, 1873); the Trott curve (Michael Trott, 1997), pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..1, Lines=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the curve is ice white with a dim blue inside, lines with both ovals on one side are teal, lines that pass between two ovals are violet, a line across one oval's hollow is lime, and the points of contact are pale gold.
// Knob 2: Speed. At 2 the front goes once round the four crossings in 20 s, an opening or closing crossing turns over in 0.5 s, the crescents on the x axis and those on the y axis swell and thin in turn every 26 s, and the sweep picks out the next line by angle a little over twice a second, all 28 in 12 s. At 0.2 all of it is ten times slower, at 3 half as fast again.
// Knob 3: Shape. How many of the four crossings between the crescents are open, each open one joining two crescents. Up to 0.15 none: four ovals and 28 lines, and a front that runs round the crossings only narrows the gap it passes to about 4 LEDs. At 0.25 the one crossing nearest the front is open, three ovals and 16 lines, and the join moves on to the next crossing every 5 s; at 0.5 two, two ovals and 8; at 0.75 three, one curled oval and 4; at 1 all four, a ring whose inner and outer edges are two nested ovals, and still 4. Between those steps the front opens one more crossing for part of each turn.
// Knob 4: Lines. How bright the lines are that the sweep is not on: 40 of 255 at 0, 49 at the opening 0.06, 190 at 1, where every bitangent burns as bright as the one picked out.

// A quartic is cut by a line in four points, so a line that touches it
// twice meets it nowhere else. Plücker counted 28 such bitangents for a
// smooth quartic in the complex plane. Zeuthen sorted the real ones: a
// curve with four ovals has all 28 real, three ovals 16, two 8, one or
// none 4. Of those, 4 times the number of pairs of ovals go round a pair
// (two with both ovals on one side and two that cross between them), and
// the last 4 bridge a hollow in one oval or touch at two complex points
// the panel cannot show.
//
// Trott's curve, 144(x^4 + y^4) - 225(x^2 + y^2) + 350x^2y^2 + 81 = 0, is
// the two ellipses 16x^2 + 9y^2 = 9 and 9x^2 + 16y^2 = 9 multiplied, plus
// 13x^2y^2. The ellipses cross at (+-0.6, +-0.6), where the extra term is
// 1.68 and keeps the four crescents between them apart: four ovals, each
// with a hollow, so all 28 bitangents touch it at real points. Adding
// a + bx + cy + dxy sets the value at the four crossings one by one, and
// a value below zero joins the two crescents there. e(x^2 - y^2) is zero
// at every crossing and only fattens one pair of crescents and thins the
// other.
//
// Each frame the curve is traced by marching squares on a 105 by 105 grid,
// 0.92 LEDs a cell, and every vertex is pulled onto the curve by a Newton
// step. Each vertex gives a tangent line, written as an angle th in
// [0, pi) and an offset h. Those points make the dual curve, and a line
// tangent at two places is a point where the dual curve crosses itself,
// found by testing segments that share a band of angles.

const W = 64, H = 128;
const { floor, min, max, round, sqrt, abs, cos, sin, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The plane [-R, R]^2 on a G by G grid; on the panel SC LEDs a unit about
// (CX, CY).
const R = 1.3, G = 105, CELL = (2 * R) / (G - 1), HN = G * (G - 1), NE = 2 * G * (G - 1);
const SC = 27, CX = 32, CY = 65;
const TROTT = 13 * 0.36 * 0.36; // the extra term at a crossing
const EB = 2.2; // how far the swelling fattens one pair of crescents
// Two contact points on one oval closer than this (units) are one point.
const MINSEP = 0.07;
const NB = 96; // bands of angle for the crossing test
// Hues at Hue 0: curve, inside, one-side lines, between lines, hollow lines, contacts.
const HC = 0.56, HF = 0.62, HO = 0.48, HX = 0.78, HB = 0.24, HP = 0.13;

// 3 by 5 digits, rows top to bottom, 3 bits each.
const DIG = [
  [7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 3, 1, 7], [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 2, 2, 2], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7],
];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  const MV = 6000;
  params.s = {
    hue: 0, speed: 2, shape: 0, lines: 0.06, t: 0, sj: [0, 0, 0, 0], settled: true,
    co: new Float64Array(5), f: new Float32Array(G * G),
    l0: new Int32Array(NE), l1: new Int32Array(NE), seen: new Uint8Array(NE), hit: [],
    vx: new Float32Array(MV), vy: new Float32Array(MV), vt: new Float32Array(MV), vh: new Float32Array(MV),
    vl: new Int32Array(MV), vi: new Int32Array(MV), nv: 0, lens: [], starts: [], closed: [],
    sg: [], bins: Array.from({ length: NB }, () => []),
    bt: [], count: 28,
    r: new Float32Array(W * H), g: new Float32Array(W * H), b: new Float32Array(W * H), c: [0, 0, 0],
  };
}

// F and its gradient at (x, y); co = a, b, c, d, e.
function fval(x, y, co) {
  const x2 = x * x, y2 = y * y;
  return 144 * (x2 * x2 + y2 * y2) - 225 * (x2 + y2) + 350 * x2 * y2 + 81 + co[0] + co[1] * x + co[2] * y + co[3] * x * y + co[4] * (x2 - y2);
}
function fgx(x, y, co) {
  return 576 * x * x * x - 450 * x + 700 * x * y * y + co[1] + co[3] * y + 2 * co[4] * x;
}
function fgy(x, y, co) {
  return 576 * y * y * y - 450 * y + 700 * x * x * y + co[2] + co[3] * x - 2 * co[4] * y;
}

// The values at the four crossings, (0.6, 0.6) and on anticlockwise. A
// front at angle al runs round them; the crossings within w of it are
// open, and Shape sets w in steps of 45 degrees, one more crossing open
// for each. A crossing turns over in 0.5 s at Speed 2, so the curve is
// singular for a few frames only. A closed crossing's gap narrows as the
// front comes near it.
function coeffs(S, d) {
  const al = (2 * PI * S.t) / 20, n = 4 * S.shape, k = floor(n), w = (PI / 4) * (k + smooth(0.6, 1, n - k));
  const cw = cos(w) - 1e-9, v = [0, 0, 0, 0];
  for (let j = 0; j < 4; j++) {
    const u = cos(PI / 4 + (j * PI) / 2 - al), want = u >= cw ? -1 : 1;
    if (S.sj[j] === 0) S.sj[j] = want;
    S.sj[j] += cl(want - S.sj[j], -2 * S.speed * d, 2 * S.speed * d);
    const sj = S.sj[j];
    v[j] = (sj > 0 ? sj * (0.25 + 0.8 * (1 - u)) : sj * (1.2 + 0.4 * (1 + u))) - TROTT;
  }
  const co = S.co;
  co[0] = (v[0] + v[1] + v[2] + v[3]) / 4;
  co[1] = (v[0] - v[1] - v[2] + v[3]) / 2.4;
  co[2] = (v[0] + v[1] - v[2] - v[3]) / 2.4;
  co[3] = (v[0] - v[1] + v[2] - v[3]) / 1.44;
  co[4] = EB * sin((2 * PI * S.t) / 26);
  // While a crossing is turning over the count keeps its last value.
  S.settled = S.sj.every((x) => abs(x) > 0.6);
}

const smooth = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function link(S, a, b) {
  if (S.l0[a] < 0) S.l0[a] = b;
  else S.l1[a] = b;
  if (S.l0[b] < 0) S.l0[b] = a;
  else S.l1[b] = a;
}

// Marching squares into polylines, each vertex pulled onto the curve and
// given its tangent line (th, h).
function trace(S) {
  const f = S.f, co = S.co, l0 = S.l0, l1 = S.l1, seen = S.seen, hit = S.hit;
  for (let j = 0; j < G; j++) {
    const y = -R + j * CELL;
    for (let i = 0; i < G; i++) {
      const v = fval(-R + i * CELL, y, co);
      f[j * G + i] = v === 0 ? 1e-9 : v;
    }
  }
  l0.fill(-1);
  l1.fill(-1);
  hit.length = 0;
  for (let j = 0; j < G - 1; j++)
    for (let i = 0; i < G - 1; i++) {
      const v0 = f[j * G + i], v1 = f[j * G + i + 1], v2 = f[(j + 1) * G + i + 1], v3 = f[(j + 1) * G + i];
      const s0 = v0 < 0, s1 = v1 < 0, s2 = v2 < 0, s3 = v3 < 0;
      if (s0 === s1 && s1 === s2 && s2 === s3) continue;
      const eB = j * (G - 1) + i, eT = (j + 1) * (G - 1) + i, eL = HN + j * G + i, eR = HN + j * G + i + 1;
      const e = [];
      if (s0 !== s1) e.push(eB);
      if (s1 !== s2) e.push(eR);
      if (s3 !== s2) e.push(eT);
      if (s0 !== s3) e.push(eL);
      if (e.length === 2) link(S, e[0], e[1]);
      else if ((v0 + v1 + v2 + v3 < 0) === s0) {
        link(S, eB, eR);
        link(S, eT, eL);
      } else {
        link(S, eB, eL);
        link(S, eR, eT);
      }
      for (const k of e) if (!seen[k]) (seen[k] = 1), hit.push(k);
    }
  for (const k of hit) seen[k] = 0;
  S.nv = 0;
  S.lens.length = 0;
  S.starts.length = 0;
  S.closed.length = 0;
  // Open ends first (only if the curve ever ran off the grid), then loops.
  for (const k of hit) if (!seen[k] && l1[k] < 0) walk(S, k);
  for (const k of hit) if (!seen[k]) walk(S, k);
  for (const k of hit) seen[k] = 0;
}

function walk(S, start) {
  const l0 = S.l0, l1 = S.l1, seen = S.seen, f = S.f, co = S.co;
  const lid = S.lens.length, first = S.nv;
  let prev = -1, cur = start, closed = false;
  while (S.nv < S.vx.length) {
    seen[cur] = 1;
    let x, y;
    if (cur < HN) {
      const j = floor(cur / (G - 1)), i = cur - j * (G - 1), a = f[j * G + i], b = f[j * G + i + 1];
      x = -R + (i + a / (a - b)) * CELL;
      y = -R + j * CELL;
    } else {
      const e = cur - HN, j = floor(e / G), i = e - j * G, a = f[j * G + i], b = f[(j + 1) * G + i];
      x = -R + i * CELL;
      y = -R + (j + a / (a - b)) * CELL;
    }
    // One Newton step onto the curve, no further than half a cell.
    let gx = fgx(x, y, co), gy = fgy(x, y, co);
    const g2 = gx * gx + gy * gy;
    if (g2 > 1e-12) {
      const st = fval(x, y, co) / g2;
      let dx = st * gx, dy = st * gy;
      const dl = sqrt(dx * dx + dy * dy);
      if (dl > 0.5 * CELL) (dx *= (0.5 * CELL) / dl), (dy *= (0.5 * CELL) / dl);
      x -= dx;
      y -= dy;
      gx = fgx(x, y, co);
      gy = fgy(x, y, co);
    }
    // The normal's own angle, which turns by less than pi from one vertex
    // to the next even round the sharpest tip.
    const th = atan2(gy, gx);
    const n = S.nv++;
    S.vx[n] = x;
    S.vy[n] = y;
    S.vt[n] = th;
    S.vh[n] = cos(th) * x + sin(th) * y;
    S.vl[n] = lid;
    S.vi[n] = n - first;
    const next = l0[cur] === prev ? l1[cur] : l0[cur];
    if (next < 0) break;
    if (next === start) {
      closed = true;
      break;
    }
    if (seen[next]) break;
    prev = cur;
    cur = next;
  }
  S.starts.push(first);
  S.lens.push(S.nv - first);
  S.closed.push(closed);
}

// Self-crossings of the dual curve. A segment runs between two vertices'
// normal angles, unwrapped, and is laid into [0, pi) once for every
// multiple of pi it reaches, with h turned over for an odd one: the line
// at angle th + pi and offset -h is the line at th and h.
function bitangents(S) {
  const sg = S.sg, bins = S.bins, vt = S.vt, vh = S.vh;
  sg.length = 0;
  for (const b of bins) b.length = 0;
  for (let L = 0; L < S.lens.length; L++) {
    const s0 = S.starts[L], n = S.lens[L], m = S.closed[L] ? n : n - 1;
    for (let k = 0; k < m; k++) {
      const a = s0 + k, b = s0 + ((k + 1) % n);
      const t1 = vt[a], h1 = vh[a];
      let dt = vt[b] - t1;
      if (dt > PI) dt -= 2 * PI;
      else if (dt <= -PI) dt += 2 * PI;
      const t2 = t1 + dt, h2 = vh[b];
      for (let sh = floor(min(t1, t2) / PI); sh <= floor(max(t1, t2) / PI); sh++) {
        const sgn = sh & 1 ? -1 : 1, ta = t1 - sh * PI, tb = t2 - sh * PI;
        const idx = sg.length;
        sg.push([ta, sgn * h1, tb, sgn * h2, a, b, L, k, sgn]);
        const lo = max(0, floor((min(ta, tb) / PI) * NB)), hi = min(NB - 1, floor((max(ta, tb) / PI) * NB));
        for (let q = lo; q <= hi; q++) bins[q].push(idx);
      }
    }
  }
  const out = [];
  for (let q = 0; q < NB; q++) {
    const list = bins[q], b0 = (q * PI) / NB, b1 = ((q + 1) * PI) / NB;
    for (let i = 0; i < list.length; i++) {
      const P = sg[list[i]];
      for (let j = i + 1; j < list.length; j++) {
        const Q = sg[list[j]];
        if (P[6] === Q[6]) {
          const n = S.lens[P[6]];
          let dk = abs(P[7] - Q[7]);
          if (S.closed[P[6]]) dk = min(dk, n - dk);
          if (dk <= 2) continue;
        }
        const rx = P[2] - P[0], ry = P[3] - P[1], sx = Q[2] - Q[0], sy = Q[3] - Q[1];
        const den = rx * sy - ry * sx;
        if (abs(den) < 1e-14) continue;
        const qx = Q[0] - P[0], qy = Q[1] - P[1];
        const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
        if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
        const th = P[0] + t * rx;
        if (th < b0 || th >= b1) continue;
        const px = S.vx[P[4]] + t * (S.vx[P[5]] - S.vx[P[4]]), py = S.vy[P[4]] + t * (S.vy[P[5]] - S.vy[P[4]]);
        const qx2 = S.vx[Q[4]] + u * (S.vx[Q[5]] - S.vx[Q[4]]), qy2 = S.vy[Q[4]] + u * (S.vy[Q[5]] - S.vy[Q[4]]);
        const same = P[6] === Q[6];
        if (same && (px - qx2) * (px - qx2) + (py - qy2) * (py - qy2) < MINSEP * MINSEP) continue;
        // The normals at the two points agree when both ovals lie on one
        // side of the line.
        out.push({ th, h: P[1] + t * ry, px, py, qx: qx2, qy: qy2, kind: same ? 2 : P[8] === Q[8] ? 0 : 1 });
      }
    }
  }
  // The same line found twice where bands meet.
  const bt = [];
  for (const o of out) {
    if (!bt.some((p) => abs(p.th - o.th) < 0.004 && abs(p.h - o.h) < 0.004)) bt.push(o);
  }
  S.bt = bt;
  if (S.settled) S.count = bt.length;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.shape = cl(k[2] || 0, 0, 1);
  S.lines = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.t += d * S.speed * 0.5;
  if (S.t > 5200) S.t -= 5200;
  coeffs(S, d);
  trace(S);
  bitangents(S);
}

function add(S, x, y, w, c) {
  if (x < 0 || x >= W || y < 0 || y >= H || w <= 0) return;
  const i = y * W + x;
  S.r[i] += w * c[0];
  S.g[i] += w * c[1];
  S.b[i] += w * c[2];
}

function disc(S, X, Y, rad, c) {
  for (let y = floor(Y - rad - 1); y <= Y + rad + 1; y++)
    for (let x = floor(X - rad - 1); x <= X + rad + 1; x++) {
      const dx = x + 0.5 - X, dy = y + 0.5 - Y;
      add(S, x, y, cl(rad + 0.5 - sqrt(dx * dx + dy * dy), 0, 1), c);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const Rr = S.r, Gg = S.g, Bb = S.b, co = S.co, c = S.c, hue = S.hue;
  Rr.fill(0);
  Gg.fill(0);
  Bb.fill(0);
  // The curve: distance |F| / |grad F| at each LED, and a dim inside.
  const cc = hsv(hue + HC, 0.3, 245, [0, 0, 0]), fc = hsv(hue + HF, 0.85, 44, [0, 0, 0]);
  for (let y = 0; y < H; y++) {
    const v = (CY - y - 0.5) / SC;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - CX) / SC, F = fval(u, v, co), gx = fgx(u, v, co), gy = fgy(u, v, co);
      const dd = (abs(F) / (sqrt(gx * gx + gy * gy) + 1e-9)) * SC, i = y * W + x;
      let w = cl(1.25 - dd * 0.85, 0, 1);
      w *= w;
      if (F < 0) {
        Rr[i] += fc[0];
        Gg[i] += fc[1];
        Bb[i] += fc[2];
      }
      Rr[i] += w * cc[0];
      Gg[i] += w * cc[1];
      Bb[i] += w * cc[2];
    }
  }
  // The sweep picks the line whose angle is nearest its own.
  const psi = ((S.t / 12) * PI) % PI;
  let pick = -1, best = 9;
  S.bt.forEach((o, n) => {
    let d = abs(o.th - psi);
    d = min(d, PI - d);
    if (d < best) (best = d), (pick = n);
  });
  const faint = 40 + 150 * S.lines, HK = [HO, HX, HB];
  S.bt.forEach((o, n) => {
    const on = n === pick, lev = on ? 186 : faint;
    hsv(hue + HK[o.kind], on ? 0.55 : 0.8, lev, c);
    // In panel terms the line is nx X - ny Y = C.
    const nx = cos(o.th), ny = sin(o.th), C = o.h * SC + nx * CX - ny * CY;
    if (abs(nx) >= abs(ny)) {
      for (let y = 0; y < H; y++) {
        const Y = y + 0.5, X0 = (C + ny * Y) / nx;
        for (let x = floor(X0 - 1.6); x <= X0 + 1.6; x++) add(S, x, y, 1 - abs(nx * (x + 0.5) - ny * Y - C) / 0.9, c);
      }
    } else {
      for (let x = 0; x < W; x++) {
        const X = x + 0.5, Y0 = (nx * X - C) / ny;
        for (let y = floor(Y0 - 1.6); y <= Y0 + 1.6; y++) add(S, x, y, 1 - abs(nx * X - ny * (y + 0.5) - C) / 0.9, c);
      }
    }
  });
  const pc = hsv(hue + HP, 0.6, 255, [0, 0, 0]);
  S.bt.forEach((o, n) => {
    const rad = n === pick ? 1.7 : 1.1;
    disc(S, CX + o.px * SC, CY - o.py * SC, rad, pc);
    disc(S, CX + o.qx * SC, CY - o.qy * SC, rad, pc);
  });
  // The count, small, on a dark patch in the top left corner.
  const str = String(S.count), dw = str.length * 4 + 1;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < dw + 2; x++) {
      const i = y * W + x;
      Rr[i] = Gg[i] = Bb[i] = 0;
    }
  const tc = hsv(hue + HP, 0.2, 220, [0, 0, 0]);
  for (let k = 0; k < str.length; k++) {
    const g = DIG[+str[k]];
    for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if ((g[r] >> (2 - b)) & 1) add(S, 2 + k * 4 + b, 2 + r, 1, tc);
  }
  for (let i = 0; i < W * H; i++) display.setPixel(i % W, floor(i / W), min(255, round(Rr[i])), min(255, round(Gg[i])), min(255, round(Bb[i])));
}
