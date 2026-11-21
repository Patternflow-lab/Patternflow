// ===== Patternflow pattern =====
// Title:   Liesegang Rings
// Family:  precipitate
// Idea:    A dim gel plate seen from above, with drops landing at random places and each one growing rings of blue precipitate that form one by one as the diffusion front passes, the bands and the clear gaps between them widening outward, until the rings of neighbouring drops run into each other along seams and each drop in turn dissolves back to clear gel while a new one lands in the emptiest corner.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Liesegang rings (Raphael Eduard Liesegang, 1896); spacing law of Jabczynski (1923)
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Reach=0..3, Spacing=-1..1, Band=-1..1
//
// Knob 1: Hue. The colour of the precipitate, from Prussian blue where the knob opens and round the whole wheel from there; the newest rings are always the lightest and the oldest turn towards indigo, and the gel stays a cool dark grey.
// Knob 2: Reach. How fast the diffusion fronts spread, so how many rings a drop of a given age has grown: at the bottom a front is only 30 LEDs out after 80 s and the plate stays half clear, where the knob opens it is 40 LEDs out after 40 s, and at the top it is 39 LEDs out after 20 s and the drops fill the plate and push into each other.
// Knob 3: Spacing. The ratio between one gap and the next, from 1.12 to 1.6 with 1.28 where the knob opens: tight at the bottom, where the rings crowd outward in steps only a little wider each time and six fit within 35 LEDs of a drop, and wide at the top, where each gap is more than half again the one before and only four do.
// Knob 4: Band. How much of each ring period is precipitate and how much clear gel, from thin faint bands in wide clear gaps at the bottom to strong bands about half a period wide at the top; bands and gaps never get narrower than 2 LEDs, so the first rings, whose period is only about 5, change little.

const W = 64;
const H = 128;
const N = W * H;
// The most drops on the plate at once, counting the ones that are dissolving.
const MAXS = 8;
// Radius of the first ring, and the width of the gap before the second, in LEDs.
const R0 = 5;
const G = 4.6;
// How fast a front spreads at the opening of Reach, as LEDs squared a second. The front radius is the square root of the sum of this over time.
const C0 = 40;
// A ring starts to show LAG seconds after the front passed it, fades in over FADE seconds and thickens over GROW seconds.
const LAG = 1.2;
const FADE = 3;
const GROW = 9;
// A drop that has lived out its life dissolves over this many seconds.
const DISSOLVE = 20;
// The narrowest band, and how soft its edge is, in LEDs.
const MINW = 2.2;
const RAMP = 1.0;
const NR = 48;
// A drop lands only where the gel is clear this far all round, and the search looks this far.
const ROOM = 11;
const LOOK = 30;
const EDGE = 10;
// How bright the haze behind a front is, as a share of full precipitate.
const FRONT = 0.34;

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(x) {
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return x * x * (3 - 2 * x);
}

export function setup(params) {
  params.t = 0;
  params.started = false;
  params.last = -100;
  params.gap = 6;
  params.serial = 1;
  params.owner = new Int8Array(N).fill(-1);
  params.ownT = new Float32Array(N);
  params.dist = new Float32Array(N);
  params.src = Array.from({ length: MAXS }, () => ({ on: false, x: 0, y: 0, u: 0, up: 0, age: 0, life: 90, id: 0 }));
  params.q = 1.28;
  params.share = 0.25;
  params.amp = 0.9;
  params.gel = new Float32Array(3);
  params.fresh = new Float32Array(3);
  params.mid = new Float32Array(3);
  params.old = new Float32Array(3);
  params.rr = new Float32Array(NR);
  params.rr2 = new Float32Array(NR);
  params.ww = new Float32Array(NR);
  params.left = new Float32Array(MAXS);
  params.invLogQ = 1;
  params.invC = 1 / C0;
}

