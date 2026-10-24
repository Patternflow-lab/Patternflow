// ===== Patternflow pattern =====
// Title:   Meander
// Family:  line
// Idea:    A random meander, one closed curve that crosses a straight road down the middle of the panel 12 to 32 times, filled solid with the colour wheel laid once round its length; every few seconds the arcs on one side fold flat onto the road and open again as a new set that still closes into one loop.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: meanders (Vladimir Arnold, 1988), pattern round 30
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Crossings=12..32, Hollow=0..1
//
// Knob 1: Hue. Turns the colour wheel that lies once round the loop. At 0 the loop starts azure where the pulse first sets off and runs on through blue, magenta, red, gold and green back to azure; the colours then flow forward along the curve with the pulse.
// Knob 2: Speed. At 2 the pulse runs 80 LEDs of curve a second, the colours flow round the loop once in 12.5 seconds, and one side of the meander folds and reopens every 5 seconds; at 0.2 all of it is ten times slower, at 3 half as fast again.
// Knob 3: Crossings. How many times the curve crosses the road, 2n for a meander of order n: 12 at the start, 4 LEDs apart at 32. A new order folds both sides flat and opens a new meander.
// Knob 4: Hollow. At 0 the inside of the loop burns in full colour; turned up it dims, and at 1 only the curve and the road are left.
// Buttons: K1 tap folds both sides at once and opens a fresh meander of the same order.

// The road runs down the middle, between columns 31 and 32. The 2n crossings
// sit evenly on it from row 2 to row 126, 4 LEDs apart at n = 16, and the
// widest arc on a side reaches 28.5 LEDs out, so its line stays off the wall.
// A meander of order n is a pair of non-crossing matchings of those points,
// arcs on the left and arcs on the right, that join into one loop. Arnold
// asked how many there are: 1, 2, 8, 42, 262, 1828, ..., each about ten
// times the last by n = 16 and the ratio creeping up towards 12.26. No
// formula is known.
const W = 64, H = 128, NP = W * H, MID = 32, WMAX = 28.5, TOP = 2, SPAN = 124;
const { min, max, floor, ceil, sqrt, cos, acos, abs, exp, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);
// The arc's distance from the road: its semicircle r, cut off softly at the
// width w its nesting gives it. Both grow from an arc to any arc round it,
// so nested arcs never touch.
const smin = (w, r) => (w <= 0 || r <= 0 ? 0 : (w * r) / sqrt(sqrt(w * w * w * w + r * r * r * r)));

// A non-crossing perfect matching of 2n points as a uniform random Dyck word,
// by the cycle lemma: shuffle n opens and n + 1 closes, start just after the
// first lowest point of the walk, drop the last close.
const WALK = new Int8Array(33);
function dyck(n, P) {
  const m = 2 * n + 1, a = WALK;
  for (let i = 0; i < m; i++) a[i] = i < n ? 1 : -1;
  for (let i = m - 1; i > 0; i--) {
    const j = floor(random() * (i + 1)), t = a[i];
    (a[i] = a[j]), (a[j] = t);
  }
  let s = 0, lo = 0, at = 0;
  for (let i = 0; i < m; i++) if ((s += a[i]) < lo) (lo = s), (at = i);
  const st = [];
  for (let k = 0; k < 2 * n; k++) {
    if (a[(at + 1 + k) % m] > 0) st.push(k);
    else {
      const o = st.pop();
      (P[o] = k), (P[k] = o);
    }
  }
}

// Left arcs and right arcs together are one closed curve when walking left,
// right, left, ... from point 0 meets every point before it comes back.
function oneLoop(L, R, n2) {
  let i = 0, c = 0;
  do (i = R[L[i]]), (c += 2);
  while (i !== 0 && c <= n2);
  return c === n2;
}

// Each arc's height: 0 when no arc lies inside it, else one more than the
// highest arc directly inside. It sets the arc's width, so a nest of any
// depth fits between the road and the wall.
function heights(P, n2, h) {
  const st = new Int8Array(n2 + 1);
  let sp = 0;
  st[0] = -1;
  for (let i = 0; i < n2; i++) {
    if (P[i] > i) st[++sp] = -1;
    else {
      const v = st[sp--] + 1;
      h[i] = h[P[i]] = v;
      if (v > st[sp]) st[sp] = v;
    }
  }
  return st[0];
}

function dress(n, L, R) {
  const hL = new Int8Array(2 * n), hR = new Int8Array(2 * n);
  return { n, L, R, hL, hR, HL: heights(L, 2 * n, hL), HR: heights(R, 2 * n, hR) };
}

