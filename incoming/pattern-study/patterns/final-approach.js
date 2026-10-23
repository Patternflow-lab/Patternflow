// ===== Patternflow pattern =====
// Title:   Final Approach
// Family:  flight
// Idea:    From an airliner cockpit on a night landing, the runway and its approach lights converge high on the panel under a town glowing on the horizon, then stream toward the windscreen and under it with the rabbit racing ahead and the PAPI showing two white over two red, through the flare and the rollout, before the next approach begins far out.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after the ALSF-2 approach lighting system
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Glow=0..1, Speed=0.2..3, Weather=0..3, Crosswind=-1..1
//
// Knob 1: Glow. The colour of the town's glow on the clouds and of the sodium lamps on the horizon: sodium amber at 0, turning through green and blue to violet and back to amber at 1.
// Knob 2: Speed. How fast the airliner flies: at 2 an approach from far out to the end of the rollout takes about 18 s and the rabbit runs twice a second; at 0.2 everything runs ten times slower.
// Knob 3: Weather. A clear night with broken cloud at 0, haze where every light blooms at 1, rain on the windscreen with the wiper going at 2, and fog at 3 where the approach lights come out of the murk late.
// Knob 4: Crosswind. The airliner crabs into the wind from the left or the right, so the runway sits off to one side until it swings straight ahead at the flare.
// Buttons: K1 tap goes around: the nose comes up and the lights drop away below, then the airliner banks off and comes round for a new approach.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, abs, sin, cos, exp, sqrt, pow, floor, ceil, round, atan, log, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

// The camera: focal length in LEDs, the screen centre, the eye height on the
// runway in metres, and the horizon row on the approach.
const F = 150;
const CX = 31.5;
const CY = 64;
const HG = 8;
const Y0 = 32;
// A 3 degree glide path comes down to eye height HG 320 m past the
// threshold. The flare starts 8 m above that, and touchdown is where it ends.
const SLOPE = 0.0524;
const AIM = 320;
const PF = AIM - 8 / SLOPE;
const LF = 11 / SLOPE;
const TD = PF + LF * log(11 / 3);
// Cloud base above the ground, and where a new approach starts.
const HC = 520;
const FAR = -2300;
// The PAPI units from the runway outward, in degrees.
const PT = [3.5, 3.17, 2.83, 2.5];

function eyeH(P) {
  if (P < PF) return HG + (AIM - P) * SLOPE;
  if (P < TD) return HG + 11 * exp(-(P - PF) / LF) - 3;
  return HG;
}

// Kinds of light: steady, the sequenced flashers, the PAPI, city lamps that
// take the glow colour, red obstruction lights and the airport beacon.
const [STEADY, SEQ, PAPI, CITY, OBS, BEAC] = [0, 1, 2, 3, 4, 5];
const WHITE = [1, 0.9, 0.74];
const COOL = [0.86, 0.92, 1];
const RED = [1, 0.1, 0.04];
const GREEN = [0.1, 1, 0.42];
const AMBER = [1, 0.7, 0.16];
const BLUE = [0.2, 0.32, 1];

// Weather presets the knob runs between: visibility in metres, bloom, blur
// radius, cloud cover, glow, rain, fog, and light scattered in the air.
const WX = [
  [30000, 0.35, 1, 0.5, 1.0, 0, 0, 0],
  [5000, 1.0, 2, 0.6, 1.25, 0, 0.22, 0.07],
  [3000, 0.75, 2, 0.85, 1.35, 1, 0.15, 0.1],
  [420, 1.5, 3, 1, 1.05, 0, 1, 0.2],
];

