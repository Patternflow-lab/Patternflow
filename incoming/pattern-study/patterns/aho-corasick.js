// ===== Patternflow pattern =====
// Title:   Aho-Corasick
// Family:  type
// Idea:    A dictionary of twelve words stands as an automaton down the whole tall panel, one capital to a state, and a text is read letter by letter from a page at the foot while a light moves through the tree, falling back up faint failure arcs one flashing hop at a time whenever the state has no child for the letter, and every word the state ends, or reaches along its output links, flashes gold, is underlined in the text and ticks the counter at the top.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Aho-Corasick string matching (Alfred Aho and Margaret Corasick, 1975, from memory), whose failure links are found by a breadth-first walk over the trie of the words, checked here against a brute-force suffix search; the contour-packed tree layout of Trie (pattern round 109); the 3 by 5 capitals of Saccades (pattern round 106) and the digits drawn for Kasiski Examination (pattern round 108), copied from edit-distance.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Words=1..4, Text=1..4
//
// Knob 1: Hue. Turns every colour round the wheel together, skipping the stretch from orange to lime that reads brown on dim letters. At 0 the states are azure, the ends of words and the words found are gold, the failure links are magenta and the state in hand is white; at 0.25 the states are violet and at 0.75 they are green.
// Knob 2: Speed. At 2 the tree grows in over 1.4 s, a letter is read in 0.2 s, a failure link takes 0.45 s to follow, a step down the tree takes 0.3 s and a found word is held 0.7 s. THIS SHEPHERD STARTS HERS is read in 23.7 s, held 3 s, faded for 0.7 s and begun again: 27.4 s round. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Words. Which dictionary, snapping at whole numbers. 1, where it opens, has twelve words from HE to SHEPHERD and STARTERS: 36 states in 8 levels, 23 failure links that do not end at the root and 6 output links. 2 has twelve words round RETRACE: 35 states, 7 levels, 29 failure links, 8 output links. 3 has ten words round BANANA: 22 states, 6 levels, 16 and 5. 4 is the paper's HE, SHE, HIS and HERS: 10 states, 4 levels, 4 failure links and 1 output link, drawn twice the size.
// Knob 4: Text. Which text is read, snapping at whole numbers, four for each dictionary. For dictionary 1: THIS SHEPHERD STARTS HERS (where it opens) reports 12 words after following 10 failure links, SHE STARTS THE TEA reports 7 after 9, THE START IS THE ART OF TEA reports 8 after 12 and USHERS THIS SHEPHERD HERS reports 12 after 8. Dictionary 4 starts with the paper's own USHERS, which reports SHE, HE and HERS after one failure link.

const W = 64, H = 128;
const { floor, round, min, max, sin, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
const wheel = (k) => (0.22 + ((0.33 + 0.81 * k) % 0.81)) % 1;

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, copied from edit-distance.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => c === "#");

// The four dictionaries, and four texts for each. The first set is the tall one.
const WORDS = [
  ["HE", "SHE", "HERS", "HIS", "THIS", "IS", "SHEPHERD", "START", "STARTERS", "ART", "TART", "TEA"],
  ["ACE", "RACE", "TRACE", "RETRACE", "CART", "CARE", "ART", "ARE", "TREE", "TEAR", "EAR", "RE"],
  ["BANANA", "ANA", "NAN", "NA", "BAN", "BAND", "AND", "DAN", "ANT", "TAN"],
  ["HE", "SHE", "HIS", "HERS"],
];
const TEXTS = [
  ["THIS SHEPHERD STARTS HERS", "SHE STARTS THE TEA", "THE START IS THE ART OF TEA", "USHERS THIS SHEPHERD HERS"],
  ["RETRACE THE CART TO THE TREE", "TEAR THE RACE CARE", "RETRACES THE CART", "CARE FOR THE TREE AT THE ARE"],
  ["BANANA BAND ANT TAN AND DAN", "BANANAS ARE NAN", "TAN ANTS AND BANANAS", "DAN ANT BANDANA"],
  ["USHERS", "USHERS SHE HERS", "HISHERS USHERS", "SHE HIS HERS HE"],
];
// Spacing of the nodes along a level, and the size of the letters, for each set.
const SEP = [5, 5, 7, 11], SCALE = [1, 1, 1, 2];

// Seconds at Speed 2.
const INTRO = 1.4, READ = 0.2, HOP = 0.45, MOVE = 0.3, MISS = 0.2, HIT = 0.7, NOHIT = 0.04, HOLD = 3, FADE = 0.7;

