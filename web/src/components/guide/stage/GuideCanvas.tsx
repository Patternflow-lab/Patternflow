"use client";

/* eslint-disable react-hooks/immutability --
   The camera and the simulated board are imperative objects driven from the
   frame loop; that is their API and it never feeds back into React. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Device from "./Device";
import Fx from "./Fx";
import { LED_CENTER_WORLD, MODEL_OFFSET, MODEL_SCALE } from "./geometry";
import { VIEWS } from "./views";
import { getSim, useGuideStore } from "../store";
import { stepOf, type DemoAction } from "../scenes";
import { buildClock, kitState } from "../timing";
import { beatIndex } from "./build/beats";

// The stage: one canvas behind the whole page. It never scrolls; the page
// scrolls over it and the Director below turns the scroll position into
// what the device does and where the camera stands.

// The Build guide's bench, plates and assembly (build/BuildStage): loaded
// only on that page, after the device, which it takes over and adds to.
const BuildStage = lazy(() => import("./build/BuildStage"));

function Director() {
  const last = useRef({ scene: "", step: -1, clock: 0, fired: new Set<number>() });

  useFrame((_, dt) => {
    const sim = getSim();
    const { scene, step, handsOn, page } = useGuideStore.getState();
    const s = stepOf(scene, step);
    const d = last.current;

    if (d.scene !== scene || d.step !== step) {
      d.scene = scene;
      d.step = step;
      d.clock = 0;
      d.fired.clear();
      sim.releaseAll();
      sim.setPack(s.pack);
      if (!s.power) sim.setMode("off");
      else if (s.mode) sim.setMode(s.mode === "off" ? "run" : s.mode);
      else sim.setMode("run");
    }

    // The scripted demo: each action once per loop, paused while the reader
    // has the knobs.
    //
    // Its clock is the board's own: the simulator never takes more than a
    // tenth of a second in a frame (deviceSim tick), so on a slow frame — the
    // page still loading, on a link straight to a step — a clock run on real
    // time got ahead of it, and a scripted one-second hold came out shorter
    // than a long press. The board took it for a click and the rest of the
    // loop played against the wrong screen.
    //
    // On the Build guide a demo also waits for the build to get to its step:
    // the stage runs its timeline there from wherever it was, the panel dark
    // until the power bank goes in (BuildStage), and presses made meanwhile
    // went to a board that was off.
    const building = page === "build" && s.build !== undefined && Math.floor(buildClock.t) !== beatIndex(s.build);
    if (s.demo && !handsOn && !building) {
      const period = s.period ?? 4000;
      const before = d.clock;
      d.clock += Math.min(Math.max(dt, 0), 0.1) * 1000;
      if (Math.floor(before / period) !== Math.floor(d.clock / period)) d.fired.clear();
      const local = d.clock % period;
      s.demo.forEach((a: DemoAction, i) => {
        if (d.fired.has(i) || local < a.at) return;
        d.fired.add(i);
        if ("press" in a) sim.press(a.press);
        else if ("release" in a) sim.release(a.release);
        else if ("turn" in a) sim.turn(a.turn, a.detents);
        else if ("mode" in a) sim.setMode(a.mode);
      });
    }

    sim.tick(dt);
  });

  return null;
}

// ── the camera ──────────────────────────────────────────────────────────────
//
// Views are positions, but the camera never travels between them in a straight
// line: a straight line from the front to the back of the device goes through
// it, and for a few frames the whole screen was the inside of a white case.
// Instead it moves in spherical coordinates around the (moving) target —
// azimuth the short way round, elevation, distance — each on a critically
// damped spring, and it backs off while it swings so a big turn reads as a
// camera move rather than a cut.
//
// How far away it stands is worked out, not written down: each view names
// what must be on screen (views.ts), and the rig finds the distance at which
// that fits the part of the screen the copy leaves free — left of the card
// on a wide screen, above it on a narrow one — at this screen's aspect.

type Damp = { v: number };

function smoothDamp(current: number, target: number, vel: Damp, smoothTime: number, dt: number) {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// The device's box in world units; the camera keeps a margin from it.
const DEVICE_BOX = new THREE.Box3(new THREE.Vector3(-1.3, -1.7, -0.3), new THREE.Vector3(1.3, 1.75, 0.45));

/** The free part of the screen, in CSS px. */
type Free = { l: number; r: number; t: number; b: number };

