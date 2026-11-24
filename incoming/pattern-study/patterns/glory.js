// ===== Patternflow pattern =====
// Title:   Glory
// Family:  glory
// Idea:    Looking down on a deck of cumulus with the sun behind you, coloured rings of diffracted light (blue inside, red outside) sit round the antisolar point, crowd tighter where the droplets are bigger, bend and pinch as the droplet size shifts across the cloud, and breathe as the drops grow and shrink.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the glory, backscatter of sunlight by cloud droplets (Mie scattering, Gustav Mie 1908; the surface-wave theory of Herch Moyses Nussenzveig, 1979, from memory), with the Airy form I(theta) = J0(x sin theta)^2 and x = 2 pi a / lambda per colour, averaged over a narrow spread of droplet radii (Abramowitz and Stegun for J0, from memory), pattern round 237
// Round:   237
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drops=0..4, Relief=-1..1, Wander=-1..1
//
// Knob 1: Hue. Turns the colours of the rings round the wheel, and sways the tint of the cloud about 30 degrees either way, so the cloud stays in the blues and violets. At 0 the rings run from blue on the inside to red on the outside, over lilac cloud and dark blue ground.
// Knob 2: Drops. 0 to 4, opening at 2. The mean droplet radius: 6 um at 0, 9.5 um at 2, 15 um at 4. Bigger drops pack the rings tighter. At 2 the red rings sit 9.9, 18.2 and 26.4 LEDs from the glory and the blue ones 7.0, 12.7 and 18.5. At 0 the red ones are 15.7 and 28.8 LEDs out and only two or three rings show. At 4 they are 6.3, 11.5, 16.7 and 21.9 LEDs out, and because big drops come in a narrower spread of sizes five or six rings stay clear.
// Knob 3: Relief. -1 to 1, opening at 0. The cloud top itself. At -1 it is smooth flat stratus with no gaps and a soft light. At 0 it is cumulus with lit tops, shaded sides and a few gaps down to the ground. At 1 it is rough broken cumulus with deep blue shadows, and the dark ground shows through about a third of the panel. Around the glory the cloud always holds, and the glory is weaker where the cloud is thin or in shadow.
// Knob 4: Wander. -1 to 1, opening near 0. How much moves. At -1 the cloud still drifts, at about 1 LED a second, but the rings stay where they are: the centre of the glory does not swing and the droplet size field hardly changes. At 1 the cloud streams at about 4 LEDs a second, the centre swings by up to 8 LEDs across and 9 down, the droplet size breathes by about 20 percent and its field churns, so the rings bend, pinch and swell.

const W = 64, H = 128, NPX = W * H, GW = W + 2, GH = H + 2;
const { floor, abs, min, max, sqrt, exp, pow, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- Bessel J0 ------------------------------------------------------------
// The power series up to x = 8, and the asymptotic cosine form (Abramowitz and Stegun 9.4.3) above it.
function j0(x) {
  x = abs(x);
  if (x < 8) {
    const q = x * x * 0.25;
    let term = 1, s = 1;
    for (let k = 1; k < 60; k++) {
      term *= -q / (k * k);
      s += term;
      if (abs(term) < 1e-10) break;
    }
    return s;
  }
  const z = 8 / x, y = z * z;
  const p = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const q = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934945152e-7)));
  const xx = x - 0.785398164;
  return sqrt(0.636619772 / x) * (cos(xx) * p - z * sin(xx) * q);
}

// ---- the ring table -------------------------------------------------------
// The glory's intensity at angle theta from the exact backward direction is J0(x theta)^2 with
// x = 2 pi a / lambda. On the panel u = (distance from the glory centre in LEDs) times (the local
// droplet radius over 9.8 um), and the argument is u * K0 * 0.53 / lambda, so the first red ring
// of 9.8 um drops sits near 9.5 LEDs. Each colour channel has its own lambda (R 0.64, G 0.53,
// B 0.45 um), so the blue rings lie inside the red ones. The table is averaged over 9 droplet radii
// within 12 percent of the mean and over 3 wavelengths of each colour band, which is what fades the
// rings with order: two to four are seen.
const CHROMA = 1.7, GAIN = 8, TINT = 1.6, LIGHT = 0.55;
const K0 = 0.465, LUT_N = 2600, LUT_STEP = 0.08;
const LAM = [0.64, 0.53, 0.45], BAND = 0.03, NSZ = 9;
const SPREAD_BROAD = 0.14, SPREAD_NARROW = 0.05;
function buildLut(spread) {
  const lut = new Float32Array(3 * (LUT_N + 2));
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i <= LUT_N + 1; i++) {
      const u = i * LUT_STEP;
      let sum = 0, ws = 0;
      for (let j = 0; j < NSZ; j++) {
        const f = (j - (NSZ - 1) / 2) / ((NSZ - 1) / 2);
        const w = exp(-1.3 * f * f), s = 1 + spread * f;
        for (let b = -1; b <= 1; b++) {
          const lam = LAM[c] + BAND * b;
          const v = j0(u * s * K0 * 0.53 / lam);
          sum += w * v * v;
          ws += w;
        }
      }
      lut[c * (LUT_N + 2) + i] = sum / ws;
    }
  }
  return lut;
}

