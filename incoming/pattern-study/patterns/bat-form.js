// ===== Patternflow pattern =====
// Title:   Bat Form
// Family:  halloween
// Idea:    In the tall pointed window of a dark tower room a vampire stands black against a crimson and orange dusk, raises his arms so his cape spreads into a wide sail, shrinks as the cape's hem breaks into the scallops of a bat's wings, flies a loop out into the sky and back to the sill, and grows into the vampire again and folds his cape, while far bats circle over the hills.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cape=-1..1, Flock=0..1
//
// Knob 1: Hue. The dusk: overhead it stays purple, and the glow over the hills walks back round the wheel from gold at 0 through red at 0.15, magenta at 0.3, violet at 0.45 and blue at 0.6 to teal at 0.8 and lime green at 1. The vampire stays black, his eyes red and his cape's lining dark crimson.
// Knob 2: Speed. At 2 one change takes 10 seconds: his arms rise from 0.25 s and the cape is wide by 1.15 s, he shrinks into the bat from 2 to 3.7 s, the bat beats its wings four to five times a second, flies its loop from 3.4 to 7.6 s and lands, he is a man again by 8.9 s and has folded the cape by 9.7 s. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Cape. How far the cape opens, and with it the bat's wings: at -1 the open cape is 25 LEDs across and the wings 25; at 0, where it opens, 43 and 45; at 1 the cape is 62 across, spilling over the jambs, and the wings span the panel.
// Knob 4: Flock. How many far bats circle high in the sky and low over the hills, hazed a little toward the sky so the vampire stays the blackest thing: none at 0, 7 at 0.06 where it opens, 60 at 0.5 and a swarm of 120 at 1.
// Buttons: K1 tap while he stands starts the change now; tapped while he folds his cape, he opens it again.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The window: an equilateral pointed arch over straight jambs, its sill a
// ledge across the room. The vampire's chest stands at PX, PY.
const WX0 = 7, WX1 = 57, SPRING = 50, SILL = 104, SPAN = WX1 - WX0, TOP = SPRING - SPAN * 0.866;
const G0 = 1.15, PX = 32, PY = SILL - 30 * G0;
const inWindow = (x, y) => y <= SILL && x >= WX0 && x <= WX1 && (y >= SPRING || (Math.hypot(x - WX1, y - SPRING) <= SPAN && Math.hypot(x - WX0, y - SPRING) <= SPAN));
// The dusk from the top of the window to the hills: height, how far the
// hue has gone from the purple overhead toward the hue over the hills,
// saturation and value.
const DUSK = [[0, 0, 0.85, 0.36], [0.3, 0.24, 0.85, 0.52], [0.55, 0.52, 0.85, 0.7], [0.78, 0.76, 0.9, 0.95], [0.9, 0.91, 0.85, 1], [1, 1, 0.7, 1]];
// The far hills: their top per column.
const HILL = new Float32Array(W);
for (let x = 0; x < W; x++) HILL[x] = 99.5 + 1.6 * sin(x * 0.11 + 1) + 1.2 * sin(x * 0.31) + 0.6 * sin(x * 0.9);
// Two dead trees on the hills as line segments [x0, y0, x1, y1].
const TREES = [];
for (const [bx, h, s] of [[13, 12, 1], [51, 9, -1]]) {
  const by = HILL[bx];
  TREES.push([bx, by, bx + 0.5 * s, by - h], [bx + 0.3 * s, by - 0.55 * h, bx + 3.5 * s, by - 0.85 * h], [bx + 0.4 * s, by - 0.75 * h, bx - 2.5 * s, by - h - 1], [bx + 2 * s, by - 0.7 * h, bx + 3 * s, by - 0.6 * h - 3]);
}

