// ===== Patternflow pattern =====
// Title:   Rational Tangles
// Family:  topology
// Idea:    Two coloured ropes hang down the tall panel as a four-strand plat, capped at the top and loose at the bottom, and Conway's tangle dance plays on them: a twist T swaps the two middle ends at the foot so that the ropes really wind one more crossing in (x to x + 1), a rotate R carries all four ends one place round (x to -1/x), the fraction p/q in small figures changes with each call, and after a random string of calls the bottom ends close up into the two-bridge knot or link N(p/q), named by Schubert's classification, open again, and Conway's rule, rotate when positive and twist when negative, untangles the ropes back to 0.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rational tangles and their fractions (John H. Conway, "An enumeration of knots and links, and some of their algebraic properties", 1970) and the square dance of twists and rotations he used to show them; classification of two-bridge knots and links (Horst Schubert, "Knoten mit zwei Brücken", 1956); 3 by 5 capitals from Typewriter (pattern round 18) and 3 by 5 figures from Josephus (pattern round 68); pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=6..14, Rope=-1..1
//
// Knob 1: Hue. Turns both ropes round the wheel together. At 0 rope A, the one capped on the left at [0], is cyan and rope B amber; at 0.5 A is red and B azure. Each rope keeps its colour through every call. A closed knot is one loop, so one rope takes the other's colour while the ends join; a closed link keeps both. The fraction is white, the calls grey, the undoing calls tinted like rope A, the name amber.
// Knob 2: Speed. At 2 a call takes 0.75 s and a pause of 0.25 s, the ropes settle into the simplest picture in 0.45 s after one call in five, the ends close in 0.8 s, the knot holds for 2.6 s and opens in 0.8 s, and the dance waits 1.2 s at 0, so a dance lasts 21 s on average at Depth 6 and 36 s at 14. Everything scales as 2 / Speed: at 0.2 a call takes 7.5 s, at 3 half a second.
// Knob 3: Depth. How many calls build the tangle, 6 to 14, drawn at random, T 65 times in 100, never R twice running and never R at 0, which would give 1/0, where a twist changes nothing. A dance is kept when it ends at p/q with |p| at least 3, holds at least 1 + floor((Depth - 6) / 4) calls of R (1 up to 9, 3 at 14) and never needs more than 12 crossings. At 6 the closure is a trefoil about two times in three and a figure-eight otherwise; at 10 it ranges over 4/1, 7/4, 10/7, 8/3, 13/8 and some thirty more. A crossing is 88 rows over the most crossings the dance will need, 16 at most: 16 at Depth 6, a median 14.7 at 8 and 10 and 12.6 at 12 and 14, 8.8 at the least. Conway's rule then undoes the tangle in 8 calls on average at Depth 6 and 14 at 14.
// Knob 4: Rope. The rope's width, 3 x 2^Rope LEDs: 1.5 at -1, 3.1 at the opening 0.06 and 6 at 1, where the ropes nearly fill the 14 LEDs between neighbouring strands. The gap left where a rope passes under grows with it.
// Buttons: K1 tap starts a new dance from 0.

