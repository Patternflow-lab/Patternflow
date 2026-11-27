// ===== Patternflow pattern =====
// Title:   Step Meander
// Family:  scanprobe
// Idea:    A scanning-probe topograph of a crystal surface cut a few degrees off its plane and growing, painted row by row by a slow raster scan, in which slanted atomic terraces advance while their edges meander and bunch, adatom islands swell on the wide terraces and are swallowed by the next step, a pair of screw dislocations comes and goes, and drift, creep, row levelling and streaks print themselves on the picture in copper and gold.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: step-flow growth of a vicinal surface (Wilhelm Burton, Nicolas Cabrera and Charles Frank, 1951), spiral growth at screw dislocations (Frank, 1949), the Ehrlich-Schwoebel barrier to hopping down a step (Gert Ehrlich and F. G. Hudda, 1966; Richard Schwoebel and Edward Shipsey, 1966), step bunching for the wrong sign of the barrier (Schwoebel, 1969), the meandering instability of a growing step (Gregory Bales and Andrew Zangwill, 1990) and its Kuramoto-Sivashinsky evolution (Ioan Bena, Chaouqi Misbah and Antoine Valance, 1993; Olivier Pierre-Louis and Misbah, 1998), the elastic repulsion of steps (Vladimir Marchenko and Aleksandr Parshin, 1980). All from memory. The raster, levelling and artefacts follow how an atomic force or tunnelling microscope writes an image. The numbers, the island rule and the dislocation pair are invented for the picture.
// Round:   267
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flux=0.5..4, Miscut=-1..1, Barrier=0..1
//
// Knob 1: Hue. Turns the ramp round the wheel once over the knob's travel with the luma of every step kept: at 0 the classic copper to pale gold, at 0.17 rose, at 0.33 violet, at 0.5 sky blue, at 0.67 green, at 0.83 lime and olive, and at 1 it is copper again.
// Knob 2: Flux. How fast atoms land, so how fast the steps advance and the meanders grow: 0.5 at the minimum, 2 where it opens (a step moves 0.9 LED a second), 4 at the top (1.8 LED a second). The tip takes 11.6 s over a frame, so the steps lean 4 degrees off their true slant between the top row and the bottom row at 2 and 9 degrees at 4, and a tear shows at the scan line where last frame's rows meet this frame's.
// Knob 3: Miscut. How far the cut is off the plane, which sets the terrace width across the step: 7.7 LED at -1, 11 where it opens at 0, 15.8 at 1, so about 7 steps cross a row at -1 and 4 at 1. The steps rescale about the middle at once, and the scan runs up to five times faster for a second or two after any turn of Flux, Miscut or Barrier, so the panel repaints with the change.
// Knob 4: Barrier. How hard it is for an atom to hop down a step (the Ehrlich-Schwoebel barrier): the meander growth rate is 0.94 times the opening value at 0, 1 where it opens at 0.06, 1.6 at 0.5 and 2.6 at 1, the fastest wavelength shortens from 26 LED to 21 LED, and the cells steepen, so low barrier gives long easy swells and the top gives short, cusped, folded cells.
//
// What the picture is. The tip of a probe microscope runs along the rows, fast axis across, slow axis down, 11 rows a second, so a frame takes 11.6 s. A row is written once, at the moment the tip is on it, and stays until the next scan overwrites it. The top of the panel is older than the bottom, a surface that moves while it is scanned comes out sheared, and where the new frame meets last frame's rows (dimmed a little, with the bright tip line between) the steps are torn by the distance they moved in a frame. The surface is a vicinal crystal: terraces 8 to 16 LED wide, one atom high at each step, running about 27 degrees off vertical and rising to the right. The colour is height after the microscope's levelling: every row has its mean taken out and the mean tilt of the staircase with it, so each terrace is a sawtooth ramp, bright just above a step and dark just below the next one, a bunch of steps stands out as a brighter band, and the step edges are lit as in an error-signal image. Small bright plateaus on the wide terraces are adatom islands one atom high; each grows until the step above it reaches it and takes it in. A pair of screw dislocations of opposite hand, drawn together so that their far fields cancel, bends the terraces round two cores and holds a short extra step between them, and the pair opens, drifts and closes.
// What is modelled. About 10 to 26 steps, each a curve of 88 samples 2 LED apart, closed on itself along the step. A step advances at a rate from Burton-Cabrera-Frank: it takes (1+a)/2 of the atoms that land on the terrace in front of it and (1-a)/2 of those on the terrace behind. With a above 0 an uneven spacing is smoothed; with a below 0 steps bunch. a swings between -0.54 and 0.46 on two slow sines (173 s and 271 s), so bunches form and dissolve, and steps push each other apart with a 1/w cubed term so a bunch does not close. Along each step a Kuramoto-Sivashinsky equation, h_t = -nu h_vv - kappa h_vvvv - (lambda/2) h_v squared, with nu set by Barrier, gives the Bales-Zangwill meander: fastest wavelength 2 pi sqrt(2 kappa / nu), saturated by the nonlinear term into round bulges toward the advance and sharp notches behind. Islands nucleate where a terrace is more than 1.2 times the cut's width and grow 0.28 LED per model second. Steps leave at the bottom of the window and new ones enter at the top as shifted copies of the one that left, so the surface stays the same kind of surface for as long as it runs.
// What is not exact. The coefficients (kappa 20.6, nu 2.4, lambda 1, mean speed 0.45 LED a second at Flux 1) were set by eye and belong to no material. The meander and the bunching come from separate parameters that a real growing surface would not allow together, because bunching in growth needs the opposite sign of barrier to meandering; here a changes sign on a clock while Barrier stays put. Meander amplitude is made to go with the terrace width by scaling lambda, which is a choice. A weak damping of each step's deviation from straight (0.03 a second) keeps the longest wavelengths from taking over; the equation has no such term. The nonlinear term is that of Kuramoto-Sivashinsky, not the one Bena and others derived from the diffusion field. The dislocation pair is a phase vortex pair added to the staircase when the picture is drawn, not a step that winds in the model, and its separation, life and place are drawn at random. The island is a disk that never changes the steps around it. The slow warp of the crystal (three long waves, up to 8 LED), the drift (a shift of up to 8.5 LED and a shear of up to 2.5 degrees that wander slowly), the creep (1.8 LED at the top row, gone in 25 rows), the retrace offset (0.22 LED on every other row) and the streaks (a 9 to 22 LED stretch of two rows half smeared along, one row in 400) are plain offsets, not a model of the instrument. Barrier never reaches zero, because a surface with no barrier has straight steps and is not worth a picture.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, abs, min, max, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => { t = cl(t, 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();
const gau = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

