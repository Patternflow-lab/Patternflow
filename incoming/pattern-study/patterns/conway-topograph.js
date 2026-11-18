// ===== Patternflow pattern =====
// Title:   Conway's Topograph
// Family:  cells
// Idea:    The 64 faces of the Farey tree, grown outward from its middle edge, carry the values of a binary quadratic form ax^2 + bxy + cy^2 computed by Conway's arithmetic progression rule alone, positive in warm colours and negative in cool, brightest where the value is nearest 0, while the river of edges between a positive and a negative face runs through the panel in white gold with a pulse of light travelling down it, or, for a form that never goes negative, rings of light run out of its well.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the topograph of a binary quadratic form (John Conway, 1997, in The Sensual (Quadratic) Form), built on the Farey sequence (John Farey, 1816) and the Stern-Brocot tree (Moritz Stern, 1858; Achille Brocot, 1861); digits from the 3 by 5 capitals of Saccades (pattern round 106) by way of kasiski-examination.js; pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Cross=-9..9, Left=-6..6, Right=-6..-1, Hue=0..1
//
// Knob 1: Cross. The coefficient b of xy, a whole number from -9 to 9: the face under the middle edge carries a + b + c and the face over it a - b + c, so at 0 the two halves mirror each other. When Left and Right are both below 0 the form turns indefinite once b passes 2 times the square root of a times c, and the river then sits in the lower half for b above 0 and in the upper half for b below. With Left above 0 the river always crosses the middle edge and b only bends it.
// Knob 2: Left. The coefficient a of x^2, from -6 to 6: the value in the big face down the left of the panel. Above 0 with Right below 0 the form is indefinite and the river crosses the middle edge. Below 0 both big faces are negative, and the form is a well that glows where its values are smallest until Cross is large enough to make a river. At 0 the left face is a lake, a face of value 0, drawn white.
// Knob 3: Right. The coefficient c of y^2, from -6 to -1: the value in the big face down the right of the panel, always negative and so always cool. Its range stops short of 0, but white lakes turn up deeper in the tree whenever b^2 - 4ac is a perfect square: at Left 2, Cross 0, Right -2 the form is 2(x - y)(x + y) and the faces at the two ends of the middle edge go white.
// Knob 4: Hue. Turns every colour round the wheel together. It opens at 0.06, where positive faces run from yellow near 0 through orange to red as they grow and negative faces from cyan through blue to violet, and the river is pale gold.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, abs, sqrt, exp, log2, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The digits, 3 by 5, from the capitals of Saccades by way of kasiski-examination.js.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "-": "...|...|###|...|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// The Farey tree, five generations of vertices in each half of the panel. The
// lower half hangs from B at row 67 and the upper half is its mirror from A at
// row 61; A and B are the two ends of the middle edge, which stands between
// the face of (1, 0) on the left and the face of (0, 1) on the right. A vertex
// has three faces: u on its left, v on its right and, between its two child
// edges, w = u + v. The left child has faces (u, w), the right child (w, v).
const DEPTH = 5, NV = 31, NF = 2 + 2 * NV, NE = 1 + 4 * NV;
const HB = [14, 13, 12, 11, 10];
const YV = [67, 81, 94, 106, 117, 127];

// The arithmetic progression rule. Across an edge with faces p and q on its two
// sides, the regions at its two ends carry x and y with x + y = 2 (p + q). Every
// value below comes from a, c and a + b + c by that rule and no other.
function topograph(a, b, c, v, G) {
  v[0] = a;
  v[1] = c;
  v[2] = a + b + c;
  v[2 + NV] = 2 * (a + c) - v[2];
  for (let h = 0; h < 2; h++)
    for (let i = 1; i < NV; i++) {
      const p = (i - 1) >> 1, fu = v[G.UL[h][p]], fv = v[G.UR[h][p]], fw = v[G.W[h][p]];
      v[G.W[h][i]] = i & 1 ? 2 * (fu + fw) - fv : 2 * (fw + fv) - fu;
    }
}

