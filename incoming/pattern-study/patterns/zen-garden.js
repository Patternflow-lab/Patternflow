// ===== Patternflow pattern =====
// Title:   Zen Garden
// Family:  line
// Idea:    A dry rock garden seen straight down, where raked grooves bend into rings round mossy stones and a rake redraws them band by band, taking up the maple leaves that fall while cloud shadows drift over.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the karesansui of Ryoan-ji, Kyoto
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Stones=3..5, Wind=0..1
//
// Knob 1: Light. Pale morning sun from the lower right at 0, white noon light at 0.5, low gold evening sun from the lower left at 1, and the stone shadows and the lit side of every ring swing with it.
// Knob 2: Speed. How fast the rake walks and the clouds pass: at 2 the rake draws one 15-row band in about 6.5 seconds.
// Knob 3: Stones. Three, four or five stone groups, each in its moss collar with two or three rings raked round it.
// Knob 4: Wind. Calm at 0 with a leaf every ten seconds or so; at 1 the clouds cover half the garden and run three times as fast, and leaves come down every second and scuff the grooves.

const W = 64;
const H = 128;
const N = W * H;
// Grooves are 3 rows apart and the rake has 5 tines, so it draws a 15-row band per pass.
const PER = 3;
const BAND = 15;
const BANDS = Math.ceil(H / BAND);
// The rake walks 6 columns a garden second, turns in 0.8 s, and rests 3 s at the end of the garden.
const RAKE_V = 6;
const PASS = (W + 10) / RAKE_V + 0.8;
const CYCLE = BANDS * PASS + 3;
const TAU = Math.PI * 2;
// Moss reaches 2.2 LED out from the stones, give or take its ragged edge.
const MOSS = 2.2;
// Sunlight on a groove is SUN_A + SUN_B cos(phase), plus SUN_C sin(phase) as far as the
// slope faces the sun; skylight is SKY_A + SKY_B cos(phase). A cloud takes CLOUD of the sun.
const SUN_A = 0.66;
const SUN_B = 0.28;
const SUN_C = 0.9;
const SKY_A = 0.2;
const SKY_B = 0.04;
const CLOUD = 0.8;
// Each grain of gravel is GRAIN brighter or darker and ADD levels more or less, with its own
// TINT of green and blue. WOB is how far a groove wanders as it wears: at the start knobs the
// oldest grooves stray a tenth of a groove, in full wind a fifth.
const GRAIN = 0.16;
const ADD = 10;
const TINT = 30;
const WOB = 0.3;
// One garden for each Stones setting. A group is a main stone (centre, half-axes, turn,
// height in LED) with its rings, and smaller stones that share its moss bed.
const LAYOUTS = {
  3: [
    [20, 28, 7.5, 5.2, 0.35, 6, 3, [[29.5, 33, 3.0, 2.4, 3]]],
    [44, 71, 6.2, 4.4, -0.5, 5, 3, [[35.5, 66.5, 2.6, 2.1, 2.5], [49, 64, 1.8, 1.5, 1.5]]],
    [20, 107, 5.2, 4.0, 0.9, 4.5, 3, []],
  ],
  4: [
    [18, 22, 7.0, 5.0, 0.3, 6, 3, [[27, 27, 2.8, 2.2, 3]]],
    [46, 51, 5.4, 4.0, -0.6, 4.5, 2, []],
    [19, 83, 5.2, 4.0, 0.7, 5, 3, [[11, 89, 2.4, 2.0, 2], [26, 88, 1.6, 1.4, 1.5]]],
    [46, 111, 4.6, 3.4, -0.2, 4, 2, [[53.5, 107, 1.8, 1.5, 1.5]]],
  ],
  5: [
    [19, 18, 6.5, 4.6, 0.3, 5.5, 3, [[27, 23, 2.6, 2.0, 2.5]]],
    [47, 41, 4.4, 3.4, -0.4, 4, 2, []],
    [20, 65, 5.6, 4.0, 0.8, 5, 3, [[12, 70, 2.2, 1.8, 2], [27, 70, 1.7, 1.4, 1.5]]],
    [46, 89, 4.0, 3.2, 0.1, 4, 2, [[52.5, 94, 1.8, 1.5, 1.5]]],
    [19, 113, 4.6, 3.6, -0.7, 4, 2, []],
  ],
};
// Maple leaves, 5 by 5: lobes, and the stem off one corner.
const LEAF = ["..#..", "#.#.#", "#####", ".###.", "..#.#"];
const LEAF_COL = [[205, 46, 24], [226, 104, 20], [176, 28, 32], [214, 150, 30]];
const COS = new Float32Array(1024);
const SIN = new Float32Array(1024);
for (let i = 0; i < 1024; i++) {
  COS[i] = Math.cos((TAU * i) / 1024);
  SIN[i] = Math.sin((TAU * i) / 1024);
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Colours go out in steps of 8 levels, so the gravel's grain is a few dozen colours, not thousands.
const QZ = (v) => (v <= 0 ? 0 : v >= 252 ? 255 : ((v / 8 + 0.5) | 0) * 8);
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// The sun for a Light setting: direction towards it across the garden, how long a
// shadow is per unit of height, and the colours of sunlight and of the sky in shade.
function sun(k) {
  const az = Math.PI * (0.22 + 0.56 * k);
  const elev = 0.32 + 0.75 * Math.sin(Math.PI * k) - 0.08 * k;
  const warm = smooth(0.55, 1, k);
  const cool = 1 - smooth(0, 0.4, k);
  let col = mix3([252, 252, 246], [255, 178, 104], warm);
  col = mix3(col, [255, 230, 186], cool);
  let sky = mix3([92, 112, 160], [104, 84, 150], warm);
  sky = mix3(sky, [70, 104, 196], cool);
  // A high sun shows less of the grooves' relief, and the panel keeps noon off its top.
  const high = Math.sin(Math.PI * k);
  return { lx: Math.cos(az), ly: Math.sin(az), len: 1 / Math.tan(elev), col, sky, gain: 0.92 - 0.1 * high, relief: 1 - 0.3 * high };
}

function stone(x, y, rx, ry, a, h, seed) {
  const ph = [0, 1, 2].map((i) => hash(seed, i, 7) * TAU);
  return { x, y, rx, ry, ca: Math.cos(a), sa: Math.sin(a), h, ph, R: Math.max(rx, ry) * 1.25 };
}

// How far outside the stone a point is in LED, negative inside, measured along the
// ray from its centre so rings keep their spacing on the long side; and r, 1 at the rim.
function stoneDist(s, x, y) {
  const dx = x - s.x;
  const dy = y - s.y;
  const u = (dx * s.ca + dy * s.sa) / s.rx;
  const v = (-dx * s.sa + dy * s.ca) / s.ry;
  const r = Math.hypot(u, v);
  const th = Math.atan2(v, u);
  const edge = 1 + 0.1 * Math.sin(2 * th + s.ph[0]) + 0.07 * Math.sin(3 * th + s.ph[1]) + 0.05 * Math.sin(5 * th + s.ph[2]);
  return { d: Math.hypot(dx, dy) * (1 - edge / Math.max(r, 1e-3)), r: r / edge };
}

function build(P) {
  const L = P.sun;
  const groups = LAYOUTS[P.count].map((g, gi) => ({
    x: g[0],
    y: g[1],
    rings: g[6],
    stones: [stone(g[0], g[1], g[2], g[3], g[4], g[5], gi * 5)].concat(g[7].map((m, j) => stone(m[0], m[1], m[2], m[3], g[4] + j, m[4], gi * 5 + j + 1))),
  }));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // The group whose outline is nearest, within the reach of its moss and rings.
      let best = null;
      let bestRho = 1e9;
      let inStone = null;
      let sr = 0;
      for (const gr of groups) {
        let rho = 1e9;
        for (const s of gr.stones) {
          // Far stones are skipped: nothing past their rings depends on them.
          if (Math.hypot(x - s.x, y - s.y) > s.R + MOSS + 2 + gr.rings * PER) continue;
          const q = stoneDist(s, x, y);
          if (q.d < rho) rho = q.d;
          if (q.d < 0 && !inStone) {
            inStone = s;
            sr = q.r;
          }
        }
        if (rho < MOSS + gr.rings * PER && rho < bestRho) {
          best = gr;
          bestRho = rho;
        }
      }
      // A stone shades what lies opposite the sun from it, as far as its height allows.
      let shade = 1;
      for (const gr of groups)
        for (const s of gr.stones) {
          if (inStone === s) continue;
          for (const f of [0.3, 0.6, 1]) {
            const sx = x + L.lx * s.h * L.len * f;
            const sy = y + L.ly * s.h * L.len * f;
            if (Math.abs(sx - s.x) > s.R || Math.abs(sy - s.y) > s.R) continue;
            const q = stoneDist(s, sx, sy);
            if (q.d < 0 && 1 - q.r * q.r > f * f * 0.6) shade = 0.42;
          }
        }
      P.shade[p] = shade;
      P.kind[p] = 0;
      let sunR = 0;
      let skyR = 0;
      let alb = [1, 1, 1];
      if (inStone) {
        // A rounded top lit from the sun's side, with facets, lichen and a dark rim.
        const dx = (x - inStone.x) / inStone.rx;
        const dy = (y - inStone.y) / inStone.ry;
        const facet = noise(x / 2.2, y / 2.2, 9 + inStone.h * 3) - 0.5;
        const lum = clamp(0.6 + 0.85 * (dx * L.lx + dy * L.ly) * Math.min(1, sr * 1.2) + 0.4 * facet, 0.1, 1.25) * (sr > 0.84 ? 0.6 : 1);
        sunR = lum * 0.6;
        skyR = lum * 0.22;
        alb = hash(x, y, 11) < 0.08 ? [0.64, 0.74, 0.5] : [0.78, 0.74, 0.68];
        P.kind[p] = 2;
      } else if (best && bestRho < MOSS + 0.9 * (noise(x / 2, y / 2, 13) - 0.3)) {
        const lum = 0.75 + 0.7 * (noise(x / 1.6, y / 1.6, 17) - 0.5) + 0.3 * (hash(x, y, 18) - 0.5);
        sunR = lum * 0.46;
        skyR = lum * 0.3;
        alb = [0.36, 0.8, 0.22];
        P.kind[p] = 1;
      } else if (best) {
        // Rings: the phase grows away from the stone and the slope faces outward.
        P.phase[p] = (bestRho - MOSS) / PER;
        const dx = x - best.x;
        const dy = y - best.y;
        const r = Math.hypot(dx, dy) || 1;
        P.face[p] = ((dx * L.lx + dy * L.ly) / r) * L.relief;
      } else {
        P.phase[p] = y / PER;
        P.face[p] = L.ly * L.relief;
      }
      for (let c = 0; c < 3; c++) {
        P.still[p * 6 + c] = alb[c] * L.col[c] * sunR;
        P.still[p * 6 + 3 + c] = alb[c] * L.sky[c] * skyR;
      }
    }
}

