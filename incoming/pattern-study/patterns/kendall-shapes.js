// ===== Patternflow pattern =====
// Title:   Kendall Shape Sphere
// Family:  data
// Idea:    Random triangles are drawn one after another in a box at the top, each from three points thrown by a chosen law, and each drops its shape point onto Kendall's shape sphere turning below, where equilateral triangles sit at the poles, flat ones on the equator and the obtuse ones inside three caps bounded by the right-angle circles, so with Gaussian points the dots spread evenly and three quarters of them fall in the caps, the fraction a counter at the bottom shows closing on 0.750.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the shape sphere of planar triangles (David G. Kendall, Shape manifolds, Procrustean metrics, and complex projective spaces, Bulletin of the London Mathematical Society, 1984), Lewis Carroll's pillow problem 58 on obtuse random triangles (Pillow-Problems, 1893); pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Law=0..4, Life=0..1
//
// Knob 1: Hue. Turns the three corner colours round the wheel together. At 0 corner 1 is azure, corner 2 magenta and corner 3 lime, and each right-angle circle and the obtuse dots inside it take the colour of the corner whose angle is obtuse there; acute dots stay pale.
// Knob 2: Speed. At 2 a new triangle every 1/6 s, each dot falling 0.9 s from the box to the sphere, and the sphere turning once in 30 s while its axis nods 26 degrees either way every 48 s, so both poles come round to the front; everything goes as Speed / 2, so at 0.2 one triangle in 1.7 s.
// Knob 3: Law. Where the three corners come from, in five stops: 0 independent Gaussian points (sigma 8.5 LEDs), dots uniform and 3/4 obtuse; 1 uniform in a disc of radius 19.5, 0.720 obtuse, the equator 14 percent thinner at the cap centres and 14 percent thicker between them; 2 uniform in a square, 0.725; 3 uniform on a circle, 3/4 again, but the equator empties at the cap centres to a fifth of the even density and crowds where two corners meet; 4 a Gaussian squeezed five to one, 0.929 obtuse, with 2.3 times the even density on the equator and a fifth of it at the poles.
// Knob 4: Life. How long a dot stays, 16 / Life seconds: 267 s at the opening 0.06, so about 1600 dots once the stream has run that long, 64 s at 0.25 (about 380) and 16 s at 1 (about 100); at 0 a dot stays until 2400 newer ones push it out. A new law starts a fresh stream laid in as if it had run one dot life, and the counter counts from there.

// Three points z1, z2, z3 in the plane, as complex numbers. The Helmert
// coordinates
//
//   u = (z2 - z1) / sqrt 2,   v = (2 z3 - z1 - z2) / sqrt 6
//
// forget where the triangle is, and |u|^2 + |v|^2 is its size. Up to
// rotation and scale the triangle is the ratio v : u, a point of the complex
// projective line, and Kendall (1984) gave that line its round metric: the
// map
//
//   X = (|u|^2 - |v|^2) / 2S,  Y = Re(u conj v) / S,  Z = Im(u conj v) / S,
//
// S = |u|^2 + |v|^2, puts every shape on a sphere of radius 1/2 (it is the
// Hopf map). Z is 2 / sqrt 3 times the signed area over S, so the two
// equilateral triangles, one of each orientation, are the poles Z = +-1/2
// and the flat triangles are the equator Z = 0.
//
// The angle at z3 is right when z3 lies on the circle over z1 z2 (Thales),
// which here is |u|^2 = 3 |v|^2, the plane X = 1/4: a circle 60 degrees
// round the point X = 1/2, where z3 sits midway between z1 and z2. Inside it
// the angle at z3 is obtuse. Relabelling the corners turns the sphere a
// third of a turn about the poles, so the right angles at z1 and z2 are the
// same circle round the equator points at 240 and 120 degrees. The three
// caps touch at the equator points where two corners meet, and together they
// cover 3 (1 - cos 60) / 2 = 3/4 of the sphere.
//
// When the corners are independent standard Gaussian points, u and v are
// independent standard complex Gaussians (the Helmert map is orthogonal), so
// (u, v) / |(u, v)| is uniform on the 3-sphere and its Hopf image uniform on
// the shape sphere: three quarters of Gaussian triangles are obtuse, an
// answer to Lewis Carroll's pillow problem 58 in a model Carroll did not
// use. Checked in node with two million triangles per law: Gaussian 0.7504
// obtuse with Z in ten equal bins at 1.00 each, the cap test agreeing with
// the angle test on every triangle; a disc 0.7201 (9/8 - 4/pi^2 = 0.7197),
// a square 0.7249 (97/150 + pi/40 = 0.7252), a circle 0.7499, the squeezed
// Gaussian 0.9289. Away from Gaussian the dots no longer spread evenly: in
// the band |Z| < 0.1 the disc gives 0.86 of the mean density at the cap
// centres and 1.14 between them, the circle 0.19 and 1.81.

