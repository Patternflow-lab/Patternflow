// ===== Patternflow pattern =====
// Title:   Potter's Wheel
// Family:  pottery
// Idea:    At night under one warm lamp a potter centres wet clay on the spinning wheel, opens it and pulls the wall up into a tall pot whose throwing rings catch the light, wires it off and sets it on the shelves, where the earlier pots dry from dark to bone-pale.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after throwing a pot on the potter's wheel
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Clay=0..1, Speed=0.2..3, Pots=6..20, Lamp=0..1
//
// Knob 1: Clay. The clay body: terracotta at 0, then buff stoneware, grey porcelain and black clay at 1. The pot, the slip in the splash pan, the pots drying on the shelves and the dust on the wall all take it.
// Knob 2: Speed. At 2 a throw takes about thirteen seconds from the slapped lump to the pot set on the shelf, and the wheel turns about once a second; at 0.2 it all runs ten times slower.
// Knob 3: Pots. How many earlier pieces stand drying on the rack's three shelves, from six to twenty. The oldest are bone-dry, and each new pot takes the place of the oldest, which goes to the kiln.
// Knob 4: Lamp. Where the lamp hangs, from left of the wheel at 0 to right of it at 1. The lit side of the pot, the highlight down its throwing rings, its shadow on the wall and the light on the shelves move with it.
// Buttons: K1 tap makes the wall slump, and the potter balls the clay up and centres it again.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, sqrt, exp, asin, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
const F32 = (n) => new Float32Array(n);
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The wheel head's centre and radius, the splash pan round it, and the tilt
// of the view: a circle r across on the wheel shows as an ellipse E * r tall.
const [CX, BY, E, WR, PR] = [32, 111, 0.21, 21, 34];
const PY = BY + 2.5;
// Three shelf boards with seven slots each, the order the slots fill, and
// the size a pot stands at on the shelf against its size on the wheel.
const SHELF = [26, 53, 80];
const SLOT = [];
for (const sy of SHELF) for (let i = 0; i < 7; i++) SLOT.push([4.6 + i * 9.13, sy]);
const ORDER = [1, 5, 8, 12, 14, 20, 3, 9, 11, 0, 6, 7, 13, 15, 19, 2, 4, 10, 16, 18, 17];
const SHS = 0.27;

// Each clay at every stage of drying, from thrown and wet to bone-dry.
const CLAY = [
  [[255, 112, 56], [196, 96, 58], [238, 158, 108]],
  [[236, 170, 104], [190, 148, 100], [244, 222, 182]],
  [[194, 198, 206], [184, 184, 182], [250, 248, 240]],
  [[110, 96, 96], [86, 80, 78], [156, 148, 142]],
];
const SKIN = [150, 98, 76], WALL = [84, 62, 50], WOOD = [132, 90, 58], METAL = [150, 152, 156], PLASTIC = [76, 80, 90], SLEEVE = [58, 66, 86], SHINE = [255, 232, 196];

