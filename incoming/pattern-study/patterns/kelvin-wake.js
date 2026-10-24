// ===== Patternflow pattern =====
// Title:   Kelvin Wake
// Family:  wave
// Idea:    A small patch of foam climbs the panel over still water and leaves Kelvin's ship wave behind it: curved transverse crests across its track and short divergent waves slanting out along the two arms of a wedge of half-angle 19.47 degrees, brightest where the two systems meet in cusps along the wedge line, and the wedge stays the same however fast the source goes.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kelvin ship-wave pattern (William Thomson, Lord Kelvin, 1887), pattern round 34
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Velocity=1..1.7, Patch=0..1
//
// Knob 1: Hue. The colour of the water, once round the wheel. At 0 azure, at 0.15 indigo, at 0.3 magenta, at 0.45 crimson, at 0.5 orange, at 0.6 gold, at 0.75 green, at 0.9 jade. From orange to lime the calm water is lifted from 0.34 to 0.74 of full brightness and its shadowed faces lean to crimson, so it never reads brown or olive.
// Knob 2: Speed. The clock. At 2 a source at Velocity 1 climbs 30 LEDs a second, crosses the panel in 4.3 seconds and the next one comes up from the bottom 6.3 seconds after it; at 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Velocity. The source's speed U. The wavelength of the transverse waves goes as U squared, 12 LEDs at 1, 22 at 1.35 and 35 at 1.7, and the source climbs from 30 to 51 LEDs a second (at Speed 2). The wedge does not change: its cusp lines meet the panel's sides 90 LEDs behind the source at every setting. With the patch the same size, a faster source makes more of the short divergent waves, until at 1.7 they outshine the transverse crests.
// Knob 4: Patch. The size a of the Gaussian pressure patch that drives the wake, 1.2 LEDs at 0 to 6 at 1, and the foam over it grows from 4 to 8 LEDs across. A small patch makes short divergent waves and sharp cusps along the wedge lines; a large one smooths them away and leaves only the transverse crests, by 0.25 at Velocity 1 and by about 0.6 at Velocity 1.7.
// Buttons: K1 tap sends the next source up from the bottom at once (if the last one is at least 24 LEDs up the panel), so two wakes overlap and add.

const W = 64, H = 128, YC = 32, DX = 0.5, N = 256;
// The wake is drawn to 150 LEDs behind its source and fades over the last
// 45; sources come 190 LEDs apart, so 40 LEDs of still water separate them.
const LT = 150, FADE = 45, GAP = 190, ROWS = Math.ceil(LT / DX) + 2;
const { floor, sqrt, sin, cos, exp, abs, round, min, max, pow, random, PI } = Math;
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

// In-place radix-2 FFT with the + sign.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * PI) / len, wr = cos(ang), wi = sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

