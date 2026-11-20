// ===== Patternflow pattern =====
// Title:   Barchan Field
// Family:  desert
// Idea:    A field of crescent dunes seen from above crawls down a rust-brown plain in a one-way wind, each a pale windward ramp under a low sun with a bright crest line and a dark slip face on the lee side, the small ones running faster than the big ones until a small dune climbs into a big one and is absorbed, and a dune grown too big sheds a new small one from its horn.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: barchan dune dynamics, after Ralph Bagnold (1941) and the collisions of Hersen and Douady (2005)
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0..3, Heading=-75..75, Size=-1..1
//
// Knob 1: Hue. The colour of the sand, warm gold where the knob opens; turned round it goes through green and a pale blue-grey (a Martian dune on rust) to pink and back towards red, and the ground and the shadows follow.
// Knob 2: Wind. How fast the dunes travel; a dune of 22 LEDs moves 1.6 LEDs a second where the knob opens and 2.4 at the top, a small one faster and a big one slower, and at the bottom they stand still.
// Knob 3: Heading. Which way the wind blows, in degrees from straight down: 75 to the left at the bottom of the knob, straight down where it opens, 75 to the right at the top. The horns of every dune swing round at once and the dunes travel that way.
// Knob 4: Size. The scale of the dunes, from 0.7 at the bottom (more, narrower dunes) through 1 where the knob opens to 1.4 at the top (fewer, wider ones); a bigger dune is slower.

const W = 64;
const H = 128;

// The dune that travels at the reference speed is this wide, in LEDs, and its speed at Wind 1 is SPEED LEDs a second.
// Speed goes as 1 / width, but a dune narrower than LSPD LEDs travels as fast as one that wide, so a growing or melting dune does not race away.
const LREF = 22;
const SPEED = 0.8;
const LSPD = 8;
// The shape, in widths of the dune. The windward ramp climbs over RAMP, the horns trail TAIL behind the crest, the slip face drops over SLIP (never less than SLIPMIN LEDs, so it stays a band you can see), and the crest stands HEIGHT tall.
const RAMP = 0.52;
const TAIL = 0.4;
const SLIP = 0.16;
const SLIPMIN = 2.8;
const HEIGHT = 0.2;
// The share of the panel's area that the dunes on and near it keep covered, between these two.
const COVER_LO = 0.3;
const COVER_HI = 0.4;
// Whatever their size, at least this many dunes are kept on or near the panel.
const MIN_NEAR = 6;
// A dune of more than this mass (mass is width cubed over LREF cubed) sheds a third of itself from a horn.
const MASS_LIMIT = 2.5;
// Seconds a merge takes, and a shed.
const MELT = 1.8;
const BUD = 2.8;
// The wind ripples on the windward face: wavelength in LEDs and height, and how fast they climb, in waves a second at Wind 1.
const RIP_WAVE = 4.8;
const RIP_HEIGHT = 0.16;
const RIP_RATE = 0.05;
// The low sun, above the horizon by this much.
const SUN_LZ = Math.sin(0.5);
const SUN_LC = Math.cos(0.5);
// The first look: how many seconds of dunes are run before the panel opens.
const PRE = 120;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function setup(params) {
  params.t = 0;
  params.started = false;
  params.dunes = [];
  params.xfer = [];
  params.nextSpawn = 0;
  params.rt = 0;
  params.windS = 2;
  params.headS = 0;
  params.sizeS = 1;
  params.wx = 0;
  params.wy = 1;
  params.cx = 1;
  params.cy = 0;
  params.smin = 0;
  params.smax = 0;
  params.tmin = 0;
  params.tmax = 0;
  params.gx = new Float32Array((W + 1) * H);
  params.gy = new Float32Array(W * (H + 1));
  params.cr = new Float32Array(W * H);
  params.col = new Float32Array(15);
  params.box = new Float32Array(4);
  params.sun = new Float32Array(3);
  params.kn = { hue: 0, wind: 2, head: 0, size: 1 };
}

