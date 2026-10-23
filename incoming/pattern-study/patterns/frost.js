// ===== Patternflow pattern =====
// Title:   Frost
// Family:  fractal
// Idea:    Frost ferns grow across a dark window pane at night from the sill and the frame, feathery and glittering, while a street lamp and falling snow glow dimly through the glass; then the room warms, the middle of the pane thaws, and the cold draws the ferns in again.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: diffusion-limited aggregation (Witten and Sander, 1981), after fern frost on a single-glazed window
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Lamp=0..1, Speed=0.2..3, Rime=0..1, Glitter=0..1
//
// Knob 1: Lamp. The street light behind the glass, from a sodium lamp's amber through warm and cold white to a mercury lamp's blue-green and a pink shop sign; the snow clouds, the street and the frost near the lamp take its colour.
// Knob 2: Speed. How fast the frost grows: at 2 about forty crystals freeze each second and the pane is frosted over 17 seconds after the panel opens; at 0.2 the ferns have only begun.
// Knob 3: Rime. How readily vapour sticks where it touches the frost: at 0 every touch counts and the ferns grow thin and feathery; turned up, most touches bounce off and wander deeper in, and the frost packs into a dense white crust along the frame.
// Knob 4: Glitter. How hard the crystal faces flash as they turn to the light, from a matte frost to every fern sparkling.
// Buttons: K1 tap breathes on the glass: a round patch in the middle clears, wet for a moment, and the ferns grow back into it from its rim.

const W = 64;
const H = 128;
const N = W * H;
// The distance to the nearest frost, in LEDs (the larger of the two axis
// steps), is kept for every LED up to this far. A walker that far out can
// jump that far in one go without passing any frost.
const CAP = 9;
// A walker starts only where the frost is at least this far off. When none
// can, the pane is full.
const LAUNCH = 4;
// Hits an LED next to the frost takes before it freezes. One is Witten and
// Sander's rule, and its ferns wander like lichen; three average out the
// walkers' noise, the way Nittmann and Stanley grew snowflakes in 1986, and
// the ferns run straight along the diagonals with side branches like a feather.
const HITS = 3;
// Crystals frozen each second at Speed 1.
const RATE = 21;
// Seconds of growth the pane has had when the panel opens.
const PRE = 15;
// Walker steps a frame may spend; a walker left over carries on next frame.
const BUDGET = 9000;
// The street lamp's head, seen through the glass in the middle of the pane,
// where the frost reaches last.
const LX = 34;
const LY = 44;
// The lamps K1 runs through: sodium amber, warm white, cold white, mercury
// blue-green, a pink sign.
const LAMPS = [
  [255, 140, 24],
  [255, 196, 120],
  [150, 190, 255],
  [100, 255, 210],
  [255, 60, 190],
];
// The ice: a cold blue-white.
const ICE = [105, 165, 255];
const FLAKES = 46;
// Lit windows in the houses across the road.
const WINDOWS = [
  [10, 86],
  [53, 90],
];
// The glass's own grain: each LED of the street seen through it is off by up
// to half this, channel by channel.
const GRAIN = 9;

// Seconds the full pane holds before the room warms, the seconds the thaw
// takes, and how far it reaches: 0 is the middle of the pane, 1 the middle
// of each side.
const HOLD_S = 4;
const MELT_S = 6;
const THAW = 0.85;

const GROW = 0;
const HOLD = 1;
const MELT = 2;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function lampColour(k, out) {
  const u = clamp(k, 0, 1) * (LAMPS.length - 1);
  const i = Math.min(LAMPS.length - 2, Math.floor(u));
  const f = u - i;
  for (let c = 0; c < 3; c++) out[c] = (LAMPS[i][c] * (1 - f) + LAMPS[i + 1][c] * f) / 255;
}

// Freeze one LED: mark it and pull the distance field in round it.
function freeze(P, p) {
  const { frost, dist } = P;
  frost[p] = 1;
  P.born[p] = P.clock;
  const x0 = p % W;
  const y0 = (p / W) | 0;
  const ya = Math.max(0, y0 - CAP);
  const yb = Math.min(H - 1, y0 + CAP);
  const xa = Math.max(0, x0 - CAP);
  const xb = Math.min(W - 1, x0 + CAP);
  for (let y = ya; y <= yb; y++) {
    const dy = y > y0 ? y - y0 : y0 - y;
    const row = y * W;
    for (let x = xa; x <= xb; x++) {
      const dx = x > x0 ? x - x0 : x0 - x;
      const d = dx > dy ? dx : dy;
      if (d < dist[row + x]) dist[row + x] = d;
    }
  }
}

