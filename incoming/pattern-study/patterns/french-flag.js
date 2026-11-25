// ===== Patternflow pattern =====
// Title:   French Flag
// Family:  morphogen
// Idea:    A living sheet of about 260 jewel-like cells streams down the panel from a top edge where four wandering morphogen sources are made, each cell colours itself one of five fates by how its noisy reading of the local concentration crosses four thresholds, so the smooth gradient becomes five curved bands that slide up and down for minutes, while misread cells sort back towards their own band and cells at the top divide to keep the sheet full.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the French flag model of positional information, in which cells read a morphogen concentration against thresholds and take one of several fates (Lewis Wolpert, "Positional information and the spatial pattern of cellular differentiation", 1969), a gradient made by a source, diffusion and decay (Francis Crick 1970, from memory), and the sharpening of the borders by cells that read the noisy gradient wrongly and sort into the right domain (Xiong, Megason and colleagues, zebrafish neural tube, Cell 2013, from memory); the wandering sources, the conveyor with its dividing top, the five hues and the cell drawing are original, pattern round 245
// Round:   245
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Range=0..4, Sorting=-1..1, Growth=-1..1
//
// Knob 1: Hue. Turns all five fate colours round the wheel together. At 0 the fates run indigo, blue-teal, green, gold and coral from the far end to the source end; each hue also drifts up to 20 degrees on its own slow clock of two to five minutes, so the relations between the colours never repeat.
// Knob 2: Range. 0 to 4, opening at 2. The decay length of the morphogen, 15 LED at 0, 33 at 2 and 72 at 4. Short, the bands are thin and crowded under the top edge with indigo below; at 2 five bands of about 25 LED share the panel; long, the bands are two or three times as thick and the first border has gone down to the middle.
// Knob 3: Sorting. -1 to 1, opening at 0. How fast a cell that is in the minority among its neighbours walks towards its own fate: not at all at -1, 1.4 LED a second at 0 and 5.5 at 1. At -1 the borders stay a ragged salt and pepper about 15 LED deep; at 1 they are crisp and now and then a cell runs off through the wrong band.
// Knob 4: Growth. -1 to 1, opening at about 0.06. How fast the sheet flows down and divides at the top: 0.16 LED a second at -1, 0.6 at 0.06 and 2 at 1. At -1 the sheet is almost still and only breathes; at 1 it streams, new cells appear every half second and the bands are carried through it.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, log, pow, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const NM = 420;                              // most cells the arrays hold
const GW = 32, GH = 64, GS = 2;              // the morphogen grid, GS LED to a grid cell
const NBX = 6, BSX = W / NBX, NBY = 14, BSY = 11, BY0 = 8;   // buckets of the neighbour hash
const KD = 0.16;                             // decay rate of the morphogen, 1 / s
const DX = 1.5;                              // lateral diffusion, LED squared a second; small, so the arcs reach the bottom
const PSIG = 10;                              // width of a source patch, LED
const SIGN = 0.28;                           // spread of a cell's own reading, natural log units
const HYS = 0.06;                            // a cell changes fate only this far past a threshold
const CDIV = 1.72;                           // a cell divides when its crowding falls below this
const TH = [-3.0, -2.05, -1.2, -0.35];     // the four thresholds, log concentration
const FH = [246, 192, 138, 55, 356];            // fate hues at knob 0, degrees
const FS = [0.66, 0.72, 0.62, 0.84, 0.62];
const FV = [0.68, 0.82, 0.8, 1, 1];
const FT = [137, 181, 233, 271, 313];        // seconds of each fate's hue drift
const PX0 = [8, 24, 40, 56], PXT = [53, 79, 113, 149];   // where the sources sit and how long each wanders
const PST = [67, 97, 131, 173];              // seconds each source takes to swell and sag
const LIFT = new Float32Array(H).map((_, y) => 0.17 * exp(-y / 14));   // the source end is a touch lighter

