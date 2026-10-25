// ===== Patternflow pattern =====
// Title:   Candle Vigil
// Family:  halloween
// Idea:    Three pillar candles of purple, ivory and pumpkin wax stand on a dark purple floor, their teardrop flames swaying and flickering in a warm halo that breathes with them, wax drips forming at the rims and creeping down the sides, a draft now and then bending every flame the same way, and a flame now and then guttering out in a thin curl of smoke before it lights again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Candles=3..6, Draft=0..1
//
// Knob 1: Hue. Turns the colours of the wax round the wheel; the flames and their light stay candle light. At 0 purple, ivory and pumpkin orange (then toxic green, black and violet as more candles come); at 0.5 the purple wax turns olive and the orange wax sky blue.
// Knob 2: Speed. How fast the room lives. At 2 a flame sways about twice a second and its light flickers about nine times, a drip starts down at 3 to 6 LEDs a second and slows to a stop, and smoke leaves the wick at 8 LEDs a second; at 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Candles. How many candles stand on the floor, 3 to 6, each 15 LEDs wide at 3 and 8 at 6, between 50 and 90 LEDs tall. Each throws less light the more there are, so six light the room about as much as three.
// Knob 4: Draft. How much the air moves. At 0 a draft comes about every 18 s and one of three flames gutters out about once a minute; at 0.06 a draft every 15 s and a guttering every 40 s, the first draft at 4 s and the first guttering at 6.5 s; at 1 a draft every 5 s, every flame leaning hard to the right even between them and fluttering, and a guttering every 7 or 8 s. A guttered flame stays dark 3 to 4.5 s while its smoke curls up, then lights again.

const W = 64, H = 128, FLOOR = 123;
const { floor, round, min, max, abs, exp, sqrt, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Smooth 1-D value noise, -1..1.
const vn = (x, s) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + s) * (1 - u) + hash((i + 1) * 7919 + s) * u) * 2 - 1;
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Wax colours as hue, saturation, value: purple, ivory, pumpkin, toxic
// green, black, violet. Which candle gets which, for 3 to 6 candles, and how
// tall each stands.
const WAX = [[0.78, 0.6, 0.55], [0.11, 0.22, 0.85], [0.075, 0.85, 0.8], [0.3, 0.85, 0.6], [0.76, 0.3, 0.2], [0.84, 0.45, 0.65]];
const ORDER = { 3: [0, 1, 2], 4: [0, 1, 3, 2], 5: [4, 0, 1, 3, 2], 6: [4, 0, 1, 5, 3, 2] };
const TALL = { 3: [68, 90, 52], 4: [62, 88, 74, 50], 5: [54, 80, 90, 64, 50], 6: [50, 76, 90, 58, 84, 54] };
// Flame palette by heat: deep orange at the rim, white-yellow in the core.
const HEAT = [[0, 0.95, 0.32, 0.03], [0.28, 1, 0.55, 0.08], [0.5, 1, 0.82, 0.3], [0.68, 1, 0.95, 0.72], [1, 1, 1, 0.92]];
const WARM = [1, 0.52, 0.1], ROSE = [0.95, 0.36, 0.3], BLUE = [0.18, 0.32, 1], SMOKE = [0.6, 0.55, 0.72];

export function setup(params) {
  params.s = {
    hue: 0, speed: 1, draft: 0.06, count: 0, t: 0, real: 0,
    cands: [], gust: 0, gDir: 1, gStart: -1, gLen: 0, gPow: 0, nextGust: -1,
    // The opening guttering: the right-hand candle goes out at 6.5 s.
    scripted: true,
    rgb: new Float32Array(W * H * 3), c3: [0, 0, 0],
  };
}

