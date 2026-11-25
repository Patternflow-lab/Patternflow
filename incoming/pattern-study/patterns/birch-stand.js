// ===== Patternflow pattern =====
// Title:   Birch Stand
// Family:  birch
// Idea:    A camera tracks sideways through a stand of birches in mist with only the middle of the trunks in frame: near trunks pass wide, crisp and quick with their dark branch scars and lenticels, far ones thin, pale and slow, and a low light behind the stand glows through the haze, sends out shafts and lights every trunk from the side it stands on.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the multiplane camera of cel animation (Ub Iwerks, 1933, and the Disney studio, 1937, both from memory) and aerial perspective as Leonardo's notebooks describe it (about 1500, from memory); the hashed stand with a depth of its own for every trunk, the bark marks, the sheets of mist standing between the depths, the shafts and the three haze waves whose periods share no beat are original, pattern round 253
// Round:   253
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Density=-1..1, Fog=0..1
//
// Knob 1: Hue. The colour of the haze: it opens on a blue-teal dusk, and round the wheel it passes violet, rose, red, a gold autumn and a green spring; the low light stays warm and the trunks stay white with a cool shadow side.
// Knob 2: Speed. 0.3 to 3, opening at 2. How fast the camera tracks, always the same way: the nearest trunks cross at about 2.5 LEDs a second at 0.3, 5 at 2 and 7 at 3, and the bark slides down faster as the camera cranes up.
// Knob 3: Density. -1 to 1, opening at 0. How many trunks stand in frame: about seven with open haze between them at -1, eleven at 0, a thicket of twenty at 1; a trunk fades out of the mist as the knob passes it.
// Knob 4: Fog. 0 to 1, opening at 0.06. At 0 the air is clear and every depth shows; turned up, sheets of mist close in between the depths and the haze pales, until at 1 only the nearest trunks stand in it.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, sin, abs, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// a trunk is drawn from its cell's number alone, so the stand is the same stand wherever the camera is
function hsh(a, b, s) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the stand ----------------------------------------------------------------------
// six slabs of depth; a trunk takes a depth of its own inside its slab, so no two pass at one speed
const NSL = 6, ZR = 1.36;
const ZL = [1, 1.36, 1.85, 2.52, 3.42, 4.65];
const CELL = [44, 48, 52, 56, 60, 66];       // world width of one cell of each slab
const WZ = 0.2, WCELL = 200;                // the very near trunks that wipe the panel
const GZ = 300, GCELL = 31000;               // the light behind the stand, so far back that it takes most of an hour to cross
const MAXT = 96;

export function setup(params) {
  const tr = [];
  for (let i = 0; i < MAXT; i++) tr.push({ z: -1, sx: 0, w: 0, lean: 0, bow: 0, tap: 0, tone: 1, seed: 0, a: 0, soft: 0, side: 0 });
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 0, seed: floor(Math.random() * 1e9) | 0,
    cam: 0, up: 1000 * Math.random(),
    p1: TP * Math.random(), p2: TP * Math.random(),
    tr, n: 0, warm: 0,
    gl: new Float64Array(5 * 4), ng: 0,
    bg: new Float32Array(W * H * 3), fb: new Float32Array(W * H * 3),
  });
  // start where a light stands a little ahead of the middle of the panel
  const k0 = 20 + floor(900 * Math.random());
  st.cam = GCELL * (k0 + 0.25 + 0.5 * hsh(k0, 3, st.seed ^ 0x31)) - GZ * (4 + 12 * Math.random());
  return st;
}

function step(st, dt) {
  const k = st.k, ks = st.ks;
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  st.t += dt;
  const sp = cl(ks[1], 0.3, 3);
  // the camera only ever goes one way; its pace wanders by a fifth
  const v = (2.2 + 2.0 * sp) * (1 + 0.13 * sin(0.113 * st.t + st.p1) + 0.08 * sin(0.0471 * st.t + st.p2));
  st.cam += v * dt;
  st.up += (0.7 + 0.5 * sp) * dt;
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  }
  if (dt > 0) step(st, dt);
}

