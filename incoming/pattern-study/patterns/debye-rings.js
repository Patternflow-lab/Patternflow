// ===== Patternflow pattern =====
// Title:   Debye Rings
// Family:  powderxray
// Idea:    An area X-ray detector seen head-on behind a lump of powder: a dark beam stop and its thin arm, and round them the Debye-Scherrer rings of a cubic crystal, each ring a chain of bright beads where one grain of the lump happens to stand at the Bragg angle, the beads flashing and sliding along their rings as the sample rocks while the lattice breathes and crosses from simple cubic to body-centred to face-centred and the rings come and go.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: powder diffraction rings (Peter Debye and Paul Scherrer, 1916; Albert Hull, 1917), the extinction rules of the three cubic lattices and the ring order they give, Scherrer's peak broadening with crystallite size (1918), the spotty rings of a coarse-grained sample and the arcs of a textured one (from memory), the false colour of an image plate. Original here: each ring's grains as short-lived flashes whose count follows the multiplicity of the reflection, the rocking that slides them along their rings, the texture that gathers them into arcs that wander round, the lattice that crosses from one cubic type to another over minutes, pattern round 256
// Round:   256
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rocking=1..4, Cell=-1..1, Grains=-1..1
//
// Knob 1: Hue. Turns the image-plate colours round the wheel together; it opens on the plate's own ramp, black through deep blue and cyan to white.
// Knob 2: Rocking. 1 to 4, opening at 2. How fast the sample rocks and its grains turn, and with them the whole slow life of the sample: at 1 a bead flashes for six seconds or so, at 2 for three while it slides a few LEDs a second, at 4 the flashes are twice as quick, more grains stand at the Bragg angle at once and each bead smears into a short arc.
// Knob 3: Cell. -1 to 1, opening at 0. The lattice parameter a: at -1 a small cell throws the whole ring set outward, a few rings across the panel; at 1 a large cell pulls it in, and rings keep arriving over the panel edge and crowd together. The cell also breathes about one percent on its own.
// Knob 4: Grains. -1 to 1, opening at 0.06. How many crystallites are in the beam, 12 at -1 and about 4000 at 1. A handful of big grains make a few hard bright beads on thin dark rings; a crowd of small ones makes the rings smooth and, because the crystals are smaller, wider (Scherrer).

const W = 64, H = 128, NPIX = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, tan, asin, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const CX = 32, CY = 64;           // where the beam meets the detector
const LC = 38;                    // sample to detector, in LEDs: a ring's radius is LC tan(2 theta)
const Q0 = 0.15;                  // lambda / 2a at Cell 0
const NA = 720;                   // azimuth bins round a ring
const NS = 3200;                  // most spots alive at once
const NBK = 176, BKC = 10;        // radius buckets of half an LED, rings listed in each
const REACH = 3.4;                // a ring's reach, in its own sigmas
const TLIFE = 3.2;                // mean life of a flash at Rocking 2, seconds
const KAPPA = 0.44;               // grains at the Bragg angle at once, per unit of multiplicity, for a crowd of G grains: KAPPA G^0.2
const NCAP = 64;                  // most spots drawn on one ring; the rest of a crowd is the smooth part
const AMAX = 3.6;                 // the brightest a spot gets against its ring
const TONE = 1.5;                 // exposure: pixel value x shows as 1 - exp(-TONE x)