// ---- noise ----------------------------------------------------------------
// Gradient noise on a 256 x 256 lattice of random unit vectors, scaled to run about 0 to 1 with
// its mean at 0.5. It has no square cells to show, which value noise has when it is stretched.
function vn(lat, x, y) {
  const ix = floor(x), iy = floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const x0 = ix & 255, x1 = (ix + 1) & 255, y0 = (iy & 255) << 8, y1 = ((iy + 1) & 255) << 8;
  const i00 = (y0 + x0) << 1, i10 = (y0 + x1) << 1, i01 = (y1 + x0) << 1, i11 = (y1 + x1) << 1;
  const a = lat[i00] * fx + lat[i00 + 1] * fy;
  const b = lat[i10] * (fx - 1) + lat[i10 + 1] * fy;
  const c = lat[i01] * fx + lat[i01 + 1] * (fy - 1);
  const d = lat[i11] * (fx - 1) + lat[i11 + 1] * (fy - 1);
  return 0.5 + 0.72 * (a + (b - a) * ux + (c - a + (a - b - c + d) * ux) * uy);
}

// ---- the weather ----------------------------------------------------------
// A slow variable: a sum of three sines whose periods share no factor.
const slow = (t, a, p, ph) => a[0] * sin((TAU * t) / p[0] + ph[0]) + a[1] * sin((TAU * t) / p[1] + ph[1]) + a[2] * sin((TAU * t) / p[2] + ph[2]);
const rph = () => [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU];

const OCT = 4;
const FREQ = [1 / 34, 1 / 17, 1 / 8.5, 1 / 4.4];
const ANG = [0.31, -0.72, 1.12, -0.18];
const SHEAR = [0, 0.16, -0.22, 0.4];
const SPD = [1, 1.18, 1.42, 1.75];
const BILL = [1, 1, 0.7, 0.25]; // how far each octave is folded into rounded tops; the finest stays soft

// The cloud: four octaves of the gradient noise, each turned to its own angle and carried by the
// wind at its own speed, the sum bent a little by a slow field. pers is how much each octave
// keeps of the one before and bill how far the noise is folded into rounded tops with creases.
function prepOct(o, p, pers, bill) {
  o.bill = bill;
  o.asum = 0;
  for (let i = 0; i < OCT; i++) {
    o.amp[i] = pow(pers, i);
    o.asum += o.amp[i];
    o.ca[i] = cos(ANG[i]) * FREQ[i];
    o.sa[i] = sin(ANG[i]) * FREQ[i];
    o.cu[i] = (p[2 * i] * cos(ANG[i]) + p[2 * i + 1] * sin(ANG[i])) * FREQ[i] + 17.3 * i;
    o.cv[i] = (-p[2 * i] * sin(ANG[i]) + p[2 * i + 1] * cos(ANG[i])) * FREQ[i] + 5.9 * i;
  }
  o.wx = p[2 * OCT];
  o.wy = p[2 * OCT + 1];
  return o;
}
function cloudAt(lat, o, x, y) {
  const qx = x + (vn(lat, (x + o.wx) * 0.03 + 3.1, (y + o.wy) * 0.03 + 8.3) - 0.5) * 8;
  const qy = y + (vn(lat, (x + o.wx) * 0.03 + 91.7, (y + o.wy) * 0.03 + 40.2) - 0.5) * 8;
  let h = 0;
  for (let i = 0; i < OCT; i++) {
    const n = vn(lat, qx * o.ca[i] + qy * o.sa[i] + o.cu[i], -qx * o.sa[i] + qy * o.ca[i] + o.cv[i]);
    const b = abs(2 * n - 1);
    h += o.amp[i] * (n + (b - n) * o.bill * BILL[i]);
  }
  return h / o.asum;
}
const newOct = () => ({ amp: new Float64Array(OCT), ca: new Float64Array(OCT), sa: new Float64Array(OCT), cu: new Float64Array(OCT), cv: new Float64Array(OCT), bill: 0, asum: 1, wx: 0, wy: 0 });

