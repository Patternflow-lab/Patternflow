// ===== Patternflow pattern =====
// Title:   Weaire-Phelan
// Family:  space
// Idea:    A tall column of 48 foam cells turns slowly in depth, each the Voronoi cell of a site of the A15 lattice, so that together they are the flat-faced Weaire-Phelan foam of green-teal pentagonal dodecahedra and fourteen-faced cells with two gold hexagons each, and a knob lowers a line above which Kelvin's truncated octahedra of the same volume, with violet squares, take their place.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Weaire-Phelan structure (Denis Weaire and Robert Phelan, 1993), against Kelvin's truncated octahedra (William Thomson, Lord Kelvin, 1887)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Kelvin=0..1, Gap=0..1
//
// Knob 1: Hue. Turns every face colour round the wheel together. At 0 the pentagons of the fourteen-faced cells are blue-teal, those of the dodecahedra a greener teal, the hexagons gold and Kelvin's squares violet; at 0.5 the pentagons turn red and the hexagons blue.
// Knob 2: Speed. How fast the column turns about its upright axis: at 2 once in 16 s, at 0.2 once in two and a half minutes, at 3 once in 10.5 s.
// Knob 3: Kelvin. Lowers a line through the column. Below it the cells are Weaire and Phelan's, above it Kelvin's truncated octahedra with six squares and eight hexagons, each of 2,744 cubic LEDs, the mean of WP's two sizes (2,680 and 2,765). At 0 the column is all WP, at 0.5 its top half is Kelvin's, at 1 all of it. With flat faces the walls come to 5.2950 per cell of unit volume for WP and 5.3147 for Kelvin, 0.37% more.
// Knob 4: Gap. Shrinks every cell about its own site, to half its size at 1, so the foam opens up. At 0 the walls meet and at 0.06 they part by a hairline; at 0.5 the inner stack of fourteen-faced cells shows through the gaps, and at 1 each cell stands apart and its faces can be counted.

