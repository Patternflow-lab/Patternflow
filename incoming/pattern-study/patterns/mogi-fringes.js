// ===== Patternflow pattern =====
// Title:   Mogi Fringes
// Family:  geodesy
// Idea:    The rainbow fringes of a radar interferogram: a lopsided bull's-eye over a swelling volcano seen from a slanted look and butterfly lobes across a creeping fault, wobbling under atmosphere and breaking into grey-brown speckle where the ground changed, while the sources come and go.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the point-source volcano model (Kiyoo Mogi, 1958); the arctan profile of a locked strike-slip fault (Savage and Burford, 1973); dislocations in a half-space (Yoshimitsu Okada, 1985); the first radar interferogram of an earthquake, Landers (Massonnet, Rossi, Carmona, Adragna, Peltzer, Feigl and Rabaute, 1993); pattern round 204
// Round:   204
// ===============================
// @matrix 64x128
// @knobs Phase=0..1, Span=0.5..4, Depth=-1..1, Haze=-1..1
//
// Knob 1: Phase. Turns the colour cycle round, so every fringe edge slides on to the next one and the picture comes back to itself at 1; at 0 ground that did not move is blue.
// Knob 2: Span. The days between the two radar passes, 6 times the knob: 3 days at 0.5, 12 days where it opens, 24 days at 4. A longer span lets the ground move further, so a bull's-eye shows about 1 colour cycle at the bottom, 3 where it opens and 5 or 6 at the top, where fringes crowd to 3 LEDs a cycle and the bowls widen to hold them.
// Knob 3: Depth. How deep the swelling chamber and the fault's locked zone lie: the chamber from 9 LEDs at -1 (a tight bull's-eye with its far side crowded, a sharp seam along the fault) through 15 where it opens to 26 at 1 (one broad gentle bowl, a wide soft hinge), the fault's zone from 4 to 13 LEDs.
// Knob 4: Haze. How much the air and the ground got in the way: at -1 the picture is the ground alone, at 0 about half a colour cycle of wobble and 6% of the panel in grey-brown speckle, at 1 two full cycles of wobble and a quarter of the panel gone to speckle.

const W = 64;
const H = 128;
const N = W * H;
const { floor, sqrt, exp, atan, tan, abs, min, max, PI, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * PI * Math.random());

// The radar looks from the west at 36 degrees from the vertical, so ground that
// moves east moves away from it. A Mogi chamber lifts the ground by uz and pushes
// it outward by ur; along the line of sight that is uz cos(i) - ue sin(i), which is
// the unit shape F(u, v) = (1 - tan(i) u) / (1 + u^2 + v^2)^1.5 in depth units.
// Its peak sits west of the chamber and its east flank is the steep one.
const TAN_I = tan((36 * PI) / 180);
// The steepest slope of F, in peak cycles per unit depth (found by scanning F).
const G1 = 1.21;
// The steepest slope one source may have: 0.24 cycles per LED, 4.2 LEDs a cycle.
// A source that would be steeper gets deeper instead, so its fringes spread
// rather than alias to noise.
const GC = 0.24;
// Where sources overlap their slopes add. The sum of the sources is held to
// 0.33 cycles per LED, 3 LEDs a cycle, by turning all of them down together,
// which leaves the rest of the 0.4 to the air and the orbit ramp.
const GSUM = 0.33;
// The haze takes its own share of it: 0.07 at the top of the knob.
const GHAZE = 0.07;

const GW = 17;
const GH = 33;
const GS = 4;

// A smooth noise that never repeats: lattice values hashed from the cell,
// blended with the quintic fade. It runs through x, y and a third axis, time.
function hash3(i, j, k) {
  let h = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn3(x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = mix(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), fx);
  const b = mix(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), fx);
  const c = mix(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), fx);
  const d = mix(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), fx);
  return mix(mix(a, b, fy), mix(c, d, fy), fz);
}