const M = 88, DV = 2, LV = M * DV; // samples along a step, their spacing, the period along a step
const MAXS = 36, UWIN = 80, WMIN = 2.2;
const CT = cos((27 * PI) / 180), ST = sin((27 * PI) / 180); // steps run 27 degrees off vertical
const V0 = 0.45, KAP = 20.6, NU0 = 2.4, LAM = 1.0, GAM = 0.03, CPL = 0.0; // speed per unit flux, stiffness, instability, nonlinearity
const RATE0 = 11; // rows a second
const RISER = 0.9; // half width of a riser as the tip rounds it, in LED
const STOPS = [[0, 34, 12, 6], [0.18, 92, 34, 12], [0.4, 176, 78, 22], [0.62, 232, 142, 44], [0.8, 250, 196, 96], [0.92, 255, 232, 168], [1, 255, 250, 236]];

function buildLut(S, hue) {
  // the hue turns the chroma in the YIQ plane, so the luma of every step of the ramp stays where it was
  const co = cos(hue * 6.2832), si = sin(hue * 6.2832);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    let k = 0;
    while (k < STOPS.length - 2 && x > STOPS[k + 1][0]) k++;
    const a = STOPS[k], b = STOPS[k + 1], u = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
    const r = (a[1] + (b[1] - a[1]) * u) / 255, g = (a[2] + (b[2] - a[2]) * u) / 255, bl = (a[3] + (b[3] - a[3]) * u) / 255;
    const y = 0.299 * r + 0.587 * g + 0.114 * bl, ii = 0.596 * r - 0.274 * g - 0.322 * bl, qq = 0.211 * r - 0.523 * g + 0.312 * bl;
    const cs = 1 - 0.11 * (1 - co), i2 = (ii * co - qq * si) * cs, q2 = (ii * si + qq * co) * cs;
    S.lut[i * 3] = cl(y + 0.956 * i2 + 0.621 * q2, 0, 1) * 255;
    S.lut[i * 3 + 1] = cl(y - 0.272 * i2 - 0.647 * q2, 0, 1) * 255;
    S.lut[i * 3 + 2] = cl(y - 1.106 * i2 + 1.703 * q2, 0, 1) * 255;
  }
  S.lutHue = hue;
}

