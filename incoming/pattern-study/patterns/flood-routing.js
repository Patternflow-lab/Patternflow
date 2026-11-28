// ===== Patternflow pattern =====
// Title:   Flood Routing
// Family:  floodrouting
// Idea:    A map of a river network from above while storms drift over the catchment, each patch of rain sending a flood wave down the branches where waves add at the junctions and the big ones overtake the small, so that a storm travelling down the valley at the speed of its own flood wave piles the outlet peak, drawn as a hydrograph along the bottom, far above the rest.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: kinematic waves, Q = alpha A^m with Manning's m = 5/3 (M. J. Lighthill and G. B. Whitham, 1955, from memory), kinematic resonance of a storm moving down a basin (Fred Ogden and colleagues, 1995; Vijay Singh, 1997, from memory), random river networks (Adrian Scheidegger, 1967, from memory), a stream network that grows and shrinks with the wetness of the ground (variable source areas, from memory), original code, pattern round 277
// Round:   277
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Storm=0..4, Wetness=-1..1, Rough=-1..1
//
// Knob 1: Hue. Turns water (0.475 + K1 of a turn), rain haze, flood plain, flashes and the amber of the strip together: teal and iron blue at 0, violet at 0.25, crimson at 0.5, lime at 0.75. They also wander up to 0.085 of a turn on clocks of 27 to 97 s. The ground keeps its navy.
// Knob 2: Storm. Speed of the rain cells, 1.85 LEDs/s per unit: 0, 3.7 at the opening, 7.4 at 4; 95 percent go down the valley. One cell alone raises the outlet to 0.26 of bankfull at 0, 0.33 at 2, 0.39 at 3 and 0.30 at 4: wave and storm keep step near 3. With about 3 cells at once, over 900 s the outlet is over bankfull 8.4 percent of the time at 0.5, 13.2 at the opening, 25.0 at 3 and 14.0 at 4.
// Knob 3: Wetness. Runoff coefficient 0.12 + 0.66 s^1.4 + 0.12 (2^(0.6 K3) - 1), s the soil moisture; the soil dries in 70 x 2^(0.7 K3) s and the groundwater in 190 x 2^(0.7 K3) s. Over 900 s the outlet is over bankfull 1.4 percent of the time at -1, 13.2 at the opening and 56.0 at 1.
// Knob 4: Rough. Manning's n: speed at bankfull 14 x 2^(-0.7 K4) LEDs/s, 22.7, 13.6 and 8.6, so the longest path of 195 LEDs takes 8.6, 14.3 and 22.7 s, and the rain counts 2^(0.55 K4) in bankfull units: over bankfull 0.6, 13.2 and 33.8 percent. Drawn on top: riffles that run down the water, and a relief of the ground.
//
// The catchment is 32 x 56 cells of 2 x 2 LEDs (eight more rows lie below the panel), built once from seed 7357 into 385 reaches, 328 on the panel. Each has a stage a and Q = Qbf a^(5/3), solved by upwind steps of 0.2 s. A reach runs where the groundwater is high enough: the trunk always, the heads in wet spells and where rain has fallen. Wet and dry spells follow each other at random. The bottom 14 rows draw the outlet's Q / Qbf of the last 40 s, amber over bankfull. Drawn, not modelled: haze, flashes, flood plain, riffles, relief, the swell of light on the water, the drift of colour.

const W = 64, H = 128, GW = 32, GH = 56, GHT = 64, NC = GW * GHT, PH = GH * 2; // GHT rows of cells, the lowest 8 below the picture
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, cbrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// constants
const MM = 5 / 3;          // Q = alpha A^m, Manning in a wide channel
const CB0 = 14;            // celerity at bankfull, LEDs/s, at Rough 0
const U0 = 1.85;           // LEDs/s of storm per unit of Storm
const QB = 0.088;          // bankfull Q per cell^BETA
const BETA = 0.88;
const SEED = 7357;         // the catchment
const THRESH = 8;          // cells that make a channel
const TAUH = 0.5;          // hillslope lag, s
const WET = 0.02;          // soil wetting per rain
const HN = 230;            // hydrograph samples
const HP = 0.2;            // physics step, s
const RL = 10;             // riffle wavelength, LEDs
const BASE = 0.0046;       // baseflow per cell of a running reach
const ASX = 0.71;          // width of a rain cell across the valley, in R / 2.2
const ASY = 1.41;          // and its length along it
const DRY = 0.7;           // share of a dry reach that shows
const THM = 0.5;           // wetness a head needs to run
const KG = 0.14;           // groundwater recharge per unit of rain
const RW = 0.05;           // and per wet spell
const PHI = new Float32Array(65);
for (let i = 0; i <= 64; i++) PHI[i] = 0.12 + 0.66 * pow(i / 64, 1.4);