function build(P, n) {
  const sw = W / n, cands = [];
  for (let i = 0; i < n; i++) {
    const w = min(15, max(8, round(sw * 0.72))), h = TALL[n][i];
    const xc = (i + 0.5) * sw + (hash(i * 31 + n) - 0.5) * sw * 0.12;
    const x0 = round(xc - w / 2);
    cands.push({
      x0, w, xc: x0 + w / 2, top: FLOOR - h, wax: WAX[ORDER[n][i]], seed: i * 101 + 7,
      mode: "lit", mt: 0, s: 1, wait: 0, drips: [], wisp: [], emit: 0, ember: 0,
      // Flame for this frame: base, height, half-width, lean, light.
      fx: 0, fy: 0, hf: 0, r: 0, lean: 0, I: 1,
    });
  }
  P.cands = cands;
  P.count = n;
  // More candles light the room no brighter than three: each throws less.
  P.share = (3 / n) ** 0.8;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 3, 0.06];
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3) / 2;
  P.draft = cl(k[3], 0, 1);
  const n = cl(round(k[2]), 3, 6);
  if (n !== P.count) build(P, n);
  const real = cl(dt || 0, 0, 0.1), d = real * P.speed;
  P.real += real;
  P.t += d;
  const t = P.t, dr = P.draft;
  // The first draft comes at 4 s, sooner the more the air moves.
  if (P.nextGust < 0) P.nextGust = 4 - 2.5 * dr;

  // Drafts: a gust rises in 0.5 s, holds and then dies away over 1.2 s, all
  // flames leaning its way.
  if (t >= P.nextGust && P.gStart < 0) {
    P.gStart = t;
    P.gDir = Math.random() < 0.5 ? -1 : 1;
    P.gLen = 1.2 + 1.3 * Math.random();
    P.gPow = 0.6 + 0.4 * Math.random();
  }
  if (P.gStart >= 0) {
    const a = t - P.gStart;
    P.gust = P.gDir * P.gPow * sm(0, 0.5, a) * (1 - sm(P.gLen, P.gLen + 1.2, a));
    if (a > P.gLen + 1.2) {
      P.gStart = -1;
      P.gust = 0;
      P.nextGust = t - Math.log(1 - Math.random() * 0.95) / (0.06 + 0.35 * dr);
    }
  }
  const breeze = 0.45 * dr * dr, flutter = abs(P.gust) + 0.7 * dr;
  let out = 0;
  for (const c of P.cands) if (c.mode !== "lit") out++;

  for (const c of P.cands) {
    c.mt += d;
    const sd = c.seed;
    // A flame goes out, stays dark a while, then lights again.
    if (c.mode === "lit") {
      let chance = (0.006 + 0.05 * dr + (abs(P.gust) > 0.6 ? 0.15 * dr : 0)) * d;
      if (out) chance *= 0.3;
      // The opening keeps its own guttering at 6.5 s and none before 10 s.
      if (P.scripted || P.real < 10) chance = 0;
      const due = P.scripted && c === P.cands[P.cands.length - 1] && P.real >= 6.5;
      if (due || Math.random() < chance) {
        if (due) P.scripted = false;
        (c.mode = "dying"), (c.mt = 0), out++;
      }
    } else if (c.mode === "dying") {
      c.s = 1 - sm(0, 1.1, c.mt);
      if (c.mt > 1.1) (c.mode = "out"), (c.mt = 0), (c.s = 0), (c.ember = 1), (c.wait = 3 + 1.5 * Math.random());
    } else if (c.mode === "out") {
      c.ember = max(0, 1 - c.mt / 2);
      if (c.mt > c.wait) (c.mode = "relight"), (c.mt = 0);
    } else if (c.mode === "relight") {
      c.s = sm(0.25, 1.2, c.mt);
      if (c.mt > 1.2) (c.mode = "lit"), (c.mt = 0), (c.s = 1);
    }
    if (P.scripted && c.mode !== "lit") P.scripted = false;

    // The flame: noise for height and sway, the draft for lean.
    const n1 = vn(t * 2.8, sd), n2 = vn(t * 9, sd + 1), n3 = vn(t * 1.9, sd + 2), n4 = vn(t * 14, sd + 3);
    const flick = 1 + 0.12 * n1 + 0.07 * n2 + 0.1 * flutter * n4;
    c.lean = 0.22 * n3 + 0.07 * n2 + P.gust * (0.5 + 0.4 * dr) + breeze + 0.08 * flutter * n4;
    const bend = min(1, abs(c.lean));
    const hf0 = cl(c.w * 1.9, 13, 28), sz = c.s * (c.mode === "dying" ? 1 + 0.25 * vn(t * 20, sd) : 1);
    c.hf = hf0 * sz * flick * (1 - 0.3 * bend);
    c.r = hf0 * 0.23 * (c.s > 0 ? c.s ** 0.6 : 0) * (1 + 0.15 * bend);
    // A flame bent by the air is smaller and gives less light.
    c.I = c.s * (0.72 + 0.16 * n1 + 0.16 * n2 + 0.06 * flutter * n4) * (1 - 0.3 * bend);
    c.fx = round(c.xc - 0.5);
    c.fy = c.top - 2;

    // Drips: a bead swells on the rim for half a second, runs down fast and
    // slows to a stop, holds for 40 s and sinks back into the wax over 10.
    if (c.mode === "lit" && c.drips.length < 7 && Math.random() < 0.16 * d) {
      const edge = Math.random() < 0.45;
      const dx = edge ? (Math.random() < 0.5 ? -1 : c.w) : 1 + floor(Math.random() * (c.w - 3));
      if (!c.drips.some((q) => abs(q.dx - dx) < 3))
        c.drips.push({ dx, len: 0, max: 8 + Math.random() * min(46, (FLOOR - c.top) * 0.6), v: 3 + 3 * Math.random(), age: 0, wig: Math.random() * 9 });
    }
    for (const q of c.drips) {
      q.age += d;
      if (q.age > 0.5) q.len = q.max * (1 - exp((-(q.age - 0.5) * q.v) / q.max));
    }
    c.drips = c.drips.filter((q) => q.age < 60);

    // Smoke: for 2.5 s after the flame dies a curl leaves the wick, rising
    // 10 LEDs a second and swinging with the air.
    if (c.mode === "out" && c.mt < 2.5) {
      c.emit += 40 * d;
      for (; c.emit >= 1; c.emit--)
        c.wisp.push({ x: c.fx + 0.5, y: c.fy, a: 0, ph: t * 2.1 + c.seed, w: 1 - c.mt / 2.5 });
    }
    for (const p of c.wisp) {
      p.a += d;
      p.y -= (8 + 4 * p.a) * d;
      p.x += (5 * sin(p.ph + p.a * 2.4) * min(1, p.a) + (P.gust + breeze) * 14) * d;
    }
    c.wisp = c.wisp.filter((p) => p.a < 4 && p.y > -2);
  }
}

