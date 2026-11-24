// ===== Patternflow pattern =====
// Title:   Core Memory
// Family:  corememory
// Idea:    A close view of a ferrite core memory plane, 9 by 18 rings of 5 by 5 LED on a 7 LED pitch, amber for a stored 1 and steel blue for a 0, threaded by dim copper wires, while a controller visits one ring at a time: half the current runs down its column wire and half along its row wire as two warm white beams, only the ring where they cross flips, the read blanks the ring and a stored 1 answers with a ripple on the sense wire, and the controller writes back the bit of a slowly drifting one-bit picture, so the picture is refreshed ring by ring in raster or random order, rings flip by themselves now and then, and the controller catches each on a later visit with a blue flash.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: coincident-current ferrite core memory (An Wang and Way-Dong Woo, then Jay Forrester at MIT in 1951 and Jan Rajchman at RCA, all from memory), pattern round 236
// Round:   236
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Clock=1.2..3, Density=-1..1, Noise=0..1
//
// Knob 1: Hue. Turns the whole palette round the wheel together. At 0 a stored 1 is amber, a 0 is steel blue, the wires are copper, the beams warm white and the corrected ring flashes blue; at 0.5 the amber is blue and the steel is pale peach, lifted so that it does not read brown, and at 0.25 green on violet.
// Knob 2: Clock. Memory cycles a second, 3.75 per unit: 4.5 at 1.2, 7.5 at the opening 2 and 11.3 at 3, and the clock wanders by up to 22 percent either way as it goes. A cycle reads one ring and writes it half a cycle later, the read beams entering from the top and the left and the write beams from the bottom and the right, so a pass over the 162 rings takes 36 s at the slowest, 22 s at the opening and 14 s at the fastest. At the slow end a ring that held a 1 can be seen to dip toward steel blue between the read and the write.
// Knob 3: Density. The share of rings that hold a 1 in the picture the controller writes, 20 percent at -1, 50 percent at the opening 0 and 80 percent at 1; the picture is one drifting field cut at a different level. Only visited rings change, so when the knob moves the controller drops its sweep and rewrites the rings that now disagree, in random order, 34 cycles for every 0.12 of travel and at most 120.
// Knob 4: Noise. How often a ring flips by itself: never at 0, 0.24 a second at the opening 0.06, 1.3 at 0.5 and 2.3 at 1, each flip a pale glint. A flipped ring stays wrong until the sweep comes back to it, 11 s later on average at the opening clock, and then the controller sees that it is not what it last wrote and flashes it blue as it corrects it.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, round, exp, hypot, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The plane: rings on a 7 LED pitch, 9 across and 18 down. A ring is 5 by 5 LED
// centred on the pixel (3 + 7 i, 4 + 7 j), so its hole is the pixel the wires cross at.
const NC = 9, NR = 18, NCELL = NC * NR, PITCH = 7;
const cxOf = (i) => 3 + PITCH * i;
const cyOf = (j) => 4 + PITCH * j;

// Ring shape over the 7 by 7 block of a cell: a donut of 5 by 5 LED, hole dark,
// and a halo that lives in the two LED gap round it.
const SHAPE = new Float32Array(49), HALO = new Float32Array(49);
const BY_D2 = { 0: 0, 1: 0, 2: 0.7, 4: 1, 5: 0.95, 8: 0.1 };
for (let dy = -3; dy <= 3; dy++)
  for (let dx = -3; dx <= 3; dx++) {
    const r = hypot(dx, dy), k = (dy + 3) * 7 + dx + 3;
    SHAPE[k] = max(dx, -dx) <= 2 && max(dy, -dy) <= 2 ? BY_D2[dx * dx + dy * dy] : 0;
    HALO[k] = exp(-(((r - 3.1) / 1.3) ** 2));
  }

