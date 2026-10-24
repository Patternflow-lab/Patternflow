// ===== Patternflow pattern =====
// Title:   Geyser
// Family:  volcano
// Idea:    A Strokkur-style geyser in a snowy geothermal field, cut open below the ground: steam bubbles climb the conduit under a turquoise pool, the pool swells into a glassy dome and bursts into a white column up to the top of the panel, spray falls back, the steam drifts off on the wind and the pool drains, gurgles and fills again.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after Strokkur in the Haukadalur geothermal field, Iceland
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Power=0..1, Wind=-1..1
//
// Knob 1: Light. A low winter sun at noon at 0, the blue hour at 0.5, and at 1 a moonlit night with green aurora over the field and the visitors' phones glowing.
// Knob 2: Speed. At 2 one cycle, dome to dome, takes about thirteen seconds; at 0.2 ten times longer.
// Knob 3: Power. At 0 one jet that just reaches the top of the panel. Turned up, the dome swells bigger and bursts sooner, the column widens and punches out of the top, the jet lasts longer in two surges and the steam cloud grows.
// Knob 4: Wind. At the start a light breeze drifts the steam to the right; turned left it drops to calm and then carries it left, turned right it tears it off to the right. The column and the spray lean with it.
// Buttons: K1 tap sets it off now, if it is filling or draining: the big bubble leaves the chamber and the dome and the jet follow.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sin, sqrt, exp, abs, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
const sc = (c, k) => c.map((v, n) => v * (k.length ? k[n] : k));
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}

// Rows: the pool's brim, the bowl's floor, the snow on the flat, the horizon,
// the drained water level; the vent's column; the chamber's centre and radii.
const [BRIM, BOWL, GY, HZ, LOW, C] = [71, 80, 75, 61, 103, 32];
const [KX, KY, KRX, KRY] = [30.5, 116, 10, 6.5];
// Gravity in rows per second squared.
const G = 150;
// Seconds at Speed 2: refill, the big bubble's climb, the dome, the drain.
const [HEAT, RISE, DOME, FALL] = [7.5, 0.7, 0.45, 3.5];

// The ground: the bowl, the sinter mound with a lip at the brim, the flat.
const SURF = new Float32Array(W).map((_, x) => {
  const dx = abs(x + 0.5 - C);
  if (dx < 12) return BRIM + (BOWL - BRIM) * (1 - (dx / 12) ** 2) ** 0.7;
  if (dx < 27) return BRIM - 0.8 * (1 - sm(12, 16, dx)) + (GY - BRIM) * sm(14, 27, dx);
  return GY + 0.8 * (vn(x * 0.2, 3) - 0.5);
});
// The conduit wanders a little and narrows at row 95.
const CXA = new Float32Array(H).map((_, y) => C - 0.5 + 0.8 * sin(y * 0.23) + 0.4 * sin(y * 0.61 + 1));
const CHW = new Float32Array(H).map((_, y) => 2 + 0.4 * sin(y * 0.37) - 0.6 * exp(-(((y - 95) / 3) ** 2)));
// The hill behind the field on the right, the ice cap on the horizon at the left.
const HILL = new Float32Array(W).map((_, x) => HZ - 20 * sm(30, 66, x) ** 0.9 - 1.2 * vn(x * 0.35, 4));
const CAP = new Float32Array(W).map((_, x) => HZ - 1.5 - 2.6 * sqrt(max(0, 1 - ((x + 0.5 - 13) / 17) ** 2)));
// Cracks feeding ground water to the chamber.
const FIS = [[[0, 94], [7, 98], [15, 104], [22, 112]], [[63, 103], [55, 108], [47, 113], [40, 117]]];
// The beds, top down, colour and rows: sinter, geyserite, ochre, sinter, rust,
// sulphur, grey clay, ochre, dark rust, tuff, sulphur, dark clay, basalt.
const LAY = [[206, 200, 186, 3], [176, 172, 166, 2], [172, 122, 54, 2], [196, 188, 172, 2], [150, 70, 40, 3], [206, 182, 62, 1], [126, 116, 108, 4], [162, 112, 52, 2], [120, 56, 36, 2], [104, 92, 84, 4], [200, 176, 64, 1], [84, 74, 72, 5], [58, 58, 68, 99]];
const SULF = [214, 190, 70], RUST = [158, 76, 42], LINE = [214, 210, 196], SNOW = [214, 222, 236];
const MAT = [[96, 116, 52], [214, 112, 38], [212, 186, 70]];
const COOL = [24, 62, 150], HOT = [44, 176, 204], FOAM = [212, 232, 236];
const JACK = [[200, 46, 40], [232, 192, 44], [40, 92, 200], [44, 44, 52], [58, 140, 92], [222, 112, 34], [150, 60, 150]];

