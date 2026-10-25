// ===== Patternflow pattern =====
// Title:   In the Flash
// Family:  halloween
// Idea:    A rainy field at night stays almost dark, rain and a faint horizon, until lightning lights it violet-white for a moment and shows a tall thin figure standing in the grass, a little closer at every flash and never once seen moving, until a flash shows its head right in front of you and two glowing eyes stay behind in the dark; the next flash shows an empty field, and then it stands far off again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rain=0..1, Approach=3..8
//
// Knob 1: Hue. The tint of the flash and the colour of the eyes, turned together: at 0 a violet-white flash and toxic green eyes; at 0.25 a pink-white flash and blue eyes; at 0.5 a pale yellow-green flash and magenta eyes; at 0.75 a pale cyan flash and orange eyes. The dark sky between flashes stays deep violet.
// Knob 2: Speed. How often the lightning comes. At 2 the figure takes 6.4 s to come from far off to right in front, split between its steps, each gap 0.85 to 1.15 times the even share; the eyes stay at least 2.3 s; at 0.2 everything between flashes is ten times slower, at 3 two thirds as long. A flash itself always lasts about half a second, a bright stroke and a weaker one 0.2 s later. The first flash comes 0.5 s in at Speed 2.
// Knob 3: Rain. At 0 about 200 drops in the air, at 1 about 900, each a streak slanting left, dim in the dark and white in the flash.
// Knob 4: Approach. How many flashes it takes to come from far off to right in front: at 3 it stands 18 LEDs tall on the horizon, then 38, then 82 with its feet at the bottom; at 8 it comes in eight smaller steps, so the lightning comes more often. Then one flash for the face and one for the empty field.
// Buttons: K1 tap brings the next flash at once.

const W = 64, H = 128, N = W * H, HZ = 70;
const { floor, round, min, max, abs, sqrt, exp, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Value noise on a lattice, in two dimensions.
const vn2 = (x, y, sd) => {
  const i = floor(x), j = floor(y), u = sm(x - i), v = sm(y - j);
  const a = hash(i * 7919 + j * 104729 + sd), b = hash((i + 1) * 7919 + j * 104729 + sd);
  const c = hash(i * 7919 + (j + 1) * 104729 + sd), d = hash((i + 1) * 7919 + (j + 1) * 104729 + sd);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// Seen from eye height 1.6 m with 60 LEDs to the metre at one metre off, the
// horizon on row HZ. The figure is 2.4 m tall and comes from 8 m to 1.75 m.
const FOC = 60, EYE = 1.6, TALL = 2.4, ZFAR = 8, ZNEAR = 1.75;
// Seconds at Speed 2 for the whole approach, and the least the eyes stay.
const TAPP = 6.4, TEYES = 2.3;
const MAXD = 900;

export function setup(params) {
  const S = (params.s = {
    t: 0, hue: 0, speed: 2, rain: 0, steps: 3,
    next: 0.5, ft: 9, k: 0, n: 0, cyc: 0, x0: 24, fig: null, face: false, eyes: -1,
    bolt: new Int16Array(800), nb: 0, bx: 32,
    drops: new Float32Array(MAXD * 3), base: new Float32Array(N * 3), lit: new Float32Array(N), fm: new Uint8Array(N), buf: new Float32Array(N * 3),
    fc: [0, 0, 0], ec: [0, 0, 0], colF: new Float32Array(W),
  });
  scene(S);
  for (let i = 0; i < MAXD; i++) {
    S.drops[i * 3] = Math.random() * 80;
    S.drops[i * 3 + 1] = Math.random() * H;
    S.drops[i * 3 + 2] = Math.random();
  }
}

// The still scene: its dark colours and how much of the flash each LED gives
// back. Clouds in the sky, wet grass below, and a lone tree and a fence line
// that stay black.
function scene(S) {
  const { base, lit } = S;
  const tree = new Uint8Array(N);
  // A bare tree on the horizon: a trunk and branches that fork twice.
  const limb = (x, y, a, len, w, d) => {
    for (let s = 0; s < len; s += 0.5) {
      const px = x + Math.sin(a) * s, py = y - Math.cos(a) * s;
      for (let i = -floor(w / 2); i <= floor((w - 1) / 2); i++) {
        const xx = round(px) + i, yy = round(py);
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) tree[yy * W + xx] = 1;
      }
    }
    if (d < 3) {
      const ex = x + Math.sin(a) * len, ey = y - Math.cos(a) * len;
      limb(ex, ey, a - 0.45 - 0.3 * hash(d * 7 + len), len * 0.68, max(1, w - 1), d + 1);
      limb(ex, ey, a + 0.5 + 0.25 * hash(d * 13 + len), len * 0.62, max(1, w - 1), d + 1);
    }
  };
  limb(10, HZ + 1, 0.05, 9, 2, 0);
  // Fence posts along the right, 1.9 m off, every 1.9 m, with two wires.
  const posts = [];
  for (let i = 0; i < 16; i++) {
    const z = 3.4 + 1.9 * i, x = 32 + (FOC * 1.9) / z, yb = HZ + (FOC * EYE) / z, h = (FOC * 1.15) / z;
    posts.push([x, yb, h]);
    for (let y = round(yb - h); y <= round(yb); y++)
      for (let xx = floor(x - max(0.5, 5 / z)); xx <= floor(x + max(0.5, 5 / z) - 0.01); xx++) if (xx >= 0 && xx < W && y < H) tree[y * W + xx] = 1;
  }
  for (let i = 0; i + 1 < posts.length; i++)
    for (const f of [0.9, 0.5]) {
      const [x1, y1, h1] = posts[i], [x2, y2, h2] = posts[i + 1];
      for (let s = 0; s <= 1; s += 0.05) {
        const xx = round(x1 + (x2 - x1) * s), yy = round(y1 - h1 * f + (y2 - h2 * f - y1 + h1 * f) * s);
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) tree[yy * W + xx] = 1;
      }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3;
      if (tree[p]) {
        (base[o] = 3), (base[o + 1] = 2), (base[o + 2] = 6), (lit[p] = 0);
        continue;
      }
      if (y < HZ) {
        // Clouds: two scales of noise, in five steps, heavier low down.
        const c = floor(cl(0.65 * vn2(x / 14, y / 7, 3) + 0.35 * vn2(x / 5, y / 3, 9) - 0.15 + y / 260, 0, 1) * 5) / 5;
        const g = y > HZ - 9 ? ((y - HZ + 9) / 9) ** 2 : 0;
        base[o] = 12 + 9 * c + 30 * g;
        base[o + 1] = 8 + 6 * c + 22 * g;
        base[o + 2] = 22 + 14 * c + 40 * g;
        lit[p] = 0.22 + 0.45 * c;
      } else {
        // The field: rows of wet grass closing up toward the horizon.
        const d = (y - HZ + 1) / (H - HZ), gr = floor(vn2(x / (2 + 3 * d), (y - HZ) / (1 + 2 * d), 21) * 3) / 3;
        base[o] = 5;
        base[o + 1] = 6;
        base[o + 2] = 10;
        lit[p] = (0.16 + 0.14 * gr) * (y < HZ + 3 ? 1.5 : 1);
      }
    }
}

