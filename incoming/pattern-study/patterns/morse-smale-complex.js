// ===== Patternflow pattern =====
// Title:   Morse-Smale Complex
// Family:  morsesmale
// Idea:    A smooth landscape of wandering hills and hollows is painted from deep indigo to rose gold, and on it stands its skeleton, cream ridges climbing from every saddle to the peaks and blue valley lines sinking to the pits, so that as the hills drift together a peak and its saddle slide toward each other and the short ridge between them shrinks to a point and is gone, while a new pair is born out of the bare slope and parts.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: critical points of a smooth function (Marston Morse, 1934, from memory), gradient flows with stable and unstable manifolds, the Morse-Smale condition (Stephen Smale, 1960s, from memory), the Morse-Smale complex of a scalar field in two dimensions and its simplification by persistence (Herbert Edelsbrunner, John Harer and Afra Zomorodian, 2003, from memory); pattern round 234
// Round:   234
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.6..3, Scale=-1..1, Persistence=-1..1
//
// Knob 1: Hue. Turns the landscape and its skeleton round the colour wheel together. At 0 the field runs deep indigo through magenta and rose to gold, with cream ridges, azure valleys, warm peak discs and cyan pit rings; at 0.25 it is amber with mint ridges and pink valleys, at 0.5 green and teal with white ridges and orange valleys, at 0.75 blue and lilac with pink ridges and green valleys, and the opening again at 1.
// Knob 2: Drift. How fast the hills wander and breathe: 0.3 times the opening speed at 0.6, the opening at 2, where a hill moves up to about 1 LED a second and a peak and a saddle are born or cancel every 4 s or so, and 1.5 times that at 3. At 0.6 a pair comes or goes about every 16 s, at 3 about every 3 s.
// Knob 3: Scale. The width of the hills, sigma 6.7 LED at -1, 10.5 at the opening 0 and 16.5 at 1. At -1 about 26 ridges and valleys and 10 saddles are drawn and the field is a net with cells of 25 LED, at the opening 17 lines and 5 saddles, at 1 about 8 lines and 3 saddles, two or three big peaks joined by long ridges.
// Knob 4: Persistence. How tall a ridge or valley must stand over its saddle, the height difference to the peak or pit it reaches, to be drawn, as a share of the tallest one: 3 percent at -1 (about 24 lines, 740 LED of them, every short ridge shows), 23 percent at the opening 0.06 (17 lines, 550 LED), 73 percent at 1 (4 or 5 lines, 170 LED, only the bold ones). Turning it up takes the small ridges off one at a time.