// The steady wake in the source's frame, x LEDs behind it and y LEDs to the
// side, from the classical integral over wave directions theta:
//   zeta(x, y) = Im  int sec^3(theta) exp(-(k a)^2 / 4) exp(i k (x cos theta + y sin theta)) dtheta,
// k = k0 sec^2(theta), k0 = g / U^2 = 2 pi / lambda. The imaginary part is
// the sine form, which is zero at x = 0, so the wake starts from nothing at
// the source. Changing variable to the cross-track wavenumber
// ky = k0 sec(theta) tan(theta) makes each row x one Fourier sum over ky:
// sec^2(theta) = (1 + sqrt(1 + 4 (ky / k0)^2)) / 2, the along-track
// wavenumber is k0 sec(theta), and sec^3 dtheta = sec^2 / (k0 (2 sec^2 - 1)) dky.
// Only the slopes are drawn, so a row is two 256-point FFTs across y: the
// same sum times i kx and times i ky. 256 LEDs across hold the wedge out to
// x = 150, where it is 106 wide, so the FFT's wrap never reaches the panel.
// Fitting the brightest crest beside the axis, row by row out to x = 320, as
// s x - c x^(1/3) (the Airy fringe sits inside the caustic by c x^(1/3)) puts
// the cusp line at 19.25 to 19.46 degrees over the whole Velocity range;
// Kelvin's angle is arcsin(1/3) = 19.47.
function build(T, lambda, a) {
  const k0 = (2 * PI) / lambda;
  const { ky, kx, B, r1, i1, r2, i2, ZX, ZY } = T;
  for (let j = 0; j < N; j++) {
    const q = (2 * PI * (j < N / 2 ? j : j - N)) / N, u = q / k0;
    const s2 = (1 + sqrt(1 + 4 * u * u)) / 2, k = k0 * s2, aq = abs(q);
    // A soft roll-off before the LED grid's Nyquist limit.
    const win = aq < 0.6 * PI ? 1 : cos(((aq - 0.6 * PI) / (0.4 * PI)) * 0.5 * PI) ** 2;
    B[j] = (s2 / (k0 * (2 * s2 - 1))) * exp(-(((k * a) / 2) ** 2)) * win;
    ky[j] = q;
    kx[j] = k0 * sqrt(s2);
  }
  for (let r = 0; r < ROWS; r++) {
    const x = r * DX;
    for (let j = 0; j < N; j++) {
      // Columns sit at y = m + 0.5, so the track runs between the two middle columns.
      const ph = kx[j] * x + ky[j] * 0.5, c = B[j] * cos(ph), s = B[j] * sin(ph);
      r1[j] = -kx[j] * s;
      i1[j] = kx[j] * c;
      r2[j] = -ky[j] * s;
      i2[j] = ky[j] * c;
    }
    fft(r1, i1);
    fft(r2, i2);
    // The far end of the wake fades out: a source that has run for a finite
    // time has a wake of finite length.
    const f = 1 - sm(LT - FADE, LT, x);
    for (let m = 0; m < YC; m++) {
      ZX[r * YC + m] = i1[m] * f;
      ZY[r * YC + m] = i2[m] * f;
    }
  }
  // One scale for the shading: the 99th percentile of the lit slope over
  // the stretch that fits on the panel, both sides of the track.
  const vals = T.vals;
  let n = 0;
  for (let r = floor(4 / DX); r < floor(128 / DX); r += 2)
    for (let m = 0; m < YC; m++) {
      const gx = ZX[r * YC + m], gy = ZY[r * YC + m];
      vals[n++] = abs(gy * T.lx + gx * T.ly);
      vals[n++] = abs(-gy * T.lx + gx * T.ly);
    }
  const v = vals.subarray(0, n).sort();
  T.scale = 1 / (v[floor(n * 0.99)] || 1);
}

export function setup(params) {
  // The light comes from the upper left, low over the water.
  const lx = -0.45, ly = -0.89;
  params.s = {
    hue: 0, speed: 2, vel: 1, patch: 0.06, warm: false, key: "", foamT: 0,
    src: [], foam: [], cache: new Map(), c: [0, 0, 0],
    work: {
      ky: new Float64Array(N), kx: new Float64Array(N), B: new Float64Array(N),
      r1: new Float64Array(N), i1: new Float64Array(N), r2: new Float64Array(N), i2: new Float64Array(N),
    },
    lx, ly, GX: new Float32Array(W * H), GY: new Float32Array(W * H), F: new Float32Array(W * H), tab: null,
  };
}

function table(S) {
  // Tables are cached by the quantised knob pair: Velocity in steps of 0.02,
  // Patch in steps of 0.02.
  const qv = round(S.vel * 50) / 50, qp = round(S.patch * 50) / 50, key = qv + "," + qp;
  if (key === S.key) return;
  S.key = key;
  let T = S.cache.get(key);
  if (!T) {
    T = {
      ...S.work, lx: S.lx, ly: S.ly, scale: 1, vals: new Float32Array(2 * YC * 128),
      ZX: new Float32Array(ROWS * YC), ZY: new Float32Array(ROWS * YC),
    };
    build(T, 12 * qv * qv, 1.2 + 4.8 * qp);
    if (S.cache.size > 6) S.cache.delete(S.cache.keys().next().value);
    S.cache.set(key, T);
  }
  S.tab = T;
}

