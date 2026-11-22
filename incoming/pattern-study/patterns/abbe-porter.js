// ===== Patternflow pattern =====
// Title:   Abbe Porter
// Family:  fourieroptics
// Idea:    A red laser through a wire gauze, drawn as Abbe saw the microscope image form: the top third of the panel is the focal plane, where the gauze's diffraction orders stand as a lattice of dots and a stop that drifts from circle to slit to ring to off-axis circle lets some of them through, and the rest of the panel is the image those orders make when they meet again, so it sharpens as orders come in, is only stripes through a slit, shows its holes as dark loops through a ring with a quarter-wave dot, and turns to dark field when the stop gives up the central dot.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ernst Abbe's diffraction theory of the microscope image (1873), Albert B. Porter's wire gauze seen through masks in the focal plane (1906), Frits Zernike's phase contrast (1934); pattern round 215
// Round:   217
// ===============================
// @matrix 64x128
// @knobs Laser=-0.2..1, Pupil=0..3, Shape=0..3, Pitch=-1..1
//
// Knob 1: Laser. The laser line. At 0, where it opens, it is 633 nm, the helium-neon red, and the focal plane is drawn at S = 90 LED^2 times the spatial frequency, so the first orders lie 4 to 8 LEDs from the central dot. Each unit of the knob takes 228 nm off: 0.5 is 519 nm green, 1 is 405 nm violet, where the plane is drawn at 0.64 of that size (S = 57.6), the same stop lets 2.4 times as many orders through and the image is sharper, which is Abbe's d = lambda / NA. Below 0 the line goes to 700 nm at -0.2, a deep red, and the plane opens out to 1.11 times.
// Knob 2: Pupil. The radius of the stop in the focal plane, 12.5 LEDs at 2, where it opens, and 12.5 * 2^(0.8 (K - 2)) elsewhere: 4.3 at 0 and 21.8 at 3. It breathes by up to 54 percent (three sines of 9.7, 23 and 67 s) and never closes below 1.05 times the distance of the first orders, 4 to 9 LEDs, so even at 0 the four or six first orders pass and the image is a soft glow with faint blobs. At the opening 19 orders pass and the gauze is about four round blobs across. At 3 the stop takes the whole plane and the holes come out as rounded rectangles with a ripple at their edges. The slit, ring and off-axis forms all take their size from this radius.
// Knob 3: Shape. Where the stop is on its round of four forms: 0 a circle, 1 a slit, 2 a ring, 3 an off-axis circle, and a blend of the two nearest in between. The stop moves on by itself, holding a form 4 to 13 s and taking 5 to 10 s to reach the next, one time in five skipping one, and the knob is added to where it is. The slit runs past both edges of the plane and is 0.42 to 0.9 R + 2 wide, its direction swinging over the lattice's rows; the ring has an outer radius of 0.85 to 1.75 R + 1 and an inner one 0.36 to 0.8 of that, with a dot of 2.3 LEDs on the central order that delays it by a quarter wave (pi / 2) and passes 0.45 of its amplitude; the off-axis circle has radius 0.95 R and its centre 0.2 to 1.4 R off the axis, so past R it blocks the central dot. Every form is redrawn a little each visit.
// Knob 4: Pitch. The pitch of the gauze in the image, 15.5 * 2^(0.55 K) LEDs: 10.6 at -1, 15.9 where it opens at 0.06, 22.8 at 1. The two pitches then wander by 20 percent each and the pair by 12 percent over 17 to 89 s, kept between 11 and 23, so the cell is never a square for long. The focal plane draws its reciprocal, the orders S / pitch apart, 4 LEDs for the coarsest gauze and 8.2 for the finest at 633 nm. A coarse gauze packs more orders under the stop and its image shows more detail, a fine one lets few through and its holes stay soft blobs.

