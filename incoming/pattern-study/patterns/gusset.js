// ===== Patternflow pattern =====
// Title:   Gusset
// Family:  geometry
// Idea:    A long bar and a shorter one lie one above the other with a gap between them, and a tall bar slides in from the side: the knob walks it across and holds where it first meets the end of the long bar and the three pieces are two, and again where it meets the short one and the three are one.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 187
// Round:   189
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Slide=0..48, Lift=-1..1
//
// Knob 1: Hue. The colour of all three, all the way round the wheel from orange.
// Knob 2: Size. The bars, the gap between them and the tall bar grow together: bars 9 LEDs thick and 4 apart with a tall bar 9 across and 30 high at the bottom of the knob, 13 thick and 6 apart with a tall bar 13 across and 44 high where it opens at 2, and 15 thick and 6 apart with a tall bar 15 across and 50 high at the top. The long bar always starts at x = 26 and the short one starts 12 LEDs further on at 2 (8 at 0, 13 at 3). Both end at x = 62.
// Knob 3: Slide. How far the tall bar has come in from the left, counted in clicks. It opens at the bottom of the knob with its left edge 2 LEDs from the left wall, nine clicks short of the first meeting, and each click up takes it 1.2 LEDs. On click 9 it meets the end of the long bar and the three pieces are two; it holds there for two clicks, comes on, and meets the end of the short bar on click 20 where the three are one, and holds for two clicks again. The click of the second meeting moves with Size and Lift, from 17 to 22. It then goes on about 0.9 LED a click, all one piece, until its right edge is level with the ends of the bars.
// Knob 4: Lift. How far the tall bar sits above or below the middle of the gap, 22 LEDs at most each way. Where it opens it is centred on the gap and stands 6 LEDs above the long bar and 6 below the short one. Lifted or lowered by 19 LEDs or more at Size 2 it clears one of the bars, and then it only ever meets the other and the three never become one.

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

// The right end of both lying bars, the left end of the long one and the middle of the gap between them.
const XR = 62;
const XU = 26;
const YC = 48;
// The furthest Lift raises or lowers the tall bar, in LEDs.
const SHIFT = 22;

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

// The bars for a Size knob value, in whole LEDs. Both lying bars are t thick with a gap of gp between them, the long one starts at XU and the short one xl, and the tall bar is wb wide and hb tall.
function measure(z, P) {
  const s = z < 2 ? 0.7 + 0.15 * z : 1 + 0.12 * (z - 2);
  P.t = Math.max(6, Math.round(13 * s));
  P.gp = 2 * Math.round(3 * s);
  P.wb = Math.round(13 * s);
  P.hb = 2 * Math.round(22 * s);
  P.xl = XU + Math.round(12 * s);
  P.yu = YC - P.gp / 2 - P.t;
  P.yl = YC + P.gp / 2;
  // Once the tall bar has met the bars it goes on until its right edge is level with their right ends.
  P.tail = XR - P.xl - 0.5;
}

// Lights the picture with the tall bar's right edge at x = p, raised o LEDs.
function light(P, o, p) {
  for (let y = P.yu; y < P.yu + P.t; y++) for (let x = XU; x < XR; x++) mark(P, x, y);
  for (let y = P.yl; y < P.yl + P.t; y++) for (let x = P.xl; x < XR; x++) mark(P, x, y);
  const top = YC + o - P.hb / 2;
  const bot = YC + o + P.hb / 2;
  for (let y = Math.max(0, Math.floor(top)); y <= Math.min(H - 1, Math.ceil(bot)); y++) {
    if (!(y + 0.5 >= top && y + 0.5 < bot)) continue;
    for (let x = Math.max(0, Math.floor(p - P.wb)); x <= Math.min(W - 1, Math.ceil(p)); x++) if (x + 0.5 >= p - P.wb && x + 0.5 < p) mark(P, x, y);
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
    // The tall bar's right edge, from the left wall to the right one.
    lo: 2,
    hi: 63,
    tail: 0,
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
    t: 0,
    gp: 0,
    wb: 0,
    hb: 0,
    xl: 0,
    yu: 0,
    yl: 0,
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
  // The last knob opens at 0.06, so 0.06 is the middle of its travel and the tall bar is centred on the gap there.
  const u = clamp(k[3], -1, 1) - 0.06;
  const o = Math.round((SHIFT * u * 10) / (u > 0 ? 0.94 : 1.06)) / 10;
  const key = P.t + "/" + P.gp + "/" + P.wb + "/" + P.hb + "/" + P.xl + "/" + o;
  if (key !== params.key) {
    params.key = key;
    plan(P, o);
    route(P);
  }
  params.p = pathAt(P, clamp(k[2], 0, CLICKS));
  params.o = o;
  // Nothing on the panel moves on the clock. The light swells and falls, so the panel is never quite still.
  hsv(k[0] + 0.1, 0.45, 0.88 + 0.12 * Math.sin(t * 0.83 + 2.1), params.col);
}

export function draw(display, params, time) {
  const { P, col, p, o } = params;
  const top = YC + o - P.hb / 2;
  const bot = YC + o + P.hb / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (y >= P.yu && y < P.yu + P.t && x >= XU && x < XR) m = 1;
      else if (y >= P.yl && y < P.yl + P.t && x >= P.xl && x < XR) m = 1;
      else if (y + 0.5 >= top && y + 0.5 < bot && x + 0.5 >= p - P.wb && x + 0.5 < p) m = 1;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
