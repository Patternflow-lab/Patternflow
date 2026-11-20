// ===== Patternflow pattern =====
// Title:   Eyewall Radar
// Family:  stormradar
// Idea:    A mature hurricane as a weather radar paints it in stepped reflectivity colour: a clear eye, a ring of red and magenta eyewall, spiral rainbands whose convective cells grow and die, and now and then a second eyewall that forms from a band, opens a moat and takes over from the inner ring.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hugh Willoughby, John Clos and Mohammed Shoreibah on concentric eyewalls and their replacement (1982), Robert Houze and others on the outer eyewall of Hurricane Rita (2007), the NEXRAD reflectivity colour table in 5 dBZ steps; pattern round 205
// Round:   205
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Intensity=0..3, Spiral=-1..1, Replacement=0..0.2
//
// Knob 1: Hue. Turns the whole stepped palette round the wheel. At 0 it is the true radar table, cyan and blue for drizzle, then green, yellow, orange, red, magenta and white for the hardest echo, and a full turn brings it back.
// Knob 2: Intensity. How strong the storm is. At 0 a depression with no eye, a ragged green centre and arms at 20 to 30 dBZ; at 1 a filled, uneven eye; at 2 (start) an eye about 12 LEDs across (9 to 18) in a ring about 8 LEDs thick at 40 dBZ and over, with red and magenta cores; at 3 an eye 10 LEDs across and a ring 10 LEDs thick that peaks in white.
// Knob 3: Spiral. How many arms and how tightly they wind. At -1 two open arms at 36 degrees to the circle that leave the panel almost straight; at 0 (start) four arms at 25 degrees; at 1 six arms at 14 degrees that wrap the eye in near-circles.
// Knob 4: Replacement. How often a second eyewall is born from a band, in births per ten seconds. At 0 never; at 0.06 (start) about one every 170 s, and the swap takes about 95 s; at 0.2 one every 50 s and the swap takes 28 s. After a swap the eye is 17 to 21 LEDs across and shrinks back over about three minutes.

const W = 64;
const H = 128;
const N = W * H;
const { floor, sqrt, exp, log, sin, cos, atan2, abs, min, max, tanh, pow, PI } = Math;
const TAU = 2 * PI;
const LN10 = Math.LN10 / 10;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
const wrap = (a) => a - TAU * floor((a + PI) / TAU);
const rnd = (a, b) => a + (b - a) * Math.random();
const HX = 32;
const HY = 50;

// The NEXRAD-style table, one colour per 5 dBZ from 15 up to 65 and over. The
// drizzle end is lifted a little: round LEDs at 20/255 hardly show.
const PAL = [
  [45, 175, 205], // 15 light cyan
  [50, 110, 255], // 20 blue
  [40, 225, 70], // 25 green
  [155, 235, 40], // 30 yellow-green
  [255, 245, 40], // 35 yellow
  [255, 190, 25], // 40 gold
  [255, 130, 20], // 45 orange
  [255, 45, 30], // 50 red
  [220, 10, 85], // 55 crimson
  [255, 40, 235], // 60 magenta
  [255, 235, 255], // 65 white
];
const NP = PAL.length;

function rgb2hsv(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}
const PALHSV = PAL.map(rgb2hsv);

// Band phases live on a log-spaced radial grid, so a spiral arm can be bent by
// the wind without ever being a formula in one variable.
const NRG = 40;
const RMIN = 6;
const RMAX = 130;
const LRMIN = log(RMIN);
const DLR = (log(RMAX) - LRMIN) / (NRG - 1);
const RG = new Float64Array(NRG);
const LRG = new Float64Array(NRG);
for (let j = 0; j < NRG; j++) {
  LRG[j] = LRMIN + j * DLR;
  RG[j] = exp(LRG[j]);
}
const LR20 = log(20);
const LN7 = log(7);
const NB = 96; // azimuth bins of a ring table
const NSLOT = 6;
const NCELL = 160;
const TL = 80; // texture lattice, 2.4 LEDs a cell, in the storm's own frame
const TS = 2.4;
const TH = (TL * TS) / 2;