// The whole distance field again, after frost melts: two passes over the pane.
function measureDistance(P) {
  const { frost, dist } = P;
  for (let p = 0; p < N; p++) dist[p] = frost[p] ? 0 : CAP;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let d = dist[p];
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[p - 1] + 1);
      if (y > 0) {
        d = Math.min(d, dist[p - W] + 1);
        if (x > 0) d = Math.min(d, dist[p - W - 1] + 1);
        if (x < W - 1) d = Math.min(d, dist[p - W + 1] + 1);
      }
      dist[p] = d;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x;
      let d = dist[p];
      if (d === 0) continue;
      if (x < W - 1) d = Math.min(d, dist[p + 1] + 1);
      if (y < H - 1) {
        d = Math.min(d, dist[p + W] + 1);
        if (x > 0) d = Math.min(d, dist[p + W - 1] + 1);
        if (x < W - 1) d = Math.min(d, dist[p + W + 1] + 1);
      }
      dist[p] = d;
    }
}

// The frame is cold first: the sill along the bottom freezes all along, the
// sides here and there below row 36, the top in a few places.
function seed(P) {
  P.frost.fill(0);
  P.hits.fill(0);
  P.dist.fill(CAP);
  for (let x = 0; x < W; x++) freeze(P, (H - 1) * W + x);
  for (let y = H - 2; y > 36; y -= 3 + Math.floor(Math.random() * 6)) freeze(P, y * W);
  for (let y = H - 2; y > 36; y -= 3 + Math.floor(Math.random() * 6)) freeze(P, y * W + W - 1);
  for (let x = 2; x < W - 2; x += 9 + Math.floor(Math.random() * 14)) freeze(P, x);
  P.walking = false;
}

// A walker starts anywhere on the glass at least LAUNCH from the frost.
function launch(P) {
  const dist = P.dist;
  for (let tries = 0; tries < 200; tries++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    if (dist[y * W + x] >= LAUNCH) {
      P.wx = x;
      P.wy = y;
      P.walking = true;
      return true;
    }
  }
  return false;
}

// Vapour as random walkers, one at a time, until `want` crystals have frozen
// or the step budget runs out. Returns false when no walker can start: the
// pane is full.
function walk(P, want, stick, budget) {
  const dist = P.dist;
  const frost = P.frost;
  let made = 0;
  let x = P.wx;
  let y = P.wy;
  while (made < want && budget > 0) {
    if (!P.walking) {
      if (!launch(P)) return false;
      x = P.wx;
      y = P.wy;
    }
    budget--;
    const p = y * W + x;
    const d = dist[p];
    if (d === 1 && Math.random() < stick) {
      if (++P.hits[p] >= HITS) {
        freeze(P, p);
        made++;
      }
      P.walking = false;
      continue;
    }
    if (d >= 3) {
      // Far from the frost: land anywhere on the square ring d - 1 out, which
      // the walk would have to cross anyway.
      const r = d - 1;
      const s = Math.floor(Math.random() * 8 * r);
      const side = (s / (2 * r)) | 0;
      const o = (s % (2 * r)) - r;
      if (side === 0) {
        x += o;
        y -= r;
      } else if (side === 1) {
        x += r;
        y += o;
      } else if (side === 2) {
        x -= o;
        y += r;
      } else {
        x -= r;
        y -= o;
      }
    } else {
      const s = Math.floor(Math.random() * 4);
      let nx = x + (s === 0 ? 1 : s === 1 ? -1 : 0);
      let ny = y + (s === 2 ? 1 : s === 3 ? -1 : 0);
      if (nx < 0) nx = 1;
      if (nx >= W) nx = W - 2;
      if (ny < 0) ny = 1;
      if (ny >= H) ny = H - 2;
      if (!frost[ny * W + nx]) {
        x = nx;
        y = ny;
      }
    }
    if (x < 0) x = -x;
    if (x >= W) x = 2 * (W - 1) - x;
    if (y < 0) y = -y;
    if (y >= H) y = 2 * (H - 1) - y;
    x = clamp(x, 0, W - 1);
    y = clamp(y, 0, H - 1);
  }
  P.wx = x;
  P.wy = y;
  return true;
}

