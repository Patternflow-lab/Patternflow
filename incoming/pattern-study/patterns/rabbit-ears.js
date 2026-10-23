// ===== Patternflow pattern =====
// Title:   Rabbit Ears
// Family:  glitch
// Idea:    An old television in a dark room pulls in a late-night weather forecast through a rabbit-ear antenna, and as the weak signal drifts the presenter and her map fade in and out of the snow, lose their colour, tear sideways and roll through the black blanking bar, with a ghost of the picture a few LEDs to the right.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after analog broadcast reception: receiver noise, the colour killer, lost vertical hold and multipath ghosts
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Speed=0.2..3, Signal=0..1, Ghost=0..1
//
// Knob 1: Tint. The set's tint control: turns the broadcast's colours round the colour wheel, opening on the forecast's own blue sea and green land.
// Knob 2: Speed. How fast the signal drifts and the forecast runs; at 2 the station sinks into the snow every 6 to 8 s, with a shallower fade between.
// Knob 3: Signal. How far the station reaches: at 0 the picture keeps sinking into the snow and the hold slips each time, at 1 it stays with only a dusting of snow.
// Knob 4: Ghost. The echo off a building across the street: from a faint copy 4 LEDs to the right at 0 to a strong one 19 LEDs over at 1.
// Buttons: K1 tap slaps the side of the set: the hold slips and the picture rolls round once.

const W = 64;
const H = 128;
const N = W * H;
// Rows of vertical blanking between one picture and the next when the hold slips,
// and columns of horizontal blanking a torn line wraps through.
const VB = 12;
const HB = 6;
const C = H + VB;
const CLOUD_W = 128;

// Colours of the forecast before the tint control turns them.
const SEA_DEEP = [4, 14, 56];
const SEA_NEAR = [10, 34, 92];
const LOW = [28, 86, 32];
const HILL = [62, 116, 44];
const COAST = [170, 210, 150];
const CLOUD = [204, 208, 216];
const SUN = [255, 206, 30];
const MOON = [232, 230, 186];
const DROP = [40, 120, 255];
const SKIN = [222, 168, 132];
const SHIRT = [228, 228, 232];
const BAND = [16, 40, 120];
const BAND_TOP = [70, 120, 210];
const WHITE = [240, 240, 240];
const JACKETS = [[32, 44, 96], [110, 28, 44], [44, 44, 50], [18, 92, 96]];
const HAIRS = [[44, 28, 20], [120, 76, 36], [206, 170, 96], [24, 20, 22]];

// A 3 by 5 font, rows from the top, for the clock, the temperatures and the caption.
const FONT = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001001001001", 8: "111101111101111", 9: "111101111001111",
  ":": "000010000010000", T: "111010010010010", O: "010101101101010", N: "110101101101101", I: "111010010010111",
  G: "111100101101111", H: "101101111101101", M: "101111111101101", R: "110101110101101", W: "101101111111101",
};

