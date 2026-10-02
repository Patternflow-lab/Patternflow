"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useLayoutEffect } from "react";
import { panelGlow } from "../stage/look/panelGlow";
import { panelSignal } from "./panelSignal";
import { stageLoad } from "./stageLoad";

// The stage says how far along it is (ui/stageLoad.ts), and keeps its own
// curtain: from the moment its canvas mounts until the device has been drawn
// and the frames run smooth, the canvas is out (Guide.module.css
// .world[data-stage="loading"]); then it comes in with the canvas's own fade.
// So the first frames — the models popping in, the shaders being built, the
// stutter of both — are never on the page, with the preloader over them or
// without (a visit with everything cached has no preloader; a reader who
// came in on Make and goes to Play loads the stage then).
//
// Mounted with the canvas, in the stage's chunk (world/WorldStage). What it
// counts is three's own loading manager (drei's useProgress): the models,
// their decoder, their textures.
//
// "Drawn" is read off the page, since this stands outside the canvas: the
// device's knob tags are in the document once the device has mounted
// (stage/Device.tsx, drei's <Html>), and from there the frames are timed —
// the first few are long (shaders), and the stage is ready when a handful in
// a row are not.

// It also hands the page what the panel is showing (ui/panelSignal.ts): the
// stage's own signal, stage/look/panelGlow.ts, copied out of three's colours
// into plain numbers a few times a second, for the page's tint.

/** The panel's signal is handed to the page this often, ms (the tint eases it). */
const SIGNAL_MS = 90;

function toByte(linear: number) {
  const v = Math.max(0, Math.min(1, linear));
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
}

/** A frame this long or longer is a stutter, ms. */
const SMOOTH_MS = 40;
/** This many smooth frames in a row, after the device has mounted, and the stage is ready. */
const SMOOTH_FRAMES = 5;
/** However the frames run, this long after the device mounted is long enough, ms. */
const SETTLE_MAX_MS = 1800;
/** And this long after the canvas, device or no device (a model that failed, a lost context), ms. */
const GIVE_UP_MS = 12000;

export default function StageLoadReport() {
  useLayoutEffect(() => {
    const world = document.querySelector<HTMLElement>("[data-guide-world]");
    world?.setAttribute("data-stage", "loading");
    stageLoad.set({ staged: true });

    const t0 = performance.now();
    let raf = 0;
    let last = t0;
    let most = 0;
    let mountedAt = 0;
    let smooth = 0;
    const done = () => {
      raf = 0;
      stageLoad.set({ frac: 1, ready: true });
      world?.removeAttribute("data-stage");
    };
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      const p = useProgress.getState();
      // The total grows as models name their parts: the share never goes back.
      most = Math.max(most, p.total);
      if (most > 0) stageLoad.set({ frac: Math.max(stageLoad.get().frac, Math.min(1, p.loaded / most)) });
      if (!mountedAt && world?.querySelector(".guide-knob-tag")) mountedAt = t;
      if (mountedAt) {
        smooth = dt < SMOOTH_MS ? smooth + 1 : 0;
        if (smooth >= SMOOTH_FRAMES || t - mountedAt > SETTLE_MAX_MS) return done();
      }
      if (t - t0 > GIVE_UP_MS) return done();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      // The stage is taken down with the guide: the next visit's starts over.
      if (raf) cancelAnimationFrame(raf);
      world?.removeAttribute("data-stage");
      stageLoad.set({ staged: false, frac: 0, ready: false });
    };
  }, []);

  useEffect(() => {
    const copy = () => {
      panelSignal.rgb[0] = toByte(panelGlow.hue.r);
      panelSignal.rgb[1] = toByte(panelGlow.hue.g);
      panelSignal.rgb[2] = toByte(panelGlow.hue.b);
      panelSignal.colour = panelGlow.colour;
      panelSignal.lit = panelGlow.lit;
      panelSignal.live = true;
    };
    copy();
    const timer = window.setInterval(copy, SIGNAL_MS);
    return () => {
      window.clearInterval(timer);
      panelSignal.live = false;
    };
  }, []);

  return null;
}
