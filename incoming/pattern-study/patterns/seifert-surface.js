// ===== Patternflow pattern =====
// Title:   Seifert Surface
// Family:  topology
// Idea:    A knot drawn as a closed braid down the panel goes through Seifert's algorithm step by step: its crossings are smoothed so it falls apart into nested Seifert circles, each circle fills with a disc at its own depth, a half-twisted band joins two discs at every crossing, and the finished surface rocks in 3-D with its two faces in two colours, each band turning from gold to blue across its half twist, before the next knot.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Seifert's algorithm (Herbert Seifert, 1934), every knot a closed braid (James Alexander, 1923), homogeneous braids give a minimal-genus surface (John Stallings, 1978), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Knot=0..7, Tilt=40..80
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the face every disc shows the viewer is blue on the outer disc, indigo and violet further in, the other face is gold, the knot pale gold, and each Seifert circle a light tint of its disc.
// Knob 2: Speed. At 2 one knot takes 17.2 seconds: 1.4 to draw it along its orientation, the crossings smoothed from 2.2 to 3.6, the discs in from 3.8 to 5.4, the bands one after another from 5.8 to 8.8, then the finished surface rocks twice while a bright run goes round its edge at 40 LEDs a second, and fades from 16.4. 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Knot. The knot to start from, then on round the list: 0 the trefoil 3_1 (sigma1^3), 1 the figure eight 4_1 ((sigma1 sigma2^-1)^2), 2 5_1 (sigma1^5), 3 5_2 (sigma1^3 sigma2 sigma1^-1 sigma2), 4 6_2 (sigma1^-1 sigma2 sigma1^-1 sigma2^3), 5 6_3 (sigma1^-1 sigma2^2 sigma1^-2 sigma2), 6 7_1 (sigma1^7), 7 8_19 ((sigma1 sigma2)^4). The surfaces have genus 1, 1, 2, 2, 2, 2, 3, 3; all but 5_2's are the least the knot allows, and 5_2, genus 1, gets 2 from this braid.
// Knob 4: Tilt. How far the view turns about the panel's upright middle, 40 to 80 degrees. The discs lie 22 LEDs apart in depth, so at the full turn they slide 14 LEDs apart at 40 and 22 at 80, where they stand as thin plates with the bands bridging them. The knot itself is drawn turned a fifth as far, and the finished surface rocks between a fifth of the Tilt and all of it.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, cos, sin, abs, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));

// Knots as closed braids: the number of strands, and the word (i for
// sigma_i, -i for its inverse). Each closes up to one component.
const KNOTS = [
  { name: "3_1", n: 2, w: [1, 1, 1] },
  { name: "4_1", n: 3, w: [1, -2, 1, -2] },
  { name: "5_1", n: 2, w: [1, 1, 1, 1, 1] },
  { name: "5_2", n: 3, w: [1, 1, 1, 2, -1, 2] },
  { name: "6_2", n: 3, w: [-1, 2, -1, 2, 2, 2] },
  { name: "6_3", n: 3, w: [-1, 2, 2, -1, -1, 2] },
  { name: "7_1", n: 2, w: [1, 1, 1, 1, 1, 1, 1] },
  { name: "8_19", n: 3, w: [1, 2, 1, 2, 1, 2, 1, 2] },
];
// The steps of one knot, in seconds at Speed 2.
const T_HOLD = 1.4, T_SMOOTH = 2.2, T_DISCS = 3.8, T_BANDS = 5.8, T_DONE = 8.8, T_FADE = 16.4, T_NEXT = 17.2;
// Depth between stacked discs, in LEDs.
const DZ = 22;
const STEP = 0.6;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The diagram, in LEDs about the panel's middle column. The braid runs
// down the left and strand i comes back up the right, so once the
// crossings are smoothed strand i is the rounded rectangle "loop i", the
// loops nested one inside the next: wide apart on the left where the
// bands go, close on the right. Disc i lies at depth z = (i - (n-1)/2) DZ,
// the inner discs nearer the viewer. Every loop runs down its left side,
// so the Seifert circles are oriented alike and every disc turns the same
// face to the viewer.
function layout(K) {
  const n = K.n, c = K.w.length, dl = n === 2 ? 22 : 15, dr = n === 2 ? 8 : 6;
  const loops = [];
  for (let i = 0; i < n; i++)
    loops.push({ l: -30 + i * dl, r: 26 - dr * i, t: 4 + 7 * i, b: 124 - 7 * i, rc: 12 - 2 * i, z: (i - (n - 1) / 2) * DZ });
  let top = -1e9, bot = 1e9;
  for (const L of loops) (top = max(top, L.t + L.rc)), (bot = min(bot, L.b - L.rc));
  const gap = (bot - top) / c, h = min(8, 0.36 * gap);
  const cross = K.w.map((g, k) => ({ i: abs(g) - 1, sg: g > 0 ? 1 : -1, y: top + (k + 0.5) * gap }));
  return { n, c, loops, cross, h, top, bot };
}

