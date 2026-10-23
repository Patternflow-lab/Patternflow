// ===== Patternflow pattern =====
// Title:   Analemma
// Family:  celestial
// Idea:    A camera fixed over the sea photographs the Sun at the same clock time every ten days for a year, and the exposures pile up into a tall figure eight that leans with the hour.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: analemma photographs, a year of exposures of the Sun at one clock time on one frame
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hour=-1..1, Speed=0.2..3, Latitude=-1..1, Orbit=0..1
//
// Knob 1: Hour. The clock time the shutter fires: noon in the middle stands the eight upright over the south; 8 in the morning at the left end turns the camera to the east-south-east and lays the eight over, summer end high on the left, and 4 in the afternoon at the right end does the same to the west. The sky is lit by the Sun at that hour, golden on winter mornings and evenings.
// Knob 2: Speed. Days a second: 20 at 2, so a year passes in 18 seconds; 2 at the bottom, 30 at the top.
// Knob 3: Latitude. Where the camera stands: 52.5 degrees north in the middle, 40 at the left end where the noon eight climbs to 73 degrees, 65 at the right end where the winter Sun barely clears the sea.
// Knob 4: Orbit. The first tenth is Earth's orbit; turned up it moves out to Mars's, more eccentric and more tilted, with a longer year and a smaller Sun, and the eight swells into a teardrop.
// Buttons: K1 tap pins the day's date beside that day's Sun for four seconds; away from Earth's orbit it counts days from the start of the year.

const W = 64;
const H = 128;
const N = W * H;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
// LEDs per degree of sky, and the row the sea's horizon sits on.
const K = 1.4;
const HZ = 109;
const CX = W / 2;
// Entries in the glare table, by squared distance in LEDs.
const GLOW = 16384;
// Cumulus clouds round the compass.
const CLOUDS = 22;
// Exposures a year, one every ten days.
const SHOTS = 36;
// Earth and Mars: eccentricity, obliquity, the Sun's longitude at perihelion,
// the orbit's size in AU.
const EARTH = [0.0167, 23.44 * DEG, 282.9 * DEG, 1];
const MARS = [0.0934, 25.19 * DEG, 251.0 * DEG, 1.524];
const YEAR = 365.2422;
// Perihelion falls on 3 January.
const PERI = 3 / YEAR;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// A 3x5 font, each glyph five rows of three bits.
const FONT = {
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  J: [1, 1, 1, 5, 2],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  Y: [5, 5, 2, 2, 2],
  0: [7, 5, 5, 5, 7],
  1: [2, 6, 2, 2, 7],
  2: [6, 1, 2, 4, 7],
  3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1],
  5: [7, 4, 6, 1, 6],
  6: [3, 4, 7, 5, 7],
  7: [7, 1, 1, 2, 2],
  8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 6],
};

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

export function setup(params) {
  const P = params;
  P.frame = new Float32Array(N * 3);
  P.sx = new Float32Array(SHOTS);
  P.sy = new Float32Array(SHOTS);
  P.pos = [0, 0, 0];
  // How far through the year, and seconds since the year turned.
  P.phase = 0.6;
  P.turned = 9;
  P.clock = 0;
  P.pin = null;
  P.hour = 12;
  P.lat = 52.5 * DEG;
  P.orb = EARTH.slice();
  P.speed = 20;
  P.az0 = Math.PI;
  // Fair-weather cumulus round the compass, each a few round puffs on a
  // flat base: azimuth, base altitude and the puffs' offsets and radii, in
  // degrees.
  P.clouds = [];
  for (let c = 0; c < CLOUDS; c++) {
    const wide = 5 + 9 * Math.random();
    const tall = 2 + 2.6 * Math.random();
    const puffs = [];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const r = tall * (0.5 + 0.5 * Math.sin((Math.PI * (k + 0.5)) / n)) * (0.75 + 0.4 * Math.random());
      puffs.push([((k + 0.5) / n - 0.5) * wide, r * 0.75, r]);
    }
    P.clouds.push({ az: (c + 0.3 + 0.4 * Math.random()) * (360 / CLOUDS), base: 1.2 + 2.2 * Math.random(), wide, puffs });
  }
  P.wind = 0;
  P.colW = new Float32Array(W);
  P.glowT = new Float32Array(GLOW);
  for (let i = 0; i < GLOW; i++) {
    const d = Math.sqrt(i);
    P.glowT[i] = 0.5 * Math.exp(-d / 5) + 0.22 * Math.exp(-d / 20);
  }
}

