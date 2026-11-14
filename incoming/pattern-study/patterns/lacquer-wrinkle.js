// ===== Patternflow pattern =====
// Title:   Lacquer Wrinkle
// Family:  cosmetic
// Idea:    A glossy lacquer skin on a soft base is squeezed by a stress whose direction and strength wander over the panel, so it wrinkles into satin stripes where the squeeze runs one way, bends them into herringbone chevrons where the direction turns and crumples into labyrinths where it squeezes both ways alike, while the reflection of a ring light sweeps over the crinkles.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: wrinkling of a stiff thin film on a soft substrate under compression (Ned Bowden, Scott Brittain, Anthony Evans, John Hutchinson and George Whitesides, Nature 1998, the experiments), Foppl-von Karman plate equations (August Foppl, 1907; Theodore von Karman, 1910) on a Winkler foundation (Emil Winkler, 1867), herringbone wrinkles of a film squeezed both ways (Xi Chen and John Hutchinson, 2004), all from memory; solved with Fourier modes and a stabilised semi-implicit step; Blinn-Phong highlights (James Blinn, 1977)
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..3, Scale=-1..1, Strain=-1..1
//
// Knob 1: Hue. Turns the lacquer round the wheel. At 0 it is a raspberry ink, rose on the crests, wine in the troughs and pale pink in the highlights; the highlights stay pale whatever the hue.
// Knob 2: Speed. How fast the skin relaxes, 1.6 to 9.6 relaxation times a second, and how fast the stress wanders, 0.66 to 1.93 times its pace at 1. At the opening 2 the fastest stress wave turns a radian in 2.7 s and the slowest in 10 s, and the lights move with it.
// Knob 3: Scale. The wrinkle wavelength, the balance of the skin's bending against the base: 8.3 LEDs at -1, 12 at the opening and 17.4 at 1.
// Knob 4: Strain. How hard the skin is squeezed: the mean squeeze is 1.26 times the buckling threshold at -1, 1.6 at the opening and 2.4 at 1, and the one-way part shrinks against it, so -1 gives shallow satin ripples in long parallel runs and 1 gives deep folds with more herringbone and labyrinth between the runs.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, abs, max, min, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- radix-2 FFT ----------------------------------------------------------------------------
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), c = new Float64Array(n / 2), s = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) (c[i] = cos((TAU * i) / n)), (s[i] = -sin((TAU * i) / n));
  return { n, rev, c, s };
}
const PX = plan(W), PY = plan(H);
const TR = new Float64Array(H), TI = new Float64Array(H);
function fft(p, re, im, o, inv) {
  const { n, rev, c, s } = p, sg = inv ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[o + i];
      re[o + i] = re[o + j];
      re[o + j] = t;
      t = im[o + i];
      im[o + i] = im[o + j];
      im[o + j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = o; i < o + n; i += len)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sg * s[t], a = i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}
function fft2(re, im, inv) {
  for (let y = 0; y < H; y++) fft(PX, re, im, y * W, inv);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) (TR[y] = re[y * W + x]), (TI[y] = im[y * W + x]);
    fft(PY, TR, TI, 0, inv);
    for (let y = 0; y < H; y++) (re[y * W + x] = TR[y]), (im[y * W + x] = TI[y]);
  }
}