// A rational tangle is two strings in a ball with their four ends on the
// boundary, NW, NE, SE and SW. Conway gave each one a fraction: [0] is two
// arcs joining NW to NE and SW to SE, twisting the two right ends adds 1,
// and turning the ball a quarter turn sends x to -1/x. Every rational tangle
// is reached from [0] by twists and turns, and two are the same tangle
// exactly when their fractions agree (Conway 1970; full proofs by Jay
// Goldman and Louis Kauffman, 1997, and Kauffman and Sofia Lambropoulou,
// 2004). Conway showed it with four people holding two ropes: on "twist"
// the two on the right swap places, one passing under the other's rope; on
// "rotate" all four step one place round; and to untangle any tangle, rotate
// when its fraction is positive and twist when it is negative.
// Closing NW to NE and SW to SE, the numerator closure, gives the
// two-bridge link b(p, q); Schubert showed in 1956 that b(p, q) and b(p', q')
// are the same unoriented link exactly when p = p' and q' = q or q q' = 1
// mod p, and allowing mirror images, q' = -q or q q' = -1 as well.
//
// The panel draws the tangle as a plat: four lanes across the panel, ends 1
// to 4 at the foot standing for NW, NE, SE and SW. The top is closed by caps,
// 1-2 and 3-4 for [0], 2-3 inside 1-4 for [1/0]. Below come crossings, each
// between lanes 2 and 3 (a horizontal twist, H) or lanes 1 and 2 (a vertical
// twist, V, the twist of NW and NE). A T adds an H crossing at the foot, or
// takes one away if the last crossing there was the opposite hand. An R
// moves every end one place round the boundary: a crossing of lanes 2 and 3
// becomes one of lanes 3 and 4, which on a rational tangle is the same as
// one of lanes 1 and 2 (a flype), one of lanes 1 and 2 becomes one of 2 and
// 3, every crossing keeps its hand and the caps swap. Worked through the
// fractions that is x to -1/x. The picture is then the alternating one of
// the regular continued fraction, all crossings of one sign alternating over
// and under. A call that leaves a picture of another form, mostly a T just
// after an R, is followed by the ropes settling into this one, their four
// ends held still. Which hand counts as +1 is a convention;
// the other choice would show every fraction as its negative, the mirror.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, sign, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const gcd = (a, b) => {
  (a = abs(a)), (b = abs(b));
  while (b) [a, b] = [b, a % b];
  return a;
};
// The lanes' centres, the top of the crossings, the foot, the most crossings.
const X = [10.5, 24.5, 38.5, 52.5], YS = 28, YE = 116, MAXC = 12;
// Seconds at Speed 2.
const T_MOVE = 0.75, T_SETTLE = 0.45, T_PAUSE = 0.25, T_CLOSE = 0.8, T_HOLD = 2.6, T_REST = 1.2;

// ---- Fractions: p / q with q >= 0, 1/0 for infinity.
function norm(p, q) {
  if (q < 0 || (q === 0 && p < 0)) (p = -p), (q = -q);
  const g = gcd(p, q) || 1;
  return [p / g, q / g];
}
const twist = ([p, q]) => (q === 0 ? [1, 0] : norm(p + q, q));
const turn = ([p, q]) => norm(-q, p);

// ---- Diagrams: caps 0 or 1, and crossings from the top, each { p, o }:
// p 1 between lanes 2 and 3, p 0 between lanes 1 and 2; o +1 when the
// strand going down to the right passes over, -1 when it passes under.
// The regular continued fraction, peeled from the foot: an H run of the
// whole part while |x| >= 1, else a V run of the whole part of 1/x.
function canon(p, q) {
  const runs = [];
  let caps;
  for (;;) {
    if (q === 0) {
      caps = 1;
      break;
    }
    if (p === 0) {
      caps = 0;
      break;
    }
    if (abs(p) >= q) {
      const a = sign(p) * floor(abs(p) / q);
      p -= a * q;
      runs.push([1, a]);
    } else {
      const b = sign(p) * floor(q / abs(p));
      q -= b * p;
      runs.push([0, b]);
    }
  }
  const steps = [];
  for (let i = runs.length - 1; i >= 0; i--) {
    const [t, a] = runs[i];
    for (let k = 0; k < abs(a); k++) steps.push({ p: t, o: t ? sign(a) : -sign(a) });
  }
  return { caps, steps };
}
// The literal moves on a picture.
function litT(D) {
  const st = D.steps.slice(), l = st[st.length - 1];
  if (l && l.p === 1 && l.o === -1) st.pop();
  else st.push({ p: 1, o: 1 });
  return { caps: D.caps, steps: st };
}
const litR = (D) => ({ caps: D.caps ^ 1, steps: D.steps.map((s) => ({ p: s.p ^ 1, o: s.o })) });
const same = (A, B) => A.caps === B.caps && A.steps.length === B.steps.length && A.steps.every((s, i) => s.p === B.steps[i].p && s.o === B.steps[i].o);
// Which rope (0 or 1) runs in each lane below the last crossing.
function ropesAtFoot(D) {
  const r = D.caps ? [1, 0, 0, 1] : [0, 0, 1, 1];
  for (const s of D.steps) [r[s.p], r[s.p + 1]] = [r[s.p + 1], r[s.p]];
  return r;
}

