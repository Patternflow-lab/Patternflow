// ===== Patternflow pattern =====
// Title:   Orowan Loops
// Family:  dislocation
// Idea:    The slip plane of a hardened crystal seen from above: lines of dislocation are pushed up through a forest of hard particles, bow between them, wrap round each and pinch shut behind it, leaving an ember loop that makes the particle bigger for the next line, while a source at the bottom keeps sending new lines.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Orowan bypass of a precipitate by a bowing dislocation (Egon Orowan, 1948; the dislocation itself from Orowan, Michael Polanyi and G. I. Taylor, 1934), the Frank-Read source that bows, closes into a loop and starts again (F. C. Frank and W. T. Read, 1950), the level-set method (Stanley Osher and James Sethian, 1988), pattern round 222
// Round:   222
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stress=0.5..3.5, Density=-1..1, Source=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the ground is indigo, the lines ember orange to pale yellow where they move fast, the loops a dimmer ember, the particles steel teal. At 0.5 the ground is olive and the lines blue-white.
// Knob 2: Stress. The shear stress, shown as the speed of a free line: 2.4 LEDs a second at 0.5, 5.5 at 2 where it opens, 12.6 at 3.5. The tension is fixed, so a line pinned between two particles bows to a radius of tension over stress: 3.8 LEDs at 0.5, 1.6 at 2, 0.7 at 3.5. At 0.5 a line hangs in shallow arcs and goes through only gaps wider than 7.5 LEDs, and one that has made almost no headway is given more stress, up to 3.2 times, until it goes. At 3.5 lines wrap tight round every particle and cross the panel in ten seconds.
// Knob 3: Density. How much of a forest of 38 particles is in the crystal and how big each is: 14 at 0.9 of its radius at -1, 25 at 1.02 at 0, all 38 at 1.14 at 1. A particle grows or shrinks in over a second or two. Radii are 2 to 3.6 LEDs before scaling, and the nearest edges are 6.2 LEDs apart.
// Knob 4: Source. How often a new line is sent: 0.06 a second at -1 (one in 17 s), 0.16 at 0 (one in 6 s), 0.43 at 1 (one in 2.3 s). A new line waits until the last has swept a seventh of the panel, and six are the most on it. The first 36 s are run with the knob where it stands, so the opening shows that many.

// The panel is a slip plane, 64 LEDs across and 128 up, with 38 hard precipitates in it. Each line is the zero set of its own
// level-set field phi on the 64 by 128 grid, negative behind it and positive ahead, and moves along its normal at m (tau - T kappa):
// tau the stress, T the tension, kappa the curvature, m the mobility, 1 in open crystal and 0 in a particle. A line that reaches
// a particle is held there while the rest goes on, bows round it, wraps behind it and the two arms meet and close: the Orowan
// bypass. The ring left round the particle is kept as an ember loop, and phi is filled in over the island so the line goes on in
// one piece. Each loop adds 0.8 LED to what the next line must get round (hardening) and fades after 35 to 70 s (recovery), four
// at most. A particle carrying more than 1.2 loops that a line is pushing at is sheared at 0.45 a second for each loop above that:
// the line cuts through, the loops go out in a flash and the particle regrows from 0.6 of its size.
// Godunov upwinding for the stress term, central differences for the curvature term, T = 9 LED squared a second, 2 steps of
// 0.0167 s a frame, only cells within 4 LEDs of a line stepped, then a pass of reinitialisation (Russo and Smereka's fix keeps
// the line where it was). A line bows to R = T / tau, so the gap it can pass is wider than 2 T / v.

