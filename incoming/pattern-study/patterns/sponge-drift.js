// ===== Patternflow pattern =====
// Title:   Sponge Drift
// Family:  raymarch
// Idea:    A first-person flight down a tall perspective tunnel through a sphere-traced lattice of cubes carved by crosses at three sizes and by round domes, drawn as neon lines on dark indigo walls that fade into a luminous haze at the far end, along rails that turn a quarter at some junctions and never come near a wall.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: sphere tracing of distance estimates (John C. Hart, 1996, from memory); distance-estimated fractal rendering (Hart, Sandin and Kauffman, 1989, from memory); the Menger sponge (Karl Menger, 1926, from memory) as an endless lattice with a turned cross carving at each scale, tried first as Tom Lowe's Mandelbox (2010, from memory) and set aside because its detail is finer than an LED; the rail autopilot, the edge-line shading and the palette are original, pattern round 250
// Round:   250
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Carve=-1..1, Roll=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel; it opens on indigo walls with cyan edge lines, magenta trim on the small carvings and a blue haze.
// Knob 2: Speed. 0.2 to 3, opening at 2. How fast the camera flies, near the walls it slows by itself.
// Knob 3: Carve. -1 to 1, opening at 0. The size of the cubes against their tunnels and domes: at -1 small blocks and wide tunnels, an airy hall of beams; at 1 fat cubes with narrow tunnels and round chambers, a dense lattice.
// Knob 4: Roll. -1 to 1, opening at about 0.06. How fast the camera turns about its own axis, clockwise at 1 and the other way at -1.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const RW = 48, RH = 96;       // the trace grid, upsampled to the panel
const FOC = 50;               // focal length in LED
const MAXSTEP = 44;
const FAR = 9;
const SAFE = 0.045;           // the camera never gets closer to a wall than this
const NV = 4;                 // rotation variants, one is picked per cell
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function h3(i, j, k) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// dark orange and yellow read as brown on the panel, so those hues are lifted and washed a little
function hsv(h, s, v, out) {
  h = h - floor(h);
  const w = 0.5 + 0.5 * cos(TP * (h - 0.09)), w2 = w * w * w;
  s *= 1 - 0.4 * w2; v *= 1 + 0.9 * w2; if (v > 1) v = 1;
  h *= 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the world: a lattice of cubes, period 2, each carved by crosses at three scales -------------
const S = { w: 0.7, wmax: 0.8, hw: 0.33, rs: 0.55, R: new Float64Array(NV * 2 * 9), lv: 0, cell: 0, nl: 3 };

function rotMat(out, o, a, b, c) {
  // rotation about z by a, then x by b, then y by c
  const ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b), cc = cos(c), sc = sin(c);
  const a00 = ca, a01 = -sa, a02 = 0;
  const a10 = cb * sa, a11 = cb * ca, a12 = -sb;
  const a20 = sb * sa, a21 = sb * ca, a22 = cb;
  out[o] = cc * a00 + sc * a20; out[o + 1] = cc * a01 + sc * a21; out[o + 2] = cc * a02 + sc * a22;
  out[o + 3] = a10; out[o + 4] = a11; out[o + 5] = a12;
  out[o + 6] = -sc * a00 + cc * a20; out[o + 7] = -sc * a01 + cc * a21; out[o + 8] = -sc * a02 + cc * a22;
}

