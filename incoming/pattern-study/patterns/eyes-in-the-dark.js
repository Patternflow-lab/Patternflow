// ===== Patternflow pattern =====
// Title:   Eyes in the Dark
// Family:  halloween
// Idea:    On a black panel sets of glowing eyes, a cat's slit-pupilled almonds, an owl's orange discs, a pair of red slits that glare and a spider's eight, open, follow a wandering will-o'-the-wisp with their pupils, blink, prowl, dash across the dark, shut and open again somewhere else.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 41; after the will-o'-the-wisp of European folklore
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Shift=0..1, Speed=0.2..3, Pairs=5..9, Jumpy=0..1
//
// Knob 1: Shift. Turns every colour round the wheel together. At 0 the cat's eyes are yellow-green, the owl's orange, the slits red, the spider's eight magenta and the wisp pale aqua; at 0.25 the owl turns green and the slits lime, at 0.5 the owl is blue and the cat violet. An iris edge that lands between orange and lime is paled and lifted, so it never reads brown or olive.
// Knob 2: Speed. At 2 the wisp moves 26 LEDs a second on average and 57 at its fastest, and crosses the panel's height in about five seconds; a set of eyes stays open 2 to 4.5 seconds and is gone 0.3 to 1.2 before it opens elsewhere. At 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Pairs. How many sets of eyes, 5 to 9, and never fewer than all but two of them open at once. At 5 they are full size: a cat's eye 18 LEDs wide, an owl's 15, a slit 16, the spider's eight 23 across. Each set over 5 makes the eyes 7% smaller, to 72% at 9, so they still fit.
// Knob 4: Jumpy. At 0.06 the eyes blink every 1 to 3 seconds, glance away from the wisp every 1.5 to 6, dash to a new spot every 3 to 8 and prowl at up to 4.5 LEDs a second; at 1 they blink every 0.3 to 0.8 seconds, glance every 0.3 to 1.2, dash every 0.9 to 2.4, prowl two and a half times as fast and their pupils catch up with what they look at in 0.04 seconds instead of 0.11. Any eye blinks when the wisp comes within 10 LEDs of it.
// Buttons: K1 tap opens every set at once, the shut ones wherever there is room, and for 2.5 seconds they all stare at the middle of the panel without blinking before they go back to the wisp.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, abs, round, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const len = (x, y) => sqrt(x * x + y * y);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
// How bright the eyes' glow on the dark is, against the eyes themselves.
const GLOW = 1.3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The kinds: a cat's almonds, an owl's discs, a pair of red slits that
// glare, and a spider's eight. For each: half-size of the group's box, the
// eye's half-width and half-height, how far each eye sits from the middle,
// and the hues of the iris centre and edge at Shift 0.
const CAT = 0, OWL = 1, RED = 2, SPIDER = 3;
const BOX = [[21, 8], [16, 9], [18, 7], [13, 11]];
const EYE = [[9, 5.6, 11.6], [7.4, 7.4, 8.6], [7.8, 3.1, 10]];
const HUE = [[0.17, 0.27], [0.13, 0.05], [0.05, 0.99], [0.83, 0.92]];
// The spider's eight: x, y and radius, the big front pair in the middle.
const SPIDER_EYES = [[-3.4, 2.4, 4], [3.4, 2.4, 4], [-9, 1.2, 2.5], [9, 1.2, 2.5], [-7.6, -6, 1.9], [-2.6, -7.8, 1.9], [2.6, -7.8, 1.9], [7.6, -6, 1.9]];

export function setup(params) {
  params.s = {
    shift: 0, speed: 2, pairs: 5, jumpy: 0.06,
    clock: 0, stare: 0,
    wx: 32, wy: 64, wvx: 0, wvy: -1, flick: 1, trail: [],
    groups: [],
    rgb: new Float32Array(N * 3), glow: new Float32Array(N * 3), halo: new Float32Array(N * 3), tmp: new Float32Array(N * 3), inside: new Uint8Array(N),
    col: new Float32Array(4 * 6), warm: new Float32Array(4),
  };
}

