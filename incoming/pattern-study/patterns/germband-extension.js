// ===== Patternflow pattern =====
// Title:   Germband Extension
// Family:  intercalation
// Idea:    A mosaic of about a hundred and ten rounded cells with dark walls is pulled out along the panel and squeezed across it by cells that swap neighbours, so every colour band thickens as it climbs away from the waist while its cells wedge in between the cells of the band beside it, and a wall flashes as it shrinks away and the new one opens across it.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: convergent extension by cell intercalation, the way the germband of a Drosophila embryo lengthens and narrows with its cells hardly changing shape (Irvine and Wieschaus 1994; Bertet, Sulak and Lecuit 2004, from memory); the T1 neighbour exchange named for foams (Weaire and Rivier 1984, from memory); the seed model with soft repulsion in a pure shear flow, the bands labelled by where a cell was born, the flashes and the colours are original, pattern round 247
// Round:   247
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0..4, Narrowing=-1..1, Cells=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel. The bands run through a third of it, and at 0 they open on green and run through teal and blue to violet. Each wall is a dark tint of its own cell.
// Knob 2: Flow. 0 to 4, opening at 2. How fast the tissue is pulled out, as a stretch rate of 0.012 a second at 0, 0.08 at 2 and 0.2 at 4. A band takes about 3 minutes to climb from the waist to the top edge at 0, 28 s at 2 and 12 s at 4. At 0 the bands crawl and the walls wobble, with a swap every second or so. At 4 the bands pour out and swaps flash many times a second.
// Knob 3: Narrowing. -1 to 1, opening at 0. How hard the sides are drawn in as the tissue lengthens, as a share of the stretch rate: 0 at -1, 0.6 at 0 and 1.2 at 1. At -1 the tissue is only pulled, and new cells grow out of the gaps that open between the old ones, all over the panel. At 1 the cells are driven sideways toward the middle line and wedge past each other, and the new cells come in at the edges.
// Knob 4: Cells. -1 to 1, opening at 0.06. How many cells fill the panel: 60 at -1, about 110 at the opening and 190 at 1, so a cell is about 13 LED across at -1 and 7 at 1. When it changes, new cells grow out of gaps and surplus cells shrink away.

const W = 64, H = 128;
const CX = 32, CY = 64;
const { floor, ceil, round, min, max, abs, sqrt, exp, log, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
const fr = (v) => v - floor(v);

// The simulated sheet reaches past the panel so that cells at the edge have neighbours on both sides.
const MX = 9, MY = 13;
const X0 = -MX, X1 = W + MX, Y0 = -MY, Y1 = H + MY;
const EXT = ((X1 - X0) * (Y1 - Y0)) / (W * H);
const D0 = 7;              // the waist: new tissue opens along the middle row, where the flow pulls it apart at a * D0
const QY = 1.2;            // distances along the panel count 1.2 times, so cells sit closer along it and come out wider than tall
const STEP = 1 / 30;
const POOL = 440;
const BETA = 0.62;         // width of a colour band in the log of its distance from the waist
const KAPPA = 0.93;        // rest spacing against a perfect hexagonal packing; cells of random size jam a little below it
const JIG = 0.05;          // wobble of a cell, as a share of the rest spacing per second
const FL_LEN = 3.4;        // a wall flashes when it falls under this many LED...
const FL_PEAK = 4.8;       // ...after it was longer than this

const hsv = (h, s, v, out, o) => {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
};
// a dim orange or yellow reads brown on the panel, so that stretch of the wheel is paled
const warm = (h) => {
  const d = (h - floor(h) - 0.1) * 6;
  return exp(-d * d);
};
// pure blue is the darkest hue on the panel, so it is paled a little too
const blue = (h) => {
  const d = (h - floor(h) - 0.66) * 5;
  return exp(-d * d);
};

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const f = () => new Float32Array(POOL);
  params.st = {
    k: [0, 2, 0, 0.06], init: false, acc: 0, dt: STEP, S: 5.5,
    a: 0.08, n: 0.6, nv: 111, r0: 9,
    X: f(), Y: f(), JX: f(), JY: f(), V: f(), RV: f(), RAD: f(), DL: f(), PH: f(),
    SIDE: new Int8Array(POOL), USE: new Uint8Array(POOL),
    head: new Int16Array(1024), nxt: new Int16Array(POOL), hd2: new Int16Array(1024),
    pi: new Int16Array(POOL * 8), pj: new Int16Array(POOL * 8), np: 0,
    bt: [[], []],
    body: new Float32Array(POOL * 3),
    I1: new Int16Array(W * H), I2: new Int16Array(W * H), E: new Float32Array(W * H),
    CNT: new Uint8Array(POOL * POOL), LEN: new Float32Array(POOL * POOL), PK: new Float32Array(POOL * POOL), GLOW: new Float32Array(POOL * POOL),
    SX: new Float32Array(POOL * POOL), SY: new Float32Array(POOL * POOL), LX: new Float32Array(POOL * POOL), LY: new Float32Array(POOL * POOL),
    ev: [], bl: [],
    act: [], glowKeys: [],
  };
}