// A uniform random meander of order n: draw both sides until they close into
// one loop. About one pair in 10 does at n = 6 and one in 210 at n = 16.
function meander(n) {
  for (; n > 1; n--) {
    const L = new Int8Array(2 * n), R = new Int8Array(2 * n);
    for (let t = 0; t < 4000; t++) {
      dyck(n, L), dyck(n, R);
      if (oneLoop(L, R, 2 * n)) return dress(n, L, R);
    }
  }
  return dress(1, new Int8Array([1, 0]), new Int8Array([1, 0]));
}

// The same meander with side X drawn again, the other side kept.
function reside(M, X) {
  const n = M.n, Q = new Int8Array(2 * n);
  for (let t = 0; t < 4000; t++) {
    dyck(n, Q);
    if (X ? oneLoop(M.L, Q, 2 * n) : oneLoop(Q, M.R, 2 * n)) return X ? dress(n, M.L, Q) : dress(n, Q, M.R);
  }
  return M;
}

export function setup(params) {
  params.s = {
    M: null, n2: 0, ph: 0, side: 2, u: 0, next: 0, both: false, flow: 0, ck: 0, cu: 0,
    // the loop, arc by arc: from point, to point, side (0 left, 1 right)
    AF: new Int8Array(32), AT: new Int8Array(32), AS: new Int8Array(32),
    // each kept arc's place on the loop before the last swap, at its start and end
    OS: new Float32Array(32), OE: new Float32Array(32), OK: new Uint8Array(32), old: 0,
    len: new Float32Array(32), cum: new Float32Array(33),
    gp: new Float32Array(32 * 6), D: new Float32Array(NP), LA: new Int8Array(NP), LT: new Float32Array(NP),
    hue: 0, speed: 2, hollow: 0.06, nT: 6,
  };
}

// Walk the loop from point a, first along side s.
function order(P, a, s) {
  const M = P.M;
  for (let k = 0; k < P.n2; k++) {
    const b = s ? M.R[a] : M.L[a];
    (P.AF[k] = a), (P.AT[k] = b), (P.AS[k] = s);
    (a = b), (s ^= 1);
  }
}

// Swap in new arcs while the side is flat on the road. A one-side swap keeps
// the pulse on the kept arc it is on, or the next one, and lets every kept
// arc carry its old colours over into the new loop's while the side opens.
function swap(P) {
  const X = P.side;
  if (X === 2) {
    P.M = meander(P.nT);
    P.n2 = 2 * P.M.n;
    order(P, floor(random() * P.n2), floor(random() * 2));
    (P.ck = 0), (P.cu = 0), (P.old = 0), (P.side = 2);
    return;
  }
  const Q = 1 - X, n2 = P.n2, L = P.cum[n2] || 1;
  const os = new Float32Array(n2), oe = new Float32Array(n2);
  for (let k = 0; k < n2; k++)
    if (P.AS[k] === Q) {
      const i = P.AF[k], j = P.AT[k];
      (os[i] = P.cum[k] / L), (oe[i] = P.cum[k + 1] / L);
      (os[j] = P.cum[k + 1] / L), (oe[j] = P.cum[k] / L);
    }
  let a = P.AF[P.ck];
  if (P.AS[P.ck] !== Q) (a = P.AT[P.ck]), (P.cu = 0);
  P.M = reside(P.M, X);
  order(P, a, Q);
  P.ck = 0;
  for (let k = 0; k < n2; k++) {
    P.OK[k] = P.AS[k] === Q ? 1 : 0;
    (P.OS[k] = os[P.AF[k]]), (P.OE[k] = oe[P.AF[k]]);
  }
  P.old = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 12, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.nT = cl(round(cl(k[2], 12, 32) / 2), 6, 16);
  P.hollow = cl(k[3], 0, 1);
  if (!P.M) {
    P.M = meander(P.nT);
    P.n2 = 2 * P.M.n;
    order(P, floor(random() * P.n2), 0);
    (P.ph = 2), (P.side = 2), (P.u = 0);
  }
  const s = P.speed;
  if (input.btnPressed && input.btnPressed[0]) {
    P.both = true;
    if (P.ph === 0) P.u = 1;
  }
  // 0 hold, 1 close, 2 open; in clock units that run at Speed a second.
  if (P.ph === 0) {
    P.u += (d * s) / 7;
    if (P.M.n !== P.nT) P.u = 1;
    if (P.u >= 1) {
      P.side = P.both || P.M.n !== P.nT ? 2 : P.next;
      if (P.side < 2) P.next ^= 1;
      (P.both = false), (P.ph = 1), (P.u = 0);
    }
  } else if (P.ph === 1) {
    P.u += (d * s) / 1.2;
    if (P.u >= 1) swap(P), (P.ph = 2), (P.u = 0);
  } else {
    P.u += (d * s) / 1.8;
    if (P.u >= 1) (P.ph = 0), (P.u = 0), (P.old = 0);
  }
  P.flow += d * s * 0.04;
  // The pulse: 40 LEDs of curve a second per unit of Speed.
  P.cu += (d * s * 40) / max(4, P.len[P.ck]);
  while (P.cu >= 1) (P.cu -= 1), (P.ck = (P.ck + 1) % P.n2);
}