// ---- the model ------------------------------------------------------------------------------
// w(x, y, t) is the deflection of the lacquer skin on the panel's own 64 by 128 torus. Overdamped Foppl-von Karman on an
// elastic foundation, with the squeeze written as a tensor P(x, t) that differs from place to place:
//   w_t = -(lap^2 w + qc^4 w) - 2 qc^2 Peff_ij w_ij + [phi, w],    lap^2 phi = -Y (w_xx w_yy - w_xy^2)
// lap^2 w is the skin bending and qc^4 w the soft base pushing back. Their balance sets the wavelength 2 pi / qc; on a Winkler
// base it is 2 pi (D / k)^(1/4), on a thick rubber base the same balance gives 2 pi h (Ef / 3 Es)^(1/3), the film thickness
// times the cube root of the stiffness ratio. Scale sets it. P is in units of the buckling threshold: wherever it passes 1
// along a direction, wrinkles with their wave vector along that direction grow, at 2 (P - 1) per time unit 1 / qc^4.
// Peff = P - 2.2 <grad w grad w>: the folds take up the squeeze themselves (the skin's spare length is stored in them), with
// the take-up averaged over a 4 by 4 block and one 1-2-1 pass, so the amplitude stops where the squeeze is used up. A set
// of stripes takes up the squeeze across them only, so what is left along them still acts.
// [phi, w] is the stretching that bending into a dome or a saddle forces on the skin (Y = 6 qc^2): one set of straight folds
// costs nothing, two crossing sets do. With the squeeze 2 one way and 1.25 the other, held uniform, the skin without it
// made an egg crate of two crossing sets and with it one set of stripes with kinks. Both ways at 2, it makes dimples.
// P = p I + d1 sz + d2 sx, p the mean squeeze and (d1, d2) the one-way part, whose axis turns as atan2(d2, d1) / 2. The
// minor axis p - |d| sits near the threshold: stripes where it falls below, herringbone where the axis turns fast,
// labyrinths and dimples round the points where |d| passes through 0. Each of p, d1, d2 is the real part of a sum of the 14
// longest waves of the torus (wavelengths of 45 to 128 LEDs, weighted by a Gaussian of 28 LEDs), each with a random
// complex amplitude and its own rate, 0.011 to 0.041 radians a unit of the stress clock (6 Speed^0.6 units a second),
// either way round. The mean squeeze and
// the one-way share also drift by sums of five sines with rates between 0.004 and 0.02. Nothing comes back round.
// The step: the linear part (q^2 - qc^2)^2 is divided out in Fourier space; the rest of the squeeze, the take-up and the
// stretching go in explicitly. The stretching is stiff, and at a step of 0.18 time units the skin went to NaN during the
// warm-up at Strain 1; a damping term 12 qc^4 is added on the implicit side and taken off on the explicit one, which
// leaves the state the skin settles to as it was and keeps a step of 0.22 stable at every knob setting.
// One step is four inverse transforms and one forward, each packing two real fields into one complex transform; the
// stretching of a step uses phi from the step before. 1 or 2 steps a frame.
// Measured under the study's seed, 240 s at 30 fps with a frame kept every half second, at the opening, all knobs at their
// minimum, all at their maximum and two mixed settings: recur 0.508 to 0.679, the darkest 16 by 16 cell 0.969 to 0.985 of
// the mean, the least-changing cell 0.824 to 0.940, first against last quarter within 4.1 percent. 900 s at the opening:
// recur 0.566, the least-changing cell 0.962, brightness first against last quarter +0.3 percent. 4 to 7 ms a frame in Node.
const CW = 16, CH = 32, CN = CW * CH, BS = 4; // coarse grid for the stress and the take-up, one node per 4 by 4 LEDs

function setup(params) {
  const f = () => new Float64Array(N);
  const S = {
    wr: f(), wi: f(), Kr: f(), Ki: f(),
    ar: f(), ai: f(), br: f(), bi: f(), cr: f(), ci: f(), dr: f(), di: f(), er: f(), ei: f(),
    QX: f(), QY: f(), MIR: new Int32Array(N), MASK: new Float64Array(N),
    // coarse fields: stress p, d1, d2 and take-up sums
    cp: new Float64Array(CN), c1: new Float64Array(CN), c2: new Float64Array(CN),
    sxx: new Float64Array(CN), syy: new Float64Array(CN), sxy: new Float64Array(CN), tmp: new Float64Array(CN),
    exx: new Float64Array(CN), eyy: new Float64Array(CN), exy: new Float64Array(CN),
    waves: null, t: 0, tl: 0, warm: false, lam: -9, c: new Float32Array(9),
  };
  for (let y = 0; y < H; y++) {
    const ky = (TAU * (y < H / 2 ? y : y - H)) / H;
    for (let x = 0; x < W; x++) {
      const kx = (TAU * (x < W / 2 ? x : x - W)) / W, p = y * W + x;
      S.QX[p] = kx;
      S.QY[p] = ky;
      S.MIR[p] = ((H - y) % H) * W + ((W - x) % W);
      S.MASK[p] = x === W / 2 || y === H / 2 ? 0 : 1;
    }
  }
  params.s = S;
  return S;
}

