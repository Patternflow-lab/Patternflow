// ===== Patternflow pattern =====
// Title:   Cyclosis
// Family:  cyclosis
// Idea:    The living contents of a giant algal cell stream round it in a fluorescence picture on black: a rounded glass tube as tall as the panel whose red chloroplasts sit in helical files, a pale yellow indifferent zone winding up the near side between them, and mint granules, crystals and thin strands running up on one side of the zone and down on the other past a still seam, with a dimmer sheet below sliding the other way, until now and then a calcium wave runs along the cell and the stream freezes mid-lane behind it and creeps back from rest.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cytoplasmic streaming in the internodal cell of Chara, first seen by Bonaventura Corti (1774, from memory); organelles carried on myosin along the actin cables that lie on the chloroplast files, with the stream reversing at two chloroplast-free indifferent zones and its speed measured against the cell (Nobuo Kamiya and Kazuo Kuroda, 1956, from memory); the action potential and calcium wave that stop the stream for seconds (Williamson and Ashley, 1982, from memory); the cylinder projection, the layers, the shimmer and the slow wander are original, pattern round 257
// Round:   257
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0..4, Pitch=-1..1, Shock=0..1
//
// Knob 1: Hue. Turns the whole fluorescence palette round the wheel together. It opens on red-orange chloroplasts, mint granules, a pale yellow indifferent zone and a teal membrane at the edge, and comes back to that at 1.
// Knob 2: Flow. 0 to 4, opening at 2. How fast the stream runs along the files: an average granule moves 22 LED a second in the open lane at 2 (the fastest 29) and 44 at 4, the deeper sheet a quarter of that the other way. At 0 everything stands still as after a shock, the granules where they were, trembling a little, the red still shimmering.
// Knob 3: Pitch. -1 to 1, opening at 0. The twist of the files and of the indifferent zones round the cell, 0.04 radian a LED at the ends. At 0 they only wander in lazy S curves (two slow waves 190 and 83 LED long that slide), at 1 they wind one way so that a zone crosses the near face about every 80 LED, at -1 the other way; the granules follow the helix and bend with it.
// Knob 4: Shock. 0 to 1, opening at 0.06. How often the cell fires an action potential: never at 0, every 12 to 57 s (31 s on average) at the start, about every 13 s at 1 where the cell has hardly come back before the next one. A calcium wave takes three to six seconds to cross the cell, up or down, and where it has passed the stream stops within a second, holds still for 2.5 to 5 s and then speeds up again from rest over 4.5 to 8 s.

// The cell is a cylinder with its axis up the panel, centre cx, radius R (27 LED, breathing). A point on its surface
// has an angle theta round the axis, seen at x = cx + R sin(theta) and only on the near half (cos theta > 0). The
// surface is labelled by a position rho round the cell (0 to 1) and a height y: theta = theta0 + Th(y) + Ps(rho, y).
// Th(y) is the twist (the helix of the knob plus two slow sine waves that slide, so the files wander and never lie
// ruler straight), Ps puts the two indifferent zones at rho 0 and 0.5 and spaces them Dl(y) apart, 0.8 to 1.2 half
// turns, so the lane that streams up is sometimes narrower than the one that streams down and now and then both
// zones are on the near face. Files are lines of constant rho, so they follow the helix, and so does every particle.
// Chloroplasts: 44 files round the cell, soft ellipses 2 LED across and 3.9 long laid along them in a staggered
// brick, each with its own size, offset, brightness and shimmer, drawn per LED from (rho, y) and faded to a plain
// glow toward the limb where a file is narrower than the LED. The zone is a bare stripe with a pale yellow glow,
// 3 LED wide on the face, kept 2.2 LED wide at the limb and faded as it goes round.
// Stream: surface granules (2 LED soft dots, a little longer along the stream the faster they go), crystals (3 LED,
// slower) and strands (a tail of 22 to 46 LED) ride the files, up on rho < 0.5 and down on rho > 0.5. The speed is
// zero in the zone, rises over about eight LED to full and is a quarter lower in the middle of the lane. A deeper
// sheet at 0.7 of the radius runs the other way at a quarter of the speed, dimmer and covered by the chloroplasts. A
// particle that leaves the end is born again at the other end on a new file. Spawning is weighted by speed so the
// slow seam is not a pile of dots. A particle is drawn only while it faces the viewer by a margin of its own, so the
// limbs are not crowded the way a true projection would crowd them.
// Shock: a calcium wave front travels the cell. The stream eases to a quarter over the 34 LED before it, and each
// particle stops 0.7 s after the front passes it. The whole cell restarts from rest together over 4.5 to 8 s, so the
// stopped stream does not pile up against a restart that crept along behind the front. A stopped row also loses a
// fifth of its glow. The cell cannot fire again until it is well on its way back. The knob sets the rate of a charge
// that fires the wave when it reaches a random threshold, so turning it takes hold at once.
// Slow drifts on clocks that share no period: red level, granule level, zone level, focus (the texture sharpens,
// the deep sheet shows), the axis and radius of the cell, the rotation, the zone spacing, the twist waves, and
// pale sheets of brighter cytoplasm that pass up or down.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, asin, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
const gauss = () => sqrt(-2 * Math.log(1 - rnd())) * cos(TAU * rnd());

