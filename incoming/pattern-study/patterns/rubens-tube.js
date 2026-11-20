// ===== Patternflow pattern =====
// Title:   Rubens Tube
// Family:  acoustics
// Idea:    A gas pipe runs down the left edge with forty burning ports and a loudspeaker at one end, and every flame lies out to the right as long as the sound is loud at its port: at each pitch the pipe fits, the flames rise and sink in a clean comb of tall crests and short stubs, between pitches they stay low and shudder, and as the gas warms the resonance drifts, so the comb slowly fades and returns while its nodes creep along the pipe.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rubens tube, Heinrich Rubens and Otto Krigar-Menzel (1905), the flame tube demonstration of standing sound waves
// Round:   202
// ===============================
// @matrix 64x128
// @knobs Flame=0..1, Gas=0..10, Pitch=-2..5, Volume=0..0.1
//
// Knob 1: Flame. The gas that burns: orange coal gas where it opens, then green copper salts, blue methane and violet round the wheel, each with a pale core at the port.
// Knob 2: Gas. How long the flames are with no sound, 3 LEDs at the bottom, 7 where it opens and 22 at the top; at the nodes of the wave they fall back to this length.
// Knob 3: Pitch. The pitch the loudspeaker plays, from the pipe's first resonance at the bottom to its eighth at the top, where it opens on the third: at each whole step the comb has one more node, and in between the flames sink low and shudder.
// Knob 4: Volume. How loud it plays: quiet and even flames at the bottom, clear tall crests where it opens, and at the top the tallest tongues tear off in bright puffs that drift away.

const W = 64;
const H = 128;
// Forty ports 3 LEDs apart down the pipe, each on the edge between two rows, the first at 6. The rail is the two columns at the left, and the flames start at X0.
const NP = 40;
const PY0 = 6;
const PDY = 3;
const X0 = 2;
// How far a flame can reach from X0.
const LMAX = 60;
// The pipe: the far end reflects RFAR of the sound, the loudspeaker end RNEAR, and a round trip keeps their product RR. The resonances drift by DRIFT with the heat of the gas.
const RFAR = 0.8;
const RNEAR = 0.56;
const RR = RFAR * RNEAR;
const DRIFT = 0.032;
const STEPS = 256;
const MAXPUFF = 48;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x, seed) {
  const ix = Math.floor(x);
  let f = x - ix;
  f = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash(ix, seed);
  const b = hash(ix + 1, seed);
  return 2 * (a + (b - a) * f) - 1;
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return 2 * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) - 1;
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// The bend of one flame at u (0 at the port, 1 at the tip), in LEDs: the gust that rolls along the pipe, a quicker ripple carried down the flame, and a lean to the top of the panel.
function sway(i, u, len, t) {
  const gust = noise2(i * 0.17 + 11.3, t * 0.33);
  const ripple = noise2(i * 0.45 + 2.2, t * 1.25 - u * len * 0.05);
  return (1.25 * gust + 0.8 * ripple - 0.55) * Math.min(1, len / 24) * 1.5 * Math.pow(u, 1.5);
}

export function setup(params) {
  params.t = 0;
  params.f = 3;
  params.v = 0.6;
  params.base = 7;
  params.init = false;
  params.hue = -1;
  // The sound pressure at each port, relaxed toward what the drive would make of it.
  params.E = new Float32Array(NP);
  params.len = new Float32Array(NP);
  params.drive = new Float32Array(NP);
  params.tear = new Float32Array(NP);
  params.gu = new Float32Array(NP);
  params.puffs = [];
  params.q = new Float32Array(W * H);
  params.core = new Float32Array(W * H);
  params.lut = new Float32Array(STEPS * 3);
  params.coreRgb = [255, 255, 255];
  params.rowGlow = new Float32Array(H);
  params.drift = 0;
}

