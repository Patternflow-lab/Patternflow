// ===== Patternflow pattern =====
// Title:   Pumpkin Drop
// Family:  halloween
// Idea:    A lit jack-o'-lantern is wound up a wooden hoist under a cloudy purple night, swings at the top, is let go and falls all 128 rows with its flame streaking upward, then bursts on the ground, flinging shards and seeds over a splash of pulp while the candle tumbles out and sputters into a puff of smoke; the next pumpkin spins in from the right, lights up and goes up.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 52
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Flame=0..1, Speed=0.2..3, Wind=0..1, Size=0..1
//
// Knob 1: Flame. The colour of the candle and of what it lights: the carved face, the halo on the sky and the hoist, the streak as it falls and the flash of the burst. Gold at 0, toxic green at 0.25, blue at 0.5, magenta at 0.75. The pumpkin's skin stays orange.
// Knob 2: Speed. At 2 a round takes about 10 s. The pumpkin is wound up from the ground in 2.2 s and swings for 1.6 s; the fall of 81 rows takes 1.04 s and ends at 156 LEDs a second; the burst lasts 2.4 s, the candle going out 1.3 to 1.6 s after the impact; the hook comes down in 0.9 s and the next pumpkin takes 1.8 s to come in and light. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Wind. How far the pumpkin swings at the top and how fast the clouds and the smoke drift right. At 0 nearly still air: a swing of 5 degrees either way and clouds at 2 LEDs a second. At 1 it swings 50 degrees and is let go at the end of a long arc, left and right in turn, while the top band of cloud runs at 18 LEDs a second. A big pumpkin swings less, so it stays on the panel.
// Knob 4: Size. The pumpkin, 16 LEDs wide at 0 and 32 at 1, about 17 at the opening. A bigger one throws more light, farther, and bursts into more pieces: 25 shards at the opening and 48 at 1.
// Buttons: K1 tap lets the hanging pumpkin go at once.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, exp, asin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const rnd = (a, b) => a + (b - a) * Math.random();
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};
function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

// The ground's top row; the hoist's post, beam and pulley; the moon.
const GY = 119, PX = 38, PY = 13, MX = 52, MY = 34, MR = 7, CB = [20, 40, 62];
// The rope's length from the pulley to the hook when the pumpkin hangs at
// the top; the pumpkin's middle hangs its half height and 2 LEDs below.
const HOOK = 9;
// Seconds of each part at Speed 2.
const T_HANG = 1.6, T_SMASH = 2.4, T_LOWER = 0.9, T_ROLL = 1.3, T_LIGHT = 0.5, T_HOIST = 2.2, SWING = 1.6;
const G = 150;
// Light round a point, by squared distance in LEDs.
const RAD = new Float32Array(20480);
for (let i = 0; i < RAD.length; i++) RAD[i] = exp(-sqrt(i) / 16);
// Kinds of LED in the still picture and how much lantern light each takes.
const SKY = 0, WOOD = 1, EARTH = 2, MOON = 3, TAKE = [0.5, 0.75, 1, 0.1];

export function setup(params) {
  params.s = {
    t: 0, gh: 0.11, speed: 2, wind: 0, size: 0.06, cx: [0, 31, 67], rx: 9, ry: 7,
    ph: "hoist", e: 0, side: 1, lc: 0, th: 0, x: PX, y: 0, vy: 0, lit: 1, roll: 0,
    hook: { l: 0, a: 0, w: 0 },
    shards: [], seeds: [], smoke: [], splat: null, candle: null, flash: 0, fl: 1, fade: 1,
    bg: new Float32Array(N * 3), kind: new Uint8Array(N), buf: new Float32Array(N * 3), c: [0, 0, 0], g: [0, 0, 0],
    stars: [],
  };
  scene(params.s);
}

