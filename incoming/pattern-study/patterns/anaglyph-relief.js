// ===== Patternflow pattern =====
// Title:   Anaglyph Relief
// Family:  anaglyph
// Idea:    A furrowed plain seen from a low camera is drawn twice, once for each eye, the left view in red and the right in cyan, so its bright furrows split into red and cyan fringes where the ground is near, close up to white toward the horizon, and bulge and part as low hills roll under them toward the viewer, with a ring hanging behind the horizon.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the anaglyph (Wilhelm Rollmann, 1853, and Louis Ducos du Hauron's prints of 1891, from memory) and the floating-horizon column renderer for height fields (Thomas Wright, 1973, and the Voxel Space terrain of Kyle Freeman at NovaLogic, 1992, from memory); the field of unequal furrows that thins out with distance, the travelling hills and ridges that are reborn, the cloud shadow drawn as line weight, the sliding camera and the ring behind the horizon are original, pattern round 252
// Round:   252
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Depth=0..4, Hills=-1..1, Furrows=0..1
//
// Knob 1: Hue. Turns the two eye colours round the wheel as a complementary pair, so overlaps stay white; it opens at 0 on exactly red for the left eye and cyan for the right, which is what red-cyan glasses need.
// Knob 2: Depth. 0 to 4, opening at 2. The distance between the two eyes: at 0 both views agree and the picture is flat white lines, at 4 the near furrows stand about nine LEDs apart in red and cyan.
// Knob 3: Hills. -1 to 1, opening at 0. The height of the relief: a nearly flat plain at -1, tall hills at 1 that hide the ground behind them and stand up over the horizon.
// Knob 4: Furrows. 0 to 1, opening at about 0.06. The spacing of the furrows: three or four broad ones across the bottom edge at 0, many fine lines at 1, where cloud shadow also dims them more.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, sin, cos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();

const HZ = 40;      // the row of the horizon
const FL = 56;      // focal length, in LEDs
const ZC = 8;       // the distance that has no parallax: nearer ground comes out of the panel, farther ground sits behind it
const NZ = 128;     // depth steps of the march
const NS = 12;      // swell hills, which travel to the camera and pass under it
const NM = 4;       // far massifs, which cross the horizon sideways
const NHILL = NS + NM;
const NR = 2;       // long ridges
const GLOW = 0.44;  // the level of the air at the horizon
const FOG = 20;     // the distance at which the air has taken half of the contrast
const PITCH = 7;    // furrows are never drawn closer together than this many LEDs

// the depths the march visits: steps of 3 percent near the camera, 6 percent far away
// and how much of the relief stands at each: the ground settles flat as it comes under the camera
const ZS = new Float64Array(NZ), TAPER = new Float64Array(NZ);
const taper = (z) => sstep(0.15, 0.85, z);
(function depths() { let z = 0.36; for (let i = 0; i < NZ; i++) { ZS[i] = z; TAPER[i] = taper(z); z *= 1.03 + 0.034 * i / NZ; } })();

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the relief: hills that are born far off, come to the camera and are born again elsewhere ----
function swell(st, i, first) {
  st.rx[i] = 0.9 + 1.5 * rnd();
  st.rz[i] = 0.8 + 0.9 * rnd();
  st.amp[i] = first && i < 2 ? 0.7 + 0.2 * rnd() : 0.4 + 0.5 * rnd();
  st.hz[i] = first ? 1.4 + 17.6 * (i + rnd()) / NS : 12 + st.rz[i] + 8 * rnd();
  st.vz[i] = -(0.11 + 0.17 * rnd());
  st.vx[i] = (2 * rnd() - 1) * 0.04;
  // born where the camera will be by the time the hill has come up to it, give or take
  st.hx[i] = st.camX + ((st.ph[0] < PI ? -1 : 1) * SLIDE - st.vx[i]) * st.hz[i] / -st.vz[i] + (2 * rnd() - 1) * (first && i < 2 ? 1 : 2.6);
  st.bw[i] = 0.05 + 0.09 * rnd();
  st.bp[i] = rnd() * TP;
}
function massif(st, i, first) {
  st.rx[i] = 7 + 6 * rnd();
  st.rz[i] = 6 + 4 * rnd();
  st.amp[i] = 2.2 + 2.6 * rnd();
  st.hz[i] = 18 + 22 * rnd();
  const dir = rnd() < 0.5 ? -1 : 1;
  st.vx[i] = dir * (0.12 + 0.25 * rnd());
  st.hx[i] = first ? (2 * rnd() - 1) * 30 : st.camX - dir * (37 + st.rx[i]);
  st.vz[i] = 0;
  st.bw[i] = 0.02 + 0.04 * rnd();
  st.bp[i] = rnd() * TP;
}
function ridge(st, j, first) {
  const th = (2 * rnd() - 1) * 0.6;
  st.rnx[j] = sin(th); st.rnz[j] = cos(th);
  st.rr[j] = 0.9 + 0.8 * rnd();
  st.ra[j] = 0.2 + 0.22 * rnd();
  st.rv[j] = 0.1 + 0.16 * rnd();
  st.rd[j] = st.rnx[j] * st.camX + (first ? (j + rnd()) * 6.5 : 13 + st.rr[j] + 3 * rnd());
  st.rk[j] = 0.5 + 0.8 * rnd();
  st.rp[j] = rnd() * TP;
}

