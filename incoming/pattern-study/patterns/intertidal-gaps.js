// ===== Patternflow pattern =====
// Title:   Intertidal Gaps
// Family:  intertidal
// Idea:    A wave-swept rock face seen straight on, four tilted zones of orange lichen, cream barnacles, blue-black mussels and red algae out of which storms tear grey gaps that heal from the rim inward through olive film, green weed and cream barnacle spat until mussels close over the core, under a translucent teal tide and the spray of big waves.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: barnacle zones, Chthamalus high and Balanus low (Joseph Connell, 1961); the mussel Mytilus as the competitive dominant (Robert Paine, 1966); gaps torn by storms and logs (Paul Dayton, 1971) and the patchwork of ages they leave (Levin and Paine, 1974; Paine and Levin, 1981); succession from film and Ulva to barnacles, algae and mussels (Wayne Sousa, 1979), mussels settling on what grew before them (Connell and Slatyer, 1977); intermediate disturbance (Connell, 1978); mussels creeping from a bed's edge (Okamura, 1986; van de Koppel et al., 2005); the 12.42 h tide. All from memory; I could not place the Hulscher the brief named.
// Round:   267
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Exposure=-1..1, Tide=-1..1
//
// Knob 1: Hue. Turns every colour once round the wheel, the sea with it, keeping luma where the gamut allows; a dark colour that would land among the oranges and yellows is pushed on to forest green or wine so that it never goes brown. 0 and 1 are the natural shore (slate, indigo mussels, cream barnacles, orange lichen, crimson algae, emerald weed, teal sea); 0.25 magenta lichen, green mussels; 0.4 blue lichen, dark green mussels, red sea; 0.6 cyan lichen, wine mussels; 0.75 green lichen, purple mussels.
// Knob 2: Pace. How fast the tide and the healing run: 0.5 at the minimum, 2 where it opens, 4 at the top. At 2 one panel second is about an hour of tide, so a tide takes 12.4 s, the spring-neap swell 104 s, and a gap 12 LED across closes in about 70 s; at 0.5 that is 50 s, 416 s and 270 s, at 4 it is 6.2 s, 52 s and 34 s. Weather (spells of storm, the swell's direction, clouds, waves) runs on its own clock and ignores Pace.
// Knob 3: Exposure. Wave energy, -1 sheltered, 0 where it opens, 1 battered, swung up and down by storm spells of 83 and 137 s. At Pace 2 storms tear 6, 9 and 15 gaps a minute at -1, 0 and 1, so that 8, 18 and 31 percent of the face is still healing and mussels hold 63, 50 and 31 percent of the mid-shore; the swash is 1.3, 4 and 8 rows high, spray thrown by big waves reaches higher and white water slaps the lowest rows above 0.
// Knob 4: Tide. Water level and range: -1 a low, small tide, 0.06 where it opens, 1 a high, big one. Across the middle of the panel the waterline spends 90 percent of 900 s between rows 89 and 111 at -1, 51 and 104 where it opens and 32 and 99 at 1, and the mean moves 0.18 of the face with the knob, so it shows at slack water too.
//
// What the picture is. A vertical slice of rock tilted 22 degrees. Height decides who lives where, so lichen, barnacles, mussels and red algae lie as four broad bands with smooth wavering edges. A storm gap is a ragged ellipse pointing down and to the right, 6 to 18 LED wide and up to 30 long, and it heals from the rim inward: slate core, olive film, emerald weed, cream spat, then the indigo of the mussel bed closing in. The tide is a translucent teal veil with a lace of foam at its edge, a dark wet fringe behind it and spray thrown up the dry rock after big waves, and dimmer, bluer colours and glints under it. Slow shadows of clouds cross the rock; they are light on stone and nothing else.
// What is modelled. Cover of film, Ulva, barnacle, red algae, mussel and lichen on a 64 by 128 grid. Each settles on bare rock and grows over a weaker one (film, Ulva, barnacle, mussel; red algae low), by its own suitability for the height; mussels spread only from a neighbouring bed. A gap carries a clock that is negative at its core, and each species can start only at its own age, so the fronts move inward in order. Storms land on old cover, more often on the lower mid-shore. The first update runs 330 model seconds at the knobs it is given.
// What is made up. Every rate, cap and age; the ages that gate each species; the storm spells, the swell tilt, the cloud shadows, the foam on a new scar, the slap of white water; the tide's 104 s spring-neap beat (8 times the semidiurnal here, 28 in life) and its extra terms; the mean-level shift of the Tide knob; and every colour. A patch grows as a contour moving over a fixed grain. A picture of a mechanism, not a shore.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, exp, sin, cos, abs, min, max, PI, log, atan2 } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

