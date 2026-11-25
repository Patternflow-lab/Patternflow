// ===== Patternflow pattern =====
// Title:   Reionization
// Family:  reionization
// Idea:    A light-cone slice of the 21 cm sky through the epoch of reionization, with cosmic time running up the panel: a blue-violet sheet of cold gas in absorption at the foot, above it the warmed gas glowing amber along the filaments of the cosmic web, and higher up the first galaxies burning round dark holes with pale rims that are larger the later you look, run together and leave only islands of glow near the top, while the slice moves steadily through the depth of the volume so that holes open, swell, merge and close and no arrangement comes back.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the 21 cm line of neutral hydrogen (van de Hulst 1944, from memory) as a map of the gas before and during reionization, its brightness the neutral fraction times one plus the density contrast, seen in absorption while the gas is colder than the background and in emission once the first light has heated it (Madau, Meiksin and Rees 1997; Furlanetto, Oh and Briggs 2006, from memory); ionized bubbles round the first galaxies that grow and overlap (Furlanetto, Zaldarriaga and Hernquist 2004, from memory); the light-cone slice, one axis of the picture being look-back time, as drawn from semi-numerical simulations such as 21cmFAST (Mesinger and Furlanetto 2007; Mesinger, Furlanetto and Cen 2011, from memory). What is original: bubbles as a smooth union of spheres round hashed sources whose radius is read at the pixel's own row, so each comes out egg-shaped, the slice travelling through the third axis as the only clock, the warp of the timetable by a slow density field, and the colours, pattern round 246
// Round:   246
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..4, Sources=-1..1, Timing=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the cold gas at the foot is blue to violet, the warm sheet runs from plum through rose to amber and gold on the filaments, the ionized holes are blue-black and their fronts pale cyan; at 0.5 the foot is amber and the sheet turns teal to blue.
// Knob 2: Speed. 0 to 4, opening at 2: how fast the slice travels through the depth of the volume. At 0 a hole takes about twenty seconds to open and close, at 2 about seven, at 4 about two.
// Knob 3: Sources. -1 to 1, opening at 0: who does the ionizing. At -1 a few rare bright galaxies, so a handful of very large bubbles; at 1 many faint ones, a froth of small bubbles that percolate. The ionized share of a row stays about the same, the knob changes the grain.
// Knob 4: Timing. -1 to 1, opening at 0.06: when reionization happens. At -1 it is early, the dark has come down to the lower third and only islands glow above it; at 1 it is late and the glowing sheet reaches nearly to the top with small holes in it.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sin, cos, sqrt, exp, pow, tanh, PI } = Math;
const TAU = 2 * PI, LN2 = 0.6931, SQ2 = 1.41421;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

const C0 = 20;                   // LED between sources at Sources 0
const TM = 2.8;                  // the optical depth the bubbles saturate at, so about a tenth of the gas stays neutral
const KF = 0.2;                  // bubble volume per unit of optical depth, in cells (set by measuring the ionized share)
const TH = 0.25;                 // the level of the summed kernels that is the ionization front
const WARP = 26;                 // LED the slow density field moves the timetable up or down
const VOID = 0.45;                // and how much it swells or shrinks the bubbles: the voids stay neutral longest
const ISLE = 0.9;                 // the same for the filament-scale field, once the bubbles have run together
const GT0 = -40, GTN = 480;      // table of bubble scale against height: from -40 LED in half LED steps
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ---- hashing and noise --------------------------------------------------------
function hashi(i, j, k, s) {
  let h = Math.imul(i + s, 374761393);
  h = Math.imul((h ^ (h >>> 15)) + j, 668265263);
  h = Math.imul((h ^ (h >>> 13)) + k, 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519 | 0);
  return (h ^ (h >>> 15)) >>> 0;
}
const hashf = (i, j, k, s) => hashi(i, j, k, s) / 4294967296;