// The still picture: a violet sky paling to mauve at the horizon with the
// moon in it, and the black hoist with a moonlit edge standing on the earth.
function scene(S) {
  const bg = S.bg, kd = S.kind, c = S.c;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3, u = y / GY;
      hsv(0.74 + 0.08 * u, 0.72 - 0.12 * u, 0.3 + 0.2 * u * u, c);
      const dm = sqrt((x - MX) ** 2 + (y - MY) ** 2);
      const halo = 0.5 * exp(-max(0, dm - MR) / 7);
      bg[o] = c[0] + 70 * halo;
      bg[o + 1] = c[1] + 60 * halo;
      bg[o + 2] = c[2] + 70 * halo;
      if (dm < MR + 0.5) {
        // The moon, two grey seas on it set on a slant.
        const sea = exp(-((x - MX + 2) ** 2 + (y - MY + 2) ** 2) / 5) + 0.8 * exp(-((x - MX - 3) ** 2 + (y - MY - 3) ** 2) / 4);
        const a = cl(MR + 0.5 - dm, 0, 1), m = 1 - 0.18 * sea;
        bg[o] += (238 * m - bg[o]) * a;
        bg[o + 1] += (228 * m - bg[o + 1]) * a;
        bg[o + 2] += (196 * m - bg[o + 2]) * a;
        kd[p] = MOON;
      }
      if (y >= GY) {
        // Earth, a little lighter in the top rows, with a speckle.
        const k = 1 - (y - GY) * 0.05, n = 0.85 + 0.3 * ((x * 37 + y * 91) % 7) / 7;
        bg[o] = 52 * k * n;
        bg[o + 1] = 30 * k * n;
        bg[o + 2] = 60 * k * n;
        kd[p] = EARTH;
      }
    }
  // Grass tufts standing on the ground line, black against the sky.
  for (let x = 0; x < W; x++) {
    const hgt = 1 + ((x * 7 + 3) % 5 === 0 ? 2 : (x * 13) % 3 === 0 ? 1 : 0);
    for (let j = 1; j <= hgt; j++) wood(S, x, GY - j, 0.4);
  }
  // The post and the beam with its brace, each with a moonlit edge.
  for (let y = 8; y < GY; y++) for (let x = 4; x <= 6; x++) wood(S, x, y, x === 6 ? 1 : 0);
  for (let x = 2; x <= 44; x++) for (let y = 8; y <= 10; y++) wood(S, x, y, y === 8 ? 1 : 0);
  for (let i = 0; i <= 16; i++) for (let j = 0; j < 2; j++) wood(S, 6 + i, 25 - i + j, j);
  // The rope down the post to the winch.
  for (let y = 11; y < 97; y++) rope(bg, 8, y, 0.8);
  for (let i = 0; i < 26; i++) S.stars.push({ x: floor(rnd(0, W)), y: floor(rnd(0, 70)), ph: rnd(0, 7), f: rnd(1, 3), b: rnd(0.4, 1) });
}

function wood(S, x, y, edge) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x, o = p * 3;
  S.bg[o] = 16 + 44 * edge;
  S.bg[o + 1] = 8 + 30 * edge;
  S.bg[o + 2] = 24 + 54 * edge;
  S.kind[p] = WOOD;
}

