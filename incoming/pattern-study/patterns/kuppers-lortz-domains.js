// ===== Patternflow pattern =====
// Title:   Kuppers-Lortz Domains
// Family:  physics
// Idea:    Three sets of convection rolls in a rotating layer, amber, teal and orchid, share the panel's 64 by 128 torus as slowly varying amplitudes; above the Kuppers-Lortz threshold each set is eaten by the set turned 60 degrees from it, so domains of parallel stripes chase one another round and round, the walls between them sweep the panel, dislocations climb, and no orientation ever wins.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kuppers-Lortz instability of convection in a rotating layer (Gunter Kuppers and Dietrich Lortz, 1969; the experiment, Kenneth Heikes and Friedrich Busse, 1980) in the three-roll amplitude equations with cyclic cubic couplings (Friedrich Busse and Kenneth Heikes, 1980) on the Newell-Whitehead-Segel envelope (Alan Newell and John Whitehead, 1969; Lee Segel, 1969), the domain chaos they drive (Yuhai Tu and Michael Cross, 1992; the experiment, Yu Hu, Robert Ecke and Guenter Ahlers, 1993), all names and years from memory; solved with Fourier modes (James Cooley and John Tukey, 1965), the linear part exactly and the cubic coupling by its own solution at each point in a symmetric splitting (Gilbert Strang, 1968), coloured in Oklab (Bjorn Ottosson 2020); pattern round 124, made on the creator's turn of 8 November toward fields that flow for ever
// Round:   124
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Rotation=-1..1
//
// Knob 1: Hue. Adds its value times 360 degrees to the Oklab hue of all three orientation colours at once, so one turn comes back. At 0 the three sets of stripes are amber (hue 75), teal (195) and orchid (315); at 0.25 green, blue-violet and vermilion; at 0.5 blue, rose and lime; at 0.75 pink, yellow-green and sky blue. A set keeps its colour wherever it is on the panel, and where two sets share a place the colour goes to pearl grey. The stripes run from near black in the troughs (Oklab lightness 0.10) to the crest (0.88, chroma 0.16 at most), and between red and green the lower middle of the ramp is lifted by up to 0.19 of lightness so an orange is not brown, while the black at the bottom stays black.
// Knob 2: Flow. The clock. The model time per panel second is set so that the front of an invader runs along its own roll normal at 1.25 LEDs a second per unit of Flow at the opening Rotation: 0.63 LEDs a second at 0.5, 2.5 at the opening 2, 3.75 at 3. A wall whose normal makes an angle with the invader's roll normal runs slower, as the cosine of that angle. Measured over 900 s at the opening, a point of the panel changes its dominant orientation every 7.1 s on average (the 10th to 90th percentile is 4 to 10 s, the longest 102 s), so it sees the same orientation again after about 21 s. At Flow 0.5 with Scale and Rotation at their minimum the mean is 35 s, and at Flow 3 with both at their maximum 4.2 s.
// Knob 3: Scale. The roll wavelength, lam = 7 times 1.25 to the Scale LEDs: 5.6 at -1, 7.0 at 0, 8.75 at 1. The mean wavelength of the drawn field, from its spectrum, is 5.65, 7.06 and 8.82 LEDs (0.991 of the model's 2 pi / q0 each time), which is 11.3, 9.1 and 7.3 rolls across the 64 LEDs. The box holds fewer wavelengths as Scale rises, so there are fewer domains: the mean number in view (a connected patch of at least 40 square LEDs where one orientation holds more than half of the intensity) is 13.1, 9.7 and 7.7 at Scale -1, 0 and 1. The top is 1 because at 9.15 LEDs with Rotation at its minimum, one run in eight (seed 7) fell under the recur line, 0.38: the panel then holds few, large domains, and two frames 20 s apart can match.
// Knob 4: Rotation. How far above the Kuppers-Lortz threshold, a = 1 - g(-)/g(0) = 0.32 times 1.58 to the Rotation: 0.20 at -1, 0.33 at the opening, 0.51 at 1. An invader grows into its predecessor at the rate eps a, 0.061, 0.099 and 0.152 per time unit, and the predecessor dies at eps mu a, 0.15, 0.25 and 0.38. The walls run as the square root of a, 0.80, 1.01 and 1.26 of the Flow value. At Flow 2 the mean wait for a point to change orientation is 11.2, 7.1 and 5.1 s and the mean number of domains 8.8, 9.7 and 10.9: at -1 the domains are large and give way slowly, at 1 they are smaller and turn over quickly.
//
// What the field is. Three complex amplitudes A_0, A_1, A_2 on a torus 64 LEDs wide and 128 tall are the envelopes of three sets of rolls whose wave vectors n_j are 120 degrees apart (the first 17.2 degrees from the panel's x axis, toward +y), so their stripes are 60 degrees apart. The convection field, the temperature or the vertical velocity at mid depth, is u = sum over j of A_j exp(i q0 n_j . x) + the complex conjugate, and the panel draws u. In units where q0 = 1 (one model length is lam / 2 pi LEDs, 0.89, 1.11 and 1.39 LEDs at lam 5.6, 7 and 8.75) and the time is the relaxation time of the rolls, each envelope obeys
//   d_t A_j = eps A_j + (n_j . grad - (i / 2) lap)^2 A_j - A_j (|A_j|^2 + g(+) |A_j+1|^2 + g(-) |A_j-1|^2)   (j mod 3)
// with eps = 0.3, g(0) = 1, g(-) = 1 - a, g(+) = 1 + mu a and mu = (g(+) - g(0)) / (g(0) - g(-)) = 2.5. The first two terms are the growth of rolls above onset and the diffusion of their envelope along the roll normal, which for a plane wave off q0 by k gives the growth rate eps - (n . k + k^2 / 2)^2. The cubic terms are the saturation and the competition of the three sets. With g(-) below g(0) a set grows into a domain of the set before it at the rate eps a, and with g(+) above g(0) it kills the set after it: orientation j+1 invades j, so amber gives way to teal, teal to orchid and orchid to amber for ever. This is the Kuppers-Lortz instability as Busse and Heikes put it, rolls unstable to rolls turned by about 58 degrees, here exactly 60 because the three orientations are fixed. For mu above 1 the cycle of three uniform states attracts in the amplitude equations without space, and without noise the dwell in each state grows without limit. In space it cannot: the walls between domains carry the invader into the next domain, and the domains chase one another. There is nothing else in the equations: no mean flow, no forcing, no change of eps in space or time.
// Three choices that are not in the textbook form. The operator uses the whole Laplacian where Newell, Whitehead and Segel have only the part along the rolls, which is the Swift-Hohenberg symbol exactly: the marginal curve of a set is then the circle |q0 n + k| = q0 and not the parabola k_n = -k_t^2 / 2, which never closes and keeps wide transverse modes at growth rate eps. The amplitudes are cut at |k| = 0.8 q0, which keeps each set to about 47 degrees either side of its roll normal and leaves the gaps between the three cones empty (527, 343 and 213 modes at lam 5.6, 7 and 8.75). And white noise of strength 0.035 per square root of model time on the 2 by 2 LED grid is added to the retained modes: thermal noise, which seeds the set that is not there so a wall does not wait for round-off.
// Why mu = 2.5 and noise 0.035, found by running (open knobs, Flow 3, 400 s, a frame every 10 s; the largest share of the intensity at a cell is 1 for one orientation alone and 0.33 for three equal ones). mu 1.25: share 0.50, the panel sits in the mixed state where all three sets hold everywhere at eps / (1 + g(+) + g(-)) and there are no domains to see; 1.6: 0.62; 2.5: 0.71; 4: 0.77. Noise 0: 7.4 domains, share 0.75; 0.035: 11.2 and 0.71; 0.06: 18.9 and 0.66, a plaid of grey with no orientation in charge. The noise does not keep the picture alive: with noise 0 the open knobs still show 7.7 domains after 900 s and a point still changes orientation every 7.2 s. It raises the number of domains by a quarter to a half.
// The torus. The amplitudes are periodic over 64 by 128 LEDs. The carrier is not, so the stripes jump in phase across the edge where the torus closes, and no two neighbouring LEDs lie on both sides of it. The carrier phase is counted from the centre of the panel, so a turn of Scale stretches the stripes about the centre while the domains stay where they are.
// How it is solved. The envelopes live on a grid of 32 by 64 cells of 2 by 2 LEDs, as complex arrays. One step of h model time units is a symmetric splitting: half a step of the local terms, the linear part exactly in Fourier space (multiplication by exp(-h (n_j . k + k^2 / 2)^2), the noise added to the modes there), and half a step of the local terms. The local terms keep each phase and change only the intensities I_j, d_t I_j = 2 I_j (eps - I_j - g(+) I_j+1 - g(-) I_j-1); they are solved by a midpoint rule on the log of the growth over the half step, point by point. The step is at most 0.5 and in practice 0.07 to 0.23 (the model time the clock runs is 3.6 a second at the opening and up to 6.8 at Flow 3 with lam 5.6). The linear part damps everything above the cut, so no stiffness limits the step. Before the first frame the model runs 300 time units from smooth random amplitudes of half of sqrt(eps) (0.3 s).
// The picture. The Fourier spectrum of each envelope is padded with zeros to the LED grid, which is exact for an envelope with no modes above 0.8 q0, and u is summed at each LED from the three envelopes and the carriers, which are built along each row by turning a unit vector one LED at a time. Tone is 0.5 + 0.5 tanh(1.5 u / (2 sqrt(eps))), so a single domain at full amplitude goes from 0.05 to 0.95 and where the amplitude drops, in a wall or at a dislocation, the stripes fade. Colour is from the weights I_j^2 / sum I^2 of the three orientations: the weights pull the hue toward the sets' colours, and their sum on the colour wheel has length 1 in one set's domain and 0 where all three are equal, which sets how much of the pearl grey is mixed in as its square. Walls are therefore pale plaids where two sets cross, and a mixture of amber and teal is not left to turn olive.
//
// Checks, each run on this file (a harness that imports the file and reads its state; the numbers are for lam 7 and a = 0.3 unless said).
// 1. Saturation. A uniform A_0 grown from 1e-6 reaches |A_0|^2 / eps = 1.00000000 in 100 time units. A plane wave 0.153 off q0 along its normal (Lambda = 0.02973) must reach eps - Lambda = 0.270274, and reaches 0.270257, 0.270271, 0.270273 and 0.270274 at h 0.5, 0.25, 0.1 and 0.05: errors 1.7e-5, 3.0e-6, 3.7e-7 and 8.3e-8, second order in h. In the chaotic state, in the cells where one orientation holds more than 90 percent of the intensity (11 to 17 percent of the panel), the mean intensity is 0.86 to 0.89 eps, |A| = 0.93 to 0.94 sqrt(eps): the rolls sit off q0 inside the Eckhaus band, and the other two sets are not zero.
// 2. The coupling and its direction. In a domain of orientation 2 with 1e-7 of the other two, the growth of A_0 is 0.0900 a time unit against eps a = 0.0900, and the decay of A_1 is -0.2250 against -eps mu a = -0.2250. Orientation 0 invades 2, which is j invades j-1.
// 3. Front speed. A band of one set spreading into its predecessor (the amplitudes depend on one coordinate only), the two edges of the band at the crossing of eps / 2, in model lengths per time unit. The pulled front of the linear equation d_t B = eps a B - (c k + k^2 / 2)^2 B, c the cosine between the roll normal and the front normal, has the speed of the complex saddle of its dispersion relation, 0.628 for c = -0.975 and 0.493 for c = 0.680; the leading estimate 2 |c| sqrt(eps a) gives 0.585 and 0.408. The edges move at 0.567 and 0.444 after 77 time units (0.537 and 0.417 at 47), still climbing, as a pulled front does, by 3 / (2 kappa t); the fit v(t) = v* - 3 / (2 kappa t) through the windows at 47, 62 and 77 gives 0.62 and 0.49, within 2 and 1 percent of the saddle. The two edges of a band run at the same speed to three places, and a cut at 1.5 instead of 0.8 q0 changes nothing. For fronts nearly along the rolls (|c| = 0.22 and 0.30) 36 time units are too few: 0.15 and 0.19 against 0.36 and 0.37. In LEDs a second the clock gives 1.25 |c| sqrt(a / 0.32) per unit of Flow, which for the two bands above is 1.18 and 0.82 against the 1.14 and 0.90 measured at 77 time units.
// 4. Wavelength. The mean |Q| of the spectrum of the drawn field, over 60 frames 5 s apart, is 0.991, 0.992 and 0.992 q0 at lam 5.6, 7 and 8.75 (the spread over frames 0.006 to 0.008), the spectral peak 0.988, 0.991 and 0.981.
// 5. Domains over 900 s at the opening, a sample every 0.5 s (seed 1; seeds 2 and 3 give 9.3 and 10.2). Domains in view: mean 9.7, 3 to 20. Zeros of an envelope inside its own domain, which are the dislocations of the rolls: mean 4.7, 0 to 13. Dwell of a point in one orientation (a new orientation must hold 60 percent): 7.1 s mean, 16.1 thousand dwells, in 5 s bins 3273, 11150, 1031, 180, 220, 106, 37 and 89 (35 s and over), the longest 102 s. Scale -1, Rotation -1, Flow 0.5: 13.4 domains, dwell 35 s. Scale 1, Rotation 1, Flow 3: 8.7 domains, dwell 4.2 s. Scale 1, Rotation -1, Flow 2: 6.7 domains (2 to 17), 1.4 dislocations, dwell 14 s.
// 6. The step. At the opening a step of at most 0.1 gives 9.2 domains and a dwell of 7.2 s over 900 s, against 9.7 and 7.1 for 0.5.
// 7. Dealiasing. The coupling term A_j (|A_j|^2 + ...) on the 32 by 64 grid against the same on the 64 by 128 grid, relative rms difference over the retained modes of a developed state: 1.2e-3 at lam 5.6, 7.8e-5 at 7 and 2.5e-7 at 8.75. The cut at 0.8 q0 is under half the Nyquist wavenumber (lam / 4) for lam above 6.4, and at 5.6 it is 0.57 of it.
// Not checked: the coefficients g(+) and g(-) of a real fluid, which I do not remember (mu 2.5 and a from 0.2 to 0.5 are chosen by the look, not taken from Rayleigh-Benard values); the domain sizes and lifetimes of the experiments, which I do not remember either; the amplitude equations beyond eps = 0.3 and for walls that are one wavelength wide, where they are not asymptotic; climbing of dislocations, which the model has only through the phase of the envelope; the real Kuppers-Lortz angle of about 58 degrees, which the three fixed orientations make 60; and a box much larger than 7 to 11 wavelengths, where there would be more domains than here.
//
// What the picture adds that is not in the equations. The tone map and the colours, with the lift of the warm hues. The clock of Flow. The maps from the knobs to lam and a. The 300 time units run before the first frame. The file is about 30 KB, 13 KB of it code and the rest this header.