// Where a flame is and how hot, at LED (x, y): 0 outside.
function flameAt(c, x, y, out) {
  if (c.s <= 0.02) return 0;
  const tau = (c.fy + 1 - y + c.hf * 0.12) / (c.hf * 1.12);
  if (tau <= 0 || tau >= 1) return 0;
  const prof = (sqrt(tau) * (1 - tau) ** 1.1) / 0.37;
  const xc = c.fx + 0.5 + c.lean * c.hf * tau ** 1.7;
  const d = abs(x + 0.5 - xc) / max(0.3, c.r * prof);
  if (d >= 1) return 0;
  const heat = cl((1 - d) * (1.15 - 0.95 * tau), 0, 1);
  let j = 0;
  while (j < HEAT.length - 2 && heat > HEAT[j + 1][0]) j++;
  const [h0, r0, g0, b0] = HEAT[j], [h1, r1, g1, b1] = HEAT[j + 1], f = cl((heat - h0) / (h1 - h0), 0, 1);
  (out[0] = r0 + (r1 - r0) * f), (out[1] = g0 + (g1 - g0) * f), (out[2] = b0 + (b1 - b0) * f);
  // The thin blue base, and a small flame is mostly blue.
  const bw = max((1 - tau / 0.26) * sm(0.15, 0.7, d), c.s < 0.45 ? (1 - c.s / 0.45) * 0.8 : 0);
  for (let i = 0; i < 3; i++) out[i] += (BLUE[i] - out[i]) * cl(bw, 0, 1);
  return sm(1, 0.68, d) * cl(tau / 0.07, 0, 1) * (1 - sm(0.86, 1, tau));
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.cands.length) return;
  const { rgb, c3, cands } = P;
  // Light in the air round each flame: a tight halo and a wide one, both
  // breathing with the flame.
  rgb.fill(0);
  for (let y = 0; y < H; y++) {
    const g = y / (H - 1), br = 0.008 + 0.05 * g * g, bg = 0.002 + 0.012 * g * g, bb = 0.015 + 0.072 * g * g;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let L = 0, F = 0;
      for (const c of cands) {
        if (c.I <= 0.01) continue;
        const cx = c.fx + 0.5 + c.lean * c.hf * 0.45, cy = c.fy - c.hf * 0.4;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy, s1 = 9 + 3 * c.I;
        L += c.I * P.share * 0.42 * exp(-d2 / (2 * s1 * s1));
        F += c.I * P.share * 0.1 * exp(-d2 / 1100);
      }
      // The near halo is flame orange; the far one leans rose, so where it
      // thins out over the purple it does not read brown.
      (rgb[p * 3] = br + WARM[0] * L + ROSE[0] * F), (rgb[p * 3 + 1] = bg + WARM[1] * L + ROSE[1] * F), (rgb[p * 3 + 2] = bb + WARM[2] * L + ROSE[2] * F);
    }
  }
  // The floor: dark plum, lit in pools under the flames.
  for (let y = FLOOR; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let L = 0;
      for (const c of cands) {
        const dx = (x + 0.5 - c.xc) / 18;
        L += c.I * P.share * 0.5 * exp(-dx * dx) * (1 - (y - FLOOR) * 0.12);
      }
      (rgb[p * 3] = 0.07 + 0.55 * L), (rgb[p * 3 + 1] = 0.025 + 0.28 * L), (rgb[p * 3 + 2] = 0.1 + 0.07 * L);
    }

  for (const c of cands) {
    const wax = hsv(c.wax[0] + P.hue, c.wax[1], c.wax[2], [0, 0, 0]);
    // A wax LED's colour: lit by every flame by distance, rounder in the
    // middle, glowing through from its own flame near the top.
    const waxAt = (x, y, lift) => {
      const u = (x + 0.5 - c.xc) / (c.w / 2), cyl = 0.45 + 0.55 * sqrt(max(0, 1 - u * u));
      let L = 0;
      for (const o of cands) {
        if (o.I <= 0.01) continue;
        const dx = o.fx + 0.5 - (x + 0.5), dy = o.fy - (y + 0.5), r = (dx * dx + dy * dy) / 450;
        const face = o === c ? 1 : P.share * cl(0.55 + 0.6 * u * Math.sign(dx), 0.15, 1.15);
        L += (o.I * face) / (1 + r);
      }
      const glow = c.I * 0.5 * exp(-(y - c.top) / 6);
      const k = (0.16 + 0.95 * L) * cyl * lift;
      (c3[0] = wax[0] * k + glow * 1.0), (c3[1] = wax[1] * k + glow * 0.6), (c3[2] = wax[2] * k + glow * 0.28);
      return c3;
    };
    const put = (x, y, col) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const o = (y * W + x) * 3;
      (rgb[o] = col[0]), (rgb[o + 1] = col[1]), (rgb[o + 2] = col[2]);
    };
    // Body, with the rim standing a little proud of the melt pool.
    for (let y = c.top - 1; y < FLOOR; y++)
      for (let x = c.x0; x < c.x0 + c.w; x++) {
        const u = (x + 0.5 - c.xc) / (c.w / 2);
        if (y === c.top - 1 && abs(u) < 0.72) continue;
        put(x, y, waxAt(x, y, 1));
        // The melt pool: a shallow lit ellipse inside the rim.
        const e = (u / 0.8) ** 2 + ((y - c.top - 0.6) / 1.4) ** 2;
        if (e < 1 && c.s > 0) {
          const o = (y * W + x) * 3, k = c.I * (1 - e) * 0.75;
          (rgb[o] += k), (rgb[o + 1] += k * 0.62), (rgb[o + 2] += k * 0.3);
        }
      }
    // Drips: a raised streak, lighter on its left, a bead at its foot. A drip
    // on the edge stands one LED out from the side.
    for (const q of c.drips) {
      const fade = 1 - sm(50, 60, q.age), bead = q.age < 0.5 ? q.age / 0.5 : 1;
      if (q.len < 0.5 && bead < 1) {
        const x = c.x0 + q.dx, y = c.top;
        const col = waxAt(cl(x, c.x0, c.x0 + c.w - 1), y, 1.25 * bead + (1 - bead));
        put(x, y, col);
        continue;
      }
      const end = c.top + round(q.len);
      for (let y = c.top; y <= end; y++) {
        const x = c.x0 + q.dx + (vn(y * 0.18 + q.wig, 5) > 0.55 ? 1 : 0) * (q.dx >= 0 && q.dx < c.w - 1 ? 1 : 0);
        const lift = 1 + 0.32 * fade;
        put(x, y, waxAt(cl(x, c.x0, c.x0 + c.w - 1), y, lift));
        if (q.dx >= 0 && q.dx < c.w - 1) put(x + 1, y, waxAt(x + 1, y, 1 + 0.12 * fade));
        if (y === end) {
          put(x - 1, y, waxAt(cl(x - 1, c.x0, c.x0 + c.w - 1), y, 1 + 0.2 * fade));
          put(x, y + 1, waxAt(cl(x, c.x0, c.x0 + c.w - 1), y + 1, 1 + 0.25 * fade));
        }
      }
    }
    // Wick, and its ember after the flame dies.
    for (let y = c.top - 3; y < c.top; y++) put(c.fx, y, [0.07, 0.04, 0.05]);
    if (c.ember > 0) put(c.fx, c.top - 3, [0.9 * c.ember, 0.25 * c.ember, 0.05 * c.ember]);
    if (c.mode === "relight" && c.mt < 0.3) put(c.fx, c.top - 4, [1, 0.95, 0.8]);
  }
  // Flames over everything.
  for (const c of cands) {
    if (c.s <= 0.02) continue;
    const reach = c.r + abs(c.lean) * c.hf + 2;
    for (let y = max(0, floor(c.fy - c.hf - 1)); y <= min(H - 1, c.fy + 2); y++)
      for (let x = max(0, floor(c.fx - reach)); x <= min(W - 1, c.fx + reach + 1); x++) {
        const a = flameAt(c, x, y, c3);
        if (a <= 0) continue;
        const o = (y * W + x) * 3;
        for (let i = 0; i < 3; i++) rgb[o + i] = rgb[o + i] * (1 - a) + c3[i] * a;
      }
  }
  // Smoke curls, thin and grey-violet, fading as they rise.
  for (const c of cands)
    for (const p of c.wisp) {
      const x = floor(p.x), y = floor(p.y);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const a = 0.55 * (1 - p.a / 4) * (0.4 + 0.6 * p.w), o = (y * W + x) * 3;
      for (let i = 0; i < 3; i++) rgb[o + i] = max(rgb[o + i], rgb[o + i] * (1 - a) + SMOKE[i] * a);
    }
  // Out in steps of 4 levels, 64 to a channel: the soft light then packs
  // into runs, and no step shows on the panel.
  const lv = (v) => min(255, round(v * 63.75) * 4);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, lv(rgb[o]), lv(rgb[o + 1]), lv(rgb[o + 2]));
}
