// ===== Patternflow pattern =====
// Title:   Train Window
// Family:  space
// Idea:    The view from a train window slides by in layers, slower the farther they are, from clouds and hazy mountains to fields, farmhouses, trees and whipping catenary masts, until a cutting closes in and a tunnel turns the glass black with its lamps streaking past.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 17; the parallax scrolling of side-scrolling games, from depths in metres through a pinhole camera
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Time=0..1, Speed=0.2..3, Hills=0..1, Rain=0..1
//
// Knob 1: Time. The time of day from noon, through a golden afternoon, a sunset behind the mountains, a starry night with lit farmhouse windows and a pink dawn, back to noon.
// Knob 2: Speed. How fast the train runs: 90 km/h at 2, when a catenary mast crosses the window in a quarter of a second and the mountains hardly move; 9 km/h at 0.2, and 135 km/h at 3.
// Knob 3: Hills. At 0 farmland under low mountains and a tunnel about every 20 seconds; turned up, the mountains rise nearly three times as high, the hills swell and the tunnels come sooner, then every six to nine seconds.
// Knob 4: Rain. Raindrops on the glass that the wind drives back along it, and an overcast sky; at the top the light is grey and the glass is crowded.

const W = 64;
const H = 128;
const N = W * H;
// The window's glass: columns 3 to 60 and rows 6 to 107, corners rounded.
const WX0 = 3;
const WX1 = 60;
const WY0 = 6;
const WY1 = 107;
const CORNER = 5;
// The camera looks out from column CX, the horizon on row HOR, F LEDs to one
// unit of tan, from an embankment EYE metres above the plain.
const CX = 31.5;
const HOR = 58;
const F = 40;
const EYE = 12;
// Depths in metres. Each layer slides F / depth LEDs for every metre the train runs.
const Z_CLOUD = 3000;
const Z_MOUNT = 2400;
const Z_HILL = 320;
const Z_WALL = 6;
const Z_TUBE = 3.5;
const Z_MAST = 4.5;
// Where the fields change, by depth: a hedge runs along each line.
const BANDS = [10, 16, 24, 36, 54, 80, 120, 190, 300, 520, 1e9];
// Tree rows as depth, spacing, chance of a tree, crown radius in metres.
const TREES = [
  [48, 7, 0.55, 3.2],
  [19, 11, 0.35, 3.6],
  [10, 17, 0.22, 4.2],
];
const MAST_GAP = 50;
// The first tunnel: at Speed 2 the window goes dark 4.4 s in and is light again at 6.6 s.
const FIRST = 115;
const FIRST_LEN = 45;
const CUT = 35;
const LAMP_GAP = 8;
// A lamp's light by rows from its two-row core.
const GLOW = [1, 0.4, 0.14, 0.05];

// Fields at noon: pasture, young wheat, ripe wheat, ploughed earth, dark clover, rapeseed.
const FIELDS = [
  [86, 150, 58],
  [124, 176, 70],
  [206, 180, 92],
  [140, 100, 62],
  [58, 112, 48],
  [222, 202, 62],
];
// The day as [time, sky at the top, sky at the horizon, light on the land]:
// noon, golden afternoon, sunset, dusk, night, dawn and noon again.
const DAY = [
  [0, 38, 104, 214, 168, 204, 236, 1, 1, 1],
  [0.2, 64, 112, 196, 238, 204, 150, 1.04, 0.9, 0.7],
  [0.34, 52, 44, 116, 255, 128, 58, 0.86, 0.55, 0.42],
  [0.44, 14, 14, 46, 92, 56, 80, 0.3, 0.24, 0.34],
  [0.5, 3, 5, 18, 16, 20, 44, 0.1, 0.12, 0.2],
  [0.76, 3, 5, 18, 16, 20, 44, 0.1, 0.12, 0.2],
  [0.86, 46, 60, 132, 238, 168, 150, 0.72, 0.6, 0.64],
  [1, 38, 104, 214, 168, 204, 236, 1, 1, 1],
];

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth 1D value noise, 0..1.
function n1(u, s) {
  const i = Math.floor(u);
  const f = u - i;
  const t = f * f * (3 - 2 * f);
  return hash(i, s) * (1 - t) + hash(i + 1, s) * t;
}

