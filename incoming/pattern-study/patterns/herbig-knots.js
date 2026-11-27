// ===== Patternflow pattern =====
// Title:   Herbig-Haro Knots
// Family:  herbigharo
// Idea:    A newborn star hidden in a dark disc shoots a corkscrewing jet up the panel and a shorter, fainter one down, the speed of what it throws out varies, faster shells run into slower ones and each collision lights a knot that cools from white to red, and each jet ends in a bullet-shaped bow shock that flares and dims.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Herbig-Haro objects, knots of gas lit by the jet of a young star (George Herbig, 1950, and Guillermo Haro, 1952, from memory); the internal-shock model, where a jet thrown out at a varying speed lets faster gas catch slower gas and shock it (Alejandro Raga, Jorge Canto and colleagues, 1990, from memory); the Hubble pictures of HH 34, HH 47 and HH 111, knots on a fine beam, a bow shock at each head, a wiggle in the precessing ones (from memory); the dark edge-on disc with a reflection nebula either side, as in HH 30 (from memory). Original code, round 266.
// Round:   266
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Variability=0.2..3, Precession=-1..1, Speed=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel, one full turn over the knob's travel, keeping value and saturation, so white stays white and key colours stay full. At 0 the knots run from deep crimson to gold with a white-hot core, the bow shocks have a teal skin, the glow is blue and the dust brown-violet.
// Knob 2: Variability. 0.2 to 3, opening at 2. How much the speed of what the source throws out varies, as its standard deviation: 4 percent at 0.2, 35 at 2 and 60 at 3. At 0.2 shells rarely catch one another and the jet is a faint steady beam with a few dim knots. At 2 about 5 shells stick a second in the upper jet; at 3 the collisions are hard, a merged shell weighs more than twice as much and flashes white with a teal edge, and the knots are fewer and heavier. It also scales the knots' size, the beam's brightness and the blue glow.
// Knob 3: Precession. -1 to 1, opening at 0. The half angle of the cone the axis sweeps: nearly 0 at -1 (a straight jet that may lean), 2 degrees at -0.5, 5 at 0, 10 at 0.5 and 15 at 1. A shell flies straight along the angle it was thrown at, so the chain is a helix seen side on, growing with distance: 50 LED out it stands about 5 LED off the axis at 0 and 14 at 1. The period of the turn is 2.0 s at -1, 1.6 at 0 and 1.3 at 1, a wavelength of 24 LED at the opening: two turns in the upper jet, two and a half in the lower. The two jets turn 1.17 times apart in rate, so their phases drift past each other. The dark lane tilts with the axis and the fan opens wider with the cone.
// Knob 4: Speed. -1 to 1, opening at 0.06. Jet speed and the density of the cloud together. Shells fly at 8.5 LED a second at -1, 14.4 at the opening and 23 at 1; the head of the upper jet stands 44, 53 and 60 LED from the source and that of the counter-jet 24, 33 and 39. The bow is a smaller, dimmer bullet at -1 and a bigger, brighter one at 1, the beam 0.8 to 1.3 times as bright and the dust 0.7 to 1.0 times.

