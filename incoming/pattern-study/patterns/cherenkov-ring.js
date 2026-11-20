// ===== Patternflow pattern =====
// Title:   Cherenkov Ring
// Family:  detector
// Idea:    The wall of a water neutrino detector unrolled flat, a disc of light sensors above and below a wrapped band of them, where every second or two a particle outruns light in the water and a ring of tubes flashes in colours from violet to orange by the order the light reaches them, then settles into a cold ghost as the next ring lands somewhere else.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Cherenkov radiation (Pavel Cherenkov, 1934) as a water Cherenkov detector such as Super-Kamiokande displays it, each tube coloured by when its light arrived
// Round:   202
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..4, Energy=-1..1, Index=-1..1
//
// Knob 1: Hue. Turns the arrival-time colours round the wheel; where the knob opens the earliest tubes are violet-blue and the latest orange, and the glow of the idle tubes turns with them.
// Knob 2: Rate. How often a particle crosses the tank: about every 1.8 seconds where the knob opens, four a second at the top, and at the bottom none, so the last ring stays up as a dim steady glow.
// Knob 3: Energy. How much light each particle gives: a few ragged tubes at the bottom, a bright ring where the knob opens, and at the top a thick white-hot ring that blooms into the tubes around it.
// Knob 4: Index. The refractive index of the water: no ring below 1.0002, a narrow 14 degree cone at 1.03, the 41 degree ring of water at 1.33 where the knob opens, and a wide 52 degree ring at 1.64.

const W = 64;
const H = 128;

// The tank, in radii: a radius of 1 and a height of 4, so the barrel is a cylinder twice as tall as it is wide.
const TANK_H = 4;
const BETA = 0.9998;

// The unrolled tank, in LEDs. The barrel is a band 64 wide, the angle all the way round, and 60 tall; the caps are discs.
const BARREL_Y = 34;
const BARREL_ROWS = 20;
const BARREL_COLS = 21;
const PITCH = 3;
const CAP_X = 32;
const TOP_Y = 17;
const BOT_Y = 110;
const CAP_REACH = 15.6;
const CAP_RADIUS = 16;

// How the light of one event fades: it holds, then dies away with this time constant.
const HOLD = 0.5;
const TAU = 1.2;
// How much of an older ring still shows, newest first.
const RANK = [1, 0.7, 0.35, 0.15, 0.07];
// Photoelectrons that light a tube to 63 per cent.
const Q0 = 6;
// Photoelectrons a tube in the middle of a sharp ring collects, at Energy 0.
const YIELD = 90;
const SIG_SHARP = 8.6 * (Math.PI / 180);
const SIG_FUZZY = 7.2 * (Math.PI / 180);

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return 2 * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) - 1;
}

function gauss() {
  return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(6.2831853 * Math.random());
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// The colour of the arrival time: 0 is the earliest tube of the event and 1 the latest. Hue, from violet-blue through cyan, green and yellow to orange.
const RAMP = [
  [0, 0.76],
  [0.2, 0.62],
  [0.4, 0.5],
  [0.58, 0.34],
  [0.78, 0.16],
  [0.92, 0.075],
  [1, 0.03],
];

function rampHue(u) {
  for (let i = 1; i < RAMP.length; i++) {
    if (u <= RAMP[i][0]) {
      const a = RAMP[i - 1];
      const b = RAMP[i];
      return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]);
    }
  }
  return RAMP[RAMP.length - 1][1];
}

