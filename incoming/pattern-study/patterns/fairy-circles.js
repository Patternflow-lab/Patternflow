// ===== Patternflow pattern =====
// Title:   Fairy Circles
// Family:  dryland
// Idea:    A dry grassland seen from above, round bare discs of sand each ringed by a belt of taller greener grass and spaced almost like a hexagonal lattice, where a new disc opens in the largest gap, an old crowded one fills in from its rim, the neighbours push one another apart a little at a time, and gust fronts sweep ripples of light and dark across the grass.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the fairy circles of the Namib, studied as vegetation self-organisation by competition for water (Norbert Juergens, Science, 2013; Corina Tarnita and colleagues, Nature, 2017)
// Round:   202
// ===============================
// @matrix 64x128
// @knobs Season=0..1, Time=0..4, Size=-1..1, Drought=-1..1
//
// Knob 1: Season. The colour of the whole field, green-gold grass round tan sand where it opens, then dry straw, rust and heather to a cool blue-grey at the top.
// Knob 2: Time. How fast the circles are born, grow, drift apart and fill in: frozen at 0, where only the wind keeps blowing, a new disc about every 4.5 s where it opens, and about every 2 s at the top.
// Knob 3: Size. How wide the bare discs are, 8 LEDs across at the bottom, 13 where it opens and 20 at the top, and with it how many fit: some 37 on the panel down to about 8, the field making room by letting discs close and new ones open.
// Knob 4: Drought. How much grass is left: lush at the bottom, with small bare discs inside thick green belts, parched at the top, with the discs widened almost to touch and the belts thin and pale.

const W = 64;
const H = 128;
// Mean radius of a bare disc where Size opens, LEDs. Seeds open at SEEDR.
const R0 = 6.6;
const SEEDR = 2.0;
// The least grass left between two discs, LEDs.
const BELTMIN = 2.1;
// How far a belt reaches past the edge of its disc, LEDs.
const REACH = 8;
// Drift: LEDs a second per LED of overlap.
const MU = 0.13;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise in -1..1, smooth, over a lattice of whole units.
function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return 2 * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) - 1;
}

function noise1(x, seed) {
  const ix = Math.floor(x);
  let f = x - ix;
  f = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash(ix, seed);
  const b = hash(ix + 1, seed);
  return 2 * (a + (b - a) * f) - 1;
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// The seasons along the Season knob. Each stop: the sand (hue, saturation, value), the grass, the belt of tall grass.
const SEASON = [
  [0.112, 0.34, 1.0, 0.152, 0.8, 0.66, 0.235, 0.72, 0.8],
  [0.085, 0.34, 1.0, 0.1, 0.7, 0.62, 0.15, 0.8, 0.92],
  [0.055, 0.4, 0.96, 0.045, 0.78, 0.52, 0.09, 0.78, 0.88],
  [0.97, 0.28, 0.94, 0.77, 0.5, 0.52, 0.5, 0.55, 0.8],
  [0.575, 0.16, 0.97, 0.53, 0.52, 0.5, 0.45, 0.5, 0.82],
];

function seasonAt(k, out) {
  const c = clamp(k, 0, 1) * (SEASON.length - 1);
  const i = Math.min(SEASON.length - 2, Math.floor(c));
  const f = c - i;
  const a = SEASON[i];
  const b = SEASON[i + 1];
  for (let n = 0; n < 9; n++) {
    if (n % 3 === 0) {
      let d = b[n] - a[n];
      d -= Math.round(d);
      out[n] = a[n] + d * f;
    } else out[n] = a[n] + (b[n] - a[n]) * f;
  }
}

function sizeScale(k) {
  return Math.pow(2, 0.7 * clamp(k, -1, 1));
}

// The gap two discs keep between their edges where the lattice is at rest, LEDs.
function gapOf(sz) {
  return 4.4 + 0.9 * sz;
}

// Centre to centre spacing of the lattice and the number of discs the field holds.
function spacingOf(sz) {
  return 2 * R0 * sz + gapOf(sz);
}

function marginOf(sz) {
  return 0.32 * spacingOf(sz);
}

function targetCount(sz) {
  const s = spacingOf(sz);
  const m = marginOf(sz);
  return (1.02 * (W + 2 * m) * (H + 2 * m)) / (0.866 * s * s);
}

function newCircle(x, y) {
  return {
    x,
    y,
    sp: 0.82 + 0.36 * Math.random(),
    tone: Math.random() * 2 - 1,
    rim: 0.85 + 0.3 * Math.random(),
    bw: 0.14 + 0.1 * Math.random(),
    bp: Math.random() * 6.28,
    nx: Math.random() * 40,
    ny: Math.random() * 40,
    life: 55 + 190 * Math.pow(Math.random(), 1.1),
    tg: 18 + 8 * Math.random(),
    td: 18 + 8 * Math.random(),
    age: 0,
    dd: 0,
    dying: false,
    r: SEEDR,
    cap: 99,
    gap: 99,
  };
}

function fullRadius(c, sz, ds) {
  return R0 * c.sp * sz * ds;
}

// The place with the widest gap to every disc and to the edge of the field, or null where there is no room for a seed.
function widestGap(p, tries) {
  const cs = p.cs;
  const m = marginOf(p.sz);
  let bx = 0;
  let by = 0;
  let bs = -1e9;
  let bg = -1e9;
  for (let k = 0; k < tries; k++) {
    const x = -m + (W + 2 * m) * Math.random();
    const y = -m + (H + 2 * m) * Math.random();
    let g = 1e9;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      const dx = c.x - x;
      const dy = c.y - y;
      const d = Math.sqrt(dx * dx + dy * dy) - (c.dying ? c.r : c.rt);
      if (d < g) g = d;
    }
    const s = g * (0.8 + 0.4 * Math.random());
    if (s > bs) {
      bs = s;
      bg = g;
      bx = x;
      by = y;
    }
  }
  return bg >= SEEDR + BELTMIN + 1.5 ? [bx, by] : null;
}