// Gradient noise in three dimensions read on one plane of the third: the two layers of gradients are joined at each
// lattice node first, which leaves three numbers a node and four nodes a pixel.
// The gradients are 32 directions spread over the sphere, none along an axis: with the usual twelve a ridge of the noise
// can run straight along a lattice row.
const GRX = new Float32Array(32), GRY = new Float32Array(32), GRZ = new Float32Array(32);
for (let i = 0; i < 32; i++) {
  const z = 1 - (2 * i + 1) / 32, r = 1.4 * sqrt(1 - z * z), a = i * 2.39996 + 0.4;
  GRX[i] = r * cos(a);
  GRY[i] = r * sin(a);
  GRZ[i] = 1.4 * z;
}
const NA = new Float32Array(600), NX = new Float32Array(600), NY = new Float32Array(600);
const CI = new Int32Array(W), CF = new Float32Array(W), CS = new Float32Array(W);
function fillNoise(out, scale, ox, oy, ow, seed) {
  const inv = 1 / scale;
  const ix0 = floor((0.5 + ox) * inv), iy0 = floor((0.5 + oy) * inv);
  const nx = floor((W - 0.5 + ox) * inv) - ix0 + 2, ny = floor((H - 0.5 + oy) * inv) - iy0 + 2;
  const iw = floor(ow), fw = ow - iw, sw = fw * fw * fw * (fw * (fw * 6 - 15) + 10);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const g0 = hashi(ix0 + i, iy0 + j, iw, seed) & 31, g1 = hashi(ix0 + i, iy0 + j, iw + 1, seed) & 31, n = j * nx + i;
      NA[n] = (1 - sw) * GRZ[g0] * fw + sw * GRZ[g1] * (fw - 1);
      NX[n] = (1 - sw) * GRX[g0] + sw * GRX[g1];
      NY[n] = (1 - sw) * GRY[g0] + sw * GRY[g1];
    }
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 + ox) * inv - ix0, i = floor(u), f = u - i;
    CI[x] = i;
    CF[x] = f;
    CS[x] = f * f * f * (f * (f * 6 - 15) + 10);
  }
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5 + oy) * inv - iy0, j = floor(v), fy = v - j, sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10), row = y * W;
    for (let x = 0; x < W; x++) {
      const fx = CF[x], sx = CS[x], n0 = j * nx + CI[x], n1 = n0 + nx;
      const a = NA[n0] + NX[n0] * fx + NY[n0] * fy;
      const b = NA[n0 + 1] + NX[n0 + 1] * (fx - 1) + NY[n0 + 1] * fy;
      const c = NA[n1] + NX[n1] * fx + NY[n1] * (fy - 1);
      const d = NA[n1 + 1] + NX[n1 + 1] * (fx - 1) + NY[n1 + 1] * (fy - 1);
      const top = a + (b - a) * sx;
      out[row + x] = top + (c + (d - c) * sx - top) * sy;
    }
  }
}

// ---- colour -------------------------------------------------------------------
function oklab(L, C, hdeg, out) {
  const h = (hdeg * PI) / 180, a = C * cos(h), b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const enc = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
const inGamut = (c) => c[0] >= -0.001 && c[1] >= -0.001 && c[2] >= -0.001 && c[0] <= 1.001 && c[1] <= 1.001 && c[2] <= 1.001;
function rgbOf(L, C, h, out, o) {
  const c = [0, 0, 0];
  oklab(L, C, h, c);
  if (!inGamut(c)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      oklab(L, mid, h, c);
      if (inGamut(c)) lo = mid;
      else hi = mid;
    }
    oklab(L, lo, h, c);
  }
  out[o] = 255 * enc(cl(c[0], 0, 1));
  out[o + 1] = 255 * enc(cl(c[1], 0, 1));
  out[o + 2] = 255 * enc(cl(c[2], 0, 1));
}
// The signed brightness of the neutral gas against lightness, chroma and hue. Below zero the gas absorbs (violet down to
// blue), at zero it is a dim plum, above it glows: rose where thin, amber then gold where dense. A dim orange reads brown
// on the panel, so the ramp is past rose before it is bright enough to turn to amber.
const TB0 = -1.3, TB1 = 1.5, NL = 256;
const KEYS = [
  [-1.3, 0.7, 0.13, 240],
  [-0.9, 0.55, 0.17, 262],
  [-0.5, 0.43, 0.17, 282],
  [-0.15, 0.32, 0.13, 305],
  [0.0, 0.3, 0.1, 318],
  [0.3, 0.4, 0.11, 328],
  [0.5, 0.54, 0.095, 350],
  [0.68, 0.68, 0.085, 405],
  [0.85, 0.79, 0.12, 438],
  [1.1, 0.87, 0.125, 448],
  [1.5, 0.95, 0.08, 458],
];
function buildLuts(st, hr) {
  const lut = st.lut;
  for (let i = 0; i < NL; i++) {
    const u = TB0 + ((TB1 - TB0) * i) / (NL - 1);
    let k = 0;
    while (k < KEYS.length - 2 && u > KEYS[k + 1][0]) k++;
    const a = KEYS[k], b = KEYS[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    rgbOf(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f + hr, lut, i * 3);
  }
  rgbOf(0.1, 0.035, 262 + hr, st.cIon, 0);     // the ionized gas: blue-black, under level 20
  rgbOf(0.94, 0.06, 205 + hr, st.cRim, 0);     // the front: pale cyan
  rgbOf(0.98, 0.04, 100 + hr, st.cDot, 0);     // a galaxy: warm white
}

// ---- state --------------------------------------------------------------------
export function setup(params) {
  const ph = [];
  for (let i = 0; i < 12; i++) ph.push(rnd() * TAU);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, hue: -9,
    ks: 0, kt: 0.06,
    wl: 200 + 600 * rnd(), wd: 3000 * rnd(), xc: 50 + 100 * rnd(), xd: 1000 * rnd(), yc: 50 + 100 * rnd(),
    ph, seed: floor(rnd() * 1e6),
    F: new Float32Array(N), FR: new Float32Array(N), GX: new Float32Array(N), GY: new Float32Array(N), D: new Float32Array(N),
    G: new Float32Array(N), IG2: new Float32Array(N), QL: new Float32Array(N), GROW: new Float32Array(H),
    LM: new Float32Array(N), N1: new Float32Array(N), N2: new Float32Array(N), WB: new Float32Array(N),
    GT: new Float32Array(GTN + 2),
    lut: new Float32Array(NL * 3), cIon: [0, 0, 0], cRim: [0, 0, 0], cDot: [0, 0, 0],
  });
  return st;
}

