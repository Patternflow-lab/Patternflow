// ===== Patternflow pattern =====
// Title:   Arc Diagram
// Family:  repeatarcs
// Idea:    A never-ending tune of coloured bars scrolls up a strip on the left edge, and every passage that comes back later is joined to its earlier self by a thick half-ring bulging sideways from the strip, so repeats nest into concentric rainbow bands and the longest return reaches the far edge of the panel.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: arc diagrams for the repeats in a string (Martin Wattenberg, "Arc Diagrams: Visualizing Structure in Strings", 2002, and his Shape of Song, from memory), pattern round 229
// Round:   229
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=0.5..4, Repeat=-1..1, Span=-1..1
//
// Knob 1: Hue. Where the motif colours start on the wheel. Each motif is a golden angle (137.5 degrees) on from the one before it, and the whole palette turns once round between 0 and 1. The first motif's hue is 24 degrees at 0, a warm coral.
// Knob 2: Tempo. How many bars of the tune go by each second: 0.5 at the left end, 2 where it opens, 4 at the right end. The panel scrolls up with it, 0.9 LEDs a second at 0.5 and 7 at 4, at the span it opens on.
// Knob 3: Repeat. How often the tune goes back to earlier material instead of inventing new. The song steers itself toward a share of the panel lit by bands, about a third at -1 (a few wide arcs), a half at 0 (about 30 arcs), seven tenths at +1 (copies of copies, a thicket of nested rings). The bars below the panel are recomposed the moment the knob moves, so the arcs rising from the bottom change at once and the rest follows as the tune scrolls.
// Knob 4: Span. How many bars the panel shows, 48 at -1 (each bar 2.7 LEDs tall, the arcs few and fat), 69 where it opens (1.85 LEDs), 96 at +1 (1.33 LEDs, more and thinner rings). The shortest repeat drawn is 2 bars while a bar is 2.4 LEDs or more (span under 54) and 3 bars beyond, so no band is thinner than 3 LEDs.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const RING = 1024, MASK = RING - 1; // bar memory
const HIST = 190; // bars searched for repeats
const AHEAD = 0.45; // how far past the bottom edge the tune is already composed, in spans
const STRIP = 3; // LEDs of the baseline strip
const GOLD = 137.508;
const FILL = 0.56; // share of a repeat's length that its band fills

// ---- colour ----------------------------------------------------------------
// One colour per degree of hue, at a lightness that keeps blue and violet visible and yellow from going pale.
const HUELUT = new Float32Array(360 * 3);
function oklch(L, C, Hd, out, o) {
  const h = (Hd * PI) / 180;
  let c = C;
  for (let it = 0; it < 24; it++) {
    const a = c * cos(h), b = c * sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if ((r >= 0 && r <= 1 && g >= 0 && g <= 1 && bl >= 0 && bl <= 1) || it === 23) {
      const enc = (x) => 255 * (x <= 0.0031308 ? 12.92 * max(0, x) : 1.055 * cl(x, 0, 1) ** (1 / 2.4) - 0.055);
      out[o] = enc(r); out[o + 1] = enc(g); out[o + 2] = enc(bl);
      return;
    }
    c *= 0.95;
  }
}
for (let d = 0; d < 360; d++) {
  const L = 0.72 + 0.17 * max(0, cos(((d - 108) * PI) / 180)) - 0.05 * max(0, cos(((d - 265) * PI) / 180));
  oklch(L, 0.17, d, HUELUT, d * 3);
}
function hueRGB(deg, out) {
  let d = deg % 360;
  if (d < 0) d += 360;
  const i = floor(d), f = d - i, j = i === 359 ? 0 : i + 1;
  for (let k = 0; k < 3; k++) out[k] = HUELUT[i * 3 + k] * (1 - f) + HUELUT[j * 3 + k] * f;
}

