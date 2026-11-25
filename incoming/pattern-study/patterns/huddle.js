// ===== Patternflow pattern =====
// Title:   Huddle
// Family:  huddle
// Idea:    A thermal camera looks straight down on a huddle in a blizzard: warm discs packed shoulder to shoulder with a yellow-white core, a windward rim that chills through magenta and violet to blue until its discs peel off, walk round the flank and tuck in on the sheltered side, so the whole pack creeps downwind like a tank tread while the wind slowly turns and the teardrop turns with it.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the emperor penguin huddle as a treadmill, where the most exposed bird of the windward edge moves round to the lee and the huddle creeps downwind and takes its shape from the wind (Waters, Blanchette and Kim, 2012, from memory), and the travelling waves of small steps that keep a huddle packed (Zitterbart and colleagues, 2011, from memory); the false-colour ramp of a thermal camera. Original here: the heat balance of each disc, the walk along a contour of the pack's density, the joiners who walk upwind into the lee face, the warmth left on the snow and the streaks of drift, pattern round 253
// Round:   253
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Crowd=-1..1, Wind=-1..1
//
// Knob 1: Hue. Turns the thermal ramp round the wheel; it opens on the camera's own colours, blue and violet for cold through magenta, red and orange to yellow-white for hot.
// Knob 2: Speed. 0.3 to 3, opening at 2. The time scale of everything: the walking, the chilling, the pack's creep, the drift of the snow and the turning of the wind, which at 2 takes about seven minutes to come round.
// Knob 3: Crowd. -1 to 1, opening at 0. How many discs: 64 at -1, 120 at 0, 210 at 1, where the pack is as wide as the panel and its core runs paler. Turned while running, newcomers walk in from beyond the lee edge of the panel and the surplus walk off it.
// Knob 4: Wind. -1 to 1, opening at 0.06. At -1 a breeze: a loose round pack, red at the rim and yellow inside, hardly a walker, the drift thin and slow. At 1 a gale: discs tight together in a blunt-nosed teardrop, a windward rim three discs deep in blue and violet, a file of walkers down each flank, the drift thick and fast.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, pow, sqrt, exp, sin, cos, round, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const NMAX = 236;
const RAD = 2.1;                  // a disc's radius in LEDs
const CUT = 13.2, CUT2 = CUT * CUT;
const SIG = 4.0, IS2 = 1 / (2 * SIG * SIG);   // the width of the density a walker feels
const RO0 = 0.38;                 // the contour of that density a walker keeps to
const GW = 64, GH = 128;          // the snow's warmth, one cell to two LEDs, wrapped round a world larger than the panel

const countOf = (k) => round(120 + 73 * k + 17 * k * k);
const pitchOf = (wn) => 4.85 - 0.6 * wn;      // centre to centre: loose in a breeze, tight in a gale

function hsh(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(u, v) {
  const iu = floor(u), iv = floor(v);
  let fu = u - iu, fv = v - iv;
  fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
  const a = hsh(iu, iv), b = hsh(iu + 1, iv), c = hsh(iu, iv + 1), d = hsh(iu + 1, iv + 1);
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// the thermal ramp: temperature, hue, saturation, value
const RAMP = [
  0.00, 0.640, 0.92, 0.80,
  0.18, 0.700, 0.90, 0.88,
  0.34, 0.800, 0.88, 0.90,
  0.48, 0.920, 0.90, 0.92,
  0.60, 1.010, 0.94, 0.96,
  0.74, 1.070, 0.96, 1.00,
  0.88, 1.125, 0.85, 1.00,
  1.00, 1.150, 0.35, 1.00,
];

export function setup(params) {
  const f = () => new Float32Array(NMAX);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    n: 0, t: 0, th: 0, ph: [0, 0],
    x: f(), y: f(), T: f(), age: f(), cj: f(), q: f(), tol: f(), sz: f(), fl: f(), om: f(),
    s: new Uint8Array(NMAX), sd: new Int8Array(NMAX),
    ax: f(), ay: f(), nb: f(), nc: f(), hs: f(), sh: f(), ro: f(), gx: f(), gy: f(),
    cx: 0, cy: 0, camx: 0, camy: 0, ex: 20, ey: 20, due: 0, su: 0,
    wv: new Float32Array(15), nwv: 0, wdue: 2,     // waves of steps: origin, heading, how far the front has come
    lut: new Float32Array(256 * 3), snow: new Float32Array(GW * GH), fb: new Float32Array(W * H * 3),
  });
  return st;
}