// the catchment
function build(S) {
  const rg = prng(SEED);
  const mk = (sp, amp) => {
    const nx = ceil(GW / sp) + 2, ny = ceil(GHT / sp) + 2, g = [];
    for (let i = 0; i < nx * ny; i++) g.push(rg());
    return (x, y) => {
      const fx = x / sp, fy = y / sp, ix = floor(fx), iy = floor(fy);
      const tx = sm(0, 1, fx - ix), ty = sm(0, 1, fy - iy);
      const a = g[iy * nx + ix], b = g[iy * nx + ix + 1], c = g[(iy + 1) * nx + ix], d = g[(iy + 1) * nx + ix + 1];
      const top = a + (b - a) * tx, bot = c + (d - c) * tx;
      return amp * (top + (bot - top) * ty - 0.5);
    };
  };
  const n1 = mk(7, 0.5), n2 = mk(3.2, 0.26);
  const z = new Float32Array(NC);
  for (let y = 0; y < GHT; y++)
    for (let x = 0; x < GW; x++)
      z[y * GW + x] = 0.95 * sqrt(pow(0.5 * (x - 15.5) / 16, 2) + pow((GHT - 1 - y) / GHT, 2)) + 0.5 * pow(abs(x - 15.5) / 16, 1.3) + n1(x, y) + n2(x, y) + 0.05 * rg();
  // priority flood from the outlet: every cell drains to the neighbour it was reached from
  const OC = (GHT - 1) * GW + 16;
  const zf = new Float32Array(NC), par = new Int16Array(NC).fill(-1), seen = new Uint8Array(NC), order = [];
  const hp = [];
  const push = (c) => {
    let i = hp.length;
    hp.push(c);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (zf[hp[p]] <= zf[c]) break;
      hp[i] = hp[p];
      i = p;
    }
    hp[i] = c;
  };
  const pop = () => {
    const top = hp[0], last = hp.pop();
    const n = hp.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let ch = 2 * i + 1;
        if (ch >= n) break;
        if (ch + 1 < n && zf[hp[ch + 1]] < zf[hp[ch]]) ch++;
        if (zf[hp[ch]] >= zf[last]) break;
        hp[i] = hp[ch];
        i = ch;
      }
      hp[i] = last;
    }
    return top;
  };
  zf[OC] = z[OC];
  seen[OC] = 1;
  push(OC);
  while (hp.length) {
    const c = pop();
    order.push(c);
    const cx = c % GW, cy = (c / GW) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GHT) continue;
        const n = ny * GW + nx;
        if (seen[n]) continue;
        seen[n] = 1;
        zf[n] = max(z[n], zf[c] + 0.0004);
        par[n] = c;
        push(n);
      }
  }
  const ac = new Float32Array(NC).fill(1);
  for (let i = order.length - 1; i > 0; i--) ac[par[order[i]]] += ac[order[i]];
  // channel cells are the ones that collect THRESH cells or more
  const id = new Int16Array(NC).fill(-1), cell = [];
  for (const c of order) if (ac[c] >= THRESH) { id[c] = cell.length; cell.push(c); }
  const N = cell.length;
  const cn = new Int16Array(NC);
  for (const c of order) cn[c] = id[c] >= 0 ? id[c] : cn[par[c]];
  const down = new Int16Array(N), L = new Float32Array(N), AC = new Float32Array(N), NCELL = new Float32Array(N);
  const PX = new Float32Array(N), PY = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const c = cell[i], p = par[c];
    down[i] = p >= 0 ? id[p] : -1;
    L[i] = p >= 0 && (p % GW !== c % GW) && ((p / GW | 0) !== (c / GW | 0)) ? 2.83 : 2;
    AC[i] = ac[c];
    PX[i] = 2 * (c % GW) + 0.5;
    PY[i] = 2 * ((c / GW) | 0) + 0.5;
  }
  for (let c = 0; c < NC; c++) NCELL[cn[c]]++;
  // the drawn course is a little smoother than the cells it follows
  const ups = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) if (down[i] >= 0) ups[down[i]].push(i);
  for (let pass = 0; pass < 2; pass++) {
    const nx = new Float32Array(N), ny = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (down[i] < 0) { nx[i] = PX[i]; ny[i] = PY[i]; continue; }
      let sx = 0, sy = 0;
      for (const j of ups[i]) { sx += PX[j]; sy += PY[j]; }
      const u = ups[i].length;
      if (u) { nx[i] = 0.5 * PX[i] + 0.25 * PX[down[i]] + 0.25 * sx / u; ny[i] = 0.5 * PY[i] + 0.25 * PY[down[i]] + 0.25 * sy / u; }
      else { nx[i] = 0.7 * PX[i] + 0.3 * PX[down[i]]; ny[i] = 0.7 * PY[i] + 0.3 * PY[down[i]]; }
    }
    PX.set(nx); PY.set(ny);
  }
  let amax = 1;
  for (let i = 0; i < N; i++) amax = max(amax, AC[i]);
  const QBF = new Float32Array(N), WB = new Float32Array(N), RT = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    QBF[i] = QB * pow(AC[i], BETA);
    WB[i] = 2.6 + 1.5 * sqrt(AC[i] / amax);
    RT[i] = 1 / (MM * L[i]);
  }
  // terrain shade, faint: the filled surface smoothed, lit from the upper left
  const zs = new Float32Array(NC);
  for (let y = 0; y < GHT; y++)
    for (let x = 0; x < GW; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = cl(x + dx, 0, GW - 1), yy = cl(y + dy, 0, GHT - 1);
          s += zf[yy * GW + xx]; n++;
        }
      zs[y * GW + x] = s / n;
    }
  const TER = new Float32Array(W * PH * 2);
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < W; x++) {
      const cx = cl(x >> 1, 1, GW - 2), cy = cl(y >> 1, 1, GH - 2), c = cy * GW + cx;
      const gx = zs[c + 1] - zs[c - 1], gy = zs[c + GW] - zs[c - GW];
      TER[(y * W + x) * 2] = gx * 3.2; TER[(y * W + x) * 2 + 1] = gy * 3.2;
    }
  // soil sampling: per LED the four cells round it
  const SI = new Int16Array(W * PH * 4), SW = new Float32Array(W * PH * 2);
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < W; x++) {
      const fx = (x - 0.5) / 2, fy = (y - 0.5) / 2;
      const x0 = cl(floor(fx), 0, GW - 1), y0 = cl(floor(fy), 0, GH - 1);
      const x1 = min(x0 + 1, GW - 1), y1 = min(y0 + 1, GH - 1);
      const p = y * W + x;
      SI[p * 4] = y0 * GW + x0; SI[p * 4 + 1] = y0 * GW + x1; SI[p * 4 + 2] = y1 * GW + x0; SI[p * 4 + 3] = y1 * GW + x1;
      SW[p * 2] = cl(fx - x0, 0, 1); SW[p * 2 + 1] = cl(fy - y0, 0, 1);
    }
  let outlet = 0;
  for (let i = 0; i < N; i++) if (down[i] < 0) outlet = i;
  const XD = new Float32Array(N).fill(-1);
  const dist = (i) => {
    if (XD[i] >= 0) return XD[i];
    const d = down[i];
    return (XD[i] = d < 0 ? 0 : dist(d) + Math.hypot(PX[i] - PX[d], PY[i] - PY[d]));
  };
  for (let i = 0; i < N; i++) dist(i);
  // how wet the ground must be for a reach to run: the trunk always, the heads only when it is wet
  const TH = new Float32Array(N);
  const rt = prng(SEED + 1);
  for (let i = 0; i < N; i++) TH[i] = THM * pow(1 - log(AC[i] / THRESH) / log(amax / THRESH), 1.2) + 0.2 * (rt() - 0.5);
  Object.assign(S, { N, cn, down, L, AC, NCELL, PX, PY, QBF, WB, RT, TER, SI, SW, outlet, XD, TH });
}