export function setup(params) {
  const S = {
    ready: false, P: new Float32Array(MAXS * M), D: new Float32Array(MAXS * M), T: new Float32Array(M), keep: new Float32Array(M), spare: false,
    lo: 0, ns: 0, g0: 0, ws: 11, g: 1, flux: 2, abar: 0.2, clock: 0, ph: [rnd() * 6.28, rnd() * 6.28],
    img: new Float32Array(W * H), lut: new Float32Array(768), lutHue: -9, head: 30, frame: 0,
    isl: [], dip: [], boost: 0, prev: null, du: 0, dv: rnd() * LV, shear: 0, dph: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28],
    cdx: 0, cdy: 0, streak: null, fl: new Float32Array(W), ps: new Float32Array(W), ed: new Float32Array(W), bb: new Float32Array(W),
    wl: 10, j0: 0, jm: 0, jp: 0, jq: 0, wa: 0, wb: 0, wc: 0, wd: 0, dipAcc: 0,
  };
  // the first steps: a staircase with a little spacing noise and a gentle ripple of its own on each step
  const n = Math.ceil((2 * UWIN) / S.ws) + 3;
  S.ns = n;
  let pos = -UWIN;
  for (let k = 0; k < n; k++) {
    const o = k * M;
    const w1 = rnd() * 6.28, w2 = rnd() * 6.28, w3 = rnd() * 6.28;
    pos += S.ws * (0.6 + 0.8 * rnd());
    for (let j = 0; j < M; j++) {
      const v = j / M * 6.2832;
      S.P[o + j] = pos + 0.9 * sin(v * 5 + w1) + 0.8 * sin(v * 7 + w2) + 0.6 * sin(v * 4 + w3);
    }
  }
  params.s = S;
  return S;
}

function slot(S, k) { return (S.lo + k) % MAXS; }

// one terrace edge position, the step k at the sample the last setV chose
function setV(S, v) {
  let q = v / DV;
  q -= M * floor(q / M);
  const j = floor(q), f = q - j, f2 = f * f, f3 = f2 * f;
  S.j0 = j; S.jm = (j + M - 1) % M; S.jp = (j + 1) % M; S.jq = (j + 2) % M;
  S.wa = -0.5 * f3 + f2 - 0.5 * f; S.wb = 1.5 * f3 - 2.5 * f2 + 1; S.wc = -1.5 * f3 + 2 * f2 + 0.5 * f; S.wd = 0.5 * f3 - 0.5 * f2;
}
function posK(S, k) {
  const o = slot(S, k) * M, P = S.P;
  return P[o + S.jm] * S.wa + P[o + S.j0] * S.wb + P[o + S.jp] * S.wc + P[o + S.jq] * S.wd;
}
// the staircase phase: step number plus the fraction of the way to the next step
function psiAt(S, u, v) {
  setV(S, v);
  let lo = -1, hi = S.ns, plo = -1e9, phi = 1e9;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1, p = posK(S, mid);
    if (p <= u) { lo = mid; plo = p; } else { hi = mid; phi = p; }
  }
  if (lo < 0) { S.wl = S.ws; return S.g0 + (u - phi) / S.ws; }
  if (hi >= S.ns) { S.wl = S.ws; return S.g0 + lo + (u - plo) / S.ws; }
  S.wl = max(phi - plo, 1.5);
  return S.g0 + lo + (u - plo) / S.wl;
}