// Pot shapes as a height and the radius at keys up the wall: cylinder, bottle,
// vase with a belly and a flared lip, jar and trumpet vase on the wheel, and
// bowls and cups from earlier in the evening on the shelves.
const SHAPES = [
  (j) => [76 + 8 * j, [[0, 10.5], [0.45, 10.2 + j], [0.9, 9.6], [1, 11]]],
  (j) => [84 + 8 * j, [[0, 11], [0.3, 14.5], [0.7, 4.2], [0.93, 4], [1, 5.6]]],
  (j) => [82 + 8 * j, [[0, 8], [0.42, 15], [0.8, 5], [0.9, 5.4], [1, 9.5]]],
  (j) => [76 + 6 * j, [[0, 8.5], [0.55, 15.5], [0.9, 9], [1, 10.5]]],
  (j) => [86 + 6 * j, [[0, 9.5], [0.2, 9.8], [0.62, 5.5], [1, 14]]],
  (j) => [26 + 6 * j, [[0, 7], [0.45, 14], [1, 19]]],
  (j) => [40 + 6 * j, [[0, 9], [0.5, 11.5], [0.85, 10.5], [1, 12]]],
];
function key(K, v) {
  let i = 0;
  while (i < K.length - 2 && v > K[i + 1][0]) i++;
  return mix(K[i][1], K[i + 1][1], sm(K[i][0], K[i + 1][0], v));
}
// A radius looked up along a wall kept one entry per row.
const at = (pr, h, Hp, i) => ((h = cl(h, 0, Hp)), (i = h | 0), pr[i] + (pr[i + 1] - pr[i]) * (h - i));
function newSpec(not, all) {
  let type;
  // The first throw of the night is always one of the three tallest.
  do type = floor(rnd() * (all ? 7 : 5));
  while (type === not || (not < -1 && type % 3 === 0));
  const [Hf, K0] = SHAPES[type](rnd()), g = 0.92 + 0.16 * rnd(), K = K0.map(([v, r]) => [v, r * g]);
  const pr = F32(ceil(Hf) + 3);
  for (let h = 0; h < pr.length; h++) pr[h] = key(K, min(1, h / Hf)) + 1.4 * exp(-h / 2.2);
  // Where the hands shape it: the belly, then the neck above.
  let vb = 0.5, vn = 0.85, rb = 0, rn = 99;
  for (const [v, r] of K) if (v > 0.1 && v < 0.85 && r > rb) (rb = r), (vb = v);
  for (const [v, r] of K) if (v > vb && v < 1 && r < rn) (rn = r), (vn = v);
  return { type, Hf, pr, rim: K[K.length - 1][1], vb, vn };
}

// The steps of a throw, how long each takes at Speed 2, and how fast the
// wheel turns through it (turns a second): slapped down, centred, opened,
// three pulls, shaped, shown, wired off, lifted to the shelf, and the slump
// and the balling up after a K1 tap.
const DUR = [0.45, 0.9, 0.5, 4.5, 2.6, 1.6, 0.9, 1.8, 1.2, 0.9];
const SPIN = [0.4, 1.3, 1.1, 0.95, 0.75, 0.65, 0.3, 0, 0.9, 1];
// The cylinder after each pull, and its wall at the rim.
const RC = [12.5, 11.3, 10.5, 9.9], WALL_T = [4, 2.7, 2.1, 1.7];
const cyl = (k, h) => RC[k] - 0.012 * h + 1.4 * exp(-h / 2.2);
const dome = (v, r) => r * sqrt(max(0, 1 - v ** 2.4)) + 1.2 * exp(-v * 8);

export function setup(params) {
  const P = (params.s = {
    ph: 0, pt: 0, rot: 0, w: 0.4, H: 11, ri: 0, wa: 0, wt: 0, yo: 0, sH: 11, sri: 0, n: 6, LX: 12, clay: 0,
    pr: F32(128), snap: F32(128), f: F32(N * 3), bg: F32(N * 3),
    hd: null, hs: null, g: null, wire: -1, pieces: [], sp: [], dr: [], free: 0, bgKey: -1,
  });
  P.spec = newSpec(-2);
  // The pieces already on the shelves, newest first.
  for (let i = 0; i < 21; i++) P.pieces.push({ slot: ORDER[i], spec: newSpec(i ? P.pieces[i - 1].spec.type : -1, 1), dry: min(1, 0.1 + i * 0.17) });
  // Old slip spattered in the pan.
  for (let i = 0; i < 60; i++) {
    const a = rnd() * TAU, r = 0.66 + 0.3 * rnd();
    P.sp.push(i < 44 ? [CX + PR * r * sin(a), PY + PR * E * r * cos(a), rnd() < 0.3 ? 2 : 1, 0.6 + 0.5 * rnd()] : [2 + rnd() * 60, PY + 8 + rnd() * 4, 1, 0.5 + 0.4 * rnd()]);
  }
  shape(P, 0);
}

function go(P, ph) {
  // The oldest piece on show goes to the kiln and the new pot takes its place.
  if (ph === 7) P.free = P.pieces.splice(min(P.n, P.pieces.length) - 1, 1)[0].slot;
  if (ph === 0 && P.ph === 7) P.pieces.unshift({ slot: P.free, spec: P.spec, dry: 0 }), (P.spec = newSpec(P.spec.type));
  P.snap.set(P.pr);
  Object.assign(P, { ph, pt: 0, sH: P.H, sri: P.ri });
}

