"use client";

/* eslint-disable react-hooks/immutability --
   Three.js objects (materials, textures, meshes) are imperative; mutating them
   per frame is their API and never feeds back into React rendering. */

import { createPortal, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { patternVert } from "@/components/3d/patterns/common";
import { PATTERN_DETENTS_PER_TURN } from "@/lib/pattern/harness";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";
import { getSim, useGuideStore } from "../store";
import { stepOf } from "../scenes";
import { KNOB_MESH_TO_LOGICAL, knobWorldCenter, MODEL_URL, DRACO_URL } from "./geometry";
import { DEVKIT_SEAT, DEVKIT_URL, devkitPose, M_TO_MODEL, PCB_PLACEMENT, PCB_URL } from "./parts";
import KitFx from "./KitFx";

// The Patternflow in the guide, put together from three files (parts.ts):
// the landing page's case, knobs and LED panel, the v3.9 board exported from
// KiCad in place of the model's old one, and the ESP32 DevKit on its sockets.
// Its LED mesh shows the simulated board's frame, its knobs turn, press and
// hold like the real encoders, and the back opens for the DevKit. The case
// GLB is shared with the landing page's HeroScene through drei's cache, so
// this works on a deep clone and never touches the cached scene.

const ledFragment = `
uniform sampler2D uTex;
uniform float uPower;
varying vec2 vUv;
void main() {
  vec2 rotatedUV = vec2(vUv.y, 1.0 - vUv.x);
  vec2 gridUV = rotatedUV * vec2(128.0, 64.0);
  vec2 localUV = fract(gridUV);
  vec2 pxUV = (floor(gridUV) + 0.5) / vec2(128.0, 64.0);
  vec3 col = texture2D(uTex, pxUV).rgb;
  float d = length(localUV - 0.5);
  float dotMask = smoothstep(0.46, 0.34, d);
  float fw = fwidth(vUv.x) * 128.0;
  float lod = smoothstep(0.0, 0.29, fw);
  float alpha = mix(dotMask, 1.0, lod);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col *= luma > 0.75 ? 2.35 : 0.9;
  float unlit = 0.018;
  col = mix(vec3(unlit), col, step(0.01, length(col)));
  gl_FragColor = vec4(col * alpha * uPower + vec3(unlit) * (1.0 - uPower), 1.0);
}
`;

// A ring drawn on a plane: `uFill` of the circle as a bright arc (a hold on
// its way to a long-press) over a faint full ring (the knob in focus).
const ringFragment = `
uniform float uFill;
uniform float uFocus;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float band = smoothstep(0.80, 0.84, r) * (1.0 - smoothstep(0.94, 0.98, r));
  float a = atan(p.x, p.y);
  float t = (a + 3.14159265) / 6.2831853;
  t = 1.0 - t;
  float arc = step(t, uFill) * step(0.001, uFill);
  float pulse = 0.35 + 0.25 * sin(uTime * 4.0);
  float glow = exp(-pow((r - 0.89) * 7.0, 2.0)) * uFocus * (0.25 + 0.2 * sin(uTime * 4.0));
  float alpha = band * max(arc, uFocus * pulse) + glow;
  gl_FragColor = vec4(uColor * (1.0 + arc * 1.4), alpha);
}
`;

type Kit = {
  pivot: THREE.Group;
  boot: THREE.Object3D | null;
  rst: THREE.Object3D | null;
};

type Parts = {
  devkit: Kit;
  led: THREE.Mesh | null;
  knobs: (THREE.Mesh | null)[]; // by logical index
  backPlates: THREE.Mesh[];
  all: THREE.Mesh[];
};

const LABELS = ["K1", "K2", "K3", "K4"];

export default function Device() {
  const [caseGltf, pcbGltf, kitGltf] = useGLTF([MODEL_URL, PCB_URL, DEVKIT_URL], DRACO_URL);
  const cached = caseGltf.scene;
  const scene = useMemo(() => {
    const clone = cached.clone(true);
    // The case model's own PCB is the old board; the v3.9 one goes in its place.
    const oldBoard = clone.getObjectByName("p");
    oldBoard?.parent?.remove(oldBoard);
    const pcb = pcbGltf.scene.clone(true);
    pcb.name = "pcb_v39";
    pcb.position.copy(PCB_PLACEMENT.position);
    pcb.quaternion.copy(PCB_PLACEMENT.quaternion);
    pcb.scale.setScalar(PCB_PLACEMENT.scale);
    clone.add(pcb);
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Start from the model's own pose even if the landing page left it mid-animation.
      if (m.userData.originalX !== undefined) m.position.set(m.userData.originalX, m.userData.originalY, m.userData.originalZ);
      if (m.userData.originalScale) m.scale.copy(m.userData.originalScale);
      m.visible = true;
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return clone;
  }, [cached, pcbGltf]);

  // The DevKit, in its own group so it can come out of the device.
  const kit = useMemo<Kit>(() => {
    const pivot = new THREE.Group();
    pivot.name = "devkit_pivot";
    pivot.scale.setScalar(M_TO_MODEL);
    pivot.position.copy(DEVKIT_SEAT.position);
    pivot.quaternion.copy(DEVKIT_SEAT.quaternion);
    const model = kitGltf.scene.clone(true);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      m.castShadow = true;
      m.receiveShadow = true;
    });
    pivot.add(model);
    return { pivot, boot: model.getObjectByName("boot_button") ?? null, rst: model.getObjectByName("rst_button") ?? null };
  }, [kitGltf]);

  useEffect(() => {
    scene.add(kit.pivot);
    return () => {
      scene.remove(kit.pivot);
    };
  }, [scene, kit]);

  const texture = useMemo(() => {
    const data = new Uint8Array(PANEL_W * PANEL_H * 4);
    const t = new THREE.DataTexture(data, PANEL_W, PANEL_H, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }, []);

  const ledMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTex: { value: texture }, uPower: { value: 0 } },
        vertexShader: patternVert,
        fragmentShader: ledFragment,
      }),
    [texture],
  );

  const parts = useMemo<Parts>(() => {
    const p: Parts = { devkit: kit, led: null, knobs: [null, null, null, null], backPlates: [], all: [] };
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.userData.home = m.position.clone();
      p.all.push(m);
      if (m.name === "l") {
        m.material = ledMat;
        p.led = m;
      } else if (m.name in KNOB_MESH_TO_LOGICAL) {
        p.knobs[KNOB_MESH_TO_LOGICAL[m.name]] = m;
        m.userData.baseRotY = m.rotation.y;
      } else if (m.name === "b_b" || m.name === "t_b") {
        p.backPlates.push(m);
      }
    });
    return p;
  }, [scene, ledMat, kit]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __pfGuideScene?: THREE.Object3D }).__pfGuideScene = scene;
  }, [scene]);

  // Focus / hold rings, one per knob, sitting on the knob's top face.
  const rings = useMemo(
    () =>
      [0, 1, 2, 3].map(() => {
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uFill: { value: 0 },
            uFocus: { value: 0 },
            uTime: { value: 0 },
            uColor: { value: new THREE.Color("#ff6a3d") },
          },
          vertexShader: patternVert,
          fragmentShader: ringFragment,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), mat);
        return mesh;
      }),
    [],
  );

  useEffect(() => {
    rings.forEach((ring, i) => {
      const c = knobWorldCenter(i, "model");
      ring.position.set(c.x, c.y, c.z + 0.08);
      scene.add(ring);
    });
    return () => rings.forEach((r) => scene.remove(r));
  }, [rings, scene]);

  // ── knobs under the pointer ────────────────────────────────────────────────
  const drag = useRef<{
    knob: number;
    cx: number;
    cy: number;
    lastAngle: number;
    accum: number;
    turned: boolean;
  } | null>(null);

  useEffect(() => {
    const sim = getSim();
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.cx;
      const dy = e.clientY - d.cy;
      if (dx * dx + dy * dy < 100) return;
      const angle = Math.atan2(dy, dx);
      let delta = angle - d.lastAngle;
      while (delta < -Math.PI) delta += Math.PI * 2;
      while (delta > Math.PI) delta -= Math.PI * 2;
      d.lastAngle = angle;
      d.accum += (delta / (Math.PI * 2)) * PATTERN_DETENTS_PER_TURN;
      const whole = Math.trunc(d.accum);
      if (whole !== 0) {
        if (!d.turned) {
          // It was a turn all along, not a press.
          d.turned = true;
          sim.cancel(d.knob);
        }
        d.accum -= whole;
        sim.turn(d.knob, whole);
        useGuideStore.getState().setHandsOn(true);
      }
    };
    const onUp = () => {
      const d = drag.current;
      if (!d) return;
      if (!d.turned) sim.release(d.knob);
      drag.current = null;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    let o: THREE.Object3D | null = e.object;
    while (o && !(o.name in KNOB_MESH_TO_LOGICAL)) o = o.parent;
    if (!o) return;
    e.stopPropagation();
    const knob = KNOB_MESH_TO_LOGICAL[o.name];
    const world = new THREE.Vector3();
    o.getWorldPosition(world);
    world.project(e.camera);
    const rect = (e.nativeEvent.target as HTMLElement).getBoundingClientRect();
    const cx = (world.x * 0.5 + 0.5) * rect.width + rect.left;
    const cy = (-world.y * 0.5 + 0.5) * rect.height + rect.top;
    drag.current = {
      knob,
      cx,
      cy,
      lastAngle: Math.atan2(e.nativeEvent.clientY - cy, e.nativeEvent.clientX - cx),
      accum: 0,
      turned: false,
    };
    getSim().press(knob);
    useGuideStore.getState().setHandsOn(true);
    document.body.style.cursor = "grabbing";
  };

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    let o: THREE.Object3D | null = e.object;
    while (o && !(o.name in KNOB_MESH_TO_LOGICAL)) o = o.parent;
    if (o && !drag.current) document.body.style.cursor = "grab";
  };
  const onPointerOut = () => {
    if (!drag.current) document.body.style.cursor = "";
  };

  // ── the frame ──────────────────────────────────────────────────────────────
  const shown = useRef({ turns: [0, 0, 0, 0], press: [0, 0, 0, 0], power: 0, back: 0, esp: 0 });
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() }), []);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useFrame((state, dt) => {
    const sim = getSim();
    const { scene: sceneId, step } = useGuideStore.getState();
    const s = stepOf(sceneId, step);
    const snap = sim.snapshot();

    // Panel: copy the simulated frame in, bottom row first for GL.
    const src = sim.frame;
    const dst = texture.image.data as Uint8Array;
    const row = PANEL_W * 4;
    for (let y = 0; y < PANEL_H; y++) {
      dst.set(src.subarray(y * row, (y + 1) * row), (PANEL_H - 1 - y) * row);
    }
    texture.needsUpdate = true;
    const powerTarget = snap.mode === "off" ? 0 : 1;
    shown.current.power += (powerTarget - shown.current.power) * Math.min(1, dt * 6);
    ledMat.uniforms.uPower.value = shown.current.power;

    // Knobs: rotation follows the detents, a press pushes the cap in.
    const t = state.clock.elapsedTime;
    parts.knobs.forEach((m, i) => {
      if (!m) return;
      const target = snap.turns[i];
      shown.current.turns[i] += (target - shown.current.turns[i]) * Math.min(1, dt * 14);
      m.rotation.y = m.userData.baseRotY - (shown.current.turns[i] / PATTERN_DETENTS_PER_TURN) * Math.PI * 2;
      const pressTarget = snap.down[i] ? 1 : 0;
      shown.current.press[i] += (pressTarget - shown.current.press[i]) * Math.min(1, dt * 20);
      const home = m.userData.home as THREE.Vector3;
      m.position.z = home.z - shown.current.press[i] * 0.45;

      const ring = rings[i].material as THREE.ShaderMaterial;
      ring.uniforms.uTime.value = t;
      ring.uniforms.uFill.value = snap.hold[i] > 0.04 ? snap.hold[i] : 0;
      const focusTarget = s.focus === i ? 1 : 0;
      ring.uniforms.uFocus.value += (focusTarget - ring.uniforms.uFocus.value) * Math.min(1, dt * 5);
      rings[i].position.z = home.z + 0.08 - shown.current.press[i] * 0.45;

      const label = labelRefs.current[i];
      if (label) {
        const on = Boolean(s.labels) || s.focus === i || snap.mode === "knobmap";
        label.dataset.on = on ? "1" : "0";
        label.dataset.active = snap.activeKnob === i || snap.down[i] ? "1" : "0";
      }
    });

    // The ESP32 DevKit: seated, or lifted out and held up in front.
    {
      const kit = parts.devkit;
      const espTarget = s.esp ?? 0;
      // Out quicker than back in, so returning it never lags the next scene.
      const rate = espTarget > shown.current.esp ? 0.9 : 1.6;
      const step = Math.sign(espTarget - shown.current.esp) * Math.min(Math.abs(espTarget - shown.current.esp), dt * rate);
      shown.current.esp += step;
      devkitPose(shown.current.esp, tmp.pos, tmp.quat);
      kit.pivot.position.copy(tmp.pos);
      kit.pivot.quaternion.copy(tmp.quat);
    }

    // The back opens while the ESP32 is out.
    const backTarget = (s.esp ?? 0) > 0 ? 1 : 0;
    shown.current.back += (backTarget - shown.current.back) * Math.min(1, dt * 2.5);
    // The back slides down and away, and is gone once it is out of frame.
    parts.backPlates.forEach((m) => {
      const home = m.userData.home as THREE.Vector3;
      const b = shown.current.back;
      m.position.y = home.y - b * 26;
      m.position.z = home.z - b * 6;
      m.visible = b < 0.98;
    });
  });

  return (
    <group>
      <primitive
        object={scene}
        onPointerDown={onPointerDown}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      {createPortal(<KitFx boot={kit.boot} rst={kit.rst} />, kit.pivot)}
      {[0, 1, 2, 3].map((i) => {
        const c = knobWorldCenter(i, "model");
        // K1/K3 are the right-hand column: their tags sit to the right.
        const right = i === 0 || i === 2;
        return (
          <Html key={i} position={[c.x + (right ? 2.2 : -2.2), c.y, c.z]} center zIndexRange={[20, 0]}>
            <div
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              className="guide-knob-tag"
              data-on="0"
              data-side={right ? "right" : "left"}
            >
              {LABELS[i]}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

useGLTF.preload([MODEL_URL, PCB_URL, DEVKIT_URL], DRACO_URL);
