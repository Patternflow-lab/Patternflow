// ===== Patternflow pattern =====
// Title:   Gravity Wells
// Family:  gravitywell
// Idea:    A square grid sheet seen in perspective, long axis running up the panel, is dented into funnels by heavy masses that wander slowly across it, the grid lines bending down into every funnel and glowing where they are steepest, while small amber marbles are flicked in from the rim, circle the funnels on rosette orbits, lose energy to drag on the funnel walls, spiral in and are swallowed at the throat with a flash that sends a ripple over the sheet, and new ones keep coming.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the rubber-sheet picture of a gravitating mass (Ludwig Flamm's embedding paraboloid, 1916, as popular accounts of general relativity draw it) and the coin funnels of science museums; a softened point-mass potential (Henry Plummer, 1911) and the semi-implicit Euler step (Alan Cromer, 1981) with linear drag; the one height field that is at once the drawn sheet and the marbles' potential, the wells that wander and orbit each other loosely, the glow and hue shift of the lines by slope, the drag heat, the swallow flash and its ripples are original, pattern round 255
// Round:   255
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Mass=0..3, Wells=-1..1, Drag=0..1
//
// Knob 1: Hue. Turns the whole palette round the wheel; it opens on an indigo grid whose steepest slopes glow pale azure, with amber and white marbles.
// Knob 2: Mass. 0 to 3, opening at 2. The depth of the funnels and with it the pull on the marbles: at 0 the sheet is flat and the marbles glide straight across it, at 2 a funnel sinks 12 to 20 LED and a marble circles it in a few seconds, at 3 the funnels are deeper still and the marbles whip round them.
// Knob 3: Wells. -1 to 1, opening at 0. How many masses sit on the sheet: one at -1, two at -0.33, three at 0.33, four at 1, and between those the next one grows smoothly out of the sheet. At the start there are two heavy masses and a third, half grown, that circles the first loosely.
// Knob 4: Drag. 0 to 1, opening at 0.06. The friction a marble feels on a funnel wall, none on the flat sheet: at 0 it keeps its orbit until a passing well flings it off the edge, at 0.06 it circles a few times and spirals in, at 1 it drops to the throat within a turn or two. The energy the drag takes warms the sheet, and the lines glow amber for a few seconds where a marble has been dragged.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, tanh, pow, hypot, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

// the sheet: x across (-1..1), y up it (-HY near .. HY far), z up
const NCX = 8, CELLX = 0.25, HX = NCX * CELLX / 2; // 9 lines up the sheet
const HY = 3; // the sheet is 2 wide and 6 long
const NCROSS = 20; // lines across it, spaced so they stay apart on the panel
const NSX = 20, NSY = 60; // samples per grid line, about 0.1 world apart
// the camera: a pinhole looking down at the sheet at about 55 degrees, the far edge 55% as wide as the near one
const EL0 = 0.96, RFAR = 0.55;
const YN = 122; // panel row of the flat sheet's near edge
let SE = 0, CE = 0, GA = 0, GD = 0, ZN = 0, GF = 0, GY0 = 0;
function setCam(el) {
  SE = sin(el); CE = cos(el);
  GA = HY * CE; GD = GA * (1 + RFAR) / (1 - RFAR); ZN = GD - GA;
  GF = 31 * ZN / HX;
  GY0 = YN - 31 * HY * SE / HX;
}
setCam(EL0);

// plan rows of the cross lines, so that on the panel their gap runs from 8.5 LED at the near edge to 4.5 at the far one
const CROSS = [];
{
  const sNear = GY0 + GF * HY * SE / (GD - HY * CE), sFar = GY0 - GF * HY * SE / (GD + HY * CE);
  const w = [];
  let sum = 0;
  for (let j = 0; j < NCROSS - 1; j++) { w.push(1 - 0.47 * (j / (NCROSS - 2))); sum += w[j]; }
  let acc = 0;
  CROSS.push(-HY);
  for (let j = 0; j < NCROSS - 2; j++) {
    acc += w[j];
    const sy = sNear - (sNear - sFar) * acc / sum;
    const u = (GY0 - sy) / GF;
    CROSS.push(u * GD / (SE - u * CE));
  }
  CROSS.push(HY);
}

