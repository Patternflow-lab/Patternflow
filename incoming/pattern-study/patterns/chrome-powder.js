// ===== Patternflow pattern =====
// Title:   Chrome Powder
// Family:  cosmetic
// Idea:    The whole panel is a gel coat dusted with chrome powder; an unseen applicator rubs small circles down it, and where it has been the matte grain turns into a liquid mirror holding the sharp bands of a studio's softboxes over a dark floor, until a light sweeps once over the finished mirror and the next coat goes on from the top.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 32, after chrome powder buffed onto a gel top coat and the softbox reflections of product photography
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Holo=0..1, Grain=0..1
//
// Knob 1: Hue. The tint of the metal, once round the wheel; the loose powder is a pale grey of the same tint. At 0 rose gold, at 0.08 gold, at 0.3 green chrome, at 0.55 steel blue, at 0.8 lilac.
// Knob 2: Speed. At 2 the applicator rubs nearly five circles a second and crosses the panel in 0.7 seconds, a coat takes 8.5 seconds, the light sweeps for 3 and the next coat dusts on in 1.5, 13 seconds round; the softbox reflections slide about 2.5 LEDs a second. At 0.2 all of it a tenth as fast.
// Knob 3: Holo. At 0 a plain metal mirror in the tint. Turned up, the tint gives way to aurora chrome, a colour that turns with the angle of the surface through violet, blue and aqua, and every grain of the loose powder carries a colour of its own.
// Knob 4: Grain. The loose powder's grain: single LEDs at 0, 2 LEDs across at 0.5, 3.5 at 1, with sparkling grains going from 1.5% to 3.5%. It also leaves clumps of powder on the finished mirror, faint at 0.06 and over about a sixth of the mirror at 1.
// Buttons: K1 tap dusts a new coat on from the top down at once, and the applicator starts again from the top.

const W = 64, H = 128, N = W * H;
const { floor, sin, cos, sqrt, exp, abs, min, max, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
}

// Smooth value noise on a coarse grid of random numbers, sampled per LED.
function field(cell, amp) {
  const gw = floor(W / cell) + 3, gh = floor(H / cell) + 3, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = random() * 2 - 1;
  const out = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fx = x / cell, fy = y / cell, ix = floor(fx), iy = floor(fy);
      let tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx);
      ty = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      out[y * W + x] = amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
    }
  return out;
}

// The coat's surface: bowed across the panel and a little down it, with a
// low waviness of the gel, so the horizon is one wavy line across. Stored as the reflected direction a level eye
// sees in it, rx across and ry down, and a soft light term for the powder.
function surface(P) {
  const w1 = field(22, 1), w2 = field(9, 0.5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const u = (x - 31.5) / 32, v = (y - 63.5) / 64;
      let sx = 0.44 * u + 0.03 * sin(y * 0.07);
      let sy = 0.2 * v + 0.008 * sin(x * 0.24 + y * 0.05);
      const xr = min(x + 1, W - 1), yr = min(y + 1, H - 1);
      sx += 0.09 * (w1[y * W + xr] - w1[i]) * 22 / 4 + 0.05 * (w2[y * W + xr] - w2[i]) * 9 / 4;
      // Down the panel the waviness is kept small so the horizon stays one line.
      sy += 0.015 * (w1[yr * W + x] - w1[i]) * 22 / 4 + 0.01 * (w2[yr * W + x] - w2[i]) * 9 / 4;
      P.rx[i] = 2 * sx;
      P.ry[i] = 2 * sy;
      P.lam[i] = cl(0.78 - 0.5 * sx + 0.35 * sy, 0.35, 1);
    }
}

const edge = (t) => cl(t / 0.025 + 0.5, 0, 1);
const box = (u, a, b, v, c, d) => edge(u - a) * edge(b - u) * edge(v - c) * edge(d - v);

