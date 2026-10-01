"use client";

import { useEffect } from "react";
import { knobIsTurned, turnBackClick, turnBackNow, turnOn } from "../hubKnob";
import { getSim, useGuideStore } from "../store";
import { DRAW_MS, makeNext, makeRestore } from "./hubMake";

// The hub's answers. On the hub the device answers the guide the reader is
// pointing at (mouse or keyboard — store.preview, from GuideHub), with what
// that guide is about:
//
//   Build   the device comes apart: case, panel, board, DevKit, back, knobs,
//           each along the way it goes on (stage/Explode — the stage's, not
//           the board's: a device in pieces is dark, and KitFx keeps it so)
//   Play    K1 turns and Origin's colour follows (hubKnob.ts)
//   Make    the pattern on the panel is made again and again (hubMake.ts)
//
// Pointing away puts it all back, as calmly as it came: the parts settle,
// K1 turns back a click at a time, Origin is drawn back. Nothing answers
// under reduced motion.
//
// This lives with the stage (world/WorldStage), not with the hub's page: the
// board is the same one in every guide, and choosing a guide must not cut an
// answer off. Going into Play, K1 finishes turning back there — Play's words
// call Origin red — and going anywhere else it is back before the next
// page's first frame, because that page may turn the panel off (Build opens
// dark), and a knob only turns a pattern that is running.

/** Play: one click of K1 (Origin's hue, which wraps) this often, in ms. */
const PLAY_CLICK_MS = 120;
/** Pointing away from Play: K1 turns back a click this often, in ms. */
const BACK_CLICK_MS = 16;
/** Build: pointed at for this long, its stage is readied on the canvas, in ms (the parts are apart and nearly still by then). */
const BUILD_STANDBY_MS = 700;
/** Make: a pattern holds this long once it is drawn, in ms. */
const MAKE_HOLD_MS = 1150;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HubAnswers() {
  const page = useGuideStore((s) => s.page);
  const guide = useGuideStore((s) => (s.page === "hub" ? s.preview : null));

  // Off the hub to anywhere but Play: K1 home at once, inside the store's own
  // update — before the stage draws the next page's first frame.
  useEffect(
    () =>
      useGuideStore.subscribe((s, prev) => {
        if (s.page === prev.page || prev.page !== "hub" || s.page === "play") return;
        // Origin first: a knob turns the pattern that is running, and it is Origin's hue that is owed.
        makeRestore(getSim());
        turnBackNow(getSim());
      }),
    [],
  );

  useEffect(() => {
    const sim = getSim();
    if (reducedMotion()) {
      turnBackNow(sim);
      return;
    }
    if (guide === "play") {
      turnOn(sim);
      const timer = window.setInterval(() => turnOn(sim), PLAY_CLICK_MS);
      return () => window.clearInterval(timer);
    }
    if (guide === "make") {
      // K1 stays where Play left it for now: it is Origin's knob, and turns back once Origin is.
      makeNext(sim);
      const timer = window.setInterval(() => makeNext(sim), DRAW_MS + MAKE_HOLD_MS);
      return () => {
        window.clearInterval(timer);
        makeRestore(sim);
      };
    }
    // Build is pointed at: its stage and models start loading now (GuideCanvas
    // loads the same module), and if the reader lingers the Build stage is
    // put on the canvas in standby, where it gets its shaders built while the
    // device hangs apart — so choosing Build flows straight into the guide
    // (BuildStage). It stays there, doing nothing, until the hub is left.
    if (guide === "build") {
      void import("../stage/build/BuildStage");
      const timer = window.setTimeout(() => useGuideStore.getState().setBuildLive(true), BUILD_STANDBY_MS);
      return () => window.clearTimeout(timer);
    }
    // Nothing pointed at, or Build (the stage's): the knob turns back and the
    // colour comes home with it, a click at a time — here, and in Play.
    if (!knobIsTurned()) return;
    if (page !== "hub" && page !== "play") return;
    const timer = window.setInterval(() => {
      if (turnBackClick(sim)) window.clearInterval(timer);
    }, BACK_CLICK_MS);
    return () => window.clearInterval(timer);
  }, [guide, page]);

  // The world is left (out of the guide altogether): the board as it was found.
  useEffect(
    () => () => {
      makeRestore(getSim());
      turnBackNow(getSim());
    },
    [],
  );

  return null;
}
