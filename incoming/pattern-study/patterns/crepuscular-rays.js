// ===== Patternflow pattern =====
// Title:   Crepuscular Rays
// Family:  crepuscular
// Idea:    A low sun at the bottom of the panel is ringed by drifting dark plum cloud, and the light that gets through, counted for every LED by the cloud along its ray back to the sun, fans out as gold, peach and rose shafts through the gaps with a dark wedge behind each cloud, over an indigo sky with rose cirrus and thin layers of haze that catch the light.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: crepuscular rays and the screen-space radial light-shaft pass (Kenny Mitchell, GPU Gems 3, 2007, from memory), single-scattering haze (from memory); the polar optical-depth table around a sun that may stand outside the frame, the drifting fbm cloud ring and the self-lit cloud edges, the light-catching haze layers and the palette are original, pattern round 250
// Round:   250
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Haze=0..4, Cover=-1..1, Sun=-1..1
//
// Knob 1: Hue. Turns the sky, the shafts and the clouds round the wheel while the sun core stays near white; it opens on gold and rose shafts over indigo and teal.
// Knob 2: Haze. 0 to 4, opening at 2. How much light the air holds: at 0 the shafts are faint and the clouds are silhouettes, at 4 the shafts are thick glowing beams that wash into each other.
// Knob 3: Cover. -1 to 1, opening at 0. How much of the sky is under cloud: at -1 the ring round the sun is thin and broken and a wide fan gets out, at 1 it is nearly closed with slim shafts between its breaks.
// Knob 4: Sun. -1 to 1, opening at about 0.06. Where the sun stands: at -1 low on the left below the bottom edge so the fan leans right, at 1 a white disc high on the right inside the panel.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, atan2, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// density grid, 2 LED cells, wider than the panel so rays that start outside it still read clouds
const CELL = 1.5, GX0 = -24, GY0 = -16, GW = 76, GH = 108, DW = 0.3;
// the polar table: the optical depth from the sun out along each angle
const RS = 2, DTH = 0.006;

function hash3(i, j, k, s) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function n3(x, y, z, s) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash3(xi, yi, zi, s), b = hash3(xi + 1, yi, zi, s), c = hash3(xi, yi + 1, zi, s), d = hash3(xi + 1, yi + 1, zi, s);
  const e = hash3(xi, yi, zi + 1, s), f = hash3(xi + 1, yi, zi + 1, s), g = hash3(xi, yi + 1, zi + 1, s), h = hash3(xi + 1, yi + 1, zi + 1, s);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return y0 + (y1 - y0) * fz;
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// a dark orange or yellow reads as brown on the panel, so a dark colour that the hue knob turns that way is lifted
function hsvL(h, sat, v, out) {
  const w = 0.5 + 0.5 * cos(TP * (h - 0.08));
  hsv(h, sat * (1 - 0.12 * w * w), v * (1 + 0.4 * w * w), out);
}

export function setup(params) {
  const ph = new Float64Array(40);
  for (let i = 0; i < 40; i++) ph[i] = Math.random() * TP;
  const NTMAX = ceil2(TP / DTH) + 4;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 0, ph, seed: floor(Math.random() * 1e9) | 0,
    ox: Math.random() * 500, oy: Math.random() * 500, wdir: Math.random() < 0.5 ? -1 : 1,
    sx: 32, sy: 140, cov: 0, o2: Math.random() * 500, o3: Math.random() * 500, cir: 0,
    den: new Float32Array(GW * GH),
    tab: new Float32Array(NTMAX * 130),
    nt: 0, nr: 0, a0: 0,
  });
  return st;
}
function ceil2(v) { return Math.ceil(v); }

