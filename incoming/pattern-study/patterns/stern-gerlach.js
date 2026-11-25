// ===== Patternflow pattern =====
// Title:   Stern-Gerlach
// Family:  sterngerlach
// Idea:    A beam of atoms runs down the panel through three Stern-Gerlach analyzers in a row, each a faint field of colour that sends every atom, by chance, down one of two curved branches, the first stopping its left branch in a flare, the middle one turned by the Angle knob so it splits the survivors by cos squared of half the angle, and the last one, set like the first, bringing the stopped colour back on both its branches, until four bars of arrivals grow and fade on the screen at the foot.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Stern-Gerlach experiment (Otto Stern and Walther Gerlach, 1922) and the sequential Stern-Gerlach analyzers with the cos squared of half the angle rule of spin one half (Feynman, Lectures on Physics III, 1965, and Sakurai, 1985), all from memory; the vertical three-stage layout, the one colour per spin state, the field drawn as a colour gradient with a few field lines, the forgetful histogram screen and the sampling of each atom's branch from the angle left by the one before are original, pattern round 251
// Round:   251
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flux=0.3..2.5, Angle=-1..1, Gradient=-1..1
//
// Knob 1: Hue. Turns the four spin colours round the wheel together; it opens on teal, indigo, magenta and gold.
// Knob 2: Flux. 0.3 to 2.5, opening at 2. How thick and how fast the beam of atoms is: a slow trickle of single atoms at 0.3, a fast dense stream at 2.5.
// Knob 3: Angle. -1 to 1, opening at 0. The axis of the middle analyzer from the same as the others (-1, the beam is only bent and not split) through a quarter turn at 0, where it splits in half and the last analyzer splits both halves again, to the opposite axis (1, the beam is bent the other way); the branch weights follow cos squared of half the angle.
// Knob 4: Gradient. -1 to 1, opening at about 0.06. How steep the field is: weak at -1, where the branches stay a few LEDs apart and the screen shows one smeared bar, strong at 1, where the four bars stand far apart.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
const fin = (v, d) => (Number.isFinite(v) ? v : d);

// ---- layout, in rows ------------------------------------------------------------
const CX = 32;
const YSRC = 3.5;                   // where atoms are born
const S1A = 12, S1B = 38, YM1 = 26; // first analyzer, its widest point
const YSTOP = 28.5;                 // the left branch of the first analyzer ends here
const S2A = 46, S2B = 72;           // middle analyzer
const S3A = 80, S3B = 106;          // last analyzer
const YDET = 109.5;                 // the last row where the beams are guaranteed to run; the screen is the floor of the panel
const BW = 5;                       // width of a pile
const BARH = 17;                    // tallest pile of arrivals, in rows up from the floor
const MAXA = 1500, MAXE = 360, MAXB = 200;
const TAU = 26;                     // seconds the screen remembers
const D1 = 10, D2 = 13, D3 = 6.5;   // branch spacing at gradient 1

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const E = [new Float32Array(H), new Float32Array(H), new Float32Array(H)];
  const EC = [];
  const bounds = [[S1A, S1B], [S2A, S2B], [S3A, S3B]];
  const cy = [1, 26, 59, 93, 120], cs = [9, 12.5, 12.5, 12.5, 10], ca = [0.7, 1, 1, 1, 0.75];
  for (let k = 0; k < 5; k++) EC.push(new Float32Array(H));
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    for (let k = 0; k < 3; k++) E[k][y] = sstep(bounds[k][0] - 7, bounds[k][0] + 3, yc) * (1 - sstep(bounds[k][1] - 3, bounds[k][1] + 7, yc));
    for (let k = 0; k < 5; k++) EC[k][y] = ca[k] * exp(-0.5 * ((yc - cy[k]) / cs[k]) * ((yc - cy[k]) / cs[k]));
  }
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 0, acc: 0, n: 0, ne: 0, mass: 0, mv: 0, thp: 0,
    ph: [rr(0, TP), rr(0, TP), rr(0, TP), rr(0, TP)],
    ay: new Float32Array(MAXA), av: new Float32Array(MAXA), ax0: new Float32Array(MAXA), am: new Float32Array(MAXA),
    aph: new Float32Array(MAXA), phi: new Float32Array(MAXA),
    s1: new Int8Array(MAXA), s2: new Int8Array(MAXA), s3: new Int8Array(MAXA),
    c2: new Float32Array(MAXA * 3),
    ex: new Float32Array(MAXE), ey: new Float32Array(MAXE), evx: new Float32Array(MAXE), evy: new Float32Array(MAXE),
    el: new Float32Array(MAXE), em: new Float32Array(MAXE),
    N4: new Float32Array(4), bh: new Float32Array(4),
    bx: new Float32Array(MAXB), by: new Float32Array(MAXB), bv: new Float32Array(MAXB), bz: new Uint8Array(MAXB), nb: 0,
    wy: new Float32Array(H * NWAVE * 2), wx: new Float32Array(W * NWAVE * 2),
    pr: new Float32Array(N), pg: new Float32Array(N), pb: new Float32Array(N), // flashes that fade in a quarter second
    cr: new Float32Array(N), cg: new Float32Array(N), cb: new Float32Array(N),
    E, EC,
    f: {
      th: PI / 2, G: 1, flux: 2, v0: 40, rho: 4, tail: 6, D1, D2, D3, w2p: 0.5, w2m: 0.5, sh: 0.55,
      ZP: [0, 0, 0], ZM: [0, 0, 0], XP: [0, 0, 0], XM: [0, 0, 0], NEU: [0, 0, 0], C2P: [0, 0, 0], C2M: [0, 0, 0],
    },
    col: [0, 0, 0],
  });
  return st;
}

