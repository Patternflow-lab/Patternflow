// ===== Patternflow pattern =====
// Title:   Honami
// Family:  honami
// Idea:    A ripe barley field seen in perspective from a low eye under a pale evening sky with long cloud bands, where gusts roll in from the far left as groups of crests that bend the ears over, so silver-gold bands sweep diagonally toward the eye, stalks spring back and ring behind them, the near ears lean as short strokes and the far field melts into haze at a line of hedges.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: honami, the Japanese word for the waves wind drives over ripe grain; the coherent gusts of the mixing layer over a crop (Finnigan, 1979; Raupach, Finnigan and Brunet, 1996, from memory); honami as the lock-in of the mixing layer's rollers with the crop's swaying, a layer of damped oscillators forced by travelling gusts (Py, de Langre and Moulia, 2006, from memory). Original here: an oscillator for every two LED of a ground plane seen through a pinhole camera, forced by gust groups that hold a steady share of each band of depth and by roller trains spaced by U / f0, each octave filtered by the ground one LED covers, pattern round 260
// Round:   260
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0..4, Gust=-1..1, Stiffness=-1..1
//
// Knob 1: Hue. Four crops, each holding for half its stretch and blending into the next: ripe gold barley under a peach and lilac sky at 0, young green wheat under a morning blue at 0.25, sage-silver oats under grey-blue at 0.5, rose-red sorghum under a violet dusk at 0.75, barley again at 1.
// Knob 2: Wind. The wind at the canopy top, 0.75 m/s at 0, 2.2 at 2 where it opens, 6.4 at 4. A light breeze leans the field a little with crests a third as deep, soft swells; a strong wind bends the gusts 1.5 times as far as at the opening, they cover 62 percent of the field instead of 50 and run three times as fast, bright bands over a darker field.
// Knob 3: Gust. The size of every gust length, doubling for each unit: patches of 1.6 by 5 m at -1, 3.3 by 10 m at 0, 6.5 by 21 m at 1, in swells three times as long, with crests 1.3, 1.9 and 2.6 m apart. At -1 small rippling patches; at 1 a few wide bands roll across.
// Knob 4: Stiffness. The stalk's natural frequency and damping ratio: 0.38 Hz and 0.44 at -1, 1 Hz and 0.18 at 0, 2.6 Hz and 0.07 at 1. Heavy heads bow 1.4 times as far and lag, so the field goes pale in broad soft swells; springy stalks bow 0.7 times as far, the crests close up and ring behind each gust in fine stripes.

// What the picture is. A pinhole camera 6 m above the canopy top (focal length 100 LED) looks level at a horizon on row 38, so row y sees
// the ground at Z = 600 / (y + 0.5 - 38) m, 6.7 m on the bottom row. Every second column of every field row holds a stalk oscillator,
// the canopy's tilt th along the wind:  th'' = w^2 (eq - th) - 2 zeta w th',  w = 2 pi f0 (K4).
// eq is a mean lean that swells raise or lower, plus the gusts. A gust group is where value noise, stretched across the wind and carried
// with it, crosses a threshold; it comes in two layers lying 0.35 rad either side of the mean heading, blended by the wind's wandering
// heading. Inside a group runs a train of rollers, crests across the wind 1.9 m apart whose spacing follows U / f0 part of the way (the
// lock-in), bent by the noise. A crest passing in about half a period bends a stalk furthest, and behind a group the stalks recoil and ring.
// Each group threshold is steered so the groups cover half of each of three bands of depth, so the near field, a few gusts wide, is never
// still for long. Heading, speed and gustiness wander as slow random walks, so the picture never comes round again. An octave smaller than
// the ground one LED covers is averaged along the row, and where the ringing wavelength is under it the stalks are damped to critical.
// Drawing. The tilt picks a colour from a five-stop ramp, olive where stalks swing back past upright, gold at rest, pale silver where ears
// bend; the tilt rate lights the front of a crest. The ramp takes back the mean lean the wind adds, so wind shows as contrast. A still
// patchwork of ripeness lies under it, and haze takes the field toward the horizon colour. In the bottom 30 rows ears on a jittered 30 cm
// grid are drawn far to near as soft strokes 2 LED wide and 3 to 5 tall, leaning with the tilt under them. The sky has a low sun's glow,
// cloud bands on a plane 450 m up that drift toward the eye and reshape over 15 s, and a hazy line of hedges on the horizon.