// A point of crossing k's band: u runs from the left loop (u = 0) to the
// right one (u = 1), v across from -1 to 1. The band's width turns half
// round about its core on the way, the sense of the turn set by the
// crossing's sign, so its two edges pass over each other once: those edges
// are the knot's two strands at the crossing.
function bandPoint(G, k, u, v, out) {
  const X = G.cross[k], A = G.loops[X.i], B = G.loops[X.i + 1];
  const h = G.h, e = -X.sg;
  out[0] = A.l + u * (B.l - A.l);
  out[1] = X.y + v * h * cos(PI * u);
  out[2] = A.z + u * (B.z - A.z) + v * h * e * sin(PI * u);
}

// The knot, walked along its orientation as one closed polyline. Every
// point keeps where it sits in the knot, where it sits once the crossings
// are smoothed, its crossing (or -1), the Seifert circle it lands on, and
// how far along the knot it is.
function walk(G) {
  const P = [];
  const add = (x, y, z, sx, sy, sz, k, circ) => P.push([x, y, z, sx, sy, sz, k, circ]);
  const line = (i, x0, y0, x1, y1) => {
    const z = G.loops[i].z, m = max(1, ceil(hypot(x1 - x0, y1 - y0) / STEP));
    for (let j = 0; j < m; j++) {
      const x = x0 + ((x1 - x0) * j) / m, y = y0 + ((y1 - y0) * j) / m;
      add(x, y, z, x, y, z, -1, i);
    }
  };
  const arc = (i, cx, cy, a0, a1) => {
    const L = G.loops[i], m = max(2, ceil((L.rc * abs(a1 - a0)) / STEP));
    for (let j = 0; j < m; j++) {
      const t = a0 + ((a1 - a0) * j) / m, x = cx + L.rc * cos(t), y = cy + L.rc * sin(t);
      add(x, y, L.z, x, y, L.z, -1, i);
    }
  };
  // Loop i from the foot of the braid round the bottom, up the right and
  // over the top, back to the head of the braid.
  const around = (i) => {
    const { l, r, t, b, rc } = G.loops[i];
    line(i, l, G.bot, l, b - rc);
    arc(i, l + rc, b - rc, PI, PI / 2);
    line(i, l + rc, b, r - rc, b);
    arc(i, r - rc, b - rc, PI / 2, 0);
    line(i, r, b - rc, r, t + rc);
    arc(i, r - rc, t + rc, 0, -PI / 2);
    line(i, r - rc, t, l + rc, t);
    arc(i, l + rc, t + rc, -PI / 2, -PI);
    line(i, l, t + rc, l, G.top);
  };
  const q = [0, 0, 0];
  let p = 0, guard = 0;
  do {
    let y = G.top;
    G.cross.forEach((X, k) => {
      if (X.i !== p && X.i + 1 !== p) return;
      line(p, G.loops[p].l, y, G.loops[p].l, X.y - G.h);
      const down = X.i === p, i0 = X.i, i1 = X.i + 1;
      const m = max(8, ceil(hypot(G.loops[i1].l - G.loops[i0].l, 2 * G.h, G.loops[i1].z - G.loops[i0].z) / STEP));
      for (let j = 0; j < m; j++) {
        // Down a strand from loop i to loop i + 1 (or back): its first half
        // smooths onto the loop it came from, its second onto the other.
        const w = j / m, u = down ? w : 1 - w, first = w < 0.5;
        bandPoint(G, k, u, down ? -1 : 1, q);
        const circ = down === first ? i0 : i1, L = G.loops[circ];
        add(q[0], q[1], q[2], L.l, X.y - G.h + 2 * w * G.h, L.z, k, circ);
      }
      p = down ? i1 : i0;
      y = X.y + G.h;
    });
    line(p, G.loops[p].l, y, G.loops[p].l, G.bot);
    around(p);
  } while (p !== 0 && ++guard < 4);
  const n = P.length, D = new Float32Array(n * 9);
  let s = 0;
  P.forEach((e, j) => {
    for (let t = 0; t < 8; t++) D[j * 9 + t] = e[t];
    D[j * 9 + 8] = s;
    const f = P[(j + 1) % n];
    s += hypot(f[0] - e[0], f[1] - e[1], f[2] - e[2]);
  });
  return { D, n, length: s, passes: guard + 1 };
}