// Rows climbed per second.
const rate = (S) => 15 * S.vel * S.speed;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.vel = cl(k[2], 1, 1.7);
  S.patch = cl(k[3], 0, 1);
  table(S);
  const v = rate(S);
  if (!S.warm) {
    // Open so that 2.4 seconds in, a source is 40 LEDs below the top with the
    // one before it already gone past.
    const y0 = 40 + 2.4 * v;
    S.src = [y0 - GAP, y0];
    S.warm = true;
  }
  for (let i = 0; i < S.src.length; i++) S.src[i] -= v * d;
  while (S.src.length && S.src[0] < -LT - 4) S.src.shift();
  const last = S.src[S.src.length - 1];
  if (last === undefined || last < H + 6 - GAP) S.src.push(H + 6);
  else if (input.btnPressed && input.btnPressed[0] && last < H - 24) S.src.push(H + 6);
  // Foam shed by each source stays where it fell on the still water and
  // fades in about 0.4 seconds.
  const rf = 1.5 + 0.35 * (1.2 + 4.8 * S.patch);
  S.foamT += d * 60 * S.speed / 2;
  for (const f of S.foam) f.life -= (d * S.speed) / 2 / 0.4;
  S.foam = S.foam.filter((f) => f.life > 0);
  while (S.foamT >= 1) {
    S.foamT -= 1;
    for (const ys of S.src)
      if (ys > -4 && ys < H + 4) {
        const ang = random() * 2 * PI, r = rf * sqrt(random());
        S.foam.push({ x: 31.5 + r * cos(ang), y: ys + 0.6 * r * sin(ang) + 1, life: 0.6 + 0.4 * random() });
      }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.tab) return;
  const T = S.tab, { ZX, ZY } = T, GX = S.GX, GY = S.GY, F = S.F, c = S.c;
  GX.fill(0);
  GY.fill(0);
  F.fill(0);
  for (const f of S.foam) {
    const x = round(f.x), y = round(f.y);
    if (x >= 0 && x < W && y >= 0 && y < H) F[y * W + x] = max(F[y * W + x], min(1, f.life) * 0.85);
  }
  // Each source lays its wake, row by row, from the table: x behind it,
  // linear between table rows; the cross-track slope is odd in y.
  for (const ys of S.src)
    for (let y = max(0, Math.ceil(ys)); y < H; y++) {
      const fx = (y - ys) / DX;
      if (fx >= ROWS - 1) break;
      const r = floor(fx), w = fx - r, o0 = r * YC, o1 = o0 + YC;
      for (let m = 0; m < YC; m++) {
        const gx = ZX[o0 + m] * (1 - w) + ZX[o1 + m] * w, gy = ZY[o0 + m] * (1 - w) + ZY[o1 + m] * w;
        GY[y * W + 32 + m] += gx;
        GX[y * W + 32 + m] += gy;
        GY[y * W + 31 - m] += gx;
        GX[y * W + 31 - m] -= gy;
      }
    }
  const h0 = S.hue + 0.55, hh = h0 - floor(h0);
  // Amber, gold and lime water read brown or olive at the calm level, so
  // there the water is lifted to 0.74 and its shadow faces lean to crimson.
  const warm = sm(0.0, 0.05, hh) * (1 - sm(0.22, 0.32, hh));
  const base = 0.34 + 0.4 * warm, sat0 = 0.82 + 0.1 * warm;
  const rf = 1.5 + 0.35 * (1.2 + 4.8 * S.patch);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // Lit where the surface tilts towards the light.
      const sh = -(GX[p] * S.lx + GY[p] * S.ly) * T.scale;
      const up = sh > 0 ? min(1.4, sh) : 0, dn = sh < 0 ? min(1, -sh) : 0;
      let v = base + (1 - base) * pow(min(1, up), 0.75) - (base - 0.08 - 0.12 * warm) * pow(dn, 0.7);
      let s = sat0 * (1 - 0.7 * sm(0.55, 1.25, up));
      let hue = h0 + 0.03 * up - (0.02 + 0.08 * warm) * dn;
      // The foam patch over each source.
      let foam = F[p];
      for (const ys of S.src) {
        const dx = x - 31.5, dy = (y - ys) * 1.4, r2 = dx * dx + dy * dy;
        if (r2 < (rf + 1.5) * (rf + 1.5)) foam = max(foam, 1 - sm(rf - 1, rf + 1.5, sqrt(r2)));
      }
      if (foam > 0) {
        v = v + (1 - v) * foam;
        s *= 1 - foam;
      }
      hsv(hue, s, v, c);
      display.setPixel(x, y, round(c[0] * 255), round(c[1] * 255), round(c[2] * 255));
    }
}