// The figure, standing: rows of spans from the top of its head (v = 0) to
// its feet (v = 1), into the mask fm, centred on an LED so that it stays
// symmetric when small. A small head on a long neck, narrow shoulders, a
// thin trunk, long legs, and long arms that hang off the shoulders and
// spread a little to hands below the knee. A lean of the head and how far
// the arms stand off change from flash to flash.
function stand(S, cx, top, h, tilt, spread) {
  const fm = S.fm;
  fm.fill(0);
  cx = floor(cx) + 0.5;
  const span = (y, c, hw) => {
    for (let x = max(0, floor(cx + c - hw)); x <= min(W - 1, floor(cx + c + hw)); x++) if (abs(x + 0.5 - cx - c) <= hw + 0.02) fm[y * W + x] = 1;
  };
  const tw0 = max(0.5, 0.05 * h), aw0 = max(0.5, 0.017 * h), sh = tw0 + aw0 + 1.05, lc = max(1, 0.036 * h), lw = max(0.5, 0.022 * h);
  for (let y = max(0, floor(top)); y < min(H, top + h + 1); y++) {
    const v = (y + 0.5 - top) / h;
    if (v < 0 || v > 1.01) continue;
    if (v < 0.095) {
      const q = (v - 0.05) / 0.05;
      span(y, round(tilt * 0.02 * h * (1 - v * 10)), max(1, 0.042 * h * sqrt(max(0, 1 - q * q))));
    } else if (v < 0.13) span(y, 0, max(0.5, 0.013 * h));
    // Narrow shoulders, joining the arms to the trunk.
    else if (v < 0.13 + max(0.035, 1.1 / h)) span(y, 0, sh + 0.6);
    else {
      if (v < 0.53) span(y, 0, max(0.5, tw0 * (1 - 0.25 * (v - 0.13))));
      // The arms spread a little as they hang; the hands are thinner, with
      // a finger turned out.
      if (v < 0.84) {
        const s = (v - 0.13) / 0.71, hand = v > 0.76, aw = hand ? max(0.5, aw0 * 0.6) : aw0;
        for (const sg of [-1, 1]) {
          const c = sh + (max(1.6, 0.05 * h) + spread * (sg > 0 ? 1 : 0.5) * 0.04 * h) * s;
          span(y, sg * c, aw);
          if (hand && h > 40 && v > 0.79) span(y, sg * (c + 1 + (v - 0.79) * h * 0.5), 0.5);
        }
      }
      if (v >= 0.5) {
        span(y, -lc, lw);
        span(y, lc, lw);
        if (v > 0.985 && h > 30) (span(y, -lc - lw, lw), span(y, lc + lw, lw));
      }
    }
  }
}

