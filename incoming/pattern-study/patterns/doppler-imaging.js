// ===== Patternflow pattern =====
// Title:   Doppler Imaging
// Family:  dopplerimaging
// Idea:    A fast-turning cool star hangs as a limb-darkened amber disc over the line profile a spectrograph would record from it, one row per instant scrolling down, where every dark starspot on the disc leaves a bright bump that rides a sine track from the blue edge to the red edge, and spots at different latitudes turn at different rates, so the tracks shear apart.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Doppler imaging of spotted stars, where a dark spot makes a bump that crosses the rotationally broadened absorption line from the blue to the red side as the star turns (Vogt and Penrod, 1983, from memory); the solar-type law of differential rotation, equator fastest and the poles slowest, and spots that appear, drift in latitude and decay over many turns, as in the images of fast rotators by Collier Cameron, Donati and colleagues (from memory); the darker equator of a fast rotator (gravity darkening, von Zeipel, 1924, from memory). Original here: both halves are computed from one spot map, the profile row being the sum of the very pixels drawn above it, binned by the velocity each of them has; the shared blue-to-red tint; the groups of spots that grow, scatter and fade on a clock of their own, with broad patches between them, pattern round 256
// Round:   256
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Spots=-1..1, Tilt=-1..1
//
// Knob 1: Hue. Turns the star's colour round the wheel; it opens on orange-gold, dark red at the limb and in the spots, pale gold at the centre.
// Knob 2: Speed. 0.3 to 3, opening at 2. The turn of the star and the scroll of the profile together: at 2 the equator comes round in 8 seconds and the profile moves 9 rows a second, at 0.3 a turn takes 53 seconds, at 3 it takes 5. A faster star is flatter, its equator dimmer against the poles. Spots are born and fade on the clock, whatever the speed.
// Knob 3: Spots. -1 to 1, opening at 0. How spotted the star is: 10 spots at -1, 15 at 0, 24 at 1, where they are also a fifth wider and the profile fills with tracks. Broad weak patches, dark and bright, come with them. Turned while running, the spots that are not wanted fade out over some seconds and new groups grow in on the face turned to us.
// Knob 4: Tilt. -1 to 1, opening at 0.06. The inclination of the rotation axis: 8 degrees at -1, looking down on the pole, where spots circle the middle and every track is a whole sine; about 50 degrees at the start; 90 at 1, the star seen from its equator, where spots cross in straight lines and each track is an arc with a gap while the spot is behind.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, acos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);

// ---- layout: the disc above, a thin velocity ruler, the profile history below ----
const CX = 32, CY = 31, R = 28;           // the disc: 56 LED across
const GX0 = 2, GY0 = 1, ND = 60;          // the cell grid the disc is computed on (columns 2..61, rows 1..60)
const BAR_Y = 61;                         // the ruler is two rows tall
const SP_Y = 64, SP_N = 64;               // the profile history, newest row on top
const HR = 74;                            // rows kept

// ---- the star ----
const ALPHA = 0.27;                       // differential rotation: omega(lat) = 1 - ALPHA sin^2(lat), equator fastest
const OMEGA = TP / 8;                     // equator, radians per second at Speed 2
const ROWS = 9;                           // profile rows per second at Speed 2
const LD = 0.82;                          // limb darkening: 1 at the centre, 0.18 at the rim
const BRIGHT = 0.92;                      // the disc's centre, leaving room for the bright patches above it
const MAXS = 100;                         // spots, counting those that are fading
const PATCH_W = 0.3;                      // how much of a patch's dimming reaches the profile
const PATCHES = 22;                       // the broad weak patches: this many at the least
const D_LINE = 0.84;                      // depth of the absorption line
const GAIN = 6.5;                         // how much a spot's share of the strip lifts the profile
const TOP = 0.9;                          // the continuum in the wings of the line, as a brightness