// ---- Names of N(p/q), keyed by p and the least of q, -q, 1/q and -1/q
// mod p, with Rolfsen's table numbers; "^2_1" is superscript 2, subscript 1.
const NAMES = {
  "2/1": "HOPF LINK", "3/1": "TREFOIL 3_1", "4/1": "SOLOMON 4^2_1", "5/1": "CINQUEFOIL 5_1", "5/2": "FIGURE-8 4_1",
  "6/1": "LINK 6^2_1", "7/1": "KNOT 7_1", "7/2": "KNOT 5_2", "8/3": "WHITEHEAD 5^2_1",
  "9/1": "KNOT 9_1", "9/2": "STEVEDORE 6_1", "10/3": "LINK 6^2_2", "11/2": "KNOT 7_2", "11/3": "KNOT 6_2",
  "12/5": "LINK 6^2_3", "13/3": "KNOT 7_3", "13/5": "KNOT 6_3", "15/4": "KNOT 7_4", "17/5": "KNOT 7_5",
  "19/7": "KNOT 7_6", "21/8": "KNOT 7_7",
};
function inverse(q, p) {
  for (let k = 1; k < p; k++) if ((q * k) % p === 1) return k;
  return 0;
}
function nameOf([p, q]) {
  p = abs(p);
  if (p === 0) return "UNLINK";
  if (p === 1) return "UNKNOT 0_1";
  const r = ((q % p) + p) % p, iv = inverse(r, p), c = min(r, p - r, iv, p - iv);
  const key = p + "/" + c;
  if (NAMES[key]) return NAMES[key];
  // Unnamed here: the crossing number, the sum of the continued fraction.
  let a = p, b = c, n = 0;
  while (b) (n += floor(a / b)), ([a, b] = [b, a % b]);
  return n + "-CROSSING " + (p % 2 ? "KNOT" : "LINK");
}

// ---- 3 x 5 capitals from Typewriter (copied from autogram.js), 3 x 5
// figures from Josephus (copied from josephus.js), and a slash and a
// lemniscate drawn here.
const G35 = {
  A: "010101111101101", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "011100101101011", H: "101101111101101", I: "111010010010111", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", Q: "010101101111011",
  R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101011", V: "101101101010010",
  W: "101101111111101", "-": "000000111000000", "/": "001001010100100",
};
const FIG = [0b111101101101111, 0b010110010010111, 0b111001111100111, 0b111001111001111, 0b101101111001001, 0b111100111001111, 0b111100111101111, 0b111001001001001, 0b111101111101111, 0b111101111001111];
const LEMNI = ".#.#." + "#.#.#" + ".#.#.";

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The dance: the calls that build it and Conway's calls that undo it,
// each with the picture before it (from), the literal picture after it (L)
// and the alternating one (C). Ropes are labelled from the caps down, so a
// new picture can swap the labels; f says which label rope A has, chosen so
// that each rope keeps its colour: an R carries the end in lane i to lane
// i + 1, and while the ropes settle no end moves.
function step(m, x, D, f) {
  const nx = m === "T" ? twist(x) : turn(x), L = m === "T" ? litT(D) : litR(D), C = canon(nx[0], nx[1]);
  const a = ropesAtFoot(D), b = ropesAtFoot(L), c = ropesAtFoot(C);
  const fL = m === "R" ? b[1] ^ a[0] ^ f : f, fC = c[0] ^ b[0] ^ fL;
  return { m, x: nx, L, C, from: D, f0: f, fL, fC };
}
function plan(depth) {
  let best = null;
  for (let tries = 0; tries < 60; tries++) {
    let x = [0, 1], D = canon(0, 1), last = "", peak = 0, f = 0;
    const build = [];
    for (let i = 0; i < depth; i++) {
      // A turn of [0] would give 1/0, where a twist changes nothing and only
      // a second turn, undoing the first, could follow.
      let m = Math.random() < 0.65 ? "T" : "R";
      if (x[0] === 0 || last === "R") m = "T";
      const c = step(m, x, D, f);
      build.push(c);
      peak = max(peak, c.L.steps.length, c.C.steps.length);
      (x = c.x), (D = c.C), (f = c.fC), (last = m);
    }
    const undo = [];
    for (let k = 0; k < 60 && !(x[0] === 0 && x[1] === 1); k++) {
      const c = step(x[1] === 0 || x[0] > 0 ? "R" : "T", x, D, f);
      undo.push(c);
      peak = max(peak, c.L.steps.length, c.C.steps.length);
      (x = c.x), (D = c.C), (f = c.fC);
    }
    const end = build[build.length - 1].x, turns = build.filter((c) => c.m === "R").length;
    const good = abs(end[0]) >= 3 && turns >= 1 + floor((depth - 6) / 4) && peak <= MAXC;
    best = { build, undo, peak, end };
    if (good) break;
  }
  return best;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, depth: 6, width: 3.1, btn: false, started: false,
    acc: new Float32Array(W * H * 3), buf: new Float32Array(W * H * 3),
  };
  return params.s;
}