// A fixed tileable value noise, for clouds and grass.
const TN = 128;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
let TX = null;
let TC = null;
function makeTex(oct) {
  const t = new Float32Array(TN * TN);
  let amp = 0.5;
  for (let o = 0; o < oct; o++) {
    const g = 4 << o;
    const c = TN / g;
    for (let y = 0; y < TN; y++)
      for (let x = 0; x < TN; x++) {
        const gx = x / c;
        const gy = y / c;
        const x0 = floor(gx);
        const y0 = floor(gy);
        let fx = gx - x0;
        let fy = gy - y0;
        fx = fx * fx * (3 - 2 * fx);
        fy = fy * fy * (3 - 2 * fy);
        const hv = (a, b) => hash(((a % g) * 131 + (b % g)) * 7 + o * 9973);
        const top = hv(x0, y0) + (hv(x0 + 1, y0) - hv(x0, y0)) * fx;
        const bot = hv(x0, y0 + 1) + (hv(x0 + 1, y0 + 1) - hv(x0, y0 + 1)) * fx;
        t[y * TN + x] += amp * (top + (bot - top) * fy);
      }
    amp *= 0.5;
  }
  let lo = 9;
  let hi = -9;
  for (let i = 0; i < t.length; i++) {
    lo = min(lo, t[i]);
    hi = max(hi, t[i]);
  }
  for (let i = 0; i < t.length; i++) t[i] = (t[i] - lo) / (hi - lo);
  return t;
}
function tex(u, v, A = TX) {
  const x = u * TN;
  const y = v * TN;
  const x0 = floor(x);
  const y0 = floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = (x0 & 127) + (y0 & 127) * TN;
  const b = ((x0 + 1) & 127) + (y0 & 127) * TN;
  const c = (x0 & 127) + ((y0 + 1) & 127) * TN;
  const d = ((x0 + 1) & 127) + ((y0 + 1) & 127) * TN;
  const top = A[a] + (A[b] - A[a]) * fx;
  return top + (A[c] + (A[d] - A[c]) * fx - top) * fy;
}

