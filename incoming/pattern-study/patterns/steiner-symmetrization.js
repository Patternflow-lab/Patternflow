// ===== Patternflow pattern =====
// Title:   Steiner Symmetrization
// Family:  line
// Idea:    An irregular shape drawn as a hatch of parallel one-LED chords slides every chord along itself, each at its own moment so a shear wave runs down the stack, until its midpoint sits on a faint axis and chords cut by a gap close into one, then the hatch turns to a new axis and slides again, while a faint circle marks the disc of the same area and a bar at the foot shrinks the perimeter toward the disc's.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Steiner symmetrization (Jakob Steiner, 1838), repeated symmetrizations converging to the disc (Wilhelm Gross, 1917, after Wilhelm Blaschke's selection theorem in Kreis und Kugel, 1916), symmetrization in a finite set of directions (Daniel Klain, 2012), pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..5, Axes=0..8
//
// Knob 1: Hue. Turns the hatch round the wheel. At 0 the chords run from azure to violet along the axis, with the bar in amber.
// Knob 2: Speed. At 2 a symmetrization takes about 2.1 s: the chords slide for up to 1.4 s, rest 0.2 s and the hatch turns for 0.5 s, and a shape that has come round holds 1.3 s and fades into the next. At 0.2 ten times slower, at 3 two thirds as long.
// Knob 3: Shape. 0 takes the five starting shapes in turn, a crescent, an egg with a hole, a seven pointed star, two blobs and a comb; 1 to 5 start from one of them every time.
// Knob 4: Axes. 0 turns the axis by 68.75 degrees, the golden angle of a half turn, every time, so no axis comes back and the shape rounds into the disc. 1 to 8 use that many axes, evenly spaced and drawn faintly. One axis does all its work in the first slide. With a few the shape settles into one with a mirror for every axis that is still not the disc: with two axes the star stops at 1.24 times the disc's perimeter, with three at 1.03, and from four on it comes within 1%.

const W = 64, H = 128, OX = 32, OY = 64;
const { floor, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Chords one LED apart, s from -72 to 72 along the axis, at most MAXP
// pieces each.
const K = 144, S0 = -72, MAXP = 8, MAXC = 16;
// The golden angle of a half turn, pi (2 - phi) for the golden ratio phi:
// 68.75 degrees, so no two axes are ever the same.
const GOLD = (PI * (3 - sqrt(5))) / 2;
const BAR = 60;

// Shapes as rings of points; a point is inside when a ray from it crosses
// the rings an odd number of times, so a ring inside another is a hole.
function arc(cx, cy, h, b, n, out, back) {
  // A circular arc from (cx, cy - h) to (cx, cy + h) bulging left by b.
  const R = (h * h + b * b) / (2 * b), p0 = Math.asin(h / R), C = cx - b + R;
  for (let i = 0; i <= n; i++) {
    const u = back ? 1 - i / n : i / n, p = -p0 + 2 * p0 * u;
    out.push(C - R * cos(p), cy + R * sin(p));
  }
  return out;
}
function ellipse(cx, cy, rx, ry, n, out) {
  for (let i = 0; i < n; i++) out.push(cx + rx * cos((2 * PI * i) / n), cy + ry * sin((2 * PI * i) / n));
  return out;
}
const SHAPES = [
  // A crescent between two arcs on the same chord.
  () => [arc(52, 64, 56, 12, 40, arc(52, 64, 56, 40, 60, []), true).slice(0, -2)],
  // An egg with a round hole off its centre.
  () => [ellipse(32, 64, 29, 40, 72, []), ellipse(39, 54, 14, 14, 40, [])],
  // A seven pointed star, stretched to the panel.
  () => {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const a = (PI * i) / 7 - PI / 2 + 0.2, r = i % 2 ? 15 : 30;
      out.push(32 + r * cos(a), 64 + 1.55 * r * sin(a));
    }
    return [out];
  },
  // Two blobs apart.
  () => [ellipse(22, 37, 17, 24, 48, []), ellipse(42, 92, 19, 21, 48, [])],
  // A comb of three teeth on a spine.
  () => [[12, 14, 60, 14, 60, 30, 26, 30, 26, 56, 60, 56, 60, 72, 26, 72, 26, 98, 60, 98, 60, 114, 12, 114]],
];