// Noon, blue hour, night: sky overhead and at the horizon, daylight, steam lit
// and in shade, the cut rock, the water.
const LIGHT = [
  [0, [20, 62, 152], [122, 156, 198], [0.95, 0.93, 0.88], [236, 234, 226], [118, 134, 168], 1, 1],
  [0.5, [10, 24, 74], [66, 88, 148], [0.42, 0.48, 0.7], [158, 168, 212], [50, 60, 108], 0.85, 0.78],
  [1, [3, 7, 24], [12, 26, 54], [0.24, 0.3, 0.42], [132, 154, 168], [30, 42, 70], 0.62, 0.6],
];
function lightAt(g) {
  const a = LIGHT[g > 0.5 ? 1 : 0], b = LIGHT[g > 0.5 ? 2 : 1], u = (g - a[0]) / (b[0] - a[0]);
  const m = (k) => (a[k].length ? a[k].map((v, c) => mix(v, b[k][c], u)) : mix(a[k], b[k], u));
  return { top: m(1), low: m(2), amb: m(3), lit: m(4), dark: m(5), rock: m(6), water: m(7), sun: 1 - sm(0, 0.4, g), ag: sm(0.15, 0.45, g) * (1 - sm(0.55, 0.85, g)), moon: sm(0.6, 0.95, g), stars: sm(0.4, 0.85, g), aur: sm(0.6, 0.95, g) };
}

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const S = (params.s = {
    f: F32(N * 3), bg: F32(N * 3), rock: F32(N * 3), kind: new Uint8Array(N), sky: new Uint8Array(N), fu: F32(N), D: F32(N), CB: F32(N),
    t: 0, ph: 0, pt: HEAT - 1.25, wl: BRIM, wl0: LOW, T: 0.9, T0: 0.25, hv: 0, dh: 0, bw: 6, key: -1, ca: 99, ja: 99,
    bub: [], par: [], spr: [], puffs: [], pop: 0, nb: 0, np: 0, ns: 0, nv: 0, ox: 0, oy: 0, big: -1,
  });
  const { kind, fu, rock } = S;
  // Kinds: 0 the view, 1 the bowl, 2 rock, 3 conduit, 4 crack, 5 chamber.
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5;
    let k = Y >= SURF[x] ? 2 : abs(X - C) < 12 && Y >= BRIM ? 1 : 0;
    if (k === 2 && ((X - KX) / KRX) ** 2 + ((Y - KY) / KRY) ** 2 < 1 + 0.5 * (vn(X * 0.35, Y * 0.35) - 0.5)) k = 5;
    else if (k === 2 && y < KY && abs(X - CXA[y]) < CHW[y]) k = 3;
    kind[i] = k;
    if (!k && Y < min(HILL[x], CAP[x])) S.sky[i] = 1;
  }
  for (const p of FIS)
    for (let j = 1, len = 0; j < p.length; j++) {
      const [x0, y0] = p[j - 1], [x1, y1] = p[j], n = hypot(x1 - x0, y1 - y0) * 3;
      for (let u = 0; u <= n; u++) {
        const i = floor(mix(y0, y1, u / n)) * W + floor(mix(x0, x1, u / n));
        if (kind[i] === 2) (kind[i] = 4), (fu[i] = len + u / 3);
      }
      len += n / 3;
    }
  // The cut rock: beds bend with the ground, a silica lining and sulphur and
  // rust stains round every water way, columnar basalt below, bacterial mats
  // on the mound and snow on the flat.
  const cav = [];
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5, dx = abs(X - C), s = SURF[x];
    if (kind[i] >= 3) cav.push(i);
    if (kind[i] !== 2) continue;
    let d = Y - s + 2.4 * (vn(x * 0.08, y * 0.06 + 9) - 0.5) + 0.05 * (X - C), j = 0, dist = 9, gr = 0.9 + 0.18 * hash(x, y + 77);
    while (d > LAY[j][3] && j < LAY.length - 1) (d -= LAY[j][3]), j++;
    let c = LAY[j];
    if (j === LAY.length - 1) {
      const jx = (X + 3 * vn(1.7, Y * 0.12)) / 6;
      gr *= (jx - floor(jx) < 0.17 ? 0.6 : 1) * (0.85 + 0.3 * hash(floor(jx), 5));
    }
    for (let v = -5; v <= 5; v++)
      for (let u = -5; u <= 5; u++) {
        const xx = x + u, yy = y + v, k = xx >= 0 && xx < W && yy < H ? kind[yy * W + xx] : 2;
        if (k !== 2 && k) dist = min(dist, hypot(u, v) * (k === 4 ? 2.5 : 1));
      }
    if (dist < 1.5) c = LINE;
    else if (dist < 5) c = c.map((v, n) => mix(v, (dist < 3 ? SULF : RUST)[n], (5 - dist) * 0.17));
    if (dx > 13 && dx < 26 && Y - s < 1.4) c = MAT[floor(cl(vn(X * 0.45, 2) * 2.2 - 0.3, 0, 2.99))];
    if (dx >= 26 && Y - s < 1.5) c = SNOW;
    for (let n = 0; n < 3; n++) rock[i * 3 + n] = c[n] * gr;
  }
  S.cav = Int32Array.from(cav);
  // Visitors behind the rope on both sides, in their parkas.
  S.ppl = [];
  for (const [x0, x1] of [[2, 18], [46, 62]])
    for (let x = x0 + rnd() * 2; x < x1; x += 2.2 + rnd() * 2.4)
      S.ppl.push({ x: floor(x), h: rnd() < 0.3 ? 5 : 4, c: JACK[floor(rnd() * 7)], hat: rnd() < 0.5, dl: rnd() * 0.9, up: rnd() < 0.7 });
}

