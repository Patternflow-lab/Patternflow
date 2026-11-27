// ===== Patternflow pattern =====
// Title:   Intertidal Gaps
// Family:  intertidal
// Idea:    A wave-swept rock face seen straight on, where blue-black mussel beds, cream barnacles, orange lichen and red algae sit in tilted height zones, storm waves tear ragged grey scars out of them that heal through olive film, green weed and white barnacles until the mussels creep back in from the edge, and a translucent teal tide rises and falls across the whole mosaic.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: barnacle zones, Chthamalus high and Balanus low, one limited by drying and the other by competition (Joseph Connell, 1961); the mussel Mytilus as the competitive dominant held back by predators and waves (Robert Paine, 1966); gaps torn in mussel beds by storms and logs (Paul Dayton, 1971) and the patchwork of ages they leave (Levin and Paine, 1974; Paine and Levin, 1981, "Intertidal landscapes: disturbance and the dynamics of pattern"); succession through film and Ulva to barnacles, algae and mussels (Wayne Sousa, 1979); intermediate disturbance (Connell, 1978); a replacement order of colonisers and dominants (Levins and Culver, 1971; David Tilman, 1994); mussels creeping from a bed's edge (Okamura, 1986; van de Koppel et al., 2005). All from memory; I could not place the Hulscher the brief named.
// Round:   267
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Exposure=-1..1, Tide=-1..1
//
// Knob 1: Hue. Turns the whole palette once round the wheel as the knob travels, the sea with it, every colour keeping its luma; dark colours that land among the reds and yellows are let go towards grey so they do not go brown. At 0 and 1 it is the natural shore (slate rock, indigo mussels, cream barnacles, orange lichen, crimson red algae, emerald weed, teal sea); at 0.25 the lichen is pink and the mussels dark green; at 0.5 the top is pale blue and the mussels charcoal; at 0.75 the lichen is lime and the mussels plum.
// Knob 2: Pace. How fast the shore lives: 0.5 at the minimum, 2 where it opens, 4 at the top. At 2 one panel second is about an hour of tide, so the tide takes 12.4 s, its spring-neap swell 104 s and a scar about 75 s to close; at 0.5 they take 50 s, 416 s and 5 minutes; at 4, 6.2 s, 52 s and 37 s. Waves and glints follow Pace by its square root; the cloud shadows not at all.
// Knob 3: Exposure. Wave energy: -1 sheltered, 0 where it opens, 1 battered. At Pace 2 storms tear about 12 scars a minute at -1, 22 at 0 and 42 at 1, of 85, 146 and 260 LEDs squared on average; the swash is 1.3, 4 and 8 rows high, and above 0 white water slaps the lowest rows in sets. Mussels hold about 60 percent of the mid-shore at -1 and 15 to 25 at 1, where bare slate, film and weed take the rest. Scars answer over a minute or two, swash and foam at once.
// Knob 4: Tide. How far the waterline climbs and falls: -1 neap-like, 0.06 where it opens, 1 a big range. Along the middle of the panel the waterline spends 90 percent of 900 s between row 68 and 86 at -1, 52 and 104 where it opens, 38 and 120 at 1; the mean level also moves about 9 rows with the knob so that it shows even at slack water.
//
// What the picture is. A vertical slice of a rock face seen from the front. Height decides who lives where: lichen at the top, then barnacles, mussels in the middle, red algae low, each with a wobbling boundary of its own, so the zones tilt about 17 degrees and break into interlocking patches and not stripes. Storm scars lie over them as grey ragged ellipses pointing down and to the right, the way the swell drags, each at its own stage: slate, olive film, green weed, cream spat, then mussels closing in from the edge. The tide is a translucent teal veil with a ragged line of foam at its edge, a dark wet fringe behind it as it falls, and dimmer bluer colours and glints under it. Cloud shadows drift over all.
// What is modelled. Cover fractions of six species (film, Ulva, barnacle, red algae, mussel, lichen) and bare rock on the 64 by 128 grid. A species settles on bare rock from a seed rain and from its neighbours, and grows over a weaker one: film, then Ulva, then barnacle, then mussel, with red algae winning low. How well each does at a place depends on its height up the rock and a noise of its own, so the zones overlap. Mussels need a neighbouring bed, so a gap closes from its margin. Storms land where the cover is old, bigger and more often on the lower mid-shore, and strip a ragged ellipse. The first update runs 330 model seconds at the knobs it is given, so it opens on a developed mosaic.
// What is made up. Every rate and cap, who can overgrow whom, the size, rate and pointing of storms, the cloud shadows, the foam on a new scar, the white water on the lowest rows, the tide's 104 s spring-neap beat (8 times the semidiurnal here, 28 in life) and its diurnal, lunar and wander terms, the knob's nudge of the mean level, and every colour. The grain is a fixed noise thresholded against the cover, so a patch grows as a contour moving over fixed grain. A picture of a mechanism, not a shore.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, exp, sin, cos, abs, min, max, PI, log } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