const W = 64, H = 128;
const YH = 38, FH = H - YH; // the horizon row, and the rows of field under it
const F = 100; // focal length, LED
const CAM = 6; // eye height above the canopy top, m
const GC = 33, NG = GC * FH; // the oscillator grid: x = 0, 2, .. 64 on every field row

const { floor, sqrt, exp, sin, cos, min, max, pow, PI } = Math;
const imul = Math.imul;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- wind and gusts
const A0 = 0.85; // mean heading of the wind, rad from straight toward the eye, turning to the right
const DIR_SD = 0.32, DIR_TAU = 30; // the heading's wander, rad, and how long it remembers, s
const SPD_SD = 0.2, SPD_TAU = 20; // the speed's wander, in log units
const GUST_SD = 0.25, GUST_TAU = 30; // the gustiness's wander
const COVER = 0.5; // the share of each band of depth the gust groups cover at the opening wind
const PATCH_TURN = 0.35; // rad either side of the mean heading for the two layers of gust patches
const SWELL = 0.5; // how far a swell leans the field on its own
const NEAR_CALM = 0.25; // how much less the nearest rows answer a gust
const HAZE = 240; // the distance over which the air hazes the field, m
const CLOUD_H = 450, CLOUD_LIFE = 15; // the cloud plane's height, m, and the seconds a cloud band takes to change shape
const BANDC = [7, 29, 67]; // the middle rows of the three bands of depth the gust share is kept for
// swell, gust patch, ripple: length along the wind and across it (m, at gust size 1), life (s), speed as a share of the wind
const OCT = [
  [16, 30, 8, 1.1],
  [5, 16, 6, 1],
  [1.1, 2.4, 1.6, 0.9],
];
const GUST_OCT = 1.0, GS0 = 0.65; // octaves of size for each unit of K3, and the scale of every gust length at K3 = 0
const LAM0 = 2.4, LOCK_U = 0.4, LOCK_F = 0.6; // roller spacing at gust size 1, m, and how far it follows U and 1 / f0

// ---- the stalks
const F0 = 1.0, F0_OCT = 1.4; // Hz at K4 = 0, and octaves for each unit of K4
const ZETA0 = 0.18, ZETA_OCT = -1.3; // damping ratio at K4 = 0, and octaves of it for each unit of K4
const SOFT = 0.35; // the lean goes as f0 to the minus this
const PREROLL = 6; // seconds the field runs before the first frame, in steps of 1/15 s

// ---- the ears
const SP = 0.3; // ear spacing on the ground, m
const EAR = 0.36; // ear length, m
const EAR_DY0 = 58, EAR_DY1 = 78; // ears fade in between these depths below the horizon (rows)