const W = 64, H = 128, N = W * H;
const BAND = 4; // phi is held within this many LEDs of the line
const MAXF = 6; // lines on the panel at once
const NP = 64; // most particles tried for the forest
const MAXL = 4; // loops kept on a particle
const TEN = 9; // line tension, LED squared a second
const DTSUB = 0.0195; // longest step, s
const GROW = 0.8; // LEDs a loop adds to a particle's radius
const WARM = 36; // seconds run before the first frame
const { floor, ceil, min, max, sqrt, exp, PI, cos, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Palette at Hue 0.
const PAL = {
  g0: [8, 6, 34], // unslipped ground
  g1: [24, 19, 84], // slipped ground
  pc: [16, 62, 74], // particle, middle
  pr: [92, 214, 206], // particle, lit rim
  rg: [232, 84, 16], // loop
  l0: [255, 98, 14], // line, held
  l1: [255, 240, 160], // line, running
  gl: [255, 90, 16], // glow round a line
  fl: [255, 170, 70], // flash of a sheared particle
};

function newField() {
  return {
    alive: false, phi: new Float32Array(N), vel: new Float32Array(N), prev: new Float32Array(W), cur: new Float32Array(W),
    state: new Uint8Array(NP), xlo: new Int16Array(H), xhi: new Int16Array(H), rlo: new Int16Array(H), rhi: new Int16Array(H), fin: false, r0: 0, r1: H - 1, bandLo: 0, bandHi: H - 1, swept: 0, sweptPrev: 0, rate: 0, boost: 1, age: 0,
  };
}

function makeForest(rnd) {
  const ps = [];
  for (let tries = 0; tries < 6000 && ps.length < NP; tries++) {
    const r = 2 + 2 * rnd(), x = r + 2.6 + (W - 2 * r - 5.2) * rnd(), y = r + 2.6 + (H - 2 * r - 5.2) * rnd();
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i], dx = x - q.x, dy = y - q.y, m = r + q.r0 + 6.2;
      if (dx * dx + dy * dy < m * m) {
        ok = false;
        break;
      }
    }
    if (ok) ps.push({ x, y, r0: r, u: rnd(), act: 0, sc: 1, shf: 0, flash: 0, loops: [], rr: 0, sw: 0 });
  }
  return ps;
}

export function setup(params) {
  const rnd = rng(222);
  const S = {
    rnd, t: 0, warm: false, parts: makeForest(rnd), fields: [], mob: new Float32Array(N), solid: new Uint8Array(N), near: new Uint8Array(N),
    swp: new Float32Array(N), R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N),
    LR: new Float32Array(N), LG: new Float32Array(N), LB: new Float32Array(N),
    v0: 5.5, lam: 0.16, frac: 0.56, rs: 1, hue: 0, sinceEmit: 0,
  };
  for (let i = 0; i < MAXF; i++) S.fields.push(newField());
  params.s = S;
}

function particles(S, dt, instant) {
  const ps = S.parts, k = instant ? 1 : min(1, dt * 1.6);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const target = sm(0, 1, (S.frac - p.u) / 0.1 + 0.5);
    p.act += (target - p.act) * k;
    if (p.act < 0.02 && target === 0) p.act = 0;
    p.sc = min(1, p.sc + dt / 16);
    p.shf = max(0, p.shf - dt / 4.5);
    p.flash = max(0, p.flash - dt / 0.5);
    let sw = 0;
    const L = p.loops;
    for (let j = L.length - 1; j >= 0; j--) {
      const l = L[j];
      l.age += dt;
      let f = 1;
      if (l.fast) f = max(0, 1 - (l.age - l.fast) / 1.2);
      else if (l.age > l.life) f = max(0, 1 - (l.age - l.life) / 12);
      l.w = min(1, l.age / 0.6) * f;
      if (f <= 0 || p.act === 0) L.splice(j, 1);
      else sw += l.w;
    }
    p.sw = sw;
    p.rd = p.r0 * S.rs * p.sc * p.act; // the particle itself
    p.rr = p.act * (p.r0 * S.rs * p.sc) + GROW * sw * p.act; // what a line has to get round
  }
}

function buildMobility(S) {
  const mob = S.mob, solid = S.solid, near = S.near, ps = S.parts;
  mob.fill(1);
  solid.fill(0);
  near.fill(0);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.rr < 0.6) continue;
    const mi = p.shf * 0.75, ext = p.rr + 1.5;
    const x0 = max(0, floor(p.x - ext)), x1 = min(W - 1, ceil(p.x + ext));
    const y0 = max(0, floor(p.y - ext)), y1 = min(H - 1, ceil(p.y + ext));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - p.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - p.x, d = sqrt(dx * dx + dy * dy) - p.rr;
        if (d >= 1.3) continue;
        const m = d <= 0 ? mi : mi + (1 - mi) * sm(0, 1.3, d), k = y * W + x;
        if (m < mob[k]) mob[k] = m;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (mob[k] < 0.02) solid[k] = 1;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (!solid[k]) continue;
      for (let j = max(0, y - 1); j <= min(H - 1, y + 1); j++) for (let i = max(0, x - 1); i <= min(W - 1, x + 1); i++) near[j * W + i] = 1;
    }
  }
}

