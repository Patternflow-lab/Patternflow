// ===== Patternflow pattern =====
// Title:   Mirror Ball
// Family:  mirrorball
// Idea:    The panel is the wall of a dark room and a ball of square mirror tiles hangs in front of it, turning in two spotlights, so every tile in the light throws back one soft square spot that slides along sweeping arcs, crowds where the ball turns edge-on to the beam, and winks in and out as its tile turns toward and away from the lamp.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the mirror ball of the 1920s dance halls, the law of reflection R = L - 2 (L.n) n traced tile by tile, and each tile's footprint cast along its reflected ray onto the wall plane, the way a ray tracer casts a beam; pattern round 208
// Round:   208
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spin=0..3, Tile=-1..1, Tilt=-0.3..1
//
// Knob 1: Hue. The tint of the second spotlight; the first lamp stays a warm white. At 0 the second is a pale sky blue, and turning the wheel takes it through violet, rose, amber and green and back to blue at 1. Where a warm spot and a tinted one overlap on the wall the two lights add and the colours mix.
// Knob 2: Spin. How fast the ball turns: 0.1 rad/s at the opening 2, a turn in 65 seconds, with the middle spot sliding about 8 LEDs a second and the quickest 12. The speed breathes round that by up to a third on periods that do not divide. At 0 the ball stops and the spots stand where they are, creeping only as the two lamps wander; at 3 the middle spot runs about 12 LEDs a second.
// Knob 3: Tile. The size of one mirror tile on the ball, from 2.8 LEDs at -1, a ball of about 1200 tiles and a fine glitter, through 3.7 at the opening 0, about 730 tiles and spots 4 to 5 LEDs across, to 6.2 at 1, 250 tiles and fewer, larger spots that each show their own parallelogram.
// Knob 4: Tilt. How far the ball's axis leans from the vertical, from 2 degrees at -0.3, where it hangs straight and the spots run in level rows, through 20 degrees at the opening 0.06, where the rows bend into arcs, to 69 degrees at 1 and steep sweeping curves. The lean direction wanders a little as the ball swings on its cord.

const W = 64;
const H = 128;
const { sin, cos, sqrt, exp, floor, max, min, abs, PI, atan2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const RB = 28; // radius of the ball, in LEDs
const NMAX = 1800; // most tiles
const GROUT = 0.86; // the mirror's share of a tile pitch
const WALL_MIN = 0.45; // a reflected ray flatter than this to the wall is not thrown (about 72 degrees)
const T0 = 9; // the lamps and the cord have been moving this long when the Lab starts
const SPIN0 = 0.048; // rad/s for each unit of Spin: a turn in 65 s at the opening 2
const HALO = 0.1;
const AMBIENT = 0.007;

// ---- colour ----
// OKLCH to linear sRGB, then scaled so the brightest channel is 1.
function tint(hueTurns, L, C, out) {
  const h = hueTurns * TAU;
  const a = C * cos(h);
  const b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  r = max(r, 0);
  g = max(g, 0);
  bl = max(bl, 0);
  const k = 1 / max(r, g, bl, 1e-6);
  out[0] = r * k;
  out[1] = g * k;
  out[2] = bl * k;
}

// encode: linear light, soft knee above 0.6, then 1/2.2
const NLUT = 2048;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * Math.pow(y, 0.45));
}

