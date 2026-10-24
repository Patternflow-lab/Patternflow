// ===== Patternflow pattern =====
// Title:   Ferris Wheel
// Family:  fair
// Idea:    A big Ferris wheel turns slowly on a lakeside promenade at night with its gondolas hanging level, the light strips on its spokes and rim run one light show after another, and the lake below breaks the wheel and its lights into ripples.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after the light shows of the observation wheels on lake and river fronts
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Lights=0..1, Speed=0.2..3, Spokes=12..32, Wind=0..1
//
// Knob 1: Lights. Turns the show's three colours round the colour wheel together with the glow on the sky and the water, starting from azure, rose and violet.
// Knob 2: Speed. How fast the night runs: at 2 the wheel turns once in 40 s and each show lasts 6.5 s; at 0.2 the wheel, the shows, the clouds and the ripples all run ten times slower.
// Knob 3: Spokes. How many lit spokes the wheel has, 12 to 32. Up to 18 there is a gondola at the end of every spoke, past that at every other one.
// Knob 4: Wind. Near 0 the lake is a mirror with a slow swell under a few wisps of cloud; towards 1 cloud blows in lit from below by the wheel, the gondolas swing on their pivots and the reflection breaks into long streaks of light.
// Buttons: K1 tap starts the next show at once.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sin, cos, sqrt, exp, abs, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const F32 = (n) => new Float32Array(n);
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hsv(h, s, v) {
  h = fr(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 255 * v * (1 - s * max(0, min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

// The wheel: hub, outer rim with the lights, inner rim, and the truss between.
const CX = 32, CY = 38.5, R = 29.5, RI = 26.3, HUB = 3.6;
// The first row of the lake, which is the line the scene mirrors in, the
// promenade the legs stand on, and how much the reflection is squeezed.
const SEA = 87, FOOT = 84, SQ = 0.72;
// Light bins along each spoke and round the rim; the shows paint these.
const NB = 24, NR = 120;
const SHOWS = 6, DUR = 6.5, FADE = 0.35;
const CLOUD = [12, 14, 28], LAKE = [3, 7, 22], TINT = [0.85, 0.92, 1];
// A sine table for the ripples, which take five sines an LED.
const SN = F32(1024).map((_, i) => sin((i * TAU) / 1024));
const sn = (v) => SN[(v * 162.97) & 1023];
const STEEL = [26, 28, 42], LEG = [22, 24, 38], WARM = [255, 214, 150], WHITE = [255, 250, 240];

export function setup(params) {
  const P = (params.s = {
    t: 0, wt: 0, co: 0, rot: 0.2, st: 0, sh: 0, prev: -1, ps: 0, ns: 12, ng: 12, wind: 0.06, h: 0.53,
    f: F32(N * 3), cn: F32(256 * 76), sky: F32(SEA * W * 3), gm: F32(SEA * W), fg: F32(N * 3), fm: F32(N), ga: F32(N * 3),
    sp: F32(32 * NB * 3), rm: F32(NR * 3), hb: [0, 0, 0], sp2: F32(32 * NB * 3), rm2: F32(NR * 3), hb2: [0, 0, 0],
    stars: [], people: [], cab: [],
  });
  // Night sky, paler towards the horizon, and the hills behind the far shore
  // with a few houses lit.
  for (let y = 0; y < SEA; y++)
    for (let x = 0; x < W; x++) {
      const v = y / SEA, o = (y * W + x) * 3, hy = 77 + 2.4 * sin(x * 0.11 + 0.7) + 1.4 * sin(x * 0.29 + 2);
      let c = [3 + 14 * v * v, 5 + 18 * v * v, 22 + 46 * v * v];
      if (y > hy) c = [7, 8, 18];
      if (y > hy + 1 && hash(x, y) < 0.025) c = [120, 96, 60];
      P.sky.set(c, o);
      // Where the wheel's light lands on the haze: round the wheel and low over the shore.
      const r = sqrt((x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2);
      P.gm[y * W + x] = 0.75 * exp(-(max(0, r - 18) ** 2) / 420) + 0.45 * exp(-(SEA - y) / 22);
    }
  // Cloud: three octaves of value noise 256 wide, so it can scroll round.
  const seed = floor(rnd() * 999);
  const vn = (x, y, cx, cy, s) => {
    const nx = 256 / cx, gx = x / cx, gy = y / cy, ix = floor(gx), iy = floor(gy), u = sm(0, 1, gx - ix), v = sm(0, 1, gy - iy);
    const h = (i, j) => hash(((ix + i) % nx) + s, iy + j);
    return mix(mix(h(0, 0), h(1, 0), u), mix(h(0, 1), h(1, 1), u), v);
  };
  for (let y = 0; y < 76; y++) for (let x = 0; x < 256; x++) P.cn[y * 256 + x] = 0.55 * vn(x, y, 32, 9, seed) + 0.3 * vn(x, y, 16, 5, seed + 7) + 0.15 * vn(x, y, 8, 3, seed + 13);
  for (let i = 0; i < 36; i++) P.stars.push([floor(rnd() * W), floor(rnd() * 46), 40 + rnd() * 70, rnd() * TAU, 0.6 + rnd()]);
  // The promenade, the boarding platform with its stairs, two lamps and the
  // ticket booth, kept as one layer with its own coverage.
  const fg = (x, y, c, a = 1) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    P.fg.set(c, (y * W + x) * 3);
    P.fm[y * W + x] = a;
  };
  const glow = (gx, gy, c, k, s) => {
    for (let y = max(0, gy - 12); y < min(SEA, gy + 12); y++)
      for (let x = max(0, gx - 12); x < min(W, gx + 12); x++) {
        const g = k * exp(-((x - gx) ** 2 + (y - gy) ** 2) / s);
        for (let n = 0; n < 3; n++) P.ga[(y * W + x) * 3 + n] += c[n] * g;
      }
  };
  for (let x = 0; x < W; x++) {
    fg(x, 84, [34, 28, 32]);
    fg(x, 85, [28, 24, 30]);
    fg(x, 86, [64, 60, 70]);
  }
  for (let x = 22; x <= 42; x++) fg(x, 77, [78, 74, 92]), fg(x, 78, [30, 30, 42]);
  for (const x of [24, 32, 40]) for (let y = 79; y < 84; y++) fg(x, y, [22, 22, 32]);
  for (let i = 0; i < 6; i++) fg(21 - i, 78 + i, [60, 56, 70]), fg(21 - i, 79 + i, [26, 24, 34]);
  for (const lx of [5, 46]) {
    for (let y = 76; y < 84; y++) fg(lx, y, [36, 36, 48]);
    fg(lx, 75, [255, 230, 180]);
    fg(lx - 1, 75, [120, 100, 70]);
    fg(lx + 1, 75, [120, 100, 70]);
    glow(lx, 76, WARM, 0.32, 14);
  }
  for (let x = 53; x <= 62; x++) {
    const st = ((x - 53) >> 1) & 1 ? [226, 218, 206] : [200, 36, 56];
    fg(x, 72, st);
    if (!(x & 1)) fg(x, 73, st);
    for (let y = 74; y < 84; y++) fg(x, y, x === 53 || x === 62 ? [40, 22, 30] : [70, 34, 46]);
  }
  for (let y = 75; y <= 78; y++) for (let x = 55; x <= 60; x++) fg(x, y, [255, 196, 120].map((v) => v * (0.85 - 0.08 * (y - 75))));
  for (const [x, y] of [[58, 76], [57, 78], [58, 78], [59, 78]]) fg(x, y, [40, 24, 24]);
  fg(58, 77, [56, 32, 30]);
  for (let x = 54; x <= 61; x++) fg(x, 79, [160, 116, 70]), fg(x, 81, (x & 1) ? [240, 200, 90] : [110, 70, 40]);
  glow(58, 80, [255, 180, 100], 0.28, 18);
  // People on the promenade, a queue at the foot of the stairs and two who walk.
  for (const [x, w] of [[9, 0], [14, 0], [17, 0], [49, 0], [27, 2.2], [40, -1.6]])
    P.people.push({ x: x + 0.5, w, c: hsv(rnd(), 0.5, 0.25 + 0.15 * rnd()), sk: rnd() < 0.5 });
  for (let i = 0; i < 32; i++) P.cab.push([0.55 + 0.45 * rnd(), rnd() < 0.4]);
}

function next(P) {
  P.prev = P.sh;
  P.ps = P.st;
  P.sh = (P.sh + 1) % SHOWS;
  P.st = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  const v = cl(k[1], 0.2, 3) / 2;
  let ns = round(cl(k[2], 12, 32));
  if (ns > 18) ns += ns & 1;
  Object.assign(P, { h: fr(0.53 + cl(k[0], 0, 1)), ns, ng: ns > 18 ? ns / 2 : ns, wind: cl(k[3], 0, 1) });
  P.t += dt;
  P.wt += dt * v * (0.7 + 1.5 * P.wind);
  P.co += dt * v * (1 + 10 * P.wind);
  P.rot += (dt * v * TAU) / 40;
  P.st += dt * v;
  if ((input.btnPressed && input.btnPressed[0]) || P.st >= DUR) next(P);
  for (const q of P.people)
    if (q.w) {
      q.x += q.w * dt * v;
      if (q.x > W + 3) q.x = -3;
      if (q.x < -3) q.x = W + 3;
    }
}

// One show at its time s paints the spoke bins, the rim bins and the hub.
function paint(P, sh, s, SP, RM, HB) {
  const ns = P.ns, [A, B, C] = P.pal, rot = P.rot;
  const spk = (k, b, c, I) => {
    const o = (k * NB + b) * 3;
    (SP[o] = c[0] * I), (SP[o + 1] = c[1] * I), (SP[o + 2] = c[2] * I);
  };
  const rim = (j, c, I) => ((RM[j * 3] = c[0] * I), (RM[j * 3 + 1] = c[1] * I), (RM[j * 3 + 2] = c[2] * I));
  const lerp = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const hub = (c, I) => ((HB[0] = c[0] * I), (HB[1] = c[1] * I), (HB[2] = c[2] * I));
  const uB = (b) => (b + 0.5) / NB;
  if (sh === 0) {
    // Light runs out along the spokes, brightest where a beam sweeps round
    // against the turn; marquee bulbs chase round the rim and three white
    // comets run through them.
    const sw = fr(-s * 0.3), mq = floor(s * 9);
    for (let k = 0; k < ns; k++) {
      const dl = fr(k / ns - sw), bm = exp(-dl / 0.22), wt = 0.5 * exp(-dl * ns * 1.5);
      for (let b = 0; b < NB; b++) {
        const u = uB(b), ds = exp(-(((fr(u * 2 - s * 1.1) - 0.5) / 0.17) ** 2));
        spk(k, b, lerp(lerp(C, A, u), WHITE, wt), 0.14 + 0.25 * bm + 0.61 * ds * (0.45 + 0.55 * bm));
      }
    }
    for (let j = 0; j < NR; j++) {
      let I = 0;
      for (let m = 0; m < 3; m++) I = max(I, exp(-fr(fr(s * 0.42 + m / 3) - j / NR) / 0.04));
      rim(j, lerp(B, WHITE, I), max(I, (floor(j / 2) + mq) % 3 ? 0.22 : 0.9));
    }
    hub(A, 0.8);
  } else if (sh === 1) {
    // A colour wipe across the whole wheel, lit full, with a white front.
    const X = CX + 35 * cos((PI * s) / 3.25), f0 = 0.88 * sm(0, 0.5, s);
    const col = (x) => lerp(lerp(A, B, sm(X - 2.5, X + 2.5, x)), WHITE, 0.7 * exp(-(((x - X) / 2.2) ** 2)));
    for (let k = 0; k < ns; k++) {
      const c = cos(rot + (TAU * k) / ns);
      for (let b = 0; b < NB; b++) spk(k, b, col(CX + (HUB + uB(b) * (R - HUB)) * c), f0);
    }
    for (let j = 0; j < NR; j++) rim(j, col(CX + R * cos(rot + (TAU * (j + 0.5)) / NR)), f0);
    hub(col(CX), f0);
  } else if (sh === 2) {
    // A spiral arm winds out from the hub and round the wheel.
    for (let k = 0; k < ns; k++)
      for (let b = 0; b < NB; b++) {
        const u = uB(b), v = fr(u * 0.9 + k / ns - s * 0.45);
        spk(k, b, lerp(B, C, u), 0.07 + 0.93 * exp(-(((v - 0.5) / 0.2) ** 2)));
      }
    for (let j = 0; j < NR; j++) rim(j, A, fr((j / NR) * ns * 0.5 - s * 0.9) < 0.5 ? 0.95 : 0.12);
    hub(B, 0.9);
  } else if (sh === 3) {
    // Spoke after spoke lights up round the wheel, holds, and blinks out.
    const n = (s / 3.6) * ns, blink = s > 4.8 && fr((s - 4.8) * 2.6) > 0.5;
    for (let k = 0; k < ns; k++) {
      const I = blink ? 0.04 : k < floor(n) ? 0.9 : k === floor(n) ? fr(n) : 0.05;
      for (let b = 0; b < NB; b++) spk(k, b, k === floor(n) ? WHITE : k & 1 ? B : A, I);
    }
    for (let j = 0; j < NR; j++) rim(j, C, blink ? 0.04 : j / NR < n / ns ? 0.95 : 0.08);
    hub(WHITE, blink ? 0.1 : 0.85);
  } else if (sh === 4) {
    // Rings run out from the hub, each a colour, and flash the rim on arriving.
    SP.fill(0, 0, ns * NB * 3);
    let Ir = 0.08, Ih = 0.2, cr = A;
    for (let m = 0; m < 3; m++) {
      // Rings are born in the order A, C, B, so each takes the next colour.
      const f = fr(s * 0.4 + m / 3), c = P.pal[m], e = exp(-(((1 - f) / 0.06) ** 2));
      for (let k = 0; k < ns; k++)
        for (let b = 0; b < NB; b++) {
          const I = exp(-(((uB(b) - f) / 0.07) ** 2)), o = (k * NB + b) * 3;
          for (let n = 0; n < 3; n++) SP[o + n] += c[n] * I;
        }
      if (e > Ir) (Ir = e), (cr = c);
      Ih = max(Ih, exp(-((f / 0.08) ** 2)));
    }
    for (let k = 0; k < ns * NB * 3; k++) SP[k] += 14;
    for (let j = 0; j < NR; j++) rim(j, cr, max(0.1, Ir));
    hub(WHITE, Ih);
  } else {
    // Every spoke its own colour, the rainbow turning round, with sparkles.
    const tw = floor(s * 7);
    for (let k = 0; k < ns; k++) {
      const c = hsv(P.h + fr(k / ns + s * 0.12), 0.85, 1);
      for (let b = 0; b < NB; b++) hash(k * NB + b, tw) < 0.07 ? spk(k, b, WHITE, 1) : spk(k, b, c, 0.72);
    }
    for (let j = 0; j < NR; j++) rim(j, hsv(P.h + fr(j / NR - s * 0.25), 0.8, 1), 0.75);
    hub(WHITE, 0.8);
  }
}

let F;
const add = (x, y, c, k) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let n = 0; n < 3; n++) F[o + n] += c[n] * k;
};
const put = (x, y, c, k = 1) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let n = 0; n < 3; n++) F[o + n] = c[n] * k;
};