// ---- the cloud density field -------------------------------------------------
function density(st) {
  const den = st.den, t = st.t, s = st.seed, p = st.ph;
  const z = t * 0.021;
  const cov = st.cov;
  const thr0 = -0.22 - (cov > 0 ? 0.42 : 0.6) * cov;
  const sx = st.sx, sy = st.sy;
  // the deck: a ragged ring of cloud round the sun, with a thin high layer of wisps above it
  const R0 = 46 + 3 * sin(0.0273 * t + p[8]) + 2 * sin(0.0151 * t + p[9]);
  const yb = 122 + 4 * sin(0.0151 * t + p[15]) + 3 * sin(0.0069 * t + p[16]);
  for (let gy = 0; gy < GH; gy++) {
    const y = GY0 + gy * CELL;
    const dys = y - sy;
    for (let gx = 0; gx < GW; gx++) {
      const x = GX0 + gx * CELL;
      const u = (x - st.ox) / 10, v = (y - st.oy) / 7;
      const wx = n3(u * 0.55 + 7.3, v * 0.55, z * 0.8, s) - 0.5, wy = n3(u * 0.55, v * 0.55 + 3.1, z * 0.8 + 5, s) - 0.5;
      const uu = u + wx * 2.2, vv = v + wy * 2.2;
      const f = 0.6 * n3(uu, vv, z, s) + 0.3 * n3(uu * 2.03, vv * 2.03, z * 1.37 + 4, s) + 0.1 * n3(uu * 3.7, vv * 3.7, z * 1.9 + 9, s);
      const g = (f - 0.5) * 3.4;
      const dxs = x - sx;
      const clear = 1.35 * exp(-(dxs * dxs + dys * dys) / 190);
      // the ring: a deck of cloud that stands a little way off the sun, and a low bank in front of the glow
      const rr = sqrt(dxs * dxs + dys * dys);
      // the ring is thicker and nearer in some directions than in others, and the directions turn slowly
      const an = atan2(dys, dxs);
      const am = 0.2 * sin(2.3 * an + 0.0611 * t + p[21]) + 0.14 * sin(3.7 * an - 0.0437 * t + p[22]) + 0.1 * sin(5.9 * an + 0.0293 * t + p[23]);
      const qd = (rr - R0 - 9 * sin(1.9 * an + 0.0531 * t + p[24])) / 17;
      const bq = (y - yb) / 12;
      // great banks of thicker and thinner cloud, many times the size of one puff
      const big = (n3((x - st.ox) / 24 + 100, (y - st.oy) / 20, z * 0.7 + 50, s) - 0.5) * 1.5;
      const d1 = g - (thr0 + am + big + 1.0 * qd * qd + 1.0 * clear);
      const gb = (0.6 * n3(uu * 0.8 + 50, vv * 1.5 + 20, z * 1.1 + 40, s) + 0.4 * n3(uu * 1.9 + 3, vv * 3.1, z * 1.6 + 60, s) - 0.5) * 3.4;
      const d0 = gb - (thr0 + 0.3 + 1.0 * bq * bq + 1.0 * clear);
      // small clouds scattered over the sky, lit where a shaft crosses them and dark where it does not
      const gs = (0.7 * n3(uu * 0.5 + 80, vv * 0.75 + 33, z * 1.3 + 70, s) + 0.3 * n3(uu * 1.1 + 9, vv * 1.6 + 4, z * 1.8 + 31, s) - 0.5) * 3.4;
      const d2 = (gs - (0.5 * thr0 + 0.95 + 0.9 * sstep(30, 5, y) + 1.2 * clear)) * 0.8;
      const dm = d0 > d1 ? d0 : d1;
      const d = dm > d2 ? dm : d2;
      den[gy * GW + gx] = d;
    }
  }
}
// the grid holds how far each cell stands above the cloud threshold; the cloud is the smoothed
// positive part of that, taken after the bilinear lookup so its edges stay round
function qat(den, x, y) {
  const gx = (x - GX0) / CELL, gy = (y - GY0) / CELL;
  if (gx < 0 || gy < 0 || gx >= GW - 1 || gy >= GH - 1) return -9;
  const i = gx | 0, j = gy | 0, tx = gx - i, ty = gy - j, o = j * GW + i;
  return (den[o] * (1 - tx) + den[o + 1] * tx) * (1 - ty) + (den[o + GW] * (1 - tx) + den[o + GW + 1] * tx) * ty;
}
function dens(den, x, y) {
  const q = qat(den, x, y) / DW;
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  return q * q * (3 - 2 * q);
}