const NF = 44;            // chloroplast files round the cell
const LP = 4.4;           // along-file pitch of the chloroplasts, LED
const NS = 380, NK = 30, NE = 9, ND = 200;

function hash(a, b) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 16;
  return h >>> 0;
}

function hsv(h, s, v, o) {
  h -= floor(h);
  const h6 = h * 6, k = floor(h6), f = h6 - k;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  if (k === 0) { o[0] = v; o[1] = t; o[2] = p; }
  else if (k === 1) { o[0] = q; o[1] = v; o[2] = p; }
  else if (k === 2) { o[0] = p; o[1] = v; o[2] = t; }
  else if (k === 3) { o[0] = p; o[1] = q; o[2] = v; }
  else if (k === 4) { o[0] = t; o[1] = p; o[2] = v; }
  else { o[0] = v; o[1] = p; o[2] = q; }
}

// ---- the particles: rho round the cell, y along it, and the traits each keeps for its life
function makeSet(n, kind) {
  return {
    n, kind,
    rho: new Float32Array(n), y: new Float32Array(n), f: new Float32Array(n),
    b: new Float32Array(n), ph: new Float32Array(n), wf: new Float32Array(n),
    len: new Float32Array(n), prof: new Float32Array(n), sp: new Float32Array(n), thr: new Float32Array(n), age: new Float32Array(n).fill(9),
  };
}

function profOf(rho, deep) {
  const l = rho < 0.5 ? rho : rho - 0.5;
  const dr = l < 0.5 - l ? l : 0.5 - l;
  if (deep) return 0.4 + 0.6 * sm(0, 0.1, dr);
  return sm(0.017, 0.07, dr) * (1 - 0.28 * (dr / 0.25) * (dr / 0.25));
}

function spawn(S, i, lane, y) {
  const deep = S.kind === 3;
  let rho = 0, pr = 0;
  for (let tries = 0; tries < 12; tries++) {
    const l = 0.024 + (0.5 - 0.048) * rnd();
    rho = (lane < 0 ? rnd() < 0.5 : lane === 1) ? 0.5 + l : l;
    pr = profOf(rho, deep);
    if (rnd() < max(0.12, pr)) break;
  }
  S.rho[i] = rho;
  S.prof[i] = pr;
  S.y[i] = y;
  const k = S.kind;
  S.f[i] = k === 1 ? rr(0.5, 0.75) : k === 2 ? rr(0.8, 1.0) : rr(0.78, 1.22);
  S.b[i] = k === 3 ? rr(0.55, 1) : rr(0.72, 1);
  S.ph[i] = rnd() * TAU;
  S.wf[i] = rr(0.6, 2.4);
  S.len[i] = rr(22, 46);
  S.thr[i] = 0.7 * rnd();
  S.age[i] = 9;
}

