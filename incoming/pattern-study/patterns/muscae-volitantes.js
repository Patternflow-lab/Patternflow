// ===== Patternflow pattern =====
// Title:   Muscae Volitantes
// Family:  entoptic
// Idea:    Eye floaters on a bright overcast sky, grey shadows ringed by a bright and a dark diffraction fringe, lag and swing the other way at every jump of the eye, swing back past their rest, settle in the gel and sink while the eye rests.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: muscae volitantes, entoptic floaters described by Purkinje (1819) and explained by Helmholtz, Handbuch der physiologischen Optik (1867), as shadows of vitreous bodies on the retina
// Round:   201
// ===============================
// @matrix 64x128
// @knobs Sky=0..1, Glance=0..3, Floaters=-1..1, Focus=-1..1
//
// Knob 1: Sky. The sky's tint, pale blue-white where it opens, round the wheel through rose, cream and pale green; the shadows stay grey.
// Knob 2: Glance. How often and how far the eye jumps: never at 0, where the floaters only sink and drift; every 1.5 to 7 s where it opens; more often and further at the top.
// Knob 3: Floaters. How many and how large: three small ones at the bottom, four where it opens, six large ones at the top.
// Knob 4: Focus. Soft pale blurs at the bottom, as if far from the retina; crisp grey cores ringed by a bright band and a dark fringe at the top.

const W = 64, H = 128, CX = 32, CY = 64;
// Shadow tables over distance from the edge, DMIN to DMAX LEDs, DRES steps a LED.
const DMIN = -10, DMAX = 10, DRES = 16;
const NT = (DMAX - DMIN) * DRES + 1;
const BIG = 99;
// How far past an edge the fringes reach, in LEDs.
const REACH = 9;
const BEADS = 0, THREAD = 1, CLUSTER = 2, VEIL = 3;
// Handed out in this order, so the first four are one of each.
const ORDER = [BEADS, THREAD, CLUSTER, VEIL, THREAD, BEADS, CLUSTER];
// Per kind: core darkness, rim darkness, drag time in the gel (s).
const OPACITY = [0.3, 0.3, 0.3, 0.1];
const RIM = [0.06, 0, 0.14, 0.12];
const TAU = [0.3, 0.12, 0.32, 0.4];
const BENDK = 0.2;
// The gel: a damped spring kicked KICK LED/s per LED the eye travels.
const OMEGA = (2 * Math.PI) / 2.6;
const ZETA = 0.3;
const KICK = 3.2;
// The sky's shift per LED the eye travels; a sun glows behind the cloud.
const SKYSHIFT = 0.45;
const SUNX = 58, SUNY = -20, SUNR = 70;
// Sinking (LED/s); the pull of each saccade towards where the currents go, over KEEPTAU s; how near floaters come.
const SINK = 0.32;
const PULL = 0.3;
const KEEPTAU = 1.2;
const APART = 16;
const SUB = 3;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rnd = (a, b) => a + (b - a) * Math.random();

