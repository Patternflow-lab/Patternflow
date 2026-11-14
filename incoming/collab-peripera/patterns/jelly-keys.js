// ===== Patternflow pattern =====
// Title:   Jelly Keys
// Family:  cosmetic
// Idea:    The panel is a sheet of soft jelly keys in milky fruit shades, sprung to each other, and unseen fingertips tap them in single pokes, chords and drum rolls: a tapped key squishes in, glows and bounces back, the bounce ripples out to its neighbours, and a key pressed hard enough pops over to the next shade.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, collab reference for PERIPERA, after the keycap blush case and the brand's "발랄하고 톡톡 튀는" campaign line
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tap=0.2..3, Size=0..1, Wobble=0..1
//
// Knob 1: Hue. Turns the whole shade card round the colour wheel; at 0 it is the card the keys open on, milky peach, grape milk, sweet-potato pink, plum, coral and strawberry milk.
// Knob 2: Tap. How busy the fingertips are and how fast the jelly moves: at 2 about six taps a second land somewhere on the sheet, at 0.2 it is a lazy poke now and then in slow motion.
// Knob 3: Size. The keys, from about nine LEDs across (seven columns, fourteen rows) at 0 to about sixteen across (four columns, eight rows) at 1.
// Knob 4: Wobble. How soft the jelly is and how much the keys are tied to each other: at 0 the keys are firm and a tap moves the key it lands on and barely its neighbours, at 1 the sheet is one soft jelly and every tap sends slow rings of bounces across it.
// Buttons: K1 tap drums a roll of taps across the whole sheet.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, exp, sin, cos, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The shade card, in hue, saturation, value. Picked from the way the brand
// names its shades (우유머금은복숭아, 포도우유샷추가, 제철핑구마, 자두뿜뿜, coral),
// not measured from product photos.
const CARD = [
  [0.035, 0.3, 1.0], // milky peach
  [0.75, 0.3, 1.0], // grape milk
  [0.93, 0.5, 1.0], // sweet-potato pink
  [0.9, 0.62, 0.86], // plum
  [0.012, 0.46, 1.0], // coral
  [0.965, 0.24, 1.0], // strawberry milk
];
const MAXK = 26 * 24;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    cols: 0, rows: 0, tw: 1, th: 1,
    z: F(MAXK), v: F(MAXK), shade: new Uint8Array(MAXK), flash: F(MAXK), ph: F(MAXK), fr: F(MAXK),
    // Drum rolls in progress: a fingertip running along a line of keys.
    rolls: [], clock: 0, light: 0, hue: 0, tap: 2, size: 0, wob: 0.06, owed: 0,
    c: F(3), d: F(3),
  };
}

function layout(S) {
  const s = 9 + 7 * S.size;
  const cols = cl(round(W / s), 4, 24), rows = cl(round(H / (W / cols)), 8, 26);
  if (cols === S.cols && rows === S.rows) return;
  S.cols = cols;
  S.rows = rows;
  S.tw = W / cols;
  S.th = H / rows;
  for (let i = 0; i < cols * rows; i++) {
    S.z[i] = 0;
    S.v[i] = 0;
    S.flash[i] = 0;
    S.shade[i] = floor(rnd() * CARD.length);
    // Each key breathes on a rate of its own, so no two keep step.
    S.ph[i] = rnd() * 2 * PI;
    S.fr[i] = 0.21 + 0.37 * rnd();
  }
}

function poke(S, c, r, force) {
  if (c < 0 || r < 0 || c >= S.cols || r >= S.rows) return;
  const i = r * S.cols + c;
  S.v[i] += force;
}

function tapSomewhere(S) {
  const c = floor(rnd() * S.cols), r = floor(rnd() * S.rows), kind = rnd();
  if (kind < 0.62) poke(S, c, r, 10 + 8 * rnd());
  else if (kind < 0.86) {
    // A chord: two or three keys close together at once.
    const n = 2 + floor(rnd() * 2);
    for (let k = 0; k < n; k++) poke(S, c + floor(rnd() * 3) - 1, r + floor(rnd() * 3) - 1, 9 + 6 * rnd());
  } else {
    // A drum roll that runs along a row, a column or a diagonal.
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const d = dirs[floor(rnd() * dirs.length)];
    S.rolls.push({ c, r, dc: d[0], dr: d[1], left: 4 + floor(rnd() * 7), next: 0, gap: 0.06 + 0.05 * rnd() });
  }
}