// The breeze in columns per second at row y, stronger aloft.
const wind = (S, y) => (6 + 16 * S.w) * (0.35 + 0.65 * sm(80, 8, y));
function puff(S, x, y, r, a, vy, life, gr, rmax) {
  if (S.puffs.length > 210) S.puffs.shift();
  S.puffs.push({ x, y, r, a, vy, rise: -(1 + 2.5 * rnd()), life, gr, rmax, age: 0, ph: rnd() * 7 });
}
const spray = (S, x, y, vx, vy) => S.spr.length < 700 && S.spr.push({ x, y, vx, vy, life: 2.5 });

function enter(S, ph) {
  Object.assign(S, { ph, pt: 0, wl0: S.wl, T0: S.T });
  if (ph === 2) S.ca = 0;
  if (ph === 3) {
    // The dome tears open in a ring of spray.
    S.ja = 0;
    for (let n = 0; n < 40; n++) spray(S, C + (rnd() - 0.5) * S.bw * 1.6, BRIM - S.dh * rnd(), (rnd() - 0.5) * 70, -(40 + 90 * rnd()));
    for (let n = 0; n < 6; n++) puff(S, C + (rnd() - 0.5) * 12, BRIM - 3 - 4 * rnd(), 3 + rnd() * 2, 0.6, -(10 + 10 * rnd()), 8 + 3 * rnd(), 1.5, 12 + 6 * S.P);
  }
}

