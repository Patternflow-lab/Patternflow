// ===== Patternflow pattern =====
// Title:   Gel Run
// Family:  electrophoresis
// Idea:    An agarose gel under a UV transilluminator seen from above and filling the panel, a dark violet slab with eight lanes hanging from a row of dark wells, where each lane is loaded at its own time and its DNA fragments creep down as soft stain-lit bands, small ones far and large ones barely, broadening and dimming as they diffuse, while the hotter middle lanes outrun the edges and bend the band lines into a smile.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: gel electrophoresis (Arne Tiselius, 1937), agarose gels (Stellan Hjerten, 1961), the log-linear relation of fragment length to distance run (Helling, Goodman and Boyer, 1974; Edwin Southern, 1979), the ethidium bromide stain that glows orange under UV (Phillip Sharp, William Sugden and Joseph Sambrook, 1973), pattern round 213
// Round:   213
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Voltage=0.25..4, Gel=0.5..2.5, Smile=0..1
//
// Knob 1: Hue. Turns the stain colour round the wheel, and the faint haze of free stain in the slab with it. It opens on ethidium orange-pink, reaches SYBR green about a third of the way round and is back on orange-pink at 1. The slab stays violet.
// Knob 2: Voltage. How hard the field pulls, and a fragment's speed is in proportion to it. At the opening 2 the 100 bp band of an edge lane crosses the 118 rows of gel in 107 seconds, at 4 in 54 seconds and at 0.25 in 14 minutes, the middle lanes and the thicker gels faster and slower than that. Diffusion keeps its own clock, so a fast run reaches the foot with its bands a little sharper (0.8 times the spread at 4 that there is at 2) and a slow one with them blurred (1.9 times at 0.25).
// Knob 3: Gel. The agarose percentage, 0.5 where it opens. The size that barely enters the gel is 25,000 bp at 0.5, 8,700 bp at 1, 3,000 bp at 2 and 2,100 bp at 2.5. At 0.5 the ladder's 10,000 bp band has run a sixth as far as its 100 bp band. Turned up, the large bands pile toward the wells, the small ones draw apart, the stuck ones sit dim on the well edge, and the whole run is slower (0.53 times as fast at 2.5) and diffuses less.
// Knob 4: Smile. How much hotter the middle of the gel runs than its edges. The middle lanes run 0.9 times the square root of the knob faster than the two outer lanes: the knob goes in as its square root, so the opening 0.06 is a smile of about a fifth, and at 1 the middle lanes run 1.9 times as fast. The heat also spreads the bands of the hot lanes, up to 3.5 times as fast at 1. At 0 every band line is straight.