function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise; px is the period in cells along x, or 0 for none.
function vnoise(x, y, s, px) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = px ? ((xi % px) + px) % px : xi;
  const x1 = px ? (((xi + 1) % px) + px) % px : xi + 1;
  const a = hash2(x0, yi, s);
  const b = hash2(x1, yi, s);
  const c = hash2(x0, yi + 1, s);
  const d = hash2(x1, yi + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function setup(params) {
  const P = params;
  P.t = 0;
  P.u = 0;
  P.frame = 0;
  P.phi = 0;
  P.rv = 0;
  P.slap = -1;
  P.s = 0.8;
  P.tint = -1;
  P.m = new Float32Array(9);
  P.seed = 1 + Math.floor(Math.random() * 100000);
  P.rs = (Math.floor(Math.random() * 4294967295) | 1) >>> 0;
  P.map = new Float32Array(N * 3);
  P.buf = new Float32Array(N * 3);
  P.pic = new Float32Array(N * 3);
  P.snow = new Float32Array(N * 3);
  P.cloud = new Float32Array(CLOUD_W * H);
  P.tube = new Uint8Array(N);
  P.tear = new Int16Array(H);
  P.jacket = JACKETS[Math.floor(Math.random() * JACKETS.length)];
  P.hair = HAIRS[Math.floor(Math.random() * HAIRS.length)];
  P.min = 31 + Math.floor(Math.random() * 25);
  const s = P.seed;
  // The land: an island from noise inside a tall oval, hillier inland.
  const land = new Uint8Array(N);
  const hill = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const f = 0.5 * vnoise(x / 16, y / 16, s, 0) + 0.3 * vnoise(x / 7, y / 7, s + 1, 0) + 0.2 * vnoise(x / 3.5, y / 3.5, s + 2, 0);
      const d = Math.sqrt(((x - 38) / 30) ** 2 + ((y - 50) / 60) ** 2);
      if (d < 0.75 + 0.8 * (f - 0.5)) land[y * W + x] = 1;
      hill[y * W + x] = vnoise(x / 6, y / 6, s + 3, 0);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let c;
      if (land[p]) {
        const edge = (x > 0 && !land[p - 1]) || (x < W - 1 && !land[p + 1]) || (y > 0 && !land[p - W]) || (y < H - 1 && !land[p + W]);
        const k = smooth(0.45, 0.8, hill[p]);
        c = edge ? COAST : [LOW[0] + (HILL[0] - LOW[0]) * k, LOW[1] + (HILL[1] - LOW[1]) * k, LOW[2] + (HILL[2] - LOW[2]) * k];
      } else {
        // Shallower water near a coast: count the land within 3 LEDs.
        let near = 0;
        for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) if (land[clamp(y + dy, 0, H - 1) * W + clamp(x + dx, 0, W - 1)]) near++;
        const k = Math.min(1, near / 4) * 0.7 + 0.3 * (y / H);
        c = [SEA_DEEP[0] + (SEA_NEAR[0] - SEA_DEEP[0]) * k, SEA_DEEP[1] + (SEA_NEAR[1] - SEA_DEEP[1]) * k, SEA_DEEP[2] + (SEA_NEAR[2] - SEA_DEEP[2]) * k];
      }
      P.map.set(c, p * 3);
    }
  // Cloud from the satellite, wrapping every 128 columns so it can keep crossing.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < CLOUD_W; x++) {
      const c = 0.55 * vnoise(x / 16, y / 16, s + 5, 8) + 0.3 * vnoise(x / 8, y / 8, s + 6, 16) + 0.15 * vnoise(x / 4, y / 4, s + 7, 32);
      P.cloud[y * CLOUD_W + x] = smooth(0.5, 0.74, c) * 0.75;
    }
  // The tube's corners are round.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cx = Math.max(0, Math.abs(x - 31.5) - 24.5);
      const cy = Math.max(0, Math.abs(y - 63.5) - 56.5);
      P.tube[y * W + x] = cx * cx + cy * cy > 49 ? 0 : 1;
    }
  // Two forecasts, tonight's and tomorrow's: a symbol and a temperature each.
  const temp = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  P.shows = [
    { name: "TONIGHT", spots: [["moon", 44, 18, temp(3, 8)], ["rain", 27, 38, temp(5, 9)], ["cloud", 47, 58, temp(4, 9)], ["moon", 38, 86, temp(2, 7)]] },
    { name: "TOMORROW", spots: [["sun", 42, 20, temp(12, 17)], ["rain", 26, 42, temp(9, 13)], ["sun", 48, 62, temp(13, 19)], ["cloud", 37, 88, temp(11, 15)]] },
  ];
  for (let i = 0; i < N * 3; i++) P.snow[i] = Math.random();
}

function put(B, x, y, c, a) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  if (a === undefined || a >= 1) {
    B[o] = c[0];
    B[o + 1] = c[1];
    B[o + 2] = c[2];
  } else {
    B[o] += (c[0] - B[o]) * a;
    B[o + 1] += (c[1] - B[o + 1]) * a;
    B[o + 2] += (c[2] - B[o + 2]) * a;
  }
}

function disc(B, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(B, x, y, c);
}

function text(B, str, x, y, c) {
  for (const ch of str) {
    const g = FONT[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === "1") put(B, x + (i % 3), y + Math.floor(i / 3), c);
    x += 4;
  }
}

function puff(B, x, y) {
  disc(B, x - 2.5, y + 1, 2.2, [150, 156, 166]);
  disc(B, x + 2.5, y + 1, 2.2, [150, 156, 166]);
  disc(B, x, y - 0.5, 2.8, CLOUD);
  disc(B, x - 2.5, y + 0.5, 1.8, CLOUD);
  disc(B, x + 2.5, y + 0.5, 1.8, CLOUD);
}