// the colour of a spin state whose axis lies phi round from +z in the z-x plane: +z, +x, -z, -x in that order
function stateColor(f, phi, out) {
  const c = cos(phi), s = sin(phi);
  const a = max(0, c), b = max(0, -c), p = max(0, s), q = max(0, -s);
  const inv = 1 / (a + b + p + q);
  for (let i = 0; i < 3; i++) out[i] = (a * f.ZP[i] + b * f.ZM[i] + p * f.XP[i] + q * f.XM[i]) * inv;
}

function derive(st) {
  const f = st.f, ks = st.ks;
  const hue = fin(ks[0], 0);
  const th = PI / 2 * (1 + cl(ks[2], -1, 1));
  const k4 = cl(ks[3], -1, 1);
  f.th = th;
  f.G = k4 < 0 ? pow(0.3, -k4) : 1 + 0.5 * k4;
  f.flux = cl(ks[1], 0.3, 2.5);
  f.v0 = 24 * pow(f.flux, 0.7);
  f.rho = 0.6 + 1.1 * f.flux;
  f.tail = cl(0.16 * f.v0, 2.5, 8);
  f.D1 = D1 * f.G; f.D2 = D2 * f.G; f.D3 = D3 * f.G;
  f.w2p = 0.5 * (1 + cos(th)); f.w2m = 1 - f.w2p;
  f.sh = 0.55 * sin(th);
  hsv(0.5 + hue, 0.8, 1, f.ZP);
  hsv(0.675 + hue, 0.9, 1, f.ZM);
  hsv(0.88 + hue, 0.85, 1, f.XP);
  hsv(0.115 + hue, 0.88, 1, f.XM);
  hsv(0.62 + hue, 0.1, 0.95, f.NEU);
  stateColor(f, th, f.C2P);
  stateColor(f, th + PI, f.C2M);
}