const newRing = () => ({
  R: 10, Z: 55, wi: 1.5, wo: 3.4, cov: 1, phi: 0, act: 1, a2: 0, a3: 0,
  ps: [0, 1, 2, 3, 4, 5].map(() => rnd(0, TAU)),
  tR: new Float32Array(NB), tZ: new Float32Array(NB), tW: new Float32Array(NB),
});

export function setup(params) {
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.06],
    I: 0.67, u3: 0.5, v: 0.06,
    iw: 0, is: 0, rou: 0, rs: 0, zou: 0, zs: 0, om0: 0.15, omou: 0,
    px: 0, py: 0, vx: 0, vy: 0, wph: rnd(0, TAU), wom: 0.27, wr: 1.4, w2: rnd(0, TAU),
    cx: HX, cy: HY,
    r1: newRing(), r2: newRing(), rx: 0,
    erc: { on: false, p: 0, clock: 0, E: 0.13, D: 95, spd: 1, g: 0, R2a: 25, R2f: 10, s: [0, 0, 0, 0, 0] },
    bands: [], gen: 0,
    cells: [],
    nx: 0,
    tx: [0, 1].map((m) => ({ age: m * 25, rot: 0, T: 50, lat: new Float32Array(TL * TL) })),
    pc: new Float32Array(N), pr: new Float32Array(N), Z: new Float32Array(N), cl: new Float32Array(N),
    CA: new Float32Array(33 * 65), CB: new Float32Array(33 * 65), cb: 0,
    pal: PAL.map(() => [0, 0, 0]),
  };
  for (let i = 0; i < 33 * 65; i++) {
    S.CA[i] = Math.random();
    S.CB[i] = Math.random();
  }
  for (const L of S.tx) for (let i = 0; i < L.lat.length; i++) L.lat[i] = Math.random();
  for (let i = 0; i < NCELL; i++) S.cells.push({ on: false });
  for (let k = 0; k < NSLOT; k++) {
    S.bands.push({ dead: true, wait: 0, gen: 0, age: 0, life: 1, phi: new Float64Array(NRG), str: 0, b: 0.5, sina: 0.45 });
  }
  params.s = S;
}

const omega = (S, r) => S.om0 * pow(7 / max(r, 7), 0.55);

// bands
function bandIdeal(bd, lr) {
  return bd.ang - (lr - LR20) / bd.b;
}

function newBand(S, k, first, slot) {
  const bd = S.bands[k];
  const u = S.u3;
  bd.dead = false;
  bd.gen = ++S.gen;
  bd.life = rnd(230, 430);
  // The first arms are spread through their lives so they do not all die together.
  bd.age = first ? bd.life * 0.7 * ((slot + Math.random()) / NSLOT) : 0;
  bd.amp = rnd(0.7, 1.15); // a few dBZ hotter or cooler than the others
  const alpha = (36 - 22 * u) * (PI / 180) * exp(0.22 * gauss());
  bd.b0 = Math.tan(alpha);
  bd.b = bd.b0;
  bd.sina = bd.b / sqrt(1 + bd.b * bd.b);
  bd.om = rnd(0.035, 0.075);
  bd.rin0 = rnd(28, 50);
  bd.rin1 = rnd(19, 26);
  bd.bx = 0;
  bd.bs = 0;
  // A random angle that is not on top of an arm already out there. Arms that
  // sweep down the long side of the panel are kept more often.
  let best = rnd(0, TAU);
  for (let t = 0; t < 8; t++) {
    const a = rnd(0, TAU);
    let d = 9;
    for (let j = 0; j < NSLOT; j++) {
      const o = S.bands[j];
      if (j === k || o.dead) continue;
      d = min(d, abs(wrap(a - (o.ang - (log(30) - LR20) / o.b))));
    }
    if (d > 0.55 && Math.random() < 0.6 - 0.4 * sin(a - (log(60) - log(30)) / bd.b0)) {
      best = a;
      break;
    }
  }
  bd.ang = best + (log(30) - LR20) / bd.b;
  for (let j = 0; j < NRG; j++) bd.phi[j] = bandIdeal(bd, LRG[j]);
}

const rin = (bd) => bd.rin0 + (bd.rin1 - bd.rin0) * sst(0, 0.4 * bd.life, bd.age);
const strOf = (bd) => sst(0, 12, bd.age) * (1 - sst(bd.life - 18, bd.life, bd.age));