// species: film, ulva, barnacle, red algae, mussel, lichen
const SF = 0, SU = 1, SN = 2, SR = 3, SM = 4, SL = 5, NS = 6;

// periodic value noise, so that a scar can be cut anywhere
function vnoise(nx, ny) {
  const g = new Float32Array(nx * ny);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const fy = (y * ny) / H, y0 = floor(fy);
    let ty = fy - y0;
    ty = ty * ty * (3 - 2 * ty);
    const r0 = (y0 % ny) * nx, r1 = ((y0 + 1) % ny) * nx;
    for (let x = 0; x < W; x++) {
      const fx = (x * nx) / W, x0 = floor(fx);
      let tx = fx - x0;
      tx = tx * tx * (3 - 2 * tx);
      const c0 = x0 % nx, c1 = (x0 + 1) % nx;
      const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * tx;
      const b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * tx;
      out[y * W + x] = a + (b - a) * ty;
    }
  }
  return out;
}
// a sum of octaves [nx, ny, weight], stood to mean 0.5 and a spread of 0.2
function fbm(list) {
  const out = new Float32Array(N);
  for (const [nx, ny, w] of list) {
    const n = vnoise(nx, ny);
    for (let i = 0; i < N; i++) out[i] += n[i] * w;
  }
  let m = 0, v = 0;
  for (let i = 0; i < N; i++) m += out[i];
  m /= N;
  for (let i = 0; i < N; i++) v += (out[i] - m) * (out[i] - m);
  const k = 0.2 / sqrt(v / N + 1e-9);
  for (let i = 0; i < N; i++) out[i] = cl(0.5 + (out[i] - m) * k, 0, 1);
  return out;
}
// the same noise turned into an even spread over 0..1
function ranked(a) {
  const idx = Array.from({ length: N }, (_, i) => i).sort((p, q) => a[p] - a[q]);
  const out = new Float32Array(N);
  for (let r = 0; r < N; r++) out[idx[r]] = (r + 0.5) / N;
  return out;
}
// bilinear read of a periodic field at a fractional place
function samp(f, x, y) {
  x -= W * floor(x / W);
  y -= H * floor(y / H);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const x1 = (x0 + 1) & 63, y1 = (y0 + 1) & 127;
  const a = f[y0 * W + x0] + (f[y0 * W + x1] - f[y0 * W + x0]) * fx;
  const b = f[y1 * W + x0] + (f[y1 * W + x1] - f[y1 * W + x0]) * fx;
  return a + (b - a) * fy;
}

// [dry a, dry b, wet a, wet b] for bare rock and then the six species
const PAL = [
  [[122, 126, 134], [96, 100, 110], [66, 78, 98], [50, 60, 80]],
  [[150, 144, 62], [124, 122, 46], [112, 126, 34], [88, 106, 28]],
  [[170, 208, 70], [130, 190, 60], [34, 172, 98], [96, 198, 84]],
  [[236, 228, 204], [200, 194, 172], [196, 204, 196], [150, 166, 170]],
  [[196, 72, 62], [228, 128, 148], [226, 30, 56], [244, 110, 140]],
  [[80, 90, 128], [52, 60, 94], [32, 44, 104], [84, 106, 168]],
  [[246, 140, 26], [240, 196, 44], [214, 96, 12], [204, 150, 20]],
];
const TEAL = [6, 130, 124], FOAMC = [232, 248, 244], GLINT = [44, 84, 78];
const TRANS = [0.66, 0.93, 0.92];

