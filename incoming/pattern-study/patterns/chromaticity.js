// ===== Patternflow pattern =====
// Title:   Chromaticity
// Family:  colorimetry
// Idea:    Two chromaticity diagrams of the same colour space stacked on the panel, the CIE 1931 xy horseshoe above and the 1976 u'v' horseshoe below, in which the triangle of colours that three drifting spectral primaries can mix is lit at full brightness with a pale outline while the rest of the horseshoe, the colours that display cannot make, stays dim and drifts in soft patches of light, and a mixing point wanders inside the triangle, the same colour in both maps.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the CIE 1931 chromaticity diagram (Guild and Wright's colour matching, 1931) beside its 1976 u'v' remap (CIE 1976, after David MacAdam's 1937 work on uniform colour scales), the spectral locus from the multi-lobe Gaussian fit of the colour matching functions by Wyman, Sloan and Shirley (2013), and the display gamut drawn as the triangle of its three primaries, the way every gamut plot does; the pairing of the two maps with wandering spectral primaries, the luminance-weighted mix drawn in the swatch colours of the primaries, the mixing point that is one colour in both maps, and the patches of light on the ground are original, pattern round 255
// Round:   255
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Gamut=0..3, Drift=0.6..2.4, Dim=0.5..1
//
// Knob 1: Hue. Slides the three primaries along the spectral locus so the gamut turns round the horseshoe, from violet, green and orange at one end of the swing to cyan, yellow and deep red at the other; the swing is smooth, so the knob wraps and 1 is where 0 began.
// Knob 2: Gamut. 0 to 3, opening at 2. How pure the primaries are: at 0 they sit almost at the white point and the lit triangle is a small pale patch, at 2 they wander in from the spectral edge, at 3 they are laser lines on the edge and the triangle is as wide as three spectral colours can make it.
// Knob 3: Drift. 0.6 to 2.4, opening at 0.6. How fast the three primaries wander along the locus and in and out from its edge, the mixing point wanders inside the triangle and the patches of light drift over the ground; each follows its own slow rhythm and no two periods share a factor, and at 2.4 everything moves four times as fast.
// Knob 4: Dim. 0.5 to 1, opening at 0.5. How bright the colours outside the triangle are, the ones this display cannot mix: at 0.5 they sit in dark patches and soft glows so the lit triangle stands out, turned up the glows widen and the ground fills, until at 1 it is nearly as bright as the triangle and only the outline tells them apart.

const W = 64, H = 128;
const BH = 62;                                  // a diagram block is 64 x 62 LED
const BY = [1, 65];                             // top row of each block: xy above, u'v' below
const N = W * BH;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, pow, tanh, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// mirror a value into 0..1: it runs up to 1, turns and comes back, and turns again at 0
const fold = (v) => { const m = v - 2 * floor(v / 2); return m > 1 ? 2 - m : m; };
// a smooth triangle wave in -1..1: it flattens at the ends so the turn is soft, and its values are spread evenly
const wave = (a) => (sin(a) - sin(3 * a) / 9) * 0.9;
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const GI = 1 / 2.2;

const WX = 0.3127, WY = 0.3290;                 // the white point (D65)
// The fit stays within about 0.015 of the true locus from 420 to 650 nm and bends back at both ends (the real locus
// runs on to the violet end at 380 nm and the red end at 700 nm), so the polygon is the fit every 2 nm from 420 to
// 650 nm, closed at each end on the known end point.
const L0 = 420, L1 = 650, LS = 2;
const NL = (L1 - L0) / LS + 3;                  // the fitted points and the two end points
const VIO = [0.1741, 0.0050], RED = [0.7347, 0.2653];

