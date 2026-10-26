// ===== Patternflow pattern =====
// Title:   Buffon's Noodle
// Family:  data
// Idea:    Needles drop one after another onto a floor of lines 16 LEDs apart, warm where they cross a line and cool where they miss, with a white tick on the line at every crossing, while the count of crossings against the length dropped estimates pi below, and bending every needle into an arc of the same length leaves the average alone until, as a closed circle 16 LEDs across, each one crosses exactly twice and the estimate stops wobbling on pi.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Buffon's needle (Georges-Louis Leclerc, Comte de Buffon, 1777) and Barbier's noodle (Joseph-Emile Barbier, 1860), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Length=0.2..1, Bend=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the needles that cross a line are gold and those that miss are azure; at 0.25 green and magenta, at 0.5 blue and orange. The floor lines stay slate.
// Knob 2: Speed. Needles a second, five times the knob: 10 at 2, 1 at 0.2, 15 at 3. A needle lies about 4 seconds at 2 and longer when the drops are slower, so at Length 0.2 the floor holds about 40 needles at 2 and 13 at 0.2. The first 12 fall in the first half second whatever the knob says.
// Knob 3: Length. The needle's length as a share of pi times the line spacing: 0.2 opens on needles 10 LEDs long that cross 0.4 lines on average, 0.5 on 25 LEDs crossing 1, and 1 on 50 LEDs crossing 2. Longer needles leave sooner, about 2 seconds at 1, so the floor carries about the same ink. The estimate is 2 x (length dropped) / (16 x crossings), so any length gives pi on average.
// Knob 4: Bend. Bends each new needle into a circular arc of the same length, turning through Bend x 360 degrees: 0.06 is a needle bowed by 22 degrees, 0.5 a half circle, 1 a closed ring. The average count never changes. At Length 1 and Bend 1 the ring is 16 LEDs across, crosses exactly two lines every time, and the error bars of the trace fall flat onto the pi line.
// Buttons: K1 tap starts the count again. It also starts again by itself half a second after Length or Bend comes to rest at a new value.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, asin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Line spacing, the floor's last row, and line k's height: the centre of
// row 16k, so rows 0, 16, ... 96 carry the lines.
const D = 16, FLOOR = 96, Y0 = 0.5;
// The trace: one column per drop, the newest on the right, beside a pi
// sign; the windowed estimate is over the last WIN drops.
const TX = 7, HIST = W - TX, WIN = 24, TMID = 116, TAMP = 10;
// Hue of the crossing needles at knob 0 (gold), and the missing ones
// opposite it on the wheel.
const HUE0 = 0.13;

// 3 x 5 digits, row by row from the top, three bits a row.
const FONT = {
  0: 0b111101101101111, 1: 0b010110010010111, 2: 0b111001111100111, 3: 0b111001111001111,
  4: 0b101101111001001, 5: 0b111100111001111, 6: 0b111100111101111, 7: 0b111001001001001,
  8: 0b111101111101111, 9: 0b111101111001111, "-": 0b000000111000000,
};
// A pi sign, five bits a row.
const PI_SIGN = [0b11111, 0b01010, 0b01010, 0b01010, 0b10011];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

export function setup(params) {
  params.s = {
    t: 0, acc: 0, acc0: 0, burst: 12, needles: [], epoch: 0,
    hue: 0, speed: 2, share: 0.2, bend: 0.06, ref: null, settle: 0,
    // Since the last start: drops, length dropped and crossings.
    n: 0, sumL: 0, sumC: 0,
    winL: new Float64Array(WIN), winC: new Float64Array(WIN), wi: 0, wn: 0,
    // The trace, oldest first: the running estimate, the windowed one, and
    // a mark where the count started again.
    cum: new Float64Array(HIST).fill(NaN), win: new Float64Array(HIST).fill(NaN), mark: new Uint8Array(HIST),
    rgb: new Float32Array(W * H * 3), warm: [0, 0, 0], cool: [0, 0, 0],
  };
}