// Hue: each colour's chroma is turned about the grey axis with its luma kept. A dark colour that would land among the oranges
// and yellows (brown mud on the panel) is pushed on to forest green or wine, and one that leaves the gamut gives up luma first.
function tint(c, ca, sa) {
  const r = c[0], g = c[1], b = c[2];
  const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
  let I2 = I * ca - Q * sa, Q2 = I * sa + Q * ca;
  const C = sqrt(I2 * I2 + Q2 * Q2), ph = atan2(Q2, I2);
  const wd = ss(-1.4, -1.2, ph) * (1 - ss(0.25, 0.45, ph)) * ss(4, 14, C) * (1 - ss(100, 150, Y));
  if (wd > 0) {
    const t = ph + wd * ((ph < -0.45 ? -1.75 : 0.55) - ph);
    I2 = 1.25 * C * cos(t);
    Q2 = 1.25 * C * sin(t);
  }
  const d0 = 0.956 * I2 + 0.621 * Q2, d1 = -0.272 * I2 - 0.647 * Q2, d2 = -1.106 * I2 + 1.703 * Q2;
  const mx = max(d0, d1, d2), mn = min(d0, d1, d2), s = min(1, 255 / (mx - mn + 1e-6));
  const y = cl(Y, -s * mn, 255 - s * mx);
  c[0] = y + s * d0;
  c[1] = y + s * d1;
  c[2] = y + s * d2;
}

export function setup(params) {
  const S = {
    ready: false,
    ks: [0, 2, 0, 0.06],
    X: [], // cover of each species
    bl: [], // each blurred
    tmp: new Float32Array(N),
    suit: [],
    Wt: new Float32Array(N), // wetness
    Fl: new Float32Array(N), // foam where a scar was just torn
    A: new Float32Array(N), // model seconds since a cell could be settled again, negative in the core of a fresh scar
    cdry: new Float32Array(N * 3),
    cwet: new Float32Array(N * 3),
    dirty: true,
    acc: 0,
    evAcc: 0,
    evThr: 1,
    dir: 0.62, // the way the swell drags: down to the right, 36 degrees below horizontal
    // tide phases: semidiurnal, spring-neap, diurnal, lunar, two wanders
    ph: [3.19, 0.68, 1.46, 1.03, 0.4, 2.1],
    tw: 0, // wave and water time
    wv: 2, // seconds to the next big wave
    reach: 0, // how far above the waterline the last big wave threw its spray
    level: 0.4, ampS: 0.03, slap: 0,
    img: new Uint8Array(N * 3),
  };
  for (let k = 0; k < NS; k++) {
    S.X.push(new Float32Array(N));
    S.bl.push(new Float32Array(N));
    S.suit.push(new Float32Array(N));
  }
  // rock face: height above low water, 1 at the top, 0 at the bottom, tilted 22 degrees, with gentle relief
  const rel = fbm([[3, 6, 1], [6, 12, 0.6], [12, 24, 0.25]]);
  S.Z = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) S.Z[y * W + x] = 1 - (y + 0.4 * (x - 32)) / (H - 1) + 0.06 * ((rel[y * W + x] - 0.5) / 0.2);
  const dl = [];
  for (let k = 0; k < NS; k++) dl.push(fbm([[4, 8, 1], [8, 16, 0.4]]));
  for (let i = 0; i < N; i++) {
    const z = S.Z[i], d = (k) => z + 0.035 * ((dl[k][i] - 0.5) / 0.2);
    S.suit[SF][i] = 0.55 + 0.45 * (1 - ss(0.2, 0.95, d(SF)));
    S.suit[SU][i] = 0.3 + 0.7 * (1 - ss(0.5, 0.9, d(SU)));
    S.suit[SN][i] = ss(0.2, 0.4, d(SN)) * (1 - ss(0.86, 0.96, d(SN)));
    S.suit[SR][i] = 1 - ss(0.18, 0.34, d(SR));
    S.suit[SM][i] = ss(0.1, 0.26, d(SM)) * (1 - ss(0.56, 0.7, d(SM)));
    S.suit[SL][i] = ss(0.76, 0.9, d(SL));
  }
  S.UN = ranked(fbm([[10, 20, 1], [5, 10, 0.7], [20, 40, 0.25]]));
  S.NA = fbm([[16, 32, 1], [8, 16, 0.6]]);
  S.NB = fbm([[10, 20, 1], [20, 40, 0.4]]);
  S.RN = fbm([[12, 24, 1], [24, 48, 0.5]]);
  S.BUB1 = fbm([[16, 32, 1], [32, 64, 0.5]]);
  S.BUB2 = fbm([[12, 24, 1], [24, 48, 0.5]]);
  S.CL1 = fbm([[3, 6, 1], [6, 12, 0.5]]);
  S.CL2 = fbm([[4, 8, 1], [8, 16, 0.4]]);
  params.s = S;
  return S;
}