let PX = 0, PY = 0, PS = 1;
function project(x, y, z) {
  const zc = GD + y * CE - z * SE;
  const k = GF / zc;
  PX = 32 + k * x;
  PY = GY0 - k * (y * SE + z * CE);
  PS = ZN / zc; // 1 at the near edge, 0.55 at the far one
}

// ---- the physics (world units, seconds)
const ZCAP = 2.0; // depth the sheet cannot sink below, in world units
const DEPTH0 = 0.90; // funnel depth per unit of Mass for one well of weight 1
const GS = 0.28; // pull of the sheet on a marble per unit of slope
const RTHROAT = 0.10; // inside this a marble is swallowed
const NM = 10; // marble slots
const TRN = 44, TRDT = 0.05; // trail samples and their spacing in seconds: a trail is 2.2 s long
const NW = 4;
// ripples a swallowed marble sends over the sheet: a ring wave 0.45 long that runs out at 0.7 a second
const RIPK = TP / 0.45, RIPC = 0.7, RIPW = 0.45, RIPMAX = 14;
// the heat the drag leaves in the sheet, on a 0.1 grid
const HNX = 21, HNY = 61, HCELL = 0.1;
const HEAT0 = 0.022; // heat that lights a line to about two thirds of the way to its warm colour

// the height field: sum of softened wells, capped smoothly at ZCAP
let FZ = 0, FGX = 0, FGY = 0, FP = 0;
function field(st, x, y) {
  let zr = 0, gx = 0, gy = 0, p = 0;
  for (let i = 0; i < NW; i++) {
    const A = st.wa[i];
    const dx = x - st.wx[i], dy = y - st.wy[i];
    if (A > 1e-5) {
      const q = dx * dx + dy * dy + st.we[i] * st.we[i];
      const ir = 1 / sqrt(q);
      zr -= A * ir;
      const k = A * ir / q;
      gx += k * dx; gy += k * dy;
    }
    if (st.wp[i] > 0.003) p += st.wp[i] * exp(-(dx * dx + dy * dy) / 0.18);
  }
  const th = tanh(zr / ZCAP);
  const s = 1 - th * th;
  FZ = ZCAP * th; FGX = gx * s; FGY = gy * s; FP = p;
}

// ripples only shiver the drawn sheet and light the lines along each ring; the marbles do not feel them
let RZ = 0, RS_ = 0;
function ripples(st, x, y) {
  let z = 0, sl = 0;
  const rp = st.rip;
  for (let i = 0; i < rp.length; i++) {
    const r = rp[i];
    const dx = x - r.x, dy = y - r.y;
    const d = sqrt(dx * dx + dy * dy) + 1e-6;
    const u = (d - RIPC * r.t) / RIPW;
    if (u > 2.6 || u < -2.6) continue;
    const E = exp(-u * u) * r.a * exp(-r.t / 2.0) / (1 + 1.4 * d);
    const ph = RIPK * (d - RIPC * r.t);
    z += E * cos(ph);
    sl += abs(E * RIPK * sin(ph)) + abs(2 * u / RIPW * E * cos(ph));
  }
  RZ = z; RS_ = sl;
}

// HSV with the brightness of each hue evened out
function hsvN(h, s, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = 1 - s, q = 1 - f * s, t = 1 - (1 - f) * s;
  let r = i === 0 || i === 5 ? 1 : i === 1 ? q : i === 4 ? t : p;
  let g = i === 1 || i === 2 ? 1 : i === 0 ? t : i === 3 ? q : p;
  let b = i === 3 || i === 4 ? 1 : i === 2 ? t : i === 5 ? q : p;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const k = min(pow(0.62 / lum, 0.35), 1 / max(r, g, b));
  out[0] = r * k; out[1] = g * k; out[2] = b * k;
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 56; i++) ph.push(rnd() * TP);
  const NV = max(NSX, NSY) + 2;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: rnd() * 400, ph,
    wx: new Float64Array(NW), wy: new Float64Array(NW), wa: new Float64Array(NW), we: new Float64Array(NW),
    ww: new Float64Array(NW), wp: new Float64Array(NW),
    // marbles
    mx: new Float64Array(NM), my: new Float64Array(NM), mvx: new Float64Array(NM), mvy: new Float64Array(NM),
    mage: new Float64Array(NM), mlife: new Float64Array(NM), mstate: new Int8Array(NM), mtimer: new Float64Array(NM),
    mstall: new Float64Array(NM), msz: new Float64Array(NM), mtr: new Float32Array(NM * TRN * 2),
    mtn: new Int32Array(NM), mtt: new Float64Array(NM),
    flashes: [], rip: [], heat: new Float32Array(HNX * HNY), heat2: new Float32Array(HNX * HNY),
    target: 7,
    buf: new Float32Array(W * H * 3),
    sc: new Float32Array(W * H), sca: new Float32Array(W * H),
    vx: new Float32Array(NV), vy: new Float32Array(NV), vh: new Float32Array(NV), vr: new Float32Array(NV), vg: new Float32Array(NV), vb: new Float32Array(NV),
  });
  for (let m = 0; m < NM; m++) { st.mstate[m] = 0; st.mtimer[m] = rnd() * 6; }
  return st;
}

