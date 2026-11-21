// ===== Patternflow pattern =====
// Title:   Striated Column
// Family:  discharge
// Idea:    A glow discharge tube stands along the panel with its cathode at the bottom and its anode at the top, a thin cathode glow, a dark Crookes space, a pale negative glow and a dim Faraday space below a long positive column, where soft curved slabs of light (ionization waves) rise from the negative glow toward the anode, now and then splitting or merging.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Michael Faraday's dark space in a glow discharge (1838), William Crookes's cathode dark space (1870s), Walter Schottky's diffusion theory of the positive column with its J0 radial profile (1924), and the moving striations of the S, P and R modes that the ionization wave theory of the 1950s and 1960s explains (Pekarek and others, the years not sure); pattern round 207
// Round:   207
// ===============================
// @matrix 64x128
// @knobs Gas=0..1, Pressure=0.5..4, Current=-1..1, Twist=-1..1
//
// Knob 1: Gas. Seven gases in a loop, neon at 0 and 1 (orange red column, pink white negative glow), helium at 0.14 (pink white), hydrogen at 0.29 (magenta red), argon at 0.43 (violet), mercury at 0.57 (blue), krypton at 0.71 (pale mint green) and sodium at 0.86 (gold). The negative glow and the cathode glow take a colour of their own in each gas.
// Knob 2: Pressure. The wavelength of the striations is 24 LEDs at 0.5, about 15 at the opening 2 and 8 at 4. The Crookes dark space shrinks from 14 LEDs to 8 and the negative glow shortens with it. The column narrows from 49 LEDs wide to 44.
// Knob 3: Current. At -1 the tube is dim and the slabs crawl at about 3 LEDs a second with deep dark gaps; at the opening 0 they climb at 9 LEDs a second. Toward +1 they race at 24 LEDs a second and blur into a nearly uniform column, the whole tube flickers, and the negative glow and cathode glow grow brighter.
// Knob 4: Twist. An axial magnetic field. At 0 the slabs are curved caps, 1 to 7 LEDs deep, with a slight lean that wanders. Toward -1 or +1 they turn into helices that climb up to 32 LEDs across the tube, to the right at -1 and to the left at +1.

const W = 64;
const H = 128;
const { floor, exp, log, sin, cos, abs, min, max, PI, imul, sqrt, asin } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const CX = 31.5; // the axis of the tube
const RW = 28; // the glass wall, in LEDs from the axis
const ZA = 42; // the phase of the striations is anchored near the negative glow
const ZT0 = -36; // the phase table starts here, one entry per half LED
const NT = 420;