function laneOf(rho) { return rho < 0.5 ? 0 : 1; }

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], ready: false, t: 0,
    ph: [], // random phases of the slow clocks
    sets: [makeSet(NS, 0), makeSet(NK, 1), makeSet(NE, 2), makeSet(ND, 3)],
    ev: [], charge: rnd() * 0.7, thresh: 1, refr: 0,
    Rg: new Float32Array(H).fill(1),
    sheets: [],
    buf: new Float32Array(N * 3),
    // per-frame scalars and arrays
    cx: 32, R: 27, th0: 0, p: 0, A1: 0.5, A2: 0.18, a1: 0, a2: 0, d1: 0, d2: 0,
    Rb: new Float32Array(H), Rd: new Float32Array(H), Rv: new Float32Array(H),
    Rz: new Float32Array(H), Rw: new Float32Array(H),
    Cc: new Float32Array(W), Cth: new Float32Array(W), Cdx: new Float32Array(W), Ccov: new Float32Array(W),
    pal: {},
  });
  for (let i = 0; i < 16; i++) st.ph.push(rnd() * TAU);
  const [sS, sK, sE, sD] = st.sets;
  for (const S of st.sets) for (let i = 0; i < S.n; i++) spawn(S, i, -1, rr(-8, H + 8));
  for (let i = 0; i < 3; i++) st.sheets.push(newSheet(true));
  st.thresh = 0.35 + 0.7 * -Math.log(1 - rnd());
  return st;
}

function newSheet(any) {
  const dir = rnd() < 0.5 ? -1 : 1;
  return { y: any ? rr(-20, H + 20) : dir > 0 ? -30 : H + 30, v: dir * rr(1.5, 4), s: rr(9, 20), a: rr(0.2, 0.38) };
}

// ---- the geometry of the cell at time t: the twist and the zone spacing at height y
function twist(st, y) {
  return st.p * (y - 64) + st.A1 * sin(y * (TAU / 190) + st.a1) + st.A2 * sin(y * (TAU / 83) + st.a2);
}
function spacing(st, y) {
  return PI + 0.4 * sin(y * (TAU / 121) + st.d1) + 0.18 * sin(y * (TAU / 53) + st.d2);
}

// the slow clocks, none a multiple of another
function clocks(st) {
  const t = st.t, P = st.ph;
  st.cx = 32 + 1.8 * sin(TAU * t / 83 + P[0]) + 1.0 * sin(TAU * t / 47.9 + P[1]);
  st.R = 27.2 + 0.9 * sin(TAU * t / 109 + P[2]) + 0.5 * sin(TAU * t / 37.3 + P[3]);
  st.th0 = 0.28 * sin(TAU * t / 167 + P[4]) + 0.1 * sin(TAU * t / 61 + P[5]);
  st.a1 = TAU * t / 197 + P[6];
  st.a2 = -TAU * t / 139 + P[7];
  st.d1 = TAU * t / 151 + P[8];
  st.d2 = -TAU * t / 89 + P[9];
  st.redL = 1.0 + 0.12 * sin(TAU * t / 57.3 + P[10]) + 0.07 * sin(TAU * t / 23.1 + P[11]);
  st.grnL = 0.94 + 0.13 * sin(TAU * t / 41.7 + P[12]) + 0.07 * sin(TAU * t / 17.9 + P[13]);
  st.zonL = 1.0 + 0.2 * sin(TAU * t / 33.1 + P[14]) + 0.1 * sin(TAU * t / 71.3 + P[15]);
  st.focus = 0.5 + 0.5 * sin(TAU * t / 61.7 + P[3] + 1);
}

// the stop and the restart. The stream eases to a quarter over the 34 LED before the front, so that the front is
// not overtaking cargo at full speed (that would thin out the lane it runs with and pile up the lane it runs
// against). A particle stops 0.7 s after the front passes it. The whole cell restarts from rest together, a particle
// that was stopped late waiting a little less, so nothing piles against a restart that crept along behind the front.
function motilAt(t, ts, e, d) {
  if (ts < 0) return 0.22 + 0.78 * sm(0, 34, d);
  if (t < ts + 0.7) return 0.22 * (1 - sm(0, 0.7, t - ts));
  const frac = cl((ts - e.t0) / e.cross, 0, 1.1);
  const u = (t - (e.t0 + e.cross + 0.7 + e.hold + 1.2 * frac)) / e.rec;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const s = sm(0, 1, u);
  return s * sqrt(s);
}

