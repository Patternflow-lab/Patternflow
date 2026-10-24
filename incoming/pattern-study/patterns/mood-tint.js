// ===== Patternflow pattern =====
// Title:   Mood Tint
// Family:  cosmetic
// Idea:    A thermochromic coat over the whole panel, deep violet while cool, that unseen fingertips press here and there: each press leaves a warm oval with faint fingerprint ridges, the heat spreads and drains back into the room, and the colour flips to pale orchid wherever the surface is above one temperature, so the prints bloom with crisp edges, lose their ridges first, merge with their neighbours like soft blobs and shrink back into the deep colour.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 34, after thermochromic lip tints and mood nail polish
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Warmth=-1..1, Blend=0..1
//
// Knob 1: Hue. The coat's colour once round the wheel; the warm shade is a pale tint 0.08 further round. At 0 deep violet turning pale orchid; at 0.24 wine red turning peach; at 0.3 orange turning cream; at 0.4 yellow turning pale lemon; at 0.5 green turning mint; at 0.75 deep teal turning pale sky; at 0.9 indigo turning lavender. Round orange, yellow and lime the cool coat stays bright, 0.78 of full instead of 0.44, so it never reads brown or olive.
// Knob 2: Speed. At 2 a group of one to three fingertips lands every 0.28 seconds on average and each is held 0.45 to 0.75 seconds; a lone print's ridges fade within about 0.4 seconds of lifting and the print is gone 1.7 seconds after. At 0.2 all of it runs ten times slower, at 3 one and a half times faster.
// Knob 3: Warmth. How warm the fingertips are over the room, the coat turning at 0.4. At 0 they are 1.0 and a lone print turns about 100 LEDs pale; at -1 they are 0.63, only the pressed ridges cross the turning point and each print is a broken whorl of about 60 LEDs gone within a second; at 1 they are 1.6, the prints whiten, spread to about 115 LEDs, last 3.5 seconds and run together.
// Knob 4: Blend. How far either side of the turning point the colour change is spread. At 0 it is 0.012 of a fingertip's warmth, so the edge of a print is one LED sharp; at 0.06 almost the same; at 0.5 it is 0.16 and the edges go soft; at 1 it is 0.61 and the heat shows as soft glows with the fresh ridges standing out white, like a mood ring.
// Buttons: K1 tap presses a whole palm somewhere on the panel for 1.1 seconds: a warm oval 34 by 46 LEDs with soft crease lines across it.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, atan2, exp, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// Temperatures are in units of a fingertip at Warmth 0 above the room: the
// room is 0, a fingertip 1. The coat turns at THETA.
const THETA = 0.4;
// Heat diffusion in LED^2 a second and Newton cooling a second, at Speed 2.
const ALPHA = 1.1, COOL = 0.32;
// How fast the coat under a pressed fingertip takes its warmth, a second.
const GRIP = 7;
// Hue of the cool coat at Hue 0: violet. The warm coat is a paler, pinker shade.
const H0 = 0.76;
// The colour table spans temperatures -0.2 to 1.8.
const LUT = 512, T0 = -0.2, T1 = 1.8;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, warmth: 0, blend: 0.06, warm: false, clock: 0, nextPress: 0,
    T: new Float32Array(N), U: new Float32Array(N), room: new Float32Array(N),
    presses: [], lut: new Uint8Array(LUT * 3), lutKey: "", c: [0, 0, 0], c2: [0, 0, 0],
  };
  const S = params.s;
  // The room is not quite even: a soft field of +-0.05 that only the cool
  // shade shows.
  const g = [];
  for (let i = 0; i < 5 * 9; i++) g.push(random() * 2 - 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x / W) * 4, v = (y / H) * 8, i = floor(u), j = floor(v), fu = sm(0, 1, u - i), fv = sm(0, 1, v - j);
      const a = g[j * 5 + i], b = g[j * 5 + i + 1], c = g[(j + 1) * 5 + i], d = g[(j + 1) * 5 + i + 1];
      S.room[y * W + x] = 0.05 * ((a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv);
    }
}

// A fingertip pad: an oval about 11 by 16 LEDs, tilted, with whorl ridges
// 2.3 LEDs apart round a core a little below its middle.
function fingertip(x, y) {
  return {
    x, y, rx: 5 + random() * 1.5, ry: 7 + random() * 1.8, a: (random() - 0.5) * 1.1,
    core: 1 + random() * 2, ph: random() * 6.28, lam: 2.8, palm: false,
    t: 0, dur: 0.45 + random() * 0.3,
  };
}