// which trunks are in frame, far ones first
function collect(st) {
  const tr = st.tr, s = st.seed, cam = st.cam;
  const d = cl(st.ks[2], -1, 1);
  let n = 0;
  for (let i = 0; i < NSL; i++) {
    const zl = ZL[i], C = CELL[i];
    // an open stand is open near the camera; the distance keeps more of its line of trunks
    const lo = 0.25 + 0.03 * i, md = 0.44 + 0.03 * i;
    const p = d < 0 ? mix(lo, md, d + 1) : mix(md, 0.98, d);
    const reach = 50 * zl * ZR;
    const k0 = floor((cam - reach) / C), k1 = floor((cam + reach) / C);
    for (let k = k0; k <= k1 && n < MAXT - 2; k++) {
      // of every three cells one is filled first, one second and one last, so an open stand has no long gaps
      const g = floor(k / 3), r = k - g * 3;
      const thr = (((r + floor(hsh(g, i, s ^ 0x11) * 3)) % 3) + hsh(k, i, s ^ 0x12)) / 3;
      const a = cl((p - thr) / 0.05, 0, 1);
      if (a <= 0) continue;
      const z = zl * pow(ZR, hsh(k, i, s ^ 0x13));
      const X = (k + 0.18 + 0.64 * hsh(k, i, s ^ 0x14)) * C;
      const w = max(1.9, (9 + 5 * hsh(k, i, s ^ 0x15)) / z);
      const sx = 32 + (X - cam) / z;
      if (sx < -w - 14 || sx > 64 + w + 14) continue;
      const lean = 0.13 * (hsh(k, i, s ^ 0x16) - 0.5) / sqrt(z);
      const twin = hsh(k, i, s ^ 0x17) < 0.12;
      let o = tr[n++];
      o.z = z; o.w = w; o.a = a; o.soft = 0;
      o.bow = 5 * (hsh(k, i, s ^ 0x18) - 0.5) / z;
      o.tap = 0.1 + 0.16 * hsh(k, i, s ^ 0x19);
      o.tone = 0.86 + 0.14 * hsh(k, i, s ^ 0x1a);
      o.seed = (hsh(k, i, s ^ 0x1b) * 1e9) | 0;
      if (!twin) { o.sx = sx; o.lean = lean; continue; }
      // twin stems from one root, leaning apart
      const l1 = 0.03 + 0.025 * hsh(k, i, s ^ 0x1c), l2 = 0.03 + 0.025 * hsh(k, i, s ^ 0x1d);
      o.sx = sx - 0.42 * w - 80 * l1; o.lean = l1;
      const o2 = tr[n++];
      o2.z = z * 1.02; o2.w = w * (0.72 + 0.2 * hsh(k, i, s ^ 0x1e)); o2.a = a; o2.soft = 0;
      o2.sx = sx + 0.42 * w + 80 * l2; o2.lean = -l2;
      o2.bow = -o.bow * 0.6; o2.tap = o.tap; o2.tone = o.tone * 0.97; o2.seed = o.seed ^ 0x5bd1;
    }
  }
  // the wipes
  {
    const reach = 90 * WZ * 1.3;
    const k0 = floor((cam - reach) / WCELL), k1 = floor((cam + reach) / WCELL);
    for (let k = k0; k <= k1 && n < MAXT; k++) {
      const z = WZ * (1 + 0.25 * hsh(k, 9, s ^ 0x21));
      const X = (k + 0.3 + 0.4 * hsh(k, 9, s ^ 0x22)) * WCELL;
      const w = 20 + 11 * hsh(k, 9, s ^ 0x23);
      const sx = 32 + (X - cam) / z;
      if (sx < -w - 22 || sx > 64 + w + 22) continue;
      const o = tr[n++];
      o.z = z; o.w = w; o.a = 0.5 + 0.2 * hsh(k, 9, s ^ 0x27); o.soft = 1; o.sx = sx;
      o.lean = 0.2 * (hsh(k, 9, s ^ 0x24) - 0.5); o.bow = 6 * (hsh(k, 9, s ^ 0x25) - 0.5);
      o.tap = 0.08; o.tone = 1; o.seed = (hsh(k, 9, s ^ 0x26) * 1e9) | 0;
    }
  }
  for (let i = n; i < MAXT; i++) tr[i].z = -1;
  tr.sort((p, q) => q.z - p.z);
  st.n = n;
}