function fire(st) {
  const dir = rnd() < 0.5 ? 1 : -1;
  const cross = rr(3, 6) / max(1, st.V / 26);
  st.ev.push({
    t0: st.t, dir, spd: (H + 24) / cross, cross, hold: rr(2.5, 5), rec: rr(4.5, 8),
    amp: rr(0.8, 1), tilt: rr(-3.5, 3.5), bow: rr(1, 2.5) * (rnd() < 0.5 ? -1 : 1),
  });
}

function tpass(e, y) {
  return e.t0 + (e.dir > 0 ? y + 12 : H + 12 - y) / e.spd;
}
function frontY(e, t) {
  return e.dir > 0 ? -12 + e.spd * (t - e.t0) : H + 12 - e.spd * (t - e.t0);
}

function step(st, dt, ks, quiet) {
  st.t += dt;
  const t = st.t;
  const V = 11 * ks[1];
  st.V = V;
  const k4 = max(0, ks[3]);
  st.p = 0.035 * ks[2] + 0.004;
  clocks(st);
  // the shock: a charge that fills at the knob's rate and fires at a random threshold
  const lam = k4 < 0.003 || quiet ? 0 : (1 / 30) * sqrt(k4 / 0.06);
  st.charge += lam * dt;
  if (!quiet && st.charge >= st.thresh && t > st.refr) {
    fire(st);
    const e = st.ev[st.ev.length - 1];
    st.refr = t + e.cross + 0.7 + e.hold + 1.2 + 0.6 * e.rec;   // the cell cannot fire again until it is well on its way back
    st.charge = 0;
    st.thresh = cl(0.35 + 0.7 * -Math.log(1 - rnd()), 0.4, 1.9);
  }
  const ev = st.ev;
  for (let i = ev.length - 1; i >= 0; i--) {
    const e = ev[i];
    if (t - e.t0 > e.cross + 0.7 + e.hold + e.rec + 2) ev.splice(i, 1);
  }
  // the glow of each row: a stopped row loses a fifth
  for (let y = 0; y < H; y++) {
    let g = 1;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      g *= 1 - 0.2 * (1 - motilAt(t, t >= tpass(e, y) ? tpass(e, y) : -1, e, 99));
    }
    st.Rg[y] = g;
  }
  // pale sheets of cytoplasm passing
  for (let i = 0; i < st.sheets.length; i++) {
    const s = st.sheets[i];
    s.y += s.v * dt;
    if ((s.v > 0 && s.y > H + 32) || (s.v < 0 && s.y < -32)) st.sheets[i] = newSheet(false);
  }
  // the front stamps each particle it passes
  for (let k = 0; k < ev.length; k++) {
    const e = ev[k];
    if (!e.ts) e.ts = st.sets.map((S) => new Float32Array(S.n).fill(-1));
    const yf = frontY(e, t);
    for (let q = 0; q < 4; q++) {
      const ts = e.ts[q], yy = st.sets[q].y;
      for (let i = 0; i < ts.length; i++) if (ts[i] < 0 && e.dir * (yf - yy[i]) >= 0) ts[i] = t;
    }
  }
  // the particles
  for (let q = 0; q < 4; q++) {
    const S = st.sets[q];
    const deep = q === 3;
    const rho = S.rho, yy = S.y, f = S.f, pf = S.prof, ph = S.ph, wf = S.wf;
    for (let i = 0; i < S.n; i++) {
      const lane = rho[i] < 0.5 ? 0 : 1;
      let dir = lane === 0 ? -1 : 1;
      let v;
      if (deep) { dir = -dir; v = 0.26 * V * pf[i] * f[i]; }
      else v = V * pf[i] * f[i];
      v *= 1 + 0.1 * sin(t * wf[i] + ph[i]);
      for (let k = 0; k < ev.length; k++) v *= motilAt(t, ev[k].ts[q][i], ev[k], ev[k].dir * (yy[i] - frontY(ev[k], t)));
      yy[i] += dir * v * dt;
      S.sp[i] = v;
      S.age[i] = min(9, S.age[i] + dt);
      if ((dir < 0 && yy[i] < -10) || (dir > 0 && yy[i] > H + 10)) {
        let y0 = dir < 0 ? H + rr(3, 14) : -rr(3, 14);
        let late = false, still = -1;
        // born behind a wave front it would stand frozen out of sight and the panel would run short of cargo: it
        // fades in ahead of the front, or, when the front has nearly crossed, in the stopped stretch, already stopped
        for (let k = 0; k < ev.length && !late; k++) {
          const e = ev[k], yf = frontY(e, t);
          if (e.dir * (yf - y0) >= 0) {
            const ahead = e.dir > 0 ? H - 6 - max(yf, 0) : min(yf, H) - 6;
            const lo = e.dir > 0 ? 6 : max(yf, 0) + 6, hi = e.dir > 0 ? min(yf, H) - 6 : H - 6;
            if (ahead > 24) { y0 = yf + e.dir * (14 + rnd() * (ahead - 14)); late = true; }
            else if (hi - lo > 24) { y0 = lo + rnd() * (hi - lo); late = true; still = k; }
            else y0 = dir < 0 ? H + rr(3, 75) : -rr(3, 75);
          }
        }
        spawn(S, i, lane, y0);
        if (late) S.age[i] = 0;
        for (let k = 0; k < ev.length; k++) ev[k].ts[q][i] = k === still ? ev[k].t0 + ev[k].cross * rnd() : -1;
      }
    }
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.ready) {
    st.ready = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    st.t = rr(0, 400);
    // the cell has been streaming for a while: a minute of it before the first frame
    for (let n = 0; n < 320; n++) step(st, 0.125, st.ks, false);
    // and the first frame is a flowing one: a shock in progress is let go, the lanes even out for a few
    // seconds, and the next shock waits its turn
    st.ev.length = 0;
    for (let n = 0; n < 120; n++) step(st, 0.125, st.ks, true);
    st.charge = rnd() * 0.5 * st.thresh;
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  if (dt > 0) step(st, dt, st.ks);
}

