// ===== Patternflow pattern =====
// Title:   Change Ringing
// Family:  rhythm
// Idea:    In the bell chamber of a church tower the bells swing full circle on their wheels and flash as they strike, while below them the method they ring prints itself down the panel as a blue line, one change to a row, the treble's line in red, from rounds into Plain Bob and back into rounds.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: English change ringing (plain hunting, Plain Bob, Double Bob) and the blue-line diagrams ringers learn methods from, pattern round 20
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Lines=0..1, Speed=0.25..3, Bells=4..8, Method=-1..1
//
// Knob 1: Lines. Turns the colours of the working bells' lines round the wheel together, from yellow through cyan to violet at 0; the turn skips the reds, so the treble's line is the only red one.
// Knob 2: Speed. The ringing pace: at 2 a bell strikes every 0.3 s, so a row of six takes 1.8 s, with the open handstroke gap of one more beat after every second row.
// Knob 3: Bells. How many bells hang in the tower and ring: 4 is Minimus, 5 Doubles, 6 Minor, 7 Triples and 8 Major. Changing it starts the band again from rounds.
// Knob 4: Method. -1 is plain hunting, 0 is Plain Bob (seconds place at each lead end, the bells dodging round the treble) and 1 is Double Bob, which makes the mirror of it at the half lead as well. A change waits for the next lead end, so the methods splice.
// Buttons: K1 tap calls "Bob!": the next lead end makes fourths place instead, a gold rule marks it in the scroll, and the conductor calls more bobs as needed to bring the bells back into rounds.