// The droplet size field: two octaves of the noise, about 0 either way.
const DROP_GAIN = 0.55;
const dropAt = (lat, dp, x, y) =>
  vn(lat, (x + dp[0]) * 0.018 + 11.2, (y + dp[1]) * 0.018 + 2.7) - 0.5 + 0.5 * (vn(lat, (x + dp[2]) * 0.034 + 61.7, (y + dp[3]) * 0.034 + 14.1) - 0.5);

export function setup(params) {
  const lat = new Float32Array(131072);
  for (let i = 0; i < 65536; i++) {
    const a = Math.random() * TAU;
    lat[2 * i] = cos(a);
    lat[2 * i + 1] = sin(a);
  }
  const st = {
    k: [0, 2, 0, 0.06],
    t: 0,
    lat,
    lutA: buildLut(SPREAD_BROAD),
    lutB: buildLut(SPREAD_NARROW),
    // The phases start at 0 so the glory opens at its middle place and its mean size.
    ph: { wind: rph(), spd: rph(), cx: [0, 0], cy: [0, 0], br: [0, 0, 0] },
    pos: new Float64Array(2 * OCT + 6), // the cloud octaves, the warp field and the droplet size fields
    oc: newOct(),
    h: new Float32Array(GW * GH),
    gx: 32, gy: 50, gs: 1,
  };
  params.st = st;
  openingWeather(st);
}

// Try 28 skies and 28 droplet fields and keep the best for the first frame: round cloud with lit
// tops and shaded sides about the glory, and a droplet size that stays near its mean there so the
// rings open round.
function openingWeather(st) {
  const p = st.pos, lat = st.lat, o = newOct();
  const cand = new Float64Array(2 * OCT + 2);
  let best = -1e9;
  for (let n = 0; n < 28; n++) {
    for (let i = 0; i < cand.length; i++) cand[i] = Math.random() * 400;
    prepOct(o, cand, 0.4, 0.55);
    const zs = [], win = [];
    let sum = 0, sum2 = 0;
    for (let y = 6; y < 128; y += 8) {
      for (let x = 3; x < 64; x += 6) {
        const h = cloudAt(lat, o, x, y);
        sum += h;
        sum2 += h * h;
        zs.push(h);
        if ((x - 32) * (x - 32) + (y - 50) * (y - 50) < 576) win.push(h);
      }
    }
    const mu = sum / zs.length, sd = sqrt(max(1e-9, sum2 / zs.length - mu * mu));
    let lit = 0, cover = 0, wm = 0, w2 = 0;
    for (const h of win) {
      const z = (h - mu) / sd;
      if (z > 0.3) lit++;
      if (z > -1) cover++;
      wm += z;
      w2 += z * z;
    }
    const nw = win.length, wsd = sqrt(max(0, w2 / nw - (wm / nw) * (wm / nw)));
    const score = -2 * abs(lit / nw - 0.4) - abs(wsd - 0.85) - (cover / nw < 0.95 ? 1 : 0) - abs(wm / nw);
    if (score > best) {
      best = score;
      for (let i = 0; i < 2 * OCT + 2; i++) p[i] = cand[i];
    }
  }
  best = 1e9;
  const dp = [0, 0, 0, 0], bestDp = [0, 0, 0, 0];
  for (let n = 0; n < 28; n++) {
    for (let i = 0; i < 4; i++) dp[i] = Math.random() * 400;
    let lo = 1e9, hi = -1e9, sum = 0, cnt = 0;
    for (let ring = 0; ring < 2; ring++) {
      for (let j = 0; j < 16; j++) {
        const a = (TAU * j) / 16, rr = ring ? 18 : 9;
        const v = dropAt(lat, dp, 32 + rr * cos(a), 50 + rr * sin(a));
        lo = min(lo, v);
        hi = max(hi, v);
        sum += v;
        cnt++;
      }
    }
    const sc = hi - lo + 2 * abs(sum / cnt);
    if (sc < best) {
      best = sc;
      for (let i = 0; i < 4; i++) bestDp[i] = dp[i];
    }
  }
  for (let i = 0; i < 4; i++) p[2 * OCT + 2 + i] = bestDp[i];
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st;
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 4), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  const d = cl(dt || 0, 0, 0.1);
  st.t += d;
  const t = st.t, w = 0.5 + 0.5 * st.k[3];
  st.wander = w;
  const ph = st.ph;
  // The wind: its heading wanders round slowly and its speed swells and fades.
  const head = 0.7 + slow(t, [0.9, 0.6, 0.35], [83, 151, 281], ph.wind);
  const speed = (0.9 + 2.6 * w) * (1 + slow(t, [0.18, 0.12, 0.08], [67, 131, 223], ph.spd));
  const p = st.pos;
  for (let o = 0; o < OCT; o++) {
    const a = head + SHEAR[o];
    p[2 * o] += cos(a) * speed * SPD[o] * d;
    p[2 * o + 1] += sin(a) * speed * SPD[o] * d;
  }
  // The warp field drifts with the wind, the droplet size fields go their own ways, faster as Wander rises.
  p[2 * OCT] += cos(head - 0.5) * speed * 0.7 * d;
  p[2 * OCT + 1] += sin(head - 0.5) * speed * 0.7 * d;
  const dv = 0.15 + 2.2 * w * w;
  p[2 * OCT + 2] += cos(head + 2.1) * dv * 0.9 * d;
  p[2 * OCT + 3] += sin(head + 2.1) * dv * 0.9 * d;
  p[2 * OCT + 4] += cos(head - 1.7) * dv * 0.6 * d;
  p[2 * OCT + 5] += sin(head - 1.7) * dv * 0.6 * d;
  // The glory centre swings about (32, 50) as the plane rocks; at Wander -1 it holds still.
  st.gx = 32 + w * (5.2 * sin((TAU * t) / 41 + ph.cx[0]) + 2.8 * sin((TAU * t) / 23 + ph.cx[1]));
  st.gy = 50 + w * (6 * sin((TAU * t) / 53 + ph.cy[0]) + 3 * sin((TAU * t) / 29 + ph.cy[1]));
  // The droplet radius breathes about its mean.
  st.gs = exp(w * (0.11 * sin((TAU * t) / 37 + ph.br[0]) + 0.07 * sin((TAU * t) / 61 + ph.br[1]) + 0.05 * sin((TAU * t) / 19 + ph.br[2])));
}

