// ===== Patternflow pattern =====
// Title:   Riso Overprint
// Family:  riso
// Idea:    A risograph print as a moving picture: pink discs, blue bands and yellow blobs drift over cream paper as three translucent inks that mix like print where they overlap (violet, red, green, near black where all three meet), each drum slipping a little off register so slivers of one ink show at the edge of another.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: risograph printing, one spot-colour ink per drum laid translucent on paper and never quite in register, from memory; pattern round 232
// Round:   232
// ===============================
// @matrix 64x128
// @knobs Inks=0..1, Drift=0..4, Scale=-1..1, Slip=0..1
//
// Knob 1: Inks. Turns the three inks around the colour wheel together, fluorescent pink, blue and yellow at 0 and the same set again at 1; the overlaps follow because they are mixed from the inks, not picked.
// Knob 2: Drift. How fast the three layers wander, frozen at 0, the opening speed at 2 and twice that at 4.
// Knob 3: Scale. Poster-size shapes at -1, 1.7 times the opening size, with three discs and two or three blobs on the panel; at 1 the shapes are 0.6 times the opening size, with eight discs and seven blobs and the bands narrower.
// Knob 4: Slip. How far each drum is off register, perfect at 0, a hairline of 0.7 LED at the opening value and up to about 4 LED at 1.

