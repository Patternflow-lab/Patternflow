"use client";

/* eslint-disable react-hooks/immutability --
   A light is an imperative three.js object driven from the frame loop; that
   is its API and it never feeds back into React. */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getSim, useGuideStore } from "../store";
import { handSteer } from "../world/hubHand";
import { touchSpot } from "./build/touchState";
import { LED_CENTER_WORLD } from "./geometry";
import { hand, handGone, handHold } from "./hand";
import { stageFocus } from "./look/focus";

// The stage answers the hand.
//
// The guide's stage played like a film: everything on it moved by the script
// and nothing by the reader, short of taking a knob. This is the reader's
// mouse on it (hand.ts), and the two things it carries here:
//
//   a light   small and soft, held just in front of what the camera is on and
//             moved with the pointer, so it rakes over what it passes — the
//             print's layers, the knobs' flanks, the board's mask, the bench.
//             It is weak beside the key light and it cannot touch the panel
//             (whose face is its own light, not a lit surface): it adds a
//             highlight, it does not relight the room. On the Build guide it
//             goes to the part the parts list is pointing at
//             (build/touchState.ts touchSpot).
//   the hub   the pointer on the panel steers the pattern a little, as two
//             knobs would (world/hubHand.ts: the arithmetic, and giving the
//             board back).
//
// The camera's lean toward the pointer is the rig's (GuideCanvas CameraRig),
// and the Build guide's parts are BuildStage's (build/touch.ts); both read
// the same hand.
//
// None of it is there for a finger (a touch is a scroll or a knob), for a
// reader who asked for less motion, or on Make, where the stage rests. The
// pointer is read on pointer events only; a frame does a ray, a plane and
// two eases.
//
// The light is always in the scene, at nothing when it is not wanted: a light
// coming or going changes every lit shader on the stage (GuideCanvas, on the
// panel's lights).

/** The floor (look/StageLight.tsx), and how near it the light may come. */
const FLOOR_Y = -1.66;
const FLOOR_CLEAR = 0.32;
/** What it gives a surface straight under it, against the key light's 2.4. */
const GIVES = 0.85;
/** How many times that for the part the parts list points at. */
const SPOT = 2.4;
/** The panel's lit face: its plane and half-sizes, world units (look/StageLight.tsx FACE). */
const PANEL = { z: 0.15, hw: 0.8, hh: 1.6 };

export default function StageHand({ reducedMotion }: { reducedMotion: boolean }) {
  const gl = useThree((s) => s.gl);
  const light = useRef<THREE.PointLight>(null);
  const lit = useRef(0);
  const at = useMemo(() => ({ u: 0, v: 0 }), []);
  const tmp = useMemo(() => ({ dir: new THREE.Vector3(), view: new THREE.Vector3(), to: new THREE.Vector3(), want: new THREE.Vector3() }), []);

  // Where the mouse is (hand.ts). A finger is never the hand.
  useEffect(() => {
    const canvas = gl.domElement;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hand.px = e.clientX;
      hand.py = e.clientY;
      hand.x = (e.clientX / window.innerWidth) * 2 - 1;
      hand.y = (e.clientY / window.innerHeight) * 2 - 1;
      hand.here = true;
      hand.onStage = e.target === canvas;
      hand.moves++;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") handGone();
    };
    const onHide = () => {
      if (document.hidden) handGone();
    };
    const root = document.documentElement;
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("blur", handGone);
    root.addEventListener("pointerleave", handGone);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("blur", handGone);
      root.removeEventListener("pointerleave", handGone);
      document.removeEventListener("visibilitychange", onHide);
      handGone();
    };
  }, [gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { page, leaving } = useGuideStore.getState();
    const cam = state.camera;
    const l = light.current;
    const over = hand.here && hand.onStage && !reducedMotion;
    // The card's part, on the Build guide: the light is there, wherever the pointer is.
    const spot = touchSpot.on && page === "build" && !reducedMotion;
    const wanted = (over || spot) && !leaving && page !== "make";

    let onPanel = false;
    if (wanted || (over && page === "hub")) {
      cam.updateMatrixWorld();
      const { dir, view, to, want } = tmp;
      // The line from the eye through the pointer.
      dir.set(hand.x, -hand.y, 0.5).unproject(cam).sub(cam.position).normalize();

      if (l && wanted) {
        // How far in front of its subject it is held (hand.ts handHold).
        const hold = handHold(stageFocus.r);
        if (spot) want.set(touchSpot.x, touchSpot.y, touchSpot.z);
        else {
          // Just this side of the plane the camera is on — and never under
          // the floor, which that plane goes through in a view from above.
          cam.getWorldDirection(view);
          let d = view.dot(to.subVectors(stageFocus.target, cam.position)) / Math.max(0.2, dir.dot(view)) - hold;
          if (dir.y < -1e-3) d = Math.min(d, (FLOOR_Y + FLOOR_CLEAR - cam.position.y) / dir.y);
          want.copy(cam.position).addScaledVector(dir, Math.max(0.3, d));
        }
        // It trails the pointer a little; lit from nothing, it is simply there.
        if (lit.current < 0.004) l.position.copy(want);
        else l.position.lerp(want, 1 - Math.exp(-dt * 16));
        l.distance = hold * 5;
        // (The card's part is lit harder: there the light is all the pointing there is.)
        lit.current += (GIVES * (spot ? SPOT : 1) * hold * hold - lit.current) * (1 - Math.exp(-dt * 9));
      }

      // The hub: where on the panel the pointer is, from in front of it.
      if (over && page === "hub" && cam.position.z > PANEL.z && dir.z < -1e-3) {
        const s = (PANEL.z - cam.position.z) / dir.z;
        at.u = (cam.position.x + dir.x * s - LED_CENTER_WORLD.x) / PANEL.hw;
        at.v = (cam.position.y + dir.y * s - LED_CENTER_WORLD.y) / PANEL.hh;
        onPanel = Math.abs(at.u) <= 1 && Math.abs(at.v) <= 1;
      }
    }
    if (!wanted) lit.current += (0 - lit.current) * (1 - Math.exp(-dt * 6));
    if (l) l.intensity = lit.current < 0.002 ? 0 : lit.current;

    if (page === "hub") handSteer(getSim(), onPanel ? at : null, dt * 1000);
  });

  return <pointLight ref={light} color="#fff0dc" intensity={0} distance={4} decay={2} />;
}