// Where the step's card is when the reader is on that step (its block
// centred; the opening at the top of the page), and so what it leaves free.
function freeArea(scene: string, step: number, w: number, h: number, narrow: boolean, tallCards: boolean): Free {
  const fallback: Free = narrow ? { l: 12, r: w - 12, t: 56, b: h * 0.5 } : { l: 24, r: w * 0.6, t: 64, b: h - 32 };
  const art = document.querySelector<HTMLElement>(`[data-scene="${scene}"] [data-step="${step}"]`);
  if (!art) return fallback;
  // A chapter step's block holds its card; the opening and the end are their own card.
  const card = art.children.length === 1 ? (art.firstElementChild as HTMLElement) : art;
  const ar = art.getBoundingClientRect();
  const docTop = ar.top + window.scrollY;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - h);
  const at = scene === "opening" ? 0 : THREE.MathUtils.clamp(docTop + ar.height / 2 - h / 2, 0, maxScroll);
  // A dwell step's card is sticky (Guide.module.css): on a narrow screen it
  // rests 6vh above the bottom while its long block is centred, and its
  // offsetTop follows the scroll, so it can't be read from the layout.
  const cardTop =
    narrow && art.dataset.dwell && card !== art
      ? h * 0.94 - card.offsetHeight
      : docTop + (card === art ? 0 : card.offsetTop - art.offsetTop) - at;
  const cardLeft = ar.left + (card === art ? 0 : card.offsetLeft - art.offsetLeft);
  // A card taller than about two thirds of a phone's screen stands higher
  // than 36% when its block is centred. Play's are fitted as if it did not
  // (the device is big, and losing its foot to the card costs nothing).
  // Build's tall cards are the ones with the most to see above them — which
  // hole, which screw — so there the stage fits what is really left, down to
  // a fifth of the screen.
  if (narrow) return { l: 12, r: w - 12, t: 56, b: THREE.MathUtils.clamp(cardTop - 14, h * (tallCards ? 0.2 : 0.36), h - 12) };
  return { l: 24, r: THREE.MathUtils.clamp(cardLeft - 32, w * 0.35, w - 24), t: 64, b: h - 32 };
}

type FitTmp = { f: THREE.Vector3; r: THREE.Vector3; u: THREE.Vector3; p: THREE.Vector3; cam: THREE.Vector3 };

/**
 * The distance along `dir` from `target` at which every point of `frame`
 * projects inside ±hx, ±hy of the unshifted frustum (the fov is vertical).
 */
