// ===== Patternflow pattern =====
// Title:   Subpixel
// Family:  type
// Idea:    Two letters stored as TrueType outlines drift by fractions of a pixel over a magnified pixel grid that is scan-converted again every frame, as red, green and blue subpixel stripes, as grey coverage or as one-bit pixels, so the raster jumps and its colour fringes shimmer while the thin outline glides on top.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: TrueType quadratic outlines and its pixel-centre rule for scan conversion (Apple, 1991), ClearType subpixel rendering (Microsoft, announced 1998), FreeType's default LCD filter and light hinting, pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Letters=0..2, Speed=0.2..3, Mode=0..3, Hint=0..2
//
// Knob 1: Letters. Which pair: a over g at 13.2 pixels to the em or R over & at 12.2, on pixels six LEDs square, or 한 over 글 at 19.5 on pixels three LEDs square.
// Knob 2: Speed. How fast the outlines drift and breathe: at 2 they travel half a pixel a second and swell and shrink by 5.5 percent over 15 seconds, at 0.2 ten times slower.
// Knob 3: Mode. How the grid is filled: 0 subpixel stripes, each pixel three LED columns red, green and blue, each lit by the coverage of its own third after FreeType's five-tap filter; 1 the same three values as the colour of the whole pixel, where the fringes show; 2 grey coverage; 3 one bit, a pixel lit when its centre is inside, TrueType's first rule.
// Knob 4: Hint. Snapping to the grid: 0 none; 1 the baseline, heights and horizontal strokes on pixel rows, as FreeType's light hinting does; 2 the vertical stems as well, each a whole number of pixels wide, so the hinted letter keeps its shape and moves only in whole-pixel jumps while the outline glides.
// Buttons: K2 tap holds the outlines still, tap again to let them drift.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sin, cos, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- Outlines. Units per em 1000, y up, baseline 0. A contour is a list of
// points [x, y, on]: on 1 lies on the curve, on 0 is a quadratic control
// point off it, and two off points in a row have an implied on point half
// way between them, which is how TrueType stores a glyph. As in TrueType,
// outer contours run clockwise and holes counter-clockwise, contours may
// overlap, and the fill rule is nonzero winding. Each contour carries its
// own stems for the hinter.

// "x,y" on the curve, "~x,y" off it.
const pts = (s) => s.trim().split(/\s+/).map((t) => {
  const off = t[0] === "~";
  const [x, y] = t.slice(off ? 1 : 0).split(",").map(Number);
  return [x, y, off ? 0 : 1];
});

function rect(x0, y0, x1, y1) {
  return { p: [[x0, y0, 1], [x0, y1, 1], [x1, y1, 1], [x1, y0, 1]], hx: [[x0, x1]], hy: [[y0, y1]] };
}

// An oval as eight off points and no on points at all: the implied on
// points between them fall on the ellipse at every 45 degrees, the extremes
// among them. A ring is the oval and a smaller one turned the other way.
function oval(cx, cy, rx, ry, hole) {
  const k = 1 / cos(PI / 8), p = [];
  for (let i = 0; i < 8; i++) {
    const a = PI / 8 - (i * PI) / 4;
    p.push([cx + rx * k * cos(a), cy + ry * k * sin(a), 0]);
  }
  return hole ? p.reverse() : p;
}
function ring(cx, cy, rx, ry, tx, ty) {
  const hx = [[cx - rx, cx - rx + tx], [cx + rx - tx, cx + rx]], hy = [[cy - ry, cy - ry + ty], [cy + ry - ty, cy + ry]];
  return [{ p: oval(cx, cy, rx, ry, false), hx, hy }, { p: oval(cx, cy, rx - tx, ry - ty, true), hx, hy }];
}