function targets(p) {
  const ds = 0.8 + 0.4 * p.dr;
  for (const c of p.cs) c.rt = fullRadius(c, p.sz, ds);
}

// The discs' radii follow their goals, held back by the room their neighbours leave.
function radii(p, dt) {
  const cs = p.cs;
  const ds = 0.8 + 0.4 * p.dr;
  const n = cs.length;
  for (let i = 0; i < n; i++) {
    cs[i].cap = 99;
    cs[i].gap = 99;
  }
  for (let i = 0; i < n; i++) {
    const a = cs[i];
    for (let j = i + 1; j < n; j++) {
      const b = cs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx > 40 || dx < -40 || dy > 40 || dy < -40) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ca = d - b.r - BELTMIN;
      const cb = d - a.r - BELTMIN;
      if (ca < a.cap) a.cap = ca;
      if (cb < b.cap) b.cap = cb;
      const g = d - a.r - b.r;
      if (g < a.gap) a.gap = g;
      if (g < b.gap) b.gap = g;
    }
  }
  const k = 1 - Math.exp(-dt * 3);
  for (let i = 0; i < n; i++) {
    const c = cs[i];
    const rf = fullRadius(c, p.sz, ds);
    let goal = SEEDR + (rf - SEEDR) * smooth(0, c.tg, c.age);
    if (c.dying) goal *= 1 - smooth(0, c.td, c.dd);
    // Each disc breathes a little as the soil dries and wets, a few per cent over about half a minute.
    goal *= 1 + 0.045 * Math.sin(c.age * c.bw + c.bp) * smooth(0, c.tg, c.age);
    const tgt = Math.min(goal, Math.max(c.cap, 0.5 * goal));
    c.r += (tgt - c.r) * k;
    c.rt = rf;
  }
}