// ---- the reflections of a cubic crystal, by h2 + k2 + l2, with the multiplicity each lattice lets through ----
const RF = (() => {
  const NMAXN = 40, acc = new Map();
  for (let h = 0; h <= 6; h++) for (let k = 0; k <= h; k++) for (let l = 0; l <= k; l++) {
    const n = h * h + k * k + l * l;
    if (n < 1 || n > NMAXN) continue;
    // distinct orders and signs of (h k l)
    const nz = (h > 0) + (k > 0) + (l > 0);
    const perms = h === k && k === l ? 1 : h === k || k === l ? 3 : 6;
    const m = perms * (1 << nz);
    const bcc = (h + k + l) % 2 === 0, fcc = ((h ^ k) | (k ^ l)) % 2 === 0;
    const e = acc.get(n) || { n, sc: 0, bcc: 0, fcc: 0 };
    e.sc += m; if (bcc) e.bcc += m; if (fcc) e.fcc += m;
    acc.set(n, e);
  }
  const L = [...acc.values()].sort((a, b) => a.n - b.n);
  const hash = (a, b) => {
    let x = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const n = L.length;
  const r = { n, N: new Float32Array(n), sc: new Float32Array(n), bcc: new Float32Array(n), fcc: new Float32Array(n),
    eps: new Float32Array(n), nf: new Uint8Array(n), ph: new Float32Array(n), wb: new Float32Array(n) };
  const NFS = [2, 2, 4, 4, 6, 2, 4];
  L.forEach((e, i) => {
    r.N[i] = e.n; r.sc[i] = e.sc; r.bcc[i] = e.bcc; r.fcc[i] = e.fcc;
    r.eps[i] = (hash(e.n, 1) - 0.5) * 1.9;               // how far this ring's arcs sit from the common axis
    r.nf[i] = NFS[floor(hash(e.n, 2) * NFS.length)];     // how many arcs round the ring
    r.ph[i] = hash(e.n, 3);
    r.wb[i] = 0.07 + 0.2 * hash(e.n, 4);                 // how fast this ring's arcs swing about the common axis
  });
  return r;
})();

// the false-colour ramp of the plate: shown value, hue, saturation, value
const RAMP = [
  0.00, 0.66, 0.90, 0.00,
  0.04, 0.66, 0.90, 0.10,
  0.10, 0.66, 0.92, 0.34,
  0.24, 0.64, 0.95, 0.62,
  0.42, 0.60, 0.97, 0.86,
  0.60, 0.53, 0.95, 1.00,
  0.78, 0.49, 0.70, 1.00,
  0.92, 0.47, 0.28, 1.00,
  1.00, 0.46, 0.05, 1.00,
];
const NL = 2048, LS = 256;            // the colour table: pixel value 0 to 8 in steps of 1/256

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function buildLut(st, hue) {
  const lut = st.lut;
  for (let i = 0; i < NL; i++) {
    const v = 1 - exp(-TONE * i / LS);
    let k = 0;
    while (k < 7 && v > RAMP[k * 4 + 4]) k++;
    const o = k * 4, f = cl((v - RAMP[o]) / (RAMP[o + 4] - RAMP[o]), 0, 1);
    hsv(hue + RAMP[o + 1] + (RAMP[o + 5] - RAMP[o + 1]) * f, RAMP[o + 2] + (RAMP[o + 6] - RAMP[o + 2]) * f,
      RAMP[o + 3] + (RAMP[o + 7] - RAMP[o + 3]) * f, lut, i * 3);
  }
  st.lutHue = hue;
}

export function setup(params) {
  const nr = RF.n;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    tt: 0, tl: 0, rho: 0, expo: 0.9, ax0: 0, tau: 0.5, imax: 1, w: [0.3, 0.3, 0.4],
    // the spots: one grain at the Bragg angle on one ring
    ns: 0, sj: new Int16Array(NS), saz: new Float32Array(NS), sv: new Float32Array(NS), su: new Float32Array(NS),
    sr: new Float32Array(NS), sa: new Float32Array(NS), sk: new Float32Array(NS), sx: new Uint8Array(NS),
    // the rings, by row of the reflection table
    act: new Uint8Array(nr), rad: new Float32Array(nr), sg: new Float32Array(nr), pk: new Float32Array(nr),
    tg: new Float32Array(nr), tj: new Float32Array(nr), axj: new Float32Array(nr), fs: new Float32Array(nr), amp: new Float32Array(nr), sar: new Float32Array(nr),
    cnt: new Int16Array(nr), exc: new Int16Array(nr),
    az: new Float32Array(nr * NA),
    bk: new Int16Array(NBK * BKC), bn: new Uint8Array(NBK),
    lut: new Float32Array(NL * 3), lutHue: -1,
    // what the pixels do not change: their radius and azimuth bin, the air scatter and halo, the beam stop and the gaps
    pr: new Float32Array(NPIX), pi0: new Int16Array(NPIX), pi1: new Int16Array(NPIX), pf: new Float32Array(NPIX),
    bg: new Float32Array(NPIX), mk: new Float32Array(NPIX),
    ct: [], stb: [],
  });
  const ad = [-0.36, -0.93], al = sqrt(ad[0] * ad[0] + ad[1] * ad[1]);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const p = py * W + px, dx = px + 0.5 - CX, dy = py + 0.5 - CY, r = sqrt(dx * dx + dy * dy);
    st.pr[p] = r;
    let a = Math.atan2(dy, dx); if (a < 0) a += TP;
    const bn = a / TP * NA, i0 = floor(bn) % NA;
    st.pi0[p] = i0; st.pi1[p] = (i0 + 1) % NA; st.pf[p] = bn - floor(bn);
    // air scatter round the stop, the faint halo of the amorphous matrix the grains sit in
    st.bg[p] = 0.012 + 0.2 / (1 + (r / 8) * (r / 8)) + 0.075 * exp(-0.5 * ((r - 25) / 8.5) * ((r - 25) / 8.5));
    // the beam stop, the arm that holds it, and the dark rows between detector modules
    const along = (dx * ad[0] + dy * ad[1]) / al, perp = abs(dx * ad[1] - dy * ad[0]) / al;
    const arm = along > 0 ? cl(1.25 - perp, 0, 1) * cl(along - 2, 0, 1) : 0;
    const disc = cl(4.9 - r, 0, 1);
    let m = 1 - max(arm, disc);
    if (py === 41 || py === 42 || py === 85 || py === 86) m = 0;
    st.mk[p] = m;
  }
  // cos and sin of n times each azimuth bin, for the arcs of the texture
  for (const n of [2, 4, 6]) {
    const c = new Float32Array(NA), s = new Float32Array(NA);
    for (let b = 0; b < NA; b++) { c[b] = cos(n * (b + 0.5) / NA * TP); s[b] = sin(n * (b + 0.5) / NA * TP); }
    st.ct[n] = c; st.stb[n] = s;
  }
  return st;
}