const cellOf = (ks) => C0 * pow(ks < 0 ? 1.45 : 1.7, -ks);

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  const ks = cl(st.k[2], -1, 1), kt = cl(st.k[3], -1, 1);
  if (!st.init) {
    st.init = true;
    st.ks = ks;
    st.kt = kt;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  const a = 1 - exp(-dt / 0.3);
  st.ks += (ks - st.ks) * a;
  st.kt += (kt - st.kt) * a;
  // the slice moves through the depth of the volume, counted in cells of the source lattice, so a bubble lasts as long
  // at any setting of Sources
  const C = cellOf(st.ks), rate = 0.05 * pow(10, cl(st.k[1], 0, 4) / 4), t = st.t, ph = st.ph;
  st.wl += rate * dt;
  st.wd += rate * C * dt;
  // and pans sideways, half an LED a second, faster and slower on two periods of its own
  const vx = 0.55 + 0.35 * sin((TAU * t) / 61 + ph[3]) + 0.25 * sin((TAU * t) / 37.3 + ph[4]);
  st.xc += (vx * dt) / C;
  st.xd += vx * dt;
}

// ---- one frame ----------------------------------------------------------------
function frame(st) {
  const { F, FR, GX, GY, D, G, IG2, QL, GROW, LM, N1, N2, WB, GT, ph } = st;
  const t = st.t, ks = st.ks, kt = st.kt, C = cellOf(ks), sd = st.seed;
  F.fill(0); FR.fill(0); GX.fill(0); GY.fill(0); D.fill(0);

  // the timetable: the height (LED above the foot) of the first bubbles and of the half-ionized row
  const wm = 9 * sin((TAU * t) / 43 + ph[0]) + 6 * sin((TAU * t) / 71.3 + ph[1]);
  const h0 = 26 + 12 * kt + (kt > 0 ? 10 * kt * kt : 0) + 0.5 * wm + 4 * sin((TAU * t) / 57.7 + ph[2]);
  const hm = 62 + 28 * kt + (kt > 0 ? 60 * kt * kt : 0) + wm;
  const span = max(12, hm - h0);
  for (let j = 0; j <= GTN + 1; j++) {
    const s = (GT0 + 0.5 * j - h0) / span;
    GT[j] = s > 0 ? C * pow(TM * (1 - exp((-LN2 * pow(s, 1.6)) / TM)) * KF, 1 / 3) : 0;
  }
  const gsat = C * pow(TM * KF, 1 / 3), gmax = gsat * (1 + VOID * 0.7 + ISLE * 0.5);

  // the density: a slow field that warps the timetable, and two octaves ridged into filaments
  fillNoise(LM, 46, st.xd, 0.11 * t, st.wd / 46 + t / 90, sd + 11);
  fillNoise(N1, 23, st.xd, 0, st.wd / 23, sd + 23);
  fillNoise(N2, 11.5, st.xd + 4.1, 6.3, st.wd / 11.5 + 0.37, sd + 37);
  for (let y = 0; y < H; y++) {
    const h = 127 - y, row = y * W;
    let gm = 0;
    for (let x = 0; x < W; x++) {
      const i = row + x, lam = LM[i];
      // a filament is where the two octaves together cross zero
      const r1 = 1 - min(1, abs(N1[i] + 0.45 * N2[i]) * 2.6);
      WB[i] = cl(0.9 * r1 * r1 + 0.55 * lam + 0.1, -0.3, 1.3);
      const p = cl((h + WARP * lam - GT0) * 2, 0, GTN), j = p | 0, gt = GT[j] + (GT[j + 1] - GT[j]) * (p - j), sat = gt / gsat;
      const g = gt * max(0.2, 1 + VOID * cl(lam, -0.7, 0.7) + ISLE * sat * sat * cl(N1[i], -0.5, 0.5));
      G[i] = g;
      IG2[i] = g > 0.05 ? 1 / (g * g) : 1e9;
      if (g > gm) gm = g;
    }
    GROW[y] = gm;
  }
  for (let y = 0; y < H; y++) {
    const ya = y > 0 ? y - 1 : 0, yb = y < H - 1 ? y + 1 : H - 1, row = y * W;
    for (let x = 0; x < W; x++) {
      const g = G[row + x];
      QL[row + x] = g > 0.05 ? cl((G[yb * W + x] - G[ya * W + x]) / ((yb - ya) * g), -0.4, 0.4) : 0;
    }
  }

  // the sources: one a cell, jittered, with a steep spread of luminosity. Sources turns the spread as well as the spacing:
  // towards -1 nearly all the light is in a few, towards 1 they are alike.
  const up = max(0, ks), dn = max(0, -ks);
  const ra = 0.5 + 0.35 * up - 0.1 * dn, rb = 1.2 - 0.9 * up, re = 4 - 2 * up + dn;
  const rn = pow(ra * ra * ra + (3 * ra * ra * rb) / (re + 1) + (3 * ra * rb * rb) / (2 * re + 1) + (rb * rb * rb) / (3 * re + 1), -1 / 3);
  const rmax = (ra + rb) * rn, reach = (SQ2 * rmax * gmax) / C, iC = 1 / C;
  const xl = (0.5 - 32) * iC + st.xc, xr = (W - 0.5 - 32) * iC + st.xc, yt = (0.5 - 64) * iC + st.yc, yb = (H - 0.5 - 64) * iC + st.yc;
  const i0 = floor(xl - reach), i1 = floor(xr + reach), j0 = floor(yt - reach), j1 = floor(yb + reach);
  const k0 = floor(st.wl - reach), k1 = floor(st.wl + reach);
  const dotW = 0.16 * C;
  for (let kz = k0; kz <= k1; kz++)
    for (let jc = j0; jc <= j1; jc++)
      for (let ic = i0; ic <= i1; ic++) {
        const r = (ra + rb * pow(hashf(ic, jc, kz, sd + 4), re)) * rn;
        const dw = (kz + hashf(ic, jc, kz, sd + 3) - st.wl) * C, rs = SQ2 * r * gmax;
        if (abs(dw) >= rs) continue;
        const cx = (ic + hashf(ic, jc, kz, sd + 1) - st.xc) * C + 32, cy = (jc + hashf(ic, jc, kz, sd + 2) - st.yc) * C + 64;
        const dw2 = dw * dw, dym = sqrt(rs * rs - dw2), ir2 = 1 / (r * r);
        const ya = max(0, ceil(cy - dym - 0.5)), yz = min(H - 1, floor(cy + dym - 0.5));
        for (let y = ya; y <= yz; y++) {
          const rr = SQ2 * r * GROW[y], dy = y + 0.5 - cy, e2 = rr * rr - dw2 - dy * dy;
          if (e2 <= 0) continue;
          const ex = sqrt(e2), xa = max(0, ceil(cx - ex - 0.5)), xz = min(W - 1, floor(cx + ex - 0.5)), row = y * W;
          for (let x = xa; x <= xz; x++) {
            const i = row + x, dx = x + 0.5 - cx, d2 = dx * dx + dy * dy + dw2, s = IG2[i] * ir2, q = d2 * s;
            if (q >= 2) continue;
            const u = 1 - 0.5 * q, g = 2 * u * s;
            F[i] += u * u;
            FR[i] += u * u * r;
            GX[i] -= g * dx;
            GY[i] -= g * (dy - d2 * QL[i]);
          }
        }
        // the galaxy itself, while the slice is close to it
        if (r > 1.05 && abs(dw) < dotW && cx > 0 && cx < W && cy > 0 && cy < H) {
          const z = dw / dotW, amp = (1 - z * z) * (1 - z * z) * sstep(1.05, 1.45, r) * sstep(6, 10, r * G[floor(cy) * W + floor(cx)]);
          if (amp > 0.01)
            for (let y = max(0, floor(cy - 3)); y <= min(H - 1, floor(cy + 3)); y++)
              for (let x = max(0, floor(cx - 3)); x <= min(W - 1, floor(cx + 3)); x++) {
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
                D[y * W + x] += amp * exp(-(dx * dx + dy * dy) / 2.4);
              }
        }
      }
}

