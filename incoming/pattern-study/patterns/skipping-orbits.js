// ===== Patternflow pattern =====
// Title:   Skipping Orbits
// Family:  quantumhall
// Idea:    Electrons in a hard-walled box under a magnetic field run on circles of one cyclotron radius, and the ones that reach the wall bounce and start a new arc, so each rides a chain of arcs round the border in gold while the blue circles in the bulk go nowhere, and round every hole inside the chain runs the other way round.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the quantum Hall effect (Klaus von Klitzing, 1980), the classical skipping-orbit picture of its edge channels (Bertrand Halperin, 1982, and Markus Buttiker, 1988, both from memory), E x B drift of the orbit centres, pattern round 235
// Round:   235
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Field=0.6..3, Hall=-1..1, Density=0.02..0.1
//
// Knob 1: Hue. Turns both colours round the wheel together. At 0 the free circles are blue-violet and the electrons that touched a wall or a hole within their last 0.8 turns are gold; at 0.25 they are crimson and green, at 0.5 yellow-green and blue. The red-to-yellow stretch of the cold colour is raised by up to 55 percent so that it does not read brown.
// Knob 2: Field. The magnetic field B, 0.6 to 3. The circle radius is r = 9 / B LEDs, 15 at 0.6, 4.5 at 2 where it opens and 3 at 3, and every electron shares the speed 26 LEDs a second (plus or minus about 8 percent), so a turn takes 3.6 s, 1.09 s and 0.72 s. Strong field squeezes the gold edge channel to a band about 2 r wide against the wall and round each hole; at 0.6 the circles are half the panel wide and almost every electron meets a wall within a turn.
// Knob 3: Hall. The electric field across the box, -1 to 1, 0 being none. It makes the circle centres drift along the panel at 0.3 r LEDs a second at the ends of the range, which is 1.35 at the opening field and 4.5 at 0.6, down for positive and up for negative, so each circle stretches into a looping cycloid. The box then takes on a Hall voltage: after 900 s at 1 the electrons lean toward the right wall, 0.71 of the mean density in the left sixth of the width and 1.15 in the right.
// Knob 4: Density. How much of the panel the trails cover, 0.02 to 0.1. At the opening field that is 28 electrons at 0.02, 85 at 0.06 and 141 at 0.1; at 3 the circles are smaller so 0.1 draws 199, and the count never goes above 400. Electrons fade in and out one at a time as the knob moves.

const W = 64, H = 128, NPX = W * H;
const { floor, min, max, round, exp, hypot, PI, cos, sin, ceil } = Math;
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

// The box the electrons are shut in, inset so a 2 LED trail on the wall is whole.
const X0 = 1.5, X1 = 62.5, Y0 = 1.5, Y1 = 126.5;
const NP = 400;          // electrons simulated, whatever number are drawn
const RING = 400;        // trail points kept for each
const SUB = 1 / 60;      // substep, 0.7 LEDs at the fastest
const THETA = 5.8;       // radians of circle a free electron's trail shows
const THETA_H = 5.0;      // and a skipping one's, which has to be long enough to read as a chain
const LEN_C = 34, LEN_H = 30; // at weak field a trail stops at this many LEDs, not at its angle
const BRUSH = 1.3;       // trail brush radius in LEDs, about 2 LEDs wide

export function setup(params) {
  const obs = [];
  // Three discs, one to a third of the panel, alternating sides.
  const side = Math.random() < 0.5 ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    const r = 6.5 + Math.random() * 2.5;
    const lean = (i % 2 ? -side : side) * (0.5 + 0.5 * Math.random());
    const x = 32 + lean * min(13, 30 - r - 6.5);
    const y = 24 + i * 40 + (Math.random() - 0.5) * 6;
    obs.push({ x, y, r });
  }
  params.st = {
    k: [0, 2, 0, 0.06], t: 0, init: false, ns: 0,
    obs,
    px: new Float64Array(NP), py: new Float64Array(NP), vx: new Float64Array(NP), vy: new Float64Array(NP),
    th: new Float64Array(NP).fill(-1e9), tint: new Float32Array(NP),
    hx: new Float32Array(NP * RING), hy: new Float32Array(NP * RING), ht: new Float64Array(NP * RING), hh: new Float32Array(NP * RING),
    head: new Int32Array(NP), cnt: new Int32Array(NP),
    // Per-frame physics, set from the knobs.
    w: 3, dx: 0, dy: 0, r0: 8, v0: 27,
    Dc: new Float32Array(NPX), Rc: new Float32Array(NPX), Gc: new Float32Array(NPX), Bc: new Float32Array(NPX),
    Dh: new Float32Array(NPX), Rh: new Float32Array(NPX), Gh: new Float32Array(NPX), Bh: new Float32Array(NPX),
    rim: new Float32Array(NPX), disc: new Float32Array(NPX),
    col: new Float32Array(12), rimKey: '',
  };
}