const gauss = () => sqrt(-2 * Math.log(Math.random() + 1e-12)) * cos(TAU * Math.random());

// Long waves for the three stress fields: (m, n) with wave vector (2 pi m / 64, 2 pi n / 128), a Gaussian spectrum of
// correlation length XS LEDs, each with a random complex amplitude and a rate of its own.
const XS = 28;
function wavesSetup(S) {
  const list = [];
  for (let n = -6; n <= 6; n++)
    for (let m = -3; m <= 3; m++) {
      if (!m && !n) continue;
      const kx = (TAU * m) / W, ky = (TAU * n) / H, k2 = kx * kx + ky * ky, env = exp(-0.25 * k2 * XS * XS);
      if (env < 0.02) continue;
      list.push({ kx, ky, env });
    }
  const F = [];
  for (let f = 0; f < 3; f++) {
    const ws = [];
    let v = 0;
    for (const L of list) {
      const a = L.env * gauss(), b = L.env * gauss();
      v += a * a + b * b;
      ws.push({ kx: L.kx, ky: L.ky, a, b, w: (0.011 + 0.03 * Math.random()) * (Math.random() < 0.5 ? -1 : 1) });
    }
    const g = 1 / sqrt(0.5 * v);
    for (const o of ws) (o.a *= g), (o.b *= g);
    F.push(ws);
  }
  S.waves = F;
  // temporal drift of the anisotropy and the mean squeeze, sums of sines with unrelated rates
  S.dw = [];
  for (let i = 0; i < 10; i++) S.dw.push({ w: 0.004 + 0.016 * Math.random(), p: TAU * Math.random() });
}
function fieldAt(ws, t, out) {
  for (let j = 0; j < CN; j++) out[j] = 0;
  for (const o of ws) {
    const c = cos(o.w * t), s = sin(o.w * t), A = o.a * c - o.b * s, B = o.a * s + o.b * c;
    for (let Y = 0; Y < CH; Y++) {
      const yy = Y * BS + 1.5;
      for (let X = 0; X < CW; X++) {
        const ph = o.kx * (X * BS + 1.5) + o.ky * yy;
        out[Y * CW + X] += A * cos(ph) - B * sin(ph);
      }
    }
  }
}

function stress(S, t, strain, ramp = 1) {
  fieldAt(S.waves[0], t, S.cp);
  fieldAt(S.waves[1], t, S.c1);
  fieldAt(S.waves[2], t, S.c2);
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) a += sin(S.dw[i].w * t + S.dw[i].p);
  for (let i = 5; i < 10; i++) b += sin(S.dw[i].w * t + S.dw[i].p);
  // e is the excess of the mean squeeze over the threshold; the deviatoric part is about as large, so the minor axis
  // hovers near the threshold: stripes where it falls below, herringbone where it is just above, labyrinths where the
  // squeeze is nearly the same both ways.
  const e = ramp * 0.6 * exp(0.85 * strain) * (1 + 0.1 * b), kap = 1.3 * exp(-0.3 * strain) * (1 + 0.12 * a);
  for (let j = 0; j < CN; j++) {
    S.cp[j] = 1 + e * (1 + 0.3 * S.cp[j]);
    S.c1[j] *= e * kap;
    S.c2[j] *= e * kap;
  }
}

