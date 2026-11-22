// ===== Patternflow pattern =====
// Title:   B-Mode Sector
// Family:  bmode
// Idea:    The scan-converted sector of an ultrasound probe on soft abstract tissue, in a blue-white tone map, where random scatterers seen through a pulse short along the beam and wide across it make marbled speckle that shears and re-forms as the probe rocks and the tissue breathes, around a dark round cyst with a bright column behind it, a curved membrane with a shadow wedge, and a vessel carrying a red-orange colour-flow pulse.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: B-mode ultrasound imaging (Douglass Howry's first cross-sections of soft tissue, early 1950s; obstetric scanning by Ian Donald, 1958), speckle as a sum of random phasors (J. W. Goodman, 1975) and its statistics in B-scans (R. F. Wagner and colleagues, 1983), time-gain compensation and log compression as the display chain, pattern round 224
// Round:   224
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Gain=0..4, Frequency=-1..1, Sweep=-1..1
//
// Knob 1: Hue. Turns the tone map round the wheel. At 0 it runs from indigo in the fades through steel blue to ice white at the peaks, and the colour flow sits 0.42 to 0.52 of a turn away, red to orange. At 0.5 the map is tan and the flow cyan.
// Knob 2: Gain. Where the tone map sits on a 34 dB window, 4.5 dB a step. At 2, where it opens, the mean tissue is a little under mid-scale. At 0 it is 9 dB lower and only the bright layers, the membrane and the column behind the cyst show. At 4 it is 9 dB higher and the bright layers wash to white.
// Knob 3: Frequency. The probe frequency as a factor of 2^(0.75 K): 0.6 at -1, 1 at 0 where it opens, 1.7 at +1. The speckle cell along the beam is 4.3 LEDs at 0.6, 2.9 at 1 and 2.2 at 1.7; across the beam it is 2.6 LEDs wide at the top at 1 and 7.8 at the bottom. The echo loses 0.16 dB an LED times the factor and the time gain gives back 0.145, so at 1.7 the bottom of the panel is 16 dB down and dark, and at 0.6 it is 6 dB up.
// Knob 4: Sweep. How far and how fast the probe rocks and slides, 2^(1.6 K) times a rock of 0.14 radians (8 degrees) and a slide of 8 LEDs, with the clock running 2^(0.8 K) as fast. At -1 it is a third of that, at 0.06 where it opens a little over once, and at +1 it is 24 degrees and 24 LEDs, which carries the tissue 50 LEDs sideways at the bottom and shears the speckle as it goes.