function overlaps(S, g, x, y) {
  const w = BOX[g.type][0] * g.sc, h = BOX[g.type][1] * g.sc;
  for (const o of S.groups) {
    if (o === g || o.state === 0) continue;
    const w2 = w + BOX[o.type][0] * o.sc + 2, h2 = h + BOX[o.type][1] * o.sc + 3;
    if (abs(o.x - x) < w2 && abs(o.y - y) < h2) return true;
    // A set in the middle of a dash already holds where it is going.
    if (o.dash >= 0 && abs(o.x1 - x) < w2 && abs(o.y1 - y) < h2) return true;
  }
  return false;
}

// Somewhere free on the panel, as a new kind (one spider at a time); false
// if nowhere was found.
function place(S, g) {
  const spider = S.groups.some((o) => o !== g && o.state !== 0 && o.type === SPIDER);
  g.type = floor(rnd(0, spider ? 3 : 4));
  // More pairs, smaller eyes: full size at 5, 0.72 at 9.
  g.sc = 1 - 0.07 * (S.pairs - 5);
  const w = BOX[g.type][0] * g.sc, h = BOX[g.type][1] * g.sc;
  for (let n = 0; n < 120; n++) {
    const x = rnd(w + 1, W - 1 - w), y = rnd(h + 3, H - 3 - h);
    if (!overlaps(S, g, x, y)) {
      g.x = x;
      g.y = y;
      g.ph = rnd(0, 7);
      const a = rnd(0, 2 * PI);
      g.vx = cos(a) * rnd(2, 4.5);
      g.vy = sin(a) * rnd(1, 2.5);
      return true;
    }
  }
  return false;
}

