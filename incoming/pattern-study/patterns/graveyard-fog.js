// ===== Patternflow pattern =====
// Title:   Graveyard Fog
// Family:  halloween
// Idea:    Banks of ground fog roll sideways at three depths through a night graveyard of black headstones, a cross, a leaning stone and a crooked iron fence under a thin crescent moon, the mist carrying a fine one-LED dither like suspended droplets, while small toxic-green will-o'-wisps bob and drift between the stones and light the fog round them.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wisps=4..14, Fog=0..1
//
// Knob 1: Hue. Turns the fog, the sky and the wisps round the wheel together. At 0 the fog is a cold periwinkle under a deep violet sky and the wisps are toxic green; at 0.25 the fog goes rose and the wisps sky blue; at 0.6 the fog is green under a dark green sky and the wisps pink. From about 0.2 to 0.53, where the sky would come out maroon, brown or olive, it is held purple instead.
// Knob 2: Speed. How fast the fog rolls: at 2 the front bank slides 9 LEDs a second, the middle one 4.5 and the far one 2.5, and a wisp bobs once in about 4 seconds; at 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Wisps. How many will-o'-wisps there are, 4 to 14. Each one floats at its own depth, so a stone or the fence can hide it as it passes, and lights the fog for about 10 LEDs round it. Every wisp past the fourth also gives all the fog 3% of their green, so at 14 the banks have a green cast.
// Knob 4: Fog. How high and thick the banks stand. Near 0 the front bank reaches the knees of the near stones; at 1 it climbs past the crossbar of the cross, the middle bank swallows the fence, the far bank rises half again and the haze over the sky thickens by a third.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, sin, cos, exp, round, PI } = Math;
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
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Value noise on a 256 x 256 lattice of fixed random values.
const NT = new Float32Array(65536);
for (let i = 0; i < 65536; i++) NT[i] = hash(i * 7 + 3);
function vn(x, y) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  const a = NT[y0 + x0], b = NT[y0 + x1], c = NT[y1 + x0], d = NT[y1 + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ---- The graveyard, built once as coverage masks (4 x 4 samples per LED).
// Far row: small stones standing on a low rise at row 84.
const FAR_BASE = 84;
// Front row: three big stones on the ground at row 125.
const FRONT_BASE = 125;
// The fence stands on row 111.
const FENCE_BASE = 111;

function roundStone(px, py, cx, base, w, h, lean) {
  const dx = px - cx, dy = py - base, c = cos(lean), s = sin(lean);
  const lx = dx * c - dy * s, ly = dx * s + dy * c, r = w / 2;
  if (ly > 1 || abs(lx) > r || ly < -h) return false;
  const top = -h + r;
  return ly >= top || lx * lx + (ly - top) * (ly - top) <= r * r;
}
function gableStone(px, py, cx, base, w, h, peak) {
  const dx = abs(px - cx), up = base - py;
  if (up < -1 || up > h || dx > w / 2) return false;
  return up <= h - peak || dx <= ((w / 2) * (h - up)) / peak;
}
function cross(px, py, cx, base, h, bw, aw, ay, at) {
  const dx = abs(px - cx), up = base - py;
  if (up < -1) return false;
  if (up <= h && dx <= bw / 2) return true;
  if (dx <= aw / 2 && abs(up - ay) <= at / 2) return true;
  return up <= 4 && dx <= 6.5;
}

function farInside(px, py) {
  if (py >= FAR_BASE + 1.5 * sin(px * 0.16 + 1)) return true;
  return (
    roundStone(px, py, 4, FAR_BASE + 1, 7, 10, -0.05) ||
    cross(px, py, 16, FAR_BASE + 1, 14, 2.4, 8, 10, 2.2) ||
    gableStone(px, py, 26.5, FAR_BASE + 1, 6, 9, 3) ||
    roundStone(px, py, 38, FAR_BASE + 1, 8, 11, 0.12) ||
    gableStone(px, py, 50, FAR_BASE + 1, 3.4, 15, 4) ||
    roundStone(px, py, 60, FAR_BASE + 1, 6, 8, 0)
  );
}

function frontInside(px, py) {
  if (py >= FRONT_BASE + 1.2 * sin(px * 0.11 + 2)) return true;
  return (
    roundStone(px, py, 11.5, FRONT_BASE + 1, 15, 31, -0.03) ||
    cross(px, py, 32, FRONT_BASE + 1, 39, 5, 18, 29, 5) ||
    roundStone(px, py, 51.5, FRONT_BASE + 1, 13, 27, 0.24)
  );
}

// The fence: thin iron pickets with spear tips, leaning this way and that,
// on two sagging rails; one picket snapped short and one gone.
const PICKETS = [];
for (let i = 0; i < 13; i++) {
  if (i === 9) continue;
  PICKETS.push({
    x: 2.5 + 5 * i + (hash(i * 5 + 1) - 0.5) * 1.2,
    lean: (hash(i * 5 + 2) - 0.5) * 0.16,
    top: FENCE_BASE - 18 + (hash(i * 5 + 3) - 0.5) * 3 + (i === 5 ? 7 : 0),
    tip: i !== 5,
  });
}
const RAILS = [FENCE_BASE - 5, FENCE_BASE - 14].map((y0, r) => PICKETS.map((p, i) => y0 + (hash(i * 11 + r * 3 + 7) - 0.5) * 2.4));
function fenceInside(px, py) {
  if (py > FENCE_BASE + 0.5) return false;
  for (const p of PICKETS) {
    const cx = p.x + p.lean * (FENCE_BASE - py);
    if (py >= p.top && abs(px - cx) <= 0.62) return true;
    if (p.tip && py < p.top && py >= p.top - 3.2 && abs(px - cx) <= ((py - (p.top - 3.2)) / 3.2) * 1.7) return true;
  }
  for (const rail of RAILS)
    for (let i = 0; i + 1 < PICKETS.length; i++) {
      const a = PICKETS[i], b = PICKETS[i + 1];
      if (px < a.x || px > b.x) continue;
      const f = (px - a.x) / (b.x - a.x), y = rail[i] + (rail[i + 1] - rail[i]) * f;
      if (abs(py - y) <= 0.62) return true;
    }
  return false;
}

function buildMask(inside) {
  const m = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (inside(x + (i + 0.5) / 4, y + (j + 0.5) / 4)) c++;
      m[y * W + x] = c / 16;
    }
  return m;
}