function newDance(S) {
  const P = (S.plan = plan(S.depth));
  S.h = cl(88 / max(3, P.peak), 6, 16);
  S.calls = [...P.build.map((c) => ({ ...c, undo: false })), { close: true }, ...P.undo.map((c) => ({ ...c, undo: true }))];
  S.k = -1;
  S.pt = 0;
  S.x = [0, 1];
  S.D = canon(0, 1);
  S.f = 0;
  S.said = "";
  S.undoSaid = "";
  S.stage = "rest0";
}

// Stages: a call (move, then settle), the closing, the hold, the opening,
// the rest at 0. The stage clock is in seconds at Speed 2.
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const depth = round(cl(k[2] == null ? 6 : k[2], 6, 14)), btn = !!(input.btnPressed && input.btnPressed[0]);
  S.width = 3 * 2 ** cl(k[3] == null ? 0.06 : k[3], -1, 1);
  if (!S.started || depth !== S.depth || (btn && !S.btn)) {
    S.depth = depth;
    S.started = true;
    newDance(S);
  }
  S.btn = btn;
  S.pt += (d * S.speed) / 2;
  for (let guard = 0; guard < 4; guard++) {
    const c = S.calls[S.k];
    if (S.stage === "rest0") {
      if (S.pt < (S.k < 0 ? 0.6 : T_REST)) break;
      if (S.k >= 0) return void newDance(S);
      next(S);
    } else if (S.stage === "move") {
      if (S.pt < T_MOVE) break;
      S.pt -= T_MOVE;
      S.x = c.x;
      S.D = c.L;
      S.f = c.fL;
      S.stage = same(c.L, c.C) ? "pause" : "settle";
    } else if (S.stage === "settle") {
      if (S.pt < T_SETTLE) break;
      S.pt -= T_SETTLE;
      S.D = c.C;
      S.f = c.fC;
      S.stage = "pause";
    } else if (S.stage === "pause") {
      if (S.pt < T_PAUSE) break;
      S.pt -= T_PAUSE;
      next(S);
    } else if (S.stage === "close") {
      if (S.pt < T_CLOSE) break;
      (S.pt -= T_CLOSE), (S.stage = "hold");
    } else if (S.stage === "hold") {
      if (S.pt < T_HOLD) break;
      (S.pt -= T_HOLD), (S.stage = "open");
    } else if (S.stage === "open") {
      if (S.pt < T_CLOSE) break;
      S.pt -= T_CLOSE;
      next(S);
    } else break;
  }
}

function next(S) {
  S.k++;
  const c = S.calls[S.k];
  if (!c) return void ((S.stage = "rest0"), (S.pt = 0));
  if (c.close) return void (S.stage = "close");
  S.stage = "move";
  if (c.undo) S.undoSaid += c.m;
  else S.said += c.m;
}

// ---- Drawing. Ropes are drawn row by row: in a crossing the two strands
// follow x = mid -+ d cos(theta t) down its height, so a whole crossing is
// a half turn of the pair, and a twist that is still under way is the same
// picture with theta short of pi, its foot still turning.