const W = 64, H = 128;
const { floor, sqrt, exp, log, sin, cos, atan2, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// The probe. Its scan lines fan out from an apex 40 LEDs above the top edge; the
// image starts at a face 44 LEDs from the apex (so the top edge is a shallow arc
// 4 LEDs deep in the middle) and the lines span 0.4 radians either side.
const AX = 32, AY = -40, R0 = 44, PHI = 0.4;
// Beam space: NLV visible lines plus PAD either side for the lateral blur, and NR
// range samples, one a LED, from RS.
const NLV = 80, PAD = 10, NL = NLV + 2 * PAD;
const DTH = (2 * PHI) / (NLV - 1);
const RS = 42, NR = 136;
const KR = 5, KL = 10;
// The medium is a tile of unit complex Gaussian scatterer amplitude, 256 by 256
// LEDs, smoothed by 0.7 LED so that a slow slide moves the grain instead of
// flickering it. Two tiles are blended to let the pattern drift out of the plane.
const TN = 256, TM = TN * TN;
const SIG_S = 0.7;
// Strength of the scattering, a tile of 128 by 128 nodes two LEDs apart.
const SN = 128;
// Display: a 34 dB window, attenuation in dB per LED, the time gain that gives it back.
const DR = 34, ATT = 0.16, TGC = 0.145;
// Features, in tissue coordinates with the apex at the origin and depth down.
const ROCK_P = [61.3, 37.7, 23.1, 13.9, 8.3], ROCK_W = [0.34, 0.28, 0.2, 0.12, 0.06];
const SLIDE_P = [53.9, 31.7, 19.3, 11.3], SLIDE_W = [0.35, 0.3, 0.2, 0.15];
const PRESS_P = [23.9, 14.3], PRESS_W = [0.6, 0.4];
const RC = 9;                 // cyst radius
const MX = 14, MY = 104, RM = 34; // membrane: an arc of a circle, lowest point at depth 138
const VY = 112, RV = 3.4;     // vessel: centre line at depth 112 swaying by 9 LEDs

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsv(h, s, v, out, o) {
  h = h - floor(h);
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// Gaussian noise tile, blurred round the edges, scaled to unit spread.
function noiseTile(rand) {
  const a = new Float32Array(TM);
  for (let i = 0; i < TM; i += 2) {
    const r = sqrt(-2 * log(rand() + 1e-9)), p = TAU * rand();
    a[i] = r * cos(p);
    a[i + 1] = r * sin(p);
  }
  const wts = [];
  let ws = 0;
  for (let d = -3; d <= 3; d++) {
    const w = exp(-(d * d) / (2 * SIG_S * SIG_S));
    wts.push(w);
    ws += w;
  }
  const tmp = new Float32Array(TM);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? a : tmp, dst = pass === 0 ? tmp : a;
    for (let y = 0; y < TN; y++)
      for (let x = 0; x < TN; x++) {
        let s = 0;
        for (let d = -3; d <= 3; d++) {
          const j = pass === 0 ? y * TN + ((x + d) & 255) : (((y + d) & 255) * TN) + x;
          s += wts[d + 3] * src[j];
        }
        dst[y * TN + x] = s / ws;
      }
  }
  let sq = 0;
  for (let i = 0; i < TM; i++) sq += a[i] * a[i];
  const norm = 1 / sqrt(sq / TM);
  for (let i = 0; i < TM; i++) a[i] *= norm;
  return a;
}

function lattice(rand, n) {
  const l = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) l[i] = rand() * 2 - 1;
  return l;
}
function vnoise(l, n, x, y) {
  const u = (x / 256) * n, v = (y / 256) * n;
  const i = floor(u), j = floor(v);
  const a = smooth(u - i), b = smooth(v - j);
  const i0 = i % n, i1 = (i + 1) % n, j0 = j % n, j1 = (j + 1) % n;
  return (
    (l[j0 * n + i0] * (1 - a) + l[j0 * n + i1] * a) * (1 - b) +
    (l[j1 * n + i0] * (1 - a) + l[j1 * n + i1] * a) * b
  );
}
const step = (y, a, w) => smooth((y - a) / w + 0.5);
const box = (y, a, b, w) => step(y, a, w) - step(y, b, w);