function hsv(h, s, v, out) {
  h -= Math.floor(h);
  const i = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

function bounds(X, Y, n) {
  const e = [1e9, -1e9, 1e9, -1e9];
  for (let i = 0; i < n; i++) {
    e[0] = Math.min(e[0], X[i]);
    e[1] = Math.max(e[1], X[i]);
    e[2] = Math.min(e[2], Y[i]);
    e[3] = Math.max(e[3], Y[i]);
  }
  return e;
}
const extent = (f) => bounds(f.x, f.y, f.n);

// A floater: nodes held by distance constraints in a viscous gel.
function blank(kind, n) {
  const a = () => new Float32Array(n);
  const f = { kind, n, x: a(), y: a(), vx: a(), vy: a(), ox: a(), oy: a(), r: a(), tau: a(), cons: [], alpha: 1, fade: 0 };
  Object.assign(f, { dvx: 0, dvy: 0, cx: 0, cy: 0, px: 0, py: 0, table: new Float32Array(NT), tab2: new Float32Array(NT) });
  Object.assign(f, { gain: rnd(0.75, 1.25), focus: rnd(-0.12, 0.12), wx: rnd(0.035, 0.07), wy: rnd(0.03, 0.06), ph: rnd(0, 6.283), freq: rnd(0.013, 0.031) });
  return f;
}

function link(f, i, j, k, wob) {
  f.cons.push({ i, j, rest: Math.hypot(f.x[j] - f.x[i], f.y[j] - f.y[i]), k, wob, ph: rnd(0, 6.283) });
}

// A gently curving chain, turned to run more up and down than across.
function spin(f, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (let i = 0; i < f.n; i++) [f.x[i], f.y[i]] = [f.x[i] * c - f.y[i] * s, f.x[i] * s + f.y[i] * c];
}

function chain(f, step, bend, wave, q) {
  const p0 = rnd(0, 6.283);
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < f.n; i++) {
    f.x[i] = x;
    f.y[i] = y;
    a += bend + wave * Math.sin(i * q + p0);
    x += step * Math.cos(a);
    y += step * Math.sin(a);
  }
  spin(f, Math.PI / 2 + rnd(-0.75, 0.75) - Math.atan2(f.y[f.n - 1], f.x[f.n - 1]));
  for (let i = 0; i + 1 < f.n; i++) link(f, i, i + 1, 1, 0);
  // The curl: each node's signed offset from its neighbours' chord, so the chain bends but never zigzags.
  f.h0 = new Float32Array(f.n);
  f.hph = new Float32Array(f.n);
  const ph = rnd(0, 6.283);
  for (let i = 0; i < f.n; i++) {
    f.hph[i] = ph + i * rnd(0.2, 0.5);
    if (i > 0 && i + 1 < f.n) f.h0[i] = offset(f, i).h;
  }
}

function offset(f, i) {
  const ax = f.x[i - 1];
  const ay = f.y[i - 1];
  const cx = f.x[i + 1] - ax;
  const cy = f.y[i + 1] - ay;
  const cl = Math.hypot(cx, cy) || 1e-6;
  const nx = -cy / cl;
  const ny = cx / cl;
  return { h: (f.x[i] - ax - cx / 2) * nx + (f.y[i] - ay - cy / 2) * ny, nx, ny };
}