function putRope(acc, x, y, xc, hw, col, lv, cut) {
  const off = x + 0.5 - xc, cov = cl(hw + 0.5 - abs(off), 0, 1) * lv * cut;
  if (cov <= 0) return;
  // Round: darker towards the edges; laid: a slanting strand every 3 rows.
  const u = off / max(hw, 0.6), lay = 0.82 + 0.18 * cos(2 * PI * ((y + 0.5) / 3.2 + 0.35 * u));
  const v = (1 - 0.45 * u * u) * lay, k = (y * W + x) * 3;
  for (let q = 0; q < 3; q++) acc[k + q] = acc[k + q] * (1 - cov) + col[q] * v * cov;
}
function strandRow(acc, y, xc, slope, w, col, lv, mask) {
  const hw = (w / 2) * sqrt(1 + slope * slope);
  for (let x = max(0, floor(xc - hw - 1)); x <= min(W - 1, floor(xc + hw + 1)); x++) {
    let cut = 1;
    if (mask) cut = cl(abs(x + 0.5 - mask[0]) - mask[1] - mask[2] + 0.5, 0, 1);
    putRope(acc, x, y, xc, hw, col, lv, cut);
  }
}
// A capsule chain for the caps and cups: a half ellipse about (cx, cy)
// bulging up (dir -1) or down (dir +1), drawn from angle a0 to a1.
function arc(acc, cx, cy, rx, ry, dir, a0, a1, w, colA, colB) {
  if (a1 <= a0) return;
  const n = 20, px = [], py = [];
  for (let i = 0; i <= n; i++) {
    const th = a0 + ((a1 - a0) * i) / n;
    px.push(cx - rx * cos(th));
    py.push(cy + dir * ry * sin(th));
  }
  const hw = w / 2, x0 = max(0, floor(min(...px) - hw - 1)), x1 = min(W - 1, floor(max(...px) + hw + 1));
  const y0 = max(0, floor(min(...py) - hw - 1)), y1 = min(H - 1, floor(max(...py) + hw + 1));
  const col = [0, 0, 0];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let dm = 1e9, tm = 0;
      for (let i = 0; i < n; i++) {
        const ax = px[i], ay = py[i], bx = px[i + 1] - ax, by = py[i + 1] - ay, l2 = bx * bx + by * by || 1;
        const t = cl(((x + 0.5 - ax) * bx + (y + 0.5 - ay) * by) / l2, 0, 1), dd = (x + 0.5 - ax - t * bx) ** 2 + (y + 0.5 - ay - t * by) ** 2;
        if (dd < dm) (dm = dd), (tm = (i + t) / n);
      }
      const dist = sqrt(dm), cov = cl(hw + 0.5 - dist, 0, 1);
      if (cov <= 0) continue;
      const g = (a0 + (a1 - a0) * tm) / PI;
      for (let q = 0; q < 3; q++) col[q] = colA[q] + (colB[q] - colA[q]) * g;
      const u = dist / max(hw, 0.6), v = (1 - 0.45 * u * u) * (0.82 + 0.18 * cos(2 * PI * (tm * 9 + 0.35 * u))), k = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) acc[k + q] = acc[k + q] * (1 - cov) + col[q] * v * cov;
    }
}