function rope(buf, x, y, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += (176 - buf[o]) * a;
  buf[o + 1] += (140 - buf[o + 1]) * a;
  buf[o + 2] += (96 - buf[o + 2]) * a;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.gh = 0.11 + cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.wind = cl(k[2], 0, 1);
  S.size = cl(k[3], 0, 1);
  // A pie pumpkin 16 LEDs wide at 0, 32 at 1.
  S.rx = 8 + 8 * S.size;
  S.ry = 0.78 * S.rx;
  const ds = (d * S.speed) / 2, hk = S.hook, RY = S.ry;
  const TOP = HOOK + 2 + RY, LOW = GY - RY - 1 - PY;
  // The swing, kept small enough that a big pumpkin stays on the panel.
  const A = min(0.08 + 0.8 * S.wind, asin(min(1, (W - S.rx - 2 - PX) / TOP)));
  S.t += ds;
  S.e += ds;
  // Three bands of cloud drift right, the lower ones slower.
  for (let i = 0; i < 3; i++) S.cx[i] += (2 + 16 * S.wind) * (1 - 0.25 * i) * ds;
  // The candle flickers on three beats.
  S.fl = 0.8 + 0.1 * sin(S.t * 23) + 0.06 * sin(S.t * 41 + 1) + 0.05 * sin(S.t * 7.3);
  if (input.btnPressed && input.btnPressed[0] && S.ph === "hang") S.e = T_HANG;
  if (S.ph === "hoist" || S.ph === "hang") {
    // A pendulum from the pulley. While it is wound up the swing builds, and
    // it is let go at the end of its swing, where it stands still.
    const p = S.ph === "hoist" ? sm(S.e / T_HOIST) : 1;
    const tt = S.ph === "hoist" ? S.e - T_HOIST : S.e;
    S.lc = S.ph === "hoist" ? LOW + (TOP - LOW) * p : TOP;
    S.th = S.side * A * p * cos((2 * PI * tt) / SWING);
    S.x = PX + S.lc * sin(S.th);
    S.y = PY + S.lc * cos(S.th);
    hk.l = S.lc - RY - 2;
    hk.a = S.th;
    if (S.ph === "hoist" && S.e >= T_HOIST) (S.ph = "hang"), (S.e = 0);
    else if (S.ph === "hang" && S.e >= T_HANG) {
      S.ph = "fall";
      S.e = 0;
      S.vy = 0;
      hk.w = 0;
    }
  } else if (S.ph === "fall") {
    S.vy += G * ds;
    S.y += S.vy * ds;
    S.th *= exp(-1.5 * ds);
    if (S.y + RY >= GY - 0.5) smash(S);
  } else if (S.ph === "smash") {
    if (S.e >= T_SMASH) (S.ph = "lower"), (S.e = 0);
  } else if (S.ph === "lower") {
    // The hook is let down to the ground while the mess fades.
    const p = sm(S.e / T_LOWER);
    hk.l = HOOK + (LOW - TOP) * p;
    S.fade = 1 - p;
    if (S.e >= T_LOWER) {
      S.ph = "roll";
      S.e = 0;
      S.shards.length = S.seeds.length = 0;
      S.splat = null;
      S.fade = 1;
      S.lit = 0;
    }
  } else if (S.ph === "roll") {
    // The next pumpkin spins in from the right and turns its face to us.
    const p = S.e / T_ROLL, q = 1 - (1 - p) * (1 - p);
    S.x = PX + 36 * (1 - q);
    S.y = PY + LOW;
    S.roll = (S.x - PX) / S.rx;
    S.th = 0;
    if (S.e >= T_ROLL) (S.ph = "light"), (S.e = 0), (S.roll = 0);
  } else if (S.ph === "light") {
    S.lit = S.e < 0.12 ? 1.6 * (S.e / 0.12) : 1 + 0.6 * exp(-(S.e - 0.12) * 8);
    if (S.e >= T_LIGHT) {
      S.ph = "hoist";
      S.e = 0;
      S.lit = 1;
      S.side = -S.side;
    }
  }
  // The empty hook swings back under the pulley.
  if (S.ph !== "hoist" && S.ph !== "hang") {
    hk.w += (-30 * hk.a - 2.2 * hk.w) * ds;
    hk.a += hk.w * ds;
  }
  physics(S, ds);
}