export function buildKnot(index) {
  const K = KNOTS[((index % KNOTS.length) + KNOTS.length) % KNOTS.length];
  const G = layout(K);
  G.name = K.name;
  G.word = K.w;
  G.knot = walk(G);
  return G;
}

export function setup(params) {
  params.s = {
    G: null, idx: -1, knob: -1, t: 0, hue: 0, tilt: 0.7,
    zb: new Float32Array(NPX), rgb: new Float32Array(NPX * 3), hz: new Float32Array(NPX), cz: new Float32Array(NPX),
    lr: new Float32Array(NPX * 3), gl: new Float32Array(NPX * 3), gv: new Float32Array(NPX * 3), c: [0, 0, 0], q: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 40];
  const g = (cl(dt || 0, 0, 0.1) * cl(kv[1], 0.2, 3)) / 2;
  S.hue = cl(kv[0], 0, 1);
  S.tilt = (cl(kv[3], 40, 80) * PI) / 180;
  const knob = floor(cl(kv[2], 0, 7) + 1e-6);
  if (knob !== S.knob) (S.knob = knob), (S.idx = knob), (S.G = buildKnot(knob)), (S.t = 0);
  S.t += g;
  if (S.t >= T_NEXT) (S.t -= T_NEXT), (S.idx += 1), (S.G = buildKnot(S.idx));
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const G = S.G, t = S.t, { zb, rgb, hz, cz, lr, c: col, q } = S;
  const n = G.n, nc = G.c;
  // The view turns about the panel's upright middle: a fifth of the Tilt
  // while the knot and its circles are drawn, out to the whole Tilt as the
  // discs come in, then rocking between the two while the surface is whole.
  const tl = S.tilt;
  let phi = tl * (0.18 + 0.06 * sin(t * 1.3));
  if (t > T_DISCS) phi += (tl - phi) * ease((t - T_DISCS) / 2);
  if (t > T_DONE) phi = tl * (0.6 + 0.4 * cos((PI * (t - T_DONE)) / 1.9));
  const cp = cos(phi), sp = sin(phi);
  const fade = t > T_FADE ? 1 - ease((t - T_FADE) / (T_NEXT - T_FADE - 0.05)) : 1;
  const smooth = ease((t - T_SMOOTH) / 1.4);
  const bandOf = (k) => ease((t - T_BANDS - (k * 2.4) / max(1, nc - 1)) / 0.6);
  const discOf = (i) => ease((t - T_DISCS - 0.4 * i) / 0.8);
  zb.fill(-1e9);
  rgb.fill(0);
  hz.fill(-1e9);
  cz.fill(-1e9);
  lr.fill(0);
  const H0 = S.hue;
  // Two faces: the face every disc turns to the viewer is blue to violet,
  // a shade per disc; the other face is gold.
  const face = (i, v, out) => hsv(H0 + 0.58 + 0.09 * i, 0.75, v, out);
  const other = (v, out) => hsv(H0 + 0.12, 0.85, v, out);
  // Discs: each LED is taken back through the turn onto each disc's plane,
  // and the nearest disc that holds it wins.
  for (let i = 0; i < n; i++) {
    const A = discOf(i);
    if (A <= 0) continue;
    const L = G.loops[i];
    if (cp > 0) face(i, 0.62 * A * fade, col);
    else other(0.62 * A * fade, col);
    const mx = (L.l + L.r) / 2, hw = (L.r - L.l) / 2 - L.rc, my = (L.t + L.b) / 2, hh = (L.b - L.t) / 2 - L.rc;
    // Only the columns the turned disc can reach.
    const xa = max(0, floor(32 + min(L.l * cp, L.r * cp) + L.z * sp - 1)), xb = min(W - 1, ceil(32 + max(L.l * cp, L.r * cp) + L.z * sp + 1));
    const ic = 1 / cp, off = 32 + L.z * sp, r2 = L.rc * L.rc, kx = 0.6 / (L.r - L.l), ky = 0.6 / (L.b - L.t);
    for (let y = max(0, floor(L.t)); y <= min(H - 1, ceil(L.b)); y++) {
      const dy = abs(y + 0.5 - my) - hh;
      if (dy > L.rc) continue;
      const sy = 1 - (y - L.t) * ky;
      for (let x = xa; x <= xb; x++) {
        const xm = (x + 0.5 - off) * ic;
        const dx = abs(xm - mx) - hw;
        if (dx > L.rc || (dx > 0 && dy > 0 && dx * dx + dy * dy > r2)) continue;
        const d = -xm * sp + L.z * cp, p = y * W + x;
        if (d <= zb[p]) continue;
        zb[p] = d;
        // A soft light from the upper left.
        const shade = 0.78 + 0.22 * cl(sy - (xm - L.l) * kx, 0, 1);
        rgb[p * 3] = col[0] * shade;
        rgb[p * 3 + 1] = col[1] * shade;
        rgb[p * 3 + 2] = col[2] * shade;
      }
    }
  }
  // Bands, sampled finely and splatted with the depth test. Where a band
  // turns to the viewer the face the discs show, it takes their colour;
  // where its half twist shows the other face, gold.
  for (let k = 0; k < nc; k++) {
    const B = bandOf(k);
    if (B <= 0) continue;
    const X0 = G.cross[k], A = G.loops[X0.i], Bl = G.loops[X0.i + 1], hb = G.h, e = -X0.sg;
    const ddx = Bl.l - A.l, ddz = Bl.z - A.z;
    const NU = ceil(hypot(ddx, ddz) * 1.6), NV = ceil(hb * 3.2);
    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU, cu = cos(PI * u), su = sin(PI * u);
      const x = A.l + u * ddx, zc = A.z + u * ddz;
      for (let iv = 0; iv <= NV; iv++) {
        const v = -1 + (2 * iv) / NV;
        const y = X0.y + v * hb * cu, z = zc + v * hb * e * su;
        const X = 32 + x * cp + z * sp, d = -x * sp + z * cp;
        const px = floor(X), py = floor(y);
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const p = py * W + px;
        if (d <= zb[p]) continue;
        // The face's normal, d/du x d/dv; the band is oriented to agree
        // with the disc it runs into at u = 1.
        const uy = -v * hb * PI * su, uz = ddz + v * hb * e * PI * cu, vy = hb * cu, vz = hb * e * su;
        const nx = uy * vz - uz * vy, nz = ddx * vy;
        const lit = 0.7 + (0.3 * abs(-nx * sp + nz * cp)) / (hypot(nx, nz) + 1e-9);
        if (nx * sp - nz * cp > 0) face(X0.i + u, 0.85 * lit * fade, col);
        else other(0.95 * lit * fade, col);
        // A band coming in shows through to what lies behind it.
        if (B > 0.5) zb[p] = d;
        rgb[p * 3] += (col[0] - rgb[p * 3]) * B;
        rgb[p * 3 + 1] += (col[1] - rgb[p * 3 + 1]) * B;
        rgb[p * 3 + 2] += (col[2] - rgb[p * 3 + 2]) * B;
      }
    }
  }
  // The curve. The points of the crossing strands first mark the LEDs round
  // them as passed at their depth; then a point draws its core only where
  // nothing a good way nearer passes close by, which leaves the gap of an
  // under-crossing.
  const KD = G.knot.D, KN = G.knot.n, len = G.knot.length;
  const drawn = t < T_HOLD ? len * ease(t / T_HOLD) : len + 1;
  const pos = (j, out) => {
    const o = j * 9, k = KD[o + 6];
    const m = k >= 0 ? smooth * (1 - bandOf(k)) : 0;
    out[0] = KD[o] + (KD[o + 3] - KD[o]) * m;
    out[1] = KD[o + 1] + (KD[o + 4] - KD[o + 1]) * m;
    out[2] = KD[o + 2] + (KD[o + 5] - KD[o + 2]) * m;
  };
  for (let j = 0; j < KN; j++) {
    if (KD[j * 9 + 8] > drawn) break;
    if (KD[j * 9 + 6] < 0) continue;
    pos(j, q);
    const X = 32 + q[0] * cp + q[2] * sp, d = -q[0] * sp + q[2] * cp, Y = q[1];
    for (let yy = max(0, floor(Y - 2.6)); yy <= min(H - 1, floor(Y + 2.6)); yy++)
      for (let xx = max(0, floor(X - 2.6)); xx <= min(W - 1, floor(X + 2.6)); xx++) {
        const ex = xx + 0.5 - X, ey = yy + 0.5 - Y;
        if (ex * ex + ey * ey > 6.76) continue;
        const p = yy * W + xx;
        if (d > hz[p]) hz[p] = d;
      }
  }
  // One knot in white, then its Seifert circles each in its disc's colour,
  // then white again as the bands make it the surface's edge. A bright run
  // goes round it the way it is oriented.
  const circ = ease((t - T_SMOOTH) / 0.8) * (1 - ease((t - T_BANDS) / 2.6));
  const runAt = ((t * 40) % (len + 60)) - 30;
  // The knot is a pale tint of the gold face; it draws thinner once it is
  // the edge of the surface.
  const pale = [0, 0, 0];
  hsv(H0 + 0.12, 0.22, 0.95, pale);
  const rad = 1.2 - 0.4 * ease((t - T_BANDS) / 2);
  for (let j = 0; j < KN; j++) {
    const o = j * 9, s = KD[o + 8];
    if (s > drawn) break;
    pos(j, q);
    const X = 32 + q[0] * cp + q[2] * sp, d = -q[0] * sp + q[2] * cp, Y = q[1];
    hsv(H0 + 0.58 + 0.09 * KD[o + 7], 0.5, 1, col);
    const run = t < T_SMOOTH || t > T_DONE ? cl(1 - abs(s - runAt) / 16, 0, 1) : 0;
    const wv = (1 - circ) * (1 - 0.45 * run);
    const tip = t < T_HOLD ? cl(1 - (drawn - s) / 12, 0, 1) : 0;
    const r = col[0] * circ + wv * pale[0] + run * 1.0 * (1 - circ) + tip;
    const gg = col[1] * circ + wv * pale[1] + run * 0.75 * (1 - circ) + tip;
    const bb = col[2] * circ + wv * pale[2] + run * 0.2 * (1 - circ) + tip;
    for (let yy = max(0, floor(Y - rad)); yy <= min(H - 1, floor(Y + rad)); yy++)
      for (let xx = max(0, floor(X - rad)); xx <= min(W - 1, floor(X + rad)); xx++) {
        const ex = xx + 0.5 - X, ey = yy + 0.5 - Y;
        if (ex * ex + ey * ey > rad * rad) continue;
        const p = yy * W + xx;
        if (d < hz[p] - 3 || d < zb[p] - 3 || d < cz[p]) continue;
        cz[p] = d;
        lr[p * 3] = r * fade;
        lr[p * 3 + 1] = gg * fade;
        lr[p * 3 + 2] = bb * fade;
      }
  }
  // A faint glow round the curve where nothing else is lit: the curve
  // blurred over five LEDs each way, a row pass and then a column pass.
  const { gl, gv } = S, glow = t < T_DISCS + 2;
  if (glow) {
    for (let y = 0; y < H; y++)
      for (let ch = 0; ch < 3; ch++) {
        let acc = 0;
        for (let x = -2; x < W; x++) {
          if (x + 2 < W) acc += lr[(y * W + x + 2) * 3 + ch];
          if (x - 3 >= 0) acc -= lr[(y * W + x - 3) * 3 + ch];
          if (x >= 0) gl[(y * W + x) * 3 + ch] = acc;
        }
      }
    for (let x = 0; x < W; x++)
      for (let ch = 0; ch < 3; ch++) {
        let acc = 0;
        for (let y = -2; y < H; y++) {
          if (y + 2 < H) acc += gl[((y + 2) * W + x) * 3 + ch];
          if (y - 3 >= 0) acc -= gl[((y - 3) * W + x) * 3 + ch];
          if (y >= 0) gv[(y * W + x) * 3 + ch] = acc * 0.035;
        }
      }
  }
  for (let p = 0; p < NPX; p++) {
    const src = cz[p] > -1e8 ? lr : zb[p] > -1e8 || !glow ? rgb : gv;
    const o = p * 3;
    display.setPixel(p % W, (p / W) | 0, (255 * cl(src[o], 0, 1)) | 0, (255 * cl(src[o + 1], 0, 1)) | 0, (255 * cl(src[o + 2], 0, 1)) | 0);
  }
}