// the lights behind the stand: broad glows a long way back, so they hardly move
function lights(st) {
  const gl = st.gl, s = st.seed;
  const c = st.cam / GZ, C = GCELL / GZ;
  const k0 = floor((c - 110) / C), k1 = floor((c + 110) / C);
  let n = 0;
  for (let k = k0; k <= k1 && n < 4; k++) {
    gl[n * 5] = 32 + (k + 0.25 + 0.5 * hsh(k, 3, s ^ 0x31)) * C - c;
    gl[n * 5 + 1] = 34 + 62 * hsh(k, 3, s ^ 0x32);
    gl[n * 5 + 2] = 15 + 7 * hsh(k, 3, s ^ 0x33);
    gl[n * 5 + 3] = 0.72 + 0.28 * hsh(k, 3, s ^ 0x34);
    gl[n * 5 + 4] = k;
    n++;
  }
  st.ng = n;
}

// smooth value noise, for the banks of mist
function vn(x, y, s) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hsh(xi, yi, s), b = hsh(xi + 1, yi, s), c = hsh(xi, yi + 1, s), d = hsh(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c + (d - c) * fx - a - (b - a) * fx) * fy;
}

const tmp = [0, 0, 0], gcol = [0, 0, 0], dcol = [0, 0, 0];
const GW = 17, GH = 33;
const coarse = new Float32Array(GW * GH);
const gx = new Float32Array(W * 4), gy = new Float32Array(H * 4);

// a ring of smooth noise that also runs on in time: round the ring it closes on itself after n cells
function rn(a, tt, n, s) {
  const i = floor(a), j = floor(tt), i1 = (i + 1) % n;
  let fx = a - i, fy = tt - j;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const p = hsh(i, j, s), q = hsh(i1, j, s), u = hsh(i, j + 1, s), v = hsh(i1, j + 1, s);
  return p + (q - p) * fx + (u + (v - u) * fx - p - (q - p) * fx) * fy;
}
const wx = new Float32Array(W), wc = new Float32Array(W), ws = new Float32Array(W), WA = 0.2;
const RN = 256, RB = 4, RS = (RN + 1) * RB, rays = new Float32Array(RS * 4);

