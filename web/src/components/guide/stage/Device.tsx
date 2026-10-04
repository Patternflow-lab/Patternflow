"use client";

/* eslint-disable react-hooks/immutability --
   Three.js objects (materials, textures, meshes) are imperative; mutating them
   per frame is their API and never feeds back into React rendering. */

import { createPortal, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { patternVert } from "@/components/3d/patterns/common";
import { PATTERN_DETENTS_PER_TURN } from "@/lib/pattern/harness";
import { FIRMWARE, PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";
import { ledPanelMaterial, ledPanelTexture } from "./look/ledPanel";
import { knobMaterial, plaMaterial, tunePcbMaterials } from "./look/materials";
import { readPanelGlow } from "./look/panelGlow";
import { getSim, useGuideStore } from "../store";
import { stepOf } from "../scenes";
import { micLiftStep, micReseatStep } from "../scenes/audio";
import { knobIsTurned } from "../hubKnob";
import {
  DRACO_URL,
  modelToWorld,
  KNOB_BASE_Z,
  KNOB_MESH_TO_LOGICAL,
  KNOB_PRESS,
  KNOB_TOP_Z,
  knobWorldCenter,
  MODEL_SCALE,
  MODEL_URL,
} from "./geometry";
import {
  CASE_URL,
  DEVKIT_LIFT_END,
  DEVKIT_SEAT,
  DEVKIT_URL,
  devkitPose,
  M_TO_MODEL,
  PCB_PLACEMENT,
  PCB_URL,
  SLIDER_OFF,
  SLIDER_SECONDS,
  sliderPose,
} from "./parts";
import KitFx from "./KitFx";
import { kitPress } from "./hand";
import { kitState } from "../timing";
import { devkitMaterials } from "./kitMaterials";
import { forgetPillSize, NO_POINTER, placeTag } from "./tags";
import { VIEWS } from "./views";

// The Patternflow in the guide, put together from four files (parts.ts): the
// v3.9 enclosure and knobs from the case's Blender source, the landing page
// model's LED panel (nothing else of that model is used), the v3.9 board
// exported from KiCad, and the ESP32 DevKit on its sockets. Its LED mesh
// shows the simulated board's frame, its knobs turn, press and hold like the
// real encoders, and the back slider comes off for the DevKit to come out.
// The landing model's GLB is shared with the landing page's HeroScene through
// drei's cache, so this works on clones and never touches a cached scene.

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
  slider: THREE.Mesh | null;
  all: THREE.Mesh[];
};

const LABELS = ["K1", "K2", "K3", "K4"];
const CASE_NODES = ["body", "back_slider", "back_plate", "top_lid"];
const KNOB_H = KNOB_TOP_Z - KNOB_BASE_Z;
/** The knobs' radius (case-v39.glb c1..c4: 16.3 mm across), model units. */
const KNOB_R = 0.813;
/**
 * What a finger or pointer can take hold of: a disc over each knob's top,
 * nearly half the 31 mm between knob axes. On a phone a knob is 15 px across,
 * too small to find by touch.
 */
const KNOB_HIT_R = 1.45;
/**
 * The dial round each knob: a band on the case face with a dot riding it at
 * the knob's angle — something to take hold of and see go round, since the
 * knobs themselves are plain black cylinders with no mark on them. Radii in
 * model units, inside half the 31 mm between knob axes.
 */
const DIAL_IN = 0.98;
const DIAL_OUT = 1.16;
const DIAL_DOT = 0.17;
/** The focus / hold ring's outer edge round a knob's top (the ring's plane is 4.2 across, its band out to 0.98 of that). */
const FOCUS_RING_R = 2.06;
/** Just proud of the case's front face (1.5635), under the knob skirts (1.6437). */
const DIAL_Z = KNOB_BASE_Z - 0.06;
/** How long a knob keeps its readout after it last moved, ms. */
const READOUT_HOLD = 1400;

function formatReadout(value: number, span: number) {
  const digits = span >= 20 ? 0 : span >= 2 ? 1 : 2;
  return value.toFixed(digits);
}

/**
 * How much faster than its own pace the back cover and the DevKit move.
 * They keep their pace only on the way out in chapter one's first two steps,
 * which are about taking them out; putting them back ("Back in. Power on.")
 * is quicker, and anything else — scrolling back up, a jump from the chapter
 * list — is a scene change and gets it done quickly. In the Build guide the
 * DevKit going onto its pins is all its step shows ("Seat the DevKit, power
 * off."), so there it keeps its own pace too. The Audio guide's microphone
 * section takes the DevKit out once and puts it back once (scenes/audio.ts
 * micLiftStep, micReseatStep), at the paces Play's two have.
 */
function choreoSpeed(page: string, scene: string, step: number, outward: boolean) {
  if (scene === "flash" && step <= 1 && outward) return 1;
  if (scene === "flash" && step === 6) return 1.8;
  if (micLiftStep(page, scene, step) && outward) return 1;
  if (micReseatStep(page, scene, step) && !outward) return 1.8;
  if (seatingStep(page, scene, step) && !outward) return 1;
  return 2.6;
}

/** The Build guide's "Seat the DevKit, power off." (scenes/build.ts: firmware, step 1). */
function seatingStep(page: string, scene: string, step: number) {
  return page === "build" && scene === "firmware" && step === 1;
}

// Warm white PLA and the knobs' black (look/materials.ts): printed, with a
// print's layers on the walls. The case lay on its face on the plate and the
// knobs stood on their skirts, so in the device both are layered along z.
const caseMaterial = () => plaMaterial();

/** How fast the panel dies when its power is cut: the time to fall to a third, seconds. A supply's capacitors, not a fade — but not a cut frame either. */
const POWER_OFF_S = 0.11;

export default function Device() {
  const [ledGltf, caseGltf, pcbGltf, kitGltf] = useGLTF([MODEL_URL, CASE_URL, PCB_URL, DEVKIT_URL], DRACO_URL);
  const scene = useMemo(() => {
    const root = new THREE.Group();
    root.name = "patternflow";
    // Of the landing page's model only the LED panel stays: its case, knobs
    // and board are older than v3.9.
    const ledSrc = ledGltf.scene.getObjectByName("l");
    if (ledSrc) {
      const led = ledSrc.clone(true);
      // Start from the model's own pose even if the landing page left it mid-animation.
      if (led.userData.originalX !== undefined) led.position.set(led.userData.originalX, led.userData.originalY, led.userData.originalZ);
      if (led.userData.originalScale) led.scale.copy(led.userData.originalScale);
      root.add(led);
    }
    const shell = caseGltf.scene.clone(true);
    shell.name = "case_v39";
    shell.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (CASE_NODES.includes(m.name)) m.material = caseMaterial();
      else if (m.name in KNOB_MESH_TO_LOGICAL) m.material = knobMaterial();
    });
    root.add(shell);
    // The back plate's snap notch (where the cover's flex tab clicks in, at
    // its edge by the pocket) is cut through the plate: with the cover off it
    // looked straight into the unlit inside of the case, a black block at the
    // pocket's edge. A floor at the plate's inner face makes it read as the
    // recess it is.
    const notchFloor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.2), caseMaterial());
    notchFloor.name = "notch_floor";
    notchFloor.position.set(2.93, 23.715, -1.395);
    notchFloor.rotation.y = Math.PI;
    shell.add(notchFloor);
    const pcb = pcbGltf.scene.clone(true);
    pcb.name = "pcb_v39";
    pcb.position.copy(PCB_PLACEMENT.position);
    pcb.quaternion.copy(PCB_PLACEMENT.quaternion);
    pcb.scale.setScalar(PCB_PLACEMENT.scale);
    root.add(pcb);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.visible = true;
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      m.castShadow = true;
      m.receiveShadow = true;
    });
    // The board's parts as what they are made of (the file gives most of
    // them glTF's default, a fully rough metal): look/materials.ts.
    tunePcbMaterials(pcb);
    // The encoders' simplified metal reads as a mirror under the stage's
    // light (it was made to sit inside the case), and blooms: brushed steel
    // instead, wherever they are out in the open — the hub's device taken
    // apart (Explode), and the Build guide (BuildStage sets the same).
    pcb.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat && !Array.isArray(mat) && mat.name === "encoder_metal") {
        mat.color.set("#8d9096");
        mat.metalness = 0.7;
        mat.roughness = 0.6;
      }
    });
    return root;
  }, [ledGltf, caseGltf, pcbGltf]);

  // The DevKit, in its own group so it can come out of the device.
  const kit = useMemo<Kit>(() => {
    const pivot = new THREE.Group();
    pivot.name = "devkit_pivot";
    pivot.scale.setScalar(M_TO_MODEL);
    pivot.position.copy(DEVKIT_SEAT.position);
    pivot.quaternion.copy(DEVKIT_SEAT.quaternion);
    const model = kitGltf.scene.clone(true);
    const mats = devkitMaterials();
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const own = Array.isArray(m.material) ? m.material[0] : m.material;
      m.material = mats.forName(own.name) ?? own.clone();
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

  // The panel's face (look/ledPanel.ts): the frame as a texture, and the
  // shader that makes LEDs of it.
  const texture = useMemo(() => ledPanelTexture(), []);
  const ledMat = useMemo(() => ledPanelMaterial(texture), [texture]);

  const parts = useMemo<Parts>(() => {
    const p: Parts = { devkit: kit, led: null, knobs: [null, null, null, null], slider: null, all: [] };
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
        m.userData.baseRotZ = m.rotation.z;
      } else if (m.name === "back_slider") {
        p.slider = m;
        // It fades where it is laid down (sliderPose): transparent from the
        // start, because turning that on later would build a new shader in
        // the middle of the move.
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
      }
    });
    // The knobs' hit discs, children of the knobs so a hit finds its knob.
    const hitGeo = new THREE.CircleGeometry(KNOB_HIT_R, 32);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    p.knobs.forEach((k) => {
      if (!k) return;
      const disc = new THREE.Mesh(hitGeo, hitMat);
      disc.name = "knob_hit";
      disc.position.z = KNOB_H + 0.02;
      k.add(disc);
    });
    return p;
  }, [scene, ledMat, kit]);

  useEffect(() => {
    // In development only, for looking at the stage from a script: the scene, and the board it shows.
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __pfGuideScene: scene, __pfGuideSim: getSim() });
  }, [scene]);

  // Focus / hold rings, one per knob, just above the knob's top face.
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
        // By name: a ring goes where its knob goes when the device comes apart (Explode).
        mesh.name = "knob_ring";
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

  // The dials: a band and a riding dot per knob, added to the case so a
  // pointer on them reaches the same handler as the knobs (userData.knob).
  const dials = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const group = new THREE.Group();
        const band = new THREE.Mesh(
          new THREE.RingGeometry(DIAL_IN, DIAL_OUT, 72),
          // A dark track on the white case, like a printed scale.
          new THREE.MeshBasicMaterial({ color: "#1c1a18", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
        );
        const spin = new THREE.Group();
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(DIAL_DOT, 24),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color("#ff6a3d").multiplyScalar(1.6),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        // Twelve o'clock when the knob is where it started.
        dot.position.set(0, (DIAL_IN + DIAL_OUT) / 2, 0.004);
        spin.add(dot);
        group.add(band, spin);
        const c = knobWorldCenter(i, "model");
        group.position.set(c.x, c.y, DIAL_Z);
        for (const o of [group, band, dot]) o.userData.knob = i;
        return { group, band, dot, spin };
      }),
    [],
  );

  useEffect(() => {
    dials.forEach((d) => scene.add(d.group));
    return () => dials.forEach((d) => scene.remove(d.group));
  }, [dials, scene]);

  const hovered = useRef(-1);
  /** The DevKit button under the pointer, while it can be pressed. */
  const overButton = useRef<THREE.Object3D | null>(null);

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
      kitPress.boot = kitPress.rst = false;
      const d = drag.current;
      if (!d) return;
      if (!d.turned) sim.release(d.knob);
      drag.current = null;
      document.body.style.cursor = "";
    };
    // A gesture the browser took over (a scroll, say) was never a click.
    const onCancel = () => {
      kitPress.boot = kitPress.rst = false;
      const d = drag.current;
      if (!d) return;
      sim.cancel(d.knob);
      drag.current = null;
      document.body.style.cursor = "";
    };
    // The page scrolls under a finger (the canvas is touch-action: pan-y);
    // a touch that landed on a knob is the knob's. Pointer events come before
    // their touch events, so by touchstart the knob has already been taken.
    const holdTouch = (e: TouchEvent) => {
      if (drag.current && e.cancelable) e.preventDefault();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("touchstart", holdTouch, { passive: false });
    window.addEventListener("touchmove", holdTouch, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchstart", holdTouch);
      window.removeEventListener("touchmove", holdTouch);
    };
  }, []);

  // The DevKit's BOOT and RST, on the step that is about them ("Hold BOOT,
  // tap RST": scenes.ts bootSeq) and with the DevKit held up: a real hand
  // could press them there, so the reader's can (hand.ts kitPress). Only the
  // nearest thing under the pointer counts — never a button through the cable.
  const buttonUnder = (e: ThreeEvent<PointerEvent>): "boot" | "rst" | null => {
    if (!kit.boot && !kit.rst) return null;
    let which: "boot" | "rst" | null = null;
    for (let o: THREE.Object3D | null = e.object; o; o = o.parent) {
      if (o === kit.boot) which = "boot";
      else if (o === kit.rst) which = "rst";
    }
    if (!which || e.intersections[0]?.object !== e.object) return null;
    const { scene: sceneId, step, page } = useGuideStore.getState();
    return page === "play" && kitState.presented && stepOf(sceneId, step).bootSeq ? which : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const button = buttonUnder(e);
    if (button) {
      e.stopPropagation();
      kitPress[button] = true;
      return;
    }
    const knob = knobUnder(e.object);
    const knobMesh = knob < 0 ? null : parts.knobs[knob];
    if (!knobMesh) return;
    e.stopPropagation();
    // The drag turns about the centre of the knob's top face as it lies on
    // screen (the node's origin is at the knob's base), whether it began on
    // the knob or on its dial.
    const world = knobMesh.localToWorld(new THREE.Vector3(0, 0, KNOB_H));
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
    if (buttonUnder(e)) {
      overButton.current = e.object;
      if (!drag.current) document.body.style.cursor = "pointer";
      return;
    }
    const knob = knobUnder(e.object);
    if (knob < 0) return;
    hovered.current = knob;
    if (!drag.current) document.body.style.cursor = "grab";
  };
  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    if (overButton.current === e.object) overButton.current = null;
    if (knobUnder(e.object) === hovered.current) hovered.current = -1;
    if (!drag.current) document.body.style.cursor = "";
  };

  // ── the frame ──────────────────────────────────────────────────────────────
  // back: sliderPose's travel (0 shut, SLIDER_OFF off its rails, 1 laid
  // down); esp: devkitPose's travel (0 seated, 1 presented).
  // power: the panel's, as shown (it dies away when cut); held: a lit frame is still on it.
  const shown = useRef({ turns: [0, 0, 0, 0], press: [0, 0, 0, 0], power: 0, held: false, tick: 0, back: 0, esp: 0 });
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() }), []);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const readout = useRef({
    lastTurns: [0, 0, 0, 0],
    movedAt: [-1e9, -1e9, -1e9, -1e9],
    // …and when it last moved for the pattern: turned or clicked on the pattern's own screen.
    valAt: [-1e9, -1e9, -1e9, -1e9],
    text: ["", "", "", ""],
    key: "",
    settle: 0,
    // Each knob's press as it went down: when, in which step, on which screen.
    wasDown: [false, false, false, false],
    downAt: [0, 0, 0, 0],
    downKey: ["", "", "", ""],
    downRun: [false, false, false, false],
  });
  // The Build guide's Replay, as last seen (the DevKit's seating plays again).
  const replaySeen = useRef(useGuideStore.getState().replay);
  const size = useThree((st) => st.size);
  // The knobs' top centres, world units (the stage's model group: geometry.ts).
  const knobTops = useMemo(() => [0, 1, 2, 3].map((i) => modelToWorld(knobWorldCenter(i, "model"))), []);
  // …and their dials' centres on the case's face, a knob's height below: a pill stands clear of both (tags.ts).
  const dialAt = useMemo(() => [0, 1, 2, 3].map((i) => ({ at: modelToWorld(knobWorldCenter(i, "model").setZ(DIAL_Z)), radius: DIAL_OUT * MODEL_SCALE })), []);

  useFrame((state, rawDt) => {
    // A tab coming back from the background hands over one long frame; don't
    // let the timed motions below jump on it.
    const dt = Math.min(rawDt, 0.1);
    const sim = getSim();
    const { scene: sceneId, step, page, cardIn, replay } = useGuideStore.getState();
    const s = stepOf(sceneId, step);
    const snap = sim.snapshot();

    // A new step starts with no knob "just moved": the last step's demo may
    // have turned one a moment ago (K4 through the pattern list), and its
    // readout then popped up beside the knob on a step about something else.
    // A couple of frames' grace, for the board being put in the step's state.
    {
      const ro = readout.current;
      // The page is part of it: the stage carries on from one page to the
      // next, and both open on "opening", 0.
      const key = `${page}.${sceneId}.${step}`;
      if (ro.key !== key) {
        ro.key = key;
        ro.settle = 2;
      }
      // Nor is the hub's Play answer turning K1 back a knob "just moved": it
      // finishes in Play's opening (world/HubAnswers), and its readout came up
      // beside K1 there as if the reader had turned it.
      if (page !== "hub" && knobIsTurned()) ro.settle = 2;
      if (ro.settle > 0) {
        ro.settle--;
        for (let i = 0; i < 4; i++) {
          ro.lastTurns[i] = snap.turns[i];
          ro.movedAt[i] = -1e9;
          ro.valAt[i] = -1e9;
        }
      }
    }

    // Panel: copy the simulated frame in, bottom row first for GL.
    //
    // When the power goes the simulator's frame is black at once. The panel
    // is not: what it was showing dies away over a tenth of a second, as the
    // supply's capacitors empty. So the last lit frame is held on the panel
    // while its power falls, and only then is it cleared. (Coming on is the
    // firmware's own fade, in the frame itself.)
    const dst = texture.image.data as Uint8Array;
    const sh0 = shown.current;
    const on = snap.mode !== "off";
    if (on) {
      const src = sim.frame;
      const row = PANEL_W * 4;
      for (let y = 0; y < PANEL_H; y++) {
        dst.set(src.subarray(y * row, (y + 1) * row), (PANEL_H - 1 - y) * row);
      }
      texture.needsUpdate = true;
      sh0.power += (1 - sh0.power) * Math.min(1, dt * 9);
      sh0.held = true;
    } else if (sh0.held) {
      sh0.power *= Math.exp(-dt / POWER_OFF_S);
      if (sh0.power < 0.004) {
        sh0.power = 0;
        sh0.held = false;
        dst.fill(0);
        texture.needsUpdate = true;
      }
    }
    ledMat.uniforms.uPower.value = sh0.power;
    // What the panel is giving off, for the lights and the floor (look/panelGlow.ts): every other frame is plenty.
    if ((sh0.tick = (sh0.tick + 1) & 1) === 0) readPanelGlow(dst, sh0.power, dt * 2);

    // Knobs: rotation about their own axis follows the detents, a press
    // pushes the cap in along it.
    const t = state.clock.elapsedTime;
    parts.knobs.forEach((m, i) => {
      if (!m) return;
      const target = snap.turns[i];
      shown.current.turns[i] += (target - shown.current.turns[i]) * Math.min(1, dt * 14);
      m.rotation.z = m.userData.baseRotZ - (shown.current.turns[i] / PATTERN_DETENTS_PER_TURN) * Math.PI * 2;
      const pressTarget = snap.down[i] ? 1 : 0;
      shown.current.press[i] += (pressTarget - shown.current.press[i]) * Math.min(1, dt * 20);
      const home = m.userData.home as THREE.Vector3;
      m.position.z = home.z - shown.current.press[i] * KNOB_PRESS;

      const ring = rings[i].material as THREE.ShaderMaterial;
      ring.uniforms.uTime.value = t;
      ring.uniforms.uFill.value = snap.hold[i] > 0.04 ? snap.hold[i] : 0;
      const focusTarget = s.focus === i ? 1 : 0;
      ring.uniforms.uFocus.value += (focusTarget - ring.uniforms.uFocus.value) * Math.min(1, dt * 5);
      rings[i].position.z = KNOB_TOP_Z + 0.08 - shown.current.press[i] * KNOB_PRESS;

      // Has it moved lately, or is a hand on it?
      const ro = readout.current;
      const nowMs = performance.now();
      if (snap.turns[i] !== ro.lastTurns[i]) {
        ro.lastTurns[i] = snap.turns[i];
        ro.movedAt[i] = nowMs;
        // A turn on another screen is that screen's — K1 on BRIGHTNESS sets
        // the brightness — and the pattern's value did not move with it.
        if (snap.mode === "run") ro.valAt[i] = nowMs;
      }
      // A click is the pattern's as a turn is, so it counts as the knob
      // having moved — once it has turned out to be a click: let go before
      // the long-press, on the pattern's own screen, in the step it began in.
      // A press on its way to a hold is the device's, and says nothing yet.
      if (snap.down[i] !== ro.wasDown[i]) {
        ro.wasDown[i] = snap.down[i];
        if (snap.down[i]) {
          ro.downAt[i] = nowMs;
          ro.downKey[i] = ro.key;
          ro.downRun[i] = snap.mode === "run";
        } else if (ro.downRun[i] && snap.mode === "run" && ro.downKey[i] === ro.key && nowMs - ro.downAt[i] < FIRMWARE.longPressMs) {
          ro.movedAt[i] = nowMs;
          ro.valAt[i] = nowMs;
        }
      }
      const mine = drag.current?.knob === i;
      const moved = nowMs - ro.movedAt[i] < READOUT_HOLD;
      const movedVal = nowMs - ro.valAt[i] < READOUT_HOLD;
      const live = mine || snap.down[i] || hovered.current === i || moved;
      const handsOn = useGuideStore.getState().handsOn;

      // The dial: faint wherever the knobs are the subject, bright while live.
      const dial = dials[i];
      const dialShown = sceneId === "knobs" || Boolean(s.labels) || s.focus === i || handsOn;
      const bandTarget = live ? 0.55 : dialShown ? 0.3 : 0;
      const dotTarget = live ? 1 : dialShown ? 0.75 : 0;
      const bandMat = dial.band.material as THREE.MeshBasicMaterial;
      const dotMat = dial.dot.material as THREE.MeshBasicMaterial;
      bandMat.opacity += (bandTarget - bandMat.opacity) * Math.min(1, dt * 8);
      dotMat.opacity += (dotTarget - dotMat.opacity) * Math.min(1, dt * 8);
      dial.spin.rotation.z = m.rotation.z - m.userData.baseRotZ;
      const dotScale = live ? 1.25 : 1;
      dial.dot.scale.setScalar(dial.dot.scale.x + (dotScale - dial.dot.scale.x) * Math.min(1, dt * 10));

      const label = labelRefs.current[i];
      if (label) {
        // The hub is a poster: the knob turns and its dial lights, but no
        // name or number comes up beside it there.
        const on = Boolean(s.labels) || s.focus === i || snap.mode === "knobmap" || (live && page !== "hub");
        label.dataset.on = on ? "1" : "0";
        label.dataset.active = snap.activeKnob === i || snap.down[i] ? "1" : "0";
        // Beside the name, what the pattern calls this knob and where it is:
        // while the reader has it, or it has just turned or clicked. Not for
        // a scripted press alone — the hold demos press a knob for a second
        // before its screen opens, and the pattern's value beside it then
        // said the hold was the pattern's ("K1 hue 0.00" before BRIGHTNESS).
        // Nor for a turn made on another screen: the same pill came up as
        // BRIGHTNESS closed, for the turns that had set the brightness.
        //
        // And while a lane has the knob (the Audio guide's editor step): the
        // knob does not turn, so the value moving beside it is all there is
        // to see of what sound is doing to it. It stays up through a hand's
        // five seconds, showing the knob's own value, which is the hand's.
        const laned = snap.lanes[i] || snap.laneHeld[i];
        const showVal = (mine || hovered.current === i || movedVal || laned) && snap.mode === "run" && page !== "hub";
        if ((label.dataset.val === "1") !== showVal) {
          label.dataset.val = showVal ? "1" : "0";
          forgetPillSize(label);
        }
        if (showVal) {
          const r = sim.knobReadout(i);
          const text = r.label + " " + formatReadout(r.value, r.max - r.min);
          if (text !== ro.text[i]) {
            ro.text[i] = text;
            const v = label.querySelector<HTMLElement>("[data-kv]");
            const bar = label.querySelector<HTMLElement>("[data-kbar]");
            if (v) v.textContent = text;
            const pct = Math.max(0, Math.min(1, (r.value - r.min) / Math.max(1e-6, r.max - r.min)));
            if (bar) bar.style.width = Math.round(pct * 100) + "%";
            forgetPillSize(label);
          }
        }
        // Beside its knob at a fixed gap in screen pixels, whatever the
        // zoom, and outside its dial — the band the orange dot rides — and
        // its focus ring while that is lit: K1/K3 to the right, over the
        // case's margin. Left of K2/K4 is the panel's edge, where the
        // screens print their headings and SELECT its bar, so K2's goes
        // above and K4's below, and a readout there grows to the right, away
        // from the panel. Where there is no room to the right for a readout
        // (a phone), K1's goes above K2's row and K3's below K4's.
        const side = i === 0 || i === 2 ? "right" : i === 1 ? "up" : "down";
        if (on) {
          const reach = (KNOB_R + (FOCUS_RING_R - KNOB_R) * Math.min(1, ring.uniforms.uFocus.value * 1.5)) * MODEL_SCALE;
          placeTag(label, state.camera, size, knobTops[i], reach, side, 6, undefined, 0, {
            also: dialAt[i],
            growRight: true,
            alt: i === 0 ? "up" : i === 2 ? "down" : undefined,
            altRow: 1,
          });
        }
      }
    });

    // The back slider and the ESP32 DevKit, in the order hands do it: the
    // slider slides off its rails, then — while it is laid down behind the
    // case — the DevKit comes straight off its pins; it is carried round to
    // the front only once the slider is down. Going back: the DevKit comes
    // back behind the opening, the slider is picked up while it seats, and
    // the slider slides shut once the DevKit is home.
    {
      const sh = shown.current;
      const espTarget = s.esp ?? 0;
      // How far each may go given where the other is.
      const espCap = sh.back >= 1 ? 1 : sh.back >= SLIDER_OFF ? DEVKIT_LIFT_END : 0;
      const backFloor = sh.esp > DEVKIT_LIFT_END ? 1 : sh.esp > 0 ? SLIDER_OFF : 0;

      // "Everything runs on one small board.": the cover comes off for the
      // reader — once the camera has come round behind the case and the
      // step's card is on screen (store.ts cardIn) — not during the camera's
      // swing, under the chapter's title, where half of it was missed.
      // The Audio guide's "lift the ESP32 out" waits the same way: the camera
      // is behind the case already (the step before it), so it is the card.
      let holdCover = false;
      if (sh.back === 0 && ((sceneId === "flash" && step === 0 && page === "play") || micLiftStep(page, sceneId, step))) {
        const behind = tmp.pos.copy(state.camera.position).sub(VIEWS.back.target).normalize().dot(VIEWS.back.dir);
        holdCover = !cardIn || behind < 0.9;
      }
      const backTarget = holdCover ? 0 : espTarget > 0 ? 1 : backFloor;
      if (backTarget !== sh.back) {
        const inSlide = backTarget > sh.back ? sh.back < SLIDER_OFF : sh.back <= SLIDER_OFF;
        const speed = choreoSpeed(page, sceneId, step, backTarget > sh.back);
        const rate = (SLIDER_OFF / SLIDER_SECONDS.slide) * speed;
        const rateDown = ((1 - SLIDER_OFF) / SLIDER_SECONDS.setDown) * speed;
        const db = backTarget - sh.back;
        let next = sh.back + Math.sign(db) * Math.min(Math.abs(db), dt * (inSlide ? rate : rateDown));
        if ((sh.back - SLIDER_OFF) * (next - SLIDER_OFF) < 0) next = SLIDER_OFF;
        sh.back = next;
      }

      // The Build guide's "Seat the DevKit, power off.": the DevKit going
      // round the case and onto its pins is the step, so it waits in the
      // reader's hands until the camera has come round behind the case and
      // the card is on screen (it used to be home before the view arrived,
      // and nothing moved for the rest of the step), and Replay takes it
      // back out to play it again.
      const seating = seatingStep(page, sceneId, step);
      if (replay !== replaySeen.current) {
        replaySeen.current = replay;
        if (seating && espTarget === 0) sh.esp = 1;
      }
      let holdKit = false;
      if (seating && espTarget === 0 && sh.esp === 1) {
        const behind = tmp.pos.copy(state.camera.position).sub(VIEWS.back.target).normalize().dot(VIEWS.back.dir);
        // Nearly there, not just past the case's side: the camera is still by the time the DevKit comes round.
        holdKit = !cardIn || behind < 0.97;
      }
      const espGoal = holdKit ? sh.esp : Math.min(espTarget, espCap);
      if (espGoal !== sh.esp) {
        // Out, the lift takes ~0.75 s and the carry ~1.3 s (choreoSpeed).
        const out = espGoal > sh.esp;
        const lifting = out ? sh.esp < DEVKIT_LIFT_END : sh.esp <= DEVKIT_LIFT_END;
        const rate = (lifting ? DEVKIT_LIFT_END / 0.75 : (1 - DEVKIT_LIFT_END) / 1.3) * choreoSpeed(page, sceneId, step, out);
        const d = espGoal - sh.esp;
        let next = sh.esp + Math.sign(d) * Math.min(Math.abs(d), dt * rate);
        // One frame never steps across the lift/carry boundary, so each leg
        // keeps its own rate.
        if ((sh.esp - DEVKIT_LIFT_END) * (next - DEVKIT_LIFT_END) < 0) next = DEVKIT_LIFT_END;
        sh.esp = next;
      }

      devkitPose(sh.esp, tmp.pos, tmp.quat);
      parts.devkit.pivot.position.copy(tmp.pos);
      parts.devkit.pivot.quaternion.copy(tmp.quat);

      const slider = parts.slider;
      if (slider) {
        sliderPose(sh.back, tmp.pos, tmp.quat);
        slider.position.copy(tmp.pos);
        slider.quaternion.copy(tmp.quat);
        // Set down out of the way, it fades: a white slab lying on the floor
        // crossed the edge of every camera move in the chapter. It comes back
        // as it is picked up.
        const fade = 1 - smoothstep(sh.back, 0.8, 0.97);
        (slider.material as THREE.MeshStandardMaterial).opacity = fade;
        slider.visible = fade > 0.01;
        slider.castShadow = fade > 0.5;
      }
    }
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
        // Anchored on the knob's axis; placeTag pushes the pill out beside it.
        return (
          <Html key={i} position={[c.x, c.y, c.z]} center zIndexRange={[20, 0]} style={NO_POINTER}>
            <div
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              className="guide-knob-tag"
              data-on="0"
              data-val="0"
            >
              <b>{LABELS[i]}</b>
              <span className="guide-knob-val">
                <span data-kv="" />
                <span className="guide-knob-bar">
                  <span data-kbar="" />
                </span>
              </span>
            </div>
          </Html>
        );
      })}
    </group>
  );
}

/** Which knob (logical index) an object under the pointer belongs to: a knob, its hit disc, or its dial; -1 if none. */
function knobUnder(object: THREE.Object3D | null): number {
  let o = object;
  while (o) {
    if (o.name in KNOB_MESH_TO_LOGICAL) return KNOB_MESH_TO_LOGICAL[o.name];
    if (typeof o.userData.knob === "number") return o.userData.knob;
    o = o.parent;
  }
  return -1;
}

function smoothstep(x: number, e0: number, e1: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

useGLTF.preload([MODEL_URL, CASE_URL, PCB_URL, DEVKIT_URL], DRACO_URL);