function phiAt(bd, r) {
  const x = cl((log(r) - LRMIN) / DLR, 0, NRG - 1.001);
  const i = floor(x), f = x - i;
  return bd.phi[i] + (bd.phi[i + 1] - bd.phi[i]) * f;
}

function updateBands(S, dt) {
  const count = 2.3 + 3.7 * S.u3;
  const relax = 1 - exp(-dt / 28);
  for (let k = 0; k < NSLOT; k++) {
    const bd = S.bands[k];
    const wk = cl((count - k - 0.3) / 0.5, 0, 1);
    if (bd.dead) {
      bd.str = 0;
      bd.wait -= dt;
      if (bd.wait <= 0 && wk > 0.15) newBand(S, k, false);
      continue;
    }
    bd.age += dt;
    if (bd.age >= bd.life) {
      bd.dead = true;
      bd.wait = rnd(2, 14);
      bd.str = 0;
      continue;
    }
    // The pitch breathes: the arm winds in and out about its own mean.
    bd.bx += (-bd.bx / 60) * dt + 0.2 * sqrt((2 * dt) / 60) * gauss();
    bd.bs += (bd.bx - bd.bs) * (1 - exp(-dt / 7));
    bd.b = bd.b0 * exp(0.45 * bd.bs);
    bd.sina = bd.b / sqrt(1 + bd.b * bd.b);
    bd.om += (0.055 - bd.om) * dt / 90 + 0.003 * sqrt(dt) * gauss() * 0.3;
    bd.ang += bd.om * dt;
    for (let j = 0; j < NRG; j++) {
      bd.phi[j] += omega(S, RG[j]) * dt;
      bd.phi[j] += (bandIdeal(bd, LRG[j]) - bd.phi[j]) * relax;
    }
    bd.str = strOf(bd) * wk;
  }
}

// rings
const zRing = (I) => 25 + 30 * pow(I, 0.9);
const rBase = (I) => 12.4 - 3.8 * I;

function updateRings(S, dt) {
  const I = S.Ie;
  S.rou += (-S.rou / 40) * dt + 0.9 * sqrt((2 * dt) / 40) * gauss();
  S.zou += (-S.zou / 40) * dt + 2.2 * sqrt((2 * dt) / 40) * gauss();
  S.rs += (S.rou - S.rs) * (1 - exp(-dt / 6));
  S.zs += (S.zou - S.zs) * (1 - exp(-dt / 6));
  S.rx *= exp(-dt / 170);
  const r1 = S.r1;
  S.Rb = rBase(I) + 0.6 * S.rs;
  r1.R += (S.Rb + S.rx - r1.R) * (1 - exp(-dt / 12));
  const zt = zRing(I) + S.zs;
  r1.Z += (zt - r1.Z) * (1 - exp(-dt / 25));
  const ek = 1 - exp(-dt / 8);
  r1.wi += (1.1 + 0.4 * (1 - I) - r1.wi) * ek;
  r1.wo += (2.3 + 1.0 * (1 - I) - r1.wo) * ek;
  const om = omega(S, r1.R);
  for (let i = 0; i < 6; i++) r1.ps[i] += dt * om * [0.7, 1.25, 0.35, 0.5, 0.8, 0.2][i] * (1 + 0.1 * i);
  r1.act = 1;
  r1.cov = 1;
}

function ringTables(S) {
  const rings = [S.r1, S.r2];
  for (let m = 0; m < 2; m++) {
    const g = rings[m];
    if (g.act < 0.01) continue;
    // How far the wall is from round drifts on slow waves that never meet again.
    g.a2 = 0.05 + 0.03 * sin(0.043 * S.t + g.ps[3] * 1.7) + 0.015 * sin(0.0171 * S.t + g.ps[1]);
    g.a3 = 0.03 + 0.018 * sin(0.0517 * S.t + g.ps[2]) + 0.008 * sin(0.0133 * S.t + g.ps[4]);
    for (let b = 0; b < NB; b++) {
      const th = ((b + 0.5) / NB) * TAU - PI;
      g.tR[b] = g.R * (1 + g.a2 * cos(2 * th - g.ps[0]) + g.a3 * cos(3 * th - g.ps[1]));
      let z = g.Z + 5.5 * cos(th - g.ps[2]) + 4 * cos(2 * th - g.ps[3]) + 2.5 * cos(3 * th - g.ps[4]);
      if (g.cov < 0.999) {
        const d = abs(wrap(th - g.phi));
        z -= 38 * sst(PI * g.cov - 0.9, PI * g.cov + 0.35, d);
      }
      g.tZ[b] = z;
      g.tW[b] = g.wo * (1 + 0.22 * cos(th - g.ps[5]));
    }
  }
}