// A front has crossed every LED whose squared distance from the drop lies in (up, u]. Those that nobody owns yet become the drop's, and stay its until it dissolves.
function claim(p, slot, s, t0, dt) {
  const { owner, ownT, dist } = p;
  const rf = Math.sqrt(s.u);
  const y0 = Math.max(0, Math.floor(s.y - rf - 1));
  const y1 = Math.min(H - 1, Math.ceil(s.y + rf + 1));
  const span = s.u - s.up;
  const step = rf - Math.sqrt(s.up);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - s.y;
    const dy2 = dy * dy;
    if (dy2 > s.u) continue;
    const outer = Math.sqrt(s.u - dy2);
    const inner = s.up > dy2 ? Math.sqrt(s.up - dy2) : 0;
    // The row's two stretches of columns that can hold the annulus, a column of margin each side; the exact test below decides.
    const xa = Math.max(0, Math.floor(s.x - outer - 1));
    const xb = Math.min(W - 1, Math.ceil(s.x + outer + 1));
    const la = Math.min(xb, Math.floor(s.x - inner + 1));
    const rb = Math.max(xa, Math.ceil(s.x + inner - 1));
    for (let x = xa; x <= xb; x++) {
      if (x > la && x < rb) {
        x = rb - 1;
        continue;
      }
      const dx = x + 0.5 - s.x;
      const d2 = dx * dx + dy2;
      if (d2 <= s.up || d2 > s.u) continue;
      const i = y * W + x;
      // The front only reaches a LED over gel its own rings already hold: if the LED a little nearer the drop on the way belongs to a neighbour, or to nobody, the neighbour's cell shades this one, and no thin tongues of one cell run through the gaps of another.
      if (d2 > 36) {
        // Look back far enough that the LED looked at was crossed in an earlier frame.
        const d = Math.sqrt(d2);
        const k = 1 - Math.max(0.15 * d, step + 1) / d;
        const mx = Math.floor(s.x + dx * k);
        const my = Math.floor(s.y + dy * k);
        if (owner[my * W + mx] !== slot) continue;
      }
      const tc = t0 + (dt * (d2 - s.up)) / span;
      const o = owner[i];
      // Two fronts may cross one LED in the same frame; the earlier one wins.
      if (o >= 0 && !(ownT[i] > t0 && tc < ownT[i])) continue;
      owner[i] = slot;
      ownT[i] = tc;
      dist[i] = Math.sqrt(d2);
    }
  }
}

// How far from (x, y) the gel stays clear in every direction, in LEDs, up to LOOK.
function clearRadius(p, x, y) {
  const { owner } = p;
  let least = LOOK;
  for (let a = 0; a < 16; a++) {
    const cx = Math.cos(a * 0.3927);
    const cy = Math.sin(a * 0.3927);
    for (let r = 1; r < least; r += 1) {
      const px = Math.floor(x + cx * r);
      const py = Math.floor(y + cy * r);
      // The panel's edge counts as clear gel, but only a few LEDs' worth, so drops do not crowd the border.
      if (px < 0 || px >= W || py < 0 || py >= H) {
        if (r + EDGE < least) least = r + EDGE;
        break;
      }
      if (owner[py * W + px] >= 0) {
        least = r;
        break;
      }
    }
  }
  return least;
}

// How long a new drop lives, 55 to 100 s before it begins to dissolve: of a handful of random lives, the one that makes it die furthest from when the others die, so the plate does not go still with all its drops in mid-life and then lose them together.
function pickLife(p) {
  let best = 55;
  let far = -1;
  for (let c = 0; c < 8; c++) {
    const life = 55 + Math.random() * 45;
    let near = 1e9;
    for (let k = 0; k < MAXS; k++) {
      const o = p.src[k];
      if (o.on) near = Math.min(near, Math.abs(life - (o.life - o.age)));
    }
    if (near > far) {
      far = near;
      best = life;
    }
  }
  return best;
}

// Put a new drop where the gel is clearest, judged from a few dozen random places; if no place has room for its first rings, wait.
function spawn(p) {
  let slot = -1;
  for (let k = 0; k < MAXS; k++)
    if (!p.src[k].on) {
      slot = k;
      break;
    }
  if (slot < 0) return false;
  let best = 0;
  let bx = 0;
  let by = 0;
  for (let c = 0; c < 40; c++) {
    const x = 2 + Math.random() * 60;
    const y = 2 + Math.random() * 124;
    const score = clearRadius(p, x, y) + Math.random() * 3;
    if (score > best) {
      best = score;
      bx = x;
      by = y;
    }
  }
  if (clearRadius(p, bx, by) < ROOM) return false;
  const s = p.src[slot];
  s.on = true;
  s.x = bx;
  s.y = by;
  s.u = 0;
  s.up = 0;
  s.age = 0;
  s.life = pickLife(p);
  s.id = p.serial++;
  return true;
}