// Distance to the nearest thing an electron cannot enter: the four walls and the discs.
function margin(st, x, y) {
  let m = min(min(x - X0, X1 - x), min(y - Y0, Y1 - y));
  for (const o of st.obs) m = min(m, hypot(x - o.x, y - o.y) - o.r);
  return m;
}

// The inward normal of the constraint that is tightest at (x, y).
function normal(st, x, y, out) {
  let m = x - X0;
  out[0] = 1; out[1] = 0;
  if (X1 - x < m) (m = X1 - x), (out[0] = -1), (out[1] = 0);
  if (y - Y0 < m) (m = y - Y0), (out[0] = 0), (out[1] = 1);
  if (Y1 - y < m) (m = Y1 - y), (out[0] = 0), (out[1] = -1);
  for (const o of st.obs) {
    const d = hypot(x - o.x, y - o.y), g = d - o.r;
    if (g < m) {
      m = g;
      out[0] = (x - o.x) / (d || 1);
      out[1] = (y - o.y) / (d || 1);
    }
  }
}

function spawn(st, i) {
  for (let tries = 0; tries < 200; tries++) {
    const x = X0 + 0.3 + Math.random() * (X1 - X0 - 0.6), y = Y0 + 0.3 + Math.random() * (Y1 - Y0 - 0.6);
    if (margin(st, x, y) < 0.3) continue;
    const a = Math.random() * 2 * PI;
    // One energy shell with a slow thermal spread: the sum of three uniforms is close to a bell.
    const g = Math.random() + Math.random() + Math.random() - 1.5;
    const sp = st.v0 * (1 + 0.16 * g);
    st.px[i] = x; st.py[i] = y; st.vx[i] = sp * cos(a); st.vy[i] = sp * sin(a);
    return;
  }
}

function record(st, i, x, y, t, heat) {
  const h = (st.head[i] + 1) % RING;
  st.head[i] = h;
  const o = i * RING + h;
  st.hx[o] = x; st.hy[o] = y; st.ht[o] = t; st.hh[o] = heat;
  if (st.cnt[i] < RING) st.cnt[i]++;
}

// Heat is 1 for an electron that touched a wall or a disc within the last 0.8 turns
// and falls to 0 by 1.3 turns, so a free circle is blue and a skipping arc is gold.
function heatOf(st, i, t) {
  const a = (t - st.th[i]) * st.w / (2 * PI);
  return a < 0.8 ? 1 : a > 1.3 ? 0 : 0.5 + 0.5 * cos(PI * (a - 0.8) / 0.5);
}

// One substep of one electron. Between hits the path is exact: in the frame that drifts
// with the E x B velocity the velocity u turns by w t, so the lab position is a trochoid.
// A hit is found by bisecting that closed form, never by a stepped integrator.
const nrm = [0, 0];
function advanceOne(st, i, h, t0) {
  const w = st.w, dx = st.dx, dy = st.dy;
  let x = st.px[i], y = st.py[i], vx = st.vx[i], vy = st.vy[i];
  if (margin(st, x, y) < -0.5) {
    spawn(st, i);
    st.cnt[i] = 0;
    x = st.px[i]; y = st.py[i]; vx = st.vx[i]; vy = st.vy[i];
  }
  let left = h;
  for (let k = 0; k < 6 && left > 1e-9; k++) {
    const ux = vx - dx, uy = vy - dy;
    let s = sin(w * left), c = cos(w * left);
    const ex = x + dx * left + (s * ux - (1 - c) * uy) / w, ey = y + dy * left + ((1 - c) * ux + s * uy) / w;
    if (margin(st, ex, ey) >= 0) {
      x = ex; y = ey;
      vx = c * ux - s * uy + dx; vy = s * ux + c * uy + dy;
      left = 0;
      break;
    }
    let lo = 0, hi = left;
    for (let b = 0; b < 44; b++) {
      const m = (lo + hi) / 2;
      s = sin(w * m); c = cos(w * m);
      if (margin(st, x + dx * m + (s * ux - (1 - c) * uy) / w, y + dy * m + ((1 - c) * ux + s * uy) / w) >= 0) lo = m;
      else hi = m;
    }
    s = sin(w * hi); c = cos(w * hi);
    normal(st, x + dx * hi + (s * ux - (1 - c) * uy) / w, y + dy * hi + ((1 - c) * ux + s * uy) / w, nrm);
    s = sin(w * lo); c = cos(w * lo);
    const nx0 = x + dx * lo + (s * ux - (1 - c) * uy) / w, ny0 = y + dy * lo + ((1 - c) * ux + s * uy) / w;
    const nvx = c * ux - s * uy + dx, nvy = s * ux + c * uy + dy;
    const dot = nvx * nrm[0] + nvy * nrm[1];
    x = nx0; y = ny0;
    vx = dot < 0 ? nvx - 2 * dot * nrm[0] : nvx;
    vy = dot < 0 ? nvy - 2 * dot * nrm[1] : nvy;
    left -= lo;
    // Keep the next arc from starting inside the wall it just left.
    x += nrm[0] * 1e-7; y += nrm[1] * 1e-7;
    const tt = t0 + (h - left);
    st.th[i] = tt;
    record(st, i, x, y, tt, 1);
  }
  st.px[i] = x; st.py[i] = y; st.vx[i] = vx; st.vy[i] = vy;
  const te = t0 + h;
  record(st, i, x, y, te, heatOf(st, i, te));
}

