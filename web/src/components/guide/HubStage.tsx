"use client";

import { useEffect, useLayoutEffect } from "react";
import GuideCanvas from "./stage/GuideCanvas";
import hub from "./Hub.module.css";
import { knobIsTurned, turnBackClick, turnBackNow, turnOn } from "./hubKnob";
import { getSim, useGuideStore, type GuidePageId } from "./store";

// The hub's stage: the same 3D device the guides use, playing the hub's
// script (scenes.ts HUB_SCENES — Play's opening, turning slowly beside the
// choices). Loaded on its own, after the page (GuideHub), so the hub's
// words never wait for the board, the simulator or three.js.
//
// The hub has no scroll story, so nothing here tracks the scroll: the stage
// stays on the opening. Its canvas is a box round the part of the screen
// above the choices (Hub.module.css .stageBox), and the camera fits the
// device into that (GuideCanvas freeArea reads the hub's [data-scene]).
//
// The device answers the guide the reader is pointing at (mouse or keyboard),
// with what that guide is about: Build — the panel is dark, it has not had
// its first light yet; Play — K1 turns and Origin's colour follows; Make —
// someone's own pattern is on the panel. Pointing away powers it back on,
// turns K1 back to where it was and puts Origin back. The script only sets
// the board on a step change, and the hub never changes step, so the board
// stays as it is put here. Nothing answers under reduced motion.
//
// The board is the same one in every guide (store.ts getSim), so the hub
// hands it on as it found it: Play's words call Origin red, and a hue left
// turned here would open that guide in another colour (hubKnob.ts keeps the
// count and turns it back).

/** The pattern the panel shows for Make: a community one from the Basics pack, a picture where Origin is tiles. */
const MAKE_PATTERN = "midsummer_sea";
/** Play: one click of K1 (Origin's hue, which wraps) this often, in ms. */
const PLAY_CLICK_MS = 120;
/** Pointing away from Play: K1 turns back a click this often, in ms. */
const BACK_CLICK_MS = 16;
/** Build and Make: how often the board is put back in its answer while pointed at, in ms. */
const HOLD_MS = 300;

export default function HubStage({ guide }: { guide: GuidePageId | null }) {
  useLayoutEffect(() => {
    const store = useGuideStore.getState();
    store.enterPage("hub");
    const onResize = () => useGuideStore.getState().setNarrow(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const sim = getSim();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      turnBackNow(sim);
      return;
    }
    if (!guide) {
      // Pointing away from Play: the knob turns back and the colour comes
      // home with it, a click at a time.
      if (!knobIsTurned()) return;
      const timer = window.setInterval(() => {
        if (turnBackClick(sim)) window.clearInterval(timer);
      }, BACK_CLICK_MS);
      return () => window.clearInterval(timer);
    }
    if (guide !== "play") turnBackNow(sim);
    const answer =
      guide === "build"
        ? () => sim.setMode("off")
        : guide === "play"
          ? () => turnOn(sim)
          : () => {
              sim.setPack("basics");
              sim.showPattern(MAKE_PATTERN);
            };
    answer();
    // Play's is a turning knob. The other two are a state, said again now and
    // then: the stage sets the board once when it first draws, which can come
    // after a guide is already being pointed at.
    const timer = window.setInterval(answer, guide === "play" ? PLAY_CLICK_MS : HOLD_MS);
    return () => {
      window.clearInterval(timer);
      // Power on fades the frame up (deviceSim render).
      if (guide === "build") sim.setMode("run");
      if (guide === "make") {
        sim.showPattern("origin");
        sim.setPack("origin");
      }
    };
  }, [guide]);

  // Leaving the hub — into a guide, most often Play, with K1 still turned.
  // After the effect above, whose own leaving puts the board back on Origin.
  useEffect(() => () => turnBackNow(getSim()), []);

  return (
    <div className={hub.stageBox}>
      <GuideCanvas />
    </div>
  );
}