function backdrop(st) {
  const bg = st.bg, s = st.seed;
  const F = cl(st.ks[3], 0, 1);
  const hue = st.ks[0] + 0.535;
  const ng = st.ng, gl = st.gl;
  const wide = 1 + 0.5 * F;
  for (let g = 0; g < ng; g++) {
    // the glow, as a column profile and a row profile
    const cx = gl[g * 5], cy = gl[g * 5 + 1], sg = gl[g * 5 + 2] * wide, am = gl[g * 5 + 3];
    const qx = -0.5 / (sg * sg), qy = -0.5 / (sg * sg * 2.6);
    for (let x = 0; x < W; x++) gx[g * W + x] = am * exp(qx * (x - cx) * (x - cx));
    for (let y = 0; y < H; y++) gy[g * H + y] = exp(qy * (y - cy) * (y - cy));
    // its light comes through the stand in shafts: each direction out of it brightens and dims on its own
    // as the trunks far behind pass across it, and no shaft turns. A shaft is cut along its length too: three rings of it
    for (let j = 0; j < RB; j++) {
      const sd = s ^ Math.imul((gl[g * 5 + 4] | 0) * RB + j, 40503), c1 = st.cam / 27 + 7.7 * j, c2 = st.cam / 16 + 31.7 * j, o = g * RS + j * (RN + 1);
      for (let k = 0; k < RN; k++) rays[o + k] = sstep(0.27, 0.73, 0.6 * rn(k * 11 / RN, c1, 11, sd ^ 0x41) + 0.4 * rn(k * 23 / RN, c2, 23, sd ^ 0x42));
      rays[o + RN] = rays[o];
    }
  }
  hsv(0.05 + 0.03 * sin(TP * (st.ks[0] + 0.1)), mix(0.62, 0.45, F), 1, gcol);
  const warm = pow(0.5 + 0.5 * Math.cos(TP * (hue - 0.1)), 3);       // a dim gold is brown on the panel: a warm haze is a brighter one
  const blue = pow(0.5 + 0.5 * Math.cos(TP * (hue - 0.68)), 4);
  st.warm = warm;
  const V0 = mix(0.38, 0.46, F) * (1 + (0.5 * warm + 0.25 * blue) * (1 - 0.7 * F));
  const S0 = mix(0.84, 0.48, F) * (1 - 0.3 * warm);
  const gA = mix(0.95, 0.62, F), shaft = 0.1, floor0 = 0.56 + 0.3 * warm, wa = WA * (1 - 0.55 * warm);
  // and banks of mist drift behind the stand, two fields of noise on two winds
  const t = st.t, ax = st.cam / 7 + 1.0 * t, ay = -st.up / 7 - 0.3 * t, bx = st.cam / 7 + 1.7 * t, by = -st.up / 7 - 0.62 * t;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) coarse[j * GW + i] = 0.6 * vn((i * 4 + ax) / 44, (j * 4 + ay) / 20, s ^ 0x43) + 0.4 * vn((i * 4 + bx) / 24, (j * 4 + by) / 12, s ^ 0x44);
  // the haze itself swells and thins in three slow waves as wide as the panel, one going down it, one across and one aslant;
  // their periods, 73, 97 and 127 s, share no beat, so the three never stand as they stood before
  const p1 = TP * t / 73 + st.p1, p2 = TP * t / 97 + st.p2, p3 = TP * t / 127 + st.p1 + st.p2;
  for (let x = 0; x < W; x++) { const a = TP * x / W; wx[x] = sin(a + p2); wc[x] = Math.cos(a + p3); ws[x] = sin(a + p3); }
  for (let y = 0; y < H; y++) {
    const q = y / (H - 1), yb = TP * y / H, w1 = sin(yb - p1), yc = Math.cos(yb), ys = sin(yb);
    hsv(hue + 0.03 * (1 - q) - 0.02 * q, S0 * (1.06 - 0.24 * q), min(1, V0 * (0.93 + 0.08 * q)), tmp);
    hsv(hue - 0.07, min(1, S0 * 1.15), min(1, V0 * 1.05), dcol);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let g = 0, mq = 0;
      for (let n = 0; n < ng; n++) {
        g += gx[n * W + x] * gy[n * H + y];
        const dx = x - gl[n * 5], dy = y - gl[n * 5 + 1], rr = sqrt(dx * dx + dy * dy);
        const a = (Math.atan2(dy, dx) / TP + 0.5) * RN, k = min(RN - 1, floor(a)), fa = a - k;
        const bp = min(RB - 1, rr / 34), b0 = floor(bp), o = n * RS + b0 * (RN + 1) + k, o1 = b0 < RB - 1 ? o + RN + 1 : o;
        const v0 = rays[o] + (rays[o + 1] - rays[o]) * fa, v1 = rays[o1] + (rays[o1 + 1] - rays[o1]) * fa;
        mq += (v0 + (v1 - v0) * sstep(0.2, 0.8, bp - b0)) * sstep(3, 22, rr) * exp(-rr / 160) * gl[n * 5 + 3];
      }
      const j = y >> 2, fy = (y & 3) / 4, i = x >> 2, fx = (x & 3) / 4, o = j * GW + i;
      const m0 = coarse[o] + (coarse[o + 1] - coarse[o]) * fx, m1 = coarse[o + GW] + (coarse[o + GW + 1] - coarse[o + GW]) * fx;
      g = min(1, g) * gA; mq = min(1, mq * 0.55 + 0.55 * sstep(0.26, 0.76, m0 + (m1 - m0) * fy));
      // the rim of a glow is rose and its heart is the warm white: a warm light thinned out over a cool haze goes khaki
      const wh = shaft * mq * (1 - 0.6 * g);
      const l0 = (floor0 + (1.24 - floor0) * mq) * (1 + wa * (w1 + wx[x] + ws[x] * yc + wc[x] * ys));
      // where a warm haze is thin it turns toward red, since a dim gold is khaki on the panel
      const dp = warm * cl(1.15 - l0, 0, 1), lv = l0 * (1 - 0.6 * g), g2 = g * sqrt(g), g1 = g - g2;
      bg[p * 3] = (tmp[0] + (dcol[0] - tmp[0]) * dp) * lv + 0.95 * wh + gcol[0] * g2 + 0.85 * g1;
      bg[p * 3 + 1] = (tmp[1] + (dcol[1] - tmp[1]) * dp) * lv + 0.95 * wh + gcol[1] * g2 + 0.4 * g1;
      bg[p * 3 + 2] = (tmp[2] + (dcol[2] - tmp[2]) * dp) * lv + 0.9 * wh + gcol[2] * g2 + 0.42 * g1;
    }
  }
}