export function setup(params) {
  const rand = rng(224224);
  params.t = 0;
  params.tau = 3.1;
  params.t1r = noiseTile(rand);
  params.t1i = noiseTile(rand);
  params.t2r = noiseTile(rand);
  params.t2i = noiseTile(rand);
  params.tbr = new Float32Array(TM);
  params.tbi = new Float32Array(TM);

  // Scattering strength: layers that undulate with blobs of brighter and darker
  // tissue over them, in dB, kept as an amplitude.
  const l4 = lattice(rand, 4), l8 = lattice(rand, 8), l16 = lattice(rand, 16);
  const st = new Float32Array(SN * SN);
  for (let j = 0; j < SN; j++)
    for (let i = 0; i < SN; i++) {
      const x = i * 2 - 128, y = j * 2 - 20;
      const yy = y + 5 * sin(x / 31 + 1.1) + 3 * sin(x / 13 - y / 40);
      let db =
        5 * box(yy, 46, 62, 8) + 4.5 * box(yy, 117, 122, 3) - 3 * box(yy, 66, 100, 10) + 2.5 * box(yy, 138, 170, 12);
      db += 8 * vnoise(l4, 4, x + 128, y + 20) + 3.5 * vnoise(l8, 8, x + 128, y + 20) + 1.5 * vnoise(l16, 16, x + 128, y + 20);
      st[j * SN + i] = pow(10, db / 20);
    }
  params.st = st;

  // Breathing: displacement of the scatterers by tissue depth, rebuilt each frame.
  params.ux = new Float32Array(256);
  params.uy = new Float32Array(256);

  // Beam space.
  params.re = new Float32Array(NL * NR);
  params.im = new Float32Array(NL * NR);
  params.tr = new Float32Array(NL * NR);
  params.ti = new Float32Array(NL * NR);
  params.flow = new Float32Array(NLV * NR);
  params.env = new Float32Array(NLV * NR);
  params.sa = new Float32Array(NL);
  params.ca = new Float32Array(NL);
  params.G = new Float32Array(NR);
  params.gk = new Float32Array(2 * KR + 1);
  params.gl = new Float32Array(2 * KL + 1);
  params.fc = -1;
  params.sumR = new Float32Array(NR);
  params.sumI = new Float32Array(NR);

  // Where each LED looks into beam space. fl is a visible line, fk a range sample.
  const N = W * H;
  params.pIdx = new Int32Array(N);
  params.pFl = new Float32Array(N);
  params.pFk = new Float32Array(N);
  params.pAl = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = x + 0.5 - AX, dy = y + 0.5 - AY;
      const r = sqrt(dx * dx + dy * dy), th = atan2(dx, dy);
      const dlat = (PHI - Math.abs(th)) * r;
      const al = cl(dlat + 0.5, 0, 1) * cl(r - R0 + 0.5, 0, 1);
      params.pAl[i] = al;
      if (al <= 0) continue;
      const fl = cl(th / DTH + (NLV - 1) / 2, 0, NLV - 1.001);
      const fk = cl(r - RS, 0, NR - 1.001);
      const l0 = floor(fl), k0 = floor(fk);
      params.pIdx[i] = l0 * NR + k0;
      params.pFl[i] = fl - l0;
      params.pFk[i] = fk - k0;
    }
  params.tone = new Float32Array(256 * 3);
  params.fl = new Float32Array(64 * 3);
  params.hc = -9;
}

// The kernels, the time gain and the normalisation that keeps the mean echo the
// same at every depth and frequency; they change only when the knob does.
function kernels(P, f) {
  P.fc = f;
  const sg = 1.0 / f, sl = 0.019 / f / DTH;
  let a = 0, b = 0;
  for (let j = -KR; j <= KR; j++) a += (P.gk[j + KR] = exp(-(j * j) / (2 * sg * sg))) ** 2;
  for (let j = -KL; j <= KL; j++) b += (P.gl[j + KL] = exp(-(j * j) / (2 * sl * sl))) ** 2;
  for (let j = 0; j <= 2 * KR; j++) P.gk[j] /= sqrt(a);
  for (let j = 0; j <= 2 * KL; j++) P.gl[j] /= sqrt(b);
  // The noise is correlated, exp(-d^2 / 4 s^2), so a kernel of unit energy still
  // gains by the sum of its cross terms; across the beam the lines sit closer
  // together near the top, so that depends on depth.
  const c = (d) => exp(-(d * d) / (4 * SIG_S * SIG_S));
  let vr = 0;
  for (let i = -KR; i <= KR; i++) for (let j = -KR; j <= KR; j++) vr += P.gk[i + KR] * P.gk[j + KR] * c(i - j);
  const anchors = [];
  for (let k = 0; k <= NR + 7; k += 8) {
    const sp = (RS + k) * DTH;
    let v = 0;
    for (let i = -KL; i <= KL; i++) for (let j = -KL; j <= KL; j++) v += P.gl[i + KL] * P.gl[j + KL] * c((i - j) * sp);
    anchors.push(v);
  }
  for (let k = 0; k < NR; k++) {
    const u = k / 8, i = floor(u), t = u - i;
    const vl = anchors[i] * (1 - t) + anchors[i + 1] * t;
    const r = RS + k;
    const dB = -(ATT * f - TGC) * Math.max(0, r - R0);
    P.G[k] = exp(dB * 0.11513) / sqrt(vr * vl);
  }
}