function fitDistance(
  target: THREE.Vector3,
  dir: THREE.Vector3,
  frame: THREE.Vector3[],
  tanHalf: number,
  aspect: number,
  hx: number,
  hy: number,
  t: FitTmp,
) {
  t.f.copy(dir).negate();
  t.r.crossVectors(t.f, THREE.Object3D.DEFAULT_UP).normalize();
  t.u.crossVectors(t.r, t.f);
  const fits = (d: number) => {
    t.cam.copy(dir).multiplyScalar(d).add(target);
    for (const q of frame) {
      t.p.subVectors(q, t.cam);
      const z = t.p.dot(t.f);
      if (z < 0.05) return false;
      if (Math.abs(t.p.dot(t.r)) > hx * z * tanHalf * aspect) return false;
      if (Math.abs(t.p.dot(t.u)) > hy * z * tanHalf) return false;
    }
    return true;
  };
  let lo = 0.2;
  let hi = 80;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

type RigState = {
  init: boolean;
  target: THREE.Vector3;
  r: number;
  az: number;
  el: number;
  vt: [Damp, Damp, Damp];
  vr: Damp;
  vaz: Damp;
  vel: Damp;
  ox: Damp;
  oy: Damp;
  offset: { x: number; y: number };
  free: Free;
  freeKey: string;
  freeAge: number;
};

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, size } = useThree();
  const st = useRef<RigState>({
    init: false,
    target: new THREE.Vector3(),
    r: 10,
    az: 0,
    el: 0,
    vt: [{ v: 0 }, { v: 0 }, { v: 0 }],
    vr: { v: 0 },
    vaz: { v: 0 },
    vel: { v: 0 },
    ox: { v: 0 },
    oy: { v: 0 },
    offset: { x: 0, y: 0 },
    free: { l: 0, r: 1, t: 0, b: 1 },
    freeKey: "",
    freeAge: 0,
  });
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const tmp = useMemo(
    () => ({
      d: new THREE.Vector3(),
      p: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      fit: { f: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), p: new THREE.Vector3(), cam: new THREE.Vector3() },
    }),
    [],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const { scene, step, narrow, handsOn, page } = useGuideStore.getState();
    const s = stepOf(scene, step);
    // A DevKit view before the DevKit is out from behind the case (scrolling
    // back up into chapter one, say) would stare at empty air while the back
    // cover comes off; it watches from behind, as the chapter's first step
    // does, and follows the DevKit round once it clears the case's side.
    const devkitView = s.view === "esp" || s.view === "espPorts" || s.view === "espButtons";
    // "Back in. Power on.": while the DevKit goes back on its pins and the
    // cover slides shut, the camera watches that from behind — the order the
    // copy gives — and comes round to the front once the device is whole,
    // as the panel powers on (KitFx holds the power until then).
    const reassembling = scene === "flash" && step === 6 && !kitState.home;
    // A Build step with two places to look at on a narrow screen (scenes.ts
    // narrowLate): its second view from that far through its beat.
    const late = narrow && s.narrowLate && s.build !== undefined && buildClock.t - beatIndex(s.build) >= s.narrowLate.from ? s.narrowLate.view : null;
    const view = VIEWS[(devkitView && !kitState.out) || reassembling ? "back" : (late ?? ((narrow && s.narrowView) || s.view))];
    const c = st.current;
    const cam = camera as THREE.PerspectiveCamera;
    const w = size.width;
    const h = size.height;

    // What the copy leaves free: measured when the step or the screen
    // changes, and now and then in case the card grew (fonts, images).
    const key = `${scene}.${step}.${w}x${h}.${narrow ? 1 : 0}`;
    if (key !== c.freeKey || ++c.freeAge > 45) {
      c.free = freeArea(scene, step, w, h, narrow, page === "build");
      c.freeKey = key;
      c.freeAge = 0;
    }
    const free = c.free;

    // Where this step wants the camera, in spherical terms around its target.
    let wantAz = Math.atan2(view.dir.x, view.dir.z);
    const wantEl = Math.asin(THREE.MathUtils.clamp(view.dir.y, -1, 1));
    if (s.spin && !reducedMotion) wantAz += Math.sin(state.clock.elapsedTime * s.spin) * 0.5;
    const cosWantEl = Math.cos(wantEl);
    tmp.d.set(Math.sin(wantAz) * cosWantEl, Math.sin(wantEl), Math.cos(wantAz) * cosWantEl);
    // Back off along that line until the view's frame fits the free area.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const hx = ((free.r - free.l) / w) * view.fill;
    const hy = ((free.b - free.t) / h) * view.fill;
    const wantR = Math.max(view.minR, fitDistance(view.target, tmp.d, view.frame, tanHalf, w / h, hx, hy, tmp.fit));

    if (!c.init) {
      // Arrive from a little further out and round, once, on load.
      c.init = true;
      c.target.copy(view.target);
      c.r = wantR * 1.25;
      c.az = wantAz + 0.35;
      c.el = wantEl + 0.08;
    }

    const smooth = reducedMotion ? 0.25 : handsOn ? 0.9 : 0.62;
    c.target.x = smoothDamp(c.target.x, view.target.x, c.vt[0], smooth, dt);
    c.target.y = smoothDamp(c.target.y, view.target.y, c.vt[1], smooth, dt);
    c.target.z = smoothDamp(c.target.z, view.target.z, c.vt[2], smooth, dt);

    const dAz = wrapAngle(wantAz - c.az);
    c.az = smoothDamp(c.az, c.az + dAz, c.vaz, smooth * 1.1, dt);
    c.el = smoothDamp(c.el, wantEl, c.vel, smooth, dt);
    // Back off while swinging round: the further there is to turn, the wider the orbit.
    const swing = Math.min(Math.PI, Math.abs(dAz) + Math.abs(wantEl - c.el));
    // Close-ups (the DevKit, ~3 away) swing on at least a device-sized orbit,
    // or a turn round the case passes its side at arm's length.
    const bulge = reducedMotion ? 0 : swing * 0.32 * Math.max(wantR, 7);
    // Backing out (from the DevKit held up close to the whole device, say),
    // the orbit widens ahead of the target's move, so the camera never sweeps
    // past the case at arm's length on the way.
    const outward = wantR + bulge > c.r;
    c.r = smoothDamp(c.r, wantR + bulge, c.vr, outward ? smooth * 0.55 : smooth, dt);

    const cosEl = Math.cos(c.el);
    tmp.p.set(Math.sin(c.az) * cosEl, Math.sin(c.el), Math.cos(c.az) * cosEl).multiplyScalar(c.r).add(c.target);

    // A little parallax from the pointer, smoothed; none while on the knobs.
    const par = reducedMotion || handsOn ? 0 : 0.12 * (c.r / 8);
    const pt = pointer.current;
    pt.sx += (pt.x - pt.sx) * Math.min(1, dt * 2);
    pt.sy += (pt.y - pt.sy) * Math.min(1, dt * 2);
    tmp.d.subVectors(c.target, tmp.p).normalize();
    tmp.right.crossVectors(tmp.d, camera.up).normalize();
    tmp.up.crossVectors(tmp.right, tmp.d).normalize();
    tmp.p.addScaledVector(tmp.right, pt.sx * par).addScaledVector(tmp.up, -pt.sy * par * 0.6);

    // Never inside the device, whatever the springs are doing.
    const m = 0.35;
    const b = DEVICE_BOX;
    if (
      tmp.p.x > b.min.x - m && tmp.p.x < b.max.x + m &&
      tmp.p.y > b.min.y - m && tmp.p.y < b.max.y + m &&
      tmp.p.z > b.min.z - m && tmp.p.z < b.max.z + m
    ) {
      tmp.p.z = tmp.p.z >= 0 ? b.max.z + m : b.min.z - m;
    }

    camera.position.copy(tmp.p);
    camera.lookAt(c.target);

    // Composition: the copy takes the right side on a wide screen and the
    // bottom on a narrow one, so the target moves to the middle of what it
    // leaves free — which is where the fit above assumed it would be.
    const wantX = w / 2 - (free.l + free.r) / 2;
    const wantY = h / 2 - (free.t + free.b) / 2;
    c.offset.x = smoothDamp(c.offset.x, wantX, c.ox, 0.5, dt);
    c.offset.y = smoothDamp(c.offset.y, wantY, c.oy, 0.5, dt);
    cam.setViewOffset(w, h, c.offset.x, c.offset.y, w, h);
  });

  return null;
}

