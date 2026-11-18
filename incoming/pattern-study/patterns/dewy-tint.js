// ===== Patternflow pattern =====
// Title:   Dewy Tint
// Family:  cosmetic
// Idea:    A sheer film of tint on a pale base breaks open in holes whose rims gather into wet glossy beads under a slowly turning light, while unseen puffs of mist land here and there, melt the beads back into a smooth film and leave it to break up again.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the thin-film (lubrication) equation with a disjoining pressure; spinodal dewetting of a thin film (A. Vrij, 1966) as Guenter Reiter saw it in polymer films (1992); the (3,2) disjoining pressure over a precursor film (Leonard Schwartz and Richard Eley, 1998); a linearly stabilised semi-implicit Fourier step (Jingzhi Zhu, Long-Qing Chen, Jie Shen and Veena Tikare, 1999); collab reference for PERIPERA, after the water-glow finish (물광) of the Ink Mood Glowy Tint
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.6..3, Scale=-1..1, Mist=-1..1
//
// Knob 1: Hue. The tint, all the way round the wheel; at 0 it is a raspberry red, deep in the beads and pale where the film runs thin, and the base and the glints stay pale whatever the tint.
// Knob 2: Speed. How fast the film moves: at 2 a film the mist has left breaks into beads in about three seconds and a puff of mist lands about every 0.8 seconds; at 0.6 the film takes about ten seconds and the puffs come half again as far apart; at 3 the film moves half again as fast and the puffs come a little closer.
// Knob 3: Scale. How thick the film is, and so how far apart it breaks: a fresh film breaks up at a wavelength of about 7.5 LEDs at -1, 10 at the opening and 13 at 1, and the beads grow with it.
// Knob 4: Mist. How much mist each puff carries: at -1 a puff only slumps the beads it falls on, so they run together and coarsen into big drops; at the opening it melts them into a smooth film; at 1 it carries half again as much, lands a little more often and stays wet longer, so fresh film is breaking up all over the panel.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, abs, max, min, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- radix-2 FFT ----
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
// A real field's transform needs only the columns kx = 0..32. Two rows go
// through one complex transform as its real and imaginary parts, and the
// columns are kept one after another, H long, as the second pass reads them.
const KX = W / 2 + 1, NS = KX * H;
const ZR = new Float64Array(W), ZI = new Float64Array(W);
function rfft2(src, CR, CI) {
  for (let y = 0; y < H; y += 2) {
    const o = y * W;
    for (let x = 0; x < W; x++) (ZR[x] = src[o + x]), (ZI[x] = src[o + W + x]);
    fft(PX, ZR, ZI, 0, false);
    for (let k = 0; k < KX; k++) {
      const k2 = (W - k) & (W - 1), ar = ZR[k], ai = ZI[k], br = ZR[k2], bi = -ZI[k2], q = k * H + y;
      CR[q] = 0.5 * (ar + br);
      CI[q] = 0.5 * (ai + bi);
      CR[q + 1] = 0.5 * (ai - bi);
      CI[q + 1] = -0.5 * (ar - br);
    }
  }
  for (let k = 0; k < KX; k++) fft(PY, CR, CI, k * H, false);
}
function irfft2(CR, CI, dst) {
  for (let k = 0; k < KX; k++) fft(PY, CR, CI, k * H, true);
  const g = 1 / N;
  for (let y = 0; y < H; y += 2) {
    for (let k = 0; k < W; k++) {
      let ar, ai, br, bi;
      if (k < KX) {
        const q = k * H + y;
        (ar = CR[q]), (ai = CI[q]), (br = CR[q + 1]), (bi = CI[q + 1]);
      } else {
        const q = (W - k) * H + y;
        (ar = CR[q]), (ai = -CI[q]), (br = CR[q + 1]), (bi = -CI[q + 1]);
      }
      ZR[k] = ar - bi;
      ZI[k] = ai + br;
    }
    fft(PX, ZR, ZI, 0, true);
    const o = y * W;
    for (let x = 0; x < W; x++) (dst[o + x] = ZR[x] * g), (dst[o + W + x] = ZI[x] * g);
  }
}

