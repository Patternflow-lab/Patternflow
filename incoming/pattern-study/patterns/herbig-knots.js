// ===== Patternflow pattern =====
// Title:   Herbig-Haro Knots
// Family:  herbigharo
// Idea:    A newborn star hidden in a dark disc shoots a precessing jet up and a fainter one down, the speed of what it throws out varies, faster shells catch slower ones and each collision lights a knot that cools into a red tail, and both jets end in bow shocks that flare and dim.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Herbig-Haro objects, knots of gas lit by a young star's jet (George Herbig, 1950, and Guillermo Haro, 1952, from memory); the internal-shock model, where a jet thrown out at a varying speed makes faster gas run into slower gas and shock it (Alejandro Raga, Jorge Cantó and colleagues, 1990, from memory); the Hubble pictures of HH 34, HH 47 and HH 111, a chain of knots on a fine beam, an S-shaped wiggle from a precessing axis and a bow shock at each head (from memory). Original code, pattern round 266.
// Round:   266
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Variability=0.2..3, Precession=-1..1, Speed=-1..1
//
// Knob 1: Hue.
// Knob 2: Variability.
// Knob 3: Precession.
// Knob 4: Speed.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, PI, pow, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

const CX = 32, SY = 66;            // the hidden source
const VNOM = 14;                   // LED a second at speed 1 and ejection speed 1
const DM = 0.7;                    // shells closer than this stick
const NS = 80;                     // most shells kept in one jet

// ---- the emission palette: heat 0 to 1.7 -> deep crimson, red, red-orange, gold, yellow-white, white
const RS = 150;
const RAMP = new Float32Array(3 * 256);
(function () {
  const st = [
    [0.0, 0.74, 0.03, 0.12], [0.25, 1.0, 0.07, 0.10], [0.5, 1.0, 0.32, 0.03],
    [0.72, 1.0, 0.68, 0.10], [0.95, 1.0, 0.93, 0.62], [1.25, 1.0, 1.0, 0.95], [1.7, 1.0, 1.0, 1.0],
  ];
  for (let i = 0; i < 256; i++) {
    const h = i / RS;
    let k = 0;
    while (k < st.length - 2 && h > st[k + 1][0]) k++;
    const t = cl((h - st[k][0]) / (st[k + 1][0] - st[k][0]), 0, 1);
    for (let c = 0; c < 3; c++) RAMP[i * 3 + c] = st[k][c + 1] + (st[k + 1][c + 1] - st[k][c + 1]) * t;
  }
})();

// ---- value noise for the dust
function hash3(i, j, k) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn3(x, y, z) {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return y0 + (y1 - y0) * fz;
}
const GX = 17, GY = 33; // dust nodes, 4 LED apart

// ---- a jet: the source's side of the story
function makeLobe(up) {
  return {
    up, sy: up ? -1 : 1, lat: up ? 1 : -1,
    sh: [], tNext: 0, t: rnd() * 50,
    hp: up ? [3.13, 1.37, 0.71] : [2.71, 1.19, 0.63],
    hph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    hw: up ? [0.3, 0.5, 0.45] : [0.3, 0.45, 0.4],
    ou1: 0, ou2: 0,
    np: up ? [23.7, 41.3, 8.9] : [29.3, 53.1, 11.7],
    nph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    dph: 0, dpa: up ? 0.12 : 0.8, cfa: up ? 0.12 : 0.4, tla: up ? 0.02 : 0.07, cc: 0, tl: 0,
    cp: up ? [47.3, 19.7, 33.1] : [39.1, 23.3, 61.7], cph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    nou: 0, n: 1, nb: 0, cT: 5 + 12 * rnd(), act: 1, ap: [rnd() * TAU, rnd() * TAU], aou: 0,
    vscale: up ? 1 : 0.72, gain: up ? 1 : 0.68, ivl: up ? 0.14 : 0.2, base: up ? 52 : 42,
    head: up ? 52 : 42, hx: 0, hsl: 0, lastv: 1, eb: 0.3, fb: 0.9,
  };
}

function knobsOf(ks) {
  const t2 = cl((ks[1] - 0.2) / 2.8, 0, 1), t3 = cl((ks[2] + 1) / 2, 0, 1), k4 = cl(ks[3], -1, 1);
  const sp = exp(0.5 * k4);
  const cone = 17 * sqrt(t3) * PI / 180;
  return {
    hue: cl(ks[0], 0, 1),
    A: 0.05 + 0.75 * pow(t2, 1.3),
    c: Math.tan(cone) + 0.012,
    Tp: (10 - 6.4 * t3) / sqrt(sp),
    sp, k4,
    bk: 0.8 + 0.3 * (k4 + 1),
    bb: 0.8 + 0.25 * (k4 + 1),
    t2,
  };
}

