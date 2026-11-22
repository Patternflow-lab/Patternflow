// ===== Patternflow pattern =====
// Title:   Air Shower
// Family:  airshower
// Idea:    Seen from above, a hexagonal grid of 104 round surface-detector tanks stands dark on the ground, and every few seconds a cosmic-ray air shower lands somewhere in it: the tanks flash one after another as the shower front sweeps across, blue-white where it arrived first and amber where it arrived last, the footprint stretched into an egg that points along the shower, then left behind as a dim map that fades over twenty seconds under the next ones.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The surface array of the Pierre Auger Observatory, water-Cherenkov tanks on a triangular grid; Pierre Auger and colleagues found extensive air showers in 1938 by seeing detectors far apart fire together; the signal falls off with distance from the core as the Nishimura-Kamata-Greisen lateral distribution (Kamata and Greisen, 1958); tanks are coloured by the time the front reached them, the way an array's event display is, and the front is a plane with a slight curve.
// Round:   220
// ===============================
// @matrix 64x128
// @knobs Hue=-0.1..0.5, Rate=0.5..3, Energy=-1..1, Zenith=-1..1
//
// Knob 1: Hue. Turns the arrival-time palette round the colour wheel by the knob. At the opening 0 the first tanks to fire are blue-white (115, 166, 255), then pale cyan and warm white (255, 247, 230), and the last are amber (255, 199, 97) to orange (242, 97, 15); the afterglow and the stray muons take the colours of the same palette. At 0.5 the order is reversed, amber first and blue last, and at 1 it is back at blue to amber. The resting grid stays a blue-grey.
// Knob 2: Rate. How often a shower lands. The mean wait is 6 s at 0.5, 3.2 s at the opening 2 and 2 s at 4, and the waits are never the same twice, so two showers often overlap on the grid. At 0.5 the dim map holds three or four old footprints at a time and at 4 about ten, piled over each other.
// Knob 3: Energy. The size and strength of the showers, on a log scale. At -1 a shower is 1 to 12 tanks big and mostly one tank flashes white, at the opening 0 it is 4 to 40 tanks with a saturated white core, and at 1 it is 15 to 90 tanks and now and then a fan from beyond the edge covers the panel. A tank's flash lasts 0.5 s when it is faint and about 1 s when it saturates.
// Knob 4: Zenith. The angle of the shower from the vertical, 0 degrees at -1, 32 at the opening 0.06 and 60 at 1, with each shower 70 to 130 percent of that. At -1 the footprint is round and the tanks flash in rings out from the core within about 0.6 s. At 1 the footprint is an egg 1.9 times as long as wide with its blunt end at the front, the sweep runs 0.9 s edge to edge of the panel in a direction that is different for every shower, and the colour runs straight from blue to amber along it.

