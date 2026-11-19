// ===== Patternflow pattern =====
// Title:   Isthmus
// Family:  geometry
// Idea:    Two squares stand apart on one diagonal of the dark and a circle comes up the other diagonal between them, and the knob walks the circle in and holds where it first touches one square and the three pieces are two, and again where it touches the other and the three are one.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 187
// Round:   189
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Pass=0..48, Aim=-1..1
//
// Knob 1: Hue. The colour of all three, all the way round the wheel from blue.
// Knob 2: Size. The two squares, the circle and the room between them grow together: squares 12 LEDs across and a circle 16 across at the bottom of the knob, 18 and 24 where it opens at 2, 20 and 26 at the top. The squares stand 14 LEDs either side of the middle across and 10 up and down at 2, and every number is kept to whole LEDs.
// Knob 3: Pass. How far the circle has come up its line, counted in clicks. It opens at the bottom of the knob 27 LEDs down the lower left, nine clicks short of the first touch, and each click up takes it 1.2 LEDs. On click 9 it touches the upper left square and the three pieces are two; it holds there for two clicks, comes on 1.1 LEDs a click, and touches the lower right square on click 15, where the three are one, and holds for two clicks again. The click of the second touch moves with Size and Aim, from 12 to 33, and at the ends of Aim it does not come at all. It then goes on through the gap and past the middle at about 0.6 LED a click, all one piece, and stops half an LED short of letting go of the lower right square.
// Knob 4: Aim. How far the circle's line sits off the middle between the two squares, 8 LEDs at most to the lower right at the top of the knob and 8 to the upper left at the bottom. Where it opens it runs through the middle and touches the upper left square first. Aimed away from the lower right square the two touches come further apart in the knob. Aimed 2 to 4 LEDs towards it the second touch comes three clicks after the first, and past that the circle meets the lower right square first. At the ends of the knob it only ever touches one square and the three never become one.

const W = 64;
const H = 128;
// Knob 3 has 48 clicks. It opens at the bottom of the knob, FIRST clicks short of the first touch.
const CLICKS = 48;
const FIRST = 9;
// How many LEDs the third piece goes in a click on the way in and between the two touches, and the fewest clicks between them.
const STEP = 1.2;
const GAP_MIN = 3;
// The coarse and the fine step of the search for the touching positions, in LEDs.
const COARSE = 0.5;
const FINE = 0.05;

// The panel's middle, where four LEDs meet.
const CX = 32;
const CY = 64;
const R2 = Math.SQRT1_2;
// The furthest Aim slides the circle's line sideways, in LEDs each way.
const SHIFT = 8;

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
  P.p1 = p1;
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
  let ref = p1;
  let end = lastEnd - 0.5;
  if (P.join) {
    let p2 = at(ra);
    for (let a = at(ra - 1) + FINE; a < at(ra); a += FINE)
      if (pieces(P, o, a) === 1) {
        p2 = a;
        break;
      }
    let out = at(rb);
    for (let a = at(rb); a < at(rb) + COARSE; a += FINE) if (pieces(P, o, a) === 1) out = a;
    P.p2 = p2;
    // One click short of the join the third piece has touched the first and not the second.
    let pa = Math.max(p1, p2 - STEP);
    for (let i = 0; i < 60 && pa > p1 && pieces(P, o, pa) !== 2; i++) pa -= FINE;
    P.pa = pa;
    ref = p2;
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

// The squares and the circle for a Size knob value, in whole LEDs. The upper left square stands at (-gx, -gy) from the middle and the lower right one at (gx, gy), each 2h across, and the circle has radius r.
function measure(z, P) {
  const s = z < 2 ? 0.7 + 0.15 * z : 1 + 0.12 * (z - 2);
  P.h = Math.round(9 * s);
  P.gx = Math.round(14 * s);
  P.gy = Math.round(10 * s);
  P.r = Math.round(12 * s);
}

// Lights the picture with the circle p LEDs up its line, from the middle of the two squares, and the line o LEDs off to the lower right.
function light(P, o, p) {
  for (let s = 0; s < 2; s++) {
    const cx = CX + (s ? P.gx : -P.gx);
    const cy = CY + (s ? P.gy : -P.gy);
    for (let y = cy - P.h; y < cy + P.h; y++) for (let x = cx - P.h; x < cx + P.h; x++) mark(P, x, y);
  }
  const cx = CX + (o + p) * R2;
  const cy = CY + (o - p) * R2;
  const r = P.r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy < r * r) mark(P, x, y);
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
    // The circle's line, from far down the lower left to far up the upper right, in LEDs from the middle.
    lo: -40,
    hi: 40,
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
    h: 0,
    gx: 0,
    gy: 0,
    r: 0,
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
  // The last knob opens at 0.06, so 0.06 is the middle of its travel and the line runs through the middle of the two squares there.
  const u = clamp(k[3], -1, 1) - 0.06;
  const o = Math.round((SHIFT * u * 10) / (u > 0 ? 0.94 : 1.06)) / 10;
  const key = P.h + "/" + P.gx + "/" + P.gy + "/" + P.r + "/" + o;
  if (key !== params.key) {
    params.key = key;
    plan(P, o);
    route(P);
  }
  params.p = pathAt(P, clamp(k[2], 0, CLICKS));
  params.o = o;
  // Nothing on the panel moves on the clock. The light swells and falls, so the panel is never quite still.
  hsv(k[0] + 0.58, 0.45, 0.88 + 0.12 * Math.sin(t * 0.83 + 0.7), params.col);
}

export function draw(display, params, time) {
  const { P, col, p, o } = params;
  const cx = CX + (o + p) * R2;
  const cy = CY + (o - p) * R2;
  const r2 = P.r * P.r;
  const ax = CX - P.gx;
  const ay = CY - P.gy;
  const bx = CX + P.gx;
  const by = CY + P.gy;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (x >= ax - P.h && x < ax + P.h && y >= ay - P.h && y < ay + P.h) m = 1;
      else if (x >= bx - P.h && x < bx + P.h && y >= by - P.h && y < by + P.h) m = 1;
      else {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy < r2) m = 1;
      }
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
