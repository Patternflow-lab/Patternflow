// ===== Patternflow pattern =====
// Title:   Tensegrity
// Family:  physics
// Idea:    A tower of struts that never touch one another stands the height of the panel, held up by a net of cables in tension and turning slowly, and a weight on its top squeezes it shorter and twists it, because in a tensegrity compression and twist come together.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: tensegrity (Kenneth Snelson, 1948; named by R. Buckminster Fuller), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Struts=3..6, Load=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together: at 0 the struts run from aqua at the foot to blue at the top, the cables are a dim pink and the weight is pale stone.
// Knob 2: Speed. How fast the tower turns and how fast its own time runs: at 2 one turn in 16 seconds, at 0.2 one in 160 seconds with a plucked cable swinging in slow motion, at 3 one in 11 seconds.
// Knob 3: Struts. Struts per stage, 3 to 6, five stages each time: 15 struts and 93 cables at 3, 30 and 186 at 6. Turning it builds the new tower and settles it before the next frame, which costs up to 7 ms.
// Knob 4: Load. A weight on a guide up the axis, pressing on the top: 0 to 700 units, 42 at the start, which leaves the tower 1% shorter and its top turned 5.5 degrees. At 1 the 3-strut tower is 17% shorter and its top has turned 74 degrees further round; the 6-strut one 16% and 92.5 degrees.
// Buttons: K1 tap plucks one of the longer cables on the near side: it swings as a string for two seconds at a pitch set by its tension, and if the tower is still its two ends are kicked so the whole tower shivers.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, abs, atan2, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, q, p, p, t, v][i], [t, v, v, q, p, p][i], [p, p, t, v, v, q][i]];
}

// ---- The tower. Stage k is a tensegrity prism: n struts from its bottom
// n-gon to its top n-gon, strut i from bottom node i to top node i + 1, a
// side cable from bottom node i to top node i, and a ring of cables round
// each n-gon. The prism alone settles with its top turned pi/2 - pi/n against
// its bottom along the side cables, so pi/2 + pi/n along the struts. Run on
// its own with this code's springs from 20 or 70 degrees round, cables 10%
// short, it came to 30.0000, 45.0000, 54.0000 and 60.0000 degrees for n = 3,
// 4, 5 and 6 (from 5 degrees too for 3 and 4; 5 and 6 went slack from there).
// Stages overlap by a quarter of their height: stage k + 1's bottom n-gon
// sits below stage k's top one, turned pi/n so its nodes fall between, and
// hangs from it by a zigzag of 2n saddle cables; bottom-to-bottom and
// top-to-top cables between the two stages pull the other way. Stacked, the
// stages twist less than a lone prism: 20 to 24 degrees for n = 3, 33 to 38
// for 4, 41 to 46 for 5, 46 to 52 for 6. No two struts share a node, and the
// closest two pass 8.4 units apart at n = 3, 3.4 at n = 6 (3.0 under Load 1).
// Units: the bare tower stands 143 to 150 units tall and is drawn 121 LEDs.
const STAGES = 5, HS = 34, OV = 9, R0 = 24, R1 = 17;
const ALL = 0.08; // every cable 8% shorter than the span it is built on: the prestress
const EA = 1800; // cable stiffness: tension = EA * stretch / rest length
const FMAX = 700; // the weight at Load 1, shared out over the top nodes
const KICK = 40; // a pluck, units a second sideways at each end of the cable
const HSUB = 1 / 120; // physics step while it runs, seconds of the tower's own time

