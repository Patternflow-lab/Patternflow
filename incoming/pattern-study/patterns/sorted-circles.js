// ===== Patternflow pattern =====
// Title:   Sorted Circles
// Family:  patternedground
// Idea:    Seen from above, frozen ground where stones and fine soil start mixed and, with every freeze and thaw, the stones slide down the heave of the soil lenses into rings of two or three pebbles round the islands of fine soil, while the frost map wanders, the islands drift, split and merge, and now and then a patch slumps and is sorted again.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: sorted patterned ground by frost heave and freeze-thaw cycles (Mark Kessler and Brad Werner, Science, 2003, from memory), pattern round 236
// Round:   236
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cycles=0.3..3, Stones=-1..1, Slope=-1..1
//
// Knob 1: Hue. Turns the pebbles and the soil round the wheel together, the soil always more than a half turn from the stones: at 0 slate pebbles on dark olive earth, at 0.25 mauve on moss, at 0.5 sand-ivory on navy and at 0.75 sage on plum. The frost is cold blue-white at every setting.
// Knob 2: Cycles. How often the ground freezes and thaws, 0.27 a second at 0.3, 1 where it opens at 2 and 2.2 at 3. The soil lenses swell 8 percent and glitter in the frost half of each cycle and darken in the thaw half, which is when the stones slide. At 0.3 the stones slide at half the rate and the rings sit looser, and the islands wander 0.6 LEDs a second, 1 where it opens and 1.4 at 3.
// Knob 3: Stones. The share of the ground that is stone, 0.14 at -1, 0.3 at 0 where it opens and 0.54 at 1, which is 290, 610 and 1110 pebbles of 2.2 to 2.6 LEDs. At -1 each island has a thin ring of its own, at 0 the rings are two pebbles thick and share their walls, and at 1 they fuse into a net of stone with the fine soil left as islands. Turning it adds and takes pebbles one at a time at random places, 48 a second or more.
// Knob 4: Slope. A hillside, -1 to 1, 0 being flat ground. It stretches the islands down the slope to 3.6 times their width at both ends, leans them 22 degrees to the left at -1 and to the right at 1, and gives the stones a downhill creep of 2.2 LEDs a second in the thaw, so the rings draw out into stripes of stone running down the panel with the fine soil between them.

