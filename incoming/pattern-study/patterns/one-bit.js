// ===== Patternflow pattern =====
// Title:   One Bit
// Family:  pixel
// Idea:    A lighthouse on a cliff over a moonlit sea, drawn on a one-bit screen in two tones with Bayer ordered dithering, where the beam turns, clouds cross the moon and a fog bank breathes on the water so slowly that only a few pixels flip each frame.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bayer's ordered dither (1973), after the one-bit screens of the early Macintosh and the Playdate
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Palette=0..1, Time=0.2..3, Fog=0..1, Wind=0..1
//
// Knob 1: Palette. The screen's two tones: an amber terminal, a Game Boy's greens, a Macintosh's black and white, e-ink on warm paper, and a Playdate's grey on silver.
// Knob 2: Time. How fast the night goes by: at 2 the beam turns once in 12 seconds and a cloud takes 40 to 60 seconds to cross; at 0.2 the picture all but stands still.
// Knob 3: Fog. How much fog lies on the sea: at 0 a low bank breathes along the horizon; turned up, it rolls in and climbs the cliff until only the gallery and the lantern stand clear.
// Knob 4: Wind. At 0 a still night, four small clouds in a sky full of stars and a calm sea; turned up, nine clouds twice as long race over and hide the moon, whitecaps break between the wavelets and the surf climbs the cliff.

const W = 64;
const H = 128;
const N = W * H;
// The horizon, and the moon's centre and radius.
const HZ = 82;
const MX = 16;
const MY = 28;
const MR = 7;
// The moon's seas: offset from its centre and squared radius.
const MARIA = [-2, -2, 4, 2, -3, 3, 1.5, 1.5, 4, -4.5, 1.5, 3];
// The lighthouse: tower axis, the rows of its foot and its top, its lamp.
const TX = 52;
const T_BASE = 68;
const T_TOP = 32;
const LAMP_Y = 25;
// One turn of the light at Time 1, in seconds, and where the turn starts:
// at the opening Time it swings past us and out over the sea in the first
// seconds.
const TURN = 24;
const BEAM0 = 3.06;
// The fog bank breathes, rising and settling again, over this many seconds of Time 1.
const BREATH = 48;
const MAX_CLOUDS = 9;
// The screen's two tones, light then dark.
const PALETTES = [
  [
    [255, 176, 32],
    [18, 8, 0],
  ],
  [
    [155, 188, 15],
    [15, 56, 15],
  ],
  [
    [255, 255, 255],
    [0, 0, 0],
  ],
  [
    [222, 214, 192],
    [38, 38, 44],
  ],
  [
    [178, 175, 166],
    [50, 47, 40],
  ],
];
// The only greys the screen draws, as shares of lit pixels: ordered dither
// at these levels makes clean repeating patterns, as a one-bit artist would
// pick them from a palette of fills.
const G1 = 1 / 16;
const G2 = 1 / 8;
const G3 = 1 / 4;
const G4 = 1 / 2;

const SKY = 0;
const SEA = 1;
const CLIFF = 2;
const TOWER = 3;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// The 8 x 8 Bayer matrix, as thresholds between 0 and 1, grown from the
// 2 x 2 one: each step puts four copies side by side, scaled by 4 and offset
// by 0, 2, 3 and 1.
function bayer() {
  let m = [0];
  let n = 1;
  while (n < 8) {
    const next = new Array(4 * n * n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = 4 * m[y * n + x];
        next[y * 2 * n + x] = v;
        next[y * 2 * n + x + n] = v + 2;
        next[(y + n) * 2 * n + x] = v + 3;
        next[(y + n) * 2 * n + x + n] = v + 1;
      }
    m = next;
    n *= 2;
  }
  return Float32Array.from(m, (v) => (v + 0.5) / 64);
}

function cliffEdge(y) {
  // The cliff's seaward face, from the lighthouse's ledge down to the water.
  const u = (y - T_BASE) / (H - T_BASE);
  return 42 - 10 * u * u + 1.8 * Math.sin(y * 0.55) + 1.1 * Math.sin(y * 1.7 + 1);
}

function towerHalf(y) {
  return 4 + (1.5 * (y - T_TOP)) / (T_BASE - T_TOP);
}

