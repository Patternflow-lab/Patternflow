// ===== Patternflow pattern =====
// Title:   Dopplergram
// Family:  helioseismology
// Idea:    Two discs of the Sun, one seen from the side and one from above the pole, are covered in soft blue and red patches that are the line-of-sight speed of a sum of a hundred ringing acoustic modes, each patch breathing from approach to recession in a few seconds while the patterns slide round the sphere and swell and fade as the modes beat against each other.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the five-minute oscillations of the Sun (Robert Leighton, Robert Noyes and George Simon, 1962), trapped acoustic modes (Roger Ulrich, 1970; Leibacher and Stein, 1971) and the Dopplergram maps of SOHO/MDI (1996) and SDO/HMI (2010), pattern round 223
// Round:   223
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Time=0..4, Grain=-1..1, Kick=-1..1
//
// Knob 1: Hue. Turns the diverging pair of colours along a path of three pairs, each dwelling a little where it is. At 0, where it opens, the approaching patches run from deep indigo through blue to pale cyan and the receding ones from rust through red-orange to pale gold. At 0.28 it is teal against crimson with orange peaks, at 0.62 violet against amber and gold, and at 1 it is back at blue and red. The glow at the limb follows the pair.
// Knob 2: Time. How fast the Sun rings. The pace goes as 0.35 times 8 to the power of Time over 4: 0.35 at 0, 1 at 2 (the opening) and 2.8 at 4, and it speeds the oscillations and the fading of every mode together. At 2 a patch breathes from blue to red and back every 3 s (the fine ones) to 7.5 s (the broad ones), and a mode's amplitude falls by a factor e in 18 s, between 8 and 45 s from mode to mode. At 0 the periods are 8.5 to 21 s and the lifetimes about 50 s. At 4 they are 1.1 to 2.7 s and 6 s. The oscillators go on from where they are, so a turn shows within half a second.
// Knob 3: Grain. The size of the patches, which is the harmonic degree l the modes are drawn from. The middle degree is 9 at 0 (the opening), 4.1 at -1 and 17.5 at 1, and the modes within a factor of about 1.4 of it count most. At -1 about 34 modes with l from 2 to 10 give four or five lobes to a disc, 10 to 40 LEDs across. At 0 about a hundred modes with l from 4 to 22 give patches mostly 8 to 16 LEDs across. At 1 about 110 modes with l from 8 to 26 give a fine granulation 4 to 8 LEDs across. The total energy is held the same whatever the degree, so the brightness does not jump.
// Knob 4: Kick. How hard the Sun is struck, as contrast and as the speed the patterns are carried round. The colours are scaled by 2 to the power of 0.75 times (Kick minus 0.06): 0.58 at -1, where the discs are dim and the patches only reach rust and indigo, 1 at the opening, and 1.63 at 1, where most of the disc is strongly coloured and the peaks run to pale cyan and gold. The rotation of the whole pattern, the splitting between modes, is 0.3 times ((Kick + 1) / 2) squared radians a second at Time 2: none at -1, 0.084 (4.8 degrees a second, 2.6 LEDs a second across the middle of the side view) at the opening and 0.3 (17 degrees a second) at 1, and it goes with Time.

