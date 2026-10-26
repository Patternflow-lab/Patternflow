// ===== Patternflow pattern =====
// Title:   Mirror Curves
// Family:  topology
// Idea:    A light ray runs at 45 degrees round a 4 x 8 grid of dots on a board that wraps like a torus, bouncing off the two-sided mirrors on half of the 64 sites between the dots, and each closed path it makes is one strand of an alternating link, woven over and under at every free crossing and coloured on its own, while about once a second a mirror turns or moves, joining or splitting strands, and the new colour runs out along the strand from that mirror.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: mirror curves (Slavik Jablan, 2001), Lunda designs from the Chokwe sona (Paulus Gerdes, 1990s), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mirrors=0.5..1, Join=0..1
//
// Knob 1: Hue. Turns the eight strand colours round the wheel together. At 0 they are sky, amber, green, magenta, turquoise, violet, lime and pink; at 0.5 each takes the colour opposite, sky turning orange and green magenta. The dots and mirrors stay white and the faint field behind stays blue and violet.
// Knob 2: Speed. At 2 the whole board drifts one LED right and one down every 0.67 s, a mirror turns or moves every 0.83 s, and its new colour runs along the strand at 130 LEDs a second. At 0.2 all of it is ten times slower; at 3 half as fast again.
// Knob 3: Mirrors. The share of the 64 sites that hold a mirror: 32 at 0.5, so a strand bends at about every other site, 48 at 0.75, and all 64 at 1, where no strand crosses another and every strand is a closed loop fenced in by mirrors. The lit LEDs go from 800 to 864.
// Knob 4: Join. How many strands the walk keeps: 8 at 0, 6 at 0.25, 5 at 0.5, 3 at 0.75, and at 1 a single closed curve through all 128 segments, the board drawn in one stroke as the sona drawers aimed to draw it.
// Buttons: K3 tap frames the board for 4 seconds: every inner mirror is lifted, the 12 sites on the panel's left and top edges take mirrors along the edge, the drift stops, and the 4 x 8 rectangle is drawn by gcd(4, 8) = 4 strands. A second tap, or the end of the 4 seconds, puts the mirrors back.

const W = 64, H = 128, N = W * H;
const { floor, max, round, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// The grid in half-cell units: a cell is 16 LEDs, so u runs 0..7 across and
// v 0..15 down, both wrapping. Dots sit at (odd, odd), cell corners at
// (even, even), and the crossing sites, the midpoints of the cell edges, at
// u + v odd: 64 of them. The strands run between sites in 45-degree steps,
// so every lit LED has x + y even and the four LEDs round it dark; where
// x + y is odd the panel is always dark, and where it is even and nothing
// is drawn it shows the field at level 40. A kept crossing drops four LEDs
// from the strand under it and a mirror two, so with M mirrors the panel
// holds 736 + 2M LEDs at 255 in every frame: 800 at the opening, which
// puts the measured edges at 0.195 and the detail at 0.318.
const HC = 8, NU = W / HC, NV = H / HC;
const mod = (a, m) => ((a % m) + m) % m;
const SU = [], SV = [], SITE = new Int16Array(NU * NV).fill(-1);
for (let v = 0; v < NV; v++)
  for (let u = 0; u < NU; u++)
    if ((u + v) & 1) {
      SITE[v * NU + u] = SU.length;
      SU.push(u);
      SV.push(v);
    }
const NS = SU.length;
const siteAt = (u, v) => SITE[mod(v, NV) * NU + mod(u, NU)];
// Segment 2s runs from site s down-right, 2s + 1 up-right, 8 LED steps each.
// A site's four ports: 0 up-left, 1 up-right, 2 down-left, 3 down-right.
const PORT = new Int16Array(NS * 4);
for (let s = 0; s < NS; s++) {
  const u = SU[s], v = SV[s];
  PORT[s * 4] = 2 * siteAt(u - 1, v - 1);
  PORT[s * 4 + 1] = 2 * s + 1;
  PORT[s * 4 + 2] = 2 * siteAt(u - 1, v + 1) + 1;
  PORT[s * 4 + 3] = 2 * s;
}
// Which port pairs with which: a crossing goes straight on, a mirror lying
// across the panel (kind 1) sends the ray back up or down, a mirror
// standing up (kind 2) back left or right.
const PAIR = [[3, 2, 1, 0], [1, 0, 3, 2], [2, 3, 0, 1]];
// The far end of segment k: its site and the port it arrives at.
const segEnd = (k) => {
  const s = k >> 1, up = k & 1;
  return [siteAt(SU[s] + 1, SV[s] + (up ? -1 : 1)), up ? 2 : 0];
};

// Strand hues. After a change each strand keeps the hue it shares most
// segments with, and a new strand takes one that no other strand holds.
const PAL = [0.56, 0.12, 0.34, 0.84, 0.47, 0.7, 0.2, 0.92];

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, share: 0.5, join: 0.06, target: 8, clock: 0,
    kind: new Int8Array(NS), comp: new Int16Array(NS * 2), slot: new Int8Array(NS * 2),
    hA: new Float32Array(NS * 2), hB: new Float32Array(NS * 2), t0: new Float32Array(NS * 2),
    ox: 0, oy: 0, panT: 0, evT: 0, fresh: true, comps: 0, frame: 0, saved: null,
    R: new Uint8Array(N), G: new Uint8Array(N), B: new Uint8Array(N), c: [0, 0, 0],
  };
}