// rates per model second; a model second is 0.4 panel seconds at Pace 2
const SEED = [0.03, 0.04, 0.03, 0.01, 0.0008, 0.003];
const NEIGH = [0.07, 0.06, 0.05, 0.06, 0.12, 0.03];
// weed also loses 0.012 a second to grazing limpets
const MORT = [0.012, 0.016, 0.0005, 0.0004, 0.0004, 0.0002];
const CAP = [1, 1, 0.93, 0.93, 0.94, 0.93];
const PERIOD = [12.4, 104, 23.3, 12.97, 301, 477];
const EV_RATE = 0.05;
const PRE_T = 330;

function blur(src, dst, tmp) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const a = src[o + (x > 0 ? x - 1 : 0)], c = src[o + (x < W - 1 ? x + 1 : W - 1)];
      tmp[o + x] = 0.25 * (a + c) + 0.5 * src[o + x];
    }
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, oa = (y > 0 ? y - 1 : 0) * W, oc = (y < H - 1 ? y + 1 : H - 1) * W;
    for (let x = 0; x < W; x++) dst[o + x] = 0.25 * (tmp[oa + x] + tmp[oc + x]) + 0.5 * tmp[o + x];
  }
}

const stress = (s) => 0.05 * ss(0.45, 0.08, s);
function step(S, dt, E) {
  const X = S.X, bl = S.bl, A = S.A;
  for (const k of [SU, SN, SR, SM]) blur(X[k], bl[k], S.tmp);
  const [F, U, Bn, R, M, L] = X;
  const [, bU, bN, bR, bM] = bl;
  const [sF, sU, sN, sR, sM, sL] = S.suit;
  for (let i = 0; i < N; i++) {
    const a = A[i] + dt;
    A[i] = a > 500 ? 500 : a;
    // a fresh scar is settled from its margin in, the core waiting longer, and each species can only start after its age:
    // film at once, then weed, barnacles, red algae, and last the mussels, which settle on what grew before them
    const tF = cl(a / 8, 0, 1) * dt, tU = cl((a - 22) / 10, 0, 1) * dt, tN = cl((a - 48) / 12, 0, 1) * dt, tM = cl((a - 85) / 12, 0, 1) * dt, tL = cl((a - 70) / 20, 0, 1) * dt;
    const f = F[i], u = U[i], n = Bn[i], r = R[i], m = M[i], l = L[i];
    let b = 1 - f - u - n - r - m - l;
    if (b < 0) b = 0;
    const cf = (SEED[0] + NEIGH[0] * f) * sF[i] * tF;
    const cu = (SEED[1] + NEIGH[1] * bU[i]) * sU[i] * tU;
    const cn = (SEED[2] + NEIGH[2] * bN[i]) * sN[i] * max(0, 1 - n / CAP[2]) * tN;
    const cr = (SEED[3] + NEIGH[3] * bR[i]) * sR[i] * max(0, 1 - r / CAP[3]) * tN;
    const cm = (SEED[4] + NEIGH[4] * bM[i] * min(1, bM[i] * 2.5)) * sM[i] * max(0, 1 - m / CAP[4]) * tM;
    const cL = (SEED[5] + NEIGH[5] * l) * sL[i] * max(0, 1 - l / CAP[5]) * tL;
    const gF = cf * b;
    const gU = cu * (b + 0.6 * f);
    const gN = cn * (b + 0.7 * f + 0.35 * u);
    const gR = cr * (b + 0.6 * f + 0.6 * u + 0.2 * n);
    const gM = cm * (b + 0.9 * f + 0.9 * u + 0.65 * n + 0.25 * r);
    const gL = cL * b;
    const lF = f * (cu * 0.6 + cn * 0.7 + cr * 0.6 + cm * 0.9);
    const lU = u * (cn * 0.35 + cr * 0.6 + cm * 0.9);
    const lN = n * (cr * 0.2 + cm * 0.65);
    const lR = r * (cm * 0.25);
    let nf = f + gF - lF - f * (MORT[0] + stress(sF[i])) * dt;
    let nu = u + gU - lU - u * (MORT[1] + stress(sU[i])) * dt;
    let nn = n + gN - lN - n * (MORT[2] + stress(sN[i])) * dt;
    let nr = r + gR - lR - r * (MORT[3] + stress(sR[i])) * dt;
    let nm = m + gM - m * (MORT[4] + stress(sM[i])) * dt;
    let nl = l + gL - l * (MORT[5] + stress(sL[i])) * dt;
    if (nf < 0) nf = 0;
    if (nu < 0) nu = 0;
    if (nn < 0) nn = 0;
    if (nr < 0) nr = 0;
    if (nm < 0) nm = 0;
    if (nl < 0) nl = 0;
    const s = nf + nu + nn + nr + nm + nl;
    if (s > 1) {
      const k = 1 / s;
      nf *= k; nu *= k; nn *= k; nr *= k; nm *= k; nl *= k;
    }
    F[i] = nf; U[i] = nu; Bn[i] = nn; R[i] = nr; M[i] = nm; L[i] = nl;
  }
  S.evAcc += EV_RATE * Math.pow(2, (E - 0.5) * 1.8) * dt;
  let guard = 0;
  while (S.evAcc >= S.evThr && guard++ < 4) {
    S.evAcc -= S.evThr;
    S.evThr = -log(1 - rnd() * 0.999);
    spawn(S, E);
  }
  S.dir += (0.62 - S.dir) * 0.002 * dt + 0.01 * (rnd() - 0.5) * sqrt(dt);
  S.dirty = true;
}

