// ===== Patternflow pattern =====
// Title:   Filiform
// Family:  corrosion
// Idea:    Threads of filiform corrosion creep under a glossy teal lacquer, each a wet orange-red head with a glint that leaves a lumpy rust-brown tail no other head will cross, so heads run beside a tail, stop against it or split in two, while new scratches and pinholes start threads that fan out from both sides and old tails sink into the coat under a sliding sheen.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: filiform corrosion under lacquer on steel, described by Sharman (1944), with the head as an oxygen concentration cell after Slabaugh and Grotheer (1954) and Ruggeri and Beck (1983)
// Round:   201
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Creep=0..4, Damp=-1..1, Wander=-1..1
//
// Knob 1: Hue. The colour of the lacquer, a deep teal where the knob opens and round the whole wheel; the rust under it stays rust.
// Knob 2: Creep. The pace of the corrosion: heads, new defects and the sinking of old tails. It opens at 2, a head moving about 0.6 LEDs a second, and 4 doubles it, with a longer wet stretch behind each head. At 0 everything stands and only the sheen slides.
// Knob 3: Damp. The humidity: how often new threads start and how often heads split. At the bottom a few long threads cross a mostly clear coat; at the top the coat fills with close, shorter, branching threads.
// Knob 4: Wander. How much the heads meander, gently along the grain of the metal where the knob opens, nearly straight and parallel at the bottom, curling and looping at the top.

const W = 64;
const H = 128;
const N = W * H;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

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

// Blend the colour at i in the frame towards (r, g, b) by m.
function mix(fr, i, r, g, b, m) {
  fr[i] += (r - fr[i]) * m;
  fr[i + 1] += (g - fr[i + 1]) * m;
  fr[i + 2] += (b - fr[i + 2]) * m;
}

// Head speed in LEDs per second of corrosion time.
const V0 = 0.6;
// Tail half-width in LEDs before the lumps.
const RT = 1.4;
// A tail stays full rust for A1 seconds of corrosion time, then sinks into the coat until A2.
const A1 = 45;
const A2 = 180;
// Seconds on the clock (not the corrosion's) a fresh tail stays wet, so a faster head trails a longer wet stretch.
const WET = 2.5;
// A tail blocks heads while its coverage is over BLOCK and it has not sunk below SUNK.
const BLOCK = 0.38;
const SUNK = 0.3;
// Seconds on the clock the coat has been corroding when the panel opens.
const PRE = 260;

function fade(a) {
  if (a <= A1) return 1;
  if (a >= A2) return 0;
  const u = (a - A1) / (A2 - A1);
  return 1 - u * u * (3 - 2 * u);
}

export function setup(params) {
  params.t = 0;
  params.tau = 0;
  params.started = false;
  params.cov = new Float32Array(N);
  params.born = new Float32Array(N).fill(-1e6);
  params.wb = new Float32Array(N).fill(-1e6);
  params.wt = 0;
  params.own = new Int32Array(N).fill(-1);
  params.cs = new Float32Array(N);
  params.tone = new Float32Array(N);
  params.vis = new Float32Array(N);
  params.ht = new Float32Array(N);
  params.fr = new Float32Array(N * 3);
  params.mottle = new Float32Array(N);
  for (let i = 0; i < N; i++) params.mottle[i] = Math.random() + Math.random() - 1;
  params.heads = [];
  params.pend = [];
  params.scr = [];
  params.nextId = 1;
  params.nextSpawn = 0;
  params.kn = { hue: 0, creep: 2, damp: 0, wander: 0.06 };
  params.col = new Float32Array(24);
}

function readKnobs(k, kn) {
  kn.hue = k[0];
  kn.creep = clamp(k[1], 0, 4);
  kn.damp = clamp(k[2], -1, 1);
  kn.wander = clamp(k[3], -1, 1);
}