// The noodle's shape. It is a circular arc of length L turning through th,
// placed by its centroid G and the direction a from the arc's centre to
// its midpoint; the arc's centre sits c behind G. For th near 0 it is the
// straight needle through G, square to a. A point s along the arc (from
// -L/2 to L/2) lies at G + (R cos(s/R) - c) u + R sin(s/R) v, with u the
// direction a and v a quarter turn on.
function shape(L, th) {
  if (th < 1e-3) return { R: 0, c: 0 };
  const R = L / th;
  return { R, c: (R * sin(th / 2)) / (th / 2) };
}
function rel(nd, s, o) {
  const ca = cos(nd.a), sa = sin(nd.a);
  let pu, pv;
  if (nd.R === 0) (pu = 0), (pv = s);
  else (pu = nd.R * cos(s / nd.R) - nd.c), (pv = nd.R * sin(s / nd.R));
  o[0] = pu * ca - pv * sa;
  o[1] = pu * sa + pv * ca;
}

// Every crossing of the noodle with the lines y = 16k + 0.5, all of them,
// not just the ones on the panel, as positions s along it. Exact: a
// straight needle meets a line at one s, a circle at the two angles whose
// sine puts it on the line, kept when they fall inside the arc.
function crossings(nd) {
  const out = [], L = nd.L, k0 = Math.ceil((nd.gy - L - Y0) / D), k1 = floor((nd.gy + L - Y0) / D);
  const ca = cos(nd.a), sa = sin(nd.a);
  for (let k = k0; k <= k1; k++) {
    const y = D * k + Y0;
    if (nd.R === 0) {
      // y(s) = gy + s cos a
      if (abs(ca) < 1e-12) continue;
      const s = (y - nd.gy) / ca;
      if (abs(s) < L / 2) out.push(s);
    } else {
      const oy = nd.gy - nd.c * sa, v = (y - oy) / nd.R;
      if (abs(v) >= 1) continue;
      const b = asin(v);
      for (const beta of [b, PI - b]) {
        const d = (((beta - (nd.a - nd.th / 2)) % TAU) + TAU) % TAU;
        if (d < nd.th) out.push((d - nd.th / 2) * nd.R);
      }
    }
  }
  return out;
}

function drop(S, fall) {
  const R = Math.random;
  // Four draws a drop whatever the knobs, so drop i lands in the same place
  // at every Length and Bend and only its shape differs.
  const gx = 2 + 60 * R(), gy = Y0 + FLOOR * R(), a = TAU * R(), spin = (R() < 0.5 ? -1 : 1) * (1.5 + 2 * R());
  const L = S.share * PI * D, th = S.bend * TAU, sh = shape(L, th);
  const nd = { gx, gy, a, spin, L, th, R: sh.R, c: sh.c, age: 0, fall, landed: false, epoch: S.epoch };
  nd.cross = crossings(nd);
  S.needles.push(nd);
}

function land(S, nd) {
  nd.landed = true;
  // Long needles go sooner, so the floor holds about as much ink at any
  // Length: about 4 seconds at Speed 2 and Length 0.2, 2 at Length 1.
  nd.life = 4 * sqrt(2 / S.speed) * (0.2 / (nd.L / (PI * D))) ** 0.4;
  if (nd.epoch !== S.epoch) return;
  const C = nd.cross.length;
  S.n++;
  S.sumL += nd.L;
  S.sumC += C;
  S.winL[S.wi] = nd.L;
  S.winC[S.wi] = C;
  S.wi = (S.wi + 1) % WIN;
  S.wn = min(WIN, S.wn + 1);
  let wl = 0, wc = 0;
  for (let i = 0; i < S.wn; i++) (wl += S.winL[i]), (wc += S.winC[i]);
  S.cum.copyWithin(0, 1);
  S.win.copyWithin(0, 1);
  S.mark.copyWithin(0, 1);
  S.cum[HIST - 1] = S.sumC ? (2 * S.sumL) / (D * S.sumC) : Infinity;
  S.win[HIST - 1] = wc ? (2 * wl) / (D * wc) : Infinity;
  S.mark[HIST - 1] = S.n === 1 ? 1 : 0;
}