// The mountain ridge at u, 0..1, its peaks sharpened by the power.
function ridge(u) {
  return (0.62 * n1(u / 21, 5) + 0.28 * n1(u / 8, 6) + 0.1 * n1(u / 3, 7)) ** 1.6;
}

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function keyed(table, t, out) {
  let i = 0;
  while (i < table.length - 2 && t > table[i + 1][0]) i++;
  const a = table[i];
  const b = table[i + 1];
  const f = smooth(0, 1, (t - a[0]) / (b[0] - a[0]));
  for (let k = 1; k < a.length; k++) out[k - 1] = a[k] + (b[k] - a[k]) * f;
}

function inGlass(x, y) {
  if (x < WX0 || x > WX1 || y < WY0 || y > WY1) return false;
  const dx = x < WX0 + CORNER ? WX0 + CORNER - x : x > WX1 - CORNER ? x - (WX1 - CORNER) : 0;
  const dy = y < WY0 + CORNER ? WY0 + CORNER - y : y > WY1 - CORNER ? y - (WY1 - CORNER) : 0;
  return dx * dx + dy * dy <= CORNER * CORNER + 1;
}

export function setup(params) {
  const P = params;
  P.fb = new Float32Array(N * 3);
  P.glass = new Uint8Array(N);
  P.wall = new Float32Array(N * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (inGlass(x, y)) {
        P.glass[p] = 1;
        continue;
      }
      // The carriage wall, the rubber seal and aluminium trim round the glass, the sill.
      let near = 9;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) if (inGlass(x + dx, y + dy)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
      put(P.wall, p, ...(near === 1 ? [18, 18, 20] : near === 2 ? [118, 120, 124] : y > WY1 + 6 ? [48, 44, 42] : y > WY1 + 2 ? [96, 88, 80] : [56, 51, 48]));
    }
  }
  // A wine-red curtain, gathered at the left and tied back at row 66.
  for (let y = 0; y <= WY1 + 2; y++) {
    const w = y < 66 ? 7 - (y / 66) * 3.5 : 3.5 + ((y - 66) / 40) * 3;
    for (let x = 0; x < WX0 + w; x++) {
      const p = y * W + x;
      P.glass[p] = 0;
      const fold = (x + Math.floor((y < 66 ? 66 - y : y - 66) / 14)) % 3;
      const v = (fold === 0 ? 0.5 : fold === 2 && y > 66 ? 0.8 : 1) * (y > 63 && y < 69 ? 0.6 : 1);
      put(P.wall, p, 118 * v, 30 * v, 40 * v);
    }
  }
  // The carriage as the glass reflects it: ceiling lamps, the luggage rack, the
  // far windows between their pillars, seat backs with white headrest cloths.
  P.mirror = new Float32Array(N * 3);
  for (let y = WY0; y <= WY1; y++)
    for (let x = WX0; x <= WX1; x++) {
      const p = y * W + x;
      const seat = (x + 4) % 27;
      const top = 78 + Math.abs(seat - 12) * 0.25;
      const pillar = x % 27 < 6 && y > WY0 + 9 ? [54, 50, 46] : [0, 0, 0];
      let c = pillar;
      if (y < WY0 + 7) c = y === WY0 + 2 || y === WY0 + 3 ? [96, 90, 74] : [52, 48, 44];
      else if (y === WY0 + 8) c = [60, 58, 56];
      else if (y >= 74 && (seat < 3 || seat > 21)) c = y > 98 ? [40, 40, 44] : [0, 0, 0];
      else if (y >= 74 && y >= top) c = y < top + 5 && seat > 6 && seat < 18 ? [58, 58, 54] : [32, 38, 58];
      put(P.mirror, p, ...c);
    }
  // Clouds: a tileable fractal noise 128 wide and 64 tall.
  P.cloud = new Float32Array(128 * 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 128; x++) {
      let v = 0;
      for (let o = 0; o < 4; o++) {
        const cx = 4 << o;
        const cy = cx >> 1;
        const ix = Math.floor((x / 128) * cx);
        const iy = Math.floor((y / 64) * cy);
        const tx = smooth(0, 1, (x / 128) * cx - ix);
        const ty = smooth(0, 1, (y / 64) * cy - iy);
        const c = (i, j) => hash(((ix + i) % cx) + o * 97, (iy + j) % cy);
        const top = c(0, 0) + (c(1, 0) - c(0, 0)) * tx;
        v += (0.55 / (1 << o)) * (top + (c(0, 1) + (c(1, 1) - c(0, 1)) * tx - top) * ty);
      }
      P.cloud[y * 128 + x] = v;
    }
  // Per column: the tops of the mountains and hills, and their shading.
  for (const key of ["mTop", "mLit", "hTop", "hSh"]) P[key] = new Float32Array(W);
  P.dark = new Uint8Array(W);
  P.day = new Float32Array(9);
  P.sky = P.day.subarray(0, 6);
  P.light = P.day.subarray(6, 9);
  P.haze = new Float32Array(3);
  Object.assign(P, { night: 0, cam: 0, time: 0, hills: 0, rain: 0.06, clock: 0, adapt: 0, tunnels: null, nextKey: 1 });
  // Raindrops on the glass: x, y and how fast each one runs.
  P.drops = [];
  for (let i = 0; i < 160; i++) P.drops.push([WX0 + Math.random() * (WX1 - WX0), WY0 + Math.random() * (WY1 - WY0), 0.6 + 0.8 * Math.random()]);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  P.time = clamp(k[0], 0, 1);
  P.speed = clamp(k[1], 0.2, 3);
  P.hills = clamp(k[2], 0, 1);
  P.rain = clamp(k[3], 0, 1);
  if (!P.tunnels) {
    // In hill country the first tunnel comes sooner.
    const a = FIRST - 70 * P.hills;
    P.tunnels = [[a, a + FIRST_LEN]];
  }
  P.step = 12.5 * P.speed * dt;
  P.cam += P.step;
  P.clock += dt;
  // Lay the next tunnel once the last one is behind: farther apart in flat country.
  const tl = P.tunnels;
  const last = tl[tl.length - 1];
  if (P.cam > last[1] + 30) {
    const gap = (480 - 400 * P.hills) * (0.7 + 0.6 * hash(P.nextKey, 1)) + 60;
    const len = 25 + 50 * hash(P.nextKey, 2) + 30 * P.hills;
    tl.push([last[1] + gap, last[1] + gap + len]);
    P.nextKey++;
    if (tl.length > 3) tl.shift();
  }
  // Eyes adjust: dark-adapted in a tunnel, so daylight blazes for a moment after it.
  const inside = P.tunnelShare || 0;
  P.adapt += (inside - P.adapt) * Math.min(1, dt * (inside > P.adapt ? 1.6 : 1.4));
  // Rain runs back along the glass, faster the faster the train.
  const want = Math.round(P.rain * 160);
  for (let i = 0; i < want; i++) {
    const d = P.drops[i];
    d[0] -= dt * d[2] * (2 + 7 * P.speed);
    d[1] += dt * d[2] * (1.5 + 1.5 * P.speed) * 0.4;
    if (d[0] < WX0 || d[1] > WY1) {
      d[0] = WX0 + Math.random() * (WX1 - WX0);
      d[1] = WY0 + Math.random() * (WY1 - WY0);
    }
  }
}