function hsv(h, s, v, out, o) {
  h = h / 360;
  h -= floor(h);
  const hh = h * 6, i = floor(hh) % 6, f = hh - floor(hh), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], sk: [0, 2, 0, 0.06], init: false, t: 0, n: 0, lam: 33, vflow: 0.6, sortv: 1.4,
    x: f(NM), y: f(NM), r: f(NM), r0: f(NM), ln: f(NM), lt: f(NM), nt: f(NM), hold: f(NM), p: f(NM), bri: f(NM), ph: f(NM), cd: f(NM),
    wx: f(NM), wy: f(NM), sx: f(NM), sy: f(NM), crowd: f(NM), ax: f(NM), ay: f(NM),
    fate: new Int8Array(NM), maj: new Int8Array(NM), minor: new Int8Array(NM),
    head: new Int32Array(NBX * NBY), nxt: new Int32Array(NM), hist: new Int32Array(5), pr: f(8),
    c: f(GW * GH), rhs: f(GW * GH), cp: f(GH), dn: f(GH), dd: f(GH), prof: f(GW), sf: f(GW),
    pp: new Array(12).fill(0).map(() => rnd() * TAU), fp: new Array(5).fill(0).map(() => rnd() * TAU),
    px: f(4), ps: f(4), pal: f(15), cr: f(NM), cg: f(NM), cb: f(NM),
    W1: f(W * H), W2: f(W * H), DR: f(W * H), ID: new Int16Array(W * H),
  });
  st.A = [st.x, st.y, st.r, st.r0, st.ln, st.lt, st.nt, st.hold, st.p, st.bri, st.ph, st.cd, st.wx, st.wy, st.sx, st.sy, st.crowd, st.fate, st.maj, st.minor];
  return st;
}

// ---- the morphogen ----------------------------------------------------------
// The sources: four Gaussian patches along the top rows. Each centre wanders in x on its own clock and each strength
// swings between half and twice, on clocks that divide none of the others.
function patches(st) {
  const t = st.t, pp = st.pp;
  for (let p = 0; p < 4; p++) {
    st.px[p] = PX0[p] + 11 * sin(TAU * t / PXT[p] + pp[p]);
    st.ps[p] = pow(2, sin(TAU * t / PST[p] + pp[4 + p]));
  }
  const prof = st.prof;
  for (let g = 0; g < GW; g++) {
    const xx = g * GS + GS / 2;
    let s = 0;
    for (let p = 0; p < 4; p++) {
      let d = abs(xx - st.px[p]);
      d = d - W * floor(d / W + 0.5);
      s += st.ps[p] * exp(-(d * d) / (2 * PSIG * PSIG));
    }
    prof[g] = s;
  }
}

// dc/dt = Dy c_yy + Dx c_xx - k(x) c - v c_y + source, the y part implicit so a long range does not need a hundred sub-steps.
// The decay length also swells and sags along x in two travelling waves, so the bands are fanned and arched, not parallel.
function fieldStep(st, dt) {
  const { c, rhs, cp, dn, dd, prof } = st, t = st.t, pp = st.pp;
  patches(st);
  const lam = st.lam, Dy = lam * lam * KD, r = Dy / (GS * GS), va = st.vflow / GS;
  const lo = -dt * (r + va), up = -dt * r, norm = pow(33 / lam, 0.9);
  const lx = dt * DX / (GS * GS);
  for (let gy = 0; gy < GH; gy++) {
    const o = gy * GW;
    for (let gx = 0; gx < GW; gx++) {
      const v = c[o + gx];
      let q = v + lx * (c[o + ((gx + 1) & (GW - 1))] + c[o + ((gx + GW - 1) & (GW - 1))] - 2 * v);
      if (gy < 2) q += dt * st.sf[gx] * prof[gx];
      rhs[o + gx] = q;
    }
  }
  for (let gx = 0; gx < GW; gx++) {
    const a = TAU * gx / GW;
    const km = exp(-2 * (0.15 * sin(a + TAU * t / 89 + pp[8]) + 0.09 * sin(2 * a - TAU * t / 127 + pp[9]))), kk = KD * km;
    st.sf[gx] = sqrt(Dy * kk) / 4 * norm;
    for (let i = 0; i < GH; i++) {
      let b = 1 + dt * (2 * r + kk + va);
      if (i === 0) b = 1 + dt * (r + kk);
      dn[i] = i === 0 ? b : b - lo * cp[i - 1];
      cp[i] = up / dn[i];
    }
    dd[0] = rhs[gx] / dn[0];
    for (let i = 1; i < GH; i++) dd[i] = (rhs[i * GW + gx] - lo * dd[i - 1]) / dn[i];
    let nx = dd[GH - 1];
    c[(GH - 1) * GW + gx] = nx;
    for (let i = GH - 2; i >= 0; i--) {
      nx = dd[i] - cp[i] * nx;
      c[i * GW + gx] = nx;
    }
  }
}