function eject(S, L, late) {
  const K = S.K;
  const g = L.hw[0] * sin(TAU * L.t / L.hp[0] + L.hph[0]) + L.hw[1] * sin(TAU * L.t / L.hp[1] + L.hph[1]) +
    L.hw[2] * sin(TAU * L.t / L.hp[2] + L.hph[2]) + 0.45 * L.ou1 + 0.3 * L.ou2;
  const v = cl(L.vscale * (1 + K.Ae * g), 0.3, 2.3);
  L.lastv = v;
  const m = 0.45 + 0.4 * rnd();
  const r = sin(S.ph + L.dph);
  const sh = { s: max(0, late * v * K.sp), X: 0, v, m, r, H: 0.2, F: 0 };
  L.sh.unshift(sh);
  if (L.sh.length > NS) L.sh.pop();
}

function merge(L, a, b, i) {
  const m = a.m + b.m, dv = max(0, a.v - b.v);
  const mu = (a.m * b.m) / m;
  const fl = 1.5 * (1 - exp(-(50 * mu * dv * dv) / 1.5));
  const hm = (a.H * a.m + b.H * b.m) / m;
  b.H = min(1.7, 0.45 * hm + fl + 0.2);
  b.F = max(b.F, a.F * 0.5, cl(dv * 2.4, 0, 1));
  b.r = (a.m * a.v * a.r + b.m * b.v * b.r) / (a.m * a.v + b.m * b.v);
  b.v = (a.m * a.v + b.m * b.v) / m;
  b.s = (a.m * a.s + b.m * b.s) / m;
  b.X = (a.m * a.X + b.m * b.X) / m;
  b.m = m;
  L.sh.splice(i, 1);
}

function stepLobe(S, L, dt) {
  const K = S.K;
  L.t += dt;
  // each jet has its own small differences from the common axis: a phase that slides, a cone a little wider or narrower, a lean
  const tt = L.t;
  L.dph += -L.dph * dt / 25 + sqrt(2 * dt / 25) * L.dpa * gauss();
  L.cc = K.cc * (1 + L.cfa * (0.6 * sin(TAU * tt / L.cp[0] + L.cph[0]) + 0.4 * sin(TAU * tt / L.cp[1] + L.cph[1])));
  L.tl = K.tl + L.tla * sin(TAU * tt / L.cp[2] + L.cph[2]);
  const e1 = sqrt(2 * dt / 1.6), e2 = sqrt(2 * dt / 7), e3 = sqrt(2 * dt / 9);
  L.ou1 += -L.ou1 * dt / 1.6 + e1 * gauss();
  L.ou2 += -L.ou2 * dt / 7 + e2 * gauss();
  L.nou += -L.nou * dt / 9 + e3 * gauss();
  // ambient density, slowly varying
  const t = L.t;
  // and a clump of denser cloud now and then, which the head runs into
  L.cT -= dt;
  if (L.cT <= 0) {
    L.nb = 0.8 + 0.6 * rnd();
    L.cT = 7 + 17 * -Math.log(1 - rnd());
    L.eb += 0.9;
  }
  L.nb *= exp(-dt / 4.5);
  L.n = cl(1 + 0.55 * L.nb + 0.36 * sin(TAU * t / L.np[0] + L.nph[0]) + 0.26 * sin(TAU * t / L.np[1] + L.nph[1]) +
    0.1 * sin(TAU * t / L.np[2] + L.nph[2]) + 0.2 * L.nou, 0.4, 2.1);
  L.aou += -L.aou * dt / 15 + sqrt(2 * dt / 15) * gauss();
  L.act = cl(0.85 + 0.25 * sin(TAU * t / 43.7 + L.ap[0]) + 0.16 * sin(TAU * t / 19.1 + L.ap[1]) + 0.15 * L.aou, 0.45, 1.35);
  // ejection
  L.tNext -= dt;
  while (L.tNext <= 0) {
    eject(S, L, -L.tNext);
    L.tNext += L.ivl * pow(K.sp, -0.3) * (0.55 + 0.9 * rnd());
  }
  const sh = L.sh;
  const cool = exp(-dt / 2.4), coolF = exp(-dt / 0.8);
  for (let i = 0; i < sh.length; i++) {
    const b = sh[i], ds = b.v * VNOM * K.sp * dt;
    b.s += ds;
    b.X += b.r * ds;
    const hf = 0.2 + 0.04 * min(b.m, 4);
    b.H = hf + (b.H - hf) * cool;
    b.F *= coolF;
  }
  // sticky collisions
  let i = 0;
  while (i < sh.length - 1) {
    const a = sh[i], b = sh[i + 1];
    if (a.s >= b.s - DM) {
      merge(L, a, b, i);
      i = max(0, i - 1);
    } else i++;
  }
  // the head
  const tgt = min(L.base - 9 * (L.n - 1) + 9 * K.k4, L.base + 8);
  L.head += (tgt - L.head) * (1 - exp(-dt / 2.5));
  while (sh.length && sh[sh.length - 1].s >= L.head) {
    const b = sh.pop();
    const vr = max(0, b.v - 0.55);
    L.eb += 0.07 * b.m * (0.6 + 3 * vr * vr);
    L.fb = max(L.fb, 0.5 * b.F);
  }
  L.eb = min(L.eb, 2.2) * exp(-dt / 1.6);
  L.fb = 0.9 + (L.fb - 0.9) * exp(-dt / 1.2);
  // lateral place and direction of the head follow the last shell
  let tx = 0, ts = 0;
  if (sh.length) {
    const b = sh[sh.length - 1], g = min(18, L.head - b.s);
    ts = L.lat * (L.cc * b.r + L.tl);
    tx = L.lat * (L.cc * b.X + L.tl * b.s) + ts * g;
  }
  const f = 1 - exp(-dt / 0.6);
  tx = cl(tx, -21, 21);
  L.hx += (tx - L.hx) * f;
  L.hsl += (ts - L.hsl) * f;
}