// The line at X metres: 0 open, 1 a cutting (its wall's height in out[0]), 2 a portal, 3 a tunnel.
function track(P, X, out) {
  const tl = P.tunnels;
  for (let i = 0; i < tl.length; i++) {
    const a = tl[i][0];
    const b = tl[i][1];
    if (X >= a && X < b) return 3;
    if ((X >= a - 1.4 && X < a) || (X >= b && X < b + 1.4)) return 2;
    const u = X < a ? 1 - (a - X) / CUT : 1 - (X - b) / (CUT * 0.7);
    if (u > 0 && u < 1) {
      out[0] = -7 + 17 * Math.pow(u, 1.4);
      return 1;
    }
  }
  return 0;
}

const CUTH = new Float32Array(1);

function put(fb, p, r, g, b) {
  fb[p * 3] = r;
  fb[p * 3 + 1] = g;
  fb[p * 3 + 2] = b;
}

// A colour on the land, lit by the hour and faded into the haze.
function land(P, p, r, g, b, fade) {
  const { light: L, haze: h } = P;
  put(P.fb, p, r * L[0] * (1 - fade) + h[0] * fade, g * L[1] * (1 - fade) + h[1] * fade, b * L[2] * (1 - fade) + h[2] * fade);
}

function mix(fb, p, r, g, b, a) {
  fb[p * 3] += (r - fb[p * 3]) * a;
  fb[p * 3 + 1] += (g - fb[p * 3 + 1]) * a;
  fb[p * 3 + 2] += (b - fb[p * 3 + 2]) * a;
}