// What the four knobs say, in the units the dunes use.
function readKnobs(k, kn) {
  kn.hue = k[0];
  kn.wind = clamp(k[1], 0, 3);
  kn.head = (clamp(k[2], -75, 75) * Math.PI) / 180;
  kn.size = Math.pow(2, 0.5 * clamp(k[3], -1, 1));
}

// Width, height and the lengths of each dune at the size the knob gives now.
function geom(params) {
  const sz = params.sizeS;
  for (const d of params.dunes) {
    const L = sz * LREF * Math.cbrt(Math.max(d.m, 0));
    d.L = L;
    d.ib = L > 0.5 ? 2 / L : 4;
    d.k = TAIL * L;
    d.lw = RAMP * L;
    d.ls = Math.max(SLIP * L, SLIPMIN);
    // A dune melting away or just born is a low bump long before it is gone, so nothing blinks out.
    d.H0 = HEIGHT * L * smooth(1.5, 7, L) * d.life;
    d.rA = RIP_HEIGHT * smooth(10, 20, L) * d.life;
  }
}

// The box a dune can touch, in LEDs, as x0, y0, x1, y1 (not clipped to the panel).
function boxOf(d, p, out) {
  const u0 = -d.lw - 2;
  const u1 = d.k + d.ls + 2;
  const ve = 0.5 * d.L + 2;
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  for (let i = 0; i < 4; i++) {
    const u = i & 1 ? u1 : u0;
    const v = i & 2 ? ve : -ve;
    const x = d.x + u * p.wx + v * p.cx;
    const y = d.y + u * p.wy + v * p.cy;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  out[0] = x0;
  out[1] = y0;
  out[2] = x1;
  out[3] = y1;
}

// The panel's reach along the wind (s) and across it (t), for placing and removing dunes.
function reach(params) {
  const { wx, wy, cx, cy } = params;
  let smin = 1e9;
  let smax = -1e9;
  let tmin = 1e9;
  let tmax = -1e9;
  for (let i = 0; i < 4; i++) {
    const x = i & 1 ? W : 0;
    const y = i & 2 ? H : 0;
    const s = x * wx + y * wy;
    const t = x * cx + y * cy;
    if (s < smin) smin = s;
    if (s > smax) smax = s;
    if (t < tmin) tmin = t;
    if (t > tmax) tmax = t;
  }
  params.smin = smin;
  params.smax = smax;
  params.tmin = tmin;
  params.tmax = tmax;
}

function newDune(x, y, m) {
  return {
    x,
    y,
    m,
    spd: 0,
    melt: false,
    dead: false,
    inc: 0,
    busy: 0,
    shedAt: -1,
    life: 1,
    ph: Math.random() * 6.283,
    L: 0,
    ib: 4,
    k: 0,
    lw: 0,
    ls: 0,
    H0: 0,
    rA: 0,
  };
}

function widthToMass(w) {
  const r = w / LREF;
  return r * r * r;
}

// The dunes at the opening, scattered over the panel and the margins round it.
function seed(params) {
  const sz = params.sizeS;
  for (let n = 0; n < 8; n++) {
    const w = 12 + 22 * Math.pow(Math.random(), 1.1);
    const d = newDune(0, 0, widthToMass(w));
    const Le = sz * w;
    let best = -1e9;
    for (let tries = 0; tries < 60; tries++) {
      const x = -6 + Math.random() * 76;
      const y = -10 + Math.random() * 148;
      let clear = 1e9;
      for (const o of params.dunes) {
        const dd = Math.hypot(x - o.x, y - o.y) - 0.62 * (Le + sz * LREF * Math.cbrt(o.m));
        if (dd < clear) clear = dd;
      }
      if (clear > best) {
        best = clear;
        d.x = x;
        d.y = y;
      }
      if (clear > 0) break;
    }
    params.dunes.push(d);
  }
}

// A new dune just upwind of the panel, its whole footprint at least half its width clear of the panel edge, at the point along the spawn line with the widest gap of a dozen tries. The dune is set back along the wind from the middle of the panel until its box clears the panel, so on a slanted wind it comes in from the nearest edge, not from a far corner.
function spawn(params) {
  const sz = params.sizeS;
  const { wx, wy, cx, cy } = params;
  const w = 10 + 20 * Math.pow(Math.random(), 1.2);
  const Le = sz * w;
  const probe = newDune(0, 0, widthToMass(w));
  probe.L = Le;
  probe.k = TAIL * Le;
  probe.lw = RAMP * Le;
  probe.ls = Math.max(SLIP * Le, SLIPMIN);
  const gap = 0.5 * Le;
  const b = params.box;
  const smid = 0.5 * (params.smin + params.smax);
  let bestX = 0;
  let bestY = 0;
  let best = -1e9;
  for (let n = 0; n < 12; n++) {
    const t = params.tmin - 0.15 * Le + Math.random() * (params.tmax - params.tmin + 0.3 * Le);
    let s = smid;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 200; i++) {
      x = wx * s + cx * t;
      y = wy * s + cy * t;
      probe.x = x;
      probe.y = y;
      boxOf(probe, params, b);
      if (b[2] < -gap || b[0] > W + gap || b[3] < -gap || b[1] > H + gap) break;
      s -= 2;
    }
    let clear = 1e9;
    for (const o of params.dunes) {
      const dd = Math.hypot(x - o.x, y - o.y) - 0.62 * (Le + o.L);
      if (dd < clear) clear = dd;
    }
    if (clear > best) {
      best = clear;
      bestX = x;
      bestY = y;
    }
  }
  if (best <= 0) return false;
  const d = newDune(bestX, bestY, widthToMass(w));
  d.L = Le;
  params.dunes.push(d);
  return true;
}