function tileAt(a, x, y) {
  const fx = floor(x), fy = floor(y), ax = x - fx, ay = y - fy;
  const ix = fx & 255, iy = fy & 255, ix1 = (ix + 1) & 255, iy1 = (iy + 1) & 255;
  return (
    (a[(iy << 8) | ix] * (1 - ax) + a[(iy << 8) | ix1] * ax) * (1 - ay) +
    (a[(iy1 << 8) | ix] * (1 - ax) + a[(iy1 << 8) | ix1] * ax) * ay
  );
}

function render(P, k) {
  const t = P.t, tau = P.tau;
  const s = pow(2, 1.6 * cl(k[3], -1, 1));
  const f = pow(2, 0.75 * cl(k[2], -1, 1));
  if (Math.abs(f - P.fc) > 1e-4) kernels(P, f);

  // The probe: a rock about the apex and a slide, each a few incommensurate sines,
  // so the pose wanders over the whole of its range and never comes back to one.
  const wob = (ps, ws, ph) => {
    let v = 0;
    for (let i = 0; i < ps.length; i++) v += ws[i] * sin((TAU * tau) / ps[i] + ph + 1.7 * i);
    return v;
  };
  const th0 = s * 0.14 * wob(ROCK_P, ROCK_W, 0.7);
  const x0 = s * 10 * wob(SLIDE_P, SLIDE_W, 2.1);
  const y0 = s * 2 * wob(PRESS_P, PRESS_W, 1.3);
  // The slow wander across the plane of the scan blends the two noise tiles.
  const psi = 0.55 * sin(0.23 * t) + 0.45 * sin(0.0917 * t + 1.7) + 0.3 * sin(0.0411 * t + 3.3);
  const cp = cos(psi), sp = sin(psi);
  const { t1r, t1i, t2r, t2i, tbr, tbi } = P;
  for (let i = 0; i < TM; i++) {
    tbr[i] = cp * t1r[i] + sp * t2r[i];
    tbi[i] = cp * t1i[i] + sp * t2i[i];
  }
  // The cyst drifts through the tissue; the tissue breathes along depth.
  const cx = -8 + 6 * sin((TAU * t) / 37.1 + 0.9) + 3 * sin((TAU * t) / 14.9 + 3) + 2 * sin((TAU * t) / 71.3 + 5);
  const cy = 78 + 5 * sin((TAU * t) / 29.7 + 2) + 2 * sin((TAU * t) / 11.1 + 0.2) + 2 * sin((TAU * t) / 53.9 + 1);
  const { ux, uy } = P;
  for (let y = 0; y < 256; y++) {
    const w = cl((y - 30) / 50, 0, 1);
    uy[y] = w * (2.3 * sin((TAU * t) / 7.3 - y / 46) + 1.1 * sin((TAU * t) / 4.37 + y / 31 + 1));
    ux[y] = w * 1.2 * sin((TAU * t) / 11.9 + y / 57 + 0.5);
  }
  // Colour flow: a pulse a little under every 2.3 s whose rate itself wanders,
  // running along the vessel from left to right.
  const pulse = (TAU * t) / 2.3 + 1.4 * sin((TAU * t) / 13.1) + 0.9 * sin((TAU * t) / 5.7 + 2);
  const sway = 0.6 * sin((TAU * t) / 47.3 + 2);

  const { re, im, flow, sa, ca, G, st } = P;
  for (let l = 0; l < NL; l++) {
    const a = (l - (NL - 1) / 2) * DTH + th0;
    sa[l] = sin(a);
    ca[l] = cos(a);
  }
  const RC4 = RC + 4;
  for (let l = 0; l < NL; l++) {
    const bs = sa[l], bc = ca[l], base = l * NR, fb = (l - PAD) * NR, vis = l >= PAD && l < PAD + NLV;
    let lg = 0;
    for (let kk = 0; kk < NR; kk++) {
      const r = RS + kk;
      const wx = x0 + r * bs, wy = y0 + r * bc;
      let iy = wy | 0;
      iy = iy < 0 ? 0 : iy > 255 ? 255 : iy;
      const px = wx - ux[iy], py = wy - uy[iy];
      // The scatterers, by a bilinear look into the blended tile.
      const fx = floor(px), fy = floor(py), ax = px - fx, ay = py - fy;
      const ix = fx & 255, jy = fy & 255, ix1 = (ix + 1) & 255, jy1 = (jy + 1) & 255;
      const j00 = (jy << 8) | ix, j10 = (jy << 8) | ix1, j01 = (jy1 << 8) | ix, j11 = (jy1 << 8) | ix1;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      const tre = tbr[j00] * w00 + tbr[j10] * w10 + tbr[j01] * w01 + tbr[j11] * w11;
      const tim = tbi[j00] * w00 + tbi[j10] * w10 + tbi[j01] * w01 + tbi[j11] * w11;
      // How strongly this tissue scatters.
      const su = (px + 128) * 0.5, sv = (py + 20) * 0.5;
      const sx = floor(su), sy = floor(sv), bx = su - sx, by = sv - sy;
      const sx0 = sx & 127, sx1 = (sx + 1) & 127, sy0 = (sy & 127) * SN, sy1 = ((sy + 1) & 127) * SN;
      let amp = (st[sy0 + sx0] * (1 - bx) + st[sy0 + sx1] * bx) * (1 - by) + (st[sy1 + sx0] * (1 - bx) + st[sy1 + sx1] * bx) * by;
      let coh = 0;
      let q = 0;
      // The loss laid down before this sample is what reaches it; its own is for the ones behind.
      const lg0 = lg;
      // The cyst: no scatterers, a little less loss through it (the bright column
      // behind), and a loss at its rim for beams that skim it (the edge shadows).
      const dxc = px - cx, dyc = py - cy;
      if (dxc < RC4 && dxc > -RC4 && dyc < RC4 && dyc > -RC4) {
        const d = sqrt(dxc * dxc + dyc * dyc) + 1e-6;
        const m = smooth((d - RC + 1.2) / 2.4);
        amp *= 0.05 + 0.95 * m;
        const cs = (dxc * bs + dyc * bc) / d;
        const rw = exp(-((d - RC) * (d - RC)) / 4.5);
        lg += (0.25 * (1 - m) - 2.5 * rw * (1 - cs * cs)) / 8.686;
      }
      // The membrane: a thin bright line where the beam meets it square on, with
      // a wedge of lost echo behind it.
      const exm = px - MX, eym = py - MY;
      if (eym > 14 && eym < 44 && exm > -24 && exm < 24) {
        const rr = sqrt(exm * exm + eym * eym), dd = rr - RM;
        if (dd < 3.5 && dd > -3.5) {
          const wa = smooth((0.46 - Math.abs(exm / rr)) / 0.1);
          if (wa > 0) {
            const cb = (exm * bs + eym * bc) / rr;
            const g = exp(-dd * dd * 0.78) * wa;
            coh = 11 * g * cb * cb;
            lg -= (7 * g * (0.3 + 0.7 * cb * cb)) / 8.686;
          }
        }
      }
      // The vessel: an empty tube with a bright wall; the colour flow lives in it.
      if (py > VY - 20 && py < VY + 20) {
        const ph = px / 22 + 0.8 + sway;
        const sl = 0.409 * cos(ph);
        const dv = (py - (VY + 9 * sin(ph))) / sqrt(1 + sl * sl);
        const ad = dv < 0 ? -dv : dv;
        if (ad < RV + 3) {
          const lu = 1 - smooth((ad - RV + 0.9) / 1.8);
          amp *= (1 - 0.96 * lu) * (1 + 0.8 * exp(-((ad - RV - 0.6) * (ad - RV - 0.6)) / 1.0) * (1 - lu));
          if (lu > 0.02 && vis) {
            const prof = 1 - (dv / RV) * (dv / RV);
            const pf = 0.5 + 0.5 * sin(px * 0.165 - pulse);
            const nz = tileAt(tbr, px - 9 * t, py);
            q = pow(prof > 0 ? prof : 0, 0.6) * (0.22 + 0.78 * pf * pf) * (0.72 + 0.28 * cl(nz, -1, 1)) * lu;
          }
        }
      }
      if (vis) flow[fb + kk] = q;
      const gg = G[kk] * (lg0 === 0 ? 1 : exp(lg0));
      re[base + kk] = (tre * amp + coh) * gg;
      im[base + kk] = tim * amp * gg;
    }
  }

  // Along the beam: the pulse. Across the beams: the aperture. Then the envelope.
  const { tr, ti, gk, gl, sumR, sumI, env } = P;
  for (let l = 0; l < NL; l++) {
    const base = l * NR;
    for (let kk = 0; kk < NR; kk++) {
      const j0 = kk < KR ? -kk : -KR, j1 = kk > NR - 1 - KR ? NR - 1 - kk : KR;
      let a = 0, b = 0;
      for (let j = j0; j <= j1; j++) {
        const g = gk[j + KR];
        a += g * re[base + kk + j];
        b += g * im[base + kk + j];
      }
      tr[base + kk] = a;
      ti[base + kk] = b;
    }
  }
  for (let l = PAD; l < PAD + NLV; l++) {
    sumR.fill(0);
    sumI.fill(0);
    for (let j = -KL; j <= KL; j++) {
      const g = gl[j + KL], base = (l + j) * NR;
      for (let kk = 0; kk < NR; kk++) {
        sumR[kk] += g * tr[base + kk];
        sumI[kk] += g * ti[base + kk];
      }
    }
    const eb = (l - PAD) * NR;
    for (let kk = 0; kk < NR; kk++) env[eb + kk] = sqrt(sumR[kk] * sumR[kk] + sumI[kk] * sumI[kk]);
  }
}