const W = 64;
const H = 128;
const N = W * H;
const { floor, sqrt, cos, sin, exp, abs, PI, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
const frac = (v) => v - floor(v);

const PAPER = [150, 145, 134];
const EW = 1.3; // LED an ink takes to go from none to full at a crisp edge

// Pink, blue, yellow as hue in degrees and saturation: the transmittance of an ink is its colour at full value.
const INK_H = [332, 211, 54];
const INK_S = [0.8, 0.82, 0.86];

const NB = 26; // bands in the long list, of which the panel shows a handful
const ND = 8; // discs
const NG = 7; // blobs

// ---- slow wanderers: a few sines of unrelated periods, scaled to a standard deviation of one
function wand(n, p0, p1) {
  const f = [];
  const ph = [];
  const w = [];
  let e = 0;
  for (let k = 0; k < n; k++) {
    f.push(TAU / (p0 * pow(p1 / p0, Math.random())));
    ph.push(Math.random() * TAU);
    const a = 0.6 + Math.random() * 0.8;
    w.push(a);
    e += a * a * 0.5;
  }
  const g = 1 / sqrt(e);
  return { f, ph, w: w.map((a) => a * g) };
}

function wv(o, t) {
  let v = 0;
  for (let k = 0; k < o.f.length; k++) v += o.w[k] * sin(o.f[k] * t + o.ph[k]);
  return v;
}

function halton(i, b) {
  let f = 1;
  let r = 0;
  for (let n = i + 1; n > 0; n = floor(n / b)) {
    f /= b;
    r += f * (n % b);
  }
  return r;
}

const hsv = (h, s, v) => {
  h = frac(h / 360) * 6;
  const i = floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
};

// ---- grain: a periodic value noise, two lattices, so ink sits a little unevenly in patches of two or three LED
function grain() {
  const out = new Float32Array(N);
  const lat = (nx, ny) => {
    const a = new Float32Array(nx * ny);
    for (let i = 0; i < a.length; i++) a[i] = Math.random();
    return (x, y) => {
      const fx = (x / W) * nx;
      const fy = (y / H) * ny;
      const x0 = floor(fx);
      const y0 = floor(fy);
      const tx = sm(fx - x0);
      const ty = sm(fy - y0);
      const xa = x0 % nx;
      const xb = (x0 + 1) % nx;
      const ya = y0 % ny;
      const yb = (y0 + 1) % ny;
      const top = a[ya * nx + xa] + (a[ya * nx + xb] - a[ya * nx + xa]) * tx;
      const bot = a[yb * nx + xa] + (a[yb * nx + xb] - a[yb * nx + xa]) * tx;
      return top + (bot - top) * ty;
    };
  };
  const o1 = lat(24, 48);
  const o2 = lat(10, 20);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = cl(0.5 + (0.65 * o1(x, y) + 0.35 * o2(x, y) - 0.5) * 2.2, 0, 1);
  return out;
}

export function setup(P) {
  const sx = Math.random();
  const sy = Math.random();
  P.t = 0;
  P.disc = [];
  for (let i = 0; i < ND; i++) {
    P.disc.push({
      hx: 7 + 50 * frac(halton(i, 2) + sx),
      hy: 10 + 108 * frac(halton(i, 3) + sy),
      x: wand(3, 34, 150),
      y: wand(3, 34, 150),
      r0: i < 3 ? rnd(11, 15) : rnd(7, 11.5),
      rw: wand(2, 30, 110),
      lvl: Math.random() < 0.28 ? rnd(0.58, 0.76) : rnd(0.9, 1),
    });
  }
  P.band = [];
  let pos = 0;
  for (let j = 0; j < NB; j++) {
    // Bands come in runs of two or three close together, with a wide gap after.
    pos += Math.random() < 0.38 ? rnd(8, 14) : rnd(28, 48);
    const wd = Math.random();
    P.band.push({
      home: pos,
      h: wd < 0.35 ? rnd(1.6, 3) : wd < 0.8 ? rnd(3, 5) : rnd(5, 7.5),
      c: wand(2, 40, 140),
      w: wand(2, 35, 120),
      lvl: Math.random() < 0.25 ? rnd(0.58, 0.76) : rnd(0.88, 1),
    });
  }
  const mid = pos / 2;
  for (const b of P.band) b.home -= mid;
  P.slide = wand(3, 45, 160);
  P.tilt = wand(3, 50, 170);
  P.tilt0 = rnd(-0.12, 0.12);
  P.blob = [];
  const ux = Math.random();
  const uy = Math.random();
  for (let k = 0; k < NG; k++) {
    const pr = k % 2 === 1 ? P.blob[k - 1] : null;
    P.blob.push({
      hx: pr ? cl(pr.hx + rnd(-13, 13), 6, 58) : 8 + 48 * frac(halton(k, 3) + ux),
      hy: pr ? cl(pr.hy + rnd(-17, 17), 8, 120) : 12 + 104 * frac(halton(k, 5) + uy),
      x: wand(3, 38, 160),
      y: wand(3, 38, 160),
      sa: rnd(9.5, 13.5),
      asp: rnd(1.3, 2.1),
      th0: rnd(0, PI),
      th: wand(2, 60, 200),
      amp: rnd(1.1, 1.35),
      am: wand(2, 40, 150),
    });
  }
  P.wave = [];
  for (let k = 0; k < 3; k++) {
    const lam = rnd(18, 40);
    const ang = Math.random() * TAU;
    P.wave.push({ kx: (TAU / lam) * cos(ang), ky: (TAU / lam) * sin(ang), w: rnd(0.05, 0.12) * (Math.random() < 0.5 ? -1 : 1), ph: Math.random() * TAU });
  }
  P.slip = [0, 1, 2].map(() => ({ x: wand(3, 26, 90), y: wand(3, 26, 90) }));
  P.gr = [grain(), grain(), grain()];
  P.gdx = [0, 1, 2].map(() => rnd(-0.12, 0.12));
  P.gdy = [0, 1, 2].map(() => rnd(-0.12, 0.12));
  P.dA = new Float32Array(N);
  P.dB = new Float32Array(N);
  P.dC = new Float32Array(N);
  P.F = new Float32Array(N);
  P.GX = new Float32Array(N);
  P.GY = new Float32Array(N);
  P.tab = new Float32Array(640);
  P.k = [0, 2, 0, 0.06];
  P.T = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
}

export function update(dt, input, P) {
  if (!P.disc) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  P.k = k;
  P.t += cl(dt || 0, 0, 0.1) * (cl(k[1], 0, 4) / 2);
}

// Turned round the wheel an ink keeps the lightness it has at the opening, so a set built on the red, green and blue ends of the wheel does not
// turn every overlap to mud: the saturation gives way until the ink is as light as the pink, blue or yellow it replaces.
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const INK_L = INK_H.map((h, i) => luma(hsv(h, INK_S[i], 1)));

const ink = (P) => {
  const rot = cl(P.k[0], 0, 1) * 360;
  for (let i = 0; i < 3; i++) {
    const h = INK_H[i] + rot;
    let lo = 0.62;
    let hi = 0.95;
    let sat = INK_S[i];
    if (rot > 0) {
      if (luma(hsv(h, hi, 1)) >= INK_L[i]) lo = hi;
      else if (luma(hsv(h, lo, 1)) <= INK_L[i]) hi = lo;
      else
        for (let n = 0; n < 12; n++) {
          const mid = (lo + hi) / 2;
          if (luma(hsv(h, mid, 1)) > INK_L[i]) lo = mid;
          else hi = mid;
        }
      // Part of the way there: all of it washes the inks out.
      sat += ((lo + hi) / 2 - sat) * 0.6;
    }
    P.T[i] = hsv(h, sat, 1);
  }
};

// A disc of radius r at (cx, cy), at most `lvl` thick, into the density array d.
function disc(d, cx, cy, r, lvl) {
  if (r < 0.3) return;
  const x0 = Math.max(0, floor(cx - r - 2));
  const x1 = Math.min(W - 1, floor(cx + r + 2));
  const y0 = Math.max(0, floor(cy - r - 2));
  const y1 = Math.min(H - 1, floor(cy + r + 2));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const v = lvl * sm(0.5 + (r - sqrt(dx * dx + dy * dy)) / EW);
      const i = y * W + x;
      if (v > d[i]) d[i] = v;
    }
}