// The outline the pack keeps to, in the wind's frame: u downwind and v across, from the shape's own middle.
// An ellipse `asp` times as long as wide, broad to windward and narrowing to the lee. 1 is the outline.
const SH = { la: 1, wd: 1, tp: 0, uc: 0 };
function shapeOf(n, D, wn) {
  const rr = sqrt(n * 0.866 * D * D / PI), asp = 1 + 0.45 * wn;
  SH.la = rr * sqrt(asp); SH.wd = rr / sqrt(asp); SH.tp = 0.4 * wn; SH.uc = 0.25 * SH.tp * SH.la;
}
const shapeM = (u, v) => { const a = u / SH.la, b = v / (SH.wd * (1 - SH.tp * cl(a, -1, 1))); return sqrt(a * a + b * b); };

// ---- a fresh pack: a hex-packed blob, already leaning the way this wind would shape it ----
function place(st) {
  const wn = (cl(st.ks[3], -1, 1) + 1) / 2, N = countOf(cl(st.ks[2], -1, 1)), D = pitchOf(wn);
  st.ph[0] = TP * Math.random(); st.ph[1] = TP * Math.random();
  st.th = TP * Math.random();
  const wx = cos(st.th), wy = sin(st.th);
  shapeOf(N, D, wn);
  const la = TP * Math.random(), ca = cos(la), sa = sin(la);
  const pts = [];
  for (let a = -20; a <= 20; a++) for (let b = -20; b <= 20; b++) {
    const lx = (a + 0.5 * b) * D, ly = b * D * 0.866;
    const X = lx * ca - ly * sa, Y = lx * sa + ly * ca;
    const u = X * wx + Y * wy, v = -X * wy + Y * wx;
    pts.push([shapeM(u, v), X, Y]);
  }
  pts.sort((p, q) => p[0] - q[0]);
  for (let i = 0; i < N; i++) { fresh(st, i); st.x[i] = pts[i][1]; st.y[i] = pts[i][2]; }
  st.n = N; st.cx = -SH.uc * wx; st.cy = -SH.uc * wy; st.camx = st.cx; st.camy = st.cy;
}

// ---- every pair within reach: spacing, touching, shared heat, shelter from the wind, and what a walker feels of the pack ----
function pairs(st, D, wx, wy) {
  const { x, y, T, sz, s, ax, ay, nb, nc, hs, sh, ro, gx, gy } = st, n = st.n;
  for (let i = 0; i < n; i++) ax[i] = ay[i] = nb[i] = nc[i] = hs[i] = sh[i] = ro[i] = gx[i] = gy[i] = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], si = s[i], zi = 0.5 * D * sz[i];
    for (let j = i + 1; j < n; j++) {
      const dx = x[j] - xi;
      if (dx > CUT || dx < -CUT) continue;
      const dy = y[j] - yi, d2 = dx * dx + dy * dy;
      if (d2 > CUT2) continue;
      const d = sqrt(d2) + 1e-4, ux = dx / d, uy = dy / d, sj = s[j], Dp = zi + 0.5 * D * sz[j];
      if (si === 0 && sj === 0) {
        if (d < 1.6 * Dp) {
          const f = (d < Dp ? 1.6 * (Dp - d) : -0.3 * min(d - Dp, 1.6 * Dp - d)) - 0.12;
          ax[i] -= f * ux; ay[i] -= f * uy; ax[j] += f * ux; ay[j] += f * uy;
          if (d < 1.45 * Dp) { const c = min(1, (1.45 * Dp - d) / (0.3 * Dp)); nc[i] += c; nc[j] += c; }
        }
        if (d < 6.6) {
          const c = min(1.2, (6.6 - d) / 2.2);
          nb[i] += c; nb[j] += c; hs[i] += c * T[j]; hs[j] += c * T[i];
        }
        const g = min(1, (CUT - d) / 8), cw = ux * wx + uy * wy;
        if (cw > 0) sh[j] += g * cw * cw; else sh[i] += g * cw * cw;
      } else if (si === 0 || sj === 0) {
        const a = si === 0 ? j : i, b = si === 0 ? i : j, sg = si === 0 ? -1 : 1;
        const e = exp(-d2 * IS2);
        ro[a] += e; gx[a] += sg * e * dx; gy[a] += sg * e * dy;
        if (d < 1.45 * Dp) nc[a] += min(1, (1.45 * Dp - d) / (0.3 * Dp));
        if (d < Dp) {
          const f = Dp - d;
          ax[a] -= 0.9 * sg * f * ux; ay[a] -= 0.9 * sg * f * uy; ax[b] += 0.1 * sg * f * ux; ay[b] += 0.1 * sg * f * uy;
        }
      } else if (d < 1.1 * Dp) {
        const f = 0.5 * (1.1 * Dp - d);
        ax[i] -= f * ux; ay[i] -= f * uy; ax[j] += f * ux; ay[j] += f * uy;
      }
    }
  }
}