const W = 64;
const H = 128;
const { floor, ceil, exp, abs, max, min, sin, cos, sqrt, atan2, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the world the critical points are looked for in: the panel and a margin
const X0 = -8;
const X1 = W + 8;
const Y0 = -8;
const Y1 = H + 8;
const GS = 4; // LED between seed nodes
const GX = ceil((X1 - X0) / GS) + 1;
const GY = ceil((Y1 - Y0) / GS) + 1;
const NB = 8; // the hills
const NW = 2; // the plane waves
const MAXPT = 64; // critical points
const MAXLN = 96; // separatrices
const LNLEN = 200; // points in one
const PKR = 2.5; // a peak's radius
const PKA = 2.9; // a saddle's half-lengths, along the ridge and along the valley
const PKB = 2.0;

// home x, y, height, sigma, orbit amplitudes (x1, y1, x2, y2), orbit rates in rad/s (x1, y1, x2, y2)
const BL = [
  [14, 12, 1.0, 10.5, 11, 9, 5, 6, 0.0731, 0.0613, 0.0297, 0.0439],
  [47, 22, 0.9, 9.5, 11, 10, 4, 7, 0.0557, 0.0791, 0.0353, 0.0261],
  [27, 42, -0.85, 10.5, 12, 9, 6, 5, 0.0497, 0.0673, 0.0251, 0.0373],
  [51, 60, 1.1, 11.5, 10, 12, 5, 6, 0.0667, 0.0467, 0.0331, 0.0289],
  [13, 72, -0.75, 9.5, 11, 10, 5, 7, 0.0589, 0.0721, 0.0317, 0.0229],
  [35, 91, 0.95, 10.5, 12, 11, 6, 5, 0.0449, 0.0577, 0.0271, 0.0347],
  [51, 110, -0.9, 10.0, 10, 9, 4, 7, 0.0701, 0.0521, 0.0239, 0.0409],
  [15, 118, 0.85, 11.0, 11, 8, 6, 6, 0.0521, 0.0643, 0.0361, 0.0307],
];
// the weak waves: amplitude, wavelength, direction, direction rate, phase rate
const WV = [
  [0.1, 38, 0.6, 0.0171, 0.171],
  [0.085, 53, 2.3, -0.0123, -0.113],
];

// ---- colour: OKLCH to sRGB
function oklch(L, C, hDeg, out) {
  const h = (hDeg * PI) / 180;
  const a = C * cos(h);
  const b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  for (let i = 0; i < 3; i++) {
    const v = cl(lin[i], 0, 1);
    out[i] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
  }
}

// the landscape: lightness, chroma, hue in degrees (unwrapped), at heights 0 .. 1
const RAMP = [
  [0, 0.4, 0.12, 280],
  [0.3, 0.46, 0.14, 305],
  [0.55, 0.57, 0.15, 335],
  [0.78, 0.69, 0.14, 365],
  [1, 0.77, 0.14, 425],
];
// skeleton colours: [L, C, hue] and the far end of the line, each turned with K1
const SK = {
  ridge: [0.97, 0.045, 95],
  ridgeEnd: [0.91, 0.12, 78],
  valley: [0.74, 0.15, 245],
  valleyEnd: [0.62, 0.16, 262],
  peak: [0.97, 0.1, 88],
  pit: [0.84, 0.13, 215],
  pitCore: [0.16, 0.07, 275],
};

function buildColours(P, k1) {
  const rot = 360 * k1;
  const o = [0, 0, 0];
  for (let i = 0; i < 256; i++) {
    const u = i / 255;
    let s = 1;
    while (s < RAMP.length - 1 && RAMP[s][0] < u) s++;
    const a = RAMP[s - 1];
    const b = RAMP[s];
    const t = (u - a[0]) / (b[0] - a[0]);
    const L = a[1] + (b[1] - a[1]) * t;
    const h = a[3] + (b[3] - a[3]) * t + rot;
    // dark orange, olive and green read as mud on the panel, so the dark end is lifted where the hue goes there
    const warm = pow(max(0, cos(((h - 90) * PI) / 180)), 0.8);
    oklch(L + max(0, 0.64 - L) * warm * 0.85, a[2] + (b[2] - a[2]) * t, h, o);
    P.lut[i * 3] = o[0];
    P.lut[i * 3 + 1] = o[1];
    P.lut[i * 3 + 2] = o[2];
  }
  let n = 0;
  for (const key of Object.keys(SK)) {
    oklch(SK[key][0], SK[key][1], SK[key][2] + rot, o);
    P.sk[n++] = o[0];
    P.sk[n++] = o[1];
    P.sk[n++] = o[2];
  }
  P.rotDone = k1;
}

export function setup(P) {
  P.T = 0;
  P.sc = 1;
  P.thr = 0;
  P.pmax = 1;
  P.lo = -1;
  P.hi = 1.6;
  P.k1 = 0;
  P.bx = new Float64Array(NB);
  P.by = new Float64Array(NB);
  P.bq = new Float64Array(NB);
  P.bh = new Float64Array(NB);
  P.wkx = new Float64Array(NW);
  P.wky = new Float64Array(NW);
  P.wph = new Float64Array(NW);
  P.wa = new Float64Array(NW);
  P.e = new Float64Array(6);
  // critical points: x, y, kind (0 pit, 1 saddle, 2 peak), height, fade, ridge direction x and y, visibility
  P.cx = new Float64Array(MAXPT);
  P.cy = new Float64Array(MAXPT);
  P.ck = new Int8Array(MAXPT);
  P.cf = new Float64Array(MAXPT);
  P.cs = new Float64Array(MAXPT);
  P.cdx = new Float64Array(MAXPT);
  P.cdy = new Float64Array(MAXPT);
  P.cv = new Float64Array(MAXPT);
  P.ca = new Float64Array(MAXPT);
  P.cn = new Int8Array(MAXPT);
  P.pa = new Float64Array(MAXPT);
  P.pk = new Int8Array(MAXPT);
  P.nc = 0;
  P.px = new Float64Array(MAXPT);
  P.py = new Float64Array(MAXPT);
  P.np = 0;
  // separatrices
  P.ln = [];
  for (let i = 0; i < MAXLN; i++) P.ln.push({ pts: new Float32Array(LNLEN * 2), n: 0, up: 1, from: 0, to: -1, p: 0, str: 0, len: 0 });
  P.nl = 0;
  P.gx = new Float64Array(GX * GY);
  P.gy = new Float64Array(GX * GY);
  P.F = new Float32Array(W * H);
  P.cas = new Float32Array(W * H);
  P.core = new Float32Array(W * H * 2);
  P.glow = new Float32Array(W * H * 2);
  P.par = new Float32Array(W * H * 2);
  P.coreS = new Float32Array(W * H * 2);
  P.glowS = new Float32Array(W * H * 2);
  P.parS = new Float32Array(W * H * 2);
  P.casS = new Float32Array(W * H);
  P.lut = new Float32Array(256 * 3);
  P.sk = new Float32Array(21);
  P.ex = new Float32Array(NB * W);
  P.ey = new Float32Array(NB * H);
  P.wcx = new Float32Array(NW * W * 2);
  P.wcy = new Float32Array(NW * H * 2);
  P.rotDone = -1;
  P.buf = new Float32Array(W * H * 3);
  P.tick = 0;
}

// ---- the landscape f(x, y, t) and its gradient and Hessian, into P.e
function placeField(P) {
  const T = P.T;
  for (let i = 0; i < NB; i++) {
    const b = BL[i];
    const ph = i * 2.399963;
    P.bx[i] = b[0] + b[4] * sin(b[8] * T + ph) + b[6] * sin(b[10] * T + 2.1 * ph + 1);
    P.by[i] = b[1] + b[5] * sin(b[9] * T + 1.7 * ph + 2) + b[7] * sin(b[11] * T + 0.6 * ph + 4);
    const s = b[3] * P.sc * (1 + 0.14 * sin(0.0331 * (1 + 0.21 * i) * T + ph));
    P.bq[i] = 1 / (s * s);
    P.bh[i] = b[2] * (1 + 0.16 * sin(0.0277 * (1 + 0.17 * i) * T + 3 * ph));
  }
  const ws = pow(P.sc, 0.5);
  for (let j = 0; j < NW; j++) {
    const w = WV[j];
    const k = TAU / (w[1] * ws);
    const a = w[2] + w[3] * P.T;
    P.wkx[j] = k * cos(a);
    P.wky[j] = k * sin(a);
    P.wph[j] = w[4] * P.T + 1.3 * j;
    P.wa[j] = w[0];
  }
}

function field(P, x, y) {
  const e = P.e;
  let f = 0;
  let fx = 0;
  let fy = 0;
  let fxx = 0;
  let fxy = 0;
  let fyy = 0;
  for (let i = 0; i < NB; i++) {
    const dx = x - P.bx[i];
    const dy = y - P.by[i];
    const q = P.bq[i];
    const r = 0.5 * q * (dx * dx + dy * dy);
    if (r > 30) continue;
    const g = P.bh[i] * exp(-r);
    f += g;
    const gq = g * q;
    fx -= gq * dx;
    fy -= gq * dy;
    fxx += gq * (q * dx * dx - 1);
    fxy += gq * q * dx * dy;
    fyy += gq * (q * dy * dy - 1);
  }
  for (let j = 0; j < NW; j++) {
    const kx = P.wkx[j];
    const ky = P.wky[j];
    const ph = kx * x + ky * y + P.wph[j];
    const c = cos(ph) * P.wa[j];
    const s = sin(ph) * P.wa[j];
    f += c;
    fx -= s * kx;
    fy -= s * ky;
    fxx -= c * kx * kx;
    fxy -= c * kx * ky;
    fyy -= c * ky * ky;
  }
  e[0] = f;
  e[1] = fx;
  e[2] = fy;
  e[3] = fxx;
  e[4] = fxy;
  e[5] = fyy;
}

// ---- Newton's method on grad f = 0, from (x, y); the point it reaches is left in P.nx, P.ny
function newton(P, x, y, reach) {
  const e = P.e;
  const sx = x;
  const sy = y;
  for (let it = 0; it < 18; it++) {
    field(P, x, y);
    const det = e[3] * e[5] - e[4] * e[4];
    if (abs(det) < 1e-12) return false;
    let dx = -(e[5] * e[1] - e[4] * e[2]) / det;
    let dy = -(-e[4] * e[1] + e[3] * e[2]) / det;
    const len = sqrt(dx * dx + dy * dy);
    if (len > 2.2) {
      dx *= 2.2 / len;
      dy *= 2.2 / len;
    }
    x += dx;
    y += dy;
    if (x < X0 - 4 || x > X1 + 4 || y < Y0 - 4 || y > Y1 + 4) return false;
    if (len < 3e-4) {
      field(P, x, y);
      if (abs(e[1]) + abs(e[2]) > 2e-5) return false;
      if ((x - sx) * (x - sx) + (y - sy) * (y - sy) > reach * reach) return false;
      P.nx = x;
      P.ny = y;
      return true;
    }
  }
  return false;
}

// add the critical point at P.nx, P.ny unless one is already there
function addCrit(P, age, kindWas) {
  const x = P.nx;
  const y = P.ny;
  if (x < X0 || x > X1 || y < Y0 || y > Y1) return;
  const n = P.nc;
  for (let i = 0; i < n; i++) {
    const dx = P.cx[i] - x;
    const dy = P.cy[i] - y;
    if (dx * dx + dy * dy < 0.0036) return;
  }
  if (n >= MAXPT) return;
  const e = P.e;
  field(P, x, y);
  const det = e[3] * e[5] - e[4] * e[4];
  P.cx[n] = x;
  P.cy[n] = y;
  P.cf[n] = e[0];
  P.ck[n] = det < 0 ? 1 : e[3] + e[5] < 0 ? 2 : 0;
  P.ca[n] = P.ck[n] === kindWas ? age : 0;
  if (det < 0) {
    // the ridge runs along the eigenvector of the positive eigenvalue
    const th = 0.5 * atan2(2 * e[4], e[3] - e[5]);
    P.cdx[n] = cos(th);
    P.cdy[n] = sin(th);
  }
  P.nc = n + 1;
}

function findCritical(P) {
  P.nc = 0;
  for (let i = 0; i < P.np; i++) if (newton(P, P.px[i], P.py[i], 3)) addCrit(P, P.pa[i] + P.dt, P.pk[i]);
  // seeds: cells of a coarse grid where both partial derivatives change sign
  const gx = P.gx;
  const gy = P.gy;
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      field(P, X0 + i * GS, Y0 + j * GS);
      gx[j * GX + i] = P.e[1];
      gy[j * GX + i] = P.e[2];
    }
  for (let j = 0; j < GY - 1; j++)
    for (let i = 0; i < GX - 1; i++) {
      const a = j * GX + i;
      const b = a + 1;
      const c = a + GX;
      const d = c + 1;
      const sx = (gx[a] > 0) + (gx[b] > 0) + (gx[c] > 0) + (gx[d] > 0);
      if (sx === 0 || sx === 4) continue;
      const sy = (gy[a] > 0) + (gy[b] > 0) + (gy[c] > 0) + (gy[d] > 0);
      if (sy === 0 || sy === 4) continue;
      if (newton(P, X0 + (i + 0.5) * GS, Y0 + (j + 0.5) * GS, 2.5 * GS)) addCrit(P, 0, -1);
    }
  for (let i = 0; i < P.nc; i++) {
    P.px[i] = P.cx[i];
    P.py[i] = P.cy[i];
    P.pa[i] = P.ca[i];
    P.pk[i] = P.ck[i];
  }
  P.np = P.nc;
}