function make(kind, s) {
  let f;
  if (kind === BEADS || kind === THREAD) {
    // Beads on every second node, about ten LEDs apart. One end is heavier, so in a swing the strand trails.
    const b = kind === BEADS;
    const n = (b ? 7 : 12) + Math.floor(Math.random() * 4);
    f = blank(kind, n);
    if (b) chain(f, rnd(4.6, 5.1), rnd(-0.08, 0.08), rnd(0.08, 0.16), rnd(0.12, 0.3));
    else chain(f, rnd(3.4, 3.8), rnd(-0.06, 0.06), rnd(0.1, 0.18), rnd(0.15, 0.32));
    const odd = Math.random() < 0.5 ? 1 : 0;
    const heavy = Math.random() < 0.5;
    const r = rnd(1.0, 1.15);
    for (let i = 0; i < n; i++) {
      const u = heavy ? i / (n - 1) : 1 - i / (n - 1);
      if (b) {
        f.r[i] = (i & 1) === odd && Math.random() < 0.85 ? rnd(2.4, 2.9) : 0;
        f.tau[i] = (f.r[i] > 0 ? TAU[kind] : 0.12) * (0.5 + 1.2 * u);
      } else {
        f.r[i] = r * (0.85 + 0.15 * Math.sin((Math.PI * i) / (n - 1)));
        f.tau[i] = TAU[kind] * (0.5 + 1.3 * u * u);
      }
    }
  } else if (kind === CLUSTER) {
    // A loose clump of beads grown off one another, some touching.
    const n = 9 + Math.floor(Math.random() * 3);
    f = blank(kind, n);
    for (let i = 0; i < n; i++) {
      f.r[i] = rnd(1.4, 2.4);
      f.tau[i] = TAU[kind] * rnd(0.7, 1.3);
      // Of a few free spots beside an earlier bead, the one nearest the first, measured flat, so it grows into a lumpy streak, not a tail.
      let best = 1e9;
      for (let tries = 0; i > 0 && tries < 40; tries++) {
        const j = Math.floor(Math.random() * i);
        const a = rnd(0, 2 * Math.PI);
        const d = f.r[i] + f.r[j] + (Math.random() < 0.5 ? rnd(-0.8, 0) : rnd(0.8, 2.2));
        const x = f.x[j] + d * Math.cos(a);
        const y = f.y[j] + d * Math.sin(a);
        let ok = Math.hypot(x, y * 2) < best;
        for (let m = 0; m < i; m++) if (m !== j && Math.hypot(x - f.x[m], y - f.y[m]) < f.r[i] + f.r[m] + 0.4) ok = false;
        if (ok) [best, f.x[i], f.y[i]] = [Math.hypot(x, y * 2), x, y];
      }
    }
    spin(f, rnd(0, 6.283));
    for (let i = 0; i < n; i++) {
      const near = [];
      for (let j = 0; j < n; j++) if (j !== i) near.push([Math.hypot(f.x[i] - f.x[j], f.y[i] - f.y[j]), j]);
      near.sort((p, q) => p[0] - q[0]);
      for (let m = 0; m < 3; m++) link(f, i, near[m][1], 0.4, 0.08);
    }
  } else {
    // The veil: a ragged ring of nodes round a centre node.
    const n = 20;
    f = blank(kind, n + 1);
    const R = rnd(12, 15);
    const p = [rnd(0, 6.283), rnd(0, 6.283), rnd(0, 6.283)];
    for (let i = 0; i <= n; i++) {
      const a = (2 * Math.PI * i) / n;
      const d = i < n ? R * (1 + 0.16 * Math.sin(2 * a + p[0]) + 0.14 * Math.sin(3 * a + p[1]) + 0.07 * Math.sin(6 * a + p[2]) + rnd(-0.06, 0.06)) : 0;
      f.x[i] = d * Math.cos(a) * 1.12;
      f.y[i] = d * Math.sin(a) * 0.85;
      f.tau[i] = TAU[kind];
    }
    spin(f, rnd(0, 6.283));
    for (let i = 0; i < n; i++) {
      link(f, i, (i + 1) % n, 0.8, 0.05);
      link(f, i, (i + 3) % n, 0.2, 0.08);
      link(f, i, n, 0.25, 0.1);
    }
    f.ring = n;
    // Its rim shows only where the sheet curls over, so the outline never closes.
    f.edge = new Float32Array(n);
    const pe = rnd(0, 6.283);
    for (let i = 0; i < n; i++) f.edge[i] = clamp(0.35 + 0.9 * Math.sin((2 * Math.PI * i) / n + pe) + 0.3 * Math.sin((4 * Math.PI * i) / n + 2 * pe), 0, 1);
  }
  f.tm = 0;
  for (let i = 0; i < f.n; i++) {
    f.x[i] *= s;
    f.y[i] *= s;
    f.tm += f.tau[i] / f.n;
  }
  return f;
}

function place(f, cx, cy) {
  let mx = 0;
  let my = 0;
  for (let i = 0; i < f.n; i++) {
    mx += f.x[i] / f.n;
    my += f.y[i] / f.n;
  }
  for (let i = 0; i < f.n; i++) {
    f.x[i] += cx - mx;
    f.y[i] += cy - my;
  }
  f.phx = Math.asin(clamp((cx - CX) / 22, -1, 1));
  f.phy = Math.asin(clamp((cy - CY) / 50, -1, 1));
}