function step(S, dt) {
  const n = S.cols * S.rows, z = S.z, v = S.v, C = S.cols, R = S.rows;
  // Springs: each key to its rest, and to its four neighbours by Wobble.
  const k0 = 300 - 210 * S.wob, kc = 30 + 650 * S.wob, damp = 8 - 5.5 * S.wob;
  const sub = 3, h = dt / sub;
  for (let s = 0; s < sub; s++) {
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        let lap = 0, nb = 0;
        if (c > 0) (lap += z[i - 1]), nb++;
        if (c < C - 1) (lap += z[i + 1]), nb++;
        if (r > 0) (lap += z[i - C]), nb++;
        if (r < R - 1) (lap += z[i + C]), nb++;
        lap -= nb * z[i];
        v[i] += (-k0 * z[i] + kc * lap - damp * v[i]) * h;
      }
    for (let i = 0; i < n; i++) z[i] = cl(z[i] + v[i] * h, -0.6, 1);
  }
  for (let i = 0; i < n; i++) {
    // A key pushed most of the way in pops over to the next shade on the card.
    if (z[i] > 0.62 && S.flash[i] < 0.3) {
      S.shade[i] = (S.shade[i] + 1 + floor(rnd() * 2)) % CARD.length;
      S.flash[i] = 1;
    }
    S.flash[i] = max(0, S.flash[i] - dt * 1.6);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.tap = cl(k[1], 0.2, 3);
  S.size = cl(k[2], 0, 1);
  S.wob = cl(k[3], 0, 1);
  layout(S);
  if (!S.warm) {
    // Open on a sheet that has been played with for a few seconds.
    for (let i = 0; i < 40; i++) tapSomewhere(S);
    for (let i = 0; i < 60; i++) step(S, 1 / 30);
    S.warm = true;
  }
  const st = d * (0.35 + 0.45 * S.tap);
  S.clock += st;
  // The light over the sheet swings round slowly on two rates, so the shine
  // on every key keeps moving even where nobody is tapping.
  S.light = 0.9 * sin(S.clock * 0.173) + 0.5 * sin(S.clock * 0.071 + 1.3);
  if (input.btnPressed && input.btnPressed[0]) {
    for (let r = 0; r < S.rows; r += 2) S.rolls.push({ c: 0, r, dc: 1, dr: 0, left: S.cols, next: r * 0.02, gap: 0.035 });
  }
  // Taps arrive at random, about three per unit of Tap a second.
  S.owed += d * 3 * S.tap;
  while (S.owed > 0) {
    if (rnd() < min(1, S.owed)) tapSomewhere(S);
    S.owed -= 1;
  }
  for (let j = S.rolls.length - 1; j >= 0; j--) {
    const roll = S.rolls[j];
    roll.next -= st;
    while (roll.next <= 0 && roll.left > 0) {
      poke(S, roll.c, roll.r, 11);
      roll.c += roll.dc;
      roll.r += roll.dr;
      roll.left--;
      roll.next += roll.gap;
    }
    if (roll.left <= 0 || roll.c < -1 || roll.r < -1 || roll.c > S.cols || roll.r > S.rows) S.rolls.splice(j, 1);
  }
  if (S.rolls.length > 40) S.rolls.splice(0, S.rolls.length - 40);
  step(S, st);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cols) return;
  const C = S.cols, R = S.rows, tw = S.tw, th = S.th, z = S.z, c = S.c, d = S.d;
  const lx = 0.32 + 0.12 * S.light, ly = 0.3 + 0.08 * cos(S.clock * 0.13);
  for (let y = 0; y < H; y++) {
    const r = min(R - 1, floor(y / th));
    const v0 = (y + 0.5 - r * th) / th;
    for (let x = 0; x < W; x++) {
      const col = min(C - 1, floor(x / tw));
      const i = r * C + col;
      const u0 = (x + 0.5 - col * tw) / tw;
      const zi = z[i];
      const sh = CARD[S.shade[i]];
      const breathe = 0.06 * sin(S.clock * S.fr[i] * 2.3 + S.ph[i]);
      hsv(sh[0] + S.hue, sh[1], sh[2], c);
      // A pressed key shrinks a little into the sheet; a key that bounced
      // proud of it swells.
      const half = 0.41 - 0.11 * cl(zi, -0.6, 1);
      const rad = 0.24;
      const qx = abs(u0 - 0.5) - (half - rad), qy = abs(v0 - 0.5) - (half - rad);
      const box = sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2) + min(max(qx, qy), 0) - rad;
      // The gap between keys: the key's own shade, deep and dim.
      if (box > 0.02) {
        hsv(sh[0] + S.hue + 0.02, min(1, sh[1] + 0.3), 0.2, d);
        const a = cl((box - 0.02) / 0.06, 0, 1);
        const kr = 0.55 + breathe;
        display.setPixel(x, y, round(255 * (c[0] * kr * (1 - a) + d[0] * a)), round(255 * (c[1] * kr * (1 - a) + d[1] * a)), round(255 * (c[2] * kr * (1 - a) + d[2] * a)));
        continue;
      }
      // The jelly face: lit by its press, its pop and its tilt toward the
      // neighbours that are moving, with a soft shine that slides with the light.
      const zl = col > 0 ? z[i - 1] : zi, zr = col < C - 1 ? z[i + 1] : zi;
      const zu = r > 0 ? z[i - C] : zi, zd = r < R - 1 ? z[i + C] : zi;
      const tx = (zr - zl) * 0.5, ty = (zd - zu) * 0.5;
      const glow = cl(zi, 0, 1) * 0.55 + S.flash[i] * 0.45;
      const rim = cl(-box / 0.12, 0, 1);
      const lit = (0.8 + breathe + 0.25 * glow) * (0.7 + 0.3 * rim);
      const hx = u0 - (lx - 0.25 * tx), hy = v0 - (ly - 0.25 * ty);
      const shine = exp(-(hx * hx + hy * hy) / (0.016 + 0.03 * glow)) * (0.5 + 0.45 * glow) * rim;
      const milk = 0.25 * glow;
      for (let ch = 0; ch < 3; ch++) d[ch] = min(1, c[ch] * lit * (1 - milk) + milk + shine);
      display.setPixel(x, y, round(d[0] * 255), round(d[1] * 255), round(d[2] * 255));
    }
  }
}