// ---- one atom's route ------------------------------------------------------------
function pathX(st, i, y) {
  const f = st.f;
  let x = CX + st.ax0[i] * (0.7 + 0.3 * sstep(YSRC, 22, y)) + 0.35 * sin(0.17 * y + st.aph[i]);
  const a = st.s1[i];
  if (a > 0) x += f.D1 * sstep(S1A, YM1, y) * (1 - sstep(YM1, S1B, y));
  else if (a < 0) x -= f.D1 * sstep(S1A, YM1, y);
  const b = st.s2[i];
  if (b !== 0) x += b * f.D2 * sstep(S2A, S2B, y);
  const c = st.s3[i];
  if (c !== 0) x += c * f.D3 * sstep(S3A, S3B, y);
  return x;
}

function atomColor(st, i, y, out) {
  const f = st.f;
  let r = f.NEU[0], g = f.NEU[1], b = f.NEU[2];
  const a = st.s1[i];
  if (a !== 0) {
    const t = sstep(S1A, YM1, y), c = a > 0 ? f.ZP : f.ZM;
    r = mix(r, c[0], t); g = mix(g, c[1], t); b = mix(b, c[2], t);
  }
  if (st.s2[i] !== 0) {
    const t = sstep(S2A, S2A + 14, y), j = i * 3, c2 = st.c2;
    r = mix(r, c2[j], t); g = mix(g, c2[j + 1], t); b = mix(b, c2[j + 2], t);
  }
  const d = st.s3[i];
  if (d !== 0) {
    const t = sstep(S3A, S3A + 14, y), c = d > 0 ? f.ZP : f.ZM;
    r = mix(r, c[0], t); g = mix(g, c[1], t); b = mix(b, c[2], t);
  }
  out[0] = r; out[1] = g; out[2] = b;
}

function stampPers(st, x, y, sig, amp, c) {
  const R = ceil(sig * 2.5);
  const x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R));
  const y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
  const inv = -0.5 / (sig * sig);
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy + 0.5 - y, ey = dy * dy * inv;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x, w = amp * exp(dx * dx * inv + ey), p = yy * W + xx;
      st.pr[p] += w * c[0]; st.pg[p] += w * c[1]; st.pb[p] += w * c[2];
    }
  }
}

function addEmber(st, x, y) {
  if (st.ne >= MAXE) return;
  const j = st.ne++;
  st.ex[j] = x; st.ey[j] = y;
  const a = rr(-0.6, 0.9), sp = rr(5, 17);
  st.evx[j] = -abs(cos(a)) * sp; st.evy[j] = sin(a) * sp;
  st.el[j] = st.em[j] = rr(0.35, 0.8);
}

function land(st, x, y, idx) {
  st.N4[idx] += 1;
  st.mass += 1;
  if (!st.warm) stampPers(st, x, y, 1.1, 0.4, idx & 1 ? st.f.ZP : st.f.ZM);
  if (st.nb < MAXB && rnd() < 0.5) {
    const j = st.nb++;
    st.bx[j] = x; st.by[j] = y + 0.5; st.bv[j] = rr(18, 32); st.bz[j] = idx & 1;
  }
}

// how tall each of the four piles stands, from the counts the screen still holds
function updateBars(st) {
  const f = st.f;
  const eq = 0.5 * f.rho * f.v0 * TAU;
  const denom = max(st.mass, 0.35 * eq);
  for (let k = 0; k < 4; k++) {
    const h = BARH * min(1, sqrt(st.N4[k] / denom / 0.8));
    st.bh[k] = max(0, h - 1) * (BARH / (BARH - 1));
  }
}

function remove(st, i) {
  const l = --st.n;
  if (i !== l) {
    st.ay[i] = st.ay[l]; st.av[i] = st.av[l]; st.ax0[i] = st.ax0[l]; st.am[i] = st.am[l];
    st.aph[i] = st.aph[l]; st.phi[i] = st.phi[l];
    st.s1[i] = st.s1[l]; st.s2[i] = st.s2[l]; st.s3[i] = st.s3[l];
    st.c2[i * 3] = st.c2[l * 3]; st.c2[i * 3 + 1] = st.c2[l * 3 + 1]; st.c2[i * 3 + 2] = st.c2[l * 3 + 2];
  }
}