// The cyclic InSAR rainbow: blue, cyan, green, yellow, red, magenta, back to
// blue. Keys are picked so the six read about equally bright on the panel, where
// blue and red lose to green and yellow if left at full strength.
const KEYS = [
  [0.3, 0.44, 1.0],
  [0.1, 0.84, 0.95],
  [0.2, 0.9, 0.32],
  [0.96, 0.86, 0.14],
  [1.0, 0.3, 0.18],
  [0.92, 0.22, 0.8],
];
const LUTN = 1024;
function buildLut(lut) {
  for (let i = 0; i < LUTN; i++) {
    const p = (i / LUTN) * 6, k = floor(p), f = p - k;
    const u = 0.5 * f + 0.5 * f * f * (3 - 2 * f);
    const a = KEYS[k % 6], b = KEYS[(k + 1) % 6];
    lut[i * 3] = mix(a[0], b[0], u);
    lut[i * 3 + 1] = mix(a[1], b[1], u);
    lut[i * 3 + 2] = mix(a[2], b[2], u);
  }
}

// Frozen ground texture for the decorrelated patches: white noise blurred
// once or twice so a speck is two or three LEDs wide, not one.
function blur(src, dst) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          s += src[((y + dy + H) % H) * W + ((x + dx + W) % W)] * (2 - abs(dx)) * (2 - abs(dy));
      dst[y * W + x] = s / 16;
    }
}
function texture(out, passes) {
  let a = new Float32Array(N), b = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = Math.random();
  for (let p = 0; p < passes; p++) {
    blur(a, b);
    const t = a; a = b; b = t;
  }
  let m = 0, v = 0;
  for (let i = 0; i < N; i++) m += a[i];
  m /= N;
  for (let i = 0; i < N; i++) v += (a[i] - m) * (a[i] - m);
  const sd = sqrt(v / N) || 1;
  for (let i = 0; i < N; i++) out[i] = cl(0.5 + (a[i] - m) / (3 * sd), 0, 1);
}

// Five places a source can live: three chambers and two faults. A slot is
// dormant until the director gives it a place; its ramp r then rises to 1 over
// 14 to 26 s and, when the source dies, falls back to 0 before the slot is
// given a new place, so nothing ever pops in.
const SLOTS = [0, 0, 0, 1, 1];
function newSlot(type) {
  return {
    type, up: false, r: 0, rate: 1 / 18, age: 0,
    x: 32, y: 64, sign: 1, gain: 1, df: 1, psi: 0, lh: 30,
    lv: 1, pulse: 0,
  };
}

export function setup(params) {
  const lut = new Float32Array(LUTN * 3);
  buildLut(lut);
  const spk = new Float32Array(N), tint = new Float32Array(N);
  texture(spk, 1);
  texture(tint, 5);
  const cx = new Int32Array(W), fx = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const g = (x + 0.5) / GS;
    cx[x] = floor(g);
    fx[x] = g - cx[x];
  }
  params.s = {
    first: true,
    t: 0,
    k: [0, 2, 0, 0.06],
    span: 2, depth: 0, haze: 0.06,
    slots: SLOTS.map(newSlot),
    // Atmosphere and decorrelation drift through their own noise, a different
    // slice of it each run.
    ao: [Math.random() * 500, Math.random() * 500, Math.random() * 500],
    dof: [Math.random() * 500, Math.random() * 500, Math.random() * 500],
    ax: 0, ay: 0, avx: 0.24, avy: 0.13,
    dx: 0, dy: 0, dvx: -0.22, dvy: 0.16,
    rx: 0, ry: 0,
    lastBirth: -99,
    lut, spk, tint, cx, fx,
    ag: new Float32Array(GW * GH),
    dg: new Float32Array(GW * GH),
    mp: new Float32Array(3 * 4),
    fp: new Float32Array(2 * 8),
    nm: 0, nf: 0,
    ph0: 0.1, atmAmp: 0, thr: 2, rampAmp: 0, lim: 1,
  };
}

// The director keeps two or three sources up. It waits for a slot to be fully
// dormant, then picks a place far from the sources that are still showing.
function spawn(S, s, instant) {
  const others = S.slots.filter((o) => o !== s && o.r > 0.02);
  let bx = 32, by = 64, bd = -1;
  for (let n = 0; n < 14; n++) {
    const x = s.type === 0 ? 10 + 44 * Math.random() : 16 + 32 * Math.random();
    const y = s.type === 0 ? 16 + 96 * Math.random() : 22 + 84 * Math.random();
    let d = 1e9;
    for (const o of others) d = min(d, hypot(x - o.x, (y - o.y) * 0.8));
    if (d > bd) { bd = d; bx = x; by = y; }
  }
  s.x = bx;
  s.y = by;
  s.sign = s.type === 0 ? (Math.random() < 0.75 ? 1 : -1) : Math.random() < 0.5 ? 1 : -1;
  s.gain = 0.7 + 0.45 * Math.random();
  s.df = 0.8 + 0.45 * Math.random();
  s.psi = (Math.random() < 0.5 ? -1 : 1) * (0.32 + 0.78 * Math.random());
  s.lh = 24 + 10 * Math.random();
  s.rate = 1 / (14 + 12 * Math.random());
  s.lv = 1;
  s.pulse = 0;
  s.age = instant ? 20 + 80 * Math.random() : 0;
  s.up = true;
  if (instant) s.r = 1;
}

