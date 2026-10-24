// ===== Patternflow pattern =====
// Title:   Hair Gloss
// Family:  cosmetic
// Idea:    Long glossy hair hangs the full height of the panel, 230 strands swaying in a light breeze that runs down them, with a white shine band across it where the strands lie square to the half vector and a weaker band in the hair's own colour below it, both sliding up and down as the hair sways; every 9 seconds a comb runs down through it, the strands part round its teeth and lie smoother and shinier behind.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 34, after the shine band of glossy hair in haircare displays; the highlights are a fibre highlight (James Kajiya and Timothy Kay, 1989), the white one shifted toward the root and a tinted one toward the tip (Stephen Marschner and others, 2003)
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wave=0..1, Shine=-1..1
//
// Knob 1: Hue. The hair colour, once round the wheel, while the shine band stays near white and the band below it takes the hair's colour. At 0 violet, at 0.1 orchid, at 0.3 copper, at 0.33 caramel, at 0.36 honey blonde (from 0.25 to 0.47 the hair is lifted so it never reads muddy), at 0.6 green, at 0.7 teal, at 0.85 blue.
// Knob 2: Speed. At 2 the breeze runs a wave down the hair every 4.6 s, swinging the ends up to 4 LEDs, the shine band rises and falls between rows 26 and 60 every 6.5 s, and a comb comes every 9 s and takes 2.4 s to pass; at 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Wave. At 0 the hair is straight and carries one band. Toward 1 it waves, 44 rows a wave and up to 3 LEDs to each side, and each wave catches its own highlight: two bands at 0.5, three or four at 1.
// Knob 4: Shine. How glossy the finish is. At 0 the band is about 9 rows tall; at -1 it is 17 rows and dimmer, with a soft sheen over 50 rows round it, like matte hair; at 1 it is 4 rows and brighter, its edges ragged strand by strand, and the coloured band stands apart below it.
// Buttons: K1 tap sends the comb through now.

const W = 64, H = 128, N = 230, Y0 = -2, ROWS = 160;
const { floor, min, max, sqrt, sin, cos, exp, log, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// Light from above, a little left and in front; the eye straight on. y runs
// down and z comes out of the panel.
const norm3 = (x, y, z) => {
  const l = sqrt(x * x + y * y + z * z);
  return [x / l, y / l, z / l];
};
const [LX, LY, LZ] = norm3(-0.15, -0.55, 0.82);
const [HX, HY, HZ] = norm3(LX, LY, LZ + 1);
// The sheet of hair leans toward the eye by tz per row. The primary highlight
// sits where a strand's tangent is square to the half vector, tz about 0.3.
const TZ0 = -HY / HZ;

// A smooth wobble along one strand: three sines at random pitch.
function wobble(out, o) {
  const f = [0, 0, 0].map(() => (1 / 30 + random() / 40) * 2 * PI), ph = [0, 0, 0].map(() => random() * 2 * PI);
  for (let r = 0; r < ROWS; r++) out[o + r] = (sin(f[0] * r + ph[0]) + 0.6 * sin(0.5 * f[1] * r + ph[1]) + 0.4 * sin(0.3 * f[2] * r + ph[2])) / 1.4;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, wave: 0, shine: 0, begun: false, t: 0,
    comb: -10, combing: false, combWait: 1.2, teeth: 0,
    X0: new Float32Array(N), B: new Float32Array(N), SL: new Float32Array(N), D: new Float32Array(N), END: new Float32Array(N), TO: new Float32Array(N),
    NX: new Float32Array(N * ROWS), NT: new Float32Array(N * ROWS),
    fz: new Float32Array(ROWS).fill(1), part: new Float32Array(ROWS),
    sx: new Float32Array(ROWS), tz: new Float32Array(ROWS), ws: new Float32Array(ROWS), wc: new Float32Array(ROWS),
    acc: new Float32Array(W * H * 3), wt: new Float32Array(W * H), c: [0, 0, 0], body: [0, 0, 0], tint: [0, 0, 0],
  };
  const S = params.s;
  for (let i = 0; i < N; i++) {
    S.X0[i] = -7 + (78 * (i + random())) / N;
    S.B[i] = 0.28 + 0.72 * random() ** 0.6;
    S.TO[i] = (random() - 0.5) * 0.12;
    S.SL[i] = (random() - 0.5) * 0.025;
    S.D[i] = (random() - 0.5) * 0.6;
    S.END[i] = 112 + 40 * random();
    wobble(S.NX, i * ROWS);
    wobble(S.NT, i * ROWS);
  }
}