const W = 64, H = 128;
const { floor, round, sqrt, cos, sin, log, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The sample box, the sphere and the counter rows.
const BX = 31.5, BY = 21;
const CX = 31.5, CY = 77, R = 30.5;
const TXT = 112, BAR = 121;
// Dots kept at most; triangles a second, spin turns a second, nod period
// and drop time, all at Speed 1.
const POOL = 2400, RATE = 3, SPIN = 1 / 60, NOD = 96, DROP = 0.9, TILT = 0.45;
// Each cap's centre on the equator: right angle at corner 1, 2, 3.
const CAP = [(4 * PI) / 3, (2 * PI) / 3, 0];
const HUES = [0.58, 0.91, 0.24];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

const gauss = () => {
  let u = 0;
  while (u === 0) u = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * Math.random());
};

// One corner under each law, in LEDs from the box centre.
function corner(law) {
  if (law === 0) return [8.5 * gauss(), 8.5 * gauss()];
  if (law === 1) {
    const r = 19.5 * sqrt(Math.random()), a = TAU * Math.random();
    return [r * cos(a), r * sin(a)];
  }
  if (law === 2) return [38 * Math.random() - 19, 38 * Math.random() - 19];
  if (law === 3) {
    const a = TAU * Math.random();
    return [19 * cos(a), 19 * sin(a)];
  }
  return [12 * gauss(), 2.4 * gauss()];
}

// The shape point on the unit sphere (Kendall's radius 1/2 doubled), and the
// corner whose angle is obtuse, 0 for an acute triangle.
function shape(p) {
  const ur = (p[2] - p[0]) / Math.SQRT2, ui = (p[3] - p[1]) / Math.SQRT2;
  const vr = (2 * p[4] - p[0] - p[2]) / sqrt(6), vi = (2 * p[5] - p[1] - p[3]) / sqrt(6);
  const u2 = ur * ur + ui * ui, v2 = vr * vr + vi * vi, s = u2 + v2 || 1;
  let ob = 0;
  for (let i = 0; i < 3; i++) {
    const a = 2 * i, b = 2 * ((i + 1) % 3), c = 2 * ((i + 2) % 3);
    if ((p[b] - p[a]) * (p[c] - p[a]) + (p[b + 1] - p[a + 1]) * (p[c + 1] - p[a + 1]) < 0) ob = i + 1;
  }
  // The box is drawn y down, so the signed area flips; Z is taken so that
  // a triangle whose corners 1, 2, 3 run anticlockwise on the panel is north.
  return [(u2 - v2) / s, (2 * (ur * vr + ui * vi)) / s, (2 * (ui * vr - ur * vi)) / s, ob];
}

// Figures 5 by 7 and a point, for the counter.
const GLYPH = {
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00", "00", "00", "00", "00", "11", "11"],
};

export function setup(params) {
  params.s = {
    t: 0, spin: 0.3, nod: NOD * 0.18, hue: 0, speed: 2, life: 267, law: -1,
    px: new Float32Array(POOL), py: new Float32Array(POOL), pz: new Float32Array(POOL),
    cls: new Uint8Array(POOL), born: new Float32Array(POOL), sx: new Float32Array(POOL), sy: new Float32Array(POOL),
    head: 0, count: 0, n: 0, ob: 0, caps: [0, 0, 0], acc: 0, tris: [], buf: new Float32Array(W * H * 3),
  };
}

