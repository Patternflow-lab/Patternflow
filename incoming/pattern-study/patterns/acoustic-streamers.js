// ===== Patternflow pattern =====
// Title:   Acoustic Streamers
// Family:  cavitation
// Idea:    Under an ultrasonic horn at the top of a tank, a few hundred gas bubbles are pushed into flat layers by the standing sound, attract each other into branching pale filaments that run down the jets and sideways along the layers, and now and then one swells, collapses in a white-cyan flash with a faint expanding ring, and breaks into new seeds for the next filament.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: acoustic streamers in cavitation (Bjerknes forces on bubbles in a sound field, Vilhelm Bjerknes 1906 and Carl Bjerknes 1880s, from memory; bubble clusters of that kind first filmed by Lauterborn and co-workers in the 1990s, from memory)
// Round:   230
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.4..3, Pitch=-1..1, Gas=-1..1
//
// Knob 1: Hue. The colour of the water and the filaments, round the whole wheel from teal-blue at 0; the flashes stay white.
// Knob 2: Drive. How hard the horn drives the tank: weak, there are few filaments and rare flashes; strong, the layers grip harder and the bubbles collapse more often and brighter.
// Knob 3: Pitch. The frequency of the horn: up, the antinode layers crowd together from 22 LEDs apart to 8; down, they spread out.
// Knob 4: Gas. How much gas the water holds: more gas, more nuclei and more filaments, and the bubbly water detunes the sound field faster so the layers swim.

const W = 64, H = 128;
const { floor, sqrt, abs, exp, sin, cos, PI, min, max, cbrt, pow, log2 } = Math;
const TAU = PI * 2;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const HY = 4; // rows 0 to 3 are the horn, its face is the lower edge of row 3
const HX0 = 15, HX1 = 49; // horn bar
const NB = 420; // bubbles at most
const NF = 48; // flashes at most
const SUB = 1 / 50; // substep

// The hue the water opens on at Hue 0.
const H0 = 0.52;

const RP = 9; // reach of the pull between bubbles
const GS = 1.6; // its top speed, LEDs a second
const RR = 2.3; // closer than this they push apart
const GR = 10;
const TAU_V = 0.22; // how fast a bubble's velocity follows its target
const VL = 6; // top speed of the pull towards a layer, LEDs a second
const DIFF = 0.5; // random walk, LED^2 a second
const UJ = 5; // speed of the jets under the horn
const GROW = 0.035, THR = 0.2, DISS = 0.0015;
const HZ = 0.55; // collapse hazard

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

const RL = 9; // threads reach this far
const TS = 0.8; // thread half-width

// A soft line from (ax, ay) to (bx, by), strongest where the ends are close.
function thread(L, ax, ay, bx, by, amp, reach) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const len = sqrt(len2);
  amp *= 1 - 0.55 * min(1, len / reach);
  const inv = 1 / (2 * TS * TS);
  const rad = 2.6 * TS;
  const x0 = max(0, floor(min(ax, bx) - rad)), x1 = min(W - 1, floor(max(ax, bx) + rad));
  const y0 = max(0, floor(min(ay, by) - rad)), y1 = min(H - 1, floor(max(ay, by) + rad));
  const il = len2 > 1e-6 ? 1 / len2 : 0;
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const px = xx + 0.5 - ax, py = yy + 0.5 - ay;
      const u = cl((px * dx + py * dy) * il, 0, 1);
      const ex = px - u * dx, ey = py - u * dy;
      L[yy * W + xx] += amp * exp(-(ex * ex + ey * ey) * inv);
    }
  }
}