function ringRad(g, th) {
  const x = (th + PI) * (NB / TAU) - 0.5;
  const i = floor(x), f = x - i;
  return g.tR[((i % NB) + NB) % NB] * (1 - f) + g.tR[(((i + 1) % NB) + NB) % NB] * f;
}
function ringZ(g, th) {
  const x = (th + PI) * (NB / TAU) - 0.5;
  const i = floor(x), f = x - i;
  return g.tZ[((i % NB) + NB) % NB] * (1 - f) + g.tZ[(((i + 1) % NB) + NB) % NB] * f;
}

function updateErc(S, dt) {
  const e = S.erc;
  const v = S.v;
  const r2 = S.r2;
  if (!e.on) {
    r2.act = 0;
    if (v > 0.002) e.clock += (dt * v) / 10;
    if (e.clock >= e.E) {
      e.on = true;
      e.p = 0;
      e.D = cl(5.7 / max(v, 0.01), 26, 220);
      e.spd = rnd(0.82, 1.22);
      e.R2a = S.r1.R + rnd(13, 17);
      e.R2f = S.Rb * rnd(1.15, 1.32);
      let best = null, bs = 0;
      for (const bd of S.bands) if (!bd.dead && bd.str > bs) {
        bs = bd.str;
        best = bd;
      }
      r2.phi = best ? phiAt(best, e.R2a) : rnd(-PI, PI);
      r2.ps = [0, 1, 2, 3, 4, 5].map(() => rnd(0, TAU));
      r2.R = e.R2a;
      r2.Z = 24;
      r2.cov = 0.2;
    }
    if (!e.on) return;
  }
  // Progress is not steady: it stalls and rushes, so no two swaps keep time.
  e.g += (-e.g / 20) * dt + 0.35 * sqrt((2 * dt) / 20) * gauss();
  e.D = cl(5.7 / max(v, 0.01), 26, 220);
  e.p += (dt * e.spd * exp(e.g)) / e.D;
  const p = e.p;
  const s = e.s;
  s[0] = sst(0, 0.3, p); // the outer arc builds
  s[1] = sst(0.16, 0.55, p); // and closes into a ring
  s[2] = sst(0.22, 0.5, p) * (1 - sst(0.82, 1, p)); // the moat
  s[3] = sst(0.34, 0.85, p); // the inner wall starves
  s[4] = sst(0.38, 1.0, p); // the outer ring contracts
  const I = S.Ie;
  r2.act = sst(0, 0.04, p);
  r2.R = e.R2a + (e.R2f - e.R2a) * s[4];
  const zt = zRing(I) - 3;
  r2.Z = 24 + (zt - 24) * s[0];
  r2.cov = 0.2 + 0.8 * s[1];
  r2.wi = 1.7 + 0.5 * (1 - s[4]);
  r2.wo = 2.7;
  const om = omega(S, r2.R);
  for (let i = 0; i < 6; i++) r2.ps[i] += dt * om * [0.7, 1.25, 0.35, 0.5, 0.8, 0.2][i] * (1 + 0.1 * i);
  r2.phi += dt * om * 0.9;
  if (p >= 1) {
    // The outer ring is now the eyewall; the old one is gone.
    const r1 = S.r1;
    r1.R = r2.R;
    r1.Z = r2.Z;
    r1.wi = r2.wi;
    r1.wo = r2.wo;
    r1.ps = r2.ps.slice();
    S.rx = r1.R - S.Rb;
    e.on = false;
    e.clock = 0;
    e.E = max(0.25, -log(1 - Math.random()));
    r2.act = 0;
    for (const c of S.cells) if (c.on && c.kind === 1 && c.ring === 2) c.ring = 1;
  }
}