const W = 64, H = 128, N = W * H;
const GW = 32, GH = 64, GN = GW * GH; // the amplitudes live on a grid of 2 by 2 LEDs
const { ceil, max, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const CFG = {
  eps: 0.3, // distance above onset
  mu: 2.5, // (g(+) - g(0)) / (g(0) - g(-))
  a0: 0.32, // 1 - g(-) / g(0) at Rotation 0
  ar: 1.58, // and the ratio per unit of Rotation
  lam0: 7, // roll wavelength in LEDs at Scale 0
  lamr: 1.25, // and the ratio per unit of Scale
  kc: 0.8, // the amplitudes are cut at this wavenumber, in units of q0
  noise: 0.035, // white noise per square root of model time, on the 2 by 2 LED grid, in the retained modes
  hmax: 0.5, // longest step, model time
  v1: 1.25, // LEDs a second the front of an invader runs along its own roll normal at Flow 1 and Rotation 0
  pre: 300, // model time run before the first frame
  theta0: 0.3, // direction of the first wave vector, radians from the x axis toward +y
};

// ---- Fourier transforms (radix-2, first two stages as radix-4) -----------------------------
function plan(n) {
  const sw = [], tw = new Float64Array(2 * n);
  let lg = 0;
  while (1 << lg < n) lg++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    if (r > i) sw.push(i, r);
  }
  for (let h = 1; h < n; h <<= 1)
    for (let k = 0; k < h; k++) {
      tw[2 * (h - 1 + k)] = cos((PI * k) / h);
      tw[2 * (h - 1 + k) + 1] = -sin((PI * k) / h);
    }
  return { n, sw: Int32Array.from(sw), tw };
}