// Wyman, Sloan, Shirley (2013): CIE 1931 colour matching functions as lobes of two-sided Gaussians
function lobe(l, mu, s1, s2) { const t = (l - mu) / (l < mu ? s1 : s2); return exp(-0.5 * t * t); }
function cmf(l, o) {
  o[0] = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
  o[1] = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
  o[2] = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
}
const cm = [0, 0, 0];
function locusXY(l, o) {
  const lf = l < L1 ? l : L1;
  cmf(lf, cm);
  const s = cm[0] + cm[1] + cm[2];
  o[0] = cm[0] / s; o[1] = cm[1] / s;
  // past 650 nm the real locus is the straight run into the red end point
  if (l > L1) {
    const t = min(1, (l - L1) / 40);
    o[0] += (RED[0] - o[0]) * t; o[1] += (RED[1] - o[1]) * t;
  }
}
function toUV(x, y, o) { const d = -2 * x + 12 * y + 3; o[0] = 4 * x / d; o[1] = 9 * y / d; }
function fromUV(u, v, o) { const d = 6 * u - 16 * v + 12; o[0] = 9 * u / d; o[1] = 4 * v / d; }

// the clean on-screen colour of a chromaticity: XYZ with Y = 1 to linear sRGB, a negative channel is lifted away
// by adding white, and the largest channel is made 1. The result is linear light.
function refLinear(x, y, o) {
  y = max(y, 1e-4);
  const X = x / y, Z = (1 - x - y) / y;
  let r = 3.2406 * X - 1.5372 - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 + 1.0570 * Z;
  const m = min(r, g, b);
  if (m < 0) { r -= m; g -= m; b -= m; }
  const mx = max(r, g, b);
  if (!(mx > 1e-9)) { o[0] = o[1] = o[2] = 1; return; }
  o[0] = r / mx; o[1] = g / mx; o[2] = b / mx;
}

// distance from point p to segment a-b; returns the squared distance and leaves the nearest point in nq
const nq = [0, 0];
function segD2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 1e-12 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  nq[0] = ax + t * dx; nq[1] = ay + t * dy;
  const ex = px - nq[0], ey = py - nq[1];
  return ex * ex + ey * ey;
}

// The three primaries. A primary has two coordinates, where it sits along the locus and how far it sits in from the
// edge, and each coordinate runs up and down its own range on its own period with a smooth turn at the ends, so it
// spends equal time everywhere in the range, plus a quick small shiver. The six periods (in seconds at the opening
// speed: along the locus 72, 52 and 61 for red, green and blue, in from the edge 99, 43 and 79) share no factor.
const FL = [0.0138, 0.0191, 0.0163], FG = [0.0101, 0.0233, 0.0127];
const FL2 = [0.0577, 0.0713, 0.0647], FG2 = [0.0839, 0.0689, 0.0953];
const LO = [596, 503, 430], SP = [68, 66, 62];  // the stretch of the locus each primary lives on
// The ground is lit unevenly by forty soft waves laid over the chromaticity plane, each with its own direction, width
// and rhythm, so patches of light and dark drift from one colour to the next without ever settling.
const NM = 40;
const WF = [0.0308, 0.0207, 0.0498, 0.0162, 0.0431, 0.0332, 0.0154, 0.0414, 0.0142, 0.0372, 0.0173, 0.06, 0.0192, 0.0249, 0.0484, 0.067, 0.0455, 0.035, 0.0686, 0.0618,
  0.0288, 0.0299, 0.0225, 0.0239, 0.0515, 0.0383, 0.0581, 0.0525, 0.0262, 0.0628, 0.0543, 0.0363, 0.0559, 0.0404, 0.0465, 0.0395, 0.0505, 0.0696, 0.0133, 0.0217];

// a fixed seed for the phases and the waves' directions, so every start is the same picture
const SEED = 14;
let rs = SEED;
function rnd() { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; }