const W = 64, H = 128, N = W * H, CX = 31.5, CY = 63.5;
const { floor, min, max, abs, sin, cos, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The sites of one unit cube. A15 (the beta-tungsten structure): its Voronoi
// cells are the flat-faced Weaire-Phelan foam. BCC: its Voronoi cells are
// Kelvin's truncated octahedra.
const A15 = [[0, 0, 0], [0.5, 0.5, 0.5], [0.25, 0.5, 0], [0.75, 0.5, 0], [0, 0.25, 0.5], [0, 0.75, 0.5], [0.5, 0, 0.25], [0.5, 0, 0.75]];
const BCC = [[0, 0, 0], [0.5, 0.5, 0.5]];
// The WP cube edge in LEDs. Kelvin's cube holds two cells to WP's eight, so
// for the same volume per cell its edge is the WP edge over the cube root of 4.
const AW = 28, AK = AW / Math.cbrt(4);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The Voronoi cell of site i, relative to the site: a cube two cube edges
// wide, cut by the bisecting plane of every site of the periodic lattice
// within 1.5 cube edges, nearest first. Each cut keeps the part of every face
// on the site's side and closes the hole with a new face, its corners sorted
// by angle round their mean.
function voronoi(sites, i) {
  const c = sites[i], E = 1e-10;
  let F = [];
  for (let ax = 0; ax < 3; ax++)
    for (const sg of [-1, 1]) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3, q = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 0, 0];
        p[ax] = sg;
        p[u] = a * sg;
        p[v] = b;
        q.push(p);
      }
      F.push(q);
    }
  const nb = [];
  for (const s of sites)
    for (let x = -2; x <= 2; x++)
      for (let y = -2; y <= 2; y++)
        for (let z = -2; z <= 2; z++) {
          const d = [s[0] + x - c[0], s[1] + y - c[1], s[2] + z - c[2]], r2 = dot(d, d);
          if (r2 > E && r2 < 2.25) nb.push([d, r2]);
        }
  nb.sort((a, b) => a[1] - b[1]);
  // A plane further than the farthest corner cannot cut, nor can any after it.
  let far = 3;
  for (const [d, r2] of nb) {
    if (r2 > 4 * far) break;
    const side = (p) => dot(p, d) - r2 / 2, out = [], cut = [];
    for (const f of F) {
      const q = [];
      for (let m = 0; m < f.length; m++) {
        const A = f[m], B = f[(m + 1) % f.length], sa = side(A), sb = side(B);
        if (sa <= E) q.push(A);
        if (abs(sa) <= E) cut.push(A);
        else if ((sa < 0) !== (sb < 0) && abs(sb) > E) {
          const t = sa / (sa - sb), X = [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])];
          q.push(X);
          cut.push(X);
        }
      }
      if (q.length >= 3) out.push(q);
    }
    if (cut.length >= 3) {
      const m = [0, 1, 2].map((k) => cut.reduce((s, p) => s + p[k], 0) / cut.length), e1 = sub(cut[0], m), e2 = crs(d, e1), pts = [];
      for (const p of cut) if (!pts.some((o) => hypot(...sub(o[0], p)) < 1e-7)) pts.push([p, Math.atan2(dot(sub(p, m), e2), dot(sub(p, m), e1))]);
      pts.sort((a, b) => a[1] - b[1]);
      if (pts.length >= 3) out.push(pts.map((o) => o[0]));
    }
    F = out;
    far = 0;
    for (const f of F) for (const p of f) far = max(far, dot(p, p));
  }
  // Corners shared between faces, and each face as a list of corner indices
  // with its outward unit normal. The cell's volume is summed as pyramids on
  // its faces with their apex at the site.
  const V = [], faces = [];
  const idx = (p) => {
    for (let k = 0; k < V.length; k++) if (hypot(...sub(V[k], p)) < 1e-7) return k;
    V.push(p);
    return V.length - 1;
  };
  let vol = 0, area = 0;
  for (const f of F) {
    const ix = [];
    for (const p of f) {
      const k = idx(p);
      if (ix[ix.length - 1] !== k && ix[0] !== k) ix.push(k);
    }
    let n = [0, 0, 0];
    for (let m = 1; m + 1 < ix.length; m++) n = n.map((v, t) => v + crs(sub(V[ix[m]], V[ix[0]]), sub(V[ix[m + 1]], V[ix[0]]))[t] / 2);
    const ar = hypot(...n);
    if (ix.length < 3 || ar < 1e-9) continue;
    n = n.map((v) => v / ar);
    if (dot(n, V[ix[0]]) < 0) ix.reverse(), (n = n.map((v) => -v));
    faces.push({ ix, n, nv: ix.length });
    area += ar;
    vol += (ar * dot(n, V[ix[0]])) / 3;
  }
  // Each edge once, with the two faces that meet there.
  const edges = [], seen = new Map();
  faces.forEach((f, j) => {
    for (let m = 0; m < f.nv; m++) {
      const a = f.ix[m], b = f.ix[(m + 1) % f.nv], key = min(a, b) * 1000 + max(a, b);
      if (seen.has(key)) edges[seen.get(key) + 3] = j;
      else seen.set(key, edges.length), edges.push(a, b, j, j);
    }
  });
  return { V, faces, edges, vol, area };
}