function fft1(re, im, o, P) {
  const n = P.n, sw = P.sw, tw = P.tw;
  for (let p = 0; p < sw.length; p += 2) {
    const i = o + sw[p], j = o + sw[p + 1];
    let t = re[i];
    re[i] = re[j];
    re[j] = t;
    t = im[i];
    im[i] = im[j];
    im[j] = t;
  }
  for (let a = o; a < o + n; a += 4) {
    const x0r = re[a], x0i = im[a], x1r = re[a + 1], x1i = im[a + 1];
    const x2r = re[a + 2], x2i = im[a + 2], x3r = re[a + 3], x3i = im[a + 3];
    const t0r = x0r + x1r, t0i = x0i + x1i, t1r = x0r - x1r, t1i = x0i - x1i;
    const t2r = x2r + x3r, t2i = x2i + x3i, t3r = x2r - x3r, t3i = x2i - x3i;
    re[a] = t0r + t2r;
    im[a] = t0i + t2i;
    re[a + 2] = t0r - t2r;
    im[a + 2] = t0i - t2i;
    re[a + 1] = t1r + t3i;
    im[a + 1] = t1i - t3r;
    re[a + 3] = t1r - t3i;
    im[a + 3] = t1i + t3r;
  }
  for (let half = 4; half < n; half <<= 1) {
    const len = half << 1, w0 = 2 * (half - 1);
    for (let s = o; s < o + n; s += len)
      for (let k = 0; k < half; k++) {
        const a = s + k, b = a + half, c = tw[w0 + 2 * k], d = tw[w0 + 2 * k + 1];
        const br = re[b], bi = im[b], xr = br * c - bi * d, xi = br * d + bi * c, ar = re[a], ai = im[a];
        re[b] = ar - xr;
        im[b] = ai - xi;
        re[a] = ar + xr;
        im[a] = ai + xi;
      }
  }
}

