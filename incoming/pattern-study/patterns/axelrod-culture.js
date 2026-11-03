// ===== Patternflow pattern =====
// Title:   Axelrod Culture
// Family:  sim
// Idea:    A lattice of 16 by 32 villages, 4 by 4 LEDs each, carries three cultural features per village shown as hue, value and saturation; a random village copies a feature from a random neighbour with a probability equal to the share of features they already have in common, so neighbours that are alike grow alike into regions, a dark line stands wherever two neighbours share nothing, and the map runs into one culture or freezes into a mosaic until drift seeds new traits or a fresh lattice rolls in from the top.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Axelrod's model of the dissemination of culture (Robert Axelrod, The Dissemination of Culture, Journal of Conflict Resolution, 1997), its transition in the number of traits (Claudio Castellano, Matteo Marsili and Alessandro Vespignani, 2000) and cultural drift (Konstantin Klemm, Víctor M. Eguíluz, Raúl Toral and Maxi San Miguel, 2003); pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Traits=2..30, Drift=0..1
//
// Knob 1: Hue. Turns the band the first feature's traits take on the wheel. At 0 they fall between green and magenta through cyan, blue and violet, never red; at 0.5 the band runs from violet through red and yellow to green.
// Knob 2: Speed. At 2 the lattice is swept 24 times a second, each sweep 512 tries, one per village on average; 2.4 sweeps a second at 0.2 and 36 at 3. The settled map is held 120 sweeps (5 s at 2) before a new one rolls in over 1.25 s.
// Knob 3: Traits. q, the traits each feature can take, 2 to 30; turning it starts a new lattice. At 2 there are 8 cultures and two random neighbours share a feature 7 times in 8, so the opening speckle merges into patches several villages across within 3 s and, without drift, into one culture after a median 2700 sweeps (two minutes at Speed 2). Without drift on this lattice the largest region ends with 81% of the villages at q = 8, 48% at 10 and 12% at 12, and at 30 the map locks within 80 sweeps into about 410 regions, the transition Castellano, Marsili and Vespignani found.
// Knob 4: Drift. A try also redraws one feature of its village with probability 0.02 times Drift squared, and a village that changes flashes white. At the opening 0.06 that is 0.9 redraws a second at Speed 2, enough to thaw a frozen map: over 14,400 sweeps at q = 10 it lifts the largest region from the 48% the map freezes at to 66%, averaged over six runs. From about 0.2 the new traits come faster than regions can swallow them (largest region 28% at q = 10, 13% at 0.3), and at 1 there are 250 redraws a second.

// The model (Axelrod 1997): every site holds F = 3 features, each one of q
// traits. A try picks a site at random and one of its 2 to 4 neighbours at
// random (the lattice has edges, it does not wrap). If they share k of the
// F features, with 0 < k < F, then with probability k / F the site copies
// one of the features they differ on from the neighbour. Sites that share
// nothing never talk, and neither do sites that share everything, so the
// lattice freezes once every pair of neighbours is one or the other: a map
// of regions, each one culture, whose neighbours share no feature at all.
//
// Colour. The first feature's trait picks a hue in a band half the wheel
// wide, the second the value (0.55 to 1) and nudges the hue up to 0.05 either
// way, the third the saturation (0.3 to 1). Traits are spread by multiples
// of the golden ratio so consecutive traits land far apart at every q. Each
// 4 by 4 block keeps its right column and bottom row for the bond to the
// next site: the site's colour where the two share everything, 80% where
// they share two features, 40% where one, and dark where none, the way
// Axelrod's own figures shade the borders by similarity. The colours and
// lines ease over about 0.1 s so a border sliding along reads as a slide,
// not a flicker.
//
// Drift (Klemm, Eguíluz, Toral and San Miguel 2003) is noise: with rate r a
// try also changes one feature of the chosen site to a random trait. On a
// finite lattice a small r drives the map towards one culture, since a
// frozen border can be bridged by a site that drifts to share a feature with
// both sides; past a rate that falls as the lattice grows the noise wins and
// the map never settles. On these 512 villages that rate is near Drift 0.2.
//
// When at most 12 bonds have stayed active (sharing some features but not
// all) for 120 sweeps, the map counts as settled, and a fresh random lattice
// rolls in from the top over 1.25 s, each village flashing as it lands.

const W = 64, H = 128, LW = 16, LH = 32, N = LW * LH, F = 3;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const PHI = 0.6180339887;

// Sweeps a second at Speed 1, drift scale, settle rule, the wipe in seconds.
const RATE = 12, DRIFT = 0.02, CALM_BONDS = 12, CALM_SWEEPS = 120, WIPE = 1.25;
// Line level for 0, 1, 2 and 3 shared features.
const LINE = [0, 0.4, 0.8, 1];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
}

// Neighbours of each site, up to four, open edges.
const NB = [];
for (let i = 0; i < N; i++) {
  const x = i % LW, y = floor(i / LW), a = [];
  if (x > 0) a.push(i - 1);
  if (x < LW - 1) a.push(i + 1);
  if (y > 0) a.push(i - LW);
  if (y < LH - 1) a.push(i + LW);
  NB.push(a);
}

function randomize(c, q) {
  for (let i = 0; i < N * F; i++) c[i] = floor(Math.random() * q);
}

export function setup(params) {
  params.s = {
    cult: new Uint8Array(N * F),
    next: new Uint8Array(N * F),
    reveal: new Float32Array(N),
    disp: new Float32Array(N * 3),
    line: new Float32Array(N * 2).fill(1),
    flash: new Float32Array(N),
    target: new Float32Array(N * 3),
    q: 2,
    hue: 0,
    speed: 2,
    drift: 0.06,
    acc: 0,
    calm: 0,
    wipe: 0,
    started: false,
    dark: true,
  };
}