// ---- the tune --------------------------------------------------------------
// A bar is a motif id, kept mod 256. The tune is made of sections: new ones, drawn from the active repertoire
// by a chain whose transition weights are fixed per pair of motifs; copies of earlier sections, whole or
// changed in one bar; and a chorus that comes back after a gap and now and then is replaced.
function pairWeight(a, b) {
  const x = Math.sin((a * 31 + b * 17 + 3) * 12.9898) * 43758.5453;
  const u = x - floor(x);
  return 0.12 + 1.9 * u * u;
}

function newMotif(P) {
  const id = P.nextId++ & 255;
  P.act.push(id);
  P.fresh = id;
  return id;
}

function pickActive(P, not) {
  const act = P.act;
  let tot = 0;
  for (let i = 0; i < act.length; i++) if (act[i] !== not) tot += 1 + 0.12 * i; // newer motifs a little likelier
  let r = Math.random() * tot;
  for (let i = 0; i < act.length; i++) {
    if (act[i] === not) continue;
    r -= 1 + 0.12 * i;
    if (r <= 0) return act[i];
  }
  return act[0];
}

function chainOnce(P, len) {
  const bars = [];
  let cur = P.fresh >= 0 && P.act.includes(P.fresh) && Math.random() < 0.8 ? P.fresh : pickActive(P, barAt(P, P.n - 1));
  bars.push(cur);
  while (bars.length < len) {
    let tot = 0;
    const act = P.act;
    for (let i = 0; i < act.length; i++) if (act[i] !== cur) tot += pairWeight(cur, act[i]);
    let r = Math.random() * tot, nx = act[0];
    for (let i = 0; i < act.length; i++) {
      if (act[i] === cur) continue;
      r -= pairWeight(cur, act[i]);
      if (r <= 0) { nx = act[i]; break; }
    }
    cur = nx;
    bars.push(cur);
  }
  return bars;
}

// New material is new: no pair of bars in a row that the last NOV bars already hold, so the repeats that show
// are the ones the tune meant, and chance echoes are far apart.
const NOV = 90;
function chain(P, len) {
  let best = null, bestHits = 1e9;
  for (let tries = 0; tries < 24; tries++) {
    const bars = chainOnce(P, len);
    let hits = 0, prev = barAt(P, P.n - 1);
    for (let i = 0; i < bars.length; i++) {
      const t = P.bi.get((prev << 8) | bars[i]);
      if (t !== undefined && t > P.n - NOV) hits++;
      prev = bars[i];
    }
    if (hits < bestHits) { bestHits = hits; best = bars; }
    if (!hits) break;
  }
  P.fresh = -1;
  return best;
}

// One bar of a copy changed. A change in the middle of a long section splits its arc in two; in a short one it
// stays at an end, so what is left is still an arc.
function vary(P, bars) {
  const b = bars.slice();
  const len = b.length, r = Math.random();
  const i = len >= 7 ? 3 + ((Math.random() * (len - 6)) | 0) : Math.random() < 0.5 ? 0 : len - 1;
  const other = (k) => {
    for (let tries = 0; tries < 8; tries++) {
      const v = pickActive(P, b[k]);
      if (v !== (b[k - 1] ?? -1) && v !== (b[k + 1] ?? -1)) return v;
    }
    return pickActive(P, b[k]);
  };
  if (r < 0.7 || len < 4) b[i] = other(i);
  else if (r < 0.85) b.splice(i, 1);
  else { b.splice(i, 0, 0); b[i] = other(i === 0 ? 1 : i); }
  return b;
}

function barAt(P, k) { return P.seq[k & MASK]; }

function sectionBars(P, s) {
  const out = [];
  for (let k = s.s; k < s.e; k++) out.push(barAt(P, k));
  return out;
}

// gen counts how many copies deep a section is: new material is 0, a copy of it 1, a copy of that 2.
function queue(P, bars, gen) {
  for (let i = 0; i < bars.length; i++) {
    P.q.push(bars[i]);
    P.qb.push(i === 0 ? bars.length : 0);
    P.qg.push(gen);
  }
}

