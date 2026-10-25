// ===== Patternflow pattern =====
// Title:   Murmuration
// Family:  halloween
// Idea:    Over a black treeline at sundown a murmuration of crows swirls and folds against a sky running from violet to hot orange, then every bird sweeps to its place in a giant skull whose eye sockets, nose and the gaps between its teeth let the sky through, the skull holds and looks about with glinting eyes and a chattering jaw, and bursts back into the flock.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Flock=0..1, Shape=0..1
//
// Knob 1: Hue. Turns the sunset round the wheel. At 0 violet overhead through hot pink and orange to a yellow glow round a low sun; at 0.25 brick red overhead through gold to lime; at 0.5 green to cyan; at 0.75 sky blue through violet to pink. The crows stay black, the sun cream and the glints in the eyes toxic green.
// Knob 2: Speed. At 2 the flock swirls 1.4 s before the first call, the birds take 1.9 s to sweep into the shape, the shape holds 1.5 s, the burst takes 1.6 s, and the flock swirls 5 s before the next call, a call every 10 s. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Flock. How many crows: 500 at 0, 750 at 0.25, 1,000 at 0.5 and 1,500 at 1. A small flock is a cloud of specks that darkens to a band when it turns edge on, and fills the skull with each bird's wings spread over five LEDs; a large one folds into black sheets and holds one LED and a bit more of the skull per bird, 1.7 at 1,500.
// Knob 4: Shape. What the flock forms. Up to 0.25 a skull 54 LEDs wide and 72 tall whose jaw drops twice and whose eyes glint and look left and right; to 0.5 a bat 62 LEDs across that beats its wings with glinting eyes; to 0.75 a crescent moon 54 LEDs tall that rocks; above 0.75 the three in turn.
// Buttons: K1 tap calls the flock into its shape at once.

const W = 64, H = 128, N = W * H, MAXB = 1500;
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// Seconds at Speed 2: the first swirl, later swirls, the sweep into the
// shape, the hold and the burst.
const T0 = 1.4, TS = 5, TG = 1.9, TH = 1.5, TB = 1.6;

// The shapes, tested at LED centres; u is across from the middle column.
const SKULL = 0, BAT = 1, MOON = 2;
const CENTRE = [[32, 57], [32, 50], [32, 55]];
function skull(u, y) {
  const au = abs(u);
  let inside = (u / 27) ** 2 + ((y - 47) / 26) ** 2 < 1 && y < 66;
  // Cheekbones, then the upper jaw, then the chin.
  if (y >= 54 && y < 80 && au < 23.5 - max(0, y - 66) * 0.4) inside = true;
  if (y >= 80 && y < 93 && au < 16 - max(0, y - 87) * 1.1) inside = true;
  if (!inside) return false;
  // Eye sockets, flattened under the brow and sloping to the nose.
  const du = au - 11.5;
  if ((du / 8.5) ** 2 + ((y - 57.5) / 7.5) ** 2 < 1 && y > 50 + 0.18 * (au - 3)) return false;
  // The nose, an upturned heart.
  if (y >= 66 && y < 75 && au < (y - 66) * 0.45 + 0.6 && !(y > 72 && au < 0.6)) return false;
  // The mouth line and the gaps between the teeth.
  if (y >= 82 && y < 83 && au < 14) return false;
  if (y >= 78 && y < 87 && au < 12 && floor(u + 12) % 4 === 0) return false;
  return true;
}
function bat(u, y) {
  const s = abs(u);
  if ((u / 5) ** 2 + ((y - 54) / 9.5) ** 2 < 1) return true;
  if ((u / 5.2) ** 2 + ((y - 44) / 5) ** 2 < 1) return true;
  if (y >= 35 && y < 42 && abs(s - 3) < (y - 35) * 0.35) return true;
  if (s < 4 || s > 31) return false;
  // The arm rises from the shoulder to the wing tip; the trailing edge hangs
  // from four finger tips in scallops.
  const top = s < 26 ? 48 - 13 * sin((((s - 4) / 22) * PI) / 2) : 35 + (s - 26) * 0.7;
  const f = (s - 4) / 9, k = min(2, floor(f)), fr = f - k;
  const tips = [66, 59, 51, 40];
  const bottom = tips[k] + (tips[k + 1] - tips[k]) * fr - 5.5 * sin(PI * fr);
  return y > top && y < bottom;
}
function moon(u, y) {
  return u * u + (y - 55) ** 2 < 27 * 27 && (u - 11) ** 2 + (y - 46) ** 2 > 23 * 23;
}
const SHAPES = [skull, bat, moon];

