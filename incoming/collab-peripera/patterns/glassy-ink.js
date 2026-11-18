// ===== Patternflow pattern =====
// Title:   Glassy Ink
// Family:  cosmetic
// Idea:    Seen from straight above, a shallow pool of watery tint over a milky base, its surface never still: long swells and short ripples cross it from changing directions, drops of a second shade land and ring outward, and the light over it lies on every slope as the clear wet shine the brand calls 물먹광, deep and rich in the troughs and pale on the crests.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, collab reference for PERIPERA, after the Ink Mood Glowy Tint's "맑은 물먹 광택" (a clear, water-soaked gloss)
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ripple=0.2..3, Swell=0..1, Pearl=0..1
//
// Knob 1: Hue. The tint, round the colour wheel; at 0 it is a rosy pink with drops of coral landing in it, and the second shade always sits a little warmer than the first.
// Knob 2: Ripple. How hard the surface moves: at 2 the swells roll by in a few seconds and a drop lands every second or so; at 0.2 the pool barely breathes and drops are rare.
// Knob 3: Swell. The size of the waves, from ripples about twenty LEDs from crest to crest at 0 to long swells half the panel long at 1.
// Knob 4: Pearl. Fine pearl in the tint: at 0 it is a clear gloss with only the broad shine, at 1 tiny glints flash all over the slopes and the shine takes a faint rainbow edge.
// Buttons: K1 tap drops a ring of coral into the middle of the pool.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp, sin, cos, pow, log, abs, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const NW = 8, MAXD = 10;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const S = {
    // The waves: a share of the wave number, a heading that drifts on a
    // rate of its own, a phase. The frequency comes from the dispersion of
    // water waves (gravity plus surface tension), so no two waves keep step.
    wk: F(NW), wa: F(NW), wr: F(NW), wp: F(NW), wpos: F(NW),
    // Drops: centre, age, strength, and how far each has spread its shade.
    dx: F(MAXD), dy: F(MAXD), dage: F(MAXD), damp: F(MAXD), nd: 0,
    // Each LED's facet for the pearl: a heading and the rate it turns at.
    fa: F(W * H), fw: F(W * H),
    // How much of the second shade each LED holds; drops add it, it fades.
    mix: F(W * H),
    clock: 0, hue: 0, rip: 2, swell: 0, pearl: 0.06, owed: 0,
    c1: F(3), c2: F(3), o: F(3),
  };
  for (let j = 0; j < NW; j++) {
    S.wk[j] = 0.5 + 0.95 * (j / (NW - 1)) + 0.12 * rnd();
    S.wa[j] = rnd() * 2 * PI;
    S.wr[j] = (0.02 + 0.05 * rnd()) * (rnd() < 0.5 ? -1 : 1);
    S.wp[j] = rnd() * 2 * PI;
  }
  for (let p = 0; p < W * H; p++) {
    S.fa[p] = rnd() * 2 * PI;
    S.fw[p] = (0.6 + 1.8 * rnd()) * (rnd() < 0.5 ? -1 : 1);
  }
  params.s = S;
}