// a storm tears a ragged ellipse out of old cover, more often where the waves work hardest
function spawn(S, E) {
  const [, , Bn, R, M, L] = S.X;
  let cx = 0, cy = 0, ok = false, low = 0;
  for (let t = 0; t < 16 && !ok; t++) {
    cx = rnd() * W;
    cy = rnd() * H;
    const i = (cy | 0) * W + (cx | 0);
    low = exp(-(((S.Z[i] - 0.4) / 0.4) ** 2));
    ok = S.A[i] > 40 && rnd() < (0.45 + 0.55 * low) * min(1, 1.3 * (M[i] + 0.8 * Bn[i] + 0.8 * R[i] + 0.6 * L[i]));
  }
  if (!ok) return;
  const b = min(9, (3.8 + 3.4 * Math.pow(rnd(), 1.3)) * (0.85 + 0.3 * E) * (0.9 + 0.2 * low));
  stamp(S, cx, cy, b * (1.7 + 1.1 * rnd()), b, S.dir + 0.5 * (rnd() + rnd() - 1));
}

const KAPPA = [1, 1, 0.99, 0.8, 0.995, 0.5];
function stamp(S, cx, cy, a, b, th) {
  const c = cos(th), s = sin(th), Rr = Math.ceil(max(a, b) * 1.5) + 2;
  const ox = (rnd() * W) | 0, oy = (rnd() * H) | 0;
  const y0 = max(0, floor(cy - Rr)), y1 = min(H - 1, floor(cy + Rr));
  const x0 = max(0, floor(cx - Rr)), x1 = min(W - 1, floor(cx + Rr));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      const u = (dx * c + dy * s) / a, v = (-dx * s + dy * c) / b;
      const i = y * W + x;
      const d = sqrt(u * u + v * v) * (1 + 0.45 * (S.RN[((y + oy) & 127) * W + ((x + ox) & 63)] - 0.5));
      const mk = 1 - ss(0.74, 1.06, d);
      if (mk <= 0.004) continue;
      for (let k = 0; k < NS; k++) S.X[k][i] *= 1 - KAPPA[k] * mk;
      if (mk > S.Fl[i]) S.Fl[i] = mk;
      S.Wt[i] = 1;
      S.A[i] = min(S.A[i], -11 * b * max(0, 1 - d));
    }
}