// The pumpkin hits the ground and everything in it is thrown out at once.
function smash(S) {
  const RX = S.rx, RY = S.ry, b = S.size;
  S.ph = "smash";
  S.e = 0;
  S.y = GY - RY - 0.5;
  S.flash = 1;
  const n = round(3 * RX), x0 = cl(S.x, 6, W - 7);
  S.x = x0;
  for (let i = 0; i < n; i++) {
    const a = rnd(-PI + 0.25, -0.25), sp = rnd(40, 95) * (0.9 + 0.4 * b), r = rnd(1.3, 3) * RX / 9;
    S.shards.push({ x: x0 + rnd(-RX, RX) * 0.8, y: S.y + rnd(-RY, RY) * 0.6, vx: cos(a) * sp * 0.8, vy: sin(a) * sp, a: rnd(0, 7), w: rnd(-12, 12), r, k: Math.random() < 0.3 ? 1 : 0, rest: 0 });
  }
  for (let i = 0; i < 14 + 26 * b; i++) {
    const a = rnd(-PI * 0.95, -PI * 0.05), sp = rnd(30, 85) * (0.8 + 0.5 * b);
    S.seeds.push({ x: x0 + rnd(-4, 4), y: S.y, vx: cos(a) * sp, vy: sin(a) * sp, rest: 0, p: Math.random() < 0.35 });
  }
  S.splat = { x: x0, w: 0, s: 6 + 8 * b + 4 * Math.random() };
  const dir = Math.random() < 0.5 ? -1 : 1;
  S.candle = { x: x0, y: S.y, vx: dir * rnd(16, 26), vy: -rnd(55, 70), a: 0, w: dir * rnd(8, 14), f: 1, out: rnd(1.3, 1.6), t: 0, puff: false };
}

function physics(S, ds) {
  S.flash *= exp(-ds * 9);
  for (const s of S.shards) {
    if (s.rest) continue;
    s.vy += G * ds;
    s.x += s.vx * ds;
    s.y += s.vy * ds;
    s.a += s.w * ds;
    if (s.x < 0.5 || s.x > W - 1.5) (s.vx = -0.5 * s.vx), (s.x = cl(s.x, 0.5, W - 1.5));
    if (s.y > GY - 0.5 && s.vy > 0) {
      s.y = GY - 0.5;
      s.vy *= -0.42;
      s.vx *= 0.55;
      s.w *= 0.5;
      if (abs(s.vy) < 12) (s.rest = 1), (s.y = GY - 0.5 + rnd(0, 1.2));
    }
  }
  for (const s of S.seeds) {
    if (s.rest) continue;
    s.vy += G * ds;
    s.x += s.vx * ds;
    s.y += s.vy * ds;
    if (s.y > GY && s.vy > 0) {
      s.y = GY;
      s.vy *= -0.45;
      s.vx *= 0.6;
      if (abs(s.vy) < 10) (s.rest = 1), (s.y = GY + floor(rnd(0, 3)));
    }
  }
  if (S.splat) S.splat.w = min(1, S.splat.w + ds * 6);
  const cd = S.candle;
  if (cd) {
    cd.t += ds;
    cd.vy += G * ds;
    cd.x += cd.vx * ds;
    cd.y += cd.vy * ds;
    cd.a += cd.w * ds;
    if (cd.x < 2 || cd.x > W - 3) (cd.vx = -0.6 * cd.vx), (cd.x = cl(cd.x, 2, W - 3));
    if (cd.y > GY - 1 && cd.vy > 0) {
      // On the ground it lies down and rolls to a stop.
      cd.y = GY - 1;
      cd.vy *= -0.3;
      cd.vx *= 0.7;
      cd.w = 0;
      cd.a += (PI / 2 - (cd.a % PI)) * 0.4;
      if (abs(cd.vy) < 8) cd.vy = 0;
    }
    if (cd.vy === 0) cd.vx *= exp(-4 * ds);
    // It sputters: the flame gutters and goes out.
    const left = cd.out - cd.t;
    cd.f = left > 0 ? cl(left / cd.out + 0.3, 0, 1) * (left < 0.6 ? (sin(cd.t * 61) > 0.1 ? 1 : 0.25) : 1) : 0;
    if (left <= 0 && !cd.puff) {
      cd.puff = true;
      const w = wick(cd);
      for (let i = 0; i < 22; i++) S.smoke.push({ x: w[0] + rnd(-0.5, 0.5), y: w[1] - rnd(0, 2), vx: rnd(-5, 5), vy: -rnd(10, 26), r: rnd(0.8, 1.4), t: 0, life: rnd(1.8, 2.8) });
    }
    if (S.ph === "roll") S.candle = null;
  }
  let n = 0;
  for (const m of S.smoke) {
    m.t += ds;
    m.x += (m.vx + 3 * sin(m.t * 3 + m.life * 5) + 12 * S.wind * min(1, m.t)) * ds;
    m.y += m.vy * ds;
    m.vy *= exp(-0.6 * ds);
    m.r = min(3.6, m.r + ds * 1.6);
    if (m.t < m.life) S.smoke[n++] = m;
  }
  S.smoke.length = n;
}

