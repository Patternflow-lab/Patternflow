// ===== Patternflow pattern =====
// Title:   Lambda Diagrams
// Family:  line
// Idea:    Church-numeral arithmetic, SUCC 2, PLUS 2 3, TIMES 2 3, EXP 2 3, TIMES 4 4 and EXP 2 4, are drawn as Tromp's lambda diagrams, every abstraction a horizontal bar, every variable a vertical line hanging from the bar that binds it and every application a link joining the leftmost lines of function and argument, and they are reduced one normal-order beta step at a time, the redex's bar with its variables lighting warm white and its argument gold before the picture cross-fades to the next term laid out afresh to fit the panel, until the normal form, a staircase comb with one tooth for each count, holds while a pulse runs down it and the next expression begins.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: lambda calculus and Church numerals (Alonzo Church, An Unsolvable Problem of Elementary Number Theory, 1936), de Bruijn indices (Nicolaas Govert de Bruijn, 1972), lambda diagrams (John Tromp), pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Expression=0..6, Glow=0..1
//
// Knob 1: Hue. Turns the palette round the wheel. At 0 the outermost bar and its variables are cyan and each deeper binder steps 0.09 round the wheel through blue and violet to magenta, links are pale, and a redex lights warm white and gold; at 0.5 the binders run red, orange, yellow and green and the redex lights pale blue and blue.
// Knob 2: Speed. At 2 a step takes 1.25 s: 0.25 s showing the term, 0.55 s lighting the redex and 0.45 s cross-fading to the result. The step times scale as 2 / Speed, so at 0.2 a step takes 12.5 s and at 3 it takes 0.83 s; the 2.6 s hold on the normal form stays as it is.
// Knob 3: Expression. 0 (the opening) runs the six expressions in turn; 1 to 6 repeats one: SUCC 2 (3 steps to 3), PLUS 2 3 (6 steps to 5), TIMES 2 3 (7 steps to 6), EXP 2 3 (16 steps to 8), TIMES 4 4 (11 steps to 16) and EXP 2 4 (32 steps to 16), whose widest term is 27 variables across, drawn at 2 LEDs a column.
// Knob 4: Glow. A halo of the lines blurred over 5 x 5 LEDs is added on top, 0.35 times at 0, 0.48 at the opening 0.06 and 2.5 times at 1, where the lines swim in their own colour and the 1-LED lines of the big terms, a pitch of 2 apart, run together into bands.

// A lambda term is variables, abstractions (lambda x. body) and
// applications (f a). Church (1936) wrote the number n as the term that
// applies f n times, lambda f. lambda x. f (f ... (f x)), and arithmetic as terms
// that take numerals apart and put them together: PLUS m n f x = m f (n f x).
// A beta step replaces (lambda x. body) a by the body with a in place of x;
// normal order always takes the leftmost, outermost such redex, and reaches
// the normal form whenever there is one.
//
// Terms are kept with de Bruijn indices: a variable is the number of
// binders between it and its own, so no name ever needs renaming.
//
// Tromp's diagram lays a term out on a grid. Each variable takes a column
// and is a vertical line from its binder's bar down to where it is used. An
// abstraction is a bar on its own row across its body's columns. An
// application puts function and argument side by side and joins their
// leftmost lines one row below the deeper of the two, the function's line
// carrying on down. The numeral n becomes two bars over a staircase of n
// links: a comb.