function prerun(S, E) {
  const [F, U, Bn, R, M, L] = S.X;
  for (let i = 0; i < N; i++) {
    const m = 0.8 * S.suit[SM][i];
    const n = min(1 - m, 0.8 * S.suit[SN][i]);
    const r = min(1 - m - n, 0.8 * S.suit[SR][i]);
    M[i] = m; Bn[i] = n; R[i] = r; L[i] = min(1 - m - n - r, 0.8 * S.suit[SL][i]);
  }
  for (let t = 0; t < PRE_T; t += 1.5) step(S, 1.5, E);
  S.Fl.fill(0);
  S.Wt.fill(0);
  S.evAcc = -0.5; // the first storm waits a few seconds
}
const expo = (k) => cl(0.5 + 0.5 * k, 0, 1);

// colour of the rock under the cover: the species laid along 0..1 in a fixed order, bare rock first,
// against a fixed grain, so that a patch grows as a contour moving over the grain
function rebuild(S) {
  const X = S.X, UN = S.UN, NA = S.NA, NB = S.NB, cd = S.cdry, cw = S.cwet;
  const sg = (x) => (x <= -1 ? 0 : x >= 1 ? 1 : 0.5 + 0.5 * (x * (1.5 - 0.5 * x * x)));
  const SIG = 0.09;
  const cum = [0, 0, 0, 0, 0, 0, 0, 0], acc = [0, 0, 0, 0, 0, 0], co = [0, 0, 0, 0, 0, 0];
  const order = [SF, SU, SN, SR, SM, SL];
  for (let i = 0; i < N; i++) {
    let tot = 0;
    for (let j = 0; j < 6; j++) tot += co[j] = ss(0.08, 0.92, X[order[j]][i]);
    const kk = tot > 1 ? 1 / tot : 1;
    cum[1] = max(0, 1 - tot * kk);
    for (let j = 0; j < 6; j++) cum[j + 2] = cum[j + 1] + co[j] * kk;
    const u = UN[i];
    acc.fill(0);
    let wsum = 0;
    const nb = NB[i], va = 1 + 0.4 * (NA[i] - 0.5);
    for (let j = 0; j < 7; j++) {
      const w = sg((u - cum[j]) / SIG) - sg((u - cum[j + 1]) / SIG);
      if (w <= 0.0005) continue;
      const sp = j === 0 ? 0 : order[j - 1] + 1;
      let t = cl(nb * 1.25 - 0.1, 0, 1);
      if (sp === SR + 1) t = t * t * t;
      const p = PAL[sp];
      wsum += w;
      for (let c = 0; c < 3; c++) {
        acc[c] += w * (p[0][c] + (p[1][c] - p[0][c]) * t);
        acc[c + 3] += w * (p[2][c] + (p[3][c] - p[2][c]) * t);
      }
    }
    const k = (wsum > 0 ? 1 / wsum : 0) * va;
    for (let c = 0; c < 3; c++) {
      cd[i * 3 + c] = acc[c] * k;
      cw[i * 3 + c] = acc[c + 3] * k;
    }
  }
  S.dirty = false;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    prerun(S, expo(kn[2]));
    S.ready = true;
  }
  const e = 1 - exp(-d / 0.15);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  const pace = cl(S.ks[1], 0.5, 4), tr = cl(0.5 + 0.5 * S.ks[3], 0, 1);
  const dtm = d * pace * 0.5;
  S.tw += d;
  const tw = S.tw;
  // weather runs on its own clock, not Pace's: storms come in spells and the swell's direction wanders
  const E = cl(expo(S.ks[2]) + 0.45 * (0.55 * sin((TWO_PI * tw) / 83 + 1.3) + 0.45 * sin((TWO_PI * tw) / 137 + 4.1)), 0, 1);

  S.acc += d * pace * 1.8;
  let n = 0;
  while (S.acc >= 0.5 && n++ < 8) {
    S.acc -= 0.5;
    step(S, 0.5, E);
  }
  if (S.dirty) rebuild(S);

  // the tide, and the mean level moved by the Tide knob so that it shows at slack water too
  for (let k = 0; k < 6; k++) S.ph[k] += (TWO_PI * dtm) / PERIOD[k];
  const [pm, ps, pd, pn, pw1, pw2] = S.ph;
  const wander = 0.5 * (sin(pw1) + 0.8 * sin(pw2));
  const T = (cos(pm) * (0.72 + 0.28 * cos(ps)) * 0.8 + 0.28 * cos(pd) + 0.2 * cos(pn) + 0.22 * wander) / 1.5;
  const lv = 0.4 + 0.08 * wander + 0.18 * S.ks[3] + (0.1 + 0.5 * tr) * T;
  S.level = lv > 0.68 ? 0.68 + 0.35 * (lv - 0.68) : lv;
  // the swell's direction wanders, so the waterline tilts a little one way and the other
  S.tilt = (0.6 + 0.8 * tr) * 0.1 * (0.6 * sin((TWO_PI * tw) / 71 + 0.6) + 0.4 * sin((TWO_PI * tw) / 131 + 2.2));
  S.wv -= d;
  if (S.wv <= 0) {
    const u = rnd();
    S.wv = (2 + 6 * rnd()) / (0.5 + E);
    S.reach = max(S.reach, (0.1 + 0.45 * E) * (0.6 + 0.8 * tr) * (0.15 + 0.85 * u * u * u));
  }
  S.reach *= exp(-d / 1.4);
  S.env = 0.62 + 0.38 * sin((TWO_PI * tw) / 23.3 + 1.1) * (0.8 + 0.2 * sin((TWO_PI * tw) / 41 + 0.3));
  S.ampS = (0.01 + 0.052 * E) * S.env * (0.75 + 0.5 * tr);
  S.slap = max(0, sin((TWO_PI * tw) / 7.3)) * max(0, sin((TWO_PI * tw) / 11.1 + 0.8) + 0.35);
  S.E = E;
  S.dtm = dtm;
  render(S, d);
}