// ---- a trunk ------------------------------------------------------------------------
const d0 = new Float32Array(H), d1 = new Float32Array(H), dd = new Float32Array(H);
const HC = 3.6, TH = 1.15;      // lenticels: the pitch of their rows and how thick a dash is, in world units
const HB = 20;                  // one branch scar in about 28 units of trunk

// a trunk right at the lens: so far out of focus that it is a soft shade the stand shows through
function veil(st, o) {
  const fb = st.fb, wm = st.warm;
  // over a warm haze the shade is thinner and plum, not slate: gold under slate is brown
  const va = o.a * (1 - 0.5 * wm), vr = mix(0.19, 0.42, wm), vg = mix(0.23, 0.2, wm), vb = mix(0.33, 0.28, wm);
  for (let y = 0; y < H; y++) {
    const yy = y - 64, e = yy / 64;
    const xc = o.sx + o.lean * yy + o.bow * e * e, hw = 0.5 * o.w;
    const x0 = max(0, Math.ceil(xc - hw - 8)), x1 = min(W - 1, floor(xc + hw + 8));
    for (let x = x0; x <= x1; x++) {
      const dx = x - xc, c = va * sstep(-8, 8, hw - abs(dx)), f = (y * W + x) * 3;
      const q = 0.85 + 0.3 * dx / hw * o.side;
      fb[f] += (vr * q - fb[f]) * c; fb[f + 1] += (vg * q - fb[f + 1]) * c; fb[f + 2] += (vb * q - fb[f + 2]) * c;
    }
  }
}

