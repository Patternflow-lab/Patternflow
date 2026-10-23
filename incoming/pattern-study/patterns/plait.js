// ===== Patternflow pattern =====
// Title:   Plait
// Family:  textile
// Idea:    Coloured strands hang from a clip and are plaited down the panel, the outside strand crossing over to the middle each time, until the plait is tied off with a ribbon and lowered away, and the next clip of loose strands comes down.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 13
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Strands=3..7, Tension=0..1
//
// Knob 1: Hue. Turns the strands' colours together, starting from teal, blue and magenta.
// Knob 2: Speed. How fast the hands work: at 2 the plait grows by 1.2 rows of crossings a second, at 3 by nearly two, at 0.2 by one every eight seconds.
// Knob 3: Strands. 3 is the plait everyone knows; 4 to 7 make a flat braid, each outside strand weaving over and under all the way to the far edge.
// Knob 4: Tension. At 0 the plait is loose and fat, 54 LEDs across with three strands crossing every 17 rows; at 1 it is pulled tight to 34 LEDs, crossing every 6 or 7.
// Buttons: K1 tap ties the plait off with a ribbon where it has got to, long tails and all; it is lowered away and a new one starts.

const W = 64;
const H = 128;
const MAXN = 7;
// The clip holds the strands at rows 1..6; the plait starts under it.
const CLIP = 7;
// The plait is tied once its point gets this far down.
const TIE_AT = 100;
// Seconds a tied plait hangs, and the seconds it takes to lower it away.
const HANG = 1.6;
const LOWER = 1.4;
// Crossings a second at Speed 1.
const RATE = 0.6;
// A tied plait is pinched to this share of its width at the ribbon.
const GATHER = 0.4;

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// A strand's lane on a cycle of 2N steps: it walks one lane a step from the
// left edge to the right, waits a step there, walks back and waits again.
// Spaced two steps apart, N strands always fill the N lanes, and between two
// whole steps a strand walking right swaps lanes with one walking left.
function laneAt(q, n) {
  if (q <= n - 1) return q;
  if (q <= n) return n - 1;
  if (q <= 2 * n - 1) return 2 * n - 1 - q;
  return 0;
}

// The integral of laneAt, so the lane can be averaged over one step and the
// strand turns round at the edges instead of folding.
function laneInt(q, n) {
  const c = 2 * n;
  const m = n - 1;
  const total = m * m + m;
  const k = Math.floor(q / c);
  const r = q - k * c;
  let f;
  if (r <= m) f = (r * r) / 2;
  else if (r <= n) f = (m * m) / 2 + m * (r - m);
  else if (r <= 2 * n - 1) f = (m * m) / 2 + m + (2 * n - 1) * (r - n) - (r * r - n * n) / 2;
  else f = total;
  return k * total + f;
}

// Lane, its slope in lanes per step, and depth for strand k at step t.
// Crossings fall on half steps. At a crossing after an even step the strand
// walking right is on top, after an odd step the one walking left, so every
// strand goes over, under, over, and for three strands the outside strand
// always crosses over the middle one.
function strandAt(k, t, n, out) {
  const c = 2 * n;
  const q = 2 * k + t;
  out[0] = laneInt(q + 0.5, n) - laneInt(q - 0.5, n);
  const qa = (((q + 0.5) % c) + c) % c;
  const qb = (((q - 0.5) % c) + c) % c;
  out[1] = laneAt(qa, n) - laneAt(qb, n);
  const r = ((q % c) + c) % c;
  const wave = Math.cos(Math.PI * (t - 0.5));
  out[2] = r < n - 1 ? wave : r >= n && r < 2 * n - 1 ? -wave : 0;
}