function symbol(B, kind, x, y, deg, u) {
  if (kind === "sun") {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + u * 0.4;
      put(B, x + 5 * Math.cos(a), y + 5 * Math.sin(a), SUN);
    }
    disc(B, x, y, 3.2, SUN);
  } else if (kind === "moon") {
    // A crescent: the disc less a second one up and to the right.
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) if (i * i + j * j <= 10.5 && (i - 1.8) ** 2 + (j + 1.2) ** 2 > 7.8) put(B, x + i, y + j, MOON);
  } else {
    puff(B, x, y);
    if (kind === "rain") for (let k = -1; k <= 1; k++) {
      const fall = (u * 3 + k * 0.6) % 1;
      put(B, x + 2 * k, y + 4 + Math.floor(fall * 3), DROP);
    }
  }
  // The temperature in a box beside it: blue when cold, yellow when mild, orange when warm.
  const box = deg < 7 ? [40, 110, 220] : deg < 14 ? [236, 196, 40] : [240, 128, 30];
  const ink = deg < 7 ? WHITE : [16, 16, 16];
  const s = String(deg);
  const w = s.length * 4 + 1;
  const bx = x + 5;
  const by = y - 3;
  for (let j = 0; j < 7; j++) for (let i = 0; i < w; i++) put(B, bx + i, by + j, box);
  text(B, s, bx + 1, by + 1, ink);
}

// The broadcast picture before the set gets at it: the map, its cloud, the symbols,
// the presenter in front, the caption and the station clock.
function broadcast(P) {
  const B = P.buf;
  const u = P.u;
  B.set(P.map);
  const ox = u * 3;
  const o0 = Math.floor(ox);
  const fo = ox - o0;
  for (let y = 0; y < H; y++) {
    const row = y * CLOUD_W;
    for (let x = 0; x < W; x++) {
      const i0 = (((x - o0) % CLOUD_W) + CLOUD_W) % CLOUD_W;
      const i1 = (i0 + CLOUD_W - 1) % CLOUD_W;
      const a = P.cloud[row + i0] * (1 - fo) + P.cloud[row + i1] * fo;
      if (a > 0.01) {
        const o = (y * W + x) * 3;
        B[o] += (CLOUD[0] - B[o]) * a;
        B[o + 1] += (CLOUD[1] - B[o + 1]) * a;
        B[o + 2] += (CLOUD[2] - B[o + 2]) * a;
      }
    }
  }
  // Tonight's chart for 10 s, then tomorrow's, and round again.
  const show = P.shows[Math.floor(u / 10) % 2];
  for (const sp of show.spots) symbol(B, sp[0], sp[1], sp[2], sp[3], u);
  presenter(P, B, show, u);
  for (let x = 0; x < W; x++) {
    put(B, x, 116, BAND_TOP);
    for (let y = 117; y < H; y++) put(B, x, y, BAND);
  }
  text(B, show.name, Math.floor((W - (show.name.length * 4 - 1)) / 2), 119, WHITE);
  // The station clock in the corner, past midnight.
  for (let y = 2; y < 10; y++) for (let x = 41; x < 62; x++) {
    const o = (y * W + x) * 3;
    B[o] *= 0.35;
    B[o + 1] *= 0.35;
    B[o + 2] *= 0.35;
  }
  const m = P.min + Math.floor(u / 60);
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  text(B, `${hh < 10 ? "0" : ""}${hh}:${mm < 10 ? "0" : ""}${mm}`, 42, 3, WHITE);
}