// ---- the ball: rings of tiles, each a centre normal and two tangents ----
const JIT = 0.055; // radians across the full range of a tile's lean
function hash(i) {
  const h = sin(i * 12.9898 + 4.1414) * 43758.5453;
  return h - floor(h);
}
function Ball() {
  this.n = 0;
  this.nx = new Float32Array(NMAX);
  this.ny = new Float32Array(NMAX);
  this.nz = new Float32Array(NMAX);
  this.ex = new Float32Array(NMAX); // east tangent
  this.ey = new Float32Array(NMAX);
  this.ez = new Float32Array(NMAX);
  this.sx = new Float32Array(NMAX); // south tangent
  this.sy = new Float32Array(NMAX);
  this.sz = new Float32Array(NMAX);
  this.hw = new Float32Array(NMAX); // half width of the mirror along east
  this.hh = new Float32Array(NMAX); // half height along south
  this.rf = new Float32Array(NMAX); // how well this tile mirrors
  this.size = 0;
}
function build(ball, size) {
  const rings = max(5, Math.round((PI * RB) / size));
  const pitchLat = (PI * RB) / rings;
  let k = 0;
  for (let i = 0; i < rings; i++) {
    const phi = (PI * (i + 0.5)) / rings;
    const sp = sin(phi);
    const cp = cos(phi);
    const per = max(3, Math.round((TAU * RB * sp) / size));
    const pitchLon = (TAU * RB * sp) / per;
    for (let j = 0; j < per; j++) {
      if (k >= NMAX) break;
      const lam = (TAU * (j + 0.5 * (i & 1))) / per;
      const cl_ = cos(lam);
      const sl = sin(lam);
      // each tile is glued a little off true: a lean of up to about 1.5 degrees along each way
      const ja = JIT * (hash(k * 2 + 1) - 0.5);
      const jb = JIT * (hash(k * 2 + 2) - 0.5);
      const ex = -sl;
      const ez = cl_;
      const sx = cp * cl_;
      const sy = -sp;
      const sz = cp * sl;
      let nx = sp * cl_ + ja * ex + jb * sx;
      let ny = cp + jb * sy;
      let nz = sp * sl + ja * ez + jb * sz;
      const nk = 1 / sqrt(nx * nx + ny * ny + nz * nz);
      nx *= nk;
      ny *= nk;
      nz *= nk;
      ball.nx[k] = nx;
      ball.ny[k] = ny;
      ball.nz[k] = nz;
      ball.ex[k] = ex;
      ball.ey[k] = 0;
      ball.ez[k] = ez;
      ball.sx[k] = sx;
      ball.sy[k] = sy;
      ball.sz[k] = sz;
      ball.hw[k] = 0.5 * GROUT * pitchLon;
      ball.hh[k] = 0.5 * GROUT * pitchLat;
      ball.rf[k] = 0.4 + 0.6 * hash(k * 3 + 7);
      k++;
    }
  }
  ball.n = k;
  ball.size = size;
}

export function setup(params) {
  const ball = new Ball();
  build(ball, 3.7);
  params.s = {
    t: T0,
    ang: 0.4, // how far the ball has turned about its own axis
    hue: 0.6,
    spin: 1,
    size: 3.7,
    tilt: 0.35,
    ball,
    m: new Float32Array(9), // ball to world
    bx: 32,
    by: 44,
    bh: 56, // the ball's foot on the wall, and its height off the wall
    L: new Float32Array(6), // the two light directions (from the lamp to the ball)
    col: new Float32Array(6), // and their colours
    ci: [new Float32Array(2), new Float32Array(2)], // where each lamp's own beam would land
    acc: new Float32Array(W * H * 3),
    tmp: [0, 0, 0],
  };
  pose(params.s);
}