export function setup(params) {
  params.t = 0;
  params.phase = 0; // 0 plaiting, 1 tied and hanging, 2 lowered away
  params.timer = 0;
  params.tiedT = 0;
  params.started = false;
  params.n = 3;
  params.hue = 0;
  params.speed = 2;
  params.tension = 0.06;
  // Each strand's centre row by row: x, depth, the nudge from a row to the
  // nearest point (slope / (1 + slope^2)) and radius, radius 0 where the strand
  // is absent; lo..hi is the span of LEDs it can reach in that row.
  params.cx = new Float32Array(MAXN * H);
  params.cz = new Float32Array(MAXN * H);
  params.cs = new Float32Array(MAXN * H);
  params.cr = new Float32Array(MAXN * H);
  params.lo = new Float32Array(MAXN * H);
  params.hi = new Float32Array(MAXN * H);
  params.dist = new Float32Array(MAXN);
  params.surf = new Float32Array(MAXN);
  params.col = new Float32Array(MAXN * 3 + 3);
  params.tmp = new Float32Array(3);
  params.img = new Float32Array(W * H * 3);
  params.out = new Float32Array(W * H * 3);
  // The tied plait and the next one, drawn once each while one replaces the other.
  params.old = new Float32Array(W * H * 3);
  params.next = new Float32Array(W * H * 3);
  params.valid = 0;
  params.cn = -1;
  params.zbuf = new Float32Array(W * H);
}

// The plait's shape for the current knobs.
function geometry(params) {
  const n = params.n;
  const tension = params.tension;
  // Half the plait's width, from 27 LEDs loose to 17 tight.
  const half = 27 - 10 * tension;
  const lane = (2 * half) / (n - 1 + 1.4);
  return {
    n: n,
    lane: lane,
    radius: lane * 0.7,
    step: lane * (1.1 - 0.45 * tension),
    spread: (W - 4 - 1.4 * lane * 0.7) / (n - 1),
  };
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = Math.min(dt, 0.1);
  params.hue = k[0];
  params.speed = Math.max(0.05, k[1]);
  params.n = Math.max(3, Math.min(MAXN, Math.round(k[2])));
  params.tension = Math.max(0, Math.min(1, k[3]));
  const g = geometry(params);
  if (!params.started) {
    params.started = true;
    // Start part way down, so the first frame already shows a plait.
    params.t = (44 - CLIP) / g.step;
  }
  if (input.btnPressed && input.btnPressed[0] && params.phase === 0) {
    params.phase = 1;
    params.timer = 0;
  }
  if (params.phase === 0) {
    params.t += dt * params.speed * RATE;
    if (CLIP + params.t * g.step >= TIE_AT) {
      params.phase = 1;
      params.timer = 0;
    }
  } else if (params.phase === 1) {
    params.timer += dt;
    if (params.timer > HANG) {
      params.phase = 2;
      params.timer = 0;
      params.tiedT = params.t;
      params.t = 0;
    }
  } else {
    params.timer += dt;
    if (params.timer > LOWER) {
      params.phase = 0;
      params.timer = 0;
    }
  }
}