function emit(S) {
  const F = S.fields.find((f) => !f.alive);
  if (!F) return;
  const rnd = S.rnd, xs = 10 + 44 * rnd(), wb = 7 + 5 * rnd(), hb = 9 + 7 * rnd(), yb = H + 3;
  const phi = F.phi;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - xs) / wb, yf = yb - hb * exp(-u * u);
      phi[y * W + x] = cl(yf - (y + 0.5), -BAND, BAND);
    }
  }
  F.vel.fill(0);
  F.state.fill(0);
  F.xlo.fill(0);
  F.xhi.fill(W - 1);
  Object.assign(F, { alive: true, r0: 0, r1: H - 1, bandLo: 0, bandHi: H - 1, swept: 0, sweptPrev: 0, rate: S.v0, boost: 1, age: 0, fin: false });
  S.sinceEmit = 0;
}

// One explicit step of phi_t = -m v |grad phi| + m T kappa |grad phi| over the cells near the line, in place
// with the old row above kept aside. v is the speed of a free line.
function stepField(F, S, h, v) {
  const phi = F.phi, vel = F.vel, prev = F.prev, cur = F.cur, mob = S.mob, solid = S.solid, near = S.near, xlo = F.xlo, xhi = F.xhi;
  const hv = 1 / h;
  let have = -2;
  for (let y = F.r0; y <= F.r1; y++) {
    const x0 = xlo[y], x1 = xhi[y];
    if (x0 > x1) continue;
    const ro = y * W, dro = (y < H - 1 ? y + 1 : y) * W, uro = (y > 0 ? y - 1 : y) * W;
    if (have !== y - 1) prev.set(phi.subarray(uro, uro + W));
    for (let x = x0; x <= x1; x++) {
      const k = ro + x, m = mob[k], a = phi[k];
      if (m < 0.02) {
        cur[x] = a;
        continue;
      }
      const xl = x > 0 ? x - 1 : 0, xr = x < W - 1 ? x + 1 : W - 1;
      let pL = phi[ro + xl], pR = phi[ro + xr], pU = prev[x], pD = phi[dro + x];
      let uL = prev[xl], uR = prev[xr], dL = phi[dro + xl], dR = phi[dro + xr];
      // Godunov upwinding for a front moving toward larger phi
      const dxm = a - pL, dxp = pR - a, dym = a - pU, dyp = pD - a;
      const grad = sqrt((dxm > 0 ? dxm * dxm : 0) + (dxp < 0 ? dxp * dxp : 0) + (dym > 0 ? dym * dym : 0) + (dyp < 0 ? dyp * dyp : 0));
      if (near[k]) {
        // beside a particle a solid neighbour is mirrored, so it does not push the curvature
        if (solid[ro + xl]) pL = a;
        if (solid[ro + xr]) pR = a;
        if (solid[uro + x]) pU = a;
        if (solid[dro + x]) pD = a;
        if (solid[uro + xl]) uL = a;
        if (solid[uro + xr]) uR = a;
        if (solid[dro + xl]) dL = a;
        if (solid[dro + xr]) dR = a;
      }
      const px = (pR - pL) * 0.5, py = (pD - pU) * 0.5, pxx = pR - 2 * a + pL, pyy = pD - 2 * a + pU, pxy = (dR - dL - uR + uL) * 0.25;
      const den = px * px + py * py;
      const kap = den > 1e-4 ? (pxx * py * py - 2 * px * py * pxy + pyy * px * px) / den : 0;
      let n = a + h * m * (TEN * kap - v * grad);
      if (n > BAND) n = BAND;
      else if (n < -BAND) n = -BAND;
      cur[x] = n;
      const sp = (a - n) * hv;
      vel[k] += ((sp < 0 ? 0 : sp > 1.3 * v * m ? 1.3 * v * m : sp) - vel[k]) * 0.35;
    }
    prev.set(phi.subarray(ro, ro + W));
    for (let x = x0; x <= x1; x++) phi[ro + x] = cur[x];
    have = y;
  }
}