// Ordered-dither rank of an LED, so the first n cells of a shape taken in
// this order are spread evenly over it.
function bayer(x, y) {
  let v = 0;
  for (let b = 0; b < 3; b++) {
    const xb = (x >> b) & 1, yb = (y >> b) & 1;
    v |= (((xb ^ yb) << 1) | yb) << (2 * (2 - b));
  }
  return v;
}

export function setup(params) {
  const S = (params.s = {
    hue: -1, speed: 2, flock: 0, shapeK: 0.06, nb: 500,
    t: 0, ph: "swirl", pt: 0, tswirl: T0, shape: SKULL, turn: 0,
    // Per bird: place in the flock's sheet, depth, start delay, arc, burst
    // direction and speed, flap phase.
    a: new Float32Array(MAXB), b: new Float32Array(MAXB), w: new Float32Array(MAXB),
    dl: new Float32Array(MAXB), arc: new Float32Array(MAXB), bd: new Float32Array(MAXB), bv: new Float32Array(MAXB),
    // Slot: where it sits in the shape, and the LED it was cut from.
    tx: new Float32Array(MAXB), ty: new Float32Array(MAXB), tc: new Int32Array(MAXB).fill(-1),
    px: new Float32Array(MAXB), py: new Float32Array(MAXB), c: new Float32Array(MAXB),
    order: new Int32Array(MAXB), key: new Float32Array(MAXB),
    masks: SHAPES.map((fn) => {
      const m = new Uint8Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = fn(x + 0.5 - 32, y + 0.5) ? 1 : 0;
      return m;
    }),
    ranked: [], disc: [], dark: new Float32Array(N), bg: new Float32Array(N * 3), glint: 0, look: 0,
  });
  for (let i = 0; i < MAXB; i++) {
    const r = sqrt(Math.random()), th = Math.random() * 2 * PI;
    S.a[i] = r * cos(th);
    S.b[i] = r * sin(th);
    S.w[i] = (Math.random() - 0.5) * 6;
    S.dl[i] = Math.random();
    S.arc[i] = (Math.random() - 0.5) * 2;
    S.bd[i] = (Math.random() - 0.5) * 1.6;
    S.bv[i] = 30 + Math.random() * 45;
  }
  // Cells of each shape in dither order.
  S.ranked = S.masks.map((m) => {
    const cells = [];
    for (let p = 0; p < N; p++) if (m[p]) cells.push(p);
    const r = cells.map((p) => bayer(p % W & 7, floor(p / W) & 7) + hash(p) * 0.99);
    return cells.map((p, i) => [r[i], p]).sort((x, y) => x[0] - y[0]).map((e) => e[1]);
  });
  scenery(S);
}

// Where bird i flies in the flock at time t: a sheet of birds, bent by a
// travelling fold, turned in depth and seen from the side, so it thins out
// when it faces us and darkens to a band when it turns edge on.
function sheet(S, i, t, out) {
  const al = 0.21 * t, ca = cos(al), sa = sin(al);
  let a = S.a[i] * ca - S.b[i] * sa;
  const b = S.a[i] * sa + S.b[i] * ca;
  a += 0.16 * sin(3.1 * b - 1.9 * t);
  const X = a * (24 + 5 * sin(0.53 * t)), Y = b * (18 + 5 * sin(0.47 * t + 2));
  const Z = 11 * sin(2.3 * a + 1.4 * t + b) + S.w[i];
  const th = 1.15 * sin(0.37 * t) + 0.35 * sin(0.93 * t + 1), ph = 0.8 * sin(0.29 * t + 1);
  const x3 = X * cos(th) + Z * sin(th), z3 = Z * cos(th) - X * sin(th);
  out[0] = 33 + 9 * sin(0.5 * t + 0.6) + x3;
  out[1] = 47 + 17 * sin(0.37 * t + 0.5) + Y * cos(ph) + z3 * sin(ph);
}