// The tubes. Each has a place on the panel, a place on the wall of the tank, and the way the wall faces.
function buildTubes(params) {
  const px = [];
  const py = [];
  const X = [];
  const Y = [];
  const Z = [];
  const NX = [];
  const NY = [];
  const NZ = [];
  const add = (x, y, wx, wy, wz, nx, ny, nz) => {
    px.push(x);
    py.push(y);
    X.push(wx);
    Y.push(wy);
    Z.push(wz);
    NX.push(nx);
    NY.push(ny);
    NZ.push(nz);
  };
  // The barrel: the column round the tank is the angle, and the top row is the top of the tank.
  for (let j = 0; j < BARREL_ROWS; j++) {
    const y = BARREL_Y + 1 + PITCH * j;
    const z = TANK_H / 2 - ((1.5 + PITCH * j) / (PITCH * BARREL_ROWS)) * TANK_H;
    for (let i = 0; i < BARREL_COLS; i++) {
      const x = 2 + PITCH * i + (j & 1 ? PITCH / 2 : 0);
      const phi = (6.2831853 * x) / W;
      add(x, y, Math.cos(phi), Math.sin(phi), z, Math.cos(phi), Math.sin(phi), 0);
    }
  }
  // The caps: a disc each, its tubes in rows three apart, the middle of the disc over the middle of the tank.
  for (let c = 0; c < 2; c++) {
    const cy = c === 0 ? TOP_Y : BOT_Y;
    const sgn = c === 0 ? 1 : -1;
    for (let m = -5; m <= 5; m++) {
      const dy = PITCH * m;
      for (let i = -6; i <= 6; i++) {
        const dx = PITCH * i + ((m + 5) & 1 ? PITCH / 2 : 0);
        const rho = Math.hypot(dx, dy);
        if (rho > CAP_REACH) continue;
        // The edge of the disc facing the barrel is the side the tank turns away from, at half a turn.
        const delta = Math.atan2(dx, c === 0 ? dy : -dy);
        const phi = Math.PI + delta;
        const r = rho / CAP_RADIUS;
        add(CAP_X + dx, cy + dy, r * Math.cos(phi), r * Math.sin(phi), (sgn * TANK_H) / 2, 0, 0, sgn);
      }
    }
  }
  const n = px.length;
  params.n = n;
  params.px = Float32Array.from(px);
  params.py = Float32Array.from(py);
  params.X = Float32Array.from(X);
  params.Y = Float32Array.from(Y);
  params.Z = Float32Array.from(Z);
  params.NX = Float32Array.from(NX);
  params.NY = Float32Array.from(NY);
  params.NZ = Float32Array.from(NZ);
  params.val = new Float32Array(n);
  params.hue = new Float32Array(n);
  params.gh = new Float32Array(n);
  params.fl = new Float32Array(n);
  params.mem = new Float32Array(n);
  params.mh = new Float32Array(n);
  params.bb = new Float32Array(n);
  params.tt = new Float32Array(n);
  params.ph = new Float32Array(n);
  params.om = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    params.ph[i] = 6.2831853 * hash(i, 3);
    params.om[i] = 0.35 + 0.8 * hash(i, 4);
  }
}

// How far along d from v the tank wall is.
function wallDistance(vx, vy, vz, dx, dy, dz) {
  let s = 1e9;
  const a = dx * dx + dy * dy;
  if (a > 1e-9) {
    const b = vx * dx + vy * dy;
    const c = vx * vx + vy * vy - 1;
    const disc = b * b - a * c;
    if (disc > 0) s = (-b + Math.sqrt(disc)) / a;
  }
  if (dz > 1e-9) s = Math.min(s, (TANK_H / 2 - vz) / dz);
  else if (dz < -1e-9) s = Math.min(s, (-TANK_H / 2 - vz) / dz);
  return s;
}

function pickDir(v, minL, ref, cosLo, cosHi) {
  let out = null;
  for (let t = 0; t < 40; t++) {
    // A track close to the axis makes a band that wraps the whole barrel, so most tracks run across the tank.
    const z = (Math.random() < 0.12 ? 0.75 : 0.38) * (2 * Math.random() - 1);
    const a = 6.2831853 * Math.random();
    const s = Math.sqrt(1 - z * z);
    const d = [s * Math.cos(a), s * Math.sin(a), z];
    out = d;
    const wl = wallDistance(v[0], v[1], v[2], d[0], d[1], d[2]);
    if (wl < minL || wl > 2.4) continue;
    if (ref) {
      const c = d[0] * ref[0] + d[1] * ref[1] + d[2] * ref[2];
      if (c < cosLo || c > cosHi) continue;
    }
    return d;
  }
  return out;
}