// ---- palettes: field ramp (swung back to silver), sky (zenith, middle, horizon), sun, cloud, haze, hedge
const PAL = [
  { // ripe barley
    f: [[84, 80, 40], [138, 120, 56], [190, 158, 72], [236, 216, 148], [248, 245, 222]],
    s: [[150, 150, 196], [214, 176, 178], [250, 214, 170]], sun: [255, 230, 170], cl: [255, 206, 180], hz: [238, 214, 176], hd: [126, 112, 118],
  },
  { // young green wheat
    f: [[34, 58, 28], [62, 96, 42], [100, 138, 64], [176, 206, 140], [226, 240, 212]],
    s: [[120, 176, 226], [182, 214, 226], [238, 240, 204]], sun: [255, 250, 214], cl: [250, 250, 236], hz: [210, 228, 204], hd: [88, 114, 108],
  },
  { // silvery oats
    f: [[48, 64, 52], [86, 108, 86], [128, 152, 122], [190, 206, 178], [236, 242, 226]],
    s: [[118, 140, 192], [186, 196, 214], [236, 232, 218]], sun: [250, 244, 222], cl: [240, 236, 240], hz: [206, 214, 206], hd: [88, 100, 112],
  },
  { // red sorghum at dusk
    f: [[70, 30, 40], [116, 50, 56], [162, 80, 74], [220, 150, 140], [244, 218, 214]],
    s: [[76, 70, 140], [168, 120, 170], [252, 186, 160]], sun: [255, 206, 170], cl: [248, 168, 184], hz: [214, 160, 170], hd: [70, 56, 96],
  },
];
const QS = [-0.25, 0.0, 0.17, 0.42, 0.74]; // the tilt at each stop of the field ramp
const QMIN = -0.6, QMAX = 1.5, LUTN = 256;

// ---- noise
function hv(i, j, k) {
  let h = imul(i, 0x27d4eb2d) ^ imul(j, 0x165667b1) ^ imul(k, 0x5bd1e995);
  h = imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = imul(h, 0xc2b2ae35);
  return ((h >>> 8) & 0xffff) / 32767.5 - 1;
}
function vn3(x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = hv(xi, yi, zi), b = hv(xi + 1, yi, zi), c = hv(xi, yi + 1, zi), d = hv(xi + 1, yi + 1, zi);
  const e = hv(xi, yi, zi + 1), f = hv(xi + 1, yi, zi + 1), g = hv(xi, yi + 1, zi + 1), h = hv(xi + 1, yi + 1, zi + 1);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return y0 + (y1 - y0) * fz;
}
function vn2(x, y, k) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hv(xi, yi, k), b = hv(xi + 1, yi, k), c = hv(xi, yi + 1, k), d = hv(xi + 1, yi + 1, k);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx;
  return x0 + (x1 - x0) * fy;
}
const gauss = () => {
  let u = 0;
  for (let k = 0; k < 6; k++) u += Math.random();
  return (u - 3) * 1.414;
};