const spotsOf = (k) => round1(15 + 7 * k + 2 * k * k);
function round1(v) { return floor(v + 0.5); }

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// brightness -> colour: dark red-brown, deep orange, amber, gold, pale gold. columns: brightness, hue offset, saturation, value
const RAMP = [
  0.00, -0.090, 1.00, 0.00,
  0.06, -0.082, 1.00, 0.17,
  0.18, -0.062, 1.00, 0.38,
  0.34, -0.038, 0.98, 0.64,
  0.55, -0.010, 0.95, 0.88,
  0.78, 0.018, 0.88, 1.00,
  1.00, 0.046, 0.64, 1.00,
];

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    tau: 0, acc: 0, head: 0,
    sp: [],
    fl: new Float32Array(MAXS * 7), nfl: 0,
    tiltDone: -9,
    // the cell grid: for each cell, where it sits on the star and where its velocity lands in the profile
    cov: new Float32Array(ND * ND), I0: new Float32Array(ND * ND), sph: new Float32Array(ND * ND),
    c1: new Float32Array(ND * ND), cq: new Float32Array(ND * ND), xx: new Float32Array(ND * ND), pos: new Float32Array(ND * ND),
    vel: new Float32Array(ND * ND), idx: new Int16Array(ND * ND), nin: 0,
    halo: new Float32Array(ND * ND),
    I: new Float32Array(ND * ND),
    liveB: new Float32Array(64), liveM: new Float32Array(64),
    hB: new Float32Array(HR * 64), hM: new Float32Array(HR * 64),
    tmpS: new Float32Array(72), tmpS0: new Float32Array(72),
    lut: new Float32Array(256 * 3), plane: new Float32Array(64 * SP_N), plane2: new Float32Array(64 * SP_N), gl: new Float32Array(64 * SP_N), gl2: new Float32Array(64 * SP_N),
    fb: new Float32Array(W * H * 3),
  });
  // the faint glow outside the limb does not depend on anything
  for (let cy = 0; cy < ND; cy++) for (let cx = 0; cx < ND; cx++) {
    const d = sqrt((GX0 + cx + 0.5 - CX) ** 2 + (GY0 + cy + 0.5 - CY) ** 2);
    st.halo[cy * ND + cx] = d > R - 0.5 ? 0.15 * exp(-max(0, d - R - 0.5) / 1.5) : 0;
  }
  return st;
}

const inclOf = (k) => (8 + 82 * (cl(k, -1, 1) + 1) / 2) * PI / 180;

// ---- where each cell of the disc sits on the star, for one inclination ----
function geometry(st, inc) {
  const si = sin(inc), ci = cos(inc);
  let n = 0;
  for (let cy = 0; cy < ND; cy++) for (let cx = 0; cx < ND; cx++) {
    const k = cy * ND + cx, dx = GX0 + cx + 0.5 - CX, dy = GY0 + cy + 0.5 - CY, d = sqrt(dx * dx + dy * dy);
    const cov = cl(R + 0.5 - d, 0, 1);
    st.cov[k] = cov;
    if (cov <= 0) continue;
    const rho = min(d / R, 0.9995), Xn = dx / R, Yn = -dy / R, Z = sqrt(1 - rho * rho);
    const s = Yn * si + Z * ci;                       // sine of the latitude
    const g = 1 - ALPHA * s * s;                      // how fast this latitude turns
    st.sph[k] = s;
    st.c1[k] = -Yn * ci + Z * si;                     // cos(lat) cos(longitude from the central meridian)
    st.xx[k] = Xn;                                    // cos(lat) sin(longitude)
    st.I0[k] = BRIGHT * (1 - LD * (1 - Z));
    st.cq[k] = 1 - s * s;                             // cos^2 of the latitude, for gravity darkening
    st.vel[k] = g * Xn;                               // velocity in units of v sin i
    st.pos[k] = CX + R * g * Xn;                      // and the column it lands in
    st.idx[n++] = k;
  }
  st.nin = n;
  st.tiltDone = inc;
}

// ---- spots ----
const envOf = (s) => sstep(0, s.grow, s.age) * (1 - sstep(s.tD, s.tD + s.dd, s.age));