// The shadow: grey core, darker rim, then a bright band, a dark second fringe and, when crisp, a faint third ring. f: 0 soft (paler, wider), 1 crisp.
function profile(tab, op, rim, f) {
  f = clamp(f, 0, 1);
  const g = 1 - f;
  const soft = 0.45 + 3.2 * Math.pow(g, 1.4);
  op *= 0.5 + 0.65 * f;
  rim *= 0.3 + 0.7 * f;
  const rw = 0.75 + 1.3 * g;
  const a1 = 0.4 * Math.pow(f, 2.2);
  const a2 = 0.2 * f * f;
  const d1 = 1.1 + 0.6 * g;
  const w1 = 0.95 + 0.9 * g;
  const w2 = 1.1 + 0.8 * g;
  for (let k = 0; k < NT; k++) {
    const d = DMIN + k / DRES;
    const ring = (c, w) => Math.exp(-(((d - c) / w) ** 2));
    tab[k] = 1 - op / (1 + Math.exp(((d - 2.5 * g) / soft) * 1.7)) - rim * ring(-0.9, rw) + a1 * ring(d1, w1) - a2 * ring(d1 + 2, w2) + a2 * f ** 6 * ring(d1 + 4, w2);
  }
}

export function setup(params) {
  params.t = 0;
  params.floaters = null;
  params.T = new Float32Array(W * H);
  params.buf = new Float32Array(W * H).fill(BIG);
  params.wbuf = new Float32Array(W * H);
  params.box = [0, 0, 0, 0];
  params.sp = { x: new Float32Array(80), y: new Float32Array(80), r: new Float32Array(80) };
  // The gel's swing and twist; where the eye looks; when it jumps next.
  params.g = [0, 0, 0];
  params.gv = [0, 0, 0];
  params.ex = params.ey = params.jumps = params.shear = 0;
  params.next = rnd(1.6, 1.9);
  params.scale = 1;
  params.focus = 0.7;
  params.top = [0, 0, 0];
  params.bot = [0, 0, 0];
}