const W = 64, H = 128;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = frac(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Terms: { t: 0, i } a variable with its de Bruijn index (0 = the
// nearest binder), { t: 1, b } an abstraction, { t: 2, f, a } an application.
const Var = (i) => ({ t: 0, i }), Lam = (b) => ({ t: 1, b }), App = (f, a) => ({ t: 2, f, a });
const ap = (...xs) => xs.reduce((f, a) => App(f, a));
function num(n) {
  let b = Var(0);
  for (let k = 0; k < n; k++) b = App(Var(1), b);
  return Lam(Lam(b));
}
const SUCC = Lam(Lam(Lam(App(Var(1), ap(Var(2), Var(1), Var(0)))))); // n f x. f (n f x)
const PLUS = Lam(Lam(Lam(Lam(ap(Var(3), Var(1), ap(Var(2), Var(1), Var(0))))))); // m n f x. m f (n f x)
const TIMES = Lam(Lam(Lam(App(Var(2), App(Var(1), Var(0)))))); // m n f. m (n f)
const EXP = Lam(Lam(App(Var(0), Var(1)))); // m n. n m, which is m to the n
const EXPRS = [
  ap(SUCC, num(2)), ap(PLUS, num(2), num(3)), ap(TIMES, num(2), num(3)),
  ap(EXP, num(2), num(3)), ap(TIMES, num(4), num(4)), ap(EXP, num(2), num(4)),
];

function shift(t, d, c) {
  return t.t === 0 ? (t.i >= c ? Var(t.i + d) : t) : t.t === 1 ? Lam(shift(t.b, d, c + 1)) : App(shift(t.f, d, c), shift(t.a, d, c));
}
function subst(t, j, s) {
  return t.t === 0 ? (t.i === j ? s : t) : t.t === 1 ? Lam(subst(t.b, j + 1, shift(s, 1, 0))) : App(subst(t.f, j, s), subst(t.a, j, s));
}
// One normal-order step, or null at the normal form.
function step(t) {
  if (t.t === 2) {
    if (t.f.t === 1) return shift(subst(t.f.b, 0, shift(t.a, 1, 0)), -1, 0);
    const f = step(t.f);
    if (f) return App(f, t.a);
    const a = step(t.a);
    return a ? App(t.f, a) : null;
  }
  if (t.t === 1) {
    const b = step(t.b);
    return b ? Lam(b) : null;
  }
  return null;
}
const nodes = (t) => (t.t === 0 ? 1 : t.t === 1 ? 1 + nodes(t.b) : 1 + nodes(t.f) + nodes(t.a));

// ---- Layout in grid units. Segments: k 0 a bar (row r, columns c0..c1),
// 1 a variable (column c, rows r0..r1), 2 a link (row r, columns c0..c1).
// d is the depth of the binder a bar or variable belongs to. role marks the
// first redex met in the walk, which is the normal-order one: 1 its bar and
// the variables it binds, 2 its argument, 3 its link.
function lay(t, c0, r0, env, ctx, redexLam) {
  if (t.t === 0) {
    const b = env[env.length - 1 - t.i] || { row: 0, d: 0, role: 0 };
    const seg = { k: 1, c: c0, r0: b.row, r1: r0, d: b.d, role: ctx.role || b.role };
    ctx.segs.push(seg);
    return { w: 1, h: 0, left: seg };
  }
  if (t.t === 1) {
    const bar = { k: 0, c0, c1: c0, r: r0, d: env.length, role: ctx.role || (redexLam ? 1 : 0) };
    ctx.segs.push(bar);
    env.push({ row: r0, d: env.length, role: redexLam ? 1 : 0 });
    const B = lay(t.b, c0, r0 + 1, env, ctx, false);
    env.pop();
    bar.c1 = c0 + B.w - 1;
    return { w: B.w, h: B.h + 1, left: B.left };
  }
  const redex = t.f.t === 1 && !ctx.found;
  if (redex) ctx.found = true;
  const F = lay(t.f, c0, r0, env, ctx, redex);
  const outer = ctx.role;
  if (redex) ctx.role = 2;
  const A = lay(t.a, c0 + F.w, r0, env, ctx, false);
  ctx.role = outer;
  const h = max(F.h, A.h) + 1, row = r0 + h - 1;
  F.left.r1 = row;
  A.left.r1 = row;
  ctx.segs.push({ k: 2, c0: F.left.c, c1: A.left.c, r: row, d: 0, role: redex ? 3 : outer });
  return { w: F.w + A.w, h, left: F.left };
}

// The term in LED rectangles: the widest column pitch from 8 down to 2 that
// fits 62 LEDs, a row pitch up to twice that (the panel is tall) and at most
// 16 that fits 124, lines 2 LEDs thick from a pitch of 5. A bar reaches past
// its outer columns by e, which leaves at least one dark LED between two
// bars side by side on a row: none at pitch 2 and 3, 2 at pitch 7 and 8.
// null if the term cannot fit at 2 x 2.
function diagram(t) {
  const ctx = { segs: [], role: 0, found: false };
  const R = lay(t, 0, 0, [], ctx, false);
  R.left.r1 = R.h; // the root's line runs on one row: the term's output
  const w = R.w, h = R.h;
  let gx = 8;
  const ext = (g) => floor((g - (g >= 5 ? 2 : 1) - 1) / 2);
  const span = (g) => (w - 1) * g + 2 * ext(g) + (g >= 5 ? 2 : 1);
  while (gx > 2 && span(gx) > 62) gx--;
  if (span(gx) > 62) return null;
  const th = gx >= 5 ? 2 : 1, e = ext(gx);
  let gy = min(16, 2 * gx);
  while (gy > 2 && h * gy + th > 124) gy--;
  if (h * gy + th > 124) return null;
  const ox = round((W - span(gx)) / 2) + e, oy = round((H - h * gy - th) / 2);
  const X = (c) => ox + c * gx, Y = (r) => oy + r * gy;
  const rects = ctx.segs.map((s) =>
    s.k === 0 ? [X(s.c0) - e, Y(s.r), X(s.c1) + e + th - 1, Y(s.r) + th - 1, s]
    : s.k === 1 ? [X(s.c), Y(s.r0), X(s.c) + th - 1, Y(s.r1) + th - 1, s]
    : [X(s.c0), Y(s.r), X(s.c1) + th - 1, Y(s.r) + th - 1, s]);
  return { rects, redex: ctx.found, top: oy, bottom: Y(h) + th };
}

// Every term of one reduction, laid out, with a cap on steps and size so a
// term that blows up is cut off rather than drawn.
const MAX_STEPS = 60, MAX_NODES = 600;
function reduce(t0) {
  const out = [];
  for (let t = t0, n = 0; t && n <= MAX_STEPS; t = step(t), n++) {
    const dg = nodes(t) <= MAX_NODES ? diagram(t) : null;
    if (!dg) return null;
    out.push(dg);
    if (!dg.redex) return out;
  }
  return null;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, glow: 0.06, pick: -1, ex: -1, terms: null, k: 0, u: 0, phase: 0, pt: 0, fade: 1,
    a: new Float32Array(W * H * 3), b: new Float32Array(W * H * 3), out: new Float32Array(W * H * 3), tmp: new Float32Array(W * H * 3),
  };
  return params.s;
}

function start(S, ex) {
  for (let n = 0; n < EXPRS.length; n++, ex = (ex + 1) % EXPRS.length) {
    const terms = reduce(EXPRS[ex]);
    if (terms) return void Object.assign(S, { ex, terms, k: 0, phase: 0, pt: 0 });
  }
}

// Phases at Speed 2: 0 show the term 0.25 s, 1 light the redex 0.55 s, 2
// cross-fade 0.45 s; at the normal form 3 hold 2.6 s and 4 fade out 0.5 s.
const T_SHOW = 0.25, T_HI = 0.55, T_MORPH = 0.45, T_HOLD = 2.6, T_OUT = 0.5;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.terms) start(S, 0);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.glow = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const pick = round(cl(k[2] || 0, 0, 6));
  if (pick !== S.pick) (S.pick = pick), start(S, pick ? pick - 1 : 0), (S.fade = 0);
  const sc = 2 / S.speed;
  S.pt += d;
  S.fade = min(1, S.fade + d / 0.4);
  const last = S.k >= S.terms.length - 1;
  if (S.phase === 0 && S.pt >= T_SHOW * sc) (S.phase = last ? 3 : 1), (S.pt = 0);
  else if (S.phase === 1 && S.pt >= T_HI * sc) (S.phase = 2), (S.pt = 0);
  else if (S.phase === 2 && S.pt >= T_MORPH * sc) (S.k++, (S.phase = 0), (S.pt = 0));
  else if (S.phase === 3 && S.pt >= T_HOLD) (S.phase = 4), (S.pt = 0);
  else if (S.phase === 4 && S.pt >= T_OUT * min(sc, 1)) {
    start(S, S.pick ? S.pick - 1 : (S.ex + 1) % EXPRS.length);
    S.fade = 0;
  }
}