// Everything that has a pace of its own: ages, drift, births and deaths. dl is the time the circles live through.
function life(p, dl) {
  const cs = p.cs;
  const n = cs.length;
  const sz = p.sz;
  const gap = 1.08 * spacingOf(sz) - 2 * R0 * sz;
  const m = marginOf(sz);
  const fx = new Float32Array(n);
  const fy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = cs[i];
    a.age += dl;
    if (a.dying) a.dd += dl;
    for (let j = i + 1; j < n; j++) {
      const b = cs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lr = a.r + b.r + gap;
      if (dx > lr || dx < -lr || dy > lr || dy < -lr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= lr * lr) continue;
      let d = Math.sqrt(d2);
      let ux;
      let uy;
      if (d < 1e-3) {
        const an = Math.random() * 6.2832;
        ux = Math.cos(an);
        uy = Math.sin(an);
        d = 0;
      } else {
        ux = dx / d;
        uy = dy / d;
      }
      const push = (lr - d) * MU * dl * 0.5;
      fx[i] -= ux * push;
      fy[i] -= uy * push;
      fx[j] += ux * push;
      fy[j] += uy * push;
    }
  }
  const jit = 0.05 * Math.sqrt(dl);
  for (let i = 0; i < n; i++) {
    const c = cs[i];
    let x = c.x + fx[i] + jit * (Math.random() * 2 - 1);
    let y = c.y + fy[i] + jit * (Math.random() * 2 - 1);
    // The panel is a view onto a wider field; a disc that wanders out of the margin is eased back.
    const pull = MU * dl;
    if (x < -m) x += (-m - x) * pull * 3;
    if (x > W + m) x -= (x - W - m) * pull * 3;
    if (y < -m) y += (-m - y) * pull * 3;
    if (y > H + m) y -= (y - H - m) * pull * 3;
    c.x = x;
    c.y = y;
  }
  // Deaths: out of the cs when a disc has closed.
  for (let i = n - 1; i >= 0; i--) if (cs[i].dying && cs[i].dd >= cs[i].td) cs.splice(i, 1);
  let alive = 0;
  for (const c of cs) if (!c.dying) alive++;
  const want = targetCount(sz);
  // Old age, and crowding, start a fill-in.
  for (const c of cs) {
    if (c.dying || c.age < c.tg + 6) continue;
    let h = 0;
    if (c.age > c.life) h += 1 / 5;
    if (c.gap < 2.9) h += 1 / 110;
    if (h > 0 && Math.random() < 1 - Math.exp(-h * dl) && alive > 3) {
      c.dying = true;
      c.dd = 0;
      alive--;
    }
  }
  // Too many for the room: the most crowded ones close, quicker the further over.
  const over = alive - want;
  if (over > 0.7 && Math.random() < 1 - Math.exp(-0.16 * over * dl)) {
    let pick = null;
    for (const c of cs) if (!c.dying && c.age > c.tg && (!pick || c.gap < pick.gap)) pick = c;
    if (pick) {
      pick.dying = true;
      pick.dd = 0;
      pick.td = over > 4 ? 9 : pick.td;
      alive--;
    }
  }
  // Too few: a seed opens in the widest gap.
  const short = want - alive;
  if (short > -0.2 && p.cool <= 0 && Math.random() < 1 - Math.exp((-dl * (short + 0.2)) / 15)) {
    targets(p);
    const at = widestGap(p, 140);
    if (at) {
      const c = newCircle(at[0], at[1]);
      c.rt = fullRadius(c, sz, 0.8 + 0.4 * p.dr);
      cs.push(c);
      p.cool = 0.6;
    }
  }
  if (p.cool > 0) p.cool -= dl;
}

function build(p, rate) {
  const sz = p.sz;
  const cs = [];
  p.cs = cs;
  p.cool = 0;
  const n = Math.round(targetCount(sz));
  targets(p);
  for (let k = 0; k < n; k++) {
    const c = newCircle(0, 0);
    c.rt = fullRadius(c, sz, 0.8 + 0.4 * p.dr);
    c.age = Math.random() * c.life;
    c.r = c.rt;
    const at = widestGap(p, 160);
    if (at) {
      c.x = at[0];
      c.y = at[1];
    } else {
      const m = marginOf(sz);
      c.x = -m + (W + 2 * m) * Math.random();
      c.y = -m + (H + 2 * m) * Math.random();
    }
    cs.push(c);
  }
  // Settle into a loose lattice, then live a while at the pace the knob sets.
  for (let k = 0; k < 90; k++) {
    radii(p, 0.5);
    pushOnly(p, 0.7);
  }
  const pre = 60 * rate;
  for (let t = 0; t < pre; t += 0.5) {
    radii(p, 0.5);
    life(p, 0.5);
  }
  for (let k = 0; k < 20; k++) radii(p, 0.5);
}