// One picture into acc: D the diagram, dx its sideways shift,
// tw the share of a half turn the last crossing has made (1 when done),
// cup how far the foot has closed, cols the two ropes' colours by lane.
function picture(S, acc, D, dx, tw, cup, cols) {
  const w = S.width, h = S.h, n = D.steps.length, gap = 0.9 + 0.25 * w;
  const lane = X.map((v) => v + dx);
  const caps = D.caps;
  // Caps.
  if (caps === 0) {
    arc(acc, (lane[0] + lane[1]) / 2, YS, 7, 9, -1, 0, PI, w, cols[0], cols[0]);
    arc(acc, (lane[2] + lane[3]) / 2, YS, 7, 9, -1, 0, PI, w, cols[1], cols[1]);
  } else {
    arc(acc, (lane[0] + lane[3]) / 2, YS, 21, 11, -1, 0, PI, w, cols[1], cols[1]);
    arc(acc, (lane[1] + lane[2]) / 2, YS, 7, 5.5, -1, 0, PI, w, cols[0], cols[0]);
  }
  // Rope per lane, going down.
  const rope = caps ? [1, 0, 0, 1] : [0, 0, 1, 1];
  let y0 = YS;
  const xs = lane.slice();
  for (let i = 0; i < n; i++) {
    const s = D.steps[i], last = i === n - 1, th = last ? PI * tw : PI, hh = last ? h * max(tw, 0.001) : h;
    const p = s.p, mid = (xs[p] + xs[p + 1]) / 2, half = (xs[p + 1] - xs[p]) / 2;
    const ya = floor(y0), yb = floor(y0 + hh);
    for (let y = max(0, ya); y < min(H, yb); y++) {
      const t = cl((y + 0.5 - y0) / hh, 0, 1), c = cos(th * t), sn = sin(th * t), sl = (half * th * sn) / hh;
      for (let L = 0; L < 4; L++) if (L !== p && L !== p + 1) strandRow(acc, y, xs[L], 0, w, cols[rope[L]], 1, null);
      const xl = mid - half * c, xr = mid + half * c, hwo = (w / 2) * sqrt(1 + sl * sl);
      // The strand from the left lane is in front when o is +1.
      const lf = s.o > 0;
      const [xu, su, cu, xo, so, co] = lf ? [xr, -sl, cols[rope[p + 1]], xl, sl, cols[rope[p]]] : [xl, sl, cols[rope[p]], xr, -sl, cols[rope[p + 1]]];
      const near = abs(xl - xr) < 2 * hwo + 2 * gap + 2;
      strandRow(acc, y, xu, su, w, cu, near ? 0.85 : 1, near ? [xo, hwo, gap] : null);
      strandRow(acc, y, xo, so, w, co, 1, null);
    }
    // After the crossing the lanes carry each other's ropes, and an
    // unfinished twist leaves its two ends partway round.
    const ce = cos(th);
    xs[p] = mid - half * ce;
    xs[p + 1] = mid + half * ce;
    if (th > PI / 2) [rope[p], rope[p + 1]] = [rope[p + 1], rope[p]];
    if (th > PI / 2) [xs[p], xs[p + 1]] = [xs[p + 1], xs[p]];
    y0 += hh;
  }
  // Below the crossings straight down to the foot, then the cups.
  const yf = cup > 0 ? YE : H;
  for (let y = max(0, floor(y0)); y < min(H, yf); y++) for (let L = 0; L < 4; L++) strandRow(acc, y, xs[L], 0, w, cols[rope[L]], 1, null);
  if (cup > 0) {
    const e = smooth(cup), ytail = YE + (H - YE) * (1 - e);
    for (let y = YE; y < min(H, ytail); y++) for (let L = 0; L < 4; L++) strandRow(acc, y, xs[L], 0, w, cols[rope[L]], 1, null);
    for (const [l0, l1] of [[0, 1], [2, 3]]) {
      const cx = (xs[l0] + xs[l1]) / 2, rx = (xs[l1] - xs[l0]) / 2, ca = cols[rope[l0]], cb = cols[rope[l1]];
      arc(acc, cx, YE, rx, 8, 1, 0, (PI / 2) * e, w, ca, cb);
      arc(acc, cx, YE, rx, 8, 1, PI - (PI / 2) * e, PI, w, ca, cb);
    }
  }
}

