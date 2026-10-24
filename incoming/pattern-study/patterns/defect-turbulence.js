// ===== Patternflow pattern =====
// Title:   Defect Turbulence
// Family:  wave
// Idea:    The complex Ginzburg-Landau equation runs on the panel and is drawn as its wavefronts, the zero lines of its imaginary part in azure and of its real part in rose, with a small + or - where they cross at a phase defect: from a random start the defects are born and annihilate in pairs and drag spirals about until the spirals win and freeze into cells, and turned past the Benjamin-Feir line the turbulence never settles.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: complex Ginzburg-Landau equation (Vitaly Ginzburg, Lev Landau, 1950); defect turbulence (Pierre Coullet, Lydia Gil, Jean Lega, 1989), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Stability=-0.8..0.6, Strobe=0..1
//
// Knob 1: Hue. Turns both line colours round the wheel together. At 0 azure and rose, at 0.25 violet and yellow, at 0.5 orange and spring green, at 0.75 green and blue. The lines are drawn at full brightness on black, so no colour goes brown or olive.
// Knob 2: Speed. How fast the equation runs. At 2 four units of its time a second, so the fronts of a spiral run out from its core at about 3 LEDs a second and a line passes any LED 1.3 times a second; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Stability. The number 1 + bc, with b = 2 held and c = (Stability - 1) / 2. Above 0 plane waves are stable; below it they are Benjamin-Feir unstable. Counted over three minutes from the random start: at 0.6 and 0.3 the field coarsens into 7 and 6 pairs of spirals within 20 s and they freeze into cells with shock lines between them; at 0, on the line, the turbulence of the start lasts about 40 s and then the spirals win and 5 pairs are left; at -0.2 it never settles and holds 11 to 37 pairs, at -0.4 13 to 38, at -0.8 19 to 52.
// Knob 4: Strobe. The lines are the zero lines of A times a turning phase. At 0 the phase turns so that the field beats at 0.56 radians per unit of time and the fronts run outward from every core; at 1 it turns with the field's own frequency, measured as it runs, so the arms of frozen spirals stand still and only the defects and the turbulence move.
// Buttons: K1 tap stirs a round patch 20 LEDs across its radius back to small random noise. It breaks into defect pairs at once; at the opening the spirals round it close it again in about ten seconds.

const W = 64, H = 128;
// The equation is solved on a grid twice as fine as the LEDs, GW x GH cells
// of HS units each, so one LED is 2 HS units across.
const GW = 128, GH = 256, GN = GW * GH, HS = 0.8;
// Linear dispersion b. A lone spiral at b = 2, c = -0.5 settles to
// wavenumber 0.42 at both 0.6 and 0.4 units a cell, so 0.8 a cell is close
// to the continuum; its waves are 9 LEDs long on the panel.
const B = 2;
// Explicit Euler, at 0.75 of the 9-point Laplacian's limit 0.375 h^2 / (1 + b^2).
const DT = (0.75 * 0.375 * HS * HS) / (1 + B * B);
// Equation time per second at Speed 1, the beat the wavefronts are drawn at,
// and the run before the first frame.
const RATE = 2, BEAT = 0.56, PREROLL = 20;
// Line colours (azure, and rose 0.37 round the wheel from it), and the
// lines' half width in LEDs and falloff.
const H0 = 0.55, HM = 0.37, LW = 1.1, LP = 0.8;
const { floor, min, max, abs, sqrt, atan2, round, random, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  const S = {
    ar: new Float64Array(GN), ai: new Float64Array(GN), br: new Float64Array(GN), bi: new Float64Array(GN),
    fr: new Float64Array(W * H), fi: new Float64Array(W * H),
    def: [], np: 0, nm: 0, t: 0, phi: 0, ws: 0, begun: false, c: -0.5, hue: 0, speed: 2, strobe: 0.06,
    pc: [0, 0, 0], mc: [0, 0, 0],
  };
  // A smooth random start: a few long waves in each part.
  const modes = [];
  for (let m = 0; m < 24; m++) modes.push([floor(random() * 5) - 2, floor(random() * 7) - 3, random() * 2 * PI, m & 1]);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      let r = 0, i = 0;
      for (const [kx, ky, ph, im] of modes) {
        const v = cos((2 * PI * kx * x) / GW + (2 * PI * ky * y) / GH + ph);
        if (im) i += v;
        else r += v;
      }
      S.ar[y * GW + x] = 0.15 * r;
      S.ai[y * GW + x] = 0.15 * i;
    }
  params.s = S;
}