// Is (x, y) on a tail this head may not enter? With heads set, a head within that many LEDs counts too.
function blocked(p, h, x, y, heads) {
  if (heads) {
    const r2 = heads * heads;
    for (const q of p.heads) {
      if (q === h || (q.id === h.par && h.s < h.parS) || (q.par === h.id && q.s < q.parS)) continue;
      const dx = q.x - x;
      const dy = q.y - y;
      if (dx * dx + dy * dy < r2) return 1;
    }
  }
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return 0;
  const i = yi * W + xi;
  if (p.cov[i] < BLOCK) return 0;
  if (fade(p.tau - p.born[i]) < SUNK) return 0;
  const o = p.own[i];
  if (o === h.id && h.s - p.cs[i] < 9) return 0;
  if (o === h.par && h.s < h.parS) return 0;
  return 1;
}

// The angle the tails this head may not enter run at near (x, y), or NaN where there is no edge to read.
function along(p, h, x, y) {
  const e = blocked(p, h, x + 1.5, y, 0) - blocked(p, h, x - 1.5, y, 0);
  const n = blocked(p, h, x, y + 1.5, 0) - blocked(p, h, x, y - 1.5, 0);
  const d1 = blocked(p, h, x + 1.1, y + 1.1, 0) - blocked(p, h, x - 1.1, y - 1.1, 0);
  const d2 = blocked(p, h, x + 1.1, y - 1.1, 0) - blocked(p, h, x - 1.1, y + 1.1, 0);
  const gx = e + 0.7 * (d1 + d2);
  const gy = n + 0.7 * (d1 - d2);
  if (gx * gx + gy * gy < 0.01) return NaN;
  return Math.atan2(gx, -gy);
}

// The direction the metal was rolled, roughly along the panel, swaying over it and over the minutes.
function grain(x, y, tau) {
  return 1.5708 + 0.45 * Math.sin(0.031 * x + 0.017 * y + 0.0071 * tau) + 0.3 * Math.sin(-0.023 * x + 0.041 * y - 0.0053 * tau + 1.3) + 0.5 * Math.sin(0.0021 * tau + 0.7);
}

function wrap(a) {
  return a - 6.2832 * Math.round(a / 6.2832);
}

// The turn from heading th to lie along a line at angle a, whichever way along it is nearer.
function axial(a, th) {
  return a - th - Math.PI * Math.round((a - th) / Math.PI);
}

// Lay rust in a disc of radius r round (x, y), owned by id.
function deposit(p, x, y, r, id, s, tone) {
  const x0 = Math.max(0, Math.floor(x - r - 1));
  const x1 = Math.min(W - 1, Math.ceil(x + r + 1));
  const y0 = Math.max(0, Math.floor(y - r - 1));
  const y1 = Math.min(H - 1, Math.ceil(y + r + 1));
  const tau = p.tau;
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
      const c = clamp(r + 0.5 - d, 0, 1);
      if (c <= 0) continue;
      const i = yy * W + xx;
      const v = p.cov[i] * fade(tau - p.born[i]);
      // A scratch or pinhole (s is -99) is never wet and never covers rust that still shows.
      if (p.own[i] === id) {
        if (c > p.cov[i]) {
          p.cov[i] = c;
          p.born[i] = tau;
          p.wb[i] = s > -99 ? p.wt : -1e6;
        }
      } else if (c > v + 0.05 && (s > -99 || v < 0.05)) {
        p.cov[i] = c;
        p.born[i] = tau;
        p.wb[i] = s > -99 ? p.wt : -1e6;
        p.own[i] = id;
        p.cs[i] = s;
        p.tone[i] = tone;
      }
    }
}

function newHead(p, x, y, th, par) {
  const h = {
    id: p.nextId++,
    par,
    parS: 6,
    x,
    y,
    th,
    th0: th,
    kw: 0,
    bias: (Math.random() < 0.5 ? -1 : 1) * (0.4 + 0.6 * Math.random()),
    s: 0,
    nb: 8,
    v: 0.8 + 0.4 * Math.random(),
    grow: 0,
    dying: -1,
    p1: Math.random() * 6.283,
    p2: Math.random() * 6.283,
  };
  p.heads.push(h);
  return h;
}

// Of a few spots, the one farthest from any tail, on a coarse grid.
function emptySpot(p, margin) {
  let best = -1;
  let bx = W / 2;
  let by = H / 2;
  for (let n = 0; n < 28; n++) {
    const x = margin + Math.random() * (W - 2 * margin);
    const y = margin + Math.random() * (H - 2 * margin);
    let near = 99;
    for (let dy = -12; dy <= 12; dy += 2)
      for (let dx = -12; dx <= 12; dx += 2) if (live(p, x + dx, y + dy)) near = Math.min(near, Math.hypot(dx, dy));
    near += Math.random() * 2;
    if (near > best) {
      best = near;
      bx = x;
      by = y;
    }
  }
  return [bx, by, best];
}