// ---- separatrices: from each saddle, along +/- the gradient, by RK2 steps of 1 LED
function trace(P, s, dirx, diry, up) {
  if (P.nl >= MAXLN) return;
  const ln = P.ln[P.nl++];
  const pts = ln.pts;
  const e = P.e;
  let x = P.cx[s] + dirx * 0.7;
  let y = P.cy[s] + diry * 0.7;
  let n = 0;
  pts[0] = P.cx[s];
  pts[1] = P.cy[s];
  n = 1;
  ln.up = up;
  ln.from = s;
  ln.to = -1;
  const want = up > 0 ? 2 : 0;
  for (let k = 0; k < LNLEN - 2; k++) {
    pts[n * 2] = x;
    pts[n * 2 + 1] = y;
    n++;
    field(P, x, y);
    const g = sqrt(e[1] * e[1] + e[2] * e[2]);
    if (g < 1e-7) break;
    const mx = x + 0.5 * up * (e[1] / g);
    const my = y + 0.5 * up * (e[2] / g);
    field(P, mx, my);
    const g2 = sqrt(e[1] * e[1] + e[2] * e[2]);
    if (g2 < 1e-7) break;
    x += up * (e[1] / g2);
    y += up * (e[2] / g2);
    if (x < X0 - 2 || x > X1 + 2 || y < Y0 - 2 || y > Y1 + 2) {
      pts[n * 2] = x;
      pts[n * 2 + 1] = y;
      n++;
      break;
    }
    let hit = -1;
    let best = 1.7 * 1.7;
    for (let c = 0; c < P.nc; c++) {
      if (P.ck[c] !== want) continue;
      const dx = P.cx[c] - x;
      const dy = P.cy[c] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        hit = c;
      }
    }
    if (hit >= 0) {
      pts[n * 2] = P.cx[hit];
      pts[n * 2 + 1] = P.cy[hit];
      n++;
      ln.to = hit;
      break;
    }
  }
  ln.n = n;
  let len = 0;
  for (let k = 1; k < n; k++) len += sqrt((pts[k * 2] - pts[k * 2 - 2]) ** 2 + (pts[k * 2 + 1] - pts[k * 2 - 1]) ** 2);
  ln.len = len;
  // how high the line stands over its saddle, to the extremum or to where it was left
  const endF = ln.to >= 0 ? P.cf[ln.to] : (field(P, pts[n * 2 - 2], pts[n * 2 - 1]), e[0]);
  ln.p = abs(endF - P.cf[s]);
}

