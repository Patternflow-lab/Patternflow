// ===== Patternflow pattern =====
// Title:   Penrose Tribar
// Family:  space
// Idea:    The impossible triangle built for real as three square beams along x, y and z, each end cut flat by a plane that holds the view along the cube diagonal, so that from that one direction the three beams close into a triangle with no end showing, and as the camera swings round the vertical axis the beams slide apart in depth, while a small plan from above shows the three beams as they stand and the camera on its ring.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Penrose tribar (Lionel and Roger Penrose, 1958; Oscar Reutersvard drew a version in 1934; years from memory), built here as three mitred beams in a threefold pinwheel and drawn as flat faces with the painter's algorithm; pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Swing=0.5..4, Beam=7..12, Hold=0..1
//
// Knob 1: Hue. Turns the faces round the wheel together. At 0 the faces that look up-left, down-left and right at the closing angle are cyan, azure and magenta, the three beams seen from above are cyan, azure and magenta, and the cut ends, which show once the view has left the diagonal, are pale. Orange and yellow are made paler so they do not dim to brown.
// Knob 2: Swing. How fast the camera swings round the vertical axis. One round trip, 80 degrees out to one side, back through the closing angle, 80 to the other side and back, takes 40 s over the knob: 20 s at 2, 80 s at 0.5, 10 s at 4. The triangle closes twice in each trip.
// Knob 3: Beam. How wide a beam looks from the diagonal, in LEDs across its strip, from 7 to 12. The triangle stays 46.5 LEDs along a side, so a fatter beam eats the hole: the inner triangle is 22 LEDs a side at 7 and 5 at 12. The beams get fatter in 3D too, from 0.35 to 0.81 of the gap between them.
// Knob 4: Hold. How long the camera lingers near the closing angle. The angle is 80 degrees times |sin|^p with the sign of the sin, p = 2 at 0 and 5 at 1. At the opening swing the ends of the beams stay within 1 LED of each other for 1.2 s a pass at 0, 1.4 s at 0.06 where it opens, and 3.4 s at 1. The ends of the swing linger a little too.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sin, cos, sqrt, pow, PI, asin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow are paler and a little lighter.
function tint(h, s, v, out) {
  const f = fr(h);
  if (f > 0.02 && f < 0.2) {
    s *= 0.6;
    v = min(1, v * 1.2);
  }
  hsv(h, s, v, out);
}

// ---- The figure, in its own coordinates (x, y, z) ------------------------
// Beam X runs along x with its square section at y in -1/2 -+ w/2 and z in
// +1/2 -+ w/2 (the gap g between the beams is 1), and it ends in two flat
// cuts. The cut at its far end is the plane x + y - 2z = 0 and the cut at its
// near end is z + x - 2y = 0. Each plane holds the direction (1, 1, 1), so
// seen along the cube diagonal it is a line and the end it cuts is edge on.
// Beam Y is beam X turned a third of a turn about the diagonal, (x, y, z)
// -> (z, x, y), and beam Z a third more. The far end of X and the near end of
// Y lie in the one plane, the same corner of each square section differing by
// (y - z)(1, 1, 1): they are a gap apart along the viewing direction and the
// same point on the screen. The three gaps are the same, the length of a beam
// is three of them, and that is why the ring can close.
const DIAG = 1 / sqrt(3);
const RM = [-1 / sqrt(2), 1 / sqrt(2), 0]; // right, up and toward-the-viewer of the closing view, in figure coordinates
const UM = [-1 / sqrt(6), -1 / sqrt(6), 2 / sqrt(6)];
const DM = [DIAG, DIAG, DIAG];

// Vertex index = a * 4 + b * 2 + e: a picks the low or high y of the section,
// b the low or high z, e the near (0) or far (1) cut.
function figure(w) {
  const X = [];
  for (let a = 0; a < 2; a++)
    for (let b = 0; b < 2; b++)
      for (let e = 0; e < 2; e++) {
        const y = -0.5 + (a - 0.5) * w, z = 0.5 + (b - 0.5) * w;
        X.push([e ? 2 * z - y : 2 * y - z, y, z]);
      }
  const R = (p) => [p[2], p[0], p[1]];
  return [X, X.map(R), X.map((p) => R(R(p)))];
}

// The six faces of a beam as vertex indices, the four long faces first.
const FACES = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
// Which figure axis the normal of the long faces a = 0/1 and b = 0/1 follows, for beams X, Y, Z.
const AXA = [1, 2, 0], AXB = [2, 0, 1];