// Paint one diagram into buf at weight w; hl lights its redex, pulse (a row)
// runs a bright band down a held normal form.
function paint(S, buf, dg, w, hl, pulse) {
  const base = 0.52 + S.hue;
  const roleCol = [null, hsv(base + 0.6, 0.3, 1), hsv(base + 0.62, 0.9, 1), [1, 1, 1]];
  const link = hsv(base + 0.25, 0.15, 0.7);
  for (const [x0, y0, x1, y1, s] of dg.rects) {
    let c = s.k === 2 ? link : hsv(base + 0.09 * (s.d % 5), 0.78, 1);
    if (hl > 0) {
      const r = roleCol[s.role];
      c = r ? [c[0] + (r[0] - c[0]) * hl, c[1] + (r[1] - c[1]) * hl, c[2] + (r[2] - c[2]) * hl] : [c[0] * (1 - 0.7 * hl), c[1] * (1 - 0.7 * hl), c[2] * (1 - 0.7 * hl)];
    }
    for (let y = max(0, y0); y <= min(H - 1, y1); y++) {
      const p = pulse == null ? w : w * (0.55 + 0.75 * exp(-(((y - pulse) / 7) ** 2)));
      for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
        const j = (y * W + x) * 3;
        for (let q = 0; q < 3; q++) if (c[q] * p > buf[j + q]) buf[j + q] = c[q] * p;
      }
    }
  }
}