// Right in front: a head from row 13 to row 66, leaning a little, on a thin
// neck, and narrow shoulders falling away to the edges.
const TILT = -0.12, EYEY = 38;
function close(S) {
  const fm = S.fm;
  fm.fill(0);
  for (let y = 0; y < H; y++) {
    const dy = (y - 39.5) / 26.5, rx = 19 * (dy > 0 ? 1 - 0.3 * dy * dy : 1), head = abs(dy) < 1 ? rx * sqrt(1 - dy * dy) : 0, hx = 32 + (y - EYEY) * TILT;
    const neck = y > 60 ? 6.5 : 0, sh = y > 82 ? 6.5 + (y - 82) * 1.6 : 0;
    for (let x = 0; x < W; x++) if (abs(x + 0.5 - hx) <= head || abs(x + 0.5 - 32) <= max(neck, sh)) fm[y * W + x] = 1;
  }
}

// A flash: what it shows, the bolt, and when the next one comes.
function flash(S) {
  const n = S.steps, k = S.k;
  S.ft = 0;
  S.face = false;
  S.fig = null;
  if (k < n) {
    if (k === 0) (S.cyc++), (S.x0 = 15 + 14 * hash(S.cyc * 31));
    const p = n > 1 ? k / (n - 1) : 1, z = ZFAR * pow(ZNEAR / ZFAR, p), h = (FOC * TALL) / z, feet = HZ + (FOC * EYE) / z;
    const sd = S.cyc * 17 + k;
    S.fig = 1;
    stand(S, S.x0 + (32 - S.x0) * p, feet - h, h, hash(sd) * 2 - 1, hash(sd + 5));
  } else if (k === n) (S.face = true), close(S), (S.eyes = 0);
  else S.fm.fill(0);
  // A bolt: a jagged walk down from the top with two forks, ending low in the
  // clouds or at the horizon.
  let x = (S.bx = 6 + 52 * Math.random()), nb = 0;
  const yEnd = Math.random() < 0.6 ? HZ - 1 : 34 + 24 * Math.random();
  const walk = (x, y, y1, dir, lim) => {
    while (y < y1 && nb < lim) {
      const ny = y + 2 + floor(Math.random() * 4), nx = x + dir * (Math.random() * 2.5) + (Math.random() - 0.5) * 5;
      for (let s = 0; s < 1; s += 0.2) if (nb < lim) (S.bolt[2 * nb] = round(x + (nx - x) * s)), (S.bolt[2 * nb + 1] = round(y + (ny - y) * s)), nb++;
      (x = nx), (y = ny);
      if (dir === 0 && Math.random() < 0.12 && y < y1 - 12) {
        const keep = [x, y];
        walk(x, y, y + 10 + 14 * Math.random(), Math.random() < 0.5 ? -1.6 : 1.6, min(400, nb + 60));
        [x, y] = keep;
      }
    }
  };
  walk(x, 0, yEnd, 0, 400);
  S.nb = nb;
  // The next flash.
  const d = TAPP / n, j = 0.85 + 0.3 * hash(S.n++ * 13 + 7);
  // Never more than two flashes a second, whatever the knobs.
  S.next = S.t + max(0.26 * S.speed, (k === n ? max(d, TEYES) : d) * j);
  S.k = k + 1 > n + 1 ? 0 : k + 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 3], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kn[0], 0, 1);
  S.speed = cl(kn[1], 0.2, 3);
  S.rain = cl(kn[2], 0, 1);
  S.steps = round(cl(kn[3], 3, 8));
  if (S.k > S.steps + 1) S.k = 0;
  S.t += (d * S.speed) / 2;
  S.ft += d;
  if (S.eyes >= 0) S.eyes += (d * S.speed) / 2;
  if (S.t >= S.next || (input.btnPressed && input.btnPressed[0] && S.ft > 0.6)) flash(S);
  // Rain falls 105 LEDs a second, slanting left.
  const dr = S.drops, cnt = 200 + floor(700 * S.rain);
  for (let i = 0; i < cnt; i++) {
    const o = i * 3, v = 80 + 50 * dr[o + 2];
    dr[o + 1] += v * d;
    dr[o] -= 0.22 * v * d;
    if (dr[o + 1] > H + 4) (dr[o + 1] -= H + 8), (dr[o] = Math.random() * 80);
  }
}

