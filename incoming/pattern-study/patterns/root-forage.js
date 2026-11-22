// ===== Patternflow pattern =====
// Title:   Root Forage
// Family:  roots
// Idea:    A vertical slice of dark layered soil in which cream roots grow tip by tip, bend toward drifting teal clouds of nitrate, branch where they find it and eat the clouds down, then let the emptied roots fade and send new tips on to the next cloud that the rain brings.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 220, after the root proliferation response in a nitrate patch (Drew 1975)
// Round:   220
// ===============================
// @matrix 64x128
// @knobs Hue=-0.08..0.1, Growth=0.6..3, Tropism=-1..1, Rain=-1..1
//
// Knob 1: Hue. TODO
// Knob 2: Growth. TODO
// Knob 3: Tropism. TODO
// Knob 4: Rain. TODO

// TODO design notes

const W = 64, H = 128, N = W * H;
const GW = 32, GH = 64, GN = GW * GH; // nutrient grid, 2 LEDs a cell
const SOIL = 8, G0 = SOIL >> 1; // first soil row, and the first grid row of soil
const { floor, ceil, min, max, sin, cos, exp, sqrt, abs, pow, tanh, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const F = (n) => new Float32Array(n);

const DS = 1.25; // LEDs between two nodes of a root
const YBOT = 121; // a tip that gets this deep stops
const NODE_CAP = 3400;
const V0 = [1.4, 1.3, 1.1, 0.9]; // tip speed by branch order, LEDs a second
const LIFE = [1e9, 26, 20, 16]; // seconds a stopped root of each order stays
const STARVE = [1e9, 30, 20, 12];
const MAXLEN = [88, 36, 17, 9]; // laterals are determinate: each stops at about this length // seconds a tip may sit in empty soil
const GCOST = 0.6, BIRTH = 4, YIELD = 6, BASE = 5, BMAX = 30;
const VMAX = 0.035, KM = 0.12, NABS = 28;
const LEACH = 0.03;
const BCELL = 7, BX = 10, BY = 19;

const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;

function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

// ---- noise
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

// soil colours down the section as [hue, saturation, value] at depth 0, 0.3, 0.65 and 1: a brown and a red-brown
const ZS = [0, 0.3, 0.65, 1];
const SA = [[0.078, 0.56, 0.27], [0.072, 0.58, 0.3], [0.06, 0.48, 0.22], [0.03, 0.32, 0.14]];
const SB = [[0.045, 0.66, 0.34], [0.04, 0.7, 0.37], [0.025, 0.55, 0.26], [-0.02, 0.38, 0.16]];

export function setup(params) {
  const S = {
    t: 0, ready: false, k1: 0, m2: 1, u3: 0.5, u4: 0.5,
    bm: 1, lmax: 6500, kr: 1.2, kc: 1, kg: 1, gsaM: 0.8, rainMean: 8, rainA: 0.8, rainS: 2.9, D: 0.1,
    n: F(GN), n2: F(GN), inj: [], B: 16, up: 0,
    nodes: [], tips: [], roots: [],
    stones: [], lum: F(N), tint: F(N), stone: F(N), wx: F(N), wy: F(N), tex: F(N), ys: F(W),
    cov: F(N), tone: F(N), glow: F(N), halo: F(N), tmp: F(N),
    hash: [], hashIn: 0, brIn: 0.5, finIn: 0,
    lutA: F(H * 3), lutB: F(H * 3),
    c: { nut: [0, 0, 0], root: [0, 0, 0], old: [0, 0, 0], tip: [0, 0, 0], stem: [0, 0, 0], t: [0, 0, 0] },
  };
  for (let i = 0; i < BX * BY; i++) S.hash.push([]);
  buildSoil(S);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.066);
  S.k1 = cl(k[0], -0.08, 0.1);
  S.m2 = mix(0.45, 1.6, (cl(k[1], 0.6, 3) - 0.6) / 2.4);
  S.u3 = (cl(k[2], -1, 1) + 1) / 2;
  S.u4 = (cl(k[3], -1, 1) + 1) / 2;
  knobs(S);
  if (!S.ready) {
    prerun(S);
    S.ready = true;
  }
  step(S, d);
  finish(S, d, false);
}