// A stroke: a centre line of on points with at most one control point
// between them, "x,y,w" giving the width from that point on. The outline is
// the line offset to the left going forward and to the right coming back,
// each control point moved to where the offset tangents meet, so the
// result is again quadratic. The ends are cut square.
function stroke(s, hx, hy) {
  const c = s.trim().split(/\s+/).map((t) => {
    const off = t[0] === "~";
    const v = t.slice(off ? 1 : 0).split(",").map(Number);
    return { x: v[0], y: v[1], on: !off, w: v[2] };
  });
  let w = 0;
  for (const q of c) if (q.on) (w = q.w || w), (q.w = w);
  const n = c.length;
  const dir = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  // Tangent at each point.
  const t = c.map((q, i) => {
    const a = i > 0 ? dir(c[i - 1], q) : null, b = i < n - 1 ? dir(q, c[i + 1]) : null;
    if (!a) return b;
    if (!b || !q.on) return a;
    const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  });
  const side = (sg) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const q = c[i];
      if (q.on) {
        const d = (sg * q.w) / 2;
        out.push([q.x + d * t[i][1], q.y - d * t[i][0], 1]);
        continue;
      }
      // Meet the offset tangent lines of the two on points either side.
      const A = c[i - 1], B = c[i + 1], ta = dir(A, q), tb = dir(q, B);
      const da = (sg * A.w) / 2, db = (sg * B.w) / 2;
      const ax = A.x + da * ta[1], ay = A.y - da * ta[0], bx = B.x + db * tb[1], by = B.y - db * tb[0];
      const den = ta[0] * tb[1] - ta[1] * tb[0];
      if (abs(den) < 1e-6) out.push([(ax + bx) / 2, (ay + by) / 2, 0]);
      else {
        const u = ((bx - ax) * tb[1] - (by - ay) * tb[0]) / den;
        out.push([ax + u * ta[0], ay + u * ta[1], 0]);
      }
    }
    return out;
  };
  return { p: [...side(-1), ...side(1).reverse()], hx: hx || [], hy: hy || [] };
}

const poly = (s, hx, hy) => ({ p: pts(s), hx: hx || [], hy: hy || [] });

const GLYPHS = {
  // Double-storey a: stem, arch with a cut terminal, and the bowl hung
  // from a shelf.
  a: () => [
    rect(416, 0, 512, 372),
    stroke("464,360,96 ~464,490 290,490,84 ~176,490 112,424,80", [[416, 512]], [[448, 532]]),
    stroke("470,259,82 300,259 ~95,259 95,145,94 ~95,31 235,31,86 ~385,31 462,124,90", [[48, 142], [416, 512]], [[-12, 74], [218, 300]]),
  ],
  // Double-storey g: a round upper bowl with an ear, a link and a lower loop.
  g: () => [
    ...ring(250, 352, 172, 180, 90, 80),
    rect(360, 468, 548, 532),
    stroke("178,204,76 ~112,132 180,98,72 ~226,64 330,64,74 ~500,64 500,-62,88 ~500,-194 275,-194,72 ~50,-194 50,-72,88 ~50,34 190,74,70", [[6, 94], [456, 544]], [[27, 101], [-230, -158]]),
  ],
  R: () => [
    rect(80, 0, 182, 700),
    stroke("130,655,90 330,655 ~484,655 484,491,98 ~484,327 330,327,90 130,327", [[80, 182], [435, 533]], [[610, 700], [282, 372]]),
    poly("440,0 288,330 404,330 558,0", [], [[0, 330]]),
  ],
  // Ampersand as one stroke: up the diagonal from the right foot, round the
  // small upper loop, down across itself into the bowl and up the arm.
  "&": () => [
    stroke("588,26,100 ~468,160 332,308,94 ~202,452 205,548,88 ~208,662 305,662,84 ~402,662 402,562,86 ~402,470 292,400,90 ~85,270 85,160,96 ~85,31 252,31,86 ~420,31 490,158,92 ~528,228 546,330,88", [[37, 133], [161, 249], [359, 445]], [[-12, 74], [620, 704]]),
  ],
  // Hangul in a 1000 square, gothic strokes 100 wide and 85 high.
  "한": () => [
    rect(245, 862, 405, 942), rect(80, 728, 570, 812), ...ring(325, 553, 178, 123, 92, 80),
    rect(650, 372, 750, 950), rect(750, 622, 885, 706),
    rect(150, 70, 250, 330), rect(150, 70, 882, 155),
  ],
  "글": () => [
    rect(130, 845, 835, 930), rect(742, 700, 835, 930),
    rect(45, 560, 955, 645),
    rect(150, 385, 850, 466), rect(762, 228, 852, 466), rect(150, 228, 852, 308),
    rect(150, 70, 240, 308), rect(150, 70, 870, 150),
  ],
};