function makeState() {
  const S = {
    ready: false, t: 0, ks: [0, 2, 0, 0.06],
    th: new Float32Array(NG), vt: new Float32Array(NG), om: new Float32Array(NG), u0: new Float32Array(NG), v0: new Float32Array(NG), pu: [new Float32Array(NG), new Float32Array(NG)], pv: [new Float32Array(NG), new Float32Array(NG)], po: new Float64Array(4),
    off: new Float64Array(6), ph: new Float64Array(3), rph: 0, qo: 0, gth: new Float32Array([0.06, 0.06, 0.06]), att: new Float32Array(FH * 3),
    dir: DIR_SD * gauss(), spd: SPD_SD * gauss(), gst: GUST_SD * gauss(), seed: (Math.random() * 1e6) | 0,
    tex: new Float32Array(W * FH), rowHz: new Float32Array(FH), rowDk: new Float32Array(FH),
    buf: new Float32Array(W * H * 3), sky: new Float32Array(W * YH * 3), lut: new Float32Array(LUTN * 3), palAt: -1,
    pal: null, hedge: new Float32Array(W), crow: new Float32Array(GC), glare: new Float32Array(W), cloudOff: Math.random() * 5000, cloudX: Math.random() * 5000,
    ex: [], ez: [], elx: [], elz: [], eb: [],
  };
  for (let k = 0; k < 3; k++) S.ph[k] = Math.random() * 100;
  for (let k = 0; k < 6; k++) S.off[k] = Math.random() * 1000;
  for (let k = 0; k < 4; k++) S.po[k] = Math.random() * 1000;
  const ca = cos(A0), sa = sin(A0), sd = S.seed;
  // wind frame: u along the mean wind (heading toward +x and -z), v across it
  for (let r = 0; r < FH; r++) {
    const dy = r + 0.5, Z = (CAM * F) / dy;
    for (let c = 0; c < GC; c++) {
      const i = r * GC + c, X = ((2 * c - 32) * Z) / F;
      S.u0[i] = X * sa - Z * ca;
      S.v0[i] = X * ca + Z * sa;
      for (let l = 0; l < 2; l++) {
        const a = A0 + (l ? PATCH_TURN : -PATCH_TURN), c2 = cos(a), s2 = sin(a);
        S.pu[l][i] = X * s2 - Z * c2;
        S.pv[l][i] = X * c2 + Z * s2;
      }
      S.om[i] = 1 + 0.06 * vn2(X / 1.5, Z / 1.5, sd + 7);
    }
    for (let x = 0; x < W; x++) {
      const X = ((x + 0.5 - 32) * Z) / F;
      S.tex[r * W + x] = 0.7 * vn2(X / 9, Z / 9, sd + 11) + 0.3 * vn2(X / 3.5, Z / 3.5, sd + 12);
    }
    S.rowHz[r] = 0.88 * (1 - exp(-Z / HAZE)) + 0.12 * ss(4, 0.5, dy);
    S.rowDk[r] = 1 - 0.08 * ss(40, 85, dy);
  }
  for (let x = 0; x < W; x++) S.glare[x] = 0.45 * exp(-(((x + 0.5 - 20) / 17) ** 2)); // the low sun's glare on the far field
  for (let x = 0; x < W; x++) S.hedge[x] = 1.1 + 1.3 * (0.5 + 0.5 * vn2(x / 7, 0, sd + 3)) + 0.6 * vn2(x / 2.6, 0, sd + 4);
  // the ears: a jittered grid on the ground, far to near
  const zNear = (CAM * F) / (FH + 1), zFar = (CAM * F) / EAR_DY0;
  for (let j = floor(zFar / SP); j >= floor(zNear / SP) - 1; j--) {
    const Zc = (j + 0.5) * SP, half = ((34 * Zc) / F) / SP;
    for (let i = -Math.ceil(half); i <= Math.ceil(half); i++) {
      const X = (i + 0.5 + 0.8 * hv(i, j, sd + 21) * 0.5) * SP, Z = Zc + 0.4 * hv(i, j, sd + 22) * SP;
      S.ex.push(X); S.ez.push(Z); S.elx.push(0.14 * hv(i, j, sd + 23)); S.elz.push(0.1 * hv(i, j, sd + 24)); S.eb.push(0.5 * hv(i, j, sd + 25));
    }
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

function knobs(k) {
  const U = 0.75 * pow(2, 0.775 * cl(k[1], 0, 4)); // m/s: 0.75, 2.2 at 2, 6.4 at 4
  const gs = GS0 * pow(2, GUST_OCT * cl(k[2], -1, 1));
  const f0 = F0 * pow(2, F0_OCT * cl(k[3], -1, 1));
  const z = ZETA0 * pow(2, ZETA_OCT * cl(k[3], -1, 1));
  // the mean lean and the gust's extra lean; a stalk with a lower natural frequency is a softer spring and bows further
  const soft = pow(f0 / F0, -SOFT);
  const lw = 0.1 + 0.035 * cl(k[1], 0, 4), gw = 0.25 + 0.14 * cl(k[1], 0, 4);
  const lean = lw * soft, ga = gw * soft;
  // the rollers of the mixing layer lock in to the stalks: their spacing follows U / f0 part of the way
  const lam = LAM0 * pow(U / 2.2, LOCK_U) * pow(F0 / f0, LOCK_F) * pow(gs, 0.5);
  const rd = 0.35 + 0.65 * ss(0, 2.2, cl(k[1], 0, 4)); // a light breeze raises soft swells more than it rolls
  return { U, gs, w: 2 * PI * f0, z, lean, ga, lam, lw, gw, rd };
}

function step(S, dt) {
  const P = knobs(S.ks);
  // the wind wanders
  const sq = sqrt(dt);
  S.dir += (-S.dir / DIR_TAU) * dt + DIR_SD * sqrt(2 / DIR_TAU) * sq * gauss();
  S.spd += (-S.spd / SPD_TAU) * dt + SPD_SD * sqrt(2 / SPD_TAU) * sq * gauss();
  S.gst += (-S.gst / GUST_TAU) * dt + GUST_SD * sqrt(2 / GUST_TAU) * sq * gauss();
  const U = P.U * exp(S.spd), cd = cos(S.dir), sd = sin(S.dir), gmul = exp(S.gst);
  const fpOf = (r) => {
    const dy = r + 0.5, Z = (CAM * F) / dy;
    return max(Z / dy, (2 * Z) / F); // the ground one LED of this row covers
  };
  for (let k = 0; k < 3; k++) {
    const o = OCT[k], Lu = o[0] * P.gs, Lv = o[1] * P.gs;
    S.off[2 * k] += (U * o[3] * cd * dt) / Lu;
    S.off[2 * k + 1] += (U * o[3] * sd * dt) / Lv;
    if (k === 1) {
      for (let l = 0; l < 2; l++) {
        const d = S.dir - (l ? PATCH_TURN : -PATCH_TURN);
        S.po[2 * l] += (U * o[3] * cos(d) * dt) / Lu;
        S.po[2 * l + 1] += (U * o[3] * sin(d) * dt) / Lv;
      }
    }
    S.ph[k] += dt / (o[2] * sqrt(P.gs));
    // an octave finer than the footprint averages along the row, its spread falling as the root of the cells; ripples fade out instead
    for (let r = 0; r < FH; r++) S.att[r * 3 + k] = k < 2 ? min(1, sqrt((0.8 * Lu) / fpOf(r))) : ss(1.1, 0.3, fpOf(r) / Lu);
  }
  S.rph += (U * cd * dt) / P.lam;
  const il = [], o = S.off, ilam = 1 / P.lam, rph = S.rph, rd = P.rd;
  for (let k = 0; k < 3; k++) il.push(1 / (OCT[k][0] * P.gs), 1 / (OCT[k][1] * P.gs));
  const th = S.th, vt = S.vt, om = S.om, u0 = S.u0, v0 = S.v0, att = S.att;
  const n = Math.ceil((dt * P.w * 1.1) / 0.3), h = dt / n, ring = (U * 2 * PI) / P.w; // ring: the wavelength of the ringing
  const cov = [0, 0, 0], cnt = [0, 0, 0];
  // two layers of gust patches either side of the mean heading, blended by the wind's heading, so the patches turn with the wind
  const mB = ss(-0.25, 0.25, S.dir), mA = 1 - mB, mn = 1 / sqrt(mA * mA + mB * mB), po = S.po, pua = S.pu[0], pva = S.pv[0], pub = S.pu[1], pvb = S.pv[1];
  for (let r = 0; r < FH; r++) {
    const t0 = att[r * 3], t1 = att[r * 3 + 1], t2 = att[r * 3 + 2] * gmul, fp = fpOf(r);
    // the row's threshold, interpolated between the bands' so there is no seam
    const bw = r < BANDC[1] ? (r - BANDC[0]) / (BANDC[1] - BANDC[0]) : 1 + (r - BANDC[1]) / (BANDC[2] - BANDC[1]);
    const bk = cl(bw, 0, 2), b0 = min(1, bk | 0), bf = cl(bk - b0, 0, 1), gth = S.gth[b0] * (1 - bf) + S.gth[b0 + 1] * bf;
    let cv = 0;
    const gn = P.ga * (1 - NEAR_CALM * ss(40, 85, r));
    // rollers finer than the footprint give way to their mean; ringing finer than it would flicker, so the stalks there are damped to critical
    const tr = ss(1.0, 0.4, fp / P.lam), rf = ss(0.9, 0.35, fp / ring), z2 = 2 * (P.z + (1 - P.z) * (1 - rf));
    for (let i = r * GC, e = i + GC; i < e; i++) {
      const u = u0[i], v = v0[i];
      const gb = t0 > 0 ? vn3(u * il[0] - o[0], v * il[1] - o[1], S.ph[0]) : 0;
      let gm = 0;
      if (t1 > 0) {
        if (mA > 0.01) gm += mA * vn3(pua[i] * il[2] - po[0], pva[i] * il[3] - po[1], S.ph[1] + 40);
        if (mB > 0.01) gm += mB * vn3(pub[i] * il[2] - po[2], pvb[i] * il[3] - po[3], S.ph[1] + 70);
        gm *= mn;
      }
      const gr = t2 > 0 ? vn3(u * il[4] - o[4], v * il[5] - o[5], S.ph[2] + 80) : 0;
      const env = ss(gth, gth + 0.4, t1 * (gm + 0.4 * gb) + (1 - t1) * 0.5 * gb);
      cv += env;
      let rr = 0.375;
      if (tr > 0) {
        const c = 0.5 + 0.5 * cos(2 * PI * (u * ilam - rph + 1.2 * gm + 0.4 * gb + 0.18 * gr));
        rr += tr * rd * (c * c * c - 0.375);
      }
      const eq = P.lean * (1 + t0 * SWELL * gb) + gn * (1.5 * (0.12 + 0.88 * env) * rr + t2 * gr * 0.25 * (0.5 + env));
      const w = P.w * om[i], w2 = w * w, zw = z2 * w;
      let a = th[i], b = vt[i];
      for (let s = 0; s < n; s++) {
        b += h * (w2 * (eq - a) - zw * b);
        a += h * b;
      }
      th[i] = a;
      vt[i] = b / w;
    }
    cov[b0] += cv * (1 - bf);
    cnt[b0] += GC * (1 - bf);
    cov[b0 + 1] += cv * bf;
    cnt[b0 + 1] += GC * bf;
  }
  // each band's threshold follows the share its gust groups cover; the share aimed at grows with the wind and wanders with the gustiness
  for (let k = 0; k < 3; k++) S.gth[k] = cl(S.gth[k] + (cov[k] / cnt[k] - (COVER + 0.06 * (S.ks[1] - 2) + 0.12 * S.gst)) * dt * 1.2, -0.5, 0.6);
  // the cloud plane drifts with the wind aloft
  S.cloudOff += dt * 26 * (0.8 + 0.2 * cd);
  S.cloudX += dt * 14 * (0.5 + 0.4 * sd);
  S.t += dt;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    const P = knobs(S.ks);
    for (let i = 0; i < NG; i++) S.th[i] = P.lean;
    for (let t = 0; t < PREROLL; t += 1 / 15) step(S, 1 / 15);
  }
  const e = 1 - exp(-d / 0.1);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  step(S, d);
}

// ---- colour
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function palette(S, hue) {
  if (S.palAt === hue) return;
  S.palAt = hue;
  const p = (((hue % 1) + 1) % 1) * PAL.length, i0 = floor(p) % PAL.length, i1 = (i0 + 1) % PAL.length, t = ss(0.25, 0.75, p - floor(p));
  const A = PAL[i0], B = PAL[i1];
  const P = { f: [], s: [] };
  for (let k = 0; k < 5; k++) P.f.push(mix3(A.f[k], B.f[k], t));
  for (let k = 0; k < 3; k++) P.s.push(mix3(A.s[k], B.s[k], t));
  for (const key of ["sun", "cl", "hz", "hd"]) P[key] = mix3(A[key], B[key], t);
  S.pal = P;
  const lut = S.lut;
  for (let n = 0; n < LUTN; n++) {
    const q = QMIN + ((QMAX - QMIN) * n) / (LUTN - 1);
    let k = 0;
    while (k < 3 && q > QS[k + 1]) k++;
    const c = mix3(P.f[k], P.f[k + 1], ss(QS[k], QS[k + 1], q));
    const dim = q < QS[0] ? 1 - 0.5 * ss(QS[0], QMIN, q) : 1;
    for (let ch = 0; ch < 3; ch++) lut[n * 3 + ch] = c[ch] * dim;
  }
  // the still sky: a gradient and the glow of a low sun left of the middle
  const sky = S.sky;
  for (let y = 0; y < YH; y++) {
    const a = (YH - y - 0.5) / YH; // 0 at the horizon, 1 at the top
    const c = a > 0.45 ? mix3(P.s[1], P.s[0], ss(0.45, 1, a)) : mix3(P.s[2], P.s[1], ss(0, 0.45, a));
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - 20) / 22, dyy = (YH - y - 0.5 - 5) / 10;
      const gl = 0.55 * exp(-(dx * dx + dyy * dyy)) + 0.25 * exp(-(dx * dx) * 0.15 - (YH - y) / 7);
      for (let ch = 0; ch < 3; ch++) sky[(y * W + x) * 3 + ch] = c[ch] + (P.sun[ch] - c[ch]) * gl;
    }
  }
}

