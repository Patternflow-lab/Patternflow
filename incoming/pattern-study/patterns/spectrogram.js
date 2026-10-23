// ===== Patternflow pattern =====
// Title:   Spectrogram
// Family:  data
// Idea:    A live spectrogram of a dawn chorus falls down the panel as a waterfall, frequency across and time downward, with the birds' whistles, trills and chips drawn bright over the speckled roar of wind and a distant road.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the sound spectrograph of Koenig, Dunn and Lacy (Bell Labs, 1946) and the Kay Sona-Graph sonagrams of bird song in field guides; colour maps after Smith and van der Walt's inferno, magma and viridis (2015)
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Map=0..1, Scroll=0.5..4, Birds=0..1, Gain=-1..1
//
// Knob 1: Map. The colour map: inferno at 0 blends into magma and then viridis, and at 1 it is the black ink on white paper of a Sona-Graph.
// Knob 2: Scroll. How fast time falls: at 2 the waterfall moves 24 rows a second and holds five seconds of sound; at 0.5 the songs squeeze into short dashes, at 4 they stretch tall.
// Knob 3: Birds. How far the chorus has woken: at 0 a robin, a cuckoo and a wren; turned up, sparrows, a blackbird, a collared dove, a woodpecker and more join, ten in all.
// Knob 4: Gain. Slides the 50 dB window the map spans: turned down, only the songs show over a black floor; turned up, the wind and the far road flood the panel.
// Buttons: K3 tap claps: a line rings across every frequency, and the birds fall silent for a few seconds before they start again one by one.

const W = 64;
const H = 128;
const N = W * H;
// The frequency axis: constant-Q bins on a log scale from 120 Hz at the left
// edge to 11 kHz at the right.
const F0 = 120;
const F1 = 11000;
const LN = Math.log(F1 / F0);
const xOf = (f) => (W * Math.log(f / F0)) / LN - 0.5;
const fOf = (x) => F0 * Math.exp(((x + 0.5) * LN) / W);

// Colour maps as eleven stops from 0 to 1: inferno, magma and viridis as
// matplotlib has them, and the black-on-white paper of a Sona-Graph.
const MAPS = [
  [[0, 0, 4], [22, 11, 57], [66, 10, 104], [106, 23, 110], [147, 38, 103], [188, 55, 84], [221, 81, 58], [243, 120, 25], [252, 165, 10], [246, 215, 70], [252, 255, 164]],
  [[0, 0, 4], [20, 14, 54], [59, 15, 112], [100, 26, 128], [140, 41, 129], [183, 55, 121], [222, 73, 104], [247, 112, 92], [254, 159, 109], [254, 207, 146], [252, 253, 191]],
  [[68, 1, 84], [72, 36, 117], [65, 68, 135], [53, 95, 141], [42, 120, 142], [33, 145, 140], [34, 168, 132], [68, 191, 112], [122, 209, 81], [189, 223, 38], [253, 231, 37]],
  [[236, 232, 220], [214, 210, 198], [190, 186, 176], [164, 160, 152], [138, 134, 128], [112, 108, 104], [86, 82, 80], [62, 58, 58], [40, 38, 38], [22, 20, 22], [8, 6, 8]],
];

const LUT = 1024;

function lut(k) {
  const m = Math.min(2.999, k * 3);
  const a = MAPS[Math.floor(m)];
  const b = MAPS[Math.floor(m) + 1];
  const u = m - Math.floor(m);
  const out = new Uint8Array(LUT * 3);
  for (let i = 0; i < LUT; i++) {
    const t = (i / (LUT - 1)) * 10;
    const j = Math.min(9, Math.floor(t));
    const f = t - j;
    for (let c = 0; c < 3; c++) {
      const va = a[j][c] + (a[j + 1][c] - a[j][c]) * f;
      const vb = b[j][c] + (b[j + 1][c] - b[j][c]) * f;
      out[i * 3 + c] = Math.round(va + (vb - va) * u);
    }
  }
  return out;
}

function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

const rnd = (a, b) => a + Math.random() * (b - a);