// A shower: several narrow cones, each a little off the track, so the ring comes out wide and ragged.
function shower(d, w, cones) {
  const m = 5;
  for (let k = 0; k < m; k++) {
    let tx = gauss();
    let ty = gauss();
    let tz = gauss();
    const dot = tx * d[0] + ty * d[1] + tz * d[2];
    tx -= dot * d[0];
    ty -= dot * d[1];
    tz -= dot * d[2];
    const tl = Math.hypot(tx, ty, tz) + 1e-9;
    const jit = Math.tan(Math.abs(gauss()) * 0.12 + 0.02);
    let ex = d[0] + (tx / tl) * jit;
    let ey = d[1] + (ty / tl) * jit;
    let ez = d[2] + (tz / tl) * jit;
    const el = Math.hypot(ex, ey, ez);
    ex /= el;
    ey /= el;
    ez /= el;
    cones.push({ d: [ex, ey, ez], w: (1.15 * w) / m, sig: SIG_FUZZY });
  }
}

function makeEvent(params, age) {
  const n = params.n;
  const rho = 0.72 * Math.sqrt(Math.random());
  const a = 6.2831853 * Math.random();
  const v = [rho * Math.cos(a), rho * Math.sin(a), (Math.random() - 0.5) * TANK_H * 0.8];
  const cones = [];
  const d1 = pickDir(v, 0.7, null, 0, 0);
  const fuzzy = Math.random() < 0.38;
  if (fuzzy) shower(d1, 1, cones);
  else cones.push({ d: d1, w: 1, sig: SIG_SHARP });
  let rag = fuzzy ? 0.5 : 0.28;
  // Sometimes a second particle leaves the same vertex at another angle, and its ring is fainter.
  if (Math.random() < 0.3) {
    const d2 = pickDir(v, 0.6, d1, -0.7, 0.85);
    const w2 = 0.42 + 0.3 * Math.random();
    if (Math.random() < 0.5) shower(d2, w2, cones);
    else cones.push({ d: d2, w: w2, sig: SIG_SHARP });
    rag = Math.max(rag, 0.4);
  }
  const ev = {
    age,
    cones,
    dist: new Float32Array(n),
    amp: new Float32Array(n),
    sf: new Float32Array(n),
    ux: new Float32Array(n),
    uy: new Float32Array(n),
    uz: new Float32Array(n),
    ur: new Float32Array(n),
    zr: new Float32Array(n),
    dark: [],
    energy: 0.3 * Math.pow(8, Math.random()),
    cspan: 0.75 + 0.75 * Math.random(),
  };
  for (let i = 0; i < n; i++) {
    const dx = params.X[i] - v[0];
    const dy = params.Y[i] - v[1];
    const dz = params.Z[i] - v[2];
    const dd = Math.hypot(dx, dy, dz);
    ev.dist[i] = dd;
    ev.ux[i] = dx / dd;
    ev.uy[i] = dy / dd;
    ev.uz[i] = dz / dd;
    // The light spreads with the distance, and a tube the light arrives at slantwise sees less of it.
    const inc = Math.max(0.2, (dx * params.NX[i] + dy * params.NY[i] + dz * params.NZ[i]) / dd);
    ev.sf[i] = clamp(1 / dd, 0.32, 1.4);
    ev.amp[i] = (YIELD / (0.25 + Math.pow(dd, 1.6))) * inc * Math.exp(rag * gauss() - 0.5 * rag * rag);
    ev.ur[i] = Math.random();
    ev.zr[i] = gauss();
  }
  // Dark noise: a few tubes that fire on their own, at one photoelectron.
  const nd = 4 + ((Math.random() * 7) | 0);
  for (let k = 0; k < nd; k++) ev.dark.push({ i: (Math.random() * n) | 0, u: 0.5 * Math.random() });
  return ev;
}