// Lay out each strand's centre line, row by row, for a plait whose point is at
// step tp, its clip shifted down by off rows; tied (0..1) is how far the
// ribbon has pulled its end in.
function layout(params, g, tp, off, tied) {
  const n = g.n;
  const mid = W / 2;
  const tmp = params.tmp;
  const cx = params.cx;
  const cz = params.cz;
  const cs = params.cs;
  const cr = params.cr;
  const depth = g.radius * 0.9;
  const yp = CLIP + tp * g.step;
  // The tails get shorter as the plait uses up the strands.
  const prog = Math.min(1, (yp - CLIP) / (TIE_AT - CLIP));
  const tailEnd = yp + (H - 1 - CLIP) * (1 - prog) + (20 - 4 * tied) * prog;
  const reach = 26 - 16 * tied;
  for (let k = 0; k < n; k++) {
    // Where the strand leaves the plait, which way it is going there, and how
    // deep it lies: it keeps that depth all the way down, so a strand crossing
    // over stays over to the hand.
    strandAt(k, tp, n, tmp);
    const c0 = tmp[0] - (n - 1) / 2;
    const pinch = 1 - (1 - GATHER) * tied;
    const x0 = mid + c0 * g.lane * pinch;
    const s0 = ((1 - tied) * tmp[1] * g.lane) / g.step;
    const z0 = tmp[2] * depth + k * 0.01;
    const x1 = (x0 + c0 * 4) * tied + (mid + c0 * g.spread) * (1 - tied);
    for (let y = 0; y < H; y++) {
      const i = k * H + y;
      const yy = y + 0.5 - off;
      cr[i] = 0;
      if (yy < 2) continue;
      let sl = 0;
      if (yy < CLIP) {
        // Under the clip the strands come straight down.
        strandAt(k, 0, n, tmp);
        cx[i] = mid + (tmp[0] - (n - 1) / 2) * g.lane;
        cz[i] = -depth;
        cr[i] = g.radius;
      } else if (yy <= yp) {
        strandAt(k, (yy - CLIP) / g.step, n, tmp);
        // A tied plait is gathered in to the ribbon over its last 14 rows.
        const gather = 1 - (1 - GATHER) * tied * smooth(yp - 14, yp, yy);
        cx[i] = mid + (tmp[0] - (n - 1) / 2) * g.lane * gather;
        cz[i] = tmp[2] * depth;
        sl = (tmp[1] * g.lane * gather) / g.step;
        cr[i] = g.radius;
      } else if (yy < tailEnd) {
        // Below the point a loose strand leaves the way it was going and bends
        // down to the hand holding it; a tied plait's tails splay a little.
        const u = Math.min(1, (yy - yp) / reach);
        const u2 = u * u;
        const u3 = u2 * u;
        cx[i] = (2 * u3 - 3 * u2 + 1) * x0 + (u3 - 2 * u2 + u) * reach * s0 + (3 * u2 - 2 * u3) * x1;
        sl = u < 1 ? ((6 * u2 - 6 * u) * x0 + (3 * u2 - 4 * u + 1) * reach * s0 + (6 * u - 6 * u2) * x1) / reach : 0;
        cz[i] = z0;
        // A strand thins to its tip over the last eight rows.
        const tip = Math.min(1, (tailEnd - yy) / 8);
        cr[i] = g.radius * (1 - 0.25 * tied) * (0.45 + 0.55 * Math.sqrt(tip));
      }
      cs[i] = sl / (1 + sl * sl);
    }
  }
  // The span of LEDs each strand can touch in each row: an LED within the
  // radius of a strand finds its nearest point at most half a radius up or down.
  const lo = params.lo;
  const hi = params.hi;
  const rows = Math.ceil(g.radius / 2 + 2);
  for (let k = 0; k < n; k++)
    for (let y = 0; y < H; y++) {
      let a = 1e9;
      let b = -1e9;
      const j1 = Math.min(H - 1, y + rows);
      for (let j = Math.max(0, y - rows); j <= j1; j++) {
        const i = k * H + j;
        if (cr[i] === 0) continue;
        if (cx[i] - cr[i] < a) a = cx[i] - cr[i];
        if (cx[i] + cr[i] > b) b = cx[i] + cr[i];
      }
      lo[k * H + y] = a - 2.5;
      hi[k * H + y] = b + 2.5;
    }
}