function knobs(S) {
  const u3 = S.u3, u4 = S.u4;
  S.bm = mix(0.35, 2.4, u3);
  S.kc = mix(0.1, 1.7, u3);
  S.kg = mix(1.5, 0.4, u3);
  S.gsaM = mix(0.25, 1.05, u3);
  S.rainMean = 9 * pow(4.2 / 9, u4);
  S.rainA = mix(0.85, 1.05, u4);
  S.rainS = mix(2.4, 3.2, u4);
  S.D = mix(0.04, 0.16, u4);
  S.lmax = 6500 * (0.75 + 0.5 * u3) * (0.8 + 0.4 * u4);
}

// ---- the soil, built once: layers, grain, a few stones
function buildSoil(S) {
  const st = S.stones;
  for (let g = 0; g < 300 && st.length < 5; g++) {
    const rx = 4.5 + 4.5 * Math.random(), ry = rx * (0.62 + 0.3 * Math.random());
    const x = 7 + rx + (W - 14 - 2 * rx) * Math.random(), y = 30 + ry + (H - 30 - 14 - 2 * ry) * Math.random();
    let ok = abs(x - 32) > 9 || y > 50;
    for (const o of st) if (((o.x - x) / (o.rx + rx + 7)) ** 2 + ((o.y - y) / (o.ry + ry + 7)) ** 2 < 1) ok = false;
    if (ok) st.push({ x, y, rx, ry, r: sqrt(rx * ry) * 1.05 });
  }
  for (let x = 0; x < W; x++) S.ys[x] = SOIL + 1.3 * (vn2(x * 0.11 + 4.7, 2.2) - 0.5) * 2;
  for (let y = SOIL - 2; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, xx = x + 0.5, yy = y + 0.5;
      const wv = vn2(xx * 0.03 + 3.1, yy * 0.025 + 1.7) - 0.5;
      const lay = vn2(xx * 0.018 + wv * 1.6 + 9.2, yy * 0.062 + wv * 1.2 + 4.4);
      S.tint[p] = sm(0.32, 0.68, lay);
      let l = 1 + 0.3 * (lay - 0.5) + 0.2 * (vn2(xx * 0.075 + 5.5, yy * 0.06 + 2.2) - 0.5) + 0.16 * (vn2(xx * 0.26 + 1.3, yy * 0.24 + 8.8) - 0.5) + 0.12 * (vn2(xx * 0.52 + 7.1, yy * 0.5 + 3.3) - 0.5);
      let sa = 0;
      for (const s of st) {
        const dx = (xx - s.x) / s.rx, dy = (yy - s.y) / s.ry;
        const d = sqrt(dx * dx + dy * dy) + (vn2(xx * 0.25 + 3, yy * 0.25 + 9) - 0.5) * 0.35;
        sa = max(sa, 1 - sm(0.78, 1, d));
      }
      S.stone[p] = sa;
      l += sa * (0.1 + 0.16 * (vn2(xx * 0.05 + 1.1, yy * 0.2 + 5.2) - 0.5));
      S.lum[p] = l;
      S.wx[p] = (vn2(xx * 0.1 + 12.2, yy * 0.1 + 6.1) - 0.5) * 3;
      S.wy[p] = (vn2(xx * 0.1 + 31.7, yy * 0.1 + 19.9) - 0.5) * 3;
      S.tex[p] = vn2(xx * 0.17 + 2.5, yy * 0.17 + 7.5);
    }
}

// ---- the nutrient field
function nAt(S, x, y) {
  const gx = cl(x * 0.5 - 0.5, 0, GW - 1.001), gy = cl(y * 0.5 - 0.5, G0, GH - 1.001);
  const i = floor(gx), j = floor(gy), fx = gx - i, fy = gy - j, n = S.n, p = j * GW + i;
  return n[p] * (1 - fx) * (1 - fy) + n[p + 1] * fx * (1 - fy) + n[p + GW] * (1 - fx) * fy + n[p + GW + 1] * fx * fy;
}

function blob(S, gx, gy, sx, sy, amp) {
  const n = S.n, i0 = max(0, floor(gx - 3 * sx)), i1 = min(GW - 1, ceil(gx + 3 * sx));
  const j0 = max(G0, floor(gy - 3 * sy)), j1 = min(GH - 1, ceil(gy + 3 * sy));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const dx = (i - gx) / sx, dy = (j - gy) / sy;
      n[j * GW + i] += amp * exp(-0.5 * (dx * dx + dy * dy));
    }
}

