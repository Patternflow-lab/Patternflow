// ===== Patternflow pattern =====
// Title:   Crofton Cell
// Family:  cells
// Idea:    Isotropic Poisson lines drift, are born and die across the tall panel and cut it into convex cells tinted by their number of sides, while the one cell that holds the fixed point in the middle, the Crofton cell, is lit gold with its incircle drawn in it, so when the Big knob keeps every line at least r away from that point the cell swells and its gold corners thin to slivers round a nearly circular disc, as Kendall conjectured.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Poisson line tessellation and its zero cell (Roger E. Miles, Random polygons determined by random lines in a plane, 1964); D. G. Kendall's conjecture that large zero cells are nearly round (1940s), proved for the plane by Igor Kovalenko (1997) and in general by Daniel Hug, Matthias Reitzner and Rolf Schneider (2004); pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lines=16..56, Big=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 triangles are teal, quadrilaterals azure, pentagons violet, hexagons pink and cells of seven sides or more lime, and the Crofton cell is a pale disc in gold corners.
// Knob 2: Speed. At 2 a line slides along its normal at up to 3 LEDs a second, turns at up to 0.05 radians a second and lives 10 s on average, so about one line a second is born somewhere and one dies. Everything goes as Speed / 2.
// Knob 3: Lines. The mean number of lines that cross the panel, 10 to 40; the cells come out about 120 at 20 lines and 420 at 40.
// Knob 4: Big. No line may come nearer the fixed point than r = 28 Big^0.6 LEDs, which is the Poisson process conditioned on the zero cell holding that disc: 5 LEDs at the opening 0.06, 12 at 0.25 and 28 at 1, where with 40 lines the cell is a 9 to 13 sided polygon whose incircle fills about 0.9 of its outer circle.

// A line is (theta, p): the points x with x . (cos theta, sin theta) = p,
// p >= 0, measured from the fixed point O in the middle of the panel. The
// isotropic Poisson line process is a Poisson point process in (theta, p)
// with uniform density, and by Crofton's formula the lines that hit a convex
// set K number perimeter(K) times that density on average. So the panel
// keeps every line with p < R, R past the panel's corners, uniformly in
// theta and p: the panel's perimeter of 384 LEDs against the circle's 2 pi R
// says how many of those cross it.
//
// Each line slides in p and turns in theta at its own constant rate, which
// moves the points of (theta, p) without squeezing them, so the law stays
// the Poisson one. A line whose p passes 0 is the same line seen from the
// other side, (theta + pi, -p). At p = R it turns back. Lines are also born
// uniformly at a constant rate and each dies at a constant rate, a spatial
// birth and death process whose resting law is the same Poisson process.
//
// The zero cell is the cell that contains O. Conditioning the process on
// the zero cell holding the disc of radius r round O is the same as
// keeping only the lines with p >= r, since a Poisson process on a set and
// on its complement are independent. So Big only hides lines: a line that
// slides in to p = r dies at the point where it touches the disc, and one
// that slides out is born there. Miles found the zero cell has pi^2 / 2 =
// 4.93 sides on average where a typical cell has 4. Kendall's question
// was what a large zero cell looks like, and the answer is a disc: with r
// large against the mean spacing of the lines, many lines lie just past r
// and the cell is a many sided polygon hugging the circle.
//
// Two LEDs are in the same cell when no line separates them, so each LED's
// cell is the set of lines it lies beyond, hashed. A cell's polygon is the
// square of side 2R clipped by the half plane of every line on that cell's
// side; its edges give the number of sides. The zero cell's largest
// inscribed disc comes from the three edges that pin it.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, abs, atan2, exp, pow, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const OX = 32, OY = 64;
// Lines are kept while they pass within R of O; the corners are 71.6 away.
const R = 76;
// Lines crossing the panel per line kept: perimeter over 2 pi R.
const CROSS = 384 / (TAU * R);
// Mean life, the speed limits, all at Speed 2.
const LIFE = 10, VP = 3, VT = 0.05;
const MAXL = 160;
const SLOTS = 2048;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
}