// One Euler step of A_t = A + (1 + ib) lap A - (1 + ic)|A|^2 A, periodic edges.
function step(S) {
  const { ar, ai, br, bi } = S, c = S.c, k = 1 / (6 * HS * HS);
  let wsum = 0, asum = 0;
  for (let y = 0; y < GH; y++) {
    const yu = ((y + GH - 1) % GH) * GW, yd = ((y + 1) % GH) * GW, y0 = y * GW;
    for (let x = 0; x < GW; x++) {
      const xl = x === 0 ? GW - 1 : x - 1, xr = x === GW - 1 ? 0 : x + 1, p = y0 + x;
      const lr = (4 * (ar[yu + x] + ar[yd + x] + ar[y0 + xl] + ar[y0 + xr]) + ar[yu + xl] + ar[yu + xr] + ar[yd + xl] + ar[yd + xr] - 20 * ar[p]) * k;
      const li = (4 * (ai[yu + x] + ai[yd + x] + ai[y0 + xl] + ai[y0 + xr]) + ai[yu + xl] + ai[yu + xr] + ai[yd + xl] + ai[yd + xr] - 20 * ai[p]) * k;
      const r = ar[p], i = ai[p], m = r * r + i * i;
      const dr = r + lr - B * li - m * (r - c * i), di = i + li + B * lr - m * (i + c * r);
      br[p] = r + DT * dr;
      bi[p] = i + DT * di;
      // Im(conj(A) A_t), for the field's own frequency.
      wsum += r * di - i * dr;
      asum += m;
    }
  }
  S.ar = br;
  S.br = ar;
  S.ai = bi;
  S.bi = ai;
  S.t += DT;
  // A ~ exp(-i w t) gives Im(conj(A) A_t) = -w |A|^2.
  const w = -wsum / max(1e-9, asum);
  S.ws += (w - S.ws) * min(1, DT / 4);
}

// Phase defects: the winding of the phase round each plaquette of four
// cells. A plaquette can wind only if both the real and the imaginary part
// change sign round it, so the phase is looked at only there. On a periodic
// grid every edge is walked once each way, so the windings sum to zero and
// there are as many + as -: at six settings of Stability, 3 minutes each,
// not one of 32,400 frames had a difference.
function defects(S) {
  const { ar, ai } = S, TAU = 2 * PI;
  const wr = (d) => (d > PI ? d - TAU : d < -PI ? d + TAU : d);
  S.def.length = 0;
  let np = 0, nm = 0;
  for (let y = 0; y < GH; y++) {
    const y1 = ((y + 1) % GH) * GW, y0 = y * GW;
    for (let x = 0; x < GW; x++) {
      const x1 = x === GW - 1 ? 0 : x + 1, pa = y0 + x, pb = y0 + x1, pc = y1 + x1, pd = y1 + x;
      const sr = (ar[pa] > 0) + (ar[pb] > 0) + (ar[pc] > 0) + (ar[pd] > 0);
      if (sr === 0 || sr === 4) continue;
      const si = (ai[pa] > 0) + (ai[pb] > 0) + (ai[pc] > 0) + (ai[pd] > 0);
      if (si === 0 || si === 4) continue;
      const a = atan2(ai[pa], ar[pa]), b = atan2(ai[pb], ar[pb]), c = atan2(ai[pc], ar[pc]), d = atan2(ai[pd], ar[pd]);
      const n = round((wr(b - a) + wr(c - b) + wr(d - c) + wr(a - d)) / TAU);
      if (n) {
        S.def.push(x / 2, y / 2, n);
        if (n > 0) np += n;
        else nm -= n;
      }
    }
  }
  S.np = np;
  S.nm = nm;
}