// Render the laid-out strands into img and zbuf from row y0 down. For each LED
// and strand, step from the LED's row
// along the strand's slope to the nearest point of its centre line, so where
// one strand dives under another the edge follows the strand and not the row.
function render(params, g, y0) {
  const n = g.n;
  const cx = params.cx;
  const cz = params.cz;
  const cs = params.cs;
  const cr = params.cr;
  const lo = params.lo;
  const hi = params.hi;
  const col = params.col;
  const img = params.img;
  const zbuf = params.zbuf;
  const dist = params.dist;
  const surf = params.surf;
  const depth = g.radius * 0.9;
  const hl = Math.sqrt(0.45 * 0.45 + 0.5 * 0.5 + 1.74 * 1.74);
  for (let y = y0; y < H; y++) {
    const py = y + 0.5;
    let xa = 1e9;
    let xb = -1e9;
    for (let k = 0; k < n; k++) {
      if (lo[k * H + y] < xa) xa = lo[k * H + y];
      if (hi[k * H + y] > xb) xb = hi[k * H + y];
    }
    xa = Math.max(0, Math.floor(xa));
    xb = Math.min(W - 1, Math.ceil(xb));
    for (let x = xa; x <= xb; x++) {
      const p = y * W + x;
      const px = x + 0.5;
      let best = -1e9;
      let bk = -1;
      let bnx = 0;
      let bny = 0;
      let bz = 0;
      let bcov = 0;
      for (let k = 0; k < n; k++) {
        const i0 = k * H + y;
        dist[k] = 1e9;
        if (px < lo[i0] || px > hi[i0]) continue;
        let ys = cr[i0] > 0 ? py + (px - cx[i0]) * cs[i0] : py;
        if (ys < 0.5) ys = 0.5;
        else if (ys > H - 1.5) ys = H - 1.5;
        const ya = Math.floor(ys - 0.5);
        const f = ys - 0.5 - ya;
        const ia = k * H + ya;
        const ra = cr[ia];
        const rb = cr[ia + 1];
        let xs;
        let zs;
        let rs;
        if (rb === 0) {
          if (ra === 0) continue;
          xs = cx[ia];
          zs = cz[ia];
          rs = ra;
          ys = ya + 0.5;
        } else if (ra === 0) {
          xs = cx[ia + 1];
          zs = cz[ia + 1];
          rs = rb;
          ys = ya + 1.5;
        } else {
          xs = cx[ia] + (cx[ia + 1] - cx[ia]) * f;
          zs = cz[ia] + (cz[ia + 1] - cz[ia]) * f;
          rs = ra + (rb - ra) * f;
        }
        const dx = px - xs;
        const dy = py - ys;
        const d2 = dx * dx + dy * dy;
        if (d2 > (rs + 2) * (rs + 2)) continue;
        const d = Math.sqrt(d2);
        dist[k] = d - rs;
        if (d >= rs) {
          surf[k] = zs;
          if (d < rs + 0.5 && zs > best) {
            best = zs;
            bk = k;
            bnx = dx / d;
            bny = dy / d;
            bz = zs / depth;
            bcov = rs + 0.5 - d;
          }
          continue;
        }
        surf[k] = zs + Math.sqrt(rs * rs - d * d);
        if (surf[k] > best) {
          best = surf[k];
          bk = k;
          bnx = dx / rs;
          bny = dy / rs;
          bz = zs / depth;
          bcov = Math.min(1, rs + 0.5 - d);
        }
      }
      if (bk < 0) continue;
      // A strand lying over this one darkens the LEDs just outside its edge,
      // so a strand going under reads as tucked in.
      let shade = 1;
      for (let k = 0; k < n; k++) {
        if (k === bk || dist[k] > 2 || dist[k] < -0.5) continue;
        if (surf[k] > best - 1) shade = Math.min(shade, 0.12 + 0.88 * smooth(0, 2, dist[k]));
      }
      const nn = Math.min(1, bnx * bnx + bny * bny);
      const nz = Math.sqrt(1 - nn);
      // Light from the upper left and in front.
      // The square root flattens the lit middle of a strand and keeps its
      // fall-off for the rim, so it reads as round without a smear of greys.
      const diff = Math.sqrt(Math.max(0, -0.45 * bnx - 0.5 * bny + 0.74 * nz));
      let sp = Math.max(0, (-0.45 * bnx - 0.5 * bny + 1.74 * nz) / hl);
      sp *= sp;
      sp *= sp;
      sp *= sp;
      sp *= sp;
      // Under, a strand is dimmer; over, it is lit full. The floor stays high
      // enough that an orange strand going under does not turn brown.
      const lit = (0.56 + 0.44 * (0.5 + 0.5 * bz)) * shade;
      const v = lit * (0.14 + 0.86 * diff);
      const spec = sp * 0.5 * lit * 255;
      const c = bk * 3;
      const o = p * 3;
      img[o] = img[o] * (1 - bcov) + Math.min(255, col[c] * v + spec) * bcov;
      img[o + 1] = img[o + 1] * (1 - bcov) + Math.min(255, col[c + 1] * v + spec) * bcov;
      img[o + 2] = img[o + 2] * (1 - bcov) + Math.min(255, col[c + 2] * v + spec) * bcov;
      zbuf[p] = best;
    }
  }
}

