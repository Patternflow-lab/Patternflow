"use client";

/* eslint-disable react-hooks/immutability --
   The camera and the simulated board are imperative objects driven from the
   frame loop; that is their API and it never feeds back into React. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Device from "./Device";
import Fx from "./Fx";
import { LED_CENTER_WORLD, MODEL_OFFSET, MODEL_SCALE } from "./geometry";
import { VIEWS } from "./views";
import { getSim, useGuideStore } from "../store";
import { stepOf, type DemoAction } from "../scenes";

// The stage: one canvas behind the whole page. It never scrolls; the page
// scrolls over it and the Director below turns the scroll position into
// what the device does and where the camera stands.

function Director() {
  const last = useRef({ scene: "", step: -1, clock: 0, fired: new Set<number>() });

  useFrame((_, dt) => {
    const sim = getSim();
    const { scene, step, handsOn } = useGuideStore.getState();
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
    if (s.demo && !handsOn) {
      const period = s.period ?? 4000;
      const before = d.clock;
      d.clock += dt * 1000;
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
  });
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const tmp = useMemo(
    () => ({ d: new THREE.Vector3(), p: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() }),
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
    const { scene, step, narrow, handsOn } = useGuideStore.getState();
    const s = stepOf(scene, step);
    const view = VIEWS[s.view];
    const c = st.current;

    // Where this step wants the camera, in spherical terms around its target.
    tmp.d.subVectors(view.pos, view.target);
    const wantR = tmp.d.length();
    let wantAz = Math.atan2(tmp.d.x, tmp.d.z);
    const wantEl = Math.asin(THREE.MathUtils.clamp(tmp.d.y / wantR, -1, 1));
    if (s.spin && !reducedMotion) wantAz += Math.sin(state.clock.elapsedTime * s.spin) * 0.5;

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
    const bulge = reducedMotion ? 0 : swing * 0.32 * wantR;
    c.r = smoothDamp(c.r, wantR + bulge, c.vr, smooth, dt);

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
    // bottom on a narrow one, so the subject moves out of its way.
    const cam = camera as THREE.PerspectiveCamera;
    const wantX = narrow ? 0 : size.width * 0.2;
    const wantY = narrow ? size.height * 0.2 : 0;
    c.offset.x = smoothDamp(c.offset.x, wantX, c.ox, 0.5, dt);
    c.offset.y = smoothDamp(c.offset.y, wantY, c.oy, 0.5, dt);
    cam.setViewOffset(size.width, size.height, c.offset.x, c.offset.y, size.width, size.height);
  });

  return null;
}

// ── light from the panel ────────────────────────────────────────────────────
//
// An LED panel is a light. A point light just in front of it takes the
// average colour of what the board is showing, so the knobs, the case edge
// and the floor catch the pattern's colour the way they do in a dark room.

function PanelLight() {
  const light = useRef<THREE.PointLight>(null);
  const color = useMemo(() => new THREE.Color(), []);
  const n = useRef(0);
  useFrame(() => {
    const l = light.current;
    if (!l || n.current++ % 3) return;
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
    l.intensity += (Math.min(4, lum * 9) - l.intensity) * 0.2;
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
