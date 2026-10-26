// ===== Patternflow pattern =====
// Title:   House of Usher
// Family:  halloween
// Idea:    A grey mansion stands over a black tarn under racing storm cloud, a zigzag fissure from its roof to the water glowing slowly red until it opens on a blood-red full moon, the two halves rush apart and sink into the tarn in a burst of spray and rings, the moon shines over the closing water, and a leaden mist rises out of which the house stands again.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 53, after Edgar Allan Poe's The Fall of the House of Usher (1839)
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Storm=-1..1, Mist=0..1
//
// Knob 1: Hue. The storm sky and its reflection, kept on the cool side so the dim cloud never reads brown: violet at 0, indigo at 0.25, blue at 0.4, teal at 0.7, a sickly green at 1. The moon stays blood red and the one lit window stays green.
// Knob 2: Speed. At 2 one round of the story takes 17 seconds: the fissure glows for 6 and opens in 1.6, the halves sink for 3.2, the moon shines over the rings until the mist rises at 11.4, and the house is back by 15.2 and clear of the mist by 16.6. The first round opens 1.5 seconds in, so the first fall comes at 6.1. At 0.2 ten times slower, at 3 half as fast again; clouds, lightning and rain keep the same clock.
// Knob 3: Storm. At -1 still air: no rain, no lightning, slow cloud and a glassy tarn. At 0, where it opens, 92 drops of rain and a strike about every 5 seconds, the first at 2.4; at 1, 260 drops, a strike every 1.5 seconds and the tarn chopped by the wind into broken bars of reflection.
// Knob 4: Mist. The leaden vapour that hangs over the tarn and the foot of the house: a thin line at 0.06 where it opens, a bank that hides the lower windows at 0.5, and at 1 a fog over everything below the roofs. The mist that ends each fall rises on top of this.
// Buttons: K1 tap while the house stands opens the fissure now.

