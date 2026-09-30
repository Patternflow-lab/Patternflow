"use client";

/* eslint-disable react-hooks/immutability --
   Three.js objects are imperative; per-frame mutation is their API and never
   feeds back into React rendering. */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";
import { getSim, useGuideStore } from "../store";
import { stepOf } from "../scenes";
import { LED_CENTER_WORLD } from "./geometry";

// World-space effects around the whole device, one draw call each:
//
//   stream — the Basics deck arriving over Wi-Fi: a sheaf of pixel ribbons
//            leaves from behind the copy card, fans out and writes short
//            scanlines onto the panel, a band of rows per ribbon.
//   wifi   — the device on the network: arcs rising off its top edge, and a
//            pulse running from it towards the browser in the card.
//   flash  — one ripple across the panel when the pack goes in.
//
// All three add light and nothing else: see `lightOnly`. Each hides itself
// entirely while faded out, and prefers-reduced-motion slows the stream to a
// drift, stands the arcs still and turns the ripple into a plain glow.

// The LED face, measured off the model (world units): 1.6 × 3.2, portrait,
// so the landscape 128 × 64 panel stands 64 LEDs across and 128 down.
const LED_W = 1.6;
const LED_H = 3.2;
const LED_X0 = LED_CENTER_WORLD.x - LED_W / 2;
const LED_Y1 = LED_CENTER_WORLD.y + LED_H / 2;
const LED_Z = 0.15;
const GRID_ACROSS = PANEL_H;
const GRID_DOWN = PANEL_W;
const PITCH = LED_W / GRID_ACROSS; // 0.025 — square LEDs
const DEVICE_TOP = 1.6;

/**
 * Adds colour and leaves alpha alone. The canvas is transparent over the
 * page's own glow, and three's AdditiveBlending adds alpha too — a dark part
 * of an effect then paints the canvas opaque black over the page.
 */
function lightOnly<M extends THREE.Material>(m: M): M {
  m.transparent = true;
  m.depthWrite = false;
  m.toneMapped = false;
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneFactor;
  m.blendEquationAlpha = THREE.AddEquation;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}