function advance(S, dt) {
  S.t += dt;
  const K = (S.K = knobsOf(S.ks)), t = S.t;
  // the axis itself wanders: how wide it precesses, how fast, and a slight lean of the whole jet
  S.ou += -S.ou * dt / 12 + sqrt(2 * dt / 12) * gauss();
  S.ph += (TAU * dt / K.Tp) * cl(1 + 0.22 * sin(TAU * t / 37.3 + 1.1) + 0.14 * sin(TAU * t / 16.9 + 2.3) + 0.2 * S.ou, 0.35, 1.9);
  K.cc = K.c * cl(1 + 0.38 * sin(TAU * t / 53.1 + 0.4) + 0.25 * sin(TAU * t / 21.7 + 3.1) + 0.12 * S.ou, 0.3, 1.8);
  K.tl = 0.14 * sin(TAU * t / 71.3 + 2.0) + 0.1 * sin(TAU * t / 29.3 + 5.0);
  S.tilt = 0.8 * Math.atan(S.up.cc * sin(S.ph + S.up.dph) + S.up.tl);
  // now and then the source flares for a few seconds: the speed varies more, the jets and the glow brighten
  S.obT -= dt;
  if (S.obT <= 0) {
    S.obU = 1.4;
    S.obT = 16 + 38 * -Math.log(1 - rnd());
  }
  S.obU = max(0, S.obU - dt);
  S.ob += ((S.obU > 0 ? 1 : 0) - S.ob) * (1 - exp(-dt / (S.obU > 0 ? 0.6 : 3.2)));
  K.Ae = K.A * (1 + 0.8 * S.ob) + 0.22 * S.ob;
  K.ob = 1 + 0.3 * S.ob;
  S.pl += (S.up.lastv - S.pl) * (1 - exp(-dt / 1.2));
  stepLobe(S, S.up, dt);
  stepLobe(S, S.dn, dt);
}

export function setup(params) {
  params.s = {
    ready: false, t: rnd() * 200, ph: rnd() * TAU, ou: 0, pl: 1, ob: 0, obT: 20 + 25 * rnd(), obU: 0, ks: [0, 2, 0, 0.06], K: null,
    up: makeLobe(true), dn: makeLobe(false),
    buf: new Float32Array(NPX * 3), dust: new Float32Array(GX * GY),
    tilt: 0,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    S.K = knobsOf(S.ks);
    for (const L of [S.up, S.dn]) L.head = L.base + 9 * S.K.k4;
    for (let k = 0; k < 480; k++) advance(S, 1 / 30);
  }
  const e = 1 - exp(-d / 0.25);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  let left = d;
  while (left > 1e-4) {
    const h = min(left, 1 / 30);
    advance(S, h);
    left -= h;
  }
  // the dust drifts and changes on a minute's scale
  const z = S.t * 0.04;
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const v = 0.62 * vn3(i * 4 / 26 + 3.1, j * 4 / 38 + 1.7, z) + 0.38 * vn3(i * 4 / 13 + 8.2, j * 4 / 19 + 5.4, z * 1.7 + 9);
      S.dust[j * GX + i] = sm(0.28, 0.8, v);
    }
}