function de(px, py, pz) {
  const cx = floor(px * 0.5 + 0.5), cy = floor(py * 0.5 + 0.5), cz = floor(pz * 0.5 + 0.5);
  const x = px - 2 * cx, y = py - 2 * cy, z = pz - 2 * cz;
  const ax = abs(x), ay = abs(y), az = abs(z);
  const hh = h3(cx, cy, cz);
  const w = S.w * (0.9 + 0.1 * hh);
  const m = max(ax, ay, az);
  const hw = S.hw;
  // level 1: the cross through the cube, axis aligned
  let d = m - w;
  let lv = 0;
  const c1 = hw - min(max(ax, ay), max(ay, az), max(az, ax));
  if (c1 > d) { d = c1; lv = 1; }
  // a round chamber at the junction, wide enough to open all six tunnels into one dome
  const rs = S.rs * (0.78 + 0.44 * ((hh * 13.7) % 1));
  const cs = rs - sqrt(x * x + y * y + z * z);
  if (cs > d) { d = cs; lv = 4; }
  const nl = S.nl;
  if (nl > 1) {
    // levels 2 and 3 in a frame turned about the middle of the cell
    const R = S.R;
    let o = (((hh * 977) | 0) & 3) * 18;
    let rx = R[o] * x + R[o + 1] * y + R[o + 2] * z, ry = R[o + 3] * x + R[o + 4] * y + R[o + 5] * z, rz = R[o + 6] * x + R[o + 7] * y + R[o + 8] * z;
    let q = rx * 3 + 1, a = abs(q - 2 * floor(q * 0.5) - 1);
    q = ry * 3 + 1; let b = abs(q - 2 * floor(q * 0.5) - 1);
    q = rz * 3 + 1; let c = abs(q - 2 * floor(q * 0.5) - 1);
    const c2 = (hw - min(max(a, b), max(b, c), max(c, a))) * 0.3333;
    if (c2 > d) { d = c2; lv = 2; }
    if (nl > 2) {
      o += 9;
      rx = R[o] * x + R[o + 1] * y + R[o + 2] * z; ry = R[o + 3] * x + R[o + 4] * y + R[o + 5] * z; rz = R[o + 6] * x + R[o + 7] * y + R[o + 8] * z;
      q = rx * 9 + 1; a = abs(q - 2 * floor(q * 0.5) - 1);
      q = ry * 9 + 1; b = abs(q - 2 * floor(q * 0.5) - 1);
      q = rz * 9 + 1; c = abs(q - 2 * floor(q * 0.5) - 1);
      const c3 = (hw - min(max(a, b), max(b, c), max(c, a))) * 0.1111;
      if (c3 > d) { d = c3; lv = 3; }
    }
  }
  // the neighbouring cubes lie at least this far away
  const cap = 2 - m - S.wmax;
  if (cap < d) d = cap;
  S.lv = lv; S.cell = hh;
  return d;
}

// ---- state --------------------------------------------------------------------
export function setup(params) {
  const ph = new Float64Array(32);
  for (let i = 0; i < 32; i++) ph[i] = Math.random() * TP;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0, ph,
    pos: [0, 0, 0], f: [0, 0, 1], u: [0, 1, 0], r: [1, 0, 0],
    rp: [0, 0, 0], J: [0, 0, 0], dir: 4, ndir: 4, turns: 0,
    dcam: 0.3, speed: 0, minde: 9, nsafe: 0,
    buf: new Float32Array(RW * RH * 3), nrm: new Float32Array(RW * RH * 3), dep: new Float32Array(RW * RH), lvb: new Uint8Array(RW * RH), cel: new Float32Array(RW * RH), mnd: new Float32Array(RW * RH), ed: new Float32Array(RW * RH), eb: new Float32Array(RW * RH), stp: new Float32Array(RW * RH), hitb: new Uint8Array(RW * RH),
  });
  return st;
}