function spawn(st, front, ageFrac) {
  const sizeUp = 1 + 0.22 * cl(st.ks[2], -1, 1);
  const polar = Math.random() < 0.07;
  const mk = (lat, th, r0) => {
    const grow = 3 + 8 * Math.random();
    const hold = 12 + 66 * Math.random() * Math.random() + (polar ? 80 : 0);
    const s = {
      lat, th, r0, c: 0.74 + 0.2 * Math.random(),
      age: 0, vw: 0, grow, tD: grow + hold, dd: 18 + 36 * Math.random(),
      dlat: (Math.random() < 0.68 ? 1 : -1) * (lat < 0 ? -1 : 1) * (0.0004 + 0.0016 * Math.random()),
    };
    if (ageFrac) s.age = ageFrac * (s.tD + s.dd) * Math.random();
    st.sp.push(s);
  };
  let th = TP * Math.random();
  if (front) th = (Math.random() - 0.5) * 2 * 1.2;       // grown in sight, on the face turned to us
  if (polar) {
    mk((Math.random() < 0.8 ? 1 : -1) * (1.16 + 0.22 * Math.random()), th, (0.32 + 0.14 * Math.random()) * sizeUp);
    return;
  }
  const ci = cos(inclOf(st.ks[3])), lat = (Math.random() < 0.5 + 0.3 * ci * ci ? 1 : -1) * (0.04 + 1.06 * pow(Math.random(), 1.25));   // the pole we look down on gets a few more
  const r0 = (0.15 + 0.12 * Math.random()) * sizeUp;
  mk(lat, th, r0);
  // a group: companions at nearby latitudes, which the differential rotation then pulls apart
  if (Math.random() < 0.45) {
    const m = 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let q = 0; q < m && st.sp.length < MAXS; q++) {
      const l2 = cl(lat + (Math.random() < 0.5 ? -1 : 1) * (0.1 + 0.18 * Math.random()), -1.3, 1.3);
      mk(l2, th + (Math.random() - 0.5) * 0.8, r0 * (0.5 + 0.3 * Math.random()));
    }
  }
}

// the broad cool patches between the spots: weak, wide, short-lived, turning with their latitude like everything else
function spawnPatch(st, ageFrac) {
  const grow = 4 + 6 * Math.random(), hold = 6 + 24 * Math.random();
  const s = {
    soft: true, lat: (Math.random() < 0.5 ? 1 : -1) * 1.1 * Math.sqrt(Math.random()), th: TP * Math.random(), r0: 0.26 + 0.17 * Math.random(),
    c: (Math.random() < 0.5 ? 1 : -0.8) * (0.14 + 0.12 * Math.random()), age: 0, vw: 0, grow, tD: grow + hold, dd: 10 + 20 * Math.random(),
    dlat: (Math.random() - 0.5) * 0.003,
  };
  if (ageFrac) s.age = ageFrac * (s.tD + s.dd) * Math.random();
  st.sp.push(s);
}

// dtau is the star's own time (it turns with Speed), dt the clock's: spots are born, drift and fade over minutes of the clock
function evolve(st, dtau, dt) {
  const sp = st.sp;
  let alive = 0, soft = 0;
  for (let i = sp.length - 1; i >= 0; i--) {
    const s = sp[i];
    s.age += dt;
    // a spot's own slow wander against the turn of its latitude
    s.vw += -s.vw * dt / 25 + 0.028 * sqrt(dt) * 2 * (Math.random() + Math.random() + Math.random() - 1.5);
    s.th += OMEGA * (1 - ALPHA * sin(s.lat) * sin(s.lat)) * (1 + s.vw) * dtau;
    if (s.th > TP) s.th -= TP;
    s.lat += s.dlat * dt;
    if (abs(s.lat) > 1.38) { s.lat = cl(s.lat, -1.38, 1.38); s.dlat = -s.dlat; }
    if (s.age > s.tD + s.dd) { sp.splice(i, 1); continue; }
    if (s.age < s.tD) { if (s.soft) soft++; else alive++; }
  }
  const want = spotsOf(cl(st.ks[2], -1, 1)), wantSoft = round1(PATCHES + 0.6 * want);
  if (soft < wantSoft && sp.length < MAXS - 3 && Math.random() < 1 - exp(-dt * (0.05 + 0.2 * (wantSoft - soft)))) spawnPatch(st, 0);
  if (alive < want && sp.length < MAXS - 3) {
    if (Math.random() < 1 - exp(-dt * (0.05 + 0.3 * (want - alive)))) spawn(st, Math.random() < 0.7, 0);
  } else if (alive > want) {
    // too many: the oldest starts to fade
    if (Math.random() < 1 - exp(-dt * 0.35 * (alive - want))) {
      let pick = null;
      for (const s of sp) if (!s.soft && s.age < s.tD && (!pick || s.age > pick.age)) pick = s;
      if (pick) { pick.tD = max(pick.age, 0.5 * pick.grow); pick.dd = min(pick.dd, 4 + 6 * Math.random()); }
    }
  }
}