function direct(S, dt) {
  const slots = S.slots;
  let up = 0;
  for (const s of slots) if (s.up) up++;
  const dormant = (type) => slots.filter((s) => !s.up && s.r <= 0 && (type < 0 || s.type === type));
  const birth = () => {
    // Prefer the kind that is missing, so a fault shows up now and then
    // and a scene is not three bull's-eyes.
    const nf = slots.filter((s) => s.up && s.type === 1).length;
    const nm = up - nf;
    const want = nf === 0 ? 1 : nm === 0 ? 0 : -1;
    let pool = dormant(want);
    if (!pool.length) pool = dormant(-1);
    if (!pool.length) return;
    spawn(S, pool[floor(Math.random() * pool.length)], false);
    S.lastBirth = S.t;
    up++;
  };
  const kill = () => {
    let old = null;
    for (const s of slots) if (s.up && s.age > 30 && (!old || s.age > old.age)) old = s;
    if (old) { old.up = false; up--; }
  };
  if (up < 2) birth();
  else if (up === 2 && S.t - S.lastBirth > 10 && Math.random() < dt / 20) birth();
  else if (up >= 3 && Math.random() < dt / 28) kill();
  else if (up === 2 && Math.random() < dt / 70) kill();
}

function advance(S, dt, k) {
  S.t += dt;
  S.phase = k[0];
  const a = 1 - exp(-dt / 0.35);
  S.span += (cl(k[1], 0.5, 4) - S.span) * a;
  S.depth += (cl(k[2], -1, 1) - S.depth) * a;
  S.haze += (cl(k[3], -1, 1) - S.haze) * a;
  // The atmosphere is a different screen on each pass, so the difference
  // slides and boils: the noise drifts and the wind turns slowly.
  S.avx += -0.02 * (S.avx - 0.22) * dt + 0.03 * sqrt(dt) * gauss();
  S.avy += -0.02 * (S.avy - 0.12) * dt + 0.03 * sqrt(dt) * gauss();
  S.ax += S.avx * dt;
  S.ay += S.avy * dt;
  S.dvx += -0.015 * (S.dvx + 0.2) * dt + 0.025 * sqrt(dt) * gauss();
  S.dvy += -0.015 * (S.dvy - 0.14) * dt + 0.025 * sqrt(dt) * gauss();
  S.dx += S.dvx * dt;
  S.dy += S.dvy * dt;
  // The orbit ramp: a tilt of a few cycles across the scene that wanders.
  S.rx += -0.04 * S.rx * dt + 0.0032 * sqrt(dt) * gauss();
  S.ry += -0.04 * S.ry * dt + 0.0024 * sqrt(dt) * gauss();
  for (const s of S.slots) {
    if (s.up) s.age += dt;
    if (s.up && s.r < 1) s.r = min(1, s.r + dt * s.rate);
    else if (!s.up && s.r > 0) s.r = max(0, s.r - dt * s.rate);
    if (s.r <= 0 && !s.up) continue;
    // How fast the ground is moving wanders as a random walk pulled toward 1,
    // and now and then an episode adds a pulse that fades over about 18 s.
    s.lv += -(s.lv - 1) * dt / 40 + 0.16 * sqrt(dt) * gauss();
    s.pulse *= exp(-dt / 18);
    if (Math.random() < dt / 55) s.pulse += 0.5 + 0.7 * Math.random();
    s.lv = cl(s.lv, 0.4, 1.6);
  }
  direct(S, dt);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.k = k;
  if (S.first) {
    // Open as if the scene had been running: two sources up and a minute of wandering.
    S.span = cl(k[1], 0.5, 4);
    S.depth = cl(k[2], -1, 1);
    S.haze = cl(k[3], -1, 1);
    const m = S.slots[floor(Math.random() * 3)];
    const f = S.slots[3 + floor(Math.random() * 2)];
    spawn(S, m, true);
    spawn(S, f, true);
    S.lastBirth = -99;
    for (let t = 0; t < 60; t += 0.1) advance(S, 0.1, k);
    S.first = false;
  }
  advance(S, dt, k);
}