export function setup(params) {
  rs = SEED;
  const tmp = [0, 0], tmp2 = [0, 0], lin = [0, 0, 0];
  // the spectral locus and its closing line of purples, in both maps
  const lxy = new Float64Array(NL * 2), luv = new Float64Array(NL * 2);
  for (let i = 0; i < NL; i++) {
    if (i === 0) { tmp[0] = VIO[0]; tmp[1] = VIO[1]; }
    else if (i === NL - 1) { tmp[0] = RED[0]; tmp[1] = RED[1]; }
    else locusXY(L0 + (i - 1) * LS, tmp);
    lxy[i * 2] = tmp[0]; lxy[i * 2 + 1] = tmp[1];
    toUV(tmp[0], tmp[1], tmp2);
    luv[i * 2] = tmp2[0]; luv[i * 2 + 1] = tmp2[1];
  }
  // the waves' wave vectors: any direction, a width between 0.2 and 0.55 of the diagram
  const WK = new Float64Array(NM * 2);
  for (let w = 0; w < NM; w++) {
    const th = rnd() * TP, kk = TP / (0.2 + 0.35 * rnd());
    WK[w * 2] = kk * cos(th); WK[w * 2 + 1] = kk * sin(th);
  }
  const dg = [];
  for (let d = 0; d < 2; d++) {
    const loc = d === 0 ? lxy : luv;
    let a0 = 9, a1 = -9, b0 = 9, b1 = -9;
    for (let i = 0; i < NL; i++) {
      a0 = min(a0, loc[i * 2]); a1 = max(a1, loc[i * 2]);
      b0 = min(b0, loc[i * 2 + 1]); b1 = max(b1, loc[i * 2 + 1]);
    }
    const sc = min((W - 3.2) / (a1 - a0), (BH - 3.2) / (b1 - b0));
    const ox = W / 2 - sc * (a0 + a1) / 2, oy = BY[d] + BH / 2 + sc * (b0 + b1) / 2;
    // the polygon in LED coordinates
    const pg = new Float64Array(NL * 2);
    for (let i = 0; i < NL; i++) { pg[i * 2] = ox + sc * loc[i * 2]; pg[i * 2 + 1] = oy - sc * loc[i * 2 + 1]; }

    const SD = new Float32Array(N), XP = new Float32Array(N), ZP = new Float32Array(N);
    const WC = new Float32Array(N * NM), WS = new Float32Array(N * NM);
    const FR = new Float32Array(N * 3), OR = new Float32Array(N * 3);
    const list = [];
    for (let j = 0; j < BH; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const px = i + 0.5, py = BY[d] + j + 0.5;
        // distance to the horseshoe's outline, and inside or out by crossing count
        let best = 1e9, qx = px, qy = py, cross = 0;
        for (let s = 0; s < NL; s++) {
          const s2 = s + 1 === NL ? 0 : s + 1;
          const ax = pg[s * 2], ay = pg[s * 2 + 1], bx = pg[s2 * 2], by = pg[s2 * 2 + 1];
          const d2 = segD2(px, py, ax, ay, bx, by);
          if (d2 < best) { best = d2; qx = nq[0]; qy = nq[1]; }
          if ((ay > py) !== (by > py) && px < ax + (py - ay) / (by - ay) * (bx - ax)) cross ^= 1;
        }
        const dist = sqrt(best);
        const sd = cross ? dist : -dist;
        SD[k] = sd;
        if (sd < -1.6) continue;
        list.push(k);
        // the chromaticity of this pixel, held on the outline for pixels just outside it
        const ia = ((cross ? px : qx) - ox) / sc, ib = (oy - (cross ? py : qy)) / sc;
        if (d === 0) { tmp[0] = ia; tmp[1] = ib; } else fromUV(ia, ib, tmp);
        const cx = tmp[0], cy = max(tmp[1], 1e-3);
        XP[k] = cx / cy; ZP[k] = (1 - cx - cy) / cy;
        for (let w = 0; w < NM; w++) {
          const A = WK[w * 2] * cx + WK[w * 2 + 1] * cy;
          WC[k * NM + w] = cos(A); WS[k * NM + w] = sin(A);
        }
        refLinear(cx, cy, lin);
        FR[k * 3] = pow(lin[0], GI); FR[k * 3 + 1] = pow(lin[1], GI); FR[k * 3 + 2] = pow(lin[2], GI);
        // the pure spectral colour at the nearest point of the outline
        const oa = (qx - ox) / sc, ob = (oy - qy) / sc;
        if (d === 0) { tmp[0] = oa; tmp[1] = ob; } else fromUV(oa, ob, tmp);
        refLinear(tmp[0], max(tmp[1], 1e-3), lin);
        OR[k * 3] = pow(lin[0], GI); OR[k * 3 + 1] = pow(lin[1], GI); OR[k * 3 + 2] = pow(lin[2], GI);
      }
    }
    dg.push({ sc, ox, oy, SD, XP, ZP, WC, WS, FR, OR, list: Int32Array.from(list) });
  }

  const ph = [];
  for (let i = 0; i < 80; i++) ph.push(rnd() * TP);
  const st = (params.st = {
    k: [0, 2, 0.6, 0.5], ks: [0, 2, 0.6, 0.5], init: false, tau: 0, ph, dg,
    buf: new Float32Array(W * H * 3),
    // per frame: the primaries (xy), their swatches and the matrix that turns a chromaticity into drive weights,
    // the brightness of the ground
    px: new Float64Array(3), py: new Float64Array(3),
    swk: new Float64Array(9), swe: new Float64Array(9),
    inv: new Float64Array(9), ok: false,
    dim: 0.3, cap: 0.5, aw: 1, lvmin: 0.2, wc: new Float64Array(NM), ws: new Float64Array(NM),
    tri: [new Float64Array(9), new Float64Array(9)],           // per diagram: the triangle's 3 edge lines (nx, ny, c)
    dot: [new Float64Array(8), new Float64Array(8)],           // per diagram: the three primaries, then the mixing point
  });
  return st;
}