function newGroup(S, open) {
  const g = { type: CAT, x: 32, y: 64, sc: 1, vx: 0, vy: 0, ph: 0, state: 0, t: 0, dur: rnd(0.3, 1.5), o: 0, blink: rnd(0.5, 3), bt: -1, px: 0, py: 0, gx: 0, gy: 0, glance: 0, gap: rnd(1, 5), dil: 0.5, near: 0, dash: -1, dashT: rnd(0.8, 4.5), x0: 0, y0: 0, x1: 0, y1: 0 };
  if (open && place(S, g)) (g.state = 2), (g.o = 1), (g.dur = rnd(2, 7));
  return g;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.shift = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.pairs = round(cl(k[2], 5, 9));
  S.jumpy = cl(k[3], 0, 1);
  const J = S.jumpy, f = (d * S.speed) / 2;
  S.clock += f;
  while (S.groups.length < S.pairs) S.groups.push(newGroup(S, S.groups.length < S.pairs - 1));
  // Groups past the count shut and leave when the knob comes down.
  for (let i = S.pairs; i < S.groups.length; i++) if (S.groups[i].state === 2) (S.groups[i].state = 3), (S.groups[i].t = 0);
  S.groups = S.groups.filter((g, i) => i < S.pairs || g.state !== 0);

  // The wisp wanders the whole panel on two slow beats.
  const T = S.clock * 2.5, ox = S.wx, oy = S.wy;
  S.wx = 32 + 24 * sin(0.37 * T + 1.3 * sin(0.13 * T));
  S.wy = 64 + 54 * sin(0.23 * T + 0.8 * sin(0.17 * T + 1));
  if (f > 0) (S.wvx = (S.wx - ox) / f), (S.wvy = (S.wy - oy) / f);
  S.flick = 0.82 + 0.18 * sin(T * 7.1) * sin(T * 3.3 + 1);
  S.trail.unshift([S.wx, S.wy]);
  if (S.trail.length > 16) S.trail.pop();

  if (input.btnPressed && input.btnPressed[0]) {
    S.stare = 2.5;
    for (const g of S.groups) {
      if (g.state === 0 && !place(S, g)) continue;
      (g.state = 2), (g.t = 0), (g.dur = rnd(2.5, 5)), (g.bt = -1);
    }
  }
  S.stare = max(0, S.stare - f);

  for (const g of S.groups) {
    g.t += f;
    // A dash slides the eyes to somewhere else on the panel in 0.7 seconds,
    // narrowed, looking where they go. Otherwise whatever owns them prowls:
    // it drifts a few LEDs a second and turns back from the panel's edge and
    // from the others.
    if (g.dash >= 0) {
      g.dash = min(1, g.dash + f / 0.7);
      const e = sm(0, 1, g.dash);
      g.x = g.x0 + (g.x1 - g.x0) * e;
      g.y = g.y0 + (g.y1 - g.y0) * e;
      if (g.dash >= 1) (g.dash = -1), (g.dashT = rnd(2.5, 7) * (1 - 0.7 * J));
    } else if (g.state !== 0) {
      const w = BOX[g.type][0] * g.sc, h = BOX[g.type][1] * g.sc, sp = f * (1 + 1.5 * J);
      let nx = g.x + g.vx * sp, ny = g.y + g.vy * sp;
      if (nx < w + 1 || nx > W - 1 - w || overlaps(S, g, nx, g.y)) (g.vx = -g.vx), (nx = g.x);
      if (ny < h + 3 || ny > H - 3 - h || overlaps(S, g, nx, ny)) (g.vy = -g.vy), (ny = g.y);
      g.x = nx;
      g.y = ny;
    }
    if (g.state === 0) {
      if (g.t > g.dur && S.groups.indexOf(g) < S.pairs && place(S, g)) (g.state = 1), (g.t = 0);
    } else if (g.state === 1) {
      g.o = sm(0, 0.35, g.t);
      if (g.t > 0.35) (g.state = 2), (g.t = 0), (g.dur = rnd(2, 4.5) * (1 - 0.6 * J));
    } else if (g.state === 2) {
      g.o = S.stare > 0 ? min(1, g.o + f * 12) : 1;
      // It shuts when its time is up, unless that would leave fewer than
      // all but two of the sets open.
      if (g.t > g.dur && S.stare <= 0) {
        if (S.groups.filter((o) => o.state === 1 || o.state === 2).length > S.pairs - 2) (g.state = 3), (g.t = 0);
        else g.dur += rnd(0.4, 1.2);
      }
    } else {
      g.o = 1 - sm(0, 0.3, g.t);
      if (g.t > 0.3) (g.state = 0), (g.t = 0), (g.o = 0), (g.dur = rnd(0.3, 1.2) * (1 - 0.5 * J));
    }
    // Blinks: every 1 to 3 seconds when calm, 0.3 to 0.8 when jumpy, and
    // a flinch when the wisp comes within 10 LEDs.
    if (g.state === 2 && S.stare <= 0) {
      g.blink -= f;
      if (g.near > 0.7 && g.blink > 0.6) g.blink = 0;
      if (g.blink <= 0 && g.bt < 0) (g.bt = 0), (g.blink = rnd(1, 3) * (1 - 0.72 * J));
    }
    if (g.bt >= 0) {
      g.bt += f / (g.type === OWL ? 0.32 : 0.2);
      if (g.bt >= 1) g.bt = -1;
    }
    if (g.state === 2 && g.dash < 0 && g.bt < 0 && S.stare <= 0) {
      g.dashT -= f;
      if (g.dashT <= 0) {
        const w = BOX[g.type][0] * g.sc, h = BOX[g.type][1] * g.sc;
        g.dashT = 0.5;
        for (let n = 0; n < 60; n++) {
          const x = rnd(w + 1, W - 1 - w), y = rnd(h + 3, H - 3 - h);
          if (len(x - g.x, y - g.y) > 24 && !overlaps(S, g, x, y)) {
            Object.assign(g, { dash: 0, x0: g.x, y0: g.y, x1: x, y1: y });
            break;
          }
        }
      }
    }
    // Where it looks: the wisp, the centre when staring, ahead in a dash, or
    // a glance away.
    g.glance -= f;
    if (g.glance < -g.gap) (g.glance = rnd(0.3, 0.8)), (g.gap = rnd(1.5, 6) * (1 - 0.8 * J)), (g.gx = rnd(0, W)), (g.gy = rnd(0, H));
    let tx = S.wx, ty = S.wy;
    if (S.stare > 0) (tx = 31.5), (ty = 63.5);
    else if (g.dash >= 0) (tx = 2 * g.x1 - g.x0), (ty = 2 * g.y1 - g.y0);
    else if (g.glance > 0) (tx = g.gx), (ty = g.gy);
    const dx = tx - g.x, dy = ty - g.y, r = len(dx, dy) + 8, a = 1 - exp(-f * (8 + 20 * J));
    g.px += (dx / r - g.px) * a;
    g.py += (dy / r - g.py) * a;
    // The wisp's light: cat pupils shut to slits near it, and every eye
    // burns brighter.
    const wd = len(S.wx - g.x, S.wy - g.y);
    g.dil += (cl(wd / 40, 0, 1) - g.dil) * (1 - exp(-f * 3));
    g.near = exp(-wd / 28);
  }
}