// species: film, ulva, barnacle, red algae, mussel, lichen
const SF = 0, SU = 1, SN = 2, SR = 3, SM = 4, SL = 5, NS = 6;

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
// stood to mean 0.5 and a spread of 0.2
function stand(out) {
  let m = 0, v = 0;
  for (let i = 0; i < N; i++) m += out[i];
  m /= N;
  for (let i = 0; i < N; i++) v += (out[i] - m) * (out[i] - m);
  const k = 0.2 / sqrt(v / N + 1e-9);
  for (let i = 0; i < N; i++) out[i] = cl(0.5 + (out[i] - m) * k, 0, 1);
  return out;
}
// a sum of octaves [nx, ny, weight]
function fbm(list) {
  const out = new Float32Array(N);
  for (const [nx, ny, w] of list) {
    const n = vnoise(nx, ny);
    for (let i = 0; i < N; i++) out[i] += n[i] * w;
  }
  return stand(out);
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

// the same noise drawn out along a direction, sa and sb the scale along and across it (below 1 is longer)
function aniso(base, ang, sa, sb) {
  const c = cos(ang), s = sin(ang), out = new Float32Array(N), ox = rnd() * 64, oy = rnd() * 128;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = samp(base, (x * c + y * s) * sa + ox, (-x * s + y * c) * sb + oy);
  return stand(out);
}

// [dry a, dry b, wet a, wet b] for bare rock and then the six species
const PAL = [
  [[122, 126, 134], [96, 100, 110], [66, 78, 98], [50, 60, 80]],
  [[150, 144, 62], [124, 122, 46], [112, 126, 34], [88, 106, 28]],
  [[170, 208, 70], [130, 190, 60], [34, 172, 98], [96, 198, 84]],
  [[236, 228, 204], [200, 194, 172], [224, 228, 212], [186, 200, 194]],
  [[196, 72, 62], [228, 128, 148], [226, 30, 56], [244, 110, 140]],
  [[80, 90, 128], [52, 60, 94], [32, 44, 104], [84, 106, 168]],
  [[246, 140, 26], [240, 196, 44], [240, 116, 16], [236, 178, 36]],
];
const TEAL = [6, 130, 124], FOAMC = [232, 248, 244], GLINT = [44, 84, 78];
const TRANS = [0.66, 0.93, 0.92];

function rot(c, ang, out) {
  const r = c[0], g = c[1], b = c[2];
  const Y = 0.299 * r + 0.587 * g + 0.114 * b;
  const I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
  const ca = cos(ang), sa = sin(ang);
  const I2 = I * ca - Q * sa, Q2 = I * sa + Q * ca;
  const d = [0.956 * I2 + 0.621 * Q2, -0.272 * I2 - 0.647 * Q2, -1.106 * I2 + 1.703 * Q2];
  let s = 1;
  for (let k = 0; k < 3; k++) {
    if (d[k] > 1e-6) s = min(s, (255 - Y) / d[k]);
    else if (d[k] < -1e-6) s = min(s, Y / -d[k]);
  }
  s = max(s, 0);
  let r2 = Y + d[0] * s, g2 = Y + d[1] * s, b2 = Y + d[2] * s;
  // a dark colour that lands in the reds and yellows turns to brown mud on the panel, so it is let go towards grey
  const mx = max(r2, g2, b2), mn = min(r2, g2, b2), v = mx / 255;
  if (mx - mn > 1e-3) {
    let h = mx === r2 ? ((g2 - b2) / (mx - mn)) * 60 : mx === g2 ? (b2 - r2) / (mx - mn) * 60 + 120 : (r2 - g2) / (mx - mn) * 60 + 240;
    if (h > 180) h -= 360;
    const wh = ss(-30, -8, h) * (1 - ss(70, 100, h));
    const k = 1 - 0.88 * wh * (1 - ss(0.45, 0.78, v));
    const gy = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
    r2 = gy + (r2 - gy) * k;
    g2 = gy + (g2 - gy) * k;
    b2 = gy + (b2 - gy) * k;
  }
  out[0] = r2;
  out[1] = g2;
  out[2] = b2;
}

export function setup(params) {
  const S = {
    ready: false,
    ks: [0, 2, 0, 0.06],
    X: [], // cover of each species
    bl: [], // each blurred
    tmp: new Float32Array(N),
    suit: [],
    Z: null,
    UN: null, NA: null, NB: null, RN: null, BUB1: null, BUB2: null,
    Wt: new Float32Array(N), // wetness
    Fl: new Float32Array(N), // foam where a scar was just torn
    cdry: new Float32Array(N * 3),
    cwet: new Float32Array(N * 3),
    pal: [],
    palHue: -9,
    dirty: true,
    acc: 0,
    evAcc: 0,
    evThr: 1,
    dir: 0.62, // the way the swell drags: down to the right, 36 degrees below horizontal
    // tide phases: semidiurnal, spring-neap, diurnal, lunar, two wanders
    ph: [4.29, 0.58, 1.27, 3.3, 0.4, 2.1],
    tw: 0, // wave and water time, model seconds scaled gently with Pace
    tc: 0, // clock time, for the drifting cloud shadows
    level: 0.4, ampS: 0.03, env: 1, slap: 0,
    img: new Uint8Array(N * 3),
  };
  for (let k = 0; k < NS; k++) {
    S.X.push(new Float32Array(N));
    S.bl.push(new Float32Array(N));
    S.suit.push(new Float32Array(N));
  }
  // rock face: height above low water, 1 at the top, 0 at the bottom, tilted ten degrees, with relief
  const rel = aniso(fbm([[5, 10, 1], [12, 24, 0.55], [26, 52, 0.2]]), 0.5, 0.45, 1.15);
  S.Z = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      S.Z[i] = 1 - (y + 0.3 * (x - 32)) / (H - 1) + 0.1 * ((rel[i] - 0.5) / 0.2);
    }
  const dl = [];
  for (let k = 0; k < NS; k++) dl.push(aniso(fbm([[5, 10, 1], [11, 22, 0.45]]), 0.62, 0.6, 1.1));
  for (let i = 0; i < N; i++) {
    const z = S.Z[i], d = (k) => z + 0.085 * ((dl[k][i] - 0.5) / 0.2);
    S.suit[SF][i] = 0.55 + 0.45 * (1 - ss(0.2, 0.95, d(SF)));
    S.suit[SU][i] = 0.3 + 0.7 * (1 - ss(0.5, 0.9, d(SU)));
    S.suit[SN][i] = ss(0.2, 0.4, d(SN)) * (1 - ss(0.88, 0.98, d(SN)));
    S.suit[SR][i] = 1 - ss(0.14, 0.36, d(SR));
    S.suit[SM][i] = ss(0.1, 0.24, d(SM)) * (1 - ss(0.6, 0.78, d(SM)));
    S.suit[SL][i] = ss(0.74, 0.9, d(SL));
  }
  S.UN = ranked(aniso(fbm([[18, 36, 1], [9, 18, 0.8], [4, 8, 0.35]]), 0.62, 0.74, 1.05));
  S.NA = fbm([[32, 64, 1], [16, 32, 0.5]]);
  S.NB = fbm([[10, 20, 1], [20, 40, 0.4]]);
  S.RN = fbm([[24, 48, 1], [10, 20, 0.9]]);
  S.BUB1 = fbm([[16, 32, 1], [32, 64, 0.5]]);
  S.BUB2 = fbm([[12, 24, 1], [24, 48, 0.5]]);
  S.CL1 = fbm([[3, 6, 1], [6, 12, 0.5]]);
  S.CL2 = fbm([[4, 8, 1], [8, 16, 0.4]]);
  params.s = S;
  return S;
}

