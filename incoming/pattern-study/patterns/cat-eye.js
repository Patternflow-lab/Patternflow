// ===== Patternflow pattern =====
// Title:   Cat Eye
// Family:  cosmetic
// Idea:    A deep jelly polish full of magnetic shimmer flakes over an unseen gliding magnet: the flakes turn to follow its field, lie flat where the field runs along the surface and gather the light into a sharp bright band with a velvet falloff that trails the magnet as they rotate, and stand dark where the field dives into the surface.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 34, after magnetic cat-eye gel nail polish
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Magnet=-1..1, Depth=0..1
//
// Knob 1: Hue. The polish, once round the wheel. At 0 a deep violet jelly with a lilac-white band; at 0.2 berry pink, at 0.6 emerald, at 0.8 teal, at 0.9 sapphire. From 0.25 to 0.49, copper through gold to chartreuse, the jelly sinks toward black, a gold cat eye over a black base coat, and the band's glow turns to champagne.
// Knob 2: Speed. At 2 the magnet glides 15 LEDs either side of the middle and back every 7 seconds, 16 LEDs up and down every 11 and tilts 17 degrees either way every 17; flakes in its field line up in 0.15 seconds and tumble back over 1.8 seconds once it has passed. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Magnet. At 0 one bar magnet 76 LEDs long under the polish, one straight line. Toward -1 a second bar, poles reversed, comes in beside the first and splits the line in two, about 22 LEDs apart at -1. Toward 1 the second bar lies across the first and the line branches into a star.
// Knob 4: Depth. How far under the surface the magnet runs, 10 LEDs at 0 to 40 at 1. At 0.06 the band with its velvet is about 11 LEDs wide round a core of two; at 0.5 about 21, at 1 a soft glow about 30 LEDs wide.
// Buttons: K1 tap pulls the magnet away to four times its depth in 0.3 seconds and holds it there for 2.5: the band dissolves and the flakes tumble back into a scattered shimmer, then the magnet comes back in 0.5 seconds and the line forms again.

