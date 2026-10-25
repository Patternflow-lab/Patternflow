// ===== Patternflow pattern =====
// Title:   Specimen Jar
// Family:  halloween
// Idea:    A glass specimen jar on a dark violet shelf, full of glowing toxic-green fluid with light rippling through it, holds a bloodshot eyeball with a violet iris that bobs and turns as it floats, trailing its pink nerve, its gaze wandering round the jar until it swings round to stare straight out, swims up to the glass and opens its pupil wide while the fluid glows up, and bubbles rise past it to pop at the surface.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bubbles=0..1, Stare=0..1
//
// Knob 1: Hue. Turns the fluid from toxic green at 0 through teal at 0.3 and deep blue at 0.6 to magenta at 1, never round through orange, which glows brown this dim. The iris always takes the opposite colour: violet at 0, red at 0.3, gold at 0.6, green at 1. The eye's white, its veins, the lid and the shelf stay as they are.
// Knob 2: Speed. At 2 the eye bobs through 16 rows every 7 seconds, a small bubble takes about 6 seconds to rise and a big one 4, and the light ripples drift a few LEDs a second. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Bubbles. At 0 a trickle of 4 bubbles a second from three spots on the bottom, a third of them rings 2 to 4 LEDs across and the rest single sparks; at 0.5 about 15 a second; at 1 a fizz of 46 a second from all over the bottom, most of them rings up to 6 LEDs across.
// Knob 4: Stare. How often the eye turns to stare straight out at you: every 14 seconds at 0, every 13.4 at 0.06 (the first time 4 seconds in), every 3.6 at 1, where it hardly looks away. Each stare lasts about 3 seconds: the eye swings round to face out, swims up to the glass a fifth bigger, its pupil opens from a third of the iris to most of it, and the fluid glows up round it.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, sqrt, atan2, acos, exp, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const q = (v, n) => round(v * n) / n;
const wrap = (a) => a - TAU * floor((a + PI) / TAU);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), qq = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? qq : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? qq : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? qq : p];
}

// The jar, row by row: the lid, the neck, the shoulder curving out, the body
// 50 LEDs across inside, the rounded bottom, and the shelf it stands on.
const CX = 32;
const LID0 = 9, LID1 = 20, NECK0 = 21, SH0 = 25, SH1 = 31, BOT0 = 106, BOT1 = 112, SHELF = 114;
// The fluid's surface, a few rows below the shoulder.
const SURF = 34;
function halfIn(y) {
  if (y < NECK0 || y >= BOT1) return -1;
  if (y < SH0) return 19.5;
  if (y < SH1) return 19.5 + 5.5 * sqrt(1 - ((SH1 - y) / (SH1 - SH0)) ** 2);
  if (y < BOT0) return 25;
  const u = (y - BOT0) / (BOT1 - BOT0);
  return 25 - 5 * (1 - sqrt(1 - u * u));
}

// The eye's size, and its iris and pupil as angles from the gaze axis.
const ER = 14.5, IRIS = 0.62;
// Veins on the white: eight from the back of the eye towards the iris, each
// with one branch, laid out in the eye's own angles (th from the gaze axis,
// ph round it) so they turn with it. Each is tabled once, ph against th.
const VEINS = [], VT = 129;
for (let k = 0; k < 8; k++) {
  const ph0 = (k * TAU) / 8 + 0.35 * sin(k * 2.3), a = 0.22 + 0.08 * sin(k * 1.7), f = 3 + (k % 3), p = k * 1.3;
  const tab = new Float32Array(VT);
  for (let j = 0; j < VT; j++) {
    const th = (j * PI) / (VT - 1);
    tab[j] = ph0 + a * sin(f * th + p) + 0.1 * sin(9 * th + 2 * p);
  }
  VEINS.push({ tab, end: 0.74 + 0.1 * ((k * 5) % 3), br: 1.3 + 0.25 * ((k * 3) % 4), bd: k % 2 ? 1 : -1 });
}