// One sweep of reinitialisation, phi_t + sign (|grad phi| - 1) = 0, so that phi stays a distance. A cell next to the
// line is set from where the line crosses, so the line does not move.
function reinit(F, S, tau) {
  const phi = F.phi, prev = F.prev, cur = F.cur, solid = S.solid, xlo = F.xlo, xhi = F.xhi;
  let have = -2;
  for (let y = F.r0; y <= F.r1; y++) {
    const x0 = xlo[y], x1 = xhi[y];
    if (x0 > x1) continue;
    const ro = y * W, dro = (y < H - 1 ? y + 1 : y) * W, uro = (y > 0 ? y - 1 : y) * W;
    if (have !== y - 1) prev.set(phi.subarray(uro, uro + W));
    for (let x = x0; x <= x1; x++) {
      const k = ro + x, a = phi[k];
      if (solid[k]) {
        cur[x] = a;
        continue;
      }
      const xl = x > 0 ? x - 1 : 0, xr = x < W - 1 ? x + 1 : W - 1;
      let pL = phi[ro + xl], pR = phi[ro + xr], pU = prev[x], pD = phi[dro + x];
      if (solid[ro + xl]) pL = a;
      if (solid[ro + xr]) pR = a;
      if (solid[uro + x]) pU = a;
      if (solid[dro + x]) pD = a;
      let n;
      if (a * pL < 0 || a * pR < 0 || a * pU < 0 || a * pD < 0) {
        const gx = (pR - pL) * 0.5, gy = (pD - pU) * 0.5, gm = sqrt(gx * gx + gy * gy);
        const D = gm > 0.2 ? a / gm : a * 5;
        n = a + (D - a) * 0.5;
      } else {
        const sg = a > 0 ? 1 : -1, dxm = sg * (a - pL), dxp = sg * (pR - a), dym = sg * (a - pU), dyp = sg * (pD - a);
        const xm = dxm > 0 ? dxm : 0, xp = dxp < 0 ? dxp : 0, ym = dym > 0 ? dym : 0, yp = dyp < 0 ? dyp : 0;
        const gx2 = max(xm * xm, xp * xp), gy2 = max(ym * ym, yp * yp);
        n = a - tau * sg * (sqrt(gx2 + gy2) - 1);
      }
      cur[x] = n > BAND ? BAND : n < -BAND ? -BAND : n;
    }
    prev.set(phi.subarray(ro, ro + W));
    for (let x = x0; x <= x1; x++) phi[ro + x] = cur[x];
    have = y;
  }
}

// After the steps: the cells near the line, the swept count, pockets, the creep of a held line.
function survey(F, S, dt, v) {
  const phi = F.phi, solid = S.solid, xlo = F.xlo, xhi = F.xhi, rlo = F.rlo, rhi = F.rhi, lim = BAND - 0.15;
  let lo = H, hi = -1, sw = 0, ahead = 0;
  for (let y = 0; y < H; y++) {
    const ro = y * W;
    let a = W, b = -1;
    for (let x = 0; x < W; x++) {
      const p = phi[ro + x];
      if (p < 0) sw++;
      if (solid[ro + x]) continue;
      if (p > 0) {
        ahead++;
        if (F.fin) phi[ro + x] = -0.3;
      }
      if (p > -lim && p < lim) {
        if (x < a) a = x;
        b = x;
      }
    }
    rlo[y] = a;
    rhi[y] = b;
    if (b >= 0) {
      if (y < lo) lo = y;
      hi = y;
    }
  }
  // the cells to step next: those near the line, 3 columns and 2 rows wider each way
  for (let y = 0; y < H; y++) {
    let a = W, b = -1;
    for (let j = max(0, y - 2); j <= min(H - 1, y + 2); j++) {
      if (rhi[j] < 0) continue;
      if (rlo[j] < a) a = rlo[j];
      if (rhi[j] > b) b = rhi[j];
    }
    if (b >= 0) {
      xlo[y] = a > 3 ? a - 3 : 0;
      xhi[y] = b < W - 4 ? b + 3 : W - 1;
    } else {
      xlo[y] = W;
      xhi[y] = -1;
    }
  }
  // a pocket a line cannot get into (between a particle and the edge) is let go once little else is left
  F.fin = ahead <= 90;
  F.swept = sw;
  F.bandLo = lo > hi ? H : lo;
  F.bandHi = hi;
  F.r0 = lo > hi ? 0 : max(0, lo - 2);
  F.r1 = lo > hi ? -1 : min(H - 1, hi + 2);
  const inst = ((sw - F.sweptPrev) / W) / max(dt, 1e-3);
  F.sweptPrev = sw;
  F.rate += (inst - F.rate) * min(1, dt / 1.5);
  if (F.rate < 0.3 * v && F.age > 1.5) F.boost = min(3.2, F.boost + 0.25 * dt);
  else F.boost = max(1, F.boost - 0.35 * dt * (F.boost - 1 + 0.2));
  return ahead;
}