const AT = 2.2, YB = 6, BETA = 12;
function step(S, h) {
  const { wr, wi, Kr, Ki, ar, ai, br, bi, cr, ci, dr, di, er, ei, QX, QY, MIR, MASK } = S;
  const qc = S.qc, qc2 = qc * qc, Y = YB * qc2;
  for (let p = 0; p < N; p++) {
    const qx = QX[p], qy = QY[p], xr = wr[p], xi = wi[p], qx2 = qx * qx, qy2 = qy * qy, qxy = qx * qy;
    ar[p] = -qx2 * xr + qy2 * xi;
    ai[p] = -qx2 * xi - qy2 * xr;
    br[p] = -qxy * xr - qy * xr;
    bi[p] = -qxy * xi - qy * xi;
    const q4 = (qx2 + qy2) * (qx2 + qy2), g = q4 > 0 ? -Y / q4 : 0, fr = g * Kr[p], fi = g * Ki[p];
    cr[p] = -qx2 * fr + qy2 * fi;
    ci[p] = -qx2 * fi - qy2 * fr;
    dr[p] = -qxy * fr - qx * xr;
    di[p] = -qxy * fi - qx * xi;
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  fft2(cr, ci, true);
  fft2(dr, di, true);
  // take-up: block means of grad w grad w on the coarse grid, then one 1-2-1 pass each way
  const { sxx, syy, sxy, tmp, exx, eyy, exy, cp, c1, c2 } = S;
  sxx.fill(0);
  syy.fill(0);
  sxy.fill(0);
  for (let y = 0; y < H; y++) {
    const ro = (y >> 2) * CW;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, gx = di[p], gy = bi[p], j = ro + (x >> 2);
      sxx[j] += gx * gx;
      syy[j] += gy * gy;
      sxy[j] += gx * gy;
    }
  }
  for (const a of [sxx, syy, sxy]) {
    for (let Yc = 0; Yc < CH; Yc++)
      for (let X = 0; X < CW; X++) tmp[Yc * CW + X] = 0.25 * a[Yc * CW + ((X + CW - 1) % CW)] + 0.5 * a[Yc * CW + X] + 0.25 * a[Yc * CW + ((X + 1) % CW)];
    for (let Yc = 0; Yc < CH; Yc++)
      for (let X = 0; X < CW; X++) a[Yc * CW + X] = (0.25 * tmp[((Yc + CH - 1) % CH) * CW + X] + 0.5 * tmp[Yc * CW + X] + 0.25 * tmp[((Yc + 1) % CH) * CW + X]) / 16;
  }
  // Peff - I on the coarse grid, times -2 qc^2 (the explicit part; the identity is solved implicitly)
  for (let j = 0; j < CN; j++) {
    exx[j] = -2 * qc2 * max(-2, cp[j] + c1[j] - AT * sxx[j] - 1);
    eyy[j] = -2 * qc2 * max(-2, cp[j] - c1[j] - AT * syy[j] - 1);
    exy[j] = -2 * qc2 * cl(c2[j] - AT * sxy[j], -3, 3);
  }
  const nz = 0.002 * qc2 * qc / sqrt(h);
  for (let y = 0; y < H; y++) {
    const fy = (y - 1.5) / BS, Y0 = floor(fy), ty = fy - Y0, ya = ((Y0 + CH) % CH) * CW, yb = ((Y0 + 1 + CH) % CH) * CW;
    for (let x = 0; x < W; x++) {
      const fx = (x - 1.5) / BS, X0 = floor(fx), tx = fx - X0, xa = (X0 + CW) % CW, xb = (X0 + 1 + CW) % CW;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const i00 = ya + xa, i10 = ya + xb, i01 = yb + xa, i11 = yb + xb;
      const Exx = w00 * exx[i00] + w10 * exx[i10] + w01 * exx[i01] + w11 * exx[i11];
      const Eyy = w00 * eyy[i00] + w10 * eyy[i10] + w01 * eyy[i01] + w11 * eyy[i11];
      const Exy = w00 * exy[i00] + w10 * exy[i10] + w01 * exy[i01] + w11 * exy[i11];
      const p = y * W + x, wxx = ar[p], wyy = ai[p], wxy = br[p];
      er[p] = wxx * wyy - wxy * wxy;
      ei[p] = Exx * wxx + Eyy * wyy + 2 * Exy * wxy + (ci[p] * wxx + cr[p] * wyy - 2 * dr[p] * wxy) + nz * (Math.random() - 0.5);
    }
  }
  fft2(er, ei, false);
  const inv = 1 / N, bt = BETA * qc2 * qc2;
  for (let p = 0; p < N; p++) {
    const m = MIR[p], zr = er[p], zi = ei[p], mr = er[m], mi = ei[m];
    Kr[p] = 0.5 * (zr + mr) * inv;
    Ki[p] = 0.5 * (zi - mi) * inv;
    const Rr = 0.5 * (zi + mi) * inv, Ri = -0.5 * (zr - mr) * inv;
    const q2 = QX[p] * QX[p] + QY[p] * QY[p], L = (q2 - qc2) * (q2 - qc2), dn = MASK[p] / (1 + h * (L + bt));
    wr[p] = (wr[p] + h * (Rr + bt * wr[p])) * dn;
    wi[p] = (wi[p] + h * (Ri + bt * wi[p])) * dn;
  }
}

