// ===== Patternflow pattern =====
// Title:   Dripstone
// Family:  mineral
// Idea:    A limestone cave in cross-section fills the panel, with stalactites hanging over stalagmites and columns and a banded flowstone curtain on one side, while drops swell at the tips, fall and splash on the stalagmites or ring the pool on the floor, each drop lengthening its formation a little under a show-cave light sequence and a caver's passing headlamp.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after show-cave lighting and the banded "bacon" drapery of limestone caves
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Lamp=0..1, Speed=0.2..3, Age=0..1, Damp=0..1
//
// Knob 1: Lamp. Turns the two coloured show lamps round the colour wheel together, from aqua and violet at 0; the warm lamp behind the curtain and the headlamp stay white.
// Knob 2: Speed. How fast cave time runs: at 2 a drop falls the 100 rows from the roof in 1.3 s and the light sequence takes 15 s round its three lamps; each drop that lands lengthens its stalagmite and stalactite by about half a row.
// Knob 3: Age. How far the cave has grown, from short stalactites, soda straws and one column at 0 to a hall of thick columns at 1, with the curtain hanging twice as far down and the straws thickened into carrots. A straw that grows too long snaps and falls into the pool.
// Knob 4: Damp. How wet the cave is: at 0 the stone is pale and chalky and the pool sits in a hollow of the floor; at 1 the pool covers the whole floor, the drips come three times as often, and the stone turns dark and shines with films of water creeping down the wall.

const W = 64;
const H = 128;
const N = W * H;
// Drops fall at this many rows per second squared of cave time.
const GRAV = 110;
const MAXP = 160;
// How far in front of the stone the lamps stand, in LEDs.
const DZ = 16;
// The rows the wall's water films repeat over.
const FT = 144;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function vn(lat, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ix & 255;
  const x1 = (ix + 1) & 255;
  const y0 = (iy & 255) << 8;
  const y1 = ((iy + 1) & 255) << 8;
  const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * ux;
  const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * ux;
  return a + (b - a) * uy;
}

function hsv(h, s, v) {
  h -= Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  return [k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p, k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p, k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p];
}

// The flowstone's bands, from cream through orange to rust and brown.
const BANDS = [
  [0.95, 0.86, 0.68],
  [0.92, 0.52, 0.2],
  [0.98, 0.74, 0.42],
  [0.62, 0.26, 0.12],
  [0.96, 0.9, 0.78],
  [0.84, 0.4, 0.16],
  [0.45, 0.2, 0.1],
];

