// ===== Patternflow pattern =====
// Title:   Theta Sequences
// Family:  hippocampus
// Idea:    A spike raster of 128 hippocampal place cells, stacked in the order of their fields along a track, scrolls across the panel; on every theta beat the burst sweeps up the stack a little ahead of the animal and each cell fires a little earlier in the beat than the one before it, drawing slanted streaks, and when the animal stops the same sequences replay at about twenty times the speed in sharp bright bursts.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the place cell, which fires only where the animal is on a track (O'Keefe and Dostrovsky 1971, from memory); phase precession, in which a cell fires at an earlier phase of the theta beat the further the animal runs through its field (O'Keefe and Recce 1993, from memory); the theta sequence that precession makes, the cells of the track ahead and behind firing in order inside one beat (Skaggs et al. 1996, from memory); the sharp-wave ripple and the compressed replay of a run at rest (Buzsaki 1986, from memory; Wilson and McNaughton 1994, from memory); remapping to a new room, in which the order of the fields is made anew (Muller and Kubie 1987, from memory); the beat is stretched from about 8 Hz to about 2 Hz so that it is 14 columns wide, the spike rates are raised to read as lines, and the bout model, the draw and the Poisson spiking are original, pattern round 244
// Round:   244
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Run=0..3, Precession=-1..1, Replay=-1..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel. It opens with the bottom cell of the stack blue, the middle magenta and the top orange, so a sequence is a ramp of colour, the theta pulses in the ground indigo and the replays white-hot with a trace of their cell's colour.
// Knob 2: Run. 0 to 3, opening at 2: how much the animal runs. At 0 it stands still on one spot of the track and only replays and a little tonic firing show; at 2 it runs 34 cm a second in bouts of two to five seconds with pauses of about as long; at 3 it runs 44 cm a second and hardly stops, so a new sequence comes up the stack every beat and the streaks step up the panel.
// Knob 3: Precession. -1 to 1, opening at 0: how far the phase of a cell moves through the beat as the animal crosses its field. At -1 all the cells near the animal fire together and a beat is a vertical bar; at 0 a beat is a slanted streak about 20 cells tall; at 1 the phase moves past a whole beat and the streaks lengthen and lean further. The lean turns the other way when the animal turns round.
// Knob 4: Replay. -1 to 1, opening near 0: how often the animal replays a run while it rests and how long the replay is. At -1 about one replay in four seconds, 20 cells long; at the opening one in 1.2 seconds, about 40 cells; at 1 two or three a second, 80 cells, in trains.

const W = 64, H = 128, NC = 128;
const { floor, min, max, abs, sqrt, exp, log, pow, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- constants --------------------------------------------------------------
const DT = 1 / 60;            // one step of the world
const PRE = 40;               // seconds run before the first frame
const SCROLL = 32;            // columns a second the raster runs left
const XNOW = 62.2;            // column of the newest spike; the right edge shows the next 40 ms
const SP = 2400;              // spikes kept
const HN = 512;               // steps of history kept
const WIN = 2.5;              // a spike is dropped from the picture after this many seconds
const HUE0 = 0.64;            // the bottom of the ramp, blue; a knob turn is added to it
const SPAN = 0.43;            // the ramp covers 155 degrees of hue
const BASE_RATE = 0.6;        // replays a second at the opening of the Replay knob

// ---- the world --------------------------------------------------------------
export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, acc: 0, n: 0,
    // the track and its cells: a cell is a field centre (cm), a width (cm), a peak rate (Hz), a phase window, a slow gain
    L: 200, sg: 1, hs: 0, flip: 0, nextRemap: 80,
    cen: new Float32Array(NC), sig: new Float32Array(NC), peak: new Float32Array(NC), kap: new Float32Array(NC), gain: new Float32Array(NC).fill(1),
    // the animal
    pos: 100, dir: 1, v: 0, vt: 0, left: 2, mode: 0, ouv: 0, fv: 0,
    // the theta beat
    ph: rnd(), fth: 2.1, ouf: 0,
    // histories, one value a step: the animal's cell coordinate, the theta phase, the theta depth
    hPos: new Float32Array(HN), hPh: new Float32Array(HN), hG: new Float32Array(HN),
    // the spikes, a ring: time, cell, colour offset, brightness, kind (0 theta, 1 replay, 2 stray)
    sT: new Float64Array(SP).fill(-1e9), sR: new Uint8Array(SP), sC: new Float32Array(SP), sA: new Float32Array(SP), sK: new Uint8Array(SP), sh: 0,
    // replays in flight: front, direction, end, cells a second
    rep: [], tRep: 1.5,
    // the picture
    buf: new Float32Array(W * H * 3), col: new Float32Array(W * 4), lut: new Float32Array(512 * 3), tone: new Uint8Array(2048),
    u: 0.667, pr: 1, prec: 0.6, rrate: BASE_RATE, rlen: 1,
  };
  const st = params.st;
  for (let i = 0; i < 2048; i++) st.tone[i] = floor(255 * (1 - exp(-1.55 * (i / 2047) * 2.6)) + 0.5);
  buildLut(st.lut);
  return st;
}