// A complex 2D transform of a gw x gh array, row-major. inv = true is unnormalised.
function fft2set(gw, gh) {
  const PW = plan(gw), PH = plan(gh), CR = new Float64Array(gh), CI = new Float64Array(gh);
  return (re, im, inv) => {
    for (let y = 0; y < gh; y++) (inv ? fft1(im, re, y * gw, PW) : fft1(re, im, y * gw, PW));
    for (let x = 0; x < gw; x++) {
      for (let y = 0, p = x; y < gh; y++, p += gw) {
        CR[y] = re[p];
        CI[y] = im[p];
      }
      if (inv) fft1(CI, CR, 0, PH);
      else fft1(CR, CI, 0, PH);
      for (let y = 0, p = x; y < gh; y++, p += gw) {
        re[p] = CR[y];
        im[p] = CI[y];
      }
    }
  };
}
const FG = fft2set(GW, GH), FL = fft2set(W, H);

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- the state -----------------------------------------------------------------------------
// The wave vector of each set of rolls, 120 degrees apart.
const OPEN = [0, 2, 0, 0.06];
const lamOf = (s) => CFG.lam0 * pow(CFG.lamr, cl(s, -1, 1));
const aOf = (s) => CFG.a0 * pow(CFG.ar, cl(s, -1, 1));