// ---- drawing

// a bow-shaped shock: a bright arc, convex toward (dx, dy), that fades to the wings, with a cooling wake behind it
function shock(buf, px, py, dx, dy, a, wmax, sig, lw, hh, ff, gg, wkg, wlat) {
  if (gg <= 0.003) return;
  const px2 = -dy, py2 = dx;
  const ud = wmax * wmax / (4 * a) + 2.6 * lw + 3 * sig, wd = wmax * 1.2 + 3 * sig;
  const c0x = px + dx * 3 * sig, c0y = py + dy * 3 * sig;
  const c1x = px - dx * ud, c1y = py - dy * ud;
  const xa = max(0, floor(min(c0x, c1x) - wd - 1)), xb = min(W - 1, ceil(max(c0x, c1x) + wd + 1));
  const ya = max(0, floor(min(c0y, c1y) - wd - 1)), yb = min(H - 1, ceil(max(c0y, c1y) + wd + 1));
  const slope = wmax / (2 * a), ucm = wmax * wmax / (4 * a);
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5 - px, qy = y + 0.5 - py;
      const u = -(qx * dx + qy * dy), w = qx * px2 + qy * py2, aw = abs(w);
      if (aw > wd) continue;
      const uc = aw <= wmax ? aw * aw / (4 * a) : ucm + (aw - wmax) * slope;
      const sl = aw <= wmax ? aw / (2 * a) : slope;
      const dl = (u - uc) / sqrt(1 + sl * sl);
      if (dl < -3 * sig || dl > 2.6 * lw) continue;
      const fw = 1 - sm(0.55 * wmax, 1.12 * wmax, aw);
      if (fw <= 0.003) continue;
      const fb = exp(-0.5 * (dl / sig) * (dl / sig));
      let al, hl, tw;
      if (dl > 0) {
        const wk = exp(-dl / lw);
        const wq = aw / (wlat * wmax);
        al = fb + wkg * wk * exp(-wq * wq) * (1 - 0.4 * fb);
        hl = hh * (0.2 + 0.8 * exp(-dl / (0.55 * lw)));
        tw = ff * exp(-dl / 1.5);
      } else {
        al = fb;
        hl = hh * (0.2 + 0.8 * fb);
        tw = ff * fb;
      }
      al *= fw * gg;
      if (al < 0.004) continue;
      const hi = cl(round(hl * RS), 0, 255) * 3, o = (y * W + x) * 3;
      let r = RAMP[hi], g = RAMP[hi + 1], b = RAMP[hi + 2];
      if (tw > 0.01) {
        const q = cl(hl - 0.5, 0, 1);
        r += (0.04 + 0.3 * q - r) * tw;
        g += (1.0 - g) * tw;
        b += (0.62 + 0.25 * q - b) * tw;
      }
      buf[o] += r * al;
      buf[o + 1] += g * al;
      buf[o + 2] += b * al;
    }
}