function retune(P) {
  // the repertoire moves on: the oldest motif retires and a new one comes in, between 8 and 12 at a time
  const want = 10 + round2(1.1 * sin(P.n * 0.0231) + 0.9 * sin(P.n * 0.0097 + 1));
  if (P.act.length > want) P.act.shift();
  else if (P.act.length < want) newMotif(P);
  else { P.act.shift(); newMotif(P); }
}
const round2 = (v) => floor(v + 0.5);

function newSection(P) {
  if (Math.random() < 0.2) retune(P);
  if (Math.random() < 0.34) {
    // a phrase and its answer: the second half is the first with a bar changed
    const half = Math.random() < 0.5 ? 3 : 4;
    const first = chain(P, half);
    return first.concat(vary(P, first));
  }
  return chain(P, [3, 4, 4, 5, 6, 6, 8][(Math.random() * 7) | 0]);
}

function planNext(P) {
  const rep = P.rep, n = P.n, secs = P.secs;
  if (secs.length < 3) {
    // the opening: a few sections of new material
    while (P.act.length < 9) newMotif(P);
    queue(P, chain(P, [3, 4, 4, 5][(Math.random() * 4) | 0]), 0);
    P.last = 0;
    return;
  }
  const lastS = secs[secs.length - 1];
  // how much of the panel the bands cover is steered: when they crowd it, fewer copies; when it thins, more
  const want = 0.32 + 0.38 * rep;
  const steer = cl(1 - 1.2 * (P.cover - want) / want, 0.5, 1.5);
  // the chorus: made from the last two sections, then brought back after a gap and now and then replaced
  if (n >= P.nextChorus) {
    if (!P.chorus || P.chorusUses >= P.chorusMax) {
      const a = secs[secs.length - 2];
      P.chorus = sectionBars(P, a).concat(sectionBars(P, lastS));
      if (P.chorus.length > 8) P.chorus = sectionBars(P, lastS);
      P.chorusUses = 0;
      P.chorusMax = Math.random() < 0.3 ? 2 : 1;
      queue(P, P.chorus.slice(), 2);
    } else {
      queue(P, Math.random() < 0.4 ? vary(P, P.chorus) : P.chorus.slice(), 2);
      P.chorusUses++;
    }
    P.nextChorus = n + P.chorus.length + (12 + ((Math.random() * 22) | 0)) * (1.4 - 0.7 * rep);
    P.last = 1;
    return;
  }
  // the theme: something from a long way back, as far back as the diagram reaches, comes round again
  if (n >= P.nextTheme) {
    const cand = [];
    for (let j = 0; j < secs.length; j++) {
      const D = n - secs[j].s, L = secs[j].e - secs[j].s;
      if (L >= 3 && secs[j].gen <= 1 && secs[j].uses < 2 && D + L >= 0.62 * P.span && D + L <= 1.55 * P.span && barAt(P, secs[j].s) !== barAt(P, n - 1)) cand.push(j);
    }
    if (cand.length) {
      const j = cand[(Math.random() * cand.length) | 0];
      let bars = sectionBars(P, secs[j]);
      if (Math.random() < 0.3) bars = vary(P, bars);
      secs[j].uses++;
      queue(P, bars, 2);
      P.nextTheme = n + P.span * (0.3 + 0.35 * Math.random()) * (1.2 - 0.5 * rep);
      P.last = 1;
      return;
    }
  }
  const pCopy = (0.14 + 0.5 * rep + 0.3 * rep * rep) * steer * (P.last ? 0.66 : 1);
  if (Math.random() < pCopy) {
    // a source: one section or two, from the recent past; short ones may follow right behind, long ones leave a gap
    const k = Math.random() < 0.7 ? 1 : 2;
    const cand = [], wts = [];
    for (let j = 0; j + k <= secs.length; j++) {
      const s0 = secs[j].s, e0 = secs[j + k - 1].e;
      const L = e0 - s0, D = n - s0, g = n - e0;
      if (D > 0.9 * P.span || L > 8 || g < (L <= 4 ? 0 : 2) || (P.last && g < 2)) continue;
      let ok = barAt(P, s0) !== barAt(P, n - 1);
      for (let i = j; i < j + k; i++) if (secs[i].gen > 1 || secs[i].uses >= 2) ok = false;
      if (!ok) continue;
      cand.push(j);
      wts.push(g === 0 ? 3 : 1);
    }
    if (cand.length) {
      let tot = 0;
      for (const w of wts) tot += w;
      let r = Math.random() * tot, j = cand[0];
      for (let i = 0; i < cand.length; i++) { r -= wts[i]; if (r <= 0) { j = cand[i]; break; } }
      const parts = [];
      let gen = 0;
      for (let i = j; i < j + k; i++) {
        parts.push(sectionBars(P, secs[i]));
        secs[i].uses++;
        gen = max(gen, secs[i].gen + 1);
      }
      if (Math.random() < 0.5) {
        const q = (Math.random() * parts.length) | 0;
        parts[q] = vary(P, parts[q]);
      }
      let bars = [];
      for (const p of parts) bars = bars.concat(p);
      queue(P, bars, gen);
      P.last = 1;
      return;
    }
  }
  queue(P, newSection(P), 0);
  P.last = 0;
}