export function setup(params) {
  const S = (params.s = { hue: 0, speed: 2, kel: 0, gap: 0.06, th: 0.6, inst: [], cells: [], check: null });
  // The base cells, eight of WP and two of Kelvin. S.check keeps what the
  // theorem is about: each cell's volume and face sizes, and the mean surface
  // of a cell scaled to unit volume, the number Kelvin's problem is quoted in
  // (each wall then counts once for each of the two cells it parts).
  const base = [A15, BCC].map((sites) => sites.map((_, i) => voronoi(sites, i)));
  const ck = (S.check = {});
  base.forEach((cells, k) => {
    const v = cells.reduce((s, c) => s + c.vol, 0), a = cells.reduce((s, c) => s + c.area, 0), n = cells.length;
    ck[k ? "kelvin" : "wp"] = { volumes: cells.map((c) => c.vol), faces: cells.map((c) => c.faces.map((f) => f.nv)), total: v, areaPerUnitVolume: a / n / (v / n) ** (2 / 3) };
  });
  // The column: every site within a radius of a vertical axis and a height
  // of the middle, for each lattice. WP's axis runs up a stack of
  // fourteen-faced cells joined by their hexagons; Kelvin's up a line of sites.
  const pick = (sites, cells, a, ax, az, R, kind) => {
    for (let i = 0; i < sites.length; i++)
      for (let x = -3; x <= 3; x++)
        for (let y = -6; y <= 6; y++)
          for (let z = -3; z <= 3; z++) {
            const s = [sites[i][0] + x - ax, sites[i][1] + y - 0.5, sites[i][2] + z - az];
            if (hypot(s[0], s[2]) > R || abs(s[1]) * a > 48) continue;
            const n = cells[i].V.length;
            S.inst.push({ c: cells[i], kind, x: s[0] * a, y: s[1] * a, z: s[2] * a, a, on: false, fr: new Uint8Array(cells[i].faces.length), sx: new Float64Array(n), sy: new Float64Array(n), sz: new Float64Array(n) });
          }
  };
  pick(A15, base[0], AW, 0, 0.5, 0.57, 0);
  pick(BCC, base[1], AK, 0.25, 0.25, 0.8, 1);
  S.PX = new Float64Array(16);
  S.PY = new Float64Array(16);
  S.PZ = new Float64Array(16);
  S.zb = new Float32Array(N);
  S.rgb = new Float32Array(N * 3);
  S.col = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.kel = cl(k[2], 0, 1);
  S.gap = cl(k[3], 0, 1);
  S.th += d * S.speed * 0.2;
}

// The view: turned th about the vertical, then tipped EL toward the viewer
// so the tops of the cells show, with a little perspective from DCAM LEDs.
// A key light from the upper left and a weaker fill from the right.
const EL = 0.28, CE = cos(EL), SE = sin(EL), DCAM = 220;
// Light kept in the shade and overall gain for each face colour (see draw);
// hexagons keep more so their gold never sinks to brown.
const AMB = [0.14, 0.42, 0.22, 0.14], GAIN = [0.95, 1.05, 1, 0.95];

// Fills a convex polygon of n screen corners row by row, the depth taken
// from the plane through three of them; nearer pixels win.
function poly(S, X, Y, Z, n, r, g, b) {
  let y0 = 1e9, y1 = -1e9;
  for (let m = 0; m < n; m++) (y0 = min(y0, Y[m])), (y1 = max(y1, Y[m]));
  const ux = X[1] - X[0], uy = Y[1] - Y[0], uz = Z[1] - Z[0], vx = X[2] - X[0], vy = Y[2] - Y[0], vz = Z[2] - Z[0], dn = ux * vy - uy * vx;
  if (abs(dn) < 1e-6) return;
  const zx = (uz * vy - uy * vz) / dn, zy = (ux * vz - uz * vx) / dn, zb = S.zb, rgb = S.rgb;
  for (let y = max(0, Math.ceil(y0)), ye = min(H - 1, floor(y1)); y <= ye; y++) {
    let xl = 1e9, xr = -1e9;
    for (let m = 0; m < n; m++) {
      const k = m + 1 < n ? m + 1 : 0, ya = Y[m], yb = Y[k];
      if ((ya <= y && yb >= y) || (yb <= y && ya >= y)) {
        const x = ya === yb ? X[m] : X[m] + ((y - ya) * (X[k] - X[m])) / (yb - ya);
        xl = min(xl, x);
        xr = max(xr, x);
        if (ya === yb) xr = max(xr, X[k]), (xl = min(xl, X[k]));
      }
    }
    for (let x = max(0, Math.ceil(xl)), xe = min(W - 1, floor(xr)); x <= xe; x++) {
      const p = y * W + x, z = Z[0] + zx * (x - X[0]) + zy * (y - Y[0]);
      if (z <= zb[p]) continue;
      // Darker with depth, pixel by pixel, so a face turning away fades
      // along its length.
      const f = cl(0.72 + z / 55, 0.3, 1);
      zb[p] = z;
      rgb[p * 3] = r * f;
      rgb[p * 3 + 1] = g * f;
      rgb[p * 3 + 2] = b * f;
    }
  }
}