const lin3 = [0, 0, 0];
const xyp = [0, 0];
const vxs = [0, 0, 0], vys = [0, 0, 0];

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  } else {
    const a = 1 - exp(-dt / 0.14);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  const k1 = cl(st.ks[0], 0, 1), k2 = cl(st.ks[1], 0, 3), k3 = cl(st.ks[2], 0.6, 2.4), k4 = cl(st.ks[3], 0.5, 1);
  st.tau += dt * k3 * 1.7;
  pose(st, st.tau, k1, k2);
  // Dim: brightness of the colours outside the triangle; the ground also breathes a little on its own clock
  const tau = st.tau, ph = st.ph;
  st.dim = 0.92 * k4 * (1 + 0.22 * (0.6 * sin(TP * 0.0049 * tau + ph[30]) + 0.4 * sin(TP * 0.0173 * tau + ph[31])));
  // the ground has a ceiling that rises with the knob, so the waves lift it without ever matching the triangle
  const u4 = (k4 - 0.5) / 0.5;
  st.cap = 0.68 + 0.32 * u4;
  st.aw = 1 - 0.85 * u4;                          // how much the waves still shape the ground
  st.lvmin = 0.2 + 0.8 * u4 * u4;                  // and how dark they may leave it
  for (let w = 0; w < NM; w++) {
    const a = TP * WF[w] * tau + ph[32 + w];
    st.wc[w] = 0.34 * cos(a); st.ws[w] = 0.34 * sin(a);
  }
}