// ---- the colour bands -------------------------------------------------------
// A cell is labelled at birth with v, the stretch so far minus the log of its distance from the waist plus D0. The flow keeps
// v of a moving cell the same, so a band of v is a band across the panel that thickens as it climbs. Bands are drawn at
// random, one table per side of the waist: a hue that sweeps back and forth through a third of the wheel, a saturation,
// a brightness and a ragged edge.
function bandAt(st, side, k) {
  const T = st.bt[side];
  while (T.length <= k) {
    const j = T.length, prev = j ? T[j - 1] : null;
    const ph = prev ? prev.ph + 0.13 + 0.09 * rnd() : rnd();
    T.push({
      ph,
      w: abs(2 * fr(ph) - 1),
      s: 0.68 + 0.28 * rnd(),
      v: j % 2 ? 0.8 + 0.1 * rnd() : 0.97 - 0.04 * rnd(),
      b: BETA * (j + 0.6 * (rnd() - 0.5)),
    });
  }
  return T[k];
}
function bandOf(st, side, v) {
  let k = max(0, floor(v / BETA));
  while (k > 0 && v < bandAt(st, side, k).b) k--;
  while (v >= bandAt(st, side, k + 1).b) k++;
  return bandAt(st, side, k);
}

// ---- the sheet ---------------------------------------------------------------
function derive(st, snap) {
  const k = st.k;
  const a = 0.012 + 0.19 * pow(cl(k[1] / 4, 0, 1), 1.4);
  const n = cl(0.6 + 0.6 * k[2], 0, 1.2);
  const nv = 107 * pow(1.78, cl(k[3], -1, 1));
  const f = snap ? 1 : 1 - exp(-STEP / 0.4);
  st.a += (a - st.a) * f;
  st.n += (n - st.n) * f;
  st.nv += (nv - st.nv) * f;
  st.r0 = KAPPA * sqrt((W * H * QY) / (0.866 * st.nv));
}

// Seeds go into a grid of buckets, head[] and nxt[] being the linked lists.
function buckets(st, bs, head) {
  const inv = 1 / bs, gx = ceil((X1 - X0) * inv) + 1, gy = ceil((Y1 - Y0) * inv) + 1;
  head.fill(-1, 0, gx * gy);
  const { X, Y, USE, nxt } = st;
  for (let i = 0; i < POOL; i++) {
    if (!USE[i]) continue;
    const b = floor((Y[i] - Y0) * inv) * gx + floor((X[i] - X0) * inv);
    nxt[i] = head[b];
    head[b] = i;
  }
  return gx;
}