function hh(i, j) {
  let h = (imul(i, 374761393) + imul(j, 668265263)) | 0;
  h = imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(u, v) {
  const i = floor(u);
  const j = floor(v);
  let a = u - i;
  let b = v - j;
  a = a * a * (3 - 2 * a);
  b = b * b * (3 - 2 * b);
  const p = hh(i, j);
  const q = hh(i + 1, j);
  const r = hh(i, j + 1);
  const s = hh(i + 1, j + 1);
  return p + (q - p) * a + (r - p) * b + (p - q - r + s) * a * b;
}
// Bessel J0, the radial profile of the glow: brightest on the axis and zero
// at x = 2.405, which is put at the wall.
function j0(x) {
  const q = (x * x) / 4;
  return 1 - q * (1 - (q / 4) * (1 - (q / 9) * (1 - (q / 16) * (1 - q / 25))));
}

// One gas per seventh of K1. Per gas: the dark end of the column's colour,
// the column's own colour, the negative glow, the cathode glow.
const PAL = [
  // neon
  [[124, 8, 24], [255, 92, 24], [255, 120, 170], [255, 180, 50]],
  // helium
  [[130, 22, 76], [255, 138, 194], [255, 214, 240], [255, 96, 116]],
  // hydrogen
  [[120, 4, 70], [255, 30, 124], [220, 120, 255], [255, 86, 88]],
  // argon
  [[64, 12, 150], [160, 84, 255], [190, 206, 255], [255, 90, 170]],
  // mercury
  [[16, 52, 156], [72, 164, 255], [190, 238, 255], [84, 240, 200]],
  // krypton
  [[10, 96, 100], [130, 245, 172], [214, 255, 236], [206, 255, 130]],
  // sodium, between krypton and neon
  [[118, 8, 8], [255, 178, 18], [255, 226, 140], [255, 120, 22]],
];
const NPC = 4;
function toHsv(c, o) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  o[0] = h;
  o[1] = mx > 0 ? d / mx : 0;
  o[2] = mx;
}
function fromHsv(h, s, v, o) {
  const k = (n) => (n + h) % 6;
  const f = (n) => 255 * v * (1 - s * max(0, min(k(n), 4 - k(n), 1)));
  o[0] = f(5);
  o[1] = f(3);
  o[2] = f(1);
}
const HA = [0, 0, 0];
const HB = [0, 0, 0];
// Blended round the hue circle, so neon to helium passes the pinks and
// krypton to sodium passes a lime.
function gasColours(k, out) {
  const n = PAL.length;
  const pos = cl(k, 0, 1) * n;
  const a = min(floor(pos), n - 1);
  const f = pos - a;
  const A = PAL[a];
  const B = PAL[(a + 1) % n];
  for (let c = 0; c < NPC; c++) {
    toHsv(A[c], HA);
    toHsv(B[c], HB);
    let dh = HB[0] - HA[0];
    if (dh > 3) dh -= 6;
    else if (dh < -3) dh += 6;
    const wa = HA[1] < 0.06 ? 0 : 1;
    const wb = HB[1] < 0.06 ? 0 : 1;
    let h = HA[0] + dh * f;
    if (!wa) h = HB[0];
    else if (!wb) h = HA[0];
    fromHsv((h + 6) % 6, lerp(HA[1], HB[1], f), lerp(HA[2], HB[2], f), out[c]);
  }
}
const GOUT = Array.from({ length: NPC }, () => [0, 0, 0]);

// An intensity ramp, 256 steps over 0 to IMAX: black to the dark colour, to
// the colour, then toward white. The dark end leans red or blue, never brown.
const IMAX = 1.4;
function ramp(lut, cd, c, tint, white) {
  const w = [lerp(c[0], tint, white), lerp(c[1], tint, white), lerp(c[2], tint, white)];
  for (let i = 0; i < 256; i++) {
    const I = (i / 255) * IMAX;
    let a, b, u;
    if (I < 0.2) {
      a = null;
      b = cd;
      u = (I / 0.2) ** 0.9;
    } else if (I < 0.55) {
      a = cd;
      b = c;
      u = (I - 0.2) / 0.35;
    } else {
      a = c;
      b = w;
      u = cl((I - 0.55) / 0.65, 0, 1);
    }
    for (let k = 0; k < 3; k++) lut[i * 3 + k] = a ? lerp(a[k], b[k], u) : b[k] * u;
  }
}

export function setup(params) {
  const S = {
    t: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    sk: [0, 2, 0, 0.06],
    ph: Array.from({ length: 40 }, () => Math.random() * TAU),
    Phi: Math.random() * 40,
    defs: [],
    nextDef: 3 + Math.random() * 3,
    tab: new Float32Array(NT),
    lutC: new Float32Array(768),
    lutN: new Float32Array(768),
    lutK: new Float32Array(768),
    rimX: new Float32Array(W),
    rowE: new Float32Array(H),
    rowA: new Float32Array(H),
    rowN: new Float32Array(H),
    rowK: new Float32Array(H),
    rowG: new Float32Array(H),
    rowF: new Float32Array(H),
    rowR: new Float32Array(H),
    P: {},
  };
  params.s = S;
}

function spawnDef(S) {
  S.defs.push({
    z: 52 + 56 * Math.random(),
    sg: 5 + 4 * Math.random(),
    f: 0.9 + 1.0 * Math.random(),
    sgn: Math.random() < 0.5 ? -1 : 1,
    t0: S.t,
    dur: 9 + 9 * Math.random(),
    vz: -3 + 8 * Math.random(),
  });
}