// Throw one triangle, born at time t, and drop its dot.
function throwOne(S, t, keep) {
  const p = [];
  for (let i = 0; i < 3; i++) p.push(...corner(S.law));
  const s = shape(p), j = S.head;
  S.px[j] = s[0];
  S.py[j] = s[1];
  S.pz[j] = s[2];
  S.cls[j] = s[3];
  S.born[j] = t;
  S.sx[j] = BX + (p[0] + p[2] + p[4]) / 3;
  S.sy[j] = BY + (p[1] + p[3] + p[5]) / 3;
  S.head = (j + 1) % POOL;
  S.count = min(POOL, S.count + 1);
  S.n++;
  if (s[3]) {
    S.ob++;
    S.caps[s[3] - 1]++;
  }
  if (keep) {
    S.tris.push({ p, ob: s[3], t });
    if (S.tris.length > 8) S.tris.shift();
  }
}

// A fresh stream under a new law, laid in as if it had run one dot life.
function restart(S, law) {
  S.law = law;
  S.head = 0;
  S.count = 0;
  S.n = 0;
  S.ob = 0;
  S.caps = [0, 0, 0];
  S.tris = [];
  const rate = RATE * S.speed, span = S.life === Infinity ? POOL / rate : S.life;
  const n = min(POOL, round(rate * span));
  for (let i = 0; i < n; i++) throwOne(S, S.t - DROP - span * (1 - i / n), i > n - 8);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const lk = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.life = lk <= 0.001 ? Infinity : 16 / lk;
  const law = round(cl(k[2] || 0, 0, 4));
  if (law !== S.law) restart(S, law);
  const f = S.speed / 2;
  S.t += d;
  S.spin += d * f * SPIN * 2 * TAU;
  S.nod += d * f * 2;
  S.acc += d * RATE * S.speed;
  while (S.acc >= 1) {
    S.acc -= 1;
    throwOne(S, S.t, true);
  }
}

// An additive dot at a fractional position, split over four LEDs.
function dot(buf, x, y, r, g, b) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  for (let q = 0; q < 4; q++) {
    const X = ix + (q & 1), Y = iy + (q >> 1);
    if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
    const w = (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy), o = (Y * W + X) * 3;
    buf[o] += r * w;
    buf[o + 1] += g * w;
    buf[o + 2] += b * w;
  }
}

function line(buf, x0, y0, x1, y1, c, v) {
  const dx = x1 - x0, dy = y1 - y0, n = max(1, Math.ceil(sqrt(dx * dx + dy * dy) * 1.5));
  for (let i = 0; i <= n; i++) dot(buf, x0 + (dx * i) / n, y0 + (dy * i) / n, (c[0] * v) / 1.5, (c[1] * v) / 1.5, (c[2] * v) / 1.5);
}

function add(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += r;
  buf[o + 1] += g;
  buf[o + 2] += b;
}