const W = 64, H = 128;
const GW = 32, GH = 64, NG = GW * GH; // the ground, in cells of 2 by 2 LED
const NP = 1250;                       // pebbles the pool holds
const { floor, min, max, sqrt, exp, sin, cos, PI, abs, round, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- tunables -----------------------------------------------------------
const NDOME = 16;       // soil islands the panel holds
const RM_LO = 2.7, RM_HI = 6.0;   // ring radius in cells, 9 to 22 LED across the pebble centres
const MOB = 11;         // cells a second a pebble slides per unit of slope of the potential, at full thaw
const KAP = 1.0;        // strength of the heave of the islands
const A1 = 0.5;         // pebbles lower the heave where they lie
const P0 = 0.3, Q0 = 2.2, TH = 0.85; // pebbles push one another apart, hard above TH a cell
const JIT = 0.12;       // cells a second of shuffling

// The heave of one island over its radius in ring radii: a dome that falls to nothing short
// of the ring, a narrow trench at the ring and a wide shallow one that draws stones in.
const PT = 480, PRMAX = 2.4;
const PTOP = new Float32Array(PT + 2), PWELL = new Float32Array(PT + 2);
for (let i = 0; i <= PT + 1; i++) {
  const r = (i / PT) * PRMAX;
  const g = (a, w) => exp(-((r - a) * (r - a)) / (2 * w * w));
  PTOP[i] = g(0, 0.42);
  PWELL[i] = -0.7 * g(1, 0.17) - 0.38 * g(1, 0.62);
}

export function setup(params) {
  const st = {
    k: [0, 2, 0, 0.06], t: 0, phase: 0.45, fz: 0, init: false,
    px: new Float32Array(NP), py: new Float32Array(NP), kx: new Float32Array(NP), ky: new Float32Array(NP),
    pw: new Float32Array(NP), pa: new Uint8Array(NP), pd: new Uint8Array(NP),
    pr: new Float32Array(NP), pt: new Float32Array(NP),
    live: 0, spawnAcc: 0, free: 0, gapT: 0, claimT: 0,
    doms: [],
    dens: new Float32Array(NG), g1: new Float32Array(NG), tmp: new Float32Array(NG),
    U: new Float32Array(NG), gx: new Float32Array(NG), gy: new Float32Array(NG),
    Hf: new Float32Array(NG),
    sl: { next: 24 + 16 * Math.random(), on: 0, t: 99, x: 16, y: 32, r: 10, births: 0, bt: 0 },
    ev: { merge: 22 + 14 * Math.random(), split: 14 + 10 * Math.random() },
    grain: new Float32Array(W * H), grainB: new Float32Array(W * H), grain2: new Float32Array(GW * GH), fm: new Float32Array(NG),
    pal: new Float32Array(24),
  };
  params.st = st;
  for (let i = 0; i < W * H; i++) {
    st.grain[i] = hashf(i * 2654435761);
    st.grainB[i] = hashf(i * 97 + 12345);
  }
  for (let i = 0; i < GW * GH; i++) st.grain2[i] = hashf(i * 40503 + 977);
  // Islands start spread out: each at the best of a few random spots.
  for (let n = 0; n < NDOME; n++) spawnDome(st, 1, true);
  for (let i = 0; i < NP; i++) {
    st.pr[i] = 1.12 + 0.2 * Math.random();
    st.pt[i] = Math.random();
  }
}

function hashf(n) {
  n = Math.imul((n ^ (n >>> 15)) >>> 0, 0x2c1b3c6d);
  n = Math.imul((n ^ (n >>> 12)) >>> 0, 0x297a2d39);
  n = (n ^ (n >>> 15)) >>> 0;
  return n / 4294967296;
}

// ---- the islands ----------------------------------------------------------

function wrapd(d, n) {
  return d > n / 2 ? d - n : d < -n / 2 ? d + n : d;
}

function spawnDome(st, w, spread, at) {
  let bx = 0, by = 0, bd = -1;
  if (at) {
    bx = at.x; by = at.y;
  } else {
    for (let t = 0; t < 16; t++) {
      const x = Math.random() * GW, y = Math.random() * GH;
      let m = 1e9;
      for (const d of st.doms) {
        if (d.dying) continue;
        const dx = wrapd(x - d.x, GW), dy = wrapd(y - d.y, GH);
        m = min(m, sqrt(dx * dx + dy * dy) - d.rm);
      }
      if (m > bd) {
        bd = m; bx = x; by = y;
      }
    }
  }
  const base = RM_LO + 0.4 + Math.random() * (RM_HI - RM_LO - 1.5);
  st.doms.push({
    x: bx, y: by, vx: 0, vy: 0, base, rm: spread ? base : 2.2, amp: 0.8 + 0.3 * Math.random(), w, dying: 0, gain: 1, cnt: 0,
    p1: Math.random() * 6.28, p2: Math.random() * 6.28, p3: Math.random() * 6.28, p4: Math.random() * 6.28,
  });
}

function aliveCount(st) {
  let n = 0;
  for (const d of st.doms) if (!d.dying) n++;
  return n;
}

function stepDomes(st, dt, act, dxs, dys) {
  const doms = st.doms, t = st.t;
  const n = doms.length;
  const rms = 0.5 * act, sg = rms * 0.577, kv = 1 / 6;
  for (let i = 0; i < n; i++) {
    const d = doms[i];
    d.vx += -d.vx * kv * dt + gauss() * sg * sqrt(dt) * 0.8;
    d.vy += -d.vy * kv * dt + gauss() * sg * sqrt(dt) * 0.8;
    let px = 0, py = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const e = doms[j];
      const dx = wrapd(d.x - e.x, GW), dy = wrapd(d.y - e.y, GH);
      const r0 = 1.3 * (d.rm + e.rm), dist = sqrt(dx * dx + dy * dy) + 1e-6;
      if (dist < r0) {
        const f = (r0 - dist) / r0;
        px += (dx / dist) * f;
        py += (dy / dist) * f;
      }
    }
    d.x += (d.vx + px * 1.6 + dxs) * dt;
    d.y += (d.vy + py * 1.6 + dys) * dt;
    d.x = d.x < 0 ? d.x + GW : d.x >= GW ? d.x - GW : d.x;
    d.y = d.y < 0 ? d.y + GH : d.y >= GH ? d.y - GH : d.y;
    // The ring radius and the frost activity wander at rates that do not divide each other.
    const rmT = cl(d.base + 0.55 * sin(0.071 * t + d.p1) + 0.35 * sin(0.113 * t + d.p2), RM_LO, RM_HI);
    d.rm += (rmT - d.rm) * min(1, 0.4 * dt);
    const ampT = 0.95 + 0.3 * sin(0.047 * t + d.p3) + 0.2 * sin(0.083 * t + d.p4);
    d.amp += (ampT - d.amp) * min(1, 0.25 * dt);
    d.w = d.dying ? max(0, d.w - dt / 3) : min(1, d.w + dt / 4);
  }
  for (let i = n - 1; i >= 0; i--) {
    if (doms[i].dying && doms[i].w <= 0.001) {
      doms[i] = doms[doms.length - 1];
      doms.pop();
    }
  }
  const alive = aliveCount(st);
  // Births in the largest gap, the count held near NDOME.
  if (alive < NDOME && Math.random() < min(1, dt * 0.5 * (NDOME - alive))) spawnDome(st, 0, false);
  else if (alive < NDOME + 3 && st.gapT <= 0) {
    // A gap wider than a ring that no island claims is opened by a new one.
    st.gapT = 1.5;
    let bx = 0, by = 0, bd = -1;
    for (let q = 0; q < 14; q++) {
      const x = Math.random() * GW, y = Math.random() * GH;
      let m = 1e9;
      for (const e of doms) {
        if (e.dying) continue;
        const dx = wrapd(x - e.x, GW), dy = wrapd(y - e.y, GH);
        m = min(m, sqrt(dx * dx + dy * dy) - e.rm);
      }
      if (m > bd) {
        bd = m; bx = x; by = y;
      }
    }
    if (bd > 4.2) spawnDome(st, 0, false, { x: bx, y: by });
  }
  st.gapT -= dt;
  if (alive > NDOME + 2) {
    const pick = doms[floor(Math.random() * doms.length)];
    if (!pick.dying) pick.dying = 1;
  }
  // A lens now and then goes out and another opens elsewhere.
  if (Math.random() < dt / 280 * alive) {
    const pick = doms[floor(Math.random() * doms.length)];
    if (!pick.dying) pick.dying = 1;
  }
}