// a soft dot composited over the picture; occ lets the chloroplasts cover what lies below them
function splat(buf, px, py, sx, sy, a, c0, c1, c2, occ) {
  const rx = ceil(2.8 * sx), ry = ceil(2.8 * sy);
  const xa = max(0, floor(px - rx)), xb = min(W - 1, floor(px + rx));
  const ya = max(0, floor(py - ry)), yb = min(H - 1, floor(py + ry));
  const ix = 1 / (2 * sx * sx), iy = 1 / (2 * sy * sy);
  for (let y = ya; y <= yb; y++) {
    const dy = y + 0.5 - py;
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - px;
      let al = a * exp(-(dx * dx * ix + dy * dy * iy));
      if (al < 0.03) continue;
      al = al > 1 ? 1 : al * al * (3 - 2 * al) * 0.5 + al * 0.5;   // a little crisper than the Gaussian, so the rim is not a grey mix of mint and red
      const j = (y * W + x) * 3;
      if (occ > 0) al *= 1 - occ * min(1, buf[j] * 1.7);
      if (al > 0.96) al = 0.96;
      buf[j] = buf[j] * (1 - al) + c0 * al;
      buf[j + 1] = buf[j + 1] * (1 - al) + c1 * al;
      buf[j + 2] = buf[j + 2] * (1 - al) + c2 * al;
    }
  }
}