// Is there rust that still blocks at (x, y)?
function live(p, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return false;
  const i = yi * W + xi;
  return p.cov[i] > 0.3 && fade(p.tau - p.born[i]) > SUNK;
}

// Is there such rust within about r LEDs of (x, y)?
function busy(p, x, y, r) {
  return live(p, x, y) || live(p, x + r, y) || live(p, x - r, y) || live(p, x, y + r) || live(p, x, y - r);
}

// Does a thread starting at q have a clear run ahead? Then it leaves no stub.
function clearRun(p, q) {
  const h = { id: -2, par: q.par, parS: 6, s: 0 };
  for (let d = 0; d <= 12; d += 2) if (blocked(p, h, q.x + Math.cos(q.th) * d, q.y + Math.sin(q.th) * d, 2.4)) return false;
  return true;
}

// Queue the threads of a defect that have room, if at least min of them do.
function sprout(p, q, min) {
  const ok = q.filter((e) => clearRun(p, e));
  if (ok.length < min) return false;
  for (const e of ok) p.pend.push(e);
  return true;
}

// A new defect in the coat: a scratch with a fringe of threads on both sides, or a pinhole with two.
function defect(p) {
  const kn = p.kn;
  const wet = 0.5 + 0.5 * kn.damp;
  const spot = emptySpot(p, 5);
  if (spot[2] < 4) return false;
  let cx = spot[0];
  let cy = spot[1];
  const id = p.nextId++;
  if (Math.random() < 0.8) {
    const want = 10 + 16 * Math.random();
    let best = -1;
    let ba = 0;
    let b0 = 0;
    let b1 = 0;
    // The scratch lies mostly across the grain, so its threads leave along it, turned as little as gives it room.
    const a0 = grain(cx, cy, p.tau) + 1.5708 + (Math.random() - 0.5) * 2;
    for (let n = 0; n < 8; n++) {
      const a = a0 + ((n & 1 ? -1 : 1) * Math.ceil(n / 2) * Math.PI) / 8;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const run = [0, 0];
      for (let sg = 0; sg < 2; sg++) {
        const sd = sg ? 1 : -1;
        let d = 0;
        while (d < 26) {
          const x = cx + sd * ux * (d + 1);
          const y = cy + sd * uy * (d + 1);
          if (x < 2 || y < 2 || x > W - 2 || y > H - 2 || busy(p, x, y, 3)) break;
          d++;
        }
        run[sg] = d;
      }
      if (run[0] + run[1] > best) {
        best = run[0] + run[1];
        ba = a;
        b0 = run[0];
        b1 = run[1];
      }
      if (best >= want) break;
    }
    const ux = Math.cos(ba);
    const uy = Math.sin(ba);
    const len = Math.max(8, Math.min(want, best));
    const mid = clamp(0.5 * (b1 - b0), -0.5 * (best - len), 0.5 * (best - len));
    cx += ux * mid;
    cy += uy * mid;
    // A fringe on each side, the roots of one side between those of the other, so no thread seems to run on through it.
    const sp = 7 - 2.5 * wet;
    const n = Math.max(1, Math.floor(len / sp));
    const q = [];
    for (let side = -1; side <= 1; side += 2) {
      const nx = -uy * side;
      const ny = ux * side;
      const base = Math.atan2(ny, nx);
      for (let k = 0; k < n; k++) {
        const u = (k + (side > 0 ? 0.75 : 0.25) + 0.16 * (Math.random() - 0.5)) / n - 0.5;
        const s = u * len;
        // The threads of a side fan out from the scratch.
        const th = base - side * u * 1.3 + (Math.random() - 0.5) * 0.3;
        q.push({ x: cx + ux * s + nx * 2.4, y: cy + uy * s + ny * 2.4, th, par: id, at: p.tau + 0.5 + 10 * Math.random() });
      }
    }
    if (!sprout(p, q, 2)) return false;
    p.scr.push({ x0: cx - ux * len * 0.5, y0: cy - uy * len * 0.5, x1: cx + ux * len * 0.5, y1: cy + uy * len * 0.5, born: p.tau });
    for (let s = -len * 0.5; s <= len * 0.5; s += 0.4) deposit(p, cx + ux * s, cy + uy * s, 1.0, id, -99, 0.8);
  } else {
    // A pinhole sends its two threads off along the grain, one each way.
    const a0 = grain(cx, cy, p.tau) + (Math.random() - 0.5) * 0.8;
    const q = [];
    for (let k = 0; k < 2; k++) {
      const th = a0 + k * (Math.PI + (Math.random() - 0.5) * 0.6);
      q.push({ x: cx + Math.cos(th) * 2.6, y: cy + Math.sin(th) * 2.6, th, par: id, at: p.tau + 0.5 + 6 * Math.random() });
    }
    if (!sprout(p, q, 2)) return false;
    deposit(p, cx, cy, 1.2, id, -99, 0.8);
  }
  return true;
}