// cells
function spawn(S, kind, ring, bandIdx) {
  let c = null;
  for (const q of S.cells) if (!q.on) {
    c = q;
    break;
  }
  if (!c) return;
  c.on = true;
  c.kind = kind;
  c.age = 0;
  c.ring = ring;
  c.band = bandIdx;
  if (kind === 1) {
    c.life = rnd(24, 62);
    c.th = rnd(-PI, PI);
    c.off = gauss() * 0.9;
    c.dz = rnd(3, 15);
    c.sr = rnd(1.5, 2.1);
    c.st = rnd(2.4, 4.8);
    c.sh = rnd(0.94, 1.06);
  } else if (kind === 0) {
    const bd = S.bands[bandIdx];
    c.gen = bd.gen;
    c.life = rnd(26, 70);
    const r0 = rin(bd);
    c.r = rnd(r0 + 4, r0 + 4 + rnd(10, 55));
    c.off = gauss() * 0.8;
    c.dz = rnd(2, 11);
    c.sr = rnd(1.2, 1.9);
    c.st = rnd(1.8, 3.8);
    c.vr = rnd(0.12, 0.45);
  }
}

function updateCells(S, dt) {
  const r1 = S.r1, r2 = S.r2;
  // Births. Wall cells ride the rings and band cells ride the arms.
  if (Math.random() < dt * 0.24) spawn(S, 1, 1, 0);
  if (r2.act > 0.5 && Math.random() < dt * 0.24 * r2.act) spawn(S, 1, 2, 0);
  let tot = 0;
  for (const bd of S.bands) tot += bd.str;
  if (tot > 0.01 && Math.random() < dt * 0.55 * min(tot, 3)) {
    let x = Math.random() * tot, k = 0;
    for (; k < NSLOT - 1; k++) {
      x -= S.bands[k].str;
      if (x <= 0) break;
    }
    if (!S.bands[k].dead) spawn(S, 0, 0, k);
  }
  for (const c of S.cells) {
    if (!c.on) continue;
    c.age += dt;
    if (c.age >= c.life) {
      c.on = false;
      continue;
    }
    if (c.kind === 1) {
      const g = c.ring === 2 ? r2 : r1;
      if (c.ring === 2 && r2.act < 0.01) {
        c.on = false;
        continue;
      }
      c.th = wrap(c.th + dt * omega(S, g.R) * c.sh);
      c.r = ringRad(g, c.th) + c.off;
    } else if (c.kind === 0) {
      const bd = S.bands[c.band];
      if (bd.dead || bd.gen !== c.gen) {
        c.life = min(c.life, c.age + 2);
        if (bd.dead) c.life = c.age + 0.01;
        if (bd.gen !== c.gen) c.on = false;
        continue;
      }
      c.r -= dt * c.vr;
      if (c.r < rin(bd) + 1) c.life = min(c.life, c.age + 3);
      c.r = max(c.r, RMIN + 1);
      c.th = wrap(phiAt(bd, c.r) + c.off / (c.r * bd.sina));
    }
  }
}

function splat(S) {
  const { pc, pr } = S;
  pc.fill(0);
  pr.fill(0);
  const cx = S.cx, cy = S.cy;
  for (const c of S.cells) {
    if (!c.on) continue;
    const e = sin((PI * c.age) / c.life);
    const env = pow(e, 1.4);
    let pk, grid = pc;
    if (c.kind === 1) {
      const g = c.ring === 2 ? S.r2 : S.r1;
      pk = ringZ(g, c.th) + c.dz - (c.ring === 1 && S.erc.on ? 34 * S.erc.s[3] : 0);
      grid = pr;
    } else {
      const bd = S.bands[c.band];
      pk = bandPk(S, bd, c.r) + c.dz - 45 * (1 - cl(bd.str * bandEnv(bd, c.r), 0, 1));
    }
    const amp = exp(pk * LN10) * env * env;
    if (amp < 2) continue;
    const ct = cos(c.th), st = sin(c.th);
    const px = cx + c.r * ct, py = cy - c.r * st;
    const rad = 3.6 * max(c.sr, c.st);
    const x0 = max(0, floor(px - rad)), x1 = min(W - 1, floor(px + rad));
    const y0 = max(0, floor(py - rad)), y1 = min(H - 1, floor(py + rad));
    const ir = 1 / (2 * c.sr * c.sr), it = 1 / (2 * c.st * c.st);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - py;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px;
        const u = dx * ct - dy * st;
        const w = -dx * st - dy * ct;
        const q = u * u * ir + w * w * it;
        if (q < 8) grid[y * W + x] += amp * exp(-q);
      }
    }
  }
}

