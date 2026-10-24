// ===== Patternflow pattern =====
// Title:   Penrose Room
// Family:  physics
// Idea:    A point of light wanders in Penrose's mirrored room, two half-ellipses joined by a corridor whose thin walls run from focus to focus, and its traced rays fill the corridor and the ellipses while the two side chambers stay dark, until the light floats up through an ellipse into a chamber and the lit and dark parts of the room swap.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Penrose unilluminable room (Roger Penrose, 1958), pattern round 33
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Offset=-4..4, Bounces=0..1
//
// Knob 1: Hue. The colour of the light. At 0 the light straight from the lamp is a pale aqua and light that has met more mirrors turns deeper, to azure after five; the walls are a dim violet a quarter turn on. Round orange and yellow the light goes paler, so far light reads as butter, not olive.
// Knob 2: Speed. How fast the light wanders and how soon it moves: at 2 it stays 3.2 s in the corridor at the start, takes 1.8 s to float through an ellipse into a chamber, and after that stays 5 to 8 s in the corridor and 7 to 10 s in a chamber; at 0.2 all of it is ten times slower.
// Knob 3: Offset. How far the two corridor walls stand off the foci, in LEDs. At 0 they run exactly from focus to focus and not one ray crosses into the dark part; moved 4 LEDs in or out, the gap between wall and focus lets rays through and the dark part fills with a dimmer glow.
// Knob 4: Bounces. How many times each ray is reflected: 14 at the start; none at 0, where only what the lamp sees straight on is lit and from a chamber the far side of the room stays dark; 40 at 1, where more of the light has met many mirrors and the room turns a deeper blue.
// Buttons: K1 tap sends the light across now, from the corridor into a side chamber or back.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The room, in LEDs. Two half-ellipses with semi-axes 31.5 and 26 put their
// flat sides at rows 26.5 and 101.5, and their arcs touch rows 0 and 127, so
// the room is the whole panel. The foci sit on the flat sides at 17.78 either
// side of the middle column; the outer walls are the ellipses' own tangents
// at the ends of the major axis, columns 0 and 63.
const A = 31.5, B = 26, C = sqrt(A * A - B * B), CX = 32;
const YT = 0.5 + B, YB = 127.5 - B, YM = 64;
const IA2 = 1 / (A * A), IB2 = 1 / (B * B), EPS = 1e-6;
// Each reflection keeps 60% of the light. The glow is LEVEL times the light
// over the mean of the lit LEDs, raised to GAMMA: the mean shows at 92 of 255
// and the glow round the lamp comes close to full.
const REFL = 0.6, LEVEL = 0.36, GAMMA = 0.7;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, off: 0, nb: 14, w: C,
    buf: new Float32Array(N), tmp: new Float32Array(N), hz: new Float32Array(N), kb: new Float32Array(N), kz: new Float32Array(N), wall: new Float32Array(N), wallW: NaN,
    lu: 0, ly: YM, region: 0, tau: 0, stay: 3.2, mode: 0,
    tt: 0, from: 0, to: 0, expo: 0, bz: new Float64Array(8), col: new Float32Array(51),
  };
}

// Where the light may stand: the corridor between the walls, or one side
// chamber, a little clear of every wall.
function clampTo(S, region, u) {
  const w = S.w;
  if (region === 0) return cl(u, -(w - 1.2), w - 1.2);
  return region * cl(region * u, w + 1.2, A - 1.2);
}

// A slow wander that starts from the middle of the place, so the light
// arrives at the middle and sets off from there without a jump.
function wander(S) {
  const w = S.w, t = S.tau;
  const y = YM + 30 * sin(0.4 * t);
  if (S.region === 0) return [(w - 3.5) * sin(0.55 * t), y];
  const uc = (S.region * (w + A)) / 2, au = max(0, (A - w) / 2 - 2.5);
  return [uc + au * sin(0.7 * t), y];
}