const DIR = [0, 1, 2].map((j) => [cos(CFG.theta0 + (TAU * j) / 3), sin(CFG.theta0 + (TAU * j) / 3)]);

function start(params, k) {
  const vec = () => new Float64Array(GN);
  const S = {
    ar: [vec(), vec(), vec()], ai: [vec(), vec(), vec()],
    tr: vec(), ti: vec(),
    E: [vec(), vec(), vec()], eh: -1, lam: -1,
    kx: vec(), ky: vec(),
    keep: new Int32Array(GN), nk: 0,
    lam: -1, a: 0, t: 0, hue: 0,
    gp: 0, gm: 0,
  };
  params.s = S;
  prepare(S, lamOf(k[2]), aOf(k[3]));
  // A smooth random start: random complex coefficients on the modes under 0.5 q0, scaled to an rms of half of sqrt(eps).
  for (let j = 0; j < 3; j++) {
    for (let q = 0; q < GN; q++) {
      S.tr[q] = 0;
      S.ti[q] = 0;
    }
    for (let jy = 0; jy < GH; jy++)
      for (let jx = 0; jx < GW; jx++) {
        const q = jy * GW + jx;
        const kk = sqrt(S.kx[q] * S.kx[q] + S.ky[q] * S.ky[q]);
        if (kk > 0.5) continue;
        S.tr[q] = gauss();
        S.ti[q] = gauss();
      }
    FG(S.tr, S.ti, true);
    let m = 0;
    for (let q = 0; q < GN; q++) m += S.tr[q] * S.tr[q] + S.ti[q] * S.ti[q];
    m = sqrt(m / GN);
    for (let q = 0; q < GN; q++) {
      S.ar[j][q] = (0.5 * sqrt(CFG.eps) * S.tr[q]) / m;
      S.ai[j][q] = (0.5 * sqrt(CFG.eps) * S.ti[q]) / m;
    }
  }
  advance(S, CFG.pre, CFG.hmax);
}