// the gain of a texture lobe: the mean over the ring is 1
const LOBE = 3.2;

// ---- the sample's own clock: rocking about the beam, the texture axis, the lattice type ----
function sampleState(st) {
  const t = st.tl;
  st.rho = 0.2 * sin(0.47 * st.tt + 0.8) + 0.11 * sin(0.71 * st.tt + 2.3);
  st.ax0 = 0.8 + 0.05 * t + 1.0 * sin(0.045 * t + 0.6) + 0.6 * sin(0.093 * t + 1.9);
  st.tau = 0.12 + 0.8 * (0.5 + 0.5 * sin(0.0151 * t + 2.1)) * (0.7 + 0.3 * sin(0.0057 * t + 0.5));
  // simple, body-centred and face-centred cubic: three slow logits, a softmax of them
  const l0 = sin(0.075 * t - 0.62), l1 = sin(0.057 * t - 0.61), l2 = sin(0.043 * t - 0.61);
  const e0 = exp(2.3 * l0), e1 = exp(2.3 * l1), e2 = exp(2.3 * l2), s = e0 + e1 + e2;
  st.w[0] = e0 / s; st.w[1] = e1 / s; st.w[2] = e2 / s;
}

// ---- the rings at this lattice parameter and this crowd of grains ----
function rings(st, S, dt, first) {
  const kc = cl(st.ks[2], -1, 1), kg = cl(st.ks[3], -1, 1), tt = st.tl;
  const q = Q0 * pow(2, (kc < 0 ? -0.46 : -0.42) * kc) / (1 + 0.012 * sin(0.043 * tt + 1) + 0.008 * sin(0.0713 * tt + 2));
  const G = 12 * pow(340, (kg + 1) / 2);
  // smaller crystals, wider rings: the width goes as the cube root of the crowd
  const wth = 0.0055 * pow(G / 100, 1 / 3);
  const uG = log10x(G / 12) / 2.53;      // 0 for the fewest grains, 1 for the most
  const fine = 0.10 + 0.15 * uG + 0.45 * uG * uG * uG;   // the share of the ring that is a fine-grained smooth part
  const rf = 0.55 + 0.45 * S;
  st.expo = 0.95 - 0.3 * uG;
  const w0 = st.w[0], w1 = st.w[1], w2 = st.w[2];
  let imax = 1e-9;
  const n = RF.n;
  for (let j = 0; j < n; j++) {
    const u = q * sqrt(RF.N[j]);
    st.act[j] = 0;
    if (u >= 0.97) continue;
    const th = asin(u), tw = 2 * th;
    if (tw > 1.3) continue;
    const ct = cos(th), r = LC * tan(tw);
    if (r > 84) continue;
    const m = w0 * RF.sc[j] + w1 * RF.bcc[j] + w2 * RF.fcc[j];
    if (m < 0.02) { st.pk[j] = 0; st.tg[j] = 0; st.rad[j] = r; st.act[j] = 1; continue; }
    const c2 = cos(tw), lp = (1 + c2 * c2) / (u * u * ct);
    // as the sample rocks a ring's arcs come up and fade on their own beat, each ring on its own
    const ta = 0.5 + 0.5 * sin((0.2 + 0.35 * RF.ph[j]) * st.tt + 40 * RF.ph[j]);
    const tb = 0.5 + 0.5 * sin((0.16 + 0.3 * RF.eps[j] * RF.eps[j]) * st.tt + 17 * RF.ph[j]);
    st.tj[j] = min(0.97, st.tau * (0.2 + 1.6 * ta));
    st.axj[j] = st.ax0 + RF.eps[j] + 0.8 * sin(RF.wb[j] * st.tt + 31 * RF.ph[j]);
    const I = m * lp * exp(-(u / 0.38) * (u / 0.38)) * (0.3 + 0.7 * tb);
    const vis = 1 - sstep(52, 80, r);
    if (I * vis > imax) imax = I * vis;
    const sec2 = 1 + tan(tw) * tan(tw);
    const sr = min(2.5, sqrt(0.85 * 0.85 + pow(LC * pow(sec2, 0.6) * wth / ct, 2)));
    st.rad[j] = r; st.sg[j] = sr; st.act[j] = 1;
    st.pk[j] = I;                       // made a brightness below, once the strongest is known
    // how many grains stand at the Bragg angle at once, and how many of them are drawn
    const nphys = KAPPA * pow(G, 0.2) * m * rf, nsim = min(nphys, NCAP);
    st.tg[j] = nsim;
    st.fs[j] = fine + (1 - fine) * (nphys > 1e-9 ? 1 - nsim / nphys : 0);
    const saz = (0.9 + 0.3 * (sr - 0.85)) * (1 + 0.3 * S);
    const sa = min(0.6, saz / max(r, 4));
    st.sar[j] = sa;
    st.amp[j] = nsim > 0.02 ? min(AMAX, (1 - st.fs[j]) * TP / (sa * 2.5066 * nsim * 0.5)) : 0;
  }
  // the exposure follows the strongest ring still on the panel, so a lattice with few rings is as bright as one with many
  st.imax = first ? imax : st.imax + (imax - st.imax) * (1 - exp(-dt / 0.7));
  const im = max(st.imax, 1e-9);
  // rings crowded together add up to a haze, so the exposure drops as more strong rings share the panel
  let crowd = 0;
  for (let j = 0; j < n; j++) if (st.act[j] && st.pk[j] > 0) crowd += (1 - sstep(52, 80, st.rad[j])) * min(1, sqrt(st.pk[j] / im));
  const ex = st.expo / (1 + 0.06 * max(0, crowd - 9));
  for (let j = 0; j < n; j++) {
    if (!st.act[j] || st.tg[j] === 0 && st.pk[j] === 0) { st.pk[j] = 0; continue; }
    const r = st.rad[j], edge = 1 - sstep(70, 82, r);
    st.pk[j] = ex * sqrt(min(1.4, st.pk[j] / im)) * edge * pow(0.9 / st.sg[j], 0.8);
    if (st.pk[j] < 0.01) st.tg[j] = 0;
  }
}
const log10x = (v) => Math.log(max(v, 1e-9)) / Math.LN10;

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// the arcs of a ring: the chance a grain stands at this azimuth, 1 on average
function lobeAt(st, j, az) {
  const a = st.axj[j], nf = RF.nf[j], tau = st.tj[j];
  const c = (1 + cos(nf * (az - a))) * 0.5;
  return (1 - tau) + tau * LOBE * c * c * c;
}