// ---- the polar table -----------------------------------------------------------
function table(st) {
  const sx = st.sx, sy = st.sy, den = st.den, tab = st.tab;
  // the angles the panel can be seen under, and the farthest corner
  let rmax = 0, amin = 9, amax = -9;
  const inside = sx >= 0 && sx <= W && sy >= 0 && sy <= H;
  const cx = atan2(H / 2 - sy, W / 2 - sx);
  for (let c = 0; c < 4; c++) {
    const px = c & 1 ? W : 0, py = c & 2 ? H : 0;
    rmax = max(rmax, sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy)));
    let a = atan2(py - sy, px - sx) - cx;
    a -= TP * Math.round(a / TP);
    amin = min(amin, a); amax = max(amax, a);
  }
  const span = inside ? TP : amax - amin + 0.06;
  st.a0 = inside ? -PI : cx + amin - 0.03;
  st.nt = Math.ceil(span / DTH) + 2;
  st.nr = Math.min(128, Math.ceil((rmax + 4) / RS) + 1);
  const nr = st.nr;
  for (let it = 0; it < st.nt; it++) {
    const a = st.a0 + it * DTH, ux = cos(a), uy = sin(a);
    let cum = 0;
    const o = it * nr;
    tab[o] = 0;
    for (let ir = 1; ir < nr; ir++) {
      const r = (ir - 0.5) * RS;
      cum += dens(den, sx + ux * r, sy + uy * r) * RS;
      tab[o + ir] = cum;
    }
  }
}
function depth(st, a, r) {
  let q = (a - st.a0) / TP;
  q -= floor(q);
  let ia = q * TP / DTH;
  if (ia > st.nt - 2) ia = st.nt - 2;
  const i = ia | 0, ta = ia - i;
  let ir = r / RS - 0.5 + 0.5;
  if (ir > st.nr - 1.001) ir = st.nr - 1.001;
  if (ir < 0) ir = 0;
  const j = ir | 0, tr = ir - j, nr = st.nr, tab = st.tab;
  const o = i * nr + j;
  return (tab[o] * (1 - tr) + tab[o + 1] * tr) * (1 - ta) + (tab[o + nr] * (1 - tr) + tab[o + nr + 1] * tr) * ta;
}

// ---- the step ------------------------------------------------------------------
function step(st, dt) {
  st.t += dt;
  const t = st.t, p = st.ph, k = st.k, ks = st.ks;
  const a = dt >= 1 ? 1 : 1 - exp(-dt / 0.3);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  // the wind
  const sp = 3.4 * (1 + 0.35 * sin(0.0713 * t + p[0]) + 0.22 * sin(0.0293 * t + p[1]));
  const ang = 0.45 * sin(0.0137 * t + p[2]) + 0.25 * sin(0.0051 * t + p[3]);
  st.ox += st.wdir * sp * cos(ang) * dt;
  st.o2 += st.wdir * sp * 1.9 * dt;
  st.o3 += st.wdir * sp * 1.1 * dt;
  st.oy += sp * sin(ang) * 0.6 * dt;
  // the sun wanders: left and right, up and down
  const k4 = cl(ks[3], -1, 1);
  st.sx = 32 + 24 * k4 + 5 * sin(0.0521 * t + p[4]) + 3 * sin(0.0197 * t + p[5]);
  st.sy = 126 - (k4 < 0 ? 12 : 26) * k4 + 3 * sin(0.0343 * t + p[6]) + 2 * sin(0.0131 * t + p[7]);
  st.cir = 0.5 * sin(0.0371 * t + p[17]) + 0.3 * sin(0.0163 * t + p[18]);
  // coverage: the knob, and gaps that open and close
  st.cov = cl(ks[2], -1, 1) * 0.75 + 0.06 * sin(0.0671 * t + p[10]) + 0.04 * sin(0.0413 * t + p[11]) + 0.02 * sin(0.0179 * t + p[12]);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    step(st, 1);
  }
  if (dt > 0) step(st, dt);
  density(st);
  table(st);
}