export function setup(params) {
  const P = params;
  for (const k of ["phase", "face", "shade", "grain", "wob", "pass"]) P[k] = new Float32Array(N);
  P.kind = new Uint8Array(N);
  P.still = new Float32Array(N * 6);
  P.tint = new Float32Array(N * 2);
  P.cloud = new Float32Array(17 * 33);
  P.buf = new Float32Array(N * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      P.grain[p] = hash(x, y, 1) + hash(x, y, 2) - 1;
      // Each stone of the gravel has its own tint: greener, bluer or plain.
      P.tint[p * 2] = TINT * (hash(x, y, 5) - 0.5);
      P.tint[p * 2 + 1] = TINT * (hash(x, y, 6) - 0.5);
      P.wob[p] = noise(x / 9, y / 7, 4) - 0.5;
      // The garden time at which the rake passes this LED in each round.
      const b = Math.floor(y / BAND);
      P.pass[p] = b * PASS + (b % 2 ? W + 5 - x : x + 5) / RAKE_V;
    }
  Object.assign(P, { t: 0, cx: 0, cy: 0, count: 0, light: -1, wind: 0.06, speed: 2, leaves: [], started: false, sun: sun(0) });
}

function ageAt(P, p) {
  const a = (P.t - P.pass[p]) % CYCLE;
  return a < 0 ? a + CYCLE : a;
}