const bandEnv = (bd, r) => sst(rin(bd) - 5, rin(bd) + 9, r) * (1 - sst(80, 105, r));

function bandPk(S, bd, r) {
  return 17 + 19 * S.Ie - 8 * sst(30, 100, r) + 4 * (1 - sst(15, 45, r)) + 7 * (bd.amp - 0.9);
}

// storm
function stormMove(S, dt) {
  S.vx += (-S.vx / 30) * dt + 0.2 * sqrt((2 * dt) / 30) * gauss();
  S.vy += (-S.vy / 30) * dt + 0.22 * sqrt((2 * dt) / 30) * gauss();
  S.px += (S.vx - S.px * 0.009) * dt;
  S.py += (S.vy - S.py * 0.009) * dt;
  // The eye does not go straight: it loops, a trochoid on top of the track.
  S.nx += (-S.nx / 50) * dt + 0.25 * sqrt((2 * dt) / 50) * gauss();
  S.wom = 0.27 * exp(0.25 * tanh(S.nx));
  S.wph += S.wom * dt;
  S.cx = HX + 13 * tanh(S.px / 13) + S.wr * cos(S.wph) + 0.45 * S.wr * cos(2.31 * S.wph + S.w2);
  S.cy = HY + 15 * tanh(S.py / 15) + S.wr * sin(S.wph) + 0.45 * S.wr * sin(2.31 * S.wph + S.w2);
  S.omou += (-S.omou / 50) * dt + 0.5 * sqrt((2 * dt) / 50) * gauss();
  S.om0 = 0.15 * exp(0.12 * tanh(S.omou));
}

function advance(S, dt) {
  S.t += dt;
  const e = 1 - exp(-dt / 1.2);
  S.I += (cl(S.k[1] / 3, 0, 1) - S.I) * e;
  S.u3 += (cl((S.k[2] + 1) / 2, 0, 1) - S.u3) * e;
  S.v += (cl(S.k[3], 0, 0.2) - S.v) * e;
  S.iw += (-S.iw / 60) * dt + 0.06 * sqrt((2 * dt) / 60) * gauss();
  S.is += (S.iw - S.is) * (1 - exp(-dt / 8));
  S.Ie = cl(S.I + S.is * (0.3 + S.I), 0, 1);
  stormMove(S, dt);
  updateRings(S, dt);
  updateErc(S, dt);
  ringTables(S);
  updateBands(S, dt);
  updateCells(S, dt);
  // The mottle of the echo: two lattices that turn with the wind and trade places.
  for (const L of S.tx) {
    L.age += dt;
    L.rot += S.om0 * dt;
    if (L.age >= L.T) {
      L.age -= L.T;
      L.rot = 0;
      for (let i = 0; i < L.lat.length; i++) L.lat[i] = Math.random();
    }
  }
  S.cb += dt / 6;
  if (S.cb >= 1) {
    S.cb -= 1;
    S.CA.set(S.CB);
    for (let i = 0; i < S.CB.length; i++) S.CB[i] = Math.random();
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.I = cl(S.k[1] / 3, 0, 1);
    S.u3 = cl((S.k[2] + 1) / 2, 0, 1);
    S.v = cl(S.k[3], 0, 0.2);
    S.Ie = S.I;
    S.r1.R = rBase(S.I);
    S.r1.Z = zRing(S.I);
    S.Rb = S.r1.R;
    for (let k = 0; k < NSLOT; k++) {
      if (cl((2.3 + 3.7 * S.u3 - k - 0.3) / 0.5, 0, 1) > 0.1) newBand(S, k, true, k);
    }
    // Open on a storm that has been turning for a minute.
    for (let t = 0; t < 55; t += 0.1) advance(S, 0.1);
    S.first = false;
  }
  advance(S, dt);
}