const RATE_PER_KNOB = 3.75;   // memory cycles a second per unit of Clock
const WIRE_V = 0.38;          // brightness of the copper wires at rest
const FIELD_SPEED = 0.55;     // how fast the picture drifts, against the clock of its constants below
const DIRTY_CYCLES = 34;      // catch-up cycles each time Density has moved by 0.12
const DIRTY_MAX = 120;        // and the most that can be owed

// ---- the picture the memory is asked to hold -------------------------------

function hash3(ix, iy, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, z) {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
  const x0 = a + (b - a) * ux, x1 = c + (d - c) * ux, x2 = e + (f - e) * ux, x3 = g + (h - g) * ux;
  const y0 = x0 + (x1 - x0) * uy, y1 = x2 + (x3 - x2) * uy;
  return y0 + (y1 - y0) * uz;
}

// Four blobs on their own slow paths, none of the periods a multiple of another, each with its
// own size, shape and weight. Three octaves of value noise and three travelling sines make the texture they sit in.
const BLOBS = [
  { cx: 4.0, cy: 4.5, ax: 3.3, ay: 3.4, wx: 0.053, wy: 0.081, sx: 1.5, sy: 2.2, amp: 0.95, wz: 0.037 },
  { cx: 4.0, cy: 9.0, ax: 3.6, ay: 5.0, wx: 0.077, wy: 0.047, sx: 2.2, sy: 1.4, amp: 0.8, wz: 0.059 },
  { cx: 4.0, cy: 13.5, ax: 3.4, ay: 3.6, wx: 0.061, wy: 0.093, sx: 1.7, sy: 2.4, amp: 0.9, wz: 0.043 },
  { cx: 4.0, cy: 9.0, ax: 3.9, ay: 7.2, wx: 0.043, wy: 0.067, sx: 1.2, sy: 1.2, amp: 0.7, wz: 0.071 },
];

function computeField(st, t) {
  const T = (t + st.tf) * FIELD_SPEED, f = st.fld, ph = st.ph;
  for (let j = 0; j < NR; j++)
    for (let i = 0; i < NC; i++) {
      const x = i, y = j;
      let v = 0.55 * (vnoise(x * 0.45 + 0.06 * T, y * 0.45 - 0.045 * T, T * 0.043 + 11.3) * 2 - 1);
      v += 0.5 * (vnoise(x * 1.0 - 0.05 * T + 40, y * 1.0 + 0.07 * T, T * 0.071 + 90) * 2 - 1);
      v += 0.2 * (vnoise(x * 1.9 + 0.09 * T + 7, y * 1.9 - 0.04 * T + 3, T * 0.113 + 30) * 2 - 1);
      v += 0.3 * (sin(1.3 * x + 0.4 * y + 0.137 * T + ph[0]) + sin(-0.5 * x + 1.1 * y + 0.0953 * T + ph[1]) + sin(0.9 * x - 0.9 * y - 0.171 * T + ph[2]));
      for (let b = 0; b < 4; b++) {
        const o = BLOBS[b], p = ph[3 + b * 4];
        const bx = o.cx + o.ax * sin(o.wx * T + p), by = o.cy + o.ay * sin(o.wy * T + ph[4 + b * 4]);
        const sx = o.sx * (1 + 0.22 * sin(o.wz * T + ph[5 + b * 4])), sy = o.sy * (1 + 0.22 * sin(o.wz * 1.31 * T + ph[6 + b * 4]));
        const dx = (x - bx) / sx, dy = (y - by) / sy;
        v += o.amp * (1 + 0.2 * sin(o.wz * 1.7 * T + p)) * exp(-0.5 * (dx * dx + dy * dy));
      }
      f[j * NC + i] = v;
    }
}

// The bit picture at time t, with exactly the asked share of ones: the field cut at its own quantile.
function computeTarget(st, t) {
  computeField(st, t);
  st.srt.set(st.fld);
  st.srt.sort();
  const th = st.srt[cl(round((1 - st.share) * NCELL), 0, NCELL - 1)];
  for (let c = 0; c < NCELL; c++) st.tgt[c] = st.fld[c] >= th ? 1 : 0;
}