function normalize(v) {
  const l = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  v[0] /= l; v[1] /= l; v[2] /= l;
}
function cross(a, b, o) {
  const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
  o[0] = x; o[1] = y; o[2] = z;
}
function rollAbout(st, ang) {
  const u = st.u, r = st.r;
  const c = cos(ang), s = sin(ang);
  for (let i = 0; i < 3; i++) { const ri = r[i], ui = u[i]; r[i] = c * ri + s * ui; u[i] = c * ui - s * ri; }
}
// turn the camera frame so its forward becomes fn by the shortest way, carrying up and right along
function carry(st, fn) {
  const f = st.f, u = st.u, r = st.r;
  const ax = f[1] * fn[2] - f[2] * fn[1], ay = f[2] * fn[0] - f[0] * fn[2], az = f[0] * fn[1] - f[1] * fn[0];
  const s = sqrt(ax * ax + ay * ay + az * az), c = f[0] * fn[0] + f[1] * fn[1] + f[2] * fn[2];
  if (s > 1e-7) {
    const kx = ax / s, ky = ay / s, kz = az / s;
    for (const v of [u, r]) {
      const d = kx * v[0] + ky * v[1] + kz * v[2];
      const cx = ky * v[2] - kz * v[1], cy = kz * v[0] - kx * v[2], cz = kx * v[1] - ky * v[0];
      const nx = v[0] * c + cx * s + kx * d * (1 - c), ny = v[1] * c + cy * s + ky * d * (1 - c), nz = v[2] * c + cz * s + kz * d * (1 - c);
      v[0] = nx; v[1] = ny; v[2] = nz;
    }
  }
  f[0] = fn[0]; f[1] = fn[1]; f[2] = fn[2];
  // keep the frame square
  normalize(f);
  cross(u, f, r); normalize(r);
  cross(f, r, u); normalize(u);
}

function world(st, t) {
  const ks = st.ks, p = st.ph;
  const k3 = cl(ks[2], -1, 1);
  const wob = 0.035 * sin(0.047 * t + p[0]) + 0.025 * sin(0.0291 * t + p[1]);
  S.w = cl(0.69 + 0.17 * k3 + wob, 0.46, 0.9);
  S.wmax = S.w;
  S.hw = cl(0.36 - 0.07 * k3 + 0.02 * sin(0.061 * t + p[2]), 0.22, 0.45);
  S.rs = cl(0.56 + 0.06 * k3 + 0.05 * sin(0.039 * t + p[6]), 0.4, 0.7);
  for (let v = 0; v < NV; v++) {
    const a = 0.45 * sin(0.071 * t * (1 + 0.31 * v) + p[3 + v]) + 0.3 * sin(0.0373 * t + p[7 + v]) + v * 0.7;
    const b = 0.5 * sin(0.053 * t * (1 + 0.27 * v) + p[11 + v]) + 0.3 * sin(0.0291 * t + p[15 + v]) - v * 0.3;
    const c = 0.4 * sin(0.0431 * t * (1 + 0.19 * v) + p[19 + v]) + 0.9 * v;
    rotMat(S.R, v * 18, a, b, c);
    rotMat(S.R, v * 18 + 9, b * 1.3 + 0.5, c - a, a * 0.7 + 0.4);
  }
}

// pick where the rail goes after the next junction: straight on or a quarter turn, never back
function pickDir(st, cur) {
  const rr = Math.random();
  if (rr < 0.4) return cur;
  const axis = cur >> 1;
  const opts = [];
  for (let i = 0; i < 6; i++) if ((i >> 1) !== axis) opts.push(i);
  return opts[floor(Math.random() * opts.length) % opts.length];
}

function openPos(st) {
  // stand in the middle of a tunnel, a little before a junction, looking down it
  st.dir = 4; st.ndir = 4;
  st.rp[0] = 0; st.rp[1] = 0; st.rp[2] = -1.5;
  st.J[0] = 0; st.J[1] = 0; st.J[2] = 0;
  st.pos[0] = 0; st.pos[1] = 0; st.pos[2] = -1.75;
  st.f[0] = 0; st.f[1] = 0; st.f[2] = 1;
  st.u[0] = 0; st.u[1] = 1; st.u[2] = 0;
  st.r[0] = 1; st.r[1] = 0; st.r[2] = 0;
}

function gradStep(st) {
  // push the camera out of a wall along the gradient of the distance estimate
  const p = st.pos, h = 0.01;
  const gx = de(p[0] + h, p[1], p[2]) - de(p[0] - h, p[1], p[2]);
  const gy = de(p[0], p[1] + h, p[2]) - de(p[0], p[1] - h, p[2]);
  const gz = de(p[0], p[1], p[2] + h) - de(p[0], p[1], p[2] - h);
  const l = sqrt(gx * gx + gy * gy + gz * gz);
  if (l < 1e-9) return;
  const d = de(p[0], p[1], p[2]);
  const need = SAFE - d + 0.005;
  p[0] += gx / l * need; p[1] += gy / l * need; p[2] += gz / l * need;
}

