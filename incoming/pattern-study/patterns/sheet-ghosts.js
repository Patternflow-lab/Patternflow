// ===== Patternflow pattern =====
// Title:   Sheet Ghosts
// Family:  halloween
// Idea:    Bedsheet ghosts 24 to 40 LEDs wide rise up the tall panel through the dark, swaying, their hems rippling and their bodies trailing behind the sway, see-through where they pass through one another, with dark eye holes and a cold glow round each sheet.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 41; after the bedsheet ghost costume of Halloween
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Glow=0..1, Speed=0.2..3, Ghosts=3..6, Wind=-1..1
//
// Knob 1: Glow. The colour of the glow round each sheet and of the sheet's edge. At 0 toxic green; at 0.25 ice blue; at 0.5 purple; at 0.75 pumpkin orange, which starts half as bright again at the sheet's edge and falls off a third sooner, so it never fades through brown. The sheets stay cold white at the head and pale violet at the hem.
// Knob 2: Speed. At 2 the ghosts rise 3.7 LEDs a second when 24 wide and 6 when 40 wide, the wide ones being nearer, sway 4 to 9 LEDs each way once every 2.8 to 4.5 seconds, and a wave of the hem runs across in 1.8 seconds; at 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Ghosts. How many take turns coming up, 3 to 6. Each starts 0.45 to 1.15 of an even share of a 194-row cycle below the last, so at 3 two or three are on the panel at once and at 6 five or six crowd it, overlapping, each sheet showing the others through it.
// Knob 4: Wind. From -1 (to the left) to 1 (to the right): pushes the ghosts up to 9 LEDs downwind, swings them half as wide again, runs the hem's ripple downwind twice as fast and leans every body so its hem trails downwind, 16 LEDs behind the head on a 40-wide ghost. The opening 0.06 is a breath to the right.
// Buttons: K1 tap: every ghost rushes at the viewer, swelling to 3.2 times its size about its face in 0.8 seconds, eyes up to 19 LEDs wide, and fades out by 1.1; then a new set fades in where it stands by 2.1.