// The Sun at a share `ph` of the year: where it shows on the panel, and its
// altitude in degrees, into out.
function sunAt(P, ph, out) {
  const e = P.orb[0];
  const eps = P.orb[1];
  const lp = P.orb[2];
  // Mean anomaly, then Kepler's equation for the eccentric anomaly.
  const M = TAU * (ph - PERI);
  let E = M;
  for (let i = 0; i < 6; i++) E = M + e * Math.sin(E);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  // The Sun's ecliptic longitude, its declination and right ascension.
  const lam = nu + lp;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  // The equation of time: the mean Sun's longitude against the true Sun's
  // right ascension, the gap between clock and sundial.
  let eot = M + lp - ra;
  eot -= Math.round(eot / TAU) * TAU;
  // The hour angle at this clock time, then altitude and azimuth.
  const ha = (P.hour - 12) * 15 * DEG + eot;
  const sl = Math.sin(P.lat);
  const cl = Math.cos(P.lat);
  const up = sl * Math.sin(dec) + cl * Math.cos(dec) * Math.cos(ha);
  const north = cl * Math.sin(dec) - sl * Math.cos(dec) * Math.cos(ha);
  const east = -Math.cos(dec) * Math.sin(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, up)));
  let daz = Math.atan2(east, north) - P.az0;
  daz -= Math.round(daz / TAU) * TAU;
  out[0] = CX + (daz / DEG) * Math.cos(alt) * K;
  out[1] = HZ - (alt / DEG) * K;
  out[2] = alt / DEG;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  P.clock += dt;
  P.hour = 12 + 4 * Math.max(-1, Math.min(1, k[0]));
  P.lat = (52.5 + 12.5 * Math.max(-1, Math.min(1, k[2]))) * DEG;
  const w = clamp01((k[3] - 0.1) / 0.9);
  for (let i = 0; i < 4; i++) P.orb[i] = mix(EARTH[i], MARS[i], w);
  // Kepler's third law: the year grows as the orbit's size to the power 1.5.
  P.year = YEAR * Math.pow(P.orb[3], 1.5);
  P.speed = 10 * Math.max(0.2, Math.min(3, k[1]));
  // The camera faces where the Sun stands at this hour at an equinox.
  const ha = (P.hour - 12) * 15 * DEG;
  const sl = Math.sin(P.lat);
  P.az0 = Math.atan2(-Math.sin(ha), -sl * Math.cos(ha));

  P.phase += (dt * P.speed) / P.year;
  P.turned += dt;
  // The clouds drift east to west at a degree every two seconds.
  P.wind += dt * 0.5;
  if (P.phase >= 1) {
    P.phase -= 1;
    P.turned = 0;
  }
  if (input.btnPressed && input.btnPressed[0]) P.pin = { ph: P.phase, age: 0 };
  if (P.pin) {
    P.pin.age += dt;
    if (P.pin.age > 4) P.pin = null;
  }

  for (let j = 0; j < SHOTS; j++) {
    sunAt(P, (j + 0.5) / SHOTS, P.pos);
    P.sx[j] = P.pos[0];
    P.sy[j] = P.pos[1];
  }
  sunAt(P, P.phase, P.pos);
  P.sun = [P.pos[0], P.pos[1], P.pos[2]];
}

// A disc of the Sun with a soft edge, laid over the frame with opacity op.
function disc(out, x, y, rad, op, r, g, b) {
  for (let yy = Math.floor(y - rad - 1); yy <= Math.ceil(y + rad + 1); yy++) {
    if (yy < 0 || yy >= HZ) continue;
    for (let xx = Math.floor(x - rad - 1); xx <= Math.ceil(x + rad + 1); xx++) {
      if (xx < 0 || xx >= W) continue;
      const dx = xx + 0.5 - x;
      const dy = yy + 0.5 - y;
      const a = clamp01(rad + 0.5 - Math.sqrt(dx * dx + dy * dy)) * op;
      if (a <= 0) continue;
      const p = (yy * W + xx) * 3;
      out[p] += (r - out[p]) * a;
      out[p + 1] += (g - out[p + 1]) * a;
      out[p + 2] += (b - out[p + 2]) * a;
    }
  }
}