// one explicit step of the model, dt in model seconds
function dynamics(S, dt) {
  const P = S.P, D = S.D, T = S.T, n = S.ns, w0 = S.ws, a = S.abar, nu = NU0 * S.g, wr = 0.5 * w0, hl = 0.5 * LAM * S.g * 11 / w0;
  const iv = 1 / DV, iv2 = iv * iv, iv4 = iv2 * iv2;
  for (let k = 0; k < n; k++) {
    const o = slot(S, k) * M, of = k > 0 ? slot(S, k - 1) * M : -1, ob = k < n - 1 ? slot(S, k + 1) * M : -1;
    let ms = 0, mp = 0;
    for (let j = 0; j < M; j++) {
      const s = (P[o + (j + 1) % M] - P[o + (j + M - 1) % M]) * 0.5 * iv;
      T[j] = s * s; ms += s * s; mp += P[o + j];
    }
    ms /= M; mp /= M;
    for (let j = 0; j < M; j++) {
      const j1 = (j + 1) % M, j2 = (j + 2) % M, k1 = (j + M - 1) % M, k2 = (j + M - 2) % M;
      const p = P[o + j];
      const wf = of >= 0 ? p - P[of + j] : w0, wb = ob >= 0 ? P[ob + j] - p : w0;
      const rf = wr / max(wf, 1), rb = wr / max(wb, 1);
      const vv = V0 * ((1 + a) * wf + (1 - a) * wb) / (2 * w0);
      const rep = 0.3 * V0 * (rf * rf * rf - rb * rb * rb);
      const pvv = (P[o + j1] - 2 * p + P[o + k1]) * iv2;
      const p4 = (P[o + j2] - 4 * P[o + j1] + 6 * p - 4 * P[o + k1] + P[o + k2]) * iv4;
      D[o + j] = -vv + rep + CPL * (wb - wf) - GAM * (p - mp) - nu * pvv - KAP * p4 - hl * (T[j] - ms);
    }
  }
  const sq = sqrt(dt) * 0.25;
  for (let k = 0; k < n; k++) {
    const o = slot(S, k) * M;
    for (let j = 0; j < M; j++) P[o + j] += dt * D[o + j] + sq * gau();
  }
  for (let k = 0; k < n - 1; k++) {
    const o = slot(S, k) * M, o2 = slot(S, k + 1) * M;
    for (let j = 0; j < M; j++) {
      const gap = P[o2 + j] - P[o + j];
      if (gap < WMIN) { const mid = 0.5 * (P[o2 + j] + P[o + j]); P[o + j] = mid - WMIN / 2; P[o2 + j] = mid + WMIN / 2; }
    }
  }
}

// keep the ring fed: steps that left at the bottom come back at the top as shifted copies, and the cut can change
function feed(S) {
  const P = S.P;
  for (let guard = 0; guard < 6; guard++) {
    const o = slot(S, 0) * M;
    let mx = -1e9;
    for (let j = 0; j < M; j++) mx = max(mx, P[o + j]);
    if (mx > -UWIN || S.ns < 4) break;
    // the lowest step has left; remember its shape, drop it
    for (let j = 0; j < M; j++) S.keep[j] = P[o + j];
    S.lo = (S.lo + 1) % MAXS; S.ns--; S.g0++;
    S.spare = true;
  }
  for (let guard = 0; guard < 8 && S.ns < MAXS - 1; guard++) {
    const kt = slot(S, S.ns - 1) * M;
    let mn = 1e9;
    for (let j = 0; j < M; j++) mn = min(mn, P[kt + j]);
    if (mn > UWIN) break;
    const sh = floor(rnd() * M), flip = rnd() < 0.5 ? -1 : 1, nk = slot(S, S.ns) * M;
    let mean = 0;
    for (let j = 0; j < M; j++) mean += S.keep[j];
    mean /= M;
    if (!S.spare) { for (let j = 0; j < M; j++) S.keep[j] = mean + 1.2 * sin(j * 0.31 + S.clock) + 0.8 * sin(j * 0.52 + 2 * S.clock); }
    let mt = 0;
    for (let j = 0; j < M; j++) mt += P[kt + j];
    mt /= M;
    const off = mt + S.ws * (0.65 + 0.7 * rnd());
    for (let j = 0; j < M; j++) {
      const d = (S.keep[(flip > 0 ? j + sh : (M * 2 - j + sh)) % M] - mean) * 0.8;
      P[nk + j] = off + 0.5 * d + 0.5 * (P[kt + j] - mt);
    }
    S.ns++;
  }
  // the cut changes: pull the steps off the far end
  while (S.ns > 6) {
    const kt = slot(S, S.ns - 1) * M;
    let mn = 1e9;
    for (let j = 0; j < M; j++) mn = min(mn, P[kt + j]);
    if (mn < UWIN + 2 * S.ws) break;
    S.ns--;
  }
}

