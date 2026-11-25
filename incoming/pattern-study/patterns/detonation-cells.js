// ===== Patternflow pattern =====
// Title:   Detonation Cells
// Family:  detonation
// Idea:    A gas detonation seen riding with its front: the burning front hangs near the top of the panel, bulging and sagging as triple points collide along it, while the soot foil it has already scratched scrolls down below as a net of pale diamond cells that grow, split and merge.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cellular structure and spin of gas detonations (Denisov and Troshin, 1959, from memory); soot-foil records of the triple-point tracks (Voitsekhovskii, Mitrofanov and Topchian, 1963, from memory); the ZND reaction zone behind the shock (Zel'dovich, von Neumann and Doering, 1940s, from memory); the kinematic triple-point model drawn here, the births and mergers of cells and the drawing are original, pattern round 249
// Round:   249
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.6..2.2, Cells=-1..1, Irregularity=0..1
//
// Knob 1: Hue. Turns the flame palette round the wheel: it opens on a white-hot core, orange and deep red, and the soot foil stays a warm charcoal with only a slight tint of the same hue.
// Knob 2: Speed. 0.6 to 2.2, opening at 2: how fast the foil scrolls under the front, from about 5 LED a second to about 22. The angle of the scratches does not change, only how fast they pass.
// Knob 3: Cells. -1 to 1, opening at 0: how many triple points cross the tube, 4 at -1 (diamonds about 30 LED wide) and 12 at 1 (about 10 LED wide). Turning it splits or merges cells within a couple of seconds.
// Knob 4: Irregularity. 0 to 1, opening at 0.06: at 0 the lattice is nearly regular and the front calm, at 1 the tracks wobble, cells split in two where they grow too wide, close neighbours merge and the front ripples.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, log, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TP = 2 * PI;
const gauss = () => sqrt(-2 * log(1 - rnd() * 0.999999)) * cos(TP * rnd());

const YF = 27;          // screen row where the foil record is written, the quiet front
const FR = 4;           // foil rows per LED
const NF = 640;         // ring length in foil rows
const SIG = 0.95;       // sigma of a scratch across, in LED: about 2 LED wide at half height
const SL = 0.6;         // lateral speed over scroll speed: the scratches lean about 31 degrees
const MMIN = 4, MMAX = 14;
const LJ = 16;          // foil distance over which a triple point forgets its speed jitter

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], primed: false, t: 0,
    F: 1000, n: 4000,                       // foil position of the front (LED) and rows written so far
    foil: new Float32Array(NF * W),
    tp: [], ev: [],
    ph: new Float32Array(10).map(() => TP * rnd()),
    gs: 1, sigJ: 0.03, D: 15, mc: 0,
    sp: 8, cellLen: 13, Lc: 7,
    ec: new Float32Array(W), yf: new Float32Array(W), tmp: new Float32Array(W),
  });
  return st;
}

function readKnobs(st, input) {
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
}

// the slow clocks that are not tied to the scroll: the cell size and the angle of the scratches wander
function clocks(st) {
  const t = st.t, ph = st.ph;
  const k3 = cl(st.k[2], -1, 1), k4 = cl(st.k[3], 0, 1);
  const m0 = 8 + 4 * k3;
  const wa = 0.14 + 0.12 * k4, wb = 0.08 + 0.06 * k4;
  st.Mt = cl(m0 * (1 + wa * sin(0.0113 * t + ph[0]) + wb * sin(0.0371 * t + ph[1])), MMIN, MMAX);
  st.gs = 1 + 0.13 * sin(0.0293 * t + ph[2]) + 0.08 * sin(0.0117 * t + ph[3]);
  st.sigJ = 0.03 + 0.2 * pow(k4, 1.2);
  const k2 = cl(st.k[1], 0.6, 2.2);
  st.D = 5 * pow(4.4, (k2 - 0.6) / 1.6);
  const M = max(st.tp.length, 2);
  st.sp = W / M;
  st.drift = 0.2 + 0.12 * k4;
  st.bthr = 1.7 + 1.0 * (1 - k4) * (1 - k4); st.mthr = 0.45 - 0.22 * (1 - k4) * (1 - k4); st.hyst = 1.2;
  st.cellLen = (1.67 * st.sp) / st.gs;
  st.Lc = 0.55 * st.cellLen;
}