// Stir a round patch, 20 LEDs across its radius, back to a small random
// field. Its zero lines cross at random, so it breaks into defect pairs.
function stir(S) {
  const cx = floor(random() * GW), cy = floor(random() * GH), R = 40, modes = [];
  for (let m = 0; m < 12; m++) modes.push([(random() - 0.5) * 0.9, (random() - 0.5) * 0.9, random() * 2 * PI, m & 1]);
  const { ar, ai } = S;
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const r = sqrt(i * i + j * j);
      if (r > R) continue;
      let nr = 0, ni = 0;
      for (const [kx, ky, ph, im] of modes) {
        const v = cos(kx * i + ky * j + ph);
        if (im) ni += v;
        else nr += v;
      }
      const w = min(1, (R - r) / 8), p = ((cy + j + GH) % GH) * GW + ((cx + i + GW) % GW);
      ar[p] += (0.12 * nr - ar[p]) * w;
      ai[p] += (0.12 * ni - ai[p]) * w;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  // The knob is 1 + bc, so c follows from it.
  S.c = (cl(k[2], -0.8, 0.6) - 1) / B;
  S.strobe = cl(k[3], 0, 1);
  if (!S.begun) {
    for (let n = 0; n < PREROLL / DT; n++) step(S);
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0]) stir(S);
  const target = S.t + d * S.speed * RATE;
  while (S.t < target) {
    step(S);
    // The drawing's clock: the field seen at the beat, slowing to the
    // field's own frequency as Strobe goes to 1.
    S.phi += (S.ws - BEAT * (1 - S.strobe)) * DT;
  }
  defects(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { ar, ai, pc, mc, fr, fi } = S, cp = cos(S.phi), sp = sin(S.phi);
  hsv(S.hue + H0, 0.8, 1, pc);
  hsv(S.hue + H0 + HM, 0.65, 1, mc);
  // The field turned by the drawing's clock, averaged over the 2 x 2 cells of each LED.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = 2 * y * GW + 2 * x, q = p + GW;
      const r = ar[p] + ar[p + 1] + ar[q] + ar[q + 1], i = ai[p] + ai[p + 1] + ai[q] + ai[q + 1];
      fr[y * W + x] = 0.25 * (r * cp - i * sp);
      fi[y * W + x] = 0.25 * (r * sp + i * cp);
    }
  for (let y = 0; y < H; y++) {
    const yu = ((y + H - 1) % H) * W, yd = ((y + 1) % H) * W, y0 = y * W;
    for (let x = 0; x < W; x++) {
      const xl = x === 0 ? W - 1 : x - 1, xr = x === W - 1 ? 0 : x + 1, p = y0 + x;
      // Distance in LEDs to the zero line of each part, |f| / |grad f|.
      const rx = fr[y0 + xr] - fr[y0 + xl], ry = fr[yd + x] - fr[yu + x];
      const ix = fi[y0 + xr] - fi[y0 + xl], iy = fi[yd + x] - fi[yu + x];
      const dr = (2 * abs(fr[p])) / sqrt(rx * rx + ry * ry + 1e-6), di = (2 * abs(fi[p])) / sqrt(ix * ix + iy * iy + 1e-6);
      const lr = dr < LW ? (1 - dr / LW) ** LP : 0, li = di < LW ? (1 - di / LW) ** LP : 0;
      // Im = 0 (crests and troughs) in the first colour, Re = 0 in the second.
      const v = li > lr ? li : lr, col = li > lr ? pc : mc;
      display.setPixel(x, y, round(255 * col[0] * v), round(255 * col[1] * v), round(255 * col[2] * v));
    }
  }
  const D = S.def;
  for (let j = 0; j < D.length; j += 3) {
    const x = round(D[j]), y = round(D[j + 1]), n = D[j + 2];
    // A small + for a +1 defect and a - for a -1.
    for (let e = -1; e <= 1; e++) {
      display.setPixel((x + e + W) % W, y % H, 255, 255, 255);
      if (n > 0 && e) display.setPixel(x % W, (y + e + H) % H, 255, 255, 255);
    }
  }
}