function ramp(S, q, out) {
  const n = ((cl(q, QMIN, QMAX) - QMIN) * (LUTN - 1)) / (QMAX - QMIN);
  const k = n | 0, t = n - k, k1 = min(LUTN - 1, k + 1), l = S.lut;
  for (let ch = 0; ch < 3; ch++) out[ch] = l[k * 3 + ch] + (l[k1 * 3 + ch] - l[k * 3 + ch]) * t;
}

const KV = 0.13; // how much the tilt rate lights the front of a gust and shades its back
const TEX = 0.09; // how far the patchwork of ripeness moves the ramp

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  palette(S, S.ks[0]);
  // the ramp takes back the mean lean the wind adds, so the wind shows as contrast
  const kp = knobs(S.ks);
  S.qo = -0.9 * (kp.lw - 0.17 + 0.26 * (kp.gw - 0.53));
  const P = S.pal, buf = S.buf, sky = S.sky, th = S.th, vt = S.vt;
  const col = [0, 0, 0];
  // sky with cloud bands
  const cr = S.crow, tm = S.t / CLOUD_LIFE;
  for (let y = 0; y < YH; y++) {
    const dyS = YH - y - 0.5, Zc = (CLOUD_H * F) / dyS, thin = ss(0.5, 6, dyS), zc = (Zc - S.cloudOff) / 420;
    for (let c = 0; c < GC; c++) {
      const Xc = ((2 * c - 32) * Zc) / F + S.cloudX;
      const n = vn3(Xc / 1100, zc, tm + S.seed) + 0.45 * vn2(Xc / 380, zc * 2.6, S.seed + 32);
      cr[c] = ss(0.0, 0.7, n) * 0.85 * thin;
    }
    for (let x = 0; x < W; x++) {
      const xs = (x + 0.5) / 2, c0 = xs | 0, c = cr[c0] + (cr[c0 + 1] - cr[c0]) * (xs - c0);
      const i = (y * W + x) * 3, hc = cl(S.hedge[x] - dyS + 0.5, 0, 1) * 0.55; // hc: the hedges on the horizon
      for (let ch = 0; ch < 3; ch++) {
        const v = sky[i + ch] + (P.cl[ch] - sky[i + ch]) * c;
        buf[i + ch] = v + (P.hd[ch] - v) * hc;
      }
    }
  }
  // the field
  for (let r = 0; r < FH; r++) {
    const hz = S.rowHz[r], dk = S.rowDk[r] * (1 - hz), y = YH + r;
    for (let x = 0; x < W; x++) {
      const xs = (x + 0.5) / 2, c0 = xs | 0, fr = xs - c0, gi = r * GC + c0;
      const a = th[gi] + (th[gi + 1] - th[gi]) * fr, b = vt[gi] + (vt[gi + 1] - vt[gi]) * fr;
      ramp(S, a + S.qo + KV * b + TEX * S.tex[r * W + x], col);
      const i = (y * W + x) * 3, gl = S.glare[x] * hz;
      for (let ch = 0; ch < 3; ch++) buf[i + ch] = col[ch] * dk + P.hz[ch] * hz + (P.sun[ch] - P.hz[ch]) * gl;
    }
  }
  drawEars(S, P, buf);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[i], 0, 255) | 0, cl(buf[i + 1], 0, 255) | 0, cl(buf[i + 2], 0, 255) | 0);
    }
  }
}