function render(S, d) {
  const img = S.img, Z = S.Z, Wt = S.Wt, Fl = S.Fl, cd = S.cdry, cw = S.cwet, BUB1 = S.BUB1, BUB2 = S.BUB2, CL1 = S.CL1, CL2 = S.CL2;
  const lev = S.level, tilt = S.tilt, ampS = S.ampS, E = S.E, tw = S.tw, rc = S.reach, p1 = (TWO_PI * tw) / 4.3, p2 = (TWO_PI * tw) / 6.9;
  const dec = exp(-S.dtm / 1.2), decU = exp(-S.dtm / 3.5), fdec = exp(-d / 0.9);
  const slap = S.slap * max(0, (E - 0.35) / 0.65);
  const sE = 0.45 + 0.55 * E;
  const bx = 3 * tw, by = -8 * tw;
  const ang = S.ks[0] * TWO_PI, ca = cos(ang), sa = sin(ang);
  const VEIL = 0.34, col = [0, 0, 0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3, z = Z[i];
      const sw = ampS * (0.62 * sin(p1 + 0.13 * x + 0.071 * y) + 0.38 * sin(p2 - 0.09 * x + 0.052 * y + 1.7));
      const dd = lev + sw + tilt * (x - 32) * 0.031 - z;
      const fl = Fl[i] * fdec;
      Fl[i] = fl;
      let bub1 = 0, bub2 = 0;
      if (dd > -0.04 || fl > 0.02 || (rc > 0.012 && dd > -rc * 1.8)) {
        bub1 = samp(BUB1, x + bx, y + by);
        bub2 = samp(BUB2, x - 0.6 * bx + 7, y + 0.7 * by + 3);
      }
      // wet where the sea is, where a big wave threw spray, and for a while after
      let wt = Wt[i] * (z > 0.55 ? decU : dec);
      const sm = ss(-0.007, 0.007, dd), sp = rc > 0.012 ? 0.9 * ss(-0.01, 0.05, dd + rc * (0.3 + bub2)) : 0;
      if (sm > wt) wt = sm;
      if (sp > wt) wt = sp;
      Wt[i] = wt;
      const wv = wt < 0.5 ? 2 * wt * wt : 1 - 2 * (1 - wt) * (1 - wt);
      for (let c = 0; c < 3; c++) col[c] = cd[o + c] + (cw[o + c] - cd[o + c]) * wv;
      // slow cloud shadows go over the rock: light and shade, never lit above 1.04
      const sh = cl(1 + 0.07 * ((samp(CL1, x - 1.5 * tw, y - 0.7 * tw) - 0.5) / 0.2 + (samp(CL2, x + 0.9 * tw, y - 1.3 * tw) - 0.5) / 0.2), 0.78, 1.04);
      let foamA = 0;
      if (dd > 0) {
        const gdp = ss(0, 0.05, dd);
        const a = VEIL * (1 - exp(-dd / 0.09));
        const shim = 0.85 + 0.35 * bub2;
        const ca1 = sin(x * 0.33 + sin(y * 0.19 + tw * 0.9) * 1.6 + tw * 0.7);
        const cb1 = sin(y * 0.29 + sin(x * 0.17 - tw * 0.8) * 1.7 - tw * 0.55 + 1.3);
        const ridge = 1 - abs(0.5 * (ca1 + cb1));
        const cv = ridge * ridge;
        const cs = cv * cv * exp(-dd / 0.18);
        const lift = 1 + 0.2 * cs;
        for (let c = 0; c < 3; c++) col[c] = (col[c] * (1 - (1 - TRANS[c]) * gdp) * (1 - 0.6 * a) + TEAL[c] * a * shim + GLINT[c] * cs) * lift;
      }
      const crest = sw / (ampS + 1e-4);
      foamA += exp(-(dd * dd) / 0.000289) * (0.3 + 0.7 * ss(0.18, 0.6, bub1)) * sE;
      if (dd > 0) {
        foamA += ss(0, 0.015, dd) * (1 - ss(0.05, 0.16, dd)) * ss(-0.1, 0.7, crest) * E * ss(0.3, 0.62, bub2) * 0.85;
        if (slap > 0.02) foamA += slap * ss(0.3, 0.6, bub1) * ss(0.2, 0.02, z) * 0.9;
      }
      if (fl > 0.02) foamA += fl * (0.25 + 0.75 * ss(0.25, 0.6, bub1)) * 0.65;
      const f = foamA > 0.92 ? 0.92 : foamA > 0.01 ? foamA : 0;
      for (let c = 0; c < 3; c++) col[c] = col[c] * sh * (1 - f) + FOAMC[c] * f;
      tint(col, ca, sa);
      for (let c = 0; c < 3; c++) {
        const v = col[c];
        img[o + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, img[o], img[o + 1], img[o + 2]);
    }
}