function newRain(S, left) {
  const sx = S.rainS * (0.85 + 0.3 * Math.random());
  S.inj.push({
    gx: 2 + Math.random() * (GW - 4), gy: 9 + Math.random() * ((H - 12 - SOIL - 10) / 2), sx, sy: sx * (0.8 + 0.7 * Math.random()),
    amp: S.rainA * (0.7 + 0.6 * Math.random()), left,
  });
}

function diffuse(S, dt) {
  const n = S.n, o = S.n2, D = S.D * dt;
  for (let j = G0; j < GH; j++) {
    const up = j > G0 ? -GW : 0, dn = j < GH - 1 ? GW : 0;
    for (let i = 0; i < GW; i++) {
      const p = j * GW + i, c = n[p];
      const l = i > 0 ? n[p - 1] : c, r = i < GW - 1 ? n[p + 1] : c;
      let v = c + D * (l + r + n[p + up] + n[p + dn] - 4 * c);
      v = v * (1 - (LEACH + 0.05 * v) * dt) - 0.002 * dt;
      o[p] = v < 1e-4 ? 0 : v > 1.3 ? 1.3 : v;
    }
  }
  S.n = o;
  S.n2 = n;
}

// ---- roots
function newNode(S, rt, par, x, y, s) {
  const nd = { x, y, r: -1, rT: 1, par, nx: null, rt, s, lat: null, flow: 1, ea: 1, born: S.t, cap: 9 };
  if (par && par.rt === rt) par.nx = nd;
  S.nodes.push(nd);
  return nd;
}

function makeRoot(S, ord, par, x, y, th, gsa) {
  const rt = { ord, pr: par ? par.rt : null, life: LIFE[ord] * (0.7 + 0.6 * Math.random()), stall: -1, alpha: 1, len: 0, tip: null };
  const nd = newNode(S, rt, par, x, y, 0);
  const tip = {
    x, y, th, w: 0, rt, node: nd, acc: 0, gsa, ord, alive: true, nl: nAt(S, x, y), hunger: 0, rn: 0, side: gsa >= 0 ? 1 : -1, glow: 0,
    maxLen: MAXLEN[ord] * (0.7 + 0.6 * Math.random()), nA: (ord === 0 ? 0.03 : 0.05) + (ord === 0 ? 0.03 : 0.07) * Math.random(), nP: Math.random() * 6.283, nW: 6.283 / (9 + 11 * Math.random()), v0: V0[ord] * (0.85 + 0.3 * Math.random()),
  };
  rt.tip = tip;
  S.roots.push(rt);
  S.tips.push(tip);
  return tip;
}

function crown(S) {
  // a taproot straight down and two sinkers that first run out to the sides
  const x0 = 32, y0 = SOIL + 2, sp = 0.7 + 0.6 * S.u3, side = Math.random() < 0.5 ? 1 : -1;
  makeRoot(S, 0, null, x0, y0, 0.04 * side, 0.03 * side).maxLen = 96 + 16 * Math.random();
  makeRoot(S, 0, null, x0 - 1.5, y0, -0.8, -0.5 * sp).maxLen = 56 + 14 * Math.random();
  makeRoot(S, 0, null, x0 + 1.5, y0, 0.8, 0.5 * sp).maxLen = 56 + 14 * Math.random();
}