// storms
function spawn(S, u, frac) {
  const r = Math.random();
  const th = r < 0.95 ? 0.1 * gauss() : r < 0.975 ? (Math.random() < 0.5 ? 1 : -1) * (1.5708 + 0.3 * gauss()) : 3.1416 + 0.35 * gauss();
  const life = 22 + 3 * Math.random(), R = 14 + 6 * Math.random();
  const f = 0.88 + 0.24 * Math.random();
  const mx = 32 + (12 + 42 * (1 - sm(3, 6, u * f))) * (Math.random() - 0.5), my = 54 + (14 + 90 * (1 - sm(3, 6, u * f))) * (Math.random() - 0.5);
  const dx = sin(th), dy = cos(th), pad = 0.5 * R;
  let tm = 1e9;
  if (dx > 1e-6) tm = min(tm, (mx + pad) / dx); else if (dx < -1e-6) tm = min(tm, (W + pad - mx) / -dx);
  if (dy > 1e-6) tm = min(tm, (my + pad) / dy); else if (dy < -1e-6) tm = min(tm, (PH + pad - my) / -dy);
  const back = min(0.5 * life * u * f, tm);
  const c = { x: mx - dx * back, y: my - dy * back, th, w: 0, life, age: 0, sg: R / 2.2, tp: 1 + 1.5 * Math.random(), sx: ASX * R / 2.2, sy: ASY * R / 2.2, R, pk: pow(17 / R, 2) * (0.85 + 0.3 * Math.random()), f, e: 0 };
  if (frac > 0) {
    c.age = frac * life;
    c.x += dx * u * f * c.age;
    c.y += dy * u * f * c.age;
  }
  S.st.push(c);
}