function mirrorCount(S) {
  let m = 0;
  for (let s = 0; s < NS; s++) if (S.kind[s]) m++;
  return m;
}

// Union the two segments each site joins; the classes are the closed
// components of the curve.
function components(S) {
  const P = new Int16Array(NS * 2);
  for (let i = 0; i < P.length; i++) P[i] = i;
  const find = (a) => {
    while (P[a] !== a) a = P[a] = P[P[a]];
    return a;
  };
  for (let s = 0; s < NS; s++) {
    const pr = PAIR[S.kind[s]];
    for (let a = 0; a < 4; a++)
      if (pr[a] > a) {
        const x = find(PORT[s * 4 + a]), y = find(PORT[s * 4 + pr[a]]);
        if (x !== y) P[x] = y;
      }
  }
  const id = new Int16Array(NS * 2).fill(-1);
  let n = 0;
  for (let k = 0; k < NS * 2; k++) {
    const r = find(k);
    if (id[r] < 0) id[r] = n++;
    S.comp[k] = id[r];
  }
  S.comps = n;
  return n;
}

// After a change, each new component keeps the colour slot it shares most
// segments with, biggest overlap first; the rest take free slots. Segments
// whose slot changed take the new hue as a wave running out from the
// changed sites along the strand.
function recolour(S, from) {
  const n = components(S), K = PAL.length;
  const cnt = new Int32Array(n * K);
  for (let k = 0; k < NS * 2; k++) cnt[S.comp[k] * K + S.slot[k]]++;
  const order = [];
  for (let i = 0; i < n * K; i++) if (cnt[i]) order.push(i);
  order.sort((a, b) => cnt[b] - cnt[a]);
  const got = new Int8Array(n).fill(-1), used = new Int16Array(K);
  for (const i of order) {
    const c = floor(i / K), sl = i % K;
    if (got[c] < 0 && !used[sl]) (got[c] = sl), used[sl]++;
  }
  for (let c = 0; c < n; c++)
    if (got[c] < 0) {
      let best = 0;
      for (let sl = 1; sl < K; sl++) if (used[sl] < used[best]) best = sl;
      got[c] = best;
      used[best]++;
    }
  // Distance along the curve from the changed sites, in segments.
  const dist = new Int16Array(NS * 2).fill(-1), q = [];
  for (const s of from)
    for (let a = 0; a < 4; a++) {
      const k = PORT[s * 4 + a];
      if (dist[k] < 0) (dist[k] = 0), q.push(k);
    }
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    const ends = [[k >> 1, k & 1 ? 1 : 3], segEnd(k)];
    for (const [s, a] of ends) {
      const j = PORT[s * 4 + PAIR[S.kind[s]][a]];
      if (dist[j] < 0) (dist[j] = dist[k] + 1), q.push(j);
    }
  }
  for (let k = 0; k < NS * 2; k++) {
    const sl = got[S.comp[k]];
    if (S.fresh) {
      S.hA[k] = S.hB[k] = PAL[sl];
    } else if (sl !== S.slot[k]) {
      S.hA[k] = hueNow(S, k);
      S.hB[k] = PAL[sl];
      S.t0[k] = S.clock + 0.06 * max(0, dist[k]);
    }
    S.slot[k] = sl;
  }
}