// ---- time -----------------------------------------------------------------------------
function advance(st, dt) {
  const nsub = max(1, ceil(dt / 0.04));
  const h = dt / nsub;
  for (let q = 0; q < nsub; q++) substep(st, h);
}

function substep(st, dt) {
  const f = st.f, v0 = f.v0;
  st.t += dt;
  // new atoms from the source
  st.acc += f.rho * v0 * dt;
  const nNew = floor(st.acc);
  st.acc -= nNew;
  for (let q = 0; q < nNew && st.n < MAXA; q++) {
    const i = st.n++;
    st.ay[i] = YSRC + rnd() * v0 * dt;
    st.av[i] = rr(0.88, 1.12);
    st.ax0[i] = (rnd() + rnd() + rnd() - 1.5) * 1.6;
    st.am[i] = rr(0.25, 1) * cl(pow(2 / f.flux, 0.3), 0.9, 1.4);   // a thin trickle gets brighter atoms
    st.aph[i] = rr(0, TP);
    st.s1[i] = 0; st.s2[i] = 0; st.s3[i] = 0; st.phi[i] = 0;
  }
  // atoms
  for (let i = 0; i < st.n;) {
    const y0 = st.ay[i], y1 = y0 + st.av[i] * v0 * dt;
    st.ay[i] = y1;
    if (y0 < S1A && y1 >= S1A) st.s1[i] = rnd() < 0.5 ? 1 : -1;
    if (st.s1[i] < 0 && y1 >= YSTOP) {
      // the stopped branch: a flare, and a few scattered specks
      const x = pathX(st, i, YSTOP);
      if (!st.warm) stampPers(st, x, YSTOP, 1.7, 0.05, f.ZM);
      if (rnd() < 0.6) addEmber(st, x, YSTOP);
      remove(st, i);
      continue;
    }
    if (y0 < S2A && y1 >= S2A && st.s1[i] > 0) {
      const plus = rnd() < f.w2p;
      st.s2[i] = plus ? 1 : -1;
      st.am[i] *= cl(sqrt(0.5 / max(0.02, plus ? f.w2p : f.w2m)), 0.7, 1.6);   // rare branches stay visible, crowded ones do not blow out
      st.phi[i] = plus ? f.th : f.th + PI;
      const c = plus ? f.C2P : f.C2M, j = i * 3;
      st.c2[j] = c[0]; st.c2[j + 1] = c[1]; st.c2[j + 2] = c[2];
    }
    if (y0 < S3A && y1 >= S3A && st.s2[i] !== 0) {
      const pz = 0.5 * (1 + cos(st.phi[i]));
      const up = rnd() < pz;
      st.s3[i] = up ? 1 : -1;
      st.am[i] *= cl(sqrt(0.5 / max(0.02, up ? pz : 1 - pz)), 0.7, 1.6);
    }
    if (y1 >= YDET) {
      const idx = (st.s2[i] > 0 ? 2 : 0) + (st.s3[i] > 0 ? 1 : 0);
      const top = H - 0.5 - st.bh[idx];
      if (y1 >= top) {
        land(st, pathX(st, i, y1), top, idx);
        remove(st, i);
        continue;
      }
    }
    i++;
  }
  // embers
  const drag = exp(-1.5 * dt);
  for (let j = 0; j < st.ne;) {
    st.el[j] -= dt;
    if (st.el[j] <= 0) {
      const l = --st.ne;
      if (j !== l) {
        st.ex[j] = st.ex[l]; st.ey[j] = st.ey[l]; st.evx[j] = st.evx[l]; st.evy[j] = st.evy[l];
        st.el[j] = st.el[l]; st.em[j] = st.em[l];
      }
      continue;
    }
    st.ex[j] += st.evx[j] * dt; st.ey[j] += st.evy[j] * dt;
    st.evx[j] *= drag; st.evy[j] *= drag;
    j++;
  }
  // beads sink down the bars
  for (let j = 0; j < st.nb;) {
    st.by[j] += st.bv[j] * dt;
    if (st.by[j] > H - 0.5) {
      const l = --st.nb;
      if (j !== l) { st.bx[j] = st.bx[l]; st.by[j] = st.by[l]; st.bv[j] = st.bv[l]; st.bz[j] = st.bz[l]; }
      continue;
    }
    j++;
  }
  // (bars are refreshed at the end of the step)
  // the screen forgets, and forgets faster while the apparatus is being turned
  const fd = exp(-dt * (1 / TAU + min(6, 3 * st.mv)));
  for (let k = 0; k < 4; k++) st.N4[k] *= fd;
  st.mass *= fd;
  if (!st.warm) {
    const pd = exp(-dt / 0.22);
    const pr = st.pr, pg = st.pg, pb = st.pb;
    for (let p = 0; p < N; p++) { pr[p] *= pd; pg[p] *= pd; pb[p] *= pd; }
  }
  updateBars(st);
}