function lnConc(c, xx, yy) {
  const gx = xx / GS - 0.5;
  let gy = yy / GS - 0.5;
  if (gy < 0) gy = 0;
  else if (gy > GH - 1.001) gy = GH - 1.001;
  const ix = floor(gx), fx = gx - ix, iy = floor(gy), fy = gy - iy;
  const x0 = (ix + GW) & (GW - 1), x1 = (ix + 1 + GW) & (GW - 1), o = iy * GW;
  const v = (c[o + x0] * (1 - fx) + c[o + x1] * fx) * (1 - fy) + (c[o + GW + x0] * (1 - fx) + c[o + GW + x1] * fx) * fy;
  return log(v + 1e-5);
}

// ---- the cells ----------------------------------------------------------------
function readFate(u, f) {
  let raw = 0;
  for (let j = 0; j < 4; j++) if (u > TH[j]) raw++;
  if (raw > f) return u > TH[f] + HYS ? raw : f;
  if (raw < f) return u < TH[f - 1] - HYS ? raw : f;
  return f;
}

function initWorld(st) {
  st.lam = 15 * pow(4.8, cl(st.sk[1], 0, 4) / 4);
  patches(st);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) st.c[gy * GW + gx] = st.prof[gx] * exp(-(gy * GS + 1) / st.lam);
  for (let i = 0; i < 40; i++) fieldStep(st, 1 / 30);
  const NC = 11, NR = 24;
  let n = 0;
  for (let row = 0; row < NR; row++) {
    for (let col = 0; col < NC; col++) {
      const i = n++;
      st.x[i] = (((col + 0.5 * (row & 1)) * W / NC + 0.8 * gauss()) % W + W) % W;
      st.y[i] = (row + 0.5) * H / NR + 0.8 * gauss();
      newCell(st, i);
      st.r[i] = st.r0[i];
      st.cd[i] = rnd() * 6;
      st.ln[i] = st.lt[i];
      const u = lnConc(st.c, st.x[i], st.y[i]) + st.ln[i];
      let f = 0;
      for (let j = 0; j < 4; j++) if (u > TH[j]) f++;
      st.fate[i] = f;
      st.p[i] = f;
    }
  }
  st.n = n;
}

function newCell(st, i) {
  st.r0[i] = 2.65 + 0.7 * rnd();
  st.lt[i] = SIGN * cl(gauss(), -2.2, 2.2);
  st.nt[i] = 3 + 3 * rnd();
  st.bri[i] = 0.93 + 0.14 * rnd();
  st.ph[i] = rnd() * TAU;
  st.hold[i] = 0;
  st.cd[i] = 6 + 6 * rnd();
  st.wx[i] = st.wy[i] = st.sx[i] = st.sy[i] = 0;
}

function copyCell(st, a, b) {
  for (const arr of st.A) arr[b] = arr[a];
}

function divide(st, i) {
  const { x, y, r, r0, head, nxt, pr } = st;
  const bx = cl(floor(x[i] / BSX), 0, NBX - 1), by = cl(floor((y[i] + BY0) / BSY), 0, NBY - 1);
  pr.fill(0);
  for (let gy = by - 1; gy <= by + 1; gy++) {
    if (gy < 0 || gy >= NBY) continue;
    for (let gx = bx - 1; gx <= bx + 1; gx++) {
      for (let j = head[gy * NBX + ((gx + NBX) % NBX)]; j >= 0; j = nxt[j]) {
        if (j === i) continue;
        let dx = x[j] - x[i];
        if (dx > 32) dx -= W;
        else if (dx < -32) dx += W;
        const dy = y[j] - y[i], d = sqrt(dx * dx + dy * dy), lim = 1.6 * (r[i] + r[j]);
        if (d >= lim) continue;
        const w = 1 - d / lim, a = atan2(dy, dx);
        for (let k = 0; k < 8; k++) {
          const cc = cos(a - k * PI / 8);
          pr[k] += w * cc * cc;
        }
      }
    }
  }
  // the axis along which the cell has most room is its long axis
  let bk = 0;
  for (let k = 1; k < 8; k++) if (pr[k] < pr[bk]) bk = k;
  const th = bk * PI / 8 + (rnd() - 0.5) * 0.25, ux = cos(th), uy = sin(th), off = 0.27 * r[i] * 2;
  const m = st.n++;
  copyCell(st, i, m);
  x[m] = (((x[i] - ux * off) % W) + W) % W;
  y[m] = max(0.6 * r[i], y[i] - uy * off);
  x[i] = (((x[i] + ux * off) % W) + W) % W;
  y[i] = max(0.6 * r[i], y[i] + uy * off);
  for (const j of [i, m]) {
    r[j] = 0.72 * r[i];
    r0[j] = 2.65 + 0.7 * rnd();
    st.lt[j] = SIGN * cl(gauss(), -2.2, 2.2);
    st.nt[j] = 3 + 3 * rnd();
    st.hold[j] = 1 + 0.6 * rnd();
    st.cd[j] = 3.5 + 3.5 * rnd();
    st.bri[j] = cl(st.bri[i] + 0.04 * gauss(), 0.92, 1.08);
    st.wx[j] = st.wy[j] = 0;
  }
}