// What the picture is. One LED of the panel is one row or column of a gel 64 LEDs wide and 128 tall: eight lanes of
// 8 LEDs, each 6 LEDs of well and 2 of gel between. The wells are rows 6 to 9 and a fragment starts from the bottom
// edge of its well (row 10), so the run is 118 rows long.
//
// The distance run. A fragment of L base pairs has run
//   d = P F (1 - (log10 L - 2) / (log10 Llim - 2)), never below 0,
// when the lane has had its field long enough for the 100 bp band to run P rows. P grows at 0.55 rows a second for
// each volt, times (0.5 / gel)^0.4 for the slower run in a thicker gel. Llim, the size that barely enters, is 25,000 bp
// at 0.5 percent and falls as gel^-1.53, which takes it through 3,000 bp at 2 percent, the two figures the books give.
// F is the lane's heat, 1 + 0.9 s (1 - ((x - 32) / 28)^2), s being the square root of the knob: 1 at the two edge lanes
// and nearly 1.9 in the middle at the top of the knob. A band tilts across its lane by 25 percent of the heat step
// there (at most 1.4 rows each way), which is how a real smile bends bands across a lane.
//
// Diffusion. Each band is a Gaussian along the lane with sigma^2 = 0.85^2 + 2 D t, D being 0.009 rows^2 a second for
// 100 bp, times (L / 100)^-0.6 and (0.6 / gel)^0.5, and the hot lanes 1 + 2.5 s^2 times their share of the heat more.
// t is the real time since the loading (times (V / 2)^0.7, so that a slow run is not smeared to nothing). The band
// keeps the sum of its light: a wide old band is dimmer, and sigma stops near 2.1 rows. Across the lane a band is flat
// for 5 LEDs with half-lit edges, and its stain bleeds into the gel as a halo 1.8 rows taller and 2.3 LEDs wider than
// the band, a third as bright. A band is dimmer while it is still in the well (it counts for 40 percent at row 10
// and for all of itself 12 rows down), and a band of a size the gel hardly lets in is dimmer by up to 45 percent.
//
// Loading. A lane may load again when the slowest band of its last sample (of those that move at all) has run 25
// rows, or when the 100 bp band of it would have run 1.45 gels. It then waits 1 to 24 seconds. A neighbour that may
// load too follows 0.6 to 3.5 seconds later with a chance of 0.55, with the same fragments (a replicate) in 0.6 of
// those, and that draws band lines across two or three lanes until they drift apart. A sample is 3 to 8 fragments, half
// of them from a pool of 9 sizes that is slowly redrawn, the rest at random from 100 to 10,000 bp (rarely above what the
// gel lets in), none closer than 0.19 in log10 (less when the gel lets in little). Lane 0 is the 1 kb ladder: 12 fragments from 100 to 10,000 bp at
// equal ratios, the 2,848 bp one half as bright again. Fresh DNA is a bright slug in the well that fades over 7 rows
// of run as the bands leave it. A band that runs off the foot is gone.
//
// Before the first frame the gel runs until the 100 bp band of a lane loaded at the very start would have gone 150
// rows (136 seconds at the opening knobs), the lanes having been loaded at random over the first 130 rows of run. Nothing
// here has a cycle: what a lane loads comes from random draws, and when it loads from its own bands.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, exp, sin, abs, min, max, pow, log10 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const between = (a, b) => a + (b - a) * rnd();

const NL = 8; // lanes
const PITCH = 8; // LEDs from one lane to the next
const HW = 2.5; // half the width of a band across its lane
const WELL_T = 6, WELL_B = 10; // rows of the wells: 6 to 9, a band starts at row 10
const RUN = H - WELL_B; // rows of gel below the wells
const SIG0 = 0.85; // sigma of a fresh band, rows (about 2 LEDs thick)
const LG_MIN = 2; // log10 of 100 bp
const RATE = 0.55; // rows a second for the 100 bp band, per volt, in a gel of 0.5 percent
const DREF = 0.009; // rows^2 a second a 100 bp band spreads by in a gel of 0.6 percent
const HEAT = 0.9; // how much faster the middle lane runs than the edge at Smile 1
const TILT = 0.25; // share of the lane to lane heat step a band shows across one lane, at most 1.4 rows each way
const GAP = 25; // rows the slowest band must be down before a lane loads again
const PRE_P = 150; // rows of run the first update has already made
const HALO = 0.33; // brightness of the halo as a share of the band's
const BR = 0.95; // light of a band of mass 1, at its sharpest
const LADDER_REF = 8; // the ladder's brighter band, 2,848 bp

const SLAB = [0.1, 0.034, 0.24];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The smile: 0 at the two edge lanes' centres, 1 on the middle line of the gel.
const shapeAt = (x) => {
  const u = (x - 32) / 28;
  return 1 - u * u;
};
// The size that barely enters, as log10, at a gel of g percent.
const lgLim = (g) => 4.398 - 1.53 * log10(g / 0.5);
const mobility = (lg, g) => max(0, 1 - (lg - LG_MIN) / (lgLim(g) - LG_MIN));

export function setup(params) {
  const wellCov = new Float32Array(NPX);
  const wellRim = new Float32Array(NPX);
  const laneW = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const l = floor(x / PITCH), off = x + 0.5 - (PITCH * l + 4);
    laneW[x] = cl(HW + 0.5 - abs(off), 0, 1);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const l = floor(x / PITCH), cx = PITCH * l + 4;
      const sd = max(abs(x + 0.5 - cx) - 3, abs(y + 0.5 - 8) - 2);
      wellCov[y * W + x] = cl(0.5 - sd / 0.9, 0, 1);
      wellRim[y * W + x] = sd > 0 ? exp(-((sd - 0.7) * (sd - 0.7)) / 0.5) : 0;
    }
  const lanes = [];
  for (let l = 0; l < NL; l++)
    lanes.push({
      cx: PITCH * l + 4,
      ladder: l === 0,
      j: between(0.97, 1.03),
      Lt: 0,
      bands: [],
      last: null,
      lastP0: 0,
      slug: 0,
      loadAt: null,
      elig: true,
      occ: 0,
      copy: null,
    });
  const pool = [];
  for (let k = 0; k < 9; k++) pool.push(between(2.05, 3.95));
  params.s = {
    t: 0,
    hue: 0,
    volt: 2,
    gel: 0.5,
    smile: 0.25,
    ready: false,
    lanes,
    pool,
    poolAt: between(40, 80),
    I: new Float32Array(NPX),
    wellCov,
    wellRim,
    laneW,
    col: [0, 0, 0],
    pcol: [0, 0, 0],
  };
}