// A new floater at the best of forty tries.
function add(fl, kind, s, slot, alpha) {
  const f = make(kind, s);
  const q = extent(f);
  const w = (q[1] - q[0]) / 2;
  const h = (q[3] - q[2]) / 2;
  let best = null;
  let cost = 1e9;
  for (let c = 0; c < 40; c++) {
    const cx = rnd(Math.min(CX, w + 2), Math.max(CX, W - w - 2));
    const cy = rnd(Math.min(CY, h + 4), Math.max(CY, H - h - 4));
    // Overlap costs most, then nearness to the others.
    let o = 0;
    let near = 60;
    for (const g of fl) {
      if (g.fade < 0) continue;
      const e = extent(g);
      const ox = Math.min(cx + w, e[1]) - Math.max(cx - w, e[0]) + 10;
      const oy = Math.min(cy + h, e[3]) - Math.max(cy - h, e[2]) + 10;
      if (ox > 0 && oy > 0) o += ox * oy;
      near = Math.min(near, Math.hypot(cx - (e[0] + e[1]) / 2, cy - (e[2] + e[3]) / 2));
    }
    o -= near;
    if (o < cost) {
      cost = o;
      best = [cx, cy];
    }
  }
  place(f, best[0], best[1]);
  Object.assign(f, { slot, alpha, fade: alpha < 1 ? 1 : 0 });
  fl.push(f);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  params.t += dt;
  const t = params.t;
  const glance = clamp(k[1], 0, 3);
  params.focus = Math.pow((clamp(k[3], -1, 1) + 1) / 2, 0.3);
  const want = 3 + Math.floor((clamp(k[2], -1, 1) + 1) * 1.5 + 0.25);
  const sz = Math.pow(1.25, clamp(k[2], -1, 1));
  if (!params.floaters) {
    params.floaters = [];
    params.scale = sz;
    for (let i = 0; i < want; i++) add(params.floaters, ORDER[i], sz, i, 1);
  }
  const fl = params.floaters;
  params.scale += (sz - params.scale) * (1 - Math.exp(-dt / 0.6));
  const sc = params.scale;

  // Turning Floaters fades new ones in, spare ones out.
  const live = fl.filter((f) => f.fade >= 0);
  if (live.length < want) {
    let slot = 0;
    while (live.some((f) => f.slot === slot)) slot++;
    add(fl, ORDER[slot % ORDER.length], sc, slot, 0);
  } else if (live.length > want) live.sort((a, b) => b.slot - a.slot)[0].fade = -1;

  const { g, gv } = params;
  // A saccade to a random point at a random time; the first a full one.
  if (glance > 0.02 && t >= params.next) {
    const R = 4 + 6.5 * glance;
    let tx;
    let ty;
    for (let n = 0; n < 8; n++) {
      const a = rnd(0, 2 * Math.PI);
      const d = Math.sqrt(Math.random()) * R;
      tx = d * Math.cos(a);
      ty = d * Math.sin(a);
      if (Math.hypot(tx - params.ex, ty - params.ey) > (params.jumps ? 0.25 : 0.7) * R) break;
    }
    const dx = tx - params.ex;
    const dy = ty - params.ey;
    params.ex = tx;
    params.ey = ty;
    params.jumps++;
    gv[0] -= KICK * dx;
    gv[1] -= KICK * dy;
    gv[2] += rnd(-1, 1) * 0.02 * glance;
    params.shear = rnd(0, 6.283);
    // A floater keeps some lag and is carried towards where the currents go, so it settles somewhere new.
    const stir = Math.min(1, glance / 2) * PULL;
    for (const f of fl) {
      const keep = rnd(0.05, 0.25);
      const hx = CX + 22 * Math.sin(f.wx * t + f.phx);
      const hy = CY + 50 * Math.sin(f.wy * t + f.phy);
      f.dvx += (-dx * keep + (hx - f.cx) * stir) / KEEPTAU;
      f.dvy += (-dy * keep * 0.5 + (hy - f.cy) * stir * (hy < f.cy ? 1 : 0.4)) / KEEPTAU;
    }
    params.next = t + (1.5 + 5.5 * Math.pow(Math.random(), 1.4)) * Math.pow(2 / Math.max(glance, 0.1), 0.7);
  }

  // Floaters whose nearest nodes come close drift apart.
  for (const f of fl) {
    const e = extent(f);
    f.cx = (e[0] + e[1]) / 2;
    f.cy = (e[2] + e[3]) / 2;
    f.px = f.py = 0;
  }
  for (let a = 0; a < fl.length; a++)
    for (let b = a + 1; b < fl.length; b++) {
      const A = fl[a];
      const B = fl[b];
      let d = 1e9;
      let dx = 0;
      let dy = 0;
      for (let i = 0; i < A.n; i++)
        for (let j = 0; j < B.n; j++) {
          const e = Math.hypot(B.x[j] - A.x[i], B.y[j] - A.y[i]);
          if (e < d) [d, dx, dy] = [e, B.x[j] - A.x[i], B.y[j] - A.y[i]];
        }
      if (d < APART) {
        const p = (1.5 * (1 - d / APART)) / (d || 1e-6);
        A.px -= dx * p;
        A.py -= dy * p;
        B.px += dx * p;
        B.py += dy * p;
      }
    }

  const h = dt / 2;
  const w2 = OMEGA * OMEGA;
  const c2 = 2 * ZETA * OMEGA;
  const sx = Math.cos(params.shear);
  const sy = Math.sin(params.shear);
  for (let s = 1; s <= 2; s++) {
    for (let j = 0; j < 3; j++) {
      gv[j] += (-w2 * g[j] - c2 * gv[j]) * h;
      g[j] += gv[j] * h;
    }
    const tt = t - dt + h * s;
    const fall = Math.exp(-(h * s) / KEEPTAU);
    for (const f of fl) {
      const kx = (f.cx < 10 ? (10 - f.cx) * 0.05 : f.cx > W - 10 ? (W - 10 - f.cx) * 0.05 : 0) + f.px + f.dvx * fall;
      const ky = f.py + f.dvy * fall;
      for (let i = 0; i < f.n; i++) {
        const x = f.x[i];
        const y = f.y[i];
        // The gel: swing, shear, twist, currents, soft walls, and sinking, faster for heavy parts so a strand hangs.
        const sh = f.gain * (1 + 0.28 * Math.sin(0.05 * (x * sx + y * sy) + params.shear));
        const ux = gv[0] * sh - gv[2] * (y - CY) + kx + 0.24 * Math.sin(0.043 * y + 0.031 * tt + f.ph) + 0.12 * Math.sin(0.029 * x - 0.019 * tt);
        const uy = gv[1] * sh + gv[2] * (x - CX) + ky + SINK * (0.5 + (0.5 * f.tau[i]) / f.tm) + 0.14 * Math.sin(0.051 * x - 0.023 * tt + 2 * f.ph);
        const a = 1 - Math.exp(-h / f.tau[i]);
        f.vx[i] += (ux - f.vx[i]) * a;
        f.vy[i] += (uy - f.vy[i]) * a;
        f.ox[i] = x;
        f.oy[i] = y;
        f.x[i] = x + f.vx[i] * h;
        f.y[i] = y + f.vy[i] * h;
      }
      // Constraints; heavy nodes give way less, and some breathe so shapes change.
      for (let it = 0; it < 3; it++)
        for (const c of f.cons) {
          const { i, j } = c;
          const dx = f.x[j] - f.x[i];
          const dy = f.y[j] - f.y[i];
          const d = Math.hypot(dx, dy) || 1e-6;
          const wi = 1 / f.tau[i];
          const wj = 1 / f.tau[j];
          const m = (((d - c.rest * sc * (1 + c.wob * Math.sin(f.freq * tt + c.ph))) / d) * c.k) / (wi + wj);
          f.x[i] += dx * m * wi;
          f.y[i] += dy * m * wi;
          f.x[j] -= dx * m * wj;
          f.y[j] -= dy * m * wj;
        }
      // Bending back towards the breathing curl.
      if (f.h0)
        for (let it = 0; it < 2; it++)
          for (let i = 1; i + 1 < f.n; i++) {
            const o = offset(f, i);
            const d = ((f.h0[i] * sc * (1 + 0.35 * Math.sin(f.freq * tt + f.hph[i])) - o.h) * BENDK) / 3;
            for (const j of [i - 1, i, i + 1]) {
              const m = j === i ? 2 : -1;
              f.x[j] += m * d * o.nx;
              f.y[j] += m * d * o.ny;
            }
          }
      for (let i = 0; i < f.n; i++) {
        f.vx[i] = (f.x[i] - f.ox[i]) / h;
        f.vy[i] = (f.y[i] - f.oy[i]) / h;
      }
    }
  }

  // A floater gone out of the field comes back as a new one fading in at the top.
  const settled = Math.abs(g[0]) + Math.abs(g[1]) < 3;
  const fall = Math.exp(-dt / KEEPTAU);
  for (let n = fl.length - 1; n >= 0; n--) {
    const f = fl[n];
    f.dvx *= fall;
    f.dvy *= fall;
    if (f.fade) f.alpha = Math.min(1, f.alpha + (f.fade > 0 ? dt / 3 : -dt / 2.5));
    if (f.fade > 0 && f.alpha >= 1) f.fade = 0;
    if (f.alpha <= 0) {
      fl.splice(n, 1);
      continue;
    }
    const e = extent(f);
    if (settled && (e[2] > H + REACH + 4 || e[1] < -REACH - 10 || e[0] > W + REACH + 10 || e[3] < -60)) {
      const nf = make(f.kind, sc);
      const q = extent(nf);
      place(nf, rnd(14, W - 14), rnd(4, 12) - (q[3] - q[2]) / 2);
      fl[n] = Object.assign(nf, { phy: -1.2, slot: f.slot, alpha: 0, fade: 1 });
    }
  }

  for (const f of fl) {
    const fo = params.focus + f.focus;
    // tab2: the veil's curled rim, or the beads over their thread.
    if (f.kind === VEIL) {
      profile(f.table, OPACITY[VEIL], 0, 0.15 * fo);
      profile(f.tab2, OPACITY[VEIL] + 0.03, RIM[VEIL], 0.75 * fo);
    } else profile(f.table, OPACITY[f.kind], RIM[f.kind], fo);
    if (f.kind === BEADS) profile(f.tab2, 0.18, 0.16, fo);
  }

  // A pale sky, bluer and brighter at the top, drifting very slowly.
  const hue = 0.575 + k[0];
  hsv(hue + 0.01, 0.24, 0.78, params.top);
  hsv(hue - 0.025, 0.13, 0.71, params.bot);
}