function build(n) {
  const P = [], fix = [], struts = [], cables = [], B = [], T = [], stage = [];
  const alpha = PI / 2 - PI / n;
  let phi = 0;
  for (let k = 0; k < STAGES; k++) {
    const r = R0 + ((R1 - R0) * k) / (STAGES - 1), zb = k * (HS - OV), zt = zb + HS;
    B.push([]);
    T.push([]);
    for (let i = 0; i < n; i++) {
      const a = phi + (2 * PI * i) / n;
      B[k].push(P.length / 3);
      P.push(r * cos(a), zb, r * sin(a));
      fix.push(k === 0);
    }
    for (let i = 0; i < n; i++) {
      const a = phi + alpha + (2 * PI * i) / n;
      T[k].push(P.length / 3);
      P.push(r * cos(a), zt, r * sin(a));
      fix.push(false);
    }
    for (let i = 0; i < n; i++) {
      struts.push(B[k][i], T[k][(i + 1) % n]);
      stage.push(k);
      cables.push(B[k][i], T[k][i]);
      cables.push(B[k][i], B[k][(i + 1) % n], T[k][i], T[k][(i + 1) % n]);
    }
    phi += alpha + PI / n;
  }
  for (let k = 0; k + 1 < STAGES; k++)
    for (let j = 0; j < n; j++) {
      cables.push(B[k + 1][j], T[k][j], B[k + 1][j], T[k][(j + 1) % n]);
      cables.push(B[k + 1][j], B[k][j], T[k][j], T[k + 1][j]);
    }
  const N = P.length / 3, x = Float64Array.from(P);
  const len = (a, b) => sqrt((x[3 * a] - x[3 * b]) ** 2 + (x[3 * a + 1] - x[3 * b + 1]) ** 2 + (x[3 * a + 2] - x[3 * b + 2]) ** 2);
  const SL = new Float64Array(struts.length / 2), CL = new Float64Array(cables.length / 2);
  for (let q = 0; q < SL.length; q++) SL[q] = len(struts[2 * q], struts[2 * q + 1]);
  for (let q = 0; q < CL.length; q++) CL[q] = len(cables[2 * q], cables[2 * q + 1]) * (1 - ALL);
  return {
    n, N, x, v: new Float64Array(3 * N), xp: new Float64Array(3 * N), f: new Float64Array(3 * N),
    fix, struts, cables, SL, CL, ten: new Float64Array(CL.length), top: T[STAGES - 1], stage,
  };
}

// One step: cables pull (tension only), the weight presses, velocities damp,
// then the struts are put back to length, four passes.
function step(m, load, damp, h) {
  const { x, v, xp, f, cables, CL, ten, struts, SL, fix, N } = m;
  f.fill(0);
  const w = load / m.top.length;
  for (const i of m.top) f[3 * i + 1] -= w;
  for (let q = 0; q < CL.length; q++) {
    const a = 3 * cables[2 * q], b = 3 * cables[2 * q + 1];
    const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2], L = sqrt(dx * dx + dy * dy + dz * dz);
    const t = L > CL[q] ? (EA * (L - CL[q])) / CL[q] : 0;
    ten[q] = t;
    if (!t) continue;
    const s = t / L;
    f[a] += dx * s, f[a + 1] += dy * s, f[a + 2] += dz * s;
    f[b] -= dx * s, f[b + 1] -= dy * s, f[b + 2] -= dz * s;
  }
  const keep = 1 - damp * h;
  for (let i = 0; i < N; i++) {
    if (fix[i]) continue;
    for (let d = 3 * i; d < 3 * i + 3; d++) {
      xp[d] = x[d];
      v[d] = (v[d] + h * f[d]) * keep;
      x[d] += h * v[d];
    }
  }
  for (let it = 0; it < 4; it++)
    for (let q = 0; q < SL.length; q++) {
      const ia = struts[2 * q], ib = struts[2 * q + 1], a = 3 * ia, b = 3 * ib;
      const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2], L = sqrt(dx * dx + dy * dy + dz * dz);
      const wa = fix[ia] ? 0 : 1, wb = fix[ib] ? 0 : 1, e = (L - SL[q]) / L / (wa + wb);
      x[a] += dx * e * wa, x[a + 1] += dy * e * wa, x[a + 2] += dz * e * wa;
      x[b] -= dx * e * wb, x[b + 1] -= dy * e * wb, x[b + 2] -= dz * e * wb;
    }
  // The weight runs on a guide up the axis, so the top nodes' centre stays on
  // it. Without the guide the tower bowed sideways and folded under 150 to
  // 200 units, while only 5 units shorter; with it, 900 left every cable taut.
  let gx = 0, gz = 0;
  for (const i of m.top) (gx += x[3 * i] / m.top.length), (gz += x[3 * i + 2] / m.top.length);
  for (const i of m.top) (x[3 * i] -= gx), (x[3 * i + 2] -= gz);
  for (let i = 0; i < N; i++) if (!fix[i]) for (let d = 3 * i; d < 3 * i + 3; d++) v[d] = (x[d] - xp[d]) / h;
}