// Where the conveyor has pulled the top apart so far that a cell would fit, the nearest cell buds a daughter into the hole.
function fillHoles(st) {
  const { x, y, r0, head, nxt } = st;
  let made = 0;
  for (let q = 0; q < 8 && made < 2 && st.n < NM - 1; q++) {
    const px = rnd() * W, py = 1.5 + rnd() * rnd() * 30;
    const bx = cl(floor(px / BSX), 0, NBX - 1), by = cl(floor((py + BY0) / BSY), 0, NBY - 1);
    let gap = 99, mi = -1;
    for (let gy = by - 1; gy <= by + 1; gy++) {
      if (gy < 0 || gy >= NBY) continue;
      for (let gx = bx - 1; gx <= bx + 1; gx++) {
        for (let j = head[gy * NBX + ((gx + NBX) % NBX)]; j >= 0; j = nxt[j]) {
          let dx = x[j] - px;
          if (dx > 32) dx -= W;
          else if (dx < -32) dx += W;
          const dy = y[j] - py, g = sqrt(dx * dx + dy * dy) - r0[j];
          if (g < gap) {
            gap = g;
            mi = j;
          }
        }
      }
    }
    if (gap < 2.4 || mi < 0) continue;
    const m = st.n++;
    copyCell(st, mi, m);
    st.x[m] = px;
    st.y[m] = py;
    st.r[m] = 1.2;
    st.r0[m] = 2.65 + 0.7 * rnd();
    st.lt[m] = SIGN * cl(gauss(), -2.2, 2.2);
    st.nt[m] = 3 + 3 * rnd();
    st.hold[m] = 1 + 0.6 * rnd();
    st.cd[m] = 4 + 3 * rnd();
    st.wx[m] = st.wy[m] = st.sx[m] = st.sy[m] = 0;
    nxt[m] = head[by * NBX + bx];
    head[by * NBX + bx] = m;
    made++;
  }
}