// Two neighbours become one wide island, or a wide one divides in two.
function mergeSplit(st, dt, act) {
  const ev = st.ev, doms = st.doms;
  ev.merge -= dt * act;
  ev.split -= dt * act;
  if (ev.merge <= 0) {
    ev.merge = 18 + 18 * Math.random();
    let bi = -1, bj = -1, bv = 1e9;
    for (let i = 0; i < doms.length; i++) {
      if (doms[i].dying) continue;
      for (let j = i + 1; j < doms.length; j++) {
        if (doms[j].dying) continue;
        const dx = wrapd(doms[i].x - doms[j].x, GW), dy = wrapd(doms[i].y - doms[j].y, GH);
        const v = sqrt(dx * dx + dy * dy) / (doms[i].rm + doms[j].rm);
        if (v < bv) {
          bv = v; bi = i; bj = j;
        }
      }
    }
    if (bi >= 0 && bv < 1.5) {
      const a = doms[bi], b = doms[bj];
      const dx = wrapd(b.x - a.x, GW), dy = wrapd(b.y - a.y, GH);
      a.x = frac((a.x + dx * 0.5) / GW) * GW;
      a.y = frac((a.y + dy * 0.5) / GH) * GH;
      a.base = cl(sqrt(a.rm * a.rm + b.rm * b.rm) * 0.92, RM_LO, RM_HI);
      a.rm = a.base * 0.92;
      b.dying = 1;
      b.w = min(b.w, 0.35);
    }
  }
  if (ev.split <= 0) {
    ev.split = 12 + 14 * Math.random();
    let bi = -1, bv = 0;
    for (let i = 0; i < doms.length; i++) if (!doms[i].dying && doms[i].rm > bv) (bv = doms[i].rm), (bi = i);
    if (bi >= 0 && bv > 4.2) {
      const a = doms[bi], ang = Math.random() * 6.28;
      const ox = cos(ang) * a.rm * 0.62, oy = sin(ang) * a.rm * 0.62;
      spawnDome(st, 0.5, true, { x: frac((a.x + ox) / GW) * GW, y: frac((a.y + oy) / GH) * GH });
      const c = doms[doms.length - 1];
      c.base = a.base * 0.74; c.rm = a.rm * 0.78; c.vx = ox * 0.15; c.vy = oy * 0.15;
      a.x = frac((a.x - ox) / GW) * GW;
      a.y = frac((a.y - oy) / GH) * GH;
      a.base *= 0.74; a.rm *= 0.8; a.vx = -ox * 0.15; a.vy = -oy * 0.15;
    }
  }
}