// The photoelectrons a tube collects when it expects mu of them, for the uniform number u that stands for its luck.
function poisson(mu, u, z) {
  if (mu < 12) {
    let p = Math.exp(-mu);
    let c = p;
    let k = 0;
    while (u > c && k < 40) {
      k++;
      p *= mu / k;
      c += p;
    }
    return k;
  }
  return Math.max(0, Math.round(mu + Math.sqrt(mu) * z));
}

function newNeed() {
  return clamp(-Math.log(Math.random() + 1e-9), 0.2, 1.4) * 1.295;
}

export function setup(params) {
  buildTubes(params);
  params.t = 0;
  params.events = [];
  params.phase = 0;
  params.need = 1;
  params.fb = new Float32Array(W * H * 3);
  params.ready = false;
  params.sparks = [];
  params.sparkPhase = 0;
  params.rate = 0.55;
  params.hue0 = 0;
  params.bloom = 0;
  params.holdW = 0;
}

function knobs(input) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const k2 = clamp(k[1], 0, 4);
  const rate = k2 < 0.05 ? 0 : 0.55 * Math.pow(k2 / 2, k2 < 2 ? 1.7 : 2.86);
  return {
    hue: k[0],
    rate,
    energy: Math.pow(2, k[2] < 0 ? 4.2 * clamp(k[2], -1, 0) : 2.4 * clamp(k[2], 0, 1)),
    ke: (clamp(k[2], -1, 1) + 1) / 2,
    index: 0.98 + 0.33 * (clamp(k[3], -1, 1) + 1),
  };
}

export function update(dt, input, params) {
  const K = knobs(input);
  params.t += dt;
  params.rate = K.rate;
  params.hue0 = K.hue;
  params.bloom = smooth(0.9, 4.5, K.energy);
  params.holdW = 1 - smooth(0.02, 0.15, K.rate);
  const events = params.events;

  if (!params.ready) {
    params.ready = true;
    // Open on a tank that has been running: the last few events, each at its own age.
    if (K.rate <= 0) {
      events.push(makeEvent(params, 3));
    } else {
      let age = 0.25 + 1.1 * Math.random();
      while (age < 7 && events.length < 6) {
        events.push(makeEvent(params, age));
        age += (newNeed() * 1.0) / K.rate;
      }
      // The next ring lands a couple of seconds after the panel wakes, whatever the rate.
      params.need = K.rate * (1.6 + Math.random());
    }
  }

  for (const ev of events) ev.age += dt;

  // A new event arrives when enough of the rate has gone by.
  if (K.rate > 0) {
    params.phase += dt * K.rate;
    if (params.phase >= params.need) {
      params.phase = 0;
      params.need = newNeed();
      events.unshift(makeEvent(params, 0));
    }
  }
  for (let i = events.length - 1; i > 0; i--) if (events[i].age > 9 || i > 5) events.pop();

  // Dark noise between events: a tube here and there fires on its own.
  params.sparkPhase += dt * 2.2;
  while (params.sparkPhase >= 1) {
    params.sparkPhase -= 1;
    params.sparks.push({ i: (Math.random() * params.n) | 0, age: 0, u: 0.5 * Math.random() });
  }
  for (const s of params.sparks) s.age += dt;
  params.sparks = params.sparks.filter((s) => s.age < 1.2);

  light(params, K, dt);
}

