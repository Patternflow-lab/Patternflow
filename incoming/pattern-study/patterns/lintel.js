// ===== Patternflow pattern =====
// Title:   Lintel
// Family:  geometry
// Idea:    Two bars reach out from the two side walls at slightly different heights with a gap between their ends, and a square comes down through the gap from above: the knob lowers it and holds where it first lands on one bar and the three pieces are two, and again where it lands on the other and the three are one.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 187
// Round:   189
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Drop=0..48, Side=-1..1
//
// Knob 1: Hue. The colour of all three, all the way round the wheel from green.
// Knob 2: Size. The bars, the gap between their ends and the square grow together: bars 6 LEDs thick, the right one 4 lower, a gap of 10 and a square 18 across at the bottom of the knob, 9 thick, 6 lower, 14 and 26 where it opens at 2, and 10 thick, 7 lower, 16 and 30 at the top. The gap and the square are even, so the square overhangs both bar ends by the same whole number of LEDs.
// Knob 3: Drop. How far the square has come down, counted in clicks. It opens at the bottom of the knob with its lower edge 11 LEDs above the left bar, nine clicks short of the first landing, and each click up takes it 1.2 LEDs. On click 9 it lands on the left bar, a LED down into it, and the three pieces are two; the knob holds there for two clicks. It comes on 1.1 LEDs a click and lands on the right bar on click 14, where the three are one, and holds for two clicks again. The click of the second landing moves with Size and Side, from 12 to 15. The square then goes on down through the gap at about 0.85 LED a click, all one piece, to half an LED short of its top clearing the left bar.
// Knob 4: Side. How far the square sits off the middle of the gap, 12 LEDs at most each way. Where it opens it overhangs each bar end by 6 LEDs (4 at the bottom of Size, 7 at the top). Slid by more than the overhang it clears one of the bars and only ever lands on the other, so the three never become one.

const W = 64;
const H = 128;
// Knob 3 has 48 clicks. It opens at the bottom of the knob, FIRST clicks short of the first touch.
const CLICKS = 48;
const FIRST = 9;
// How many LEDs the third piece goes in a click on the way in and between the two touches, and the fewest clicks between them.
const STEP = 1.2;
const GAP_MIN = 3;
// How far past the first LED of a touch the knob holds, in LEDs. A circle that only just reaches a straight edge meets it in one pair of LEDs, which the eye does not take for a touch. A LED further it has pressed into the edge a few LEDs wide.
const HOLD = 1;
// The coarse and the fine step of the search for the touching positions, in LEDs.
const COARSE = 0.5;
const FINE = 0.05;

// The middle of the two bars' heights, and the middle of the gap between their ends.
const YC = 92;
const CX = 32;
// The furthest Side slides the square, in LEDs each way.
const SHIFT = 12;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Lights the LED at (x, y) and notes it in the list of lit LEDs, once.
function mark(P, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const k = y * W + x;
  if (P.g[k] === 0) {
    P.g[k] = 1;
    P.lit[P.m++] = k;
  }
}

// How many separate pieces of lit LEDs the picture is in, joined by LEDs side by side. Lit LEDs are all the same brightness, so this is the count a picture of the panel shows.
function count(P) {
  const g = P.g;
  const stack = P.stack;
  const lit = P.lit;
  const m = P.m;
  let n = 0;
  for (let a = 0; a < m; a++) {
    const k = lit[a];
    if (g[k] !== 1) continue;
    n++;
    let top = 0;
    stack[top++] = k;
    g[k] = 2;
    while (top > 0) {
      const q = stack[--top];
      const qi = q % W;
      if (qi > 0 && g[q - 1] === 1) {
        g[q - 1] = 2;
        stack[top++] = q - 1;
      }
      if (qi < W - 1 && g[q + 1] === 1) {
        g[q + 1] = 2;
        stack[top++] = q + 1;
      }
      if (q >= W && g[q - W] === 1) {
        g[q - W] = 2;
        stack[top++] = q - W;
      }
      if (q < W * (H - 1) && g[q + W] === 1) {
        g[q + W] = 2;
        stack[top++] = q + W;
      }
    }
  }
  return n;
}

function pieces(P, o, p) {
  P.g.fill(0);
  P.m = 0;
  light(P, o, p);
  return count(P);
}

