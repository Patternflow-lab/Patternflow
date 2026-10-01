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
import { LED_CENTER_WORLD, modelToWorld } from "./geometry";
import { stageAccent } from "./look/accent";
import { DEVKIT_SEAT } from "./parts";

// World-space effects around the whole device, one draw call each:
//
//   stream — the Basics deck arriving over Wi-Fi: a sheaf of pixel ribbons
//            leaves from behind the copy card, swings round the device's
//            right side and goes in behind it, where the ESP32 sits. The case
//            hides the last of each ribbon (the stream is depth-tested), so
//            it reads as data going into the board — nothing crosses the
//            panel or the front of the case.
//   wifi   — the device on the network: arcs rising off its top edge, and a
//            pulse running from it towards the browser in the card along a
//            faint dotted path, so a still frame shows a link, not loose dashes.
//   flash  — one ripple across the panel when the pack goes in.
//
// All three add light and nothing else: see `lightOnly`. Each hides itself
// entirely while faded out, and prefers-reduced-motion slows the stream to a
// drift, stands the arcs still and turns the ripple into a plain glow.
//
// The stream and the Wi-Fi are the page's signs, so they are drawn in the
// page's accent (look/accent.ts) — the panel's colour, as the card's lit edge
// is — and flat: a full colour and no more, under what the bloom takes, the
// same arcs as the DevKit's in chapter one. And they stop short of the copy
// card: the canvas is behind the page, the card is glass, and coloured
// pixels ran under its text.

// The LED face, measured off the model (world units): 1.6 × 3.2, portrait,
// so the landscape 128 × 64 panel stands 64 LEDs across and 128 down.
const LED_W = 1.6;
const LED_H = 3.2;
const LED_Z = 0.15;
const GRID_ACROSS = PANEL_H;
const GRID_DOWN = PANEL_W;
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
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** The copy card on screen, px of the canvas (x right, y down); `on` false when there is none to keep clear of. */
type CardRect = { on: boolean; l: number; t: number; r: number; b: number };
/** How far outside the card the drawn light is all there, px: nearer than that it fades, and it is gone a little before the card's edge. */
const CARD_CLEAR = 64;
const CARD_GONE = 10;

/**
 * 0 at the card (and for CARD_GONE px round it) … 1 well clear of it, for a
 * world point; `vp` is the view-projection matrix's elements, `hw`/`hh` half
 * the canvas's size in px.
 */
function clearOfCard(card: CardRect, vp: ArrayLike<number>, hw: number, hh: number, x: number, y: number, z: number) {
  if (!card.on) return 1;
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (w <= 1e-5) return 1;
  const sx = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w + 1) * hw;
  const sy = (1 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * hh;
  const dx = Math.max(card.l - sx, sx - card.r, 0);
  const dy = Math.max(card.t - sy, sy - card.b, 0);
  return smooth(CARD_GONE, CARD_CLEAR, Math.hypot(dx, dy));
}

// ── stream ───────────────────────────────────────────────────────────────────

// The stream's colours: the accent, the accent paled half-way to white, and
// two whites — made each frame from the page's accent (look/accent.ts), so a
// packet in flight turns with the page.
const WHITES = ["#fff1de", "#e6f6ff"].map((h) => new THREE.Color(h));
/** [accent, pale accent, warm white, cool white] */
const PALETTE = [new THREE.Color(), new THREE.Color(), WHITES[0], WHITES[1]];
// Two colours per ribbon, top ribbon first.
const RIBBON_COLOURS: [number, number][] = [
  [0, 1],
  [1, 3],
  [0, 0],
  [2, 1],
  [1, 3],
  [0, 1],
];
/** A full colour and no more: what the bloom takes starts above this (look/StagePost). */
const STREAM_PEAK = 1.02;

const RIBBONS = RIBBON_COLOURS.length;
const PACKETS = 12; // per ribbon
const PER = 7; // pixels per packet: one short scanline
const N = RIBBONS * PACKETS * PER; // 504
const TRAIL = 0.0075; // path time between the pixels of a packet