// Every light on the field and in the town. Positions are in metres, with z
// running along the runway from the threshold.
function build() {
  const L = [];
  const add = (x, y, z, k, i, c, n = 0) => L.push([x, y, z, k, i, c[0], c[1], c[2], n]);
  const both = (fn) => {
    fn(-1);
    fn(1);
  };
  // ALSF-2: a barrette every 30 m out to 720 m, red side rows on the inner
  // 300 m, flashers on the outer part, crossbars at 300 m and 150 m.
  for (let k = 1; k <= 24; k++) {
    const z = -30 * k;
    for (let j = -2; j <= 2; j++) add(j * 1.05, 0.6, z, STEADY, 1, WHITE);
    if (k <= 10) both((sg) => { for (let j = 0; j < 3; j++) add(sg * (11 + j * 1.05), 0.6, z, STEADY, 0.75, RED); });
    if (k >= 11) add(0, 1.4, z, SEQ, 1, COOL, 24 - k);
  }
  both((sg) => { for (let j = 3; j <= 15; j += 1.5) add(sg * j, 0.6, -300, STEADY, 1, WHITE); });
  both((sg) => { for (let j = 3; j <= 7.5; j += 1.5) add(sg * j, 0.6, -150, STEADY, 1, WHITE); });
  // The green threshold bar and its wing bars.
  for (let x = -25; x <= 25.01; x += 1.5) add(x, 0.3, 0, STEADY, 1, GREEN);
  both((sg) => { for (let j = 26.5; j <= 38; j += 1.5) add(sg * j, 0.3, 0, STEADY, 1, GREEN); });
  // Runway edge lights turn yellow on the last 600 m. A red bar ends it.
  for (let z = 0; z <= 3000; z += 60) both((sg) => add(sg * 23.5, 0.4, z, STEADY, 0.85, z > 2400 ? AMBER : WHITE));
  for (let x = -21; x <= 21; x += 3) add(x, 0.3, 3000, STEADY, 0.8, RED);
  // Centreline every 15 m, red and white near the far end; touchdown zone bars.
  for (let z = 7.5; z < 3000; z += 15) {
    const red = z > 2700 || (z > 2100 && round((z - 7.5) / 15) % 2 === 1);
    add(0.6, 0.05, z, STEADY, 0.7, red ? RED : COOL);
  }
  for (let z = 30; z <= 900; z += 30) both((sg) => { for (let j = 0; j < 3; j++) add(sg * (9.8 + j * 1.5), 0.05, z, STEADY, 0.55, COOL); });
  for (let j = 0; j < 4; j++) add(-(38.5 + 9 * j), 0.9, AIM, PAPI, 1.6, WHITE, j);
  // A parallel taxiway on the right with blue edges and green lead-offs.
  for (let z = -60; z <= 3000; z += 50) both((sg) => add(190 + sg * 11, 0.3, z, STEADY, 0.4, BLUE));
  for (const z0 of [500, 1300, 2100, 2800]) for (let t = 0; t <= 1; t += 1 / 12) add(26 + 160 * t, 0.1, z0 + 120 * t * t, STEADY, 0.35, GREEN);
  // The apron floodlights beyond it, and the beacon on the tower.
  for (let j = 0; j < 12; j++) add(330 + 260 * rnd(), 25, 900 + 1500 * rnd(), CITY, 1.3, WHITE, rnd() < 0.3 ? 0.8 : 0.1);
  add(300, 35, 1400, BEAC, 1.4, WHITE);
  // The town: lamps along streets on a 140 m grid that thin out between
  // districts and climb the hills behind.
  let n = 0;
  while (n < 1150) {
    const z = 3300 + 17000 * pow(rnd(), 1.4);
    let x = (rnd() * 2 - 1) * 0.45 * z;
    let zz = z;
    if (rnd() < 0.55) x = round(x / 140) * 140 + (rnd() - 0.5) * 6;
    else zz = round(z / 140) * 140 + (rnd() - 0.5) * 6;
    if (tex(x / 9000 + 0.2, zz / 9000) < 0.35 + 0.25 * rnd()) continue;
    const hill = max(0, (zz - 7000) / 13000) * 300 * (0.5 + tex(x / 4000, zz / 4000 + 0.5));
    const white = rnd() < 0.28;
    add(x, hill + 5 + (rnd() < 0.08 ? rnd() * 90 : 0), zz, CITY, 0.55 + 0.6 * rnd(), WHITE, white ? 0.75 : 0.05);
    n++;
  }
  // Masts and towers in the town with red lights stacked up them.
  for (let j = 0; j < 7; j++) {
    const z = 4500 + 9000 * rnd();
    const x = (rnd() * 2 - 1) * 0.3 * z;
    const ht = 120 + 220 * rnd();
    const ph = rnd() * 6;
    for (let q = 1; q <= 3; q++) add(x, (ht * q) / 3, z, OBS, 1.1, RED, ph);
  }
  const A = (j) => Float32Array.from(L, (e) => e[j]);
  return { lx: A(0), ly: A(1), lz: A(2), lk: A(3), li: A(4), lr: A(5), lg: A(6), lb: A(7), ln: A(8), n: L.length };
}

function cam(s) {
  return { P: s.P, h: s.h, yh: s.yh, psi: s.psi, roll: s.roll, X: s.Xp };
}

function approach(s, P0) {
  s.mode = 0;
  s.P = P0;
  s.h = eyeH(P0);
  s.down = false;
  s.rt = 0;
  s.age = 0;
  s.turn = 0;
  s.fresh = true;
}