const LUT = new Float32Array(98);
for (let i = 0; i < 98; i++) LUT[i] = 1 - Math.pow(0.6, i / 16);

const RS = 14;
const RC = [], RSN = [];
for (let i = 0; i < RS; i++) {
  RC.push(cos((2 * PI * i) / RS));
  RSN.push(sin((2 * PI * i) / RS));
}

// Has the line closed round each particle it has reached? Adds a loop for each, and may shear a loaded one.
function closures(F, S, dt, force) {
  const phi = F.phi, solid = S.solid, ps = S.parts, st = F.state, rnd = S.rnd;
  for (let i = 0; i < ps.length; i++) {
    if (st[i]) continue;
    const p = ps[i];
    if (p.act < 0.5 || p.rr < 0.6) continue;
    const rho = p.rr + 1.7;
    if (!force && p.y + rho + 1 < F.bandLo) continue; // not reached yet
    const cx = cl(floor(p.x), 0, W - 1), cy = cl(floor(p.y), 0, H - 1);
    const centre = phi[cy * W + cx];
    let top = -BAND, touch = BAND;
    for (let j = 0; j < RS; j++) {
      const x = cl(floor(p.x + RC[j] * rho), 0, W - 1), y = cl(floor(p.y + RSN[j] * rho), 0, H - 1);
      const q = phi[y * W + x];
      if (solid[y * W + x]) continue;
      if (q > top) top = q;
      if (q < touch) touch = q;
    }
    if (!force && top > -0.2) {
      // the line is at this particle and has not closed; a loaded one may be cut through
      if (touch < 0 && p.sw > 1.2 && p.shf === 0) {
        const pr = 0.45 * (p.sw - 1.2) * (S.v0 * F.boost / 5.5) * dt;
        if (rnd() < pr) shear(p);
      }
      continue;
    }
    st[i] = 1;
    if (centre > 0) {
      if (p.shf === 0) addLoop(p, rnd);
      // fill the island, so the contour goes and the ring takes over
      const fr = rho + 0.8, x0 = max(0, floor(p.x - fr)), x1 = min(W - 1, ceil(p.x + fr));
      const y0 = max(0, floor(p.y - fr)), y1 = min(H - 1, ceil(p.y + fr));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - p.x, dy = y + 0.5 - p.y, d = sqrt(dx * dx + dy * dy);
          if (d > fr) continue;
          const k = y * W + x, nv = solid[k] ? -BAND : -(0.5 + 0.35 * (fr - d));
          if (phi[k] > nv) phi[k] = nv;
        }
      }
    }
  }
}

function addLoop(p, rnd) {
  p.loops.push({ age: 0, life: 35 + 35 * rnd(), w: 0, fast: 0 });
  if (p.loops.length > MAXL) {
    const l = p.loops[0];
    if (!l.fast) l.fast = l.age;
  }
}

function shear(p) {
  for (let j = 0; j < p.loops.length; j++) if (!p.loops[j].fast) p.loops[j].fast = p.loops[j].age;
  p.shf = 1;
  p.sc = 0.6;
  p.flash = 1;
}

function advance(S, dt, instant) {
  S.t += dt;
  particles(S, dt, instant);
  buildMobility(S);
  const nsub = ceil(dt / DTSUB), h = dt / nsub;
  let any = false;
  for (let fi = 0; fi < MAXF; fi++) {
    const F = S.fields[fi];
    if (!F.alive) continue;
    F.age += dt;
    const v = S.v0 * F.boost;
    for (let s = 0; s < nsub; s++) if (F.r1 >= F.r0) {
      stepField(F, S, h, v);
      if (s === nsub - 1) reinit(F, S, 0.5);
    }
    const ahead = survey(F, S, dt, S.v0);
    closures(F, S, dt, false);
    if (ahead === 0) {
      closures(F, S, dt, true);
      F.alive = false;
      continue;
    }
    any = true;
  }
  S.sinceEmit += dt;
  if ((S.lam > 0 && S.sinceEmit > 1.2 && freeToEmit(S) && S.rnd() < 1 - exp(-S.lam * dt)) || (!any && S.sinceEmit > 0.5)) emit(S);
}