// ------------------------------------------------------------- the run

const rateOf = (S) => RATE * S.volt * pow(0.5 / S.gel, 0.4);

// The fragments of one loading: a list of [log10 length, mass].
function makeSample(S, lane) {
  const out = [];
  if (lane.ladder) {
    for (let k = 0; k < 12; k++) out.push([LG_MIN + (2 * k) / 11, k === LADDER_REF ? 1.35 : 0.8]);
    return out;
  }
  // random sizes, none within a band's width of another at a young run, so that the bands do not clump
  const top = min(4, max(LG_MIN + 0.4, lgLim(S.gel) - 0.12));
  const hi = rnd() < 0.2 ? 4 : top;
  const n = 3 + floor(pow(rnd(), 1.3) * 6);
  const gap = min(0.19, (0.8 * (hi - LG_MIN)) / n);
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 30; tries++) {
      let lg = between(LG_MIN + 0.03, hi);
      if (rnd() < 0.5) lg = S.pool[floor(rnd() * S.pool.length)] + between(-0.008, 0.008);
      if (lg < LG_MIN || lg > hi) continue;
      let near = false;
      for (const o of out) if (abs(o[0] - lg) < gap) near = true;
      if (near) continue;
      out.push([lg, between(0.38, 1)]);
      break;
    }
  }
  return out;
}

function load(S, lane, sample) {
  const grp = [];
  for (const [lg, m] of sample) {
    const b = { lg, f: mobility(lg, S.gel), m, P0: lane.Lt, d: 0, dd: 0, sg: SIG0, fade: 1, dying: false, tD: 0, fresh: true };
    grp.push(b);
    lane.bands.push(b);
  }
  for (const b of lane.bands) if (!b.dying && b.f < 0.1 && b.d < 12 && !grp.includes(b)) b.dying = true;
  lane.last = grp;
  lane.lastP0 = lane.Lt;
  lane.slug = min(0.8, lane.slug + 0.7);
  lane.loadAt = null;
  lane.copy = null;
}