export function setup(params) {
  if (!TX) {
    TX = makeTex(4);
    TC = makeTex(2);
  }
  const F3 = () => new Float32Array(N * 3);
  params.s = { lt: build(), lb: F3(), bl: F3(), tmp: F3(), o: F3(), tq: 0, drops: [], tw: 0, wa: 0.35, drift: 0 };
  const s = params.s;
  // The landing lights are fixed to the airframe, so their pool on the
  // ground and their glow in the air stay put on the screen.
  s.bm = new Float32Array(N);
  s.bs = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const bx = (p % W) - CX;
    const y = (p / W) | 0;
    const by = (y - 76) / (y < 76 ? 14 : 36);
    s.bm[p] = exp(-((bx / 22) ** 2) - by * by);
    s.bs[p] = exp(-((bx / 26) ** 2) - ((y - 82) / 46) ** 2);
  }
  // Open about a kilometre out, so the first look is the approach lights.
  approach(s, -1000);
  s.age = 1;
  s.yh = Y0;
  s.psi = 0;
  s.roll = 0;
  s.Xp = 0;
  s.v = 150;
  s.fade = 1;
  s.c = cam(s);
  s.pc = s.c;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  const d = (dt * clamp(k[1], 0.2, 3)) / 2;
  s.tq += d;
  s.age += d;
  const tq = s.tq;
  // Glow colour: hue rotated from sodium amber.
  const hue = (0.085 + clamp(k[0], 0, 1)) % 1;
  s.gc = [0, 0, 0].map((_, c) => {
    const q = ([5, 3, 1][c] + hue * 6) % 6;
    return 1 - 0.82 * max(0, min(q, 4 - q, 1));
  });
  // Weather, blended between the neighbouring presets.
  const w = clamp(k[2], 0, 3);
  const i0 = min(2, floor(w));
  const f = w - i0;
  const A = WX[i0];
  const B = WX[i0 + 1];
  const lerp = (j) => A[j] + (B[j] - A[j]) * f;
  s.vis = exp(log(A[0]) + (log(B[0]) - log(A[0])) * f);
  [s.bloom, s.br, s.cover, s.glowK, s.rain, s.fog, s.scat] = [1, 2, 3, 4, 5, 6, 7].map(lerp);
  s.br = round(s.br);
  s.drift += d * 0.02;
  const cw = clamp(k[3], -1, 1);

  s.pc = s.c;
  if (input.btnPressed && input.btnPressed[0] && s.mode === 0) {
    s.mode = 1;
    s.g = 0;
    s.gh = s.h;
    s.gp = s.yh - Y0;
  }
  // Turbulence: a little bob and roll in the air, a rumble on the ground.
  const air = min(1, (s.h - HG) / 25);
  const bob = air * (0.7 * sin(tq * 1.7) + 0.4 * sin(tq * 4.1 + 1)) + (1 - air) * 0.25 * sin(tq * 31) * (s.v / 150);
  if (s.mode === 0) {
    if (!s.down) {
      s.v = s.P < 0 ? 150 - 0.08 * s.P : 150 - 0.05 * s.P;
      s.P += s.v * d;
      if (s.P >= TD) s.down = true;
      s.h = eyeH(s.P) + (s.P < PF ? 1.6 * sin(tq * 0.43) * min(1, (PF - s.P) / 500) : 0);
    } else {
      s.rt += d;
      s.v = max(16, s.v - 26 * d);
      s.P += s.v * d;
      s.h = HG;
    }
    // The nose comes up in the flare and down after touchdown.
    const flare = sstep(PF - 40, TD, s.P);
    s.yh = Y0 + 5 * flare - 7 * sstep(0, 0.9, s.rt) + bob;
    s.psi = cw * 0.17 * (1 - sstep(PF - 120, TD - 30, s.P));
    s.roll = air * (0.022 * sin(tq * 1.1 + 0.5) + cw * 0.02);
    s.Xp = 2 * sin(tq * 0.31) * air;
    s.fade = sstep(0, 0.7, s.age) * (1 - sstep(4.3, 5, s.rt));
    if (s.rt >= 5) approach(s, FAR);
  } else {
    // Go around: pitch up and climb, then bank away and come round again.
    const g = (s.g += d);
    s.v = min(190, s.v + 12 * d);
    s.P += s.v * d * cos(s.turn);
    s.h += 36 * sstep(0.2, 1.3, g) * d;
    s.yh = Y0 + s.gp + (34 - s.gp) * sstep(0, 1.5, g) + bob;
    s.roll = -0.45 * sstep(1.8, 2.9, g);
    s.turn += 0.32 * sstep(1.8, 2.9, g) * d;
    s.psi += 0.32 * sstep(1.8, 2.9, g) * d;
    s.fade = 1 - sstep(3.1, 3.9, g);
    if (g >= 3.9) approach(s, FAR);
  }
  s.c = cam(s);
  if (s.fresh) {
    s.pc = s.c;
    s.fresh = false;
  }

  // Rain on the windscreen, and the wiper that clears it.
  if (s.rain > 0.3) {
    const nd = d * 34 * s.rain;
    for (let j = 0; j < 4; j++) if (rnd() < nd / 4 && s.drops.length < 70) s.drops.push({ x: rnd() * W, y: rnd() * H, r: 0.55 + 0.6 * rnd() });
    s.tw += d;
    const wa = -0.12 - 0.8 * (0.5 - 0.5 * cos((2 * PI * s.tw) / 1.5));
    const lo = min(wa, s.wa);
    const hi = max(wa, s.wa);
    s.drops = s.drops.filter((q) => {
      const a = atan((q.x - 58) / (150 - q.y));
      return a < lo - 0.03 || a > hi + 0.03;
    });
    s.wa = wa;
  } else {
    s.wa = 0.35;
    if (s.drops.length) s.drops.length = 0;
  }
}