// A patch of ground lets go: the stones in it are thrown about and the islands in it close,
// so the patch is sorted again from the start.
function slump(st, dt) {
  const sl = st.sl;
  sl.t += dt;
  sl.next -= dt;
  if (sl.next <= 0) {
    sl.next = 26 + 26 * Math.random();
    sl.on = 1; sl.t = 0;
    sl.x = Math.random() * GW; sl.y = Math.random() * GH; sl.r = 8 + 5 * Math.random();
    sl.births = 2; sl.bt = 1.4;
    for (const d of st.doms) {
      const dx = wrapd(d.x - sl.x, GW), dy = wrapd(d.y - sl.y, GH);
      if (!d.dying && dx * dx + dy * dy < sl.r * sl.r * 1.1) d.dying = 1;
    }
    for (let i = 0; i < NP; i++) {
      if (!st.pa[i]) continue;
      const dx = wrapd(st.px[i] - sl.x, GW), dy = wrapd(st.py[i] - sl.y, GH);
      if (dx * dx + dy * dy < sl.r * sl.r) {
        const a = Math.random() * 6.28, v = 6 + 8 * Math.random();
        st.kx[i] = cos(a) * v;
        st.ky[i] = sin(a) * v;
      }
    }
  }
  if (sl.births > 0) {
    sl.bt -= dt;
    if (sl.bt <= 0) {
      sl.bt = 0.9;
      sl.births--;
      const a = Math.random() * 6.28, rr = Math.random() * sl.r * 0.5;
      spawnDome(st, 0, false, { x: frac((sl.x + cos(a) * rr) / GW) * GW, y: frac((sl.y + sin(a) * rr) / GH) * GH });
    }
  }
  if (sl.t > 7) sl.on = 0;
}

// ---- the heave field ------------------------------------------------------

function buildHeave(st, k4) {
  const Hf = st.Hf;
  Hf.fill(0);
  const a4 = abs(k4);
  const bx = 1 / (1 + 0.45 * a4), by = 1 + 1.5 * a4;
  const th = 0.38 * k4, sn = sin(th), cs = cos(th);
  for (const d of st.doms) {
    const amp = d.w * d.amp, gain = d.gain;
    if (amp < 0.01) continue;
    const rb = 1 + 0.08 * st.fz, su = d.rm * bx * rb, sv = d.rm * by * rb; // across and along the slope
    const ex = sn, ey = cs;               // long axis, leaning with the slope
    const R = PRMAX;
    const bw = R * sqrt((su * cs) * (su * cs) + (sv * sn) * (sv * sn));
    const bh = R * sqrt((su * sn) * (su * sn) + (sv * cs) * (sv * cs));
    const x0 = floor(d.x - bw), x1 = ceil(d.x + bw), y0 = floor(d.y - bh), y1 = ceil(d.y + bh);
    const iu = 1 / su, iv = 1 / sv, sc = PT / PRMAX;
    for (let y = y0; y <= y1; y++) {
      const yy = ((y % GH) + GH) % GH, dy = y + 0.5 - d.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - d.x;
        const dl = dx * ex + dy * ey, dc = dx * cs - dy * sn;
        const r = sqrt(dc * dc * iu * iu + dl * dl * iv * iv);
        if (r >= R) continue;
        const f = r * sc, i = floor(f), t = f - i;
        Hf[yy * GW + (((x % GW) + GW) % GW)] += amp * (PTOP[i] + (PTOP[i + 1] - PTOP[i]) * t + gain * (PWELL[i] + (PWELL[i + 1] - PWELL[i]) * t));
      }
    }
  }
}