// A soft curve from a to b, leaving a along (tax, tay) and arriving along (tbx, tby), drawn as a row of
// stamps 1.3 sigma apart (the ripple of such a row is under 1%) so it is even along its length. amp is the strength at the middle of the line.
function curve(L, ax, ay, tax, tay, bx, by, tbx, tby, sg, amp) {
  const dx = bx - ax, dy = by - ay;
  const len = sqrt(dx * dx + dy * dy);
  if (len < 0.01) return;
  const k = 0.38 * len;
  const c1x = ax + tax * k, c1y = ay + tay * k, c2x = bx + tbx * k, c2y = by + tby * k;
  const steps = max(2, floor(len / (1.3 * sg)));
  const inv = 1 / (2 * sg * sg);
  const rad = 2.6 * sg;
  const A = (amp * (len / steps)) / (sg * 2.5066);
  for (let q = 0; q <= steps; q++) {
    const u = q / steps, v = 1 - u;
    const w0 = v * v * v, w1 = 3 * v * v * u, w2 = 3 * v * u * u, w3 = u * u * u;
    const px = w0 * ax + w1 * c1x + w2 * c2x + w3 * bx;
    const py = w0 * ay + w1 * c1y + w2 * c2y + w3 * by;
    const x0 = max(0, floor(px - rad)), x1 = min(W - 1, floor(px + rad));
    const y0 = max(0, floor(py - rad)), y1 = min(H - 1, floor(py + rad));
    for (let yy = y0; yy <= y1; yy++) {
      const ey = yy + 0.5 - py;
      for (let xx = x0; xx <= x1; xx++) {
        const ex = xx + 0.5 - px;
        L[yy * W + xx] += A * exp(-(ex * ex + ey * ey) * inv);
      }
    }
  }
}

export function setup(params) {
  Object.assign(params, {
    n: 0,
    hi: 0,
    serial: 0,
    al: new Uint8Array(NB),
    sid: new Int32Array(NB),
    par: new Int16Array(NB).fill(-1),
    pid: new Int32Array(NB),
    lk: new Float32Array(NB),
    wt: new Float32Array(NB),
    ord: [],
    act: new Int16Array(NB),
    x: new Float32Array(NB),
    y: new Float32Array(NB),
    vx: new Float32Array(NB),
    vy: new Float32Array(NB),
    r: new Float32Array(NB),
    nb: new Int16Array(NB * 2),
    ax: new Float32Array(NB),
    ay: new Float32Array(NB),
    nf: 0,
    fx: new Float32Array(NF),
    fy: new Float32Array(NF),
    fa: new Float32Array(NF),
    fs: new Float32Array(NF),
    L: new Float32Array(W * H),
    buf: new Float32Array(W * H * 3),
    t: 0,
    psi: 0,
    th1: 1.1,
    th2: 4.2,
    s: 13,
    accF: 0,
    accB: 0,
    kn: [0, 2, 0, 0.06],
    started: false,
    flashes: 0,
    fi: 0,
    col: [0, 0, 0],
  });
}

function spawn(P, x, y, r, vx, vy) {
  let i = 0;
  while (i < NB && P.al[i]) i++;
  if (i >= NB) return;
  P.al[i] = 1;
  P.sid[i] = ++P.serial;
  P.par[i] = -1;
  P.lk[i] = 0;
  P.x[i] = x;
  P.y[i] = y;
  P.r[i] = r;
  P.vx[i] = vx;
  P.vy[i] = vy;
  if (i >= P.hi) P.hi = i + 1;
  P.n++;
  P.dBirth = (P.dBirth || 0) + 1;
}

function kill(P, i) {
  P.al[i] = 0;
  P.n--;
}

// No bubble within 2.6 LEDs of (x, y): a nucleus does not start inside another bubble.
function free(P, x, y) {
  for (let i = 0; i < P.hi; i++) {
    if (!P.al[i]) continue;
    const dx = P.x[i] - x, dy = P.y[i] - y;
    if (dx * dx + dy * dy < 6.8) return false;
  }
  return true;
}

function flash(P, x, y, s) {
  const k = P.nf < NF ? P.nf++ : P.fi++ % NF;
  P.fx[k] = x;
  P.fy[k] = y;
  P.fa[k] = 0;
  P.fs[k] = s;
  P.flashes++;
}

// Layer phase at column x: the antinodes sit where it is a multiple of 2 pi.
function warp(P, x) {
  const a = TAU * (x - 32);
  return 1.5 * sin(a / 86 + P.th1) + 0.55 * sin(a / 33 + P.th2);
}
function dwarp(P, x) {
  const a = TAU * (x - 32);
  return ((1.5 * TAU) / 86) * cos(a / 86 + P.th1) + ((0.55 * TAU) / 33) * cos(a / 33 + P.th2);
}