function separatrices(P) {
  P.nl = 0;
  for (let s = 0; s < P.nc; s++) {
    if (P.ck[s] !== 1) continue;
    const ux = P.cdx[s];
    const uy = P.cdy[s];
    trace(P, s, ux, uy, 1);
    trace(P, s, -ux, -uy, 1);
    trace(P, s, -uy, ux, -1);
    trace(P, s, uy, -ux, -1);
  }
}

// how a line and its end points show: by its height over the saddle against the threshold, and by how long it is.
// A saddle that is about to cancel with a peak (or a pit), or has just been born beside one, brings its lines to
// the other kind in and out with the gap between them, because only those lines come and go. Its lines of the
// same kind run on into the line that reaches the partner, so they stay.
function judge(P, dt) {
  let pm = 0;
  for (let i = 0; i < P.nl; i++) if (P.ln[i].p > pm) pm = P.ln[i].p;
  if (pm > 0) P.pmax += (pm - P.pmax) * (1 - exp(-dt / 2.5));
  const fw = 0.02 * P.pmax + 0.003;
  for (let c = 0; c < P.nc; c++) {
    let near = 1e9;
    let nk = -1;
    for (let o = 0; o < P.nc; o++) {
      if ((P.ck[o] === 1) === (P.ck[c] === 1)) continue;
      const dx = P.cx[o] - P.cx[c];
      const dy = P.cy[o] - P.cy[c];
      const d2 = dx * dx + dy * dy;
      if (d2 < near) {
        near = d2;
        nk = P.ck[o];
      }
    }
    P.cn[c] = nk;
    P.cs[c] = sm(0.5, 4.5, sqrt(near)) * sm(0, 0.7, P.ca[c]);
    P.cv[c] = -1;
  }
  for (let i = 0; i < P.nl; i++) {
    const ln = P.ln[i];
    const born = (ln.up > 0 ? 2 : 0) === P.cn[ln.from] ? 1 : P.cs[ln.from];
    ln.str = sm(P.thr, P.thr + fw, ln.p) * sm(0.6, 3.5, ln.len) * born;
    if (ln.str > P.cv[ln.from]) P.cv[ln.from] = ln.str;
    if (ln.to >= 0 && ln.str > P.cv[ln.to]) P.cv[ln.to] = ln.str;
  }
  for (let c = 0; c < P.nc; c++) if (P.cv[c] < 0) P.cv[c] = P.cs[c];
}