// Additive light: a sharpened bilinear dot for far lights, a round blob for
// near ones.
function dot(B, x, y, r, g, b) {
  const x0 = floor(x);
  const y0 = floor(y);
  let fx = x - x0;
  let fy = y - y0;
  fx = (fx * fx) / (fx * fx + (1 - fx) * (1 - fx));
  fy = (fy * fy) / (fy * fy + (1 - fy) * (1 - fy));
  for (let j = 0; j < 4; j++) {
    const xx = x0 + (j & 1);
    const yy = y0 + (j >> 1);
    if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
    const wgt = (j & 1 ? fx : 1 - fx) * (j >> 1 ? fy : 1 - fy);
    const i = (yy * W + xx) * 3;
    B[i] += r * wgt;
    B[i + 1] += g * wgt;
    B[i + 2] += b * wgt;
  }
}
function blob(B, x, y, r, g, b, sg) {
  const R = min(4, ceil(sg * 2.2));
  const kk = -1 / (2 * sg * sg);
  const xa = max(0, ceil(x - R));
  const xb = min(W - 1, floor(x + R));
  for (let yy = max(0, ceil(y - R)); yy <= min(H - 1, floor(y + R)); yy++)
    for (let xx = xa; xx <= xb; xx++) {
      const wgt = exp(((xx - x) ** 2 + (yy - y) ** 2) * kk);
      const i = (yy * W + xx) * 3;
      B[i] += r * wgt;
      B[i + 1] += g * wgt;
      B[i + 2] += b * wgt;
    }
}