// ---- the film ----
// What the tint is. One number h on every LED of the 64 by 128 torus, the thickness of a liquid film on the base, moved by the thin-film equation
//   dh/dt = div( M(h) grad mu ),   mu = -gamma lap h + f'(h),   f'(h) = B ((hp/h)^2 - (hp/h)^3)
// f'(h) is minus the disjoining pressure: the base attracts a film thicker than hp and repels a thinner one, so the film falls apart into beads
// with contact angle THETA (B = THETA^2 gamma / hp) that sit on a precursor film of thickness hp. A film thicker than 1.5 hp is unstable to
// ripples and the fastest of them grows at a wavelength set by its thickness (spinodal dewetting); a thinner one holds until something
// punctures it, and then the hole grows and pushes a rim ahead of it. The rims meet in a net and the net pinches into beads.
// The mobility is h^3, levelled off above HC hp so one tall bead does not set the step for the whole panel. Scale moves hp and every
// thickness with it, so the picture zooms while the contact angle stays put; model time runs with the scale so the zoom does not slow it.
// The step is semi-implicit in Fourier space: gamma A lap^2 - Sd lap is taken implicitly, with A and Sd following the largest mobility and
// the largest second-order term in the field, and the rest explicitly; at the opening it takes steps about fifteen times longer than an explicit step could.
// The amount of tint never changes: the transform keeps the mean, and what the floor at 0.3 hp or the roughness adds is taken back evenly.
// What was measured, 240 s at 30 fps with a frame kept every half second (8 by 8 LED means for recur, 16 by 16 LED cells for the rest), at the
// opening, all knobs at their minimum, all at their maximum and two other positions: recur 0.494 to 0.676, the darkest cell 0.942 to 0.989 of
// the mean, the least-changing cell 0.614 to 0.798 by level and 0.655 to 0.801 by luma, over the last quarter 0.398 to 0.670 and 0.451 to
// 0.723, and the first and last quarters within 1.7% in brightness. For 900 s at the opening: recur 0.508, brightness within 0.1%.
const HP0 = 0.5; // precursor film, in units of the scale s
const S0 = 0.37; // the scale s at the opening
const HBAR = 2.6; // mean thickness, in precursor units
const NZ = 0.012; // thermal roughness
const HC = 4; // the mobility h^3 levels off above this many precursor thicknesses
const THETA = 0.75; // contact angle, radians
const GAM = 1;
const LR = 8; // reach of the levelling, LEDs at the opening Scale
const LEV = 0.25; // panel seconds for the mist to level the film it lies on, at Speed 2
const DT0 = 3.0; // largest step at s = 1
const RATE = 160; // model time a panel second at Speed 1, s = 1
const PUFF = 0.5; // panel seconds a puff of mist takes to land at Speed 2
const GAP = 0.8; // mean panel seconds between puffs at Speed 2, Mist 0, Scale 0
const DRY = 1.2; // panel seconds for the mist to dry to a third at Speed 2
const OPEN = [0, 2, 0, 0.06];

function setup(params) {
  const f = () => new Float64Array(N), g = () => new Float64Array(NS);
  const S = {
    h: f(), mu: f(), mob: f(), R: f(), dh: f(), wet: f(), om: f(),
    CR: g(), CI: g(), lam: g(), inv: g(),
    anyWet: 0, dust: 0, cell: new Float64Array(128), last: new Float64Array(128), t: 0, warm: false, s: -1, A: 1, Sd: 0.1, dtc: -1, hue: 0, puffs: [], nextAt: 0,
    lw: new Float64Array(6), lp: new Float64Array(6), c: new Float64Array(12),
  };
  for (let k = 0; k < KX; k++)
    for (let y = 0; y < H; y++) S.lam[k * H + y] = 2 * cos((TAU * k) / W) + 2 * cos((TAU * y) / H) - 4;
  params.s = S;
  return S;
}

// ---- the mist ----
// Unseen puffs of mist land one after another at random places. Where the
// mist lies, the tint wets the base: the attracting (hp/h)^2 term fades out,
// the film levels (see level), and the beads slump and run together into a
// film. As it dries the film is unstable again and breaks up anew. Of three
// random places the mist takes the one it left longest ago (kept on 8 by 8
// LED cells), so it wanders over the whole panel instead of piling up.
function spawnPuff(S, s, k4) {
  const r = (8 + 7 * Math.random()) * sqrt(s / S0), asp = 1 + 0.8 * Math.random();
  const rx = r * sqrt(asp), ry = r / sqrt(asp), a = PI * Math.random(), ca = cos(a), sa = sin(a);
  const R = Math.ceil(2.2 * max(rx, ry)), D = 2 * R + 1, fp = new Float32Array(D * D);
  for (let j = 0; j < D; j++)
    for (let i = 0; i < D; i++) {
      const u = (i - R) * ca + (j - R) * sa, v = -(i - R) * sa + (j - R) * ca, d2 = (u * u) / (rx * rx) + (v * v) / (ry * ry);
      fp[j * D + i] = d2 < 4.8 ? exp(-d2) : 0;
    }
  const dur = PUFF * RATE * 2 * s * (0.7 + 0.6 * Math.random());
  // how much mist lands at the centre: under 1 the beads only slump, over 1 they melt flat
  const dose = (1.2 + 0.8 * Math.random()) * exp(0.4 * k4);
  let x = 0, y = 0, best = Infinity;
  for (let c = 0; c < 3; c++) {
    const cx = floor(W * Math.random()), cy = floor(H * Math.random()), l = S.last[(cy >> 3) * 8 + (cx >> 3)];
    if (l < best) (best = l), (x = cx), (y = cy);
  }
  S.puffs.push({ x, y, R, D, fp, rate: dose / dur, left: dur });
}

