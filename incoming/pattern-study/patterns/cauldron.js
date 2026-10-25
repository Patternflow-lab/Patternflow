// ===== Patternflow pattern =====
// Title:   Cauldron
// Family:  halloween
// Idea:    A black iron cauldron over a small fire near the foot of the panel heaves with glowing toxic-green brew; bubbles swell and pop into flying droplets, green and purple fumes curl up the full height of the panel, and a tap drops an eyeball in with a splash that turns the brew another colour.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 41; after the witch's cauldron of Halloween decorations
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Boil=0..1, Fume=0..1
//
// Knob 1: Hue. Turns the brew and its fumes round the wheel together. At 0 the brew is toxic green and the fumes green and purple; at 0.5 the brew is purple and the fumes purple and lime; at 0.75 the brew is orange and the fumes orange and cyan.
// Knob 2: Speed. Runs everything faster or slower: at 2 a fume takes about 4 seconds to climb from the brew to the top of the panel, at 0.2 about 40.
// Knob 3: Boil. How hard it boils. At 0 about 3 bubbles a second swell to as much as 9 LEDs across before they pop, and the brew heaves up to 4 LEDs over the far lip; at 1 about 11 a second swell to 19 across, the brew heaves up to 9 LEDs and the droplets fly about four times as high.
// Knob 4: Fume. How much fume rises: 12 puffs a second at 0, each swelling to as much as 17 LEDs across as it climbs; 36 a second at 1, each up to 28 across, when the two ribbons thicken into plumes that fill most of the panel above the pot.
// Buttons: K1 tap drops an eyeball from the top of the panel. It lands in the brew with a splash a third of the panel high, the surface rings, and the brew turns from green to violet, then orange, then cyan, then green again.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, abs, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = [v, q, p, p, t, v][i];
  out[o + 1] = [t, v, v, q, p, p][i];
  out[o + 2] = [p, p, t, v, v, q][i];
}

// The pot. The mouth is an ellipse centred on (CX, RY0): the brew fills the
// inner one, the iron lip lies between the inner and the outer one. The body
// is the part of a wider ellipse below the lip, cut flat at its foot.
const CX = 32, RY0 = 89;
const IN_A = 23.5, IN_B = 4.5, OUT_A = 27.5, OUT_B = 6.5;
const BODY_CY = 100, BODY_A = 30, BODY_B = 21, FOOT = 120;
// Brew hue at Hue 0, and the four brews a tap steps through: green, violet,
// orange, cyan.
const BREW0 = 0.3, BREWS = [0, 0.46, 0.77, 0.25];

// Pot pixels, worked out once: 0 none, 1-3 body from shadow to light, 4 the
// glint, 5 lip, 6 lip highlight, 7 leg. FRONT marks the half of the lip that
// lies in front of the brew.
const POT = new Uint8Array(W * H), FRONT = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const px = x + 0.5 - CX, py = y + 0.5, p = y * W + x;
    const u = px / BODY_A, v = (py - BODY_CY) / BODY_B, r2 = u * u + v * v;
    if (r2 <= 1 && py >= RY0 && py <= FOOT) {
      // Lit from the upper left: three flat bands and a glint, so the round
      // body reads from across a room.
      const nz = sqrt(max(0, 1 - r2)), l = -0.62 * u - 0.38 * v + 0.55 * nz;
      POT[p] = l > 0.8 ? 4 : l > 0.5 ? 3 : l > 0.15 ? 2 : 1;
    }
    // Two stubby legs, splayed out from under the body.
    for (const s of [-1, 1]) {
      const t = (py - 114) / 11;
      if (t >= 0 && t <= 1 && abs(px - s * (14 + 4 * t)) <= 2.6 - 0.8 * t && !POT[p]) POT[p] = 7;
    }
    const ei = (px / IN_A) ** 2 + ((py - RY0) / IN_B) ** 2, eo = (px / OUT_A) ** 2 + ((py - RY0) / OUT_B) ** 2;
    if (eo <= 1 && ei > 1) {
      // The lip's top face catches the light on the far side and the left.
      POT[p] = py < RY0 - 2.5 || (px < -18 && py < RY0 + 2) ? 6 : 5;
      FRONT[p] = py > RY0 ? 1 : 0;
    }
  }
// Iron colours for 1-7 (index 0 unused).
const IRON = [
  [0, 0, 0], [0.07, 0.05, 0.1], [0.14, 0.1, 0.19], [0.25, 0.2, 0.32], [0.62, 0.58, 0.72], [0.26, 0.22, 0.32], [0.5, 0.46, 0.6], [0.12, 0.09, 0.15],
];

