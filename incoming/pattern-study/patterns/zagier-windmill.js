// ===== Patternflow pattern =====
// Title:   Zagier's Windmills
// Family:  number
// Idea:    A prime p one more than a multiple of four is drawn as a windmill of p cells, a central square with four rectangular sails, and Zagier's involution and the swap of the sails take turns redrawing it: Zagier's map keeps the windmill's outline and cuts a new central square from it, the swap turns every sail on its side, and the walk from Zagier's one fixed point ends at a windmill with square sails that slide together into the two squares whose areas add up to p, while below the plane of sail sizes y and z plots every windmill of p on its hyperbola and the zigzag path the walk took.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fermat's theorem on sums of two squares (Pierre de Fermat, 1640; Leonhard Euler, 1749), Zagier's one-sentence proof (Don Zagier, 1990, after Roger Heath-Brown, 1984), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Prime=1..13, Zoom=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the central square is pale gold and the sails on its top, right, bottom and left are green, cyan, blue and violet; in the plot the hyperbolas and Zagier's steps are gold and the swaps pale blue. At 0.5 the square is pale blue and the sails pink, red, orange and lime.
// Knob 2: Speed. At 2 each step of the walk takes 1 second and holds half a second; the first windmill grows in 0.8 s and the end, a pause, the slide into two squares, the show and the fade, takes 4.4 s. So 13 takes 8.2 s, 97 with its walk of 26 steps 44 s, and the 14 primes 5.1 minutes. 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Prime. Which prime the cycle opens with: 1 is 13, 2 is 17, and so on to 13, which is 113. After 113 the cycle comes round to 5, whose windmill (1, 1, 1) is a plus that both maps leave alone, then 13 again. The walks are 2, 4, 4, 6, 10, 6, 10, 20, 20, 26, 10, 16 and 22 steps long, and for each of these primes the walk passes through every windmill of p, 3 for 13 and 23 for 113.
// Knob 4: Zoom. 1 to 2.5 times the size that fits the windmill into the top 64 rows, which is 8 LEDs a cell for small windmills and 1 LED for the plus of 113, 57 cells across; at most 14 LEDs a cell. Turned up, the central square and the roots of the sails fill the top, where Zagier's map makes its cut, and the long sails run off the edges.