const W = 64, H = 128, N = W * H, WL = 76, NU = W * WL;
const { floor, min, max, sqrt, abs, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// The story, in seconds at Speed 2.
const T_WIDEN = 6, T_FALL = 7.6, T_GONE = 10.8, T_MIST = 11.4, T_BACK = 13.4, T_END = 17, T_START = 1.5;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// A fixed generator for the house, so its stones never change.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise on a 16 x 16 lattice that wraps.
const LAT = new Float32Array(256);
{
  const r = prng(11);
  for (let i = 0; i < 256; i++) LAT[i] = r();
}
function noise(x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = LAT[(yi & 15) * 16 + (xi & 15)], b = LAT[(yi & 15) * 16 + ((xi + 1) & 15)];
  const c = LAT[((yi + 1) & 15) * 16 + (xi & 15)], d = LAT[((yi + 1) & 15) * 16 + ((xi + 1) & 15)];
  return mix(mix(a, b, u), mix(c, d, u), v);
}

// The fissure: a zigzag from the gable's peak down through the door to the water.
const FIS = [[32.5, 16], [30, 23], [35, 30], [29.5, 37], [34.5, 45], [29.5, 52], [34, 58], [31, 64], [33, 70], [32, 76]];
function fisAt(y) {
  if (y <= FIS[0][1]) return FIS[0][0];
  for (let i = 1; i < FIS.length; i++) if (y <= FIS[i][1]) return mix(FIS[i - 1][0], FIS[i][0], (y - FIS[i - 1][1]) / (FIS[i][1] - FIS[i - 1][1]));
  return FIS[FIS.length - 1][0];
}
// The same, looked up in quarter rows.
const FT = new Float32Array(WL * 4 + 1);
for (let i = 0; i <= WL * 4; i++) FT[i] = fisAt(i / 4);
const fisX = (y) => FT[cl(round(y * 4), 0, WL * 4)];

// Materials: 1 wall, 2 roof, 3 vacant window, 4 the lit window, 5 door.
function buildHouse(mat, shade, crack) {
  const r = prng(5);
  const win = (x, y, x0, y0, h) => x >= x0 && x < x0 + 3 && y >= y0 && y < y0 + h && (y > y0 || x === x0 + 1);
  for (let y = 0; y < WL; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let m = 0;
      if (x >= 4 && x <= 59 && y >= 46) m = 1;
      if (x >= 21 && x <= 43 && y >= 37) m = 1;
      // Hipped roofs on the wings and a steep gable over the middle.
      if (y >= 35 && y < 46 && x >= 4 + (46 - y) * 0.9 && x <= 21) m = 2;
      if (y >= 35 && y < 46 && x <= 59 - (46 - y) * 0.9 && x >= 43) m = 2;
      if (y >= 16 && y < 37 && abs(x - 32) <= (y - 16) * 0.62) m = 2;
      // Chimneys with caps.
      if ((x >= 9 && x <= 12) || (x >= 51 && x <= 54)) if (y >= 28 && y < 40) m = 1;
      if ((x >= 8 && x <= 13) || (x >= 50 && x <= 55)) if (y >= 27 && y < 29) m = 2;
      if (m === 1) {
        // Vacant windows, pointed at the top: three to a row on each wing.
        for (const x0 of [7, 12, 17, 45, 50, 55]) for (const y0 of [50, 61]) if (win(x, y, x0, y0, 6)) m = x0 === 50 && y0 === 50 ? 4 : 3;
        for (const x0 of [24, 38]) if (win(x, y, x0, 41, 9)) m = 3;
        // The door: a pointed arch.
        if (abs(x - 32) <= 3.5 && y >= 61 + abs(x - 32) * 0.9) m = 5;
      }
      if (m === 2 && (x - 32) ** 2 + (y - 29) ** 2 <= 6.5) m = 3;
      mat[p] = m;
      // Stone courses, blocks of different age, and dark streaks of fungus
      // hanging from the eaves.
      let s = 0.9 + 0.2 * r() + 0.25 * (noise(x * 0.18 + 3, y * 0.18) - 0.5);
      if (m === 1) {
        if (y % 4 === 0) s *= 0.8;
        else if ((x + ((y >> 2) & 1) * 3) % 6 === 0) s *= 0.87;
      }
      if (m === 2 && y & 1) s *= 0.85;
      shade[p] = s;
    }
  for (let k = 0; k < 26; k++) {
    const x = 5 + floor(r() * 54), y0 = x > 20 && x < 44 ? 37 : 46, len = 3 + floor(r() * 9);
    for (let y = y0; y < y0 + len && y < WL; y++) if (mat[y * W + x] === 1) shade[y * W + x] *= 0.62 + (0.3 * (y - y0)) / len;
  }
  // Distance from each LED to the fissure, for its faint line and its glow.
  crack.fill(9);
  for (let i = 1; i < FIS.length; i++) {
    const [ax, ay] = FIS[i - 1], [bx, by] = FIS[i];
    for (let s = 0; s <= 40; s++) {
      const fx = mix(ax, bx, s / 40), fy = mix(ay, by, s / 40);
      for (let y = max(0, floor(fy) - 4); y <= min(WL - 1, floor(fy) + 4); y++)
        for (let x = max(0, floor(fx) - 4); x <= min(W - 1, floor(fx) + 4); x++) {
          const d = sqrt((x + 0.5 - fx) ** 2 + (y + 0.5 - fy) ** 2), p = y * W + x;
          if (d < crack[p]) crack[p] = d;
        }
    }
  }
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const s = {
    hue: 0, sp: 2, storm: 0, mist: 0.06,
    t: 0, c: T_START, wind: 0, flashAt: -9, nextStrike: 2.4, bolt: [],
    mat: new Uint8Array(NU), shade: F(NU), crack: F(NU), fb: F(N * 3), hm: new Uint8Array(NU), cf: F(NU + 2 * W),
    drops: [], deb: [], spray: [], rings: [], fallAcc: 0, chop: 0.2, slant: 0.3,
    halves: [{ dx: 0, dy: 0, a: 0, px: 4.5 }, { dx: 0, dy: 0, a: 0, px: 59.5 }],
    sky0: F(3), sky1: F(3),
  };
  buildHouse(s.mat, s.shade, s.crack);
  for (let i = 0; i < 260; i++) s.drops.push(newDrop(Math.random() * H));
  params.s = s;
}

function newDrop(y) {
  return { x: Math.random() * (W + 30) - 8, y, v: 0.8 + 0.4 * Math.random(), land: WL + 1 + Math.random() * (H - WL - 2), dim: 0 };
}

// Lightning: a jagged channel from the top down behind the house.
function makeBolt(s) {
  const pts = [[8 + Math.random() * 48, -1]];
  while (pts[pts.length - 1][1] < 44) {
    const [x, y] = pts[pts.length - 1];
    pts.push([cl(x + (Math.random() - 0.5) * 9, 2, 61), y + 3 + Math.random() * 5]);
  }
  s.bolt = pts;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  s.sp = cl(k[1], 0.2, 3);
  s.storm = (cl(k[2], -1, 1) + 1) / 2;
  s.mist = cl(k[3], 0, 1);
  const ds = (d * s.sp) / 2, c0 = s.c;
  s.t += ds;
  s.c += ds;
  if (input.btnPressed && input.btnPressed[0] && s.c < T_WIDEN) s.c = T_WIDEN;
  if (s.c >= T_END) s.c -= T_END;
  const c = s.c, st = s.storm;
  // The whirlwind that comes as the fissure opens.
  const whirl = sm(5.6, 6.6, c) * (1 - sm(9.5, 11.5, c));
  s.wind += ds * (0.35 + 1.4 * st) * (1 + 1.6 * whirl);
  s.chop = 0.15 + 1.1 * st * st + 2.6 * sm(7.8, 8.6, c) * (1 - sm(10.6, 14, c));

  if (s.t >= s.nextStrike) {
    if (st > 0.04) {
      s.flashAt = s.t;
      makeBolt(s);
    }
    s.nextStrike = s.t + mix(8, 1.5, st) * (0.6 + 0.8 * Math.random());
  }

  // Rain falls past the house and lands on the tarn somewhere between the
  // far shore and our feet, leaving a dimple.
  const nd = round(260 * st ** 1.5), vy = 120 * (s.sp / 2) + 25, slant = 0.25 + 0.2 * st;
  for (let i = 0; i < nd; i++) {
    const r = s.drops[i];
    if (r.dim > 0) {
      r.dim -= d;
      if (r.dim <= 0) Object.assign(r, newDrop(-Math.random() * 30));
      continue;
    }
    r.y += r.v * vy * d;
    r.x -= r.v * vy * slant * d;
    if (r.y >= r.land) (r.y = r.land), (r.dim = 0.13);
  }
  s.slant = slant;

  // The two halves. Each turns about its outer foot, slides outward and
  // sinks; the right one starts a quarter second later.
  for (let h = 0; h < 2; h++) {
    const f = s.halves[h], tf = c < T_GONE ? max(0, c - T_FALL - 0.25 * h) : 0, sg = h ? 1 : -1;
    const shake = c > T_WIDEN && c < T_FALL + 0.6 ? 0.6 * sin(s.t * 55 + h * 2) * sm(T_WIDEN, T_FALL, c) : 0;
    f.dx = sg * 8 * sm(0, 1.7, tf) + shake;
    f.dy = 13 * tf * tf;
    f.a = sg * 0.3 * sm(0.15, 2.3, tf);
    f.px = h ? 59.5 : 4.5;
  }
  // Stones from the fissure, then spray where anything meets the water.
  if (c > T_FALL && c < T_GONE - 0.6) {
    s.fallAcc += ds * 34;
    while (s.fallAcc >= 1 && s.deb.length < 90) {
      s.fallAcc -= 1;
      const h = Math.random() < 0.5 ? 0 : 1, f = s.halves[h], y = 18 + Math.random() * 56, x = fisX(y) + (h ? 2 : -2);
      const [px, py] = place(f, x, y);
      if (py < WL - 1) s.deb.push({ x: px, y: py, vx: (h ? 1 : -1) * (4 + 14 * Math.random()), vy: -6 * Math.random() });
    }
    for (let h = 0; h < 2; h++) {
      const f = s.halves[h], foot = place(f, h ? 40 : 24, 75);
      if (Math.random() < ds * 10) splash(s, foot[0] + (Math.random() - 0.5) * 24, 2 + Math.random() * 3);
    }
  }
  for (const b of s.deb) {
    b.vy += 70 * ds;
    b.x += b.vx * ds;
    b.y += b.vy * ds;
    if (b.y >= WL - 0.5) (b.dead = 1), splash(s, b.x, 1 + Math.random());
  }
  s.deb = s.deb.filter((b) => !b.dead && b.x > -3 && b.x < W + 3);
  for (const p of s.spray) {
    p.vy += 75 * ds;
    p.x += p.vx * ds;
    p.y += p.vy * ds;
  }
  s.spray = s.spray.filter((p) => p.y < WL);
  for (const r of s.rings) r.r += ds * 13;
  s.rings = s.rings.filter((r) => r.r < 60);
  if (c < c0) (s.deb.length = 0), (s.spray.length = 0);
}

// Where house point (x, y) is now on the panel, for half f.
function place(f, x, y) {
  const ca = cos(f.a), sa = sin(f.a), X = x - f.px, Y = y - 75;
  return [f.px + ca * X - sa * Y + f.dx, 75 + sa * X + ca * Y + f.dy];
}

function splash(s, x, n) {
  for (let i = 0; i < n && s.spray.length < 90; i++) s.spray.push({ x, y: WL - 1, vx: (Math.random() - 0.5) * 16, vy: -(10 + 24 * Math.random()) });
  if (s.rings.length < 14) s.rings.push({ x, r: 0.5, a: 0.5 + 0.1 * n });
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const { fb, mat, shade, crack, sky0, sky1, hm, cf } = s;
  const c = s.c, t = s.t, st = s.storm, hue = 0.76 - 0.44 * s.hue;
  hsv(hue, 0.62, 0.34, sky0);
  hsv(hue + 0.03, 0.42, 0.66, sky1);
  // The flash: two pulses, the second a little later and weaker.
  const fa = t - s.flashAt, fl = fa < 0 || fa > 1 ? 0 : (exp(-fa * 10) + (fa > 0.14 ? 0.7 * exp(-(fa - 0.14) * 9) : 0)) * (0.5 + 0.5 * st);
  // The moon: behind the house until the fissure opens, then full over the
  // water until the mist takes it.
  const moon = (0.28 + 0.72 * sm(5.4, 7.2, c)) * (1 - 0.72 * sm(12, 14.2, c));
  const glow = c < T_WIDEN ? 0.3 * sm(0.4, T_WIDEN, c) : c < T_GONE ? 0.3 + 0.7 * sm(T_WIDEN, 7.2, c) : 0;
  const gap = c < T_GONE ? 3.4 * sm(T_WIDEN, T_FALL, c) + 2.5 * sm(T_FALL, 8.4, c) : 0;
  const alpha = c < T_GONE ? 1 : sm(T_BACK, T_BACK + 1.8, c);
  const MX = 32, MY = 51, MR = 14.5;
  const w0 = s.wind, h0 = s.halves[0], h1 = s.halves[1];
  const c0a = cos(h0.a), s0a = sin(h0.a), c1a = cos(h1.a), s1a = sin(h1.a);
  const lw = 0.72 + 0.28 * noise(t * 3.1, 5.5);
  // The cloud field, two rows deeper than the sky so each LED can see
  // whether cloud thins below it: there its underside catches the light.
  // It is stretched sideways, so every other LED is the mean of its neighbours.
  for (let y = 0; y < WL + 2; y++) {
    const q = y * W;
    for (let x = 0; x <= W; x += 2) cf[q + min(x, W - 1)] = noise(x * 0.045 + w0, y * 0.2 + 2) * 0.65 + noise(x * 0.1 + w0 * 1.7, y * 0.4) * 0.35;
    for (let x = 1; x < W - 1; x += 2) cf[q + x] = (cf[q + x - 1] + cf[q + x + 1]) / 2;
  }

  for (let y = 0; y < WL; y++) {
    const gy = y / WL;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      // Sky and racing cloud with faintly luminous undersides.
      const n1 = cf[y * W + x], n2 = cf[(y + 2) * W + x];
      const dn = sm(0.4, 0.68, n1) * (1 - 0.6 * gy), under = cl((n1 - n2) * 7, 0, 1) * dn;
      let r = mix(sky0[0], sky1[0], gy), g = mix(sky0[1], sky1[1], gy), b = mix(sky0[2], sky1[2], gy);
      r = r * (1 - 0.42 * dn) + under * 0.42;
      g = g * (1 - 0.42 * dn) + under * 0.36;
      b = b * (1 - 0.42 * dn) + under * 0.5;
      // The blood-red moon and its halo, dimmed where cloud crosses it.
      const md = sqrt((x + 0.5 - MX) ** 2 + (y + 0.5 - MY) ** 2), mv = moon * (1 - 0.6 * dn);
      if (md < MR) {
        const e = md / MR, k = mv * (1 - 0.25 * e * e);
        r = mix(r, 1, k);
        g = mix(g, 0.22 - 0.14 * e, k);
        b = mix(b, 0.12 - 0.06 * e, k);
      } else if (md < MR + 30) {
        const hk = mv * 0.55 * exp(-(md - MR) / 6);
        r += hk * 0.85;
        g += hk * 0.04;
        b += hk * 0.22;
      }
      r += fl * 0.55;
      g += fl * 0.5;
      b += fl * 0.65;
      // The house: either half, as it stands or as it falls.
      hm[y * W + x] = 0;
      if (alpha > 0) {
        let m = 0, p = 0;
        for (let h = 0; h < 2 && !m; h++) {
          const f = h ? h1 : h0, ca = h ? c1a : c0a, sa = h ? s1a : s0a;
          const X = x + 0.5 - f.px - f.dx, Y = y + 0.5 - 75 - f.dy;
          const hx = f.px + ca * X + sa * Y, hy = 75 - sa * X + ca * Y;
          const ix = floor(hx), iy = floor(hy);
          if (ix < 0 || ix >= W || iy < 0 || iy >= WL) continue;
          const q = iy * W + ix, fx = fisX(hy);
          if (mat[q] && (h ? hx >= fx + gap / 2 : hx < fx - gap / 2)) (m = mat[q]), (p = q);
        }
        if (m) {
          hm[y * W + x] = 1;
          const sh = shade[p];
          let hr, hg, hb;
          if (m === 1) (hr = 0.34 * sh), (hg = 0.32 * sh), (hb = 0.38 * sh);
          else if (m === 2) (hr = 0.15 * sh), (hg = 0.14 * sh), (hb = 0.19 * sh);
          else if (m === 4) (hr = 0.32 * lw), (hg = 1 * lw), (hb = 0.3 * lw);
          else (hr = 0.02), (hg = 0.015), (hb = 0.035);
          if (m <= 2) {
            hr += fl * 0.4;
            hg += fl * 0.38;
            hb += fl * 0.5;
            // The fissure: a darker line that glows red as the moon finds it,
            // and the red it throws on the stone beside it.
            const cd = crack[p];
            if (cd < 0.75 && gap < 0.5) (hr = mix(hr * 0.78, 0.85, glow)), (hg = mix(hg * 0.78, 0.06, glow)), (hb = mix(hb * 0.78, 0.12, glow));
            else if (cd < 4) {
              const sp = glow * glow * (1 - cd / 4) * 0.55;
              hr += sp;
              hg += sp * 0.12;
              hb += sp * 0.16;
            }
          }
          r = mix(r, hr, alpha);
          g = mix(g, hg, alpha);
          b = mix(b, hb, alpha);
        }
      }
      // White trunks of dead trees on the banks either side.
      if ((x === 1 && y > 47) || (x === 2 && y > 52) || (x === 61 && y > 55) || (x === 62 && y > 60) || (x === 3 && y === 53) || (x === 4 && y === 51) || (x === 60 && y === 58)) (r = 0.55 + fl * 0.3), (g = 0.53 + fl * 0.3), (b = 0.6 + fl * 0.3);
      fb[o] = r;
      fb[o + 1] = g;
      fb[o + 2] = b;
    }
  }
  // The bolt, behind the house only where the sky shows.
  if (fa >= 0 && fa < 0.2 && s.bolt.length)
    for (let i = 1; i < s.bolt.length; i++) {
      const [ax, ay] = s.bolt[i - 1], [bx, by] = s.bolt[i];
      for (let k = 0; k <= 8; k++) {
        const x = floor(mix(ax, bx, k / 8)), y = floor(mix(ay, by, k / 8));
        if (x < 0 || x >= W || y < 0 || y >= WL) continue;
        const o = (y * W + x) * 3;
        if (!hm[y * W + x]) (fb[o] = 0.95), (fb[o + 1] = 0.9), (fb[o + 2] = 1);
      }
    }
  // Falling stones and spray.
  for (const b of s.deb) dot(fb, b.x, b.y, 0.42, 0.4, 0.46, 1);
  for (const p of s.spray) dot(fb, p.x, p.y, 0.7, 0.68, 0.82, 0.8);

  // The tarn: the scene above, upside down, broken by the wind and by the
  // fall, darker toward our feet.
  const ch = s.chop, hr = sky1[0], hg = sky1[1], hb = sky1[2];
  for (let y = WL; y < H; y++) {
    const dd = y - WL + 1, ps = 0.4 + dd / 28, rf = 0.52 - (0.24 * dd) / (H - WL);
    for (let x = 0; x < W; x++) {
      const ph = 0.55 * dd - 4.1 * t + 0.21 * x;
      const xo = ch * ps * (sin(ph) + 0.6 * sin(0.23 * dd + 2.7 * t - 0.13 * x));
      const yo = ch * 0.6 * ps * sin(0.8 * dd - 3.3 * t + 0.1 * x);
      const sx = cl(round(x + xo), 0, W - 1), sy = cl(round(WL - dd - yo), 0, WL - 1);
      const i = (sy * W + sx) * 3, o = (y * W + x) * 3;
      let r = fb[i] * rf * 0.85 + 0.01, g = fb[i + 1] * rf * 0.85 + 0.005, b = fb[i + 2] * rf + 0.02;
      // Glints where the wavelets face the sky.
      const gl = ch > 0.25 && cos(ph) > 0.6 ? cos(ph) * noise(x * 0.4 + t * 1.3, dd * 0.7 - t * 0.6) : 0;
      if (gl > 0.6) {
        const k = min(1, ch) * (gl - 0.6) * 1.2;
        r += hr * k;
        g += hg * k;
        b += hb * k;
      }
      fb[o] = r;
      fb[o + 1] = g;
      fb[o + 2] = b;
    }
  }
  // Rings where the house and its stones went in.
  for (const rg of s.rings) {
    const k = rg.a * 0.6 * (1 - rg.r / 60) * min(1, rg.r / 4);
    for (let y = WL; y < H; y++) {
      const dy = (y - WL + 0.5) / 0.5, wo = (rg.r + 0.9) ** 2 - dy * dy;
      if (wo < 0) break;
      const a = sqrt(max(0, (rg.r - 0.9) ** 2 - dy * dy)), b = sqrt(wo);
      for (let x = max(0, Math.ceil(rg.x - b)); x <= min(W - 1, rg.x + b); x++) {
        if (abs(x - rg.x) < a) continue;
        const o = (y * W + x) * 3;
        fb[o] += 0.34 * k;
        fb[o + 1] += 0.3 * k;
        fb[o + 2] += 0.42 * k;
      }
    }
  }
  // Mist: a leaden vapour over the water, rising thick after the fall.
  const boost = sm(T_MIST, T_MIST + 1.8, c) * (1 - sm(14.8, 16.6, c)), den = s.mist * 0.75 + boost;
  if (den > 0.01) {
    const top = mix(64, 6, min(1, s.mist * 0.7 + boost)), wv = s.t * 0.2;
    for (let y = 0; y < H; y++) {
      const v = y < 74 ? sm(top, 74, y) : 1 - 0.55 * sm(74, H, y);
      if (v <= 0) continue;
      for (let x = 0; x < W; x++) {
        const n = 0.6 * noise(x * 0.05 - wv, y * 0.16 + wv * 0.2) + 0.4 * noise(x * 0.12 - wv * 1.6, y * 0.3 + 7);
        const m = min(0.88, den * v * (0.25 + sm(0.3, 0.75, n)));
        const o = (y * W + x) * 3;
        fb[o] = fb[o] * (1 - 0.45 * m) + 0.4 * m;
        fb[o + 1] = fb[o + 1] * (1 - 0.45 * m) + 0.38 * m;
        fb[o + 2] = fb[o + 2] * (1 - 0.45 * m) + 0.46 * m;
      }
    }
  }
  // Rain streaks, and dimples where drops strike the tarn.
  const nd = round(260 * st ** 1.5);
  for (let i = 0; i < nd; i++) {
    const r = s.drops[i];
    if (r.dim > 0) {
      const a = r.dim / 0.13;
      dot(fb, r.x, r.y, 0.3 * a, 0.28 * a, 0.36 * a, 1, true);
      dot(fb, r.x - 1, r.y, 0.15 * a, 0.14 * a, 0.18 * a, 1, true);
      dot(fb, r.x + 1, r.y, 0.15 * a, 0.14 * a, 0.18 * a, 1, true);
      continue;
    }
    for (let k = 0; k < 4; k++) dot(fb, r.x + k * s.slant, r.y - k, 0.2 * (1 - k / 4), 0.19 * (1 - k / 4), 0.25 * (1 - k / 4), 1, true);
  }
  for (let q = 0; q < N; q++) {
    const o = q * 3;
    display.setPixel(q % W, (q / W) | 0, min(255, fb[o] * 255), min(255, fb[o + 1] * 255), min(255, fb[o + 2] * 255));
  }
}

function dot(fb, x, y, r, g, b, a, add) {
  const ix = floor(x), iy = floor(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  const o = (iy * W + ix) * 3;
  if (add) (fb[o] += r), (fb[o + 1] += g), (fb[o + 2] += b);
  else (fb[o] = mix(fb[o], r, a)), (fb[o + 1] = mix(fb[o + 1], g, a)), (fb[o + 2] = mix(fb[o + 2], b, a));
}