// Three poses of the right half of the figure, in LEDs, feet at (0, 0) and
// up negative; the left half mirrors it. head: centre and radius. collar:
// inner and outer foot and the tip; it rises into the bat's ear. sh, waist,
// hip, foot: the body's side. arm: shoulder, elbow, wrist. tips: the cape's
// hem, which becomes the trailing edge of the wing, and att where the
// membrane meets the body; dep is how deep the scallops between them are.
const CLOSED = {
  head: [0, -40.5, 3.6], collar: [2.4, -36.6, 6.2, -35.4, 7.4, -46.5],
  sh: [5.6, -35.4], waist: [4, -22], hip: [4.2, -19.5], foot: [2.6, 0],
  arm: [5.4, -35.4, 7.2, -26, 8.4, -16], tips: [11.2, -1.6, 8.2, -1, 5.2, -0.8, 2.6, -0.8], att: [0.4, -0.8], dep: 0.12,
};
const SPREAD = {
  head: [0, -40.5, 3.6], collar: [2.4, -36.6, 6.2, -35.4, 7.4, -46.5],
  sh: [5.6, -35.4], waist: [4, -22], hip: [4.2, -19.5], foot: [3.4, 0],
  arm: [5.6, -35.4, 12.5, -40.5, 18.5, -45.5], tips: [20.5, -24, 16.5, -10.5, 11, -4.5, 5.6, -2], att: [1.6, -2.4], dep: 0.22,
};
const BAT = {
  head: [0, -33.6, 2.6], collar: [0.5, -35.4, 2.6, -34.3, 2.6, -39.8],
  sh: [2.3, -31.3], waist: [1.9, -27.5], hip: [1.5, -25.8], foot: [1, -23],
  arm: [2.3, -31.3, 8.5, -35.6, 14.5, -37], tips: [27, -30.5, 21.5, -26.6, 15, -25.2, 8.5, -26.6], att: [2.3, -27], dep: 0.5,
};
const mixPose = (A, B, t, o) => {
  for (const k in A) o[k] = typeof A[k] === "number" ? lerp(A[k], B[k], t) : A[k].map((v, i) => lerp(v, B[k][i], t));
  return o;
};

// Small bats far over the hills: orbit centre, radii, speed and phase,
// half span and wing beat.
const FLOCK = [];
for (let i = 0; i < 120; i++) {
  const r = (k) => hash(i * 7 + k);
  // Most fly high, where the cape never covers them; each orbit fits the
  // arch at its height.
  const cy = r(11) < 0.7 ? 14 + 44 * r(2) : 60 + 32 * r(2), half = (cy >= SPRING ? SPAN : sqrt(SPAN * SPAN - (cy - SPRING) ** 2)) - SPAN / 2 - 3;
  const rx = min(half * 0.6, 3 + 9 * r(3));
  FLOCK.push({ cx: 32 + (2 * r(1) - 1) * max(0, half - rx), cy, rx, ry: 2 + 4 * r(4), w: (r(5) < 0.5 ? -1 : 1) * (0.5 + 0.8 * r(6)), ph: TAU * r(7), s: 3 + 4.4 * r(8) ** 2, f: 9 + 6 * r(9), fp: TAU * r(10) });
}

// A small bat's right half, half span 1, from the top of the head round to
// the middle of its belly: x, y and how far the beat lifts the point.
const MINI = [0, -0.36, 0, 0.1, -0.4, 0, 0.16, -0.66, 0, 0.24, -0.34, 0, 0.5, -0.5, 1, 1, -0.3, 1.4, 0.84, -0.04, 1.1, 0.7, 0.04, 0.9, 0.6, -0.06, 0.8, 0.44, 0.12, 0.6, 0.34, 0, 0.4, 0.2, 0.18, 0.2, 0.1, 0.32, 0, 0, 0.34, 0];

// One change in story seconds at Speed 2.
const CYCLE = 10;