function step(P, h) {
  const k = P.kn;
  const drive = cl(k[1] / 2, 0.15, 2);
  const s0 = 13.3 * pow(1.66, -k[2]);
  const gas = pow(2, 1.5 * k[3]);
  const det = pow(2, 0.6 * k[3]);
  P.t += h;
  const t = P.t;
  const s = (P.s = s0 * (1 + 0.05 * sin((TAU * t) / 97 + 1.3) + 0.035 * sin((TAU * t) / 57 + 4)));
  const vd = 0.05 + det * 0.3 * (sin((TAU * t) / 73 + 0.7) + 0.7 * sin((TAU * t) / 41 + 2.1) + 0.5 * sin((TAU * t) / 131 + 4));
  P.psi += ((TAU * vd) / s) * h;
  P.th1 += (h * TAU) / 110;
  P.th2 += (h * TAU) / 67;

  const { x, y, vx, vy, r, ax, ay, al, act, par, pid, sid, lk } = P;
  let na = 0;
  for (let i = 0; i < P.hi; i++) if (al[i]) act[na++] = i;

  // Jets run down from the horn face; their columns wander.
  const jx0 = 32 + 13 * sin((TAU * t) / 83 + 0.5);
  const jx1 = 32 + 15 * sin((TAU * t) / 61 + 2.6);
  const jx2 = 32 + 11 * sin((TAU * t) / 107 + 4.4);

  // Pull between bubbles, and the merge of two that touch.
  for (let a = 0; a < na; a++) (ax[act[a]] = 0), (ay[act[a]] = 0);
  const R2 = RP * RP;
  for (let a = 0; a < na; a++) {
    const i = act[a];
    if (!al[i]) continue;
    for (let b = a + 1; b < na; b++) {
      const j = act[b];
      if (!al[j]) continue;
      const dx = x[j] - x[i];
      if (dx > RP || dx < -RP) continue;
      const dy = y[j] - y[i];
      const d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const d = sqrt(d2) + 1e-4;
      if (d < 0.45 * (r[i] + r[j]) + 0.25) {
        // merge j into i, conserving gas volume
        const vi = r[i] * r[i] * r[i], vj = r[j] * r[j] * r[j], vt = vi + vj;
        x[i] = (x[i] * vi + x[j] * vj) / vt;
        y[i] = (y[i] * vi + y[j] * vj) / vt;
        vx[i] = (vx[i] * vi + vx[j] * vj) / vt;
        vy[i] = (vy[i] * vi + vy[j] * vj) / vt;
        r[i] = cbrt(vt);
        kill(P, j);
        P.dMer = (P.dMer || 0) + 1;
        continue;
      }
      const f = d < RR ? (-GR * (RR - d)) / RR : GS * sin((PI * (d - RR)) / (RP - RR));
      const ux = dx / d, uy = dy / d;
      ax[i] += f * (0.5 + r[j]) * ux;
      ay[i] += f * (0.5 + r[j]) * uy;
      ax[j] -= f * (0.5 + r[i]) * ux;
      ay[j] -= f * (0.5 + r[i]) * uy;
    }
  }

  const rate = 1 - exp(-h / TAU_V);
  const dN = sqrt(2 * DIFF * h);
  for (let a = 0; a < na; a++) {
    const i = act[a];
    if (!al[i]) continue;
    const xi = x[i], yi = y[i];
    const hw = 19 + 0.17 * yi;
    const u = (xi - 32) / hw, u2 = u * u;
    const dep = max(0, yi - HY);
    const env = drive * exp(-0.7 * u2 * u2) * (0.4 + 0.6 * exp(-dep / 60));
    const phi = (TAU * (yi - HY)) / s - P.psi + warp(P, xi);
    const e = 0.5 * (1 + cos(phi));
    const sp = sin(phi);
    // pull towards the nearest antinode layer, along the layer's normal
    const gx = (dwarp(P, xi) * s) / TAU;
    const gn = 1 / sqrt(gx * gx + 1);
    const pull = -VL * env * sp;
    const vtx = pull * gx * gn + ax[i];
    let vty = pull * gn + ay[i];
    // jets
    const jd = exp(-dep / 45) * UJ * drive;
    let dj = (xi - jx0) / 5;
    let g = exp(-dj * dj);
    dj = (xi - jx1) / 5;
    g += exp(-dj * dj);
    dj = (xi - jx2) / 6;
    g += exp(-dj * dj);
    vty += jd * g;
    vx[i] += (vtx - vx[i]) * rate;
    vy[i] += (vty - vy[i]) * rate;
    const gn1 = (rnd() + rnd() + rnd() - 1.5) * 2, gn2 = (rnd() + rnd() + rnd() - 1.5) * 2;
    x[i] += vx[i] * h + gn1 * dN;
    y[i] += vy[i] * h + gn2 * dN;
    if (y[i] < HY) (y[i] = HY), (vy[i] = abs(vy[i]));
    // gas moves in and out of the bubble
    const eff = env * e;
    r[i] += h * (GROW * (eff - THR) - DISS / r[i]);
    if (r[i] < 0.2 || y[i] > H + 6 || x[i] < -6 || x[i] > W + 6) {
      if (r[i] < 0.2) P.dDis = (P.dDis || 0) + 1;
      else P.dOut = (P.dOut || 0) + 1;
      kill(P, i);
      continue;
    }

    // the thread this bubble hangs from: the nearest bubble a layer above, or the horn
    let p = par[i];
    if (p >= 0) {
      const dx = x[p] - x[i], dy = y[p] - y[i];
      if (!al[p] || sid[p] !== pid[i] || dy > -0.25 * s || dx * dx + dy * dy > 1.9 * min(1.7 * s, 24) * min(1.7 * s, 24)) p = -1;
    } else if (p === -2 && y[i] - HY > 1.0 * s) p = -1;
    if (p === -1 && rnd() < 5 * h) {
      const reach = min(1.7 * s, 24);
      let best = reach * reach, bj = -1;
      for (let b = 0; b < na; b++) {
        const j = act[b];
        if (!al[j] || j === i) continue;
        const dy = y[j] - y[i];
        if (dy > -0.45 * s) continue;
        const dx = x[j] - x[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < best) (best = d2), (bj = j);
      }
      if (bj >= 0) (p = bj), (pid[i] = sid[bj]), (lk[i] = 0);
      else if (y[i] - HY < 0.8 * s) (p = -2), (lk[i] = 0);
    }
    par[i] = p;
    if (p === -1) lk[i] = 0;
    else lk[i] = min(1, lk[i] + h / 0.9);

    // collapse
    const hz = HZ * pow(eff, 1.3) * sm(0.85, 1.5, r[i]) ** 2;
    if (rnd() < hz * h) {
      const big = cl(0.45 + 0.5 * r[i], 0.4, 1.3);
      flash(P, x[i], y[i], big * (0.6 + 0.4 * drive));
      // the shock pushes the neighbours away
      for (let b = 0; b < na; b++) {
        const j = act[b];
        if (j === i || !al[j]) continue;
        const dx = x[j] - x[i], dy = y[j] - y[i];
        const d2 = dx * dx + dy * dy;
        if (d2 > 144) continue;
        const d = sqrt(d2) + 0.3;
        const kick = (10 * (1 - d / 12) * (1 - d / 12) * big) / (1 + 0.3 * d);
        vx[j] += (dx / d) * kick;
        vy[j] += (dy / d) * kick;
      }
      const nd = 1 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0);
      const xi2 = x[i], yi2 = y[i];
      kill(P, i);
      for (let q = 0; q < nd; q++) {
        const ang = rnd() * TAU;
        spawn(P, xi2 + cos(ang) * 1.5, yi2 + sin(ang) * 1.5, 0.3 + 0.12 * rnd(), cos(ang) * 6, sin(ang) * 6);
      }
    }
  }

  // nucleation, at the horn face and where the sound is loud
  const capf = max(0, 1 - P.n / 380);
  const lo = P.n < 25 ? 3 : 1;
  P.accF += 1.5 * drive * gas * capf * lo * h;
  while (P.accF >= 1) {
    P.accF -= 1;
    for (let tries = 0; tries < 6; tries++) {
      const xx = HX0 + 2 + rnd() * (HX1 - HX0 - 4), yy = HY + rnd() * 3;
      if (free(P, xx, yy)) {
        spawn(P, xx, yy, 0.38 + 0.1 * rnd(), 0, 4);
        break;
      }
    }
  }
  P.accB += 12 * drive * gas * capf * lo * h;
  while (P.accB >= 1) {
    P.accB -= 1;
    for (let tries = 0; tries < 8; tries++) {
      const xx = rnd() * W, yy = HY + 1 + rnd() * (H - HY - 1);
      const hw = 19 + 0.17 * yy, u = (xx - 32) / hw;
      const env = exp(-0.7 * u * u * u * u) * (0.4 + 0.6 * exp(-(yy - HY) / 60));
      const e = 0.5 * (1 + cos((TAU * (yy - HY)) / s - P.psi + warp(P, xx)));
      if (rnd() < pow(env * e, 1.5) && free(P, xx, yy)) {
        spawn(P, xx, yy, 0.38 + 0.1 * rnd(), 0, 0);
        break;
      }
    }
  }

  // flashes age
  for (let q = 0; q < P.nf; q++) P.fa[q] += h;
}

