// ===== Patternflow pattern =====
// Title:   Differential Growth
// Family:  differentialgrowth
// Idea:    Two or three closed loops of springy nodes grow inside a rounded box where a slowly drifting field says which stretches swell and which die back, so each line buckles against its own neighbours into a spaced labyrinth of folds that keeps folding over and re-organising, coloured along its length with the growing ends brighter.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 228; the method is differential growth of a closed line (nodes on springs, a repulsion between every pair closer than a radius, a new node when an edge gets long), as used for generative art by Jonathan McCabe and Anders Hoff around 2010, from memory
// Round:   230
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.8..3, Spacing=-1..1, Unevenness=-1..1
//
// Knob 1: Hue. Turns the whole gradient round the wheel; at 0 the line runs from rose through violet to blue.
// Knob 2: Growth. How fast the swelling stretches lengthen and the field that picks them drifts, from 0.4 to 1.5 times its pace at the opening 2.
// Knob 3: Spacing. How far a fold keeps from the next, 4.1 LEDs at -1, 4.9 at 0 and 5.7 at 1, so the labyrinth goes from a tight coral to a loose one with wide black lanes.
// Knob 4: Unevenness. How much the growth field differs from place to place: at -1 the line swells almost evenly and wanders, at 1 the swelling is confined to a few lobes and the rest dies back hard.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, exp, abs, max, min, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The rounded box the line lives in: a superellipse, centre line positions only.
const CX = 32, CY = 64, AX = 28.8, AY = 60.8, NEXP = 2.6;
const MAXN = 1500;
const SUB = 2;
// Edge natural length: an edge longer than RLMAX splits, a shorter one merges with the next.
const RLMAX = 3.2, RLMIN = 1.2;

// Drifting growth field: five waves, wavelength in LEDs, direction, angular speed and phase.
const WAVES = [];
{
  const spec = [
    [46, 0.35, 0.071, 0.4, 1.0],
    [61, 1.9, 0.094, 2.1, 0.8],
    [38, 2.9, -0.057, 4.4, 0.7],
    [83, 1.25, 0.121, 1.3, 0.6],
    [55, 4.1, -0.083, 5.2, 0.5],
  ];
  for (const [lam, ang, w, ph, a] of spec) WAVES.push({ kx: (TAU / lam) * cos(ang), ky: (TAU / lam) * sin(ang), w, ph, a });
}
const WSUM = WAVES.reduce((s, v) => s + v.a, 0);

function field(P, x, y) {
  let s = 0;
  for (let k = 0; k < WAVES.length; k++) {
    const v = WAVES[k];
    s += v.a * sin(v.kx * x + v.ky * y + v.w * P.ft + v.ph);
  }
  return cl((s / WSUM) * 1.7, -1, 1);
}

function hsv(out, h, s, v) {
  h = (h - floor(h)) * 6;
  for (let i = 0; i < 3; i++) {
    const k = (5 - 2 * i + h) % 6;
    out[i] = 255 * v * (1 - s * max(0, min(k, 4 - k, 1)));
  }
  return out;
}

// ---- container ----------------------------------------------------------------------------
// g is 1 on the wall and below 1 inside; the gradient says which way is out.
const WG = [0, 0, 0];
function wallG(x, y) {
  const dx = x - CX, dy = y - CY;
  const ux = abs(dx) / AX, uy = abs(dy) / AY;
  const u = pow(ux, NEXP) + pow(uy, NEXP);
  const g = pow(u, 1 / NEXP);
  const q = u > 1e-9 ? pow(u, 1 / NEXP - 1) : 0;
  WG[0] = g;
  WG[1] = q * pow(ux, NEXP - 1) * (dx < 0 ? -1 : 1) / AX;
  WG[2] = q * pow(uy, NEXP - 1) * (dy < 0 ? -1 : 1) / AY;
  return WG;
}