function stepTips(S, dt) {
  const T = S.t, tips = S.tips, stones = S.stones;
  let up = 0;
  for (let k = 0; k < tips.length; k++) {
    const tp = tips[k];
    if (!tp.alive) continue;
    const ord = tp.ord, rt = tp.rt;
    let x = tp.x, y = tp.y, th = tp.th;
    const hx = sin(th), hy = cos(th), ex = hy, ey = -hx;
    const n0 = nAt(S, x, y);
    tp.nl += (n0 - tp.nl) * (1 - exp(-dt / 7));
    // chemotropism: the gradient of the nutrient at two reach, the near one counted a little more
    const gx = 0.4 * (nAt(S, x + 2.5, y) - nAt(S, x - 2.5, y)) / 5 + 0.35 * (nAt(S, x + 7, y) - nAt(S, x - 7, y)) / 14 + 0.25 * (nAt(S, x + 14, y) - nAt(S, x - 14, y)) / 28;
    const gy = 0.4 * (nAt(S, x, y + 2.5) - nAt(S, x, y - 2.5)) / 5 + 0.35 * (nAt(S, x, y + 7) - nAt(S, x, y - 7)) / 14 + 0.25 * (nAt(S, x, y + 14) - nAt(S, x, y - 14)) / 28;
    const gm = sqrt(gx * gx + gy * gy);
    let wt = S.kg * (ord === 0 ? 1.6 : 0.8) * -sin(th - tp.gsa);
    if (gm > 1e-6) wt += S.kc * (ord === 0 ? 0.4 : 1) * tanh(gm / 0.006) * ((gx * ex + gy * ey) / gm);
    wt += tp.nA * sin(tp.nP + tp.nW * T);
    tp.rn += -tp.rn * dt / 4 + (ord === 0 ? 0.06 : 0.13) * sqrt(dt) * gauss();
    wt += tp.rn;
    // crowding: turn away from the roots of others that lie within 7 LEDs
    let rx = 0, ry = 0;
    const cx = cl(floor(x / BCELL), 0, BX - 1), cy = cl(floor(y / BCELL), 0, BY - 1);
    for (let j = max(0, cy - 1); j <= min(BY - 1, cy + 1); j++)
      for (let i = max(0, cx - 1); i <= min(BX - 1, cx + 1); i++) {
        const b = S.hash[j * BX + i];
        for (let m = 0; m < b.length; m++) {
          const o = b[m], ort = o.rt;
          if (ort === rt || ort.pr === rt || (ort === rt.pr && rt.len < 8)) continue;
          const dx = x - o.x, dy = y - o.y, d2 = dx * dx + dy * dy;
          if (d2 > 49 || d2 < 1e-6) continue;
          const d = sqrt(d2), w = (1 - d / 7) ** 2 / d;
          rx += dx * w;
          ry += dy * w;
        }
      }
    wt += S.kr * (rx * ex + ry * ey + 0.6 * tp.side * max(0, -(rx * hx + ry * hy)));
    // the walls of the section turn a tip back in
    if (x < 8) wt += 3 * ((8 - x) / 7) * sin(0.9 - th);
    else if (x > 56) wt += 3 * ((x - 56) / 7) * sin(-0.9 - th);
    // a stone is walked around
    for (let q = 0; q < stones.length; q++) {
      const s = stones[q], dx = x - s.x, dy = y - s.y, dd = sqrt(dx * dx + dy * dy) || 1, edge = s.r + 2.4;
      if (dd < edge + 5) {
        const f = sm(edge + 5, edge, dd), nx = dx / dd, ny = dy / dd;
        wt += 2.4 * f * (ex * nx + ey * ny) + 1.2 * f * tp.side * max(0, -(hx * nx + hy * ny));
        if (dd < s.r + 0.8) {
          x = s.x + nx * (s.r + 0.8);
          y = s.y + ny * (s.r + 0.8);
        }
      }
    }
    // how fast: slower in a rich patch and in the deep, and by the plant's reserve
    const v = tp.v0 * S.m2 * (1 - 0.5 * sm(0.12, 0.7, tp.nl)) * (1 - 0.5 * sm(75, 124, y)) * (0.45 + 0.55 * sm(0, 5, S.B));
    // the bend of a root is limited, so it turns in an arc of at least 6 LEDs
    const wm = v * (ord === 0 ? 0.1 : 0.16);
    tp.w = cl(tp.w + (wt - tp.w) * (1 - exp(-dt / 2.4)), -wm, wm);
    th = cl(th + tp.w * dt, -1.75, 1.75);
    if (y < SOIL + 3) {
      y = SOIL + 3;
      th = cl(th, -1.45, 1.45);
    }
    const hx2 = sin(th), hy2 = cos(th);
    x = cl(x + hx2 * v * dt, 1, 62);
    y += hy2 * v * dt;
    tp.x = x;
    tp.y = y;
    tp.th = th;
    tp.acc += v * dt;
    S.B -= GCOST * v * dt;
    if (tp.acc >= DS) {
      tp.acc -= DS;
      const pn = tp.node, nd = newNode(S, rt, pn, x, y, pn.s + sqrt((x - pn.x) ** 2 + (y - pn.y) ** 2));
      tp.node = nd;
      rt.len = nd.s;
    }
    // eating: the apex and the young stretch behind it draw on the cells they lie in
    let nd = tp.node, q = 0;
    const rate = VMAX * dt;
    while (nd && nd.rt === rt && q < NABS) {
      const w = q < 6 ? 1 : 1 - (q - 5) / (NABS - 4), gi = cl(floor(nd.x * 0.5), 0, GW - 1), gj = cl(floor(nd.y * 0.5), G0, GH - 1), gp = gj * GW + gi, c = S.n[gp];
      if (c > 0.003) {
        let take = rate * w * c / (c + KM);
        if (take > c * 0.6) take = c * 0.6;
        S.n[gp] = c - take;
        up += take;
      }
      nd = nd.par;
      q++;
    }
    tp.glow = min(1, tp.glow + dt * 0.8);
    // a tip that sits in empty soil too long stops, and one that reaches the floor stops
    if (ord > 0 && tp.nl < 0.1) tp.hunger += dt;
    else tp.hunger = max(0, tp.hunger - 2 * dt);
    if (tp.hunger > STARVE[ord] * cl(1 / sqrt(S.m2), 0.75, 1.8) || y > YBOT || rt.len > tp.maxLen) {
      tp.alive = false;
      rt.tip = null;
      rt.stall = T;
    }
  }
  S.up = up;
  S.B = cl(S.B + up * YIELD + BASE * dt, 0, BMAX);
}