function step(S, d) {
  S.t += d;
  const r = rateOf(S);
  const s = S.smile, g = S.gel;
  const ease = 1 - exp(-d / 0.6);
  const vf = pow(S.volt / 2, 0.7); // diffusion goes on in real time, a little less of it for each row at a high voltage
  S.poolAt -= d;
  if (S.poolAt <= 0) {
    S.poolAt = between(30, 90);
    S.pool[floor(rnd() * S.pool.length)] = between(2.05, 3.95);
  }
  for (let l = 0; l < NL; l++) {
    const lane = S.lanes[l];
    lane.Lt += r * d * lane.j;
    lane.slug *= exp((-r * lane.j * d) / 7);
    const sh = shapeAt(lane.cx);
    const Fl = 1 + HEAT * s * sh;
    const dm = 1 + 2.5 * s * s * sh;
    const dg = sqrt(0.6 / g);
    let k = 0;
    for (let i = 0; i < lane.bands.length; i++) {
      const b = lane.bands[i];
      b.f = mobility(b.lg, g);
      const dist = (lane.Lt - b.P0) * Fl * b.f;
      b.d = dist;
      b.tD += d * vf;
      const Dd = DREF * pow(pow(10, b.lg - LG_MIN), -0.6) * dg * dm;
      let sg2 = SIG0 * SIG0 + 2 * Dd * b.tD;
      let sg = sqrt(sg2);
      sg = sg > 2.1 ? 2.1 + 0.4 * (1 - exp(-(sg - 2.1) / 0.8)) : sg;
      if (b.fresh) {
        b.dd = dist;
        b.sg = sg;
        b.fresh = false;
      } else {
        b.dd += (dist - b.dd) * ease;
        b.sg += (sg - b.sg) * ease;
      }
      if (b.dying) b.fade -= d / 2.5;
      if (b.fade <= 0 || b.dd > RUN + 6) continue;
      lane.bands[k++] = b;
    }
    lane.bands.length = k;
    lane.occ += ((k > 0 ? 1 : 0) - lane.occ) * (1 - exp(-d / 2));
  }
  // who may load, who does
  for (let l = 0; l < NL; l++) {
    const lane = S.lanes[l];
    let ok = true;
    const grp = lane.last;
    if (grp) {
      let top = 1e9, any = false;
      for (const b of grp) if (b.f >= 0.1 && !b.dying) {
        any = true;
        if (b.d < top) top = b.d;
      }
      const ps = (lane.Lt - lane.lastP0) * (1 + HEAT * s * shapeAt(lane.cx));
      ok = any ? top >= GAP || ps >= 1.45 * RUN : ps >= 45;
    }
    lane.elig = ok;
    if (!ok) {
      lane.loadAt = null;
      continue;
    }
    if (lane.loadAt === null) lane.loadAt = S.t + between(1, 24);
  }
  for (let l = 0; l < NL; l++) {
    const lane = S.lanes[l];
    if (lane.loadAt === null || S.t < lane.loadAt || !lane.elig) continue;
    const sample = lane.copy || makeSample(S, lane);
    load(S, lane, sample);
    if (lane.ladder) continue;
    for (const nl of [l - 1, l + 1]) {
      const nb = S.lanes[nl];
      if (!nb || nb.ladder || !nb.elig || nb.copy || rnd() > 0.55) continue;
      nb.loadAt = S.t + between(0.6, 3.5);
      if (rnd() < 0.6) nb.copy = sample.map(([lg, m]) => [lg + between(-0.004, 0.004), clampM(m * between(0.85, 1.15))]);
    }
  }
}

const clampM = (m) => cl(m, 0.3, 1);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0.5, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.volt = cl(kn[1], 0.25, 4);
  S.gel = cl(kn[2], 0.5, 2.5);
  S.smile = sqrt(cl(kn[3], 0, 1));
  const d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    const r = rateOf(S);
    for (const lane of S.lanes) lane.loadAt = (rnd() * 130) / r;
    let P = 0, T = 0;
    while (P < PRE_P && T < 1500) {
      step(S, 0.5);
      P += r * 0.5;
      T += 0.5;
    }
    for (const lane of S.lanes) for (const b of lane.bands) b.dd = b.d;
  }
  step(S, d);
}

// ------------------------------------------------------------ the picture

function splatBand(S, lane, b) {
  const I = S.I, laneW = S.laneW;
  const sg = b.sg;
  const amp = ((BR * b.m * SIG0) / sg) * b.fade * (0.55 + 0.45 * sm(0.02, 0.15, b.f)) * (0.4 + 0.6 * sm(1, 12, b.d));
  if (amp < 0.004) return;
  const yc = WELL_B + b.dd;
  const cx = lane.cx;
  const sh = shapeAt(cx);
  const tl = (TILT * b.dd * HEAT * S.smile) / (1 + HEAT * S.smile * sh);
  // the core, a column at a time so that the band can tilt
  const inv = 1 / (2 * sg * sg);
  const reach = ceil(sg * 3) + 1;
  for (let x = cx - 3; x <= cx + 2; x++) {
    const wx = laneW[x];
    if (wx <= 0) continue;
    const yy = yc + cl(tl * (shapeAt(x + 0.5) - sh), -1.4, 1.4);
    const ya = max(0, floor(yy - reach)), yb = min(H - 1, floor(yy + reach));
    for (let y = ya; y <= yb; y++) {
      const dy = y + 0.5 - yy;
      const gm = sm(WELL_B - 0.4, WELL_B + 0.8, y + 0.5);
      I[y * W + x] += amp * wx * gm * exp(-dy * dy * inv);
    }
  }
  // the halo, wider and a little taller
  const sh2 = sg * sg + 3.2;
  const sgh = sqrt(sh2), invh = 1 / (2 * sh2);
  const ah = amp * (sg / sgh) * HALO;
  const rh = ceil(sgh * 2.6);
  const ya = max(0, floor(yc - rh)), yb = min(H - 1, floor(yc + rh));
  for (let y = ya; y <= yb; y++) {
    const dy = y + 0.5 - yc;
    const v = ah * exp(-dy * dy * invh) * sm(WELL_B - 3, WELL_B + 1, y + 0.5);
    if (v < 0.002) continue;
    for (let x = max(0, cx - 6); x <= min(W - 1, cx + 5); x++) {
      const ox = x + 0.5 - cx;
      I[y * W + x] += v * exp(-(ox * ox) / 10.6);
    }
  }
}