// ---- Lab hooks ------------------------------------------------------------------------
export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    derive(st);
    st.thp = st.f.th;
    // the screen starts with a history, as if the beam had been running for most of a minute
    st.warm = true;
    for (let i = 0; i < 900; i++) advance(st, 0.04);
    st.warm = false;
    st.pr.fill(0); st.pg.fill(0); st.pb.fill(0);
  } else {
    const a = 1 - exp(-dt / 0.12);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
    derive(st);
    const dd = abs(st.f.th - st.thp) / PI;
    st.mv = dt > 0.001 ? dd / dt : 0;
    st.thp = st.f.th;
  }
  advance(st, dt);
}

// ---- drawing -----------------------------------------------------------------------------
function stampAdd(st, x, y, sig, amp, c) {
  const R = ceil(sig * 2.4);
  const x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R));
  const y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
  const inv = -0.5 / (sig * sig);
  const cr = st.cr, cg = st.cg, cb = st.cb;
  const r = c[0] * amp, g = c[1] * amp, b = c[2] * amp;
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy + 0.5 - y, ey = dy * dy * inv;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x, w = exp(dx * dx * inv + ey), p = yy * W + xx;
      cr[p] += r * w; cg[p] += g * w; cb[p] += b * w;
    }
  }
}

function rowAdd(st, y, x, sig, amp, r, g, b) {
  const x0 = max(0, floor(x - 3.2 * sig)), x1 = min(W - 1, floor(x + 3.2 * sig));
  const inv = -0.5 / (sig * sig);
  const o = y * W;
  for (let xx = x0; xx <= x1; xx++) {
    const d = xx + 0.5 - x, w = amp * exp(d * d * inv);
    st.cr[o + xx] += r * w; st.cg[o + xx] += g * w; st.cb[o + xx] += b * w;
  }
}

// x wave number, y wave number (rad per LED), angular speed (rad per second), weight
const WAVES = [[0.04, 0.075, 2.9, 0.26], [-0.055, 0.045, -2.0, 0.2], [0.021, -0.11, 3.9, 0.18], [0.09, 0.03, 1.27, 0.16], [-0.03, 0.058, 2.4, 0.14], [0.065, -0.04, -3.2, 0.12], [0.07, -0.085, 1.74, 0.12], [-0.045, -0.02, -1.05, 0.1]];
const NWAVE = WAVES.length;
const FLU = [-0.9, -0.66, -0.44, -0.24, -0.05, 0.14, 0.31, 0.47, 0.62, 0.76, 0.89];
const HV = [0, 0, 0];