function spacingOK(S, nd) {
  const rt = nd.rt;
  let q = nd, k = 0;
  while (q && q.rt === rt && k < 7) {
    if (q.lat && q.lat.alpha > 0.2) return false;
    q = q.par;
    k++;
  }
  q = nd.nx;
  k = 0;
  while (q && k < 7) {
    if (q.lat && q.lat.alpha > 0.2) return false;
    q = q.nx;
    k++;
  }
  const cx = cl(floor(nd.x / BCELL), 0, BX - 1), cy = cl(floor(nd.y / BCELL), 0, BY - 1);
  for (let j = max(0, cy - 1); j <= min(BY - 1, cy + 1); j++)
    for (let i = max(0, cx - 1); i <= min(BX - 1, cx + 1); i++) {
      const b = S.hash[j * BX + i];
      for (let m = 0; m < b.length; m++) {
        const o = b[m];
        if (o.rt === rt) continue;
        const dx = o.x - nd.x, dy = o.y - nd.y;
        if (dx * dx + dy * dy < 42) return false;
      }
    }
  return true;
}

function rebuildHash(S) {
  for (let i = 0; i < S.hash.length; i++) S.hash[i].length = 0;
  for (const nd of S.nodes) if (nd.ea > 0.3) S.hash[cl(floor(nd.y / BCELL), 0, BY - 1) * BX + cl(floor(nd.x / BCELL), 0, BX - 1)].push(nd);
}

// Where the soil is rich the old roots put out laterals; where it is poor they do so seldom.
function branchScan(S, dtScan) {
  if (S.B < BIRTH || S.nodes.length > NODE_CAP) return;
  let alive = 0, fine = 0;
  for (const tp of S.tips) if (tp.alive) alive++;
  for (const nd of S.nodes) if (nd.rt.ord > 0) fine += nd.ea;
  const lim = cl((S.lmax - fine * DS) / (0.3 * S.lmax), 0, 1);
  const T = S.t, nodes = S.nodes, pmax = S.bm * (1 + 1.5 * cl((8 - alive) / 8, 0, 1)) * lim * 0.03 * dtScan;
  if (lim <= 0) return;
  let births = 0;
  for (let i = 0; i < nodes.length && births < 2; i++) {
    const nd = nodes[i], rt = nd.rt;
    if ((nd.lat && nd.lat.alpha > 0.2) || rt.ord >= 3 || rt.alpha < 0.95) continue;
    if (rt.tip && rt.len - nd.s < 8) continue;
    if (rt.ord > 0) {
      const age = T - nd.born;
      if (age < 4 || age > 150) continue;
    }
    if (Math.random() > pmax) continue;
    const nl = nAt(S, nd.x, nd.y), sat = nl / (nl + 0.25);
    if (Math.random() * 0.03 > 0.006 + 0.024 * sat) continue;
    if (!spacingOK(S, nd)) continue;
    // which side: toward the richer one, mostly
    const pn = nd.par || nd, dx = nd.x - pn.x, dy = nd.y - pn.y, nl2 = sqrt(dx * dx + dy * dy) || 1, th0 = Math.atan2(dx / nl2, dy / nl2);
    const ex = cos(th0), ey = -sin(th0), gside = nAt(S, nd.x + 5 * ex, nd.y + 5 * ey) - nAt(S, nd.x - 5 * ex, nd.y - 5 * ey);
    const side = Math.random() < 0.72 && abs(gside) > 0.01 ? (gside > 0 ? 1 : -1) : Math.random() < 0.5 ? 1 : -1;
    const mag = S.gsaM * (0.85 + 0.35 * Math.random());
    const th = cl(th0 + side * mix(0.55, 0.95, S.u3) * (0.85 + 0.3 * Math.random()), -1.75, 1.75);
    nd.lat = makeRoot(S, rt.ord + 1, nd, nd.x, nd.y, th, side * mag).rt;
    S.B -= BIRTH;
    births++;
    if (S.B < BIRTH) break;
  }
}