// ---- the disc and the profile row from one spot map ----
function sample(st) {
  const sp = st.sp, fl = st.fl;
  let n = 0;
  for (let i = 0; i < sp.length; i++) {
    const s = sp[i], env = envOf(s);
    if (env < 0.02) continue;
    const rad = s.r0 * (0.4 + 0.6 * env), amp = s.c * pow(env, 0.7), cph = cos(s.lat);
    fl[n++] = sin(s.lat); fl[n++] = cph * cos(s.th); fl[n++] = cph * sin(s.th); fl[n++] = cos(rad); fl[n++] = 1 / rad; fl[n++] = amp; fl[n++] = s.soft ? 1 : 0;
  }
  const nin = st.nin, { idx, sph, c1, xx, I0, I, cov, pos, cq } = st;
  // a star that turns faster is flatter and its equator is darker: the poles keep their light
  const pole = 0.05 + 0.2 * pow(cl(st.ks[1] / 3, 0, 1), 1.3);
  const S = st.tmpS, S0 = st.tmpS0;
  S.fill(0); S0.fill(0);
  for (let q = 0; q < nin; q++) {
    const k = idx[q];
    const a = sph[k], b = c1[k], c = xx[k];
    let dark = 1, soft = 1;
    for (let m = 0; m < n; m += 7) {
      const dot = a * fl[m] + b * fl[m + 1] + c * fl[m + 2];
      if (dot > fl[m + 3]) {
        const u = acos(dot > 1 ? 1 : dot) * fl[m + 4];
        if (fl[m + 6]) soft *= 1 - fl[m + 5] * (1 - sstep(0, 1, u));
        else dark *= 1 - fl[m + 5] * (0.55 * (1 - sstep(0.55, 1, u)) + 0.45 * (1 - sstep(0.22, 0.6, u)));
      }
    }
    // the broad patches dim the disc; in the profile they count for less, as the weak haze they are
    const ia = I0[k] * (1 - pole * cq[k]), i1 = ia * dark * soft, ip = ia * dark * (1 - PATCH_W * (1 - soft));
    I[k] = i1;
    // the strip of the star at this cell's velocity: add its light to the two columns it falls between
    const w = cov[k], bp = pos[k] - 0.5, i0 = floor(bp), f = bp - i0;
    const j0 = i0 + 4, j1 = j0 + 1;      // 4 columns of margin at the left of the work arrays
    S[j0] += w * ip * (1 - f); S[j1] += w * ip * f;
    S0[j0] += w * ia * (1 - f); S0[j1] += w * ia * f;
  }
  // smooth along velocity twice, then the base profile and the spot bump relative to the strongest strip
  smooth(S); smooth(S0);
  let mx = 1e-6;
  for (let x = 0; x < 64; x++) mx = max(mx, S0[x + 4]);
  const lb = st.liveB, lm = st.liveM;
  for (let x = 0; x < 64; x++) { lb[x] = S0[x + 4] / mx; lm[x] = max(0, S0[x + 4] - S[x + 4]) / mx; }
}

function smooth(a) {
  for (let r = 0; r < 2; r++) {
    let p = a[0];
    for (let x = 1; x < 71; x++) { const v = a[x]; a[x] = 0.25 * p + 0.5 * v + 0.25 * a[x + 1]; p = v; }
  }
}

function push(st) {
  st.head = (st.head + 1) % HR;
  st.hB.set(st.liveB, st.head * 64); st.hM.set(st.liveM, st.head * 64);
}