function fill(P, Hn, f) {
  P.H = Hn;
  for (let h = 0, n = min(126, ceil(Hn) + 2); h <= n; h++) P.pr[h] = max(0, f(min(h, Hn)));
}
const snapR = (P, v) => at(P.snap, v * P.sH, P.sH);
const offset = (P, h) => P.wa * sin(P.rot) + P.wt * (cl(h / P.H, 0, 1) ** 1.5) * sin(P.rot + 0.8);

// The clay's wall for this moment of the throw, and where the hands are.
function shape(P, p) {
  const sp = P.spec;
  let hand = null;
  Object.assign(P, { wa: 0, wt: 0.2, yo: 0, g: null, wire: -1, ring: 0.07 });
  switch (P.ph) {
    case 0: {
      // Slapped down from the hands, squashing as it lands.
      const sq = p > 0.6 ? 1 - 0.3 * sin((PI * (p - 0.6)) / 0.4) : 1, r = 10.5 / sqrt(sq), Hn = 11 * sq;
      P.yo = p < 0.6 ? -56 * (1 - (p / 0.6) ** 2) : 0;
      fill(P, Hn, (h) => dome(h / Hn, r));
      (P.ri = 0), (P.wa = 0.8), (P.ring = 0.04);
      hand = [5, -0.3, 0];
      break;
    }
    case 1: {
      // Centred: coned up and pressed down again while the wobble dies.
      const Hn = 11 + 10 * sin(PI * sm(0.1, 0.9, p)), r = 10.5 * sqrt(11 / Hn);
      fill(P, Hn, (h) => dome(h / Hn, r));
      (P.ri = 0), (P.wa = 2.6 * (1 - sm(0, 0.8, p))), (P.ring = 0.05);
      hand = [Hn * 0.42, -0.5 + 0.4 * sin(p * 20), 0];
      break;
    }
    case 2: {
      const q = sm(0, 1, p), Hn = mix(P.sH, 13, q);
      fill(P, Hn, (h) => mix(snapR(P, h / Hn), cyl(0, h), q));
      (P.ri = (RC[0] - WALL_T[0]) * sm(0.15, 1, p)), (P.ring = 0.07);
      hand = [Hn - 1.5, -0.2, 0];
      break;
    }
    case 3: {
      // Three pulls. The hands squeeze the wall from the base to the rim and
      // a roll of clay rides up ahead of them.
      const k = min(2, floor(P.pt / 1.5)), a = (P.pt - k * 1.5) / 1.2, Hp = sp.Hf * 0.93;
      const HS = [13, mix(13, Hp, 0.55), mix(13, Hp, 0.82), Hp];
      if (a <= 1) {
        const Hn = mix(HS[k], HS[k + 1], sm(0, 1, a)), hh = Hn * min(1, a * 1.04) * 0.95, roll = 1.3 * (1 - sm(0.9, 1, a));
        fill(P, Hn, (h) => mix(cyl(k + 1, h), cyl(k, h), sm(hh - 1, hh + 2.5, h)) + roll * exp(-(((h - hh - 2.6) / 2.2) ** 2)) - 0.8 * exp(-(((h - hh) / 1.4) ** 2)));
        P.ri = mix(RC[k] - WALL_T[k], RC[k + 1] - WALL_T[k + 1], sm(0.85, 1, a));
        hand = [hh, -0.3, 0];
      } else {
        const Hn = HS[k + 1], b = (a - 1) / 0.25;
        fill(P, Hn, (h) => cyl(k + 1, h));
        P.ri = RC[k + 1] - WALL_T[k + 1];
        hand = [mix(Hn * 0.95, 3, sm(0, 1, b)), 1.5 * sin(PI * b), 0];
      }
      break;
    }
    case 4: {
      // Shaped: the belly pushed out from inside, then the neck collared in.
      const q = sm(0, 1, p), Hn = mix(P.sH, sp.Hf, q);
      fill(P, Hn, (h) => mix(snapR(P, h / Hn), at(sp.pr, (h / Hn) * sp.Hf, sp.Hf), q));
      P.ri = mix(P.sri, sp.rim - 1.4, q);
      hand = [Hn * mix(sp.vb, sp.vn, sm(0.4, 0.75, p)), -0.2, 0];
      break;
    }
    case 8: {
      // Slumped: the wall sinks, bellies and flops round as the wheel turns.
      const q = sm(0, 1, p), Hn = mix(P.sH, max(12, P.sH * 0.3), q ** 0.8);
      fill(P, Hn, (h) => mix(snapR(P, h / Hn), snapR(P, (h / Hn) * 0.6) * (1 + 0.7 * (h / Hn) ** 2) + (3 * h) / Hn, q));
      P.ri = P.sri > 0 ? max(0, at(P.pr, Hn, Hn) - 1.8) : 0;
      (P.wt = 6 * sin(PI * min(1, p * 1.3)) + 2), (P.wa = 1);
      hand = [Hn * 0.5, 4 + 20 * sm(0, 0.3, p), 10 * sm(0, 0.3, p)];
      break;
    }
    case 9: {
      const q = sm(0, 1, p), Hn = mix(P.sH, 11, q);
      fill(P, Hn, (h) => mix(snapR(P, h / Hn), dome(h / Hn, 10.5), q));
      (P.ri = P.sri * (1 - q)), (P.wa = 2.6), (P.wt = 2 * (1 - q)), (P.ring = 0.04);
      hand = [Hn * 0.45, mix(6, -0.5, sm(0, 0.5, p)), 0];
      break;
    }
    default: {
      fill(P, sp.Hf, (h) => at(sp.pr, h, sp.Hf));
      P.ri = sp.rim - 1.4;
      // Shown: the hands come away.
      if (P.ph === 5) hand = [sp.Hf * sp.vn, 2 + 30 * sm(0, 0.6, p), 22 * sm(0, 0.6, p)];
      if (P.ph === 6) {
        // Wired off: the hands come in to the wheel and draw the wire under.
        const a = sm(0, 0.25, p), q = sm(0.25, 1, p), y = mix(BY + 20, BY + E * P.pr[0] * (1 - 2 * q) + 0.5, a);
        P.wire = a < 1 ? -1 : q;
        P.hd = [CX - mix(40, 25, a), y, CX + mix(40, 25, a), y];
        return;
      }
      if (P.ph === 7) {
        // Lifted, then carried back to its slot on the shelf.
        const q1 = sm(0, 0.3, p), q2 = sm(0.3, 1, p), [sx, sy] = SLOT[P.free], s = mix(1, SHS, q2 ** 0.6);
        P.g = [mix(CX, sx, q2), mix(BY - 9 * q1, sy + 0.5, q2) - 14 * sin(PI * q2), s];
        if (q2 < 0.5) {
          const r = sp.pr[3] * s, y = P.g[1] - 3 * s + 40 * sm(0.2, 0.5, q2);
          P.hd = [P.g[0] - r, y, P.g[0] + r, y];
        } else P.hd = null;
        return;
      }
    }
  }
  if (hand) {
    const [h, gap, dy] = hand, r = at(P.pr, h, P.H), o = offset(P, h), y = BY + P.yo - h + dy;
    P.hd = [CX + o - r - gap, y, CX + o + r + gap, y];
  } else P.hd = null;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2;
  P.clay = cl(k[0], 0, 1);
  P.n = round(cl(k[2], 6, 20));
  P.LX = mix(9, 55, cl(k[3], 0, 1));
  if (input.btnPressed && input.btnPressed[0] && P.ph >= 1 && P.ph <= 5) go(P, 8);
  if ((P.pt += d) >= DUR[P.ph]) go(P, [1, 2, 3, 4, 5, 6, 7, 0, 9, 1][P.ph]);
  P.w += (SPIN[P.ph] - P.w) * min(1, d * 3);
  P.rot += TAU * P.w * d;
  const landing = P.ph === 0 && P.yo < 0;
  shape(P, P.pt / DUR[P.ph]);
  // The hands follow their mark, easing over the big jumps between steps.
  if (!P.hd) P.hs = null;
  else if (!P.hs) P.hs = P.hd.slice();
  else for (let i = 0; i < 4; i++) abs(P.hd[i] - P.hs[i]) > 3 ? (P.hs[i] += (P.hd[i] - P.hs[i]) * min(1, d * 14)) : (P.hs[i] = P.hd[i]);

  // Slip flung off the wall by the hands, and spattered as the lump lands.
  const fling = (x, y, sd, n) => {
    while (n--) P.dr.push([x, y, sd * (8 + rnd() * 26), -8 - rnd() * 26, PY - 4 + rnd() * 10]);
  };
  if (P.hs && (P.ph === 3 || P.ph === 4) && rnd() < d * 3) rnd() < 0.5 ? fling(P.hs[0], P.hs[1], -1, 1) : fling(P.hs[2], P.hs[3], 1, 1);
  if (landing && P.yo === 0) fling(CX - 9, BY - 2, -1, 3), fling(CX + 9, BY - 2, 1, 3);
  P.dr = P.dr.filter((q) => {
    (q[0] += q[2] * d), (q[1] += q[3] * d), (q[3] += 150 * d);
    if (q[3] > 0 && q[1] >= q[4]) {
      P.sp.push([q[0], q[1], rnd() < 0.3 ? 2 : 1, 0.7 + 0.5 * rnd()]);
      if (P.sp.length > 110) P.sp.shift();
      return false;
    }
    return q[0] > -2 && q[0] < W + 2;
  });
  for (const q of P.pieces) q.dry = min(1, q.dry + d / 75);
}