// ---- state ----------------------------------------------------------------------------------
function newLoop(P, cx, cy, r, m, c0, wob) {
  const L = { n: m, c0, x: [], y: [], rl: [], act: [], ld: [], dying: false, fade: 1 };
  const ph = Math.random() * TAU;
  const len = (TAU * r) / m;
  for (let i = 0; i < m; i++) {
    const a = (i / m) * TAU;
    const rr = r * (1 + wob * (Math.random() - 0.5));
    L.x.push(cx + cos(a + ph) * rr);
    L.y.push(cy + sin(a + ph) * rr);
    L.rl.push(len);
    L.act.push(0.3);
    L.ld.push(0);
  }
  P.loops.push(L);
  return L;
}

export function setup(params) {
  const P = params;
  Object.assign(P, {
    loops: [],
    ft: 0,
    ph: 0,
    started: false,
    R: 4.5,
    seedWait: 0,
    X: new Float32Array(MAXN + 64), Y: new Float32Array(MAXN + 64),
    DX: new Float32Array(MAXN + 64), DY: new Float32Array(MAXN + 64),
    LD: new Float32Array(MAXN + 64), S: new Float32Array(MAXN + 64),
    LI: new Int16Array(MAXN + 64), LN: new Float32Array(MAXN + 64),
    nxt: new Int32Array(MAXN + 64),
    head: new Int32Array(2200),
    buf: new Float32Array(W * H * 3),
    sa: new Float32Array(MAXN + 64),
    total: 0,
  });
  const starts = [[21, 34, 6.2, 0], [42, 66, 6.8, 0.33], [24, 98, 6.0, 0.66]];
  for (const [x, y, r, c0] of starts) newLoop(P, x, y, r, floor((TAU * r) / 1.5), c0, 0.1);
}