function restart(S) {
  S.epoch++;
  S.n = S.sumL = S.sumC = 0;
  S.wi = S.wn = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.share = cl(kv[2], 0.2, 1);
  S.bend = cl(kv[3], 0, 1);
  // A new Length or Bend starts the count again once the knob rests, so the
  // readout is about the noodle on the floor.
  if (!S.ref) S.ref = [S.share, S.bend];
  if (abs(S.share - S.ref[0]) > 0.004 || abs(S.bend - S.ref[1]) > 0.004) (S.ref = [S.share, S.bend]), (S.settle = 0.5);
  if (S.settle > 0 && (S.settle -= d) <= 0) restart(S);
  if (input.btnPressed && input.btnPressed[0]) restart(S);
  S.t += d;
  const fall = 0.32 * cl(2 / S.speed, 0.7, 2);
  // The first dozen fall in half a second, so the floor is never bare.
  if (S.burst > 0) {
    S.acc0 += d * 24;
    while (S.acc0 >= 1 && S.burst > 0) S.acc0--, S.burst--, drop(S, 0.3);
  } else {
    S.acc += d * 5 * S.speed;
    while (S.acc >= 1) S.acc--, drop(S, fall);
  }
  for (const nd of S.needles) {
    nd.age += d;
    if (!nd.landed && nd.age >= nd.fall) land(S, nd);
  }
  S.needles = S.needles.filter((nd) => !nd.landed || nd.age < nd.fall + nd.life);
}