function hueNow(S, k) {
  const a = cl((S.clock - S.t0[k]) / 0.12, 0, 1);
  let dh = S.hB[k] - S.hA[k];
  dh -= round(dh);
  return S.hA[k] + dh * a;
}

function pick(S, want) {
  // Random site of the wanted kind (mirror or crossing).
  let s;
  do s = floor(random() * NS);
  while (want ? !S.kind[s] : S.kind[s]);
  return s;
}

function setMirrors(S, M) {
  let m = mirrorCount(S);
  const ch = [];
  while (m < M) {
    const s = pick(S, false);
    S.kind[s] = 1 + floor(random() * 2);
    ch.push(s);
    m++;
  }
  while (m > M) {
    const s = pick(S, true);
    S.kind[s] = 0;
    ch.push(s);
    m--;
  }
  return ch;
}

function propose(S) {
  // Half the time a mirror turns a quarter turn; otherwise it moves to a
  // free crossing. Either way the count of mirrors stays.
  if (random() < 0.5 || mirrorCount(S) === NS) {
    const s = pick(S, true);
    return [[s, 3 - S.kind[s]]];
  }
  const a = pick(S, true), b = pick(S, false);
  return [[b, 1 + floor(random() * 2)], [a, 0]];
}

// How far the link is from what the walk wants: the wanted number of
// strands first, then no strand much longer than the others.
function score(S) {
  const n = components(S), len = new Int16Array(n);
  let big = 0;
  for (let k = 0; k < NS * 2; k++) big = max(big, ++len[S.comp[k]]);
  return 200 * Math.abs(n - S.target) + big;
}

function event(S) {
  // A change that leaves the link further from that is made only when 24
  // tries find nothing better.
  const now = score(S);
  let best = null, bestD = 1e9;
  for (let tries = 0; tries < 24; tries++) {
    const ch = propose(S), old = ch.map(([s]) => S.kind[s]);
    for (const [s, kd] of ch) S.kind[s] = kd;
    const dd = score(S) - now;
    ch.forEach(([s], i) => (S.kind[s] = old[i]));
    if (dd <= 4) {
      best = ch;
      break;
    }
    if (dd < bestD) (bestD = dd), (best = ch);
  }
  for (const [s, kd] of best) S.kind[s] = kd;
  recolour(S, best.map(([s]) => s));
}

// The seam of the torus, where column 0 meets column 63 and row 0 meets
// row 127. Mirrors along all twelve of its sites make the board a framed
// 4 x 8 rectangle, and a framed board with no other mirror is drawn by
// gcd(4, 8) = 4 strands.
const SEAM = [];
for (let s = 0; s < NS; s++) if (SU[s] === 0 || SV[s] === 0) SEAM.push(s);