// ---- the triple points ---------------------------------------------------------
// A triple point is kept on the unfolded tube: a ring 2W long that every one of them runs round at the
// same lateral speed. The first half of the ring is the tube going right, the second half is the tube
// coming back, so a wall bounce is just the ring passing W or 2W and the gaps between neighbours on the
// ring are the widths of the cells, the spacing of one family of scratches.
function newTP(u) {
  return { u, x: u, px: u, d: 1, j: 0, mode: 0, ref: null, goal: 0, dead: false, f: 0.008 + 0.022 * rnd(), q: TP * rnd(), f2: 0.011 + 0.026 * rnd(), q2: TP * rnd(), am: 0.6 + 0.8 * rnd(), g: 0.012 + 0.02 * rnd(), r: TP * rnd() };
}

function place(p) {
  if (p.u < W) { p.x = p.u; p.d = 1; } else { p.x = 2 * W - p.u; p.d = -1; }
}

function initTP(st) {
  const M = cl(Math.round(st.Mt), MMIN, MMAX);
  const k4 = cl(st.k[3], 0, 1);
  const s = (2 * W) / M;
  st.tp.length = 0;
  const u0 = rnd() * 2 * W;
  for (let i = 0; i < M; i++) {
    const p = newTP(((i + 0.5 + (0.2 + 0.25 * k4) * (rnd() * 2 - 1)) * s + u0) % (2 * W));
    place(p);
    p.px = p.x;
    st.tp.push(p);
  }
}

// a cell that has grown too wide forks: a new triple point leaves one neighbour and drifts to the middle of the gap
function fork(st, src, gap) {
  const p = newTP((src.u + 0.3) % (2 * W));
  place(p);
  p.px = p.x;
  p.mode = 1; p.ref = src; p.goal = 0.5 * gap;
  st.tp.push(p);
}

// two scratches closer than they should be: one bends toward the other and joins it
function merge(p, ref) {
  p.mode = 2; p.ref = ref;
}

// events are the overdriven spots where two triple points crossed: strongest at once, dying along the cell
function addEvent(st, x, Frow, a) {
  const sp = st.sp;
  st.ev.push({ x, F: Frow, a, sg0: 0.36 * sp, sg1: 0.4 * sp, L: st.Lc, cl: st.cellLen });
  if (st.ev.length > 90) st.ev.shift();
}

function Eat(st, x, F) {
  let e = 0;
  const ev = st.ev;
  for (let i = 0; i < ev.length; i++) {
    const v = ev[i];
    const age = max(0, F - v.F);
    const sg = v.sg0 + v.sg1 * min(1, age / v.cl);
    const dx = (x - v.x) / sg;
    if (dx > 3 || dx < -3) continue;
    e += v.a * sstep(0, 1.8, age) * exp(-age / v.L) * exp(-0.5 * dx * dx);
  }
  return e;
}

// one foil row: move every triple point, find crossings, scratch the soot
function stepRow(st) {
  const tp = st.tp, foil = st.foil;
  const dF = 1 / FR;
  const Frow = (st.n + 1) / FR;
  const sl = SL * st.gs;
  const a = dF / LJ, sq = sqrt(2 * a) * st.sigJ;
  const M = tp.length;
  for (let i = 0; i < M; i++) {
    const p = tp[i];
    p.px = p.x;
    p.j += -p.j * a + sq * gauss();
    p.j = cl(p.j, -0.6, 0.6);
    // a slow drift of its own, so no two scratches keep their spacing for ever
    const dr = st.drift * p.am * (sin(p.f2 * Frow + p.q2) + 0.6 * sin(1.7 * p.f2 * Frow + 2 * p.q2 + 1)) * 0.62;
    let off = 0;
    if (p.mode) {
      const r = p.ref;
      if (!r || r.dead) p.mode = 0;
      else {
        let rho = p.u - r.u;
        rho -= 2 * W * Math.round(rho / (2 * W));
        if (p.mode === 1) {
          const err = p.goal - rho;
          if (abs(err) < 0.5) { p.mode = 0; p.ref = null; }
          else off = (err > 0 ? 1 : -1) * min(0.3, 0.05 + 0.04 * abs(err));
        } else if (abs(rho) < 1.0) { p.dead = true; }
        else off = (rho > 0 ? -1 : 1) * min(0.3, 0.05 + 0.04 * abs(rho));
      }
    }
    const v = sl * max(0.25, 1 + p.j + dr + off + p.g * 1.6 * sin(p.f * Frow + p.q));
    const du0 = p.u;
    p.u += v * dF;
    if (p.u >= 2 * W) { p.u -= 2 * W; addEvent(st, 0, Frow, 0.7); }
    else if (du0 < W && p.u >= W) addEvent(st, W, Frow, 0.7);
    place(p);
  }
  for (let i = 0; i < M; i++) {
    const pa = tp[i];
    for (let j = i + 1; j < M; j++) {
      const pb = tp[j];
      if (pa.d === pb.d) continue;
      if ((pa.px - pb.px) * (pa.x - pb.x) < 0) addEvent(st, 0.5 * (pa.x + pb.x), Frow, 0.85 + 0.3 * rnd());
    }
  }
  const row = st.n % NF, o = row * W;
  foil.fill(0, o, o + W);
  for (let i = 0; i < M; i++) {
    const p = tp[i];
    const e = Eat(st, p.x, Frow);
    const amp = (0.55 + 0.45 * cl(e, 0, 1)) * (0.84 + 0.16 * sin(p.g * 31 * Frow + p.r));
    const c0 = max(0, floor(p.x - 3)), c1 = min(W - 1, floor(p.x + 3));
    for (let c = c0; c <= c1; c++) {
      const dx = (c + 0.5 - p.x) / SIG;
      const g = amp * exp(-0.5 * dx * dx);
      const v = foil[o + c];
      foil[o + c] = v + g * (1 - v);
    }
  }
  st.n++;
  for (let i = M - 1; i >= 0; i--) if (tp[i].dead) tp.splice(i, 1);
}

