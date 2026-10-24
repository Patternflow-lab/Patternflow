// ===== Patternflow pattern =====
// Title:   Sugar Scrub
// Family:  cosmetic
// Idea:    Sugar crystals sit in a tinted oil balm over the whole panel while an unseen fingertip rubs slow circles through it: the grains it reaches roll along with it and flash when a facet turns to the light, the ones under it melt smaller, the oil it leaves behind spreads into a glossy film, and every ten seconds a fresh spoonful lands as a heap.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 32, after the sugar body scrub
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Grain=-1..1, Oil=-1..1
//
// Knob 1: Hue. The tint of the balm, once round the wheel; the crystals stay nearly white with a trace of it. At 0 rose, at 0.12 honey gold, at 0.3 matcha green, at 0.45 jade, at 0.7 periwinkle and at 0.85 orchid.
// Knob 2: Speed. At 2 the fingertip goes round a circle 26 LEDs across every 4.5 seconds while the circle drifts up and down the panel every 35, the light over the balm swings to and fro every 15, and a spoonful lands every 10; at 0.2 all of it runs ten times slower, at 3 half as fast again. Grains the fingertip drags flash several times a second; resting ones about once in 9 seconds at 2.
// Knob 3: Grain. The size of the crystals, every one on the panel at once. At -1 caster sugar, single LEDs, a few thousand of them; at 0 about 2 LEDs across; at 1 coarse crystals 3 LEDs across whose flash throws a cross with arms two LEDs long. Their number changes so they cover the same share of the balm.
// Knob 4: Oil. How much oil there is. At -1 a dry heap: grains cover three quarters of the panel, the balm between them is matte and they melt slowly. At the start they cover a quarter and the balm is half wet; at 1 a few grains are left in a smooth glossy oil and melt seven times faster under the fingertip than at -1.
// Buttons: K1 tap drops a fresh spoonful at once on the emptiest spot away from the fingertip.