// The automaton, built the way the paper builds it: a trie of the words, then the failure links by a breadth-first walk. The
// failure link of a state is the longest proper suffix of its string that is also a state; the output link of a state is the
// nearest state down its failure chain that ends a word.
function build(words) {
  const nodes = [{ ch: "", par: -1, depth: 0, kids: {}, term: -1 }];
  words.forEach((w, wi) => {
    let s = 0;
    for (const c of w) {
      if (nodes[s].kids[c] === undefined) {
        nodes.push({ ch: c, par: s, depth: nodes[s].depth + 1, kids: {}, term: -1 });
        nodes[s].kids[c] = nodes.length - 1;
      }
      s = nodes[s].kids[c];
    }
    nodes[s].term = wi;
  });
  const fail = new Array(nodes.length).fill(0), out = new Array(nodes.length).fill(-1), queue = Object.values(nodes[0].kids);
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const c of Object.keys(nodes[u].kids)) {
      const v = nodes[u].kids[c];
      let f = fail[u];
      while (f !== 0 && nodes[f].kids[c] === undefined) f = fail[f];
      fail[v] = nodes[f].kids[c] !== undefined && nodes[f].kids[c] !== v ? nodes[f].kids[c] : 0;
      out[v] = nodes[fail[v]].term >= 0 ? fail[v] : out[fail[v]];
      queue.push(v);
    }
  }
  const depth = max(...nodes.map((n) => n.depth));
  return { nodes, fail, out, depth, words, nonroot: fail.filter((f, i) => i > 0 && f !== 0).length, outl: out.filter((o) => o >= 0).length };
}

// Where each state is drawn: children in alphabetical order, each next subtree pushed right until it clears the one before on
// every level, a parent over the middle of its first and last child.
function layout(A, sep, sc) {
  const { nodes } = A, NN = nodes.length, lc = [], rc = [], off = [];
  const kids = (k) => Object.keys(nodes[k].kids).sort().map((c) => nodes[k].kids[c]);
  for (let k = NN - 1; k >= 0; k--) {
    const ks = kids(k);
    if (!ks.length) {
      lc[k] = [0];
      rc[k] = [0];
      continue;
    }
    const offs = [0], aL = lc[ks[0]].slice(), aR = rc[ks[0]].slice();
    for (let j = 1; j < ks.length; j++) {
      const L = lc[ks[j]], R = rc[ks[j]];
      let need = -1e9;
      for (let l = 0; l < min(aR.length, L.length); l++) need = max(need, aR[l] + sep - L[l]);
      offs.push(need);
      for (let l = 0; l < R.length; l++) {
        if (l < aR.length) aR[l] = R[l] + need;
        else {
          aR.push(R[l] + need);
          aL.push(L[l] + need);
        }
      }
    }
    const mid = floor((offs[0] + offs[offs.length - 1]) / 2);
    lc[k] = [0, ...aL.map((v) => v - mid)];
    rc[k] = [0, ...aR.map((v) => v - mid)];
    ks.forEach((c, j) => (off[c] = offs[j] - mid));
  }
  const X = new Array(NN).fill(0);
  let lo = 0, hi = 0;
  for (let k = 1; k < NN; k++) {
    X[k] = X[nodes[k].par] + off[k];
    lo = min(lo, X[k]);
    hi = max(hi, X[k]);
  }
  const sh = 32 - floor((lo + hi) / 2), pitch = min(20, floor(88 / A.depth)), Y = [];
  for (let k = 0; k < NN; k++) {
    X[k] += sh;
    Y[k] = 9 + pitch * nodes[k].depth;
  }
  return { X, Y, pitch };
}