export function setup(params) {
  params.s = {
    t: 0, clock: 0, hue: 0, speed: 2, cape: 0, flock: 0.06, key: "", btn: false, flap: 0, spread: 0, m: 0, lift: 0, fly: 0, beat: 0,
    base: new Float32Array(N * 3), buf: new Float32Array(N * 3), win: new Uint8Array(N), covB: new Float32Array(N), covM: new Float32Array(N),
    pose: {}, pts: new Float64Array(64), xs: [], col: new Float32Array(3),
  };
}

// The room, the window and the dusk, kept until Hue moves.
function background(S) {
  const { base, win } = S, c = S.col, hue = S.hue;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), cx = x + 0.5, cy = y + 0.5;
    win[p] = inWindow(cx, cy) ? 1 : 0;
  }
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), cx = x + 0.5, cy = y + 0.5, o = 3 * p;
    if (win[p]) {
      sky(hue, (cy - TOP) / (SILL - TOP), c);
      let [r, g, b] = c;
      // The jamb: a band just inside the opening where the stone is lit.
      let edge = 9;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= W || yy < 0 || yy >= H || !win[yy * W + xx]) edge = min(edge, max(abs(dx), abs(dy)));
        }
      if (edge <= 2 && cy < SILL - 0.5) {
        const k = edge === 1 ? 0.42 : 0.62;
        (r = r * k + 0.04), (g = g * k + 0.02), (b = b * k + 0.06);
      }
      // The hills and their trees, dark against the glow.
      if (cy > HILL[x]) [r, g, b] = cy - HILL[x] < 1 ? [r * 0.35, g * 0.25, b * 0.4] : [0.05, 0.02, 0.07];
      base[o] = r;
      base[o + 1] = g;
      base[o + 2] = b;
    } else {
      // The room: dark stone in courses, warmed near the window, the sill's
      // top edge lit.
      const near = max(0, 1 - distWin(cx, cy) / 14);
      const course = (y % 6 === 5) || ((x + (floor(y / 6) % 2) * 5) % 10 === 0) ? 0.55 : 1;
      sky(hue, 0.55, c);
      let k = (0.06 + 0.16 * near * near) * course;
      let r = 0.05 * course + c[0] * k, g = 0.02 * course + c[1] * k, b = 0.08 * course + c[2] * k;
      if (y >= SILL && y < SILL + 6 && x >= WX0 - 3 && x <= WX1 + 3) {
        sky(hue, 0.95, c);
        const top = y === SILL ? 0.75 : y === SILL + 1 ? 0.3 : y < SILL + 4 ? 0.12 : 0.07;
        (r = c[0] * top + 0.03), (g = c[1] * top + 0.01), (b = c[2] * top + 0.05);
      }
      base[o] = r;
      base[o + 1] = g;
      base[o + 2] = b;
    }
  }
  for (const [x0, y0, x1, y1] of TREES) {
    const n = ceil(max(abs(x1 - x0), abs(y1 - y0)) * 2);
    for (let i = 0; i <= n; i++) {
      const x = floor(lerp(x0, x1, i / n)), y = floor(lerp(y0, y1, i / n)), o = 3 * (y * W + x);
      if (x >= 0 && x < W && y >= 0 && y < H) base.set([0.05, 0.02, 0.07], o);
    }
  }
}
// Rough distance from (x, y) to the window opening.
function distWin(x, y) {
  if (y > SILL) return Math.hypot(max(0, WX0 - x, x - WX1), y - SILL);
  if (y >= SPRING) return max(0, WX0 - x, x - WX1);
  return max(0, Math.hypot(x - (x < 32 ? WX1 : WX0), y - SPRING) - SPAN, WX0 - x, x - WX1);
}
function sky(hue, t, out) {
  t = cl(t, 0, 1);
  let i = 0;
  while (i < DUSK.length - 2 && t > DUSK[i + 1][0]) i++;
  const A = DUSK[i], B = DUSK[i + 1], u = (t - A[0]) / (B[0] - A[0]);
  // Over the hills gold at Hue 0, walking back through red, magenta,
  // violet and blue to green at 1; overhead always purple, so the dim top
  // never turns brown.
  const low = 1.12 - 0.85 * hue;
  hsv(0.79 + (low - 0.79) * lerp(A[1], B[1], u), lerp(A[2], B[2], u), lerp(A[3], B[3], u), out, 0);
}

