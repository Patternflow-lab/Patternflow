// ===== Patternflow pattern =====
// Title:   Conway-Coxeter Frieze
// Family:  number
// Idea:    A Conway-Coxeter frieze stands up the tall panel, its rows of whole numbers turned into columns between two columns of 1s and offset half a step into a lattice of diamonds, every diamond keeping ad - bc = 1 as the frieze drifts down past its glide; every 6 s the frieze dims, the triangulated polygon it comes from lights up with each vertex's count of triangles, one diagonal flips, and the frieze comes back recomputed with the numbers that changed flashing white.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: frieze patterns (H. S. M. Coxeter, "Frieze patterns", 1971), triangulated polygons and frieze patterns (John Conway and H. S. M. Coxeter, 1973), pattern round 72
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sides=7..11, Chords=0..1
//
// Knob 1: Hue. Turns the numbers' colours round the wheel. At 0 the 2s are green, 3s teal, 4s cyan, 5s azure, 7s and 8s blue, 13s magenta, 21s red and 34s gold, each number on a diamond of its own colour at a fifth of the brightness; the 1s are white, the two border columns grey, and the flip is drawn in amber. At 0.5 the 2s are purple and the 8s yellow-green.
// Knob 2: Speed. The frieze drifts down 1.5 Speed LEDs a second, 3 at the opening 2, so the heptagon's frieze, which repeats every 84 LEDs and mirrors itself left to right every 42, comes round in 28 s. A diagonal flips every 12 / Speed seconds: every 6 s at Speed 2, first at 4.2 s, every 60 s at 0.2 and 4 s at 3.
// Knob 3: Sides. The polygon's n, 7 to 11, and the frieze's n - 1 columns. At the opening 7 there are 6 columns and the 42 triangulations of the heptagon give numbers up to 8; the largest number over all triangulations is a Fibonacci number, 13 for the octagon's 132, then 21, 34 and 55 for 11 sides and 4862 triangulations. Columns that can hold two digits are 7 LEDs wide, the rest 3. A new n starts from a fan and 4n random flips.
// Knob 4: Chords. Every number in the frieze is m(i, j) for the chord from vertex i to vertex j. At 0 the numbers are coloured by value; at 1 by the direction of their chord, so parallel chords share a colour, and the numbers standing at one height are one family of parallel chords. Between the two the colours blend; at the opening 0.06 they are nearly all by value.

// Coxeter (1971): a frieze is rows of numbers between a row of 0s and 1s
// above and of 1s and 0s below, each row offset half a step, where every
// diamond b over a, d over c holds ad - bc = 1. Conway and Coxeter (1973):
// the friezes of positive whole numbers with n - 1 rows between the 0s are
// the triangulations of an n-gon, the row after the 1s counting the
// triangles at each vertex, its quiddity. The entries are m(i, j) for
// vertices i and j, with m(i, i) = 0, m(i, i + 1) = 1 and
// m(i, j + 1) = a_j m(i, j) - m(i, j - 1); m(i, j) = 1 exactly where i j is
// a side or a diagonal of the triangulation, and m(i, j) = m(j, i + n), the
// glide. Both were checked against every triangulation from 5 to 11 sides.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, cos, sin, log2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const STEP = 12; // LEDs between one entry and the next down a column
const CX = 31.5, CY = 63.5, RX = 24.5, RY = 50; // the polygon, an ellipse's n-gon

// 3 x 5 digits, one octal digit a row from the top, 4 = left column.
const FONT = [0o75557, 0o26227, 0o71747, 0o71717, 0o55711, 0o74717, 0o74757, 0o71122, 0o75757, 0o75717];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- The triangulation: an n by n table of sides and diagonals. ----
const linked = (S, i, j) => S.adj[i * S.n + j] === 1;
function link(S, i, j, v) {
  S.adj[i * S.n + j] = v;
  S.adj[j * S.n + i] = v;
}
function diagonals(S) {
  const n = S.n, out = [];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1) && linked(S, i, j)) out.push(i, j);
  return out;
}
// The two triangles on diagonal i j: the vertices joined to both, one on
// each side. In a triangulated convex polygon every three mutually joined
// vertices bound a triangle.
function apexes(S, i, j) {
  const out = [];
  for (let k = 0; k < S.n; k++) if (k !== i && k !== j && linked(S, i, k) && linked(S, j, k)) out.push(k);
  return out;
}
function flip(S, i, j) {
  const [k, l] = apexes(S, i, j);
  link(S, i, j, 0);
  link(S, k, l, 1);
  return [k, l];
}