function transfer(params, from, to, total, T) {
  params.xfer.push({ from, to, total, T, e: 0, p: 0, melt: from.melt });
  to.inc++;
}

// How many dunes have their body (a little behind the crest apex, along the wind) on the panel.
function visibleCount(params) {
  let n = 0;
  for (const d of params.dunes) {
    const x = d.x - 0.25 * d.L * params.wx;
    const y = d.y - 0.25 * d.L * params.wy;
    if (x > 0 && x < W && y > 0 && y < H) n++;
  }
  return n;
}

// One step of the field: the dunes move, merge, shed, leave and arrive.
function step(params, dt) {
  const kn = params.kn;
  params.t += dt;
  const t = params.t;
  const a = 1 - Math.exp(-dt / 0.45);
  params.windS += (kn.wind - params.windS) * a;
  params.headS += (kn.head - params.headS) * a;
  params.sizeS += (kn.size - params.sizeS) * (1 - Math.exp(-dt / 0.6));
  const th = params.headS;
  params.wx = Math.sin(th);
  params.wy = Math.cos(th);
  params.cx = Math.cos(th);
  params.cy = -Math.sin(th);
  params.rt += dt * RIP_RATE * params.windS;
  reach(params);
  geom(params);
  const dunes = params.dunes;
  const { wx, wy, cx, cy } = params;
  const ws = params.windS;

  // Travel: speed is the wind over the width, so the small run ahead of the big.
  for (const d of dunes) {
    if (!d.melt) d.spd = (SPEED * ws * LREF) / Math.max(d.L, LSPD);
    d.x += wx * d.spd * dt;
    d.y += wy * d.spd * dt;
  }

  // Mass moves between dunes over a second or two, the width following the cube root, so nothing pops.
  const xf = params.xfer;
  for (let i = xf.length - 1; i >= 0; i--) {
    const x = xf[i];
    x.e += dt;
    const p = smooth(0, 1, x.e / x.T);
    const dm = x.total * (p - x.p);
    x.p = p;
    x.from.m = Math.max(0, x.from.m - dm);
    x.to.m += dm;
    // The dune that is melting away flattens as it goes, and the one being born rises, so neither is ever a steep bump a few LEDs wide.
    if (x.melt) x.from.life = smooth(0, 0.6, 1 - p);
    else x.to.life = smooth(0, 0.6, p);
    if (x.e >= x.T) {
      x.to.inc--;
      if (x.melt) x.from.dead = true;
      else x.from.busy--;
      xf.splice(i, 1);
    }
  }

  // A small dune whose crest has reached the windward ramp of a bigger one runs into it and melts in.
  for (const s of dunes) {
    if (s.melt || s.dead || s.inc > 0 || s.busy > 0 || s.m < 0.01) continue;
    let target = null;
    for (const b of dunes) {
      if (b === s || b.melt || b.dead || b.m <= s.m) continue;
      const ex = b.x - s.x;
      const ey = b.y - s.y;
      const du = ex * wx + ey * wy;
      const dv = Math.abs(ex * cx + ey * cy);
      if (du > -0.05 * b.L && du < 0.42 * b.lw + 0.1 * s.L && dv < 0.4 * b.L + 0.2 * s.L) {
        if (!target || b.m > target.m) target = b;
      }
    }
    if (target) {
      s.melt = true;
      transfer(params, s, target, s.m, MELT);
    }
  }

  // A dune grown past the limit sheds a third of itself, a few seconds on, from one horn.
  for (const d of dunes) {
    if (d.melt || d.dead || d.inc > 0 || d.busy > 0) {
      d.shedAt = -1;
      continue;
    }
    if (d.m > MASS_LIMIT) {
      if (d.shedAt < 0) d.shedAt = t + 3 + 2.5 * Math.random();
      else if (t >= d.shedAt) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const q = 0.78 * side;
        const u = d.k * q * q + 0.06 * d.L;
        const v = q * 0.5 * d.L;
        const n = newDune(d.x + u * wx + v * cx, d.y + u * wy + v * cy, 0);
        params.dunes.push(n);
        d.busy++;
        d.shedAt = -1;
        transfer(params, d, n, d.m * 0.34, BUD);
      }
    } else d.shedAt = -1;
  }

  // Dunes that have left the panel downwind, or sit where the wind will never bring them in, go.
  const b = params.box;
  const smid = 0.5 * (params.smin + params.smax);
  for (const d of dunes) {
    if (d.melt || d.inc > 0 || d.busy > 0) continue;
    boxOf(d, params, b);
    if (b[2] < -3 || b[0] > W + 3 || b[3] < -3 || b[1] > H + 3) {
      const s = d.x * wx + d.y * wy;
      const tt = d.x * cx + d.y * cy;
      if (s > smid || tt < params.tmin - 0.7 * d.L - 10 || tt > params.tmax + 0.7 * d.L + 10) d.dead = true;
    }
  }
  for (let i = dunes.length - 1; i >= 0; i--) if (dunes[i].dead && dunes[i].inc === 0) dunes.splice(i, 1);

  // New small dunes come in from upwind where there is a gap. Dunes on or near the panel together cover between a quarter and a third of it, a crescent being about half its width squared, with at most two waiting upwind.
  let near = 0;
  let count = 0;
  let wait = 0;
  let incoming = 0;
  for (const d of dunes) {
    if (d.melt) continue;
    const x = d.x - 0.25 * d.L * wx;
    const y = d.y - 0.25 * d.L * wy;
    if (x > -12 && x < W + 12 && y > -12 && y < H + 12) {
      near += 0.5 * d.L * d.L;
      count++;
    } else if (d.x * wx + d.y * wy < smid) {
      wait++;
      incoming += 0.3 * d.L * d.L;
    }
  }
  const lo = COVER_LO * W * H;
  const hi = COVER_HI * W * H;
  if (t >= params.nextSpawn && wait < 3 && (near + incoming < lo || count < MIN_NEAR || (near < hi && Math.random() < dt / 8))) {
    if (spawn(params)) params.nextSpawn = t + (near + incoming < lo || count < MIN_NEAR ? 1.5 + 1.5 * Math.random() : 3 + 2 * Math.random());
    else params.nextSpawn = t + 1;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  readKnobs(k, params.kn);
  if (!params.started) {
    params.started = true;
    params.windS = params.kn.wind;
    params.headS = params.kn.head;
    params.sizeS = params.kn.size;
    const real = params.kn.wind;
    // The field has been blowing for a while: seed it, run it on, and top the panel up if it came out thin.
    params.kn.wind = Math.max(real, 1.6);
    params.windS = params.kn.wind;
    const th = params.headS;
    params.wx = Math.sin(th);
    params.wy = Math.cos(th);
    params.cx = Math.cos(th);
    params.cy = -Math.sin(th);
    reach(params);
    geom(params);
    seed(params);
    geom(params);
    for (let s = 0; s < PRE * 10; s++) step(params, 0.1);
    params.kn.wind = real;
    params.windS = real;
    // Top the panel up where it came out thin: each new dune goes into the emptiest spot of a few tries.
    let guard = 0;
    while (visibleCount(params) < 6 && guard++ < 30) {
      const w = 12 + 20 * Math.random();
      const Le = params.sizeS * w;
      let best = -1e9;
      let bx = 0;
      let by = 0;
      for (let n = 0; n < 40; n++) {
        const x = 4 + Math.random() * 56;
        const y = 4 + Math.random() * 120;
        let clear = 1e9;
        for (const o of params.dunes) {
          const dd = Math.hypot(x - o.x, y - o.y) - 0.62 * (Le + o.L);
          if (dd < clear) clear = dd;
        }
        if (clear > best) {
          best = clear;
          bx = x;
          by = y;
        }
      }
      if (best < -6) break;
      params.dunes.push(newDune(bx, by, widthToMass(w)));
      geom(params);
    }
  }
  step(params, Math.min(dt, 0.1));
}