function poisson(mu) {
  const L = exp(-mu);
  let k = 0, prod = Math.random();
  while (prod > L && k < MAXL) {
    k++;
    prod *= Math.random();
  }
  return k;
}

function newLine(S, p) {
  if (S.n >= MAXL) return;
  const i = S.n++;
  S.th[i] = Math.random() * TAU;
  S.p[i] = p == null ? Math.random() * R : p;
  S.v[i] = (Math.random() * 2 - 1) * VP;
  S.w[i] = (Math.random() * 2 - 1) * VT;
  S.life[i] = -log(1 - Math.random()) * LIFE;
  S.key[i] = (Math.random() * 4294967296) >>> 0 | 1;
  S.glow[i] = 0;
  S.vis[i] = 0;
}

function kill(S, i) {
  // A dying line that the panel shows leaves a fading ghost.
  if (S.vis[i] && S.p[i] < 73 && S.ghosts.length < 8) S.ghosts.push([cos(S.th[i]), sin(S.th[i]), S.p[i], 1]);
  const j = --S.n;
  for (const a of [S.th, S.p, S.v, S.w, S.life, S.key, S.glow, S.vis]) a[i] = a[j];
}

export function setup(params) {
  params.s = {
    n: 0, th: new Float64Array(MAXL), p: new Float64Array(MAXL), v: new Float64Array(MAXL), w: new Float64Array(MAXL),
    life: new Float64Array(MAXL), key: new Uint32Array(MAXL), glow: new Float32Array(MAXL), vis: new Uint8Array(MAXL),
    ghosts: [], sparks: [], started: false, hue: 0, r: 4, mu: 20,
    hash: new Uint32Array(N), dmin: new Float32Array(N), near: new Int16Array(N), cell: new Int16Array(N),
    skey: new Uint32Array(SLOTS), sused: new Uint8Array(SLOTS), sid: new Int16Array(SLOTS),
    rep: new Int32Array(SLOTS), sides: new Uint8Array(SLOTS), area: new Float32Array(SLOTS),
    px: new Float64Array(96), py: new Float64Array(96), pl: new Int16Array(96), qx: new Float64Array(96), qy: new Float64Array(96), ql: new Int16Array(96),
    zero: null,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 16, 0.06];
  const d = cl(dt || 0, 0, 0.1) * cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  S.hue = k[0] || 0;
  S.mu = cl(k[2] == null ? 16 : k[2], 16, 56) / CROSS;
  S.r = 20 * pow(cl(k[3] == null ? 0.06 : k[3], 0, 1), 0.6);
  if (!S.started) {
    S.started = true;
    for (let m = poisson(S.mu); m > 0; m--) newLine(S);
    for (let i = 0; i < S.n; i++) S.vis[i] = S.p[i] >= S.r ? 1 : 0;
  }
  // Births at the resting rate, plus a quick catch up when the knob moves.
  const births = (S.mu / LIFE + max(0, S.mu - S.n) / 0.6) * d;
  let extra = (max(0, S.n - S.mu) / 0.6) * d;
  for (let b = births; b > 0; b--) if (Math.random() < b) {
    newLine(S);
    S.glow[S.n - 1] = 1;
  }
  for (; extra > 0; extra--) if (Math.random() < extra && S.n > 0) kill(S, floor(Math.random() * S.n));
  for (let i = S.n - 1; i >= 0; i--) {
    let p = S.p[i] + S.v[i] * d;
    S.th[i] += S.w[i] * d;
    if (p < 0) {
      p = -p;
      S.th[i] += PI;
      S.v[i] = -S.v[i];
    }
    if (p > R) {
      p = 2 * R - p;
      S.v[i] = -S.v[i];
    }
    S.p[i] = p;
    S.glow[i] = max(0, S.glow[i] - d * 1.6);
    S.life[i] -= d;
    if (S.life[i] <= 0) {
      kill(S, i);
      continue;
    }
    // Big hides the lines nearer than r: they die and are born touching the disc.
    const vis = p >= S.r ? 1 : 0;
    if (vis !== S.vis[i]) {
      if (S.sparks.length < 24) S.sparks.push([OX + S.r * cos(S.th[i]), OY + S.r * sin(S.th[i]), 1]);
      if (vis) S.glow[i] = 0.8;
      S.vis[i] = vis;
    }
  }
  for (const g of S.ghosts) g[3] -= d * 2;
  S.ghosts = S.ghosts.filter((g) => g[3] > 0);
  for (const s of S.sparks) s[2] -= d * 2.2;
  S.sparks = S.sparks.filter((s) => s[2] > 0);
}