const OPEN = [0, 2, 0, 0.06];
const HSTEP = 0.22; // largest step in units of 1 / qc^4
function advance(S, ft, k) {
  const speed = cl(k[1], 0.5, 3), strain = cl(k[3], -1, 1);
  const tau = ft * 3.2 * speed, n = max(1, Math.ceil(tau / HSTEP - 1e-9)), h = tau / n / (S.qc ** 4);
  S.t += ft * 6 * Math.pow(speed, 0.6);
  stress(S, S.t, strain);
  for (let i = 0; i < n; i++) step(S, h);
}

function setScale(S, scale) {
  const lam = 12 * Math.pow(1.45, scale);
  S.lam = lam;
  S.qc = TAU / lam;
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  S.k = k;
  const scale = cl(k[2], -1, 1);
  if (!S.warm) {
    S.warm = true;
    wavesSetup(S);
    setScale(S, scale);
    for (let p = 0; p < N; p++) (S.er[p] = 0.02 * gauss() / S.qc), (S.ei[p] = 0);
    fft2(S.er, S.ei, false);
    for (let p = 0; p < N; p++) (S.wr[p] = (S.er[p] / N) * S.MASK[p]), (S.wi[p] = (S.ei[p] / N) * S.MASK[p]);
    // The warm-up raises the squeeze from a fifth of its value to all of it over the first 150 steps. Squeezed from flat at
    // full strength, the fastest-growing wrinkles are shorter than 2 pi / qc (at P = 3.5 by a factor of 1.9), and at Strain 1
    // the panel opened with stripes 4 to 5 LEDs apart that took minutes to coarsen.
    S.t = 0;
    const h = HSTEP / S.qc ** 4;
    for (let i = 0; i < 250; i++) {
      if (i % 10 === 0) stress(S, 0, cl(k[3], -1, 1), min(1, 0.2 + i / 150));
      step(S, h);
    }
  }
  const target = 12 * Math.pow(1.45, scale);
  if (abs(target - S.lam) > 0.02) setScale(S, scale);
  advance(S, cl(dt || 0, 0, 0.1), k);
  S.tl += cl(dt || 0, 0, 0.1) * cl(k[1], 0.5, 3);
}