// Alignment zones for the Latin letters: the flat height and the
// overshoot of round letters past it. Hinted, both land on one pixel line.
const ZONES = [[0, -12], [520, 532], [700, 712], [-220, -232]];

// A set: the glyphs, how many LEDs one pixel takes, and the size in pixels
// per em. Hangul packs three jamo into one square, so it gets twice the pixels.
const SETS = [
  { g: ["a", "g"], zoom: 6, ppem: 13.2, gap: 1.3, zones: true },
  { g: ["R", "&"], zoom: 6, ppem: 12.2, gap: 1.3, zones: true },
  { g: ["한", "글"], zoom: 3, ppem: 19.5, gap: 3.2, zones: false },
];

// Flatten a contour list to line segments at unit scale, for the bounds.
function bounds(contours) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const seg = new Float32Array(4096);
  const n = flatten(contours.map((c) => c.p.map((q) => [q[0], -q[1], q[2]])), seg, 0, 4);
  for (let i = 0; i < n * 4; i += 2) {
    x0 = min(x0, seg[i]), x1 = max(x1, seg[i]);
    y0 = min(y0, -seg[i + 1]), y1 = max(y1, -seg[i + 1]);
  }
  return { x0, y0, x1, y1 };
}

// Decode TrueType contours (already in pixels, y down) to quadratic pieces
// and cut each into straight segments fine enough at `fine` LEDs a pixel.
// Writes x0 y0 x1 y1 per segment from index n; returns the new count.
function flatten(cs, seg, n, fine) {
  const cap = seg.length >> 2;
  const line = (ax, ay, bx, by) => {
    if (n < cap) (seg[n * 4] = ax), (seg[n * 4 + 1] = ay), (seg[n * 4 + 2] = bx), (seg[n * 4 + 3] = by), n++;
  };
  const quad = (ax, ay, qx, qy, bx, by) => {
    const dev = (Math.hypot(ax - 2 * qx + bx, ay - 2 * qy + by) / 4) * fine;
    const k = cl(ceil(sqrt(dev / 0.08)), 1, 24);
    let px = ax, py = ay;
    for (let i = 1; i <= k; i++) {
      const u = i / k, v = 1 - u;
      const x = v * v * ax + 2 * u * v * qx + u * u * bx, y = v * v * ay + 2 * u * v * qy + u * u * by;
      line(px, py, x, y);
      (px = x), (py = y);
    }
  };
  for (const p of cs) {
    const m = p.length;
    let s = p.findIndex((q) => q[2]);
    let sx, sy;
    if (s < 0) (sx = (p[m - 1][0] + p[0][0]) / 2), (sy = (p[m - 1][1] + p[0][1]) / 2), (s = 0);
    else (sx = p[s][0]), (sy = p[s][1]), (s = s + 1);
    let cx = sx, cy = sy, ctl = null;
    for (let k = 0; k < m; k++) {
      const q = p[(s + k) % m];
      if (q[2]) {
        if (ctl) quad(cx, cy, ctl[0], ctl[1], q[0], q[1]);
        else line(cx, cy, q[0], q[1]);
        (cx = q[0]), (cy = q[1]), (ctl = null);
      } else if (ctl) {
        const mx = (ctl[0] + q[0]) / 2, my = (ctl[1] + q[1]) / 2;
        quad(cx, cy, ctl[0], ctl[1], mx, my);
        (cx = mx), (cy = my), (ctl = q);
      } else ctl = q;
    }
    if (ctl) quad(cx, cy, ctl[0], ctl[1], sx, sy);
    else line(cx, cy, sx, sy);
  }
  return n;
}