function compose(P) {
  const t = P.t;
  const kn = P.k;
  const u3 = (cl(kn[2], -1, 1) + 1) / 2;
  const s = exp(-(kn[2] < 0 ? 0.55 : 0.5) * cl(kn[2], -1, 1));
  const a4 = 4 * pow(cl(kn[3], 0, 1), 0.6);
  const off = P.slip.map((o) => [a4 * 0.9 * wv(o.x, t), a4 * 0.9 * wv(o.y, t)]);
  const { dA, dB, dC, F, GX, GY, tab } = P;
  dA.fill(0);
  dB.fill(0);
  dC.fill(0);
  F.fill(0);
  GX.fill(0);
  GY.fill(0);

  // A: discs, and the twins two of them have in the other drums
  const nA = 3 + 5 * u3;
  const echo = [null, null, null];
  for (let i = 0; i < ND; i++) {
    const o = P.disc[i];
    const wgt = cl(nA - i, 0, 1);
    const r = o.r0 * s * (1 + 0.13 * wv(o.rw, t)) * wgt;
    const cx = o.hx + 10 * wv(o.x, t);
    const cy = o.hy + 17 * wv(o.y, t);
    disc(dA, cx + off[0][0], cy + off[0][1], r, o.lvl);
    if (i < 3) echo[i] = [cx, cy, r, o.lvl];
  }
  if (echo[0]) disc(dC, echo[0][0] + off[2][0], echo[0][1] + off[2][1], echo[0][2] + 0.5, echo[0][3]);
  if (echo[1]) disc(dB, echo[1][0] + off[1][0], echo[1][1] + off[1][1], echo[1][2] - 0.6, echo[1][3]);

  // B: bands along a slowly turning direction, as a profile across it
  const TS = tab.length;
  const U0 = -TS / 4;
  tab.fill(0);
  const slide = 20 * wv(P.slide, t);
  for (let j = 0; j < NB; j++) {
    const b = P.band[j];
    const c = (b.home + 5 * wv(b.c, t)) * s + slide;
    const h = b.h * s * (1 + 0.28 * wv(b.w, t) * 0.7);
    const lo = Math.max(0, floor((c - h - 3 - U0) * 2));
    const hi = Math.min(TS - 1, floor((c + h + 3 - U0) * 2));
    for (let q = lo; q <= hi; q++) {
      const u = U0 + (q + 0.5) / 2;
      const v = b.lvl * sm(0.5 + (h - abs(u - c)) / EW);
      if (v > tab[q]) tab[q] = v;
    }
  }
  const th = P.tilt0 + 0.22 * wv(P.tilt, t);
  const sn = sin(th);
  const cs = cos(th);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - 32 - off[1][0]) * sn + (y + 0.5 - 64 - off[1][1]) * cs;
      const q = (u - U0) * 2 - 0.5;
      const q0 = floor(q);
      if (q0 < 0 || q0 >= TS - 1) continue;
      const f = q - q0;
      dB[y * W + x] = Math.max(dB[y * W + x], tab[q0] * (1 - f) + tab[q0 + 1] * f);
    }

  // C: blobs, a sum of moving ellipses thresholded at one half, edges widened by the slope so they stay crisp
  const nC = 2.5 + 4.5 * u3;
  for (let k = 0; k < NG; k++) {
    const o = P.blob[k];
    const a = o.amp * (1 + 0.12 * wv(o.am, t)) * cl(nC - k, 0, 1);
    if (a < 0.02) continue;
    const cx = o.hx + 11 * wv(o.x, t) + off[2][0];
    const cy = o.hy + 19 * wv(o.y, t) + off[2][1];
    const sa = o.sa * s;
    const sb = sa / o.asp;
    const ang = o.th0 + 0.7 * wv(o.th, t);
    const ca = cos(ang);
    const sg = sin(ang);
    const R = 3.4 * sa;
    const x0 = Math.max(0, floor(cx - R));
    const x1 = Math.min(W - 1, floor(cx + R));
    const y0 = Math.max(0, floor(cy - R));
    const y1 = Math.min(H - 1, floor(cy + R));
    const ia = 1 / (sa * sa);
    const ib = 1 / (sb * sb);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const uu = dx * ca + dy * sg;
        const vv = -dx * sg + dy * ca;
        const q = uu * uu * ia + vv * vv * ib;
        if (q > 11.6) continue;
        const e = a * exp(-0.5 * q);
        const i = y * W + x;
        F[i] += e;
        GX[i] -= e * (uu * ca * ia - vv * sg * ib);
        GY[i] -= e * (uu * sg * ia + vv * ca * ib);
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let f = F[i];
      if (f < 0.1) continue;
      let nz = 0;
      for (const w of P.wave) nz += sin(w.kx * x + w.ky * y + w.w * t + w.ph);
      f += 0.05 * nz * sm((f - 0.1) / 0.2);
      const g = Math.max(sqrt(GX[i] * GX[i] + GY[i] * GY[i]), 0.025);
      dC[i] = 0.95 * sm(0.5 + (f - 0.5) / g / EW);
    }
}