function step(S, dt) {
  S.t += dt;
  if (Math.random() < dt / S.rainMean) newRain(S, 3.5);
  for (let i = S.inj.length - 1; i >= 0; i--) {
    const r = S.inj[i], f = min(dt, r.left);
    blob(S, r.gx, r.gy, r.sx, r.sy, r.amp * f / 3.5);
    r.left -= dt;
    if (r.left <= 0) S.inj.splice(i, 1);
  }
  diffuse(S, dt);
  S.hashIn -= dt;
  if (S.hashIn <= 0) {
    rebuildHash(S);
    S.hashIn = 0.25;
  }
  stepTips(S, dt);
  for (let i = S.tips.length - 1; i >= 0; i--) if (!S.tips[i].alive) S.tips.splice(i, 1);
  S.brIn -= dt;
  if (S.brIn <= 0) {
    branchScan(S, 0.5);
    S.brIn = 0.5;
  }
}

// Roots fade and thin out, flows are summed down the tree, nodes that are gone are dropped.
function finish(S, dt, snap) {
  const T = S.t, nodes = S.nodes, roots = S.roots;
  for (let i = roots.length - 1; i >= 0; i--) {
    const rt = roots[i];
    rt.alpha = rt.tip ? 1 : 1 - sm(rt.life, rt.life + 16, T - rt.stall);
    if (!rt.tip && rt.alpha < 0.004) roots.splice(i, 1);
  }
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i];
    nd.flow = 1;
    nd.ea = nd.rt.alpha;
  }
  for (let i = nodes.length - 1; i >= 0; i--) {
    const nd = nodes[i], p = nd.par;
    if (p) {
      p.flow += nd.flow;
      if (nd.ea > p.ea) p.ea = nd.ea;
    }
  }
  const kr = snap ? 1 : 1 - exp(-dt / 5);
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i], rt = nd.rt, ord = rt.ord, s = nd.s, p = nd.par;
    let tr = ord === 0 ? 0.97 + 0.55 * exp(-s / 30) : ord === 1 ? 0.97 + 0.13 * exp(-s / 20) : 0.97;
    tr += 0.004 * sqrt(nd.flow - 1);
    nd.cap = p ? (p.rt !== rt ? max(1, p.rT * 0.95) : p.cap) : 9;
    tr = min(tr, nd.cap, 2);
    tr = 0.92 + (tr - 0.92) * sm(0, 9, rt.len - s);
    nd.rT = tr;
    if (nd.r < 0) nd.r = tr;
    else nd.r += (tr - nd.r) * kr;
  }
  S.finIn -= dt;
  if (S.finIn <= 0 || snap) {
    S.finIn = 1;
    let j = 0;
    for (let i = 0; i < nodes.length; i++) if (nodes[i].ea > 0.004) nodes[j++] = nodes[i];
    nodes.length = j;
  }
}

function prerun(S) {
  const nb = 4 + floor(Math.random() * 3);
  for (let i = 0; i < nb; i++) blob(S, 4 + Math.random() * 24, 12 + Math.random() * 46, S.rainS * (0.9 + 0.3 * Math.random()), S.rainS * (0.9 + 0.5 * Math.random()), S.rainA * (0.7 + 0.5 * Math.random()));
  crown(S);
  const secs = 60 + 60 * Math.random();
  let t = 0;
  while (t < secs) {
    step(S, 0.2);
    finish(S, 0.2, false);
    t += 0.2;
  }
  for (let i = 0; i < 2; i++) blob(S, 3 + Math.random() * 26, 14 + Math.random() * 44, S.rainS * (0.9 + 0.3 * Math.random()), S.rainS * (0.9 + 0.5 * Math.random()), S.rainA * (0.8 + 0.3 * Math.random()));
  finish(S, 0.2, true);
}