const RI = new Float32Array(NC), GA = new Float32Array(160);

// a Gaussian of rain added to a grid of nx x ny points st LEDs apart (the cells, or the LEDs)
function blob(buf, nx, ny, st, x, y, sx, sy, e) {
  const o = st > 1 ? 0.5 : 0, ex = 2.8 * sx, ey = 2.8 * sy, ix = 1 / (2 * sx * sx), iy = 1 / (2 * sy * sy);
  const x0 = max(0, floor((x - ex - o) / st)), x1 = min(nx - 1, ceil((x + ex - o) / st));
  const y0 = max(0, floor((y - ey - o) / st)), y1 = min(ny - 1, ceil((y + ey - o) / st));
  for (let i = x0; i <= x1; i++) { const dx = st * i + o - x; GA[i - x0] = exp(-dx * dx * ix); }
  for (let j = y0; j <= y1; j++) {
    const dy = st * j + o - y, g = e * exp(-dy * dy * iy);
    for (let i = x0; i <= x1; i++) buf[j * nx + i] += g * GA[i - x0];
  }
}

function storms(S, d, K2) {
  const u = K2 * U0;
  // wet and dry spells follow each other at random, a few minutes each
  S.wT -= d;
  if (S.wT <= 0) { S.wt = 1 - S.wt; S.wT = 40 + 60 * -log(1 - Math.random()); }
  S.w += (S.wt - S.w) * (1 - exp(-d / 25));
  // a new cell is due when fewer than two are still on the way up or in their prime
  let live = 0;
  for (const c of S.st) if (c.age < 0.72 * c.life) live++;
  S.spawnT -= d;
  if (S.spawnT <= 0) {
    if (live < (S.w > 0.5 ? 4 : 2) && S.st.length < 5) spawn(S, u, 0);
    S.spawnT = -log(1 - Math.random()) * pow(2.2, 1 - 2 * S.w) * (live === 0 ? 1.5 : live === 1 ? 3 : live === 2 ? 6 : 14);
  }
  if (live === 0 && S.spawnT > 1.5) S.spawnT = 1.5;
  for (let i = S.st.length - 1; i >= 0; i--) {
    const c = S.st[i];
    c.age += d;
    if (c.age >= c.life) { S.st.splice(i, 1); continue; }
    c.w += (-c.w / 6) * d + 0.18 * sqrt((2 * d) / 6) * gauss();
    const th = c.th + c.w, sp = u * c.f * (1 + 0.1 * sin(c.age * 0.7 + c.sg));
    c.x += sp * sin(th) * d;
    c.y += sp * cos(th) * d;
    const ph = c.age / c.life;
    c.e = c.pk * sm(0, 0.26, ph) * (1 - sm(0.68, 1, ph)) * (1 + 0.3 * sin(c.age / c.tp + c.f * 40));
    if (Math.random() < 0.35 * c.e * c.e * d) S.sp.push({ x: c.x + 0.45 * c.sg * gauss(), y: c.y + 0.45 * c.sg * gauss(), age: 0, life: 0.7 + 0.6 * Math.random() });
  }
  for (let i = S.sp.length - 1; i >= 0; i--) { S.sp[i].age += d; if (S.sp[i].age >= S.sp[i].life) S.sp.splice(i, 1); }
}