const ft = [0, 0, 1], tp = [0, 0, 0];

function step(st, dt) {
  st.t += dt;
  const t = st.t, p = st.ph, k = st.k, ks = st.ks;
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  world(st, t);
  S.nl = 3;
  const pos = st.pos, rp = st.rp, J = st.J;
  const dcam = de(pos[0], pos[1], pos[2]);
  st.dcam = dcam;
  // speed follows the room, slow near walls
  const room = sstep(0.03, 0.2, dcam);
  const v = (0.5 + 0.75 * cl(ks[1], 0, 3.5)) * 0.14 * (0.15 + 0.85 * room);
  st.speed = v;
  // the rail point runs along the middle line of the tunnels, a quarter turn at some junctions
  let dv = DIRS[st.dir];
  let adv = v * dt;
  for (let guard = 0; guard < 4 && adv > 0; guard++) {
    const toJ = (J[0] - rp[0]) * dv[0] + (J[1] - rp[1]) * dv[1] + (J[2] - rp[2]) * dv[2];
    if (toJ > adv) { rp[0] += dv[0] * adv; rp[1] += dv[1] * adv; rp[2] += dv[2] * adv; adv = 0; break; }
    rp[0] = J[0]; rp[1] = J[1]; rp[2] = J[2];
    adv -= max(toJ, 0);
    st.dir = st.ndir;
    dv = DIRS[st.dir];
    J[0] += 2 * dv[0]; J[1] += 2 * dv[1]; J[2] += 2 * dv[2];
    st.ndir = pickDir(st, st.dir);
    st.turns++;
  }
  // the camera follows the rail point with a lag and a small drift off the middle line
  const hw = S.hw;
  const am = 0.3 * hw;
  const ox = am * (sin(0.173 * t + p[24]) + 0.6 * sin(0.0731 * t + p[25]));
  const oy = am * (sin(0.131 * t + p[26]) + 0.6 * sin(0.0927 * t + p[27]));
  const oz = am * (sin(0.151 * t + p[28]) + 0.6 * sin(0.0619 * t + p[29]));
  const ax = st.dir >> 1;
  tp[0] = rp[0] + (ax === 0 ? 0 : ox); tp[1] = rp[1] + (ax === 1 ? 0 : oy); tp[2] = rp[2] + (ax === 2 ? 0 : oz);
  const ap = 1 - exp(-dt / 0.3);
  pos[0] += (tp[0] - pos[0]) * ap; pos[1] += (tp[1] - pos[1]) * ap; pos[2] += (tp[2] - pos[2]) * ap;
  let d2 = de(pos[0], pos[1], pos[2]);
  if (d2 < SAFE) { st.nsafe++; gradStep(st); d2 = de(pos[0], pos[1], pos[2]); }
  if (d2 < st.minde) st.minde = d2;
  // look a little ahead along the rail, through the next junction if it is near
  const La = 1.1;
  const toJ = (J[0] - rp[0]) * dv[0] + (J[1] - rp[1]) * dv[1] + (J[2] - rp[2]) * dv[2];
  const nd = DIRS[st.ndir];
  let lx, ly, lz;
  if (toJ >= La) { lx = rp[0] + dv[0] * La; ly = rp[1] + dv[1] * La; lz = rp[2] + dv[2] * La; }
  else { const rem = La - toJ; lx = J[0] + nd[0] * rem; ly = J[1] + nd[1] * rem; lz = J[2] + nd[2] * rem; }
  ft[0] = lx - pos[0]; ft[1] = ly - pos[1]; ft[2] = lz - pos[2];
  // the eye wanders a few degrees about the line of flight
  ft[0] += 0.09 * sin(0.213 * t + p[20]) + 0.05 * sin(0.0937 * t + p[21]);
  ft[1] += 0.09 * sin(0.187 * t + p[22]) + 0.05 * sin(0.1131 * t + p[23]);
  ft[2] += 0.09 * sin(0.161 * t + p[30]) + 0.05 * sin(0.0821 * t + p[31]);
  normalize(ft);
  const af = 1 - exp(-dt / 0.8);
  const fn = [st.f[0] + (ft[0] - st.f[0]) * af, st.f[1] + (ft[1] - st.f[1]) * af, st.f[2] + (ft[2] - st.f[2]) * af];
  normalize(fn);
  carry(st, fn);
  if (!(pos[0] + pos[1] + pos[2] + st.f[0] + st.u[0] + st.r[0] === pos[0] + pos[1] + pos[2] + st.f[0] + st.u[0] + st.r[0])) {
    // a number went bad: start again on a fresh rail
    openPos(st);
  }
  const kr = cl(ks[3], -1, 1);
  const rollRate = 0.5 * kr * (1 + 0.4 * sin(0.173 * t + p[10]) + 0.25 * sin(0.0617 * t + p[11])) + 0.05 * sin(0.083 * t + p[8]) + 0.04 * sin(0.0467 * t + p[9]);
  rollAbout(st, rollRate * dt);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    openPos(st);
    world(st, 0);
  }
  if (dt > 0) step(st, dt);
}