function drawField(st) {
  const f = st.f, t = st.t;
  const cr = st.cr, cg = st.cg, cb = st.cb;
  const fa = 0.6 + 0.4 * f.G;
  const A = 0.23 * fa;
  const stages = [
    { P: f.ZP, M: f.ZM, sh: 0, a: 0, b: 2 },
    { P: f.ZP, M: f.ZM, sh: 0, a: S1A, b: S1B },
    { P: f.C2P, M: f.C2M, sh: f.sh, a: S2A, b: S2B },
    { P: f.ZP, M: f.ZM, sh: 0, a: S3A, b: S3B },
    { P: f.ZP, M: f.ZM, sh: 0, a: 118, b: 122 },
  ];
  const ph = st.ph;
  // eight broad waves of light with their own directions and speeds, none a multiple of another, so the field never settles
  // into a pattern that comes round again; each is a per-row factor and a per-column factor
  const wy = st.wy, wx = st.wx;
  for (let i = 0; i < NWAVE; i++) {
    const wv = WAVES[i];
    for (let y = 0; y < H; y++) {
      const a = wv[1] * (y + 0.5) - wv[2] * t + ph[i % 4] * (i + 1);
      wy[(y * NWAVE + i) * 2] = sin(a); wy[(y * NWAVE + i) * 2 + 1] = cos(a);
    }
    for (let x = 0; x < W; x++) {
      const b = wv[0] * (x + 0.5);
      wx[(x * NWAVE + i) * 2] = sin(b); wx[(x * NWAVE + i) * 2 + 1] = cos(b);
    }
  }
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, o = y * W;
    const e0 = st.EC[0][y], e1 = st.EC[1][y], e2 = st.EC[2][y], e3 = st.EC[3][y], e4 = st.EC[4][y];
    const y0 = y * NWAVE * 2;
    for (let x = 0; x < W; x++) {
      const xc = x + 0.5, x0 = x * NWAVE * 2;
      let m = 0.3;
      for (let i = 0; i < NWAVE; i++) {
        const q = i * 2;
        m += WAVES[i][3] * (0.5 + 0.5 * (wy[y0 + q] * wx[x0 + q + 1] + wy[y0 + q + 1] * wx[x0 + q]));
      }
      let r = 0.018 * f.NEU[0], g = 0.018 * f.NEU[1], b = 0.028 * f.NEU[2];
      for (let k = 0; k < 5; k++) {
        const e = k === 0 ? e0 : k === 1 ? e1 : k === 2 ? e2 : k === 3 ? e3 : e4;
        if (e < 0.003) continue;
        const s = stages[k];
        const u = (xc - CX - s.sh * (yc - (s.a + s.b) * 0.5)) / 32;
        const wr = sstep(-0.4, 0.95, u), wl = 0.95 * sstep(0.4, -0.95, u);
        const q = A * e * m;
        r += q * (wr * s.P[0] + wl * s.M[0]); g += q * (wr * s.P[1] + wl * s.M[1]); b += q * (wr * s.P[2] + wl * s.M[2]);
      }
      cr[o + x] += r; cg[o + x] += g; cb[o + x] += b;
    }
  }
  // a few field lines that bunch toward the strong side of each analyzer, each carrying a pulse down
  for (let k = 1; k <= 3; k++) {
    const s = stages[k], ym = (s.a + s.b) * 0.5, len = s.b - s.a;
    for (let y = max(0, s.a - 8); y < min(H, s.b + 8); y++) {
      const yc = y + 0.5, e = st.E[k - 1][y];
      if (e < 0.02) continue;
      const bow = 1 + 0.1 * cos(PI * (yc - ym) / len);
      for (let i = 0; i < FLU.length; i++) {
        const u = FLU[i];
        const x = CX + s.sh * (yc - ym) + 32 * u * bow;
        const pulse = 0.5 + 0.5 * sin(0.16 * yc - 3.1 * t - 0.9 * sin(0.17 * t + ph[3]) + i * 1.7 + ph[2]);
        const side = sstep(-0.3, 0.3, u);
        const r = mix(s.M[0], s.P[0], side), g = mix(s.M[1], s.P[1], side), b = mix(s.M[2], s.P[2], side);
        rowAdd(st, y, x, 0.85, 0.2 * fa * e * (0.25 + 0.75 * pulse) * (0.6 + 0.4 * side), r, g, b);
      }
    }
  }
}