export function update(dt, input, params) {
  dt = Math.min(dt, 0.1);
  const kv = input.knobValues;
  const k = params.kn;
  for (let i = 0; i < 4; i++) k[i] = kv[i];
  if (!params.started) {
    params.started = true;
    for (let q = 0; q < 28 * 25; q++) step(params, 1 / 25);
    params.flashes = 0;
    params.nf = 0;
  }
  let left = dt;
  while (left > 1e-6) {
    const h = min(SUB, left);
    step(params, h);
    left -= h;
  }
}

export function draw(display, params) {
  const P = params;
  const L = P.L, buf = P.buf;
  L.fill(0);
  buf.fill(0);
  const hue = H0 + P.kn[0] + 0.035 * sin((TAU * P.t) / 143) + 0.025 * sin((TAU * P.t) / 89 + 2);
  const drive = cl(P.kn[1] / 2, 0.15, 2);

  const hi = P.hi, al = P.al;
  // bubbles as soft discs
  for (let i = 0; i < hi; i++) {
    if (!al[i]) continue;
    const r = P.r[i];
    const sg = 0.75 + 0.5 * r;
    const amp = 0.5 + 0.22 * r;
    const inv = 1 / (2 * sg * sg);
    const rad = 3 * sg;
    const xi = P.x[i], yi = P.y[i];
    const x0 = max(0, floor(xi - rad)), x1 = min(W - 1, floor(xi + rad));
    const y0 = max(0, floor(yi - rad)), y1 = min(H - 1, floor(yi + rad));
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - yi;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - xi;
        L[yy * W + xx] += amp * exp(-(dx * dx + dy * dy) * inv);
      }
    }
  }

  // chains along a layer: each bubble holds on to its two nearest
  const nb = P.nb;
  for (let i = 0; i < hi; i++) {
    nb[i * 2] = nb[i * 2 + 1] = -1;
    if (!al[i]) continue;
    let d1 = RL * RL, d2 = RL * RL, j1 = -1, j2 = -1;
    const xi = P.x[i], yi = P.y[i];
    for (let j = 0; j < hi; j++) {
      if (j === i || !al[j]) continue;
      const dx = P.x[j] - xi;
      if (dx > RL || dx < -RL) continue;
      const dy = P.y[j] - yi;
      const dd = dx * dx + dy * dy;
      if (dd < d1) (d2 = d1), (j2 = j1), (d1 = dd), (j1 = j);
      else if (dd < d2) (d2 = dd), (j2 = j);
    }
    nb[i * 2] = j1;
    nb[i * 2 + 1] = j2;
  }
  for (let i = 0; i < hi; i++) {
    if (!al[i]) continue;
    for (let q = 0; q < 2; q++) {
      const j = nb[i * 2 + q];
      if (j < 0) continue;
      if (j < i && (nb[j * 2] === i || nb[j * 2 + 1] === i)) continue;
      thread(L, P.x[i], P.y[i], P.x[j], P.y[j], 0.3 + 0.14 * (P.r[i] + P.r[j]), RL);
    }
  }
  // The threads that hang each bubble from the layer above, down from the horn. A thread is as thick as
  // the bubbles hanging below it, so the trunks under the horn are stout and the twigs are fine.
  const ord = P.ord, wt = P.wt, par = P.par, sid = P.sid, pid = P.pid;
  ord.length = 0;
  for (let i = 0; i < hi; i++) if (al[i]) ord.push(i);
  const Y = P.y;
  ord.sort((a, b) => Y[b] - Y[a]);
  for (let q = 0; q < ord.length; q++) wt[ord[q]] = 1;
  for (let q = 0; q < ord.length; q++) {
    const i = ord[q], p = par[i];
    if (p >= 0 && al[p] && sid[p] === pid[i]) wt[p] += wt[i];
  }
  const X = P.x;
  const sway = P.t * 0.45;
  for (let q = ord.length - 1; q >= 0; q--) {
    const i = ord[q], p = par[i];
    if (p === -1 || P.lk[i] <= 0) continue;
    let bx, by, tbx = 0, tby = 1;
    if (p >= 0) {
      if (!al[p] || sid[p] !== pid[i]) continue;
      bx = X[p];
      by = Y[p];
      // arrive along the line the parent's own thread leaves on, so a trunk runs on smoothly
      const g = par[p];
      if (g >= 0 && al[g] && sid[g] === pid[p]) {
        const gx = X[g] - bx, gy = Y[g] - by, gl = sqrt(gx * gx + gy * gy) + 1e-3;
        tbx = -gx / gl;
        tby = -gy / gl;
      }
    } else {
      bx = cl(X[i], HX0 + 2, HX1 - 2);
      by = HY;
    }
    const dx = bx - X[i], dy = by - Y[i], dl = sqrt(dx * dx + dy * dy) + 1e-3;
    // leave towards the parent, leaning a little to one side that drifts
    const sw = 0.35 * sin(sway + P.sid[i] * 1.7);
    let tax = dx / dl + sw, tay = dy / dl;
    const tl = sqrt(tax * tax + tay * tay);
    tax /= tl;
    tay /= tl;
    const lg = log2(wt[i]);
    const lk = P.lk[i];
    curve(L, X[i], Y[i], tax, tay, bx, by, tbx, tby, 0.6 + 0.12 * min(lg, 4), (0.17 + 0.04 * min(lg, 5)) * lk * (1 - 0.35 * min(1, dl / (2.4 * P.s))));
  }

  // flashes
  for (let q = 0; q < P.nf; q++) {
    const age = P.fa[q];
    if (age > 1.6) continue;
    const st = P.fs[q];
    const core = (0.3 + 0.7 * exp(-age / 0.13)) * (age < 0.04 ? age / 0.04 : 1);
    const glow = exp(-age / 0.55);
    const rc = 1.2 + 1.8 * st * (1 - exp(-age / 0.05));
    const ringR = 2 + 9 * (1 - exp(-age / 0.45));
    const ringA = 0.3 * st * exp(-age / 0.55);
    const reach = max(ringR + 3, 5.2 * rc);
    const xi = P.fx[q], yi = P.fy[q];
    const x0 = max(0, floor(xi - reach)), x1 = min(W - 1, floor(xi + reach));
    const y0 = max(0, floor(yi - reach)), y1 = min(H - 1, floor(yi + reach));
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - yi;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - xi;
        const d = sqrt(dx * dx + dy * dy);
        const c = st * core * exp(-((d / rc) * (d / rc)) * 1.5);
        const hl = st * glow * 0.45 * exp(-((d / (1.7 * rc)) * (d / (1.7 * rc))));
        const ring = ringA * exp(-((d - ringR) * (d - ringR)) / 1.6);
        const warm = st * glow * 0.5 * exp(-((d - rc * 1.3) * (d - rc * 1.3)) / (0.5 * rc * rc)) * (age < 0.5 ? 1 : 0.5);
        const o = (yy * W + xx) * 3;
        buf[o] += c + 0.55 * hl + 0.7 * warm + 0.3 * ring;
        buf[o + 1] += c + 0.95 * hl + 0.5 * warm + 0.95 * ring;
        buf[o + 2] += c + 1.0 * hl + 0.25 * warm + ring;
      }
    }
  }

  const col = P.col;
  const water = [0, 0, 0];
  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      const o = yy * W + xx;
      const i = 1 - exp(-1.6 * L[o]);
      const hw = 19 + 0.17 * yy;
      const u = (xx - 32) / hw;
      const fall = exp(-0.5 * u * u) * (0.55 + 0.45 * exp(-yy / 50));
      hsv(hue, 0.88, 0.07 * fall + 0.01, water, 0);
      hsv(hue - 0.01 * i, 0.95 - 0.75 * sm(0.55, 1, i), 0.04 + 0.96 * pow(i, 0.9), col, 0);
      let r = water[0] + col[0] + buf[o * 3];
      let g = water[1] + col[1] + buf[o * 3 + 1];
      let b = water[2] + col[2] + buf[o * 3 + 2];
      // horn
      if (yy < HY) {
        const ex = sm(HX0 - 1, HX0 + 2, xx) * sm(HX1 + 1, HX1 - 2, xx);
        const hv = (0.55 + 0.45 * (yy / (HY - 1))) * ex * (0.7 + 0.3 * min(1, drive));
        r += 0.85 * hv;
        g += 0.97 * hv;
        b += hv;
      }
      display.setPixel(xx, yy, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
  }
}