// ---- cloud shadow: smooth noise laid on the ground, which the wind carries toward the camera ----
function hash2(i, j, s) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, s) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
// how lit the ground is at one place: 0 in full shadow, 1 in full light
function light(X, z, wx, wz, seed) {
  const n1 = z < 7 ? (noise(X * 1.1 + wx, z * 0.9 + wz, seed) - 0.5) * (z <= 3 ? 1 : (7 - z) / 4) : 0;
  const n2 = (noise(X * 0.41 + wx * 0.37 + 11.3, z * 0.37 + wz * 0.41 + 7.7, seed) - 0.5) * (z <= 8 ? 1 : (16 - z) / 8);
  const m = (0.2 + 0.6 * n1 + 0.4 * n2) / 0.24;
  return m <= 0 ? 0 : m >= 1 ? 1 : m * m * (3 - 2 * m);
}

// the distance from one furrow to the next, in camera heights: about 20 LEDs along the bottom edge at the opening
const spacing = (k4) => 0.24 * pow(2, -1.5 * cl(k4, 0, 1));

// the camera slides sideways across the furrows, always the same way, now faster and now slower
const SLIDE = 0.05;
const wander = (p, t) => (p[0] < PI ? -1 : 1) * SLIDE * t + 0.5 * sin(0.0317 * t + p[1]) + 0.13 * sin(0.0831 * t + p[2]);

export function setup(params) {
  const ph = new Float64Array(24);
  for (let i = 0; i < 24; i++) ph[i] = rnd() * TP;
  const f = (n) => new Float64Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0, ph,
    camX: wander(ph, 0), camY: 1, yaw: 0, uc: 0, wx: rnd() * 100, wz: rnd() * 100, seed: floor(rnd() * 1e9) | 0,
    hx: f(NHILL), hz: f(NHILL), rx: f(NHILL), rz: f(NHILL), amp: f(NHILL), vx: f(NHILL), vz: f(NHILL), bw: f(NHILL), bp: f(NHILL), ha: f(NHILL),
    rnx: f(NR), rnz: f(NR), rr: f(NR), ra: f(NR), rv: f(NR), rd: f(NR), rk: f(NR), rp: f(NR), rae: f(NR),
    as: new Int32Array(NZ + 1), ak: new Uint8Array(NZ * NHILL), ad: f(NZ * NHILL), rzd: f(NZ * NR),
    il: new Float32Array(W * H), ir: new Float32Array(W * H),
  });
  // the picture opens with the ground in front of the camera in the light
  for (let n = 0; n < 40; n++) {
    let lo = 1;
    for (let q = 0; q < 9; q++) lo = min(lo, light(st.camX + (q % 3 - 1) * 0.4, 0.7 + 0.6 * floor(q / 3), st.wx, st.wz + 0.4, st.seed));
    if (lo > 0.9) break;
    st.wx = rnd() * 100; st.wz = rnd() * 100;
  }
  for (let i = 0; i < NS; i++) swell(st, i, true);
  for (let i = NS; i < NHILL; i++) massif(st, i, true);
  for (let j = 0; j < NR; j++) ridge(st, j, true);
  return st;
}