// Clip the square of side 2R by the lines on one side, sign per line from
// the LED at rep, or every line on O's side when rep < 0. Leaves the polygon
// in S.px, S.py with edge labels in S.pl (-1 for the square) and returns its
// vertex count.
function polygon(S, act, rep) {
  let px = S.px, py = S.py, pl = S.pl, qx = S.qx, qy = S.qy, ql = S.ql;
  px[0] = -R; py[0] = -R; px[1] = R; py[1] = -R; px[2] = R; py[2] = R; px[3] = -R; py[3] = R;
  pl[0] = pl[1] = pl[2] = pl[3] = -1;
  let n = 4;
  const rx = rep < 0 ? 0 : (rep % W) + 0.5 - OX, ry = rep < 0 ? 0 : floor(rep / W) + 0.5 - OY;
  for (let j = 0; j < act.n; j++) {
    const a = act.a[j], b = act.b[j], p = act.p[j];
    // Keep s (a x + b y - p) >= 0.
    const s = a * rx + b * ry - p > 0 ? 1 : -1;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const i2 = i + 1 === n ? 0 : i + 1;
      const f1 = s * (a * px[i] + b * py[i] - p), f2 = s * (a * px[i2] + b * py[i2] - p);
      if (f1 >= 0) {
        qx[m] = px[i]; qy[m] = py[i]; ql[m] = pl[i]; m++;
        if (f2 < 0) {
          const t = f1 / (f1 - f2);
          qx[m] = px[i] + t * (px[i2] - px[i]); qy[m] = py[i] + t * (py[i2] - py[i]); ql[m] = j; m++;
        }
      } else if (f2 >= 0) {
        const t = f1 / (f1 - f2);
        qx[m] = px[i] + t * (px[i2] - px[i]); qy[m] = py[i] + t * (py[i2] - py[i]); ql[m] = pl[i]; m++;
      }
      if (m > 90) break;
    }
    [px, qx] = [qx, px];
    [py, qy] = [qy, py];
    [pl, ql] = [ql, pl];
    n = m;
    if (n < 3) break;
  }
  S.px = px; S.py = py; S.pl = pl; S.qx = qx; S.qy = qy; S.ql = ql;
  return n;
}