// Ink laid down a little unevenly: a fixed texture that creeps across the panel.
function gsamp(tex, fx, fy) {
  const x0 = floor(fx);
  const y0 = floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const xa = ((x0 % W) + W) % W;
  const ya = ((y0 % H) + H) % H;
  const xb = (xa + 1) % W;
  const yb = (ya + 1) % H;
  const top = tex[ya * W + xa] + (tex[ya * W + xb] - tex[ya * W + xa]) * tx;
  const bot = tex[yb * W + xa] + (tex[yb * W + xb] - tex[yb * W + xa]) * tx;
  return top + (bot - top) * ty;
}

export function draw(display, P) {
  if (!P.disc) return;
  ink(P);
  compose(P);
  const { dA, dB, dC, T, gr } = P;
  const t = P.t;
  const TA = T[0];
  const TB = T[1];
  const TC = T[2];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let a = dA[i];
      let b = dB[i];
      let c = dC[i];
      if (a > 0.002) a *= 0.84 + 0.16 * gsamp(gr[0], x + P.gdx[0] * t, y + P.gdy[0] * t);
      if (b > 0.002) b *= 0.84 + 0.16 * gsamp(gr[1], x + P.gdx[1] * t, y + P.gdy[1] * t);
      if (c > 0.002) c *= 0.84 + 0.16 * gsamp(gr[2], x + P.gdx[2] * t, y + P.gdy[2] * t);
      const r = PAPER[0] * (1 - a * (1 - TA[0])) * (1 - b * (1 - TB[0])) * (1 - c * (1 - TC[0]));
      const g = PAPER[1] * (1 - a * (1 - TA[1])) * (1 - b * (1 - TB[1])) * (1 - c * (1 - TC[1]));
      const bl = PAPER[2] * (1 - a * (1 - TA[2])) * (1 - b * (1 - TB[2])) * (1 - c * (1 - TC[2]));
      const w3 = a * b * c;
      if (w3 > 0.002) {
        // Three inks on one spot go to a cool near-black, not to a brown.
        const lum = 0.3 * r + 0.59 * g + 0.11 * bl;
        const k = 0.92 * w3;
        display.setPixel(x, y, (r + (lum * 0.8 - r) * k) | 0, (g + (lum * 0.88 - g) * k) | 0, (bl + (lum * 1.1 - bl) * k) | 0);
        continue;
      }
      display.setPixel(x, y, r | 0, g | 0, bl | 0);
    }
}