const W = 64;
const H = 128;
const N = W * H;
// Axle rows of the two tiers of bells, and the chamber floor.
const TIER = [12, 26];
const FLOOR = 37;
// The current change printed as numbers, the row its line starts on, and the
// bottom of the scroll. The ringing chamber is under that.
const DIG = 41;
const TOP = 49;
const LOW = 111;
const CEIL = 112;
// A bell rings just short of the balance either side, mouth up.
const SWING = Math.PI * 0.94;
// Seconds a beat at Speed 1, and how far past a strike the bell reaches the balance.
const BEAT = 0.6;
const BAL = 0.22;
const ROUNDS = 6;
const SLIDE = 1.2;
const { min, max, floor, round, sin, cos, abs, sqrt, exp, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => ((x = clamp(x, 0, 1)), x * x * (3 - 2 * x));
// 3x5 letters, one octal digit a row.
const FONT = {
  1: "26227", 2: "71747", 3: "71717", 4: "55711", 5: "74717", 6: "74757", 7: "71222", 8: "75757",
  A: "25755", B: "65656", D: "65556", E: "74647", G: "34553", H: "55755", I: "72227", L: "44447",
  N: "57755", O: "25552", P: "65644", S: "34216", T: "72222", U: "55557", "!": "22202", " ": "00000",
};
const NAMES = ["PLAIN HUNT", "PLAIN BOB", "DOUBLE BOB"];

// Start of row r in beats: n strikes a row and one beat of handstroke gap
// before every handstroke but the first.
const startOf = (n, r) => r * n + floor(r / 2);

// One lead as place notation: a bitmask of the places made, 0 for a cross.
// Even stages hunt x.1n, odd ones n.1; Plain Bob makes seconds at the lead
// end (fourths at a bob) and Double Bob the mirror of it at the half lead.
function leadChanges(n, m, bob) {
  const top = 1 << (n - 1);
  const odd = n & 1;
  const ch = [];
  for (let k = 0; k < 2 * n; k++) ch.push(k & 1 ? (odd ? 1 : 1 | top) : odd ? top : 0);
  if (m === 2) ch[n - 1] = top | (top >> 1) | (odd ? 1 : 0);
  if (m > 0 || bob) ch[2 * n - 1] = (bob ? 9 : 3) | (odd ? top : 0);
  return ch;
}

function change(row, mask, n) {
  for (let i = 0; i < n; ) {
    if ((mask >> i) & 1 || i === n - 1) i++;
    else {
      const t = row[i];
      row[i] = row[i + 1];
      row[i + 1] = t;
      i += 2;
    }
  }
}

const rounds = (n) => Array.from({ length: n }, (_, i) => i);

function leadPerm(n, m, bob) {
  const r = rounds(n);
  for (const c of leadChanges(n, m, bob)) change(r, c, n);
  return r;
}

// Leads from each lead head back to rounds, plain or bob, found once.
function table(P, n, m) {
  const id = n * 3 + m;
  if (P.tables[id]) return P.tables[id];
  const R = [leadPerm(n, m, false), leadPerm(n, m, true)];
  const dist = new Map([[rounds(n).join(""), 0]]);
  const q = [rounds(n)];
  for (let h = 0; h < q.length; h++) {
    const X = q[h];
    const d = dist.get(X.join(""));
    for (const p of R) {
      const Y = [];
      for (let i = 0; i < n; i++) Y[p[i]] = X[i];
      const key = Y.join("");
      if (!dist.has(key)) {
        dist.set(key, d + 1);
        q.push(Y);
      }
    }
  }
  return (P.tables[id] = dist);
}

function say(P, text, row) {
  if (row <= P.cur) P.msg = [text, 2.4];
  else P.calls.set(row, text);
}

// The next row of the touch: rounds, then the method lead after lead until
// it comes round, then rounds again.
function gen(P) {
  const G = P.G;
  const n = P.n;
  const r = P.r0 + P.rows.length;
  const row = G.row.slice();
  let mark = 0;
  if (G.phase === 0) {
    if (++G.count >= G.need) {
      Object.assign(G, { phase: 1, ci: 0, m: P.m, called: false, first: true, need: ROUNDS, rung: 0 });
      say(P, "GO " + NAMES[G.m], r - 1);
    }
  } else {
    if (G.ci === 0) {
      if (!G.first && G.m !== P.m) say(P, NAMES[P.m], r - 1);
      G.m = P.m;
      G.first = false;
      G.head = row.slice();
    }
    const last = G.ci === 2 * n - 1;
    let bob = false;
    if (last) {
      if (G.pend) {
        G.pend = false;
        G.called = bob = true;
      } else if (G.called) {
        const T = table(P, n, G.m);
        const after = (b) => {
          const p = leadPerm(n, G.m, b);
          return T.get(p.map((i) => G.head[i]).join("")) ?? 1e9;
        };
        bob = after(true) < after(false);
        if (bob) say(P, "BOB!", r - 2);
      }
      // Plain hunting has no lead end to rule off.
      mark = bob ? 2 : G.m ? 1 : 0;
    }
    change(row, leadChanges(n, G.m, bob)[G.ci], n);
    G.ci = last ? 0 : G.ci + 1;
    G.rung++;
    if (last && G.rung >= 24 && row.every((b, i) => b === i)) {
      Object.assign(G, { phase: 0, count: 0 });
      say(P, "THATS ALL", r);
    }
  }
  G.row = row;
  const pos = new Int8Array(n);
  row.forEach((b, i) => (pos[b] = i));
  P.rows.push(Int8Array.from(row));
  P.pos.push(pos);
  P.mark.push(mark);
}

function rowAt(P, tau) {
  const n = P.n;
  let r = max(0, floor(tau / (n + 0.5)));
  while (startOf(n, r + 1) <= tau) r++;
  while (r > 0 && startOf(n, r) > tau) r--;
  return r;
}

function need(P, r) {
  while (P.r0 + P.rows.length <= r) gen(P);
}

const strike = (P, r, b) => startOf(P.n, r) + P.pos[r - P.r0][b];
const balance = (P, r, b) => strike(P, r, b) + BAL * (strike(P, r + 1, b) - strike(P, r, b));

function layout(P, n) {
  const dx = W / n;
  const rb = min(10, 0.47 * Math.hypot(dx, TIER[1] - TIER[0]), 0.94 * dx);
  for (let i = 0; i < n; i++) {
    P.bx[i] = (i + 0.5) * dx;
    P.by[i] = TIER[i & 1];
    P.br[i] = rb * (0.74 + (0.26 * i) / (n - 1));
  }
  P.rh = n < 5 ? 6 : n < 7 ? 5 : 4;
  P.sp = min(60 / (n - 1), P.rh * 2.1);
  for (let p = 0; p < n; p++) P.xs[p] = 32 + (p - (n - 1) / 2) * P.sp;
  P.V = floor((LOW - TOP) / P.rh) + 1;
}

function paint(P) {
  const S = P.bg;
  const n = P.n;
  S.fill(0);
  const set = (x, y, r, g, b) => {
    if (x >= 0 && x < W && y >= 0 && y < H) S.set([r, g, b], (y * W + x) * 3);
  };
  // Stone walls of the bell chamber, coursed in blocks of 8 by 4.
  for (let y = 0; y < FLOOR; y++)
    for (let x = 0; x < W; x++) {
      const bx = floor((x + ((y >> 2) & 1) * 4) / 8);
      const by = y >> 2;
      const joint = y % 4 === 3 || (x + ((y >> 2) & 1) * 4) % 8 === 7;
      const s = joint ? 8 : 15 + ((bx * 7 + by * 13) % 5) * 1.6 + Math.random() * 3;
      set(x, y, s * 1.05, s, s * 0.9);
    }
  // A louvred window behind the bells, daylight between the boards.
  for (let y = 3; y < 33; y++)
    for (let x = 27; x < 37; x++) {
      const arch = y < 8 && Math.hypot(x + 0.5 - 32, y - 8) > 5;
      if (arch) continue;
      const edge = x === 27 || x === 36 || (y < 8 && Math.hypot(x + 0.5 - 32, y - 8) > 4);
      const slat = (y + floor((x - 27) / 3)) % 3 === 0;
      if (edge) set(x, y, 52, 46, 40);
      else if (slat) set(x, y, 46, 40, 34);
      else set(x, y, 120 + y, 150 + y, 186 + y * 0.5);
    }
  // The frame: an oak beam under each tier's bearings.
  for (const ty of TIER)
    for (let x = 0; x < W; x++) {
      set(x, ty + 2, 70, 46, 28);
      set(x, ty + 3, 44, 28, 18);
    }
  // The floor boards, with a hole for each rope.
  for (let y = FLOOR; y < FLOOR + 3; y++)
    for (let x = 0; x < W; x++) {
      const hole = y > FLOOR && P.bx.some((b, i) => i < n && x === floor(b + P.br[i] - 0.6));
      const v = y === FLOOR ? 1 : hole ? 0.2 : x % 11 === 5 ? 0.45 : 0.72;
      set(x, y, 104 * v, 70 * v, 42 * v);
    }
  // Faint rulings down each place of the scroll.
  for (let p = 0; p < n; p++)
    for (let y = TOP; y <= LOW; y += 2) set(floor(P.xs[p]), y, 9, 9, 13);
  // The ringing chamber: ceiling beam and plastered wall.
  for (let y = CEIL; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y < CEIL + 2) set(x, y, y === CEIL ? 84 : 52, y === CEIL ? 58 : 34, y === CEIL ? 36 : 22);
      else {
        const s = 34 + Math.random() * 4 - (y - CEIL) * 0.5;
        set(x, y, s * 1.1, s, s * 0.84);
      }
    }
}