// Inner mouth half-depth at column x (0 outside the mouth).
const mouth = (x) => {
  const u = (x - CX) / IN_A;
  return abs(u) < 1 ? IN_B * sqrt(1 - u * u) : 0;
};

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, boil: 0, fume: 0.06,
    t: 0, begun: false,
    brew: 0, brewFrom: 0, brewTo: 0, brewMix: 1, brewIdx: 0,
    bubbles: [], drops: [], puffs: [], rings: [],
    bubbleDue: 0, puffDue: 0, vent: 0,
    eye: null, jet: null, shock: null,
    lift: new Float32Array(W),
    fg: new Float32Array(W * H), fp: new Float32Array(W * H), cf: new Float32Array(6 * W * H),
    rgb: new Float32Array(W * H * 3),
    c: new Float32Array(9 * 3),
  };
}

// The fumes swirl in a velocity field with no divergence, the curl of a
// stream function made of three travelling cells, on top of a steady rise.
function flow(x, y, t, out) {
  // psi = sum a sin(kx x + p) sin(ky y + q), velocity (dpsi/dy, -dpsi/dx).
  let vx = 0, vy = 0;
  const M = [
    [10, 0.16, 0.1, 0.8, 1.2, 0.0], [8, 0.22, 0.17, -1.1, 0.7, 2.0], [6, 0.1, 0.24, 0.6, -1.5, 4.0],
  ];
  for (const [a, kx, ky, w1, w2, ph] of M) {
    const sx = sin(kx * x + w1 * t + ph), cx = cos(kx * x + w1 * t + ph), sy = sin(ky * y + w2 * t), cy = cos(ky * y + w2 * t);
    vx += a * sx * cy;
    vy -= ((a * kx) / ky) * cx * sy;
  }
  out[0] = vx;
  out[1] = vy * 0.5 - 22;
}

function spawnBubble(S) {
  const x = CX + (random() * 2 - 1) * (IN_A - 6), d = random();
  const R = 3 + 2 * S.boil + random() * (1.5 + 3 * S.boil);
  S.bubbles.push({ x, d, R, age: 0, life: 0.55 + random() * 0.6 });
}

function pop(S, b, y) {
  const n = 2 + floor(b.R * 0.6);
  const sp = 1 + S.boil;
  for (let i = 0; i < n; i++) {
    const a = -PI / 2 + (random() * 2 - 1) * 0.9;
    const v = (26 + random() * 30) * sqrt(sp) * (0.6 + b.R / 8);
    S.drops.push({ x: b.x, y: y - b.R * 0.5, vx: cos(a) * v * 0.7, vy: sin(a) * v, big: random() < 0.5 });
  }
  S.rings.push({ x: b.x, y, r: b.R, age: 0 });
}

// Two vents, one for each colour of fume, wander across the brew, so each
// lays a ribbon that the swirl then bends and curls.
function emitPuff(S, kind, x) {
  S.puffs.push({
    x, y: RY0 - 3, age: 0, life: 4.4 + random() * 1.4 + 1.2 * S.fume,
    R: 4.5 + random() * 2 + 4 * S.fume, kind, brew: S.brew,
  });
}