// Coverage of a polygon added into cov: four sub-rows per LED, the span
// ends shared out by area, nonzero winding.
function fill(S, cov, P, n) {
  let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) (y0 = min(y0, P[2 * i + 1])), (y1 = max(y1, P[2 * i + 1]));
  const s0 = max(0, floor(y0 * 4)), s1 = min(4 * H - 1, ceil(y1 * 4)), xs = S.xs;
  for (let sy = s0; sy <= s1; sy++) {
    const y = (sy + 0.5) / 4, row = floor(y) * W;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ay = P[2 * j + 1], by = P[2 * i + 1];
      if (ay <= y !== by <= y) {
        const ax = P[2 * j], bx = P[2 * i];
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1);
      }
    }
    // Sort the crossings by x (a few, so insertion sort).
    for (let i = 2; i < xs.length; i += 2) {
      const vx = xs[i], vd = xs[i + 1];
      let j = i - 2;
      while (j >= 0 && xs[j] > vx) (xs[j + 2] = xs[j]), (xs[j + 3] = xs[j + 1]), (j -= 2);
      xs[j + 2] = vx;
      xs[j + 3] = vd;
    }
    let wind = 0, from = 0;
    for (let i = 0; i < xs.length; i += 2) {
      const before = wind;
      wind += xs[i + 1];
      if (before === 0) from = xs[i];
      else if (wind === 0) span(cov, row, from, xs[i], 0.25);
    }
  }
}
function span(cov, row, xa, xb, w) {
  xa = max(xa, 0);
  xb = min(xb, W);
  if (xb <= xa) return;
  const ia = floor(xa), ib = floor(xb);
  if (ia === ib) {
    cov[row + ia] += (xb - xa) * w;
    return;
  }
  cov[row + ia] += (ia + 1 - xa) * w;
  for (let x = ia + 1; x < ib; x++) cov[row + x] += w;
  if (ib < W) cov[row + ib] += (xb - ib) * w;
}

// Where the story is at story time t: the spread s (0 cape closed, 1 arms
// up and the cape wide), the change m (0 man, 1 bat), the flight f along its
// loop, the lift off the sill and the wing beat's strength.
function story(S) {
  const t = S.t;
  S.spread = t < 5 ? ease((t - 0.25) / 0.9) : 1 - ease((t - 8.9) / 0.8);
  S.m = t < 5 ? ease((t - 2) / 1.7) : 1 - ease((t - 7.8) / 1.1);
  S.lift = ease((t - 2.9) / 0.8) - ease((t - 7.6) / 0.5);
  S.fly = ease((t - 3.4) / 4.2);
  S.beat = ease((t - 2.3) / 0.8) * (1 - ease((t - 8) / 0.7));
}