// Per frame: the sky, the light, the haze and the far silhouettes.
function frameLight(P) {
  const { sky, light: L, rain, cam } = P;
  keyed(DAY, P.time, P.day);
  // Overcast: the sky goes grey and the land dims.
  const grey = 0.75 * rain;
  const dim = 1 - 0.35 * rain;
  const lum = (L[0] + L[1] + L[2]) / 3;
  for (let i = 0; i < 6; i++) sky[i] += (150 * lum + 12 - sky[i]) * grey;
  for (let i = 0; i < 3; i++) L[i] *= dim;
  P.night = 1 - smooth(0.05, 0.35, lum);
  P.haze[0] = sky[3];
  P.haze[1] = sky[4];
  P.haze[2] = sky[5];
  const offM = (cam * F) / Z_MOUNT;
  const offH = (cam * F) / Z_HILL;
  const offC = (cam * F) / Z_CLOUD + P.clock * 0.6;
  const mAmp = 18 + 30 * P.hills;
  const hAmp = 6 + 20 * P.hills;
  for (let x = 0; x < W; x++) {
    const u = x + offM;
    const m = ridge(u);
    const m2 = ridge(u + 1);
    P.mTop[x] = HOR - 2 - mAmp * m;
    // The sun is in the south-west: faces that fall to the right are in shade.
    P.mLit[x] = m2 > m ? 1 : 0.72;
    const h = x + offH;
    P.hTop[x] = HOR + 1 - hAmp * (0.7 * n1(h / 15, 8) + 0.3 * n1(h / 5, 9)) - 1.5;
    P.hSh[x] = 0.8 + 0.2 * n1(h / 3, 11);
  }
  P.offC = offC;
}