// the crystal is not an exact plane: a slow warp of the staircase, three long waves that drift
const WK = [[0.052, 0.021, 3.4, 0], [-0.017, 0.047, 2.8, 2.1], [0.038, -0.039, 2.2, 4.0]];
function toCrystal(S, x, y, o) {
  const dx = x - 31.5, dy = y - 63.5;
  let u = dx * CT - dy * ST + S.du, v = dx * ST + dy * CT + S.dv, w = 0;
  const t = S.clock;
  for (let i = 0; i < 3; i++) { const k = WK[i]; w += k[2] * sin(k[0] * u + k[1] * v + k[3] + t * (0.007 + 0.003 * i)); }
  o[0] = u + w;
  o[1] = v;
}
function wrapV(d) { return d - LV * Math.round(d / LV); }
const UV = [0, 0];

function islands(S, dtau) {
  const I = S.isl, P = S.P;
  for (let i = I.length - 1; i >= 0; i--) {
    const s = I[i];
    s.r = min(3.9, s.r + 0.28 * dtau);
    const p = psiAt(S, s.u - s.r - 0.5, s.v);
    if (p > s.k0 + 1 + 0.02) I.splice(i, 1);
  }
  if (I.length >= 1 + floor(4.99 * (0.5 + 0.5 * sin(S.clock * 0.05 + S.ph[1]))) || S.ns < 4) return;
  for (let t = 0; t < 5; t++) {
    const k = floor(rnd() * (S.ns - 1)), j = floor(rnd() * M);
    const a = P[slot(S, k) * M + j], b = P[slot(S, k + 1) * M + j], x = (b - a) / S.ws;
    if (x < 1.2 || rnd() > 3.5 * (x - 1.12) * dtau) continue;
    const u = a + (b - a) * (0.4 + 0.2 * rnd()), v = j * DV;
    const vv = wrapV(v - S.dv);
    const xp = (u - S.du) * CT + vv * ST + 31.5, yp = -(u - S.du) * ST + vv * CT + 63.5;
    if (xp < 1 || xp > 62 || yp < 2 || yp > 125) continue;
    I.push({ u, v, r: 1.9, e: 0.85 + 0.65 * rnd(), k0: floor(psiAt(S, u, v)) });
    break;
  }
}

function dipoles(S, dt) {
  const D = S.dip;
  for (let i = D.length - 1; i >= 0; i--) { D[i].age += dt; if (D[i].age > D[i].life) D.splice(i, 1); }
  S.dipAcc += dt;
  if (D.length < 3 && S.dipAcc > 14) {
    S.dipAcc = 0;
    const x = 12 + rnd() * 40, y = 18 + rnd() * 92;
    toCrystal(S, x, y, UV);
    D.push({ u: UV[0], v: UV[1], ang: PI / 2 + (rnd() - 0.5) * 0.8, dmax: 20 + rnd() * 10, age: 0, life: 60 + rnd() * 80, q: rnd() < 0.5 ? 1 : -1 });
  }
}