// ---- physics ---------------------------------------------------------------------------------
function physics(P) {
  const R = P.R, R2 = R * R;
  const { X, Y, DX, DY, LD, S, LI, LN, nxt, head } = P;
  let n = 0;
  const sEx = R * 1.25;
  const live = [];
  for (const L of P.loops) if (!L.dying) live.push(L);
  for (let li = 0; li < live.length; li++) {
    const L = live[li], m = L.n;
    L.o = n;
    let s = 0;
    for (let i = 0; i < m; i++) {
      X[n + i] = L.x[i];
      Y[n + i] = L.y[i];
      LI[n + i] = li;
      S[n + i] = s;
      const j = i + 1 === m ? 0 : i + 1;
      s += sqrt((L.x[j] - L.x[i]) ** 2 + (L.y[j] - L.y[i]) ** 2);
    }
    for (let i = 0; i < m; i++) LN[n + i] = s;
    n += m;
  }
  if (!n) return;
  DX.fill(0, 0, n);
  DY.fill(0, 0, n);
  LD.fill(0, 0, n);

  // Spatial hash, one cell the size of the repulsion radius.
  const inv = 1 / R, gw = ceil(W * inv) + 3, gh = ceil(H * inv) + 3;
  head.fill(-1, 0, gw * gh);
  for (let i = 0; i < n; i++) {
    const c = (floor(X[i] * inv) + 1) + (floor(Y[i] * inv) + 1) * gw;
    nxt[i] = head[c];
    head[c] = i;
  }
  const GRP = 0.13;
  for (let i = 0; i < n; i++) {
    const cx = floor(X[i] * inv) + 1, cy = floor(Y[i] * inv) + 1;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        let j = head[cx + ox + (cy + oy) * gw];
        while (j >= 0) {
          if (j > i) {
            const dx = X[j] - X[i], dy = Y[j] - Y[i];
            const d2 = dx * dx + dy * dy;
            if (d2 < R2) {
              let skip = false;
              if (LI[i] === LI[j]) {
                let da = abs(S[i] - S[j]);
                const LL = LN[i];
                if (LL - da < da) da = LL - da;
                if (da < sEx) skip = true;
              }
              if (!skip) {
                const d = sqrt(d2) + 1e-6;
                const f = (R - d) * GRP / d;
                DX[i] -= dx * f;
                DY[i] -= dy * f;
                DX[j] += dx * f;
                DY[j] += dy * f;
                const l = 1 - d / R;
                LD[i] += l;
                LD[j] += l;
              }
            }
          }
          j = nxt[j];
        }
      }
  }

  // Springs along each loop, a little smoothing so folds stay round, the wall.
  const GS = 0.34, GB = 0.22, G4 = 0.07;
  const wm = R * 0.5;
  for (let li = 0; li < live.length; li++) {
    const L = live[li], m = L.n, o = L.o;
    for (let i = 0; i < m; i++) {
      const j = i + 1 === m ? 0 : i + 1, p = i === 0 ? m - 1 : i - 1;
      const a = o + i, b = o + j;
      const dx = X[b] - X[a], dy = Y[b] - Y[a];
      const len = sqrt(dx * dx + dy * dy) + 1e-6;
      const e = (len - L.rl[i]) * GS / len;
      DX[a] += dx * e;
      DY[a] += dy * e;
      DX[b] -= dx * e;
      DY[b] -= dy * e;
      DX[a] += GB * (0.5 * (X[o + p] + X[b]) - X[a]);
      DY[a] += GB * (0.5 * (Y[o + p] + Y[b]) - Y[a]);
      // Bending stiffness: the fourth difference along the line, which a zigzag at the scale of the nodes feels and a long fold hardly does.
      const p2 = p === 0 ? m - 1 : p - 1, j2 = j + 1 === m ? 0 : j + 1;
      DX[a] -= G4 * (X[o + p2] - 4 * X[o + p] + 6 * X[a] - 4 * X[b] + X[o + j2]);
      DY[a] -= G4 * (Y[o + p2] - 4 * Y[o + p] + 6 * Y[a] - 4 * Y[b] + Y[o + j2]);
      const w = wallG(X[a], Y[a]);
      if (w[0] > 0.8) {
        const gm = sqrt(w[1] * w[1] + w[2] * w[2]) + 1e-9;
        const din = (1 - w[0]) / gm;
        if (din < wm) {
          const k = (wm - din) * 0.12 / gm;
          DX[a] -= w[1] * k;
          DY[a] -= w[2] * k;
        }
      }
      L.ld[i] = 0;
    }
    for (let i = 0; i < m; i++) L.ld[i] = LD[o + i];
  }

  // Integrate with a cap on the step, then put anything past the wall back on it.
  for (let li = 0; li < live.length; li++) {
    const L = live[li], m = L.n, o = L.o;
    for (let i = 0; i < m; i++) {
      let dx = DX[o + i] + (Math.random() - 0.5) * 0.03, dy = DY[o + i] + (Math.random() - 0.5) * 0.03;
      const dd = sqrt(dx * dx + dy * dy);
      if (dd > 0.45) {
        dx *= 0.45 / dd;
        dy *= 0.45 / dd;
      }
      let x = L.x[i] + dx, y = L.y[i] + dy;
      if (x !== x || y !== y) (x = CX), (y = CY);
      const w = wallG(x, y);
      if (w[0] > 1) {
        const gg = w[1] * w[1] + w[2] * w[2] + 1e-9;
        x -= (w[1] * (w[0] - 1)) / gg;
        y -= (w[2] * (w[0] - 1)) / gg;
      }
      L.x[i] = x;
      L.y[i] = y;
    }
  }
}