// The still picture, as a grey for each pixel before dithering, and which
// part of the scene each pixel belongs to.
function drawScene(P) {
  const { base, region } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let v = 0;
      let part = SEA;
      if (y < HZ) {
        part = SKY;
        // Black overhead, the sky paling in three bands down to the horizon.
        v = y >= HZ - 9 ? G3 : y >= HZ - 20 ? G2 : y >= HZ - 36 ? G1 : 0;
        const dm = Math.sqrt((x - MX) ** 2 + (y - MY) ** 2);
        if (dm < MR) {
          // The moon, its seas in half tone: Imbrium and Serenitatis up on
          // the left and right, Tranquillitatis below, Procellarum down the edge.
          let mare = false;
          for (let m = 0; m < MARIA.length; m += 3) if ((x - MX - MARIA[m]) ** 2 + (y - MY - MARIA[m + 1]) ** 2 < MARIA[m + 2]) mare = true;
          v = mare ? G4 : 1;
        } else {
          // A ring of haze round the moon, fading out in four fills.
          const ring = dm - MR;
          const halo = ring < 2 ? G4 : ring < 6 ? G3 : ring < 12 ? G2 : ring < 20 ? G1 : 0;
          if (halo > v) v = halo;
        }
      } else if (y < HZ + 5) v = G2;
      const edge = cliffEdge(y);
      if (y >= T_BASE && x >= edge) {
        part = CLIFF;
        // Black rock, its seaward rim and a few ledges catching the moon, and
        // turf along the top.
        // The face is shaded from the rim back into the dark in three fills.
        const ledge = (y === 86 && x < 50) || (y === 99 && x < 46) || (y === 112 && x < 43);
        const back = x - edge;
        v = back < 1 || ledge || y === T_BASE ? 1 : y === T_BASE + 1 ? G4 : back < 7 ? G3 : back < 13 ? G2 : back < 20 ? G1 : 0;
      }
      // The tower, lit from the moon on the left and in shadow on the right.
      const hw = towerHalf(y);
      if (y >= T_TOP && y < T_BASE && Math.abs(x - TX) <= hw) {
        part = TOWER;
        const u = (x - (TX - hw)) / (2 * hw);
        v = u < 0.45 ? 1 : u < 0.65 ? G4 : u < 0.82 ? G3 : 0;
        // Two black bands.
        if ((y >= 39 && y < 44) || (y >= 53 && y < 58)) v = u < 0.3 ? G4 : 0;
        // A door and two small windows.
        if ((y >= T_BASE - 6 && Math.abs(x - TX + 1) <= 1) || ((y === 48 || y === 49 || y === 35 || y === 36) && x === TX - 1)) v = 0;
      }
      // Gallery and rail, lantern room, roof and the ball on top.
      if (y >= T_TOP - 3 && y < T_TOP && Math.abs(x - TX) <= 6) {
        part = TOWER;
        v = y === T_TOP - 1 || (x & 1) === 0 || Math.abs(x - TX) === 6 ? 1 : 0;
      }
      if (y >= LAMP_Y - 4 && y < T_TOP - 3 && Math.abs(x - TX) <= 3) {
        part = TOWER;
        v = Math.abs(x - TX) === 3 ? 0 : 1;
      }
      if (y >= LAMP_Y - 8 && y < LAMP_Y - 4 && Math.abs(x - TX) <= 4 - (y - LAMP_Y + 8)) {
        part = TOWER;
        v = x <= TX ? 1 : G3;
      }
      if (y === LAMP_Y - 9 && x === TX) {
        part = TOWER;
        v = 1;
      }
      base[p] = v;
      region[p] = part;
    }
  // Stars in the dark sky, a few of them twinkling.
  P.stars = [];
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 21) * W);
    const y = Math.floor(hash(i, 22) * 52);
    const p = y * W + x;
    if (region[p] !== SKY || base[p] > 0) continue;
    P.stars.push(p, hash(i, 23) < 0.4 ? 1 : 0);
  }
  // Clouds: each a row of three to five puffs, long and low like the clouds
  // over a sea at night, on its own height and pace.
  P.clouds = [];
  for (let i = 0; i < MAX_CLOUDS; i++) {
    const puffs = [];
    const n = 3 + Math.floor(hash(i, 31) * 3);
    let dx = 0;
    for (let j = 0; j < n; j++) {
      const rx = 4 + 5 * hash(i * 7 + j, 32);
      puffs.push(dx, -2.2 * hash(i * 7 + j, 33) * (j > 0 && j < n - 1 ? 1 : 0.3), rx, 1.6 + 1.6 * hash(i * 7 + j, 34));
      dx += rx * 1.1;
    }
    P.clouds.push({ x: hash(i, 35) * (W + 40), y: 8 + ((i * 23) % 9) * 6 + 3 * hash(i, 36), len: dx, pace: 0.7 + 0.4 * hash(i, 37), puffs });
  }
}