// Settling before the first frame: 1/30 s steps, damped near critical for
// the tower's slowest sway, until no node moves 0.002 units in 50 steps.
// The bare tower takes 600 to 650 steps, under its weight 400 to 1,300 more.
function relax(m, load, damp) {
  const was = Float64Array.from(m.x);
  let s = 0;
  for (; s < 4000; s++) {
    step(m, load, damp, 1 / 30);
    if (s % 50 === 49) {
      let moved = 0;
      for (let d = 0; d < was.length; d++) (moved = max(moved, abs(m.x[d] - was[d]))), (was[d] = m.x[d]);
      if (moved < 0.002) break;
    }
  }
  m.v.fill(0);
  return s + 1;
}

export function setup(params) {
  params.s = {
    t: 0, turn: 0.6, n: 0, m: null, hue: 0, load: 0.06, lnow: 0.06, acc: 0, pl: -1, plT: -9,
    span: [0, 1], rgb: new Float32Array(W * H * 3), z: new Float32Array(W * H), order: [],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3), n = cl(round(k[2]), 3, 6);
  S.load = cl(k[3], 0, 1);
  if (n !== S.n) {
    // A new tower: settle it bare to fix the scale, then under its weight,
    // overdamped so it does not overshoot. At the start knobs the first frame
    // runs 650 + 500 steps, 1.5 ms in Node.
    S.n = n;
    S.m = build(n);
    S.steps = relax(S.m, 0, 1.2);
    const x = S.m.x;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < S.m.N; i++) (lo = min(lo, x[3 * i + 1])), (hi = max(hi, x[3 * i + 1]));
    S.span = [lo, hi];
    S.lnow = S.load;
    S.steps += relax(S.m, S.lnow * FMAX, 2.5);
  }
  const m = S.m;
  if (input.btnPressed && input.btnPressed[0]) {
    // Pluck one of the longer cables on the side facing the camera. Its ends
    // are kicked apart only once the last pluck has died down: kicks every
    // 0.3 s used to pump the tower until it folded.
    const c = cos(S.turn), sn = sin(S.turn), pick = [];
    let lmax = 0;
    for (let q = 0; q < m.CL.length; q++) lmax = max(lmax, m.CL[q]);
    for (let q = 0; q < m.CL.length; q++) {
      const a = 3 * m.cables[2 * q], b = 3 * m.cables[2 * q + 1];
      if (m.fix[a / 3] && m.fix[b / 3]) continue;
      if ((m.x[a] + m.x[b]) * sn + (m.x[a + 2] + m.x[b + 2]) * c > 12 && m.CL[q] > 0.5 * lmax) pick.push(q);
    }
    const q = pick.length ? pick[floor(Math.random() * pick.length)] : 0;
    const a = 3 * m.cables[2 * q], b = 3 * m.cables[2 * q + 1];
    let ke = 0;
    for (let j = 0; j < m.v.length; j++) ke += m.v[j] * m.v[j];
    const ux = m.x[b + 2] - m.x[a + 2], uz = m.x[a] - m.x[b], L = sqrt(ux * ux + uz * uz) || 1;
    if (ke < 0.5 * KICK * KICK)
      for (const [j, sg] of [[a, 1], [b, -1]]) if (!m.fix[j / 3]) (m.v[j] += (sg * KICK * ux) / L), (m.v[j + 2] += (sg * KICK * uz) / L);
    S.pl = q;
    S.plT = S.t;
  }
  // The tower's own time; a turned Load knob reaches it over half a second.
  const sim = d * speed * 0.5;
  S.lnow += (S.load - S.lnow) * min(1, sim / 0.5);
  S.t += sim;
  S.turn += sim * ((2 * PI) / 16);
  S.acc += sim;
  for (let i = 0; S.acc >= HSUB && i < 40; i++) {
    step(m, S.lnow * FMAX, 1.2, HSUB);
    S.acc -= HSUB;
  }
  if (S.acc > HSUB) S.acc = 0;
}

// ---- Drawing. Orthographic, the camera 10 degrees above the horizon, the
// tower turning about its axis. Each LED keeps the depth of what it shows.
const TILT = 0.17, TC = cos(TILT), TS = sin(TILT);