// where the wells are at time t: three wander on slow Lissajous paths, a lighter fourth orbits the first
function setWells(st, t, k2, k3) {
  const p = st.ph;
  let x0 = 0.42 * sin(0.0937 * t + p[0]) + 0.18 * sin(0.2011 * t + p[1]);
  let y0 = 1.35 * sin(0.0653 * t + p[2]) + 0.60 * sin(0.1367 * t + p[3]);
  let x1 = 0.42 * sin(0.0811 * t + p[4]) + 0.16 * sin(0.1789 * t + p[5]);
  let y1 = 1.45 * sin(0.0557 * t + p[6]) + 0.55 * sin(0.1213 * t + p[7]);
  let x3 = 0.42 * sin(0.0709 * t + p[37]) + 0.17 * sin(0.1613 * t + p[38]);
  let y3 = 1.40 * sin(0.0491 * t + p[39]) + 0.55 * sin(0.1109 * t + p[40]);
  // the wells keep a little room between them
  const px = [x0, x1, x3], py = [y0, y1, y3];
  for (let a = 0; a < 3; a++) {
    for (let b = a + 1; b < 3; b++) {
      let dx = px[b] - px[a], dy = py[b] - py[a];
      const d = hypot(dx, dy) + 1e-6;
      if (d < 1.15) {
        const push = (1.15 - d) * 0.5;
        dx /= d; dy /= d;
        px[a] -= dx * push; py[a] -= dy * push; px[b] += dx * push; py[b] += dy * push;
      }
    }
  }
  x0 = px[0]; x1 = px[1]; x3 = px[2]; y0 = py[0]; y1 = py[1]; y3 = py[2];
  const R = 0.95 + 0.25 * sin(0.0911 * t + p[8]);
  const th = 0.21 * t + 0.8 * sin(0.0697 * t + p[9]) + p[10];
  const x2 = x0 + R * cos(th), y2 = y0 + R * sin(th) * 1.25;
  const sx = (v) => 0.62 * tanh(v / 0.62), sy = (v) => (HY - 0.75) * tanh(v / (HY - 0.75));
  st.wx[0] = sx(x0); st.wy[0] = sy(y0);
  st.wx[1] = sx(x1); st.wy[1] = sy(y1);
  st.wx[2] = sx(x2); st.wy[2] = sy(y2);
  st.wx[3] = sx(x3); st.wy[3] = sy(y3);
  // the count, 1 to 4: well 0 always, then wells 1, 2 and 3 each grow in over one step of Wells
  const nw = 1 + 1.5 * (k3 + 1);
  st.ww[0] = 1;
  st.ww[1] = sstep(0, 1, nw - 1);
  st.ww[2] = sstep(0, 1, nw - 2);
  st.ww[3] = sstep(0, 1, nw - 3);
  for (let i = 0; i < NW; i++) {
    // each mass swells and shrinks on its own clock, and the first is the heaviest
    const mass = (1.2 - 0.2 * i) * (1 + 0.32 * sin((0.0571 + 0.0113 * i) * t + p[41 + i]) + 0.14 * sin((0.1177 + 0.0071 * i) * t + p[45 + i]));
    st.we[i] = 0.25 * (0.88 + 0.12 * mass) * (1 + 0.16 * sin((0.0611 + 0.0083 * i) * t + p[49 + i]));
    const depth = DEPTH0 * k2 * mass * st.ww[i];
    st.wa[i] = depth * st.we[i];
  }
}