// ---- Hinting. Each stem's two edges go to whole pixel lines with the
// stem's width rounded, never under one pixel; an edge in an alignment zone
// goes to the zone's line, which takes the overshoot with it at these sizes.
// Every other point is moved in proportion between the edges either side of
// it, the way TrueType's IUP instruction moves the points no instruction
// touched, here per contour. `zones` are the zones the contour reaches.
const inZone = (z, u) => u >= min(z[0], z[1]) - 2 && u <= max(z[0], z[1]) + 2;
function edgeMap(stems, zones, f) {
  const out = [];
  const zoneOf = (u) => zones.find((z) => inZone(z, u)) || null;
  for (const [a, b] of stems) {
    const pa = f(a), pb = f(b), w = max(1, round(abs(pb - pa))), sg = pb > pa ? 1 : -1;
    const za = zoneOf(a), zb = zoneOf(b);
    let ha;
    if (za) ha = round(f(za[0]));
    else if (zb) ha = round(f(zb[0])) - sg * w;
    else ha = round((pa + pb) / 2 - (sg * w) / 2);
    out.push([a, ha], [b, ha + sg * w]);
  }
  for (const z of zones) out.push([z[0], round(f(z[0]))], [z[1], round(f(z[0]))]);
  out.sort((p, q) => p[0] - q[0]);
  // Keep the order: a later edge never crosses an earlier one.
  const dec = f(1) < f(0);
  for (let i = 1; i < out.length; i++) {
    if (dec ? out[i][1] > out[i - 1][1] : out[i][1] < out[i - 1][1]) out[i][1] = out[i - 1][1];
  }
  return out;
}
function mapEdge(E, f, u) {
  const n = E.length;
  if (!n) return f(u);
  if (u <= E[0][0]) return E[0][1] + f(u) - f(E[0][0]);
  if (u >= E[n - 1][0]) return E[n - 1][1] + f(u) - f(E[n - 1][0]);
  let i = 1;
  while (E[i][0] < u) i++;
  const [ua, ha] = E[i - 1], [ub, hb] = E[i];
  return ub > ua ? ha + ((u - ua) / (ub - ua)) * (hb - ha) : ha;
}

// The FreeType default LCD filter, in 256ths across five subpixels.
const FIR = [8, 77, 86, 77, 8].map((v) => v / 256);

export function setup(params) {
  const sets = SETS.map((s) => {
    const glyphs = s.g.map((ch) => {
      const contours = GLYPHS[ch]().flat();
      // A contour reaches a zone when one of its points or stem edges is in it.
      const reach = (c, z) => c.p.some((q) => inZone(z, q[1])) || c.hy.some((e) => inZone(z, e[0]) || inZone(z, e[1]));
      for (const c of contours) c.zones = s.zones ? ZONES.filter((z) => reach(c, z)) : [];
      return { contours, box: bounds(contours) };
    });
    // Stack the two glyphs with a gap and centre the stack on the grid.
    const GW = floor(W / s.zoom), GH = floor(H / s.zoom), sc = s.ppem / 1000;
    const hs = glyphs.map((g) => (g.box.y1 - g.box.y0) * sc);
    let y = (GH - hs[0] - hs[1] - s.gap) / 2;
    glyphs.forEach((g, i) => {
      g.cx = GW / 2;
      g.cy = y + hs[i] / 2;
      g.ux = (g.box.x0 + g.box.x1) / 2;
      g.uy = (g.box.y0 + g.box.y1) / 2;
      y += hs[i] + s.gap;
    });
    return { ...s, glyphs, GW, GH, X0: (W - GW * s.zoom) >> 1, Y0: (H - GH * s.zoom) >> 1 };
  });
  params.s = {
    sets, set: 0, mode: 0, hint: 0, T: 0, hold: false,
    seg: new Float32Array(4 * 6000), outl: new Float32Array(4 * 6000), nSeg: 0, nOut: 0,
    cx: new Float32Array(256 * MAXC), cd: new Int8Array(256 * MAXC), cnt: new Int32Array(256),
    bins: new Float32Array(43 * 64), bit: new Uint8Array(43 * 22), fir: new Float32Array(43 * 64),
    mask: new Uint8Array(W * H), line: new Float32Array(W * H), offs: new Float32Array(1024), nOff: 0,
  };
}