export function setup(params) {
  const P = params;
  P.frost = new Uint8Array(N);
  P.hits = new Uint8Array(N);
  P.dist = new Uint8Array(N);
  P.born = new Float32Array(N);
  P.thaw = new Float32Array(N);
  P.bg = new Float32Array(N * 3);
  P.base = new Float32Array(N * 3);
  // Each LED of the pane has its own crystal face: how much light it sends
  // back, a tint per channel, and a time when it flashes.
  P.facet = new Float32Array(N);
  P.tint = new Float32Array(N * 3);
  P.spin = new Float32Array(N);
  P.phase = new Float32Array(N);
  P.grain = new Float32Array(N * 3);
  for (let p = 0; p < N; p++) {
    P.facet[p] = hash(p, 1);
    for (let c = 0; c < 3; c++) {
      P.tint[p * 3 + c] = 0.86 + 0.28 * hash(p, 2 + c);
      P.grain[p * 3 + c] = hash(p, 5 + c) - 0.5;
    }
    P.spin[p] = 2 + 7 * hash(p, 8);
    P.phase[p] = 6.283 * hash(p, 9);
  }
  // What the lamp does at each LED: how much of it the ice scatters back, how
  // far the film between the ferns spreads it, and the lamp's own head.
  P.lit = new Float32Array(N);
  P.haze = new Float32Array(N);
  P.core = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const d2 = ((p % W) - LX) ** 2 + (((p / W) | 0) - LY) ** 2;
    P.lit[p] = Math.exp(-d2 / 1500);
    P.haze[p] = Math.exp(-d2 / 4500);
    P.core[p] = 235 * Math.exp(-d2 / 5);
  }
  P.fx = new Float32Array(FLAKES);
  P.fy = new Float32Array(FLAKES);
  P.fz = new Float32Array(FLAKES);
  for (let i = 0; i < FLAKES; i++) {
    P.fx[i] = Math.random() * W;
    P.fy[i] = Math.random() * H;
    P.fz[i] = 0.4 + 0.6 * Math.random();
  }
  P.lamp = new Float32Array(3);
  Object.assign(P, { clock: 0, owed: 0, phaseOf: GROW, timer: 0, wx: 0, wy: 0, walking: false, started: false, baked: -1 });
  seed(P);
}

function startMelt(P) {
  P.phaseOf = MELT;
  P.timer = 0;
  // The room warms the middle of the pane first: the frost melts from there
  // out toward the frame, and the corners and the sill keep theirs.
  const { frost, thaw } = P;
  for (let p = 0; p < N; p++) {
    if (!frost[p]) continue;
    const x = (p % W) - 32;
    const y = ((p / W) | 0) - 58;
    thaw[p] = Math.sqrt((x / 32) ** 2 + (y / 66) ** 2) + 0.2 * hash(p, 11);
  }
}

function step(P, dt, speed, stick) {
  P.clock += dt;
  if (P.phaseOf === GROW) {
    P.owed += RATE * speed * (1 + 1.5 * P.rime) * dt;
    const want = Math.floor(P.owed);
    P.owed -= want;
    if (want > 0 && !walk(P, want, stick, BUDGET)) {
      P.phaseOf = HOLD;
      P.timer = 0;
    }
  } else if (P.phaseOf === HOLD) {
    P.timer += dt;
    if (P.timer > HOLD_S) startMelt(P);
  } else {
    P.timer += dt;
    const front = THAW * smooth(0, MELT_S, P.timer);
    const { frost, thaw } = P;
    let changed = false;
    for (let p = 0; p < N; p++)
      if (frost[p] && thaw[p] < front) {
        frost[p] = 0;
        P.born[p] = P.clock;
        changed = true;
      }
    if (changed) measureDistance(P);
    if (P.timer > MELT_S + 0.5) {
      // The cold comes back and the ferns grow in again from what is left.
      P.phaseOf = GROW;
      P.hits.fill(0);
      P.walking = false;
    }
  }
}