// What every tube collects, and when, from the events still glowing.
function light(params, K, dt) {
  const n = params.n;
  const val = params.val;
  const hue = params.hue;
  const gh = params.gh;
  const fl = params.fl;
  const bb = params.bb;
  const tt = params.tt;
  val.fill(0);
  hue.fill(0);
  gh.fill(0);
  fl.fill(0);
  const events = params.events;
  const nIdx = K.index;
  const cosT = 1 / (nIdx * BETA);
  const theta = cosT < 1 ? Math.acos(cosT) : -1;
  // Fast flurries fade quicker, so the old rings never pile up into one.
  const crowd = 1 / (1 + 0.45 * Math.max(0, K.rate - 0.7));
  const tau = TAU * (0.85 + 0.3 * K.ke) * crowd;
  const hold = HOLD * crowd;

  for (let e = 0; e < events.length; e++) {
    const ev = events[e];
    const rise = smooth(0, 0.07, ev.age);
    // As a ring ages its colours settle toward a cold blue, so the fresh ring is the one in colour.
    const old = 0.45 * smooth(hold, hold + 3, ev.age);
    const x = Math.max(0, ev.age - hold);
    let f = 0.55 * Math.exp(-x / tau) + 0.45 * Math.exp(-x / (4.5 * tau));
    if (e === 0) f = Math.max(f, 0.22 * params.holdW);
    f *= Math.pow(RANK[Math.min(e, RANK.length - 1)], 1 + 0.5 * Math.max(0, K.rate - 0.7));
    if (f < 0.01) continue;
    let tmin = 1e9;
    let tmax = -1e9;
    bb.fill(0);
    if (theta >= 0) {
      const cones = ev.cones;
      const nc = cones.length;
      for (let c = 0; c < nc; c++) {
        const cone = cones[c];
        cone.lo = Math.cos(Math.min(3.14, theta + 4.4 * cone.sig));
        cone.hi = Math.cos(Math.max(0, theta - 4.4 * cone.sig));
      }
      for (let i = 0; i < n; i++) {
        let mu = 0;
        const ux = ev.ux[i];
        const uy = ev.uy[i];
        const uz = ev.uz[i];
        const sf = ev.sf[i];
        for (let c = 0; c < nc; c++) {
          const cone = cones[c];
          const cs = ux * cone.d[0] + uy * cone.d[1] + uz * cone.d[2];
          if (cs > cone.hi || cs < cone.lo) continue;
          const a = Math.acos(cs > 1 ? 1 : cs) - theta;
          // A flat-topped ring, so a brighter particle makes a brighter ring and not a wider one.
          const q = Math.abs(a) / (cone.sig * sf);
          mu += cone.w * Math.exp(-q * q * q);
        }
        if (mu < 0.003) continue;
        mu *= K.energy * ev.energy * ev.amp[i];
        const pe = poisson(mu, ev.ur[i], ev.zr[i]);
        if (pe <= 0) continue;
        bb[i] = 1 - Math.exp(-pe / Q0);
        const t = ev.dist[i] * nIdx;
        tt[i] = t;
        if (pe >= 2) {
          if (t < tmin) tmin = t;
          if (t > tmax) tmax = t;
        }
      }
    }
    const span = Math.max(tmax - tmin, 0.9) * ev.cspan;
    for (let i = 0; i < n; i++) {
      const b = bb[i];
      if (b <= 0) continue;
      const u = tmax > tmin ? clamp((tt[i] - tmin) / span, 0, 1) : 0.5;
      // The tubes light in the order the light reaches them, a sweep of colour over the ring in the first half second.
      const since = ev.age - 0.4 * u;
      if (since <= 0) continue;
      const v = b * f * smooth(0, 0.08, since);
      if (v > val[i]) {
        val[i] = v;
        hue[i] = u;
        gh[i] = old;
        fl[i] = Math.exp(-since / 0.13);
      }
    }
    for (const d of ev.dark) {
      const v = 0.3 * f * rise;
      if (v > val[d.i]) {
        val[d.i] = v;
        hue[d.i] = d.u;
        gh[d.i] = old;
      }
    }
  }
  for (const s of params.sparks) {
    const v = 0.3 * Math.exp(-s.age / 0.35);
    if (v > val[s.i]) {
      val[s.i] = v;
      hue[s.i] = s.u;
    }
  }
  // A tube that fired keeps a faint cold trace for some seconds, so the tank remembers where its last rings fell.
  const mem = params.mem;
  const mh = params.mh;
  const md = Math.exp(-dt / 5);
  for (let i = 0; i < n; i++) {
    let m = mem[i] * md;
    if (val[i] > m) {
      m = val[i];
      mh[i] = hue[i];
    }
    mem[i] = m;
    const g = 0.1 * m;
    if (g > val[i]) {
      val[i] = g;
      hue[i] = mh[i];
      gh[i] = 0.7;
      fl[i] = 0;
    }
  }
}

