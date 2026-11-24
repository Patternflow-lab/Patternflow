// ===== Patternflow pattern =====
// Title:   Bump Chart
// Family:  bumpchart
// Idea:    Twelve competitors play neighbour against neighbour under an Elo rating that is slowly pulled back toward the middle, and the panel plots their rank down the page as twelve smooth ribbons that trade lanes along eased curves, a round node on every ribbon that changed place and the ribbon that overtook passing over the one it passed.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Elo rating system (Arpad Elo, taken up by the US Chess Federation in 1960, from memory) with a slow pull back to the middle, drawn as a bump chart, rank against time with ribbons that trade places along eased curves; pattern round 231
// Round:   231
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.25..3, Upsets=-1..1, Lanes=-1..1
//
// Knob 1: Hue. Turns the run of twelve ribbon colours round the wheel; the run spans 0.8 of a turn so one family of colours is always missing, and at 0 it goes from orange through yellow, green, cyan and blue to magenta, with no red.
// Knob 2: Speed. How fast the chart scrolls, 0.9 rows a second at 0.25, 7 at the opening 2 and 10.5 at 3; the newest play enters at the top and the oldest leaves at the bottom, and a swap takes 18 rows to cross, 20 seconds at the slowest.
// Knob 3: Upsets. How often places change: matches come faster, a win moves a rating further and the pull back to the middle is stronger, so the 128 rows hold about 9 changes of place at -1, 17 at 0 and 27 at 1, where ribbons weave through each other. It acts on the play entering at the top, so a turn travels down the panel.
// Knob 4: Lanes. How many ranks the panel shows, 6 at -1, 10.4 at the opening and 12 at 1, and the ribbons are 4 LED across at 6 lanes and 2.7 at 12; a competitor ranked below the last lane slides out at the right edge and comes back when it climbs.