// rates per model second, a model second being a panel second at Pace 2
const SEED = [0.03, 0.012, 0.004, 0.002, 0.0008, 0.0006];
const NEIGH = [0.07, 0.06, 0.05, 0.06, 0.12, 0.01];
// film and weed also lose 0.02 and 0.012 a second to grazing limpets
const MORT = [0.032, 0.016, 0.0005, 0.0004, 0.0004, 0.0002];
const CAP = [1, 1, 0.78, 0.86, 0.86, 0.85];

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

const PERIOD = [12.4, 104, 23.3, 12.97, 301, 477];
const stress = (s) => 0.05 * ss(0.45, 0.08, s);
function step(S, dt, E) {
  const X = S.X, bl = S.bl;
  for (const k of [SU, SN, SR, SM]) blur(X[k], bl[k], S.tmp);
  const [F, U, Bn, R, M, L] = X;
  const [, bU, bN, bR, bM] = bl;
  const [sF, sU, sN, sR, sM, sL] = S.suit;
  for (let i = 0; i < N; i++) {
    const f = F[i], u = U[i], n = Bn[i], r = R[i], m = M[i], l = L[i];
    let b = 1 - f - u - n - r - m - l;
    if (b < 0) b = 0;
    const cf = (SEED[0] + NEIGH[0] * f) * sF[i] * dt;
    const cu = (SEED[1] + NEIGH[1] * bU[i]) * sU[i] * dt;
    const cn = (SEED[2] + NEIGH[2] * bN[i]) * sN[i] * max(0, 1 - n / CAP[2]) * dt;
    const cr = (SEED[3] + NEIGH[3] * bR[i]) * sR[i] * max(0, 1 - r / CAP[3]) * dt;
    const cm = (SEED[4] + NEIGH[4] * bM[i] * min(1, bM[i] * 2.5)) * sM[i] * max(0, 1 - m / CAP[4]) * dt;
    const cL = (SEED[5] + NEIGH[5] * l) * sL[i] * max(0, 1 - l / CAP[5]) * dt;
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
  while (S.evAcc >= S.evThr && guard++ < 6) {
    S.evAcc -= S.evThr;
    S.evThr = -log(1 - rnd() * 0.999);
    spawn(S, E);
  }
  S.dir += (0.62 - S.dir) * 0.002 * dt + 0.01 * (rnd() - 0.5) * sqrt(dt);
  S.dirty = true;
}
const EV_RATE = 0.15;

function spawn(S, E) {
  const [F, U, Bn, R, M, L] = S.X;
  let cx = 0, cy = 0, ok = false;
  for (let t = 0; t < 14 && !ok; t++) {
    cx = rnd() * W;
    cy = rnd() * H;
    const i = (cy | 0) * W + (cx | 0), z = S.Z[i];
    const wave = 0.22 + 0.78 * exp(-(((z - 0.38) / 0.36) ** 2));
    const mature = min(1, 1.3 * (M[i] + 0.8 * Bn[i] + 0.8 * R[i] + 0.6 * L[i] + 0.2 * U[i]));
    ok = rnd() < wave * mature;
  }
  if (!ok) return;
  const z = S.Z[(cy | 0) * W + (cx | 0)];
  const lowness = exp(-(((z - 0.38) / 0.4) ** 2));
  const sizeF = (0.7 + 0.6 * E) * (0.8 + 0.55 * lowness);
  let a = (4.5 + 11 * Math.pow(rnd(), 1.8)) * sizeF;
  let q = 1.7 + 1.8 * rnd();
  let th = S.dir + 0.4 * (rnd() + rnd() + rnd() - 1.5);
  if (rnd() < 0.08) {
    a = (15 + 10 * rnd()) * (0.7 + 0.4 * E);
    q = 4.5 + 1.5 * rnd();
    th = S.dir + 0.9 * (rnd() - 0.5);
  }
  const b = max(2.2, a / q);
  stamp(S, cx, cy, a, b, th);
  if (rnd() < 0.3) {
    const th2 = th + 0.8 * (rnd() - 0.5) + (rnd() < 0.5 ? 0.5 : -0.5);
    const off = 0.7 * a * (rnd() < 0.5 ? 1 : -1);
    stamp(S, cx + off * cos(th), cy + off * sin(th), a * 0.55, max(2, b * 0.9), th2);
  }
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
      const nz = S.RN[((y + oy) & 127) * W + ((x + ox) & 63)];
      const d = sqrt(u * u + v * v) * (1 + 0.62 * (nz - 0.5));
      const mk = 1 - ss(0.74, 1.06, d);
      if (mk <= 0.004) continue;
      for (let k = 0; k < NS; k++) S.X[k][i] *= 1 - KAPPA[k] * mk;
      if (mk > S.Fl[i]) S.Fl[i] = mk;
      S.Wt[i] = 1;
    }
}