// The sand's colours at the knob's hue: shadow, ground, lit face and crest, each as r, g, b.
function palette(params) {
  const k = params.kn.hue;
  const col = params.col;
  const lit = 0.105 + 0.93 * k;
  const ground = 0.055 + 0.05 * Math.sin(6.2832 * k);
  const grey = Math.sin(Math.PI * k);
  hsv(ground - 0.03, 0.94, 0.36, col, 0);
  hsv(ground, 0.74, 0.43, col, 3);
  hsv(lit, 0.47 - 0.2 * grey * grey, 1, col, 6);
  hsv(lit + 0.012, 0.26 - 0.1 * grey * grey, 1, col, 9);
}

// The height of one dune at (x, y), on the ramp, the crest and the slip face, with the ripples on the ramp.
function heightAt(d, x, y, p) {
  const dx = x - d.x;
  const dy = y - d.y;
  const q = (dx * p.cx + dy * p.cy) * d.ib;
  const q2 = q * q;
  if (q2 >= 0.9999) return 0;
  const A = Math.sqrt(1 - q2);
  const w = dx * p.wx + dy * p.wy - d.k * q2;
  if (w >= 0) {
    const ls = d.ls * A;
    if (w >= ls) return 0;
    const t = w / ls;
    return d.H0 * A * smooth(0.02, 0.42, A) * (1 - t * t * (3 - 2 * t));
  }
  const lw = d.lw * A;
  if (w <= -lw) return 0;
  const s = 1 + w / lw;
  const tip = smooth(0.02, 0.42, A);
  let h = d.H0 * A * tip * s * Math.sqrt(s);
  if (d.rA > 0 && s > 0.05) {
    const v = q * d.L * 0.5;
    const warp = 1.3 * Math.sin(0.19 * v + d.ph) + 0.8 * Math.sin(0.11 * v - 1.7 * d.ph);
    const am = 0.55 + 0.45 * Math.sin(0.14 * v + 0.9 * w * 0.2 + 2 * d.ph);
    const mask = smooth(0.05, 0.3, s) * (1 - smooth(0.9, 1, s)) * smooth(0.2, 0.55, A);
    h += d.rA * am * mask * Math.sin(6.2832 * (w / RIP_WAVE - p.rt) + warp);
  }
  return h;
}