// A 1 LED line from (x0, y0) to (x1, y1), bowed sideways by bow LEDs at
// its middle, each sample shared between the two LEDs it falls across.
function cable(rgb, zb, x0, y0, z0, x1, y1, z1, bow, col, v) {
  const ex = x1 - x0, ey = y1 - y0, L = sqrt(ex * ex + ey * ey) || 1, nx = -ey / L, ny = ex / L;
  const along = abs(ex) >= abs(ey), steps = (max(abs(ex), abs(ey)) + abs(bow) * 2) | 0;
  for (let i = 0; i <= steps; i++) {
    const u = steps ? i / steps : 0, o = bow * sin(PI * u);
    const fx = x0 + ex * u + nx * o, fy = y0 + ey * u + ny * o, z = z0 + (z1 - z0) * u;
    const g = along ? fy - 0.5 : fx - 0.5, g0 = floor(g), w1 = g - g0;
    for (let e = 0; e < 2; e++) {
      const px = along ? floor(fx) : g0 + e, py = along ? g0 + e : floor(fy);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const p = py * W + px, wv = (e ? w1 : 1 - w1) * v;
      if (z > zb[p] - 0.8) continue;
      for (let j = 0; j < 3; j++) rgb[3 * p + j] = max(rgb[3 * p + j], col[j] * wv);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.m) return;
  const m = S.m, x = m.x, rgb = S.rgb, zb = S.z, n = m.n;
  rgb.fill(0);
  zb.fill(1e9);
  const scale = 121 / (S.span[1] - S.span[0]), yc = (S.span[0] + S.span[1]) / 2;
  const c = cos(S.turn), s = sin(S.turn);
  const N = m.N, sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const X = x[3 * i] * c - x[3 * i + 2] * s, Z = x[3 * i] * s + x[3 * i + 2] * c, Y = x[3 * i + 1] - yc;
    sx[i] = 32 + scale * X;
    sy[i] = 64.5 - scale * (Y * TC - Z * TS);
    sz[i] = -Z; // smaller is nearer
  }

  // The weight: a disc on the top nodes, its thickness growing with Load.
  if (S.load > 0.001) {
    let cx = 0, cy = 0, cz = 0, rr = 0;
    for (const i of m.top) (cx += x[3 * i] / n), (cy += x[3 * i + 1] / n), (cz += x[3 * i + 2] / n);
    for (const i of m.top) rr = max(rr, sqrt((x[3 * i] - cx) ** 2 + (x[3 * i + 2] - cz) ** 2));
    const R = rr * 0.72, th = 1.5 + 9 * S.load, X0 = cx * c - cz * s, Z0 = cx * s + cz * c, Y0 = cy + 0.5 - yc;
    const col = hsv(0.08 + S.hue, 0.18, 1);
    // The guide the weight runs on, up the axis to the top edge.
    const rx = round(32 + scale * X0 - 0.5);
    for (let py = 0; py < 64.5 - scale * ((Y0 + th) * TC - Z0 * TS); py++)
      if (rx >= 0 && rx < W) (rgb[3 * (py * W + rx)] = 0.3 * col[0]), (rgb[3 * (py * W + rx) + 1] = 0.3 * col[1]), (rgb[3 * (py * W + rx) + 2] = 0.3 * col[2]);
    for (let py = 0; py < 30; py++)
      for (let px = 0; px < W; px++) {
        const X = (px + 0.5 - 32) / scale - X0;
        if (abs(X) >= R) continue;
        const hz = sqrt(R * R - X * X), up = (64.5 - (py + 0.5)) / scale;
        // Top face: the point at height Y0 + th whose screen row this is.
        const zt = ((Y0 + th) * TC - up) / TS - Z0;
        let v = 0, depth = 0;
        if (abs(zt) <= hz) (v = 0.5 + 0.2 * (zt / hz)), (depth = -(Z0 + zt));
        else {
          const ys = (up + (Z0 + hz) * TS) / TC;
          if (ys >= Y0 && ys <= Y0 + th) (v = 0.3 + 0.18 * (hz / R)), (depth = -(Z0 + hz));
        }
        if (!v) continue;
        const p = py * W + px;
        zb[p] = depth;
        rgb[3 * p] = col[0] * v, rgb[3 * p + 1] = col[1] * v, rgb[3 * p + 2] = col[2] * v;
      }
  }

  // Struts, far ones first: a bar 2.4 LEDs across, brighter at the near end
  // and down its middle, with a dark rim that cuts whatever passes behind.
  const ns = m.SL.length, ord = S.order;
  ord.length = ns;
  for (let q = 0; q < ns; q++) ord[q] = q;
  const mid = (q) => sz[m.struts[2 * q]] + sz[m.struts[2 * q + 1]];
  ord.sort((a, b) => mid(b) - mid(a));
  const RAD = 1.2, HALO = 1.5, DEEP = R0 + 2;
  for (const q of ord) {
    const a = m.struts[2 * q], b = m.struts[2 * q + 1];
    const x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b], z0 = sz[a], z1 = sz[b];
    const ex = x1 - x0, ey = y1 - y0, ll = ex * ex + ey * ey || 1;
    const col = hsv(0.47 + S.hue + 0.04 * m.stage[q], 0.62, 1);
    const reach = RAD + HALO + 0.5;
    const X0 = max(0, floor(min(x0, x1) - reach)), X1 = min(W - 1, floor(max(x0, x1) + reach));
    const Y0 = max(0, floor(min(y0, y1) - reach)), Y1 = min(H - 1, floor(max(y0, y1) + reach));
    for (let py = Y0; py <= Y1; py++)
      for (let px = X0; px <= X1; px++) {
        const u = cl(((px + 0.5 - x0) * ex + (py + 0.5 - y0) * ey) / ll, 0, 1);
        const dx = px + 0.5 - x0 - ex * u, dy = py + 0.5 - y0 - ey * u, dd = sqrt(dx * dx + dy * dy);
        if (dd > reach) continue;
        const z = z0 + (z1 - z0) * u, p = py * W + px;
        if (dd < RAD + 0.5) {
          if (z >= zb[p]) continue;
          const cov = min(1, RAD + 0.5 - dd), lit = (0.42 + 0.58 * cl((DEEP - z) / (2 * DEEP), 0, 1)) * (1 - 0.35 * (dd / (RAD + 0.5)) ** 2);
          for (let j = 0; j < 3; j++) rgb[3 * p + j] = rgb[3 * p + j] * (1 - cov) + col[j] * lit * cov;
          if (cov > 0.4) zb[p] = z;
        } else if (z + 1.5 < zb[p]) {
          const k = 0.2 + 0.8 * min(1, (dd - RAD - 0.5) / HALO) ** 2;
          for (let j = 0; j < 3; j++) rgb[3 * p + j] *= k;
          zb[p] = z + 1.5;
        }
      }
  }

  // Cables: 1 LED lines, brighter the harder they pull, hidden behind struts.
  // A plucked one swings as a string for two seconds, at a pitch that goes
  // with the square root of its tension over its length, its envelope dim.
  const nc = m.CL.length, pc = hsv(0.92 + S.hue, 0.4, 1), fl = hsv(0.13 + S.hue, 0.3, 1);
  let tmax = 1, tsum = 0, lsum = 0;
  for (let q = 0; q < nc; q++) (tmax = max(tmax, m.ten[q])), (tsum += m.ten[q]), (lsum += m.CL[q]);
  const age = S.t - S.plT;
  for (let q = 0; q < nc; q++) {
    const a = m.cables[2 * q], b = m.cables[2 * q + 1];
    const lv = 0.26 + 0.34 * (m.ten[q] / tmax);
    if (q !== S.pl || age > 2) {
      cable(rgb, zb, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], 0, pc, lv);
      continue;
    }
    const pk = 1 - age / 2, col = [0, 1, 2].map((j) => pc[j] + (fl[j] - pc[j]) * pk), v = lv + pk * (1 - lv);
    const amp = 3.2 * pk * pk, w = 2 * PI * 2.2 * sqrt(m.ten[q] / (tsum / nc + 1e-9)) * (lsum / nc / m.CL[q]);
    cable(rgb, zb, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], amp, col, v * 0.35);
    cable(rgb, zb, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], -amp, col, v * 0.35);
    cable(rgb, zb, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], amp * cos(w * age), col, v);
  }

  for (let p = 0; p < W * H; p++) {
    const r = rgb[3 * p], g = rgb[3 * p + 1], b = rgb[3 * p + 2];
    if (r + g + b > 0.004) display.setPixel(p % W, (p / W) | 0, min(255, 255 * r) | 0, min(255, 255 * g) | 0, min(255, 255 * b) | 0);
  }
}