// Songs. Each returns the notes of one phrase from time t: [start, end,
// starting Hz, ending Hz, dB, harmonic dB].
const SONGS = {
  // A robin or a thrush: three to six clear whistles that glide.
  whistle(t, b) {
    const out = [];
    let s = t;
    for (let n = Math.floor(rnd(3, 7)); n > 0; n--) {
      const len = rnd(0.08, 0.22);
      const f = b.f * rnd(0.75, 1.35);
      out.push([s, s + len, f, f * rnd(0.75, 1.3), b.db, -14]);
      s += len + rnd(0.04, 0.1);
    }
    return out;
  },
  // A wren: a fast trill of falling ticks that sinks as it goes.
  trill(t, b) {
    const out = [];
    const n = Math.floor(rnd(12, 26));
    const rate = rnd(14, 20);
    for (let i = 0; i < n; i++) {
      const s = t + i / rate;
      const f = b.f * (1 - (0.15 * i) / n);
      out.push([s, s + 0.035, f * 1.15, f * 0.88, b.db, -18]);
    }
    return out;
  },
  // A sparrow: bursts of chips that each sweep down more than an octave.
  chip(t, b) {
    const out = [];
    for (let n = Math.floor(rnd(3, 8)), s = t; n > 0; n--, s += rnd(0.1, 0.16)) out.push([s, s + rnd(0.025, 0.04), b.f * 2.2, b.f * 0.9, b.db, -20]);
    return out;
  },
  // A cuckoo: the falling third, cu-koo, four to eight times.
  cuckoo(t, b) {
    const out = [];
    for (let n = Math.floor(rnd(4, 9)), s = t; n > 0; n--, s += 1.3) {
      out.push([s, s + 0.22, b.f, b.f * 0.97, b.db, -22]);
      out.push([s + 0.34, s + 0.64, b.f * 0.8, b.f * 0.78, b.db, -22]);
    }
    return out;
  },
  // A collared dove: coo-COO-coo, low and slow.
  dove(t, b) {
    return [
      [t, t + 0.28, b.f, b.f * 0.98, b.db - 4, -16],
      [t + 0.4, t + 0.9, b.f * 1.06, b.f, b.db, -16],
      [t + 1.05, t + 1.35, b.f * 0.96, b.f * 0.94, b.db - 4, -16],
    ];
  },
  // A blackbird: a quick warble of short notes leaping about.
  warble(t, b) {
    const out = [];
    let s = t;
    for (let n = Math.floor(rnd(8, 18)); n > 0; n--) {
      const len = rnd(0.04, 0.1);
      const f = b.f * rnd(0.7, 1.5);
      out.push([s, s + len, f, f * rnd(0.8, 1.25), b.db, -12]);
      s += len + rnd(0.01, 0.04);
    }
    return out;
  },
  // A lesser spotted woodpecker drumming on a dead branch: a roll of knocks,
  // each a click across the band, quickening as it goes.
  drum(t, b) {
    const out = [];
    for (let n = Math.floor(rnd(10, 18)), s = t, g = 0.09; n > 0; n--, s += g, g *= 0.98) out.push([s, s + 0.01, b.f, b.f, b.db, null]);
    return out;
  },
};

// The chorus in the order the birds wake: [song, Hz, dB, seconds between phrases].
const CHORUS = [
  ["whistle", 2800, -30, 3.2], ["cuckoo", 760, -34, 9], ["trill", 5600, -32, 5], ["chip", 3600, -34, 2.2],
  ["warble", 2200, -31, 5], ["dove", 520, -36, 6], ["whistle", 3600, -36, 3.8], ["chip", 4200, -38, 2.8],
  ["trill", 6400, -38, 6], ["drum", 1800, -48, 10],
];

export function setup(params) {
  Object.assign(params, {
    v: new Float32Array(N), head: 0, acc: 0, t: 0, ready: 0,
    re: new Float32Array(W), im: new Float32Array(W),
    birds: CHORUS.map(([song, f, db, gap]) => ({ song, f: f * rnd(0.92, 1.08), db, gap, next: rnd(0, gap), notes: [] })),
    gust: 0, gv: 0, truck: -99, clap: -99, map: -1, lut: null,
  });
}

