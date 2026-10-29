// ===== Patternflow pattern =====
// Title:   Maya Numerals
// Family:  type
// Idea:    A number five places tall is counted up in Maya numerals, the lowest place at the bottom: each new dot slides in from the right, five dots slide together and melt into a bar, and a place that fills (twenty, or eighteen in the Long Count's second place) collapses into a gold dot that climbs to the place above and leaves a shell for zero behind, so carries ripple up the panel.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Maya place-value numerals in base 20, a dot for one, a bar for five and a shell for zero, the places written one above the other (Dresden Codex); the Long Count, whose second place counts to 18 (worked out from the Dresden Codex by Ernst Förstemann, 1880s); pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mode=0..1, Step=0..6
//
// Knob 1: Hue. Turns the signs round the wheel: at 0 the dots and bars are jade, the shells ivory and a dot on its way up a place gold. The faint rules between the places take the jade.
// Knob 2: Speed. At 2 a dot slides in in 0.30 s, five dots melt into a bar in 0.40 s, a full place collapses in 0.36 s and its dot climbs in 0.42 s. Counting by one runs 1.7 numbers a second, so the second place moves about every 12 s. The opening carry is through three places at 4.8 s, or reaches 13.0.0.0.0 at 6.0 s in the Long Count. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Mode. 0 is plain base 20: every place carries at 20, four bars. It opens on 12.7.19.19.17 (top to bottom) and three counts later the carry runs up to 12.8.0.0.0. 1 is the Long Count of days: kin 20, winal 18 (18 winals of 20 days make a tun of 360 days), then 20 for the tun, katun and baktun. The winal carries when a third dot joins its three bars. It opens on 12.19.19.17.16, four days before 13.0.0.0.0, the day the Long Count reached on 21 December 2012 in the GMT correlation, and the carry runs up four places. Turning it starts the count again from that mode's opening.
// Knob 4: Step. How much each addition adds, from 0 to 6: 1, 13, 20, 260, 360, 365 or 584. The step is written in the mode's places and its bars and dots slide in one at a time, lowest place first, each fusing and carrying as it lands. 260 is 13.0 in both modes; 360 is 18.0 in base 20 but 1.0.0 in the Long Count, one dot in the third place; 365 is 18.5 against 1.0.5; 584, the Venus period of the Dresden Codex's Venus table, is 1.9.4 against 1.11.4. At Speed 2 a step of 13 adds 0.38 times a second and 584 adds 0.22 times, moving the third place every 4.5 s.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const ss = (a, b, v) => ease((v - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Layout. Five places, the lowest at the bottom, each a cell 25.6 rows
// tall. A numeral is bars stacked from the bottom of the glyph, one slot
// each, and a row of up to four dots in the slot above them; the glyph is
// centred in its cell. Zero is a shell.
const P = 5, CELL = H / P, CX = 32;
const BL = 38, BT = 4.4, SP = 6, DR = 2.8, DS = 9.5;
const cyOf = (p) => H - CELL * (p + 0.5);
const slotY = (p, n, k) => cyOf(p) + ((n - 1) / 2 - k) * SP;
const dotX = (i, d) => CX + (i - (d - 1) / 2) * DS;

// Sprites: kind 0 dot, 1 bar, 2 shell.
const DOT = 0, BAR = 1, SHELL = 2;

// Sprites carry a position, a size s (a bar's length as a share of BL), an
// alpha a and g, how far the sign is tinted gold and glows.
function staticPlace(out, p, b, d, a) {
  const n = b + (d > 0 ? 1 : 0);
  if (n === 0) out.push({ k: SHELL, x: CX, y: cyOf(p), s: 1, a, g: 0 });
  for (let k = 0; k < b; k++) out.push({ k: BAR, x: CX, y: slotY(p, n, k), s: 1, a, g: 0 });
  for (let i = 0; i < d; i++) out.push({ k: DOT, x: dotX(i, d), y: slotY(p, n, b), s: 1, a, g: 0 });
}