// The land and the sky, LED by LED.
function paintLand(P) {
  const { fb, glass, cam, light: L, sky, rain, night, offC } = P;
  for (let y = WY0; y <= WY1; y++) {
    const s = (y - WY0) / (HOR - WY0);
    const sr = sky[0] + (sky[3] - sky[0]) * s;
    const sg = sky[1] + (sky[4] - sky[1]) * s;
    const sb = sky[2] + (sky[5] - sky[2]) * s;
    const k = y - HOR + 0.5;
    const z = k > 0 ? (EYE * F) / k : 0;
    let band = 0;
    while (z > BANDS[band + 1]) band++;
    const zUp = k > 1 ? (EYE * F) / (k - 1) : 1e9;
    const hedge = k > 0 && zUp > BANDS[band + 1];
    const fade = k > 0 ? 1 - Math.exp(-z / 700) : 0;
    // Furrows show where a row of LEDs is under 0.84 m of ground: a stripe every 2 m.
    const furrow = k > 0 && (z * z) / (EYE * F) < 0.84;
    const rowUp = z * 0.5 - Math.floor(z * 0.5) < 0.5;
    // A near row slides several LEDs a frame: blur it along the line.
    const slide = k > 0 ? (P.step * F) / z : 0;
    const taps = slide > 3 ? Math.min(4, Math.ceil(slide / 2)) : 1;
    const bw = 18 + 0.35 * BANDS[band];
    const shift = hash(band, 3);
    let lastCell = 1e9;
    let lastKind = 0;
    for (let x = WX0; x <= WX1; x++) {
      const p = y * W + x;
      if (!glass[p]) continue;
      if (k <= 0 || y < P.hTop[x]) {
        if (y >= P.hTop[x]) {
          const sh = P.hSh[x];
          land(P, p, 44 * sh, 100 * sh, 41 * sh, 0.3);
        } else if (y >= P.mTop[x]) {
          // Snow above row 32; the haze thins down the slopes.
          const lit = P.mLit[x] * (y < HOR - 26 ? 1.45 : 1);
          land(P, p, 92 * lit, 104 * lit, 128 * lit, 0.45 - 0.15 * ((y - P.mTop[x]) / 30));
        } else {
          let r = sr;
          let g = sg;
          let b = sb;
          // Stars come out as the sky darkens.
          if (night > 0 && hash(x * 131 + y, 77) < 0.012) {
            const t = night * (90 + 120 * hash(x, y));
            r += t;
            g += t;
            b += t;
          }
          // Clouds, stretched along the wind, greyer where they are thick.
          const cv = P.cloud[((y - WY0) & 63) * 128 + (Math.floor((x + offC) * 0.5) & 127)];
          const c = smooth(0.49 - 0.22 * rain, 0.54 - 0.2 * rain, cv);
          if (c > 0) {
            const top = cv > 0.6 - 0.2 * rain ? 0.82 : 1;
            r += (235 * top * L[0] * 0.9 + 20 - r) * c;
            g += (238 * top * L[1] * 0.9 + 20 - g) * c;
            b += (242 * top * L[2] * 0.9 + 26 - b) * c;
          }
          put(fb, p, r, g, b);
        }
        continue;
      }
      // The plain: fields by depth band, each band cut into fields across the line.
      let r = 0;
      let g = 0;
      let b = 0;
      for (let t = 0; t < taps; t++) {
        const X = cam + ((x - CX + 0.5) * z) / F + (t * slide * z) / F / taps;
        const cell = Math.floor(X / bw + shift);
        if (cell !== lastCell) {
          lastCell = cell;
          lastKind = Math.floor(hash(band * 977 + cell, 4) * FIELDS.length);
        }
        const kind = lastKind;
        const f = FIELDS[kind];
        let sh = 1;
        if (furrow) sh += (kind & 1 ? rowUp : X * 0.5 - Math.floor(X * 0.5) < 0.5) ? 0.14 : -0.14;
        if (hedge) sh = 0.45;
        r += f[0] * sh;
        g += f[1] * sh;
        b += f[2] * sh;
      }
      land(P, p, r / taps, g / taps, b / taps, fade);
    }
  }
}