// The phase the live sources make at one point, in cycles.
function field(S, xx, yy) {
  const { mp, fp, nm, nf } = S;
  let ph = 0;
  for (let m = 0; m < nm; m++) {
    const o = m * 4;
    const dx = xx - mp[o], dy = yy - mp[o + 1], id = mp[o + 3];
    const q = 1 + (dx * dx + dy * dy) * id * id;
    ph += (mp[o + 2] * (1 - TAN_I * dx * id)) / (q * sqrt(q));
  }
  for (let m = 0; m < nf; m++) {
    const o = m * 8;
    const dx = xx - fp[o], dy = yy - fp[o + 1];
    const sp = dx * fp[o + 2] + dy * fp[o + 3];
    const sq = dx * fp[o + 3] - dy * fp[o + 2];
    const u = sp * fp[o + 6], u2 = u * u;
    ph += fp[o + 4] * atan(sq / (fp[o + 5] * (1 + 0.6 * u2))) * exp(-u2);
  }
  return ph;
}

// Pack what draw needs: each live source with its strength in cycles and the
// depth it has once the slope cap is applied.
function prepare(S) {
  const sp = S.span, dm = 15 * exp(0.55 * S.depth), df = 7.5 * exp(0.55 * S.depth);
  const cyc = 1.7 * sp;
  let nm = 0, nf = 0;
  for (const s of S.slots) {
    if (s.r <= 0) continue;
    const e = sstep(0, 1, s.r);
    const lvl = cl(s.lv + s.pulse, 0.4, 2.2);
    if (s.type === 0) {
      const peak = s.sign * cyc * s.gain * e * lvl;
      // Depth the slope cap leaves it: a strong source widens its bowl.
      const d = hypot(dm * s.df, (abs(peak) * G1) / GC);
      const o = nm * 4;
      S.mp[o] = s.x;
      S.mp[o + 1] = s.y;
      S.mp[o + 2] = peak;
      S.mp[o + 3] = 1 / d;
      nm++;
    } else {
      // The whole offset across the fault, which shows as half on each side.
      const off = s.sign * cyc * 1.55 * s.gain * e * lvl;
      const d = hypot(df * s.df, abs(off) / (PI * GC));
      const o = nf * 8;
      S.fp[o] = s.x;
      S.fp[o + 1] = s.y;
      S.fp[o + 2] = Math.sin(s.psi);
      S.fp[o + 3] = Math.cos(s.psi);
      S.fp[o + 4] = off / PI;
      S.fp[o + 5] = d;
      S.fp[o + 6] = 1 / s.lh;
      nf++;
    }
  }
  S.nm = nm;
  S.nf = nf;
  // Sample the steepest slope of what the sources add up to on a 3 LED grid,
  // and if it is over the sum limit scale every source down by the same share.
  // Slope is linear in strength, so one pass is exact.
  let gm = 0;
  for (let y = 1.5; y < H - 1; y += 3)
    for (let x = 1.5; x < W - 1; x += 3) {
      const p0 = field(S, x, y);
      const gx = field(S, x + 1, y) - p0, gy = field(S, x, y + 1) - p0;
      const g = gx * gx + gy * gy;
      if (g > gm) gm = g;
    }
  const h = (S.haze + 1) / 2;
  const want = gm > 0 ? min(1, (GSUM - GHAZE * h) / sqrt(gm)) : 1;
  S.lim = want < S.lim ? want : S.lim + (want - S.lim) * 0.05;
  for (let m = 0; m < nm; m++) S.mp[m * 4 + 2] *= S.lim;
  for (let m = 0; m < nf; m++) S.fp[m * 8 + 4] *= S.lim;
  S.atmAmp = 0.12 + 1.35 * h * sqrt(h);
  S.rampAmp = 0.8 + 2.2 * h * h;
  // The share of the panel that is speckle follows the threshold on the
  // decorrelation noise: none at the bottom of the knob, about 6% where it
  // opens and about a quarter at the top.
  S.thr = h <= 0.001 ? 2 : 0.94 - 0.38 * h ** 0.6;
}