function physics(S, d, K3, K4) {
  RI.fill(0);
  for (const c of S.st) blob(RI, GW, GH, 2, c.x, c.y, c.sx, c.sy, c.e);
  // soil takes the rain and gives it up; the wetter it is, the more of the next rain runs off
  const tau = 70 * pow(2, 0.7 * K3), off = 0.19 * max(K3, 0), dphi = 0.12 * (pow(2, 0.6 * K3) - 1), SO = S.so, R = S.R, cn = S.cn;
  R.fill(0);
  for (let c = 0; c < NC; c++) {
    const I = RI[c];
    let s = SO[c];
    s += d * (WET * I * (1 - s) - s / tau);
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    SO[c] = s;
    if (I > 1e-3) {
      const q = cl(s + off, 0, 1) * 64, qi = q | 0;
      R[cn[c]] += (PHI[qi] + (PHI[qi + 1] - PHI[qi]) * (q - qi) + dphi) * I;
    }
  }
  // groundwater: the rain and the wet spells fill it, minutes drain it; a reach runs where it is high enough
  const GQ = S.GW, GN = S.GN, rg = RW * S.w, dg = d / (190 * pow(2, 0.7 * K3));
  GN.fill(0);
  for (let c = 0; c < NC; c++) {
    const g = GQ[c] + d * KG * (RI[c] + rg) * (1 - GQ[c]) - GQ[c] * dg;
    GQ[c] = g;
    GN[cn[c]] += g;
  }
  const N = S.N, H1 = S.Hs, lat = S.lat, NCEL = S.NCELL, a = S.a, QBF = S.QBF, RT = S.RT, down = S.down, q = S.q, inf = S.inf;
  const ah = 1 - exp(-d / TAUH);
  const fq = pow(2, -0.55 * K4); // a rougher channel overtops on less water
  const TH = S.TH;
  for (let i = 0; i < N; i++) {
    const run = sm(TH[i] - 0.1, TH[i] + 0.2, GN[i] / NCEL[i]);
    H1[i] += (R[i] - H1[i]) * ah;
    lat[i] = (H1[i] + BASE * NCEL[i] * run) / (QBF[i] * fq);
  }

  // kinematic wave, Q = Qbf a^m, conservative upwind on the nodes of the tree
  const CB = CB0 * pow(2, -0.7 * K4);
  let am = 0.3;
  for (let i = 0; i < N; i++) if (a[i] > am) am = a[i];
  const ns = max(1, ceil((d * CB * pow(am, 0.667)) / 1.7));
  const h = d / ns, sc = h * CB;
  for (let s = 0; s < ns; s++) {
    inf.fill(0);
    for (let i = 0; i < N; i++) {
      const ai = a[i], qr = ai * cbrt(ai) * cbrt(ai);
      q[i] = qr;
      if (down[i] >= 0) inf[down[i]] += qr * QBF[i];
    }
    for (let i = 0; i < N; i++) {
      const v = a[i] + sc * RT[i] * (inf[i] / QBF[i] + lat[i] - q[i]);
      a[i] = v < 0 ? 0 : v;
    }
  }
  S.V0.set(S.V1);
  for (let i = 0; i < N; i++) { const ai = a[i]; S.V1[i] = ai * cbrt(ai) * cbrt(ai); }
  S.hist[S.hn % HN] = S.V1[S.outlet];
  S.hn++;
}