function reset(P, n) {
  P.n = n;
  layout(P, n);
  paint(P);
  P.G = { row: rounds(n), phase: 0, count: 0, need: 4, ci: 0, m: P.m, pend: false, called: false };
  Object.assign(P, { rows: [], pos: [], mark: [], r0: 0, calls: new Map(), msg: null, cur: -1 });
  // Open part way into the first touch, with its first lead end in view.
  const r = 4 + 2 * n + floor(P.V / 2);
  need(P, r + 3);
  P.tau = startOf(n, r) + 1.5;
  P.cur = r;
  P.fl.fill(0);
}

export function setup(params) {
  const P = params;
  const F = (k) => new Float32Array(k);
  Object.assign(P, { buf: F(N * 3), bg: F(N * 3), bx: F(8), by: F(8), br: F(8), xs: F(8), th: F(8), fl: F(8), col: F(24) });
  Object.assign(P, { tables: {}, n: 0, m: 1, hue: 0, speed: 2, tau: 0, e: 1 });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 4, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = clamp(k[1], 0.25, 3);
  P.m = k[3] < -0.4 ? 0 : k[3] > 0.4 ? 2 : 1;
  const n = clamp(round(k[2]), 4, 8);
  if (n !== P.n) reset(P, n);
  if (input.btnPressed && input.btnPressed[0]) {
    P.G.pend = true;
    P.msg = ["BOB!", 2.4];
  }
  const was = P.tau;
  P.tau += (dt * P.speed) / BEAT;
  const cur = rowAt(P, P.tau);
  need(P, cur + 3);
  for (let r = P.cur + 1; r <= cur; r++)
    if (P.calls.has(r)) {
      P.msg = [P.calls.get(r), 2.4];
      P.calls.delete(r);
    }
  P.cur = cur;
  // Strikes since the last frame.
  for (let r = rowAt(P, was); r <= cur; r++)
    for (let b = 0; b < n; b++) {
      const t = strike(P, r, b);
      if (t > was && t <= P.tau) P.fl[b] = 1;
    }
  for (let b = 0; b < n; b++) {
    P.fl[b] *= exp(-dt * 5);
    // The stroke this bell is in: from one balance to the next.
    let s = cur;
    if (P.tau < balance(P, s - 1, b)) s--;
    else if (P.tau >= balance(P, s, b)) s++;
    const b0 = balance(P, s - 1, b);
    const u = (P.tau - b0) / (balance(P, s, b) - b0);
    P.th[b] = (s & 1 ? -1 : 1) * SWING * cos(PI * clamp(u, 0, 1));
  }
  P.e = smooth((P.tau - startOf(n, cur)) / SLIDE);
  if (P.msg && (P.msg[1] -= dt) <= 0) P.msg = null;
  // Keep sixty rows of history; the scroll shows at most seventeen.
  if (P.rows.length > 80) {
    const cut = P.rows.length - 60;
    for (const A of [P.rows, P.pos, P.mark]) A.splice(0, cut);
    P.r0 += cut;
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6;
  const f = h - floor(h);
  const a = v * (1 - s);
  const b = v * (1 - s * f);
  const c = v * (1 - s * (1 - f));
  const rgb = [[v, c, a], [b, v, a], [a, v, c], [a, b, v], [c, a, v], [v, a, b]][i];
  for (let k = 0; k < 3; k++) out[o + k] = rgb[k] * 255;
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  buf[p] = r;
  buf[p + 1] = g;
  buf[p + 2] = b;
}

function bell(P, i) {
  const { buf, col } = P;
  const ax = P.bx[i];
  const ay = P.by[i];
  const R = P.br[i];
  const th = P.th[i];
  const fl = P.fl[i];
  const mx = -sin(th);
  const my = cos(th);
  const L = 0.92 * R;
  const u0 = 0.06 * R;
  const G = R + 3;
  const hl = -0.45 * my;
  const spokes = [0, 1, 2, 3].map((s) => [cos(th + PI / 4 + (s * PI) / 2), sin(th + PI / 4 + (s * PI) / 2)]);
  for (let y = max(0, floor(ay - G)); y <= min(FLOOR - 1, floor(ay + G)); y++)
    for (let x = max(0, floor(ax - G)); x <= min(W - 1, floor(ax + G)); x++) {
      const p = (y * W + x) * 3;
      const dx = x + 0.5 - ax;
      const dy = y + 0.5 - ay;
      const d = sqrt(dx * dx + dy * dy);
      if (d >= G) continue;
      // The strike lights the air round the bell in the colour of its line.
      if (fl > 0.02) {
        const g = fl * 0.55 * (1 - d / G);
        for (let c = 0; c < 3; c++) buf[p + c] += col[i * 3 + c] * g;
      }
      // Wheel: rim and four spokes, turning with the bell.
      let wv = clamp(1 - abs(d - (R - 0.5)) / 0.7, 0, 1);
      if (d < R - 0.8)
        for (const [c, s] of spokes) {
          const along = dx * c + dy * s;
          if (along > 0) wv = max(wv, 0.5 * clamp(1 - abs(dy * c - dx * s) / 0.6, 0, 1));
        }
      if (wv > 0) {
        buf[p] += (104 - buf[p]) * wv;
        buf[p + 1] += (68 - buf[p + 1]) * wv;
        buf[p + 2] += (38 - buf[p + 2]) * wv;
      }
      // The bell and its headstock, four samples to an LED.
      if (d > 1.15 * R + 0.8) continue;
      let cov = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let s = 0; s < 4; s++) {
        const sx = dx - 0.25 + 0.5 * (s & 1);
        const sy = dy - 0.25 + 0.5 * (s >> 1);
        const u = sx * mx + sy * my;
        const v = sx * my - sy * mx;
        if (u < u0) {
          if (u > -0.16 * R && abs(v) < 0.38 * R) {
            r += 72;
            g += 58;
            b += 50;
            cov++;
          }
          continue;
        }
        const t = (u - u0) / L;
        if (t < 0 || t > 1) continue;
        let w = L * (0.27 + 0.06 * t + 0.27 * t * t * t * t);
        if (t < 0.12) w *= 0.6 + (0.4 * t) / 0.12;
        const q = v / w;
        if (abs(q) > 1) continue;
        let sh = (0.5 + 0.65 * exp(-(q - hl) * (q - hl) * 5)) * (1 - 0.3 * q * q);
        if (t > 0.8 && t < 0.93) sh *= 1.12;
        else if (t > 0.94) sh *= 0.55;
        r += 228 * sh + fl * 200;
        g += 160 * sh + fl * 170;
        b += 70 * sh + fl * 120;
        cov++;
      }
      if (cov) {
        const a = cov / 4;
        buf[p] = buf[p] * (1 - a) + r / 4;
        buf[p + 1] = buf[p + 1] * (1 - a) + g / 4;
        buf[p + 2] = buf[p + 2] * (1 - a) + b / 4;
      }
    }
}