// Hand each bird a slot: birds and slots both taken round in angle, so the
// flock pours into the shape from the side it is on.
function call(S) {
  const n = S.nb, sh = S.shape, cells = S.ranked[sh], [cx, cy] = CENTRE[sh], o = [0, 0];
  const slots = [];
  for (let k = 0; k < n; k++) {
    const p = cells[k % cells.length], x = (p % W) + 0.5, y = floor(p / W) + 0.5;
    slots.push([atan2(y - cy, x - cx), x, y, p]);
  }
  slots.sort((p, q) => p[0] - q[0]);
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) sheet(S, i, S.t, o), (S.px[i] = o[0]), (S.py[i] = o[1]), (mx += o[0]), (my += o[1]);
  (mx /= n), (my /= n);
  const ord = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n; i++) S.key[i] = atan2(S.py[i] - my, S.px[i] - mx);
  ord.sort((p, q) => S.key[p] - S.key[q]);
  for (let k = 0; k < n; k++) {
    const i = ord[k], s = slots[k];
    (S.tx[i] = s[1]), (S.ty[i] = s[2]), (S.tc[i] = s[3]);
  }
  for (let i = n; i < MAXB; i++) S.tc[i] = -1;
  // Each bird's wings spread to cover the LEDs between slots.
  const rho = 0.9 * sqrt(cells.length / n) + 0.5;
  S.disc = [];
  const R = Math.ceil(rho);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= rho * rho) S.disc.push(dx, dy);
}