// ---- The frieze from the triangulation, checked. ----
function build(S) {
  const n = S.n, a = new Int32Array(n), M = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i] += S.adj[i * n + j];
  for (let i = 0; i < n; i++) a[i] -= 1; // triangles at i: its sides and diagonals less one
  for (let i = 0; i < n; i++) {
    const r = new Int32Array(n + 1);
    r[1] = 1;
    for (let k = 1; k < n; k++) r[k + 1] = a[(i + k) % n] * r[k] - r[k - 1];
    M.push(r);
  }
  // Every diamond: a = m(i, i + k) over d = m(i + 1, i + 1 + k), with
  // b = m(i + 1, i + k) and c = m(i, i + k + 1) beside them; the 1s and 0s
  // closing every column; every entry between them positive.
  let ok = true, checked = 0;
  for (let i = 0; i < n; i++) {
    const R = M[i], Q = M[(i + 1) % n];
    if (R[n - 1] !== 1 || R[n] !== 0) ok = false;
    for (let k = 1; k <= n - 2; k++, checked++) if (R[k] * Q[k] - Q[k - 1] * R[k + 1] !== 1) ok = false;
    for (let k = 1; k < n; k++) if (R[k] < 1) ok = false;
  }
  return { a, M, ok, checked };
}

// A random triangulation: a fan from vertex 0, then 4n random flips.
function fresh(S, n) {
  S.n = n;
  S.adj = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) link(S, i, (i + 1) % n, 1);
  for (let j = 2; j < n - 1; j++) link(S, 0, j, 1);
  for (let t = 0; t < 4 * n; t++) {
    const d = diagonals(S), q = 2 * floor((Math.random() * d.length) / 2);
    flip(S, d[q], d[q + 1]);
  }
  const f = build(S);
  S.a = f.a;
  S.M = f.M;
  S.checked = f.checked;
  S.flash = new Float32Array(n * (n + 1)).fill(-99);
  S.old = null;
  S.neu = null;
  S.pick = null;
  // Fixed column widths: 3 LEDs, or 7 where two digits can come, columns
  // 3 to n - 3 from the octagon on; the spare LEDs shared out as gaps.
  const wd = [];
  let used = 0;
  for (let k = 1; k < n; k++) {
    const w = n >= 8 && k >= 3 && k <= n - 3 ? 7 : 3;
    wd.push(w);
    used += w;
  }
  const gap = (W - used) / (n - 1);
  S.colX = [];
  let x = gap / 2;
  for (let k = 0; k < n - 1; k++) {
    S.colX.push(x + wd[k] / 2);
    x += wd[k] + gap;
  }
  // For each LED column, the frieze columns either side of it (1 to n - 1).
  S.near = new Int8Array(2 * W);
  for (let X = 0; X < W; X++) {
    let k = 1;
    while (k < n - 1 && S.colX[k] <= X) k++;
    S.near[2 * X] = X < S.colX[0] ? 1 : k;
    S.near[2 * X + 1] = X < S.colX[0] ? 1 : min(k + 1, n - 1);
  }
  // Colour and flash of the 14 entries in view down each column.
  S.EC = [];
  for (let k = 0; k < n; k++) S.EC.push(new Float32Array(14 * 5));
  S.I0 = new Int32Array(n);
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, n: 0, chords: 0.06, t: 0, scroll: 0, cyc: 0.5, pick: null, flips: 0, bad: 0, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 7, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.chords = cl(k[3], 0, 1);
  const n = round(cl(k[2], 7, 11));
  if (n !== S.n) fresh(S, n);
  S.t += d;
  S.scroll += d * 1.5 * S.speed;
  // The flip cycle, 12 / Speed seconds: the polygon fades in over the first
  // 8 per cent, the diagonal flips at 20, the polygon fades out from 32 to 40
  // and the changed numbers flash as the frieze comes back.
  S.cyc += (d * S.speed) / 12;
  if (S.cyc >= 1) {
    // A new cycle picks the diagonal to flip, not the one the last flip
    // made, which would only flip back.
    S.cyc -= 1;
    const dg = diagonals(S);
    let q = 2 * floor((Math.random() * dg.length) / 2);
    if (S.neu && dg.length > 2 && dg[q] === S.neu[0] && dg[q + 1] === S.neu[1]) q = (q + 2) % dg.length;
    S.pick = [dg[q], dg[q + 1]];
  }
  if (S.pick && S.cyc >= 0.2) {
    const [i, j] = S.pick, kl = flip(S, i, j), f = build(S);
    S.pick = null;
    if (f.ok) {
      // The changed entries flash from the moment the frieze comes back.
      const at = S.t + ((0.32 - S.cyc) * 12) / S.speed;
      for (let r = 0; r < n; r++) for (let c = 1; c < n; c++) if (f.M[r][c] !== S.M[r][c]) S.flash[r * (n + 1) + c] = at;
      S.a = f.a;
      S.M = f.M;
      S.old = [i, j];
      S.neu = [min(kl[0], kl[1]), max(kl[0], kl[1])];
      S.flips++;
    } else {
      // Never seen: a frieze that fails a diamond keeps the old triangulation.
      link(S, kl[0], kl[1], 0);
      link(S, i, j, 1);
      S.bad++;
    }
    S.checked = f.checked;
  }
}