// ---- growth ----------------------------------------------------------------------------------
function growth(P, dt, speed, contrast) {
  const G0 = 0.3 * speed;
  let total = 0;
  for (const L of P.loops) total += L.n;
  for (const L of P.loops) {
    if (L.dying) {
      L.fade -= dt / 1.4;
      continue;
    }
    const m = L.n;
    const nx = [], ny = [], nrl = [], na = [], nl = [];
    const rl = L.rl;
    for (let i = 0; i < m; i++) {
      const j = i + 1 === m ? 0 : i + 1;
      const mx = 0.5 * (L.x[i] + L.x[j]), my = 0.5 * (L.y[i] + L.y[j]);
      const f = field(P, mx, my);
      let rate = G0 * (contrast * f + P.bias);
      // Dying back is gentler than growing, so a lobe that turns off thins out instead of vanishing.
      if (rate < 0) rate *= 0.6;
      else {
        const load = 0.5 * (L.ld[i] + L.ld[j]);
        rate *= cl(1 - load / P.gate, 0, 1);
      }
      const tgt = cl(rate / G0 / 0.5, -1, 1);
      L.act[i] += (tgt - L.act[i]) * min(1, dt / 0.9);
      rl[i] *= exp(rate * dt);
    }
    // Merge: a short edge swallows the node after it.
    const del = new Uint8Array(m);
    let alive = m;
    for (let i = 0; i < m; i++) {
      if (del[i] || alive <= 7) continue;
      const j = i + 1 === m ? 0 : i + 1;
      if (del[j]) continue;
      if (rl[i] < RLMIN && rl[i] + rl[j] < RLMAX * 0.88) {
        rl[i] += rl[j];
        del[j] = 1;
        alive--;
      }
    }
    for (let i = 0; i < m; i++) {
      if (del[i]) continue;
      // Splits happen on the surviving list.
      nx.push(L.x[i]);
      ny.push(L.y[i]);
      nrl.push(rl[i]);
      na.push(L.act[i]);
      nl.push(L.ld[i]);
    }
    // Split pass on the new lists: find the next surviving node for the midpoint.
    const sx = [], sy = [], srl = [], sa = [], sl = [];
    const k = nx.length;
    total += k - m;
    for (let i = 0; i < k; i++) {
      const j = i + 1 === k ? 0 : i + 1;
      sx.push(nx[i]); sy.push(ny[i]); sa.push(na[i]); sl.push(nl[i]);
      if (nrl[i] > RLMAX && total < MAXN) {
        srl.push(nrl[i] * 0.5);
        sx.push(0.5 * (nx[i] + nx[j]));
        sy.push(0.5 * (ny[i] + ny[j]));
        sa.push(na[i]);
        sl.push(nl[i]);
        srl.push(nrl[i] * 0.5);
        total++;
      } else srl.push(nrl[i]);
    }
    L.x = sx; L.y = sy; L.rl = srl; L.act = sa; L.ld = sl;
    L.n = sx.length;
    if (L.n <= 8) L.dying = true;
  }
  P.total = total;
  P.loops = P.loops.filter((L) => L.fade > 0);
}

function seed(P) {
  const R = P.R;
  let best = null, bd = 0;
  for (let t = 0; t < 30; t++) {
    const x = CX + (Math.random() - 0.5) * 2 * AX * 0.8, y = CY + (Math.random() - 0.5) * 2 * AY * 0.85;
    if (wallG(x, y)[0] > 0.78) continue;
    let dmin = 1e9;
    for (const L of P.loops) {
      if (L.dying) continue;
      for (let i = 0; i < L.n; i++) {
        const d = (L.x[i] - x) ** 2 + (L.y[i] - y) ** 2;
        if (d < dmin) dmin = d;
      }
    }
    if (dmin > bd) {
      bd = dmin;
      best = [x, y];
    }
  }
  if (best && sqrt(bd) > R + 4.2 && P.total < MAXN - 60) {
    newLoop(P, best[0], best[1], 2.6, 12, Math.random(), 0.1);
    return true;
  }
  return false;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = min(dt, 0.1);
  P.hue = k[0];
  const speed = cl(k[1], 0.6, 3.2) / 2;
  P.R = 4.9 + 0.8 * cl(k[2], -1, 1);
  P.contrast = 0.78 + 0.7 * cl(k[3], -1, 1);
  P.gate = 0.6;
  const run = (h, sub) => {
    P.ft += h * speed;
    // A slow tide on top of the field: the whole line swells and thins over minutes, so the box is sometimes full and sometimes half empty.
    P.bias = 0.1 + 0.16 * sin(0.037 * P.ft + 0.7) + 0.1 * sin(0.0617 * P.ft + 2.9);
    if (P.total < 200) P.bias += 0.3;
    for (let s = 0; s < sub; s++) physics(P);
    growth(P, h, speed, P.contrast);
    P.seedWait -= h;
    let live = 0;
    for (const L of P.loops) if (!L.dying) live++;
    if (live < 2 && P.seedWait <= 0) {
      seed(P);
      P.seedWait = 4;
    }
  };
  if (!P.started) {
    P.started = true;
    // The line starts as three small rings. 480 coarse steps; at the opening speed they cover thirty seconds of the field's own time, and a slower Growth starts from a younger line.
    for (let i = 0; i < 480; i++) run(0.0625 / sqrt(speed), 1);
  }
  run(dt, SUB);
  P.ph += dt * 0.011;
}