// The colour wheel once round the loop, 1024 steps.
const LUT = new Float32Array(1024 * 3);
for (let i = 0; i < 1024; i++) {
  const h = (i / 1024) * 6, j = floor(h), f = h - j;
  const c = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][j];
  for (let q = 0; q < 3; q++) LUT[i * 3 + q] = c[q] ** 0.9;
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.M) return;
  const M = P.M, n2 = P.n2, sp = SPAN / (n2 - 1), g = P.gp;
  const open = P.ph === 0 ? 1 : P.ph === 1 ? 1 - ease(P.u) : ease(P.u);
  const sL = P.side === 1 ? 1 : open, sR = P.side === 0 ? 1 : open;
  const mix = P.old ? ease(P.ph === 2 ? P.u : 1) : 1;
  // Each arc: top and bottom y, centre, radius, width, side sign. While a
  // side folds, its arcs all lose width at one rate, so the innermost lie flat
  // first and the nest never crosses itself; it opens outermost first.
  for (let k = 0; k < n2; k++) {
    const a = P.AF[k], b = P.AT[k], side = P.AS[k];
    const h = side ? M.hR[a] : M.hL[a], Hs = side ? M.HR : M.HL, so = side ? sR : sL;
    const ya = TOP + a * sp, yb = TOP + b * sp, o = k * 6;
    (g[o] = min(ya, yb)), (g[o + 1] = max(ya, yb));
    (g[o + 2] = (ya + yb) / 2), (g[o + 3] = abs(yb - ya) / 2);
    g[o + 4] = (WMAX / (Hs + 1)) * cl(so * (Hs + 1) - (Hs - h), 0, h + 1);
    g[o + 5] = side ? 1 : -1;
  }
  // The curve: sample every arc in loop order, keep for each LED the nearest
  // sample, which arc it was on and how far along.
  const D = P.D, LA = P.LA, LT = P.LT;
  D.fill(9);
  P.cum[0] = 0;
  for (let k = 0; k < n2; k++) {
    const o = k * 6, c = g[o + 2], R = g[o + 3], w = g[o + 4], sg = g[o + 5];
    const down = P.AF[k] < P.AT[k], ns = max(4, ceil((PI * R) / 0.4));
    let px = 0, py = 0, len = 0;
    for (let j = 0; j <= ns; j++) {
      const t = (PI * j) / ns, X = MID + sg * smin(w, R * Math.sin(t)), Y = c - R * cos(t);
      if (j) len += sqrt((X - px) ** 2 + (Y - py) ** 2);
      (px = X), (py = Y);
      const tau = down ? j / ns : 1 - j / ns;
      for (let yy = ceil(Y - 2.3), y1 = floor(Y + 1.3); yy <= y1; yy++) {
        if (yy < 0 || yy >= H) continue;
        const ey = yy + 0.5 - Y;
        for (let xx = ceil(X - 2.3), x1 = floor(X + 1.3); xx <= x1; xx++) {
          if (xx < 0 || xx >= W) continue;
          const ex = xx + 0.5 - X, dd = ex * ex + ey * ey, p = yy * W + xx;
          if (dd < D[p]) (D[p] = dd), (LA[p] = k), (LT[p] = tau);
        }
      }
    }
    P.len[k] = len;
    P.cum[k + 1] = P.cum[k] + len;
  }
  const Ltot = P.cum[n2] || 1, head = P.cum[P.ck] + P.cu * P.len[P.ck];
  // Where on the loop a point is, 0..1, with a kept arc's old place blended
  // into its new one while its side opens.
  const at = (k, tau) => {
    let f = (P.cum[k] + tau * P.len[k]) / Ltot;
    if (mix < 1 && P.OK[k]) {
      let e = P.OS[k] + tau * (P.OE[k] - P.OS[k]) - f;
      e -= round(e);
      f += (1 - mix) * e;
    }
    return f;
  };
  // The pulse's head, for the glow round it.
  const ho = P.ck * 6, hr = g[ho + 3], ht = PI * (P.AF[P.ck] < P.AT[P.ck] ? P.cu : 1 - P.cu);
  const hx = MID + g[ho + 5] * smin(g[ho + 4], hr * Math.sin(ht)), hy = g[ho + 2] - hr * cos(ht);
  const hue0 = P.hue + 0.55 - P.flow, fillV = 255 * 0.97 * (1 - P.hollow) ** 1.2;
  const lineS = 0.5 + 0.35 * P.hollow;
  // The inside by the even-odd rule, row by row: a LED is inside when a ray
  // from it to the right wall crosses the curve an odd number of times. The
  // arcs a row meets on one side are nested, so the band a LED sits in takes
  // the colour of the arc just outside it, at this row.
  const fl = new Float32Array(16), ka = new Int8Array(16), ta = new Float32Array(16);
  const fr = new Float32Array(16), kb = new Int8Array(16), tb = new Float32Array(16);
  for (let yy = 0; yy < H; yy++) {
    const yc = yy + 0.5;
    let nl = 0, nr = 0;
    for (let k = 0; k < n2; k++) {
      const o = k * 6;
      if (!(g[o] < yc && yc < g[o + 1])) continue;
      const c = g[o + 2], R = g[o + 3], dy = yc - c, f = smin(g[o + 4], sqrt(R * R - dy * dy));
      const t = acos(cl(-dy / R, -1, 1)) / PI, tau = P.AF[k] < P.AT[k] ? t : 1 - t;
      const A = g[o + 5] > 0 ? fr : fl, KK = g[o + 5] > 0 ? kb : ka, T = g[o + 5] > 0 ? tb : ta;
      let i = g[o + 5] > 0 ? nr++ : nl++;
      while (i > 0 && A[i - 1] > f) (A[i] = A[i - 1]), (KK[i] = KK[i - 1]), (T[i] = T[i - 1]), i--;
      (A[i] = f), (KK[i] = k), (T[i] = tau);
    }
    for (let half = 0; half < 2; half++) {
      const A = half ? fr : fl, KK = half ? kb : ka, T = half ? tb : ta, n = half ? nr : nl;
      let i = 0;
      for (let q = 0; q < 32; q++) {
        const xx = half ? MID + q : MID - 1 - q, dist = q + 0.5, p = yy * W + xx;
        while (i < n && A[i] < dist) i++;
        let r = 0, gg = 0, b = 0;
        const inside = half ? (nr - i) & 1 : (i + nr) & 1;
        if (inside && fillV > 0) {
          const f = at(KK[i], T[i]), ix = floor((((hue0 + f) % 1) + 1) % 1 * 1024) * 3;
          (r = LUT[ix] * fillV), (gg = LUT[ix + 1] * fillV), (b = LUT[ix + 2] * fillV);
        }
        // The road, a faint line on the dark and a darker one through the colour.
        if (q === 0) {
          if (inside && fillV > 0) (r *= 0.6), (gg *= 0.6), (b *= 0.6);
          else (r += 34), (gg += 36), (b += 44);
        }
        const dl = sqrt(D[p]);
        if (dl < 2.3) {
          const k = LA[p], f = at(k, LT[p]), ix = floor((((hue0 + f) % 1) + 1) % 1 * 1024) * 3;
          let behind = (head - (P.cum[k] + LT[p] * P.len[k])) % Ltot;
          if (behind < 0) behind += Ltot;
          const pulse = exp(-behind / 24) + (behind > Ltot - 3 ? (behind - Ltot + 3) / 3 : 0);
          const I = cl(1.75 - dl * 1.1, 0, 1), J = cl(2 - dl * 0.75, 0, 1) * pulse, wh = 1 - lineS;
          let lr = 255 * (wh + lineS * LUT[ix]), lg = 255 * (wh + lineS * LUT[ix + 1]), lb = 255 * (wh + lineS * LUT[ix + 2]);
          const pv = min(1, pulse);
          (lr += (255 - lr) * pv), (lg += (250 - lg) * pv), (lb += (235 - lb) * pv);
          const m = max(I, J);
          (r += (lr - r) * m), (gg += (lg - gg) * m), (b += (lb - b) * m);
        }
        const ex = xx + 0.5 - hx, ey = yc - hy, e2 = ex * ex + ey * ey;
        if (e2 < 30) {
          const gl = 0.9 * exp(-e2 / 6);
          (r += (255 - r) * gl), (gg += (250 - gg) * gl), (b += (235 - b) * gl);
        }
        display.setPixel(xx, yy, min(255, r), min(255, gg), min(255, b));
      }
    }
  }
}