// A soft disc: full out to rc, then falling away over the next 0.75 LED.
function stamp(fb, cx, cy, r, g, b, rc, reach) {
  const x0 = Math.floor(cx - reach);
  const x1 = Math.floor(cx + reach);
  const y0 = Math.max(0, Math.floor(cy - reach));
  const y1 = Math.min(H - 1, Math.floor(cy + reach));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= rc + 0.75) continue;
      const t = d <= rc ? 1 : 1 - smooth(rc, rc + 0.75, d);
      const p = (y * W + ((x + W) & (W - 1))) * 3;
      fb[p] += r * t;
      fb[p + 1] += g * t;
      fb[p + 2] += b * t;
    }
  }
}

function halo(fb, cx, cy, r, g, b, sig) {
  const reach = Math.ceil(2.6 * sig);
  const x0 = Math.floor(cx - reach);
  const x1 = Math.floor(cx + reach);
  const y0 = Math.max(0, Math.floor(cy - reach));
  const y1 = Math.min(H - 1, Math.floor(cy + reach));
  const k = 1 / (2 * sig * sig);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const w = Math.exp(-(dx * dx + dy * dy) * k);
      const p = (y * W + ((x + W) & (W - 1))) * 3;
      fb[p] += r * w;
      fb[p + 1] += g * w;
      fb[p + 2] += b * w;
    }
  }
}

export function draw(display, params) {
  const fb = params.fb;
  fb.fill(0);
  const n = params.n;
  const t = params.t;
  const rgb = [0, 0, 0];
  const idle = [0, 0, 0];
  const ghost = [0, 0, 0];
  const bloom = params.bloom;
  for (let i = 0; i < n; i++) {
    const x = params.px[i];
    const y = params.py[i];
    // The tubes that have not fired: a faint cold glow that breathes, a little differently in each, and swells and ebbs in broad patches that drift across the tank.
    const cloud = 0.65 * noise2(x / 17 + 3.1 + 0.045 * t, y / 21 + 1.7 + 0.03 * t) + 0.35 * noise2(x / 9 - 0.06 * t, y / 11 + 6.3 + 0.05 * t);
    const breath = 0.5 + 0.5 * Math.sin(params.ph[i] + params.om[i] * t);
    const im = 0.6 + 0.4 * cloud + 0.14 * breath;
    const tint = 0.6 + 0.045 * noise2(x / 26 + 9.2 - 0.02 * t, y / 30 + 4.4 + 0.02 * t);
    hsv(tint + params.hue0, 0.5, 1, idle);
    let r = idle[0] * 40 * im;
    let g = idle[1] * 40 * im;
    let b = idle[2] * 40 * im;
    const v = params.val[i];
    let rc = 0.8;
    if (v > 0.012) {
      const flash = params.fl[i];
      const V = Math.min(1, Math.pow(v, 0.5) * (1 + 0.25 * flash));
      const s = (1 - 0.45 * V * V * V) * (1 - 0.5 * flash);
      hsv(rampHue(params.hue[i]) + params.hue0, s, V, rgb);
      const w = params.gh[i];
      if (w > 0) {
        hsv(0.62 + params.hue0, 0.6, V * 0.9, ghost);
        rgb[0] += (ghost[0] - rgb[0]) * w;
        rgb[1] += (ghost[1] - rgb[1]) * w;
        rgb[2] += (ghost[2] - rgb[2]) * w;
      }
      const keep = 1 - Math.min(1, 2 * V);
      r = r * keep + rgb[0] * 255;
      g = g * keep + rgb[1] * 255;
      b = b * keep + rgb[2] * 255;
      rc = 0.8 + 0.2 * V;
      if (bloom > 0.02) halo(fb, x, y, rgb[0] * 255 * 0.24 * bloom * V, rgb[1] * 255 * 0.24 * bloom * V, rgb[2] * 255 * 0.24 * bloom * V, 1.6);
    }
    stamp(fb, x, y, r, g, b, rc, 2);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      const r = fb[p];
      const g = fb[p + 1];
      const b = fb[p + 2];
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