function emitBar(P) {
  if (!P.q.length) planNext(P);
  const id = P.q.shift(), len = P.qb.shift(), gen = P.qg.shift();
  if (len) {
    const last = P.secs[P.secs.length - 1];
    if (last && last.e > P.n) last.e = P.n;
    P.secs.push({ s: P.n, e: P.n + len, gen, uses: 0 });
    if (P.secs.length > 60) P.secs.shift();
  }
  P.seq[P.n & MASK] = id;
  P.n++;
  if (P.n >= 2) P.bi.set((barAt(P, P.n - 2) << 8) | id, P.n);
  P.dirty = true;
}

// ---- repeats ---------------------------------------------------------------
// Every maximal run of equal bars on a diagonal: bars a0.. match bars a0+d.. for l bars. Runs of one bar are
// left out. The search reaches HIST bars back.
function findRuns(P) {
  const n = P.n, lo = max(0, n - HIST);
  let m = 0;
  const { ra, rd, rl } = P;
  for (let d = 2; d < HIST; d++) {
    let i = lo;
    const end = n - d;
    while (i < end) {
      if (barAt(P, i) === barAt(P, i + d)) {
        let j = i + 1;
        while (j < end && barAt(P, j) === barAt(P, j + d)) j++;
        const l = j - i;
        if (l >= 2 && m < ra.length) { ra[m] = i; rd[m] = d; rl[m] = l; m++; }
        i = j;
      } else i++;
    }
  }
  P.nr = m;
  P.dirty = false;
}

