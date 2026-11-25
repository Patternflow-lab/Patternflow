// ===== Patternflow pattern =====
// Title:   Association Field
// Family:  contourintegration
// Idea:    A field of 128 small striped patches turning at random hides curves that swim through the panel, each one seen only because its patches lie along its path and the eye links them, and as a curve's head moves on, the patches it leaves turn back into noise.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: contour integration and the association field (David Field, Anthony Hayes and Robert Hess 1993; Ilona Kovacs and Bela Julesz 1993, from memory), the Gabor patch as a model of a simple cell's receptive field (Dennis Gabor 1946; Hubel and Wiesel 1962; John Daugman 1985, from memory), pattern round 240
// Round:   240
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Jitter=0..4, Snakes=2..5, Drift=-1..1
//
// Knob 1: Hue. Turns the bright lobes round the wheel while the ground leans the other way round the blue end: at 0 teal-cyan lobes lie on navy with deep indigo between them, a quarter turn on they are violet on a teal-blue ground, and three quarters on lime on violet-navy. The warm stretch is paled and lifted so it reads coral and amber, never brown.
// Knob 2: Jitter. 0 to 4, opening at 2. How far each patch on a curve is turned off the curve's direction, as the half width of a uniform spread: none at 0, up to 16 degrees at 2 where the curve still reads at once, up to 86 degrees at 4, which is as good as random. The curve's extra light, its longer stripes and its matched stripe phase fade out between about 2.7 and 3.9, so at the top nothing but the noise is left.
// Knob 3: Snakes. 2 to 5, opening at 2. How many curves swim at once, each a chain of 9 to 14 patches. A fraction fades one more in: its patches turn from random into line over half a second as the knob passes the whole number.
// Knob 4: Drift. -1 to 1 cycles a second, opening near 0. How fast the stripes of every patch slide across it (a cycle is 4.4 LED), the sign giving the direction. At 0 the stripes stand still and only the patches turn. The background drifts one way, and every curve after the first picks its own direction.

const W = 64, H = 128, NPX = W * H;
const COLS = 8, ROWS = 16, N = COLS * ROWS;
const { floor, round, min, max, abs, exp, sqrt, sin, cos, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
const wrap1 = (a) => a - TAU * round(a / TAU);   // -PI..PI
const wrap2 = (a) => a - PI * round(a / PI);     // -PI/2..PI/2, an angle with no direction
const tri = (p) => { const f = p - floor(p); return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; }; // -1..1, uniform over a uniform phase

const PITCH = 8;
const SIG = 2.2, LAM = 4.4;      // LED
const NSNAKE = 5;
const BGAMP = 0.72, BOOST = 0.28, ELONG = 0.4, GAM = 1.2, BREATH0 = 0.55;
const MAXTURN = 0.9, MAXSUM = 1.4;     // radians a curve may bend from one step to the next, and over two steps
const PRE = 45;                  // seconds run before the first frame

// ---- colour -------------------------------------------------------------------
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const HUE0 = 0.485;

// ---- the elements --------------------------------------------------------------
function buildElements(st) {
  const X = new Float32Array(N), Y = new Float32Array(N);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      let x = PITCH * (c + 0.5) + rnd(-1.5, 1.5), y = PITCH * (r + 0.5) + rnd(-1.5, 1.5);
      X[i] = cl(x, 3.4, W - 3.4);
      Y[i] = cl(y, 3.4, H - 3.4);
    }
  st.X = X;
  st.Y = Y;
  st.sc = new Float32Array(N);
  st.amp = new Float32Array(N);
  st.ph = new Float32Array(N);
  st.ang = new Float32Array(N);
  st.om = new Float32Array(N);
  st.dm = new Float32Array(N);        // each patch's own drift speed, as a share of the knob
  st.jw = new Float32Array(N);        // the slow triangle wave that moves a patch's share of the jitter
  st.jp = new Float32Array(N);
  st.ba = new Float32Array(N);        // two slow waves per patch that swell and ease its light
  st.bb = new Float32Array(N);
  st.bp = new Float32Array(N);
  st.bq = new Float32Array(N);
  st.mode = new Uint8Array(N);        // 0 turning slowly on its own, 1 on a curve, 2 turning to a new orientation
  st.claim = new Float32Array(N);     // 0..1, how far a patch is on a curve
  st.rel = new Float32Array(N);       // progress of a release, 0..1
  st.relA = new Float32Array(N);
  st.relD = new Float32Array(N);
  st.heat = new Float32Array(N);      // where the curves have been lately
  st.own = new Array(N).fill(null);
  for (let i = 0; i < N; i++) {
    st.sc[i] = rnd(0.94, 1.1);
    st.amp[i] = rnd(0.9, 1);
    st.ph[i] = Math.random();
    st.ang[i] = Math.random() * PI;
    st.om[i] = rnd(0.05, 0.3) * (Math.random() < 0.5 ? -1 : 1);
    st.dm[i] = rnd(0.75, 1.25);
    st.jw[i] = 1 / rnd(7, 18);
    st.jp[i] = Math.random();
    st.ba[i] = TAU / rnd(24, 60);
    st.bb[i] = TAU / rnd(11, 26);
    st.bp[i] = Math.random() * TAU;
    st.bq[i] = Math.random() * TAU;
  }
  // neighbours of every patch, a pitch or so away
  st.nb = [];
  for (let i = 0; i < N; i++) {
    const list = [];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = X[j] - X[i], dy = Y[j] - Y[i], d = sqrt(dx * dx + dy * dy);
      if (d >= 5.5 && d <= 14.5) list.push({ j, d, a: atan2(dy, dx) });
    }
    st.nb.push(list);
  }
}