// ---- the controller --------------------------------------------------------

export function setup(params) {
  const ph = new Float64Array(24);
  for (let i = 0; i < ph.length; i++) ph[i] = Math.random() * 2 * PI;
  params.st = {
    k: [0, 2, 0, 0.06], t: 0, tf: Math.random() * 500, init: false, ph,
    mem: new Uint8Array(NCELL), shadow: new Uint8Array(NCELL), tgt: new Uint8Array(NCELL), pend: new Uint8Array(NCELL),
    disp: new Float32Array(NCELL), heat: new Float32Array(NCELL), glint: new Float32Array(NCELL),
    err: new Float32Array(NCELL), age: new Float32Array(NCELL), busy: new Float64Array(NCELL),
    ev: [], rip: [],
    tc: 0, order: new Int16Array(NCELL), olen: 0, opos: 0, mode: -1, lastMode: -1, repeat: 0,
    rate: 7.5, lam: 0.2, share: 0.5, k3ref: 0, dirty: 0,
    fld: new Float64Array(NCELL), srt: new Float64Array(NCELL),
    bw: Float32Array.from({ length: NCELL }, () => 0.35 + 0.8 * Math.random()), bp: Float32Array.from({ length: NCELL }, () => 2 * PI * Math.random()),
    R: new Float32Array(NPX), G: new Float32Array(NPX), B: new Float32Array(NPX),
    pal: new Float32Array(18),
  };
}

function setKnobs(st, kv) {
  const k0 = cl(kv[0], 0, 1), k1 = cl(kv[1], 1.2, 3), k2 = cl(kv[2], -1, 1), k3 = cl(kv[3], 0, 1);
  st.k = [k0, k1, k2, k3];
  st.rate = RATE_PER_KNOB * k1;
  st.share = 0.5 + 0.3 * k2;
  st.lam = 2.3 * k3 ** 0.8;
  if (st.init && Math.abs(k2 - st.k3ref) > 0.12) {
    st.dirty = min(DIRTY_MAX, st.dirty + round((DIRTY_CYCLES * Math.abs(k2 - st.k3ref)) / 0.12));
    st.k3ref = k2;
  }
}

// The order a pass takes over the plane. It sweeps the rows, or the rows back and forth, or the columns, or hops about at random.
function newPass(st) {
  const r = Math.random();
  let mode = r < 0.34 ? 0 : r < 0.54 ? 1 : r < 0.74 ? 2 : 3;
  if (mode === st.lastMode && st.repeat >= 1) mode = (mode + 1 + floor(Math.random() * 3)) % 4;
  st.repeat = mode === st.lastMode ? st.repeat + 1 : 0;
  st.lastMode = st.mode = mode;
  const o = st.order, rev = Math.random() < 0.5;
  let n = 0;
  if (mode === 0 || mode === 1) {
    for (let jj = 0; jj < NR; jj++) {
      const j = rev ? NR - 1 - jj : jj;
      const back = mode === 1 && jj % 2 === 1;
      for (let ii = 0; ii < NC; ii++) o[n++] = j * NC + (back ? NC - 1 - ii : ii);
    }
  } else if (mode === 2) {
    for (let ii = 0; ii < NC; ii++) {
      const i = rev ? NC - 1 - ii : ii;
      for (let jj = 0; jj < NR; jj++) o[n++] = jj * NC + i;
    }
  } else {
    for (let c = 0; c < NCELL; c++) o[c] = c;
    for (let c = NCELL - 1; c > 0; c--) {
      const q = floor(Math.random() * (c + 1)), v = o[c];
      o[c] = o[q];
      o[q] = v;
    }
    n = NCELL >> 1;
  }
  // A raster pass starts part of the way along, and wraps round.
  if (mode < 3) {
    const off = floor(Math.random() * NCELL), tmp = st.srt;
    for (let c = 0; c < NCELL; c++) tmp[c] = o[(c + off) % NCELL];
    for (let c = 0; c < NCELL; c++) o[c] = tmp[c];
  }
  st.olen = n;
  st.opos = 0;
}