// What the picture is. The panel holds two views of one sphere, each a disc 62.6 LEDs across, at (32, 32) and (32, 96) with dark sky round them. The upper disc is the Sun seen from a point 12 degrees north of its equator, and the lower is the same Sun seen from 72 degrees north, nearly over the pole, so the same waves that slide sideways above turn like a pinwheel below. What is drawn is the speed along the line of sight at every point of the visible face: blue where the surface comes toward us, red where it goes away, near-black where it is still, as in a Dopplergram of SOHO or SDO with the Sun's own rotation taken out.
// The speed is a sum of acoustic modes. The bank holds 135 modes, 3 to 8 for every degree l from 2 to 26, each with an azimuthal order m picked from -l to l (spread evenly, with jitter, so both signs are there at every degree). A mode is a complex amplitude a obeying da = -(g + i w) a dt + a random kick, with the kick drawn from Math.random, stepped in its exact form a(t + dt) = a(t) exp(-(g + i w) dt) + noise that keeps the variance of a at 1 whatever the step. Its frequency is w = w_l + m times the rotation, the splitting of a rotating star, with w_l growing a little with l (period 5.3 to 7.5 s at l = 3, 3.4 to 4.1 s at l = 20 and 3 to 3.6 s at l = 26, at Time 2). The picture is the real part of the sum of a_k Y_l^m(theta, phi) over the modes, with the spherical harmonic scaled to a mean square of 1 over the sphere. A mode with m above 0 is a wave running east round the sphere at w over m, one with m below 0 runs west, so the face is crossed by patches that slide both ways at once, the broad ones fast and the fine ones slowly, and added to them is the rotation, which carries everything east. The tables of Y at the 6488 LEDs of the two discs are made once, from the orthonormal Legendre recurrence and a rotation of each LED's point on the sphere into the body frame, and the frame costs about 100 modes times 6500 LEDs times two multiplies.
// Grain weights the modes by a window in ln(l) of width 0.36 round the middle degree, and the weights are scaled so their squares add to 1. The picture is then divided by the root mean square of what each disc shows, followed over 6 s, so a strong stretch of the oscillators neither washes the disc out nor does a weak one leave it flat. Kick's gain comes after that division, so the division does not take it back. The field is then bent by x over (1 + |x| to the 2.2) to the power 1 over 2.2 to a value from -1 to 1 and read off a diverging colour table: ground, deep indigo, blue, azure, pale cyan on one side and ground, rust, red-orange, amber, pale gold on the other. The signal is weighted toward the limb by a smoothstep of the cosine of the angle to the line of sight, as the line-of-sight share of a radial motion is, so the foreshortened strips at the rim fade out instead of crowding into 1-LED fringes. The disc is darkened toward the limb to 50%, and a warm rim about 3 LEDs wide and a glow outside carry the colour of the patch beside them, so the sky near the limb ripples faintly with the surface.
// Nothing is restarted when a knob moves. Time and the rotation change the phase each mode advances in a step, Grain changes only the weights, and each is followed over 0.3 to 0.45 s. The amplitudes start from their stationary draw, so the first frame already shows a mixed sky, and the variance is steady for as long as it runs.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, log, sin, cos, atan2, PI, min, max, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());

// ---- the two discs
const R = 31.3; // LEDs
const CX = 32;
const CY = [32, 96];
const LAT = [(12 * PI) / 180, (72 * PI) / 180]; // latitude of the point facing us: nearly the equator, and nearly the pole
const EDGE = 0.8; // LEDs past the radius that still get a share of the disc

// ---- the modes
const LMIN = 2, LMAX = 26, LS = LMAX + 1;
const L_REF = 9; // the middle degree at Grain 0
const L_LOW = 2.2, L_HIGH = 1.95; // Grain -1 divides the middle degree by L_LOW, Grain 1 multiplies it by L_HIGH
const L_WIDTH = 0.36; // width of the degree window, in natural log of l
const W_FLOOR = 0.04; // a mode with less weight than this is left out of the sum
const OM_BASE = 0.7, OM_SLOPE = 0.04, OM_SPREAD = 0.35; // rad/s at Time 2
const LIFE = 18; // seconds a mode's amplitude takes to fall by e, at Time 2
const OM_ROT = 0.3; // rad/s, rotation of the pattern at Kick 1
const K_GAIN = 0.5;

// Legendre recurrence coefficients (orthonormal on the sphere, scaled so that the mean square over the sphere is 1)
const LA = new Float64Array(LS * LS), LB = new Float64Array(LS * LS);
for (let m = 0; m <= LMAX; m++) {
  for (let l = m + 2; l <= LMAX; l++) {
    LA[m * LS + l] = sqrt((4 * l * l - 1) / (l * l - m * m));
    LB[m * LS + l] = sqrt(((l - 1) * (l - 1) - m * m) / (4 * (l - 1) * (l - 1) - 1));
  }
}