function prerun(S, kn) {
  const [F, U, Bn, R, M, L] = S.X;
  for (let i = 0; i < N; i++) {
    const m = 0.8 * S.suit[SM][i];
    const n = min(1 - m, 0.8 * S.suit[SN][i]);
    const r = min(1 - m - n, 0.8 * S.suit[SR][i]);
    const l = min(1 - m - n - r, 0.8 * S.suit[SL][i]);
    M[i] = m; Bn[i] = n; R[i] = r; L[i] = l;
    F[i] = 0; U[i] = 0;
  }
  const E = expo(kn[2]);
  for (let t = 0; t < PRE_T; t += 1.5) step(S, 1.5, E);
  S.Fl.fill(0);
  S.Wt.fill(0);
  S.evAcc = -0.5; // the first storm waits a few seconds
}
const PRE_T = 330;
const expo = (k) => cl(0.5 + 0.5 * k, 0, 1);

function rebuild(S) {
  const X = S.X, UN = S.UN, NA = S.NA, NB = S.NB, cd = S.cdry, cw = S.cwet, pal = S.pal;
  const sg = (x) => (x <= -1 ? 0 : x >= 1 ? 1 : 0.5 + 0.5 * (x * (1.5 - 0.5 * x * x)));
  const SIG = 0.07;
  const cum = [0, 0, 0, 0, 0, 0, 0, 0], acc = [0, 0, 0, 0, 0, 0];
  const order = [SF, SU, SN, SR, SM, SL];
  for (let i = 0; i < N; i++) {
    let tot = 0;
    for (let k = 0; k < NS; k++) tot += X[k][i];
    const bare = max(0, 1 - tot);
    // species laid along 0..1 in a fixed order, bare rock first
    cum[0] = 0;
    cum[1] = bare;
    for (let j = 0; j < 6; j++) cum[j + 2] = cum[j + 1] + X[order[j]][i];
    const u = UN[i];
    acc.fill(0);
    let wsum = 0;
    const nb = NB[i], va = 1 + 0.5 * (NA[i] - 0.5);
    for (let j = 0; j < 7; j++) {
      const hi = j === 6 ? 2 : cum[j + 1];
      const w = sg((u - cum[j]) / SIG) - (j === 6 ? 0 : sg((u - hi) / SIG));
      if (w <= 0.0005) continue;
      const sp = j === 0 ? 0 : order[j - 1] + 1;
      let t = cl(nb * 1.25 - 0.1, 0, 1);
      if (sp === SR + 1) t = t * t * t;
      const p = pal[sp];
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

function buildPal(S, hue) {
  const ang = hue * TWO_PI, tmp = [0, 0, 0];
  const pal = [];
  for (let s = 0; s < 7; s++) {
    const row = [];
    for (let v = 0; v < 4; v++) {
      rot(PAL[s][v], ang, tmp);
      row.push([tmp[0], tmp[1], tmp[2]]);
    }
    pal.push(row);
  }
  S.pal = pal;
  rot(TEAL, ang, tmp); S.teal = [tmp[0], tmp[1], tmp[2]];
  rot(FOAMC, ang, tmp); S.foam = [tmp[0], tmp[1], tmp[2]];
  rot(GLINT, ang, tmp); S.glint = [tmp[0], tmp[1], tmp[2]];
  S.palHue = hue;
  S.dirty = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const first = !S.ready;
  if (first) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    buildPal(S, S.ks[0]);
    prerun(S, S.ks);
    S.ready = true;
  }
  const e = 1 - exp(-d / 0.15);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  const pace = cl(S.ks[1], 0.5, 4), E = expo(S.ks[2]), tr = cl(0.5 + 0.5 * S.ks[3], 0, 1);
  const dtm = d * pace * 0.5;
  if (abs(S.palHue - S.ks[0]) > 0.002) buildPal(S, S.ks[0]);

  S.acc += d * pace * 1.2;
  let n = 0;
  while (S.acc >= 0.5 && n++ < 8) {
    S.acc -= 0.5;
    step(S, 0.5, E);
  }
  if (S.dirty) rebuild(S);

  // the tide
  for (let k = 0; k < 6; k++) S.ph[k] += (TWO_PI * dtm) / PERIOD[k];
  const [pm, ps, pd, pn, pw1, pw2] = S.ph;
  const wander = 0.5 * (sin(pw1) + 0.8 * sin(pw2));
  const T = (cos(pm) * (0.72 + 0.28 * cos(ps)) * 0.8 + 0.28 * cos(pd) + 0.2 * cos(pn) + 0.22 * wander) / 1.5;
  const A = 0.1 + 0.5 * tr;
  S.level = 0.4 + 0.05 * wander + 0.07 * S.ks[3] + A * T;
  const rt = sqrt(pace * 0.5);
  S.tw += d * rt;
  S.tc += d;
  const tw = S.tw;
  S.env = 0.62 + 0.38 * sin((TWO_PI * tw) / 23.3 + 1.1) * (0.8 + 0.2 * sin((TWO_PI * tw) / 41 + 0.3));
  S.ampS = (0.01 + 0.052 * E) * S.env;
  S.slap = max(0, sin((TWO_PI * tw) / 7.3)) * max(0, sin((TWO_PI * tw) / 11.1 + 0.8) + 0.35);
  S.E = E;
  S.dtm = dtm;
  render(S, d);
}

function render(S, d) {
  const img = S.img, Z = S.Z, Wt = S.Wt, Fl = S.Fl, cd = S.cdry, cw = S.cwet;
  const BUB1 = S.BUB1, BUB2 = S.BUB2, CL1 = S.CL1, CL2 = S.CL2, tc = S.tc;
  const lev = S.level, ampS = S.ampS, E = S.E, tw = S.tw, p1 = (TWO_PI * tw) / 4.3, p2 = (TWO_PI * tw) / 6.9;
  const teal = S.teal, foam = S.foam, glint = S.glint;
  const dec = exp(-S.dtm / 1.2), fdec = exp(-d / 0.9);
  const slap = S.slap * max(0, (E - 0.35) / 0.65);
  const sE = 0.45 + 0.55 * E;
  const bx = 3 * tw, by = -8 * tw;
  const VEIL = 0.34, col = [0, 0, 0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3, z = Z[i];
      const sw = ampS * (0.62 * sin(p1 + 0.13 * x + 0.071 * y) + 0.38 * sin(p2 - 0.09 * x + 0.052 * y + 1.7));
      const dd = lev + sw - z;
      const sm = ss(-0.007, 0.007, dd);
      let wt = Wt[i] * dec;
      if (sm > wt) wt = sm;
      Wt[i] = wt;
      const wv = wt < 0.5 ? 2 * wt * wt : 1 - 2 * (1 - wt) * (1 - wt);
      for (let c = 0; c < 3; c++) col[c] = cd[o + c] + (cw[o + c] - cd[o + c]) * wv;
      let foamA = 0;
      const fl = Fl[i] * fdec;
      Fl[i] = fl;
      let bub1 = 0, bub2 = 0;
      if (dd > -0.04 || fl > 0.02) {
        bub1 = samp(BUB1, x + bx, y + by);
        bub2 = samp(BUB2, x - 0.6 * bx + 7, y + 0.7 * by + 3);
      }
      if (dd > 0) {
        const gdp = ss(0, 0.05, dd);
        const a = VEIL * (1 - exp(-dd / 0.09));
        const shim = 0.85 + 0.35 * bub2;
        const ca = sin(x * 0.33 + sin(y * 0.19 + tw * 0.9) * 1.6 + tw * 0.7);
        const cb = sin(y * 0.29 + sin(x * 0.17 - tw * 0.8) * 1.7 - tw * 0.55 + 1.3);
        const ridge = 1 - abs(0.5 * (ca + cb));
        const cv = ridge * ridge;
        const cs = cv * cv * exp(-dd / 0.18);
        const lift = 1 + 0.2 * cs;
        for (let c = 0; c < 3; c++) col[c] = (col[c] * (1 - (1 - TRANS[c]) * gdp) * (1 - 0.6 * a) + teal[c] * a * shim + glint[c] * cs) * lift;
      }
      let sh = 1 + 0.07 * ((samp(CL1, x - 1.5 * tc, y - 0.7 * tc) - 0.5) / 0.2 + (samp(CL2, x + 0.9 * tc, y - 1.3 * tc) - 0.5) / 0.2);
      sh = sh < 0.78 ? 0.78 : sh > 1.04 ? 1.04 : sh;
      const crest = sw / (ampS + 1e-4);
      const edge = exp(-(dd * dd) / 0.000289);
      foamA += edge * (0.3 + 0.7 * ss(0.18, 0.6, bub1)) * sE;
      if (dd > 0) {
        const band = ss(0, 0.015, dd) * (1 - ss(0.05, 0.16, dd));
        foamA += band * ss(-0.1, 0.7, crest) * E * ss(0.3, 0.62, bub2) * 0.85;
        if (slap > 0.02) foamA += slap * ss(0.3, 0.6, bub1) * ss(0.2, 0.02, z) * 0.9;
      }
      if (fl > 0.02) foamA += fl * (0.25 + 0.75 * ss(0.25, 0.6, bub1)) * 0.65;
      const f = foamA > 0.92 ? 0.92 : foamA > 0.01 ? foamA : 0;
      for (let c = 0; c < 3; c++) {
        const v = (col[c] * sh) + (foam[c] - col[c] * sh) * f;
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