function startCycle(st) {
  // The clock wanders by up to 22 percent either way, so a pass never takes quite the same time twice.
  const tc = st.tc, T = 1 / (st.rate * (1 + 0.14 * sin(0.23 * tc + st.ph[20]) + 0.08 * sin(0.61 * tc + st.ph[21])));
  computeTarget(st, tc);
  let c = -1;
  if (st.dirty > 0) {
    let n = 0;
    for (let q = 0; q < NCELL; q++) if (st.mem[q] !== st.tgt[q] && st.busy[q] < tc) n++;
    if (n === 0) st.dirty = 0;
    else {
      let pick = floor(Math.random() * n);
      for (let q = 0; q < NCELL; q++)
        if (st.mem[q] !== st.tgt[q] && st.busy[q] < tc && pick-- === 0) {
          c = q;
          break;
        }
      st.dirty--;
    }
  }
  if (c < 0) {
    if (st.opos >= st.olen) newPass(st);
    c = st.order[st.opos++];
  }
  // The beams run in over run seconds and the lines then fade over tg.
  const run = 0.22 * T, tg = cl(0.9 * T, 0.07, 0.3), life = run + 4 * tg, bit = st.tgt[c];
  st.busy[c] = tc + T;
  // No two cycles drive the same current: the beams differ in strength, in how far they carry and in how
  // much is left at the far end.
  const mk = (t0, kind) => ({ t0, c, kind, run, tg, life, fired: false, bit, amp: 0.7 + 0.3 * Math.random(), near: 7 + 14 * Math.random(), far: 0.1 + 0.22 * Math.random() });
  st.ev.push(mk(tc, 0));
  st.ev.push(mk(tc + 0.5 * T, 1));
  st.tc = tc + T;
}

function fire(st, e) {
  const c = e.c;
  if (e.kind === 0) {
    // The read: the ring is driven to 0 whatever it held, and a 1 answers on the sense wire.
    const old = st.mem[c];
    st.pend[c] = old !== st.shadow[c] ? 1 : 0;
    st.heat[c] = 1;
    st.mem[c] = 0;
    if (old === 1) st.rip.push({ t0: st.t, c });
  } else {
    // The write: the controller puts back the bit the picture has now.
    st.mem[c] = e.bit;
    st.shadow[c] = e.bit;
    st.heat[c] = 1;
    st.age[c] = 0;
    if (st.pend[c]) st.err[c] = 1;
    st.pend[c] = 0;
  }
}

function step(st, d) {
  st.t += d;
  const t = st.t;
  const dHeat = exp(-d / 0.17), dGlint = exp(-d / 0.12), dErr = exp(-d / 0.2), follow = 1 - exp(-d * 22);
  for (let c = 0; c < NCELL; c++) {
    st.heat[c] *= dHeat;
    st.glint[c] *= dGlint;
    st.err[c] *= dErr;
    st.age[c] += d;
    st.disp[c] += (st.mem[c] - st.disp[c]) * follow;
  }
  // Thermal flips, one ring at a time, not in a ring that is in the middle of a cycle.
  if (st.lam > 0) {
    let p = st.lam * d;
    while (p > 0) {
      if (Math.random() < min(1, p)) {
        const c = floor(Math.random() * NCELL);
        if (st.busy[c] < t) {
          st.mem[c] ^= 1;
          st.glint[c] = 1;
        }
      }
      p -= 1;
    }
  }
  let guard = 0;
  while (st.tc <= t && guard++ < 8) startCycle(st);
  const ev = st.ev;
  for (let q = 0; q < ev.length; q++) {
    const e = ev[q];
    if (!e.fired && t >= e.t0 + e.run) {
      e.fired = true;
      fire(st, e);
    }
  }
  while (ev.length && t - ev[0].t0 > ev[0].life + 0.3) ev.shift();
  const rp = st.rip;
  while (rp.length && t - rp[0].t0 > 0.5) rp.shift();
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = input.knobValues || [0, 2, 0, 0.06];
  setKnobs(st, kv);
  if (!st.init) {
    st.init = true;
    st.k3ref = st.k[2];
    computeTarget(st, 0);
    for (let c = 0; c < NCELL; c++) {
      st.mem[c] = st.shadow[c] = st.tgt[c];
      st.disp[c] = st.mem[c];
      st.age[c] = 40;
    }
    newPass(st);
    // A sweep and a third before the first frame, so the rings already lag the picture by
    // the amount they would, and the flips and the corrections of this Noise are in place.
    const secs = cl((1.35 * NCELL) / st.rate, 30, 150);
    for (let n = 0, m = round(secs * 30); n < m; n++) step(st, 1 / 30);
  }
  const d = cl(dt || 0, 0, 0.1);
  if (d > 0) step(st, d);
}