// the height of the ground at one place, for the camera's own footing
function ground(st, X, z) {
  let h = 0;
  for (let k = 0; k < NHILL; k++) {
    const dx = (X - st.hx[k]) / st.rx[k], dz = (z - st.hz[k]) / st.rz[k], r2 = dx * dx + dz * dz;
    if (r2 < 1) { const u = 1 - r2; h += st.ha[k] * u * u * u; }
  }
  for (let j = 0; j < NR; j++) {
    const s = (st.rnx[j] * X + st.rnz[j] * z - st.rd[j]) / st.rr[j];
    if (s * s < 1) { const u = 1 - s * s; h += st.rae[j] * u * u * u * (0.68 + 0.32 * sin(st.rk[j] * (st.rnz[j] * X - st.rnx[j] * z) + st.rp[j])); }
  }
  return h * taper(z);
}

function step(st, dt) {
  st.t += dt;
  const t = st.t, p = st.ph, k = st.k, ks = st.ks;
  const a = 1 - Math.exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  // the wind that carries the cloud shadows blows toward the camera and veers a little
  st.wz += dt * 0.26 * (1 + 0.3 * sin(0.0371 * t + p[10]));
  st.wx += dt * 0.1 * sin(0.0193 * t + p[11]);
  // the gaze turns a little from side to side
  const x0 = st.camX;
  st.camX = wander(p, t);
  // the camera's place counted in furrows, so that the spacing knob opens and closes them about the camera
  st.uc += (st.camX - x0) / spacing(ks[3]);
  st.yaw = 0.17 * sin(0.0297 * t + p[3]) + 0.09 * sin(0.0113 * t + p[4]) + 0.06 * sin(0.0731 * t + p[12]);
  const k3 = cl(ks[2], -1, 1);
  const hs = k3 < 0 ? 1 + 0.8 * k3 : 1 + 0.7 * k3;
  for (let i = 0; i < NHILL; i++) {
    st.hx[i] += st.vx[i] * dt;
    st.hz[i] += st.vz[i] * dt;
    const breath = 0.72 + 0.28 * sin(st.bw[i] * t + st.bp[i]);
    if (i < NS) {
      if (st.hz[i] < -st.rz[i] - 0.2) swell(st, i, false);
      st.ha[i] = st.amp[i] * breath * hs * sstep(12, 9, st.hz[i]);
    } else {
      const off = abs(st.hx[i] - st.camX);
      if (off > 37.5 + st.rx[i] && (st.hx[i] - st.camX) * st.vx[i] > 0) massif(st, i, false);
      st.ha[i] = st.amp[i] * breath * hs * sstep(36, 26, off);
    }
  }
  for (let j = 0; j < NR; j++) {
    st.rd[j] -= st.rv[j] * dt;
    if (st.rd[j] - st.rnx[j] * st.camX < -st.rr[j] - 0.5) ridge(st, j, false);
    st.rae[j] = st.ra[j] * hs * sstep(13, 9, st.rd[j] - st.rnx[j] * st.camX);
  }
  // the camera rises and sinks a little on its own, and a hill that comes up to it lifts it half of its height
  st.camY = 1.07 + 0.14 * sin(0.0233 * t + p[13]) + 0.09 * sin(0.0571 * t + p[14]) + 0.5 * (ground(st, st.camX, 0.5) + ground(st, st.camX, 1));
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    step(st, 0);
  }
  if (dt > 0) step(st, dt);
}