// The run of one text through one automaton: what is read, which failure links are followed, where the machine lands and
// which words it reports, each with the time it happens.
function plan(A, text) {
  const { nodes, fail, out } = A, steps = [], keys = [];
  let s = 0, t = INTRO, hitsAll = 0, hopsAll = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], st = { i, c, t0: t, hops: [], move: null, hits: [], th: 0 };
    t += READ;
    while (s !== 0 && nodes[s].kids[c] === undefined) {
      st.hops.push({ a: s, b: fail[s], t });
      keys.push({ t: t + 0.26, d: 0.18, from: s, to: fail[s] });
      s = fail[s];
      t += HOP;
      hopsAll++;
    }
    const nx = nodes[s].kids[c];
    if (nx !== undefined) {
      st.move = { a: s, b: nx, t };
      keys.push({ t, d: MOVE * 0.8, from: s, to: nx });
      s = nx;
      t += MOVE;
    } else t += MISS;
    for (let o = nodes[s].term >= 0 ? s : out[s]; o >= 0; o = out[o]) st.hits.push(o);
    st.state = s;
    st.th = t;
    t += st.hits.length ? HIT : NOHIT;
    hitsAll += st.hits.length;
    steps.push(st);
  }
  // The page: words kept whole, up to 16 letters to a line, letter j at pos[j].
  const lines = [], pos = [];
  let cur = "", at = 0;
  for (const w of text.split(" ")) {
    if ((cur ? cur.length + 1 : 0) + w.length > 16) (lines.push(cur), (cur = w));
    else cur = cur ? cur + " " + w : w;
  }
  lines.push(cur);
  lines.forEach((ln, r) => {
    for (let c = 0; c < ln.length; c++) pos[at++] = [1 + 4 * c, 106 + 10 * r];
    pos[at++] = [1 + 4 * ln.length, 106 + 10 * r];
  });
  return { text, steps, keys, lines, pos, end: t, total: t + HOLD + FADE, hits: hitsAll, hops: hopsAll };
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, ws: -1, ts: -1, T: 0, rgb: new Float32Array(W * H * 3), A: null, L: null, P: null };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const ws = cl(round(kv[2]), 1, 4) - 1, ts = cl(round(kv[3]), 1, 4) - 1;
  if (ws !== S.ws) {
    S.ws = ws;
    S.A = build(WORDS[ws]);
    S.L = layout(S.A, SEP[ws], SCALE[ws]);
    S.ts = -1;
  }
  if (ts !== S.ts) {
    S.ts = ts;
    S.P = plan(S.A, TEXTS[ws][ts]);
    S.T = 0;
  }
  S.T += (d * S.speed) / 2;
  if (S.T >= S.P.total) S.T = 0;
}

// Blend colour c over the frame at weight a.
function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3, k = min(1, a);
  rgb[o] += (c[0] - rgb[o]) * k;
  rgb[o + 1] += (c[1] - rgb[o + 1]) * k;
  rgb[o + 2] += (c[2] - rgb[o + 2]) * k;
}
function glyph(rgb, ch, x, y, c, a, sc) {
  const g = GLYPH[ch];
  if (!g) return;
  for (let i = 0; i < 15; i++)
    if (g[i]) for (let v = 0; v < sc; v++) for (let u = 0; u < sc; u++) put(rgb, x + (i % 3) * sc + u, y + floor(i / 3) * sc + v, c, a);
}
function number(rgb, n, x, y, c, a) {
  for (const ch of String(n)) {
    glyph(rgb, ch, x, y, c, a, 1);
    x += 4;
  }
}
const mix = (a, b, t, out) => ((out[0] = a[0] + (b[0] - a[0]) * t), (out[1] = a[1] + (b[1] - a[1]) * t), (out[2] = a[2] + (b[2] - a[2]) * t), out);