function makeLut(params, hue) {
  const out = [0, 0, 0];
  for (let n = 0; n < STEPS; n++) {
    const q = n / (STEPS - 1);
    const f = smooth(0, 0.1, q);
    const h = hue + 0.12 * (q - 0.55);
    const s = 1 - 0.62 * smooth(0.72, 1, q);
    const v = f * (0.4 + 0.6 * q);
    hsv(h, s, v, out);
    params.lut[n * 3] = out[0] * 255;
    params.lut[n * 3 + 1] = out[1] * 255;
    params.lut[n * 3 + 2] = out[2] * 255;
  }
  // The pale core of each port: bluish white on a warm flame, a cooler white on a blue or violet one.
  const hm = hue - Math.floor(hue);
  hsv(hm < 0.3 || hm > 0.95 ? hm + 0.45 : hm - 0.08, 0.28, 1, out);
  params.coreRgb = [out[0] * 255, out[1] * 255, out[2] * 255];
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  if (dt > 0.1) dt = 0.1;
  const t = (params.t += dt);
  const hue = 0.065 + clamp(k[0], 0, 1);
  if (hue !== params.hue) {
    params.hue = hue;
    makeLut(params, hue);
  }
  const base = 3 + 1.9 * clamp(k[1], 0, 10);
  params.base = base;
  // The loudspeaker's pitch is not quite steady either.
  const f = clamp(3 + k[2] + 0.04 * Math.sin(0.267 * t + 2.4) + 0.025 * Math.sin(0.419 * t + 0.3), 0.4, 9);
  const vt = clamp(k[3] / 0.1, 0, 1);
  if (!params.init) {
    params.v = vt;
  } else {
    params.v += (vt - params.v) * (1 - Math.exp(-dt * 5));
  }
  // The loudspeaker's output wanders by a tenth.
  const V = clamp(params.v * (1 + 0.09 * Math.sin(0.239 * t + 1) + 0.06 * Math.sin(0.153 * t + 4.2)), 0, 1.2);
  // The gas warms and cools, and the pipe's resonances move with it, on periods that never line up.
  const d = DRIFT * (0.42 * Math.sin(0.1865 * t + 0.6) + 0.3 * Math.sin(0.2869 * t + 2.1) + 0.18 * Math.sin(0.1097 * t + 4) + 0.1 * Math.sin(0.4394 * t + 1.3));
  params.drift = d;
  // The far end is not a perfect wall: how it reflects wanders a little with the heat as well.
  const ph = 0.22 * (0.6 * Math.sin(0.173 * t + 5.1) + 0.4 * Math.sin(0.331 * t + 2.2));
  // The wave number across the pipe, so that the pipe is one half wavelength long at f = 1.
  const kk = (Math.PI * f) / (1 + d);
  const den2 = 1 + RR * RR - 2 * RR * Math.cos(2 * kk + ph);
  const rise = 1 - Math.exp(-dt * 3.2);
  const decay = Math.exp(-dt / 0.45);
  const puffs = params.puffs;
  for (let i = 0; i < NP; i++) {
    // Forward wave from the loudspeaker plus its reflection from the far end, over the sum of all the round trips in between.
    const s = (i + 0.5) / NP;
    const num2 = 1 + RFAR * RFAR + 2 * RFAR * Math.cos(2 * kk * (1 - s) + ph);
    const Et = (Math.sqrt(num2 / den2) * (1 - RR)) / (1 + RFAR);
    if (!params.init) params.E[i] = Et;
    else params.E[i] += (Et - params.E[i]) * rise;
    const E = params.E[i];
    const x = V * Math.pow(E, 1.4);
    params.drive[i] = x;
    const ex = 1 - Math.exp(-2.1 * x);
    // How restless the flame is: it shudders most where the wave is weak.
    const shud = 0.02 + 0.09 * (1 - Math.min(1, E));
    // A puff of draught takes a handful of neighbouring flames together.
    const gu = noise2(i * 0.22 + 40.3, t * 1.1);
    params.gu[i] = gu;
    const fl = 1 + shud * noise1(t * 2.9 + i * 3.1, 7) + 0.035 * noise1(t * 6.7 + i * 1.7, 8) + 0.07 * gu;
    params.tear[i] *= decay;
    // The gas pressure along the pipe rises and falls over tens of seconds, so groups of flames grow and shrink together.
    const gas = 1 + 0.42 * noise2(i * 0.3 + 4.7, t / 22 + 2.3);
    const bi = base * gas;
    const swell = 1 + 0.3 * noise2(i * 0.33 + 9.1, t / 16 + 6.4);
    let len = (bi + (LMAX - bi) * ex) * swell * fl * (1 - 0.2 * params.tear[i]);
    if (len < 2.5) len = 2.5;
    params.len[i] = len;
    // The tallest tongues tear a puff off at the tip.
    if (x > 0.62 && params.tear[i] < 0.3 && puffs.length < MAXPUFF) {
      const rate = 1.3 * ((x - 0.62) / 0.38);
      if (Math.random() < rate * dt) {
        const yi = PY0 + i * PDY;
        const tipY = yi + sway(i, 1, len, t);
        puffs.push({
          x: X0 + len * 0.95,
          y: tipY,
          vx: 14 + 10 * Math.random(),
          vy: -1.5 + 3 * (Math.random() - 0.5),
          age: 0,
          life: 0.9 + 0.9 * Math.random(),
          r: 0.9 + 0.5 * Math.random(),
        });
        params.tear[i] = 1;
      }
    }
  }
  params.init = true;
  for (let p = puffs.length - 1; p >= 0; p--) {
    const q = puffs[p];
    q.age += dt;
    q.x += q.vx * dt;
    q.vx *= Math.exp(-dt * 0.45);
    q.y += q.vy * dt;
    q.vy -= 1.2 * dt;
    if (q.age > q.life || q.x > W + 6) puffs.splice(p, 1);
  }
  // Glow in front of the rail, strongest where the flames are long.
  const rg = params.rowGlow;
  rg.fill(0);
  for (let i = 0; i < NP; i++) {
    const w = params.len[i] / LMAX;
    const yi = PY0 + i * PDY;
    const y0 = Math.max(0, Math.floor(yi - 7));
    const y1 = Math.min(H - 1, Math.ceil(yi + 7));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - yi;
      rg[y] += w * Math.exp(-dy * dy / 14);
    }
  }
}