// Fill the two coarse grids: the atmosphere in cycles and the decorrelation field.
function grids(S) {
  const { ag, dg, ao, dof } = S;
  const A = S.atmAmp;
  const need = S.thr < 1.5;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const x = i * GS, y = j * GS, o = j * GW + i;
      if (A > 0) {
        const x1 = (x + S.ax) / 38, y1 = (y + S.ay) / 38;
        const x2 = (0.8 * (x + S.ax) + 0.6 * (y + S.ay)) / 21, y2 = (-0.6 * (x + S.ax) + 0.8 * (y + S.ay)) / 21;
        const n = 0.66 * vn3(x1 + ao[0], y1 + ao[1], S.t * 0.015 + ao[2]) + 0.34 * vn3(x2 + 40, y2 + 70, S.t * 0.017 + 30);
        ag[o] = A * cl((n - 0.5) / 0.3, -1.4, 1.4);
      } else ag[o] = 0;
      if (need) {
        const xd = (x + S.dx) / 24, yd = (y + S.dy) / 24;
        dg[o] = 0.62 * vn3(xd + dof[0], yd + dof[1], S.t * 0.009 + dof[2]) + 0.38 * vn3(1.9 * xd + 17, 1.9 * yd + 5, S.t * 0.014 + 9);
      } else dg[o] = 0;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  prepare(S);
  grids(S);
  const { lut, spk, tint, cx, fx, ag, dg, mp, fp, nm, nf } = S;
  const ph0 = S.ph0 + S.phase;
  const thr = S.thr, ramp = S.rampAmp;
  const rx = S.rx * ramp, ry = S.ry * ramp;
  const speck = thr < 1.5;
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5;
    const gy = yy / GS, jy = floor(gy), fy = gy - jy;
    const r0 = jy * GW, r1 = r0 + GW;
    for (let x = 0; x < W; x++) {
      const xx = x + 0.5;
      const i0 = cx[x], f = fx[x];
      let a = mix(ag[r0 + i0], ag[r0 + i0 + 1], f);
      let b = mix(ag[r1 + i0], ag[r1 + i0 + 1], f);
      let ph = mix(a, b, fy) + rx * (xx - 32) + ry * (yy - 64);
      for (let m = 0; m < nm; m++) {
        const o = m * 4;
        const dx = xx - mp[o], dy = yy - mp[o + 1], id = mp[o + 3];
        const q = 1 + (dx * dx + dy * dy) * id * id;
        ph += (mp[o + 2] * (1 - TAN_I * dx * id)) / (q * sqrt(q));
      }
      for (let m = 0; m < nf; m++) {
        const o = m * 8;
        const dx = xx - fp[o], dy = yy - fp[o + 1];
        const sp = dx * fp[o + 2] + dy * fp[o + 3];
        const sq = dx * fp[o + 3] - dy * fp[o + 2];
        const u = sp * fp[o + 6], u2 = u * u;
        ph += fp[o + 4] * atan(sq / (fp[o + 5] * (1 + 0.6 * u2))) * exp(-u2);
      }
      let c = ph + ph0;
      c -= floor(c);
      const li = ((c * LUTN) | 0) * 3;
      let r = lut[li], g = lut[li + 1], bl = lut[li + 2];
      if (speck) {
        let d = mix(mix(dg[r0 + i0], dg[r0 + i0 + 1], f), mix(dg[r1 + i0], dg[r1 + i0 + 1], f), fy);
        const p = y * W + x;
        // The edge wanders with a smooth texture and only inside the patch does
        // the fine grain bite, so no lone speck is left outside it.
        const e = (d - thr) / 0.1 + (tint[p] - 0.5) * 1.2;
        const w = sstep(0, 1, e + (spk[p] - 0.5) * 0.7 * cl(e * 2, 0, 1));
        if (w > 0) {
          const v = 0.3 + 0.58 * spk[p], tn = tint[p];
          r = mix(r, v * 0.97, w);
          g = mix(g, v * (0.9 - 0.07 * tn), w);
          bl = mix(bl, v * (0.79 - 0.13 * tn), w);
        }
      }
      display.setPixel(x, y, r * 255, g * 255, bl * 255);
    }
  }
}