function step(S, d) {
  const sp = S.speed / 2, ds = d * sp;
  S.t += ds;
  // The comb: every 9 s at Speed 2 it runs down from above the panel to past
  // the ends in 2.4 s. Hair it has passed lies smooth and loosens again over
  // about 6 s; the partings behind its teeth close over about 1.2 s.
  const was = S.comb;
  if (!S.combing) {
    S.combWait -= ds;
    if (S.combWait <= 0) startComb(S);
  } else {
    S.comb += (ds * 170) / 2.4;
    if (S.comb > 160) {
      S.combing = false;
      S.combWait = 6.6;
    }
  }
  for (let r = 0; r < ROWS; r++) {
    const y = r + Y0;
    S.fz[r] += (1 - S.fz[r]) * (1 - exp(-ds / 6));
    S.part[r] *= exp(-ds / 1.2);
    // The teeth bite over the 8 rows behind the comb's edge.
    if (S.combing && y < S.comb) {
      const a = sm(0, 8, S.comb - y);
      S.fz[r] = min(S.fz[r], 1 - 0.55 * a);
      S.part[r] = max(S.part[r], a * (y >= was - 9 ? 1 : 0));
    }
  }
}

function startComb(S) {
  S.combing = true;
  S.comb = -10;
  S.teeth = random() * 7;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.wave = cl(k[2], 0, 1);
  S.shine = cl(k[3], -1, 1);
  if (!S.begun) {
    // Open with the band a third of the way down and rising.
    S.t = 1.5;
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0] && !S.combing) startComb(S);
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { acc, wt, sx, tz, ws, wc, fz, part, NX, NT, X0, B, SL, D, END, c, body, tint } = S;
  acc.fill(0);
  wt.fill(0);
  const t = S.t, wv = S.wave;
  // Per row: the breeze, a wave running down the hair that grows toward the
  // ends; the lean of the sheet, which puts the shine band where tz meets
  // TZ0 and slides it up and down as the hair sways; and the waves of wavy
  // hair, sideways and in depth a quarter turn apart.
  const yb = 46 + 13 * sin(2 * PI * (t / 6.5)) + 4 * sin(2 * PI * (t / 2.9) + 1);
  for (let r = 0; r < ROWS; r++) {
    const y = r + Y0, reach = ((y + 30) / 160) ** 1.6;
    sx[r] = 3.2 * reach * sin(2 * PI * (y / 120 - t / 4.6)) + 1.1 * reach * sin(2 * PI * (y / 45 - t / 2.3) + 2);
    const a = (2 * PI * y) / 44;
    tz[r] = TZ0 + 0.016 * (1 - 0.6 * wv) * (yb - y) + 0.3 * wv * sin(a + 0.6 * sin(2 * PI * (t / 7.3)));
    ws[r] = 3 * wv * cos(a);
    wc[r] = 3 * wv * -sin(a);
  }
  const sh = S.shine, p1 = 0.5 * 320 * 4 ** sh, k1 = 0.9 + 0.4 * sh, p2 = 0.4 * p1, k2 = 0.45 + 0.15 * sh, k0 = 0.24 * (1 - sh);
  const teeth = S.teeth;
  for (let i = 0; i < N; i++) {
    const o = i * ROWS, cd = cos(D[i]), sd = sin(D[i]), end = END[i], b = B[i], to = S.TO[i], x0 = X0[i], sl = SL[i];
    let px = 0;
    const last = min(H - 1, floor(end));
    for (let r = 0; r <= last - Y0; r++) {
      const y = r + Y0, f = fz[r];
      let x = x0 + sl * y + sx[r] + ws[r] * cd + wc[r] * sd + 0.4 * f * NX[o + r];
      // Behind the comb the strands part round its teeth, 7 LEDs apart: each
      // gap of 7 closes to 5.7, leaving a dark parting 1.3 LEDs wide.
      const m = part[r];
      if (m > 0.01) {
        const u = (x - teeth) / 7, e = u - floor(u) - 0.5;
        x -= m * 1.3 * e;
      }
      const tx = x - px;
      px = x;
      if (y < 0) continue;
      const z = tz[r] + to * f + 0.06 * f * NT[o + r];
      const inv = 1 / sqrt(tx * tx + 1 + z * z);
      const th = (tx * HX + HY + z * HZ) * inv;
      // The primary highlight is shifted toward the root, the secondary,
      // tinted by the hair, toward the tip.
      const t1 = th - 0.05, t2 = th + 0.11;
      const smooth = 1 + 0.45 * (1 - f);
      const l1 = log(max(1e-6, 1 - t1 * t1));
      // A sharp band and, wider and weaker, the sheen round it that a duller
      // finish spreads out.
      const s1 = smooth * (k1 * exp(p1 * l1) + k0 * exp(5 * l1)), s2 = smooth * k2 * exp(p2 * log(max(1e-6, 1 - t2 * t2)));
      const lam = (0.55 * z + 0.82) / sqrt(1 + z * z), dif = b * (0.3 + 0.7 * max(0, lam));
      const tip = cl((end - y) / 7, 0, 1), w0 = tip * (0.4 + 0.6 * tip);
      const xi = floor(x), fr = x - xi, q = y * W + xi;
      if (xi >= 0 && xi < W) {
        const w = (1 - fr) * w0;
        acc[q * 3] += dif * w;
        acc[q * 3 + 1] += s2 * b * w;
        acc[q * 3 + 2] += s1 * (0.35 + 0.65 * b) * w;
        wt[q] += w;
      }
      if (xi + 1 >= 0 && xi + 1 < W) {
        const w = fr * w0;
        acc[q * 3 + 3] += dif * w;
        acc[q * 3 + 4] += s2 * b * w;
        acc[q * 3 + 5] += s1 * (0.35 + 0.65 * b) * w;
        wt[q + 1] += w;
      }
    }
  }
  // Each LED: the mean of the strands over it, darker where they are fewer
  // than 2.4. Channel 0 holds the body, 1 the tinted secondary, 2 the white
  // primary.
  // Orange and yellow read brown and olive at mid level on the panel, so
  // round hue 0.12 the hair is lifted toward copper and honey blonde.
  const h = S.hue + 0.76, hh = h - floor(h), warm = max(0, 1 - Math.abs(hh - 0.12) / 0.11);
  hsv(h, 0.78 - 0.18 * warm, 1 + 0.6 * warm, body);
  hsv(h, 0.8 - 0.2 * warm, 1, tint);
  const RHO = (N / 78) * 0.8;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, n = max(wt[q], RHO);
      const dv = acc[q * 3] / n, s2 = acc[q * 3 + 1] / n, s1 = acc[q * 3 + 2] / n;
      for (let ch = 0; ch < 3; ch++) c[ch] = 0.52 * dv * body[ch] + 0.9 * s2 * tint[ch] + s1 * (0.8 + 0.2 * tint[ch]);
      display.setPixel(x, y, round(255 * (1 - exp(-1.4 * c[0]))), round(255 * (1 - exp(-1.4 * c[1]))), round(255 * (1 - exp(-1.4 * c[2]))));
    }
}