// the whole geometry of the moment tau: the primaries, their swatches and mixing matrix, the triangle and the
// mixing point in both diagrams
function pose(st, tau, k1, k2) {
  const ph = st.ph;
  // Hue: one swing of the gamut along the locus, smooth at both ends so the knob wraps (1 is where 0 began).
  // The opening picture sits a little past the middle of the swing.
  const p = 0.44 + 2 * k1;
  const c = 0.5 - 0.5 * cos(PI * p);
  const cw = 0.9 * (c - 0.5);
  const gu = k2 / 3;
  // Gamut: how far from the white point the primaries sit, from a small pale patch to the laser lines of the locus
  const g = 0.2 + 0.8 * (1 - pow(1 - gu, 2.5));
  const depth = min(0.52, 1.4 * (1 - gu));       // how far a primary may slip in from its edge point; the lasers at 3 stay put
  for (let i = 0; i < 3; i++) {
    const o = i * 4;
    const zl = 0.5 + 0.5 * wave(TP * FL[i] * tau + ph[o]) + 0.07 * sin(TP * FL2[i] * tau + ph[o + 1]);
    const zg = 0.5 + 0.5 * wave(TP * FG[i] * tau + ph[o + 2]) + 0.06 * sin(TP * FG2[i] * tau + ph[o + 3]);
    // each wavelength is folded back into its own stretch of the locus rather than clipped, so none dwells at an end
    const lam = LO[i] + SP[i] * fold(0.5 + 0.62 * (2 * zl - 1) + cw);
    locusXY(lam, xyp);
    const gi = g * (1 - depth * fold(zg));
    const x = WX + gi * (xyp[0] - WX), y = WY + gi * (xyp[1] - WY);
    st.px[i] = x; st.py[i] = y;
    // the swatch: the clean on-screen colour of the primary; swk is that colour in linear light per unit of luminance
    refLinear(x, y, lin3);
    const L = 0.2126 * lin3[0] + 0.7152 * lin3[1] + 0.0722 * lin3[2];
    for (let ch = 0; ch < 3; ch++) { st.swk[i * 3 + ch] = lin3[ch] / L; st.swe[i * 3 + ch] = pow(lin3[ch], GI); }
  }
  // the matrix whose columns are the primaries at unit luminance, (x/y, 1, z/y): A = [[a b c], [1 1 1], [d e f]]
  const ma = st.px[0] / st.py[0], mb = st.px[1] / st.py[1], mc = st.px[2] / st.py[2];
  const md = (1 - st.px[0] - st.py[0]) / st.py[0], me = (1 - st.px[1] - st.py[1]) / st.py[1], mf = (1 - st.px[2] - st.py[2]) / st.py[2];
  const det = ma * (mf - me) + mb * (md - mf) + mc * (me - md);
  st.ok = abs(det) > 1e-7;
  if (st.ok) {
    const id = 1 / det, v = st.inv;
    v[0] = (mf - me) * id; v[1] = (mc * me - mb * mf) * id; v[2] = (mb - mc) * id;
    v[3] = (md - mf) * id; v[4] = (ma * mf - mc * md) * id; v[5] = (mc - ma) * id;
    v[6] = (me - md) * id; v[7] = (mb * md - ma * me) * id; v[8] = (ma - mb) * id;
  }

  // the mixing point: barycentric in xy, two slow rhythms for each of three weights, kept off the edges
  const e0 = 0.6 * sin(TP * 0.0313 * tau + ph[24]) + 0.4 * sin(TP * 0.0711 * tau + ph[25]);
  const e1 = 0.6 * sin(TP * 0.0371 * tau + ph[26]) + 0.4 * sin(TP * 0.0841 * tau + ph[27]);
  const e2 = 0.6 * sin(TP * 0.0257 * tau + ph[28]) + 0.4 * sin(TP * 0.0613 * tau + ph[29]);
  const q0 = exp(1.35 * e0), q1 = exp(1.35 * e1), q2 = exp(1.35 * e2), qs = q0 + q1 + q2;
  const sx = (q0 * st.px[0] + q1 * st.px[1] + q2 * st.px[2]) / qs;
  const sy = (q0 * st.py[0] + q1 * st.py[1] + q2 * st.py[2]) / qs;

  // the triangle and the dots in each diagram's own LED coordinates
  for (let d = 0; d < 2; d++) {
    const D = st.dg[d];
    const dot = st.dot[d];
    const vx = vxs, vy = vys;
    for (let i = 0; i < 3; i++) {
      let a = st.px[i], b = st.py[i];
      if (d === 1) { toUV(a, b, xyp); a = xyp[0]; b = xyp[1]; }
      vx[i] = D.ox + D.sc * a; vy[i] = D.oy - D.sc * b;
      dot[i * 2] = vx[i]; dot[i * 2 + 1] = vy[i];
    }
    // edge i lies opposite vertex i; its signed distance is positive inside
    const tr = st.tri[d];
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      const ex = vx[k] - vx[j], ey = vy[k] - vy[j];
      const ln = sqrt(ex * ex + ey * ey) || 1;
      let nx = -ey / ln, ny = ex / ln;
      let c2 = -(nx * vx[j] + ny * vy[j]);
      if (nx * vx[i] + ny * vy[i] + c2 < 0) { nx = -nx; ny = -ny; c2 = -c2; }
      tr[i * 3] = nx; tr[i * 3 + 1] = ny; tr[i * 3 + 2] = c2;
    }
    let a = sx, b = sy;
    if (d === 1) { toUV(a, b, xyp); a = xyp[0]; b = xyp[1]; }
    dot[6] = D.ox + D.sc * a; dot[7] = D.oy - D.sc * b;
  }
}