// what one step shares between its parts
const C = { dt: 0, wx: 1, wy: 0, wn: 0, D: 4.5, Wb: 0, t: 0, al: 0, mv: 0, nw: 0, mx: 0, my: 0, np: 0, rm: -1 };

// heat: a disc's own, what its neighbours pass it, what its open sides and the wind take
function heatOf(st, i) {
  const E = cl(1 - st.sh[i] / 3.1, 0, 1), nn = min(1, st.nb[i] / 5.2);
  // gusts are streaks of harder wind that run downwind over the ground
  const gu = st.x[i] * C.wx + st.y[i] * C.wy, gv = st.y[i] * C.wx - st.x[i] * C.wy;
  const Wg = C.Wb * (0.15 + 1.8 * vn((gu - 22 * C.t) / 26, gv / 17 + 0.04 * C.t));
  const Teq = (0.32 * st.q[i] + st.hs[i]) / (0.2 + 0.5 * (1 - nn) + 6 * Wg * E + st.nb[i]);
  return Teq > 0.9 ? 1 - 0.1 * exp(9 - 10 * Teq) : Teq;
}

// ---- a packed disc: warms or chills, steps with a passing wave, leans into the wind, and may leave ----
function packed(st, i) {
  const { x, y, T, age, fl, nc, wv } = st, dt = C.dt, wx = C.wx, wy = C.wy;
  const E = cl(1 - st.sh[i] / 3.1, 0, 1);
  T[i] += (heatOf(st, i) - T[i]) * (1 - exp(-0.8 * dt));
  // a passing wave: a small step along its heading, and a flush of warmth from the squeeze
  let pu = 0, stx = 0, sty = 0;
  for (let k = 0; k < st.nwv * 5; k += 5) {
    const z = ((x[i] - wv[k]) * wv[k + 2] + (y[i] - wv[k + 1]) * wv[k + 3] - wv[k + 4]) / 5;
    if (z > -3 && z < 3) { const e = exp(-z * z); pu += e; stx += e * wv[k + 2]; sty += e * wv[k + 3]; }
  }
  fl[i] += (0.1 * min(1, pu) - fl[i]) * (1 - exp(-5 * dt));
  x[i] += 1.3 * stx * dt; y[i] += 1.3 * sty * dt;
  age[i] += dt;
  if (age[i] > 3 && nc[i] < 4.5 && C.nw < 0.2 * st.n) {
    // it leaves when it is cold, sooner when it stands out beyond the outline, at once when it is left alone
    const rx = x[i] - st.cx, ry = y[i] - st.cy;
    const over = shapeM(rx * wx + ry * wy - SH.uc, ry * wx - rx * wy) - 1.06;
    const cold = E > 0.25 ? max(0, st.tol[i] - T[i]) : 0;
    const rate = nc[i] < 1.5 ? 9 : (0.006 * E + 2.8 * cold * cold + 2 * max(0, over)) * min(1.5, (4.8 - nc[i]) / 1.4);
    if (Math.random() < rate * dt) {
      st.s[i] = 1; age[i] = 0; st.cj[i] = Math.random();
      const lat = ry * wx - rx * wy;
      st.sd[i] = (lat === 0 ? Math.random() < 0.5 : lat < 0) ? 1 : -1;     // the shorter way round to the lee
      C.nw++;
      return;
    }
  }
  // an exposed disc leans into the pack, which keeps the windward face closed
  const lean = 0.5 * min(1.2, C.Wb) * E;
  x[i] += cl((st.ax[i] + lean * wx) * C.al, -0.35, 0.35); y[i] += cl((st.ay[i] + lean * wy) * C.al, -0.35, 0.35);
  C.mx += x[i]; C.my += y[i]; C.np++;
}

