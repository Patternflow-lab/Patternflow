// ===== Patternflow pattern =====
// Title:   Ford Circles
// Family:  number
// Idea:    The real line stands up the left edge with a circle of radius 1/(2q²) resting on every fraction p/q, and the picture zooms for ever into the golden ratio while ever smaller circles keep appearing at the mediants of the ones that touch.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ford circles (Lester R. Ford, 1938) and the Farey sequence (John Farey, 1816), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Target=0..4, Fill=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. Colour follows the denominator q: at 0 the big circles of small q are teal and the smaller ones blue and violet, and as the zoom reaches larger q the hues swing to pink and back.
// Knob 2: Speed. How fast it zooms. At 2 the picture grows by a factor of e every three seconds and a new convergent of the golden ratio comes up every 2.9 s; at 0.2 everything takes ten times as long.
// Knob 3: Target. The number the zoom falls into, read from its continued fraction: 0 the golden ratio [1; 1, 1, ...], 1 the square root of 2, 2 the square root of 3, 3 e, 4 pi. Pi stalls for about half a minute at Speed 2 beside 355/113, where its term 292 sits, while a chain of nearly equal circles grows along the edge of one giant one.
// Knob 4: Fill. Rims only at 0. At the start each circle glows in from its rim, 2 LEDs deep on a small circle and up to 18 on a giant one; at 1 the discs are solid.
// Buttons: K1 tap lights the Stern-Brocot descent into the target: from the two convergents framing the window, each mediant whose parents still hold the target between them lights in turn, each smaller and touching the last, down to the spark on the line. The other circles dim for the five seconds it takes.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, exp, log, sin, abs, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Screen rows run down the real line with larger numbers at the top; the
// target sits in the middle of row 64. Circles narrower than RMIN LEDs are
// left out, and the window jumps to the next convergent with MARG to spare.
const CY = 64.5, TROW = 64, RMIN = 0.28, MARG = 1.08, MAXC = 1200, S0 = 132;

// The continued fractions of the targets, a(i) for i = 0, 1, 2, ... The
// golden ratio is [1; 1, 1, ...], the square roots of 2 and 3 repeat, e runs
// [2; 1, 2, 1, 1, 4, 1, 1, 6, ...] and pi is written out to 50 terms. After
// term 39 for e and 49 for pi the terms start over, so the number the zoom
// falls into agrees with e and pi to more than 30 decimal places.
const PIC = [3, 7, 15, 1, 292, 1, 1, 1, 2, 1, 3, 1, 14, 2, 1, 1, 2, 2, 2, 2, 1, 84, 2, 1, 1, 15, 3, 13, 1, 4, 2, 6, 6, 99, 1, 2, 2, 6, 3, 5, 1, 1, 6, 8, 1, 7, 1, 2, 3, 7];
const TG = [
  () => 1,
  (i) => (i ? 2 : 1),
  (i) => (i ? 2 - (i & 1) : 1),
  (i) => {
    if (!i) return 2;
    i = 1 + ((i - 1) % 39);
    return i % 3 === 2 ? (2 * (i + 1)) / 3 : 1;
  },
  (i) => PIC[i < 50 ? i : 1 + ((i - 1) % 49)],
];
// [a(i); a(i+1), a(i+2), ...] to double precision.
function tail(a, i) {
  let v = a(i + 26);
  for (let j = i + 25; j >= i; j--) v = a(j) + 1 / v;
  return v;
}