// ── shaders before they are needed ─────────────────────────────────────────
//
// Much of the stage starts hidden: the USB-C cable and plug, the packets on
// it, the rings and tags, the flashing sweep, the stream and the Wi-Fi. three
// builds a material's shader the first time it draws it, and a first draw in
// the middle of a camera move (the cable arriving) froze the page for up to
// half a second. Once everything has loaded, every material in the scene is
// compiled — in the background where the browser can (compileAsync, parallel
// shader compile) — for the render target the frame is really drawn into:
// the effects composer's buffer, whose linear colour space is part of the
// shader.

function Warmup() {
  const { gl, scene, camera } = useThree();
  const done = useRef(0);
  useFrame(() => {
    // A couple of frames in, so the device has mounted and the lights are placed.
    if (done.current > 2) return;
    if (++done.current < 2) return;
    done.current = 3;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    const finish = () => target.dispose();
    try {
      gl.compileAsync(scene, camera).then(finish, finish);
    } catch {
      finish();
    }
    gl.setRenderTarget(prev);
  });
  return null;
}

// ── light from the panel ────────────────────────────────────────────────────
//
// An LED panel is a light. A point light just in front of it takes the
// average colour of what the board is showing, so the knobs, the case edge
// and the floor catch the pattern's colour the way they do in a dark room.
//
// It has no shadow, so it lights whatever faces it, through anything. On the
// Build guide the panel's back stands open to a camera behind it (check-4,
// before the back goes on), and the ribs and band there glowed with the
// pattern's colour — a panel shining through itself. So on that page the
// light goes out as the camera comes round behind the panel's plane; the
// floor's spill, which it is for, is in front and not in those shots.

function PanelLight() {
  const light = useRef<THREE.PointLight>(null);
  const color = useMemo(() => new THREE.Color(), []);
  const n = useRef(0);
  useFrame((state) => {
    const l = light.current;
    if (!l || n.current++ % 3) return;
    // 1 in front of the panel, 0 behind it (world z: its faces are at ±0.1).
    const front = useGuideStore.getState().page === "build" ? THREE.MathUtils.clamp((state.camera.position.z + 0.3) / 0.6, 0, 1) : 1;
    const f = getSim().frame;
    let r = 0;
    let g = 0;
    let b = 0;
    // Every 8th pixel is plenty for an average.
    for (let i = 0; i < f.length; i += 32) {
      r += f[i];
      g += f[i + 1];
      b += f[i + 2];
    }
    const count = f.length / 32;
    r /= count * 255;
    g /= count * 255;
    b /= count * 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const peak = Math.max(r, g, b);
    if (peak > 0.0001) color.setRGB(r / peak, g / peak, b / peak);
    l.color.lerp(color, 0.25);
    l.intensity += (Math.min(4, lum * 9) * front - l.intensity) * 0.2;
  });
  return (
    <pointLight
      ref={light}
      position={[LED_CENTER_WORLD.x, LED_CENTER_WORLD.y - 0.2, 0.9]}
      intensity={0}
      distance={6}
      decay={2}
    />
  );
}