// The panel is the ground seen from above. Tanks sit on a triangular lattice, 8 columns of 13 with a pitch of
// 9.3 LEDs between neighbours and the odd columns shifted half a pitch down, so 104 tanks fill the panel, each a
// disc of 5.4 LEDs with a soft edge. At rest a tank is a dim blue-grey ring (43, 56, 76) round a darker fill, on
// ground that is a very dark warm brown with a slow mottle, so the lattice reads without anything being lit.
// A shower is an event: a core on the ground (it may be up to 22 LEDs off the panel when the shower is large), an
// azimuth, a zenith angle, and an energy that is log-uniform. The signal in tank i is the NKG form
// S = E (r/r0)^-b (1 + r/r0)^-(b + n) with b = 0.8, n = 2.5 and r0 = 8 LEDs, where r is the distance from the axis
// of the shower, so it is the ground distance with the part along the shower shrunk by cos(zenith); that makes
// the footprint an ellipse 1/cos(zenith) times as long along the shower. On the downstream side the shower has
// gone through more air, so r is stretched by exp(0.45 sin(zenith) x / 20) there and shrunk upstream, which turns
// the ellipse into an egg with a fan on the upstream end. Every tank also gets its own log-normal wobble of 0.32,
// so the edge of a footprint is ragged. The brightness is logarithmic in the signal, 0.16 at the threshold, 0.44 at
// ten times it and 1 at a thousand times, and the brightest ones are white.
// The front arrives at tank i at (x sin(zenith)) / 70 + 0.3 (r / 40)^2 seconds, x being the distance along the
// shower from the core, so the plane sweeps at 70 LEDs a second for a shower at 90 degrees and the bowl adds the
// slight curve: at zenith 0 it is a ring that opens from the core and slows as it goes. Each time carries 0.018 s of
// jitter. A tank rises in 55 ms and falls on a tail of 0.5 s plus 0.45 s times its brightness. Whiteness is
// brightness: above 0.6 a tank's colour goes toward white, and as the tail falls it returns to its colour. The
// colour is the order of arrival: the earliest lit tank is 0 and the last of the bright ones is 1, with at least
// 0.55 s between them, so a small shower is mostly blue-white and a large one runs the whole palette.
// The state is the list of showers that are still flashing (at most 10) and, for each tank, how much afterglow it
// carries and what mean arrival colour. When a tank fires it adds 0.07 + 0.26 times its brightness to the afterglow,
// capped at 0.5, mixing in its arrival colour by weight, and the afterglow falls with a time constant of 9 s, so a
// footprint is still there at 20 s. Showers keep adding, so the old footprints pile up and the panel is never
// empty between them. Muons are single tanks at 0.14 to 0.3 that flash for 0.3 s every 2.2 s on average.
// Waits are the sum of two exponentials. The first update runs 55 s of this at the opening knobs and then lands a
// large shower 0.5 s before the first frame, so the first picture has a sweep, an afterglow map and a flash.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, cos, exp, sqrt, abs, log, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const F = (n) => new Float32Array(n);
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;

// ---- the array
const NC = 8, NR = 13, NT = NC * NR;
const PITCH = 9.3, DX = PITCH * 0.8660254;
const TRAD = 2.7; // tank radius, LEDs
const X0 = (W - (NC - 1) * DX) / 2, Y0 = 5.9;
// the lateral distribution of the shower, NKG form
const R0 = 8, BETA = 0.8, ETA = 2.5;
const KAPPA = 0.45, RS = 20; // the fan: more air on the downstream side
const VSWEEP = 40; // LEDs a second at which the plane sweeps for a shower at 90 degrees
const RC = 40, TC = 0.5; // the curve of the front: TC seconds at RC LEDs from the axis
const RISE = 0.055; // s
const AG_TAU = 15; // s
const WTAU = 20, WAMP = 0.75, FAMP = 0.75; // each tank's resting glow wanders by up to 60 percent on 20 s
const MAXE = 10, MAXM = 6;
const LG_LO0 = 0.8, LG_LO1 = 1.4, LG_HI0 = 2.0, LG_HI1 = 1.8; // log10 of the energy range at Energy -1 and the gain across the knob
const PRE = 55; // s run before the first frame

// the arrival-time palette: time 0..1, then red, green, blue
const PS = [
  [0, 0.4, 0.62, 1],
  [0.22, 0.62, 0.84, 1],
  [0.42, 1, 0.97, 0.9],
  [0.64, 1, 0.78, 0.36],
  [0.84, 1, 0.5, 0.1],
  [1, 0.92, 0.33, 0.05],
];
const GS = [
  [0, 0.3, 0.55, 1],
  [0.35, 0.4, 0.82, 0.95],
  [0.55, 1, 0.8, 0.42],
  [0.8, 1, 0.48, 0.24],
  [1, 0.95, 0.28, 0.32],
];
const NL = 32;

function rgb2hsv(r, g, b, o) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  o[0] = h;
  o[1] = mx > 0 ? d / mx : 0;
  o[2] = mx;
}

function hsv2rgb(h, s, v, o) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  o[0] = f(5);
  o[1] = f(3);
  o[2] = f(1);
}