// Crossing over: a cubic curve that leaves straight up (or down) through the
// flat side nearer the light, arcs through the half-ellipse and drops
// straight into the middle of the other place. From the corridor it leaves
// between the foci and from a chamber outside them, as a ray would.
function startTransit(S) {
  const u0 = S.lu, y0 = S.ly, w = S.w;
  S.from = S.region;
  S.to = S.region === 0 ? (u0 > 0.5 ? 1 : u0 < -0.5 ? -1 : Math.random() < 0.5 ? -1 : 1) : 0;
  const u3 = S.to === 0 ? 0 : (S.to * (w + A)) / 2, cy = y0 <= YM ? YT - 32 : YB + 32;
  S.bz.set([u0, y0, u0, cy, u3, cy, u3, YM]);
  S.mode = 1;
  S.tt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  S.off = cl(k[2] || 0, -4, 4);
  S.w = C + S.off;
  S.nb = Math.round(40 * Math.pow(cl(k[3], 0, 1), 0.373));
  const sp = S.speed / 2;

  if (input.btnPressed && input.btnPressed[0] && S.mode === 0) startTransit(S);
  if (S.mode === 0) {
    S.tau += d * sp;
    S.stay -= d * sp;
    const p = wander(S);
    S.lu = clampTo(S, S.region, p[0]);
    S.ly = p[1];
    if (S.stay <= 0) startTransit(S);
  } else {
    S.tt = min(1, S.tt + (d * sp) / 1.8);
    const e = S.tt * S.tt * (3 - 2 * S.tt), f = 1 - e, b = S.bz;
    const c0 = f * f * f, c1 = 3 * f * f * e, c2 = 3 * f * e * e, c3 = e * e * e;
    let u = c0 * b[0] + c1 * b[2] + c2 * b[4] + c3 * b[6];
    const y = c0 * b[1] + c1 * b[3] + c2 * b[5] + c3 * b[7];
    // Between the flat sides the light is in a place, never in a wall.
    // In a half-ellipse it keeps clear of the arc: with the walls 4 LEDs out,
    // the curve's top would just touch it.
    let yy = y;
    if (y > YT && y < YB) u = clampTo(S, S.tt < 0.5 ? S.from : S.to, u);
    else {
      const yc = y <= YT ? YT : YB, v = y - yc, E = u * u * IA2 + v * v * IB2;
      if (E > 0.85) {
        const q = sqrt(0.85 / E);
        u *= q;
        yy = yc + v * q;
      }
    }
    S.lu = u;
    S.ly = yy;
    if (S.tt >= 1) {
      S.mode = 0;
      S.region = S.to;
      S.tau = 0;
      S.stay = S.region === 0 ? 5 + 3 * Math.random() : 7 + 3 * Math.random();
    }
  }

  // The light fades over about a sixth of a second, so a place goes dark
  // soon after the light has left it.
  const buf = S.buf, kb = S.kb, fade = exp(-d / 0.16);
  for (let i = 0; i < N; i++) {
    buf[i] *= fade;
    kb[i] *= fade;
  }
  trace(S, d * 30);
  // Exposure follows the mean of the lit LEDs over about half a second, the
  // way an eye adjusts, so a chamber, where every ray soon hits a wall and
  // loses 40% of its light, glows about as bright as the corridor.
  let sum = 0, n = 0;
  for (let i = 0; i < N; i++)
    if (buf[i] > 0.5) {
      sum += buf[i];
      n++;
    }
  const m = n ? sum / n : 1;
  S.expo = S.expo > 0 ? S.expo + (m - S.expo) * (1 - exp(-d / 0.5)) : m;
}

// Rays leave the light evenly spaced round the circle, the whole fan turned
// by a random angle each frame, and bounce off the mirrors; each reflection
// keeps 60% of the light, so the first few reflections draw the shapes and
// the later ones fill in. A ray's path is added to the buffer one LED step at
// a time, so a pixel gathers light in proportion to the rays crossing it.
function trace(S, gain) {
  const nb = S.nb, R = cl(floor(4200 / (nb + 1)), 120, 300), w = S.w, buf = S.buf, kb = S.kb;
  const phase = Math.random(), w0 = (gain * 0.5 * 300) / R;
  for (let r = 0; r < R; r++) {
    const th = (2 * PI * (r + phase)) / R;
    let u = S.lu, y = S.ly, dx = cos(th), dy = sin(th), wt = w0;
    for (let k = 0; k <= nb; k++) {
      let best = 1e9, kind = 0, nx = 0, ny = 0;
      // The two arcs: an ellipse counts as a mirror only on its own side of
      // its flat side, which is open to the room between them.
      for (let e = 0; e < 2; e++) {
        const yc = e ? YB : YT, v = y - yc;
        const qa = dx * dx * IA2 + dy * dy * IB2, qb = 2 * (u * dx * IA2 + v * dy * IB2), qc = u * u * IA2 + v * v * IB2 - 1;
        const disc = qb * qb - 4 * qa * qc;
        if (disc <= 0) continue;
        const sq = sqrt(disc);
        for (let j = 0; j < 2; j++) {
          const t = (-qb + (j ? sq : -sq)) / (2 * qa);
          if (t <= EPS || t >= best) continue;
          const hy = y + dy * t;
          if (e ? hy >= YB : hy <= YT) {
            best = t;
            kind = 1;
            nx = (u + dx * t) * IA2;
            ny = (hy - yc) * IB2;
            break;
          }
        }
      }
      // The outer walls and the two thin corridor walls, mirrors on both sides.
      if (dx !== 0)
        for (let j = 0; j < 4; j++) {
          const X = j === 0 ? A : j === 1 ? -A : j === 2 ? w : -w, t = (X - u) / dx;
          if (t <= EPS || t >= best) continue;
          const hy = y + dy * t;
          if (hy >= YT && hy <= YB) {
            best = t;
            kind = 2;
          }
        }
      if (kind === 0) break;
      const u1 = u + dx * best, y1 = y + dy * best;
      const n = floor(best) + 1, sx = (dx * best) / n, sy = (dy * best) / n, ww = (wt * best) / n;
      let px = CX + u + sx * 0.5, py = y + sy * 0.5;
      for (let i = 0; i < n; i++) {
        const ix = px | 0, iy = py | 0;
        if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
          buf[iy * W + ix] += ww;
          kb[iy * W + ix] += ww * k;
        }
        px += sx;
        py += sy;
      }
      u = u1;
      y = y1;
      if (kind === 2) dx = -dx;
      else {
        const q = (2 * (dx * nx + dy * ny)) / (nx * nx + ny * ny);
        dx -= q * nx;
        dy -= q * ny;
      }
      wt *= REFL;
    }
  }
}