function splatSlug(S, lane) {
  const a = lane.slug;
  if (a < 0.01) return;
  const I = S.I, laneW = S.laneW, cx = lane.cx;
  for (let y = 4; y <= 16; y++) {
    const cy = y + 0.5 - 8;
    const cover = cl(0.5 + 0.9 * (2 - abs(cy)), 0, 1);
    const hy = exp(-(cy * cy) / 7);
    for (let x = max(0, cx - 6); x <= min(W - 1, cx + 5); x++) {
      const ox = x + 0.5 - cx;
      const v = a * (laneW[x] * cover * (0.75 + 0.25 * (y - 6) / 4) + HALO * hy * exp(-(ox * ox) / 10.6));
      I[y * W + x] += v;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const I = S.I, t = S.t, rgb = S.col, pc = S.pcol;
  I.fill(0);
  for (const lane of S.lanes) {
    for (const b of lane.bands) splatBand(S, lane, b);
    splatSlug(S, lane);
  }
  // the stain: pink-orange at hue 0, hot cores paler and a little yellower
  const h0 = 0.04 + S.hue;
  const wash = [0, 0, 0];
  hsv(h0, 0.9, 1, wash);
  const wl = 0.3 * wash[0] + 0.59 * wash[1] + 0.11 * wash[2];
  const lumK = cl(pow(0.62 / wl, 0.5), 0.85, 1.25);
  const laneW = S.laneW, wellCov = S.wellCov, wellRim = S.wellRim;
  for (let y = 0; y < H; y++) {
    // the lamp: brightest near the wells, falling toward the foot, and breathing
    const gy = 1.08 - 0.4 * pow(y / H, 1.2);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const ex = (x - 31.5) / 32;
      const breath = 1 + 0.035 * sin(0.37 * t + 0.07 * y) + 0.03 * sin(0.23 * t - 0.11 * x + 1.3) + 0.02 * sin(0.61 * t + 0.05 * (x + y));
      const lamp = gy * (1 - 0.14 * ex * ex) * breath;
      const l = floor(x / PITCH);
      const lane = S.lanes[l];
      const wc = wellCov[p];
      let v = I[p];
      // a thin smear of stain along a lane that holds DNA, so that the lane reads between its bands
      if (y >= WELL_B) v += 0.03 * lane.occ * laneW[x];
      const a = 1 - exp(-1.9 * v);
      // slab: violet ink, a haze of free stain, the wells dark with a lip of light round them
      const dark = 1 - 0.8 * wc;
      const rim = 1 + 0.5 * wellRim[p];
      const k = lamp * dark * rim;
      let r = SLAB[0] * k, g = SLAB[1] * k, b = SLAB[2] * k;
      const hz = 0.045 * lamp * dark;
      r += wash[0] * lumK * hz;
      g += wash[1] * lumK * hz;
      b += wash[2] * lumK * hz;
      if (a > 0.003) {
        hsv(h0 + 0.02 * a, 0.97 - 0.45 * a * a, 1, pc);
        const sc = lumK * a;
        const keep = 1 - 0.5 * a;
        r = r * keep + pc[0] * sc;
        g = g * keep + pc[1] * sc;
        b = b * keep + pc[2] * sc;
      }
      const m = max(r, g, b);
      if (m > 0.9) {
        const kk = (0.9 + 0.1 * (1 - exp(-(m - 0.9) / 0.1))) / m;
        r *= kk;
        g *= kk;
        b *= kk;
      }
      display.setPixel(x, y, (r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
    }
  }
}
