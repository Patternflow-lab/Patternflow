// ===== Patternflow pattern =====
// Title:   Lace Phantom
// Family:  halloween
// Idea:    A lace curtain fills a tall broken window at night and billows in the wind with the moon behind it, and now and then a face presses through from behind, the lace stretching over a brow, two eye hollows and an open mouth before it sinks back.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 44
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lace=-1..1, Haunt=0..1
//
// Knob 1: Hue. The tint of the lace. At 0 lavender, at 0.35 cold blue-white, at 0.7 ice cyan and at 1 a ghostly green.
// Knob 2: Speed. The wind. At 2 the hem swings about 5 LEDs each way every 4 seconds and the pleats ripple across it; at 0.2 all of it, the face too, is ten times slower, at 3 half as fast again.
// Knob 3: Lace. The size of the pattern. At 0 a diamond trellis 26 LEDs across with a flower in each diamond; at -1 a finer one 20 LEDs across, its threads broken; at 1 a bold one 34 LEDs across with thick threads.
// Knob 4: Haunt. How often a face presses through, and how hard. At 0.06 the first one starts at 2.2 s, is pressed full by 3.5 s, holds 1.6 s and is gone by 6.9 s, and the next comes 8.6 s later; at 1 the first is there at once, 25% bigger and deeper, and the next comes 2 s after the last has gone.
// Buttons: K4 tap sends a face through now, or straight after the one already there.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
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
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// The tulle is a one-LED checker: the threads (x + y even) stand STEP above
// the holes beside them, so every pair of neighbours is a gentle step. The
// knots of the lace are threads at full level, each with four holes round
// it, and there are always KNOTS of them: that count alone fixes how many
// neighbour pairs are hard steps.
const STEP = 39, KNOTS = 800;
const CAND = [];
for (let y = 1; y < H - 1; y++) for (let x = 2 - (y & 1); x < W - 1; x += 2) CAND.push(y * W + x);
// A fixed shuffle: where two places score the same, the earlier one in this
// order gets the knot, so ties do not flicker from frame to frame.
const ORDER = CAND.slice();
for (let i = ORDER.length - 1; i > 0; i--) {
  const j = floor(hash(i * 31 + 7) * (i + 1));
  [ORDER[i], ORDER[j]] = [ORDER[j], ORDER[i]];
}
const BINS = 1280, LO = -12, PER = 64;

// The window behind the curtain: a mullion down the middle and two
// transoms make six panes, and their shadows fall on the curtain. The moon
// stands behind the upper right pane. The lower left pane is broken: a
// jagged hole round (15, 108) lets the moonlight in unglazed, so the lace
// over it is lit a little more, and cracks run from its points to the frame,
// glinting where they catch the light.
const MOON = [48, 21, 8];
const HOLE = [15, 108];
const SPIKES = 11;
const RIM = [];
for (let k = 0; k < SPIKES; k++) RIM.push((k & 1 ? 4 : 8.5) + 2.5 * hash(k + 60));
const holeR = (a) => {
  const f = ((a / (2 * PI)) * SPIKES + SPIKES) % SPIKES, i = floor(f), u = f - i;
  return RIM[i] + (RIM[(i + 1) % SPIKES] - RIM[i]) * u;
};
const CRACKS = [];
for (let k = 0; k < SPIKES; k += 2) {
  const a = ((k + 0.5) / SPIKES) * 2 * PI, r0 = RIM[k] * 0.9, len = 12 + 14 * hash(k + 50);
  CRACKS.push([HOLE[0] + cos(a) * r0, HOLE[1] + sin(a) * r0, HOLE[0] + cos(a + 0.15) * (r0 + len), HOLE[1] + sin(a + 0.15) * (r0 + len)]);
}
const SHADE = new Float32Array(N), GAP = new Float32Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    let s = 0;
    if (abs(x - 31.5) < 2) s = 1;
    if (abs(y - 43.5) < 2 || abs(y - 86.5) < 2) s = 1;
    const hx = x - HOLE[0], hy = y - HOLE[1];
    if (s === 0 && sqrt(hx * hx + hy * hy) < holeR(Math.atan2(hy, hx) + PI)) GAP[y * W + x] = 1;
    for (const [x0, y0, x1, y1] of CRACKS) {
      if (x > 29 || y < 89) continue;
      const ex = x1 - x0, ey = y1 - y0, qx = x - x0, qy = y - y0, u = cl((qx * ex + qy * ey) / (ex * ex + ey * ey), 0, 1);
      if (sqrt((qx - u * ex) ** 2 + (qy - u * ey) ** 2) < 0.7) GAP[y * W + x] = max(GAP[y * W + x], 0.6);
    }
    SHADE[y * W + x] = s;
  }

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, lace: 0, haunt: 0.06, t: 0,
    face: null, wait: 2.3, queued: false,
    L: new Uint8Array(N), lit: new Float32Array(N), score: new Float32Array(N), knot: new Uint8Array(N),
    hist: new Int32Array(BINS), c: [0, 0, 0],
  };
}