// Additive soft line into the buffer, a splat every quarter LED.
function line(buf, x0, y0, x1, y1, r, g, b) {
  const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), steps = max(1, round(len * 4));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const X = ix + dx, Y = iy + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * 0.25, o = (Y * W + X) * 3;
        buf[o] = max(buf[o], min(1, buf[o] + r * w));
        buf[o + 1] = max(buf[o + 1], min(1, buf[o + 1] + g * w));
        buf[o + 2] = max(buf[o + 2], min(1, buf[o + 2] + b * w));
      }
  }
}

// One 3 x 5 digit with its top left at (x, y).
function digit(buf, d, x, y, r, g, b) {
  const f = FONT[d];
  for (let row = 0; row < 5; row++) {
    const Y = y + row;
    if (Y < 0 || Y >= H) continue;
    const bits = (f >> (3 * (4 - row))) & 7;
    for (let c = 0; c < 3; c++)
      if (bits & (4 >> c)) {
        const X = x + c;
        if (X < 0 || X >= W) continue;
        const o = (Y * W + X) * 3;
        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
      }
  }
}
// A number 1 to 99 centred on (cx, cy).
function number(buf, v, cx, cy, r, g, b) {
  const y = round(cy) - 2;
  if (v < 10) digit(buf, v, round(cx - 1.5), y, r, g, b);
  else {
    const x = round(cx - 3.5);
    digit(buf, floor(v / 10) % 10, x, y, r, g, b);
    digit(buf, v % 10, x + 4, y, r, g, b);
  }
}