// The coat's colour at each temperature, rebuilt when a knob moves it.
function buildLut(S) {
  const key = S.hue.toFixed(3) + S.blend.toFixed(3);
  if (key === S.lutKey) return;
  S.lutKey = key;
  const h = S.hue + H0, hh = h - floor(h), c = S.c, c2 = S.c2;
  // Orange and yellow go brown or olive when deep, so round them the cool
  // shade stays bright.
  const lift = sm(0.0, 0.06, hh) * (1 - sm(0.24, 0.33, hh));
  const width = 0.012 + 0.6 * S.blend * S.blend;
  for (let i = 0; i < LUT; i++) {
    const T = T0 + ((T1 - T0) * i) / (LUT - 1);
    const m = sm(THETA - width, THETA + width, T);
    // Cool: deeper the colder it is, a little lighter just short of turning.
    const vc = 0.44 + 0.34 * lift + 0.12 * sm(-0.1, THETA, T);
    hsv(h, 0.9 - 0.1 * lift, vc, c);
    // Warm: pale, and paler the hotter, so a ridge pressed hot is a whiter line.
    const hot = sm(THETA, THETA + 0.7, T);
    hsv(h + 0.08, (0.5 - 0.42 * hot) * (1 - 0.5 * lift), 1, c2);
    for (let k = 0; k < 3; k++) S.lut[i * 3 + k] = round(255 * (c[k] + (c2[k] - c[k]) * m));
  }
}

// One moment of the coat: presses warm it, heat spreads and drains away.
function step(S, dt) {
  const { T, U, room } = S;
  const Tf = 1.6 ** S.warmth;
  // Fingertips arrive in little groups of one to three, about every 0.42 s.
  S.nextPress -= dt;
  if (S.nextPress <= 0) {
    S.nextPress = 0.1 + random() * 0.35;
    const n = random() < 0.55 ? 1 : random() < 0.7 ? 2 : 3;
    const x0 = 6 + random() * (W - 12), y0 = 8 + random() * (H - 16);
    for (let i = 0; i < n; i++) S.presses.push(fingertip(x0 + (i - (n - 1) / 2) * 12 + (random() - 0.5) * 3, y0 + (random() - 0.5) * 8));
  }
  for (const P of S.presses) {
    P.t += dt;
    const env = sm(0, 0.12, P.t) * (1 - sm(P.dur - 0.1, P.dur, P.t));
    if (env <= 0) continue;
    const ca = cos(P.a), sa = sin(P.a), R = max(P.rx, P.ry) + 2;
    const k = 1 - exp(-GRIP * dt * env);
    for (let y = max(0, floor(P.y - R)); y <= min(H - 1, P.y + R); y++)
      for (let x = max(0, floor(P.x - R)); x <= min(W - 1, P.x + R); x++) {
        const dx = x - P.x, dy = y - P.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        const rho = sqrt((u / P.rx) ** 2 + (v / P.ry) ** 2);
        if (rho >= 1) continue;
        let ridge;
        if (P.palm) ridge = 0.5 + 0.5 * cos(u * 0.35 + 2.2 * sin(v * 0.11 + P.ph)) * cos(v * 0.5 + sin(u * 0.2));
        else {
          const vv = v - P.core, rw = sqrt(u * u + vv * vv * 0.7) + 0.8 * sin(atan2(vv, u) + P.ph);
          ridge = 0.5 + 0.5 * cos((2 * PI * rw) / P.lam);
        }
        const s = (1 - sm(0.72, 1, rho)) * (0.58 + 0.42 * ridge);
        const p = y * W + x, target = Tf * s;
        if (target > T[p]) T[p] += (target - T[p]) * k;
      }
  }
  S.presses = S.presses.filter((P) => P.t < P.dur);
  // Heat equation on the panel, its edges insulated, and Newton cooling
  // toward the room.
  const a = ALPHA * dt, c = COOL * dt;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, t = T[p];
      const l = x > 0 ? T[p - 1] : t, r = x < W - 1 ? T[p + 1] : t, u = y > 0 ? T[p - W] : t, d = y < H - 1 ? T[p + W] : t;
      U[p] = t + a * (l + r + u + d - 4 * t) - c * (t - room[p]);
    }
  T.set(U);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.warmth = cl(k[2], -1, 1);
  S.blend = cl(k[3], 0, 1);
  if (!S.warm) {
    // Open on a coat that has been pressed for four seconds.
    for (let i = 0; i < 120; i++) step(S, 1 / 30);
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    const P = fingertip(10 + random() * (W - 20), 22 + random() * (H - 44));
    Object.assign(P, { rx: 17, ry: 23, a: (random() - 0.5) * 0.5, palm: true, dur: 1.1 });
    S.presses.push(P);
  }
  // Time on the coat runs at Speed / 2; steps stay under 0.07 s so the heat
  // equation holds steady.
  let left = (d * S.speed) / 2;
  while (left > 1e-6) {
    const h = min(left, 0.07);
    step(S, h);
    left -= h;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  buildLut(S);
  const { T, lut } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = round(((cl(T[y * W + x], T0, T1) - T0) / (T1 - T0)) * (LUT - 1)) * 3;
      display.setPixel(x, y, lut[i], lut[i + 1], lut[i + 2]);
    }
}