function buildLut(S, shift) {
  const lut = S.lut, tmp = S.tmp;
  for (let j = 0; j <= NL; j++) {
    const t = j / NL;
    let i = 0;
    while (i < PS.length - 2 && t > PS[i + 1][0]) i++;
    const a = PS[i], b = PS[i + 1], f = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
    let r = mix(a[1], b[1], f), g = mix(a[2], b[2], f), bl = mix(a[3], b[3], f);
    if (shift !== 0) {
      rgb2hsv(r, g, bl, tmp);
      hsv2rgb(tmp[0] + shift, tmp[1], tmp[2], tmp);
      r = tmp[0];
      g = tmp[1];
      bl = tmp[2];
    }
    lut[j * 3] = r;
    lut[j * 3 + 1] = g;
    lut[j * 3 + 2] = bl;
    // the afterglow has its own stops, without the white in the middle, because a dim white is grey and a dim amber is brown on the panel
    let k = 0;
    while (k < GS.length - 2 && t > GS[k + 1][0]) k++;
    const c = GS[k], d = GS[k + 1], h = cl((t - c[0]) / (d[0] - c[0]), 0, 1);
    r = mix(c[1], d[1], h);
    g = mix(c[2], d[2], h);
    bl = mix(c[3], d[3], h);
    if (shift !== 0) {
      rgb2hsv(r, g, bl, tmp);
      hsv2rgb(tmp[0] + shift, tmp[1], tmp[2], tmp);
      r = tmp[0];
      g = tmp[1];
      bl = tmp[2];
    }
    S.lutA[j * 3] = r;
    S.lutA[j * 3 + 1] = g;
    S.lutA[j * 3 + 2] = bl;
  }
  S.lutK = shift;
}

function lutAt(S, l, t, o) {
  const p = cl(t, 0, 1) * NL, i = min(NL - 1, floor(p)), f = p - i, q = i * 3;
  o[0] = l[q] + (l[q + 3] - l[q]) * f;
  o[1] = l[q + 1] + (l[q + 4] - l[q + 1]) * f;
  o[2] = l[q + 2] + (l[q + 5] - l[q + 2]) * f;
}

// ---- the ground
function hs(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10;
}

function vn2(x, y) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
  const a = hs(ix, iy), b = hs(ix + 1, iy), c = hs(ix, iy + 1), d = hs(ix + 1, iy + 1);
  return a + (b - a) * wx + (c - a) * wy + (a - b - c + d) * wx * wy;
}

const mkEvent = () => ({ on: false, age: 0, dur: 0, n: 0, idx: new Int16Array(NT), tt: F(NT), b: F(NT), rel: F(NT), td: F(NT), gj: F(NT), fired: new Uint8Array(NT) });

export function setup(params) {
  const S = {
    t: 0, ready: false, k1: 0, mean: 3.2, k3: 0, zen: 0.55,
    nextEv: 1, nextMu: 1, big: false,
    tx: F(NT), ty: F(NT),
    off: new Int32Array(NT + 1), pix: null, fw: null, hw: null, aw: null,
    gndR: F(N), gndG: F(N), gndB: F(N), restK: -9, cv: null, rgw: null, rim: [0, 0, 0], fill: [0, 0, 0], wd: F(NT),
    R: F(N), G: F(N), B: F(N),
    ag: F(NT), agT: F(NT), lt: F(NT), lw: F(NT), lr: F(NT),
    lut: F((NL + 1) * 3), lutA: F((NL + 1) * 3), lutK: -9, tmp: [0, 0, 0], c1: [0, 0, 0], c2: [0, 0, 0],
    ev: [], mu: [],
  };
  for (let i = 0; i < NT; i++) S.wd[i] = 0.8 * gauss();
  for (let i = 0; i < MAXE; i++) S.ev.push(mkEvent());
  for (let i = 0; i < MAXM; i++) S.mu.push({ on: false, i: 0, age: 0, a: 0 });
  for (let c = 0; c < NC; c++)
    for (let r = 0; r < NR; r++) {
      const i = c * NR + r;
      S.tx[i] = X0 + c * DX;
      S.ty[i] = Y0 + r * PITCH + (c & 1 ? PITCH / 2 : 0);
    }
  // ground, resting tanks, and for every tank the pixels it can touch with the weight of its disc, its bloom and its afterglow
  const gr = 0.052, gg = 0.043, gb = 0.034;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const m = 0.7 + 0.6 * (0.6 * vn2(x * 0.045 + 3.1, y * 0.04 + 1.7) + 0.4 * vn2(x * 0.11 + 8.3, y * 0.1 + 5.9));
      const p = y * W + x;
      S.gndR[p] = gr * m;
      S.gndG[p] = gg * m;
      S.gndB[p] = gb * m;
    }
  const pix = [], fw = [], hw = [], aw = [], cv = [], rgw = [];
  const reach = TRAD + 3.4;
  for (let i = 0; i < NT; i++) {
    S.off[i] = pix.length;
    const cx = S.tx[i], cy = S.ty[i];
    for (let y = max(0, floor(cy - reach)); y <= min(H - 1, ceil(cy + reach)); y++)
      for (let x = max(0, floor(cx - reach)); x <= min(W - 1, ceil(cx + reach)); x++) {
        const rr = sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
        if (rr > reach) continue;
        const cover = 1 - sm(TRAD - 0.75, TRAD + 0.55, rr);
        const ring = exp(-(((rr - (TRAD - 0.6)) / 0.85) ** 2)) * cover;
        const halo = rr > TRAD - 0.4 ? exp(-(((rr - TRAD + 0.3) / 1.6) ** 2)) * (1 - cover) : 0;
        const p = y * W + x;
        pix.push(p);
        cv.push(cover);
        rgw.push(ring);
        fw.push(cover * (1 - 0.16 * min(1, (rr / TRAD) ** 2)));
        hw.push(halo * 0.5);
        aw.push(cover * (0.62 + 0.5 * ring) + halo * 0.15);
      }
  }
  S.off[NT] = pix.length;
  S.pix = Int32Array.from(pix);
  S.fw = Float32Array.from(fw);
  S.hw = Float32Array.from(hw);
  S.aw = Float32Array.from(aw);
  S.cv = Float32Array.from(cv);
  S.rgw = Float32Array.from(rgw);
  params.s = S;
}