export function setup(params) {
  const P = params;
  P.base = new Float32Array(N);
  P.region = new Uint8Array(N);
  P.level = new Float32Array(N);
  P.cloud = new Uint8Array(N);
  P.bayer = bayer();
  drawScene(P);
  Object.assign(P, { t: 0, sail: 0, started: false, palette: 0, fogK: 0, wind: 0.06 });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  P.palette = clamp(Math.floor(k[0] * PALETTES.length), 0, PALETTES.length - 1);
  const time = clamp(k[1], 0.05, 4);
  P.fogK = clamp(k[2], 0, 1);
  P.wind = clamp(k[3], 0, 1);
  // The clouds sail faster in a wind.
  const gust = 1 + 1.5 * P.wind;
  if (!P.started) {
    // The night is a few seconds on when the screen comes up, as far as Time takes it.
    P.started = true;
    P.t = 6 * time;
    P.sail = 6 * time * gust;
  }
  P.t += dt * time;
  P.sail += dt * time * gust;
}

// Mark where the clouds are this frame: 1 inside, 2 on a top edge.
function placeClouds(P) {
  const { cloud } = P;
  cloud.fill(0);
  // More clouds, and bigger, as the wind rises, until the deck closes.
  const count = 4 + Math.round(5 * P.wind);
  const grow = 1 + 1.2 * P.wind;
  for (let i = 0; i < count; i++) {
    const c = P.clouds[i];
    const span = W + c.len * grow + 16;
    const x0 = ((((c.x + P.sail * c.pace) % span) + span) % span) - c.len * grow - 8;
    const pf = c.puffs;
    for (let j = 0; j < pf.length; j += 4) {
      const cx = x0 + pf[j] * grow;
      const cy = c.y + pf[j + 1];
      const rx = pf[j + 2] * grow;
      const ry = pf[j + 3] * (1 + 0.8 * P.wind);
      const ya = Math.max(0, Math.floor(cy - ry));
      const yb = Math.min(HZ - 1, Math.ceil(cy + ry));
      for (let y = ya; y <= yb; y++) {
        const u = (y - cy) / ry;
        const w = rx * Math.sqrt(Math.max(0, 1 - u * u));
        const xa = Math.max(0, Math.ceil(cx - w));
        const xb = Math.min(W - 1, Math.floor(cx + w));
        for (let x = xa; x <= xb; x++) cloud[y * W + x] = 1;
      }
    }
  }
  for (let p = W; p < HZ * W; p++) if (cloud[p] && !cloud[p - W]) cloud[p] = 2;
}

