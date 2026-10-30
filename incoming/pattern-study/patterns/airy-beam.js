// ===== Patternflow pattern =====
// Title:   Airy Beam
// Family:  wave
// Idea:    A finite-energy Airy beam enters at the top and runs down the panel, its main lobe and the side lobes beside it bending together along parabolas while the field's phase runs along them as a green and blue tint, and a small bead drifting back and forth near the top blocks a lobe that grows back further down.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the nonspreading Airy wave packet (Michael Berry and Nandor Balazs, 1979), finite-energy accelerating Airy beams (Georgios Siviloglou, John Broky, Aristide Dogariu and Demetrios Christodoulides, 2007), self-healing Airy beams (John Broky, Georgios Siviloglou, Aristide Dogariu and Demetrios Christodoulides, 2008), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Truncation=0.04..0.4, Tilt=-1..1
//
// Knob 1: Hue. Turns the light round the wheel: at 0 the beam is cyan with near-white peaks, and the field's phase tints each lobe a little towards green or towards azure, the two sides of a lobe boundary always opposite. The bead is a pale stone in any hue.
// Knob 2: Speed. The tint follows the phase turning once a second at 2 (a tenth of that at 0.2, 1.5 at 3), so green and azure run down the lobes. The bead's drift to and fro across the beam takes 9 s at 2, 90 s at 0.2 and 6 s at 3.
// Knob 3: Truncation. The a of the launch field Ai(s) exp(a s). At 0.04 the main lobe keeps a third of its peak to the bottom row and side lobes fill everything to its left down the whole panel. At 0.15 the far lobes fade first and the bottom row's brightest point is a tenth of the top's. At 0.4 the main lobe has lost 99.7% of its light by the bottom row and what is left there is a wide glow. The brightness is set row by row against the free beam, so the spreading shows as lobes dissolving rather than as the panel going dark.
// Knob 4: Tilt. The launch angle v = -1.25 + 1.25 Tilt, a factor exp(i v s) at launch, which shears the whole beam by v xi. At the opening 0.06 the main lobe enters at x 28, swings left to x 22 at row 38 and bends right to x 54 at the bottom. At -1 it falls to x 26 at row 80 and turns back to x 34, like a ball thrown upward. At 1 it is launched straight and bends 63 LEDs, leaving the panel at row 121.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- Units. The paraxial equation i dphi/dxi + (1/2) d2phi/ds2 = 0 in
// s = x / x0 across and xi = z / (k x0^2) down. One LED is 1/4 of s, and the
// 128 rows run xi from 0 at row 0 (the launch plane) to 8.
const X0 = 4, XI = 8, DXI = XI / H;
// The beam is worked on N points one LED apart, s from S0 = -96 to 32. At
// any tilt the panel sees the untilted beam only between s = -13.6 and 22.2.
// At a = 0.04 the launch field at -96 is down to 0.8% of the main lobe, and
// the spectrum at the grid's highest wavenumber, 4 pi, to 0.2%.
const N = 512, S0 = -96, MASK = N - 1;

// ---- FFT, radix 2, in place, the sum with exp(+2 pi i m j / N) and no 1/N.
const REV = new Uint16Array(N);
for (let i = 0, b = Math.log2(N); i < N; i++) {
  let r = 0;
  for (let k = 0; k < b; k++) r |= ((i >> k) & 1) << (b - 1 - k);
  REV[i] = r;
}
const TC = new Float64Array(N / 2), TS = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) (TC[i] = cos((2 * PI * i) / N)), (TS[i] = sin((2 * PI * i) / N));
function ifft(re, im) {
  for (let i = 0; i < N; i++) {
    const j = REV[i];
    if (j > i) {
      let t = re[i];
      (re[i] = re[j]), (re[j] = t);
      t = im[i];
      (im[i] = im[j]), (im[j] = t);
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1, step = N / len;
    for (let i = 0; i < N; i += len)
      for (let k = 0; k < half; k++) {
        const c = TC[k * step], s = TS[k * step], a = i + k, b = a + half;
        const xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c;
        (re[b] = re[a] - xr), (im[b] = im[a] - xi), (re[a] += xr), (im[a] += xi);
      }
  }
}
// Wavenumber of FFT bin m.
const KM = new Float64Array(N);
for (let m = 0; m < N; m++) KM[m] = (2 * PI * (m < N / 2 ? m : m - N) * X0) / N;

// ---- The free-space propagator over d rows on this grid: the inverse FFT of
// exp(-i k^2 d DXI / 2), divided by N. Convolving a field with KR/KI[d] is
// the same as one FFT step of split-step propagation, exactly.
const KR = new Float32Array(H * N), KI = new Float32Array(H * N);
{
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let d = 1; d < H; d++) {
    for (let m = 0; m < N; m++) {
      const ph = (-KM[m] * KM[m] * d * DXI) / 2;
      (re[m] = cos(ph) / N), (im[m] = sin(ph) / N);
    }
    ifft(re, im);
    KR.set(re, d * N);
    KI.set(im, d * N);
  }
}