// The slowly breathing numbers of the tube at this instant.
function derive(S) {
  const t = S.t;
  const ph = S.ph;
  const P = S.P;
  const p = cl((S.sk[1] - 0.5) / 3.5, 0, 1);
  const cur = cl((S.sk[2] + 1) / 2, 0, 1);
  P.p = p;
  P.cur = cur;
  P.tw = cl(S.sk[3], -1, 1);
  const lamB = 24 * (8 / 24) ** p;
  P.lam = lamB * (1 + 0.13 * sin((TAU * t) / 71 + ph[0]) + 0.09 * sin((TAU * t) / 113 + ph[1]) + 0.06 * sin((TAU * t) / 47.7 + ph[2]));
  const v = 3.4 * exp(1.95 * cur);
  P.v = v * (1 + 0.12 * sin((TAU * t) / 23 + ph[3]) + 0.08 * sin((TAU * t) / 37.3 + ph[4]));
  // curvature of the wavefronts: bulging toward the anode, a fraction of the wavelength
  const kc = 0.26 + 0.16 * sin((TAU * t) / 37 + ph[5]) + 0.09 * sin((TAU * t) / 61 + ph[6]) + 0.05 * sin((TAU * t) / 17.3 + ph[7]);
  P.curv = P.lam * cl(kc, 0.07, 0.5);
  // a slight lean that wanders, plus the twist of the magnetic field
  const nat = P.lam * (0.2 * sin((TAU * t) / 53 + ph[8]) + 0.13 * sin((TAU * t) / 29 + ph[9]) + 0.1 * sin((TAU * t) / 97 + ph[19]));
  P.lean = nat + 16 * P.tw;
  P.blur = sm(0.5, 1, cur);
  P.eps = max(0.09 + 0.2 * P.blur, 2.2 / P.lam);
  P.tau = max(0.36, 3.2 / P.lam) + 0.22 * P.blur;
  P.floor = 0.05 + 0.07 * p + 0.14 * P.blur;
  P.mod = 1 - 0.74 * sm(0.45, 1, cur);
  P.kb = 0.8 + 0.5 * cur;
  P.dd = (14 - 6 * p) * (1.1 - 0.25 * cur) * (1 + 0.08 * sin((TAU * t) / 37.1 + ph[12]));
  P.ng = (11 - 2 * p) * (0.85 + 0.3 * cur) * (1 + 0.09 * sin((TAU * t) / 43.3 + ph[13]) + 0.05 * sin((TAU * t) / 19.7 + ph[14]));
  P.rp = RW - 1 - 3 * p;
  P.fa = 0.17 * sm(0.55, 1, cur);
  // the peak of one slab, to scale its height to 1
  let pk = 0;
  const e1 = exp(-1 / P.tau);
  for (let i = 1; i < 40; i++) {
    const d = i / 40;
    const b = ((exp(-d / P.tau) - e1) / (1 - e1)) * sm(0, P.eps, d);
    if (b > pk) pk = b;
  }
  P.pk = max(pk, 0.2);
  P.e1 = e1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.sk = S.k.slice();
    S.first = false;
    spawnDef(S);
    S.defs[0].t0 -= 4;
  }
  const e = 1 - exp(-dt / 0.4);
  for (let i = 0; i < 4; i++) S.sk[i] += (S.k[i] - S.sk[i]) * e;
  S.t += dt;
  derive(S);
  S.Phi += (S.P.v / S.P.lam) * dt;
  for (let i = S.defs.length - 1; i >= 0; i--) if (S.t - S.defs[i].t0 > S.defs[i].dur) S.defs.splice(i, 1);
  if (S.t >= S.nextDef && S.defs.length < 4) {
    spawnDef(S);
    S.nextDef = S.t + 5 + 9 * Math.random();
  }
}