// ---- Counting. Radix of each place: 20, or in the Long Count 20 for the
// kin, 18 for the winal (18 winals of 20 days make a tun of 360), then 20.
const RADIX = [[20, 20, 20, 20, 20], [20, 18, 20, 20, 20]];
const STEPS = [1, 13, 20, 260, 360, 365, 584];
// Openings, lowest place first. Base 20: 12.7.19.19.17, three counts before
// a carry runs up three places to 12.8.0.0.0. Long Count: 12.19.19.17.16,
// four days before 13.0.0.0.0. Counted through at Speed 2 (op times below),
// the first lands at 4.76 s and the second at 6.00 s.
// The steps are written in each mode's places when an addition starts:
// 584 = 1.9.4 in base 20 (400 + 180 + 4) and 1.11.4 in the Long Count
// (360 + 220 + 4); 365 = 18.5 against 1.0.5. Counted over 120 s at Speed 2,
// base 20 makes 202 additions of 1 and 26 of 584; 360 makes 37 in base 20,
// six signs each, and 202 in the Long Count, one dot each.
const OPEN = [[17, 19, 19, 7, 12], [16, 17, 19, 19, 12]];

// Op durations in seconds at Speed 2.
const DUR = { side: 0.3, bar: 0.36, climb: 0.42, fuse: 0.4, carry: 0.36, pause: 0.16 };
const opDur = (op) => (op.k === "in" ? (op.from === "below" ? DUR.climb : op.sign === BAR ? DUR.bar : DUR.side) : DUR[op.k]);

function reset(S) {
  const o = OPEN[S.mode];
  S.b = o.map((v) => floor(v / 5));
  S.d = o.map((v) => v % 5);
  S.q = [];
  S.cur = null;
  S.u = 0;
}

function addition(S) {
  const R = RADIX[S.mode];
  let n = STEPS[S.step];
  for (let p = 0; p < P && n > 0; p++) {
    const dg = n % R[p];
    n = floor(n / R[p]);
    for (let i = 0; i < floor(dg / 5); i++) S.q.push({ k: "in", p, sign: BAR, from: "side" });
    for (let i = 0; i < dg % 5; i++) S.q.push({ k: "in", p, sign: DOT, from: "side" });
  }
  S.q.push({ k: "pause" });
}

// What happens when an op ends: the place takes the sign, and anything it
// sets off goes to the front of the queue.
function finish(S, op) {
  const p = op.p, R = RADIX[S.mode];
  if (op.k === "pause") return;
  if (p >= P) return;
  const val = () => S.b[p] * 5 + S.d[p];
  if (op.k === "in") {
    if (op.sign === BAR) S.b[p]++;
    else S.d[p]++;
    if (S.d[p] === 5) S.q.unshift({ k: "fuse", p });
    else if (val() >= R[p]) S.q.unshift({ k: "carry", p });
  } else if (op.k === "fuse") {
    S.d[p] -= 5;
    S.b[p]++;
    if (val() >= R[p]) S.q.unshift({ k: "carry", p });
  } else if (op.k === "carry") {
    const v = val() - R[p];
    S.b[p] = floor(v / 5);
    S.d[p] = v % 5;
    S.q.unshift({ k: "in", p: p + 1, sign: DOT, from: "below" });
  }
}