// Land on the horizon, in degrees, at azimuth az: a headland in the east, one
// in the west, and the rock the lighthouse stands on a little east of south.
function land(az) {
  const a = az / DEG;
  let h = 0;
  if (a > 68 && a < 122) h = Math.max(h, 2.6 * Math.sin(((a - 68) / 54) * Math.PI) ** 0.6 + 0.5 * Math.sin(a * 0.9));
  if (a > 236 && a < 294) h = Math.max(h, 3.2 * Math.sin(((a - 236) / 58) * Math.PI) ** 0.7 + 0.4 * Math.sin(a * 1.3));
  if (a > 164.5 && a < 171.5) h = Math.max(h, 1.1 * Math.sin(((a - 164.5) / 7) * Math.PI) ** 0.5);
  return h;
}

export function draw(display, params) {
  const P = params;
  const out = P.frame;
  const sun = P.sun;
  const hs = sun[2];
  const t = P.clock;

  // The sky's colours from the Sun's height: night, a low golden Sun, a pale
  // hazy sky while the Sun is low, deep blue when it stands high.
  const f = smooth(-7, 2, hs);
  const g = smooth(2, 16, hs);
  const q = smooth(14, 58, hs);
  const zr = mix(mix(mix(4, 26, f), 34, g), 8, q);
  const zg = mix(mix(mix(8, 34, f), 62, g), 34, q);
  const zb = mix(mix(mix(28, 96, f), 134, g), 116, q);
  const hr = mix(mix(mix(20, 214, f), 172, g), 64, q);
  const hg = mix(mix(mix(22, 116, f), 156, g), 110, q);
  const hb = mix(mix(mix(52, 74, f), 138, g), 174, q);
  // Sunlight colour: orange low down, white-yellow high up.
  const lr = 255;
  const lg = mix(150, 228, g);
  const lb = mix(70, 170, g);
  const up = smooth(-3, 1, hs);

  // Glare round the Sun from a table by squared distance, and a warmer
  // horizon on the Sun's side while it is low.
  const glowT = P.glowT;
  const warm = (1 - g) * f * 0.35;
  const colW = P.colW;
  for (let x = 0; x < W; x++) colW[x] = Math.exp(-Math.abs(x + 0.5 - sun[0]) / 26);
  for (let y = 0; y < HZ; y++) {
    const alt = (HZ - y - 0.5) / K;
    const v = Math.pow(clamp01(alt / 62), 0.55);
    const br = mix(hr, zr, v);
    const bg = mix(hg, zg, v);
    const bb = mix(hb, zb, v);
    const rowW = warm * Math.exp(-alt / 7);
    const dy = y + 0.5 - sun[1];
    const dy2 = dy * dy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - sun[0];
      const d2 = dx * dx + dy2;
      const glow = Math.min(1, up * glowT[d2 < GLOW ? d2 | 0 : GLOW - 1] + rowW * colW[x]);
      const p = (y * W + x) * 3;
      out[p] = br + (lr - br) * glow;
      out[p + 1] = bg + (lg - bg) * glow;
      out[p + 2] = bb + (lb - bb) * glow;
    }
  }

  // Cumulus low over the sea, in the frame the exposures were laid over: lit
  // on top in the sunlight's colour, grey underneath, flat at the base.
  for (const cl of P.clouds) {
    let daz = cl.az + P.wind - P.az0 / DEG;
    daz -= Math.round(daz / 360) * 360;
    const cx = CX + daz * K;
    if (cx < -cl.wide * K || cx > W + cl.wide * K) continue;
    const baseY = HZ - cl.base * K;
    let topY = baseY;
    for (const pf of cl.puffs) topY = Math.min(topY, baseY - (pf[1] + pf[2]) * K);
    for (let y = Math.max(0, Math.floor(topY - 1)); y < Math.min(HZ, Math.ceil(baseY + 1)); y++) {
      const py = y + 0.5;
      const flat = clamp01(baseY - py + 0.5);
      if (flat <= 0) continue;
      for (let x = Math.max(0, Math.floor(cx - cl.wide * K)); x < Math.min(W, Math.ceil(cx + cl.wide * K)); x++) {
        const px = x + 0.5;
        let c = 0;
        let lit = 0;
        for (const pf of cl.puffs) {
          const bx = cx + pf[0] * K;
          const by = baseY - pf[1] * K;
          const r = pf[2] * K;
          const dx = px - bx;
          const dy = py - by;
          const d = Math.sqrt(dx * dx + dy * dy);
          const a = clamp01(r + 0.5 - d);
          if (a > c) {
            c = a;
            lit = clamp01(0.5 - dy / r);
          }
        }
        c *= flat;
        if (c <= 0) continue;
        const p = (y * W + x) * 3;
        const cr = mix(hr * 0.78, mix(lr, 255, 0.4 + 0.4 * g), lit);
        const cg = mix(hg * 0.78, mix(lg, 252, 0.4 + 0.4 * g), lit);
        const cb = mix(hb * 0.82, mix(lb, 248, 0.4 + 0.4 * g), lit);
        out[p] += (cr - out[p]) * c * 0.94;
        out[p + 1] += (cg - out[p + 1]) * c * 0.94;
        out[p + 2] += (cb - out[p + 2]) * c * 0.94;
      }
    }
  }

  // The exposures. Those already taken this year are bright; the rest are
  // last year's, kept faint, and each fills in as its week comes round.
  // At the turn of the year the whole eight fades back to that faint level.
  const size = 1.6 / P.orb[3];
  const faded = 0.32 + 0.68 * clamp01(1 - P.turned / 0.7);
  for (let j = 0; j < SHOTS; j++) {
    const ph = (j + 0.5) / SHOTS;
    const taken = ph <= P.phase;
    let op = taken ? 1 : faded;
    let rad = size;
    if (taken) {
      // Seconds since this exposure: a flash as the shutter fires.
      const age = ((P.phase - ph) * P.year) / P.speed;
      const flash = clamp01(1 - age / 0.25);
      rad += 0.9 * flash;
    }
    disc(out, P.sx[j], P.sy[j], rad, op, 255, 238, 196);
  }
  // The Sun itself, now.
  disc(out, sun[0], sun[1], size + 0.6, 1, 255, 252, 236);

  // The sea: it holds the horizon's light near the horizon and darkens
  // towards the camera, with slow swell and the Sun's glitter path.
  const depthR = mix(2, 4, g);
  const depthG = mix(6, 16, g);
  const depthB = mix(18, 40, g);
  const sunUp = hs > -1;
  for (let y = HZ; y < H; y++) {
    const k = (y - HZ + 0.5) / (H - HZ);
    const s = Math.sqrt(k);
    const br = mix(hr * 0.62, depthR, s);
    const bg = mix(hg * 0.62, depthG, s);
    const bb = mix(hb * 0.62, depthB, s);
    const width = 0.7 + 6.5 * k;
    // Distance out to sea: the wavelets crowd together toward the horizon.
    const z = 1 / (k + 0.1);
    const fx = 0.3 + 0.9 * k;
    for (let x = 0; x < W; x++) {
      const along = Math.sin(x * fx * 0.5 + z * 0.8 + t * 0.7);
      const swell = 0.8 + 0.3 * Math.sin(z * 3.3 - t * 1.4 + 0.7 * along) * (0.5 + 0.5 * Math.sin(x * fx * 1.3 - z * 2.1 + t * 0.5));
      let r = br * swell;
      let gg = bg * swell;
      let b = bb * swell;
      if (sunUp) {
        const dx = (x + 0.5 - sun[0]) / width;
        const path = Math.exp(-dx * dx) * up;
        if (path > 0.01) {
          const s1 = 0.5 + 0.5 * Math.sin(x * 2.3 + y * 3.1 + t * 4.7);
          const s2 = 0.5 + 0.5 * Math.sin(x * 1.1 - y * 2.3 - t * 3.9 + 1.3);
          const glint = path * (0.25 + 1.1 * Math.pow(s1 * s2, 3));
          r += (lr - r) * Math.min(1, glint);
          gg += (lg - gg) * Math.min(1, glint);
          b += (lb - b) * Math.min(1, glint);
        }
      }
      const p = (y * W + x) * 3;
      out[p] = r;
      out[p + 1] = gg;
      out[p + 2] = b;
    }
  }

  // Land along the horizon, hazed toward the sky's colour by distance.
  const landR = mix(hr, 10, 0.62);
  const landG = mix(hg, 16, 0.62);
  const landB = mix(hb, 28, 0.62);
  let tower = -1;
  for (let x = 0; x < W; x++) {
    let az = P.az0 + (x + 0.5 - CX) / K * DEG;
    az -= Math.floor(az / TAU) * TAU;
    const h = land(az) * K;
    if (Math.abs(az / DEG - 168) < 0.5 / K) tower = x;
    for (let y = Math.floor(HZ - h); y < HZ; y++) {
      const a = clamp01(HZ - h - y > 0 ? 0 : Math.min(1, h - (HZ - y - 1)));
      const p = (y * W + x) * 3;
      out[p] += (landR - out[p]) * a;
      out[p + 1] += (landG - out[p + 1]) * a;
      out[p + 2] += (landB - out[p + 2]) * a;
    }
  }
  // The lighthouse: a white tower with a red band and a lantern that is lit
  // while the Sun is low.
  if (tower >= 0) {
    const lamp = 1 - g;
    for (let j = 0; j < 12; j++) {
      const y = HZ - 2 - j;
      for (let x = tower - 1; x <= tower; x++) {
        if (x < 0 || x >= W) continue;
        const p = (y * W + x) * 3;
        let r = 222;
        let gg = 226;
        let b = 230;
        if (j >= 4 && j <= 6) {
          r = 196;
          gg = 40;
          b = 40;
        }
        if (j >= 9) {
          r = mix(40, 255, lamp);
          gg = mix(40, 214, lamp);
          b = mix(46, 130, lamp);
        }
        if (j === 11) {
          r = 36;
          gg = 30;
          b = 30;
        }
        const shade = x === tower - 1 ? 1 : 0.72;
        out[p] = r * shade;
        out[p + 1] = gg * shade;
        out[p + 2] = b * shade;
      }
    }
  }

  // A tap pins the day's date beside its place on the eight.
  if (P.pin) {
    const fade = clamp01(Math.min(P.pin.age / 0.2, (4 - P.pin.age) / 0.5));
    sunAt(P, P.pin.ph, P.pos);
    let text;
    if (P.orb[3] < 1.001) {
      let d = Math.floor(P.pin.ph * YEAR);
      let m = 0;
      while (m < 11 && d >= MDAYS[m]) d -= MDAYS[m++];
      text = MONTHS[m] + " " + (d + 1);
    } else text = "DAY " + (Math.floor(P.pin.ph * P.year) + 1);
    const tw = text.length * 4 - 1;
    const tx = P.pos[0] + 6 + tw < W - 1 ? Math.round(P.pos[0] + 6) : Math.round(P.pos[0] - 6 - tw);
    const ty = Math.round(Math.max(2, Math.min(HZ - 8, P.pos[1] - 2)));
    for (let c = 0; c < text.length; c++) {
      const glyph = FONT[text[c]];
      if (!glyph) continue;
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++) {
          if (!((glyph[row] >> (2 - col)) & 1)) continue;
          const x = tx + c * 4 + col;
          const y = ty + row;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const p = (y * W + x) * 3;
          out[p] += (255 - out[p]) * fade;
          out[p + 1] += (255 - out[p + 1]) * fade;
          out[p + 2] += (255 - out[p + 2]) * fade;
        }
    }
    // A ring round that day's Sun.
    for (let a = 0; a < 24; a++) {
      const x = Math.floor(P.pos[0] + 3.6 * Math.cos((a * TAU) / 24));
      const y = Math.floor(P.pos[1] + 3.6 * Math.sin((a * TAU) / 24));
      if (x < 0 || x >= W || y < 0 || y >= HZ) continue;
      const p = (y * W + x) * 3;
      out[p] += (255 - out[p]) * fade * 0.8;
      out[p + 1] += (255 - out[p + 1]) * fade * 0.8;
      out[p + 2] += (255 - out[p + 2]) * fade * 0.8;
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, out[p]), Math.min(255, out[p + 1]), Math.min(255, out[p + 2]));
    }
}