export function update(dt, input, P) {
  if (!P.bx) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = min(max(dt || 0, 0), 0.1);
  P.k1 = k[0];
  const speed = cl(k[1], 0.6, 3) / 2;
  const k3 = cl(k[2], -1, 1);
  const k4 = (cl(k[3], -1, 1) + 1) / 2;
  const first = P.tick === 0;
  if (first) {
    P.T = 30;
    P.sc = exp(0.45 * k3);
  }
  P.tick++;
  P.dt = d;
  P.T += d * speed;
  P.sc += (exp(0.45 * k3) - P.sc) * (1 - exp(-d / 0.35));
  placeField(P);
  findCritical(P);
  separatrices(P);
  const thrT = P.pmax * (0.03 + 0.7 * k4 * k4);
  if (first) P.thr = thrT;
  else P.thr += (thrT - P.thr) * (1 - exp(-d / 0.12));
  if (first) {
    P.pmax = 0.01;
    for (let i = 0; i < P.nl; i++) if (P.ln[i].p > P.pmax) P.pmax = P.ln[i].p;
    P.thr = P.pmax * (0.03 + 0.7 * k4 * k4);
    for (let c = 0; c < P.nc; c++) P.ca[c] = P.pa[c] = 9;
  }
  judge(P, d);
}