function grow(box, x0, x1, y0, y1) {
  box[0] = Math.max(0, Math.min(box[0], Math.floor(x0)));
  box[1] = Math.min(W - 1, Math.max(box[1], Math.ceil(x1)));
  box[2] = Math.max(0, Math.min(box[2], Math.floor(y0)));
  box[3] = Math.min(H - 1, Math.max(box[3], Math.ceil(y1)));
}

// A tapered capsule, smooth-unioned into the buffer.
function capsule(buf, box, ax, ay, bx, by, ra, rb, k) {
  const M = REACH + Math.max(ra, rb);
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - M));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + M));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - M));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + M));
  if (x0 > x1 || y0 > y1) return;
  grow(box, x0, x1, y0, y1);
  const sx = bx - ax, sy = by - ay, sl = sx * sx + sy * sy || 1e-6;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - ax;
      const qy = y + 0.5 - ay;
      const u = clamp((qx * sx + qy * sy) / sl, 0, 1);
      const d = Math.hypot(qx - u * sx, qy - u * sy) - (ra + (rb - ra) * u);
      const i = y * W + x;
      const o = buf[i];
      const e = k - Math.abs(o - d);
      buf[i] = Math.min(o, d) - (e > 0 ? (e * e * 0.25) / k : 0);
    }
}