// Where the candle's wick is: the top of the stick, which tumbles.
function wick(cd) {
  return [cd.x + 2.5 * sin(cd.a), cd.y - 2.5 * cos(cd.a)];
}

// Add a colour at a pixel by alpha.
function put(buf, x, y, r, g, b, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += (r - buf[o]) * a;
  buf[o + 1] += (g - buf[o + 1]) * a;
  buf[o + 2] += (b - buf[o + 2]) * a;
}

// One LED of the pumpkin at local (u, v) from its middle, turned by its
// spin: false outside it. Ribs are meridians, so they crowd at the edges;
// the face is painted on the front and turns away as it spins.
function pumpkinAt(S, u, v, out) {
  const RX = S.rx, RY = S.ry, k = 9 / RX, vv = v / RY;
  if (vv < -1 || vv > 1) return false;
  const half = RX * sqrt(1 - vv * vv) * (vv < 0 ? 1 : 1 - 0.08 * vv);
  if (abs(u) > half + 0.35) return false;
  // A dip at the top round the stem.
  if (vv < -0.8 && abs(u) < 2 && v < -RY + 0.9) return false;
  const n = cl(u / max(half, 0.5), -1, 1), lon = asin(n) - S.roll;
  const rib = abs(((lon / 0.628 + 50.5) % 1) - 0.5) < 0.13;
  const nz = sqrt(max(0, 1 - n * n)) * sqrt(max(0, 1 - vv * vv));
  const lightv = 0.82 + 0.18 * cl(0.3 * n - 0.5 * vv + 0.5 * nz, 0, 1);
  const glow = S.lit * S.fl;
  let hole = false;
  if (cos(lon) > 0.2) hole = face(9 * sin(lon), v * k);
  if (hole) {
    if (glow > 0.05) {
      hsv(S.gh + 0.03, 0.62 - 0.4 * cl(glow - 0.7, 0, 1), min(1, 0.5 + 0.5 * glow), out);
    } else (out[0] = 46), (out[1] = 16), (out[2] = 6);
    return true;
  }
  // Skin: bright saturated orange, the ribs a redder line.
  hsv(rib ? 0.05 : 0.07, 1, lightv * (rib ? 0.86 : 0.97), out);
  return true;
}