// Signed distance to an almond (a lens of half-width a and half-height b)
// in its own frame, negative inside.
function almond(u, v, a, b) {
  const au = abs(u);
  if (au >= a) return len(au - a, v);
  const h = b * (1 - (u * u) / (a * a)), s = (2 * b * au) / (a * a);
  return (abs(v) - h) / sqrt(1 + s * s);
}

function put(S, x, y, r, g, b) {
  const p = y * W + x, q = p * 3;
  S.rgb[q] = r;
  S.rgb[q + 1] = g;
  S.rgb[q + 2] = b;
  S.inside[p] = 1;
}

// One eye of a pair: centre (cx, cy), side -1 or 1, lids open by `open`.
function eye(S, g, cx, cy, side, open, gain) {
  const type = g.type, c = S.col, o = type * 6, a = EYE[type][0] * g.sc, b = EYE[type][1] * g.sc, z = g.sc;
  // A cat's outer corner rises; a red eye's inner corner drops, so it glares.
  const tilt = type === CAT ? -0.16 * side : type === RED ? 0.32 * side : 0, ct = cos(tilt), st = sin(tilt);
  const pu = g.px * (type === OWL ? 2.6 : 3.8) * z, pv = g.py * (type === OWL ? 2.4 : 1.2) * z;
  const bo = b * open, pw = 1.1 + 1.8 * g.dil * z;
  for (let y = max(0, floor(cy - b - 2)); y <= min(H - 1, floor(cy + b + 2)); y++)
    for (let x = max(0, floor(cx - a - 2)); x <= min(W - 1, floor(cx + a + 2)); x++) {
      const X = x + 0.5 - cx, Y = y + 0.5 - cy, u = ct * X + st * Y, v = -st * X + ct * Y;
      let dd, rr;
      if (type === OWL) {
        // Round, with lids that close from above and below.
        rr = len(u, v);
        dd = max(rr - a, abs(v) - bo);
        rr /= a;
      } else {
        dd = almond(u, v, a, bo);
        rr = len(u / a, v / b);
      }
      const cov = cl(0.5 - dd, 0, 1);
      if (cov <= 0) continue;
      // Iris: bright at the centre, deeper at the edge.
      const m = rr >= 1 ? 1 : rr * sqrt(rr), k = gain;
      let R = (c[o] + (c[o + 3] - c[o]) * m) * k, G = (c[o + 1] + (c[o + 4] - c[o + 1]) * m) * k, B = (c[o + 2] + (c[o + 5] - c[o + 2]) * m) * k;
      // Pupil: a slit for the cat, a disc for the owl, a coal for the red.
      let p;
      if (type === CAT) p = (len((u - pu) / pw, (v - pv) / (b * 0.92)) - 1) * pw;
      else if (type === OWL) p = len(u - pu, v - pv) - 3.8 * z;
      else p = len(u - pu * 0.8, v - pv) - 1.6 * z;
      const pc = cl(0.5 - p, 0, 1) * (type === RED ? 0.75 : 1);
      R *= 1 - pc;
      G *= 1 - pc;
      B *= 1 - pc;
      // A glint, upper left of the middle.
      if (type !== RED && len(u + 1.8 * z, v + (type === OWL ? 2.2 : 1.3) * z) < 1.15) (R = 1), (G = 1), (B = 0.95);
      put(S, x, y, R * cov, G * cov, B * cov);
    }
}