// ---- drawing ---------------------------------------------------------------

// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so the steel is lifted there.
const warm = (h) => {
  const f = frac(h), d = f < 0.5 ? f : 1 - f;
  return 1 - sstep(0.1, 0.2, d);
};

function palette(st, hue) {
  const p = st.pal, w = warm(0.57 + hue);
  hsv(0.12 + hue, 0.9, 1.0, p, 0);                                   // amber, a stored 1
  hsv(0.57 + hue, 0.42 - 0.12 * w, 0.62 + 0.26 * w, p, 3);           // steel, a stored 0
  hsv(0.06 + hue, 0.75, WIRE_V, p, 6);                               // copper wire
  hsv(0.075 + hue, 0.32, 1.0, p, 9);                                 // beam, warm white
  hsv(0.62 + hue, 0.85, 1.0, p, 12);                                 // corrected ring, blue
  hsv(0.12 + hue, 0.45, 1.0, p, 15);                                 // sense ripple
}

function addLine(st, vertical, fixed, lo, hi, amp, e, a, p, S, sc) {
  // fixed is the pixel column (vertical) or row of the wire; lo..hi the pixels along it.
  const { R, G, B } = st, br = p[9], bg = p[10], bb = p[11];
  const head = a < e.run ? (a / e.run) * sc : sc + 1e9;
  const fade = a < e.run ? 1 : exp(-(a - e.run) / e.tg);
  for (let s = lo; s <= hi; s++) {
    let v;
    if (a < e.run) {
      if (s > head) continue;
      v = e.far + (1 - e.far) * exp(-(head - s) / 7);
    } else v = fade * (e.far + (1 - e.far) * exp(-Math.abs(s - sc) / e.near));
    v *= amp * e.amp;
    if (v < 0.01) continue;
    const pos = e.kind === 0 ? s : S - s;
    for (let w = -1; w <= 1; w++) {
      const k = w === 0 ? 1 : 0.28, f = fixed + w;
      if (f < 0 || f >= (vertical ? W : H)) continue;
      const o = vertical ? pos * W + f : f * W + pos;
      R[o] += br * v * k;
      G[o] += bg * v * k;
      B[o] += bb * v * k;
    }
  }
}