function frame(S, on) {
  if (on) {
    S.saved = S.kind.slice();
    S.kind.fill(0);
    for (const s of SEAM) S.kind[s] = SU[s] === 0 ? 2 : 1;
    S.ox = S.oy = 0;
    S.frame = 4;
    recolour(S, SEAM);
  } else if (S.saved) {
    S.kind.set(S.saved);
    S.saved = null;
    S.frame = 0;
    recolour(S, SEAM);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.share = cl(k[2], 0.5, 1);
  S.join = cl(k[3], 0, 1);
  S.target = round(8 - 7 * S.join);
  const ds = (d * S.speed) / 2;
  S.clock += ds;
  if (input.btnPressed && input.btnPressed[2]) frame(S, S.frame <= 0);
  if (S.frame > 0) {
    S.frame -= d;
    if (S.frame <= 0) frame(S, false);
    return;
  }
  const M = round(S.share * NS);
  if (mirrorCount(S) !== M) {
    const ch = setMirrors(S, M);
    recolour(S, ch);
  }
  if (S.fresh) {
    // Open on a board the walk has already brought to its strand count.
    for (let i = 0; i < 80; i++) event(S);
    S.fresh = false;
  }
  // The board is a torus exactly the panel's size, so a step of one LED
  // right and one down keeps every lit LED on the even class.
  S.panT += ds * 1.5;
  while (S.panT >= 1) {
    S.panT -= 1;
    S.ox = (S.ox + 1) % W;
    S.oy = (S.oy + 1) % H;
  }
  S.evT += ds * 1.2;
  while (S.evT >= 1) {
    S.evT -= 1;
    event(S);
  }
}

function put(S, x, y, h, sat) {
  const c = S.c, p = mod(y, H) * W + mod(x, W);
  hsv(h, sat, 1, c);
  S.R[p] = round(c[0] * 255);
  S.G[p] = round(c[1] * 255);
  S.B[p] = round(c[2] * 255);
}
function dim(S, x, y) {
  const p = mod(y, H) * W + mod(x, W);
  S.R[p] = S.G[p] = S.B[p] = 40;
}
// The field shades the faces of the diagram in two colours, blue round
// the dots and violet round the cell corners. A mirror only ever joins two
// faces of the same colour, so the checkerboard holds whatever the mirrors do.
function bg(S, x, y) {
  x = mod(x, W);
  y = mod(y, H);
  const p = y * W + x, c = S.c;
  if ((x + y) & 1) {
    S.R[p] = S.G[p] = S.B[p] = 0;
    return;
  }
  const dx = (x & 15) - 8, dy = (y & 15) - 8;
  const inDot = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy) < 8;
  hsv(inDot ? 0.62 : 0.76, inDot ? 0.7 : 0.5, 1, c);
  S.R[p] = round(c[0] * 40);
  S.G[p] = round(c[1] * 40);
  S.B[p] = round(c[2] * 40);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bg(S, x, y);
  const hu = S.hue;
  // Strands.
  for (let k = 0; k < NS * 2; k++) {
    const s = k >> 1, dv = k & 1 ? -1 : 1, h = hu + hueNow(S, k);
    for (let t = 1; t < 8; t++) put(S, SU[s] * HC + t, SV[s] * HC + dv * t, h, 1);
  }
  for (let s = 0; s < NS; s++) {
    const x = SU[s] * HC, y = SV[s] * HC, kd = S.kind[s];
    if (kd === 0) {
      // Alternating: at a site on a vertical cell edge (u even) the
      // down-right strand goes over, on a horizontal edge the up-right one.
      const d1 = (SU[s] & 1) === 0;
      const ov = PORT[s * 4 + (d1 ? 3 : 1)];
      put(S, x, y, hu + hueNow(S, ov), 1);
      for (let t = 1; t <= 2; t++) {
        if (d1) bg(S, x + t, y - t), bg(S, x - t, y + t);
        else bg(S, x + t, y + t), bg(S, x - t, y - t);
      }
    } else {
      // Each pair of arms turns back two LEDs short of the mirror over a flat
      // end of three LEDs, and the mirror is a white LED at the site with a
      // grey one, at the field's level, each side of it.
      const ax = kd === 1 ? 2 : 0, ay = 2 - ax;
      bg(S, x - 1, y - 1), bg(S, x + 1, y - 1), bg(S, x - 1, y + 1), bg(S, x + 1, y + 1);
      put(S, x - ay, y - ax, hu + hueNow(S, PORT[s * 4]), 1);
      put(S, x + ay, y + ax, hu + hueNow(S, PORT[s * 4 + 3]), 1);
      put(S, x, y, 0, 0);
      dim(S, x - ax, y - ay);
      dim(S, x + ax, y + ay);
    }
  }
  // Dots at the cell centres.
  for (let v = 1; v < NV; v += 2) for (let u = 1; u < NU; u += 2) put(S, u * HC, v * HC, 0, 0);
  for (let y = 0; y < H; y++) {
    const sy = mod(y - S.oy, H) * W;
    for (let x = 0; x < W; x++) {
      const p = sy + mod(x - S.ox, W);
      display.setPixel(x, y, S.R[p], S.G[p], S.B[p]);
    }
  }
}