export function setup(params) {
  const P = params;
  const lat = new Float32Array(65536);
  for (let i = 0; i < lat.length; i++) lat[i] = Math.random();
  P.lat = lat;
  P.ceil = new Int16Array(W);
  P.flo = new Int16Array(W);
  P.edge = new Float32Array(W);
  // The curtain hangs from the roof where it slopes down to one side wall.
  const right = Math.random() < 0.5;
  const cw = 20 + Math.floor(Math.random() * 4);
  P.cx0 = right ? W - cw : 0;
  P.cx1 = right ? W : cw;
  P.cw = cw;
  P.right = right;
  P.cph = Math.random() * 6.28;
  P.cfold = 6.5 + Math.random() * 2;
  // The pool lies in a hollow of the floor away from the curtain.
  P.bc = right ? 20 + Math.random() * 8 : 36 + Math.random() * 8;
  P.bw = 11 + Math.random() * 3;
  let deep = 0;
  for (let x = 0; x < W; x++) {
    let c = 8 + 4 * vn(lat, x / 9, 5.5) + 1.6 * vn(lat, x / 3, 9.5);
    if (x >= P.cx0 && x < P.cx1) c += 9 * (right ? (x - P.cx0) / cw : (P.cx1 - 1 - x) / cw);
    P.ceil[x] = Math.round(c);
    let f = 115 + 3 * vn(lat, x / 8, 15.5) + 1.5 * vn(lat, x / 3, 19.5);
    const b = (x + 0.5 - P.bc) / P.bw;
    if (Math.abs(b) < 1) f += 8.5 * Math.pow(1 - b * b, 0.6);
    P.flo[x] = Math.round(f);
    deep = Math.max(deep, P.flo[x]);
  }
  P.deep = deep;
  bakeStone(P);

  // Stalactite and stalagmite pairs across the width, none over the pool.
  P.sites = [];
  let x = 2 + Math.random() * 3;
  while (x < W - 2) {
    const xi = Math.floor(x);
    if (Math.abs(xi + 0.5 - P.bc) > P.bw - 4) P.sites.push(site(xi, 0));
    x += 8 + Math.random() * 4;
  }
  // One pair, the one nearest the middle and clear of the curtain, has met already.
  let best = null;
  for (const s of P.sites) if (!inCurtain(P, s.x) && (!best || Math.abs(s.x - 32) < Math.abs(best.x - 32))) best = s;
  if (best) {
    best.base = 1.04;
    best.thick = 0.9;
  }
  // Soda straws over the pool, dripping quicker than the big stalactites.
  for (let i = 0; i < 4; i++) {
    const s = site(Math.round(P.bc + (i - 1.5) * (3.5 + Math.random() * 1.5)), 1);
    s.per *= 0.7;
    P.sites.push(s);
  }
  P.drops = [];
  P.rip = [];
  P.px = new Float32Array(MAXP);
  P.py = new Float32Array(MAXP);
  P.pvx = new Float32Array(MAXP);
  P.pvy = new Float32Array(MAXP);
  P.pl = new Float32Array(MAXP);
  P.pn = 0;
  P.fu = new Float32Array(N);
  P.fs = new Int8Array(N);
  P.buf = new Float32Array(N * 3);
  P.ex = new Float32Array(W * 4);
  P.ey = new Float32Array(H * 4);
  Object.assign(P, { T: 0, t: 0, cGrow: 0, hue: 0, rate: 1, age: 0, damp: 0.06, started: false });
}

function site(x, kind) {
  return {
    x,
    kind,
    base: 0.12 + Math.pow(Math.random(), 1.2) * 0.58,
    thick: 0.55 + Math.random() * 0.45,
    grow: 0,
    per: 1.6 + Math.random() * 2.4,
    sw: Math.random(),
    ph: Math.random() * 6.28,
    tint: Math.random(),
    // A soda straw's length, and the length it snaps at.
    len: 4 + Math.random() * 14,
    maxL: 20 + Math.random() * 8,
    g: 0,
    y0: 0,
    y1: 0,
    ls: 0,
    lm: 0,
  };
}

const inCurtain = (P, x) => x >= P.cx0 && x < P.cx1;