function init(st) {
  st.init = true;
  for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  geometry(st, inclOf(st.ks[3]));
  const want = spotsOf(cl(st.ks[2], -1, 1));
  while (st.sp.length < want) spawn(st, false, 0.95);
  for (let i = 0; i < round1(PATCHES + 0.6 * want); i++) spawnPatch(st, 0.95);
  // the star has been turning for a while: let spots come and go unseen, then fill the profile history
  for (let i = 0; i < 170; i++) evolve(st, 0.5, 0.5);
  for (let i = 0; i < 90; i++) { evolve(st, 1 / ROWS, 1 / ROWS); sample(st); push(st); }
  st.acc = 0;
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(dt || 0, 0, 0.1);
  if (!st.init) init(st);
  const a = 1 - exp(-dt / 0.25), at = 1 - exp(-dt / 0.35);
  st.ks[0] += (st.k[0] - st.ks[0]) * a; st.ks[1] += (st.k[1] - st.ks[1]) * a; st.ks[2] = st.k[2]; st.ks[3] += (st.k[3] - st.ks[3]) * at;
  if (dt <= 0) return;
  const dtau = dt * cl(st.ks[1], 0.3, 3) * 0.5;
  st.tau += dtau;
  const inc = inclOf(st.ks[3]);
  if (abs(inc - st.tiltDone) > 0.0005) geometry(st, inc);
  evolve(st, dtau, dt);
  sample(st);
  st.acc += dtau * ROWS;
  while (st.acc >= 1) { push(st); st.acc -= 1; }
}