function mistField(S, s, tt, k4, speed) {
  const { wet, om } = S;
  // the mist dries
  const dk = exp(-tt / (DRY * RATE * 2 * s));
  for (let p = 0; p < N; p++) wet[p] *= dk;
  const gap = GAP * RATE * speed * s * (s / S0) * pow(2 / speed, 0.35) * exp(-0.2 * k4);
  S.nextAt -= tt;
  while (S.nextAt <= 0) {
    spawnPuff(S, s, k4);
    S.nextAt += -Math.log(1 - Math.random() * 0.999) * gap;
  }
  for (let n = S.puffs.length - 1; n >= 0; n--) {
    const P = S.puffs[n], a = P.rate * min(tt, P.left);
    for (let j = 0; j < P.D; j++) {
      const o = ((P.y + j - P.R + 8 * H) % H) * W;
      for (let i = 0; i < P.D; i++) {
        const f = P.fp[j * P.D + i];
        if (f > 0) wet[o + ((P.x + i - P.R + 8 * W) % W)] += f * a;
      }
    }
    P.left -= tt;
    if (P.left <= 0) S.puffs.splice(n, 1);
  }
  const cell = S.cell;
  cell.fill(0);
  for (let p = 0; p < N; p++) {
    const w = sstep(0.25, 0.7, wet[p]);
    om[p] = w;
    cell[((p >> 9) << 3) + ((p & 63) >> 3)] += w;
  }
  S.anyWet = 0;
  for (let c = 0; c < 128; c++) {
    if (cell[c] > 20) S.last[c] = S.t;
    if (cell[c] > 0) S.anyWet = 1;
  }
}

function operator(S, dt) {
  // the stabiliser, A gamma lap^2 - Sd lap, taken implicitly
  const { lam, inv, A, Sd } = S;
  for (let p = 0; p < NS; p++) {
    const l = lam[p];
    inv[p] = dt / (1 + dt * (A * GAM * l * l - Sd * l));
  }
  S.dtc = dt;
}

function step(S, s, dt) {
  const { h, mu, mob, R, dh, om, CR, CI, inv } = S;
  const hp = HP0 * s, B = (THETA * THETA * GAM) / hp, hmin = 0.3 * hp, hc3 = (HC * hp) ** 3;
  // chemical potential and mobility
  let mmax = 0, smax = 0;
  for (let y = 0; y < H; y++) {
    const o = y * W, ym = ((y + H - 1) % H) * W, yp = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, v = h[p], w = om[p];
      const lap = h[o + ((x + W - 1) % W)] + h[o + ((x + 1) % W)] + h[ym + x] + h[yp + x] - 4 * v;
      const r = hp / v, r2 = r * r, a = 1 - w;
      mu[p] = -GAM * lap + B * r2 * (a - r);
      const v3 = v * v * v, m = (v3 * hc3) / (v3 + hc3);
      mob[p] = m;
      if (m > mmax) mmax = m;
      // M f'', the second-order part, for the stabiliser
      const d = (m * B * r2 * (3 * r - 2 * a)) / v;
      if (d > smax) smax = d;
    }
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, yp = ((y + 1) % H) * W, ym = ((y + H - 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, xp = o + ((x + 1) % W), xm = o + ((x + W - 1) % W), m = mob[p], u = mu[p];
      R[p] =
        0.5 * ((m + mob[xp]) * (mu[xp] - u) - (m + mob[xm]) * (u - mu[xm]) + (m + mob[yp + x]) * (mu[yp + x] - u) - (m + mob[ym + x]) * (u - mu[ym + x]));
    }
  }
  if (mmax > S.A || mmax < S.A * 0.4 || smax > S.Sd * 1.6 || smax < S.Sd * 0.5) {
    S.A = mmax * 1.25;
    S.Sd = smax * 0.75;
    operator(S, dt);
  }
  rfft2(R, CR, CI);
  for (let p = 0; p < NS; p++) (CR[p] *= inv[p]), (CI[p] *= inv[p]);
  irfft2(CR, CI, dh);
  // a faint thermal roughness, which is what the film breaks up from
  const nz = NZ * hp * sqrt(dt / (DT0 * s));
  // (only where there is film to break, and with its mean taken back out)
  let lost = 0;
  for (let p = 0; p < N; p++) {
    let v = h[p] + dh[p];
    if (h[p] > 1.8 * hp) {
      const e = nz * (Math.random() - 0.5);
      v += e;
      lost -= e;
    }
    if (v < hmin) (lost += hmin - v), (v = hmin);
    h[p] = v;
  }
  const d = lost / N;
  for (let p = 0; p < N; p++) h[p] -= d;
}