function spider(S, g, open, gain) {
  const c = S.col, o = SPIDER * 6, fl = 0.35 + 0.35 * S.warm[SPIDER];
  for (let i = 0; i < 8; i++) {
    const [ex, ey, er0] = SPIDER_EYES[i];
    // The eight light up one after another, the big pair first.
    const er = er0 * g.sc * cl(open * 1.6 - i * 0.08, 0, 1);
    if (er <= 0.2) continue;
    const cx = g.x + (ex + g.px * 1.5) * g.sc, cy = g.y + (ey + g.py * 1.5) * g.sc;
    for (let y = max(0, floor(cy - er - 1)); y <= min(H - 1, floor(cy + er + 1)); y++)
      for (let x = max(0, floor(cx - er - 1)); x <= min(W - 1, floor(cx + er + 1)); x++) {
        const u = x + 0.5 - cx, v = y + 0.5 - cy, rr = len(u, v), cov = cl(er + 0.5 - rr, 0, 1);
        if (cov <= 0) continue;
        // A glossy dome: dark in the middle, the rim lit, and the wisp's
        // reflection sliding toward where it is.
        const m = (fl + (1 - fl) * (rr / er) ** 2) * gain;
        let R = c[o + 3] * m, G = c[o + 4] * m, B = c[o + 5] * m;
        const hl = cl(er * 0.42 + 0.5 - len(u - g.px * er * 0.5, v - g.py * er * 0.5 + er * 0.25), 0, 1);
        R += (1 - R) * hl;
        G += (c[o + 1] * 0.4 + 0.6 - G) * hl;
        B += (1 - B) * hl;
        put(S, x, y, R * cov, G * cov, B * cov);
      }
  }
}

