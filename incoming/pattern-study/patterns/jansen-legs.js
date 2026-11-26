// ===== Patternflow pattern =====
// Title:   Jansen Legs
// Family:  strandbeest
// Idea:    Three legs of Theo Jansen's walking linkage, each a crank and ten bars solved joint by joint from his thirteen Holy Numbers, turn at staggered phases on a body drawn as one line, every foot running a near-straight stretch of its closed track while it touches a ground that flows past at the same speed, and the bar lengths and the crank's speed drift on slow periods that do not divide one another, so the tails the feet leave keep changing from a flat D to a round D to one with a small loop.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the leg of Theo Jansen's Strandbeest and its thirteen Holy Numbers (Theo Jansen, 1990 and after, from memory); a planar linkage solved dyad by dyad as the meeting of two circles; original code, pattern round 265
// Round:   265
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Crank=0.2..3, Stride=0..1, Gait=-1..1
//
// Knob 1: Hue. Turns the three legs round the wheel together. At 0 they open azure, amber and violet from the top down (hues 0.52, 0.08 and 0.78), and each also drifts by up to 0.07 of the wheel on a slow period (81 s); the ground's slabs sit within 0.11 of the wheel of 0.5, aqua to azure at 0.
// Knob 2: Crank. How fast the cranks turn: at 2 a turn takes 6.3 s on average and the planted feet, with the ground under them, run about 14 LED a second; at 0.2 a turn takes a minute, at 3 it takes 4.2 s. The crank's speed also swells and slackens, between 0.76 and 1.24 of itself, on periods of 56 s and 102 s.
// Knob 3: Stride. How far the linkage is drawn from its flat track toward a round one. At 0 the crank is 0.94 of Jansen's 15, the long lower bar h 0.90 of his 65.7 and the bar e 1.03 of his 55.8, and the foot's track is a flat D 101 units wide and 15 tall; at 1 they are 1.08, 1.00 and 0.94, the track is 129 wide and 23 tall, and its right tip curls back into a small loop. The slow drift of the lengths is laid over this.
// Knob 4: Gait. How far apart the cranks of neighbouring legs are in phase. At 0.06, where it opens, it is 0.34 of a turn (124 degrees), so one foot or two are always planted; at -1 it is 0.16 of a turn and the legs rise and fall almost together; at 1 it is 0.5, so the top and bottom legs move as one while the middle leg moves against them. The spacing itself wanders by 0.15 of a turn either way.
//
// What the picture is. The panel is turned a quarter: the body is the vertical line near the left edge, the three legs reach from it to the right, and the ground is the strip at the right edge that runs from top to bottom. The body walks up the panel, so the ground runs down it.
// Each leg has Jansen's thirteen numbers (a 38.0, b 41.5, c 39.3, d 40.1, e 55.8, f 39.4, g 36.7, h 65.7, i 49.0, j 50.0, k 61.9, l 7.8, crank m 15.0), drawn at 0.37 LED to the unit. Bars b and d hang from the hip pivot and j and k from the crank's pin, so the first two joints are each the meeting of a circle round the hip and one round the pin, and three more follow, the foot last.
// I did not remember which bar meets which. I tried every ordering in which b and j meet at the first joint, and kept one for which the foot's whole track stays above its own straight run and the run is a long straight line; the others gave a banana, or a foot that dips below the ground on the swing. The kite of bars i, c, f, g and h is one rigid piece and is filled a little.
// Each bar is two LED thick on a dark rim, so a leg that crosses another stays apart from it, and each leg has a colour of its own, the bars at the hip a shade darker than the lower leg's. The foot's tail is kept by crank angle, not by time: it holds the last 1.1 turns of the crank however fast it turns, so a closed track shows whenever the crank is turning, and its older part is the shape the leg had a turn ago.
// A ring of light sits on a foot while it is within about three units of the lowest height it reaches.
// What moves the ground. Each foot's speed along the track is found by solving its leg a hair either side of the crank's angle. The ground goes at the mean of the speeds of the feet that are planted and going forward, weighted by how planted they are, so a planted foot does not slide on it. The foot is not at a constant speed through its run, and the legs' lengths differ, so the ground speeds up and slows a little as the feet hand over.
// Why it does not come back. Nine bar lengths of each leg (the crank, e, h, i, j, b, c, f and g) swing by 3 to 10 percent each on a period of its own, from 34 to 92 s, at a different point for each leg, so the three feet draw three different tracks that keep changing. The gap between the legs' phases wanders on periods of 23 to 50 s, each leg's light swells and fades on 42 to 76 s, and its hue drifts on 81 s.
// When the lengths a drift asks for cannot be assembled all the way round, the leg keeps the last set that could, or goes part of the way. The ground's slabs are laid out by a hash of their number, which counts up for good, so no two stretches of it are alike. The first update runs ten seconds of the walk, so the tails are already drawn at the first frame.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sqrt, abs, sin, cos, hypot, round, PI, exp, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Jansen's thirteen numbers. a and l place the crank's axle from the hip pivot, m is the crank.
const BASE = { a: 38.0, b: 41.5, c: 39.3, d: 40.1, e: 55.8, f: 39.4, g: 36.7, h: 65.7, i: 49.0, j: 50.0, k: 61.9, l: 7.8, m: 15.0 };
// The joints: 0 hip pivot, 1 crank axle, 2 crank pin, then five found by two circles each:
// [joint, from, bar, from, bar, which of the two meetings].
const DY = [
  [3, 0, "b", 2, "j", 1],
  [4, 0, "d", 2, "k", 1],
  [5, 3, "e", 4, "i", -1],
  [6, 4, "c", 5, "f", -1],
  [7, 5, "g", 6, "h", 1],
];
// The bars to draw: [from, to, which colour]; 0 is the hip's, 1 the lower leg's.
const BARS = [
  [0, 3, 0], [0, 4, 0], [2, 3, 0], [2, 4, 0], [1, 2, 0],
  [3, 5, 1], [4, 5, 1], [4, 6, 1], [5, 6, 1], [5, 7, 1], [6, 7, 1],
];

