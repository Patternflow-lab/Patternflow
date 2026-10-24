// ===== Patternflow pattern =====
// Title:   Talbot Carpet
// Family:  wave
// Idea:    Light past a grating of narrow slits, its intensity drawn with the distance from the grating running down the panel on a one-LED halftone screen: the slits come back whole after one Talbot length and half a period over after half of one, split into copies at the fractions in between, and the carpet of rays and beads climbs past as the view moves away from the grating.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Talbot effect (Henry Fox Talbot, 1836) and quantum carpets (Michael Berry, 1996), pattern round 32
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Slit=0..1, Periods=1..4
//
// Knob 1: Hue. Turns the carpet round the wheel. At 0 the dark canals are deep blue, the floor between them goes from azure to pale cyan as it brightens, and the beads are near-white aqua; at 0.33 the canals are crimson and the floor magenta, at 0.66 the canals green and the floor yellow.
// Knob 2: Speed. How fast the carpet climbs. At 2 it moves 0.12 of a Talbot length a second, 15 LEDs, and a whole length passes in 8.3 seconds; at 0.2 it takes 83 seconds.
// Knob 3: Slit. The slit width as a share of the period, 0.10 at 0 (6 LEDs at one period) to 0.45 at 1. A narrow slit gives the sharp carpet, straight rays fanning out of every revival and many small copies; a wide one gives soft blobs and only the half and quarter copies.
// Knob 4: Periods. How many grating periods sit across the panel while one Talbot length still fills the 128 rows. At 1 one slit image stands in the middle; at 2 two, 32 LEDs apart; at 4 four, and the rays lie much flatter.
// Buttons: K1 tap moves the carpet on by half a Talbot length, so every slit image jumps half a period sideways: the carpet's own half-length revival.

const W = 64, H = 128, M = 256, R = 512;
const { floor, min, sin, cos, pow, round, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Share of the lit LEDs in the screen that go to beads: the brightest 14.5%
// of each frame, which fixes the measured edges near 0.14.
const CUT = 0.855;

// In-place radix-2 FFT with the + sign, so it sums c_n e^{+2 pi i n j / M}.
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

// psi(x, tau) = sum c_n exp(2 pi i (n x - n^2 tau)) for a slit of width w
// centred on x = 0, 256 terms with a Gaussian roll-off, at R steps of tau
// over one Talbot length. Each row keeps a running sum of |psi|^2 over one
// period, so a column of any width is two lookups.
function build(P) {
  const w = P.w, c = new Float64Array(M), re = new Float64Array(M), im = new Float64Array(M);
  for (let k = 0; k < M; k++) {
    const n = k < M / 2 ? k : k - M;
    c[k] = (n === 0 ? w : sin(PI * n * w) / (PI * n)) * exp(-(n / 24) * (n / 24));
  }
  const S = P.sum;
  for (let r = 0; r < R; r++) {
    for (let k = 0; k < M; k++) {
      const n = k < M / 2 ? k : k - M;
      // n^2 r is an integer, so the phase wraps exactly.
      const ph = (-2 * PI * ((n * n * r) % R)) / R;
      re[k] = c[k] * cos(ph);
      im[k] = c[k] * sin(ph);
    }
    fft(re, im);
    const o = r * (M + 1);
    S[o] = 0;
    for (let j = 0; j < M; j++) S[o + j + 1] = S[o + j] + re[j] * re[j] + im[j] * im[j];
  }
  P.builtW = w;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// Box blur, rows wrapping (the carpet is periodic across), columns clamped.
function blur(src, dst, tmp, rad) {
  const n = 2 * rad + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let k = -rad; k <= rad; k++) acc += src[y * W + ((k + W) % W)];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / n;
      acc += src[y * W + ((x + rad + 1) % W)] - src[y * W + ((x - rad + W) % W)];
    }
  }
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let k = -rad; k <= rad; k++) acc += tmp[cl(y + k, 0, H - 1) * W + x];
      dst[y * W + x] = acc / n;
    }
}