// Where glyph i of the set sits now: drift in pixels and a breathing scale.
function pose(S, set, i) {
  const T = S.T, ph = i * 2.1;
  const g = set.glyphs[i];
  const dx = 0.55 * sin(0.37 * T + ph) + 0.3 * sin(0.83 * T + 1.3 * ph);
  const dy = 0.45 * sin(0.29 * T + 0.7 + ph) + 0.25 * sin(0.71 * T + 2 * ph);
  const sc = (set.ppem / 1000) * (1 + 0.055 * sin(0.21 * T + 1.7 * ph));
  return { ox: g.cx + dx, oy: g.cy + dy, sc, g };
}

// Place one glyph's contours in grid pixels, y down, hinted on the axes
// asked. A hinted axis first puts the glyph's origin on a whole pixel, the
// baseline on a pixel row as text lines are set, so the hinted glyph keeps
// one shape wherever the outline drifts and moves only in whole pixels.
function place(S, set, i, hint) {
  const { ox, oy, sc, g } = pose(S, set, i);
  const fx = (u) => ox + (u - g.ux) * sc, fy = (v) => oy - (v - g.uy) * sc;
  return g.contours.map((c) => {
    if (!hint) return c.p.map((q) => [fx(q[0]), fy(q[1]), q[2]]);
    const y0 = fy(0), sy = (v) => fy(v) + round(y0) - y0;
    const Ey = edgeMap(c.hy, c.zones, sy);
    if (hint < 2) return c.p.map((q) => [fx(q[0]), mapEdge(Ey, sy, q[1]), q[2]]);
    const x0 = fx(0), sx = (u) => fx(u) + round(x0) - x0;
    const Ex = edgeMap(c.hx, [], sx);
    return c.p.map((q) => [mapEdge(Ex, sx, q[0]), mapEdge(Ey, sy, q[1]), q[2]]);
  });
}

// ---- Scan conversion. Horizontal sample lines k = 0..L-1 sit at
// y = (k + 0.5 - b) / a in the segments' units. On each, the crossings are
// sorted and walked under nonzero winding, and span(k, x0, x1) gets every
// run that is inside, exact in x.
const MAXC = 48;
function scan(S, seg, nseg, L, a, b, span) {
  const { cx, cd, cnt } = S;
  cnt.fill(0, 0, L);
  for (let s = 0; s < nseg; s++) {
    const x0 = seg[s * 4], y0 = seg[s * 4 + 1], x1 = seg[s * 4 + 2], y1 = seg[s * 4 + 3];
    if (y0 === y1) continue;
    const d = y1 > y0 ? 1 : -1, ya = min(y0, y1), yb = max(y0, y1);
    const k0 = max(0, ceil(a * ya + b - 0.5)), k1 = min(L - 1, ceil(a * yb + b - 0.5) - 1);
    for (let k = k0; k <= k1; k++) {
      if (cnt[k] >= MAXC) continue;
      const y = (k + 0.5 - b) / a, j = k * MAXC + cnt[k]++;
      cx[j] = x0 + ((y - y0) * (x1 - x0)) / (y1 - y0);
      cd[j] = d;
    }
  }
  for (let k = 0; k < L; k++) {
    const n = cnt[k], o = k * MAXC;
    for (let i = 1; i < n; i++) {
      const x = cx[o + i], dd = cd[o + i];
      let j = i - 1;
      while (j >= 0 && cx[o + j] > x) (cx[o + j + 1] = cx[o + j]), (cd[o + j + 1] = cd[o + j]), j--;
      (cx[o + j + 1] = x), (cd[o + j + 1] = dd);
    }
    let w = 0, start = 0;
    for (let i = 0; i < n; i++) {
      const was = w;
      w += cd[o + i];
      if (!was && w) start = cx[o + i];
      else if (was && !w) span(k, start, cx[o + i]);
    }
  }
}