// How far, in the stretched metric, the nearest cell is from a point.
function gapAt(st, x, y, bs, gx) {
  const { X, Y, USE, head, nxt } = st;
  const inv = 1 / bs, bx = floor((x - X0) * inv), by = floor((y - Y0) * inv);
  const gy = ceil((Y1 - Y0) * inv) + 1;
  let best = 1e9;
  for (let cy = max(0, by - 1); cy <= min(gy - 1, by + 1); cy++)
    for (let cx = max(0, bx - 1); cx <= min(gx - 1, bx + 1); cx++)
      for (let j = head[cy * gx + cx]; j >= 0; j = nxt[j]) {
        if (USE[j] !== 1) continue;
        const dx = x - X[j], dy = (y - Y[j]) * QY, d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
  return sqrt(best);
}

function birth(st, x, y, ph) {
  const { USE } = st;
  let i = 0;
  while (i < POOL && USE[i]) i++;
  if (i === POOL) return -1;
  st.X[i] = x;
  st.Y[i] = y;
  st.JX[i] = 0;
  st.JY[i] = 0;
  const dy = y - CY;
  st.V[i] = st.S - log(abs(dy) + D0);
  st.SIDE[i] = dy < 0 || (dy === 0 && rnd() < 0.5) ? 0 : 1;
  st.RV[i] = rnd();
  st.RAD[i] = 0.84 + 0.32 * rnd();
  st.PH[i] = ph;
  st.DL[i] = 0;
  USE[i] = 1;
  return i;
}

// A new cell goes where the sheet has the biggest gap among a dozen tries, so it fills a hole and does not crowd a neighbour.
function spawn(st, bs, gx, ph, tries) {
  let bx = 0, by = 0, bg = -1;
  for (let c = 0; c < tries; c++) {
    const x = X0 + 1.5 + rnd() * (X1 - X0 - 3), y = Y0 + 3 + rnd() * (Y1 - Y0 - 6);
    const g = gapAt(st, x, y, bs, gx);
    if (g > bg) (bg = g), (bx = x), (by = y);
  }
  const i = birth(st, bx, by, ph);
  if (i >= 0) {
    const b = floor((by - Y0) / bs) * gx + floor((bx - X0) / bs);
    st.nxt[i] = st.head[b];
    st.head[b] = i;
  }
}

// seeds that leave through the top or bottom are gone; the side walls hold the rest
function bound(st) {
  const { X, Y, USE } = st;
  for (let i = 0; i < POOL; i++) {
    if (!USE[i]) continue;
    if (X[i] < X0) X[i] = X0;
    else if (X[i] > X1) X[i] = X1;
    if (Y[i] < Y0 + 0.01 || Y[i] > Y1 - 0.01) USE[i] = 0;
  }
}

function step(st, live) {
  const h = STEP;
  if (live) derive(st, false);
  const { X, Y, JX, JY, USE, PH, DL, RAD, nxt } = st;
  const a = live ? st.a : 0, n = live ? st.n : 0, r0 = st.r0;
  st.S += a * h;
  const dlmax = 2.4 * r0 * r0;
  const sig = JIG * r0, tau = 1.1, ou = sig * sqrt(2 / tau) * sqrt(h);
  for (let i = 0; i < POOL; i++) {
    if (!USE[i]) continue;
    if (USE[i] === 1) {
      if (PH[i] < 1) PH[i] = min(1, PH[i] + h / 1.0);
    } else {
      PH[i] -= h / 0.8;
      if (PH[i] <= 0) {
        USE[i] = 0;
        continue;
      }
    }
    DL[i] = dlmax * (1 - PH[i]);
    JX[i] += -JX[i] * (h / tau) + ou * gauss();
    JY[i] += -JY[i] * (h / tau) + ou * gauss();
    const dy = Y[i] - CY;
    const sg = dy / sqrt(dy * dy + 4);
    X[i] += (-n * a * (X[i] - CX) + JX[i]) * h;
    Y[i] += (a * sg * (abs(dy) + D0) + JY[i]) * h;
  }
  bound(st);
  // the seeds, in a grid of the pair reach
  const bs = max(5, 1.4 * r0);
  const gx = buckets(st, bs, st.head);
  const inv = 1 / bs, gy = ceil((Y1 - Y0) * inv) + 1;
  let np = 0;
  const reach = 1.5 * r0;
  const { pi, pj, head } = st;
  for (let i = 0; i < POOL; i++) {
    if (!USE[i]) continue;
    const bx = floor((X[i] - X0) * inv), by = floor((Y[i] - Y0) * inv);
    for (let cy = max(0, by - 1); cy <= min(gy - 1, by + 1); cy++)
      for (let cx = max(0, bx - 1); cx <= min(gx - 1, bx + 1); cx++)
        for (let j = head[cy * gx + cx]; j >= 0; j = nxt[j]) {
          if (j <= i) continue;
          const dx = X[i] - X[j], dy = (Y[i] - Y[j]) * QY;
          if (dx * dx + dy * dy < reach * reach && np < pi.length) (pi[np] = i), (pj[np] = j), np++;
        }
  }
  st.np = np;
  // soft repulsion: seeds closer than their rest spacing are pushed apart along the stretched metric
  for (let it = 0; it < 3; it++) {
    for (let q = 0; q < np; q++) {
      const i = pi[q], j = pj[q];
      let dx = X[i] - X[j], dy = (Y[i] - Y[j]) * QY;
      let d = sqrt(dx * dx + dy * dy);
      const ci = 0.6 + 0.4 * PH[i], cj = 0.6 + 0.4 * PH[j];
      const rest = 0.5 * r0 * (RAD[i] * ci + RAD[j] * cj);
      if (d >= rest) continue;
      if (d < 1e-4) (dx = rnd() - 0.5), (dy = rnd() - 0.5), (d = sqrt(dx * dx + dy * dy));
      const ov = ((rest - d) * 0.26) / d;
      X[i] += dx * ov;
      X[j] -= dx * ov;
      Y[i] += (dy * ov) / QY;
      Y[j] -= (dy * ov) / QY;
    }
  }
  bound(st);
  if (!live) return;
  // births fill the sheet back up to the number it should hold; surplus cells shrink away
  const target = round(st.nv * EXT);
  let alive = 0;
  for (let i = 0; i < POOL; i++) if (USE[i] === 1) alive++;
  if (alive < target || alive > target + 1) buckets(st, bs, st.head);
  for (let b = 0; b < 6 && alive < target; b++, alive++) spawn(st, bs, gx, 0, 12);
  for (let b = 0; b < 2 && alive > target + 1; b++, alive--) {
    let pick = -1, pg = 1e9;
    for (let c = 0; c < 10; c++) {
      const i = floor(rnd() * POOL);
      if (USE[i] !== 1 || PH[i] < 1) continue;
      USE[i] = 2;
      const g = gapAt(st, X[i], Y[i], bs, gx);
      USE[i] = 1;
      if (g < pg) (pg = g), (pick = i);
    }
    if (pick >= 0) USE[pick] = 2;
  }
}

function init(st) {
  st.init = true;
  derive(st, true);
  const bs = max(5, 1.4 * st.r0);
  // a first scatter that is already even: each new seed goes to the largest of many gaps
  const gx = buckets(st, bs, st.head);
  const target = round(st.nv * EXT);
  for (let c = 0; c < target; c++) spawn(st, bs, gx, 1, 14);
  // settle the scatter, then run the sheet for a good while before the first picture
  for (let i = 0; i < 70; i++) step(st, false);
  for (let i = 0; i < 360; i++) step(st, true);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = typeof kv[i] === "number" && isFinite(kv[i]) ? kv[i] : st.k[i];
  if (!st.init) init(st);
  st.dt = cl(dt || 0, 0, 0.1);
  st.acc += st.dt;
  let guard = 0;
  while (st.acc >= STEP && guard++ < 4) {
    st.acc -= STEP;
    step(st, true);
  }
}

// ---- drawing ----------------------------------------------------------------
// The nearest and second nearest cell of every LED, by power distance so that a growing cell starts from a point.
function cells(st) {
  const { X, Y, DL, I1, I2, E } = st;
  const bs = max(4.5, st.r0);
  const gx = buckets(st, bs, st.hd2);
  const inv = 1 / bs, gy = ceil((Y1 - Y0) * inv) + 1;
  const head = st.hd2, nxt = st.nxt;
  for (let py = 0; py < H; py++) {
    const y = py + 0.5, by = floor((y - Y0) * inv), fy = (y - Y0) * inv - by;
    for (let px = 0; px < W; px++) {
      const x = px + 0.5, bx = floor((x - X0) * inv), fx = (x - X0) * inv - bx;
      let p1 = 1e9, p2 = 1e9, i1 = -1, i2 = -1;
      for (let R = 1; ; R++) {
        p1 = p2 = 1e9;
        i1 = i2 = -1;
        for (let cy = max(0, by - R); cy <= min(gy - 1, by + R); cy++)
          for (let cx = max(0, bx - R); cx <= min(gx - 1, bx + R); cx++)
            for (let j = head[cy * gx + cx]; j >= 0; j = nxt[j]) {
              const dx = x - X[j], dy = y - Y[j], p = dx * dx + dy * dy + DL[j];
              if (p < p2) {
                if (p < p1) (p2 = p1), (i2 = i1), (p1 = p), (i1 = j);
                else (p2 = p), (i2 = j);
              }
            }
        // seeds outside the block are at least this far away
        const g = (R + min(fx, 1 - fx, fy, 1 - fy)) * bs;
        if (p2 <= g * g || R > 6) break;
      }
      const o = py * W + px;
      I1[o] = i1;
      I2[o] = i2;
      if (i2 < 0) E[o] = 99;
      else {
        const dx = X[i1] - X[i2], dy = Y[i1] - Y[i2];
        E[o] = (p2 - p1) / (2 * sqrt(dx * dx + dy * dy) + 1e-6);
      }
    }
  }
}

// A neighbour swap shows as a wall that shrinks to nothing while a new wall opens across the corner it leaves. The length
// of every wall is counted in LEDs, a wall that was long and falls under 3.4 flashes, and a wall that opens within a few LED
// of one that has just gone flashes too. Cells that are new, dying or near the panel edge are left out.
function flashes(st) {
  const { X, Y, USE, PH, I1, CNT, LEN, PK, GLOW, SX, SY, LX, LY, act, glowKeys, ev, bl } = st;
  const touched = [];
  for (let py = 0; py < H - 1; py++)
    for (let px = 0; px < W - 1; px++) {
      const o = py * W + px, a = I1[o];
      for (let d = 0; d < 2; d++) {
        const b = I1[d ? o + W : o + 1];
        if (b === a) continue;
        const key = a < b ? a * POOL + b : b * POOL + a;
        if (!CNT[key]) touched.push(key);
        CNT[key]++;
        SX[key] += px + 0.5 + 0.5 * (1 - d);
        SY[key] += py + 0.5 + 0.5 * d;
      }
    }
  const steady = (key) => {
    const i = floor(key / POOL), j = key - i * POOL;
    const ok = (k) => USE[k] === 1 && PH[k] >= 1 && X[k] > 5 && X[k] < W - 5 && Y[k] > 5 && Y[k] < H - 5;
    return ok(i) && ok(j);
  };
  const flash = (key, v) => {
    if (GLOW[key] === 0) glowKeys.push(key);
    if (GLOW[key] < v) GLOW[key] = v;
  };
  for (let q = ev.length - 1; q >= 0; q--) if (--ev[q].ttl < 0) ev.splice(q, 1);
  for (let q = bl.length - 1; q >= 0; q--) if (--bl[q].ttl < 0) bl.splice(q, 1);
  for (const key of act) {
    if (CNT[key]) continue;
    if (PK[key] > FL_PEAK && LEN[key] < FL_LEN && steady(key)) {
      const e = { x: LX[key], y: LY[key], ttl: 6 };
      ev.push(e);
      for (const b of bl) if (abs(b.x - e.x) < 5 && abs(b.y - e.y) < 5) flash(b.key, 1);
    }
    LEN[key] = 0;
    PK[key] = 0;
  }
  for (const key of touched) {
    const c = CNT[key], prev = LEN[key], l = prev > 0 ? prev + 0.5 * (c - prev) : c;
    const x = SX[key] / c, y = SY[key] / c;
    if (steady(key)) {
      if (prev === 0) {
        const b = { key, x, y, ttl: 6 };
        bl.push(b);
        for (const e of ev) if (abs(b.x - e.x) < 5 && abs(b.y - e.y) < 5) flash(key, 1);
      }
      const pk = max(PK[key] * 0.97, l);
      PK[key] = pk;
      if (l < FL_LEN && pk > FL_PEAK && l < prev - 0.1 && GLOW[key] < 0.2) flash(key, 0.8);
    }
    LEN[key] = l;
    LX[key] = x;
    LY[key] = y;
    SX[key] = SY[key] = 0;
    CNT[key] = 0;
  }
  st.act = touched;
  const gdec = exp(-st.dt / 0.45);
  let w = 0;
  for (let q = 0; q < glowKeys.length; q++) {
    const key = glowKeys[q];
    GLOW[key] *= gdec;
    if (GLOW[key] > 0.02) glowKeys[w++] = key;
    else GLOW[key] = 0;
  }
  glowKeys.length = w;
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) init(st);
  const { USE, body, I1, I2, E, V, SIDE, RV, GLOW, glowKeys } = st;
  const h0 = 0.4 + st.k[0];
  // the colour of every cell
  const tmp = [0, 0, 0];
  for (let i = 0; i < POOL; i++) {
    if (!USE[i]) continue;
    const bd = bandOf(st, SIDE[i], V[i]);
    const hh = h0 + 0.33 * bd.w + (RV[i] - 0.5) * 0.03;
    const w = warm(hh), bl = blue(hh);
    hsv(hh, min(1, bd.s * (1 - 0.4 * w - 0.22 * bl) * (0.92 + 0.16 * fr(RV[i] * 7.31))), min(1, bd.v * (0.9 + 0.2 * fr(RV[i] * 13.7)) + 0.1 * w), tmp, 0);
    body[i * 3] = tmp[0];
    body[i * 3 + 1] = tmp[1];
    body[i * 3 + 2] = tmp[2];
  }
  cells(st);
  flashes(st);
  // walls are thinner when the cells are small
  const k = 0.78 + 0.22 * cl((st.r0 - 6.5) / 3, 0, 1);
  const anyGlow = glowKeys.length > 0;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const o = py * W + px, i = I1[o], e = E[o];
      let r = 0, g = 0, b = 0;
      if (i >= 0) {
        const f = sm(0.45 * k, 1.55 * k, e);
        const dome = 0.56 + 0.44 * sm(0.9, 4.8, e);
        const lum = 0.09 + 0.91 * f * dome;
        const cr = body[i * 3], cg = body[i * 3 + 1], cb = body[i * 3 + 2];
        r = cr * lum;
        g = cg * lum;
        b = cb * lum;
        if (anyGlow && e < 1.7) {
          const j = I2[o], gl = GLOW[i < j ? i * POOL + j : j * POOL + i] * (1 - f);
          if (gl > 0) {
            r += gl * (0.45 + 0.55 * cr);
            g += gl * (0.45 + 0.55 * cg);
            b += gl * (0.45 + 0.55 * cb);
          }
        }
      }
      display.setPixel(px, py, (min(1, r) * 255 + 0.5) | 0, (min(1, g) * 255 + 0.5) | 0, (min(1, b) * 255 + 0.5) | 0);
    }
  }
}