export function setup(params) {
  const N = W * H;
  params.s = {
    t: 0, hue: 0, speed: 2, w: 0.1, builtW: -1, per: 1,
    sum: new Float32Array(R * (M + 1)), I: new Float32Array(N), G: new Float32Array(N), T: new Float32Array(N),
    U: new Float32Array(N), Lv: new Int16Array(N), srt: new Float32Array(N / 2), c: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.w = round((0.1 + 0.35 * cl(k[2], 0, 1)) * 100) / 100;
  P.per = cl(k[3], 1, 4);
  if (P.w !== P.builtW) build(P);
  P.t += d * P.speed * 0.06;
  if (input.btnPressed && input.btnPressed[0]) P.t += 0.5;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { sum: S, I, G, T, U, Lv, srt, c } = P;
  // Row y holds tau from t + y/128 to t + (y+1)/128: four table rows,
  // averaged, and each LED the mean over its width of the period.
  for (let y = 0; y < H; y++) {
    const ra = floor((P.t + y / H) * R), rb = Math.max(ra + 1, floor((P.t + (y + 1) / H) * R));
    for (let x = 0; x < W; x++) I[y * W + x] = 0;
    for (let rr = ra; rr < rb; rr++) {
      const o = (((rr % R) + R) % R) * (M + 1);
      const at = (u) => {
        const q = floor(u / M), v = u - q * M, i = floor(v);
        return q * S[o + M] + S[o + i] + (S[o + i + 1] - S[o + i]) * (v - i);
      };
      let prev = at((0.5 * M) | 0);
      for (let x = 0; x < W; x++) {
        const u1 = (((x + 1) / W) * P.per + 0.5) * M, next = at(u1);
        I[y * W + x] += (next - prev) / ((P.per * M) / W) / (rb - ra);
        prev = next;
      }
    }
  }
  // The screen: LEDs with x + y odd carry a soft glow of the carpet, blurred
  // so it never steps more than a few levels from one LED to the next. The
  // others stand 40 above the darkest glow beside them, so every pair of
  // neighbours differs by 40 or a little less, or they hold a bead at full
  // brightness where the carpet is brightest.
  blur(I, T, U, 2);
  blur(T, G, U, 2);
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = y & 1; x < W; x += 2) srt[n++] = I[y * W + x];
  srt.sort();
  const hi = srt[floor(n * CUT)], top = srt[floor(n * 0.995)], mid = srt[n >> 1];
  for (let y = 0; y < H; y++)
    for (let x = (y + 1) & 1; x < W; x += 2) {
      const p = y * W + x;
      Lv[p] = round(8 + 70 * cl(pow(G[p] / (2.2 * mid), 0.9), 0, 1));
    }
  for (let y = 0; y < H; y++)
    for (let x = y & 1; x < W; x += 2) {
      const p = y * W + x;
      if (I[p] > hi) {
        Lv[p] = 255;
        continue;
      }
      let m = 255;
      if (x > 0) m = min(m, Lv[p - 1]);
      if (x < W - 1) m = min(m, Lv[p + 1]);
      if (y > 0) m = min(m, Lv[p - W]);
      if (y < H - 1) m = min(m, Lv[p + W]);
      Lv[p] = m + 40;
    }
  // Colour carries the fine carpet at no cost to the screen: the canals
  // deep and saturated, the floor paler and greener as it brightens.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, L = Lv[p];
      if (L === 255) hsv(P.hue + 0.5, 0.35 * (1 - cl((I[p] - hi) / (top - hi), 0, 1)), 1, c);
      else {
        const t = cl(pow(I[p] / (2.5 * mid), 0.7), 0, 1);
        hsv(P.hue + 0.64 - 0.14 * t, 1 - 0.5 * t, 1, c);
      }
      display.setPixel(x, y, round(c[0] * L), round(c[1] * L), round(c[2] * L));
    }
}