// The phase of the striations at every half LED along the tube, in cycles.
// The local wavelength wanders along the tube and in time, and a bump now
// and then folds the phase back on itself, which is where a pair of slabs is
// born or two neighbours merge.
function phaseTable(S) {
  const P = S.P;
  const t = S.t;
  const ph = S.ph;
  const k1 = TAU / 83;
  const k2 = TAU / 37;
  const th1 = ph[10] - (TAU * t) / 53;
  const th2 = ph[11] + (TAU * t) / 31;
  const a1 = 0.3;
  const a2 = 0.16;
  const inv = 1 / P.lam;
  const c1a = cos(k1 * ZA + th1);
  const c2a = cos(k2 * ZA + th2);
  const defs = S.defs;
  const tab = S.tab;
  for (let i = 0; i < NT; i++) {
    const z = ZT0 + i * 0.5;
    const zz = z - 60;
    let v = z - ZA - (0.2 * (zz * zz - 18 * 18)) / 140;
    v -= (a1 / k1) * (cos(k1 * z + th1) - c1a);
    v -= (a2 / k2) * (cos(k2 * z + th2) - c2a);
    v *= inv;
    for (let j = 0; j < defs.length; j++) {
      const d = defs[j];
      const age = t - d.t0;
      const s = sin((PI * age) / d.dur);
      const A = d.sgn * ((d.sg / (0.858 * P.lam)) * d.f) * s * s;
      const u = (z - d.z - d.vz * age) / d.sg;
      v += A * exp(-u * u);
    }
    tab[i] = v;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  derive(S);
  const P = S.P;
  const t = S.t;
  const { tab, lutC, lutN, lutK, rimX, rowE, rowA, rowN, rowK, rowG, rowF, rowR } = S;

  gasColours(S.sk[0], GOUT);
  const [CD, CC, CN, CK] = GOUT;
  const ND = [lerp(CD[0], CN[0], 0.3) * 0.8, lerp(CD[1], CN[1], 0.3) * 0.8, lerp(CD[2], CN[2], 0.3) * 0.8];
  const KD = [CK[0] * 0.42, CK[1] * 0.3, CK[2] * 0.3];
  ramp(lutC, CD, CC, 244, 0.56);
  ramp(lutN, ND, CN, 252, 0.78);
  ramp(lutK, KD, CK, 250, 0.55);

  phaseTable(S);

  // along the tube: z counts LEDs up from the foot of the panel
  const pulse = 0.5 + 0.5 * cos(TAU * (S.Phi + 0.1));
  const zc1 = 5 + P.dd + 2 * (0.5 - pulse);
  const zFs = zc1 + 1.7 * P.ng;
  const kfl = 1 + 0.14 * (2 * vn(t * 2.3 + 1.3, 0.5) - 1) + 0.08 * (2 * vn(t * 7.1 + 4.4, 2.5) - 1);
  for (let y = 0; y < H; y++) {
    const z = H - y - 0.5;
    const dn = max(0, z - zc1) / P.ng;
    rowN[y] = max(1.15 * (0.82 + 0.3 * pulse) * sm(zc1 - 0.8, zc1 + 2.4, z) * exp(-(dn ** 1.15)), 0.06 * sm(4, 9, z));
    const zk = z < 2.6 ? 0.5 + 0.5 * (z / 2.6) : exp(-(((z - 2.6) / 2.3) ** 2));
    rowK[y] = zk * kfl * (0.8 + 0.4 * pulse);
    const dz = (z - 114) / 3.5;
    rowE[y] = sm(zFs, zFs + 20, z) ** 0.9 * (1 - 0.5 * exp(-dz * dz)) * (1 + 0.24 * sin(TAU * (z / 95 - t / 43) + S.ph[15]) + 0.16 * sin(TAU * (z / 53 + t / 29) + S.ph[16]));
    rowA[y] = sm(zFs + 8, zFs + 34, z);
    const da = (H - z) / 4.2;
    rowG[y] = 1.25 * exp(-da * da);
    // the plasma lights the glass: brighter where the tube is
    rowR[y] = 0.22 + 0.78 * max(rowE[y], rowN[y] / 1.15, rowK[y] * 0.6, rowG[y] * 0.8);
    rowF[y] = 1 + P.fa * (2 * vn(t * 11 + 3.7, z / 19) - 1) + 0.45 * P.fa * (2 * vn(t * 26 + 9.1, z / 41 + 5) - 1);
  }

  // across the tube
  const rp = P.rp;
  const curv = P.curv;
  const lean = P.lean;
  const asr = 1 / asin(0.96);
  for (let x = 0; x < W; x++) {
    const q = (abs(x + 0.5 - CX) - RW + 0.2) / 1.9;
    rimX[x] = exp(-q * q);
  }

  const { tau, eps, e1, pk, mod } = P;
  const floorB = P.floor;
  const Phi = S.Phi;
  const kb = P.kb;
  const ie = 255 / IMAX;
  for (let y = 0; y < H; y++) {
    const z = H - y - 0.5;
    const E = rowE[y] * rowF[y] * kb;
    const Am = rowA[y] * mod;
    const N = rowN[y] * rowF[y] * kb;
    const Kc = rowK[y] * kb;
    const G = rowG[y] * rowF[y] * kb;
    const rR = rowR[y] * kb;
    // the column wanders a little from side to side
    const xo = 1.1 * sin(TAU * (z / 83 - t / 61) + S.ph[17]) + 0.7 * sin(TAU * (z / 47 + t / 37) + S.ph[18]);
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      const r = (dx - xo) / rp;
      const ar = abs(r);
      const rad = ar < 1 ? max(0, j0(2.405 * ar)) : 0;
      const lr = rad > 1e-4 ? log(rad) : -9;
      const rc = cl(r, -0.96, 0.96);
      // the phase here, then the slab it falls in
      const f = (z + curv * r * r + lean * asin(rc) * asr - ZT0) * 2;
      const fi = floor(f);
      const fr = f - fi;
      const phase = tab[fi] + (tab[fi + 1] - tab[fi]) * fr - Phi;
      const n = floor(phase);
      const d = 1 - (phase - n);
      const tn = tau * (0.74 + 0.52 * hh(n, 3));
      const en = exp(-1 / tn);
      let b = ((exp(-d / tn) - en) / (1 - en)) * sm(0, eps, d);
      b = (b / pk) * (0.62 + 0.55 * hh(n, 11));
      if (b > 1.1) b = 1.1;
      const bf = floorB + (1 - floorB) * b;
      const g = 1 - Am * (1 - bf);
      let Ic = 0;
      let In = 0;
      let Ik = 0;
      if (rad > 0) {
        const gam = 0.58 + 0.9 * (1 - cl(bf, 0, 1));
        Ic = E * g * exp(gam * lr);
        In = N * exp(0.75 * lr);
        Ik = Kc * exp(0.4 * lr);
      }
      // the anode glow, a tuft on the axis
      const ax = dx / 10;
      const Ia = G * exp(-ax * ax);
      const rim = rimX[x] * rR * (0.35 + 0.65 * cl(bf, 0, 1)) * 0.27;
      const i1 = cl((Ic * ie) | 0, 0, 255) * 3;
      const i2 = cl(((In + Ia + rim) * ie) | 0, 0, 255) * 3;
      const i3 = cl((Ik * ie) | 0, 0, 255) * 3;
      // screen the three lights together
      const cr = 255 - ((255 - lutC[i1]) * (255 - lutN[i2]) * (255 - lutK[i3])) / 65025;
      const cg = 255 - ((255 - lutC[i1 + 1]) * (255 - lutN[i2 + 1]) * (255 - lutK[i3 + 1])) / 65025;
      const cb = 255 - ((255 - lutC[i1 + 2]) * (255 - lutN[i2 + 2]) * (255 - lutK[i3 + 2])) / 65025;
      display.setPixel(x, y, cr, cg, cb);
    }
  }
}