// ---- The view --------------------------------------------------------------
const ELEV = asin(DIAG); // the camera's height: 35.26 degrees, the cube diagonal's
const SE = sin(ELEV), CE = cos(ELEV);
const AMP = (80 * PI) / 180; // how far the camera swings to either side
const SIDE = 46.5; // LEDs along an outer side of the triangle: the beam tips swing out to 31.4 LEDs from the middle and stay on the panel
const SPAN = SIDE / (2 * sqrt(3)) / (1 / sqrt(2));
const CX = 32, CY = 40; // where the figure's centre sits
const PX = 32, PY = 98, RR = 27, PLAN = 0.62; // the view from above: its centre, the camera's ring and its scale to the main one
// The three hues and the three tones of the faces that look up-left, down-left and right at the closing view.
const HUE = [0, 0.15, 0.34], TONE = [1, 0.62, 0.82];
const R2 = sqrt(2);

// Figure coordinates to the world: the closing camera looks along (CE, 0, SE)
// from the +x side, the figure is turned a quarter turn about that view so the
// triangle stands on its base.
const N0 = [CE, 0, SE], RI0 = [0, 1, 0], UP0 = [-SE, 0, CE];
function toWorld(p) {
  const a = RM[0] * p[0] + RM[1] * p[1] + RM[2] * p[2];
  const b = UM[0] * p[0] + UM[1] * p[1] + UM[2] * p[2];
  const d = DM[0] * p[0] + DM[1] * p[1] + DM[2] * p[2];
  return [b * RI0[0] - a * UP0[0] + d * N0[0], b * RI0[1] - a * UP0[1] + d * N0[1], b * RI0[2] - a * UP0[2] + d * N0[2]];
}

// The light, in the closing camera's frame: from the upper left and in front.
const LIGHT = (() => {
  const l = [-0.5 * RI0[0] + 0.62 * UP0[0] + 0.6 * N0[0], -0.5 * RI0[1] + 0.62 * UP0[1] + 0.6 * N0[1], -0.5 * RI0[2] + 0.62 * UP0[2] + 0.6 * N0[2]];
  const m = sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]);
  return [l[0] / m, l[1] / m, l[2] / m];
})();

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, beam: 7, hold: 0.06,
    ph: 0, theta: 0, built: -1,
    P: null, // beams, faces and the figure's vertices in the world
    scale: 15, w: 0.32,
    proj: new Float64Array(24 * 3), // the last frame's screen x, y and depth, for checks
    ids: new Int8Array(W * H), // which face each LED of the main view shows, for checks
    ids2: new Int8Array(W * H), // and of the view from above
    buf: new Float32Array(W * H * 3),
  };
}

function build(S) {
  const b = S.beam;
  S.scale = SPAN - b / R2; // LEDs to the unit gap
  S.w = b / (R2 * S.scale);
  const fig = figure(S.w);
  S.P = fig.map((bar) => bar.map(toWorld));
  S.built = b;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 7, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.beam = cl(k[2], 7, 12);
  S.hold = cl(k[3], 0, 1);
  if (S.built !== S.beam) build(S);
  S.ph += (d * S.speed) / 40;
  const sn = sin(2 * PI * S.ph);
  S.theta = AMP * (sn < 0 ? -1 : 1) * pow(abs(sn), 2 + 3 * S.hold);
}