function advance(S, d, k) {
  const K2 = cl(k[1], 0, 4), K3 = cl(k[2], -1, 1), K4 = cl(k[3], -1, 1);
  storms(S, d, K2);
  S.ph += (d * CB0 * pow(2, -0.7 * K4)) / RL;
  S.acc += d;
  while (S.acc >= HP) { S.acc -= HP; physics(S, HP, K3, K4); }
  const al = S.acc / HP, N = S.N;
  for (let i = 0; i < N; i++) S.V[i] = S.V0[i] + (S.V1[i] - S.V0[i]) * al;
  S.t += d;
}

export function setup(params) {
  const S = { t: 0, k: null, warm: false, st: [], sp: [], spawnT: 3, acc: 0, hn: 0, hist: new Float32Array(HN), ph: 0, w: 0, wt: 0, wT: 0 };
  build(S);
  const N = S.N;
  S.wt = Math.random() < 0.5 ? 1 : 0;
  S.w = 0.3 + 0.4 * S.wt;
  S.wT = 20 + 100 * Math.random();
  S.so = new Float32Array(NC).fill(0.2);
  S.GW = new Float32Array(NC); S.GN = new Float32Array(N);
  for (let c = 0; c < NC; c++) S.GW[c] = 0.2 + 0.4 * S.w + 0.25 * Math.random();
  S.R = new Float32Array(N); S.Hs = new Float32Array(N); S.lat = new Float32Array(N);
  S.a = new Float32Array(N).fill(0.3); S.q = new Float32Array(N); S.inf = new Float32Array(N);
  S.V = new Float32Array(N); S.V0 = new Float32Array(N); S.V1 = new Float32Array(N);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  if (!S.warm) {
    S.warm = true;
    const u = cl(S.k[1], 0, 4) * U0;
    spawn(S, u, 0.3 + 0.2 * Math.random());
    spawn(S, u, 0.55 + 0.3 * Math.random());
    for (let i = 0; i < 140; i++) advance(S, HP, S.k);
  }
  advance(S, d, S.k);
}

// drawing
const BUF = new Float32Array(W * H * 3);
const LB = new Float32Array(W * PH * 3), FL = new Float32Array(W * PH), FG = new Float32Array(W * PH);
const LUT = new Float32Array(256 * 3);
const WC = [0, 0, 0], FOGC = [0, 0, 0], FPC = [0, 0, 0], SPC = [0, 0, 0], AMB = [0, 0, 0], TMP = [0, 0, 0];
const BAND0 = PH + 1;           // first row of the hydrograph band
const YB = 126.4, YS = 5.9;     // the band's zero line and LEDs per bankfull