function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = 255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p);
  out[1] = 255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p);
  out[2] = 255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p);
}
const smooth = (a, b, v) => {
  const u = cl((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// The window is kept in the frame of the convergents p/q (index n) and
// p'/q' (index n-1) of the target alpha. The map X -> (pX + p')/(qX + q')
// sends the Ford circles onto themselves, sends 1/0 and 0/1 to p/q and p'/q',
// and sends the tail t = [a(n+1); a(n+2), ...] to alpha. A fraction P/Q in
// that frame lands on the LEDs at s(p/q - alpha) = sig D (P - tQ) / ((P + kQ)(t + k))
// with radius sig / (2 (P + kQ)^2), where k = q'/q, D = pq' - p'q = +-1 and
// sig = s/q^2. All of these stay small however deep the zoom goes, so it
// can run for ever in double precision.
function start(S, tgt) {
  const a = TG[tgt];
  S.tgt = tgt;
  S.a = a;
  S.n = 0;
  S.k = 0;
  S.D = -1;
  S.lnq = 0;
  S.t = tail(a, 1);
  S.sig = max(S0, 64 * MARG * S.t + 1);
  // p, q, p' and q' modulo 2^32, for each circle's own twinkle.
  S.pn = a(0);
  S.pm = 1;
  S.qn = 1;
  S.qm = 0;
  S.fade = 0;
}
// The next convergent's frame is used as soon as the window sits wholly
// between it and the one before: both tangent points off the panel, and the
// two circles touching beyond the right edge.
function advance(S) {
  for (let g = 0; g < 8; g++) {
    const an = S.a(S.n + 1), k2 = 1 / (an + S.k), t2 = tail(S.a, S.n + 2);
    if (S.sig * k2 * k2 <= 64 * MARG * (t2 + k2)) return;
    S.sig *= k2 * k2;
    S.lnq -= log(k2);
    S.k = k2;
    S.t = t2;
    S.D = -S.D;
    S.n++;
    const pn = (Math.imul(an, S.pn) + S.pm) | 0, qn = (Math.imul(an, S.qn) + S.qm) | 0;
    S.pm = S.pn;
    S.qm = S.qn;
    S.pn = pn;
    S.qn = qn;
  }
}

export function setup(params) {
  const S = (params.s = {
    time: 0, wave: -1, hue: 0, glow: 0.55, depth: 1.8, flat: 0.05,
    Y: new Float64Array(MAXC), R: new Float64Array(MAXC), Wt: new Float64Array(MAXC),
    PP: new Int32Array(MAXC), QQ: new Int32Array(MAXC), PA: new Int32Array(MAXC), PB: new Int32Array(MAXC),
    CV: new Uint8Array(MAXC), PH: new Uint8Array(MAXC), stack: new Int32Array(MAXC * 4), conv: new Float64Array(96),
    buf: new Float32Array(N * 3), col: [0, 0, 0],
  });
  start(S, 0);
  S.tgt = -1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.time += d;
  S.hue = k[0];
  // Fill lights the inside of each circle in from its rim: a glow a few
  // LEDs deep at first, then a flat fill under it up to a solid disc.
  const u = cl(k[3], 0, 1), fk = sqrt(u);
  S.glow = min(0.55, 2.4 * fk);
  S.depth = 0.8 + 4 * fk;
  S.flat = 0.85 * u;
  const tgt = cl(round(k[2]), 0, 4);
  if (tgt !== S.tgt) {
    const first = S.tgt < 0;
    start(S, tgt);
    if (first) S.fade = 1;
  }
  S.fade = min(1, S.fade + d * 2.5);
  S.sig *= exp(d * cl(k[1], 0.2, 3) * 0.165);
  advance(S);
  if (S.wave >= 0) {
    S.wave += d;
    if (S.wave > WT) S.wave = -1;
  }
  if (input.btnPressed && input.btnPressed[0]) S.wave = 0;
}

// Every circle that reaches the panel: the two convergents framing the
// window, then the Stern-Brocot tree between them, each new fraction the
// mediant of two that touch. A gap whose two tangent points both lie off one
// end of the panel holds nothing on it, and a mediant too small to see has
// only smaller ones below it.
function circles(S) {
  const { Y, R, Wt, PP, QQ, PA, PB, CV, PH, stack, conv } = S;
  const sig = S.sig, k = S.k, t = S.t, D = S.D, tk = t + k, wmax = sqrt(sig / (2 * RMIN));
  // The convergents of the tail are the convergents of the target.
  let nc = 0;
  for (let j = 0, h1 = 1, k1 = 0, h0 = S.a(S.n + 1), k0 = 1; j < 40 && h0 + k * k0 <= wmax; j++) {
    conv[nc++] = h0;
    conv[nc++] = k0;
    const a = S.a(S.n + 2 + j), h2 = a * h0 + h1, k2 = a * k0 + k1;
    (h1 = h0), (k1 = k0), (h0 = h2), (k0 = k2);
  }
  PP[0] = 0, QQ[0] = 1, Wt[0] = k, CV[0] = 1, PH[0] = 1;
  if (k > 0) (R[0] = sig / (2 * k * k)), (Y[0] = CY + (D * sig * t) / (k * tk));
  else (R[0] = 0), (Y[0] = CY + D * 1e30);
  PP[1] = 1, QQ[1] = 0, Wt[1] = 1, CV[1] = 1, PH[1] = 1, R[1] = sig / 2, Y[1] = CY - (D * sig) / tk;
  let n = 2, sp = 0;
  stack[sp++] = 0;
  stack[sp++] = 1;
  while (sp > 0 && n < MAXC) {
    const b = stack[--sp], a = stack[--sp], ya = Y[a], yb = Y[b];
    if ((ya < -1 && yb < -1) || (ya > H + 1 && yb > H + 1)) continue;
    const P = PP[a] + PP[b], Q = QQ[a] + QQ[b], w = P + k * Q;
    if (w > wmax) continue;
    PP[n] = P, QQ[n] = Q, Wt[n] = w, PA[n] = a, PB[n] = b;
    R[n] = sig / (2 * w * w);
    Y[n] = CY - (D * sig * (P - t * Q)) / (w * tk);
    let c = 0;
    for (let j = 0; j < nc; j += 2) if (conv[j] === P && conv[j + 1] === Q) c = 1;
    CV[n] = c;
    // On the descent to the target: the target lies between the parents.
    PH[n] = (PP[a] - t * QQ[a]) * (PP[b] - t * QQ[b]) < 0 ? 1 : 0;
    stack[sp++] = a;
    stack[sp++] = n;
    stack[sp++] = n;
    stack[sp++] = b;
    n++;
  }
  return n;
}

// The rim is RW LEDs either side of the circle's edge.
const RW = 0.85;
// Colour by denominator: the hue walks HA round the wheel and back as ln q
// climbs by HL and HL again, so the circles stay on the cool side of the
// wheel (teal, blue, violet, pink at the start) however deep the zoom goes.
const HA = 0.36, HL = 4;
// The descent's front runs WV units of ln(size) a second; a tap lasts WT s.
const WV = 1.8, WT = 5;
function disc(buf, r, yc, cr, cg, cb, ra, ga, gl, fa, cw) {
  const y0 = max(0, floor(yc - r - 1)), y1 = min(H - 1, floor(yc + r + 1)), x1 = min(W - 1, floor(2 * r + 1)), rw = RW * cw;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - yc, dy2 = dy * dy;
    const ady = abs(dy), xs = ady <= r ? dy2 / (r + sqrt(r * r - dy2)) : r;
    for (let x = max(0, floor(xs - 2)); x <= x1; x++) {
      const X = x + 0.5, dist = sqrt((X - r) * (X - r) + dy2), d = (X * X - 2 * X * r + dy2) / (dist + r);
      if (d > rw) {
        if (X > r) break;
        continue;
      }
      let v = ra * (d > -rw ? 1 - abs(d) / rw : 0);
      if (d < 0.5) v += cl(0.5 - d, 0, 1) * (fa + ga * exp(d / gl) + (y === TROW ? 0.32 : 0));
      const p = (y * W + x) * 3;
      buf[p] += cr * v;
      buf[p + 1] += cg * v;
      buf[p + 2] += cb * v;
    }
  }
}
function dot(buf, x, y, v, cr, cg, cb) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const px = xi + i, py = yi + j;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const w = v * (i ? fx : 1 - fx) * (j ? fy : 1 - fy), p = (py * W + px) * 3;
      buf[p] += cr * w;
      buf[p + 1] += cg * w;
      buf[p + 2] += cb * w;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, col = S.col, n = circles(S), { Y, R, Wt, PP, QQ, PA, PB, CV, PH } = S;
  buf.fill(0);
  // The target's ray. A circle the row through alpha crosses has
  // |alpha - p/q| < 1/(2q^2), and by Legendre's theorem that makes p/q a
  // convergent of alpha: the zoom passes through convergents and nothing
  // else. Convergents get whiter, wider rims; the row lights inside them.
  for (let x = 0; x < W; x++) {
    const p = (TROW * W + x) * 3, v = 0.13 * (1 - x / 90);
    buf[p] += 255 * v;
    buf[p + 1] += 240 * v;
    buf[p + 2] += 200 * v;
  }
  // After a K1 tap the Stern-Brocot descent into the target lights up: a
  // front runs from the biggest circles to the smallest and lights each
  // fraction whose two parents hold the target between them, so the light
  // hops mediant by mediant, each circle touching the last, down to the
  // spark on the line. The rest of the window dims while it runs.
  const on = S.wave >= 0, wf = S.wave * WV - 1.2, wd = on ? smooth(0, 0.3, S.wave) * min(1, (WT - S.wave) / 0.9) : 0;
  for (let i = 0; i < n; i++) {
    const r = R[i];
    if (r < RMIN || (i === 0 && S.k === 0)) continue;
    const lq = (S.lnq + log(Wt[i])) / HL;
    hsv(S.hue + 0.5 + HA * abs(lq - 2 * floor(lq / 2 + 0.5)), 0.82, 1, col);
    let cr = col[0], cg = col[1], cb = col[2], ra = 0.9, cw = 1, ga = S.glow, fa = S.flat;
    let vis = smooth(RMIN, 1.6, r);
    if (CV[i]) (cr = cr * 0.65 + 89), (cg = cg * 0.65 + 84), (cb = cb * 0.65 + 70), (ra = 1), (cw = 1.3);
    if (on && PH[i]) {
      const lv = log(64 / r), fr = exp(-(((wf - lv) / 0.35) ** 2)), lit = smooth(-0.25, 0.25, wf - lv) * wd;
      (cr += (255 - cr) * (0.25 * lit + 0.5 * fr)), (cg += (255 - cg) * (0.25 * lit + 0.5 * fr)), (cb += (255 - cb) * (0.25 * lit + 0.5 * fr));
      (ra += 0.4 * lit + fr), (ga += 0.4 * lit), (fa += 0.12 * lit + 0.35 * fr), (cw += 0.4 * lit);
    } else vis *= 1 - 0.55 * wd;
    disc(buf, r, Y[i], cr, cg, cb, ra * vis, ga * vis, S.depth * (1 + 0.1 * min(r, 90)), fa * vis, cw);
  }
  // The points where circles touch glint, each at its own pace. Every
  // tangency on the panel is a mediant touching one of its two parents.
  const { pn, pm, qn, qm } = S;
  for (let i = 2; i < n; i++) {
    const rm = R[i];
    if (rm < 1.2) continue;
    const pa = Math.imul(pn, PP[i]) + Math.imul(pm, QQ[i]), qa = Math.imul(qn, PP[i]) + Math.imul(qm, QQ[i]);
    const fr = on && PH[i] ? 2 * exp(-(((wf - log(64 / rm)) / 0.35) ** 2)) : 0;
    for (let e = 0; e < 2; e++) {
      const j = e ? PB[i] : PA[i], rp = R[j];
      if (j === 0 && S.k === 0) continue;
      const tx = (2 * rp * rm) / (rp + rm), ty = Y[i] + (Y[j] > Y[i] ? 1 : -1) * ((2 * rm * sqrt(rp * rm)) / (rp + rm));
      if (tx > W || ty < -1 || ty > H) continue;
      const h = hash(pa ^ (Math.imul(pn, PP[j]) + Math.imul(pm, QQ[j])), qa ^ (Math.imul(qn, PP[j]) + Math.imul(qm, QQ[j])));
      const sn = sin(S.time * (1.1 + h * 1.7) + h * 40), g = (0.3 + 0.9 * sn ** 6 + fr) * smooth(1.2, 4, rm);
      dot(buf, tx - 0.5, ty - 0.5, g * 1.6, 255, 245, 225);
    }
  }
  // The target itself, a spark on the line.
  dot(buf, 0.25, TROW, 1.4, 255, 250, 235);
  const f = S.fade;
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, buf[p] * f), min(255, buf[p + 1] * f), min(255, buf[p + 2] * f));
}