function drop(S, x, y, amp) {
  if (S.nd >= MAXD) {
    // The oldest ring gives way.
    let oldest = 0;
    for (let i = 1; i < S.nd; i++) if (S.dage[i] > S.dage[oldest]) oldest = i;
    S.nd--;
    S.dx[oldest] = S.dx[S.nd];
    S.dy[oldest] = S.dy[S.nd];
    S.dage[oldest] = S.dage[S.nd];
    S.damp[oldest] = S.damp[S.nd];
  }
  const i = S.nd++;
  S.dx[i] = x;
  S.dy[i] = y;
  S.dage[i] = 0;
  S.damp[i] = amp;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.rip = cl(k[1], 0.2, 3);
  S.swell = cl(k[2], 0, 1);
  S.pearl = cl(k[3], 0, 1);
  const st = d * (0.25 + 0.5 * S.rip);
  S.clock += st;
  // Each wave runs at the speed water waves of its length run at: deep
  // water, gravity and surface tension, in panel units.
  const base = (2 * PI) / (24 + 44 * S.swell * S.swell);
  for (let j = 0; j < NW; j++) {
    const kk = base * S.wk[j];
    const om = sqrt(0.9 * kk + 9 * kk * kk * kk) * 3.2;
    S.wpos[j] += om * st;
    S.wa[j] += S.wr[j] * st;
  }
  if (!S.warm) {
    for (let i = 0; i < 4; i++) drop(S, rnd() * W, rnd() * H, 0.7 + 0.3 * rnd());
    for (let i = 0; i < S.nd; i++) S.dage[i] = rnd() * 3;
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) drop(S, W / 2, H / 2, 1.4);
  S.owed += d * 0.45 * S.rip;
  while (S.owed > 1) {
    S.owed -= 1;
    drop(S, 4 + rnd() * (W - 8), 4 + rnd() * (H - 8), 0.6 + 0.5 * rnd());
  }
  for (let i = S.nd - 1; i >= 0; i--) {
    S.dage[i] += st;
    if (S.dage[i] > 9) {
      S.nd--;
      S.dx[i] = S.dx[S.nd];
      S.dy[i] = S.dy[S.nd];
      S.dage[i] = S.dage[S.nd];
      S.damp[i] = S.damp[S.nd];
    }
  }
  // The second shade a drop brings spreads with its ring and slowly mixes in.
  const mix = S.mix, fade = exp(-st * 0.16);
  for (let p = 0; p < W * H; p++) mix[p] *= fade;
  for (let i = 0; i < S.nd; i++) {
    const R = 3 + 9 * S.dage[i], wgt = st * 0.9 * S.damp[i] * exp(-S.dage[i] * 0.35);
    const x0 = max(0, floor(S.dx[i] - R)), x1 = min(W - 1, floor(S.dx[i] + R));
    const y0 = max(0, floor(S.dy[i] - R)), y1 = min(H - 1, floor(S.dy[i] + R));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const rr = sqrt((x - S.dx[i]) ** 2 + (y - S.dy[i]) ** 2) / R;
        if (rr < 1) mix[y * W + x] = min(1, mix[y * W + x] + wgt * (1 - rr * rr));
      }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c1 = S.c1, c2 = S.c2, o = S.o;
  hsv(0.94 + S.hue, 0.5, 1, c1);
  hsv(0.978 + S.hue, 0.52, 1, c2);
  const base = (2 * PI) / (24 + 44 * S.swell * S.swell);
  const amp = 0.55 + 0.35 * cl((S.rip - 0.2) / 2.8, 0, 1);
  const cx = new Float32Array(NW), cy = new Float32Array(NW), kk = new Float32Array(NW), aa = new Float32Array(NW);
  for (let j = 0; j < NW; j++) {
    kk[j] = base * S.wk[j];
    cx[j] = cos(S.wa[j]) * kk[j];
    cy[j] = sin(S.wa[j]) * kk[j];
    // Shorter waves are lower, as on water: amplitude by wave number^-1,
    // so every Swell setting has slopes of about the same steepness.
    aa[j] = (amp / (S.wk[j] * base)) * 0.42 * ((2 * PI) / 24);
  }
  // The shine is the reflection of a long soft window over the pool. A ray
  // reflected off the surface sees the window when its sideways part lands
  // inside an ellipse; the edge is soft but short, which is what makes a wet
  // gloss read as wet. The window turns and slides slowly on two rates.
  const la = 2.2 + 0.7 * sin(S.clock * 0.091) + 0.35 * sin(S.clock * 0.037 + 2);
  const wx = cos(la) * 0.24, wy = sin(la) * 0.24;
  const ux = cos(la + PI / 2), uy = sin(la + PI / 2);
  // Long swells bend gently, so the same window would light whole hillsides
  // of them: it shrinks with the wave length.
  const ws = pow(base / ((2 * PI) / 24), 0.35);
  const wa2 = (0.075 * ws) ** 2, wb2 = ((0.26 + 0.08 * S.pearl) * ws) ** 2;
  const glints = S.pearl;
  const T = S.clock;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let h = 0, hx = 0, hy = 0;
      for (let j = 0; j < NW; j++) {
        const ph = cx[j] * x + cy[j] * y - S.wpos[j] + S.wp[j];
        const s = sin(ph), c = cos(ph);
        h += aa[j] * s;
        hx += aa[j] * c * cx[j];
        hy += aa[j] * c * cy[j];
      }
      for (let i = 0; i < S.nd; i++) {
        const ddx = x - S.dx[i], ddy = y - S.dy[i];
        const r = sqrt(ddx * ddx + ddy * ddy) + 1e-3;
        const front = r - 2 - 10 * S.dage[i];
        const env = exp(-(front * front) / 22) * S.damp[i] * exp(-S.dage[i] * 0.42) * 1.3;
        if (env < 0.003) continue;
        const ph = front * 0.9;
        h += env * sin(ph);
        const dr = env * 0.9 * cos(ph);
        hx += (dr * ddx) / r;
        hy += (dr * ddy) / r;
      }
      // The surface normal, from the slope.
      let nx = -hx * 1.7, ny = -hy * 1.7, nz = 1;
      const nl = 1 / sqrt(nx * nx + ny * ny + nz * nz);
      nx *= nl;
      ny *= nl;
      nz *= nl;
      // Looking straight down, the reflected ray is 2 nz n - (0,0,1).
      const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
      // Across the window (along its heading) and along it.
      const ax = rx - wx, ay = ry - wy;
      const across = ax * cos(la) + ay * sin(la), along = ax * ux + ay * uy;
      const q = (across * across) / wa2 + (along * along) / wb2;
      const s1 = q < 2.4 ? (1 - q / 2.4) ** 1.5 * 1.25 : 0;
      // A dim second window on the other side, for the far slopes.
      const bx = rx + wx * 1.4, by = ry + wy * 1.4;
      const s2 = exp(-(bx * bx + by * by) / 0.012) * 0.35;
      const fres = 0.04 + 0.96 * pow(1 - nz, 5);
      void rz;
      // The tint in the pool: light passes down through it to the milky base
      // and back, so the deeper the trough the richer the colour.
      const p = y * W + x, m = S.mix[p];
      const depth = cl(1.0 - (0.5 * h * base) / ((2 * PI) / 24), 0.45, 1.6);
      for (let ch = 0; ch < 3; ch++) {
        const tint = c1[ch] * (1 - m) + c2[ch] * m;
        const absorb = -log(0.08 + 0.92 * tint);
        o[ch] = 0.95 * exp(-absorb * depth * 0.85);
      }
      // Pearl: each LED is a tiny flake turning slowly; it flashes when it
      // faces the window.
      let g = 0;
      if (glints > 0.01) {
        const fa = S.fa[p] + S.fw[p] * T;
        const face = cos(fa - la) * 0.5 + 0.5;
        g = pow(face, 90) * glints * 1.1;
      }
      // A faint rainbow edge on the shine at high Pearl.
      const edge = glints * (q > 0.8 && q < 1.9 ? 1 - abs(q - 1.35) / 0.55 : 0);
      const sh = s1 * 0.85 + s2;
      const env = 0.55 + 0.25 * ry;
      const r = o[0] * (1 - fres) + env * fres + sh + g + edge * 0.05;
      const gg = o[1] * (1 - fres) + env * fres + sh + g + edge * 0.3;
      const b = o[2] * (1 - fres) + env * fres * 1.05 + sh + g + edge * 0.55;
      display.setPixel(x, y, round(cl(r, 0, 1) * 255), round(cl(gg, 0, 1) * 255), round(cl(b, 0, 1) * 255));
    }
  }
}