function step(P, dt) {
  const g = dt * P.speed;
  P.t += g;
  // Clouds run west to east and a little south, faster in wind.
  const v = 1.6 + 3.2 * P.wind;
  P.cx += g * v;
  P.cy += g * v * 0.25;
  // A leaf lands on gravel and stays until the rake reaches it.
  if (Math.random() < g * (0.05 + 0.5 * P.wind)) {
    for (let tries = 0; tries < 8; tries++) {
      const x = 3 + Math.floor(Math.random() * (W - 6));
      const y = 3 + Math.floor(Math.random() * (H - 6));
      if (P.kind[y * W + x] === 0) {
        P.leaves.push({ x, y, z: 1, rot: Math.floor(Math.random() * 4), col: Math.floor(Math.random() * 4), land: 0, drift: (Math.random() - 0.3) * 14 });
        break;
      }
    }
  }
  for (const l of P.leaves) {
    if (l.z <= 0) continue;
    l.z = Math.max(0, l.z - g / 3.2);
    if (l.z === 0) l.land = P.t;
    else if (Math.random() < g * 3) l.rot = (l.rot + 1) % 4;
  }
  P.leaves = P.leaves.filter((l) => l.z > 0 || ageAt(P, l.y * W + l.x) >= P.t - l.land);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.speed = clamp(k[1], 0.2, 3);
  P.wind = clamp(k[3], 0, 1);
  const count = Math.round(clamp(k[2], 3, 5));
  const light = clamp(k[0], 0, 1);
  if (count !== P.count || Math.abs(light - P.light) > 0.004) {
    P.count = count;
    P.light = light;
    P.sun = sun(light);
    build(P);
  }
  if (!P.started) {
    P.started = true;
    // The garden opens 20 seconds into a raking at the knob's speed: the rake is part way
    // down, the bands above it fresh and those below worn, with leaves already lying there.
    P.t = 12;
    for (let i = 0; i < 400; i++) step(P, 0.05);
  }
  step(P, dt);
}