// The wall, the rack and the lamp's glow, kept until the lamp or the clay changes.
function backdrop(P) {
  P.bgKey = bgKey(P);
  // Clay dust lies on everything in the room and takes the clay's colour.
  const B = P.bg, LX = P.LX, dust = P.dust, wall = WALL.map((v, n) => mix(v, dust[n] * 0.4, 0.55)), wood = WOOD.map((v, n) => mix(v, dust[n] * 0.6, 0.35));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - LX, dy = y - 10, o = (y * W + x) * 3;
      let f = 0.24 + 0.85 * exp(-(dx * dx + dy * dy * 0.3) / 1500), col = wall;
      if (dy > 0) {
        const cw = 4 + dy * 0.72;
        f += 0.32 * sm(cw + 6, cw - 3, abs(dx)) * exp(-dy / 90);
      }
      f *= 0.9 + 0.16 * hash(x >> 1, y >> 1);
      for (const sy of SHELF) {
        if (y === sy) (col = wood), (f *= 1.35);
        else if (y > sy && y <= sy + 3) (col = wood), (f *= 0.75 + 0.15 * hash(x >> 2, sy));
        else if (y > sy + 3 && y <= sy + 6) f *= 0.45 + 0.17 * (y - sy - 4);
      }
      if ((x < 2 || x > 61) && y < SHELF[2] + 4) (col = wood), (f *= x === 1 || x === 62 ? 0.9 : 0.6);
      const g = 0.55 * exp(-(dx * dx + (y - 10.5) ** 2) / 30);
      for (let c = 0; c < 3; c++) B[o + c] = col[c] * f + [255, 196, 120][c] * g;
    }
}