// Where the mist lies the tint runs thin and levels: each frame the film
// there moves part of the way toward its own mean over a few LEDs (a box
// blur, twice each way). What that moves is put back evenly, so the panel
// holds the same amount of tint.
function level(S, f, s) {
  if (!S.anyWet) return;
  const { h, om, dh, R } = S, r = max(3, Math.round((LR * s) / S0));
  blur(h, dh, R, r);
  blur(dh, R, dh, r);
  let moved = 0, any = 0;
  for (let p = 0; p < N; p++) {
    const w = om[p] * f;
    if (w > 0) {
      const d = w * (R[p] - h[p]);
      h[p] += d;
      moved += d;
      any = 1;
    }
  }
  if (any) {
    const d = moved / N;
    for (let p = 0; p < N; p++) h[p] -= d;
  }
}
// running box mean of radius r along x, then along y; src -> out, tmp between
function blur(src, out, tmp, r) {
  const g = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let a = 0;
    for (let i = -r; i <= r; i++) a += src[o + ((i + W) % W)];
    for (let x = 0; x < W; x++) {
      tmp[o + x] = a * g;
      a += src[o + ((x + r + 1) % W)] - src[o + ((x - r + W) % W)];
    }
  }
  for (let x = 0; x < W; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += tmp[((i + H) % H) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = a * g;
      a += tmp[((y + r + 1) % H) * W + x] - tmp[((y - r + H) % H) * W + x];
    }
  }
}

// A film too thin to break up by itself (under 1.5 precursor thicknesses
// the (3,2) pressure leaves it stable to small ripples) still opens where a
// speck of dust sits. Specks land at random; where one lands on dry film it
// presses a small dimple and lifts the same volume into a ring round it,
// and the dimple grows into a hole if the film is unstable there.
const DUST = 24; // specks a panel second at Speed 2
const KER = [];
for (let j = -4; j <= 4; j++)
  for (let i = -4; i <= 4; i++) {
    const r2 = i * i + j * j;
    if (r2 <= 16) KER.push(i, j, exp(-r2 / 1.6) - 0.215 * exp(-r2 / 7.5));
  }
function nucleate(S, s, tt) {
  const { h, om } = S, hp = HP0 * s, sc = sqrt(s / S0);
  let m = 0;
  for (let i = 2; i < KER.length; i += 3) m += KER[i];
  S.dust += (DUST * tt) / (RATE * 2 * s);
  while (S.dust >= 1) {
    S.dust -= 1;
    const x = floor(W * Math.random()), y = floor(H * Math.random()), p = y * W + x, v = h[p];
    if (om[p] > 0.1 || v < 1.15 * hp || v > 3.5 * hp) continue;
    const a = 1.2 * (v - hp);
    for (let i = 0; i < KER.length; i += 3) {
      const q = ((y + Math.round(KER[i + 1] * sc) + H) % H) * W + ((x + Math.round(KER[i] * sc) + W) % W);
      h[q] -= a * (KER[i + 2] - m / (KER.length / 3));
    }
  }
}

function scaleOf(k) {
  return S0 * pow(1.33, cl(k[2], -1, 1));
}