// A 5-wide box blur across and then down.
function blur(src, dst, tmp) {
  for (let y = 0; y < H; y++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let x = -2; x < W + 2; x++) {
        if (x + 2 < W) s += src[(y * W + x + 2) * 3 + c];
        if (x - 3 >= 0) s -= src[(y * W + x - 3) * 3 + c];
        if (x >= 0 && x < W) tmp[(y * W + x) * 3 + c] = s / 5;
      }
    }
  for (let x = 0; x < W; x++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let y = -2; y < H + 2; y++) {
        if (y + 2 < H) s += tmp[((y + 2) * W + x) * 3 + c];
        if (y - 3 >= 0) s -= tmp[((y - 3) * W + x) * 3 + c];
        if (y >= 0 && y < H) dst[(y * W + x) * 3 + c] = s / 5;
      }
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.terms) return;
  const sc = 2 / S.speed, A = S.a, B = S.b, O = S.out;
  A.fill(0);
  B.fill(0);
  const cur = S.terms[S.k], fade = smooth(S.fade);
  if (S.phase === 0) paint(S, A, cur, fade, 0, null);
  else if (S.phase === 1) paint(S, A, cur, fade, smooth(S.pt / (0.35 * T_HI * sc)), null);
  else if (S.phase === 2) {
    const u = smooth(S.pt / (T_MORPH * sc));
    paint(S, A, cur, 1 - u, 1, null);
    paint(S, B, S.terms[S.k + 1], u, 0, null);
  } else {
    // The pulse runs from the top bar to the end of the output line in 1.3 s, twice.
    const pulse = cur.top - 10 + ((S.pt % 1.3) / 1.3) * (cur.bottom - cur.top + 20);
    const out = S.phase === 4 ? 1 - smooth(S.pt / (T_OUT * min(sc, 1))) : 1;
    paint(S, A, cur, out, 0, S.phase === 3 && S.pt < 2.6 ? pulse : null);
  }
  for (let i = 0; i < A.length; i++) A[i] += B[i];
  blur(A, O, S.tmp);
  const g = 0.35 + 2.15 * S.glow;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3;
      display.setPixel(x, y, round(cl((A[j] + g * O[j]) * 255, 0, 255)), round(cl((A[j + 1] + g * O[j + 1]) * 255, 0, 255)), round(cl((A[j + 2] + g * O[j + 2]) * 255, 0, 255)));
    }
}