// a soft dark patch under a marker, so a dot reads on the bright triangle as well as on the dim ground
function shade(buf, cx, cy, r0, r1, k) {
  const x0 = max(0, floor(cx - r1)), x1 = min(W - 1, ceil(cx + r1)), y0 = max(0, floor(cy - r1)), y1 = min(H - 1, ceil(cy + r1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const f = 1 - k * (1 - sstep(r0, r1, sqrt(dx * dx + dy * dy)));
      const i = (y * W + x) * 3;
      buf[i] *= f; buf[i + 1] *= f; buf[i + 2] *= f;
    }
  }
}

// a thin white ring
function ring(buf, cx, cy, rad, w, alpha) {
  const R = ceil(rad + w + 1);
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, ceil(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, ceil(cy + R));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const a = (1 - sstep(w * 0.5, w * 0.5 + 0.8, abs(sqrt(dx * dx + dy * dy) - rad))) * alpha;
      const i = (y * W + x) * 3;
      buf[i] += (1 - buf[i]) * a; buf[i + 1] += (1 - buf[i + 1]) * a; buf[i + 2] += (1 - buf[i + 2]) * a;
    }
  }
}

// a bright dot in colour (r, g, b): a core with a soft edge and a glow round it
function addDot(buf, cx, cy, r, g, b, core, glow, ga) {
  const R = ceil(max(core + 1, glow * 2.6)) + 1;
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, ceil(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, ceil(cy + R));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const rr = sqrt(dx * dx + dy * dy);
      const i = (y * W + x) * 3;
      const hl = ga * exp(-rr * rr / (2 * glow * glow));
      const a = 1 - sstep(core - 0.6, core + 0.6, rr);
      let R0 = buf[i] + r * hl, G0 = buf[i + 1] + g * hl, B0 = buf[i + 2] + b * hl;
      R0 += (r - R0) * a; G0 += (g - G0) * a; B0 += (b - B0) * a;
      buf[i] = R0 > 1 ? 1 : R0; buf[i + 1] = G0 > 1 ? 1 : G0; buf[i + 2] = B0 > 1 ? 1 : B0;
    }
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const buf = st.buf;
  buf.fill(0);
  const dim = st.dim, cap = st.cap, aw = st.aw, lvmin = st.lvmin, ok = st.ok;
  const swe = st.swe;
  const inv = st.inv, swk = st.swk;
  const v0 = inv[0], v1 = inv[1], v2 = inv[2], v3 = inv[3], v4 = inv[4], v5 = inv[5], v6 = inv[6], v7 = inv[7], v8 = inv[8];
  const k0 = swk[0], k1 = swk[1], k2 = swk[2], k3 = swk[3], k4 = swk[4], k5 = swk[5], k6 = swk[6], k7 = swk[7], k8 = swk[8];
  const wc = st.wc, ws = st.ws;

  for (let d = 0; d < 2; d++) {
    const D = st.dg[d], tr = st.tri[d], list = D.list;
    const SD = D.SD, XP = D.XP, ZP = D.ZP, WC = D.WC, WS = D.WS, FR = D.FR, OR = D.OR;
    const n0x = tr[0], n0y = tr[1], n0c = tr[2], n1x = tr[3], n1y = tr[4], n1c = tr[5], n2x = tr[6], n2y = tr[7], n2c = tr[8];
    const by = BY[d];
    for (let q = 0; q < list.length; q++) {
      const k = list[q];
      const x = k & (W - 1), yl = (k / W) | 0;
      const px = x + 0.5, py = by + yl + 0.5;
      const sd = SD[k];
      const m = sd >= 0.5 ? 1 : sd <= -0.5 ? 0 : sd + 0.5;
      const fr = FR[k * 3], fg = FR[k * 3 + 1], fb = FR[k * 3 + 2];
      // outside the triangle the colour of the spot, dim and unevenly lit; inside, what the three primaries make of it
      let F = 0;
      for (let w = 0; w < NM; w++) F += WC[k * NM + w] * wc[w] - WS[k * NM + w] * ws[w];
      F *= aw;
      let lv = 1 + F;
      if (lv < lvmin) lv = lvmin;
      const gl = cap * tanh(dim * lv / cap);
      let r = fr * gl, g = fg * gl, b = fb * gl;
      let s = -9;
      if (ok) {
        const a0 = n0x * px + n0y * py + n0c, a1 = n1x * px + n1y * py + n1c, a2 = n2x * px + n2y * py + n2c;
        s = a0 < a1 ? (a0 < a2 ? a0 : a2) : (a1 < a2 ? a1 : a2);
      }
      const f = s >= 0.5 ? 1 : s <= -0.5 ? 0 : s + 0.5;
      if (f > 0) {
        const X = XP[k], Z = ZP[k];
        let w0 = v0 * X + v1 + v2 * Z, w1 = v3 * X + v4 + v5 * Z, w2 = v6 * X + v7 + v8 * Z;
        if (w0 < 0) w0 = 0; if (w1 < 0) w1 = 0; if (w2 < 0) w2 = 0;
        const wsum = w0 + w1 + w2;
        if (wsum > 1e-9) {
          const iw = 1 / wsum;
          w0 *= iw; w1 *= iw; w2 *= iw;
          const mr = w0 * k0 + w1 * k3 + w2 * k6, mg = w0 * k1 + w1 * k4 + w2 * k7, mb = w0 * k2 + w1 * k5 + w2 * k8;
          const im = 1 / max(mr, mg, mb, 1e-9);
          // the same waves shade the lit triangle a little
          const lm = 1 - 0.3 * sstep(-1.2, 1.2, F);
          r += (pow(mr * im, GI) * lm - r) * f; g += (pow(mg * im, GI) * lm - g) * f; b += (pow(mb * im, GI) * lm - b) * f;
        }
      }
      r *= m; g *= m; b *= m;
      // the outline of the horseshoe in the colour of the spot
      const ad = sd < 0 ? -sd : sd;
      const rim = 1 - sstep(0.6, 1.4, ad);
      if (rim > 0.01) {
        r += (OR[k * 3] - r) * rim; g += (OR[k * 3 + 1] - g) * rim; b += (OR[k * 3 + 2] - b) * rim;
      }
      // the triangle's outline, pale
      if (ok) {
        const as = s < 0 ? -s : s;
        const tl = 1 - sstep(0.4, 1.15, as);
        if (tl > 0.01) {
          const ta = 0.92 * tl;
          r += (1 - r) * ta; g += (1 - g) * ta; b += (1 - b) * ta;
        }
      }
      const i = (by + yl) * W * 3 + x * 3;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
  }

  for (let d = 0; d < 2; d++) {
    const dot = st.dot[d];
    if (!ok) continue;
    // a small triangle gets small markers, so three rings do not pile into one blob
    let sep = 1e9;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      sep = min(sep, sqrt((dot[i * 2] - dot[j * 2]) ** 2 + (dot[i * 2 + 1] - dot[j * 2 + 1]) ** 2));
    }
    const big = sstep(3, 8, sep), rg = sstep(6, 11, sep);
    const core = 0.85 + 0.5 * big;
    if (rg > 0) for (let i = 0; i < 3; i++) shade(buf, dot[i * 2], dot[i * 2 + 1], 1.9, 2.7, 0.7 * rg);
    shade(buf, dot[6], dot[7], 2.2, 3.4, 0.55);
    for (let i = 0; i < 3; i++) {
      addDot(buf, dot[i * 2], dot[i * 2 + 1], swe[i * 3], swe[i * 3 + 1], swe[i * 3 + 2], core, 2.2, 0.35);
      if (rg > 0) ring(buf, dot[i * 2], dot[i * 2 + 1], 2.9, 1.3, 0.95 * rg);
    }
    addDot(buf, dot[6], dot[7], 1, 1, 1, 1.6, 1.6, 0.0);
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      display.setPixel(x, y, r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0, g <= 0 ? 0 : g >= 1 ? 255 : (g * 255 + 0.5) | 0, b <= 0 ? 0 : b >= 1 ? 255 : (b * 255 + 0.5) | 0);
    }
  }
}