export function draw(display, params) {
  const Q = params.q;
  const CO = params.core;
  Q.fill(0);
  CO.fill(0);
  const t = params.t;
  const base = params.base;
  const hw0 = 1 + 0.012 * (base - 7);
  for (let i = 0; i < NP; i++) {
    const len = params.len[i];
    const yi = PY0 + i * PDY;
    const bright = (0.8 + 0.2 * Math.min(1, params.drive[i] * 1.6)) * (1 + 0.22 * params.gu[i]);
    const xEnd = X0 + len;
    const xa = Math.floor(X0);
    const xb = Math.min(W - 1, Math.floor(xEnd));
    for (let xi = xa; xi <= xb; xi++) {
      let u = (xi + 0.5 - X0) / len;
      if (u < 0) u = 0;
      const xcov = clamp(xEnd - xi, 0, 1);
      const yc = yi + sway(i, u, len, t);
      const tb = noise2(i * 0.8 + 5.1, t * 2.1 - (xi + 0.5) * 0.11);
      const tb2 = noise2(i * 0.6 + 9.7, t * 3.3 - (xi + 0.5) * 0.17);
      const hw = hw0 * (1 - 0.2 * smooth(0.3, 1, u)) * (1 + 0.14 * tb);
      const inten = (1 - 0.8 * Math.pow(u, 1.4)) * (1 + 0.16 * tb2) * bright * xcov * (1 - 0.5 * smooth(0.85, 1, u));
      const ya = Math.max(0, Math.floor(yc - hw));
      const yb = Math.min(H - 1, Math.floor(yc + hw));
      const core = Math.exp(-(xi + 0.5 - X0) / 2.4);
      for (let y = ya; y <= yb; y++) {
        const cov = clamp(Math.min(yc + hw, y + 1) - Math.max(yc - hw, y), 0, 1);
        if (cov <= 0) continue;
        const c = smooth(0.08, 0.92, cov) * inten;
        const o = y * W + xi;
        Q[o] = Q[o] + c - Q[o] * c;
        const cc = cov * core;
        if (cc > CO[o]) CO[o] = cc;
      }
    }
  }
  // Puffs: a bright head with a tail behind it, that cool as they drift off.
  for (let p = 0; p < params.puffs.length; p++) {
    const q = params.puffs[p];
    const a = q.age / q.life;
    const ay = (1.2 + 0.4 * q.r) * (1 - 0.25 * a) + 0.3 * a;
    const axh = 1.8 + 0.5 * q.r;
    const axt = (4.2 + 1.5 * q.r) * (1 - 0.25 * a);
    const inten = 1.0 * Math.pow(1 - a, 1.1);
    const x0 = Math.max(0, Math.floor(q.x - axt - 1));
    const x1 = Math.min(W - 1, Math.ceil(q.x + axh + 1));
    const y0 = Math.max(0, Math.floor(q.y - ay - 1));
    const y1 = Math.min(H - 1, Math.ceil(q.y + ay + 1));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - q.y) / ay;
      for (let x = x0; x <= x1; x++) {
        const ddx = x + 0.5 - q.x;
        let r;
        let g = 1;
        if (ddx > 0) {
          const dx = ddx / axh;
          r = Math.sqrt(dx * dx + dy * dy);
        } else {
          const dx = ddx / axt;
          r = Math.sqrt(dx * dx * 0.55 + dy * dy);
          g = 0.5 + 0.5 * (1 + dx);
        }
        const c = (1 - smooth(0.55, 1.15, r)) * inten * g;
        if (c <= 0) continue;
        const o = y * W + x;
        Q[o] = Q[o] + c - Q[o] * c;
      }
    }
  }
  const lut = params.lut;
  const cr = params.coreRgb;
  const rg = params.rowGlow;
  for (let y = 0; y < H; y++) {
    const gl = 0.16 * Math.min(1.4, rg[y]);
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      let q = Q[o];
      if (x >= X0) q += (1 - q) * gl * Math.exp(-(x - X0) / 3.2);
      const n = (clamp(q, 0, 1) * (STEPS - 1) + 0.5) | 0;
      let r = lut[n * 3];
      let g = lut[n * 3 + 1];
      let b = lut[n * 3 + 2];
      const cw = CO[o] * 0.8 * smooth(0.3, 0.8, Q[o]);
      if (cw > 0) {
        r += (cr[0] - r) * cw;
        g += (cr[1] - g) * cw;
        b += (cr[2] - b) * cw;
      }
      if (x < X0) {
        // The pipe: a dim steel rail, with a lit port where a flame starts.
        r = x === 0 ? 70 : 44;
        g = x === 0 ? 78 : 50;
        b = x === 0 ? 96 : 64;
      }
      display.setPixel(x, y, r, g, b);
    }
  }
  // The ports.
  for (let i = 0; i < NP; i++) {
    const row = Math.round(PY0 + i * PDY) - 1;
    const w = 0.75 + 0.25 * noise1(t * 3.1 + i * 2.3, 9);
    const n = ((0.55 + 0.4 * w) * (STEPS - 1)) | 0;
    display.setPixel(1, row, lut[n * 3], lut[n * 3 + 1], lut[n * 3 + 2]);
    display.setPixel(1, row + 1, lut[n * 3], lut[n * 3 + 1], lut[n * 3 + 2]);
  }
}