// What the picture is. A dark cloud with a star on row 68, a dark lane 6 LED thick across it (the disc), a blue reflection fan above and below that opens toward the sides, and filaments of brown-violet dust. The upper jet is a beam 3 LED across with a bright core and a chain of 6 to 9 crescents and short bars, white-hot when fresh and deep red when old, with now and then a small knot thrown wide where the cone is widest. The lower jet is shorter, slower and fainter, with 4 to 6 knots and its own phase, cone and lean. Each ends in a bullet-shaped bow shock about 12 LED across: teal skin, yellow-white apex, red wings swept back, one longer. It flares when a heavy knot arrives or the head meets a clump of denser cloud, and swells and dims with the ambient density, which also moves the head by up to 10 LED.
// The model. Each jet is a list of up to 80 shells on a line. The source throws one out every 0.14 s up and 0.2 s down at a speed 1 + A g(t), where g is three sines of 3.13, 1.37 and 0.71 s and two random walks, and A is set by Variability. A shell flies ballistically at 14 LED a second times its speed. When a faster shell comes within 0.5 LED of the one ahead they stick: masses add, and the speed and sideways speed are the mass-weighted means, so momentum is conserved. The merger flashes to 0.2 + 0.45 of the two heats' mean + 1.5 (1 - exp(-50 mu dv^2 / 1.5)), mu the reduced mass, dv the speed jump: the energy a perfectly inelastic collision loses, saturated at white. Heat falls back to 0.2 to 0.36 in 2.4 s and is read through a palette from crimson to white; a fast fraction that jumps with dv gives the teal skin. A shell carries the sine of the precession phase at its ejection and moves sideways at the cone width times that per LED of distance, so the helix comes from where the shells are; the beam is a smooth curve through them. Cone, lean, rate of turn, density and brightness wander on periods of 9 to 71 s that do not divide one another; on average every 54 s the source flares and every 24 s a clump meets a head.
// What is not exact. The time is sped up by tens of billions. The colours stand for the emission lines (red sulphur and hydrogen, teal oxygen), tuned by eye. The bow is a parabola with swept wings, sized by hand. The tilting lane, the fan, the wide knots and the flares are for the picture.
// Opening. The first update runs 16 s of the model at the opening knobs.

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

const CX = 32, SY = 68;            // the hidden source
const VNOM = 14;                   // LED a second at speed 1 and ejection speed 1
const DM = 0.5;                    // shells closer than this stick
const NS = 80;                     // most shells kept in one jet

// heat 0 to 1.7 through crimson, red, red-orange, gold, yellow-white, white
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

// value noise for the dust
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
const GX = 33, GY = 65; // dust nodes, 2 LED apart

function makeLobe(up) {
  return {
    up, sy: up ? -1 : 1, sh: [], oa: [], tNext: 0, t: rnd() * 50,
    hp: up ? [3.13, 1.37, 0.71] : [2.71, 1.19, 0.63],
    hph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    hw: up ? [0.3, 0.5, 0.45] : [0.3, 0.45, 0.4],
    ou1: 0, ou2: 0,
    np: up ? [23.7, 41.3, 8.9] : [29.3, 53.1, 11.7],
    nph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    ph: rnd() * TAU, pm: up ? 1 : 1.17, pw: up ? [0.22, 0.14] : [0.25, 0.12], pp: up ? [37.3, 16.9] : [31.1, 13.7],
    pq: [rnd() * TAU, rnd() * TAU], cs: up ? 1 : 0.8, cfa: up ? 0.15 : 0.3, tla: up ? 0.03 : 0.07, cc: 0, tl: 0, sk: 0,
    cp: up ? [47.3, 19.7, 33.1] : [39.1, 23.3, 61.7], cph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    nou: 0, n: 1, nb: 0, cT: 5 + 12 * rnd(), act: 1, ap: [rnd() * TAU, rnd() * TAU], aou: 0,
    vscale: up ? 1 : 0.66, gain: up ? 1 : 0.72, ivl: up ? 0.14 : 0.2, base: up ? 54 : 34,
    head: up ? 54 : 34, hx: 0, hsl: 0, lastv: 1, eb: 0.3,
  };
}