// picture
function paint(S, k0) {
  const pal = S.pal;
  const rgb = [0, 0, 0];
  for (let i = 0; i < NP; i++) {
    const h = PALHSV[i];
    hsv2rgb(h[0] + k0, h[1], h[2], rgb);
    pal[i][0] = rgb[0];
    pal[i][1] = rgb[1];
    pal[i][2] = rgb[2];
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  splat(S);
  const { pc, pr, Z, r1, r2, erc } = S;
  const cx = S.cx, cy = S.cy;
  const I = S.Ie;
  const eyeOpen = sst(0.1, 0.5, I);
  const zFill = 12 + 18 * (1 - eyeOpen);
  const pFill = exp(zFill * LN10);
  const e = erc;
  const sm = e.on ? e.s[2] : 0;
  const rm = 0.5 * (r1.R + r2.R) + 1;
  const wm = max(2.5, 0.5 * (r2.R - r1.R) - 3.5);
  const ring2 = r2.act > 0.01;
  const tCl = cl(S.cb, 0, 1);
  const tw = tCl * tCl * (3 - 2 * tCl);
  const { CA, CB } = S;
  const act = S.bands.filter((bd) => bd.str >= 0.02);
  for (const bd of act) bd.rn = rin(bd);
  // Two lattices half a period apart, so their weights always make a whole.
  const tws = S.tx.map((L) => sin((PI * L.age) / L.T));
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    // Sea clutter lattice, 2 LEDs a cell, drifting between two random draws.
    const gy = (y + 0.5) / 2, iy = floor(gy);
    let fy = gy - iy;
    fy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const r = sqrt(dx * dx + dy * dy) + 1e-6;
      const th = atan2(-dy, dx);
      const bi = (th + PI) * (NB / TAU) - 0.5;
      const i0 = floor(bi), bf = bi - i0;
      const ia = ((i0 % NB) + NB) % NB, ib = (ia + 1) % NB;
      const i = y * W + x;
      // Eye and moat take away everything that is not a wall.
      const R1 = r1.tR[ia] * (1 - bf) + r1.tR[ib] * bf;
      const eyeM = sst(R1 - 4, R1 - 1.8, r);
      const moat = sm > 0 ? 1 - 0.95 * sm * exp(-((r - rm) / wm) * ((r - rm) / wm)) : 1;
      let P = pr[i] * eyeM + pc[i] * eyeM * moat;
      // Weak storms have no eye: the middle is filled with light rain.
      P += pFill * (1 - sst(R1 - 1.5, R1 + 0.5, r));
      // Spiral arms.
      const lr = log(r);
      for (const bd of act) {
        const rn = bd.rn;
        if (r < rn - 6) continue;
        const gx = cl((lr - LRMIN) / DLR, 0, NRG - 1.001);
        const gi = floor(gx);
        const ph = bd.phi[gi] + (bd.phi[gi + 1] - bd.phi[gi]) * (gx - gi);
        const d = wrap(th - ph);
        const dp = r * abs(d) * bd.sina;
        const w = 1.6 + 2 * sst(15, 85, r);
        const q = dp / w;
        if (q > 7) continue;
        const env = bandEnv(bd, r);
        const z0 = bandPk(S, bd, r) - 45 * (1 - cl(bd.str * env, 0, 1));
        // A skirt of light rain about every arm.
        const zs = z0 - 19 - 12 * (q / 2.2) * (q / 2.2);
        let pb = exp((z0 - 12 * q * q) * LN10);
        if (zs > 0) pb += exp(zs * LN10);
        P += pb * eyeM * moat;
      }
      // Eyewalls.
      {
        const dd = r - R1;
        const w = dd < 0 ? r1.wi : r1.tW[ia] * (1 - bf) + r1.tW[ib] * bf;
        const q = dd / w;
        if (q < 3.5 && q > -3.5) {
          const z = r1.tZ[ia] * (1 - bf) + r1.tZ[ib] * bf - 12 * q * q - (e.on ? 34 * e.s[3] : 0);
          if (z > 0) P += exp(z * LN10);
        }
      }
      if (ring2) {
        const R2 = r2.tR[ia] * (1 - bf) + r2.tR[ib] * bf;
        const dd = r - R2;
        const w = dd < 0 ? r2.wi : r2.tW[ia] * (1 - bf) + r2.tW[ib] * bf;
        const q = dd / w;
        if (q < 3.5 && q > -3.5) {
          const z = r2.tZ[ia] * (1 - bf) + r2.tZ[ib] * bf - 12 * q * q - 40 * (1 - r2.act);
          if (z > 0) P += exp(z * LN10);
        }
      }
      // Sea clutter, only in the weakest blues.
      {
        const gx = (x + 0.5) / 2, ix = floor(gx);
        let fx = gx - ix;
        fx = fx * fx * (3 - 2 * fx);
        const o = iy * 33 + ix;
        const a = CA[o] + (CB[o] - CA[o]) * tw, b = CA[o + 1] + (CB[o + 1] - CA[o + 1]) * tw;
        const c = CA[o + 33] + (CB[o + 33] - CA[o + 33]) * tw, d = CA[o + 34] + (CB[o + 34] - CA[o + 34]) * tw;
        const n = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
        S.cl[i] = sst(0.73, 0.97, n);
      }
      let z = P > 1e-3 ? log(P) / LN10 : -30;
      if (z > 12) {
        // The filled middle of a weak storm gets the mottle too, whatever its level.
        const gain = max(sst(14, 32, z), 2.2 * (1 - eyeOpen) * (1 - sst(R1 - 1.5, R1 + 0.5, r)));
        // Convective mottle, stronger where the echo is.
        const fr = exp(-0.55 * max(lr - LN7, 0));
        let tn = 0;
        for (let m = 0; m < 2; m++) {
          if (tws[m] < 0.01) continue;
          const L = S.tx[m];
          const a = th - L.rot * fr;
          const gx = (r * cos(a) + TH) / TS, gy = (r * sin(a) + TH) / TS;
          const ix = cl(floor(gx), 0, TL - 2), iy2 = cl(floor(gy), 0, TL - 2);
          let fx = cl(gx - ix, 0, 1), fy2 = cl(gy - iy2, 0, 1);
          fx = fx * fx * (3 - 2 * fx);
          fy2 = fy2 * fy2 * (3 - 2 * fy2);
          const o = iy2 * TL + ix, lat = L.lat;
          const v = (lat[o] * (1 - fx) + lat[o + 1] * fx) * (1 - fy2) + (lat[o + TL] * (1 - fx) + lat[o + TL + 1] * fx) * fy2;
          tn += (v - 0.5) * tws[m];
        }
        z += 12 * tn * gain;
      }
      Z[i] = z;
    }
  }
  paint(S, S.k[0]);
  const pal = S.pal;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const z = Z[i];
      if (z < 11) {
        const q = S.cl[i];
        if (q > 0.2) display.setPixel(x, y, pal[0][0] * 0.6 * q, pal[0][1] * 0.6 * q, pal[0][2] * 0.6 * q);
        continue;
      }
      const u = z / 5;
      const gx = x > 0 && x < W - 1 ? (Z[i + 1] - Z[i - 1]) * 0.5 : 0;
      const gy = y > 0 && y < H - 1 ? (Z[i + W] - Z[i - W]) * 0.5 : 0;
      // The edge between two steps is about one LED wide wherever the field is steep.
      const wb = cl(sqrt(gx * gx + gy * gy) / 5, 0.1, 0.55);
      const n = floor(u + 0.5);
      const t = sst(-0.5, 0.5, (u - n) / wb);
      const lo = n - 4, hi = n - 3;
      let r = 0, g = 0, b = 0;
      if (hi >= 0 && t > 0) {
        const c = pal[min(hi, NP - 1)];
        r += c[0] * t;
        g += c[1] * t;
        b += c[2] * t;
      }
      if (lo >= 0 && t < 1) {
        const c = pal[min(lo, NP - 1)];
        r += c[0] * (1 - t);
        g += c[1] * (1 - t);
        b += c[2] * (1 - t);
      }
      if (r + g + b > 0) display.setPixel(x, y, r, g, b);
    }
}