// Seven sample lines a pixel row (five on the finer Hangul grid). Coverage
// is gathered per third of a pixel, so one pass gives the grey value of a
// pixel and of its three subpixels. The middle line runs through the pixel
// centres and gives the one-bit raster: TrueType's first rule, a pixel is
// on when its centre is inside the outline.
function rasterise(S, set) {
  const { GW, GH } = set;
  const SS = set.zoom > 3 ? 7 : 5, mid = (SS - 1) >> 1, NB = GW * 3;
  const { bins, bit } = S;
  bins.fill(0, 0, GH * NB);
  bit.fill(0, 0, GH * GW);
  scan(S, S.seg, S.nSeg, GH * SS, SS, 0, (k, xa, xb) => {
    const row = (k / SS) | 0, u0 = cl(xa * 3, 0, NB), u1 = cl(xb * 3, 0, NB);
    for (let q = floor(u0); q < u1 && q < NB; q++) bins[row * NB + q] += min(u1, q + 1) - max(u0, q);
    if (k % SS === mid) for (let p = max(0, ceil(xa - 0.5)); p < min(GW, ceil(xb - 0.5)); p++) bit[row * GW + p] = 1;
  });
  for (let i = 0; i < GH * NB; i++) bins[i] /= SS;
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt, 0, 0.1);
  S.set = cl(round(k[0]), 0, SETS.length - 1);
  S.mode = cl(round(k[2]), 0, 3);
  S.hint = cl(round(k[3]), 0, 2);
  if (input.btnPressed && input.btnPressed[1]) S.hold = !S.hold;
  if (!S.hold) S.T += dt * cl(k[1], 0.05, 3);
  const set = S.sets[S.set];
  // The true outline and its off-curve points, for drawing, and the outline
  // the raster is made from, which is the hinted one when hinting is on.
  let n = 0;
  S.nOff = 0;
  for (let i = 0; i < 2; i++) {
    const cs = place(S, set, i, 0);
    for (const c of cs) for (const q of c) if (!q[2] && S.nOff < 512) (S.offs[S.nOff * 2] = q[0]), (S.offs[S.nOff * 2 + 1] = q[1]), S.nOff++;
    n = flatten(cs, S.outl, n, set.zoom);
  }
  S.nOut = n;
  if (S.hint) {
    n = 0;
    for (let i = 0; i < 2; i++) n = flatten(place(S, set, i, S.hint), S.seg, n, set.zoom);
  } else S.seg.set(S.outl.subarray(0, n * 4));
  S.nSeg = n;
  rasterise(S, set);
}