function step(S, d, hold) {
  const P = S.P, Dj = 1.1 + 1.1 * P, Rl = RISE - 0.35 * P, Dl = DOME - 0.2 * P, t = (S.t += d);
  if (!hold) (S.pt += d), (S.ca += d), (S.ja += d);
  if (S.pt >= [HEAT, Rl, Dl, Dj, FALL][S.ph]) enter(S, (S.ph + 1) % 5);
  const { ph, pt } = S;
  // The water level and how hot the water is.
  if (ph === 0) (S.wl = mix(S.wl0, BRIM, sm(0, 6, pt))), (S.T = mix(S.T0, 1, sm(0, HEAT, pt)));
  else if (ph === 1) (S.wl = mix(S.wl0, BRIM, sm(0, 0.5, pt))), (S.T = mix(S.T0, 1, sm(0, 0.4, pt)));
  else if (ph === 2) S.wl = BRIM;
  else if (ph === 3) (S.wl = BRIM), (S.T = 1 - 0.65 * sm(0, Dj, pt));
  else (S.wl = mix(S.wl0, LOW, sm(0.2, 2.6, pt)) + 1.6 * exp(-pt * 1.1) * sin(pt * 10) * sm(0.3, 0.8, pt)), (S.T = mix(S.T0, 0.25, sm(0, FALL, pt)));
  // The pool heaves before it goes, the big bubble climbs, the dome swells.
  S.hv = ph === 0 ? (1.1 + P) * sm(4.5, 7.5, pt) * sin(t * 4.2) ** 2 : ph === 1 ? 1 + (2.2 + P) * sm(0, Rl, pt) : 0;
  S.big = ph === 1 ? mix(KY - KRY + 1, BOWL - 2, sm(0, Rl, pt) ** 1.4) : -1;
  S.bw = 7.5 + 4 * P;
  S.dh = ph === 2 ? (9 + 7 * P) * sm(0, Dl, pt) ** 0.8 + 0.5 * sin(pt * 30) : 0;

  // Steam bubbles grow as they climb from the chamber's floor. They collapse
  // in cooler water; once it is hot through they reach the pool and pop.
  for (S.nb += d * (1.5 + 18 * S.T * S.T) * (ph === 3 ? 3 : ph === 4 ? 0.3 : 1) * (1 + 0.8 * P); S.nb >= 1; S.nb--)
    if (S.bub.length < 160) S.bub.push({ x: KX + (rnd() - 0.5) * KRX * 1.3, y: KY + KRY * (0.25 + 0.5 * rnd()), r: 0.4, v: 3 + 4 * rnd() });
  const cr = ph > 0 && ph < 4 ? -9 : mix(106, BOWL - 4, sm(0.35, 0.92, S.T));
  for (const b of S.bub) {
    const yi = cl(floor(b.y), 0, H - 1), inC = b.y < KY - KRY + 1.5;
    if (inC) (b.x += (CXA[yi] + 0.5 - b.x) * min(1, d * 8)), (b.v = min(32, b.v + 26 * d));
    else (b.x += (KX - b.x) * d * 0.4 * sm(KY, KY - KRY, b.y) + sin(t * 3 + b.y) * d), (b.v = min(14, b.v + 8 * d));
    b.y -= b.v * d * (ph === 3 ? 1.8 : 1);
    b.r = min(inC ? (b.y < BOWL ? 1.2 : CHW[yi] - 0.3) : 2.3, b.r + d * (0.3 + 0.7 * S.T));
    if (b.y < cr || (S.big > 0 && b.y > S.big && b.y < S.big + 10)) b.dead = 1;
    else if (b.y <= S.wl + 0.5) {
      b.dead = 1;
      if (S.wl < BOWL) {
        S.pop = min(1.5, S.pop + 0.15 * b.r);
        if (rnd() < 0.5) puff(S, b.x + (rnd() - 0.5) * 8, S.wl - 2, 1.8, 0.3, -6, 3 + 2 * rnd(), 1, 5);
      }
    }
  }
  S.bub = S.bub.filter((b) => !b.dead);
  S.pop *= exp(-3 * d);

  // The jet: slabs of water fly up and spread; past the top they break up.
  if (ph === 3) {
    const u = pt / Dj, v = sqrt(2 * G * (64 + 46 * P)) * (1 - 0.25 * sm(0.7, 1, u)) * (1 - 0.6 * sm(0.45, 0.8, P) * exp(-(((u - 0.48) / 0.09) ** 2)));
    for (S.np += d * v * 0.6; S.np >= 1; S.np--) S.par.push({ x: C + (rnd() - 0.5) * 1.2, y: BRIM - 1 - v * d * rnd(), vy: -v * (0.95 + 0.1 * rnd()), w: (3.5 + 3.5 * P) * (0.85 + 0.3 * rnd()), a: 1, ap: 0 });
  }
  for (const q of S.par) {
    q.vy += G * d;
    q.y += q.vy * d;
    q.x += wind(S, q.y) * 0.35 * d;
    q.w += d * (4.5 + 4.5 * P) * (q.ap ? 2 : 1);
    if (!q.ap && q.vy > -25) {
      q.ap = 1;
      for (let n = 0; n < 2; n++) spray(S, q.x + (rnd() - 0.5) * q.w * 2, q.y, (rnd() - 0.5) * 64, q.vy + (rnd() - 0.6) * 30);
    }
    if (rnd() < d * 3) {
      const sd = rnd() < 0.5 ? -1 : 1;
      spray(S, q.x + sd * q.w, q.y, sd * (8 + 26 * rnd()), q.vy * 0.75);
    }
    if (q.ap) q.a -= d * 1.6;
    if (q.y > BRIM || q.a <= 0) q.dead = 1;
  }
  S.par = S.par.filter((q) => !q.dead);
  // Steam boils off the column while it stands and a little after.
  if (S.ja < Dj + 0.8 && S.par.length)
    for (S.ns += d * (40 + 40 * P); S.ns >= 1; S.ns--) {
      const q = S.par[floor(rnd() * S.par.length)];
      puff(S, q.x + (rnd() - 0.5) * q.w * 1.8, q.y, 2.5 + q.w * 0.6, 0.55 + 0.25 * rnd(), max(-30, q.vy * 0.3), 10 + 4 * rnd() + 3 * P, 2 + 1.5 * rnd(), 17 + 7 * P);
    }
  for (const s of S.spr) {
    s.vy = min(90, s.vy + G * 0.85 * d);
    s.vx *= 1 - 0.5 * d;
    s.x += (s.vx + wind(S, s.y) * 0.5) * d;
    s.y += s.vy * d;
    s.life -= d;
    const x = floor(s.x), y = floor(s.y);
    if (s.life < 0 || x < 0 || x >= W || y >= H || (y >= 0 && S.kind[y * W + x] && s.vy > 0)) s.dead = 1;
  }
  S.spr = S.spr.filter((s) => !s.dead);

  // Gentle steam off the pool, and from small vents out on the field.
  const wet = S.wl < BOWL - 1;
  for (S.nv += d * (2 + (wet ? 4 + 5 * S.T : 1) * (1 + P)); S.nv >= 1; S.nv--)
    if (rnd() < 0.7) puff(S, C + (rnd() - 0.5) * (wet ? 20 : 6), (wet ? S.wl : BOWL) - 1, 1.6 + rnd(), 0.22 + 0.2 * rnd(), -(5 + 3 * rnd()), 4 + 2 * rnd(), 1, 6);
    else {
      const v = [[7, 67], [52, 64], [21, 63], [60, 70]][floor(rnd() * 4)];
      puff(S, v[0] + rnd() - 0.5, v[1], 1.1, 0.3, -(4 + 2 * rnd()), 3.5 + 2 * rnd(), 0.8, 4);
    }
  for (const q of S.puffs) {
    q.age += d;
    q.vy += (q.rise - q.vy) * 1.2 * d;
    q.y += q.vy * d;
    q.x += (wind(S, q.y) + 1.2 * sin(q.age * 1.1 + q.ph)) * d;
    q.r = min(q.rmax, q.r + q.gr * d);
  }
  S.puffs = S.puffs.filter((q) => q.age < q.life && q.y + q.r > -6 && q.x > -26 && q.x < W + 26);
  S.ox += wind(S, 25) * 0.2 * d;
  S.oy -= 0.6 * d;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  [S.g, S.P, S.w] = [cl(k[0], 0, 1), cl(k[2], 0, 1), cl(k[3], -1, 1)];
  if (!S.init) {
    // Open on a steaming field with the last cloud still high up; the pool holds its phase.
    for (let n = 0; n < 18; n++) puff(S, -10 + n * 4 + rnd() * 4, 8 + 24 * rnd(), 6 + 4 * rnd(), 0.4 + 0.15 * rnd(), -2, 15 + 4 * rnd(), 0.8, 16), (S.puffs[n].age = 2 + 4 * rnd());
    for (let n = 0; n < 150; n++) step(S, 1 / 30, 1);
    S.bub.length = S.pop = S.t = 0;
    S.init = 1;
  }
  if (input.btnPressed && input.btnPressed[0] && (S.ph === 0 || S.ph === 4)) enter(S, 1);
  step(S, (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2);
}

// The view and the cut rock, kept until the light changes.
function backdrop(S) {
  const L = (S.L = lightAt(S.g)), BG = S.bg, R = S.rock, { amb, top, low } = L;
  S.key = round(S.g * 60);
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, X = x + 0.5, Y = y + 0.5, o = i * 3, k = S.kind[i];
    let c;
    if (k >= 2) c = k === 2 ? [R[o], R[o + 1], R[o + 2]] : [26, 28, 36];
    else if (k === 1) {
      // The far wall of the bowl, wet sinter.
      const v = (0.75 + 0.3 * hash(x, y)) * (0.8 + 0.25 * vn(X * 0.5, Y * 0.9));
      c = [62 * v, 86 * v, 90 * v];
    }
    if (c) c = sc(c, L.rock);
    else if (S.sky[i]) {
      const sd = hypot(X - 9, Y - 53), md = hypot(X - 13, Y - 15), v = (Y / HZ) ** 1.3;
      const sg = L.sun * (0.6 * exp(-sd / 9) + (sd < 1.7 ? 1.1 : 0)), ag = L.ag * exp(-(((Y - 58) / 9) ** 2)) * (1 - X / 80);
      const mg = L.moon * ((md < 2.4 ? 0.9 : 0) + 0.12 * exp(-md / 5)), st = hash(x, y) < 0.013 && Y < 52 ? L.stars * (90 + 140 * hash(y, x)) : 0;
      c = top.map((a, n) => mix(a, low[n], v) + sg * [255, 206, 130][n] + ag * [110, 92, 168][n] + mg * [228, 230, 238][n] + st * [0.85, 0.9, 1][n]);
    } else if (Y < HZ) {
      // The ice cap; snow and scree on the hill.
      const sn = vn(x * 0.16, y * 0.3) + 0.35 * vn(x * 0.5, y * 0.8) - 0.01 * (Y - HILL[x]) > 0.55;
      c = Y < HILL[x] ? [222, 232, 246].map((a, n) => a * amb[n] * 0.92 + low[n] * 0.1) : sc(sn ? sc(SNOW, 0.74 + 0.004 * x) : [64, 60, 62], amb);
    } else if (Y < HZ + 1.5) c = sc([92, 100, 118], amb);
    else {
      // The flat field: snow, and bare warm ground near the springs.
      const f = (Y - HZ) / (GY - HZ), b = 0.7 * sm(0.6, 0.66, vn((X * 0.1) / (0.35 + f), y * 0.6)) * sm(27, 10, abs(X - C));
      c = SNOW.map((a, n) => mix(a * (0.8 + 0.2 * f), [112, 92, 70][n], b) * amb[n]);
    }
    for (let n = 0; n < 3; n++) BG[o + n] = c[n];
  }
}