// ---- Text.
function glyph(acc, ch, x, y, col) {
  let bits = null;
  if (ch >= "0" && ch <= "9") {
    const f = FIG[ch.charCodeAt(0) - 48];
    bits = [];
    for (let i = 14; i >= 0; i--) bits.push((f >> i) & 1);
  } else if (G35[ch]) bits = [...G35[ch]].map(Number);
  if (ch === "~") {
    for (let i = 0; i < 15; i++) if (LEMNI[i] === "#") dotPx(acc, x + (i % 5), y + 1 + floor(i / 5), col);
    return 5;
  }
  if (bits) for (let i = 0; i < 15; i++) if (bits[i]) dotPx(acc, x + (i % 3), y + floor(i / 3), col);
  return 3;
}
function dotPx(acc, x, y, col) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const k = (y * W + x) * 3;
  for (let q = 0; q < 3; q++) acc[k + q] = col[q];
}
// "_" before a figure lowers it three rows, "^" raises it two; a lowered
// figure right after a raised one stands under it.
function text(acc, str, cx, y, col) {
  let wd = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "_" || ch === "^") continue;
    if (str[i - 1] === "_" && str[i - 3] === "^") continue;
    wd += (ch === "~" ? 5 : 3) + 1;
  }
  let x = round(cx - (wd - 1) / 2);
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "_" || ch === "^") continue;
    const dy = str[i - 1] === "_" ? 3 : str[i - 1] === "^" ? -2 : 0;
    if (str[i - 1] === "_" && str[i - 3] === "^") x -= 4;
    x += (ch === " " ? 3 : glyph(acc, ch, x, y + dy, col)) + 1;
  }
}
const fracText = ([p, q]) => (q === 0 ? "~" : (p < 0 ? "-" : "") + abs(p) + "/" + q);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.plan) return;
  const acc = S.acc, buf = S.buf;
  acc.fill(0);
  const A = hsv(S.hue + 0.5, 0.85, 1), B = hsv(S.hue + 0.11, 0.85, 1);
  const c = S.calls[S.k], AB = [A, B], BA = [B, A];
  let cols = S.f ? BA : AB;
  const stage = S.stage;
  if (stage === "close" || stage === "hold" || stage === "open") {
    // A knot is one loop: one rope takes the other's colour as the ends join.
    const D = S.D, r = ropesAtFoot(D), knot = r[0] !== r[1];
    const e = stage === "close" ? smooth(S.pt / T_CLOSE) : stage === "hold" ? 1 : 1 - smooth(S.pt / T_CLOSE);
    if (knot) cols = [cols[0], cols[1].map((v, i) => v + (cols[0][i] - v) * e)];
    picture(S, acc, D, 0, 1, e, cols);
  } else if (stage === "move" && c && c.m === "T") {
    // A twist: the literal picture after it, its last crossing turning in,
    // or the picture before it with its last crossing turning out.
    const u = smooth(S.pt / T_MOVE);
    cols = c.fL ? BA : AB;
    if (c.L.steps.length > c.from.steps.length) picture(S, acc, c.L, 0, u, 0, cols);
    else picture(S, acc, c.from, 0, 1 - u, 0, cols);
  } else if (stage === "move" && c && c.m === "R") {
    // A rotation: every end steps one lane round; the old picture slides
    // off to the right as the new one comes in from the left.
    const u = smooth(S.pt / T_MOVE);
    picture(S, acc, c.from, 14 * u, 1, 0, c.f0 ? BA : AB);
    buf.fill(0);
    picture(S, buf, c.L, -14 * (1 - u), 1, 0, c.fL ? BA : AB);
    for (let i = 0; i < acc.length; i++) acc[i] += (buf[i] - acc[i]) * u;
  } else if (stage === "settle") {
    const u = smooth(S.pt / T_SETTLE);
    picture(S, acc, c.L, 0, 1, 0, c.fL ? BA : AB);
    buf.fill(0);
    picture(S, buf, c.C, 0, 1, 0, c.fC ? BA : AB);
    for (let i = 0; i < acc.length; i++) acc[i] += (buf[i] - acc[i]) * u;
  } else picture(S, acc, S.D, 0, 1, 0, cols);
  // The fraction on the first line; the calls, or the name, on the second.
  const white = [0.92, 0.92, 0.88];
  const fx = stage === "move" ? (S.pt / T_MOVE > 0.5 ? c.x : S.x) : S.x;
  text(acc, fracText(fx), 32, 1, white);
  if (stage === "close" || stage === "hold" || stage === "open") {
    const e = stage === "close" ? S.pt / T_CLOSE : stage === "open" ? 1 - S.pt / T_CLOSE : 1;
    if (e > 0.5) text(acc, nameOf(S.x), 32, 8, [1, 0.85, 0.55]);
  } else {
    const said = S.undoSaid ? S.undoSaid.slice(-15) : S.said;
    text(acc, said, 32, 8, S.undoSaid ? A.map((v) => 0.35 + 0.6 * v) : [0.75, 0.75, 0.75]);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(acc[k], 0, 1) * 255), round(cl(acc[k + 1], 0, 1) * 255), round(cl(acc[k + 2], 0, 1) * 255));
    }
}