// Catmull-Rom points through a chain or ring.
function spline(f, n, closed, R, sc, out) {
  let m = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const ids = closed ? [(i - 1 + n) % n, i, (i + 1) % n, (i + 2) % n] : [Math.max(0, i - 1), i, i + 1, Math.min(n - 1, i + 2)];
    for (let k = 0; k < SUB; k++) {
      const u = k / SUB;
      const u2 = u * u;
      const u3 = u2 * u;
      const b = [-0.5 * u3 + u2 - 0.5 * u, 1.5 * u3 - 2.5 * u2 + 1, -1.5 * u3 + 2 * u2 + 0.5 * u, 0.5 * u3 - 0.5 * u2];
      out.x[m] = out.y[m] = 0;
      for (let j = 0; j < 4; j++) {
        out.x[m] += b[j] * f.x[ids[j]];
        out.y[m] += b[j] * f.y[ids[j]];
      }
      out.r[m++] = R ? Math.max(1, (R[i] + (R[ids[2]] - R[i]) * u) * sc) : 0;
    }
  }
  if (!closed) {
    out.x[m] = f.x[n - 1];
    out.y[m] = f.y[n - 1];
    out.r[m++] = R ? Math.max(1, R[n - 1] * sc) : 0;
  }
  return m;
}

// The veil: signed distance to the ring, and the nearest edge's weight.
function veil(buf, wbuf, edge, box, X, Y, n) {
  const e = bounds(X, Y, n);
  grow(box, e[0] - REACH, e[1] + REACH, e[2] - REACH, e[3] + REACH);
  for (let y = box[2]; y <= box[3]; y++) {
    const py = y + 0.5;
    for (let x = box[0]; x <= box[1]; x++) {
      const px = x + 0.5;
      let best = 1e9;
      let near = 0;
      let inside = false;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const ex = X[b] - X[a];
        const ey = Y[b] - Y[a];
        const qx = px - X[a];
        const qy = py - Y[a];
        const u = clamp((qx * ex + qy * ey) / (ex * ex + ey * ey || 1e-6), 0, 1);
        const d2 = (qx - u * ex) ** 2 + (qy - u * ey) ** 2;
        if (d2 < best) [best, near] = [d2, b];
        if (Y[a] > py !== Y[b] > py && px < (ex * (py - Y[a])) / ey + X[a]) inside = !inside;
      }
      const i = y * W + x;
      buf[i] = inside ? -Math.sqrt(best) : Math.sqrt(best);
      wbuf[i] = edge[(near / SUB) | 0];
    }
  }
}