// An island whose ring has too few stones digs its trench deeper and wider, so that the stones
// of the ground are shared among the islands and none is left bare.
function claimDomes(st, k4, dt) {
  const doms = st.doms, nd = doms.length, { px, py, pa, pd } = st;
  const a4 = abs(k4), bx = 1 / (1 + 0.45 * a4), by = 1 + 1.5 * a4, th = 0.38 * k4, sn = sin(th), cs = cos(th);
  let rs = 0;
  for (let j = 0; j < nd; j++) {
    doms[j].cnt = 0;
    if (!doms[j].dying) rs += doms[j].rm;
  }
  for (let i = 0; i < NP; i++) {
    if (!pa[i] || pd[i]) continue;
    let best = -1, bv = 1.7 * 1.7;
    for (let j = 0; j < nd; j++) {
      const d = doms[j];
      const dx = wrapd(px[i] - d.x, GW), dy = wrapd(py[i] - d.y, GH);
      const dl = dx * sn + dy * cs, dc = dx * cs - dy * sn;
      const u = dc / (d.rm * bx), v = dl / (d.rm * by), r2 = u * u + v * v;
      if (r2 < bv) {
        bv = r2; best = j;
      }
    }
    if (best >= 0) doms[best].cnt++;
  }
  for (let j = 0; j < nd; j++) {
    const d = doms[j];
    if (d.dying) continue;
    const need = max(1, 0.8 * st.live * d.rm / max(rs, 1));
    const gT = cl(1 + 1.4 * (1 - d.cnt / need), 0.35, 2.4);
    d.gain += (gT - d.gain) * min(1, dt * 0.5);
  }
}

// ---- the stones -------------------------------------------------------------

function blur1(src, dst, tmp) {
  const w0 = 0.399, w1 = 0.242, w2 = 0.054, w3 = 0.0044;
  for (let y = 0; y < GH; y++) {
    const r = y * GW;
    for (let x = 0; x < GW; x++) {
      const xm1 = (x + GW - 1) % GW, xm2 = (x + GW - 2) % GW, xm3 = (x + GW - 3) % GW;
      const xp1 = (x + 1) % GW, xp2 = (x + 2) % GW, xp3 = (x + 3) % GW;
      tmp[r + x] = w0 * src[r + x] + w1 * (src[r + xm1] + src[r + xp1]) + w2 * (src[r + xm2] + src[r + xp2]) + w3 * (src[r + xm3] + src[r + xp3]);
    }
  }
  for (let y = 0; y < GH; y++) {
    const ym1 = ((y + GH - 1) % GH) * GW, ym2 = ((y + GH - 2) % GH) * GW, ym3 = ((y + GH - 3) % GH) * GW;
    const yp1 = ((y + 1) % GH) * GW, yp2 = ((y + 2) % GH) * GW, yp3 = ((y + 3) % GH) * GW, r = y * GW;
    for (let x = 0; x < GW; x++)
      dst[r + x] = w0 * tmp[r + x] + w1 * (tmp[ym1 + x] + tmp[yp1 + x]) + w2 * (tmp[ym2 + x] + tmp[yp2 + x]) + w3 * (tmp[ym3 + x] + tmp[yp3 + x]);
  }
}