// ---- drawing
function mixIn(buf, p, r, g, b, a) {
  buf[p] += (r - buf[p]) * a;
  buf[p + 1] += (g - buf[p + 1]) * a;
  buf[p + 2] += (b - buf[p + 2]) * a;
}

function stamp(P, ln, hw, kind) {
  const pts = ln.pts;
  const n = ln.n;
  const core = P.core;
  const glow = P.glow;
  const par = P.par;
  const cas = P.cas;
  const R = 5.6;
  const str = ln.str;
  if (str < 0.01) return;
  const w0 = hw * (0.55 + 0.45 * str);
  for (let k = 0; k < n - 1; k++) {
    const ax = pts[k * 2];
    const ay = pts[k * 2 + 1];
    const bx = pts[k * 2 + 2];
    const by = pts[k * 2 + 3];
    const x0 = max(0, floor(min(ax, bx) - R));
    const x1 = min(W - 1, ceil(max(ax, bx) + R));
    const y0 = max(0, floor(min(ay, by) - R));
    const y1 = min(H - 1, ceil(max(ay, by) + R));
    if (x0 > x1 || y0 > y1) continue;
    const vx = bx - ax;
    const vy = by - ay;
    const l2 = vx * vx + vy * vy || 1e-6;
    const t0 = k / (n - 1);
    const t1 = (k + 1) / (n - 1);
    // thinner where it runs into a peak or a pit, so the marker stands out
    const w = ln.to >= 0 ? w0 * (0.72 + 0.28 * sm(0, 7, (1 - 0.5 * (t0 + t1)) * ln.len)) : w0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const t = cl((px * vx + py * vy) / l2, 0, 1);
        const dx = px - t * vx;
        const dy = py - t * vy;
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const dd = sqrt(d2);
        const p = y * W + x;
        const c = cl(w + 0.5 - dd, 0, 1) * str;
        const g = exp(-d2 / 13) * 0.5 * str;
        const ca = sm(3.6, 1.0, dd) * 0.45 * str * str * str;
        if (ca > cas[p]) cas[p] = ca;
        const o = p * 2 + kind;
        if (g > glow[o]) glow[o] = g;
        if (c > core[o]) {
          core[o] = c;
          par[o] = t0 + (t1 - t0) * t;
        }
      }
    }
  }
}