// a marble comes in from a random rim point, aimed at a well but off by a random angle
function spawn(st, m) {
  const per = 4 * HY + 4;
  let u = rnd() * per, x, y;
  if (u < 2 * HY) { x = -HX + 0.02; y = -HY + u; }
  else if (u < 4 * HY) { x = HX - 0.02; y = -HY + (u - 2 * HY); }
  else if (u < 4 * HY + 2) { y = HY - 0.02; x = -HX + (u - 4 * HY); }
  else { y = -HY + 0.02; x = -HX + (u - 4 * HY - 2); }
  // aim at one well, chosen by its weight
  let tot = 0;
  for (let i = 0; i < NW; i++) tot += st.ww[i];
  let r = rnd() * tot, w = 0;
  for (let i = 0; i < NW; i++) { r -= st.ww[i]; if (r <= 0) { w = i; break; } }
  let ax = st.wx[w] - x, ay = st.wy[w] - y;
  const al = hypot(ax, ay) + 1e-6;
  ax /= al; ay /= al;
  const off = (0.22 + rnd() * 0.95) * (rnd() < 0.5 ? -1 : 1);
  const c = cos(off), s = sin(off);
  field(st, x, y);
  const vesc = sqrt(max(0, -2 * GS * FZ));
  const v = cl(max(vesc * (0.35 + 0.6 * rnd()), 0.14 + 0.3 * rnd() * rnd()), 0.12, 0.6);
  st.mx[m] = x; st.my[m] = y;
  st.mvx[m] = (ax * c - ay * s) * v; st.mvy[m] = (ax * s + ay * c) * v;
  st.mage[m] = 0; st.mlife[m] = 38 + rnd() * 50; st.mstate[m] = 1; st.mstall[m] = 0;
  st.msz[m] = 0.85 + rnd() * 0.3;
  st.mtn[m] = 0; st.mtt[m] = 0;
}

function pushTrail(st, m) {
  const o = m * TRN * 2;
  const n = st.mtn[m];
  const tr = st.mtr;
  // newest sample first
  for (let j = min(n, TRN - 1); j > 0; j--) { tr[o + 2 * j] = tr[o + 2 * j - 2]; tr[o + 2 * j + 1] = tr[o + 2 * j - 1]; }
  tr[o] = st.mx[m]; tr[o + 1] = st.my[m];
  st.mtn[m] = min(n + 1, TRN);
}

function deposit(st, x, y, e) {
  const gx = (x + HX) / HCELL, gy = (y + HY) / HCELL;
  const i0 = floor(gx), j0 = floor(gy);
  if (i0 < 0 || j0 < 0 || i0 >= HNX - 1 || j0 >= HNY - 1) return;
  const fx = gx - i0, fy = gy - j0, hp = st.heat, o = j0 * HNX + i0;
  hp[o] += e * (1 - fx) * (1 - fy); hp[o + 1] += e * fx * (1 - fy);
  hp[o + HNX] += e * (1 - fx) * fy; hp[o + HNX + 1] += e * fx * fy;
}

// the heat spreads a little and cools in about three seconds
function diffuse(st, dt) {
  const a = st.heat, b = st.heat2;
  const cool = exp(-dt / 3.2), mix = 1 - exp(-dt / 0.35);
  for (let j = 0; j < HNY; j++) {
    for (let i = 0; i < HNX; i++) {
      const o = j * HNX + i, c = a[o];
      const l = i > 0 ? a[o - 1] : c, r = i < HNX - 1 ? a[o + 1] : c, u = j > 0 ? a[o - HNX] : c, d = j < HNY - 1 ? a[o + HNX] : c;
      const v = (c + (0.25 * (l + r + u + d) - c) * mix * 0.9) * cool;
      b[o] = v < 1e-5 ? 0 : v > 3 ? 3 : v;
    }
  }
  st.heat = b; st.heat2 = a;
}

function heatAt(st, x, y) {
  const gx = cl((x + HX) / HCELL, 0, HNX - 1.001), gy = cl((y + HY) / HCELL, 0, HNY - 1.001);
  const i0 = floor(gx), j0 = floor(gy), fx = gx - i0, fy = gy - j0, hp = st.heat, o = j0 * HNX + i0;
  return hp[o] * (1 - fx) * (1 - fy) + hp[o + 1] * fx * (1 - fy) + hp[o + HNX] * (1 - fx) * fy + hp[o + HNX + 1] * fx * fy;
}