function stepStones(st, dt, gate, dxs, dys) {
  const { px, py, kx, ky, pw, pa, dens, g1, tmp, U, gx, gy, Hf } = st;
  dens.fill(0);
  for (let i = 0; i < NP; i++) {
    if (!pa[i]) continue;
    const fx = px[i] - 0.5, fy = py[i] - 0.5;
    const x0 = floor(fx), y0 = floor(fy), tx = fx - x0, ty = fy - y0, w = pw[i];
    const xa = x0 < 0 ? GW - 1 : x0, xb = xa + 1 >= GW ? 0 : xa + 1;
    const ya = y0 < 0 ? GH - 1 : y0, yb = ya + 1 >= GH ? 0 : ya + 1;
    dens[ya * GW + xa] += w * (1 - tx) * (1 - ty);
    dens[ya * GW + xb] += w * tx * (1 - ty);
    dens[yb * GW + xa] += w * (1 - tx) * ty;
    dens[yb * GW + xb] += w * tx * ty;
  }
  blur1(dens, g1, tmp);
  for (let c = 0; c < NG; c++) {
    const d = dens[c];
    U[c] = KAP * Hf[c] - A1 * g1[c] + P0 * d + Q0 * max(0, d - TH);
  }
  for (let y = 0; y < GH; y++) {
    const ru = ((y + GH - 1) % GH) * GW, rd = ((y + 1) % GH) * GW, r = y * GW;
    for (let x = 0; x < GW; x++) {
      const xl = (x + GW - 1) % GW, xr = (x + 1) % GW;
      gx[r + x] = (U[r + xr] - U[r + xl]) * 0.5;
      gy[r + x] = (U[rd + x] - U[ru + x]) * 0.5;
    }
  }
  const mob = MOB * gate, jit = JIT * sqrt(dt), kd = exp(-dt * 2.2);
  for (let i = 0; i < NP; i++) {
    if (!pa[i]) continue;
    let x = px[i], y = py[i];
    const fx = x - 0.5, fy = y - 0.5;
    const x0 = floor(fx), y0 = floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = x0 < 0 ? GW - 1 : x0, xb = xa + 1 >= GW ? 0 : xa + 1;
    const ya = y0 < 0 ? GH - 1 : y0, yb = ya + 1 >= GH ? 0 : ya + 1;
    const i00 = ya * GW + xa, i10 = ya * GW + xb, i01 = yb * GW + xa, i11 = yb * GW + xb;
    const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
    const sx = gx[i00] * w00 + gx[i10] * w10 + gx[i01] * w01 + gx[i11] * w11;
    const sy = gy[i00] * w00 + gy[i10] * w10 + gy[i01] * w01 + gy[i11] * w11;
    let vx = -mob * sx + dxs * gate + kx[i], vy = -mob * sy + dys * gate + ky[i];
    let sxm = vx * dt, sym = vy * dt;
    const L = sqrt(sxm * sxm + sym * sym);
    if (L > 0.5) {
      sxm *= 0.5 / L;
      sym *= 0.5 / L;
    }
    x += sxm + gauss() * jit;
    y += sym + gauss() * jit;
    kx[i] *= kd;
    ky[i] *= kd;
    px[i] = x < 0 ? x + GW : x >= GW ? x - GW : x;
    py[i] = y < 0 ? y + GH : y >= GH ? y - GH : y;
  }
}

function fadePebbles(st, dt) {
  const { pw, pa, pd } = st;
  const up = dt / 0.9, dn = dt / 0.9;
  for (let i = 0; i < NP; i++) {
    if (!pa[i]) continue;
    if (pd[i]) {
      pw[i] -= dn;
      if (pw[i] <= 0) {
        pa[i] = 0; pd[i] = 0; pw[i] = 0;
      }
    } else if (pw[i] < 1) pw[i] = min(1, pw[i] + up);
  }
}

// Pebbles are added at random places and taken from random ones, a few at a time.
function adjustCount(st, target, dt, instant) {
  const { pa, pd, pw, px, py, kx, ky } = st;
  let live = 0;
  for (let i = 0; i < NP; i++) if (pa[i] && !pd[i]) live++;
  st.live = live;
  let diff = target - live;
  let budget = instant ? 1e9 : (st.spawnAcc += dt * (8 + abs(diff) * 0.5 + 40)) | 0;
  if (!instant) st.spawnAcc -= budget;
  while (diff > 0 && budget > 0) {
    let i = st.free;
    let guard = 0;
    while (pa[i] && guard++ < NP) i = (i + 1) % NP;
    if (pa[i]) break;
    st.free = (i + 1) % NP;
    pa[i] = 1; pd[i] = 0; pw[i] = instant ? 1 : 0;
    px[i] = Math.random() * GW; py[i] = Math.random() * GH; kx[i] = 0; ky[i] = 0;
    diff--; budget--;
  }
  while (diff < 0 && budget > 0) {
    let i = floor(Math.random() * NP), guard = 0;
    while ((!pa[i] || pd[i]) && guard++ < NP) i = (i + 1) % NP;
    if (!pa[i] || pd[i]) break;
    pd[i] = 1;
    diff++; budget--;
  }
}

// ---- time ---------------------------------------------------------------------

const freezeOf = (ph) => (ph < 0.5 ? sstep(0, 0.5, ph) : 1 - sstep(0.5, 0.82, ph));
const rateOf = (k2) => Math.pow(2, (k2 - 2) / 0.9);
// How much of its slide a pebble gets at this point of a cycle: a little all the time, most in the thaw.
const thawGate = (ph) => 0.12 + (ph >= 0.5 ? 1.6 * sin(PI * (2 * ph - 1)) : 0);