function advance(st, d) {
  const n = max(1, ceil(d / SUB - 1e-9)), h = d / n;
  for (let s = 0; s < n; s++) {
    const t0 = st.t;
    for (let i = 0; i < NP; i++) advanceOne(st, i, h, t0);
    st.t = t0 + h;
  }
}

function setKnobs(st, kv) {
  const k = [kv[0], cl(kv[1], 0.6, 3), cl(kv[2], -1, 1), cl(kv[3], 0.02, 0.1)];
  st.k = k;
  // One speed, so the radius is v / w and w is the field: r = 9 / B LEDs.
  const v0 = 26, r0 = 9 / k[1];
  st.r0 = r0; st.v0 = v0; st.w = v0 / r0;
  // E x B drift, along the panel. It grows with r so the Hall voltage across the box, which is
  // 2 (drift / speed) (width / r) in units of the electron's kinetic energy, stays near 1.4 at Hall = 1.
  st.dx = 0;
  st.dy = k[2] * 0.3 * r0;
}

const thetaC = (st) => min(THETA, LEN_C / st.r0);
const thetaH = (st) => min(THETA_H, LEN_H / st.r0);

// The number of electrons that gives a trail coverage of 9 x Density at this field.
function countFor(st) {
  // About 0.06 r of the electrons are skipping at any moment, 0.1 at the least and 0.9 at the most.
  const hot = cl(0.06 * st.r0, 0.1, 0.9);
  const len = st.r0 * (thetaC(st) * (1 - hot) + thetaH(st) * hot);
  const cov = 7.5 * st.k[3] * (1 - 0.4 * sstep(5, 14, st.r0));
  return cl((cov * NPX) / (1.55 * (len + 3)), 12, NP);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = input.knobValues || [0, 2, 0, 0.06];
  setKnobs(st, kv);
  const target = countFor(st);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < NP; i++) {
      st.tint[i] = Math.random();
      spawn(st, i);
    }
    st.ns = target;
    // Four seconds ahead so trails, hot and cold, are already there at once.
    advance(st, 4);
  }
  const d = cl(dt || 0, 0, 0.1);
  st.ns += (target - st.ns) * min(1, 3 * d);
  if (d > 0) advance(st, d);
}

// The faint things that stay still: the holes' rims and the walls.
function buildStill(st, hue) {
  const key = hue.toFixed(3);
  if (key === st.rimKey) return;
  st.rimKey = key;
  st.rim.fill(0);
  st.disc.fill(0);
  for (const o of st.obs) {
    for (let y = max(0, floor(o.y - o.r - 3)); y <= min(H - 1, ceil(o.y + o.r + 3)); y++)
      for (let x = max(0, floor(o.x - o.r - 3)); x <= min(W - 1, ceil(o.x + o.r + 3)); x++) {
        const d = hypot(x + 0.5 - o.x, y + 0.5 - o.y);
        const o2 = y * W + x;
        st.disc[o2] = max(st.disc[o2], cl(o.r + 0.5 - d, 0, 1));
      }
  }
}