function cells(st, dt) {
  const { x, y, r, r0, ln, lt, nt, hold, p, cd, ax, ay, crowd, wx, wy, sx, sy, fate, maj, minor, head, nxt, hist, c } = st;
  let n = st.n;
  const beta = 1 - exp(-dt * 14);
  head.fill(-1);
  for (let i = 0; i < n; i++) {
    const b = cl(floor((y[i] + BY0) / BSY), 0, NBY - 1) * NBX + cl(floor(x[i] / BSX), 0, NBX - 1);
    nxt[i] = head[b];
    head[b] = i;
  }
  // neighbours: push apart, count crowding, count the fates around
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], ri = r[i], bx = cl(floor(xi / BSX), 0, NBX - 1), by = cl(floor((yi + BY0) / BSY), 0, NBY - 1);
    let cr = 0, fx = 0, fy = 0, nn = 0;
    hist.fill(0);
    const top = yi < 9;
    for (let gy = by - 1; gy <= by + 1; gy++) {
      if (gy < 0 || gy >= NBY) continue;
      for (let gx = bx - 1; gx <= bx + 1; gx++) {
        for (let j = head[gy * NBX + ((gx + NBX) % NBX)]; j >= 0; j = nxt[j]) {
          if (j === i) continue;
          let dx = x[j] - xi;
          if (dx > 32) dx -= W;
          else if (dx < -32) dx += W;
          const dy = y[j] - yi, d0 = ri + r[j], lim = 1.6 * d0, d2 = dx * dx + dy * dy;
          if (top && y[j] < 9) {
            const gy2 = -y[j] - yi, g2 = dx * dx + gy2 * gy2;
            if (g2 < lim * lim) cr += 1 - sqrt(g2) / lim;
          }
          if (d2 >= lim * lim) continue;
          let d = sqrt(d2), nx, ny;
          if (d < 1e-3) {
            const a = rnd() * TAU;
            nx = cos(a);
            ny = sin(a);
            d = 1e-3;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          cr += 1 - d / lim;
          if (d < d0) {
            const o = 0.5 * beta * (d0 - d);
            fx -= nx * o;
            fy -= ny * o;
          } else if (d < 1.3 * d0) {
            const o = 0.5 * beta * 0.12 * (d - d0);
            fx += nx * o;
            fy += ny * o;
          }
          if (d < 1.5 * d0) {
            hist[fate[j]]++;
            nn++;
          }
        }
      }
    }
    if (top) {
      const dg = 2 * yi, lim = 3.2 * ri;
      if (dg < lim) cr += 1 - dg / lim;
    }
    if (yi < 0.6 * ri) fy += beta * (0.6 * ri - yi);
    ax[i] = fx;
    ay[i] = fy;
    crowd[i] = cr;
    let best = 0, bf = 0;
    for (let f = 0; f < 5; f++) if (hist[f] > best) { best = hist[f]; bf = f; }
    maj[i] = bf;
    minor[i] = nn >= 3 && hist[fate[i]] * 2 < best ? 1 : 0;
  }
  // a cell in the minority walks towards the nearest cells of its own fate, or up or down the gradient when none are near
  const sv = st.sortv, ks = 1 - exp(-dt / 0.5);
  for (let i = 0; i < n; i++) {
    let tx = 0, ty = 0;
    if (minor[i] && sv > 0.02) {
      const xi = x[i], yi = y[i], bx = cl(floor(xi / BSX), 0, NBX - 1), by = cl(floor((yi + BY0) / BSY), 0, NBY - 1), f = fate[i];
      let dx0 = 0, dy0 = 0;
      for (let gy = by - 2; gy <= by + 2; gy++) {
        if (gy < 0 || gy >= NBY) continue;
        for (let gx = bx - 2; gx <= bx + 2; gx++) {
          for (let j = head[gy * NBX + ((gx + NBX * 2) % NBX)]; j >= 0; j = nxt[j]) {
            if (j === i || fate[j] !== f) continue;
            let dx = x[j] - xi;
            if (dx > 32) dx -= W;
            else if (dx < -32) dx += W;
            const dy = y[j] - yi, d = sqrt(dx * dx + dy * dy);
            if (d > 20 || d < 1e-3) continue;
            const w = 1 / (d + 4);
            dx0 += dx / d * w;
            dy0 += dy / d * w;
          }
        }
      }
      const l = sqrt(dx0 * dx0 + dy0 * dy0);
      if (l > 0) {
        dx0 /= l;
        dy0 /= l;
      }
      dy0 += f > maj[i] ? -0.5 : 0.5;
      const l2 = sqrt(dx0 * dx0 + dy0 * dy0) + 1e-6;
      tx = sv * dx0 / l2;
      ty = sv * dy0 / l2;
    }
    sx[i] += (tx - sx[i]) * ks;
    sy[i] += (ty - sy[i]) * ks;
  }
  // readings, blends, drift and growth of each cell
  const kn = 1 - exp(-dt / 0.6), kp = 1 - exp(-dt / 0.5), kr = 1 - exp(-dt / 2.5), vf = st.vflow;
  const wd = exp(-dt / 4), wa = 0.55 * sqrt(2 / 4) * sqrt(dt);
  const div = [];
  for (let i = 0; i < n; i++) {
    nt[i] -= dt;
    if (nt[i] <= 0) {
      nt[i] = 3 + 3 * rnd();
      lt[i] = SIGN * cl(gauss(), -2.2, 2.2);
    }
    ln[i] += (lt[i] - ln[i]) * kn;
    if (hold[i] > 0) hold[i] -= dt;
    else fate[i] = readFate(lnConc(c, x[i], y[i]) + ln[i], fate[i]);
    p[i] += (fate[i] - p[i]) * kp;
    r[i] += (r0[i] - r[i]) * kr;
    cd[i] -= dt;
    wx[i] = wx[i] * wd + wa * gauss();
    wy[i] = wy[i] * wd + wa * gauss();
    if (cd[i] <= 0 && y[i] < 46 && crowd[i] < CDIV && rnd() < dt * 2.5 && n + div.length < NM - 1 && div.length < 3) div.push(i);
    const s = cl(y[i] / 26, 0, 1), vy = vf * s * s * (3 - 2 * s);
    let nx = x[i] + (wx[i] + sx[i]) * dt + ax[i];
    nx -= W * floor(nx / W);
    x[i] = nx;
    y[i] += (vy + wy[i] + sy[i]) * dt + ay[i];
  }
  for (const i of div) divide(st, i);
  fillHoles(st);
  n = st.n;
  // cells that have gone out at the bottom
  for (let i = n - 1; i >= 0; i--) {
    if (y[i] > H + r[i] + 1.5) {
      n--;
      if (i !== n) copyCell(st, n, i);
    }
  }
  st.n = n;
}