// What the picture is. A mesh of rectangular holes in an opaque screen is lit by a plane laser wave, and a lens takes its Fraunhofer pattern to a focal
// plane, the top 42 rows, and a second lens turns what passes the stop back into an image, the bottom 82 rows. Abbe's point is that the image is
// the interference of the orders in the plane, so a stop in the plane edits it. The mesh has lattice vectors a1 and a2 (pitches p1, p2, angle th that
// turns 1.7 degrees a second on average, and a shear of up to 0.29 rad), a hole of fraction fx by fy of the cell (each wandering over 0.25 to 0.67, so at
// 0.5 every even order vanishes) and bars between the holes of amplitude ab (0 to 0.4) and delay 0.7 to 1.5 rad. Its Fourier coefficients are
//   c(m, n) = (1 - t_bar) fx fy sinc(m fx) sinc(n fy), and c(0, 0) = t_bar (1 - fx fy) + fx fy,
// with t_bar = ab exp(i delay). An order sits at q = S (m b1 + n b2) from the axis, b1 and b2 being the reciprocal vectors, and a dot is drawn there
// 1.15 LEDs in sigma (2.7 across) at 1.2 log(1 + 30 |c| / |c|max) / log 31 of full, bright when the stop passes it and 0.2 of that when it does not. The stop
// is a soft-edged ellipse with a hole, shifted off the axis, a 2 LED edge, cut off by the edges of the plane and by a spatial frequency of 0.26 to
// 0.36 cycles an LED, so no stripe in the image is finer than 3 LEDs. Its inside is lit at 0.2 so the stop reads as a lit plate.
// The image is I = |sum over passed orders of A(q) c(m, n) exp(2 pi i (m s + n t))|^2, with s and t the position in the cell, and the cell is
// the one the sum is done on: a 64 by 64 table of the field made with two passes of the sum, one down n and one down m, and read back with a bilinear
// lookup, so 20 to 40 orders cost about 2 ms a frame. The mean of I is the sum of the squares of the passed orders, and a gain of 0.5 over that
// (1 to 10 times, glided over 1.2 s) keeps a dark-field image from going out, with a drift of 0.44 to 1 for the laser's power. The beam is a Gaussian
// with an intensity of exp(-2 r^2 / w^2) at w = 31 to 53 LEDs across and 40 to 72 down, wandering by up to 40 LEDs across and 68 down, with a floor of 0.12,
// and two faint ripples ride on it, the fringes of a beam expander, 36 and 26 percent deep with wavelengths of 26 to 56 LEDs. They drift at about 1.5 LEDs
// a second. A mesh turning at a steady rate looks the same again every half turn, and the beam and the ripples never line up twice.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, log, sin, cos, PI, abs, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the two halves of the panel
const PH = 42; // the focal plane takes rows 0 to 41; rows 42 to 45 stay dark; the image takes rows 46 to 127
const CX = 31.5, CY = 20.5; // the optical axis in the focal plane
const IY0 = 46, ICX = 31.5, ICY = 86.5;
const S0 = 90; // lambda times the focal length, in LED^2, at 633 nm: an order of spatial frequency f lies S0 f LEDs from the axis
const G = 64; // the unit cell of the object is rendered as a G by G table of the field
const NM = 16; // orders m, n from -16 to 16 are looked at
const NMAX = (2 * NM + 1) * (2 * NM + 1);
const CT = new Float32Array(G), ST = new Float32Array(G);
for (let k = 0; k < G; k++) (CT[k] = cos((TAU * k) / G)), (ST[k] = sin((TAU * k) / G));