function newFace(S) {
  S.face = {
    x: 22 + 20 * Math.random(), y: 52 + 22 * Math.random(), r: (17 + 3 * Math.random()) * (1 + 0.25 * S.haunt),
    age: 0, deep: 0.75 + 0.35 * S.haunt, turn: (Math.random() - 0.5) * 0.3, open: 1,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.lace = cl(k[2], -1, 1);
  S.haunt = cl(k[3], 0, 1);
  if (!S.begun) {
    // The first face comes sooner the higher Haunt is.
    S.wait = 2.3 * (1 - S.haunt);
    S.begun = true;
  }
  const ds = (d * S.speed) / 2;
  S.t += ds;
  if (input.btnPressed && input.btnPressed[3]) {
    if (S.face) S.queued = true;
    else newFace(S);
  }
  if (S.face) {
    S.face.age += ds;
    // The mouth works open and shut while the face is held.
    S.face.open = 0.75 + 0.3 * sin(S.face.age * 4.2);
    if (S.face.age > 4.7) {
      S.face = null;
      S.wait = S.queued ? 0 : 9 - 7 * S.haunt;
      S.queued = false;
    }
  } else {
    S.wait -= ds;
    if (S.wait <= 0) newFace(S);
  }
}

// How far the face presses at its age: in for 1.3 s, held 1.6 s, back for 1.8 s.
const press = (a) => (a < 1.3 ? sm(0, 1.3, a) : a < 2.9 ? 1 : 1 - sm(2.9, 4.7, a));

// Distance in LEDs from curtain point (u, v) to the nearest thread of the
// lace motif: a diamond trellis, a ring and a centre knot in each diamond,
// and a scalloped hem along the bottom.
function motif(u, v, T) {
  const a = u / T, b = v / T;
  const p = a + b, q = a - b;
  let dd = (abs(p - floor(p) - 0.5) * T) / 1.4142;
  dd = min(dd, (abs(q - floor(q) - 0.5) * T) / 1.4142);
  // Diamond centres sit where a + b and a - b are both whole.
  const cp = round(p), cq = round(q), ca = (cp + cq) / 2, cb = (cp - cq) / 2;
  const rx = (a - ca) * T, ry = (b - cb) * T, rr = sqrt(rx * rx + ry * ry);
  dd = min(dd, abs(rr - 0.2 * T), rr);
  if (v > 108) {
    const sx = T / 2, k = round(u / sx), hx = u - k * sx, hy = v - 114;
    dd = min(dd, abs(v - 109.5), hy > 0 ? abs(sqrt(hx * hx + hy * hy) - sx / 2) : 9);
  }
  return dd;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { L, lit, score, knot, hist } = S, t = S.t, T = 26 * 1.3 ** S.lace;
  const F = S.face, fa = F ? press(F.age) * F.deep : 0;
  // Face fields are drawn in the face's own units, its radius 1.
  for (let y = 0; y < H; y++) {
    const sy = (y / H) ** 1.3;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // The wind comes in at the broken pane and the hem swings most.
      const gust = 1 + 0.9 * exp(-((x - HOLE[0]) ** 2 + (y - HOLE[1]) ** 2) / 700);
      const dx = gust * sy * (5 * sin(1.6 * t - 0.045 * y + 0.6) + 1.6 * sin(3.1 * t - 0.11 * y + 0.07 * x));
      const dy = gust * sy * 2.2 * sin(2.2 * t + 0.08 * x - 0.03 * y);
      // Pleats: the cloth gathers into folds 13 LEDs apart that ripple.
      const ph = (2 * PI * (x + dx)) / 13 + 0.7 * sin(0.9 * t + y * 0.02);
      let u = x + dx + 1.4 * sin(ph), v = y + dy;
      let light = 0.5 + 0.5 * cos(ph);
      let face = -99, thin = 0, deep = 0, rise = 0;
      if (fa > 0) {
        const fx = (x - F.x) / F.r, fy = (y - F.y) / F.r, e = fx * fx + (fy / 1.25) ** 2;
        if (e < 1.6) {
          const dome = max(0, 1 - e);
          // The lace stretches over the head: the pattern grows there.
          const st = 1 - 0.35 * fa * dome;
          u = F.x + (u - F.x) * st;
          v = F.y + (v - F.y) * st;
          // The cloth drawn over the face lets more moonlight through: a
          // pale glow, its level ramped over 8 LEDs or more so the checker
          // keeps its gentle steps. The eye sockets and the open mouth are
          // dark hollows in it. Where the cloth is drawn tightest (brow,
          // nose, cheekbones) its knots crowd.
          const ax = abs(fx + F.turn * fy), op = F.open;
          const eye = ((ax - 0.36) / 0.2) ** 2 + ((fy + 0.08) / 0.16) ** 2;
          const mouth = (fx / 0.17) ** 2 + ((fy - 0.56) / (0.22 * op)) ** 2;
          const hol = min(sm(0.45, 2.2, eye), sm(0.45, 2.2, mouth));
          let hi = sm(0.1, 0.05, abs(fy + 0.38 - 0.2 * ax * ax)) * sm(0.66, 0.5, ax);
          hi = max(hi, sm(0.07, 0.03, abs(fx)) * sm(-0.3, -0.18, fy) * sm(0.36, 0.28, fy));
          hi = max(hi, sm(0.06, 0.03, abs(fy - 0.15 - 0.4 * (ax - 0.36) ** 2)) * sm(0.66, 0.52, ax) * sm(0.1, 0.2, ax));
          face = hi > 0 ? 1.6 * fa * hi - 1 : -99;
          thin = 0.6 * fa * dome;
          if (eye < 1.2 || mouth < 1.2) deep = fa;
          rise = fa * sm(0, 0.8, dome);
          light = light * (1 - rise) + rise * hol;
          rise *= hol;
        }
      }
      // The face is in front of the window, so no frame shadow falls on it.
      const sh = SHADE[p] * (1 - min(1, 3 * rise));
      // The moon is a disc behind the upper right pane, its rim ramped over 6 LEDs.
      const mg = sm(MOON[2] + 6, MOON[2], sqrt((x - MOON[0]) ** 2 + (y - MOON[1]) ** 2));
      L[p] = sh >= 1 ? 0 : round(min(80, 64 * mg + 76 * rise + 28 * GAP[p]) * (1 - sh));
      lit[p] = deep > 0.3 ? 0 : cl(light * (1 - sh) + mg + GAP[p], 0, 1);
      if ((x + y) & 1) continue;
      score[p] = max(-motif(u, v, T) - thin, face) - 9 * deep - 9 * sh - 0.012 * L[p];
    }
  }
  // Exactly KNOTS knots: the best-scored places, ties broken by ORDER.
  hist.fill(0);
  const binOf = (s) => cl(floor((s - LO) * PER), 0, BINS - 1);
  for (const p of CAND) hist[binOf(score[p])]++;
  let need = KNOTS, cut = BINS - 1;
  while (cut > 0 && hist[cut] < need) need -= hist[cut--];
  knot.fill(0);
  for (const p of ORDER) {
    const b = binOf(score[p]);
    if (b > cut) knot[p] = 1;
    else if (b === cut && need > 0) {
      knot[p] = 1;
      need--;
    }
  }
  // Colours: a pale tint where the lace is lit, the deep tint in shadow;
  // either way the brightest channel is the level the checker asks for.
  const h = 0.76 - 0.42 * S.hue, c = S.c;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let lv;
      const q = round(lit[p] * 3) / 3;
      if ((x + y) & 1) {
        lv = L[p];
        if (lv === 0) {
          display.setPixel(x, y, 0, 0, 0);
          continue;
        }
        hsv(h, 0.9 - 0.5 * q, 1, c);
      } else if (knot[p]) {
        lv = 255;
        hsv(h, 0.38 - 0.26 * q, 1, c);
      } else {
        let m = 255;
        if (x > 0) m = min(m, L[p - 1]);
        if (x < W - 1) m = min(m, L[p + 1]);
        if (y > 0) m = min(m, L[p - W]);
        if (y < H - 1) m = min(m, L[p + W]);
        lv = m + STEP;
        hsv(h + 0.03 * (1 - q), 1 - 0.72 * q, 1, c);
      }
      display.setPixel(x, y, round(c[0] * lv), round(c[1] * lv), round(c[2] * lv));
    }
}