export function draw(display, params) {
  const st = params.st, hue = st.k[0], t = st.t;
  const { R, G, B, pal: p } = st;
  R.fill(0); G.fill(0); B.fill(0);
  palette(st, hue);

  // The wires: columns run the whole height, rows the whole width, each with a faint pulse running along it.
  for (let i = 0; i < NC; i++) {
    const x = cxOf(i);
    for (let y = 0; y < H; y++) {
      const v = 0.82 + 0.18 * sin(0.31 * y + 1.9 * t + i * 1.3), o = y * W + x;
      R[o] += p[6] * v; G[o] += p[7] * v; B[o] += p[8] * v;
    }
  }
  for (let j = 0; j < NR; j++) {
    const y = cyOf(j);
    for (let x = 0; x < W; x++) {
      const v = 0.82 + 0.18 * sin(0.37 * x - 1.6 * t + j * 0.9), o = y * W + x;
      R[o] += p[6] * v; G[o] += p[7] * v; B[o] += p[8] * v;
    }
  }

  // The rings.
  for (let c = 0; c < NCELL; c++) {
    const i = c % NC, j = (c / NC) | 0, bx = cxOf(i) - 3, by = cyOf(j) - 3;
    const d = st.disp[c], h = st.heat[c], g = st.glint[c], e = st.err[c];
    const ag = exp(-st.age[c] / 16);
    // Each ring shimmers on a period of its own, 5 to 18 s, the steel ones the most.
    const sh = 0.5 + 0.5 * sin(st.bw[c] * t + st.bp[c]);
    const va = (0.8 + 0.2 * ag) * (1 - 0.14 * sh), vs = (0.76 + 0.24 * ag) * (1 - 0.34 * sh);
    let r = (p[3] * vs) + (p[0] * va - p[3] * vs) * d;
    let gg = (p[4] * vs) + (p[1] * va - p[4] * vs) * d;
    let b = (p[5] * vs) + (p[2] * va - p[5] * vs) * d;
    const wm = min(1, 0.85 * h + 0.6 * g);
    r += (p[9] - r) * wm; gg += (p[10] - gg) * wm; b += (p[11] - b) * wm;
    const em = min(1, e * 1.1);
    r += (p[12] - r) * em; gg += (p[13] - gg) * em; b += (p[14] - b) * em;
    const gain = 1 + 0.35 * h;
    const hl = 0.55 * h + 0.25 * g + 0.8 * e;
    const hr = p[9] + (p[12] - p[9]) * em, hg = p[10] + (p[13] - p[10]) * em, hb = p[11] + (p[14] - p[11]) * em;
    for (let dy = 0; dy < 7; dy++) {
      const y = by + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = 0; dx < 7; dx++) {
        const x = bx + dx;
        if (x < 0 || x >= W) continue;
        const k = dy * 7 + dx, s = SHAPE[k] * gain, o = y * W + x, hh = HALO[k] * hl;
        R[o] += r * s + hr * hh; G[o] += gg * s + hg * hh; B[o] += b * s + hb * hh;
      }
    }
  }

  // The beams of every cycle still in view.
  for (const e of st.ev) {
    const a = t - e.t0;
    if (a < 0 || a > e.life) continue;
    const i = e.c % NC, j = (e.c / NC) | 0, x0 = cxOf(i), y0 = cyOf(j);
    const sv = e.kind === 0 ? y0 : H - 1 - y0, sh = e.kind === 0 ? x0 : W - 1 - x0;
    addLine(st, true, x0, 0, H - 1, 0.85, e, a, p, H - 1, sv);
    addLine(st, false, y0, 0, W - 1, 0.85, e, a, p, W - 1, sh);
  }

  // The sense wire's answer: a ripple running out from the ring that held a 1.
  for (const q of st.rip) {
    const a = t - q.t0;
    if (a < 0) continue;
    const r0 = 2.6 + 22 * a, amp = 0.8 * exp(-a / 0.13);
    if (amp < 0.02) continue;
    const cx = cxOf(q.c % NC), cy = cyOf((q.c / NC) | 0), rr = ceil(r0 + 3);
    for (let y = max(0, cy - rr); y <= min(H - 1, cy + rr); y++)
      for (let x = max(0, cx - rr); x <= min(W - 1, cx + rr); x++) {
        const dd = hypot(x - cx, y - cy) - r0, v = amp * exp(-(dd * dd) / 1.4), o = y * W + x;
        R[o] += p[15] * v; G[o] += p[16] * v; B[o] += p[17] * v;
      }
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      let r = R[o], g = G[o], b = B[o];
      const m = max(r, g, b);
      if (m > 1) { r /= m; g /= m; b /= m; }
      display.setPixel(x, y, round(r * 255), round(g * 255), round(b * 255));
    }
}