/** Cheap integer hash → [0, 1). */
function hash(a: number, b: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Screen x (NDC) of a world point, given a view-projection matrix's elements. */
const ndcX = (vp: ArrayLike<number>, x: number, y: number, z: number) =>
  (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / (vp[3] * x + vp[7] * y + vp[11] * z + vp[15]);
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ── stream ───────────────────────────────────────────────────────────────────

// The Basics palette: LED oranges and reds, cyans, and two whites.
const PALETTE = ["#ff6a3d", "#ff3b2f", "#ffab40", "#38d6ff", "#fff1de", "#e6f6ff", "#ff8a4c"].map((h) => new THREE.Color(h));
// Two colours per ribbon, top ribbon first, warm and cool taking turns.
const RIBBON_COLOURS: [number, number][] = [
  [0, 2],
  [3, 5],
  [1, 0],
  [4, 2],
  [3, 5],
  [6, 1],
];

const RIBBONS = RIBBON_COLOURS.length;
const PACKETS = 12; // per ribbon
const PER = 7; // pixels per packet: one short scanline
const N = RIBBONS * PACKETS * PER; // 504
const TRAIL = 0.0075; // path time between the pixels of a packet
const LAND = 0.84; // share of a packet's life in flight; the rest lit on the panel

// On a wide screen the copy card is `min(440px, 40vw)` wide inside a 6vw
// right gutter (Guide.module.css .step / .card). Its left edge, in NDC, is
// where the stream comes out from behind it and the Wi-Fi pulse goes in.
function cardLeftNdc(width: number): number {
  return ((width * 0.94 - Math.min(440, width * 0.4)) / width) * 2 - 1;
}

// Where the sheaf leaves from, in screen terms (NDC) so it stays behind the
// copy card at any window size, carried out onto a plane in front of the
// device. Wide: a third of the way into the card, below its middle. Narrow:
// behind the card at the bottom, under the panel, so the sheaf rises up the
// dark face instead of crossing the white case.
function mouthWideX(width: number): number {
  const cardNdc = (Math.min(440, width * 0.4) / width) * 2;
  return cardLeftNdc(width) + cardNdc * 0.33;
}
const MOUTH_WIDE_Y = -0.24;
const MOUTH_NARROW_Y = -0.72;
const MOUTH_Z = 0.5;

function buildStream() {
  const rand = seeded(20260930);
  const rib = {
    /** Offset of the ribbon's start from the mouth, wide / narrow. */
    offW: new Float32Array(RIBBONS * 3),
    offN: new Float32Array(RIBBONS * 3),
    /** How far the ribbon bows out on its way, wide (in y) / narrow (in x). */
    bowW: new Float32Array(RIBBONS),
    bowN: new Float32Array(RIBBONS),
    lift: new Float32Array(RIBBONS * 2), // towards the reader at the two controls
    bandMid: new Float32Array(RIBBONS),
    band0: new Float32Array(RIBBONS),
    bandRows: new Float32Array(RIBBONS),
    speed: new Float32Array(RIBBONS),
  };
  const rows = GRID_DOWN / RIBBONS;
  for (let r = 0; r < RIBBONS; r++) {
    const v = r / (RIBBONS - 1); // 0 = top ribbon
    rib.offW.set([rand() * 0.25, lerp(0.3, -0.3, v) + (rand() - 0.5) * 0.08, rand() * 0.3 - 0.15], r * 3);
    rib.offN.set([lerp(-0.45, 0.45, (r * 2) % RIBBONS / (RIBBONS - 1)) + (rand() - 0.5) * 0.08, rand() * 0.2, rand() * 0.3 - 0.15], r * 3);
    // Top ribbons arc over, bottom ones swing under; on a narrow screen they
    // rise from below like a fountain, bowing out to either side.
    rib.bowW[r] = lerp(1.45, -1.3, v) + (rand() - 0.5) * 0.15;
    rib.bowN[r] = (r % 2 === 0 ? 1 : -1) * lerp(0.55, 0.2, v) + (rand() - 0.5) * 0.1;
    rib.lift.set([0.55 + rand() * 0.35, 1.0 + rand() * 0.45], r * 2);
    rib.band0[r] = Math.round(r * rows);
    rib.bandRows[r] = Math.max(1, Math.round((r + 1) * rows) - rib.band0[r]);
    rib.bandMid[r] = LED_Y1 - (rib.band0[r] + rib.bandRows[r] / 2) * PITCH;
    rib.speed[r] = 0.27 + rand() * 0.06;
  }

  const P = RIBBONS * PACKETS;
  const pkt = {
    phase: new Float32Array(P),
    jit: new Float32Array(P * 3),
    cycle: new Int32Array(P).fill(-1 << 30),
    row: new Float32Array(P),
    col: new Float32Array(P),
    rgb: new Float32Array(P * 3),
  };
  for (let r = 0; r < RIBBONS; r++) {
    for (let p = 0; p < PACKETS; p++) {
      const i = r * PACKETS + p;
      pkt.phase[i] = p / PACKETS + rand() * 0.02 + r * 0.137;
      pkt.jit.set([(rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12], i * 3);
    }
  }

  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = lightOnly(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 2;
  return { mesh, geo, mat, rib, pkt };
}

// ── wifi ─────────────────────────────────────────────────────────────────────

const PULSES = 3;
const PULSE_PTS = 9;
// Where the arcs start: the top edge, a little towards the knob column.
const WIFI_ORIGIN = new THREE.Vector2(0.28, DEVICE_TOP + 0.05);
// The pulse runs from there over to the browser in the card on the right.
const PULSE_CTRL = new THREE.Vector2(2.0, 2.75);
const PULSE_END = new THREE.Vector2(3.9, 0.6);

const worldVert = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const wifiFrag = /* glsl */ `
uniform float uTime;
uniform float uFade;
uniform float uCalm;
uniform float uPulse;
uniform float uMaxR;
uniform vec2 uOrigin;
uniform vec3 uColor;
uniform vec3 uHot;
uniform vec3 uPts[${PULSES * PULSE_PTS}];
varying vec2 vWorld;

void main() {
  vec2 p = vWorld - uOrigin;
  float r = length(p);
  float ang = atan(p.x, p.y); // 0 = straight up
  float wedge = smoothstep(0.95, 0.55, abs(ang)) * step(0.0, p.y);

  float arcs = 0.0;
  float haze = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ph = fract(uTime * 0.34 + fi * 0.25);
    float life = smoothstep(0.0, 0.14, ph) * pow(1.0 - ph, 1.3);
    // Reduced motion: four arcs standing still, fainter outwards.
    ph = mix(ph, 0.16 + fi * 0.22, uCalm);
    life = mix(life, 0.62 - fi * 0.12, uCalm);
    float R = mix(0.1, uMaxR, ph);
    float d = abs(r - R);
    float w = 0.011 + 0.009 * ph;
    arcs += (1.0 - smoothstep(w * 0.35, w, d)) * life;
    haze += exp(-d * d / 0.005) * life;
  }
  float lit = (arcs + haze * 0.14) * wedge;
  float core = exp(-r * r / 0.0009) * 0.9 + exp(-r * r / 0.025) * 0.1;
  vec3 col = uColor * (lit * 2.3 + core * 2.2);

  // The pulse: a packet of square pixels, like the stream's, hopping along.
  float pul = 0.0;
  for (int k = 0; k < ${PULSES * PULSE_PTS}; k++) {
    vec3 a = uPts[k];
    vec2 dd = abs(vWorld - a.xy);
    float sq = max(dd.x, dd.y);
    float d2 = dot(dd, dd);
    pul += a.z * ((1.0 - smoothstep(0.014, 0.019, sq)) + 0.22 * exp(-d2 / 0.0025));
  }
  col += mix(uColor, uHot, 0.4) * pul * uPulse * 2.2;

  gl_FragColor = vec4(col * uFade, 0.0);
}
`;

function buildWifi() {
  // Covers the arcs above the device and the pulse's path to the right.
  const x0 = -1.3;
  const x1 = 4.3;
  const y0 = 0.3;
  const y1 = 3.1;
  const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  const pts = Array.from({ length: PULSES * PULSE_PTS }, () => new THREE.Vector3());
  const mat = lightOnly(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 0 },
        uCalm: { value: 0 },
        uPulse: { value: 1 },
        uMaxR: { value: 0.95 },
        uOrigin: { value: WIFI_ORIGIN.clone() },
        uColor: { value: new THREE.Color("#ff6a3d") },
        uHot: { value: new THREE.Color("#ffd2b8") },
        uPts: { value: pts },
      },
      vertexShader: worldVert,
      fragmentShader: wifiFrag,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 2;
  return { mesh, geo, mat, pts };
}

// ── flash ────────────────────────────────────────────────────────────────────

const flashVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// A ring of LEDs running out from the middle of the face, over a glow that
// comes up and dies away inside 0.6 s.
const flashFrag = /* glsl */ `
uniform float uT;
uniform float uCalm;
uniform vec3 uWarm;
varying vec2 vUv;
void main() {
  vec2 grid = vec2(${GRID_ACROSS.toFixed(1)}, ${GRID_DOWN.toFixed(1)});
  vec2 g = vUv * grid;
  vec2 c = (floor(g) + 0.5) / grid;
  // Distance from the middle, in panel widths: the face is twice as tall.
  vec2 q = (c - 0.5) * vec2(1.0, 2.0);
  float d = length(q);
  float R = uT * 2.0;
  float ring = exp(-pow((d - R) / 0.085, 2.0)) * (1.0 - smoothstep(0.3, 0.62, uT)) * (1.0 - uCalm);
  float behind = step(d, R) * exp(-uT * 6.0) * (1.0 - uCalm);
  float wash = smoothstep(0.0, 0.06, uT) * exp(-uT * mix(5.0, 3.2, uCalm)) * mix(1.0, 0.55, uCalm);
  vec2 local = fract(g) - 0.5;
  float dotm = smoothstep(0.5, 0.3, length(local));
  dotm = mix(dotm, 0.65, smoothstep(0.35, 0.9, fwidth(g.x)));
  vec3 col = mix(uWarm, vec3(1.0, 0.96, 0.9), clamp(ring, 0.0, 1.0) * 0.7);
  float a = ring * 1.5 + behind * 0.35 + wash * 0.5;
  gl_FragColor = vec4(col * a * dotm, 0.0);
}
`;

function buildFlash() {
  const geo = new THREE.PlaneGeometry(LED_W, LED_H);
  const mat = lightOnly(
    new THREE.ShaderMaterial({
      uniforms: { uT: { value: 10 }, uCalm: { value: 0 }, uWarm: { value: new THREE.Color("#ff8a52") } },
      vertexShader: flashVert,
      fragmentShader: flashFrag,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(LED_CENTER_WORLD.x, LED_CENTER_WORLD.y, LED_Z + 0.006);
  mesh.visible = false;
  mesh.renderOrder = 3;
  return { mesh, geo, mat };
}

// ── the component ────────────────────────────────────────────────────────────

export default function Fx() {
  const stream = useMemo(() => buildStream(), []);
  const wifi = useMemo(() => buildWifi(), []);
  const flash = useMemo(() => buildFlash(), []);

  useEffect(
    () => () => {
      for (const fx of [stream, wifi, flash]) {
        fx.geo.dispose();
        fx.mat.dispose();
      }
      stream.mesh.dispose();
    },
    [stream, wifi, flash],
  );

  const calm = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => {
      calm.current = mq.matches;
    };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const st = useRef({
    clock: 0,
    flow: 0,
    age: 0,
    stream: 0,
    density: 0.6,
    rate: 1,
    narrow: 0,
    wifi: 0,
    pulse: 1,
    scene: "",
    step: -1,
    watch: 0,
    pack: "",
    flashT: 10,
  });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), vp: new THREE.Matrix4() }), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { scene, step, narrow } = useGuideStore.getState();
    const s = stepOf(scene, step);
    const o = st.current;
    const reduced = calm.current;
    o.age += dt;
    o.clock += dt * (reduced ? 0.2 : 1);
    o.narrow += ((narrow ? 1 : 0) - o.narrow) * Math.min(1, dt * 3);
    const cam = state.camera;
    const vp = tmp.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements;
    const edge = cardLeftNdc(state.size.width);
    const wideCard = 1 - o.narrow;

    // ── install complete: read the board's pack for a few frames after each
    // step edge (the Director applies the step's pack in the same frame,
    // perhaps after this runs).
    if (scene !== o.scene || step !== o.step) {
      o.scene = scene;
      o.step = step;
      o.watch = 3;
    }
    if (o.watch > 0) {
      o.watch--;
      const pack = getSim().snapshot().pack;
      // Not in the first moments of a load that lands mid-page.
      if (pack === "basics" && o.pack === "origin" && o.age > 0.6) o.flashT = 0;
      o.pack = pack;
    }
    o.flashT += dt;
    flash.mat.uniforms.uT.value = o.flashT;
    flash.mat.uniforms.uCalm.value = reduced ? 1 : 0;
    flash.mesh.visible = o.flashT < 1.2;

    // ── stream ────────────────────────────────────────────────────────────
    o.stream += ((s.stream ? 1 : 0) - o.stream) * Math.min(1, dt * 2.4);
    // The deck step trickles; "Install to my board" pours, a little faster.
    const install = s.stream && step >= 2;
    o.density += ((install ? 1 : 0.6) * (reduced ? 0.5 : 1) - o.density) * Math.min(1, dt * 2);
    o.rate += ((install ? 1.2 : 1) - o.rate) * Math.min(1, dt * 2);
    o.flow += dt * o.rate * (reduced ? 0.2 : 1);
    const fade = o.stream;
    stream.mesh.visible = fade > 0.003;
    if (stream.mesh.visible) {
      const { rib, pkt } = stream;
      const nf = o.narrow;
      // The mouth: a point on screen, carried out onto a plane in world.
      const v = tmp.v
        .set(mouthWideX(state.size.width), lerp(MOUTH_WIDE_Y, MOUTH_NARROW_Y, nf), 0.5)
        .unproject(cam);
      v.sub(cam.position);
      const k = (MOUTH_Z - cam.position.z) / (Math.abs(v.z) > 1e-5 ? v.z : -1e-5);
      const mx = lerp(cam.position.x + v.x * k, LED_CENTER_WORLD.x + 0.2, nf);
      const my = cam.position.y + v.y * k;
      const mz = MOUTH_Z;

      const m = stream.mesh.instanceMatrix.array as Float32Array;
      const cArr = stream.mesh.instanceColor!.array as Float32Array;
      // Billboard basis from the camera: every pixel faces the reader.
      const e = cam.matrixWorld.elements;
      const ez = LED_Z + 0.012;
      for (let r = 0; r < RIBBONS; r++) {
        const r3 = r * 3;
        const sx = mx + lerp(rib.offW[r3], rib.offN[r3], nf);
        const sy = my + lerp(rib.offW[r3 + 1], rib.offN[r3 + 1], nf);
        const sz = mz + lerp(rib.offW[r3 + 2], rib.offN[r3 + 2], nf);
        const dx = LED_CENTER_WORLD.x - sx;
        const dy = rib.bandMid[r] - sy;
        const dz = LED_Z - sz;
        const bowX = rib.bowN[r] * nf;
        const bowY = rib.bowW[r] * (1 - nf);
        const ax = sx + dx * 0.3 + bowX;
        const ay = sy + dy * 0.3 + bowY;
        const az = sz + dz * 0.3 + rib.lift[r * 2];
        const bx = sx + dx * 0.72 + bowX * 0.55;
        const by = sy + dy * 0.72 + bowY * 0.55;
        const bz = sz + dz * 0.72 + rib.lift[r * 2 + 1];
        for (let p = 0; p < PACKETS; p++) {
          const pi = r * PACKETS + p;
          const run = o.flow * rib.speed[r] + pkt.phase[pi];
          const cycle = Math.floor(run);
          if (cycle !== pkt.cycle[pi]) {
            // A new packet: a fresh scanline in this ribbon's band, a colour.
            pkt.cycle[pi] = cycle;
            pkt.row[pi] = rib.band0[r] + Math.floor(hash(pi, cycle) * rib.bandRows[r]);
            pkt.col[pi] = Math.floor(hash(pi + 977, cycle) * (GRID_ACROSS - PER));
            const pair = RIBBON_COLOURS[r];
            const c = PALETTE[hash(pi + 31, cycle) < 0.68 ? pair[0] : pair[1]];
            pkt.rgb[pi * 3] = c.r;
            pkt.rgb[pi * 3 + 1] = c.g;
            pkt.rgb[pi * 3 + 2] = c.b;
          }
          // Packets past the density hide — whole packets, never half of one.
          const dens = Math.min(1, Math.max(0, o.density * PACKETS - p));
          // Stretch the cycle so the packet's last pixel finishes too.
          const tau = (run - cycle) * (1 + PER * TRAIL);
          const jx = pkt.jit[pi * 3];
          const jy = pkt.jit[pi * 3 + 1];
          const jz = pkt.jit[pi * 3 + 2];
          const ex0 = LED_X0 + (pkt.col[pi] + 0.5) * PITCH;
          const ey = LED_Y1 - (pkt.row[pi] + 0.5) * PITCH;
          for (let q = 0; q < PER; q++) {
            const idx = pi * PER + q;
            const u = tau - q * TRAIL;
            let bright = 0;
            let x = 0;
            let y = 0;
            let z = 0;
            let size = 0;
            if (u > 0 && u < 1 && dens > 0) {
              const ex = ex0 + q * PITCH;
              if (u < LAND) {
                const f = u / LAND;
                const t = f * (0.6 + 0.4 * f); // gathering speed into the panel
                const it = 1 - t;
                const b0 = it * it * it;
                const b1 = 3 * it * it * t;
                const b2 = 3 * it * t * t;
                const b3 = t * t * t;
                x = b0 * (sx + jx) + b1 * (ax + jx * 0.7) + b2 * (bx + jx * 0.3) + b3 * ex;
                y = b0 * (sy + jy) + b1 * (ay + jy * 0.7) + b2 * (by + jy * 0.3) + b3 * ey;
                z = b0 * (sz + jz) + b1 * (az + jz * 0.7) + b2 * (bz + jz * 0.3) + b3 * ez;
                // A dim glow while still behind the card, brightest mid-air.
                const behind = smooth(edge - 0.05, edge + 0.03, ndcX(vp, x, y, z)) * wideCard;
                bright = smooth(0.02, 0.2, f) * (1 - behind * 0.82) * (1 - q * 0.075) * lerp(2.3, 1.6, smooth(0.75, 1, f));
                size = lerp(0.036, 0.024, q / (PER - 1)) * lerp(1, 0.8, smooth(0.8, 1, f));
              } else {
                // Landed: an LED lit for a moment.
                const g = (u - LAND) / (1 - LAND);
                x = ex;
                y = ey;
                z = ez;
                bright = 1.5 * (1 - g) * (1 - g);
                size = PITCH * 0.82;
              }
              bright *= fade * dens;
            }
            if (bright <= 0.001) size = 0;
            // Column-major 4×4: right·s, up·s, back·s, position.
            const i16 = idx * 16;
            m[i16] = e[0] * size;
            m[i16 + 1] = e[1] * size;
            m[i16 + 2] = e[2] * size;
            m[i16 + 3] = 0;
            m[i16 + 4] = e[4] * size;
            m[i16 + 5] = e[5] * size;
            m[i16 + 6] = e[6] * size;
            m[i16 + 7] = 0;
            m[i16 + 8] = e[8] * size;
            m[i16 + 9] = e[9] * size;
            m[i16 + 10] = e[10] * size;
            m[i16 + 11] = 0;
            m[i16 + 12] = x;
            m[i16 + 13] = y;
            m[i16 + 14] = z;
            m[i16 + 15] = 1;
            cArr[idx * 3] = pkt.rgb[pi * 3] * bright;
            cArr[idx * 3 + 1] = pkt.rgb[pi * 3 + 1] * bright;
            cArr[idx * 3 + 2] = pkt.rgb[pi * 3 + 2] * bright;
          }
        }
      }
      stream.mesh.instanceMatrix.needsUpdate = true;
      stream.mesh.instanceColor!.needsUpdate = true;
    }

    // ── wifi ──────────────────────────────────────────────────────────────
    o.wifi += ((s.wifi === "device" ? 1 : 0) - o.wifi) * Math.min(1, dt * 2.4);
    wifi.mesh.visible = o.wifi > 0.003;
    if (wifi.mesh.visible) {
      const t = o.clock;
      const wu = wifi.mat.uniforms;
      wu.uTime.value = t;
      wu.uFade.value = o.wifi;
      wu.uCalm.value = reduced ? 1 : 0;
      // A narrow screen has the card below, not beside: no pulse over to it,
      // and less room above the device.
      o.pulse += ((narrow || reduced ? 0 : 1) - o.pulse) * Math.min(1, dt * 3);
      wu.uPulse.value = o.pulse;
      // Smaller when the camera is closer, so the arcs stay clear of the top bar.
      const near = Math.min(1.05, Math.max(0.72, cam.position.length() / 15));
      wu.uMaxR.value = 0.95 * near * lerp(1, 0.55, o.narrow);
      if (o.pulse > 0.003) {
        for (let k = 0; k < PULSES; k++) {
          const head = ((t * 0.32 + k / PULSES) % 1) * 1.35;
          for (let j = 0; j < PULSE_PTS; j++) {
            const pt = wifi.pts[k * PULSE_PTS + j];
            const a = head - j * 0.022;
            if (a <= 0 || a >= 1) {
              pt.z = 0;
              continue;
            }
            const ia = 1 - a;
            pt.x = ia * ia * WIFI_ORIGIN.x + 2 * ia * a * PULSE_CTRL.x + a * a * PULSE_END.x;
            pt.y = ia * ia * WIFI_ORIGIN.y + 2 * ia * a * PULSE_CTRL.y + a * a * PULSE_END.y;
            // Out of the arcs, over to the card, gone at its edge.
            const gone = smooth(edge - 0.07, edge + 0.01, ndcX(vp, pt.x, pt.y, 0)) * wideCard;
            pt.z = smooth(0.04, 0.16, a) * (1 - smooth(0.9, 1, a)) * (1 - gone) * (1 - (j / PULSE_PTS) * 0.8);
          }
        }
      }
    }
  });

  return (
    <group>
      <primitive object={stream.mesh} />
      <primitive object={wifi.mesh} />
      <primitive object={flash.mesh} />
    </group>
  );
}