function presenter(P, B, show, u) {
  const sw = 0.8 * Math.sin(u * 0.9);
  const hx = 12 + sw;
  const hy = 80;
  const J = P.jacket;
  const dark = [J[0] * 0.6, J[1] * 0.6, J[2] * 0.6];
  // Shoulders down past the caption, widening a little.
  for (let y = hy + 7; y < H; y++) {
    const d = y - hy - 7;
    const half = d < 2 ? 8 + 1.5 * d : 11 + 0.15 * d;
    for (let x = Math.floor(hx - half); x <= Math.ceil(hx + half); x++) {
      const v = Math.abs(x - hx) < (hy + 17 - y) * 0.35;
      const lapel = !v && Math.abs(x - hx) < (hy + 17 - y) * 0.35 + 1.2;
      put(B, x, y, v ? SHIRT : lapel ? dark : J);
    }
  }
  // The neck and the head, with the hair round the top and sides.
  for (let y = hy + 4; y < hy + 8; y++) for (let x = Math.round(hx) - 1; x <= Math.round(hx) + 1; x++) put(B, x, y, [SKIN[0] * 0.8, SKIN[1] * 0.8, SKIN[2] * 0.8]);
  for (let dy = -7; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const e = (dx / 4.3) ** 2 + (dy / 5.3) ** 2;
      const hairE = (dx / 5.2) ** 2 + ((dy + 1) / 6.2) ** 2;
      if (e < 1) put(B, hx + dx, hy + dy, dy < -2.5 + Math.abs(dx) * 0.2 ? P.hair : SKIN);
      else if (hairE < 1 && dy < 3) put(B, hx + dx, hy + dy, P.hair);
    }
  put(B, hx - 2, hy - 1, [40, 30, 30]);
  put(B, hx + 1, hy - 1, [40, 30, 30]);
  put(B, hx - 0.5, hy + 2, [170, 90, 90]);
  // The arm towards the map: she points at each symbol in turn, 2.5 s each, and
  // after the fourth drops her hand to her side for a beat.
  const sx = hx + 9;
  const sy = hy + 10;
  const k = u / 2.5;
  const i = Math.floor(k);
  const f = smooth(0, 0.3, k - i);
  const spot = (n) => {
    const j = ((n % 5) + 5) % 5;
    if (j === 4) return [hx + 10, hy + 26];
    const sp = show.spots[j];
    const dx = sp[1] - 3 - sx;
    const dy = sp[2] - sy;
    const d = Math.sqrt(dx * dx + dy * dy);
    const r = Math.min(d, 22);
    return [sx + (dx / d) * r, sy + (dy / d) * r];
  };
  const a = spot(i - 1);
  const b = spot(i);
  const hxp = a[0] + (b[0] - a[0]) * f;
  const hyp = a[1] + (b[1] - a[1]) * f;
  const mx = (sx + hxp) / 2;
  const my = (sy + hyp) / 2 + 5;
  const sleeve = [J[0] * 1.15, J[1] * 1.15, J[2] * 1.15];
  for (let q = 0; q <= 1; q += 0.05) {
    disc(B, sx + (mx - sx) * q, sy + (my - sy) * q, 1.7, sleeve);
    disc(B, mx + (hxp - mx) * q, my + (hyp - my) * q, 1.4, sleeve);
  }
  disc(B, hxp, hyp, 1.3, SKIN);
}

// How deep the station has faded at forecast time u: a deep fade every 6 to 8 s,
// the first 4.2 s in, and a shallow one between each pair.
function fades(u) {
  let d = 0;
  const k0 = Math.floor((u - 4.2) / 7);
  for (let k = k0 - 1; k <= k0 + 1; k++) {
    const at = 4.2 + 7 * k + (k > 0 ? (hash2(k, 1, 9) - 0.5) * 1.6 : 0);
    d += Math.exp(-(((u - at) / 0.75) ** 2));
    d += (0.3 + 0.15 * hash2(k, 2, 9)) * Math.exp(-(((u - at - 3.5) / 0.45) ** 2));
  }
  return d;
}