function prepare(S, lam, a) {
  S.a = a;
  S.gm = 1 - a;
  S.gp = 1 + CFG.mu * a;
  if (lam === S.lam) return;
  S.lam = lam;
  for (let jy = 0; jy < GH; jy++)
    for (let jx = 0; jx < GW; jx++) {
      const m = jx < GW / 2 ? jx : jx - GW, n = jy < GH / 2 ? jy : jy - GH;
      S.kx[jy * GW + jx] = (lam * m) / 64;
      S.ky[jy * GW + jx] = (lam * n) / 128;
    }
  S.eh = -1;
  let c = 0;
  for (let q = 0; q < GN; q++) if (S.kx[q] * S.kx[q] + S.ky[q] * S.ky[q] <= CFG.kc * CFG.kc) S.keep[c++] = q;
  S.nk = c;
}

function linear(S, h) {
  if (S.eh === h) return;
  S.eh = h;
  const norm = 1 / GN;
  for (let j = 0; j < 3; j++)
    for (let q = 0; q < GN; q++) {
      const kx = S.kx[q], ky = S.ky[q], k2 = kx * kx + ky * ky;
      if (k2 > CFG.kc * CFG.kc) {
        S.E[j][q] = 0;
        continue;
      }
      const s = DIR[j][0] * kx + DIR[j][1] * ky + 0.5 * k2;
      S.E[j][q] = exp(-h * s * s) * norm;
    }
}

// pointwise: A_j' = A_j (eps - |A_j|^2 - g+ |A_j+1|^2 - g- |A_j-1|^2)
function local(S, tau) {
  const { ar, ai, gp, gm } = S, e = CFG.eps;
  const a0 = ar[0], b0 = ai[0], a1 = ar[1], b1 = ai[1], a2 = ar[2], b2 = ai[2];
  for (let q = 0; q < GN; q++) {
    const i0 = a0[q] * a0[q] + b0[q] * b0[q], i1 = a1[q] * a1[q] + b1[q] * b1[q], i2 = a2[q] * a2[q] + b2[q] * b2[q];
    const r0 = e - i0 - gp * i1 - gm * i2, r1 = e - i1 - gp * i2 - gm * i0, r2 = e - i2 - gp * i0 - gm * i1;
    const h = 0.5 * tau;
    const j0 = i0 * exp(2 * h * r0), j1 = i1 * exp(2 * h * r1), j2 = i2 * exp(2 * h * r2);
    const s0 = e - j0 - gp * j1 - gm * j2, s1 = e - j1 - gp * j2 - gm * j0, s2 = e - j2 - gp * j0 - gm * j1;
    const f0 = exp(tau * s0), f1 = exp(tau * s1), f2 = exp(tau * s2);
    a0[q] *= f0;
    b0[q] *= f0;
    a1[q] *= f1;
    b1[q] *= f1;
    a2[q] *= f2;
    b2[q] *= f2;
  }
}