// the faint beam through the knots, one row at a time: a smooth curve through the source, every shell and the head
const CS = new Float64Array(NS + 3), CXs = new Float64Array(NS + 3), CM = new Float64Array(NS + 3), CH = new Float64Array(NS + 3);
function beam(buf, L, K) {
  const sh = L.sh, n = sh.length + 2;
  CS[0] = 0; CXs[0] = 0; CH[0] = 0.2;
  for (let i = 0; i < sh.length; i++) {
    const b = sh[i];
    CS[i + 1] = b.s; CXs[i + 1] = L.lat * (L.cc * b.X + L.tl * b.s); CH[i + 1] = b.H;
  }
  CS[n - 1] = max(L.head, CS[n - 2] + 0.5); CXs[n - 1] = L.hx; CH[n - 1] = 0.2;
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
    CM[i] = (CXs[b] - CXs[a]) / max(CS[b] - CS[a], 0.5);
  }
  let j = 1;
  for (let k = 0; k < L.head; k++) {
    const s = k + 0.5, y = L.sy < 0 ? SY - 1 - k : SY + k;
    if (y < 0 || y >= H) break;
    while (j < n - 1 && CS[j] < s) j++;
    const sa = CS[j - 1], sb = CS[j], dsg = max(sb - sa, 1e-3);
    // a cubic Hermite between two neighbours, the slopes taken from the points round them
    const t = cl((s - sa) / dsg, 0, 1), t2 = t * t, t3 = t2 * t;
    const xc = CX + (2 * t3 - 3 * t2 + 1) * CXs[j - 1] + (t3 - 2 * t2 + t) * dsg * CM[j - 1] +
      (-2 * t3 + 3 * t2) * CXs[j] + (t3 - t2) * dsg * CM[j];
    const hh = CH[j - 1] + (CH[j] - CH[j - 1]) * t;
    const sg = 1.1 + 0.01 * s, vis = sm(3, 12, s) * (1 - sm(L.head - 6, L.head - 1, s)) * L.gain * L.act;
    const lv = (0.55 + 0.3 * min(1, hh)) * vis * K.bb * (0.62 + 0.6 * K.t2) * K.ob;
    const hi = cl(round((0.06 + 0.22 * min(1, hh)) * RS), 0, 255) * 3;
    const sc = 3.4 + 0.05 * s, xs = max(0, floor(xc - 4 * sc)), xe = min(W - 1, ceil(xc + 4 * sc));
    for (let x = xs; x <= xe; x++) {
      const dx = x + 0.5 - xc, q = dx / sg, a = (exp(-0.5 * q * q) + 0.08 * exp(-0.5 * (dx / sc) * (dx / sc))) * lv, o = (y * W + x) * 3;
      buf[o] += RAMP[hi] * a;
      buf[o + 1] += RAMP[hi + 1] * a;
      buf[o + 2] += RAMP[hi + 2] * a;
    }
  }
}

function drawLobe(S, L) {
  const K = S.K, buf = S.buf;
  beam(buf, L, K);
  for (const b of L.sh) {
    const s = b.s;
    if (s < 2) continue;
    const slope = L.lat * (L.cc * b.r + L.tl), nn = sqrt(1 + slope * slope);
    const px = CX + L.lat * (L.cc * b.X + L.tl * s), py = SY + L.sy * s;
    const vis = sm(3, 11, s) * L.gain * L.act * K.ob * max(0.5 * sm(1.3, 3, b.m), sm(0.25, 0.45, b.H));
    const wmax = min(3.5, (1.5 + 0.35 * sqrt(b.m)) * (1 + s / 140) * (0.85 + 0.3 * K.t2));
    const hh = min(1.7, b.H);
    shock(buf, px, py, slope / nn, L.sy / nn, wmax * 0.6, wmax, 1.15, 1.8 + 2 * min(1, hh), hh, b.F, vis * (0.8 + 0.25 * min(1, hh)), 0.4, 0.42);
  }
  // the bow shock at the head
  const nn = sqrt(1 + L.hsl * L.hsl);
  const bs = K.bk * (0.7 + 0.45 * L.n);
  const a = (2.4 + 1.5 * L.n) * K.bk, wmax = 6.5 + 4 * bs;
  const hh = cl(0.42 + 0.35 * L.eb + 0.2 * (L.n - 1), 0.3, 1.1);
  shock(buf, CX + L.hx, SY + L.sy * L.head, L.hsl / nn, L.sy / nn, a, wmax, 1.7, 2.5 + 2 * bs, hh, cl(L.fb + 0.3 * (L.n - 1), 0.7, 1), L.gain * (0.65 + 0.3 * bs + 0.2 * L.act), 0.4, 0.75);
}

// turn the hue of a colour round the wheel by h (0 to 1) and keep its value and saturation, so the key colours stay full
const hc = [0, 0, 0];
function turn(r, g, b, h) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  if (d < 1e-4) { hc[0] = r; hc[1] = g; hc[2] = b; return; }
  let hh = mx === r ? (g - b) / d : mx === g ? 2 + (b - r) / d : 4 + (r - g) / d;
  hh = (((hh / 6 + h) % 1) + 1) % 1 * 6;
  const i = floor(hh), f = hh - i, p = mn, q = mx - d * f, t = mn + d * f;
  switch (i % 6) {
    case 0: hc[0] = mx; hc[1] = t; hc[2] = p; break;
    case 1: hc[0] = q; hc[1] = mx; hc[2] = p; break;
    case 2: hc[0] = p; hc[1] = mx; hc[2] = t; break;
    case 3: hc[0] = p; hc[1] = q; hc[2] = mx; break;
    case 4: hc[0] = t; hc[1] = p; hc[2] = mx; break;
    default: hc[0] = mx; hc[1] = p; hc[2] = q;
  }
}