// How bright the flash is, s seconds after it starts: a stroke, and a second
// weaker one 0.2 s later.
const env = (s) => (s < 0 ? 0 : max(exp(-s / 0.2), 0.62 * sm((s - 0.17) / 0.05) * exp(-max(0, s - 0.22) / 0.24)));

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, base, lit, fm, colF } = S, F = env(S.ft), fc = hsv(0.76 + S.hue, 0.45, 1, S.fc), ec = hsv(0.3 + S.hue, 0.8, 1, S.ec);
  // The sky is brightest round the bolt.
  for (let x = 0; x < W; x++) colF[x] = F * (0.85 + 0.75 * exp(-abs(x - S.bx) / 12));
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    if (fm[p]) {
      buf[o] = buf[o + 1] = buf[o + 2] = 0;
      continue;
    }
    const l = lit[p] * colF[p & 63];
    buf[o] = base[o] + fc[0] * l;
    buf[o + 1] = base[o + 1] + fc[1] * l;
    buf[o + 2] = base[o + 2] + fc[2] * l;
  }
  // The bolt, white with a glow of the flash's tint, while the strokes last.
  if (F > 0.3) {
    const a = min(1, (F - 0.3) * 2.5);
    for (let i = 0; i < S.nb; i++) {
      const x = S.bolt[2 * i], y = S.bolt[2 * i + 1];
      if (x < 0 || x >= W || y < 0 || y >= HZ || fm[y * W + x]) continue;
      for (const dx of [-1, 1]) if (x + dx >= 0 && x + dx < W && !fm[y * W + x + dx]) add(buf, (y * W + x + dx) * 3, fc, 0.5 * a);
      const o = (y * W + x) * 3;
      buf[o] += (255 - buf[o]) * a;
      buf[o + 1] += (255 - buf[o + 1]) * a;
      buf[o + 2] += (255 - buf[o + 2]) * a;
    }
  }
  // Rain: dim streaks in the dark, near white in the flash. Two depths.
  const dr = S.drops, cnt = 200 + floor(700 * S.rain);
  for (let i = 0; i < cnt; i++) {
    const o = i * 3, near = dr[o + 2] > 0.6, len = near ? 4 : 2, br = near ? 1 : 0.6;
    const r = (30 + 0.9 * fc[0] * F) * br, g = (34 + 0.9 * fc[1] * F) * br, b = (50 + 0.9 * fc[2] * F) * br;
    for (let j = 0; j < len; j++) {
      const x = round(dr[o] + 0.22 * j), y = round(dr[o + 1] - j);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const q = (y * W + x) * 3, f = (1 - j / (len + 1)) * (fm[y * W + x] ? 0.35 : 1);
      buf[q] = max(buf[q], r * f);
      buf[q + 1] = max(buf[q + 1], g * f);
      buf[q + 2] = max(buf[q + 2], b * f);
    }
  }
  // The eyes, right in front, glowing on after the flash, blinking once.
  if (S.face && S.eyes >= 0) {
    const e = S.eyes, open = e < 0.08 ? e / 0.08 : abs(e - 1.1) < 0.08 ? 0.15 : e > TEYES - 0.3 ? max(0, (TEYES - e) / 0.3) : 1;
    if (open > 0)
      for (const cx of [24.5, 40.5])
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -6; dx <= 6; dx++) {
            // Round, with a slit, the outer corners lifted a little.
            const side = cx < 32 ? -1 : 1, y = EYEY + dy, x = floor(cx + dx), u = x + 0.5 - cx, lift = u * side > 1.5 ? 0.6 : 0;
            const r = (u / 3.3) ** 2 + ((dy + lift) / (2.4 * open + 0.3)) ** 2;
            if (r > 1.9) continue;
            const o = (y * W + x) * 3;
            if (r <= 1) add(buf, o, abs(u) < 0.6 && open > 0.5 ? [10, 10, 10] : r < 0.3 ? [255, 255, 235] : ec, 1);
            else add(buf, o, ec, 0.3 * open);
          }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3)
    display.setPixel(p & 63, p >> 6, min(255, round(buf[o] / 4) * 4), min(255, round(buf[o + 1] / 4) * 4), min(255, round(buf[o + 2] / 4) * 4));
}

function add(buf, o, c, a) {
  buf[o] += (c[0] - buf[o]) * a;
  buf[o + 1] += (c[1] - buf[o + 1]) * a;
  buf[o + 2] += (c[2] - buf[o + 2]) * a;
}