// The resting grid: a ring and a darker fill in the hue of the palette's first colour.
function rest(S) {
  hsv2rgb(0.6 + S.k1, 0.5, 0.17, S.rim);
  hsv2rgb(0.6 + S.k1, 0.5, 0.06, S.fill);
  S.restK = S.k1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.k1 = cl(k[0], -0.1, 0.5);
  const kr = (cl(k[1], 0.5, 3) - 0.5) / 2.5;
  S.mean = 1 / (1 / 6 + kr * (1 / 2 - 1 / 6));
  S.k3 = cl(k[2], -1, 1);
  S.zen = ((cl(k[3], -1, 1) + 1) / 2) * 1.0472;
  if (!S.ready) {
    S.ready = true;
    S.nextEv = 0.3 * S.mean * Math.random();
    S.nextMu = 0.5 + 2 * Math.random();
    for (let i = 0; i < PRE * 20; i++) step(S, 0.05);
    if (spawnEvent(S, 1)) {
      let e = null;
      for (const q of S.ev) if (q.on && (!e || q.age < e.age)) e = q;
      if (e) {
        e.age = 0.5;
        stepEvent(S, e);
      }
    }
    S.nextEv = 1.3 + 0.4 * Math.random();
    S.big = true;
  }
  step(S, d);
}