// A relaxation pass that moves discs and nothing else.
function pushOnly(p, dl) {
  const cs = p.cs;
  const n = cs.length;
  const gap = 1.08 * spacingOf(p.sz) - 2 * R0 * p.sz;
  const fx = new Float32Array(n);
  const fy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = cs[i];
    for (let j = i + 1; j < n; j++) {
      const b = cs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lr = a.r + b.r + gap;
      const d2 = dx * dx + dy * dy;
      if (d2 >= lr * lr) continue;
      const d = Math.max(Math.sqrt(d2), 0.01);
      const push = (lr - d) * MU * dl * 3;
      fx[i] -= (dx / d) * push;
      fy[i] -= (dy / d) * push;
      fx[j] += (dx / d) * push;
      fy[j] += (dy / d) * push;
    }
  }
  const m = marginOf(p.sz);
  for (let i = 0; i < n; i++) {
    const c = cs[i];
    c.x = clamp(c.x + fx[i], -m, W + m);
    c.y = clamp(c.y + fy[i], -m, H + m);
  }
}

export function setup(params) {
  params.t = 0;
  params.cs = [];
  params.cool = 0;
  params.ready = false;
  params.sz = 1;
  params.dr = 0.5;
  params.sd = new Float32Array(W * H);
  params.ci = new Int16Array(W * H);
  params.pal = new Float32Array(9);
  params.col = new Float32Array(30);
  params.gust = new Float32Array(24);
  params.wdir = 0.35;
  params.sun = -2.4;
  params.temp = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  if (dt > 0.1) dt = 0.1;
  params.t += dt;
  const rate = Math.pow(clamp(k[1], 0, 4) / 2, 1.1);
  const szT = sizeScale(k[2]);
  const drT = (clamp(k[3], -1, 1) + 1) / 2;
  if (!params.ready) {
    params.ready = true;
    params.sz = szT;
    params.dr = drT;
    build(params, rate);
  } else {
    params.sz += (szT - params.sz) * (1 - Math.exp(-dt / 1.2));
    params.dr += (drT - params.dr) * (1 - Math.exp(-dt / 0.8));
  }
  targets(params);
  radii(params, dt);
  if (rate > 0) life(params, dt * rate);
  seasonAt(k[0], params.pal);
  const t = params.t;
  // The wind's heading wanders, and the sun crosses the sky very slowly, bringing a shift in the warmth of the light.
  params.wdir = 0.35 + 0.55 * noise1(t / 140, 61);
  params.sun = -2.4 + 0.007 * t + 0.8 * Math.sin(0.0113 * t) + 0.5 * Math.sin(0.0197 * t + 1);
  params.temp = 0.65 * Math.sin(0.0123 * t + 0.7) + 0.35 * Math.sin(0.0047 * t + 2);
}

// Gust fronts: three lanes of ridges that cross the panel, each lane starting a fresh one, tilted and spaced as its own hash says, whenever the last has gone by.
const LANE_P = [13.1, 17.7, 23.3];
const LANE_O = [0, 5.3, 11.9];

function gusts(params) {
  const g = params.gust;
  const t = params.t;
  for (let l = 0; l < 3; l++) {
    const tt = t + LANE_O[l];
    const e = Math.floor(tt / LANE_P[l]);
    const f = (tt - e * LANE_P[l]) / LANE_P[l];
    const th = params.wdir + (hash(e, 71 + l) - 0.5) * 1.0;
    const cx = Math.cos(th);
    const cy = Math.sin(th);
    // The panel's extent along the heading.
    const u0 = Math.min(0, W * cx, H * cy, W * cx + H * cy);
    const u1 = Math.max(0, W * cx, H * cy, W * cx + H * cy);
    const sg = 9 + 11 * hash(e, 81 + l);
    const a0 = u0 - 1.6 * sg;
    const a1 = u1 + 1.6 * sg;
    const amp = (0.7 + 0.3 * hash(e, 91 + l)) * smooth(0, 0.12, f) * (1 - smooth(0.85, 1, f));
    g[l * 6] = cx;
    g[l * 6 + 1] = cy;
    g[l * 6 + 2] = a0 + (a1 - a0) * f;
    g[l * 6 + 3] = 1 / sg;
    g[l * 6 + 4] = amp;
    g[l * 6 + 5] = 4 + 10 * hash(e, 101 + l);
  }
}