function step(S, h) {
  linear(S, h);
  local(S, 0.5 * h);
  const { tr, ti, keep, nk } = S;
  const sn = (CFG.noise * sqrt(h)) / sqrt(GN);
  for (let j = 0; j < 3; j++) {
    const ar = S.ar[j], ai = S.ai[j], E = S.E[j];
    tr.set(ar);
    ti.set(ai);
    FG(tr, ti, false);
    for (let q = 0; q < GN; q++) {
      tr[q] *= E[q];
      ti[q] *= E[q];
    }
    if (sn > 0)
      for (let c = 0; c < nk; c++) {
        const q = keep[c];
        tr[q] += sn * gauss();
        ti[q] += sn * gauss();
      }
    FG(tr, ti, true);
    ar.set(tr);
    ai.set(ti);
  }
  local(S, 0.5 * h);
  S.t += h;
}

function advance(S, Ht, hmax) {
  const n = max(1, ceil(Ht / hmax - 1e-9)), h = Ht / n;
  for (let i = 0; i < n; i++) step(S, h);
}

export function setup(params) {
  start(params, OPEN);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  prepare(S, lamOf(k[2]), aOf(k[3]));
  const ell = S.lam / TAU, tps = (CFG.v1 * cl(k[1], 0.5, 3)) / (2 * sqrt(CFG.eps * CFG.a0) * ell);
  advance(S, ft * tps, CFG.hmax);
  // Never reached in the runs in the header. If the amplitudes ever went bad, start over.
  if (!(abs(S.ar[0][0] + S.ai[1][GN >> 1] + S.ar[2][GN >> 2]) < 10)) {
    params.s = null;
    update(dt, input, params);
  }
}

// ---- colour --------------------------------------------------------------------------------
function okRgb(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r;
      out[1] = g;
      out[2] = bb;
      return;
    }
  }
}
const enc = (v) => {
  v = cl(v, 0, 1);
  return (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255;
};
const RGB = [0, 0, 0];

const HUE0 = 75; // Oklab hue of orientation 0 at Knob 1 = 0, degrees
const NT = 128;
function buildLut(S, hue) {
  S.lutHue = hue;
  if (!S.lut) S.lut = new Float64Array(4 * NT * 3);
  for (let j = 0; j < 4; j++) {
    const h = HUE0 + 120 * j + 360 * hue, grey = j === 3;
    for (let i = 0; i < NT; i++) {
      const t = i / (NT - 1);
      let L = 0.1 + 0.78 * pow(t, 0.9);
      const C = 0.16 * sm(0.03, 0.55, t) * (1 - 0.35 * sm(0.75, 1, t));
      // A dark orange or olive is brown on the panel: between red and green the lower middle of the ramp is lifted, and the black at the bottom is not.
      if (!grey) L += max(0, 1 - abs(((h - 80 + 540) % 360) - 180) / 70) * sm(0.1, 0.3, L) * max(0, 0.62 - L) * 0.6;
      okRgb(L, grey ? 0 : C, h, RGB);
      const o = (j * NT + i) * 3;
      S.lut[o] = enc(RGB[0]);
      S.lut[o + 1] = enc(RGB[1]);
      S.lut[o + 2] = enc(RGB[2]);
    }
  }
}

const PR = [new Float64Array(N), new Float64Array(N), new Float64Array(N)], PI_ = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];