// ---- drawing -------------------------------------------------------------------------------------
const C0 = [0, 0, 0];
// Gradient cycles round one loop.
const CYC = 2;
// One piece of the line: a 2 LED core with a 1 LED halo, the brightest piece at a pixel giving the pixel its colour.
function seg(buf, ax, ay, bx, by, vmax) {
  const x0 = floor(min(ax, bx) - 2.3), x1 = floor(max(ax, bx) + 2.3);
  const y0 = floor(min(ay, by) - 2.3), y1 = floor(max(ay, by) + 2.3);
  const ex = bx - ax, ey = by - ay;
  const el2 = ex * ex + ey * ey + 1e-9;
  for (let y = max(0, y0); y <= min(H - 1, y1); y++)
    for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      const t = cl((px * ex + py * ey) / el2, 0, 1);
      const dx = px - t * ex, dy = py - t * ey;
      const d2 = dx * dx + dy * dy;
      if (d2 > 5.3) continue;
      const d = sqrt(d2);
      const s = cl(1.35 - d, 0, 1);
      const core = s * s * (3 - 2 * s);
      // A 1 LED halo that is gone by 2.3 LEDs, so it stays out of the gap between folds.
      const q = cl(1 - (d - 0.6) / 1.7, 0, 1);
      const v = max(core, 0.3 * q * q);
      const o = (y * W + x) * 3;
      if (v * vmax > max(buf[o], buf[o + 1], buf[o + 2])) {
        buf[o] = C0[0] * v;
        buf[o + 1] = C0[1] * v;
        buf[o + 2] = C0[2] * v;
      }
    }
}

export function draw(display, params) {
  const P = params;
  const buf = P.buf;
  buf.fill(0);
  const hb = 0.95 + P.hue;
  for (const L of P.loops) {
    const m = L.n, fade = L.dying ? max(0, L.fade) : 1;
    // Arclength from node 0, so the gradient always runs the whole length of the line however it has folded.
    const sa = P.sa;
    let tot = 0;
    for (let i = 0; i < m; i++) {
      sa[i] = tot;
      const j = i + 1 === m ? 0 : i + 1;
      tot += sqrt((L.x[j] - L.x[i]) ** 2 + (L.y[j] - L.y[i]) ** 2);
    }
    for (let i = 0; i < m; i++) {
      const p = i === 0 ? m - 1 : i - 1, j = i + 1 === m ? 0 : i + 1;
      // Each node draws the bend of a quadratic B-spline through the midpoints of its two edges, in two straight pieces, so the polyline's corners are cut and a fold reads as a curve.
      const x0 = 0.5 * (L.x[p] + L.x[i]), y0 = 0.5 * (L.y[p] + L.y[i]);
      const x2 = 0.5 * (L.x[i] + L.x[j]), y2 = 0.5 * (L.y[i] + L.y[j]);
      const x1 = 0.25 * x0 + 0.5 * L.x[i] + 0.25 * x2, y1 = 0.25 * y0 + 0.5 * L.y[i] + 0.25 * y2;
      const c = (sa[i] / tot) * CYC + L.c0 + P.ph;
      const u = cl(0.5 * (L.act[p] + L.act[j]) * 0.5 + 0.5 * L.act[i], -1, 1);
      // Hue runs along the line and back again, so a closed loop has no seam.
      const hue = hb - 0.34 * (0.5 - 0.5 * cos(TAU * c));
      const sat = 0.86 - 0.34 * max(0, u);
      const val = (0.62 + 0.38 * cl(1.8 * u, -0.6, 1)) * fade;
      hsv(C0, hue, sat, val);
      const vmax = max(C0[0], C0[1], C0[2]);
      seg(buf, x0, y0, x1, y1, vmax);
      seg(buf, x1, y1, x2, y2, vmax);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o] | 0, buf[o + 1] | 0, buf[o + 2] | 0);
    }
}