function lights(s, B) {
  const c = s.c;
  const p = s.pc;
  const T = s.lt;
  const sn = sin(c.psi);
  const cs = cos(c.psi);
  const sr = sin(c.roll);
  const cr = cos(c.roll);
  const psn = sin(p.psi);
  const pcs = cos(p.psi);
  const psr = sin(p.roll);
  const pcr = cos(p.roll);
  const ext = 3 / s.vis;
  const gc = s.gc;
  const tq = s.tq;
  // The rabbit runs from the outermost flasher to the 300 m bar twice a second.
  const seq = (tq * 2) % 1;
  const papiA = (atan((c.h - HG) / max(1, AIM - c.P)) * 180) / PI;
  const beac = (tq * 0.5) % 1;
  for (let i = 0; i < T.n; i++) {
    const dx = T.lx[i] - c.X;
    const dz = T.lz[i] - c.P;
    const zc = dx * sn + dz * cs;
    if (zc < 3) continue;
    const xc = dx * cs - dz * sn;
    const ox = (F * xc) / zc;
    const oy = c.yh - CY + (F * (c.h - T.ly[i])) / zc;
    const X = CX + ox * cr - oy * sr;
    const Y = CY + ox * sr + oy * cr;
    if (X < -5 || X > W + 4 || Y < -5 || Y > H + 4) continue;
    let a = T.li[i] * min(1.8, pow(600 / zc, 0.62)) * exp(-zc * ext);
    let r = T.lr[i];
    let g = T.lg[i];
    let b = T.lb[i];
    const k = T.lk[i];
    const m = T.ln[i];
    let sg = 0.4 + min(1.7, 40 / zc);
    if (k === SEQ) {
      let age = seq - m / 14;
      if (age < 0) age += 1;
      const e = exp(-age * 13);
      a *= 4.5 * e;
      sg += 1.1 * e;
    } else if (k === PAPI) {
      const wa = sstep(-0.07, 0.07, papiA - PT[m]);
      g = 0.1 + 0.83 * wa;
      b = 0.04 + 0.72 * wa;
    } else if (k === CITY) {
      r = gc[0] + (1 - gc[0]) * m;
      g = gc[1] + (0.92 - gc[1]) * m;
      b = gc[2] + (0.8 - gc[2]) * m;
    } else if (k === OBS) a *= sstep(-0.25, 0.25, sin(tq * 3.3 + m));
    else if (k === BEAC) {
      const e = exp(-(((beac % 0.5) / 0.05) ** 2));
      a *= 2 * e;
      if (beac < 0.5) [r, g, b] = GREEN;
    }
    a *= s.fade * 255;
    if (a < 3) continue;
    // A light that crossed the screen fast since the last frame leaves a
    // fading streak behind it.
    if (zc < 500) {
      const pdx = T.lx[i] - p.X;
      const pdz = T.lz[i] - p.P;
      const pz = pdx * psn + pdz * pcs;
      if (pz > 3) {
        const qx = (F * (pdx * pcs - pdz * psn)) / pz;
        const qy = p.yh - CY + (F * (p.h - T.ly[i])) / pz;
        const PX = CX + qx * pcr - qy * psr;
        const PY = CY + qx * psr + qy * pcr;
        const ddx = X - PX;
        const ddy = Y - PY;
        const len = sqrt(ddx * ddx + ddy * ddy);
        if (len > 1.5) {
          const n = min(28, ceil(len));
          const q = a * max(0.3, 1.4 / len);
          for (let j = 1; j < n; j++) {
            const t = j / n;
            dot(B, PX + ddx * t, PY + ddy * t, q * r * t, q * g * t, q * b * t);
          }
        }
      }
    }
    if (sg < 0.75) dot(B, X, Y, a * r, a * g, a * b);
    else blob(B, X, Y, a * r, a * g, a * b, sg);
    // On a wet runway each light lays a streak toward the windscreen.
    if (s.rain > 0.05 && T.ly[i] < 1.5 && T.lz[i] > -760) {
      const ls = min(10, round(s.rain * (2 + 0.12 * (Y - c.yh))));
      for (let j = 1; j <= ls; j++) {
        const q = a * 0.3 * s.rain * (1 - j / (ls + 1));
        dot(B, X, Y + j, q * r, q * g, q * b);
      }
    }
  }
}