function step(S, d) {
  S.t += d;
  const t = S.t, boil = S.boil;
  // The surface lift, LEDs up from the far edge of the mouth: a slow heave
  // of the whole brew, two travelling swells, a dome in the middle that
  // breathes, and the ring a splash leaves.
  const amp = 2 + 3 * boil;
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - CX) / IN_A;
    if (abs(u) >= 1) {
      S.lift[x] = 0;
      continue;
    }
    let L = amp * (0.55 + 0.45 * sin(1.3 * t)) * (1 - u * u) + amp * 0.5 * (sin(0.31 * x + 2.6 * t) * 0.6 + sin(0.53 * x - 3.4 * t + 1) * 0.4 + 0.6);
    if (S.shock) {
      const g = S.shock, a = g.age, dx = abs(x + 0.5 - g.x);
      L += 7 * Math.exp(-1.6 * a) * cos(0.42 * dx - 9 * a) * Math.exp(-dx / 30);
    }
    S.lift[x] = max(0, L);
  }
  // Bubbles, at 3 a second at Boil 0 and 11 at 1, faster for 3 seconds
  // after a splash.
  const rate = (3 + 8 * boil) * (S.shock ? 1 + 2 * Math.exp(-S.shock.age) : 1);
  S.bubbleDue += d * rate;
  while (S.bubbleDue >= 1) (S.bubbleDue -= 1), spawnBubble(S);
  for (let i = S.bubbles.length - 1; i >= 0; i--) {
    const b = S.bubbles[i];
    b.age += d;
    if (b.age >= b.life) {
      pop(S, b, surfY(S, b));
      S.bubbles.splice(i, 1);
    }
  }
  // Droplets fly, fall back into the mouth or off the foot of the panel.
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const p = S.drops[i];
    p.vy += 150 * d;
    p.x += p.vx * d;
    p.y += p.vy * d;
    const xi = floor(p.x), m = xi >= 0 && xi < W ? mouth(p.x) : 0;
    const back = p.vy > 0 && m > 0 && p.y > RY0 - m - S.lift[cl(xi, 0, W - 1)] + 1.5;
    const hit = p.vy > 0 && xi >= 0 && xi < W && p.y >= 0 && p.y < H && POT[floor(p.y) * W + xi] && !m;
    if (back || hit || p.y > H + 2 || p.x < -3 || p.x > W + 3) S.drops.splice(i, 1);
  }
  for (let i = S.rings.length - 1; i >= 0; i--) if ((S.rings[i].age += d) > 0.18) S.rings.splice(i, 1);
  // Fumes.
  S.puffDue += d * (12 + 24 * S.fume);
  while (S.puffDue >= 1) {
    S.puffDue -= 1;
    const kind = (S.vent = 1 - S.vent);
    emitPuff(S, kind, CX + 13 * sin(0.43 * t + kind * 2.4) + 3 * sin(1.7 * t + kind));
  }
  const v = [0, 0];
  for (let i = S.puffs.length - 1; i >= 0; i--) {
    const q = S.puffs[i];
    q.age += d;
    flow(q.x, q.y, t, v);
    // Fresh fume leaves straight up and only takes the swirl as it climbs.
    const k = cl(q.age / 0.8, 0, 1);
    q.x += v[0] * k * d;
    q.y += v[1] * d;
    if (q.age > q.life || q.y < -20) S.puffs.splice(i, 1);
  }
  // The eyeball, the jet it throws up, and the brew changing colour.
  if (S.eye) {
    const e = S.eye;
    e.vy += 150 * d;
    e.y += e.vy * d;
    e.spin += d * 5;
    const top = RY0 - mouth(e.x) - S.lift[floor(e.x)];
    if (!e.in && e.y > top) {
      e.in = true;
      S.jet = { x: e.x, age: 0 };
      S.shock = { x: e.x, age: 0 };
      for (let i = 0; i < 26; i++) {
        const a = -PI / 2 + (random() * 2 - 1) * 1.1, sp = 60 + random() * 55;
        S.drops.push({ x: e.x + (random() * 2 - 1) * 4, y: top, vx: cos(a) * sp * 0.6, vy: sin(a) * sp, big: true });
      }
      S.brewFrom = S.brew;
      S.brewIdx = (S.brewIdx + 1) % BREWS.length;
      S.brewTo = BREWS[S.brewIdx];
      S.brewMix = 0;
    }
    if (e.in) e.vy = min(e.vy, 20);
    if (e.in && e.y > top + 10) S.eye = null;
  }
  if (S.jet && (S.jet.age += d) > 0.7) S.jet = null;
  if (S.shock && (S.shock.age += d) > 3) S.shock = null;
  if (S.brewMix < 1) {
    S.brewMix = min(1, S.brewMix + d / 0.8);
    let dh = S.brewTo - S.brewFrom;
    dh -= Math.round(dh);
    S.brew = S.brewFrom + dh * S.brewMix;
  }
}