// ---- The free beam for truncation a, every row. The launch field
// Ai(s) exp(a s) has the spectrum exp(a^3/3) exp(-a k^2) exp(i (k^3/3 - a^2 k))
// (shift the contour of Ai's integral by i a), and each plane wave picks up
// exp(-i k^2 xi / 2) on the way down. Checked against a power series of Ai
// at a = 0.04: row 0 gives 0.355028 at s = 0, 0.514561 at -1, -0.335979 at
// -3 and 0.026987 at -10, all within 1e-5; row 64 agrees with a direct
// O(N^2) transform of row 0 to five places.
function freeBeam(S, a) {
  const re = new Float64Array(N), im = new Float64Array(N), c = (X0 / N) * exp((a * a * a) / 3);
  for (let r = 0; r < H; r++) {
    const xi = r * DXI;
    for (let m = 0; m < N; m++) {
      const k = KM[m], amp = c * exp(-a * k * k), ph = (k * k * k) / 3 - a * a * k + k * S0 - (k * k * xi) / 2;
      (re[m] = amp * cos(ph)), (im[m] = amp * sin(ph));
    }
    ifft(re, im);
    let peak = 0;
    for (let j = 0; j < N; j++) peak = max(peak, re[j] * re[j] + im[j] * im[j]);
    S.FR.set(re, r * N);
    S.FI.set(im, r * N);
    S.RM[r] = peak;
  }
  S.a = a;
}