function chamber(P) {
  const { n, buf } = P;
  // Each rope comes off its wheel and down through the floor, creeping as the wheel turns.
  for (let i = 0; i < n; i++) {
    const x = floor(P.bx[i] + P.br[i] - 0.6);
    for (let y = P.by[i]; y < FLOOR + 3 && x < W; y++) {
      const v = 0.6 + 0.3 * sin((y + P.th[i] * P.br[i]) * 1.4);
      put(buf, x, y, 168 * v, 134 * v, 90 * v);
    }
  }
  for (let i = 0; i < n; i += 2) bell(P, i);
  for (let i = 1; i < n; i += 2) bell(P, i);
}

// One leg of a bell's line, a soft 1-LED core with a dim edge either side,
// kept brightest where lines cross.
function seg(P, x0, y0, x1, y1, b, k) {
  const { buf, col } = P;
  const core = b === 0 ? 0.9 : 0.72;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const o = b * 3;
  for (let y = max(TOP - 1, floor(min(y0, y1) - 3)); y <= min(LOW, floor(max(y0, y1) + 3)); y++)
    for (let x = max(0, floor(min(x0, x1) - 3)); x <= min(W - 1, floor(max(x0, x1) + 3)); x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;
      const t = clamp((px * dx + py * dy) / l2, 0, 1);
      const ex = px - t * dx;
      const ey = py - t * dy;
      const d = sqrt(ex * ex + ey * ey);
      let v = d < core ? 1 : d < core + 1 ? core + 1 - d : 0;
      v = max(v, 0.36 * clamp(2.8 - d, 0, 1)) * k;
      if (v <= 0) continue;
      const p = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) buf[p + c] = max(buf[p + c], col[o + c] * v);
    }
}