// ---- a walker: round the outside along a contour of the pack's density, then upwind into the lee face ----
function walker(st, i) {
  const { x, y, T, age, s, nc } = st, dt = C.dt, wx = C.wx, wy = C.wy, mv = C.mv;
  age[i] += dt;
  T[i] += (0.1 - T[i]) * (1 - exp(-0.35 * dt)); st.fl[i] *= exp(-5 * dt);
  const rx = x[i] - st.cx, ry = y[i] - st.cy, rl = sqrt(rx * rx + ry * ry) + 1e-4;
  const gl = sqrt(st.gx[i] * st.gx[i] + st.gy[i] * st.gy[i]);
  let vx, vy;
  if (s[i] === 3) {
    // sent away by the crowd knob: straight out until it is off the panel
    vx = rx / rl * 1.3 * mv; vy = ry / rl * 1.3 * mv;
    if (abs(x[i] - st.camx) > 37 || abs(y[i] - st.camy) > 69) C.rm = i;
  } else if (st.ro[i] < 0.03 || gl < 1e-4) { vx = -rx / rl * mv; vy = -ry / rl * mv; }
  else if (s[i] === 1) {
    const nx = -st.gx[i] / gl, ny = -st.gy[i] / gl, sd = st.sd[i];
    const c = cl((st.ro[i] - RO0) * SIG * SIG / gl, -mv, mv);
    vx = -ny * sd * mv + nx * c; vy = nx * sd * mv + ny * c;
    const u = rx * wx + ry * wy, v = ry * wx - rx * wy, r1 = st.cj[i];
    // how far the pack here stands beyond its outline, in discs; below zero it stands short
    const m = (shapeM(u - SH.uc, v) - 1) * sqrt(SH.la * SH.wd) / C.D - 1.25;
    if (age[i] > 1.5) {
      // on the lee side it turns in at its own distance from the wind's axis, where the pack is not already beyond its outline
      if (age[i] > 45 || (u > 0.15 * rl && m < 0.35 && abs(v) < 0.85 * SH.wd * pow(r1, 1 + 0.6 * C.wn))) { s[i] = 2; age[i] = 0; }
      // and on a flank it steps into a bite out of the pack's side
      else if (u > -0.35 * rl && m < -0.5 - 0.4 * ((r1 * 7.31) % 1)) { s[i] = 2; age[i] = 0; st.sd[i] = 0; }
    }
  } else {
    // into the lee face it walks straight upwind, sliding along the face until it sits in a pocket, so the face fills level
    if (st.sd[i]) { vx = -wx * 0.8 * mv; vy = -wy * 0.8 * mv; }
    else { vx = st.gx[i] / gl * 0.8 * mv; vy = st.gy[i] / gl * 0.8 * mv; }
    if (nc[i] > 2.6 || (nc[i] > 1.2 && age[i] > 3) || age[i] > 14) { s[i] = 0; age[i] = 0; }
  }
  x[i] += vx + cl(st.ax[i] * 0.6, -0.5, 0.5); y[i] += vy + cl(st.ay[i] * 0.6, -0.5, 0.5);
}