// The grey of every pixel this frame: the still scene, the clouds, the
// turning beam, the water's glitter and the fog.
function compose(P) {
  const { base, region, level, cloud } = P;
  const t = P.t;
  placeClouds(P);
  // The fog bank: its lumpy top slides left at half a pixel a second of Time
  // 1, and the bank rises and settles as it breathes.
  const breath = Math.sin((t / BREATH) * Math.PI * 2);
  const fogTop = HZ - 3 - 42 * P.fogK - 4 * breath;
  const fogLow = HZ + 12 + 30 * P.fogK + 3 * breath;
  const fx = t * 0.5;
  // The beam: the light turns once in TURN seconds of Time 1; on screen it
  // is a fan whose length is the turning light's sideways reach.
  const a = (t / TURN) * Math.PI * 2 + BEAM0;
  const side = Math.cos(a);
  const toward = Math.sin(a);
  const reach = Math.abs(side) * 70;
  const dir = side > 0 ? 1 : -1;
  // The lantern flares as the light swings past us.
  const flare = toward > 0 ? Math.pow(toward, 16) : 0;
  for (let x = 0; x < W; x++) {
    const xs = x + fx;
    const top = fogTop - 2.5 * (Math.sin(xs * 0.21 + 0.7) + 0.6 * Math.sin(xs * 0.47 + 2.1));
    const along = (x - TX) * dir;
    const lit = along > 3 && along < reach;
    const spread = 1.5 + along * 0.13;
    const mid = LAMP_Y + along * 0.05;
    for (let y = 0; y < H; y++) {
      const p = y * W + x;
      const part = region[p];
      let v = base[p];
      if (part === SKY) {
        const c = cloud[p];
        if (c) {
          // A cloud near the moon is lit through; its top edge catches the light.
          const dm = (x - MX) ** 2 + (y - MY) ** 2;
          v = c === 2 ? (dm < 500 ? 1 : G4) : dm < 120 ? G4 : G3;
        }
        // The beam crosses the sky in front of the clouds.
        if (lit) {
          const off = Math.abs(y - mid) / spread;
          if (off < 1) {
            const fall = along / reach;
            const g = fall < 0.35 ? G4 : fall < 0.7 ? G3 : G2;
            const b = off < 0.35 ? (g === G4 ? 0.75 : g * 2) : g;
            if (b > v) v = b;
          }
        }
      } else if (part === SEA) {
        // The water in level wavelets on every other row, thicker toward us,
        // each row sliding slowly the other way from the next. Under the
        // moon they crowd into a path of light.
        const depth = (y - HZ) / (H - HZ);
        const half = 2 + 14 * depth;
        const g = Math.max(0, 1 - Math.abs(x - MX) / half);
        const row = y - HZ;
        const seg = Math.floor((x + 40 + t * (0.5 + 0.6 * hash(y, 5)) * ((row >> 1) & 1 ? 1 : -1)) / (3 + 4 * depth));
        // In the path of light each wavelet also winks on and off as it catches the moon.
        const wink = g > 0 ? 0.35 * g * (hash(seg * 3 + y, Math.floor(t * 0.6 + hash(seg, y + 7) * 9)) - 0.5) : 0;
        const dash = hash(seg, y) - wink;
        // A wind raises whitecaps between the rows.
        const chop = P.wind;
        if (row & 1 ? dash < 0.1 + 0.32 * depth + 0.6 * g * g + 0.3 * chop : (g > 0.4 && dash < 0.5 * g * g) || dash > 1 - 0.3 * chop * depth) v = 1;
        // Surf at the foot of the cliff, climbing higher in a wind.
        const foam = cliffEdge(y) - x;
        if (y > 106 - 22 * chop && foam < 2.5 + 5 * chop && Math.sin(y * 1.3 + t * 0.7) > 0.3 - foam * 0.3) v = 1;
      }
      // The lantern flares when the light faces us.
      if (flare > 0.02) {
        const d2 = (x - TX) ** 2 + (y - LAMP_Y) ** 2;
        const f = flare * Math.exp(-d2 / 50);
        if (f > G2 && f > v) v = f > 0.6 ? 1 : f > 0.3 ? G4 : G3;
      }
      // Fog in front of everything from its top down to its foot: half grey
      // where the moon lights its upper layer, a quarter below, thinning out.
      if (y >= top && y < fogLow + 6) {
        const f = y < top + 9 ? G4 : y < fogLow ? G3 : G2;
        v = v > G4 ? G4 : f > v ? f : v;
      }
      level[p] = v;
    }
  }
  // Stars, and the twinkling ones going out for a moment now and then.
  const stars = P.stars;
  for (let i = 0; i < stars.length; i += 2) {
    const p = stars[i];
    if (level[p] > 0) continue;
    if (!stars[i + 1] || hash(p, Math.floor(t * 1.3)) > 0.15) level[p] = 1;
  }
}

export function draw(display, params) {
  const P = params;
  if (!P.base) return;
  compose(P);
  const { level, bayer } = P;
  const [light, dark] = PALETTES[P.palette];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const on = level[y * W + x] > bayer[((y & 7) << 3) | (x & 7)];
      const c = on ? light : dark;
      display.setPixel(x, y, c[0], c[1], c[2]);
    }
}
