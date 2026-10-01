"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { smoothDamp, type Damp } from "./damp";
import { EXPLODE_WHOLE, explodeState, explodeWanted, partOffset } from "./explodeParts";
import { KNOB_MESH_TO_LOGICAL } from "./geometry";
import { PCB_PLACEMENT } from "./parts";
import { OPENING_GONE, OPENING_UNSEEN } from "./build/beats";
import { useGuideStore } from "../store";
import { buildClock } from "../timing";

// The device coming apart and going back together (explodeParts.ts has what moves
// where; this puts it on the device's objects).
//
// Mounted straight after <Device />, so each frame it runs after Device has
// put the knobs, the DevKit and the back cover where the board has them: to
// those it adds its displacement; the parts Device leaves alone (the panel,
// the lid, the board, the back plate) it places outright, from their homes.
// When the amount is back at 0 every part is written home once, exactly, and
// this does nothing more.
//
// The Build guide opens on the device still apart (explodeParts.ts
// explodeWanted), and its stage takes the device over as it hangs there:
// BuildStage reads explodeState and draws its opening by the same amount, so
// nothing changes on screen when it does. From there the amount is no longer
// only a spring toward what is asked:
//   - scrolled into the build, the opening's device goes as the bench comes
//     up (the first sixth of gather-1). It goes where it hangs: the amount is
//     held, not run home — closing it up just to dissolve it was the hub's
//     promise undone a second time;
//   - once it is gone (beats.ts OPENING_GONE) the amount is 0 at once — the
//     build's own parts are on stage, and they are BuildStage's to place —
//     except on the way back up to the opening, where it is 1 again before
//     the device fades back in.
//
// Nothing here turns the panel off: taken apart, the back cover is off its
// rails and the DevKit off its pins, and KitFx keeps a device in that state
// dark until it is whole again, as it does in the guides.

/**
 * How quickly the amount follows, seconds (damp.ts): apart, back together,
 * and back together in a hurry — a guide other than Build's opening is
 * already on screen and wants the device whole.
 */
const OUT_S = 0.42;
const HOME_S = 0.4;
const HURRY_S = 0.16;

type Rig = {
  knobs: THREE.Object3D[];
  rings: THREE.Object3D[];
  devkit: THREE.Object3D;
  slider: THREE.Object3D;
  /** The parts placed outright, each with its home. */
  placed: { part: "panel" | "lid" | "board" | "backPlate"; node: THREE.Object3D; home: THREE.Vector3 }[];
};

function find(world: THREE.Object3D): Rig | null {
  const root = world.getObjectByName("patternflow");
  if (!root) return null;
  const get = (n: string) => root.getObjectByName(n);
  const devkit = get("devkit_pivot");
  const slider = get("back_slider");
  const panel = get("l");
  const lid = get("top_lid");
  const board = get("pcb_v39");
  const backPlate = get("back_plate");
  const knobs = Object.keys(KNOB_MESH_TO_LOGICAL).map(get);
  if (!devkit || !slider || !panel || !lid || !board || !backPlate || knobs.some((k) => !k)) return null;
  const home = (o: THREE.Object3D) => ((o.userData.home as THREE.Vector3 | undefined) ?? o.position).clone();
  const placed: Rig["placed"] = [
    { part: "panel", node: panel, home: home(panel) },
    { part: "lid", node: lid, home: home(lid) },
    { part: "board", node: board, home: PCB_PLACEMENT.position.clone() },
    { part: "backPlate", node: backPlate, home: home(backPlate) },
  ];
  // The floor of the back plate's snap notch (Device) is the plate's.
  const notch = get("notch_floor");
  if (notch) placed.push({ part: "backPlate", node: notch, home: home(notch) });
  const rings: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.name === "knob_ring") rings.push(o);
  });
  return { knobs: knobs as THREE.Object3D[], rings, devkit, slider, placed };
}

export default function Explode() {
  const world = useThree((s) => s.scene);
  const rig = useRef<Rig | null>(null);
  const st = useRef<{ e: number; vel: Damp }>({ e: 0, vel: { v: 0 } });
  const o = useMemo(() => new THREE.Vector3(), []);

  // Gone with the canvas: nothing is apart.
  useEffect(
    () => () => {
      explodeState.amount = 0;
    },
    [],
  );

  useFrame((_, rawDt) => {
    const s = st.current;
    const want = explodeWanted() ? 1 : 0;
    if (want === 0 && s.e === 0) return;
    const dt = Math.min(rawDt, 1 / 20);
    const { page, scene } = useGuideStore.getState();
    const t = buildClock.t;
    let e: number;
    if (t >= OPENING_GONE) {
      // The build is under way and the opening's device is not on stage: whole,
      // or — on the way back up to the opening, while it still cannot be seen — apart again.
      e = want && t < OPENING_UNSEEN ? 1 : 0;
      s.vel.v = 0;
    } else if (!want && page === "build" && t >= 0) {
      // Scrolled into the build: the opening's device goes where it hangs.
      e = s.e;
      s.vel.v = 0;
    } else {
      const hurry = page !== "hub" && scene !== "opening";
      e = smoothDamp(s.e, want, s.vel, want ? OUT_S : hurry ? HURRY_S : HOME_S, dt);
      if (want === 0 && e < EXPLODE_WHOLE) {
        e = 0;
        s.vel.v = 0;
      } else if (want === 1 && e > 1 - EXPLODE_WHOLE) e = 1;
    }
    const r = (rig.current ??= find(world));
    if (!r) {
      // The device has not loaded yet: nothing has moved.
      s.e = 0;
      s.vel.v = 0;
      return;
    }
    s.e = e;
    explodeState.amount = e;

    // Added to where Device has just put them.
    partOffset("knobs", e, o);
    for (const k of r.knobs) k.position.z += o.z;
    for (const ring of r.rings) ring.position.z += o.z;
    r.devkit.position.add(partOffset("devkit", e, o));
    r.slider.position.add(partOffset("slider", e, o));
    // Placed from home.
    for (const p of r.placed) p.node.position.copy(p.home).add(partOffset(p.part, e, o));
  });

  return null;
}