// ---- drawing ------------------------------------------------------------------
const FH = [0.02, -0.06, 0.05, 0.1, 0.0];     // hue offset of the wall at each carving level
const FV = [0.42, 0.4, 0.36, 0.3, 0.4];      // wall brightness
const NI = [1, 1, 0.6, 0.4, 0.9];            // edge brightness
const NH = [-0.13, -0.13, 0.27, 0.45, 0.52];   // and of its lit edge
const haze = [0, 0, 0], tmp = [0, 0, 0];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  world(st, st.t);
  const buf = st.buf, nrm = st.nrm, dep = st.dep, lvb = st.lvb, cel = st.cel, mnd = st.mnd, stp = st.stp, hitb = st.hitb;
  const pos = st.pos, f = st.f, u = st.u, r = st.r;
  // the knob runs quickly through the muddy orange and slowly through blue and cyan
  const hb = st.ks[0] + 0.6;
  const tm = st.t, ph = st.ph;
  const hue = hb + 0.1 * sin(TP * (hb - 0.06)) + 0.04 * (sin(0.0371 * tm + ph[12]) - sin(ph[12])) + 0.03 * (sin(0.0153 * tm + ph[13]) - sin(ph[13]));
  const hg = 1 + 0.22 * (sin(0.0431 * tm + ph[14]) - sin(ph[14])) + 0.14 * (sin(0.0197 * tm + ph[15]) - sin(ph[15]));
  hsv(hue + 0.06, 0.85, 0.5, haze);
  const Lx = -0.35 * r[0] + 0.55 * u[0] - 0.5 * f[0], Ly = -0.35 * r[1] + 0.55 * u[1] - 0.5 * f[1], Lz = -0.35 * r[2] + 0.55 * u[2] - 0.5 * f[2];
  const ll = 1 / sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
  const lx = Lx * ll, ly = Ly * ll, lz = Lz * ll;
  const sc = 64 / RW;
  const pix = sc / FOC;
  // pass 1: trace
  for (let j = 0; j < RH; j++) {
    for (let i = 0; i < RW; i++) {
      const sx = ((i + 0.5) * sc - 32) / FOC, sy = ((j + 0.5) * sc - 64) / FOC;
      let dx = f[0] + r[0] * sx - u[0] * sy, dy = f[1] + r[1] * sx - u[1] * sy, dz = f[2] + r[2] * sx - u[2] * sy;
      const il = 1 / sqrt(dx * dx + dy * dy + dz * dz); dx *= il; dy *= il; dz *= il;
      let tt = 0.03, k = 0, mind = 1e9, hit = false, d = 0;
      for (; k < MAXSTEP; k++) {
        const fp = pix * tt;
        S.nl = fp < 0.012 ? 3 : fp < 0.07 ? 2 : 1;
        d = de(pos[0] + dx * tt, pos[1] + dy * tt, pos[2] + dz * tt);
        const rr = d / (fp + 1e-4); if (rr < mind) mind = rr;
        if (d < fp * 0.6 + 2e-4) { hit = true; break; }
        tt += d; if (tt > FAR) break;
      }
      const q = j * RW + i;
      dep[q] = tt; mnd[q] = mind; stp[q] = k; hitb[q] = hit ? 1 : 0;
      if (hit) {
        lvb[q] = S.lv; cel[q] = S.cell;
        const hx = pos[0] + dx * tt, hy = pos[1] + dy * tt, hz2 = pos[2] + dz * tt;
        const h = max(2e-3, pix * tt * 0.9);
        const nx = de(hx + h, hy, hz2) - de(hx - h, hy, hz2), ny = de(hx, hy + h, hz2) - de(hx, hy - h, hz2), nz = de(hx, hy, hz2 + h) - de(hx, hy, hz2 - h);
        const nlen = 1 / (sqrt(nx * nx + ny * ny + nz * nz) + 1e-9);
        nrm[q * 3] = nx * nlen; nrm[q * 3 + 1] = ny * nlen; nrm[q * 3 + 2] = nz * nlen;
      } else { nrm[q * 3] = 0; nrm[q * 3 + 1] = 0; nrm[q * 3 + 2] = 0; }
    }
  }
  // pass 2a: where the surface creases, or one wall ends in front of another
  const ed = st.ed, eb = st.eb;
  for (let j = 0; j < RH; j++) {
    for (let i = 0; i < RW; i++) {
      const q = j * RW + i, o = q * 3;
      let e = 0;
      if (hitb[q]) {
        const tt = dep[q], nx = nrm[o], ny = nrm[o + 1], nz = nrm[o + 2];
        for (let n = 0; n < 4; n++) {
          const ii = i + (n === 0 ? 1 : n === 1 ? -1 : 0), jj = j + (n === 2 ? 1 : n === 3 ? -1 : 0);
          if (ii < 0 || jj < 0 || ii >= RW || jj >= RH) continue;
          const q2 = jj * RW + ii;
          if (!hitb[q2]) { if (0.7 > e) e = 0.7; continue; }
          const o2 = q2 * 3;
          const dn = 1 - (nx * nrm[o2] + ny * nrm[o2 + 1] + nz * nrm[o2 + 2]);
          const t2 = dep[q2];
          const dr = abs(tt - t2) / (min(tt, t2) + 0.05);
          const ev = max(sstep(0.15, 0.6, dn), sstep(0.25, 0.9, dr) * (tt < t2 ? 1 : 0.4));
          if (ev > e) e = ev;
        }
      }
      ed[q] = e;
    }
  }
  // a soft halo round the lines
  for (let j = 0; j < RH; j++) {
    for (let i = 0; i < RW; i++) {
      const q = j * RW + i;
      let sum = 0, n = 0;
      for (let dj = -2; dj <= 2; dj++) {
        const jj = j + dj; if (jj < 0 || jj >= RH) continue;
        for (let di = -2; di <= 2; di++) {
          const ii = i + di; if (ii < 0 || ii >= RW) continue;
          const w = 1 / (1 + di * di + dj * dj);
          sum += ed[jj * RW + ii] * w; n += w;
        }
      }
      eb[q] = sum / n;
    }
  }
  // pass 2b: shade
  for (let j = 0; j < RH; j++) {
    for (let i = 0; i < RW; i++) {
      const q = j * RW + i, o = q * 3;
      const sx = ((i + 0.5) * sc - 32) / FOC, sy = ((j + 0.5) * sc - 64) / FOC;
      const off = sx * sx + sy * sy;
      const hz = (0.7 + 0.9 * exp(-off * 5)) * hg;
      let R, G, B;
      if (hitb[q]) {
        const tt = dep[q];
        const lv = lvb[q];
        const nx = nrm[o], ny = nrm[o + 1], nz = nrm[o + 2];
        const dc = nx * dxof(sx, sy, f, r, u, 0) + ny * dxof(sx, sy, f, r, u, 1) + nz * dxof(sx, sy, f, r, u, 2);
        const faceF = max(0, -dc);
        const dif = max(0, nx * lx + ny * ly + nz * lz);
        const ao = 1 - 1.4 * stp[q] / MAXSTEP;
        const lampI = 1 / (1 + 2.2 * tt * tt);
        const hs = (cel[q] - 0.5) * 0.16;
        hsv(hue + FH[lv] + hs, 0.8, FV[lv], tmp);
        const lit = (0.15 + 0.12 * dif + 1.2 * lampI * faceF) * (0.3 + 0.7 * (ao > 0 ? ao : 0));
        const fog = 1 - exp(-tt * 0.36);
        const kf = 1 - fog;
        const R0 = tmp[0] * lit, G0 = tmp[1] * lit, B0 = tmp[2] * lit;
        hsv(hue + NH[lv] + hs + 0.05 * fog, 0.7, 1, tmp);
        const el = (ed[q] * 0.9 + eb[q] * 1.3) * (0.3 + 1.0 * lampI + 0.55 * (1 - fog)) * NI[lv];
        R = (R0 + tmp[0] * el) * kf + haze[0] * fog * hz;
        G = (G0 + tmp[1] * el) * kf + haze[1] * fog * hz;
        B = (B0 + tmp[2] * el) * kf + haze[2] * fog * hz;
      } else {
        const gl = exp(-mnd[q] * 0.5);
        const g2 = hz * (1.0 + 0.3 * gl) + eb[q] * 0.5;
        R = haze[0] * g2; G = haze[1] * g2; B = haze[2] * g2;
      }
      buf[o] = R; buf[o + 1] = G; buf[o + 2] = B;
    }
  }
  void tmp;
  // upsample to the panel
  for (let y = 0; y < H; y++) {
    let fy = (y + 0.5) * RH / H - 0.5; fy = fy < 0 ? 0 : fy > RH - 1.001 ? RH - 1.001 : fy;
    const j = floor(fy), ty = fy - j;
    for (let x = 0; x < W; x++) {
      let fx = (x + 0.5) * RW / W - 0.5; fx = fx < 0 ? 0 : fx > RW - 1.001 ? RW - 1.001 : fx;
      const i = floor(fx), tx = fx - i;
      const o0 = (j * RW + i) * 3, o1 = o0 + 3, o2 = o0 + RW * 3, o3 = o2 + 3;
      const w0 = (1 - tx) * (1 - ty), w1 = tx * (1 - ty), w2 = (1 - tx) * ty, w3 = tx * ty;
      const rr = (buf[o0] * w0 + buf[o1] * w1 + buf[o2] * w2 + buf[o3] * w3) * 255;
      const gg = (buf[o0 + 1] * w0 + buf[o1 + 1] * w1 + buf[o2 + 1] * w2 + buf[o3 + 1] * w3) * 255;
      const bb = (buf[o0 + 2] * w0 + buf[o1 + 2] * w1 + buf[o2 + 2] * w2 + buf[o3 + 2] * w3) * 255;
      display.setPixel(x, y, rr < 0 ? 0 : rr > 255 ? 255 : rr | 0, gg < 0 ? 0 : gg > 255 ? 255 : gg | 0, bb < 0 ? 0 : bb > 255 ? 255 : bb | 0);
    }
  }
}
// the ray direction of a screen point, one component
function dxof(sx, sy, f, r, u, c) {
  const dx = f[0] + r[0] * sx - u[0] * sy, dy = f[1] + r[1] * sx - u[1] * sy, dz = f[2] + r[2] * sx - u[2] * sy;
  const il = 1 / sqrt(dx * dx + dy * dy + dz * dz);
  return (c === 0 ? dx : c === 1 ? dy : dz) * il;
}