// A new line waits for a free slot and until the last has swept a seventh of the panel.
function freeToEmit(S) {
  let young = null, free = false;
  for (let i = 0; i < MAXF; i++) {
    const F = S.fields[i];
    if (!F.alive) free = true;
    else if (!young || F.age < young.age) young = F;
  }
  return free && (!young || young.swept > N / 7);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = kn[0];
  const stress = cl(kn[1], 0.5, 3.5), dens = cl(kn[2], -1, 1), src = cl(kn[3], -1, 1);
  S.v0 = 5.5 * Math.pow(2, (stress - 2) * 0.8);
  S.frac = 0.3 + 0.37 * (dens + 1);
  S.rs = 0.9 + 0.12 * (dens + 1);
  S.lam = 0.16 * exp(src);
  if (!S.warm) {
    // The first 36 s are run with the knobs as they stand, lines sent at gaps of about 1 / Source, so that the
    // opening has several in flight and loops stand round the particles they have passed.
    S.warm = true;
    const lam = S.lam, gap = 1 / lam;
    let tn = 1.5 + 0.4 * gap * S.rnd();
    S.lam = 0;
    for (let i = 0, t = 0; t < WARM; i++, t += 0.0585) {
      if (t >= tn && S.sinceEmit > 1.2 && freeToEmit(S)) {
        emit(S);
        tn = t + gap * (0.7 + 0.6 * S.rnd());
      }
      advance(S, 0.0585, i === 0);
    }
    S.lam = lam;
  }
  if (d > 0) advance(S, d, false);
}