export function draw(display, params) {
  const st = params.st;
  const hue = st.k[0];
  const { Dc, Rc, Gc, Bc, Dh, Rh, Gh, Bh, col } = st;
  Dc.fill(0); Rc.fill(0); Gc.fill(0); Bc.fill(0);
  Dh.fill(0); Rh.fill(0); Gh.fill(0); Bh.fill(0);
  buildStill(st, hue);

  const T = st.t, Tc = thetaC(st) / st.w, Th = thetaH(st) / st.w;
  const R2 = BRUSH * BRUSH;
  for (let i = 0; i < NP; i++) {
    const vis = cl(st.ns - i, 0, 1);
    if (vis < 0.02) continue;
    // Each electron's own shade, a little either side of the two base colours.
    const tn = st.tint[i];
    hsv(0.69 + hue + (tn - 0.5) * 0.06, 0.62, 1, col, 0);
    hsv(0.13 + hue + (tn - 0.5) * 0.03, 0.82, 1, col, 3);
    const cr = col[0], cg = col[1], cb = col[2], hr = col[3], hg = col[4], hb = col[5];
    const base = i * RING;
    let j = st.head[i];
    let px = 0, py = 0, pw = 0, ph = 0, have = false;
    for (let q = 0; q < st.cnt[i]; q++, j = (j - 1 + RING) % RING) {
      const o = base + j;
      const age = T - st.ht[o];
      const hq = st.hh[o];
      // A point that was hot keeps its place in the trail longer.
      const win = Tc + (Th - Tc) * hq;
      if (age > Th) break;
      if (age > win) {
        have = false;
        continue;
      }
      const s = age / win;
      const wq = (1 - s) ** (1.2 - 0.45 * hq) + 0.7 * exp(-s * 12 * Tc / win);
      const x = st.hx[o], y = st.hy[o];
      if (have) {
        const L = hypot(x - px, y - py);
        if (L > 1e-5) {
          const n = ceil(L / 0.5);
          for (let m = 0; m < n; m++) {
            const f = (m + 0.5) / n;
            const sx = px + (x - px) * f, sy = py + (y - py) * f;
            const wt = (pw + (wq - pw) * f) * ((L / n) / 0.5) * vis;
            const ht = ph + (hq - ph) * f;
            const x0 = max(0, floor(sx - BRUSH)), x1 = min(W - 1, floor(sx + BRUSH));
            const y0 = max(0, floor(sy - BRUSH)), y1 = min(H - 1, floor(sy + BRUSH));
            for (let yy = y0; yy <= y1; yy++) {
              const dy = yy + 0.5 - sy;
              for (let xx = x0; xx <= x1; xx++) {
                const dx = xx + 0.5 - sx, d2 = dx * dx + dy * dy;
                if (d2 >= R2) continue;
                let k = 1 - d2 / R2;
                k = k * k * wt;
                const o2 = yy * W + xx, kc = k * (1 - ht), kh = k * ht;
                Dc[o2] += kc; Rc[o2] += kc * cr; Gc[o2] += kc * cg; Bc[o2] += kc * cb;
                Dh[o2] += kh; Rh[o2] += kh * hr; Gh[o2] += kh * hg; Bh[o2] += kh * hb;
              }
            }
          }
        }
      }
      px = x; py = y; pw = wq; ph = hq; have = true;
    }
  }

  // Colour of the still parts, then the cold layer, then the hot layer over it.
  const lift = [0, 0, 0];
  hsv(0.72 + hue, 0.35, 0.17, lift, 0);
  // A dim colour on the red-orange-yellow stretch of the wheel reads brown, so the cold layer is raised there.
  const coldH = frac(0.69 + hue);
  const brown = coldH > 0.9 ? sstep(0.9, 0.97, coldH) : 1 - sstep(0.12, 0.2, coldH);
  const coldV = 0.62 * (1 + 0.55 * brown);
  const GC = 0.42, GH = 0.55;
  for (let o = 0, y = 0; y < H; y++) {
    for (let x = 0; x < W; x++, o++) {
      let r = lift[0] * st.disc[o];
      let g = lift[1] * st.disc[o];
      let b = lift[2] * st.disc[o];
      const dc = Dc[o];
      if (dc > 1e-4) {
        const a = (1 - exp(-GC * dc)) * coldV;
        const ia = 1 / dc;
        r = r * (1 - a) + Rc[o] * ia * a;
        g = g * (1 - a) + Gc[o] * ia * a;
        b = b * (1 - a) + Bc[o] * ia * a;
      }
      const dh = Dh[o];
      if (dh > 1e-4) {
        const a = 1 - exp(-GH * dh);
        const ia = 1 / dh;
        r = r * (1 - a) + Rh[o] * ia * a;
        g = g * (1 - a) + Gh[o] * ia * a;
        b = b * (1 - a) + Bh[o] * ia * a;
      }
      display.setPixel(x, y, round(min(1, r) * 255), round(min(1, g) * 255), round(min(1, b) * 255));
    }
  }
}