function advance(S, ft, k) {
  const s = scaleOf(k), speed = cl(k[1], 0.6, 3), k4 = cl(k[3], -1, 1);
  if (abs(s - S.s) > 1e-6) {
    // rescale the film so its shape is kept
    if (S.s > 0) for (let p = 0; p < N; p++) S.h[p] *= s / S.s;
    S.s = s;
    S.dtc = -1;
  }
  const tt = ft * RATE * speed * s, n = max(1, Math.ceil(tt / (DT0 * s) - 1e-9)), dt = tt / n;
  if (abs(dt - S.dtc) > 1e-9) operator(S, dt);
  mistField(S, s, tt, k4, speed);
  level(S, 1 - exp(-tt / (LEV * RATE * 2 * s)), s);
  nucleate(S, s, tt);
  for (let i = 0; i < n; i++) {
    S.t += dt;
    step(S, s, dt);
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  S.hue = k[0];
  if (!S.warm) {
    S.warm = true;
    for (let i = 0; i < 6; i++) (S.lw[i] = 0.5 + Math.random()), (S.lp[i] = TAU * Math.random());
    const s = scaleOf(k);
    S.s = s;
    for (let p = 0; p < N; p++) S.h[p] = HBAR * HP0 * s * (1 + 0.02 * (Math.random() - 0.5));
    for (let i = 0; i < 120; i++) advance(S, 1 / 30, [k[0], 3, k[2], k[3]]);
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- colour ----
// The film takes its colour as light through a dye does (Beer-Lambert): each channel falls as exp(-a h), with a large where the tint absorbs,
// so a thin film is a pale wash and a bead runs deep. The precursor film counts as bare base. The surface slope gives the shine: a sharp
// glint (Blinn-Phong, power 64) from a light whose bearing wanders on three sines with random rates, and on the light's far side of each
// bead the colour runs lighter, the near side deeper, as light through a drop gathers behind it. Only the wet film shines; the base is matte.
// The firmware raises saturation by 1.62, so the tint goes in at 0.9 and the base at 0.022.
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { h, c } = S, s = S.s, hp = HP0 * s, th0 = 1 / (HBAR * hp);
  const hue = 0.925 + S.hue;
  hsv(hue, 0.9, 1, c, 0);
  hsv(hue + 0.12, 0.022, 0.95, c, 3); // pale base
  const KA = 0.9, K0 = 0.075;
  const a0 = KA * (1 - c[0]) + K0, a1 = KA * (1 - c[1]) + K0, a2 = KA * (1 - c[2]) + K0;
  // the light's bearing; its clock is model time over the scale, so Speed moves it and Scale does not
  const t = (S.t * 0.0015) / s;
  let az = 0;
  for (let i = 0; i < 3; i++) az += 1.1 * sin(S.lw[i] * t + S.lp[i]);
  const el = 0.95, ce = cos(el);
  const lx = ce * cos(az), ly = ce * sin(az), lz = sin(el);
  let hx = lx, hy = ly, hz = lz + 1;
  const hn = sqrt(hx * hx + hy * hy + hz * hz);
  (hx /= hn), (hy /= hn), (hz /= hn);
  const vs = 1.2 / s;
  // a broad soft light, a window seen in the wet film: soft bands about 90
  // LEDs apart that drift and turn, bent by the slope of the film
  let ba = 0, bp = 0;
  for (let i = 3; i < 6; i++) (ba += 0.9 * sin(S.lw[i] * t * 0.7 + S.lp[i])), (bp += 40 * sin(S.lw[i] * t * 0.5 + 2 * S.lp[i]));
  const cb = cos(ba), sb = sin(ba), kb = TAU / 90;
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x;
      const th = max(0, h[p] - 0.9 * hp) * th0, wf = sstep(0.04, 0.35, th);
      const gx = (h[o + ((x + 1) % W)] - h[o + ((x + W - 1) % W)]) * 0.5 * vs, gy = (h[op + x] - h[om + x]) * 0.5 * vs;
      const nn = 1 / sqrt(1 + gx * gx + gy * gy);
      // how far the surface turns toward the light (+) or away from it (-)
      const nl = ((-gx * lx - gy * ly) * nn) / ce;
      const nh = max(0, (-gx * hx - gy * hy + hz) * nn);
      const n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, n64 = n8 * n8 * n8 * n8 * n8 * n8 * n8 * n8;
      const bw = 0.5 + 0.5 * cos(kb * (x * cb + y * sb - 14 * (gx * cb + gy * sb)) - bp * kb), b2 = bw * bw, b4 = b2 * b2;
      const sp = (n64 * 0.85 + n8 * 0.05 + b4 * b4 * 0.13) * wf;
      // light through a bead gathers on its far side and leaves the near side deep
      const te = th * (1 - 0.4 * sstep(0, 0.7, -nl) + 0.3 * sstep(0, 0.7, nl));
      const r = c[3] * exp(-a0 * te) + sp, g = c[4] * exp(-a1 * te) + sp, b = c[5] * exp(-a2 * te) + sp;
      display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
  }
}