// The studio the mirror sees, the way chrome is shot: a pale sweep of wall,
// lighter towards the horizon, with a tall softbox, black flags beside it
// and two strip lights, all sharp at their edges; below the horizon a dark
// floor with faint copies of the lights. u wraps every 2.4 as the lights
// slide.
const HZ = 0.22;
function env(u, v) {
  u -= 2.4 * floor(u / 2.4 + 0.5);
  if (v > HZ) return 0.1 + 0.05 * (1 - sm(HZ, 0.7, v)) + 0.14 * box(u, -0.18, 0.12, v, HZ, 1) + 0.1 * box(u, 0.45, 0.5, v, HZ, 1);
  let I = (0.56 + 0.22 * sm(-0.8, HZ, v)) * (0.88 + 0.12 * cos(u * 2.6));
  // Black flags: one wide beside the softbox, two narrow further out.
  I *= 1 - 0.94 * box(u, 0.12, 0.3, v, -2, 2);
  I *= 1 - 0.94 * box(u, -0.5, -0.42, v, -2, 2);
  I *= 1 - 0.9 * box(u, 0.7, 0.76, v, -2, 2);
  I += 0.7 * box(u, -0.18, 0.12, v, -2, HZ - 0.06) * (0.85 + 0.15 * cos((u + 0.03) * 10));
  I += 0.6 * box(u, 0.45, 0.5, v, -2, HZ - 0.03);
  I += 0.6 * box(u, -0.66, -0.62, v, -2, HZ - 0.03);
  I += 0.55 * box(u, 0.92, 1.12, v, -0.75, HZ - 0.08);
  I += 0.4 * box(u, -2, 2, v, -0.62, -0.55);
  return I;
}

export function setup(params) {
  const P = {
    T: 0, phase: 0, pt: 0, hue: NaN, holo: 0, grain: 0.06, speed: 2, drift: 0,
    rx: new Float32Array(N), ry: new Float32Array(N), lam: new Float32Array(N),
    B: new Float32Array(N), g1: new Float32Array(N), g2: null, g3: null, clump: null, soft: null, ih: new Float32Array(N), spk: new Float32Array(N), res: new Float32Array(N),
    ax: 32, ay: -8, tint: new Float32Array(3), dust: new Float32Array(3), sweep: -1, recoat: -1,
  };
  surface(P);
  for (let i = 0; i < N; i++) (P.g1[i] = random() * 2 - 1), (P.spk[i] = random()), (P.res[i] = random());
  P.g2 = field(2, 1.3);
  P.g3 = field(3.5, 1.5);
  P.clump = field(2.5, 1);
  P.soft = field(16, 1);
  for (let i = 0; i < N; i++) P.ih[i] = random() * 2 - 1;
  params.s = P;
}