// laser line in nm -> hue
const LINES = [[700, 0.0], [633, 0.03], [600, 0.09], [570, 0.16], [532, 0.33], [500, 0.45], [473, 0.57], [440, 0.65], [405, 0.74]];
function hueOf(lam) {
  for (let i = 1; i < LINES.length; i++)
    if (lam >= LINES[i][0]) {
      const a = LINES[i - 1], b = LINES[i], u = (lam - b[0]) / (a[0] - b[0]);
      return b[1] + (a[1] - b[1]) * u;
    }
  return LINES[LINES.length - 1][1];
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function makeState() {
  return {
    t: 0, th: 0.35, sg: 0, hold: 7, mv: 0, mvd: 1, mvj: 1, mv0: 0, s0: 0.13, t0: 0.41,
    ready: false, R: 12.5, p: 15.9, lam: 633, k3: 0, g: 1, gt: 1, gset: false,
    rv: new Float64Array([1, 1, 1.2, 0.6, 1.0, 0.5, 0, 0]), rt: new Float64Array([1, 1, 1.2, 0.6, 1.0, 0.5, 0, 0]),
    lut: new Uint8Array(256 * 3),
    Fr: new Float32Array((G + 1) * (G + 1)), Fi: new Float32Array((G + 1) * (G + 1)),
    Er: new Float32Array((2 * NM + 1) * G), Ei: new Float32Array((2 * NM + 1) * G),
    om: new Int8Array(NMAX), on: new Int8Array(NMAX), gr: new Float32Array(NMAX), gi: new Float32Array(NMAX),
    dx: new Float32Array(NMAX), dy: new Float32Array(NMAX), da: new Float32Array(NMAX), dpass: new Float32Array(NMAX),
    plane: new Float32Array(W * PH),
  };
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const k1 = cl(kn[0], -0.2, 1), k2 = cl(kn[1], 0, 3), k3 = cl(kn[2], 0, 3), k4 = cl(kn[3], -1, 1);
  const lam = k1 >= 0 ? 633 - 228 * k1 : 633 - 335 * k1, R = 12.5 * pow(2, 0.8 * (k2 - 2)), p = 15.5 * pow(2, 0.55 * k4);
  const a = S.ready ? 1 - exp(-d / 0.4) : 1;
  S.R += (R - S.R) * a;
  S.p += (p - S.p) * a;
  S.lam += (lam - S.lam) * a;
  S.k3 += (k3 - S.k3) * (S.ready ? 1 - exp(-d / 0.6) : 1);
  S.ready = true;
  const t = (S.t += d);
  // the object turns, slides, and its meshes breathe; the stop's shape drifts round its four forms
  S.th += (0.03 + 0.016 * sin((TAU * t) / 47.3 + 0.9) + 0.01 * sin((TAU * t) / 19.7 + 2.2)) * d;
  // the stop holds one form for 4 to 13 s, then moves on to the next form round (now and then the one after) in 5 to 10 s
  if (S.mv > 0) {
    S.mv += d / S.mvd;
    if (S.mv >= 1) (S.mv = 0), (S.sg = S.mv0 + S.mvj), (S.hold = 4 + 9 * Math.random());
    else S.sg = S.mv0 + S.mvj * sm(0, 1, S.mv);
  } else if ((S.hold -= d) <= 0) {
    S.mv0 = S.sg;
    S.mvj = Math.random() < 0.2 ? 2 : 1;
    S.mvd = 5 + 5 * Math.random() + 2 * (S.mvj - 1);
    S.mv = 1e-6;
    const base = floor(S.k3 + S.sg);
    for (let k = 1; k <= S.mvj; k++) (redraw(S, base + k), redraw(S, base + k + 1));
  }
  S.s0 += (0.015 + 0.012 * sin((TAU * t) / 33.1 + 0.6)) * d;
  S.t0 += (0.01 + 0.01 * sin((TAU * t) / 27.7 + 2.1)) * d;
  S.g += (S.gt - S.g) * (1 - exp(-d / 1.2));
  for (let i = 0; i < 8; i++) S.rv[i] += (S.rt[i] - S.rv[i]) * (1 - exp(-d / 2.5));
}

// ---- the stop: an ellipse with a hole, shifted off the axis, plus a quarter-wave dot on the zero order
let mrx = 1, mry = 1, mrin = 0, mcx = 0, mcy = 0, mca = 1, msa = 0, mz = 0, mS = S0;
const EDGE = 2.0, RZ = 2.3;
function maskA(qx, qy) {
  const x = qx - mcx, y = qy - mcy;
  const a = x * mca + y * msa, b = -x * msa + y * mca;
  const dd = sqrt((a / mrx) * (a / mrx) + (b / mry) * (b / mry));
  let pass = 1 - sm(-EDGE, EDGE, (dd - 1) * min(mrx, mry));
  if (mrin > 0) pass *= sm(mrin - EDGE, mrin + EDGE, sqrt(x * x + y * y));
  const r0 = sqrt(qx * qx + qy * qy);
  if (mz > 0) pass = max(pass, mz * (1 - sm(RZ - EDGE, RZ + EDGE, r0)));
  const win = (1 - sm(27, 33, abs(qx))) * (1 - sm(16, 21.5, abs(qy))) * (1 - sm(0.26, 0.36, r0 / mS));
  return pass * win;
}

// Each form has its own few numbers, drawn again every time the stop is about to move to it and then glided to, so no two
// visits to the ring or the slit are the same size or width: rv holds them now, rt where they are going.
function redraw(S, i) {
  const rt = S.rt, r = Math.random;
  i = ((i % 4) + 4) % 4;
  if (i === 0) rt[0] = 0.8 + 0.5 * r();
  else if (i === 1) rt[1] = 0.7 + 0.8 * r();
  else if (i === 2) (rt[2] = 0.85 + 0.9 * r()), (rt[3] = 0.36 + 0.44 * r()), (rt[6] = (r() - 0.5) * 0.1), (rt[7] = (r() - 0.5) * 0.1);
  else (rt[4] = 0.45 + 0.95 * r()), (rt[5] = S.rv[5] + (r() - 0.5) * 3.5);
}
function archetype(i, R, t, rv, out) {
  if (i === 0) {
    const c = R * rv[0];
    out[0] = c; out[1] = c; out[2] = 0; out[3] = 0; out[4] = 0; out[5] = 0;
  } else if (i === 1) {
    out[0] = 90; out[1] = 0.3 * R * rv[1] + 1; out[2] = 0; out[3] = 0; out[4] = 0; out[5] = 0;
  } else if (i === 2) {
    const ro = min(R * rv[2] + 1, 16);
    out[0] = ro; out[1] = ro; out[2] = rv[3] * ro; out[3] = rv[6] * ro; out[4] = rv[7] * ro; out[5] = 1;
  } else {
    const al = rv[5] + 0.06 * t + 0.5 * sin(0.21 * t + 0.4);
    const off = min(R * rv[4] * (0.75 + 0.25 * sin((TAU * t) / 37.7 + 1.0)), 1.45 * R, 17);
    out[0] = 0.95 * R; out[1] = 0.95 * R; out[2] = 0; out[3] = off * cos(al); out[4] = off * sin(al); out[5] = 0;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t;

  // ---- the object: a mesh of rectangular holes, its pitches, its angle and its shear all drifting
  const p = S.p;
  const pw = 1 + 0.12 * sin((TAU * t) / 89.3 + 3.1);
  const p1 = cl(p * pw * (1 + 0.2 * sin((TAU * t) / 53.1 + 0.15) + 0.06 * sin((TAU * t) / 21.7 + 0.2)), 11, 23);
  const p2 = cl(p * pw * (1 + 0.2 * sin((TAU * t) / 61.3 + 3.3) + 0.06 * sin((TAU * t) / 17.9 + 3.3)), 11, 23);
  const sh = 0.2 * sin((TAU * t) / 71.3 + 0.5) + 0.09 * sin((TAU * t) / 27.9 + 2.8);
  const fx = 0.46 + 0.17 * sin((TAU * t) / 37.7 + 0.45) + 0.04 * sin((TAU * t) / 14.3 + 0.8);
  const fy = 0.46 + 0.17 * sin((TAU * t) / 43.9 + 3.3) + 0.04 * sin((TAU * t) / 12.1 + 3.4);
  const th = S.th;
  const a1x = p1 * cos(th), a1y = p1 * sin(th);
  const a2x = p2 * cos(th + PI / 2 + sh), a2y = p2 * sin(th + PI / 2 + sh);
  const det = a1x * a2y - a1y * a2x;
  const b1x = a2y / det, b1y = -a2x / det, b2x = -a1y / det, b2y = a1x / det; // reciprocal vectors, cycles per LED

  // bars between the holes: transmission ab, delay phb
  const ab = 0.2 + 0.2 * (0.6 * sin((TAU * t) / 97.1 + 0.4) + 0.4 * sin((TAU * t) / 41.3 + 0.1));
  const phb = 1.1 + 0.4 * sin((TAU * t) / 59.9 + 0.3);
  const tbr = ab * cos(phb), tbi = ab * sin(phb);
  const dr = 1 - tbr, di = -tbi, dmag = sqrt(dr * dr + di * di);
  const f = fx * fy;
  const c00r = tbr * (1 - f) + f, c00i = tbi * (1 - f);

  // ---- the stop
  const lamS = (S0 * S.lam) / 633;
  mS = lamS;
  // the stop never closes below the first orders: a pupil that passes only the zero order gives a flat glow
  const R = max(S.R * (1 + 0.2 * sin((TAU * t) / 23.3 + 0.6) + 0.12 * sin((TAU * t) / 9.7 + 2.5) + 0.22 * sin((TAU * t) / 67.1 + 4.0)), (1.05 * lamS) / min(p1, p2));
  const sE = S.k3 + S.sg, i0 = floor(sE), w = sE - i0, ia = ((i0 % 4) + 4) % 4, ib = (ia + 1) % 4;
  const A = [0, 0, 0, 0, 0, 0], B = [0, 0, 0, 0, 0, 0];
  archetype(ia, R, t, S.rv, A);
  archetype(ib, R, t, S.rv, B);
  mrx = A[0] + (B[0] - A[0]) * w;
  mry = A[1] + (B[1] - A[1]) * w;
  mrin = A[2] + (B[2] - A[2]) * w;
  mcx = A[3] + (B[3] - A[3]) * w;
  mcy = A[4] + (B[4] - A[4]) * w;
  mz = A[5] + (B[5] - A[5]) * w;
  const phi = th + 0.5 * PI * sm(0.25, 0.75, 0.5 + 0.5 * sin((TAU * t) / 157.3 + 0.7)) + 0.4 * sin((TAU * t) / 43.7 + 1.2) + 0.25 * sin((TAU * t) / 17.3 + 0.4);
  mca = cos(phi);
  msa = sin(phi);

  // ---- the orders
  const sx = [], sy = [];
  for (let m = -NM; m <= NM; m++) {
    const u = m * fx, v = m * fy;
    sx[m + NM] = m === 0 ? 1 : sin(PI * u) / (PI * u);
    sy[m + NM] = m === 0 ? 1 : sin(PI * v) / (PI * v);
  }
  let K = 0, aref = 0;
  const { om, on, gr, gi, dx, dy, da, dpass, Er, Ei, Fr, Fi, plane } = S;
  let mlo = NM, mhi = -NM;
  let nOrd = 0;
  const zr = cos((mz * PI) / 2) * (1 - 0.55 * mz), zi = sin((mz * PI) / 2) * (1 - 0.55 * mz);
  for (let m = -NM; m <= NM; m++)
    for (let n = -NM; n <= NM; n++) {
      const qx = lamS * (m * b1x + n * b2x), qy = lamS * (m * b1y + n * b2y);
      if (abs(qx) > 37 || abs(qy) > 25) continue;
      const pass = maskA(qx, qy);
      let amp, cr, ci;
      if (m === 0 && n === 0) {
        amp = sqrt(c00r * c00r + c00i * c00i);
        cr = c00r * zr - c00i * zi;
        ci = c00r * zi + c00i * zr;
      } else {
        const k = f * sx[m + NM] * sy[n + NM];
        amp = abs(k) * dmag;
        cr = k * dr;
        ci = k * di;
      }
      if (amp > aref) aref = amp;
      dx[nOrd] = qx; dy[nOrd] = qy; da[nOrd] = amp; dpass[nOrd] = pass;
      nOrd++;
      if (pass > 0.004) {
        om[K] = m; on[K] = n; gr[K] = pass * cr; gi[K] = pass * ci;
        K++;
        if (m < mlo) mlo = m;
        if (m > mhi) mhi = m;
      }
    }

  // exposure: the mean intensity of the image is the sum of the squares of the orders let through (Parseval)
  let meanI = 0;
  for (let k = 0; k < K; k++) meanI += gr[k] * gr[k] + gi[k] * gi[k];
  const power = 0.72 + 0.28 * (0.6 * sin((TAU * t) / 71.3 + 0.5) + 0.4 * sin((TAU * t) / 113.7 + 2.2));
  S.gt = cl(pow(0.5 / max(meanI, 1e-4), 1.0), 1, 10) * power;
  if (!S.gset) (S.g = S.gt), (S.gset = true);
  const gain = S.g;

  // ---- the image: sum the orders the stop lets through, on a table of the unit cell
  Fr.fill(0);
  Fi.fill(0);
  if (K > 0) {
    Er.fill(0);
    Ei.fill(0);
    for (let k = 0; k < K; k++) {
      const row = (om[k] + NM) * G, n = on[k], g1 = gr[k], g2 = gi[k];
      for (let v = 0; v < G; v++) {
        const ix = (((n * v) % G) + G) % G;
        Er[row + v] += g1 * CT[ix] - g2 * ST[ix];
        Ei[row + v] += g1 * ST[ix] + g2 * CT[ix];
      }
    }
    for (let m = mlo; m <= mhi; m++) {
      const row = (m + NM) * G;
      for (let u = 0; u < G; u++) {
        const ix = (((m * u) % G) + G) % G, c = CT[ix], s = ST[ix], o = u * (G + 1);
        for (let v = 0; v < G; v++) {
          const er = Er[row + v], ei = Ei[row + v];
          Fr[o + v] += er * c - ei * s;
          Fi[o + v] += er * s + ei * c;
        }
      }
    }
    for (let u = 0; u <= G; u++) {
      Fr[u * (G + 1) + G] = Fr[u * (G + 1)];
      Fi[u * (G + 1) + G] = Fi[u * (G + 1)];
    }
    for (let v = 0; v <= G; v++) {
      Fr[G * (G + 1) + v] = Fr[v];
      Fi[G * (G + 1) + v] = Fi[v];
    }
  }

  // ---- colour ramp: dark red to orange white for the 633 nm line, the same climb in the hue of the other lines
  const lut = S.lut, h0 = hueOf(S.lam), rgb = [0, 0, 0];
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    hsv(h0 + 0.05 * sm(0.15, 0.95, v), 1 - 0.62 * sm(0.55, 1, v), pow(v, 0.8), rgb);
    lut[i * 3] = (rgb[0] * 255 + 0.5) | 0;
    lut[i * 3 + 1] = (rgb[1] * 255 + 0.5) | 0;
    lut[i * 3 + 2] = (rgb[2] * 255 + 0.5) | 0;
  }
  const put = (x, y, v) => {
    const i = (cl(v, 0, 1) * 255 + 0.5) | 0;
    display.setPixel(x, y, lut[i * 3], lut[i * 3 + 1], lut[i * 3 + 2]);
  };

  // ---- draw the image; the laser beam is a Gaussian that wanders over the object, so the light is brightest where it points
  const s0 = S.s0, t0 = S.t0;
  const bx = 18 * sin((TAU * t) / 73.7 + 0.8) + 10 * sin((TAU * t) / 29.3 + 2.9) + 12 * sin((TAU * t) / 151.7 + 5.2);
  const by = 32 * sin((TAU * t) / 91.1 + 4.4) + 16 * sin((TAU * t) / 37.9 + 1.5) + 20 * sin((TAU * t) / 127.3 + 0.9);
  // two faint ripples ride on the beam, the fringes of a beam expander, each with its own wavelength, direction and drift
  const ka = TAU / (34 + 8 * sin((TAU * t) / 61.9 + 0.7)), aa = 0.6 * sin((TAU * t) / 83.3 + 1.9) + 0.35 * sin((TAU * t) / 31.7 + 4.2), pa = 0.27 * t + 1.4 * sin((TAU * t) / 23.9);
  const kb = TAU / (46 + 10 * sin((TAU * t) / 77.1 + 5.5)), ab2 = 1.5 + 0.7 * sin((TAU * t) / 97.9 + 3.3) + 0.3 * sin((TAU * t) / 41.3 + 0.1), pb = -0.21 * t + 1.1 * sin((TAU * t) / 29.1 + 2.0);
  const cka = ka * cos(aa), ska = ka * sin(aa), ckb = kb * cos(ab2), skb = kb * sin(ab2);
  const bwx = 1 / (42 + 11 * sin((TAU * t) / 57.7 + 3.6)), bwy = 1 / (56 + 16 * sin((TAU * t) / 49.1 + 0.3));
  for (let y = IY0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const X = x - ICX, Y = y - ICY, ex = (X - bx) * bwx, ey = (Y - by) * bwy;
      let s = b1x * X + b1y * Y + s0, tt = b2x * X + b2y * Y + t0;
      s -= floor(s);
      tt -= floor(tt);
      const us = s * G, vs = tt * G, iu = floor(us), iv = floor(vs), fu = us - iu, fv = vs - iv;
      const o = iu * (G + 1) + iv, o2 = o + G + 1;
      const w00 = (1 - fu) * (1 - fv), w01 = (1 - fu) * fv, w10 = fu * (1 - fv), w11 = fu * fv;
      const er = Fr[o] * w00 + Fr[o + 1] * w01 + Fr[o2] * w10 + Fr[o2 + 1] * w11;
      const ei = Fi[o] * w00 + Fi[o + 1] * w01 + Fi[o2] * w10 + Fi[o2 + 1] * w11;
      const rip = (0.64 + 0.36 * sin(cka * X + ska * Y + pa)) * (0.74 + 0.26 * sin(ckb * X + skb * Y + pb));
      const I = (er * er + ei * ei) * rip * (0.12 + 0.88 * exp(-2 * (ex * ex + ey * ey)));
      put(x, y, 1 - exp(-2.8 * pow(I * gain, 0.8)));
    }

  // ---- draw the focal plane: the stop lit, the orders as dots, the blocked ones dim
  plane.fill(0);
  const sig = 1.15, inv = 1 / (2 * sig * sig);
  for (let k = 0; k < nOrd; k++) {
    const b = log(1 + (30 * da[k]) / aref) / log(31);
    const amp = min(1, 1.2 * b) * (0.2 + 0.8 * dpass[k]);
    if (amp < 0.02) continue;
    const px = CX + dx[k], py = CY + dy[k];
    const x0 = max(0, floor(px - 3.4)), x1 = min(W - 1, ceil(px + 3.4)), y0 = max(0, floor(py - 3.4)), y1 = min(PH - 1, ceil(py + 3.4));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const ddx = x - px, ddy = y - py;
        plane[y * W + x] += amp * exp(-(ddx * ddx + ddy * ddy) * inv);
      }
  }
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < W; x++) {
      const plate = 0.2 * maskA(x - CX, y - CY), d = min(1, plane[y * W + x]);
      put(x, y, plate + d - plate * d);
    }
  for (let y = PH; y < IY0; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
}