const vx = (S, v) => CX + RX * cos((2 * PI * v) / S.n - PI / 2);
const vy = (S, v) => CY + RY * sin((2 * PI * v) / S.n - PI / 2);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
    return;
  }
  const { buf, n, M, colX, EC, I0 } = S, c = S.cyc, tmp = [0, 0, 0], acc = [0, 0, 0];
  // How far the polygon has come in: 0 on the frieze alone, 1 at full.
  const sm = (e) => e * e * (3 - 2 * e);
  const ov = c < 0.08 ? sm(c / 0.08) : c < 0.32 ? 1 : c < 0.4 ? sm(1 - (c - 0.32) / 0.08) : 0, fr = 1 - 0.85 * ov;
  const hue0 = S.hue + 0.12;
  hsv(hue0, 0.75, 1, acc);

  // ---- Each entry's colour. Column k holds m(i, i + k) at height
  // i + k / 2 steps. By value: 1s white, the border's dimmer, the rest round
  // the wheel by log2 of the value. By chord: hue from (i + j) mod n. ----
  for (let k = 1; k < n; k++) {
    const i0 = (I0[k] = Math.ceil((-STEP - S.scroll) / STEP - k / 2)), e = EC[k];
    for (let q = 0; q < 14; q++) {
      const i = i0 + q, r = ((i % n) + n) % n, v = M[r][k];
      const edge = k === 1 || k === n - 1;
      if (v === 1) tmp[0] = tmp[1] = tmp[2] = edge ? 0.6 : 1;
      else hsv(hue0 + 0.2 * log2(v), 0.8, 1, tmp);
      if (S.chords > 0) {
        const t = tmp.slice();
        hsv(hue0 + ((2 * r + k) % n) / n, 0.75, 1, tmp);
        for (let z = 0; z < 3; z++) tmp[z] = t[z] + (tmp[z] - t[z]) * S.chords;
      }
      // A changed number flashes white for 0.4 s and fades back over 1.2 s.
      const age = S.t - S.flash[r * (n + 1) + k];
      const wf = age >= 0 && age < 1.6 ? (age < 0.4 ? 1 : 1 - (age - 0.4) / 1.2) : 0;
      for (let z = 0; z < 3; z++) e[q * 4 + z] = tmp[z] + (1 - tmp[z]) * wf;
      e[q * 4 + 3] = wf;
      // How bright its diamond is: 0.2 of the colour, 0.1 for a 1 inside
      // and 0.05 on the border.
      e[56 + q] = v > 1 ? 0.2 : edge ? 0.083 : 0.1;
    }
  }

  // ---- Tiles: every LED belongs to the nearest entry in a diamond metric,
  // so each number sits on a diamond of its colour at 0.2, and LEDs on a
  // boundary between two diamonds stay dark. ----
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      const a = S.near[2 * x], b = S.near[2 * x + 1], h = b > a ? (colX[b - 1] - colX[a - 1]) / 2 : 6;
      let d1 = 9, d2 = 9, kb = 0, qb = 0;
      for (const k of a === b ? [a] : [a, b]) {
        const u = (y - S.scroll) / STEP - k / 2, i = round(u), dd = abs(x - colX[k - 1]) / h + (abs(u - i) * STEP) / (STEP / 2);
        if (dd < d1) (d2 = d1), (d1 = dd), (kb = k), (qb = i - I0[k]);
        else if (dd < d2) d2 = dd;
      }
      if (d2 - d1 < 0.16 || qb < 0 || qb > 13) {
        buf[o] = buf[o + 1] = buf[o + 2] = 0;
        continue;
      }
      const e = EC[kb], g = (e[56 + qb] + 0.3 * e[qb * 4 + 3]) * fr;
      buf[o] = e[qb * 4] * g;
      buf[o + 1] = e[qb * 4 + 1] * g;
      buf[o + 2] = e[qb * 4 + 2] * g;
    }

  // ---- The numbers. ----
  for (let k = 1; k < n; k++) {
    const e = EC[k];
    for (let q = 0; q < 14; q++) {
      const i = I0[k] + q, r = ((i % n) + n) % n, y = (i + k / 2) * STEP + S.scroll, lv = fr + (1 - fr) * e[q * 4 + 3];
      number(buf, M[r][k], colX[k - 1], y, e[q * 4] * lv, e[q * 4 + 1] * lv, e[q * 4 + 2] * lv);
    }
  }

  // ---- In the flip, the polygon over the dimmed frieze: sides grey,
  // diagonals white. The chosen diagonal pulses in the accent colour from
  // 0.08 of the cycle, fades from 0.2 to 0.26, and the new one grows from
  // one end to the other from 0.2 to 0.28. Each vertex carries its count of
  // triangles, the quiddity, the four the flip changes in the accent. ----
  if (ov > 0) {
    for (let v = 0; v < n; v++) line(buf, vx(S, v), vy(S, v), vx(S, (v + 1) % n), vy(S, (v + 1) % n), 0.6 * ov, 0.6 * ov, 0.6 * ov);
    const hot = c < 0.2 ? S.pick : null, grow = c >= 0.2 && c < 0.28 ? S.neu : null;
    for (let i = 0; i < n; i++)
      for (let j = i + 2; j < n; j++) {
        if ((i === 0 && j === n - 1) || !linked(S, i, j)) continue;
        if (hot && hot[0] === i && hot[1] === j) {
          const e = (c < 0.08 ? 1 : 0.6 + 0.4 * cos((c - 0.08) * 160)) * ov;
          line(buf, vx(S, i), vy(S, i), vx(S, j), vy(S, j), acc[0] * e, acc[1] * e, acc[2] * e);
        } else if (grow && grow[0] === i && grow[1] === j) {
          const g = (c - 0.2) / 0.08, x0 = vx(S, i), y0 = vy(S, i);
          line(buf, x0, y0, x0 + (vx(S, j) - x0) * g, y0 + (vy(S, j) - y0) * g, acc[0] * ov, acc[1] * ov, acc[2] * ov);
        } else line(buf, vx(S, i), vy(S, i), vx(S, j), vy(S, j), ov, ov, ov);
      }
    if (S.old && c >= 0.2 && c < 0.26) {
      const e = (1 - (c - 0.2) / 0.06) * ov, [i, j] = S.old;
      line(buf, vx(S, i), vy(S, i), vx(S, j), vy(S, j), acc[0] * e, acc[1] * e, acc[2] * e);
    }
    for (let v = 0; v < n; v++) {
      const ang = (2 * PI * v) / n - PI / 2, lx = CX + (RX + 6) * cos(ang), ly = CY + (RY + 7) * sin(ang);
      const touched = S.old && c >= 0.2 && c < 0.4 && (v === S.old[0] || v === S.old[1] || v === S.neu[0] || v === S.neu[1]);
      if (touched) number(buf, S.a[v], lx, ly, acc[0] * ov, acc[1] * ov, acc[2] * ov);
      else number(buf, S.a[v], lx, ly, ov, ov, ov);
    }
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(buf[o] * 255), round(buf[o + 1] * 255), round(buf[o + 2] * 255));
}