// Where the third piece first touches and where it joins the two, found from the size and the path by lighting the picture LED by LED. The scan goes up the path in coarse steps, then each edge is found finely. Positions are LEDs along the path.
function plan(P, o) {
  const n = Math.round((P.hi - P.lo) / COARSE) + 1;
  const c = P.cs;
  for (let k = 0; k < n; k++) c[k] = pieces(P, o, P.lo + k * COARSE);
  const at = (k) => P.lo + k * COARSE;
  // The last place the third piece touches anything. From there the scan walks down, because the edges are steps of LEDs and can touch a piece for an instant before they touch it for good.
  let last = -1;
  for (let k = n - 1; k >= 0; k--)
    if (c[k] < 3) {
      last = k;
      break;
    }
  P.touch = last >= 0;
  if (!P.touch) {
    P.join = false;
    P.p1 = P.pre1 = P.pend = P.lo;
    return;
  }
  let k1 = last;
  while (k1 > 0 && c[k1 - 1] < 3) k1--;
  let p1 = at(k1);
  for (let a = at(k1 - 1) + FINE; a < at(k1); a += FINE)
    if (pieces(P, o, a) < 3) {
      p1 = a;
      break;
    }
  // One click short of the touch the third piece is a click's step back, as long as the picture there is still three pieces.
  let pre = p1 - STEP;
  for (let i = 0; i < 60 && pieces(P, o, pre) !== 3; i++) pre -= FINE;
  P.pre1 = pre;
  // Where the last touch lets go.
  let lastEnd = at(last);
  for (let a = at(last); a < at(last) + COARSE; a += FINE) if (pieces(P, o, a) < 3) lastEnd = a;
  // The longest run of one piece is where the third piece holds the other two.
  let ra = -1;
  let rb = -1;
  let best = 0;
  for (let k = 0; k < n; ) {
    if (c[k] !== 1) {
      k++;
      continue;
    }
    let e = k;
    while (e + 1 < n && c[e + 1] === 1) e++;
    if (e - k + 1 > best) {
      best = e - k + 1;
      ra = k;
      rb = e;
    }
    k = e + 1;
  }
  P.join = ra >= 0;
  let end = lastEnd - 0.5;
  let ref;
  if (!P.join) {
    P.p1 = p1 + Math.min(HOLD, 0.5 * (lastEnd - p1));
    ref = P.p1;
  } else {
    let p2 = at(ra);
    for (let a = at(ra - 1) + FINE; a < at(ra); a += FINE)
      if (pieces(P, o, a) === 1) {
        p2 = a;
        break;
      }
    let out = at(rb);
    for (let a = at(rb); a < at(rb) + COARSE; a += FINE) if (pieces(P, o, a) === 1) out = a;
    P.p1 = p1 + Math.min(HOLD, 0.5 * (p2 - p1));
    P.p2 = p2 + Math.min(HOLD, 0.5 * (out - p2));
    // One click short of the join the third piece has touched the first and not the second.
    let pa = Math.max(P.p1, p2 - STEP);
    for (let i = 0; i < 60 && pa > P.p1 && pieces(P, o, pa) !== 2; i++) pa -= FINE;
    P.pa = pa;
    ref = P.p2;
    end = out - 0.5;
  }
  P.pend = Math.max(ref + 0.3, Math.min(end, ref + P.tail));
}

// Fills the click to position map for the plan: corners (click, position) joined by straight lines. Click 0 is where the knob opens, FIRST clicks short of the first touch.
function route(P) {
  const qs = P.qs;
  const ps = P.ps;
  let n = 0;
  const add = (q, p) => {
    qs[n] = q;
    ps[n] = p;
    n++;
  };
  if (!P.touch) {
    add(0, P.lo);
    add(CLICKS, P.hi);
    P.n = n;
    return;
  }
  add(0, P.pre1 - STEP * (FIRST - 1));
  add(FIRST - 1, P.pre1);
  add(FIRST, P.p1);
  add(FIRST + 1, P.p1);
  if (P.join) {
    // As many clicks between the touches as it takes to cross at a click's step. The click after each hold takes a full step, so a hold is two clicks and no more.
    const gap = clamp(2 + Math.round((P.pa - P.p1) / STEP), GAP_MIN, 30);
    const s2 = FIRST + gap;
    add(s2 - 1, P.pa);
    add(s2, P.p2);
    add(s2 + 1, P.p2);
    add(s2 + 2, Math.min(P.pend, P.p2 + STEP));
    P.s2 = s2;
  } else add(FIRST + 2, Math.min(P.pend, P.p1 + STEP));
  add(CLICKS, P.pend);
  P.n = n;
}