// The crescent: a disc of radius 6.5 with a slightly smaller one cut from its
// lower left, so a thin bow is left on the upper right.
const MOON_X = 47, MOON_Y = 19;
function moonInside(px, py) {
  const a = (px - MOON_X) ** 2 + (py - MOON_Y) ** 2, b = (px - MOON_X + 2.6) ** 2 + (py - MOON_Y - 1.4) ** 2;
  return a <= 6.5 * 6.5 && b > 6.1 * 6.1;
}

// Fog banks, back to front: the row they lie on, how high they stand at the
// opening, how fast they slide at Speed 2 (LEDs a second), how much the Fog
// knob raises them, how bright they are and how thick, and how big their
// billows are.
const BANKS = [
  { base: 86, h: 18, v: 2.5, rise: 0.5, lum: 0.62, op: 0.8, sx: 12, sy: 7, seed: 17 },
  { base: 114, h: 22, v: 4.5, rise: 1.3, lum: 0.8, op: 0.84, sx: 15, sy: 8, seed: 59 },
  { base: 131, h: 20, v: 9, rise: 2, lum: 1, op: 0.9, sx: 17, sy: 9, seed: 101 },
];
// Wisp depth slots: 0 behind the far stones, 1 between them and the fence,
// 2 between the fence and the near stones, 3 in front of everything. Each
// slot has the rows a wisp there floats at.
const SLOT_ROWS = [[72, 80], [86, 100], [98, 112], [108, 120]];
const WMAX = 14;
// Grain: neighbouring LEDs alternate half a step above and below the fog,
// so the mist carries a fine ordered dither. GRAIN is the half step at full
// fog, in levels of 255.
const GRAIN = 16, AIR = 0.2;

