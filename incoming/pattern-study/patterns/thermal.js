// ===== Patternflow pattern =====
// Title:   Thermal
// Family:  flight
// Idea:    A white sailplane corkscrews up a summer thermal off a dark ploughed field with two buzzards and rising thistledown, until at the base of the cumulus the thermal is building it straightens and glides off, and another glider joins low down.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after thermal soaring under fair-weather cumulus over farmland
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Hour=0..1, Speed=0.2..3, Gliders=1..4, Wind=-1..1
//
// Knob 1: Hour. Bright midday at 0, to golden late afternoon at 1: the sun comes in low from the left, the haze goes amber and hedges and trees throw long shadows.
// Knob 2: Speed. At 2 a turn takes six seconds, the climb to the cloud base about twenty, and each cloud builds for 26 s before it drifts off. At 0.2 all of it runs ten times slower.
// Knob 3: Gliders. One to four gliders stacked in the thermal. A day good enough for four also builds a bigger cloud with a darker base and sends more thistledown up.
// Knob 4: Wind. The thermal and its cloud lean downwind, so the turns drift as the gliders climb, and cloud shadows and far cumulus travel faster. Near 0 it is almost calm.
// Buttons: K1 tap winch-launches a glider from the field; it rears up on the cable, lets go and turns into the thermal.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, sin, cos, abs, sqrt, exp, floor, round, pow, sign, PI } = Math;
const TAU = 2 * PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => ((v = clamp((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const rnd = () => Math.random();
// Rows: horizon, first field row, cloud base, where the thermal leaves the ground.
const [HOR, FY, YB, YG] = [97, 100, 36, 116];
// The ploughed field the thermal comes off: its column and its distance.
const [SRCX, DSRC] = [29, 9.6];
// We look up a little, so a level circle is a thin ellipse; the craft are drawn flatter so a banked wing does not stand on end.
const SE = sin(0.3);
const [BE, BC] = [sin(0.1), cos(0.1)];

const hash = (x, y, s) => {
  let h = Math.imul((x * 374761393 + y * 668265263 + s * 982451653) | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise(x, y, s) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + hash(ix + 1, iy + 1, s)) * u * v;
}
const fbm = (x, y, s) => 0.55 * noise(x, y, s) + 0.3 * noise(x * 2.1, y * 2.1, s + 7) + 0.15 * noise(x * 4.3, y * 4.3, s + 13);

// Pasture, beans, stubble, wheat, hay and plough in midday sun; 1 marks rows running away from us.
const CROP = [[70, 150, 45, 0], [38, 106, 36, 1], [216, 184, 94, 1], [198, 160, 66, 0], [142, 178, 74, 0], [96, 62, 40, 1]];
const PICK = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4];
// Tapered strokes in the craft's axes: forward, right, up, twice, then two radii.
const GLIDER = [[3.6, 0, -0.1, -4.8, 0, 0.15, 0.85, 0.45], [0.6, 0, 0.25, 0.25, -9, 0.85, 0.75, 0.45], [0.6, 0, 0.25, 0.25, 9, 0.85, 0.75, 0.45], [-4.2, 0, 0.1, -4.9, 0, 2.4, 0.55, 0.45], [-4.9, -2.6, 2.4, -4.9, 2.6, 2.4, 0.45, 0.45]];
const BUZZ = [[1.3, 0, 0, -1.3, 0, 0, 0.6, 0.45], [0.2, 0, 0.1, -0.3, -3.7, 0.75, 0.8, 0.45], [0.2, 0, 0.1, -0.3, 3.7, 0.75, 0.8, 0.45], [-1.2, 0, 0, -2.5, 0, 0.1, 0.45, 0.65]];

// A cumulus as puffs over a flat base: u across, v up, r, and when in its growth each appears.
function puffs() {
  const L = [];
  const add = (u, v, r, t0) => L.push({ u: u + (rnd() - 0.5) * 0.14, v: v + (rnd() - 0.5) * 0.08, r: r * (0.88 + 0.24 * rnd()), t0, ph: rnd() * TAU });
  for (let i = 0; i < 5; i++) add(-0.76 + i * 0.38, 0.2, 0.34, i === 2 ? 0 : 0.03 + 0.12 * rnd());
  for (let i = 0; i < 4; i++) add(-0.5 + i * 0.33, 0.45, 0.33, 0.08 + 0.17 * rnd());
  for (let i = 0; i < 3; i++) add(-0.3 + i * 0.3, 0.68, 0.3, 0.3 + 0.2 * rnd());
  for (let i = 0; i < 2; i++) add((rnd() - 0.5) * 0.4, 0.86, 0.26, 0.55 + 0.15 * rnd());
  return L;
}
const newCloud = (x, a) => ({ x, a, g: 0, al: 1, det: false, p: puffs(), sd: floor(rnd() * 999) });

// Fields lie in strips at distance D (row = HOR + 180 / D), each cut into fields across.
function buildFields(S) {
  const strips = [], trees = [], us = ((SRCX - 32) * DSRC) / 64, hw = (11 * DSRC) / 64;
  for (let D = 5.6; D < 66; ) {
    const D2 = D * (1.22 + 0.12 * rnd());
    const wid = () => ((12 + 18 * rnd()) * pow(6 / D, 0.35) * D) / 64;
    let b = [];
    for (let u = -0.62 * D2 - rnd() * wid(); u < 0.62 * D2 + 0.3; u += wid()) b.push(u);
    const src = D <= DSRC && DSRC < D2;
    if (src) {
      b = b.filter((u) => u < us - hw - 0.3 || u > us + hw + 0.3);
      b.push(us - hw, us + hw);
      b.sort((p, q) => p - q);
    }
    const t = [];
    for (let j = 0; j < b.length - 1; j++) {
      let k;
      do k = PICK[floor(rnd() * PICK.length)];
      while (j && k === t[j - 1]);
      t.push(k);
    }
    if (src) t[b.indexOf(us - hw)] = 5;
    strips.push({ d0: D, d1: D2, b, t, hh: 0.12 + 0.08 * rnd(), i: strips.length });
    // Trees in the hedge along each strip's near edge, and at some corners.
    for (let j = 0; j < 2; j++) if (rnd() < 0.6) trees.push({ u: (rnd() - 0.5) * 1.1 * D, D: D + 0.05, rc: 0.2 + 0.14 * rnd() });
    for (let j = 1; j < b.length - 1; j++) if (rnd() < 0.2) trees.push({ u: b[j], D: D + 0.05, rc: 0.2 + 0.12 * rnd() });
    D = D2;
  }
  for (const tr of trees) tr.hc = tr.rc * 1.5 + 0.15;
  S.strips = strips;
  S.trees = trees.sort((p, q) => q.D - p.D);
}

export function setup(params) {
  const F = () => new Float32Array(N);
  const S = { t: 0, bg: new Float32Array(N * 3), buf: new Float32Array(N * 3), A: F(), fu: F(), fd: F(), fn: F(), gl: [], down: [], clouds: [], far: [], spawn: [0, 0], cable: null, bb: [1e9, 1e9, -1, -1] };
  buildFields(S);
  for (let y = FY; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      S.fd[p] = 180 / (y + 0.5 - HOR);
      S.fu[p] = ((x + 0.5 - 32) * S.fd[p]) / 64;
      S.fn[p] = fbm(x * 0.15, y * 0.3, 11);
    }
  for (let i = 0; i < 3; i++) S.far.push({ x: 8 + i * 24 + rnd() * 10, yb: 87 - i * 5 - rnd() * 2, hw: 5 + 2.5 * i + rnd() * 2, ht: 3 + i + rnd() * 1.5, p: puffs(), sd: floor(rnd() * 999), m: 0.35, e: 44 });
  S.shad = [{ x: 6, D: 7.4, r: 19, rd: 2.6, m: 0.9, e: 62 }, { x: 50, D: 16, r: 15, rd: 5.5, m: 0.9, e: 60 }];
  params.s = S;
}

// The thermal's centre at a row: it leans downwind with height and wanders a little.
const colX = (S, y) => SRCX + S.lean * (YG - y) + 1.5 * sin(S.t * 0.21);
const sunLight = (h, k = mix(1, 0.9, h)) => [mix(1, 1.16, h) * k, mix(1, 0.86, h) * k, mix(1, 0.56, h) * k];
const SHADE = [0.42, 0.47, 0.6];
const hazeOf = (h) => mix3([176, 202, 222], [236, 186, 122], h);
function skyAt(x, y, h) {
  const top = mix3([14, 50, 150], [30, 52, 128], h), mid = mix3([44, 108, 206], [70, 104, 178], h), t = y / 96;
  const c = t < 0.66 ? mix3(top, mid, sstep(0, 0.66, t)) : mix3(mid, hazeOf(h), sstep(0.66, 1, t));
  const gw = pow(h, 1.5) * exp(-x / 24) * exp(-abs(y - 78) / 36);
  return [c[0] + 110 * gw, c[1] + 64 * gw, c[2] + 14 * gw];
}

// The ground seen at a point of the panel: hedges, fields, their shadows, and the haze.
function fieldAt(S, x, y, sun, Lsh, haze) {
  const D = 180 / (y - HOR), u = ((x - 32) * D) / 64, st = S.strips;
  let k = 0;
  while (k < st.length - 1 && D >= st[k].d1) k++;
  let alb = null;
  let lit = 1;
  // The hedge on a strip's near edge hides the ground just behind it.
  for (let j = k; j >= 0 && st[j].d0 > D * 0.8; j--) {
    const s = st[j];
    if (y >= HOR + (180 - 64 * s.hh * (0.7 + 0.6 * noise(u * 2.6, s.i * 9, 3))) / s.d0) {
      const n = 0.8 + 0.4 * noise(u * 6, y, 5);
      alb = [34 * n, 78 * n, 30 * n];
      lit = 0.85;
      break;
    }
  }
  if (!alb) {
    const s = st[k], b = s.b;
    let j = 0;
    while (j < b.length - 2 && u >= b[j + 1]) j++;
    const hwu = ((0.8 * pow(6 / D, 0.4) + 0.25) * D) / 64;
    if (abs(u - b[j]) < hwu || abs(u - b[j + 1]) < hwu) {
      alb = [30, 70, 28];
      lit = 0.7;
    } else {
      const c = CROP[s.t[j]], tx = c[3] ? 0.97 + 0.17 * sin(u * TAU * 6.5) : 0.86 + 0.28 * fbm(u * 2.5, D * 0.7, s.t[j] + j);
      alb = [c[0] * tx, c[1] * tx, c[2] * tx];
      // Shadows of the hedges left and in front, and of the trees.
      if (u - b[j] < s.hh * Lsh * 0.85 || D - s.d0 < s.hh * Lsh * 0.4) lit = 0;
      else
        for (const tr of S.trees) {
          const du = u - tr.u - tr.hc * Lsh * 0.85, dd = D - tr.D - tr.hc * Lsh * 0.45;
          if (abs(dd) > 3 + Lsh) continue;
          const al = (du * 0.86 + dd * 0.5) / (tr.rc * (1 + 0.55 * Lsh)), pe = (-du * 0.5 + dd * 0.86) / (tr.rc * 1.8);
          if (al * al + pe * pe < 1) {
            lit = 0;
            break;
          }
        }
    }
  }
  const hz = 0.55 * sstep(5, 75, D);
  return [0, 1, 2].map((c) => mix(alb[c] * mix(SHADE[c], sun[c], lit), haze[c], hz));
}

function paint(S) {
  const h = S.hour, sun = sunLight(h), haze = hazeOf(h), Lsh = 0.35 + 4.2 * pow(h, 1.6), bg = S.bg, ridgeF = mix3(haze, [64, 96, 116], 0.38);
  const ridgeN = mix3(haze, [52 * sun[0], 98 * sun[1], 54 * sun[2]], 0.58);
  for (let x = 0; x < W; x++) {
    const farT = 83 + 5 * fbm(x * 0.045, 1.3, 21), nearT = 91.5 + 3 * fbm(x * 0.09, 4.1, 22) - 1.5 * sstep(0.55, 0.8, noise(x * 0.5, 0, 23));
    for (let y = 0; y < H; y++) {
      const q = (y * W + x) * 3;
      bg[q] = bg[q + 1] = bg[q + 2] = 0;
      // The open sky is smooth enough for one sample.
      for (let k = y + 1 < farT ? 3 : 0; k < 4; k++) {
        const xs = x + 0.25 + 0.5 * (k & 1), ys = y + 0.25 + 0.5 * (k >> 1);
        let c;
        if (ys >= FY) c = fieldAt(S, xs, ys, sun, Lsh, haze);
        else if (ys >= nearT) c = ridgeN.map((v) => v * (0.84 + 0.3 * fbm(x * 0.35, ys * 0.9, 24)));
        else if (ys >= farT) c = ridgeF;
        else c = skyAt(xs, ys, h);
        for (let i = 0; i < 3; i++) bg[q + i] += y + 1 < farT ? c[i] : c[i] / 4;
      }
    }
  }
  // Tree crowns, far ones first, lit from the sun's side.
  for (const tr of S.trees) {
    const cx = 32 + (64 * tr.u) / tr.D, cy = HOR + (180 - 64 * tr.hc) / tr.D, R = (64 * tr.rc) / tr.D, hz = 0.55 * sstep(5, 75, tr.D);
    for (let y = max(FY - 4, floor(cy - R - 1)); y <= min(H - 1, cy + R + 1); y++)
      for (let x = max(0, floor(cx - R - 1)); x <= min(W - 1, cx + R + 1); x++) {
        const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / R, a = clamp((1 - sqrt(dx * dx + dy * dy)) * R + 0.5, 0, 1);
        if (a <= 0) continue;
        const l = clamp(0.45 - 0.7 * dx - 0.4 * dy, 0, 1), n = 0.85 + 0.3 * hash(x, y, 31), q = (y * W + x) * 3;
        [40, 94, 38].forEach((al, c) => (bg[q + c] += (mix(al * n * mix(SHADE[c], sun[c] * 1.1, l), haze[c], hz) - bg[q + c]) * a));
      }
  }
  S.painted = h;
}

function addCraft(S, kind, st, X, yc, dir) {
  const R = kind ? 5.5 + rnd() : 11.5 + rnd();
  const o = { kind, st, X, yc, Z: -dir * R, R, dir, th: (-dir * PI) / 2, bank: st === "climb" ? 0.5 + 0.12 * kind : 0, pitch: 0, off: 0, s: 0, w: kind ? 1.75 + 0.3 * rnd() : 1.05, c0: kind ? 1.9 : 2.4 };
  S.gl.push(o);
  return o;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  S.hour = clamp(k[0], 0, 1);
  const tempo = clamp(k[1], 0.2, 3) / 2, kg = clamp(k[2], 1, 4), n = (S.n = round(kg)), wind = clamp(k[3], -1, 1);
  if (!S.started) {
    S.started = true;
    S.wind = wind;
    S.ks = 1 + 0.14 * (kg - 1);
    S.lean = wind * 0.22;
    for (let i = 0; i < n; i++) addCraft(S, 0, "climb", 0, n === 1 ? 72 : 82 - (i * 36) / (n - 1), 1).th = rnd() * TAU;
    for (const y of [86, 62]) addCraft(S, 1, "climb", 0, y, 1).th = rnd() * TAU;
    for (let i = 0; i < 56; i++) S.down.push({ y: YB + rnd() * (YG - YB), a: rnd() * TAU, r: 0.5 + rnd() * 5.5, v: 3 + rnd() * 3, tw: rnd() * TAU });
    // The cloud of the last thermal is drifting off as the next one starts.
    S.clouds.push(Object.assign(newCloud(colX(S, YB) + (wind < 0 ? -24 : 24), 26), { det: true, al: 0.9 }), newCloud(colX(S, YB), 1.5));
  }
  const d = dt * tempo;
  S.t += d;
  S.wind += (wind - S.wind) * min(1, dt * 2);
  S.ks += (1 + 0.14 * (kg - 1) - S.ks) * min(1, dt * 2);
  S.lean = S.wind * 0.22;
  const vd = (S.wind < 0 ? -2 : 2) + 6 * S.wind;
  if (input.btnPressed && input.btnPressed[0]) {
    const dir = rnd() < 0.5 ? 1 : -1, o = addCraft(S, 0, "launch", dir > 0 ? 4 + rnd() * 10 : 50 + rnd() * 10, 0, dir);
    Object.assign(o, { yc: 121 + o.Z * SE, X0: o.X, cable: true });
  }

  // The thermal's cloud builds for 26 s, then drifts off and thins as a new one starts.
  for (const c of S.clouds) {
    c.a += d;
    c.g = 1 - exp(-c.a / 6.5);
    if (c.det) {
      c.x += vd * d;
      c.al -= d / 8;
    } else {
      c.x += (colX(S, YB) - c.x) * min(1, d * 0.6);
      if (c.a > 26) {
        c.det = true;
        S.clouds.push(newCloud(colX(S, YB), 0));
      }
    }
  }
  S.clouds = S.clouds.filter((c) => c.al > 0);
  // Far cumulus and the shadows of clouds out of sight drift with the wind and come round again.
  for (const f of S.far.concat(S.shad)) {
    f.x += vd * f.m * d;
    if ((f.x - 32) * vd > 0 && abs(f.x - 32) > f.e) f.x = 32 - sign(f.x - 32) * (f.e - 1);
  }

  // Gliders and buzzards: launched, gliding in, circling up, or gliding off.
  for (const o of S.gl) {
    const cx = colX(S, o.yc) + (o.kind ? 2 : 0);
    if (o.st === "launch") {
      o.s += d;
      const v = 16 * min(1, o.s / 0.5);
      o.pitch = o.cable ? 0.95 * sstep(0.5, 1.1, o.s) : max(0, o.pitch - d * 1.2);
      o.X += o.dir * v * cos(o.pitch) * d;
      o.yc -= v * sin(o.pitch) * d;
      if (o.cable && o.yc < 88) {
        o.cable = false;
        S.cable = { x: o.X + o.dir * 3, y: o.yc - o.Z * SE - 2.5, xw: o.X0 + o.dir * 58, t: 0 };
      }
      if (!o.cable && o.pitch <= 0) {
        o.st = "climb";
        o.off = o.X - cx;
      }
    } else if (o.st === "climb") {
      const th0 = o.th;
      o.th += o.w * d;
      o.off *= exp(-d * 0.35);
      o.yc -= o.c0 * (1 + 0.45 * cos(o.th + 0.8)) * d;
      o.bank += ((o.kind ? 0.62 : 0.5) - o.bank) * min(1, d * 2);
      if (o.yc < YB + (o.kind ? 18 : 8)) o.leave = true;
      // Done, it straightens up the next time it flies across the panel.
      if (o.leave && cos(th0) * cos(o.th) <= 0) {
        o.st = "out";
        o.th = sin(o.th) > 0 ? PI / 2 : -PI / 2;
        o.dir = -sign(sin(o.th));
      }
      o.X = cx + o.off + o.R * cos(o.th);
      o.Z = o.R * sin(o.th);
    } else {
      o.X += o.dir * o.R * o.w * d;
      o.yc += (o.st === "out" ? 0.8 : 0.4) * d;
      o.bank *= exp(-d * 3);
      if (o.st === "in" && o.dir * (o.X - cx) >= 0) o.st = "climb";
      if (abs(o.X - 32) > 56) o.gone = true;
    }
  }
  S.gl = S.gl.filter((o) => !o.gone);
  // Too many: the highest leaves early. Too few: a newcomer glides in low.
  for (const kind of [0, 1]) {
    const act = S.gl.filter((o) => o.kind === kind && o.st !== "out");
    const want = kind ? 2 : n;
    S.spawn[kind] -= d;
    if (act.length < want && S.spawn[kind] <= 0) {
      const dir = rnd() < 0.5 ? 1 : -1;
      addCraft(S, kind, "in", 32 - dir * 46, (kind ? 84 : 86) + rnd() * 6, dir);
      S.spawn[kind] = kind ? 1.5 + rnd() * 2 : 2.5;
    } else if (act.length > want) {
      const hi = act.filter((o) => o.st === "climb" && !o.leave).sort((p, q) => p.yc - q.yc)[0];
      if (hi) hi.leave = true;
    }
  }
  const cb = S.cable;
  if (cb) {
    cb.y += 9 * d;
    if ((cb.t += d) > 2) S.cable = null;
  }
  // Thistledown rides the thermal up from the ploughed field.
  for (const p of S.down) {
    p.y -= p.v * d;
    p.a += (1.6 / (1 + p.r * 0.3)) * d;
    if (p.y < YB + 1) {
      p.y = YG - 3 + rnd() * 5;
      p.r = 0.5 + rnd() * 5.5;
    }
  }
}

// A tapered stroke into the coverage buffer, growing the box drawn into.
function stroke(S, ax, ay, bx, by, ra, rb) {
  const { A, bb } = S, x0 = max(0, floor(min(ax, bx) - 2)), x1 = min(W - 1, Math.ceil(max(ax, bx) + 2));
  const y0 = max(0, floor(min(ay, by) - 2)), y1 = min(H - 1, Math.ceil(max(ay, by) + 2));
  if (x0 > x1 || y0 > y1) return;
  bb[0] = min(bb[0], x0);
  bb[1] = min(bb[1], y0);
  bb[2] = max(bb[2], x1);
  bb[3] = max(bb[3], y1);
  const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = clamp((px * dx + py * dy) / ll, 0, 1), ex = px - dx * t, ey = py - dy * t;
      const a = clamp(ra + (rb - ra) * t + 0.5 - sqrt(ex * ex + ey * ey), 0, 1), i = y * W + x;
      if (a > A[i]) A[i] = a;
    }
}
function flush(S, col, alpha) {
  const { A, buf, bb } = S;
  for (let y = bb[1]; y <= bb[3]; y++)
    for (let x = bb[0]; x <= bb[2]; x++) {
      const i = y * W + x, a = min(1, A[i] * alpha);
      if (a <= 0) continue;
      A[i] = 0;
      for (let c = 0; c < 3; c++) buf[i * 3 + c] += (col[c] - buf[i * 3 + c]) * a;
    }
  bb[0] = bb[1] = 1e9;
  bb[2] = bb[3] = -1;
}

// A craft in its own frame (heading, pitch, bank), seen from below and to the side.
function craft(S, o, h) {
  const cl = o.st === "climb", hx = cl ? -sin(o.th) : o.dir, hz = cl ? cos(o.th) : 0, cp = cos(o.pitch), sp = sin(o.pitch);
  const F = [hx * cp, sp, hz * cp], U0 = [-hx * sp, cp, -hz * sp], R0 = [-hz, 0, hx], cb = cos(o.bank * 0.7), sb = sin(o.bank * 0.7);
  const U = [U0[0] * cb + R0[0] * sb, U0[1] * cb, U0[2] * cb + R0[2] * sb], R = [R0[0] * cb - U0[0] * sb, -U0[1] * sb, R0[2] * cb - U0[2] * sb];
  const sy = o.yc - o.Z * SE;
  const P = (f, r, u) => [o.X + F[0] * f + R[0] * r + U[0] * u, sy - (F[1] * f + R[1] * r + U[1] * u) * BC - (F[2] * f + R[2] * r + U[2] * u) * BE];
  for (const m of o.kind ? BUZZ : GLIDER) {
    const a = P(m[0], m[1], m[2]), b = P(m[3], m[4], m[5]);
    stroke(S, a[0], a[1], b[0], b[1], m[6], m[7]);
  }
  // From below we see the shaded underside; banked towards us, the sunlit top.
  const top = sstep(-0.3, 0.4, -U[1] * BE + U[2] * BC);
  if (o.kind) return flush(S, [mix(58, 86, top), mix(42, 62, top), mix(30, 40, top)], 1);
  const f = 0.84 + 0.16 * top;
  flush(S, mix3([236, 240, 246], [255, 226, 176], h).map((v) => v * f), 1.35);
  // Once a turn the wing tilts to the sun and flashes.
  const gx = mix(-0.35, -0.8, h), gz = mix(1, 0.6, h);
  const gl = (sstep(0.92, 1, ((R0[0] * gx + R0[2] * gz) / sqrt(gx * gx + gz * gz)) * sign(o.bank || 1)) * abs(o.bank)) / 0.5;
  if (gl < 0.02) return;
  const w = P(0.4, 3.5 * sign(o.bank || 1), 0.6);
  for (let y = max(0, floor(w[1] - 5)); y <= min(H - 1, w[1] + 5); y++)
    for (let x = max(0, floor(w[0] - 5)); x <= min(W - 1, w[0] + 5); x++) {
      const ex = abs(x + 0.5 - w[0]), ey = abs(y + 0.5 - w[1]);
      const v = gl * (exp(-sqrt(ex * ex + ey * ey) / 1.3) + 0.5 * exp(-min(ex, ey) * 2.5 - max(ex, ey) / 2.5)), q = (y * W + x) * 3;
      S.buf[q] += 255 * v;
      S.buf[q + 1] += 246 * v;
      S.buf[q + 2] += mix(225, 170, h) * v;
    }
}

function drawCloud(S, c, hw, ht, g, yb, al, haze) {
  const { buf, t } = S, h = S.hour, B = [], lean = S.lean * 0.6;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9;
  for (const p of c.p) {
    const gr = sstep(p.t0, p.t0 + 0.25, g);
    if (gr <= 0.02) continue;
    const r = p.r * hw * gr * (1 + 0.05 * sin(t * 0.7 + p.ph)), bx = c.x + p.u * hw + lean * p.v * ht + 0.04 * hw * sin(t * 0.5 + p.ph);
    const by = yb - p.v * ht - 0.03 * ht * sin(t * 0.4 + p.ph * 2);
    B.push(bx, by, r);
    x0 = min(x0, bx - r);
    x1 = max(x1, bx + r);
    y0 = min(y0, by - r);
  }
  const L = [mix(-0.45, -0.85, h), mix(-0.7, -0.28, h), 0.5], ll = sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]);
  const litC = mix3([252, 252, 250], [255, 214, 150], h);
  const shC = mix3([150, 162, 192], [150, 124, 146], h).map((v) => v * (1 - 0.2 * g * (c.det ? 0.5 : 1)));
  const baseC = mix3([126, 132, 152], [108, 90, 100], h).map((v) => v * mix(1, 0.78, g));
  const hz = hazeOf(h);
  for (let y = max(0, floor(y0 - 2)); y <= min(H - 1, yb + 1); y++)
    for (let x = max(0, floor(x0 - 2)); x <= min(W - 1, x1 + 2); x++) {
      const px = x + 0.5, py = y + 0.5;
      // The normal blends the puffs nearby, weighted by how deep inside each the pixel is.
      let best = -9, r = 1, sw = 0, nx = 0, ny = 0;
      for (let i = 0; i < B.length; i += 3) {
        const dx = (px - B[i]) / B[i + 2], dy = (py - B[i + 1]) / B[i + 2], v = 1 - sqrt(dx * dx + dy * dy);
        if (v < -0.5) continue;
        if (v > best) {
          best = v;
          r = B[i + 2];
        }
        const w = exp(7 * v);
        sw += w;
        nx += dx * w;
        ny += dy * w;
      }
      if (best < -0.4) continue;
      // Cauliflower edges; a cloud that is dying frays from the edges in.
      const n = noise(px * 0.32, py * 0.32 - t * 0.12, c.sd);
      const a = clamp((best + 0.32 * (n - 0.5) - (1 - al) * 0.8) * r * 0.7, 0, 1) * clamp(yb + 0.7 - py + 0.6 * noise(px * 0.4, 1, c.sd), 0, 1) * sqrt(al);
      if (a <= 0) continue;
      nx /= sw;
      ny /= sw;
      const nz = sqrt(max(0, 1 - nx * nx - ny * ny));
      const lw = clamp(((nx * L[0] + ny * L[1] + nz * L[2]) / ll + 0.45) / 1.45 + 0.3 * (n - 0.5), 0, 1) * (0.55 + 0.45 * clamp((yb - py) / (0.45 * ht), 0, 1));
      const bs = sstep(yb - 2.6, yb - 0.6, py), q = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) buf[q + k] += (mix(mix(mix(shC[k], litC[k], lw), baseC[k], bs), hz[k], haze) - buf[q + k]) * a;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  if (S.painted === undefined || abs(S.painted - S.hour) > 0.003) paint(S);
  const h = S.hour, buf = S.buf;
  buf.set(S.bg);

  // Cloud shadows: each thermal cloud's, pushed off its field by the sun, and two from clouds out of sight.
  const sh = [];
  for (const c of S.clouds) {
    const ru = (((8 + 18 * c.g) * S.ks * DSRC) / 64) * 0.95 * (c.det ? sqrt(c.al) : 1);
    sh.push(((c.x - 29 + 30 * h) * DSRC) / 64, DSRC * (1.04 + 1.1 * h), ru, ru * 1.3 + 0.5, c.al * (0.55 + 0.45 * c.g));
  }
  for (const s of S.shad) sh.push(((s.x - 32) * s.D) / 64, s.D, (s.r * s.D) / 64, s.rd, 1);
  const sc = [0.46, 0.5, 0.62];
  for (let p = FY * W; p < N; p++) {
    let m = 0;
    for (let i = 0; i < sh.length; i += 5) {
      const du = (S.fu[p] - sh[i]) / sh[i + 2], dv = (S.fd[p] - sh[i + 1]) / sh[i + 3], q = du * du + dv * dv;
      if (q < 2.2) m = max(m, sstep(1.05, 0.6, sqrt(q) + 0.35 * (S.fn[p] - 0.5)) * sh[i + 4]);
    }
    if (m > 0) for (let c = 0; c < 3; c++) buf[p * 3 + c] *= mix(1, sc[c], m);
  }

  // Far cumulus along the horizon, then the clouds the thermal builds.
  for (const f of S.far) drawCloud(S, f, f.hw, f.ht, 1, f.yb, 0.9, 0.5);
  for (const c of S.clouds) drawCloud(S, c, (8 + 18 * c.g) * S.ks, (6 + 26 * c.g) * S.ks, c.g, YB, c.det ? c.al : 1, 0);

  // Thistledown catching the sun as it rises.
  const dc = mix3([240, 240, 228], [255, 222, 160], h), nd = 26 + round((10 * (S.ks - 1)) / 0.14);
  for (let i = 0; i < nd; i++) {
    const p = S.down[i], x = round(colX(S, p.y) + p.r * cos(p.a) + 0.8 * sin(S.t * 1.7 + p.tw) - 0.5), y = round(p.y + p.r * sin(p.a) * SE - 0.5);
    if (x < 0 || x >= W) continue;
    const a = (0.45 + 0.4 * sin(S.t * 3 + p.tw * 5)) * sstep(YB, YB + 8, p.y) * sstep(YG + 2, YG - 6, p.y);
    for (let k = 0, q = (y * W + x) * 3; k < 3; k++) buf[q + k] += (dc[k] - buf[q + k]) * a;
  }

  // The winch cable, and the one that falls on its red parachute after release.
  const dark = [36, 34, 38];
  for (const o of S.gl)
    if (o.cable) {
      stroke(S, o.X + o.dir * 3 * cos(o.pitch), o.yc - o.Z * SE - 3 * sin(o.pitch), o.X0 + o.dir * 58, 118, 0.18, 0.18);
      flush(S, dark, 0.75);
    }
  const cb = S.cable;
  if (cb) {
    stroke(S, cb.x, cb.y, cb.xw, 118, 0.18, 0.18);
    flush(S, dark, 0.75 * (1 - cb.t / 2));
    stroke(S, cb.x, cb.y - 1, cb.x, cb.y - 1, 0.7, 0.7);
    flush(S, [230, 50, 40], 1 - cb.t / 2);
  }
  // Gliders and buzzards, the far side of their circles first.
  for (const o of S.gl.slice().sort((p, q) => p.Z - q.Z)) craft(S, o, h);

  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, min(255, buf[p * 3]) | 0, min(255, buf[p * 3 + 1]) | 0, min(255, buf[p * 3 + 2]) | 0);
}