// ---- the picture
function palette(S) {
  const h = S.k1, c = S.c, t = c.t;
  for (let y = SOIL; y < H; y++) {
    const z = (y + 0.5 - SOIL) / (H - SOIL);
    let i = 0;
    while (i < 2 && z > ZS[i + 1]) i++;
    const f = (z - ZS[i]) / (ZS[i + 1] - ZS[i]);
    hsv(mix(SA[i][0], SA[i + 1][0], f) + 0.45 * h, mix(SA[i][1], SA[i + 1][1], f), mix(SA[i][2], SA[i + 1][2], f) * (1 + h), t);
    S.lutA[y * 3] = t[0];
    S.lutA[y * 3 + 1] = t[1];
    S.lutA[y * 3 + 2] = t[2];
    hsv(mix(SB[i][0], SB[i + 1][0], f) + 0.45 * h, mix(SB[i][1], SB[i + 1][1], f), mix(SB[i][2], SB[i + 1][2], f) * (1 + h), t);
    S.lutB[y * 3] = t[0];
    S.lutB[y * 3 + 1] = t[1];
    S.lutB[y * 3 + 2] = t[2];
  }
  hsv(0.47 + 2.4 * h, 0.82, 1, c.nut);
  hsv(0.12 + 0.4 * h, 0.15, 1, c.root);
  hsv(0.09 + 0.25 * h, 0.42, 0.7, c.old);
  hsv(0.13 + 0.25 * h, 0.06, 1, c.tip);
  hsv(0.16 + 0.3 * h, 0.22, 0.97, c.stem);
}

function capsule(S, ax, ay, bx, by, ra, rb, al, tone) {
  const R = max(ra, rb) + 1;
  const x0 = max(0, floor(min(ax, bx) - R)), x1 = min(W - 1, ceil(max(ax, bx) + R));
  const y0 = max(0, floor(min(ay, by) - R)), y1 = min(H - 1, ceil(max(ay, by) + R));
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, il2 = l2 > 1e-6 ? 1 / l2 : 0;
  const cov = S.cov, tn = S.tone;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5 - ay;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax;
      let t = (px * dx + py * dy) * il2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - dx * t, ey = py - dy * t, d = sqrt(ex * ex + ey * ey), r = ra + (rb - ra) * t;
      let c = r + 0.5 - d;
      if (c <= 0) continue;
      if (c > 1) c = 1;
      c = c * c * (3 - 2 * c) * al;
      const p = y * W + x;
      if (c > cov[p]) {
        cov[p] = c;
        tn[p] = tone;
      }
    }
  }
}