function pathAt(P, q) {
  const qs = P.qs;
  const ps = P.ps;
  if (q <= qs[0]) return ps[0];
  for (let i = 1; i < P.n; i++) {
    if (q <= qs[i]) {
      const w = qs[i] - qs[i - 1];
      return w > 0 ? ps[i - 1] + ((ps[i] - ps[i - 1]) * (q - qs[i - 1])) / w : ps[i];
    }
  }
  return ps[P.n - 1];
}

// The bars and the square for a Size knob value, in whole LEDs. The bars are t thick and the right one stands d lower, the gap between their ends is gw and the square is sq across.
function measure(z, P) {
  const s = z < 2 ? 0.7 + 0.15 * z : 1 + 0.12 * (z - 2);
  P.gw = 2 * Math.round(7 * s);
  P.sq = 2 * Math.round(13 * s);
  P.t = Math.round(9 * s);
  P.d = Math.round(6 * s);
  P.yb = YC - Math.round((P.t + P.d) / 2);
}

// Lights the picture with the square's bottom edge at y = p, moved o LEDs along.
function light(P, o, p) {
  const gl = CX - P.gw / 2;
  const gr = CX + P.gw / 2;
  for (let y = P.yb; y < P.yb + P.t; y++) for (let x = 0; x < gl; x++) mark(P, x, y);
  for (let y = P.yb + P.d; y < P.yb + P.d + P.t; y++) for (let x = gr; x < W; x++) mark(P, x, y);
  const left = CX + o - P.sq / 2;
  const right = CX + o + P.sq / 2;
  for (let y = Math.max(0, Math.floor(p - P.sq)); y <= Math.min(H - 1, Math.ceil(p)); y++) {
    if (!(y + 0.5 >= p - P.sq && y + 0.5 < p)) continue;
    for (let x = Math.max(0, Math.floor(left)); x <= Math.min(W - 1, Math.ceil(right)); x++) if (x + 0.5 >= left && x + 0.5 < right) mark(P, x, y);
  }
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.P = {
    g: new Uint8Array(W * H),
    stack: new Int32Array(W * H),
    lit: new Int32Array(W * H),
    m: 0,
    cs: new Int8Array(400),
    // The square's bottom edge, from the top of the panel to the bottom of it.
    lo: 4,
    hi: 128,
    tail: 1e9,
    qs: new Float32Array(10),
    ps: new Float32Array(10),
    n: 0,
    touch: false,
    join: false,
    p1: 0,
    pre1: 0,
    p2: 0,
    pa: 0,
    pend: 0,
    s2: 0,
    gw: 0,
    sq: 0,
    t: 0,
    d: 0,
    yb: 0,
  };
  params.key = "";
  params.p = 0;
  params.o = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const P = params.P;
  measure(clamp(k[1], 0, 3), P);
  // The last knob opens at 0.06, so 0.06 is the middle of its travel and the square is over the middle of the gap there.
  const u = clamp(k[3], -1, 1) - 0.06;
  const o = Math.round((SHIFT * u * 10) / (u > 0 ? 0.94 : 1.06)) / 10;
  const key = P.gw + "/" + P.sq + "/" + P.t + "/" + P.d + "/" + o;
  if (key !== params.key) {
    params.key = key;
    plan(P, o);
    route(P);
  }
  params.p = pathAt(P, clamp(k[2], 0, CLICKS));
  params.o = o;
  // Nothing on the panel moves on the clock. The light swells and falls, so the panel is never quite still.
  hsv(k[0] + 0.35, 0.45, 0.88 + 0.12 * Math.sin(t * 0.83 + 4.2), params.col);
}

export function draw(display, params, time) {
  const { P, col, p, o } = params;
  const gl = CX - P.gw / 2;
  const gr = CX + P.gw / 2;
  const left = CX + o - P.sq / 2;
  const right = CX + o + P.sq / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (y >= P.yb && y < P.yb + P.t && x < gl) m = 1;
      else if (y >= P.yb + P.d && y < P.yb + P.d + P.t && x >= gr) m = 1;
      else if (y + 0.5 >= p - P.sq && y + 0.5 < p && x + 0.5 >= left && x + 0.5 < right) m = 1;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