export function draw(display, params) {
  if (!params.st) setup(params);
  const st = params.st;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = cl(st.k[0], 0, 1);
  if (abs(hue - st.hue) > 1e-4) {
    st.hue = hue;
    buildLuts(st, 360 * hue);
  }
  frame(st);
  const { F, FR, GX, GY, D, G, LM, N1, WB, lut, cIon, cRim, cDot, ph } = st;
  const t = st.t, kt = st.kt;
  // the glow and the absorption breathe on their own clocks, and the row where one turns into the other wanders
  const gE = 1 + 0.1 * sin((TAU * t) / 23.7 + ph[5]) + 0.06 * sin((TAU * t) / 38.9 + ph[6]);
  const gA = 1 + 0.12 * sin((TAU * t) / 27.3 + ph[7]);
  const hA = 20 + 5 * kt + 3 * sin((TAU * t) / 31.1 + ph[8]);
  const ls = (NL - 1) / (TB1 - TB0);
  for (let y = 0; y < H; y++) {
    const h = 127 - y, row = y * W, up = 0.9 + 0.5 * (h / 127);
    for (let x = 0; x < W; x++) {
      const i = row + x, wb = WB[i];
      // the neutral gas: warm where the first light has reached it, sooner where it is dense
      const sA = tanh((h + 24 * LM[i] + 10 * N1[i] - hA) / 7);
      const tb = sA > 0 ? sA * gE * up * (0.5 + wb) : sA * gA * (0.6 + 0.8 * max(0, wb));
      const li = floor((cl(tb, TB0, TB1) - TB0) * ls + 0.5) * 3;
      let r = lut[li], g = lut[li + 1], b = lut[li + 2];
      const f = F[i];
      if (f > 0) {
        // distance to the front in LED, from the field and its slope
        const s = (f - TH) / sqrt(GX[i] * GX[i] + GY[i] * GY[i] + 0.0004);
        const xi = s <= -1 ? 0 : s >= 1 ? 1 : 0.5 + s * (0.75 - 0.25 * s * s);
        r += (cIon[0] - r) * xi;
        g += (cIon[1] - g) * xi;
        b += (cIon[2] - b) * xi;
        // the front is a pale line, fainter round a bubble only a few LED across
        const rim = s > -3 && s < 3 ? 0.9 * exp(-0.75 * s * s) * (0.3 + 0.7 * sstep(2.5, 7, (FR[i] / f) * G[i])) : 0;
        if (rim > 0.004) {
          r += (cRim[0] - r) * rim;
          g += (cRim[1] - g) * rim;
          b += (cRim[2] - b) * rim;
        }
        const dv = D[i] * xi;
        if (dv > 0.004) {
          const a = dv > 1 ? 1 : dv;
          r += (cDot[0] - r) * a;
          g += (cDot[1] - g) * a;
          b += (cDot[2] - b) * a;
        }
      }
      const d = BAYER[((y & 3) << 2) | (x & 3)];
      display.setPixel(x, y, cl(floor(r + d), 0, 255), cl(floor(g + d), 0, 255), cl(floor(b + d), 0, 255));
    }
  }
}