// the same dot added to the picture, for a faint halo that does not grey the red
function glow(buf, px, py, sx, sy, a, c0, c1, c2) {
  const rx = ceil(2.6 * sx), ry = ceil(2.6 * sy);
  const xa = max(0, floor(px - rx)), xb = min(W - 1, floor(px + rx));
  const ya = max(0, floor(py - ry)), yb = min(H - 1, floor(py + ry));
  const ix = 1 / (2 * sx * sx), iy = 1 / (2 * sy * sy);
  for (let y = ya; y <= yb; y++) {
    const dy = y + 0.5 - py;
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - px;
      const w = a * exp(-(dx * dx * ix + dy * dy * iy));
      if (w < 0.01) continue;
      const j = (y * W + x) * 3;
      buf[j] += c0 * w; buf[j + 1] += c1 * w; buf[j + 2] += c2 * w;
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const t = st.t, buf = st.buf, k1 = st.ks[0];
  const { cx, R, th0 } = st;
  buf.fill(0);

  // ---- the palette, turned together by the knob
  const h0 = k1, dh = 0.03 * sin(TAU * t / 101 + st.ph[1]);
  const cK = [0, 0, 0], cC = [0, 0, 0], cG = [0, 0, 0], cX = [0, 0, 0], cZ = [0, 0, 0], cM = [0, 0, 0], cW = [0, 0, 0], cD = [0, 0, 0], cH = [0, 0, 0];
  hsv(0.032 + h0, 1.0, 1, cC);
  hsv(0.46 + h0 + dh, 0.6, 1, cG);
  hsv(0.45 + h0 + dh, 0.2, 1, cX);
  hsv(0.155 + h0, 0.3, 1, cZ);
  hsv(0.5 + h0, 0.9, 0.78, cM);
  hsv(0.5 + h0, 0.38, 1, cW);
  hsv(0.45 + h0 + dh, 0.06, 1, cK);
  hsv(0.55 + h0 + dh, 0.8, 0.85, cD);
  hsv(0.98 + h0, 1, 0.11, cH);

  // ---- rows
  const fo = st.focus;
  const mod = 0.55 + 0.45 * fo;                // how sharp the texture is
  for (let y = 0; y < H; y++) {
    st.Rb[y] = th0 + twist(st, y + 0.5);
    st.Rd[y] = spacing(st, y + 0.5);
    let v = 0.92;
    for (let i = 0; i < st.sheets.length; i++) {
      const s = st.sheets[i], d = (y - s.y) / s.s;
      v += s.a * exp(-d * d);
    }
    st.Rv[y] = v * st.Rg[y];
    st.Rz[y] = st.zonL * (0.8 + 0.2 * sin(y * 0.083 + st.d1 * 1.7)) * (0.9 + 0.1 * sin(y * 0.19 - st.a2 * 2.3));
    st.Rw[y] = 0.88 + 0.2 * sin(y * 0.071 + st.a1 * 2.1) + 0.12 * sin(y * 0.13 - st.d2 * 3.1);   // bare width
  }
  // ---- columns
  let x0 = W, x1 = -1;
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - cx, ad = abs(dx);
    const cov = cl(R + 0.5 - ad, 0, 1);
    st.Ccov[x] = cov;
    if (cov <= 0) continue;
    if (x < x0) x0 = x;
    x1 = x;
    const u = cl(dx / R, -0.995, 0.995);
    st.Cdx[x] = dx;
    st.Cc[x] = sqrt(1 - u * u);
    st.Cth[x] = asin(u);
  }
  const redL = st.redL * 0.9;
  const wave = [];
  for (const e of st.ev) {
    const yf = e.dir > 0 ? -12 + e.spd * (t - e.t0) : H + 12 - e.spd * (t - e.t0);
    wave.push(e, yf);
  }
  const nw = st.ev.length;

  for (let y = 0; y < H; y++) {
    const b0 = st.Rb[y], D = st.Rd[y], vac = st.Rv[y] * redL, bwf = st.Rw[y], zb = st.Rz[y];
    const rg = st.Rg[y];
    const yy = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const cov = st.Ccov[x], c = st.Cc[x], dx = st.Cdx[x];
      const u = dx / R, au = abs(u);
      let ps = st.Cth[x] - b0;
      ps -= TAU * floor(ps / TAU);
      let rho, dz;
      if (ps < D) { rho = 0.5 * ps / D; dz = ps < D - ps ? ps : D - ps; }
      else {
        const q = ps - D, L = TAU - D;
        rho = 0.5 + 0.5 * q / L;
        dz = q < L - q ? q : L - q;
      }
      const dzs = dz * R * c;                              // LED from the zone, on the face
      // light on the cylinder
      const S = (0.05 + 0.95 * pow(c, 1.5)) * (1 - 0.18 * u) + 0.1 * exp(-((u + 0.45) * (u + 0.45)) / 0.03);
      // chloroplasts
      const fk = rho * NF, fi = floor(fk);
      let fx = fk - fi - 0.5;
      const s0 = yy / LP + (hash(fi, 7) & 1023) / 1023;
      const si = floor(s0);
      const h = hash(fi, si);
      fx -= ((h & 255) / 255 - 0.5) * 0.12;
      const fy = s0 - si - 0.5 - (((h >>> 8) & 255) / 255 - 0.5) * 0.12;
      const gz = 0.88 + 0.24 * ((h >>> 16) & 255) / 255;
      const q2 = (fx * fx) / (0.068 * gz) + (fy * fy) / (0.2 * gz);
      const blob = exp(-0.693 * q2 * (0.8 + 0.5 * mod));
      const hb = 0.72 + 0.28 * ((h >>> 24) / 255);
      const shim = 0.84 + 0.16 * sin(t * (0.5 + ((h >>> 4) & 15) * 0.14) + (h & 1023) * 0.0061);
      const md = sm(0.25, 0.6, c) * mod;
      const tex = 0.4 + (blob * hb * shim - 0.4) * md;
      const bw = 1.25 + 0.8 * c;
      const bwz = bw * bwf;
      const mask = sm(bwz * 0.7, bwz * 1.5 + 0.4, dzs);
      let I = tex * mask * S * vac;
      // the zone
      const gw = 1.0 + 0.45 * c;
      const zg = (exp(-(dzs * dzs) / (gw * gw)) + 0.22 * exp(-(dzs * dzs) / 14)) * sm(0.04, 0.4, c) * zb * pow(c, 0.5);
      // the rim
      const rim = exp(-((R - abs(dx)) * (R - abs(dx))) / 2.6) * (u < 0 ? 0.36 : 0.26) * (0.8 + 0.2 * sin(y * 0.05 + st.a1));
      // haze
      const hz = 0.9 * S;
      let r = cC[0] * I + cZ[0] * zg + cM[0] * rim + cH[0] * hz;
      let g = cC[1] * I + cZ[1] * zg + cM[1] * rim + cH[1] * hz;
      let b = cC[2] * I + cZ[2] * zg + cM[2] * rim + cH[2] * hz;
      // calcium wave
      for (let e = 0; e < nw; e++) {
        const ev = wave[e * 2], yf = wave[e * 2 + 1];
        const ye = yy + ev.tilt * u + ev.bow * (u * u - 0.5);
        const d = ev.dir * (yf - ye);
        if (d > -9 && d < 34) {
          const dd = d - 0.8;
          const core = d < 0.8 ? exp(-(dd * dd) / 2.4) : exp(-(dd * dd) / 6);
          const w = 0.8 * ev.amp * (core + 0.3 * exp(-abs(d) / 10) + (d < 0 ? 0.12 * exp(-(d * d) / 40) : 0)) * pow(c, 0.6);
          r += cW[0] * w; g += cW[1] * w; b += cW[2] * w;
        }
      }
      const j = (y * W + x) * 3;
      buf[j] = r * cov; buf[j + 1] = g * cov; buf[j + 2] = b * cov;
    }
  }

  // ---- the particles, from the deep sheet up
  const grnL = st.grnL;
  const deepK = 0.3 + 0.5 * fo;
  const kd = 0.7;
  const [sS, sK, sE, sD] = st.sets;
  const place = (S, i, y, k) => {
    const rho = S.rho[i], D = spacing(st, y);
    const ps = rho < 0.5 ? 2 * D * rho : D + 2 * (TAU - D) * (rho - 0.5);
    return th0 + twist(st, y) + ps;
  };
  // deep
  for (let i = 0; i < sD.n; i++) {
    const y = sD.y[i], th = place(sD, i, y);
    const c = cos(th);
    if (c < 0.1) continue;
    const ri = cl(floor(y), 0, H - 1);
    const vw = sm(sD.thr[i], sD.thr[i] + 0.2, c);
    const px = cx + R * kd * sin(th);
    const lv = sD.b[i] * deepK * grnL * (0.86 + 0.14 * sin(t * sD.wf[i] + sD.ph[i])) * st.Rg[ri];
    splat(buf, px + 0.2 * sin(t * sD.wf[i] * 2.1 + sD.ph[i]), y, 1.25 * max(0.6, c), 1.25, 0.8 * vw * sm(0, 0.5, sD.age[i]), cD[0] * lv, cD[1] * lv, cD[2] * lv, 0.75);
  }
  // strands
  for (let i = 0; i < sE.n; i++) {
    const dir = sE.rho[i] < 0.5 ? -1 : 1;
    const n = ceil(sE.len[i] / 1.3);
    for (let k = 0; k < n; k++) {
      const y = sE.y[i] - dir * k * 1.3;
      if (y < -3 || y > H + 3) continue;
      const th = place(sE, i, y);
      const c = cos(th);
      if (c < 0.1) continue;
      const ri = cl(floor(y), 0, H - 1);
      const lv = sE.b[i] * grnL * (0.8 + 0.2 * sin(k * 0.8 + sE.ph[i])) * st.Rg[ri];
      const a = 0.62 * sm(sE.thr[i], sE.thr[i] + 0.2, c) * sm(0.06, 0.2, c) * pow(1 - k / n, 0.9) * sm(0, 0.5, sE.age[i]);
      splat(buf, cx + R * sin(th), y, 0.95 * max(0.6, c), 0.95, a, cG[0] * lv, cG[1] * lv, cG[2] * lv, 0);
    }
  }
  // granules
  for (let i = 0; i < sS.n; i++) {
    const y = sS.y[i], th = place(sS, i, y);
    const c = cos(th);
    if (c < 0.06) continue;
    const ri = cl(floor(y), 0, H - 1);
    const lv = sS.b[i] * grnL * (0.88 + 0.12 * sin(t * sS.wf[i] + sS.ph[i])) * st.Rg[ri];
    const a = sm(sS.thr[i], sS.thr[i] + 0.2, c) * sm(0.05, 0.2, c) * sm(0, 0.5, sS.age[i]);
    const px = cx + R * sin(th) + 0.22 * sin(t * sS.wf[i] * 2.7 + sS.ph[i]), sx = 0.92 * max(0.6, c), sy = 0.92 + 0.011 * sS.sp[i];
    const py = y + 0.22 * cos(t * sS.wf[i] * 2.3 + sS.ph[i]);
    glow(buf, px, py, 1.9 * max(0.6, c), 1.9, 0.11 * a, cG[0] * lv, cG[1] * lv, cG[2] * lv);
    splat(buf, px, py, sx, sy, 1.3 * a, cG[0] * lv, cG[1] * lv, cG[2] * lv, 0);
  }
  // crystals
  for (let i = 0; i < sK.n; i++) {
    const y = sK.y[i], th = place(sK, i, y);
    const c = cos(th);
    if (c < 0.12) continue;
    const ri = cl(floor(y), 0, H - 1);
    const lv = sK.b[i] * grnL * st.Rg[ri];
    const a = sm(sK.thr[i], sK.thr[i] + 0.2, c) * sm(0.06, 0.2, c) * sm(0, 0.5, sK.age[i]);
    const px = cx + R * sin(th);
    splat(buf, px, y, 1.3 * max(0.65, c), 1.3, 1.2 * a, cX[0] * lv, cX[1] * lv, cX[2] * lv, 0);
    splat(buf, px - 0.3, y - 0.3, 0.6, 0.6, 0.8 * a, cK[0] * lv, cK[1] * lv, cK[2] * lv, 0);
  }

  // ---- out: keep the hue when the sum is more than the LED can show
  for (let y = 0; y < H; y++) {
    for (let x = x0; x <= x1; x++) {
      const j = (y * W + x) * 3;
      let r = buf[j], g = buf[j + 1], b = buf[j + 2];
      const m = r > g ? (r > b ? r : b) : g > b ? g : b;
      if (m < 0.004) continue;
      if (m > 0.72) {
        const f = (0.72 + 0.28 * (1 - exp(-(m - 0.72) / 0.28))) / m;
        r *= f; g *= f; b *= f;
      }
      display.setPixel(x, y, (r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
    }
  }
}