// Where the ribbons go in: the ESP32 on its sockets behind the board.
const SEAT = modelToWorld(DEVKIT_SEAT.position);
/** Each ribbon's last control point: right of the case and behind its back
 *  (the case spans x −1.25…1.22, z −0.19…0.16), so the final stretch runs in
 *  from behind where the case covers it. */
const BEHIND = { x: 1.62, z: -0.62 };
const END_Z = SEAT.z - 0.04;
/** The DevKit's height on the board (it is 63 mm long): the ribbons spread over it. */
const END_SPREAD = 0.46;

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
/** On a narrow screen the sheaf rises from behind the card on the right, up the device's right side. */
const MOUTH_NARROW_X = 1.5;

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
    /** Where on the DevKit the ribbon ends, in y. */
    endY: new Float32Array(RIBBONS),
    speed: new Float32Array(RIBBONS),
  };
  for (let r = 0; r < RIBBONS; r++) {
    const v = r / (RIBBONS - 1); // 0 = top ribbon
    rib.offW.set([rand() * 0.25, lerp(0.3, -0.3, v) + (rand() - 0.5) * 0.08, rand() * 0.3 - 0.15], r * 3);
    rib.offN.set([lerp(-0.45, 0.45, (r * 2) % RIBBONS / (RIBBONS - 1)) + (rand() - 0.5) * 0.08, rand() * 0.2, rand() * 0.3 - 0.15], r * 3);
    // Top ribbons arc over, bottom ones swing under; on a narrow screen they
    // rise from below, bowing out to the right, away from the device.
    rib.bowW[r] = lerp(0.9, -0.8, v) + (rand() - 0.5) * 0.12;
    rib.bowN[r] = lerp(0.25, 0.6, (r * 2) % RIBBONS / (RIBBONS - 1)) + (rand() - 0.5) * 0.08;
    rib.lift.set([0.2 + rand() * 0.2, 0], r * 2);
    rib.endY[r] = SEAT.y + lerp(END_SPREAD / 2, -END_SPREAD / 2, v);
    rib.speed[r] = 0.3 + rand() * 0.06;
  }

  const P = RIBBONS * PACKETS;
  const pkt = {
    phase: new Float32Array(P),
    jit: new Float32Array(P * 3),
    cycle: new Int32Array(P).fill(-1 << 30),
    /** Which of the palette's colours the packet is. */
    colour: new Uint8Array(P),
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
/** The faint dotted path the pulses run along. */
const PATH_PTS = 24;
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
uniform vec3 uPath[${PATH_PTS}];
varying vec2 vWorld;

void main() {
  vec2 p = vWorld - uOrigin;
  float r = length(p);
  float ang = atan(p.x, p.y); // 0 = straight up
  float wedge = smoothstep(0.95, 0.55, abs(ang)) * step(0.0, p.y);

  float arcs = 0.0;
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
  }
  // Flat: a line of the accent at its own strength, no halo, and never more
  // than a full colour — over that it blooms, and these arcs glowed red here
  // while the DevKit's, in chapter one, were plain.
  float lit = arcs * wedge;
  float core = exp(-r * r / 0.0009);
  vec3 col = uColor * min(lit * 1.25 + core, 1.0);

  // The pulse: a packet of square pixels, like the stream's, hopping along.
  float pul = 0.0;
  for (int k = 0; k < ${PULSES * PULSE_PTS}; k++) {
    vec3 a = uPts[k];
    vec2 dd = abs(vWorld - a.xy);
    pul += a.z * (1.0 - smoothstep(0.014, 0.019, max(dd.x, dd.y)));
  }
  col += uHot * min(pul * 1.6, 1.0) * uPulse;

  // The path itself, a row of small dim pixels.
  float path = 0.0;
  for (int k = 0; k < ${PATH_PTS}; k++) {
    vec3 a = uPath[k];
    vec2 dd = abs(vWorld - a.xy);
    path += a.z * (1.0 - smoothstep(0.007, 0.011, max(dd.x, dd.y)));
  }
  col += uColor * path * uPulse;

  gl_FragColor = vec4(min(col, vec3(1.0)) * uFade, 0.0);
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
  const path = Array.from({ length: PATH_PTS }, () => new THREE.Vector3());
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
        uPath: { value: path },
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
  return { mesh, geo, mat, pts, path };
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
  // The step's card, measured now and then while something is drawn that must keep clear of it.
  const card = useRef<CardRect & { age: number; key: string }>({ on: false, l: 0, t: 0, r: 0, b: 0, age: 0, key: "" });

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
    const hw = state.size.width / 2;
    const hh = state.size.height / 2;

    // The page's accent: the arcs and their path in it, the pulse a shade
    // paler, the stream in both and white.
    const accent = stageAccent();
    PALETTE[0].copy(accent);
    PALETTE[1].copy(accent).lerp(WHITES[0], 0.5);
    wifi.mat.uniforms.uColor.value.copy(accent);
    wifi.mat.uniforms.uHot.value.copy(accent).lerp(WHITES[0], 0.4);

    // Where the step's card is (its block's one child — GuideCanvas's
    // freeArea reads it the same way). Measured every few frames, and at once
    // on a new step: the page scrolls over the stage, and the card with it.
    const cd = card.current;
    if (s.stream || s.wifi === "device" || o.stream > 0.003 || o.wifi > 0.003) {
      const key = scene + "." + step;
      if (key !== cd.key || ++cd.age > 5) {
        cd.key = key;
        cd.age = 0;
        const art = document.querySelector<HTMLElement>('[data-scene="' + scene + '"] [data-step="' + step + '"]');
        const el = art && art.children.length === 1 ? (art.firstElementChild as HTMLElement) : art;
        const box = el?.getBoundingClientRect();
        const cv = state.gl.domElement.getBoundingClientRect();
        if (box && box.width > 0 && cv.width > 0) {
          const kx = state.size.width / cv.width;
          const ky = state.size.height / cv.height;
          cd.on = true;
          cd.l = (box.left - cv.left) * kx;
          cd.r = (box.right - cv.left) * kx;
          cd.t = (box.top - cv.top) * ky;
          cd.b = (box.bottom - cv.top) * ky;
        } else {
          cd.on = false;
        }
      }
    } else {
      cd.key = "";
    }

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
    // In gently; out quickly, so it never runs on into the next step.
    o.stream += ((s.stream ? 1 : 0) - o.stream) * Math.min(1, dt * (s.stream ? 2.4 : 6));
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
      const mx = lerp(cam.position.x + v.x * k, MOUTH_NARROW_X, nf);
      const my = cam.position.y + v.y * k;
      const mz = MOUTH_Z;

      const m = stream.mesh.instanceMatrix.array as Float32Array;
      const cArr = stream.mesh.instanceColor!.array as Float32Array;
      // Billboard basis from the camera: every pixel faces the reader.
      const e = cam.matrixWorld.elements;
      for (let r = 0; r < RIBBONS; r++) {
        const r3 = r * 3;
        const sx = mx + lerp(rib.offW[r3], rib.offN[r3], nf);
        const sy = my + lerp(rib.offW[r3 + 1], rib.offN[r3 + 1], nf);
        const sz = mz + lerp(rib.offW[r3 + 2], rib.offN[r3 + 2], nf);
        // Out of the mouth with a bow, then to a point right of the case and
        // behind it, and in to the DevKit from there: the curve is behind
        // the case's back before it is ever over the case (checked for both
        // mouths), so the front of the device is never crossed.
        const ex = SEAT.x;
        const ey = rib.endY[r];
        const ez = END_Z;
        const bowX = rib.bowN[r] * nf;
        const bowY = rib.bowW[r] * (1 - nf);
        const ax = sx + bowX;
        const ay = sy + (ey - sy) * 0.25 + bowY;
        const az = sz + rib.lift[r * 2];
        const bx = BEHIND.x + bowX * 0.4;
        const by = ey + bowY * 0.25;
        const bz = BEHIND.z;
        for (let p = 0; p < PACKETS; p++) {
          const pi = r * PACKETS + p;
          const run = o.flow * rib.speed[r] + pkt.phase[pi];
          const cycle = Math.floor(run);
          if (cycle !== pkt.cycle[pi]) {
            // A new packet: a colour.
            pkt.cycle[pi] = cycle;
            const pair = RIBBON_COLOURS[r];
            pkt.colour[pi] = hash(pi + 31, cycle) < 0.68 ? pair[0] : pair[1];
          }
          const colour = PALETTE[pkt.colour[pi]];
          // Packets past the density hide — whole packets, never half of one.
          const dens = Math.min(1, Math.max(0, o.density * PACKETS - p));
          // Stretch the cycle so the packet's last pixel finishes too.
          const tau = (run - cycle) * (1 + PER * TRAIL);
          const jx = pkt.jit[pi * 3];
          const jy = pkt.jit[pi * 3 + 1];
          const jz = pkt.jit[pi * 3 + 2];
          for (let q = 0; q < PER; q++) {
            const idx = pi * PER + q;
            const u = tau - q * TRAIL;
            let bright = 0;
            let x = 0;
            let y = 0;
            let z = 0;
            let size = 0;
            if (u > 0 && u < 1 && dens > 0) {
              const f = u;
              const t = f * (0.7 + 0.3 * f); // gathering speed on the way in
              const it = 1 - t;
              const b0 = it * it * it;
              const b1 = 3 * it * it * t;
              const b2 = 3 * it * t * t;
              const b3 = t * t * t;
              x = b0 * (sx + jx) + b1 * (ax + jx * 0.7) + b2 * (bx + jx * 0.3) + b3 * ex;
              y = b0 * (sy + jy) + b1 * (ay + jy * 0.7) + b2 * (by + jy * 0.3) + b3 * ey;
              z = b0 * (sz + jz) + b1 * (az + jz * 0.7) + b2 * (bz + jz * 0.3) + b3 * ez;
              // Out from the card's edge — nothing under the card itself —
              // brightest mid-air, fading as it goes in.
              bright = smooth(0.02, 0.18, f) * clearOfCard(cd, vp, hw, hh, x, y, z) * (1 - q * 0.075) * STREAM_PEAK * (1 - smooth(0.82, 1, f));
              size = lerp(0.034, 0.022, q / (PER - 1));
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
            cArr[idx * 3] = colour.r * bright;
            cArr[idx * 3 + 1] = colour.g * bright;
            cArr[idx * 3 + 2] = colour.b * bright;
          }
        }
      }
      stream.mesh.instanceMatrix.needsUpdate = true;
      stream.mesh.instanceColor!.needsUpdate = true;
    }

    // ── wifi ──────────────────────────────────────────────────────────────
    const wifiOn = s.wifi === "device";
    o.wifi += ((wifiOn ? 1 : 0) - o.wifi) * Math.min(1, dt * (wifiOn ? 2.4 : 6));
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
            // Out of the arcs, over to the card, gone before its edge.
            pt.z = smooth(0.04, 0.16, a) * (1 - smooth(0.9, 1, a)) * clearOfCard(cd, vp, hw, hh, pt.x, pt.y, 0) * (1 - (j / PULSE_PTS) * 0.8);
          }
        }
        // The path: dim dots from just out of the arcs to the card's edge.
        for (let j = 0; j < PATH_PTS; j++) {
          const a = 0.1 + (j / (PATH_PTS - 1)) * 0.86;
          const ia = 1 - a;
          const pt = wifi.path[j];
          pt.x = ia * ia * WIFI_ORIGIN.x + 2 * ia * a * PULSE_CTRL.x + a * a * PULSE_END.x;
          pt.y = ia * ia * WIFI_ORIGIN.y + 2 * ia * a * PULSE_CTRL.y + a * a * PULSE_END.y;
          pt.z = 0.22 * smooth(0.1, 0.22, a) * clearOfCard(cd, vp, hw, hh, pt.x, pt.y, 0);
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