const W = 64, H = 128, N = W * H, MAXG = 3200;
const { floor, sqrt, exp, sin, cos, min, max, abs, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// Smooth value noise with a lattice cell LEDs wide, for the balm's relief.
function valueNoise(cell) {
  const gw = floor(W / cell) + 2, gh = floor(H / cell) + 2, g = new Float32Array(gw * gh), out = new Float32Array(N);
  for (let i = 0; i < g.length; i++) g[i] = random();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fx = x / cell, fy = y / cell, ix = floor(fx), iy = floor(fy);
      let tx = fx - ix, ty = fy - iy;
      (tx = tx * tx * (3 - 2 * tx)), (ty = ty * ty * (3 - 2 * ty));
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      out[y * W + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  return out;
}

export function setup(params) {
  const n1 = valueNoise(9), n2 = valueNoise(3.5), N0 = new Float32Array(N);
  for (let i = 0; i < N; i++) N0[i] = 0.65 * n1[i] + 0.35 * n2[i];
  params.s = {
    t: 0, hue: NaN, speed: 2, grain: 0, oil: 0.53,
    S: Float32Array.from(N0), S2: new Float32Array(N), N0, G: new Float32Array(N), G2: new Float32Array(N),
    gx: new Float32Array(MAXG), gy: new Float32Array(MAXG), vx: new Float32Array(MAXG), vy: new Float32Array(MAXG),
    gs: new Float32Array(MAXG), ph: new Float32Array(MAXG), tx: new Float32Array(MAXG), ty: new Float32Array(MAXG), fall: new Uint8Array(MAXG), tint: new Float32Array(MAXG),
    n: 0, filled: false, spoon: 3, goal: 0, queue: 0, fx: 0, fy: 0, fvx: 0, fvy: 0,
    col: new Float32Array(12), img: new Float32Array(N * 3),
  };
}

// The fingertip: circles of radius 13 at 0.7 rad a unit of time, round a
// centre that wanders up and down most of the panel.
function finger(t) {
  const a = 0.7 * t, cx = 32 + 6 * sin(0.11 * t), cy = 64 + 36 * sin(0.09 * t - 2.6), r = 13 + 2 * sin(0.23 * t);
  return [cx + r * cos(a), cy + r * sin(a)];
}

const meanR = (P) => 0.95 + 0.55 * P.grain;
const target = (P) => {
  const o = P.oil, cov = 0.72 * (1 - o) ** 1.6 + 0.03, r = meanR(P);
  return min(MAXG, floor((cov * N) / (PI * r * r)));
};

function addGrain(P, x, y, cx, cy) {
  if (P.n >= MAXG) return;
  // A grain keeps its size as a share of the mean, so Grain resizes every
  // grain on the panel at once.
  const i = P.n++;
  P.gs[i] = 0.55 + 0.9 * random();
  P.ph[i] = random() * 2 * PI;
  P.tint[i] = random();
  (P.vx[i] = 0), (P.vy[i] = 0);
  if (cx !== undefined) {
    // Part of a spoonful: it starts in the heap's tight middle and is thrown
    // out to where it lands.
    (P.gx[i] = cx + (x - cx) * 0.25), (P.gy[i] = cy + (y - cy) * 0.25);
    (P.tx[i] = x), (P.ty[i] = y), (P.fall[i] = 1);
  } else (P.gx[i] = x), (P.gy[i] = y), (P.fall[i] = 0);
}

function kill(P, i) {
  const j = --P.n;
  for (const a of [P.gx, P.gy, P.vx, P.vy, P.gs, P.ph, P.tx, P.ty, P.fall, P.tint]) a[i] = a[j];
}

// A spoonful lands on the emptiest of five spots that are well clear of the
// fingertip: a round heap 26 LEDs across, densest in the middle.
function spoonful(P) {
  let best = -Infinity, bx = 32, by = 30;
  for (let c = 0; c < 5; c++) {
    const x = 14 + random() * 36, y = 14 + random() * (H - 28);
    if (Math.hypot(x - P.fx, y - P.fy) < 30) continue;
    let near = 0;
    for (let i = 0; i < P.n; i += 3) if (abs(P.gx[i] - x) < 12 && abs(P.gy[i] - y) < 12) near++;
    const score = -near + random();
    if (score > best) (best = score), (bx = x), (by = y);
  }
  const m = floor(target(P) * 0.22) + 60;
  for (let k = 0; k < m; k++) {
    const a = random() * 2 * PI, rr = random() ** 0.75;
    addGrain(P, cl(bx + cos(a) * rr * 13, 0, W - 1), cl(by + sin(a) * rr * 13, 0, H - 1), bx, by);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.grain = cl(k[2], -1, 1);
  P.oil = (cl(k[3], -1, 1) + 1) / 2;
  // A turn of Grain or Oil changes how many grains the balm should hold:
  // the difference is sprinkled on or melted away, 60 grains a frame.
  const goal = target(P);
  if (P.filled && goal !== P.goal) (P.queue += goal - P.goal), (P.goal = goal);
  if (P.queue > 0) {
    const m = min(60, P.queue);
    for (let i = 0; i < m; i++) addGrain(P, random() * W, random() * H);
    P.queue -= m;
  } else if (P.queue < 0) {
    const m = min(60, -P.queue, P.n);
    for (let i = 0; i < m; i++) kill(P, floor(random() * P.n));
    P.queue += m;
  }
  if (!P.filled) {
    // The jar has been in use a while: twelve seconds of rubbing at Speed 2
    // run before the first frame, so the panel opens on swirled tracks, a
    // heap or two and ridges of pushed grains, with the next spoonful due
    // in three seconds.
    const m = (P.goal = target(P));
    for (let i = 0; i < m; i++) addGrain(P, random() * W, random() * H);
    for (let i = 0; i < 120; i++) step(P, 0.1, 2, false);
    P.filled = true;
    P.spoon = 3;
  }
  step(P, d, P.speed, input.btnPressed && input.btnPressed[0]);
}

function step(P, d, sp, press) {
  P.t += d * sp;
  const [fx, fy] = finger(P.t), [px, py] = finger(P.t - 0.05);
  (P.fx = fx), (P.fy = fy), (P.fvx = ((fx - px) / 0.05) * sp), (P.fvy = ((fy - py) / 0.05) * sp);
  if (press) spoonful(P);
  P.spoon -= d * sp * 0.5;
  if (P.spoon <= 0 || P.n < target(P) * 0.35) (P.spoon = 10), spoonful(P);

  // The oil the fingertip drags: its own velocity under the pad, falling off
  // over 5 LEDs, and a push out from under it.
  const sig2 = 2 * 5 * 5, oil = P.oil;
  const vel = (x, y, out) => {
    const dx = x - fx, dy = y - fy, r2 = dx * dx + dy * dy;
    if (r2 > 400) return (out[0] = 0), (out[1] = 0), 0;
    const e = exp(-r2 / sig2), r = sqrt(r2) + 0.5, push = 1.5 * sp * e;
    out[0] = P.fvx * e * 0.8 + (push * dx) / r;
    out[1] = P.fvy * e * 0.8 + (push * dy) / r;
    return e;
  };
  const v = [0, 0];

  // Grains trail the oil and roll; under the pad they melt.
  const melt = 0.05 + 0.32 * oil, mr = meanR(P);
  for (let i = 0; i < P.n; i++) {
    if (P.fall[i]) {
      const u = min(1, d * 9);
      P.gx[i] += (P.tx[i] - P.gx[i]) * u;
      P.gy[i] += (P.ty[i] - P.gy[i]) * u;
      if (abs(P.tx[i] - P.gx[i]) + abs(P.ty[i] - P.gy[i]) < 0.1) P.fall[i] = 0;
      P.ph[i] += d * 6;
      continue;
    }
    const e = vel(P.gx[i], P.gy[i], v), lag = min(1, d * 7);
    // Grains in the flow knock into each other and scatter a little.
    const jit = e > 0.1 ? 14 * e * sp * d : 0;
    P.vx[i] += (v[0] - P.vx[i]) * lag + jit * (random() - 0.5) * 4;
    P.vy[i] += (v[1] - P.vy[i]) * lag + jit * (random() - 0.5) * 4;
    P.gx[i] = cl(P.gx[i] + P.vx[i] * d, 0, W - 0.01);
    P.gy[i] = cl(P.gy[i] + P.vy[i] * d, 0, H - 0.01);
    const s = abs(P.vx[i]) + abs(P.vy[i]);
    P.ph[i] += d * (0.35 * sp + (s * 1.3) / (P.gs[i] * mr));
    if (e > 0.05) P.gs[i] -= (d * melt * e) / mr;
    if (P.gs[i] < 0.35) kill(P, i--);
  }

  // The balm: its texture is carried by the same flow and slowly settles
  // back; the gloss is laid down under the pad, spreads and dries.
  const S = P.S, S2 = P.S2, G = P.G, G2 = P.G2, N0 = P.N0;
  const back = d * 0.04, dry = d * (0.12 - 0.08 * oil), lay = d * 1.6, spread = min(0.24, 1.5 * d);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, e = vel(x, y, v);
      let s = S[i];
      if (e > 0.002) {
        const sx = cl(x - v[0] * d, 0, W - 1.001), sy = cl(y - v[1] * d, 0, H - 1.001), ix = sx | 0, iy = sy | 0, tx = sx - ix, ty = sy - iy, j = iy * W + ix;
        s = S[j] * (1 - tx) * (1 - ty) + S[j + 1] * tx * (1 - ty) + S[j + W] * (1 - tx) * ty + S[j + W + 1] * tx * ty;
      }
      S2[i] = s + (N0[i] - s) * back;
      const l = x > 0 ? G[i - 1] : G[i], r = x < W - 1 ? G[i + 1] : G[i], u = y > 0 ? G[i - W] : G[i], b = y < H - 1 ? G[i + W] : G[i];
      G2[i] = min(1, G[i] + (l + r + u + b - 4 * G[i]) * spread - G[i] * dry + lay * e);
    }
  (P.S = S2), (P.S2 = S), (P.G = G2), (P.G2 = G);
}


export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { S, G, img, col } = P, oil = P.oil, h = P.hue + 0.955, mr = meanR(P);
  // Dry balm, wet oil, the crystal body and the sheen.
  hsv(h, 0.42, 0.84, col, 0);
  hsv(h + 0.015, 0.74, 0.64, col, 3);
  // The light comes from the upper left and swings slowly to and fro, so
  // the sheen slides over the balm even where the fingertip is not.
  const la = -2.2 + 0.5 * sin(P.t * 0.21), LX = 0.75 * cos(la), LY = 0.75 * sin(la), LZ = 0.66;
  const HL = sqrt(LX * LX + LY * LY + (LZ + 1) * (LZ + 1)), HX = LX / HL, HY = LY / HL, HZ = (LZ + 1) / HL;
  hsv(h - 0.02, 0.09, 1, col, 6);
  hsv(h - 0.03, 0.1, 1, col, 9);
  // More oil: a wetter, smoother balm.
  const base = 0.2 + 0.55 * oil, sh = 3.2 * (1 - 0.65 * oil);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wet = min(1, base + G[i]);
      const hx = sh * ((x < W - 1 ? S[i + 1] : S[i]) - (x > 0 ? S[i - 1] : S[i])) + 2 * ((x < W - 1 ? G[i + 1] : G[i]) - (x > 0 ? G[i - 1] : G[i]));
      const hy = sh * ((y < H - 1 ? S[i + W] : S[i]) - (y > 0 ? S[i - W] : S[i])) + 2 * ((y < H - 1 ? G[i + W] : G[i]) - (y > 0 ? G[i - W] : G[i]));
      const nl = 1 / sqrt(hx * hx + hy * hy + 1), nx = -hx * nl, ny = -hy * nl, nz = nl;
      const dif = 0.8 + 0.35 * (nx * LX + ny * LY + nz * LZ - 0.7);
      // A sharp sheen on the balm's relief, and over the oil the fingertip
      // laid down a broad film of light.
      const nh = max(0, nx * HX + ny * HY + nz * HZ), spec = (nh ** 60 * 1.3 + nh ** 6 * 0.18) * wet + G[i] * (0.1 + 0.5 * nh ** 10);
      const tex = 0.88 + 0.26 * (S[i] - 0.5);
      for (let c = 0; c < 3; c++) {
        const b = (col[c] + (col[3 + c] - col[c]) * wet) * dif * tex;
        img[i * 3 + c] = b + (col[9 + c] - b) * min(1, spec);
      }
    }
  // The grains: a shadow down and right, a body lit from the upper left,
  // and a flash when a facet turns to the light.
  for (let k = 0; k < P.n; k++) {
    const gx = P.gx[k], gy = P.gy[k], r = P.gs[k] * mr, ph = P.ph[k];
    const gl = max(0, cos(ph)) ** 24, x0 = floor(gx - r - 1), x1 = floor(gx + r + 1), y0 = floor(gy - r - 1), y1 = floor(gy + r + 1);
    const wetHere = min(1, base + G[cl(floor(gy), 0, H - 1) * W + cl(floor(gx), 0, W - 1)]);
    const op = 0.96 - 0.4 * wetHere, tv = 0.86 + 0.14 * P.tint[k];
    for (let y = max(0, y0); y <= min(H - 1, y1); y++)
      for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
        const dx = x + 0.5 - gx, dy = y + 0.5 - gy, dd = sqrt(dx * dx + dy * dy), cov = cl(r + 0.6 - dd, 0, 1);
        const i = (y * W + x) * 3;
        const sdx = dx - 0.8, sdy = dy - 0.8, sc = cl(r + 0.5 - sqrt(sdx * sdx + sdy * sdy), 0, 1) * (1 - cov) * 0.16;
        if (sc > 0) for (let c = 0; c < 3; c++) img[i + c] *= 1 - sc;
        if (cov <= 0) continue;
        const lit = (0.8 + 0.2 * cl(-(dx * 0.6 + dy * 0.8) / max(r, 0.6), -1, 1)) * tv;
        const a = cov * op;
        for (let c = 0; c < 3; c++) img[i + c] += (col[6 + c] * lit - img[i + c]) * a;
        if (gl > 0.02) {
          const f = gl * cov * (dd < 0.8 ? 1 : 0.55);
          for (let c = 0; c < 3; c++) img[i + c] += (255 - img[i + c]) * f;
        }
      }
    // A bright flash throws a short cross.
    if (gl > 0.7 && r > 0.6) {
      const cx = floor(gx), cy = floor(gy), f = (gl - 0.7) * 2, arm = r > 1.1 ? 2 : 1;
      for (let a = 1; a <= arm; a++)
        for (const [ox, oy] of [[a, 0], [-a, 0], [0, a], [0, -a]]) {
          const x = cx + ox, y = cy + oy;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const i = (y * W + x) * 3, ff = f / a;
          for (let c = 0; c < 3; c++) img[i + c] += (255 - img[i + c]) * ff;
        }
    }
  }
  for (let i = 0; i < N; i++) display.setPixel(i % W, (i / W) | 0, min(255, img[i * 3]), min(255, img[i * 3 + 1]), min(255, img[i * 3 + 2]));
}