function drawGarden(P) {
  const L = P.sun;
  const buf = P.buf;
  const cloud = P.cloud;
  // Cloud shadow on a coarse 4-LED lattice, smoothed between.
  const cover = 0.6 - 0.14 * P.wind;
  for (let j = 0; j < 33; j++)
    for (let i = 0; i < 17; i++) {
      const x = i * 4 + P.cx;
      const y = j * 4 + P.cy;
      const n = 0.68 * noise(x / 30, y / 34, 21) + 0.32 * noise(x / 12, y / 12, 22);
      cloud[j * 17 + i] = smooth(cover - 0.07, cover + 0.09, n);
    }
  const wear = (0.55 + 0.9 * P.wind) / CYCLE;
  const [sr, sg, sb] = L.col;
  const [kr, kg, kb] = L.sky;
  const { kind, still, shade, phase, wob, grain, face, pass, tint } = P;
  const row = new Float32Array(17);
  const t = P.t;
  for (let y = 0; y < H; y++) {
    const cj = (y >> 2) * 17;
    const fy = (y & 3) / 4;
    for (let i = 0; i < 17; i++) row[i] = cloud[cj + i] + (cloud[cj + i + 17] - cloud[cj + i]) * fy;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const c0 = row[x >> 2];
      const direct = (1 - CLOUD * (c0 + (row[(x >> 2) + 1] - c0) * (x & 3) * 0.25)) * shade[p] * L.gain;
      const q = p * 3;
      if (kind[p]) {
        const o = p * 6;
        buf[q] = still[o] * direct + still[o + 3];
        buf[q + 1] = still[o + 1] * direct + still[o + 4];
        buf[q + 2] = still[o + 2] * direct + still[o + 5];
        continue;
      }
      // Gravel: a groove lit from the sun's side, worn soft since the rake passed.
      let age = t - pass[p];
      age -= CYCLE * Math.floor(age / CYCLE);
      const w = age * wear;
      const i = ((phase[p] + wob[p] * w * WOB) * 1024) & 1023;
      const g = grain[p];
      const gr = 1 + GRAIN * g;
      const fresh = age < 4 ? 0.05 * (4 - age) : 0;
      const sunT = (SUN_A + (SUN_B - 0.06 * w) * COS[i] + SUN_C * face[p] * (1 - 0.25 * w) * SIN[i] + fresh) * gr * direct;
      const skyT = (SKY_A + SKY_B * COS[i]) * gr;
      const add = ADD * g;
      buf[q] = sr * sunT + kr * skyT + add;
      buf[q + 1] = sg * sunT + kg * skyT + add + tint[p * 2];
      buf[q + 2] = sb * sunT + kb * skyT + add + tint[p * 2 + 1];
    }
  }
}