function line(S, ax, ay, az, bx, by, bz, lv) {
  const n = Math.ceil(max(abs(bx - ax), abs(by - ay))) + 1, zb = S.zb, rgb = S.rgb;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(ax + t * (bx - ax)), y = Math.round(ay + t * (by - ay));
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const p = y * W + x;
    if (az + t * (bz - az) < zb[p] - 1.5) continue;
    rgb[p * 3] = max(rgb[p * 3], lv);
    rgb[p * 3 + 1] = max(rgb[p * 3 + 1], lv);
    rgb[p * 3 + 2] = max(rgb[p * 3 + 2], lv);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const zb = S.zb, rgb = S.rgb, PX = S.PX, PY = S.PY, PZ = S.PZ;
  zb.fill(-1e9);
  rgb.fill(0);
  const ct = cos(S.th), st = sin(S.th), sc = 1 - 0.5 * S.gap;
  // Face colours: pentagons of the fourteen-faced cells, hexagons, squares
  // and the pentagons of the dodecahedra, a little greener.
  const col = S.col;
  hsv(0.53 + S.hue, 0.75, 1, col[0]);
  hsv(0.14 + S.hue, 0.6, 1, col[1]);
  hsv(0.8 + S.hue, 0.6, 1, col[2]);
  hsv(0.45 + S.hue, 0.65, 1, col[3]);
  // The cut between the two structures, from above the top (all WP) at
  // Kelvin 0 to below the bottom (all Kelvin) at 1.
  const yc = 64 - 128 * S.kel, half = 8;
  for (const it of S.inst) {
    it.on = it.kind === 0 ? it.y < yc - half : it.y > yc + half;
    if (!it.on) continue;
    const c = it.c, V = c.V, a = it.a * sc, sx = it.sx, sy = it.sy, sz = it.sz, fr = it.fr;
    for (let k = 0; k < V.length; k++) {
      const x = it.x + a * V[k][0], y = it.y + a * V[k][1], z = it.z + a * V[k][2];
      const xr = ct * x + st * z, zr = -st * x + ct * z, yr = CE * y - SE * zr, zz = SE * y + CE * zr, f = DCAM / (DCAM - zz);
      sx[k] = CX + xr * f;
      sy[k] = CY - yr * f;
      sz[k] = zz;
    }
    c.faces.forEach((fc, j) => {
      const n = fc.n, nx = ct * n[0] + st * n[2], nzr = -st * n[0] + ct * n[2], ny = CE * n[1] - SE * nzr, nz = SE * n[1] + CE * nzr;
      // Back faces away (seen from the camera, DCAM in front); the rest lit
      // from the upper left and darker with depth.
      const i0 = fc.ix[0], px = (sx[i0] - CX) * (DCAM - sz[i0]) / DCAM, py = (CY - sy[i0]) * (DCAM - sz[i0]) / DCAM;
      fr[j] = nx * -px + ny * -py + nz * (DCAM - sz[i0]) > 0 ? 1 : 0;
      if (!fr[j]) return;
      const t = fc.nv === 5 ? (c.faces.length === 12 ? 3 : 0) : fc.nv === 6 ? 1 : 2;
      const lam = max(0, -0.45 * nx + 0.6 * ny + 0.66 * nz), fill = max(0, 0.6 * nx - 0.1 * ny + 0.79 * nz);
      const sh = min(1, AMB[t] + (1 - AMB[t]) * (0.8 * lam * lam + 0.3 * fill)) * GAIN[t], cc = col[t];
      for (let m = 0; m < fc.nv; m++) (PX[m] = sx[fc.ix[m]]), (PY[m] = sy[fc.ix[m]]), (PZ[m] = sz[fc.ix[m]]);
      poly(S, PX, PY, PZ, fc.nv, cc[0] * sh, cc[1] * sh, cc[2] * sh);
    });
  }
  // Edges of the faces turned to the viewer, white, dimmer further back.
  for (const it of S.inst) {
    if (!it.on) continue;
    const e = it.c.edges, sx = it.sx, sy = it.sy, sz = it.sz, fr = it.fr;
    for (let m = 0; m < e.length; m += 4) {
      if (!fr[e[m + 2]] && !fr[e[m + 3]]) continue;
      const a = e[m], b = e[m + 1];
      line(S, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], cl(0.62 + (sz[a] + sz[b]) / 100, 0.35, 0.95));
    }
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, min(255, rgb[p * 3] * 255) | 0, min(255, rgb[p * 3 + 1] * 255) | 0, min(255, rgb[p * 3 + 2] * 255) | 0);
}