const W = 64, H = 128;
const { floor, min, max, abs, cos, sin, atan2, round, log, PI, SQRT2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// The primes one more than a multiple of four whose first windmill, a plus
// sign (p + 1) / 2 cells across, fits the 64 columns.
const PR = [5, 13, 17, 29, 37, 41, 53, 61, 73, 89, 97, 101, 109, 113];
// Seconds at Speed 2: the first windmill grows, each step of the walk
// moves and holds, then the pause, the slide into two squares, the show
// and the fade.
const GROW = 0.8, STEP = 1.0, HOLD = 0.5, PAUSE = 0.4, SLIDE = 1.4, SHOW = 2.0, FADE = 0.6;
// The plot of sail sizes: y across from column 3, z up from row 126.
const PX = 3, PY = 126, PS = 58;

// Zagier's involution on x^2 + 4yz = p, and which of its three cases ran.
function zag(x, y, z) {
  if (x < y - z) return [x + 2 * z, z, y - x - z, 1];
  if (x < 2 * y) return [2 * y - x, y, x - y + z, 2];
  return [x - 2 * y, x - y + z, y, 3];
}

// The walk for p: from Zagier's fixed point (1, 1, (p - 1) / 4), swap and
// Zagier's map in turn until the swap would fix the windmill (y = z). Each
// windmill keeps a turning sense: Zagier's middle case keeps the outline of
// the mirror image, so it flips the sense, and the outline then stays put.
function plan(p) {
  const k = (p - 1) / 4, path = [[1, 1, k, 1]];
  for (let t = path[0]; t[1] !== t[2]; ) {
    t = [t[0], t[2], t[1], t[3]];
    path.push(t);
    if (t[1] === t[2]) break;
    const z = zag(t[0], t[1], t[2]);
    t = [z[0], z[1], z[2], z[3] === 2 ? -t[3] : t[3]];
    path.push(t);
  }
  const S = [];
  for (let x = 1; x * x < p; x += 2) {
    const m = (p - x * x) / 4;
    for (let y = 1; y <= m; y++) if (m % y === 0) S.push([x, y, m / y]);
  }
  const n = path.length - 1, end = GROW + n * (STEP + HOLD);
  const lm = [];
  for (let x = 1; x * x < p; x += 2) lm.push(log((p - x * x) / 4));
  return { p, k, path, S, n, lm, end, total: end + PAUSE + SLIDE + SHOW + FADE };
}

// The five pieces of a windmill, each as a rectangle (centre u, centre v,
// half width, half height, turn) in cells about the centre of its square:
// the square, then the sails on its top, right, bottom and left. Each sail
// is y cells along its side, starting from a corner, and z cells out. A
// turning sense of -1 mirrors the windmill.
function mill(x, y, z, h, out) {
  const c = x / 2;
  const R = [[-c, c, -c, c], [-c, -c + y, c, c + z], [c, c + z, c - y, c], [c - y, c, -c - z, -c], [-c - z, -c, -c, -c + y]];
  for (let i = 0; i < 5; i++) {
    const r = R[i], o = i * 5;
    out[o] = (h * (r[0] + r[1])) / 2;
    out[o + 1] = (r[2] + r[3]) / 2;
    out[o + 2] = (r[1] - r[0]) / 2;
    out[o + 3] = (r[3] - r[2]) / 2;
    out[o + 4] = 0;
  }
  return out;
}
// The windmill with square sails as the squares x^2 and (2y)^2, side by
// side and one cell apart, its four sails the quarters of the second.
function squares(x, y, out) {
  const c = x / 2, L = -c - y, B = -c - floor((max(x, 2 * y) - x) / 2), R = L + x + 1;
  const Q = [[L + c, B + c, c], [R + y / 2, B + 1.5 * y, y / 2], [R + 1.5 * y, B + 1.5 * y, y / 2], [R + 1.5 * y, B + y / 2, y / 2], [R + y / 2, B + y / 2, y / 2]];
  for (let i = 0; i < 5; i++) {
    const o = i * 5;
    (out[o] = Q[i][0]), (out[o + 1] = Q[i][1]), (out[o + 2] = out[o + 3] = Q[i][2]), (out[o + 4] = 0);
  }
  return out;
}
const span = (t) => max(t[0] + 2 * t[2], 2 * t[1] - t[0]);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    t: 0, clock: 0, idx: -1, first: -1, hue: -1, rate: 1, zoom: 1, P: null,
    ra: new Float32Array(25), rb: new Float32Array(25), pal: new Float32Array(24),
    buf: new Float32Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const first = round(cl(kv[2], 1, 13));
  s.rate = cl(kv[1], 0.2, 3) / 2;
  s.zoom = 1 + 1.5 * cl(kv[3], 0, 1);
  const hue = cl(kv[0], 0, 1);
  if (hue !== s.hue) {
    // The square pale gold, the sails green, cyan, blue and violet.
    s.hue = hue;
    hsv(0.13 + hue, 0.3, 1, s.pal, 0);
    [0.36, 0.5, 0.63, 0.79].forEach((h, i) => hsv(h + hue, 0.78, 1, s.pal, 3 + i * 3));
    hsv(0.6 + hue, 0.25, 1, s.pal, 15);
    hsv(0.12 + hue, 0.55, 1, s.pal, 18);
  }
  if (first !== s.first) (s.first = first), (s.idx = first), (s.P = plan(PR[first])), (s.t = 0);
  s.t += d * s.rate;
  s.clock += d * s.rate;
  if (s.t >= s.P.total) (s.t -= s.P.total), (s.idx = (s.idx + 1) % PR.length), (s.P = plan(PR[s.idx]));
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.P) return;
  const P = s.P, B = s.buf, pal = s.pal, t = s.t;
  B.fill(0);
  const add = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    B[o] = max(B[o], r);
    B[o + 1] = max(B[o + 1], g);
    B[o + 2] = max(B[o + 2], b);
  };
  // Where the walk is: step i moving with progress e, or the end.
  let i = 0, e = 0, grow = 1, slide = 0, fade = 1;
  if (t < GROW) grow = ease(t / GROW);
  else if (t < P.end) {
    const u = (t - GROW) / (STEP + HOLD);
    i = floor(u) + 1;
    e = ease(((u - floor(u)) * (STEP + HOLD)) / STEP);
  } else {
    i = P.n;
    slide = ease((t - P.end - PAUSE) / SLIDE);
    fade = 1 - ease((t - P.end - PAUSE - SLIDE - SHOW) / FADE);
  }
  const a = P.path[max(0, i - 1)], b = P.path[i];
  const ra = s.ra, rb = s.rb;
  // The pieces this frame: ra, and for a step of Zagier's map the new
  // pieces rb, cut in as a square that spreads out from the centre.
  let cut = -1, fit;
  if (t < GROW) mill(1, 1, P.k * grow, 1, ra), (fit = span(b));
  else if (t < P.end && i % 2 === 1) {
    // The swap: every sail turns a quarter about its middle, the way the
    // windmill turns, while its middle slides to where the turned sail
    // belongs: y cells along and z out become z along and y out.
    mill(a[0], a[1], a[2], a[3], ra);
    mill(b[0], b[1], b[2], b[3], rb);
    for (let j = 5; j < 25; j += 5) {
      ra[j] += (rb[j] - ra[j]) * e;
      ra[j + 1] += (rb[j + 1] - ra[j + 1]) * e;
      ra[j + 4] = (e * PI * a[3]) / 2;
    }
    fit = span(a) + (span(b) - span(a)) * e;
  } else if (t < P.end) {
    mill(a[0], a[1], a[2], a[3], ra);
    mill(b[0], b[1], b[2], b[3], rb);
    cut = e * (span(a) / 2 + 1);
    fit = span(a) + (span(b) - span(a)) * e;
  } else {
    mill(b[0], b[1], b[2], b[3], ra);
    squares(b[0], b[1], rb);
    for (let j = 0; j < 25; j++) ra[j] += (rb[j] - ra[j]) * slide;
    fit = span(b) + (b[0] + 1 + 2 * b[1] - span(b)) * slide;
  }
  const cs = min(14, min(8, 58 / fit) * s.zoom), light = s.clock * 1.6 * b[3];
  // Which piece an LED falls in, leaving its place in that piece in lu, lv
  // (cells from the piece's corner) for the ruling of the cells.
  let lu = 0, lv = 0;
  const piece = (R, U, V) => {
    for (let j = 0; j < 5; j++) {
      const o = j * 5, an = R[o + 4];
      let du = U - R[o], dv = V - R[o + 1];
      if (an !== 0) {
        const c = cos(an), sn = sin(an), t0 = c * du + sn * dv;
        (dv = c * dv - sn * du), (du = t0);
      }
      if (abs(du) < R[o + 2] && abs(dv) < R[o + 3]) return (lu = du + R[o + 2]), (lv = dv + R[o + 3]), j;
    }
    return -1;
  };
  // The top: the windmill on squared paper, one ruled line a cell, or
  // every 2 or 4 cells when cells are small.
  const step = cs >= 3 ? 1 : cs >= 1.5 ? 2 : 4;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < W; x++) {
      const U = (x + 0.5 - 31.5) / cs, V = (31.5 - (y + 0.5)) / cs;
      const j = cut >= 0 && max(abs(U), abs(V)) < cut ? piece(rb, U, V) : piece(ra, U, V);
      if (j < 0) {
        const gu = U - 0.5, gv = V - 0.5, nu = round(gu / step) * step, nv = round(gv / step) * step;
        if (abs(gu - nu) * cs < 0.5 || abs(gv - nv) * cs < 0.5) add(x, y, (0.05 + 0.13 * pal[12]) * fade, (0.05 + 0.13 * pal[13]) * fade, (0.05 + 0.13 * pal[14]) * fade);
        continue;
      }
      // A light turns round the windmill the way its sails turn.
      let k = (0.8 + 0.2 * cos(atan2(V, U) - light)) * fade;
      if (cs >= 3.5 && ((lu - floor(lu)) * cs < 1 || (lv - floor(lv)) * cs < 1)) k *= 0.62;
      // The front of the new central square as it spreads.
      if (cut >= 0 && abs(max(abs(U), abs(V)) - cut) * cs < 0.8) k = 1;
      add(x, y, pal[j * 3] * k, pal[j * 3 + 1] * k, pal[j * 3 + 2] * k);
    }

  // The bottom: the plane of sail sizes, log y across and log z up. Every
  // windmill of p lies on the hyperbola yz = (p - x^2) / 4 of its square's
  // side x, which these axes draw as a straight line; the swap keeps x, so
  // it slides a windmill along its own line, mirrored in the diagonal
  // y = z, and Zagier's map jumps from line to line.
  const lo = log(0.7), sc = PS / (log(P.k / 0.7) - lo), f2 = fade * min(1, t / GROW + 0.2);
  const cur = t < P.end && e < 0.5 ? a : b, R2 = SQRT2;
  for (let y = PY - PS; y < PY; y++)
    for (let x = PX; x < PX + PS; x++) {
      const lY = lo + (x + 0.5 - PX) / sc, lZ = lo + (PY - (y + 0.5)) / sc, q = lY + lZ;
      let band = 0, hc = 0;
      for (let j = 0; j < P.lm.length; j++) {
        if (q <= P.lm[j]) band = j + 1;
        if ((abs(q - P.lm[j]) * sc) / R2 < 0.6) hc = 2 * j + 1;
      }
      // Below the outer line the bands between the lines, tinted with the
      // sail colours, rippling along the lines in towards the diagonal.
      if (band) {
        const c = band & 1 ? 9 : 12, k = (0.15 + 0.06 * cos(abs(lY - lZ) * sc * 0.55 + s.clock * 3)) * f2;
        add(x, y, pal[c] * k, pal[c + 1] * k, pal[c + 2] * k);
      }
      if ((abs(lY - lZ) * sc) / R2 < 0.6) add(x, y, 0.3 * f2, 0.3 * f2, 0.34 * f2);
      if (hc) {
        const k = (hc === cur[0] ? 0.8 : 0.34) * f2;
        add(x, y, pal[18] * k, pal[19] * k, pal[20] * k);
      }
    }
  // The walk so far, segment by segment, the swaps in pale blue and
  // Zagier's steps in gold, then the windmills of p as dots: grey until the
  // walk reaches them, gold after, the one shown above white.
  const at = (tr) => [PX + (log(tr[1]) - lo) * sc, PY - (log(tr[2]) - lo) * sc];
  const segs = t < GROW ? 0 : t < P.end ? i : P.n;
  for (let j = 1; j <= segs; j++) {
    const [x0, y0] = at(P.path[j - 1]), [x1, y1] = at(P.path[j]);
    const reach = j === i && t < P.end ? e : 1, n = max(1, round(max(abs(x1 - x0), abs(y1 - y0)) * reach));
    const c = j % 2 ? 15 : 18, k = 0.9 * fade;
    for (let q = 0; q <= n; q++) {
      const u = (q / n) * reach;
      add(floor(x0 + (x1 - x0) * u), floor(y0 + (y1 - y0) * u), pal[c] * k, pal[c + 1] * k, pal[c + 2] * k);
    }
  }
  const rad = cl(sc * 0.12, 0.8, 3), pulse = 0.75 + 0.25 * cos(s.clock * 7);
  for (const tr of P.S) {
    const [cx, cy] = at(tr);
    let seen = false;
    for (let q = 0; q <= segs; q++) if (P.path[q][0] === tr[0] && P.path[q][1] === tr[1] && P.path[q][2] === tr[2]) seen = true;
    const now = tr[0] === cur[0] && tr[1] === cur[1] && tr[2] === cur[2];
    const k = (now ? pulse : seen ? 0.9 : 0.45) * f2, r = now ? 1 : seen ? pal[18] : 0.8, g = now ? 1 : seen ? pal[19] : 0.8, bl = now ? 1 : seen ? pal[20] : 0.85;
    for (let yy = floor(cy - rad); yy <= cy + rad; yy++)
      for (let xx = floor(cx - rad); xx <= cx + rad; xx++)
        if ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= rad * rad + 0.3) add(xx, yy, r * k, g * k, bl * k);
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, min(255, round(B[o] * 255)), min(255, round(B[o + 1] * 255)), min(255, round(B[o + 2] * 255)));
}