// births, mergers and the pull toward the cell count the Cells knob asks for
function manage(st, dt) {
  st.mc -= dt;
  if (st.mc > 0) return;
  const tp = st.tp;
  const k4 = cl(st.k[3], 0, 1);
  const ring = tp.filter((p) => p.mode !== 2).sort((p, q) => p.u - q.u);
  const M = ring.length;
  if (M < 2) return;
  const sring = (2 * W) / M;
  const gapOf = (i) => (i === M - 1 ? ring[0].u + 2 * W - ring[i].u : ring[i + 1].u - ring[i].u);
  let wi = -1, wg = 0, ni = -1, ng = 1e9;
  for (let i = 0; i < M; i++) {
    const g = gapOf(i), a = ring[i], b = ring[(i + 1) % M];
    if (g > wg && (a.mode === 0 || b.mode === 0)) { wg = g; wi = i; }
    if (g < ng && a.mode === 0 && b.mode === 0) { ng = g; ni = i; }
  }
  const doFork = () => {
    const a = ring[wi], b = ring[(wi + 1) % M];
    if (a.mode === 0 && (b.mode !== 0 || rnd() < 0.5)) fork(st, a, wg);
    else fork(st, b, -wg);
    st.mc = 0.25;
  };
  const doMerge = () => {
    const a = ring[ni], b = ring[(ni + 1) % M];
    if (rnd() < 0.5) merge(a, b); else merge(b, a);
    st.mc = 0.25;
  };
  // a cell wider than 1.7 times the spacing forks, two scratches nearer than 0.45 of it merge
  if (wi >= 0 && wg > st.bthr * sring && M < MMAX) return doFork();
  if (ni >= 0 && ng < st.mthr * sring && M > MMIN) return doMerge();
  // the Cells knob: toward the target number of triple points
  if (M < st.Mt - st.hyst && M < MMAX && wi >= 0 && wg > 0.9 * sring) return doFork();
  if (M > st.Mt + st.hyst && M > MMIN && ni >= 0) return doMerge();
  // now and then a wide cell splits before it has to
  if (k4 > 0.02 && rnd() < dt * 0.3 * k4 * k4 && wi >= 0 && wg > 1.2 * sring && M < MMAX) doFork();
}

function advance(st, dF, dt) {
  const target = st.F + dF;
  const nEnd = floor(target * FR);
  while (st.n < nEnd) stepRow(st);
  st.F = target;
  const F = st.F, ev = st.ev;
  let w = 0;
  for (let i = 0; i < ev.length; i++) if (F - ev[i].F < 4.5 * ev[i].L) ev[w++] = ev[i];
  ev.length = w;
  manage(st, dt);
}