function addLump(cx, cy, sig, amp, c) {
  const R = floor(sig * 2.8) + 1, is2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R), y0 = max(0, floor(cy) - R), y1 = min(PH - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, a = 255 * amp * exp(-(dx * dx + dy * dy) * is2);
      const o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

const rY = (r) => {
  const q = r < 1.5 ? r : 1.5 + 0.9 * (1 - exp(-(r - 1.5) / 0.9));
  return YB - YS * q;
};

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const k = S.k, hs = k[0], off = 0.09 + 0.2 * cl(k[2], -1, 1);
  const N = S.N, V = S.V, down = S.down, PX = S.PX, PY = S.PY, WB = S.WB;

  const T = S.t, hw = hs + 0.05 * sin((2 * PI * T) / 97 + 0.7) + 0.035 * sin((2 * PI * T) / 41 + 3.1), hf = hs + 0.035 * sin((2 * PI * T) / 61 + 2.1) + 0.03 * sin((2 * PI * T) / 27 + 0.4);
  hsv(0.6 + hf, 0.48, 0.58, FOGC);
  hsv(0.575 + hw, 0.55, 0.62, FPC);
  hsv(0.7 + hs, 0.34, 1, SPC);
  hsv(0.095 + hs, 0.82, 1, AMB);
  for (let i = 0; i < 256; i++) {
    const v = i / 64, sat = 1 - exp(-v / 0.8);
    hsv(0.475 + 0.025 * sat + hw, 0.88 - 0.55 * sm(1.3, 3.2, v), 0.5 + 0.46 * sat, TMP);
    LUT[i * 3] = TMP[0]; LUT[i * 3 + 1] = TMP[1]; LUT[i * 3 + 2] = TMP[2];
  }

  LB.fill(0); FL.fill(0); FG.fill(0);
  // the light on the water: three clocks of 31, 47 and 73 s, and a swell that runs down the panel
  const brg = 0.2 * sin((2 * PI * S.t) / 31 + 1.3) + 0.12 * sin((2 * PI * S.t) / 47 + 0.2) + 0.1 * sin((2 * PI * S.t) / 73 + 2.6);
  const NW = S.NW || (S.NW = new Float32Array(N)), XD = S.XD, ph = S.ph, ru = (cl(k[3], -1, 1) + 1) / 2, ra = 0.1 + 0.4 * ru, rt = 0.15 + 1.9 * ru;
  for (let i = 0; i < N; i++) NW[i] = WB[i] + 1.15 * (1 - exp(-V[i] / 0.9));
  for (let i = 0; i < N; i++) {
    const d = down[i];
    const x0 = PX[i], y0 = PY[i];
    const x1 = d >= 0 ? PX[d] : x0, y1 = d >= 0 ? PY[d] : PH + 2;
    const v0 = V[i], v1 = d >= 0 ? V[d] : v0, w0 = NW[i], w1 = d >= 0 ? NW[d] : w0;
    const ex = x1 - x0, ey = y1 - y0, il = 1 / (ex * ex + ey * ey + 1e-6);
    const xa = XD[i], xb = d >= 0 ? XD[d] : -sqrt(ex * ex + ey * ey);
    const big = max(v0, v1) > 1;
    const pad = big ? 10 : 4.6;
    const bx0 = max(0, floor(min(x0, x1) - pad)), bx1 = min(W - 1, ceil(max(x0, x1) + pad));
    const by0 = max(0, floor(min(y0, y1) - pad)), by1 = min(PH - 1, ceil(max(y0, y1) + pad));
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const t = cl(((x - x0) * ex + (y - y0) * ey) * il, 0, 1);
        const dx = x - x0 - ex * t, dy = y - y0 - ey * t, dd = sqrt(dx * dx + dy * dy);
        const w = w0 + (w1 - w0) * t, v = v0 + (v1 - v0) * t, p = y * W + x;
        if (dd < 4.6) {
          const cov = cl(0.5 * w + 0.5 - dd, 0, 1);
          const gl = cov < 0.3 ? (0.14 + 0.14 * (1 - exp(-v / 0.9))) * exp(-(dd * dd) / (0.5 * w * w + 4)) : 0;
          const al = (cov > gl ? cov * (1 + ra * (1 - sm(1, 2.2, v)) * sin(6.2832 * ((xa + (xb - xa) * t) / RL + ph))) : gl) * (DRY + (1 - DRY) * sm(0.015, 0.12, v)) * (1 + 0.15 * sin(6.2832 * (y / 80 + S.t / 43)) + brg) * (0.8 + 0.13 * (WB[i] + (d >= 0 ? WB[d] - WB[i] : 0) * t)), o = p * 3, li = min(255, (v * 64) | 0) * 3;
          const r = LUT[li] * al, g = LUT[li + 1] * al, b = LUT[li + 2] * al;
          if (r > LB[o]) LB[o] = r;
          if (g > LB[o + 1]) LB[o + 1] = g;
          if (b > LB[o + 2]) LB[o + 2] = b;
        }
        if (v > 1) {
          const e = cl((v - 1) / 1.2, 0, 1), c = e * (1 - sm(0.5 * w, 0.5 * w + 1.2 + 5 * e, dd));
          if (c > FL[p]) FL[p] = c;
        }
      }
  }

  for (const c of S.st) blob(FG, W, PH, 1, c.x, c.y, c.sx, c.sy, c.e);
  const SO = S.so, SI = S.SI, SW = S.SW, TER = S.TER, lph = (2 * PI * T) / 211 + 0.6, lcx = -cos(lph), lcy = -sin(lph);
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3;
      const fx = SW[p * 2], fy = SW[p * 2 + 1];
      const s0 = SO[SI[p * 4]] + (SO[SI[p * 4 + 1]] - SO[SI[p * 4]]) * fx, s1 = SO[SI[p * 4 + 2]] + (SO[SI[p * 4 + 3]] - SO[SI[p * 4 + 2]]) * fx;
      const sw = 1 - exp(-4.5 * cl(s0 + (s1 - s0) * fy + off, 0, 1)), te = cl(TER[p * 2] * lcx + TER[p * 2 + 1] * lcy, -1, 1);
      let r = 3 + sw * 12 + te * 3 * rt, g = 7 + sw * 27 + te * 5.5 * rt, b = 18 + sw * 54 + te * 9 * rt;
      const fg = FG[p];
      if (fg > 0.004) {
        const f = fg > 1.15 ? 1.15 : fg;
        r += FOGC[0] * 255 * f; g += FOGC[1] * 255 * f; b += FOGC[2] * 255 * f;
      }
      const fl = FL[p];
      if (fl > 0) { const f = fl * 0.42; r += FPC[0] * 255 * f; g += FPC[1] * 255 * f; b += FPC[2] * 255 * f; }
      if (r > 110) r = 110 + 145 * (1 - exp((110 - r) / 145));
      if (g > 110) g = 110 + 145 * (1 - exp((110 - g) / 145));
      if (b > 110) b = 110 + 145 * (1 - exp((110 - b) / 145));
      BUF[o] = 255 - (255 - r) * (1 - LB[o]); BUF[o + 1] = 255 - (255 - g) * (1 - LB[o + 1]); BUF[o + 2] = 255 - (255 - b) * (1 - LB[o + 2]);
    }
  for (const sp of S.sp) {
    const u = sp.age / sp.life, e = sm(0, 0.12, u) * exp(-3 * u);
    addLump(sp.x, sp.y, 1.7 + 2.8 * pow(u, 0.6), 0.55 * e, SPC);
  }

  // the band: the outlet's last 40 s
  for (let y = PH; y < H; y++)
    for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; BUF[o] = 8; BUF[o + 1] = 17; BUF[o + 2] = 38; }
  for (let x = 0; x < W; x++) { const o = (PH * W + x) * 3; BUF[o] = 10; BUF[o + 1] = 20; BUF[o + 2] = 40; }
  const yb = rY(1), rb = floor(yb + 0.5);
  for (let x = 0; x < W; x++) {
    const o = (rb * W + x) * 3;
    BUF[o] += 26; BUF[o + 1] += 44; BUF[o + 2] += 70;
  }
  const rs = new Float32Array(W), Td = (S.hn - 1) * HP + S.acc;
  const hv = (j) => S.hist[max(0, S.hn - HN, min(j, S.hn - 1)) % HN];
  for (let x = 0; x < W; x++) {
    const kk = (Td - (63.5 - x) * 0.625) / HP - 1, i0 = floor(kk);
    rs[x] = hv(i0) + (hv(i0 + 1) - hv(i0)) * (kk - i0);
  }
  const ys = new Float32Array(W);
  for (let x = 0; x < W; x++) ys[x] = rY(rs[x]);
  for (let x = 0; x < W; x++) {
    const yc = ys[x], ya = x > 0 ? 0.5 * (yc + ys[x - 1]) : yc, yz = x < W - 1 ? 0.5 * (yc + ys[x + 1]) : yc;
    const lo = min(yc, ya, yz), hi = max(yc, ya, yz);
    const am = sm(0.93, 1.12, rs[x]);
    for (let y = BAND0; y < H; y++) {
      const dist = y < lo ? lo - y : y > hi ? y - hi : 0;
      const cov = cl(1.3 - dist, 0, 1);
      const fill = y > hi ? 0.34 * exp(-(y - hi) / 7) + 0.14 : 0;
      const a = max(cov, fill), o = (y * W + x) * 3;
      const lf = min(255, (min(rs[x], 1) * 64) | 0) * 3, ml = cov > fill ? am : 0;
      const cr = LUT[lf] + (AMB[0] - LUT[lf]) * ml, cg = LUT[lf + 1] + (AMB[1] - LUT[lf + 1]) * ml, cb = LUT[lf + 2] + (AMB[2] - LUT[lf + 2]) * ml;
      BUF[o] += 255 * cr * a; BUF[o + 1] += 255 * cg * a; BUF[o + 2] += 255 * cb * a;
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