function advance(st, dt) {
  st.t += dt;
  const t = st.t;
  const k2 = cl(st.ks[1], 0, 3), k3 = cl(st.ks[2], -1, 1), k4 = cl(st.ks[3], 0, 1);
  setWells(st, t, k2, k3);
  const gam = 2.0 * k4;
  st.target = 7.6 + 1.0 * sin(0.0431 * t + st.ph[30]) + 0.5 * sin(0.0977 * t + st.ph[31]);
  for (let i = 0; i < NW; i++) st.wp[i] *= exp(-dt / 4);
  const nsub = max(1, ceil(dt / 0.006)), h = dt / nsub;
  for (let m = 0; m < NM; m++) {
    const s = st.mstate[m];
    if (s === 1 || s === 2) {
      for (let q = 0; q < nsub; q++) {
        field(st, st.mx[m], st.my[m]);
        // the sheet grips a marble more where it is steep: none of the drag on the flat, all of it on a funnel wall
        const gp = gam * sstep(0.1, 0.7, hypot(FGX, FGY));
        const f = exp(-gp * h);
        let vx = (st.mvx[m] - GS * FGX * h) * f, vy = (st.mvy[m] - GS * FGY * h) * f;
        const sp = hypot(vx, vy);
        if (!(sp < 2.4)) { const k = 2.4 / (sp || 1); vx *= k; vy *= k; }
        if (!Number.isFinite(vx + vy)) { vx = 0; vy = 0; }
        st.mvx[m] = vx; st.mvy[m] = vy;
        st.mx[m] += vx * h; st.my[m] += vy * h;
        // what the drag takes from the marble warms the sheet under it
        if (gp > 0) deposit(st, st.mx[m], st.my[m], gp * (vx * vx + vy * vy) * h);
        if (s === 1) {
          // the throat takes a marble that comes inside it
          let hit = -1;
          for (let i = 0; i < NW; i++) {
            if (st.ww[i] < 0.3 || st.wa[i] < 1e-4) continue;
            const dx = st.mx[m] - st.wx[i], dy = st.my[m] - st.wy[i];
            if (dx * dx + dy * dy < RTHROAT * RTHROAT) { hit = i; break; }
          }
          if (hit >= 0) {
            st.mstate[m] = 3; st.mtimer[m] = 1.3;
            st.flashes.push({ w: hit, t: 0 });
            st.rip.push({ x: st.wx[hit], y: st.wy[hit], t: 0, a: 0.05 * (0.5 + 0.5 * k2 / 2) });
            if (st.rip.length > RIPMAX) st.rip.shift();
            st.wp[hit] = min(1.2, st.wp[hit] + 0.5);
            break;
          }
        }
      }
      if (st.mstate[m] === 3) continue;
      st.mage[m] += dt;
      st.mtt[m] += dt;
      if (st.mtt[m] >= TRDT) { st.mtt[m] -= TRDT; pushTrail(st, m); }
      const x = st.mx[m], y = st.my[m];
      if (!(abs(x) < HX + 0.05 && abs(y) < HY + 0.05)) {
        // out over the rim: the trail fades on its own
        st.mstate[m] = 3; st.mtimer[m] = 1.3;
        continue;
      }
      if (s === 1) {
        const sp = hypot(st.mvx[m], st.mvy[m]);
        st.mstall[m] = sp < 0.035 ? st.mstall[m] + dt : max(0, st.mstall[m] - dt);
        if (st.mage[m] > st.mlife[m] || st.mstall[m] > 2) { st.mstate[m] = 2; st.mtimer[m] = 1.4; }
      } else {
        st.mtimer[m] -= dt;
        if (st.mtimer[m] <= 0) { st.mstate[m] = 3; st.mtimer[m] = 0.9; }
      }
    } else if (s === 3) {
      st.mtimer[m] -= dt;
      if (st.mtimer[m] <= 0) { st.mstate[m] = 0; st.mtimer[m] = 0.05 + rnd() * 0.5; }
    } else {
      st.mtimer[m] -= dt;
      if (st.mtimer[m] <= 0 && m < st.target) spawn(st, m);
    }
  }
  diffuse(st, dt);
  for (let i = st.rip.length - 1; i >= 0; i--) {
    st.rip[i].t += dt;
    if (st.rip[i].t > 4.5) st.rip.splice(i, 1);
  }
  for (let i = st.flashes.length - 1; i >= 0; i--) {
    st.flashes[i].t += dt;
    if (st.flashes[i].t > 1.2) st.flashes.splice(i, 1);
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.1);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // the sheet has been running a while when the picture opens
    for (let n = 0; n < 900; n++) advance(st, 1 / 30);
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
    advance(st, dt);
  }
}