// Distance buffer through the table into the transmission.
function apply(params, ta, tb, al) {
  const { T, buf, wbuf, box } = params;
  for (let y = box[2]; y <= box[3]; y++)
    for (let x = box[0]; x <= box[1]; x++) {
      const i = y * W + x;
      const d = buf[i];
      if (d < DMAX) {
        const q = Math.max(0, (d - DMIN) * DRES) | 0;
        const v = tb ? ta[q] + (tb[q] - ta[q]) * wbuf[i] : ta[q];
        T[i] *= 1 + (v - 1) * al;
      }
      buf[i] = BIG;
    }
}

const reset = (box) => box.splice(0, 4, W, -1, H, -1);

export function draw(display, params) {
  const { T, buf, box, top, bot, sp } = params;
  T.fill(1);
  const sc = params.scale;
  for (const f of params.floaters || []) {
    if (f.alpha <= 0.002) continue;
    reset(box);
    const X = f.x;
    const Y = f.y;
    const R = f.r;
    const dot = (i, k) => R[i] > 0 && capsule(buf, box, X[i], Y[i], X[i], Y[i], R[i] * sc, R[i] * sc, k);
    if (f.kind === VEIL) veil(buf, params.wbuf, f.edge, box, sp.x, sp.y, spline(f, f.ring, true, null, sc, sp));
    else if (f.kind === CLUSTER) for (let i = 0; i < f.n; i++) dot(i, 1);
    else {
      // Never thinner than two LEDs.
      const th = f.kind === THREAD;
      const m = spline(f, f.n, false, th ? R : null, sc, sp);
      const thin = Math.max(1, sc);
      for (let i = 0; i + 1 < m; i++) capsule(buf, box, sp.x[i], sp.y[i], sp.x[i + 1], sp.y[i + 1], th ? sp.r[i] : thin, th ? sp.r[i + 1] : thin, 0.8);
    }
    if (box[1] < 0) continue;
    apply(params, f.table, f.kind === VEIL ? f.tab2 : null, f.alpha);
    if (f.kind === BEADS) {
      reset(box);
      for (let i = 0; i < f.n; i++) dot(i, 0.5);
      if (box[1] >= 0) apply(params, f.tab2, null, f.alpha);
    }
  }
  // The sky shifts with the eye; faint clouds drift.
  const t = params.t;
  const lum = 1 + 0.035 * Math.sin(0.043 * t + 1.1) + 0.025 * Math.sin(0.0171 * t + 4);
  const c = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const Y = y + params.ey * SKYSHIFT;
    for (let x = 0; x < W; x++) {
      const X = x + params.ex * SKYSHIFT;
      const Xw = X - 0.7 * t;
      const cloud =
        0.03 * Math.sin(0.047 * X + 0.021 * Y + 0.013 * t) +
        0.022 * Math.sin(-0.031 * X + 0.052 * Y + 0.0093 * t + 2) +
        0.025 * Math.sin(0.09 * Xw + 0.05 * Y + 1.3 * Math.sin(0.06 * Y - 0.05 * X + 0.011 * t)) +
        0.018 * Math.sin(0.07 * Y + 0.11 * Xw + 3);
      const glow = 0.13 * Math.exp(-((X - SUNX) ** 2 + (Y - SUNY) ** 2) / (SUNR * SUNR));
      const L = lum * (1 + cloud);
      const tr = T[y * W + x];
      for (let j = 0; j < 3; j++) {
        const s = top[j] + (bot[j] - top[j]) * v;
        c[j] = (s + (1 - s) * glow) * L;
      }
      // Shadow greys the sky; the fringe whitens it.
      const grey = 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2];
      const m = tr < 1 ? Math.min(0.7, (1 - tr) * 1.4) : 0;
      const w = tr > 1 ? (tr - 1) * 0.15 : 0;
      for (let j = 0; j < 3; j++) c[j] = clamp(((c[j] + (grey - c[j]) * m) * tr + w) * 255, 0, 255);
      display.setPixel(x, y, c[0], c[1], c[2]);
    }
  }
}