// A full-value colour for each of 512 steps round the wheel.
function buildLut(lut) {
  for (let i = 0; i < 512; i++) {
    const h = i / 512, s = 0.88;
    const a = (h - floor(h)) * 6, j = floor(a), f = a - j;
    const p = 1 - s, q = 1 - s * f, t = 1 - s * (1 - f);
    const rgb = j === 0 ? [1, t, p] : j === 1 ? [q, 1, p] : j === 2 ? [p, 1, t] : j === 3 ? [p, q, 1] : j === 4 ? [t, p, 1] : [1, p, q];
    lut[i * 3] = rgb[0];
    lut[i * 3 + 1] = rgb[1];
    lut[i * 3 + 2] = rgb[2];
  }
}

// A new room: the cells are laid out again along a track of a new length.
function remap(st, first) {
  const old = st.L;
  st.L = first ? 200 : 170 + 70 * rnd();
  st.pos = cl(st.pos * (st.L / old), 8, st.L - 8);
  st.sg = 0.8 + 0.4 * rnd();
  for (let i = 0; i < NC; i++) {
    st.cen[i] = ((i + 0.5 + (rnd() - 0.5) * 0.7) / NC) * st.L;
    st.sig[i] = cl(7 * st.sg * exp(0.25 * gauss()), 4, 14);
    st.peak[i] = 20 + 28 * pow(rnd(), 1.2);
    st.kap[i] = 5 + 3 * rnd();
  }
  if (!first) {
    st.hs = -0.12 + 0.17 * rnd();
    st.flip = rnd() < 0.5 ? 1 : 0;
    st.rep.length = 0;
  }
  st.nextRemap = st.t + 55 + 55 * rnd();
}

function emit(st, row, c, amp, kind, tm) {
  const h = st.sh;
  st.sT[h] = tm;
  st.sR[h] = row;
  st.sC[h] = c;
  st.sA[h] = amp;
  st.sK[h] = kind;
  st.sh = h + 1 === SP ? 0 : h + 1;
}

// the colour offset of a cell: its place on the ramp in this room, and the room's own turn of the hue
function cellHue(st, i) {
  return SPAN * (st.flip ? 1 - i / (NC - 1) : i / (NC - 1)) + st.hs;
}

function derive(st) {
  const kv = st.k;
  st.u = cl(kv[1] / 3, 0, 1);
  st.pr = kv[1] < 0.03 ? 0 : pow(st.u / 0.667, 1.6);
  st.prec = cl(0.6 + 0.55 * kv[2], 0, 1.2);
  st.rrate = BASE_RATE * pow(3.2, cl(kv[3], -1, 1));
  st.rlen = pow(2, cl(kv[3], -1, 1));
}