// The sun, low behind the mountains in the afternoon and at sunset.
function paintSun(P) {
  const { fb, glass } = P;
  const sun = smooth(0.12, 0.22, P.time) * (1 - smooth(0.36, 0.42, P.time));
  if (sun > 0) {
    const sy = HOR - 36 + 24 * smooth(0.15, 0.4, P.time);
    for (let y = Math.floor(sy - 5); y <= sy + 5; y++)
      for (let x = 40; x <= 52; x++) {
        const p = y * W + x;
        if (y < WY0 || !glass[p] || y >= P.mTop[x] || y > HOR) continue;
        const d = Math.hypot(x - 46, y - sy);
        const a = sun * (d < 3.2 ? 1 : Math.max(0, 0.5 - (d - 3.2) * 0.2));
        if (a > 0) mix(fb, p, 255, 236, 180, a);
      }
  }
}

// Farmhouses: white walls under red and grey roofs, lit windows at night.
function paintHouses(P) {
  const { glass, cam, night } = P;
  for (let band = 3; band < 8; band++) {
    const z = Math.sqrt(BANDS[band] * BANDS[band + 1]);
    const bw = 18 + 0.35 * BANDS[band];
    const sc = F / z;
    const ground = HOR + EYE * sc;
    const fade = 1 - Math.exp(-z / 700);
    const c0 = Math.floor((cam - 34 / sc) / bw + hash(band, 3)) - 1;
    for (let cell = c0; cell < c0 + 4 + (68 / sc) / bw; cell++) {
      if (hash(band * 977 + cell, 5) > 0.3) continue;
      const X = (cell - hash(band, 3) + 0.3 + 0.4 * hash(cell, band)) * bw;
      const sx = CX + (X - cam) * sc;
      const w = 10 * sc;
      const wall = 5 * sc;
      const roof = 3.5 * sc;
      const red = hash(cell, band + 40) < 0.6;
      for (let y = Math.floor(ground - wall - roof); y < ground; y++) {
        const up = ground - y;
        const inRoof = up > wall;
        const half = inRoof ? (w * 0.5 + 0.5) * (1 - (up - wall) / roof) : w * 0.5;
        for (let x = Math.floor(sx - half); x <= sx + half; x++) {
          if (x < WX0 || x > WX1 || y < WY0 || y > WY1) continue;
          const p = y * W + x;
          if (!glass[p]) continue;
          if (!inRoof && night > 0.3 && up > wall * 0.35 && up < wall * 0.75 && ((x - Math.floor(sx)) & 1) === 0) put(P.fb, p, 255 * night, 200 * night, 90 * night);
          else if (inRoof) land(P, p, red ? 168 : 92, red ? 62 : 90, red ? 44 : 96, fade);
          else land(P, p, 222, 216, 200, fade);
        }
      }
    }
  }
}

// Trees, the far row first, each crown lit from the upper left in three tones.
function paintTrees(P) {
  const { glass, cam } = P;
  for (let row = 0; row < TREES.length; row++) {
    const [z, gap, chance, rad] = TREES[row];
    const sc = F / z;
    const ground = HOR + EYE * sc;
    const fade = 1 - Math.exp(-z / 700);
    const i0 = Math.floor((cam - (36 + rad * sc) / sc) / gap);
    const i1 = Math.ceil((cam + (36 + rad * sc) / sc) / gap);
    for (let i = i0; i <= i1; i++) {
      if (hash(i, row + 20) > chance) continue;
      const X = (i + 0.5 * hash(i, row + 30)) * gap;
      const sx = CX + (X - cam) * sc;
      const tall = hash(i, row + 50) < 0.3;
      const rx = rad * sc * (tall ? 0.45 : 0.8 + 0.4 * hash(i, row + 40));
      const ry = rad * sc * (tall ? 2.1 : 0.9);
      const cy = ground - (2.4 * sc + ry);
      const y0 = Math.max(WY0, Math.floor(cy - ry));
      const y1 = Math.min(WY1, Math.ceil(ground));
      const shade = hash(i, row + 60);
      const irx = 1 / rx;
      const iry = 1 / ry;
      for (let y = y0; y <= y1; y++) {
        for (let x = Math.max(WX0, Math.floor(sx - rx)); x <= Math.min(WX1, Math.ceil(sx + rx)); x++) {
          const p = y * W + x;
          if (!glass[p]) continue;
          const dx = (x + 0.5 - sx) * irx;
          const dy = (y + 0.5 - cy) * iry;
          if (dx * dx + dy * dy < 1) {
            const lit = dx + dy < -0.5 ? 1.08 : dx + dy < 0.3 ? 0.86 : 0.66;
            land(P, p, (30 + 14 * shade) * lit, (70 + 26 * shade) * lit, 30 * lit, fade);
          } else if (y > cy && Math.abs(x + 0.5 - sx) < Math.max(0.6, 0.25 * sc)) land(P, p, 52, 40, 30, fade);
        }
      }
    }
  }
}