function trunk(st, o, fogK) {
  const fb = st.fb, bg = st.bg;
  const z = o.z, w = o.w, sd = o.seed;
  const side = o.side, rimK = 1 - abs(side);
  const fine = sstep(5.5, 7.5, w);       // dashes only where the trunk has room for them
  const bands = sstep(2.6, 4, w);
  const round = 1 / (1 + 0.45 * (z - 1));        // far off, the round of a trunk flattens out
  const yw0 = -st.up;
  if (fine > 0) {
    // lenticels: one dash to a row at most, kept as its two ends across the trunk and how dark it is
    for (let y = 0; y < H; y++) {
      const Y = (y - 64) * z + yw0;
      let best = 0, b0 = 0, b1 = 0;
      const m0 = floor((Y - 0.5 * z) / HC), m1 = floor((Y + 0.5 * z) / HC);
      for (let m = m0; m <= m1; m++) {
        if (hsh(m, sd, 0x51) > 0.36) continue;
        const top = m * HC + hsh(m, sd, 0x52) * (HC - TH);
        const cov = (min(Y + 0.5 * z, top + TH) - max(Y - 0.5 * z, top)) / z;
        if (cov <= best) continue;
        const c = 1.5 * (hsh(m, sd, 0x53) - 0.5), hl = 0.14 + 0.3 * hsh(m, sd, 0x54);
        best = cov * (0.5 + 0.4 * hsh(m, sd, 0x55)); b0 = c - hl; b1 = c + hl;
      }
      dd[y] = best * fine; d0[y] = b0; d1[y] = b1;
    }
  }
  for (let y = 0; y < H; y++) {
    const yy = y - 64, e = yy / 64;
    const xc = o.sx + o.lean * yy + o.bow * e * e;
    const hw = 0.5 * w * (1 + o.tap * yy / 128);
    const x0 = max(0, Math.ceil(xc - hw - 0.5)), x1 = min(W - 1, floor(xc + hw + 0.5));
    if (x0 > x1) continue;
    const Y = yy * z + yw0;
    // a branch scar: a dark lens lying across the trunk, thick in the middle, and some of them wrap out of sight round an edge
    let bt = 0, bc = 0, bu = 0, bq = 1, bk = 0;
    if (bands > 0) {
      const m = floor(Y / HB);
      if (hsh(m, sd, 0x71) < 0.72) {
        const hT = hsh(m, sd, 0x72), T = 0.8 + 2.4 * hT * hT;
        bc = (m + 0.5) * HB + (hsh(m, sd, 0x73) - 0.5) * (HB - 2 * T - 5);
        if (abs(Y - bc) < T + z) {
          bt = T; bu = 2.1 * (hsh(m, sd, 0x74) - 0.5); bq = 0.35 + 0.95 * hsh(m, sd, 0x75);
          bk = bands * (0.75 + 0.25 * hsh(m, sd, 0x76));
        }
      }
    }
    const dk = fine > 0 ? dd[y] : 0, a0 = d0[y], a1 = d1[y];
    for (let x = x0; x <= x1; x++) {
      const dx = x - xc;
      const u = cl(dx / hw, -1, 1);
      const cov = o.a * cl(hw + 0.5 - abs(dx), 0, 1);
      // the round of the trunk: lit from the side the light is on, a cool shadow on the other
      const nz = sqrt(1 - u * u);
      const b = 0.62 + (cl(0.18 + 0.9 * side * u + 0.42 * nz + 0.55 * rimK * u * u * u * u, 0, 1) - 0.62) * round;
      let r, g, bl;
      if (b < 0.55) { const q = b / 0.55; r = mix(0.38, 0.9, q); g = mix(0.44, 0.92, q); bl = mix(0.58, 0.93, q); }
      else { const q = (b - 0.55) / 0.45; r = mix(0.9, 1, q); g = mix(0.92, 0.97, q); bl = mix(0.93, 0.84, q); }
      r *= o.tone; g *= o.tone; bl *= o.tone;
      let ink = 0;
      if (dk > 0) ink = dk * cl((min(u, a1) - max(u, a0)) * hw + 0.5, 0, 1);
      if (bt > 0) {
        const tq = abs(u - bu) / bq;
        if (tq < 1) ink = max(ink, bk * cl(0.5 + (bt * (1 - tq * tq) - abs(Y - bc)) / z, 0, 1));
      }
      if (ink > 0) { const q = 1 - 0.93 * ink; r *= q; g *= q; bl *= q; }
      // the air between: more of it the farther the trunk. It pales toward the haze, and stays a little
      // whiter than the haze so that it stays a trunk
      const f = (y * W + x) * 3;
      const fg = 1 - exp(-fogK * (z - 0.95));
      const hr = bg[f], hg = bg[f + 1], hb = bg[f + 2];
      const wq = 1 - 0.42 * (1 - fg), wy = 0.5 * (0.3 * hr + 0.59 * hg + 0.11 * hb) * (1 - fg);
      r += (hr * wq + wy - r) * fg; g += (hg * wq + wy - g) * fg; bl += (hb * wq + wy - bl) * fg;
      fb[f] += (r - fb[f]) * cov; fb[f + 1] += (g - fb[f + 1]) * cov; fb[f + 2] += (bl - fb[f + 2]) * cov;
    }
  }
}