// ---- curves ---------------------------------------------------------------------
function newChain(st, slot) {
  return { ph: Math.random(), cells: [], phi: 0, seg: 0, kap: 0, speed: rnd(1.2, 1.8), acc: 0, age: 0, life: rnd(28, 70), L: 9 + floor(Math.random() * 6), sign: 1, slot, prf: 1, turn: 0 };
}
function allChains(st) {
  const list = [];
  for (let k = 0; k < NSNAKE; k++) if (st.snakes[k]) list.push(st.snakes[k]);
  for (const g of st.ghosts) list.push(g);
  return list;
}
function claim(st, ch, i) {
  ch.cells.push(i);
  st.own[i] = ch;
  st.mode[i] = 1;
  st.heat[i] += 1;
}
function release(st, i) {
  st.own[i] = null;
  st.mode[i] = 2;
  st.rel[i] = 0;
  st.relA[i] = st.ang[i];
  st.relD[i] = (Math.random() < 0.5 ? -1 : 1) * rnd(0.6, 1.5);
}
function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
  const den = d1x * d2y - d1y * d2x;
  if (abs(den) < 1e-6) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / den, u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
}
// Is the step from patch `from` to patch `to` too close to a curve, or across one? Every curve counts, the walker's own too.
function blocked(st, from, to) {
  const X = st.X, Y = st.Y;
  for (const c of allChains(st)) {
    const cs = c.cells;
    for (let m = 0; m < cs.length; m++) {
      const q = cs[m];
      if (q === from) continue;
      const dx = X[q] - X[to], dy = Y[q] - Y[to];
      if (dx * dx + dy * dy < 7.2 * 7.2) return true;
      if (m + 1 < cs.length && cs[m + 1] !== from && segHit(X[from], Y[from], X[to], Y[to], X[q], Y[q], X[cs[m + 1]], Y[cs[m + 1]])) return true;
    }
  }
  return false;
}
// How many ways on from patch j, having come from h along the angle seg after a turn of `turn`.
function ways(st, h, j, seg, turn) {
  let n = 0;
  for (const nb of st.nb[j]) {
    if (nb.j === h || st.own[nb.j]) continue;
    const t2 = wrap1(nb.a - seg);
    if (abs(t2) > MAXTURN || abs(t2 + turn) > MAXSUM) continue;
    if (blocked(st, j, nb.j)) continue;
    const dx = st.X[h] - st.X[nb.j], dy = st.Y[h] - st.Y[nb.j];
    if (dx * dx + dy * dy < 7.2 * 7.2) continue;
    n++;
  }
  return n;
}
function spawnPoint(st) {
  let best = -1, bestHeat = 1e9;
  const edge = Math.random() < 0.6;
  for (let t = 0; t < 16; t++) {
    let i = floor(Math.random() * N);
    if (edge) {
      // a patch on the rim, so the curve slides in from the edge
      const side = floor(Math.random() * 4), c = floor(Math.random() * COLS), r = floor(Math.random() * ROWS);
      i = side === 0 ? c : side === 1 ? (ROWS - 1) * COLS + c : side === 2 ? r * COLS : r * COLS + COLS - 1;
    }
    if (st.own[i]) continue;
    let ok = true;
    for (const c of allChains(st)) {
      for (const q of c.cells) {
        const dx = st.X[q] - st.X[i], dy = st.Y[q] - st.Y[i];
        if (dx * dx + dy * dy < 14 * 14) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (!ok) continue;
    if (st.heat[i] < bestHeat) (bestHeat = st.heat[i]), (best = i);
  }
  if (best < 0) for (let i = 0; i < N; i++) if (!st.own[i]) { best = i; break; }
  return best;
}
// One step of the head: true if it found a patch to move to.
function stepHead(st, ch) {
  return walk(st, ch, MAXTURN, MAXSUM, true) || walk(st, ch, 1.4, 2.4, false);
}
function walk(st, ch, maxTurn, maxSum, look) {
  const cells = ch.cells, h = cells[cells.length - 1], X = st.X, Y = st.Y;
  // the heading random-walks through its curvature and is pushed off the walls
  if (look) {
    ch.kap = ch.kap * 0.7 + (Math.random() + Math.random() + Math.random() - 1.5) * 0.3;
    ch.phi = wrap1(ch.phi + ch.kap);
  }
  let px = cos(ch.phi), py = sin(ch.phi);
  const M = 28, hx = X[h], hy = Y[h];
  if (hx < M) px += ((M - hx) / M) * 2.4;
  if (hx > W - M) px -= ((hx - (W - M)) / M) * 2.4;
  if (hy < M) py += ((M - hy) / M) * 2.4;
  if (hy > H - M) py -= ((hy - (H - M)) / M) * 2.4;
  const want = atan2(py, px);
  let best = -1, bestCost = 1e9, bestA = 0;
  for (const nb of st.nb[h]) {
    if (st.own[nb.j]) continue;
    const turn = cells.length > 1 ? wrap1(nb.a - ch.seg) : 0;
    if (abs(turn) > maxTurn) continue;
    if (cells.length > 2 && abs(turn + ch.turn) > maxSum) continue;
    if (blocked(st, h, nb.j)) continue;
    const onward = look ? ways(st, h, nb.j, nb.a, turn) : 1;
    if (onward === 0) continue;
    const cost = (onward === 1 ? 0.6 : 0) + abs(wrap1(nb.a - want)) + 0.3 * abs(turn) + 0.05 * abs(nb.d - 8.5) + 0.12 * max(0, nb.d - 10) + 0.22 * st.heat[nb.j] + Math.random() * 0.3;
    if (cost < bestCost) (bestCost = cost), (best = nb.j), (bestA = nb.a);
  }
  if (best < 0) return false;
  ch.turn = cells.length > 1 ? wrap1(bestA - ch.seg) : 0;
  ch.seg = bestA;
  ch.phi = wrap1(ch.phi + 0.55 * wrap1(bestA - ch.phi));
  claim(st, ch, best);
  return true;
}
function growFull(st, ch) {
  let guard = 0;
  while (ch.cells.length < ch.L && guard++ < 40) if (!stepHead(st, ch)) break;
}
function startChain(st, slot, full) {
  const ch = newChain(st, slot);
  ch.sign = slot === 0 ? 1 : Math.random() < 0.5 ? 1 : -1;
  const i = spawnPoint(st);
  if (i < 0) return null;
  // head for a point inside the panel, so a curve crosses it before it turns
  const a = atan2(rnd(24, H - 24) - st.Y[i], rnd(14, W - 14) - st.X[i]);
  ch.phi = a;
  ch.seg = a;
  claim(st, ch, i);
  if (full) growFull(st, ch);
  return ch;
}
function retire(st, k) {
  const ch = st.snakes[k];
  if (!ch) return;
  ch.prf = st.pr[k];
  ch.slot = -1;
  st.ghosts.push(ch);
  st.snakes[k] = null;
}
export function setup(params) {
  const st = (params.st = { t: 0, init: false, k: [0, 2, 2, 0.06], snakes: new Array(NSNAKE).fill(null), ghosts: [], pr: new Float32Array(NSNAKE), F: new Float32Array(NPX) });
  buildElements(st);
}

function targets(k3) {
  const out = [];
  for (let k = 0; k < NSNAKE; k++) out.push(cl(k3 - k, 0, 1));
  return out;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 2, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 4), cl(kv[2], 2, 5), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    const tg = targets(st.k[2]);
    for (let k = 0; k < NSNAKE; k++) {
      st.pr[k] = tg[k];
      if (tg[k] > 0.001) st.snakes[k] = startChain(st, k, true);
    }
    // age the snakes unevenly so they do not all turn over together
    for (const ch of st.snakes) if (ch) ch.age = Math.random() * ch.life * 0.8;
    for (let s = 0; s < PRE; s += 0.1) step(st, 0.1);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

function step(st, dt) {
  if (dt <= 0) return;
  st.t += dt;
  const t = st.t, k = st.k;
  const jit = 1.5 * Math.pow(k[1] / 4, 2.4);
  const tg = targets(k[2]);
  const X = st.X, Y = st.Y;

  // presence of each slot's snake follows the knob, fading one in
  const pk = 1 - exp(-dt / 0.5);
  for (let s = 0; s < NSNAKE; s++) {
    st.pr[s] += (tg[s] - st.pr[s]) * pk;
    if (!st.snakes[s] && tg[s] > 0.001) {
      st.snakes[s] = startChain(st, s, true);
      if (st.snakes[s]) st.pr[s] = max(st.pr[s], 0);
    } else if (st.snakes[s] && tg[s] <= 0.001 && st.pr[s] < 0.03) {
      retire(st, s);
    }
  }

  // heads move on, tails let go
  for (let s = 0; s < NSNAKE; s++) {
    const ch = st.snakes[s];
    if (!ch) continue;
    ch.age += dt;
    ch.acc += ch.speed * dt;
    let dead = false;
    while (ch.acc >= 1) {
      ch.acc -= 1;
      if (!stepHead(st, ch)) {
        dead = true;
        break;
      }
      if (ch.cells.length > ch.L) release(st, ch.cells.shift());
    }
    if (dead || ch.age > ch.life) {
      retire(st, s);
      const nc = startChain(st, s, false);
      st.snakes[s] = nc;
      if (nc) nc.L = 9 + floor(Math.random() * 6);
    }
  }
  // curves that have been let go run their tails off
  for (let g = st.ghosts.length - 1; g >= 0; g--) {
    const ch = st.ghosts[g];
    ch.acc += ch.speed * 1.4 * dt;
    while (ch.acc >= 1 && ch.cells.length) {
      ch.acc -= 1;
      release(st, ch.cells.shift());
    }
    if (!ch.cells.length) st.ghosts.splice(g, 1);
  }

  // the patches
  const kp = 1 - exp(-dt / 0.3), ka = 1 - exp(-dt / 0.12), kc = 1 - exp(-dt / 0.3), kd = exp(-dt / 0.7), kh = exp(-dt / 90);
  for (const ch of allChains(st)) {
    const cs = ch.cells, n = cs.length, pr = ch.slot >= 0 ? st.pr[ch.slot] : ch.prf;
    const je = min(1.6, jit + (1 - pr) * 1.6);
    for (let m = 0; m < n; m++) {
      const i = cs[m], a = cs[m > 0 ? m - 1 : 0], b = cs[m < n - 1 ? m + 1 : n - 1];
      let tan = n > 1 ? atan2(Y[b] - Y[a], X[b] - X[a]) : ch.seg;
      const target = tan + je * tri(st.jw[i] * t + st.jp[i]);
      st.ang[i] += wrap2(target - st.ang[i]) * ka;
      // the stripes of a curve's patches run in step, so the curve's middle stripes join up, until the jitter shakes them apart
      const pt = ch.ph + 0.5 * (je / 1.5) * tri(st.jw[i] * 0.7 * t + st.jp[i] + 0.37);
      const dp = pt - st.ph[i];
      st.ph[i] += (dp - round(dp)) * kp * pr;
      st.claim[i] += (pr - st.claim[i]) * kc;
    }
  }
  const rate = k[3];
  for (const ch of allChains(st)) ch.ph += rate * ch.sign * dt;
  for (let i = 0; i < N; i++) {
    const m = st.mode[i];
    if (m === 0) st.ang[i] += st.om[i] * dt;
    else if (m === 2) {
      st.rel[i] += dt / 1.5;
      if (st.rel[i] >= 1) {
        st.rel[i] = 1;
        st.mode[i] = 0;
      }
      st.ang[i] = st.relA[i] + st.relD[i] * (0.5 - 0.5 * cos(PI * st.rel[i]));
    }
    if (!st.own[i]) st.claim[i] *= kd;
    const o = st.own[i];
    st.ph[i] += rate * (o ? o.sign : st.dm[i]) * dt;
    st.heat[i] *= kh;
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const F = st.F;
  F.fill(0);
  const jit = 1.5 * Math.pow(st.k[1] / 4, 2.4);
  const fade = 1 - sstep(0.6, 1.4, jit), boost = BOOST * fade, elong = ELONG * fade;
  for (let i = 0; i < N; i++) {
    const cx = st.X[i], cy = st.Y[i], sg = SIG * st.sc[i], lam = LAM * st.sc[i], c = st.claim[i];
    const a = st.ang[i], ca = cos(a), sa = sin(a);
    const swell = 0.5 + 0.25 * (sin(st.ba[i] * st.t + st.bp[i]) + sin(st.bb[i] * st.t + st.bq[i]));
    const amp = BGAMP * st.amp[i] * (BREATH0 + (1 - BREATH0) * swell + (1 - BREATH0 - (1 - BREATH0) * swell) * c * fade) * (1 + boost * c);
    const ph = st.ph[i] * TAU, k2 = TAU / lam;
    const sga = sg * (1 + elong * c), inva = -1 / (2 * sga * sga), invb = -1 / (2 * sg * sg);
    const R = Math.ceil(3 * sga);
    const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const along = dx * ca + dy * sa, u = -dx * sa + dy * ca;
        F[y * W + x] += amp * exp(along * along * inva + u * u * invb) * cos(k2 * u + ph);
      }
    }
  }
  const T = [0, 0, 0];
  const hh = HUE0 + st.k[0], hd = abs(wrap1((hh - floor(hh) - 0.13) * TAU)) / TAU;
  const bd = abs(wrap1((hh - floor(hh) - 0.68) * TAU)) / TAU;
  // blue and the warm stretch of the wheel are paled so they keep their light on the panel
  const warm = 1 - sstep(0.09, 0.2, hd), gam = GAM + 0.35 * warm, gain = 1 + 0.45 * warm;   // the warm stretch loses its dim shoulders, which would read as olive or brown
  hsv(hh, 0.62 - 0.27 * warm - 0.22 * (1 - sstep(0.05, 0.13, bd)), 1, T);
  const tr = T[0] * 255, tg = T[1] * 255, tb = T[2] * 255;
  // the ground and the dark lobes lean a little away from the lobes round the blue end of the wheel, so they stay navy and indigo
  const lean = -sin((hh - HUE0) * TAU) * 0.08, GROUND = [0, 0, 0], DARK = [0, 0, 0];
  hsv(0.635 + lean, 0.74, 0.235, GROUND);
  hsv(0.7 + lean, 0.86, 0.36, DARK);
  for (let c = 0; c < 3; c++) (GROUND[c] *= 255), (DARK[c] *= 255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = cl(F[y * W + x], -1, 1);
      if (s > 0) s = min(1, gain * Math.pow(s, gam));
      let r, g, b, q;
      if (s >= 0) {
        r = GROUND[0] + (tr - GROUND[0]) * s;
        g = GROUND[1] + (tg - GROUND[1]) * s;
        b = GROUND[2] + (tb - GROUND[2]) * s;
        q = 1 + 0.8 * 4 * s * (1 - s);   // the half-lit shoulder of a lobe keeps its colour instead of greying against the ground
      } else {
        r = GROUND[0] + (DARK[0] - GROUND[0]) * -s;
        g = GROUND[1] + (DARK[1] - GROUND[1]) * -s;
        b = GROUND[2] + (DARK[2] - GROUND[2]) * -s;
        q = 1;
      }
      if (q > 1) {
        const y0 = 0.299 * r + 0.587 * g + 0.114 * b;
        r = max(0, y0 + (r - y0) * q);
        g = max(0, y0 + (g - y0) * q);
        b = max(0, y0 + (b - y0) * q);
      }
      display.setPixel(x, y, min(255, round(r)), min(255, round(g)), min(255, round(b)));
    }
}