// Lines are laid as points every third of an LED, each lighting its four
// nearest LEDs by how close it falls, and an LED keeps the brightest
// colour laid on it, so a heap of needles never washes out to white.
function plot(S, x, y, c, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy, rgb = S.rgb;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy > FLOOR) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = min(1, (dx ? tx : 1 - tx) * wy * 1.8) * a, p = (yy * W + xx) * 3;
      if (rgb[p] < c[0] * w) rgb[p] = c[0] * w;
      if (rgb[p + 1] < c[1] * w) rgb[p + 1] = c[1] * w;
      if (rgb[p + 2] < c[2] * w) rgb[p + 2] = c[2] * w;
    }
  }
}
function put(S, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  S.rgb[p] = max(S.rgb[p], c[0] * a);
  S.rgb[p + 1] = max(S.rgb[p + 1], c[1] * a);
  S.rgb[p + 2] = max(S.rgb[p + 2], c[2] * a);
}
function text(S, str, x, y, colOf) {
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ".") {
      put(S, x, y + 4, colOf(i), 1);
      x += 2;
      continue;
    }
    const g = FONT[ch];
    if (g === undefined) {
      x += 4;
      continue;
    }
    for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if ((g >> (14 - r * 3 - b)) & 1) put(S, x + b, y + r, colOf(i), 1);
    x += 4;
  }
}
// Error to trace rows: about 1.7 rows for 0.05, 5 for 0.25, never past 10.
const errRows = (e) => (e === Infinity ? TAMP : (TAMP * e) / (abs(e) + 0.25));

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb } = S;
  rgb.fill(0);
  const warm = hsv(HUE0 + S.hue, 0.8, 1, S.warm), cool = hsv(HUE0 + 0.45 + S.hue, 0.75, 1, S.cool);
  // The floor lines are slate whatever the hue: a tinted grey would turn
  // brown wherever the wheel puts orange.
  const slate = [0.24, 0.28, 0.34];
  for (let y = 0; y <= FLOOR; y += D) for (let x = 0; x < W; x++) put(S, x, y, slate, 1);
  const o = [0, 0], white = [1, 1, 1];
  // Falling needles first, so landed ones lie over them.
  const order = S.needles.slice().sort((p, q) => (p.landed === q.landed ? 0 : p.landed ? 1 : -1));
  for (const nd of order) {
    let k = 1, rot = 0, keep = 1, dash = 0;
    const c = nd.cross.length ? warm : cool;
    let tint = c;
    if (!nd.landed) {
      // Falling: drawn dashed, larger and turning, as if seen from above,
      // settling on its spot as it lands. The colour stays at full
      // strength, since a dimmed gold reads brown on the panel.
      const u = nd.age / nd.fall, e = (1 - u) * (1 - u);
      k = 1 + 0.9 * e;
      rot = nd.spin * e;
      dash = 1.5;
    } else {
      const age = nd.age - nd.fall, left = nd.life - age;
      // A white flash on landing, and at the end the needle draws in from
      // both ends to its middle instead of going dark.
      const fl = max(0, 1 - age / 0.25);
      tint = [c[0] + (1 - c[0]) * fl, c[1] + (1 - c[1]) * fl, c[2] + (1 - c[2]) * fl];
      keep = cl(left / 0.6, 0, 1);
    }
    const cr = cos(rot), sr = sin(rot), half = (nd.L / 2) * keep, n = Math.ceil(nd.L * keep * k * 3) + 1;
    for (let i = 0; i <= n; i++) {
      const s = -half + (2 * half * i) / n;
      if (dash && floor((k * (s + half)) / dash) % 2) continue;
      rel(nd, s, o);
      plot(S, nd.gx + k * (o[0] * cr - o[1] * sr), nd.gy + k * (o[0] * sr + o[1] * cr), tint, 1);
    }
  }
  // The crossings: a white dash on the line where each one meets it, wide
  // on landing and narrowing to three LEDs.
  for (const nd of S.needles) {
    if (!nd.landed) continue;
    const age = nd.age - nd.fall, keep = cl((nd.life - age) / 0.6, 0, 1);
    for (const s of nd.cross) {
      if (abs(s) > (nd.L / 2) * keep) continue;
      rel(nd, s, o);
      const x = floor(nd.gx + o[0]), y = floor(nd.gy + o[1]);
      if (y > FLOOR) continue;
      const arm = 1 + max(0, 3 * (1 - age / 0.4));
      for (let dx = -3; dx <= 3; dx++) put(S, x + dx, y, white, cl(arm + 0.5 - abs(dx), 0, 1));
      if (age < 0.3) put(S, x, y - 1, white, 1 - age / 0.3), put(S, x, y + 1, white, 1 - age / 0.3);
    }
  }

  // The readout. The running estimate to four places: the digits that agree
  // with pi in white, the rest cool when it is too high (too few crossings)
  // and warm when too low. The drop count on the right.
  const est = S.sumC ? (2 * S.sumL) / (D * S.sumC) : Infinity;
  const str = est < 10 ? est.toFixed(4) : "-.----", ref = PI.toFixed(4);
  let agree = 0;
  while (agree < str.length && str[agree] === ref[agree]) agree++;
  const over = est > PI;
  text(S, str, 1, 99, (i) => (i < agree ? white : over ? cool : warm));
  const ns = String(min(S.n, 99999));
  text(S, ns, W - 4 * ns.length, 99, () => slate.map((v) => v * 2));
  // The pi line, dotted, with its sign.
  for (let x = TX; x < W; x += 2) put(S, x, TMID, white, 0.35);
  for (let r = 0; r < 5; r++) for (let b = 0; b < 5; b++) if ((PI_SIGN[r] >> (4 - b)) & 1) put(S, 1 + b, TMID - 2 + r, white, 0.8);
  // Each drop's column: a bar from the pi line to the estimate over the last
  // 24 drops, and a white line through the running estimate.
  let prev = NaN;
  for (let i = 0; i < HIST; i++) {
    const x = TX + i, wv = S.win[i], cv = S.cum[i];
    if (S.mark[i]) for (let y = TMID - TAMP; y <= TMID + TAMP; y++) put(S, x, y, slate, 1.6);
    if (!Number.isNaN(wv)) {
      // Its body is a checkerboard at full strength rather than a dim fill,
      // which would turn the gold brown.
      const r = errRows(wv - PI), c = r < 0 ? warm : cool, top = Math.round(r);
      for (let j = 1; j <= abs(top); j++) if (j === abs(top) || (j + x) % 2 === 0) put(S, x, TMID - Math.sign(top) * j, c, 1);
    }
    if (!Number.isNaN(cv)) {
      const y = TMID - errRows(cv - PI);
      if (!Number.isNaN(prev)) {
        const lo = min(prev, y), hi = max(prev, y);
        for (let yy = Math.round(lo); yy <= Math.round(hi); yy++) put(S, x, yy, white, 0.95);
      } else put(S, x, Math.round(y), white, 0.95);
      prev = y;
    } else prev = NaN;
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, (255 * cl(rgb[p], 0, 1)) | 0, (255 * cl(rgb[p + 1], 0, 1)) | 0, (255 * cl(rgb[p + 2], 0, 1)) | 0);
}