function knobsOf(ks) {
  const t2 = cl((ks[1] - 0.2) / 2.8, 0, 1), t3 = cl((ks[2] + 1) / 2, 0, 1), k4 = cl(ks[3], -1, 1);
  const sp = exp(0.5 * k4);
  const cone = 15 * pow(t3, 1.5) * PI / 180;
  return {
    hue: cl(ks[0], 0, 1),
    A: 0.05 + 0.75 * pow(t2, 1.3),
    c: Math.tan(cone) + 0.012,
    Tp: (2.0 - 0.7 * t3) / sqrt(sp),
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
  const m = (0.45 + 0.4 * rnd()) * (L.up ? 1 : 0.85);
  const r = sin(L.ph);
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
  // each jet has its own precession phase, cone, lean and bow skew
  const tt = L.t, up = L.up;
  L.ph += (TAU * dt / K.Tp) * L.pm * cl(1 + L.pw[0] * sin(TAU * tt / L.pp[0] + L.pq[0]) + L.pw[1] * sin(TAU * tt / L.pp[1] + L.pq[1]) + (up ? 0.2 : -0.2) * S.ou, 0.35, 1.9);
  L.cc = K.cc * L.cs * (1 + L.cfa * (0.6 * sin(TAU * tt / L.cp[0] + L.cph[0]) + 0.4 * sin(TAU * tt / L.cp[1] + L.cph[1])));
  L.tl = (up ? K.tl : K.tl2 - 0.6 * K.tl) + L.tla * sin(TAU * tt / L.cp[2] + L.cph[2]);
  L.sk = 0.28 * sin(TAU * tt / 17.3 + L.cph[0]) + 0.2 * sin(TAU * tt / 41.9 + L.cph[1]);
  const e1 = sqrt(2 * dt / 1.6), e2 = sqrt(2 * dt / 7), e3 = sqrt(2 * dt / 9);
  L.ou1 += -L.ou1 * dt / 1.6 + e1 * gauss();
  L.ou2 += -L.ou2 * dt / 7 + e2 * gauss();
  L.nou += -L.nou * dt / 9 + e3 * gauss();
  // ambient density, slowly varying, and now and then a denser clump the head runs into
  const t = tt;
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
  // collisions
  let i = 0;
  while (i < sh.length - 1) {
    const a = sh[i], b = sh[i + 1];
    if (a.s >= b.s - DM) {
      merge(L, a, b, i);
      i = max(0, i - 1);
    } else i++;
  }
  // knots thrown wide at the widest cone
  if (abs(sin(L.ph)) > 0.7 && rnd() < dt * (up ? 0.9 : 0.5)) L.oa.push({ s: 0, X: 0, r: 2.1 * sin(L.ph), v: 0.7 + 0.5 * rnd(), H: 0.9 });
  for (let k = L.oa.length - 1; k >= 0; k--) {
    const o = L.oa[k], ds = o.v * VNOM * K.sp * dt;
    o.s += ds;
    o.X += o.r * ds;
    o.H = 0.2 + (o.H - 0.2) * cool;
    if (o.s > L.head * 1.1 || o.H < 0.27) L.oa.splice(k, 1);
  }
  // the head
  const tgt = cl(L.base - 9 * (L.n - 1) + 9 * K.k4, 20, L.base + 6);
  L.head += (tgt - L.head) * (1 - exp(-dt / 2.5));
  while (sh.length && sh[sh.length - 1].s >= L.head) {
    const b = sh.pop();
    const vr = max(0, b.v - 0.55);
    L.eb += 0.07 * b.m * (0.6 + 3 * vr * vr);
  }
  L.eb = min(L.eb, 2.2) * exp(-dt / 1.6);
  // the head's place and direction follow the last shell
  let tx = 0, ts = 0;
  if (sh.length) {
    const b = sh[sh.length - 1], g = min(18, L.head - b.s);
    ts = L.cc * b.r + L.tl;
    tx = L.cc * b.X + L.tl * b.s + ts * g;
  }
  const f = 1 - exp(-dt / 0.6);
  tx = cl(tx, -19, 19);
  L.hx += (tx - L.hx) * f;
  L.hsl += (ts - L.hsl) * f;
}

function advance(S, dt) {
  S.t += dt;
  const K = (S.K = knobsOf(S.ks)), t = S.t;
  // the axis wanders in cone width and speed of turn, and leans
  S.ou += -S.ou * dt / 12 + sqrt(2 * dt / 12) * gauss();
  K.cc = K.c * cl(1 + 0.24 * sin(TAU * t / 53.1 + 0.4) + 0.16 * sin(TAU * t / 21.7 + 3.1) + 0.08 * S.ou, 0.6, 1.5);
  K.tl = 0.03 + 0.07 * sin(TAU * t / 71.3 + 2.0) + 0.05 * sin(TAU * t / 29.3 + 5.0);
  K.tl2 = 0.07 * sin(TAU * t / 61.3 + 4.1) + 0.05 * sin(TAU * t / 25.7 + 1.2);
  S.tilt = 0.8 * Math.atan(S.up.cc * sin(S.up.ph) + S.up.tl);
  // now and then the source flares: the speed varies more and the jets and the glow brighten
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
    ready: false, t: rnd() * 200, fr: 0, ou: 0, pl: 1, ob: 0, obT: 20 + 25 * rnd(), obU: 0, ks: [0, 2, 0, 0.06], K: null,
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
    for (const L of [S.up, S.dn]) L.head = min(L.base + 9 * S.K.k4, L.base + 6);
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
  // the dust: filaments from a ridged noise, mist from a smooth one, drifting over half a minute
  if (S.fr++ % 3 === 0) {
    const z = S.t * 0.04;
    for (let j = 0; j < GY; j++)
      for (let i = 0; i < GX; i++) {
        const v1 = vn3(i * 2 / 24 + 3.1, j * 2 / 34 + 1.7, z), v2 = vn3(i * 2 / 13 + 8.2, j * 2 / 19 + 5.4, z * 1.7 + 9);
        S.dust[j * GX + i] = 0.7 * sm(0.45, 0.95, 1 - abs(2 * v1 - 1)) + 0.3 * sm(0.3, 0.8, v2);
      }
  }
}

// ---- drawing

// a bow shock: an arc convex toward (dx, dy), wings swept back, a wake; sk lengthens one wing, wing reddens them
function shock(buf, px, py, dx, dy, a, wmax, sig, lw, hh, ff, gg, wkg, wlat, sk, wing) {
  if (gg <= 0.003) return;
  const px2 = -dy, py2 = dx, slope = wmax / (2 * a), ucm = wmax * wmax / (4 * a), wd = wmax * 1.4 * (1 + abs(sk)) + 3 * sig;
  const ud = ucm + 0.7 * wmax * slope * (1 + abs(sk)) + 2.6 * lw + 3 * sig;
  const c0x = px + dx * 3 * sig, c0y = py + dy * 3 * sig, c1x = px - dx * ud, c1y = py - dy * ud;
  const xa = max(0, floor(min(c0x, c1x) - wd - 1)), xb = min(W - 1, ceil(max(c0x, c1x) + wd + 1));
  const ya = max(0, floor(min(c0y, c1y) - wd - 1)), yb = min(H - 1, ceil(max(c0y, c1y) + wd + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5 - px, qy = y + 0.5 - py;
      const u = -(qx * dx + qy * dy), w = qx * px2 + qy * py2, aw = abs(w) / (w >= 0 ? 1 + sk : 1 - sk);
      if (aw > wmax * 1.4) continue;
      const uc = aw <= wmax ? aw * aw / (4 * a) : ucm + (aw - wmax) * slope;
      const sl = aw <= wmax ? aw / (2 * a) : slope;
      const dl = (u - uc) / sqrt(1 + sl * sl);
      if (dl < -3 * sig || dl > 2.6 * lw) continue;
      const fw = 1 - sm(0.6 * wmax, 1.4 * wmax, aw);
      if (fw <= 0.003) continue;
      const fb = exp(-0.5 * (dl / sig) * (dl / sig)), wn = sm(0, wmax, aw);
      let al, hl;
      if (dl > 0) {
        const wq = aw / (wlat * wmax);
        al = fb + wkg * exp(-dl / lw) * exp(-wq * wq) * (1 - 0.4 * fb);
        hl = hh * (0.2 + 0.8 * exp(-dl / (0.55 * lw)));
      } else {
        al = fb;
        hl = hh * (0.2 + 0.8 * fb);
      }
      al *= fw * gg;
      if (al < 0.004) continue;
      hl *= 1 - wing * wn;
      const tw = ff * (1 - sm(-1.2 * sig, 0.3 * sig, dl)) * (1 - 0.75 * wn);
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

// the beam: a smooth curve through the source, the shells and the head
const CS = new Float64Array(NS + 3), CXs = new Float64Array(NS + 3), CM = new Float64Array(NS + 3), CH = new Float64Array(NS + 3);
function beam(buf, L, K) {
  const sh = L.sh, n = sh.length + 2, STEP = 0.3;
  CS[0] = 0; CXs[0] = 0; CH[0] = 0.2;
  for (let i = 0; i < sh.length; i++) {
    const b = sh[i];
    CS[i + 1] = b.s; CXs[i + 1] = L.cc * b.X + L.tl * b.s; CH[i + 1] = b.H;
  }
  CS[n - 1] = max(L.head, CS[n - 2] + 0.5); CXs[n - 1] = L.hx; CH[n - 1] = 0.2;
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
    CM[i] = (CXs[b] - CXs[a]) / max(CS[b] - CS[a], 0.5);
  }
  let j = 1, xp = -999;
  for (let s = 0.15; s < L.head; s += STEP) {
    while (j < n - 1 && CS[j] < s) j++;
    const sa = CS[j - 1], dsg = max(CS[j] - sa, 1e-3);
    const t = cl((s - sa) / dsg, 0, 1), t2 = t * t, t3 = t2 * t;
    const xc = (2 * t3 - 3 * t2 + 1) * CXs[j - 1] + (t3 - 2 * t2 + t) * dsg * CM[j - 1] + (-2 * t3 + 3 * t2) * CXs[j] + (t3 - t2) * dsg * CM[j];
    const arc = xp === -999 ? STEP : sqrt(STEP * STEP + (xc - xp) * (xc - xp));
    xp = xc;
    const hh = CH[j - 1] + (CH[j] - CH[j - 1]) * t;
    const sg = 1.25 + 0.008 * s, vis = sm(3, 12, s) * (1 - sm(L.head - 6, L.head - 1, s)) * L.gain * L.act;
    const lv = (0.42 + 0.3 * min(1, hh)) * vis * K.bb * (0.62 + 0.6 * K.t2) * K.ob * arc / (sg * 2.5066);
    if (lv < 0.002) continue;
    const hi = cl(round((0.06 + 0.22 * min(1, hh)) * RS), 0, 255) * 3, hj = cl(round((0.24 + 0.3 * min(1, hh)) * RS), 0, 255) * 3;
    const cx = CX + xc, cy = SY + L.sy * s;
    const xs = max(0, floor(cx - 3.2 * sg)), xe = min(W - 1, ceil(cx + 3.2 * sg)), ys = max(0, floor(cy - 3.2 * sg)), ye = min(H - 1, ceil(cy + 3.2 * sg));
    for (let y = ys; y <= ye; y++)
      for (let x = xs; x <= xe; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
        const a = exp(-0.5 * d2 / (sg * sg)), c = d2 < 4 ? 0.9 * exp(-0.5 * d2 / 0.36) : 0, o = (y * W + x) * 3;
        buf[o] += (RAMP[hi] * a + RAMP[hj] * c) * lv;
        buf[o + 1] += (RAMP[hi + 1] * a + RAMP[hj + 1] * c) * lv;
        buf[o + 2] += (RAMP[hi + 2] * a + RAMP[hj + 2] * c) * lv;
      }
  }
}

// a knot: a crescent while hot, flatter as it cools
function knot(buf, L, K, s, X, r, m, H, F, vis) {
  const slope = L.cc * r + L.tl, nn = sqrt(1 + slope * slope);
  const wmax = min(2.7, (1.1 + 0.4 * sqrt(m)) * (1 + s / 140) * (0.85 + 0.3 * K.t2) * (L.up ? 1 : 0.85)), hh = min(1.7, H), q = min(1, hh);
  shock(buf, CX + L.cc * X + L.tl * s, SY + L.sy * s, slope / nn, L.sy / nn, wmax * (0.8 - 0.45 * q), wmax, 1.1, 1.5 + 1.6 * q, hh, F, vis * (0.8 + 0.25 * q), 0.35, 0.35, 0, 0.3);
}

function drawLobe(S, L) {
  const K = S.K, buf = S.buf, g = L.gain * L.act * K.ob;
  beam(buf, L, K);
  for (const b of L.sh) {
    if (b.s < 2) continue;
    knot(buf, L, K, b.s, b.X, b.r, b.m, b.H, b.F, sm(3, 11, b.s) * g * max(0.15 + 0.5 * sm(0.35, 1.1, b.m), sm(0.22, 0.42, b.H)));
  }
  for (const o of L.oa) if (o.s > 6) knot(buf, L, K, o.s, o.X, o.r, 0.3, o.H, 0, sm(6, 14, o.s) * g * sm(0.27, 0.5, o.H));
  // the bow at the head: a narrow bullet, yellow-white apex, teal skin, red wings
  const nn = sqrt(1 + L.hsl * L.hsl), bs = K.bk * (0.7 + 0.45 * L.n) * (L.up ? 1 : 0.8);
  const wmax = 2.6 + 1.8 * bs, a = 0.26 * wmax * (0.8 + 0.2 * L.n);
  const hh = cl(0.55 + 0.35 * L.eb + 0.2 * (L.n - 1), 0.4, 1.15);
  const ang = 0.22 * L.sk, ca = cos(ang), sa = sin(ang), bx = 0.5 * L.hsl / nn, by = L.sy / nn;
  shock(buf, CX + L.hx, SY + L.sy * L.head, bx * ca - by * sa, bx * sa + by * ca, a, wmax, 1.4, 2 + 1.5 * bs, hh, cl(0.9 + 0.3 * (L.n - 1), 0.7, 1), L.gain * (0.65 + 0.3 * bs + 0.2 * L.act), 0.3, 0.5, L.sk, 0.8);
}

// turn a colour round the wheel by h (0 to 1), keeping its value and saturation
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

// the dark lane and the glow either side of it, in a frame turned by the tilt of the axis
const dk = [0, 0, 0];
function disc(dx, dy, ct, st) {
  const ux = dx * ct + dy * st, uy = dy * ct - dx * st, q = (ux / 24) * (ux / 24) + (uy / 19) * (uy / 19);
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
  // the cloud; the jets' light covers it instead of adding to it, so red over the blue glow stays red
  const breath = 0.92 + 0.08 * sin(TAU * S.t / 31.7) + 0.05 * sin(TAU * S.t / 13.1) + 0.05 * sin(TAU * S.t / 57.9 + 1.3);
  // the glow follows the source: brighter when the ejection speed runs high
  const ct = cos(S.tilt), sn = sin(S.tilt), dk0 = 0.7 + 0.15 * (K.k4 + 1);
  const cvk = 0.13 + 0.12 * sm(0.02, 0.2, K.c);
  const gk = (0.3 + 0.4 * K.t2) * breath * (1 + 0.2 * S.ob) * cl(1 + 0.6 * (S.pl - 1), 0.7, 1.4);
  for (let y = 0; y < H; y++) {
    const gy = y / 2, j = floor(gy), fy = gy - j, wy = fy * fy * (3 - 2 * fy), Lb = y < SY ? S.up : S.dn;
    for (let x = 0; x < W; x++) {
      const gx = x / 2, i = floor(gx), fx = gx - i, wx = fx * fx * (3 - 2 * fx);
      const o = j * GX + i, d0 = S.dust[o], d1 = S.dust[o + 1];
      const dd = (d0 + (d1 - d0) * wx) * (1 - wy) + (S.dust[o + GX] + (S.dust[o + GX + 1] - S.dust[o + GX]) * wx) * wy;
      const p = y * W + x, q = p * 3;
      disc(x + 0.5 - CX, y + 0.5 - SY, ct, sn);
      // the cavity fan
      const cs = abs(y + 0.5 - SY), ce = abs(x + 0.5 - CX - Lb.tl * cs), hw = 2 + (0.35 + 1.4 * Lb.cc) * cs, cq = (ce - hw) / 9;
      const cav = (exp(-cq * cq) + 0.3 * (1 - sm(hw - 4, hw + 2, ce))) * exp(-cs / 60) * sm(4, 12, cs) * (1 - 0.8 * dk[1]) * cvk;
      const lane = dk[1], gl = dk[0] * (1 - 0.93 * lane) * gk + cav;
      const du = (0.05 + 0.5 * dd) * dk0 * (1 - 0.7 * lane), st = dk[2] * 0.5;
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