// a sheet of mist standing at one depth in the stand: banks with gaps between, drifting on a wind of its own
function sheet(st, zs, sd, wind, sink, amp, lift) {
  const fb = st.fb, bg = st.bg, t = st.t, kp = 0.6 + 0.3 * st.warm;      // over a warm haze the mist keeps more of its colour: greyed gold is khaki
  const ox = st.cam / zs + wind * t, oy = -st.up / zs + sink * t;
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const x = i * 4 + ox, y = j * 4 + oy;
      coarse[j * GW + i] = 0.66 * vn(x / 44, y / 15, sd) + 0.34 * vn(x / 19, y / 8, sd ^ 0x9e3);
    }
  }
  for (let y = 0; y < H; y++) {
    const j = y >> 2, fy = (y & 3) / 4;
    for (let x = 0; x < W; x++) {
      const i = x >> 2, fx = (x & 3) / 4, o = j * GW + i;
      const m0 = coarse[o] + (coarse[o + 1] - coarse[o]) * fx, m1 = coarse[o + GW] + (coarse[o + GW + 1] - coarse[o + GW]) * fx;
      const a = amp * sstep(0.36, 0.7, m0 + (m1 - m0) * fy);
      if (a <= 0) continue;
      const f = (y * W + x) * 3;
      fb[f] += (bg[f] * kp + 0.9 * lift - fb[f]) * a; fb[f + 1] += (bg[f + 1] * kp + 0.95 * lift - fb[f + 1]) * a; fb[f + 2] += (bg[f + 2] * kp + lift - fb[f + 2]) * a;
    }
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  collect(st);
  lights(st);
  backdrop(st);
  const fb = st.fb;
  fb.set(st.bg);
  const F = cl(st.ks[3], 0, 1);
  const fogK = mix(0.13, 1.25, pow(F, 1.2));
  const F2 = pow(F, 1.3), mAmp = mix(0.14, 0.8, F2), mFar = mix(0.38, 0.9, F2), lift = mix(0.14, 0.2, F2);
  let done = 0;
  for (let i = 0; i < st.n; i++) {
    const o = st.tr[i];
    // the two sheets of mist go in at their own depths
    if (done < 1 && o.z < 3.42) { sheet(st, 3.42, st.seed ^ 0x61, 0.35, 0.3, mFar, lift); done = 1; }
    if (done < 2 && o.z < 1.85) { sheet(st, 1.85, st.seed ^ 0x62, 0.6, 0.45, mAmp * 0.85, lift); done = 2; }
    // which side the light is on, from where the glows stand
    let lx = 0;
    for (let g = 0; g < st.ng; g++) {
      const dx = st.gl[g * 5] - o.sx;
      lx += st.gl[g * 5 + 3] * dx / sqrt(dx * dx + 180) * exp(-abs(dx) / 90);
    }
    o.side = cl(1.5 * lx, -1, 1);
    if (o.soft) veil(st, o); else trunk(st, o, fogK);
  }
  if (done < 1) sheet(st, 3.42, st.seed ^ 0x61, 0.35, 0.3, mFar, lift);
  if (done < 2) sheet(st, 1.85, st.seed ^ 0x62, 0.6, 0.45, mAmp * 0.85, lift);
  for (let p = 0, f = 0; p < W * H; p++, f += 3) {
    let r = fb[f], g = fb[f + 1], b = fb[f + 2];
    display.setPixel(p % W, (p / W) | 0, (min(1, r) * 255 + 0.5) | 0, (min(1, g) * 255 + 0.5) | 0, (min(1, b) * 255 + 0.5) | 0);
  }
}