// Add an elliptical blob to a density field.
function splat(A, cx, cy, rx, ry, a) {
  const y1 = min(H - 1, cy + ry), x0 = max(0, floor(cx - rx)), x1 = min(W - 1, cx + rx);
  for (let y = max(0, floor(cy - ry)); y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry, dd = 1 - dy * dy;
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, e = dd - dx * dx;
      if (e > 0) A[y * W + x] += a * e;
    }
  }
}

let F;
function put(x, y, c, a = 1) {
  (x = floor(x)), (y = floor(y));
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let n = 0; n < 3; n++) F[o + n] = mix(F[o + n], c[n], a);
}

// Shade a density field over the frame, lit on the side facing the light.
function shade(S, A, k0, lit, dark, tint, jet) {
  for (let i = 0; i < N; i++) {
    const v = A[i];
    if (v < 0.015) continue;
    const x = i & 63, y = i >> 6, o = i * 3;
    const tex = jet ? vn(x * 0.5, (y + S.t * 10) * 0.25) : vn(x * 0.18 - S.ox, y * 0.18 - S.oy);
    const al = min(0.95, 1 - exp(-v * (k0 + 1.6 * tex))), gx = v - A[x > 1 && y > 1 ? i - (jet ? 2 : 2 * W + 2) : i];
    const sh = cl(0.52 + (jet ? 0.9 : 0.5) * gx + 0.45 * (tex - 0.5), 0.12, 1.02), tt = jet ? sm(BRIM - 16, BRIM, y) * 0.6 : 0;
    for (let n = 0; n < 3; n++) F[o + n] = mix(F[o + n], mix(mix(dark[n], lit[n], sh), jet ? tint[n] : 0, tt), al);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  if (S.key !== round(S.g * 60)) backdrop(S);
  F = S.f;
  F.set(S.bg);
  const L = S.L, { t, kind, D, CB, ph, wl, T, P } = S, amb = L.amb, Lw = L.water, Lr = L.rock;

  // Aurora: a green hem, rays rising into violet.
  if (L.aur > 0.01)
    for (let k = 0; k < 2; k++)
      for (let x = 0; x < W; x++) {
        const yb = 30 + 8 * k + 5 * sin(x * 0.08 + t * 0.22 + k * 2.1) + 8 * (vn(x * 0.07 + t * 0.12, k * 7) - 0.5);
        const I = L.aur * sm(0.3, 0.75, vn(x * 0.09 - t * 0.1 + k * 3, t * 0.04 + k)) * (0.5 + 0.5 * vn(x * 0.7 + t * 0.5, k * 11 + t * 0.3));
        if (I < 0.02) continue;
        for (let y = max(0, floor(yb - 26)); y <= yb; y++) {
          const i = y * W + x, u = (yb - y) / 26, e = I * (u < 0.08 ? u / 0.08 : exp(-u * 2.2)) * 0.9, v = sm(0.35, 1, u);
          if (S.sky[i]) (F[i * 3] += mix(40, 96, v) * e), (F[i * 3 + 1] += mix(214, 60, v) * e), (F[i * 3 + 2] += mix(120, 176, v) * e);
        }
      }

  // The visitors behind the rope; once the dome rises most hold up a phone.
  for (const p of S.ppl) {
    const hy = GY - p.h, jc = sc(p.c, amb);
    put(p.x, GY - 1, sc([30, 30, 36], amb));
    for (let y = hy + 1; y < GY - 1; y++) put(p.x, y, jc);
    put(p.x, hy, p.hat ? jc : sc([226, 186, 160], amb));
    if (p.up && S.ca > p.dl && S.ca < 6 + p.dl) put(p.x + 1, hy, jc), put(p.x + 1, hy - 1, L.stars > 0.3 ? [180, 210, 255] : [40, 40, 50]);
  }
  for (const x of [1, 8, 15, 49, 56, 63]) for (let y = GY - 3; y < GY; y++) put(x, y, sc([70, 56, 40], amb));
  for (let x = 1; x < 64; x++) if (x < 16 || x > 48) put(x, GY - 3 + (sin(((x - 1) / 7) * Math.PI) > 0.2 ? 1 : 0), sc([214, 184, 64], amb), 0.8);

  // All the steam, summed and shaded.
  D.fill(0);
  for (const q of S.puffs) {
    const a = q.a * sm(0, 0.4, q.age) * (1 - sm(q.life * 0.45, q.life, q.age));
    if (a > 0.01) splat(D, q.x, q.y, q.r, q.r, a);
  }
  shade(S, D, 1.1, L.lit, L.dark);

  // The pool in section, its heave, ripples and dome.
  const foam = ph === 3 ? 1 : ph === 4 ? 1 - sm(0, 1.2, S.pt) : 0;
  for (let x = 20; x < 44; x++) {
    const dx = x + 0.5 - C;
    let top = wl - S.hv * max(0, 1 - (dx / 10) ** 2) + S.pop * sin(x * 1.3 - t * 14) * 0.6 + foam * 1.5 * (hash(x, floor(t * 20)) - 0.5);
    const dome = S.dh > 0 && abs(dx) < S.bw ? S.dh * (1 - (dx / S.bw) ** 2) ** 0.75 : 0;
    if (dome) top = min(top, BRIM - dome);
    for (let y = max(0, floor(top)); y < SURF[x]; y++) {
      const z = y + 0.5 - top;
      if (z < 0 || (kind[y * W + x] !== 1 && y >= BRIM)) continue;
      let c;
      if (dome && y < BRIM) {
        const nx = dx / S.bw, ny = (BRIM - y) / (S.dh + 0.1), sp = exp(-((nx + 0.42) ** 2) / 0.03 - (ny - 0.6) ** 2 / 0.08);
        c = [40, 150, 176].map((v, n) => (mix(v, [110, 226, 230][n], ny * 0.8 + 0.3 * abs(nx)) * (0.85 + 0.25 * vn(x * 0.5, y * 0.5 - t * 6)) + 150 * sp + (z < 1 ? 70 : 0)) * Lw);
      } else if (z < 1) c = sc([150, 224, 226], Lw);
      else c = [60, 190, 200].map((v, n) => mix(v, [18, 70, 140][n], sm(0, 10, z)) * Lw * (0.88 + 0.24 * vn(x * 0.45 + t * 0.6, y * 0.7 - t * 0.4)));
      if (foam && z < 3 && hash(x, y + floor(t * 25)) < 0.6 * foam) c = sc(FOAM, Lw);
      put(x, y, c);
    }
  }

  // The column and its spray.
  CB.fill(0);
  for (const q of S.par) splat(CB, q.x, q.y, q.w, 2.8, q.a);
  if (S.par.length) shade(S, CB, 1.8, L.lit.map((v) => min(240, v * 1.04)), L.dark, [70 * Lw, 200 * Lw, 212 * Lw], 1);
  for (const s of S.spr) {
    const a = min(1, s.life * 1.5) * 0.85;
    put(s.x - s.vx * 0.02, s.y - s.vy * 0.02, L.lit, a * 0.35);
    put(s.x, s.y, L.lit, a);
  }

  // Under the ground: the conduit, the chamber and the cracks feeding it.
  const froth = ph === 3 ? 1 - 0.5 * sm(0.6, 1, S.pt / (1.1 + 1.1 * P)) : ph === 2 ? 0.3 : ph === 1 ? 0.12 : 0;
  const inflow = ph === 0 ? 1 - sm(4, 6.5, S.pt) * 0.8 : ph === 4 ? sm(1, 3, S.pt) : 0.2;
  for (const i of S.cav) {
    const x = i & 63, y = i >> 6, o = i * 3, k = kind[i];
    let r, g, b;
    if (k === 4) {
      const p = inflow * sm(0.55, 1, sin(S.fu[i] * 0.7 - t * 7));
      (r = 20 + 80 * p), (g = 46 + 130 * p), (b = 104 + 110 * p);
    } else if (k === 3 && y + 0.5 < wl) {
      // Drained: wet walls with a film running down.
      const f = ph === 4 && hash(x, floor(y - t * 26)) < 0.12;
      (r = f ? 70 : 30), (g = f ? 104 : 33), (b = f ? 124 : 42);
    } else if (froth && hash(x, floor(y + t * 80)) < froth * (k === 5 ? 0.4 : 0.55)) [r, g, b] = FOAM;
    else {
      // Cool water blue, hot water turquoise.
      const Tl = cl(T * (0.7 + 0.3 * sm(BOWL, KY + KRY, y)) + (k === 5 ? 0.08 : 0), 0, 1), sh = (0.86 + 0.28 * vn(x * 0.6, y * 0.3 + t * 2)) * (k === 3 && y === floor(wl) ? 1.3 : 1);
      (r = mix(COOL[0], HOT[0], Tl) * sh), (g = mix(COOL[1], HOT[1], Tl) * sh), (b = mix(COOL[2], HOT[2], Tl) * sh);
    }
    (F[o] = r * Lr), (F[o + 1] = g * Lr), (F[o + 2] = b * Lr);
  }
  for (const { x, y, r } of S.bub)
    if (r < 0.9) put(x, y, FOAM, 0.85);
    else
      for (let v = floor(y - r); v <= y + r; v++)
        for (let u = floor(x - r); u <= x + r; u++) {
          const e = hypot(u + 0.5 - x, v + 0.5 - y) / r;
          if (e < 1) put(u, v, e > 0.6 ? [150, 220, 230] : FOAM, 0.9);
        }
  if (S.big > 0)
    for (let y = floor(S.big); y < S.big + 10; y++) {
      const cx = CXA[y] + 0.5, hw = CHW[y] * min(1, 0.5 + 0.5 * (y + 1 - S.big)) - 0.3;
      for (let x = floor(cx - hw); x < cx + hw; x++) put(x, y, abs(x + 0.5 - cx) > hw - 1 ? [160, 236, 240] : [236, 246, 248], 0.97);
    }

  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