// ---- the furrows -------------------------------------------------------------------
const cA = [0, 0, 0];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const ks = st.ks, t = st.t, p = st.ph;
  const eye = 0.03 * cl(ks[1], 0, 4);                 // eye separation, in the units of the camera's height
  const S = spacing(ks[3]);
  const HW = 0.07, iS = 1 / S;                        // half width of a furrow, in spacings
  const uc = st.uc, seed = st.seed, wx = st.wx, wz = st.wz;
  const SHF = 0.7 - 0.28 * cl(ks[3], 0, 1);           // how bright a furrow stays in shadow: fine furrows shade deeper
  const camX = st.camX, camY = st.camY;
  const cy = cos(st.yaw), sy = sin(st.yaw), acy = abs(cy);
  const { hx, ha, rnx, rnz, rk, rp, rae, as, ak, ad, rzd, il, ir } = st;

  // which hills each depth step can touch, and their share of the distance
  let na = 0;
  for (let i = 0; i < NZ; i++) {
    as[i] = na;
    const z = ZS[i];
    for (let k = 0; k < NHILL; k++) {
      if (ha[k] < 1e-4) continue;
      const dz = (z - st.hz[k]) / st.rz[k];
      if (dz * dz < 1) { ak[na] = k; ad[na] = dz * dz; na++; }
    }
    for (let j = 0; j < NR; j++) rzd[i * NR + j] = rnz[j] * z - st.rd[j];
  }
  as[NZ] = na;
  const irx = st._irx || (st._irx = new Float64Array(NHILL));
  for (let k = 0; k < NHILL; k++) irx[k] = 1 / st.rx[k];
  const irr0 = 1 / st.rr[0], irr1 = 1 / st.rr[1];

  // the ring hangs low over the horizon, a little behind it in depth
  const pfar = eye * FL / ZC, pring = pfar + 18 * eye;
  const ringX = 32 + FL * (0.16 * sin(0.0211 * t + p[5]) + 0.07 * sin(0.0083 * t + p[6]) - st.yaw);
  const ringY = HZ - 5 + 5 * sin(0.0157 * t + p[7]) + 2.5 * sin(0.0391 * t + p[9]);
  const ringR = 15 + 2 * sin(0.0263 * t + p[8]);

  for (let e = 0; e < 2; e++) {
    const s = e ? 1 : -1, buf = e ? ir : il;
    const xe = s * eye / 2;                 // where this eye stands, beside the camera
    const shift = s * pfar / 2;             // the sideways shift that puts the zero-parallax plane at ZC
    for (let c = 0; c < W; c++) {
      const cx = (c + 0.5 - 32 - shift) / FL;
      const across = abs(cx * cy - sy);     // how fast a step down this column crosses the furrows
      let top = H - 1, yPrev = 0, yLow = 0, izPrev = 0, hPrev = 0, vLast = 0;
      for (let i = 0; i < NZ && top >= 0; i++) {
        const z = ZS[i], X = camX + xe + cx * z;
        let h = 0;
        for (let a = as[i], a1 = as[i + 1]; a < a1; a++) {
          const k = ak[a], dx = (X - hx[k]) * irx[k], r2 = ad[a] + dx * dx;
          if (r2 < 1) { const u = 1 - r2; h += ha[k] * u * u * u; }
        }
        for (let j = 0; j < NR; j++) {
          const q = (rnx[j] * X + rzd[i * NR + j]) * (j ? irr1 : irr0);
          if (q * q < 1) { const u = 1 - q * q; h += rae[j] * u * u * u * (0.68 + 0.32 * sin(rk[j] * (rnz[j] * X - rnx[j] * z) + rp[j])); }
        }
        h *= TAPER[i];
        const iz = 1 / z;
        const y = HZ + (camY - h) * FL * iz;
        if (i === 0) { yPrev = yLow = max(y, H) + 1; izPrev = iz; hPrev = h; }
        if (y < top + 0.5) {
          const rEnd = max(0, ceil(y - 0.5));
          const inv = 1 / (yPrev - y), diz = (izPrev - iz) * inv;
          // ground that rises away from the camera faces it and is brighter
          const sl = (h - hPrev) / (z - 1 / izPrev + 1e-9);
          const shade = 1 + 0.3 * sl / (1 + abs(sl));
          // this ground comes up from behind a crest: the crest's last LED is shared between the two
          const edge = yPrev > yLow + 1e-6;
          for (let r = top; r >= rEnd; r--) {
            const tt = (yPrev - r - 0.5) * inv;
            const zz = 1 / (izPrev + (iz - izPrev) * tt);
            const u = uc + ((xe + cx * zz) * cy - zz * sy) * iS;
            // the footprint of one LED across the furrows, in spacings
            const fu = (acy * zz / FL + across * zz * zz * diz) * iS;
            // farther off the furrows would crowd, so every other one fades out, and again each time the rest have closed up
            let P = 1, fade = 1, n;
            if (fu * PITCH > 1) {
              const L = Math.log2(fu * PITCH), lv = floor(L), w = (L - lv) * 4;
              P = 1 << (lv > 20 ? 20 : lv);
              n = Math.round(u / P);
              if (n & 1) fade = w >= 1 ? 0 : 1 - w * w * (3 - 2 * w);
              n *= P;
            } else n = Math.round(u);
            let v = 0;
            if (fade > 0) {
              // each furrow has its own place, width and brightness
              let q = Math.imul(n ^ seed, -1640531535); q ^= q >>> 15; q = Math.imul(q, -2048144777); q ^= q >>> 13;
              const hw0 = HW * (0.6 + (q & 1023) * 0.00137);
              const d = abs(u - n - ((q >>> 10 & 1023) - 511.5) * 0.000528);
              if (d < hw0 * 1.22 + fu * 1.5) {
                // cloud shadow thins the furrows it lies on and dims them a little, the way an engraver thins a line;
                // far off the patches are too small to draw and it evens out
                const lit = zz < 16 ? light(camX + xe + cx * zz, zz, wx, wz, seed) : 0.6;
                let hw = hw0 * (0.66 + 0.56 * lit);
                if (hw < fu) hw = fu;           // never thinner than 2 LEDs
                v = (hw + fu / 2 - d) / fu;
                v = v <= 0 ? 0 : (v > 1 ? 1 : v) * fade * (0.86 + (q >>> 20 & 1023) * 0.000137) * (SHF + (1 - SHF) * lit);
              }
            }
            // ground right under the camera fades out before it fills the view
            if (zz < 0.52) v *= zz <= 0.3 ? 0 : (zz - 0.3) / 0.22;
            // the air: far ground pales into the glow of the horizon
            const fg = zz * zz / (zz * zz + FOG * FOG);
            v = (v * (0.58 + 0.42 / (1 + zz / 4)) * (1 - fg) + GLOW * fg) * shade;
            if (edge && r === top) {
              const c1 = top + 2 - yLow, c0 = top + 1 - yLow;
              if (c1 < 1 && top + 1 < H) buf[(top + 1) * W + c] = vLast * c1 + v * (1 - c1);
              if (c0 > 0) v = v * (1 - c0) + vLast * c0;
            }
            buf[r * W + c] = vLast = v;
          }
          top = rEnd - 1;
        }
        if (y < yLow) yLow = y;
        yPrev = y; izPrev = iz; hPrev = h;
      }
      // the sky: a little haze on the horizon and the ring
      const dxr = c + 0.5 - s * pring / 2 - ringX;
      const c1 = top + 2 - yLow, c0 = top + 1 - yLow;
      for (let r = top + 1; r >= 0; r--) {
        if (r >= H) continue;
        const dyr = r + 0.5 - ringY;
        const d = abs(sqrt(dxr * dxr + dyr * dyr) - ringR);
        let v = r > HZ - 20 ? GLOW * Math.exp((r + 0.5 - HZ) / 4) : 0;
        if (d < 2.4) v += 0.8 * (d <= 1 ? 1 : 1 - (d - 1) / 1.4);
        if (r === top + 1) { if (c1 < 1) buf[r * W + c] = vLast * c1 + v * (1 - c1); continue; }
        if (r === top && c0 > 0) v = v * (1 - c0) + vLast * c0;
        buf[r * W + c] = v;
      }
    }
  }

  // the left eye's picture takes one colour and the right eye's its complement, so they add up to white
  hsv(ks[0], 1, 1, cA);
  const ar = cA[0], ag = cA[1], ab = cA[2];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x, l = il[o], r = ir[o];
      display.setPixel(x, y,
        cl((l * ar + r * (1 - ar)) * 255 + 0.5, 0, 255) | 0,
        cl((l * ag + r * (1 - ag)) * 255 + 0.5, 0, 255) | 0,
        cl((l * ab + r * (1 - ab)) * 255 + 0.5, 0, 255) | 0);
    }
  }
}