const W = 64;
const H = 128;
const NC = 12; // competitors
const { floor, ceil, sqrt, exp, log, abs, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep, flat at both ends like a bump chart's joins

const SEG = 18; // rows an S-curve takes
const PAD = 2.5; // rows a node sits level before its ribbon starts to move
const COOL = 9; // rows a competitor rests after changing place
const PRE = H + SEG + 300; // rows of play before the first frame
const THETA = 0.0006; // pull back to the middle, a row
const WALL = 3; // the pull back grows as 1 + (rating / WALL)^4, so the ends of the table, which a plain pull leaves far apart, stay about as lively as its middle
const REMATCH = 45; // rows before two who just swapped may be drawn against each other again, at the middle of the Upsets knob
const HUE0 = 0.07;
const HSPAN = 0.8;
const AHEAD = 6; // rows the play runs above the top edge, so a node scrolls in rather than appearing
const HALO = 0.9; // dark gap a ribbon cuts into what it passes over
const FADE = 0.42; // how much the oldest rows have dimmed
const ORD0 = [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11]; // identities by first rank: neighbouring ranks start far apart in hue

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

export function setup(params) {
  const S = {
    warm: false,
    u: 0, // the chart's clock, in rows
    tm: 0, // the last match
    next: 0,
    R: new Float64Array(NC),
    ord: ORD0.slice(), // ord[rank] is the competitor there
    base: new Float64Array(NC),
    steps: [],
    last: new Float64Array(NC).fill(-1e9),
    met: new Float64Array(NC * NC).fill(-1e9),
    old: new Float64Array(NC),
    pos: new Int32Array(NC),
    nodes: [],
    lanes: 10,
    speed: 7,
    hue: 0,
    buf: new Float32Array(W * H * 3),
    col: new Float32Array(NC * 3),
    sl: new Float64Array(NC),
    cx: new Float64Array(NC),
    al: new Float64Array(NC),
    idx: new Int32Array(NC),
  };
  for (let r = 0; r < NC; r++) {
    S.R[ORD0[r]] = (5.5 - r) * 1.1;
    S.base[ORD0[r]] = r;
  }
  for (let i = 0; i < NC; i++) S.steps.push([]);
  params.s = S;
}

// Where competitor i is in the chart at the row-time tau, in lanes (0 is first place): its lane at the start of the record plus
// every step it has taken by then, each an eased move.
function laneAt(S, i, tau) {
  let p = S.base[i];
  const st = S.steps[i];
  for (let k = 0; k < st.length; k++) {
    const x = (tau - st[k].u - PAD) / SEG;
    if (x > 0) p += st[k].d * ease(x > 1 ? 1 : x);
  }
  return p;
}

// One match at row-time u: two neighbours play, the Elo update moves the winner up and the loser down by an amount set by their
// gap, and the table is read again. Anyone who changed place records a step and a node. A match that would move someone who has
// only just moved, or swap back two who have only just swapped, is held back and the ratings stay as they were.
function playMatch(S, u) {
  const R = S.R, ord = S.ord, old = S.old, pos = S.pos;
  S.tm0 = S.tm;
  S.tm = u;
  const dr = S.theta * (u - S.tm0);
  for (let i = 0; i < NC; i++) {
    const q = R[i] / WALL;
    R[i] *= exp(-dr * (1 + q * q * q * q));
  }
  old.set(R);
  const r = floor(Math.random() * (NC - 1));
  const a = ord[r], b = ord[r + 1];
  const E = 1 / (1 + exp(-(R[a] - R[b])));
  const win = Math.random() < E;
  const d = S.kf * ((win ? 1 : 0) - E);
  R[a] += d;
  R[b] -= d;
  const nord = ord.slice().sort((x, y) => R[y] - R[x]);
  for (let k = 0; k < NC; k++) pos[nord[k]] = k;
  let moved = false;
  let held = false;
  for (let x = 0; x < NC && !held; x++) {
    if (pos[ord[x]] !== x) {
      moved = true;
      if (u - S.last[ord[x]] < S.cool) held = true;
    }
    for (let y = x + 1; y < NC && !held; y++) if (pos[ord[y]] < pos[ord[x]] && u - S.met[ord[x] * NC + ord[y]] < S.rematch) held = true;
  }
  if (held) {
    R.set(old);
    return;
  }
  if (!moved) return;
  for (let x = 0; x < NC; x++) {
    const id = ord[x];
    if (pos[id] !== x) {
      S.steps[id].push({ u, d: pos[id] - x });
      S.last[id] = u;
      // the node sits level on the ribbon of each competitor that changed place, where the match was played; the ones that climbed are lit
      S.nodes.push({ id, u, win: pos[id] < x });
    }
    for (let y = x + 1; y < NC; y++) if (pos[ord[y]] < pos[id]) S.met[id * NC + ord[y]] = S.met[ord[y] * NC + id] = u;
  }
  S.ord = nord;
}

function advance(S, to) {
  while (S.next <= to) {
    playMatch(S, S.next);
    const m = S.gap;
    S.next += 0.6 * m + 0.4 * m * -log(1 - Math.random()) * 2.5;
  }
  S.u = to;
  // forget what has scrolled off: the steps fold into the starting lane, the nodes go
  const old = S.u - H - SEG - PAD - 6;
  for (let i = 0; i < NC; i++) {
    const st = S.steps[i];
    while (st.length && st[0].u + PAD + SEG < old) S.base[i] += st.shift().d;
  }
  while (S.nodes.length && S.nodes[0].u < old) S.nodes.shift();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = 3.5 * cl(k[1], 0.25, 3);
  const v = cl(k[2], -1, 1);
  S.gap = 1.1 * 2 ** -v; // rows between matches run to about 1.6 times this
  S.kf = 0.8 * 1.35 ** v;
  S.rematch = REMATCH * 2 ** -v;
  S.cool = COOL * 1.5 ** -v;
  S.theta = THETA * 1.6 ** v;
  const lanesTo = 6 + 6 * sqrt((cl(k[3], -1, 1) + 1) / 2);
  if (!S.warm) {
    S.warm = true;
    S.lanes = lanesTo;
    S.tm = -PRE;
    S.next = -PRE;
    advance(S, 0);
  }
  S.lanes += (lanesTo - S.lanes) * (1 - exp(-d * 6));
  advance(S, S.u + S.speed * d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, col, sl, cx, al, idx } = S;
  const n = S.lanes;
  const lw = W / n;
  const thick = cl(0.5 * lw, 2.4, 4.2);
  const hw = thick / 2;
  buf.fill(0);
  for (let i = 0; i < NC; i++) {
    // colours next to each other on the wheel alternate between bright and deep, so two that look alike in hue still part at a crossing
    const c = [0, 0, 0];
    const deep = i % 2;
    hsv(S.hue + HUE0 + (HSPAN * i) / (NC - 1), 0.9, deep ? 0.8 : 1, c);
    // blue and violet carry little light: lift them toward white so they hold up beside yellow
    const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const lift = max(0, ((deep ? 0.36 : 0.46) - L) / (1 - L));
    for (let j = 0; j < 3; j++) col[i * 3 + j] = (c[j] + (1 - c[j]) * lift) * 255;
  }
  for (let y = 0; y < H; y++) {
    const tau = S.u - AHEAD - (y + 0.5);
    const fade = 1 - FADE * (y / H);
    for (let i = 0; i < NC; i++) {
      const p = laneAt(S, i, tau);
      const pa = laneAt(S, i, tau + 0.5), pb = laneAt(S, i, tau - 0.5);
      cx[i] = (p + 0.5) * lw;
      sl[i] = (pb - pa) * lw; // LED a row, going down the panel
      al[i] = 1 - sm(n - 1.0, n - 0.2, p);
      idx[i] = i;
    }
    // the one that overtook, moving up the ranks as time goes on, which is to the right as the rows go down, lies on top
    for (let a = 1; a < NC; a++) {
      const t = idx[a];
      let b = a - 1;
      while (b >= 0 && sl[idx[b]] > sl[t]) {
        idx[b + 1] = idx[b];
        b--;
      }
      idx[b + 1] = t;
    }
    for (let q = 0; q < NC; q++) {
      const i = idx[q];
      const a = al[i];
      if (a <= 0.01) continue;
      const qf = 1 / sqrt(1 + sl[i] * sl[i]);
      const reach = (hw + HALO) / qf + 1;
      const x0 = max(0, floor(cx[i] - reach)), x1 = min(W - 1, ceil(cx[i] + reach));
      for (let x = x0; x <= x1; x++) {
        const dd = abs(x + 0.5 - cx[i]) * qf;
        const cov = cl(hw + 0.5 - dd, 0, 1) * a;
        const hc = cl(hw + HALO + 0.5 - dd, 0, 1) * a;
        if (hc <= 0) continue;
        const o = (y * W + x) * 3;
        const keep = 1 - 0.92 * hc;
        buf[o] *= keep;
        buf[o + 1] *= keep;
        buf[o + 2] *= keep;
        if (cov <= 0) continue;
        // a ribbon is brighter along its middle than at its sides
        const sh = (0.74 + 0.26 * (1 - min(1, (dd / hw) * (dd / hw)))) * fade;
        buf[o] += (col[i * 3] * sh - buf[o]) * cov;
        buf[o + 1] += (col[i * 3 + 1] * sh - buf[o + 1]) * cov;
        buf[o + 2] += (col[i * 3 + 2] * sh - buf[o + 2]) * cov;
      }
    }
  }
  // nodes: a bead on each ribbon where a match swapped places, over everything
  const rn = hw + 0.6;
  for (let k = 0; k < S.nodes.length; k++) {
    const nd = S.nodes[k];
    const yc = S.u - AHEAD - nd.u;
    if (yc < -rn - 2 || yc > H + rn + 2) continue;
    const p = laneAt(S, nd.id, nd.u);
    const a = 1 - sm(n - 1.0, n - 0.2, p);
    if (a <= 0.01) continue;
    const xc = (p + 0.5) * lw;
    const fade = 1 - FADE * cl(yc / H, 0, 1);
    const y0 = max(0, floor(yc - rn - 2)), y1 = min(H - 1, ceil(yc + rn + 2));
    const x0 = max(0, floor(xc - rn - 2)), x1 = min(W - 1, ceil(xc + rn + 2));
    const wh = nd.win ? 0.6 : 0.12;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dd = sqrt((x + 0.5 - xc) ** 2 + (y + 0.5 - yc) ** 2);
        const cov = cl(rn + 0.5 - dd, 0, 1) * a;
        const hc = cl(rn + HALO + 0.5 - dd, 0, 1) * a;
        if (hc <= 0) continue;
        const o = (y * W + x) * 3;
        const keep = 1 - 0.95 * hc;
        buf[o] *= keep;
        buf[o + 1] *= keep;
        buf[o + 2] *= keep;
        if (cov <= 0) continue;
        const w = wh * (1 - min(1, dd / rn));
        const i3 = nd.id * 3;
        buf[o] += ((col[i3] + (255 - col[i3]) * w) * fade - buf[o]) * cov;
        buf[o + 1] += ((col[i3 + 1] + (255 - col[i3 + 1]) * w) * fade - buf[o + 1]) * cov;
        buf[o + 2] += ((col[i3 + 2] + (255 - col[i3 + 2]) * w) * fade - buf[o + 2]) * cov;
      }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      let r = buf[o], g = buf[o + 1], b = buf[o + 2];
      const m = max(r, g, b);
      // an edge pixel under 20 of 255 is invisible on the panel: drop it, or lift it clear
      if (m > 0 && m < 24) {
        if (m < 11) r = g = b = 0;
        else {
          const s = 24 / m;
          r *= s;
          g *= s;
          b *= s;
        }
      }
      display.setPixel(x, y, r, g, b);
    }
}