// the lamps, the cord and the axis at the state's clock
function pose(S) {
  const t = S.t;
  S.bx = 32 + 6 * sin(0.0311 * t + 1.1) + 3 * sin(0.0773 * t + 0.4);
  S.by = 62 + 9 * sin(0.0257 * t + 2.0) + 3 * sin(0.0619 * t);
  S.bh = 54 + 5 * sin(0.0211 * t + 0.5);
  // lamp 1, warm white, from high on the left; lamp 2, tinted, from low on the right. Each is a
  // direction (travelling from the lamp to the ball) at an angle off the wall's normal and an
  // azimuth round it, and both wander on periods that share no divisor
  const l = S.L;
  const DEG = PI / 180;
  const a1 = (74 + 8 * sin(0.0613 * t + 2.1) + 3 * sin(0.1393 * t)) * DEG;
  const f1 = (25 + 80 * sin(0.0431 * t + 0.9) + 16 * sin(0.1187 * t)) * DEG;
  const a2 = (72 + 8 * sin(0.0359 * t + 0.4) + 3 * sin(0.1217 * t + 2)) * DEG;
  const f2 = f1 + (150 + 42 * sin(0.0517 * t + 2.4) + 12 * sin(0.0971 * t + 1)) * DEG;
  l[0] = sin(a1) * cos(f1);
  l[1] = sin(a1) * sin(f1);
  l[2] = -cos(a1);
  l[3] = sin(a2) * cos(f2);
  l[4] = sin(a2) * sin(f2);
  l[5] = -cos(a2);
  for (let i = 0; i < 2; i++) {
    // the scatter's centre: toward the lamp's far side of the ball, kept near the panel
    const lx = l[3 * i];
    const ly = l[3 * i + 1];
    const ll = sqrt(lx * lx + ly * ly) + 1e-6;
    const reach = min(ll * S.bh / -l[3 * i + 2], 40);
    S.ci[i][0] = S.bx + (lx / ll) * reach;
    S.ci[i][1] = S.by + (ly / ll) * reach;
  }
  // the ball's matrix: spin about its pole, then lean the pole over by the tilt
  const th = S.ang;
  const cs = cos(th);
  const sn = sin(th);
  const lean = S.tilt; // radians off the vertical, 2 to 70 degrees
  const psi = 0.6 + 0.55 * sin(0.0173 * t + 0.3) + 0.2 * sin(0.0539 * t + 1.7);
  // lean axis: in the plane of the wall, at azimuth psi
  const ax = cos(psi);
  const ay = sin(psi);
  const c = cos(lean);
  const s = sin(lean);
  const m = S.m;
  // Rodrigues about (ax, ay, 0) by `lean`, times spin about y
  const r00 = c + ax * ax * (1 - c);
  const r01 = ax * ay * (1 - c);
  const r02 = ay * s;
  const r10 = ax * ay * (1 - c);
  const r11 = c + ay * ay * (1 - c);
  const r12 = -ax * s;
  const r20 = -ay * s;
  const r21 = ax * s;
  const r22 = c;
  // spin about y: x' = cs x + sn z, y' = y, z' = -sn x + cs z
  m[0] = r00 * cs - r02 * sn;
  m[1] = r01;
  m[2] = r00 * sn + r02 * cs;
  m[3] = r10 * cs - r12 * sn;
  m[4] = r11;
  m[5] = r10 * sn + r12 * cs;
  m[6] = r20 * cs - r22 * sn;
  m[7] = r21;
  m[8] = r20 * sn + r22 * cs;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.spin = cl(kn[1], 0, 3);
  S.tilt = cl(0.3 + 0.9 * cl(kn[3], -0.3, 1), 0, 1.22);
  const k3 = cl(kn[2], -1, 1);
  const size = k3 < 0 ? 3.7 + 0.9 * k3 : 3.7 + 2.5 * k3;
  if (abs(size - S.size) > 0.03) {
    build(S.ball, size);
    S.size = size;
  }
  S.t += d;
  // the ball breathes round its set speed on two periods that do not divide
  const t = S.t;
  const breath = 1 + 0.22 * sin(0.113 * t + 0.6) + 0.12 * sin(0.0471 * t + 2.2) + 0.06 * sin(0.2731 * t);
  S.ang += d * SPIN0 * S.spin * breath;
  if (S.ang > 1e4) S.ang -= TAU * floor(S.ang / TAU);
  pose(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc;
  const tmp = S.tmp;
  const L = S.L;
  const ball = S.ball;
  const m = S.m;
  const bx = S.bx;
  const by = S.by;
  const bh = S.bh;

  // the colours of the two lamps, in linear light
  const col = S.col;
  col[0] = 0.92;
  col[1] = 0.77;
  col[2] = 0.57;
  tint((245 / 360 + S.hue) % 1, 0.8, 0.12, tmp);
  col[3] = tmp[0];
  col[4] = tmp[1];
  col[5] = tmp[2];

  // ambient: a faint fan of scatter round the point each lamp's own beam would reach
  const sig = 30;
  const inv2 = 1 / (2 * sig * sig);
  const c0x = S.ci[0][0];
  const c0y = S.ci[0][1];
  const c1x = S.ci[1][0];
  const c1y = S.ci[1][1];
  let o = 0;
  for (let y = 0; y < H; y++) {
    const wy = y + 0.5;
    const d0y = (wy - c0y) * (wy - c0y);
    const d1y = (wy - c1y) * (wy - c1y);
    for (let x = 0; x < W; x++) {
      const wx = x + 0.5;
      const g0 = AMBIENT * exp(-((wx - c0x) * (wx - c0x) + d0y) * inv2);
      const g1 = AMBIENT * exp(-((wx - c1x) * (wx - c1x) + d1y) * inv2);
      acc[o] = g0 * col[0] + g1 * col[3];
      acc[o + 1] = g0 * col[1] + g1 * col[4];
      acc[o + 2] = g0 * col[2] + g1 * col[5];
      o += 3;
    }
  }

  // the tiles
  const px = [0, 0, 0, 0];
  const py = [0, 0, 0, 0];
  const nxs = [0, 0, 0, 0];
  const nys = [0, 0, 0, 0];
  const dd = [0, 0, 0, 0];
  const cs4 = [-1, 1, 1, -1];
  const cs5 = [-1, -1, 1, 1];
  const n = ball.n;
  for (let k = 0; k < n; k++) {
    // tile frame in the room
    const x0 = ball.nx[k];
    const y0 = ball.ny[k];
    const z0 = ball.nz[k];
    const nx = m[0] * x0 + m[1] * y0 + m[2] * z0;
    const ny = m[3] * x0 + m[4] * y0 + m[5] * z0;
    const nh = m[6] * x0 + m[7] * y0 + m[8] * z0;
    const exx = ball.ex[k];
    const eyy = ball.ey[k];
    const ezz = ball.ez[k];
    const ex = (m[0] * exx + m[1] * eyy + m[2] * ezz) * ball.hw[k];
    const ey = (m[3] * exx + m[4] * eyy + m[5] * ezz) * ball.hw[k];
    const eh = (m[6] * exx + m[7] * eyy + m[8] * ezz) * ball.hw[k];
    const sxx = ball.sx[k];
    const syy = ball.sy[k];
    const szz = ball.sz[k];
    const sx = (m[0] * sxx + m[1] * syy + m[2] * szz) * ball.hh[k];
    const sy = (m[3] * sxx + m[4] * syy + m[5] * szz) * ball.hh[k];
    const sh = (m[6] * sxx + m[7] * syy + m[8] * szz) * ball.hh[k];
    // the tile's centre, in the room (x, y across the wall, h off it)
    const cx = bx + RB * nx;
    const cy = by + RB * ny;
    const chh = bh + RB * nh;
    for (let li = 0; li < 2; li++) {
      const lx = L[3 * li];
      const ly = L[3 * li + 1];
      const lh = L[3 * li + 2];
      const d = -(lx * nx + ly * ny + lh * nh); // how squarely the lamp faces this tile
      if (d < 0.03) continue;
      // reflected ray R = L + 2 d n
      const rx = lx + 2 * d * nx;
      const ry = ly + 2 * d * ny;
      const rh = lh + 2 * d * nh;
      if (-rh < WALL_MIN) continue;
      const w = 1 / -rh;
      // the four corners of the mirror, each cast along R onto the wall
      let minx = 1e9;
      let maxx = -1e9;
      let miny = 1e9;
      let maxy = -1e9;
      let mx = 0;
      let my = 0;
      for (let q = 0; q < 4; q++) {
        const a = cs4[q];
        const b = cs5[q];
        const qh = chh + a * eh + b * sh;
        const t = qh * w;
        const qx = cx + a * ex + b * sx + rx * t;
        const qy = cy + a * ey + b * sy + ry * t;
        px[q] = qx;
        py[q] = qy;
        mx += qx;
        my += qy;
        if (qx < minx) minx = qx;
        if (qx > maxx) maxx = qx;
        if (qy < miny) miny = qy;
        if (qy > maxy) maxy = qy;
      }
      mx *= 0.25;
      my *= 0.25;
      const path = chh * w;
      const grow = 0.5 + 0.003 * path;
      const soft = 0.5 + 0.004 * path;
      const hr = 1.3 + 0.01 * path;
      const reach = grow + soft + 3 * hr;
      if (maxx + reach < 0 || minx - reach > W || maxy + reach < 0 || miny - reach > H) continue;
      // brightness: the lamp's share on this tile, the beam thinning as it flattens to the wall, and the throw
      const lit = sm(0.1, 0.45, d);
      const inten = 1.5 * ball.rf[k] * lit * sqrt(d) * Math.pow(-rh, 0.6) * Math.pow(54 / path, 0.55);
      if (inten < 0.02) continue;
      // half planes: outward unit normals and offsets of the four edges
      let rmax = 0;
      for (let q = 0; q < 4; q++) {
        const ax = px[q] - mx;
        const ay = py[q] - my;
        const rr = ax * ax + ay * ay;
        if (rr > rmax) rmax = rr;
      }
      rmax = sqrt(rmax) + grow + 0.4;
      // a footprint stretched into a streak is let go: aspect from the two edge vectors
      const ux1 = px[1] - px[0];
      const uy1 = py[1] - py[0];
      const vx1 = px[3] - px[0];
      const vy1 = py[3] - py[0];
      const g11 = ux1 * ux1 + uy1 * uy1;
      const g22 = vx1 * vx1 + vy1 * vy1;
      const g12 = ux1 * vx1 + uy1 * vy1;
      const tr = 0.5 * (g11 + g22);
      const df = sqrt(max(0, tr * tr - (g11 * g22 - g12 * g12)));
      const l1 = sqrt(tr + df) + 2 * grow;
      const l2 = sqrt(max(0, tr - df)) + 2 * grow;
      const keep = sm(3.2, 1.8, l1 / l2) * sm(2.4, 3.0, l2);
      if (keep * inten < 0.06) continue;
      for (let q = 0; q < 4; q++) {
        const q2 = (q + 1) & 3;
        let ux = px[q2] - px[q];
        let uy = py[q2] - py[q];
        const len = sqrt(ux * ux + uy * uy);
        if (len < 1e-4) {
          nxs[q] = 0;
          nys[q] = 0;
          dd[q] = 0;
          continue;
        }
        ux /= len;
        uy /= len;
        let qx = uy;
        let qy = -ux;
        if (qx * (mx - px[q]) + qy * (my - py[q]) > 0) {
          qx = -qx;
          qy = -qy;
        }
        nxs[q] = qx;
        nys[q] = qy;
        dd[q] = qx * px[q] + qy * py[q];
      }
      if (S.trace) S.trace.push(k, li, mx, my);
      const x1 = max(0, floor(minx - reach));
      const x2 = min(W - 1, floor(maxx + reach));
      const y1 = max(0, floor(miny - reach));
      const y2 = min(H - 1, floor(maxy + reach));
      const cr = col[3 * li] * inten * keep;
      const cg = col[3 * li + 1] * inten * keep;
      const cb = col[3 * li + 2] * inten * keep;
      const hlim = 3 * hr;
      const e0 = grow - soft;
      const e1 = grow + soft;
      for (let y = y1; y <= y2; y++) {
        const qy = y + 0.5;
        for (let x = x1; x <= x2; x++) {
          const qx = x + 0.5;
          let sd = nxs[0] * qx + nys[0] * qy - dd[0];
          const s1 = nxs[1] * qx + nys[1] * qy - dd[1];
          const s2 = nxs[2] * qx + nys[2] * qy - dd[2];
          const s3 = nxs[3] * qx + nys[3] * qy - dd[3];
          if (s1 > sd) sd = s1;
          if (s2 > sd) sd = s2;
          if (s3 > sd) sd = s3;
          const rx_ = qx - mx;
          const ry_ = qy - my;
          const cap = sqrt(rx_ * rx_ + ry_ * ry_) - rmax;
          if (cap > sd) sd = cap;
          let v = 0;
          if (sd < e1) {
            v = sd <= e0 ? 1 : (e1 - sd) / (e1 - e0);
            v = v * v * (3 - 2 * v);
          }
          if (sd > 0 && sd < hlim) {
            const u = sd / hr;
            const f = 1 - sd / hlim;
            v += (HALO * f * f) / (1 + u * u);
          }
          if (v > 0) {
            const i = (y * W + x) * 3;
            acc[i] += cr * v;
            acc[i + 1] += cg * v;
            acc[i + 2] += cb * v;
          }
        }
      }
    }
  }

  // out
  const sc = NLUT / 2.5;
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ENC[min(NLUT, (acc[i] * sc) | 0)];
      const g = ENC[min(NLUT, (acc[i + 1] * sc) | 0)];
      const b = ENC[min(NLUT, (acc[i + 2] * sc) | 0)];
      display.setPixel(x, y, r, g, b);
      i += 3;
    }
  }
}