// A shower. mode 0 is an ordinary one, 1 a large one with its core on the panel, 2 the rare one that covers the array.
function spawnEvent(S, mode) {
  let e = null;
  for (const q of S.ev) if (!q.on) {
    e = q;
    break;
  }
  if (!e) return false;
  const kk = (S.k3 + 1) / 2, lo = LG_LO0 + LG_LO1 * kk, hi = LG_HI0 + LG_HI1 * kk;
  let lg = lo + (hi - lo) * Math.random();
  if (mode === 1) lg = mix(lo + 0.55 * (hi - lo), hi, Math.random());
  if (mode === 2) lg = 7.2;
  const th = cl(S.zen * (0.7 + 0.6 * Math.random()), 0, 1.15), ph = Math.random() * 6.2831853;
  const sT = sin(th), cT = cos(th), ux = cos(ph), uy = sin(ph);
  const E = pow(10, lg);
  // how far off the panel the core may land: a large shower still has a footprint on it
  const rf = R0 * pow(10, (lg - 0.4) / 3.3);
  const mg = mode ? -4 : cl(0.35 * rf - 4, 0, 22);
  const tt = e.tt, bb = e.b;
  let n = 0;
  for (let tries = 0; tries < 4 && n === 0; tries++) {
    const cx = -mg + (W + 2 * mg) * Math.random(), cy = -mg + (H + 2 * mg) * Math.random();
    for (let i = 0; i < NT; i++) {
      const dx = S.tx[i] - cx, dy = S.ty[i] - cy;
      const xu = dx * ux + dy * uy, xv = dy * ux - dx * uy;
      const a = xu * cT, rho = sqrt(a * a + xv * xv);
      const re = rho * exp(cl((KAPPA * sT * xu) / RS, -1.2, 1.2));
      const q = sqrt(re * re + (0.3 * R0) ** 2) / R0;
      const ls = lg + (-BETA * log(q) - (BETA + ETA) * log(1 + q)) * 0.4342945 + 0.32 * gauss() * 0.4342945;
      const b = ls < 0 ? 0.34 * sm(-0.45, 0, ls) : min(1, 0.34 + 0.3 * ls);
      bb[i] = b;
      tt[i] = (sT * xu) / VSWEEP + TC * (rho / RC) ** 2 + 0.018 * gauss();
      if (b > 0.03) n++;
    }
  }
  if (n === 0) return false;
  let tmin = 1e9, tmax = -1e9;
  for (let i = 0; i < NT; i++) {
    if (bb[i] > 0.08 && tt[i] < tmin) tmin = tt[i];
    if (bb[i] > 0.55 && tt[i] > tmax) tmax = tt[i];
  }
  if (tmin > 1e8) for (let i = 0; i < NT; i++) if (bb[i] > 0.03 && tt[i] < tmin) tmin = tt[i];
  if (tmax < -1e8) for (let i = 0; i < NT; i++) if (bb[i] > 0.34 && tt[i] > tmax) tmax = tt[i];
  if (tmax < -1e8) tmax = tmin;
  const span = max(0.55, tmax - tmin);
  // the arrays are packed to the tanks that are lit at all
  let m = 0, last = 0;
  for (let i = 0; i < NT; i++) {
    const b = bb[i];
    if (b <= 0.03) continue;
    const t = max(0, tt[i] - tmin) + 0.03;
    e.idx[m] = i;
    e.tt[m] = t;
    e.b[m] = b;
    e.rel[m] = cl((t - 0.03) / span, 0, 1);
    e.td[m] = 0.46 + 0.4 * b;
    e.gj[m] = 0.55 + 0.45 * Math.random(); // each tank holds a different share of the flash as afterglow
    e.fired[m] = 0;
    if (t > last) last = t;
    m++;
  }
  e.n = m;
  e.age = 0;
  e.dur = last + 5.2;
  e.on = true;
  return true;
}

// The afterglow a tank gets when it has fired.
function stepEvent(S, e) {
  for (let k = 0; k < e.n; k++) {
    if (e.fired[k] || e.age - e.tt[k] < 0.1) continue;
    e.fired[k] = 1;
    const i = e.idx[k], b = e.b[k];
    if (b < 0.3) continue;
    const a = (0.075 + 0.45 * sm(0.34, 0.9, b)) * e.gj[k], tot = S.ag[i] + a;
    // the newer colour wins where it is the stronger, so overlapping footprints do not blend to grey
    S.agT[i] = mix(S.agT[i], e.rel[k], sm(0.2, 0.6, a / (tot + 1e-6)));
    S.ag[i] = min(0.56, tot);
  }
}

const erl = () => cl(-(log(1 - Math.random()) + log(1 - Math.random())) / 2, 0.45, 1.55);