// ---- waves of small steps: now and then one crosses the pack, mostly downwind ----
function waves(st, dt) {
  const wv = st.wv;
  for (let k = 0; k < st.nwv; k++) {
    wv[k * 5 + 4] += 13 * dt;
    if (wv[k * 5 + 4] > 2 * (st.ex + st.ey) + 40) { st.nwv--; for (let m = k * 5; m < st.nwv * 5; m++) wv[m] = wv[m + 5]; k--; }
  }
  st.wdue -= dt;
  if (st.wdue <= 0 && st.nwv < 3) {
    const a = st.th + 1.1 * (Math.random() + Math.random() - 1), k = st.nwv++ * 5;
    wv[k + 2] = cos(a); wv[k + 3] = sin(a);
    wv[k] = st.cx - wv[k + 2] * (st.ex + st.ey + 16); wv[k + 1] = st.cy - wv[k + 3] * (st.ex + st.ey + 16); wv[k + 4] = 0;
    st.wdue = 2.2 + 2.6 * Math.random();
  }
}

function fresh(st, i) {
  st.T[i] = 0.6; st.age[i] = 10; st.cj[i] = Math.random(); st.s[i] = 0; st.sd[i] = 1; st.fl[i] = 0;
  st.q[i] = 0.85 + 0.3 * Math.random(); st.tol[i] = 0.27 + 0.08 * Math.random();
  st.sz[i] = 0.88 + 0.24 * Math.random(); st.om[i] = 0.45 + 0.6 * Math.random();
}

// ---- the crowd knob turned while running: newcomers walk in from beyond the lee edge, the surplus walks off ----
function crowd(st, dt) {
  const want = countOf(cl(st.ks[2], -1, 1)), { x, y, s, T } = st;
  st.due -= dt;
  let going = 0;
  for (let i = 0; i < st.n; i++) if (s[i] === 3) going++;
  if (st.due > 0 || st.n - going === want) return;
  st.due = 0.12;
  if (st.n - going < want) {
    if (st.n >= NMAX) return;
    const i = st.n++, a = st.th + 1.8 * (Math.random() - 0.5), dx = cos(a), dy = sin(a);
    const r = min(36 / (abs(dx) + 1e-3), 68 / (abs(dy) + 1e-3));
    fresh(st, i);
    x[i] = st.camx + dx * r; y[i] = st.camy + dy * r; s[i] = 1; T[i] = 0.1; st.age[i] = 0;
    st.sd[i] = (dy * C.wx - dx * C.wy) < 0 ? 1 : -1;
  } else {
    // a walker goes first; with none about, the coldest disc on the edge
    let pick = -1, cold = 9;
    for (let i = 0; i < st.n; i++) {
      if (s[i] === 1 || s[i] === 2) { pick = i; break; }
      if (s[i] === 0 && st.nc[i] < 4.5 && T[i] < cold) { cold = T[i]; pick = i; }
    }
    if (pick >= 0) s[pick] = 3;
  }
}

