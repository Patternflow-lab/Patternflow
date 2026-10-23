// ===== Patternflow pattern =====
// Title:   Drying Mud
// Family:  cells
// Idea:    Wet clay dries in the sun and splits into polygons, each new crack leaving an old one at a right angle and running until it meets another, the chips paling and curling at their rims, until a shower darkens the clay and closes the cracks.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Jared Tarbell's Substrate (2003), and desiccation cracks in a drying puddle
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Clay=0..1, Sun=0.3..3, Cracks=0..1, Curl=0..1
//
// Knob 1: Clay. What the mud is made of, starting from yellow ochre loess, then red laterite, grey river silt and at the top pale playa clay.
// Knob 2: Sun. How hot the sun is: at 2 the first crack opens within half a second and the shower comes after 24 seconds; turned down the clay stays dark and wet for minutes, turned up it bakes paler and the cracks open wider.
// Knob 3: Cracks. How finely the mud splits: at 0 a thick layer breaks into slabs about sixteen LEDs across with wide deep cracks, at 1 a thin film dries twice as fast and crazes into chips about six across.
// Knob 4: Curl. How far the chips lift at their rims as they dry: low, they lie nearly flat; high, each chip is a dish, lit along the rim away from the sun and dark along the rim toward it, in the shadow of the next chip's lip.
// Buttons: K1 tap brings a shower now: drops spot the clay dark, the cracks fill with water and close, and the mud starts drying again.

const W = 64;
const H = 128;
const N = W * H;
// How far round a crack point its distance is written: as far as a lip,
// its shadow and the faster drying reach.
const REACH = 6;
const NONE = 1e9;
const MAXC = 520;
const MAXP = 4096;
const MAXD = 96;
// A tip moves half an LED at a time, so it enters every LED it crosses.
const STEP = 0.5;
// Toward the sun, in panel terms (x right, y down): the sun stands up and to the left.
const SX = -0.6;
const SY = -0.8;
// Dry seconds (the clock that Sun runs) before the first crack, and before the shower.
const ONSET = 0.4;
const RAIN_AT = 24;
// A shower in real seconds: drops for 4.4 s, the cracks shut between 1.0 and 3.4,
// and the old network is wiped at 3.6 when nothing of it shows.
const RAIN_LEN = 4.4;
// The light under the shower's cloud, against full sun.
const DIM = 0.86;
const WIPE = 3.6;
// Widest opening per generation, in LEDs: the first cracks open widest.
const WMAX = [3.4, 2.5, 1.8, 1.4, 1.15, 1.0];
// Tip speed per generation in LEDs per dry second.
const SPEED = [48, 38, 30, 26, 24, 22];
// Dry and wet colours of four clays.
const CLAYS = [
  [230, 190, 134, 128, 82, 48],
  [228, 132, 86, 128, 56, 34],
  [204, 190, 166, 104, 92, 74],
  [244, 230, 202, 140, 118, 92],
];

// exp() tables: ages in steps of 1/16 dry second up to 64 s, distances from
// a crack's lip in steps of 1/32 LED up to REACH.
const AGE = new Float32Array(1025);
const DEEP = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) {
  AGE[i] = 1 - Math.exp(-i / 16 / 4);
  DEEP[i] = 1 - Math.exp(-i / 16 / 2.5);
}
const LIPN = REACH * 32 + 1;
const DRYLIP = new Float32Array(LIPN);
const DISH = new Float32Array(LIPN);
const EDGE = new Float32Array(LIPN);
for (let i = 0; i < LIPN; i++) {
  const l = i / 32;
  // Water leaves fastest at the lip, and the extra drying is gone before
  // REACH, so a chip's damp middle has no hard edge.
  const fade = 1 - smooth(REACH - 3, REACH - 0.5, l);
  DRYLIP[i] = Math.exp(-l / 2.6) * fade;
  DISH[i] = Math.exp(-l / 2.2) * fade;
  EDGE[i] = Math.exp(-l / 0.9);
}

// How far clay with this much water left has come toward its dry colour.
const DRYC = new Float32Array(257);
for (let i = 0; i <= 256; i++) DRYC[i] = Math.pow(1 - i / 256, 0.85);