// The walls as one-LED lines, anti-aliased by distance: the arcs, the outer
// walls and the two corridor walls from focus to focus (or wherever Offset
// has moved them).
function buildWalls(S) {
  const wall = S.wall, w = S.w;
  for (let py = 0, i = 0; py < H; py++)
    for (let px = 0; px < W; px++, i++) {
      const u = px + 0.5 - CX, y = py + 0.5, au = abs(u);
      let dmin = 9;
      if (y <= YT || y >= YB) {
        const v = y - (y <= YT ? YT : YB);
        const E = u * u * IA2 + v * v * IB2, g = 2 * sqrt(u * u * IA2 * IA2 + v * v * IB2 * IB2);
        dmin = abs(E - 1) / max(g, 1e-6);
        dmin = min(dmin, sqrt((au - w) * (au - w) + v * v));
      } else dmin = min(abs(au - A), abs(au - w));
      wall[i] = cl(1 - dmin, 0, 1);
    }
  S.wallW = w;
}

// A soft blur, 1 4 6 4 1 across and then down, about an LED wide, so the
// rays glow instead of drawing hard lines and the edge of the light steps
// down by under 40 levels a LED.
function blur(src, out, tmp) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++)
      tmp[o + x] = (src[o + max(0, x - 2)] + 4 * src[o + max(0, x - 1)] + 6 * src[o + x] + 4 * src[o + min(W - 1, x + 1)] + src[o + min(W - 1, x + 2)]) / 16;
  }
  for (let y = 0; y < H; y++) {
    const o0 = max(0, y - 2) * W, o1 = max(0, y - 1) * W, o2 = y * W, o3 = min(H - 1, y + 1) * W, o4 = min(H - 1, y + 2) * W;
    for (let x = 0; x < W; x++) out[o2 + x] = (tmp[o0 + x] + 4 * tmp[o1 + x] + 6 * tmp[o2 + x] + 4 * tmp[o3 + x] + tmp[o4 + x]) / 16;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.wallW !== S.w) buildWalls(S);
  const hz = S.hz, kz = S.kz, wall = S.wall, col = S.col;
  blur(S.buf, hz, S.tmp);
  blur(S.kb, kz, S.tmp);
  // Colour by how many mirrors the light has met: the direct light is a pale
  // tint of the hue, and each reflection turns it a little further round the
  // wheel and deeper, a sixth of a turn by the fifth.
  // Round orange, yellow and yellow-green, 0.03 to 0.29 on the wheel, the
  // colour goes paler so the dimmer far light reads as butter, not olive.
  const h = S.hue + 0.5;
  for (let j = 0; j < 16; j++) {
    const f = 1 - exp(-j / 3), hj = h + 0.17 * f, hf = hj - floor(hj);
    const mud = cl((hf - 0.01) / 0.04, 0, 1) * cl((0.33 - hf) / 0.06, 0, 1);
    hsv(hj, (0.18 + 0.62 * f) * (1 - 0.6 * mud), 1, col, j * 3);
  }
  hsv(h + 0.27, 0.45, 34, col, 48);
  const lx = CX + S.lu, ly = S.ly, ie = 1 / max(1, S.expo);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const L = hz[i], v = min(1, LEVEL * Math.pow(L * ie, GAMMA));
      // The mean number of reflections here, read between two palette steps.
      const kb = L > 1e-4 ? min(14.99, kz[i] / L) : 0, j = floor(kb), f = kb - j, o = j * 3;
      const ddx = x + 0.5 - lx, ddy = y + 0.5 - ly, core = 255 * exp(-(ddx * ddx + ddy * ddy) / 1.1);
      // A wall is a dim line in the dark and a darker line across the glow,
      // a mirror seen edge on, so it never stands 40 levels off its sides.
      const wv = wall[i], g = 255 * v * (1 - 0.5 * wv);
      const r = g * (col[o] + (col[o + 3] - col[o]) * f) + wv * col[48] + core;
      const gg = g * (col[o + 1] + (col[o + 4] - col[o + 1]) * f) + wv * col[49] + core;
      const b = g * (col[o + 2] + (col[o + 5] - col[o + 2]) * f) + wv * col[50] + core;
      display.setPixel(x, y, min(255, r), min(255, gg), min(255, b));
    }
}