function step(S, dt) {
  S.t += dt;
  const kd = exp(-dt / AG_TAU);
  for (let i = 0; i < NT; i++) {
    const a = S.ag[i] * kd;
    S.ag[i] = a < 0.003 ? 0 : a;
  }
  const kw = sqrt((2 * dt) / WTAU);
  for (let i = 0; i < NT; i++) S.wd[i] = cl(S.wd[i] - (S.wd[i] * dt) / WTAU + kw * gauss(), -1.8, 1.8);
  for (const e of S.ev) {
    if (!e.on) continue;
    e.age += dt;
    stepEvent(S, e);
    if (e.age > e.dur) e.on = false;
  }
  for (const m of S.mu) if (m.on) {
    m.age += dt;
    if (m.age > 2) m.on = false;
  }
  S.nextEv -= dt;
  if (S.nextEv <= 0) {
    spawnEvent(S, S.big ? 1 : Math.random() < 0.012 ? 2 : 0);
    S.big = false;
    S.nextEv = S.mean * erl();
  }
  S.nextMu -= dt;
  if (S.nextMu <= 0) {
    for (const m of S.mu) if (!m.on) {
      m.on = true;
      m.i = floor(Math.random() * NT);
      m.age = 0;
      m.a = 0.16 + 0.2 * Math.random();
      break;
    }
    S.nextMu = 1.2 * erl();
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.lutK !== S.k1) buildLut(S, S.k1);
  if (S.restK !== S.k1) rest(S);
  const { R, G, B, lt, lw, lr, ag, agT, c1, c2 } = S;
  R.set(S.gndR);
  G.set(S.gndG);
  B.set(S.gndB);
  lt.fill(0);
  lw.fill(0);
  lr.fill(0);
  // what every tank is doing now: the showers still flashing, and the muons
  for (const e of S.ev) {
    if (!e.on) continue;
    for (let k = 0; k < e.n; k++) {
      const dl = e.age - e.tt[k];
      if (dl <= 0) continue;
      const L = min(1, e.b[k] * (1 - exp(-dl / RISE)) * exp(-dl / e.td[k]) * 1.12);
      if (L < 0.004) continue;
      const i = e.idx[k];
      lt[i] = 1 - (1 - lt[i]) * (1 - L);
      lw[i] += L;
      lr[i] += L * e.rel[k];
    }
  }
  for (const m of S.mu) {
    if (!m.on) continue;
    const L = m.a * (1 - exp(-m.age / RISE)) * exp(-m.age / 0.3);
    if (L < 0.004) continue;
    lt[m.i] = 1 - (1 - lt[m.i]) * (1 - L);
    lw[m.i] += L;
  }
  const { off, pix, fw, hw, aw } = S;
  for (let i = 0; i < NT; i++) {
    const Lf = lt[i], A = ag[i], th = Math.tanh(S.wd[i] * 0.8), gs = 1 + WAMP * th, gf = 1 + FAMP * th;
    const rr = S.rim[0] * gs, rg = S.rim[1] * gs, rb = S.rim[2] * gs, fr0 = S.fill[0] * gf, fg0 = S.fill[1] * gf, fb0 = S.fill[2] * gf;
    let fr = 0, fg = 0, fb = 0, ar = 0, ab = 0, ae = 0;
    if (Lf >= 0.004) {
      lutAt(S, S.lut, lw[i] > 0 ? lr[i] / lw[i] : 0, c1);
      const w = sm(0.55, 0.95, Lf) * 0.9;
      fr = mix(c1[0], 1, w);
      fg = mix(c1[1], 1, w);
      fb = mix(c1[2], 1, w);
    }
    if (A >= 0.03) {
      // below about 0.12 a colour is no longer a colour on the panel, so the afterglow lets go early
      const Ae = A * sm(0.03, 0.17, A);
      lutAt(S, S.lutA, agT[i], c2);
      ar = c2[0] * Ae;
      ae = c2[1] * Ae;
      ab = c2[2] * Ae;
    }
    const L2 = Lf * Lf;
    for (let k = off[i], ke = off[i + 1]; k < ke; k++) {
      const p = pix[k], f = Lf * fw[k] + L2 * hw[k], a = aw[k], c = S.cv[k], g = S.rgw[k];
      R[p] += fr * f + ar * a + fr0 * c + rr * g;
      G[p] += fg * f + ae * a + fg0 * c + rg * g;
      B[p] += fb * f + ab * a + fb0 * c + rb * g;
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let r = R[p], g = G[p], b = B[p];
      const mx = max(r, g, b);
      if (mx > 0.8) {
        // the brightest channel rolls off toward 1 with the hue kept
        const f = (0.8 + 0.2 * (1 - exp(-(mx - 0.8) / 0.3))) / mx;
        r *= f;
        g *= f;
        b *= f;
      }
      display.setPixel(x, y, r * 255, g * 255, b * 255);
    }
}