const SC = 0.37; // LED to a unit of Jansen's numbers
const X0 = 9; // the body's column, where each hip pivot sits
const LEGY = [26, 64, 102]; // the hip pivots' rows
const NT = 100, DT = 0.07; // the tail: points, and the crank angle between them
const HUES = [0.52, 0.08, 0.78]; // aqua, amber, violet
const LUM = [0.1103, 0.151, 0.0823]; // how fast each leg's light swells and fades, rad a second

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = [v, q, p, p, t, v][i];
  out[o + 1] = [t, v, v, q, p, p][i];
  out[o + 2] = [p, p, t, v, v, q][i];
}

function hash(i, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(s, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// The joints at crank angle th, in units, in X and Y (y up, the foot below the hip). False when two circles do not meet.
function solve(L, th, X, Y, margin) {
  X[0] = 0;
  Y[0] = 0;
  X[1] = L.a;
  Y[1] = L.l;
  X[2] = L.a + L.m * cos(th);
  Y[2] = L.l + L.m * sin(th);
  for (let n = 0; n < 5; n++) {
    const [o, A, ba, B, bb, sg] = DY[n];
    const dx = X[B] - X[A], dy = Y[B] - Y[A], d = hypot(dx, dy), r1 = L[ba], r2 = L[bb];
    if (d > r1 + r2 - margin || d < abs(r1 - r2) + margin || d < 1e-6) return false;
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), hh = sqrt(max(0, r1 * r1 - a * a));
    X[o] = X[A] + (a * dx + sg * hh * dy) / d;
    Y[o] = Y[A] + (a * dy - sg * hh * dx) / d;
  }
  return true;
}

// Whether the linkage can be put together at every angle of the crank.
function feasible(L, X, Y) {
  for (let n = 0; n < 36; n++) if (!solve(L, (n * TAU) / 36, X, Y, 1.2)) return false;
  return true;
}

function lengths(L, pv) {
  L.m = BASE.m * pv[0];
  L.h = BASE.h * pv[1];
  L.e = BASE.e * pv[2];
  L.i = BASE.i * pv[3];
  L.j = BASE.j * pv[4];
  L.b = BASE.b * pv[5];
  L.c = BASE.c * pv[6];
  L.f = BASE.f * pv[7];
  L.g = BASE.g * pv[8];
}

// Where one leg's nine lengths want to be: Stride sets the middle of the crank, h and e, and each swings on a period of its own,
// a different point of it for each leg, so the three feet draw three different tracks.
const FR = [0.1237, 0.0887, 0.1831, 0.0686, 0.1492, 0.1039, 0.1316, 0.0808, 0.1643];
const PH = [0.6, 2.1, 4.0, 1.2, 5.0, 3.3, 0.2, 5.7, 2.6];
const AM = [0.03, 0.05, 0.06, 0.07, 0.06, 0.05, 0.1, 0.1, 0.1];
function wanted(S, out, leg) {
  const t = S.t, u = S.stride;
  for (let n = 0; n < 9; n++) out[n] = 1 + AM[n] * sin(FR[n] * t + PH[n] + leg * (1.3 + 0.37 * n));
  out[0] += -0.06 + 0.14 * u;
  out[1] += -0.1 + 0.1 * u;
  out[2] += 0.03 - 0.09 * u;
}

export function setup(params) {
  const S = {
    t: 0, ready: false, ph: 0, hue: 0, speed: 2, stride: 0, gait: 0.06, gaitNow: 0.34,
    pv: [], goal: [1, 1, 1, 1, 1, 1, 1, 1, 1], want: [1, 1, 1, 1, 1, 1, 1, 1, 1], Ls: [], tryL: { ...BASE }, vsts: [38, 38, 38], ymins: [-124.8, -124.8, -124.8],
    X: new Float64Array(8), Y: new Float64Array(8),
    px: [], py: [], tx: [], ty: [], tn: [], tw: [], tphi: [], fy: [0, 0, 0], fv: [38, 38, 38], fw: [0, 0, 0], gv: 38,
    sfx: new Float64Array(72), sfy: new Float64Array(72), vst: 38, ymin: -124.8, xg: 54, gnd: 0, frame: 0,
    rgb: new Float32Array(N * 3), col: new Float32Array(48),
  };
  for (let k = 0; k < 3; k++) {
    S.pv.push([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    S.Ls.push({ ...BASE });
    S.px.push(new Float32Array(8));
    S.py.push(new Float32Array(8));
    S.tx.push(new Float32Array(NT));
    S.ty.push(new Float32Array(NT));
    S.tn.push(0);
    S.tw.push(0);
    S.tphi.push(0);
  }
  params.s = S;
}

// Each foot's track over a turn at the lengths its leg has now: the lowest height it reaches, and the mean speed of the part
// that is lowest and going forward. The ground takes the mean of the three.
function stanceStats(S) {
  const { sfx, sfy, X, Y } = S;
  let vs = 0, ys = 0;
  for (let leg = 0; leg < 3; leg++) {
    let ymin = 1e9, ok = true;
    for (let n = 0; n < 72; n++) {
      if (!solve(S.Ls[leg], (n * TAU) / 72, X, Y, 0.3)) {
        ok = false;
        break;
      }
      sfx[n] = X[7];
      sfy[n] = Y[7];
      ymin = min(ymin, Y[7]);
    }
    if (ok) {
      let sum = 0, cnt = 0;
      for (let n = 0; n < 72; n++) {
        const v = (sfx[(n + 1) % 72] - sfx[(n + 71) % 72]) / ((2 * TAU) / 72);
        if (sfy[n] <= ymin + 3 && v > 10) {
          sum += v;
          cnt++;
        }
      }
      if (cnt >= 8) {
        S.vsts[leg] = sum / cnt;
        S.ymins[leg] = ymin;
      }
    }
    vs += S.vsts[leg];
    ys += S.ymins[leg];
  }
  S.vst = vs / 3;
  S.ymin = ys / 3;
}

// One step of the walk: the crank turns, the lengths drift, each leg is solved and its tail is added to.
function step(S, d) {
  S.t += d;
  const t = S.t;
  const sw = 1 + 0.16 * sin(0.1117 * t + 0.4) + 0.08 * sin(0.0617 * t + 2.1);
  const dth = d * S.speed * 0.5 * sw;
  S.ph += dth;
  S.gaitNow += (S.gait + 0.09 * sin(0.2731 * t + 1.3) + 0.06 * sin(0.1651 * t + 0.4) - S.gaitNow) * min(1, d * 2);

  // the lengths follow where they want to be, as far as the linkage still goes together
  const g = S.want, k = min(1, d / 0.5), tl = S.tryL;
  for (let leg = 0; leg < 3; leg++) {
    wanted(S, g, leg);
    const pv = S.pv[leg];
    let f = 1;
    for (let it = 0; it < 5; it++) {
      for (let n = 0; n < 9; n++) S.goal[n] = pv[n] + (g[n] - pv[n]) * k * f;
      lengths(tl, S.goal);
      if (feasible(tl, S.X, S.Y)) {
        for (let n = 0; n < 9; n++) pv[n] = S.goal[n];
        break;
      }
      f *= 0.5;
    }
    lengths(S.Ls[leg], pv);
  }
  if (S.frame++ % 6 === 0) stanceStats(S);
  S.xg += (X0 - SC * S.ymin - S.xg) * min(1, d * 3);

  const X = S.X, Y = S.Y;
  for (let leg = 0; leg < 3; leg++) {
    const th = S.ph + TAU * (leg * S.gaitNow + (leg === 1 ? 0.05 * sin(0.164 * t + 2.2) : leg === 2 ? 0.08 * sin(0.1265 * t + 3.1) + 0.05 * sin(0.2234 * t + 0.9) : 0)), L = S.Ls[leg];
    if (!solve(L, th, X, Y, 0.2)) continue;
    const px = S.px[leg], py = S.py[leg], oy = LEGY[leg];
    S.fy[leg] = Y[7];
    for (let n = 0; n < 8; n++) {
      px[n] = X0 - SC * Y[n];
      py[n] = oy + SC * X[n];
    }
    // the tail: one point for every DT of the crank's angle, solved at that angle
    const tx = S.tx[leg], ty = S.ty[leg];
    let last = S.tphi[leg];
    if (S.tn[leg] === 0) last = th - 1.01 * DT;
    let guard = 0;
    while (th - last >= DT && guard++ < 8) {
      last += DT;
      if (!solve(L, last, X, Y, 0.2)) break;
      const w = S.tw[leg];
      tx[w] = X0 - SC * Y[7];
      ty[w] = oy + SC * X[7];
      S.tw[leg] = (w + 1) % NT;
      S.tn[leg] = min(NT, S.tn[leg] + 1);
    }
    if (th - last > 8 * DT) last = th;
    S.tphi[leg] = last;

    // how fast this foot is going (units a radian of the crank) and how planted it is
    if (solve(L, th + 0.03, X, Y, 0.2)) {
      const x1 = X[7];
      if (solve(L, th - 0.03, X, Y, 0.2)) {
        const v = (x1 - X[7]) / 0.06;
        S.fv[leg] = v;
        S.fw[leg] = sm(3.2, 0.8, S.fy[leg] - S.ymins[leg]) * sm(4, 14, v);
      }
    }
  }
  // the ground goes at the speed of the feet that are planted, so a planted foot does not slide; with none planted, at the mean
  let num = 0.06 * S.vst, den = 0.06;
  for (let leg = 0; leg < 3; leg++) {
    num += S.fw[leg] * S.fv[leg];
    den += S.fw[leg];
  }
  S.gv += (num / den - S.gv) * min(1, d * 7);
  S.gnd += SC * S.gv * dth;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kn[0];
  S.speed = cl(kn[1], 0.2, 3);
  S.stride = cl(kn[2], 0, 1);
  S.gait = 1 / 3 + 0.17 * cl(kn[3], -1, 1);
  if (!S.ready) {
    S.ready = true;
    S.t = 0;
    for (let leg = 0; leg < 3; leg++) {
      wanted(S, S.pv[leg], leg);
      lengths(S.Ls[leg], S.pv[leg]);
    }
    S.gaitNow = S.gait;
    stanceStats(S);
    for (let i = 0; i < 300; i++) step(S, 1 / 30);
  }
  step(S, d);
}

// ---- drawing

// Paint colour (r, g, b) over what is there, to cover a.
function paint(a, p, c, r, g, b) {
  const q = p * 3;
  a[q] += (r - a[q]) * c;
  a[q + 1] += (g - a[q + 1]) * c;
  a[q + 2] += (b - a[q + 2]) * c;
}

// Light added, not painted: for the glow round a joint and the rings of the feet.
function glow(a, p, v, r, g, b) {
  const q = p * 3;
  a[q] += r * v;
  a[q + 1] += g * v;
  a[q + 2] += b * v;
}

// A bar from (ax, ay) to (bx, by), hw either side of its centre, on a dark rim 1 LED wide.
function bar(a, ax, ay, bx, by, hw, col, o) {
  const R = hw + 1.1, vx = bx - ax, vy = by - ay, ll = vx * vx + vy * vy || 1;
  const x0 = max(0, floor(min(ax, bx) - R - 1)), x1 = min(W - 1, ceil(max(ax, bx) + R + 1));
  const y0 = max(0, floor(min(ay, by) - R - 1)), y1 = min(H - 1, ceil(max(ay, by) + R + 1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5 - ax, cy = y + 0.5 - ay, t = cl((cx * vx + cy * vy) / ll, 0, 1);
      const dd = hypot(cx - t * vx, cy - t * vy), p = y * W + x;
      const rim = cl(R + 0.5 - dd, 0, 1);
      if (rim <= 0) continue;
      paint(a, p, rim * 0.9, 0, 0, 0);
      const c = cl(hw + 0.5 - dd, 0, 1);
      if (c > 0) paint(a, p, c, col[o], col[o + 1], col[o + 2]);
    }
}

// A joint: a dot paler than its bars.
function joint(a, cx, cy, rad, col, o) {
  for (let y = max(0, floor(cy - rad - 2)); y <= min(H - 1, ceil(cy + rad + 2)); y++)
    for (let x = max(0, floor(cx - rad - 2)); x <= min(W - 1, ceil(cx + rad + 2)); x++) {
      const dd = hypot(x + 0.5 - cx, y + 0.5 - cy), p = y * W + x;
      const rim = cl(rad + 1.2 - dd, 0, 1);
      if (rim <= 0) continue;
      paint(a, p, rim * 0.9, 0, 0, 0);
      const c = cl(rad + 0.5 - dd, 0, 1);
      if (c > 0) paint(a, p, c, 0.45 + 0.55 * col[o], 0.45 + 0.55 * col[o + 1], 0.45 + 0.55 * col[o + 2]);
    }
}

// A fixed pivot: a ring with a dark centre.
function pivot(a, cx, cy, col, o) {
  for (let y = max(0, floor(cy - 5)); y <= min(H - 1, ceil(cy + 5)); y++)
    for (let x = max(0, floor(cx - 5)); x <= min(W - 1, ceil(cx + 5)); x++) {
      const dd = hypot(x + 0.5 - cx, y + 0.5 - cy), p = y * W + x;
      const rim = cl(4 - dd, 0, 1);
      if (rim <= 0) continue;
      paint(a, p, rim * 0.9, 0, 0, 0);
      const ring = cl(3.1 - dd, 0, 1) * cl(dd - 1.0, 0, 1);
      if (ring > 0) paint(a, p, ring, 0.55 + 0.45 * col[o], 0.55 + 0.45 * col[o + 1], 0.55 + 0.45 * col[o + 2]);
    }
}

// A triangle of one colour, filled to cover c, its edges soft.
function tri(a, ax, ay, bx, by, cx, cy, col, o, c) {
  const x0 = max(0, floor(min(ax, bx, cx) - 1)), x1 = min(W - 1, ceil(max(ax, bx, cx) + 1));
  const y0 = max(0, floor(min(ay, by, cy) - 1)), y1 = min(H - 1, ceil(max(ay, by, cy) + 1));
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay), sg = area < 0 ? -1 : 1;
  const e = [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let m = 1e9;
      for (const [p, q, r, s] of e) {
        const ex = r - p, ey = s - q, l = hypot(ex, ey) || 1;
        m = min(m, (sg * (ex * (y + 0.5 - q) - ey * (x + 0.5 - p))) / l);
      }
      const k = cl(m + 0.5, 0, 1) * c;
      if (k > 0) paint(a, y * W + x, k, col[o], col[o + 1], col[o + 2]);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const { rgb, col } = S;
  rgb.fill(0);
  // colours: per leg, the hip's bars, the lower leg's bars, and the tail
  for (let k = 0; k < 3; k++) {
    const h = S.hue + HUES[k] + 0.07 * sin(0.0776 * S.t + 2.1 * k + 0.5), b = 0.86 + 0.14 * sin(LUM[k] * S.t + 1.7 * k);
    hsv(h, 0.55, 0.62 * b, col, k * 12);
    hsv(h, 0.78, b, col, k * 12 + 3);
    hsv(h, 0.7, b, col, k * 12 + 6);
    hsv(h, 0.62, b, col, k * 12 + 9);
  }

  // the ground: slabs of every length, width and shade flush with the line the feet stand on, moving down the strip as the body walks up
  const xg = S.xg, gnd = S.gnd, GP = 17.3, gcol = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const sg = y + 0.5 - gnd, n = floor(sg / GP), u = sg - n * GP;
    const len = 6 + 8.5 * hash(n, 1), u0 = 1 + (GP - 2 - len) * hash(n, 2);
    const along = cl(u - u0 + 0.5, 0, 1) * cl(u0 + len - u + 0.5, 0, 1);
    if (along <= 0) continue;
    const wd = 4.8 + 3.6 * hash(n, 4), hv = hash(n, 3), vv = (hv < 0.45 ? 0.16 + 0.25 * hv : 0.55 + 0.3 * hv) * along;
    hsv(S.hue + 0.5 + 0.22 * (hash(n, 5) - 0.5), 0.58, 1, gcol, 0);
    for (let x = max(0, floor(xg + 0.5)); x < W; x++) {
      const c = cl(x + 1.0 - (xg + 0.9), 0, 1) * cl(xg + 0.9 + wd - x, 0, 1) * vv;
      if (c > 0) paint(rgb, y * W + x, c, gcol[0], gcol[1], gcol[2]);
    }
  }

  // the body: a line
  for (let y = 0; y < H; y++)
    for (let x = max(0, X0 - 3); x <= min(W - 1, X0 + 3); x++) {
      const c = cl(1.5 - abs(x + 0.5 - X0), 0, 1) * 0.34;
      if (c > 0) paint(rgb, y * W + x, c, 0.75, 0.82, 0.9);
    }

  // the tails
  for (let leg = 0; leg < 3; leg++) {
    const tx = S.tx[leg], ty = S.ty[leg], n = S.tn[leg], w = S.tw[leg], o = leg * 12 + 9;
    for (let a = 0; a + 1 < n; a++) {
      const i = (w - 1 - a + NT) % NT, j = (i - 1 + NT) % NT;
      const al = pow(1 - a / NT, 1.5) * 0.85;
      const x0 = tx[i], y0 = ty[i], x1 = tx[j], y1 = ty[j];
      const steps = max(1, ceil(hypot(x1 - x0, y1 - y0) * 2));
      for (let m = 0; m < steps; m++) {
        const f = m / steps, fx = x0 + (x1 - x0) * f, fy = y0 + (y1 - y0) * f;
        const ix = floor(fx), iy = floor(fy);
        for (let yy = iy - 1; yy <= iy + 1; yy++)
          for (let xx = ix - 1; xx <= ix + 1; xx++) {
            if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
            const dd = hypot(xx + 0.5 - fx, yy + 0.5 - fy), c = cl(1.6 - dd, 0, 1) * al * 0.42;
            if (c > 0) glow(rgb, yy * W + xx, c, col[o], col[o + 1], col[o + 2]);
          }
      }
    }
  }

  // the legs, top to bottom
  for (let leg = 0; leg < 3; leg++) {
    const px = S.px[leg], py = S.py[leg], o = leg * 12;
    // the kite is one rigid piece: a faint fill
    tri(rgb, px[4], py[4], px[5], py[5], px[6], py[6], col, o + 6, 0.22);
    tri(rgb, px[5], py[5], px[6], py[6], px[7], py[7], col, o + 6, 0.22);
    for (const [p, q, c] of BARS) bar(rgb, px[p], py[p], px[q], py[q], 1.0, col, o + (c ? 3 : 0));
    pivot(rgb, px[0], py[0], col, o + 9);
    pivot(rgb, px[1], py[1], col, o + 9);
    for (let n = 2; n < 7; n++) joint(rgb, px[n], py[n], 1.5, col, o + (n === 2 ? 0 : 3));
    joint(rgb, px[7], py[7], 2.0, col, o + 9);
    // a ring of light on the foot while it is planted
    const near = sm(2.8, 0.6, S.fy[leg] - S.ymin);
    if (near > 0) {
      for (let y = max(0, floor(py[7] - 5)); y <= min(H - 1, ceil(py[7] + 5)); y++)
        for (let x = max(0, floor(px[7] - 5)); x <= min(W - 1, ceil(px[7] + 5)); x++) {
          const dd = hypot(x + 0.5 - px[7], y + 0.5 - py[7]), c = exp(-dd * dd / 5) * near * 0.5;
          glow(rgb, y * W + x, c, col[o + 9], col[o + 10], col[o + 11]);
        }
    }
  }

  for (let p = 0, q = 0; p < N; p++, q += 3) display.setPixel(p % W, (p / W) | 0, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