// One step of the corrosion, dtau seconds of corrosion time.
function step(p, dtau) {
  const kn = p.kn;
  p.tau += dtau;
  const tau = p.tau;
  const wet = 0.5 + 0.5 * kn.damp;
  const target = Math.round(7 + 16 * wet);
  const wd = kn.wander;
  const sig = 0.05 * Math.pow(4, wd);
  const lam = 7 + 3 * wd;
  const bias = wd > 0 ? 0.12 * wd * wd : 0;
  const turnMax = wd > 0.6 ? 9 : 1.9 + Math.max(0, wd) * 2;
  const pull = 0.05 * (1 - smooth(-0.2, 0.9, wd)) + 0.02 * (1 - smooth(-1, 0, wd));
  const branch = 0.004 + 0.016 * wet;
  const heads = p.heads;

  // Threads waiting at a defect start when their time comes, if their way out is clear.
  for (let i = p.pend.length - 1; i >= 0; i--) {
    const q = p.pend[i];
    if (tau < q.at) continue;
    p.pend.splice(i, 1);
    if (clearRun(p, q)) newHead(p, q.x, q.y, q.th, q.par);
  }

  for (const h of heads) {
    if (h.dying >= 0) {
      h.dying += dtau / 1.5;
      continue;
    }
    h.grow = Math.min(1, h.grow + dtau / 1.2);
    const ds = V0 * h.v * dtau;
    if (ds <= 0) continue;
    // Wander: the bend follows a slow random walk along the path.
    h.kw += (-h.kw / lam) * ds + sig * Math.sqrt(2 * ds / lam) * (Math.random() * 2 - 1) * 1.73;
    // Feel ahead and to the sides.
    const c = Math.cos(h.th);
    const sn = Math.sin(h.th);
    const f1 = blocked(p, h, h.x + c * 3.4, h.y + sn * 3.4, 2.4);
    const f2 = blocked(p, h, h.x + c * 4.8, h.y + sn * 4.8, 2.4);
    const L1 = blocked(p, h, h.x + Math.cos(h.th - 0.55) * 4, h.y + Math.sin(h.th - 0.55) * 4, 0);
    const R1 = blocked(p, h, h.x + Math.cos(h.th + 0.55) * 4, h.y + Math.sin(h.th + 0.55) * 4, 0);
    const L = L1 + 0.6 * blocked(p, h, h.x + Math.cos(h.th - 1.1) * 4.6, h.y + Math.sin(h.th - 1.1) * 4.6, 0);
    const R = R1 + 0.6 * blocked(p, h, h.x + Math.cos(h.th + 1.1) * 4.6, h.y + Math.sin(h.th + 1.1) * 4.6, 0);
    // The grain of the rolled metal: heads lean towards running along it, either way.
    const G = grain(h.x, h.y, tau);
    let k = h.kw + bias * h.bias + pull * Math.sin(2 * (G - h.th));
    let go = ds;
    if (f1 + f2 > 0) {
      // A tail ahead: turn to run along it, slowing; meeting it square on, or boxed in, the head stops.
      if (f1 && L >= 1 && R >= 1) {
        h.dying = 0;
        continue;
      }
      const d = f1 ? 3.4 : 4.8;
      let dl = axial(along(p, h, h.x + c * d, h.y + sn * d), h.th);
      if (dl !== dl) dl = L > R ? 1 : R > L ? -1 : h.kw >= 0 ? 1 : -1;
      else dl += dl >= 0 ? 0.15 : -0.15;
      if (f1 && Math.abs(dl) > 1.15) {
        h.dying = 0;
        continue;
      }
      k = 0.5 * dl;
      if (f1) go = ds * 0.6;
    } else if (L + R > 0) {
      // A tail beside: lie along it, a little away.
      const sg = L >= R ? -1 : 1;
      const a = (sg < 0 ? L1 : R1) ? 0.55 : 1.1;
      const d = a < 1 ? 4.0 : 4.6;
      const dl = axial(along(p, h, h.x + Math.cos(h.th + sg * a) * d, h.y + Math.sin(h.th + sg * a) * d), h.th);
      if (dl === dl) k += clamp(0.25 * dl, -0.15, 0.15);
      // Too close beside it, it eases away, so a gap shows between the two.
      k += 0.03 * (L - R) + 0.1 * (L1 - R1);
    }
    // Near the panel's edge a head heading out at a slant bends back in a little.
    for (let e = 0; e < 4; e++) {
      const dist = e === 0 ? h.x : e === 1 ? W - h.x : e === 2 ? h.y : H - h.y;
      if (dist > 9) continue;
      const nx = e === 0 ? 1 : e === 1 ? -1 : 0;
      const ny = e === 2 ? 1 : e === 3 ? -1 : 0;
      const out = -(c * nx + sn * ny);
      if (out <= 0) continue;
      k += 0.09 * (1 - Math.max(0, dist) / 9) * Math.sqrt(out) * (c * ny - sn * nx >= 0 ? 1 : -1);
    }
    k = clamp(k, -0.32, 0.32);
    h.th += k * go;
    // A head does not double back on itself unless the knob lets it curl.
    if (Math.abs(wrap(h.th - h.th0)) > turnMax) {
      h.dying = 0;
      continue;
    }
    h.x += Math.cos(h.th) * go;
    h.y += Math.sin(h.th) * go;
    h.s += go;
    if (h.x < -3 || h.y < -3 || h.x > W + 3 || h.y > H + 3) {
      h.dying = 9;
      continue;
    }
    // A head that runs into a dry tail or another head stops there.
    if (blocked(p, h, h.x + Math.cos(h.th) * 2.2, h.y + Math.sin(h.th) * 2.2, 1.6)) {
      h.dying = 0;
      continue;
    }
    const lump = 0.6 * Math.sin(0.83 * h.s + h.p1) + 0.4 * Math.sin(1.97 * h.s + h.p2);
    const r = RT * (1 + 0.15 * lump);
    const bx = h.x - Math.cos(h.th) * 0.8;
    const by = h.y - Math.sin(h.th) * 0.8;
    deposit(p, bx, by, r, h.id, h.s, 1 + 0.12 * lump);
    // Now and then the head splits in two.
    if (h.s > h.nb && heads.length < target * 1.4 && Math.random() < branch * ds) {
      const a = 0.35 + 0.25 * Math.random();
      const ch = newHead(p, h.x, h.y, h.th - a, h.id);
      ch.grow = 0.6;
      h.th += a;
      h.par = ch.id;
      h.parS = h.s + 6;
      h.nb = h.s + 10;
      ch.nb = 10;
    }
  }
  // A head that has died leaves a dry knob of rust.
  for (let i = heads.length - 1; i >= 0; i--) {
    const h = heads[i];
    if (h.dying >= 1) {
      if (h.dying < 5 && h.s > 5) deposit(p, h.x, h.y, 1.55 * h.grow, h.id, h.s + 20, 1.1);
      heads.splice(i, 1);
    }
  }
  for (let i = p.scr.length - 1; i >= 0; i--) if (tau - p.scr[i].born > 20) p.scr.splice(i, 1);

  if (tau >= p.nextSpawn && heads.length + p.pend.length < target) {
    if (!defect(p)) p.nextSpawn = tau + 1;
    else p.nextSpawn = tau + (2 + 4 * Math.random()) * (1.5 - wet);
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  readKnobs(k, params.kn);
  if (!params.started) {
    params.started = true;
    // Run PRE seconds at the knob's pace (at least half the opening pace), so the panel opens on threads of every age.
    const rate = Math.max(0.5, params.kn.creep / 2);
    for (let s = 0; s < PRE * 10; s++) {
      params.wt += 0.1;
      step(params, 0.1 * rate);
    }
  }
  params.t += dt;
  params.wt += dt;
  let dtau = Math.min(dt, 0.1) * (params.kn.creep / 2);
  while (dtau > 1e-6) {
    const d = Math.min(dtau, 0.25);
    step(params, d);
    dtau -= d;
  }
}

// Rust fresh and old, the wet stretch and the wet head, as r, g, b.
const RUST = [128, 64, 26, 88, 44, 22, 205, 86, 28, 255, 92, 34];

// The lacquer at the knob's hue and its sheen, then the rust.
function palette(p) {
  const col = p.col;
  const h = 0.47 + p.kn.hue;
  // A coat near the rust's own hue is made deeper, so the threads still stand out on it.
  const near = 1 - smooth(0.05, 0.16, Math.abs(wrap((h - 0.045) * 6.2832) / 6.2832));
  const v = 0.27 * (1 - 0.4 * near);
  hsv(h, 0.88, v, col, 0);
  hsv(h - 0.02, 0.38, 0.9, col, 6);
  col.set(RUST, 9);
}

export function draw(display, p) {
  palette(p);
  const col = p.col;
  const { cov, born, tone, vis, ht, fr, mottle } = p;
  const tau = p.tau;
  const t = p.t;
  for (let i = 0; i < N; i++) {
    const c = cov[i];
    if (c > 0) {
      const f = fade(tau - born[i]);
      vis[i] = c * smooth(0.04, 0.55, f);
      ht[i] = c * f;
    } else {
      vis[i] = 0;
      ht[i] = 0;
    }
  }
  // The sheen: a soft band of reflected light sliding slowly over the coat.
  const phi = 0.95 + 0.45 * Math.sin(0.023 * t + 0.4) + 0.25 * Math.sin(0.0137 * t + 2.1);
  const ux = Math.cos(phi);
  const uy = Math.sin(phi);
  const span = 64 * Math.abs(ux) + 128 * Math.abs(uy);
  const u0 = Math.min(0, 64 * ux) + Math.min(0, 128 * uy);
  // It travels one way at a swaying pace, the next band coming in as one leaves.
  const sw = 15 + 5 * Math.sin(0.031 * t + 0.6);
  const run = span + 2 * sw;
  const ph = 0.0125 * t + 0.09 * Math.sin(0.023 * t + 0.9);
  const cen = u0 - sw + run * (ph - Math.floor(ph));
  const isw = 1 / (2 * sw * sw);
  const lx = -0.6;
  const ly = -0.8;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const uu = x * ux + y * uy - cen;
      const ua = uu + run;
      const S = Math.exp(-(uu * uu) * isw) + Math.exp(-(ua * ua) * isw);
      // The coat, with a slow swell of light and a faint mottle of the metal under it, lifted under the sheen.
      const g = (0.86 + 0.14 * Math.sin(0.045 * x + 0.021 * y + 0.011 * t) + 0.04 * mottle[i]) * (1 + 0.55 * S);
      let r = col[0] * g;
      let gg = col[1] * g;
      let b = col[2] * g;
      r += (col[6] - r) * 0.2 * S;
      gg += (col[7] - gg) * 0.2 * S;
      b += (col[8] - b) * 0.2 * S;
      const v = vis[i];
      if (v > 0.003) {
        const a = tau - born[i];
        const f = fade(a);
        const dk = smooth(15, 120, a);
        const tn = tone[i] * (1 + 0.09 * mottle[i]) * (1 + 0.25 * S);
        let rr = (col[9] + (col[12] - col[9]) * dk) * tn;
        let rg = (col[10] + (col[13] - col[10]) * dk) * tn;
        let rb = (col[11] + (col[14] - col[11]) * dk) * tn;
        const aw = p.wt - p.wb[i];
        if (aw < WET) {
          const w = 1 - aw / WET;
          rr += (col[15] - rr) * w;
          rg += (col[16] - rg) * w;
          rb += (col[17] - rb) * w;
        }
        // Old rust sinks: it turns to a darker shade of the coat round it as it fades.
        rr = 0.72 * r + (rr - 0.72 * r) * f;
        rg = 0.72 * gg + (rg - 0.72 * gg) * f;
        rb = 0.72 * b + (rb - 0.72 * b) * f;
        r += (rr - r) * v;
        gg += (rg - gg) * v;
        b += (rb - b) * v;
      }
      // Raised tails catch light on one side and shade the other; the sheen glances off the lit side.
      const hc = ht[i];
      const hx = (x < W - 1 ? ht[i + 1] : hc) - (x > 0 ? ht[i - 1] : hc);
      const hy = (y < H - 1 ? ht[i + W] : hc) - (y > 0 ? ht[i - W] : hc);
      const lam = clamp(-(hx * lx + hy * ly), -1, 1);
      if (lam !== 0) {
        const shade = 1 + 0.28 * lam;
        r *= shade;
        gg *= shade;
        b *= shade;
        if (lam > 0) {
          const sp = 0.3 * S * lam;
          r += (col[6] - r) * sp;
          gg += (col[7] - gg) * sp;
          b += (col[8] - b) * sp;
        }
      }
      fr[i * 3] = r;
      fr[i * 3 + 1] = gg;
      fr[i * 3 + 2] = b;
    }
  }
  // Fresh scratches flash bare metal before they rust.
  for (const s of p.scr) {
    const a = tau - s.born;
    const m = smooth(0, 0.3, a) * (1 - smooth(0.4, 4, a));
    if (m <= 0) continue;
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const L2 = dx * dx + dy * dy;
    const x0 = Math.max(0, Math.floor(Math.min(s.x0, s.x1) - 2));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(s.x0, s.x1) + 2));
    const y0 = Math.max(0, Math.floor(Math.min(s.y0, s.y1) - 2));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(s.y0, s.y1) + 2));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - s.x0;
        const py = y + 0.5 - s.y0;
        const u = clamp((px * dx + py * dy) / L2, 0, 1);
        const d = Math.hypot(px - u * dx, py - u * dy);
        const c = clamp(1.4 - d, 0, 1) * m * 0.6;
        if (c <= 0) continue;
        mix(fr, (y * W + x) * 3, 160, 176, 170, c);
      }
  }
  // The wet heads: a swollen orange-red blister, a little long along its way, with a glint.
  for (const h of p.heads) {
    const life = h.grow * (h.dying >= 0 ? 1 - smooth(0, 1, h.dying) : 1);
    if (life <= 0.01) continue;
    const c = Math.cos(h.th);
    const sn = Math.sin(h.th);
    const ra = 2.4 * (0.5 + 0.5 * life);
    const rb = 1.85 * (0.5 + 0.5 * life);
    const x0 = Math.max(0, Math.floor(h.x - 3));
    const x1 = Math.min(W - 1, Math.ceil(h.x + 3));
    const y0 = Math.max(0, Math.floor(h.y - 3));
    const y1 = Math.min(H - 1, Math.ceil(h.y + 3));
    const gx = h.x - 0.55 + 0.2 * c;
    const gy = h.y - 0.6 + 0.2 * sn;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - h.x;
        const dy = y + 0.5 - h.y;
        const u = (dx * c + dy * sn) / ra;
        const v = (-dx * sn + dy * c) / rb;
        const d = Math.sqrt(u * u + v * v);
        const m = clamp((1.15 - d) * 2.2, 0, 1) * life;
        if (m <= 0) continue;
        const i = (y * W + x) * 3;
        const core = 1 - 0.25 * d;
        mix(fr, i, col[18] * core, col[19] * core, col[20] * core, m);
        const ex = x + 0.5 - gx;
        const ey = y + 0.5 - gy;
        mix(fr, i, 255, 238, 212, Math.min(1, Math.exp(-(ex * ex + ey * ey) / 0.5) * life * 1.1));
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, clamp(Math.round(fr[i]), 0, 255), clamp(Math.round(fr[i + 1]), 0, 255), clamp(Math.round(fr[i + 2]), 0, 255));
    }
}