// A ribbon tied in a bow round the plait at row yp, grown to size (0..1):
// a band round the gathered strands, two loops, a knot and two tails cut in a fork.
function ribbon(img, params, yp, band, size) {
  if (size <= 0) return;
  const col = params.col;
  const c = MAXN * 3;
  const cx = W / 2;
  const lw = 12 * size;
  const lh = 6 * size;
  const ca = Math.cos(0.42);
  const sa = Math.sin(0.42);
  for (let y = Math.max(0, Math.floor(yp - 14)); y < Math.min(H, yp + 20); y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - yp;
      let v = 0;
      // The band round the plait.
      if (Math.abs(py) < 1.8 && Math.abs(px) < band * size) v = 0.85 - 0.12 * Math.max(0, py);
      // The loops, tilted up and out, with a fold darker along the middle.
      for (let s = -1; s <= 1; s += 2) {
        const lx = s * px - lw * 0.55;
        const ly = py + 2.5 * size;
        const u = (lx * ca + ly * sa) / lw;
        const w = (-lx * sa + ly * ca) / lh;
        const e = (u * u) / 0.3 + w * w;
        if (e < 1) v = Math.max(v, Math.abs(w) < 0.18 && u > -0.2 ? 0.72 : 1 - 0.18 * e);
      }
      // The tails, hanging down and out from the knot, forked at the end.
      for (let s = -1; s <= 1; s += 2) {
        const along = py / size;
        const off = s * px - (1.5 + py * 0.42);
        if (along > 0 && along < 15 && Math.abs(off) < 2.4 && !(along > 12 && Math.abs(off) < (along - 12) * 0.9)) v = Math.max(v, 0.95 - 0.2 * (along / 15));
      }
      // The knot.
      const kr = px * px + (py + 0.3) * (py + 0.3);
      if (kr < 10 * size * size) v = Math.max(v, 1);
      else if (kr < 14 * size * size) v = Math.min(v, 0.75);
      if (v <= 0) continue;
      const o = (y * W + x) * 3;
      img[o] = col[c] * v;
      img[o + 1] = col[c + 1] * v;
      img[o + 2] = col[c + 2] * v;
    }
}

// The clip at the top, a rounded silver bar a little wider than the plait,
// shifted down by off rows, drawn from row y0 down.
function clip(params, half, off, y0) {
  const img = params.img;
  for (let j = 1; j < CLIP; j++) {
    const y = j + Math.round(off);
    if (y < y0 || y >= H) continue;
    const u = (j + 0.5 - (CLIP + 1) / 2) / ((CLIP - 1) / 2);
    const v = 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - u * u)) + (Math.abs(u + 0.35) < 0.3 ? 0.25 : 0);
    for (let x = 0; x < W; x++) {
      const ex = Math.abs(x + 0.5 - W / 2) - (half + 2);
      if (ex > 1) continue;
      const a = Math.max(0, Math.min(1, 1 - ex)) * (j === 1 || j === CLIP - 1 ? 0.75 : 1);
      const o = (y * W + x) * 3;
      img[o] = img[o] * (1 - a) + Math.min(255, 215 * v) * a;
      img[o + 1] = img[o + 1] * (1 - a) + Math.min(255, 220 * v) * a;
      img[o + 2] = img[o + 2] * (1 - a) + Math.min(255, 232 * v) * a;
    }
  }
}