// ---- drawing -------------------------------------------------------------------
const cSkyT = [0, 0, 0], cSkyM = [0, 0, 0], cSkyB = [0, 0, 0];
// the colour ramps: lit haze from the sky up to pale gold, and cloud from plum up to pale gold
const HZ = [0.3, 0.52, 0.74, 0.9, 1], CD = [0.35, 0.65, 0.85, 1];
const hzc = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const cld = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const cCore = [0, 0, 0], cirr = [0, 0, 0];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const den = st.den, sx = st.sx, sy = st.sy;
  const hz = (0.3 + 0.6 * cl(st.ks[1], 0, 4) / 2) * (1 + 0.08 * sin(0.0817 * st.t + st.ph[19]) + 0.05 * sin(0.0367 * st.t + st.ph[20]));
  const hue = st.ks[0] + 0.0;
  // the sky keeps changing its tint and where its bands lie, as the light does through an evening
  const T0 = st.t, P = st.ph;
  hsvL(hue + 0.57 + 0.035 * sin(0.0431 * T0 + P[25]) + 0.02 * sin(0.0197 * T0 + P[26]), 0.85, 0.46 * (1 + 0.12 * sin(0.0361 * T0 + P[27])), cSkyT);    // teal-blue at the top
  hsvL(hue + 0.68 + 0.03 * sin(0.0337 * T0 + P[28]) + 0.015 * sin(0.0151 * T0 + P[29]), 0.88, 0.36 * (1 + 0.15 * sin(0.0473 * T0 + P[30])), cSkyM);    // indigo
  hsvL(hue + 0.79 + 0.035 * sin(0.0517 * T0 + P[31]) + 0.02 * sin(0.0229 * T0 + P[32]), 0.72, 0.4 * (1 + 0.1 * sin(0.0293 * T0 + P[33])), cSkyB);     // violet low down
  const b1 = 0.5 + 0.1 * sin(0.0271 * T0 + P[34]), b2 = 0.45 + 0.1 * sin(0.0189 * T0 + P[35]);
  hsvL(hue + 0.78, 0.7, 0.5, hzc[0]);
  hsv(hue + 0.92, 0.66, 0.76, hzc[1]);
  hsv(hue + 1.02, 0.62, 0.95, hzc[2]);
  hsv(hue + 0.115, 0.72, 1, hzc[3]);
  hsv(hue + 0.125, 0.28, 1, hzc[4]);
  hsvL(hue + 0.78, 0.62, 0.25, cld[0]);
  hsvL(hue + 0.88, 0.62, 0.42, cld[1]);
  hsv(hue + 0.99, 0.6, 0.8, cld[2]);
  hsv(hue + 0.115, 0.72, 1, cld[3]);
  hsv(hue + 0.125, 0.28, 1, cld[4]);
  hsv(hue + 0.12, 0.2, 1, cCore);
  const TAU_S = 0.22, TAU_C = 0.3;
  const ramp = [0, 0, 0];
  const z3 = st.t * 0.045, z2 = st.t * 0.034, cyc = 20 + 8 * sin(0.0131 * st.t + st.ph[13]) + 5 * sin(0.0059 * st.t + st.ph[14]);
  hsv(hue + 0.97, 0.55, 1, cirr);
  for (let y = 0; y < H; y++) {
    const vy = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      const dx = px - sx, dy = py - sy;
      const r = sqrt(dx * dx + dy * dy) + 1e-3;
      const ux = dx / r, uy = dy / r;
      const od = depth(st, atan2(dy, dx), r);
      const T = exp(-TAU_S * od);
      const Tc = exp(-TAU_C * od);
      // the sky behind: teal above, indigo, violet low
      const u1 = sstep(0.0, b1, vy), u2 = sstep(b2, 1, vy);
      const sr = mix(mix(cSkyT[0], cSkyM[0], u1), cSkyB[0], u2), sg = mix(mix(cSkyT[1], cSkyM[1], u1), cSkyB[1], u2), sb = mix(mix(cSkyT[2], cSkyM[2], u1), cSkyB[2], u2);
      // light in the haze: falls off with distance, and is brighter toward the sun
      const E = 1 / (1 + pow(r / 60, 1.6));
      // patches of denser and thinner haze, far larger than a puff, that drift and change
      // the haze is denser in some places, and lies in long thin layers that the light catches
      const lay = n3((px - st.o3) / 38 + 200, py / 5.5 + 40, z3 * 0.8 + 300, st.seed) + 0.6 * n3((px - st.o3 * 1.3) / 17 + 90, py / 3.4, z3 * 1.3 + 120, st.seed);
      const hm = 1 + 1.1 * (n3((px - st.o3) / 24 + 70, py / 20, z3, st.seed) - 0.5) + 1.3 * cl(lay - 1.0, 0, 1) * (0.4 + 0.6 * sstep(100, 20, py));
      const H0 = hz * hm * (0.8 + 3.2 * exp(-r / 26));
      const sh = 1 - exp(-T * H0);
      let rr, gg2, bb;
      if (sh < HZ[0]) { const q = sh / HZ[0]; rr = mix(sr, hzc[0][0], q); gg2 = mix(sg, hzc[0][1], q); bb = mix(sb, hzc[0][2], q); }
      else { rampAt(hzc, HZ, sh, ramp); rr = ramp[0]; gg2 = ramp[1]; bb = ramp[2]; }
      // the sun itself
      const disc = exp(-(r * r) / 26) * T;
      rr += disc * cCore[0]; gg2 += disc * cCore[1]; bb += disc * cCore[2];
      // the cloud
      const q = qat(den, px, py);
      if (q > 0) {
        const dq = q / DW;
        const d = dq >= 1 ? 1 : dq * dq * (3 - 2 * dq);
        const al = 1 - exp(-4 * d);
        // how deep inside the cloud: thin edges glow with the haze behind, the thick middle stays plum
        const core = cl(q / 1.1, 0, 1);
        // the flank that faces the sun: the cloud gets thicker away from the sun there
        const face = cl((qat(den, px + ux * 2.2, py + uy * 2.2) - qat(den, px - ux * 2.2, py - uy * 2.2)) * 0.9, 0, 1);
        const wf = sstep(50, 110, r);
        const lit = 1 - exp(-H0);
        const lc = cl(exp(-2.6 * core) * mix(lit * (0.4 + 0.6 * pow(Tc, 0.6)), sh * 1.1, wf) + 0.4 * face * (1 - core) * lit * (1 - wf * 0.5) + 0.28 * exp(-r / 36) * lit + 0.15 * exp(-5 * core), 0, 1);
        if (lc < CD[0]) { const w = lc / CD[0]; ramp[0] = mix(cld[0][0], cld[1][0], w); ramp[1] = mix(cld[0][1], cld[1][1], w); ramp[2] = mix(cld[0][2], cld[1][2], w); }
        else rampAt(cld.slice(1), CD, lc, ramp);
        rr = rr * (1 - al) + ramp[0] * al; gg2 = gg2 * (1 - al) + ramp[1] * al; bb = bb * (1 - al) + ramp[2] * al;
      }
      // the high cirrus: it stays lit by the sun above the low deck's shadow, so it glows rose
      if (y < 70) {
        const cy = (y - cyc) / 11;
        const f2 = 0.6 * n3((px - st.o2) / 30 + 30, py / 4.5 + 11 + cy * 0.2, z2 + 21, st.seed) + 0.4 * n3((px - st.o2) / 13 + 5, py / 2.6, z2 * 1.4 + 3, st.seed);
        const q3 = ((f2 - 0.5) * 3.4 - (0.1 + 0.9 * cy * cy - 0.5 * st.cir)) * 0.9;
        if (q3 > 0) {
          const a3 = cl(q3 / 0.35, 0, 1) * 0.8;
          const m3 = 0.35 + 0.4 * exp(-r / 220);
          rr = rr * (1 - a3) + (cirr[0] * m3 + 0.15) * a3; gg2 = gg2 * (1 - a3) + (cirr[1] * m3 + 0.05) * a3; bb = bb * (1 - a3) + (cirr[2] * m3 + 0.1) * a3;
        }
      }
      display.setPixel(x, y, cl(rr * 255, 0, 255) | 0, cl(gg2 * 255, 0, 255) | 0, cl(bb * 255, 0, 255) | 0);
    }
  }
}
function rampAt(cols, stops, v, out) {
  // cols[i] sits at stops[i - 1 + off]; the caller passes a ramp whose first entry is at stops[0]
  let i = 0;
  const n = stops.length;
  while (i < n - 2 && v > stops[i + 1]) i++;
  const q = cl((v - stops[i]) / (stops[i + 1] - stops[i]), 0, 1);
  out[0] = mix(cols[i][0], cols[i + 1][0], q); out[1] = mix(cols[i][1], cols[i + 1][1], q); out[2] = mix(cols[i][2], cols[i + 1][2], q);
}