// the dark lane of the disc seen edge-on and the glow either side of it, in a frame turned by the tilt of the axis
const dk = [0, 0, 0];
function disc(dx, dy, ct, st) {
  const ux = dx * ct + dy * st, uy = dy * ct - dx * st, q = (ux / 20) * (ux / 20) + (uy / 18) * (uy / 18);
  if (q > 7) { dk[0] = dk[1] = dk[2] = 0; return; }
  const ax = abs(ux), ay = abs(uy), rr = (ay - 6) / 4, wl = ay / 2.8, wx = ax / 21, rx = ax / 17;
  dk[0] = exp(-q) * (1 + 0.25 * exp(-rr * rr - rx * rx));
  dk[1] = exp(-wl * wl * wl * wl - wx * wx * wx);
  dk[2] = ux * ux + uy * uy < 90 ? exp(-((ux / 3.4) * (ux / 3.4) + (uy / 1.7) * (uy / 1.7))) : 0;
}

const soft = (x) => (x < 0.8 ? x : 0.8 + 0.2 * (1 - exp(-(x - 0.8) / 0.2)));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf, K = S.K;
  buf.fill(0);
  drawLobe(S, S.dn);
  drawLobe(S, S.up);
  // the cloud: deep blue-black with a brown-violet dust, a bluish reflection glow either side of the dark lane;
  // the jet's light covers it rather than adding to it, so red over the blue glow stays red
  const breath = 0.92 + 0.08 * sin(TAU * S.t / 31.7) + 0.05 * sin(TAU * S.t / 13.1) + 0.05 * sin(TAU * S.t / 57.9 + 1.3);
  // the reflection glow follows the source: brighter when the ejection speed runs high, and more so the more it varies
  const ct = cos(S.tilt), sn = sin(S.tilt), dk0 = 0.7 + 0.15 * (K.k4 + 1);
  const cvk = 0.2 * sm(0.02, 0.2, K.c);
  const gk = (0.26 + 0.42 * K.t2) * breath * (1 + 0.2 * S.ob) * cl(1 + 0.6 * (S.pl - 1), 0.7, 1.4);
  for (let y = 0; y < H; y++) {
    const gy = y / 4, j = floor(gy), fy = gy - j, wy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < W; x++) {
      const gx = x / 4, i = floor(gx), fx = gx - i, wx = fx * fx * (3 - 2 * fx);
      const o = j * GX + i, d0 = S.dust[o], d1 = S.dust[o + 1];
      const dd = (d0 + (d1 - d0) * wx) * (1 - wy) + (S.dust[o + GX] + (S.dust[o + GX + 1] - S.dust[o + GX]) * wx) * wy;
      const p = y * W + x, q = p * 3;
      disc(x + 0.5 - CX, y + 0.5 - SY, ct, sn);
      // the cavity the jet has swept: two faint walls opening from the source as wide as the cone
      const cs = abs(y + 0.5 - SY), ce = abs(x + 0.5 - CX - K.tl * (y + 0.5 - SY)), hw = 2 + K.cc * 0.9 * cs, cq = (ce - hw) / 3.6;
      const cav = exp(-cq * cq) * exp(-cs / 40) * sm(4, 12, cs) * (1 - 0.8 * dk[1]) * cvk;
      const lane = dk[1], gl = dk[0] * (1 - 0.93 * lane) * gk + cav;
      const du = (0.045 + 0.38 * dd) * dk0 * (1 - 0.7 * lane), st = dk[2] * 0.5;
      const lr = buf[q], lg = buf[q + 1], lb = buf[q + 2];
      const keep = 1 - min(1, 1.3 * max(lr, lg, lb));
      const r = soft((0.012 + 0.44 * du + gl * 0.34 + st * 0.9) * keep + lr);
      const g = soft((0.02 + 0.23 * du + gl * 0.5 + st * 0.5) * keep + lg);
      const b = soft((0.07 + 0.34 * du + gl * 0.75 + st * 0.28) * keep + lb);
      turn(r, g, b, K.hue);
      display.setPixel(x, y, cl(hc[0] * 255, 0, 255) | 0, cl(hc[1] * 255, 0, 255) | 0, cl(hc[2] * 255, 0, 255) | 0);
    }
  }
}