// ---- colour ---------------------------------------------------------------------------------
// Lacquer: a deep tint, rose on the crests and wine in the troughs where the coat pools (the height read as -lap w / qc),
// lit by a key light (Lambert for the body, Blinn-Phong with exponent 32 for the gloss) and a ring light. The surface is
// drawn with its slopes times 0.45, so a satin ripple at Strain -1 tilts the light less than a deep fold at 1. The swatch
// itself bends a little, a dome or a saddle whose centre and curvature wander, and the reflection of the ring light on it
// is a wide arc that sweeps over the panel; the wrinkles break the arc into dashes along their flanks. Each LED takes four
// samples a quarter LED off its centre with the slopes interpolated. Drawn at their full size, the slopes turned the
// reflected ray by about 0.9 from one LED to the next, and a ring highlight thinner than an LED showed as white speckles.
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const SX = new Float32Array(N), SY = new Float32Array(N);
// Gloss at one point of the surface with slopes (sx, sy): Blinn-Phong from the key light (exponent 32) plus the ring light.
let ring = 0;
function gloss(sx, sy, hx, hy, hz, rcx, rcy, rho, iw) {
  const nz = 1 / sqrt(1 + sx * sx + sy * sy), nx = -sx * nz, ny = -sy * nz;
  let nh = nx * hx + ny * hy + nz * hz;
  nh = nh > 0 ? nh * nh : 0;
  nh *= nh;
  nh *= nh;
  nh *= nh;
  nh *= nh; // ^32
  const rx = 2 * nz * nx - rcx, ry = 2 * nz * ny - rcy, rd = (sqrt(rx * rx + ry * ry) - rho) * iw, b = 1 - rd * rd;
  ring += b > 0 ? b * b : 0;
  return nh;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const k = S.k || OPEN, hue = 0.915 + k[0], c = S.c, t = S.tl;
  hsv(hue + 0.01, 0.6, 0.8, c, 0); // crest: thin coat
  hsv(hue - 0.01, 0.78, 0.46, c, 3); // trough: deep coat
  hsv(hue - 0.03, 0.12, 1.0, c, 6); // highlight
  const { ar, ai, bi, di } = S;
  const G = 0.45, qc = S.qc;
  for (let p = 0; p < N; p++) (SX[p] = di[p] * G), (SY[p] = bi[p] * G);
  // key light: azimuth and elevation wander on rates that share no ratio
  const az = 0.063 * t + 1.3 * sin(t * 0.031 + 1), el = 0.8 + 0.18 * sin(t * 0.047);
  const Lx = cos(az) * sin(el), Ly = sin(az) * sin(el), Lz = cos(el);
  let hx = Lx, hy = Ly, hz = Lz + 1;
  const hn = 1 / sqrt(hx * hx + hy * hy + hz * hz);
  hx *= hn;
  hy *= hn;
  hz *= hn;
  const rcx = 0.2 * sin(t * 0.053 + 2), rcy = 0.24 * sin(t * 0.041), rho = 0.85, iw = 1 / 0.09;
  // the swatch itself bends a little, a dome or a saddle whose centre wanders, so the ring light's reflection is a
  // wide arc that sweeps over the panel and the wrinkles break it into dashes
  const kx = 0.0045 * sin(t * 0.0237 + 0.4) + 0.0035, ky = 0.0035 * sin(t * 0.0171 + 2.1) + 0.0035;
  const bcx = 32 + 24 * sin(t * 0.0291 + 1.7), bcy = 64 + 48 * sin(t * 0.0209 + 0.3);
  const hs = 1 / (qc * 0.75);
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, xm = (x + W - 1) % W, xp = (x + 1) % W;
      const tx = kx * (x - bcx), ty = ky * (y - bcy), sx = SX[p] + tx, sy = SY[p] + ty;
      // four sub-samples a quarter LED off the centre, slopes interpolated from the neighbours, so a highlight
      // thinner than an LED shows as a dimmer LED rather than a speckle
      ring = 0;
      let sp = 0;
      for (let j = 0; j < 4; j++) {
        const qx = j & 1 ? xp : xm, qy = j & 2 ? op : om;
        const ax = 0.5625 * sx + 0.1875 * (SX[o + qx] + SX[qy + x] + 2 * tx) + 0.0625 * (SX[qy + qx] + tx);
        const ay = 0.5625 * sy + 0.1875 * (SY[o + qx] + SY[qy + x] + 2 * ty) + 0.0625 * (SY[qy + qx] + ty);
        sp += gloss(ax, ay, hx, hy, hz, rcx, rcy, rho, iw);
      }
      const wx = SX[p], wy = SY[p], nz = 1 / sqrt(1 + wx * wx + wy * wy);
      const dif = (-wx * Lx - wy * Ly + Lz) * nz / Lz;
      const u = sm(-0.9, 0.9, -(ar[p] + ai[p]) * hs);
      const lit = 0.3 + 0.7 * cl(dif, 0, 1.6);
      const gl = min(1, 0.16 * sp + 0.17 * ring);
      const r = (c[3] + (c[0] - c[3]) * u) * lit, g = (c[4] + (c[1] - c[4]) * u) * lit, b = (c[5] + (c[2] - c[5]) * u) * lit;
      // light that the gloss sends back is partly the tint lit up from inside the coat and partly white from its surface,
      // so a weak highlight on a deep trough comes out a brighter raspberry rather than a grey
      const gb = 1 + 1.3 * gl, gw = 0.5 * gl * gl;
      display.setPixel(x, y, min(255, 255 * (r * gb + (c[6] - r * gb) * gw)), min(255, 255 * (g * gb + (c[7] - g * gb) * gw)), min(255, 255 * (b * gb + (c[8] - b * gb) * gw)));
    }
  }
}