export function draw(display, params) {
  const sd = params.sd;
  const ci = params.ci;
  const cs = params.cs;
  const D = params.dr;
  const ds = 0.8 + 0.4 * D;
  const t = params.t;
  sd.fill(99);
  ci.fill(-1);
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const r = c.r;
    if (r < 0.9) continue;
    const reach = r * 1.06 + REACH;
    const x0 = Math.max(0, Math.floor(c.x - reach));
    const x1 = Math.min(W - 1, Math.ceil(c.x + reach));
    const y0 = Math.max(0, Math.floor(c.y - reach));
    const y1 = Math.min(H - 1, Math.ceil(c.y + reach));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - c.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - c.x;
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        const e = 1 + 0.045 * noise2((dx / d) * 1.4 + c.nx, (dy / d) * 1.4 + c.ny);
        const s = d - r * e;
        const idx = y * W + x;
        if (s < sd[idx]) {
          sd[idx] = s;
          ci[idx] = i;
        }
      }
    }
  }

  gusts(params);
  const g = params.gust;
  const cp = Math.cos(params.wdir);
  const sp = Math.sin(params.wdir);
  const pal = params.pal;
  const col = params.col;
  const tmp = [0, 0, 0];
  // Dry weather pales the grass and turns it to straw; wet weather deepens it.
  const gs = pal[4] * (1.12 - 0.38 * D);
  const gv = pal[5] * (0.98 + 0.2 * D);
  const gh = pal[3] + 0.018 * D - 0.006;
  hsv(gh + 0.01, gs * 1.04, gv * 0.93, tmp);
  col[0] = tmp[0]; col[1] = tmp[1]; col[2] = tmp[2];
  hsv(gh - 0.008, gs * 0.9, Math.min(1, gv * 1.12), tmp);
  col[3] = tmp[0]; col[4] = tmp[1]; col[5] = tmp[2];
  hsv(pal[6], pal[7] * (1.05 - 0.2 * D), pal[8], tmp);
  col[6] = tmp[0]; col[7] = tmp[1]; col[8] = tmp[2];
  hsv(pal[6] + 0.012, pal[7] * 0.88, Math.min(1, pal[8] * 1.14), tmp);
  col[9] = tmp[0]; col[10] = tmp[1]; col[11] = tmp[2];
  hsv(pal[0], pal[1], pal[2], tmp);
  col[12] = tmp[0]; col[13] = tmp[1]; col[14] = tmp[2];
  hsv(pal[0] - 0.02, Math.min(1, pal[1] * 1.3), pal[2] * 0.74, tmp);
  col[15] = tmp[0]; col[16] = tmp[1]; col[17] = tmp[2];
  hsv(pal[0] - 0.03, 0.85, 0.72, tmp);
  col[18] = tmp[0]; col[19] = tmp[1]; col[20] = tmp[2];
  const T = params.temp;
  const tr = 1 + 0.05 * T;
  const tg = 1 + 0.01 * T;
  const tb = 1 - 0.07 * T;
  const Lx = Math.cos(params.sun);
  const Ly = Math.sin(params.sun);
  const rw = (4.2 - 1.8 * D) * (0.85 + 0.15 * params.sz);

  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // Wind: an ambient swell of light and dark, and the gust fronts over it.
      const ua = px * cp + py * sp;
      const va = -px * sp + py * cp;
      let rip = 0.4 * noise2(ua / 21 - 0.24 * t, va / 29 + 3.1 + 0.02 * t) + 0.3 * noise2(ua / 12 - 0.35 * t + 5.5, va / 14 + 0.05 * t + 1.9) + 0.7 * noise2(ua / 8 - 0.5 * t + 2.2, va / 9 + 0.12 * t + 7.7);
      for (let l = 0; l < 3; l++) {
        const o = l * 6;
        const u = px * g[o] + py * g[o + 1];
        const wob = g[o + 5] * noise2(va / 22 + l * 7.3, 0.11 * t + l);
        const q = (u - g[o + 2] + wob) * g[o + 3];
        rip += g[o + 4] * 1.4 * q * Math.exp(-q * q);
      }
      rip = clamp(rip, -1.2, 1.2);
      if (rip < 0) rip *= 0.3;
      const su = px - 1.8 * rip * cp;
      const sv = py - 1.8 * rip * sp;
      const tuft = 0.6 * noise2(su / 3.1, sv / 3.1) + 0.4 * noise2(su / 5.2 + 9.1, sv / 5.2 + 4.3);
      const patch = noise2(px / 17 + 3.3, py / 17 + 8.1);
      let f = clamp(0.58 + 0.32 * tuft + 0.34 * rip + 0.08 * patch, 0, 1);
      let gain = 1 + 0.26 * rip;
      let r = (col[0] + (col[3] - col[0]) * f) * gain;
      let gg = (col[1] + (col[4] - col[1]) * f) * gain;
      let b = (col[2] + (col[5] - col[2]) * f) * gain;
      const idx = y * W + x;
      const i = ci[idx];
      if (i >= 0) {
        const c = cs[i];
        const dx = px - c.x;
        const dy = py - c.y;
        const dd = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        const nx = dx / dd;
        const ny = dy / dd;
        const rf = c.rt;
        const growth = clamp(c.r / (rf + 0.01), 0, 1);
        const mat = smooth(0.15, 0.85, growth);
        const lean = nx * cp + ny * sp;
        // The belt of tall grass hugs the disc, leans down the wind, and glows brightest on the side the sun faces.
        const s = sd[idx] - 0.7 * rip * lean;
        const nl = nx * Lx + ny * Ly;
        const body = c.r < 3 ? smooth(0.9, 3, c.r) : 1;
        let bump = smooth(-0.8, 0.8, s) * Math.exp(-Math.max(0, s - 1.2) / (0.75 * rw));
        if (s > 3 * rw) bump = 0;
        const rm = clamp(c.rim * bump * mat * mat * smooth(0.5, 3, c.r), 0, 1);
        if (rm > 0.001) {
          const rf2 = clamp(0.55 + 0.5 * tuft * 0.5 + 0.35 * rip + 0.18 * nl, 0, 1);
          const rg = 1 + 0.32 * rip + 0.16 * nl;
          const rr = (col[6] + (col[9] - col[6]) * rf2) * rg;
          const rg2 = (col[7] + (col[10] - col[7]) * rf2) * rg;
          const rb = (col[8] + (col[11] - col[8]) * rf2) * rg;
          r += (rr - r) * rm;
          gg += (rg2 - gg) * rm;
          b += (rb - b) * rm;
        }
        // Sand.
        const sm = (1 - smooth(-0.7, 0.5, s)) * body;
        if (sm > 0.001) {
          const q = Math.max(0, -sd[idx]);
          // The wall on the sun's side shades the sand just inside it.
          const sh = Math.max(0, nl) * Math.exp(-q / 4.5) * 0.9 * (0.4 + 0.6 * mat);
          const lit = clamp(0.86 + 0.2 * Math.max(0, -nl) * Math.exp(-q / 6) - sh + 0.05 * noise2(px / 6.5 + 1.7, py / 6.5 + 5.9) + 0.04 * c.tone + 0.09 * rip, 0, 1);
          let sr = col[15] + (col[12] - col[15]) * lit;
          let sg = col[16] + (col[13] - col[16]) * lit;
          let sb = col[17] + (col[14] - col[17]) * lit;
          if (mat < 1) {
            const w = 1 - mat;
            sr += (col[18] - sr) * w;
            sg += (col[19] - sg) * w;
            sb += (col[20] - sb) * w;
          }
          if (c.dying) {
            const w = (1 - growth) * 0.75;
            sr += (col[6] - sr) * w;
            sg += (col[7] - sg) * w;
            sb += (col[8] - sb) * w;
          }
          r += (sr - r) * sm;
          gg += (sg - gg) * sm;
          b += (sb - b) * sm;
        }
      }
      r *= tr;
      gg *= tg;
      b *= tb;
      display.setPixel(x, y, r > 255 ? 255 : r < 0 ? 0 : r, gg > 255 ? 255 : gg < 0 ? 0 : gg, b > 255 ? 255 : b < 0 ? 0 : b);
    }
  }
}