const W = 64, H = 128, N = W * H;
// The magnet is a flat bar 76 LEDs long, magnetised across its width, lying
// along the panel under the polish: nine dipoles in a row.
const BAR = 76, PTS = 9;
const { floor, min, max, sqrt, sin, cos, exp, atan2, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

function gauss() {
  const u = 1 - random(), v = random();
  return sqrt(-2 * Math.log(u)) * cos(2 * PI * v);
}

export function setup(params) {
  const S = {
    hue: 0, speed: 2, mag: 0, depth: 0.06, t: 0, warm: false, pull: 0, pullT: -1,
    A: new Float32Array(N), TH: new Float32Array(N), JIT: new Float32Array(N), TEX: new Float32Array(N), SZ: new Float32Array(N),
    R0: new Float32Array(N), RW: new Float32Array(N), RP: new Float32Array(N),
    dip: new Float64Array(6 * 2 * PTS), nd: 0, ref: 1,
  };
  for (let p = 0; p < N; p++) {
    S.JIT[p] = 0.1 * gauss();
    S.TEX[p] = 0.8 + 0.4 * random();
    S.SZ[p] = 0.3 + 1.2 * random() ** 2;
    S.R0[p] = (random() - 0.5) * PI;
    S.RW[p] = 0.3 + 0.9 * random();
    S.RP[p] = 2 * PI * random();
  }
  params.s = S;
}

// A second bar has strength |Magnet|. Below 0 it lies beside the first, 0.9
// of the depth away and poles reversed, for a double line; above 0 it lies
// across the first, for a star.

function magnets(S) {
  const sp = S.t, d = 10 + 30 * S.depth;
  const cx = 32 + 15 * sin((2 * PI * sp) / 7), cy = 64 + 16 * sin((2 * PI * sp) / 11 + 1);
  const ang = 0.3 * sin((2 * PI * sp) / 17);
  // Along the bar (down the panel) and across it.
  const lx = -sin(ang), ly = cos(ang), mx = cos(ang), my = sin(ang);
  const k = S.mag, away = 1 + 3 * S.pull, dip = S.dip;
  S.nd = 0;
  const bar = (x, y, ax, ay, ex, ey, st) => {
    for (let i = 0; i < PTS; i++) {
      const u = (i / (PTS - 1) - 0.5) * BAR, o = 6 * S.nd++;
      dip[o] = x + u * ax;
      dip[o + 1] = y + u * ay;
      dip[o + 2] = d * away;
      dip[o + 3] = ex;
      dip[o + 4] = ey;
      dip[o + 5] = st / PTS;
    }
  };
  if (k < 0) {
    const s = 0.9 * d * -k;
    bar(cx - s * mx, cy - s * my, lx, ly, mx, my, 1);
    bar(cx + s * mx, cy + s * my, lx, ly, -mx, -my, -k);
  } else {
    bar(cx, cy, lx, ly, mx, my, 1);
    if (k > 0) bar(cx, cy, mx, my, -lx, -ly, k);
  }
  // The field at the surface right over the middle of one bar at this depth
  // is the scale the flakes answer to.
  let ref = 0;
  for (let i = 0; i < PTS; i++) {
    const u = (i / (PTS - 1) - 0.5) * BAR, r2 = u * u + d * d, ir = 1 / sqrt(r2);
    ref += (ir * ir * ir) / PTS;
  }
  S.ref = ref;
}

function step(S, dt) {
  const sp = S.speed / 2, ds = dt * sp;
  S.t += ds;
  if (S.pullT >= 0) {
    // Away in 0.3 s, held 2.5 s, back in 0.5 s.
    S.pullT += ds;
    const u = S.pullT;
    S.pull = u < 0.3 ? u / 0.3 : u < 2.8 ? 1 : u < 3.3 ? 1 - (u - 2.8) / 0.5 : 0;
    if (u >= 3.3) S.pullT = -1;
  }
  magnets(S);
  const { A, TH, dip } = S, iref = 1 / S.ref, nd = S.nd;
  const kOn = 1 - exp(-ds / 0.15), kOff = 1 - exp(-ds / 1.8);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let bx = 0, by = 0, bz = 0;
      for (let o = 0; o < 6 * nd; o += 6) {
        const ex = dip[o + 3], ey = dip[o + 4], st = dip[o + 5];
        const rx = x + 0.5 - dip[o], ry = y + 0.5 - dip[o + 1], rz = dip[o + 2];
        const r2 = rx * rx + ry * ry + rz * rz, ir = 1 / sqrt(r2), i3 = st * ir * ir * ir, md = 3 * (ex * rx + ey * ry) * ir * ir;
        bx += i3 * (md * rx - ex);
        by += i3 * (md * ry - ey);
        bz += i3 * md * rz;
      }
      const bh = sqrt(bx * bx + by * by), b = sqrt(bh * bh + bz * bz) * iref;
      const p = y * W + x, at = 1 - exp(-b / 0.25);
      A[p] += (at - A[p]) * (at > A[p] ? kOn : kOff);
      // Tilt of the field from the surface, -pi/2..pi/2; a flake's axis is a
      // line, so tilts half a turn apart are the same.
      const tt = atan2(bz, bh);
      let dlt = tt - TH[p];
      if (dlt > PI / 2) dlt -= PI;
      else if (dlt < -PI / 2) dlt += PI;
      TH[p] += dlt * (1 - exp(-ds * (1 + 10 * at) / 0.6));
      if (TH[p] > PI / 2) TH[p] -= PI;
      else if (TH[p] < -PI / 2) TH[p] += PI;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.mag = cl(k[2], -1, 1);
  S.depth = cl(k[3], 0, 1);
  if (!S.warm) {
    // Open on flakes that have followed the magnet for two seconds.
    const sp = S.speed;
    S.speed = 2;
    for (let i = 0; i < 60; i++) step(S, 1 / 30);
    S.speed = sp;
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0] && S.pullT < 0) S.pullT = 0;
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { A, TH, JIT, TEX, SZ, R0, RW, RP } = S, h = S.hue + 0.74, t = S.t;
  // Orange and yellow jelly at level 40 reads brown on the panel. Round
  // there (hue 0.0 to 0.22) the base sinks toward black, as a gold cat eye
  // over a black base coat, and the band's glow turns paler and brighter.
  const hh = h - floor(h), wy = max(0, 1 - ((hh - 0.11) / 0.12) ** 2);
  const body = [0, 0, 0], glint = [0, 0, 0], vel = [0, 0, 0];
  hsv(h, 0.95 - 0.2 * wy, 1 - 0.7 * wy, body);
  hsv(h + 0.02, 0.25 - 0.1 * wy, 1, glint);
  hsv(h + 0.01, 0.6 - 0.25 * wy, 1 + 0.4 * wy, vel);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, a = A[p], th = TH[p], s2 = sin(th) * sin(th);
      // Where the flake points: along the field as far as it is aligned,
      // otherwise its own slow tumble.
      const free = 6 * (R0[p] + 0.7 * sin(RW[p] * t + RP[p]));
      const phi = a * (th + JIT[p]) + (1 - a) * free;
      const g = exp(-(phi * phi) / (2 * 0.12 * 0.12));
      const v = a * a * exp(-(th * th) / (2 * 0.5 * 0.5));
      const lb = 40 * TEX[p] * (1 - 0.5 * a * s2), lg = 255 * g * (a + 0.3 * (1 - a) * SZ[p]), lv = 150 * v;
      const r = body[0] * lb + glint[0] * lg + vel[0] * lv;
      const gg = body[1] * lb + glint[1] * lg + vel[1] * lv;
      const bb = body[2] * lb + glint[2] * lg + vel[2] * lv;
      display.setPixel(x, y, round(min(255, r)), round(min(255, gg)), round(min(255, bb)));
    }
}