// The light from the lamp at a spot: its direction and how much reaches it.
function light(P, x, y) {
  const lx = cl((P.LX - x) / 24, -1.3, 1.3), ly = 0.3 + (y - 10) / 300, n = sqrt(lx * lx + ly * ly + 0.25);
  return [lx / n, ly / n, 0.5 / n, 0.6 + 0.5 * exp(-((x - P.LX) ** 2 + ((y - 10) * 0.5) ** 2) / 1800)];
}

let F;
const bgKey = (P) => round(P.LX * 8) * 64 + round(P.clay * 48);
// A thrown shape turned on its axis, lit by the lamp: wall, rim and the
// dark inside. Off-centre clay swings its axis round with the wheel.
function solid(o) {
  const { cx, by, s, pr, Hp, L, alb } = o, Hs = Hp * s, [l0, l1, l2, lm] = L;
  let Rm = 0;
  for (let i = 0; i <= Hp + 1; i++) Rm = max(Rm, pr[i]);
  Rm *= s;
  const R = (h) => at(pr, h / s, Hp) * s, off = (h) => o.wa * o.s1 + o.wt * (cl(h / Hs, 0, 1) ** 1.5) * o.s2;
  const RT = R(Hs), cT = cx + off(Hs), yT = by - Hs, ryT = E * RT + 0.35, ri = o.ri * s, ryi = E * ri + 0.25, wb = abs(o.wa) + abs(o.wt);
  const hn = sqrt(l0 * l0 + l1 * l1 + (l2 + 1) ** 2), hx = l0 / hn, hy = l1 / hn, hz = (l2 + 1) / hn;
  const y0 = max(0, floor(yT - ryT - 1)), y1 = min(H - 1, ceil(by + E * Rm + 1)), x0 = max(0, floor(cx - Rm - wb - 1)), x1 = min(W - 1, ceil(cx + Rm + wb + 1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0, h0 = by - y - 0.5, ox = wb ? off(h0) : 0; x <= x1; x++) {
      const px = x + 0.5 - cx - ox, o3 = (y * W + x) * 3;
      let h = h0, r = 0, u = 9, c = 0, k, sp = 0;
      for (let it = 0; it < 3; it++) {
        r = R(h);
        u = r > 0.05 ? px / r : 9;
        c = u * u < 1 ? sqrt(1 - u * u) : 0;
        h = h0 + E * r * c;
      }
      r = R(h);
      u = r > 0.05 ? px / r : 9;
      if (h >= 0 && h <= Hs && u * u < 1) {
        c = sqrt(1 - u * u);
        const hp = h / s, dR = (R(h + 0.6) - R(h - 0.6)) / 1.2 + o.ring * 2.03 * cos(hp * 2.03), nl = 1 / sqrt(1 + dR * dR);
        const dif = max(0, (u * l0 - dR * l1 + c * l2) * nl), nh = max(0, (u * hx - dR * hy + c * hz) * nl);
        k = (o.amb + 0.95 * dif + 0.2 * max(0, (-u * l0 + 0.4 * c) * nl)) * lm;
        sp = o.spec * nh ** 40;
        if (o.fl) {
          // Slip streaks and grog flecks ride round with the wheel.
          const az = asin(u) - o.rot, a = ((az % TAU) + TAU) % TAU, i = floor(a * 6.366), j = floor(hp / 2.3), q = hash(i, j);
          const st = 1 + 0.1 * sin(3 * az + 1.3) + 0.07 * sin(5 * az + hp * 0.11);
          k *= st;
          sp *= st;
          if (q < 0.2 && abs(a - (i + 0.5) / 6.366) * r < 0.7 && abs(hp - (j + 0.5) * 2.3) < 0.75) k *= q < 0.1 ? 1.5 : 0.55;
        }
      } else {
        const ex = (x + 0.5 - cT) / RT, ey = (y + 0.5 - yT) / ryT;
        if (RT < 0.4 || ex * ex + ey * ey > 1) continue;
        const ix = (x + 0.5 - cT) / (ri + 0.01), iy = (y + 0.5 - yT) / ryi;
        if (ri > 0.4 && ix * ix + iy * iy < 1) k = (0.05 + 0.42 * cl(-ix * l0 * 1.3 + 0.2, 0, 1) * (iy < 0.3 ? 1 : 0.55)) * lm;
        else (k = (0.3 + 0.8 * l1) * lm), (sp = o.spec * 0.3);
      }
      for (let n = 0; n < 3; n++) F[o3 + n] = alb[n] * k + SHINE[n] * sp;
    }
}

// The earlier pots on the shelves, wet and dark, then leather-hard, then pale.
const STILL = { s: SHS, wa: 0, wt: 0, s1: 0, s2: 0, rot: 0, ring: 0, fl: 0, amb: 0.38 };
function shelves(P, C) {
  // While a pot is carried over, its slot stands empty.
  for (let i = 0; i < min(P.n - (P.ph === 7), P.pieces.length); i++) {
    const q = P.pieces[i], [sx, sy] = SLOT[q.slot], dr = q.dry, a = dr < 0.45 ? dr / 0.45 : (dr - 0.45) / 0.55;
    const alb = dr < 0.45 ? C[0].map((v, n) => mix(v * 0.62, C[1][n], a)) : C[1].map((v, n) => mix(v, C[2][n], a));
    solid({ ...STILL, cx: sx, by: sy + 0.5, pr: q.spec.pr, Hp: q.spec.Hf, ri: q.spec.rim - 1.4, alb, spec: 0.6 * (1 - sm(0, 0.4, dr)), L: light(P, sx, sy - 10) });
  }
}

const put = (x, y, col, k) => {
  if ((x = round(x - 0.5)) >= 0 && x < W && (y = round(y - 0.5)) >= 0 && y < H) for (let c = 0, o = (y * W + x) * 3; c < 3; c++) F[o + c] = col[c] * k;
};

// The lamp: a cord, an enamel shade and the bulb under it.
function lamp(P) {
  for (let y = 0; y < 12; y++)
    for (let x = max(0, floor(P.LX - 8)); x <= min(W - 1, P.LX + 8); x++) {
      const dx = x + 0.5 - P.LX;
      if (abs(dx) >= (y < 3 ? 0.6 : y < 10 ? 1.3 + (y - 3) * 0.85 : y < 11 ? 2.4 : 1.2)) continue;
      const k = y > 2 && y < 9 ? 0.7 + 0.6 * (1 - (y - 3) / 6) * (dx < 0 ? 1 : 0.6) : 1;
      put(x + 0.5, y + 0.5, y < 3 ? [44, 38, 34] : y < 9 ? [38, 72, 62] : [[236, 170, 96], [255, 244, 214], [255, 226, 168]][y - 9], k);
    }
}

// The pot's shadow thrown on the wall behind, leaning away from the lamp.
function shadow(P) {
  for (let y = max(0, floor(BY - P.H - 6)); y < 106; y++) {
    const h = BY + 4 - y;
    if (h < 0 || h > P.H) continue;
    const r = at(P.pr, h, P.H) * 1.08, xc = CX + (CX - P.LX) * (0.12 + h * 0.007);
    for (let x = max(0, floor(xc - r - 2)); x <= min(W - 1, xc + r + 2); x++) {
      const k = 1 - 0.5 * sm(r + 1.5, r - 1, abs(x + 0.5 - xc)), o = (y * W + x) * 3;
      (F[o] *= k), (F[o + 1] *= k), (F[o + 2] *= k);
    }
  }
}

// The splash pan with its slip, and the wheel head turning in it.
function wheel(P, A) {
  const [l0, l1, l2, lm] = light(P, CX, PY), mt = METAL.map((v, n) => mix(v, A[n], 0.7)), side = (z) => 0.15 + 0.8 * max(0, z * l0 + sqrt(max(0, 1 - z * z)) * l2);
  for (let y = 100; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ex = (x + 0.5 - CX) / PR, ey = (y + 0.5 - PY) / (PR * E), dd = ex * ex + ey * ey, o = (y * W + x) * 3;
      const wx = (x + 0.5 - CX) / WR, wy = (y + 0.5 - BY) / (WR * E), wd = wx * wx + wy * wy;
      let col, k;
      if (wd < 1) (col = mt), (k = (0.3 + 0.6 * l1) * lm * (0.9 + 0.1 * cos(sqrt(wd) * WR * 1.4)));
      else if (wy > 0 && wx * wx < 1 && y + 0.5 < BY + WR * E * sqrt(1 - wx * wx) + 2.5) (col = METAL), (k = 0.5 * side(wx) * lm);
      else if (dd < 1) dd > 0.86 ? ((col = PLASTIC), (k = (0.6 + 0.6 * l1) * lm)) : ((col = A), (k = (ey < 0 ? 0.26 + 0.12 * (1 + ey) : 0.4) * lm));
      else if (ey > 0 && ex * ex < 1 && y + 0.5 < PY + PR * E * sqrt(1 - ex * ex) + 6) (col = PLASTIC), (k = side(ex) * lm);
      else if (y > PY) (col = WALL), (k = 0.2);
      else continue;
      for (let c = 0; c < 3; c++) F[o + c] = col[c] * k;
    }
  // Slip spattered on the pan, then the wheel's own marks going round.
  for (const [x, y, z, t] of P.sp) {
    const ex = (x - CX) / WR, ey = (y - BY) / (WR * E);
    if (ex * ex + ey * ey < 1.1) continue;
    put(x, y, A, 0.5 * t * lm);
    if (z > 1) put(x + 1, y, A, 0.4 * t * lm);
  }
  for (let j = 0; j < 6; j++) {
    const a = P.rot + j * 1.9, r = j < 2 ? 16 : 11.5 + j * 1.6;
    put(CX + r * sin(a) + 0.5, BY + E * r * cos(a) + 0.5, j < 2 ? [20, 20, 22] : A, j < 2 ? 1 : 0.85 * lm);
  }
}

// Skin lit by the lamp, round in section.
function cap(ax, ay, bx, by, ra, rb, col, L, tip) {
  const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy || 1e-6, rm = max(ra, rb) + 1;
  for (let y = max(0, floor(min(ay, by) - rm)); y <= min(H - 1, max(ay, by) + rm); y++)
    for (let x = max(0, floor(min(ax, bx) - rm)); x <= min(W - 1, max(ax, bx) + rm); x++) {
      const qx = x + 0.5 - ax, qy = y + 0.5 - ay, t = cl((qx * dx + qy * dy) / ll, 0, 1), ex = qx - dx * t, ey = qy - dy * t, r = mix(ra, rb, t), dd = ex * ex + ey * ey;
      if (dd > r * r) continue;
      const nz = sqrt(1 - dd / (r * r)), k = (0.16 + 0.9 * max(0, (ex / r) * L[0] - (ey / r) * L[1] + nz * L[2])) * L[3], C = tip && t > 0.5 ? tip : col, o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) F[o + c] = C[c] * k;
    }
}