function drawLeaves(P) {
  const L = P.sun;
  const buf = P.buf;
  const turn = (l, i, j) => [[i, j], [4 - j, i], [4 - i, 4 - j], [j, 4 - i]][l.rot];
  for (const l of P.leaves) {
    const lx = l.x + Math.round(l.drift * l.z);
    // A falling leaf's shadow lies apart from it, closing in as it lands.
    const sx = Math.round(-L.lx * l.z * 9);
    const sy = Math.round(-L.ly * l.z * 9);
    for (const pass of l.z > 0 ? [0, 1] : [1])
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 5; i++) {
          const [a, b] = turn(l, i, j);
          if (LEAF[b][a] !== "#") continue;
          const qx = lx + i - 2 + (pass ? 0 : sx);
          const qy = l.y + j - 2 + (pass ? 0 : sy);
          if (qx < 0 || qx >= W || qy < 0 || qy >= H) continue;
          const q = (qy * W + qx) * 3;
          if (!pass) {
            for (let c = 0; c < 3; c++) buf[q + c] *= 0.55;
            continue;
          }
          const sh = 0.7 + 0.3 * P.shade[qy * W + qx] + 0.15 * l.z;
          for (let c = 0; c < 3; c++) buf[q + c] = LEAF_COL[l.col][c] * sh * (0.85 + (0.15 * L.col[c]) / 255);
        }
  }
}

// The rake: a wooden head across its band with five tines, and the bamboo handle reaching ahead.
function drawRake(P) {
  const L = P.sun;
  const buf = P.buf;
  const cyc = ((P.t % CYCLE) + CYCLE) % CYCLE;
  const b = Math.floor(cyc / PASS);
  if (b >= BANDS) return;
  const u = (cyc - b * PASS) * RAKE_V;
  if (u >= W + 10) return;
  const dir = b % 2 ? -1 : 1;
  const hx = Math.round(dir > 0 ? u - 5 : W + 4 - u);
  const top = b * BAND;
  const mid = top + 7;
  for (let i = 1; i <= 22; i++) {
    const x = hx + dir * i;
    const sx = x - Math.round(L.lx * 2);
    const sy = mid - Math.round(L.ly * 2);
    if (sx >= 0 && sx < W && sy >= 0 && sy < H) for (let c = 0; c < 3; c++) buf[(sy * W + sx) * 3 + c] *= 0.6;
    if (x < 0 || x >= W) continue;
    const q = (mid * W + x) * 3;
    const grip = i > 17 ? 0.7 : 1;
    buf[q] = 186 * grip;
    buf[q + 1] = 156 * grip;
    buf[q + 2] = 92 * grip;
  }
  for (let y = top; y < Math.min(H, top + BAND); y++)
    for (let i = 0; i < 2; i++) {
      const x = hx - dir * i;
      if (x < 0 || x >= W) continue;
      const q = (y * W + x) * 3;
      const tine = i === 1 && y % PER === 1;
      buf[q] = tine ? 60 : 128;
      buf[q + 1] = tine ? 40 : 84;
      buf[q + 2] = tine ? 24 : 46;
    }
}

export function draw(display, params) {
  const P = params;
  if (!P.started) return;
  drawGarden(P);
  drawLeaves(P);
  drawRake(P);
  const buf = P.buf;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      display.setPixel(x, y, QZ(buf[q]), QZ(buf[q + 1]), QZ(buf[q + 2]));
    }
}