function legendre(x, s, out) {
  let pmm = 1;
  for (let m = 0; m <= LMAX; m++) {
    if (m > 0) pmm *= sqrt((2 * m + 1) / (2 * m)) * s;
    const base = m * LS;
    out[base + m] = pmm;
    if (m + 1 <= LMAX) {
      let a = pmm, b = sqrt(2 * m + 3) * x * pmm;
      out[base + m + 1] = b;
      for (let l = m + 2; l <= LMAX; l++) {
        const c = LA[base + l] * (x * b - LB[base + l] * a);
        out[base + l] = c;
        a = b;
        b = c;
      }
    }
  }
}

function makeModes() {
  const modes = [];
  for (let l = LMIN; l <= LMAX; l++) {
    const n = min(2 * l + 1, 3 + floor(l / 5));
    const used = {};
    for (let j = 0; j < n; j++) {
      let m = Math.round(-l + ((j + 0.15 + 0.7 * Math.random()) * 2 * l) / n);
      m = cl(m, -l, l);
      let guard = 0;
      while (used[m] && guard++ < 60) m = m < l ? m + 1 : -l;
      used[m] = 1;
      const om = OM_BASE + OM_SLOPE * sqrt(l * (l + 1)) + OM_SPREAD * Math.random();
      const life = LIFE * exp(0.45 * gauss()) * (l < 7 ? 1.3 : l > 16 ? 0.8 : 1);
      modes.push({ l, m, om, gam: 1 / life });
    }
  }
  return modes;
}