// ---- one step of the sample ----
function step(st, dt, S, first) {
  const dts = dt * S;
  st.tt += dts;
  st.tl += dt * (0.5 + 0.5 * S);
  sampleState(st);
  rings(st, S, dt, first);
  const n = RF.n, cnt = st.cnt, exc = st.exc;
  cnt.fill(0);
  // the flashes in progress
  for (let i = 0; i < st.ns; i++) {
    const j = st.sj[i];
    if (st.sx[i]) st.sk[i] -= 3 * dt; else st.sk[i] = min(1, st.sk[i] + 3 * dt);
    st.su[i] += dts * st.sr[i];
    st.saz[i] += dts * st.sv[i] / max(st.rad[j], 4);
    if (st.su[i] >= 1 || st.sk[i] <= 0 || !st.act[j]) {
      const l = --st.ns;
      if (i < l) {
        st.sj[i] = st.sj[l]; st.saz[i] = st.saz[l]; st.sv[i] = st.sv[l]; st.su[i] = st.su[l];
        st.sr[i] = st.sr[l]; st.sa[i] = st.sa[l]; st.sk[i] = st.sk[l]; st.sx[i] = st.sx[l];
      }
      i--; continue;
    }
    if (!st.sx[i]) cnt[j]++;
  }
  // a crowd that has grown too big for its ring is let go of quickly, whatever the clock
  for (let j = 0; j < n; j++) exc[j] = st.act[j] ? max(0, cnt[j] - ceil(1.6 * st.tg[j] + 1.5)) : 0;
  for (let i = 0; i < st.ns; i++) {
    const j = st.sj[i];
    if (exc[j] > 0 && !st.sx[i]) { st.sx[i] = 1; exc[j]--; cnt[j]--; }
  }
  for (let j = 0; j < n; j++) {
    if (!st.act[j] || st.tg[j] <= 0) continue;
    const tg = st.tg[j];
    let nb = 0;
    const x = tg * dts / TLIFE, xf = floor(x);
    nb = xf + (Math.random() < x - xf ? 1 : 0);
    let seed = 0;
    if (cnt[j] + nb < 0.5 * tg - 0.5) seed = min(6, ceil(0.5 * tg - 0.5 - cnt[j] - nb));
    for (let b = 0; b < nb + seed; b++) {
      if (st.ns >= NS) break;
      const i = st.ns++;
      // an azimuth drawn from the ring's arcs
      const pmax = (1 - st.tj[j]) + st.tj[j] * LOBE;
      let az = Math.random() * TP;
      for (let t = 0; t < 7; t++) {
        az = Math.random() * TP;
        if (Math.random() * pmax < lobeAt(st, j, az)) break;
      }
      st.sj[i] = j; st.saz[i] = az - st.rho;
      st.sv[i] = gauss() * 1.5;
      st.sr[i] = 1 / (2 + 2.4 * Math.random());
      st.sa[i] = cl(exp(0.55 * gauss() - 0.15), 0.35, 3);
      st.sx[i] = 0;
      if (b < nb) { st.su[i] = 0; st.sk[i] = 1; }
      else { st.su[i] = 0.15 + 0.7 * Math.random(); st.sk[i] = 0; }
      cnt[j]++;
    }
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.1);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // the sample has been in the beam for a while before the first frame
    for (let i = 0; i < 260; i++) step(st, 0.05, 1, i === 0);
  }
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  if (dt > 0) step(st, dt, cl(st.ks[1], 0, 4) * 0.5, false);
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.ks[0];
  if (abs(hue - st.lutHue) > 1e-4) buildLut(st, hue);
  const { az, bk, bn, rad, sg, pk, act, lut, pr, pi0, pi1, pf, bg, mk } = st;
  const n = RF.n, rho = st.rho;
  // each ring's brightness round it: the smooth part with its arcs, and the flashes
  for (let j = 0; j < n; j++) {
    if (!act[j] || pk[j] <= 0) continue;
    const base = j * NA, nf = RF.nf[j], c = st.ct[nf], s = st.stb[nf], fs = st.fs[j];
    const a = (st.axj[j] + rho) * nf, ca = cos(a), sa = sin(a), tj = st.tj[j];
    for (let b = 0; b < NA; b++) {
      const cc = (1 + c[b] * ca + s[b] * sa) * 0.5;
      az[base + b] = fs * ((1 - tj) + tj * LOBE * cc * cc * cc);
    }
  }
  const binw = NA / TP;
  for (let i = 0; i < st.ns; i++) {
    const j = st.sj[i];
    if (!act[j] || pk[j] <= 0) continue;
    const u = st.su[i], e = sin(PI * u), amp = st.amp[j] * st.sa[i] * e * e * min(1, max(0, st.sk[i]));
    if (amp < 0.004) continue;
    let a = (st.saz[i] + rho) % TP; if (a < 0) a += TP;
    const sb = st.sar[j] * binw, cb = a * binw, span = ceil(3.2 * sb), base = j * NA, is2 = 0.5 / (sb * sb);
    for (let d = -span; d <= span; d++) {
      let b = floor(cb) + d; const dd = b + 0.5 - cb;
      if (b < 0) b += NA; else if (b >= NA) b -= NA;
      az[base + b] += amp * exp(-dd * dd * is2);
    }
  }
  // which rings reach which half-LED of radius
  bn.fill(0);
  for (let j = 0; j < n; j++) {
    if (!act[j] || pk[j] <= 0) continue;
    const reach = REACH * sg[j];
    const b0 = max(0, floor((rad[j] - reach) * 2)), b1 = min(NBK - 1, floor((rad[j] + reach) * 2));
    for (let b = b0; b <= b1; b++) if (bn[b] < BKC) bk[b * BKC + bn[b]++] = j;
  }
  for (let p = 0; p < NPIX; p++) {
    const r = pr[p], b = (r * 2) | 0;
    let x = bg[p];
    if (b < NBK) {
      const nb = bn[b], i0 = pi0[p], i1 = pi1[p], f = pf[p];
      for (let k = 0; k < nb; k++) {
        const j = bk[b * BKC + k], d = (r - rad[j]) / sg[j];
        if (d > REACH || d < -REACH) continue;
        const o = j * NA;
        x += exp(-0.5 * d * d) * pk[j] * (az[o + i0] * (1 - f) + az[o + i1] * f);
      }
    }
    x *= mk[p];
    let li = (x * LS) | 0; if (li > NL - 1) li = NL - 1;
    li *= 3;
    display.setPixel(p % W, (p / W) | 0, (lut[li] * 255 + 0.5) | 0, (lut[li + 1] * 255 + 0.5) | 0, (lut[li + 2] * 255 + 0.5) | 0);
  }
}