function scroll(P) {
  const { n, rh, xs, cur, buf, e } = P;
  for (let a = 0; a <= P.V; a++) {
    const r = cur - a;
    if (r - 1 < P.r0) break;
    const ya = TOP + (a - 1 + e) * rh + 0.5;
    const k = 0.4 + 0.6 * exp(-(a + e) / 6);
    const A = P.pos[r - P.r0];
    const B = P.pos[r - 1 - P.r0];
    // A rule under each lead end, gold and dashed where a bob was called.
    const mark = P.mark[r - P.r0];
    const yr = floor(ya + rh / 2);
    if (mark && yr >= TOP && yr <= LOW)
      for (let x = floor(xs[0] - 3); x <= xs[n - 1] + 3; x++)
        if (mark === 2 ? x % 3 !== 0 : x % 2 === 0) put(buf, x, yr, (mark === 2 ? 220 : 70) * k, (mark === 2 ? 170 : 70) * k, (mark === 2 ? 60 : 84) * k);
    for (let b = n - 1; b >= 0; b--) seg(P, xs[A[b]], ya, xs[B[b]], ya + rh, b, k);
  }
}

function glyphs(buf, s, x, y, r, g, b) {
  for (const ch of s) {
    const gl = FONT[ch] || FONT[" "];
    for (let row = 0; row < 5; row++)
      for (let c = 0; c < 3; c++) if ((+gl[row] >> (2 - c)) & 1) put(buf, x + c, y + row, r, g, b);
    x += 4;
  }
}