// A curve from (ax, ay) to (bx, by) bulging sideways, drawn as dots up to fraction f of its length.
function arc(rgb, ax, ay, bx, by, side, bulge, c, a, f) {
  const cx = (ax + bx) / 2 + side * bulge, cy = (ay + by) / 2, n = 40;
  for (let k = 0; k <= n * f; k++) {
    const u = k / n, v = 1 - u;
    put(rgb, round(v * v * ax + 2 * u * v * cx + u * u * bx), round(v * v * ay + 2 * u * v * cy + u * u * by), c, a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const { A, L, P, rgb, T } = S, { nodes, fail, out } = A, sc = SCALE[S.ws], NN = nodes.length;
  rgb.fill(0);
  const hb = wheel(S.hue), tmp = [0, 0, 0];
  const pale = hsv(hb, 0.25, 1, [0, 0, 0]), azure = hsv(hb, 0.6, 1, [0, 0, 0]), dim = hsv(hb, 0.7, 0.5, [0, 0, 0]), gold = hsv(hb - 0.44, 0.75, 1, [0, 0, 0]);
  const rose = hsv(hb + 0.3, 0.7, 1, [0, 0, 0]), white = [1, 1, 1], roseHot = hsv(hb + 0.3, 0.35, 1, [0, 0, 0]);
  const fade = T > P.total - FADE ? sm((P.total - T) / FADE) : 1;
  const gw = 3 * sc, gh = 5 * sc, X = L.X, Y = L.Y;
  const grow = (k) => sm((T - 0.12 * nodes[k].depth) / 0.5);

  // Where the machine is: the last stretch it was sliding along, interpolated.
  let cur = 0, mx = X[0], my = Y[0], seen = 0;
  const visits = new Array(NN).fill(0), lastAt = new Array(NN).fill(-9);
  for (const k of P.keys) {
    if (k.t > T) break;
    const f = sm((T - k.t) / k.d);
    if (f >= 1) {
      cur = k.to;
      mx = X[cur];
      my = Y[cur];
      visits[k.to]++;
      lastAt[k.to] = k.t + k.d;
    } else {
      cur = k.from;
      mx = X[k.from] + (X[k.to] - X[k.from]) * f;
      my = Y[k.from] + (Y[k.to] - Y[k.from]) * f;
      break;
    }
  }
  // The step in hand.
  let si = -1;
  for (let q = 0; q < P.steps.length; q++) if (P.steps[q].t0 <= T) si = q;
  const st = si >= 0 ? P.steps[si] : null, intro = T < INTRO;

  // Edges: an elbow from each parent, brighter on the path from the root to the machine.
  const onPath = new Array(NN).fill(false);
  for (let k = cur; k > 0; k = nodes[k].par) onPath[k] = true;
  for (let k = 1; k < NN; k++) {
    const g = grow(k);
    if (g <= 0.02) continue;
    const p = nodes[k].par, e = onPath[k] ? 0.95 : 0.4 + 0.18 * min(1, visits[k] / 2);
    const top = Y[p] + gh + (p ? 0 : 1), bus = top + floor((L.pitch - gh) / 2) - 1, c = onPath[k] ? pale : dim;
    for (let y = top; y <= bus; y++) put(rgb, X[p], y, c, e * g * fade);
    for (let x = min(X[p], X[k]); x <= max(X[p], X[k]); x++) put(rgb, x, bus, c, e * g * fade);
    for (let y = bus; y < Y[k] - 1; y++) put(rgb, X[k], y, c, e * g * fade);
  }

  // Failure links: every one that does not end at the root, as a faint arc up the side; the machine's own is brighter.
  const bulgeOf = (k) => 5 + 0.14 * (Y[k] - Y[fail[k]]) + (k % 3) * 1.5;
  const ends = (k) => {
    const sideOf = (X[k] + X[fail[k]]) / 2 < 32 ? -1 : 1, rr = sideOf * (gw / 2 + 1.5);
    return { sd: sideOf, ax: X[k] + rr, ay: Y[k] + gh / 2, bx: X[fail[k]] + rr, by: Y[fail[k]] + gh / 2 };
  };
  for (let k = 1; k < NN; k++) {
    if (fail[k] === 0) continue;
    const e = ends(k), g = grow(k) * fade, now = k === cur && !intro ? 0.6 : 0.13;
    arc(rgb, e.ax, e.ay, e.bx, e.by, e.sd, bulgeOf(k), rose, now * g, 1);
  }
  // A failure link being followed lights along its length and then the machine lands.
  if (st)
    for (const h of st.hops) {
      const f = cl((T - h.t) / 0.26, 0, 1);
      if (f <= 0 || T > h.t + 0.5 + HOP) continue;
      const e = ends(h.a), a = T < h.t + HOP ? 1 : max(0, 1 - (T - h.t - HOP) / 0.5);
      arc(rgb, e.ax, e.ay, e.bx, e.by, e.sd, bulgeOf(h.a), roseHot, a * fade, f);
    }
  // A found word: the path from the state down its output links, in gold.
  const hitNow = st && st.hits.length && T >= st.th && T < st.th + HIT ? st : null;
  const flash = hitNow ? exp(-(T - hitNow.th) * 2.2) : 0;
  if (hitNow)
    for (let q = 0; q + 1 < hitNow.hits.length; q++) {
      const a = hitNow.hits[q], b = hitNow.hits[q + 1], sd = (X[a] + X[b]) / 2 < 32 ? -1 : 1, rr = sd * (gw / 2 + 1.5);
      arc(rgb, X[a] + rr, Y[a] + gh / 2, X[b] + rr, Y[b] + gh / 2, sd, 8 + 0.12 * Math.abs(Y[a] - Y[b]), gold, (0.5 + 0.5 * flash) * fade, 1);
    }

  // The root, then the states.
  const rg = grow(0) * fade, rx = X[0], ry = Y[0] + floor(gh / 2);
  const rr = 2 * sc;
  for (let a = 0; a < 16 * sc; a++) {
    const t = (a / (16 * sc)) * 2 * PI;
    put(rgb, round(rx + rr * Math.cos(t)), round(ry + rr * sin(t)), cur === 0 && !intro ? white : pale, (cur === 0 ? 0.95 : 0.6) * rg);
  }
  for (let k = 1; k < NN; k++) {
    const g = grow(k) * fade;
    if (g <= 0.02) continue;
    const heat = min(1, visits[k] / 3), recent = exp(-(T - lastAt[k]) * 1.1) * (lastAt[k] > -9 ? 1 : 0);
    const terminal = nodes[k].term >= 0;
    const base = terminal ? gold : azure;
    let c = mix(dim, base, 0.7 + 0.3 * max(heat, recent), tmp), a = 0.75 + 0.15 * heat + 0.1 * recent;
    if (k === cur && !intro) {
      mix(c, white, 0.9, tmp);
      c = tmp;
      a = 1;
    }
    const fl = hitNow && hitNow.hits.includes(k) ? flash : 0;
    if (fl > 0) {
      mix(c, white, 0.5 * fl, tmp);
      c = tmp;
      a = 1;
      for (let v = -1; v < gh + 1; v++) for (let u = -1; u < gw + 1; u++) put(rgb, X[k] - floor(gw / 2) + u, Y[k] + v, gold, 0.4 * fl * fade);
    }
    glyph(rgb, nodes[k].ch, X[k] - floor(gw / 2), Y[k], c, a * g, sc);
  }
  // The machine itself: a soft box of light under the letter it is on, or over the root.
  if (!intro) {
    for (let v = -1; v < gh + 1; v++)
      for (let u = -2; u <= gw + 1; u++) put(rgb, round(mx) - floor(gw / 2) + u, round(my) + v, azure, 0.22 * fade);
  }

  // The text, as a page at the foot: two lines of up to 16 letters, the letter in hand white, the letters read dim, and each
  // word found underlined in gold, the longest word nearest the letters.
  const ta = (intro ? sm((T - 0.3) / 0.8) : 1) * fade, lines = P.lines;
  const at = (j) => P.pos[j];
  for (let j = 0; j < P.text.length; j++) {
    const ch = P.text[j], [px, py] = at(j), read = st && j < st.i, now = st && j === st.i;
    if (ch === " ") continue;
    if (now) for (let v = -1; v < 6; v++) for (let u = -1; u < 4; u++) put(rgb, px + u, py + v, azure, 0.3 * ta);
    glyph(rgb, ch, px, py, now ? white : read ? dim : pale, (now ? 1 : read ? 0.8 : 1) * ta, 1);
  }
  for (const sp of P.steps) {
    if (!sp.hits.length || T < sp.th) continue;
    sp.hits.forEach((h, q) => {
      const len = nodes[h].depth, [x0, y0] = at(sp.i - len + 1), [x1] = at(sp.i), a = (T - sp.th < 0.5 ? 1 : 0.7) * ta;
      for (let x = x0; x <= x1 + 2; x++) put(rgb, x, y0 + 6 + q, gold, a);
    });
  }
  // The letters in hand, large, beside the root: the one being read on the right and the three before it. The one being read
  // stays while the machine follows failure links.
  if (st && !intro)
    for (let q = 0; q < 4; q++) {
      const j = st.i - 3 + q, x = 36 + 7 * q;
      if (j < 0) continue;
      const ch = P.text[j], c = q === 3 ? white : dim, a = (q === 3 ? 0.95 : 0.35 + 0.15 * q) * fade;
      if (ch === " ") for (let u = 0; u < 6; u++) put(rgb, x + u, 17, c, a);
      else glyph(rgb, ch, x, 7, c, a, 2);
    }

  // The top: states, failure links that do not end at the root, and the words reported so far.
  let found = 0;
  for (const sp of P.steps) if (T >= sp.th) found += sp.hits.length;
  const fa = (intro ? sm((T - 0.4) / 0.6) : 1) * fade;
  const nums = [[NN, azure], [A.nonroot, rose], [found, gold]];
  nums.forEach(([v, c], q) => {
    const x = 3 + q * 21;
    for (let v2 = 0; v2 < 5; v2++) for (let u = 0; u < 3; u++) put(rgb, x + u, 1 + v2, c, 0.4 * fa);
    number(rgb, v, x + 4, 1, v === found && q === 2 && hitNow ? mix(gold, white, flash * 0.6, tmp) : c, fa);
  });

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