function breathe(P) {
  // A warm breath on the middle of the pane: a ragged round patch clears.
  const { frost } = P;
  const cx = 32;
  const cy = 60;
  for (let p = 0; p < N; p++) {
    if (!frost[p]) continue;
    const x = p % W;
    const y = (p / W) | 0;
    const r = Math.sqrt((x - cx) ** 2 + ((y - cy) * 0.8) ** 2);
    if (r < 22 + 4 * hash(p, 12)) {
      frost[p] = 0;
      P.born[p] = P.clock;
    }
  }
  measureDistance(P);
  P.walking = false;
  if (P.phaseOf !== GROW) P.phaseOf = GROW;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  const speed = clamp(k[1], 0.1, 4);
  const rime = clamp(k[2], 0, 1);
  P.rime = rime;
  // The chance a walker that touches the frost freezes there.
  const stick = 1 - 0.95 * Math.sqrt(rime);
  P.glitter = clamp(k[3], 0, 1);
  if (Math.abs(P.baked - k[0]) > 0.002) {
    lampColour(k[0], P.lamp);
    bake(P, k[0]);
  }
  if (!P.started) {
    P.started = true;
    // The pane has been freezing for fifteen seconds of Speed when the panel
    // opens, so the knobs have already shaped the frost.
    const n = Math.round(PRE * RATE * speed * (1 + 1.5 * rime));
    walk(P, n, stick, 1e9);
    P.clock = 0;
    for (let p = 0; p < N; p++) P.born[p] = -9;
  }
  if (input.btnPressed && input.btnPressed[0]) breathe(P);
  step(P, dt, speed, stick);
  // Snow outside, falling past the lamp.
  for (let i = 0; i < FLAKES; i++) {
    P.fy[i] += dt * (5 + 9 * P.fz[i]);
    P.fx[i] += dt * (1.2 * Math.sin(P.clock * 0.7 + i) + 0.8);
    if (P.fy[i] > H + 3) {
      P.fy[i] = -3;
      P.fx[i] = Math.random() * W;
    }
    if (P.fx[i] > W + 3) P.fx[i] -= W + 6;
  }
}

// The street behind the glass, out of focus: snow clouds, the roofs across
// the road with two windows lit, the lamp's glow and its pool on the snow.
// It is drawn again only when the lamp changes.
function bake(P, key) {
  const base = P.base;
  const L = P.lamp;
  const grain = P.grain;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const roofY = 74 + 3 * Math.sin(x * 0.13 + 1) - 10 * smooth(8, 12, x) * (1 - smooth(22, 26, x)) - 6 * smooth(44, 47, x);
      const dx = x - LX;
      const dy = y - LY;
      const d2 = dx * dx + dy * dy;
      let r;
      let g;
      let b;
      if (y < roofY) {
        // Snow clouds hang low and give back the street lights: navy
        // overhead, the lamp's own colour down at the roofs.
        const h = smooth(0, roofY, y);
        const glow = 4 + 15 * h * h;
        r = 3 * (1 - h) + glow * L[0];
        g = 5 * (1 - h) + glow * L[1];
        b = 15 * (1 - h) + glow * L[2];
        // Snow lies along the roof edges.
        const lip = Math.exp(-((y - roofY + 1.5) ** 2) / 2);
        r += 8 * lip;
        g += 9 * lip;
        b += 11 * lip;
      } else if (y < 102) {
        // The houses opposite, dark, with two windows lit by the rooms inside.
        let win = 0;
        for (const [wx, wy] of WINDOWS) {
          const u = (x - wx) / 3.2;
          const v = (y - wy) / 4;
          win += Math.exp(-(u * u + v * v) * 2);
        }
        r = 3 + 4 * L[0] + 17 * win;
        g = 3 + 4 * L[1] + 12 * win;
        b = 5 + 4 * L[2] + 5 * win;
      } else {
        // Snow on the street, in a pool of light under the lamp.
        const pool = Math.exp(-(dx * dx) / 260 - ((y - 114) ** 2) / 180);
        r = 3 + (9 + 12 * pool) * L[0];
        g = 4 + (9 + 12 * pool) * L[1];
        b = 6 + (9 + 12 * pool) * L[2];
      }
      // The lamp's glow through the glass.
      const glow = 16 / (1 + d2 / 50);
      r += glow * L[0];
      g += glow * L[1];
      b += glow * L[2];
      // Its pole, dark against the glow.
      if (x >= LX - 1 && x <= LX && y > LY + 2 && y < 106) {
        r *= 0.45;
        g *= 0.45;
        b *= 0.45;
      }
      base[p * 3] = r + GRAIN * grain[p * 3];
      base[p * 3 + 1] = g + GRAIN * grain[p * 3 + 1];
      base[p * 3 + 2] = b + GRAIN * grain[p * 3 + 2];
    }
  P.baked = key;
}