// A_j on the LEDs by zero padding the spectrum of the grid
function upsample(S) {
  const { tr, ti } = S;
  for (let j = 0; j < 3; j++) {
    tr.set(S.ar[j]);
    ti.set(S.ai[j]);
    FG(tr, ti, false);
    const re = PR[j], im = PI_[j];
    re.fill(0);
    im.fill(0);
    const sc = 1 / GN;
    for (let jy = 0; jy < GH; jy++) {
      const m = jy < GH / 2 ? jy : jy - GH, Y = (m + H) % H;
      for (let jx = 0; jx < GW; jx++) {
        const n = jx < GW / 2 ? jx : jx - GW, X = (n + W) % W;
        if (jx === GW / 2 || jy === GH / 2) continue;
        re[Y * W + X] = tr[jy * GW + jx] * sc;
        im[Y * W + X] = ti[jy * GW + jx] * sc;
      }
    }
    FL(re, im, true);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.hue, 0, 1);
  if (S.lutHue !== hue || !S.lut) buildLut(S, hue);
  upsample(S);
  const q = TAU / S.lam, lut = S.lut, ref = 1.5 / (2 * sqrt(CFG.eps));
  const [d0, d1, d2] = DIR;
  const dc0 = cos(q * d0[0]), ds0 = sin(q * d0[0]), dc1 = cos(q * d1[0]), ds1 = sin(q * d1[0]), dc2 = cos(q * d2[0]), ds2 = sin(q * d2[0]);
  const A0r = PR[0], A0i = PI_[0], A1r = PR[1], A1i = PI_[1], A2r = PR[2], A2i = PI_[2];
  for (let y = 0; y < H; y++) {
    // the carrier of each orientation along the row, by rotating a unit vector one LED at a time
    const yy = y - 63.5;
    let p0 = q * (-31.5 * d0[0] + yy * d0[1]), p1 = q * (-31.5 * d1[0] + yy * d1[1]), p2 = q * (-31.5 * d2[0] + yy * d2[1]);
    let c0 = cos(p0), s0 = sin(p0), c1 = cos(p1), s1 = sin(p1), c2 = cos(p2), s2 = sin(p2);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const a0 = A0r[p], b0 = A0i[p], a1 = A1r[p], b1 = A1i[p], a2 = A2r[p], b2 = A2i[p];
      const U = 2 * (a0 * c0 - b0 * s0 + a1 * c1 - b1 * s1 + a2 * c2 - b2 * s2);
      const i0 = a0 * a0 + b0 * b0, i1 = a1 * a1 + b1 * b1, i2 = a2 * a2 + b2 * b2;
      const w0 = i0 * i0, w1 = i1 * i1, w2 = i2 * i2, inv = 1 / (w0 + w1 + w2 + 1e-12);
      const t = 0.5 + 0.5 * tanh(U * ref), i = (t * (NT - 1)) | 0;
      // the length of the three weights summed on the colour wheel: 1 in one orientation's domain, 0 where all three are equal
      const vx = (w0 - 0.5 * (w1 + w2)) * inv, vy = 0.8660254 * (w1 - w2) * inv, m = vx * vx + vy * vy;
      const o0 = i * 3, o1 = (NT + i) * 3, o2 = (2 * NT + i) * 3, o3 = (3 * NT + i) * 3, f0 = w0 * inv * m, f1 = w1 * inv * m, f2 = w2 * inv * m, f3 = 1 - m;
      display.setPixel(
        x,
        y,
        (lut[o0] * f0 + lut[o1] * f1 + lut[o2] * f2 + lut[o3] * f3 + 0.5) | 0,
        (lut[o0 + 1] * f0 + lut[o1 + 1] * f1 + lut[o2 + 1] * f2 + lut[o3 + 1] * f3 + 0.5) | 0,
        (lut[o0 + 2] * f0 + lut[o1 + 2] * f1 + lut[o2 + 2] * f2 + lut[o3 + 2] * f3 + 0.5) | 0,
      );
      let t0 = c0 * dc0 - s0 * ds0;
      s0 = s0 * dc0 + c0 * ds0;
      c0 = t0;
      t0 = c1 * dc1 - s1 * ds1;
      s1 = s1 * dc1 + c1 * ds1;
      c1 = t0;
      t0 = c2 * dc2 - s2 * ds2;
      s2 = s2 * dc2 + c2 * ds2;
      c2 = t0;
    }
  }
}