// Box blur of radius r along rows then columns, from src into dst, the
// three colours in step.
function blur(src, dst, tmp, r) {
  const n = 1 / (2 * r + 1), st = W * 3;
  for (let y = 0; y < H; y++) {
    const row = y * st;
    let a = 0, b = 0, c = 0;
    for (let x = 0; x <= r; x++) (a += src[row + x * 3]), (b += src[row + x * 3 + 1]), (c += src[row + x * 3 + 2]);
    for (let x = 0, q = row; x < W; x++, q += 3) {
      tmp[q] = a * n;
      tmp[q + 1] = b * n;
      tmp[q + 2] = c * n;
      if (x >= r) (a -= src[q - r * 3]), (b -= src[q - r * 3 + 1]), (c -= src[q - r * 3 + 2]);
      if (x + r + 1 < W) (a += src[q + (r + 1) * 3]), (b += src[q + (r + 1) * 3 + 1]), (c += src[q + (r + 1) * 3 + 2]);
    }
  }
  for (let x = 0; x < W; x++) {
    let a = 0, b = 0, c = 0;
    for (let y = 0; y <= r; y++) (a += tmp[y * st + x * 3]), (b += tmp[y * st + x * 3 + 1]), (c += tmp[y * st + x * 3 + 2]);
    for (let y = 0, q = x * 3; y < H; y++, q += st) {
      dst[q] = a * n;
      dst[q + 1] = b * n;
      dst[q + 2] = c * n;
      if (y >= r) (a -= tmp[q - r * st]), (b -= tmp[q - r * st + 1]), (c -= tmp[q - r * st + 2]);
      if (y + r + 1 < H) (a += tmp[q + (r + 1) * st]), (b += tmp[q + (r + 1) * st + 1]), (c += tmp[q + (r + 1) * st + 2]);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, glow, halo, tmp, inside, col } = S;
  for (let t = 0; t < 4; t++) {
    // An edge from orange round to lime is paled and lifted, or it would
    // read brown or olive; the spider's dark domes most of all.
    const e = S.shift + HUE[t][1], wm = max(0, 1 - abs(e - floor(e) - 0.14) / 0.14);
    S.warm[t] = wm;
    hsv(S.shift + HUE[t][0], t === SPIDER ? 0.6 : 0.55, 1, col, t * 6);
    hsv(e, 0.95 - 0.3 * wm, (t === SPIDER ? 0.8 : 0.9) + 0.1 * wm, col, t * 6 + 3);
  }
  rgb.fill(0);
  inside.fill(0);
  for (const g of S.groups) {
    if (g.state === 0) continue;
    // A blink closes the lids and opens them again, quicker down than up;
    // between blinks the lids narrow and widen a little on their own.
    const bl = g.bt >= 0 ? sin(PI * (g.bt < 0.4 ? g.bt / 0.8 : 0.5 + (g.bt - 0.4) / 1.2)) : 0;
    const open = g.o * (1 - bl) * (g.type === OWL ? 1 : 0.86 + 0.14 * sin(S.clock * 1.7 + g.ph)) * (g.dash >= 0 ? 1 - 0.45 * sin(PI * g.dash) : 1);
    const gain = 0.62 + 0.38 * g.near;
    if (g.type === SPIDER) spider(S, g, g.o, gain);
    else {
      // The head turns with the eyes: the pair slides toward where it looks.
      const sep = EYE[g.type][2] * g.sc * (1 - 0.1 * abs(g.px)), hx = g.x + g.px * 2.5 * g.sc, hy = g.y + g.py * 1.5 * g.sc;
      eye(S, g, hx - sep, hy, -1, open, gain);
      eye(S, g, hx + sep, hy, 1, open, gain);
    }
  }
  // The eyes' glow on the dark round them.
  blur(rgb, halo, tmp, 3);
  blur(halo, glow, tmp, 3);
  // The wisp: a pale flame whose tail is where it has just been.
  const wc = [0, 0, 0];
  hsv(S.shift + 0.45, 0.45, 1, wc, 0);
  const tr = S.trail;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (const [tx, ty] of tr) (x0 = min(x0, tx)), (x1 = max(x1, tx)), (y0 = min(y0, ty)), (y1 = max(y1, ty));
  x0 = max(0, floor(x0 - 14));
  x1 = min(W - 1, floor(x1 + 14));
  y0 = max(0, floor(y0 - 14));
  y1 = min(H - 1, floor(y1 + 14));
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const q = p * 3;
      let r = rgb[q], gg = rgb[q + 1], b = rgb[q + 2];
      if (!inside[p]) (r = floor(glow[q] * GLOW * 40) / 40), (gg = floor(glow[q + 1] * GLOW * 40) / 40), (b = floor(glow[q + 2] * GLOW * 40) / 40);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        let wl = 0, core = 0;
        for (let i = 0; i < tr.length; i += 3) {
          const k = 1 - i / tr.length, rad = 1.2 + 1.9 * k, dd = len(x + 0.5 - tr[i][0], y + 0.5 - tr[i][1]);
          if (dd < 13) wl += k * k * exp(-dd / (2.4 + 2.6 * k)) * (1 - dd / 13);
          core = max(core, k * cl(rad + 0.5 - dd, 0, 1));
        }
        wl *= 0.5 * S.flick;
        r += wc[0] * wl + core * (1 - r) * 0.85;
        gg += wc[1] * wl + core * (1 - gg) * 0.85;
        b += wc[2] * wl + core * (1 - b) * 0.85;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, gg)), round(255 * min(1, b)));
    }
}