// ---- state -----------------------------------------------------------------
export function setup(P) {
  P.ready = false;
  P.t = 0;
  P.seq = new Uint8Array(RING);
  P.n = 0; P.tau = 0;
  P.secs = []; P.q = []; P.qb = []; P.qg = []; P.bi = new Map();
  P.act = []; P.nextId = 0; P.fresh = -1;
  P.last = 0; P.chorus = null; P.chorusUses = 0; P.chorusMax = 3; P.nextChorus = 30; P.nextTheme = 60; P.span = 78; P.cover = 0.5;
  P.rep = 0.5; P.repPlan = 0.5;
  P.ra = new Int32Array(4000); P.rd = new Int32Array(4000); P.rl = new Int32Array(4000);
  P.nr = 0; P.dirty = true;
  P.ord = new Int32Array(4000);
  P.ar = new Float32Array(4000 * 5); // per arc: centre, outer, inner, alpha, hue id
  P.buf = new Float32Array(W * H * 3);
  P.rgb = new Float32Array(3);
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const k1 = cl(kv[0], 0, 1), k2 = cl(kv[1], 0.5, 4), k3 = cl(kv[2], -1, 1), k4 = cl(kv[3], -1, 1);
  P.k1 = k1; P.k4 = k4;
  P.span = 48 * 2 ** ((k4 + 1) / 2);
  P.rep = 0.5 + 0.5 * k3;
  if (!P.ready) {
    P.ready = true;
    P.cover = 0.32 + 0.38 * P.rep; P.repPlan = P.rep;
    // the tune has been playing for a while: bar by bar, steered the same way as later
    P.tau = 12;
    for (let i = 0; i < 260; i++) {
      P.tau += 1;
      while (P.n < floor(P.tau) + 1) emitBar(P);
      findRuns(P);
      layout(P);
      P.cover += (1 - Math.exp(-0.57 * P.area) - P.cover) * 0.12;
    }
    P.t = 0;
  }
  P.t += d;
  // the bars below the panel are not yet played, so a new repeat setting recomposes them at once
  if (abs(P.rep - P.repPlan) > 0.15) {
    P.repPlan = P.rep;
    const keep = floor(P.tau - AHEAD * P.span) + 1;
    if (keep < P.n) {
      P.n = keep;
      while (P.secs.length && P.secs[P.secs.length - 1].s >= keep) P.secs.pop();
      const last = P.secs[P.secs.length - 1];
      if (last && last.e > keep) last.e = keep;
      P.dirty = true;
    }
    P.q.length = 0; P.qb.length = 0; P.qg.length = 0;
  }
  P.tau += d * k2;
  while (P.n < floor(P.tau) + 1) emitBar(P);
  if (P.dirty) findRuns(P);
  layout(P);
  P.cover += (1 - Math.exp(-0.57 * P.area) - P.cover) * (1 - Math.exp(-d / 8)); // the share of the panel the bands light, about
}

// ---- arcs ------------------------------------------------------------------
// The arc of a repeat that joins bars a0.. to bars b0.. = a0 + d, l bars long, is the half-ring around the
// middle of a0 and the end of the repeat, as wide as the repeat is long. While the end of a repeat is still being
// composed, at the frontier below the panel, the ring is as long as the repeat is so far and grows with it.
function layout(P) {
  const span = P.span;
  const bar = H / span; // LEDs a bar
  P.bar = bar;
  const top = P.tau - (1 + AHEAD) * span;
  const { ra, rd, rl, ar, ord } = P;
  let m = 0, area = 0;
  const maxChord = span * 1.6;
  const lmin = bar >= 2.4 ? 2 : 3; // an arc is at least 3 LEDs thick
  for (let r = 0; r < P.nr; r++) {
    if (rl[r] < lmin) continue;
    const a0 = ra[r], b0 = a0 + rd[r];
    const b1 = min(b0 + rl[r], P.tau);
    const le = b1 - b0;
    if (le < 0.9) continue;
    const chord = b1 - a0;
    if (chord > maxChord || b1 < top || (a0 - top) * bar >= H) continue;
    const o = m * 5;
    ar[o] = ((a0 + b1) / 2 - top) * bar; // centre row
    const ro = (chord / 2) * bar; // outer radius
    const ri = max(0, ((rd[r] - le) / 2) * bar); // inner radius
    // drawn a little narrower than the repeat is long, so neighbouring bands keep a dark seam between them
    const th = min(7, max(min(ro - ri, 3), (ro - ri) * FILL)), mid = (ro + ri) / 2;
    area += th * mid * PI; // what the band covers, overlaps and all
    ar[o + 1] = mid + th / 2;
    ar[o + 2] = max(0, mid - th / 2);
    ar[o + 3] = smooth((le - 0.9) / 0.9); // fades in over the first bar
    ar[o + 4] = barAt(P, a0) * GOLD + (((rd[r] * 37) % 11) - 5) * 11; // the motif's hue, leaning with the distance
    ord[m] = m;
    m++;
  }
  P.na = m;
  P.area = area / (W * H);
  // the longest chords at the back
  for (let i = 1; i < m; i++) {
    const v = ord[i], key = ar[v * 5 + 1];
    let j = i - 1;
    while (j >= 0 && ar[ord[j] * 5 + 1] < key) { ord[j + 1] = ord[j]; j--; }
    ord[j + 1] = v;
  }
}