function text(buf, s, x, y, c) {
  for (const ch of s) {
    const g = GLYPH[ch];
    if (!g) {
      x += 3;
      continue;
    }
    for (let r = 0; r < 7; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === "1") add(buf, x + q, y + r, c[0], c[1], c[2]);
    x += g[0].length + 1;
  }
  return x;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.law < 0) return;
  const buf = S.buf;
  buf.fill(0);
  const col = HUES.map((h) => hsv(S.hue + h, 0.75, 1));
  const pale = hsv(S.hue + 0.58, 0.12, 1);

  // The law's ground, faint, in the box.
  const ground = [52, 56, 70];
  if (S.law === 0 || S.law === 4) {
    const ax = S.law === 0 ? 8.5 : 12, ay = S.law === 0 ? 8.5 : 2.4;
    for (const m of [1, 2]) for (let q = 0; q < 160; q++) {
      const a = (q / 160) * TAU, x = BX + m * ax * cos(a), y = BY + m * ay * sin(a);
      if (y > 0 && y < 42) dot(buf, x, y, ground[0] * 0.8, ground[1] * 0.8, ground[2] * 0.8);
    }
  } else if (S.law === 2) {
    for (let q = -19; q <= 19; q++) {
      dot(buf, BX + q, BY - 19, ...ground);
      dot(buf, BX + q, BY + 19, ...ground);
      dot(buf, BX - 19, BY + q, ...ground);
      dot(buf, BX + 19, BY + q, ...ground);
    }
  } else {
    const rr = S.law === 1 ? 19.5 : 19;
    for (let q = 0; q < 200; q++) {
      const a = (q / 200) * TAU;
      dot(buf, BX + rr * cos(a), BY + rr * sin(a), ...ground);
    }
  }

  // The triangles: the newest filled with its colour, the few before it
  // fading.
  const f = S.speed / 2;
  for (let i = 0; i < S.tris.length; i++) {
    const T = S.tris[i], age = (S.t - T.t) * f, newest = i === S.tris.length - 1;
    const lv = newest ? 1 : Math.exp(-age / 0.18);
    if (lv < 0.03) continue;
    const p = T.p, c = T.ob ? col[T.ob - 1] : pale;
    if (newest) {
      const x0 = floor(min(p[0], p[2], p[4]) + BX), x1 = Math.ceil(max(p[0], p[2], p[4]) + BX);
      const y0 = floor(min(p[1], p[3], p[5]) + BY), y1 = Math.ceil(max(p[1], p[3], p[5]) + BY);
      const ar = (p[2] - p[0]) * (p[5] - p[1]) - (p[3] - p[1]) * (p[4] - p[0]);
      if (Math.abs(ar) > 1e-6)
        for (let y = max(0, y0); y <= min(42, y1); y++)
          for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
            const qx = x - BX, qy = y - BY;
            const a = ((p[2] - qx) * (p[5] - qy) - (p[3] - qy) * (p[4] - qx)) / ar;
            const b = ((p[4] - qx) * (p[1] - qy) - (p[5] - qy) * (p[0] - qx)) / ar;
            if (a >= 0 && b >= 0 && a + b <= 1) add(buf, x, y, c[0] * 46, c[1] * 46, c[2] * 46);
          }
    }
    for (let e = 0; e < 3; e++) {
      const a = 2 * e, b = 2 * ((e + 1) % 3);
      line(buf, BX + p[a], BY + p[a + 1], BX + p[b], BY + p[b + 1], [1, 1, 1], (newest ? 150 : 90) * lv);
    }
    if (newest)
      for (let e = 0; e < 3; e++) {
        const x = BX + p[2 * e], y = BY + p[2 * e + 1], c2 = col[e], big = T.ob === e + 1;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const w = dx === 0 && dy === 0 ? 260 : dx && dy ? (big ? 120 : 0) : big ? 220 : 110;
            dot(buf, x + dx, y + dy, c2[0] * w, c2[1] * w, c2[2] * w);
          }
      }
  }

  // The sphere: spin about the poles, then the axis nodded toward the
  // viewer by beta. View coordinates: sx right, sy up, depth toward us.
  const beta = TILT * sin((S.nod / NOD) * TAU), cb = cos(beta), sb = sin(beta);
  const cs = cos(S.spin), ss = sin(S.spin);
  const view = (x, y, z, out) => {
    const x1 = x * cs - y * ss, y1 = x * ss + y * cs;
    out[0] = CX + R * x1;
    out[1] = CY - R * (z * cb - y1 * sb);
    out[2] = z * sb + y1 * cb;
  };
  const lx = -0.45, ly = 0.55, lz = 0.7;
  for (let y = floor(CY - R) - 1; y <= CY + R + 1; y++)
    for (let x = 0; x < W; x++) {
      const nx = (x - CX) / R, ny = (CY - y) / R, rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = sqrt(1 - rr), l = 0.35 + 0.65 * max(0, nx * lx + ny * ly + nz * lz);
      const edge = cl((1 - sqrt(rr)) * R * 1.2, 0, 1);
      add(buf, x, y, 18 * l * edge, 22 * l * edge, 36 * l * edge);
    }
  const v = [0, 0, 0];
  // The equator, the three right-angle circles and the poles.
  for (let q = 0; q < 240; q++) {
    const a = (q / 240) * TAU;
    view(cos(a), sin(a), 0, v);
    if (v[2] > 0) dot(buf, v[0], v[1], 70 * v[2] + 20, 70 * v[2] + 20, 80 * v[2] + 24);
  }
  for (let i = 0; i < 3; i++) {
    const th = CAP[i], c = col[i], ch = cos(th), sh = sin(th);
    for (let q = 0; q < 200; q++) {
      const a = (q / 200) * TAU, ca = cos(a) * 0.866, sa = sin(a) * 0.866;
      view(0.5 * ch - ca * sh, 0.5 * sh + ca * ch, sa, v);
      if (v[2] > 0) {
        const w = 60 + 90 * v[2];
        dot(buf, v[0], v[1], c[0] * w, c[1] * w, c[2] * w);
      }
    }
  }
  for (const pole of [1, -1]) {
    view(0, 0, pole, v);
    if (v[2] <= 0) continue;
    // A small equilateral triangle at each pole with its corners in their
    // colours, 1, 2, 3 anticlockwise at the north and clockwise at the
    // south: the two mirror images, which no turn of the plane makes one.
    const w = 90 + 60 * v[2], a = (e) => -PI / 2 - (pole * e * TAU) / 3;
    for (let e = 0; e < 3; e++)
      line(buf, v[0] + 3.5 * cos(a(e)), v[1] + 3.5 * sin(a(e)), v[0] + 3.5 * cos(a(e + 1)), v[1] + 3.5 * sin(a(e + 1)), [1, 1, 1], w);
    for (let e = 0; e < 3; e++) {
      const c = col[e];
      dot(buf, v[0] + 3.5 * cos(a(e)), v[1] + 3.5 * sin(a(e)), c[0] * 330, c[1] * 330, c[2] * 330);
    }
  }

  // The dots, and the ones still falling.
  const drop = DROP / f, life = S.life;
  for (let m = 0; m < S.count; m++) {
    const j = (S.head - 1 - m + POOL) % POOL, age = S.t - S.born[j];
    if (age > life) continue;
    const c = S.cls[j] ? col[S.cls[j] - 1] : pale;
    view(S.px[j], S.py[j], S.pz[j], v);
    if (age < drop) {
      const u = age / drop, e = u * u;
      for (let tr = 0; tr < 4; tr++) {
        const uu = max(0, u - tr * 0.04), ee = uu * uu, w = 230 * (1 - tr * 0.24);
        dot(buf, S.sx[j] + (v[0] - S.sx[j]) * ee, S.sy[j] + (v[1] - S.sy[j]) * ee, c[0] * w, c[1] * w, c[2] * w);
      }
      continue;
    }
    if (v[2] <= 0) continue;
    const fade = age > 0.75 * life ? (life - age) / (0.25 * life) : 1;
    const land = age - drop < 0.3 ? 1 + 2 * (1 - (age - drop) / 0.3) : 1;
    const w = 200 * (0.45 + 0.55 * v[2]) * fade * land;
    dot(buf, v[0], v[1], c[0] * w, c[1] * w, c[2] * w);
  }

  // The running fraction of obtuse triangles, the count, and a bar split by
  // the three caps with a tick at 3/4.
  const fr = S.n ? S.ob / S.n : 0;
  text(buf, fr.toFixed(3), 2, TXT, [230, 230, 230]);
  const ns = String(S.n);
  text(buf, ns, 62 - ns.length * 6 + 1, TXT, [90, 96, 120]);
  let x = 2;
  for (let i = 0; i <= 3; i++) {
    const share = i < 3 ? S.caps[i] / max(1, S.n) : 1 - fr, c = i < 3 ? col[i] : pale, w = i < 3 ? 190 : 60;
    const x1 = i < 3 ? x + 60 * share : 62;
    for (let q = floor(x); q < round(x1) && q < 62; q++) for (let r = 0; r < 4; r++) add(buf, q, BAR + r, c[0] * w, c[1] * w, c[2] * w);
    x = x1;
  }
  for (let r = -2; r < 6; r++) add(buf, 47, BAR + r, 255, 255, 255);

  for (let y = 0; y < H; y++)
    for (let x2 = 0; x2 < W; x2++) {
      const o = (y * W + x2) * 3, m = max(buf[o], buf[o + 1], buf[o + 2]), q = m > 255 ? 255 / m : 1;
      display.setPixel(x2, y, round(buf[o] * q), round(buf[o + 1] * q), round(buf[o + 2] * q));
    }
}