function fillPoly(buf, xs, ys, n, c, ids, id) {
  let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    if (ys[i] < y0) y0 = ys[i];
    if (ys[i] > y1) y1 = ys[i];
  }
  for (let y = max(0, ceil(y0 - 0.5)); y <= min(H - 1, ceil(y1 - 0.5) - 1); y++) {
    const yc = y + 0.5;
    let xl = 1e9, xr = -1e9;
    for (let i = 0; i < n; i++) {
      const j = i + 1 === n ? 0 : i + 1, ya = ys[i], yb = ys[j];
      if ((ya <= yc && yc < yb) || (yb <= yc && yc < ya)) {
        const x = xs[i] + ((yc - ya) * (xs[j] - xs[i])) / (yb - ya);
        if (x < xl) xl = x;
        if (x > xr) xr = x;
      }
    }
    for (let x = max(0, ceil(xl - 0.5)); x <= min(W - 1, ceil(xr - 0.5) - 1); x++) {
      const o = (y * W + x) * 3;
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      if (ids) ids[y * W + x] = id;
    }
  }
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The figure seen along nv, with rv to the right and uv up on the screen, as
// flat faces drawn far to near. The figure's origin lands on (cx, cy), sc LEDs
// to the unit gap. Returns the screen x, y and depth of the 24 vertices in
// S.proj when keep is set.
function scene(S, nv, rv, uv, cx, cy, sc, keep, byBeam, ids) {
  const buf = S.buf;
  const SX = [], SY = [], SD = [];
  for (let k = 0; k < 3; k++) {
    SX.push([]);
    SY.push([]);
    SD.push([]);
    for (let i = 0; i < 8; i++) {
      const p = S.P[k][i];
      const x = cx + sc * dot(p, rv), y = cy - sc * dot(p, uv), dp = sc * dot(p, nv);
      SX[k].push(x);
      SY[k].push(y);
      SD[k].push(dp);
      if (keep) {
        S.proj[(k * 8 + i) * 3] = x;
        S.proj[(k * 8 + i) * 3 + 1] = y;
        S.proj[(k * 8 + i) * 3 + 2] = dp;
      }
    }
  }
  const faces = [];
  for (let k = 0; k < 3; k++) {
    const P = S.P[k];
    const cen = [0, 0, 0];
    for (let i = 0; i < 8; i++) for (let c = 0; c < 3; c++) cen[c] += P[i][c] / 8;
    for (let f = 0; f < 6; f++) {
      const ix = FACES[f], p0 = P[ix[0]], p1 = P[ix[1]], p2 = P[ix[2]];
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      let nm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const ln = sqrt(dot(nm, nm)) || 1;
      nm = [nm[0] / ln, nm[1] / ln, nm[2] / ln];
      const fc = [0, 0, 0];
      for (const i of ix) for (let c = 0; c < 3; c++) fc[c] += P[i][c] / 4;
      if (dot(nm, [fc[0] - cen[0], fc[1] - cen[1], fc[2] - cen[2]]) < 0) nm = [-nm[0], -nm[1], -nm[2]];
      if (dot(nm, nv) <= 1e-9) continue; // turned away
      let dep = 0;
      for (const i of ix) dep += SD[k][i] / 4;
      faces.push({ k, f, nm, dep });
    }
  }
  // The painter's algorithm: the far faces first.
  faces.sort((a, b) => a.dep - b.dep);

  const hb = 0.5 + S.hue;
  const c = [0, 0, 0], xs = [0, 0, 0, 0], ys = [0, 0, 0, 0];
  for (const fc of faces) {
    if (fc.f < 4) {
      const ax = fc.f < 2 ? AXA[fc.k] : AXB[fc.k], up = fc.f & 1;
      tint(hb + (byBeam ? HUE[fc.k] : HUE[ax]), 0.9, TONE[ax] * (up ? 1 : 0.55), c);
    } else tint(hb + 0.05, 0.16, 0.3 + 0.7 * max(0, dot(fc.nm, LIGHT)), c); // a cut end: pale
    const ix = FACES[fc.f];
    for (let q = 0; q < 4; q++) {
      xs[q] = SX[fc.k][ix[q]];
      ys[q] = SY[fc.k][ix[q]];
    }
    fillPoly(buf, xs, ys, 4, c, ids, fc.k * 6 + fc.f);
  }
}

const put = (buf, x, y, c, a) => {
  x = floor(x + 0.5);
  y = floor(y + 0.5);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = max(buf[o], c[0] * a);
  buf[o + 1] = max(buf[o + 1], c[1] * a);
  buf[o + 2] = max(buf[o + 2], c[2] * a);
};

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const buf = S.buf;
  buf.fill(0);
  S.ids.fill(-1);
  S.ids2.fill(-1);

  // The figure as the camera sees it.
  const th = S.theta, ct = cos(th), st = sin(th);
  scene(S, [CE * ct, CE * st, SE], [-st, ct, 0], [-SE * ct, -SE * st, CE], CX, CY, S.scale, true, false, S.ids);

  // The same figure from straight above, small, with the camera on its ring.
  // The camera starts at the bottom of the ring, which is the closing angle.
  const sp = S.scale * PLAN;
  scene(S, [0, 0, 1], [0, 1, 0], [-1, 0, 0], PX, PY, sp, false, true, S.ids2);
  const white = [1, 1, 1], ring = [0.55, 0.62, 0.75];
  for (let a = -AMP - 0.12; a <= AMP + 0.12; a += 0.02) put(buf, PX + RR * sin(a), PY + RR * cos(a), ring, 0.3);
  const closed = abs(th) < 0.04;
  for (let r = RR - 3; r <= RR + 3; r++) put(buf, PX, PY + r, closed ? white : ring, closed ? 1 : 0.5);
  const dx = PX + RR * sin(th), dy = PY + RR * cos(th);
  for (let r = 0; r <= 1; r += 0.07) put(buf, dx + (PX - dx) * r * 0.2, dy + (PY - dy) * r * 0.2, white, 0.6);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) put(buf, dx + i, dy + j, white, 1);

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