function perimeter(rings) {
  let p = 0;
  for (const r of rings)
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      p += sqrt((r[j] - r[i]) ** 2 + (r[j + 1] - r[i + 1]) ** 2);
    }
  return p;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

export function setup(params) {
  params.s = {
    rings: null, shape: -1, n: 0, phase: 1, pt: 0.5, phi: PI / 2, from: PI / 2, to: PI / 2,
    P0: 1, P: 1, Pfrom: 1, Pto: 1, A: 1, prevP: 1, still: 0, fade: 1, dir: 1,
    cross: new Float64Array(K * MAXC), nc: new Int32Array(K),
    a0: new Float64Array(K * MAXP), b0: new Float64Array(K * MAXP), a1: new Float64Array(K * MAXP), b1: new Float64Array(K * MAXP),
    cnt: new Int32Array(K), L: new Float64Array(K), del: new Float64Array(K), dur: new Float64Array(K), u: new Float64Array(K), sp: new Float64Array(K),
    col: new Float64Array(3), tmp: new Float64Array(3), ax: new Float64Array(16),
    next: null, prog: 0.5, hue: 0.5, axes: 0,
  };
  return params.s;
}

// The pieces of every chord at angle phi: the line s = const through the
// rings, crossings sorted along t and taken in pairs.
function cut(S, phi, a, b, cnt) {
  const { cross, nc } = S, ca = cos(phi), sa = sin(phi);
  nc.fill(0);
  for (const r of S.rings)
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      const x1 = r[i] - OX, y1 = r[i + 1] - OY, x2 = r[j] - OX, y2 = r[j + 1] - OY;
      const s1 = x1 * ca + y1 * sa, s2 = x2 * ca + y2 * sa;
      if (s1 === s2) continue;
      const t1 = -x1 * sa + y1 * ca, t2 = -x2 * sa + y2 * ca;
      const lo = min(s1, s2), hi = max(s1, s2);
      // Chords with lo <= s < hi, so a vertex is counted once. Both ends
      // are tested on the same s, or rounding counts a vertex twice.
      for (let k = max(0, floor(lo - S0 - 0.5)); k < K; k++) {
        const s = S0 + k + 0.5;
        if (s < lo) continue;
        if (s >= hi) break;
        const t = t1 + ((s - s1) / (s2 - s1)) * (t2 - t1);
        let m = nc[k];
        if (m >= MAXC) continue;
        const o = k * MAXC;
        while (m > 0 && cross[o + m - 1] > t) {
          cross[o + m] = cross[o + m - 1];
          m--;
        }
        cross[o + m] = t;
        nc[k]++;
      }
    }
  for (let k = 0; k < K; k++) {
    const n = min(MAXP, nc[k] >> 1), o = k * MAXC;
    cnt[k] = n;
    for (let j = 0; j < n; j++) {
      a[k * MAXP + j] = cross[o + 2 * j];
      b[k * MAXP + j] = cross[o + 2 * j + 1];
    }
  }
}

// The total length of the chord at s, for the ends of the new shape.
function lengthAt(S, phi, s) {
  const ca = cos(phi), sa = sin(phi), ts = [];
  for (const r of S.rings)
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      const x1 = r[i] - OX, y1 = r[i + 1] - OY, x2 = r[j] - OX, y2 = r[j + 1] - OY;
      const s1 = x1 * ca + y1 * sa, s2 = x2 * ca + y2 * sa;
      if (s1 === s2 || s < min(s1, s2) || s >= max(s1, s2)) continue;
      ts.push(-x1 * sa + y1 * ca + ((s - s1) / (s2 - s1)) * (-x2 * sa + y2 * ca + x1 * sa - y1 * ca));
    }
  ts.sort((p, q) => p - q);
  let L = 0;
  for (let i = 0; i + 1 < ts.length; i += 2) L += ts[i + 1] - ts[i];
  return L;
}