// The back wall and the cut rock: colour, and the wall's relief as a normal.
function bakeStone(P) {
  const lat = P.lat;
  P.alb = new Float32Array(N * 3);
  P.nrm = new Float32Array(N * 3);
  P.tex = new Float32Array(N);
  const hgt = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) hgt[y * W + x] = 0.7 * vn(lat, x / 5 + 60, y / 7 + 60) + 0.3 * vn(lat, x / 2 + 90, y / 2.5 + 90);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      const gx = hgt[y * W + Math.min(W - 1, x + 1)] - hgt[y * W + Math.max(0, x - 1)];
      const gy = hgt[Math.min(H - 1, y + 1) * W + x] - hgt[Math.max(0, y - 1) * W + x];
      const nx = -gx * 3;
      const ny = -gy * 3;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      P.nrm[o] = nx * l;
      P.nrm[o + 1] = ny * l;
      P.nrm[o + 2] = l;
      const ce = P.ceil[x];
      const fl = P.flo[x];
      let r;
      let g;
      let b;
      if (y < ce - 1 || y > fl) {
        // The cut rock: beds of limestone, each its own shade.
        const bed = Math.floor((y + 3 * vn(lat, x / 12, 40.5)) / 3);
        const v = 0.13 + 0.05 * (((bed * 7919) % 5) / 4) + 0.05 * vn(lat, x / 2, y / 2 + 50);
        r = v * 1.05;
        g = v * 0.95;
        b = v * 0.88;
      } else if (y === ce - 1 || y === fl) {
        // The skin of the roof and the floor, white with old calcite.
        r = 0.8;
        g = 0.74;
        b = 0.62;
        P.nrm[o] = 0;
        P.nrm[o + 1] = y === fl ? -0.8 : 0.8;
        P.nrm[o + 2] = 0.6;
      } else {
        // The back wall, darker than what stands in front of it, with pale streaks of flowstone.
        const v = 0.22 + 0.22 * vn(lat, x / 9, y / 9 + 20);
        const streak = Math.max(0, vn(lat, x / 2.2 + 30, y / 16 + 30) - 0.58) * 1.6;
        r = v * 1.1 + streak * 0.5;
        g = v * 0.96 + streak * 0.44;
        b = v * 0.8 + streak * 0.34;
      }
      P.alb[o] = r;
      P.alb[o + 1] = g;
      P.alb[o + 2] = b;
      // Streaks down the calcite of the formations.
      P.tex[p] = 0.16 * (vn(lat, x * 1.1 + 200, y / 9 + 200) - 0.5);
    }
  // The wall's water films, as rivulets that wrap round every FT rows so they can scroll down.
  P.ftex = new Float32Array(W * FT);
  for (let x = 0; x < W; x++)
    for (let y = 0; y < FT; y++) {
      const a = vn(lat, x / 1.4 + 140, y / 9);
      const b = vn(lat, x / 1.4 + 140, (y - FT) / 9);
      const m = y / FT;
      P.ftex[x * FT + y] = a * (1 - m) + b * m;
    }
}

// The curtain's lower edge in each of its columns, as long as Age and its drips have made it.
function curtain(P) {
  const a = Math.min(1.2, 0.45 + 0.65 * P.age + P.cGrow);
  for (let x = P.cx0; x < P.cx1; x++) {
    const s = (x - P.cx0 + 0.5) / P.cw;
    const fold = 0.5 - 0.5 * Math.cos((6.2832 * (x + 0.5)) / P.cfold + P.cph);
    P.edge[x] = P.ceil[x] + (8 + 30 * a) * (0.45 + 0.55 * Math.sin(Math.PI * (P.right ? 0.35 + 0.65 * s : 1 - 0.65 * s))) + 3.4 * fold;
  }
}

function geom(P, s) {
  if (s.kind === 1) {
    s.y0 = P.ceil[s.x];
    return;
  }
  const y0 = inCurtain(P, s.x) ? P.edge[s.x] : P.ceil[s.x];
  const y1 = P.flo[s.x];
  const gap = y1 - y0;
  s.g = Math.min(1.3, s.base + 0.8 * P.age + s.grow);
  s.y0 = y0;
  s.y1 = y1;
  s.ls = s.g * gap * 0.42;
  s.lm = s.g * gap * 0.58;
}

function splash(P, x, y, n, up) {
  for (let i = 0; i < n; i++) {
    const k = P.pn;
    P.pn = (k + 1) % MAXP;
    P.px[k] = x + (Math.random() - 0.5);
    P.py[k] = y;
    P.pvx[k] = (Math.random() - 0.5) * 34;
    P.pvy[k] = -(10 + Math.random() * 26) * up;
    P.pl[k] = 0.45 + Math.random() * 0.3;
  }
}