function prime(st) {
  st.primed = true;
  clocks(st);
  initTP(st);
  clocks(st);
  // run the model quickly: enough record to fill the panel, then some more so the lattice has mixed
  const chunk = 1.0, total = 150;
  const dtEq = chunk / st.D;
  for (let f = 0; f < total; f += chunk) {
    st.t += dtEq;
    clocks(st);
    advance(st, chunk, dtEq);
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  readKnobs(st, input);
  dt = cl(dt || 0, 0, 0.25);
  if (!st.primed) prime(st);
  st.t += dt;
  clocks(st);
  advance(st, st.D * dt, dt);
}

// ---- frame ----------------------------------------------------------------------
export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.primed) { clocks(st); prime(st); }
  const k1 = st.k[0], k4 = cl(st.k[3], 0, 1);
  const F = st.F, t = st.t, nw = st.n;
  const foil = st.foil;
  // the front line: strength along it, then a smooth height
  const ec = st.ec, yf = st.yf, tmp = st.tmp;
  for (let x = 0; x < W; x++) {
    const e = Eat(st, x + 0.5, F);
    ec[x] = 1 - exp(-1.4 * e);
  }
  for (let x = 0; x < W; x++) {
    const rip = (0.12 + 0.75 * k4) * (sin(0.55 * x + 0.83 * t + st.ph[4]) + 0.6 * sin(0.31 * x - 0.53 * t + st.ph[5]));
    yf[x] = YF + 1.6 - 5 * ec[x] + rip * 0.6;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let x = 0; x < W; x++) tmp[x] = 0.25 * yf[max(0, x - 1)] + 0.5 * yf[x] + 0.25 * yf[min(W - 1, x + 1)];
    for (let x = 0; x < W; x++) yf[x] = tmp[x];
  }
  const ecs = tmp;
  for (let x = 0; x < W; x++) ecs[x] = 0.25 * ec[max(0, x - 1)] + 0.5 * ec[x] + 0.25 * ec[min(W - 1, x + 1)];

  // palette
  const Cw = [0, 0, 0], Co = [0, 0, 0], Cr = [0, 0, 0], Ch = [0, 0, 0], Ct = [0, 0, 0];
  hsv(0.115 + k1, 0.2, 1, Cw);
  hsv(0.07 + k1, 0.88, 1, Co);
  hsv(0.02 + k1, 0.94, 0.67, Cr);
  hsv(0.64 + k1, 0.55, 1, Ch);
  hsv(0.085 + k1, 0.5, 0.85, Ct);
  const bR = 24, bG = 20, bB = 18;
  const cR = 0.92 * 228 + 0.08 * Ct[0] * 255, cG = 0.92 * 208 + 0.08 * Ct[1] * 255, cB = 0.92 * 165 + 0.08 * Ct[2] * 255;
  const eR = 0.95 * 92 + 0.05 * Ct[0] * 255, eG = 0.95 * 64 + 0.05 * Ct[1] * 255, eB = 0.95 * 44 + 0.05 * Ct[2] * 255;
  const sR = 9 + 3 * Ct[0], sG = 8 + 3 * Ct[1], sB = 10 + 3 * Ct[2];

  for (let y = 0; y < H; y++) {
    const a = y + 0.5 - YF;
    const q = (F - a) * FR;
    const i0 = floor(q), fr = q - i0;
    const ok0 = i0 <= nw - 1, ok1 = i0 + 1 <= nw - 1;
    const o0 = ((i0 % NF) + NF) % NF * W, o1 = (((i0 + 1) % NF) + NF) % NF * W;
    const age = max(0, a);
    const fade = exp(-age / 52);
    // newer scratches are pale cream, older ones go to ember
    const scR = eR + (cR - eR) * fade, scG = eG + (cG - eG) * fade, scB = eB + (cB - eB) * fade;
    for (let x = 0; x < W; x++) {
      const d = y + 0.5 - yf[x];
      const e = ecs[x];
      let r, g, b;
      if (d < -9) {
        r = sR; g = sG; b = sB;
      } else {
        // the soot foil: charcoal with pale scratches
        let v = 0;
        if (ok0) v = foil[o0 + x] * (1 - fr) + (ok1 ? foil[o1 + x] : foil[o0 + x]) * fr;
        const m = sstep(-0.8, 0.8, d);
        v *= m;
        r = bR + (scR - bR) * v; g = bG + (scG - bG) * v; b = bB + (scB - bB) * v;
        if (d < 0) {
          // cold gas ahead of the front, with a faint cool precursor haze
          const hz = exp(d / 3) * (0.12 + 0.12 * e);
          const base = 1 - m;
          r = sR * base + r * m + Ch[0] * 255 * hz;
          g = sG * base + g * m + Ch[1] * 255 * hz;
          b = sB * base + b * m + Ch[2] * 255 * hz;
        }
        // the burning gas: white-hot core, orange, then a red glow that dies over about nine LED
        const lead = sstep(-1.0, 0.5, d);
        const dd = max(d, 0);
        const wc = lead * exp(-dd / (1.0 + 1.4 * e)) * (0.62 + 0.5 * e);
        const oc = lead * exp(-dd / (3.0 + 2.2 * e)) * 0.95;
        const rc = lead * exp(-dd / 6.5) * (0.78 + 0.25 * e);
        const cover = min(1, 0.7 * (wc + oc) + 0.25 * rc);
        r = r * (1 - cover) + 255 * (wc * Cw[0] + oc * Co[0] + rc * Cr[0]);
        g = g * (1 - cover) + 255 * (wc * Cw[1] + oc * Co[1] + rc * Cr[1]);
        b = b * (1 - cover) + 255 * (wc * Cw[2] + oc * Co[2] + rc * Cr[2]);
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