// the colour a velocity gets: blue on the approaching side (left), warm red on the receding side (right)
function tint(out, o, w, lum, m0) {
  const m = m0 * pow(min(1, abs(w)), 1.3);
  if (m <= 0) return;
  let tr, tg, tb;
  if (w < 0) { tr = 0.55; tg = 0.95; tb = 1.9; } else { tr = 1.75; tg = 0.5; tb = 0.62; }
  const tl = 0.3 * tr + 0.59 * tg + 0.11 * tb;
  out[o] = out[o] * (1 - m) + tr / tl * lum * m;
  out[o + 1] = out[o + 1] * (1 - m) + tg / tl * lum * m;
  out[o + 2] = out[o + 2] * (1 - m) + tb / tl * lum * m;
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { fb, lut } = st;
  fb.fill(0);
  const h0 = 0.095 + st.ks[0];
  for (let i = 0; i < 256; i++) {
    const tt = i / 255;
    let k = 0;
    while (k < 5 && tt > RAMP[k * 4 + 4]) k++;
    const o = k * 4, f = cl((tt - RAMP[o]) / (RAMP[o + 4] - RAMP[o]), 0, 1);
    hsv(h0 + RAMP[o + 1] + (RAMP[o + 5] - RAMP[o + 1]) * f, RAMP[o + 2] + (RAMP[o + 6] - RAMP[o + 2]) * f, RAMP[o + 3] + (RAMP[o + 7] - RAMP[o + 3]) * f, lut, i * 3);
  }
  // ---- the disc ----
  for (let cy = 0; cy < ND; cy++) for (let cx = 0; cx < ND; cx++) {
    const k = cy * ND + cx, f = ((GY0 + cy) * W + GX0 + cx) * 3, c = st.cov[k], h = st.halo[k], hi = 3 * (cl(h, 0, 1) * 255 + 0.5 | 0);
    if (c <= 0) {
      if (h > 0) { fb[f] = lut[hi]; fb[f + 1] = lut[hi + 1]; fb[f + 2] = lut[hi + 2]; }
      continue;
    }
    const li = 3 * (cl(st.I[k], 0, 1) * 255 + 0.5 | 0);
    const r = lut[li], g = lut[li + 1], b = lut[li + 2];
    fb[f] = r; fb[f + 1] = g; fb[f + 2] = b;
    tint(fb, f, st.vel[k], 0.3 * r + 0.59 * g + 0.11 * b, 0.28);
    // the limb pixel is part disc, part the glow outside it
    if (c < 1) { fb[f] = fb[f] * c + lut[hi] * (1 - c); fb[f + 1] = fb[f + 1] * c + lut[hi + 1] * (1 - c); fb[f + 2] = fb[f + 2] * c + lut[hi + 2] * (1 - c); }
  }
  // ---- the velocity ruler, shared by both halves ----
  for (let x = 0; x < W; x++) {
    const w = (x + 0.5 - CX) / R, e = cl(min(w + 1.12, 1.12 - w) * 8, 0, 1);
    if (e <= 0) continue;
    for (let r = 0; r < 2; r++) {
      const f = ((BAR_Y + r) * W + x) * 3, v = (r ? 0.3 : 0.62) * e;
      fb[f] = 0.9 * 0.5 * v * 1.6; fb[f + 1] = 0.75 * 0.5 * v * 1.6; fb[f + 2] = 0.5 * 0.5 * v * 1.6;
      tint(fb, f, w, 0.45 * v * 1.6, 0.95);
    }
  }
  // ---- the profile history ----
  const pl = st.plane, hB = st.hB, hM = st.hM, fr = st.acc;
  for (let j = 0; j < SP_N; j++) {
    for (let x = 0; x < 64; x++) {
      let base, bump;
      if (j === 0) { base = st.liveB[x]; bump = st.liveM[x]; }
      else {
        const y = ((st.head - (j - 1)) % HR + HR) % HR * 64 + x, o = ((st.head - j) % HR + HR) % HR * 64 + x;
        base = hB[y] * fr + hB[o] * (1 - fr); bump = hM[y] * fr + hM[o] * (1 - fr);
      }
      const fill = 1 - exp(-GAIN * bump / (0.35 + 0.65 * base));
      st.gl[j * 64 + x] = fill;
      pl[j * 64 + x] = TOP * (1 - D_LINE * pow(base, 0.3) * (1 - 0.92 * fill));
    }
  }
  // a little blur down the history, so the tracks are soft
  const p2 = st.plane2;
  for (let j = 0; j < SP_N; j++) for (let x = 0; x < 64; x++) {
    const a = pl[max(0, j - 1) * 64 + x], b = pl[j * 64 + x], c = pl[min(SP_N - 1, j + 1) * 64 + x];
    p2[j * 64 + x] = 0.25 * a + 0.5 * b + 0.25 * c;
  }
  // and a wider bloom of where the spots are, so a bright track has a soft halo
  const g1 = st.gl, g2 = st.gl2;
  for (let j = 0; j < SP_N; j++) for (let x = 0; x < 64; x++) {
    let a = 0;
    for (let d = -4; d <= 4; d++) a += g1[j * 64 + cl(x + d, 0, 63)] * (5 - abs(d));
    g2[j * 64 + x] = a / 25;
  }
  for (let j = 0; j < SP_N; j++) {
    const fade = 1 - 0.1 * j / (SP_N - 1);
    for (let x = 0; x < 64; x++) {
      let bl = 0;
      for (let d = -3; d <= 3; d++) bl += g2[cl(j + d, 0, SP_N - 1) * 64 + x] * (4 - abs(d));
      const T = cl(p2[j * 64 + x] + 0.12 * (bl / 16) * (TOP - p2[j * 64 + x]), 0, 1), li = 3 * (T * 255 + 0.5 | 0), f = ((SP_Y + j) * W + x) * 3;
      const r = lut[li], g = lut[li + 1], b = lut[li + 2];
      fb[f] = r; fb[f + 1] = g; fb[f + 2] = b;
      tint(fb, f, (x + 0.5 - CX) / R, 0.3 * r + 0.59 * g + 0.11 * b, 0.26);
      fb[f] *= fade; fb[f + 1] *= fade; fb[f + 2] *= fade;
    }
  }
  for (let p = 0, f = 0; p < W * H; p++, f += 3) {
    display.setPixel(p % W, (p / W) | 0, cl((fb[f] * 255 + 0.5) | 0, 0, 255), cl((fb[f + 1] * 255 + 0.5) | 0, 0, 255), cl((fb[f + 2] * 255 + 0.5) | 0, 0, 255));
  }
}