// ---- one step of the world ----
function step(st, dt) {
  const { x, y, s, snow, ph } = st;
  const wn = (cl(st.ks[3], -1, 1) + 1) / 2, D = pitchOf(wn);
  st.t += dt;
  // the wind turns one way, now quicker and now slower
  st.th += dt * (TP / 840) * (1 + 0.5 * sin(0.031 * st.t + ph[0]) + 0.33 * sin(0.0713 * st.t + ph[1]));
  st.su += dt * (5 + 14 * wn);       // how far the drifting snow has run
  waves(st, dt);
  crowd(st, dt);
  const n = st.n;
  C.dt = dt; C.wx = cos(st.th); C.wy = sin(st.th); C.wn = wn; C.D = D; C.Wb = 0.15 + 1.25 * wn; C.t = st.t;
  C.al = 0.5 * (1 - exp(-4 * dt)); C.mv = (4 + 3 * wn) * dt; C.nw = 0; C.mx = C.my = C.np = 0; C.rm = -1;
  shapeOf(n, D, wn);
  pairs(st, D, C.wx, C.wy);
  for (let i = 0; i < n; i++) if (s[i]) C.nw++;
  for (let i = 0; i < n; i++) { if (s[i] === 0) packed(st, i); else walker(st, i); }
  if (C.rm >= 0) {
    // one that walked off the panel is gone: the last in the list takes its place
    const i = C.rm, l = --st.n;
    for (const a of [x, y, st.T, st.age, st.cj, st.q, st.tol, st.sz, st.fl, st.om, s, st.sd]) a[i] = a[l];
  }
  // the snow keeps some of the warmth of whoever stands on it, and loses it slowly
  const kd = exp(-dt / 22), dep = min(1, 0.5 * dt);
  for (let c = 0; c < GW * GH; c++) snow[c] *= kd;
  for (let i = 0; i < st.n; i++) {
    const cx0 = x[i] / 2 - 0.5, cy0 = y[i] / 2 - 0.5, ix = floor(cx0) - 1, iy = floor(cy0) - 1;
    for (let b = 0; b < 4; b++) {
      const wy2 = 1 - abs(iy + b - cy0) / 2;
      if (wy2 <= 0) continue;
      const row = ((iy + b) & (GH - 1)) * GW;
      for (let a = 0; a < 4; a++) {
        const wx2 = 1 - abs(ix + a - cx0) / 2;
        if (wx2 > 0) { const c = row + ((ix + a) & (GW - 1)); snow[c] += (1 - snow[c]) * dep * min(1, 1.6 * wx2 * wy2); }
      }
    }
  }
  if (!C.np) return;
  const mx = C.mx / C.np, my = C.my / C.np;
  let vxx = 0, vyy = 0;
  for (let i = 0; i < st.n; i++) if (s[i] === 0) { vxx += (x[i] - mx) * (x[i] - mx); vyy += (y[i] - my) * (y[i] - my); }
  const ac = 1 - exp(-dt / 1.5);
  st.cx += (mx - st.cx) * ac; st.cy += (my - st.cy) * ac;
  st.ex += (2 * sqrt(vxx / C.np) - st.ex) * ac; st.ey += (2 * sqrt(vyy / C.np) - st.ey) * ac;
  // the view follows on a soft spring, so the pack sits a little downwind of the middle
  const af = 1 - exp(-dt / 2.5);
  st.camx += (st.cx - st.camx) * af; st.camy += (st.cy - st.camy) * af;
  // far from where it began the world is moved back whole, by a distance the snow's wrapped grid does not notice
  for (let a = 0; a < 2; a++) {
    const cam = a ? st.camy : st.camx;
    if (abs(cam) < 4096) continue;
    const sh = cam > 0 ? -4096 : 4096, p = a ? y : x;
    for (let i = 0; i < st.n; i++) p[i] += sh;
    for (let k = 0; k < st.nwv; k++) st.wv[k * 5 + a] += sh;
    if (a) { st.cy += sh; st.camy += sh; } else { st.cx += sh; st.camx += sh; }
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.1);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    place(st);
    // the temperatures settle on the still pack, then the world runs unseen for half a minute and more
    C.wx = cos(st.th); C.wy = sin(st.th); C.Wb = 0.15 + 0.625 * (cl(st.ks[3], -1, 1) + 1); C.t = 0;
    for (let k = 0; k < 70; k++) {
      pairs(st, pitchOf((cl(st.ks[3], -1, 1) + 1) / 2), C.wx, C.wy);
      for (let i = 0; i < st.n; i++) st.T[i] = heatOf(st, i);
    }
    const warm = 30 * max(1, min(3, st.ks[1]));
    for (let i = 0; i < (warm - 6) * 5; i++) step(st, 0.2);
    for (let i = 0; i < 60; i++) step(st, 0.1);
  }
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  if (dt > 0) step(st, dt * cl(st.ks[1], 0.3, 3));
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { x, y, T, sz, fl, om, lut, snow, fb } = st, n = st.n;
  // the ramp at this turn of the hue knob
  for (let i = 0; i < 256; i++) {
    const tt = i / 255;
    let k = 0;
    while (k < 6 && tt > RAMP[k * 4 + 4]) k++;
    const o = k * 4, f = cl((tt - RAMP[o]) / (RAMP[o + 4] - RAMP[o]), 0, 1);
    hsv(st.ks[0] + RAMP[o + 1] + (RAMP[o + 5] - RAMP[o + 1]) * f, RAMP[o + 2] + (RAMP[o + 6] - RAMP[o + 2]) * f, RAMP[o + 3] + (RAMP[o + 7] - RAMP[o + 3]) * f, lut, i * 3);
  }
  const ox = 32 - st.camx, oy = 64 - st.camy;
  // the snow: streaks of drift running downwind, and the fading warmth of where the pack has stood
  const wx = cos(st.th), wy = sin(st.th), wn = (cl(st.ks[3], -1, 1) + 1) / 2;
  const n0 = 0.62 - 0.08 * wn, su = st.su;
  for (let py = 0; py < H; py++) {
    const wyp = py + 0.5 - oy, cy0 = wyp / 2 - 0.5, iy = floor(cy0), fy = cy0 - iy;
    const r0 = (iy & (GH - 1)) * GW, r1 = ((iy + 1) & (GH - 1)) * GW;
    for (let px = 0; px < W; px++) {
      const wxp = px + 0.5 - ox, cx0 = wxp / 2 - 0.5, ix = floor(cx0), fx = cx0 - ix;
      const c0 = ix & (GW - 1), c1 = (ix + 1) & (GW - 1);
      const hv = (snow[r0 + c0] * (1 - fx) + snow[r0 + c1] * fx) * (1 - fy) + (snow[r1 + c0] * (1 - fx) + snow[r1 + c1] * fx) * fy;
      const u = (px - 31.5) * wx + (py - 63.5) * wy - su, v = (py - 63.5) * wx - (px - 31.5) * wy;
      const nz = 0.7 * vn(u / 30, v / 2.7 + 50) + 0.3 * vn(u / 13 + 31.7, v / 1.8 + 11.3);
      const g = sstep(n0, n0 + 0.18, nz) * 0.23 * (1 - sstep(0.03, 0.4, hv));
      const li = 3 * round(255 * (0.02 + 0.3 * hv)), b = 0.24 * hv * sqrt(hv);
      const f = (py * W + px) * 3;
      fb[f] = 0.55 * g + lut[li] * b; fb[f + 1] = 0.78 * g + lut[li + 1] * b; fb[f + 2] = g + lut[li + 2] * b;
    }
  }
  // the discs
  for (let i = 0; i < n; i++) {
    const sx = x[i] + ox, sy = y[i] + oy, rad = RAD * sz[i];
    // its own temperature, the flush of a passing wave, and a slow wavering that is its alone
    const Ti = T[i] + fl[i] + 0.055 * sin(om[i] * st.t + 40 * om[i]) - 0.03;
    const x0 = max(0, floor(sx - rad - 1)), x1 = min(W - 1, ceil(sx + rad)), y0 = max(0, floor(sy - rad - 1)), y1 = min(H - 1, ceil(sy + rad));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const ddx = px + 0.5 - sx, ddy = py + 0.5 - sy, d = sqrt(ddx * ddx + ddy * ddy);
      const cov = rad + 0.5 - d;
      if (cov <= 0) continue;
      const u2 = min(1, d * d / (rad * rad));
      const lv = min(1, cov) * (1 - 0.55 * u2);
      const li = 3 * cl(round((Ti + 0.09 * (1 - u2)) * 255), 0, 255);
      const f = (py * W + px) * 3;
      const r = lut[li] * lv, g = lut[li + 1] * lv, b = lut[li + 2] * lv;
      if (r > fb[f]) fb[f] = r;
      if (g > fb[f + 1]) fb[f + 1] = g;
      if (b > fb[f + 2]) fb[f + 2] = b;
    }
  }
  for (let p = 0, f = 0; p < W * H; p++, f += 3) {
    display.setPixel(p % W, (p / W) | 0, (fb[f] * 255 + 0.5) | 0, (fb[f + 1] * 255 + 0.5) | 0, (fb[f + 2] * 255 + 0.5) | 0);
  }
}