function ageIndex(a) {
  const i = (a * 16) | 0;
  return i < 0 ? 0 : i > 1024 ? 1024 : i;
}

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise whose lattice wraps every period cells.
function tile(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const y0 = ((iy % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const s = seed * 7919;
  const a = hash(x0 + s, y0);
  const b = hash(x1 + s, y0);
  const c = hash(x0 + s, y1);
  const d = hash(x1 + s, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function wipe(P) {
  P.occ.fill(0);
  P.key.fill(NONE);
  P.cid.fill(-1);
  P.nc = 0;
  P.np = 0;
  P.nuclei = 0;
  P.spawnT = 0;
}

export function setup(params) {
  const P = params;
  // About 440 KB of fields per LED. On the ESP32-S3 they fit in 8 and 16
  // bits (the nearest point as an offset, times in 1/16 s), about 160 KB.
  P.occ = new Int16Array(N);
  P.key = new Float32Array(N);
  P.dist = new Float32Array(N);
  P.nx = new Float32Array(N);
  P.ny = new Float32Array(N);
  P.born = new Float32Array(N);
  P.cid = new Int16Array(N);
  P.m = new Float32Array(N);
  P.tone = new Float32Array(N);
  P.rate = new Float32Array(N);
  P.wid = new Float32Array(N);
  P.sky = new Float32Array(128 * 128);
  P.rgb = new Uint8ClampedArray(N * 3);
  // Cracks: tip, heading, generation, the crack it left (which it may cross
  // for 1.6 LEDs) and where it stops if it runs straight on.
  P.cx = new Float32Array(MAXC);
  P.cy = new Float32Array(MAXC);
  P.cdx = new Float32Array(MAXC);
  P.cdy = new Float32Array(MAXC);
  P.cgen = new Uint8Array(MAXC);
  P.alive = new Uint8Array(MAXC);
  P.par = new Int16Array(MAXC);
  P.grace = new Float32Array(MAXC);
  P.acc = new Float32Array(MAXC);
  P.ex = new Float32Array(MAXC);
  P.ey = new Float32Array(MAXC);
  // Every crack as points one LED apart, for finding the widest open clay.
  P.px = new Float32Array(MAXP);
  P.py = new Float32Array(MAXP);
  P.pid = new Int16Array(MAXP);
  // Raindrops: where and how long ago they landed.
  P.dx = new Float32Array(MAXD);
  P.dy = new Float32Array(MAXD);
  P.dage = new Float32Array(MAXD).fill(9);
  P.di = 0;
  // The clay's own texture: blotches of silt, grit, the odd dark speck of
  // straw and a pale sand grain, and patches that dry a little faster.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      let t = 1 + 0.12 * (tile(x / 9, y / 9, 99, 1) - 0.5) + 0.07 * (tile(x / 3.2, y / 3.2, 99, 2) - 0.5) + 0.07 * (hash(x, y + 977) - 0.5);
      const g = hash(x + 311, y);
      if (g < 0.012) t *= 0.85;
      else if (g > 0.988) t *= 1.12;
      P.tone[q] = t;
      P.rate[q] = 0.7 + 0.6 * tile(x / 11, y / 11, 99, 3);
    }
  // The sky the wet clay mirrors: soft clouds on a tile that wraps.
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const u = (x / 128) * 8;
      const v = (y / 128) * 8;
      // Three octaves on lattices that wrap with the tile. Thresholding it
      // twice gave the clouds straight edges.
      P.sky[y * 128 + x] = 0.55 * tile(u, v, 8, 4) + 0.3 * tile(u * 2, v * 2, 16, 5) + 0.15 * tile(u * 4, v * 4, 32, 8);
    }
  wipe(P);
  P.m.fill(1);
  Object.assign(P, { clock: 0, rain: -1, wiped: false, close: 1, fill: 0, light: 1, dropAcc: 0, skyX: 0, cloudX: 0, gather: 0 });
  Object.assign(P, { clay: 0, sun: 2, fine: 0, curl: 0.06 });
}

// A crack point at (x, y): every LED within REACH takes it as its crack,
// with the time it opened, unless another crack's eventual lip is nearer.
// Plain nearness let a young crack starting or ending on an old one take
// the old one's LEDs at the junction and bridge it.
function mark(P, x, y, c, point) {
  const half = WMAX[P.cgen[c]] / 2;
  const x0 = Math.max(0, Math.ceil(x - REACH));
  const x1 = Math.min(W - 1, Math.floor(x + REACH));
  const y0 = Math.max(0, Math.ceil(y - REACH));
  const y1 = Math.min(H - 1, Math.floor(y + REACH));
  const t = P.clock;
  for (let j = y0; j <= y1; j++) {
    const ddy = j - y;
    for (let i = x0; i <= x1; i++) {
      const ddx = i - x;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 > REACH * REACH) continue;
      const q = j * W + i;
      const d = Math.sqrt(d2);
      if (d - half < P.key[q]) {
        P.key[q] = d - half;
        P.dist[q] = d;
        P.nx[q] = x;
        P.ny[q] = y;
        P.born[q] = t;
        P.cid[q] = c;
      }
    }
  }
  if (point && P.np < MAXP) {
    P.px[P.np] = x;
    P.py[P.np] = y;
    P.pid[P.np] = c;
    P.np++;
  }
}

function blocked(P, c, i, j) {
  const o = P.occ[j * W + i];
  if (o === 0 || o - 1 === c) return false;
  return !(o - 1 === P.par[c] && P.grace[c] > 0);
}

function startCrack(P, x, y, hx, hy, gen, parent) {
  if (P.nc >= MAXC) return -1;
  const c = P.nc++;
  const l = Math.hypot(hx, hy) || 1;
  P.cx[c] = x;
  P.cy[c] = y;
  P.cdx[c] = hx / l;
  P.cdy[c] = hy / l;
  P.cgen[c] = Math.min(gen, WMAX.length - 1);
  P.alive[c] = 1;
  P.par[c] = parent;
  P.grace[c] = 1.6;
  P.acc[c] = 0;
  const i = Math.round(x);
  const j = Math.round(y);
  if (!P.occ[j * W + i]) P.occ[j * W + i] = c + 1;
  mark(P, x, y, c, true);
  return c;
}

// Walk a tip forward by len LEDs. It wobbles a little, bends to meet a crack
// it is about to hit square on, and stops at the first LED another crack owns.
function grow(P, c, len) {
  while (len > 0 && P.alive[c]) {
    const s = Math.min(STEP, len);
    len -= s;
    let hx = P.cdx[c];
    let hy = P.cdy[c];
    // Later, shorter cracks wander a little more than the first long ones.
    const wob = (Math.random() - 0.5) * (0.05 + 0.02 * P.cgen[c]);
    const cw = Math.cos(wob);
    const sw = Math.sin(wob);
    let tx = hx * cw - hy * sw;
    let ty = hx * sw + hy * cw;
    const x = P.cx[c];
    const y = P.cy[c];
    // Three LEDs ahead: if another crack is near there, turn toward its
    // nearest point, which is the way that meets it at a right angle.
    const ai = Math.round(x + tx * 3);
    const aj = Math.round(y + ty * 3);
    if (ai >= 0 && ai < W && aj >= 0 && aj < H) {
      const q = aj * W + ai;
      const o = P.cid[q];
      if (o >= 0 && o !== c && o !== P.par[c] && P.dist[q] < 2.6) {
        const vx = P.nx[q] - x;
        const vy = P.ny[q] - y;
        const vl = Math.hypot(vx, vy) || 1;
        tx += (vx / vl) * 0.16;
        ty += (vy / vl) * 0.16;
      }
    }
    const tl = Math.hypot(tx, ty);
    hx = tx / tl;
    hy = ty / tl;
    P.cdx[c] = hx;
    P.cdy[c] = hy;
    const fx = x + hx * s;
    const fy = y + hy * s;
    const pi = Math.round(x);
    const pj = Math.round(y);
    const ci = Math.round(fx);
    const cj = Math.round(fy);
    if (ci < 0 || ci >= W || cj < 0 || cj >= H) {
      P.alive[c] = 0;
      break;
    }
    if (ci !== pi || cj !== pj) {
      const diag = ci !== pi && cj !== pj;
      let hit = blocked(P, c, ci, cj);
      let hi = ci;
      let hj = cj;
      if (!hit && diag) {
        if (blocked(P, c, ci, pj)) {
          hit = true;
          hj = pj;
        } else if (blocked(P, c, pi, cj)) {
          hit = true;
          hi = pi;
        }
      }
      if (hit) {
        // Close the gap onto the crack it ran into: a T-junction.
        mark(P, (x + hi) / 2, (y + hj) / 2, c, false);
        mark(P, hi, hj, c, true);
        P.alive[c] = 0;
        break;
      }
      P.occ[cj * W + ci] = c + 1;
      if (diag) P.occ[pj * W + ci] = c + 1;
    }
    P.cx[c] = fx;
    P.cy[c] = fy;
    P.grace[c] -= s;
    // The distance field gets every half LED; the point list one per LED.
    P.acc[c] += s;
    const point = P.acc[c] >= 1;
    if (point) P.acc[c] -= 1;
    mark(P, fx, fy, c, point);
  }
}

function segDist2(x, y, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - ax - vx * t;
  const dy = y - ay - vy * t;
  return dx * dx + dy * dy;
}

// The mud cracks where the stress is, in the widest clay no crack has
// reached: of ten places tried, the one furthest from every crack, every
// tip's path ahead and the frame. The new crack leaves the nearest crack
// toward it, so at a right angle.
function spawn(P) {
  for (let c = 0; c < P.nc; c++) {
    if (!P.alive[c]) continue;
    let x = P.cx[c];
    let y = P.cy[c];
    for (let k = 0; k < 140; k++) {
      const i = Math.round(x + P.cdx[c]);
      const j = Math.round(y + P.cdy[c]);
      if (i < 0 || i >= W || j < 0 || j >= H || blocked(P, c, i, j)) break;
      x += P.cdx[c];
      y += P.cdy[c];
    }
    P.ex[c] = x;
    P.ey[c] = y;
  }
  let best = -1;
  let bx = 0;
  let by = 0;
  for (let s = 0; s < 10; s++) {
    const x = Math.random() * (W - 1);
    const y = Math.random() * (H - 1);
    // The frame counts as a crack two LEDs out: the mud goes on past the panel.
    const e = Math.min(x + 2.5, W + 1.5 - x, y + 2.5, H + 1.5 - y);
    let d2 = e * e;
    for (let p = 0; p < P.np; p++) {
      const ddx = P.px[p] - x;
      const ddy = P.py[p] - y;
      const v = ddx * ddx + ddy * ddy;
      if (v < d2) d2 = v;
    }
    for (let c = 0; c < P.nc; c++) {
      if (!P.alive[c]) continue;
      const v = segDist2(x, y, P.cx[c], P.cy[c], P.ex[c], P.ey[c]);
      if (v < d2) d2 = v;
    }
    if (d2 > best) {
      best = d2;
      bx = x;
      by = y;
    }
  }
  if (best < P.lmin * P.lmin) return;
  const gen0 = P.nuclei < P.wantNuclei;
  if (gen0) {
    // A crack that starts in open clay runs both ways from where it started.
    P.nuclei++;
    const a = Math.random() * Math.PI;
    const hx = Math.cos(a);
    const hy = Math.sin(a);
    const c1 = startCrack(P, bx, by, hx, hy, 0, -1);
    if (c1 < 0) return;
    const c2 = startCrack(P, bx, by, -hx, -hy, 0, c1);
    if (c2 >= 0) P.par[c1] = c2;
    return;
  }
  // The nearest crack point, or the frame if that is nearer.
  let src = -1;
  let sd = NONE;
  for (let p = 0; p < P.np; p++) {
    const ddx = P.px[p] - bx;
    const ddy = P.py[p] - by;
    const v = ddx * ddx + ddy * ddy;
    if (v < sd) {
      sd = v;
      src = p;
    }
  }
  const el = bx + 2.5;
  const er = W + 1.5 - bx;
  const et = by + 2.5;
  const e = Math.min(el, er, et, H + 1.5 - by);
  const jit = (Math.random() - 0.5) * 0.24;
  let sx, sy, hx, hy;
  let gen = 1;
  let parent = -1;
  if (src < 0 || e * e < sd) {
    // A crack that started beyond the frame comes in square to it.
    if (e === el) [sx, sy, hx, hy] = [0, by, 1, jit];
    else if (e === er) [sx, sy, hx, hy] = [W - 1, by, -1, jit];
    else if (e === et) [sx, sy, hx, hy] = [bx, 0, jit, 1];
    else [sx, sy, hx, hy] = [bx, H - 1, jit, -1];
    if (P.occ[Math.round(sy) * W + Math.round(sx)]) return;
  } else {
    sx = P.px[src];
    sy = P.py[src];
    parent = P.pid[src];
    gen = P.cgen[parent] + 1;
    const vx = bx - sx;
    const vy = by - sy;
    const cj = Math.cos(jit);
    const sj = Math.sin(jit);
    hx = vx * cj - vy * sj;
    hy = vx * sj + vy * cj;
  }
  startCrack(P, sx, sy, hx, hy, gen, parent);
}

function startRain(P) {
  if (P.rain >= 0) return;
  P.rain = 0;
  P.wiped = false;
}

// One pass over the clay. A crack opens as a hairline and widens toward its
// generation's width, so a tip is always thinner than the crack behind it.
// Clay along a crack dries fast, having a second face to the air; a thin
// film dries faster than a thick layer, and a curled rim dries from below too.
function soak(P, ddt) {
  const close = P.close;
  const wsc = (1 - 0.5 * P.fine) * (0.8 + 0.1 * P.sun) * close;
  const young = 0.45 * close;
  const clock = P.clock;
  const dries = P.rain < 0;
  const thin = ddt * (0.7 + 0.8 * P.fine);
  const edge = 0.2 + (1.1 + 0.6 * P.curl) * P.curl;
  const m = P.m;
  for (let q = 0; q < N; q++) {
    let rate = 0.15;
    if (P.key[q] < NONE) {
      const wmax = WMAX[P.cgen[P.cid[q]]] * wsc;
      const w = young + (wmax - young) * AGE[ageIndex(clock - P.born[q])];
      P.wid[q] = w;
      const lip = P.dist[q] - w / 2;
      rate += edge * (lip <= 0 ? 1 : DRYLIP[Math.min(LIPN - 1, (lip * 32) | 0)]);
    }
    if (dries) {
      const v = m[q] - thin * rate * P.rate[q];
      m[q] = v > 0 ? v : 0;
    }
  }
}

export function update(dt, input, params) {
  const P = params;
  dt = Math.min(dt, 0.1);
  const k = input.knobValues || [0, 2, 0, 0.06];
  P.clay = Math.max(0, Math.min(1, k[0]));
  P.sun = Math.max(0.3, Math.min(3, k[1]));
  P.fine = Math.max(0, Math.min(1, k[2]));
  P.curl = Math.max(0, Math.min(1, k[3]));
  // The widest clay left uncracked. It shrinks a little in the dry spell, so
  // the biggest chips still split now and then.
  P.lmin = (8 - 5 * P.fine) * (1 - 0.22 * smooth(9, 22, P.clock));
  P.wantNuclei = 3 + Math.round(2 * P.fine);
  if (input.btnPressed && input.btnPressed[0]) startRain(P);
  // The clock everything dries by: Sun 2 runs it at real time.
  const ddt = (dt * P.sun) / 2;
  // Clouds mirrored in wet clay drift at three LEDs a second.
  P.skyX += dt * 3;
  // Cloud shadows cross the flat on the wind at eight LEDs a second. They
  // gather over the last eight dry seconds before a shower and clear after it.
  P.cloudX += dt * 8;
  const gather = P.rain >= 0 ? 1 : smooth(RAIN_AT - 8, RAIN_AT, P.clock);
  P.gather += (gather - P.gather) * Math.min(1, dt * (P.rain >= 0 ? 4 : 0.5));

  const m = P.m;
  if (P.rain >= 0) {
    P.rain += dt;
    const r = P.rain;
    const env = smooth(0, 0.8, r) * (1 - smooth(3.0, RAIN_LEN, r));
    P.light = Math.max(DIM, P.light - dt * 0.2);
    P.fill = smooth(0.2, 1.4, r);
    P.close = 1 - smooth(1.0, 3.4, r);
    P.dropAcc += dt * 150 * env;
    while (P.dropAcc >= 1) {
      P.dropAcc -= 1;
      const x = Math.random() * W;
      const y = Math.random() * H;
      P.dx[P.di] = x;
      P.dy[P.di] = y;
      P.dage[P.di] = 0;
      P.di = (P.di + 1) % MAXD;
      // Each drop darkens a spot three LEDs across, the way the first drops
      // of a shower spot dry dirt.
      for (let j = Math.floor(y - 1.5); j <= y + 1.5; j++)
        for (let i = Math.floor(x - 1.5); i <= x + 1.5; i++)
          if (i >= 0 && i < W && j >= 0 && j < H && (i - x) * (i - x) + (j - y) * (j - y) < 2.3) m[j * W + i] = 1;
    }
    for (let q = 0; q < N; q++) m[q] = Math.min(1, m[q] + dt * 0.3 * env);
    if (r >= WIPE && !P.wiped) {
      P.wiped = true;
      wipe(P);
    }
    if (r >= RAIN_LEN) {
      P.rain = -1;
      // The water soaks away before the clay starts to crack again.
      P.clock = -2.5;
      P.close = 1;
      P.fill = 0;
    }
  } else {
    P.light = Math.min(1, P.light + dt * 0.3);
    P.clock += ddt;
    // A thin film cracks sooner than a thick layer.
    if (P.clock > ONSET - 0.4 * P.fine) {
      for (let c = 0; c < P.nc; c++) if (P.alive[c]) grow(P, c, SPEED[P.cgen[c]] * ddt);
      let active = 0;
      for (let c = 0; c < P.nc; c++) active += P.alive[c];
      P.spawnT += ddt;
      const most = 5 + Math.round(5 * P.fine);
      while (P.spawnT > 0.1) {
        P.spawnT -= 0.1;
        if (active < most || P.nuclei < P.wantNuclei) {
          const before = P.nc;
          spawn(P);
          active += P.nc - before;
        }
      }
    }
    if (P.clock > RAIN_AT) startRain(P);
  }
  soak(P, ddt);
  for (let i = 0; i < MAXD; i++) P.dage[i] += dt;
}

export function draw(display, params) {
  const P = params;
  const f = P.clay * (CLAYS.length - 1);
  const ci = Math.min(CLAYS.length - 2, Math.floor(f));
  const u = f - ci;
  const A = CLAYS[ci];
  const B = CLAYS[ci + 1];
  const [dr, dg, db, wr, wg, wb] = A.map((v, i) => v + (B[i] - v) * u);
  // A hot sun bleaches the dry clay a little; an overcast one leaves it dull.
  const light = P.light * (0.86 + 0.07 * P.sun);
  // Curl needs sun: under the shower's cloud the chips lie in flat light.
  const curl = (0.42 + 0.58 * P.curl) * ((P.light - DIM) / (1 - DIM)) * (0.7 + 0.15 * P.sun);
  const fill = P.fill;
  const clock = P.clock;
  const sky = P.sky;
  const sxo = Math.floor(P.skyX);
  const cxo = P.cloudX * 0.24;
  const cth = 0.56 - 0.38 * P.gather;
  // A cloud's shadow takes as much light as the shower's overcast, and
  // melts into it when the shower comes.
  const deep = (1 - DIM) * ((P.light - DIM) / (1 - DIM));
  const rgb = P.rgb;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      const wet = P.m[q];
      const dry = DRYC[(wet * 256) | 0];
      // The cloud shadow: the sky tile at four times the size, sampled
      // smoothly so its edge slides rather than steps.
      const cu = (x * 0.22 - y * 0.09 + 64 + cxo) % 128;
      const cv = x * 0.09 + y * 0.22 + 37;
      const c0 = Math.floor(cu);
      const v0 = Math.floor(cv);
      const fu = cu - c0;
      const fv = cv - v0;
      const r0 = (v0 & 127) * 128;
      const r1 = ((v0 + 1) & 127) * 128;
      const a0 = sky[r0 + c0] + (sky[r0 + ((c0 + 1) & 127)] - sky[r0 + c0]) * fu;
      const a1 = sky[r1 + c0] + (sky[r1 + ((c0 + 1) & 127)] - sky[r1 + c0]) * fu;
      let shadow = (a0 + (a1 - a0) * fv - cth) * 6;
      shadow = shadow < 0 ? 0 : shadow > 1 ? 1 : shadow * shadow * (3 - 2 * shadow);
      const t = P.tone[q] * light * (1 - deep * shadow);
      const sun = 1 - 0.75 * shadow;
      let r = (wr + (dr - wr) * dry) * t;
      let g = (wg + (dg - wg) * dry) * t;
      let b = (wb + (db - wb) * dry) * t;
      // Wet clay mirrors the sky faintly.
      let sk = (sky[(y & 127) * 128 + ((x + sxo) & 127)] - 0.38) * 2.9;
      sk = sk < 0 ? 0 : sk > 1 ? 1 : sk;
      let sh = wet > 0.7 ? (wet - 0.7) / 0.3 : 0;
      sh = sh * sh * (0.03 + 0.12 * sk);
      if (sh > 0) {
        r += (214 - r) * sh;
        g += (212 - g) * sh;
        b += (206 - b) * sh;
      }
      if (P.key[q] < NONE) {
        const d = P.dist[q];
        const w = P.wid[q];
        const half = w / 2;
        let gx = 0;
        let gy = 0;
        if (d > 0.05) {
          gx = (x - P.nx[q]) / d;
          gy = (y - P.ny[q]) / d;
        }
        // Positive where this LED's chip lies toward the sun from its crack.
        const facing = gx * SX + gy * SY;
        const lip = d - half;
        if (lip > 0) {
          // A drying chip curls into a dish: the rim away from the sun tilts
          // toward it, and the rim on the sun side turns away and lies in
          // the shadow of the lip across the crack.
          const li = Math.min(LIPN - 1, (lip * 32) | 0);
          const cs = curl * sun * smooth(0, 0.6, 1 - wet);
          let lift = 1 + cs * DISH[li] * (0.06 + 0.4 * facing) + cs * 0.14 * EDGE[li];
          if (facing < 0) {
            const reach = cs * 2.4 * -facing;
            if (lip < reach) lift *= 1 - 0.45 * smooth(0, 0.8, reach - lip);
          }
          r *= lift;
          g *= lift;
          b *= lift;
        }
        const a = half + 0.5 - d;
        if (a > 0) {
          const cover = a > 1 ? 1 : a;
          const depth = DEEP[ageIndex(clock - P.born[q])];
          // The wall that faces the sun is lit; the other lies in the shadow of its lip.
          const wall = facing < -0.3 && w > 1.5 && d > 0.6;
          const shade = wall ? 0.58 - 0.2 * depth : 0.5 - 0.44 * depth;
          let cr = r * shade;
          let cg = g * shade;
          let cb = b * shade;
          if (fill > 0) {
            // Rain water in the crack: dark, with the clouds in it.
            const v = 0.75 + 0.5 * sk;
            cr += (62 * v - cr) * fill;
            cg += (66 * v - cg) * fill;
            cb += (70 * v - cb) * fill;
          }
          r += (cr - r) * cover;
          g += (cg - g) * cover;
          b += (cb - b) * cover;
        }
      }
      rgb[q * 3] = r;
      rgb[q * 3 + 1] = g;
      rgb[q * 3 + 2] = b;
    }
  }
  // Raindrops: a bright point where one lands, then a ring that spreads and fades.
  for (let i = 0; i < MAXD; i++) {
    const age = P.dage[i];
    if (age > 0.3) continue;
    const x = P.dx[i];
    const y = P.dy[i];
    const rad = 0.3 + age * 7;
    const amp = (1 - age / 0.3) * (age < 0.05 ? 0.9 : 0.45);
    const e = Math.ceil(rad + 1);
    for (let j = Math.round(y) - e; j <= y + e; j++)
      for (let ii = Math.round(x) - e; ii <= x + e; ii++) {
        if (ii < 0 || ii >= W || j < 0 || j >= H) continue;
        const ring = (1 - Math.abs(Math.hypot(ii - x, j - y) - rad) / 0.8) * amp;
        if (ring <= 0) continue;
        const q = (j * W + ii) * 3;
        rgb[q] += (214 - rgb[q]) * ring;
        rgb[q + 1] += (220 - rgb[q + 1]) * ring;
        rgb[q + 2] += (226 - rgb[q + 2]) * ring;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      display.setPixel(x, y, rgb[q], rgb[q + 1], rgb[q + 2]);
    }
}