function tiltAt(S, sx, sy) {
  const r = cl(sy - YH - 0.5, 0, FH - 1.001), c = cl(sx / 2, 0, GC - 1.001);
  const r0 = r | 0, c0 = c | 0, fr = r - r0, fc = c - c0, i = r0 * GC + c0, j = min(r0 + 1, FH - 1) * GC + c0;
  const a = S.th[i] + (S.th[i + 1] - S.th[i]) * fc, b = S.th[j] + (S.th[j + 1] - S.th[j]) * fc;
  const va = S.vt[i] + (S.vt[i + 1] - S.vt[i]) * fc, vb = S.vt[j] + (S.vt[j + 1] - S.vt[j]) * fc;
  return [a + (b - a) * fr, va + (vb - va) * fr];
}

function drawEars(S, P, buf) {
  const cd = cos(A0 + S.dir), sd = sin(A0 + S.dir), wx = sd, wz = -cd; // the way the wind blows, in (x, z)
  const col = [0, 0, 0], tip = [0, 0, 0];
  const n = S.ex.length;
  for (let e = 0; e < n; e++) {
    const X = S.ex[e], Z = S.ez[e];
    const sx = 32 + (X * F) / Z, sy = YH + (CAM * F) / Z;
    if (sx < -3 || sx > W + 3 || sy > H + 3) continue;
    const dy = sy - YH, al = ss(EAR_DY0, EAR_DY1, dy);
    if (al <= 0.01) continue;
    const tv = tiltAt(S, sx, sy), tl = tv[0];
    const lx = S.elx[e] + 1.1 * tl * wx, lz = S.elz[e] + 1.1 * tl * wz, lm = sqrt(lx * lx + lz * lz), up = cos(min(1.3, lm));
    const sc = lm > 1e-4 ? sin(min(1.3, lm)) / lm : 1;
    const Xt = X + EAR * lx * sc, Zt = Z + EAR * lz * sc;
    const tx = 32 + (Xt * F) / Zt, ty = YH + ((CAM - EAR * up) * F) / Zt;
    ramp(S, tl + KV * tv[1] + S.qo + 0.14 + S.eb[e] * 0.12, tip);
    ramp(S, tl + S.qo - 0.06, col);
    const hz = 0.88 * (1 - exp(-Z / HAZE));
    // a soft capsule 2 LED wide from the base to the tip, darker at the base
    const x0 = floor(min(sx, tx) - 1.5), x1 = floor(max(sx, tx) + 1.5), y0 = floor(min(sy, ty) - 1.5), y1 = floor(max(sy, ty) + 1.5);
    const ex = tx - sx, ey = ty - sy, el = ex * ex + ey * ey + 1e-6;
    for (let py = max(y0, YH); py <= min(y1, H - 1); py++) {
      for (let px = max(x0, 0); px <= min(x1, W - 1); px++) {
        const qx = px + 0.5 - sx, qy = py + 0.5 - sy;
        const t = cl((qx * ex + qy * ey) / el, 0, 1), ddx = qx - ex * t, ddy = qy - ey * t;
        const cov = cl(1.15 - sqrt(ddx * ddx + ddy * ddy), 0, 1) * al * 0.9;
        if (cov <= 0) continue;
        const k = ss(0, 0.8, t), i = (py * W + px) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const v = (col[ch] + (tip[ch] - col[ch]) * k) * (1 - hz) + P.hz[ch] * hz;
          buf[i + ch] += (v - buf[i + ch]) * cov;
        }
      }
    }
  }
}