// Start a symmetrization about the axis through the centre at angle phi:
// each chord's pieces now, and where they end, stacked in their order into
// one chord centred on the axis. The new shape is a ring through the ends
// of the centred chords for every run of chords that are not empty, so two
// blobs no chord crosses stay two.
function begin(S, phi) {
  const { a0, b0, a1, b1, cnt, L, del, dur, u, sp } = S;
  S.phi = S.from = S.to = phi;
  cut(S, phi, a0, b0, cnt);
  const ca = cos(phi), sa = sin(phi);
  let lo = 1e9, hi = -1e9;
  for (const r of S.rings)
    for (let i = 0; i < r.length; i += 2) {
      const s = (r[i] - OX) * ca + (r[i + 1] - OY) * sa;
      lo = min(lo, s);
      hi = max(hi, s);
    }
  for (let k = 0; k < K; k++) {
    let len = 0;
    for (let j = 0; j < cnt[k]; j++) len += b0[k * MAXP + j] - a0[k * MAXP + j];
    L[k] = len;
    let at = -len / 2;
    for (let j = 0; j < cnt[k]; j++) {
      const o = k * MAXP + j, l = b0[o] - a0[o];
      a1[o] = at;
      b1[o] = at + l;
      at += l;
    }
    // The shear wave runs along the axis, the other way each time.
    const w = cl((S0 + k + 0.5 - lo) / max(1, hi - lo), 0, 1);
    del[k] = 0.45 * (S.dir > 0 ? w : 1 - w) + 0.08 * Math.random();
    dur[k] = 0.7 * (0.8 + 0.4 * Math.random());
    u[k] = 0;
    sp[k] = 0;
  }
  S.dir = -S.dir;
  // Runs of (s, length). A run's open end reaches past its last chord as
  // far as the lengths' slope says, at most to the empty chord beside it.
  const e = 1e-4, runs = [];
  let run = null;
  const end = (r, back) => {
    const n = r.length, l0 = back ? r[n - 1] : r[1], l1 = n > 2 ? (back ? r[n - 3] : r[3]) : 0;
    const d = n > 2 ? min(1, l0 / max(1e-3, l1 - l0)) : 0.5, s = (back ? r[n - 2] : r[0]) + (back ? d : -d);
    if (back) r.push(s, 0);
    else r.unshift(s, 0);
  };
  for (let k = 0; k < K; k++) {
    const s = S0 + k + 0.5;
    if (s <= lo + e || s >= hi - e) continue;
    if (L[k] > 0) {
      if (!run) run = [];
      run.push(s, L[k]);
    } else if (run) {
      end(run, true);
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  if (!runs.length) runs.push([]);
  // The shape's own ends, measured exactly.
  if (runs[0][0] !== undefined && runs[0][1] === 0) runs[0].splice(0, 2);
  runs[0].unshift(lo + e, lengthAt(S, phi, lo + e));
  for (let i = 1; i < runs.length; i++) end(runs[i], false);
  runs[runs.length - 1].push(hi - e, lengthAt(S, phi, hi - e));
  // Keep the area the shape started with: sampling a curved edge at one LED
  // loses a sliver every time, so the lengths are scaled back up.
  let area = 0;
  for (const r of runs) for (let i = 0; i + 3 < r.length; i += 2) area += ((r[i + 2] - r[i]) * (r[i + 1] + r[i + 3])) / 2;
  const f = area > 0 ? S.A / area : 1;
  S.next = runs.map((r) => {
    const ring = [];
    for (let i = 0; i < r.length; i += 2) ring.push(OX + r[i] * ca + ((f * r[i + 1]) / 2) * sa, OY + r[i] * sa - ((f * r[i + 1]) / 2) * ca);
    for (let i = r.length - 2; i >= 0; i -= 2) ring.push(OX + r[i] * ca - ((f * r[i + 1]) / 2) * sa, OY + r[i] * sa + ((f * r[i + 1]) / 2) * ca);
    return ring;
  });
  S.Pfrom = S.P;
  S.Pto = perimeter(S.next);
  S.phase = 0;
  S.pt = 0;
}

function newShape(S, sel) {
  S.shape = sel ? sel - 1 : (S.shape + 1) % SHAPES.length;
  S.rings = SHAPES[S.shape]();
  S.P0 = S.P = S.prevP = perimeter(S.rings);
  S.n = 0;
  S.still = 0;
  S.pt = 0;
  S.phi = S.from = S.to = PI / 2;
  // The area, for the disc's perimeter, from the chords of the first cut.
  cut(S, S.phi, S.a0, S.b0, S.cnt);
  let A = 0;
  for (let k = 0; k < K; k++) for (let j = 0; j < S.cnt[k]; j++) A += S.b0[k * MAXP + j] - S.a0[k * MAXP + j];
  S.A = A;
}

const ease = (x) => x * x * (3 - 2 * x);

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 0.06];
  S.hue = kv[0] || 0;
  const rate = cl(kv[1], 0.2, 3) / 2, sel = cl(Math.round(kv[2]), 0, 5), axes = cl(Math.round(kv[3]), 0, 8);
  S.axes = axes;
  if (!S.rings) newShape(S, sel);
  const d = cl(dt || 0, 0, 0.1) * rate;
  S.pt += d;
  if (S.phase === 0) {
    // Slide: each chord eases from its pieces to the centred chord.
    let all = true, sum = 0;
    for (let k = 0; k < K; k++) {
      const x = cl((S.pt - S.del[k]) / S.dur[k], 0, 1), e = ease(x);
      S.sp[k] = d > 0 ? (e - S.u[k]) / d : 0;
      S.u[k] = e;
      sum += e;
      if (x < 1) all = false;
    }
    S.prog = sum / K;
    S.P = S.Pfrom + (S.Pto - S.Pfrom) * S.prog;
    if (all) {
      S.rings = S.next;
      S.P = S.Pto;
      S.n++;
      S.still = abs(S.prevP - S.P) < 0.002 * S.P ? S.still + 1 : 0;
      S.prevP = S.P;
      S.phase = 1;
      S.pt = 0;
      S.sp.fill(0);
    }
  } else if (S.phase === 1 && S.pt > (S.n ? 0.2 : 0.15)) {
    // Rest, then turn to the next axis, or let a round or settled shape go.
    const disc = 2 * sqrt(PI * S.A);
    if (S.n && (S.P < disc * 1.006 || S.still >= 2 || S.n >= 12)) {
      S.phase = 3;
      S.pt = 0;
    } else if (!S.n) begin(S, S.phi);
    else {
      S.from = S.phi;
      S.to = S.phi + (axes ? PI / axes : GOLD);
      S.phase = axes === 1 ? 2.5 : 2;
      S.pt = 0;
    }
  } else if (S.phase === 2) {
    const x = cl(S.pt / 0.5, 0, 1);
    S.phi = S.from + (S.to - S.from) * ease(x);
    if (x >= 1) begin(S, S.to % (2 * PI));
  } else if (S.phase === 2.5) {
    // One axis: nothing to turn to.
    if (S.pt > 0.3) begin(S, S.phi);
  } else if (S.phase === 3) {
    // Hold the shape it settled into, then fade into a new one.
    S.fade = S.pt < 1.3 ? 1 : max(0, 1 - (S.pt - 1.3) / 0.3);
    if (S.pt > 1.6) {
      newShape(S, sel);
      S.phase = 4;
      S.pt = 0;
    }
  } else if (S.phase === 4) {
    S.fade = min(1, S.pt / 0.3);
    if (S.pt > 0.6) {
      S.fade = 1;
      begin(S, S.phi);
    }
  }
  if (S.phase !== 0) S.prog = 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.rings) return;
  const sliding = S.phase === 0, { a0, b0, a1, b1, cnt, u, sp } = S;
  if (!sliding) cut(S, S.phi, a0, b0, cnt);
  const ca = cos(S.phi), sa = sin(S.phi), h0 = 0.56 + S.hue, f = S.fade, col = S.col;
  // Every axis of a finite set, drawn faintly; the current one a little
  // brighter.
  const na = S.axes || 1, rd = sqrt(S.A / PI), ax = S.ax;
  for (let m = 1; m < na; m++) {
    ax[2 * m] = sin(S.phi + (PI * m) / na);
    ax[2 * m + 1] = cos(S.phi + (PI * m) / na);
  }
  for (let Y = 0; Y < H - 6; Y++)
    for (let X = 0; X < W; X++) {
      const x = X + 0.5 - OX, y = Y + 0.5 - OY, s = x * ca + y * sa, t = -x * sa + y * ca;
      const k = floor(s - S0);
      let lit = 0, piece = 0;
      if (k >= 0 && k < K)
        for (let j = 0; j < cnt[k]; j++) {
          const o = k * MAXP + j;
          const A = sliding ? a0[o] + (a1[o] - a0[o]) * u[k] : a0[o], B = sliding ? b0[o] + (b1[o] - b0[o]) * u[k] : b0[o];
          const c = min(t - A, B - t) + 0.5;
          if (c > lit) {
            lit = min(1, c);
            piece = j;
          }
        }
      if (lit > 0) {
        // Hue runs along the axis, odd and even chords alternate in
        // brightness, a moving chord flares and pieces cut apart by a gap
        // keep their own tint until they meet.
        const w = (s + 40) / 80, mv = sliding ? cl(abs(sp[k]) * 0.012 * (abs(a1[k * MAXP + piece] - a0[k * MAXP + piece]) + 4), 0, 1) : 0;
        const tint = sliding && piece % 2 ? 0.22 * (1 - u[k]) : 0;
        hsv(h0 + 0.16 * cl(w, 0, 1) + tint, 0.75 - 0.45 * mv, (k & 1 ? 0.9 : 0.56) + 0.12 * mv, col);
        const g = lit * f * (abs(t) < 0.5 ? 1.15 : 1);
        display.setPixel(X, Y, min(255, col[0] * g) | 0, min(255, col[1] * g) | 0, min(255, col[2] * g) | 0);
        continue;
      }
      // Outside: the axes, and the disc of the same area as a faint ring.
      let v = 0;
      if (abs(t) < 0.5) v = 0.24;
      else if (na > 1)
        for (let m = 1; m < na; m++) if (abs(-x * ax[2 * m] + y * ax[2 * m + 1]) < 0.5) v = 0.13;
      if (abs(sqrt(x * x + y * y) - rd) < 0.5) v = max(v, 0.16);
      if (v > 0) {
        hsv(h0 + 0.08, 0.45, v * f, col);
        display.setPixel(X, Y, col[0] | 0, col[1] | 0, col[2] | 0);
      }
    }
  // The perimeter bar: full width is the starting shape's perimeter, the
  // white tick the disc's 2 sqrt(pi A).
  const len = (BAR * S.P) / S.P0, tick = 2 + (BAR * 2 * sqrt(PI * S.A)) / S.P0;
  const bar = hsv(h0 + 0.5, 0.8, 0.95, S.tmp);
  for (let X = 2; X < 2 + BAR; X++) {
    const c = cl(len - (X - 2), 0, 1);
    for (let Y = 124; Y < 126; Y++) {
      if (c > 0) display.setPixel(X, Y, (bar[0] * c * f) | 0, (bar[1] * c * f) | 0, (bar[2] * c * f) | 0);
      else display.setPixel(X, Y, 30 * f, 30 * f, 34 * f);
    }
  }
  const T = floor(tick);
  for (let Y = 122; Y < 128; Y++) display.setPixel(T, Y, 255 * f, 255 * f, 255 * f);
}