// Row of a bubble's centre: its place between the far and the near edge of
// the brew, the far edge lifted with the surface.
function surfY(S, b) {
  const xi = cl(floor(b.x), 0, W - 1), m = mouth(b.x);
  return RY0 - m - S.lift[xi] + (2 * m + S.lift[xi]) * (0.15 + 0.6 * b.d);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.boil = cl(k[2], 0, 1);
  S.fume = cl(k[3], 0, 1);
  if (!S.begun) {
    // Start with the fume already up the panel.
    S.begun = true;
    for (let i = 0; i < 150; i++) step(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0] && !S.eye) S.eye = { x: CX - 6 + random() * 12, y: -6, vy: 10, spin: 0, in: false };
  step(S, d * S.speed * 0.5);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, fg, fp, cf, c, lift } = S;
  const bh = BREW0 + S.hue + S.brew;
  // Palette, three entries each: brew 0, brew crest 3, brew deep 6, bubble
  // 9, bubble rim 12, flame 15, flame core 18, droplet 21, white 24.
  hsv(bh, 0.88, 1, c, 0);
  hsv(bh - 0.02, 0.45, 1, c, 3);
  hsv(bh, 0.92, 0.62, c, 6);
  hsv(bh + 0.02, 0.55, 1, c, 9);
  hsv(bh, 0.95, 0.5, c, 12);
  hsv(0.04, 0.95, 1, c, 15);
  hsv(0.13, 0.75, 1, c, 18);
  hsv(bh, 0.6, 1, c, 21);
  c[24] = c[25] = c[26] = 1;
  rgb.fill(0);
  const put = (x, y, o) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const q = (y * W + x) * 3;
    rgb[q] = c[o];
    rgb[q + 1] = c[o + 1];
    rgb[q + 2] = c[o + 2];
  };

  // Fume: one field per vent, each puff a soft bump that swells and fades
  // with age, cut into three flat levels so the fume reads as bold shapes.
  // A puff keeps the colour of the brew it rose from, so after a splash the
  // new colour climbs the panel under the old one.
  fg.fill(0);
  fp.fill(0);
  cf.fill(0);
  const pc = [0, 0, 0];
  for (const q of S.puffs) {
    const a = q.age / q.life, R = q.R * (0.45 + 0.9 * sqrt(a));
    const w = cl(q.age / 0.5, 0, 1) * (a < 0.55 ? 1 : 1 - (a - 0.55) / 0.45) * 1.25;
    const F = q.kind ? fp : fg, o3 = q.kind ? 3 * W * H : 0;
    hsv(BREW0 + S.hue + q.brew + (q.kind ? 0.47 : 0), q.kind ? 0.72 : 0.8, 1, pc, 0);
    for (let y = max(0, floor(q.y - R)); y <= min(H - 1, floor(q.y + R)); y++)
      for (let x = max(0, floor(q.x - R)); x <= min(W - 1, floor(q.x + R)); x++) {
        const dx = (x + 0.5 - q.x) / R, dy = (y + 0.5 - q.y) / R, r2 = dx * dx + dy * dy;
        if (r2 >= 1) continue;
        const k = w * (1 - r2) * (1 - r2), p = y * W + x, i = o3 + p * 3;
        F[p] += k;
        cf[i] += k * pc[0];
        cf[i + 1] += k * pc[1];
        cf[i + 2] += k * pc[2];
      }
  }
  for (let p = 0; p < W * H; p++) {
    const a = fg[p], b = fp[p], top = a >= b ? a : b, i = (a >= b ? 0 : 3 * W * H) + p * 3;
    const lv = top > 1.1 ? 0.92 : top > 0.55 ? 0.55 : top > 0.25 ? 0.3 : 0;
    if (!lv) continue;
    rgb[p * 3] = (cf[i] / top) * lv;
    rgb[p * 3 + 1] = (cf[i + 1] / top) * lv;
    rgb[p * 3 + 2] = (cf[i + 2] / top) * lv;
  }

  // Fire under the pot: tongues that flicker, red-orange round a yellow core.
  const t = S.t;
  for (let x = 12; x < 52; x++) {
    const e = 1 - abs(x + 0.5 - CX) / 20;
    const h = e * (6 + 3.5 * sin(0.9 * x + 11 * t) * sin(0.37 * x - 7 * t) + 2 * sin(1.7 * x + 17 * t));
    for (let y = H - 1; y > H - 1 - h; y--) {
      const core = H - 1 - y < h * 0.5 && e > 0.25;
      put(x, y, core ? 18 : 15);
    }
  }

  // The pot body and legs, the far half of the lip, with the brew's light
  // on the top of the body and the fire's on its foot.
  const gl = [c[0], c[1], c[2]];
  for (let y = 80; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, m = POT[p];
      if (!m || FRONT[p]) continue;
      const q = p * 3, col = IRON[m];
      let r = col[0], g = col[1], b = col[2];
      if (m <= 4 && y < RY0 + 5 && m > 1) {
        r = r * 0.6 + gl[0] * 0.25;
        g = g * 0.6 + gl[1] * 0.25;
        b = b * 0.6 + gl[2] * 0.25;
      } else if (m <= 2 && y > FOOT - 5) {
        r = max(r, 0.45);
        g = max(g, 0.16);
      }
      rgb[q] = r;
      rgb[q + 1] = g;
      rgb[q + 2] = b;
    }

  // The brew: the inner mouth, its far edge lifted by the heave.
  for (let x = 0; x < W; x++) {
    const m = mouth(x + 0.5);
    if (!m) continue;
    const top = RY0 - m - lift[x], bot = RY0 + m;
    for (let y = max(0, floor(top)); y <= floor(bot); y++) {
      const o = y - top < 1.6 ? 3 : y > bot - 1.5 ? 6 : 0;
      put(x, y, o);
    }
  }
  // Bubbles: a pale dome with a dark rim and a white glint; a popped one
  // leaves a ring for a moment.
  for (const b of S.bubbles) {
    const a = b.age / b.life, R = b.R * (0.35 + 0.65 * sqrt(a)), cy = surfY(S, b) - R * 0.45;
    for (let y = floor(cy - R - 1); y <= floor(cy + R + 1); y++)
      for (let x = floor(b.x - R - 1); x <= floor(b.x + R + 1); x++) {
        const dd = sqrt((x + 0.5 - b.x) ** 2 + (y + 0.5 - cy) ** 2);
        if (dd > R + 0.5) continue;
        put(x, y, dd > R - 0.8 ? 12 : 9);
      }
    const gx = floor(b.x - R * 0.4), gy = floor(cy - R * 0.4);
    if (R > 2.2) put(gx, gy, 24);
  }
  for (const g of S.rings) {
    const R = g.r * (1 + g.age * 6);
    for (let i = 0; i < 24; i++) {
      const a = (2 * PI * i) / 24;
      put(floor(g.x + R * cos(a)), floor(g.y - g.r * 0.4 + R * 0.5 * sin(a)), 3);
    }
  }
  // The jet a splash throws up: a column of brew that shoots up 42 LEDs and
  // falls back in 0.7 seconds of pattern time.
  if (S.jet) {
    const j = S.jet, hgt = 42 * sin((PI * j.age) / 0.7), base = RY0 - mouth(j.x) - lift[floor(j.x)];
    for (let y = floor(base - hgt); y <= base; y++) {
      const w = 2.6 + 1.6 * ((y - (base - hgt)) / max(1, hgt));
      for (let x = floor(j.x - w); x <= floor(j.x + w); x++) put(x, y, abs(x + 0.5 - j.x) < w * 0.45 ? 3 : 0);
    }
    for (let x = floor(j.x - 3); x <= floor(j.x + 3); x++)
      for (let y = floor(base - hgt - 3); y <= floor(base - hgt + 1); y++)
        if ((x + 0.5 - j.x) ** 2 + (y + 0.5 - (base - hgt - 1)) ** 2 < 9) put(x, y, 3);
  }
  // The near half of the lip, in front of the brew.
  for (let y = RY0; y < RY0 + OUT_B + 1; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!FRONT[p]) continue;
      const col = IRON[POT[p]], q = p * 3;
      rgb[q] = col[0];
      rgb[q + 1] = col[1];
      rgb[q + 2] = col[2];
    }
  // Droplets, 2 LEDs square, the big ones 3.
  for (const p of S.drops) {
    const s = p.big ? 3 : 2, x0 = floor(p.x - s / 2), y0 = floor(p.y - s / 2);
    for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) put(x, y, 21);
  }
  // The eyeball: white, a violet iris that rolls as it falls, a black pupil.
  if (S.eye) {
    const e = S.eye, ix = e.x + 2 * cos(e.spin), iy = e.y + 2 * sin(e.spin);
    const top = RY0 - mouth(e.x) - lift[floor(e.x)];
    for (let y = floor(e.y - 5); y <= floor(e.y + 5); y++)
      for (let x = floor(e.x - 5); x <= floor(e.x + 5); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H || (e.in && y > top)) continue;
        const d0 = (x + 0.5 - e.x) ** 2 + (y + 0.5 - e.y) ** 2;
        if (d0 > 4.6 * 4.6) continue;
        const di = (x + 0.5 - ix) ** 2 + (y + 0.5 - iy) ** 2, q = (y * W + x) * 3;
        const col = di < 1.1 ? [0, 0, 0] : di < 5.3 ? [0.55, 0.2, 1] : [0.95, 0.93, 0.9];
        rgb[q] = col[0];
        rgb[q + 1] = col[1];
        rgb[q + 2] = col[2];
      }
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, floor(min(1, rgb[q]) * 255), floor(min(1, rgb[q + 1]) * 255), floor(min(1, rgb[q + 2]) * 255));
}