// The change being struck, as numbers: each lights in its bell's colour as
// it sounds, with a white flash on the strike.
function numbers(P) {
  const { n, buf, col, xs } = P;
  const row = P.rows[P.cur - P.r0];
  const j = P.tau - startOf(n, P.cur);
  for (let p = 0; p < n; p++) {
    const b = row[p];
    const since = j - p;
    const v = since < 0 ? 0.3 : 0.85;
    const w = since < 0 ? 0 : max(0, 1 - since / 0.9);
    const c = [0, 1, 2].map((i) => col[b * 3 + i] * v * (1 - w) + 255 * w);
    glyphs(buf, String(b + 1), round(xs[p] - 1.5), DIG, c[0], c[1], c[2]);
    if (since < 0) continue;
    // Each node of the row lights as its bell sounds, white for the moment of the strike.
    const ny = TOP + (P.e - 1) * P.rh + 0.5;
    for (let y = max(TOP - 1, floor(ny - 4)); y <= floor(ny + 4); y++)
      for (let x = max(0, floor(xs[p] - 4)); x <= min(W - 1, floor(xs[p] + 4)); x++) {
        const d = Math.hypot(x + 0.5 - xs[p], y + 0.5 - ny);
        if (d >= 4) continue;
        const g = (1 - d / 4) * (0.45 + 0.5 * w);
        const q = (y * W + x) * 3;
        for (let i = 0; i < 3; i++) buf[q + i] = max(buf[q + i], (col[b * 3 + i] * (1 - w) + 255 * w) * g);
      }
  }
}

// Ropes and sallies in the ringing chamber, each sally woven in its bell's
// colour and white: it rises as its bell swings off the handstroke and comes
// back down to the ringer.
function ringers(P) {
  const { n, buf, col } = P;
  for (let i = 0; i < n; i++) {
    const x = round(P.bx[i] - 0.5);
    const rise = (SWING - P.th[i]) / (2 * SWING);
    const top = round(CEIL + 9 - rise * 7);
    for (let y = CEIL + 2; y < H; y++) {
      if (y >= top && y < top + 7) {
        for (let c = -1; c <= 1; c++) {
          const k = (y - top + c + 8) % 4;
          const v = (c === 1 ? 0.7 : 1) * (k === 2 ? 0.55 : 1);
          for (let j = 0; j < 3; j++) buf[(y * W + x + c) * 3 + j] = (k & 1 ? [232, 226, 214][j] : col[i * 3 + j]) * v;
        }
      } else if (y < top + 13) put(buf, x, y, 176, 146, 102);
    }
  }
}

function message(P) {
  if (!P.msg) return;
  const [s, left] = P.msg;
  const f = min(1, left / 0.5);
  const w = s.length * 4 - 1;
  const x = round(32 - w / 2);
  const y = LOW - 8;
  for (let yy = y - 2; yy < y + 7; yy++) for (let xx = x - 2; xx < x + w + 2; xx++) put(P.buf, xx, yy, 0, 0, 0);
  glyphs(P.buf, s, x, y, 255 * f, 240 * f, 200 * f);
}

export function draw(display, params) {
  const P = params;
  const { buf, col, n } = P;
  if (!n) return;
  for (let b = 0; b < n; b++) {
    if (b === 0) hsv(0, 0.84, 1, col, 0);
    else {
      // The working bells share the wheel without its reds, so only the treble is red.
      const u = 0.05 + P.hue + (0.84 * (b - 1)) / (n - 2);
      hsv(0.13 + 0.74 * (u - floor(u)), 0.82, 1, col, b * 3);
    }
  }
  buf.set(P.bg);
  chamber(P);
  scroll(P);
  numbers(P);
  ringers(P);
  message(P);
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
}