// The tone map and the colour-flow map, rebuilt when the hue knob moves.
function palettes(P, h0) {
  P.hc = h0;
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    const h = h0 + 0.12 * (1 - v) * (1 - v) - 0.05 * v * v;
    const sat = 0.85 - 0.28 * smooth(v / 0.5) - 0.55 * smooth((v - 0.5) / 0.5);
    hsv(h, sat, 0.12 + 0.88 * pow(v, 0.8), P.tone, i * 3);
  }
  for (let i = 0; i < 64; i++) {
    const q = i / 63;
    hsv(h0 + 0.42 + 0.1 * q, 0.98 - 0.25 * q * q, 0.3 + 0.7 * q, P.fl, i * 3);
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const s = pow(2, 1.6 * cl(k[3], -1, 1));
  params.t += d;
  params.tau += d * sqrt(s);
  const h0 = 0.57 + k[0];
  if (Math.abs(h0 - params.hc) > 1e-4) palettes(params, h0);
  render(params, k);
  params.gainDb = (cl(k[1], 0, 4) - 2) * 4.5;
}

export function draw(display, params) {
  const { env, flow, pIdx, pFl, pFk, pAl, tone, fl } = params;
  const gain = (params.gainDb || 0) - 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const al = pAl[i];
      if (al <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const b = pIdx[i], u = pFl[i], w = pFk[i];
      const e =
        (env[b] * (1 - w) + env[b + 1] * w) * (1 - u) + (env[b + NR] * (1 - w) + env[b + NR + 1] * w) * u;
      const db = 8.686 * log(sqrt(e * e + 0.0016));
      const v = cl(0.5 + (db + gain) / DR, 0, 1);
      const ti = ((v * 255) | 0) * 3;
      let r = tone[ti], g = tone[ti + 1], bl = tone[ti + 2];
      const q = (flow[b] * (1 - w) + flow[b + 1] * w) * (1 - u) + (flow[b + NR] * (1 - w) + flow[b + NR + 1] * w) * u;
      if (q > 0.1) {
        const a = smooth((q - 0.1) / 0.22);
        const fi = ((cl(q, 0, 1) * 63) | 0) * 3;
        r += (fl[fi] - r) * a;
        g += (fl[fi + 1] - g) * a;
        bl += (fl[fi + 2] - bl) * a;
      }
      display.setPixel(x, y, r * al, g * al, bl * al);
    }
}