// ── the floor ───────────────────────────────────────────────────────────────
//
// Something for the device to stand on and the panel to spill onto, fading
// into the dark well before its edges.

function Floor() {
  const alpha = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, "#8a8a8a");
      g.addColorStop(1, "#000000");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.66, 0.4]} receiveShadow>
      <circleGeometry args={[7, 64]} />
      <meshStandardMaterial color="#141210" roughness={0.92} metalness={0} transparent alphaMap={alpha} depthWrite={false} />
    </mesh>
  );
}

// ?gdebug=nobloom,noshadow,noenv,noao — for bisecting what a GPU objects to.
function debugFlags(): Set<string> {
  if (typeof window === "undefined") return new Set();
  return new Set((new URLSearchParams(window.location.search).get("gdebug") ?? "").split(",").filter(Boolean));
}

export default function GuideCanvas() {
  const flags = debugFlags();
  const narrow = useGuideStore((s) => s.narrow);
  const page = useGuideStore((s) => s.page);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReducedMotion(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  const ao = !narrow && !flags.has("noao");

  return (
    <Canvas
      camera={{ position: [4.2, 1.9, 11.6], fov: 26, near: 0.05, far: 100 }}
      dpr={narrow ? [1, 1.5] : [1, 2]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      flat
      shadows={flags.has("noshadow") ? false : { type: THREE.VSMShadowMap }}
    >
      <ambientLight intensity={0.18} color="#fef6e8" />
      {/* Key: soft, from above right. VSM with a wide radius gives the knobs a
          contact shadow on the case instead of hard black cut-outs. */}
      <directionalLight
        position={[3.5, 5, 6]}
        intensity={2.4}
        color="#fff7ee"
        castShadow={!flags.has("noshadow")}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-radius={9}
        shadow-blurSamples={16}
        shadow-bias={-0.0006}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      {/* Rims and a fill, neutral enough that the white case stays white. */}
      <directionalLight position={[-5, 2, -4]} intensity={0.9} color="#e2e8ff" />
      <directionalLight position={[4, -2, -5]} intensity={0.45} color="#ffe0d2" />
      <directionalLight position={[0, 3, -8]} intensity={0.7} color="#fff6ea" />
      <PanelLight />
      {/* A studio made of light panels rather than a downloaded HDR: the
          preset environment lost the WebGL context on this scene (the landing
          page's copy of the same line does not), and panels read better on
          the white case anyway — soft key above, cool rim behind. */}
      {!flags.has("noenv") && (
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2} color="#fff4e6" position={[0, 5, 4]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={0.9} color="#e4ebff" position={[-6, 1, -3]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#ffe2d6" position={[6, -1, -2]} rotation-y={-Math.PI / 2} scale={[5, 3, 1]} />
        </Environment>
      )}
      <Floor />
      <Suspense fallback={null}>
        <group scale={MODEL_SCALE} position={MODEL_OFFSET}>
          <Device />
        </group>
        <Warmup />
        {/* After the device, so each frame it moves the device's parts after
            the device has (it runs later in the frame loop). Its own
            boundary: the device stays on screen while it loads. */}
        {page === "build" && (
          <Suspense fallback={null}>
            <BuildStage />
          </Suspense>
        )}
      </Suspense>
      <Director />
      <Fx />
      <CameraRig reducedMotion={reducedMotion} />
      {!flags.has("nobloom") &&
        (ao ? (
          <EffectComposer multisampling={4} enableNormalPass={false}>
            <N8AO aoRadius={0.45} distanceFalloff={0.8} intensity={2.4} quality="medium" halfRes />
            {/* Only what is brighter than white glows: LED pixels past their
                knee and the live rings. The white case, however well lit,
                stays under the threshold — it used to bloom the screen white. */}
            <Bloom luminanceThreshold={1.15} luminanceSmoothing={0.2} intensity={0.85} radius={0.72} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.32} darkness={0.55} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom luminanceThreshold={1.15} luminanceSmoothing={0.2} intensity={0.85} radius={0.72} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.32} darkness={0.55} />
          </EffectComposer>
        ))}
    </Canvas>
  );
}