export function setup(params) {
  const reg = new Uint8Array(N), hw = new Float32Array(H);
  for (let y = 0; y < H; y++) hw[y] = halfIn(y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, dx = abs(x + 0.5 - CX);
      // 1 inside the glass, 2 the glass wall, 3 the thick base, 4 the lid,
      // 5 the shelf top, 6 the shelf front, 0 the wall behind.
      if (y >= LID0 && y <= LID1) {
        const r = y === LID0 ? 20.5 : y === LID0 + 1 ? 22 : 23;
        if (dx < r) reg[i] = 4;
      } else if (hw[y] > 0 && dx < hw[y]) reg[i] = 1;
      else if (hw[y] > 0 && dx < hw[y] + 1.3) reg[i] = 2;
      else if (y >= BOT1 && y < SHELF && dx < 23) reg[i] = 3;
      if (y >= SHELF && y < SHELF + 2) reg[i] = 5;
      else if (y >= SHELF + 2 && y < SHELF + 9) reg[i] = 6;
    }
  params.s = {
    t: 0, hue: 0, speed: 2, bub: 0, stareK: 0.06,
    reg, hw,
    // Where the eye looks and where it is headed, the stare's phase, how far
    // it has turned to stare and how wide the pupil is.
    yaw: 0.7, pitch: 0.2, roll: 0, tyaw: 0.7, tpitch: 0.2, next: 1.2,
    sp: 0.7, stare: 0, dil: 0,
    bubbles: [], acc: 0, pops: [],
    rgb: new Float32Array(N * 3), nerve: new Float32Array(N), cs: new Float32Array(2 * W + H),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.bub = cl(k[2], 0, 1);
  S.stareK = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.t += g;
  // The stare comes round every 14 seconds at 0 and every 3.6 at 1; for 3.1
  // seconds of each round the eye turns to look straight out of the jar.
  const period = mix(14, 3.6, S.stareK);
  S.sp += g / period;
  const into = (S.sp - floor(S.sp)) * period;
  const staring = into < 3.1;
  S.stare += ((staring ? 1 : 0) - S.stare) * min(1, g * (staring ? 3.5 : 2));
  S.dil += ((staring && into > 0.5 ? 1 : 0) - S.dil) * min(1, g * 2.2);
  // Wandering: somewhere new to look every 1.5 to 3.5 seconds, a quarter of
  // the time far round to the side, so the back of the eye and its nerve
  // turn into view.
  S.next -= g;
  if (S.next <= 0) {
    S.next = 1.5 + 2 * Math.random();
    S.tyaw = (Math.random() * 2 - 1) * (Math.random() < 0.25 ? 2.3 : 1.1);
    S.tpitch = (Math.random() * 2 - 1) * 0.6;
  }
  const ty = mix(S.tyaw, 0, S.stare), tp = mix(S.tpitch, 0, S.stare);
  const rate = min(1, g * (1.2 + 3 * S.stare));
  S.yaw += (ty - S.yaw) * rate;
  S.pitch += (tp - S.pitch) * rate;
  S.roll = 0.35 * sin(S.t * 0.23) + 0.15 * sin(S.t * 0.61);
  // Bubbles: a trickle from three vents at 0, a fizz from all over the
  // bottom at 1, more of them big.
  S.acc += g * mix(4, 46, S.bub * S.bub);
  while (S.acc >= 1) {
    S.acc -= 1;
    const vent = Math.random() < 0.85 - 0.6 * S.bub;
    const x = vent ? CX + [-14, 3, 15][floor(Math.random() * 3)] + Math.random() * 2 - 1 : CX + (Math.random() * 2 - 1) * 22;
    const r = Math.random() < 0.3 + 0.4 * S.bub ? 1.1 + Math.random() * (0.9 + S.bub) : 0.5;
    S.bubbles.push({ x, y: BOT1 - 1, z: Math.random() * 2 - 1, r, v: 2, ph: TAU * Math.random() });
  }
  for (const b of S.bubbles) {
    b.v = min(b.v + g * 30, 9 + 7 * b.r);
    b.y -= b.v * g;
    // A zigzag of about one LED either side as it climbs.
    b.x += 3 * sin(b.ph + b.y * 0.25) * g;
    if (b.y < SURF + 0.5) {
      b.dead = 1;
      S.pops.push({ x: b.x, life: 0.25 });
    }
  }
  S.bubbles = S.bubbles.filter((b) => !b.dead);
  for (const p of S.pops) p.life -= g;
  S.pops = S.pops.filter((p) => p.life > 0);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, reg, hw, nerve, cs } = S, t = S.t;
  const fl = hsv(0.29 + 0.63 * S.hue, 0.92, 1);
  const iris = hsv(0.79 + 0.63 * S.hue, 0.8, 1);
  // The eye: bobbing, swaying, swimming up to the glass when it stares.
  const bobA = 1 - 0.6 * S.stare;
  const ex = CX + 4 * sin(t * 0.45 + 1) * bobA;
  const ey = 70 + (8 * sin(t * 0.9) + 1.5 * sin(t * 2.1)) * bobA;
  const er = ER * (1 + 0.2 * S.stare);
  const ca = cos(S.yaw), sa = sin(S.yaw), cb = cos(S.pitch), sb = sin(S.pitch);
  const f = [sa * cb, sb, ca * cb];
  // Two axes across the gaze, turned by the roll, for the angle round it.
  const r0 = [ca, 0, -sa], u0 = [-sa * sb, cb, -ca * sb];
  const cr = cos(S.roll), sr = sin(S.roll);
  const rx = [r0[0] * cr + u0[0] * sr, r0[1] * cr + u0[1] * sr, r0[2] * cr + u0[2] * sr];
  const ux = [u0[0] * cr - r0[0] * sr, u0[1] * cr - r0[1] * sr, u0[2] * cr - r0[2] * sr];
  const pupil = mix(0.36, 0.7, S.dil);

  // The optic nerve, a pink cord trailing from the back of the eye, waving
  // in the fluid. Behind the eye while it looks out, in front of it when it
  // looks away.
  nerve.fill(0);
  const front = f[2] < 0;
  {
    let bx = -f[0], by = -f[1];
    const bl = hypot(bx, by);
    let dx = bl > 0.05 ? bx / bl : 0, dy = bl > 0.05 ? by / bl : 1;
    let x = ex + er * bx, y = ey + er * by;
    for (let s = 0; s < 13; s++) {
      const rad = 2.3 - 0.09 * s;
      for (let yy = floor(y - rad); yy <= y + rad; yy++)
        for (let xx = floor(x - rad); xx <= x + rad; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const dd = hypot(xx + 0.5 - x, yy + 0.5 - y);
          if (dd < rad) nerve[yy * W + xx] = max(nerve[yy * W + xx], dd < rad - 1 ? 1 : 0.6);
        }
      // Each step bends towards hanging down and waves with the fluid.
      const a = atan2(dy, dx), down = PI / 2, wave = 0.32 * sin(t * 1.6 - s * 0.45);
      const na = a + 0.12 * wrap(down - a) + wave * 0.35;
      dx = cos(na);
      dy = sin(na);
      x += 2 * dx;
      y += 2 * dy;
    }
  }

  // The caustics: three wavy bands, light where their sum crosses zero.
  // Their inner waves are kept per row, per column and per diagonal.
  for (let i = 0; i < W + H; i++) cs[i] = 0.7 * sin((i - H) * 0.1 + t * 0.9);
  for (let x = 0; x < W; x++) cs[W + H + x] = 0.9 * sin(x * 0.15 - t * 0.6);
  const glowE = 0.1 * (0.6 + 1.4 * S.stare), flare = 1 + 0.5 * S.stare;
  const gx = CX - 18.5, gy = 37 + ((t * 11) % 130);

  for (let y = 0; y < H; y++) {
    const rowW = 0.9 * sin(y * 0.13 + t * 0.9);
    for (let x = 0; x < W; x++) {
      const i = y * W + x, rg = reg[i], px = x + 0.5, py = y + 0.5;
      let r = 0.035, gg = 0.012, b = 0.06;
      if (rg === 1) {
        // The fluid's surface waves, and climbs a row at the glass.
        const sy = SURF + 0.6 * sin(0.35 * x + 1.9 * t) + 0.4 * sin(0.6 * x - 2.7 * t) - (abs(px - CX) > hw[y] - 2 ? 1 : 0);
        if (py < sy - 0.5) {
          // Air above the fluid, faintly lit from below.
          r = 0.03 + 0.06 * fl[0];
          gg = 0.02 + 0.08 * fl[1];
          b = 0.06 + 0.06 * fl[2];
        } else {
          const cyl = 1 - ((px - CX) / hw[y]) ** 2;
          const a1 = x * 0.21 + rowW + t * 0.75;
          const a2 = y * 0.17 + cs[W + H + x] - t * 1.1;
          const a3 = (x + y) * 0.12 + cs[x - y + H];
          const cv = abs(sin(a1) + sin(a2) + sin(a3));
          const caus = cv < 0.3 ? 1 - cv / 0.3 : 0;
          const de = sqrt((px - ex) ** 2 + (py - ey) ** 2) - er;
          let L = (0.07 + 0.2 * cyl * cyl) * flare + caus * (0.3 + 0.45 * cyl) + (de > 0 && de < 24 ? glowE * exp(-de / 6) : 0);
          if (py < sy + 0.5) L = 0.95;
          L = q(L, 14);
          r = fl[0] * L;
          gg = fl[1] * L;
          b = fl[2] * L;
        }
      } else if (rg === 2) {
        r = 0.16 + 0.22 * fl[0];
        gg = 0.18 + 0.26 * fl[1];
        b = 0.22 + 0.22 * fl[2];
      } else if (rg === 3) {
        r = fl[0] * 0.5;
        gg = fl[1] * 0.5;
        b = fl[2] * 0.5;
      } else if (rg === 4) {
        // Pewter lid: ridges, round shading, a bright band and a faint one.
        const dx = abs(px - CX), round_ = 0.6 + 0.4 * sqrt(max(0, 1 - (dx / 23) ** 2));
        const ridge = (y - LID0) % 2 === 0 ? 1.25 : 0.8;
        const spec = abs(px - (CX - 12)) < 1.5 ? 2.8 : abs(px - (CX + 9)) < 1 ? 1.6 : 1;
        const v = ridge * spec * round_ * (y === LID1 ? 0.6 : 1);
        r = 0.17 * v;
        gg = 0.13 * v;
        b = 0.25 * v;
        if (y === LID0) (r = 0.42), (gg = 0.36), (b = 0.52);
      } else if (rg === 5) {
        const pool = exp(-abs(px - CX) / 16);
        r = 0.2 + 0.45 * pool * fl[0];
        gg = 0.1 + 0.45 * pool * fl[1];
        b = 0.28 + 0.45 * pool * fl[2];
      } else if (rg === 6) {
        const edge = y === SHELF + 2;
        r = edge ? 0.26 : 0.1;
        gg = edge ? 0.15 : 0.04;
        b = edge ? 0.36 : 0.16;
      } else if (y < SHELF) {
        // The wall behind: violet dark, with the fluid's glow round the jar.
        const hwy = hw[cl(y, NECK0, BOT1 - 1)];
        const dxo = max(0, abs(px - CX) - (hwy > 0 ? hwy : 22));
        const glow = 0.1 * exp(-dxo / 5) * (y > SURF ? 1 : 0.4);
        r += glow * fl[0];
        gg += glow * fl[1];
        b += glow * fl[2];
      }
      if (rg === 1) {
        const u = (px - ex) / er, v = (py - ey) / er, d2 = u * u + v * v;
        const nv = nerve[i];
        if (nv && (front || d2 >= 1)) {
          r = 0.9 * nv;
          gg = 0.32 * nv;
          b = 0.42 * nv;
        } else if (d2 < 1) {
          const nz = sqrt(1 - d2), cosA = u * f[0] + v * f[1] + nz * f[2];
          const th = acos(cl(cosA, -1, 1));
          // Lit by the fluid all round, brightest where it faces out.
          const sh = 0.55 + 0.45 * nz;
          if (th < IRIS * pupil) (r = 0), (gg = 0), (b = 0);
          else if (th < IRIS) {
            const tt = th / IRIS;
            const ph = atan2(u * ux[0] + v * ux[1] + nz * ux[2], u * rx[0] + v * rx[1] + nz * rx[2]);
            // Fibres round the pupil, a pale ring at its edge, a near-black
            // ring at the rim. The iris never goes below 0.6 of full, so a
            // gold one stays gold and does not turn olive.
            const streak = 0.8 + 0.2 * sin(ph * 15 + 3 * sin(ph * 4));
            const vv = tt > 0.86 ? 0.05 : streak * (tt < pupil + 0.12 ? 1 : 0.85) * (0.75 + 0.25 * sh);
            r = iris[0] * vv;
            gg = iris[1] * vv;
            b = iris[2] * vv;
          } else {
            const rim = (1 - nz) * (1 - nz);
            r = mix(1, fl[0], 0.7 * rim) * sh;
            gg = mix(0.97, fl[1], 0.7 * rim) * sh;
            b = mix(0.95, fl[2], 0.7 * rim) * sh;
            const ph = atan2(u * ux[0] + v * ux[1] + nz * ux[2], u * rx[0] + v * rx[1] + nz * rx[2]);
            const st = sin(th) * er, j = round((th / PI) * (VT - 1)), w = 0.45 + 0.35 * (th / PI);
            for (const vn of VEINS) {
              if (th < vn.end) continue;
              const vp = vn.tab[j];
              if (abs(wrap(ph - vp)) * st < w || (th < vn.br && th > vn.end + 0.1 && abs(wrap(ph - vp - vn.bd * 0.9 * (vn.br - th))) * st < w * 0.8)) {
                r = 0.8 * sh;
                gg = 0.02 * sh;
                b = 0.06 * sh;
                break;
              }
            }
          }
          // The wet glint.
          if ((u + 0.38) ** 2 + (v + 0.42) ** 2 < 0.018) (r = 1), (gg = 1), (b = 1);
        }
      }
      // The glass catches the light: a streak down its left side with a glint
      // sliding down it, a fainter one on the right.
      if ((rg === 1 || rg === 2) && y > 36 && y < 104) {
        let hl = 0;
        if (abs(px - gx) < 1) hl = abs(py - gy) < 3 ? 0.7 : 0.26;
        else if (abs(px - (CX + 21.5)) < 0.6 && y > 42 && y < 98) hl = 0.16;
        r += hl;
        gg += hl;
        b += hl;
      }
      const o = i * 3;
      rgb[o] = r;
      rgb[o + 1] = gg;
      rgb[o + 2] = b;
    }
  }
  // Bubbles: a bright point, or a ring for the bigger ones; those behind the
  // eye are hidden by it.
  for (const bb of S.bubbles) {
    const R = bb.r, x0 = floor(bb.x - R - 1), y0 = floor(bb.y - R - 1);
    for (let y = y0; y <= y0 + 2 * R + 2; y++)
      for (let x = x0; x <= x0 + 2 * R + 2; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H || reg[y * W + x] !== 1) continue;
        if (bb.z < 0 && (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 < er * er) continue;
        const dd = hypot(x + 0.5 - bb.x, y + 0.5 - bb.y);
        if (R < 1 ? dd < 0.75 : abs(dd - R) < 0.55) {
          const o = (y * W + x) * 3;
          rgb[o] = mix(fl[0], 1, 0.6);
          rgb[o + 1] = mix(fl[1], 1, 0.6);
          rgb[o + 2] = mix(fl[2], 1, 0.6);
        }
      }
  }
  // A popped bubble flicks two drops off the surface.
  for (const p of S.pops) {
    const y = SURF - 2 - (p.life < 0.12 ? 1 : 0);
    for (const dx of [-1, 1]) {
      const x = floor(p.x + dx * (1.5 - p.life * 2));
      if (x < 0 || x >= W || reg[y * W + x] !== 1) continue;
      const o = (y * W + x) * 3;
      rgb[o] = mix(fl[0], 1, 0.5);
      rgb[o + 1] = mix(fl[1], 1, 0.5);
      rgb[o + 2] = mix(fl[2], 1, 0.5);
    }
  }
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    display.setPixel(i % W, floor(i / W), round(255 * cl(rgb[o], 0, 1)), round(255 * cl(rgb[o + 1], 0, 1)), round(255 * cl(rgb[o + 2], 0, 1)));
  }
}