// The figure's outline for the current story, into covB (body) and covM
// (cape and wings), and the eyes.
function figure(S) {
  const wC = 0.92 + 0.4 * S.cape, m = S.m, mb = ease((m - 0.15) / 0.85), mw = ease(m / 0.85);
  const A = mixPose(CLOSED, SPREAD, S.spread, S.pa || (S.pa = {}));
  // The arm swings up through its angles, keeping its length, so the cape
  // opens like a wing instead of being pulled flat.
  const c0 = CLOSED.arm, c1 = SPREAD.arm, ang = (q, i) => Math.atan2(q[i + 3] - q[i + 1], q[i + 2] - q[i]), len = (q, i) => Math.hypot(q[i + 2] - q[i], q[i + 3] - q[i + 1]);
  for (let i = 0; i < 4; i += 2) {
    const th = lerp(ang(c0, i), ang(c1, i), S.spread), l = lerp(len(c0, i), len(c1, i), S.spread);
    A.arm[i + 2] = A.arm[i] + l * cos(th);
    A.arm[i + 3] = A.arm[i + 1] + l * sin(th);
  }
  const Pz = mixPose(A, BAT, mw, S.pose);
  // The body changes a little behind the wings.
  for (const k of ["head", "sh", "waist", "hip", "foot"]) Pz[k] = A[k].map((v, i) => lerp(v, BAT[k][i], mb));
  // Cape: the arms and hem reach wider with the knob, more so once spread.
  const wx = lerp(1 + 0.6 * (wC - 1), wC, max(S.spread, m));
  // Where the chest is, how big the figure is and how it leans.
  const f = S.fly, a = TAU * f, depth = 1 - 0.6 * sin(PI * f) ** 2;
  const g = G0 * lerp(1, 0.78, mb) * depth, cx = PX + 13 * sin(a), cy = PY - 4 * S.lift - 22 * (1 - cos(a)), bank = 0.32 * sin(a) * sin(PI * f);
  // Out past the window the wall hides what strays beyond the opening.
  S.clip = depth < 0.97;
  const flap = S.beat * 0.55 * sin(S.flap), cb = cos(bank), sb = sin(bank);
  const pt = (x, y, side) => {
    // local (feet at 0, chest at -30) to the panel.
    const lx = side * x, ly = y + 30;
    return [cx + g * (cb * lx - sb * ly), cy + g * (sb * lx + cb * ly)];
  };
  const P = S.pts;
  S.box = [99, -99, 999, -99];
  const poly = (cov, list) => {
    for (let i = 0; i < list.length; i++) {
      P[2 * i] = list[i][0];
      P[2 * i + 1] = list[i][1];
      S.box[0] = min(S.box[0], list[i][0]);
      S.box[1] = max(S.box[1], list[i][0]);
      S.box[2] = min(S.box[2], list[i][1]);
      S.box[3] = max(S.box[3], list[i][1]);
    }
    fill(S, cov, P, list.length);
  };
  for (const side of [1, -1]) {
    // Wing: arm then hem, turned about the shoulder by the beat.
    const [sx, sy] = Pz.sh, ca = cos(flap), sa = sin(flap);
    const rot = (x, y, ch = 1) => {
      const dx = x * wx - sx, dy = (y - sy) * ch;
      return [sx + ca * dx + sa * dy, sy - sa * dx + ca * dy];
    };
    // The arms lift the sail higher as well as wider with the knob.
    const up = lerp(1, 1 + 0.22 * S.cape, max(S.spread, m));
    const ar = Pz.arm, el = rot(ar[2], ar[3], up), wr = rot(ar[4], ar[5], up);
    const T = [];
    // The hem stirs in the draught from the window while the cape is wide.
    const stir = 0.9 * S.spread * (1 - mw);
    const ch = lerp(1, 1 + 0.2 * S.cape, mw);
    for (let i = 0; i < 4; i++) T.push(rot(Pz.tips[2 * i] + stir * sin(S.clock * 2.3 + i * 1.7 + side), Pz.tips[2 * i + 1] + stir * 0.6 * sin(S.clock * 1.9 + i * 2.3), ch));
    T.push(Pz.att);
    const out = [[sx, sy - 1.2], el, wr, T[0]];
    for (let i = 0; i < 4; i++) {
      // A scallop from tip i to i + 1, bowed toward the shoulder.
      const [x0, y0] = T[i], [x1, y1] = T[i + 1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, L = Math.hypot(x1 - x0, y1 - y0);
      const ux = sx - mx, uy = sy - my, ul = Math.hypot(ux, uy) || 1, d = Pz.dep * L;
      const qx = mx + (ux / ul) * d, qy = my + (uy / ul) * d;
      for (let k = 1; k <= 4; k++) {
        const u = k / 4, v = 1 - u;
        out.push([v * v * x0 + 2 * u * v * qx + u * u * x1, v * v * y0 + 2 * u * v * qy + u * u * y1]);
      }
    }
    poly(S.covM, out.map(([x, y]) => pt(x, y, side)));
    // Arm bones over the membrane.
    const arm = (a0, a1, r0, r1) => {
      const dx = a1[0] - a0[0], dy = a1[1] - a0[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      poly(S.covB, [[a0[0] + nx * r0, a0[1] + ny * r0], [a1[0] + nx * r1, a1[1] + ny * r1], [a1[0] - nx * r1, a1[1] - ny * r1], [a0[0] - nx * r0, a0[1] - ny * r0]].map(([x, y]) => pt(x, y, side)));
    };
    const thick = lerp(1.3, 0.75, mw);
    arm([sx, sy], el, thick * 1.2, thick);
    arm(el, wr, thick, thick * 0.8);
    // Collar, rising into the ear.
    const c = Pz.collar;
    poly(S.covB, [[c[0], c[1]], [c[2], c[3]], [c[4], c[5]]].map(([x, y]) => pt(x, y, side)));
    // Body side: neck, shoulder, waist, hip, leg to the foot, and the
    // middle line back up.
    const hd = Pz.head, nk = hd[1] + hd[2] * 0.7;
    poly(S.covB, [[0, nk], [hd[2] * 0.45, nk], [Pz.sh[0], Pz.sh[1]], [Pz.waist[0], Pz.waist[1]], [Pz.hip[0], Pz.hip[1]], [Pz.foot[0] + 0.9, Pz.foot[1]], [Pz.foot[0] - 1.6 * (1 - mb) - 0.3, Pz.foot[1]], [0.4, Pz.hip[1] + 1.5 * (1 - mb)], [0, Pz.hip[1] + 1.5 * (1 - mb)]].map(([x, y]) => pt(x, y, side)));
  }
  // Head.
  const hd = Pz.head, circ = [];
  for (let i = 0; i < 14; i++) circ.push(pt(hd[0] + hd[2] * cos((TAU * i) / 14), hd[1] + hd[2] * sin((TAU * i) / 14), 1));
  poly(S.covB, circ);
  // Eyes, while it faces the room.
  const away = sin(PI * f) > 0.35;
  S.eyes = away ? null : [pt(hd[2] * 0.36, hd[1] - 0.2, 1), pt(hd[2] * 0.36, hd[1] - 0.2, -1)];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.cape = cl(k[2], -1, 1);
  S.flock = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  // A tap while he stands starts the change. While he folds the cape he
  // opens it again from the same width: the fold is the spread run
  // backwards, so the time that matches is a mirror image.
  if (btn && !S.btn) {
    if (S.t < 0.25) S.t = 0.25;
    else if (S.t >= 8.9) S.t = 0.25 + 0.9 * (1 - cl((S.t - 8.9) / 0.8, 0, 1));
  }
  S.btn = btn;
  S.t = (S.t + ds) % CYCLE;
  S.clock += ds;
  S.flap += ds * TAU * (4.2 + 1.2 * S.beat * (1 - S.fly));
  story(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const key = S.hue.toFixed(3);
  if (key !== S.key) {
    S.key = key;
    background(S);
  }
  const { base, buf, win, covB, covM } = S;
  buf.set(base);
  // Thin clouds drifting across the dusk.
  for (let y = floor(TOP); y < 92; y++)
    for (let x = WX0; x <= WX1; x++) {
      const p = y * W + x;
      if (!win[p]) continue;
      let c = 0;
      for (let i = 0; i < 3; i++) {
        const yc = 24 + 21 * i + 2 * sin(x * 0.08 + i * 2 + S.clock * 0.1), dy = (y - yc) / (1.2 + 0.6 * i);
        const patch = 0.5 + 0.5 * sin((x + S.clock * (1.2 + 0.4 * i)) * (0.13 + 0.03 * i) + i * 4);
        c += exp(-dy * dy) * patch;
      }
      if (c > 0.02) {
        const o = 3 * p, k = 1 - 0.45 * min(1, c);
        buf[o] *= k;
        buf[o + 1] *= k;
        buf[o + 2] *= k * 0.95 + 0.05 * c;
      }
    }
  // Small bats against the sky, seen only through the window: a filled
  // outline each, the wings lifted and dropped by the beat.
  const nb = round(120 * S.flock), sb = S.covM, P = S.pts;
  sb.fill(0);
  for (let i = 0; i < nb; i++) {
    // Each flutters off its orbit in small jerks, as bats do.
    const b = FLOCK[i], a = b.ph + b.w * S.clock * 0.9, c = S.clock * b.f * 0.37 + b.fp;
    const x = b.cx + b.rx * cos(a) + 1.2 * sin(c) * sin(2.3 * c), y = b.cy + b.ry * sin(a) + 1.4 * sin(1.7 * c + 1) * sin(0.9 * c);
    const lift = -0.5 * sin(b.f * S.clock + b.fp);
    let n = 0;
    for (const sd of [1, -1])
      for (let j = 0; j < MINI.length; j += 3) {
        const k = sd > 0 ? j : MINI.length - 3 - j, lx = MINI[k], ly = MINI[k + 1] + MINI[k + 2] * lift;
        P[2 * n] = x + sd * lx * b.s;
        P[2 * n + 1] = y + ly * b.s;
        n++;
      }
    fill(S, sb, P, n);
  }
  if (nb)
    for (let p = 0; p < N; p++) {
      const a = min(1, sb[p]);
      if (a <= 0 || !win[p]) continue;
      // Hazed a little toward the sky, so they stay apart from the black
      // figure in front of them.
      const o = 3 * p;
      buf[o] += (0.2 * base[o] + 0.01 - buf[o]) * a;
      buf[o + 1] += (0.2 * base[o + 1] - buf[o + 1]) * a;
      buf[o + 2] += (0.2 * base[o + 2] + 0.02 - buf[o + 2]) * a;
    }
  // The vampire or the bat.
  covB.fill(0);
  covM.fill(0);
  figure(S);
  const bx0 = max(0, floor(S.box[0]) - 1), bx1 = min(W - 1, ceil(S.box[1]) + 1), by0 = max(0, floor(S.box[2]) - 1), by1 = min(H - 1, ceil(S.box[3]) + 1);
  // The cape's lining shows dark crimson while it is spread, and goes as it
  // becomes a wing.
  const lin = 0.16 * S.spread * (1 - ease(S.m / 0.6)), lining = [lin, lin * 0.05, lin * 0.12];
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const p = y * W + x, cb = min(1, covB[p]), cm = min(1, covM[p]), a = max(cb, cm);
      if (a <= 0 || (S.clip && !win[p])) continue;
      const o = 3 * p, fr = 0.02 * (1 - cb) + 0.015, fg = 0.008, fbl = 0.03;
      const lr = lining[0] * (1 - cb), lg = lining[1] * (1 - cb), lb = lining[2] * (1 - cb);
      buf[o] += (fr + lr - buf[o]) * a;
      buf[o + 1] += (fg + lg - buf[o + 1]) * a;
      buf[o + 2] += (fbl + lb - buf[o + 2]) * a;
    }
  if (S.eyes) {
    const glow = 0.6 + 0.4 * sin(S.clock * 3);
    for (const [ex, ey] of S.eyes) {
      const x = floor(ex), y = floor(ey);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = 3 * (y * W + x);
      buf[o] = glow;
      buf[o + 1] = 0.05 * glow;
      buf[o + 2] = 0.04 * glow;
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = 3 * p;
      display.setPixel(x, y, round(cl(buf[o], 0, 1) * 255), round(cl(buf[o + 1], 0, 1) * 255), round(cl(buf[o + 2], 0, 1) * 255));
    }
}