// Two passes over the LEDs that give each one the distance to the nearest
// source and that source's coordinate along its path.
function nearest(src, qs, dist, qv) {
  for (let p = 0; p < NP; p++) {
    dist[p] = src[p] ? 0 : 1e3;
    qv[p] = qs[p];
  }
  const take = (p, n, w) => {
    const d = dist[n] + w;
    if (d < dist[p]) {
      dist[p] = d;
      qv[p] = qv[n];
    }
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (x > 0) take(p, p - 1, 1);
      if (y > 0) {
        take(p, p - W, 1);
        if (x > 0) take(p, p - W - 1, 1.41);
        if (x < W - 1) take(p, p - W + 1, 1.41);
      }
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x;
      if (x < W - 1) take(p, p + 1, 1);
      if (y < H - 1) {
        take(p, p + W, 1);
        if (x > 0) take(p, p + W - 1, 1.41);
        if (x < W - 1) take(p, p + W + 1, 1.41);
      }
    }
}

function build() {
  const G = { xc: new Float32Array(NV), dep: new Uint8Array(NV), UL: [[], []], UR: [[], []], W: [[], []] };
  const { xc, dep } = G;
  xc[0] = 32;
  for (let i = 1; i < NV; i++) {
    const p = (i - 1) >> 1, d = dep[p] + 1;
    dep[i] = d;
    xc[i] = xc[p] + (i & 1 ? -1 : 1) * (64 / (1 << (d + 1)));
  }
  for (let h = 0; h < 2; h++) {
    const lg = (l) => (h === 0 || l < 2 ? l : l + NV);
    for (let i = 0; i < NV; i++) {
      const p = (i - 1) >> 1;
      G.UL[h][i] = i === 0 ? 0 : i & 1 ? G.UL[h][p] : G.W[h][p];
      G.UR[h][i] = i === 0 ? 1 : i & 1 ? G.W[h][p] : G.UR[h][p];
      G.W[h][i] = lg(2 + i);
    }
  }
  // Edges: 0 is the middle edge, then (half, vertex, side) for the two child edges of each vertex.
  const eid = (h, i, s) => 1 + (h * NV + i) * 2 + s;
  G.ex1 = new Float32Array(NE); G.ey1 = new Float32Array(NE); G.ex2 = new Float32Array(NE); G.ey2 = new Float32Array(NE);
  G.ed = new Uint8Array(NE); G.ea = new Int16Array(NE); G.eb = new Int16Array(NE);
  G.et = new Int16Array(NE); G.eB = new Int16Array(NE); // node nearer the root, node at the far end (-1: the panel's edge)
  G.ex1[0] = 32; G.ey1[0] = YV[0]; G.ex2[0] = 32; G.ey2[0] = 128 - YV[0]; G.ea[0] = 0; G.eb[0] = 1; G.et[0] = 0; G.eB[0] = NV;
  const vy = (h, d) => (h === 0 ? YV[d] : 128 - YV[d]);
  for (let h = 0; h < 2; h++)
    for (let i = 0; i < NV; i++)
      for (let s = 0; s < 2; s++) {
        const e = eid(h, i, s), d = dep[i], ch = 2 * i + 1 + s;
        G.ex1[e] = xc[i]; G.ey1[e] = vy(h, d);
        G.ex2[e] = ch < NV ? xc[ch] : xc[i] + (s ? 1 : -1) * (64 / (1 << (d + 2)));
        G.ey2[e] = vy(h, d + 1);
        G.ed[e] = d;
        G.ea[e] = s ? G.W[h][i] : G.UL[h][i];
        G.eb[e] = s ? G.UR[h][i] : G.W[h][i];
        G.et[e] = h * NV + i;
        G.eB[e] = ch < NV ? h * NV + ch : -1;
      }
  // The edges meeting at each vertex: the one above it and its two child edges.
  G.inc = [];
  for (let h = 0; h < 2; h++)
    for (let i = 0; i < NV; i++) G.inc[h * NV + i] = [i === 0 ? 0 : eid(h, (i - 1) >> 1, i & 1 ? 0 : 1), eid(h, i, 0), eid(h, i, 1)];

  // Which face and which edge each LED belongs to, and when it is born.
  G.face = new Uint8Array(NP); G.gen = new Uint8Array(NP); G.edge = new Int16Array(NP).fill(-1); G.ef = new Float32Array(NP); G.bd = new Float32Array(NP).fill(9);
  const mid = 128 - YV[0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, px = x + 0.5;
      if (y >= mid && y < YV[0]) {
        G.face[p] = px < 32 ? 0 : 1;
        continue;
      }
      const h = y < mid ? 1 : 0, ty = h === 0 ? y + 0.5 : 128 - (y + 0.5);
      let i = 0, fu = 0, fv = 1;
      for (let d = 0; d < DEPTH; d++) {
        const x0 = xc[i], wd = 64 / (1 << d);
        if (ty < YV[d + 1] || d === DEPTH - 1) {
          const t = min(1, (ty - YV[d]) / HB[d]);
          const l = px < x0 - (wd / 4) * t ? fu : px > x0 + (wd / 4) * t ? fv : 2 + i;
          G.face[p] = h === 0 || l < 2 ? l : l + NV;
          G.gen[p] = d;
          break;
        }
        if (px < x0) {
          fv = 2 + i;
          i = 2 * i + 1;
        } else {
          fu = 2 + i;
          i = 2 * i + 2;
        }
      }
    }
  // Lines, thicker near the middle of the tree. Each LED takes the nearest edge within reach.
  const best = new Float32Array(NP).fill(9);
  G.lead = [0.82, 0.72, 0.64, 0.58, 0.54];
  G.flood = [1.15, 1.0, 0.85, 0.7, 0.6];
  for (let e = 0; e < NE; e++) {
    const x1 = G.ex1[e], y1 = G.ey1[e], dx = G.ex2[e] - x1, dy = G.ey2[e] - y1, L2 = dx * dx + dy * dy;
    const r = G.flood[e === 0 ? 0 : G.ed[e]];
    const xa = floor(min(x1, x1 + dx) - 2), xb = floor(max(x1, x1 + dx) + 2), ya = floor(min(y1, y1 + dy) - 2), yb = floor(max(y1, y1 + dy) + 2);
    for (let y = max(0, ya); y <= min(H - 1, yb); y++)
      for (let x = max(0, xa); x <= min(W - 1, xb); x++) {
        const t = cl(((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / L2, 0, 1), ex = x1 + dx * t - x - 0.5, ey = y1 + dy * t - y - 0.5, dd = sqrt(ex * ex + ey * ey), p = y * W + x;
        if (dd <= r && dd < best[p]) {
          best[p] = dd;
          G.bd[p] = dd;
          G.edge[p] = e;
          G.ef[p] = t;
          G.gen[p] = e === 0 ? 0 : G.ed[e];
        }
      }
  }
  G.elen = new Float32Array(NE);
  for (let e = 0; e < NE; e++) G.elen[e] = sqrt((G.ex2[e] - G.ex1[e]) ** 2 + (G.ey2[e] - G.ey1[e]) ** 2);
  // Distance from each LED to the nearest line: a face is lit a little more in its middle than at its rim.
  const src = new Uint8Array(NP), zero = new Float32Array(NP);
  for (let p = 0; p < NP; p++) src[p] = G.edge[p] >= 0 && G.bd[p] <= G.lead[G.ed[G.edge[p]]] ? 1 : 0;
  G.rim = new Float32Array(NP);
  nearest(src, zero, G.rim, new Float32Array(NP));
  return G;
}

export function setup(params) {
  const G = build();
  params.s = {
    G, hue: 0, a: 2, b: 0, c: -1, sig: "", tau: 0,
    tgt: new Float64Array(NF), cur: new Float64Array(NF), raw: new Float64Array(NF), labels: [],
    rgb: new Float32Array(NF * 3), isR: new Uint8Array(NE), seen: new Uint8Array(NE), q0: new Float32Array(NE), sg: new Int8Array(NE), qmax: 1, mode: 0,
    src: new Uint8Array(NP), qs: new Float32Array(NP), dist: new Float32Array(NP), qv: new Float32Array(NP),
    buf: new Uint8Array(NP * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[3], 0, 1) - 0.06;
  const b = cl(round(k[0]), -9, 9), a = cl(round(k[1]), -6, 6), c = cl(round(k[2]), -6, -1);
  const sig = a + "," + b + "," + c;
  if (sig !== S.sig) {
    const first = S.sig === "";
    S.sig = sig;
    S.a = a; S.b = b; S.c = c;
    topograph(a, b, c, S.raw, S.G);
    for (let f = 0; f < NF; f++) {
      const v = S.raw[f];
      S.tgt[f] = v < 0 ? -log2(1 - v) : log2(1 + v);
      if (first) S.cur[f] = S.tgt[f];
    }
    placeLabels(S);
  }
  const ease = 1 - exp(-d / 0.11);
  for (let f = 0; f < NF; f++) S.cur[f] += (S.tgt[f] - S.cur[f]) * ease;
  S.tau += d;
}

// The value of each big face written in it, as large as it fits clear of the lines.
function placeLabels(S) {
  const G = S.G, out = [];
  const fits = (f, text, sc, cx, cy) => {
    const w = text.length * 4 * sc - sc, h = 5 * sc, x0 = round(cx - w / 2), y0 = round(cy - h / 2);
    for (let y = y0 - 1; y <= y0 + h; y++)
      for (let x = x0 - 1; x <= x0 + w; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) return null;
        const p = y * W + x;
        if (G.face[p] !== f || (G.edge[p] >= 0 && G.bd[p] <= G.flood[G.ed[G.edge[p]]])) return null;
      }
    return { f, text, sc, x: x0, y: y0 };
  };
  const put = (f, cands) => {
    const text = String(S.raw[f]);
    for (const sc of [3, 2, 1])
      for (const [cx, cy] of cands) {
        const r = fits(f, text, sc, cx, cy);
        if (r) {
          out.push(r);
          return;
        }
      }
  };
  const side = [];
  for (let r = 0; r < 14; r++) for (let dx = -8; dx <= 8; dx += 2) side.push([dx, (r % 2 ? 1 : -1) * (r >> 1) * 2]);
  side.sort((p, q) => abs(p[0]) + abs(p[1]) - abs(q[0]) - abs(q[1]));
  put(0, side.map(([dx, dy]) => [15 + dx, 64 + dy]));
  put(1, side.map(([dx, dy]) => [49 + dx, 64 + dy]));
  for (let h = 0; h < 2; h++)
    for (let i = 0; i < 7; i++) {
      const cands = [];
      const y0 = h === 0 ? YV[G.dep[i]] : 128 - YV[G.dep[i]], sgn = h === 0 ? 1 : -1;
      for (let o = 3; o <= 22; o++) cands.push([G.xc[i], y0 + sgn * o]);
      put(G.W[h][i], cands);
    }
  S.labels = out;
}

// A face's colour from its value, eased: the warm side runs yellow, red, pink
// as the value grows and the cool side cyan, blue, violet, each dimmer the
// farther the value is from 0. A value of 0 is white.
function faceColour(s, hue, out) {
  const m = pow(2, abs(s)) - 1, t = 1 / (1 + m / 3.2), u = 1 - t;
  const h = s >= 0 ? 0.2 - 0.23 * u : 0.5 + 0.26 * u;
  hsv(h + hue, 0.16 + 0.76 * min(1, m / 0.8), 0.34 + 0.6 * t, out);
}

// The river is every edge with a positive face on one side and a negative on
// the other. It is one path with a node at most twice, so it is walked from
// either end of any of its edges, and the arc length along it is the
// coordinate that the pulses run on. A form that never changes sign has no
// river, and the coordinate is then the number of edges from its well.
function walkRiver(G, isR, e, node) {
  const out = [];
  while (node >= 0) {
    let nx = -1;
    for (const x of G.inc[node]) if (x !== e && isR[x]) nx = x;
    if (nx < 0) break;
    const dir = G.et[nx] === node ? 1 : -1;
    out.push({ e: nx, dir });
    node = dir > 0 ? G.eB[nx] : G.et[nx];
    e = nx;
  }
  return out;
}

function flow(S) {
  const G = S.G, { isR, seen, q0, sg } = S;
  let nR = 0;
  for (let e = 0; e < NE; e++) nR += isR[e];
  seen.fill(0);
  let qmax = 1;
  if (nR > 0) {
    for (let e0 = 0; e0 < NE; e0++) {
      if (!isR[e0] || seen[e0]) continue;
      const back = walkRiver(G, isR, e0, G.et[e0]).reverse().map((o) => ({ e: o.e, dir: -o.dir }));
      let path = back.concat([{ e: e0, dir: 1 }], walkRiver(G, isR, e0, G.eB[e0]));
      const y = (o, end) => (o.dir > 0) === end ? G.ey2[o.e] : G.ey1[o.e];
      if (y(path[0], false) > y(path[path.length - 1], true)) path = path.reverse().map((o) => ({ e: o.e, dir: -o.dir }));
      let acc = 0;
      for (const o of path) {
        q0[o.e] = acc;
        sg[o.e] = o.dir;
        seen[o.e] = 1;
        acc += G.elen[o.e];
      }
      qmax = max(qmax, acc);
    }
    S.mode = 1;
  } else {
    // The well: the vertex whose three faces are smallest, and the number of edges from it.
    let well = 0, bestS = 1e18;
    for (let n = 0; n < 2 * NV; n++) {
      const h = n < NV ? 0 : 1, i = n - h * NV;
      const sc = abs(S.raw[G.UL[h][i]]) + abs(S.raw[G.UR[h][i]]) + abs(S.raw[G.W[h][i]]);
      if (sc < bestS) {
        bestS = sc;
        well = n;
      }
    }
    const dn = new Int16Array(2 * NV).fill(-1), queue = [well];
    dn[well] = 0;
    for (let qi = 0; qi < queue.length; qi++) {
      const n = queue[qi];
      for (const e of G.inc[n]) {
        const o = G.et[e] === n ? G.eB[e] : G.et[e];
        if (o >= 0 && dn[o] < 0) {
          dn[o] = dn[n] + 1;
          queue.push(o);
        }
      }
    }
    for (let e = 0; e < NE; e++) {
      const dt = dn[G.et[e]], db = G.eB[e] >= 0 ? dn[G.eB[e]] : 99;
      if (dt <= db) {
        q0[e] = dt * 13;
        sg[e] = 1;
      } else {
        q0[e] = db * 13;
        sg[e] = -1;
      }
      qmax = max(qmax, q0[e] + 13);
    }
    S.mode = 0;
  }
  S.qmax = qmax;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { G, cur, rgb, buf, isR, src, qs, dist, qv } = S, tau = S.tau;
  for (let f = 0; f < NF; f++) faceColour(cur[f], S.hue, rgb.subarray(f * 3, f * 3 + 3));
  for (let e = 0; e < NE; e++) {
    // a face that is easing toward 0 counts as 0 once it is within 0.04 of it
    const pa = cur[G.ea[e]], pb = cur[G.eb[e]];
    isR[e] = (pa > 0.04 && pb < -0.04) || (pa < -0.04 && pb > 0.04) ? 1 : 0;
  }
  flow(S);
  // The coordinate of every LED on a line that carries a pulse.
  for (let p = 0; p < NP; p++) {
    const e = G.edge[p];
    if (e >= 0 && (S.mode === 0 || isR[e])) {
      src[p] = 1;
      qs[p] = S.q0[e] + G.elen[e] * (S.sg[e] > 0 ? G.ef[p] : 1 - G.ef[p]);
    } else {
      src[p] = 0;
      qs[p] = 0;
    }
  }
  nearest(src, qs, dist, qv);
  const SP = 70, head = (tau * 36) % SP + SP;
  const GOLD = [0, 0, 0];
  hsv(S.hue + 0.13, 0.2, 1, GOLD);
  // The picture grows from the middle edge outward, a soft front of 7 rows, so each
  // generation of vertices is drawn as the front reaches it, and every 22 s it is drawn in again.
  const tc = tau % 22, front = tc < 19.5 ? (tc - 0.15) * 44 : 85 - (tc - 19.5) * 60;
  const reveal = (y) => sm((front - abs(y + 0.5 - 64)) / 7);
  for (let p = 0; p < NP; p++) {
    const a = reveal(p >> 6);
    if (a <= 0) {
      buf[p * 3] = buf[p * 3 + 1] = buf[p * 3 + 2] = 0;
      continue;
    }
    const e = G.edge[p], de = e >= 0 ? G.ed[e] : 0;
    const u = (((head - qv[p]) % SP) + SP) % SP, pulse = exp(-u / 9), ring = S.mode === 0;
    let r, gg, bb;
    if (e >= 0 && isR[e] && G.bd[p] <= G.flood[de]) {
      const k = 0.88 + 0.12 * pulse, w = 0.7 * pulse;
      r = min(1, GOLD[0] * k + w); gg = min(1, GOLD[1] * k + w); bb = min(1, GOLD[2] * k + w);
    } else if (e >= 0 && G.bd[p] <= G.lead[de]) {
      const k = ring ? pulse * 0.95 : 0;
      r = 0.02 + GOLD[0] * k; gg = 0.02 + GOLD[1] * k; bb = 0.02 + GOLD[2] * k;
    } else {
      const f = G.face[p], shade = 0.74 + 0.26 * sm(G.rim[p] / 4);
      const bank = dist[p] < 20 ? exp(-dist[p] / 3.5) : 0, k = shade * (1 + (ring ? 0 : 0.3) * bank), w = (ring ? 0.3 : 0.75 * bank) * pulse;
      r = min(1, rgb[f * 3] * k + w * 0.5); gg = min(1, rgb[f * 3 + 1] * k + w * 0.5); bb = min(1, rgb[f * 3 + 2] * k + w * 0.5);
    }
    buf[p * 3] = min(255, r * a * 255);
    buf[p * 3 + 1] = min(255, gg * a * 255);
    buf[p * 3 + 2] = min(255, bb * a * 255);
  }
  for (const L of S.labels) {
    const a = reveal(L.y + 2 * L.sc) * 0.9;
    if (a <= 0) continue;
    const f = L.f, br = 0.3 * rgb[f * 3] + 0.59 * rgb[f * 3 + 1] + 0.11 * rgb[f * 3 + 2], c = br > 0.42 ? 0.03 : 0.95;
    for (let n = 0; n < L.text.length; n++) {
      const gl = GLYPH[L.text[n]];
      for (let i = 0; i < 15; i++)
        if (gl[i])
          for (let dy = 0; dy < L.sc; dy++)
            for (let dx = 0; dx < L.sc; dx++) {
              const o = ((L.y + floor(i / 3) * L.sc + dy) * W + L.x + n * 4 * L.sc + (i % 3) * L.sc + dx) * 3;
              buf[o] = buf[o] * (1 - a) + c * 255 * a;
              buf[o + 1] = buf[o + 1] * (1 - a) + c * 255 * a;
              buf[o + 2] = buf[o + 2] * (1 - a) + c * 255 * a;
            }
    }
  }
  for (let p = 0; p < NP; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