const F = (w) => pow(w, 0.55);

function drawRays(st) {
  const f = st.f;
  const RB = 0.12, SG = 1.1;
  const w2 = [f.w2p, f.w2m];                      // index 0 is the + branch
  const X2 = [f.C2P, f.C2M], Z = [f.ZP, f.ZM];
  // the weight of the + branch of the last analyzer after each branch of the middle one
  const w3p = [0.5 * (1 + cos(f.th)), 0.5 * (1 - cos(f.th))];
  const c = [0, 0, 0];
  for (let y = 0; y <= YDET + 8; y++) {
    const yc = y + 0.5;
    const a1 = sstep(S1A, YM1, yc);
    const a2 = sstep(S2A, S2A + 13, yc), a3 = sstep(S3A, S3A + 13, yc);
    const born = sstep(YSRC, YSRC + 3, yc);
    const bump = sstep(S1A, YM1, yc) * (1 - sstep(YM1, S1B, yc));
    const xC = CX + f.D1 * bump;
    const o2 = f.D2 * sstep(S2A, S2B, yc), o3 = f.D3 * sstep(S3A, S3B, yc);
    // before the first analyzer: the whole beam, unpolarised
    let I = F(1) * (1 - a1) * born;
    if (I > 0.003) rowAdd(st, y, CX, SG, RB * I, f.NEU[0], f.NEU[1], f.NEU[2]);
    // the stopped branch
    if (yc < YSTOP + 1.5) {
      I = F(0.5) * a1 * (1 - sstep(YSTOP - 2.5, YSTOP + 1, yc));
      if (I > 0.003) {
        for (let q = 0; q < 3; q++) c[q] = mix(f.NEU[q], f.ZM[q], a1);
        rowAdd(st, y, CX - f.D1 * a1, SG, RB * I, c[0], c[1], c[2]);
      }
    }
    // the branch that passes, between the first and the middle analyzer
    I = F(0.5) * a1 * (1 - a2);
    if (I > 0.003) {
      for (let q = 0; q < 3; q++) c[q] = mix(f.NEU[q], f.ZP[q], a1);
      rowAdd(st, y, xC, SG, RB * I, c[0], c[1], c[2]);
    }
    if (yc < S2A - 2) continue;
    for (let s = 0; s < 2; s++) {
      const sg = s === 0 ? 1 : -1;
      const W2 = 0.5 * w2[s];
      if (W2 < 0.004) continue;
      const x2 = xC + sg * o2;
      I = F(W2) * a2 * (1 - a3);
      if (I > 0.003) {
        for (let q = 0; q < 3; q++) c[q] = mix(f.ZP[q], X2[s][q], a2);
        rowAdd(st, y, x2, SG, RB * I, c[0], c[1], c[2]);
      }
      if (yc < S3A - 2) continue;
      for (let z = 0; z < 2; z++) {
        const sz = z === 0 ? 1 : -1;
        const wz = z === 0 ? w3p[s] : 1 - w3p[s];
        const W3 = W2 * wz;
        if (W3 < 0.004) continue;
        I = F(W3) * a2 * a3 * (1 - sstep(YDET + 1, YDET + 8, yc));
        if (I < 0.003) continue;
        for (let q = 0; q < 3; q++) c[q] = mix(X2[s][q], Z[z][q], a3);
        rowAdd(st, y, x2 + sz * o3, SG, RB * I, c[0], c[1], c[2]);
      }
    }
  }
}

function drawSource(st) {
  const f = st.f, t = st.t;
  const fl = 0.9 + 0.1 * sin(7.3 * t + st.ph[3]) * sin(2.9 * t);
  for (let y = 0; y < 13; y++) {
    const dy = y + 0.5 - YSRC;
    for (let x = 14; x < 50; x++) {
      const dx = x + 0.5 - CX;
      const w = 0.7 * exp(-(dx * dx) / (2 * 2.3 * 2.3) - (dy * dy) / (2 * 1.5 * 1.5)) + 0.13 * exp(-(dx * dx) / (2 * 7 * 7) - (dy * dy) / (2 * 3.6 * 3.6));
      const p = y * W + x;
      st.cr[p] += w * fl * f.NEU[0]; st.cg[p] += w * fl * f.NEU[1]; st.cb[p] += w * fl * f.NEU[2];
    }
  }
}