// A hand on the clay at x, y: the sleeve and forearm down to the side, the
// back of the hand, the fingers round the wall with slip on them, the thumb.
function hand(P, sd, x, y, slip) {
  const L = light(P, x, y);
  cap(x + sd * 22, y + 26, x + sd * 46, y + 62, 5.6, 6.6, SLEEVE, L);
  cap(x + sd * 6.5, y + 3.5, x + sd * 23, y + 27, 3.4, 4.6, SKIN, L);
  cap(x + sd * 7.5, y + 3.5, x + sd * 3.2, y - 0.3, 3.6, 3.3, SKIN, L);
  cap(x + sd * 3.2, y - 0.3, x - sd * 1.8, y + 0.8, 2.6, 2, SKIN, L, slip);
  cap(x + sd * 3.8, y - 3, x + sd * 2.6, y - 4.4, 1.4, 1.2, SKIN, L, slip);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.pr) return;
  F = P.f;
  const c = P.clay * 3, i0 = min(2, floor(c)), f = c - i0, C = [0, 1, 2].map((j) => CLAY[i0][j].map((v, n) => mix(v, CLAY[i0 + 1][j][n], f))), A = C[0];
  P.dust = C[2];
  if (P.bgKey !== bgKey(P)) backdrop(P);
  F.set(P.bg);
  shelves(P, C);
  lamp(P);
  if (!P.g) shadow(P);
  wheel(P, A);
  const wire = (front) => {
    if (P.wire < 0 || !P.hs || P.wire < 0.5 !== front) return;
    for (let x = P.hs[0]; x <= P.hs[2]; x++) put(x + 0.5, P.hs[1] + 0.5, [220, 222, 230], 0.9);
  };
  wire(false);
  const [gx, gy, gs] = P.g || [CX, BY + P.yo, 1];
  solid({ cx: gx, by: gy, s: gs, pr: P.pr, Hp: P.H, ri: P.ri, wa: P.wa, wt: P.wt, s1: sin(P.rot), s2: sin(P.rot + 0.8), rot: P.rot, alb: A, spec: 0.9, L: light(P, gx, gy - P.H * gs * 0.5), ring: P.ring, fl: 1, amb: 0.08 });
  wire(true);
  if (P.hs) {
    const slip = SKIN.map((v, n) => mix(v, A[n], 0.6));
    hand(P, -1, P.hs[0], P.hs[1], slip);
    hand(P, 1, P.hs[2], P.hs[3], slip);
  }
  for (const [x, y] of P.dr) put(x, y, A, 0.8);
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