// The tint control: a turn round the grey axis.
function tintMatrix(m, hue) {
  const a = hue * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const q = (1 - c) / 3;
  const r3 = Math.sqrt(1 / 3) * s;
  m[0] = c + q;
  m[1] = q - r3;
  m[2] = q + r3;
  m[3] = q + r3;
  m[4] = c + q;
  m[5] = q - r3;
  m[6] = q - r3;
  m[7] = q + r3;
  m[8] = c + q;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  const speed = clamp(k[1], 0.2, 3);
  const sig = clamp(k[2], 0, 1);
  P.ghost = clamp(k[3], 0, 1);
  if (k[0] !== P.tint) {
    P.tint = k[0];
    tintMatrix(P.m, k[0]);
  }
  P.t += dt;
  P.u += (dt * speed) / 2;
  P.frame++;
  // The signal wanders a little, flutters as aircraft pass, and fades.
  const u = P.u;
  P.s = clamp(0.76 + 0.24 * sig + 0.05 * Math.sin((2 * Math.PI * u) / 3.1) - (1 - 0.75 * sig) * fades(u) + 0.04 * Math.sin(P.t * 11), 0, 1);
  // When the sync pulses sink into the noise the vertical hold slips and the picture
  // rolls; once the signal is back it rolls on to the next whole frame and locks there.
  if (input.btnPressed && input.btnPressed[0]) P.slap = Math.floor(P.phi) + 1;
  const slipping = P.s < 0.3 || P.slap > P.phi + 0.35;
  if (slipping) P.rv += (0.9 - P.rv) * Math.min(1, dt * 2.5);
  else if (P.rv > 0) P.rv = Math.max(0.3, P.rv - dt * 0.6);
  if (P.rv > 0) {
    const next = Math.floor(P.phi) + 1;
    P.phi += P.rv * dt;
    if (!slipping && P.phi >= next) {
      P.phi = next;
      P.rv = 0;
    }
  }
  // Lines lose their place sideways as the signal weakens.
  const tear = smooth(0.6, 0.15, P.s) * 12;
  const jit = 0.4 + 1.2 * (1 - P.s);
  for (let y = 0; y < H; y++) {
    const band = Math.sin(y * 0.09 + P.t * 1.7) * Math.sin(y * 0.031 - P.t * 0.6);
    P.tear[y] = Math.round(tear * Math.max(0, band) + (hash2(y, P.frame, 7) - 0.5) * 2 * jit);
  }
  broadcast(P);
  // The tint control, and the colour killer: below a usable signal the set drops
  // the colour and shows the picture in black and white.
  const m = P.m;
  const kill = smooth(0.3, 0.6, P.s);
  const B = P.buf;
  const out = P.pic;
  for (let o = 0; o < N * 3; o += 3) {
    const r = B[o];
    const g = B[o + 1];
    const b = B[o + 2];
    const grey = (r + g + b) / 3;
    out[o] = grey + (r * m[0] + g * m[1] + b * m[2] - grey) * kill;
    out[o + 1] = grey + (r * m[3] + g * m[4] + b * m[5] - grey) * kill;
    out[o + 2] = grey + (r * m[6] + g * m[7] + b * m[8] - grey) * kill;
  }
  // The snow: the set redraws one field of lines a frame, odd then even.
  // The colour grain goes with the colour: the killer greys the snow too.
  let rs = P.rs;
  const S = P.snow;
  const chroma = 0.06 * kill;
  for (let y = P.frame & 1; y < H; y += 2)
    for (let x = 0; x < W; x++) {
      rs ^= rs << 13;
      rs ^= rs >>> 17;
      rs ^= rs << 5;
      const v = rs >>> 0;
      // Twelve steps of grey, a faint cast of colour on some grains, and now and
      // then a white spark.
      let l = Math.floor((((v & 255) + ((v >>> 8) & 255)) / 511) * 12) / 11;
      if (((v >>> 16) & 255) > 250) l = 1;
      const o = (y * W + x) * 3;
      const jr = (((v >>> 24) & 3) - 1) * chroma;
      const jb = (((v >>> 26) & 3) - 1) * chroma;
      S[o] = l + jr;
      S[o + 1] = l;
      S[o + 2] = l + jb;
    }
  P.rs = rs;
}

export function draw(display, params) {
  const P = params;
  const pic = P.pic;
  const S = P.snow;
  const s = P.s;
  // The picture holds on longer than the signal's share says, and the set's gain
  // turns the snow up bright when there is nothing else to show.
  const gs = 255 * (1.4 * (1 - s) * (1 - s) + 0.03);
  const gd = Math.round(4 + 15 * P.ghost);
  const ga = 0.22 + 0.5 * P.ghost;
  // The echo shares the set's gain with the direct picture.
  const gp = Math.pow(s, 0.6) / (1 + ga);
  const roll = Math.floor(P.phi * C);
  const data = (P.frame >> 1) * 31;
  for (let y = 0; y < H; y++) {
    const sy = (y + roll) % C;
    const bar = sy >= H;
    const row = sy * W;
    const shift = P.tear[y];
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = 0;
      let g = 0;
      let b = 0;
      if (bar) {
        // Teletext rides in the blanking: two lines of white dashes.
        const line = sy - H;
        if ((line === 3 || line === 5) && hash2(x >> 1, data + line, 3) > 0.5) r = g = b = 200;
      } else {
        const sx = (((x - shift) % (W + HB)) + W + HB) % (W + HB);
        if (sx < W) {
          const o = (row + sx) * 3;
          r = pic[o];
          g = pic[o + 1];
          b = pic[o + 2];
          const gx = sx - gd;
          if (gx >= 0) {
            const q = (row + gx) * 3;
            r += pic[q] * ga;
            g += pic[q + 1] * ga;
            b += pic[q + 2] * ga;
          }
        }
      }
      const o = p * 3;
      const v = P.tube[p];
      r = (r * gp + S[o] * gs) * v;
      g = (g * gp + S[o + 1] * gs) * v;
      b = (b * gp + S[o + 2] * gs) * v;
      display.setPixel(x, y, r > 255 ? 255 : r < 0 ? 0 : r, g > 255 ? 255 : g < 0 ? 0 : g, b > 255 ? 255 : b < 0 ? 0 : b);
    }
  }
}