export function setup(params) {
  const wisps = [];
  // The first four, the opening count, take slots 1, 2, 3 and 1 and are
  // spread across the width; the rest are placed at random.
  const open = [[1, 10], [2, 44], [3, 24], [1, 56]];
  for (let i = 0; i < WMAX; i++) {
    const slot = i < 4 ? open[i][0] : floor(Math.random() * 4);
    const [r0, r1] = SLOT_ROWS[slot];
    wisps.push({
      slot,
      x0: i < 4 ? open[i][1] : Math.random() * W,
      y0: r0 + Math.random() * (r1 - r0),
      dir: Math.random() < 0.5 ? -1 : 1,
      v: 1.2 + Math.random() * 2,
      ph: Math.random() * 2 * PI,
      bob: 2 + Math.random() * 2.5,
      flick: 0.6 + Math.random() * 0.8,
    });
  }
  params.s = {
    hue: 0, speed: 2, count: 4, fog: 0.06, t: 0,
    far: buildMask(farInside), fence: buildMask(fenceInside), front: buildMask(frontInside), moon: buildMask(moonInside),
    wisps, wx: new Float32Array(WMAX), wy: new Float32Array(WMAX), wb: new Float32Array(WMAX),
    // Light the wisps cast on the fog, and their own glow at each depth.
    lit: new Float32Array(N), glow: [new Float32Array(N), new Float32Array(N), new Float32Array(N), new Float32Array(N)],
    tops: [new Float32Array(W), new Float32Array(W), new Float32Array(W)],
    sky: new Float32Array(H * 3), fogC: [0, 0, 0], wispC: [0, 0, 0], hazeC: [0, 0, 0], colHue: NaN,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.count = round(cl(k[2], 4, WMAX));
  S.fog = cl(k[3], 0, 1);
  // The pattern's clock: one unit a second at Speed 2.
  S.t += (d * S.speed) / 2;
  const t = S.t;
  for (let i = 0; i < WMAX; i++) {
    const w = S.wisps[i];
    // Drift with the fog plus a slow wander, wrapping round the width.
    let x = w.x0 + w.dir * w.v * t + 7 * sin(0.5 * t + w.ph);
    x = ((((x + 8) % (W + 16)) + (W + 16)) % (W + 16)) - 8;
    S.wx[i] = x;
    S.wy[i] = w.y0 + w.bob * sin(1.6 * t + w.ph) + 1.1 * sin(3.7 * t + 2 * w.ph);
    S.wb[i] = 0.82 + 0.18 * sin(w.flick * 9 * t + w.ph) * sin(w.flick * 5.3 * t);
  }
}

function palette(S) {
  const h = S.hue;
  // Fog: cold periwinkle at Hue 0.
  hsv(h + 0.68, 0.32, 1, S.fogC);
  // Wisps: toxic yellow-green at Hue 0, always 0.6 of the wheel from the fog.
  hsv(h + 0.28, 0.82, 1, S.wispC);
  // Sky: a deep version of the fog's hue, a little further round. A dark
  // sky from red through orange to yellow-green reads maroon, brown or
  // olive, so across that stretch it is blended over to purple (0.8).
  const sh = h + 0.73, dw = abs(((sh - 0.09 + 10.5) % 1) - 0.5), w = 1 - sm(0.17, 0.21, dw);
  const c = [0, 0, 0], e = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    // Darkest at the top, a hazy glow toward the horizon at row 80.
    const u = sm(0, 84, y), sat = 0.75 - 0.2 * u, val = 0.1 + 0.22 * u * u;
    hsv(sh, sat, val, c);
    hsv(0.8, sat, val, e);
    for (let i = 0; i < 3; i++) S.sky[y * 3 + i] = (c[i] + (e[i] - c[i]) * w) * 255;
  }
  hsv(sh, 0.45, 0.5, c);
  hsv(0.8, 0.45, 0.5, e);
  for (let i = 0; i < 3; i++) S.hazeC[i] = c[i] + (e[i] - c[i]) * w;
  S.colHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.colHue !== S.hue) palette(S);
  const { far, fence, front, moon, lit, glow, tops, sky, fogC, wispC, hazeC, t } = S;
  const fog = S.fog, thick = 0.88 + 0.12 * fog;
  // Every wisp past the first four adds 3% of their green to all the fog.
  const amb = 0.03 * (S.count - 4), dropOff = 1.5 * t;

  // Each bank's top edge along the width: its height times a billow that
  // slides with it.
  for (let b = 0; b < 3; b++) {
    const B = BANKS[b], off = B.v * t, tp = tops[b], rise = 0.8 + B.rise * fog;
    for (let x = 0; x < W; x++) tp[x] = B.base - B.h * rise * (0.45 + 0.8 * vn((x + off) / B.sx, B.seed + 0.13 * t));
  }

  // Wisp light.
  lit.fill(0);
  for (const g of glow) g.fill(0);
  for (let i = 0; i < S.count; i++) {
    const wx = S.wx[i], wy = S.wy[i], wb = S.wb[i], g = glow[S.wisps[i].slot], R = 13;
    for (let y = max(0, floor(wy - R)); y <= min(H - 1, floor(wy + R)); y++)
      for (let x = max(0, floor(wx - R)); x <= min(W - 1, floor(wx + R)); x++) {
        const dx = x + 0.5 - wx, dy = y + 0.5 - wy, d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const p = y * W + x;
        lit[p] += wb * exp(-d2 / 70);
        g[p] += wb * (sm(2.2, 0.8, sqrt(d2)) + 0.45 * exp(-d2 / 7));
      }
  }

  const hazeOff = 1.6 * t;
  for (let y = 0; y < H; y++) {
    const sr = sky[y * 3], sg = sky[y * 3 + 1], sb = sky[y * 3 + 2];
    // High haze: thin at the top, thicker toward the horizon, in slow streaks.
    const hz = (0.3 + 0.5 * sm(0, 90, y)) * (0.7 + 0.6 * fog);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = sr, g = sg, b = sb;
      // The moon and a faint halo round it.
      const md = (x + 0.5 - MOON_X) ** 2 + (y + 0.5 - MOON_Y) ** 2;
      if (md < 400) {
        const halo = 30 * exp(-md / 90);
        r += halo;
        g += halo;
        b += halo * 0.9;
      }
      const mo = moon[p];
      if (mo > 0) {
        r += (250 - r) * mo;
        g += (240 - g) * mo;
        b += (205 - b) * mo;
      }
      // Mist in view along the line of sight, for the grain: the night air
      // itself counts for AIR, then the haze and banks add to it.
      let seen = 0;
      const ha = min(0.85, hz * (0.15 + 1.3 * vn((x + hazeOff) / 21, y / 5 + 40)));
      r += (hazeC[0] * 255 - r) * ha;
      g += (hazeC[1] * 255 - g) * ha;
      b += (hazeC[2] * 255 - b) * ha;
      seen = AIR + (1 - AIR) * ha;
      for (let layer = 0; layer < 3; layer++) {
        // Wisps at this depth, then this depth's silhouettes, then the bank in front of them.
        const gl = glow[layer];
        if (gl[p] > 0) {
          const a = min(1, gl[p]);
          r += (wispC[0] * 255 + 120 - r) * a;
          g += (wispC[1] * 255 + 120 - g) * a;
          b += (wispC[2] * 255 + 120 - b) * a;
        }
        const m = layer === 0 ? far[p] : layer === 1 ? fence[p] : front[p];
        if (m > 0) {
          const sc = layer === 0 ? 0.11 : layer === 1 ? 0.05 : 0.025;
          r += (hazeC[0] * 255 * sc - r) * m;
          g += (hazeC[1] * 255 * sc - g) * m;
          b += (hazeC[2] * 255 * sc - b) * m;
          seen *= 1 - m;
        }
        const B = BANKS[layer], top = tops[layer][x];
        if (y > top - 6) {
          const body = sm(top - 6, top + 8, y) * (0.3 + 1.0 * vn((x + B.v * 1.35 * t) / (B.sx * 0.6), y / B.sy + B.seed - 0.25 * t));
          const a = min(0.95, body * B.op * thick);
          if (a > 0) {
            const L = lit[p] + amb, lv = B.lum * 255, keep = 1 - 0.25 * min(1, L);
            const fr = fogC[0] * lv * keep + wispC[0] * 230 * L;
            const fg = fogC[1] * lv * keep + wispC[1] * 230 * L;
            const fb = fogC[2] * lv * keep + wispC[2] * 230 * L;
            r += (fr - r) * a;
            g += (fg - g) * a;
            b += (fb - b) * a;
            seen = seen + (1 - seen) * a;
          }
        }
      }
      if (glow[3][p] > 0) {
        const a = min(1, glow[3][p]);
        r += (wispC[0] * 255 + 120 - r) * a;
        g += (wispC[1] * 255 + 120 - g) * a;
        b += (wispC[2] * 255 + 120 - b) * a;
      }
      r = min(255, r);
      g = min(255, g);
      b = min(255, b);
      // The grain: half a step up on one colour of the checker, half down on
      // the other, scaled by the fog in view and kept inside 0..255.
      const m = max(r, g, b, 1);
      // Droplets: the half step swells and shrinks over a few LEDs, and that
      // pattern drifts with the air, so the dither reads as moving mist
      // rather than a ruled grid.
      const drop = 0.7 + 0.3 * vn((x + dropOff) / 2.3, y / 2.3 + 90);
      const amp = min(GRAIN * min(1, 2.4 * seen) * drop, 0.45 * m, 0.45 * (255 - m));
      const f = (m + ((x + y) & 1 ? amp : -amp)) / m;
      display.setPixel(x, y, round(r * f), round(g * f), round(b * f));
    }
  }
}