// A ring colour deviation d brightens its channel in full and dims it less, so the rings stay pastel.
const tint = (d) => 1 + TINT * (d > 0 ? d : 0.4 * d);

function hueMatrix(a, m) {
  const c = cos(a), s = sin(a), r = (1 - c) / 3, q = sqrt(1 / 3) * s;
  m[0] = c + r; m[1] = r - q; m[2] = r + q;
  m[3] = r + q; m[4] = c + r; m[5] = r - q;
  m[6] = r - q; m[7] = r + q; m[8] = c + r;
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const k = st.k, lat = st.lat, lutA = st.lutA, lutB = st.lutB, p = st.pos, hgrid = st.h;
  // Small drops come in a wider spread of sizes, so their rings fade sooner; big ones in a narrow one.
  const wb = k[1] / 4, wa = 1 - wb;
  const rel = 0.5 + 0.5 * k[2];
  // The droplet radius from the knob: 6 um at 0, 15 at 4, over the 9.5 um the table is set for.
  const aRel = (6 * pow(15 / 6, k[1] / 4)) / 9.5 * st.gs;

  // ---- the cloud height field, on a grid one LED wider on every side
  const oc = prepOct(st.oc, p, 0.3 + 0.2 * rel, 0.2 + 0.7 * rel);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) hgrid[gy * GW + gx] = cloudAt(lat, oc, gx - 0.5, gy - 0.5);

  // The field's own mean and spread, so the amount of cloud and the contrast stay put as the weather moves.
  let sum = 0, sum2 = 0;
  for (let i = 0; i < GW * GH; i++) {
    const v = hgrid[i];
    sum += v;
    sum2 += v * v;
  }
  const mu = sum / (GW * GH), sg = sqrt(max(1e-6, sum2 / (GW * GH) - mu * mu)), isg = 1 / sg;

  // ---- the colours
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  hueMatrix(TAU * k[0], m);
  const tm = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  hueMatrix(TAU * 0.08 * sin(TAU * k[0]), tm);
  // Where the cloud gives out, in standard deviations below the mean: never at -1, about 7 percent of the panel at 0, a third at 1.
  const zc = -4 + 5.5 * rel - 2.05 * rel * rel;
  const rg = (0.7 + 2.6 * rel) * 0.13 * isg;
  const cx = st.gx, cy = st.gy;
  const dp = p.subarray(2 * OCT + 2, 2 * OCT + 6);
  const N1 = LUT_N + 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      const dx = px - cx, dy = py - cy, r2 = dx * dx + dy * dy, r = sqrt(r2);
      const gi = (y + 1) * GW + (x + 1);
      const z = (hgrid[gi] - mu) * isg;
      // relief: the cloud is lit where it falls away toward the light, which is up and to the left
      const s = hgrid[gi + GW + 1] - hgrid[gi - GW - 1];
      // the cloud is thicker round the glory, which needs it
      const thick = sstep(zc - 0.35, zc + 0.35, z + 1.6 * exp(-r2 / 1400));
      const t = cl(0.5 + 0.2 * z + s * rg, 0, 1);
      // cloud colour: blue-violet shadow, lilac grey in the middle, pale lit top
      let cr, cg, cb;
      if (t < 0.5) {
        const u = t * 2;
        cr = 0.17 + 0.33 * u; cg = 0.17 + 0.33 * u; cb = 0.44 + 0.26 * u;
      } else {
        const u = (t - 0.5) * 2;
        cr = 0.50 + 0.30 * u; cg = 0.50 + 0.28 * u; cb = 0.70 + 0.20 * u;
      }
      // the droplet radius here, and the ring intensities at u = r * radius
      let fu = (r * aRel * exp(DROP_GAIN * dropAt(lat, dp, px, py))) / LUT_STEP;
      if (fu > LUT_N - 1) fu = LUT_N - 1;
      const i0 = fu | 0, fr = fu - i0;
      const ir = wa * (lutA[i0] + (lutA[i0 + 1] - lutA[i0]) * fr) + wb * (lutB[i0] + (lutB[i0 + 1] - lutB[i0]) * fr);
      const ig = wa * (lutA[N1 + i0] + (lutA[N1 + i0 + 1] - lutA[N1 + i0]) * fr) + wb * (lutB[N1 + i0] + (lutB[N1 + i0 + 1] - lutB[N1 + i0]) * fr);
      const ib = wa * (lutA[2 * N1 + i0] + (lutA[2 * N1 + i0 + 1] - lutA[2 * N1 + i0]) * fr) + wb * (lutB[2 * N1 + i0] + (lutB[2 * N1 + i0 + 1] - lutB[2 * N1 + i0]) * fr);
      // pull the three channels apart so the rings are coloured, not just bright
      const mean = (ir + ig + ib) / 3;
      const er = max(0, mean + CHROMA * (ir - mean)), eg = max(0, mean + CHROMA * (ig - mean)), eb = max(0, mean + CHROMA * (ib - mean));
      const shade = exp(-r2 / 24);
      const gk = thick * (0.55 + 0.45 * t) * (1 - 0.97 * shade) * GAIN;
      const gr = 1 - exp(-gk * er), gg = 1 - exp(-gk * eg), gb = 1 - exp(-gk * eb);
      const gm = (gr + gg + gb) / 3;
      // Hue turns the ring colours all the way round (the matrix keeps their mean); the cloud only sways.
      const dr = gr - gm, dg = gg - gm, db = gb - gm;
      const cr2 = m[0] * dr + m[1] * dg + m[2] * db, cg2 = m[3] * dr + m[4] * dg + m[5] * db, cb2 = m[6] * dr + m[7] * dg + m[8] * db;
      const tr = tm[0] * cr + tm[1] * cg + tm[2] * cb, tg = tm[3] * cr + tm[4] * cg + tm[5] * cb, tb = tm[6] * cr + tm[7] * cg + tm[8] * cb;
      const dk = 1 - 0.5 * shade;
      // The cloud over the dark ground. The glory then tints it (each channel by its own ring) and
      // lights it (the mean of the three, screened over), so the rings show on bright cloud as well.
      const br = (0.03 + (tr * dk - 0.03) * thick) * tint(cr2);
      const bg = (0.07 + (tg * dk - 0.07) * thick) * tint(cg2);
      const bb = (0.30 + (tb * dk - 0.30) * thick) * tint(cb2);
      const lit = LIGHT * gm;
      const or = 1 - (1 - cl(br, 0, 1)) * (1 - lit), og = 1 - (1 - cl(bg, 0, 1)) * (1 - lit), ob = 1 - (1 - cl(bb, 0, 1)) * (1 - lit);
      display.setPixel(x, y, (or * 255 + 0.5) | 0, (og * 255 + 0.5) | 0, (ob * 255 + 0.5) | 0);
    }
  }
}