function release(p, slot) {
  const { owner } = p;
  for (let i = 0; i < N; i++) if (owner[i] === slot) owner[i] = -1;
  p.src[slot].on = false;
}

// How many drops should be settled on the plate, wandering between five and seven.
function wanted(t) {
  const v = 0.5 + 0.25 * Math.sin(0.021 * t + 1.1) + 0.25 * Math.sin(0.0097 * t + 2.4);
  return v > 0.66 ? 7 : v > 0.33 ? 6 : 5;
}

// Whether each third of the plate, top, middle and foot, has at least 60% of its LEDs claimed by a drop that has not begun to dissolve.
function spread(p) {
  const n = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const o = p.owner[i];
    if (o >= 0 && p.src[o].age < p.src[o].life) n[Math.min(2, Math.floor(i / 2731))]++;
  }
  return n[0] > 1640 && n[1] > 1640 && n[2] > 1640;
}

function step(p, dt, c) {
  const t0 = p.t;
  p.t += dt;
  let settled = 0;
  let total = 0;
  for (let k = 0; k < MAXS; k++) {
    const s = p.src[k];
    if (!s.on) continue;
    s.age += dt;
    s.up = s.u;
    s.u += c * dt;
    claim(p, k, s, t0, dt);
    if (s.age > s.life + DISSOLVE) {
      release(p, k);
      continue;
    }
    total++;
    if (s.age < s.life) settled++;
  }
  if (settled < wanted(p.t) && total < MAXS && p.t - p.last >= p.gap) {
    if (spawn(p)) {
      p.last = p.t;
      p.gap = 5 + Math.random() * 5;
    }
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const f = Math.pow(2, (clamp(k[1], 0, 3) - 2) / 2.2);
  const c = C0 * f * f;
  params.invC = 1 / c;
  const sp = clamp(k[2], -1, 1);
  params.q = sp < 0 ? 1.28 + 0.16 * sp : 1.28 + 0.32 * sp;
  // How far a band opens from the narrowest it may be towards the widest that still leaves a gap at least as wide as the narrowest band.
  const bd = (clamp(k[3], -1, 1) + 1) / 2;
  params.share = 0.6 * Math.pow(bd, 1.6);
  // Thin bands hold less precipitate and show fainter.
  params.amp = 0.72 + 0.28 * Math.pow(bd, 0.7);
  const h = k[0] + 0.605;
  // The gel stays a cool dark grey-blue whatever the hue, with a trace of it.
  hsv(0.6, 0.5, 0.125, params.gel);
  hsv(h, 0.5, 0.125, params.mid);
  for (let j = 0; j < 3; j++) params.gel[j] = 0.7 * params.gel[j] + 0.3 * params.mid[j];
  hsv(h - 0.02, 0.4, 1, params.fresh);
  hsv(h + 0.035, 0.95, 0.95, params.mid);
  hsv(h + 0.1, 0.9, 0.68, params.old);
  // The plate has been standing for a while when the panel opens.
  if (!params.started) {
    params.started = true;
    for (let s = 0; s < 750; s++) step(params, 0.2, c);
    // Go on until every third of the plate has a fair share of it claimed, so it never opens with a bare top or foot.
    for (let s = 0; s < 450 && !spread(params); s++) step(params, 0.2, c);
  }
  let left = dt;
  while (left > 0) {
    const d = Math.min(left, 0.1);
    step(params, d, c);
    left -= d;
  }
}

// How much of a ring of drop s shows at distance d from it, 0 to 1. Sets freshness and oldness to how young and how old the winning ring is.
let freshness = 0;
let oldness = 0;
function rings(p, s, d) {
  const { rr, rr2, ww } = p;
  const nf = d > R0 ? Math.log(1 + ((d - R0) * (p.q - 1)) / G) * p.invLogQ : 0;
  const n0 = Math.round(nf);
  let best = 0;
  freshness = 0;
  oldness = 0;
  for (let n = n0 - 1; n <= n0 + 1; n++) {
    if (n < 0 || n >= NR) continue;
    const t1 = (s.u - rr2[n]) * p.invC - LAG;
    if (t1 <= 0) continue;
    const w = MINW + (ww[n] - MINW) * smooth(t1 / GROW);
    // A wide band has a softer edge than a narrow one.
    const ramp = RAMP + 0.12 * (w - MINW);
    let b = clamp((w * 0.5 - Math.abs(d - rr[n])) / ramp + 0.5, 0, 1);
    b = b * b * (3 - 2 * b) * smooth(t1 / FADE) * (0.82 + 0.18 * hash(s.id, n)) * p.amp;
    if (b > best) {
      best = b;
      freshness = Math.exp(-t1 / 9);
      oldness = smooth((t1 - 5) / 85);
    }
  }
  // The drop itself, a faint wet spot that dries within a few seconds.
  if (d < 3.4 && s.age < 30) {
    const a = (1 - d / 3.4) * 0.55 * Math.exp(-s.age / 7);
    if (a > best) {
      best = a;
      freshness = 1;
      oldness = 0;
    }
  }
  // The front itself, a faint haze just behind the reagent as it spreads.
  const behind = Math.sqrt(s.u) - d;
  if (behind > 0 && behind < 9) {
    const a = FRONT * Math.exp(-behind / 3) * smooth(behind / 1.2);
    if (a > best) {
      best = a;
      freshness = 0;
      oldness = 0;
    }
  }
  return best;
}

export function draw(display, params) {
  const { owner, dist, src, gel, fresh, mid, old, rr, rr2, ww, left } = params;
  const q = params.q;
  const share = params.share;
  params.invLogQ = 1 / Math.log(q);
  const wk = 2 / (1 + 1 / q);
  // Ring n sits at R0 + G (q^n - 1) / (q - 1), and the gap before it is G q^(n - 1).
  let g = G / q;
  let r = R0;
  for (let n = 0; n < NR; n++) {
    if (n > 0) {
      g *= q;
      r += g;
    }
    rr[n] = r;
    rr2[n] = r * r;
    // Band and clear gap each stay at least MINW wide.
    ww[n] = MINW + share * Math.max(0, (g - MINW) * wk - MINW);
  }
  // How much of each drop is left: one until it has lived out its life, then it dissolves.
  for (let k = 0; k < MAXS; k++) {
    const s = src[k];
    left[k] = s.on ? 1 - smooth((s.age - s.life) / DISSOLVE) : 0;
  }
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const o = owner[i];
      let R = gel[0];
      let G2 = gel[1];
      let B = gel[2];
      if (o >= 0) {
        // The 3 x 3 around this LED: if every one belongs to the same drop, this LED shows that drop's rings. Where some belong to another, each drop's rings are read at this LED's own position and averaged by how many of the nine are its, so a seam is a blend one LED wide and not a staircase.
        let seam = false;
        for (let dy = -1; dy <= 1 && !seam; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < W && owner[yy * W + xx] !== o) {
              seam = true;
              break;
            }
          }
        }
        let b = rings(params, src[o], dist[i]) * left[o];
        let wf = freshness;
        let wo = oldness;
        if (seam) {
          const mine = b;
          const mineF = b * wf;
          const mineO = b * wo;
          let sumB = 0;
          let sumF = 0;
          let sumO = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              const yy = y + dy;
              const oo = xx < 0 || xx >= W || yy < 0 || yy >= H ? o : owner[yy * W + xx];
              if (oo < 0) continue;
              if (oo === o) {
                sumB += mine;
                sumF += mineF;
                sumO += mineO;
              } else {
                const s = src[oo];
                const ex = x + 0.5 - s.x;
                const ey = y + 0.5 - s.y;
                const bb = rings(params, s, Math.sqrt(ex * ex + ey * ey)) * left[oo];
                sumB += bb;
                sumF += bb * freshness;
                sumO += bb * oldness;
              }
            }
          b = sumB / 9;
          wf = sumB > 1e-4 ? sumF / sumB : 0;
          wo = sumB > 1e-4 ? sumO / sumB : 0;
        }
        const wm = 1 - wf - wo;
        R += (fresh[0] * wf + mid[0] * wm + old[0] * wo - R) * b;
        G2 += (fresh[1] * wf + mid[1] * wm + old[1] * wo - G2) * b;
        B += (fresh[2] * wf + mid[2] * wm + old[2] * wo - B) * b;
      }
      display.setPixel(x, y, R * 255, G2 * 255, B * 255);
    }
}