// An outline as a thin line on the LEDs, added into acc. Overlapping
// contours leave edges inside the letter, so a stretch of line is drawn only
// where one side of it is outside: the outline is first filled at one sample
// per LED.
function trace(S, set, sg, nseg, acc) {
  const { mask } = S, z = set.zoom, X0 = set.X0, Y0 = set.Y0;
  mask.fill(0);
  scan(S, sg, nseg, H, z, Y0, (k, xa, xb) => {
    for (let x = max(0, ceil(X0 + xa * z - 0.5)); x < min(W, ceil(X0 + xb * z - 0.5)); x++) mask[k * W + x] = 1;
  });
  const inside = (x, y) => {
    const i = round(x), j = round(y);
    return i >= 0 && j >= 0 && i < W && j < H && mask[j * W + i];
  };
  acc.fill(0);
  for (let s = 0; s < nseg; s++) {
    const ax = X0 + sg[s * 4] * z - 0.5, ay = Y0 + sg[s * 4 + 1] * z - 0.5;
    const bx = X0 + sg[s * 4 + 2] * z - 0.5, by = Y0 + sg[s * 4 + 3] * z - 0.5;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-6) continue;
    const nx = (by - ay) / len, ny = (ax - bx) / len, k = max(1, ceil(len / 0.3)), wt = len / k;
    for (let i = 0; i < k; i++) {
      const u = (i + 0.5) / k, x = ax + u * (bx - ax), y = ay + u * (by - ay);
      if (inside(x + nx * 1.2, y + ny * 1.2) && inside(x - nx * 1.2, y - ny * 1.2)) continue;
      const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
      for (let q = 0; q < 4; q++) {
        const px = xi + (q & 1), py = yi + (q >> 1);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        acc[py * W + px] += wt * (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy);
      }
    }
  }
}

// The outline's pen: white over the stripes, rose over white pixels.
const PEN = [[255, 255, 255], [255, 64, 176], [255, 64, 176], [255, 64, 176]];

export function draw(display, params) {
  const S = params.s;
  const set = S.sets[S.set];
  const { GW, GH, zoom: z, X0, Y0 } = set, NB = GW * 3;
  const { bins, bit, fir, line, mode } = S;
  // The subpixel values, filtered along each row across pixel borders.
  if (mode < 2)
    for (let j = 0; j < GH; j++)
      for (let q = 0; q < NB; q++) {
        let v = 0;
        for (let t = -2; t <= 2; t++) {
          const r = q + t;
          if (r >= 0 && r < NB) v += FIR[t + 2] * bins[j * NB + r];
        }
        fir[j * NB + q] = v;
      }
  trace(S, set, S.outl, S.nOut, line);
  const pen = z > 3 ? 1.25 : 0.7, P = PEN[mode];
  // The control points off the curve, one LED each.
  for (let i = 0; i < S.nOff; i++) {
    const x = round(X0 + S.offs[i * 2] * z - 0.5), y = round(Y0 + S.offs[i * 2 + 1] * z - 0.5);
    if (x >= 0 && y >= 0 && x < W && y < H) line[y * W + x] = max(line[y * W + x], 0.6 / pen);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      const gx = x - X0, gy = y - Y0;
      if (gx >= 0 && gy >= 0 && gx < GW * z && gy < GH * z) {
        const i = (gx / z) | 0, j = (gy / z) | 0, o = j * NB + i * 3;
        if (mode === 0) {
          // The LCD under a loupe: each third of the pixel a stripe of its own primary.
          const sub = (((gx - i * z) * 3) / z) | 0, v = fir[o + sub] * 255;
          if (sub === 0) r = v;
          else if (sub === 1) g = v;
          else b = v;
        } else if (mode === 1) (r = fir[o] * 255), (g = fir[o + 1] * 255), (b = fir[o + 2] * 255);
        else r = g = b = (mode === 2 ? (bins[o] + bins[o + 1] + bins[o + 2]) / 3 : bit[j * GW + i]) * 255;
        // The grid: a faint dot at each pixel corner where nothing is lit.
        if (gx % z === 0 && gy % z === 0 && r + g + b < 40) r = g = b = 30;
      }
      const a = min(1, line[y * W + x] * pen);
      if (a > 0) (r += (P[0] - r) * a), (g += (P[1] - g) * a), (b += (P[2] - b) * a);
      display.setPixel(x, y, r, g, b);
    }
}