// The cutting's rock walls rising to the portal, its stone face, then the black of the tunnel.
function paintTrack(P) {
  const { fb, glass, cam, dark } = P;
  const scW = F / Z_WALL;
  let darkCols = 0;
  for (let x = WX0; x <= WX1; x++) {
    const X = cam + (x + 0.5 - CX) / scW;
    const kind = track(P, X, CUTH);
    dark[x] = kind === 3 ? 1 : 0;
    if (kind === 0) continue;
    if (kind === 3) darkCols++;
    // The lip of the cutting is ragged with rock and scrub.
    const top = kind === 1 ? HOR - CUTH[0] * scW - 2.5 * n1(X * 1.3, 12) - (hash(Math.floor(X * 2), 13) < 0.2 ? 2 : 0) : -1;
    for (let y = Math.max(WY0, Math.floor(top)); y <= WY1; y++) {
      const p = y * W + x;
      if (!glass[p]) continue;
      if (kind === 3) {
        put(fb, p, 7, 7, 9);
        continue;
      }
      if (kind === 2) {
        // Dressed stone in courses of four rows, the joints staggered.
        const course = y >> 2;
        const joint = (y & 3) === 0 || Math.floor(X * 1.6 + (course & 1) * 0.5) !== Math.floor((X + 1 / scW) * 1.6 + (course & 1) * 0.5);
        const v = joint ? 0.5 : 1 - 0.08 * (course % 3);
        land(P, p, 152 * v, 140 * v, 120 * v, 0);
        continue;
      }
      // Rock in tilted beds of pale and dark stone, grass along the lip.
      const bed = Math.floor((HOR - y) / scW * 1.3 + 0.8 * Math.sin(X * 0.25)) & 1;
      if (y - top < 2) land(P, p, 70, 112, 50, 0);
      else if (bed) land(P, p, 156, 142, 118, 0);
      else land(P, p, 102, 92, 78, 0);
    }
  }
  P.tunnelShare = darkCols / (WX1 - WX0 + 1);
}

// Sodium lamps every eight metres on the tunnel wall, smeared into streaks by the run.
function paintLamps(P) {
  const { fb, glass, cam, dark } = P;
  const scT = F / Z_TUBE;
  // The eye holds a lamp a little longer than a frame.
  const streak = Math.max(1, 1.5 * P.step * scT);
  const lampGain = 0.55 + 0.45 * P.adapt;
  const l0 = Math.floor((cam - 40 / scT) / LAMP_GAP);
  for (let i = l0; i < l0 + 3; i++) {
    const X = i * LAMP_GAP;
    if (track(P, X, CUTH) !== 3) continue;
    const sx = CX + (X - cam) * scT;
    for (let x = Math.floor(sx); x < sx + streak; x++) {
      if (x < WX0 || x > WX1) continue;
      const along = 1 - (x - sx) / (streak + 1);
      for (let dy = -3; dy <= 4; dy++) {
        const y = 48 + dy;
        const p = y * W + x;
        if (!glass[p] || dark[x] === 0) continue;
        const a = GLOW[dy < 0 ? -dy : Math.max(0, dy - 1)] * along * lampGain;
        fb[p * 3] += 255 * a;
        fb[p * 3 + 1] += 160 * a;
        fb[p * 3 + 2] += 60 * a;
      }
    }
  }
}