// Box blur, horizontal then vertical, for the bloom.
function blur(src, dst, tmp, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++)
    for (let ch = 0; ch < 3; ch++) {
      const o = y * W * 3 + ch;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[o + clamp(x, 0, W - 1) * 3];
      for (let x = 0; x < W; x++) {
        tmp[o + x * 3] = acc * inv;
        acc += src[o + min(W - 1, x + r + 1) * 3] - src[o + max(0, x - r) * 3];
      }
    }
  for (let x = 0; x < W; x++)
    for (let ch = 0; ch < 3; ch++) {
      const o = x * 3 + ch;
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[o + clamp(y, 0, H - 1) * W * 3];
      for (let y = 0; y < H; y++) {
        dst[o + y * W * 3] = acc * inv;
        acc += tmp[o + min(H - 1, y + r + 1) * W * 3] - tmp[o + max(0, y - r) * W * 3];
      }
    }
}

// Albedo of the ground: asphalt and its paint on the runway, grass around it.
const TDZ = [150, 450, 600, 750, 900];
function surface(X, Z) {
  const ax = abs(X);
  if (Z >= 0 && Z <= 3000 && ax < 23) {
    let al = 0.17 + 0.05 * tex(X / 9, Z / 40);
    if (ax > 21.9) al = 0.62;
    else if (Z > 6 && Z < 36 && ax > 3 && (ax - 3) % 3.6 < 1.8) al = 0.75;
    else if (ax < 0.45 && Z > 60 && (Z - 60) % 60 < 36) al = 0.4;
    else if (Z > 300 && Z < 360 && ax > 6 && ax < 15) al = 0.72;
    else if (ax > 6 && ax < 15 && (ax - 6) % 3 < 1.5) for (const z0 of TDZ) if (Z > z0 && Z < z0 + 22) al = 0.7;
    // Rubber from a million touchdowns darkens the middle of the zone.
    al *= 1 - (0.45 - 0.4 * tex(X / 5, Z / 25)) * sstep(260, 340, Z) * sstep(1050, 950, Z) * sstep(14, 10, ax);
    return al;
  }
  return 0.04 + 0.07 * tex(X / 6, Z / 6);
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.gc) return;
  const L = s.lb;
  const BL = s.bl;
  const O = s.o;
  L.fill(0);
  lights(s, L);
  blur(L, BL, s.tmp, s.br);
  blur(BL, BL, s.tmp, s.br);

  const c = s.c;
  const gc = s.gc;
  const sn = sin(c.psi);
  const cs = cos(c.psi);
  const sr = sin(c.roll);
  const cr = cos(c.roll);
  const ext = 3 / s.vis;
  const land = 2 * s.fade;
  const gk = s.glowK;
  const fog = s.fog;
  // The colour the murk takes: lit by the town, and by the airport in fog.
  const fl = (0.05 + 0.07 * fog) * (1 + 0.6 * fog);
  const fw = 0.16 * fog;
  const fogC = [gc[0] * fl + fw, gc[1] * fl + fw * 1.04, gc[2] * fl + fw * 1.1];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ax = x - CX;
      const ay = y - CY;
      const xr = ax * cr + ay * sr;
      const v = CY - ax * sr + ay * cr - c.yh;
      // The town glows brighter in some directions than others.
      const hd = xr / F + c.psi;
      const dir = 0.55 + 0.8 * tex(hd * 0.8 + 0.3, 0.71);
      let R = 0;
      let G = 0;
      let Bc = 0;
      const wg = sstep(-1, 1, v);
      if (wg < 1) {
        // Sky: a dark blue zenith over the glow of the town, and the broken
        // cloud deck lit from below.
        const u = max(0, -v);
        let gl = gk * dir * (0.3 * exp(-u / 6) * (1 - fog) + 0.13 * exp(-u / 30));
        if (u > 0.3 && s.cover > 0) {
          const zz = (F * (HC - c.h)) / u;
          const xx = (xr * zz) / F;
          // Far cloud melts into the glow instead of shimmering.
          let n = tex((xx * cs + zz * sn + c.X) / 5000, (-xx * sn + zz * cs + c.P) / 5000 + s.drift, TC);
          n = 0.5 + (n - 0.5) * exp(-zz / 9000);
          gl += sstep(1 - s.cover, 1.3 - s.cover, n) * sstep(0.3, 5, u) * (0.15 + 0.3 * exp(-u / 22)) * dir * gk;
        }
        let sR = 0.03 + gc[0] * gl;
        let sG = 0.045 + gc[1] * gl;
        let sB = 0.13 + gc[2] * gl;
        // In fog the sky is the murk, darker going up.
        const fu = fog * (0.75 + 0.25 * exp(-u / 20));
        sR += (fogC[0] * fu - sR) * fog;
        sG += (fogC[1] * fu - sG) * fog;
        sB += (fogC[2] * fu - sB) * fog;
        R += sR * (1 - wg);
        G += sG * (1 - wg);
        Bc += sB * (1 - wg);
      }
      if (wg > 0) {
        const vv = max(0.05, v);
        const zc = (F * c.h) / vv;
        const xc = (xr * zc) / F;
        const dd = sqrt(zc * zc + xc * xc + c.h * c.h);
        const Tr = exp(-dd * ext);
        const E = land * s.bm[y * W + x] * min(1, pow(45 / dd, 1.3)) * Tr;
        let gR = 0;
        if (E > 0.008) gR = E * surface(xc * cs + zc * sn + c.X, -xc * sn + zc * cs + c.P);
        // The glow of the town runs a little way below the horizon.
        const band = gk * dir * 0.32 * exp(-vv / 2.2) * (1 - fog);
        R += (gR + gc[0] * band + fogC[0] * (1 - Tr)) * wg;
        G += (gR * 0.93 + gc[1] * band + fogC[1] * (1 - Tr)) * wg;
        Bc += (gR * 0.8 + gc[2] * band + fogC[2] * (1 - Tr)) * wg;
      }
      // The landing light beams seen in the air.
      const sc = s.scat * land * s.bs[y * W + x];
      const i = (y * W + x) * 3;
      const fd = s.fade * 255;
      O[i] = (R + sc) * fd + L[i] + BL[i] * s.bloom;
      O[i + 1] = (G + sc * 0.95) * fd + L[i + 1] + BL[i + 1] * s.bloom;
      O[i + 2] = (Bc + sc * 0.85) * fd + L[i + 2] + BL[i + 2] * s.bloom;
    }

  // Drops on the windscreen pick up the lights behind them.
  for (const q of s.drops) {
    const j = (clamp(round(q.y + 3), 0, H - 1) * W + clamp(round(q.x), 0, W - 1)) * 3;
    const e = 1.4 * s.fade;
    blob(O, q.x, q.y, 14 * e + BL[j] * e, 16 * e + BL[j + 1] * e, 20 * e + BL[j + 2] * e, q.r);
  }
  // The wiper blade, dark against the glow.
  if (s.rain > 0.3) {
    const dx = sin(s.wa);
    const dy = -cos(s.wa);
    for (let t = 30; t < 175; t += 0.7) {
      const x = round(58 + dx * t);
      const y = round(150 + dy * t);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      for (let e = 0; e < 2; e++) {
        const i = (y * W + min(W - 1, x + e)) * 3;
        O[i] *= 0.12;
        O[i + 1] *= 0.12;
        O[i + 2] *= 0.12;
      }
    }
  }
  // A soft shoulder, with a little of an overbright channel spilling into the
  // others so bright lights burn toward white.
  const sh = (v) => (v < 190 ? v : 255 - 65 * exp(-(v - 190) / 65));
  for (let i = 0, p = 0; p < N; p++, i += 3) {
    let r = O[i];
    let g = O[i + 1];
    let b = O[i + 2];
    const m = max(r, g, b);
    if (m > 255) {
      const sp = (m - 255) * 0.22;
      r += sp;
      g += sp;
      b += sp;
    }
    display.setPixel(p % W, (p / W) | 0, sh(r), sh(g), sh(b));
  }
}