export function draw(display, P) {
  if (!P.bx || P.tick === 0) return;
  if (abs(P.rotDone - P.k1) > 0.002) buildColours(P, P.k1);
  const lut = P.lut;
  const sk = P.sk;
  const F = P.F;
  // the landscape on the LEDs, with the separable parts worked out once
  for (let i = 0; i < NB; i++) {
    const q = P.bq[i];
    for (let x = 0; x < W; x++) {
      const d = x + 0.5 - P.bx[i];
      P.ex[i * W + x] = exp(-0.5 * q * d * d);
    }
    for (let y = 0; y < H; y++) {
      const d = y + 0.5 - P.by[i];
      P.ey[i * H + y] = exp(-0.5 * q * d * d);
    }
  }
  for (let j = 0; j < NW; j++) {
    for (let x = 0; x < W; x++) {
      const a = P.wkx[j] * (x + 0.5) + P.wph[j];
      P.wcx[(j * W + x) * 2] = cos(a) * P.wa[j];
      P.wcx[(j * W + x) * 2 + 1] = sin(a) * P.wa[j];
    }
    for (let y = 0; y < H; y++) {
      const a = P.wky[j] * (y + 0.5);
      P.wcy[(j * H + y) * 2] = cos(a);
      P.wcy[(j * H + y) * 2 + 1] = sin(a);
    }
  }
  let lo = 1e9;
  let hi = -1e9;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let f = 0;
      for (let i = 0; i < NB; i++) f += P.bh[i] * P.ex[i * W + x] * P.ey[i * H + y];
      for (let j = 0; j < NW; j++) f += P.wcx[(j * W + x) * 2] * P.wcy[(j * H + y) * 2] - P.wcx[(j * W + x) * 2 + 1] * P.wcy[(j * H + y) * 2 + 1];
      F[y * W + x] = f;
      if (f < lo) lo = f;
      if (f > hi) hi = f;
    }
  const e = P.seen ? 1 - exp(-1 / 30 / 3) : 1;
  P.seen = true;
  P.lo += (lo - P.lo) * e;
  P.hi += (hi - P.hi) * e;
  const inv = 1 / max(0.5, P.hi - P.lo);
  P.core.fill(0);
  P.glow.fill(0);
  P.par.fill(0);
  P.cas.fill(0);
  for (let i = 0; i < P.nl; i++) {
    const ln = P.ln[i];
    stamp(P, ln, ln.up > 0 ? 1.15 : 0.95, ln.up > 0 ? 0 : 1);
  }
  // the lines are kept a moment, so a line that comes or goes in one frame fades over a third of a second
  const ka = P.seen2 ? 1 - exp(-P.dt / 0.11) : 1;
  P.seen2 = true;
  const core = P.coreS;
  const glow = P.glowS;
  const par = P.parS;
  const cas = P.casS;
  for (let i = 0; i < W * H * 2; i++) {
    core[i] += (P.core[i] - core[i]) * ka;
    glow[i] += (P.glow[i] - glow[i]) * ka;
    if (P.core[i] > 0.05) par[i] = P.par[i];
  }
  for (let i = 0; i < W * H; i++) cas[i] += (P.cas[i] - cas[i]) * ka;
  const buf = P.buf;
  for (let p = 0; p < W * H; p++) {
    const u = cl((F[p] - P.lo) * inv, 0, 1);
    const li = floor(u * 255) * 3;
    let r = lut[li];
    let g = lut[li + 1];
    let b = lut[li + 2];
    const dk = 1 - cas[p];
    r *= dk;
    g *= dk;
    b *= dk;
    // valley (kind 1), then ridge (kind 0)
    for (let kind = 1; kind >= 0; kind--) {
      const o = p * 2 + kind;
      const gl = glow[o];
      const co = core[o];
      if (gl <= 0 && co <= 0) continue;
      const t = par[o];
      const a0 = kind === 0 ? 0 : 6;
      const b0 = kind === 0 ? 3 : 9;
      const cr = sk[a0] + (sk[b0] - sk[a0]) * t;
      const cg = sk[a0 + 1] + (sk[b0 + 1] - sk[a0 + 1]) * t;
      const cb = sk[a0 + 2] + (sk[b0 + 2] - sk[a0 + 2]) * t;
      const ga = gl * 0.6;
      r += (cr - r) * ga;
      g += (cg - g) * ga;
      b += (cb - b) * ga;
      r += (cr - r) * co;
      g += (cg - g) * co;
      b += (cb - b) * co;
    }
    buf[p * 3] = r;
    buf[p * 3 + 1] = g;
    buf[p * 3 + 2] = b;
  }
  // the critical points on top, each cut out of what is under it by a dark rim
  for (let c = 0; c < P.nc; c++) {
    const vis = P.cv[c];
    const sz = P.cs[c] * (0.5 + 0.5 * vis);
    if (vis < 0.02 || sz < 0.04) continue;
    const kind = P.ck[c];
    const cx = P.cx[c];
    const cy = P.cy[c];
    const x0 = max(0, floor(cx - 8));
    const x1 = min(W - 1, ceil(cx + 8));
    const y0 = max(0, floor(cy - 8));
    const y1 = min(H - 1, ceil(cy + 8));
    const ux = P.cdx[c];
    const uy = P.cdy[c];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - cx;
        const py = y + 0.5 - cy;
        const d = sqrt(px * px + py * py);
        const p = (y * W + x) * 3;
        // e: how far outside the marker's edge this LED is
        let e;
        if (kind === 2) e = d - PKR * sz;
        else if (kind === 0) e = d - 2.7 * sz;
        else {
          const u = px * ux + py * uy;
          const v = -px * uy + py * ux;
          const A = PKA * sz;
          const B = PKB * sz;
          e = (abs(u) * B + abs(v) * A - A * B) / sqrt(A * A + B * B);
        }
        const rim = 0.6 * sm(2.2, 0.5, e) * min(1, sz * 1.5);
        buf[p] *= 1 - rim;
        buf[p + 1] *= 1 - rim;
        buf[p + 2] *= 1 - rim;
        const a = cl(0.5 - e, 0, 1);
        if (kind === 2) {
          const w = 0.5 * cl(1 - d / (PKR * sz), 0, 1);
          const h = exp(-(d * d) / 18) * 0.5 * sz * (1 - a);
          mixIn(buf, p, sk[12], sk[13], sk[14], h);
          mixIn(buf, p, sk[12] + (255 - sk[12]) * w, sk[13] + (255 - sk[13]) * w, sk[14] + (255 - sk[14]) * w, a);
        } else if (kind === 0) {
          const inn = cl(1.2 * sz + 0.5 - d, 0, 1);
          mixIn(buf, p, sk[15], sk[16], sk[17], a * (1 - inn));
          mixIn(buf, p, sk[18], sk[19], sk[20], inn * 0.85);
        } else mixIn(buf, p, 255, 255, 255, a);
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, min(255, max(0, buf[p])) | 0, min(255, max(0, buf[p + 1])) | 0, min(255, max(0, buf[p + 2])) | 0);
    }
}