function step(P, h) {
  P.T += h;
  P.level = P.deep - 7.5 - P.damp * 12;
  curtain(P);
  const often = 0.6 + 1.4 * P.damp;
  for (const s of P.sites) {
    geom(P, s);
    if (s.kind === 0 && s.g >= 1) continue;
    s.sw += (h * often) / s.per;
    if (s.sw >= 1) {
      s.sw -= 1;
      const tip = s.kind === 1 ? s.y0 + s.len : s.y0 + s.ls;
      P.drops.push({ s, x: s.x, y: tip + 1, v: 6, len: 0 });
    }
  }
  const lvl = P.level;
  for (let i = P.drops.length - 1; i >= 0; i--) {
    const d = P.drops[i];
    const s = d.s;
    d.v += GRAV * h;
    d.y += d.v * h;
    const fl = P.flo[d.x];
    const pool = fl > lvl + 0.5;
    const target = s.kind === 0 && !d.len ? s.y1 - s.lm : pool ? lvl : fl;
    if (d.y < target) continue;
    P.drops.splice(i, 1);
    if (d.len) {
      // A broken straw goes into the pool with a heavy splash.
      splash(P, d.x, target - 1, 14, 1.4);
      P.rip.push({ x: d.x + 0.5, a: 0, k: 1.6 });
      continue;
    }
    if (s.kind === 0 && s.y1 - s.lm < fl - 0.5) {
      // Each drop leaves a little calcite: the stalagmite rises and the stalactite reaches down.
      s.grow += 0.011 * (1 - s.grow / 0.36);
      if (inCurtain(P, s.x)) P.cGrow += 0.004 * (1 - P.cGrow / 0.25);
      splash(P, d.x, target - 1, 4, 1);
    } else {
      splash(P, d.x, target - 1, pool ? 3 : 4, pool ? 1.2 : 0.8);
      if (pool) P.rip.push({ x: d.x + 0.5, a: 0, k: 1 });
      if (s.kind === 1) {
        s.len += 0.55;
        if (s.len > s.maxL + 10 * P.age) {
          // Too long to hold its own weight: the straw snaps and falls.
          const keep = 2 + Math.random() * 3;
          P.drops.push({ s, x: s.x, y: s.y0 + s.len, v: 0, len: s.len - keep });
          s.len = keep;
        }
      }
    }
  }
  for (let i = 0; i < MAXP; i++) {
    if (P.pl[i] <= 0) continue;
    P.pl[i] -= h;
    P.pvy[i] += GRAV * 0.8 * h;
    P.px[i] += P.pvx[i] * h;
    P.py[i] += P.pvy[i] * h;
  }
  for (let i = P.rip.length - 1; i >= 0; i--) {
    P.rip[i].a += h;
    if (P.rip[i].a > 1.8) P.rip.splice(i, 1);
  }
  if (P.rip.length > 14) P.rip.splice(0, P.rip.length - 14);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.hue = clamp(k[0], 0, 1);
  P.rate = clamp(k[1], 0.2, 3) / 2;
  P.age = clamp(k[2], 0, 1);
  P.damp = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    // Twenty seconds of the cave before it opens, at the knob's pace, so the drips are
    // already falling and the time-lapse has grown what Speed lets it.
    for (let i = 0; i < 600; i++) step(P, P.rate / 30);
  }
  P.t += dt;
  step(P, dt * P.rate);
}