function drawRing(P, yc, ro, ri, alpha, id, rot) {
  const { buf, rgb } = P;
  hueRGB(id + rot, rgb);
  const cr = rgb[0], cg = rgb[1], cb = rgb[2];
  const y0 = max(0, floor(yc - ro - 1)), y1 = min(H - 1, ceil(yc + ro + 1));
  const th = ro - ri;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - yc, ady = abs(dy);
    if (ady > ro + 1) continue;
    const xo = ro > ady ? sqrt(ro * ro - dy * dy) : 0;
    const xi = ri > ady ? sqrt(ri * ri - dy * dy) : 0;
    const xa = max(0, floor(xi - 1.5)), xb = min(W - 1, ceil(xo + 1.5));
    for (let x = xa; x <= xb; x++) {
      const dist = sqrt((x + 0.5) * (x + 0.5) + dy * dy);
      let c = ro - dist + 0.5;
      if (c <= 0) continue;
      if (c > 1) c = 1;
      if (ri > 0) {
        const c2 = dist - ri + 0.5;
        if (c2 <= 0) continue;
        if (c2 < c) c = c2;
      }
      const u = (dist - ri) / th;
      const shade = 0.56 + 0.44 * sin(PI * cl(u, 0, 1)) ** 0.7;
      const a = c * alpha;
      const o = (y * W + x) * 3;
      buf[o] += (cr * shade - buf[o]) * a;
      buf[o + 1] += (cg * shade - buf[o + 1]) * a;
      buf[o + 2] += (cb * shade - buf[o + 2]) * a;
    }
  }
}

export function draw(display, P) {
  const { buf, ar, ord, rgb } = P;
  if (!buf) return;
  const rot = 24 + 360 * (P.k1 || 0);
  buf.fill(0);
  for (let i = 0; i < P.na; i++) {
    const o = ord[i] * 5;
    drawRing(P, ar[o], ar[o + 1], ar[o + 2], 0.94 * ar[o + 3], ar[o + 4], rot);
  }
  // the strip: the sections of the tune, each in the colour its first bar gives its arcs, a dark seam between
  const top = P.tau - (1 + AHEAD) * P.span, bar = P.bar;
  for (let y = 0; y < H; y++) for (let x = 0; x < STRIP; x++) { const o = (y * W + x) * 3; buf[o] = 0; buf[o + 1] = 0; buf[o + 2] = 0; }
  for (let i = 0; i < P.secs.length; i++) {
    const sc = P.secs[i];
    if (sc.s >= P.n) continue;
    const e = min(sc.e, P.n, P.tau);
    const y0 = (sc.s - top) * bar + 0.5, y1 = (e - top) * bar - 0.5;
    if (y1 <= 0 || y0 >= H || y1 <= y0) continue;
    hueRGB(barAt(P, sc.s) * GOLD + rot, rgb);
    for (let y = max(0, floor(y0)); y <= min(H - 1, floor(y1)); y++) {
      const cov = min(y + 1, y1) - max(y, y0);
      if (cov <= 0) continue;
      for (let x = 0; x < STRIP; x++) {
        const o = (y * W + x) * 3;
        buf[o] = rgb[0] * cov; buf[o + 1] = rgb[1] * cov; buf[o + 2] = rgb[2] * cov;
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o] > 255 ? 255 : buf[o], buf[o + 1] > 255 ? 255 : buf[o + 1], buf[o + 2] > 255 ? 255 : buf[o + 2]);
    }
}