function drawScreen(st) {
  const f = st.f;
  // four piles on the floor, one for each way through the three analyzers, where that way ends
  for (let k = 0; k < 4; k++) {
    const h = st.bh[k];
    if (h < 0.4) continue;
    const cx = CX + (k >= 2 ? f.D2 : -f.D2) + (k & 1 ? f.D3 : -f.D3);
    const c = k & 1 ? f.ZP : f.ZM;
    const top = H - h;
    const x0 = max(0, floor(cx - 3.5)), x1 = min(W - 1, floor(cx + 3.5));
    for (let x = x0; x <= x1; x++) {
      const hx = cl(BW * 0.5 - abs(x + 0.5 - cx) + 0.5, 0, 1);
      if (hx <= 0) continue;
      for (let y = max(0, floor(top) - 1); y < H; y++) {
        const dy = y + 0.5 - top;
        const cover = sstep(-0.5, 1.2, dy) * hx;
        if (cover <= 0) continue;
        const v = cover * (0.45 + 0.5 * exp(-dy / 4.5));
        const p = y * W + x;
        st.cr[p] += v * c[0]; st.cg[p] += v * c[1]; st.cb[p] += v * c[2];
      }
    }
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const f = st.f;
  const cr = st.cr, cg = st.cg, cb = st.cb;
  cr.fill(0); cg.fill(0); cb.fill(0);
  drawField(st);
  drawRays(st);
  drawSource(st);
  drawScreen(st);
  // the atoms, each a soft head and a tail sampled back along its own route
  const L = f.tail, col = st.col;
  for (let i = 0; i < st.n; i++) {
    const y = st.ay[i], am = st.am[i];
    const nt = floor(L);
    for (let j = 0; j <= nt; j++) {
      const ys = y - j * 1.1;
      if (ys < YSRC) break;
      const x = pathX(st, i, ys);
      atomColor(st, i, ys, col);
      const a = am * (0.3 + 0.5 * min(1, ys / YDET)) * (j === 0 ? 1 : 0.34 * exp(-j / (0.5 * L))) * sstep(YSRC, YSRC + 3, ys)
        * (st.s1[i] < 0 ? 1 - 0.7 * sstep(YSTOP - 5, YSTOP, ys) : 1);
      stampAdd(st, x, ys, j === 0 ? 0.9 : 0.75, a, col);
    }
  }
  // beads sinking down the bars
  for (let j = 0; j < st.nb; j++) stampAdd(st, st.bx[j], st.by[j], 0.8, 0.4, st.bz[j] ? f.ZP : f.ZM);
  // scattered specks from the stopped branch
  const cz = f.ZM;
  for (let j = 0; j < st.ne; j++) {
    const k = st.el[j] / st.em[j];
    stampAdd(st, st.ex[j], st.ey[j], 0.8, 0.7 * k * k, cz);
  }
  const pr = st.pr, pg = st.pg, pb = st.pb;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = cr[p] + pr[p], g = cg[p] + pg[p], b = cb[p] + pb[p];
      const m = max(r, g, b);
      if (m > 0.8) {
        const s = (0.8 + 0.2 * (1 - exp(-(m - 0.8) / 0.2))) / m;
        const w = cl((m - 1) * 0.25, 0, 0.3);
        r = r * s + w; g = g * s + w; b = b * s + w;
      }
      display.setPixel(x, y, floor(cl(r, 0, 1) * 255), floor(cl(g, 0, 1) * 255), floor(cl(b, 0, 1) * 255));
    }
  }
}