// Start a fresh random lattice, revealed from the top down with a little jitter.
function restart(S) {
  randomize(S.next, S.q);
  for (let i = 0; i < N; i++) S.reveal[i] = (0.75 * floor(i / LW)) / LH * WIPE + Math.random() * 0.25 * WIPE;
  S.wipe = 1e-6;
  S.calm = 0;
}

// One try of Axelrod's rule, with drift.
function attempt(S) {
  const c = S.cult, i = floor(Math.random() * N), nb = NB[i], j = nb[floor(Math.random() * nb.length)];
  const a = i * F, b = j * F;
  let k = 0;
  for (let f = 0; f < F; f++) if (c[a + f] === c[b + f]) k++;
  if (k > 0 && k < F && Math.random() * F < k) {
    let pick = floor(Math.random() * (F - k));
    for (let f = 0; f < F; f++)
      if (c[a + f] !== c[b + f]) {
        if (pick === 0) { c[a + f] = c[b + f]; break; }
        pick--;
      }
  }
  if (S.rate > 0 && Math.random() < S.rate) {
    const f = floor(Math.random() * F), t = floor(Math.random() * S.q);
    if (c[a + f] !== t) { c[a + f] = t; S.flash[i] = 1; }
  }
}

// Bonds that share some features but not all.
function active(S) {
  const c = S.cult;
  let n = 0;
  for (let i = 0; i < N; i++)
    for (const j of [i + 1, i + LW]) {
      if ((j === i + 1 && i % LW === LW - 1) || j >= N) continue;
      let k = 0;
      for (let f = 0; f < F; f++) if (c[i * F + f] === c[j * F + f]) k++;
      if (k > 0 && k < F) n++;
    }
  return n;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1] == null ? 2 : kv[1], 0.2, 3);
  const q = round(cl(kv[2] == null ? 2 : kv[2], 2, 30));
  S.drift = cl(kv[3] == null ? 0.06 : kv[3], 0, 1);
  S.rate = DRIFT * S.drift * S.drift;
  if (!S.started || q !== S.q) {
    // A new q starts a new lattice; traits above q would never come back.
    S.q = q;
    S.started = true;
    restart(S);
  }
  const sweeps = d * S.speed * RATE;
  if (S.wipe > 0) {
    S.wipe += d;
    for (let i = 0; i < N; i++)
      if (S.reveal[i] >= 0 && S.wipe >= S.reveal[i]) {
        for (let f = 0; f < F; f++) S.cult[i * F + f] = S.next[i * F + f];
        S.reveal[i] = -1;
        S.flash[i] = 0.6;
      }
    if (S.wipe >= WIPE) { S.wipe = 0; S.dark = false; }
  } else {
    S.acc += sweeps * N;
    let n = min(floor(S.acc), 4 * N);
    S.acc -= floor(S.acc);
    while (n-- > 0) attempt(S);
    if (active(S) <= CALM_BONDS) {
      S.calm += sweeps;
      if (S.calm >= CALM_SWEEPS) restart(S);
    } else S.calm = 0;
  }
  // Ease the shown colours and lines towards the lattice.
  const c = S.cult, tg = S.target, k = 1 - exp(-d / 0.1), fk = exp(-d / 0.35);
  for (let i = 0; i < N; i++) {
    const a = i * F;
    const l1 = (c[a + 1] * PHI + 0.2) % 1;
    const h = S.hue + 0.33 + 0.5 * ((c[a] * PHI + 0.05) % 1) + 0.1 * (l1 - 0.5);
    const v = S.dark && S.reveal[i] >= 0 ? 0 : 0.55 + 0.45 * l1;
    const s = 0.3 + 0.7 * ((c[a + 2] * PHI + 0.6) % 1);
    hsv(h, s, v, tg, i * 3);
    for (let m = 0; m < 3; m++) S.disp[i * 3 + m] += (tg[i * 3 + m] - S.disp[i * 3 + m]) * k;
    for (let e = 0; e < 2; e++) {
      const j = e === 0 ? i + 1 : i + LW;
      let lv = 1;
      if (!(e === 0 && i % LW === LW - 1) && j < N) {
        let sh = 0;
        for (let f = 0; f < F; f++) if (c[a + f] === c[j * F + f]) sh++;
        lv = LINE[sh];
      }
      S.line[i * 2 + e] += (lv - S.line[i * 2 + e]) * k;
    }
    S.flash[i] *= fk;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const D = S.disp, L = S.line, FL = S.flash;
  for (let y = 0; y < H; y++) {
    const sy = y >> 2, ry = y & 3;
    for (let x = 0; x < W; x++) {
      const sx = x >> 2, rx = x & 3, i = sy * LW + sx;
      let lv = 1;
      if (rx === 3 && ry === 3) {
        lv = min(L[i * 2], L[i * 2 + 1]);
        if (sx < LW - 1) lv = min(lv, L[(i + 1) * 2 + 1]);
        if (sy < LH - 1) lv = min(lv, L[(i + LW) * 2]);
      } else if (rx === 3) lv = L[i * 2];
      else if (ry === 3) lv = L[i * 2 + 1];
      const fl = rx < 3 && ry < 3 ? FL[i] : FL[i] * 0.4;
      const r = (D[i * 3] * lv + fl) * 255, g = (D[i * 3 + 1] * lv + fl) * 255, b = (D[i * 3 + 2] * lv + fl) * 255;
      display.setPixel(x, y, min(255, round(r)), min(255, round(g)), min(255, round(b)));
    }
  }
}