// Flakes falling past the window, soft and dim, brighter as they pass the lamp.
function paintSnow(P) {
  const bg = P.bg;
  const L = P.lamp;
  bg.set(P.base);
  for (let i = 0; i < FLAKES; i++) {
    const fx = P.fx[i];
    const fy = P.fy[i];
    const near = Math.exp(-((fx - LX) ** 2 + (fy - LY) ** 2) / 500);
    const v = (4 + 10 * near) * P.fz[i];
    const xa = Math.max(0, Math.floor(fx - 2));
    const xb = Math.min(W - 1, Math.ceil(fx + 2));
    const ya = Math.max(0, Math.floor(fy - 2));
    const yb = Math.min(H - 1, Math.ceil(fy + 2));
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const w = v * Math.exp(-((x - fx) ** 2 + (y - fy) ** 2) / 1.6);
        const q = (y * W + x) * 3;
        bg[q] += w * (0.7 + 0.3 * L[0]);
        bg[q + 1] += w * (0.7 + 0.3 * L[1]);
        bg[q + 2] += w * (0.8 + 0.2 * L[2]);
      }
  }
}

function byte(v) {
  return v > 255 ? 255 : v < 0 ? 0 : v | 0;
}

export function draw(display, params) {
  const P = params;
  if (!P.bg) return;
  paintSnow(P);
  const { bg, frost, dist, facet, tint, born, spin, phase, lamp, lit, haze, core } = P;
  const t = P.clock;
  const gl = P.glitter;
  for (let p = 0; p < N; p++) {
    const q = p * 3;
    let r = bg[q];
    let g = bg[q + 1];
    let b = bg[q + 2];
    // The street stays under 24 everywhere but the lamp itself.
    const m = r > g ? (r > b ? r : b) : g > b ? g : b;
    if (m > 22) {
      r *= 22 / m;
      g *= 22 / m;
      b *= 22 / m;
    }
    const f = facet[p];
    const d = dist[p];
    let sparkle = 1;
    if (d <= 1 && gl > 0) {
      // Glitter: each face turns to the light and away again on its own beat.
      const s = Math.sin(t * spin[p] + phase[p]);
      sparkle = 1 - 0.6 * gl + (s > 0 ? 2.4 * gl * s * s * s : 0);
    }
    if (frost[p]) {
      // A crystal just frozen flashes, then settles.
      const age = t - born[p];
      const v = (0.45 + 0.5 * f) * (age < 0.5 ? 1.7 - 1.4 * age : 1) * sparkle;
      // The brightest faces run white; near the lamp the ice is its colour.
      const w = 90 * f * f * f * f * v;
      const a = 280 * lit[p] * v;
      r = (ICE[0] * v + a * lamp[0] + w) * tint[q];
      g = (ICE[1] * v + a * lamp[1] + w) * tint[q + 1];
      b = (ICE[2] * v + a * lamp[2] + w) * tint[q + 2];
    } else {
      // The lamp's head, where no frost hides it.
      const c0 = core[p];
      if (c0 > 0.5) {
        r += c0 * lamp[0];
        g += c0 * lamp[1];
        b += c0 * lamp[2];
      }
      // Where frost has just melted the glass is wet for a moment.
      const wet = t - born[p];
      if (wet >= 0 && wet < 1.5) {
        const e = (1 - wet / 1.5) * (0.3 + f);
        r += 30 * e;
        g += 44 * e;
        b += 60 * e;
      }
      if (d <= 2) {
        // A film of hoar frost round the ferns, lit one step out and kept
        // under 24 the next. It scatters the lamp's light farther than the
        // ferns do.
        const near = d === 1;
        const film = (near ? 0.17 * sparkle : 0.06) * (0.6 + 0.8 * f);
        const hz = haze[p];
        const c = 1 - 0.6 * hz;
        const keep = near ? 0.5 : 0.7;
        r = keep * r + (ICE[0] * c + 300 * hz * lamp[0]) * film;
        g = keep * g + (ICE[1] * c + 300 * hz * lamp[1]) * film;
        b = keep * b + (ICE[2] * c + 300 * hz * lamp[2]) * film;
        if (!near) {
          const n = r > g ? (r > b ? r : b) : g > b ? g : b;
          if (n > 23) {
            r *= 23 / n;
            g *= 23 / n;
            b *= 23 / n;
          }
        }
      }
    }
    display.setPixel(p % W, (p / W) | 0, byte(r), byte(g), byte(b));
  }
}