function knobsOf(st, kv) {
  const k = [kv[0], cl(kv[1], 0.3, 3), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  st.k = k;
  const a4 = abs(k[3]), th = 0.38 * k[3];
  // The downhill creep of the stones, and half of it for the islands, along the leaning slope.
  st.dxs = sin(th) * 1.1 * a4;
  st.dys = cos(th) * 1.1 * a4;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  knobsOf(st, kv);
  const rate = rateOf(st.k[1]);
  const act = 0.4 + 0.6 * Math.pow(rate, 0.7);
  const target = round((0.3 + (st.k[2] < 0 ? 0.16 : 0.24) * st.k[2]) * NG);
  if (!st.init) {
    st.init = true;
    adjustCount(st, target, 0, true);
    // Sixty freeze-thaw cycles beforehand, one second of ground each, the sorting already well on its way.
    for (let c = 0; c < 60; c++) {
      st.t += 1;
      stepDomes(st, 1, act, st.dxs * 0.5, st.dys * 0.5);
      mergeSplit(st, 1, act);
      buildHeave(st, st.k[3]);
      for (let s = 0; s < 5; s++) stepStones(st, 0.2, 0.75, st.dxs, st.dys);
      if (c % 2) claimDomes(st, st.k[3], 2);
    }
    for (const sl of [st.sl]) {
      sl.t = 99; sl.on = 0; sl.births = 0;
    }
    for (let i = 0; i < NP; i++) {
      st.kx[i] = 0; st.ky[i] = 0;
    }
  }
  const d = cl(dt || 0, 0, 0.1);
  if (d <= 0) return;
  st.t += d;
  st.phase = frac(st.phase + d * rate);
  st.fz = freezeOf(st.phase);
  stepDomes(st, d, act, st.dxs * 0.5, st.dys * 0.5);
  mergeSplit(st, d, act);
  slump(st, d);
  buildHeave(st, st.k[3]);
  adjustCount(st, target, d, false);
  fadePebbles(st, d);
  st.claimT -= d;
  if (st.claimT <= 0) {
    claimDomes(st, st.k[3], 0.25);
    st.claimT = 0.25;
  }
  const n = max(1, ceil(d / 0.04)), h = d / n;
  for (let s = 0; s < n; s++) stepStones(st, h, thawGate(st.phase) * (0.35 + 0.65 * min(1, rate)), st.dxs, st.dys);
}

// ---- the picture ----------------------------------------------------------------

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const hue = st.k[0], pal = st.pal, Hf = st.Hf, grain = st.grain, grainB = st.grainB, grain2 = st.grain2;
  const ph = st.phase, rate = rateOf(st.k[1]);
  // Palette. Stones, soil in two lightnesses, the frost and the thaw.
  const hp = 0.58 + hue;
  const hs = hp + 0.56 + 0.05 * sin(6.2832 * 2 * hue);
  hsv(hp, 0.2, 0.88, pal, 0);        // pebble
  hsv(hs, 0.68, 0.27, pal, 3);       // soil, dark
  hsv(hs + 0.02, 0.55, 0.50, pal, 6); // soil, heaved
  hsv(0.55, 0.28, 0.92, pal, 9);      // frost
  const pr = pal[0], pg = pal[1], pb = pal[2];
  const sr0 = pal[3], sg0 = pal[4], sb0 = pal[5], sr1 = pal[6], sg1 = pal[7], sb1 = pal[8], fr = pal[9], fg = pal[10], fb = pal[11];
  // The cycle: ice builds through the frost half and goes in the thaw, which is wet and dark.
  const freeze = freezeOf(ph);
  const wet = ph >= 0.5 ? sin(PI * cl((ph - 0.5) / 0.5, 0, 1)) : 0;
  const depth = 1 / (1 + 0.3 * max(0, rate - 1));
  const sl = st.sl;
  const slEnv = sl.on ? sstep(0, 0.4, sl.t) * (1 - sstep(2.5, 7, sl.t)) : 0;
  const slX = sl.x * 2, slY = sl.y * 2, slR = sl.r * 2;
  const buf = st.frame || (st.frame = new Float32Array(W * H * 3));
  // The frost-depth map: where the ice lenses are most active wanders slowly, at rates that do not divide each other.
  const fm = st.fm, tt = st.t;
  for (let cy = 0, c = 0; cy < GH; cy++)
    for (let cx = 0; cx < GW; cx++, c++)
      fm[c] = cl(0.5 + 0.28 * sin(0.19 * cx + 0.11 * cy + 0.037 * tt + 1.3) + 0.2 * sin(-0.13 * cx + 0.17 * cy - 0.052 * tt + 4.2) + 0.15 * sin(0.07 * cx - 0.23 * cy + 0.029 * tt + 2.7), 0, 1);
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) / 2 - 0.5;
    const y0 = floor(fy), ty = fy - y0;
    const ya = ((y0 % GH) + GH) % GH, yb = (ya + 1) % GH;
    for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) / 2 - 0.5;
      const x0 = floor(fx), tx = fx - x0;
      const xa = ((x0 % GW) + GW) % GW, xb = (xa + 1) % GW;
      const hv = (Hf[ya * GW + xa] * (1 - tx) + Hf[ya * GW + xb] * tx) * (1 - ty) + (Hf[yb * GW + xa] * (1 - tx) + Hf[yb * GW + xb] * tx) * ty;
      const top = cl(hv, 0, 1.2);
      const groove = cl((-hv - 0.5) * 1.8, 0, 1);
      const o2 = y * W + x, gi = grain[o2];
      const g = 0.55 * gi + 0.45 * grain2[(y >> 1) * GW + (x >> 1)];
      const fmv = fm[(y >> 1) * GW + (x >> 1)];
      // Soil lightness: grain, the frost-depth mottle, the dark of the thaw and the trench under a ring.
      let v = (0.72 + 0.56 * g) * (0.86 + 0.28 * fmv);
      const heave = top * freeze * depth;
      const mixh = cl(heave * 0.85, 0, 1);
      let r = sr0 + (sr1 - sr0) * mixh, gg = sg0 + (sg1 - sg0) * mixh, b = sb0 + (sb1 - sb0) * mixh;
      v *= (1 - 0.26 * wet * depth) * (1 - 0.3 * groove);
      const cold = heave * 0.22;
      r = (r * (1 - cold) + fr * cold) * v; gg = (gg * (1 - cold) + fg * cold) * v; b = (b * (1 - cold) + fb * cold) * v;
      // Frost glitter, grain by grain, each grain breathing at its own pace: dense on the swollen lens, sparse elsewhere.
      const lvl = (0.05 + 0.55 * heave) * (0.55 + 0.9 * fmv) * freeze * depth;
      if (lvl > 0.01) {
        const sp = sstep(1 - lvl, 1 - lvl + 0.22, gi) * (0.5 + 0.5 * sin(6.2832 * grainB[o2] + st.t * (2 + 3 * grainB[o2])));
        r += (fr - r) * sp * 0.75; gg += (fg - gg) * sp * 0.75; b += (fb - b) * sp * 0.75;
      }
      if (slEnv > 0.01) {
        const dx = wrapd(x - slX, W), dy = wrapd(y - slY, H);
        const q = 1 - sstep(0.4, 1, sqrt(dx * dx + dy * dy) / slR);
        const k = 1 - 0.4 * slEnv * q;
        r *= k; gg *= k; b *= k;
      }
      const o = (y * W + x) * 3;
      buf[o] = r; buf[o + 1] = gg; buf[o + 2] = b;
    }
  }
  // Pebbles, round, a touch lighter at the upper left.
  const { px, py, pw, pa, pr: rad, pt } = st;
  for (let i = 0; i < NP; i++) {
    if (!pa[i]) continue;
    const w = pw[i];
    if (w < 0.03) continue;
    const cx = px[i] * 2, cy = py[i] * 2;
    const r = rad[i] * (0.5 + 0.5 * w);
    const tone = 0.84 + 0.26 * pt[i];
    const x0 = max(0, floor(cx - r - 0.6)), x1 = min(W - 1, floor(cx + r + 0.6));
    const y0 = max(0, floor(cy - r - 0.6)), y1 = min(H - 1, floor(cy + r + 0.6));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, d = sqrt(dx * dx + dy * dy);
        const c = cl(r + 0.5 - d, 0, 1) * min(1, w * 1.5);
        if (c <= 0) continue;
        const lit = cl(0.5 - 0.5 * (dx + dy) / (1.41 * r), 0, 1);
        const edge = sstep(0.55, 1.05, d / r);
        const vv = tone * (0.6 + 0.4 * lit) * (1 - 0.4 * edge);
        const o = (y * W + x) * 3;
        buf[o] += (pr * vv - buf[o]) * c;
        buf[o + 1] += (pg * vv - buf[o + 1]) * c;
        buf[o + 2] += (pb * vv - buf[o + 2]) * c;
      }
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, round(min(1, buf[o]) * 255), round(min(1, buf[o + 1]) * 255), round(min(1, buf[o + 2]) * 255));
}