function makeState() {
  const modes = makeModes();
  const NM = modes.length;
  // the visible LEDs of both discs
  const idx = [], disc = [], uu = [], vv = [], ww = [], ed = [];
  for (let d = 0; d < 2; d++) {
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - CY[d];
      if (abs(dy) > R + EDGE + 1) continue;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - CX;
        const r = sqrt(dx * dx + dy * dy);
        if (r > R + EDGE) continue;
        let u = dx / R, v = -dy / R;
        const rho = sqrt(u * u + v * v);
        if (rho > 0.9999) { u *= 0.9999 / rho; v *= 0.9999 / rho; }
        idx.push(y * W + x);
        disc.push(d);
        uu.push(u);
        vv.push(v);
        ww.push(sqrt(max(0, 1 - u * u - v * v)));
        ed.push(r - R);
      }
    }
  }
  const N = idx.length;
  const S = {
    ready: false, t: 0,
    modes, NM, N,
    idx: Int32Array.from(idx), disc: Uint8Array.from(disc), mu: Float32Array.from(ww), edge: Float32Array.from(ed),
    Yr: new Float32Array(NM * N), Yi: new Float32Array(NM * N),
    ar: new Float64Array(NM), ai: new Float64Array(NM), om: new Float64Array(NM), gam: new Float64Array(NM), wt: new Float64Array(NM),
    F: new Float32Array(N),
    amp: new Float32Array(N), ld: new Float32Array(N), rim: new Float32Array(N), alpha: new Float32Array(N),
    glow: new Float32Array(NPX), gsrc: new Int32Array(NPX), M: new Float32Array(N), bgr: new Float32Array(NPX * 3),
    // smoothed knobs
    sc: 1, lc: L_REF, rot: 0, gk: 1,
    rms: [1, 1], rmsInit: false,
    hue: 0, lut: new Float32Array(513 * 3), warm: [255, 180, 90], ground: [12, 6, 12], lutAt: -1,
    kn: [0, 2, 0, 0.06],
  };
  // tables of the modes at every LED
  const q = new Float64Array(LS * LS);
  const cm = new Float64Array(LS), sn = new Float64Array(LS);
  for (let k = 0; k < NM; k++) {
    S.om[k] = modes[k].om;
    S.gam[k] = modes[k].gam;
    S.ar[k] = gauss() * 0.7071;
    S.ai[k] = gauss() * 0.7071;
  }
  for (let i = 0; i < N; i++) {
    const d = S.disc[i], u = uu[i], v = vv[i], w = ww[i];
    const cb = cos(LAT[d]), sb = sin(LAT[d]);
    // body frame: z is the pole. view axes: toward us (cb, 0, sb), right (0, 1, 0), up (-sb, 0, cb)
    const px = w * cb - v * sb, py = u, pz = w * sb + v * cb;
    const s = sqrt(px * px + py * py), phi = atan2(py, px);
    legendre(cl(pz, -1, 1), s, q);
    for (let m = 0; m <= LMAX; m++) { cm[m] = cos(m * phi); sn[m] = sin(m * phi); }
    for (let k = 0; k < NM; k++) {
      const am = abs(modes[k].m), val = q[am * LS + modes[k].l];
      S.Yr[k * N + i] = val * cm[am];
      S.Yi[k * N + i] = (modes[k].m < 0 ? -1 : 1) * val * sn[am];
    }
    // the shading of the ball
    S.amp[i] = 0.1 + 0.9 * sm(0, 0.55, w);
    S.ld[i] = 1 - 0.5 * pow(1 - w, 1.3);
    const e = S.edge[i];
    S.alpha[i] = cl(0.5 - e, 0, 1);
    S.rim[i] = e <= 0 ? 0.38 * exp(e / 1.5) : 0;
  }
  // the glow outside the discs: each LED out there takes its glow from the part of the limb nearest it
  const pj = new Int32Array(NPX).fill(-1);
  for (let j = 0; j < N; j++) pj[S.idx[j]] = j;
  S.gsrc.fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let dmin = 1e9, dsel = 0;
      for (let d = 0; d < 2; d++) {
        const dx = x + 0.5 - CX, dy = y + 0.5 - CY[d], e = sqrt(dx * dx + dy * dy) - R;
        if (e < dmin) { dmin = e; dsel = d; }
      }
      if (dmin <= 0) continue;
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY[dsel], r = sqrt(dx * dx + dy * dy), k = (R - 3) / r;
      const sx = floor(CX + dx * k), sy = floor(CY[dsel] + dy * k);
      S.gsrc[y * W + x] = pj[sy * W + sx];
      S.glow[y * W + x] = 0.6 * exp(-dmin / 1.3) + 0.16 * exp(-dmin / 6);
    }
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// ---- colour
// The diverging pair as Hue turns: [knob, approach hue, recede hue] in degrees. The hues are
// continuous round the table so the pair never jumps, and each anchor is a pair worth looking at.
const PATH = [[0, 232, 8], [0.28, 188, -32], [0.62, 268, 40], [1, 232, 8]];
const HI_A = 190, HI_R = 42; // where the bright end of each side heads: pale cyan and pale gold
// [position, share of the way from the base hue toward HI, saturation, value]
const STOP_A = [[0.12, -0.33, 0.92, 0.2], [0.3, -0.14, 0.92, 0.42], [0.55, 0, 0.9, 0.68], [0.78, 0.62, 0.85, 0.9], [1, 1.1, 0.38, 1]];
const STOP_R = [[0.12, -0.1, 0.95, 0.22], [0.3, -0.05, 0.93, 0.46], [0.55, 0.16, 0.92, 0.78], [0.78, 0.7, 0.88, 0.96], [1, 1.08, 0.42, 1]];
const bump = (h, c, w) => {
  const d = abs(((h - c + 540) % 360) - 180);
  return d >= w ? 0 : 0.5 + 0.5 * cos((PI * d) / w);
};

function hsv(h, s, v, out) {
  h = ((h % 360) + 360) % 360;
  // dark yellows turn to olive and brown on a panel, so a dark stop that leans yellow is pulled back toward red
  if (v < 0.55 && h > 20 && h < 110) h -= (h - 5) * 0.8 * cl((0.55 - v) / 0.4, 0, 1) * bump(h, 55, 70);
  // greens and magentas are the loud ones
  s *= 1 - 0.2 * bump(h, 120, 50);
  v *= 1 - 0.1 * bump(h, 315, 35);
  h /= 60;
  const i = floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  let r, g, b;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  out[0] = r * 255; out[1] = g * 255; out[2] = b * 255;
}