export function draw(display, params) {
  const { gx, gy, cr, col, dunes, sun } = params;
  gx.fill(0);
  gy.fill(0);
  cr.fill(0);
  const b = params.box;
  for (const d of dunes) {
    if (d.L < 1.5) continue;
    boxOf(d, params, b);
    const x0 = Math.max(0, Math.floor(b[0]));
    const x1 = Math.min(W - 1, Math.ceil(b[2]));
    const y0 = Math.max(0, Math.floor(b[1]));
    const y1 = Math.min(H - 1, Math.ceil(b[3]));
    if (x0 > x1 || y0 > y1) continue;
    for (let y = y0; y <= y1; y++) {
      const row = y * (W + 1);
      for (let x = x0; x <= Math.min(W, x1 + 1); x++) gx[row + x] += heightAt(d, x, y + 0.5, params);
    }
    for (let y = y0; y <= Math.min(H, y1 + 1); y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) gy[row + x] += heightAt(d, x + 0.5, y, params);
    }
    // The crest line, a soft bright band on the windward side of the brink, thinning out along the horns.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - d.x;
        const dy = y + 0.5 - d.y;
        const q = (dx * params.cx + dy * params.cy) * d.ib;
        const q2 = q * q;
        if (q2 >= 0.9999) continue;
        const A = Math.sqrt(1 - q2);
        const w = dx * params.wx + dy * params.wy - d.k * q2 + 0.45;
        if (w > 3 || w < -3) continue;
        const c = Math.exp(-(w * w) / 2.2) * A * smooth(0.05, 0.5, A) * smooth(3, 9, d.L) * d.life;
        const i = y * W + x;
        if (c > cr[i]) cr[i] = c;
      }
    }
  }

  // The sun, low, upwind and a little to the left of the wind, turning with it.
  const phi = 0.5 + 0.85 * params.headS;
  sun[0] = -Math.sin(phi) * SUN_LC;
  sun[1] = -Math.cos(phi) * SUN_LC;
  sun[2] = SUN_LZ;
  const lx = sun[0];
  const ly = sun[1];
  const lz = sun[2];
  palette(params);
  const hi = SUN_LZ + 0.45;
  const t = params.t;
  for (let y = 0; y < H; y++) {
    const rowG = y * (W + 1);
    for (let x = 0; x < W; x++) {
      const hx = gx[rowG + x + 1] - gx[rowG + x];
      const hy = gy[(y + 1) * W + x] - gy[y * W + x];
      let lam = (lz - hx * lx - hy * ly) / Math.sqrt(1 + hx * hx + hy * hy);
      if (lam < 0) lam = 0;
      let r;
      let g;
      let bl;
      if (lam < SUN_LZ) {
        const f = lam / SUN_LZ;
        r = col[0] + (col[3] - col[0]) * f;
        g = col[1] + (col[4] - col[1]) * f;
        bl = col[2] + (col[5] - col[2]) * f;
      } else {
        const f = Math.min(1, (lam - SUN_LZ) / (hi - SUN_LZ));
        r = col[3] + (col[6] - col[3]) * f;
        g = col[4] + (col[7] - col[4]) * f;
        bl = col[5] + (col[8] - col[5]) * f;
      }
      const c = cr[y * W + x];
      if (c > 0) {
        const e = c * 0.85;
        r += (col[9] - r) * e;
        g += (col[10] - g) * e;
        bl += (col[11] - bl) * e;
      }
      // A faint slow tonal drift in the ground.
      const nz =
        0.5 * Math.sin(0.21 * x + 0.13 * y + 0.05 * t) +
        0.3 * Math.sin(-0.17 * x + 0.29 * y - 0.037 * t + 1.3) +
        0.2 * Math.sin(0.31 * x - 0.09 * y + 0.023 * t + 2.6);
      const m = 1 + 0.045 * nz;
      display.setPixel(x, y, clamp(Math.round(r * m), 0, 255), clamp(Math.round(g * m), 0, 255), clamp(Math.round(bl * m), 0, 255));
    }
  }
}