const W = 64, H = 128, MAXG = 6;
const { floor, min, max, sqrt, sin, cos, exp, abs, round, sign, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Opening glow: toxic green.
const HUE0 = 0.31;
// Glow reach in LEDs and its strength at the sheet's edge.
const GR = 2.1, GK = 0.65;
// A ghost's shape, in units of its width w, from the centre of its head:
// the head a circle of radius 0.46, the body flaring below it to a hem 1.25
// down, rippling 0.07 up and down in 2.5 waves across.
const RH = 0.46, LB = 1.25, AH = 0.07, WAVES = 2.5;
// The rush on a K1 tap: swell for 0.8 s, gone by 1.1, back in by 2.1.
const SWELL = 0.8, GONE = 1.1, BACK = 2.1;

// A fresh ghost: its size, sway and colour.
function dress(g) {
  g.w = 24 + 16 * Math.random();
  g.sa = 4 + 5 * Math.random();
  g.sf = 0.22 + 0.14 * Math.random();
  g.ph = TAU * Math.random();
  g.tint = Math.random();
  g.on = true;
}

// Where the head is across the panel: its lane, pushed up to 9 LEDs
// downwind, and its sway, half as wide again in a full wind.
const swayX = (g, P) => g.x0 + 9 * P.wind + g.sa * (1 + 0.5 * abs(P.wind)) * sin(TAU * g.sf * P.t + g.ph);

// A ghost from below, on the other side of the middle from the one that
// came up last.
function spawn(g, P) {
  dress(g);
  let low = null, n = 0;
  for (const o of P.gs) {
    if (o === g || !o.on) continue;
    n++;
    if (!low || o.hy > low.hy) low = o;
  }
  const side = low ? (low.x0 < 32 ? 1 : -1) : Math.random() < 0.5 ? 1 : -1;
  g.x0 = 32 + side * (3 + 13 * Math.random());
  g.cx = swayX(g, P);
  // Below the panel, and 0.45 to 1.15 times an even share of the cycle
  // below the lowest ghost already up: they keep coming at a steady pace,
  // sometimes two close enough to cross.
  g.hy = max(H + RH * g.w + 3, low ? low.hy + ((H + 66) * (0.45 + 0.7 * Math.random())) / (n + 1) : 0);
}

// Ghosts spread up the panel, lanes taking turns left and right: the
// opening frame, and the return after a rush.
function spread(P) {
  P.gs.forEach((g, i) => {
    g.on = false;
    if (i >= P.count) return;
    dress(g);
    g.x0 = 32 + (i % 2 ? 1 : -1) * (8 + 6 * Math.random());
    g.hy = -8 + (i * (H + 66)) / P.count + 6 * Math.random();
    g.cx = swayX(g, P);
  });
}

export function setup(params) {
  const gs = [];
  for (let i = 0; i < MAXG; i++) gs.push({ w: 30, x0: 32, hy: 0, sa: 6, sf: 0.3, ph: 0, tint: 0, on: false, cx: 32, vx: 0, shear: 0 });
  params.s = { hue: 0, speed: 2, count: 3, wind: 0.06, t: 0, rip: 0, fl: 0, gs, begun: false, boo: -1, rgb: new Float32Array(W * H * 3), glow: [0, 0, 0] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.count = round(cl(k[2], 3, MAXG));
  P.wind = cl(k[3], -1, 1);
  if (!P.begun) {
    spread(P);
    P.begun = true;
  }
  const sp = P.speed / 2, wa = abs(P.wind);
  P.t += d * sp;
  // The hem's ripple runs downwind, faster in a wind; the sides flutter.
  P.rip += d * sp * (3.4 + 4 * wa) * (P.wind < 0 ? -1 : 1);
  P.fl += d * sp * (2.6 + 4 * wa);
  if (input.btnPressed && input.btnPressed[0] && P.boo < 0) P.boo = 0;
  if (P.boo >= 0) {
    const was = P.boo;
    P.boo += d;
    if (was < GONE && P.boo >= GONE) spread(P);
    if (P.boo >= BACK) P.boo = -1;
  }
  const rushing = P.boo >= 0 && P.boo < GONE;
  for (let i = 0; i < MAXG; i++) {
    const g = P.gs[i];
    if (i >= P.count) {
      g.on = false;
      continue;
    }
    if (!g.on && !rushing) spawn(g, P);
    // Bigger ghosts are nearer, so they rise faster, 3.7 to 6 LEDs a second
    // at Speed 2, and now and then a near one catches up a far one and
    // passes through it.
    if (!rushing) g.hy -= d * sp * (0.2 + 0.145 * g.w);
    const cx = swayX(g, P);
    g.vx = d > 0 ? (cx - g.cx) / d : 0;
    g.cx = cx;
    // The body trails the head: it leans away from the way the head is
    // going, and the wind pushes the hem further downwind.
    g.shear += (cl(-0.02 * g.vx + 0.32 * P.wind, -0.5, 0.5) - g.shear) * min(1, d * 4);
    if (g.hy + (LB + AH) * g.w < -GR * 3 && !rushing) spawn(g, P);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { rgb, glow, gs } = P;
  const gh = P.hue + HUE0, hh = gh - floor(gh);
  // Orange and yellow glows start half as bright again and fall off a third
  // sooner, so they do not fade through brown.
  const warm = sm(0.0, 0.05, hh) * (1 - sm(0.14, 0.2, hh));
  hsv(gh, 0.9 - 0.15 * warm, 1, glow);
  const reach = GR * (1 - 0.35 * warm), gk = GK * (1 + 0.5 * warm);
  rgb.fill(0);
  const T = P.t, boo = P.boo, rip = P.rip, wa = abs(P.wind);
  // The rush: each ghost swells to 3.2 times its size about its face and
  // fades out, and then the next ones fade in where they stand.
  let sc = 1, fade = 1, flare = 1;
  if (boo >= 0 && boo < GONE) {
    const u = cl(boo / SWELL, 0, 1);
    sc = 1 + 2.2 * u * u * u;
    fade = 1 - sm(0.55, GONE, boo);
    flare = 1 + 0.8 * sm(0, 0.5, boo);
  } else if (boo >= GONE) fade = sm(GONE, BACK, boo);
  // Far (narrow) ghosts first.
  const order = gs.filter((g) => g.on).sort((a, b) => a.w - b.w);
  for (const g of order) {
    const w = g.w, hx = g.cx, hy = g.hy, rh = RH * w, lb = LB * w, ah = AH * w, sh = g.shear;
    const kk = (TAU * WAVES) / (2.4 * rh), ph = g.ph * 3;
    const ex = 0.16 * w, ey = -0.08 * w, erx = 0.075 * w, ery = 0.115 * w;
    // The eyes look a little the way the ghost is swaying; the mouth opens
    // and closes.
    const look = cl(g.vx * 0.06, -1, 1) * 0.05 * w;
    const my = 0.13 * w, mrx = 0.05 * w, mry = (0.055 + 0.02 * sin(1.7 * T + g.ph)) * w;
    // Sheet colour: cold white at the head to pale violet at the hem; the
    // nearer (wider) ghosts are brighter.
    const br = 0.86 + (0.14 * (w - 24)) / 16, vr = 0.66 + 0.1 * g.tint, vg = 0.52 + 0.12 * g.tint;
    const op = 0.9 * fade, flut = 0.05 * w * (1 + 1.5 * wa);
    const pad = reach * 3 + 1, side = rh * 1.3 + flut + abs(sh) * lb + pad;
    const fy = hy - sc * (rh + pad), ly = hy + sc * (lb + ah + pad);
    for (let y = max(0, floor(fy)); y <= min(H - 1, floor(ly)); y++) {
      const v = (y + 0.5 - hy) / sc, t = cl(v / lb, 0, 1);
      // The sides flare toward the hem and flutter.
      const hw = rh * (1 + 0.2 * t ** 1.4) + flut * t * sin(0.22 * v - P.fl + ph);
      const off = sh * max(0, v), vt = sm(-0.3, 0.9, t), fa = 1 - 0.55 * sm(0.35, 1.05, t), fz = sm(0.55, 1, t);
      const cr = br * (0.97 + (vr - 0.97) * vt), cg = br * (0.95 + (vg - 0.95) * vt), cb = br;
      for (let x = max(0, floor(hx - sc * side)); x <= min(W - 1, floor(hx + sc * side)); x++) {
        const u = (x + 0.5 - hx) / sc - off;
        const dh = sqrt(u * u + v * v) - rh;
        const hem = lb + ah * (sin(kk * u - rip + ph) + 0.2 * sin(2 * kk * u + 1.3 * rip));
        const dd = min(dh, max(abs(u) - hw, v - hem, -v)) * sc;
        const q = (y * W + x) * 3;
        if (dd > 0) {
          // Outside: the cold glow.
          const a = gk * flare * fade * exp(-dd / (reach * sc));
          if (a < 0.01) continue;
          rgb[q] = 1 - (1 - rgb[q]) * (1 - glow[0] * a);
          rgb[q + 1] = 1 - (1 - rgb[q + 1]) * (1 - glow[1] * a);
          rgb[q + 2] = 1 - (1 - rgb[q + 2]) * (1 - glow[2] * a);
          continue;
        }
        // Eye holes and the mouth darken whatever is behind them.
        const e1 = ((abs(u) - ex - look * sign(u)) / erx) ** 2 + ((v - ey) / ery) ** 2;
        const e2 = ((u - look) / mrx) ** 2 + ((v - my) / mry) ** 2;
        const hole = max(sm(1.25, 0.75, e1), sm(1.3, 0.7, e2));
        // Folds run down to the troughs of the hem; the sheet's edge takes
        // the glow's colour; the lower body thins toward the hem.
        const lit = 1 - 0.18 * fz * (0.5 + 0.5 * cos(kk * u - rip + ph));
        const rim = sm(-2.2 * sc, 0, dd) * 0.75, a = op * cl(0.5 - dd, 0, 1) * fa;
        const r = cr * lit * (1 - rim) + glow[0] * rim, gg = cg * lit * (1 - rim) + glow[1] * rim, b = cb * lit * (1 - rim) + glow[2] * rim;
        const dark = 1 - 0.92 * hole * a, ab = a * (1 - hole);
        rgb[q] = 1 - (1 - rgb[q] * dark) * (1 - r * ab);
        rgb[q + 1] = 1 - (1 - rgb[q + 1] * dark) * (1 - gg * ab);
        rgb[q + 2] = 1 - (1 - rgb[q + 2] * dark) * (1 - b * ab);
      }
    }
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