// Main lobe of Ai at s = -1.0188, the first maximum.
const A1 = -1.0188;
// The bead: its row, its half width in LEDs, and its drift about the main
// lobe, from 6 LEDs right of it to 11 left. Set squarely on the main lobe at
// a = 0.04 it leaves the lobe 20% of the free beam's intensity 8 rows below,
// 47% by row 60 and 62% by row 80: the side lobes feed it back. It never
// heals all the way, since the bead keeps what it took.
const OBS_ROW = 22, OBS_W = 2.6, OBS_MID = -2.5, OBS_AMP = 8.5, OBS_T = 9;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, a: -1, v: 0,
    FR: new Float32Array(H * N), FI: new Float32Array(H * N), RM: new Float32Array(H),
    I: new Float32Array(W * H), C: new Float32Array(W * H), rgb: new Float32Array(W * H * 3),
    ub: new Int32Array(16), ur: new Float32Array(16), ui: new Float32Array(16), GR: new Float32Array(W + 1), GI: new Float32Array(W + 1),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.04, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.t += (d * cl(k[1], 0.2, 3)) / 2;
  // Steps of 0.0025 in a, so a knob held still never rebuilds the beam. A
  // rebuild is 128 FFTs, about 13 ms in Node; the propagator table above is
  // as many again, once at load. A frame after that is about 1.4 ms.
  const a = Math.round(cl(k[2], 0.04, 0.4) * 400) / 400;
  if (a !== S.a) freeBeam(S, a);
  S.v = -1.25 + 1.25 * cl(k[3], -1, 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.a < 0) return;
  const { FR, FI, RM, I, C, rgb, ub, ur, ui, GR, GI, v } = S;
  // The main lobe runs along s = A1 + v xi + xi^2 / 4 in the panel's frame.
  // The middle of its range across the panel sits at x = 38.
  let lo = A1, hi = A1;
  for (let r = 0; r < H; r++) {
    const xi = r * DXI, s = A1 + v * xi + (xi * xi) / 4;
    (lo = min(lo, s)), (hi = max(hi, s));
  }
  const sL = (lo + hi) / 2 - 38 / X0;
  // The beam's own grid point under LED x of row r is x + off(r): the tilt
  // is the shear s -> s + v xi of the untilted beam.
  const off = (r) => (sL - S0) * X0 - v * r * DXI * X0;

  // ---- The bead and the light it takes out, on the beam's grid.
  const xio = OBS_ROW * DXI, xm = (A1 + v * xio + (xio * xio) / 4 - sL) * X0;
  const co = xm + OBS_MID + OBS_AMP * sin((2 * PI * S.t) / OBS_T);
  const jc = co + off(OBS_ROW);
  let nb = 0;
  for (let j = Math.ceil(jc - OBS_W - 0.5); j <= floor(jc + OBS_W + 0.5); j++) {
    const b = cl(OBS_W + 0.5 - Math.abs(j - jc), 0, 1);
    if (b <= 0) continue;
    const q = OBS_ROW * N + (j & MASK);
    (ub[nb] = j), (ur[nb] = b * FR[q]), (ui[nb] = b * FI[q]), nb++;
  }

  // ---- The field at every LED: the free beam minus what the bead took out,
  // carried down by the propagator, on the 65 grid points under the row,
  // then linear between the two either side of each LED.
  const wc = cos(2 * PI * S.t), ws = sin(2 * PI * S.t);
  for (let r = 0; r < H; r++) {
    const o = off(r), jb = floor(o), f = o - jb, d = r - OBS_ROW, kb = d * N;
    for (let e = 0; e <= W; e++) {
      const j = jb + e, q = r * N + (j & MASK);
      let pr = FR[q], pi = FI[q];
      if (d > 0)
        for (let n = 0; n < nb; n++) {
          const kk = kb + ((j - ub[n]) & MASK), kr = KR[kk], ki = KI[kk];
          pr -= kr * ur[n] - ki * ui[n];
          pi -= kr * ui[n] + ki * ur[n];
        }
      else if (d === 0) {
        const b = 1 - cl(OBS_W + 0.5 - Math.abs(j - jc), 0, 1);
        (pr *= b), (pi *= b);
      }
      (GR[e] = pr), (GI[e] = pi);
    }
    for (let x = 0; x < W; x++) {
      const fr = GR[x] + f * (GR[x + 1] - GR[x]), fi = GI[x] + f * (GI[x + 1] - GI[x]);
      const ii = fr * fr + fi * fi, p = r * W + x;
      I[p] = ii;
      C[p] = ii > 1e-12 ? (fr * wc + fi * ws) / sqrt(ii) : 0;
    }
  }

  // ---- Light. Brightness is intensity over the geometric mean of 0.25 and
  // the free beam's brightest point in that row, to the power 0.55: a row
  // whose free beam peaks 100 times below 0.25 is drawn as if 10 times
  // below. The tint is cos(phase - 2 pi t), 0.05 of the wheel either way.
  for (let r = 0; r < H; r++) {
    const ref = sqrt(0.25 * RM[r]);
    for (let x = 0; x < W; x++) {
      const p = r * W + x, val = min(1, Math.pow(I[p] / ref, 0.55));
      hsv(0.5 + S.hue + 0.05 * C[p], 1 - 0.55 * val * val, val, rgb, p * 3);
    }
  }
  // The bead: a pale stone, lit on top by the light that falls on it from
  // three rows up.
  for (let y = OBS_ROW - 2; y <= OBS_ROW + 1; y++)
    for (let x = floor(co - OBS_W - 1); x <= co + OBS_W + 1; x++) {
      if (x < 0 || x >= W) continue;
      const dx = (x + 0.5 - co) / (OBS_W + 0.6), dy = (y + 0.5 - (OBS_ROW - 0.2)) / 1.9, rr = dx * dx + dy * dy;
      if (rr > 1) continue;
      const lit = min(1, sqrt(I[max(0, OBS_ROW - 3) * W + x] / 0.15)), sh = 0.3 + 0.25 * (1 - rr) + 0.45 * lit * (dy < 0 ? 1 : 0.4);
      hsv(0.08 + S.hue, 0.15, sh, rgb, (y * W + x) * 3);
    }
  for (let p = 0; p < W * H; p++) display.setPixel(p % W, floor(p / W), (rgb[p * 3] * 255) | 0, (rgb[p * 3 + 1] * 255) | 0, (rgb[p * 3 + 2] * 255) | 0);
}