// A leg of the A-frame from the hub to the promenade, a dark girder.
function leg(ax, ay, bx, by, hw, edge) {
  const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy;
  for (let y = floor(ay); y <= by; y++)
    for (let x = max(0, floor(min(ax, bx) - 2)); x <= min(W - 1, max(ax, bx) + 2); x++) {
      const qx = x + 0.5 - ax, qy = y + 0.5 - ay, t = cl((qx * dx + qy * dy) / ll, 0, 1), ex = qx - dx * t, ey = qy - dy * t, d = sqrt(ex * ex + ey * ey);
      const w = cl(hw + 0.5 - d, 0, 1);
      if (w <= 0) continue;
      const o = (y * W + x) * 3, lit = 0.5 + 0.5 * cl((d - hw + 0.6) * 1.5, 0, 1);
      const fl = 0.32 * exp(-(FOOT - y) / 9);
      for (let n = 0; n < 3; n++) F[o + n] = mix(F[o + n], LEG[n] + edge[n] * lit + WARM[n] * fl, w);
    }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.f) return;
  F = P.f;
  const ns = P.ns, rot = P.rot, t = P.t;
  P.pal = [hsv(P.h, 0.85, 1), hsv(P.h + 0.42, 0.8, 1), hsv(P.h + 0.2, 0.75, 1)];
  const SP = P.sp, RM = P.rm, HB = P.hb;
  paint(P, P.sh, P.st, SP, RM, HB);
  if (P.prev >= 0 && P.st < FADE) {
    const q = P.st / FADE;
    paint(P, P.prev, P.ps + P.st, P.sp2, P.rm2, P.hb2);
    for (let i = 0; i < ns * NB * 3; i++) SP[i] = mix(P.sp2[i], SP[i], q);
    for (let i = 0; i < NR * 3; i++) RM[i] = mix(P.rm2[i], RM[i], q);
    for (let n = 0; n < 3; n++) HB[n] = mix(P.hb2[n], HB[n], q);
  }
  // The wheel's light in the haze: the mean colour of every bin.
  const gc = [0, 0, 0], ws = ((R - HUB) / NB) * ns, wr = (TAU * R) / NR;
  for (let i = 0; i < ns * NB; i++) for (let n = 0; n < 3; n++) gc[n] += SP[i * 3 + n] * ws;
  for (let j = 0; j < NR; j++) for (let n = 0; n < 3; n++) gc[n] += RM[j * 3 + n] * wr * ns;
  for (let n = 0; n < 3; n++) gc[n] /= ns * NB * ws + NR * wr * ns;
  // The haze takes a dim show nearly whole and a bright one by less.
  const gk = 0.62 / (1 + (1.6 * max(...gc)) / 255);
  for (let n = 0; n < 3; n++) gc[n] *= gk;

  // Sky, haze, stars and a thin moon.
  for (let i = 0, o = 0; i < SEA * W; i++, o += 3) {
    const g = P.gm[i];
    for (let n = 0; n < 3; n++) F[o + n] = P.sky[o + n] + gc[n] * g;
  }
  for (const [x, y, b, ph, sp] of P.stars) add(x, y, [1, 1, 1.15], b * (0.65 + 0.35 * sin(t * sp + ph)));
  for (let y = 3; y < 11; y++)
    for (let x = 51; x < 60; x++) {
      const a = (x + 0.5 - 55) ** 2 + (y + 0.5 - 7) ** 2, b = (x + 0.5 - 56.6) ** 2 + (y + 0.5 - 6) ** 2;
      const k = cl(3.4 - sqrt(a), 0, 1) * cl(sqrt(b) - 2.9, 0, 1);
      if (k > 0) add(x, y, [236, 228, 196], k);
    }
  // Clouds come in on the wind, lit from below by the wheel.
  const wd = P.wind, th = 0.68 - 0.4 * wd, co = floor(P.co), cf = P.co - co;
  for (let y = 0; y < 76; y++) {
    const hf = sm(76, 56, y);
    for (let x = 0; x < W; x++) {
      const c0 = y * 256, n = mix(P.cn[c0 + ((x + co) & 255)], P.cn[c0 + ((x + co + 1) & 255)], cf), dn = sm(th - 0.04, th + 0.22, n) * hf * 0.7;
      if (dn <= 0) continue;
      const i = y * W + x, o = i * 3, g = 3 * (P.gm[i] + 0.2);
      for (let k = 0; k < 3; k++) F[o + k] = mix(F[o + k], CLOUD[k] + gc[k] * g, dn);
    }
  }

  // Spokes, truss and rims, lit from the show's bins.
  const st = STEEL.map((v, n) => v + gc[n] * 0.5);
  for (let y = 7; y <= 70; y++) {
    const dy = y + 0.5 - CY;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, r2 = dx * dx + dy * dy;
      if (r2 > (R + 1.4) ** 2) continue;
      const r = sqrt(r2), o = (y * W + x) * 3;
      let a = (atan2(dy, dx) - rot) / TAU;
      a -= floor(a);
      const q = a * ns, kk = round(q), d = (abs(q - kk) * TAU * r) / ns;
      const wsp = r > HUB && r < R ? cl(1.25 - 1.5 * d, 0, 1) : 0;
      const wrm = cl(1.25 - 1.5 * abs(r - R), 0, 1);
      let wst = cl(1 - 1.6 * abs(r - RI), 0, 1) * 0.8;
      if (r > RI && r < R) {
        const z = abs(fr(a * ns * 2) - 0.5) * 2, tt = (r - RI) / (R - RI);
        wst = max(wst, cl(1 - 2.2 * abs(z - tt), 0, 1) * 0.7);
      }
      const occ = max(wsp, wrm, wst);
      if (occ <= 0) continue;
      const so = ((kk % ns) * NB + min(NB - 1, floor(((r - HUB) / (R - HUB)) * NB))) * 3, ro = (floor(a * NR) % NR) * 3;
      for (let n = 0; n < 3; n++) F[o + n] = F[o + n] * (1 - 0.85 * occ) + st[n] * occ + SP[so + n] * wsp + RM[ro + n] * wrm;
    }
  }

  // The gondolas hang level from the rim, swinging in the wind.
  const [A, B, C] = P.pal, step = ns / P.ng;
  for (let i = 0; i < P.ng; i++) {
    const ang = rot + (TAU * i * step) / ns, px = CX + R * cos(ang), py = CY + R * sin(ang);
    const sw = wd * (0.45 * sin(t * 1.8 + i * 1.1) + 0.25 * sin(t * 3.1 + i * 2.3)) + 0.05 * sin(t * 1.4 + i);
    const gx = round(px - 0.5), gy = round(py - 0.5), cx = round(px - 0.5 + 3.2 * sin(sw)), [wk, empty] = P.cab[i];
    const body = [A, B, C][i % 3].map((v, n) => v * 0.62 + gc[n]);
    put(gx, gy, [150, 150, 170]);
    put(round(px - 0.5 + 1.2 * sin(sw)), gy + 1, [60, 60, 76]);
    for (let dx = -1; dx <= 1; dx++) put(cx + dx, gy + 2, body), put(cx + dx, gy + 5, body, 0.75);
    for (let dy = 3; dy <= 4; dy++) {
      put(cx - 2, gy + dy, body, 0.85);
      put(cx + 2, gy + dy, body, 0.85);
      for (let dx = -1; dx <= 1; dx++) put(cx + dx, gy + dy, WARM, (empty || dx || dy > 3 ? 0.78 : 0.2) * wk);
    }
  }

  // The A-frame in front of the wheel, and the hub on it.
  const edge = gc.map((v) => v * 1.4);
  leg(CX, CY, 12, FOOT, 0.85, edge);
  leg(CX, CY, 52, FOOT, 0.85, edge);
  for (let y = 33; y <= 44; y++)
    for (let x = 26; x <= 38; x++) {
      const r = sqrt((x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2), k = cl(HUB + 0.5 - r, 0, 1);
      if (k <= 0) continue;
      const o = (y * W + x) * 3, core = exp(-(r * r) / 2.5);
      for (let n = 0; n < 3; n++) F[o + n] = mix(F[o + n], 30 + HB[n] * (1 - r / 6) + WHITE[n] * core * 0.6, k);
    }

  // The shore: promenade, platform, lamps, booth, the warm light they throw.
  for (let i = 70 * W, o = i * 3; i < SEA * W; i++, o += 3) {
    const m = P.fm[i];
    for (let n = 0; n < 3; n++) F[o + n] = mix(F[o + n], P.fg[o + n], m) + P.ga[o + n];
  }
  for (let x = 23; x <= 41; x += 2) put(x, 76, B, floor(t * 4 - x / 2) % 3 ? 0.35 : 0.85);
  for (let x = 53; x <= 62; x += 2) put(x, 71, WARM, floor(t * 5 + x / 2) % 2 ? 0.3 : 1);
  for (const q of P.people) {
    const x = floor(q.x), gait = q.w ? floor(q.x * 1.5) & 1 : 0;
    put(x, 79, q.sk ? [150, 110, 86] : [70, 52, 44]);
    for (let y = 80; y <= 82; y++) put(x, y, q.c), put(x + 1, y, q.c, 0.8);
    put(x + gait, 83, [16, 16, 24]);
    put(x + 1 - gait, 83, [16, 16, 24], 0.7);
  }

  // The lake: the scene above, mirrored, squeezed and broken by the ripples.
  const wt = P.wt, gw = 0.55 + 0.35 * wd, pw = 3 - 1.2 * wd, sp = 0.5 + 6 * wd;
  const row = (ys, sx) => (cl(round(ys), 0, SEA - 1) * W + sx) * 3;
  for (let y = SEA; y < H; y++) {
    const d = y + 0.5 - SEA, dn = d / (H - SEA), amp = (0.35 + 1.9 * wd) * (0.45 + dn), rf = 0.7 - 0.3 * dn;
    for (let x = 0; x < W; x++) {
      const ox = amp * (0.6 * sn(d * 0.75 - wt * 1.9 + x * 0.04) + 0.4 * sn(d * 2.3 + x * 0.37 - wt * 3.3));
      const ys = SEA - 0.5 - d / SQ + amp * 0.45 * sn(x * 0.45 + d * 1.1 - wt * 2.6), sx = cl(round(x + ox), 0, W - 1);
      const hl = (0.5 + 0.5 * sn(d * 1.7 - wt * 1.4 + 1.6 * sn(x * 0.15 + d * 0.3 + wt * 0.5))) ** pw, o = (y * W + x) * 3;
      // Choppy water stretches each light into a streak: the brightest of the
      // rows a wave face can show here, above the mirror point and below it.
      const s1 = row(ys, sx), s0 = row(ys - sp, sx), s2 = row(ys + sp, sx), s3 = row(ys - sp / 2, sx), s4 = row(ys + sp / 2, sx);
      for (let n = 0; n < 3; n++)
        F[o + n] = LAKE[n] * (1 + dn * 0.5) + gc[n] * gw * hl + (0.55 * F[s1 + n] + 0.5 * max(F[s0 + n], F[s2 + n], F[s3 + n], F[s4 + n])) * rf * TINT[n];
    }
  }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