// The carving, in LEDs from the middle of a pumpkin 18 wide: triangle eyes
// over a small nose, then a grin with two teeth above and one below.
function face(u, v) {
  const au = abs(u);
  if (v >= -4 && v <= -1.5) {
    const w = (v + 4.3) * 0.75;
    if (abs(au - 4.2) < w) return true;
  }
  if (v >= -0.5 && v <= 0.6 && au < 0.6 + (v + 0.5) * 0.9) return true;
  if (v > 1.5 && v < 4.5) {
    const top = 2.5 - 0.035 * au * au, bot = 4.2 - 0.05 * au * au;
    if (au < 6.4 && v > top && v < bot) {
      if (v < top + 1.2 && (abs(u + 2.5) < 0.6 || abs(u - 2.5) < 0.6)) return false;
      if (v > bot - 1.1 && au < 0.6) return false;
      return true;
    }
  }
  return false;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const bg = S.bg, buf = S.buf, kd = S.kind, gc = hsv(S.gh, 0.85, 1, S.g), c = S.c, hk = S.hook;
  // Lantern light: from the pumpkin while it is whole and lit, then from the
  // candle out on the ground; the burst adds a flash.
  const whole = S.ph !== "smash" && S.ph !== "lower";
  const L1 = whole ? (0.9 + 0.5 * S.size) * S.lit * S.fl : 0, q1 = (8.5 / S.rx) ** 2, cd = S.candle, RX = S.rx, RY = S.ry;
  const L2 = cd ? 0.7 * cd.f * S.fl : 0, wk = cd ? wick(cd) : [0, 0];
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3;
      let l = 0;
      if (L1 > 0) l += L1 * RAD[min(20479, round(((x - S.x) ** 2 + (y - S.y) ** 2) * q1))];
      if (L2 > 0) l += L2 * RAD[min(20479, round((x - wk[0]) ** 2 + (y - wk[1]) ** 2 * 1.5))];
      if (S.flash > 0.01) l += 1.6 * S.flash * RAD[min(20479, round(((x - S.x) ** 2 + (y - GY) ** 2) * 0.4))];
      const t = l * TAKE[kd[p]];
      let r = bg[o], g = bg[o + 1], b = bg[o + 2];
      if (y > 6 && y < 78 && kd[p] !== WOOD) {
        // Cloud: wisps of value noise in three wavy bands, lilac grey.
        let a = 0;
        for (let i = 0; i < 3; i++) {
          const dy = (y - CB[i] - 3 * vn((x - S.cx[i]) * 0.03, i * 31)) / (3.5 + 1.5 * i);
          if (dy * dy > 4) continue;
          const u = x - S.cx[i], n = vn(u * 0.045 + y * 0.02, i * 101) + 0.6 * vn(u * 0.12 - y * 0.05, i * 101 + 7) + 0.3 * vn(u * 0.25 + y * 0.1, i * 101 + 13);
          a += cl((n - 0.05) * 2.2, 0, 1) * exp(-dy * dy) * 0.75;
        }
        if (a > 0) {
          a = min(0.8, a);
          r += (142 - r) * a;
          g += (116 - g) * a;
          b += (178 - b) * a;
        }
      }
      buf[o] = r + gc[0] * t;
      buf[o + 1] = g + gc[1] * t;
      buf[o + 2] = b + gc[2] * t;
    }
  // Stars twinkle.
  for (const s of S.stars) {
    const b = s.b * (0.55 + 0.45 * sin(S.t * s.f + s.ph));
    put(buf, s.x, s.y, 235, 220, 255, 0.85 * b);
  }
  // The winch on the post turns as the rope runs.
  const wa = hk.l / 3;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 2 * PI;
    put(buf, 9 + 3.5 * cos(a), 100 + 3.5 * sin(a), 120, 90, 60, 1);
  }
  for (let i = 0; i < 4; i++) {
    const a = wa + (i * PI) / 2;
    for (let r = 0; r <= 3; r++) put(buf, 9 + r * cos(a), 100 + r * sin(a), 150, 112, 70, 1);
  }
  // The pulley under the beam.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * PI;
    put(buf, PX + 2.2 * cos(a), PY + 2.2 * sin(a), 120, 110, 130, 1);
  }
  put(buf, PX, PY, 200, 190, 210, 1);
  // The rope and the hook: on the pumpkin while it hangs, empty after.
  const ha = hk.a, hl = hk.l;
  for (let i = 2; i <= hl; i += 0.7) rope(buf, PX + i * sin(ha), PY + i * cos(ha), 0.9);
  const hx = PX + hl * sin(ha), hy = PY + hl * cos(ha);
  put(buf, hx, hy + 1, 170, 170, 190, 1);
  put(buf, hx + 1, hy + 2, 170, 170, 190, 1);
  put(buf, hx, hy + 2.6, 140, 140, 160, 1);
  // The pumpkin, turned by its swing.
  if (whole) {
    const cs = cos(S.th), sn = sin(S.th);
    // The flame streaks up out of it as it falls.
    if (S.ph === "fall") {
      const len = min(20, S.vy / 6);
      for (let j = 0; j < len; j++) {
        const f = 1 - j / len;
        hsv(S.gh + 0.04 - 0.08 * (1 - f), 0.1 + 0.8 * (1 - f), 1, c);
        put(buf, S.x, S.y - RY - 1 - j, c[0], c[1], c[2], S.fl * min(1, 1.5 * f));
        hsv(S.gh - 0.03, 0.85, 1, c);
        for (let i = -1; i <= 1; i += 2) if (j < len * 0.7) put(buf, S.x + i, S.y - RY - 1 - j, c[0], c[1], c[2], 0.75 * f * S.fl);
      }
    }
    for (let dy = -ceil(RY) - 3; dy <= RY + 1; dy++)
      for (let dx = -ceil(RX) - 2; dx <= RX + 2; dx++) {
        const u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
        if (pumpkinAt(S, u, v, c)) put(buf, S.x + dx, S.y + dy, c[0], c[1], c[2], 1);
        else if (v < -RY + 1 && v > -RY - 2.5 && abs(u) < 1.1) put(buf, S.x + dx, S.y + dy, 70, 120, 40, 1);
      }
  }
  // The burst: pulp splashed on the ground, with the shards and seeds over it.
  const fa = S.fade;
  if (S.splat) {
    const sp = S.splat;
    for (let i = -sp.s - 3; i <= sp.s + 3; i++) {
      const w = sp.s * sp.w, r = abs(i) / max(1, w), j = (i * 7919 + 13) % 5;
      if (r > 1) continue;
      const hgt = 1 + (r < 0.6 ? 1 : 0) + (j === 0 ? 1 : 0);
      for (let k = 0; k < hgt; k++) put(buf, sp.x + i, GY - k + (k ? 0 : 0), 255, 150 + 20 * j, 30, fa * (1 - 0.3 * k));
    }
  }
  for (const s of S.shards) {
    const ca = cos(s.a), sa = sin(s.a), r = s.r;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        // A rough triangle of skin, or of yellow flesh.
        const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        if (v < -r * 0.5 || v > r * 0.6 || abs(u) > r - (v + r * 0.5) * 0.9) continue;
        if (s.k) put(buf, s.x + dx, s.y + dy, 255, 196, 60, fa);
        else put(buf, s.x + dx, s.y + dy, 255, v < 0 ? 112 : 96, 0, fa);
      }
  }
  for (const s of S.seeds) {
    put(buf, s.x, s.y, 250, 238, 190, fa);
    if (s.p && !s.rest) put(buf, s.x - s.vx * 0.02, s.y - s.vy * 0.02, 255, 170, 40, fa * 0.8);
  }
  if (cd) {
    // The candle, a stub of wax two LEDs thick, and its flame, which stands
    // up whichever way the stub lies.
    const ca = cos(cd.a), sa = sin(cd.a);
    for (let j = -2; j <= 2; j += 0.5)
      for (let i = 0; i <= 1; i++) put(buf, cd.x + j * sa + i * ca, cd.y - j * ca + i * sa, 240, 232, 212, fa);
    if (cd.f > 0.02) {
      const w = wick(cd), fl = cd.f * S.fl;
      hsv(S.gh + 0.04, 0.15, 1, c);
      put(buf, w[0], w[1] - 1, c[0], c[1], c[2], min(1, fl * 1.4));
      put(buf, w[0] + 1, w[1] - 1, c[0], c[1], c[2], min(1, fl * 0.8));
      hsv(S.gh, 0.8, 1, c);
      put(buf, w[0], w[1] - 2, c[0], c[1], c[2], min(1, fl * 1.2));
      put(buf, w[0] + 1, w[1] - 2, c[0], c[1], c[2], fl * 0.6);
      if (fl > 0.5) put(buf, w[0] + 0.5 + 0.6 * sin(S.t * 13), w[1] - 3, c[0], c[1], c[2], fl - 0.3);
    }
  }
  for (const m of S.smoke) {
    const a = 0.5 * (1 - m.t / m.life) * min(1, m.t * 8);
    const r = m.r;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const q = dx * dx + dy * dy;
        if (q <= r * r + 0.3) put(buf, m.x + dx, m.y + dy, 180, 170, 196, a * (1 - q / (r * r + 1.5)));
      }
  }
  // Out in steps of four.
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, min(255, ((buf[o] + 2) >> 2) << 2), min(255, ((buf[o + 1] + 2) >> 2) << 2), min(255, ((buf[o + 2] + 2) >> 2) << 2));
}