// one row of the picture, written at the moment the tip is on it
function paintRow(S, y) {
  const e = exp(-y / 9), odd = y & 1 ? 0.22 : -0.22;
  const fl = S.fl, ps = S.ps, ed = S.ed, bb = S.bb;
  const I = S.isl, Dp = S.dip;
  const dd = [];
  for (let i = 0; i < Dp.length; i++) {
    const d = Dp[i], a = sm(d.age / 18) * sm((d.life - d.age) / 18), h = 0.5 * d.dmax * a;
    dd.push([d.u + h * cos(d.ang), d.v + h * sin(d.ang), d.u - h * cos(d.ang), d.v - h * sin(d.ang), d.q, h]);
  }
  const ys = y + S.cdy * e;
  for (let x = 0; x < W; x++) {
    toCrystal(S, x + odd + S.cdx * e, ys, UV);
    const u = UV[0] + S.shear * (ys - 63.5), v = UV[1];
    let psi = psiAt(S, u, v);
    const wl = S.wl;
    let edge = 0;
    for (let i = 0; i < dd.length; i++) {
      const c = dd[i];
      if (c[5] < 0.3) continue;
      const cu = 0.5 * (c[0] + c[2]), cv = 0.5 * (c[1] + c[3]), dv0 = wrapV(v - cv), du0 = u - cu;
      const hx = 0.5 * (c[0] - c[2]), hy = 0.5 * (c[1] - c[3]);
      const ax = du0 - hx, ay = dv0 - hy, bx = du0 + hx, by = dv0 + hy;
      const tp = sm((80 - sqrt(du0 * du0 + dv0 * dv0)) / 45);
      psi += (tp * c[4] * atan2(ay * bx - ax * by, ax * bx + ay * by)) / 6.2832;
      // the short extra step between the two cores
      const sx = -2 * hx, sy = -2 * hy, sl = sx * sx + sy * sy, tt = cl(((du0 - hx) * sx + (dv0 - hy) * sy) / sl, 0, 1);
      const px = du0 - hx - tt * sx, py = dv0 - hy - tt * sy;
      edge = max(edge, exp(-(px * px + py * py) / 0.9));
    }
    const fr = Math.round(psi), g = psi - fr, rr = RISER / wl;
    let H0 = fr - 1 + sm((g + rr) / (2 * rr));
    let Hi = H0, rim = 0;
    for (let i = 0; i < I.length; i++) {
      const s = I[i], du = u - s.u, dv = wrapV(v - s.v) / s.e, dist = sqrt(du * du + dv * dv);
      if (dist > s.r + 2) continue;
      const hh = s.k0 + sm((s.r + RISER - dist) / (2 * RISER));
      if (hh > Hi) Hi = hh;
      rim = max(rim, exp(-((dist - s.r) * (dist - s.r)) / 0.9) * cl(s.k0 + 1 - H0, 0, 1));
    }
    fl[x] = Hi; ps[x] = psi; ed[x] = max(exp(-(g * wl * g * wl) / 0.9), edge * 0.5) + rim * 0.7;
    bb[x] = H0;
  }
  // level the row: take out the mean and the mean tilt
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let x = 0; x < W; x++) { sx += x; sy += ps[x]; sxx += x * x; sxy += x * ps[x]; }
  const slope = (W * sxy - sx * sy) / (W * sxx - sx * sx);
  let mh = 0, mp = 0;
  for (let x = 0; x < W; x++) { mh += fl[x] - slope * x; mp += ps[x] - slope * x; }
  mh /= W; mp /= W;
  const row = y * W;
  const lean = S.lean;
  for (let x = 0; x < W; x++) {
    const saw = bb[x] - ps[x] + 0.5; // -0.5 .. 0.5, bright just above a step
    const macro = cl(ps[x] - slope * x - mp, -1.6, 1.6);
    const isl = fl[x] - bb[x];
    let B = 0.5 + 0.5 * saw + 0.17 * macro + 0.34 * isl + 0.3 * ed[x] + lean * (x - 32) / 64;
    S.img[row + x] = cl(B, 0, 1.2);
  }
  // now and then the tip lets go and a stretch of two rows is smeared along
  if (S.streak) {
    const s = S.streak, h = S.img[row + s.a];
    for (let x = s.a; x < s.b; x++) S.img[row + x] = 0.5 * S.img[row + x] + 0.5 * h * (0.94 + 0.12 * rnd());
    S.streak = null;
  } else if (rnd() < 1 / 400) {
    const a = floor(rnd() * 44), b = min(W, a + 9 + floor(rnd() * 14)), h = S.img[row + a];
    for (let x = a; x < b; x++) S.img[row + x] = 0.5 * S.img[row + x] + 0.5 * h * (0.94 + 0.12 * rnd());
    S.streak = { a, b };
  }
}