function startReplay(st) {
  const n = cl(floor(40 * st.rlen * (0.55 + rnd())), 14, 118);
  const d = rnd() < 0.5 ? 1 : -1;
  const a = cl(st.pos / st.L * NC, 0, NC - 1);
  let from;
  if (rnd() < 0.6) {
    // a replay that begins at the animal, ends at it, or runs through it
    const q = rnd() < 0.5 ? (rnd() < 0.5 ? 0 : 1) : rnd();
    from = d > 0 ? a - q * n : a + q * n;
  } else from = d > 0 ? rnd() * (NC - n) : n + rnd() * (NC - n);
  from = cl(from, d > 0 ? 0 : n, d > 0 ? NC - n : NC - 1);
  // about twenty times the run: a run is some 18 cells a second
  st.rep.push({ f: from, d, end: from + d * n, rate: (11 + 9 * rnd()) * 18, tint: 0.65 + 0.3 * rnd() });
}

function step(st, dt) {
  const t = (st.t += dt), u = st.u;
  // ---- the animal: bouts of running and pauses ----
  if (st.mode === 0) {
    st.left -= dt * st.pr;
    if (st.left <= 0 && st.pr > 0) {
      let d = rnd() < 0.5 ? 1 : -1;
      if (st.pos < 40) d = 1;
      else if (st.pos > st.L - 40) d = -1;
      st.mode = 1;
      st.dir = d;
      st.vt = 0.8 + 0.4 * rnd();
      st.left = 80 + 120 * rnd();
    }
  } else if (st.left <= 0) {
    st.mode = 0;
    st.left = 1.2 + 2.6 * rnd();
  }
  st.ouv += (-st.ouv * dt) / 1.0 + sqrt(dt) * gauss() * 0.55;
  const tgt = st.mode === 1 ? min(52, max(8, (14 + 30 * u) * st.vt * (1 + 0.2 * cl(st.ouv, -1.5, 1.5)))) : 0;
  const acc = st.mode === 1 ? 70 : 140;
  st.v += cl(tgt - st.v, -acc * dt, acc * dt);
  st.fv += (-st.fv * dt) / 1.5 + sqrt(dt) * gauss() * 1.4;
  st.pos += st.dir * st.v * dt + (st.mode === 0 ? st.fv * dt : 0);
  if (st.mode === 1) st.left -= st.v * dt;
  if (st.pos < 3 || st.pos > st.L - 3) {
    st.pos = cl(st.pos, 3, st.L - 3);
    if (st.mode === 1) {
      if (rnd() < 0.65) {
        st.dir = -st.dir;
        st.left = 40 + 110 * rnd();
        st.v *= 0.3;
      } else st.left = 0;
    }
  }
  // ---- the beat ----
  const g = sstep(5, 16, st.v);
  st.ouf += (-st.ouf * dt) / 1.5 + sqrt(dt) * gauss() * 0.5;
  st.fth = 1.85 + 0.5 * cl(st.v / 44, 0, 1.2) + 0.2 * cl(st.ouf, -2, 2);
  st.ph += st.fth * dt;
  st.ph -= floor(st.ph);
  const hi = st.n % HN;
  st.hPos[hi] = (st.pos / st.L) * NC;
  st.hPh[hi] = st.ph;
  st.hG[hi] = g;
  st.n++;
  // ---- the cells ----
  const dirv = st.dir, p = st.prec, pos = st.pos;
  const tonic = 0.035 + 0.02 * (1 - g);
  for (let i = 0; i < NC; i++) {
    st.gain[i] += (1 - st.gain[i]) * dt * 0.25 + sqrt(dt) * gauss() * 0.3;
    const gi = cl(st.gain[i], 0.35, 1.7);
    // a cell is silent but for a stray spike away from its field
    let rate = 0.08 * gi, amp = 0.4, kind = 2;
    const d = pos - st.cen[i], z = d / st.sig[i];
    if (z * z < 10) {
      const f = exp(-0.5 * z * z);
      // the beat phase the cell prefers: late as the animal comes into the field, early as it leaves
      const s = cl((dirv * d) / (2 * st.sig[i]), -1, 1);
      let dp = st.ph - (0.5 - 0.5 * p * s);
      dp -= floor(dp + 0.5);
      const win = exp(st.kap[i] * (cos(TAU * dp) - 1));
      const r = st.peak[i] * f * gi * (g * win + (1 - g) * tonic);
      if (r > rate) {
        rate = r;
        kind = 0;
        amp = (0.62 + 0.55 * sqrt(f)) * (0.35 + 0.65 * g) * (0.85 + 0.3 * rnd());
      }
    }
    if (rnd() < rate * dt) emit(st, NC - 1 - i, cellHue(st, i), amp, kind, t - rnd() * dt);
  }
  // ---- sharp-wave ripples and their replays, at rest ----
  if (st.mode === 0 && st.v < 6) {
    st.tRep -= dt;
    if (st.tRep <= 0) {
      startReplay(st);
      st.tRep = rnd() < 0.25 ? 0.25 + 0.3 * rnd() : -log(1 - rnd() * 0.97) / st.rrate;
    }
  } else if (st.tRep < 0.5) st.tRep = 0.5;
  for (let k = st.rep.length - 1; k >= 0; k--) {
    const r = st.rep[k];
    const a = r.f, b = a + r.d * r.rate * dt;
    // every cell the front crosses in this step fires, nearly always
    const lo = r.d > 0 ? floor(a) + 1 : floor(b) + 1, hi2 = r.d > 0 ? floor(b) : floor(a);
    for (let c = lo; c <= hi2; c++) {
      if (c < 0 || c >= NC || (r.d > 0 ? c > r.end : c < r.end)) continue;
      if (rnd() < 0.82) {
        const when = t - dt + (dt * (c - a)) / (b - a);
        emit(st, NC - 1 - c, cellHue(st, c), 1.0 + 0.25 * rnd(), 1, when);
        if (rnd() < 0.35) emit(st, NC - 1 - c, cellHue(st, c), 0.9, 1, when - 0.004);
      }
    }
    r.f = b;
    if (r.d > 0 ? b >= r.end : b <= r.end) st.rep.splice(k, 1);
  }
  // ---- a new room, now and then ----
  if (t >= st.nextRemap) remap(st, false);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  derive(st);
  if (!st.init) {
    st.init = true;
    remap(st, true);
    st.pos = 30 + 140 * rnd();
    st.left = 0.5 + rnd();
    st.ph = rnd();
    st.ouv = gauss() * 0.4;
    st.ouf = gauss() * 0.5;
    for (let i = 0; i < NC; i++) st.gain[i] = cl(1 + 0.3 * gauss(), 0.4, 1.6);
    for (let i = 0; i < PRE / DT; i++) step(st, DT);
    // open just after a run has ended: its streaks are still on the left and the first replays are coming
    let ran = 0, quiet = 0;
    for (let i = 0; i < 25 / DT && quiet < 0.45 / DT; i++) {
      step(st, DT);
      if (st.mode === 1 && st.v > 20) (ran += DT), (quiet = 0);
      else if (ran > 1.6 && st.mode === 0) quiet++;
    }
  }
  st.acc += cl(dt || 0, 0, 0.1);
  while (st.acc >= DT) {
    st.acc -= DT;
    step(st, DT);
  }
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const buf = st.buf, lut = st.lut, hue = st.k[0];
  buf.fill(0);
  const tNow = st.t + st.acc;
  const nMax = st.n - 1;
  // value of a history at a time, between the two steps round it
  const hist = (h, tau) => {
    let nf = tau / DT - 1;
    if (nf >= nMax) nf = nMax;
    if (nf < nMax - HN + 2) nf = nMax - HN + 2;
    const i0 = floor(nf), fr = nf - i0;
    return h[((i0 % HN) + HN) % HN] * (1 - fr) + h[(((i0 + 1) % HN) + HN) % HN] * fr;
  };
  // ---- the ground: the theta beat as indigo columns, strongest round the animal ----
  const hb = ((HUE0 + 0.07 + hue) % 1 + 1) % 1, hbi = floor(hb * 512) % 512 * 3;
  const ir = lut[hbi] * 0.5, ig = lut[hbi + 1] * 0.5, ib = lut[hbi + 2];
  const cx = st.col;
  for (let x = 0; x < W; x++) {
    const age = (XNOW - (x + 0.5)) / SCROLL, tau = tNow - max(age, 0);
    const g = hist(st.hG, tau);
    // the phase is a circle; read it from the two nearest steps without crossing the seam
    let nf = tau / DT - 1;
    nf = cl(nf, nMax - HN + 2, nMax);
    const i0 = floor(nf), fr = nf - i0;
    let p0 = st.hPh[((i0 % HN) + HN) % HN], p1 = st.hPh[(((i0 + 1) % HN) + HN) % HN];
    if (p1 < p0 - 0.5) p1 += 1;
    const phase = p0 + (p1 - p0) * fr;
    const pulse = pow(0.5 + 0.5 * cos(TAU * (phase - 0.5)), 2);
    cx[x * 4] = 0.012 + g * 0.2 * pulse + (1 - g) * 0.01;
    cx[x * 4 + 1] = NC - hist(st.hPos, tau);
    cx[x * 4 + 2] = 0.1 + 0.3 * exp(-max(age, 0) / 0.3);
    cx[x * 4 + 3] = g;
  }
  for (let x = 0; x < W; x++) {
    const a = cx[x * 4], yc = cx[x * 4 + 1], pa = cx[x * 4 + 2];
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - yc;
      const band = 0.3 + 0.7 * exp(-(dy * dy) / (2 * 15 * 15));
      const v = a * band;
      const o = (y * W + x) * 3;
      buf[o] += ir * v;
      buf[o + 1] += ig * v;
      buf[o + 2] += ib * v;
      const l = 1 - abs(dy) / 1.6;
      if (l > 0) {
        const w = l * l * pa * 0.55;
        buf[o] += 0.8 * w;
        buf[o + 1] += 0.8 * w;
        buf[o + 2] += 0.95 * w;
      }
    }
  }
  // ---- the spikes ----
  for (let k = 0; k < SP; k++) {
    const tm = st.sT[k], age = tNow - tm;
    if (age > WIN || age < -0.02) continue;
    const xc = XNOW - age * SCROLL;
    if (xc < -4) continue;
    const kind = st.sK[k], rep = kind === 1;
    const hh = (((HUE0 + hue + st.sC[k]) % 1) + 1) % 1, li = floor(hh * 512) % 512 * 3;
    let cr = lut[li], cg = lut[li + 1], cb = lut[li + 2];
    let amp = st.sA[k];
    // older spikes dim, but not into the dark; the left edge fades out
    const fade = 0.5 + 0.5 * exp(-age / 0.9);
    let bright = amp * fade * sstep(-1, 6, xc);
    if (age < 0.09) bright *= 1.25 - 0.25 * (age / 0.09);
    let hw = 1.3, halo = 0.16;
    if (rep) {
      // a replay is white-hot with a trace of the cell's colour
      const w = 0.6;
      cr += (1.05 - cr) * w;
      cg += (1.05 - cg) * w;
      cb += (1.05 - cb) * w;
      bright *= 1.05;
      hw = 1.0;
      halo = 0.12;
    } else if (kind === 2) halo = 0.05;
    const row = st.sR[k];
    const x0 = max(0, floor(xc - 5)), x1 = min(W - 1, floor(xc + 5));
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - xc;
      const core = cl(hw + 0.5 - abs(dx), 0, 1);
      const gl = halo * exp(-(dx * dx) / 8);
      for (let dy = -2; dy <= 2; dy++) {
        const y = row + dy;
        if (y < 0 || y >= H) continue;
        const ad = dy < 0 ? -dy : dy;
        const vp = ad === 0 ? 1 : ad === 1 ? (rep ? 0.12 : 0.3) : 0;
        const hp = ad === 0 ? 1 : ad === 1 ? 0.5 : 0.15;
        const e = bright * (core * vp + gl * hp * 1);
        if (e <= 0.002) continue;
        const o = (y * W + x) * 3;
        buf[o] += cr * e;
        buf[o + 1] += cg * e;
        buf[o + 2] += cb * e;
      }
    }
  }
  // ---- out ----
  const tone = st.tone, sc = 2047 / 2.6;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, tone[min(2047, (buf[o] * sc) | 0)], tone[min(2047, (buf[o + 1] * sc) | 0)], tone[min(2047, (buf[o + 2] * sc) | 0)]);
    }
  }
}