// The largest disc in the convex polygon S.px, S.py: centre and radius from
// the three edges it touches, tried over every three.
function incircle(S, n) {
  const ex = [], ey = [], ec = [];
  for (let i = 0; i < n; i++) {
    const i2 = i + 1 === n ? 0 : i + 1;
    const dx = S.px[i2] - S.px[i], dy = S.py[i2] - S.py[i], L = sqrt(dx * dx + dy * dy);
    if (L < 1e-6) continue;
    // The square runs clockwise on the panel (y down), so the inward
    // normal is the edge turned a quarter to the right.
    const nx = -dy / L, ny = dx / L;
    ex.push(nx); ey.push(ny); ec.push(nx * S.px[i] + ny * S.py[i]);
  }
  const m = ex.length;
  let best = [0, 0, 0];
  for (let i = 0; i < m; i++)
    for (let j = i + 1; j < m; j++)
      for (let k = j + 1; k < m; k++) {
        // n . x - rho = c for the three: inside means n . x >= c + rho.
        const a1 = ex[i], b1 = ey[i], c1 = ec[i], a2 = ex[j], b2 = ey[j], c2 = ec[j], a3 = ex[k], b3 = ey[k], c3 = ec[k];
        const det = a1 * (b2 * -1 - -1 * b3) - b1 * (a2 * -1 - -1 * a3) + -1 * (a2 * b3 - b2 * a3);
        if (abs(det) < 1e-9) continue;
        const dx = c1 * (b2 * -1 - -1 * b3) - b1 * (c2 * -1 - -1 * c3) + -1 * (c2 * b3 - b2 * c3);
        const dy = a1 * (c2 * -1 - -1 * c3) - c1 * (a2 * -1 - -1 * a3) + -1 * (a2 * c3 - c2 * a3);
        const dr = a1 * (b2 * c3 - c2 * b3) - b1 * (a2 * c3 - c2 * a3) + c1 * (a2 * b3 - b2 * a3);
        const x = dx / det, y = dy / det, rho = dr / det;
        if (!(rho > best[2])) continue;
        let ok = true;
        for (let q = 0; q < m && ok; q++) if (ex[q] * x + ey[q] * y < ec[q] + rho - 1e-7) ok = false;
        if (ok) best = [x, y, rho];
      }
  return best;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { hash, dmin, near, cell, skey, sused, sid, rep, sides } = S;
  // The lines the panel shows.
  const act = { n: 0, a: [], b: [], p: [], key: [], glow: [] };
  for (let i = 0; i < S.n; i++)
    if (S.vis[i] && S.p[i] < 73) {
      act.a.push(cos(S.th[i])); act.b.push(sin(S.th[i])); act.p.push(S.p[i]); act.key.push(S.key[i]); act.glow.push(S.glow[i]);
      act.n++;
    }
  hash.fill(0);
  dmin.fill(99);
  near.fill(-1);
  for (let j = 0; j < act.n; j++) {
    const a = act.a[j], b = act.b[j], key = act.key[j];
    for (let y = 0; y < H; y++) {
      let dd = a * (0.5 - OX) + b * (y + 0.5 - OY) - act.p[j];
      for (let x = 0, i = y * W; x < W; x++, i++, dd += a) {
        if (dd > 0) hash[i] ^= key;
        const ad = dd < 0 ? -dd : dd;
        if (ad < dmin[i]) {
          dmin[i] = ad;
          near[i] = j;
        }
      }
    }
  }
  // Cells: hash every LED's line set into a table.
  sused.fill(0);
  let cells = 0;
  for (let i = 0; i < N; i++) {
    const h = hash[i];
    let s = Math.imul(h, 2654435761) >>> 21;
    while (sused[s] && skey[s] !== h) s = (s + 1) & (SLOTS - 1);
    if (!sused[s]) {
      sused[s] = 1;
      skey[s] = h;
      sid[s] = cells;
      rep[cells] = i;
      cells++;
    }
    cell[i] = sid[s];
  }
  for (let c = 0; c < cells; c++) {
    const n = polygon(S, act, rep[c]);
    let e = 0, ar = 0;
    for (let i = 0; i < n; i++) {
      if (S.pl[i] >= 0) e++;
      const i2 = i + 1 === n ? 0 : i + 1;
      ar += S.px[i] * S.py[i2] - S.px[i2] * S.py[i];
    }
    sides[c] = e;
    S.area[c] = abs(ar) / 2;
  }
  // The zero cell, every line on O's side.
  const zn = polygon(S, act, -1);
  const [cx, cy, rin] = incircle(S, zn);
  let rout = 0, zs = 0;
  for (let i = 0; i < zn; i++) {
    rout = max(rout, sqrt((S.px[i] - cx) ** 2 + (S.py[i] - cy) ** 2));
    if (S.pl[i] >= 0) zs++;
  }
  S.zero = { sides: zs, rin, rout };
  const icx = cx + OX, icy = cy + OY;

  const hue = S.hue;
  // Hue by number of sides, a little brighter the larger the cell.
  const tone = new Float32Array(cells * 3);
  for (let c = 0; c < cells; c++) {
    const n = sides[c], h = n <= 3 ? 0.47 : n === 4 ? 0.6 : n === 5 ? 0.74 : n === 6 ? 0.88 : 0.24;
    const col = hsv(hue + h, 0.7, 0.32 + 0.26 * cl(log(1 + S.area[c]) / log(3000), 0, 1));
    tone[c * 3] = col[0] * 255; tone[c * 3 + 1] = col[1] * 255; tone[c * 3 + 2] = col[2] * 255;
  }
  const gold = hsv(hue + 0.12, 0.8, 1).map((v) => v * 255);
  const pale = hsv(hue + 0.55, 0.2, 0.95).map((v) => v * 255);
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0, px = x + 0.5, py = y + 0.5;
    const c = cell[i];
    let r, g, b;
    if (hash[i] === 0) {
      const q = sqrt((px - icx) ** 2 + (py - icy) ** 2);
      const t = cl(q - rin + 0.5, 0, 1);
      r = pale[0] + (gold[0] - pale[0]) * t;
      g = pale[1] + (gold[1] - pale[1]) * t;
      b = pale[2] + (gold[2] - pale[2]) * t;
    } else {
      r = tone[c * 3]; g = tone[c * 3 + 1]; b = tone[c * 3 + 2];
    }
    // The lines themselves are dark seams; a new line flashes white.
    const dm = dmin[i];
    const seam = cl((dm - 0.3) / 0.45, 0, 1);
    r *= seam; g *= seam; b *= seam;
    if (near[i] >= 0) {
      const gl = act.glow[near[i]];
      if (gl > 0) {
        const f = gl * exp(-dm * dm * 1.5) * 255;
        r += f; g += f; b += f;
      }
    }
    // Dying lines fade out where they stood.
    for (const gh of S.ghosts) {
      const dd = abs(gh[0] * (px - OX) + gh[1] * (py - OY) - gh[2]);
      if (dd < 1.2) {
        const f = gh[3] * (1 - dd / 1.2) * 150;
        r += f; g += f; b += f;
      }
    }
    // Where a line touches the forbidden disc it dies or is born.
    for (const sp of S.sparks) {
      const dd = (px - sp[0]) ** 2 + (py - sp[1]) ** 2;
      if (dd < 9) {
        const f = sp[2] * (1 - dd / 9) * 255;
        r += f; g += f * 0.9; b += f * 0.7;
      }
    }
    // The disc no line may enter, a faint ring round O.
    if (S.r > 1.5) {
      const fr = 1 - abs(sqrt((px - OX) ** 2 + (py - OY) ** 2) - S.r) / 0.6;
      if (fr > 0) {
        r *= 1 - 0.35 * fr; g *= 1 - 0.3 * fr; b *= 1 - 0.15 * fr;
      }
    }
    // The incircle of the zero cell, solid, and its outer circle round the
    // same centre, dashed, over everything.
    const q = sqrt((px - icx) ** 2 + (py - icy) ** 2);
    const ri = 1 - abs(q - rin) / 0.75;
    if (ri > 0 && rin > 1) {
      r += (255 - r) * ri; g += (255 - g) * ri; b += (255 - b) * ri;
    }
    const ro = 1 - abs(q - rout) / 0.7;
    if (ro > 0 && floor(((atan2(py - icy, px - icx) + PI) / TAU) * 40) % 2 === 0) {
      r += (255 - r) * ro * 0.55; g += (255 - g) * ro * 0.55; b += (255 - b) * ro * 0.55;
    }
    // O itself, a dark point.
    if (abs(px - OX) < 1 && abs(py - OY) < 1) r = g = b = 0;
    display.setPixel(x, y, min(255, r) | 0, min(255, g) | 0, min(255, b) | 0);
  }
}