// Copy src into out moved down by off rows, blending neighbouring rows for the
// fraction. On top, src covers out where it is lit and lets it through where dark.
function slide(out, src, off, top) {
  const fo = Math.floor(off);
  const fr = off - fo;
  for (let y = 0; y < H; y++) {
    const ya = y - fo;
    const yb = ya - 1;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r = 0;
      let g = 0;
      let b = 0;
      let cov = 0;
      if (ya >= 0 && ya < H) {
        const a = (ya * W + x) * 3;
        r += src[a] * (1 - fr);
        g += src[a + 1] * (1 - fr);
        b += src[a + 2] * (1 - fr);
        if (src[a] + src[a + 1] + src[a + 2] > 0) cov += 1 - fr;
      }
      if (yb >= 0 && yb < H) {
        const a = (yb * W + x) * 3;
        r += src[a] * fr;
        g += src[a + 1] * fr;
        b += src[a + 2] * fr;
        if (src[a] + src[a + 1] + src[a + 2] > 0) cov += fr;
      }
      if (!top) cov = 1;
      out[o] = r + out[o] * (1 - cov);
      out[o + 1] = g + out[o + 1] * (1 - cov);
      out[o + 2] = b + out[o + 2] * (1 - cov);
    }
  }
}

export function draw(display, params, time) {
  const g = geometry(params);
  const col = params.col;
  const hue = params.hue + 0.47;
  const fan = (0.62 * (g.n - 1)) / g.n;
  for (let k = 0; k < g.n; k++) hsvInto(col, k * 3, hue + (k * 0.62) / g.n, 0.78, 1);
  // The ribbon takes the colour in the middle of the gap the strands leave on the wheel.
  hsvInto(col, MAXN * 3, hue + fan + (1 - fan) / 2 - 0.04, 0.68, 1);
  const half = ((g.n - 1) * g.lane) / 2 + g.radius;
  // Half the width of the gathered end, where the ribbon's band goes round.
  const band = ((g.n - 1) * g.lane * GATHER) / 2 + g.radius * 0.9;
  const img = params.img;
  const zbuf = params.zbuf;
  const phase = params.phase;
  // While the knobs stay put, the plait above its point does not change, so
  // the rows that were finished last frame are kept and only the rest drawn.
  const same = params.cn === g.n && params.ct === params.tension && params.ch === params.hue && params.cp === phase;
  let y0 = same ? params.valid : 0;
  params.cn = g.n;
  params.ct = params.tension;
  params.ch = params.hue;
  params.cp = phase;
  let out = img;
  if (phase === 2) {
    // The tied plait is lowered out of sight on its clip and the next clip of
    // loose strands comes down after it. Neither changes shape on the way, so
    // each is drawn once and slid down a fraction of a row at a time.
    if (!same) {
      img.fill(0);
      zbuf.fill(-1e9);
      layout(params, g, params.tiedT, 0, 1);
      render(params, g, 0);
      clip(params, half, 0, 0);
      ribbon(img, params, CLIP + params.tiedT * g.step, band, 1);
      params.old.set(img);
      img.fill(0);
      zbuf.fill(-1e9);
      layout(params, g, 0, 0, 0);
      render(params, g, 0);
      clip(params, half, 0, 0);
      params.next.set(img);
    }
    const off = smooth(0, 1, params.timer / LOWER) * (H + 4);
    out = params.out;
    slide(out, params.next, off - H - 4, false);
    slide(out, params.old, off, true);
    params.valid = 0;
  } else {
    img.fill(0, y0 * W * 3);
    zbuf.fill(-1e9, y0 * W);
    const yp = CLIP + params.t * g.step;
    if (y0 < H) {
      layout(params, g, params.t, 0, phase === 1 ? smooth(0, 0.35, params.timer) : 0);
      render(params, g, y0);
      clip(params, half, 0, y0);
    }
    // A hanging plait is still; a growing one is settled down to a radius above its point.
    params.valid = phase === 1 ? (params.timer > 0.4 ? H : Math.floor(yp - 20 - g.radius)) : Math.max(0, Math.floor(yp - g.radius - 4));
    if (phase === 1) {
      out = params.out;
      out.set(img);
      ribbon(out, params, yp, band, smooth(0, 0.35, params.timer));
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      if (out[o] + out[o + 1] + out[o + 2] < 1) continue;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