// How the shape moves while it holds: the skull's jaw drops twice, the bat
// beats its wings, the moon rocks.
function holdMove(S, x, y, out) {
  const h = S.ph === "hold" ? S.pt : 0;
  (out[0] = x), (out[1] = y);
  if (S.shape === SKULL) {
    if (y > 82) out[1] += 3.5 * abs(sin(PI * cl((h - 0.35) / 0.4, 0, 2)));
  } else if (S.shape === BAT) {
    const s = abs(x - 32);
    out[1] += (s > 4 ? ((s - 4) / 27) ** 1.3 : 0) * 9 * sin(h * 2 * PI * 1.4);
  } else {
    const an = 0.16 * sin(h * 2 * PI * 0.8), dx = x - 32, dy = y - 55;
    out[0] = 32 + dx * cos(an) - dy * sin(an);
    out[1] = 55 + dx * sin(an) + dy * cos(an);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const hue = cl(k[0], 0, 1);
  if (hue !== S.hue) (S.hue = hue), scenery(S);
  S.speed = cl(k[1], 0.2, 3);
  S.flock = cl(k[2], 0, 1);
  S.shapeK = cl(k[3], 0, 1);
  S.nb = round(500 + 1000 * S.flock);
  const d = (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  S.t += d;
  S.pt += d;
  const tap = input.btnPressed && input.btnPressed[0];
  if (S.ph === "swirl" && (S.pt > S.tswirl || tap)) {
    const q = S.shapeK;
    S.shape = q < 0.25 ? SKULL : q < 0.5 ? BAT : q < 0.75 ? MOON : S.turn++ % 3;
    call(S);
    (S.ph = "gather"), (S.pt = 0);
  } else if (S.ph === "gather" && S.pt > TG) (S.ph = "hold"), (S.pt = 0);
  else if (S.ph === "hold" && S.pt > TH) (S.ph = "burst"), (S.pt = 0);
  else if (S.ph === "burst" && S.pt > TB) (S.ph = "swirl"), (S.pt = 0), (S.tswirl = TS);
  // Eye glints and where they look, for the skull and the bat.
  const h = S.ph === "hold" ? S.pt : -1;
  S.glint = h < 0 ? 0 : sm(h / 0.25) * sm((TH - h) / 0.3);
  S.look = h < 0 ? 0 : 2.5 * sin(h * 2 * PI * 0.75);
  // Bird positions and how close each is to its slot.
  const o = [0, 0], m = [0, 0], g = S.pt, ph = S.ph;
  for (let i = 0; i < S.nb; i++) {
    sheet(S, i, S.t, o);
    let x = o[0], y = o[1], c = 0;
    if (S.tc[i] >= 0 && ph !== "swirl") {
      holdMove(S, S.tx[i], S.ty[i], m);
      if (ph === "gather") {
        const e = sm(cl((g - 0.6 * S.dl[i]) / (TG - 0.65), 0, 1)), dx = m[0] - x, dy = m[1] - y;
        // A swoop off the straight line, widest halfway.
        const sw = sin(PI * e) * S.arc[i] * 0.35;
        x += dx * e - dy * sw;
        y += dy * e + dx * sw;
        c = sm((e - 0.88) / 0.12);
      } else if (ph === "hold") (x = m[0]), (y = m[1]), (c = 1);
      else {
        // Out from the middle of the shape, slowing, then back into the sheet.
        const [cx, cy] = CENTRE[S.shape], an = atan2(m[1] - cy, m[0] - cx) + S.bd[i];
        const r = (S.bv[i] * (1 - exp(-g * 3.2))) / 3.2, f = sm((g - 0.35) / (TB - 0.35));
        x = (m[0] + cos(an) * r) * (1 - f) + x * f;
        y = (m[1] + sin(an) * r - 6 * g * g) * (1 - f) + y * f;
        c = 1 - sm(g / 0.12);
      }
    }
    (S.px[i] = x), (S.py[i] = y), (S.c[i] = c);
  }
}

// The sky, the sun on the horizon, the treeline and the field, redrawn when
// the hue turns.
const STOPS = [[0, 0.77, 0.66, 0.8], [34, 0.88, 0.62, 0.92], [62, 0.98, 0.7, 1], [86, 1.06, 0.8, 1], [102, 1.12, 0.55, 1]];
function treeTop(x) {
  return 101 + 2 * sin(x / 6.3 + 1) + 1.5 * sin(x / 2.7) - 5 * max(0, sin(x / 4.1 + 2)) ** 6 - 3 * max(0, sin(x / 2.2)) ** 8;
}
// A dead tree on each side: trunk and branches as segments [x0, y0, x1, y1, width].
const TREES = [
  [5, 104, 7, 66, 2.2], [7, 66, 4, 56, 1.2], [6.5, 76, 14, 66, 1.2], [14, 66, 19, 64, 0.8], [5.5, 84, 0, 76, 1.2], [6, 70, 9, 58, 0.9],
  [58, 104, 57, 80, 1.8], [57, 80, 61, 72, 1], [57, 88, 50, 80, 1], [50, 80, 47, 81, 0.7], [57.5, 84, 64, 82, 0.8],
];
function scenery(S) {
  const bg = S.bg, c = [0, 0, 0], hu = S.hue < 0 ? 0 : S.hue;
  for (let y = 0; y < H; y++) {
    let k = 0;
    while (k < STOPS.length - 2 && y > STOPS[k + 1][0]) k++;
    const A = STOPS[k], B = STOPS[k + 1], f = cl((y - A[0]) / (B[0] - A[0]), 0, 1);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      hsv(A[1] + (B[1] - A[1]) * f + hu, A[2] + (B[2] - A[2]) * f, A[3] + (B[3] - A[3]) * f, c, 0);
      // The sun, low and half sunk, with two steps of glow round it.
      const r = sqrt((x + 0.5 - 40) ** 2 + (y + 0.5 - 104) ** 2);
      const sun = r < 12 ? 1 : r < 15 ? 0.55 : r < 19 ? 0.25 : 0;
      if (sun) for (let j = 0; j < 3; j++) c[j] += (255 * [1, 0.95, 0.75][j] - c[j]) * sun;
      let dark = y >= treeTop(x);
      for (const [x0, y0, x1, y1, w] of TREES) {
        const vx = x1 - x0, vy = y1 - y0, t = cl(((x + 0.5 - x0) * vx + (y + 0.5 - y0) * vy) / (vx * vx + vy * vy), 0, 1);
        if ((x + 0.5 - x0 - vx * t) ** 2 + (y + 0.5 - y0 - vy * t) ** 2 < (w * (1 - 0.3 * t)) ** 2) dark = true;
      }
      if (dark) {
        // The field below the trees, a dark plum with furrows.
        const fy = y - 108, fu = fy > 0 ? (x - 32) / (fy + 6) : 0;
        const v = fy > 0 ? (abs(fu * 3 - round(fu * 3)) < 0.12 ? 0.2 : 0.14) * min(1, fy / 10) : 0;
        hsv(0.8 + hu, 0.6, v, c, 0);
      }
      for (let j = 0; j < 3; j++) bg[p * 3 + j] = c[j];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const D = S.dark, bg = S.bg, disc = S.disc;
  D.fill(0);
  for (let i = 0; i < S.nb; i++) {
    const x = S.px[i], y = S.py[i], c = S.c[i];
    const xi = floor(x), yi = floor(y);
    if (c < 1 && xi >= 0 && xi < W && yi >= 0 && yi < H) {
      // A banking wave runs through the flock: where it passes, the birds
      // show their spread wings and the cloud darkens in a moving band.
      const bank = sin(2.4 * S.a[i] + 1.3 * S.b[i] - 2.6 * S.t), wing = bank > 0.55 ? 0.75 * (1 - c) : 0;
      D[yi * W + xi] += (0.62 + 0.3 * bank * bank) * (1 - c);
      if (wing && xi + 1 < W) D[yi * W + xi + 1] += wing;
    }
    if (c > 0) {
      // Wings spread over the slot's share of the shape, cut to the shape so
      // the holes stay sharp.
      const m = S.masks[S.shape], tc = S.tc[i], tx = tc % W, ty = floor(tc / W);
      for (let j = 0; j < disc.length; j += 2) {
        const dx = disc[j], dy = disc[j + 1], X = xi + dx, Y = yi + dy, sx = tx + dx, sy = ty + dy;
        if (X < 0 || X >= W || Y < 0 || Y >= H || sx < 0 || sx >= W || sy < 0 || sy >= H || !m[sy * W + sx]) continue;
        D[Y * W + X] += c;
      }
    }
  }
  // Glints: two toxic green points in the skull's sockets or the bat's eyes.
  const gl = S.glint, eyes = gl > 0 && S.shape !== MOON ? (S.shape === SKULL ? [[20.5 + S.look, 58], [43.5 + S.look, 58]] : [[30 + S.look * 0.3, 44], [34 + S.look * 0.3, 44]]) : [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, k = 1 - min(1, D[p]);
      let r = bg[p * 3] * k, g = bg[p * 3 + 1] * k, b = bg[p * 3 + 2] * k;
      for (const [ex, ey] of eyes) {
        const q = abs(x + 0.5 - ex) + abs(y + 0.5 - ey), a = gl * (q < 1.1 ? 1 : q < 2.1 ? 0.75 : q < 3.1 ? 0.3 : 0);
        if (a) (r += (150 + 105 * (q < 1.1) - r) * a), (g += (255 - g) * a), (b += (60 + 170 * (q < 1.1) - b) * a);
      }
      // Channels in steps of 4 of 255: too fine to see, and a frame packs smaller.
      display.setPixel(x, y, min(255, round(r / 4) * 4), min(255, round(g / 4) * 4), min(255, round(b / 4) * 4));
    }
}