// The applicator: a sponge tip 10 LEDs in radius that rubs circles 5 LEDs
// in radius, a little under four to a crossing so they never line up, while
// it crosses the panel and back and works down it, 12 LEDs a crossing. A
// crossing buffs an LED about two thirds of the way; the next one finishes
// it.
const COAT = 17, SWEEP = 6, RECOAT = 3, R = 10, CROSS = 1.4;
function rub(P, dT) {
  const steps = 6;
  for (let s = 0; s < steps; s++) {
    P.pt += dT / steps;
    const t = P.pt, ph = t / CROSS, tri = 1 - abs(1 - 2 * (ph / 2 - floor(ph / 2))) * 2;
    const a = t * 2 * PI * 2.37;
    const cx = 32 - 38 * tri + 5 * cos(a), cy = -12 + (172 * t) / COAT + 5 * sin(a);
    P.ax = cx;
    P.ay = cy;
    const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R) + 1), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R) + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, d2 = (dx * dx + dy * dy) / (R * R);
        if (d2 >= 1) continue;
        const i = y * W + x;
        P.B[i] = min(1, P.B[i] + 2.4 * (1 - d2 * d2) * (dT / steps) * (0.7 + 0.6 * P.res[i]));
      }
  }
  // It goes back over what it missed: from 18 rows above the tip up, the
  // last patches of powder turn too.
  const yb = min(H, floor(P.ay - 18));
  for (let y = max(0, yb - 24); y < yb; y++) {
    const m = sm(yb, yb - 24, y) * dT * 1.5;
    for (let x = 0, i = y * W; x < W; x++, i++) P.B[i] = min(1, P.B[i] + m);
  }
  for (let i = 0, e = max(0, yb - 24) * W; i < e; i++) P.B[i] = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.speed = cl(k[1], 0.2, 3);
  P.holo = cl(k[2], 0, 1);
  P.grain = cl(k[3], 0, 1);
  const dT = d * P.speed;
  P.T += dT;
  P.drift += dT * 0.035;
  if (input.btnPressed && input.btnPressed[0] && P.phase !== 2) (P.phase = 2), (P.recoat = 0);
  if (P.phase === 0) {
    rub(P, dT);
    if (P.pt >= COAT) {
      P.phase = 1;
      P.sweep = 0;
      P.B.fill(1);
    }
  } else if (P.phase === 1) {
    P.sweep += dT / SWEEP;
    if (P.sweep >= 1) (P.phase = 2), (P.recoat = 0), (P.sweep = -1);
  } else {
    // The new coat is dusted on from the top down.
    P.recoat += dT / RECOAT;
    const fy = -10 + 150 * P.recoat;
    for (let y = 0; y < H; y++) {
      if (y > fy + 6) break;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, e = fy + 5 * P.res[i] - y;
        if (e > 0) P.B[i] = min(P.B[i], max(0, 1 - e / 4));
      }
    }
    if (P.recoat >= 1) {
      P.B.fill(0);
      P.phase = 0;
      P.pt = 0;
      P.recoat = -1;
    }
  }
  if (P.hue !== k[0]) {
    P.hue = k[0];
    hsv(k[0] + 0.025, 0.4, 1, P.tint, 0);
    hsv(k[0] + 0.025, 0.16, 1, P.dust, 0);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { rx, ry, lam, B, g1, g2, g3, spk, tint, dust } = P;
  const gr = P.grain, holo = P.holo, hue = P.hue, du = P.drift;
  const gA = 0.05 + 0.21 * gr, gm2 = sm(0.15, 0.6, gr), gm3 = sm(0.55, 1, gr);
  const sw = P.sweep, c = [0, 0, 0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, b = B[i];
      // The matte powder: a pale tint of the metal, lit softly, with grain.
      let pr = 0, pg = 0, pb = 0;
      // Each grain turns to mirror at its own point in the buffing, so the
      // edge of the mirror is speckled, and powder that has been pressed but
      // not yet turned takes a satin sheen.
      // Turning Grain up also leaves clumps of powder on the finished mirror.
      const th = 0.3 + 0.5 * P.res[i], left = gr * sm(0.35, 0.6, P.clump[i]);
      const mir = sm(th - 0.1, th + 0.1, b) * (1 - 0.75 * left);
      if (mir < 1) {
        const g = g1[i] * (1 - gm2) + g2[i] * gm2 * (1 - gm3) + g3[i] * gm3;
        let v = (0.56 + 0.05 * P.soft[i] + 0.1 * sm(0.03, 0.4, b)) * lam[i] * (1 + gA * g * (1 - 0.6 * sm(0.03, 0.4, b)));
        if (spk[i] > 0.985 - 0.02 * gr) v += 0.12 * (0.5 + 0.5 * sin(P.T * 3 + spk[i] * 400));
        (pr = dust[0] * v), (pg = dust[1] * v), (pb = dust[2] * v);
        if (holo > 0) {
          // Holographic powder: every grain carries its own colour.
          hsv(hue + 0.665 + 0.25 * P.ih[i], 0.55, v * 1.15, c, 0);
          const hm = holo * 0.8;
          (pr += (c[0] - pr) * hm), (pg += (c[1] - pg) * hm), (pb += (c[2] - pb) * hm);
        }
      }
      let mr = 0, mg = 0, mb = 0;
      if (mir > 0) {
        const u = rx[i] + du, v = ry[i];
        let I = env(u, v);
        if (sw >= 0) {
          const p = x * 0.6 + y - (-50 + 230 * sw);
          I += 0.9 * exp(-(p * p) / 60);
        }
        // Silver-bright where the light is strong, the tint in the mids,
        // nearly black in the floor.
        let tr = tint[0], tg = tint[1], tb = tint[2];
        if (holo > 0) {
          // Aurora chrome: the tint gives way to a colour that turns with
          // the angle of the surface, over the cool side of the wheel from
          // the tint, so it runs violet, blue and aqua and never through the
          // olive a dim yellow-green would be.
          const s = sin(2.6 * rx[i] + 5 * ry[i] + 0.7 * sin(y * 0.05) + du * 4);
          hsv(hue + 0.025 + 0.64 + 0.2 * s, 0.5, 1, c, 0);
          (tr += (c[0] - tr) * holo), (tg += (c[1] - tg) * holo), (tb += (c[2] - tb) * holo);
        }
        const hi = sm(0.85, 1.3, I), L = min(1.2, I);
        mr = L * (tr + (1 - tr) * hi);
        mg = L * (tg + (1 - tg) * hi);
        mb = L * (tb + (1 - tb) * hi);
      }
      const r = pr * (1 - mir) + mr * mir, g = pg * (1 - mir) + mg * mir, bl = pb * (1 - mir) + mb * mir;
      display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, bl * 255));
    }
}