function advance(S, rt) { // rt real seconds
  S.clock += rt;
  const t = S.clock;
  S.abar = -0.04 + 0.5 * (0.62 * sin(t * 0.0364 + S.ph[0]) + 0.38 * sin(t * 0.0232 + S.ph[1]));
  S.du = 5.5 * sin(t * 0.0127 + S.dph[0]) + 3 * sin(t * 0.0311 + S.dph[1]);
  S.dv += rt * (0.06 + 0.04 * sin(t * 0.0089 + S.dph[2]));
  S.shear = 0.03 * sin(t * 0.0043 + S.dph[1]) + 0.012 * sin(t * 0.0171 + S.dph[0]);
  S.lean = 0.07 * sin(t * 0.0057 + S.dph[2]);
  let dtau = rt * S.flux;
  const ns = Math.ceil(dtau / 0.05);
  for (let i = 0; i < ns; i++) dynamics(S, dtau / ns);
  feed(S);
  islands(S, dtau);
  dipoles(S, rt);
}

function applyCut(S, wt) { // rescale the steps about the middle when the terrace width target moves
  const r = wt / S.ws;
  if (abs(r - 1) < 1e-5) return;
  const P = S.P;
  for (let k = 0; k < S.ns; k++) { const o = slot(S, k) * M; for (let j = 0; j < M; j++) P[o + j] *= r; }
  for (const s of S.isl) { s.u *= r; }
  for (const d of S.dip) { d.u *= r; }
  S.ws = wt;
}

function newFrame(S) {
  S.head = 0; S.frame++;
  const a = rnd() * 6.28;
  S.cdx = 1.8 * cos(a); S.cdy = 1.2 * sin(a);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.flux = cl(kn[1], 0.5, 4);
  S.g = exp(0.5 * (cl(kn[3], 0, 1) - 0.06));
  const wt = 11 * exp(0.36 * cl(kn[2], -1, 1));
  if (!S.ready) {
    // pre-run: the steps meander for 45 model seconds, then one whole scan is written with the surface moving
    S.ready = true;
    applyCut(S, wt);
    for (let i = 0; i < 12; i++) feed(S);
    S.clock = 0;
    for (let i = 0; i < 900; i++) { dynamics(S, 0.05); if (i % 6 === 5) { S.clock += 0.05 * 6 / S.flux; feed(S); islands(S, 0.3); } }
    S.clock = 0; advance(S, 0);
    for (let i = 0; i < 20; i++) dipoles(S, 5);
    for (const q of S.dip) q.age = q.life * rnd() * 0.5;
    S.frame = -1; newFrame(S);
    for (let y = 0; y < H; y++) { advance(S, 1 / RATE0); paintRow(S, y); }
    newFrame(S);
    for (let y = 0; y < 30; y++) { advance(S, 1 / RATE0); paintRow(S, y); }
    S.head = 30; S.painted = 29; S.prev = kn.slice();
    buildLut(S, kn[0]);
    return;
  }
  // a turn of Flux, Miscut or Barrier sends the tip across fast for a moment, so the change is painted in
  const pr = S.prev;
  if (pr) {
    const dn = abs(kn[1] - pr[1]) / 3.5 + abs(kn[2] - pr[2]) / 2 + abs(kn[3] - pr[3]);
    S.boost = min(1, S.boost + 16 * dn);
  }
  S.prev = kn.slice();
  S.boost *= exp(-d / 1.6);
  // the cut eases to its target, the steps rescaling with it
  const wnew = S.ws + (wt - S.ws) * (1 - exp(-d / 0.9));
  applyCut(S, wnew);
  if (abs(S.lutHue - kn[0]) > 0.002) buildLut(S, kn[0]);
  advance(S, d);
  S.head += d * RATE0 * (1 + 4 * S.boost);
  let guard = 0;
  while (floor(S.head) > S.painted) {
    S.painted++;
    if (S.painted >= H) { S.painted = -1; newFrame(S); S.head -= H; if (S.head < 0) S.head = 0; continue; }
    paintRow(S, S.painted);
    if (++guard > 12) break;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const lut = S.lut, hy = S.head;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - hy;
    const old = dy > 0 ? 0.92 + 0.08 * exp(-dy / 2) : 1;
    const glow = 0.4 * max(0, 1 - abs(dy) / 1.3);
    for (let x = 0; x < W; x++) {
      const B = cl(S.img[y * W + x] * old + glow, 0, 1);
      const i = floor(B * 255) * 3;
      display.setPixel(x, y, lut[i], lut[i + 1], lut[i + 2]);
    }
  }
}