function drawRoots(S) {
  const T = S.t, nodes = S.nodes;
  S.cov.fill(0);
  S.tone.fill(0);
  S.glow.fill(0);
  // the stem stub above the ground, its node and the collar
  capsule(S, 32, -2, 32, 6, 1.7, 1.7, 1, -1);
  capsule(S, 32, 2.6, 32, 3.8, 2.5, 2.5, 1, -1);
  capsule(S, 32, 6, 32, SOIL + 2, 1.7, 2.3, 1, -1);
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i], p = nd.par;
    if (!p || nd.ea < 0.01) continue;
    const rt = nd.rt, tone = rt.stall >= 0 && rt.ord > 0 ? 0.65 * sm(0, rt.life, T - rt.stall) : 0;
    capsule(S, p.x, p.y, nd.x, nd.y, p.r, nd.r, nd.ea, tone);
  }
  for (const tp of S.tips) {
    if (!tp.alive) continue;
    const nd = tp.node;
    capsule(S, nd.x, nd.y, tp.x, tp.y, nd.r, 0.92, 1, 0);
    const gain = tp.glow * (0.55 + 0.45 * min(1.6, S.m2));
    const x0 = max(0, floor(tp.x - 7)), x1 = min(W - 1, ceil(tp.x + 7)), y0 = max(0, floor(tp.y - 7)), y1 = min(H - 1, ceil(tp.y + 7));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - tp.x, dy = y + 0.5 - tp.y, d2 = dx * dx + dy * dy;
        S.glow[y * W + x] += gain * (0.8 * exp(-d2 / 3.2) + 0.28 * exp(-d2 / 14));
      }
  }
  // a soft shadow round the roots, from a blur of the coverage
  const cov = S.cov, tmp = S.tmp, hl = S.halo;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      tmp[p] = 0.1 * (x > 1 ? cov[p - 2] : 0) + 0.2 * (x > 0 ? cov[p - 1] : 0) + 0.4 * cov[p] + 0.2 * (x < W - 1 ? cov[p + 1] : 0) + 0.1 * (x < W - 2 ? cov[p + 2] : 0);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      hl[p] = 0.1 * (y > 1 ? tmp[p - 2 * W] : 0) + 0.2 * (y > 0 ? tmp[p - W] : 0) + 0.4 * tmp[p] + 0.2 * (y < H - 1 ? tmp[p + W] : 0) + 0.1 * (y < H - 2 ? tmp[p + 2 * W] : 0);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  drawRoots(S);
  const c = S.c, nut = c.nut, rc = c.root, oc = c.old, tc = c.tip, sc = c.stem;
  const wet = 0.85 + 0.3 * S.u4;
  const { lutA, lutB, lum, tint, stone, wx, wy, tex, ys, cov, tone, glow, halo } = S, n = S.n;
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5, skyv = 0.035 + 0.04 * sm(0, SOIL, yy);
    for (let x = 0; x < W; x++) {
      const p = y * W + x, xx = x + 0.5;
      let r = skyv * 0.8, g = skyv * 0.95, b = skyv * 1.45;
      const cover = sm(ys[x] - 0.7, ys[x] + 0.7, yy);
      if (cover > 0) {
        const yi = y < SOIL ? SOIL : y, a0 = yi * 3, tt = tint[p], l = lum[p];
        let sr = (lutA[a0] + (lutB[a0] - lutA[a0]) * tt) * l, sg = (lutA[a0 + 1] + (lutB[a0 + 1] - lutA[a0 + 1]) * tt) * l, sb = (lutA[a0 + 2] + (lutB[a0 + 2] - lutA[a0 + 2]) * tt) * l;
        const st = stone[p];
        if (st > 0) {
          const gr = 0.3 * sr + 0.59 * sg + 0.11 * sb;
          sr += (gr * 1.15 - sr) * 0.5 * st;
          sg += (gr * 1.15 - sg) * 0.5 * st;
          sb += (gr * 1.15 - sb) * 0.5 * st;
        }
        const lip = 1 + 0.4 * exp(-(yy - ys[x]) / 1.6);
        sr *= lip;
        sg *= lip;
        sb *= lip;
        // the nutrient cloud, sampled through a small static warp so it does not follow the grid
        const gx = cl((xx + wx[p]) * 0.5 - 0.5, 0, GW - 1.001), gy = cl((yy + wy[p]) * 0.5 - 0.5, G0, GH - 1.001);
        const i = floor(gx), j = floor(gy), fx = gx - i, fy = gy - j, q = j * GW + i;
        const ng = n[q] * (1 - fx) * (1 - fy) + n[q + 1] * fx * (1 - fy) + n[q + GW] * (1 - fx) * fy + n[q + GW + 1] * fx * fy;
        const a = sm(0.03, 0.85, ng) * (0.85 + 0.3 * tex[p]) * wet;
        const k = 0.4 + 0.3 * a;
        sr = sr * (1 - 0.3 * a) + nut[0] * a * k;
        sg = sg * (1 - 0.3 * a) + nut[1] * a * k;
        sb = sb * (1 - 0.3 * a) + nut[2] * a * k;
        r += (sr - r) * cover;
        g += (sg - g) * cover;
        b += (sb - b) * cover;
      }
      const cv = cov[p], hh = 1 - 0.5 * cl(halo[p] * 2, 0, 1);
      r *= hh;
      g *= hh;
      b *= hh;
      if (cv > 0.003) {
        const tn = tone[p];
        let cr, cg, cb;
        if (tn < 0) {
          cr = sc[0];
          cg = sc[1];
          cb = sc[2];
        } else {
          cr = rc[0] + (oc[0] - rc[0]) * tn;
          cg = rc[1] + (oc[1] - rc[1]) * tn;
          cb = rc[2] + (oc[2] - rc[2]) * tn;
        }
        r += (cr - r) * cv;
        g += (cg - g) * cv;
        b += (cb - b) * cv;
      }
      const gl = glow[p];
      if (gl > 0.004) {
        r += (tc[0] - r) * min(1, gl);
        g += (tc[1] - g) * min(1, gl);
        b += (tc[2] - b) * min(1, gl);
      }
      display.setPixel(x, y, cl(r, 0, 1) * 255, cl(g, 0, 1) * 255, cl(b, 0, 1) * 255);
    }
  }
}
