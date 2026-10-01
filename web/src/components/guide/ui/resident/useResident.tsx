"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import css from "./Resident.module.css";
import { Resident, type ResidentSetup } from "./engine";
import { COLS, ROWS, framePath } from "./sprite";

// The figure's element and its engine, for whoever gives it a line to stand
// on (HubResident, RailResident). The engine is made when the figure mounts;
// the one thing wired here is its glance — which side of it the mouse is on,
// worked out on the pointer's own events and nowhere else.

/** A window wide enough for it: under 900 px (a phone) there is no resident at all. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const mq = window.matchMedia("(min-width: 900px)");
      mq.addEventListener("change", changed);
      return () => mq.removeEventListener("change", changed);
    },
    () => window.matchMedia("(min-width: 900px)").matches,
    // Not in the server's markup: it is put in by the browser that has room for it.
    () => false,
  );
}

export function useResident(setup: ResidentSetup) {
  const el = useRef<HTMLSpanElement>(null);
  const path = useRef<SVGPathElement>(null);
  const engine = useRef<Resident | null>(null);

  useEffect(() => {
    if (!el.current || !path.current) return;
    const r = new Resident(el.current, path.current, setup);
    engine.current = r;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onCalm = () => {
      r.still = calm.matches;
    };
    onCalm();
    calm.addEventListener("change", onCalm);
    // A glance: toward the pointer, once it is clearly to one side.
    let side: -1 | 0 | 1 = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !r.isPlaced) return;
      const dx = e.clientX - r.centre;
      const next = dx > 26 ? 1 : dx < -26 ? -1 : 0;
      if (next !== side) {
        side = next;
        r.glance(next);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      calm.removeEventListener("change", onCalm);
      r.destroy();
      engine.current = null;
    };
  }, [setup]);

  return { el, path, engine };
}

/** The figure. Hidden from assistive technology and out of the tab order; a click on it is a hop. */
export function Figure({
  el,
  path,
  engine,
  scale,
  place,
}: {
  el: RefObject<HTMLSpanElement | null>;
  path: RefObject<SVGPathElement | null>;
  engine: RefObject<Resident | null>;
  scale: number;
  place: "hub" | "rail";
}) {
  return (
    <span
      ref={el}
      className={`${css.resident} ${place === "hub" ? css.onHub : css.onRail}`}
      style={{ "--px": `${scale}px` } as CSSProperties}
      aria-hidden="true"
      data-resident={place}
      onClick={() => engine.current?.hop()}
    >
      <svg viewBox={`0 0 ${COLS} ${ROWS}`} shapeRendering="crispEdges" focusable="false">
        <path ref={path} d={framePath("stand", "mid")} fill="currentColor" />
      </svg>
    </span>
  );
}