// Hue rotation about the grey axis (the matrix of an SVG hueRotate), applied to one colour.
const LUM = [0.213, 0.715, 0.072], TW = [[-0.213, -0.715, 0.928], [0.143, 0.14, -0.283], [-0.787, 0.715, 0.072]];
function rot(c, ca, sa) {
  return [0, 1, 2].map((i) => {
    let v = 0;
    for (let j = 0; j < 3; j++) v += c[j] * (LUM[j] + ca * ((i === j ? 1 : 0) - LUM[j]) + sa * TW[i][j]);
    return cl(v, 0, 255);
  });
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const a = 2 * PI * S.hue, ca = cos(a), sa = sin(a), P = {};
  for (const key in PAL) P[key] = rot(PAL[key], ca, sa);
  const R = S.R, G = S.G, B = S.B, LR = S.LR, LG = S.LG, LB = S.LB, swp = S.swp, mob = S.mob;
  swp.fill(0);
  LR.fill(0);
  LG.fill(0);
  LB.fill(0);
  const s2 = 1 / (2 * 0.85 * 0.85), g2 = 1 / (2 * 1.8 * 1.8);
    for (let fi = 0; fi < MAXF; fi++) {
    const F = S.fields[fi];
    if (!F.alive) continue;
    const phi = F.phi, vel = F.vel;
    const wf = sm(2, 28, F.bandLo) * 0.85 + 0.15 * (F.bandLo < H ? 1 : 0);
    // rows below the band are swept clear through, rows above it not at all
    const ya = max(0, F.bandLo - 1), yb = min(H - 1, F.bandHi + 1);
    for (let y = (F.bandLo >= H ? 0 : yb + 1); y < H; y++) for (let x = 0; x < W; x++) swp[y * W + x] += wf;
    if (F.bandLo >= H) continue;
    for (let y = ya; y <= yb; y++) {
      const ro = y * W, up = (y > 0 ? y - 1 : y) * W, dn = (y < H - 1 ? y + 1 : y) * W;
      for (let x = 0; x < W; x++) {
        const k = ro + x, p = phi[k];
        swp[k] += wf * cl(0.5 - p, 0, 1);
        if (p > 3.8 || p < -3.8) continue;
        const xl = x > 0 ? x - 1 : 0, xr = x < W - 1 ? x + 1 : W - 1;
        const gx = (phi[ro + xr] - phi[ro + xl]) * 0.5, gy = (phi[dn + x] - phi[up + x]) * 0.5;
        const gm = max(sqrt(gx * gx + gy * gy), 0.3), d = p / gm, dd = d * d;
        const vis = sm(0.02, 0.22, mob[k]);
        if (vis <= 0) continue;
        const core = exp(-dd * s2) * vis, halo = exp(-dd * g2) * 0.24 * vis;
        const hot = cl(vel[k] * 0.6 / max(S.v0, 1), 0, 1), hh = hot * hot * (3 - 2 * hot);
        const cr = P.l0[0] + (P.l1[0] - P.l0[0]) * hh, cg = P.l0[1] + (P.l1[1] - P.l0[1]) * hh, cb = P.l0[2] + (P.l1[2] - P.l0[2]) * hh;
        // two lines on one LED: the brighter shows
        const er = cr * core, eg = cg * core, eb = cb * core;
        LR[k] = max(LR[k], er) + P.gl[0] * halo;
        LG[k] = max(LG[k], eg) + P.gl[1] * halo;
        LB[k] = max(LB[k], eb) + P.gl[2] * halo;
      }
    }
  }
  // ground
  const dr = P.g1[0] - P.g0[0], dg = P.g1[1] - P.g0[1], db = P.g1[2] - P.g0[2];
  for (let k = 0; k < N; k++) {
    // each line that has swept a pixel closes 0.4 of what is left of the step to slipped ground
    const q = swp[k] * 16, i = q | 0, t = LUT[i < 95 ? i : 95] + (LUT[i < 95 ? i + 1 : 96] - LUT[i < 95 ? i : 95]) * (q - i);
    R[k] = P.g0[0] + dr * t;
    G[k] = P.g0[1] + dg * t;
    B[k] = P.g0[2] + db * t;
  }
  // particles and loops
  const ps = S.parts;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.act < 0.03) continue;
    const rd = p.rd, L = p.loops;
    let outer = rd;
    for (let j = 0; j < L.length; j++) outer += GROW * L[j].w;
    const ext = outer + 3.2;
    const x0 = max(0, floor(p.x - ext)), x1 = min(W - 1, ceil(p.x + ext));
    const y0 = max(0, floor(p.y - ext)), y1 = min(H - 1, ceil(p.y + ext));
    const dim = 1 - 0.45 * p.shf;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - p.x, dy = y + 0.5 - p.y, d = sqrt(dx * dx + dy * dy), k = y * W + x;
        const cov = cl(rd - d + 0.5, 0, 1);
        if (cov > 0 && rd > 0.4) {
          const t = d / rd, rim = sm(0.35, 1, t), lit = 0.75 + 0.35 * cl((-dx * 0.55 - dy * 0.83) / (d + 0.5), -1, 1) * rim;
          const cr = (P.pc[0] + (P.pr[0] - P.pc[0]) * rim) * lit * dim, cg = (P.pc[1] + (P.pr[1] - P.pc[1]) * rim) * lit * dim, cb = (P.pc[2] + (P.pr[2] - P.pc[2]) * rim) * lit * dim;
          R[k] += (cr - R[k]) * cov;
          G[k] += (cg - G[k]) * cov;
          B[k] += (cb - B[k]) * cov;
        }
        let ring = 0, cum = 0;
        for (let j = 0; j < L.length; j++) {
          const l = L[j], w = l.w, e = d - (rd + GROW * cum + 0.55);
          cum += w;
          const q = exp(-e * e / (2 * 0.55 * 0.55));
          ring += q * (0.3 + 0.7 * w) * min(1, l.age / 0.4);
        }
        if (ring > 0.004) {
          const f = ring * 0.65;
          LR[k] += P.rg[0] * f;
          LG[k] += P.rg[1] * f;
          LB[k] += P.rg[2] * f;
        }
        if (p.flash > 0) {
          const e = d - (rd + 1 + 4.5 * (1 - p.flash)), q = exp(-e * e / 0.9) * p.flash * p.flash;
          LR[k] += P.fl[0] * q;
          LG[k] += P.fl[1] * q;
          LB[k] += P.fl[2] * q;
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      display.setPixel(x, y, cl(R[k] + LR[k], 0, 255), cl(G[k] + LG[k], 0, 255), cl(B[k] + LB[k], 0, 255));
    }
  }
}