export function draw(display, params) {
  const P = params;
  const { lat, buf, fu, fs, alb, nrm, ceil, flo, edge, sites } = P;
  const T = P.T;
  const damp = P.damp;

  // The show lamps: two coloured ones low on either side and a warm one behind the curtain,
  // fading up and down in turn, their colours wandering a little.
  const w = (6.2832 * T) / 15;
  const lamps = [];
  const ha = 0.47 + P.hue;
  const cxm = (P.cx0 + P.cx1) / 2;
  const defs = [
    [6, 108, ha + 0.04 * Math.sin(T * 0.31), 0.7, 52],
    [58, 104, ha + 0.3 + 0.04 * Math.sin(T * 0.23 + 2), 0.7, 52],
    [cxm, 38, 0.08, 0.3, 40],
  ];
  for (let k = 0; k < 3; k++) {
    const d = defs[k];
    const s = 0.5 + 0.5 * Math.sin(w + (k * 6.2832) / 3);
    const I = 0.3 + 0.95 * s * Math.sqrt(s);
    const c = hsv(d[2], d[3], I);
    lamps.push({ x: d[0], y: d[1], r: c[0], g: c[1], b: c[2], I });
    const inv = 1 / (d[4] * d[4]);
    for (let x = 0; x < W; x++) P.ex[k * W + x] = Math.exp(-(x - d[0]) * (x - d[0]) * inv);
    for (let y = 0; y < H; y++) P.ey[k * H + y] = Math.exp(-(y - d[1]) * (y - d[1]) * inv);
  }
  // The caver's headlamp wanders over the cave on its own time.
  const t = P.t;
  const hx = 32 + 38 * Math.sin(0.52 * t + 0.4);
  const hy = 62 + 36 * Math.sin(0.23 * t + 2.1);
  for (let x = 0; x < W; x++) P.ex[3 * W + x] = 1.05 * Math.exp(-((x - hx) * (x - hx)) / 90);
  for (let y = 0; y < H; y++) P.ey[3 * H + y] = Math.exp(-((y - hy) * (y - hy)) / 170);
  const ex = P.ex;
  const ey = P.ey;

  // The formations, drawn into a map of which one covers each LED and where across it.
  fs.fill(-1);
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const xc = s.x + 0.5;
    if (s.kind === 1) {
      // A soda straw: one LED wide, thickening into a carrot with Age.
      const wT = 0.55 + 1.7 * P.age;
      for (let y = s.y0; y < s.y0 + s.len && y < H; y++) {
        const d = (y + 0.5 - s.y0) / s.len;
        span(P, i, xc, y, 0.55 + (wT - 0.55) * (1 - d) * (1 - d));
      }
      continue;
    }
    const gg = Math.min(1.2, s.g);
    const wT = 0.9 + 2.4 * s.thick * (0.3 + gg);
    const y0 = s.y0;
    for (let y = Math.max(0, Math.floor(y0)); y < y0 + s.ls && y < H; y++) {
      const d = (y + 0.5 - y0) / s.ls;
      const hw = 0.55 + (wT - 0.55) * Math.pow(1 - d, 1.7) + 0.3 * Math.sin(y * 1.3 + s.ph) * (1 - d);
      span(P, i, xc, y, hw);
    }
    const wB = 1.6 + 3 * s.thick * (0.45 + gg);
    const y1 = s.y1;
    for (let y = Math.floor(y1 - s.lm); y < y1; y++) {
      const hh = (y1 - (y + 0.5)) / s.lm;
      if (hh > 1 || hh < 0) continue;
      const hw = Math.max(0.55, wB * Math.pow(1 - hh * hh * hh * hh, 0.3) * (0.8 + 0.2 * (1 - hh)) * (1 + 0.35 * Math.pow(1 - hh, 5)));
      span(P, i, xc, y, hw);
    }
  }

  const amb = 0.07;
  const tex = P.tex;
  const ftex = P.ftex;
  const fsh = FT - (Math.floor(T * 12.6) % FT);
  const wet = 0.15 + 0.85 * damp;
  const dry = 1 - damp;
  const cfold = P.cfold;
  const cph = P.cph;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      const ce = ceil[x];
      const fl = flo[x];
      let ar;
      let ag;
      let ab;
      let nx;
      let ny;
      let nz;
      let glow = 0;
      let spec = 0;
      let lit = 1;
      const f = fs[p];
      const cur = x >= P.cx0 && x < P.cx1 && y >= ce - 1 && y < edge[x];
      if (f >= 0) {
        const s = sites[f];
        const u = fu[p];
        nx = u;
        ny = 0;
        nz = Math.sqrt(Math.max(0, 1 - u * u));
        // Calcite, white or stained with iron, ringed where it grew in pulses.
        const ring = 0.97 + 0.03 * Math.sin(y * 0.9 + s.ph) + tex[p];
        const st = s.tint;
        ar = (0.96 - 0.02 * st) * ring;
        ag = (0.9 - 0.2 * st) * ring;
        ab = (0.8 - 0.36 * st) * ring;
        spec = wet * Math.max(0, 1 - Math.abs(u + 0.4) * 3.5);
        if (s.kind === 0 && s.g >= 1) {
          // Water runs down a column in a thin film that catches the light as it goes.
          const run = (((y - T * 14 + s.ph * 9) % 26) + 26) % 26;
          if (run < 4) spec += 0.7 * wet * Math.max(0, 1 - Math.abs(u + 0.3) * 2.5);
        }
      } else if (cur) {
        // The curtain: bands laid down parallel to its edge, folded, lit through from behind.
        const top = ce - 1;
        const fold = Math.sin((6.2832 * (x + 0.5)) / cfold + cph);
        const hang = (y - top) / Math.max(4, edge[x] - top);
        const by = (y - top - 3.4 * (0.5 - 0.5 * Math.cos((6.2832 * (x + 0.5)) / cfold + cph)) * hang * hang) / 2.4;
        const bi = Math.floor(by + 0.25 * vn(lat, x / 4, by * 1.3));
        const c = BANDS[((bi % 7) + 7) % 7];
        const pleat = 0.6 + 0.4 * Math.cos((6.2832 * (x + 0.5)) / cfold + cph + 1.2);
        ar = c[0] * pleat;
        ag = c[1] * pleat;
        ab = c[2] * pleat;
        nx = 0.75 * fold;
        ny = 0;
        nz = 0.66;
        const thin = clamp(1 - (edge[x] - y) / 24, 0, 1);
        glow = lamps[2].I * (0.1 + 0.6 * thin) * (0.55 + 0.45 * fold);
        spec = wet * 0.35 * Math.max(0, fold - 0.6);
      } else {
        ar = alb[o];
        ag = alb[o + 1];
        ab = alb[o + 2];
        nx = nrm[o];
        ny = nrm[o + 1];
        nz = nrm[o + 2];
        if (y < ce - 1 || y > fl) {
          // Cut rock takes only what light leaks in at its edge.
          const dd = y < ce ? ce - 1 - y : y - fl;
          lit = Math.max(0, 0.45 - dd * 0.15);
          glow = 0.9;
        } else if (damp > 0.02) {
          // Films of water creep down a damp wall and shine.
          const film = ftex[x * FT + ((y + fsh) % FT)] - 0.7 + 0.12 * damp;
          if (film > 0) spec = damp * film * 1.3;
        }
      }
      if (glow < 0.9) {
        // Dry stone is chalky and pale; wet stone is darker and its colour deeper.
        const grey = (ar + ag + ab) * 0.38;
        const d = dry * 0.45;
        const v = 1.08 - 0.3 * damp;
        ar = (ar + (grey - ar) * d) * v;
        ag = (ag + (grey - ag) * d) * v;
        ab = (ab + (grey - ab) * d) * v;
      }
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let lr = amb;
      let lg = amb;
      let lb = amb * 1.15;
      if (lit > 0) {
        for (let k = 0; k < 3; k++) {
          const e = ex[k * W + x] * ey[k * H + y];
          if (e < 0.01) continue;
          const L = lamps[k];
          const dx = L.x - x;
          const dy = L.y - y;
          const dif = (nx * dx + ny * dy + nz * DZ) / Math.sqrt(dx * dx + dy * dy + DZ * DZ);
          const a = e * (0.2 + 0.8 * Math.max(0, dif)) * lit;
          lr += L.r * a;
          lg += L.g * a;
          lb += L.b * a;
          if (dif > 0.8) {
            // A wet face turned to a lamp throws back a glint of its colour.
            const g2 = (dif - 0.8) * 5;
            const gl = g2 * g2 * e * damp * 0.45;
            sr += L.r * gl;
            sg += L.g * gl;
            sb += L.b * gl;
          }
        }
        const eh = ex[3 * W + x] * ey[3 * H + y] * lit;
        if (eh > 0.01) {
          lr += eh * nz;
          lg += eh * 0.93 * nz;
          lb += eh * 0.8 * nz;
          spec *= 1 + 2 * eh;
        }
      }
      const sp = spec * 0.5 * (lr + lg + lb);
      buf[o] = 255 * (ar * (lr * 1.25 + glow) + sp + sr);
      buf[o + 1] = 255 * (ag * (lg * 1.25 + glow * 0.9) + sp + sg);
      buf[o + 2] = 255 * (ab * (lb * 1.25 + glow * 0.75) + sp + sb);
    }
  }

  // Drops swelling at the tips and falling, and the spray where they land.
  for (const s of sites) {
    if (s.kind === 0 && s.g >= 1) continue;
    const tip = Math.floor(s.kind === 1 ? s.y0 + s.len : s.y0 + s.ls);
    if (s.sw > 0.25) bead(buf, s.x, tip, (s.sw - 0.25) / 0.75);
    if (s.sw > 0.8) bead(buf, s.x, tip + 1, (s.sw - 0.8) / 0.2);
  }
  for (const d of P.drops) {
    if (d.len) {
      for (let j = 0; j < d.len; j++) put(buf, d.x, Math.round(d.y - j), 200, 180, 150, 1);
      continue;
    }
    const tail = Math.min(3, d.v * 0.03);
    for (let j = 0; j <= tail; j++) put(buf, d.x, Math.round(d.y - j), 190, 220, 255, 1 - j / (tail + 1));
  }
  for (let i = 0; i < MAXP; i++) if (P.pl[i] > 0) put(buf, Math.round(P.px[i]), Math.round(P.py[i]), 210, 230, 255, Math.min(1, P.pl[i] * 3));

  // The pool: the cave mirrored in it, rings running out from each drop.
  const lvl = P.level;
  const ly = Math.ceil(lvl);
  const rip = P.rip;
  // The water's own colour, from the lamp nearest the pool.
  const L0 = lamps[P.bc < 32 ? 0 : 1];
  const wr = 10 + 60 * L0.r;
  const wg = 20 + 60 * L0.g;
  const wb = 30 + 60 * L0.b;
  for (let x = 0; x < W; x++) {
    if (flo[x] <= ly) continue;
    for (let y = ly; y <= flo[x] && y < H; y++) {
      const p = y * W + x;
      const o = p * 3;
      const dy = (y - lvl) * 3.5;
      let ring = 0;
      for (const r of rip) {
        const dx = x + 0.5 - r.x;
        const R = 2 + 15 * r.a;
        const q = Math.sqrt(dx * dx + dy * dy) - R;
        if (q > -2 && q < 2) ring += (1 - q * q * 0.25) * (1 - r.a / 1.8) * r.k * 1.4;
      }
      const sx = clamp(Math.round(x + ring * 1.5 + Math.sin(y * 0.9 + T * 2) * 0.6), 0, W - 1);
      const sy = clamp(2 * ly - y - 1, 0, H - 1);
      const q = (sy * W + sx) * 3;
      const depth = Math.min(1, (y - lvl) / 8);
      const m = 0.5 - 0.2 * depth;
      const under = y === flo[x] ? 0.35 : 0.15;
      const shine = (y === ly ? 0.3 : 0) + 0.4 * Math.min(1, ring);
      buf[o] = buf[q] * m + buf[o] * under + wr + 200 * shine;
      buf[o + 1] = buf[q + 1] * m + buf[o + 1] * under + wg + 220 * shine;
      buf[o + 2] = buf[q + 2] * m + buf[o + 2] * under + wb + 240 * shine;
    }
  }

  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, (p / W) | 0, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
  }
}

function span(P, i, xc, y, hw) {
  if (y < 0 || y >= H) return;
  const a = Math.max(0, Math.ceil(xc - hw - 0.5));
  const b = Math.min(W - 1, Math.floor(xc + hw - 0.5));
  const k = 1 / Math.max(hw, 0.6);
  for (let x = a; x <= b; x++) {
    const p = y * W + x;
    P.fs[p] = i;
    P.fu[p] = clamp((x + 0.5 - xc) * k, -0.98, 0.98);
  }
}

function put(buf, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  buf[o] += (r - buf[o]) * a;
  buf[o + 1] += (g - buf[o + 1]) * a;
  buf[o + 2] += (b - buf[o + 2]) * a;
}

// A drop on a tip catches the light brighter as it swells.
function bead(buf, x, y, a) {
  put(buf, x, y, 180, 215, 255, 0.35 + 0.65 * a);
}