// the pair at a knob position, eased between the anchors so each one dwells a little
function pairAt(hue) {
  let k = 0;
  while (k < PATH.length - 2 && hue > PATH[k + 1][0]) k++;
  const a = PATH[k], b = PATH[k + 1], u = sm(0, 1, (hue - a[0]) / (b[0] - a[0]));
  return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

function buildLut(S, hue) {
  const pr = pairAt(hue), ha = pr[0], hr = pr[1], tmp = [0, 0, 0], ga = [0, 0, 0], gr = [0, 0, 0];
  hsv(ha, 0.8, 0.1, ga);
  hsv(hr, 0.8, 0.1, gr);
  const g0 = [(ga[0] + gr[0]) / 2, (ga[1] + gr[1]) / 2, (ga[2] + gr[2]) / 2];
  S.ground = g0;
  const turn = (base, hi) => ((hi - base + 540) % 360) - 180; // the short way round
  const da = turn(ha, HI_A), dr = turn(hr, HI_R);
  const ramp = (stops, base, dh, t, out) => {
    if (t <= stops[0][0]) {
      hsv(base + dh * stops[0][1], stops[0][2], stops[0][3], tmp);
      const u = t / stops[0][0];
      for (let c = 0; c < 3; c++) out[c] = g0[c] + (tmp[c] - g0[c]) * u;
      return;
    }
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const a = stops[k], b = stops[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
    const ca = [0, 0, 0], cb = [0, 0, 0];
    hsv(base + dh * a[1], a[2], a[3], ca);
    hsv(base + dh * b[1], b[2], b[3], cb);
    for (let c = 0; c < 3; c++) out[c] = ca[c] + (cb[c] - ca[c]) * u;
  };
  const col = [0, 0, 0];
  for (let i = 0; i <= 512; i++) {
    const m = (i - 256) / 256;
    if (m < 0) ramp(STOP_A, ha, da, -m, col);
    else ramp(STOP_R, hr, dr, m, col);
    S.lut[i * 3] = col[0]; S.lut[i * 3 + 1] = col[1]; S.lut[i * 3 + 2] = col[2];
  }
  hsv(hr + 0.5 * dr, 0.82, 1, S.warm);
  S.lutAt = hue;
}

// ---- the oscillators
function advance(S, dt, kn) {
  S.t += dt;
  const k2 = 1 - exp(-dt / 0.3), k3 = 1 - exp(-dt / 0.45), k4 = 1 - exp(-dt / 0.4);
  const sc = 0.35 * pow(8, cl(kn[1], 0, 4) / 4);
  const gr = cl(kn[2], -1, 1), lc = L_REF * (gr < 0 ? pow(L_LOW, gr) : pow(L_HIGH, gr));
  const kick = cl(kn[3], -1, 1);
  const rot = OM_ROT * ((kick + 1) / 2) * ((kick + 1) / 2);
  const gk = pow(2, 0.75 * (kick - 0.06));
  if (!S.ready) { S.sc = sc; S.lc = lc; S.rot = rot; S.gk = gk; }
  S.sc += (sc - S.sc) * k2;
  S.lc = exp(log(S.lc) + (log(lc) - log(S.lc)) * k3);
  S.rot += (rot - S.rot) * k4;
  S.gk += (gk - S.gk) * k4;
  const dtau = S.sc * dt;
  const { NM, modes, ar, ai, om, gam } = S;
  for (let k = 0; k < NM; k++) {
    const e = exp(-gam[k] * dtau), ph = (om[k] + modes[k].m * S.rot) * dtau;
    const c = cos(ph), s = sin(ph), n = sqrt(1 - e * e) * 0.7071;
    const a = ar[k], b = ai[k];
    ar[k] = e * (a * c + b * s) + n * gauss();
    ai[k] = e * (b * c - a * s) + n * gauss();
  }
  // the weight of each mode in the degree window; normalised so the sum keeps its variance
  let tot = 0;
  for (let k = 0; k < NM; k++) {
    const z = log(modes[k].l / S.lc) / L_WIDTH;
    const w = exp(-0.5 * z * z);
    S.wt[k] = w < W_FLOOR ? 0 : w;
    tot += S.wt[k] * S.wt[k];
  }
  const nrm = 1 / sqrt(max(tot, 1e-6));
  // the field: a sum of Re[a Y] over the modes that count
  const F = S.F, N = S.N, Yr = S.Yr, Yi = S.Yi;
  F.fill(0);
  for (let k = 0; k < NM; k++) {
    const w = S.wt[k];
    if (w === 0) continue;
    const cr = w * nrm * ar[k], ci = w * nrm * ai[k], off = k * N;
    for (let i = 0; i < N; i++) F[i] += cr * Yr[off + i] - ci * Yi[off + i];
  }
  // rms of what is shown on each disc, followed slowly
  const sum = [0, 0], cnt = [0, 0], amp = S.amp, disc = S.disc;
  for (let i = 0; i < N; i++) {
    if (S.edge[i] > 0) continue;
    const f = F[i] * amp[i];
    sum[disc[i]] += f * f;
    cnt[disc[i]]++;
  }
  for (let d = 0; d < 2; d++) {
    const r = sqrt(sum[d] / max(1, cnt[d])) + 1e-4;
    if (!S.rmsInit) S.rms[d] = r;
    else S.rms[d] = exp(log(S.rms[d]) + (log(r) - log(S.rms[d])) * (1 - exp(-dt / 6)));
  }
  S.rmsInit = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  advance(S, d, kn);
  S.ready = true;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = cl(S.kn[0], 0, 1);
  if (S.lutAt !== hue) buildLut(S, hue);
  const g = S.ground, wm = S.warm, lut = S.lut;
  const N = S.N, F = S.F, amp = S.amp, ld = S.ld, rim = S.rim, alpha = S.alpha, disc = S.disc, idx = S.idx, M = S.M;
  const gl = S.glow, gs = S.gsrc;
  const scl = [K_GAIN * S.gk / S.rms[0], K_GAIN * S.gk / S.rms[1]];
  for (let j = 0; j < N; j++) {
    const x = F[j] * amp[j] * scl[disc[j]];
    M[j] = x / pow(1 + pow(abs(x), 2.2), 1 / 2.2);
  }
  // ground, and the glow round the discs tinted by the limb beside it
  const g0 = g[0] * 0.3, g1 = g[1] * 0.3, g2 = g[2] * 0.3;
  for (let i = 0; i < NPX; i++) {
    const a = gl[i];
    let r = g0, gg = g1, b = g2;
    if (a > 0 && gs[i] >= 0) {
      const o = (((M[gs[i]] + 1) * 256 + 0.5) | 0) * 3;
      r += a * (wm[0] * 0.35 + lut[o] * 0.5);
      gg += a * (wm[1] * 0.35 + lut[o + 1] * 0.5);
      b += a * (wm[2] * 0.35 + lut[o + 2] * 0.5);
    }
    S.bgr[i * 3] = r; S.bgr[i * 3 + 1] = gg; S.bgr[i * 3 + 2] = b;
  }
  for (let j = 0; j < N; j++) {
    const o = (((M[j] + 1) * 256 + 0.5) | 0) * 3, l = ld[j], rm = rim[j], al = alpha[j], i = idx[j];
    const r = lut[o] * l + wm[0] * rm, gg = lut[o + 1] * l + wm[1] * rm, b = lut[o + 2] * l + wm[2] * rm;
    S.bgr[i * 3] += (r - S.bgr[i * 3]) * al;
    S.bgr[i * 3 + 1] += (gg - S.bgr[i * 3 + 1]) * al;
    S.bgr[i * 3 + 2] += (b - S.bgr[i * 3 + 2]) * al;
  }
  const bgr = S.bgr;
  for (let i = 0; i < NPX; i++) display.setPixel(i % W, (i / W) | 0, cl(bgr[i * 3], 0, 255) | 0, cl(bgr[i * 3 + 1], 0, 255) | 0, cl(bgr[i * 3 + 2], 0, 255) | 0);
}