// one grid segment: anti-aliased, about 1.9 LED wide, the larger of what is there and what it adds
function seg(buf, x0, y0, x1, y1, r0, g0, b0, r1, g1, b1, hw) {
  const ex = x1 - x0, ey = y1 - y0;
  const l2 = ex * ex + ey * ey + 1e-9;
  const xa = max(0, floor(min(x0, x1) - hw - 0.5)), xb = min(W - 1, ceil(max(x0, x1) + hw + 0.5));
  const ya = max(0, floor(min(y0, y1) - hw - 0.5)), yb = min(H - 1, ceil(max(y0, y1) + hw + 0.5));
  for (let py = ya; py <= yb; py++) {
    for (let px = xa; px <= xb; px++) {
      const cx = px + 0.5 - x0, cy = py + 0.5 - y0;
      const t = cl((cx * ex + cy * ey) / l2, 0, 1);
      const dx = cx - t * ex, dy = cy - t * ey;
      const cov = cl(hw + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
      if (cov <= 0) continue;
      const q = (py * W + px) * 3;
      const r = (r0 + (r1 - r0) * t) * cov, g = (g0 + (g1 - g0) * t) * cov, b = (b0 + (b1 - b0) * t) * cov;
      if (r > buf[q]) buf[q] = r;
      if (g > buf[q + 1]) buf[q + 1] = g;
      if (b > buf[q + 2]) buf[q + 2] = b;
    }
  }
}

const VC = [0, 0, 0];
function vertex(st, i, x, y, hue0) {
  field(st, x, y);
  ripples(st, x, y);
  project(x, y, FZ + RZ);
  st.vx[i] = PX; st.vy[i] = PY;
  const slope = hypot(FGX, FGY) + RS_;
  const g = 1 - exp(-pow(slope / 0.9, 1.7));
  const q = (y + HY) / (2 * HY);
  const fade = 1 - 0.55 * pow(q, 0.8);
  const pl = min(1, FP);
  const br = fade * (0.50 + 0.50 * g) + 0.40 * pl;
  st.vh[i] = 0.95 - 0.17 * q;
  hsvN(hue0 - 0.20 * g, cl(0.92 - 0.25 * g - 0.3 * pl, 0.15, 1), VC);
  // yellows and greens need more light than blues to stay clean rather than olive
  const hh = hue0 - 0.20 * g - floor(hue0 - 0.20 * g), yl = (hh - 0.17) / 0.13;
  const k = 232 * br * (1 + 0.6 * exp(-yl * yl));
  // sheet that the drag has warmed glows toward amber
  const hv = 1 - exp(-heatAt(st, x, y) / HEAT0);
  const kw = 200 * fade * hv * sstep(0.12, 0.45, hv);
  st.vr[i] = VC[0] * k + TH[0] * kw;
  st.vg[i] = VC[1] * k + TH[1] * kw;
  st.vb[i] = VC[2] * k + TH[2] * kw;
}

function drawLine(st, buf, n) {
  for (let i = 0; i < n; i++) {
    seg(buf, st.vx[i], st.vy[i], st.vx[i + 1], st.vy[i + 1], st.vr[i], st.vg[i], st.vb[i], st.vr[i + 1], st.vg[i + 1], st.vb[i + 1], 0.5 * (st.vh[i] + st.vh[i + 1]));
  }
}

function addPx(buf, px, py, r, g, b) {
  if (px < 0 || px >= W || py < 0 || py >= H) return;
  const q = (py * W + px) * 3;
  buf[q] += r; buf[q + 1] += g; buf[q + 2] += b;
}

const TC = [0, 0, 0], TH = [0, 0, 0], TW = [0, 0, 0];

function drawTrail(st, buf, m, fade) {
  const n = st.mtn[m];
  if (n < 1 || fade <= 0.01) return;
  const sc = st.sc, sca = st.sca;
  // gather the screen points: the marble's own place first, then the samples
  const o = m * TRN * 2;
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  const pts = st.tpts || (st.tpts = new Float64Array((TRN + 2) * 3));
  let np = 0;
  const live = st.mstate[m] === 1 || st.mstate[m] === 2;
  if (live) {
    field(st, st.mx[m], st.my[m]); ripples(st, st.mx[m], st.my[m]); project(st.mx[m], st.my[m], FZ + RZ + 0.02);
    pts[0] = PX; pts[1] = PY; pts[2] = PS; np = 1;
  }
  for (let j = 0; j < n; j++) {
    const x = st.mtr[o + 2 * j], y = st.mtr[o + 2 * j + 1];
    field(st, x, y); ripples(st, x, y); project(x, y, FZ + RZ + 0.02);
    pts[3 * np] = PX; pts[3 * np + 1] = PY; pts[3 * np + 2] = PS; np++;
  }
  for (let j = 0; j < np; j++) {
    minx = min(minx, pts[3 * j]); maxx = max(maxx, pts[3 * j]);
    miny = min(miny, pts[3 * j + 1]); maxy = max(maxy, pts[3 * j + 1]);
  }
  const xa = max(0, floor(minx - 3)), xb = min(W - 1, ceil(maxx + 3)), ya = max(0, floor(miny - 3)), yb = min(H - 1, ceil(maxy + 3));
  if (xb < xa || yb < ya) return;
  for (let py = ya; py <= yb; py++) for (let px = xa; px <= xb; px++) { sc[py * W + px] = 0; sca[py * W + px] = 0; }
  for (let j = 0; j < np - 1; j++) {
    const x0 = pts[3 * j], y0 = pts[3 * j + 1], x1 = pts[3 * j + 3], y1 = pts[3 * j + 4];
    const a0 = 1 - j / (np - 1), a1 = 1 - (j + 1) / (np - 1);
    const ex = x1 - x0, ey = y1 - y0, l2 = ex * ex + ey * ey + 1e-9;
    const hw = 0.85 * (0.75 + 0.25 * pts[3 * j + 2]);
    const sx0 = max(xa, floor(min(x0, x1) - hw - 1)), sx1 = min(xb, ceil(max(x0, x1) + hw + 1));
    const sy0 = max(ya, floor(min(y0, y1) - hw - 1)), sy1 = min(yb, ceil(max(y0, y1) + hw + 1));
    for (let py = sy0; py <= sy1; py++) {
      for (let px = sx0; px <= sx1; px++) {
        const cx = px + 0.5 - x0, cy = py + 0.5 - y0;
        const t = cl((cx * ex + cy * ey) / l2, 0, 1);
        const dx = cx - t * ex, dy = cy - t * ey;
        const cov = cl(hw + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
        if (cov <= 0) continue;
        const a = a0 + (a1 - a0) * t;
        const v = cov * pow(a, 1.4);
        const q = py * W + px;
        if (v > sc[q]) { sc[q] = v; sca[q] = a; }
      }
    }
  }
  for (let py = ya; py <= yb; py++) {
    for (let px = xa; px <= xb; px++) {
      const q = py * W + px;
      // a thin tail is cut so it never ends as a dark brown smear
      const v = sc[q] * fade * sstep(0.09, 0.26, sc[q] * fade);
      if (v < 0.02) continue;
      // hot near the marble, deeper amber down the tail
      const a = sca[q];
      const k = 255 * v;
      addPx(buf, px, py, (TH[0] * a + TC[0] * (1 - a)) * k, (TH[1] * a + TC[1] * (1 - a)) * k, (TH[2] * a + TC[2] * (1 - a)) * k);
    }
  }
}

function drawBead(buf, sx, sy, sc, alpha) {
  const rc = 1.1 + 0.7 * sc;
  const R = 8;
  const xa = max(0, floor(sx - R)), xb = min(W - 1, ceil(sx + R)), ya = max(0, floor(sy - R)), yb = min(H - 1, ceil(sy + R));
  for (let py = ya; py <= yb; py++) {
    for (let px = xa; px <= xb; px++) {
      const dx = px + 0.5 - sx, dy = py + 0.5 - sy;
      const d2 = dx * dx + dy * dy;
      const d = sqrt(d2);
      const core = cl(rc + 0.5 - d, 0, 1);
      // the halo's tail is cut before it goes dark enough to look brown
      const halo = max(0, 0.55 * exp(-d2 / (2 * 2.6 * 2.6)) - 0.07);
      // the core is nearly white, the halo pale amber
      const r = (TW[0] * core * 0.95 + TH[0] * halo * 0.9) * 255 * alpha;
      const g = (TW[1] * core * 0.95 + TH[1] * halo * 0.9) * 255 * alpha;
      const b = (TW[2] * core * 0.95 + TH[2] * halo * 0.9) * 255 * alpha;
      addPx(buf, px, py, r, g, b);
    }
  }
}

function drawFlash(buf, sx, sy, sc, t) {
  const age = t / 1.2;
  const ring = 1.2 + 9 * (1 - exp(-t * 4.5));
  const inten = exp(-t / 0.32);
  const R = ceil(ring + 4);
  const xa = max(0, floor(sx - R)), xb = min(W - 1, ceil(sx + R)), ya = max(0, floor(sy - R)), yb = min(H - 1, ceil(sy + R));
  for (let py = ya; py <= yb; py++) {
    for (let px = xa; px <= xb; px++) {
      const dx = px + 0.5 - sx, dy = (py + 0.5 - sy) * 1.5;
      const d = sqrt(dx * dx + dy * dy);
      const rg = exp(-((d - ring) * (d - ring)) / 2.2) * 0.8 * inten;
      const gl = exp(-d * d / 4) * 0.8 * exp(-t / 0.15);
      const v = (rg + gl) * (1 - age * 0.4);
      if (v < 0.01) continue;
      addPx(buf, px, py, TW[0] * v * 255, TW[1] * v * 255, TW[2] * v * 255);
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st || !st.init) return;
  const buf = st.buf;
  buf.fill(0);
  const t = st.t;
  // the camera tips a few degrees and the two colours drift, each on its own clock
  setCam(EL0 + 0.05 * sin(0.0371 * t + st.ph[32]) + 0.03 * sin(0.0911 * t + st.ph[33]));
  const hue0 = 0.775 + fin(st.ks[0], 0) + 0.045 * sin(0.0431 * t + st.ph[34]) + 0.02 * sin(0.1117 * t + st.ph[35]);
  const hueB = hue0 - 0.62 + 0.03 * sin(0.0677 * t + st.ph[36]);
  hsvN(hueB, 0.80, TH); // amber: halo and trail
  hsvN(hueB - 0.20, 0.85, TC); // rose: the tail of a trail, which dims to mauve rather than brown
  hsvN(hueB + 0.02, 0.28, TW); // warm white: bead core and flashes

  // the grid: lines up the sheet, then lines across it
  for (let i = 0; i <= NCX; i++) {
    const x = -HX + i * CELLX;
    for (let j = 0; j <= NSY; j++) vertex(st, j, x, -HY + j * (2 * HY / NSY), hue0);
    drawLine(st, buf, NSY);
  }
  for (let i = 0; i < NCROSS; i++) {
    const y = CROSS[i];
    for (let j = 0; j <= NSX; j++) vertex(st, j, -HX + j * (2 * HX / NSX), y, hue0);
    drawLine(st, buf, NSX);
  }

  // trails, then the marbles on top
  for (let m = 0; m < NM; m++) {
    const s = st.mstate[m];
    if (s === 0) continue;
    const fade = s === 1 ? 1 : s === 2 ? cl(st.mtimer[m] / 1.2, 0, 1) : cl(st.mtimer[m] / 1.3, 0, 1);
    drawTrail(st, buf, m, fade);
  }
  for (let m = 0; m < NM; m++) {
    const s = st.mstate[m];
    if (s !== 1 && s !== 2) continue;
    const a = min(1, st.mage[m] / 0.7) * (s === 2 ? cl(st.mtimer[m] / 1.2, 0, 1) : 1);
    field(st, st.mx[m], st.my[m]);
    ripples(st, st.mx[m], st.my[m]);
    project(st.mx[m], st.my[m], FZ + RZ + 0.02);
    drawBead(buf, PX, PY, PS * st.msz[m], a);
  }
  for (const fl of st.flashes) {
    const i = fl.w;
    field(st, st.wx[i], st.wy[i]);
    project(st.wx[i], st.wy[i], FZ + 0.01);
    drawFlash(buf, PX, PY, PS, fl.t);
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      display.setPixel(x, y, knee(buf[q]), knee(buf[q + 1]), knee(buf[q + 2]));
    }
  }
}

// bright overlaps roll off instead of clipping flat
function knee(c) {
  if (!(c > 0)) return 0;
  if (c < 190) return floor(c + 0.5);
  return floor(190 + 65 * (1 - exp(-(c - 190) / 65)) + 0.5);
}