// Catenary masts and their wires, which rise and dip across the window as the spans go by.
function paintMasts(P) {
  const { fb, glass, cam, light: L } = P;
  const scW = F / Z_WALL;
  const scM = F / Z_MAST;
  const m0 = Math.floor((cam - 40 / scM) / MAST_GAP);
  for (let i = m0; i <= m0 + 2; i++) {
    const X = i * MAST_GAP;
    if (track(P, X, CUTH) >= 2) continue;
    const sx = CX + (X - cam) * scM;
    const topY = HOR - 5.2 * scM;
    for (let x = Math.floor(sx - 1); x <= sx + 1 + 3; x++) {
      if (x < WX0 || x > WX1) continue;
      const a = x <= sx + 1 ? 1 : 0.35;
      for (let y = Math.max(WY0, Math.floor(topY)); y <= WY1; y++) {
        const p = y * W + x;
        if (glass[p]) mix(fb, p, 46 * L[0] + 6, 50 * L[1] + 6, 46 * L[2] + 8, a);
      }
    }
  }
  for (let x = WX0; x <= WX1; x++) {
    const X = cam + (x + 0.5 - CX) / scM;
    if (track(P, cam + (x + 0.5 - CX) / scW, CUTH) >= 2) continue;
    const u = X / MAST_GAP - Math.floor(X / MAST_GAP);
    const ym = Math.round(HOR - (4.4 - 3.2 * u * (1 - u)) * scM);
    const yc = Math.round(HOR - 3.0 * scM);
    const dropper = X - Math.floor(X / 6) * 6 < 0.12;
    for (let y = ym; y <= yc; y++) {
      if (y !== ym && y !== yc && !dropper) continue;
      if (y < WY0) continue;
      const p = y * W + x;
      if (glass[p]) mix(fb, p, 26, 28, 28, 0.85);
    }
  }
}

// Raindrops: each a bead of brighter light with a short trail behind it.
function paintRain(P) {
  const { fb, glass } = P;
  const drops = Math.round(P.rain * 160);
  for (let i = 0; i < drops; i++) {
    const d = P.drops[i];
    const x = Math.floor(d[0]);
    const y = Math.floor(d[1]);
    const len = 1 + Math.floor(P.speed * 1.4 * d[2]);
    for (let j = 0; j <= len; j++) {
      const p = y * W + x + j;
      if (x + j > WX1 || !glass[p]) continue;
      const a = j === 0 ? 0.55 : 0.3 * (1 - j / (len + 1));
      mix(fb, p, fb[p * 3] * 0.7 + 70, fb[p * 3 + 1] * 0.7 + 74, fb[p * 3 + 2] * 0.7 + 80, a);
    }
  }
}

export function draw(display, params, time) {
  const P = params;
  frameLight(P);
  paintLand(P);
  paintSun(P);
  paintHouses(P);
  paintTrees(P);
  paintTrack(P);
  paintLamps(P);
  paintMasts(P);
  paintRain(P);
  present(display, P);
}

// Where it is dark outside the glass turns mirror and the carriage shows in it.
function present(display, P) {
  const { fb, glass, wall, mirror } = P;
  const glow = 1 + 0.45 * P.adapt;
  for (let y = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++) {
      const q = p * 3;
      if (!glass[p]) {
        display.setPixel(x, y, wall[q], wall[q + 1], wall[q + 2]);
        continue;
      }
      let r = fb[q] * glow;
      let g = fb[q + 1] * glow;
      let b = fb[q + 2] * glow;
      const out = r > g ? (r > b ? r : b) : g > b ? g : b;
      if (out < 60) {
        const m = 1 - out / 60;
        r += mirror[q] * m;
        g += mirror[q + 1] * m;
        b += mirror[q + 2] * m;
      }
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