function sim(st, dt) {
  st.t += dt;
  const k = st.k, sk = st.sk, ks = 1 - exp(-dt / 0.35);
  for (let i = 0; i < 4; i++) sk[i] += (k[i] - sk[i]) * ks;
  const K3 = cl(sk[2], -1, 1), K4 = cl(sk[3], -1, 1);
  st.lam = 15 * pow(4.8, cl(sk[1], 0, 4) / 4);
  st.vflow = 0.16 * pow(12.5, (K4 + 1) / 2);
  st.sortv = 5 * pow((K3 + 1) / 2, 2.3);
  fieldStep(st, dt);
  cells(st, dt);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    st.sk = st.k.slice();
    initWorld(st);
    // 26 s already gone, so the first frame is a tissue with its bands, its sorting and its divisions under way
    for (let i = 0; i < 780; i++) sim(st, 1 / 30);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) sim(st, dt);
}

// ---- the picture --------------------------------------------------------------
function palette(st) {
  const t = st.t, h0 = 360 * st.sk[0], pal = st.pal;
  for (let f = 0; f < 5; f++) hsv(h0 + FH[f] + 16 * sin(TAU * t / FT[f] + st.fp[f]), FS[f], FV[f], pal, f * 3);
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  palette(st);
  const { x, y, r, p, bri, ph, cr, cg, cb, pal, W1, W2, DR, ID } = st, n = st.n, t = st.t;
  W1.fill(1e9);
  W2.fill(1e9);
  for (let i = 0; i < n; i++) {
    const pp = cl(p[i], 0, 3.9999), f0 = floor(pp), fr = pp - f0, o = f0 * 3;
    const br = bri[i] * (1 + 0.08 * sin(TAU * t / (6 + 5 * ((ph[i] * 1.618) % 1)) + ph[i]));
    cr[i] = (pal[o] * (1 - fr) + pal[o + 3] * fr) * br;
    cg[i] = (pal[o + 1] * (1 - fr) + pal[o + 4] * fr) * br;
    cb[i] = (pal[o + 2] * (1 - fr) + pal[o + 5] * fr) * br;
    // Voronoi with the radii as weights: each pixel keeps the nearest and second nearest cell
    const cx = x[i], cy = y[i], ri = r[i], rb = ri + 2.7;
    const y0 = max(0, floor(cy - rb)), y1 = min(H - 1, floor(cy + rb)), xa = floor(cx - rb), xb = floor(cx + rb);
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - cy, row = yy * W;
      for (let xx = xa; xx <= xb; xx++) {
        const dx = xx + 0.5 - cx, d = sqrt(dx * dx + dy * dy), w = d - ri, k = row + ((xx + W) & (W - 1));
        if (w < W1[k]) {
          W2[k] = W1[k];
          W1[k] = w;
          ID[k] = i;
          DR[k] = d;
        } else if (w < W2[k]) W2[k] = w;
      }
    }
  }
  for (let yy = 0; yy < H; yy++) {
    const lf = LIFT[yy];
    for (let xx = 0; xx < W; xx++) {
      const k = yy * W + xx, w1 = W1[k];
      if (w1 > 50) {
        display.setPixel(xx, yy, 0, 0, 0);
        continue;
      }
      const i = ID[k], d = DR[k], rc = r[i] + 0.35;
      const ae = cl((W2[k] - w1) * 0.5 - 0.15, 0, 0.75) / 0.75, ad = cl((rc - d) / 0.9 + 0.5, 0, 1);
      const a = ae * ad, dn = d / rc, sh = 1 + 0.07 * (1 - dn * dn), g = 0.07 + 0.93 * a;
      let R = cr[i] * sh * g, G = cg[i] * sh * g, B = cb[i] * sh * g;
      const l = lf * a;
      R += (255 - R) * l;
      G += (255 - G) * l;
      B += (255 - B) * l;
      display.setPixel(xx, yy, cl(floor(R + 0.5), 0, 255), cl(floor(G + 0.5), 0, 255), cl(floor(B + 0.5), 0, 255));
    }
  }
}