export function setup(params) {
  params.s = {
    hue: 0, mode: 0, step: 0, b: null, d: null, q: [], cur: null, u: 0,
    rgb: new Float32Array(NP * 3), sig: new Float32Array(NP * 3), hot: new Float32Array(NP * 3), tmp: new Float32Array(NP * 3), blr: new Float32Array(NP * 3), blh: new Float32Array(NP * 3),
  };
  reset(params.s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const mode = round(cl(k[2], 0, 1)), step = cl(round(k[3]), 0, 6);
  S.step = step;
  if (mode !== S.mode) {
    S.mode = mode;
    reset(S);
  }
  S.u += (d * cl(k[1], 0.2, 3)) / 2;
  for (let guard = 0; guard < 64; guard++) {
    if (!S.cur) {
      if (!S.q.length) addition(S);
      S.cur = S.q.shift();
    }
    const T = opDur(S.cur);
    if (S.u < T) break;
    S.u -= T;
    finish(S, S.cur);
    S.cur = null;
  }
}

// ---- Sprites for the frame.
function sprites(S) {
  const out = [], op = S.cur, u = op ? S.u / opDur(op) : 0;
  for (let p = 0; p < P; p++) {
    const b = S.b[p], d = S.d[p];
    if (!op || op.p !== p || op.k === "pause") {
      staticPlace(out, p, b, d, 1);
      continue;
    }
    const e = ease(u);
    if (op.k === "in") {
      const nb = op.sign === BAR ? b + 1 : b, nd = op.sign === BAR ? d : d + 1;
      const n0 = b + (d > 0 ? 1 : 0), n1 = nb + (nd > 0 ? 1 : 0);
      if (b + d === 0) out.push({ k: SHELL, x: CX, y: cyOf(p), s: 1 - 0.3 * e, a: 1 - e, g: 0 });
      for (let k = 0; k < b; k++) out.push({ k: BAR, x: CX, y: lerp(slotY(p, n0, k), slotY(p, n1, k), e), s: 1, a: 1, g: 0 });
      for (let i = 0; i < d; i++)
        out.push({ k: DOT, x: lerp(dotX(i, d), dotX(i, nd), e), y: lerp(slotY(p, n0, b), slotY(p, n1, nb), e), s: 1, a: 1, g: 0 });
      // The newcomer.
      const tx = op.sign === BAR ? CX : dotX(d, nd), ty = slotY(p, n1, b);
      if (op.from === "below") {
        // Climbing from the middle of the place below, with a fading tail.
        const sy = cyOf(p - 1);
        for (let tr = 4; tr >= 0; tr--) {
          const mm = ease(u - tr * 0.06);
          out.push({ k: DOT, x: lerp(CX, tx, mm), y: lerp(sy, ty, mm), s: 1 - tr * 0.12, a: tr ? 0.35 - tr * 0.06 : 1, g: 1 - 0.6 * ss(0.7, 1, u) });
        }
      } else {
        const sx = W + (op.sign === BAR ? BL / 2 + 2 : DR + 2), mm = 1 - (1 - u) * (1 - u) * (1 - u);
        out.push({ k: op.sign, x: lerp(sx, tx, mm), y: ty, s: 1, a: 1, g: 0.35 * (1 - u) });
      }
    } else if (op.k === "fuse") {
      const n = b + 1;
      for (let k = 0; k < b; k++) out.push({ k: BAR, x: CX, y: slotY(p, n, k), s: 1, a: 1, g: 0 });
      // The five slide together until they touch (a chain 26 LEDs long),
      // melt into one rod as thick as a dot, and the rod draws out to a bar.
      const y = slotY(p, n, b), m = ss(0, 0.45, u), gap = lerp(DS, 2 * DR * 0.92, m), fade = 1 - ss(0.38, 0.6, u);
      for (let i = 0; i < 5; i++) out.push({ k: DOT, x: CX + (i - 2) * gap, y, s: 1, a: fade, g: 0.7 * m });
      const melt = ss(0.35, 0.6, u), draw = ss(0.55, 1, u), chain = (8 * DR * 0.92 + 2 * DR) / BL;
      if (melt > 0) out.push({ k: BAR, x: CX, y, s: lerp(chain, 1, draw), th: lerp(2 * DR, BT, draw), a: melt, g: 0.7 * (1 - draw) });
    } else if (op.k === "carry") {
      // b, d still hold the place before the carry is taken out.
      const R = RADIX[S.mode][p], v = b * 5 + d - R, rb = floor(v / 5), rd = v % 5;
      const n = b + (d > 0 ? 1 : 0), ga = ease(u / 0.55), cy = cyOf(p);
      const gone = 1 - ss(0.4, 0.6, u);
      for (let k = 0; k < b; k++) out.push({ k: BAR, x: CX, y: lerp(slotY(p, n, k), cy, ga), s: 1 - 0.85 * ga, a: gone, g: ga });
      for (let i = 0; i < d; i++) out.push({ k: DOT, x: lerp(dotX(i, d), CX, ga), y: lerp(slotY(p, n, b), cy, ga), s: 1 - 0.4 * ga, a: gone, g: ga });
      const pop = ss(0.4, 0.65, u);
      if (pop > 0) out.push({ k: DOT, x: CX, y: cy, s: pop, a: 1, g: 1 });
      const back = ss(0.55, 1, u);
      if (back > 0) {
        staticPlace(out, p, rb, rd, back);
      }
    }
  }
  // A carry off the top place climbs off the panel.
  if (op && op.k === "in" && op.p >= P) {
    for (let tr = 4; tr >= 0; tr--) {
      const mm = ease(u - tr * 0.06);
      out.push({ k: DOT, x: CX, y: lerp(cyOf(P - 1), -8, mm), s: 1 - tr * 0.12, a: tr ? 0.35 - tr * 0.06 : 1, g: 1 });
    }
  }
  return out;
}

// ---- Drawing the signs, lit from the upper left.
const LX = -0.45, LY = -0.6, LZ = 0.66;

function bead(buf, x, y, r, col, a) {
  for (let j = max(0, floor(y - r - 1)); j <= min(H - 1, floor(y + r + 1)); j++)
    for (let i = max(0, floor(x - r - 1)); i <= min(W - 1, floor(x + r + 1)); i++) {
      const dx = i + 0.5 - x, dy = j + 0.5 - y, dd = sqrt(dx * dx + dy * dy), cov = cl(r + 0.5 - dd, 0, 1) * a;
      if (cov <= 0) continue;
      const nx = dx / (r + 0.3), ny = dy / (r + 0.3), nz = sqrt(max(0, 1 - nx * nx - ny * ny));
      const lam = max(0, nx * LX + ny * LY + nz * LZ), spec = Math.pow(lam, 12);
      const v = 0.28 + 0.72 * lam;
      const o = (j * W + i) * 3;
      for (let c = 0; c < 3; c++) buf[o + c] = max(buf[o + c], cov * (col[c] * v + 0.6 * spec));
    }
}

function rod(buf, x, y, len, th, col, a) {
  const r = th / 2, hx = max(0, len / 2 - r);
  for (let j = max(0, floor(y - r - 1)); j <= min(H - 1, floor(y + r + 1)); j++)
    for (let i = max(0, floor(x - hx - r - 1)); i <= min(W - 1, floor(x + hx + r + 1)); i++) {
      const dx0 = i + 0.5 - x, dy = j + 0.5 - y, dx = dx0 - cl(dx0, -hx, hx), dd = sqrt(dx * dx + dy * dy), cov = cl(r + 0.5 - dd, 0, 1) * a;
      if (cov <= 0) continue;
      const nx = dx / (r + 0.3), ny = dy / (r + 0.3), nz = sqrt(max(0, 1 - nx * nx - ny * ny));
      const lam = max(0, nx * LX + ny * LY + nz * LZ), spec = Math.pow(lam, 12);
      const v = 0.28 + 0.72 * lam;
      const o = (j * W + i) * 3;
      for (let c = 0; c < 3; c++) buf[o + c] = max(buf[o + c], cov * (col[c] * v + 0.5 * spec));
    }
}

// The shell: an oval 21 by 12, pointed a little at the ends, with a rim,
// a long curved slit through the middle and short teeth along both lips,
// like a cowrie turned over. Ivory, lit from the upper left.
function shell(buf, x, y, sc, col, a) {
  const rx = 10.5 * sc, ry = 5.9 * sc;
  for (let j = max(0, floor(y - ry - 1)); j <= min(H - 1, floor(y + ry + 1)); j++)
    for (let i = max(0, floor(x - rx - 1)); i <= min(W - 1, floor(x + rx + 1)); i++) {
      const u = (i + 0.5 - x) / rx, v = (j + 0.5 - y) / ry, au = abs(u), q = Math.pow(Math.pow(au, 1.7) + Math.pow(abs(v), 2), 1 / 2);
      if (q > 1.1) continue;
      const rimD = abs(q - 1) * ry * 1.1;
      let val = cl(1.15 - rimD, 0, 1);
      if (q < 1) {
        // Body, brighter up and left.
        val = max(val, 0.2 + 0.28 * cl(0.5 - 0.5 * u - 0.9 * v, 0, 1));
        // The slit: a gentle arc through the middle, dark.
        const sv = 0.06 - 0.12 * u * u, ds = abs(v - sv) * ry;
        if (au < 0.82) {
          if (ds < 0.55) val *= 0.15;
          // Teeth: one-LED ticks across each lip, every third column.
          else if (ds < 2 && (((i - round(x)) % 3) + 3) % 3 === 1) val = max(val, 0.85 * a);
        }
      }
      val *= a * cl((1.1 - q) * 8, 0, 1);
      const o = (j * W + i) * 3;
      for (let c = 0; c < 3; c++) buf[o + c] = max(buf[o + c], val * col[c]);
    }
}

// A 5-tap binomial blur, across and then down, over rows y0..y1 only.
function blur(src, tmp, out, y0, y1) {
  const R = W * 3;
  y0 = max(0, y0);
  y1 = min(H - 1, y1);
  for (let y = max(0, y0 - 2); y <= min(H - 1, y1 + 2); y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        const p = (y * W + x) * 3 + c;
        tmp[p] = (6 * src[p] + 4 * ((x > 0 ? src[p - 3] : 0) + (x < W - 1 ? src[p + 3] : 0)) + (x > 1 ? src[p - 6] : 0) + (x < W - 2 ? src[p + 6] : 0)) / 16;
      }
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        const p = (y * W + x) * 3 + c;
        out[p] = (6 * tmp[p] + 4 * ((y > 0 ? tmp[p - R] : 0) + (y < H - 1 ? tmp[p + R] : 0)) + (y > 1 ? tmp[p - 2 * R] : 0) + (y < H - 2 ? tmp[p + 2 * R] : 0)) / 16;
      }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, sig, hot, tmp, blr, blh } = S;
  const jade = hsv(0.4 + S.hue, 0.6, 1), gold = hsv(0.13 + S.hue, 0.5, 1), ivory = hsv(0.11 + S.hue, 0.18, 0.95);
  sig.fill(0);
  hot.fill(0);
  // Rows the moving signs cover, so the wide glow is worked only there.
  let h0 = H, h1 = -1;
  for (const sp of sprites(S)) {
    if (sp.a <= 0.01) continue;
    const g = cl(sp.g, 0, 1);
    const col = [lerp(jade[0], gold[0], g), lerp(jade[1], gold[1], g), lerp(jade[2], gold[2], g)];
    // Signs on the move also go into the hot buffer, which glows wider.
    for (const [buf, a] of g > 0.02 ? [[sig, sp.a], [hot, sp.a * g]] : [[sig, sp.a]]) {
      if (sp.k === DOT) bead(buf, sp.x, sp.y, DR * sp.s, col, a);
      else if (sp.k === BAR) rod(buf, sp.x, sp.y, max(BT, BL * sp.s), sp.th || BT, col, a);
      else shell(buf, sp.x, sp.y, sp.s, ivory, a);
    }
    if (g > 0.02) (h0 = min(h0, floor(sp.y) - 4)), (h1 = max(h1, floor(sp.y) + 4));
  }
  blur(sig, tmp, blr, 0, H - 1);
  blh.fill(0);
  if (h1 >= 0) {
    blur(hot, tmp, blh, h0 - 4, h1 + 4);
    hot.fill(0);
    blur(blh, tmp, hot, h0 - 6, h1 + 6);
  }
  const bg = hsv(0.4 + S.hue, 0.5, 0.05);
  for (let y = 0; y < H; y++) {
    const line = abs(((y + 0.5) % CELL) - 0.5) < 0.6 && y > 2 ? 0.07 : 0;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3;
      for (let c = 0; c < 3; c++) rgb[o + c] = bg[c] + line * jade[c] + 0.85 * sig[o + c] + 0.45 * blr[o + c] + 1.4 * hot[o + c];
    }
  }
  for (let p = 0; p < NP; p++)
    display.setPixel(p % W, floor(p / W), min(255, rgb[p * 3] * 255) | 0, min(255, rgb[p * 3 + 1] * 255) | 0, min(255, rgb[p * 3 + 2] * 255) | 0);
}