// One row of the spectrogram: the sound from t over dt seconds, as dB per bin.
function row(S, t, dt, k) {
  const P = new Float32Array(W);
  const busy = 3 + Math.round((k[2] ?? 0) * 7);
  // Wind gusts wander slowly; a truck on the far road swells and fades.
  S.gv += (-S.gust * 0.3 + gauss() * 0.6) * dt;
  S.gust = Math.max(-1, Math.min(1.5, S.gust + S.gv * dt));
  if (t - S.truck > 24 && Math.random() < dt / 12) S.truck = t;
  const tr = Math.max(0, 1 - Math.abs(t - S.truck - 3) / 3);
  for (let x = 0; x < W; x++) {
    const f = fOf(x);
    const o = Math.log2(f / 300);
    const hiss = -74 - 3 * (x / W);
    const road = -62 + 6 * tr - 12 * o * o;
    const wind = -68 + 10 * S.gust - 9 * Math.max(0, Math.log2(f / 200));
    const floor = 10 * Math.log10(10 ** (hiss / 10) + 10 ** (road / 10) + 10 ** (wind / 10));
    // Each bin is the power of a complex value that carries six tenths of
    // itself over to the next row, so the speckle has a grain in time.
    const a = 0.6;
    S.re[x] = a * S.re[x] + Math.sqrt(1 - a * a) * gauss();
    S.im[x] = a * S.im[x] + Math.sqrt(1 - a * a) * gauss();
    P[x] = 10 ** (floor / 10) * (S.re[x] * S.re[x] + S.im[x] * S.im[x]) * 0.5;
  }
  // The birds, sampled four times within the row so a fast chip spreads its
  // sweep across the bins it passes.
  for (let i = 0; i < S.birds.length; i++) {
    const b = S.birds[i];
    if (i < busy && t >= b.next) {
      b.notes = SONGS[b.song](t, b);
      b.next = b.notes[b.notes.length - 1][1] + b.gap * rnd(0.7, 1.4);
    }
    for (const [t0, t1, fa, fb, db, hdb] of b.notes) {
      if (t1 < t || t0 > t + dt) continue;
      if (hdb === null) {
        // A knock lands in the row it starts in and spreads its click over
        // the bins about its middle.
        if (t0 < t) continue;
        const xc = xOf(fa);
        for (let x = 0; x < W; x++) P[x] += 10 ** (db / 10) * Math.exp(-(((x - xc) / 6) ** 2)) * (0.3 + Math.random());
        continue;
      }
      for (let s = 0; s < 4; s++) {
        const ts = t + ((s + 0.5) / 4) * dt;
        if (ts < t0 || ts > t1) continue;
        const u = (ts - t0) / (t1 - t0);
        const env = Math.sin(Math.PI * u) ** 0.5;
        const f = fa * Math.pow(fb / fa, u);
        for (let hm = 1; hm <= 3; hm++) {
          const xf = xOf(f * hm);
          if (xf > W) break;
          const p = 10 ** ((db + (hm > 1 ? hdb * (hm - 1) : 0)) / 10) * env * 0.25;
          for (let x = Math.max(0, Math.floor(xf - 2)); x <= Math.min(W - 1, xf + 2); x++) P[x] += p * Math.exp(-((x - xf) ** 2) / 0.35);
        }
      }
    }
  }
  // A clap rings across every bin and dies away within a third of a second.
  const age = t - S.clap;
  if (age > -dt && age < 0.3) for (let x = 0; x < W; x++) P[x] += 10 ** ((-26 - 120 * Math.max(0, age) - x * 0.08) / 10);
  return P;
}

function push(S, k) {
  const dt = 1 / (12 * (k[1] ?? 2));
  const P = row(S, S.t, dt, k);
  S.t += dt;
  S.head = (S.head + H - 1) % H;
  for (let x = 0; x < W; x++) S.v[S.head * W + x] = 10 * Math.log10(P[x] + 1e-12);
}

export function update(dt, input, params) {
  const S = params;
  dt = Math.min(Math.max(dt || 0, 0), 0.1);
  const k = input.knobValues || [];
  if (!S.ready) {
    // Fill the panel before the first frame, at the knobs' scroll and chorus.
    S.ready = 1;
    for (let i = 0; i < H; i++) push(S, k);
  }
  S.acc += dt * 12 * (k[1] ?? 2);
  while (S.acc >= 1) {
    push(S, k);
    S.acc--;
  }
  if ((input.btnPressed || [])[2]) {
    // Startled, every bird stops mid-phrase and starts again a few seconds on.
    S.clap = S.t;
    for (const b of S.birds) (b.notes = []), (b.next = S.t + rnd(3, 9));
  }
  S.lo = -92 - 14 * (k[3] ?? 0.06);
  if (S.map !== (k[0] ?? 0)) {
    S.map = k[0] ?? 0;
    S.lut = lut(S.map);
  }
}

export function draw(display, params) {
  const S = params;
  if (!S.lut) return;
  // Gain slides the 50 dB window the colour map spans.
  const g = (LUT - 1) / 50;
  for (let y = 0; y < H; y++) {
    const r = ((S.head + y) % H) * W;
    for (let x = 0; x < W; x++) {
      const i = Math.round(Math.max(0, Math.min(LUT - 1, (S.v[r + x] - S.lo) * g))) * 3;
      display.setPixel(x, y, S.lut[i], S.lut[i + 1], S.lut[i + 2]);
    }
  }
}
